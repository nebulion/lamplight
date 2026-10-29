/* Find jobs with Claude, and paste a job-alert email (Inbox; SHARE-DESIGN phases 4 and 5a). For any plan, the free one
   too: the person carries a prompt to Claude and pastes its answer back; each job is checked before it's added. An alert
   email pasted here (LinkedIn, Indeed, USAJobs, governmentjobs.com) adds its job links as unchecked Inbox jobs, and the
   next batch from Claude checks them first. */
(function () {
"use strict";
var root = document.getElementById("finder");
if (!root) return;
var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
function post(name, body) {
  return fetch("/api/" + name, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(function (r) { return r.json(); }).then(function (r) { if (r.error) throw new Error(r.error); if (r.data && window.App) App.setData(r.data); return r.result; });
}
root.innerHTML =
  '<p class="small">Free plan, or between scheduled scans. Your search instructions go with the prompt; Claude answers with a batch of about 12.</p>' +
  '<ol class="su-steps"><li><button type="button" class="btn" id="fd-prompt">Copy the prompt for Claude</button> then paste it into <a href="https://claude.ai/new" target="_blank" rel="noopener">a new Claude chat</a>.</li>' +
  '<li>Paste Claude\'s whole answer here:<textarea id="fd-reply" rows="5"></textarea></li></ol>' +
  '<p><button type="button" class="btn" id="fd-import">Add these jobs</button> <span class="small" id="fd-out"></span></p>' +
  '<h3 class="ch-group">Job-alert emails</h3>' +
  '<p class="small">Open a job alert from LinkedIn, Indeed, USAJobs or governmentjobs.com, select all, copy, and paste it into the box. Its jobs land in the Inbox unchecked; your next Claude batch checks them first.</p>' +
  '<div id="fd-alert" class="fd-paste" contenteditable="true" role="textbox" aria-label="Paste a job-alert email here">Paste a job-alert email here</div>' +
  '<p class="small" id="fd-aout"></p>';
var $ = function (id) { return document.getElementById(id); };
$("fd-prompt").addEventListener("click", function (e) {
  var b = e.target;
  post("find_prompt", {}).then(function (r) { return navigator.clipboard.writeText(r.prompt); })
    .then(function () { b.textContent = "Copied: now paste it into Claude"; })
    .catch(function (err) { $("fd-out").textContent = err.message; });
});
$("fd-import").addEventListener("click", function () {
  post("jobs_import", { reply: $("fd-reply").value }).then(function (r) {
    var parts = ["Added " + r.added + (r.added === 1 ? " job" : " jobs")];
    if (r.updated) parts.push("checked " + r.updated + " from your alerts");
    if (r.dropped.length) parts.push("left out " + r.dropped.length + ": " + r.dropped.map(function (d) { return d.title + " (" + d.reason + ")"; }).join("; "));
    $("fd-out").textContent = parts.join(", ") + "."; $("fd-reply").value = "";
  }).catch(function (err) { $("fd-out").textContent = err.message; });
});
$("fd-alert").addEventListener("focus", function (e) { if (e.target.textContent === "Paste a job-alert email here") e.target.textContent = ""; });
$("fd-alert").addEventListener("paste", function (e) {
  e.preventDefault();                                            // only the links are read; nothing from the email is shown or run
  var html = e.clipboardData.getData("text/html") || esc(e.clipboardData.getData("text/plain")).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  e.target.textContent = "Reading…";
  post("alerts_import", { html: html }).then(function (r) {
    var t = r.found ? "Found " + r.found + " jobs: " + r.added + " added to your Inbox, " + r.known + " already there" : "No job links found in that email";
    if (r.skipped.length) t += ", " + r.skipped.length + " left out (title words you said mean no)";
    $("fd-aout").textContent = t + "."; e.target.textContent = "Paste a job-alert email here";
  }).catch(function (err) { $("fd-aout").textContent = err.message; e.target.textContent = "Paste a job-alert email here"; });
});
})();
