(function () {
"use strict";

var PAGES = ["today", "jobs", "resume", "letter", "kit", "skills", "character", "setup", "interview"];
var PATH_PAGES = [];   // [id, label] of the person's own Career paths pages (data/paths.html), added by loadPaths()
var FIT = { 5: "Meets every requirement", 4: "Meets it with “or equivalent”", 3: "One gap", 2: "Several gaps", 1: "Later in the plan" };
var FIT_SHORT = { 5: "Meets all", 4: "Or equivalent", 3: "One gap", 2: "Several gaps", 1: "Later" };
var FIT_RANK = { now: 0, stretch: 1, exam: 2, later: 3, watch: 4 };
var TAG_CLASS = { now: "now", stretch: "stretch", exam: "stretch", later: "later", watch: "later" };
var VOTE_LABEL = { application: "Application", agency: "Recruiter or agency", followup: "Follow-up or networking" };
var REPLY = { "": "No reply yet", no_reply: "Silence", response: "Replied", interview: "Interview", offer: "Offer", rejected: "Said no", withdrew: "I withdrew" };

var D = null, lastVotes = null, TRADEOFF = "", PAY = { floor: 41600, good: 62400 };   // PAY: their floor and comfortable pay, yearly (interview)   // TRADEOFF: their interview answer (ideal stretch first, or sure things first)
var SPEED = { fast: "Usually hires within weeks.", medium: "Usually hires in one to two months.", slow: "Civil service: often takes months." };
var WANT_BAR = { ideal: 5, great: 4, good: 3, okay: 2, fallback: 1 }, HIRES_BAR = { fast: 5, medium: 3, slow: 1 };
function thenBest(a, b) { return (nextScore(b) - nextScore(a)) || byDeadline(a, b); }
function closesKey(j) { return j.closes && days(j.closes) >= 0 ? j.closes : "9999"; }   // no date, or a passed one, goes last
/* The five bars first, named like the bars (2026-11-03, he asked). A job with no value for a bar goes last; ties go to best next. */
var SORTS = {
  next: { label: "Best next", fn: thenBest },
  want: { label: "Want", word: "highest", fn: function (a, b) { return ((WANT_BAR[b.want] || 0) - (WANT_BAR[a.want] || 0)) || thenBest(a, b); } },
  match: { label: "Fit", word: "highest", fn: function (a, b) { return ((b.match || 0) - (a.match || 0)) || thenBest(a, b); } },
  salary: { label: "Pay", word: "highest", fn: function (a, b) { return ((b.salary_min || 0) - (a.salary_min || 0)) || thenBest(a, b); } },
  speed: { label: "Hires", word: "fastest", fn: function (a, b) { return ((HIRES_BAR[b.speed] || 0) - (HIRES_BAR[a.speed] || 0)) || thenBest(a, b); } },
  deadline: { label: "Time left", word: "least", fn: function (a, b) { return cmp(closesKey(a), closesKey(b)) || thenBest(a, b); } },
  newest: { label: "Newest", fn: function (a, b) { return cmp(b.added, a.added) || thenBest(a, b); } },
  employer: { label: "Employer", word: "A to Z", fn: function (a, b) { return (a.employer || "").localeCompare(b.employer || "") || thenBest(a, b); } }
};
var SORT_MENU = ["next", "-", "want", "match", "salary", "speed", "deadline", "-", "newest", "employer"];
var sortKey = store("sort-v2") || "next";      // v2: "best next" became the default (2026-10-27)
if (!SORTS[sortKey]) sortKey = "next";

/* ---------------- small helpers ---------------- */
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : "#"; }
function cmp(a, b) { a = a || ""; b = b || ""; return a < b ? -1 : a > b ? 1 : 0; }
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function today() { return iso(new Date()); }
function addDays(s, n) { var d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); }
function days(s) { return Math.round((new Date(s + "T12:00:00") - new Date(today() + "T12:00:00")) / 864e5); }
function dm(s) { return new Date(s + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
function byDeadline(a, b) { return cmp(a.closes || "9999", b.closes || "9999") || ((FIT_RANK[a.fit] || 0) - (FIT_RANK[b.fit] || 0)) || ((b.match || 0) - (a.match || 0)); }
/* Best next: a score that weighs fit, how soon it closes, how fast they hire and whether it's a safe bet.
   The reason shown on each row is the biggest of those parts, in words. */
var SAFE = /hiring now|immediate|no experience|we train|will train|open interview|hiring event|hiring day|multiple openings|several openings|walk-?in/i;
function safeBet(j) { return SAFE.test((j.notes || "") + " " + (j.why || "") + " " + j.title); }
function nextScore(j) {
  var s = (j.match || 3) * 10, d = j.closes ? days(j.closes) : null;
  if (d !== null && d >= 0) s += Math.max(0, 14 - d) * 2.5;
  s += { fast: 12, medium: 5, slow: 0 }[j.speed] || 4;
  if (safeBet(j)) s += 8;
  s += { ideal: 25, great: 18, good: 10, okay: 0, fallback: -10 }[j.want] || 0;          // how much they want it (D42), set by their scan or changed from the right-click menu
  if (j.fit === "stretch") s -= TRADEOFF === "An ideal job I'm under-qualified for" && j.want === "ideal" ? 0 : 6;
  if (j.fit === "exam" || j.fit === "later" || j.fit === "watch") s -= 15;
  return s;
}
function reasonFor(j) {
  var d = j.closes ? days(j.closes) : null;
  if (d !== null && d >= 0 && d <= 7) return d === 0 ? "closes today" : d === 1 ? "closes tomorrow" : "closes in " + d + " days";
  if (safeBet(j)) return "hiring now";
  if (j.match === 5 && j.speed === "fast") return "meets all, hires fast";
  if (j.match === 5) return "meets every requirement";
  if (j.speed === "fast") return "hires within weeks";
  if (j.fit === "stretch") return "a stretch";
  return "";
}
function sorted(list) { return list.slice().sort(SORTS[sortKey].fn); }
function jobs(status) { return D.jobs.filter(function (j) { return j.status === status; }); }
function isOpen(j) { return ["inbox", "queued", "later"].indexOf(j.status) >= 0 && j.fit !== "watch"; }
function votesOn(day) { return D.votes.filter(function (v) { return v.date === day; }); }
function soon(j) { return j.closes && days(j.closes) <= 7 && days(j.closes) >= 0; }
function whenShort(j) { return j.closes ? dm(j.closes) : "open"; }
function whenLong(j) {
  if (!j.closes) return "No closing date";
  var n = days(j.closes);
  if (n < 0) return "Closing date passed (" + dm(j.closes) + ")";
  if (n === 0) return "Closes today";
  if (n === 1) return "Closes tomorrow";
  return "Closes in " + n + " days, " + dm(j.closes);
}
function emailOf() { return D.settings.email || ""; }   // one address; the per-job +tags were removed
// the posting asks for a cover letter: set by the scan (cover_letter), or said in the job's notes
function needsLetter(j) { return !!j.cover_letter || /cover letter/i.test((j.notes || "") + " " + (j.why || "")); }
function resumeFile(j) { if (j.resume_file) return versionOf(j.resume_file, j); var r = D.resumes[j.resume]; return r ? versionOf(r.file, j) : ""; }   // a custom one made for this job wins
/* Two addresses (2026-11-02, he chose): the one whose metro matches the job, otherwise the last; a link on Today switches it
   for that job. The other address's file has the same name without the first name. */
var ADDRS = [];
function addrIndex(j) {
  if (ADDRS.length < 2) return -1;
  var pick = store("addr:" + j.id); if (pick !== null && ADDRS[+pick]) return +pick;
  var m = metroOf(j); for (var i = 0; i < ADDRS.length; i++) if (ADDRS[i].metro === m) return i;
  return ADDRS.length - 1;
}
function versionOf(path, j) {
  var i = addrIndex(j); if (i < 0 || !ADDRS[i].drop_first) return path;
  return path.replace(/[^\/]*$/, function (b) { return b.replace(/^[^_]+_/, ""); });
}
/* The facts about a job as small five-step bars (2026-10-28, he asked: "on a slider... or on a bar, like a battery"):
   fit (how many requirements you meet), how much you want it, how fast they hire, pay against your floor and
   comfortable pay, and time left to apply. The words behind each bar are in its title (hover) and for screen readers. */
var WANT_WORD = { ideal: "Ideal", great: "Great", good: "Good", okay: "Okay", fallback: "Fallback" };
function meterRows(j) {
  var rows = [], d = j.closes ? days(j.closes) : null, y = j.salary_min || 0;
  if (j.match) rows.push(["Fit", j.match, FIT[j.match]]);
  if (j.want) rows.push(["Want", WANT_BAR[j.want], WANT_WORD[j.want]]);
  if (j.speed) rows.push(["Hires", { fast: 5, medium: 3, slow: 1 }[j.speed], SPEED[j.speed]]);
  if (y) rows.push(["Pay", y >= PAY.good * 1.15 ? 5 : y >= PAY.good ? 4 : y >= (PAY.floor + PAY.good) / 2 ? 3 : y >= PAY.floor ? 2 : 1,
    "About $" + Math.round(y / 1000) + "k a year (your floor $" + Math.round(PAY.floor / 1000) + "k, comfortable $" + Math.round(PAY.good / 1000) + "k)"]);
  if (d !== null && d >= 0) rows.push(["Left", d <= 2 ? 1 : d <= 7 ? 2 : d <= 14 ? 3 : d <= 30 ? 4 : 5, d === 0 ? "Closes today" : d === 1 ? "Closes tomorrow" : d + " days to apply", d <= 7]);
  return rows;
}
function meters(j, mini) {
  var rows = meterRows(j);
  if (!rows.length) return "";
  return '<span class="meters' + (mini ? " mini" : "") + '">' + rows.map(function (r) {
    var seg = ""; for (var i = 0; i < 5; i++) seg += '<i class="' + (i < r[1] ? "on" : "") + '"></i>';
    return '<span class="meter' + (r[3] ? " urgent" : "") + '" title="' + esc(r[0] + ": " + r[2]) + '" role="img" aria-label="' + esc(r[0] + ": " + r[2]) + '"><span class="m-l">' + r[0] + '</span><span class="m-b">' + seg + "</span></span>";
  }).join("") + "</span>";
}
function jobCell(j, link) {
  var role = link === false ? esc(j.title) : '<a href="' + esc(safeUrl(j.url)) + '" target="_blank" rel="noopener" data-act="open" data-id="' + esc(j.id) + '">' + esc(j.title) + "</a>";
  return '<span class="role">' + role + '</span><span class="sub">' + esc(j.employer) + (j.location ? ", " + esc(j.location) : "") + "</span>";
}

/* ---------------- server ---------------- */
function load() {
  return fetch("/api/data", { cache: "no-store" }).then(function (r) { return r.json(); })
    .then(function (d) { D = d; render(); })
    .catch(function () { showError("Can't reach the tracker. Double-click Apply on the desktop to start it."); });
}
function post(action, body) {
  return fetch("/api/" + action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
    .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "error"); return j; }); })
    .then(function (j) { if (j.data) { D = j.data; render(); } return j.result; })
    .catch(function (e) { showError("That didn't save: " + e.message); });
}
function showError(m) { var e = $("err"); e.textContent = m; e.hidden = false; }

/* ---------------- render ---------------- */
var midnightTimer = 0;
function scheduleMidnight() {                                // a new day: today's count (and the street's bulbs) go back to 0
  clearTimeout(midnightTimer);
  var now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  midnightTimer = setTimeout(function () { if (D) render(); }, Math.min(next - now, 2147483000));
}
function render() {
  $("err").hidden = true;
  var t = votesOn(today()).length, target = D.settings.daily_target || 5;
  $("n-today").textContent = t + "/" + target;
  $("j-new").hidden = !jobs("inbox").length;                    // the small square next to Jobs: the Inbox has something (his choice over "(New!)")
  $("n-jobs").textContent = D.jobs.filter(isOpen).length;
  var n = D.votes.length;
  window.Scene && Scene.setLit(n, lastVotes !== null && n > lastVotes);
  window.Scene && Scene.setToday && Scene.setToday(t, target);   // the street's foreground bulbs: one per application today
  scheduleMidnight();
  if (lastVotes !== null && n > lastVotes && window.Sound) Sound.sent(D.votes[n - 1].type);   // only for something you just logged
  lastVotes = n;
  renderToday(); renderInbox(); renderJobs(); renderPathBoards(); renderKitWhy();
}

/* Today: one job, then a short departure board */
function todayQueue() {
  var up = upIds(), q = up.map(jobById).concat(sorted(jobs("queued")).filter(function (j) { return up.indexOf(j.id) < 0; }));   // Up next, in his order, then the rest
  var skipped = (store("skipped:" + today()) || "").split(",");
  q.sort(function (a, b) { return (skipped.indexOf(a.id) >= 0) - (skipped.indexOf(b.id) >= 0); });
  var focus = store("focus");
  if (focus) { var i = q.findIndex(function (j) { return j.id === focus; }); if (i > 0) q.unshift(q.splice(i, 1)[0]); }
  return q;
}
function renderToday() {
  var s = D.settings, t = today(), sent = votesOn(t).length, target = s.daily_target || 5;
  $("t-date").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  $("t-status").textContent = sent >= target ? sent + " sent today. Done." : sent + " of " + target + " sent";
  var cue = s.cue || "Pick a time and place you'll apply.";
  var last = D.votes.length ? D.votes[D.votes.length - 1].date : null;
  if (sent === 0 && last && votesOn(addDays(t, -1)).length === 0 && last < addDays(t, -1)) cue += " Last one was " + dm(last) + ". One today and it's a blip.";
  $("t-cue").textContent = cue;
  renderBulbs(sent, target);

  var q = todayQueue(), j = q[0], box = $("t-now");
  box.removeAttribute("data-job");
  if (moment && performance.now() - moment.t0 < 25000) { renderMoment(box, j); $("t-next-wrap").hidden = true; return; }
  moment = null;
  if (!j) {
    box.innerHTML = '<h2>Nothing queued</h2><p class="why">' + (jobs("inbox").length ? jobs("inbox").length + ' new jobs are waiting in the <a href="#inbox">inbox</a>. Queue a few.' : 'The daily scan adds jobs every morning. You can also <a href="#inbox">add one yourself</a>.') + "</p>";
    $("t-next-wrap").hidden = true;
    return;
  }
  box.setAttribute("data-job", j.id);                           // right-click anywhere on it
  var done = sent >= target ? '<p class="done-line">That\'s today. If you want one more, it\'s this:</p>' : "";
  var f = resumeFile(j);
  box.innerHTML = done +
    '<p class="employer">' + esc(j.employer) + (j.location ? ", " + esc(j.location) : "") + "</p>" +
    "<h2>" + esc(j.title) + "</h2>" +
    '<p class="facts"><button type="button" class="datebtn" data-act="set-closes" data-id="' + esc(j.id) + '" title="Change the closing date"><span class="' + (soon(j) ? "soon" : "") + '">' + whenLong(j) + ".</span></button>" + (j.pay ? " Pays " + esc(j.pay) + "." : "") + "</p>" + meters(j) +
    (j.why ? '<p class="why">' + esc(j.why) + "</p>" : "") +
    (j.toward_planning ? '<p class="resume">Toward planning: ' + esc(j.toward_planning) + "</p>" : "") +
    '<div class="need"><p class="need-h">You\'ll need</p>' +
    (f ? '<p class="resume">Attach <b>' + esc(f.split("/").pop()) + '</b> <span class="small">(' + esc(j.resume_file ? "made for this job" : f.split("/")[0]) + (addrIndex(j) >= 0 ? ", " + esc(ADDRS[addrIndex(j)].location) : "") + ')</span> &nbsp;<button class="quiet" data-act="reveal" data-file="' + esc(f) + '">Show file</button> <a class="quiet" href="#resume/' + esc(j.id) + '">' + (j.resume_file ? "Adjust it" : "Make one for this job") + "</a>" + (autoState[j.id] === "busy" && !j.resume_file ? ' <span class="small">Making one for this job\u2026</span>' : "") +
      (addrIndex(j) >= 0 ? ' <button class="quiet" data-act="swap-addr" data-id="' + esc(j.id) + '">Use ' + esc(ADDRS[(addrIndex(j) + 1) % ADDRS.length].location) + "</button>" : "") + "</p>" : "") +
    (j.cover_file ? '<p class="resume">Attach <b>' + esc(versionOf(j.cover_file, j).split("/").pop()) + '</b> <span class="small">(made for this job)</span> &nbsp;<button class="quiet" data-act="reveal" data-file="' + esc(versionOf(j.cover_file, j)) + '">Show file</button> <a class="quiet" href="#letter/' + esc(j.id) + '">Adjust it</a></p>'
      : needsLetter(j) ? '<p class="resume">This one asks for a cover letter. <a class="quiet" href="#letter/' + esc(j.id) + '">' + (autoState[j.id] === "busy" ? "Making one\u2026" : "Write one") + "</a></p>" : "") +
    '<p class="resume">Apply with <b>' + esc(emailOf(j)) + '</b> &nbsp;<button class="quiet" data-act="copy-text" data-text="' + esc(emailOf(j)) + '">Copy</button> <button class="quiet" data-act="edit-email">Change address</button></p>' +
    '</div><div id="t-act"></div>';
  /* (2026-10-28, he asked for a smoother flow) Opening the posting no longer swaps the buttons for a question: they stay,
     the main one becomes "I sent it", and a line says when it was opened. Sending works whether or not it was opened here. */
  var act = $("t-act"), opened = +(store("opened:" + j.id) || 0), id = esc(j.id);
  var openBtn = function (main, label) { return '<a class="btn' + (main ? " primary" : "") + '" href="' + esc(safeUrl(j.url)) + '" target="_blank" rel="noopener" data-act="open" data-id="' + id + '">' + label + "</a>"; };
  var sentBtn = function (main) { return '<button class="btn' + (main ? " primary" : "") + '" data-act="sent" data-id="' + id + '">I sent it</button>'; };
  act.innerHTML = (opened ? '<p class="opened">Opened ' + ago(opened) + ". When you've submitted it, press <b>I sent it</b>.</p>" : "") +
    '<div class="actions">' + (opened ? sentBtn(true) + openBtn(false, "Open again") : openBtn(true, "Open posting") + sentBtn(false)) + '<button class="quiet" data-act="read-posting" data-id="' + id + '">Read it here</button></div>' +
    '<p class="notthis">Not this one: <button class="quiet" data-act="skip" data-id="' + id + '">skip for today</button> · ' +
    '<button class="quiet" data-act="later" data-id="' + id + '">later</button> · <button class="quiet" data-act="skip-for-good" data-id="' + id + '">not for me</button>' +
    '<span class="keys">Keys: O opens the posting, S marks it sent.</span></p>';
  var next = q.slice(1, 6);
  $("t-next-wrap").hidden = !next.length;
  $("t-next").innerHTML = '<thead><tr><th>Closes</th><th>Job</th><th class="fit">At a glance</th></tr></thead><tbody>' +
    next.map(function (n) {
      return '<tr class="pick' + (upIds().indexOf(n.id) >= 0 ? " un" : "") + '" data-act="focus" data-id="' + esc(n.id) + '"><td class="when' + (soon(n) ? " soon" : "") + '">' + whenShort(n) + "</td><td>" + jobCell(n, false) + '</td><td class="fit">' + meters(n, true) + "</td></tr>";
    }).join("") + "</tbody>";
  var rest = q.length - 1 - next.length;
  $("t-more").innerHTML = (rest > 0 ? rest + ' more in <a href="#jobs">Jobs</a>. ' : "") + (jobs("inbox").length ? jobs("inbox").length + ' new in the <a href="#inbox">inbox</a>.' : "");
  autoDocs(j);
}
/* The job on Today gets its own resume from its posting without being asked, and a letter if the posting asks for one
   (2026-11-03, his choice). One at a time, once per job per visit; if anything fails the premade resume stays. */
var autoState = {}, autoChain = Promise.resolve();
function postingFor(id) {
  return fetch("/api/posting?id=" + encodeURIComponent(id), { cache: "no-store" }).then(function (r) { return r.json(); })
    .then(function (p) { return p.missing ? post("posting_read", { id: id }) : p; })
    .catch(function () { return null; });
}
function showPosting(id) {
  var j = jobById(id); if (!j) return;
  closeMenu();
  postingFor(id).then(function (p) {
    var ok = p && p.reliable, m = document.createElement("div");
    m.className = "rb-modal postview"; m.setAttribute("role", "dialog"); m.setAttribute("aria-label", "The saved posting");
    m.innerHTML = '<div class="pv-sheet" tabindex="-1"><div class="pv-bar"><div class="pv-head"><b>' + esc(j.title) + "</b><span>" + esc(j.employer) + (j.location ? ", " + esc(j.location) : "") + '</span></div><button class="btn" type="button" data-pv="close">Close</button></div>' +
      (j.asks ? '<p class="pv-asks">' + esc(j.asks) + "</p>" : "") +
      (ok ? '<div class="pv-text">' + esc(p.text) + "</div>" : '<p class="pv-none">' + (p && p.gone ? "This posting is gone: " + esc(p.gone) + "." : "This posting couldn't be read" + (p && p.problem ? " (" + esc(p.problem) + ")" : "") + ".") + "</p>") +
      '<p class="small pv-foot">' + (ok ? "Saved " + dm(p.read) + ". " : "") + '<a href="' + esc(safeUrl(j.url)) + '" target="_blank" rel="noopener">Open it on their site</a></p></div>';
    var close = function () { m.remove(); document.body.classList.remove("modal-open"); document.removeEventListener("keydown", onKey); };
    var onKey = function (e) { if (e.key === "Escape") close(); };
    m.addEventListener("click", function (e) { if (e.target === m || e.target.getAttribute("data-pv") === "close") close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(m); document.body.classList.add("modal-open");
    m.querySelector("[data-pv]").focus();
  });
}
function autoDocs(j) {
  if (!j || $("today").hidden || autoState[j.id] || !window.ResumeBuilder || !window.LetterBuilder) return;
  if (j.resume_file && (j.cover_file || !needsLetter(j))) return;
  autoState[j.id] = "busy";
  var box = function () { var el = $("t-now"); return el && el.getAttribute("data-job") === j.id; };
  if (box()) renderToday();
  autoChain = autoChain.then(function () {
    return postingFor(j.id).then(function (p) {
      if (!p || !p.reliable) return null;
      var cur = jobById(j.id);
      return (cur && cur.resume_file ? Promise.resolve() : ResumeBuilder.autoMake(j.id, p)).then(function () {
        cur = jobById(j.id);
        return cur && !cur.cover_file && needsLetter(cur) ? LetterBuilder.autoMake(j.id, p) : null;
      });
    });
  }).catch(function () { return null; }).then(function () {
    autoState[j.id] = "done";
    if (box()) renderToday();
  });
}

function renderInbox() {                                     // the Inbox is a tab of Jobs; what's left here is the add form's list of resumes
  var sel = $("add-resume");
  if (!sel.options.length) Object.keys(D.resumes).forEach(function (k) { sel.add(new Option(D.resumes[k].label, k)); });
}

function stateCell(j) {
  if (j.status === "applied") return '<span class="state sent">Sent ' + (j.applied_date ? dm(j.applied_date) : "") + "</span>";
  if (j.status === "queued") return '<span class="state">Queued</span>';
  if (j.status === "inbox") return '<span class="state">Inbox</span> <button class="quiet" data-act="queue" data-id="' + esc(j.id) + '">queue</button>';
  if (j.status === "skipped" || j.status === "closed") return '<span class="state">' + (j.status === "closed" ? "Closed" : "Skipped") + "</span>";
  if (j.fit === "watch") return '<span class="state">Board to check</span>';
  return '<span class="state">Later</span> <button class="quiet" data-act="queue" data-id="' + esc(j.id) + '">queue</button>';
}

/* ---------------- Jobs: queue, later and sent in one list ----------------
   Two-line rows instead of columns; tabs for status; quick filters; select several for bulk changes;
   keyboard shortcuts; and a right-click menu with everything you can do to a job (2026-10-27). */
var TABS = [["all", "All open"], ["inbox", "Inbox"], ["queued", "Queued"], ["later", "Later"], ["sent", "Sent"]];
var STATUS_WORD = { inbox: "new", queued: "queued", later: "later", skipped: "skipped", closed: "closed", applied: "sent" };
var jTab = store("jobs-tab") || "all";
var picked = {}, cursor = null, anchorId = null, shown = [], openRows = {}, pendingJump = null;
if (jTab === "up") jTab = "queued";                            // Up next is the top of Queued now
if (!TABS.some(function (t) { return t[0] === jTab; })) jTab = "all";

/* Up next (2026-11-02, he chose it): the top of the queue, in his own order, that Today takes from first (its own tab until
   2026-11-03, when he said it belongs in the queue). It lives in settings as ids; a job only counts while it's queued, so
   sending or moving one takes it off by itself. */
function upIds() { return (D.settings.up_next || []).filter(function (id) { var j = jobById(id); return j && j.status === "queued"; }); }
function saveUp(ids) { return post("settings", { patch: { up_next: ids } }); }
function addUp(ids) {
  var needQueue = ids.filter(function (id) { var j = jobById(id); return j && j.status !== "queued"; }), up = upIds();
  var add = ids.filter(function (id) { return up.indexOf(id) < 0; });
  (needQueue.length ? post("patch_jobs", { ids: needQueue, patch: { status: "queued" } }) : Promise.resolve()).then(function () {
    return saveUp(upIds().concat(add));
  }).then(function () { toast((ids.length === 1 ? (jobById(ids[0]) || {}).title : ids.length + " jobs") + ": on Up next."); });
}
function removeUp(ids) { saveUp(upIds().filter(function (id) { return ids.indexOf(id) < 0; })); }
function moveUp(id, by) {
  var u = upIds(), i = u.indexOf(id), to = Math.max(0, Math.min(u.length - 1, i + by)); if (i < 0 || i === to) return;
  u.splice(to, 0, u.splice(i, 1)[0]); saveUp(u);
}

/* The filters (2026-11-02, he asked: Metro area, Deadline, Job type and Hours, instead of every choice showing). Each is a
   drop-down with tick boxes. Choices in one filter widen the list (NYC or Chicago); different filters narrow it. */
var METROS = [["NYC area", /new york|nyc|brooklyn|queens|bronx|manhattan|staten island|jersey city|hoboken|long island|newark|westchester|yonkers|white plains|rye, ny/i],
  ["Chicago area", /chicago|evanston|oak park|cook county/i], ["Boston", /boston|cambridge, ma|somerville|charlestown|brookline/i], ["Philadelphia", /philadelphia/i],
  ["Washington DC", /washington,? d|\bd\.?c\b|arlington, va/i], ["San Francisco Bay", /san francisco|oakland|berkeley|emeryville|san jose/i], ["Seattle", /seattle/i], ["Portland", /portland/i],
  ["Denver", /denver|boulder|aurora, co/i], ["Salt Lake City", /salt lake|park city|ogden|provo/i], ["Twin Cities", /twin cities|minneapolis|st\.? paul/i], ["Pittsburgh", /pittsburgh/i], ["Remote", /remote/i]];
function metroOf(j) { var l = j.location || ""; for (var i = 0; i < METROS.length; i++) if (METROS[i][1].test(l)) return METROS[i][0]; return "Other cities"; }
var JOB_TYPES = [["it", "IT & network", ["it"]], ["gis", "GIS & planning", ["gis"]], ["transit", "Rail, fare & bus", ["rail", "fare", "tolling"]], ["signals", "Signals & traffic", ["signals"]],
  ["water", "Water", ["water"]], ["permits", "Permits & inspections", ["permits"]], ["public", "Cities with the public", ["public", "access"]], ["resort", "Resort & vendor tech", ["resort"]],
  ["bikes", "Bikes", ["bikes"]], ["outdoors", "Outdoors & trail crews", ["outdoors"]], ["hostels", "Hostels & gathering places", ["hostels"]], ["cinemas", "Cinemas & small stages", ["cinemas"]],
  ["everyday", "Everyday", ["everyday"]], ["other", "Other", ["other"]]];
function hoursOf(j) {
  if (j.hours) return j.hours;
  var t = j.title + " " + (j.notes || "") + " " + (j.pay || "");
  if (/full[- ]?time/i.test(t)) return "full-time";
  if (/part[- ]?time/i.test(t)) return "part-time";
  if (/seasonal|holiday/i.test(t)) return "seasonal";
  if (/temporary|\btemp\b|per diem|grant-funded/i.test(t)) return "temporary";
  return "full-time";
}
var FILTERS = {
  metro: { label: "Metro area", options: function () { var seen = {}; D.jobs.forEach(function (j) { seen[metroOf(j)] = 1; }); return METROS.map(function (m) { return m[0]; }).concat(["Other cities"]).filter(function (m) { return seen[m]; }).map(function (m) { return [m, m]; }); },
    pass: function (j, v) { return metroOf(j) === v; } },
  deadline: { label: "Deadline", options: function () { return [["week", "This week"], ["two", "Next 2 weeks"], ["month", "This month"], ["none", "No closing date"]]; },
    pass: function (j, v) { if (v === "none") return !j.closes; if (!j.closes) return false; var d = days(j.closes); return d >= 0 && d <= { week: 7, two: 14, month: 31 }[v]; } },
  type: { label: "Job type", options: function () { return JOB_TYPES.filter(function (t) { return D.jobs.some(function (j) { return (j.paths || []).some(function (p) { return t[2].indexOf(p) >= 0; }); }); }).map(function (t) { return [t[0], t[1]]; }); },
    pass: function (j, v) { var t = JOB_TYPES.filter(function (x) { return x[0] === v; })[0]; return !!t && (j.paths || []).some(function (p) { return t[2].indexOf(p) >= 0; }); } },
  hours: { label: "Hours", options: function () { return [["full-time", "Full-time"], ["part-time", "Part-time"], ["seasonal", "Seasonal"], ["temporary", "Temporary"]]; },
    pass: function (j, v) { return hoursOf(j) === v; } },
  more: { label: "More", options: function () { return [["easy", "Easy wins"], ["gone", "Show skipped & closed"]]; },
    pass: function (j, v) { return v === "gone" || safeBet(j) || (j.speed === "fast" && (j.match || 0) >= 4); } }
};
var jFilters = {};
try { jFilters = JSON.parse(store("jobs-filters") || "{}") || {}; } catch (e) { jFilters = {}; }
function picks(k) { return jFilters[k] || []; }
function saveFilters() { store("jobs-filters", JSON.stringify(jFilters)); }
function filtersFor() { return jTab === "sent" ? ["metro", "type", "hours"] : jTab === "all" ? ["metro", "deadline", "type", "hours", "more"] : ["metro", "deadline", "type", "hours"]; }
function filtersPass(j, skip) {
  return filtersFor().every(function (k) {
    if (k === skip) return true;
    var on = picks(k).filter(function (v) { return v !== "gone"; });
    return !on.length || on.some(function (v) { return FILTERS[k].pass(j, v); });
  });
}
function inTab(j) {
  if (jTab === "sent") return j.status === "applied";
  if (jTab === "queued") return j.status === "queued";
  if (jTab === "later") return j.status === "later";
  if (jTab === "inbox") return j.status === "inbox";
  if (picks("more").indexOf("gone") >= 0 && (j.status === "skipped" || j.status === "closed")) return true;
  return ["inbox", "queued", "later"].indexOf(j.status) >= 0;
}
var CARET = '<svg viewBox="0 0 10 6" width="9" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
function sortButton() {
  if (jTab === "sent") return "";                               // Sent is always newest first (he asked)
  return '<button type="button" class="orderby" data-sort aria-haspopup="menu">Order by: <b>' + esc(SORTS[sortKey].label) + "</b>" + CARET + "</button>";
}
function openSort(btn, once) {                                  // once: reorder Up next this one time; he can still drag afterwards
  closeMenu();
  var items = SORT_MENU.map(function (k) {
    if (k === "-") return { sep: true };
    var it = { label: SORTS[k].label, key: SORTS[k].word, run: function () {
      if (once) { saveUp(upIds().map(jobById).sort(SORTS[k].fn).map(function (j) { return j.id; })); return; }
      sortKey = k; store("sort-v2", sortKey); render();
    } };
    if (!once) it.checked = k === sortKey;
    return it;
  });
  var r = btn.getBoundingClientRect();
  menuEl = buildMenu(items, r.left, r.bottom + 4);
  var first = menuEl.querySelector("button"); if (first) first.focus();
}
function renderFilters() {
  $("j-filters").innerHTML = sortButton() + filtersFor().map(function (k) {
    var on = picks(k), opts = FILTERS[k].options(), names = on.map(function (v) { var o = opts.filter(function (x) { return x[0] === v; })[0]; return o ? o[1] : ""; }).filter(Boolean);
    return '<button type="button" data-filter="' + k + '" aria-haspopup="menu" class="' + (names.length ? "on" : "") + '">' + FILTERS[k].label + (names.length ? ": <b>" + esc(names.length > 2 ? names.length + " picked" : names.join(", ")) + "</b>" : "") + CARET + "</button>";
  }).join("") + (filtersFor().some(function (k) { return picks(k).length; }) ? '<button type="button" class="clear" data-filter-clear>Clear</button>' : "");
}
function openFilter(k, btn) {
  closeMenu();
  var items = FILTERS[k].options().map(function (o) {
    var n = D.jobs.filter(function (j) { return inTab(j) && filtersPass(j, k) && (o[0] === "gone" || FILTERS[k].pass(j, o[0])); }).length;
    return { label: o[1], key: String(n), checked: picks(k).indexOf(o[0]) >= 0, keep: true, run: function () {
      var on = picks(k).slice(), i = on.indexOf(o[0]);
      if (i >= 0) on.splice(i, 1); else on.push(o[0]);
      jFilters[k] = on; saveFilters(); renderJobs();
    } };
  });
  var r = btn.getBoundingClientRect();
  menuEl = buildMenu(items, r.left, r.bottom + 4);
  var first = menuEl.querySelector("button"); if (first) first.focus();
}
function searchPass(j) {
  var q = $("j-q").value.trim().toLowerCase();
  if (!q) return true;
  var hay = (j.employer + " " + j.title + " " + (j.location || "") + " " + (j.notes || "") + " " + (j.why || "") + " " + (j.pay || "")).toLowerCase();
  return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
}
function replySelect(j) {
  return '<select class="reply" data-outcome="' + esc(j.id) + '" aria-label="Heard back?">' + Object.keys(REPLY).map(function (k) {
    return '<option value="' + k + '"' + ((j.outcome || "") === k ? " selected" : "") + ">" + REPLY[k] + "</option>";
  }).join("") + "</select>";
}
function jobRow(j) {
  var d = j.closes ? days(j.closes) : null, right, isUp = upIds().indexOf(j.id) >= 0;
  if (jTab === "sent") right = "Sent " + (j.applied_date ? dm(j.applied_date) : "");
  else if (d === null) right = "No closing date";
  else if (d < 0) right = "Closed " + dm(j.closes);
  else right = '<span class="' + (soon(j) ? "soon" : "") + '">' + (d <= 7 ? (d === 0 ? "Closes today" : d === 1 ? "Closes tomorrow" : d + " days left") : "Closes " + dm(j.closes)) + "</span>";
  if (jTab !== "sent") right = '<button type="button" class="datebtn" data-act="set-closes" data-id="' + esc(j.id) + '" title="Change the closing date">' + right + "</button>";
  var bits = [esc(j.employer) + (j.location ? ", " + esc(j.location) : "")];
  if (jTab === "sent") {
    bits.push(replySelect(j));
    bits.push('<button class="quiet" data-act="edit-used" data-id="' + esc(j.id) + '">' + esc(j.email_used || "add the email you used") + "</button>");
  } else {
    if (j.pay) bits.push(esc(j.pay));
    var mt = meters(j, true); if (mt) bits.push(mt);
    if (jTab === "all" && j.status !== "queued") bits.push('<span class="st">' + STATUS_WORD[j.status] + "</span>");
    if (isUp && jTab !== "queued") bits.push('<span class="nx">up next</span>');
    if (needsLetter(j)) bits.push('<span class="st">' + (j.cover_file ? "letter made" : "asks for a cover letter") + "</span>");
    var why = sortKey === "next" && !mt ? reasonFor(j) : "";      // the bars already say it
    if (why) bits.push('<span class="nx">' + why + "</span>");
  }
  var canUp = ["inbox", "queued", "later"].indexOf(j.status) >= 0;
  var upBtn = !canUp ? "" : isUp ? (jTab === "queued" ? '<button class="quiet upbtn" data-act="up-remove" data-id="' + esc(j.id) + '">Take off</button>' : "") : '<button class="quiet upbtn" data-act="up-add" data-id="' + esc(j.id) + '">Up next</button>';
  var detail = "";
  if (openRows[j.id]) {
    detail = '<div class="l3">' + (j.why ? '<p class="why">' + esc(j.why) + "</p>" : "") +
      (j.toward_planning ? '<p class="note">Toward planning: ' + esc(j.toward_planning) + "</p>" : "") +
      (j.asks ? '<p class="note">' + esc(j.asks) + "</p>" : "") +
      (j.notes ? '<p class="note">' + esc(j.notes) + "</p>" : "") +
      '<p class="note"><button class="quiet" data-act="read-posting" data-id="' + esc(j.id) + '">Read the saved posting</button></p>' +
      (j.status === "inbox" ? '<div class="actions"><button class="btn" data-act="queue" data-id="' + esc(j.id) + '">Queue it</button><button class="btn" data-act="up-add" data-id="' + esc(j.id) + '">Up next</button><button class="quiet" data-act="later" data-id="' + esc(j.id) + '">Later</button><button class="quiet" data-act="skip-for-good" data-id="' + esc(j.id) + '">Skip</button></div>' : "") + "</div>";
  }
  return '<li class="job' + (picked[j.id] ? " picked" : "") + (cursor === j.id ? " cur" : "") + (openRows[j.id] ? " open" : "") + '" data-id="' + esc(j.id) + '"' + (jTab === "queued" ? ' draggable="true"' : "") + ">" +
    '<div class="l1"><a class="t" href="' + esc(safeUrl(j.url)) + '" target="_blank" rel="noopener" data-act="open" data-id="' + esc(j.id) + '">' + esc(j.title) + "</a>" + upBtn +
    '<span class="r">' + right + '</span><button class="more" data-act="menu" data-id="' + esc(j.id) + '" aria-label="Actions for this job" aria-haspopup="menu">&#8943;</button></div>' +
    '<div class="l2">' + bits.join('<span class="dot"> &middot; </span>') + "</div>" + detail + "</li>";
}
function strongInbox() { return jobs("inbox").filter(function (j) { return (j.match || 0) >= 4 && j.fit === "now"; }); }
function renderJobs() {
  var open = D.jobs.filter(isOpen).length;
  $("j-count").innerHTML = '<span class="count">' + open + "</span> open jobs. " + jobs("applied").length + " sent so far.";
  var counts = { all: D.jobs.filter(function (j) { return ["inbox", "queued", "later"].indexOf(j.status) >= 0; }).length, inbox: jobs("inbox").length, queued: jobs("queued").length, later: jobs("later").length, sent: jobs("applied").length };
  $("j-tabs").innerHTML = TABS.map(function (t) {
    return '<button role="tab" data-tab="' + t[0] + '" aria-selected="' + (t[0] === jTab) + '">' + t[1] + '<span class="n">' + counts[t[0]] + "</span></button>";
  }).join("");
  renderFilters();
  var list = D.jobs.filter(function (j) { return inTab(j) && filtersPass(j) && searchPass(j); });
  if (jTab === "sent") list = list.sort(function (a, b) { return cmp(b.applied_date, a.applied_date); });
  else if (jTab === "queued") {                                 // Up next first, in his order; then the rest in the chosen order
    var u = upIds(), onUp = list.filter(function (j) { return u.indexOf(j.id) >= 0; }).sort(function (a, b) { return u.indexOf(a.id) - u.indexOf(b.id); });
    var restQ = sorted(list.filter(function (j) { return u.indexOf(j.id) < 0; }));
    list = onUp.concat(restQ);
  } else list = sorted(list);
  shown = list.map(function (j) { return j.id; });
  Object.keys(picked).forEach(function (id) { if (shown.indexOf(id) < 0) delete picked[id]; });
  var html = "";
  if (jTab === "sent") {                                        // grouped by day, with how many that day
    var byDay = {}; list.forEach(function (j) { var k = j.applied_date || ""; byDay[k] = (byDay[k] || 0) + 1; });
    var day = null;
    list.forEach(function (j) {
      var k = j.applied_date || "";
      if (k !== day) { day = k; html += '<li class="dayhead">' + (k ? new Date(k + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "No date") + ": <b>" + byDay[k] + " sent</b></li>"; }
      html += jobRow(j);
    });
  } else if (jTab === "queued" && onUp.length) {
    html = '<li class="dayhead uphead">Up next: <b>' + onUp.length + '</b> <span class="uphint">Today takes these first</span> <button type="button" class="quiet" data-sort-up aria-haspopup="menu">Reorder by</button></li>' + onUp.map(jobRow).join("") +
      (restQ.length ? '<li class="dayhead resthead">Rest of the queue: <b>' + restQ.length + "</b></li>" + restQ.map(jobRow).join("") : "");
  } else html = list.map(jobRow).join("");
  var EMPTY_TAB = { queued: "Nothing queued. Queue jobs from the Inbox tab.", inbox: "Nothing new. The daily scan adds jobs here." };
  $("j-list").innerHTML = html || '<li class="empty muted">' + (EMPTY_TAB[jTab] || "Nothing matches.") + "</li>";
  renderBulk();
  var strong = jTab === "inbox" ? strongInbox() : [];
  $("j-inbox-bar").hidden = !strong.length;
  if (strong.length) $("j-inbox-bar").innerHTML = '<button class="btn" data-act="queue-strong">Queue the ' + strong.length + " strong " + (strong.length === 1 ? "match" : "matches") + "</button>";
  $("j-inbox-extra").hidden = jTab !== "inbox";
  $("j-keys").textContent = "Click a job to read it, right-click for everything you can do with it. Keys: \u2191 \u2193 move, Enter opens the posting, U up next, Q queue, L later, S skip, D do it now, Space select, / search. Ctrl- or Shift-click to select several." + (jTab === "queued" ? " Drag a job into or out of Up next, or reorder with Alt+\u2191 \u2193." : "");
  $("j-sent-extra").hidden = jTab !== "sent";
  if (jTab === "sent") {
    var byId = {}; D.jobs.forEach(function (j) { byId[j.id] = j; });
    $("o-votes").innerHTML = '<thead><tr><th>Date</th><th>Kind</th><th>What</th></tr></thead><tbody>' +
      (D.votes.length ? D.votes.slice().reverse().map(function (v) {
        var j = byId[v.job_id];
        return "<tr" + (j ? ' data-job="' + esc(j.id) + '"' : "") + '><td class="when">' + dm(v.date) + "</td><td>" + esc(VOTE_LABEL[v.type]) + "</td><td>" + (j ? esc(j.employer + ", " + j.title) : esc(v.note)) + "</td></tr>";
      }).join("") : '<tr><td colspan="3" class="muted">None yet.</td></tr>') + "</tbody>";
  }
}
/* Go to a job's own row in Jobs, from anywhere (the street, a Career page, a right-click): opens its tab, clears what
   would hide it, opens the row and marks it for a moment. */
function goToJob(id) {
  var j = jobById(id); if (!j) return;
  jTab = { applied: "sent", inbox: "inbox", queued: "queued", later: "later" }[j.status] || "all";
  store("jobs-tab", jTab); jFilters = j.status === "skipped" || j.status === "closed" ? { more: ["gone"] } : {}; saveFilters(); $("j-q").value = "";
  openRows[id] = true; cursor = id; pendingJump = id;
  if (location.hash === "#jobs") { renderJobs(); jumpToRow(); } else location.hash = "#jobs";
}
function jumpToRow() {
  var id = pendingJump; pendingJump = null; if (!id) return;
  var li = document.querySelector('#j-list .job[data-id="' + id + '"]'); if (!li) return;
  li.scrollIntoView({ block: "center" });
  try { li.animate([{ backgroundColor: "#2a2116" }, { backgroundColor: "#2a2116", offset: 0.5 }, { backgroundColor: "transparent" }], { duration: 2200, easing: "ease-out" }); } catch (e) {}
}
function pickedIds() { return shown.filter(function (id) { return picked[id]; }); }
function renderBulk() {
  var ids = pickedIds(), bar = $("j-bulk");
  bar.hidden = ids.length < 2;
  if (ids.length < 2) return;
  bar.innerHTML = "<span>" + ids.length + " selected</span>" +
    (jTab === "sent" ? "" : '<button data-act="bulk" data-to="up">Up next</button><button data-act="bulk" data-to="queued">Queue</button><button data-act="bulk" data-to="later">Later</button><button data-act="bulk" data-to="skip">Skip</button>') +
    '<button data-act="bulk" data-to="copy">Copy links</button><button data-act="bulk" data-to="clear">Clear</button>';
}
function jobById(id) { return D.jobs.find(function (j) { return j.id === id; }); }
function setCursor(id, scroll) {
  cursor = id;
  document.querySelectorAll("#j-list .job").forEach(function (li) { li.classList.toggle("cur", li.getAttribute("data-id") === id); });
  if (scroll) { var li = document.querySelector('#j-list .job[data-id="' + id + '"]'); if (li) li.scrollIntoView({ block: "nearest" }); }
}
function setPicked(ids, on) {
  ids.forEach(function (id) { if (on) picked[id] = true; else delete picked[id]; });
  document.querySelectorAll("#j-list .job").forEach(function (li) { li.classList.toggle("picked", !!picked[li.getAttribute("data-id")]); });
  renderBulk();
}

/* changing status: one save for all of them, with a note that can undo it */
function moveJobs(ids, status, extra) {
  if (!ids.length) return;
  var before = {}; ids.forEach(function (id) { var j = jobById(id); if (j) before[id] = j.status; });
  var patch = { status: status }; if (extra) Object.keys(extra).forEach(function (k) { patch[k] = extra[k]; });
  picked = {};
  post("patch_jobs", { ids: ids, patch: patch }).then(function () {
    var word = { queued: "Queued", later: "Moved to later", skipped: "Skipped", inbox: "Back in the inbox", closed: "Marked closed" }[status] || "Changed";
    toast(word + " " + (ids.length === 1 ? (jobById(ids[0]) || {}).title || "1 job" : ids.length + " jobs") + ".", function () {
      var groups = {}; Object.keys(before).forEach(function (id) { (groups[before[id]] = groups[before[id]] || []).push(id); });
      Object.keys(groups).reduce(function (p2, st) { return p2.then(function () { return post("patch_jobs", { ids: groups[st], patch: { status: st } }); }); }, Promise.resolve());
    });
  });
}
function skipJobs(ids) {
  Ask.text({ title: ids.length > 1 ? "Why skip these " + ids.length + "?" : "Why skip it?", placeholder: "Optional: wrong fit, too far...", ok: "Skip" }).then(function (why) {
    if (why !== null) moveJobs(ids, "skipped", { skip_reason: why });
  });
}
function copy(text, what) { navigator.clipboard.writeText(text).then(function () { toast("Copied " + what + "."); }); }
var toastTimer = null;
/* Sending one (2026-10-28, he asked for a bigger reward, tied to the street): a row of today's bulbs under the heading, like
   the strings in the street, the new one coming on; and for a moment, the sidebar's house drawn big while your character
   walks up and lights the window (the chime plays then, sound.js). Only a real logged application starts it. */
var moment = null;
function renderBulbs(sent, target) {
  var el = $("t-bulbs"); if (!el) return;
  var n = Math.max(target, sent), html = "";
  for (var i = 0; i < n; i++) html += '<span class="bulb' + (i < sent ? " on" : "") + (i >= target ? " extra" : "") + '"></span>';
  el.innerHTML = html;
  if (moment && moment.fresh) {
    var b = el.querySelectorAll(".bulb.on")[sent - 1];
    if (b && b.animate) b.animate([{ opacity: 0.15, transform: "scale(0.7)" }, { opacity: 1, transform: "scale(1)" }], { duration: 1400, easing: "ease-out" });
  }
}
function ordinal(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function renderMoment(box, next) {
  var m = moment, j = m.job || {}, total = window.Scene && Scene.total ? Scene.total() : 0;
  var mile = m.n % 10 === 0 ? "That's " + m.n + " lights." : "";
  box.innerHTML = '<div class="moment"><canvas id="t-moment-cv" class="moment-cv" aria-label="Your character lighting the window"></canvas>' +
    '<div class="moment-text"><p class="moment-big">Sent. Your ' + ordinal(m.n) + " light" + (total ? ' <span class="moment-of">of ' + total + "</span>" : "") + ".</p>" +
    '<p class="moment-job"' + (j.id ? ' data-job="' + esc(j.id) + '"' : "") + ">" + esc(j.title || "") + (j.employer ? ", " + esc(j.employer) : "") + "</p>" +
    (mile ? '<p class="moment-mile">' + esc(mile) + "</p>" : "") +
    (next ? '<p class="moment-next" data-job="' + esc(next.id) + '">Next up: <b>' + esc(next.title) + "</b>, " + esc(next.employer) + "</p>" : "") +
    '<div class="actions"><button class="btn primary" data-act="moment-next">' + (next ? "Next job" : "Done") + "</button></div></div></div>";
  m.fresh = false;
  (function mirror() {                                          // the sidebar picture, big, for as long as the moment lasts
    var dst = $("t-moment-cv"), src = window.Scene && Scene.tileCanvas && Scene.tileCanvas();
    if (!dst || moment !== m) return;
    if (src && src.width) { if (dst.width !== src.width) { dst.width = src.width; dst.height = src.height; } var g = dst.getContext("2d"); g.imageSmoothingEnabled = false; g.clearRect(0, 0, dst.width, dst.height); g.drawImage(src, 0, 0); }
    else dst.hidden = true;
    requestAnimationFrame(mirror);
  })();
  setTimeout(function () { if (moment === m) { moment = null; renderToday(); } }, 25000);
}
function ago(ms) {                                          // "just now", "12 min ago", "at 14:05", "yesterday at 9:12", "on 26 Oct"
  var d = new Date(ms), mins = Math.round((Date.now() - ms) / 60000), hm = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " min ago";
  if (d.toDateString() === new Date().toDateString()) return "at " + hm;
  if (d.toDateString() === new Date(Date.now() - 864e5).toDateString()) return "yesterday at " + hm;
  return "on " + d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function toast(msg, undo) {
  var t = $("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.innerHTML = esc(msg) + (undo ? ' <button type="button">Undo</button>' : "");
  t.hidden = false;
  if (undo) t.querySelector("button").onclick = function () { t.hidden = true; undo(); };
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, undo ? 10000 : 6000);
}

/* ---------------- the right-click menu ----------------
   Drawn by the page (the browser's own menu can't hold job actions). One job, several picked, or a sent one
   each get their own list. Arrow keys move, Enter picks, Esc closes, Right opens a sub-list. */
var menuEl = null;
function closeMenu() { document.querySelectorAll(".cmenu").forEach(function (m) { m.remove(); }); menuEl = null; }
var MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
function readDate(s) {                                          // "Nov 30", "30 Nov", "11/30", "11/30/26" or 2026-11-30; a year left out means the next time that date comes
  s = s.trim().toLowerCase();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/), y, mo, d;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/))) { mo = +m[1]; d = +m[2]; y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : 0; }
  else if ((m = s.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/))) { mo = MONTHS.indexOf(m[1]) + 1; d = +m[2]; y = +(m[3] || 0); }
  else if ((m = s.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?(?:,?\s+(\d{4}))?$/))) { mo = MONTHS.indexOf(m[2]) + 1; d = +m[1]; y = +(m[3] || 0); }
  else return null;
  var iso = function (yr) { return yr + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0"); };
  if (!y) { y = +today().slice(0, 4); if (iso(y) < today()) y += 1; }
  var check = new Date(y, mo - 1, d);
  return mo >= 1 && check.getMonth() === mo - 1 && check.getDate() === d ? iso(y) : null;
}
function setClosing(id, again) {
  var j = jobById(id); if (!j) return;
  Ask.text({ title: again ? "Couldn't read that date. Try Nov 30." : "Closing date for " + j.title, value: j.closes || "", placeholder: "Nov 30. Empty for no date.", ok: "Save" }).then(function (c) {
    if (c === null) return;
    var when = c.trim() ? readDate(c) : "";
    if (when === null) return setClosing(id, true);
    post("patch_job", { id: id, patch: { closes: when } });
  });
}
function wantItems(current, set) { return ["ideal", "great", "good", "okay", "fallback"].map(function (k) { return { label: WANT_WORD[k], checked: current === k, run: function () { set(k); } }; }); }
function menuFor(ids) {
  var items = [];
  if (ids.length > 1) {
    items.push({ head: ids.length + " jobs", sub: "selected" });
    if (jTab !== "sent") {
      items.push({ label: "Add them to Up next", key: "U", run: function () { addUp(ids); } });
      items.push({ label: "Queue them", key: "Q", run: function () { moveJobs(ids, "queued"); } });
      items.push({ label: "Move to later", key: "L", run: function () { moveJobs(ids, "later"); } });
      items.push({ label: "Back to the inbox", run: function () { moveJobs(ids, "inbox"); } });
      items.push({ label: "Want", sub2: wantItems(null, function (k) { post("patch_jobs", { ids: ids, patch: { want: k } }); }) });
      items.push({ label: "Skip them\u2026", key: "S", run: function () { skipJobs(ids); } });
      items.push({ sep: true });
    }
    items.push({ label: "Copy their links", run: function () { copy(ids.map(function (id) { return jobById(id).url; }).join("\n"), ids.length + " links"); } });
    items.push({ label: "Clear selection", key: "Esc", run: function () { setPicked(ids, false); } });
    return items;
  }
  var j = jobById(ids[0]); if (!j) return items;
  items.push({ head: j.title, sub: j.employer + (j.closes ? " \u00b7 " + whenLong(j).toLowerCase() : "") });
  if (j.status !== "applied") items.push({ label: "Do it now", key: "D", run: function () { doNow(j.id); } });
  items.push({ label: "Read the saved posting", run: function () { showPosting(j.id); } });
  if ($("jobs").hidden) items.push({ label: "Show it in Jobs", run: function () { goToJob(j.id); } });
  if (["inbox", "queued", "later"].indexOf(j.status) >= 0) {
    var onUp = upIds().indexOf(j.id) >= 0;
    items.push({ label: onUp ? "Take off Up next" : "Add to Up next", key: "U", run: function () { if (onUp) removeUp([j.id]); else addUp([j.id]); } });
    items.push({ label: "Want", sub2: wantItems(j.want, function (k) { post("patch_job", { id: j.id, patch: { want: k } }); }) });
  }
  items.push({ label: j.resume_file ? "Adjust its resume" : "Make a resume for this job", run: function () { location.hash = "#resume/" + j.id; } });
  items.push({ label: j.cover_file ? "Adjust its cover letter" : "Write a cover letter" + (needsLetter(j) ? " (it asks for one)" : ""), run: function () { location.hash = "#letter/" + j.id; } });
  items.push({ sep: true });
  if (j.status === "applied") {
    items.push({ label: "Heard back", sub2: Object.keys(REPLY).map(function (k) { return { label: REPLY[k], checked: (j.outcome || "") === k, run: function () { post("patch_job", { id: j.id, patch: { outcome: k } }); } }; }) });
    items.push({ label: "Email I used\u2026", run: function () { act("edit-used", { getAttribute: function () { return j.id; }, textContent: j.email_used || "add" }); } });
  } else {
    var moves = [];
    if (j.status !== "queued") moves.push({ label: "Queue", key: "Q", run: function () { moveJobs([j.id], "queued"); } });
    if (j.status !== "later") moves.push({ label: "Later", key: "L", run: function () { moveJobs([j.id], "later"); } });
    if (j.status !== "inbox") moves.push({ label: "Inbox", run: function () { moveJobs([j.id], "inbox"); } });
    moves.push({ label: "Closed (posting is gone)", run: function () { moveJobs([j.id], "closed"); } });
    items.push({ label: "Move to", sub2: moves });
    items.push({ label: "Skip\u2026", key: "S", run: function () { skipJobs([j.id]); } });
    items.push({ label: "I sent it", run: function () { Ask.yes({ title: "Log " + j.title + " as sent?", note: "It counts toward today and lights a light.", ok: "I sent it" }).then(function (ok) { if (ok) post("vote", { type: "application", job_id: j.id }); }); } });
  }
  items.push({ sep: true });
  items.push({ label: "Copy link", key: "C", run: function () { copy(j.url, "the link"); } });
  items.push({ sep: true });
  items.push({ label: "More from " + j.employer, run: function () { $("j-q").value = j.employer; if (jTab !== "sent") jTab = "all"; jFilters = {}; saveFilters(); renderJobs(); location.hash = "#jobs"; } });
  items.push({ label: "Look up " + j.employer, run: function () { window.open("https://duckduckgo.com/?q=" + encodeURIComponent(j.employer + " " + (j.location || "")), "_blank", "noopener"); } });
  return items;
}
function buildMenu(items, x, y, parent) {
  var m = document.createElement("div");
  m.className = "cmenu"; m.setAttribute("role", "menu");
  items.forEach(function (it) {
    if (it.head) { var h = document.createElement("div"); h.className = "hd"; h.innerHTML = "<b>" + esc(it.head) + "</b><span>" + esc(it.sub || "") + "</span>"; m.appendChild(h); return; }
    if (it.sep) { var s2 = document.createElement("div"); s2.className = "sep"; m.appendChild(s2); return; }
    var b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", it.checked !== undefined ? "menuitemradio" : "menuitem");
    if (it.checked !== undefined) b.setAttribute("aria-checked", it.checked);
    b.innerHTML = "<span>" + esc(it.label) + "</span>" + (it.sub2 ? '<kbd>&rsaquo;</kbd>' : it.key ? "<kbd>" + esc(it.key) + "</kbd>" : "");
    if (it.sub2) {
      b.setAttribute("aria-haspopup", "menu");
      var openSub = function () {
        document.querySelectorAll(".cmenu.sub").forEach(function (sm) { sm.remove(); });
        var r = b.getBoundingClientRect(), sub = buildMenu(it.sub2, r.right - 2, r.top - 6, m);
        sub.classList.add("sub"); return sub;
      };
      b.addEventListener("mouseenter", openSub);
      b.addEventListener("click", function () { var sub = openSub(); var first = sub.querySelector("button"); if (first) first.focus(); });
      b._openSub = openSub;
    } else {
      b.addEventListener("mouseenter", function () { if (!parent) document.querySelectorAll(".cmenu.sub").forEach(function (sm) { sm.remove(); }); b.focus(); });
      b.addEventListener("click", function () {
        if (it.keep) { var was = b.getAttribute("aria-checked") === "true"; b.setAttribute("aria-checked", !was); it.run(); return; }   // tick boxes stay open
        closeMenu(); it.run();
      });
    }
    m.appendChild(b);
  });
  document.body.appendChild(m);
  var w = m.offsetWidth, hgt = m.offsetHeight;
  if (parent && x + w > innerWidth - 8) x = parent.getBoundingClientRect().left - w + 2;
  m.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + "px";
  m.style.top = Math.max(8, Math.min(y, innerHeight - hgt - 8)) + "px";
  try { m.animate([{ opacity: 0, transform: "translateY(-3px)" }, { opacity: 1, transform: "none" }], { duration: 110, easing: "ease-out" }); } catch (e) {}
  m._parent = parent || null;
  return m;
}
function openMenu(ids, x, y) {
  closeMenu();
  menuEl = buildMenu(menuFor(ids), x, y);
  var first = menuEl.querySelector("button"); if (first) first.focus();
}
/* "Do it now": Today only shows queued jobs, so queue it first if it's in Later or the inbox, and take it off
   today's skipped list; otherwise Today silently showed a different job (bug he hit 2026-10-27). */
function doNow(id) {
  var j = jobById(id); if (!j) return;
  var k = "skipped:" + today();
  store(k, (store(k) || "").split(",").filter(function (x) { return x && x !== id; }).join(","));
  store("focus", id); closeMenu();
  var go = function () { location.hash = "#today"; renderToday(); window.scrollTo(0, 0); };
  if (j.status !== "queued") post("patch_job", { id: id, patch: { status: "queued" } }).then(go); else go();
}
function openJob(j) { post("event", { type: "opened", job_id: j.id }); window.open(j.url, "_blank", "noopener"); }

/* clicks, right-clicks and keys on the list */
$("j-list").addEventListener("click", function (e) {
  var su = e.target.closest("[data-sort-up]"); if (su) { openSort(su, true); return; }
  var li = e.target.closest(".job"); if (!li || e.target.closest("a, button, select")) return;
  var id = li.getAttribute("data-id");
  if (e.shiftKey && anchorId) {
    var a2 = shown.indexOf(anchorId), b2 = shown.indexOf(id);
    setPicked(shown.slice(Math.min(a2, b2), Math.max(a2, b2) + 1), true);
  } else if (e.ctrlKey || e.metaKey) setPicked([id], !picked[id]);
  else {
    setPicked(Object.keys(picked), false);                     // a plain click clears a selection, as in a file list
    if (window.getSelection && String(window.getSelection())) { /* he was selecting text, not opening */ }
    else { openRows[id] = !openRows[id]; cursor = id; var job = jobById(id); if (job) li.outerHTML = jobRow(job); }
  }
  if (!e.shiftKey) anchorId = id;
  setCursor(id);
});
/* Up next: drag a row to reorder */
var dragId = null;
$("j-list").addEventListener("dragstart", function (e) { var li = e.target.closest(".job"); if (!li || jTab !== "queued") return; dragId = li.getAttribute("data-id"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); li.classList.add("dragging"); });
$("j-list").addEventListener("dragover", function (e) {
  if (!dragId) return; e.preventDefault();
  var li = e.target.closest(".job, .dayhead"); document.querySelectorAll("#j-list .dropline").forEach(function (x) { x.classList.remove("dropline"); });
  if (li && li.getAttribute("data-id") !== dragId) li.classList.add("dropline");
});
$("j-list").addEventListener("drop", function (e) {
  if (!dragId) return; e.preventDefault();
  var li = e.target.closest(".job, .dayhead"), u = upIds(), from = u.indexOf(dragId);
  var to = !li ? -1 : li.classList.contains("uphead") ? 0 : li.classList.contains("resthead") ? -1 : u.indexOf(li.getAttribute("data-id"));
  if (to >= 0) {                                                // onto Up next: it goes there, wherever it came from
    if (from >= 0) u.splice(from, 1);
    u.splice(to, 0, dragId); saveUp(u);
  } else if (from >= 0) { u.splice(from, 1); saveUp(u); }       // out of Up next, into the rest of the queue
  dragId = null;
});
$("j-list").addEventListener("dragend", function () { dragId = null; document.querySelectorAll("#j-list .dragging, #j-list .dropline").forEach(function (x) { x.classList.remove("dragging", "dropline"); }); });
$("j-list").addEventListener("contextmenu", function (e) {
  var li = e.target.closest(".job"); if (!li) return;
  e.preventDefault();
  var id = li.getAttribute("data-id");
  if (!picked[id]) { picked = {}; setPicked([], true); }
  setCursor(id);
  var ids = pickedIds().length > 1 ? pickedIds() : [id];
  openMenu(ids, e.clientX, e.clientY);
});
document.addEventListener("contextmenu", function (e) {
  if (!D || document.body.classList.contains("street-open") || e.target.closest("#j-list, .cmenu, .askbox, input, textarea, select, [contenteditable]")) return;
  var el = e.target.closest("[data-job], tr.pick[data-id]"); if (!el) return;
  var id = el.getAttribute("data-job") || el.getAttribute("data-id"); if (!jobById(id)) return;
  e.preventDefault(); openMenu([id], e.clientX, e.clientY);
});
document.addEventListener("mousedown", function (e) { if (!e.target.closest(".cmenu")) closeMenu(); });
window.addEventListener("blur", closeMenu);
window.addEventListener("resize", closeMenu);
document.addEventListener("scroll", closeMenu, true);
$("j-tabs").addEventListener("click", function (e) { var b = e.target.closest("[data-tab]"); if (!b) return; jTab = b.getAttribute("data-tab"); store("jobs-tab", jTab); picked = {}; renderJobs(); });
$("j-filters").addEventListener("click", function (e) {
  if (e.target.closest("[data-filter-clear]")) { jFilters = {}; saveFilters(); closeMenu(); renderJobs(); return; }
  var s = e.target.closest("[data-sort]"); if (s) { openSort(s); return; }
  var b = e.target.closest("[data-filter]"); if (b) openFilter(b.getAttribute("data-filter"), b);
});
$("j-q").addEventListener("input", function () { if (D) renderJobs(); });
$("j-new").addEventListener("click", function () { jTab = "inbox"; store("jobs-tab", jTab); if (D) renderJobs(); });   // the square opens the Inbox tab
document.addEventListener("keydown", function (e) {
  if (menuEl) {                                   // inside the menu
    var m = document.activeElement && document.activeElement.closest(".cmenu") || menuEl, btns = Array.prototype.slice.call(m.querySelectorAll("button")), i = btns.indexOf(document.activeElement);
    if (e.key === "Escape") { if (m._parent) { m.remove(); var pb = m._parent.querySelector("button:focus") || m._parent.querySelector("button"); if (pb) pb.focus(); } else closeMenu(); e.preventDefault(); }
    else if (e.key === "ArrowDown") { btns[(i + 1) % btns.length].focus(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { btns[(i - 1 + btns.length) % btns.length].focus(); e.preventDefault(); }
    else if (e.key === "ArrowRight" && document.activeElement._openSub) { var sub = document.activeElement._openSub(); var f2 = sub.querySelector("button"); if (f2) f2.focus(); e.preventDefault(); }
    else if (e.key === "ArrowLeft" && m._parent) { m.remove(); var pb2 = m._parent.querySelector("button"); if (pb2) pb2.focus(); e.preventDefault(); }
    return;
  }
  if ($("jobs").hidden || !D) return;
  var tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") { if (e.key === "Escape") e.target.blur(); return; }
  if (e.altKey && jTab === "queued" && cursor && upIds().indexOf(cursor) >= 0 && (e.key === "ArrowUp" || e.key === "ArrowDown")) { moveUp(cursor, e.key === "ArrowUp" ? -1 : 1); e.preventDefault(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  var k = e.key, at = shown.indexOf(cursor), ids = pickedIds().length > 1 ? pickedIds() : (cursor ? [cursor] : []);
  var j = cursor && jobById(cursor);
  if (k === "ArrowDown" || k === "j") { setCursor(shown[Math.min(shown.length - 1, at + 1)], true); }
  else if (k === "ArrowUp" || k === "k") { setCursor(shown[Math.max(0, at - 1)], true); }
  else if (k === "/") { $("j-q").focus(); }
  else if (k === "Escape") { setPicked(Object.keys(picked), false); }
  else if (!ids.length) return;
  else if (k === " ") { setPicked([cursor], !picked[cursor]); }
  else if (k === "Enter" && j) { openJob(j); }
  else if ((k === "u" || k === "U") && jTab !== "sent") { if (ids.every(function (id) { return upIds().indexOf(id) >= 0; })) removeUp(ids); else addUp(ids); }
  else if ((k === "q" || k === "Q") && jTab !== "sent") { moveJobs(ids, "queued"); }
  else if ((k === "l" || k === "L") && jTab !== "sent") { moveJobs(ids, "later"); }
  else if ((k === "s" || k === "S") && jTab !== "sent") { skipJobs(ids); }
  else if ((k === "d" || k === "D") && j && j.status !== "applied") { doNow(j.id); }
  else if ((k === "c" || k === "C") && j) { copy(j.url, "the link"); }
  else return;
  e.preventDefault();
});

/* Each Career page lists your open jobs in that group, best first (2026-11-02, he asked: the jobs there should be the ones in
   Jobs). Clicking one goes to it in Jobs; right-click works as everywhere. Long lists stop at 15, with a link to the rest. */
var BOARD_MAX = 15;
function renderPathBoards() {
  document.querySelectorAll("[data-jobs]").forEach(function (el) {
    var p = el.getAttribute("data-jobs"), list, paths = p.split(",");
    if (p === "apply-first") list = todayQueue();
    else list = sorted(D.jobs.filter(function (j) { return ["inbox", "queued", "later"].indexOf(j.status) >= 0 && (j.paths || []).some(function (x) { return paths.indexOf(x) >= 0; }); }));
    var rest = list.length - BOARD_MAX, top = list.slice(0, BOARD_MAX);
    var types = JOB_TYPES.filter(function (t) { return t[2].some(function (x) { return paths.indexOf(x) >= 0; }); }).map(function (t) { return t[0]; });
    el.innerHTML = '<table class="board"><thead><tr><th>Job</th><th class="pay">Pay</th><th>Closes</th><th class="fit hide-sm">At a glance</th></tr></thead><tbody>' +
      (top.length ? top.map(function (j) {
        return '<tr data-job="' + esc(j.id) + '"><td><span class="role"><a href="#jobs" data-act="go-job" data-id="' + esc(j.id) + '">' + esc(j.title) + '</a></span><span class="sub">' + esc(j.employer) + (j.location ? ", " + esc(j.location) : "") + '</span></td><td class="pay num">' + esc(j.pay || "") + '</td><td class="when' + (soon(j) ? " soon" : "") + '">' + whenShort(j) + '</td><td class="fit hide-sm">' + meters(j, true) + "</td></tr>";
      }).join("") : '<tr><td colspan="4" class="muted">No open jobs here right now. The scan looks every day.</td></tr>') + "</tbody></table>" +
      (rest > 0 ? '<p class="more">' + rest + ' more. <a href="#jobs" data-act="board-all" data-types="' + types.join(",") + '">See all ' + list.length + " in Jobs</a></p>" : "");
  });
}

function renderKitWhy() {                                       // for the job at the top of Today (it left the right-click menu, 2026-11-03)
  var j = todayQueue()[0];
  $("k-why").innerHTML = j && j.why ? '<div class="kit"><div class="head"><span class="label">Why you qualify: ' + esc(j.title) + " at " + esc(j.employer) + '</span><button class="copy" data-act="copy">Copy</button></div><pre>' + esc(j.why) + "</pre></div>" : "";
}
function renderKit(kit) {
  $("k-list").innerHTML = kit.map(function (g) {
    return "<h2>" + esc(g.h) + "</h2>" + (g.note ? '<p class="lede">' + esc(g.note) + "</p>" : "") +
      g.items.map(function (it) {
        return '<div class="kit"><div class="head"><span class="label">' + esc(it.label) + '</span><button class="copy" data-act="copy">Copy</button></div><pre>' + esc(it.text) + "</pre></div>";
      }).join("");
  }).join("");
}

/* ---------------- actions ---------------- */
function act(a, el, e) {
  var id = el.getAttribute("data-id");
  switch (a) {
    case "open":
      post("event", { type: "opened", job_id: id });
      if (el.closest("#t-act")) { store("opened:" + id, String(Date.now())); setTimeout(renderToday, 60); }   // "I sent it" becomes the main button
      return true; // let the link open
    case "sent":
      var sentJob = jobById(id);
      store("opened:" + id, null); store("focus", null);
      post("vote", { type: "application", job_id: id }).then(function (r) {
        if (r === undefined) return;
        var n = votesOn(today()).length, tgt = D.settings.daily_target || 5;
        moment = { job: sentJob, n: D.votes.length, t0: performance.now(), fresh: true };   // the moment: your light, big
        renderToday(); window.scrollTo({ top: 0, behavior: "smooth" });
        toast("Sent: " + (sentJob ? sentJob.title : "it") + " (" + n + " of " + tgt + " today).", function () { moment = null; post("undo_vote"); });
      });
      break;
    case "skip":
      var k = "skipped:" + today(), s = (store(k) || "").split(",").filter(Boolean);
      s.push(id); store(k, s.join(",")); store("focus", null); renderToday(); break;
    case "moment-next": moment = null; renderToday(); break;
    case "focus": store("focus", id); renderToday(); window.scrollTo({ top: 0, behavior: "smooth" }); break;
    case "focus-go": doNow(id); break;
    case "read-posting": showPosting(id); break;
    case "set-closes": setClosing(id); break;
    case "later": post("patch_job", { id: id, patch: { status: "later" } }); break;
    case "queue": post("patch_job", { id: id, patch: { status: "queued" } }); break;
    case "swap-addr": var ji = jobById(id); store("addr:" + id, String((addrIndex(ji) + 1) % ADDRS.length)); renderToday(); break;
    case "up-add": addUp([id]); break;
    case "up-remove": removeUp([id]); break;
    case "go-job": goToJob(id); break;
    case "board-all": jTab = "all"; store("jobs-tab", jTab); $("j-q").value = ""; jFilters = { type: (el.getAttribute("data-types") || "").split(",").filter(Boolean) }; saveFilters(); renderJobs(); location.hash = "#jobs"; break;
    case "queue-strong": moveJobs(strongInbox().map(function (j) { return j.id; }), "queued"); break;
    case "skip-for-good":
      Ask.text({ title: "Why skip it?", placeholder: "Optional: wrong fit, too far, casino, defense...", ok: "Skip" }).then(function (why) {
        if (why !== null) post("patch_job", { id: id, patch: { status: "skipped", skip_reason: why } });
      });
      break;
    case "vote-agency": case "vote-followup":
      Ask.text({ title: a === "vote-agency" ? "Which recruiter or agency?" : "Who did you write to?", ok: "Log it" }).then(function (note) {
        if (note !== null) post("vote", { type: a.slice(5), note: note });
      });
      break;
    case "exam": Ask.text({ title: "Which exam?", ok: "Note it" }).then(function (ex) { if (ex) post("event", { type: "exam", note: ex }); }); break;
    case "undo": Ask.yes({ title: "Undo the last one you logged?", ok: "Undo it" }).then(function (ok) { if (ok) post("undo_vote"); }); break;
    case "reveal": post("reveal", { file: el.getAttribute("data-file") }); break;
    case "edit-cue":
      Ask.text({ title: "When and where do you apply?", value: D.settings.cue || "", placeholder: "After breakfast, at my desk.", ok: "Save" }).then(function (c) {
        if (c) post("settings", { patch: { cue: c } });
      });
      break;
    case "copy-text":
      navigator.clipboard.writeText(el.getAttribute("data-text")).then(function () { el.textContent = "Copied"; setTimeout(function () { el.textContent = "Copy"; }, 1400); });
      break;
    case "edit-email":
      Ask.text({ title: "The email address you apply with.", value: D.settings.email || "", ok: "Save" }).then(function (addr) {
        if (addr && addr.indexOf("@") > 0) post("settings", { patch: { email: addr.trim() } });
      });
      break;
    case "edit-used":
      Ask.text({ title: "Which email address did you use for this application?", value: /^add\b/.test(el.textContent) ? "" : el.textContent, ok: "Save" }).then(function (used) {
        if (used !== null) post("patch_job", { id: id, patch: { email_used: used.trim() } });
      });
      break;
    case "menu":
      if (!picked[id]) { picked = {}; setPicked([], true); }
      setCursor(id);
      var r = el.getBoundingClientRect();
      openMenu(pickedIds().length > 1 ? pickedIds() : [id], r.left - 200, r.bottom + 4);
      break;
    case "bulk":
      var to = el.getAttribute("data-to"), sel = pickedIds();
      if (to === "clear") setPicked(sel, false);
      else if (to === "copy") copy(sel.map(function (x) { return jobById(x).url; }).join("\n"), sel.length + " links");
      else if (to === "skip") skipJobs(sel);
      else if (to === "up") addUp(sel);
      else moveJobs(sel, to);
      break;
    case "copy":
      var pre = el.closest(".kit").querySelector("pre");
      navigator.clipboard.writeText(pre.textContent).then(function () { el.textContent = "Copied"; el.classList.add("ok"); setTimeout(function () { el.textContent = "Copy"; el.classList.remove("ok"); }, 1400); });
      break;
  }
  return false;
}
document.addEventListener("click", function (e) {
  var el = e.target.closest("[data-act]");
  if (!el || !D) return;
  if (!act(el.getAttribute("data-act"), el, e)) e.preventDefault();
});
document.addEventListener("change", function (e) {
  var t = e.target;
  var id = t.getAttribute("data-outcome");
  if (id) post("patch_job", { id: id, patch: { outcome: t.value } });
});
$("add-form").addEventListener("submit", function (e) {
  e.preventDefault();
  var job = { status: "queued", fit: "now", source: "added by me", paths: [] };
  new FormData(e.target).forEach(function (v, k) { if (v) job[k] = v; });
  post("add_job", { job: job }).then(function (r) { if (r && r.id) e.target.reset(); else if (r) showError("That link is already in the tracker."); });
});

/* ---------------- pages ---------------- */
function show() {
  var h = (location.hash || "#today").slice(1);
  var OLD = { queue: "queued", all: "all", outcomes: "sent", inbox: "inbox" };      // pages merged into Jobs (2026-10-27; the Inbox 2026-11-02)
  if (OLD[h]) { jTab = OLD[h]; store("jobs-tab", jTab); if (D) renderJobs(); history.replaceState(null, "", "#jobs"); h = "jobs"; }
  var rbJob = null;
  if (h.indexOf("resume/") === 0) { rbJob = h.slice(7); h = "resume"; }
  if (h.indexOf("letter/") === 0) { rbJob = h.slice(7); h = "letter"; }
  if (PAGES.indexOf(h) < 0) h = "today";
  if (h === "resume" && window.ResumeBuilder) ResumeBuilder.open(rbJob);
  else if (window.ResumeBuilder) ResumeBuilder.leave();
  if (h === "letter" && window.LetterBuilder) LetterBuilder.open(rbJob);
  else if (window.LetterBuilder) LetterBuilder.leave();
  if (h === "skills" && window.SkillsPage) SkillsPage.open();
  if (h === "setup" && window.SetupPage) SetupPage.open();
  if (h === "interview" && window.InterviewPage) InterviewPage.open();
  if (h === "character" && window.CharacterPage) CharacterPage.open();
  else if (window.CharacterPage) CharacterPage.leave();     // the street canvas goes back to the sidebar
  PAGES.forEach(function (id) { var s = $(id); if (s) s.hidden = id !== h; });
  var inPaths = PATH_PAGES.some(function (p) { return p[0] === h; });
  document.querySelectorAll(".menu a").forEach(function (a) {
    var on = a.getAttribute("href") === "#" + h || (inPaths && a.getAttribute("data-group") === "paths");
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.querySelectorAll(".pathnav a").forEach(function (a) {
    if (a.getAttribute("href") === "#" + h) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
  if (h === "jobs" && pendingJump && D) { renderJobs(); jumpToRow(); }
  if (h === "today" && D) autoDocs(todayQueue()[0]);
}
// the Career paths pages are the person's own (data/paths.html); without that file the menu has no Career paths
function loadPaths() {
  return fetch("/paths.html", { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (html) {
    if (!html) return;
    document.querySelector("main").insertAdjacentHTML("beforeend", html);
    document.querySelectorAll("main section.paths").forEach(function (s) {
      PATH_PAGES.push([s.id, s.getAttribute("data-label") || s.id]);
      PAGES.push(s.id);
    });
    document.querySelectorAll(".pathnav").forEach(function (n) {
      n.innerHTML = PATH_PAGES.map(function (p) { return '<a href="#' + p[0] + '">' + esc(p[1]) + "</a>"; }).join("");
    });
    if (D) renderPathBoards();                                  // the job tables inside them, if the data came first
    if (PATH_PAGES.length) {
      $("paths-link").hidden = false;
      $("paths-link").querySelector("a").setAttribute("href", "#" + PATH_PAGES[0][0]);
    }
  }).catch(function () {});
}
window.addEventListener("hashchange", show);
document.addEventListener("keydown", function (e) {                 // Today: O opens the posting, S marks it sent
  if (e.ctrlKey || e.metaKey || e.altKey || document.body.classList.contains("street-open")) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if ((location.hash || "#today") !== "#today") return;
  var k = e.key.toLowerCase(), el = k === "o" ? document.querySelector('#t-act [data-act="open"]') : k === "s" ? document.querySelector('#t-act [data-act="sent"]') : null;
  if (!el && moment && (k === "enter" || k === "n")) el = document.querySelector('[data-act="moment-next"]');
  if (el) { e.preventDefault(); el.click(); }
});
// the sidebar's size, his to choose (2026-10-28): full, slim (narrower, a smaller house, no caption), or the menu only
// (2026-10-28, he asked for an arrow instead of the words) one arrow at the top: ‹ shrinks a step, › at the smallest opens it again
var RAIL_SIZES = ["full", "slim", "menu"];
var ARROW = { left: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  right: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>' };
function setRail(size) {
  RAIL_SIZES.forEach(function (s) { document.body.classList.toggle("rail-" + s, s === size && s !== "full"); });
  var b = $("railsize"), smallest = size === "menu", label = smallest ? "Open the sidebar fully" : "Make the sidebar smaller";
  b.innerHTML = smallest ? ARROW.right : ARROW.left; b.setAttribute("aria-label", label); b.title = label; store("rail-size", size);
  window.dispatchEvent(new Event("resize"));                    // the house picture finds its new place
}
$("railsize").addEventListener("click", function () { setRail(RAIL_SIZES[(RAIL_SIZES.indexOf(store("rail-size") || "full") + 1) % 3]); });
setRail(RAIL_SIZES.indexOf(store("rail-size")) >= 0 ? store("rail-size") : "full");
// coming back from a posting tab: ask whether it was sent
window.addEventListener("focus", function () { load(); });
document.addEventListener("visibilitychange", function () { if (!document.hidden) load(); });
setInterval(function () { if (!document.hidden) load(); }, 120000);

Scene.mount({ rail: $("side"), svg: $("scene"), sky: $("sky"), nav: $("nav") });
try { if (window.Sound) Sound.init(); } catch (e) { console.warn("sound off:", e); }
try { if (window.Light) Light.init(); } catch (e) { console.warn("light layer off:", e); }   // lighting must never stop the tracker
if (Scene.onPick) Scene.onPick(function (k) {                    // a lit light clicked in the street: its row in Jobs > Sent, once the street has closed
  var v = D && D.votes[k]; if (!v) return;
  if (v.job_id && jobById(v.job_id)) goToJob(v.job_id);
  else { jTab = "sent"; store("jobs-tab", jTab); jFilters = {}; saveFilters(); $("j-q").value = ""; location.hash = "#jobs"; renderJobs(); }
});
Scene.labels(function (k) {
  var v = D && D.votes[k];
  if (!v) return "";
  var j = v.job_id && D.jobs.find(function (x) { return x.id === v.job_id; });
  var what = j ? j.employer + ", " + j.title : (VOTE_LABEL[v.type] + (v.note ? ": " + v.note : ""));
  return what + ". " + dm(v.date) + ".";
});
fetch("/kit.json").then(function (r) { return r.json(); }).then(renderKit).catch(function () {});
window.App = { data: function () { return D; }, post: post, setData: function (d) { D = d; render(); }, goToJob: goToJob, posting: postingFor,
  searchJobs: function (q) { jTab = "all"; store("jobs-tab", jTab); jFilters = {}; saveFilters(); $("j-q").value = q; renderJobs(); location.hash = "#jobs"; } };   // for the resume builder (resume.js)
show(); load().then(function () { if (window.SkillsPage) SkillsPage.load(); });
fetch("/api/profile", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (p) {
  if (!p.exists) location.hash = "#setup";                     // a new person: first run
  ADDRS = p.addresses || [];
  TRADEOFF = (p.prefs || {}).tradeoff || "";
  var yearly = function (t) { var m = String(t || "").replace(/,/g, "").match(/\d+(\.\d+)?/); if (!m) return 0; var v = +m[0]; return v < 300 ? v * 2080 : v < 1000 ? v * 1000 : v; };
  PAY = { floor: yearly((p.prefs || {}).payFloor) || PAY.floor, good: yearly((p.prefs || {}).payTarget) || PAY.good };
  if (D) render();
}).catch(function () {});
loadPaths().then(function () { if (PAGES.indexOf((location.hash || "#").slice(1)) >= 0) show(); });   // a career page opened by its link
})();
