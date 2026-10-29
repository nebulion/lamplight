/* Resume builder (2026-10-27). Picks bullets for a job by fixed rules (no AI), shows the page live in the look
   of his .odt resumes, measures whether it fits on one page, suggests cuts when it doesn't, and has the server
   lay out the real PDF from the .odt (app/make_resumes.py), checking its page count.
   Scoring: each bullet's keywords and topic words are looked for in the job's title (+3 each), the rest of its
   text and any pasted posting (+1 each), plus 2 if the bullet's topic is one of the job's paths. Starred bullets
   always go in; blocked ones never do. The library is data/resume.json. */
(function () {
"use strict";

var LIB = null, job = null, spec = null, SC = {}, CTX = null, pendingSave = null;
var PAGE_H = (11 - 0.5 - 0.2374) * 96;           // the .odt's text area, in CSS px
var MIN_ADD = 2;                                   // a bullet needs 2+ points to be added (1 point was filler: a stray word match)
var LINE = 14.15 * 96 / 72;                       // one line: 12 pt Garamond at 105% of its natural height, measured in the real PDFs

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function entryById(id) { return LIB.entries.find(function (e) { return e.id === id; }); }
function bulletOf(e, ref) { var id = ref.split("~")[0]; return e.bullets.find(function (b) { return b.id === id; }); }
function skillById(id) { return LIB.skills.find(function (s) { return s.id === id; }); }

/* ---------------- scoring (fixed rules) ---------------- */
function has(hay, term) {
  if (term.length <= 4) return new RegExp("(^|[^a-z0-9])" + term.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&") + "([^a-z0-9]|$)").test(hay);   // short words count whole only ("pos" isn't in "position")
  return hay.indexOf(term) >= 0;
}
function context() {
  var j = job || {};
  return {
    title: (j.title || "").toLowerCase(),
    body: [j.notes, j.why, j.tag, spec && spec.posting].join(" ").toLowerCase(),   // not the employer or address: "ITS" in a state agency's name isn't transit ITS
    paths: j.paths || []
  };
}
function termsFor(topics, kw) {
  var t = {};
  (kw || []).forEach(function (k) { t[k] = 1; });
  topics.forEach(function (tp) { (LIB.related[tp] || []).forEach(function (k) { t[k] = 1; }); });
  return Object.keys(t);
}
function scoreOf(topics, kw) {
  var s = 0, hits = [];
  termsFor(topics, kw).forEach(function (t) {
    if (has(CTX.title, t)) { s += 3; hits.push(t); } else if (has(CTX.body, t)) { s += 1; hits.push(t); }
  });
  var pt = {}; CTX.paths.forEach(function (p) { (LIB.pathTopics[p] || []).forEach(function (x) { pt[x] = 1; }); });
  if (topics.some(function (x) { return pt[x]; })) { s += 2; hits.push("your path"); }
  return { s: s, hits: hits };
}
function rescore() {
  CTX = context(); SC = {};
  LIB.entries.forEach(function (e) { e.bullets.forEach(function (b) { SC[e.id + "/" + b.id] = scoreOf(b.topics, b.kw); }); });
  LIB.skills.forEach(function (s) { SC["skill/" + s.id] = scoreOf(s.topics, []); });
}
function sc(e, ref) { return SC[e.id + "/" + ref.split("~")[0]] || { s: 0, hits: [] }; }

/* ---------------- the selection -> the page ---------------- */
function resolve(sp) {
  var ed = sp.edits || {};
  function entry(sel) {
    var e = entryById(sel.id);
    return { id: e.id, title: sel.title || e.title, dates: e.dates || "", employer: e.employer || "", tools: sel.tools != null ? sel.tools : (e.tools || ""),
      bullets: sel.bullets.map(function (ref) { var b = bulletOf(e, ref), alt = +(ref.split("~")[1] || 0); return { ref: ref, text: ed[ref] || (alt ? b.alts[alt - 1] : b.text) }; }) };
  }
  return {
    location: sp.location || LIB.header.location, projectsFirst: !!sp.projectsFirst,
    experience: (sp.entries || []).map(entry), projects: (sp.projects || []).map(entry),
    skills: (sp.skills || []).map(function (s) { var L = skillById(s.id); return { id: s.id, label: s.label || L.label, text: s.text || L.text }; }),
    languages: LIB.languages
  };
}
function forServer(c) {
  function plain(list) { return list.map(function (e) { return { title: e.title, dates: e.dates, employer: e.employer, tools: e.tools, bullets: e.bullets.map(function (b) { return b.text; }) }; }); }
  return { location: c.location, projectsFirst: c.projectsFirst, experience: plain(c.experience), projects: plain(c.projects),
    skills: c.skills.map(function (s) { return { label: s.label, text: s.text }; }), languages: c.languages };
}
function paperHTML(c) {
  var pipe = ' <span class="rp-pipe">|</span> ';
  function row(l, r, cls) { return '<div class="rp-row' + (cls ? " " + cls : "") + '"><span>' + l + "</span><span>" + (r || "") + "</span></div>"; }
  function head(t) { return '<div class="rp-h">' + t + "</div>"; }
  function entries(list) {
    return list.map(function (e, i) {
      return '<div class="rp-entry' + (i ? "" : " first") + '">' + row("<b>" + esc(e.title) + "</b>", esc(e.dates)) + row(esc(e.employer), esc(e.tools), "rp-emp") +
        "<ul>" + e.bullets.map(function (b) { return '<li data-ref="' + esc(e.id + "/" + b.ref) + '">' + esc(b.text) + "</li>"; }).join("") + "</ul></div>";
    }).join("");
  }
  var exp = head("EXPERIENCE") + entries(c.experience), proj = c.projects.length ? head("PROJECTS") + entries(c.projects) : "";
  var ED = LIB.education || {};
  return '<div class="rp-in"><div class="rp-name">' + esc(LIB.header.name) + "</div>" +
    '<div class="rp-contact">' + LIB.header.contact.split(" | ").map(esc).join(pipe) + pipe + esc(c.location) + "</div>" +
    head("EDUCATION") + row("<b>" + esc(ED.degree || "") + "</b>", esc(ED.date || "")) + row((ED.school || "").split(" | ").map(esc).join(pipe), ED.gpa ? "GPA: " + esc(ED.gpa) : "") +   // resume.json "education"
    (c.projectsFirst ? proj + exp : exp + proj) + head("SKILLS") +
    c.skills.map(function (s, i) { return (i ? '<div class="rp-gap"></div>' : "") + '<div class="rp-sl">' + esc(s.label) + '</div><div class="rp-st">' + esc(s.text) + "</div>"; }).join("") +
    '<div class="rp-lang"><b>Spoken Languages: </b>' + esc(c.languages) + "</div></div>";
}
// lay a selection out in the hidden measurer; how many px past (or short of) one page?
function overBy(sp) {
  var m = $("rb-measure");
  m.innerHTML = paperHTML(resolve(sp));
  return m.firstChild.offsetHeight - PAGE_H;
}
function linesOf(text) {
  var m = $("rb-measure");
  m.innerHTML = '<div class="rp-in"><ul><li>' + esc(text) + "</li></ul></div>";
  return Math.round(m.querySelector("li").offsetHeight / LINE);
}

/* ---------------- suggested picks ---------------- */
function listFor(sp, e) { return e.kind === "project" ? (sp.projects = sp.projects || []) : sp.entries; }
function selOf(sp, e) { return listFor(sp, e).find(function (s) { return s.id === e.id; }); }
function addRef(sp, e, ref) {
  var list = listFor(sp, e), sel = selOf(sp, e);
  if (!sel) {
    sel = { id: e.id, bullets: [] };
    var order = LIB.entries.map(function (x) { return x.id; });
    var at = list.findIndex(function (s) { return order.indexOf(s.id) > order.indexOf(e.id); });
    if (at < 0) list.push(sel); else list.splice(at, 0, sel);
  }
  if (sel.bullets.indexOf(ref) < 0) sel.bullets.push(ref);
}
function suggest() {
  rescore();
  var sp = { location: LIB.header.location, entries: [], projects: [], skills: [], projectsFirst: false, edits: {}, posting: spec ? spec.posting || "" : "" };
  var cands = [];
  LIB.entries.forEach(function (e) { e.bullets.forEach(function (b) { if (!b.block) cands.push({ e: e, b: b, s: SC[e.id + "/" + b.id].s + (b.star ? 1000 : 0) }); }); });
  cands.sort(function (a, b) { return b.s - a.s; });
  // the jobs that keep the timeline whole go in first, with their best bullets
  LIB.entries.filter(function (e) { return e.core; }).forEach(function (e) {
    var mine = cands.filter(function (c) { return c.e === e; });
    if (!mine.length || mine[0].s < MIN_ADD) mine = e.bullets.filter(function (b) { return !b.block; }).map(function (b) { return { b: b }; });
    mine.slice(0, e.min || 1).forEach(function (c) { addRef(sp, e, c.b.id); });
  });
  // skills: the best-matching two lines; service jobs default to the guest and outdoors lines
  var lines = LIB.skills.map(function (s) { return { id: s.id, s: SC["skill/" + s.id].s }; }).sort(function (a, b) { return b.s - a.s; }).filter(function (x) { return x.s > 0; }).slice(0, 2);
  var everyday = CTX.paths.indexOf("everyday") >= 0;
  (everyday ? ["guest", "outdoors"] : ["sys", "sw"]).concat(LIB.skills.map(function (k) { return k.id; })).forEach(function (id) {   // his usual lines, else anyone's first ones
    if (lines.length < 2 && skillById(id) && !lines.some(function (x) { return x.id === id; })) lines.push({ id: id });
  });
  sp.skills = lines.map(function (x) { var t = orderItems(skillById(x.id).text); return t === skillById(x.id).text ? { id: x.id } : { id: x.id, text: t }; });
  // then everything that matches, best first, while it still fits on the page
  cands.forEach(function (c) {
    if (c.s < MIN_ADD || (selOf(sp, c.e) && selOf(sp, c.e).bullets.indexOf(c.b.id) >= 0)) return;
    var trial = clone(sp); addRef(trial, c.e, c.b.id);
    if (overBy(trial) <= 0) sp = trial;
  });
  sp.projectsFirst = sp.projects.length > 0 && (CTX.paths.indexOf("gis") >= 0 || /gis|map|planning|planner|spatial/.test(CTX.title));
  sortBullets(sp);
  return sp;
}
// a skill line's items, the ones the job mentions first ("Active Directory" before "Axess" for a help desk)
function orderItems(text) {
  var items = text.split(/,\s*(?![^()]*\))/), hay = CTX.title + " " + CTX.body;
  function hit(item) { return item.toLowerCase().replace(/\(.*?\)/g, " ").split(/[^a-z0-9+#.]+/).some(function (w) { return w.length >= 3 && has(hay, w); }); }
  var a = items.filter(hit), b = items.filter(function (x) { return !hit(x); });
  return a.concat(b).join(", ");
}
// the posting's words (from the scoring vocabulary) that the resume never uses: add them only where they're true
function gapWords(c) {
  var vocab = {}, text = JSON.stringify(c).toLowerCase(), hay = CTX.title + " " + CTX.body, out = [];
  var skip = { lead: 1, field: 1, host: 1, its: 1, data: 1, application: 1, train: 1, research: 1, associate: 1, server: 1, sales: 1, member: 1, operations: 1, install: 1, engineer: 1, software: 1 };
  Object.keys(LIB.related).forEach(function (k) { LIB.related[k].forEach(function (w) { vocab[w] = 1; }); });
  LIB.entries.forEach(function (e) { e.bullets.forEach(function (b) { b.kw.forEach(function (w) { vocab[w] = 1; }); }); });
  Object.keys(vocab).forEach(function (w) { if (w.length >= 3 && !skip[w] && has(hay, w) && !has(text, w)) out.push(w); });
  out = out.filter(function (w) { return !out.some(function (o) { return o !== w && (o.indexOf(w) >= 0 || (w.length > 5 && o.indexOf(w.slice(0, -3)) === 0)); }); });   // "desktop" inside "desktop support"; "onboard" next to "onboarding"
  return out.slice(0, 10);
}
function sortBullets(sp) {   // within each job, the best match first
  sp.entries.concat(sp.projects || []).forEach(function (sel) {
    var e = entryById(sel.id);
    sel.bullets.sort(function (a, b) { return sc(e, b).s - sc(e, a).s; });
  });
}

/* ---------------- when it runs over: what to cut, cheapest first ---------------- */
function suggestions(over) {
  var out = [], linesNeeded = Math.ceil(over / LINE);
  overBy(spec);
  var measured = {};
  document.querySelectorAll("#rb-measure li[data-ref]").forEach(function (li) { measured[li.getAttribute("data-ref")] = Math.round(li.offsetHeight / LINE); });
  spec.entries.concat(spec.projects || []).forEach(function (sel) {
    var e = entryById(sel.id);
    sel.bullets.forEach(function (ref) {
      var b = bulletOf(e, ref), lines = measured[e.id + "/" + ref] || 1, cur = +(ref.split("~")[1] || 0);
      [b.text].concat(b.alts).forEach(function (t, i) {
        if (i === cur || (spec.edits || {})[ref]) return;
        var saves = lines - linesOf(t);
        if (saves > 0) out.push({ kind: "swap", e: e, ref: ref, to: i ? b.id + "~" + i : b.id, saves: saves, text: "Use the shorter wording of “" + clip(t) + "”", why: "saves " + saves + (saves === 1 ? " line" : " lines") });
      });
      var protectedWhy = b.star ? "starred" : sel.bullets.length <= 1 ? "its only bullet" : (e.min && sel.bullets.length <= e.min) ? "keeps " + e.title + " at " + e.min : "";
      if (!protectedWhy) {
        var s = sc(e, ref).s;
        out.push({ kind: "drop", e: e, ref: ref, saves: lines, vpl: s / lines, text: "Drop “" + clip(b.text) + "”", why: (s ? s + " points" : "no match with this job") + ", " + lines + (lines === 1 ? " line" : " lines") });
      }
    });
  });
  // a few shorter wordings (they keep the fact), then the cuts that cost the least per line saved
  var swaps = out.filter(function (x) { return x.kind === "swap"; }).sort(function (a, b) { return b.saves - a.saves; });
  var drops = out.filter(function (x) { return x.kind === "drop"; }).sort(function (a, b) { return a.vpl - b.vpl || b.saves - a.saves; });
  return { list: swaps.slice(0, linesNeeded > 3 ? 2 : 3).concat(drops.slice(0, 4)), need: linesNeeded };
}
function clip(t) { return t.length > 64 ? t.slice(0, 62).replace(/\s+\S*$/, "") + "…" : t; }

/* ---------------- the page ---------------- */
function render() {
  if (!LIB || !spec) return;
  rescore();
  var c = resolve(spec);
  if (!$("rb-modal").hidden) $("rb-paper").innerHTML = paperHTML(c);
  var over = overBy(spec), used = $("rb-measure").firstChild.offsetHeight;
  // the page-length bar pinned to the bottom of the window (he wanted the checkmarks first, the length out of the way)
  var bar = $("rb-bar"), pct = Math.min(100, used / PAGE_H * 100);
  bar.classList.toggle("over", over > 0);
  bar.querySelector(".rb-fill").style.width = pct.toFixed(1) + "%";
  if (over <= 0) { var left = Math.floor(-over / LINE); bar.querySelector(".rb-say").textContent = left ? left + (left === 1 ? " line" : " lines") + " left on the page" : "Exactly one page"; }
  else { var n = Math.ceil(over / LINE); bar.querySelector(".rb-say").textContent = n + (n === 1 ? " line" : " lines") + " over one page"; }
  $("rb-fixbtn").hidden = over <= 0;
  var gaps = job ? gapWords(c) : [];
  $("rb-gaps").innerHTML = gaps.length ? "The posting mentions <b>" + gaps.map(esc).join(", ") + "</b>, which your resume never says. Where it's true, edit a bullet to use the posting's word." : "";
  if (over <= 0) $("rb-sugg").hidden = true;
  var sg = $("rb-sugg");
  if (over > 0) {
    var s = suggestions(over);
    sg.innerHTML = '<p class="small">To fit, cut about ' + s.need + (s.need === 1 ? " line" : " lines") + ". Cheapest first:</p><ul>" + s.list.map(function (x, i) {
      return '<li><button data-rb="apply" data-i="' + i + '">' + esc(x.text) + '</button> <span class="small">' + esc(x.why) + "</span></li>";
    }).join("") + "</ul>";
    sg._list = s.list;
  } else { sg.innerHTML = ""; sg._list = []; }
  renderSide();
  $("rb-loc").value = spec.location || LIB.header.location;
  $("rb-pfirst").checked = !!spec.projectsFirst;
  $("rb-posting").value = spec.posting || "";
}
function renderSide() {
  var html = "";
  LIB.entries.forEach(function (e) {
    var sel = selOf(spec, e), on = !!sel, refs = sel ? sel.bullets.slice() : [];
    var rest = e.bullets.filter(function (b) { return !refs.some(function (r) { return r.split("~")[0] === b.id; }); }).sort(function (a, b) { return sc(e, b.id).s - sc(e, a.id).s; }).map(function (b) { return b.id; });
    html += '<div class="rb-e' + (on ? " on" : "") + '" id="rb-e-' + e.id + '" data-toc="' + esc(tocName(e)) + '"><label class="rb-eh"><input type="checkbox" data-rb="entry" data-e="' + e.id + '"' + (on ? " checked" : "") + "> <b>" + esc(e.title) + "</b>" +
      '<span class="small"> ' + esc((e.kind === "project" ? "project · " : "") + e.employer + (e.dates ? ", " + e.dates : "")) + "</span></label><ul>";
    refs.concat(rest).forEach(function (ref) {
      var b = bulletOf(e, ref), picked = refs.indexOf(ref) >= 0, s = sc(e, ref), alt = +(ref.split("~")[1] || 0), n = 1 + b.alts.length;
      var edited = spec.edits && spec.edits[ref], text = edited || (alt ? b.alts[alt - 1] : b.text);
      html += '<li class="rb-b' + (picked ? " on" : "") + (b.block ? " blocked" : "") + '" data-e="' + e.id + '" data-ref="' + esc(ref) + '">' +
        '<input type="checkbox" data-rb="bullet"' + (picked ? " checked" : "") + (b.block ? " disabled" : "") + ' aria-label="Use this bullet">' +
        '<div><div class="rb-tx" data-rb="edit" title="Click to edit">' + esc(text) + "</div>" +
        '<div class="rb-m">' + (s.s ? '<span class="rb-score">' + s.s + " points:</span> " + esc(s.hits.slice(0, 5).join(", ")) : "no match with this job") +
        (edited ? " · edited for this resume" : "") +
        (n > 1 ? ' · <button data-rb="wording">wording ' + (alt + 1) + " of " + n + "</button>" : "") +
        (picked ? ' · <button data-rb="up" aria-label="Move up">up</button> <button data-rb="down" aria-label="Move down">down</button>' : "") +
        ' · <button data-rb="star" aria-pressed="' + !!b.star + '">' + (b.star ? "always in" : "always") + '</button> <button data-rb="block" aria-pressed="' + !!b.block + '">' + (b.block ? "never used" : "never") + "</button></div></div></li>";
    });
    html += "</ul></div>";
  });
  // skill lines
  html += '<div class="rb-e on" id="rb-e-skills" data-toc="Skills"><p class="rb-eh"><b>Skills</b> <span class="small">two lines usually fit</span></p><ul>';
  var chosen = spec.skills.map(function (s) { return s.id; });
  chosen.concat(LIB.skills.map(function (s) { return s.id; }).filter(function (id) { return chosen.indexOf(id) < 0; })).forEach(function (id) {
    var L = skillById(id), sel = spec.skills.find(function (s) { return s.id === id; }), on = !!sel, s = SC["skill/" + id];
    html += '<li class="rb-b' + (on ? " on" : "") + '" data-skill="' + id + '"><input type="checkbox" data-rb="skill"' + (on ? " checked" : "") + ' aria-label="Use this line">' +
      "<div><b>" + esc((sel && sel.label) || L.label) + '</b><textarea data-rb="skilltext" rows="2">' + esc((sel && sel.text) || L.text) + "</textarea>" +
      '<div class="rb-m">' + (s.s ? '<span class="rb-score">' + s.s + " points</span>" : "no match") + (on ? ' · <button data-rb="sup">up</button> <button data-rb="sdown">down</button>' : "") +
      ' · <button data-rb="skillsave">save this text to the library</button></div></div></li>';
  });
  html += "</ul></div>";
  $("rb-list").innerHTML = html;
  renderToc();
}

/* ---------------- changes ---------------- */
function changed() { render(); saveDraft(); }
function saveDraft() {           // keep the work-in-progress on the job, a moment after the last change
  if (!job) return;
  clearTimeout(pendingSave);
  pendingSave = setTimeout(function () { window.App.post("patch_job", { id: job.id, patch: { resume_spec: spec } }); }, 1500);
}
function saveLib() {   // only the resume part: the cover letter builder may have changed its own part since we loaded
  return fetch("/api/resume", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (cur) {
    cur.entries = LIB.entries; cur.skills = LIB.skills; LIB.letters = cur.letters;
    return fetch("/api/resume_lib", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lib: cur }) });
  });
}
function move(list, item, d) { var i = list.indexOf(item), j = i + d; if (i < 0 || j < 0 || j >= list.length) return; list.splice(i, 1); list.splice(j, 0, item); }

document.addEventListener("click", function (ev) {
  var el = ev.target.closest("[data-rb]"); if (!el || !spec) return;
  var a = el.getAttribute("data-rb"), li = el.closest("li"), e = li && li.getAttribute("data-e") ? entryById(li.getAttribute("data-e")) : null;
  var ref = li && li.getAttribute("data-ref"), sel = e && selOf(spec, e);
  if (a === "apply") {
    var x = $("rb-sugg")._list[+el.getAttribute("data-i")], s2 = selOf(spec, x.e);
    if (x.kind === "swap") s2.bullets[s2.bullets.indexOf(x.ref)] = x.to; else s2.bullets.splice(s2.bullets.indexOf(x.ref), 1);
    return changed();
  }
  if (a === "wording") {
    var b = bulletOf(e, ref), n = 1 + b.alts.length, cur = +(ref.split("~")[1] || 0), next = (cur + 1) % n, nref = next ? b.id + "~" + next : b.id;
    if (sel && sel.bullets.indexOf(ref) >= 0) sel.bullets[sel.bullets.indexOf(ref)] = nref;
    else { addRef(spec, e, nref); }
    return changed();
  }
  if (a === "up" || a === "down") { move(sel.bullets, ref, a === "up" ? -1 : 1); return changed(); }
  if (a === "star" || a === "block") {
    var bb = bulletOf(e, ref); bb[a] = !bb[a];
    if (a === "block" && bb.block && sel) sel.bullets = sel.bullets.filter(function (r) { return r.split("~")[0] !== bb.id; });
    if (a === "star" && bb.star && !(sel && sel.bullets.indexOf(ref) >= 0)) addRef(spec, e, ref);
    saveLib(); return changed();
  }
  var sk = li && li.getAttribute("data-skill");
  if ((a === "sup" || a === "sdown") && sk) { var item = spec.skills.find(function (s) { return s.id === sk; }); move(spec.skills, item, a === "sup" ? -1 : 1); return changed(); }
  if (a === "skillsave" && sk) { var t = li.querySelector("textarea").value.trim(); skillById(sk).text = t; var it2 = spec.skills.find(function (s) { return s.id === sk; }); if (it2) delete it2.text; saveLib(); return changed(); }
  if (a === "edit" && !el.isContentEditable) { el.contentEditable = "true"; el.focus(); el._was = el.textContent; }
  if (a === "keep" || a === "lib" || a === "undo") {
    var box = li.querySelector(".rb-tx"), nt = box.textContent.trim(), b2 = bulletOf(e, ref);
    spec.edits = spec.edits || {};
    if (a === "keep") { spec.edits[ref] = nt; if (!(sel && sel.bullets.indexOf(ref) >= 0)) addRef(spec, e, ref); }
    if (a === "lib") {
      b2.alts.push(nt); var r2 = b2.id + "~" + b2.alts.length; delete spec.edits[ref];
      if (sel && sel.bullets.indexOf(ref) >= 0) sel.bullets[sel.bullets.indexOf(ref)] = r2; else addRef(spec, e, r2);
      saveLib();
    }
    return changed();
  }
});
document.addEventListener("focusout", function (ev) {
  var el = ev.target;
  if (!el.classList || !el.classList.contains("rb-tx") || !el.isContentEditable) return;
  el.contentEditable = "false";
  if (el.textContent.trim() === (el._was || "").trim()) return;
  el.insertAdjacentHTML("afterend", '<div class="rb-ask">Use this wording: <button data-rb="keep">for this resume only</button> <button data-rb="lib">save it to the library as a new wording</button> <button data-rb="undo">undo</button></div>');
});
document.addEventListener("change", function (ev) {
  var el = ev.target; if (!spec || !el.closest("#resume")) return;
  var a = el.getAttribute("data-rb"), li = el.closest("li");
  if (a === "entry") {
    var e = entryById(el.getAttribute("data-e"));
    if (el.checked) { e.bullets.slice().sort(function (x, y) { return sc(e, y.id).s - sc(e, x.id).s; }).filter(function (b) { return !b.block; }).slice(0, 1).forEach(function (b) { addRef(spec, e, b.id); }); }
    else { var list = listFor(spec, e); list.splice(list.indexOf(selOf(spec, e)), 1); }
    return changed();
  }
  if (a === "bullet") {
    var e2 = entryById(li.getAttribute("data-e")), ref = li.getAttribute("data-ref"), sel = selOf(spec, e2);
    if (el.checked) addRef(spec, e2, ref);
    else { sel.bullets.splice(sel.bullets.indexOf(ref), 1); if (!sel.bullets.length) { var l2 = listFor(spec, e2); l2.splice(l2.indexOf(sel), 1); } }
    return changed();
  }
  if (a === "skill") {
    var id = li.getAttribute("data-skill");
    if (el.checked) spec.skills.push({ id: id }); else spec.skills = spec.skills.filter(function (s) { return s.id !== id; });
    return changed();
  }
  if (a === "skilltext") {
    var it = spec.skills.find(function (s) { return s.id === li.getAttribute("data-skill"); });
    if (it) { it.text = el.value.trim(); changed(); }
    return;
  }
  if (el.id === "rb-loc") { spec.location = el.value.trim(); return changed(); }
  if (el.id === "rb-pfirst") { spec.projectsFirst = el.checked; return changed(); }
  if (el.id === "rb-posting") { spec.posting = el.value; return changed(); }
  if (el.id === "rb-preset") { if (el.value) { spec = clone(LIB.presets[el.value]); spec.edits = {}; spec.posting = ""; el.value = ""; changed(); } return; }
});

function makePDF() {
  var btn = $("rb-make"), note = $("rb-made");
  btn.disabled = true; note.textContent = "Making the PDF from your .odt… (a few seconds)";
  fetch("/api/resume_make", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_id: job ? job.id : null, spec: spec, content: forServer(resolve(spec)) }) })
    .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "error"); return j; }); })
    .then(function (j) {
      btn.disabled = false;
      var f = j.result.pdf;
      note.innerHTML = (j.result.pages === 1 ? "Saved, one page: " : '<span class="over">The real PDF came out at ' + j.result.pages + " pages; cut a line or two and make it again.</span> Saved: ") +
        "<b>" + esc(f.split("/").pop()) + '</b> in resumes/' + esc(f.split("/").slice(0, -1).join("/")) + ' <button class="quiet" data-act="reveal" data-file="' + esc(f) + '">Show file</button>' +
        (job ? ' <span class="small">Today will say to attach it for this job.</span>' : "");
      if (j.data) window.App.setData(j.data);
    })
    .catch(function (err) { btn.disabled = false; note.textContent = "That didn't work: " + err.message; });
}

/* ---------------- open the page (for a job, or general) ---------------- */
function fillPickers() {
  $("rb-preset").innerHTML = '<option value="">Start from a saved version…</option>' + Object.keys(LIB.presets).map(function (k) { return '<option value="' + k + '">' + esc(LIB.presets[k].label) + "</option>"; }).join("");
}
function open(jobId) {
  var go = function () {
    var D = window.App.data();
    job = jobId ? D.jobs.find(function (j) { return j.id === jobId; }) || null : null;
    spec = null;
    if (job && job.resume_spec) { spec = clone(job.resume_spec); spec.edits = spec.edits || {}; }
    else spec = suggest();
    fillPickers();
    $("rb-made").innerHTML = job && job.resume_file ? 'Last made: <b>' + esc(job.resume_file.split("/").pop()) + '</b> in resumes/' + esc(job.resume_file.split("/").slice(0, -1).join("/")) + ' <button class="quiet" data-act="reveal" data-file="' + esc(job.resume_file) + '">Show file</button>' : "";
    $("rb-for").innerHTML = (job ? 'For <a href="' + esc(/^https?:\/\//i.test(job.url || "") ? job.url : "#") + '" target="_blank" rel="noopener" title="Open the posting">' + esc(job.title) + "</a> at " + esc(job.employer) : "A general resume, not for a particular job") +
      ' <a class="quiet" href="#jobs">' + (job ? "Change job" : "Pick a job") + "</a>" + (job ? ' <span class="small">(right-click a job in Jobs)</span>' : "");
    closePreview();
    render();
  };
  if (!window.App.data()) return setTimeout(function () { open(jobId); }, 200);
  if (LIB) go(); else fetch("/api/resume", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (l) { LIB = l; go(); });
}
/* jump between jobs: the list in the sidebar (lit where you are), a sticky row of names above the checklist, J and K */
function tocName(e) {
  return e.short || e.title;                                  // "short": an optional short name per entry in resume.json
}
function sections() { return Array.prototype.slice.call(document.querySelectorAll("#rb-list .rb-e")); }
function renderToc() {
  var items = sections().map(function (s) { return '<li><a href="#' + s.id + '" data-jump="' + s.id + '"' + (s.classList.contains("on") ? "" : ' class="off"') + ">" + esc(s.getAttribute("data-toc")) + "</a></li>"; }).join("");
  var side = $("rb-toc"); side.innerHTML = items; side.hidden = false;
  $("rb-row").innerHTML = items;
  lightToc();
}
function lightToc() {
  var cur = null;
  sections().forEach(function (s) { if (s.getBoundingClientRect().top < 140) cur = s.id; });
  if (!cur && sections()[0]) cur = sections()[0].id;
  document.querySelectorAll("[data-jump]").forEach(function (a) { a.classList.toggle("here", a.getAttribute("data-jump") === cur); });
  return cur;
}
function jump(id) { var el = $(id); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: "smooth" }); }
window.addEventListener("scroll", function () { if (!$("resume").hidden && LIB) lightToc(); }, { passive: true });
document.addEventListener("click", function (ev) {
  var a = ev.target.closest("[data-jump]"); if (!a) return;
  ev.preventDefault(); jump(a.getAttribute("data-jump"));
});
document.addEventListener("keydown", function (ev) {
  if ($("resume").hidden || !LIB) return;
  if (ev.key === "Escape" && !$("rb-modal").hidden) { closePreview(); return; }
  var t = (ev.target.tagName || "").toLowerCase();
  if (t === "input" || t === "textarea" || t === "select" || ev.target.isContentEditable || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.key !== "j" && ev.key !== "k") return;
  var ids = sections().map(function (s) { return s.id; }), at = ids.indexOf(lightToc());
  jump(ids[Math.max(0, Math.min(ids.length - 1, at + (ev.key === "j" ? 1 : -1)))]);
  ev.preventDefault();
});
/* the paper only when asked: a pop-over panel */
function openPreview() {
  $("rb-modal").hidden = false; document.body.classList.add("modal-open");
  $("rb-paper").innerHTML = paperHTML(resolve(spec));
  var box = $("rb-modal").querySelector(".rb-sheet"), barH = box.querySelector(".rb-sheetbar").offsetHeight + 12;
  var s = Math.min(1, (box.clientHeight - barH - 8) / (11 * 96), (box.clientWidth - 24) / (8.5 * 96));   // the whole page fits under the buttons
  $("rb-paper").style.setProperty("--s", s.toFixed(3));
  $("rb-paperbox").style.width = (8.5 * 96 * s) + "px"; $("rb-paperbox").style.height = (11 * 96 * s) + "px";
  $("rb-close").focus();
}
function closePreview() { $("rb-modal").hidden = true; document.body.classList.remove("modal-open"); }
document.addEventListener("click", function (ev) {
  if (ev.target.id === "rb-preview" || ev.target.id === "rb-preview2") openPreview();
  if (ev.target.id === "rb-close" || ev.target.id === "rb-modal") closePreview();
  if (ev.target.id === "rb-fixbtn") { var sg = $("rb-sugg"); sg.hidden = !sg.hidden; }
  if (ev.target.id === "rb-make") makePDF();
  if (ev.target.id === "rb-suggest" && LIB) { var keep = spec ? spec.posting : ""; spec = { posting: keep }; spec = suggest(); spec.posting = keep; changed(); }
});
window.ResumeBuilder = { open: open, leave: function () { $("rb-toc").hidden = true; closePreview(); } };
})();
