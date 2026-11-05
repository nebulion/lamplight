/* A video course on the Skills page (2026-11-05, he asked): the course's videos played here, a speed button, a note per video
   saved to his notes folder (his Obsidian vault), and progress in minutes of video watched (app/courses.py keeps it).
   Minutes count the video's own time, once: rewatching a stretch or skipping ahead adds nothing. */
(function () {
"use strict";
var SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
var mounted = {};                                       // course id -> its panel's state (the panel stays put when the page redraws)
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function keep(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
function mins(s) { return Math.round((s || 0) / 60); }
function num(n) { return Number(n).toLocaleString("en-GB"); }
function clock(s) { s = Math.floor(s || 0); var h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (x < 10 ? "0" : "") + x; }
function getJSON(url) { return fetch(url, { cache: "no-store" }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "error"); return j; }); }); }
function send(action, body, leaving) {
  return fetch("/api/" + action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: !!leaving })
    .then(function (r) { return r.json().then(function (j) { j.status = r.status; if (!r.ok && r.status !== 409) throw new Error(j.error || "error"); return j; }); });
}
function videoURL(cid, rel) { return "/video/" + encodeURIComponent(cid) + "/" + rel.split("/").map(encodeURIComponent).join("/"); }

function Panel(el, cid) {
  var P = this;
  P.el = el; P.cid = cid; P.vids = []; P.cur = null; P.c = null;
  P.speed = parseFloat(keep("course-speed")) || 1;
  P.seg = null; P.pending = []; P.note = null; P.dirty = false; P.saveT = 0; P.flushT = 0;
  el.innerHTML =
    '<div class="cv-head"></div>' +
    '<div class="cv-player"><video class="cv-video" controls preload="metadata" playsinline></video>' +
    '<div class="cv-bar"><button class="quiet" type="button" data-cv="prev">Previous</button>' +
    '<span class="cv-title"></span>' +
    '<button class="cv-speed" type="button" data-cv="speed" title="Playback speed. Keys: [ slower, ] faster">1×</button>' +
    '<button class="quiet" type="button" data-cv="next">Next</button></div></div>' +
    '<div class="cv-notes"><div class="cv-nbar"><span class="small cv-file"></span><span class="cv-nbtn">' +
    '<button class="quiet" type="button" data-cv="stamp" title="Put the video\'s time in the note">Add time</button>' +
    '<span class="small cv-saved" aria-live="polite"></span></span></div>' +
    '<textarea class="cv-text" spellcheck="true" aria-label="Notes for this video"></textarea>' +
    '<p class="cv-jumps small"></p><p class="cv-clash small" hidden></p></div>' +
    '<details class="cv-list"><summary>All videos</summary><div class="cv-sections"></div></details>';
  P.v = el.querySelector(".cv-video"); P.t = el.querySelector(".cv-text");
  P.setSpeed(P.speed);
  P.v.addEventListener("play", function () { P.seg = [P.v.currentTime, P.v.currentTime]; });
  P.v.addEventListener("timeupdate", function () { P.track(); });
  P.v.addEventListener("seeking", function () { P.close(); });
  P.v.addEventListener("pause", function () { P.close(); P.flush(); });
  P.v.addEventListener("ended", function () { P.close(); P.flush(); P.next(); });
  P.v.addEventListener("ratechange", function () { if (P.v.readyState && Math.abs(P.v.playbackRate - P.speed) > 0.001) P.setSpeed(P.v.playbackRate); });
  P.v.addEventListener("loadedmetadata", function () {
    var v = P.cur; if (!v) return;
    if (v.pos && v.pos < P.v.duration - 5) P.v.currentTime = v.pos;
    P.v.playbackRate = P.speed;
    if (!v.dur) { v.dur = P.v.duration; send("durations", { course: cid, durs: (function (o) { o[v.id] = v.dur; return o; })({}) }).then(function (j) { P.show(j.result.course); }).catch(function () {}); }
  });
  P.t.addEventListener("input", function () { P.dirty = true; P.saved("Not saved yet"); P.jumps(); clearTimeout(P.saveT); P.saveT = setTimeout(function () { P.save(); }, 1200); });
  el.addEventListener("click", function (e) {
    var b = e.target.closest("[data-cv],[data-cv-video],[data-cv-jump]"); if (!b) return;
    if (b.hasAttribute("data-cv-video")) return P.open(b.getAttribute("data-cv-video"), true);
    if (b.hasAttribute("data-cv-jump")) { P.v.currentTime = parseFloat(b.getAttribute("data-cv-jump")); return; }
    var a = b.getAttribute("data-cv");
    if (a === "speed") P.step(e.shiftKey ? -1 : 1, true);
    else if (a === "next") P.next();
    else if (a === "prev") P.prev();
    else if (a === "stamp") P.stamp();
    else if (a === "theirs") P.loadNote(true);
    else if (a === "mine") P.save(true);
  });
  setInterval(function () { if (!P.v.paused) { P.close(); P.flush(); P.seg = [P.v.currentTime, P.v.currentTime]; } }, 15000);
}
Panel.prototype = {
  load: function () {
    var P = this;
    return getJSON("/api/course?id=" + encodeURIComponent(P.cid)).then(function (d) {
      P.vids = d.videos; P.show(d.course); P.list();
      if (!P.cur && P.vids.length) P.open(d.course.last && P.find(d.course.last) ? d.course.last : (P.vids.find(function (v) { return !v.dur || v.seen < 0.9 * v.dur; }) || P.vids[0]).id, false);
      P.probe();
    }).catch(function (e) { P.el.querySelector(".cv-head").innerHTML = '<h2>Course</h2><p class="muted">' + esc(e.message) + "</p>"; });
  },
  find: function (id) { return this.vids.find(function (v) { return v.id === id; }); },
  show: function (c) {
    var P = this; P.c = c;
    var head = P.el.querySelector(".cv-head");
    if (!c.found) { head.innerHTML = "<h2>" + esc(c.name) + '</h2><p class="muted">Can\'t find the videos folder. Check "videos" under "courses" in data/profile.json.</p>'; P.el.classList.add("cv-missing"); return; }
    var share = c.total_s ? Math.min(c.watched_s / c.total_s, 1) : 0;
    var week = c.week_minutes ? Math.min(c.week_s / 60 / c.week_minutes, 1) : 0;
    head.innerHTML = "<h2>" + esc(c.name) + "</h2>" +
      '<p class="sk-big"><b>' + num(mins(c.watched_s)) + "</b> of " + num(mins(c.total_s)) + (c.timed < c.videos ? "+" : "") + " minutes watched" +
      (c.total_s ? " (" + Math.round(share * 100) + "%)" : "") + '. <span class="small">' + c.done + " of " + c.videos + " videos done. " + mins(c.today_s) + " min today.</span></p>" +
      '<p class="cv-meter" role="img" aria-label="' + Math.round(share * 100) + '% of the course watched"><i style="width:' + (share * 100).toFixed(1) + '%"></i></p>' +
      (c.week_minutes ? '<p class="small cv-week">This week: <b>' + mins(c.week_s) + "</b> of " + c.week_minutes + " min" + (c.week_s / 60 >= c.week_minutes ? ", goal met." : ".") +
        ' <span class="cv-meter cv-meter-s"><i style="width:' + (week * 100).toFixed(1) + '%"></i></span></p>' : "") +
      (c.pace_minutes != null ? '<p class="small">To finish by ' + new Date(c.finish_by + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + ", about " + c.pace_minutes + " min a week.</p>" : "") +
      (c.timed < c.videos ? '<p class="small">Reading video lengths: ' + c.timed + " of " + c.videos + ".</p>" : "") +
      (!c.notes_found ? '<p class="small">Notes are off: can\'t find the notes folder ("notes" under "courses" in data/profile.json).</p>' : "");
    var stars = c.stars;
    if (P.stars != null && stars !== P.stars && window.SkillsPage) SkillsPage.load();   // a new star for the street's sky
    P.stars = stars;
  },
  list: function () {
    var P = this, html = "", sec = null;
    P.vids.forEach(function (v) {
      if (v.section !== sec) { html += (sec !== null ? "</ol>" : "") + (v.section ? "<h3>" + esc(v.section) + "</h3>" : "") + '<ol class="cv-ol">'; sec = v.section; }
      var done = v.dur && v.seen >= 0.9 * v.dur;
      html += '<li class="' + (done ? "done" : "") + (P.cur && P.cur.id === v.id ? " on" : "") + '"><button type="button" data-cv-video="' + esc(v.id) + '">' + esc(v.title) + "</button>" +
        ' <span class="small">' + (v.dur ? clock(v.dur) : "") + (v.seen && !done ? " · " + Math.round(100 * v.seen / (v.dur || v.seen)) + "% seen" : "") + "</span></li>";
    });
    P.el.querySelector(".cv-sections").innerHTML = html + (sec !== null ? "</ol>" : "") || '<p class="muted">No videos in the folder yet.</p>';
  },
  open: function (id, play) {
    var P = this, v = P.find(id); if (!v) return;
    P.close(); P.flush();
    if (P.dirty) P.save();
    P.cur = v;
    P.v.src = videoURL(P.cid, v.id);
    P.el.querySelector(".cv-title").textContent = (v.section ? v.section + " · " : "") + v.title;
    P.list(); P.loadNote();
    if (play) { P.v.play().catch(function () {}); P.el.querySelector(".cv-player").scrollIntoView({ block: "nearest" }); }
  },
  next: function () { var i = this.vids.indexOf(this.cur); if (i >= 0 && i < this.vids.length - 1) { this.open(this.vids[i + 1].id, !this.v.paused || this.v.ended); return true; } return false; },
  prev: function () { var i = this.vids.indexOf(this.cur); if (i > 0) this.open(this.vids[i - 1].id, !this.v.paused); },
  // speed
  setSpeed: function (s) {
    this.speed = s; this.v.defaultPlaybackRate = s; this.v.playbackRate = s; keep("course-speed", String(s));
    this.el.querySelector(".cv-speed").textContent = (s % 1 ? s : s.toFixed(0)) + "×";
  },
  step: function (d, wrap) {
    var i = SPEEDS.indexOf(this.speed); if (i < 0) i = 1;
    i += d; if (wrap) i = (i + SPEEDS.length) % SPEEDS.length; else i = Math.max(0, Math.min(SPEEDS.length - 1, i));
    this.setSpeed(SPEEDS[i]);
  },
  // minutes watched: stretches of the video's own time, sent every 15 s and on pause
  track: function () {
    var t = this.v.currentTime;
    if (this.v.paused || !this.seg) return;
    if (t >= this.seg[1] && t - this.seg[1] < 3) this.seg[1] = t;
    else { this.close(); this.seg = [t, t]; }
  },
  close: function () { if (this.seg && this.seg[1] - this.seg[0] > 0.5) this.pending.push(this.seg); this.seg = null; },
  flush: function (beacon) {
    var P = this, v = P.cur; if (!v) return;
    var body = { course: P.cid, video: v.id, ranges: P.pending, pos: P.v.currentTime || v.pos || 0 };
    if (P.v.duration) body.dur = P.v.duration;
    v.pos = body.pos; P.pending = [];
    if (!body.ranges.length && Math.abs(body.pos - (v.sentPos || 0)) < 1) return;
    v.sentPos = body.pos;
    if (beacon && navigator.sendBeacon) return navigator.sendBeacon("/api/watch", new Blob([JSON.stringify(body)], { type: "application/json" }));
    send("watch", body).then(function (j) { v.seen = j.result.seen; P.show(j.result.course); P.list(); }).catch(function () { P.pending = body.ranges.concat(P.pending); });
  },
  probe: function () {                                  // read the lengths of videos not opened yet, one at a time, so the total is known
    var P = this, todo = P.vids.filter(function (v) { return !v.dur; }), got = {}, n = 0;
    if (!todo.length || P.probing) return;
    P.probing = true;
    var el = document.createElement("video"); el.preload = "metadata"; el.muted = true;
    function done() { if (Object.keys(got).length) send("durations", { course: P.cid, durs: got }).then(function (j) { P.show(j.result.course); P.list(); }).catch(function () {}); got = {}; }
    function go() {
      var v = todo.shift();
      if (!v) { done(); P.probing = false; el.removeAttribute("src"); el.load(); return; }
      el.onloadedmetadata = function () { if (isFinite(el.duration)) { v.dur = el.duration; got[v.id] = el.duration; } if (++n % 10 === 0) done(); go(); };
      el.onerror = function () { go(); };
      el.src = videoURL(P.cid, v.id);
    }
    go();
  },
  // notes
  saved: function (m) { this.el.querySelector(".cv-saved").textContent = m; },
  loadNote: function (force) {
    var P = this, v = P.cur; if (!v || (P.dirty && !force)) return;
    P.el.querySelector(".cv-clash").hidden = true;
    getJSON("/api/note?course=" + encodeURIComponent(P.cid) + "&video=" + encodeURIComponent(v.id)).then(function (n) {
      if (P.cur !== v) return;
      P.note = n; P.dirty = false; P.t.disabled = false;
      if (P.t.value !== n.text) P.t.value = n.text;
      P.el.querySelector(".cv-file").textContent = n.file.split(/[\\/]/).slice(-2).join("/");
      P.el.querySelector(".cv-file").title = n.file;
      P.saved(n.exists ? "Saved" : "New note: saves when you type"); P.jumps();
    }).catch(function (e) { P.t.value = ""; P.t.disabled = true; P.saved(""); P.el.querySelector(".cv-file").textContent = e.message; });
  },
  save: function (force, leaving) {
    var P = this, v = P.cur, n = P.note; if (!v || !n) return;
    clearTimeout(P.saveT);
    var text = P.t.value; P.saved("Saving…");
    send("note_save", { course: P.cid, video: v.id, text: text, mtime: n.mtime, force: !!force }, leaving).then(function (j) {
      if (j.status === 409) {
        P.saved("Not saved");
        var c = P.el.querySelector(".cv-clash"); c.hidden = false;
        c.innerHTML = "This note changed in your notes app since the page opened it. " +
          '<button class="quiet" type="button" data-cv="theirs">Load that version</button> or <button class="quiet" type="button" data-cv="mine">keep what\'s here</button>.';
        return;
      }
      n.mtime = j.result.mtime; n.exists = true; P.el.querySelector(".cv-clash").hidden = true;
      if (P.cur === v && P.t.value === text) { P.dirty = false; P.saved("Saved"); }
    }).catch(function (e) { P.saved("Not saved: " + e.message); });
  },
  stamp: function () {
    var t = this.t, s = "[" + clock(this.v.currentTime) + "] ", a = t.selectionStart, b = t.selectionEnd;
    var lead = a > 0 && t.value[a - 1] !== "\n" ? "\n" : "";
    t.value = t.value.slice(0, a) + lead + s + t.value.slice(b);
    t.selectionStart = t.selectionEnd = a + lead.length + s.length; t.focus();
    t.dispatchEvent(new Event("input"));
  },
  jumps: function () {                                  // the times written in the note, as buttons that jump the video there
    var seen = {}, out = [], rx = /\[(?:(\d+):)?(\d{1,2}):(\d{2})\]/g, m;
    while ((m = rx.exec(this.t.value))) {
      var s = (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]);
      if (!seen[s]) { seen[s] = 1; out.push('<button class="quiet" type="button" data-cv-jump="' + s + '">' + esc(m[0].slice(1, -1)) + "</button>"); }
    }
    this.el.querySelector(".cv-jumps").innerHTML = out.length ? "Jump to " + out.join(" ") : "";
  }
};

function typing(e) { var t = e.target; return t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT" || t.isContentEditable); }
document.addEventListener("keydown", function (e) {                    // [ slower, ] faster, while the Skills page shows and no box has the keys
  if ((e.key !== "[" && e.key !== "]") || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
  var sk = document.getElementById("skills"); if (!sk || sk.hidden) return;
  var p = Object.keys(mounted).map(function (k) { return mounted[k]; })[0]; if (!p) return;
  p.step(e.key === "]" ? 1 : -1, false); e.preventDefault();
});
window.addEventListener("pagehide", function () { Object.keys(mounted).forEach(function (k) { var p = mounted[k]; p.close(); p.flush(true); if (p.dirty) p.save(false, true); }); });
window.addEventListener("focus", function () { Object.keys(mounted).forEach(function (k) { mounted[k].loadNote(); }); });   // edited in Obsidian meanwhile: show it
window.addEventListener("hashchange", function () { if (location.hash !== "#skills") Object.keys(mounted).forEach(function (k) { if (!mounted[k].v.paused) mounted[k].v.pause(); }); });

window.CoursePanel = {
  /* the panel for one course inside el; made once and kept, so playback survives the Skills page redrawing around it */
  mount: function (cid) {
    if (!mounted[cid]) { var el = document.createElement("div"); el.className = "cv"; mounted[cid] = new Panel(el, cid); mounted[cid].load(); }
    return mounted[cid].el;
  }
};
})();
