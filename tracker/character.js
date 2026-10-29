/* "Your character" (#character, D43, 2026-10-28): the townsperson who lives in the street and lights each new light.
   Start from one of the townsfolk (some of them Amsterdam ones: King's Day, Volendam, a herring stand...), then change
   every part: hair and face, hat, top and its pattern, neck, legs, shoes, what they hold, a bird or cat on the shoulder,
   something on the back. The parts, palettes and presets are in /character-parts.json (the server checks saves against
   the same file). The preview is drawn by the street's own sprite code, at the door of a house with the windows you've lit. */
(function () {
"use strict";

var DEFAULT = { coat: "#3a4a6a", hairStyle: "short", hair: "#2a1d14", neck: "scarf", neckCol: "#c8a050", back: "satchel", backCol: "#6a4a2a", legs: "#2a2a34" };   // the street's own default
var S = null, PARTS = null, saved = null, cur = null, root = null, house = null;
var $ = function (sel) { return root.querySelector(sel); };
var copy = function (o) { return JSON.parse(JSON.stringify(o || {})); };
var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

function migrate(o) {                                         // the first version's options, in today's parts
  var v = copy(o);
  if (v.glasses === true) v.glasses = "round";
  if (v.long) { v.top = "long"; delete v.long; }
  if (v.scarf) { v.neck = "scarf"; v.neckCol = v.scarf; delete v.scarf; }
  if (v.beard) { v.facial = "beard"; v.facialCol = v.beard; delete v.beard; }
  if (v.bag) { v.back = "satchel"; v.backCol = v.bag; delete v.bag; }
  ["bread", "bouquet", "cup"].forEach(function (k) { if (v[k]) { v.hold = k === "bouquet" ? "flowers" : k === "cup" ? "coffee" : k; delete v[k]; } });
  return v;
}
function rows() { return PARTS.groups.reduce(function (a, g) { return a.concat(g.rows); }, []); }
function shown(r) {
  var test = function (w) { return w && w[1].indexOf(cur[w[0]] || "") >= 0; };
  if (r.unless && test(r.unless)) return false;
  if (r.when || r.orWhen) return test(r.when) || test(r.orWhen);
  return true;
}
function set(key, v) {
  delete cur.preset;
  if (v === "" || v === false || v === undefined || v === null) delete cur[key]; else cur[key] = v;
  render();
}

function rowHtml(r) {
  var v = cur[r.key], html = "";
  if (r.colours) {
    if (r.none) html += '<button type="button" class="ch-sw ch-none" data-k="' + r.key + '" data-v="" aria-pressed="' + !v + '">' + esc(r.none) + "</button>";
    html += PARTS.palettes[r.colours].map(function (c) {
      return '<button type="button" class="ch-sw" data-k="' + r.key + '" data-v="' + c + '" aria-pressed="' + (v === c) + '" aria-label="' + esc(r.label) + " " + c + '" style="background:' + c + '"></button>';
    }).join("");
  } else if (r.flag) {
    html = '<button type="button" class="ch-opt" data-k="' + r.key + '" data-flag="1" aria-pressed="' + !!v + '">' + (v ? "Yes" : "No") + "</button>";
  } else {
    html = r.choices.map(function (o) { return '<button type="button" class="ch-opt" data-k="' + r.key + '" data-v="' + o[0] + '" aria-pressed="' + ((v || "") === o[0] || (!v && o === r.choices[0])) + '">' + esc(o[1]) + "</button>"; }).join("");
  }
  return '<div class="ch-row"><span class="ch-label">' + esc(r.label) + '</span><div class="ch-ctl">' + html + "</div></div>";
}
function controls() {
  return PARTS.groups.map(function (g) {
    var inner = g.rows.filter(shown).map(rowHtml).join("");
    return inner ? '<h3 class="ch-group">' + esc(g.label) + "</h3>" + inner : "";
  }).join("");
}

function drawSprite(g, opts, x, footY, frame) {
  var img = S.drawPerson(opts), fw = img.width / 3, fh = img.height;
  g.drawImage(img, (frame || 0) * fw, 0, fw, fh, Math.round(x - fw / 2), footY - fh, fw, fh);
}
/* The live preview is the real street (he asked to see what it will actually look like): while this page is open, the
   street's canvas moves into the preview box and shows your character close up by a door, at night, with its lamps,
   shadows and blur. It goes back to the sidebar when you leave the page or open the street. */
var parked = null, stageObs = null, loading = false;
function stageSize() {
  var box = $("#ch-stage"); if (!box || !parked) return;
  var w = Math.max(80, Math.round(box.clientWidth)), h = Math.max(80, Math.round(box.clientHeight));
  S.setFrame({ w: w, h: h, rect: { x: 0, y: 0, w: w, h: h }, t: 1 });
}
function stageOn() {
  var box = $("#ch-stage"); if (!box || parked || !S) return;
  var c = S.canvas, lit = window.Scene && Scene.litCount ? Scene.litCount() : 0;
  if (!c.parentNode) { setTimeout(stageOn, 300); return; }      // the sidebar hasn't placed it yet
  parked = { parent: c.parentNode, next: c.nextSibling, css: c.style.cssText };
  box.appendChild(c); c.style.cssText = "position:static;display:block;width:100%;height:100%;visibility:visible;opacity:1;cursor:default";
  S.setQuality({ scale: Math.min(window.devicePixelRatio || 1, 2), fps: 60, fx: 1 }); S.lamps("on"); S.setInteractive(false);
  stageSize(); S.showcase(true, lit > 0 ? S.lightX(0) : S.x); S.setCharacter(cur); S.run(true);   // by your first lamp (lit first, nearest home), so the light shows
  if (window.ResizeObserver) { stageObs = new ResizeObserver(stageSize); stageObs.observe(box); }
}
function stageOff() {
  if (!parked || !S) return;
  if (stageObs) { stageObs.disconnect(); stageObs = null; }
  var c = S.canvas;
  S.showcase(false); S.run(false); S.setCharacter(saved);
  parked.parent.insertBefore(c, parked.next); c.style.cssText = parked.css; parked = null;
}
document.addEventListener("street", function (e) { if (e.detail === "open") stageOff(); });   // the street opening takes its canvas back
function drawPreview() {                                      // the 3D view follows cur; the close-up shows its pixels, all three frames
  if (!S) return;
  if (parked) S.setCharacter(cur);
  var cv = $("#ch-sprite"); if (!cv) return;
  var img = S.drawPerson(cur), g = cv.getContext("2d");
  cv.width = img.width; cv.height = img.height; g.imageSmoothingEnabled = false; g.clearRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0);
}
function drawPresets() {
  root.querySelectorAll(".ch-preset canvas").forEach(function (cv) {
    var p = PARTS.presets.filter(function (q) { return q[0] === cv.getAttribute("data-p"); })[0];
    var g = cv.getContext("2d"); g.imageSmoothingEnabled = false; g.clearRect(0, 0, cv.width, cv.height);
    drawSprite(g, p[2], cv.width / 2, cv.height, 0);
  });
}
function render() {
  $("#ch-ctl").innerHTML = controls();
  root.querySelectorAll(".ch-preset").forEach(function (b) { b.setAttribute("aria-pressed", String(cur.preset === b.getAttribute("data-p"))); });
  var dirty = JSON.stringify(cur) !== JSON.stringify(saved);
  $("#ch-save").disabled = !dirty; $("#ch-undo").hidden = !dirty;
  if (dirty) $("#ch-status").textContent = "";
  drawPreview();
}
function surprise() {                                         // one of everything, at random (calm colours come from the same palettes)
  var any = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  cur = {};
  rows().forEach(function (r) {
    if (!shown(r)) return;
    if (r.colours) cur[r.key] = any(PARTS.palettes[r.colours]);
    else if (r.flag) { if (Math.random() < 0.25) cur[r.key] = true; }
    else { var v = any(r.choices)[0]; if (v) cur[r.key] = v; }
  });
  rows().forEach(function (r) { if (!shown(r)) delete cur[r.key]; });   // a second pass: drop what the first choices hid
  render();
}

function build() {
  root.innerHTML =
    '<h1>Your character</h1>' +
    '<p class="lede">They live in the street. When you log an application, they go and light its light. In the open street, A / D walks them and B gets them on or off their bike.</p>' +
    '<div class="ch-wrap"><div class="ch-views"><div id="ch-stage" class="ch-stage" role="img" aria-label="Your character in the street"></div>' +
    '<p class="small ch-cap">In the street, as it will look. Up close, its three frames:</p><canvas id="ch-sprite" class="ch-sprite" aria-label="Your character up close"></canvas></div>' +
    '<div class="ch-side"><h2 class="ch-h">Start from</h2><div class="ch-presets">' +
    PARTS.presets.map(function (p) { return '<button type="button" class="ch-preset" data-p="' + p[0] + '" aria-pressed="false"><canvas data-p="' + p[0] + '" width="28" height="44"></canvas><span>' + esc(p[1]) + "</span></button>"; }).join("") +
    '</div><p><button type="button" class="quiet" id="ch-random">Surprise me</button></p>' +
    '<h2 class="ch-h">Change anything</h2><div id="ch-ctl"></div>' +
    '<p class="actions ch-end"><button type="button" class="btn primary" id="ch-save" disabled>Save</button> <button type="button" class="quiet" id="ch-undo" hidden>Undo changes</button> <span class="small" id="ch-status"></span></p>' +
    "</div></div>";
  root.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.classList.contains("ch-preset")) { var p = PARTS.presets.filter(function (q) { return q[0] === b.getAttribute("data-p"); })[0]; cur = copy(p[2]); cur.preset = p[0]; render(); return; }
    if (b.id === "ch-random") { surprise(); return; }
    if (b.id === "ch-undo") { cur = copy(saved); render(); return; }
    if (b.id === "ch-save") { save(); return; }
    var k = b.getAttribute("data-k"); if (!k) return;
    set(k, b.hasAttribute("data-flag") ? !cur[k] : b.getAttribute("data-v"));
  });
  drawPresets();
}
function save() {
  $("#ch-save").disabled = true;
  fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patch: { character: cur } }) })
    .then(function (r) { return r.json(); })
    .then(function (r) {
      if (!r.result) throw new Error(r.error || "not saved");
      saved = copy(r.result.character); cur = copy(saved);
      S.setCharacter(saved);
      render(); $("#ch-status").textContent = "Saved.";
    })
    .catch(function (e) { $("#ch-status").textContent = "Not saved: " + e.message; $("#ch-save").disabled = false; });
}

function open() {
  root = document.getElementById("character");
  if (!root) return;
  if (S && PARTS) { cur = copy(saved); render(); stageOn(); return; }
  if (loading) return;                                        // (the page can be asked twice while it loads)
  loading = true;
  root.innerHTML = '<h1>Your character</h1><p class="lede">Loading the street…</p>';
  var json = function (u) { return fetch(u, { cache: "no-store" }).then(function (r) { return r.json(); }); };
  Promise.all([import("/street3d.js"), json("/api/profile"), json("/character-parts.json")])
    .then(function (res) {
      S = res[0].Street; PARTS = res[2];
      saved = migrate(res[1].character || DEFAULT); cur = copy(saved);
      return S.ready;
    })
    .then(function () { build(); render(); if (document.getElementById("character") && !document.getElementById("character").hidden) stageOn(); })
    .catch(function () { root.innerHTML = '<h1>Your character</h1><p class="lede">The character lives in the 3D street, which this browser can’t show (it needs WebGL2).</p>'; });
}

window.CharacterPage = { open: open, leave: stageOff, active: function () { return !!parked; } };
})();
