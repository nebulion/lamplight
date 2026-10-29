/* The street in the sidebar, and opened full screen (2026-10-27): the HD-2D canal from street3d.js.
 *
 *   Scene.mount({rail, svg, sky, nav})   put the street's canvas where the old svg street was; stars + moon in the page sky
 *   Scene.setLit(n, animate)            light the first n lights (fixed order); animate = he just logged one: the camera
 *                                       goes to the new light and it comes on
 *   Scene.labels(fn)                    fn(k) names the application behind light k (shown on hover when open)
 *
 *   Scene.setToday(n, target)           the foreground bulbs: n of target lit (applications sent today)
 *
 * Sidebar (2026-10-28): one building alone, straight on (its flat pixel-art facade in cold moonlight, his lit windows
 * warm), bottom left; every 10 s it fades to the next house. It starts at the house with his newest light.
 * Opening: the 3D street widens from the building to the whole screen; then he can move along the street (drag,
 * scroll, left/right arrows or A/D), pan the view up/down (W/S) and set the camera angle (up/down arrows); both are
 * remembered. Closing reverses it. The 3D street only runs while it's open.
 * If WebGL2 or the module can't load, the old svg street (scene.js) takes over with the same calls.
 */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var opts = null, S = null, lit = 0, todayN = null, labelFor = null, failed = false, open = false, busy = false, ui = null, anim = 0;

  /* ---------------- tonight's moon in the page sky (as in scene.js) ---------------- */
  var PHASE = (function () { var syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14); var age = (((Date.now() - ref) / 864e5) % syn + syn) % syn; return age / syn; })();
  var ILLUM = (1 - Math.cos(2 * Math.PI * PHASE)) / 2, LUM = 0.15 + 0.85 * ILLUM;
  function mo(x) { return Math.round(x * LUM * 1000) / 1000; }
  function f(n) { return Math.round(n * 100) / 100; }
  function phaseName() {
    var p = PHASE;
    if (p < 0.03 || p > 0.97) return "New moon"; if (p < 0.22) return "Waxing crescent"; if (p < 0.28) return "First quarter"; if (p < 0.47) return "Waxing gibbous";
    if (p < 0.53) return "Full moon"; if (p < 0.72) return "Waning gibbous"; if (p < 0.78) return "Last quarter"; return "Waning crescent";
  }
  function rng(seed) { var s = seed % 2147483647; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function moon(parent, mx, my, mr, tag) {
    var defs = el("defs", {}, parent);
    var mg = el("radialGradient", { id: "moonface" + tag, cx: 0.42, cy: 0.4, r: 0.65 }, defs);
    el("stop", { offset: 0, "stop-color": "#f6efdf" }, mg); el("stop", { offset: 1, "stop-color": "#d8cdb6" }, mg);
    var halo = el("radialGradient", { id: "moonhalo" + tag }, defs);
    el("stop", { offset: 0, "stop-color": "#c9d2e0", "stop-opacity": mo(0.04) }, halo); el("stop", { offset: 0.4, "stop-color": "#c9d2e0", "stop-opacity": mo(0.014) }, halo); el("stop", { offset: 1, "stop-color": "#c9d2e0", "stop-opacity": 0 }, halo);
    var p = PHASE, waxing = p < 0.5, rx = Math.abs(Math.cos(2 * Math.PI * p)) * mr, crescent = waxing ? p < 0.25 : p > 0.75;
    var outer = waxing ? 1 : 0, inner = waxing ? (crescent ? 0 : 1) : (crescent ? 1 : 0);
    var litPath = "M" + mx + " " + (my - mr) + " A" + mr + " " + mr + " 0 0 " + outer + " " + mx + " " + (my + mr) + " A" + f(rx) + " " + mr + " 0 0 " + inner + " " + mx + " " + (my - mr) + "Z";
    el("path", { d: litPath }, el("clipPath", { id: "moonlit" + tag }, defs));
    var g = el("g", { class: "moon" }, parent);
    el("title", {}, g).textContent = phaseName() + ", " + Math.round(ILLUM * 100) + "% lit";
    el("circle", { cx: mx, cy: my, r: mr * 7, fill: "url(#moonhalo" + tag + ")" }, g);
    el("circle", { cx: mx, cy: my, r: mr, fill: "#1d1b20", opacity: 0.45 }, g);
    var face = el("g", { "clip-path": "url(#moonlit" + tag + ")" }, g);
    el("circle", { cx: mx, cy: my, r: mr, fill: "url(#moonface" + tag + ")" }, face);
    [[-0.28, -0.22, 0.3, 0.22, -20], [0.12, -0.3, 0.2, 0.14, 10], [0.24, 0.12, 0.26, 0.18, 30], [-0.1, 0.3, 0.2, 0.13, -10], [-0.4, 0.12, 0.12, 0.1, 0], [0.42, -0.05, 0.1, 0.08, 0]].forEach(function (m) {
      el("ellipse", { cx: f(mx + m[0] * mr), cy: f(my + m[1] * mr), rx: f(m[2] * mr), ry: f(m[3] * mr), fill: "#b8ad97", opacity: 0.28, transform: "rotate(" + m[4] + " " + f(mx + m[0] * mr) + " " + f(my + m[1] * mr) + ")" }, face);
    });
    [[0.55, -0.4, 0.07], [0.3, 0.55, 0.06], [-0.5, -0.5, 0.05], [0.65, 0.2, 0.05]].forEach(function (c) {
      el("circle", { cx: f(mx + c[0] * mr), cy: f(my + c[1] * mr), r: f(c[2] * mr), fill: "none", stroke: "#a99f8a", "stroke-width": 0.4, opacity: 0.5 }, face);
    });
  }
  function buildSky() {
    var sky = opts.sky, W = window.innerWidth, H = window.innerHeight, srnd = rng(20261014 + 7);
    while (sky.firstChild) sky.removeChild(sky.firstChild);
    sky.setAttribute("viewBox", "0 0 " + W + " " + H);
    for (var i = 0; i < Math.round((W * H) / 7000); i++) el("circle", { class: "star", cx: f(srnd() * W), cy: f(srnd() * H), r: f(0.3 + srnd() * 0.65), fill: "#e6dccb", opacity: f(0.08 + srnd() * 0.4) }, sky);
    if (W >= 820) moon(sky, W - 120, 104, 19, "page"); else moon(sky, W - 46, opts.nav.getBoundingClientRect().bottom + 42, 13, "page");
  }

  /* ---------------- the sidebar: one building, alone, straight on (2026-10-28) ----------------
     He asked for "literally just one building at a time without any of the surrounding stuff ... with a 0 deg camera
     angle". So the sidebar isn't a 3D view: it's the house's own pixel-art facade (the same images the street is built
     from), in cold moonlight, with exactly the windows his applications have lit. Every 10 s it fades to the next house
     along. When he logs an application it switches to that house and the window comes on. The 3D street only runs while
     it's open, which also saves the GPU. */
  var tile = null, cap = null, art = null, tileX = 0, newK = -1, newT0 = 0;
  var CAROUSEL_MS = 10000, FADE_MS = 1300, carTimer = 0, fading = false;
  /* (later the same day) he found the small corner tile left a lot of dead space: the building now stands big and centred in
     the space under the menu (whole-number scaling, so the pixels stay crisp), its roof and chimney drawn above it, and
     under it a small caption naming the application behind its newest lit window. */
  function tileBox() {                                       // the space under the nav, inside the old svg's box (relative to the rail)
    var s = opts.svg.getBoundingClientRect(), r = opts.rail.getBoundingClientRect(), n = opts.nav.getBoundingClientRect();
    var narrow = window.innerWidth < 820, pad = narrow ? 12 : 24, capH = narrow ? 0 : 52;
    var top = narrow ? s.top - r.top + 8 : Math.max(s.top - r.top, n.bottom - r.top) + 20, bottom = s.bottom - r.top - pad - capH;
    return { left: s.left - r.left + pad, width: s.width - pad * 2, top: top, height: Math.max(80, bottom - top), narrow: narrow };
  }
  function placeTile() {
    if (!tile || !art) return;
    var b = tileBox(), PW = art.PW || art.W, PH = art.PH || art.H, fit = Math.min(b.height / PH, b.width / PW);
    var s = Math.min(3, fit >= 2 ? Math.floor(fit) : fit);   // whole-number scales when it can (crisp pixels), else as big as fits
    var w = PW * s, h = PH * s, x = b.left + (b.width - w) / 2, y = b.top + (b.height - h) / 2;
    tile.style.left = x + "px"; tile.style.top = y + "px"; tile.style.width = w + "px"; tile.style.height = h + "px";
    if (cap) { cap.hidden = b.narrow; cap.style.left = b.left + "px"; cap.style.width = b.width + "px"; cap.style.top = (y + h + 14) + "px"; }
  }
  function caption() {                                       // the application behind this house's newest lit window
    if (!cap || !art || !art.windows) return;
    var k = -1; art.windows.forEach(function (w) { if (w.k < lit && w.k > k) k = w.k; });
    cap.textContent = k >= 0 && labelFor ? labelFor(k) : "";   // nothing when the house has none of his lights yet (no reminders of what's missing)
  }
  function drawTile() {
    if (!tile || !art || !art.day) return;                   // (an early, remembered picture is left as it is)
    var rf = art.roof || {}, PXm = 16, ox = 2, topM = Math.max(rf.ridge || 0, rf.chimney ? rf.chimney.top + 0.4 : 0);
    art.PW = art.W + ox * 2; art.PH = Math.max(art.H, Math.ceil(topM * PXm) + 2);
    var oy = art.PH - art.H, Y = function (m) { return art.PH - Math.round(m * PXm); };
    if (tile.width !== art.PW || tile.height !== art.PH) { tile.width = art.PW; tile.height = art.PH; }
    var g = tile.getContext("2d"), now = performance.now(), more = false;
    g.imageSmoothingEnabled = false; g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.filter = "none";
    g.clearRect(0, 0, art.PW, art.PH);
    if (rf.tiles) {                                          // the roof behind the facade: its slopes and tiles, as seen straight on
      g.fillStyle = g.createPattern(rf.tiles, "repeat");
      g.beginPath();
      if (rf.gable) { g.moveTo(ox, Y(rf.eave)); g.lineTo(ox + art.W, Y(rf.eave)); g.lineTo(ox + art.W / 2, Y(rf.ridge)); }
      else { g.rect(ox, Y(rf.ridge), art.W, Y(rf.top) - Y(rf.ridge) + 1); }
      g.closePath(); g.fill();
      g.fillStyle = "#a8a090";                                // the light verge boards / the ridge cap
      if (rf.gable) for (var i = 0; i <= art.W / 2; i++) { var yy = Y(rf.eave) + (Y(rf.ridge) - Y(rf.eave)) * i / (art.W / 2); g.fillRect(ox + i, Math.round(yy), 1, 1); g.fillRect(ox + art.W - 1 - i, Math.round(yy), 1, 1); }
      else g.fillRect(ox, Y(rf.ridge), art.W, 1);
      if (!rf.gable && rf.dormers) for (var d = 0; d < rf.dormers; d++) {   // white dormers on the front slope
        var dw = Math.round(Math.min(1.4, art.W / PXm * 0.24) * PXm), dh = Math.round(1.45 * PXm), dx = Math.round(ox + art.W * (d + 1) / (rf.dormers + 1) - dw / 2), dy = Y(rf.top + (rf.ridge - rf.top) * 0.18) - dh;
        g.fillStyle = "#d8d2c4"; g.fillRect(dx, dy, dw, dh); g.fillStyle = "#6a6e74"; g.fillRect(dx - 2, dy - 2, dw + 4, 2);
        g.fillStyle = "#121822"; g.fillRect(dx + 3, dy + 3, Math.floor(dw / 2) - 4, dh - 6); g.fillRect(dx + Math.ceil(dw / 2) + 1, dy + 3, Math.floor(dw / 2) - 4, dh - 6);
      }
    }
    if (rf.chimney) {                                        // the brick stack on the party wall, with its stone cap
      var cx = Math.round(ox + art.W * rf.chimney.x) - 5, ct = Y(rf.chimney.top), cb = Y(rf.chimney.base);   // rising out of the roof, as in the street
      g.fillStyle = "#6b4430"; g.fillRect(cx, ct, 10, cb - ct);
      g.fillStyle = "#4f3122"; for (var yc = ct + 3; yc < cb; yc += 4) g.fillRect(cx, yc, 10, 1);
      g.fillStyle = "#8f877a"; g.fillRect(cx - 1, ct - 2, 12, 2); g.fillStyle = "#8a4a30"; g.fillRect(cx + 2, ct - 6, 2, 4); g.fillRect(cx + 6, ct - 6, 2, 4);
    }
    g.drawImage(art.day, ox, oy);                             // the house itself, evenly lit: no moonlight, shadows or effects (they come in as it opens)
    var hero = heroPlan(now);                                 // your character comes to light it (D43), if it's this house's window
    art.windows.forEach(function (w) {                        // his lit windows
      var a = w.k < lit ? 1 : 0;
      if (w.k === newK) { a = Math.min(1, Math.max(0, (now - newT0) / 1000 - (hero ? HT.light : 0)) / 1.6); if (a < 1) more = true; }
      if (a > 0) { g.globalAlpha = a; g.drawImage(art.lit, w.x, w.y, w.w, w.h, ox + w.x, oy + w.y, w.w, w.h); }
    });
    g.globalAlpha = 1;
    if (hero) { drawHero(g, hero, ox, oy); more = more || hero.going; }
    filmLook(g, art.PW, art.PH, art.look);
    caption(); placeTile();
    if (more) requestAnimationFrame(drawTile); else rememberTile();
  }
  /* Your character in the picture (D43). When an application lights one of this house's windows, they walk up to the
     door, go in (the doorway glows), the window comes on, and they come out and walk on, leaving the house alone again.
     Seconds from the log; drawn 1:1 in the picture's pixels. */
  var HT = { open: 2.2, gone: 3.1, light: 3.7, back: 5.5, leave: 6.6, end: 8.8 };
  function heroPlan(now) {
    var ch = S && S.character && S.character(), d = art.door;
    if (!ch || !d || newK < 0 || !art.windows.some(function (w) { return w.k === newK; })) return null;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
    var t = (now - newT0) / 1000;
    return t < HT.end ? { t: t, ch: ch, d: d, going: true } : null;
  }
  function drawHero(g, h, ox, oy) {
    var t = h.t, d = h.d, img = h.ch.image, fw = img.width / 3, fh = img.height;
    var door = ox + d.x + d.w / 2, foot = oy + d.y + d.h + 1, from = ox - 4, to = ox + art.W + 4;
    var seg = function (a, b) { return Math.min(1, Math.max(0, (t - a) / (b - a))); };
    var glow = Math.max(seg(HT.open, HT.open + 0.5) - seg(HT.gone, HT.gone + 0.4), seg(HT.back, HT.back + 0.4) - seg(HT.back + 0.8, HT.back + 1.2));
    if (glow > 0) { g.fillStyle = "rgba(255,179,92," + (0.92 * glow).toFixed(3) + ")"; g.fillRect(ox + d.x, oy + d.y, d.w, d.h); }
    var x, alpha = 1, walking = false, dir = 1;
    if (t < HT.open) { x = from + (door - from) * seg(0, HT.open); walking = true; alpha = seg(0, 0.4); }
    else if (t < HT.back + 0.4) { x = door; alpha = t < HT.gone ? 1 - seg(HT.gone - 0.4, HT.gone) : seg(HT.back, HT.back + 0.4); }
    else if (t < HT.leave) x = door;
    else { x = door + (to - door) * seg(HT.leave, HT.end); walking = true; alpha = 1 - seg(HT.end - 0.4, HT.end); }
    if (alpha <= 0) return;
    var f = walking ? 1 + Math.floor(t * 5) % 2 : 0;
    g.save(); g.globalAlpha = alpha; g.translate(Math.round(x), 0); g.scale(dir, 1);
    g.drawImage(img, f * fw, 0, fw, fh, -Math.round(fw / 2), foot - fh, fw, fh);
    g.restore();
  }
  /* The 3D street shows the house through the renderer's film-style colour curve (ACES, as three.js does it) under an even
     fill; the flat picture showed the raw texture colours, so the red looked different when the street took over (he spotted
     it). The picture now goes through the same fill and curve, so the two match. */
  var S2L = [], L2S = function (v) { v = Math.max(0, Math.min(1, v)); return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); };
  for (var si = 0; si < 256; si++) { var sv = si / 255; S2L.push(sv <= 0.04045 ? sv / 12.92 : Math.pow((sv + 0.055) / 1.055, 2.4)); }
  function aces(r, gg, b, k) {                                // three.js ACESFilmicToneMapping
    r *= k; gg *= k; b *= k;
    var x = 0.59719 * r + 0.35458 * gg + 0.04823 * b, y = 0.07600 * r + 0.90834 * gg + 0.01566 * b, z = 0.02840 * r + 0.13383 * gg + 0.83777 * b;
    var fit = function (v) { return (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081); };
    x = fit(x); y = fit(y); z = fit(z);
    return [1.60475 * x - 0.53108 * y - 0.07367 * z, -0.10208 * x + 1.10813 * y - 0.00605 * z, -0.00327 * x - 0.07276 * y + 1.07602 * z];
  }
  function filmLook(g, W, H, look) {
    if (!look) return;
    var img; try { img = g.getImageData(0, 0, W, H); } catch (e) { return; }
    var d = img.data, k = look.fill * look.exposure / 0.6;
    for (var i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      var o = aces(S2L[d[i]], S2L[d[i + 1]], S2L[d[i + 2]], k); d[i] = L2S(o[0]); d[i + 1] = L2S(o[1]); d[i + 2] = L2S(o[2]);
    }
    g.putImageData(img, 0, 0);
  }
  /* (speed, 2026-10-28) the last building shown is remembered as a small picture, so on the next visit the sidebar
     shows it at once, before the street has been built */
  var TILE_KEY = "street-tile-picture", remTimer = 0;
  var SEEN_KEY = "street-seen";                               // lights the open street has already shown being lit (D43)
  function seenGet() { var v = NaN; try { v = parseInt(localStorage.getItem(SEEN_KEY), 10); } catch (e) { /* private window */ } return isFinite(v) ? v : null; }
  function seenSet(n) { try { localStorage.setItem(SEEN_KEY, String(n)); } catch (e) { /* private window */ } }
  function rememberTile() {
    clearTimeout(remTimer);
    remTimer = setTimeout(function () { try { localStorage.setItem(TILE_KEY, JSON.stringify({ png: tile.toDataURL("image/png"), W: art.PW, H: art.PH, cap: cap ? cap.textContent : "" })); localStorage.setItem(TILE_KEY + "-x", String(tileX)); } catch (e) { /* full or private */ } }, 300);
  }
  function showRemembered() {                                // returns true if a picture was shown
    var saved = null; try { saved = JSON.parse(localStorage.getItem(TILE_KEY) || "null"); } catch (e) { saved = null; }
    if (!saved || !saved.png || !saved.W) return false;
    var img = new Image();
    img.onload = function () {
      if (art && art.day) return;                             // the real one is already there
      art = { W: saved.W, H: saved.H, early: true }; tile.width = saved.W; tile.height = saved.H;
      var g = tile.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0);
      if (cap && saved.cap) cap.textContent = saved.cap;
      placeTile(); fade(tile, 1, 400); if (cap) fade(cap, 1, 400);
    };
    img.src = saved.png;
    return true;
  }
  function showHouse(x) { art = S.houseArt(x); if (!art) return; tileX = art.x; tile.setAttribute("aria-label", "One house on the canal; its lit windows are applications you sent."); placeTile(); drawTile(); }
  function nextHouse() { var hs = S.houses(), L = S.loop, x = ((tileX % L) + L) % L; for (var i = 0; i < hs.length; i++) if (hs[i] > x + 0.5) return hs[i]; return hs[0]; }
  function fade(el, to, ms, done) {
    var a = null;
    try { a = el.animate([{ opacity: to ? 0 : 1 }, { opacity: to }], { duration: ms, easing: "ease-in-out", fill: "forwards" }); } catch (e) { /* old browser */ }
    var fin = false, end = function () { if (fin) return; fin = true; if (a) a.cancel(); el.style.opacity = to ? "" : "0"; if (done) done(); };
    if (a) a.onfinish = end; setTimeout(end, ms + 300);       // hidden tabs don't finish animations
  }
  function carousel(delay) {
    clearTimeout(carTimer);
    carTimer = setTimeout(function () {
      if (!art || open || busy || fading || document.hidden) { carousel(CAROUSEL_MS); return; }
      fading = true;
      if (cap) fade(cap, 0, FADE_MS);
      fade(tile, 0, FADE_MS, function () {
        if (open || busy) { tile.style.opacity = ""; fading = false; carousel(CAROUSEL_MS); return; }
        showHouse(nextHouse());
        if (cap) fade(cap, 1, FADE_MS);
        fade(tile, 1, FADE_MS, function () { fading = false; carousel(CAROUSEL_MS); });
      });
    }, delay);
  }
  function tileRect() { return tile.getBoundingClientRect(); }
  function picSize() { return art && art.PW ? { w: art.PW / 16, h: art.PH / 16 } : null; }   // the picture in metres (16 px per metre)
  function openQuality() { return { scale: Math.min(window.devicePixelRatio || 1, 1.5, 1280 / window.innerWidth), fps: 60, fx: 1 }; }
  function frameAt(u) {                                       // a still frame between the sidebar (0) and full screen (1); used on resize
    var W = window.innerWidth, H = window.innerHeight, r = big || tileRect(), L = function (a, b) { return a + (b - a) * u; };
    S.setFrame({ w: W, h: H, rect: { x: L(r.x !== undefined ? r.x : r.left, 0), y: L(r.y !== undefined ? r.y : r.top, 0), w: L(r.w || r.width, W), h: L(r.h || r.height, H) }, t: u });
  }

  /* ---------------- opening and closing (2026-10-28) ----------------
     First five steps; he then asked for quicker, smoother, fewer: three overlapping steps, ~2.6 s.
       1 the flat building glides to the centre of the screen as it grows; the page goes dark behind it
       2 the street opens outward from the building's outline while the night comes up, still straight on (0°):
         moonlight and shadow, then his lamps one by one, nearest first (only lamps he has lit; it adds none)
       3 the camera tilts down to his angle, pan and zoom, while blur, glow, moonbeams and today's bulbs settle in
     Any click or key skips to the end. Closing runs it backwards, faster. Times in ms; the steps overlap. */
  /* (later, his correction: the building must clearly finish growing before anything else; then, WHILE the street opens
     out, the lighting comes in fully; closing keeps the lighting at 0° and loses it only as it shrinks back to the one
     building) */
  /* (then: "none of anything should be instant": longer steps; the 3D street takes over from the picture over 0.4 s; the
     outline grows at an even pace on screen (geometrically) so it is still opening near the end; lamps spread over the
     whole night step; the moon, bulbs and foreground fade instead of popping) */
  var OPEN = { lift: [0, 1100], reveal: [1250, 3000], night: [1250, 2900], lamps: [1600, 3300], camera: [3000, 4400], air: [3100, 4600] }, OPEN_MS = 4600;
  var CLOSE = { air: [0, 600], camera: [0, 1300], reveal: [1300, 2500], night: [1700, 2550], lift: [2550, 3250] }, CLOSE_MS = 3250;
  var back = null, big = null, base = null, mask = null, sEnd = 12, playing = 0, skip = false;
  function ease(k) { return 0.5 - Math.cos(Math.PI * k) / 2; }   // gentle at both ends (softer than a cubic: the steps flow into each other)
  function lifted(u) {                                        // the picture, u of the way from its place to the centre (top-left origin)
    tile.style.transformOrigin = "0 0";
    tile.style.transform = "translate(" + f((big.x - base.x) * u) + "px," + f((big.y - base.y) * u) + "px) scale(" + (1 + (big.k - 1) * u) + ")";
  }
  function ph(span, ms) { return ease(Math.min(1, Math.max(0, (ms - span[0]) / (span[1] - span[0])))); }
  function measure() {                                        // the picture's own place, and where the lifted building sits: the centre, ~60% of the screen's height
    tile.style.transform = ""; var r = tile.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
    var k = Math.max(1, Math.min(H * 0.6 / r.height, W * 0.42 / r.width));
    base = { x: r.left, y: r.top, w: r.width, h: r.height };
    big = { x: (W - r.width * k) / 2, y: (H - r.height * k) / 2, w: r.width * k, h: r.height * k, k: k };
    sEnd = Math.max(2.4 * window.innerWidth / big.w, 2.4 * window.innerHeight / big.h, 5);
  }
  function makeMask() {                                       // the building's outline, soft-edged, as a mask image for the 3D view
    var pad = 6, c = document.createElement("canvas"); c.width = tile.width + pad * 2; c.height = tile.height + pad * 2;
    var g = c.getContext("2d"); g.filter = "blur(1.5px)"; g.drawImage(tile, pad, pad); g.filter = "none";
    g.globalCompositeOperation = "source-in"; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    mask = { url: "url(" + c.toDataURL("image/png") + ")", pad: pad };
  }
  function setMask(s) {                                       // s = 1: exactly the lifted building; bigger: its outline grown outward around its centre
    var st = S.canvas.style;
    if (s === null) { st.maskImage = st.webkitMaskImage = ""; return; }
    var u = big.w / tile.width * s, mw = (tile.width + mask.pad * 2) * u, mh = (tile.height + mask.pad * 2) * u, cx = big.x + big.w / 2, cy = big.y + big.h / 2;
    st.maskImage = st.webkitMaskImage = mask.url; st.maskRepeat = st.webkitMaskRepeat = "no-repeat";
    st.maskSize = st.webkitMaskSize = mw + "px " + mh + "px"; st.maskPosition = st.webkitMaskPosition = (cx - mw / 2) + "px " + (cy - mh / 2) + "px";
  }
  function view(cam, light, fx) {                             // the 3D frame: from the lifted building (cam 0) to the whole screen (cam 1)
    var W = window.innerWidth, H = window.innerHeight, L = function (a, b) { return a + (b - a) * cam; };
    S.setFrame({ w: W, h: H, rect: { x: L(big.x, 0), y: L(big.y, 0), w: L(big.w, W), h: L(big.h, H) }, t: cam, cam: cam, light: light, fx: fx });
  }
  function play(total, step, done) {                          // drives one timeline; a click or key skips to its end
    cancelAnimationFrame(anim); skip = false;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) skip = true;
    var t0 = performance.now(), id = ++playing, end = function () { if (id !== playing) return; playing++; step(total); done(); };
    function frame(now) { if (id !== playing) return; var ms = skip ? total : now - t0; step(Math.min(ms, total)); if (ms >= total) end(); else anim = requestAnimationFrame(frame); }
    anim = requestAnimationFrame(frame);
    setTimeout(function () { if (id === playing) end(); }, total + 900);   // hidden tabs stall frames: never get stuck
  }
  function skipIt() { if (busy) skip = true; }
  document.addEventListener("pointerdown", skipIt, true); document.addEventListener("keydown", skipIt, true);

  function openStreet() {
    if (!S || open || busy || !art || !art.day) return;
    open = busy = true;
    ui = document.createElement("div"); ui.className = "street-ui";
    ui.innerHTML = '<button class="street-sound"></button><button class="street-close">Close</button><p class="street-tip" hidden></p><p class="street-angle" hidden></p>';
    document.body.appendChild(ui);
    ui.querySelector(".street-close").addEventListener("click", closeStreet);
    // the sidebar's sound switch is hidden while the street is open, so it has a twin here (2026-10-28, he asked for one)
    var snd = document.getElementById("snd"), twin = ui.querySelector(".street-sound");
    var mirror = function () { if (!snd) { twin.hidden = true; return; } twin.textContent = snd.textContent; twin.setAttribute("aria-pressed", snd.getAttribute("aria-pressed")); };
    twin.addEventListener("click", function () { if (snd) snd.click(); mirror(); }); mirror();
    document.body.classList.add("street-open");
    document.dispatchEvent(new CustomEvent("street", { detail: "open" }));
    clearTimeout(carTimer); fading = false; tile.getAnimations && tile.getAnimations().forEach(function (a) { a.cancel(); }); tile.style.opacity = ""; tile.style.visibility = "";
    measure(); makeMask();
    back = document.createElement("div"); back.className = "street-back"; document.body.appendChild(back);
    var c = S.canvas; c.classList.add("free"); c.style.position = "fixed"; c.style.cursor = "grab"; c.style.left = c.style.top = "0px"; c.style.width = "100vw"; c.style.height = "100vh";
    c.style.opacity = "0"; c.style.visibility = ""; c.style.clipPath = "";
    S.setPortrait(tileX, 0, picSize());
    var seen = seenGet(); if (seen === null || seen > lit) seen = lit;   // the first time: nothing to catch up on
    var todo = lit > seen ? S.replay(seen) : 0; seenSet(lit);        // logged while it was closed: dark again, your character lights them once it's open
    S.lamps("off"); S.run(true); S.setQuality(openQuality());
    view(0, 0, 0); setMask(1); S.step(1);
    var lampsOn = false;
    play(OPEN_MS, function (ms) {
      var lift = ph(OPEN.lift, ms), rev = ph(OPEN.reveal, ms), night = ph(OPEN.night, ms), cam = ph(OPEN.camera, ms), air = ph(OPEN.air, ms);
      lifted(lift); back.style.opacity = lift;                                                                    // 1 the picture glides to the centre and grows
      c.style.opacity = Math.min(1, Math.max(0, (ms - OPEN.reveal[0] + 200) / 400));                             // the 3D house takes over from it (they match)
      if (rev < 1) setMask(Math.pow(sEnd, rev)); else setMask(null);                                           // 2 the street opens outward from its outline...
      if (!lampsOn && ms >= OPEN.lamps[0]) { lampsOn = true; S.lamps("reveal", OPEN.lamps[1] - OPEN.lamps[0]); }  // ...as night comes up, his lamps one by one
      view(cam, night, air);                                                                                     // 3 camera and air
    }, function () {
      if (!lampsOn) S.lamps("on");
      S.setQuality({ fx: 1 }); S.setInteractive(true); tile.style.visibility = "hidden"; tile.style.transform = "";
      ui.classList.add("shown"); ui.querySelector(".street-close").focus({ preventScroll: true });
      busy = false;
      if (todo) errandNote();
    });
  }
  function errandNote() {                                     // "lighting 3 new lights" while your character goes round; Space skips
    var lab = ui && ui.querySelector(".street-angle"); if (!lab) return;
    clearTimeout(angleTimer);
    var tick = function () {
      var n = S.errands();
      if (!ui || !n) { if (lab) lab.hidden = true; return; }
      lab.textContent = "Lighting " + n + (n === 1 ? " new light" : " new lights") + ". Space skips."; lab.hidden = false;
      angleTimer = setTimeout(tick, 400);
    };
    tick();
  }
  function closeStreet() {
    if (!open || busy) return;
    busy = true;
    S.walk(1, false); S.walk(-1, false); S.finish();           // everything still to light comes on before it closes
    document.dispatchEvent(new CustomEvent("street", { detail: "close" }));
    S.setInteractive(false); S.lamps("on");
    if (ui) { ui.remove(); ui = null; }
    var hx = S.setPortrait(S.x, CLOSE.camera[1], null);             // glide to the nearest house: closing ends on it, flat, where its picture goes
    if (hx !== null) { showHouse(hx); S.setPortrait(hx, CLOSE.camera[1], picSize()); }
    measure(); makeMask();
    lifted(1); tile.style.visibility = ""; tile.style.opacity = "";
    var c = S.canvas;
    play(CLOSE_MS, function (ms) {
      var air = 1 - ph(CLOSE.air, ms), cam = 1 - ph(CLOSE.camera, ms), night = 1 - ph(CLOSE.night, ms), rev = 1 - ph(CLOSE.reveal, ms), lift = 1 - ph(CLOSE.lift, ms);
      view(cam, night, air);
      if (ms >= CLOSE.reveal[0]) setMask(Math.pow(sEnd, rev));
      c.style.opacity = Math.min(1, Math.max(0, 1 - (ms - CLOSE.night[1] + 100) / 400));                          // the picture takes back over
      lifted(lift); if (back) back.style.opacity = lift;
    }, function () {
      c.classList.remove("free"); c.style.visibility = "hidden"; c.style.opacity = ""; setMask(null); S.run(false);
      tile.style.transform = ""; if (back) { back.remove(); back = null; }
      document.body.classList.remove("street-open");
      open = busy = false;
      carousel(CAROUSEL_MS);
    });
  }
  function showTip(e) {
    if (!open || busy || !ui) return;
    var tip = ui.querySelector(".street-tip"), k = S.pick(e.clientX, e.clientY);
    if (k < 0 || k >= lit || !labelFor) { tip.hidden = true; S.canvas.style.cursor = "grab"; return; }
    tip.textContent = labelFor(k); tip.hidden = false; S.canvas.style.cursor = "pointer";
    tip.style.left = Math.min(window.innerWidth - 260, Math.max(12, e.clientX - 120)) + "px";
    tip.style.top = Math.max(12, e.clientY - 64) + "px";
  }
  var angleTimer = 0;
  document.addEventListener("keydown", function (e) {
    if (!open) return;
    if (e.key === "Escape") closeStreet();
    else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && ui) {   // the arrows turn the camera (his request); A/D move along the street
      e.preventDefault();
      var yd = S.turn(e.key === "ArrowRight" ? 1 : -1), labY = ui.querySelector(".street-angle");
      labY.textContent = yd === 0 ? "Facing the street" : "Turned " + Math.abs(yd) + "° " + (yd > 0 ? "right" : "left"); labY.hidden = false;
      clearTimeout(angleTimer); angleTimer = setTimeout(function () { if (labY) labY.hidden = true; }, 1600);
    }
    else if ((e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") && ui && !e.ctrlKey && !e.metaKey) {   // zoom (the wheel zooms too)
      e.preventDefault();
      var z = S.zoom(e.key === "+" || e.key === "=" ? 1 : -1), lab3 = ui.querySelector(".street-angle");
      lab3.textContent = "Zoom " + z + "%"; lab3.hidden = false;
      clearTimeout(angleTimer); angleTimer = setTimeout(function () { if (lab3) lab3.hidden = true; }, 1600);
    }
    else if (e.key === " " && ui && S.errands()) { e.preventDefault(); S.finish(); }   // skip the lighting round
    else if ((e.key === "b" || e.key === "B") && ui && !busy && !e.ctrlKey && !e.metaKey && !e.altKey) {   // on or off the bike (he asked)
      e.preventDefault();
      var on = S.bike(), labB = ui.querySelector(".street-angle");
      labB.textContent = on ? "On the bike" : "On foot"; labB.hidden = false;
      clearTimeout(angleTimer); angleTimer = setTimeout(function () { if (labB) labB.hidden = true; }, 1600);
    }
    else if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[wasd]$/i.test(e.key)) {   // WASD: A/D walk your character (D43), W/S pan the view up/down (more roof / more canal)
      e.preventDefault(); var k = e.key.toLowerCase();
      if (k === "a" || k === "d") { if (!busy) S.walk(k === "d" ? 1 : -1, true); }
      else if (ui) {
        var m = S.pan(k === "w" ? 1 : -1), lab2 = ui.querySelector(".street-angle");
        lab2.textContent = m > 0 ? "View " + m + " m up" : m < 0 ? "View " + (-m) + " m down" : "View level"; lab2.hidden = false;
        clearTimeout(angleTimer); angleTimer = setTimeout(function () { if (lab2) lab2.hidden = true; }, 1600);
      }
    }
    else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && ui) {   // the camera angle (his setting, remembered)
      e.preventDefault();
      var deg = S.tilt(e.key === "ArrowUp" ? 1 : -1), lab = ui.querySelector(".street-angle");
      lab.textContent = "Camera angle " + deg + "°"; lab.hidden = false;
      clearTimeout(angleTimer); angleTimer = setTimeout(function () { if (lab) lab.hidden = true; }, 1600);
    }
  });

  document.addEventListener("keyup", function (e) { if (S && /^[ad]$/i.test(e.key)) S.walk(e.key.toLowerCase() === "d" ? 1 : -1, false); });
  window.addEventListener("blur", function () { if (S) { S.walk(1, false); S.walk(-1, false); } });   // a key let go in another window

  /* ---------------- start, or fall back to the svg street ---------------- */
  function fallback(err) {
    if (failed) return; failed = true;
    console.warn("3D street off, using the svg street:", err);
    if (tile) { tile.remove(); tile = null; } if (cap) { cap.remove(); cap = null; }
    var load = function (src, cb) { var s = document.createElement("script"); s.src = src; s.onload = cb; s.onerror = cb; document.body.appendChild(s); };
    opts.svg.style.visibility = "";
    load("/scene.js", function () {
      if (!window.Scene || !window.Scene.bake) return;
      window.Scene.mount(opts); if (labelFor) window.Scene.labels(labelFor); window.Scene.setLit(lit, false);
      load("/light.js", function () { try { if (window.Light) window.Light.init(); } catch (e) { console.warn("light layer off:", e); } });
    });
  }
  function start() {
    var probe = document.createElement("canvas");
    if (!probe.getContext("webgl2")) return fallback("no WebGL2");
    tile = document.createElement("canvas"); tile.className = "street-tile"; tile.setAttribute("role", "img"); tile.style.opacity = "0";
    opts.svg.style.visibility = "hidden";                     // keeps its place in the layout; the tile sits in its bottom left
    opts.svg.parentNode.insertBefore(tile, opts.svg.nextSibling);
    cap = document.createElement("p"); cap.className = "street-cap"; cap.style.opacity = "0"; opts.svg.parentNode.insertBefore(cap, tile.nextSibling);
    tile.addEventListener("click", function () { if (!open && S && art && art.day) openStreet(); });
    showRemembered();                                         // the last building, at once
    var remX = null; try { remX = parseFloat(localStorage.getItem(TILE_KEY + "-x")); } catch (e) { remX = null; }
    var go = function () {                                    // the street is built after the page has painted (it takes ~2 s of work)
      import("/street3d.js").then(function (m) {
        S = m.Street;
        var c = S.canvas;
        c.setAttribute("role", "img"); c.setAttribute("aria-label", opts.svg.getAttribute("aria-label") || "The street");
        c.style.position = "absolute"; c.style.visibility = "hidden"; c.style.width = c.style.height = "1px";   // only shown when opened
        opts.svg.parentNode.insertBefore(c, tile.nextSibling);
        S.setLit(lit, false); if (todayN) S.setToday(todayN[0], todayN[1]);
        c.addEventListener("click", function (e) { if (open && !S.dragged()) showTip(e); });
        c.addEventListener("mousemove", showTip);
        return S.ready.then(function () {
          if (!(window.CharacterPage && CharacterPage.active())) S.run(false);   // nothing to draw until he opens it (unless the character page is showing it)
          fetch("/api/profile", { cache: "no-store" }).then(function (r) { return r.json(); })   // the person's character (D43)
            .then(function (p) { S.setCharacter(p && p.character); }).catch(function () { S.setCharacter(null); });
          var early = art && art.early;
          showHouse(isFinite(remX) && remX !== null ? remX : lit > 0 ? S.lightX(lit - 1) : S.x);   // the remembered house, else the one with his newest light
          if (!early) { fade(tile, 1, 600); fade(cap, 1, 600); } else cap.style.opacity = "";
          carousel(CAROUSEL_MS);
        });
      }).catch(fallback);
    };
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 700 }); else setTimeout(go, 200);
  }

  var timer;
  window.Scene = {
    mount: function (o) {
      opts = o;
      buildSky();
      start();
      window.addEventListener("resize", function () {
        clearTimeout(timer);
        timer = setTimeout(function () { if (failed) return; buildSky(); if (open) frameAt(1); else placeTile(); }, 160);
      });
    },
    setLit: function (n, animate) {
      var prev = lit; lit = n; if (!S) return;
      if (open) { S.setLit(n, !!animate); if (n > prev) seenSet(n); return; }   // open: your character goes to the new light and lights it
      S.setLit(n, false);                                     // closed: the street isn't drawn; the tile shows it instead
      if (!art || !art.day) return;
      if (animate && n > prev) {                              // the new light's house, and its window coming on
        clearTimeout(carTimer); tile.getAnimations && tile.getAnimations().forEach(function (a) { a.cancel(); }); tile.style.opacity = ""; fading = false;
        showHouse(S.lightX(n - 1)); newK = n - 1; newT0 = performance.now(); drawTile();
        carousel(CAROUSEL_MS * 1.5);                          // (long enough for your character's visit, ~9 s)
      } else drawTile();
    },
    setToday: function (n, target) { todayN = [n, target]; if (S) S.setToday(n, target); },   // the foreground bulbs: today's applications
    labels: function (fn) { labelFor = fn; },
    litCount: function () { return lit; },
    total: function () { return S ? S.total() : 0; },
    open: openStreet
  };
})();
