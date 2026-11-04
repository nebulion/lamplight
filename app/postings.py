"""Reads each job's posting (2026-11-03): saves its full text in data/postings/<job id>.json, pulls out the facts it
states (pay, hours, years asked for, closing date, whether it asks for a cover letter), and corrects the job with them.
Fixed rules, no AI. Public pages only: no logins, and a page behind a bot check is left alone and marked unread.
Notes on particular job boards can go in data/boards.py (see load_boards); the code here names none.

  python app/postings.py                 read every open job that has no saved posting yet
  python app/postings.py --id JOB_ID     read one job again
  python app/postings.py --again         read every open job again
  python app/postings.py --unread        try again on pages that came back empty

The resume and letter builders score their picks against this text (tracker/resume.js, tracker/letter.js)."""
import base64
import concurrent.futures as cf
import datetime as dt
import html
import importlib.util
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import person  # noqa: E402
import store  # noqa: E402

FOLDER = os.path.join(person.DATA, "postings")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      "Accept": "text/html,application/json;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9"}
OPEN = ("inbox", "queued", "later")
MAX_TEXT = 40000


def load_boards():
    """data/boards.py, if they have one: how to read particular job boards directly. Without it, every posting goes through
    the general reader: the job data pages publish for search engines, then the page itself, then a browser."""
    path = os.path.join(person.DATA, "boards.py")
    if not os.path.isfile(path):
        return None
    spec = importlib.util.spec_from_file_location("job_boards", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BOARDS = load_boards()


class Gone(Exception):
    """The board says this posting no longer exists."""


class Unread(Exception):
    """We couldn't get this posting; the message says why, in words."""


# ---------------- fetching
_hosts = {}
_hosts_lock = threading.Lock()


def _gate(host):
    with _hosts_lock:
        return _hosts.setdefault(host, threading.Semaphore(2))     # at most two at a time per site, to be polite


def fetch(url, timeout=25, tries=3):
    """The page's bytes and final address. Raises HTTPError for a refusal; retries a dropped connection."""
    host = urllib.parse.urlparse(url).netloc
    for n in range(tries):
        try:
            with _gate(host):
                time.sleep(0.25)
                with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as f:
                    return f.read(), f.geturl()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and n < tries - 1:
                time.sleep(2 * (n + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            if n == tries - 1:
                raise Unread("couldn't reach the site") from e
            time.sleep(2 * (n + 1))


def get_json(url, timeout=25):
    return json.loads(fetch(url, timeout)[0].decode("utf-8", "replace"))


def clean(h):
    """Plain text from a posting's HTML, keeping its line breaks. Some boards escape their HTML twice."""
    t = h or ""
    for _ in range(2):
        if re.search(r"&lt;|&amp;|&nbsp;|&#\d+;", t):
            t = html.unescape(t)
    t = re.sub(r"(?is)<(script|style|noscript|svg|nav|header|footer|form|button)\b.*?</\1>", " ", t)
    t = re.sub(r"(?i)<(br|/p|/li|/div|/h\d|/tr|/ul|/ol|/section)\b[^>]*>", "\n", t)
    t = re.sub(r"(?i)<li\b[^>]*>", "\n- ", t)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t)).replace("\xa0", " ")
    t = re.sub(r"[ \t\r\f\v]+", " ", t)
    return re.sub(r"\s*\n\s*", "\n", t).strip()


def ld_posting(page):
    """The JobPosting block many boards put in their pages for search engines."""
    for m in re.finditer(r'(?is)<script[^>]+application/ld\+json[^>]*>(.*?)</script>', page):
        try:
            d = json.loads(m.group(1).strip(), strict=False)
        except ValueError:
            continue
        for x in (d if isinstance(d, list) else d.get("@graph", [d]) if isinstance(d, dict) else []):
            if isinstance(x, dict) and "JobPosting" in str(x.get("@type")) and x.get("description"):
                return x
    return None


def ld_salary(x):
    b = x.get("baseSalary")
    v = b.get("value") if isinstance(b, dict) else None
    if not isinstance(v, dict):
        return None
    lo, hi = v.get("minValue") or v.get("value"), v.get("maxValue") or v.get("value")
    try:
        return money(float(lo), float(hi or lo), str(v.get("unitText", "")).lower())
    except (TypeError, ValueError):
        return None


HOUR_WORDS = [("FULL_TIME", "full-time"), ("PART_TIME", "part-time"), ("TEMPORARY", "temporary"), ("SEASONAL", "seasonal"), ("CONTRACT", "temporary"), ("INTERN", "temporary"), ("PER_DIEM", "temporary")]


def hours_word(s):
    s = str(s or "").upper().replace("-", "_").replace(" ", "_")
    return next((w for k, w in HOUR_WORDS if k in s), "")


def read_board(url):
    """Returns {text, how, hours, pay, closes, internal}. Raises Gone or Unread."""
    p = urllib.parse.urlparse(url)
    host = p.netloc.lower()
    try:
        got = BOARDS.read(url, sys.modules[__name__]) if BOARDS else None    # their own board notes, if they have any
        if got:
            return got
        data, final = fetch(url)
    except urllib.error.HTTPError as e:
        if e.code in (404, 410) and host in getattr(BOARDS, "PAGE_DECIDES", ()):
            data, final = page_or_gone(url)
        elif e.code in (404, 410):
            raise Gone("the page is gone") from e
        else:
            raise Unread("the site refused (%d)" % e.code) from e
    if data[:5] == b"%PDF-":
        return {"text": pdf_text(data), "how": "pdf"}
    page = data.decode("utf-8", "replace")
    if p.fragment:                                                  # several jobs on one page: the part this link points to
        i = page.find('id="%s"' % p.fragment)
        if i >= 0:
            j = page.find('id="div_', i + 10)
            return {"text": clean("<x " + page[i: j if j > 0 else i + 12000]), "how": "page part"}
    ld = ld_posting(page)
    if ld and len(clean(ld["description"])) >= 200:
        return {"text": clean(ld["description"]), "how": "json-ld", "pay": ld_salary(ld), "hours": hours_word(ld.get("employmentType"))}
    return {"text": clean(page), "how": "page"}


def raise_if_closed(data):
    if not CLOSED_RE.search(data.decode("utf-8", "replace")[:200000]) and ld_posting(data.decode("utf-8", "replace")):
        raise Unread("the board and its page disagree about whether it's open")


def page_or_gone(url):
    try:
        return fetch(url)
    except urllib.error.HTTPError as e:
        if e.code in (404, 410):
            raise Gone("the page is gone") from e
        raise Unread("the site refused (%d)" % e.code) from e


def pdf_text(data):
    try:
        import io
        import pypdf
        return "\n".join((pg.extract_text() or "") for pg in pypdf.PdfReader(io.BytesIO(data)).pages)
    except Exception as e:                                          # pypdf is optional
        raise Unread("the posting is a PDF we couldn't read") from e


# ---------------- pages that only show the job once a browser has run them (never used on a refusal or a bot check)
def browser_path():
    for name in ("msedge", "chrome", "google-chrome", "chromium", "chromium-browser"):
        if shutil.which(name):
            return shutil.which(name)
    for p in (r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Google\Chrome\Application\chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"):
        if os.path.isfile(p):
            return p
    return ""


class Tab:
    """Just enough of a websocket to ask a browser tab for its page (the standard library has no client)."""

    def __init__(self, ws_url):
        p = urllib.parse.urlparse(ws_url)
        self.sock = socket.create_connection((p.hostname, p.port), timeout=20)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall(("GET %s HTTP/1.1\r\nHost: %s:%d\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n" % (p.path, p.hostname, p.port, key)).encode())
        reply = b""
        while b"\r\n\r\n" not in reply:
            reply += self.sock.recv(4096)
        self.n = 0

    def _exactly(self, n):
        out = b""
        while len(out) < n:
            part = self.sock.recv(n - len(out))
            if not part:
                raise ConnectionError("closed")
            out += part
        return out

    def _message(self):
        whole = b""
        while True:
            h = self._exactly(2)
            size = h[1] & 127
            if size == 126:
                size = int.from_bytes(self._exactly(2), "big")
            elif size == 127:
                size = int.from_bytes(self._exactly(8), "big")
            whole += self._exactly(size)
            if h[0] & 0x80:
                return whole

    def evaluate(self, expression):
        self.n += 1
        data = json.dumps({"id": self.n, "method": "Runtime.evaluate", "params": {"expression": expression, "returnByValue": True}}).encode()
        size = len(data)
        head = bytes([0x81]) + (bytes([0x80 | size]) if size < 126 else bytes([0x80 | 126]) + size.to_bytes(2, "big"))
        mask = os.urandom(4)
        self.sock.sendall(head + mask + bytes(c ^ mask[i % 4] for i, c in enumerate(data)))
        while True:
            m = json.loads(self._message())
            if m.get("id") == self.n:
                return (m.get("result", {}).get("result") or {}).get("value")


def render(url, timeout=40):
    """The page's HTML once a headless browser has run it, or "" if there's no browser or it fails."""
    exe = browser_path()
    if not exe:
        return ""
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    html_out = ""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as profile:     # the browser can still hold a file for a moment
        proc = subprocess.Popen([exe, "--headless=new", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--no-first-run", "--remote-debugging-port=%d" % port,
                                 "--user-data-dir=" + profile, url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            def ask(expression):
                with urllib.request.urlopen("http://127.0.0.1:%d/json" % port, timeout=3) as f:
                    pages = [t for t in json.loads(f.read()) if t.get("type") == "page" and t.get("webSocketDebuggerUrl")]
                tab = Tab(pages[0]["webSocketDebuggerUrl"])
                try:
                    return tab.evaluate(expression)
                finally:
                    tab.sock.close()
            end, last, misses = time.time() + timeout, -1, 0
            while time.time() < end and misses < 4:                      # keep the latest copy: on some sites the browser quits a few seconds in
                time.sleep(0.5)
                try:
                    n = ask("document.body ? document.body.innerText.length : 0") or 0
                    if n > 0:
                        html_out = ask("document.documentElement.outerHTML") or html_out
                        if re.search(r"(?i)job_?not_?found", ask("location.href") or ""):
                            html_out = "<p>Job not found</p>"
                            break
                        if n == last and (n > 300 or CLOSED_RE.search(clean(html_out))):
                            break
                    last, misses = n, 0
                except (OSError, ValueError, IndexError):
                    misses += 1
        finally:
            proc.kill()
            proc.wait(timeout=10)
    return html_out


BROWSER_HELPS = ("the page shows it only in a browser", "the page has no job details", "the link goes to a general jobs page")


def read_rendered(job, rec):
    """Second try for a page that came back empty: rec is the first try. Returns {text, how}, or None."""
    if rec.get("problem") not in BROWSER_HELPS and not (rec.get("problem", "").startswith("the site refused") and any(x in job["url"] for x in getattr(BOARDS, "BROWSER_AFTER_REFUSAL", ()))):
        return None
    page = render(job["url"])
    if not page:
        return None
    ld = ld_posting(page)
    if ld and len(clean(ld["description"])) >= 200:
        return {"text": clean(ld["description"]), "how": "json-ld", "pay": ld_salary(ld), "hours": hours_word(ld.get("employmentType"))}
    return {"text": clean(page), "how": "browser"}


# ---------------- what the posting says
GOOD_PAY = re.compile(r"(?i)\b(pay|paid|salary|salaries|compensation|wages?|hourly|per hour|an hour|/ ?hr|/ ?hour|annual|annually|per year|a year|/ ?yr|/ ?year|rate|range|earn)\b")
BAD_PAY = re.compile(r"(?i)sales|target|quota|revenue|budget|bonus|sign[- ]?on|tuition|reimburs|stipend|million|billion|\bfees?\b|donat|insurance|deductible|401|gift|discount|credit|allowance|grant|commission|raised|worth|per month|monthly|retention|referral|relocation|equity")
NUM = r"(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)"
AMOUNT = r"\$\s?" + NUM + r"\s?(k\b)?"
PAY_RE = re.compile(AMOUNT + r"(?:\s*(?:-|–|—|to|and)\s*(?:USD\s*)?\$?\s?" + NUM + r"\s?(k\b)?)?", re.I)


def money(lo, hi, unit=""):
    """{pay, salary_min} from two amounts. Hourly below $200, yearly from $25,000; anything else isn't believed."""
    hi = hi or lo
    if "hour" in unit or lo < 200:
        if not 10 <= lo <= 150:
            return None
        f = lambda v: "$%.2f" % v if v != int(v) else "$%d" % v
        return {"pay": (f(lo) if hi == lo else f(lo) + "-" + f(hi)) + "/hr", "salary_min": int(round(lo * 2080))}
    if not 25000 <= lo <= 400000:
        return None
    return {"pay": "$%s" % format(int(lo), ",") if hi == lo else "$%s-$%s" % (format(int(lo), ","), format(int(hi), ",")), "salary_min": int(lo)}


def pay_in(text, location=""):
    found = []
    for m in PAY_RE.finditer(text):
        before = re.split(r"[.;!?]\s|\n", text[max(0, m.start() - 90): m.start()])[-1]
        after = re.split(r"[.;!?]\s|\n", text[m.end(): m.end() + 40])[0]
        if BAD_PAY.search(before + " " + after) or not GOOD_PAY.search(before + " " + after):
            continue
        num = lambda s, k: float(s.replace(",", "")) * (1000 if k else 1) if s else 0
        lo, hi = num(m.group(1), m.group(2)), num(m.group(3), m.group(4) or m.group(2) if m.group(3) else None)
        if hi and hi < lo:
            hi = 0
        got = money(lo, hi or lo)
        if got:
            if re.search(r"(?i)\btips\b|gratuit", after):
                got["pay"] += " + tips"
            got["_near"] = before
            found.append(got)
    if not found:
        return None
    city = (location or "").split(",")[0].strip().lower()
    best = next((f for f in found if city and city in f["_near"].lower()), found[0])     # several cities' ranges: this job's city
    return {k: v for k, v in best.items() if k != "_near"}


WORD_NUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "ten": 10}
YEARS_RE = re.compile(r"(?i)\b(\d{1,2}|one|two|three|four|five|six|seven|eight|ten)\b\s*(?:\(\d+\)\s*)?(?:\+|plus)?\s*(?:(?:-|–|to|or)\s*\d{1,2}\s*\+?\s*)?(?:years?|yrs?)\b")
SOFT = re.compile(r"(?i)prefer|desir|ideal|nice to have|a plus|an asset|bonus|advantage|helpful")
NOT_WORK = re.compile(r"(?i)years? old|years? of age|at least 18|\bage\b|past \w+ years|last \w+ years|within \w+ years|in business|for over|has over|have over|with over|since|anniversary|history|founded|years? ago|for \d+ years? after|commit|contract term|work(ing)? authori[sz]|\b(his|her|our|their) ")
ASKS = re.compile(r"(?i)minimum|at least|requires?|required|must|need|\d\s?\+|or more|years? of|years?'")


def years_in(text, strict=False):
    """The fewest years of experience the posting requires, or None. Skips preferred ones, ages and company history.
    strict: this text isn't known to be the requirements, so the sentence has to sound like one."""
    low = None
    for sent in re.split(r"(?<=[.;!?])\s+|\n", text):
        if not re.search(r"(?i)experien", sent) or SOFT.search(sent) or NOT_WORK.search(sent) or (strict and not ASKS.search(sent)):
            continue
        for m in YEARS_RE.finditer(sent):
            w = m.group(1).lower()
            n = WORD_NUM.get(w) or int(w) if not w.isdigit() else int(w)
            if 0 < n <= 15 and (low is None or n < low):
                low = n
    return low


HOURS_TEXT = [("seasonal", r"(?i)\bseasonal\b"), ("temporary", r"(?i)\btemporary\b|\btemp\b|fixed[- ]term"), ("part-time", r"(?i)\bpart[- ]?time\b"), ("full-time", r"(?i)\bfull[- ]?time\b")]


def hours_in(title, text):
    for word, rx in HOURS_TEXT:
        if re.search(rx, title):
            return word
    plain = r"(?i)\b(job type|employment type|position type|schedule|status)\b\W{0,5}(\w+\W+){0,3}?%s|\b%s (position|role|job|employee|employment|staff)\b"
    for word, rx in (("seasonal", "seasonal"), ("temporary", "temporary")):
        if re.search(plain % (rx, rx), text[:2500]):
            return word
    has = [w for w, rx in HOURS_TEXT[2:] if re.search(rx, text)]
    return has[0] if len(has) == 1 else ""


CLOSED_RE = re.compile(r"(?i)no longer (available|accepting|open)|position (has been )?(filled|closed)|(job|posting|position|vacancy|requisition) (has |is )?(expired|closed)|this job is not available|job not found|not accepting applications|page you are looking for doesn.t exist|job does not exist|not currently active")
INTERNAL_RE = re.compile(r"(?i)must be (serving )?(a )?permanent|must (currently )?hold permanent|only open to candidates serving|candidates serving permanently|be permanent in the|current (\w+ ){0,3}employees only|internal (candidates|applicants) only|open only to (current|internal)|only open to (current|internal)")
SALES_RE = re.compile(r"(?i)sales targets?\b|sales goals?\b|sales quotas?\b|\bquotas?\b|commission[- ]only|cold[- ]call")
CLEARANCE_RE = re.compile(r"(?i)(security|secret|government) clearance (is )?(required|needed)|must (have|hold|obtain) an? [^.\n]{0,30}clearance|active clearance")
DEGREE_RE = [("a master's degree", r"(?i)master'?s degree (is )?required|requires? an? master|must (have|hold) an? master"), ("a bachelor's degree", r"(?i)bachelor'?s degree|baccalaureate|\bBS degree\b|\bB\.S\."), ("an associate degree", r"(?i)associate'?s? degree")]
LICENSE_RE = [("a driver's license", r"(?i)driver'?s licen[sc]e|driving licen[sc]e"), ("a commercial driver's license", r"(?i)\bCDL\b|commercial driver"), ("a guard license", r"(?i)security guard (licen[sc]e|registration)|licensed .{0,20}guard|guard licen[sc]e"),
              ("a civil service exam", r"(?i)civil service (exam|list|examination)|must (have )?pass(ed)? (a |an |the )?\w* ?exam"), ("a professional license", r"(?i)\bP\.?E\.? licen[sc]e|professional engineer|registered architect|\bRA licen[sc]e")]
CERT_RE = re.compile(r"\b(CompTIA A\+|A\+ cert\w*|Network\+|Security\+|CCNA|CCNP|ITIL|GISP|PMP|OSHA[- ]?\d+|ServSafe)\b")
# headings, not lines that happen to contain the word: "Experience" is one, "Cisco experience" isn't
HEAD_REQ = re.compile(r"(?i)^\W*(((minimum|basic|required|preferred|desired|key|essential|your|job|additional)\s+)*(qualifications?|requirements?|skills?(\s*(and|&)\s*(abilities|experience|knowledge))?|experience(\s*(and|&)\s*(skills|qualifications))?|education(\s*(and|&)\s*experience)?|must[- ]haves?)|what you.ll need|what you need|what we.re looking for|what you bring|who you are|about you|you have|you.ll have|you should have|you are)\W*$")
HEAD_JOB = re.compile(r"(?i)^\W*(((job|position|role|the|your|key|main|primary|essential)\s+)*(responsibilit\w*|duties|description|overview|summary|functions|role|position)|what you.ll do|what you will do|about the (role|job|position)|day[- ]to[- ]day)\W*$")
HEAD_DROP = re.compile(r"(?i)^\W*(about\b.{0,50}|who we are|our (mission|story|values|company|benefits|culture|commitment)\b.{0,30}|why (join|work)\b.{0,40}|what we offer|(employee )?benefits(\s*(and|&)\s*perks)?|perks|compensation|pay|salary|equal (employment )?opportunity.{0,30}|eeo|diversity.{0,30}|accommodations?|disclaimer|legal|notice|to apply|how to apply|application.{0,20}|public service.{0,30}|residency.{0,20}|additional information|work location|hours)\W*$")
BOILER = re.compile(r"(?i)equal (employment )?opportunity|regardless of (race|age|sex)|sexual orientation|reasonable accommodation|e-?verify|background check|drug[- ]?(free|test)|privacy (policy|notice)|cookies?\b")


def split_parts(text):
    """(required, rest): the qualifications lines, and the rest of the job. About-us, benefits and legal text go in neither."""
    req, rest, state = [], [], "rest"
    for line in text.split("\n"):
        s = line.strip(" -•*\t")
        if not s:
            continue
        if len(s) <= 70 and not re.search(r"[.!?]$", s) and len(s.split()) <= 9:
            if HEAD_JOB.search(s):
                state = "rest"
                continue
            if HEAD_REQ.search(s):
                state = "req"
                continue
            if HEAD_DROP.search(s):
                state = "drop"
                continue
        if BOILER.search(s) or state == "drop":
            continue
        (req if state == "req" else rest).append(line)
    return "\n".join(req), "\n".join(rest)


TITLE_SKIP = {"and", "the", "for", "with", "part", "full", "time", "seasonal", "temporary", "associate", "level", "staff", "team", "member", "new", "york", "city"}


OTHER_JOBS = re.compile(r"(?i)\b(other jobs you might|open jobs from|similar jobs|more jobs from|related jobs|you may also like|recommended jobs|jobs you might like|more jobs at|other openings)\b")


def is_reliable(job, text, how):
    """Is this text really the job's own posting? An empty reason means yes."""
    if re.search(r"(?i)just a moment|verify you are human|enable javascript|captcha|access denied", text[:600]):
        return "a bot check is in the way"
    if len(text) < 200:
        return "the page shows it only in a browser"
    if how in ("page", "browser", "pdf", "page part"):
        words = [w for w in re.findall(r"[a-z]{3,}", job["title"].lower()) if w not in TITLE_SKIP]
        low = text.lower()
        if words and sum(w in low for w in words) / len(words) < 0.6:
            return "the link goes to a general jobs page"
        if how in ("page", "browser") and (len(text) < 500 or not re.search(r"(?i)respons|qualif|experience|duties|requir|skills", text)):
            return "the page has no job details"
        if len(text) > 60000:
            return "the page is too long to be one job"
    return ""


def read_one(job, browser=True):
    """Reads one job's posting. Returns the record saved to data/postings/<id>.json."""
    rec = first_try(job)
    if browser and not rec["reliable"] and not rec["gone"]:
        got = read_rendered(job, rec)
        if got:
            return from_text(job, new_record(job), got)
    return rec


def new_record(job):
    return {"id": job["id"], "url": job["url"], "read": dt.date.today().isoformat(), "how": "", "reliable": False, "problem": "", "gone": "", "text": "", "required": "", "rest": "", "facts": {}}


def first_try(job):
    rec = new_record(job)
    try:
        got = read_board(job["url"])
    except Gone as e:
        rec["gone"] = str(e)
        return save(rec)
    except Unread as e:
        rec["problem"] = str(e)
        return save(rec)
    except Exception as e:                                          # one strange page shouldn't stop the rest
        rec["problem"] = "couldn't make sense of the page (%s)" % type(e).__name__
        return save(rec)
    return from_text(job, rec, got)


def from_text(job, rec, got):
    text = re.sub(r"\n{2,}", "\n", (got["text"] or "").strip())
    cut = OTHER_JOBS.search(text)
    if cut and got["how"] in ("page", "browser"):
        text = text[:cut.start()].strip()
    text = text[:MAX_TEXT]
    rec["how"], rec["text"] = got["how"], text
    if len(text) < 6000 and CLOSED_RE.search(text):
        rec["gone"] = "the page says it's closed"
        return save(rec)
    rec["problem"] = is_reliable(job, text, got["how"])
    rec["reliable"] = not rec["problem"]
    if not rec["reliable"]:
        return save(rec)
    rec["required"], rec["rest"] = (got["required"], got.get("job_part", "")) if got.get("required") else split_parts(text)
    title = job["title"]
    degree = next((w for w, rx in DEGREE_RE if re.search(rx, rec["required"] or text)), "")
    rec["facts"] = {k: v for k, v in {
        "pay": got.get("pay") or pay_in(text, job.get("location", "")),
        "hours": got.get("hours") or hours_in(title, text),
        "hours_sure": bool(got.get("hours") or any(re.search(rx, title) for _, rx in HOURS_TEXT)),
        "closes": got.get("closes") or "",
        "years": years_in(rec["required"]) if years_in(rec["required"]) is not None else years_in(text, strict=True),
        "degree": degree,
        "licenses": [w for w, rx in LICENSE_RE if re.search(rx, text)],
        "certs": sorted(set(CERT_RE.findall(rec["required"] or text)))[:4],
        "letter": asks_for_letter(text),
        "internal": bool(got.get("internal") or INTERNAL_RE.search(text)),
        "sales": bool(SALES_RE.search(text)),
        "clearance": bool(CLEARANCE_RE.search(text)),
    }.items() if v not in (None, "", [], False)}
    return save(rec)


LETTER_ASK = re.compile(r"(?i)(submit|include|send|attach|email|upload|provide|with|without)\b[^.\n]{0,60}\b(cover letter|letter of (interest|intent))|\b(cover letter|letter of (interest|intent))\s*(\(required\)|is required|required|describing|demonstrating|outlining|indicating|explaining)")
LETTER_NOT = re.compile(r"(?i)55-a|optional documents?[^.]{0,60}cover letter|cover letter[^.]{0,20}optional|(no|don.t need a) cover letter|in your cover letter or")


def asks_for_letter(text):
    for m in LETTER_ASK.finditer(text):
        around = text[max(0, m.start() - 90): m.end() + 30]
        if not LETTER_NOT.search(around):
            return True
    return False


def path_of(job_id):
    if not re.fullmatch(r"[\w.-]+", job_id or ""):
        raise ValueError("bad job id")
    return os.path.join(FOLDER, job_id + ".json")


def save(rec):
    os.makedirs(FOLDER, exist_ok=True)
    tmp = path_of(rec["id"]) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(rec, f, ensure_ascii=False)
    os.replace(tmp, path_of(rec["id"]))
    return rec


def load(job_id):
    try:
        with open(path_of(job_id), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


# ---------------- correcting the job
MISS_RE = re.compile(r"\s*Doesn't meet your rules:[^.]*\.")


def floor_pay():
    """Their lowest pay from the interview, yearly (same reading as tracker/app.js)."""
    m = re.search(r"\d+(\.\d+)?", str((person.load().get("prefs") or {}).get("payFloor") or "").replace(",", ""))
    if not m:
        return 41600
    v = float(m.group())
    return v * 2080 if v < 300 else v * 1000 if v < 1000 else v


def asks_line(f):
    bits = []
    if f.get("years"):
        bits.append("%d+ years' experience" % f["years"])
    if f.get("degree"):
        bits.append(f["degree"])
    bits += f.get("licenses", []) + f.get("certs", [])
    return "Asks for " + ", ".join(bits) + "." if bits else ""


def fit_for_years(y):
    return 5 if y <= 1 else 4 if y == 2 else 3 if y == 3 else 2 if y <= 5 else 1


def correct(job, rec, changes):
    """Applies what the posting states to one job. Only facts the posting says outright; `why` stays as written."""
    if rec.get("gone"):
        if job["status"] in OPEN:
            job["status"] = "closed"
            job["notes"] = ("Closed: %s (checked %s). " % (rec["gone"], rec["read"]) + (job.get("notes") or "")).strip()
            changes["closed"].append(job["id"])
        job["posting"] = "gone"
        return
    if not rec.get("reliable"):
        job["posting"] = "unread"
        return
    job["posting"] = "read"
    f = rec.get("facts", {})
    p = f.get("pay")
    if p and p["salary_min"] != job.get("salary_min") and format(p["salary_min"], ",") not in (job.get("pay") or ""):
        changes["pay"].append([job["id"], job.get("pay"), p["pay"]])
        job["pay"], job["salary_min"] = p["pay"], p["salary_min"]
    if f.get("hours") and f["hours"] != job.get("hours") and (f.get("hours_sure") or not job.get("hours")):
        changes["hours"].append([job["id"], job.get("hours"), f["hours"]])
        job["hours"] = f["hours"]
    if f.get("closes") and f["closes"] != job.get("closes"):
        changes["closes"].append([job["id"], job.get("closes"), f["closes"]])
        job["closes"] = f["closes"]
    if f.get("letter") and not job.get("cover_letter"):
        job["cover_letter"] = True
        changes["letter"].append(job["id"])
    y = f.get("years")
    if y is not None:
        was, new = job.get("match"), fit_for_years(y)
        if new > (was or 3):
            new = max(was or 3, min(new, 4))
        lower_only = not (job.get("source") or "").startswith("big scan")     # hand-rated jobs only come down, and only by two or more
        if was != new and (not lower_only or (was or 3) - new >= 2):
            job["match"] = new
            job["fit"] = "now" if new >= 4 else ("stretch" if job.get("fit") == "now" else job.get("fit"))
            job["tag"] = {"now": "APPLY NOW", "stretch": "STRETCH"}.get(job["fit"], job.get("tag"))
            changes["fit"].append([job["id"], was, new, y])
    asks = asks_line(f)
    if asks:
        job["asks"] = asks
    misses = []
    if job.get("hours") == "part-time":
        misses.append("part-time")
    if job.get("salary_min") and job["salary_min"] < floor_pay():
        misses.append("under $%d/hr" % round(floor_pay() / 2080))
    if y and y >= 4:
        misses.append("asks for %d+ years" % y)
    if f.get("sales"):
        misses.append("mentions sales targets")
        changes["sales"].append(job["id"])
    if f.get("clearance"):
        misses.append("asks for a security clearance")
    if f.get("internal"):
        misses.append("the posting says you must already hold this civil service title or be on its exam list")
        changes["internal"].append(job["id"])
        if job.get("fit") != "exam":
            job["fit"], job["tag"] = "exam", "EXAM FIRST"
        job["match"] = 1
        if job["status"] in ("inbox", "queued"):
            job["status"] = "later"
    notes = MISS_RE.sub("", job.get("notes") or "").strip()
    job["notes"] = (("Doesn't meet your rules: " + ", ".join(misses) + ". ") if misses else "") + notes


def correct_all(ids):
    changes = {"closed": [], "pay": [], "hours": [], "closes": [], "letter": [], "fit": [], "sales": [], "internal": []}
    def go(doc):
        for j in doc["jobs"]:
            if j["id"] in ids:
                rec = load(j["id"])
                if rec:
                    correct(j, rec, changes)
    store.change(go)
    return changes


def read_jobs(jobs, workers=10):
    done = 0
    with cf.ThreadPoolExecutor(workers) as ex:
        for _ in ex.map(lambda j: read_one(j, browser=False), jobs):
            done += 1
            if done % 50 == 0:
                print("  read %d of %d" % (done, len(jobs)), flush=True)
    empty = [j for j in jobs if not (load(j["id"]) or {}).get("reliable") and not (load(j["id"]) or {}).get("gone") and not any(x in j["url"] for x in getattr(BOARDS, "NEVER_BROWSER", ()))]
    if empty and browser_path():
        print("  %d more need a browser" % len(empty), flush=True)
        for j in empty:
            got = read_rendered(j, load(j["id"]))
            if got:
                from_text(j, new_record(j), got)


def main(argv):
    doc = store.load()
    if "--unread" in argv:                                          # the ones a browser might help with
        jobs = [j for j in doc["jobs"] if j["status"] in OPEN and j.get("fit") != "watch" and not (load(j["id"]) or {}).get("reliable") and not (load(j["id"]) or {}).get("gone")]
    elif "--id" in argv:
        jobs = [store.find_job(doc, argv[argv.index("--id") + 1])]
    else:
        jobs = [j for j in doc["jobs"] if j["status"] in OPEN and j.get("fit") != "watch" and ("--again" in argv or not load(j["id"]))]
    print("reading %d postings" % len(jobs), flush=True)
    read_jobs(jobs)
    changes = correct_all({j["id"] for j in jobs})
    recs = [load(j["id"]) for j in jobs]
    unread = [r for r in recs if not r["reliable"] and not r["gone"]]
    print("read %d, gone %d, couldn't read %d" % (sum(r["reliable"] for r in recs), sum(bool(r["gone"]) for r in recs), len(unread)))
    print("changed: " + ", ".join("%s %d" % (k, len(v)) for k, v in changes.items()))
    for r in unread:
        print("  couldn't read %s: %s" % (r["id"], r["problem"]))
    with open(os.path.join(person.DATA, "postings-report.json"), "w", encoding="utf-8") as f:
        json.dump({"changes": changes, "unread": [[r["id"], r["problem"], r["url"]] for r in unread]}, f, indent=1)


if __name__ == "__main__":
    main(sys.argv[1:])
