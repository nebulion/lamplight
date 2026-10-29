(function () {
"use strict";

var PAGES = ["today", "inbox", "jobs", "resume", "letter", "kit", "character", "setup", "interview"];
var PATH_PAGES = [];   // [id, label] of the person's own Career paths pages (data/paths.html), added by loadPaths()
var PATH_LABEL = { signals: "Signals", fare: "Fare & bus", rail: "Rail", water: "Water SCADA", it: "IT & network",
  tolling: "Tolling", access: "Accessibility", gis: "GIS", resort: "Resort tech", everyday: "Gyms, venues & outdoors", other: "Other" };
var FIT = { 5: "Meets every requirement", 4: "Meets it with “or equivalent”", 3: "One gap", 2: "Several gaps", 1: "Later in the plan" };
var FIT_SHORT = { 5: "Meets all", 4: "Or equivalent", 3: "One gap", 2: "Several gaps", 1: "Later" };
var FIT_RANK = { now: 0, stretch: 1, exam: 2, later: 3, watch: 4 };
var TAG_CLASS = { now: "now", stretch: "stretch", exam: "stretch", later: "later", watch: "later" };
var VOTE_LABEL = { application: "Application", agency: "Recruiter or agency", followup: "Follow-up or networking" };
var REPLY = { "": "No reply yet", no_reply: "Silence", response: "Replied", interview: "Interview", offer: "Offer", rejected: "Said no", withdrew: "I withdrew" };

var D = null, lastVotes = null, TRADEOFF = "";   // TRADEOFF: their interview answer (ideal stretch first, or sure things first)
var SPEED_RANK = { fast: 0, medium: 1, slow: 2 };
var SPEED = { fast: "Usually hires within weeks.", medium: "Usually hires in one to two months.", slow: "Civil service: often takes months." };
var SORTS = {
  next: { label: "best next", fn: function (a, b) { return (nextScore(b) - nextScore(a)) || byDeadline(a, b); } },
  deadline: { label: "deadline", fn: byDeadline },
  match: { label: "best fit", fn: function (a, b) { return ((b.match || 0) - (a.match || 0)) || byDeadline(a, b); } },
  salary: { label: "pay", fn: function (a, b) { return ((b.salary_min || 0) - (a.salary_min || 0)) || byDeadline(a, b); } },
  newest: { label: "newest", fn: function (a, b) { return cmp(b.added, a.added) || byDeadline(a, b); } },
  employer: { label: "employer", fn: function (a, b) { return (a.employer || "").localeCompare(b.employer || "") || byDeadline(a, b); } },
  speed: { label: "fastest to hire", fn: function (a, b) { return ((SPEED_RANK[a.speed] || 1) - (SPEED_RANK[b.speed] || 1)) || ((b.match || 0) - (a.match || 0)) || byDeadline(a, b); } }
};
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
  s += { ideal: 25, good: 10, fallback: -10 }[j.want] || 0;          // how much they want it, from their scan (D42; his jobs have none)
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
function resumeFile(j) { if (j.resume_file) return j.resume_file; var r = D.resumes[j.resume]; return r ? r.file : ""; }   // a custom one made for this job wins
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
  $("n-inbox").textContent = jobs("inbox").length || "";
  $("n-jobs").textContent = D.jobs.filter(isOpen).length;
  document.querySelectorAll(".sortpick").forEach(function (sel) {
    if (!sel.options.length) Object.keys(SORTS).forEach(function (k) { sel.add(new Option(SORTS[k].label, k)); });
    sel.value = sortKey;
  });
  var n = D.votes.length;
  window.Scene && Scene.setLit(n, lastVotes !== null && n > lastVotes);
  window.Scene && Scene.setToday && Scene.setToday(t, target);   // the street's foreground bulbs: one per application today
  scheduleMidnight();
  if (lastVotes !== null && n > lastVotes && window.Sound) Sound.sent(D.votes[n - 1].type);   // only for something you just logged
  lastVotes = n;
  renderToday(); renderInbox(); renderJobs(); renderPathBoards();
}

/* Today: one job, then a short departure board */
function todayQueue() {
  var q = sorted(jobs("queued"));
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

  var q = todayQueue(), j = q[0], box = $("t-now"), asking = store("asking");
  if (!j) {
    box.innerHTML = '<h2>Nothing queued</h2><p class="why">' + (jobs("inbox").length ? jobs("inbox").length + ' new jobs are waiting in the <a href="#inbox">inbox</a>. Queue a few.' : 'The daily scan adds jobs every morning. You can also <a href="#inbox">add one yourself</a>.') + "</p>";
    $("t-next-wrap").hidden = true;
    return;
  }
  var done = sent >= target ? '<p class="done-line">That\'s today. If you want one more, it\'s this:</p>' : "";
  var f = resumeFile(j);
  box.innerHTML = done +
    '<p class="employer">' + esc(j.employer) + (j.location ? ", " + esc(j.location) : "") + "</p>" +
    "<h2>" + esc(j.title) + "</h2>" +
    '<p class="facts"><span class="' + (soon(j) ? "soon" : "") + '">' + whenLong(j) + ".</span>" + (j.pay ? " Pays " + esc(j.pay) + "." : "") + (j.speed ? " " + SPEED[j.speed] : "") + (j.match ? " <strong>" + FIT[j.match] + ".</strong>" : "") + "</p>" +
    (j.why ? '<p class="why">' + esc(j.why) + "</p>" : "") +
    (j.toward_planning ? '<p class="resume">Toward planning: ' + esc(j.toward_planning) + "</p>" : "") +
    (f ? '<p class="resume">Attach <b>' + esc(f.split("/").pop()) + '</b> <span class="small">(' + esc(j.resume_file ? "made for this job" : f.split("/")[0]) + ')</span> &nbsp;<button class="quiet" data-act="reveal" data-file="' + esc(f) + '">Show file</button> <a class="quiet" href="#resume/' + esc(j.id) + '">' + (j.resume_file ? "Adjust it" : "Make one for this job") + "</a></p>" : "") +
    (j.cover_file ? '<p class="resume">Attach <b>' + esc(j.cover_file.split("/").pop()) + '</b> <span class="small">(made for this job)</span> &nbsp;<button class="quiet" data-act="reveal" data-file="' + esc(j.cover_file) + '">Show file</button> <a class="quiet" href="#letter/' + esc(j.id) + '">Adjust it</a></p>'
      : needsLetter(j) ? '<p class="resume">This one asks for a cover letter. <a class="quiet" href="#letter/' + esc(j.id) + '">Write one</a></p>' : "") +
    '<p class="resume">Apply with <b>' + esc(emailOf(j)) + '</b> &nbsp;<button class="quiet" data-act="copy-text" data-text="' + esc(emailOf(j)) + '">Copy</button> <button class="quiet" data-act="edit-email">Change address</button></p>' +
    '<div class="actions" id="t-act"></div>';
  var act = $("t-act");
  if (asking === j.id) {
    act.innerHTML = '<span class="ask">Did you send it?</span><button class="btn primary" data-act="sent" data-id="' + esc(j.id) + '">Yes, sent</button><button class="btn" data-act="notyet">Not yet</button>';
  } else {
    act.innerHTML = '<a class="btn primary" href="' + esc(safeUrl(j.url)) + '" target="_blank" rel="noopener" data-act="open" data-id="' + esc(j.id) + '">Open posting</a>' +
      '<button class="btn" data-act="sent" data-id="' + esc(j.id) + '">I sent it</button>' +
      '<button class="quiet" data-act="skip" data-id="' + esc(j.id) + '">Skip for now</button>';
  }
  var next = q.slice(1, 6);
  $("t-next-wrap").hidden = !next.length;
  $("t-next").innerHTML = '<thead><tr><th>Closes</th><th>Job</th><th class="fit">Fit</th></tr></thead><tbody>' +
    next.map(function (n) {
      return '<tr class="pick" data-act="focus" data-id="' + esc(n.id) + '"><td class="when' + (soon(n) ? " soon" : "") + '">' + whenShort(n) + "</td><td>" + jobCell(n, false) + '</td><td class="fit">' + (FIT_SHORT[n.match] || "") + "</td></tr>";
    }).join("") + "</tbody>";
  var rest = q.length - 1 - next.length;
  $("t-more").innerHTML = (rest > 0 ? rest + ' more in <a href="#jobs">Jobs</a>. ' : "") + (jobs("inbox").length ? jobs("inbox").length + ' new in the <a href="#inbox">inbox</a>.' : "");
}

function renderInbox() {
  var list = sorted(jobs("inbox"));
  $("i-list").innerHTML = list.length ? list.map(function (j) {
    return '<article class="entry"><p class="employer">' + esc(j.employer) + (j.location ? ", " + esc(j.location) : "") + "</p>" +
      '<h3><a href="' + esc(safeUrl(j.url)) + '" target="_blank" rel="noopener">' + esc(j.title) + "</a></h3>" +
      '<p class="facts"><span class="' + (soon(j) ? "soon" : "") + '">' + whenLong(j) + ".</span>" + (j.pay ? " Pays " + esc(j.pay) + "." : "") + (j.speed ? " " + SPEED[j.speed] : "") + (j.match ? " <strong>" + FIT[j.match] + ".</strong>" : "") + "</p>" +
      (j.why ? '<p class="why">' + esc(j.why) + "</p>" : "") +
      (j.toward_planning ? '<p class="note">Toward planning: ' + esc(j.toward_planning) + "</p>" : "") +
      (j.notes ? '<p class="note">' + esc(j.notes) + "</p>" : "") +
      '<div class="actions"><button class="btn" data-act="queue" data-id="' + esc(j.id) + '">Queue it</button><button class="quiet" data-act="later" data-id="' + esc(j.id) + '">Later</button><button class="quiet" data-act="skip-for-good" data-id="' + esc(j.id) + '">Skip</button></div></article>';
  }).join("") : '<p class="muted">Nothing new. The daily scan adds jobs here.</p>';
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
var TABS = [["all", "All open"], ["queued", "Queued"], ["later", "Later"], ["sent", "Sent"]];
var CHIPS = [["soon", "Closing this week", "when"], ["easy", "Easy wins", "ease"], ["nyc", "NYC", "city"], ["chicago", "Chicago", "city"], ["elsewhere", "Other cities", "city"],
  ["career", "Career", "kind"], ["everyday", "Everyday", "kind"], ["parttime", "Part-time & seasonal", "hours"], ["gone", "Show skipped & closed", "gone"]];
var STATUS_WORD = { inbox: "new", queued: "queued", later: "later", skipped: "skipped", closed: "closed", applied: "sent" };
var CITY = { nyc: /new york|nyc|brooklyn|queens|bronx|manhattan|staten island|jersey city|hoboken|long island city/i, chicago: /chicago|evanston|oak park/i };
var jTab = store("jobs-tab") || "all", jChips = (store("jobs-chips") || "").split(",").filter(Boolean);
var picked = {}, cursor = null, anchorId = null, shown = [];
if (!TABS.some(function (t) { return t[0] === jTab; })) jTab = "all";

function inTab(j) {
  if (jTab === "sent") return j.status === "applied";
  if (jTab === "queued") return j.status === "queued";
  if (jTab === "later") return j.status === "later";
  if (jChips.indexOf("gone") >= 0 && (j.status === "skipped" || j.status === "closed")) return true;
  return ["inbox", "queued", "later"].indexOf(j.status) >= 0;
}
function chipOk(j, c) {
  var loc = j.location || "";
  switch (c) {
    case "soon": return soon(j);
    case "easy": return safeBet(j) || (j.speed === "fast" && (j.match || 0) >= 4);
    case "nyc": return CITY.nyc.test(loc);
    case "chicago": return CITY.chicago.test(loc);
    case "elsewhere": return !CITY.nyc.test(loc) && !CITY.chicago.test(loc);
    case "career": return j.paths.indexOf("everyday") < 0;
    case "everyday": return j.paths.indexOf("everyday") >= 0;
    case "parttime": return /part[- ]?time|seasonal|temporary|\btemp\b|holiday/i.test(j.title + " " + (j.notes || "") + " " + (j.pay || ""));
  }
  return true;
}
// chips in the same group widen the list (NYC or Chicago); different groups narrow it (NYC and closing this week)
function chipsPass(j) {
  var groups = {};
  CHIPS.forEach(function (c) { if (c[0] !== "gone" && jChips.indexOf(c[0]) >= 0) (groups[c[2]] = groups[c[2]] || []).push(c[0]); });
  return Object.keys(groups).every(function (g) { return groups[g].some(function (c) { return chipOk(j, c); }); });
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
  var d = j.closes ? days(j.closes) : null, right;
  if (jTab === "sent") right = "Sent " + (j.applied_date ? dm(j.applied_date) : "");
  else if (d === null) right = "No closing date";
  else if (d < 0) right = "Closed " + dm(j.closes);
  else right = '<span class="' + (soon(j) ? "soon" : "") + '">' + (d <= 7 ? (d === 0 ? "Closes today" : d === 1 ? "Closes tomorrow" : d + " days left") : "Closes " + dm(j.closes)) + "</span>";
  var bits = [esc(j.employer) + (j.location ? ", " + esc(j.location) : "")];
  if (jTab === "sent") {
    bits.push(replySelect(j));
    bits.push('<button class="quiet" data-act="edit-used" data-id="' + esc(j.id) + '">' + esc(j.email_used || "add the email you used") + "</button>");
  } else {
    if (j.pay) bits.push(esc(j.pay));
    if (j.match) bits.push(FIT_SHORT[j.match]);
    if (jTab === "all" && j.status !== "queued") bits.push('<span class="st">' + STATUS_WORD[j.status] + "</span>");
    if (needsLetter(j)) bits.push('<span class="st">' + (j.cover_file ? "letter made" : "asks for a cover letter") + "</span>");
    var why = sortKey === "next" ? reasonFor(j) : "";
    if (why) bits.push('<span class="nx">' + why + "</span>");
  }
  return '<li class="job' + (picked[j.id] ? " picked" : "") + (cursor === j.id ? " cur" : "") + '" data-id="' + esc(j.id) + '">' +
    '<div class="l1"><a class="t" href="' + esc(safeUrl(j.url)) + '" target="_blank" rel="noopener" data-act="open" data-id="' + esc(j.id) + '">' + esc(j.title) + "</a>" +
    '<span class="r">' + right + '</span><button class="more" data-act="menu" data-id="' + esc(j.id) + '" aria-label="Actions for this job" aria-haspopup="menu">&#8943;</button></div>' +
    '<div class="l2">' + bits.join('<span class="dot"> &middot; </span>') + "</div></li>";
}
function renderJobs() {
  var open = D.jobs.filter(isOpen).length, target = (D.settings.jobs_target || 100) + (D.settings.everyday_target || 0);
  $("j-count").innerHTML = '<span class="count">' + open + "</span> open jobs, aiming for " + target + ". " + jobs("applied").length + " sent so far.";
  var counts = { all: D.jobs.filter(function (j) { return ["inbox", "queued", "later"].indexOf(j.status) >= 0; }).length, queued: jobs("queued").length, later: jobs("later").length, sent: jobs("applied").length };
  $("j-tabs").innerHTML = TABS.map(function (t) {
    return '<button role="tab" data-tab="' + t[0] + '" aria-selected="' + (t[0] === jTab) + '">' + t[1] + '<span class="n">' + counts[t[0]] + "</span></button>";
  }).join("");
  $("j-chips").innerHTML = CHIPS.filter(function (c) { return jTab !== "sent" || c[2] === "city" || c[2] === "kind"; }).filter(function (c) { return c[0] !== "gone" || jTab === "all"; }).map(function (c) {
    return '<button data-chip="' + c[0] + '" aria-pressed="' + (jChips.indexOf(c[0]) >= 0) + '">' + c[1] + "</button>";
  }).join("");
  var list = D.jobs.filter(function (j) { return inTab(j) && chipsPass(j) && searchPass(j); });
  list = jTab === "sent" ? list.sort(function (a, b) { return cmp(b.applied_date, a.applied_date); }) : sorted(list);
  shown = list.map(function (j) { return j.id; });
  Object.keys(picked).forEach(function (id) { if (shown.indexOf(id) < 0) delete picked[id]; });
  $("j-list").innerHTML = list.length ? list.map(jobRow).join("") : '<li class="empty muted">' + (jTab === "queued" ? 'Nothing queued. Queue jobs from the <a href="#inbox">inbox</a>.' : "Nothing matches.") + "</li>";
  renderBulk();
  $("j-sent-extra").hidden = jTab !== "sent";
  if (jTab === "sent") {
    var byId = {}; D.jobs.forEach(function (j) { byId[j.id] = j; });
    $("o-votes").innerHTML = '<thead><tr><th>Date</th><th>Kind</th><th>What</th></tr></thead><tbody>' +
      (D.votes.length ? D.votes.slice().reverse().map(function (v) {
        var j = byId[v.job_id];
        return '<tr><td class="when">' + dm(v.date) + "</td><td>" + esc(VOTE_LABEL[v.type]) + "</td><td>" + (j ? esc(j.employer + ", " + j.title) : esc(v.note)) + "</td></tr>";
      }).join("") : '<tr><td colspan="3" class="muted">None yet.</td></tr>') + "</tbody>";
  }
}
function pickedIds() { return shown.filter(function (id) { return picked[id]; }); }
function renderBulk() {
  var ids = pickedIds(), bar = $("j-bulk");
  bar.hidden = ids.length < 2;
  if (ids.length < 2) return;
  bar.innerHTML = "<span>" + ids.length + " selected</span>" +
    (jTab === "sent" ? "" : '<button data-act="bulk" data-to="queued">Queue</button><button data-act="bulk" data-to="later">Later</button><button data-act="bulk" data-to="skip">Skip</button>') +
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
  var why = prompt(ids.length > 1 ? "Why skip these " + ids.length + "? (optional)" : "Why skip it? (optional: wrong fit, too far...)", "");
  if (why !== null) moveJobs(ids, "skipped", { skip_reason: why });
}
function copy(text, what) { navigator.clipboard.writeText(text).then(function () { toast("Copied " + what + "."); }); }
var toastTimer = null;
function toast(msg, undo) {
  var t = $("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.innerHTML = esc(msg) + (undo ? ' <button type="button">Undo</button>' : "");
  t.hidden = false;
  if (undo) t.querySelector("button").onclick = function () { t.hidden = true; undo(); };
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 6000);
}

/* ---------------- the right-click menu ----------------
   Drawn by the page (the browser's own menu can't hold job actions). One job, several picked, or a sent one
   each get their own list. Arrow keys move, Enter picks, Esc closes, Right opens a sub-list. */
var menuEl = null;
function closeMenu() { document.querySelectorAll(".cmenu").forEach(function (m) { m.remove(); }); menuEl = null; }
function menuFor(ids) {
  var items = [];
  if (ids.length > 1) {
    items.push({ head: ids.length + " jobs", sub: "selected" });
    if (jTab !== "sent") {
      items.push({ label: "Queue them", key: "Q", run: function () { moveJobs(ids, "queued"); } });
      items.push({ label: "Move to later", key: "L", run: function () { moveJobs(ids, "later"); } });
      items.push({ label: "Back to the inbox", run: function () { moveJobs(ids, "inbox"); } });
      items.push({ label: "Skip them\u2026", key: "S", run: function () { skipJobs(ids); } });
      items.push({ sep: true });
    }
    items.push({ label: "Copy their links", run: function () { copy(ids.map(function (id) { return jobById(id).url; }).join("\n"), ids.length + " links"); } });
    items.push({ label: "Clear selection", key: "Esc", run: function () { setPicked(ids, false); } });
    return items;
  }
  var j = jobById(ids[0]); if (!j) return items;
  var f = resumeFile(j);
  items.push({ head: j.title, sub: j.employer + (j.closes ? " \u00b7 " + whenLong(j).toLowerCase() : "") });
  if (j.status !== "applied") items.push({ label: "Do it now", key: "D", run: function () { doNow(j.id); } });
  items.push({ label: "Open the posting", key: "Enter", run: function () { openJob(j); } });
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
    items.push({ label: "I sent it", run: function () { if (confirm("Log " + j.title + " as sent? It counts toward today and lights a light.")) post("vote", { type: "application", job_id: j.id }); } });
  }
  items.push({ sep: true });
  items.push({ label: "Copy link", key: "C", run: function () { copy(j.url, "the link"); } });
  if (j.status !== "applied") items.push({ label: "Copy the email to apply with", run: function () { copy(emailOf(j), emailOf(j)); } });
  if (j.why) items.push({ label: "Copy why I qualify", run: function () { copy(j.why, "why you qualify"); } });
  if (f) items.push({ label: "Show the resume file", run: function () { post("reveal", { file: f }); } });
  items.push({ sep: true });
  items.push({ label: "More from " + j.employer, run: function () { $("j-q").value = j.employer; renderJobs(); } });
  items.push({ label: "Look up " + j.employer, run: function () { window.open("https://duckduckgo.com/?q=" + encodeURIComponent(j.employer + " " + (j.location || "")), "_blank", "noopener"); } });
  if (j.status !== "applied") items.push({ label: "Set the closing date\u2026", run: function () {
    var c = prompt("Closing date (YYYY-MM-DD), or leave empty for none:", j.closes || "");
    if (c !== null && (c === "" || /^\d{4}-\d{2}-\d{2}$/.test(c.trim()))) post("patch_job", { id: j.id, patch: { closes: c.trim() } });
  } });
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
      b.addEventListener("click", function () { closeMenu(); it.run(); });
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
  store("focus", id); store("asking", null); closeMenu();
  var go = function () { location.hash = "#today"; renderToday(); window.scrollTo(0, 0); };
  if (j.status !== "queued") post("patch_job", { id: id, patch: { status: "queued" } }).then(go); else go();
}
function openJob(j) { post("event", { type: "opened", job_id: j.id }); window.open(j.url, "_blank", "noopener"); }

/* clicks, right-clicks and keys on the list */
$("j-list").addEventListener("click", function (e) {
  var li = e.target.closest(".job"); if (!li || e.target.closest("a, button, select")) return;
  var id = li.getAttribute("data-id");
  if (e.shiftKey && anchorId) {
    var a2 = shown.indexOf(anchorId), b2 = shown.indexOf(id);
    setPicked(shown.slice(Math.min(a2, b2), Math.max(a2, b2) + 1), true);
  } else if (e.ctrlKey || e.metaKey) setPicked([id], !picked[id]);
  else setPicked(Object.keys(picked), false);                // a plain click clears a selection, as in a file list
  if (!e.shiftKey) anchorId = id;
  setCursor(id);
});
$("j-list").addEventListener("contextmenu", function (e) {
  var li = e.target.closest(".job"); if (!li) return;
  e.preventDefault();
  var id = li.getAttribute("data-id");
  if (!picked[id]) { picked = {}; setPicked([], true); }
  setCursor(id);
  var ids = pickedIds().length > 1 ? pickedIds() : [id];
  openMenu(ids, e.clientX, e.clientY);
});
document.addEventListener("mousedown", function (e) { if (!e.target.closest(".cmenu")) closeMenu(); });
window.addEventListener("blur", closeMenu);
window.addEventListener("resize", closeMenu);
document.addEventListener("scroll", closeMenu, true);
$("j-tabs").addEventListener("click", function (e) { var b = e.target.closest("[data-tab]"); if (!b) return; jTab = b.getAttribute("data-tab"); store("jobs-tab", jTab); picked = {}; renderJobs(); });
$("j-chips").addEventListener("click", function (e) {
  var b = e.target.closest("[data-chip]"); if (!b) return;
  var c = b.getAttribute("data-chip"), i = jChips.indexOf(c);
  if (i >= 0) jChips.splice(i, 1); else jChips.push(c);
  store("jobs-chips", jChips.join(",")); renderJobs();
});
$("j-q").addEventListener("input", function () { if (D) renderJobs(); });
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
  else if ((k === "q" || k === "Q") && jTab !== "sent") { moveJobs(ids, "queued"); }
  else if ((k === "l" || k === "L") && jTab !== "sent") { moveJobs(ids, "later"); }
  else if ((k === "s" || k === "S") && jTab !== "sent") { skipJobs(ids); }
  else if ((k === "d" || k === "D") && j && j.status !== "applied") { doNow(j.id); }
  else if ((k === "c" || k === "C") && j) { copy(j.url, "the link"); }
  else return;
  e.preventDefault();
});

function renderPathBoards() {
  document.querySelectorAll("[data-jobs]").forEach(function (el) {
    var p = el.getAttribute("data-jobs"), list;
    if (p === "apply-first") list = D.jobs.filter(function (j) { return j.status === "queued" && j.fit === "now"; });
    else list = D.jobs.filter(function (j) { return j.paths.indexOf(p) >= 0 && j.status !== "closed"; });
    list.sort(function (a, b) { return ((FIT_RANK[a.fit] || 0) - (FIT_RANK[b.fit] || 0)) || byDeadline(a, b); });
    el.innerHTML = '<table class="board"><thead><tr><th>Fit</th><th>Job</th><th class="pay">Pay</th><th>Closes</th><th class="hide-sm">Notes</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(function (j) {
        return '<tr><td><span class="tag ' + (TAG_CLASS[j.fit] || "later") + '">' + esc(j.tag || j.fit) + "</span></td><td>" + jobCell(j) + '</td><td class="pay num">' + esc(j.pay || "") + '</td><td class="when' + (soon(j) ? " soon" : "") + '">' + whenShort(j) + '</td><td class="small hide-sm">' + esc(j.notes || j.why || "") + '</td><td class="act">' + stateCell(j) + "</td></tr>";
      }).join("") : '<tr><td colspan="6" class="muted">No open jobs here right now.</td></tr>') + "</tbody></table>";
  });
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
      if (el.closest("#t-act")) store("asking", id);
      return true; // let the link open
    case "sent": store("asking", null); store("focus", null); post("vote", { type: "application", job_id: id }); break;
    case "notyet": store("asking", null); renderToday(); break;
    case "skip":
      var k = "skipped:" + today(), s = (store(k) || "").split(",").filter(Boolean);
      s.push(id); store(k, s.join(",")); store("focus", null); store("asking", null); renderToday(); break;
    case "focus": store("focus", id); store("asking", null); renderToday(); window.scrollTo({ top: 0, behavior: "smooth" }); break;
    case "focus-go": doNow(id); break;
    case "later": post("patch_job", { id: id, patch: { status: "later" } }); break;
    case "queue": post("patch_job", { id: id, patch: { status: "queued" } }); break;
    case "skip-for-good":
      var why = prompt("Why skip it? (optional: wrong fit, too far, casino, defense...)", "");
      if (why !== null) post("patch_job", { id: id, patch: { status: "skipped", skip_reason: why } });
      break;
    case "vote-agency": case "vote-followup":
      var note = prompt(a === "vote-agency" ? "Which recruiter or agency?" : "Who did you write to?", "");
      if (note !== null) post("vote", { type: a.slice(5), note: note });
      break;
    case "exam": var ex = prompt("Which exam?", ""); if (ex) post("event", { type: "exam", note: ex }); break;
    case "undo": if (confirm("Undo the last one you logged?")) post("undo_vote"); break;
    case "reveal": post("reveal", { file: el.getAttribute("data-file") }); break;
    case "edit-cue":
      var c = prompt("When and where do you apply? e.g. After breakfast, at my desk.", D.settings.cue || "");
      if (c) post("settings", { patch: { cue: c } });
      break;
    case "copy-text":
      navigator.clipboard.writeText(el.getAttribute("data-text")).then(function () { el.textContent = "Copied"; setTimeout(function () { el.textContent = "Copy"; }, 1400); });
      break;
    case "edit-email":
      var addr = prompt("The email address you apply with.", D.settings.email || "");
      if (addr && addr.indexOf("@") > 0) post("settings", { patch: { email: addr.trim() } });
      break;
    case "edit-used":
      var used = prompt("Which email address did you use for this application?", el.textContent === "add" ? "" : el.textContent);
      if (used !== null) post("patch_job", { id: id, patch: { email_used: used.trim() } });
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
  if (t.classList.contains("sortpick")) { sortKey = t.value; store("sort-v2", sortKey); render(); return; }
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
  var OLD = { queue: "queued", all: "all", outcomes: "sent" };      // pages merged into Jobs on 2026-10-27
  if (OLD[h]) { jTab = OLD[h]; store("jobs-tab", jTab); if (D) renderJobs(); history.replaceState(null, "", "#jobs"); h = "jobs"; }
  var rbJob = null;
  if (h.indexOf("resume/") === 0) { rbJob = h.slice(7); h = "resume"; }
  if (h.indexOf("letter/") === 0) { rbJob = h.slice(7); h = "letter"; }
  if (PAGES.indexOf(h) < 0) h = "today";
  if (h === "resume" && window.ResumeBuilder) ResumeBuilder.open(rbJob);
  else if (window.ResumeBuilder) ResumeBuilder.leave();
  if (h === "letter" && window.LetterBuilder) LetterBuilder.open(rbJob);
  else if (window.LetterBuilder) LetterBuilder.leave();
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
// the sidebar's size, his to choose (2026-10-28): full, slim (narrower, a smaller house, no caption), or the menu only
var RAIL_SIZES = ["full", "slim", "menu"], RAIL_NAMES = { full: "Sidebar: full", slim: "Sidebar: slim", menu: "Sidebar: menu only" };
function setRail(size) {
  RAIL_SIZES.forEach(function (s) { document.body.classList.toggle("rail-" + s, s === size && s !== "full"); });
  $("railsize").textContent = RAIL_NAMES[size]; store("rail-size", size);
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
Scene.labels(function (k) {
  var v = D && D.votes[k];
  if (!v) return "";
  var j = v.job_id && D.jobs.find(function (x) { return x.id === v.job_id; });
  var what = j ? j.employer + ", " + j.title : (VOTE_LABEL[v.type] + (v.note ? ": " + v.note : ""));
  return what + ". " + dm(v.date) + ".";
});
fetch("/kit.json").then(function (r) { return r.json(); }).then(renderKit).catch(function () {});
window.App = { data: function () { return D; }, post: post, setData: function (d) { D = d; render(); } };   // for the resume builder (resume.js)
show(); load();
fetch("/api/profile", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (p) {
  if (!p.exists) location.hash = "#setup";                     // a new person: first run
  TRADEOFF = (p.prefs || {}).tradeoff || ""; if (D) render();
}).catch(function () {});
loadPaths().then(function () { if (PAGES.indexOf((location.hash || "#").slice(1)) >= 0) show(); });   // a career page opened by its link
})();
