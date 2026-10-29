/* Canal at night. Each lit window is one application sent.
 *
 *   Scene.mount({rail, svg, sky, nav})   build into the rail's <svg>, stars + moon into the page <svg>
 *   Scene.setLit(n, animate)            light the first n windows (fixed order)
 *
 * Everything is generated from a fixed seed, so the street looks the same on
 * every visit. It is rebuilt to fit whenever the window size changes.
 */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var SEED = 20261014;
  var STREET_LEN = 1340;       // street units per loop (one canal street); fixed so lights never move
  var LAMP_GAP = 180;
  var QUAY_T = 6;              // quay edge thickness, street units
  var TEX_TOP = -335, TEX_BOTTOM = 45;   // vertical extent of the baked street (street units)          // street units between streetlamps
  var BG = "#0c0b08";          // page background: near-black, a touch warm

  var C = {
    brick: ["#2b1712", "#341b14", "#2a1210", "#2c221b", "#30170f", "#241612"],
    dark: ["#14110f", "#101410", "#162019", "#1a1714"],
    frame: "#5a5047",
    trim: "#3e342c",
    moonRim: "#a8b3c4",
    glassOff: "#0b0909",
    light: ["#e9ad55", "#f0c27a", "#dc9a48", "#e9ad55", "#f3cf8f", "#e3a24e", "#9fb2c4"],
    leaf: ["#050705", "#080a07", "#0a0c09", "#06080a", "#0b0d08"],
    leafLit: ["#1d1a0e", "#231d0f", "#18170c"],
    lamp: "#e9ad55",
    iron: "#0d0b0a"
  };

  var rnd, opts, lit = 0;
  var main = { tag: "r" }, cur = main;   // cur = the drawing being built

  /* tonight's moon: phase 0 = new, 0.5 = full (synodic month counted from a known new moon) */
  var PHASE = (function () {
    var syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
    var age = (((Date.now() - ref) / 864e5) % syn + syn) % syn;
    return age / syn;
  })();
  var ILLUM = (1 - Math.cos(2 * Math.PI * PHASE)) / 2;
  var LUM = 0.15 + 0.85 * ILLUM;          // how strongly the moon lights the street
  function mo(x) { return Math.round(x * LUM * 1000) / 1000; }
  function phaseName() {
    var p = PHASE;
    if (p < 0.03 || p > 0.97) return "New moon";
    if (p < 0.22) return "Waxing crescent";
    if (p < 0.28) return "First quarter";
    if (p < 0.47) return "Waxing gibbous";
    if (p < 0.53) return "Full moon";
    if (p < 0.72) return "Waning gibbous";
    if (p < 0.78) return "Last quarter";
    return "Waning crescent";
  }

  function rng(seed) {
    var s = seed % 2147483647;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
  function r(a, b) { return a + rnd() * (b - a); }
  function ri(a, b) { return Math.floor(r(a, b + 1)); }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function chance(p) { return rnd() < p; }
  function f(n) { return Math.round(n * 100) / 100; }

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ------------------------------------------------------------ gables */
  function gablePath(type, x, w, top, gh) {
    var c = x + w / 2, p;
    if (type === "step") {
      var n = w > 40 ? 4 : 3, sw = w / (2 * n + 1.4), sh = gh / (n + 1);
      p = "M" + f(x) + " " + f(top);
      for (var i = 0; i < n; i++) p += " V" + f(top - sh * (i + 1)) + " H" + f(x + sw * (i + 1));
      p += " V" + f(top - gh) + " H" + f(x + w - sw * n);
      for (var j = n - 1; j >= 0; j--) p += " V" + f(top - sh * (j + 1)) + " H" + f(x + w - sw * j);
      return p + " V" + f(top) + "Z";
    }
    if (type === "neck") {
      var nw = w * 0.44;
      return "M" + f(x) + " " + f(top) +
        " C" + f(x + w * 0.12) + " " + f(top) + " " + f(c - nw / 2) + " " + f(top - gh * 0.18) + " " + f(c - nw / 2) + " " + f(top - gh * 0.5) +
        " V" + f(top - gh * 0.84) + " Q" + f(c) + " " + f(top - gh * 1.06) + " " + f(c + nw / 2) + " " + f(top - gh * 0.84) +
        " V" + f(top - gh * 0.5) + " C" + f(c + nw / 2) + " " + f(top - gh * 0.18) + " " + f(x + w * 0.88) + " " + f(top) + " " + f(x + w) + " " + f(top) + "Z";
    }
    if (type === "bell") {
      var bw = w * 0.52;
      return "M" + f(x) + " " + f(top) +
        " C" + f(x + w * 0.22) + " " + f(top) + " " + f(c - bw / 2) + " " + f(top - gh * 0.22) + " " + f(c - bw / 2) + " " + f(top - gh * 0.62) +
        " C" + f(c - bw / 2) + " " + f(top - gh * 0.95) + " " + f(c + bw / 2) + " " + f(top - gh * 0.95) + " " + f(c + bw / 2) + " " + f(top - gh * 0.62) +
        " C" + f(c + bw / 2) + " " + f(top - gh * 0.22) + " " + f(x + w * 0.78) + " " + f(top) + " " + f(x + w) + " " + f(top) + "Z";
    }
    if (type === "spout") {
      var sp = w * 0.32;
      return "M" + f(x) + " " + f(top) + " L" + f(c - sp / 2) + " " + f(top - gh * 0.78) + " V" + f(top - gh) +
        " H" + f(c + sp / 2) + " V" + f(top - gh * 0.78) + " L" + f(x + w) + " " + f(top) + "Z";
    }
    // cornice (lijstgevel): flat, with a deep cornice
    return "M" + f(x - 2) + " " + f(top) + " V" + f(top - gh) + " H" + f(x + w + 2) + " V" + f(top) + "Z";
  }

  /* ------------------------------------------------------------ windows */
  function addWindow(g, wx, wy, ww, wh, kind) {
    var grp = el("g", { class: "win" }, g);
    var arched = kind === "arch";
    var d = arched
      ? "M" + f(wx) + " " + f(wy + wh) + " V" + f(wy + ww / 2) + " A" + f(ww / 2) + " " + f(ww / 2) + " 0 0 1 " + f(wx + ww) + " " + f(wy + ww / 2) + " V" + f(wy + wh) + "Z"
      : "M" + f(wx) + " " + f(wy) + " h" + f(ww) + " v" + f(wh) + " h" + f(-ww) + "Z";
    var glass = el("path", { class: "glass", d: d }, grp);
    var lc = pick(C.light);
    glass.style.setProperty("--c", lc);
    if (lc === "#9fb2c4") grp.classList.add("tv");

    // interior, only visible when lit
    var inside = el("g", { class: "inside" }, grp);
    // depth: the room is darker toward the floor; light spills onto the wall under the sill
    el("path", { d: d, fill: "url(#roomshade" + cur.tag + ")" }, inside);
    el("rect", { x: f(wx - 1.5), y: f(wy + wh + 1.1), width: f(ww + 3), height: 5, fill: "url(#spill" + cur.tag + ")", style: "color:" + lc }, inside);
    var roll = rnd();
    if (roll < 0.34) {               // curtains
      var cc = pick(["#7a3f22", "#5b3a2a", "#8a5a2e", "#3d2a24", "#6b2e22"]);
      el("path", { d: "M" + f(wx) + " " + f(wy) + " h" + f(ww * 0.28) + " q" + f(-ww * 0.08) + " " + f(wh / 2) + " " + f(ww * 0.04) + " " + f(wh) + " h" + f(-ww * 0.32) + "Z", fill: cc, opacity: 0.85 }, inside);
      el("path", { d: "M" + f(wx + ww) + " " + f(wy) + " h" + f(-ww * 0.28) + " q" + f(ww * 0.08) + " " + f(wh / 2) + " " + f(-ww * 0.04) + " " + f(wh) + " h" + f(ww * 0.32) + "Z", fill: cc, opacity: 0.85 }, inside);
    } else if (roll < 0.52) {        // plants on the sill
      for (var p = 0; p < 3; p++) el("ellipse", { cx: f(wx + ww * (0.25 + p * 0.25)), cy: f(wy + wh - 2.2), rx: f(r(1, 1.8)), ry: f(r(1.6, 2.6)), fill: "#2b2a12" }, inside);
    } else if (roll < 0.64) {        // a lamp with a shade
      var lx = wx + ww * r(0.3, 0.7);
      el("path", { d: "M" + f(lx - 2) + " " + f(wy + wh * 0.45) + " h4 l-1 -2.5 h-2z", fill: "#3b2410" }, inside);
      el("rect", { x: f(lx - 0.3), y: f(wy + wh * 0.45), width: 0.6, height: f(wh * 0.4), fill: "#3b2410" }, inside);
    } else if (roll < 0.74) {        // bookshelf
      for (var b = 1; b < 4; b++) el("rect", { x: f(wx + 1), y: f(wy + (wh * b) / 4), width: f(ww - 2), height: 0.6, fill: "#5a3a1c", opacity: 0.7 }, inside);
    } else if (roll < 0.8) {         // someone at the window
      var px = wx + ww * r(0.35, 0.65);
      el("circle", { cx: f(px), cy: f(wy + wh * 0.42), r: f(ww * 0.13), fill: "#3a2513" }, inside);
      el("path", { d: "M" + f(px - ww * 0.24) + " " + f(wy + wh) + " q" + f(ww * 0.24) + " " + f(-wh * 0.55) + " " + f(ww * 0.48) + " 0z", fill: "#3a2513" }, inside);
    }

    // glazing bars + frame (sash windows: 2 across, 3 down)
    var bars = "M" + f(wx + ww / 2) + " " + f(wy + (arched ? ww / 2 : 0)) + " V" + f(wy + wh) +
      " M" + f(wx) + " " + f(wy + wh * 0.4) + " h" + f(ww) +
      " M" + f(wx) + " " + f(wy + wh * 0.7) + " h" + f(ww);
    el("path", { class: "bars", d: bars }, grp);
    el("path", { class: "frame", d: d }, grp);
    // sill, and a brick lintel above square windows
    el("rect", { x: f(wx - 0.8), y: f(wy + wh), width: f(ww + 1.6), height: 1.1, fill: C.trim }, g);
    el("rect", { x: f(wx - 0.8), y: f(wy + wh + 1.1), width: f(ww + 1.6), height: 0.4, fill: "#000", opacity: 0.35 }, g);
    if (!arched && cur.lintels) el("path", { d: "M" + f(wx - 0.6) + " " + f(wy - 0.4) + " q" + f(ww / 2 + 0.6) + " -2.2 " + f(ww + 1.2) + " 0", stroke: "#3a2a22", "stroke-width": 0.9, fill: "none", opacity: 0.8 }, g);

    var rec = { g: grp, glass: glass, x: wx, y: wy, w: ww, h: wh, col: lc, skew: cur.skew || 0 };
    cur.windows.push(rec);
    return rec;
  }

  /* ------------------------------------------------------------ one house */
  function house(g, x, w, o) {
    o = o || {};
    var floors = ri(4, 5), fh = r(25, 29), ground = fh * 1.05;
    var bodyH = ground + (floors - 1) * fh + 10;
    var type = o.warehouse ? "spout" : pick(["step", "neck", "bell", "spout", "cornice", "neck", "step", "bell"]);
    var gh = type === "cornice" ? 18 : r(30, 46);
    var col = chance(0.25) ? pick(C.dark) : pick(C.brick);
    cur.lintels = chance(0.3);
    var top = -bodyH, hg = el("g", {}, g);
    if (o.lean) hg.setAttribute("transform", "translate(" + f(x + w / 2) + ",0) skewX(" + o.lean + ") translate(" + f(-(x + w / 2)) + ",0)");
    cur.skew = o.lean ? Math.tan(o.lean * Math.PI / 180) : 0;   // so the light layer knows where leaning windows really are

    // roof ridge and chimney peeking behind the gable
    if (type !== "spout" && chance(0.6)) {
      var chx = x + w * r(0.15, 0.7), chy = top - gh * 0.7 - 10;
      el("rect", { x: f(chx), y: f(chy), width: 4, height: 12, fill: "#120e0c" }, hg);
      el("rect", { x: f(chx - 0.6), y: f(chy), width: 5.2, height: 1.3, fill: "#1e1713" }, hg);
      el("rect", { x: f(chx + 1), y: f(chy - 1.6), width: 2, height: 1.6, fill: "#100c0a" }, hg);
    }
    el("path", { d: "M" + f(x + 2) + " " + f(top) + " L" + f(x + w / 2) + " " + f(top - gh * 0.8) + " L" + f(x + w - 2) + " " + f(top) + "Z", fill: "#0e0b0a" }, hg);

    // facade: brick, grain and shading live in one group so the texture stays on the wall
    var fac = el("g", { filter: "url(#grain" + cur.tag + ")" }, hg);
    el("rect", { x: f(x), y: f(top), width: f(w), height: f(bodyH), fill: col }, fac);
    el("path", { d: gablePath(type, x, w, top + 0.4, gh), fill: col }, fac);
    if (!col.match(/^#1[0-9a]/)) el("rect", { x: f(x), y: f(top), width: f(w), height: f(bodyH), fill: "url(#brick" + cur.tag + ")", opacity: 0.3 }, fac);
    // ambient occlusion: darker toward the street and under the gable
    el("rect", { x: f(x), y: f(top), width: f(w), height: f(bodyH), fill: "url(#ao" + cur.tag + ")" }, fac);
    // moonlight: a cool wash on the side facing the moon, and a thin rim on the gable
    el("rect", { x: f(x), y: f(top), width: f(w), height: f(bodyH), fill: "url(#moonwash" + cur.tag + ")" }, hg);
    el("path", { d: gablePath(type, x, w, top + 0.4, gh), fill: "none", stroke: C.moonRim, "stroke-width": 0.7, opacity: mo(0.2), "stroke-linejoin": "round" }, hg);
    el("line", { x1: f(x + w), y1: f(top), x2: f(x + w), y2: 0, stroke: C.moonRim, "stroke-width": 0.6, opacity: mo(0.12) }, hg);
    el("line", { x1: f(x), y1: f(top - 2), x2: f(x), y2: 0, stroke: "#000", "stroke-width": 0.9, opacity: 0.6 }, hg);

    // stone coping along the gable edge
    if (type !== "cornice") el("path", { d: gablePath(type, x + 0.6, w - 1.2, top + 0.4, gh - 0.6), fill: "none", stroke: "#4a3d33", "stroke-width": 0.5, opacity: 0.55, "stroke-linejoin": "round" }, hg);
    // gable ornament
    var c = x + w / 2;
    if (type === "cornice") {
      el("rect", { x: f(x - 2.5), y: f(top - gh - 2), width: f(w + 5), height: 2.4, fill: C.trim }, hg);
      for (var d = x; d < x + w - 1; d += 2.6) el("rect", { x: f(d), y: f(top - gh + 0.6), width: 1.2, height: 1.6, fill: C.trim }, hg);
      // hoist hatch in the cornice
      el("rect", { x: f(c - 3), y: f(top - gh + 4), width: 6, height: f(gh - 6), fill: "#0d0a09", stroke: C.frame, "stroke-width": 0.5 }, hg);
    } else {
      if (type === "neck") el("circle", { cx: f(c), cy: f(top - gh * 0.74), r: 2.6, fill: "#0b0909", stroke: C.frame, "stroke-width": 0.5 }, hg);
      if (type === "bell" || type === "neck") el("path", { d: "M" + f(c - 1.6) + " " + f(top - gh * 0.96) + " h3.2 l-0.6 -2.2 a1.4 1.4 0 1 0 -2 0z", fill: C.trim }, hg);
      if (type === "step") el("circle", { cx: f(c), cy: f(top - gh - 1.6), r: 1.4, fill: C.trim }, hg);
      // hoisting beam with hook
      var hy = top - gh * (type === "spout" ? 0.86 : 0.62) - 4;
      el("path", { d: "M" + f(c) + " " + f(hy) + " v-5 h3.5", stroke: "#1a1410", "stroke-width": 1.4, fill: "none" }, hg);
      el("path", { d: "M" + f(c + 3.5) + " " + f(hy - 5) + " v2.6 a1 1 0 1 1 -1 1", stroke: "#2e2620", "stroke-width": 0.6, fill: "none" }, hg);
      // attic window
      var aw = Math.min(8, w * 0.2);
      addWindow(hg, c - aw / 2, top - gh * 0.46 - 5, aw, 10, type === "bell" ? "arch" : "");
    }

    // upper floors
    var cols = w >= 40 ? 3 : 2;
    var ww = Math.min(9.5, (w - 8) / cols - 4), gap = (w - cols * ww) / (cols + 1);
    var arch = chance(0.25) ? "arch" : "";
    for (var fl = 0; fl < floors - 1; fl++) {
      var wy = top + 8 + fl * fh, wh = fh * (fl === 0 ? 0.66 : 0.6);
      if (o.warehouse) {
        // a pakhuis: a central column of loading doors with painted shutters, small windows either side
        var sc = o.shutter, dwid = w * 0.26, dxx = x + w / 2 - dwid / 2;
        el("rect", { x: f(dxx), y: f(wy), width: f(dwid), height: f(wh), fill: sc, stroke: "#0a0807", "stroke-width": 0.4 }, hg);
        el("path", { d: "M" + f(dxx + dwid / 2) + " " + f(wy) + " v" + f(wh) + " M" + f(dxx) + " " + f(wy + wh) + " L" + f(dxx + dwid / 2) + " " + f(wy) + " M" + f(dxx + dwid / 2) + " " + f(wy + wh) + " L" + f(dxx + dwid) + " " + f(wy), stroke: "#c9bda6", "stroke-width": 0.3, opacity: 0.14 }, hg);
        var sw3 = Math.min(6, w * 0.13);
        addWindow(hg, x + w * 0.12, wy + wh * 0.15, sw3, wh * 0.7, "");
        addWindow(hg, x + w * 0.88 - sw3, wy + wh * 0.15, sw3, wh * 0.7, "");
      } else {
        for (var k = 0; k < cols; k++) addWindow(hg, x + gap + k * (ww + gap), wy, ww, wh, fl === floors - 2 ? "" : arch);
      }
    }
    // iron wall anchors (muurankers) at each floor line
    var anchor = pick(["x", "s", "i"]);
    for (var fa = 0; fa < (chance(0.35) ? floors - 1 : 0); fa++) {
      var ay = top + 5 + fa * fh;
      [x + 2.2, x + w - 2.2].forEach(function (ax) {
        var d2 = anchor === "x" ? "M" + f(ax - 1.2) + " " + f(ay - 1.2) + " l2.4 2.4 M" + f(ax + 1.2) + " " + f(ay - 1.2) + " l-2.4 2.4"
          : anchor === "s" ? "M" + f(ax) + " " + f(ay - 1.6) + " q1.4 0.8 0 1.6 q-1.4 0.8 0 1.6" : "M" + f(ax) + " " + f(ay - 1.8) + " v3.6";
        el("path", { d: d2, stroke: "#0a0706", "stroke-width": 0.6, fill: "none", opacity: 0.55 }, hg);
      });
    }
    // belt course above the ground floor
    el("rect", { x: f(x), y: f(-ground - 2), width: f(w), height: 1.6, fill: C.trim }, hg);

    // ground floor: door with fanlight + stoop + railing, one wide window
    var dx = chance(0.5) ? x + gap - 1 : x + w - gap - ww - 1, dw = ww + 2, dh = ground * 0.72;
    el("rect", { x: f(dx), y: f(-dh - 2.5), width: f(dw), height: f(dh), fill: pick(["#0f1a14", "#140c0a", "#0d0d10", "#1a0e0b"]), stroke: C.frame, "stroke-width": 0.5 }, hg);
    el("path", { d: "M" + f(dx) + " " + f(-dh - 2.5) + " a" + f(dw / 2) + " " + f(dw / 2) + " 0 0 1 " + f(dw) + " 0z", fill: "#0b0909", stroke: C.frame, "stroke-width": 0.5 }, hg);
    // fanlight glazing bars
    for (var fb = 1; fb < 4; fb++) {
      var fa2 = Math.PI * fb / 4;
      el("line", { x1: f(dx + dw / 2), y1: f(-dh - 2.5), x2: f(dx + dw / 2 - Math.cos(fa2) * dw / 2), y2: f(-dh - 2.5 - Math.sin(fa2) * dw / 2), stroke: C.frame, "stroke-width": 0.3 }, hg);
    }
    // door panels, knocker, a gable stone above
    el("rect", { x: f(dx + 1.2), y: f(-dh - 1), width: f(dw - 2.4), height: f(dh * 0.38), fill: "none", stroke: "#000", "stroke-width": 0.4, opacity: 0.6 }, hg);
    el("rect", { x: f(dx + 1.2), y: f(-dh * 0.5 - 1.5), width: f(dw - 2.4), height: f(dh * 0.38), fill: "none", stroke: "#000", "stroke-width": 0.4, opacity: 0.6 }, hg);
    el("circle", { cx: f(dx + dw / 2), cy: f(-dh * 0.55 - 2.5), r: 0.5, fill: "#6a5a3a" }, hg);
    if (chance(0.5)) el("rect", { x: f(dx + dw / 2 - 2.5), y: f(-dh - 2.5 - dw / 2 - 5), width: 5, height: 3.6, fill: "#3a2f26", stroke: "#4a3e33", "stroke-width": 0.3 }, hg);
    el("rect", { x: f(dx - 2), y: -2.5, width: f(dw + 4), height: 1.3, fill: "#2a221c" }, hg);
    el("rect", { x: f(dx - 3.5), y: -1.2, width: f(dw + 7), height: 1.2, fill: "#231c17" }, hg);
    el("path", { d: "M" + f(dx - 3.5) + " 0 v-6 h2 M" + f(dx + dw + 3.5) + " 0 v-6 h-2", stroke: "#1b1512", "stroke-width": 0.5, fill: "none" }, hg);
    var gx = dx < x + w / 2 ? x + w - gap - ww * 1.6 : x + gap;
    addWindow(hg, gx, -ground * 0.86, ww * 1.6, ground * 0.6, "");
    // basement window below the street
    el("rect", { x: f(gx + 1), y: -1, width: f(ww * 1.6 - 2), height: 1, fill: "#000" }, hg);

    return { x: x, w: w, top: top - gh };
  }

  /* ------------------------------------------------------------ street furniture */
  function lampPost(g, x) {
    var lg = el("g", { class: "lamp" }, g);
    el("ellipse", { class: "pool", cx: f(x), cy: 1, rx: 22, ry: 3, fill: C.lamp }, lg);           // light on the cobbles (only when on)
    el("path", { d: "M" + f(x - 2.4) + " 0 h4.8 l-0.6 -1.4 h-3.6z M" + f(x - 2) + " -1.4 h4 l-0.8 -4 h-2.4z M" + f(x - 0.7) + " -5.4 h1.4 v-38.6 h-1.4z", fill: C.iron }, lg);
    [-6, -14, -30].forEach(function (ry) { el("rect", { x: f(x - 1.2), y: ry, width: 2.4, height: 0.9, fill: C.iron }, lg); });
    el("path", { d: "M" + f(x) + " -42 q2 1 3 3", stroke: C.iron, "stroke-width": 0.5, fill: "none" }, lg);
    el("path", { d: "M" + f(x) + " -42 q-2 1 -3 3", stroke: C.iron, "stroke-width": 0.5, fill: "none" }, lg);
    el("path", { d: "M" + f(x + 0.7) + " -5.4 v-38.6", stroke: C.moonRim, "stroke-width": 0.3, opacity: mo(0.25) }, lg);
    el("rect", { x: f(x - 3.5), y: -45, width: 7, height: 1.2, fill: C.iron }, lg);
    el("path", { class: "lantern", d: "M" + f(x - 3) + " -45 l-1 -8 h8 l-1 8z" }, lg);
    el("path", { d: "M" + f(x) + " -53 v8 M" + f(x - 3.5) + " -49 h7", stroke: "#8a5a22", "stroke-width": 0.4 }, lg);
    el("path", { d: "M" + f(x - 5) + " -53 h10 l-5 -3.5z", fill: C.iron }, lg);
    el("rect", { x: f(x - 0.4), y: -58.5, width: 0.8, height: 2.6, fill: C.iron }, lg);
    return { x: x - 3, y: -53, w: 6, h: 8, g: lg };
  }
  function bollard(g, x) {
    el("path", { d: "M" + f(x - 1.4) + " 0 v-7 q1.4 -1.6 2.8 0 v7z", fill: "#2a1410" }, g);
    el("path", { d: "M" + f(x - 0.8) + " -5.6 l1.6 1.2 M" + f(x + 0.8) + " -5.6 l-1.6 1.2", stroke: "#5a4a40", "stroke-width": 0.3 }, g);
  }
  /* a Dutch city bike: painted steel frame, chrome rims, spokes and bars that catch the light.
     lit = how much light reaches it (0..1), warm = lamplight rather than moonlight */
  function bike(g, x, flip, basket, lit, warm) {
    lit = lit == null ? 0.5 : lit;
    var hl = warm ? "#f0cf94" : C.moonRim, ho = warm ? 0.55 * lit + 0.1 : mo(0.7) * lit + 0.05;
    var paint = pick(["#14110f", "#14110f", "#1a2a22", "#1b2230", "#3a1714", "#2b2a26"]);
    var steel = "#8d877c", rubber = "#090807";
    var bg = el("g", { transform: "translate(" + f(x) + ",0) scale(" + (flip ? -1 : 1) + ",1)", fill: "none", "stroke-linecap": "round" }, g);
    [0, 13].forEach(function (cx) {
      el("circle", { cx: cx, cy: -4.6, r: 4.5, stroke: rubber, "stroke-width": 1.1 }, bg);                  // tyre
      el("circle", { cx: cx, cy: -4.6, r: 3.85, stroke: steel, "stroke-width": 0.35, opacity: 0.55 }, bg);   // rim
      for (var a = 0; a < 12; a++) {
        var t = a * Math.PI / 6;
        el("line", { x1: cx, y1: -4.6, x2: f(cx + Math.cos(t) * 3.8), y2: f(-4.6 + Math.sin(t) * 3.8), stroke: steel, "stroke-width": 0.1, opacity: 0.45 }, bg);
      }
      el("circle", { cx: cx, cy: -4.6, r: 0.55, fill: steel, stroke: "none", opacity: 0.8 }, bg);           // hub
      // specular glint along the top of the rim
      el("path", { d: "M" + f(cx + Math.cos(-2.2) * 3.85) + " " + f(-4.6 + Math.sin(-2.2) * 3.85) + " A3.85 3.85 0 0 1 " + f(cx + Math.cos(-1.1) * 3.85) + " " + f(-4.6 + Math.sin(-1.1) * 3.85), stroke: hl, "stroke-width": 0.4, opacity: f(ho) }, bg);
    });
    // painted frame (step-through), fenders, chain guard
    el("path", { d: "M0 -4.6 L4.8 -10.6 M4.8 -10.6 L6.5 -4.6 L11.2 -11.2 L13 -4.6 M6.5 -4.6 Q8 -8.8 11.2 -11.2", stroke: paint, "stroke-width": 0.85 }, bg);
    el("path", { d: "M-4.3 -6 a4.9 4.9 0 0 1 6.1 -3.7 M9.3 -8.7 a4.9 4.9 0 0 1 7.7 3.1", stroke: paint, "stroke-width": 0.55 }, bg);
    el("path", { d: "M3.8 -4.2 h4.6 q1.4 0 1.4 -1.4 q0 -1.2 -1.4 -1.2 h-4.6z", fill: paint, stroke: "none" }, bg);
    // highlights where light hits the tubes
    el("path", { d: "M6.9 -5.2 Q8.2 -8.9 11 -11", stroke: hl, "stroke-width": 0.22, opacity: f(ho) }, bg);
    el("path", { d: "M9.6 -9.1 a4.9 4.9 0 0 1 4.6 -0.2", stroke: hl, "stroke-width": 0.22, opacity: f(ho * 0.8) }, bg);
    // seat post, saddle, chrome bars and bell
    el("path", { d: "M5.6 -10.4 L5 -13.4", stroke: steel, "stroke-width": 0.45, opacity: 0.8 }, bg);
    el("path", { d: "M3.4 -13.7 h3.6 q0.4 -0.9 -0.7 -1.1 h-2.2z", fill: "#1c1612", stroke: "none" }, bg);
    el("path", { d: "M11.2 -11.2 L10.6 -14 M9.2 -14.6 q1.5 -0.6 3 -0.1 q1 0.4 1.4 1.4", stroke: steel, "stroke-width": 0.45, opacity: 0.85 }, bg);
    el("path", { d: "M9.6 -14.75 q1.2 -0.4 2.4 -0.1", stroke: hl, "stroke-width": 0.2, opacity: f(ho + 0.1) }, bg);
    el("circle", { cx: 10.4, cy: -15.2, r: 0.45, fill: steel, stroke: "none", opacity: 0.9 }, bg);
    el("circle", { cx: 6.5, cy: -4.6, r: 1.5, stroke: steel, "stroke-width": 0.3, opacity: 0.5 }, bg);      // chainring
    el("path", { d: "M12.4 -12 h1.4 v1.1 h-1.4z", fill: "#2a241c", stroke: "none" }, bg);                    // dynamo lamp
    el("rect", { x: -4.7, y: -7.5, width: 1, height: 0.8, fill: "#5a1a14", stroke: "none" }, bg);            // rear reflector
    el("path", { d: "M5.8 -4.4 l1.6 4.2", stroke: steel, "stroke-width": 0.3, opacity: 0.6 }, bg);          // kickstand
    if (basket) {
      el("path", { d: "M11.8 -14.2 h4.4 l-0.4 3.2 h-3.6z", stroke: "#4a3a28", "stroke-width": 0.4 }, bg);
      el("path", { d: "M12.8 -14.2 v3.2 M13.9 -14.2 v3.2 M15 -14.2 v3.2 M11.9 -12.6 h4.2", stroke: "#4a3a28", "stroke-width": 0.18 }, bg);
    }
  }
  function tree(g, x, lamps) {
    var tg = el("g", {}, g);
    var h = r(56, 70);
    el("path", { d: "M" + f(x - 2.2) + " 0 q0.6 -2 0.6 -4 q1 " + f(-h * 0.46) + " 0.6 " + f(-h * 0.76) + " h2 q-0.4 " + f(h * 0.3) + " 0.6 " + f(h * 0.72) + " q0 2 1.2 4z", fill: "#070605" }, tg);
    for (var bark = 0; bark < 7; bark++) el("path", { d: "M" + f(x - 0.8 + bark * 0.35) + " " + f(-r(2, 8)) + " v" + f(-r(10, h * 0.5)), stroke: "#14110e", "stroke-width": 0.25 }, tg);
    // a tree guard around the trunk
    el("path", { d: "M" + f(x - 3.5) + " 0 v-6 M" + f(x + 3.5) + " 0 v-6 M" + f(x - 3.5) + " -5.4 h7 M" + f(x - 3.5) + " -2.6 h7", stroke: "#1a1612", "stroke-width": 0.4 }, tg);
    var tips = [];
    for (var b = 0; b < 5; b++) {
      var a = -Math.PI / 2 + r(-1.1, 1.1), len = r(14, 26), sx = x, sy = -h * r(0.55, 0.8);
      var ex = sx + Math.cos(a) * len, ey = sy + Math.sin(a) * len;
      el("path", { d: "M" + f(sx) + " " + f(sy) + " Q" + f(sx + Math.cos(a) * len * 0.4) + " " + f(sy + Math.sin(a) * len * 0.6) + " " + f(ex) + " " + f(ey), stroke: "#070605", "stroke-width": 1.2, fill: "none" }, tg);
      tips.push([ex, ey]);
    }
    var nearIdx = -1;
    lamps.forEach(function (l, li) { if (Math.abs(l - x) < 30) nearIdx = li; });
    for (var i = 0; i < 180; i++) {
      var t = pick(tips), ang = r(0, Math.PI * 2), dist = Math.sqrt(rnd()) * 14;
      var lx = t[0] + Math.cos(ang) * dist * 1.2, ly = t[1] + Math.sin(ang) * dist * 0.85;
      var lower = ly > -h * 0.62;
      var warm = nearIdx >= 0 && lower && chance(0.45);
      var leaf = el("ellipse", {
        cx: f(lx), cy: f(ly), rx: f(r(1.4, 2.6)), ry: f(r(0.9, 1.6)),
        fill: pick(C.leaf),
        transform: "rotate(" + ri(-50, 50) + " " + f(lx) + " " + f(ly) + ")"
      }, tg);
      if (warm) { leaf.setAttribute("class", "ll"); leaf.setAttribute("data-lamp", nearIdx); leaf.style.setProperty("--c", pick(C.leafLit)); }
    }
    // a little moonlight on the top of the crown
    for (var m = 0; m < 26; m++) {
      var tt = pick(tips);
      el("ellipse", { cx: f(tt[0] + r(-9, 9)), cy: f(tt[1] - r(4, 11)), rx: 1.6, ry: 0.9, fill: C.moonRim, opacity: mo(0.09) }, tg);
    }
    var xs = tips.map(function (q) { return q[0]; }), ys = tips.map(function (q) { return q[1]; });
    var minX = Math.min.apply(null, xs) - 14, maxX = Math.max.apply(null, xs) + 14;
    var minY = Math.min.apply(null, ys) - 11, maxY = Math.max.apply(null, ys) + 11;
    return { x: x, h: h, canopy: { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, rx: (maxX - minX) / 2, ry: (maxY - minY) / 2 } };
  }
  function houseboat(g, x, waterY) {
    var hb = el("g", { class: "boat-lights" }, g);
    el("path", { d: "M" + f(x) + " " + f(waterY + 2) + " h70 l-3 7 h-64z", fill: "#0d1410" }, hb);
    el("rect", { x: f(x + 6), y: f(waterY - 9), width: 52, height: 11, fill: "#16201a" }, hb);
    el("rect", { x: f(x + 4), y: f(waterY - 10.5), width: 56, height: 1.6, fill: "#22281f" }, hb);
    for (var i = 0; i < 5; i++) {
      var pc = pick(["#e9ad55", "#f0c27a"]);
      var port = el("rect", { class: i !== 2 ? "port" : "", x: f(x + 10 + i * 9.5), y: f(waterY - 6), width: 5, height: 4.2, fill: "#0b0909", stroke: "#3a3a2e", "stroke-width": 0.4 }, hb);
      port.style.setProperty("--c", pc);
      if (i !== 2 && cur.ports) cur.ports.push({ type: 0, x: x + 10 + i * 9.5, y: waterY - 6, w: 5, h: 4.2, col: pc, water: true });
    }
    el("rect", { x: f(x + 57), y: f(waterY - 8), width: 4, height: 9, fill: "#0e1611", stroke: "#2a3226", "stroke-width": 0.4 }, hb);      // door
    el("rect", { x: f(x + 50), y: f(waterY - 17), width: 1.2, height: 7, fill: "#0b0d0b" }, hb);                                         // stovepipe
    el("path", { d: "M" + f(x + 3) + " " + f(waterY - 10.5) + " v-4 h58 v4 M" + f(x + 3) + " " + f(waterY - 12.5) + " h58", stroke: "#1d231c", "stroke-width": 0.35, fill: "none" }, hb); // roof railing
    [x + 14, x + 34, x + 54].forEach(function (tx) { el("circle", { cx: f(tx), cy: f(waterY + 3.4), r: 1.6, fill: "none", stroke: "#0a0a0a", "stroke-width": 0.9 }, hb); });  // tyre fenders
    el("path", { d: "M" + f(x + 2) + " " + f(waterY) + " q-6 -2 -8 -" + 7, stroke: "#2a2119", "stroke-width": 0.4, fill: "none" }, hb);  // mooring line
    el("path", { d: "M" + f(x) + " " + f(waterY + 2) + " h70", stroke: C.moonRim, "stroke-width": 0.4, opacity: mo(0.3) }, hb);
    // plants and a bike on the roof
    for (var p = 0; p < 6; p++) el("ellipse", { cx: f(x + 9 + p * 3.4), cy: f(waterY - 12.5), rx: 2, ry: 1.6, fill: "#0c120b" }, hb);
    el("rect", { x: f(x + 7), y: f(waterY - 12), width: 12, height: 1.5, fill: "#3a2418" }, hb);
    bike(el("g", { transform: "translate(" + f(x + 40) + "," + f(waterY - 10.6) + ") scale(.6)" }, hb), 0, false, false);
    return hb;
  }

  /* the Westertoren: brick shaft, stone stages, the crown on top. Behind the row, dark against the sky */
  function westertoren(g, x) {
    var tg = el("g", {}, g), col = "#141116";
    el("rect", { x: f(x - 9), y: -232, width: 18, height: 232, fill: col }, tg);
    el("rect", { x: f(x - 10.5), y: -234, width: 21, height: 2.4, fill: col }, tg);
    el("rect", { x: f(x - 7.5), y: -263, width: 15, height: 29, fill: col }, tg);
    el("rect", { x: f(x - 9), y: -265, width: 18, height: 2, fill: col }, tg);
    el("rect", { x: f(x - 5.5), y: -285, width: 11, height: 20, fill: col }, tg);
    el("rect", { x: f(x - 4), y: -299, width: 8, height: 14, fill: col }, tg);
    el("path", { d: "M" + f(x - 5) + " -299 q5 -10 10 0z", fill: col }, tg);           // the imperial crown
    el("path", { d: "M" + f(x - 3.6) + " -301 q3.6 -6 7.2 0", stroke: "#2b2a3a", "stroke-width": 0.5, fill: "none" }, tg);
    el("rect", { x: f(x - 0.4), y: -316, width: 0.8, height: 11, fill: col }, tg);
    el("circle", { cx: f(x), cy: -306, r: 1.1, fill: col }, tg);
    // clock face (dark until it's someone's job to light it)
    el("circle", { cx: f(x), cy: -249, r: 4.2, fill: "#1e1a1a", stroke: "#2c2626", "stroke-width": 0.5 }, tg);
    el("path", { d: "M" + f(x) + " -249 v-3 M" + f(x) + " -249 h2.2", stroke: "#3a3333", "stroke-width": 0.5 }, tg);
    [[-263, 15], [-285, 11]].forEach(function (st) {
      for (var o = -1; o <= 1; o += 2) el("rect", { x: f(x + o * st[1] * 0.22 - 1), y: st[0] + 6, width: 2, height: 9, rx: 1, fill: "#09080b" }, tg);
    });
    el("path", { d: "M" + f(x + 9) + " 0 V-232 M" + f(x + 7.5) + " -234 V-263 M" + f(x + 5.5) + " -265 V-285 M" + f(x + 4) + " -285 V-299", stroke: C.moonRim, "stroke-width": 0.6, opacity: mo(0.16) }, tg);
  }

  /* ------------------------------------------------------------ build */
  function defsFor(svg, tag) {
    var defs = el("defs", {}, svg);
    var pat = el("pattern", { id: "brick" + tag, width: 6, height: 3, patternUnits: "userSpaceOnUse" }, defs);
    el("path", { d: "M0 2.9 H6 M3 0 V1.45 M0 1.45 H6 M0 1.45 V2.9 M6 1.45 V2.9", stroke: "#000", "stroke-width": 0.25, opacity: 0.55 }, pat);
    var mw = el("linearGradient", { id: "moonwash" + tag, x1: 0, y1: 0, x2: 1, y2: 0.3 }, defs);
    el("stop", { offset: 0, "stop-color": C.moonRim, "stop-opacity": 0 }, mw);
    el("stop", { offset: 1, "stop-color": C.moonRim, "stop-opacity": mo(0.06) }, mw);
    var ao = el("linearGradient", { id: "ao" + tag, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: 0, "stop-color": "#000", "stop-opacity": 0.18 }, ao);
    el("stop", { offset: 0.25, "stop-color": "#000", "stop-opacity": 0 }, ao);
    el("stop", { offset: 0.75, "stop-color": "#000", "stop-opacity": 0.05 }, ao);
    el("stop", { offset: 1, "stop-color": "#000", "stop-opacity": 0.4 }, ao);
    var rs = el("linearGradient", { id: "roomshade" + tag, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: 0, "stop-color": "#fff3d8", "stop-opacity": 0.14 }, rs);
    el("stop", { offset: 0.45, "stop-color": "#000", "stop-opacity": 0 }, rs);
    el("stop", { offset: 1, "stop-color": "#2a1606", "stop-opacity": 0.4 }, rs);
    var sp = el("linearGradient", { id: "spill" + tag, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: 0, "stop-color": "currentColor", "stop-opacity": 0.16 }, sp);
    el("stop", { offset: 1, "stop-color": "currentColor", "stop-opacity": 0 }, sp);
    var mir = el("linearGradient", { id: "mirror" + tag, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: 0, "stop-color": BG, "stop-opacity": 0.15 }, mir);
    el("stop", { offset: 0.55, "stop-color": BG, "stop-opacity": 0.7 }, mir);
    el("stop", { offset: 1, "stop-color": BG, "stop-opacity": 1 }, mir);
    var sky = el("linearGradient", { id: "nightsky" + tag, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: 0, "stop-color": BG, "stop-opacity": 0 }, sky);
    el("stop", { offset: 0.5, "stop-color": BG, "stop-opacity": 0 }, sky);
    el("stop", { offset: 1, "stop-color": "#1c1913", "stop-opacity": 1 }, sky);        // faint sodium skyglow at the horizon
    // grain: fine speckle + broad mottling, multiplied onto the facades (plaster, soot, old brick)
    var gr = el("filter", { id: "grain" + tag, x: "0", y: "0", width: "100%", height: "100%", "color-interpolation-filters": "sRGB" }, defs);
    el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.9", numOctaves: 2, seed: 4, result: "fine" }, gr);
    el("feColorMatrix", { in: "fine", type: "matrix", values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 0.58", result: "specks" }, gr);
    el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.035 0.08", numOctaves: 3, seed: 11, result: "broad" }, gr);
    el("feColorMatrix", { in: "broad", type: "matrix", values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.2 0.66", result: "mottle" }, gr);
    el("feComposite", { in: "specks", in2: "SourceGraphic", operator: "in", result: "s1" }, gr);
    el("feComposite", { in: "mottle", in2: "SourceGraphic", operator: "in", result: "s2" }, gr);
    var mg = el("feMerge", {}, gr);
    el("feMergeNode", { in: "SourceGraphic" }, mg); el("feMergeNode", { in: "s2" }, mg); el("feMergeNode", { in: "s1" }, mg);
    // water: horizontal ripples that break up the mirrored street
    // water: dark walls drop out, lights survive as soft, broken, rippled smears
    var wr = el("filter", { id: "ripple" + tag, x: "-5%", y: "0", width: "110%", height: "100%", "color-interpolation-filters": "sRGB" }, defs);
    el("feTurbulence", { type: "turbulence", baseFrequency: "0.01 0.42", numOctaves: 2, seed: 2, result: "w" }, wr);
    el("feDisplacementMap", { in: "SourceGraphic", in2: "w", scale: 6, xChannelSelector: "R", yChannelSelector: "B", result: "d" }, wr);
    el("feGaussianBlur", { in: "d", stdDeviation: "0.5 1.1", result: "b" }, wr);
    var ct = el("feComponentTransfer", { in: "b" }, wr);
    ["R", "G", "B"].forEach(function (ch) { el("feFunc" + ch, { type: "gamma", amplitude: 2.6, exponent: 1.9, offset: 0 }, ct); });
    return defs;
  }

  /* t = { svg, W, H, navBottom, phone, tag, UW (optional: reuse another drawing's width) } */
  /* One drawing. The sidebar is a window onto it. The street is a loop that drifts slowly
     sideways and wraps with no seam (three copies side by side). Everything sits in a
     "camera" group, so opening the street is just moving the camera. */
  function build(t) {
    var svg = t.svg, W = t.W, H = t.H, phone = t.phone, tag = t.tag;
    cur = t; t.windows = []; t.ports = [];
    rnd = rng(SEED);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    defsFor(svg, tag);

    var waterH = phone ? Math.round(H * 0.2) : Math.max(70, Math.min(170, Math.round(H * 0.16)));
    var quay = H - waterH - 8;
    var room = quay - t.navBottom - (phone ? 10 : 30);
    var s = Math.max(0.6, Math.min(2.2, room / 205));
    var UW = W / s;
    t.UW = UW;
    t.geo = { s: s, quay: quay, W: W, H: H };

    var cam = el("g", { class: "cam" }, svg);
    t.cam = cam;
    var EXT = UW * 6;                                          // static things (quay, water) reach well past any view
    el("rect", { class: "gl-hide", x: f(-EXT * s), y: 0, width: f(2 * EXT * s), height: quay + 8, fill: "url(#nightsky" + tag + ")" }, cam);
    var street = el("g", { transform: "translate(0," + f(quay) + ") scale(" + f(s) + ")" }, cam);

    // ---- one loop of street, built once ----
    var loop = el("g", {}, null);
    var back = el("g", {}, loop), houses = el("g", {}, loop), front = el("g", {}, loop);
    // the street is a fixed length in street units, whatever the screen size, so every
    // application always maps to the same light. Screens only change the scale.
    var x = 0, n = 0, warehouses = 0, target = STREET_LEN;
    // a run of houses leaning the same way, a little less each, so they tilt as a row instead of colliding
    var lean = { 6: -1.6, 7: -1.2, 8: -0.8, 9: -0.4 };
    while (x < target) {
      var wh2 = !lean[n] && warehouses < 2 && n > 2 && chance(0.12);
      var w = wh2 ? r(48, 56) : r(31, 46);
      house(houses, x, w, { lean: lean[n], warehouse: wh2, shutter: pick(["#132018", "#2a110e", "#1a1814"]) });
      if (wh2) warehouses++;
      x += w; n++;
    }
    var LOOP = x;
    t.LOOP = LOOP;
    t.loopG = loop;
    westertoren(back, LOOP * 0.64);

    // quay surface that moves with the street
    for (var cx = 0; cx < LOOP; cx += 2.2) el("rect", { x: f(cx + r(0, 0.4)), y: f(r(0.6, 4)), width: 1.6, height: 0.7, fill: "#1c1612", opacity: 0.8 }, front);
    for (var kb = 0; kb < LOOP; kb += r(9, 13)) el("rect", { x: f(kb), y: f(QUAY_T - 1.4), width: 0.3, height: 1.4, fill: "#120e0b" }, front);

    // lamps, trees, bikes, bollards: spaced so nothing sits on top of anything else
    var nL = Math.round(LOOP / LAMP_GAP), step = LOOP / nL;
    var lampXs = [], taken = [];
    for (var i = 0; i < nL; i++) lampXs.push(step * (i + 0.36));
    function free(a1, a2) { return taken.every(function (q) { return a2 < q[0] || a1 > q[1]; }); }
    var lampEls = lampXs.map(function (lx, li) { taken.push([lx - 4, lx + 4]); var lp = lampPost(front, lx); lp.g.setAttribute("data-lamp", li); return lp; });
    // things that block lamplight: the light layer casts their shadows on the walls behind them
    // (depth = how far toward the wall they stand, 0 = at the lamp, 1 = against the wall)
    t.occluders = [];
    for (var ti = 0; ti < nL; ti += 1) {
      if (ti % 2) continue;
      var tx = step * (ti + 0.1); taken.push([tx - 5, tx + 5]);
      var tr = tree(front, tx, lampXs);
      t.occluders.push({ kind: 0, x: tx, y: -tr.h * 0.38, w: 1.6, h: tr.h * 0.38, depth: 0.45 });                      // trunk
      t.occluders.push({ kind: 1, x: tr.canopy.cx, y: tr.canopy.cy, w: tr.canopy.rx, h: tr.canopy.ry, depth: 0.45 });  // canopy (dappled)
    }
    for (var bi = 0; bi < nL; bi++) {
      [0.62, 0.86].forEach(function (fr, j) {
        if ((bi + j) % 3 === 2) return;                      // not every gap gets a bike
        var bx = step * (bi + fr), flip = chance(0.5), a1 = flip ? bx - 18 : bx - 5, a2 = flip ? bx + 5 : bx + 18;
        if (!free(a1, a2)) return;
        taken.push([a1, a2]);
        bike(front, bx, flip, chance(0.4), 0.55, false);
        t.occluders.push({ kind: 2, x: flip ? bx - 6.5 : bx + 6.5, y: -8, w: 10, h: 8, depth: 0.85 });                    // bike, near the wall
      });
    }
    for (var bo = 8; bo < LOOP; bo += 24) { var bp = bo + r(-2, 2); if (free(bp - 2, bp + 2)) bollard(front, bp); }
    var wy = QUAY_T;
    houseboat(front, 20, wy + 7);

    // ---- static quay base ----
    var qb = el("g", { class: "gl-hide" }, street);
    el("rect", { x: f(-EXT), y: 0, width: f(2 * EXT), height: QUAY_T, fill: "#14100d" }, qb);
    el("rect", { x: f(-EXT), y: f(QUAY_T - 1.4), width: f(2 * EXT), height: 1.4, fill: "#2a2119" }, qb);
    el("rect", { x: f(-EXT), y: f(QUAY_T - 1.4), width: f(2 * EXT), height: 0.3, fill: C.moonRim, opacity: mo(0.18) }, qb);

    t.windows.forEach(function (wi, q) { wi.g.setAttribute("data-w", q); });   // tag before copying

    // ---- the street row: three copies of the loop, drifting ----
    var dur = (LOOP / UW) * 80;                               // about 80 s per sidebar-width
    var scroller = el("g", { class: "scroll gl-hide" }, street);
    scroller.style.setProperty("--loop", f(-LOOP) + "px");
    scroller.style.setProperty("--dur", f(dur) + "s");
    var row = el("g", { id: "row" + tag }, scroller);
    // enough copies to cover the widest view (the opened street) at any scroll position
    var copies = [-1];
    for (var ck = 0; ck <= Math.max(1, Math.ceil((UW * 2) / LOOP)); ck++) copies.push(ck);
    copies.forEach(function (k) {
      var copy = k === 0 ? loop : loop.cloneNode(true);
      var holder = el("g", { transform: "translate(" + f(k * LOOP) + ",0)" }, row);
      holder.appendChild(copy);
    });

    // ---- water: the row mirrored, only its lights survive ----
    var wh = waterH / s + 400;
    var water = el("g", { class: "gl-hide" }, street);
    el("rect", { x: f(-EXT), y: f(wy), width: f(2 * EXT), height: f(wh), fill: BG }, water);
    var clipW = el("clipPath", { id: "waterclip" + tag }, svg.querySelector("defs"));
    el("rect", { x: f(-EXT), y: f(wy), width: f(2 * EXT), height: f(wh) }, clipW);
    var mirror = el("g", { "clip-path": "url(#waterclip" + tag + ")" }, water);
    var mscroll = el("g", { class: "scroll" }, mirror);
    mscroll.style.setProperty("--loop", f(-LOOP) + "px");
    mscroll.style.setProperty("--dur", f(dur) + "s");
    var mg = el("g", { filter: "url(#ripple" + tag + ")", opacity: 0.75 }, mscroll);
    // a real copy, not <use>: linked copies ignore the page's styles, so lights wouldn't switch in the water
    var mrow = row.cloneNode(true);
    mrow.removeAttribute("id");
    mrow.querySelectorAll("[filter]").forEach(function (n2) { n2.removeAttribute("filter"); });   // no brick grain needed underwater
    var flip = el("g", { transform: "translate(0," + f(wy * 2) + ") scale(1,-1)" }, mg);
    flip.appendChild(mrow);
    t.row = row; t.mscroll = mscroll; t.mg = mg; t.mirrorH = waterH / s + 20;
    el("rect", { x: f(-EXT), y: f(wy), width: f(2 * EXT), height: f(waterH / s), fill: "url(#mirror" + tag + ")" }, mirror);
    el("rect", { x: f(-EXT), y: f(wy + waterH / s - 0.5), width: f(2 * EXT), height: f(wh), fill: BG }, mirror);
    var rip = el("g", { class: "ripples" }, water);
    for (var k = 0; k < Math.round(UW * 3 / 4); k++) {
      el("rect", { x: f(r(-UW, UW * 2)), y: f(wy + r(3, waterH / s - 3)), width: f(r(3, 12)), height: 0.45, fill: C.moonRim, opacity: mo(r(0.05, 0.14)) }, rip);
    }

    // ---- the cyclist and the rowboat (they keep their own pace) ----
    var rider = el("g", { class: "rider" }, street);
    rider.style.setProperty("--from", f(-UW * 0.3) + "px");
    rider.style.setProperty("--to", f(UW * 1.4) + "px");
    var rg = el("g", { fill: "none", stroke: "#3a3027", "stroke-width": 0.9 }, rider);
    el("circle", { cx: 0, cy: -4.6, r: 4.6 }, rg); el("circle", { cx: 14, cy: -4.6, r: 4.6 }, rg);
    el("path", { d: "M0 -4.6 L5 -11 H12 L14 -4.6 M5 -11 L7 -4.6 L12 -11 M7 -4.6 L5.5 -16 L11 -13.5 M12 -11 L11.5 -14" }, rg);
    el("path", { d: "M5.5 -16 l2 -6 M6.5 -19 l5 3.5", "stroke-width": 1.6, stroke: "#2c241e" }, rg);
    el("path", { d: "M4.6 -15 q1.6 -4 3.4 -7 l1 1 q-1 3 -2.6 6.4z", fill: "#241d18", stroke: "none" }, rg);
    el("path", { d: "M7 -21.6 q-2 0.6 -3.6 2.4", stroke: "#5a2a22", "stroke-width": 0.8 }, rg);
    el("circle", { cx: 7.6, cy: -24, r: 2.2, fill: "#2c241e", stroke: "none" }, rg);
    el("rect", { x: 15.2, y: -11.4, width: 1.6, height: 1.1, fill: "#f6e7c4", stroke: "none" }, rg);

    var boat = el("g", { class: "sloep" }, street);
    boat.style.setProperty("--from", f(UW * 1.5) + "px");
    boat.style.setProperty("--to", f(-UW * 0.5) + "px");
    var by = wy + Math.min(waterH / s - 6, 22);
    el("path", { d: "M0 " + f(by) + " h34 q-2 5 -6 5 h-24z", fill: "#1a1612" }, boat);
    el("path", { d: "M0 " + f(by) + " h34", stroke: C.moonRim, "stroke-width": 0.5, opacity: mo(0.3) }, boat);
    el("circle", { cx: 12, cy: f(by - 4), r: 1.8, fill: "#2a221c" }, boat);
    el("path", { d: "M9.5 " + f(by) + " q2.5 -4 5 0z", fill: "#2a221c" }, boat);
    el("circle", { cx: 22, cy: f(by - 4.4), r: 1.8, fill: "#2a221c" }, boat);
    el("path", { d: "M19.5 " + f(by) + " q2.5 -4.4 5 0z", fill: "#2a221c" }, boat);
    el("path", { d: "M9 " + f(by - 1) + " l-6 5 M25 " + f(by - 1) + " l7 4.6", stroke: "#2a221c", "stroke-width": 0.6 }, boat);
    el("path", { d: "M1 " + f(by + 1.2) + " h31", stroke: "#2a221c", "stroke-width": 0.4 }, boat);
    el("rect", { x: 30.5, y: f(by - 6), width: 0.5, height: 6, fill: "#2a221c" }, boat);
    el("rect", { x: 29.6, y: f(by - 8), width: 2.2, height: 2.4, fill: "#2a2622" }, boat);   // lantern, unlit
    for (var z = 0; z < 4; z++) el("rect", { x: f(-z * 7 - 4), y: f(by + 3 + z * 0.6), width: f(6 - z), height: 0.5, fill: C.moonRim, opacity: mo(0.22 - z * 0.05) }, boat);

    // soft fade at the sidebar's right edge (screen space); goes away when the street opens
    if (!phone) {
      var fg = el("linearGradient", { id: "edge" + tag, x1: 0, y1: 0, x2: 1, y2: 0 }, svg.querySelector("defs"));
      el("stop", { offset: 0, "stop-color": BG, "stop-opacity": 0 }, fg);
      el("stop", { offset: 1, "stop-color": BG, "stop-opacity": 1 }, fg);
      t.edge = el("rect", { class: "edge", x: f(W * 0.74), y: 0, width: f(W * 0.26 + 1), height: H, fill: "url(#edge" + tag + ")" }, svg);
    } else t.edge = null;

    // ---- what each application lights, in order ----
    // streetlamps first (spread around the loop), then the houseboat, then windows (shuffled once, fixed)
    var lampOrder = [];
    for (var e = 0; e < nL; e += 2) lampOrder.push(e);
    for (var o2 = 1; o2 < nL; o2 += 2) lampOrder.push(o2);
    var winOrder = t.windows.map(function (_, q) { return q; });
    var ord = rng(SEED + 1);
    for (var a = winOrder.length - 1; a > 0; a--) { var b2 = Math.floor(ord() * (a + 1)), tmp = winOrder[a]; winOrder[a] = winOrder[b2]; winOrder[b2] = tmp; }
    // every copy of a light switches together: look them up across the clones
    t.lights = [];
    lampOrder.forEach(function (li) {
      t.lights.push([].slice.call(street.querySelectorAll('.lamp[data-lamp="' + li + '"], .ll[data-lamp="' + li + '"]')));
    });
    t.kBoat = t.lights.length;
    t.kOfLamp = {}; lampOrder.forEach(function (li, kk) { t.kOfLamp[li] = kk; });
    t.kOfW = {}; winOrder.forEach(function (q, kk) { t.kOfW[q] = t.kBoat + 1 + kk; });
    t.lights.push([].slice.call(street.querySelectorAll(".boat-lights")));
    winOrder.forEach(function (q) { t.lights.push([].slice.call(street.querySelectorAll('[data-w="' + q + '"]'))); });
    t.lights.forEach(function (els, k2) { els.forEach(function (el2) { if (!el2.classList.contains("ll") && !mrow.contains(el2)) el2.setAttribute("data-k", k2); }); });

    // the same order as geometry, in loop units, for the WebGL light layer (light.js)
    t.lightGeo = [];
    lampOrder.forEach(function (li) { t.lightGeo.push([{ type: 1, x: lampXs[li], y: -49, w: 6, h: 8, col: C.lamp }]); });
    t.lightGeo.push(t.ports.slice());
    winOrder.forEach(function (q) {
      var r2 = t.windows[q], cy = r2.y + r2.h / 2;
      t.lightGeo.push([{ type: 0, x: r2.x + r2.skew * cy, y: r2.y, w: r2.w, h: r2.h, col: r2.col }]);
    });
    t.scroller = scroller;
    t.copyOffsets = copies;
    t.waterY = wy;
    apply(t, lit, false);
  }

  /* Bake the street for the WebGL renderer: one loop, standalone, in street units.
     mode "off": every light dark; "on": every light lit; "id": only light shapes, each filled
     with its light index + 1 encoded in red/green, everything else invisible. */
  var BAKE_CSS =
    ".glass{fill:#0b0909}.win.on .glass{fill:var(--c)}.inside{opacity:0}.win.on .inside{opacity:1}" +
    ".bars{fill:none;stroke:#3a322b;stroke-width:.45}.win.on .bars{stroke:#2a1a0c}.frame{fill:none;stroke:#5a5047;stroke-width:.6}" +
    ".lamp .lantern{fill:#2a2622}.lamp.on .lantern{fill:#e9ad55}.lamp .pool{opacity:0}.lamp.on .pool{opacity:.06}" +
    ".ll.on{fill:var(--c)}.boat-lights.on .port{fill:var(--c)}";
  var ID_CSS = "*{visibility:hidden}.idl{visibility:visible;opacity:1!important;shape-rendering:crispEdges}";
  function bake(mode, R) {
    var t = main, L = t.LOOP, H = TEX_BOTTOM - TEX_TOP;
    var g = t.loopG.cloneNode(true);
    g.style.display = "";            // the live copy is hidden once the street is flattened; the bake must not be
    var lightEls = g.querySelectorAll(".win, .lamp, .ll, .boat-lights");
    if (mode !== "live" && mode !== "mirror") for (var i = 0; i < lightEls.length; i++) lightEls[i].classList.toggle("on", mode === "on");
    if (mode === "id") {
      var paint = function (el2, k) {
        var id = k + 1;
        el2.setAttribute("class", (el2.getAttribute("class") || "") + " idl");
        el2.setAttribute("style", "fill:rgb(" + (id & 255) + "," + (id >> 8 & 255) + ",0);stroke:none");
      };
      g.querySelectorAll("[data-w]").forEach(function (w) { paint(w.querySelector(".glass"), t.kOfW[w.getAttribute("data-w")]); });
      g.querySelectorAll(".lamp").forEach(function (lp) {
        var k = t.kOfLamp[lp.getAttribute("data-lamp")];
        paint(lp.querySelector(".lantern"), k);
      });
      g.querySelectorAll(".ll").forEach(function (lf) { paint(lf, t.kOfLamp[lf.getAttribute("data-lamp")]); });
      g.querySelectorAll(".boat-lights .port").forEach(function (pt) { paint(pt, t.kBoat); });
    }
    var quayBase = mode === "id" ? "" :
      '<rect x="0" y="0" width="' + L + '" height="' + QUAY_T + '" fill="#14100d"/>' +
      '<rect x="0" y="' + (QUAY_T - 1.4) + '" width="' + L + '" height="1.4" fill="#2a2119"/>';
    var defs = t.svg.querySelector("defs").outerHTML;
    if (mode === "mirror") {
      // the water: the street flipped at the waterline, through the ripple filter (dark walls drop out)
      g.querySelectorAll("[filter]").forEach(function (n2) { n2.removeAttribute("filter"); });
      var MH = t.mirrorH, wy0 = t.waterY;
      return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + Math.round(L * R) +
        '" height="' + Math.round(MH * R) + '" viewBox="0 ' + wy0 + " " + L + " " + MH + '">' +
        "<style>" + BAKE_CSS + "</style>" + defs +
        '<g filter="url(#ripple' + t.tag + ')" opacity="0.75"><g transform="translate(0,' + (2 * wy0) + ') scale(1,-1)">' +
        quayBase + new XMLSerializer().serializeToString(g) + "</g></g></svg>";
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + Math.round(L * R) +
      '" height="' + Math.round(H * R) + '" viewBox="0 ' + TEX_TOP + " " + L + " " + H + '">' +
      "<style>" + BAKE_CSS + (mode === "id" ? ID_CSS : "") + "</style>" + defs + quayBase +
      new XMLSerializer().serializeToString(g) + "</svg>";
  }

  /* ---------------------------------------------------------------- speed: flatten the street
     The vector street is thousands of shapes with filters, redrawn every frame as it drifts.
     Instead: render it once to an image (and the rippled reflection to another), slide those,
     and re-render only when a light changes (crossfading the new light in). Same pixels, a
     fraction of the work. The vector copies stay in the DOM, hidden, as the source of truth. */
  var flat = { busy: false, again: false, url: null, murl: null, pick: null };
  var NSX = "http://www.w3.org/1999/xlink";

  function rasterize(svgStr, w, h) {
    return new Promise(function (resolve, reject) {
      var src = URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml" }));
      var img = new Image();
      img.onload = function () {
        var c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(src);
        resolve(c);
      };
      img.onerror = function () { URL.revokeObjectURL(src); reject(new Error("rasterize failed")); };
      img.src = src;
    });
  }
  function toBlob(canvas) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); });
  }
  // fingerprint of the exact drawing: the cache key changes whenever the street or its lights change
  function fnv(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36) + "-" + str.length.toString(36);
  }
  // an image of this svg at this size: from the browser cache if we made it before, else rendered now and stored
  var CACHE = "street-v1";
  function cachedPNG(svgStr, w, h) {
    var key = "/street-cache/" + fnv(svgStr) + "-" + w + "x" + h + ".png";
    var make = function () { return rasterize(svgStr, w, h).then(toBlob); };
    if (!window.caches) return make();
    return caches.open(CACHE).then(function (c) {
      return c.match(key).then(function (hit) {
        if (hit) return hit.blob();
        return make().then(function (blob) {
          c.put(key, new Response(blob, { headers: { "Content-Type": "image/png" } })).then(prune).catch(function () {});
          return blob;
        });
      });
    }).catch(make);
  }
  function prune() {                                       // keep the cache small: the newest dozen images
    return caches.open(CACHE).then(function (c) {
      return c.keys().then(function (keys) { return Promise.all(keys.slice(0, Math.max(0, keys.length - 12)).map(function (k) { return c.delete(k); })); });
    });
  }
  function pixels(blob, w, h) {
    return createImageBitmap(blob).then(function (bmp) {
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      var ctx = c.getContext("2d"); ctx.drawImage(bmp, 0, 0);
      return ctx.getImageData(0, 0, w, h).data;
    });
  }
  function bakeRes() {
    var phone = window.innerWidth < 820;
    // enough pixels for the opened street on this screen; less on phones
    var need = Math.max(2, (main.geo.s * 2.4) * Math.min(2, window.devicePixelRatio || 1));
    return Math.min(phone ? 2 : 4, need, 16000 / main.LOOP);
  }
  // swap each copy of the loop (and the reflection) for the image; crossfade if replacing
  function showFlat(url, murl) {
    var t = main, L = t.LOOP, H = TEX_BOTTOM - TEX_TOP;
    [].forEach.call(t.row.children, function (holder) {
      var vec = holder.firstChild;
      if (vec && vec.tagName === "g") vec.style.display = "none";
      var img = el("image", { class: "flat", x: 0, y: TEX_TOP, width: L, height: H, preserveAspectRatio: "none" }, holder);
      img.setAttributeNS(NSX, "href", url); img.setAttribute("href", url);
      fadeIn(img, holder);
    });
    if (!t.flatMirror) {
      t.mg.style.display = "none";                                  // the live filtered mirror goes away
      t.flatMirror = el("g", {}, t.mscroll);
    }
    [-1, 0, 1, 2].forEach(function (k) {
      var mi = el("image", { class: "flat", x: f(k * L), y: f(t.waterY), width: L, height: f(t.mirrorH), preserveAspectRatio: "none" }, t.flatMirror);
      mi.setAttributeNS(NSX, "href", murl); mi.setAttribute("href", murl);
      fadeIn(mi, t.flatMirror, k);
    });
  }
  function fadeIn(img, parent, k) {
    var olds = [].filter.call(parent.querySelectorAll("image.flat"), function (o) { return o !== img && (k === undefined || o.getAttribute("x") === img.getAttribute("x")); });
    if (!olds.length) return;
    img.style.opacity = 0;
    var a = img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1100, easing: "ease", fill: "forwards" });
    var done = function () { olds.forEach(function (o) { o.remove(); }); img.style.opacity = ""; a.cancel(); };
    a.onfinish = done; setTimeout(done, 1500);
  }
  function flatten() {
    if (flat.busy) { flat.again = true; return; }
    if (!main.loopG || !window.Blob || !document.createElement("canvas").toBlob) return;
    flat.busy = true;
    var t = main, L = t.LOOP, H = TEX_BOTTOM - TEX_TOP, R = bakeRes();
    var PW = Math.round(L), PH = Math.round(H);
    var jobs = [
      cachedPNG(bake("live", R), Math.round(L * R), Math.round(H * R)),
      cachedPNG(bake("mirror", R), Math.round(L * R), Math.round(t.mirrorH * R))
    ];
    if (!flat.pick) jobs.push(cachedPNG(bake("id", 1), PW, PH).then(function (b) { return pixels(b, PW, PH); }));
    Promise.all(jobs).then(function (res) {
      if (main !== t || t.LOOP !== L) return;                      // the street was rebuilt meanwhile
      if (res[2]) flat.pick = { w: PW, h: PH, data: res[2] };
      var oldU = flat.url, oldM = flat.murl;
      flat.url = URL.createObjectURL(res[0]); flat.murl = URL.createObjectURL(res[1]);
      showFlat(flat.url, flat.murl);
      setTimeout(function () { if (oldU) URL.revokeObjectURL(oldU); if (oldM) URL.revokeObjectURL(oldM); }, 2000);
      t.svg.classList.add("flat");
    }).catch(function (e) { console.warn("flatten off:", e.message); })
      .then(function () { flat.busy = false; if (flat.again) { flat.again = false; flatten(); } });
  }
  // which light is under a screen point, from the light map (used when the vector street is hidden)
  function pickAt(clientX, clientY) {
    if (!flat.pick) return -1;
    var t = main, rc = t.svg.getBoundingClientRect(), vb = t.svg.viewBox.baseVal;
    var ux = (vb.width || rc.width) / rc.width, uy = (vb.height || rc.height) / rc.height;
    var cam = matrixOf(t.cam), sc = matrixOf(t.scroller)[4];
    var qx = (clientX - rc.left) * ux, qy = (clientY - rc.top) * uy;
    var det = cam[0] * cam[3] - cam[1] * cam[2] || 1;
    var sx = (cam[3] * (qx - cam[4]) - cam[2] * (qy - cam[5])) / det;
    var sy = (-cam[1] * (qx - cam[4]) + cam[0] * (qy - cam[5])) / det;
    var lx = ((sx / t.geo.s - sc) % t.LOOP + t.LOOP) % t.LOOP, uyy = (sy - t.geo.quay) / t.geo.s;
    var px = Math.floor(lx), py = Math.floor(uyy - TEX_TOP), P = flat.pick;
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var xx = (px + dx + P.w) % P.w, yy = py + dy;
      if (yy < 0 || yy >= P.h) continue;
      var o = (yy * P.w + xx) * 4, id = P.data[o] + P.data[o + 1] * 256;
      if (id > 0 && P.data[o + 3] > 200) return id - 1;
    }
    return -1;
  }
  function matrixOf(el2) {
    var tr = getComputedStyle(el2).transform;
    if (!tr || tr === "none") return [1, 0, 0, 1, 0, 0];
    var v = tr.match(/matrix\(([^)]+)\)/);
    return v ? v[1].split(",").map(Number) : [1, 0, 0, 1, 0, 0];
  }

  function apply(t, n, animate) {
    if (!t || !t.lights) return;
    t.lights.forEach(function (els, k) {
      var on = k < n;
      els.forEach(function (e) { e.classList.toggle("instant", !animate); e.classList.toggle("on", on); });
    });
  }

  /* ------------------------------------------------------------ page sky + moon */
  function moon(parent, mx, my, mr, tag) {
    var defs = el("defs", {}, parent);
    var mg = el("radialGradient", { id: "moonface" + tag, cx: 0.42, cy: 0.4, r: 0.65 }, defs);
    el("stop", { offset: 0, "stop-color": "#f6efdf" }, mg);
    el("stop", { offset: 1, "stop-color": "#d8cdb6" }, mg);
    var halo = el("radialGradient", { id: "moonhalo" + tag }, defs);
    el("stop", { offset: 0, "stop-color": "#c9d2e0", "stop-opacity": mo(0.04) }, halo);
    el("stop", { offset: 0.4, "stop-color": "#c9d2e0", "stop-opacity": mo(0.014) }, halo);
    el("stop", { offset: 1, "stop-color": "#c9d2e0", "stop-opacity": 0 }, halo);

    // lit part = half-circle on the lit side + terminator ellipse (lit on the right while waxing)
    var p = PHASE, waxing = p < 0.5, rx = Math.abs(Math.cos(2 * Math.PI * p)) * mr;
    var crescent = waxing ? p < 0.25 : p > 0.75;
    var outer = waxing ? 1 : 0;
    var inner = waxing ? (crescent ? 0 : 1) : (crescent ? 1 : 0);
    var lit = "M" + mx + " " + (my - mr) + " A" + mr + " " + mr + " 0 0 " + outer + " " + mx + " " + (my + mr) +
      " A" + f(rx) + " " + mr + " 0 0 " + inner + " " + mx + " " + (my - mr) + "Z";
    el("path", { d: lit }, el("clipPath", { id: "moonlit" + tag }, defs));

    var g = el("g", { class: "moon" }, parent);
    el("title", {}, g).textContent = phaseName() + ", " + Math.round(ILLUM * 100) + "% lit";
    el("circle", { cx: mx, cy: my, r: mr * 7, fill: "url(#moonhalo" + tag + ")" }, g);
    el("circle", { cx: mx, cy: my, r: mr, fill: "#1d1b20", opacity: 0.45 }, g);          // earthshine on the dark part
    var face = el("g", { "clip-path": "url(#moonlit" + tag + ")" }, g);
    el("circle", { cx: mx, cy: my, r: mr, fill: "url(#moonface" + tag + ")" }, face);
    [[-0.28, -0.22, 0.3, 0.22, -20], [0.12, -0.3, 0.2, 0.14, 10], [0.24, 0.12, 0.26, 0.18, 30], [-0.1, 0.3, 0.2, 0.13, -10], [-0.4, 0.12, 0.12, 0.1, 0], [0.42, -0.05, 0.1, 0.08, 0]].forEach(function (m) {
      el("ellipse", { cx: f(mx + m[0] * mr), cy: f(my + m[1] * mr), rx: f(m[2] * mr), ry: f(m[3] * mr), fill: "#b8ad97", opacity: 0.28, transform: "rotate(" + m[4] + " " + f(mx + m[0] * mr) + " " + f(my + m[1] * mr) + ")" }, face);
    });
    // a few craters along the terminator, where they show best
    [[0.55, -0.4, 0.07], [0.3, 0.55, 0.06], [-0.5, -0.5, 0.05], [0.65, 0.2, 0.05]].forEach(function (c) {
      el("circle", { cx: f(mx + c[0] * mr), cy: f(my + c[1] * mr), r: f(c[2] * mr), fill: "none", stroke: "#a99f8a", "stroke-width": 0.4, opacity: 0.5 }, face);
    });
  }

  function buildSky() {
    var sky = opts.sky, W = window.innerWidth, H = window.innerHeight;
    var srnd = rng(SEED + 7);
    while (sky.firstChild) sky.removeChild(sky.firstChild);
    sky.setAttribute("viewBox", "0 0 " + W + " " + H);
    for (var i = 0; i < Math.round((W * H) / 7000); i++) {
      el("circle", { class: "star", cx: f(srnd() * W), cy: f(srnd() * H), r: f(0.3 + srnd() * 0.65), fill: "#e6dccb", opacity: f(0.08 + srnd() * 0.4) }, sky);
    }
    // the sky never zooms: stars and moon stay where they are while the street comes closer
    if (W >= 820) moon(sky, W - 120, 104, 19, "page");
    else moon(sky, W - 46, opts.nav.getBoundingClientRect().bottom + 42, 13, "page");
  }

  /* ------------------------------------------------------------ opening the street: move the camera */
  var labelFor = null, open = false, busy = false, pendingClose = false, ui = null, back = null;
  var DUR = 900;

  function targetFor(Wv, Hv) {
    var g = main.geo, streetW = g.W, streetH = 250 * g.s;
    var k = Math.min((Wv * 0.92) / streetW, (Hv * 0.6) / streetH, 4);
    return { k: k, tx: (Wv - streetW * k) / 2, ty: Hv * 0.8 - g.quay * k };
  }

  /* Opening is a circle that grows from the bottom-left corner of the screen and reveals the
     street already at full size (nothing scales, so nothing can jitter). The drift and the light
     wait until the circle covers the screen, then the street comes alive. Closing is the reverse. */
  function circleOf(r) { return "circle(" + f(r) + "px at 0px " + f(window.innerHeight) + "px)"; }
  function fullR() { return Math.hypot(window.innerWidth, window.innerHeight) + 2; }
  function lightCanvases() { return [].slice.call(document.querySelectorAll("canvas.lights")); }
  // a still copy of the sidebar street, so the sidebar doesn't go blank under the growing circle
  var ghost = null;
  function syncGhost() {
    var a = main.svg.querySelectorAll(".scroll"), b = ghost.querySelectorAll(".scroll");
    for (var i = 0; i < a.length && i < b.length; i++) {
      var x = a[i].getAnimations()[0], y = b[i].getAnimations()[0];
      if (x && y) { y.currentTime = x.currentTime; y.pause(); }
    }
  }
  function makeGhost() {
    ghost = main.svg.cloneNode(true);
    ghost.removeAttribute("id");
    ghost.classList.add("ghost");
    ghost.setAttribute("aria-hidden", "true");
    main.svg.parentNode.insertBefore(ghost, main.svg);
    syncGhost();
  }

  function openStreet() {
    if (open || busy || window.innerWidth < 50 || window.innerHeight < 50) return;
    open = true; busy = true;
    var svg = main.svg, cam = main.cam, Wv = window.innerWidth, Hv = window.innerHeight;
    var tg = targetFor(Wv, Hv), to = "translate(" + f(tg.tx) + "px," + f(tg.ty) + "px) scale(" + f(tg.k) + ")";
    main.to = to;

    back = document.createElement("div"); back.className = "street-back";
    document.body.appendChild(back);
    ui = document.createElement("div"); ui.className = "street-ui";
    ui.innerHTML = '<button class="street-close">Close</button><p class="street-tip" hidden></p>';
    document.body.appendChild(ui);
    ui.querySelector(".street-close").addEventListener("click", closeStreet);
    document.body.classList.add("street-open");
    document.dispatchEvent(new CustomEvent("street", { detail: "open" }));

    // same svg, full screen and already framed; the circle starts as a point at the bottom-left
    makeGhost();
    svg.classList.add("free", "revealing");
    svg.setAttribute("viewBox", "0 0 " + Wv + " " + Hv);
    cam.style.transform = to;
    if (main.edge) main.edge.style.opacity = 0;
    var c0 = circleOf(0), c1 = circleOf(fullR());
    svg.style.clipPath = c0; back.style.clipPath = c0; back.style.opacity = 1;
    lightCanvases().forEach(function (c) { c.style.opacity = 0; });

    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var opt = { duration: reduce ? 0 : DUR, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" };
    var anims = [
      svg.animate([{ clipPath: c0 }, { clipPath: c1 }], opt),
      back.animate([{ clipPath: c0 }, { clipPath: c1 }], opt)
    ];
    whenDone(anims, function () {
      svg.style.clipPath = "none"; back.style.clipPath = "none";
      anims.forEach(function (x) { x.cancel(); });
      svg.classList.remove("revealing");                 // the street starts drifting
      if (ghost) ghost.style.visibility = "hidden";
      lightCanvases().forEach(function (c) {             // and its light comes up (visible even if frames stall)
        c.style.opacity = "";
        c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduce ? 0 : 700, easing: "ease" });
      });
      ui.classList.add("shown");
      ui.querySelector(".street-close").focus({ preventScroll: true });
      busy = false;
      if (pendingClose) { pendingClose = false; closeStreet(); }
    });
  }

  function closeStreet() {
    if (!open) return;
    if (busy) { pendingClose = true; return; }
    busy = true;
    document.dispatchEvent(new CustomEvent("street", { detail: "close" }));
    var svg = main.svg;
    ui.classList.remove("shown");
    ui.querySelector(".street-tip").hidden = true;
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var opt = { duration: reduce ? 0 : DUR * 0.8, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" };
    var c0 = circleOf(0), c1 = circleOf(fullR());
    lightCanvases().forEach(function (c) { c.style.opacity = 0; });   // light goes first, then the circle closes
    if (ghost) { syncGhost(); ghost.style.visibility = ""; }
    var anims = [
      svg.animate([{ clipPath: c1 }, { clipPath: c0 }], opt),
      back.animate([{ clipPath: c1 }, { clipPath: c0 }], opt)
    ];
    whenDone(anims, function () { settle(); busy = false; });
  }

  // put the svg back in the sidebar exactly as it was
  function settle() {
    var svg = main.svg;
    svg.getAnimations().forEach(function (x) { x.cancel(); });
    if (main.cam) { main.cam.getAnimations().forEach(function (x) { x.cancel(); }); main.cam.style.transform = ""; }
    if (main.edge) { main.edge.getAnimations().forEach(function (x) { x.cancel(); }); main.edge.style.opacity = ""; }
    svg.classList.remove("free", "revealing");
    svg.style.clipPath = "";
    lightCanvases().forEach(function (c) { c.getAnimations().forEach(function (a) { a.cancel(); }); c.style.opacity = ""; });
    svg.setAttribute("viewBox", "0 0 " + main.geo.W + " " + main.geo.H);
    if (back) back.remove();
    if (ui) ui.remove();
    if (ghost) { ghost.remove(); ghost = null; }
    back = ui = null;
    document.body.classList.remove("street-open");
    open = false;
  }

  function whenDone(anims, fn) {
    var called = false;
    function once() { if (!called) { called = true; fn(); } }
    Promise.all(anims.map(function (x) { return x.finished; })).then(once, once);
    setTimeout(once, DUR + 400);   // if the page isn't drawing frames, don't get stuck
  }

  function showTip(e) {
    if (!open || busy || !ui) return;
    var tip = ui.querySelector(".street-tip");
    var w = e.target.closest && e.target.closest("[data-k].on");
    var k = w ? +w.getAttribute("data-k") : (window.Render && Render.pick ? Render.pick(e.clientX, e.clientY) : pickAt(e.clientX, e.clientY));
    if (k < 0 || k >= lit || !labelFor) { tip.hidden = true; return; }
    tip.textContent = labelFor(k);
    tip.hidden = false;
    tip.style.left = Math.min(window.innerWidth - 260, Math.max(12, e.clientX - 120)) + "px";
    tip.style.top = Math.max(12, e.clientY - 64) + "px";
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeStreet(); });

  /* ------------------------------------------------------------ public */
  var timer;
  window.Scene = {
    mount: function (o) {
      opts = o;
      main.svg = o.svg;
      function layout() {
        if (open) settle();
        var phone = window.innerWidth < 820;
        o.rail.setAttribute("data-layout", phone ? "phone" : "desk");
        var svg = o.svg;
        main.W = Math.max(1, svg.clientWidth); main.H = Math.max(1, svg.clientHeight); main.phone = phone;
        main.navBottom = phone ? 0 : o.nav.getBoundingClientRect().bottom - svg.getBoundingClientRect().top;
        build(main); buildSky();
        flat.url = flat.murl = null; flat.pick = null; main.flatMirror = null;
        clearTimeout(flat.timer); flat.timer = setTimeout(flatten, 250);
        if (window.Scene && Scene.onBuild) Scene.onBuild();
      }
      layout();
      window.addEventListener("resize", function () { clearTimeout(timer); timer = setTimeout(layout, 160); });
      o.svg.addEventListener("click", function (e) { if (open) showTip(e); else openStreet(); });
      o.svg.addEventListener("mousemove", showTip);
    },
    setLit: function (n, animate) {
      var prev = lit;
      lit = n;
      apply(main, n, animate && n > prev);
      if (n !== prev || !flat.url) { clearTimeout(flat.timer); flat.timer = setTimeout(flatten, 250); }
    },
    labels: function (fn) { labelFor = fn; },
    info: function () { return main; },          // for render.js: geometry, camera, scroll
    bake: bake,
    texBounds: function () { return { top: TEX_TOP, bottom: TEX_BOTTOM, quayT: QUAY_T }; },
    moonState: function () { return { phase: PHASE, illum: ILLUM, lum: LUM }; },
    litCount: function () { return lit; },
    open: openStreet
  };
})();
