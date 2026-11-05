/* The Skills page (2026-11-02, he asked): certificates, courses and books that help across job paths, with a status he sets,
   and study plans read from his own notes (never written to). Finished sessions add stars to the street's sky and passed
   certificates floodlight its church towers; application lights stay for applications only.
   Video courses (2026-11-05, course.js): played here, a note per video in his notes folder, and a star per so many minutes watched. */
(function () {
"use strict";
var DOC = null;
var WORD = { "": "Not started", doing: "Doing", done: "Done" };
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function statuses() { var d = window.App && App.data(); return (d && d.settings.skills) || {}; }
function openJobs() { var d = App.data(); return d ? d.jobs.filter(function (j) { return ["inbox", "queued", "later"].indexOf(j.status) >= 0; }) : []; }
function mentions(it) {
  if (!it.match) return 0;
  var rx = new RegExp(it.match, "i");
  return openJobs().filter(function (j) { return rx.test(j.title + " " + (j.why || "") + " " + (j.notes || "")); }).length;
}
function allItems() { return DOC ? DOC.groups.reduce(function (a, g) { return a.concat(g.items); }, []) : []; }
function counts() {
  var st = statuses();
  return {
    stars: DOC ? DOC.plans.reduce(function (n, p) { return n + (p.finished || 0); }, 0) + (DOC.courses || []).reduce(function (n, c) { return n + (c.stars || 0); }, 0) : 0,
    towers: allItems().filter(function (it) { return it.cert && st[it.id] === "done"; }).length
  };
}
function tellStreet() { var c = counts(); if (window.Scene && Scene.setStudy) Scene.setStudy(c.stars, c.towers); }

function planPanel(p) {
  if (!p.found) return '<div class="sk-plan"><h2>' + esc(p.name) + '</h2><p class="muted">Can\'t find the plan file. Check "study_plans" in data/profile.json.</p></div>';
  var bar = p.sessions.map(function (d) { return '<i class="' + (d ? "on" : "") + '"></i>'; }).join("");
  var next = p.next;
  return '<div class="sk-plan"><h2>' + esc(p.name) + "</h2>" +
    '<p class="sk-big"><b>' + p.finished + "</b> of " + p.sessions.length + " sessions finished. <span class=\"small\">" + p.ticked + " of " + p.boxes + " boxes ticked. Plan last saved " + new Date(p.last_saved + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ".</span></p>" +
    '<p class="sk-bar" role="img" aria-label="' + p.finished + " of " + p.sessions.length + ' sessions finished">' + bar + "</p>" +
    (next ? '<p class="sk-next">Next is session ' + next.n + ":</p><ul class=\"sk-tasks\">" + next.tasks.map(function (t) { return '<li class="' + (t.done ? "done" : "") + '">' + esc(t.text) + "</li>"; }).join("") + "</ul>" : "<p>All sessions finished.</p>") +
    '<p class="small">Read from your notes. Tick boxes there; this page follows.</p></div>';
}
function row(it) {
  var st = statuses()[it.id] || "", n = mentions(it);
  return '<div class="sk-item' + (st === "done" ? " done" : "") + '">' +
    '<div class="sk-l1"><span class="sk-name">' + esc(it.name) + '</span><select class="reply" data-skill="' + esc(it.id) + '" aria-label="Status of ' + esc(it.name) + '">' +
    Object.keys(WORD).map(function (k) { return '<option value="' + k + '"' + (st === k ? " selected" : "") + ">" + WORD[k] + "</option>"; }).join("") + "</select></div>" +
    '<p class="sk-meta">' + esc(it.helps) + ' <span class="dot">&middot;</span> ' + esc(it.cost) + ' <span class="dot">&middot;</span> ' + esc(it.time) +
    (n ? ' <span class="dot">&middot;</span> <button class="quiet" data-skill-search="' + esc(it.search || "") + '">In ' + n + " of your open jobs</button>" : "") + "</p>" +
    '<p class="sk-why">' + esc(it.why) + (it.note ? " <b>" + esc(it.note) + "</b>" : "") + "</p>" +
    '<p class="sk-step">' + (it.next ? "Next: " + esc(it.next) : "") + (it.links || []).map(function (l) { return ' <a href="' + esc(l[1]) + '" target="_blank" rel="noopener">' + esc(l[0]) + "</a>"; }).join(" &middot;") + "</p></div>";
}
function part(root, cls) {                               // the page's parts; the courses' part keeps its players between redraws
  var el = root.querySelector(":scope > ." + cls);
  if (!el) { el = document.createElement("div"); el.className = cls; root.appendChild(el); }
  return el;
}
function render() {
  var root = $("skills"); if (!root || !DOC) return;
  var c = counts(), cs = DOC.courses || [];
  var starWhy = cs.length ? "Each finished session, and every " + (cs[0].star_minutes || 30) + " minutes of course video, adds a star" : "Each finished session adds a star";
  part(root, "sk-top").innerHTML = "<h1>Skills</h1>" +
    '<p class="lede">What helps across job paths. ' + starWhy + " to the street's sky (" + c.stars + " so far). Each certificate you mark Done floodlights a church tower (" + Math.min(c.towers, 4) + " of 4).</p>";
  var box = part(root, "sk-courses");
  if (window.CoursePanel) cs.forEach(function (k) { var el = CoursePanel.mount(k.id); if (el.parentNode !== box) box.appendChild(el); });
  part(root, "sk-rest").innerHTML = DOC.plans.map(planPanel).join("") +
    DOC.groups.map(function (g) { return "<h2>" + esc(g.name) + "</h2>" + g.items.map(row).join(""); }).join("");
}
function load() {
  return fetch("/api/skills", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
    DOC = d;
    var li = $("skills-link"); if (li) li.hidden = !d.exists;
    tellStreet();
    if ($("skills") && !$("skills").hidden) render();
  }).catch(function () {});
}
document.addEventListener("change", function (e) {
  var id = e.target.getAttribute && e.target.getAttribute("data-skill"); if (!id) return;
  var st = Object.assign({}, statuses()); if (e.target.value) st[id] = e.target.value; else delete st[id];
  App.post("settings", { patch: { skills: st } }).then(function () { tellStreet(); render(); });
});
document.addEventListener("click", function (e) {
  var b = e.target.closest && e.target.closest("[data-skill-search]"); if (!b) return;
  App.searchJobs(b.getAttribute("data-skill-search"));
});
window.addEventListener("focus", load);
window.SkillsPage = { open: function () { load().then(render); }, load: load, tellStreet: tellStreet };
})();
