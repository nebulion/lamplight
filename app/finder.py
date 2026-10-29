"""Finding jobs without a scheduled task (docs/SHARE-DESIGN.md phases 4 and 5a). Nothing here calls Claude or a job site.

find_prompt()         a prompt for any Claude chat (the free plan too): their scan's search and tiers, the jobs already in the
                      tracker to skip, the alert jobs to check first, and the exact answer format
import_jobs(reply)    Claude's answer, checked job by job, into the tracker (alert jobs it checked are filled in, not doubled)
import_alerts(html)   a pasted job-alert email (LinkedIn, Indeed, USAJobs, governmentjobs.com): its job links become
                      unchecked Inbox jobs. Their own hard no's filter them by fixed rules; Claude checks the rest next time.
"""
import html as htmlmod
import json
import os
import re
from html.parser import HTMLParser

import person
import store

BATCH = 12
SITES = [  # (name, link pattern, the plain link it becomes)
    ("LinkedIn", re.compile(r"https?://(?:[a-z]+\.)?linkedin\.com/(?:comm/)?jobs/view/(\d+)"), "https://www.linkedin.com/jobs/view/{0}"),
    ("Indeed", re.compile(r"https?://(?:[a-z]+\.)?indeed\.com/[^\"'\s<>]*?[?&]jk=([0-9a-f]{8,})"), "https://www.indeed.com/viewjob?jk={0}"),
    ("USAJobs", re.compile(r"https?://(?:www\.)?usajobs\.gov/(?:job|GetJob/ViewDetails)/(\d+)"), "https://www.usajobs.gov/job/{0}"),
    ("governmentjobs.com", re.compile(r"https?://(?:www\.)?governmentjobs\.com/careers/([a-z0-9_-]+)/jobs/(\d+)", re.I), "https://www.governmentjobs.com/careers/{0}/jobs/{1}"),
]
UNCHECKED = "From a job-alert email; Claude hasn't checked it yet."


def _scan_text():
    for p in (os.path.join(person.DATA, "SCAN.md"), os.path.join(person.ROOT, "SCAN.md")):
        if os.path.isfile(p):
            with open(p, encoding="utf-8") as f:
                return f.read()
    raise ValueError("there are no search instructions yet: do the job interview (What I'm looking for) first")


def _section(text, start, end):
    i = text.find(start)
    if i < 0:
        return ""
    j = text.find(end, i)
    return text[i: j if j > 0 else len(text)].strip()


def find_prompt():
    scan, doc = _scan_text(), store.load()
    rules = _section(scan, "## 3.", "## 7.") or scan[:12000]
    known = [j["url"] for j in doc["jobs"] if j.get("url")][-200:]
    alerts = [j for j in doc["jobs"] if j.get("why") == UNCHECKED and j.get("status") == "inbox"][:BATCH]
    check = ("\n\nFIRST, CHECK THESE POSTINGS from my job alerts (open each; include it only if it passes my rules, with the same url):\n"
             + "\n".join("- %s, %s: %s" % (j.get("title", ""), j.get("employer", ""), j["url"]) for j in alerts)) if alerts else ""
    return ("Find me up to %d real, open job postings that fit the rules below. Search the web for current postings (posted in the last "
            "few weeks), open each one, and only include jobs whose posting you actually read. Never apply, sign in or fill in forms.\n\n"
            "MY RULES\n%s%s\n\nSKIP these, they're already in my tracker:\n%s\n\n"
            "ANSWER with a JSON list between a line saying BEGIN JOBS and a line saying END JOBS, nothing else. Each job:\n"
            '{"title": "", "employer": "", "url": "the posting itself", "location": "City, ST", "want": "ideal | good | fallback", '
            '"match": 2-5, "fit": "now | stretch", "pay": "as listed or empty", "salary_min": yearly number or null, '
            '"closes": "YYYY-MM-DD or empty", "cover_letter": true or false, "why": "2-3 sentences matching posting requirements to my facts", '
            '"notes": "one line"}'
            % (BATCH, rules, check, "\n".join(known) or "(none yet)"))


def _json_list(reply):
    m = re.search(r"BEGIN JOBS\s*(.*?)\s*END JOBS", reply, re.S)
    raw = m.group(1) if m else reply[reply.find("["): reply.rfind("]") + 1]
    raw = re.sub(r"^```(?:json)?|```$", "", raw.strip()).strip()
    try:
        data = json.loads(raw)
    except ValueError:
        raise ValueError("couldn't find the list of jobs in that reply: paste Claude's whole answer")
    if not isinstance(data, list):
        raise ValueError("expected a list of jobs")
    return data


def _s(v, n=300):
    return re.sub(r"\s+", " ", v).strip()[:n] if isinstance(v, str) else ""


def import_jobs(reply):
    items = _json_list(reply if isinstance(reply, str) else "")
    report = {"added": 0, "updated": 0, "dropped": []}

    def apply(doc):
        by_url = {store.norm_url(j.get("url")): j for j in doc["jobs"] if j.get("url")}
        for it in items[:40]:
            if not isinstance(it, dict):
                continue
            title, employer, url, loc = _s(it.get("title"), 160), _s(it.get("employer"), 160), _s(it.get("url"), 600), _s(it.get("location"), 120)
            why = lambda r: report["dropped"].append({"title": title or "(no title)", "reason": r})
            if not (title and employer and loc and re.match(r"^https?://", url)):
                why("missing title, employer, location or link"); continue
            want = it.get("want") if it.get("want") in store.WANTS else None
            match = it.get("match") if isinstance(it.get("match"), int) and 1 <= it["match"] <= 5 else 3
            fit = "stretch" if it.get("fit") == "stretch" else "now"
            job = {"title": title, "employer": employer, "url": url, "location": loc, "want": want, "match": match, "fit": fit,
                   "pay": _s(it.get("pay"), 80), "why": _s(it.get("why"), 900), "notes": _s(it.get("notes"), 300),
                   "status": "queued" if match >= 4 and fit == "now" else "inbox", "source": "paste"}
            if isinstance(it.get("salary_min"), (int, float)) and it["salary_min"] > 0:
                job["salary_min"] = int(it["salary_min"])
            if re.match(r"^\d{4}-\d{2}-\d{2}$", it.get("closes") or ""):
                job["closes"] = it["closes"]
            if it.get("cover_letter") is True:
                job["cover_letter"] = True
            job = {k: v for k, v in job.items() if v not in (None, "")}
            old = by_url.get(store.norm_url(url))
            if old and old.get("why") == UNCHECKED:          # an alert job Claude has now checked: fill it in
                store.patch_job(doc, old["id"], {k: v for k, v in job.items() if k not in ("url", "source")})
                report["updated"] += 1
            elif old:
                why("already in your tracker")
            else:
                store.add_job(doc, job); report["added"] += 1
    store.change(apply)
    return report


class _Links(HTMLParser):
    """Each link in the email with its text, and the text that follows it (company and place, in most alert emails)."""
    def __init__(self):
        super().__init__(); self.links, self._a, self._after = [], None, []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._a = {"href": dict(attrs).get("href") or "", "text": "", "after": []}
            self.links.append(self._a)

    def handle_endtag(self, tag):
        if tag == "a":
            self._a = None

    def handle_data(self, data):
        t = data.strip()
        if not t:
            return
        if self._a is not None:
            self._a["text"] += " " + t
        elif self.links and len(self.links[-1]["after"]) < 4:
            self.links[-1]["after"].append(t)


def import_alerts(html):
    html = html if isinstance(html, str) else ""
    p = _Links(); p.feed(html)
    prefs = person.load().get("prefs") or {}
    nowords = [w.strip().lower() for w in re.split(r"[,;]", prefs.get("noWords", "")) if w.strip()]
    found = {}
    for a in p.links:
        href = htmlmod.unescape(a["href"])
        for site, pat, plain in SITES:
            m = pat.search(href)
            if not m:
                continue
            url = plain.format(*m.groups())
            title = _s(a["text"], 160)
            if len(title) < 4 or re.match(r"(?i)^(view|apply|see|more|save)\b", title):
                title = found.get(url, {}).get("title", "")
            rest = [x for x in a["after"] if not re.match(r"(?i)^(view|apply|new|actively|promoted|easy apply|\d+ (applicants|connections))", x)]
            prev = found.get(url, {})
            found[url] = {"site": site, "title": title or prev.get("title", ""), "employer": prev.get("employer") or (rest[0] if rest else ""),
                          "location": prev.get("location") or (rest[1] if len(rest) > 1 else "")}
            break
    report = {"found": len(found), "added": 0, "known": 0, "skipped": []}

    def apply(doc):
        for url, j in found.items():
            if any(w in (j["title"] or "").lower() for w in nowords):
                report["skipped"].append({"title": j["title"], "reason": "a title word you said means no"}); continue
            rec = {"title": j["title"] or "(title in the posting)", "employer": _s(j["employer"], 160) or "(see posting)", "url": url,
                   "location": _s(j["location"], 120), "status": "inbox", "source": j["site"] + " alert", "why": UNCHECKED}
            if store.add_job(doc, rec):
                report["added"] += 1
            else:
                report["known"] += 1
    store.change(apply)
    return report
