/* First run (#setup, docs/SHARE-DESIGN.md phase 2c): opens by itself when data/profile.json doesn't exist yet.
   One question per screen, so nothing piles up. The resume step carries a prompt to Claude and brings its answer back;
   nothing here talks to Claude itself. After it: the job interview (#interview) and Your character. */
(function () {
"use strict";

var root = null, step = 0, A = { plan: "free", daily_target: 5 };
var $ = function (sel) { return root.querySelector(sel); };
var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
function post(name, body) {
  return fetch("/api/" + name, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(function (r) { return r.json(); }).then(function (r) { if (r.error) throw new Error(r.error); return r; });
}

var STEPS = [
  { title: "Who are you?", lede: "For your resumes and cover letters. It stays on this computer.",
    html: function () {
      return field("name", "Your name", "text", "Ada Lovelace") + field("email", "The email address you apply with", "email", "ada@example.com") +
        field("phone", "Phone (optional)", "tel", "") + field("city", "The city on your resume", "text", "Chicago, IL");
    },
    read: function () { ["name", "email", "phone", "city"].forEach(function (k) { A[k] = $("#su-" + k).value.trim(); });
      if (!A.name) return "Your name, please."; if (A.email.indexOf("@") < 1) return "An email address, please."; } },
  { title: "Which Claude plan do you have?", lede: "Claude finds jobs for you. How depends on your plan; you can change it later.",
    html: function () {
      return choice("plan", [["pro", "Pro or higher", "A scheduled task in the Claude desktop app searches every morning by itself."],
        ["free", "Free", "You paste a prompt into claude.ai when you want new jobs, then paste its answer back here. About a minute."],
        ["none", "No Claude account", "Add jobs yourself for now; the paste route works once you have a free account."]]);
    },
    read: function () { var c = root.querySelector('input[name="plan"]:checked'); A.plan = c ? c.value : "free"; } },
  { title: "How many a day, and when?", lede: "A small daily target you can keep beats a big one you dread. You can change both on Today.",
    html: function () {
      return '<label class="su-field"><span>Applications a day</span><input id="su-target" type="number" min="1" max="20" value="' + A.daily_target + '"></label>' +
        field("cue", "When and where you'll apply", "text", "After breakfast, at my desk");
    },
    read: function () { A.daily_target = Math.max(1, Math.min(20, parseInt($("#su-target").value, 10) || 5)); A.cue = $("#su-cue").value.trim(); },
    after: function () { return post("setup", A); } },
  { title: "Your resume", lede: "Claude turns it into a library the resume builder picks from. It copies what you wrote; it doesn't rewrite it.",
    html: function () {
      return '<ol class="su-steps"><li>Paste your resume here (plain text is fine):<textarea id="su-resume" rows="8"></textarea></li>' +
        '<li><button type="button" class="btn" id="su-prompt">Copy the prompt for Claude</button> then paste it into <a href="https://claude.ai/new" target="_blank" rel="noopener">a new Claude chat</a>.</li>' +
        '<li>Paste Claude\'s whole answer here:<textarea id="su-reply" rows="6"></textarea></li></ol>' +
        '<p><button type="button" class="btn" id="su-import">Import it</button> <span class="small" id="su-imported"></span></p>';
    },
    read: function () { if (!A.imported && $("#su-reply").value.trim()) return "Press Import it first, or clear the answer box to skip."; } },
  { title: "Done", lede: "",
    html: function () {
      return '<p>Next, the <b>job interview</b>: questions about what work you\'d love, what you\'d take, and what you\'d never do, so the search finds the right jobs. About 15 minutes; stop any time.</p>' +
        '<p><a class="btn primary" href="#interview">Start the interview</a> <a class="quiet" href="#character">Pick your character first</a> <a class="quiet" href="#today">Later</a></p>';
    } }
];
function field(k, label, type, ph) {
  return '<label class="su-field"><span>' + esc(label) + '</span><input id="su-' + k + '" type="' + type + '" placeholder="' + esc(ph) + '" value="' + esc(A[k] || "") + '"></label>';
}
function choice(k, opts) {
  return opts.map(function (o) {
    return '<label class="su-choice"><input type="radio" name="' + k + '" value="' + o[0] + '"' + (A[k] === o[0] ? " checked" : "") + '><span><b>' + esc(o[1]) + "</b> " + esc(o[2]) + "</span></label>";
  }).join("");
}

function render() {
  var s = STEPS[step], last = step === STEPS.length - 1;
  root.innerHTML = '<p class="small su-count">Setup, step ' + (step + 1) + " of " + STEPS.length + "</p><h1>" + esc(s.title) + "</h1>" +
    (s.lede ? '<p class="lede">' + esc(s.lede) + "</p>" : "") + '<div class="su-body">' + s.html() + "</div>" +
    (last ? "" : '<p class="actions"><button type="button" class="btn primary" id="su-next">' + (step === 3 ? "Next (or skip)" : "Next") + "</button>" +
      (step ? ' <button type="button" class="quiet" id="su-back">Back</button>' : "") + ' <span class="small su-err" id="su-err"></span></p>');
  var first = root.querySelector("input, textarea"); if (first) first.focus();
}
function next() {
  var s = STEPS[step], err = s.read && s.read();
  if (err) { $("#su-err").textContent = err; return; }
  var go = function () { step++; render(); };
  if (s.after) { $("#su-next").disabled = true; s.after().then(go).catch(function (e) { $("#su-err").textContent = e.message; $("#su-next").disabled = false; }); }
  else go();
}

function open() {
  root = document.getElementById("setup"); if (!root) return;
  if (!root.dataset.wired) {
    root.dataset.wired = "1";
    root.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.id === "su-next") next();
      if (b.id === "su-back") { step = Math.max(0, step - 1); render(); }
      if (b.id === "su-prompt") post("resume_prompt", { text: $("#su-resume").value }).then(function (r) {
        return navigator.clipboard.writeText(r.result.prompt).then(function () { b.textContent = "Copied: now paste it into Claude"; });
      }).catch(function (e2) { $("#su-err").textContent = e2.message; });
      if (b.id === "su-import") post("resume_import", { reply: $("#su-reply").value }).then(function (r) {
        var n = r.result; A.imported = true;
        $("#su-imported").textContent = "Imported " + n.jobs + (n.jobs === 1 ? " job, " : " jobs, ") + n.projects + " projects, " + n.bullets + " bullets, " + n.skills + " skill lines.";
      }).catch(function (e2) { $("#su-imported").textContent = e2.message; });
    });
    root.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); next(); } });
  }
  render();
}
window.SetupPage = { open: open };
})();
