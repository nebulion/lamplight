/* The job interview (#interview, SHARE-DESIGN phase 3): six short rounds from /interview.json (the work, place, hours and
   money, how far to reach, hard no's, and an optional round of sorting sample jobs), saved round by round into
   data/profile.json "prefs". Then Claude writes their scan from the answers: the person copies a prompt to Claude and
   pastes its answer back (saved as data/SCAN.md). Every round can be skipped; nothing blocks the next. */
(function () {
"use strict";

var root = null, Q = null, prefs = {}, plan = "free", at = 0;
var $ = function (sel) { return root.querySelector(sel); };
var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
function post(name, body) {
  return fetch("/api/" + name, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(function (r) { return r.json(); }).then(function (r) { if (r.error) throw new Error(r.error); return r; });
}

function question(q) {
  var v = prefs[q.key], h = '<div class="iv-q"><p class="iv-label">' + esc(q.label) + "</p>";
  if (q.kind === "text") h += '<input class="iv-text" data-k="' + q.key + '" value="' + esc(v || "") + '">';
  if (q.kind === "pick" || q.kind === "multi") h += '<div class="iv-opts">' + q.options.map(function (o) {
    var on = q.kind === "pick" ? v === o : (v || []).indexOf(o) >= 0;
    return '<button type="button" class="ch-opt" data-k="' + q.key + '" data-v="' + esc(o) + '" aria-pressed="' + on + '">' + esc(o) + "</button>";
  }).join("") + "</div>";
  if (q.kind === "grid" || q.kind === "sort") h += '<table class="iv-grid"><tbody>' + q.rows.map(function (row) {
    return "<tr><th>" + esc(row) + "</th>" + q.cols.map(function (c) {
      return '<td><button type="button" class="ch-opt" data-k="' + q.key + '" data-row="' + esc(row) + '" data-v="' + esc(c) + '" aria-pressed="' + ((v || {})[row] === c) + '">' + esc(c) + "</button></td>";
    }).join("") + "</tr>";
  }).join("") + "</tbody></table>";
  return h + "</div>";
}
function render() {
  var n = Q.rounds.length;
  if (at >= n) return renderScan();
  var r = Q.rounds[at];
  root.innerHTML = '<p class="small su-count">The job interview, round ' + (at + 1) + " of " + n + '</p><h1>' + esc(r.title) + '</h1><p class="lede">' + esc(r.lede) + "</p>" +
    '<div class="iv-body">' + r.questions.map(question).join("") + "</div>" +
    '<p class="actions ch-end"><button type="button" class="btn primary" id="iv-next">Save and go on</button>' +
    (at ? ' <button type="button" class="quiet" id="iv-back">Back</button>' : "") + ' <button type="button" class="quiet" id="iv-skip">Skip this round</button> <span class="small su-err" id="iv-err"></span></p>';
  window.scrollTo(0, 0);
}
function renderScan() {
  root.innerHTML = '<p class="small su-count">The job interview, last step</p><h1>Your search instructions</h1>' +
    '<p class="lede">Claude turns your answers and resume into the instructions your job search follows: what to look for, where, what counts as ideal, good or fallback, and what never to add.</p>' +
    '<ol class="su-steps"><li><button type="button" class="btn" id="iv-prompt">Copy the prompt for Claude</button> then paste it into <a href="https://claude.ai/new" target="_blank" rel="noopener">a new Claude chat</a>.</li>' +
    '<li>Paste Claude\'s whole answer here:<textarea id="iv-reply" rows="8"></textarea></li></ol>' +
    '<p class="actions"><button type="button" class="btn primary" id="iv-save">Save my search</button> <button type="button" class="quiet" id="iv-back">Back to the questions</button> <span class="small su-err" id="iv-err"></span></p><div id="iv-after"></div>';
}
function after(res) {
  var box = $("#iv-after");
  if (plan === "pro") box.innerHTML = '<h2 class="ch-h">Make it run every morning</h2><ol class="su-steps"><li>Open the Claude desktop app, then Scheduled tasks, then New task.</li>' +
    '<li>Name it "job scan", set it to daily at a time you\'re usually at your computer, and paste this as its prompt:<textarea rows="5" readonly>' + esc(res.task) + "</textarea></li>" +
    "<li>Run it once now to fill your Inbox.</li></ol>";
  else box.innerHTML = '<p>Saved. When you want new jobs, open the <a href="#inbox">Inbox</a> and use <b>Find jobs with Claude</b>.</p>';
}
function readText() { root.querySelectorAll(".iv-text").forEach(function (i) { prefs[i.getAttribute("data-k")] = i.value.trim(); }); }
function saveRound() {
  readText();
  var keys = Q.rounds[at].questions.map(function (q) { return q.key; }), patch = {};
  keys.forEach(function (k) { if (prefs[k] !== undefined) patch[k] = prefs[k]; });
  return post("profile", { patch: { prefs: patch } });
}

function wire() {
  root.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var k = b.getAttribute("data-k");
    if (k) {
      var q = Q.rounds[at].questions.filter(function (x) { return x.key === k; })[0], v = b.getAttribute("data-v");
      readText();
      if (q.kind === "pick") prefs[k] = prefs[k] === v ? "" : v;
      else if (q.kind === "multi") {
        var list = (prefs[k] || []).slice(), i = list.indexOf(v);
        if (i >= 0) list.splice(i, 1); else if (!q.max || list.length < q.max) list.push(v);
        prefs[k] = list;
      } else { var g = Object.assign({}, prefs[k] || {}), row = b.getAttribute("data-row"); if (g[row] === v) delete g[row]; else g[row] = v; prefs[k] = g; }
      var y = window.scrollY; render(); window.scrollTo(0, y);
      return;
    }
    if (b.id === "iv-next") saveRound().then(function () { at++; render(); }).catch(function (e2) { $("#iv-err").textContent = e2.message; });
    if (b.id === "iv-skip") { at++; render(); }
    if (b.id === "iv-back") { at = Math.max(0, Math.min(at, Q.rounds.length) - 1); render(); }
    if (b.id === "iv-prompt") post("scan_prompt", {}).then(function (r) {
      return navigator.clipboard.writeText(r.result.prompt).then(function () { b.textContent = "Copied: now paste it into Claude"; });
    }).catch(function (e2) { $("#iv-err").textContent = e2.message; });
    if (b.id === "iv-save") post("scan_save", { reply: $("#iv-reply").value }).then(function (r) { $("#iv-err").textContent = ""; after(r.result); })
      .catch(function (e2) { $("#iv-err").textContent = e2.message; });
  });
}
function open() {
  root = document.getElementById("interview"); if (!root) return;
  var json = function (u) { return fetch(u, { cache: "no-store" }).then(function (r) { return r.json(); }); };
  Promise.all([json("/interview.json"), json("/api/profile")]).then(function (res) {
    Q = res[0]; prefs = res[1].prefs || {}; plan = res[1].plan || (res[1].scan_mode === "scheduled" ? "pro" : "free");
    if (!root.dataset.wired) { root.dataset.wired = "1"; wire(); }
    render();
  });
}
window.InterviewPage = { open: open };
})();
