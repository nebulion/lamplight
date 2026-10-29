/* Cover letter builder (v2, 2026-10-27). A business letter in three short paragraphs, built from his own blocks
   (data/resume.json "letters"; his voice, from his 2024 WSP and Alaska Wildland Adventures letters and his resume):
   1. an opening (with the posting's reference number when there is one), a thesis naming what the evidence proves,
      a why, and an optional sentence of his own about the place;
   2. up to three evidence sentences, grouped by job: the first sentence about a job names it, the next ones continue
      from it, so the paragraph reads as one account (v1 pasted whole stories side by side and repeated itself);
   3. a close.
   Picked by the resume builder's fixed rules (title words 3, other job text 1, on the job's path 2) plus the job's
   kind (career or service); no AI. Made into a PDF from his .odt's fonts, laid out as a business letter. */
(function () {
"use strict";

var LIB = null, job = null, spec = null, SC = {};
var TARGET = 250;                                   // words: three short paragraphs (his pick)
var GROUPS = [["openings", "Opening", "one"], ["whys", "Why this work", "one"], ["evidence", "What you've done (in order)", "many"], ["closes", "Close", "one"]];

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function words(t) { return (t.match(/\S+/g) || []).length; }
function L() { return LIB.letters; }
function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : "#"; }

/* ---------------- names as a person would write them ---------------- */
function noParens(s) { return (s || "").replace(/\s*\([^)]*\)/g, "").replace(/\s{2,}/g, " ").trim(); }
function defaultEmployer() {   // "NY State Office of Information Technology Services (ITS)" -> "the NY State Office of Information Technology Services"
  var n = noParens(job ? job.employer : "");
  return /^(NY State|New York State|NYC|New York City|Office|Department|Division|Bureau|Metropolitan|Port Authority|University|City of)\b/i.test(n) ? "the " + n : n;
}
function defaultRef() {        // a posting number the posting asks to quote, e.g. "with 227504 in the subject"
  var t = job ? (job.notes || "") + " " + (job.why || "") : "", m = t.match(/(?:posting|vacancy|job id|requisition|req|subject)\D{0,25}(\d{4,8})|(\d{5,8})\s+in the subject/i);
  return m ? (m[1] || m[2]) : "";
}
/* key facts (his request, 2026-10-27): degree meets the minimum, the schedule, the start date. Read from the job by
   fixed patterns, each one switchable and editable on the page; they open the closing paragraph. */
function jobText() { return job ? [job.title, job.notes, job.why, spec && spec.posting].join(" ") : ""; }
function defaultSchedule() {
  var t = jobText(), m = t.match(/\bMon(?:day)?\s*[-\u2013]\s*Fri(?:day)?(?:,?\s*\d{1,2}(?::\d\d)?\s*(?:am|pm)?\s*[-\u2013]\s*\d{1,2}(?::\d\d)?\s*(?:am|pm)?)?/i);
  if (m) return m[0].replace(/\bMon(day)?\b/i, "Monday").replace(/\bFri(day)?\b/i, "Friday").replace(/\s*[-\u2013]\s*/g, " to ").replace(/Friday\s*,?\s*(\d)/, "Friday, $1");
  m = t.match(/\b(evenings and weekends|nights and weekends|weekends|early mornings|part-time|full-time)\b/i);
  return m ? m[1].toLowerCase() : "";
}
function defaultFacts() {
  var t = jobText();
  return { degree: kind() === "career" && /bachelor|degree|college|credits? of computer/i.test(t), schedule: defaultSchedule(), start: L().facts.defaultStart, useSchedule: false, useStart: true };
}
function factsText() {
  var f = spec.facts, F = L().facts, out = [];
  if (!f) return "";
  if (f.degree) out.push(F.degree);
  var sch = f.useSchedule && f.schedule, st = f.useStart && f.start;
  if (sch && st) out.push(F.both.replace("{schedule}", f.schedule + (f.schedule.indexOf(",") >= 0 ? "," : "")).replace("{start}", f.start));   // "Monday to Friday, 8 to 5, and can start"
  else if (sch) out.push(F.schedule.replace("{schedule}", f.schedule));
  else if (st) out.push(F.start.replace("{start}", f.start));
  return out.join(" ");
}
function names() {
  return { title: spec.jobName || noParens(job ? job.title : "this"), employer: spec.employerName || defaultEmployer() || "your team", ref: spec.ref != null ? spec.ref : defaultRef() };
}
function fill(t) {
  var n = names();
  return t.replace(/\{title\}/g, n.title).replace(/\{employer\}/g, n.employer).replace(/\{ref\}/g, n.ref ? " (posting " + n.ref + ")" : "")
    .replace(/^the /, "The ").replace(/([.!?] )the /g, "$1The ");
}

/* ---------------- scoring: the resume builder's rules ---------------- */
function has(hay, term) {
  if (term.length <= 4) return new RegExp("(^|[^a-z0-9])" + term.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&") + "([^a-z0-9]|$)").test(hay);
  return hay.indexOf(term) >= 0;
}
function kind() { return job && (job.paths || []).indexOf("everyday") >= 0 ? "service" : "career"; }
function score(block) {
  var j = job || {}, title = (j.title || "").toLowerCase(), body = [j.notes, j.why, j.tag, spec && spec.posting].join(" ").toLowerCase();   // not the employer's name: "ITS" isn't intelligent transportation
  var terms = {}; (block.kw || []).forEach(function (k) { terms[k] = 1; }); (block.topics || []).forEach(function (tp) { (LIB.related[tp] || []).forEach(function (k) { terms[k] = 1; }); });
  var s = 0, hits = [];
  Object.keys(terms).forEach(function (t) { if (has(title, t)) { s += 3; hits.push(t); } else if (has(body, t)) { s += 1; hits.push(t); } });
  var pt = {}; (j.paths || []).forEach(function (p) { (LIB.pathTopics[p] || []).forEach(function (x) { pt[x] = 1; }); });
  if ((block.topics || []).some(function (x) { return pt[x]; })) { s += 2; hits.push("your path"); }
  if (block.kind && block.kind !== "any") { if (block.kind === kind()) { s += 4; hits.push(kind() === "service" ? "a service job" : "a career job"); } else s -= 4; }
  return { s: s + (block.star ? 1000 : 0), hits: hits };
}
function rescore() { SC = {}; GROUPS.forEach(function (g) { L()[g[0]].forEach(function (b) { SC[g[0] + "/" + b.id] = score(b); }); }); }
function ranked(group) { return L()[group].filter(function (b) { return !b.block; }).sort(function (a, b) { return SC[group + "/" + b.id].s - SC[group + "/" + a.id].s; }); }
function block(group, id) { return L()[group].find(function (x) { return x.id === id.split("~")[0]; }); }

/* ---------------- the letter's text ---------------- */
function textOf(group, ref, form) {
  var b = block(group, ref), alt = +(ref.split("~")[1] || 0), edit = (spec.edits || {})[group + "/" + ref];
  if (edit) return fill(edit);
  if (form === "first" && b.first && !alt) return fill(b.first);
  return fill(alt ? b.alts[alt - 1] : b.text);
}
function evidenceSentences() {     // the first sentence about a job names it; the next ones about the same job continue
  var prev = null;
  return spec.evidence.map(function (ref) { var b = block("evidence", ref), s = textOf("evidence", ref, b.job === prev ? "next" : "first"); prev = b.job; return s; });
}
function needsList() {
  var n = spec.evidence.map(function (r) { return block("evidence", r).need; });
  return n.length < 2 ? n.join("") : n.slice(0, -1).join(", ") + " and " + n[n.length - 1];
}
function thesis() {
  if (!spec.thesis || !spec.evidence.length) return "";
  var t = L().theses.find(function (x) { return x.kind === kind(); }) || L().theses[0];
  return fill((spec.edits || {})["thesis"] || t.text).replace("{needs}", needsList());
}
function paragraphs() {
  var p1 = [textOf("openings", spec.openings), thesis(), textOf("whys", spec.whys)].concat(spec.place ? [spec.place.trim()] : []).filter(Boolean).join(" ");
  return [p1, evidenceSentences().join(" "), [factsText(), textOf("closes", spec.closes)].filter(Boolean).join(" ")].filter(function (p) { return p.trim(); });
}
function dateLine() { return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
function content() {
  var n = names(), emp = noParens(job ? job.employer : "");
  return {
    sender: L().sender.map(function (s, i) { return i === 1 && spec.location ? spec.location : s; }),
    date: dateLine(),
    recipient: ["Hiring Manager", emp].concat(spec.address != null ? (spec.address ? [spec.address] : []) : (job && job.location ? [noParens(job.location)] : [])).filter(Boolean),
    subject: "Re: " + n.title + (n.ref ? ", posting " + n.ref : ""),
    greeting: spec.greeting || L().greeting, paragraphs: paragraphs(), closing: L().closing, name: L().sender[0],
    signature: !!(SIG.exists && spec.sign !== false)
  };
}
function paperHTML(c) {
  return '<div class="rp-in rp-letter">' + c.sender.map(function (s) { return "<div>" + esc(s) + "</div>"; }).join("") +
    '<p class="sp">' + esc(c.date) + '</p><div class="sp">' + c.recipient.map(function (s) { return "<div>" + esc(s) + "</div>"; }).join("") + "</div>" +
    '<p class="sp"><b>' + esc(c.subject) + '</b></p><p class="sp">' + esc(c.greeting) + "</p>" +
    c.paragraphs.map(function (t) { return '<p class="sp">' + esc(t) + "</p>"; }).join("") +
    '<p class="sp">' + esc(c.closing) + "</p>" +
    (c.signature ? '<img class="rp-sig" alt="" src="/signature.png?v=' + SIG.v + '"><p>' : '<p class="sp2">') + esc(c.name) + "</p></div>";
}

/* ---------------- suggested picks ---------------- */
function suggest() {
  rescore();
  var keep = spec || {};
  var sp = { thesis: true, greeting: L().greeting, place: keep.place || "", posting: keep.posting || "", edits: {}, location: keep.location || "" };
  sp.openings = ranked("openings")[0].id; sp.whys = ranked("whys")[0].id; sp.closes = ranked("closes")[0].id;
  // evidence: the best matches (2+ points), up to three and about 110 words, then grouped by job in order of first appearance
  var picked = [], wordsSoFar = 0;
  ranked("evidence").forEach(function (b) {
    if (picked.length >= 3 || SC["evidence/" + b.id].s < 2) return;
    var w = words(b.first || b.text); if (wordsSoFar + w > 110 && picked.length) return;
    picked.push(b); wordsSoFar += w;
  });
  if (!picked.length) picked.push(ranked("evidence")[0]);
  var jobsOrder = []; picked.forEach(function (b) { if (jobsOrder.indexOf(b.job) < 0) jobsOrder.push(b.job); });
  sp.evidence = picked.slice().sort(function (a, b) { return jobsOrder.indexOf(a.job) - jobsOrder.indexOf(b.job); }).map(function (b) { return b.id; });
  spec = sp;
  sp.facts = defaultFacts();
  sp.facts.useSchedule = !!sp.facts.schedule && sp.closes !== "service";
  return sp;
}

/* ---------------- the page ---------------- */
function render() {
  if (!LIB || !spec) return;
  rescore();
  var html = "";
  GROUPS.forEach(function (g) {
    var group = g[0], picked = g[2] === "one" ? [spec[group]] : spec[group];
    html += '<div class="rb-e on"><p class="rb-eh"><b>' + g[1] + "</b>" + (g[2] === "many" ? ' <span class="small">up to three; each one shows as it reads in the letter</span>' : "") + "</p><ul>";
    var order = g[2] === "many" ? picked.map(function (r) { return block(group, r); }).concat(ranked(group).filter(function (b) { return !picked.some(function (r) { return r.split("~")[0] === b.id; }); })) : ranked(group);
    order.concat(L()[group].filter(function (b) { return b.block; })).forEach(function (b) {
      var ref = picked.find(function (r) { return r.split("~")[0] === b.id; }) || b.id, on = picked.indexOf(ref) >= 0, s = SC[group + "/" + b.id];
      var alt = +(ref.split("~")[1] || 0), n = 1 + b.alts.length, edited = (spec.edits || {})[group + "/" + ref];
      var shown = group === "evidence" && on ? evidenceSentences()[spec.evidence.indexOf(ref)] : textOf(group, ref, "first");
      html += '<li class="rb-b' + (on ? " on" : "") + (b.block ? " blocked" : "") + '" data-g="' + group + '" data-ref="' + esc(ref) + '">' +
        '<input type="' + (g[2] === "one" ? "radio" : "checkbox") + '" name="cl-' + group + '" data-cl="pick"' + (on ? " checked" : "") + (b.block ? " disabled" : "") + ">" +
        '<div><div class="rb-tx" data-cl="edit" title="Click to edit">' + esc(shown) + "</div>" +
        '<div class="rb-m">' + (b.need ? "shows: " + esc(b.need) + " · " : "") + (s.s > 0 ? '<span class="rb-score">' + (s.s >= 1000 ? "always in" : s.s + " points:") + "</span> " + esc(s.hits.slice(0, 5).join(", ")) : "no match with this job") +
        (edited ? " · edited for this letter" : "") + (n > 1 ? ' · <button data-cl="wording">wording ' + (alt + 1) + " of " + n + "</button>" : "") +
        (g[2] === "many" && on ? ' · <button data-cl="up">up</button> <button data-cl="down">down</button>' : "") +
        ' · <button data-cl="star" aria-pressed="' + !!b.star + '">' + (b.star ? "always in" : "always") + '</button> <button data-cl="block" aria-pressed="' + !!b.block + '">' + (b.block ? "never used" : "never") + "</button></div></div></li>";
    });
    html += "</ul></div>";
    if (group === "openings") html += '<div class="rb-e on"><label class="rb-eh"><input type="checkbox" id="cl-thesis"' + (spec.thesis ? " checked" : "") + '> <b>Name what you bring</b></label>' +
      '<p class="rb-tx">' + esc(thesis() || "(off)") + '</p><p class="rb-m">Built from the evidence you pick below; change the evidence to change it.</p></div>';
    if (group === "evidence") {
      var f = spec.facts || (spec.facts = defaultFacts());
      html += '<div class="rb-e on"><p class="rb-eh"><b>Key facts</b> <span class="small">they open the last paragraph</span></p><ul class="cl-facts">' +
        '<li><label><input type="checkbox" id="cl-f-degree"' + (f.degree ? " checked" : "") + "> " + esc(L().facts.degree) + "</label></li>" +
        '<li><label><input type="checkbox" id="cl-f-usesch"' + (f.useSchedule ? " checked" : "") + '> Available to work</label> <input id="cl-f-sch" value="' + esc(f.schedule) + '" placeholder="Monday to Friday, 8 to 5" aria-label="Schedule"></li>' +
        '<li><label><input type="checkbox" id="cl-f-usest"' + (f.useStart ? " checked" : "") + '> Can start</label> <input id="cl-f-st" value="' + esc(f.start) + '" placeholder="right away" aria-label="Start date"></li>' +
        '</ul><p class="rb-tx">' + esc(factsText() || "(none)") + "</p></div>";
    }
    if (group === "whys") html += '<div class="rb-e on"><p class="rb-eh"><b>Why this place</b> <span class="small">optional, one sentence of your own</span></p>' +
      '<textarea id="cl-place" rows="2" class="cl-place" placeholder="e.g. A friend who works there told me how close-knit the staff is.">' + esc(spec.place || "") + "</textarea></div>";
  });
  $("cl-list").innerHTML = html;
  var n = names();
  $("cl-job").value = n.title; $("cl-emp").value = n.employer; $("cl-ref").value = n.ref;
  $("cl-addr").value = spec.address != null ? spec.address : (job && job.location ? noParens(job.location) : "");
  $("cl-greeting").value = spec.greeting || L().greeting;
  $("cl-loc").value = spec.location || L().sender[1];
  $("cl-posting").value = spec.posting || "";
  bar();
  if (!$("cl-modal").hidden) $("cl-paper").innerHTML = paperHTML(content());
}
function bar() {    // word count against the 250-word target, at the bottom of the window
  var w = words(paragraphs().join(" ")), b = $("cl-bar");
  b.classList.toggle("over", w > TARGET);
  b.querySelector(".rb-fill").style.width = Math.min(100, w / TARGET * 100).toFixed(1) + "%";
  b.querySelector(".rb-say").textContent = w + " words" + (w > TARGET ? ", over the " + TARGET + " aim: drop a sentence" : " of about " + TARGET);
}
function changed() { render(); saveDraft(); }
var pending = null;
function saveDraft() { if (!job) return; clearTimeout(pending); pending = setTimeout(function () { window.App.post("patch_job", { id: job.id, patch: { cover_spec: spec } }); }, 1500); }
function saveLib() {   // only the letters part: the resume builder may have changed its own part since we loaded
  return fetch("/api/resume", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (cur) {
    cur.letters = LIB.letters; LIB.entries = cur.entries; LIB.skills = cur.skills;
    return fetch("/api/resume_lib", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lib: cur }) });
  });
}
function move(list, item, d) { var i = list.indexOf(item), j = i + d; if (i < 0 || j < 0 || j >= list.length) return; list.splice(i, 1); list.splice(j, 0, item); }

document.addEventListener("change", function (ev) {
  var el = ev.target; if (!spec || !el.closest("#letter")) return;
  if (el.getAttribute("data-cl") === "pick") {
    var li = el.closest("li"), g = li.getAttribute("data-g"), ref = li.getAttribute("data-ref");
    if (g === "evidence") { if (el.checked) spec.evidence.push(ref); else spec.evidence = spec.evidence.filter(function (r) { return r !== ref; }); }
    else spec[g] = ref;
    return changed();
  }
  var f = { "cl-place": "place", "cl-greeting": "greeting", "cl-loc": "location", "cl-posting": "posting", "cl-job": "jobName", "cl-emp": "employerName", "cl-ref": "ref", "cl-addr": "address" }[el.id];
  if (f) { spec[f] = f === "place" || f === "posting" ? el.value : el.value.trim(); return changed(); }
  if (el.id === "cl-thesis") { spec.thesis = el.checked; return changed(); }
  var ff = { "cl-f-degree": ["degree", "checked"], "cl-f-usesch": ["useSchedule", "checked"], "cl-f-usest": ["useStart", "checked"], "cl-f-sch": ["schedule", "value"], "cl-f-st": ["start", "value"] }[el.id];
  if (ff) { spec.facts = spec.facts || defaultFacts(); spec.facts[ff[0]] = ff[1] === "checked" ? el.checked : el.value.trim(); if (el.id === "cl-f-sch" && el.value.trim()) spec.facts.useSchedule = true; return changed(); }
});
document.addEventListener("click", function (ev) {
  if (ev.target.id === "cl-suggest" && LIB) { spec = suggest(); return changed(); }
  if (ev.target.id === "cl-preview" || ev.target.id === "cl-preview2") return openPreview();
  if (ev.target.id === "cl-close" || ev.target.id === "cl-modal") return closePreview();
  if (ev.target.id === "cl-make") return makePDF();
  var el = ev.target.closest("[data-cl]"); if (!el || !spec || !el.closest("#letter")) return;
  var a = el.getAttribute("data-cl"), li = el.closest("li"), g = li && li.getAttribute("data-g"), ref = li && li.getAttribute("data-ref");
  var b = g && block(g, ref);
  function swapRef(nref) { if (g === "evidence") { var i = spec.evidence.indexOf(ref); if (i >= 0) spec.evidence[i] = nref; else spec.evidence.push(nref); } else spec[g] = nref; }
  if (a === "up" || a === "down") { move(spec.evidence, ref, a === "up" ? -1 : 1); return changed(); }
  if (a === "wording") { var n = 1 + b.alts.length, next = (+(ref.split("~")[1] || 0) + 1) % n; swapRef(next ? b.id + "~" + next : b.id); return changed(); }
  if (a === "star" || a === "block") {
    b[a] = !b[a];
    if (a === "block" && b.block && g === "evidence") spec.evidence = spec.evidence.filter(function (r) { return r.split("~")[0] !== b.id; });
    saveLib(); return changed();
  }
  if (a === "edit" && !el.isContentEditable) { el.contentEditable = "true"; el.focus(); el._was = el.textContent; return; }
  if (a === "keep" || a === "lib" || a === "undo") {
    var nt = li.querySelector(".rb-tx").textContent.trim(), n2 = names();
    nt = nt.split(n2.employer).join("{employer}").split(n2.title).join("{title}");   // keep the placeholders working
    spec.edits = spec.edits || {};
    if (a === "keep") { spec.edits[g + "/" + ref] = nt; swapRef(ref); }
    if (a === "lib") { b.alts.push(nt); delete spec.edits[g + "/" + ref]; swapRef(b.id + "~" + b.alts.length); saveLib(); }
    return changed();
  }
});
document.addEventListener("focusout", function (ev) {
  var el = ev.target;
  if (!el.classList || !el.classList.contains("rb-tx") || !el.isContentEditable || !el.closest("#letter")) return;
  el.contentEditable = "false";
  if (el.textContent.trim() === (el._was || "").trim()) return;
  el.insertAdjacentHTML("afterend", '<div class="rb-ask">Use this wording: <button data-cl="keep">for this letter only</button> <button data-cl="lib">save it to the library as a new wording</button> <button data-cl="undo">undo</button></div>');
});
document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && $("cl-modal") && !$("cl-modal").hidden) closePreview(); });

function openPreview() {
  $("cl-modal").hidden = false; document.body.classList.add("modal-open");
  $("cl-paper").innerHTML = paperHTML(content());
  var box = $("cl-modal").querySelector(".rb-sheet"), barH = box.querySelector(".rb-sheetbar").offsetHeight + 12;
  var s = Math.min(1, (box.clientHeight - barH - 8) / (11 * 96), (box.clientWidth - 24) / (8.5 * 96));
  $("cl-paper").style.setProperty("--s", s.toFixed(3));
  $("cl-paperbox").style.width = (8.5 * 96 * s) + "px"; $("cl-paperbox").style.height = (11 * 96 * s) + "px";
  $("cl-close").focus();
}
function closePreview() { $("cl-modal").hidden = true; document.body.classList.remove("modal-open"); }
function makePDF() {
  var btn = $("cl-make"), note = $("cl-made");
  btn.disabled = true; note.textContent = "Making the PDF… (a few seconds)";
  fetch("/api/letter_make", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_id: job ? job.id : null, spec: spec, content: content() }) })
    .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "error"); return j; }); })
    .then(function (j) {
      btn.disabled = false; closePreview();
      var f = j.result.pdf;
      note.innerHTML = (j.result.pages === 1 ? "Saved, one page: " : '<span class="over">It came out at ' + j.result.pages + " pages; drop a sentence.</span> Saved: ") +
        "<b>" + esc(f.split("/").pop()) + "</b> in resumes/" + esc(f.split("/").slice(0, -1).join("/")) + ' <button class="quiet" data-act="reveal" data-file="' + esc(f) + '">Show file</button>' +
        (job ? ' <span class="small">Today will say to attach it for this job.</span>' : "");
      if (j.data) window.App.setData(j.data);
    })
    .catch(function (err) { btn.disabled = false; note.textContent = "That didn't work: " + err.message; });
}
/* ---------------- signature (2026-10-27): drawn once here, saved as data/signature.png, placed above the typed name ---------------- */
var SIG = { exists: false, v: 0 };
function loadSig() {
  return fetch("/api/signature", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (s) { SIG = s; sigLine(); }).catch(function () {});
}
function sigLine() {
  var el = $("cl-sig"); if (!el) return;
  if (!SIG.exists) { el.innerHTML = 'No signature on file yet. <button class="btn" type="button" data-sig="draw">Draw your signature</button> <span class="small">It goes above your typed name.</span>'; return; }
  el.innerHTML = '<label><input type="checkbox" id="cl-sig-use"' + (spec && spec.sign === false ? "" : " checked") + '> Sign this letter</label> ' +
    '<img class="sig-thumb" alt="Your signature" src="/signature.png?v=' + SIG.v + '"> <button class="quiet" type="button" data-sig="draw">Redraw</button> <button class="quiet" type="button" data-sig="clear">Remove</button>';
}
var pad = null;
function openPad() {
  var m = $("sig-modal"), cv = $("sig-pad"); m.hidden = false; document.body.classList.add("modal-open");
  var r = cv.getBoundingClientRect(), k = 2;
  cv.width = Math.round(r.width * k); cv.height = Math.round(r.height * k);
  var g = cv.getContext("2d"); g.lineCap = g.lineJoin = "round"; g.strokeStyle = g.fillStyle = "#1b2133";
  pad = { g: g, k: k, strokes: 0, last: null, w: 0, box: [1e9, 1e9, -1e9, -1e9] };
  $("sig-save").disabled = true;
}
function closePad() { $("sig-modal").hidden = true; document.body.classList.remove("modal-open"); pad = null; }
function padPoint(e) { var r = $("sig-pad").getBoundingClientRect(); return { x: (e.clientX - r.left) * pad.k, y: (e.clientY - r.top) * pad.k, t: e.timeStamp }; }
function grow(p, w) { var b = pad.box; b[0] = Math.min(b[0], p.x - w); b[1] = Math.min(b[1], p.y - w); b[2] = Math.max(b[2], p.x + w); b[3] = Math.max(b[3], p.y + w); }
document.addEventListener("pointerdown", function (e) {
  if (!pad || e.target.id !== "sig-pad") return;
  e.preventDefault(); e.target.setPointerCapture(e.pointerId);
  var p = padPoint(e); pad.last = p; pad.mid = p; pad.w = 2.6 * pad.k;
  pad.g.beginPath(); pad.g.arc(p.x, p.y, pad.w / 2, 0, Math.PI * 2); pad.g.fill(); grow(p, pad.w);
  pad.strokes++; $("sig-save").disabled = false;
});
document.addEventListener("pointermove", function (e) {
  if (!pad || !pad.last || e.target.id !== "sig-pad") return;
  var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  (evs.length ? evs : [e]).forEach(function (ev) {
    var p = padPoint(ev), a = pad.last, d = Math.hypot(p.x - a.x, p.y - a.y);
    if (d < 1) return;
    // faster strokes come out thinner, like a pen; curves through the midpoints keep it smooth
    var speed = d / Math.max(1, p.t - a.t), w = Math.max(1.3, Math.min(3.2, 3.4 - speed * 0.55)) * pad.k;
    pad.w = pad.w * 0.7 + w * 0.3;
    var mid = { x: (a.x + p.x) / 2, y: (a.y + p.y) / 2 };
    pad.g.lineWidth = pad.w; pad.g.beginPath(); pad.g.moveTo(pad.mid.x, pad.mid.y); pad.g.quadraticCurveTo(a.x, a.y, mid.x, mid.y); pad.g.stroke();
    grow(p, pad.w); pad.mid = mid; pad.last = p;
  });
});
document.addEventListener("pointerup", function () { if (pad) pad.last = null; });
function savePad() {
  var b = pad.box, cv = $("sig-pad"), padPx = 6 * pad.k;
  var x0 = Math.max(0, Math.floor(b[0] - padPx)), y0 = Math.max(0, Math.floor(b[1] - padPx)), x1 = Math.min(cv.width, Math.ceil(b[2] + padPx)), y1 = Math.min(cv.height, Math.ceil(b[3] + padPx));
  var out = document.createElement("canvas"); out.width = x1 - x0; out.height = y1 - y0;
  out.getContext("2d").drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);   // cropped to the ink
  $("sig-save").disabled = true;
  fetch("/api/signature_save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ png: out.toDataURL("image/png") }) })
    .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "error"); return j; }); })
    .then(function (j) { SIG = { exists: true, v: j.result.v }; if (spec) delete spec.sign; closePad(); sigLine(); })
    .catch(function (err) { $("sig-save").disabled = false; $("sig-msg").textContent = "Not saved: " + err.message; });
}
document.addEventListener("click", function (e) {
  var b = e.target.closest && e.target.closest("[data-sig]");
  if (!b) return;
  var what = b.getAttribute("data-sig");
  if (what === "draw") openPad();
  else if (what === "clear") {
    if (!confirm("Remove your signature? Letters you already made keep theirs.")) return;
    fetch("/api/signature_clear", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(function () { SIG = { exists: false, v: 0 }; sigLine(); });
  }
  else if (what === "reset") { closePad(); openPad(); $("sig-msg").textContent = ""; }
  else if (what === "save") savePad();
  else if (what === "cancel") closePad();
});
document.addEventListener("change", function (e) { if (e.target.id === "cl-sig-use" && spec) { spec.sign = e.target.checked; } });
document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && pad) closePad(); });

function open(jobId) {
  var go = function () {
    var D = window.App.data();
    job = jobId ? D.jobs.find(function (j) { return j.id === jobId; }) || null : null;
    spec = null;
    if (job && job.cover_spec && job.cover_spec.evidence) spec = clone(job.cover_spec); else spec = suggest();   // v1 drafts (stories) start over
    $("cl-for").innerHTML = job ? 'For <a href="' + esc(safeUrl(job.url)) + '" target="_blank" rel="noopener" title="Open the posting">' + esc(job.title) + "</a> at " + esc(job.employer) +
      ' <a class="quiet" href="#jobs">Change job</a>' : 'A general letter, not for a particular job. <a class="quiet" href="#jobs">Pick a job</a> <span class="small">(right-click it)</span>';
    $("cl-made").innerHTML = job && job.cover_file ? 'Last made: <b>' + esc(job.cover_file.split("/").pop()) + "</b> in resumes/" + esc(job.cover_file.split("/").slice(0, -1).join("/")) + ' <button class="quiet" data-act="reveal" data-file="' + esc(job.cover_file) + '">Show file</button>' : "";
    closePreview();
    render();
    sigLine();
  };
  if (!window.App.data()) return setTimeout(function () { open(jobId); }, 200);
  loadSig();
  if (LIB) go(); else fetch("/api/resume", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (l) { LIB = l; go(); });
}
window.LetterBuilder = { open: open, leave: closePreview };
})();
