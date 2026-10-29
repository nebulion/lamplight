/* The street (2026-10-27): mockup H's HD-2D canal (Octopath Traveler's look: pixel art on real geometry),
 * made endless and tied to the applications he sends.
 *
 *   one loop of five blocks (~290 m) that repeats as the camera drifts along it on its own (like a screensaver);
 *   about 550 lights: streetlamps, bridge bulbs, and every window, shop window, fanlight and lantern;
 *   each light is dark until an application lights it (setLit), in a fixed order: lamps, bulbs, then windows;
 *   iconic buildings: the House with the Heads, warehouses, Golden Bend mansions, a 2 m house, Damrak's leaning
 *   houses, the Skinny Bridge, houseboats; behind: the next canal's rooftops and four church towers.
 *
 * Used by the tracker (scene3d.js) and by mockups/h-hd2d/street.html. Units are metres. Houses face +z.
 * Street z 0..9, canal z 9.4..19, near quay z 19..25. Everything is generated from a fixed seed.
 */
import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

if (!document.createElement("canvas").getContext("webgl2")) throw new Error("no webgl2");

// ================================================================== pixel art kit
const T0 = performance.now(), MARK = {};                    // mockup only: load timing
let seed = 1014;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
const PX = 16;                                            // pixels per metre, everywhere

const CTX = CanvasRenderingContext2D.prototype, LIVE = new Set();
const COLS = new Map();                                     // colour string -> packed RGBA (opaque) or [r, g, b, a] (see-through) or null
function colOf(col) {
  let v = COLS.get(col); if (v !== undefined) return v;
  let r, gg, b, a = 1, m;
  if (typeof col !== "string") v = null;
  else if ((m = /^#([0-9a-f]{3})$/i.exec(col))) { r = parseInt(m[1][0] + m[1][0], 16); gg = parseInt(m[1][1] + m[1][1], 16); b = parseInt(m[1][2] + m[1][2], 16); }
  else if ((m = /^#([0-9a-f]{6})$/i.exec(col))) { r = parseInt(m[1].slice(0, 2), 16); gg = parseInt(m[1].slice(2, 4), 16); b = parseInt(m[1].slice(4, 6), 16); }
  else if ((m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(col))) { r = +m[1]; gg = +m[2]; b = +m[3]; a = m[4] === undefined ? 1 : +m[4]; }
  if (v === undefined) v = r === undefined || a > 1 ? null : a >= 1 ? ((255 << 24) | (b << 16) | (gg << 8) | r) >>> 0 : [r, gg, b, a];
  COLS.set(col, v); return v;
}
function flushPx(g) { if (g._dirty) { CTX.putImageData.call(g, g._img, 0, 0); g._dirty = false; } }
function flushAllPx() { LIVE.forEach((g) => { flushPx(g); }); LIVE.clear(); }
function pxOf(g) {                                         // the buffer, read from the canvas if the canvas has been drawn on natively
  if (!g._img) { const c = g.canvas; g._img = g._blank ? new ImageData(c.width, c.height) : CTX.getImageData.call(g, 0, 0, c.width, c.height); g._u32 = new Uint32Array(g._img.data.buffer); }
  return g._u32;
}
function nativeBefore(g) { flushPx(g); g._img = null; g._u32 = null; g._blank = false; }   // the canvas is about to change: the buffer is stale after
function canvas(w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  g._blank = true; g._plain = true; g._img = null; g._dirty = false;
  const state = { op: "source-over", alpha: 1, filter: "none" }, plain = () => { g._plain = state.op === "source-over" && state.alpha === 1 && state.filter === "none"; };
  Object.defineProperty(g, "globalCompositeOperation", { get: () => state.op, set: (v) => { Object.getOwnPropertyDescriptor(CTX, "globalCompositeOperation").set.call(g, v); state.op = Object.getOwnPropertyDescriptor(CTX, "globalCompositeOperation").get.call(g); plain(); } });
  Object.defineProperty(g, "globalAlpha", { get: () => state.alpha, set: (v) => { Object.getOwnPropertyDescriptor(CTX, "globalAlpha").set.call(g, v); state.alpha = Object.getOwnPropertyDescriptor(CTX, "globalAlpha").get.call(g); plain(); } });
  Object.defineProperty(g, "filter", { get: () => state.filter, set: (v) => { Object.getOwnPropertyDescriptor(CTX, "filter").set.call(g, v); state.filter = Object.getOwnPropertyDescriptor(CTX, "filter").get.call(g); plain(); } });
  for (const k of ["fillRect", "clearRect", "strokeRect", "fill", "stroke", "fillText", "strokeText", "putImageData"]) g[k] = function () { nativeBefore(g); return CTX[k].apply(g, arguments); };
  g.drawImage = function (src) { if (src && src._g) flushPx(src._g); nativeBefore(g); return CTX.drawImage.apply(g, arguments); };
  g.getImageData = function (x, y, w2, h2) {               // read straight from the buffer when it's the newer copy
    if (!g._img) return CTX.getImageData.call(g, x, y, w2, h2);
    const out = new ImageData(w2, h2), W = g._img.width, src = g._img.data, dst = out.data;
    for (let j = 0; j < h2; j++) { const sy = y + j; if (sy < 0 || sy >= g._img.height) continue; for (let i = 0; i < w2; i++) { const sx = x + i; if (sx < 0 || sx >= W) continue; const s = (sy * W + sx) * 4, d = (j * w2 + i) * 4; dst[d] = src[s]; dst[d + 1] = src[s + 1]; dst[d + 2] = src[s + 2]; dst[d + 3] = src[s + 3]; } }
    return out;
  };
  c._g = g;
  return [c, g];
}
function pxRect(g, x, y, w, h, col) {                      // true if done in the buffer
  if (!g._plain || !Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(w) || !Number.isInteger(h)) return false;
  const v = colOf(col); if (v === null) return false;
  const W = g.canvas.width, H = g.canvas.height, x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
  if (x1 <= x0 || y1 <= y0) return true;
  const u = pxOf(g);
  if (typeof v === "number") { for (let yy = y0; yy < y1; yy++) u.fill(v, yy * W + x0, yy * W + x1); }
  else {                                                    // see-through colour: blend over what's there (source-over, as the canvas does)
    const d = g._img.data, [r, gg, b, a] = v;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 4, da = d[i + 3] / 255, oa = a + da * (1 - a);
      if (oa <= 0) continue;
      d[i] = Math.round((r * a + d[i] * da * (1 - a)) / oa); d[i + 1] = Math.round((gg * a + d[i + 1] * da * (1 - a)) / oa); d[i + 2] = Math.round((b * a + d[i + 2] * da * (1 - a)) / oa); d[i + 3] = Math.round(oa * 255);
    }
  }
  if (!g._dirty) { g._dirty = true; LIVE.add(g); }
  return true;
}
// setting fillStyle parses the colour every time; skip it when it hasn't changed (anything else that sets fillStyle resets g._c)
const R = (g, x, y, w, h, col) => { if (g._img !== undefined && pxRect(g, x, y, w, h, col)) return; if (g._c !== col) { g.fillStyle = col; g._c = col; } g.fillRect(x, y, w, h); };
const P = (g, x, y, col) => { if (g._img !== undefined && pxRect(g, x, y, 1, 1, col)) return; if (g._c !== col) { g.fillStyle = col; g._c = col; } g.fillRect(x, y, 1, 1); };
// (2026-10-28: saving the drawn pictures between visits was tried and removed: no faster once drawing was fast, and a
// few drawing steps read the picture so far, so replaying finished pictures moved lights. Clear any it left behind.)
if (self.caches) caches.keys().then((ks) => ks.forEach((k) => { if (k.startsWith("street-pictures-")) caches.delete(k); })).catch(() => {});
function tex(c, repeat, data) {
  if (c._g) flushPx(c._g);                                 // the picture must be on the canvas before it becomes a texture
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function sprite(w, h, draw) { const [c, g] = canvas(w, h); draw(g, w, h); return tex(c); }
const SHADES = new Map();
function shade(hex, k) {                                  // lighten (k > 0) or darken (k < 0) a colour (cached: called per pixel)
  const key = hex + k; let v = SHADES.get(key);
  if (!v) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); v = "#" + c.getHexString(); SHADES.set(key, v); }
  return v;
}
function line(g, x0, y0, x1, y1, col) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) P(g, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), col);
}

const PAL = {
  red: ["#8e3b2b", "#7d3324", "#9b4532", "#6f2c20", "#a24c38", "#84402e"],
  brown: ["#6b4430", "#5e3a28", "#77503a", "#4f3122", "#82593f", "#674233"],
  mortarRed: "#3e2a22", mortarBrown: "#352920",
  dark: "#2b2d30", darkLine: "#202225", cream: "#cdbf9f", creamHi: "#dccfb1", creamLo: "#b3a585",
  frame: "#e6dcc6", glass: ["#1a212d", "#202937", "#161c26"], glassHi: "#5a6a84",   // dark glass with the moon in it (2026-10-28; was near black)
  lit: ["#ffe6a8", "#ffd27e", "#f2ad55", "#e0913f"], curtain: ["#a5432e", "#8e5a3a", "#6d3a5a", "#c18a4a"],
  shutter: ["#2b4a35", "#22392a"], door: { green: ["#2d4b3a", "#223a2c"], red: ["#6e2a22", "#561f19"], blue: ["#25344a", "#1b2638"] },
  stone: ["#a49c8c", "#8f877a", "#bdb5a4", "#7b7468"], iron: "#1b1a19", beam: "#4a3220", gold: "#d9b25a",
  flowers: ["#d44a3c", "#e9879a", "#f1e3c8", "#d97a2b", "#b84a8a"], leaf: ["#2f4a26", "#3d5c2f", "#25391e", "#4a6b33"],
  skin: ["#e8b896", "#c98e6a", "#8d5a3c", "#f0caa8"], hair: ["#2a1d14", "#5a3a1e", "#c9a35a", "#1a1a1a", "#8a3a1e"],
  coat: ["#3a4a6a", "#6a2e2a", "#2f4a3a", "#5a4a3a", "#7a6a4a", "#3a3a40", "#8a5a2a"]
};

let seedB = 77;
const rndB = () => ((seedB = (seedB * 16807) % 2147483647) - 1) / 2147483646;
const burn = (n) => { for (let i = 0; i < n; i++) rnd(); };   // advance the main sequence as replaced code did, so nothing after it moves
// bricks: 8 x 4 px with a lit top edge and a shadowed bottom and right (chunkier since 2026-10-28; were 6 x 3)
function bricks(g, x0, y0, w, h, pal, mortar) {
  let n = 0; for (let y = y0, row = 0; y < y0 + h; y += 3, row++) for (let x = x0 - (row % 2) * 3; x < x0 + w; x += 6) n += 2;
  burn(n);
  R(g, x0, y0, w, h, mortar);
  for (let y = y0, row = 0; y < y0 + h; y += 4, row++) {
    for (let x = x0 - (row % 2) * 4; x < x0 + w; x += 8) {
      const b0 = pal[Math.floor(rndB() * pal.length)], base = rndB() < 0.06 ? shade(b0, -0.08) : b0;
      for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) {
        const px = x + i, py = y + j;
        if (px < x0 || px >= x0 + w || py >= y0 + h) continue;
        P(g, px, py, j === 0 && i < 6 ? shade(base, 0.07) : j === 2 || i === 6 ? shade(base, -0.08) : base);
      }
    }
  }
}
// soot: darker toward the top and the ground, the way old facades weather
function weather(g, W, H) {
  for (let y = 0; y < H; y++) {
    const a = Math.max(0, 0.22 - y / H * 0.5) + Math.max(0, (y / H - 0.88) * 1.4);
    if (a > 0) { g.fillStyle = `rgba(10,8,6,${a.toFixed(3)})`; g._c = null; g.fillRect(0, y, W, 1); }
  }
  for (let i = 0; i < W * H / 60; i++) P(g, ri(0, W), ri(0, H), "rgba(0,0,0,0.12)");
}

/* One facade: a pixel image with a transparent gable cut-out, plus an emission image with
   only what glows. y = 0 is the top of the gable. Returns where the awning and sign go.
   v3: seven wall materials, rusticated stone ground floors, decorative brick bands and arches,
   rain streaks and moss, gable scrolls, ornaments and date stones, varied windows and frames. */
const WALLS = {
  red:    { kind: "brick", pal: ["#8e3b2b", "#7d3324", "#9b4532", "#6f2c20", "#a24c38", "#84402e"], mortar: "#3e2a22", accent: ["#c9a27a", "#b58a62"] },
  brown:  { kind: "brick", pal: ["#6b4430", "#5e3a28", "#77503a", "#4f3122", "#82593f", "#674233"], mortar: "#352920", accent: ["#a37a52", "#8e6a46"] },
  ochre:  { kind: "brick", pal: ["#a8803e", "#9a7234", "#b58c48", "#8a6430", "#c09450"], mortar: "#4a3a26", accent: ["#7a3424", "#6a2c20"] },
  cream:  { kind: "stucco", base: "#cdbf9f", hi: "#dccfb1", lo: "#b3a585" },
  slate:  { kind: "stucco", base: "#55616d", hi: "#626e7a", lo: "#48535e" },
  salmon: { kind: "stucco", base: "#b9785e", hi: "#c8876c", lo: "#a46a52" },
  dark:   { kind: "boards", base: "#2b2d30", line: "#202225" },
  sand:   { kind: "ashlar", base: "#a89c80", hi: "#b8ac90", lo: "#8f846a" }
};
// a 3x5 pixel font for shop signs (only the letters the street uses)
const FONT = { A: "010101111101101", B: "110101110101110", E: "111100110100111", F: "111100110100100", I: "111010010010111", J: "001001001101010",
  K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101", O: "010101101101010", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  G: "011100101101011", V: "101101101101010", H: "101101111101101", D: "110101101101110", P: "110101110100100", U: "101101101101111", C: "011100100100011", W: "101101101111101" };
function pixelText(g, text, x, y, col, shadow) {
  for (const pass of shadow ? [0, 1] : [1]) [...text].forEach((ch, i) => {
    const gl = FONT[ch]; if (!gl) return;
    for (let k = 0; k < 15; k++) if (gl[k] === "1") P(g, x + i * 4 + (k % 3) + (pass ? 0 : 1), y + Math.floor(k / 3) + (pass ? 0 : 1), pass ? col : shadow);
  });
}
// gable stones (gevelstenen): small painted relief tablets that named Amsterdam houses before house numbers
function gableStone(g, x, y, kind) {
  R(g, x - 1, y - 1, 14, 12, PAL.stone[2]); R(g, x - 1, y + 10, 14, 1, PAL.stone[3]); R(g, x + 12, y - 1, 1, 12, PAL.stone[3]);
  const bg = { ship: "#4a6a8a", fish: "#c8b890", bird: "#7a9a6a", key: "#3a3a4a", sun: "#5a7aa0" }[kind];
  R(g, x, y, 12, 10, bg);
  if (kind === "ship") { R(g, x, y + 8, 12, 2, "#2a4a6a"); R(g, x + 2, y + 6, 8, 2, "#6a3a1e"); R(g, x + 3, y + 8, 6, 1, "#4a2a14"); R(g, x + 5, y + 1, 1, 5, "#3a2414"); R(g, x + 6, y + 1, 3, 4, "#e8e0d0"); P(g, x + 5, y, "#c83a2a"); }
  else if (kind === "fish") { R(g, x + 2, y + 4, 6, 3, "#8a9aa8"); R(g, x + 3, y + 3, 4, 1, "#a8b8c4"); R(g, x + 8, y + 3, 2, 5, "#6a7a88"); P(g, x + 3, y + 5, "#1a1a1a"); R(g, x + 1, y + 8, 10, 1, "#a89870"); }
  else if (kind === "bird") { R(g, x + 3, y + 4, 5, 3, "#2a2a2a"); R(g, x + 7, y + 3, 2, 2, "#2a2a2a"); P(g, x + 9, y + 4, "#d9a030"); R(g, x + 1, y + 5, 2, 1, "#2a2a2a"); R(g, x + 4, y + 7, 1, 2, "#d9a030"); R(g, x + 6, y + 7, 1, 2, "#d9a030"); }
  else if (kind === "key") { R(g, x + 1, y + 3, 4, 4, PAL.gold); R(g, x + 2, y + 4, 2, 2, "#3a3a4a"); R(g, x + 5, y + 4, 6, 1, PAL.gold); R(g, x + 9, y + 5, 1, 2, PAL.gold); R(g, x + 7, y + 5, 1, 2, PAL.gold); }
  else { R(g, x + 4, y + 3, 4, 4, PAL.gold); R(g, x + 5, y + 2, 2, 6, PAL.gold); R(g, x + 3, y + 4, 6, 2, PAL.gold); P(g, x + 2, y + 1, PAL.gold); P(g, x + 9, y + 1, PAL.gold); P(g, x + 2, y + 8, PAL.gold); P(g, x + 9, y + 8, PAL.gold); }
}
function facade(s) {
  const W = Math.round(s.w * PX), Eh = Math.round(s.eave * PX), Gh = s.gable === "cornice" ? 22 : Math.round(4.3 * PX), H = Eh + Gh;
  const [c, g] = canvas(W, H), [ec, eg] = canvas(W, H), [lc, lg] = canvas(W, H);   // day image, glow, and what changes when lit
  R(eg, 0, 0, W, H, "#000");
  const yB = (yFromGround, h) => H - yFromGround - h;
  const wall = WALLS[s.wall], FR = s.frame || PAL.frame, FRs = shade(FR, -0.18);
  if (wall.kind === "brick") bricks(g, 0, 0, W, H, wall.pal, wall.mortar);
  else if (wall.kind === "boards") { R(g, 0, 0, W, H, wall.base); for (let x = 3; x < W; x += 4) { R(g, x, 0, 1, H, wall.line); R(g, x + 1, 0, 1, H, shade(wall.base, 0.03)); } }
  else if (wall.kind === "ashlar") {                       // sandstone blocks (the Golden Bend's mansions)
    R(g, 0, 0, W, H, wall.base);
    for (let y = 0, row = 0; y < H; y += 8, row++) { R(g, 0, y, W, 1, wall.lo); R(g, 0, y + 1, W, 1, wall.hi); for (let x = (row % 2) * 10; x < W; x += 20) R(g, x, y, 1, 8, wall.lo); }
    burn(3 * Math.ceil(W * H / 14));                        // (was a speckle of light and dark pixels: it read as dirt)
  }
  else { R(g, 0, 0, W, H, wall.base); burn(3 * Math.ceil(W * H / 8));   // plaster: no speckle any more (it read as dirt)
    for (let i = 0; i < 6; i++) { const x = ri(0, W - 10), y = ri(0, H - 10); R(g, x, y, ri(4, 10), ri(3, 7), shade(wall.base, -0.04)); } }   // patched plaster
  weather(g, W, H);
  if (s.speklagen) for (let y = H - 72; y > 6; y -= 13) { R(g, 0, y, W, 2, "#c9c0ac"); R(g, 0, y + 2, W, 1, "rgba(0,0,0,0.25)"); g._c = null; }   // bands of stone in the brick (Dutch Renaissance)
  const groundH = Math.round(4.0 * PX), top = Eh - 6, fh = Math.floor((top - groundH) / s.floors);
  // ground floor in rusticated stone (big blocks, lit top edges)
  if (s.stoneBase) {
    for (let y = H - groundH, row = 0; y < H; y += 8, row++) for (let x = (row % 2) * -9; x < W; x += 18) {
      const b = pick(["#8f877a", "#857d70", "#9a9284"]);
      R(g, Math.max(0, x), y, 17, 7, b); R(g, Math.max(0, x), y, 17, 1, shade(b, 0.08)); R(g, Math.max(0, x), y + 6, 17, 1, shade(b, -0.1)); R(g, Math.max(0, x + 16), y, 1, 7, shade(b, -0.12));
    }
  }
  const plinth = 9;
  R(g, 0, yB(0, plinth), W, plinth, PAL.stone[1]);
  for (let x = ri(0, 6); x < W; x += ri(9, 13)) { R(g, x, yB(0, plinth), 1, plinth, PAL.stone[3]); R(g, x + 1, yB(0, plinth), 1, plinth, PAL.stone[0]); }
  R(g, 0, yB(plinth, 1), W, 1, PAL.stone[2]);
  for (let x = 0; x < W; x++) if (rnd() < 0.35) P(g, x, yB(ri(0, 4), 1), pick(["#3d5a2c", "#2c4422", "#4a6a34"]));   // moss at the foot
  const bands = [], holes = [];
  let mask = null;
  const band = (yb) => {
    bands.push(yb);
    R(g, 0, yB(yb, 2), W, 1, PAL.stone[2]); R(g, 0, yB(yb, 2) + 1, W, 1, PAL.stone[0]); R(g, 0, yB(yb - 1, 1), W, 1, "rgba(0,0,0,0.4)");
    if (wall.kind === "brick") for (let x = 0; x < W; x += 2) P(g, x, yB(yb + 2, 1), wall.accent[(x / 2) % 2]);   // a course of contrasting headers
  };
  band(groundH);
  for (let f = 1; f <= s.floors; f++) band(groundH + f * fh);
  if (s.pilasters) {                                        // flat pilasters with capitals at both edges
    const pc = wall.kind === "stucco" ? wall.hi : PAL.stone[2], len = top - groundH;
    for (const px of [1, W - 6]) {
      R(g, px, yB(top, len), 5, len, pc); R(g, px + 4, yB(top, len), 1, len, shade(pc, -0.14)); R(g, px, yB(top, len), 1, len, shade(pc, 0.06));
      R(g, px - 1, yB(top, 3), 7, 3, PAL.stone[2]); R(g, px - 1, yB(top - 3, 1), 7, 1, PAL.stone[3]); R(g, px - 1, yB(groundH + 3, 3), 7, 3, PAL.stone[0]);
    }
  }
  const lit = [], sills = [];
  const win = (x, yb, w, h, opt) => {
    const y = yB(yb, h), kind = rnd() < 0.08 ? "tv" : "warm", lid = newLid("window");
    holes.push({ x: x - 1, y: y - 1, w: w + 2, h: h + 2, kind: "win", flowers: !!opt.flowers, balcony: !!opt.balcony, lid });
    if (wall.kind === "brick" && !opt.arch) {                // a relieving arch of contrasting brick over the window
      for (let i = -1; i <= w; i++) { const t = (i + 1) / (w + 1), lift = Math.round(Math.sin(t * Math.PI) * 2); P(g, x + i, y - 3 - lift, wall.accent[(i + 8) % 2]); P(g, x + i, y - 4 - lift, wall.accent[(i + 9) % 2]); }
    }
    R(g, x - 1, y - 1, w + 2, h + 2, FR); R(g, x + w, y - 1, 1, h + 2, FRs);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const on = kind === "warm" ? PAL.lit[Math.min(3, Math.floor(yy / h * 3.2 + (rnd() < 0.15 ? 1 : 0)))] : ["#b8c8e8", "#9fb2d6", "#8296bc", "#6e80a6"][Math.min(3, Math.floor(yy / h * 3.2))];
      P(g, x + xx, y + yy, (xx - yy === 1 || xx - yy === 2) && yy < h * 0.5 ? PAL.glassHi : pick(PAL.glass));
      P(lg, x + xx, y + yy, on); P(eg, x + xx, y + yy, on);
    }
    const ink = (px, py, pw, ph, col) => { R(lg, px, py, pw, ph, col); R(eg, px, py, pw, ph, "#000"); };   // seen only when the light is on
    const both = (px, py, pw, ph, col) => { R(g, px, py, pw, ph, col); ink(px, py, pw, ph, col); };
    const extra = rnd();
    if (kind === "warm") {
      if (opt.curtain) { const cc = pick(PAL.curtain); for (const cx of [x, x + w - 2]) { ink(cx, y, 2, h, cc); R(lg, cx + (cx === x ? 1 : 0), y, 1, h, shade(cc, -0.1)); } }
      else if (extra < 0.25) { const px = x + ri(2, w - 4); ink(px, y + Math.round(h * 0.5), 2, Math.round(h * 0.5), "#3a2410"); ink(px - 1, y + Math.round(h * 0.45), 4, 2, "#3a2410"); }      // someone inside
      else if (extra < 0.45) { for (let k = 0; k < 3; k++) ink(x + 1 + k * Math.floor(w / 3), y + h - 4, 3, 3, pick(PAL.leaf)); }                                                           // plants
      else if (extra < 0.6) { const px = x + ri(2, w - 6); ink(px, y + 3, 5, 3, "#7a3a1e"); ink(px + 2, y + 6, 1, 4, "#2a1a10"); }                                                      // a lamp with a shade
      else if (extra < 0.75) { for (let yy = 0; yy < h; yy += 2) for (let xx = (yy / 2) % 2; xx < w; xx += 2) P(lg, x + xx, y + yy, "#f6efe0"); }                                        // lace
    }
    { const extra = rnd();                                  // and when it's off
      if (extra < 0.18) { for (let yy = 1; yy < h * 0.7; yy += 2) R(g, x, y + yy, w, 1, shade(FR, -0.25)); }                                                                              // blinds
      else if (extra < 0.26) { const px = x + ri(1, w - 5); R(g, px, y + h - 4, 4, 3, "#0b0a09"); P(g, px, y + h - 5, "#0b0a09"); P(g, px + 3, y + h - 5, "#0b0a09"); }                    // a cat on the sill
    }
    // glazing: six panes (two bars) on wider windows, four on narrow ones
    const bars = w >= 13 && rnd() < 0.6 ? [Math.round(w / 3), Math.round(2 * w / 3)] : [Math.floor(w / 2)];
    bars.forEach((bx) => both(x + bx, y, 1, h, FR));
    both(x, y + Math.round(h * 0.42), w, 1, FR);
    R(g, x - 2, y + h + 1, w + 4, 1, PAL.stone[2]); R(g, x - 2, y + h + 2, w + 4, 1, "rgba(0,0,0,0.45)");
    if (opt.arch) { for (let i = 0; i < w + 2; i++) P(g, x - 1 + i, y - 2 - (i > 1 && i < w ? 1 : 0), PAL.stone[0]); }
    else { R(g, x - 1, y - 2, w + 2, 1, PAL.stone[3]); }
    if (opt.shutters) {
      const open = rnd() < 0.5;
      for (const sx of [x - 5, x + w + 1]) { const sw = open ? 4 : 4; R(g, sx, y - 1, sw, h + 2, PAL.shutter[0]); for (let k = y; k < y + h; k += 2) R(g, sx, k, sw, 1, PAL.shutter[1]); R(g, sx, y - 1, 1, h + 2, shade(PAL.shutter[0], 0.06)); }
    }
    if (opt.flowers) {
      R(g, x - 1, y + h + 3, w + 2, 3, "#5a3a24"); R(g, x - 1, y + h + 5, w + 2, 1, "#3a2414");
      for (let i = 0; i < w + 2; i++) { P(g, x - 1 + i, y + h + 2, rnd() < 0.55 ? pick(PAL.leaf) : pick(PAL.flowers)); if (rnd() < 0.6) P(g, x - 1 + i, y + h + 1, pick(PAL.flowers)); if (rnd() < 0.3) P(g, x - 1 + i, y + h + 6, pick(PAL.leaf)); }
    }
    sills.push([x, y + h + 3, w]);
    lit.push({ x: (x + w / 2) / PX, y: (H - y - h / 2) / PX, lid });
  };
  // ground floor: door with fanlight, steps, a number plaque and a bell
  const D0 = s.stoop ? 22 : 2, dx = s.doorCenter ? Math.round(W / 2 - 8.5) : Math.round(W * 0.12), dw = 17, dh = 40, dcol = PAL.door[s.door];
  R(g, dx - 1, yB(D0, dh + 2), dw + 2, dh + 2, PAL.stone[0]); R(g, dx + dw + 1, yB(D0, dh + 2), 1, dh + 2, PAL.stone[3]);
  R(g, dx, yB(D0, dh), dw, dh, dcol[0]);
  for (let k = 0; k < 3; k++) { R(g, dx + 2, yB(D0 + 4 + k * 10, 7), dw - 4, 7, dcol[1]); R(g, dx + 2, yB(D0 + 4 + k * 10, 7), dw - 4, 1, shade(dcol[0], 0.06)); }
  P(g, dx + dw - 3, yB(D0 + 15, 1), PAL.gold); P(g, dx + dw - 3, yB(D0 + 14, 1), shade(PAL.gold, -0.2));
  if (s.doorStyle === "double") { R(g, dx + Math.floor(dw / 2), yB(D0, dh), 1, dh, shade(dcol[0], -0.25)); P(g, dx + Math.floor(dw / 2) - 2, yB(D0 + 18, 1), PAL.gold); }
  else if (s.doorStyle === "carved") {                     // a carved sunburst in the upper panel
    const cy = yB(D0 + dh - 12, 1), cx = dx + Math.floor(dw / 2);
    for (let a = 0; a < 7; a++) { const t = Math.PI * (a + 0.5) / 7; line(g, cx, cy, Math.round(cx + Math.cos(t) * 6), Math.round(cy - Math.sin(t) * 6), shade(dcol[0], 0.14)); }
    R(g, cx - 1, cy - 1, 3, 2, PAL.gold);
  } else if (s.doorStyle === "glass") {                    // glazed upper half behind an iron grille
    const gy = yB(D0 + dh - 17, 13);
    R(g, dx + 3, gy, dw - 6, 13, PAL.glass[1]); R(lg, dx + 3, gy, dw - 6, 13, PAL.lit[2]); R(eg, dx + 3, gy, dw - 6, 13, PAL.lit[3]);
    for (let x = dx + 4; x < dx + dw - 3; x += 3) { R(g, x, gy, 1, 13, PAL.iron); R(lg, x, gy, 1, 13, PAL.iron); R(eg, x, gy, 1, 13, "#000"); }
    R(g, dx + 3, gy + 6, dw - 6, 1, PAL.iron); R(lg, dx + 3, gy + 6, dw - 6, 1, PAL.iron); R(eg, dx + 3, gy + 6, dw - 6, 1, "#000");
  }
  if (s.plaque) gableStone(g, dx + Math.floor(dw / 2) - 6, yB(D0 + 50, 10), s.plaque);
  R(g, dx + dw + 3, yB(D0 + 18, 3), 4, 3, "#2a4a8a"); P(g, dx + dw + 4, yB(D0 + 19, 1), "#f0f0f0"); P(g, dx + dw + 5, yB(D0 + 19, 1), "#f0f0f0");   // blue enamel house number
  R(g, dx + dw + 3, yB(D0 + 12, 4), 2, 4, "#8a7a5a"); P(g, dx + dw + 3, yB(D0 + 14, 1), PAL.gold);                                              // bell plate
  const fan = yB(D0 + dh + 1, 6);
  for (let i = 0; i < dw; i++) for (let j = 0; j < 6; j++) if (Math.hypot(i - dw / 2 + 0.5, (j - 6) * 1.6) < dw / 2) { P(g, dx + i, fan + j, PAL.glass[0]); P(lg, dx + i, fan + j, PAL.lit[1]); P(eg, dx + i, fan + j, PAL.lit[1]); }
  for (let i = 1; i < dw; i += 3) { P(g, dx + i, fan + 5, FR); P(lg, dx + i, fan + 5, FR); P(eg, dx + i, fan + 5, "#000"); }
  holes.push({ x: dx, y: fan, w: dw, h: H - D0 - fan, kind: "door", lid: newLid("door") });
  R(g, dx - 3, yB(D0 - 2, 2), dw + 6, 2, PAL.stone[2]); R(g, dx - 2, yB(D0, 1), dw + 4, 1, PAL.stone[0]);
  let shop = null;
  if (s.shop) {
    const sw = Math.round(W * 0.5), sx = W - sw - Math.round(W * 0.08), sh = 36, sy = yB(11, sh);
    R(g, sx - 3, sy - 9, sw + 6, 7, s.shop.frame); R(g, sx - 3, sy - 9, sw + 6, 1, shade(s.shop.frame, 0.1));                  // signboard
    if (s.shop.name) { const tw = s.shop.name.length * 4 - 1; pixelText(g, s.shop.name, sx + Math.round((sw - tw) / 2), sy - 8, s.shop.ink || PAL.gold, "rgba(0,0,0,0.55)"); }
    else for (let x = sx; x < sx + sw; x += 2) P(g, x, sy - 6, PAL.gold);
    R(g, sx - 2, sy - 2, sw + 4, sh + 4, s.shop.frame);
    const shopLid = newLid("shop");
    holes.push({ x: sx - 2, y: sy - 2, w: sw + 4, h: sh + 4, kind: "shop", lid: shopLid });
    for (let yy = 0; yy < sh; yy++) for (let xx = 0; xx < sw; xx++) { const col = PAL.lit[Math.min(3, Math.floor(yy / sh * 2.6))]; P(g, sx + xx, sy + yy, pick(PAL.glass)); P(lg, sx + xx, sy + yy, col); P(eg, sx + xx, sy + yy, shade(col, -0.5)); }   // dimmer glow so the display reads
    // what's inside: drawn into both images, glowing less than the light behind it
    const put = (x, y, w, h, col, glow) => { R(lg, x, y, w, h, col); R(eg, x, y, w, h, glow === undefined ? shade(col, -0.7) : glow); R(g, x, y, w, h, shade(col, -0.62)); };   // unlit: shapes in the dark
    const ln = (x0, y0, x1, y1, col) => { line(lg, x0, y0, x1, y1, col); line(eg, x0, y0, x1, y1, "#000"); line(g, x0, y0, x1, y1, shade(col, -0.62)); };
    const ring = (cx, cy, r) => { for (let a = 0; a < 28; a++) { const t = a / 28 * Math.PI * 2; put(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), 1, 1, "#141210", "#000"); } };
    const disp = s.shop.display || "shelves";
    if (disp === "shelves") {                                  // the bakery: shelves of bread, loaves on the counter
      for (let k = 1; k < 3; k++) { const shelf = sy + Math.round(sh * k / 3); put(sx, shelf, sw, 1, "#5a3a20", "#000");
        for (let x = sx + 1; x < sx + sw - 3; x += ri(3, 5)) { const gc = pick(s.shop.goods); put(x, shelf - 3, 3, 3, gc); P(lg, x, shelf - 3, shade(gc, 0.12)); } }
      for (let x = sx + 2; x < sx + sw - 5; x += 6) { put(x, sy + sh - 4, 5, 3, "#b07a3a"); put(x + 1, sy + sh - 5, 3, 1, "#d09a52"); put(x + 1, sy + sh - 3, 1, 1, "#7a4a1a"); put(x + 3, sy + sh - 3, 1, 1, "#7a4a1a"); }
    } else if (disp === "cafe") {                              // pendant lamps, bottles behind the bar, two people at a table
      for (let k = 0; k < 3; k++) { const lx = sx + Math.round(sw * (k + 0.5) / 3); put(lx, sy, 1, 5, "#2a1a10", "#000"); put(lx - 2, sy + 5, 5, 2, "#3a2414", "#000"); put(lx - 1, sy + 7, 3, 1, "#fff4d0", "#fff4d0"); }
      put(sx, sy + 16, sw, 1, "#4a2a14", "#000");
      for (let x = sx + 2; x < sx + sw - 2; x += 3) put(x, sy + 13, 1, 3, pick(["#6a8a5a", "#8a3a2a", "#c8b070", "#3a5a6a"]));
      const px = sx + Math.round(sw * 0.28), qx = px + 13, fy = sy + sh - 11;
      for (const hx of [px, qx]) { put(hx, fy, 3, 3, "#2a1a12", "#000"); put(hx - 1, fy + 3, 5, 8, "#2a1a12", "#000"); }
      put(px + 4, fy + 5, 8, 1, "#3a2414", "#000"); put(px + 7, fy + 6, 1, 5, "#3a2414", "#000"); put(px + 6, fy + 4, 1, 1, "#e8e0d0"); put(px + 9, fy + 4, 1, 1, "#e8e0d0");
    } else if (disp === "books") {                             // three shelves of spines
      for (let k = 0; k < 3; k++) {
        const base = sy + 11 + k * 11; put(sx, base, sw, 1, "#4a2a14", "#000");
        for (let x = sx + 1; x < sx + sw - 1;) {
          const bw = rnd() < 0.3 ? 2 : 1, bh = ri(5, 8), col = pick(["#7a2a22", "#2a4a6a", "#5a6a3a", "#c8a060", "#4a2a4a", "#d8d0c0", "#2a2a2a", "#8a5a2a"]);
          put(x, base - bh, bw, bh, col); if (rnd() < 0.4) put(x, base - bh + 1, 1, 1, shade(col, 0.3));
          x += bw + (rnd() < 0.12 ? 2 : 0);
        }
      }
    } else if (disp === "bikes") {                             // two bikes in the window, tyres hung on the back wall
      const bike = (bx, by, col) => { ring(bx, by, 4); ring(bx + 13, by, 4); ln(bx, by, bx + 5, by - 6, col); ln(bx + 5, by - 6, bx + 11, by - 6, col); ln(bx + 11, by - 6, bx + 13, by, col); ln(bx + 5, by - 6, bx + 6, by, col); ln(bx + 6, by, bx + 11, by - 6, col); put(bx + 4, by - 8, 3, 1, "#141210", "#000"); put(bx + 11, by - 9, 1, 3, "#141210", "#000"); };
      bike(sx + 5, sy + sh - 6, "#3c6a8a"); bike(sx + sw - 20, sy + sh - 6, "#8a2a22");
      for (let k = 0; k < Math.floor((sw - 8) / 10); k++) ring(sx + 7 + k * 10, sy + 8, 3);
    } else if (disp === "flowers") {                           // buckets on two steps, plants trailing from the top
      for (let row = 0; row < 2; row++) { const by = sy + sh - 4 - row * 12;
        for (let x = sx + 2 + row * 3; x < sx + sw - 5; x += 7) { put(x, by, 5, 4, "#5a5a62"); put(x, by, 5, 1, "#7a7a84"); const fc = pick(PAL.flowers);
          for (let k = 0; k < 16; k++) put(x + ri(-1, 5), by - ri(1, 6), 1, 1, rnd() < 0.55 ? fc : pick(PAL.leaf)); } }
      for (let x = sx + 4; x < sx + sw - 4; x += 9) { const n = ri(5, 9); for (let k = 0; k < n; k++) put(x + ri(-1, 1), sy + k, 1, 1, pick(PAL.leaf)); }
    }
    for (let x = sx + Math.round(sw / 3); x < sx + sw; x += Math.round(sw / 3)) { R(g, x, sy, 1, sh, s.shop.frame); R(lg, x, sy, 1, sh, s.shop.frame); R(eg, x, sy, 1, sh, "#000"); }
    shop = { x: (sx + sw / 2) / PX, w: (sw + 8) / PX, top: (H - sy + 6) / PX };
    lit.push({ x: (sx + sw / 2) / PX, y: (H - sy - sh / 2) / PX, shop: true, lid: shopLid });
  } else if (s.warehouse) {                                 // a big arched cart door in the middle
    const cw = 28, ch = 46, cx0 = Math.round(W / 2 - cw / 2), cy0 = yB(0, ch), rr = cw / 2;
    R(g, cx0 - 2, cy0 - 2, cw + 4, ch + 2, PAL.stone[2]);
    for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) { if (yy < rr && Math.hypot(xx - rr + 0.5, rr - yy) > rr) continue; P(g, cx0 + xx, cy0 + yy, xx % 4 === 0 ? "#2a1a10" : xx === rr ? "#1a100a" : pick(["#4a3020", "#4e3424", "#45301e"])); }
    holes.push({ x: cx0, y: cy0 + rr, w: cw, h: ch - rr, kind: "cart" });
  } else if (s.noGround) {
  } else if (s.doorCenter) { for (const fx of [0.2, 0.8]) win(Math.round(W * fx) - 8, 15, 16, 30, { curtain: true }); }
  else {
    const gw = Math.min(30, Math.round(W * 0.4)), gx = W - gw - Math.round(W * 0.12);
    win(gx, 15, gw, 34, { lit: s.groundLit, curtain: true });
    R(g, gx + 2, yB(3, 8), gw - 4, 8, "#0d0c0b"); for (let x = gx + 3; x < gx + gw - 3; x += 3) R(g, x, yB(3, 8), 1, 8, PAL.iron);
  }
  if (s.warehouse) for (let f = 0; f < s.floors; f++) {     // stacked loading doors with hourglass shutters, a small window each side
    const y0 = groundH + f * fh, lh = Math.round(fh * 0.8), lw = 18, lx = Math.round(W / 2 - lw / 2), ly = yB(y0 + Math.round((fh - lh) * 0.35), lh);
    R(g, lx - 1, ly - 1, lw + 2, lh + 2, PAL.stone[3]);
    for (let yy = 0; yy < lh; yy++) for (let xx = 0; xx < lw; xx++) { const u = ((xx % 9) + 0.5) / 9, v = (yy + 0.5) / lh; P(g, lx + xx, ly + yy, Math.abs(v - 0.5) > Math.abs(u - 0.5) ? s.shutterCol[1] : s.shutterCol[0]); }
    R(g, lx + 8, ly, 1, lh, "#1a140e"); R(g, lx, ly, lw, 1, shade(s.shutterCol[0], 0.12));
    for (const hy of [3, lh - 4]) { R(g, lx, ly + hy, 4, 1, PAL.iron); R(g, lx + lw - 4, ly + hy, 4, 1, PAL.iron); }
    const ww = 9, wh = Math.round(fh * 0.5);
    for (const fx of [0.17, 0.83]) win(Math.round(W * fx - ww / 2), y0 + Math.round((fh - wh) * 0.42), ww, wh, { curtain: rnd() < 0.3, arch: true });
  }
  else for (let f = 0; f < s.floors; f++) for (let k = 0; k < s.cols; k++) {
    const ww = 13, wh = Math.round(fh * (s.tallWin || 0.62)), cx = Math.round(W * (k + 1) / (s.cols + 1));
    win(cx - Math.floor(ww / 2), groundH + f * fh + Math.round((fh - wh) * 0.42), ww, wh,
      { lit: rnd() < s.litShare, curtain: rnd() < 0.35, shutters: s.shutters && f < s.floors - 1, flowers: s.flowers && f === 0 && s.balcony !== 1, arch: s.arch,
        balcony: s.balcony === f + 1 && (s.cols === 2 || k === 1) });
  }
  if (s.heads) for (let k = 0; k <= s.cols; k++) {          // the heads on the piers between the first-floor windows, on consoles
    const px = Math.round(W * (k + 0.5) / (s.cols + 1)), by = yB(groundH + fh + Math.round(fh * 0.45), 1), st = PAL.stone;
    R(g, px - 4, by, 8, 2, st[2]); R(g, px - 4, by + 1, 8, 1, st[3]);
    R(g, px - 3, by - 3, 6, 3, st[0]); R(g, px - 3, by - 3, 1, 3, st[2]); R(g, px - 1, by - 4, 2, 1, st[3]);
    R(g, px - 2, by - 9, 4, 5, st[0]); R(g, px - 2, by - 9, 1, 5, st[2]); R(g, px + 1, by - 7, 1, 3, st[3]); P(g, px - 1, by - 7, st[3]); P(g, px + 1, by - 7, st[3]);
    if (k % 2) R(g, px - 2, by - 10, 4, 2, st[1]); else { P(g, px - 2, by - 10, st[1]); P(g, px + 1, by - 10, st[1]); R(g, px - 1, by - 11, 2, 2, st[1]); }   // helmets and laurels
  }
  // rain streaks under the sills
  sills.forEach(([x, y, w]) => { for (let k = 0; k < 3; k++) { const sx = x + ri(0, w - 1), len = ri(6, 20); for (let j = 0; j < len; j++) { g.fillStyle = `rgba(14,10,8,${(0.22 * (1 - j / len)).toFixed(3)})`; g._c = null; g.fillRect(sx, y + j, 1, 1); } } });
  for (let f = 1; f <= s.floors; f++) for (const ax of [3, W - 5]) { R(g, ax, yB(groundH + f * fh + 3, 6), 2, 6, PAL.iron); R(g, ax - 1, yB(groundH + f * fh + 5, 2), 4, 2, PAL.iron); }
  if (s.ivy) {
    for (let y = H - 2; y > H * 0.35; y--) {
      const spread = Math.round(6 + Math.sin(y * 0.15) * 3 + (H - y) * 0.02);
      for (let k = 0; k < spread; k++) if (rnd() < 0.55 - (H - y) / H * 0.4) { const col = pick(PAL.leaf); P(g, s.ivy === "left" ? k : W - 1 - k, y, col); if (rnd() < 0.1) P(g, s.ivy === "left" ? k : W - 1 - k, y, "#6b8a4a"); }
    }
  }
  const cxp = W / 2;
  if (s.gable === "cornice") {
    R(g, 0, 0, W, 6, PAL.stone[2]); R(g, 0, 0, W, 1, shade(PAL.stone[2], 0.08)); R(g, 0, 6, W, 2, PAL.stone[3]);
    for (let x = 1; x < W; x += 3) { R(g, x, 8, 2, 2, PAL.stone[0]); P(g, x + 1, 9, PAL.stone[3]); }
    R(g, 0, 10, W, 1, "rgba(0,0,0,0.5)");
    for (let x = 4; x < W - 4; x += 6) { R(g, x, 1, 2, 4, PAL.stone[1]); }                                 // balustrade posts
    win(Math.round(cxp - 6), Eh + 3, 12, 8, { lit: false });
  } else {
    const half = (gy) => {
      if (s.gable === "spout") return gy < 0.78 ? 1 - (gy / 0.78) * 0.72 : 0.28 * Math.sqrt(Math.max(0, 1 - ((gy - 0.78) / 0.22) ** 2)) + 0.02;   // a warehouse's spout gable
      if (s.gable === "step") return Math.max(0.22, 1 - Math.floor(gy * 4.0) * 0.26);
      if (s.gable === "bell") return gy < 0.8 ? 0.36 + 0.64 * Math.pow(1 - gy / 0.8, 1.7) : 0.36 * Math.sqrt(Math.max(0, 1 - ((gy - 0.8) / 0.2) ** 2));
      if (gy < 0.34) return 0.38 + 0.62 * Math.sqrt(Math.max(0, 1 - (gy / 0.34) ** 2));
      if (gy < 0.88) return 0.38;
      return 0.38 * (1 - (gy - 0.88) / 0.12) + 0.06;
    };
    mask = [];
    for (let y = 0; y < Gh; y++) {
      const gy = 1 - y / Gh, hw = Math.round(half(gy) * W / 2);
      mask[y] = hw;
      g.clearRect(0, y, Math.max(0, cxp - hw), 1); g.clearRect(cxp + hw, y, W, 1);
      eg.clearRect(0, y, Math.max(0, cxp - hw), 1); eg.clearRect(cxp + hw, y, W, 1);
    }
    for (let y = 0; y < Gh; y++) {
      const hw = mask[y], above = y > 0 ? mask[y - 1] : 0;
      for (let x = cxp - hw; x < cxp - Math.min(hw, above) + 1; x++) P(g, x, y, PAL.stone[2]);
      for (let x = cxp + Math.min(hw, above) - 1; x < cxp + hw; x++) P(g, x, y, shade(PAL.stone[2], -0.12));
    }
    if (s.gable === "bell" || s.gable === "neck") {         // stone scrolls along the shoulders, and an ornament at the top
      [0.22, 0.5].forEach((gy) => {
        const y = Math.round(Gh * (1 - gy)), hw = mask[y];
        for (const side of [-1, 1]) { const x0 = Math.round(cxp + side * (hw - 3)); R(g, x0 - 1, y - 1, 3, 3, PAL.stone[2]); P(g, x0, y, PAL.stone[3]); P(g, x0 + side, y + 2, PAL.stone[0]); }
      });
      R(g, cxp - 2, 0, 4, 3, PAL.stone[2]); P(g, cxp - 1, 0, shade(PAL.stone[2], 0.1)); R(g, cxp - 3, 3, 6, 1, PAL.stone[3]);
    }
    if (s.gable === "step") for (let y = 1; y < Gh; y++) if (mask[y] !== mask[y - 1]) { R(g, cxp - mask[y], y, 3, 1, PAL.stone[0]); R(g, cxp + mask[y] - 3, y, 3, 1, PAL.stone[0]); }   // stone caps on the steps
    win(Math.round(cxp - 5), Eh + Math.round(Gh * 0.22), 10, 14, { lit: rnd() < 0.35, arch: true });
    if (rnd() < 0.7) { const dy = Eh + Math.round(Gh * 0.07); R(g, cxp - 5, H - dy - 4, 10, 4, PAL.stone[2]); for (let k = 0; k < 4; k++) P(g, cxp - 4 + k * 2, H - dy - 2, "#4a3a2a"); }   // date stone
    R(g, cxp - 1, Math.round(Gh * 0.16), 2, 6, PAL.beam); P(g, cxp - 2, Math.round(Gh * 0.16) + 6, PAL.iron);
  }
  const [Lc, Lg] = canvas(W, H); Lg.drawImage(c, 0, 0); Lg.drawImage(lc, 0, 0);   // the lit image: the day image with every window on
  {                                                         // one gradient per house so repeated bricks don't read flat (Octopath does this per object)
    const gr = g.createLinearGradient(0, 0, 0, H), k = 0.18 + rnd() * 0.14;
    gr.addColorStop(0, `rgba(255,236,210,${(0.03 + rnd() * 0.04).toFixed(3)})`); gr.addColorStop(0.45, "rgba(0,0,0,0)"); gr.addColorStop(1, `rgba(18,12,8,${k.toFixed(3)})`);
    g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g._c = null; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over";
    Lg.globalCompositeOperation = "source-atop"; Lg.fillStyle = gr; Lg.fillRect(0, 0, W, H); Lg.globalCompositeOperation = "source-over";
  }
  return { map: tex(c), litMap: tex(Lc), emissive: tex(ec), W, H, Eh, Gh, lit, shop, doorX: (dx + dw / 2) / PX, holes, bands, mask, dw };
}

// ---------- tileable and sprite textures
// ---------- tileable and sprite textures
const sideWall = (() => { const [c, g] = canvas(32, 32); bricks(g, 0, 0, 32, 32, PAL.brown, PAL.mortarBrown); return c; })();
const roofTiles = (() => {
  const [c, g] = canvas(16, 16); R(g, 0, 0, 16, 16, "#2d2f36");
  for (let y = 0; y < 16; y += 4) { R(g, 0, y, 16, 1, "#4a4c55"); R(g, 0, y + 1, 16, 1, "#3a3c44"); R(g, 0, y + 3, 16, 1, "#1e2026"); for (let x = (y / 4 % 2) * 4; x < 16; x += 8) R(g, x, y, 1, 4, "#1e2026"); }
  return c;
})();
const quayStone = (() => {
  const [c, g] = canvas(32, 16); R(g, 0, 0, 32, 16, "#2a2622");
  for (let y = 0, row = 0; y < 16; y += 4, row++) for (let x = (row % 2) * 4; x < 36; x += 8) { const b = pick(["#5b554c", "#4e4840", "#666055"]); R(g, x % 32, y, 7, 3, b); R(g, x % 32, y, 7, 1, shade(b, 0.06)); }
  R(g, 0, 0, 32, 1, "#8a8276");
  return c;
})();
const woodTex = (base) => sprite(16, 16, (g) => { R(g, 0, 0, 16, 16, base); for (let x = 0; x < 16; x += 4) { R(g, x, 0, 1, 16, shade(base, -0.1)); R(g, x + 1, 0, 1, 16, shade(base, 0.05)); } R(g, 0, 3, 16, 1, "#2a2a28"); R(g, 0, 12, 16, 1, "#2a2a28"); });
const crateTex = sprite(16, 16, (g) => { R(g, 0, 0, 16, 16, "#7a5a36"); R(g, 0, 0, 16, 2, "#5a3e22"); R(g, 0, 14, 16, 2, "#5a3e22"); R(g, 0, 0, 2, 16, "#5a3e22"); R(g, 14, 0, 2, 16, "#5a3e22"); line(g, 2, 2, 13, 13, "#5a3e22"); line(g, 3, 2, 14, 13, "#8a6a42"); });
const bikeTex = sprite(40, 24, (g) => {
  const wheel = (cx) => { for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; P(g, Math.round(cx + Math.cos(t) * 7), Math.round(16 + Math.sin(t) * 7), "#141312"); } P(g, cx, 16, "#8a8a8a"); };
  wheel(8); wheel(31);
  const fr = pick(["#3c5a74", "#6a2a2a", "#2a2a2a", "#4a5a3a"]);
  line(g, 8, 16, 16, 16, fr); line(g, 16, 16, 27, 8, fr); line(g, 14, 7, 27, 8, fr); line(g, 14, 7, 16, 16, fr); line(g, 8, 16, 14, 7, fr); line(g, 27, 8, 31, 16, fr);
  R(g, 11, 5, 6, 2, "#1d1a17"); line(g, 27, 8, 26, 3, "#2a2a2a"); R(g, 24, 3, 5, 1, "#2a2a2a");
  R(g, 29, 4, 7, 4, "#6d4a2a"); R(g, 30, 5, 5, 2, "#8a5e34");
});
// the Amsterdam flag (red, black, red, three white crosses), two frames of a slow wave
function flagTex() {
  const t = sprite(48, 16, (g) => {
    for (let f = 0; f < 2; f++) {
      const o = f * 24;
      for (let x = 0; x < 24; x++) {
        const wave = Math.round(Math.sin((x + f * 3) * 0.45) * 1), dark = Math.sin((x + f * 3) * 0.45) < -0.4;
        const red = dark ? "#9a2420" : "#c8322a", blk = dark ? "#0e0e0e" : "#1c1c1c";
        R(g, o + x, 1 + wave, 1, 5, red); R(g, o + x, 6 + wave, 1, 4, blk); R(g, o + x, 10 + wave, 1, 5, red);
      }
      for (const cx of [6, 12, 18]) { const w = Math.round(Math.sin((cx + f * 3) * 0.45)); P(g, o + cx - 1, 7 + w, "#f0ece0"); P(g, o + cx + 1, 7 + w, "#f0ece0"); P(g, o + cx, 8 + w, "#f0ece0"); P(g, o + cx - 1, 9 + w, "#f0ece0"); P(g, o + cx + 1, 9 + w, "#f0ece0"); }
    }
  });
  t.repeat.set(0.5, 1); return t;
}
// sprites with several frames side by side
function frames(w, h, n, draw) { const t = sprite(w * n, h, (g) => { for (let f = 0; f < n; f++) draw(g, f * w, f); }); t.repeat.set(1 / n, 1); return t; }
const hollyhockTex = sprite(12, 34, (g) => {                 // stokrozen: the tall flowers Amsterdammers grow against their walls
  for (const sx of [3, 7, 9]) { const top = ri(2, 9); R(g, sx, top, 1, 34 - top, "#2f4a26");
    for (let y = top; y < 22; y += 3) { const c = pick(["#d8507a", "#e9879a", "#f1e3c8", "#b8304a"]); R(g, sx - 1, y, 3, 2, c); P(g, sx, y, shade(c, 0.2)); }
    for (let y = 22; y < 34; y += 4) { R(g, sx - 2, y, 2, 2, "#3d5c2f"); R(g, sx + 1, y + 2, 2, 2, "#3d5c2f"); } }
});
const potTex = sprite(10, 10, (g) => { R(g, 2, 6, 6, 4, "#a0522d"); R(g, 1, 6, 8, 1, "#b8653a"); R(g, 3, 9, 4, 1, "#7a3a1e");
  for (let i = 0; i < 18; i++) P(g, ri(1, 8), ri(0, 5), rnd() < 0.4 ? "#c83a3a" : pick(PAL.leaf)); });
const paperTex = sprite(6, 8, (g) => { R(g, 0, 0, 6, 8, "#cfc6b2"); for (let y = 1; y < 7; y += 2) R(g, 1, y, ri(2, 4), 1, "#8a8270"); });
const chalkTex = sprite(12, 16, (g) => { R(g, 0, 0, 12, 16, "#5a3a22"); R(g, 1, 1, 10, 11, "#1e2a24"); line(g, 0, 12, 0, 15, "#5a3a22"); R(g, 0, 15, 2, 1, "#3a2414"); R(g, 10, 15, 2, 1, "#3a2414");
  R(g, 4, 3, 4, 3, "#e8e4d8"); P(g, 8, 4, "#e8e4d8"); for (let y = 7; y < 11; y += 2) R(g, 2, y, ri(5, 8), 1, "#c8c4b8"); });
const posterTex = sprite(64, 32, (g) => {                    // an advertising column wrapped in posters
  R(g, 0, 0, 64, 32, "#26392c");
  for (let x = 1; x < 62;) { const w = ri(9, 14), h = ri(12, 18), y = ri(3, 31 - h), c = pick(["#c8a050", "#a83a2a", "#e0d8c0", "#3a5a8a", "#d87a3a", "#5a8a6a"]);
    R(g, x, y, w, h, c); R(g, x + 1, y + 2, w - 2, 3, shade(c, -0.35)); for (let k = y + 7; k < y + h - 1; k += 2) R(g, x + 1, k, ri(3, w - 2), 1, shade(c, -0.25)); x += w + 1; }
});
const produceTex = (cols) => sprite(16, 16, (g) => { R(g, 0, 0, 16, 16, "#3a2a18"); for (let y = 1; y < 16; y += 3) for (let x = 1 + (y % 2); x < 16; x += 3) { const c = pick(cols); R(g, x, y, 2, 2, c); P(g, x, y, shade(c, 0.25)); } });
const buntingTex = sprite(32, 10, (g) => { R(g, 0, 0, 32, 1, "#1c1a16"); ["#a83a2a", "#c8a050", "#e0d8c0", "#3a6a6a"].forEach((c, k) => { for (let y = 0; y < 8; y++) R(g, k * 8 + Math.ceil(y / 2), 1 + y, 7 - Math.ceil(y / 2) * 2 + 1, 1, c); }); });
buntingTex.wrapS = THREE.RepeatWrapping;
const dogTex = frames(16, 10, 2, (g, o, f) => {                // a brown dog trotting
  const c = "#7a4a2a", d = "#4a2a14";
  R(g, o + 3, 3, 9, 4, c); R(g, o + 11, 1, 4, 4, c); P(g, o + 14, 3, "#141210"); R(g, o + 11, 0, 2, 2, d); P(g, o + 15, 3, d); R(g, o + 1, 2, 2, 2, c);
  const legs = f ? [3, 5, 9, 11] : [4, 4, 10, 10]; legs.forEach((x, k) => R(g, o + x + (k % 2), 7, 1, 3, d));
});
const catTex = frames(10, 8, 2, (g, o, f) => {                 // a black cat on the cornice, flicking its tail
  const c = "#151413"; R(g, o + 3, 3, 5, 5, c); R(g, o + 2, 1, 4, 3, c); P(g, o + 2, 0, c); P(g, o + 5, 0, c); P(g, o + 3, 2, "#c8b040");
  if (f) { R(g, o + 8, 2, 1, 5, c); P(g, o + 9, 1, c); } else { R(g, o + 8, 6, 2, 1, c); P(g, o + 9, 5, c); }
});
const pigeonTex = frames(8, 7, 2, (g, o, f) => {               // a pigeon: standing, then pecking
  const c = "#7a7f8a", d = "#4a4e58"; R(g, o + 1, 3, 5, 3, c); R(g, o + 2, 4, 3, 1, "#9aa0aa"); R(g, o + 2, 6, 1, 1, "#c86a4a"); R(g, o + 4, 6, 1, 1, "#c86a4a");
  if (f) { R(g, o + 5, 4, 2, 2, d); P(g, o + 7, 5, "#2a2a2a"); } else { R(g, o + 5, 1, 2, 3, d); P(g, o + 6, 2, "#3a8a5a"); P(g, o + 7, 2, "#2a2a2a"); }
});
const bushTex = sprite(40, 24, (g) => { for (let i = 0; i < 220; i++) { const x = ri(2, 37), y = ri(4 + Math.abs(x - 20) * 0.3, 23); R(g, x, y, 2, 2, pick(PAL.leaf)); if (rnd() < 0.08) P(g, x, y, pick(PAL.flowers)); } });
const skylineTex = sprite(400, 80, (g, w, h) => {
  let x = 0;
  while (x < w) {
    const bw = ri(8, 16), bh = ri(22, 42);
    R(g, x, h - bh, bw, bh, "#151b2c"); for (let k = 0; k < bw / 2; k++) R(g, x + k, h - bh - k, bw - 2 * k, 1, "#151b2c");
    for (let k = 0; k < 3; k++) if (rnd() < 0.35) P(g, x + ri(2, bw - 3), h - ri(6, bh - 4), pick(PAL.lit));
    x += bw;
  }
  R(g, 236, 6, 4, 40, "#151b2c"); R(g, 232, 30, 12, 20, "#151b2c"); R(g, 237, 0, 2, 8, "#151b2c");
});
const lanternTex = sprite(8, 10, (g) => { R(g, 0, 0, 8, 10, "#16130f"); R(g, 1, 2, 6, 6, "#ffd88f"); R(g, 2, 3, 4, 4, "#fff1c8"); R(g, 3, 2, 2, 6, "#16130f"); });
const awningTex = (a, b) => sprite(32, 16, (g) => { for (let x = 0; x < 32; x++) R(g, x, 0, 1, 14, Math.floor(x / 4) % 2 ? a : b); for (let x = 0; x < 32; x++) { R(g, x, 13, 1, 1, shade(Math.floor(x / 4) % 2 ? a : b, -0.15)); if (x % 4 === 1 || x % 4 === 2) R(g, x, 14, 1, 2, Math.floor(x / 4) % 2 ? a : b); } });
const signTex = (icon) => sprite(16, 12, (g) => {
  R(g, 0, 0, 16, 12, "#2a1c12"); R(g, 1, 1, 14, 10, "#d8c49a"); R(g, 1, 1, 14, 1, "#efe0bc");
  if (icon === "cup") { R(g, 5, 4, 5, 5, "#6a3a1e"); R(g, 10, 5, 2, 2, "#6a3a1e"); R(g, 4, 9, 8, 1, "#6a3a1e"); P(g, 6, 2, "#9a8a7a"); P(g, 8, 3, "#9a8a7a"); }
  else if (icon === "book") { R(g, 3, 4, 10, 6, "#e8dcc0"); R(g, 8, 4, 1, 6, "#6a4a2a"); R(g, 4, 5, 3, 1, "#8a7a6a"); R(g, 4, 7, 3, 1, "#8a7a6a"); R(g, 9, 5, 3, 1, "#8a7a6a"); R(g, 9, 7, 3, 1, "#8a7a6a"); R(g, 3, 9, 10, 1, "#7a2a22"); }
  else if (icon === "wheel") { for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; P(g, Math.round(8 + Math.cos(t) * 4), Math.round(6 + Math.sin(t) * 4), "#1c1c1c"); } line(g, 4, 6, 12, 6, "#5a5a5a"); line(g, 8, 2, 8, 10, "#5a5a5a"); P(g, 8, 6, PAL.gold); }
  else if (icon === "tulip") { R(g, 7, 6, 1, 5, "#3d5c2f"); R(g, 5, 8, 2, 1, "#3d5c2f"); R(g, 5, 2, 5, 4, "#c83a3a"); P(g, 6, 2, "#d8c49a"); P(g, 8, 2, "#d8c49a"); R(g, 6, 3, 3, 1, "#e85a4a"); }
  else { R(g, 4, 5, 8, 4, "#a0682a"); R(g, 5, 4, 6, 1, "#c08a42"); P(g, 6, 6, "#7a4a1a"); P(g, 9, 6, "#7a4a1a"); }
});

/* People v2 (2026-10-27, "the sprites are still not detailed and personable enough"): 20 x 36 px, three frames
   (stand, step, step). Each is a particular person: a hairstyle or hat, a face with eyes and a nose, a coat shaded
   from the upper left with a collar or scarf and buttons, arms that swing, trousers or tights and shoes, and one
   thing that says who they are (flowers from the flower shop, bread, a cane, a broom, a lead, a coffee). */
const FW = 20, FH = 36;
function person(o) {
  const [c, g] = canvas(FW * 3, FH);
  const skin = o.skin || pick(PAL.skin), hair = o.hair || pick(PAL.hair), coat = o.coat || pick(PAL.coat);
  const coatL = shade(coat, 0.12), coatD = shade(coat, -0.2), legs = o.legs || pick(["#2a2a34", "#3a3024", "#1e2430", "#4a4038"]), shoe = o.shoe || "#1a1410";
  const still = o.talk || o.broom || o.sit;
  for (let f = 0; f < 3; f++) {
    const X = f * FW, p = (x, y, col) => P(g, X + x, y, col), r = (x, y, w, h, col) => R(g, X + x, y, w, h, col), ln = (x0, y0, x1, y1, col) => line(g, X + x0, y0, X + x1, y1, col);
    const step = still ? 0 : f === 0 ? 0 : f === 1 ? 1 : -1, dy = o.sit ? 4 : 0, bottom = (o.long ? 27 : 23) + dy;
    // legs and shoes (drawn first: the coat covers their tops)
    if (o.sit) {
      r(8, 26, 8, 3, legs); r(8, 26, 8, 1, shade(legs, 0.12)); r(14, 29, 3, 4, legs); r(14, 33, 4, 2, shoe); p(17, 33, shade(shoe, 0.35));
    } else {
      [[8, -1], [11, 1]].forEach(([hx, side], k) => {
        const fx = hx + side * step * 2, col = k ? legs : shade(legs, -0.15);                // the legs scissor: one forward, one back
        for (let y = 23; y <= 32; y++) { const t = (y - 23) / 9, x = Math.round(hx + (fx - hx) * t); r(x, y, 2, 1, o.tights && y > bottom ? o.tights : col); }
        r(fx, 33, 3, 2, k ? shoe : shade(shoe, -0.2)); p(fx + 2, 33, shade(shoe, 0.35));
      });
    }
    // the back arm, mostly hidden behind the body
    const swing = still ? 0 : step * 2;
    ln(8, 12 + dy, 8 + swing, 20 + dy, coatD); ln(7, 12 + dy, 7 + swing, 20 + dy, coatD); r(7 + swing, 21 + dy, 2, 1, shade(skin, -0.15));
    // body: a coat lit from the upper left
    for (let y = 11 + dy; y <= bottom; y++) {
      const flare = o.long && y > 22 + dy ? Math.min(2, Math.floor((y - 22 - dy) / 2)) : 0;
      for (let x = 6 - flare; x <= 14 + flare; x++) r(x, y, 1, 1, x <= 6 - flare ? coatL : x >= 13 + flare ? coatD : coat);
    }
    r(7, 11 + dy, 7, 1, coatL);
    if (o.long) for (let y = 17 + dy; y <= bottom; y++) p(12, y, coatD);
    if (o.apron) { r(8, 14 + dy, 6, Math.min(13, bottom - 13 - dy), "#ece6da"); r(13, 14 + dy, 1, Math.min(13, bottom - 13 - dy), "#cfc8ba"); r(8, 18 + dy, 6, 1, "#d8d0c2"); }
    else { if (!o.long) { r(6, 20 + dy, 9, 1, coatD); p(11, 20 + dy, PAL.gold); } [14, 17].forEach((y) => p(12, y + dy, o.buttons || shade(coat, -0.35))); }
    for (let k = 0; k < 4; k++) p(ri(8, 11), ri(13, bottom - 1), coatD);                       // creases
    if (o.scarf) { r(8, 10 + dy, 6, 2, o.scarf); r(9, 12 + dy, 2, 5, o.scarf); p(10, 16 + dy, shade(o.scarf, -0.25)); p(8, 10 + dy, shade(o.scarf, 0.2)); }
    else r(9, 11 + dy, 4, 1, shade(coat, 0.28));
    // head: neck, face, ear, eyes, nose, mouth
    r(10, 10 + dy, 2, 1, shade(skin, -0.2));
    r(8, 3 + dy, 6, 7, skin); r(8, 3 + dy, 1, 7, shade(skin, 0.06)); r(13, 8 + dy, 1, 2, shade(skin, -0.12)); p(14, 7 + dy, skin);
    p(9, 6 + dy, shade(skin, -0.22));
    p(11, 6 + dy, "#1a1210"); p(13, 6 + dy, "#1a1210"); p(12, 8 + dy, shade(skin, -0.3));
    if (o.blush) p(13, 7 + dy, "#e0907e");
    if (o.glasses) { r(10, 6 + dy, 5, 1, "#2a2420"); p(11, 6 + dy, "#a8c4d0"); p(13, 6 + dy, "#a8c4d0"); }
    if (o.beard) { r(9, 8 + dy, 5, 2, o.beard); p(12, 8 + dy, shade(o.beard, -0.2)); }
    // hair
    const hs = o.hairStyle || "short", hl = shade(hair, 0.25);
    if (hs !== "bald") { r(8, 2 + dy, 6, 2, hair); r(7, 3 + dy, 2, 4, hair); p(13, 4 + dy, hair); p(12, 4 + dy, hair); p(9, 2 + dy, hl); p(10, 2 + dy, hl); }
    else { r(8, 5 + dy, 1, 3, hair); }
    if (hs === "long") { r(6, 4 + dy, 3, 9, hair); r(7, 13 + dy, 2, 2, hair); p(6, 6 + dy, hl); }
    if (hs === "bun") { r(5, 1 + dy, 3, 3, hair); p(6, 1 + dy, hl); }
    if (hs === "ponytail") { r(5, 4 + dy, 2, 6, hair); p(5, 5 + dy, hl); }
    if (hs === "curly") { for (let k = 0; k < 14; k++) p(ri(6, 13), ri(1, 4) + dy, rnd() < 0.3 ? hl : hair); r(6, 3 + dy, 3, 5, hair); }
    // hats
    if (o.hat === "cap") { r(8, 1 + dy, 6, 3, o.hatCol); r(13, 3 + dy, 3, 1, shade(o.hatCol, -0.2)); r(9, 1 + dy, 3, 1, shade(o.hatCol, 0.15)); }
    if (o.hat === "bowler") { r(9, 0 + dy, 5, 3, o.hatCol); r(7, 3 + dy, 9, 1, o.hatCol); p(10, 0 + dy, shade(o.hatCol, 0.25)); }
    if (o.hat === "beanie") { r(8, 1 + dy, 6, 3, o.hatCol); r(8, 3 + dy, 6, 1, shade(o.hatCol, 0.2)); p(10, 0 + dy, o.hatCol); p(11, 0 + dy, shade(o.hatCol, 0.2)); }
    if (o.hat === "baker") { r(8, 0 + dy, 6, 3, "#f2eee6"); r(8, 3 + dy, 6, 1, "#d8d0c4"); p(9, 0 + dy, "#ffffff"); }
    if (o.hat === "scarf") { r(7, 2 + dy, 7, 3, o.hatCol); r(7, 4 + dy, 2, 6, o.hatCol); p(8, 2 + dy, shade(o.hatCol, 0.2)); p(9, 9 + dy, shade(o.hatCol, -0.2)); }
    // the front arm, and what the hand holds
    let hx = 12 - swing, hy = 20 + dy;
    if (o.talk && f === 1) { ln(12, 12, 15, 9, coat); ln(13, 12, 15, 10, coat); hx = 15; hy = 8; }
    else if (o.cup) { ln(12, 12 + dy, 14, 15 + dy, coat); ln(13, 12 + dy, 14, 14 + dy, coat); hx = 14; hy = 11 + dy; }
    else { ln(12, 12 + dy, hx, hy - 1, coat); ln(13, 12 + dy, hx + 1, hy - 1, coatD); }
    r(hx, hy, 2, 2, skin);
    if (o.cup) { r(hx + 1, hy - 2, 2, 3, "#ece6da"); p(hx + 1, hy - 2, "#5a3a1e"); }
    if (o.bag) { ln(9, 11 + dy, 14, 18 + dy, "#3a2414"); r(13, 18 + dy, 4, 4, o.bag); r(13, 18 + dy, 4, 1, shade(o.bag, -0.2)); p(15, 20 + dy, PAL.gold); }
    if (o.bouquet) { r(hx + 1, hy - 4, 1, 4, "#3d5c2f"); r(hx, hy - 2, 3, 3, "#e8e0c8"); for (let k = 0; k < 12; k++) p(hx + ri(-1, 3), hy - ri(5, 8), rnd() < 0.7 ? pick(PAL.flowers) : pick(PAL.leaf)); }
    if (o.bread) { r(hx - 1, hy + 1, 5, 3, "#8a5a2a"); r(hx - 1, hy + 1, 5, 1, "#a8743a"); r(hx, hy - 2, 1, 3, "#d09a52"); r(hx + 2, hy - 3, 1, 4, "#c08a42"); ln(hx - 1, hy + 1, hx + 1, hy - 1, "#6a4a2a"); }
    if (o.cane) { ln(hx + 1, hy + 1, hx + 3, 34, "#4a2a14"); p(hx + 1, hy - 1, "#4a2a14"); }
    if (o.lead) ln(hx + 2, hy + 1, 19, 27, "#8a2a22");
    if (o.broom) { const ex = [9, 7, 12][f]; ln(hx, hy, ex, 31, "#7a5a32"); r(ex - 2, 31, 5, 3, "#b0904a"); p(ex - 2, 33, "#8a6a32"); }
  }
  g._c = null; outlinePass(g, FW * 3, FH); g._c = null;
  const t = tex(c); t.repeat.set(1 / 3, 1);
  return t;
}

/* The street as one hand-painted surface (no repeating tile): flagstone pavement along the houses,
   a gutter with drains, shaded cobbles with a worn path, sunken stones and moss, kerbstones with
   mooring rings at the water, puddles, manholes, and autumn leaves under the trees.
   Returns the colour canvas and a roughness canvas (dark = wet). Canvas y = 0 is the house side. */
function streetSurface(lenM, depthM, o) {
  const W = Math.round(lenM * PX), H = Math.round(depthM * PX);
  const [c, g] = canvas(W, H), [rc, rg] = canvas(W, H);
  R(g, 0, 0, W, H, "#171411"); R(rg, 0, 0, W, H, "#d6d6d6");
  const toX = (x) => Math.round((x + lenM / 2) * PX);
  let y0 = 0;
  if (o.pavement) {                                        // flagstones
    const ph = Math.round(1.6 * PX);
    for (let y = 0; y < ph; y += 11) for (let x = -ri(0, 9); x < W; x += ri(10, 14)) {
      const b = pick(["#6e675c", "#655e54", "#77705f", "#5e584f"]), w = ri(9, 13), h = Math.min(10, ph - y - 1);
      R(g, x, y, w, h, b); R(g, x, y, w, 1, shade(b, 0.07)); R(g, x, y, 1, h, shade(b, 0.04)); R(g, x, y + h - 1, w, 1, shade(b, -0.09));
      if (rnd() < 0.15) line(g, x + ri(1, w - 2), y + 1, x + ri(1, w - 2), y + h - 2, shade(b, -0.14));      // a crack
    }
    R(g, 0, ph, W, 2, "#8f877a"); R(g, 0, ph, W, 1, "#a49c8c"); R(g, 0, ph + 2, W, 2, "#0f0d0b");                // kerb and gutter
    for (let x = ri(20, 80); x < W; x += ri(110, 160)) { R(g, x, ph + 1, 9, 4, "#141210"); for (let k = 1; k < 9; k += 2) R(g, x + k, ph + 1, 1, 4, "#2e2a26"); }
    y0 = ph + 4;
  }
  const edge = Math.round(1.1 * PX), yEnd = H - (o.kerbAtEnd ? edge : 0), mid = (y0 + yEnd) / 2;
  for (let y = y0, row = 0; y < yEnd; y += 5, row++) for (let x = (row % 2) * 3 - 3; x < W; x += 6) { rnd(); rnd(); rnd(); if (rnd() < 0.06) { rnd(); rnd(); } }   // the old cobbles' draws
  // cobbles: chunky rounded setts, 8 x 7 px, each with a lit top and a shadowed bottom and right (2026-10-28; were 6 x 5)
  const COB = ["#5d564c", "#4f4840", "#6a6256", "#575047", "#625a4f", "#544c43"];
  for (let y = y0, row = 0; y < yEnd; y += 7, row++) for (let x = (row % 2) * 4 - 4; x < W; x += 8) {
    const worn = Math.exp(-Math.pow((y - mid) / ((yEnd - y0) * 0.22), 2)) * 0.5;
    let b = COB[Math.floor(rndB() * COB.length)];
    if (rndB() < worn) b = shade(b, 0.06);
    if (rndB() < 0.04) b = shade(b, -0.1);                                                                       // a sunken stone
    for (let i = 0; i < 7; i++) for (let j = 0; j < 6; j++) {
      if ((i === 0 || i === 6) && (j === 0 || j === 5)) continue;
      const col = j === 0 ? shade(b, 0.1) : j === 1 || i === 0 ? shade(b, 0.05) : j === 5 ? shade(b, -0.12) : i === 6 ? shade(b, -0.07) : b;
      P(g, x + i, y + j, col);
    }
    if (rndB() < 0.06) P(g, x + 7, y + Math.floor(rndB() * 6), rndB() < 0.5 ? "#2c4422" : "#3d5a2c");             // moss in the joints
  }
  if (o.kerbAtEnd) {                                       // kerbstones at the water, iron mooring rings
    for (let x = 0; x < W; x += 20) { const b = pick(["#8a8276", "#7e776b", "#948c80"]); R(g, x, yEnd, 19, edge, b); R(g, x, yEnd, 19, 1, shade(b, 0.08)); R(g, x + 18, yEnd, 1, edge, shade(b, -0.12)); }
    for (let x = ri(40, 90); x < W; x += ri(140, 220)) { for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; P(g, Math.round(x + Math.cos(t) * 3), Math.round(yEnd + 8 + Math.sin(t) * 2), "#1a1816"); } }
  }
  for (let i = 0; i < o.puddles; i++) {                    // puddles: darker, bluish, with a bright rim on the far side
    const px = ri(30, W - 60), py = ri(y0 + 4, yEnd - 10), pw = ri(14, 34), ph = ri(4, 8);
    for (let yy = 0; yy < ph; yy++) for (let xx = 0; xx < pw; xx++) {
      if (((xx - pw / 2) / (pw / 2)) ** 2 + ((yy - ph / 2) / (ph / 2)) ** 2 > 1) continue;
      P(g, px + xx, py + yy, yy === 0 ? "#5d6a80" : rnd() < 0.5 ? "#1e2430" : "#252c3a"); P(rg, px + xx, py + yy, "#202020");
    }
  }
  (o.manholes || []).forEach((x) => { const cx = toX(x), cy = Math.round((y0 + yEnd) / 2); for (let yy = -5; yy <= 5; yy++) for (let xx = -5; xx <= 5; xx++) { const d = Math.hypot(xx, yy); if (d <= 5.2) P(g, cx + xx, cy + yy, d > 4.2 ? "#2a2826" : (xx + yy) % 2 ? "#3c3a36" : "#33312d"); } });
  (o.leavesAt || []).forEach((x) => {                      // fallen leaves under a tree
    const cx = toX(x), cy = Math.round((o.leafRow || 7.8) * PX);
    for (let k = 0; k < 140; k++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 40; P(g, Math.round(cx + Math.cos(a) * d * 1.3), Math.round(cy + Math.sin(a) * d * 0.5), pick(["#b8862a", "#a06420", "#c9a040", "#7a4a1a", "#8a7a2a"])); }
  });
  return { c, rc };
}
function streetMat(lenM, depthM, o) {
  const s = streetSurface(lenM, depthM, o);
  return std({ map: tex(s.c), roughnessMap: tex(s.rc, null, true), roughness: 1, metalness: 0.12 });
}
const TW = 120, TH = 176;                                  // 7.5 x 11 m
const LEAVES = {
  green: ["#93ad5c", "#6f8f45", "#4a6b33", "#30482a", "#1a2716"],
  yellow: ["#d2c25e", "#a8a040", "#7e7c30", "#4e5226", "#252912"],
  ochre: ["#e0ac58", "#c08a3a", "#93652a", "#5a4020", "#2a1e10"]
};
const BARK = ["#6e5a43", "#4c3d2e", "#35291f", "#221a13", "#110d0a"];
function outlinePass(g, w, h) {                            // dark edge outside the shape, from its own colours
  const img = g.getImageData(0, 0, w, h), d = img.data, at = (x, y) => (y * w + x) * 4;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[at(x, y) + 3] > 0;
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (solid(x, y)) continue;
    const n = [[x, y + 1], [x - 1, y], [x + 1, y], [x, y - 1]].find(([u, v]) => solid(u, v));
    if (n) { const i = at(n[0], n[1]); out.push([x, y, `rgb(${d[i] * 0.3 | 0},${d[i + 1] * 0.3 | 0},${d[i + 2] * 0.3 | 0})`]); }
  }
  out.forEach(([x, y, col]) => P(g, x, y, col));
}
function treeSprites(mix) {
  const [fc, fg] = canvas(TW, TH), [bc, bg] = canvas(TW, TH);
  const lean = ri(-7, 7), fork = ri(62, 72), baseX = TW / 2;
  const ccx = baseX + lean, ccy = TH - fork - 32, rx = 50 + ri(-4, 4), ry = 37 + ri(-3, 3);
  const woodCol = (t) => (t < -0.45 ? BARK[0] : t < 0.1 ? BARK[1] : t < 0.6 ? BARK[2] : BARK[3]);
  // trunk: scanlines with a gentle S-bend, a root flare, vertical furrows
  const trunkX = (u) => baseX + lean * u * u + Math.sin(u * 3.2) * 1.4;
  const furrow = [];
  for (let k = 0; k < 4; k++) furrow.push(rnd());
  for (let row = 0; row <= fork; row++) {
    const u = row / fork, y = TH - 1 - row, cx = trunkX(u);
    let hw = 5.2 - 2.0 * u;
    if (row < 6) hw += (6 - row) * 0.8;
    const x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
    for (let x = x0; x <= x1; x++) {
      const t = (x - cx) / hw;
      let col = woodCol(t);
      const f = (t + 1) / 2;
      if (furrow.some((q) => Math.abs(f - q - Math.sin(row * 0.25 + q * 9) * 0.04) < 0.05)) col = BARK[3];
      if (rnd() < 0.03) col = "#4e5a32";                   // moss
      P(fg, x, y, x === x0 || x === x1 ? BARK[4] : col);
    }
  }
  for (const side of [-1, 1]) {                            // two surface roots
    const len = ri(3, 5), cx = trunkX(0);
    for (let k = 0; k < len; k++) P(fg, Math.round(cx + side * (6 + k)), TH - 1 - (k < 2 ? 1 : 0), k === len - 1 ? BARK[3] : BARK[1]);
  }
  // limbs: stamped discs along curves, thinning toward the crown, then branches off them
  const stroke = (g, p0, p1, p2, r0, r1) => {
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const t = i / n, mt = 1 - t;
      const x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0], y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1];
      const r = r0 + (r1 - r0) * t, R2 = Math.ceil(r);
      for (let dy = -R2; dy <= R2; dy++) for (let dx = -R2; dx <= R2; dx++) if (dx * dx + dy * dy <= r * r + 0.3) P(g, Math.round(x + dx), Math.round(y + dy), woodCol(dx / Math.max(r, 1)));
    }
  };
  const F = [trunkX(1), TH - 1 - fork];
  const ends = [[-34, -10], [-14, -26], [10, -24], [32, -12]].map(([dx, dy]) => [ccx + dx + ri(-4, 4), ccy + dy + ri(-4, 4)]);
  ends.forEach((e) => {
    const c = [F[0] + (e[0] - F[0]) * 0.25, F[1] - 12];
    stroke(fg, F, c, e, 3.0, 1.0);
    for (let k = 0; k < 2; k++) {                          // branches toward the outside of the crown
      const t = 0.5 + k * 0.25, mt = 1 - t;
      const o = [mt * mt * F[0] + 2 * mt * t * c[0] + t * t * e[0], mt * mt * F[1] + 2 * mt * t * c[1] + t * t * e[1]];
      const out = Math.sign(e[0] - ccx) || 1, tip = [o[0] + out * ri(8, 16), o[1] - ri(6, 14)];
      stroke(fg, o, [(o[0] + tip[0]) / 2, (o[1] + tip[1]) / 2 - 2], tip, 1.3, 0.5);
    }
  });
  // leaf clumps: a dark mass covered in small leaf clusters, each lit on its upper left; the clusters
  // are shaded by the clump's own light and by the crown's (dark underneath), and poke out at the edge
  const level = (v) => (v > 0.62 ? 0 : v > 0.22 ? 1 : v > -0.18 ? 2 : v > -0.6 ? 3 : 4);
  const clump = (g, x0, y0, r, pal, dark) => {
    const er = []; for (let k = 0; k < 17; k++) er.push(r * (0.78 + rnd() * 0.34));
    er[16] = er[0];
    const edgeAt = (dx, dy) => { const a = ((Math.atan2(dy, dx) / (Math.PI * 2)) + 1) % 1 * 16, i = Math.floor(a); return er[i] + (er[i + 1] - er[i]) * (a - i); };
    const light = (dx, dy) => { const px = x0 + dx, py = y0 + dy; return (-dx * 0.55 - dy * 0.85) / r * 0.5 + (-(px - ccx) * 0.3 - (py - ccy) * 0.95) / ry * 0.75 - dark; };
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.hypot(dx, dy) > edgeAt(dx, dy) - 1) continue;
      P(g, Math.round(x0 + dx), Math.round(y0 + dy), pal[Math.min(4, level(light(dx, dy)) + 1)]);
    }
    const leaves = [];
    for (let i = 0, n = Math.round(r * r * 0.75); i < n; i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r; leaves.push([Math.cos(a) * d, Math.sin(a) * d]); }
    leaves.sort((p, q) => p[1] - q[1]).forEach(([lx, ly]) => {
      const k = level(light(lx, ly) + (rnd() - 0.5) * 0.32), sz = rnd() < 0.55 ? 1 : 2;
      for (let by = -sz; by <= sz; by++) for (let bx = -sz; bx <= sz; bx++) {
        if (Math.abs(bx) + Math.abs(by) > sz) continue;
        const ex = lx + bx, ey = ly + by;
        if (Math.hypot(ex, ey) > edgeAt(ex, ey) + 1.2) continue;
        const kk = bx + by < 0 ? Math.max(0, k - 1) : bx + by > 0 ? Math.min(4, k + 1) : k;
        P(g, Math.round(x0 + ex), Math.round(y0 + ey), pal[kk]);
      }
    });
  };
  const inCrown = (sx) => { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * sx; return [ccx + Math.cos(a) * d * rx, ccy + Math.sin(a) * d * ry]; };
  const back = [];
  for (let i = 0; i < 26; i++) back.push([...inCrown(0.85), ri(12, 17)]);
  back.sort((p, q) => q[1] - p[1]).forEach(([x, y, r]) => clump(bg, x, y, r, pick(mix), 0.45));
  const front = [];
  while (front.length < 19) {
    const [x, y] = inCrown(0.92);
    if (y - ccy > -ry * 0.05 && Math.abs(x - ccx) < rx * 0.42 && rnd() < 0.8) continue;   // leave the middle open: limbs show
    front.push([x, y, ri(9, 15)]);
  }
  for (const side of [-1, 1]) if (rnd() < 0.8) front.push([ccx + side * rx * (0.7 + rnd() * 0.15), ccy + ry * (0.3 + rnd() * 0.25), ri(9, 12)]);   // hanging sides
  front.sort((p, q) => q[1] - p[1]).forEach(([x, y, r]) => clump(fg, x, y, r, pick(mix), 0));
  outlinePass(fg, TW, TH); outlinePass(bg, TW, TH);
  return { front: tex(fc), back: tex(bc) };
}

// ================================================================== renderer, scene, camera
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;                       // shadow maps are redrawn only when a light moves (speed)
const canvasEl = renderer.domElement;
// LibreWolf (Firefox "resist fingerprinting") reports the minimum WebGL limits: 8 textures and 8 varyings per shader.
// The facades with six shadowed lights need more, and their shaders fail to compile (only the sky and back rows drew,
// 2026-10-28). With limits that small the lamps still light the street, but only the moon casts shadows.
const SMALL_GPU = (() => { const gl = renderer.getContext(); return gl.getParameter(gl.MAX_VARYING_VECTORS) < 15 || gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) < 16; })();
canvasEl.className = "street3d";

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x121726, 0.009);             // haze over everything, as in mockup H (density follows the camera distance)
const camera = new THREE.PerspectiveCamera(20, 1, 1, 900);

/* ================================================================== lights tied to applications
   Every light (lamp, window, shop, door fanlight, lantern, bridge bulbs) has an id. Its brightness lives in one
   small texture that every lit material reads in the vertex shader, so switching a light costs one byte, and the
   whole street stays merged into a few meshes. Nothing here lights anything on its own: setLit(n) decides. */
const LIGHTS = [null];                                       // index = light id ("lid"); 0 = not a light
function newLid(kind) { LIGHTS.push({ kind }); return LIGHTS.length - 1; }
const LIT_W = 1024, LIT_N = LIT_W * 2;
const litBytes = new Uint8Array(LIT_N * 4);
const litTex = new THREE.DataTexture(litBytes, LIT_W, 2);
litTex.needsUpdate = true;
const lvl = new Float32Array(LIT_N), goal = new Float32Array(LIT_N);   // shown brightness and where it's heading
function lidMat(mat, litMap, mode) {   // "dim": the colour follows the light (additive spill); otherwise the glow does, and the lit image replaces the dark one
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.litState = { value: litTex };
    if (litMap) sh.uniforms.litMap = { value: litMap };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float lid; uniform sampler2D litState; varying float vLit;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
  { int li = int(lid + 0.5); vLit = li < 1 ? 0.0 : texelFetch(litState, ivec2(li % ${LIT_W}, li / ${LIT_W}), 0).r; }`);
    let f = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vLit;" + (litMap ? "\nuniform sampler2D litMap;" : ""));
    if (litMap) f = f.replace("#include <map_fragment>", "#include <map_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(litMap, vMapUv).rgb, vLit);");
    if (mode === "dim") f = f.replace("#include <map_fragment>", "#include <map_fragment>\n  diffuseColor.rgb *= vLit;");
    else f = f.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vLit;");
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => "lid" + (litMap ? "M" : "") + (mode || "");
  mat.userData.lid = true;
  return mat;
}
const lidAttr = (geo, lid) => { geo.setAttribute("lid", new THREE.Float32BufferAttribute(new Array(geo.attributes.position.count).fill(lid), 1)); return geo; };

/* Materials. Every distinct material feature set is a GPU program, and on his PC each one took ~0.25 s to compile,
   so almost everything is one of two Lambert programs: opaque (map + glow map) or cut-out (alpha-tested, both sides). */
const px1 = (v) => { const t = new THREE.DataTexture(new Uint8Array([v, v, v, 255]), 1, 1); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
const WHITE_TEX = px1(255), BLACK_TEX = px1(0);
const std = (o) => {
  if (o.roughnessMap) return new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9 }, o));
  const cut = o.alphaTest > 0 || o.side === THREE.DoubleSide;
  return new THREE.MeshLambertMaterial({
    map: o.map || WHITE_TEX, color: o.color !== undefined ? o.color : 0xffffff,
    emissiveMap: o.emissiveMap || (o.emissive !== undefined ? WHITE_TEX : BLACK_TEX), emissive: o.emissive !== undefined ? o.emissive : 0x000000,
    emissiveIntensity: o.emissiveIntensity !== undefined ? o.emissiveIntensity : 1,
    alphaTest: cut ? 0.5 : 0, side: cut ? THREE.DoubleSide : THREE.FrontSide
  });
};
let target = scene;                                          // where add() puts things: the block being built
function add(geo, mat, x, y, z, opts) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  m.castShadow = !(opts && opts.noCast); m.receiveShadow = true;
  target.add(m); return m;
}
const billboards = [], critters = [], dynamic = [];          // dynamic: animated meshes the merge must leave alone
const BLOCKS = [], WINS = [], LAMPS = [], BULBS = [];
let curBlock = null;

/* Each house has its own character (2026-10-27, he asked for more detail, originality and personality):
   five shops with Dutch names, gable stones (gevelstenen) above doors, door styles, wall lanterns,
   French balconies, pilasters, hollyhocks against the walls, a flag. */
const HOUSES = [
  { w: 6.0, eave: 11.4, gable: "step", wall: "red", floors: 3, cols: 2, door: "blue", litShare: 0.2, frame: "#e6dcc6", plaque: "ship", doorStyle: "double", hollyhock: true },
  { w: 5.4, eave: 12.4, gable: "bell", wall: "ochre", floors: 3, cols: 2, door: "green", litShare: 0.25, arch: true, ivy: "left", frame: "#2d4b3a", doorStyle: "carved", lantern: true },
  { w: 5.6, eave: 11.0, gable: "neck", wall: "slate", floors: 3, cols: 2, door: "red", litShare: 0.3, frame: "#e6dcc6", stoneBase: true, pilasters: true,
    shop: { frame: "#2a3a4a", name: "BLOEMEN", ink: "#e8dcc0", display: "flowers" }, awning: ["#3a5a7a", "#e0d8c8"], sign: "tulip" },
  { w: 6.4, eave: 11.6, gable: "step", wall: "red", floors: 3, cols: 3, door: "green", shutters: true, litShare: 0.25, frame: "#e6dcc6",
    shop: { frame: "#2d4b3a", goods: ["#c08a42", "#a0682a", "#e0b070", "#7a4a1a"], name: "BAKKERIJ" }, awning: ["#2d5a3a", "#d8ccb0"], sign: "bread" },
  { w: 5.8, eave: 12.2, gable: "bell", wall: "cream", floors: 3, cols: 2, door: "blue", flowers: true, litShare: 0.35, arch: true, fanLit: true, frame: "#5a1e18", plaque: "fish", doorStyle: "glass", lantern: true, flag: true, pilasters: true },
  { w: 7.0, eave: 10.8, gable: "cornice", wall: "dark", floors: 3, cols: 3, door: "green", litShare: 0.3, frame: "#e6dcc6",
    shop: { frame: "#5a1e18", name: "KOFFIE", display: "cafe" }, awning: ["#8a2a22", "#e2d6bc"], sign: "cup", cafe: true },
  { w: 5.4, eave: 12.8, gable: "bell", wall: "brown", floors: 4, cols: 2, door: "red", flowers: true, litShare: 0.3, groundLit: true, frame: "#e6dcc6", stoneBase: true, plaque: "bird", doorStyle: "carved", lantern: true, balcony: 2, pots: true },
  { w: 6.2, eave: 11.2, gable: "step", wall: "salmon", floors: 3, cols: 2, door: "blue", shutters: true, litShare: 0.2, ivy: "right", frame: "#e6dcc6", pilasters: true,
    shop: { frame: "#1c1c1c", name: "FIETSEN", ink: "#e0b040", display: "bikes" }, awning: ["#2a2a2a", "#c8a040"], sign: "wheel" },
  { w: 5.6, eave: 11.8, gable: "neck", wall: "red", floors: 3, cols: 2, door: "green", litShare: 0.3, fanLit: true, frame: "#1c1c1c", plaque: "key", doorStyle: "double", lantern: true, hollyhock: true },
  { w: 6.6, eave: 10.9, gable: "cornice", wall: "cream", floors: 3, cols: 3, door: "red", litShare: 0.25, frame: "#2d4b3a", stoneBase: true, pilasters: true, balcony: 1,
    shop: { frame: "#5a1e18", name: "BOEKEN", ink: "#e8dcc0", display: "books" }, awning: ["#5a1e18", "#d8c8a8"], sign: "book" },
  { w: 5.8, eave: 12.0, gable: "step", wall: "ochre", floors: 3, cols: 2, door: "green", litShare: 0.2, shutters: true, frame: "#e6dcc6", plaque: "sun", doorStyle: "glass", hollyhock: true }
];
const DEPTH = 10;

/* Facades with real depth (HD-2D: pixel art on actual geometry, so light falls into recesses and
   protruding parts cast shadows). The painted facade becomes a 30 cm slab that follows the gable
   outline pixel by pixel (step gables get real treads) with every window, door and shop window cut
   through it; the window art sits at the back of each recess, the reveals show brick or plaster.
   Sills, cornice bands, deep cornices, door steps and flower boxes are boxes that stick out. */
const FDEPTH = 0.3;
const balconyTex = sprite(32, 12, (g) => {                 // cast-iron balcony railing: rails, balusters, small scrolls
  const I = "#17140f", Hi = "#3a352c";
  R(g, 0, 0, 32, 2, I); R(g, 0, 0, 32, 1, Hi); R(g, 0, 10, 32, 2, I);
  for (let x = 1; x < 32; x += 3) R(g, x, 2, 1, 8, I);
  for (let x = 3; x < 32; x += 8) { P(g, x, 4, Hi); P(g, x + 1, 5, I); P(g, x - 1, 5, I); P(g, x, 6, I); }
});
balconyTex.wrapS = THREE.RepeatWrapping;
const trimTex = (() => { const [c, g] = canvas(4, 8); ["#c2baa8", "#a8a090", "#a8a090", "#9a9284", "#a39b8c", "#857d70", "#6e675c", "#4a453e"].forEach((col, y) => R(g, 0, y, 4, 1, col)); return tex(c); })();
const trimMat = std({ map: trimTex, roughness: 0.85 });
// what collects on top of ledges: grime, a few weeds and moss (Octopath gives up-facing surfaces their own texture)
const topTex = (() => { const [c, g] = canvas(16, 16); R(g, 0, 0, 16, 16, "#9c9484");
  for (let i = 0; i < 70; i++) P(g, ri(0, 15), ri(0, 15), pick(["#7d766a", "#6a6458", "#b0a898", "#5a6a3a", "#4a5a32", "#6e7a44"]));
  R(g, 0, 15, 16, 1, "#5e584e"); return tex(c); })();
topTex.wrapS = topTex.wrapT = THREE.RepeatWrapping;
const trimMats = [trimMat, trimMat, std({ map: topTex, roughness: 0.95 }), trimMat, trimMat, trimMat];
function trimBox(w, h, d) {                                // a box whose top face gets the grime texture at 16 px per metre
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
  for (let i = 8; i < 12; i++) uv.setXY(i, uv.getX(i) * Math.max(1, w), uv.getY(i) * Math.max(1, d));   // top face: repeat by size
  return [geo, trimMats];
}
const woodBox = std({ map: woodTex("#5a3a24") });
const REVEALS = new Map();
function revealMat(wall) { if (!REVEALS.has(wall)) REVEALS.set(wall, revealMat0(wall)); return REVEALS.get(wall); }
function revealMat0(wall) {
  if (wall.kind === "brick") { const [c, g] = canvas(32, 32); bricks(g, 0, 0, 32, 32, wall.pal, wall.mortar); return std({ map: tex(c, [1 / 32, 1 / 32]), roughness: 0.95 }); }
  const base = wall.base, [c, g] = canvas(16, 16); R(g, 0, 0, 16, 16, shade(base, -0.06));
  for (let i = 0; i < 60; i++) P(g, ri(0, 15), ri(0, 15), rnd() < 0.5 ? shade(base, -0.12) : shade(base, 0.02));
  return std({ map: tex(c, [1 / 16, 1 / 16]), roughness: 0.95 });
}
function buildFacade(f, s, x0, zOff, capMat) {
  const W = f.W, H = f.H, pts = [[0, 0], [W, 0]];
  if (f.mask) {
    pts.push([W, f.Eh]);
    for (let row = f.Gh - 1; row >= 0; row--) { const xr = W / 2 + f.mask[row]; pts.push([xr, H - row - 1], [xr, H - row]); }
    for (let row = 0; row < f.Gh; row++) { const xl = W / 2 - f.mask[row]; pts.push([xl, H - row], [xl, H - row - 1]); }
    pts.push([0, f.Eh]);
  } else pts.push([W, H], [0, H]);
  const clean = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
  const shape = new THREE.Shape(); shape.moveTo(clean[0][0], clean[0][1]); clean.slice(1).forEach((p) => shape.lineTo(p[0], p[1]));
  f.holes.forEach((h) => {
    const a = h.x, b = H - h.y - h.h, c2 = h.x + h.w, d = H - h.y;
    const path = new THREE.Path(); path.moveTo(a, b); path.lineTo(a, d); path.lineTo(c2, d); path.lineTo(c2, b); path.lineTo(a, b);
    shape.holes.push(path);
  });
  const geo = new THREE.ExtrudeGeometry(shape, { depth: FDEPTH * PX, bevelEnabled: false });
  const uv = geo.attributes.uv, pos = geo.attributes.position, g0 = geo.groups[0];
  for (let i = g0.start; i < g0.start + g0.count; i++) uv.setXY(i, pos.getX(i) / W, pos.getY(i) / H);   // the painted facade on the front
  const slab = new THREE.Mesh(geo, [capMat, revealMat(WALLS[s.wall])]);
  slab.scale.setScalar(1 / PX); slab.position.set(x0, 0, zOff - FDEPTH); slab.castShadow = slab.receiveShadow = true; target.add(slab);
  // the window and door art at the back of each opening
  f.holes.forEach((h) => {
    const g = new THREE.PlaneGeometry(h.w / PX, h.h / PX), u = g.attributes.uv;
    const u0 = h.x / W, u1 = (h.x + h.w) / W, v0 = 1 - (h.y + h.h) / H, v1 = 1 - h.y / H;
    for (let i = 0; i < u.count; i++) u.setXY(i, u0 + u.getX(i) * (u1 - u0), v0 + u.getY(i) * (v1 - v0));
    const back = new THREE.Mesh(h.lid ? lidAttr(g, h.lid) : g, capMat); back.receiveShadow = true;
    back.position.set(x0 + (h.x + h.w / 2) / PX, (H - h.y - h.h / 2) / PX, zOff - FDEPTH + 0.015); target.add(back);
    if (h.lid) {                                           // remember where each light is (to fly to it, and to name it under the pointer)
      const bx = back.position.x, by = back.position.y, hw = h.w / PX / 2, hh = h.h / PX / 2;
      Object.assign(LIGHTS[h.lid], { block: curBlock, x: bx, y: by, z: back.position.z });
      WINS.push({ lid: h.lid, block: curBlock, x0: bx - hw, x1: bx + hw, y0: by - hh, y1: by + hh, z: zOff });
    }
    if (h.kind === "win" && h.balcony) {                  // a French balcony: a slab and an iron railing in front of the window
      const sy = (H - h.y - h.h) / PX, cx = x0 + (h.x + h.w / 2) / PX;
      add(...trimBox((h.w + 12) / PX, 0.1, 0.5), cx, sy - 0.05, zOff + 0.25);
      const r = add(new THREE.PlaneGeometry((h.w + 10) / PX, 0.72), std({ map: balconyTex, alphaTest: 0.5, side: THREE.DoubleSide }), cx, sy + 0.36, zOff + 0.48); r.castShadow = true;
      const pot = add(new THREE.PlaneGeometry(0.7, 0.45), std({ map: bushTex, alphaTest: 0.5, side: THREE.DoubleSide }), cx - (h.w / PX) * 0.3, sy + 0.22, zOff + 0.36); pot.castShadow = true;
    }
    if (h.kind === "win") {
      const sy = (H - h.y - h.h) / PX;
      add(...trimBox((h.w + 5) / PX, 0.07, 0.2), x0 + (h.x + h.w / 2) / PX, sy - 0.035, zOff + 0.08);          // sill
      if (h.flowers) {
        add(new THREE.BoxGeometry((h.w + 2) / PX, 0.22, 0.26), woodBox, x0 + (h.x + h.w / 2) / PX, sy - 0.19, zOff + 0.15);
        const fl = add(new THREE.PlaneGeometry((h.w + 4) / PX, 0.34), std({ map: bushTex, alphaTest: 0.5, side: THREE.DoubleSide }), x0 + (h.x + h.w / 2) / PX, sy + 0.07, zOff + 0.2);
        fl.castShadow = true;
      }
      add(...trimBox((h.w + 2) / PX, 0.06, 0.08), x0 + (h.x + h.w / 2) / PX, (H - h.y) / PX + 0.03, zOff + 0.04);   // lintel
    } else if (h.kind === "door") {
      const cx = x0 + (h.x + h.w / 2) / PX;
      if (s.stoop) {                                       // a raised entrance with steps up from both sides (the Golden Bend's stoep)
        const top = (H - h.y - h.h) / PX, pw = (h.w + 20) / PX;
        add(...trimBox(pw, top, 1.3), cx, top / 2, zOff + 0.65);
        for (const sd of [-1, 1]) for (let k = 0; k < 5; k++) { const hh = top * (k + 1) / 6; add(...trimBox(0.42, hh, 0.9), cx + sd * (pw / 2 + 0.21 + (4 - k) * 0.42), hh / 2, zOff + 0.85); }
        for (const sd of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.9, 1.3), ironMat, cx + sd * pw / 2, top + 0.45, zOff + 0.65);
      } else add(...trimBox((h.w + 12) / PX, 0.15, 0.6), cx, 0.075, zOff + 0.3);                                     // stoop step
      if (!s.stoop) for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.85, 0.05), ironMat, cx + sx * ((h.w + 10) / PX / 2), 0.57, zOff + 0.55);
    }
  });
  if (s.obelisks && f.mask) for (let y = 1; y < f.Gh; y++) if (f.mask[y] !== f.mask[y - 1]) for (const sd of [-1, 1]) {   // stone obelisks on the gable's steps
    const ob = add(new THREE.ConeGeometry(0.16, 0.7, 4), trimMat, x0 + (W / 2 + sd * (f.mask[y] - 1.5)) / PX, (H - y) / PX + 0.35, zOff - FDEPTH / 2); ob.rotation.y = Math.PI / 4;
  }
  f.bands.forEach((yb) => add(...trimBox(W / PX + 0.04, 0.11, 0.12), x0 + W / PX / 2, (yb + 1) / PX, zOff + 0.06));
  if (!f.mask) {                                                                     // a deep cornice with a shadowed underside
    add(...trimBox(W / PX + 0.3, 0.32, 0.55), x0 + W / PX / 2, H / PX - 0.2, zOff + 0.22);
    add(...trimBox(W / PX + 0.1, 0.14, 0.32), x0 + W / PX / 2, H / PX - 0.46, zOff + 0.12);
  }
}
const roofMat = std({ map: tex(roofTiles, [1, 1]), roughness: 0.8 });
const bracketMat = std({ color: 0x16140f });
// window light thrown onto the street: a pixel trapezoid with the glazing bars in it, added on top (cheap drama)
const spillTex = sprite(16, 24, (g) => { for (let y = 0; y < 24; y++) { const v = Math.pow(1 - y / 24, 1.4); for (let x = 0; x < 16; x++) { const bar = x === 5 || x === 10 || y === 9; const k = v * (bar ? 0.25 : 1) * (x === 0 || x === 15 ? 0.6 : 1); P(g, x, 23 - y, `rgb(${Math.round(255 * k)},${Math.round(176 * k)},${Math.round(92 * k)})`); } } });
const spillMat = lidMat(new THREE.MeshBasicMaterial({ map: spillTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), null, "dim");
function spill(x, z0, w, lid) {
  const near = z0 + 0.4, far = z0 + 3.6, geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute([x - w / 2, 0.02, near, x + w / 2, 0.02, near, x + w * 0.8, 0.02, far, x - w * 0.8, 0.02, far], 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); geo.setIndex([0, 2, 1, 0, 3, 2]);
  lidAttr(geo, lid);
  const m = new THREE.Mesh(geo, spillMat); m.renderOrder = 2; m.castShadow = false; target.add(m);
}
const LAMP_H = 86, LAMP_HEAD = 18;
const lampArt = (() => {
  const [c, g] = canvas(16, LAMP_H), [ec, eg] = canvas(16, LAMP_H);
  const I = ["#4a443a", "#2c2822", "#17140f", "#0b0a08"];
  const bar = (y, x0, x1) => { for (let x = x0; x <= x1; x++) P(g, x, y, x === x0 ? I[0] : x >= x1 - 1 ? I[2] : I[1]); };
  for (let y = 18; y < 78; y++) bar(y, 6, 9);                                   // fluted shaft
  for (const y of [40, 41, 60, 61, 76, 77]) bar(y, 5, 10);                       // collars
  for (let y = 78; y < 82; y++) bar(y, 4, 11);                                   // base
  for (let y = 82; y < 86; y++) bar(y, 3, 12);
  bar(17, 1, 14); P(g, 1, 16, I[1]); P(g, 14, 16, I[2]);                          // ladder bar with knobs
  bar(16, 5, 10); bar(15, 4, 11);                                                // lantern bottom
  for (let y = 7; y < 15; y++) {                                                 // glass between frame bars
    bar(y, 3, 12);
    for (let x = 4; x <= 11; x++) if (x !== 7 && x !== 8) { const col = y < 9 ? "#ffe9b8" : "#ffd27a"; P(g, x, y, col); P(eg, x, y, col); }
  }
  bar(6, 2, 13); bar(5, 3, 12); bar(4, 4, 11); bar(3, 5, 10); bar(2, 6, 9);       // crown
  bar(1, 7, 8); bar(0, 7, 8);
  const [oc, og] = canvas(16, LAMP_H); og.drawImage(c, 0, 0);                    // the same lamp, unlit
  for (let y = 7; y < 15; y++) for (let x = 4; x <= 11; x++) if (x !== 7 && x !== 8) P(og, x, y, y < 9 ? "#4a4c58" : "#30323c");
  const part = (cv, top, rows) => { const t = tex(cv); t.repeat.set(1, rows / LAMP_H); t.offset.set(0, 1 - (top + rows) / LAMP_H); return t; };
  return {
    head: { map: part(c, 0, LAMP_HEAD), em: part(ec, 0, LAMP_HEAD), off: part(oc, 0, LAMP_HEAD) },
    post: { map: part(c, LAMP_HEAD, LAMP_H - LAMP_HEAD) }
  };
})();
function shrubSprite(mix, W, H, o = {}) {
  const [c, g] = canvas(W, H);
  const ccx = W / 2, ccy = o.ccy !== undefined ? o.ccy : H * 0.56, rx = o.rx || W * 0.42, ry = o.ry || H * 0.4;
  const level = (v) => (v > 0.62 ? 0 : v > 0.22 ? 1 : v > -0.18 ? 2 : v > -0.6 ? 3 : 4);
  const clump = (x0, y0, r, pal) => {
    const er = []; for (let k = 0; k < 17; k++) er.push(r * (0.78 + rnd() * 0.34)); er[16] = er[0];
    const edgeAt = (dx, dy) => { const a = ((Math.atan2(dy, dx) / (Math.PI * 2)) + 1) % 1 * 16, i = Math.floor(a); return er[i] + (er[i + 1] - er[i]) * (a - i); };
    const light = (dx, dy) => (-dx * 0.55 - dy * 0.85) / r * 0.5 + (-(x0 + dx - ccx) * 0.3 - (y0 + dy - ccy) * 0.95) / ry * 0.75;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.hypot(dx, dy) <= edgeAt(dx, dy) - 1) P(g, Math.round(x0 + dx), Math.round(y0 + dy), pal[Math.min(4, level(light(dx, dy)) + 1)]);
    const leaves = []; for (let i = 0, n = Math.round(r * r * 0.75); i < n; i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r; leaves.push([Math.cos(a) * d, Math.sin(a) * d]); }
    leaves.sort((p2, q) => p2[1] - q[1]).forEach(([lx, ly]) => {
      const k = level(light(lx, ly) + (rnd() - 0.5) * 0.32), sz = rnd() < 0.6 ? 1 : 0;
      for (let by = -sz; by <= sz; by++) for (let bx = -sz; bx <= sz; bx++) { if (Math.abs(bx) + Math.abs(by) > sz) continue; const ex = lx + bx, ey = ly + by; if (Math.hypot(ex, ey) > edgeAt(ex, ey) + 1) continue;
        P(g, Math.round(x0 + ex), Math.round(y0 + ey), pal[bx + by < 0 ? Math.max(0, k - 1) : bx + by > 0 ? Math.min(4, k + 1) : k]); }
    });
  };
  const pts = []; for (let i = 0, n = o.n || Math.round(W * H / 45); i < n; i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()); pts.push([ccx + Math.cos(a) * d * rx, ccy + Math.sin(a) * d * ry, ri(o.rMin || 4, o.rMax || 7)]); }
  pts.sort((p2, q) => q[1] - p2[1]).forEach(([x, y, r]) => clump(x, y, r, pick(mix)));
  if (o.flowers) for (let i = 0; i < W * H / 9; i++) { const x = ri(2, W - 3), y = ri(1, Math.round(H * 0.75)); if (g.getImageData(x, y, 1, 1).data[3]) { const fc = pick(o.flowers); P(g, x, y, fc); if (rnd() < 0.5) P(g, x + 1, y, shade(fc, -0.2)); } }
  g._c = null; outlinePass(g, W, H); g._c = null;
  return tex(c);
}
const planterMat = std({ map: woodTex("#2c3a2e") });
function planter2(x, z, mix, flowers) {
  add(new THREE.BoxGeometry(1.7, 0.45, 0.8), planterMat, x, 0.225, z);
  add(new THREE.BoxGeometry(1.76, 0.06, 0.86), trimMat, x, 0.47, z);
  const m = add(new THREE.PlaneGeometry(2.0, 1.12), std({ map: shrubSprite(mix, 32, 18, { flowers }), alphaTest: 0.5 }), x, 0.48 + 0.5, z + 0.05);
  billboards.push(m);
}
function cypress(x, z) {
  add(new THREE.CylinderGeometry(0.34, 0.26, 0.55, 10), std({ color: 0xa0522d }), x, 0.275, z);
  const m = add(new THREE.PlaneGeometry(0.9, 2.5), std({ map: shrubSprite([LEAVES.green, ["#4f6a3a", "#3a5230", "#2a3c24", "#1c2a18", "#101a0e"]], 14, 40, { ccy: 21, rx: 5.2, ry: 18, rMin: 3, rMax: 4, n: 26 }), alphaTest: 0.5 }), x, 0.5 + 1.25, z);
  billboards.push(m);
}

// ================================================================== one house (into the block being built)
const sideMat = std({ map: tex(sideWall, [5, 6]), roughness: 0.95 });
const beamMat = std({ color: 0x3a2818 }), chimMat = std({ map: tex(sideWall, [0.35, 2.4]) }), capMat2 = std({ color: 0x8f877a }), potMat = std({ color: 0x8a4a30 });
const lanternOff = sprite(8, 10, (g) => { R(g, 0, 0, 8, 10, "#16130f"); R(g, 1, 2, 6, 6, "#3a3a42"); R(g, 2, 3, 4, 4, "#4a4c56"); R(g, 3, 2, 2, 6, "#16130f"); });
const lanternMat = lidMat(std({ map: lanternOff, emissiveMap: lanternTex, emissive: 0xffffff, emissiveIntensity: 2.2, side: THREE.DoubleSide }), lanternTex);

// ------------------------------------------------------------------ roofs (2026-10-28, from photos taken from the Westertoren)
/* Seen from above, Amsterdam's roofs are steep saddles: mostly dark anthracite pantiles, some orange-red pantiles, and
   blue-grey slate on the 19th-century houses. Behind a gable the ridge runs back from the street; behind a cornice it runs
   along the street, and that front slope carries one or two white dormers. Brick stacks stand on the party walls.
   The roofs draw from their own random sequence, so the houses, props and lights stay exactly where they were. */
let seed2 = 20261028;
const rnd2 = () => ((seed2 = (seed2 * 16807) % 2147483647) - 1) / 2147483646;
const ROOF_S = 60, ROOF_M = ROOF_S / PX;                     // one roof texture: 60 px = 3.75 m (courses of 5 px, pantiles 4 px wide)
function roofTex(kind) {
  const [c, g] = canvas(ROOF_S, ROOF_S), S = ROOF_S;
  const C = { dark: ["#22252d", "#323641", "#424754", "#555c6c", "#7a8296"], red: ["#4a1e12", "#6e2e1c", "#924426", "#b25832", "#d4784a"], slate: ["#252a35", "#363d4b", "#48505f", "#5c6679", "#808ca6"] }[kind];
  const k5 = (k) => C[Math.max(0, Math.min(4, k))];
  if (kind === "slate") {                                    // staggered slates, each course with a lit lower edge
    for (let y = 0; y < S; y += 5) for (let x = (y / 5) % 2 ? -3 : 0; x < S;) {
      const sw = 5 + Math.floor(rnd2() * 3), t = rnd2() < 0.2 ? (rnd2() < 0.5 ? -1 : 1) : 0;
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < sw; xx++) P(g, (x + xx + S) % S, y + yy, k5((yy === 0 ? 0 : yy === 4 ? 3 : 2) + t));
      for (let yy = 1; yy < 5; yy++) P(g, (x + S) % S, y + yy, C[0]);
      x += sw;
    }
  } else {                                                   // pantiles: the roll catches the light, the trough is dark; shadow under each course
    for (let y = 0; y < S; y += 5) for (let x = 0; x < S; x += 4) {
      const t = rnd2() < 0.14 ? (rnd2() < 0.5 ? -1 : 1) : 0;
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 4; xx++) P(g, x + xx, y + yy, k5([3, 2, 1, 1][xx] + (yy === 0 ? -2 : yy === 4 ? 1 : 0) + t));
    }
  }
  const moss = kind === "red" ? ["#4a5030", "#5c6438"] : ["#30382a", "#3c4632"];
  for (let i = 0; i < (kind === "red" ? 30 : 16); i++) { const x = Math.floor(rnd2() * S), y = Math.floor(rnd2() * S); P(g, x, y, moss[i % 2]); if (rnd2() < 0.5) P(g, (x + 1) % S, y, moss[(i + 1) % 2]); }
  return tex(c, [1, 1]);
}
const ROOF = { dark: std({ map: roofTex("dark") }), red: std({ map: roofTex("red") }), slate: std({ map: roofTex("slate") }) };
const RIDGE = { dark: std({ color: 0x4a4e58 }), red: std({ color: 0x8a4a2c }), slate: std({ color: 0x9a9ea4 }) };   // lighter than the tiles, so the outline reads; slate roofs have zinc ridges
const vergeMat = std({ color: 0xa8a090 });                   // the boards along a roof's front edge, where it shows beside a narrow gable
const dormerMat = std({ color: 0xd8d2c4 }), zincMat = std({ color: 0x6a6e74 });
const dormerWin = sprite(16, 18, (g) => {                    // a white dormer window: four dark panes, the moon in one
  R(g, 0, 0, 16, 18, "#e6dfd0"); R(g, 2, 2, 5, 6, "#121822"); R(g, 9, 2, 5, 6, "#121822"); R(g, 2, 10, 5, 6, "#121822"); R(g, 9, 10, 5, 6, "#121822");
  P(g, 3, 3, "#7a8aa6"); P(g, 4, 3, "#55637c"); P(g, 3, 4, "#55637c"); R(g, 0, 17, 16, 1, "#9a9284");
});
const skylightWin = sprite(10, 13, (g) => { R(g, 0, 0, 10, 13, "#34363c"); R(g, 1, 1, 8, 11, "#141a24"); P(g, 2, 2, "#6a7a96"); P(g, 3, 2, "#4a586e"); });
const dormerWinMat = std({ map: dormerWin }), skylightMat = std({ map: skylightWin });
const pickRoof = (s) => s.roof || (s.gable === "cornice" ? (rnd2() < 0.45 ? "slate" : rnd2() < 0.8 ? "dark" : "red") : rnd2() < 0.64 ? "dark" : rnd2() < 0.86 ? "red" : "slate");
function quad(mat, a, b, c, d, uvs) {                        // a-b along the bottom edge, d-c along the top; faces upward or outward
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray()], 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs || [0, 0, a.distanceTo(b) / ROOF_M, 0, d.distanceTo(c) / ROOF_M, a.distanceTo(d) / ROOF_M, 0, a.distanceTo(d) / ROOF_M], 2));
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a));
  geo.setIndex(n.y >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]); geo.computeVertexNormals();
  return add(geo, mat, 0, 0, 0);
}
function roofOf(f, s, hx, w, h, eave, zOff) {                 // returns the ridge height (the chimneys stand above it)
  const kind = pickRoof(s), mat = ROOF[kind], V = (x, y, z) => new THREE.Vector3(x, y, z);
  const zf = zOff - FDEPTH - 0.02, zb = zOff - FDEPTH - DEPTH + 0.6;
  if (f.mask) {                                              // behind a gable: the ridge runs back from the street
    const ridge = eave + Math.max(1.2, (h - eave) * 0.84), xm = hx + w / 2;
    quad(mat, V(hx - 0.02, eave, zf), V(hx - 0.02, eave, zb), V(xm, ridge, zb), V(xm, ridge, zf));
    quad(mat, V(hx + w + 0.02, eave, zb), V(hx + w + 0.02, eave, zf), V(xm, ridge, zf), V(xm, ridge, zb));
    add(new THREE.BoxGeometry(0.2, 0.15, zf - zb), RIDGE[kind], xm, ridge + 0.04, (zf + zb) / 2);
    const vl = Math.hypot(w / 2, ridge - eave), va = Math.atan2(ridge - eave, w / 2);
    for (const sd of [-1, 1]) add(new THREE.BoxGeometry(vl, 0.1, 0.12), vergeMat, xm + sd * w / 4, (eave + ridge) / 2 + 0.05, zf + 0.02, { noCast: true }).rotation.z = -sd * va;
    if (rnd2() < 0.45 && w > 3) {                            // a skylight in one slope
      const sd = rnd2() < 0.5 ? -1 : 1, u = 0.45, v = 0.3 + rnd2() * 0.4, p = V(xm + sd * (w / 2) * (1 - u), eave + (ridge - eave) * u, zf - (zf - zb) * v);
      const m = add(new THREE.PlaneGeometry(0.62, 0.8), skylightMat, p.x, p.y, p.z, { noCast: true });
      m.lookAt(p.x + sd * (ridge - eave), p.y + w / 2, p.z); m.translateZ(0.03);
    }
    return { ridge, kind, gable: true };
  }
  // behind a cornice: the ridge runs along the street; the front slope shows above the cornice, with dormers
  const top = h - 0.1, rise = Math.min(3.6, 1.6 + w * 0.2), run = rise * 0.78, ridge = top + rise, zr = zf - run;
  if (top - eave > 0.2) add(new THREE.BoxGeometry(w, top - eave, DEPTH), sideMat, hx + w / 2, (eave + top) / 2, zOff - FDEPTH - DEPTH / 2 - 0.02);
  quad(mat, V(hx, top, zf), V(hx + w, top, zf), V(hx + w, ridge, zr), V(hx, ridge, zr));
  quad(mat, V(hx + w, top, zb), V(hx, top, zb), V(hx, ridge, zr), V(hx + w, ridge, zr));
  for (const ex of [hx, hx + w]) {                           // the brick ends of the roof, seen where a neighbour is lower
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([ex, top, zf, ex, ridge, zr, ex, top, zb], 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 0.5, 0.6, 1, 0], 2)); geo.setIndex(ex === hx ? [0, 1, 2] : [0, 2, 1]); geo.computeVertexNormals();
    add(geo, sideMat, 0, 0, 0);
  }
  add(new THREE.BoxGeometry(w, 0.14, 0.2), RIDGE[kind], hx + w / 2, ridge + 0.04, zr);
  const n = w > 8.5 ? 2 : 1;
  for (let k = 0; k < n; k++) {                              // white dormers, as on the Herengracht
    const dx = hx + w * (k + 1) / (n + 1), dw = Math.min(1.4, w * 0.24), dh = 1.45, yb = top + rise * 0.18, zd = zf - (yb - top) / rise * run;
    const dd = (dh + 0.15) / rise * run + 0.1;
    add(new THREE.BoxGeometry(dw, dh, dd), dormerMat, dx, yb + dh / 2, zd - dd / 2);
    add(new THREE.PlaneGeometry(dw * 0.78, dh * 0.8), dormerWinMat, dx, yb + dh * 0.48, zd + 0.01, { noCast: true });
    add(new THREE.BoxGeometry(dw + 0.24, 0.1, dd + 0.18), zincMat, dx, yb + dh + 0.05, zd - dd / 2 + 0.06);
  }
  return { ridge, kind, gable: false, top, dormers: n };
}
// how far each house stands forward (+) or back (-) of the street line. Since 2026-10-28 the houses inside a block
// step in and out by up to a metre (he asked to break the flat bands); the end houses keep the old small steps so the
// cross streets' corners line up.
const STEP_OLD = [0.1, -0.15, 0, -0.25, 0.15, -0.1, 0.2, -0.2, 0.05, -0.1, 0.12], STEP_NEW = [0.3, -0.55, 0, -0.95, 0.4, -0.2, 0.55, -0.75, 0.1, -0.35, 0.3];
function buildHouse(s, hx, i, edge) {
  const f = facade(s), w = f.W / PX, h = f.H / PX, eave = f.Eh / PX;
  const zOff = s.zOff !== undefined ? s.zOff : (edge ? STEP_OLD : STEP_NEW)[i % 11];
  const outer = target;
  if (s.lean) {                                              // the dancing houses lean sideways and forward ("op vlucht"), each its own way
    const pv = new THREE.Group(), inner = new THREE.Group();
    pv.position.set(hx + w / 2, 0, zOff); pv.rotation.set(s.lean[1], 0, s.lean[0]);
    inner.position.set(-(hx + w / 2), 0, -zOff); pv.add(inner); target.add(pv); target = inner;
  }
  buildFacade(f, s, hx, zOff, lidMat(std({ map: f.map, emissiveMap: f.emissive, emissive: 0xffffff, emissiveIntensity: 1.25 }), f.litMap));
  add(new THREE.BoxGeometry(w, eave, DEPTH), sideMat, hx + w / 2, eave / 2, zOff - FDEPTH - DEPTH / 2 - 0.02);
  const RF = roofOf(f, s, hx, w, h, eave, zOff), ridgeY = RF.ridge;
  if (f.mask) add(new THREE.BoxGeometry(s.warehouse ? 0.2 : 0.14, s.warehouse ? 0.2 : 0.14, s.warehouse ? 1.4 : 0.9), beamMat, hx + w / 2, h - (f.Gh / PX) * 0.2, zOff + (s.warehouse ? 0.7 : 0.45));   // hoist beam
  if (i % 3 !== 1) {                                         // a brick stack on the party wall, above the ridge, with a stone cap and two pots
    // (2026-10-28: it stood on the very edge, rising from the eave, and looked like a loose post beside the gable; now it
    // rises out of the roof slope a quarter of the way in, as Amsterdam's do. Same random draws as before.)
    const left = rnd() < 0.5, chz = zOff - DEPTH * (0.45 + rnd() * 0.3), top = ridgeY + 0.8, fx = left ? 0.27 : 0.73, side = hx + w * fx;
    const base = RF.gable ? eave + (ridgeY - eave) * 0.54 - 0.35 : ridgeY - 0.7;   // just below the roof's surface there
    RF.chimney = { x: fx, top, base };
    add(new THREE.BoxGeometry(0.62, top - base, 0.95), chimMat, side, (base + top) / 2, chz);
    add(new THREE.BoxGeometry(0.8, 0.12, 1.12), capMat2, side, top + 0.06, chz);
    for (const dz of [-0.24, 0.24]) add(new THREE.CylinderGeometry(0.09, 0.11, 0.34, 8), potMat, side, top + 0.29, chz + dz);
  }
  if (s.awning) {                                            // a striped awning over the shop window, and a sign on an iron bracket over the door
    const aw = add(new THREE.PlaneGeometry(f.shop.w, 1.5), std({ map: awningTex(s.awning[0], s.awning[1]), alphaTest: 0.5, side: THREE.DoubleSide }), hx + f.shop.x, f.shop.top - 0.62, zOff + 0.65);
    aw.rotation.x = -1.05;
    const sx2 = hx + f.doorX;
    add(new THREE.BoxGeometry(0.05, 0.05, 1.0), bracketMat, sx2, 4.15, zOff + 0.5);
    add(new THREE.BoxGeometry(0.7, 0.04, 0.04), bracketMat, sx2, 4.15, zOff + 0.92);
    add(new THREE.BoxGeometry(0.03, 0.22, 0.03), bracketMat, sx2 - 0.3, 4.03, zOff + 0.92); add(new THREE.BoxGeometry(0.03, 0.22, 0.03), bracketMat, sx2 + 0.3, 4.03, zOff + 0.92);
    add(new THREE.PlaneGeometry(0.85, 0.64), std({ map: signTex(s.sign), side: THREE.DoubleSide }), sx2, 3.6, zOff + 0.92);
  }
  f.lit.forEach((L) => { if (L.y < 3.6) spill(hx + L.x, zOff, L.shop ? f.shop.w - 0.7 : 1.6, L.lid); });   // window light on the cobbles, only when that window is on
  if (s.lantern) {                                           // a wall lantern beside the door
    const lx = hx + f.doorX + f.dw / 2 / PX + 0.35, lid = newLid("lantern");
    add(new THREE.BoxGeometry(0.04, 0.04, 0.3), bracketMat, lx, 2.95, zOff + 0.15);
    add(lidAttr(new THREE.PlaneGeometry(0.32, 0.4), lid), lanternMat, lx, 2.72, zOff + 0.3, { noCast: true });
    Object.assign(LIGHTS[lid], { block: curBlock, x: lx, y: 2.72, z: zOff + 0.3 });
    WINS.push({ lid, block: curBlock, x0: lx - 0.2, x1: lx + 0.2, y0: 2.5, y1: 2.95, z: zOff + 0.3 });
  }
  if (s.flag) {                                              // an Amsterdam flag on a pole out of an upper window
    const base = new THREE.Vector3(hx + w * 0.5, eave * 0.6, zOff + 0.05), dir = new THREE.Vector3(0.45, 0.62, 0.64).normalize(), tip = base.clone().addScaledVector(dir, 1.9);
    const pole = add(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6), std({ color: 0xd8d0c0 }), ...base.clone().addScaledVector(dir, 0.95).toArray());
    pole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const ft = flagTex(), A = base.clone().addScaledVector(dir, 0.75), B = tip.clone().addScaledVector(dir, -0.05), fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute("position", new THREE.Float32BufferAttribute([A.x, A.y, A.z, B.x, B.y, B.z, B.x, B.y - 0.8, B.z, A.x, A.y - 0.8, A.z], 3));
    fgeo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2)); fgeo.setIndex([0, 3, 1, 1, 3, 2]); fgeo.computeVertexNormals();
    const fl = new THREE.Mesh(fgeo, std({ map: ft, alphaTest: 0.5, side: THREE.DoubleSide })); fl.castShadow = true; target.add(fl);
    dynamic.push(fl); critters.push((t) => { ft.offset.x = (Math.floor(t * 1.6) % 2) / 2; });
  }
  target = outer;
  return { x: hx, w, zOff, door: hx + f.doorX, dw: f.dw / PX, H: h, eave, s, f, roof: RF };
}

// ================================================================== the houses
/* Iconic Amsterdam buildings (he asked for more of them, 2026-10-27), drawn from the real ones:
   the House with the Heads (Keizersgracht 123: step gable, stone bands, six heads, obelisks on the steps),
   warehouses (pakhuizen: spout gables, stacked loading doors with hourglass shutters, hoist beams, cart doors),
   Golden Bend mansions (Herengracht: wide sandstone, cornice, tall windows, a raised entrance with two flights),
   one of the narrowest houses (about 2 m), and a row of leaning "dancing" houses like Damrak's. */
const HEADS = { w: 9.6, eave: 13.4, gable: "step", wall: "red", floors: 3, cols: 5, door: "green", frame: "#e6dcc6", speklagen: true, heads: true, obelisks: true, stoneBase: true, doorStyle: "carved", plaque: "sun", zOff: 0.1 };
const MANSION = (o) => Object.assign({ w: 10.6, eave: 14.2, gable: "cornice", wall: "sand", floors: 3, cols: 5, door: "green", frame: "#e6dcc6", doorCenter: true, stoop: true, pilasters: true, tallWin: 0.74, doorStyle: "glass", zOff: 0.05 }, o);
const TINY = { w: 2.1, eave: 9.8, gable: "neck", wall: "brown", floors: 3, cols: 1, door: "red", frame: "#e6dcc6", noGround: true, doorStyle: "plain", zOff: 0.12 };
const WAREHOUSE = (o) => Object.assign({ w: 6.6, eave: 14.0, gable: "spout", wall: "brown", floors: 4, cols: 2, door: "green", frame: "#2d4b3a", warehouse: true, shutterCol: ["#2d4b3a", "#a83a2a"], doorStyle: "double" }, o);
const SHOPS = [
  { shop: { frame: "#4a3a1a", name: "KAAS", goods: ["#e0b040", "#d8a030", "#f0d070", "#c89028"], display: "shelves" }, awning: ["#c8a040", "#3a2a14"], sign: "bread" },
  { shop: { frame: "#2a2a3a", name: "ANTIEK", ink: "#d8c8a8", display: "books" }, awning: ["#3a3a4a", "#c8b898"], sign: "book" },
  { shop: { frame: "#3a1a14", name: "PROEFLOKAAL", ink: "#e8c070", display: "cafe" }, awning: ["#5a1a14", "#e0c8a0"], sign: "cup" },
  { shop: { frame: "#1c2a3a", name: "PLATEN", ink: "#e0d8c8", display: "books" }, awning: ["#1c2a3a", "#d0c0a0"], sign: "wheel" },
  { shop: { frame: "#2d4b3a", name: "GROENTE", goods: ["#5a8a3a", "#c83a2a", "#e0a030", "#8a5a2a"], display: "shelves" }, awning: ["#2d5a3a", "#e0d8c0"], sign: "tulip" }
];
function genHouse(o = {}) {
  const w = o.w || +(5.2 + rnd() * 1.8).toFixed(1), eave = o.eave || +(10.6 + rnd() * 2.6).toFixed(1);
  const s = { w, eave, gable: pick(["step", "bell", "neck", "cornice", "spout", "bell", "neck"]), wall: pick(["red", "brown", "ochre", "cream", "slate", "salmon", "red", "brown", "dark"]),
    floors: eave > 12.3 ? 4 : 3, cols: w > 6.3 ? 3 : 2, door: pick(["green", "red", "blue"]), frame: pick(["#e6dcc6", "#e6dcc6", "#2d4b3a", "#1c1c1c", "#5a1e18"]),
    shutters: rnd() < 0.25, flowers: rnd() < 0.25, arch: rnd() < 0.3, plaque: rnd() < 0.25 ? pick(["ship", "fish", "bird", "key", "sun"]) : null,
    doorStyle: pick(["double", "carved", "glass", "plain"]), lantern: rnd() < 0.3, pilasters: rnd() < 0.2, stoneBase: rnd() < 0.2,
    ivy: rnd() < 0.1 ? pick(["left", "right"]) : null, balcony: rnd() < 0.15 ? 1 : 0, pots: rnd() < 0.15, hollyhock: rnd() < 0.15 };
  Object.assign(s, o);
  if (o.shop) Object.assign(s, o.shop);                      // { shop, awning, sign } from SHOPS
  return s;
}
const dancing = (k) => genHouse({ w: +(4.1 + rnd() * 0.6).toFixed(1), eave: +(11 + rnd() * 1.6).toFixed(1), gable: pick(["bell", "neck", "step", "spout"]),
  lean: [(k % 2 ? 1 : -1) * (0.02 + rnd() * 0.02), 0.012 + rnd() * 0.01], pilasters: false, balcony: 0 });

// ================================================================== shared props
const ironMat = std({ color: 0x16140f });
const bikeMat = std({ map: bikeTex, alphaTest: 0.5, side: THREE.DoubleSide });
function bikes(x, n, z = 7.2) { for (let k = 0; k < n; k++) { const b = add(new THREE.PlaneGeometry(2.5, 1.5), bikeMat, x + k * 0.55, 0.75, z + (k % 2) * 0.1); b.rotation.y = 1.25; } }
const barrelMat = std({ map: woodTex("#6a4a2c") });
function barrel(x, z) { add(new THREE.CylinderGeometry(0.34, 0.34, 0.85, 10), barrelMat, x, 0.43, z); }
const crateMat = std({ map: crateTex });
function crate(x, z, y, top) { const m = top ? [crateMat, crateMat, std({ map: top }), crateMat, crateMat, crateMat] : crateMat; add(new THREE.BoxGeometry(0.7, 0.7, 0.7), m, x, (y || 0) + 0.35, z); }
const planterBoxMat = std({ map: woodTex("#3a2a1c") }), bushMat = std({ map: bushTex, alphaTest: 0.5, side: THREE.DoubleSide });
function planter(x, z) { add(new THREE.BoxGeometry(0.9, 0.55, 0.9), planterBoxMat, x, 0.28, z); const b = add(new THREE.PlaneGeometry(1.2, 0.72), bushMat, x, 0.85, z); b.rotation.y = 0.2; }
const benchMat = std({ map: woodTex("#5a3a22") });
function bench(x, z, back) {                                 // facing the canal
  add(new THREE.BoxGeometry(2.0, 0.12, 0.6), benchMat, x, 0.5, z); add(new THREE.BoxGeometry(2.0, 0.6, 0.1), benchMat, x, 0.8, z + (back || -0.3));
  for (const dx of [-0.85, 0.85]) add(new THREE.BoxGeometry(0.08, 0.44, 0.55), bracketMat, x + dx, 0.22, z);
}
const boatHull = std({ map: woodTex("#3a2a1c") }), boatSeat = std({ color: 0x7a2a22 });
function boat(x, z, lantern) {
  const g = new THREE.Group(); g.position.set(x, -1.15, z); target.add(g);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.55, 1.7), boatHull); hull.castShadow = hull.receiveShadow = true; g.add(hull);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 1.3), boatSeat); seat.position.y = 0.34; g.add(seat);
  if (lantern) {
    const lid = newLid("lantern"), l = new THREE.Mesh(lidAttr(new THREE.BoxGeometry(0.2, 0.28, 0.2), lid), lanternMat); l.position.set(2.3, 0.6, 0); g.add(l);
    Object.assign(LIGHTS[lid], { block: curBlock, x: x + 2.3, y: -0.55, z });
  }
}
const spriteMats = new Map();                                // one material per sprite image, so the merge can batch them
const spriteAt = (map, w, h, x, y, z, cast) => { if (!spriteMats.has(map)) spriteMats.set(map, std({ map, alphaTest: 0.5, side: THREE.DoubleSide })); return add(new THREE.PlaneGeometry(w, h), spriteMats.get(map), x, y, z, cast ? undefined : { noCast: true }); };
const critter = (map, w, h, x, y, z, flip, every) => {
  const m = add(new THREE.PlaneGeometry(w, h), std({ map: map.clone(), alphaTest: 0.5, side: THREE.DoubleSide }), x, y + h / 2, z, { noCast: true });
  m.material.map.needsUpdate = true; billboards.push(m); if (flip) m.scale.x = -1;
  const ph = rnd() * 10; critters.push((t) => { m.material.map.offset.x = (Math.floor((t + ph) / every) % 3 === 0 ? 1 : 0) / 2; });
};
function houseExtras(b) {                                    // hollyhocks against walls beside some doors, pots of geraniums by others
  b.H.forEach((H) => {
    if (H.s.hollyhock) { spriteAt(hollyhockTex, 0.75, 2.12, H.door - H.dw / 2 - 0.5, 1.06, H.zOff + 0.3, true); spriteAt(hollyhockTex, 0.7, 1.9, H.door - H.dw / 2 - 1.05, 0.95, H.zOff + 0.4, true); }
    if (H.s.pots && !H.s.stoop) for (const side of [-1, 1]) spriteAt(potTex, 0.62, 0.62, H.door + side * (H.dw / 2 + 0.4), 0.31, H.zOff + 0.4);
  });
}

// ------------------------------------------------------------------ lamps: each one a light of its own
function lamp(x, z, near) {
  const lid = newLid("lamp");
  const g = new THREE.Group(), postH = (LAMP_H - LAMP_HEAD) / PX, headH = LAMP_HEAD / PX;
  const post = new THREE.Mesh(new THREE.PlaneGeometry(1, postH), std({ map: lampArt.post.map, alphaTest: 0.5, side: THREE.DoubleSide }));
  post.position.y = postH / 2; post.castShadow = true; g.add(post);
  const headMat = std({ map: lampArt.head.off, emissiveMap: lampArt.head.em, emissive: 0xffffff, emissiveIntensity: 0, alphaTest: 0.5, side: THREE.DoubleSide });
  const head = new THREE.Mesh(new THREE.PlaneGeometry(1, headH), headMat);
  head.position.y = postH + headH / 2; g.add(head);
  g.position.set(x, 0, z); target.add(g); billboards.push(g);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 2.8, 4.4, 24, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { k: { value: 0 } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float k; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float a = smoothstep(-2.2, 2.2, vY) * pow(abs(dot(vN, vV)), 2.0) * 0.06 * k; gl_FragColor = vec4(vec3(1.0,0.75,0.45)*a, 1.0); }`
  }));
  cone.position.set(x, 2.25, z); cone.visible = false; target.add(cone);
  const L = { lid, block: curBlock, x, z, near: !!near, head, headMat, cone, warm: [0xffb866, 0xffc98a, 0xffa955, 0xffd3a0][LAMPS.length % 4], on: false };
  LAMPS.push(L); Object.assign(LIGHTS[lid], { block: curBlock, x, y: 5.0, z, lamp: L });
  return L;
}
// a string of bulbs (bridge outlines, the string across the quay): one light for the whole string
const bulbGeo = new THREE.SphereGeometry(0.07, 6, 4);
function bulbString(pts, xKeep) {   // xKeep: where its light is, if not the bulbs' middle (a rebuilt bridge keeps its old place)
  const lid = newLid("bulbs"), mat = new THREE.MeshBasicMaterial({ color: 0xffe2b0 }), m = new THREE.InstancedMesh(bulbGeo, mat, pts.length);
  pts.forEach((b, i) => m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(b[0], b[1], b[2])));
  m.visible = false; target.add(m);
  const B = { lid, block: curBlock, mesh: m, mat, x: xKeep !== undefined ? xKeep : pts.reduce((a, p) => a + p[0], 0) / pts.length };
  BULBS.push(B); Object.assign(LIGHTS[lid], { block: curBlock, x: B.x, y: 2, z: 12 });
}

// ------------------------------------------------------------------ bridges
const bridgeBrick = (() => { const [c, g] = canvas(32, 32); bricks(g, 0, 0, 32, 32, PAL.red, PAL.mortarRed); return std({ map: tex(c, [0.5, 0.5]) }); })();
const ringMat = std({ map: (() => { const [c, g] = canvas(16, 16); R(g, 0, 0, 16, 16, "#b9b09c"); for (let x = 0; x < 16; x += 4) R(g, x, 0, 1, 16, "#7e7666"); for (let i = 0; i < 30; i++) P(g, ri(0, 15), ri(0, 15), pick(["#a39a86", "#cfc6b2", "#8e8574"])); return tex(c, [1, 1]); })() });
const railArtMat = std({ map: (() => { const t = sprite(32, 16, (g) => { const I = "#17140f", H2 = "#3a352c";
  R(g, 0, 0, 32, 2, I); R(g, 0, 0, 32, 1, H2); R(g, 0, 13, 32, 2, I); for (let x = 1; x < 32; x += 4) { R(g, x, 2, 1, 11, I); P(g, x, 6, H2); } R(g, 0, 0, 2, 16, I); R(g, 0, 0, 1, 16, H2); }); t.wrapS = THREE.RepeatWrapping; return t; })(), alphaTest: 0.5, side: THREE.DoubleSide });
/* Amsterdam's brick canal bridges (rebuilt 2026-10-28 from photos of the Reguliersgracht bridges; he found the old ones
   ugly): a low, gently humped deck; one flat segmental arch; brick parapets with light stone coping; dark green cast-iron
   railings with knobbed posts; stone blocks at the arch's feet; a dark algae line at the water; bulbs along the arch and
   the coping. Seen from our camera the bridge runs away from us across the canal (z 9 to 19.4). Nothing here draws from
   the main random sequence, and the bulb string keeps its old place, so his lights don't move. */
const copeMat = std({ color: 0xb4ae9f }), ironGreen = std({ color: 0x1d3529 }), algaeMat = std({ color: 0x1e2a1c });
const klinkerMat = std({ map: (() => { const [c, g] = canvas(32, 32); R(g, 0, 0, 32, 32, "#2a2622");   // the deck: grey-brown brick pavers, herringbone-ish rows
  for (let y = 0; y < 32; y += 4) for (let x = (y / 4) % 2 ? -4 : 0; x < 32; x += 8) { const b = ["#5a524a", "#4e4740", "#635a50", "#544c45"][Math.floor(rnd2() * 4)];
    R(g, x + 1, y + 1, 7, 3, b); R(g, x + 1, y + 1, 7, 1, shade(b, 0.06)); R(g, x + 7, y + 1, 1, 3, shade(b, -0.08)); }
  return tex(c, [1, 1]); })() });
const archRingMat = std({ map: (() => { const [c, g] = canvas(16, 16); R(g, 0, 0, 16, 16, "#3a2a22");   // header bricks round the arch, a little lighter than the walls
  for (let x = 0; x < 16; x += 3) for (let y = 0; y < 16; y += 8) { const b = ["#9a5238", "#a65a3c", "#8e4a32"][Math.floor(rnd2() * 3)]; R(g, x, y, 2, 7, b); R(g, x, y, 2, 1, shade(b, 0.08)); }
  return tex(c, [1, 1]); })() });
function profWall(x, depth, z0, z1, f, y0, y1, mat, cast = true) {   // a solid strip following the deck: between f(z)+y0 and f(z)+y1, centred on x
  const sh = new THREE.Shape(), N = 28;
  sh.moveTo(z0, f(z0) + y0);
  for (let k = 1; k <= N; k++) { const z = z0 + (z1 - z0) * k / N; sh.lineTo(z, f(z) + y0); }
  for (let k = N; k >= 0; k--) { const z = z0 + (z1 - z0) * k / N; sh.lineTo(z, f(z) + y1); }
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }), mat);
  m.rotation.y = -Math.PI / 2; m.position.set(x + depth / 2, 0, 0); m.castShadow = cast; m.receiveShadow = true; target.add(m); return m;
}
function profStrip(xa, xb, z0, z1, f, yOff, mat, uLen) {    // a flat strip lying on the deck, from x xa to xb
  const N = 28, pos = [], uv = [], idx = []; let len = 0, prev = null;
  for (let k = 0; k <= N; k++) {
    const z = z0 + (z1 - z0) * k / N, y = f(z) + yOff;
    if (prev) len += Math.hypot(z - prev[0], y - prev[1]); prev = [z, y];
    pos.push(xa, y, z, xb, y, z); uv.push(0, len / uLen, (xb - xa) / uLen, len / uLen);
    if (k) { const i = k * 2; idx.push(i - 2, i, i - 1, i - 1, i, i + 1); }   // facing up
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; target.add(m); return m;
}
function brickBridge(BX, o = {}) {
  const BW = 7, z0 = 9.0, z1 = 19.4, L = z1 - z0, H = o.flat ? 0.45 : 0.9, bulbs = [];
  const f = (z) => Math.sin(Math.min(1, Math.max(0, (z - z0) / L)) * Math.PI) * H;   // the deck's gentle hump
  // the body, with one segmental arch through it
  const s = 7.4, ys = -1.35, rise = o.flat ? 1.15 : 1.5, zc = z0 + L / 2, R0 = (s * s / 4 + rise * rise) / (2 * rise), yc = ys + rise - R0, a0 = Math.asin((ys - yc) / R0);
  const sh = new THREE.Shape(); sh.moveTo(z0, -1.6); sh.lineTo(z1, -1.6);
  for (let k = 0; k <= 28; k++) { const z = z1 - L * k / 28; sh.lineTo(z, f(z)); }
  const hole = new THREE.Path(); hole.moveTo(zc - s / 2, -1.55); hole.lineTo(zc - s / 2, ys); hole.absarc(zc, yc, R0, Math.PI - a0, a0, true); hole.lineTo(zc + s / 2, -1.55); hole.lineTo(zc - s / 2, -1.55);
  sh.holes.push(hole);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: BW, bevelEnabled: false, curveSegments: 24 }), bridgeBrick);
  body.rotation.y = -Math.PI / 2; body.position.set(BX + BW / 2, 0, 0); body.castShadow = body.receiveShadow = true; target.add(body);
  // the arch ring and the stones at its feet, on both faces; the algae line at the water
  const ring = new THREE.Shape(), ro = R0 + 0.36;
  ring.absarc(zc, yc, ro, Math.PI - Math.asin((ys - yc) / ro), Math.asin((ys - yc) / ro), true); ring.absarc(zc, yc, R0, a0, Math.PI - a0, false);
  for (const sd of [-1, 1]) {
    const fx = BX + sd * (BW / 2 + 0.05);
    const rm = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.1, bevelEnabled: false, curveSegments: 24 }), archRingMat); rm.rotation.y = -Math.PI / 2; rm.position.set(fx + 0.05, 0, 0); rm.castShadow = rm.receiveShadow = true; target.add(rm);
    for (const zf of [zc - s / 2, zc + s / 2]) add(new THREE.BoxGeometry(0.16, 0.34, 0.62), copeMat, fx, ys + 0.12, zf);
    add(new THREE.BoxGeometry(0.12, 0.32, (zc - s / 2) - z0), algaeMat, fx, -1.12, (z0 + zc - s / 2) / 2, { noCast: true });
    add(new THREE.BoxGeometry(0.12, 0.32, z1 - (zc + s / 2)), algaeMat, fx, -1.12, (z1 + zc + s / 2) / 2, { noCast: true });
  }
  // the deck, the parapets, the coping, the railings
  profStrip(BX - BW / 2 + 0.4, BX + BW / 2 - 0.4, z0, z1, f, 0.012, klinkerMat, 2.0);
  for (const sd of [-1, 1]) {
    const x = BX + sd * (BW / 2 - 0.2);
    profWall(x, 0.4, z0, z1, f, -0.05, 0.42, bridgeBrick);
    profWall(x, 0.52, z0 - 0.1, z1 + 0.1, f, 0.42, 0.56, copeMat);
    profWall(x, 0.06, z0, z1, f, 0.62, 0.68, ironGreen); profWall(x, 0.07, z0, z1, f, 1.44, 1.52, ironGreen);   // bottom and top rails
    for (let z = z0 + 0.12; z < z1; z += 0.16) add(new THREE.BoxGeometry(0.03, 0.8, 0.03), ironGreen, x, f(z) + 1.04, z, { noCast: true });   // bars
    for (let k = 0; k <= 6; k++) {                           // posts with knobs
      const z = z0 + L * k / 6, y = f(z);
      add(new THREE.BoxGeometry(k % 6 ? 0.09 : 0.16, 1.0, k % 6 ? 0.09 : 0.16), ironGreen, x, y + 1.05, z);
      add(new THREE.SphereGeometry(k % 6 ? 0.06 : 0.1, 8, 6), ironGreen, x, y + 1.6 + (k % 6 ? 0 : 0.04), z, { noCast: true });
    }
    for (let k = 0; k <= 26; k++) bulbs.push([x + sd * 0.05, f(z0 + L * k / 26) + 0.6, z0 + L * k / 26]);   // along the coping
  }
  if (o.tracks) for (const tx of o.tracks) for (const r of [-0.72, 0.72]) profStrip(BX + tx + r - 0.04, BX + tx + r + 0.04, z0, z1, f, 0.03, railMat, 1);   // tram rails across it
  for (const sd of [-1, 1]) for (let k = 1; k < 24; k++) {   // bulbs along the arch on both faces (Amsterdam's are outlined at night)
    const a = Math.PI - a0 - (Math.PI - 2 * a0) * k / 24; bulbs.push([BX + sd * (BW / 2 + 0.16), yc + Math.sin(a) * (ro + 0.08), zc + Math.cos(a) * (ro + 0.08)]);
  }
  bulbString(bulbs, BX - 3.7 * 21 / 55);                     // the string keeps the place its light had (his lights don't move)
  return { x: BX, half: BW / 2 + 1, deck: f };
}
const railMat = std({ color: 0x9a9ca2 });
/* The Magere Brug (Skinny Bridge) over the Amstel: a white wooden drawbridge on low arches, two portals with
   balance beams over the deck, chains down to the lifting span, and at night every beam outlined in bulbs. */
const whiteWood = std({ color: 0xe6e1d6 }), deckMat = std({ map: woodTex("#6a5a48") });
function skinnyBridge(BX) {
  const bulbs = [], half = 2.6, z0 = 9.0, z1 = 19.4, zm = (z0 + z1) / 2;
  add(new THREE.BoxGeometry(half * 2, 0.3, z1 - z0), deckMat, BX, 0.05, zm);
  for (const zp of [11.6, 16.8]) {                           // stone piers with small arches between them
    add(new THREE.BoxGeometry(half * 2 + 0.3, 1.5, 0.9), ringMat, BX, -0.7, zp);
  }
  for (const sd of [-1, 1]) {                                // white railings on both sides
    const x = BX + sd * (half - 0.08);
    add(new THREE.BoxGeometry(0.1, 0.1, z1 - z0), whiteWood, x, 1.05, zm); add(new THREE.BoxGeometry(0.08, 0.08, z1 - z0), whiteWood, x, 0.6, zm);
    for (let z = z0 + 0.2; z < z1; z += 1.0) add(new THREE.BoxGeometry(0.1, 1.0, 0.1), whiteWood, x, 0.6, z);
    for (let z = z0 + 0.2; z < z1; z += 0.5) bulbs.push([x, 1.16, z]);
  }
  const pz = [12.6, 15.8], H = 6.0;
  for (const sd of [-1, 1]) {
    const x = BX + sd * (half + 0.15);
    for (const z of pz) { add(new THREE.BoxGeometry(0.3, H, 0.3), whiteWood, x, H / 2, z); for (let y = 0.6; y < H; y += 0.55) bulbs.push([x + sd * 0.17, y, z]); }
    const brace = add(new THREE.BoxGeometry(0.16, Math.hypot(pz[1] - pz[0], H * 0.55), 0.16), whiteWood, x, H * 0.45, (pz[0] + pz[1]) / 2); brace.rotation.x = Math.atan2(pz[1] - pz[0], H * 0.55);
    const brace2 = add(new THREE.BoxGeometry(0.16, Math.hypot(pz[1] - pz[0], H * 0.55), 0.16), whiteWood, x, H * 0.45, (pz[0] + pz[1]) / 2); brace2.rotation.x = -Math.atan2(pz[1] - pz[0], H * 0.55);
    add(new THREE.BoxGeometry(0.34, 0.4, z1 - z0 - 1.6), whiteWood, x, H + 0.2, zm);                       // the balance beam
    for (let z = z0 + 0.9; z < z1 - 0.8; z += 0.45) bulbs.push([x, H + 0.46, z]);
    for (const ze of [z0 + 1.0, z1 - 1.0]) add(new THREE.BoxGeometry(0.05, H - 0.4, 0.05), ironMat, x - sd * 0.25, H / 2 + 0.2, ze);   // chains down to the lifting span
  }
  for (const z of pz) { add(new THREE.BoxGeometry(half * 2 + 0.6, 0.3, 0.3), whiteWood, BX, H - 0.35, z); for (let x = -half; x <= half; x += 0.5) bulbs.push([BX + x, H - 0.15, z]); }
  bulbString(bulbs);
  return { x: BX, half: half + 1.5 };
}

// ------------------------------------------------------------------ houseboats: windows on the water
const hullMat = std({ color: 0x1c2420 }), roofBoat = std({ map: woodTex("#3a3026") });
function houseboat(x, len, col) {
  const z = 11.6, cl = len - 1.6, W = Math.round(cl * PX), Hh = Math.round(2.0 * PX);
  add(new THREE.BoxGeometry(len, 1.0, 3.6), hullMat, x, -1.05, z);
  add(new THREE.BoxGeometry(cl, 2.0, 3.0), std({ color: col }), x, 0.45, z - 0.1);
  add(new THREE.BoxGeometry(cl + 0.4, 0.14, 3.4), roofBoat, x, 1.52, z - 0.1);
  // the side facing the street's camera: painted planks, windows that light like the houses'
  const [c, g] = canvas(W, Hh), [lc, lg] = canvas(W, Hh), [ec, eg] = canvas(W, Hh);
  R(eg, 0, 0, W, Hh, "#000");
  for (let y = 0; y < Hh; y += 3) { R(g, 0, y, W, 3, shade(col, (y / 3) % 2 ? -0.03 : 0.02)); R(g, 0, y + 2, W, 1, shade(col, -0.12)); }
  const nW = Math.max(2, Math.floor(W / 30)), holes = [];
  for (let k = 0; k < nW; k++) {
    const ww = 16, wh = 13, wx = Math.round((k + 0.5) * W / nW - ww / 2), wy = 7, lid = newLid("window");
    R(g, wx - 1, wy - 1, ww + 2, wh + 2, "#e6dcc6");
    for (let yy = 0; yy < wh; yy++) for (let xx = 0; xx < ww; xx++) { P(g, wx + xx, wy + yy, pick(PAL.glass)); const on = PAL.lit[Math.min(3, Math.floor(yy / wh * 3.2))]; P(lg, wx + xx, wy + yy, on); P(eg, wx + xx, wy + yy, on); }
    if (rnd() < 0.5) { const cc = pick(PAL.curtain); R(lg, wx, wy, 3, wh, cc); R(lg, wx + ww - 3, wy, 3, wh, cc); R(eg, wx, wy, 3, wh, "#000"); R(eg, wx + ww - 3, wy, 3, wh, "#000"); }
    else { R(lg, wx + 3, wy + wh - 4, 3, 3, pick(PAL.leaf)); R(eg, wx + 3, wy + wh - 4, 3, 3, "#000"); }
    for (const cv of [g, lg]) R(cv, wx + ww / 2, wy, 1, wh, "#e6dcc6"); R(eg, wx + ww / 2, wy, 1, wh, "#000");
    holes.push({ x: wx - 1, y: wy - 1, w: ww + 2, h: wh + 2, lid });
  }
  const [Lc, Lg] = canvas(W, Hh); Lg.drawImage(c, 0, 0); Lg.drawImage(lc, 0, 0);
  const mat = lidMat(std({ map: tex(c), emissiveMap: tex(ec), emissive: 0xffffff, emissiveIntensity: 0.8 }), tex(Lc));
  const zf = z - 0.1 + 1.505, x0 = x - cl / 2;
  add(new THREE.PlaneGeometry(cl, 2.0), mat, x, 0.45, zf, { noCast: true });
  holes.forEach((h) => {
    const g2 = new THREE.PlaneGeometry(h.w / PX, h.h / PX), u = g2.attributes.uv;
    for (let i = 0; i < u.count; i++) u.setXY(i, (h.x + u.getX(i) * h.w) / W, 1 - (h.y + h.h) / Hh + u.getY(i) * h.h / Hh);
    const cx = x0 + (h.x + h.w / 2) / PX, cy = -0.55 + (Hh - h.y - h.h / 2) / PX;
    add(lidAttr(g2, h.lid), mat, cx, cy, zf + 0.01, { noCast: true });
    Object.assign(LIGHTS[h.lid], { block: curBlock, x: cx, y: cy, z: zf });
    WINS.push({ lid: h.lid, block: curBlock, x0: cx - h.w / PX / 2, x1: cx + h.w / PX / 2, y0: cy - h.h / PX / 2, y1: cy + h.h / PX / 2, z: zf + 0.01 });
  });
  // life on deck: plants on the roof, a bike
  for (let k = 0; k < 3; k++) { const p = add(new THREE.PlaneGeometry(1.2, 0.72), bushMat, x - cl / 2 + 1 + k * (cl - 2) / 2, 1.95, z + 0.6, { noCast: true }); p.rotation.y = 0.1; }
  spriteAt(potTex, 0.62, 0.62, x + len / 2 - 0.5, -0.2, z + 0.8);
}

// ------------------------------------------------------------------ the ground under each block: street, quays, near quay
const quayMat = (W) => std({ map: tex(quayStone, [W / 2, 1]) });
// flagstones in front of the houses that stand back from the street line (2026-10-28)
const forecourtMat = (() => {
  const [c, g] = canvas(64, 24); R(g, 0, 0, 64, 24, "#1a1714");
  for (let y = 0; y < 24; y += 12) for (let x = -Math.floor(rnd2() * 8); x < 64; x += 11 + Math.floor(rnd2() * 4)) {
    const b = ["#6e675c", "#655e54", "#77705f", "#5e584f"][Math.floor(rnd2() * 4)], w = 10 + Math.floor(rnd2() * 3);
    R(g, x, y, w, 11, b); R(g, x, y, w, 1, shade(b, 0.07)); R(g, x, y + 10, w, 1, shade(b, -0.09)); R(g, x + w - 1, y, 1, 11, shade(b, -0.06));
  }
  return std({ map: tex(c, [1, 1]) });
})();
function ground(b, o = {}) {
  const W = b.w;
  const street = add(new THREE.PlaneGeometry(W, 9), streetMat(W, 9, { pavement: true, kerbAtEnd: true, puddles: Math.round(W / 10), manholes: o.manholes || [], leavesAt: o.leavesAt || [], leafRow: 7.8 }), 0, 0, 4.5, { noCast: true }); street.rotation.x = -Math.PI / 2;
  if (!b.def.gap) { const fc = add(new THREE.PlaneGeometry(W, 1.3), forecourtMat, 0, 0.003, -0.65, { noCast: true }); fc.rotation.x = -Math.PI / 2;
    const uv = fc.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * W / 4, uv.getY(i) * 1.3 / 1.5); }
  add(new THREE.BoxGeometry(W, 1.6, 0.4), quayMat(W), 0, -0.8, 9.2, { noCast: true });
  const near = add(new THREE.PlaneGeometry(W, 7), streetMat(W, 7, { pavement: false, kerbAtEnd: false, puddles: Math.round(W / 22), leavesAt: [], leafRow: 2.5 }), 0, 0, 22.4, { noCast: true }); near.rotation.x = -Math.PI / 2;
  add(new THREE.BoxGeometry(W, 1.6, 0.4), quayMat(W), 0, -0.8, 19.0, { noCast: true });
  const rt = railTex.clone(); rt.repeat.set(W / 6.4, 1); rt.needsUpdate = true;
  add(new THREE.PlaneGeometry(W, 1.1), std({ map: rt, alphaTest: 0.5, side: THREE.DoubleSide }), 0, 0.55, 19.4);
  for (let x = -W / 2 + 3 + rnd() * 3; x < W / 2 - 2; x += 7.5 + rnd() * 2.5) {      // big dark shrubs: out of focus they frame the bottom edge
    const sc = 1.6 + rnd() * 0.8, bb = add(new THREE.PlaneGeometry(2.6 * sc, 1.6 * sc), nearBushMat, x, 0.8 * sc, 21.6 + rnd() * 2.0); bb.rotation.y = (rnd() - 0.5) * 0.6;
  }
}
const railTex = sprite(64, 12, (g) => { R(g, 0, 0, 64, 2, "#14110e"); for (let x = 0; x < 64; x += 6) R(g, x, 0, 2, 12, "#14110e"); });
railTex.wrapS = THREE.RepeatWrapping;
const nearBushMat = std({ map: bushTex, color: 0x8a8a8a, alphaTest: 0.5, side: THREE.DoubleSide });
const paperMat = std({ map: paperTex });

// lamps along the quay every ~15 m (not on the bridges), one on the near quay now and then, boats between them
function quayLife(b, o = {}) {
  const avoid = (x, r) => (b.bridges || []).some((br) => Math.abs(x - br.x) < br.half + r) || (o.avoid || []).some(([a, c]) => x > a - r && x < c + r);
  const xs = [];
  for (let x = -b.w / 2 + 4 + rnd() * 3; x < b.w / 2 - 3; x += 14 + rnd() * 3) { let xx = x; while (avoid(xx, 1.5) && xx < b.w / 2) xx += 1; if (xx < b.w / 2 - 1) { lamp(xx, 8.3); xs.push(xx); } }
  for (let x = -b.w / 2 + 10 + rnd() * 8; x < b.w / 2 - 4; x += 26 + rnd() * 10) lamp(x, 20.0, true);
  if (!o.noBoats) for (let x = -b.w / 2 + 5 + rnd() * 6; x < b.w / 2 - 4; x += 15 + rnd() * 8) if (!avoid(x, 3.5)) boat(x, 10.6, rnd() < 0.4);
  b.lampXs = xs;
  return (x, r) => avoid(x, r) || xs.some((lx) => Math.abs(lx - x) < r + 0.6);
}
function streetProps(b, blocked) {
  const mixes = [[LEAVES.green, LEAVES.green], [LEAVES.green, LEAVES.yellow], [LEAVES.green, LEAVES.ochre]], flowers = [["#e9879a", "#d8507a", "#f1e3c8"], ["#f1e3c8", "#f6efe0"], ["#8a6ab8", "#a88ad0"], null];
  b.H.forEach((H) => {
    const r = rnd(), cx = H.x + H.w / 2;
    if (r < 0.26 && !blocked(cx, 1.6)) bikes(cx - 0.8, ri(2, 4));
    else if (r < 0.42 && !blocked(cx, 1.2)) planter2(cx, 7.8, pick(mixes), pick(flowers));
    else if (r < 0.5) { barrel(H.x + H.w * 0.78, H.zOff + 1.1); if (rnd() < 0.6) crate(H.x + H.w * 0.78 + 0.75, H.zOff + 1.0); }
    else if (r < 0.58 && !blocked(cx, 1.4)) bench(cx, 7.9);
  });
  for (let k = 0; k < Math.round(b.w / 12); k++) { const p2 = add(new THREE.PlaneGeometry(0.3, 0.4), paperMat, -b.w / 2 + rnd() * b.w, 0.012, 1.4 + rnd() * 6, { noCast: true }); p2.rotation.set(-Math.PI / 2, 0, rnd() * 6.28); }
  const px = -b.w / 2 + rnd() * b.w;
  [[0, 4.2, false], [0.5, 4.6, true], [1.1, 4.1, false]].forEach(([dx, z, fl]) => critter(pigeonTex, 0.44, 0.38, px + dx, 0, z, fl, 0.45 + rnd() * 0.5));
}


// ================================================================== the home block: the street as it was in mockup H
function propsHome(b) {
  const HX = b.H;
  const STRING = [[-19, 4.2, 8.3], [-2, 4.2, 8.3]], sb = [];
  for (let k = 0; k <= 18; k++) { const t = k / 18; sb.push([STRING[0][0] + (STRING[1][0] - STRING[0][0]) * t, STRING[0][1] - Math.sin(t * Math.PI) * 0.8, 8.3]); }
  bulbString(sb);
  b.lampXs = [-19, -2, 13, 30];
  b.lampXs.forEach((x) => lamp(x, 8.3)); lamp(-9, 20.0, true);
  cypress(-27.7, 7.8); cypress(-26.3, 7.8);
  planter2(-14.5, 7.8, [LEAVES.green, LEAVES.green], ["#e9879a", "#d8507a", "#f1e3c8"]);
  planter2(-4.5, 7.8, [LEAVES.green, LEAVES.yellow], ["#f1e3c8", "#f6efe0"]);
  planter2(6.5, 7.8, [LEAVES.green, LEAVES.ochre, LEAVES.yellow]);
  planter2(26, 7.8, [LEAVES.green, LEAVES.green], ["#8a6ab8", "#a88ad0", "#6a4a98"]);
  bikes(-10, 4); bikes(9.5, 3);
  barrel(-12.5, 1.2); barrel(-11.8, 1.0); crate(-11.0, 1.1); crate(-11.0, 1.1, 0.7, produceTex(["#c83a2a", "#a82a20", "#d8a040"]));
  barrel(17.5, 1.1); crate(18.3, 1.0);
  planter(-22, 1.0); planter(3.5, 1.1); planter(24, 1.0);
  // cafe tables, the candles lit only when the cafe is
  const cafe = HX[5], cafeX = cafe.x + cafe.w / 2, cafeLid = cafe.f.holes.find((h) => h.kind === "shop").lid;
  const tableMat = std({ color: 0x1c1a18 }), candleMat = lidMat(std({ color: 0xfff0d0, emissive: 0xffc070, emissiveIntensity: 3 }));
  [[-1.6, 2.4], [0.6, 2.6]].forEach(([dx, z]) => {
    add(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12), tableMat, cafeX + dx, 0.75, z);
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 6), tableMat, cafeX + dx, 0.37, z);
    add(new THREE.BoxGeometry(0.42, 0.45, 0.42), benchMat, cafeX + dx - 0.7, 0.23, z);
    add(new THREE.BoxGeometry(0.42, 0.45, 0.42), benchMat, cafeX + dx + 0.7, 0.23, z);
    add(lidAttr(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), cafeLid), candleMat, cafeX + dx, 0.83, z, { noCast: true });
  });
  boat(-6, 10.6, true); boat(4.5, 10.6, false); boat(-25, 10.6, false);
  { const F = HX[2], cx = F.x + F.f.shop.x;                  // the flower shop's stall
    add(new THREE.BoxGeometry(2.2, 0.5, 0.55), std({ map: woodTex("#4a3220") }), cx, 0.25, F.zOff + 0.9);
    const stall = sprite(36, 16, (g) => { for (let x = 1; x < 34; x += 6) { R(g, x, 10, 5, 6, "#5a5a62"); R(g, x, 10, 5, 1, "#7a7a84"); const fc = pick(PAL.flowers); for (let k = 0; k < 22; k++) P(g, x + ri(-1, 5), ri(1, 10), rnd() < 0.6 ? fc : pick(PAL.leaf)); } });
    spriteAt(stall, 2.25, 1.0, cx, 1.0, F.zOff + 0.95, true); spriteAt(stall, 1.6, 0.72, cx + 0.2, 0.36, F.zOff + 1.55); }
  spriteAt(chalkTex, 0.6, 0.8, HX[5].door - 0.9, 0.4, HX[5].zOff + 0.9, true);
  { const B = HX[7]; spriteAt(bikeTex, 2.3, 1.38, B.x + B.f.shop.x - 0.3, 0.69, B.zOff + 1.1, true); }
  { const K = HX[9], cx = K.x + K.f.shop.x + 0.6, wood = std({ map: woodTex("#5a3a22") });
    const spines = sprite(16, 8, (g) => { for (let x = 0; x < 16; x++) R(g, x, ri(0, 2), 1, 8, pick(["#7a2a22", "#2a4a6a", "#5a6a3a", "#c8a060", "#d8d0c0"])); });
    add(new THREE.BoxGeometry(1.3, 0.75, 0.55), [wood, wood, std({ map: spines }), wood, wood, wood], cx, 0.6, K.zOff + 0.9);
    for (const dx of [-0.55, 0.55]) add(new THREE.BoxGeometry(0.06, 0.25, 0.06), ironMat, cx + dx, 0.12, K.zOff + 0.9); }
  { const x = 1.8, z = 7.35, green = std({ color: 0x26392c });  // an advertising column
    add(new THREE.CylinderGeometry(0.6, 0.62, 0.3, 16), green, x, 0.15, z); add(new THREE.CylinderGeometry(0.52, 0.52, 2.5, 16), std({ map: posterTex }), x, 1.55, z);
    add(new THREE.CylinderGeometry(0.64, 0.6, 0.16, 16), green, x, 2.88, z);
    const dome = add(new THREE.SphereGeometry(0.56, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), green, x, 2.95, z); dome.scale.y = 0.55;
    add(new THREE.SphereGeometry(0.07, 8, 6), std({ color: 0xc8a050 }), x, 3.32, z); }
  { const A = HX[6], Bh = HX[8], x0 = A.x + 0.4, x1 = Bh.x + Bh.w * 0.6, y0 = 4.95, z = 0.55, N = 30, pos = [], uv = [], idx = [];   // bunting
    let len = 0, prev = null;
    for (let k = 0; k <= N; k++) { const t = k / N, x = x0 + (x1 - x0) * t, y = y0 - Math.sin(t * Math.PI) * 0.5; if (prev) len += Math.hypot(x - prev[0], y - prev[1]); prev = [x, y];
      pos.push(x, y - 0.62, z, x, y, z); uv.push(len * 16 / 32, 0, len * 16 / 32, 1); if (k) { const i = k * 2; idx.push(i - 2, i, i - 1, i - 1, i, i + 1); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, std({ map: buntingTex, alphaTest: 0.5, side: THREE.DoubleSide })); m.castShadow = true; target.add(m);
    for (const [hx2, H2] of [[x0, A], [x1, Bh]]) add(new THREE.BoxGeometry(0.04, 0.04, z - H2.zOff), bracketMat, hx2, y0, (z + H2.zOff) / 2); }
  for (let k = 0; k < 7; k++) { const p2 = add(new THREE.PlaneGeometry(0.3, 0.4), paperMat, -24 + rnd() * 48, 0.012, 1.4 + rnd() * 6, { noCast: true }); p2.rotation.set(-Math.PI / 2, 0, rnd() * 6.28); }
  { const C = HX[5]; critter(catTex, 0.78, 0.62, C.x + 1.4, C.H - 0.04, C.zOff + 0.3, false, 1.7); }
  { const K = HX[9]; critter(pigeonTex, 0.44, 0.38, K.x + 2.0, K.H - 0.04, K.zOff + 0.35, false, 1.1); critter(pigeonTex, 0.44, 0.38, K.x + 2.6, K.H - 0.04, K.zOff + 0.35, true, 0.9); }
  [[2.6, 4.2, false], [3.1, 4.6, true], [3.7, 4.1, false], [-7.2, 5.4, true]].forEach(([x, z, fl]) => critter(pigeonTex, 0.44, 0.38, x, 0, z, fl, 0.45 + rnd() * 0.5));
  bench(4, 20.6, 0.3);
  // the people who live here
  addPerson({ x: cafeX - 2.3, z: 2.4, sit: true, cup: true, coat: "#2f4a3a", hairStyle: "curly", hair: "#1a1a1a" });
  addPerson({ x: cafeX + 1.3, z: 2.6, sit: true, cup: true, coat: "#c8a050", hat: "beanie", hatCol: "#3a5a7a", flip: true });
  addPerson({ x: -18.7, z: 3.0, talk: true, coat: "#4a3a2a", long: true, hat: "bowler", hatCol: "#1e1a18", beard: "#c8c4b8", cane: true, hairStyle: "bald", hair: "#c8c4b8" });
  addPerson({ x: -17.7, z: 3.0, talk: true, flip: true, coat: "#3a4a6a", hat: "scarf", hatCol: "#a83a4a", bread: true, long: true });
  addPerson({ x: -12.4, z: 2.2, broom: true, apron: true, coat: "#d8d0c4", hat: "baker", legs: "#3a3a40" });
  addPerson({ x: -6.9, z: 10.6, y: -1.0, sit: true, coat: "#4a3a5a", hat: "beanie", hatCol: "#2a4a3a" });
}

// ================================================================== people
const people = [];
const PH = 2.47, PW = PH * FW / FH;                          // drawn 1.3x: Octopath shrinks the world around its characters
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false });
function addPerson(opts) {
  const t = person(opts), walker = !!opts.speed, parent = walker ? scene : target;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), std({ map: t, alphaTest: 0.5, side: THREE.DoubleSide }));
  mesh.position.set(opts.x, PH / 2 + (opts.y || 0), opts.z); parent.add(mesh);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1, 0.55, 1); shadow.position.set(opts.x, 0.02 + (opts.y || 0), opts.z); parent.add(shadow);
  if (opts.dog) { opts.dogMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.62), std({ map: dogTex.clone(), alphaTest: 0.5, side: THREE.DoubleSide })); opts.dogMesh.position.set(opts.x + 1, 0.31, opts.z + 0.35); opts.dogMesh.material.map.needsUpdate = true; scene.add(opts.dogMesh); }
  people.push(Object.assign({ mesh, shadow, t, phase: rnd() * 10, home: opts.x }, opts));
}
function walkers() {                                         // they walk around wherever the camera is
  const W = [
    { speed: 1.15, z: 3.2, coat: "#3a5a4a", hairStyle: "long", hair: "#8a3a1e", scarf: "#b83a3a", bag: "#c8a070", legs: "#2a2228", blush: true },
    { speed: -0.95, z: 4.6, coat: "#6a4a2a", hat: "cap", hatCol: "#4a4a48", glasses: true, legs: "#2a2a34" },
    { speed: 1.0, z: 5.6, coat: "#7a2a32", long: true, hairStyle: "bun", hair: "#c9a35a", bouquet: true, tights: "#2a2028", blush: true },
    { speed: 0.8, z: 4.0, coat: "#d8a830", long: true, hairStyle: "ponytail", hair: "#2a1d14", lead: true, dog: true, legs: "#2a2a34" },
    { speed: -1.1, z: 2.6, coat: "#2a3a5a", hairStyle: "curly", hair: "#2a1d14", bag: "#5a3a2a" },
    { speed: 0.9, z: 6.2, coat: "#5a4a3a", hat: "beanie", hatCol: "#c86a3a", glasses: true, bread: true },
    { speed: -0.85, z: 21.2, coat: "#3a3a40", long: true, hairStyle: "bun", hair: "#5a3a1e", scarf: "#d8c8a0" }
  ];
  W.forEach((o, k) => addPerson(Object.assign({ x: -40 + k * 13 + rnd() * 6 }, o)));
}
const cycl = { x: -30, z: 6.4, speed: 4.2 };
let cycBike, cycRider, cycShadow;
function cyclist() {
  cycBike = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.5), bikeMat); cycBike.position.set(0, 0.75, cycl.z);
  cycRider = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), std({ map: person({ coat: "#4a5a3a", scarf: "#c86a3a", hairStyle: "short", hair: "#5a3a1e" }), alphaTest: 0.5, side: THREE.DoubleSide }));
  cycRider.position.set(0, 1.75, cycl.z);
  cycShadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 12), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false }));
  cycShadow.rotation.x = -Math.PI / 2; cycShadow.scale.set(1.3, 0.35, 1);
  scene.add(cycBike, cycRider, cycShadow);
}

// ================================================================== the loop of blocks
/* Five blocks, about 290 m, endlessly repeated as the camera drifts (each block is moved one loop ahead or
   behind when it's out of sight). The first is mockup H's street; the others hold the iconic buildings. */
function blockDefs() {
  return [
    { name: "home", houses: HOUSES, props: propsHome, tower: ["wester", 8, -58] },
    { name: "cross street", gap: "brick", w: 7.6 },
    { name: "heads", houses: [genHouse(), genHouse({ shop: SHOPS[0], w: 6.2 }), HEADS, genHouse(), genHouse(), TINY, genHouse(), genHouse(), genHouse({ w: 6.4, shop: SHOPS[2] }), genHouse()] },
    { name: "warehouses", houses: [genHouse(), WAREHOUSE({}), WAREHOUSE({ wall: "red", shutterCol: ["#a83a2a", "#e6dcc6"], w: 6.2, eave: 13.4 }), WAREHOUSE({ shutterCol: ["#1c2a3a", "#c8a040"], w: 7.0, eave: 14.6 }), genHouse(), genHouse({ shop: SHOPS[3], w: 6.2 }), genHouse(), genHouse()],
      houseboats: [[-14, 13, "#2f4a3a"], [3, 11, "#6a3a2a"], [17, 12, "#2a3a5a"]], tower: ["zuider", -6, -64] },
    { name: "cross street (Skinny Bridge)", gap: "skinny", w: 7.2 },
    { name: "golden bend", houses: [genHouse(), MANSION({}), MANSION({ wall: "cream", door: "blue", w: 11.2, eave: 13.8, frame: "#1c1c1c" }), genHouse({ gable: "cornice" }), genHouse(), genHouse({ shop: SHOPS[1], w: 6.4 }), genHouse()], tower: ["munt", 10, -48] },
    { name: "damrak", houses: [genHouse(), genHouse(), dancing(0), dancing(1), dancing(2), dancing(3), dancing(4), genHouse({ shop: SHOPS[4], w: 6.4 }), genHouse(), genHouse()], tower: ["oude", -12, -60] },
    { name: "tram street", gap: "brick", w: 7.6, tram: true }
  ];
}
const tick = () => new Promise((r) => setTimeout(r, 0));
async function buildBlock(def) {
  const g = new THREE.Group(); scene.add(g); target = g;
  const b = { group: g, def, H: [], lamps: [] }; curBlock = b; BLOCKS.push(b);
  b.w = def.gap ? def.w : def.houses.reduce((a, s) => a + s.w, 0);
  let hx = -b.w / 2;
  for (let i = 0; i < (def.houses || []).length; i++) { target = g; curBlock = b; b.H.push(buildHouse(def.houses[i], hx, i, i === 0 || i === def.houses.length - 1)); hx += def.houses[i].w; await tick(); }
  target = g; curBlock = b;
  b.bridges = [];
  ground(b);
  if (def.gap) buildCross(b, def);
  houseExtras(b);
  gardens(b); airBehind(b);
  if (def.tower) tower3d(def.tower[0], def.tower[1], def.tower[2]);
  if (def.gap) { /* the cross street's lamps are set */ }
  else if (def.props) def.props(b);
  else {
    const hb = def.houseboats || [];
    hb.forEach(([x, len, col]) => houseboat(x, len, col));
    const blocked = quayLife(b, { avoid: hb.map(([x, len]) => [x - len / 2, x + len / 2]), noBoats: false });
    streetProps(b, blocked);
    vignettes(b);
  }
  mergeBlock(b);
  target = scene; curBlock = null;
  await tick();
  return b;
}

/* Little groups of things where they'd be used (2026-10-28, from the Octopath comparison: props in vignettes, not spread
   evenly). One per shop or warehouse at most, so the street doesn't get crowded. Its own random sequence. */
const terraceMat = std({ color: 0x2a2622 }), chairMat = std({ map: woodTex("#5a3a22") });
function cafeTerrace(x, z) {
  for (const dx of [-1.15, 1.15]) {
    add(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 12), terraceMat, x + dx, 0.74, z);
    add(new THREE.CylinderGeometry(0.035, 0.05, 0.72, 6), terraceMat, x + dx, 0.36, z);
    for (const sd of [-1, 1]) { add(new THREE.BoxGeometry(0.38, 0.05, 0.38), chairMat, x + dx + sd * 0.55, 0.45, z); add(new THREE.BoxGeometry(0.05, 0.42, 0.38), chairMat, x + dx + sd * 0.74, 0.68, z); }
  }
}
function vignettes(b) {
  b.H.forEach((H) => {
    const s = H.s, shop = s.shop || null, name = shop ? shop.name || "" : "", sx = shop && H.f.shop ? H.x + H.f.shop.x : H.x + H.w / 2;
    if (s.warehouse) {                                       // goods by the cart door
      barrel(H.x + H.w * 0.2, H.zOff + 0.8); barrel(H.x + H.w * 0.2 + 0.72, H.zOff + 0.95);
      crate(H.x + H.w * 0.7, H.zOff + 0.85); crate(H.x + H.w * 0.7 + 0.74, H.zOff + 0.9); crate(H.x + H.w * 0.7 + 0.37, H.zOff + 0.88, 0.7);
    } else if (shop && (shop.display === "cafe" || /KOFFIE|PROEF/.test(name))) cafeTerrace(sx, H.zOff + 1.15);   // a café's two tables
    else if (shop && shop.display === "flowers") for (let k = 0; k < 4; k++) spriteAt(potTex, 0.62, 0.62, sx - 1.2 + k * 0.8 + rnd2b() * 0.2, 0.31, H.zOff + 0.75 + (k % 2) * 0.3);
    else if (shop && shop.display === "bikes") bikes(sx - 1.0, 3, H.zOff + 1.05);
    else if (shop && shop.display === "shelves") { crate(sx - 0.9, H.zOff + 0.85); crate(sx - 0.15, H.zOff + 0.9); barrel(sx + 0.75, H.zOff + 0.85); }
  });
}

/* Speed: everything that never moves is baked into one mesh per material, per block. Billboards, people, lamp heads,
   glow cones and bulbs stay separate. The light id ("lid") of each vertex rides along. */
function mergeBlock(b) {
  const g = b.group, keep = new Set(dynamic);
  billboards.forEach((o) => o.traverse((c) => keep.add(c)));
  people.forEach((p) => { keep.add(p.mesh); keep.add(p.shadow); });
  g.updateMatrixWorld(true);
  const buckets = new Map(), drop = [];
  g.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || keep.has(o) || o.material.isShaderMaterial) return;
    const g0 = o.geometry;
    if (!g0.attributes.position || !g0.attributes.normal || !g0.attributes.uv) return;
    const gg = g0.index ? g0.toNonIndexed() : g0, groups = gg.groups.length ? gg.groups : [{ start: 0, count: gg.attributes.position.count, materialIndex: 0 }];
    const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld), v = new THREE.Vector3(), LA = gg.attributes.lid;
    groups.forEach((gr) => {
      const mat = Array.isArray(o.material) ? o.material[gr.materialIndex] : o.material, key = mat.uuid + (o.castShadow ? "c" : "") + (o.receiveShadow ? "r" : "");
      if (!buckets.has(key)) buckets.set(key, { mat, cast: o.castShadow, recv: o.receiveShadow, pos: [], nor: [], uv: [], lid: [] });
      const bk = buckets.get(key), P3 = gg.attributes.position, N3 = gg.attributes.normal, U2 = gg.attributes.uv;
      for (let i = gr.start; i < gr.start + gr.count; i++) {
        v.fromBufferAttribute(P3, i).applyMatrix4(o.matrixWorld); bk.pos.push(v.x, v.y, v.z);
        v.fromBufferAttribute(N3, i).applyMatrix3(nm).normalize(); bk.nor.push(v.x, v.y, v.z);
        bk.uv.push(U2.getX(i), U2.getY(i)); bk.lid.push(LA ? LA.getX(i) : 0);
      }
    });
    drop.push(o);
  });
  drop.forEach((o) => o.parent.remove(o));
  buckets.forEach((bk) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(bk.pos, 3)); geo.setAttribute("normal", new THREE.Float32BufferAttribute(bk.nor, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(bk.uv, 2));
    if (bk.mat.userData.lid) geo.setAttribute("lid", new THREE.Float32BufferAttribute(bk.lid, 1));
    const m = new THREE.Mesh(geo, bk.mat); m.castShadow = bk.cast; m.receiveShadow = bk.recv; g.add(m);
  });
  // tidy: groups emptied by the merge (houses that leaned)
  const empty = []; g.traverse((o) => { if (o !== g && o.isGroup && !o.children.length) empty.push(o); }); empty.forEach((o) => o.parent && o.parent.remove(o));
  b.meshes = buckets.size;
}

// ================================================================== behind the street (2026-10-27, after Octopath's town shots)
/* In Octopath the background is never a cut-out: it's the same 3D town carrying on behind, blurred and hazy, with its
   own lights glowing through the blur. Here: the hidden gardens behind the canal houses (tree crowns, mist rising out of
   them, a few beams of moonlight), the next canals' rooftops (painted, hazy, some windows lit: he asked for that), and
   four real 3D church towers lit by the moon. */
const BACK_WALLS = ["#3e2c27", "#33302f", "#3c3431", "#2c303a", "#423629", "#3a2622"];
function backHouse(g, gg, x, bw, H, eave, gh, kind, wall, ppm, silhouette) {
  const rim = shade(wall, 0.12), dark = shade(wall, -0.1);
  for (let r = 0; r < eave + gh; r++) {
    let hw = bw / 2;
    if (r >= eave) { const gy = (r - eave) / gh;
      hw = kind === "step" ? bw / 2 * Math.max(0.2, 1 - Math.floor(gy * 4) * 0.25) : kind === "flat" ? (r < eave + 2 ? bw / 2 : 0) :
        kind === "spout" ? bw / 2 * (gy < 0.8 ? 1 - gy * 0.85 : 0.3) : bw / 2 * (gy < 0.4 ? 1 - gy * 1.4 : 0.42 * (1 - (gy - 0.4) * 1.2)); }
    if (hw < 0.5) continue;
    const y = H - 1 - r, x0 = Math.round(x + bw / 2 - hw), w2 = Math.round(hw * 2);
    R(g, x0, y, w2, 1, wall); P(g, x0 + w2 - 1, y, rim); P(g, x0, y, dark);
  }
  if (silhouette) return;                                   // (the far row: shapes only, since 2026-10-28)
  const cols = bw > 5 * ppm ? 3 : 2, fl = Math.max(2, Math.round(eave / (2.6 * ppm))), ww = Math.max(2, Math.round(ppm * 0.8)), wh = Math.max(2, Math.round(ppm * 1.3));
  for (let f = 0; f < fl; f++) for (let k = 0; k < cols; k++) {
    const wx = Math.round(x + bw * (k + 1) / (cols + 1) - ww / 2), wy = H - 1 - Math.round(ppm * 1.2 + f * eave / fl) - wh;
    if (rnd() < 0.05) { R(g, wx, wy, ww, wh, "#c89048"); R(gg, wx, wy, ww, wh, pick(PAL.lit)); }   // someone's home: always on, background only (his choice); 5% since 2026-10-28 (was 9%: too many discs)
    else { R(g, wx, wy, ww, wh, "#11131a"); if (rnd() < 0.25) P(g, wx + ww - 1, wy, "#4a5468"); }
  }
}
function backLayer(L, ppm, hM, o) {
  const W = Math.round(L * ppm), H = Math.round(hM * ppm), [c, g] = canvas(W, H), [gc, gg] = canvas(W, H);
  for (let x = 0; x < W;) { const bw = Math.round((4.2 + rnd() * 3.2) * ppm);
    backHouse(g, gg, x, bw, H, Math.round((o.eave + rnd() * o.eaveVar) * ppm), Math.round(3.6 * ppm), pick(["step", "bell", "neck", "flat", "spout", "bell"]), pick(BACK_WALLS), ppm, o.silhouette); x += bw; }
  // haze: the farther the row, the more it takes the night air's colour, warmer low down where the city's light is
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, o.haze[0]); gr.addColorStop(1, o.haze[1]);
  g.globalCompositeOperation = "source-atop"; g.globalAlpha = o.haze[2]; g.fillStyle = gr; g._c = null; g.fillRect(0, 0, W, H); g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  const t = tex(c), tg = tex(gc); t.wrapS = tg.wrapS = THREE.RepeatWrapping;
  return { map: t, glow: tg };
}
const layers = [];
/* The next canal's houses in real 3D (2026-10-28, he found the painted row flat with random lights; Octopath builds the
   next row back as simpler 3D in the same style, so the same moon and lamps light it, and lets the depth of field and haze
   soften it). We see their backs across the gardens: brick rear walls with rows of windows, under steep roofs, gables and
   flat-topped cornices against the sky. A few windows are lit where people would be (always on, scenery, his choice for
   the background; they never count as progress). Gaps line up with our cross streets, so those streets carry on into the
   haze. Built in chunks that follow the camera round the loop like the blocks. Own random sequence; the main one is put
   back after, so nothing on the street moves. */
const BACK3D = [];
let seed4 = 20261030;
const rnd4 = () => ((seed4 = (seed4 * 16807) % 2147483647) - 1) / 2147483646;
const pick4 = (a) => a[Math.floor(rnd4() * a.length)];
const BPX = 8, BACK_Z = -33;                                 // 8 px per metre (it's always blurred), the row's front line
const BACK_WALLS3 = ["#5a3226", "#4a3a30", "#553a2c", "#3e3a3a", "#5e4030", "#4a2c24", "#6a4a3a"];
function backChunk(houses, x0, x1) {                         // houses: [{x, w, eave, gh, kind, wall, lit:[...]}] (x relative to chunk centre)
  const cx = (x0 + x1) / 2, AWp = houses.reduce((a, h) => a + Math.round(h.w * BPX) + 2, 0), AHp = Math.round(Math.max(...houses.map((h) => h.eave + h.gh)) * BPX) + 2;
  const [c, g] = canvas(AWp, AHp), [ec, eg] = canvas(AWp, AHp); R(eg, 0, 0, AWp, AHp, "#000");
  const grp = new THREE.Group(); scene.add(grp); const keepTarget = target; target = grp;
  const pos = [], uv = [], idx = [];
  let ax = 0;
  houses.forEach((h) => {
    const wp = Math.round(h.w * BPX), ep = Math.round(h.eave * BPX), gp = Math.round(h.gh * BPX), hp = ep + gp, top = AHp - hp;
    const rim = shade(h.wall, 0.1), dark = shade(h.wall, -0.12), mort = shade(h.wall, -0.06);
    for (let r = 0; r < hp; r++) {                            // the rear wall and its gable, brick courses every 2 px
      let hw = wp / 2;
      if (r < gp) { const gy = 1 - r / gp;
        hw = h.kind === "step" ? wp / 2 * Math.max(0.22, 1 - Math.floor(gy * 4) * 0.26) : h.kind === "flat" ? (r > gp - 3 ? wp / 2 : 0) : h.kind === "neck" ? wp / 2 * (gy < 0.35 ? 1 - gy * 1.6 : 0.36) : wp / 2 * (1 - gy * 0.92); }
      if (hw < 0.5) continue;
      const x = Math.round(ax + wp / 2 - hw), w2 = Math.round(hw * 2), y = top + r;
      R(g, x, y, w2, 1, (y % 2) ? mort : h.wall); P(g, x, y, rim); P(g, x + w2 - 1, y, dark);
    }
    if (h.kind === "flat") { R(g, ax, top + gp - 3, wp, 2, "#8f877a"); R(g, ax, top + gp - 3, wp, 1, "#a49c8c"); }   // the cornice's stone edge
    const fl = Math.max(3, Math.round(h.eave / 2.8)), cols = h.w > 6 ? 3 : 2, ww = 6, wh = 9;
    for (let f = 0; f < fl; f++) for (let k = 0; k < cols; k++) {   // rear windows: white frames, dark glass; a few lit
      const wx = Math.round(ax + wp * (k + 1) / (cols + 1) - ww / 2), wy = AHp - Math.round(BPX * 1.2) - Math.round(f * h.eave / fl * BPX) - wh;
      const lit = h.lit.find((l) => l[0] === f && l[1] === k);
      R(g, wx - 1, wy - 1, ww + 2, wh + 2, "#cfc6b2"); R(g, wx + 2, wy, 1, wh, "#cfc6b2");
      if (lit) { const col = lit[2] ? "#a8b8e0" : pick4(PAL.lit); R(g, wx, wy, 2, wh, col); R(g, wx + 3, wy, 3, wh, col); R(eg, wx, wy, 2, wh, col); R(eg, wx + 3, wy, 3, wh, col); R(eg, wx + 2, wy, 1, wh, "#000"); }
      else { R(g, wx, wy, 2, wh, "#141820"); R(g, wx + 3, wy, 3, wh, "#141820"); P(g, wx + 4, wy + 1, "#4a5468"); }
    }
    const xl = h.x - h.w / 2, xr = h.x + h.w / 2, H = h.eave + h.gh, z = h.z;   // the wall as one plane (cut to its gable), in the atlas
    const i = pos.length / 3;
    pos.push(xl, 0, z, xr, 0, z, xr, H, z, xl, H, z);
    uv.push(ax / AWp, 0, (ax + wp) / AWp, 0, (ax + wp) / AWp, hp / AHp, ax / AWp, hp / AHp);
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    add(new THREE.BoxGeometry(h.w - 0.1, h.eave, 8), sideMat, h.x, h.eave / 2, z - 4.05, { noCast: true });   // the house behind it
    const kindR = pick4(["dark", "dark", "dark", "red", "slate"]), V = (x, y, zz) => new THREE.Vector3(x, y, zz);
    if (h.kind === "flat") {                                  // a ridge along the row
      const rt = h.eave + h.gh, rise = 2.4, zr = z - 3.2;
      quad(ROOF[kindR], V(xl, rt - 0.1, z - 0.1), V(xr, rt - 0.1, z - 0.1), V(xr, rt + rise, zr), V(xl, rt + rise, zr));
      quad(ROOF[kindR], V(xr, rt - 0.1, z - 8), V(xl, rt - 0.1, z - 8), V(xl, rt + rise, zr), V(xr, rt + rise, zr));
    } else {                                                  // behind a gable: the ridge runs back
      const ridge = h.eave + h.gh * 0.86, zb = z - 8;
      quad(ROOF[kindR], V(xl, h.eave, z - 0.05), V(xl, h.eave, zb), V(h.x, ridge, zb), V(h.x, ridge, z - 0.05));
      quad(ROOF[kindR], V(xr, h.eave, zb), V(xr, h.eave, z - 0.05), V(h.x, ridge, z - 0.05), V(h.x, ridge, zb));
    }
    if (rnd4() < 0.55) { const chx = h.x + (rnd4() < 0.5 ? -1 : 1) * h.w * 0.35, ct = h.eave + h.gh + 0.6;   // a chimney stack
      add(new THREE.BoxGeometry(0.6, ct - h.eave, 0.9), chimMat, chx, (h.eave + ct) / 2, z - 3 - rnd4() * 3, { noCast: true }); }
    ax += wp + 2;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const mat = std({ map: tex(c), emissiveMap: tex(ec), emissive: 0xffffff, emissiveIntensity: 1.6, alphaTest: 0.5 });
  add(geo, mat, 0, 0, 0, { noCast: true });
  target = keepTarget;
  const b = { group: grp, def: { name: "back row" }, H: [] }; mergeBlock(b);
  grp.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  BACK3D.push({ g: grp, cx, w: x1 - x0 });
}
function buildBack3D(L) {
  const gaps = BLOCKS.filter((b) => b.def.gap).map((b) => [b.cx - b.w / 2 - 0.3, b.cx + b.w / 2 + 0.3]);
  const inGap = (a, b2) => gaps.some(([g0, g1]) => b2 > g0 && a < g1);
  let x = 0, chunk = [], c0 = 0;
  const flush = (x1) => { if (chunk.length) { const cx = (c0 + x1) / 2; chunk.forEach((h) => { h.x -= cx; }); backChunk(chunk, c0, x1); } chunk = []; c0 = x1; };
  while (x < L - 3) {
    const w = +(4.4 + rnd4() * 3.0).toFixed(1);
    const g2 = gaps.find(([g0, g1]) => x + w > g0 && x < g1);
    if (g2) { flush(x); x = g2[1]; c0 = x; continue; }        // the cross street carries on here
    if (x + w > L) break;
    const eave = +(9.5 + rnd4() * 4.5).toFixed(1), kind = pick4(["spout", "spout", "flat", "flat", "step", "neck"]);
    const lit = [], r = rnd4(), fl = Math.max(3, Math.round(eave / 2.8)), cols = w > 6 ? 3 : 2;   // someone home, in believable places
    if (r < 0.32) lit.push([Math.floor(rnd4() * Math.min(2, fl)), Math.floor(rnd4() * cols), rnd4() < 0.12]);
    else if (r < 0.42) { const f = Math.floor(rnd4() * fl); for (let k = 0; k < cols; k++) lit.push([f, k, false]); }
    chunk.push({ x: x + w / 2, w, eave, gh: kind === "flat" ? 1.0 : 3.2 + rnd4() * 1.4, kind, wall: pick4(BACK_WALLS3), lit, z: BACK_Z - rnd4() * 1.4 });
    x += w;
    if (x - c0 > 38) flush(x);
  }
  flush(Math.min(x, L));
}
function buildBackground(L) {
  const seedWas = seed;
  buildBack3D(L);
  // (a far painted silhouette row was tried and removed: Octopath has nothing like it, he said)
  seed = seedWas;
}

// ---------------------------------------------------------------- the gardens behind the houses: tree crowns (autumn: it's October)
const TREE_SETS = [];
function gardenTree(x, z, s, hide) {
  if (TREE_SETS.length < 8) {
    const mix = [[LEAVES.green, LEAVES.green, LEAVES.yellow], [LEAVES.green, LEAVES.ochre], [LEAVES.yellow, LEAVES.green], [LEAVES.green, LEAVES.green]][TREE_SETS.length % 4];
    const t = treeSprites(mix), mat = (map) => std({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.12, alphaTest: 0.5, side: THREE.DoubleSide });
    TREE_SETS.push({ back: mat(t.back), front: mat(t.front) });
  }
  const set = TREE_SETS[ri(0, TREE_SETS.length - 1)], w = TW / PX * s, h = TH / PX * s;
  if (hide) return;                                          // not built, but drawn from the sequence all the same, so nothing else moves
  add(new THREE.PlaneGeometry(w, h), set.back, x, h / 2, z - 0.6);
  add(new THREE.PlaneGeometry(w, h), set.front, x, h / 2, z);
}
function gardens(b) {
  // none in a cross street's square, which reaches 5.6 m into the blocks on either side
  for (let x = -b.w / 2 + 1 + rnd() * 3; x < b.w / 2 - 1; x += 4 + rnd() * 4) if (rnd() < 0.85) gardenTree(x, -13 - rnd() * 10, 0.9 + rnd() * 0.4, !!b.def.gap || Math.abs(x) > b.w / 2 - 7.5);
}

// ---------------------------------------------------------------- mist rising out of the gardens, and beams of moonlight
const gardenMist = new THREE.MeshBasicMaterial({ map: mistTex2(), color: 0x7a88a8, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
// moonbeams (he likes Octopath's, 2026-10-28): broad soft shafts, brightest high up, fading out before they reach the ground
const beamTex = sprite(16, 64, (g) => { for (let y = 0; y < 64; y++) for (let x = 0; x < 16; x++) { const a = Math.pow(Math.sin((x + 0.5) / 16 * Math.PI), 1.6) * Math.min(1, y / 8) * (0.3 + 0.7 * Math.pow(1 - y / 64, 1.2)); g.fillStyle = `rgba(255,255,255,${(a * 0.9).toFixed(3)})`; g._c = null; g.fillRect(x, y, 1, 1); } });   // brightest high up, still faintly there at the street
beamTex.magFilter = beamTex.minFilter = THREE.LinearFilter;
const moonBeamMat = new THREE.MeshBasicMaterial({ map: beamTex, color: 0xb4bcd4, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
const streetBeamMat = moonBeamMat.clone(); streetBeamMat.opacity = 0.1;
const speckMat = new THREE.ShaderMaterial({                  // each speck sinks slowly along its beam and sways a little; brightest mid-beam
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { time: { value: 0 }, amp: { value: 1 } },
  vertexShader: `attribute vec3 par; uniform float time, amp; varying float vA;
    void main(){
      float h = 12.0, v = mod(par.y - time * 0.12 + h, 2.0 * h) - h, u = par.x + sin(time * 0.31 + par.z) * 0.25;
      float c = cos(0.42), s = sin(0.42);
      vec3 p = position + vec3(u * c - v * s, u * s + v * c, 0.0);
      vA = amp * (1.0 - smoothstep(0.6, 1.0, abs(v) / h)) * (0.55 + 0.45 * sin(time * 0.9 + par.z * 3.0));
      gl_PointSize = 2.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(vec3(0.85, 0.85, 0.8) * vA * 0.55, 1.0); }`
});
function mistTex2() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d");
  for (let i = 0; i < 40; i++) { const x = rnd() * 256, y = 20 + rnd() * 30, r = 16 + rnd() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 64); }
  const fade = g.createLinearGradient(0, 0, 0, 64); fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(0.45, "rgba(0,0,0,1)"); fade.addColorStop(0.8, "rgba(0,0,0,1)"); fade.addColorStop(1, "rgba(0,0,0,0)");
  g.globalCompositeOperation = "destination-in"; g.fillStyle = fade; g.fillRect(0, 0, 256, 64);   // no hard top or bottom edge
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
}
function airBehind(b) {
  for (let k = 0; k < 2; k++) { const m = add(new THREE.PlaneGeometry(b.w + 2, 7), gardenMist, 0, 4.5 + k * 2.5, -15 - k * 6, { noCast: true }); m.receiveShadow = false; }
  const beam = (x, w, z) => { const h = 34, m = add(new THREE.PlaneGeometry(w, h), moonBeamMat, x, h / 2 + 1, -11 + (z + 12) * 0.25, { noCast: true }); m.rotation.z = 0.42; m.receiveShadow = false; };   // in front of the garden trees, just behind the houses
  for (let x = -b.w / 2 + 6 + rnd() * 8; x < b.w / 2 - 4; x += 18 + rnd() * 14) beam(x, (2.2 + rnd() * 2) * 2.4, -12 - rnd() * 8);   // moonlight slanting down from the upper right (where the moon is)
  for (let x = -b.w / 2 + 3 + rnd2() * 10; x < b.w / 2 - 3; x += 14 + rnd2() * 12) if (rnd2() < 0.6) beam(x, 3 + rnd2() * 5, -16 - rnd2() * 10);   // more, from their own random sequence
  // and the ones you see: shafts falling through the air over the street, as in Octopath's night scenes
  const sp = [];                                             // specks of dust drifting down inside them (C's floating motes)
  for (let x = -b.w / 2 + 4 + rnd2() * 12; x < b.w / 2 - 2; x += 22 + rnd2() * 16) {
    const h = 30, w = 6 + rnd2() * 4, z = 1.5 + rnd2() * 2.5, m = add(new THREE.PlaneGeometry(w, h), streetBeamMat, x, h / 2 - 0.5, z, { noCast: true });
    m.rotation.z = 0.42; m.receiveShadow = false;
    for (let i = 0; i < 26; i++) sp.push(x, h / 2 - 0.5, z, (rnd2() - 0.5) * w * 0.7, (rnd2() - 0.5) * h * 0.8, rnd2() * 100);
  }
  if (sp.length) {
    const n = sp.length / 6, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), par = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos.set(sp.slice(i * 6, i * 6 + 3), i * 3); par.set(sp.slice(i * 6 + 3, i * 6 + 6), i * 3); }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("par", new THREE.BufferAttribute(par, 3));
    const pts = new THREE.Points(geo, speckMat); pts.frustumCulled = false; target.add(pts);
  }
}

// ---------------------------------------------------------------- church towers, built in 3D and lit by the moon
const towerBrick = (() => { const [c, g] = canvas(32, 32); bricks(g, 0, 0, 32, 32, PAL.brown, PAL.mortarBrown); return std({ map: tex(c, [2, 8]) }); })();
const towerStone = std({ map: (() => { const [c, g] = canvas(16, 16); R(g, 0, 0, 16, 16, "#8f877a"); for (let y = 0; y < 16; y += 4) R(g, 0, y, 16, 1, "#6e675c"); for (let i = 0; i < 40; i++) P(g, ri(0, 15), ri(0, 15), pick(["#a39b8c", "#857d70", "#9a9284"])); return tex(c, [3, 3]); })() });
const towerBlue = std({ color: 0x33507a }), towerGold = std({ color: 0xa8894a }), towerGreen = std({ color: 0x3e6a5e }), towerSlate = std({ color: 0x3a3c48 });
const clockTex = sprite(16, 16, (g) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 7.5) P(g, x, y, d > 6.4 ? "#c8a050" : "#e8dcc0"); } R(g, 7, 3, 2, 5, "#1a1c24"); R(g, 7, 7, 4, 2, "#1a1c24"); });
const clockMat = std({ map: clockTex, emissiveMap: clockTex, emissive: 0xffffff, emissiveIntensity: 0.5, alphaTest: 0.5 });   // the clock faces are lit at night
[towerBrick, towerStone, towerBlue, towerGold, towerGreen, towerSlate, clockMat].forEach((m) => { m.fog = false; });   // the towers stand out of the haze, lit by the moon
function tower3d(kind, tx, tz) {
  /* scaled like a stage set (Octopath shrinks its landmarks): at this low camera the top of the view reaches only ~25 m
     that far back, so each tower is made small enough for its crown to show over the back rows */
  const grp = new THREE.Group(), outer = target, sc = { wester: 0.47, zuider: 0.48, munt: 0.7, oude: 0.5 }[kind];
  grp.position.set(tx, -1, tz); grp.scale.setScalar(sc); target.add(grp); target = grp;
  const x = 0, z = 0;
  const box = (w, y0, h, m) => add(new THREE.BoxGeometry(w, h, w), m, x, y0 + h / 2, z, { noCast: true });
  const oct = (r, y0, h, m) => { const o = add(new THREE.CylinderGeometry(r, r, h, 8), m, x, y0 + h / 2, z, { noCast: true }); o.rotation.y = Math.PI / 8; };
  const cone = (r, y0, h, m) => add(new THREE.ConeGeometry(r, h, 8), m, x, y0 + h / 2, z, { noCast: true });
  const lathe = (pts, y0, m) => add(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 16), m, x, y0, z, { noCast: true });
  const clock = (y, w, s) => add(new THREE.PlaneGeometry(s, s), clockMat, x, y, z + w / 2 + 0.02, { noCast: true });
  if (kind === "wester") {                                   // the Westertoren: brick, stone stages, the blue imperial crown
    box(7, 0, 30, towerBrick); box(6.4, 30, 1.2, towerStone); box(5.6, 31.2, 8, towerStone); clock(35, 5.6, 2.6);
    oct(2.8, 39.2, 6, towerStone); oct(2.1, 45.2, 4.5, towerSlate);
    lathe([[0.01, 0], [2.2, 0], [2.4, 0.6], [2.1, 1.6], [1.2, 2.6], [0.4, 3.0], [0.01, 3.1]], 49.7, towerBlue);
    lathe([[2.25, 0], [2.45, 0], [2.45, 0.35], [2.25, 0.35]], 49.8, towerGold); cone(0.3, 52.8, 3.2, towerGold);
  } else if (kind === "zuider") {                            // the Zuiderkerk: square tower, an octagon, a clock stage, onion and spire
    box(7.5, 0, 24, towerBrick); box(6.2, 24, 7, towerStone); oct(2.8, 31, 6, towerStone); box(4.4, 37, 4.5, towerSlate); clock(39.2, 4.4, 2.2);
    lathe([[0.01, 0], [1.9, 0], [2.3, 1.2], [1.6, 2.6], [0.5, 3.2], [0.01, 3.3]], 41.5, towerGreen); cone(0.8, 44.6, 10, towerGreen);
  } else if (kind === "munt") {                              // the Munttoren: a clock tower with an open lantern and a spire
    box(6, 0, 12, towerBrick); clock(10, 6, 2.4); oct(2.3, 12, 4.5, towerStone); oct(1.5, 16.5, 4, towerSlate);
    lathe([[0.01, 0], [1.6, 0], [1.8, 0.8], [1.0, 1.8], [0.01, 2.0]], 20.5, towerGreen); cone(0.7, 22.3, 7, towerGreen); add(new THREE.SphereGeometry(0.3, 8, 6), towerGold, x, 29.6, z, { noCast: true });
  } else {                                                   // the Oude Kerk's tower
    box(7, 0, 26, towerBrick); box(5.4, 26, 6, towerStone); clock(29, 5.4, 2.4); oct(2.2, 32, 4.5, towerSlate); cone(1.9, 36.5, 13, towerSlate);
  }
  target = outer;
}

// ---------------------------------------------------------------- cross streets: a gap in the row, the street running back, a bridge over the canal
/* 2026-10-28: he found the old ones went "into nothingness". As in Octopath's towns, the street now goes somewhere: house
   walls with windows line it, and it opens 15 m back into a small square with a lamp, a lit café and people, blurred by
   the depth of field. The square's lamp and windows are always on (his choice, like the back rows); they are not
   applications. The square stops short of the painted back rows (z -32). */
const SQ = { z0: -15, z1: -27.5, half: 9 };
function wallTex(len, hM, litP, o = {}) {                    // a painted brick wall with windows; some always lit (scenery, not applications)
  const W = Math.round(len * PX), H = Math.round(hM * PX), [c, g] = canvas(W, H), [ec, eg] = canvas(W, H);
  R(eg, 0, 0, W, H, "#000");
  const wall = o.wall || pick2(BACK_WALLS);
  R(g, 0, 0, W, H, wall);
  for (let y = 0; y < H; y += 4) { R(g, 0, y + 3, W, 1, shade(wall, -0.05)); for (let x = (y / 4) % 2 * 4; x < W; x += 8) { R(g, x, y, 1, 3, shade(wall, -0.04)); if (rnd2() < 0.2) R(g, x + 1, y, 7, 3, shade(wall, (rnd2() - 0.5) * 0.04)); } }
  const fl = Math.max(2, Math.floor((hM - 1) / 2.7));
  for (let f2 = 0; f2 < fl; f2++) for (let x = Math.round(PX * 1.1); x < W - PX; x += Math.round(PX * (1.9 + rnd2() * 0.6))) {
    const wy = H - Math.round(PX * (1.2 + f2 * 2.7)) - 22, lit = rnd2() < litP;
    R(g, x - 1, wy - 1, 14, 24, "#d8d0c0"); R(g, x, wy, 12, 22, lit ? "#e0a050" : "#10131a"); R(g, x + 5, wy, 2, 22, "#d8d0c0"); R(g, x, wy + 10, 12, 2, "#d8d0c0");
    if (lit) { R(eg, x, wy, 12, 22, pick2(PAL.lit)); R(eg, x + 5, wy, 2, 22, "#000"); R(eg, x, wy + 10, 12, 2, "#000"); }
    else if (rnd2() < 0.3) P(g, x + 1, wy + 1, "#4a5468");
  }
  if (o.cafe) {                                              // the café: a long lit window, a dark door, its name over the top
    const cw = Math.round(o.cafe[1] * PX), cx = Math.round(o.cafe[0] * PX), top = H - Math.round(PX * 2.9);
    R(g, cx - 2, top - 8, cw + 4, H - top + 8, "#3a1a14"); R(g, cx, top, cw, H - top - 4, "#f0b860"); R(eg, cx, top, cw, H - top - 4, "#ffc070");
    for (let x = cx + 10; x < cx + cw - 4; x += 12) { R(g, x, top, 1, H - top - 4, "#3a1a14"); R(eg, x, top, 1, H - top - 4, "#000"); }
    for (let x = cx + 6; x < cx + cw - 6; x += 9) { R(g, x, H - 14, 6, 6, "#5a2a18"); R(eg, x, H - 14, 6, 6, "#000"); }   // people at the window
  }
  return { map: tex(c), glow: tex(ec) };
}
let seed3 = 20261029;
const rnd2b = () => ((seed3 = (seed3 * 16807) % 2147483647) - 1) / 2147483646;
const pick2 = (a) => a[Math.floor(rnd2b() * a.length)];
function wallBox(x, z, len, hM, rotY, o) {                   // a house wall facing +z before rotation, 0.4 m thick
  const t = wallTex(len, hM, o.litP, o), mat = std({ map: t.map, emissiveMap: t.glow, emissive: 0xffffff, emissiveIntensity: 1.1 });
  const m = add(new THREE.BoxGeometry(len, hM, 0.4), [sideMat, sideMat, sideMat, sideMat, mat, sideMat], x, hM / 2, z);
  m.rotation.y = rotY;
  add(new THREE.BoxGeometry(len + 0.3, 0.25, 0.7), trimMat, x, hM + 0.12, z).rotation.y = rotY;   // a cornice line along the top
  return m;
}
const squareLamp = (() => ({
  post: std({ map: lampArt.post.map, alphaTest: 0.5, side: THREE.DoubleSide }),
  head: std({ map: lampArt.head.map, emissiveMap: lampArt.head.em, emissive: 0xffffff, emissiveIntensity: 2.4, alphaTest: 0.5, side: THREE.DoubleSide })
}))();
const poolTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,190,120,0.9)"); gr.addColorStop(0.5, "rgba(255,160,90,0.3)"); gr.addColorStop(1, "rgba(255,150,80,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x9a7050 });
/* The tram street (2026-10-28, he asked for a long street with a tram instead of another square): like the Leidsestraat,
   a narrow street of houses with a double tram track that crosses the canal on the bridge. Every ~84 s a lit tram rolls
   slowly down it toward us, over the bridge and out of the frame; half a cycle later one goes back up it and away. The
   tram's lit windows are scenery, like the lit square (they never count as progress). Nothing here uses the main random
   sequence.
   The tram is GVB's Siemens Combino on line 2 (from a photo at the Prinsengracht, Wikimedia Commons): white body, bright
   blue skirt, a thin blue pinstripe and a blue sweep behind the cab, big windows on black pillars, double glass doors,
   a big windscreen under an amber destination sign, round headlamps, equipment boxes on the roof. Drawn as pixel art at
   the street's 16 px per metre on every face, shaded like the houses (lit top edges, dark bottom edges), per his
   "must match octopath design standards". */
const TRAM_TRACK = 1.55, TRAM_W = 2.35, TRAM_Y0 = 0.28, TRAM_H = 3.0;
const TS = [["front", 5.6], ["mid", 3.4], ["rear", 5.6]], TJ = 0.35;   // sections (front cab first) and the joints between them
const TRAM_LEN = TS.reduce((a, s) => a + s[1], 0) + TJ * (TS.length - 1);
const TC = { white: "#e6e4de", whiteHi: "#f6f5f1", whiteLo: "#bdbab2", blue: "#2266cc", blueHi: "#4a8ae0", blueLo: "#163f8a", black: "#121418",
  glass: ["#1a2330", "#1e2836", "#16202b"], glassHi: "#5a6e88", lit: ["#f4cf8c", "#eebe76", "#e2a85e", "#d4964e"], seat: "#6a3a28", amber: "#f0a830" };
function tramSide(lenM, kind) {                              // one side of a section, its front end at the left
  const W = Math.round(lenM * PX), H = Math.round(TRAM_H * PX), [c, g] = canvas(W, H), [ec, eg] = canvas(W, H); R(eg, 0, 0, W, H, "#000");
  R(g, 0, 0, W, 5, TC.white); R(g, 0, 0, W, 1, TC.whiteHi); R(g, 0, 4, W, 1, TC.whiteLo);              // roof edge
  R(g, 0, 5, W, 5, TC.white); R(g, 0, 7, W, 1, TC.blue);                                                   // upper band, pinstripe
  R(g, 0, 10, W, 21, TC.black);                                                                            // the window band
  R(g, 0, 31, W, 3, TC.white); R(g, 0, 31, W, 1, TC.whiteHi);
  R(g, 0, 34, W, 11, TC.blue); R(g, 0, 34, W, 1, TC.blueHi); R(g, 0, 43, W, 2, TC.blueLo);                // the blue skirt
  R(g, 0, 45, W, 3, "#0b0c0f");                                                                            // under it: shadow, bogies
  const doorAt = kind === "mid" ? [Math.round(W / 2 - 11)] : kind === "front" ? [W - 30] : [8];
  const glassPane = (x, y, w, h, lit) => {                   // glass: dark by day; lit, a warm interior with seats and people
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const day = (xx - yy === 2 || xx - yy === 3) && yy < h * 0.5 ? TC.glassHi : TC.glass[(xx + yy * 3) % 3];
      P(g, x + xx, y + yy, day);
      if (lit) { const col = yy > h - 6 ? TC.seat : TC.lit[Math.min(3, Math.floor(yy / h * 4))]; P(eg, x + xx, y + yy, col); }
    }
  };
  let x = 2;
  while (x < W - 4) {                                        // windows between 2-px pillars, doors where they go
    const d = doorAt.find((dx) => x >= dx - 2 && x < dx + 22);
    if (d !== undefined) {
      R(g, d - 1, 9, 24, 37, TC.black); glassPane(d, 10, 10, 31, true); glassPane(d + 12, 10, 10, 31, true);   // a double glass door
      R(g, d, 41, 22, 4, TC.blue); R(g, d + 10, 10, 2, 35, "#0a0b0d"); P(g, d + 4, 25, "#d0d0d0"); P(g, d + 17, 25, "#d0d0d0");   // handles
      R(eg, d + 10, 10, 2, 31, "#000");
      x = d + 24; continue;
    }
    const w = Math.min(18, W - 4 - x); if (w < 6) break;
    glassPane(x, 11, w, 19, true);
    for (const h of [1, 0]) { const hx = x + 3 + Math.floor(rnd2b() * (w - 6)); if (rnd2b() < 0.55) {   // a passenger's head and shoulders
      const hc = ["#3a2418", "#c9a35a", "#1a1a1a", "#8a3a1e"][Math.floor(rnd2b() * 4)], sc = ["#3a4a6a", "#6a2e2a", "#2f4a3a", "#5a4a3a"][Math.floor(rnd2b() * 4)];
      R(g, hx - 1, 22 - h, 4, 3, "#2a2020"); R(eg, hx - 1, 22 - h, 4, 3, "#3a2a20"); R(eg, hx, 19 - h, 2, 3, hc); R(eg, hx - 1, 24 - h, 4, 4, sc); } }
    x += w + 2;
  }
  if (kind === "front") for (let k = 0; k < 26; k++) { const y = 33 - Math.round(k * 0.75); R(g, 1 + k, y, 3, 1, TC.blue); }   // the blue sweep behind the cab
  for (let px = 0; px < W; px += 16) { R(g, px, 34, 1, 11, TC.blueLo); P(g, px + 3, 36, TC.blueHi); }      // panel joints in the skirt
  for (const wx of [Math.round(W * 0.2), Math.round(W * 0.8)]) for (const sx of [-6, 6]) R(g, wx + sx - 2, 45, 4, 3, "#26282c");   // wheels
  R(g, 0, 0, 1, H, TC.whiteLo); R(g, W - 1, 0, 1, H, TC.whiteLo);
  const m = tex(c), e = tex(ec);
  return { map: m, em: e, c, ec };
}
function tramEnd(rear) {                                     // the front (or the back) of the tram
  const W = Math.round(TRAM_W * PX), H = Math.round(TRAM_H * PX), [c, g] = canvas(W, H), [ec, eg] = canvas(W, H); R(eg, 0, 0, W, H, "#000");
  R(g, 0, 0, W, H, TC.white); R(g, 0, 0, W, 1, TC.whiteHi);
  R(g, 2, 3, W - 4, 7, TC.black);                                                                          // destination sign: "2 SLOTEN"
  const amb = (x, y) => { P(g, x, y, TC.amber); P(eg, x, y, TC.amber); };
  [[0, 0], [1, 0], [2, 0], [2, 1], [0, 2], [1, 2], [2, 2], [0, 3], [0, 4], [1, 4], [2, 4]].forEach(([dx, dy]) => amb(4 + dx, 4 + dy));
  pixelText(g, "SLOTEN", 10, 4, TC.amber); pixelText(eg, "SLOTEN", 10, 4, TC.amber);
  R(g, 1, 11, W - 2, 19, TC.black);                                                                        // the windscreen
  for (let yy = 0; yy < 17; yy++) for (let xx = 0; xx < W - 4; xx++) P(g, 2 + xx, 12 + yy, (xx - yy > 4 && xx - yy < 8 && yy < 12) ? TC.glassHi : TC.glass[(xx * 2 + yy) % 3]);
  if (!rear) { R(g, 26, 22, 5, 5, "#2a2020"); R(g, 27, 20, 3, 3, "#c9a35a"); }                             // the driver
  R(g, 0, 30, W, 4, TC.white); R(g, Math.round(W / 2) - 3, 31, 6, 2, TC.blue);                            // GVB mark
  R(g, 0, 34, W, 10, TC.blue); R(g, 0, 34, W, 1, TC.blueHi); R(g, 0, 42, W, 2, TC.blueLo);
  for (const lx of [3, W - 7]) {                             // round lamps: white headlamps at the front, red at the back
    const col = rear ? "#d02818" : "#fff6e0";
    R(g, lx, 36, 4, 3, col); R(g, lx + 1, 35, 2, 5, col); R(eg, lx, 36, 4, 3, col); R(eg, lx + 1, 35, 2, 5, col);
    P(g, lx + 5, 37, rear ? "#7a1a10" : TC.amber); P(eg, lx + 5, 37, rear ? "#5a1008" : TC.amber);
  }
  R(g, 0, 44, W, 4, "#0b0c0f"); R(g, Math.round(W / 2) - 3, 44, 6, 2, "#2a2c30");                           // bumper, coupler cover
  return { map: tex(c), em: tex(ec) };
}
function tramRoof(lenM) {
  const W = Math.round(TRAM_W * PX), H = Math.round(lenM * PX), [c, g] = canvas(W, H);
  R(g, 0, 0, W, H, "#d4d2cb"); R(g, 0, 0, 2, H, TC.whiteHi); R(g, W - 2, 0, 2, H, TC.whiteLo);
  for (let y = 0; y < H; y += 12) { R(g, 0, y, W, 1, "#a9a7a0"); for (const x of [4, W - 5]) P(g, x, y + 3, "#8f8d87"); }   // panel seams, rivets
  return tex(c);
}
const ribTex = sprite(8, 16, (g) => { R(g, 0, 0, 8, 16, "#1a1b1e"); for (let x = 0; x < 8; x += 2) R(g, x, 0, 1, 16, "#2c2e33"); });
const boxTex = sprite(16, 8, (g) => { R(g, 0, 0, 16, 8, "#cfcdc6"); R(g, 0, 0, 16, 1, TC.whiteHi); R(g, 0, 7, 16, 1, TC.whiteLo); for (let x = 2; x < 14; x += 2) R(g, x, 3, 1, 3, "#5a5c62"); });
const TRAM_ART = (() => {                                    // drawn once, shared by every tram
  const sides = {}; TS.forEach(([k, len]) => { sides[k] = tramSide(len, k); });
  const lam = (map, em, mirror) => {
    const m2 = mirror ? map.clone() : map, e2 = mirror ? em.clone() : em;
    if (mirror) for (const t of [m2, e2]) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; t.needsUpdate = true; }
    return std({ map: m2, emissiveMap: e2, emissive: 0xffffff, emissiveIntensity: 1.25 });
  };
  const out = {};
  TS.forEach(([k, len]) => { out[k] = { right: lam(sides[k].map, sides[k].em, false), left: lam(sides[k].map, sides[k].em, true), roof: std({ map: tramRoof(len) }) }; });
  const fr = tramEnd(false), bk = tramEnd(true);
  out.frontFace = lam(fr.map, fr.em, false); out.backFace = lam(bk.map, bk.em, false);
  out.under = std({ color: 0x0b0c0f }); out.rib = std({ map: ribTex }); out.box = std({ map: boxTex });
  return out;
})();
function makeTram() {
  const g = new THREE.Group(), A = TRAM_ART, y = TRAM_Y0 + TRAM_H / 2;
  let z = TRAM_LEN / 2;                                      // the front end faces +z
  TS.forEach(([k, len], i) => {
    const zc = z - len / 2, mats = [A[k].right, A[k].left, A[k].roof, A.under, i === 0 ? A.frontFace : A.under, i === TS.length - 1 ? A.backFace : A.under];
    const body = new THREE.Mesh(new THREE.BoxGeometry(TRAM_W, TRAM_H, len), mats); body.position.set(0, y, zc); body.castShadow = body.receiveShadow = true; g.add(body);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.32, Math.min(2.4, len - 0.8)), A.box); box.position.set(0, TRAM_Y0 + TRAM_H + 0.16, zc); box.castShadow = true; g.add(box);   // roof equipment
    z -= len;
    if (i < TS.length - 1) { const j = new THREE.Mesh(new THREE.BoxGeometry(TRAM_W - 0.25, TRAM_H - 0.3, TJ), A.rib); j.position.set(0, y, z - TJ / 2); g.add(j); z -= TJ; }
  });
  for (const sx of [-1, 1]) {                                // mirrors on short stalks by the cab
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.05), A.under); st.position.set(sx * (TRAM_W / 2 + 0.12), 2.55, TRAM_LEN / 2 - 0.25); g.add(st);
    const mi = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.18), A.under); mi.position.set(sx * (TRAM_W / 2 + 0.26), 2.45, TRAM_LEN / 2 - 0.25); g.add(mi);
  }
  const pan = new THREE.Group(); pan.position.set(0, TRAM_Y0 + TRAM_H + 0.32, TRAM_LEN / 2 - 4.2); g.add(pan);   // a single-arm pantograph up to the wire
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.7), A.under); lower.position.set(0, 0.55, 0.7); lower.rotation.x = 0.62; pan.add(lower);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.8), A.under); upper.position.set(0, 1.85, 0.75); upper.rotation.x = -0.75; pan.add(upper);
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.1), A.under); shoe.position.set(0, 2.5, 0.05); pan.add(shoe);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(TRAM_W + 0.6, TRAM_LEN + 0.6), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; g.add(sh);
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5), new THREE.MeshBasicMaterial({ map: poolTex, color: 0x7a7468, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0.04, TRAM_LEN / 2 + 2.4); g.add(beam);   // its headlamps on the cobbles ahead
  g.traverse((o) => { if (o.isMesh) dynamic.push(o); });     // it moves: the block merge must leave it alone
  return g;
}
/* (later: "the tram goes to nowhere") The street now carries on through the gap in the row behind, lit, to a café at a
   T-junction 64 m back, where the tram turns out of sight; halfway down there's a GVB stop where it waits ~8 s each way. */
const shelterGlass = std({ color: 0x2a3440, emissive: 0x1a2430, emissiveIntensity: 0.6 });
const stopSign = sprite(8, 12, (g) => { R(g, 0, 0, 8, 12, "#1d3a78"); R(g, 1, 1, 6, 6, "#e6e4de"); R(g, 3, 2, 2, 1, "#1d3a78"); R(g, 4, 3, 1, 1, "#1d3a78"); R(g, 3, 4, 1, 1, "#1d3a78"); R(g, 3, 5, 2, 1, "#1d3a78"); R(g, 1, 8, 6, 3, "#f0a830"); });   // a "2" on white, an amber timetable light
const stopSignMat = std({ map: stopSign, emissiveMap: stopSign, emissive: 0xffffff, emissiveIntensity: 0.9 });
function tramStreet(b, bridge) {
  const hw = b.w / 2, zFar = -31, zEnd = -64, STOP = -10;
  for (const sd of [-1, 1]) wallBox(sd * (hw - 0.2), -0.5 - (-zFar - 0.5) / 2, -zFar - 0.5, 9.8, sd * -Math.PI / 2, { litP: 0.14 });   // houses all the way along
  for (const sd of [-1, 1]) wallBox(sd * (hw - 0.2), (zFar + zEnd) / 2, zFar - zEnd, 10.6, sd * -Math.PI / 2, { litP: 0.3 });   // and on through the row behind
  const far = add(new THREE.PlaneGeometry(b.w + 0.4, -zEnd + 3), std({ color: 0x24221f }), 0, 0.004, (zFar + zEnd) / 2 - 1, { noCast: true }); far.rotation.x = -Math.PI / 2;
  wallBox(0, zEnd - 6, b.w + 16, 11, 0, { litP: 0.35, cafe: [(b.w + 16) / 2 - 3.6, 7.2], wall: "#4a3226" });   // the café across the T-junction at the end
  const pool2 = add(new THREE.PlaneGeometry(12, 7), poolMat, 0, 0.03, zEnd - 2.5, { noCast: true }); pool2.rotation.x = -Math.PI / 2; pool2.receiveShadow = false;
  const dark = add(new THREE.PlaneGeometry(b.w - 0.8, 22), std({ color: 0x24221f }), 0, 0.004, 37, { noCast: true }); dark.rotation.x = -Math.PI / 2;   // the street carries on toward us, out of frame
  for (const tx of [-TRAM_TRACK, TRAM_TRACK]) for (const r of [-0.72, 0.72]) {   // rails: up the street, and over the near quay
    add(new THREE.BoxGeometry(0.08, 0.02, -zEnd + 9), railMat, tx + r, 0.02, (zEnd + 9) / 2, { noCast: true });
    add(new THREE.BoxGeometry(0.08, 0.02, 30), railMat, tx + r, 0.02, 19.4 + 15, { noCast: true });
  }
  for (const tx of [-TRAM_TRACK, TRAM_TRACK]) add(new THREE.BoxGeometry(0.02, 0.02, 100), TRAM_ART.under, tx, 6.6, -18, { noCast: true });   // the overhead wires
  for (let z = zEnd + 3; z < 8; z += 9) add(new THREE.BoxGeometry(b.w - 0.5, 0.02, 0.02), TRAM_ART.under, 0, 6.65, z, { noCast: true });   // span wires to the houses
  for (const sd of [-1, 1]) {                                // the stop: a glass shelter and a sign on each side, lit
    const x = sd * (hw - 0.75);
    add(new THREE.BoxGeometry(0.9, 2.3, 3.2), shelterGlass, x, 1.15, STOP + sd * 2, { noCast: true });
    add(new THREE.BoxGeometry(1.0, 0.1, 3.4), TRAM_ART.under, x, 2.35, STOP + sd * 2);
    add(new THREE.BoxGeometry(0.06, 2.6, 0.06), TRAM_ART.under, x, 1.3, STOP + sd * 2 + 2.2);
    const sg = add(new THREE.PlaneGeometry(0.5, 0.75), stopSignMat, x, 2.6, STOP + sd * 2 + 2.2, { noCast: true }); sg.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2;
  }
  const tram = makeTram(); target.add(tram);
  const onDeck = (z) => (z > 9 && z < 19.4 ? bridge.deck(z) : 0);
  const SPEED = 3.2, WAIT = 8, CYCLE = 96;
  const legs = (zA, zB, zStop, t) => {                       // from zA to zB, stopping at zStop; returns z, or null when done
    const d1 = Math.abs(zStop - zA) / SPEED, d2 = Math.abs(zB - zStop) / SPEED;
    if (t < d1) return zA + (zStop - zA) * t / d1;
    if (t < d1 + WAIT) return zStop;
    if (t < d1 + WAIT + d2) return zStop + (zB - zStop) * (t - d1 - WAIT) / d2;
    return null;
  };
  critters.push((t) => {                                     // from the T-junction down to us (stopping), and later back up and round the corner
    const c = t % CYCLE;
    let z = null, dir = 1;
    if (c < CYCLE / 2) z = legs(zEnd - 6, 42, STOP + TRAM_LEN / 2, c); else { z = legs(42, zEnd - 6, STOP - TRAM_LEN / 2, c - CYCLE / 2); dir = -1; }
    if (z === null) { tram.visible = false; return; }
    tram.visible = true; tram.rotation.y = dir > 0 ? 0 : Math.PI;
    tram.position.set(dir > 0 ? -TRAM_TRACK : TRAM_TRACK, (onDeck(z - TRAM_LEN * 0.3) + onDeck(z + TRAM_LEN * 0.3)) / 2, z);
  });
}
function buildCross(b, def) {
  const hw = b.w / 2, len = def.tram ? 31 : -SQ.z0;
  const sm = streetMat(b.w, 18, { pavement: false, kerbAtEnd: false, puddles: 2, leavesAt: [0.2], leafRow: 12 });   // drawn 18 m long as before (same random draws), shown 15 m
  [sm.map, sm.roughnessMap].forEach((t) => { if (t) { t.repeat.set(1, len / 18); t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; } });
  const side = add(new THREE.PlaneGeometry(b.w, len), sm, 0, 0.01, -len / 2, { noCast: true });
  side.rotation.x = -Math.PI / 2;
  b.bridges = [def.gap === "skinny" ? skinnyBridge(0) : brickBridge(0, def.tram ? { flat: true, tracks: [-TRAM_TRACK, TRAM_TRACK] } : {})];
  lamp(-b.w / 2 - 0.6, 8.3); lamp(b.w / 2 + 0.6, 8.3);          // Amsterdam bridges have lamps at their corners
  bikes(-b.w / 2 + 0.6, 2, -4); spriteAt(potTex, 0.62, 0.62, b.w / 2 - 0.6, 0.31, -6);
  if (rnd() < 0.7) critter(catTex, 0.78, 0.62, 1.2, 0, -3.5, rnd() < 0.5, 1.7);
  const seedWas = seed;                                      // the square draws from the main sequence; put it back after, so every later block is unchanged
  bikes(-hw - 2.7, 3, 8.5); bikes(hw + 1.4, 2, 8.5);         // bikes chained to the bridge railings
  if (def.tram) { tramStreet(b, b.bridges[0]); seed = seedWas; return; }
  // the houses' side walls along the street, with windows
  for (const sd of [-1, 1]) wallBox(sd * (hw - 0.2), -0.5 - (len - 0.5) / 2, len - 0.5, 9.4, sd * -Math.PI / 2, { litP: 0.12 });
  // the square
  const sqW = SQ.half * 2, sqD = SQ.z0 - SQ.z1;
  const ground2 = add(new THREE.PlaneGeometry(sqW, sqD), streetMat(sqW, sqD, { pavement: false, kerbAtEnd: false, puddles: 3, manholes: [0] }), 0, 0.012, (SQ.z0 + SQ.z1) / 2, { noCast: true });
  ground2.rotation.x = -Math.PI / 2;
  wallBox(0, SQ.z1, sqW, 11, 0, { litP: 0.3, cafe: [sqW / 2 - 3.2, 6.4], wall: "#4a3226" });            // facing us across the square: the café
  for (const sd of [-1, 1]) {
    wallBox(sd * SQ.half, (SQ.z0 + SQ.z1) / 2, sqD, 10.4, sd * -Math.PI / 2, { litP: 0.22 });           // the square's sides
    wallBox(sd * (hw + (SQ.half - hw) / 2), SQ.z0, SQ.half - hw, 9.4, Math.PI, { litP: 0 });              // the backs of the street's houses
  }
  // its lamp, always on, and the warm light on the cobbles
  const lx = -2.4, lz = SQ.z1 + 4.5, postH = (LAMP_H - LAMP_HEAD) / PX, headH = LAMP_HEAD / PX;
  add(new THREE.PlaneGeometry(1, postH), squareLamp.post, lx, postH / 2, lz);
  add(new THREE.PlaneGeometry(1, headH), squareLamp.head, lx, postH + headH / 2, lz, { noCast: true });
  const pool = add(new THREE.PlaneGeometry(9, 9), poolMat, lx, 0.03, lz, { noCast: true }); pool.rotation.x = -Math.PI / 2; pool.receiveShadow = false;
  const cafeGlow = add(new THREE.PlaneGeometry(8, 5), poolMat, 0, 0.035, SQ.z1 + 2.6, { noCast: true }); cafeGlow.rotation.x = -Math.PI / 2; cafeGlow.receiveShadow = false;
  // people out in the square, and a bench
  addPerson({ x: 1.6, z: SQ.z1 + 3.2, talk: true, coat: pick2(["#5a3a2a", "#3a4a5a", "#6a2a2a"]), hat: pick2(["beanie", "cap", "scarf"]), hatCol: "#c86a3a", long: rnd2b() < 0.5 });
  addPerson({ x: 2.5, z: SQ.z1 + 3.2, talk: true, flip: true, coat: pick2(["#2a3a5a", "#4a5a3a", "#7a5a2a"]), hairStyle: pick2(["long", "bun", "curly"]), hair: "#3a2414" });
  addPerson({ x: -5.5, z: SQ.z0 - 3, coat: "#3a3a40", hat: "cap", hatCol: "#4a4a48", dog: false });
  bench(5.5, SQ.z1 + 1.4, -0.3); planter(-7.2, SQ.z1 + 1.2); planter(7.6, SQ.z0 - 2);
  seed = seedWas;
}

// sky: dark blue overhead, a warm city glow low down; stars only above the horizon
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `varying vec3 vW; void main(){ float t = clamp(vW.y*1.6, 0.0, 1.0); vec3 c = mix(vec3(0.05,0.06,0.1), vec3(0.008,0.012,0.03), t);
    c += vec3(0.07,0.04,0.02) * exp(-abs(vW.y) * 10.0); gl_FragColor = vec4(c,1.0); }`
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), skyMat);
scene.add(sky);
const starPos = [], starPhase = [];
for (let i = 0; i < 700; i++) { const a = rnd() * Math.PI - Math.PI, e = 0.03 + rnd() * 1.3, d = 480; starPos.push(Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d, Math.sin(a) * Math.cos(e) * d); starPhase.push(rnd() * 6.28); }
const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3)); starGeo.setAttribute("phase", new THREE.Float32BufferAttribute(starPhase, 1));
const starMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, fog: false, uniforms: { time: { value: 0 } },
  vertexShader: `attribute float phase; uniform float time; varying float vA; void main(){ vA = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(time * 0.8 + phase * 7.0), 3.0); gl_PointSize = 2.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(vec3(0.9,0.93,1.0) * vA * 0.35, 1.0); }`
});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// light: little fill (Octopath's drama is contrast), the moon low from the right; it follows the camera in steps
const hemiLight = new THREE.HemisphereLight(0x4a5c98, 0x141220, 0.32);   // the night sky's cold fill (cold night since 2026-10-28, his request)
scene.add(hemiLight);
// darker since 2026-10-28 (he asked for more dramatic shadows, "overall darker so the lighting has more of an impact"):
// less sky fill so shade goes deeper; lamps and his lit windows unchanged, so they carry more of the picture
// darker again later that day (Octopath I's contrast: pools of light in darkness)
const NIGHT = { hemiSky: new THREE.Color(0x4a5c98), hemiGround: new THREE.Color(0x141220), hemi: 0.08, moon: 0.95, rim: 0.28, top: 0.18 }, WHITE = new THREE.Color(1, 1, 1);
const moonLight = new THREE.DirectionalLight(0x9fb4ec, 1.4);      // cold moonlight; the lamps and windows stay warm
moonLight.castShadow = true; moonLight.shadow.mapSize.set(2048, 2048);
Object.assign(moonLight.shadow.camera, { left: -44, right: 44, top: 30, bottom: -30, near: 1, far: 170 });
scene.add(moonLight, moonLight.target);
/* 2026-10-28: he wanted more moonlight and the moon itself, with little sky. The key light now comes from higher up
   (40°), so roof slopes and the street catch it; a second, weaker light from behind (where the moon is drawn) rims the
   ridges and gable edges, Octopath's trick for reading roofs at night. The moon disc is tonight's real phase. */
const rimLight = new THREE.DirectionalLight(0xa8bcec, 0.4);
scene.add(rimLight, rimLight.target);
// and from almost straight above: it lights what faces up (roofs, sills, cornices, the cobbles' tops) and not the walls,
// so the top faces read the way they do in Octopath, in neutral moonlight
const topLight = new THREE.DirectionalLight(0xbccae6, 0.34);
scene.add(topLight, topLight.target);
const MOON_PHASE = (() => { const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14); return ((((Date.now() - ref) / 864e5) % syn) + syn) % syn / syn; })();
const moonGrp = new THREE.Group(); scene.add(moonGrp);
(() => {
  const N = 48, [c, g] = canvas(N, N), r = N / 2 - 1, cph = Math.cos(2 * Math.PI * MOON_PHASE), waxing = MOON_PHASE < 0.5;
  const maria = [[-0.3, -0.25, 0.28], [0.15, -0.3, 0.18], [0.25, 0.15, 0.24], [-0.1, 0.32, 0.18], [-0.42, 0.12, 0.12]];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const nx = (x + 0.5 - N / 2) / r, ny = (y + 0.5 - N / 2) / r, d = nx * nx + ny * ny;
    if (d > 1) continue;
    const edge = Math.sqrt(1 - ny * ny) * cph, lit = waxing ? nx > edge : nx < -edge;
    const sea = maria.some(([mx, my, mr]) => (nx - mx) ** 2 + (ny - my) ** 2 < mr * mr);
    P(g, x, y, lit ? (sea ? "#cfc6b0" : d > 0.85 ? "#e0d8c4" : "#f4eddc") : "#262630");
  }
  const disc = tex(c); disc.magFilter = THREE.LinearFilter;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: disc, transparent: true, fog: false, depthWrite: false }));
  face.material.color.setScalar(1.35);                     // a little over white, so the bloom gives it a soft halo
  const hc = document.createElement("canvas"); hc.width = hc.height = 64; const hg = hc.getContext("2d"), gr = hg.createRadialGradient(32, 32, 4, 32, 32, 32);
  gr.addColorStop(0, "rgba(200,210,235,0.5)"); gr.addColorStop(0.35, "rgba(200,210,235,0.12)"); gr.addColorStop(1, "rgba(200,210,235,0)"); hg.fillStyle = gr; hg.fillRect(0, 0, 64, 64);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.material.opacity = 0.35 + 0.65 * (1 - cph) / 2;      // a fuller moon, a wider glow
  halo.position.z = -0.01; moonGrp.add(halo, face);
})();
/* ---------------------------------------------------------------- the foreground (2026-10-28, he picked it from the comparison)
   Swags of five big bulbs over the near quay, just above the bottom edge: they light one per application sent TODAY and go
   dark at midnight (his choice: real progress, and it shows the daily goal). They follow the camera in repeating copies.
   (Out-of-focus elm leaves dipping into the top edge were tried the same day; he didn't like them, removed.) */
const SWAG_P = 20, SWAG_Z = 30;                              // how often a swag repeats along the street (m); how near the camera
const swagGroup = new THREE.Group(); scene.add(swagGroup);
const BULB_ON = new THREE.Color(1.25, 0.66, 0.24), BULB_OFF = new THREE.Color(0.045, 0.04, 0.035);   // amber when on; unlit glass all but vanishes in the blur
let swagN = 0, today = 0, bulbLvl = [];
function buildSwags(n) {
  swagGroup.clear(); swagN = n; bulbLvl = new Array(n).fill(0).map((_, i) => (i < today ? 1 : 0));
  const yA = 1.3, yLow = 0, half = SWAG_P / 2, z = SWAG_Z;   // local y 0 = the bottom of the sag; the wire runs pole to pole
  const wireMat = std({ color: 0x0c0b0a }), geo = new THREE.SphereGeometry(0.24, 12, 9);
  const poleMat = std({ map: woodTex("#5a4030") }), capMat = std({ color: 0x2a2018 });
  for (let k = -1; k <= 1; k++) {
    const g = new THREE.Group(); g.userData.k = k; swagGroup.add(g);
    // a wooden pole where this swag meets the next (he saw gaps, 2026-10-28); tall enough to run out of the bottom of the frame
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 26, 0.2), poleMat); pole.position.set(half, yA + 0.35 - 13, z); g.add(pole);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.28), capMat); cap.position.set(half, yA + 0.4, z); g.add(cap);
    const pts = []; for (let i = 0; i <= 24; i++) { const x = -half + 2 * half * i / 24; pts.push(new THREE.Vector3(x, yLow + (yA - yLow) * (x / half) ** 2, z)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.05, 4), wireMat));
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * (2 * half * 0.7 / Math.max(1, n - 1)), y = yLow + (yA - yLow) * (x / half) ** 2 - 0.34;
      const b = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: BULB_OFF.clone() })); b.scale.y = 1.3; b.position.set(x, y, z); b.userData.i = i; g.add(b);
    }
  }
}
/* a dark, blurred foreground along the bottom edge (2026-10-28, from Octopath I's torch-lit town: the sharp middle is seen
   through out-of-focus dark shapes close to the camera). Bushes on our side of the water, near the camera, repeating along
   the street; pinned so only their tops rise into the bottom of the frame. */
const FRAME_P = 15, FRAME_Z = 38, frameGroup = new THREE.Group(), FRAME_MATS = []; scene.add(frameGroup);
function buildFrame() {
  const keep = seed;                                         // shrubSprite draws from the main sequence; put it back after
  const mats = [0, 1].map(() => new THREE.MeshBasicMaterial({ map: shrubSprite([LEAVES.green, LEAVES.green], 96, 40, { ccy: 26, rx: 46, ry: 22, rMin: 5, rMax: 9, n: 60 }), color: 0x0b0c0a, alphaTest: 0.5, transparent: true, fog: false }));
  FRAME_MATS.push(...mats);
  seed = keep;
  for (let k = -1; k <= 1; k++) {
    const g = new THREE.Group(); g.userData.k = k; frameGroup.add(g);
    [[-4.2, 0, 4.6, 0], [3.4, -0.25, 3.4, 1]].forEach(([dx, dy, w, m]) => { const h = w * 40 / 96, p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats[m]); p.position.set(dx, dy - h * 0.1, FRAME_Z); g.add(p); });
  }
}
const _ray = new THREE.Vector3();
function yAtScreen(ndcY, z) {                                // the height that sits at this screen height, on the plane at depth z (centre of the view)
  const rx = FR.rect, cx = (rx.x + rx.w / 2) / FR.w * 2 - 1, cy = 1 - ((rx.y + rx.h / 2) - ndcY * rx.h / 2) / FR.h * 2;
  _ray.set(cx, cy, 0.5).unproject(camera).sub(camera.position);
  return camera.position.y + _ray.y * (z - camera.position.z) / _ray.z;
}
function stepForeground(dt) {
  const sb = Math.round(camX / SWAG_P) * SWAG_P;
  swagGroup.children.forEach((g) => { g.position.x = sb + g.userData.k * SWAG_P; });
  swagGroup.visible = FR.fx > 0.01 && !showing;              // they come in with the effects as the street opens (fading, below); not in the character close-up
  if (swagGroup.visible) swagGroup.position.y = yAtScreen(-0.78, SWAG_Z);   // whatever the camera angle, just above the bottom edge
  const fb = Math.round(camX / FRAME_P) * FRAME_P;
  frameGroup.children.forEach((g) => { g.position.x = fb + g.userData.k * FRAME_P; });
  frameGroup.visible = swagGroup.visible; FRAME_MATS.forEach((m) => { m.opacity = FR.fx; });   // they fade in, not pop
  if (frameGroup.visible) frameGroup.position.y = yAtScreen(-1.0, FRAME_Z) - 0.35;   // only their tops show, along the bottom edge
  for (let i = 0; i < swagN; i++) { const goal2 = i < today ? 1 : 0, d = goal2 - bulbLvl[i]; if (d) bulbLvl[i] += Math.sign(d) * Math.min(Math.abs(d), dt * 0.7); }
  swagGroup.children.forEach((g) => g.children.forEach((b) => { if (b.isMesh && b.userData.i !== undefined) b.material.color.copy(BULB_OFF).lerp(BULB_ON, bulbLvl[b.userData.i] || 0).multiplyScalar(FR.fx); }));
}

// the real lights: a few lamp-light pairs that follow the lit lamps nearest the camera (the others just glow)
const POOL = [];
for (let i = 0; i < 5; i++) {
  // tighter, brighter pools since 2026-10-28 (Octopath I: pools of light in darkness): the light ends ~13 m out (was unlimited)
  const point = new THREE.PointLight(0xffb866, 0, 13, 2), spot = new THREE.SpotLight(0xffb866, 0, 11, 0.78, 0.35, 2);
  spot.castShadow = !SMALL_GPU; spot.shadow.mapSize.set(512, 512); spot.shadow.bias = -0.002; spot.shadow.camera.near = 0.3; spot.shadow.camera.far = 8;
  scene.add(point, spot, spot.target); POOL.push({ point, spot, lamp: null });
}
// dust in the lamplight, around the lamps that have real light
const MOTES = 60, moteBase = [], motePos = new Float32Array(MOTES * 3);
for (let i = 0; i < MOTES; i++) moteBase.push([i % POOL.length, (rnd() - 0.5) * 5, 0.6 + rnd() * 4.4, (rnd() - 0.5) * 3, rnd() * 6.28, 0.3 + rnd() * 0.7]);
const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
const motes = new THREE.Points(moteGeo, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `void main(){ gl_PointSize = 2.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `void main(){ gl_FragColor = vec4(0.9, 0.65, 0.4, 1.0); }`
}));
motes.frustumCulled = false; scene.add(motes);

// ================================================================== your character's look (D43, 2026-10-28)
/* The townsfolk's sprite (person()), redrawn for your character with many more parts (he asked for "a higher level of
   customization", "more eccentric things and some Amsterdamish things"): tops with patterns, skirts and shorts, shoes,
   boots, sneakers and clogs, more hair, facial hair, hats (a top hat, a Volendam lace cap, a King's Day crown, a propeller
   cap...), things to hold (tulips, a herring, a Gouda, a stroopwafel, an umbrella, a balloon, an Amsterdam flag...),
   a pigeon, a gull, a parrot or a cat on the shoulder, and a backpack, guitar or cape. The frame is bigger (28 x 44 instead
   of 20 x 36) so a top hat, umbrella or balloon fits above the head. No random draws at all: the same choices always give
   the same picture, and nothing here can move his lights. The parts and their names: tracker/character-parts.json. */
const HFW = 28, HFH = 44, HOX = 4, HOY = 8;                  // frame size, and where the townsfolk's 20 x 36 body sits in it
const HPW = PW * HFW / 20, HPH = PH * HFH / 36;              // the same pixels per metre as the townsfolk
const LACE = "#f4f0e8", GOLD = "#d9b25a", AMS_RED = "#c8282a", INK = "#1a1414";
function normLook(o) {                                       // fills in defaults; also reads the first version's options (long, scarf, beard, bag, bread...)
  const v = Object.assign({}, o);
  const top = v.top || (v.long ? "long" : "coat");
  return {
    skin: v.skin || "#e8b896", top, coat: v.coat || "#3a4a6a", trim: v.trim || "#ece6da", pattern: v.pattern || "", patCol: v.patCol || "#ece6da",
    bottom: top === "overalls" ? "trousers" : v.bottom || "trousers", legs: top === "overalls" ? v.coat || "#3a4a6a" : v.legs || "#2a2a34", socks: v.socks || "",
    shoes: v.shoes || "shoes", shoeCol: v.shoeCol || (v.shoes === "clogs" ? "#e8c070" : v.shoes === "sneakers" ? "#c83a3a" : "#1a1410"),
    hairStyle: v.hairStyle || "short", hair: v.hair || "#2a1d14",
    facial: v.facial || (v.beard ? "beard" : ""), facialCol: v.facialCol || v.beard || v.hair || "#2a1d14",
    hat: v.hat || "", hatCol: v.hatCol || "#3a3a40",
    glasses: v.glasses === true ? "round" : v.glasses || "", earrings: !!v.earrings, freckles: !!v.freckles, blush: !!v.blush, pipe: !!v.pipe, apron: !!v.apron,
    neck: v.neck || (v.scarf ? "scarf" : ""), neckCol: v.neckCol || v.scarf || "#c8a050",
    hold: v.hold || (v.bread ? "bread" : v.bouquet ? "flowers" : v.cup ? "coffee" : ""), holdCol: v.holdCol || "",
    shoulder: v.shoulder || "", back: v.back || (v.bag ? "satchel" : ""), backCol: v.backCol || v.bag || "#6a4a2a"
  };
}
function heroSprite(o0) {
  const o = normLook(o0 || HERO_DEFAULT);
  const [c, g] = canvas(HFW * 3, HFH);
  const skin = o.skin, coat = o.coat, coatL = shade(coat, 0.12), coatD = shade(coat, -0.2);
  const raised = ["umbrella", "balloon", "flag"].includes(o.hold);
  for (let f = 0; f < 3; f++) {
    const X = f * HFW + HOX, p = (x, y, col) => P(g, X + x, HOY + y, col), r = (x, y, w, h, col) => R(g, X + x, HOY + y, w, h, col), ln = (x0, y0, x1, y1, col) => line(g, X + x0, HOY + y0, X + x1, HOY + y1, col);
    const step = f === 0 ? 0 : f === 1 ? 1 : -1, swing = step * 2;
    const long = o.top === "long" || o.top === "raincoat", bottom = o.top === "dress" ? 28 : long ? 27 : 23;

    // behind everything: a cape, a guitar case, a backpack
    if (o.back === "cape") for (let y = 11; y <= 30; y++) { const s = Math.floor((y - 11) / 4); r(5 - s, y, 11 + s * 2, 1, y > 28 ? shade(o.backCol, -0.25) : o.backCol); p(5 - s, y, shade(o.backCol, 0.15)); }
    if (o.back === "guitar") { ln(9, 3, 6, 12, "#3a2414"); ln(10, 3, 7, 12, "#3a2414"); r(1, 13, 7, 12, o.backCol); r(2, 12, 5, 1, o.backCol); r(2, 25, 5, 1, o.backCol); r(1, 18, 7, 1, shade(o.backCol, -0.2)); p(2, 14, shade(o.backCol, 0.2)); }
    if (o.back === "backpack") { r(3, 12, 4, 9, o.backCol); r(3, 12, 4, 1, shade(o.backCol, 0.15)); r(3, 17, 4, 1, shade(o.backCol, -0.2)); p(4, 15, GOLD); }

    // legs, socks or tights, shoes
    const bare = o.socks || skin;
    [[8, -1], [11, 1]].forEach(([hx, side], k) => {
      const fx = hx + side * step * 2;
      for (let y = 23; y <= 32; y++) {
        const t = (y - 23) / 9, x = Math.round(hx + (fx - hx) * t);
        let col = o.bottom === "trousers" || (o.bottom === "shorts" && y <= 26) ? o.legs : bare;
        r(x, y, 2, 1, k ? col : shade(col, -0.15));
      }
      const sc = o.shoeCol, sd = k ? sc : shade(sc, -0.2);
      if (o.shoes === "boots") { r(fx, 29, 3, 6, sd); r(fx, 29, 3, 1, shade(sc, 0.15)); p(fx + 2, 33, shade(sc, 0.35)); }
      else if (o.shoes === "clogs") { r(fx, 32, 4, 3, sd); p(fx + 4, 32, sd); p(fx + 1, 32, shade(sc, 0.25)); r(fx, 34, 4, 1, shade(sc, -0.3)); }
      else if (o.shoes === "sneakers") { r(fx, 33, 3, 2, sd); r(fx, 34, 4, 1, "#ece6da"); p(fx + 1, 33, "#ece6da"); }
      else { r(fx, 33, 3, 2, sd); p(fx + 2, 33, shade(sc, 0.35)); }
    });

    // the back arm, mostly hidden behind the body
    const sleeve = o.top === "overalls" ? o.trim : coat, sleeveD = shade(sleeve, -0.2);
    ln(8, 12, 8 + swing, 20, sleeveD); ln(7, 12, 7 + swing, 20, sleeveD); r(7 + swing, 21, 2, 1, shade(skin, -0.15));

    // the top: lit from the upper left
    const body = o.top === "overalls" ? o.trim : coat, bodyL = shade(body, 0.12), bodyD = shade(body, -0.2);
    for (let y = 11; y <= bottom; y++) {
      const flare = (long && y > 22) || (o.top === "dress" && y > 20) ? Math.min(2, Math.floor((y - (long ? 22 : 20)) / 2)) : 0;
      for (let x = 6 - flare; x <= 14 + flare; x++) p(x, y, x <= 6 - flare ? bodyL : x >= 13 + flare ? bodyD : body);
    }
    r(7, 11, 7, 1, bodyL);
    if (o.pattern) for (let y = 12; y <= bottom; y++) for (let x = 7; x <= 12; x++) {
      const on = o.pattern === "stripes" ? y % 2 === 0 : o.pattern === "checks" ? ((x >> 1) + (y >> 1)) % 2 === 0 : x % 3 === 1 && y % 3 === 1;
      if (on) p(x, y, o.patCol);
    }
    if (o.top === "coat") { r(6, 20, 9, 1, coatD); p(11, 20, GOLD); [14, 17].forEach((y) => p(12, y, shade(coat, -0.35))); }
    if (long) { for (let y = 17; y <= bottom; y++) p(12, y, coatD); [14, 17].forEach((y) => p(12, y, shade(coat, -0.35))); }
    if (o.top === "raincoat") { r(5, 10, 2, 3, coat); for (let y = 13; y < 25; y += 4) p(8, y, shade(coat, 0.35)); }
    if (o.top === "jacket") { r(10, 12, 2, bottom - 12, o.trim); p(9, 12, coatL); p(12, 12, coatD); p(9, 13, coatL); }
    if (o.top === "sweater") { for (let y = 14; y < bottom; y += 3) r(7, y, 7, 1, shade(coat, -0.08)); r(6, bottom, 9, 1, shade(coat, -0.18)); r(8, 11, 5, 1, shade(coat, 0.18)); }
    if (o.top === "overalls") { r(8, 15, 6, bottom - 14, coat); r(8, 15, 6, 1, coatL); ln(8, 11, 8, 15, coat); ln(13, 11, 13, 15, coat); r(10, 17, 2, 2, coatD); p(8, 15, GOLD); p(13, 15, GOLD); }
    if (o.top === "dress") r(7, 19, 7, 1, coatD);
    if (o.apron) { r(8, 14, 6, Math.min(13, bottom - 13), "#ece6da"); r(13, 14, 1, Math.min(13, bottom - 13), "#cfc8ba"); r(8, 18, 6, 1, "#d8d0c2"); }
    if (o.bottom === "skirt" && o.top !== "dress") for (let y = 21; y <= 28; y++) { const fl = Math.min(2, Math.floor((y - 21) / 3)); r(6 - fl, y, 9 + fl * 2, 1, y === 21 ? shade(o.legs, 0.12) : o.legs); p(14 + fl, y, shade(o.legs, -0.2)); }
    [[9, 16], [11, 19]].forEach(([x, y]) => { if (y < bottom) p(x, y, shade(body, -0.12)); });   // two creases

    // round the neck
    const nc = o.neckCol;
    if (o.neck === "scarf" || o.neck === "striped") {
      r(8, 10, 6, 2, nc); r(9, 12, 2, 5, nc); p(10, 16, shade(nc, -0.25)); p(8, 10, shade(nc, 0.2));
      if (o.neck === "striped") { r(8, 11, 6, 1, LACE); p(9, 13, LACE); p(10, 13, LACE); p(9, 15, LACE); p(10, 15, LACE); }
    } else if (o.neck === "amsterdam") {                     // the city's colours: red, a black band, three white crosses
      r(8, 10, 6, 2, AMS_RED); r(9, 12, 2, 5, AMS_RED); r(9, 14, 2, 1, INK); p(10, 12, LACE); p(9, 14, LACE); p(10, 16, LACE); p(12, 10, LACE);
    } else if (o.neck === "bowtie") { r(9, 10, 1, 2, nc); p(10, 11, shade(nc, -0.3)); r(11, 10, 1, 2, nc); }
    else if (o.neck === "tie") { r(9, 11, 4, 1, shade(body, 0.28)); r(10, 11, 1, 8, nc); p(10, 11, shade(nc, 0.2)); }
    else if (o.neck === "necklace") { r(9, 11, 4, 1, shade(body, 0.28)); [[8, 11], [9, 12], [10, 12], [11, 12], [12, 11]].forEach(([x, y]) => p(x, y, nc)); }
    else r(9, 11, 4, 1, shade(body, 0.28));

    // head: neck, face, ear, eyes, mouth
    r(10, 10, 2, 1, shade(skin, -0.2));
    r(8, 3, 6, 7, skin); r(8, 3, 1, 7, shade(skin, 0.06)); r(13, 8, 1, 2, shade(skin, -0.12)); p(14, 7, skin);
    p(9, 6, shade(skin, -0.22));
    p(11, 6, "#1a1210"); p(13, 6, "#1a1210"); p(12, 8, shade(skin, -0.3));
    if (o.blush) p(13, 7, "#e0907e");
    if (o.freckles) { p(10, 7, shade(skin, -0.25)); p(12, 7, shade(skin, -0.25)); }
    if (o.earrings) p(9, 8, GOLD);
    const fc = o.facialCol;
    if (o.facial === "beard") { r(9, 8, 5, 2, fc); p(12, 8, shade(fc, -0.2)); }
    if (o.facial === "goatee") { r(11, 9, 2, 2, fc); p(12, 8, fc); }
    if (o.facial === "moustache" || o.facial === "curled") r(11, 8, 3, 1, fc);
    if (o.facial === "curled") { p(10, 7, fc); p(14, 7, fc); p(10, 8, fc); }
    if (o.glasses === "round") { r(10, 6, 5, 1, "#2a2420"); p(11, 6, "#a8c4d0"); p(13, 6, "#a8c4d0"); }
    if (o.glasses === "square") { r(10, 5, 5, 3, "#2a2420"); p(11, 6, "#a8c4d0"); p(13, 6, "#a8c4d0"); p(12, 7, skin); p(12, 5, skin); }
    if (o.glasses === "sun") { r(10, 6, 5, 1, "#141414"); r(11, 6, 1, 2, "#26262e"); r(13, 6, 1, 2, "#26262e"); }
    if (o.glasses === "monocle") { p(14, 6, GOLD); p(13, 5, GOLD); p(13, 7, GOLD); ln(14, 8, 13, 13, GOLD); }
    if (o.pipe) { ln(13, 8, 15, 8, "#5a3a1e"); r(16, 6, 2, 3, "#4a2a14"); p(16, 6, "#2a1a10"); p(17, 4 - (f % 2), "#c8c4bc"); p(18, 2 + (f % 2), "#9a968e"); }

    // hair
    const hs = o.hairStyle, hair = o.hair, hl = shade(hair, 0.25);
    if (hs !== "bald" && hs !== "mohawk") { r(8, 2, 6, 2, hair); r(7, 3, 2, 4, hair); p(13, 4, hair); p(12, 4, hair); p(9, 2, hl); p(10, 2, hl); }
    if (hs === "bald") r(8, 5, 1, 3, hair);
    if (hs === "long") { r(6, 4, 3, 9, hair); r(7, 13, 2, 2, hair); p(6, 6, hl); }
    if (hs === "bun") { r(5, 1, 3, 3, hair); p(6, 1, hl); }
    if (hs === "ponytail") { r(5, 4, 2, 6, hair); p(5, 5, hl); }
    if (hs === "curly") { [[6, 2], [7, 1], [9, 1], [11, 1], [12, 2], [13, 3], [6, 4], [8, 1], [10, 1]].forEach(([x, y], k) => p(x, y, k % 3 ? hair : hl)); r(6, 3, 3, 5, hair); }
    if (hs === "afro") { r(7, -1, 7, 1, hair); r(6, 0, 9, 3, hair); r(5, 1, 3, 7, hair); r(14, 1, 1, 2, hair); [[7, 0], [10, -1], [12, 0], [6, 3], [9, 1]].forEach(([x, y]) => p(x, y, hl)); }
    if (hs === "mohawk") { r(8, 3, 1, 4, shade(hair, -0.3)); r(9, -2, 3, 5, hair); p(10, -2, hl); p(9, 0, hl); }
    if (hs === "pigtails") { r(5, 4, 2, 2, hair); r(4, 6, 2, 4, hair); r(14, 4, 2, 2, hair); r(15, 6, 1, 4, hair); p(5, 4, "#c83a3a"); p(14, 4, "#c83a3a"); }
    if (hs === "braids") for (let y = 4; y <= 17; y++) p(6 + (y % 2), y, y % 3 ? hair : hl);
    if (hs === "spiky") [8, 10, 12].forEach((x) => { p(x, 1, hair); p(x, 0, hl); });
    if (hs === "sidepart") { r(11, 2, 3, 1, hl); r(13, 3, 2, 1, hair); }

    // hats
    const hc = o.hatCol;
    if (o.hat === "cap") { r(8, 1, 6, 3, hc); r(13, 3, 3, 1, shade(hc, -0.2)); r(9, 1, 3, 1, shade(hc, 0.15)); }
    if (o.hat === "flatcap") { r(8, 1, 7, 2, hc); r(13, 3, 3, 1, shade(hc, -0.2)); p(9, 1, shade(hc, 0.15)); r(7, 2, 1, 2, hc); }
    if (o.hat === "bowler") { r(9, 0, 5, 3, hc); r(7, 3, 9, 1, hc); p(10, 0, shade(hc, 0.25)); }
    if (o.hat === "tophat") { r(9, -5, 5, 6, hc); r(7, 1, 9, 1, hc); r(9, -1, 5, 1, "#7a2a22"); p(10, -4, shade(hc, 0.25)); p(10, -3, shade(hc, 0.25)); }
    if (o.hat === "beanie" || o.hat === "bobble") { r(8, 1, 6, 3, hc); r(8, 3, 6, 1, shade(hc, 0.2)); p(10, 0, hc); p(11, 0, shade(hc, 0.2)); }
    if (o.hat === "bobble") { r(10, -2, 2, 2, LACE); p(10, -2, "#ffffff"); }
    if (o.hat === "beret") { r(8, 1, 7, 2, hc); r(14, 2, 2, 1, hc); p(10, 0, shade(hc, -0.2)); p(9, 1, shade(hc, 0.15)); }
    if (o.hat === "sailor") { r(8, 1, 6, 2, LACE); r(8, 3, 6, 1, hc); p(11, 0, AMS_RED); }
    if (o.hat === "fisherman") { r(8, 1, 6, 3, hc); r(13, 3, 3, 1, INK); p(9, 1, shade(hc, 0.15)); r(8, 3, 5, 1, shade(hc, -0.25)); }
    if (o.hat === "baker") { r(8, 0, 6, 3, "#f2eee6"); r(8, 3, 6, 1, "#d8d0c4"); p(9, 0, "#ffffff"); }
    if (o.hat === "scarf") { r(7, 2, 7, 3, hc); r(7, 4, 2, 6, hc); p(8, 2, shade(hc, 0.2)); p(9, 9, shade(hc, -0.2)); }
    if (o.hat === "lace") {                                  // a Volendam lace cap: white, close round the face, a raised peak, its wing flaring back
      r(7, 1, 7, 3, LACE); r(9, -1, 3, 2, LACE); p(10, -2, LACE); r(7, 4, 2, 5, LACE); p(13, 4, LACE);
      r(4, 1, 3, 2, LACE); p(3, 0, LACE); p(4, 3, LACE);
      [[8, 2], [10, 0], [12, 2], [7, 5], [7, 7], [5, 1]].forEach(([x, y]) => p(x, y, "#d8d0c0"));
    }
    if (o.hat === "crown") { r(8, 0, 6, 2, hc); p(8, -1, hc); p(11, -2, hc); p(11, -1, hc); p(13, -1, hc); p(11, 0, AMS_RED); p(9, 0, shade(hc, 0.25)); }
    if (o.hat === "propeller") {
      r(8, 1, 6, 3, hc); p(9, 1, "#3a8ad8"); p(11, 1, "#d8c030"); p(13, 1, AMS_RED); p(11, 0, "#2a2a2a");
      if (f % 2) r(8, -1, 7, 1, AMS_RED); else r(10, -1, 3, 1, "#3a8ad8");
    }
    if (o.hat === "tulips") [[8, 2, AMS_RED], [9, 1, "#e8c030"], [10, 2, "#3d5c2f"], [11, 1, "#e9879a"], [12, 2, AMS_RED], [13, 2, "#3d5c2f"], [10, 1, "#e8c030"]].forEach(([x, y, col]) => p(x, y, col));

    // the front arm, and what the hand holds
    let hx = 12 - swing, hy = 20;
    if (raised) { ln(12, 12, 15, 9, sleeve); ln(13, 12, 15, 10, sleeve); hx = 15; hy = 8; }
    else if (o.hold === "coffee") { ln(12, 12, 14, 15, sleeve); ln(13, 12, 14, 14, sleeve); hx = 14; hy = 11; }
    else { ln(12, 12, hx, hy - 1, sleeve); ln(13, 12, hx + 1, hy - 1, shade(sleeve, -0.2)); }
    r(hx, hy, 2, 2, skin);
    const ic = o.holdCol;
    if (o.hold === "coffee") { r(hx + 1, hy - 2, 2, 3, "#ece6da"); p(hx + 1, hy - 2, "#5a3a1e"); }
    if (o.hold === "bread") { r(hx - 1, hy + 1, 5, 3, "#8a5a2a"); r(hx - 1, hy + 1, 5, 1, "#a8743a"); r(hx, hy - 2, 1, 3, "#d09a52"); r(hx + 2, hy - 3, 1, 4, "#c08a42"); }
    if (o.hold === "flowers") { r(hx + 1, hy - 4, 1, 4, "#3d5c2f"); r(hx, hy - 2, 3, 3, "#e8e0c8"); [[0, -6], [1, -7], [2, -5], [-1, -5], [1, -5], [2, -7]].forEach(([dx, dy], k) => p(hx + dx, hy + dy, ["#d44a3c", "#e9879a", "#f1e3c8"][k % 3])); }
    if (o.hold === "tulips") [[-1, 0], [1, -1], [3, 0]].forEach(([dx, dy], k) => {
      const col = k === 1 && ic ? ic : [AMS_RED, "#e8c030", "#e9879a"][k];
      ln(hx + 1, hy, hx + dx, hy - 4 + dy, "#3d5c2f"); r(hx + dx - 1, hy - 7 + dy, 2, 3, col); p(hx + dx, hy - 7 + dy, shade(col, -0.25));
    });
    if (o.hold === "herring") { r(hx - 3, hy, 6, 2, "#b8c0c8"); r(hx - 3, hy, 6, 1, "#6a7a88"); p(hx - 4, hy - 1, "#8a949e"); p(hx - 4, hy + 2, "#8a949e"); p(hx + 2, hy + 1, INK); }
    if (o.hold === "cheese") { r(hx - 2, hy - 2, 5, 4, "#e8b830"); r(hx - 2, hy - 2, 5, 1, "#f4d060"); r(hx - 2, hy + 1, 5, 1, "#c8282a"); p(hx + 2, hy - 2, "#f8e090"); }
    if (o.hold === "stroopwafel") { r(hx - 1, hy - 2, 4, 3, "#b8783a"); p(hx, hy - 1, "#8a5426"); p(hx + 2, hy - 1, "#8a5426"); p(hx + 1, hy - 2, "#d8a05a"); }
    if (o.hold === "book") { const bc = ic || "#3a5a7a"; r(hx - 1, hy - 3, 3, 4, bc); r(hx + 2, hy - 3, 1, 4, LACE); p(hx - 1, hy - 3, shade(bc, 0.2)); }
    if (o.hold === "lantern") { ln(hx + 1, hy + 1, hx + 1, hy + 3, "#2a2a2a"); r(hx, hy + 3, 3, 4, "#2a2a2a"); r(hx + 1, hy + 4, 1, 2, "#ffd890"); }
    if (o.hold === "umbrella") {                             // open, over the head
      const uc = ic || "#2a3a5a", cx = hx + 1;
      ln(cx, hy, cx, -3, "#3a3a3a");
      r(cx - 3, -7, 7, 1, uc); r(cx - 5, -6, 11, 1, uc); r(cx - 7, -5, 15, 1, uc); r(cx - 7, -4, 15, 1, shade(uc, -0.2));
      [-7, -3, 1, 5].forEach((dx) => p(cx + dx, -3, shade(uc, -0.2))); p(cx, -8, "#3a3a3a"); r(cx - 2, -7, 2, 1, shade(uc, 0.2));
    }
    if (o.hold === "balloon") { const bc = ic || AMS_RED; ln(hx + 1, hy, hx + 3, -2, "#c8c4bc"); r(hx + 2, -8, 3, 1, bc); r(hx + 1, -7, 5, 4, bc); r(hx + 2, -3, 3, 1, bc); p(hx + 2, -6, shade(bc, 0.4)); p(hx + 3, -2, shade(bc, -0.2)); }
    if (o.hold === "flag") {                                 // the Amsterdam flag on a stick: red, black, red, three white crosses
      const w = f % 2;
      ln(hx + 1, hy + 2, hx + 1, hy - 8, "#6a4a2a");
      r(hx + 2, hy - 8 + w, 6, 2, AMS_RED); r(hx + 2, hy - 6 + w, 6, 1, INK); r(hx + 2, hy - 5 + w, 6, 2, AMS_RED);
      [2, 4, 6].forEach((dx) => p(hx + 1 + dx, hy - 6 + w, LACE));
    }
    if (o.back === "satchel") { ln(9, 11, 14, 18, "#3a2414"); r(13, 18, 4, 4, o.backCol); r(13, 18, 4, 1, shade(o.backCol, -0.2)); p(15, 20, GOLD); }
    if (o.back === "backpack") ln(9, 11, 9, 19, shade(o.backCol, -0.3));
    if (o.back === "cape") p(10, 11, GOLD);

    // on the back shoulder (behind the head, so the face stays clear)
    if (o.shoulder === "pigeon") { r(3, 8, 4, 3, "#8a8e98"); r(5, 6, 2, 2, "#7a7e8a"); p(5, 8, "#5a8a7a"); p(7, 7, "#e8c8a8"); p(6, 6, "#e86a2a"); p(2, 9, "#5a5e68"); p(4, 11, "#c8605a"); }
    if (o.shoulder === "gull") { r(1, 8, 5, 3, "#ece8e0"); r(1, 8, 4, 1, "#9aa0a8"); r(4, 6, 2, 2, "#f4f0e8"); r(6, 7, 2, 1, "#e8c030"); p(7, 7, AMS_RED); p(5, 6, INK); p(0, 8, INK); }
    if (o.shoulder === "parrot") { r(2, 7, 3, 4, "#3a9a3a"); r(3, 5, 3, 2, AMS_RED); p(6, 6, "#e8d8a0"); p(5, 5, INK); ln(2, 11, 1, 14, "#3a5ac8"); p(3, 8, "#e8c030"); }
    if (o.shoulder === "cat") { r(3, 9, 6, 3, "#d8862a"); p(4, 9, "#a8601a"); p(6, 9, "#a8601a"); r(1, 7, 3, 3, "#d8862a"); p(1, 6, "#d8862a"); p(3, 6, "#d8862a"); p(2, 8, "#3a8a3a"); ln(8, 12, 9, 15, "#d8862a"); }
  }
  g._c = null; outlinePass(g, HFW * 3, HFH); g._c = null;
  const t = tex(c); t.repeat.set(1 / 3, 1);
  return t;
}

// ================================================================== your character (D43, 2026-10-28)
/* One townsperson the person chose (data/profile.json "character": the parts in tracker/character-parts.json, drawn by heroSprite). A/D walk them along the street and the
   camera follows. For each application logged, they go to the new light and light it: by bike when it's far, with a
   lamplighter's pole for lamps, in through the door for a house's windows, and a look up for anything they can't reach
   (bridge bulbs, boats). Only setLit(n, true) (a real log) or replay() (the lights logged while the street was closed)
   sends them: nothing lights on its own. Their sprite draws from its own random sequence, so his lights don't move. */
const HERO_DEFAULT = { coat: "#3a4a6a", hairStyle: "short", hair: "#2a1d14", scarf: "#c8a050", bag: "#6a4a2a", legs: "#2a2a34" };
const LANE = 3.4, WALK = 1.6, RIDE = 6.5, CYCLE = 4.5, BIKE_FROM = 15;   // metres from the houses; m/s on foot, by bike on an errand, by bike with A/D; bike when further than this
const hero = { x: 0, z: LANE, dir: 1, held: 0, follow: true, queue: [], job: null, riding: 0, cycle: false, inside: false, ready: false };   // cycle: on the bike by choice (B)
// a little of its own colour glows, so the character reads at night away from the lamps (the townsfolk stay dim)
const heroMat = std({ map: WHITE_TEX, emissiveMap: WHITE_TEX, emissive: 0xffffff, emissiveIntensity: 0.34, alphaTest: 0.5, side: THREE.DoubleSide });
const heroMesh = new THREE.Mesh(new THREE.PlaneGeometry(HPW, HPH), heroMat);   // its own, bigger frame (p2d_look.js)
const heroShadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), shadowMat);
heroShadow.rotation.x = -Math.PI / 2; heroShadow.scale.set(1, 0.55, 1);
// their own Dutch bike, the street's bike drawn in lighter colours (the black one vanishes at night): steel wheels, a cream
// frame, a brown crate on the front
const heroBikeTex = sprite(40, 24, (g) => {
  const wheel = (cx) => { for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; P(g, Math.round(cx + Math.cos(t) * 7), Math.round(16 + Math.sin(t) * 7), a % 16 < 8 ? "#8c8a86" : "#6c6a66"); } line(g, cx - 4, 16, cx + 4, 16, "#5a5854"); line(g, cx, 12, cx, 20, "#5a5854"); P(g, cx, 16, "#c8c4bc"); };
  wheel(8); wheel(31);
  const fr = "#d8cdb4";
  line(g, 8, 16, 16, 16, fr); line(g, 16, 16, 27, 8, fr); line(g, 14, 7, 27, 8, fr); line(g, 14, 7, 16, 16, fr); line(g, 8, 16, 14, 7, fr); line(g, 27, 8, 31, 16, fr);
  R(g, 11, 5, 6, 2, "#3a2a1e"); line(g, 27, 8, 26, 3, "#9a968e"); R(g, 24, 3, 5, 1, "#9a968e");
  R(g, 29, 4, 7, 4, "#8a5e34"); R(g, 30, 5, 5, 2, "#a8743e");
});
const heroBike = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.5), std({ map: heroBikeTex, emissiveMap: heroBikeTex, emissive: 0xffffff, emissiveIntensity: 0.34, alphaTest: 0.5, side: THREE.DoubleSide }));
const poleMat = new THREE.MeshLambertMaterial({ color: 0x9a7448, emissive: 0x2a1c0e });
const heroPole = new THREE.Group();                           // pivots at the hand; the pole points along +y; a small flame at its tip
{ const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1, 0.07), poleMat); p.position.y = 0.5; heroPole.add(p);
  const gc = document.createElement("canvas"); gc.width = gc.height = 32; const gg = gc.getContext("2d"), grd = gg.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, "rgba(255,226,170,1)"); grd.addColorStop(0.35, "rgba(255,170,80,0.55)"); grd.addColorStop(1, "rgba(255,140,60,0)");
  gg.fillStyle = grd; gg.fillRect(0, 0, 32, 32);
  const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  flame.name = "flame"; heroPole.add(flame); }
const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0, depthWrite: false }));
let heroTex = null;
function setHero(o) {                                        // draw the chosen character (heroSprite: no random draws)
  const t = heroSprite(o);
  if (heroTex) heroTex.dispose();
  heroTex = t; heroMat.map = heroMat.emissiveMap = t; heroMat.needsUpdate = true;
  if (!heroMesh.parent) {
    scene.add(heroMesh, heroShadow, heroBike, heroPole, doorGlow);
    heroBike.visible = heroPole.visible = false; doorGlow.visible = false;
  }
  hero.ready = true;
}
const heroArt = () => (heroTex ? { image: heroTex.image, frames: 3, w: HPW, h: HPH } : null);   // for the sidebar picture: its 3 frames, and its size in metres
function personArt(o) {                                      // any character's 3 frames, drawn exactly as the street would (the picker's preview)
  const t = heroSprite(o), img = t.image; t.dispose(); return img;
}

// where the character goes for a light, and what they do there
const nearX = (x, ref) => x + LOOP * Math.round((ref - x) / LOOP);
function houseAt(L) {
  return L.block.H.find((H) => L.x >= H.x - 0.05 && L.x <= H.x + H.w + 0.05 && Math.abs(L.z - H.zOff) < 1.2) || null;
}
function jobFor(lid) {
  const L = LIGHTS[lid], lx = nearX(L.block.cx + L.x, hero.x), shift = lx - (L.block.cx + L.x);
  if (L.kind === "lamp") return { lid, kind: "pole", x: lx - 0.7, z: L.z - 0.45, tx: lx, ty: L.y - 0.15 };
  const H = L.kind === "bulbs" ? null : houseAt(L);
  if (H) {
    const hole = H.f.holes.find((h) => h.kind === "door"), dh = hole ? hole.h / PX : 2.4;
    return { lid, kind: "door", x: L.block.cx + H.door + shift, z: H.zOff + 0.9, doorZ: H.zOff - FDEPTH + 0.03, dw: H.dw, dh };
  }
  return { lid, kind: "look", x: lx - 1.2 * Math.sign(lx - hero.x || 1), z: LANE };
}

/* A job is the trip, then a few timed steps. Each step: [seconds, (u 0..1) => {}, at the end, walking frames?]. */
const doorLight = (j) => (a) => { doorGlow.visible = a > 0.01; doorGlow.material.opacity = a * 0.92; doorGlow.position.set(j.x, j.dh / 2 + 0.12, j.doorZ); doorGlow.scale.set(j.dw, j.dh, 1); };
function startJob(lid) {
  const j = jobFor(lid); hero.job = j; j.phase = "go"; j.k = 0; j.u = 0;
  const far = Math.abs(j.x - hero.x) > BIKE_FROM;               // far: gets on the bike, rides, gets off, walks the last steps
  j.bike = far ? (hero.riding >= 1 ? "ride" : "on") : (hero.riding > 0 ? "off" : "");
  const on = () => setGoal(lid, 1);
  if (j.kind === "pole") {
    const dx = j.tx - (j.x + 0.25), dy = j.ty - 1.35, len = Math.hypot(dx, dy), up = Math.atan2(-dx, dy), down = up + 1.9;
    const flame = heroPole.getObjectByName("flame");
    const aim = (u) => { heroPole.visible = true; heroPole.position.set(j.x + 0.25, 1.35, j.z + 0.08); heroPole.children[0].scale.y = len; heroPole.children[0].position.y = len / 2;
      heroPole.rotation.z = down + (up - down) * u; flame.position.y = len; flame.rotation.z = -heroPole.rotation.z; };
    j.steps = [[0.3, () => {}], [0.8, (u) => aim(u * u * (3 - 2 * u)), on], [1.5, () => aim(1)], [0.6, (u) => aim(1 - u), () => { heroPole.visible = false; }]];
  } else if (j.kind === "door") {
    const glow = doorLight(j);
    j.steps = [[0.3, () => {}], [0.5, (u) => glow(u)], [0.5, (u) => { hero.z = j.z + (j.doorZ + 0.25 - j.z) * u; }, () => { hero.inside = true; }, true],
      [0.5, (u) => glow(1 - u)], [0.7, () => {}, on], [1.3, () => {}], [0.4, (u) => glow(u), () => { hero.inside = false; }],
      [0.5, (u) => { hero.z = j.doorZ + 0.25 + (j.z - j.doorZ - 0.25) * u; }, null, true], [0.4, (u) => glow(1 - u)]];
  } else j.steps = [[0.7, () => {}, on], [1.2, () => {}]];
}
function endJob(all) {                                        // all: skip what's left, everything on at once
  if (hero.job && hero.job.lid) setGoal(hero.job.lid, 1);
  if (all) { hero.queue.forEach((lid) => setGoal(lid, 1)); hero.queue = []; }
  hero.job = null; hero.inside = false; hero.riding = 0; hero.cycle = false; heroPole.visible = false; doorGlow.visible = false;   // on foot afterwards
}
function stepJob(dt) {
  const j = hero.job;
  if (j.phase === "go") {
    const dx = j.x - hero.x, ad = Math.abs(dx);
    if (dx) hero.dir = Math.sign(dx);
    if (j.bike === "on") { hero.riding = Math.min(1, hero.riding + dt / 0.35); if (hero.riding >= 1) j.bike = "ride"; return; }
    if (j.bike === "ride") {                                 // slows down over the last dozen metres
      if (ad > 3) { hero.x += Math.sign(dx) * Math.min(ad - 3, RIDE * Math.min(1, ad / 12 + 0.25) * dt); hero.z += (LANE + 0.8 - hero.z) * Math.min(1, dt * 2); return; }
      j.bike = "off";
    }
    if (j.bike === "off") { hero.riding = Math.max(0, hero.riding - dt / 0.35); if (hero.riding > 0) return; j.bike = ""; }
    const dz = j.z - hero.z, d = Math.hypot(dx, dz), s = WALK * dt;
    if (d <= s) { hero.x = j.x; hero.z = j.z; j.phase = "act"; j.k = 0; j.u = 0; return; }
    hero.x += dx / d * s; hero.z += dz / d * s;
    return;
  }
  const st = j.steps[j.k];
  j.u = Math.min(1, j.u + dt / st[0]); st[1](j.u); hero.stepping = !!st[3];
  if (j.u >= 1) { if (st[2]) st[2](); j.k++; j.u = 0; if (j.k >= j.steps.length) endJob(false); }
}
function stepHero(dt, t) {
  if (!hero.ready) return;
  const working = interactive && (hero.job || hero.queue.length);
  if (interactive && !hero.job && hero.queue.length) startJob(hero.queue.shift());
  let walking = false;
  if (showing) walking = stepShowcase(dt);
  else if (working && hero.job) { stepJob(dt); walking = !!hero.job && (hero.job.phase === "go" ? hero.riding === 0 : hero.stepping); }
  else if (interactive) {                                    // A/D: on foot, or on the bike (B gets on and off)
    hero.riding = hero.cycle ? Math.min(1, hero.riding + dt / 0.35) : Math.max(0, hero.riding - dt / 0.35);
    if (hero.held && (hero.riding >= 1 || hero.riding === 0)) {
      const ride = hero.riding >= 1;
      hero.dir = hero.held; hero.x += hero.held * (ride ? CYCLE : WALK) * dt;
      hero.z += ((ride ? LANE + 0.8 : LANE) - hero.z) * Math.min(1, dt * 3); walking = !ride;
    }
  }
  const ride = hero.riding >= 1, show = FR.cam > 0.6 && !hero.inside;
  heroMesh.visible = heroShadow.visible = show;
  heroTex.offset.x = walking ? (1 + Math.floor(t * 5) % 2) / 3 : 0;
  heroMesh.position.set(hero.x - (ride ? 0.35 * hero.dir : 0), HPH / 2 + (ride ? 0.3 : walking ? Math.abs(Math.sin(t * 7.9)) * 0.03 : 0), hero.z);
  heroShadow.position.set(hero.x, 0.02, hero.z);
  faceAt(heroMesh, hero.x); heroMesh.scale.x = hero.dir;
  heroBike.visible = show && hero.riding > 0;
  if (heroBike.visible) { heroBike.position.set(hero.x + (ride ? 0 : hero.dir * 0.9), 0.75 - (1 - hero.riding) * 0.08, hero.z + 0.06); faceAt(heroBike, hero.x); heroBike.scale.x = hero.dir; }
}
/* The character page's live preview (he asked for "what it'll *actually* look like"): the real street, close up, the
   character by a door, now and then taking a few steps so the walk shows. */
let showing = false, showT = 0, showBase = 0, showZ = LANE;
function stepShowcase(dt) {
  showT += dt; const c = showT % 9, s = Math.min(1, Math.max(0, c - 3)), b = Math.min(1, Math.max(0, c - 7.5));
  const off = 1.6 * (s - b);                                 // still 3 s, a few steps right, still, a few steps back
  hero.x = showBase + off; hero.z = showZ;
  const walk = (c > 3 && c < 4) || (c > 7.5 && c < 8.5);
  if (walk) hero.dir = c < 5 ? 1 : -1;
  return walk;
}
function heroGo(lids) { if (hero.ready) { hero.follow = true; hero.queue.push(...lids); } else lids.forEach((lid) => setGoal(lid, 1)); }
/* The street opens on the sidebar's house: your character is inside, and once the street is open its door glows and they
   step out (he asked: "exit the door that is shown rather than instantly popping up"). */
function heroHome(H, doorX) {
  if (hero.job || hero.queue.length) return;
  const hole = H.f.holes.find((h) => h.kind === "door"), dh = hole ? hole.h / PX : 2.4;
  const j = { lid: 0, kind: "exit", phase: "act", k: 0, u: 0, x: doorX, z: H.zOff + 1.3, doorZ: H.zOff - FDEPTH + 0.03, dw: H.dw, dh };
  const glow = doorLight(j), out = j.doorZ + 0.25;
  Object.assign(hero, { x: doorX, z: out, dir: 1, inside: true, follow: true, riding: 0, cycle: false });
  j.steps = [[0.5, () => {}], [0.5, (u) => glow(u), () => { hero.inside = false; }], [0.8, (u) => { hero.z = out + (j.z - out) * u; }, null, true],
    [0.5, (u) => glow(1 - u)]];
  hero.job = j;
}


// ================================================================== the canal (one mirror that follows the camera)
const waterShader = {
  uniforms: { color: { value: new THREE.Color(0x05080f) }, tDiffuse: { value: null }, textureMatrix: { value: null }, time: { value: 0 }, grid: { value: new THREE.Vector2(640, 360) }, ox: { value: 0 }, moonX: { value: 9 } },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vPos;
    void main(){ vUv = textureMatrix * vec4(position,1.0); vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform float time; uniform vec2 grid; uniform float ox; uniform float moonX; varying vec4 vUv; varying vec3 vPos;
    float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
    void main(){
      // dark, a little see-through, drawn: pixel ripples on the street's 16 px/m grid (in world x, so they stay put as the camera moves)
      vec2 wp = vec2(mod(vPos.x + ox, 4096.0), vPos.y);
      vec2 px = floor(wp * 16.0);
      float spd = 1.0 + h21(vec2(px.y, 2.0)) * 2.0;
      vec2 cell = floor(vec2((px.x + floor(time * spd + h21(vec2(px.y, 1.0)) * 40.0)) / 9.0, px.y / 2.0));
      float n = h21(cell), tone = n < 0.2 ? -1.0 : n > 0.85 ? 1.0 : 0.0;
      vec3 c = color * 0.4 + vec3(0.001, 0.003, 0.004) + tone * vec3(0.002, 0.004, 0.005);   // near black between the lights (darker, 2026-10-28)
      c += smoothstep(3.3, 4.9, abs(vPos.y)) * vec3(0.003, 0.006, 0.005);
      vec2 uv = vUv.xy / vUv.w;
      uv.x += sin(px.y * 0.7 + time * 1.3) * 0.003 + (n - 0.5) * 0.005;
      uv = (floor(uv * grid) + 0.5) / grid;
      // the city's lights on the water (2026-10-28, he wanted to see it lit): lamps and lit windows reflect as long warm
      // streaks, smeared down the water and broken by the ripples
      vec3 refl = vec3(0.0);
      for (int i = 0; i < 6; i++) refl = max(refl, texture2D(tDiffuse, uv + vec2(0.0, (float(i) - 1.5) * 0.011)).rgb * (1.0 - float(i) * 0.09));
      float lum = dot(refl, vec3(0.3, 0.5, 0.2));
      float keep = smoothstep(0.2, 0.7, lum) * (tone < 0.0 ? 0.3 : 1.0);   // only lamps and lit windows survive
      refl = refl * (0.05 + 0.95 * keep);
      c += refl * 0.22 / (1.0 + refl);                         // only a faint, smooth trace of each light...
      // ...the rest as twinkling pixel glints, as on Octopath 0's sea (2026-10-28): densest where the reflected light is brightest
      vec2 gl = floor(wp * vec2(6.0, 10.0)), fl = fract(wp * vec2(6.0, 10.0)) - vec2(0.3 + 0.4 * h21(gl + 9.0), 0.5);
      float glint = step(abs(fl.x), 0.1) * step(abs(fl.y), 0.13) * step(0.985 - keep * 0.42, h21(gl + 11.0)) * (0.35 + 0.65 * pow(0.5 + 0.5 * sin(time * 2.2 + h21(gl + 5.0) * 30.0), 3.0));
      c += refl * glint * 3.2;
      // and the moon's: ripple crests catch its cold light everywhere, and a glittering path widens toward us under it
      float crest = tone > 0.0 ? 1.0 : 0.35;
      c += vec3(0.008, 0.013, 0.024) * crest;
      float wPath = 2.5 + (4.9 - vPos.y) * 0.6, moonPath = exp(-pow((vPos.x - moonX) / wPath, 2.0));
      c += vec3(0.035, 0.05, 0.085) * moonPath * (0.3 + 0.7 * crest);
      vec2 gc = floor(wp * vec2(5.0, 9.0));
      float thr = 0.995 - moonPath * 0.1;
      vec2 f = fract(wp * vec2(5.0, 9.0)) - vec2(0.3 + 0.4 * h21(gc + 7.0), 0.5);
      float dash = step(abs(f.x), 0.09) * step(abs(f.y), 0.12);
      float sp = dash * step(thr, h21(gc)) * pow(0.5 + 0.5 * sin(time * 1.6 + h21(gc + 3.0) * 40.0), 8.0);
      c += mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.82, 0.55), clamp(lum, 0.0, 1.0)) * sp * (1.4 + 4.0 * lum);
      gl_FragColor = vec4(c, 1.0);
    }`
};
const water = new Reflector(new THREE.PlaneGeometry(240, 9.8), { textureWidth: 480, textureHeight: 270, shader: waterShader, clipBias: 0.003, color: 0x05080f });
water.getRenderTarget().texture.magFilter = water.getRenderTarget().texture.minFilter = THREE.NearestFilter;
water.rotation.x = -Math.PI / 2; water.position.set(0, -1.25, 14.2);
let reflEvery = 2;
{ const draw0 = water.onBeforeRender; let n = 0; water.onBeforeRender = function (...a) { if (n++ % reflEvery === 0) draw0.apply(this, a); }; }   // the reflection isn't redrawn every frame (speed)
scene.add(water);
const mistTex = (() => {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d");
  for (let i = 0; i < 40; i++) { const x = Math.random() * 256, y = 16 + Math.random() * 32, r = 14 + Math.random() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 64); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
})();
const mists = [0, 1, 2].map((k) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(180, 7), new THREE.MeshBasicMaterial({ map: mistTex.clone(), color: 0x8090b0, transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.material.map.wrapS = THREE.RepeatWrapping; m.material.map.repeat.set(3, 1); m.material.map.needsUpdate = true;
  m.rotation.x = -Math.PI / 2; m.position.set(0, -0.9 + k * 0.45, 14.2 + (k - 1) * 1.6); scene.add(m);
  return m;
});

// ================================================================== post: depth bokeh -> bloom -> grade (the effects fade in when the street opens)
let PR = 1, CW = 300, CH = 600;                              // pixel ratio, canvas size in CSS px
const W0 = () => Math.max(1, Math.round(CW * PR)), H0 = () => Math.max(1, Math.round(CH * PR));
const sceneRT = new THREE.WebGLRenderTarget(W0(), H0(), { type: THREE.HalfFloatType });
sceneRT.depthTexture = new THREE.DepthTexture(W0(), H0());
sceneRT.depthTexture.type = THREE.UnsignedIntType;
const composer = new EffectComposer(renderer);
// bokeh from real depth: each sample is weighted by its own blur size (so blurred foreground spreads over
// what's behind it) and by brightness (so out-of-focus highlights become round discs: the glitter).
// Depth decides who may spread onto whom: a sharp house must not smear into the blurred sky behind it
// (that drew a dark halo around every roof, 2026-10-27), and the blurred sky must not creep over the house.
// prepass: colour + view depth (in alpha, /100) so the gather below reads one texture per sample
const depthPack = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tColor: { value: sceneRT.texture }, tDepth: { value: sceneRT.depthTexture }, cameraNear: { value: camera.near }, cameraFar: { value: camera.far } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `#include <packing>
    uniform sampler2D tColor; uniform sampler2D tDepth; uniform float cameraNear, cameraFar; varying vec2 vUv;
    void main(){ gl_FragColor = vec4(texture2D(tColor, vUv).rgb, -perspectiveDepthToViewZ(texture2D(tDepth, vUv).x, cameraNear, cameraFar) * 0.01); }`
});
const dof = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(W0(), H0()) },
    focus: { value: 40 }, inner: { value: 5.2 }, outer: { value: 8 }, maxR: { value: 17 * PR } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 res; uniform float focus, inner, outer, maxR; varying vec2 vUv;
    float cocAt(float z){ return clamp((abs(z - focus) - inner) / outer, 0.0, 1.0) * maxR * (z > focus ? 1.9 : 1.0); }   // behind: much more blur, as in Octopath's towns (he found it sharp, 2026-10-28)
    void main(){
      vec4 c0 = texture2D(tDiffuse, vUv);
      float z0 = c0.a * 100.0, r0 = cocAt(z0), m = 1.0 + z0 * 0.02;
      if (r0 < 0.5 && maxR < 0.5) { gl_FragColor = vec4(c0.rgb, 1.0); return; }
      float rot = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
      vec3 acc = c0.rgb; float wsum = 1.0;
      float R = maxR * 1.9;
      for (int i = 0; i < 40; i++) {
        float fi = float(i) + 0.5, rr = sqrt(fi / 40.0) * R, a = fi * 2.39996 + rot;
        vec4 sm = texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * rr / res);
        float zs = sm.a * 100.0, rs = cocAt(zs);
        // in front of us: only its own blur reaches here; behind us: no further than our own blur
        float rEff = zs < z0 - m ? rs : zs > z0 + m ? min(rs, r0 * 0.9) : max(rs, r0 * 0.9);
        float reach = smoothstep(rr - 1.0, rr + 1.0, rEff);
        float w = reach * (1.0 + 5.0 * pow(max(max(sm.r, sm.g), sm.b), 2.0)) / max(1.0, rs * rs * 0.02);
        acc += sm.rgb * w; wsum += w;
      }
      gl_FragColor = vec4(acc / wsum, 1.0);
    }`
});
// ShaderPass clones its uniforms, and three can't clone render-target textures: assign them after
depthPack.uniforms.tColor.value = sceneRT.texture; depthPack.uniforms.tDepth.value = sceneRT.depthTexture;
composer.addPass(depthPack);
composer.addPass(dof);
const bloom = new UnrealBloomPass(new THREE.Vector2(CW, CH), 0.62, 0.7, 0.75);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amt: { value: 1 }, vig: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, amt, vig; varying vec2 vUv;
    void main(){
      vec3 c0 = texture2D(tDiffuse, vUv).rgb, c = c0;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 0.86);                                         // a little desaturated
      // a cold night, the town's lights warm (he asked for it, 2026-10-28, later the same day he'd turned down a first try):
      // whatever is lamp-warm (red above blue) or bright stays warm; the rest goes to moonlit blue
      float warmth = max(smoothstep(0.015, 0.12, c0.r - c0.b), smoothstep(0.18, 0.6, l));
      c *= mix(vec3(0.82, 0.92, 1.18), vec3(1.07, 1.0, 0.86), warmth);
      c += vec3(0.0015, 0.003, 0.01) * (1.0 - smoothstep(0.0, 0.15, l)); // blacks barely lifted toward night blue
      vec3 cs = clamp(c, 0.0, 1.0); c += (cs * cs * (3.0 - 2.0 * cs) - cs) * 0.6;   // a stronger S: darks darker, lights brighter (was 0.35)
      c = mix(c0, c, amt);
      float v = smoothstep(1.0, 0.32, length((vUv - vec2(0.5, 0.52)) * vec2(1.2, 1.0)));
      c *= mix(1.0, mix(0.1, 1.0, v), vig);                              // a deep vignette, only when open (corners near black, Octopath I)
      c += (fract(sin(dot(vUv * 1000.0 + time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.012 * amt;
      gl_FragColor = vec4(c, 1.0);
    }`
});
composer.addPass(grade);
composer.addPass(new OutputPass());

// ================================================================== camera: locked to the Octopath angle, moving only along the street
/* side: the sidebar's close-up (2-3 houses); open: full screen, closer than mockup H's camera E and a little lower.
   span = metres across at the street, dist = how far back (a long lens). The sidebar is framed from the bottom (bottomV: the near
   quay's railing at the bottom edge, the nav over the rooftops); the open view from the top (topV: the tallest gable just inside
   the top edge, he asked for that zoom 2026-10-27), showing the street and the near half of the canal. */
/* 2026-10-28: 22° down by default (he tried 16°, then asked to see the roofs and less sky); the open view's angle now
   comes from tiltDeg (his up/down arrows), the open.tilt below is only the default. A little closer, aimed a little lower.
   The sidebar is now a small tile with one house in it (span: about one house wide), barely drifting. */
const VIEWS = {
  side: { span: 8.5, needV: 20.5, maxV: 60, dist: 72, tilt: 0.384, bottomV: -1.4, drift: 0.04 },
  open: { span: 36, needV: 21.5, maxV: 27, dist: 62, tilt: 0.384, topV: 18.8, drift: 0.45 }   // the top edge just above the roofs' far ends
};
let FR = { w: 300, h: 600, rect: { x: 0, y: 0, w: 300, h: 600 }, t: 0, cam: 0, light: 0, fx: 0 };   // cam / light / fx: the opening's three parts, 0..1 each
let lampWasOff = false;   // canvas size, the rectangle the view is framed in, side (0) to open (1)
let Q = { scale: 1, fps: 30, fx: 0 }, fxNow = 0;
let LOOP = 300, HOME = 0, camX = 0, vel = 0, holdUntil = 0, fly = null, drag = null, interactive = false, built = false, running = true;
let pendingToday = null;
let T = 0, last = 0, frameNo = 0, shadowDirty = true, lastShadow = -1e9, moonSnap = null, litN = 0, pendingLit = null, ORDER = [], KOF = {};
let viewNow = VIEWS.side, fpx = 1;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const FLAT_FILL = 1.2;                                      // the even light on the flat house at the start of the opening (the sidebar picture copies it)
// the open street's camera angle is his to set: up/down arrows, 14-36°, 2° a step, remembered (2026-10-28)
const TILT_MIN = 14, TILT_MAX = 36;
let tiltDeg = 22; try { const s0 = parseFloat(localStorage.getItem("street-tilt")); if (s0 >= TILT_MIN && s0 <= TILT_MAX) tiltDeg = s0; } catch (e) { /* private window */ }
let tiltNow = tiltDeg * Math.PI / 180;
// and he can pan the open view up and down (W/S; A/D move along the street like the arrows): metres, + shows more roof,
// - more canal. It starts a little low so the canal's edge is in the frame (he missed the water, 2026-10-28). Remembered.
const PAN_MIN = -9, PAN_MAX = 4, PAN_DEFAULT = -2.5;
let panV = PAN_DEFAULT; try { const p0 = parseFloat(localStorage.getItem("street-pan")); if (p0 >= PAN_MIN && p0 <= PAN_MAX) panV = p0; } catch (e) { /* private window */ }
let panNow = panV;
// and turn (the left/right arrows, his request: tilt the camera sideways rather than move): -24..24°, 3° a step, remembered.
// Further and the flat sprites would show their edges (mockup H allowed about 34°).
const YAW_MAX = 24;
let yawDeg = 0; try { const y0 = parseFloat(localStorage.getItem("street-yaw")); if (Math.abs(y0) <= YAW_MAX) yawDeg = y0; } catch (e) { /* private window */ }
let yawNow = yawDeg * Math.PI / 180;
// and zoom (the mouse wheel, + / -, as in the mockups): a factor on the view's width, around the view's centre. Remembered.
const ZOOM_MIN = 0.45, ZOOM_MAX = 1.6;
let zoomK = 1; try { const z0 = parseFloat(localStorage.getItem("street-zoom")); if (z0 >= ZOOM_MIN && z0 <= ZOOM_MAX) zoomK = z0; } catch (e) { /* private window */ }
let zoomNow = zoomK;
function setZoom(k) { zoomK = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, k)); try { localStorage.setItem("street-zoom", zoomK.toFixed(3)); } catch (e) { /* private window */ } return zoomK; }
/* The opening starts on the sidebar's house (2026-10-28, he asked for a seamless transition): at t = 0 the camera looks
   straight at that one house (0°) from in front, its width filling the frame exactly where the flat picture was; as the
   frame widens it tilts down, zooms out to his view, and the night's lighting fades in (see lightT in update). */
let portrait = null;                                         // { x, w, h, z } of the sidebar's house
function applyView() {
  const t = FR.cam, B = VIEWS.open, r = FR.rect, a = r.w / r.h, P0 = portrait || { w: 8, h: 16, z: 0 };
  let v, centerV, aimZ, yw;
  if (showing) { v = { span: 5.4 * a, dist: 46, tilt: tiltNow }; centerV = 0.9; aimZ = hero.z; yw = yawNow; }   // the character page: close up on the character
  else {
    const span1 = Math.min(Math.max(B.span, B.needV * a), B.maxV * a);   // tall screens: never so far back that the houses get small
    const center1 = B.topV + panNow - span1 / a / 2;          // the open view's centre (unzoomed); zoom scales around it
    v = { span: lerp(P0.w, span1 * zoomNow, t), dist: lerp(VIEWS.side.dist, B.dist, t), tilt: lerp(0, tiltNow, t) };
    centerV = lerp(P0.h / 2, center1, t); aimZ = lerp(P0.z, 3, t);
    yw = yawNow * t;                                          // turned only in the open view (straight on in the sidebar picture)
  }
  fpx = r.w * v.dist / v.span;
  const ct = Math.cos(v.tilt), st = Math.sin(v.tilt), aimY = (centerV + aimZ * st) / ct;
  camera.position.set(camX + v.dist * ct * Math.sin(yw), aimY + v.dist * st, aimZ + v.dist * ct * Math.cos(yw));
  camera.up.set(0, 1, 0); camera.lookAt(camX, aimY, aimZ);
  const n = camera.near, ppx = r.x + r.w / 2, ppy = r.y + r.h / 2;   // the view is centred on the framing rectangle, wherever it is on the canvas
  camera.projectionMatrix.makePerspective(-ppx / fpx * n, (FR.w - ppx) / fpx * n, ppy / fpx * n, -(FR.h - ppy) / fpx * n, n, camera.far);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.updateMatrixWorld();
  scene.fog.density = 0.56 / v.dist * FR.light;               // the street gets about a quarter of haze at any distance (none on the flat house)
  dof.uniforms.focus.value = v.dist;
  viewNow = v;
}
const wrapNear = (x) => x + LOOP * Math.round((camX - x) / LOOP);
const worldX = (L) => wrapNear(L.block.cx + L.x);
function flyTo(x, done) {
  const to = wrapNear(x), d = to - camX, half = FR.rect.w / fpx * viewNow.dist / 2;
  if (Math.abs(d) < half * 0.55) { done && done(); return; }
  fly = { from: camX, to: to - Math.sign(d) * half * 0.15, t0: performance.now(), dur: Math.min(3500, Math.max(900, Math.abs(d) * 60)), done };
}
function stepCamera(dt, now) {
  if (showing) { camX += (hero.x - camX) * Math.min(1, dt * 3); return; }
  if (fly) {
    const k = Math.min(1, (now - fly.t0) / fly.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    camX = fly.from + (fly.to - fly.from) * e;
    if (k >= 1) { const f = fly; fly = null; vel = 0; holdUntil = now + 2500; f.done && f.done(); }
    return;
  }
  if (drag) return;
  if (interactive && hero.ready && hero.follow) { camX += (hero.x - camX) * Math.min(1, dt * 2.4); vel = 0; return; }   // the camera stays with your character
  const want = now < holdUntil ? 0 : lerp(VIEWS.side.drift, VIEWS.open.drift, FR.cam);   // it drifts on its own, like a screensaver
  vel += (want - vel) * Math.min(1, dt * (now < holdUntil ? 2.2 : 0.4));
  camX += vel * dt;
}
// moving along the street by hand (only when the street is open)
const mPerPx = () => viewNow.dist / fpx;
canvasEl.addEventListener("pointerdown", (e) => {
  if (!interactive || e.button !== 0) return;
  fly = null; hero.follow = false; drag = { x0: e.clientX, cam0: camX, lx: e.clientX, lt: e.timeStamp, v: 0, moved: false };   // dragging looks around freely; A/D comes back
  canvasEl.setPointerCapture(e.pointerId);
});
canvasEl.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x0; if (Math.abs(dx) > 3) drag.moved = true;
  camX = drag.cam0 - dx * mPerPx();
  const dt = Math.max(1, e.timeStamp - drag.lt); drag.v = drag.v * 0.6 + (-(e.clientX - drag.lx) * mPerPx() / dt * 1000) * 0.4; drag.lx = e.clientX; drag.lt = e.timeStamp;
});
const endDrag = () => { if (!drag) return; vel = Math.max(-25, Math.min(25, drag.v)); canvasEl._dragged = drag.moved; drag = null; holdUntil = performance.now() + 8000; };
canvasEl.addEventListener("pointerup", endDrag); canvasEl.addEventListener("pointercancel", endDrag);
canvasEl.addEventListener("wheel", (e) => {                  // the wheel zooms, as in the mockups (2026-10-28); a trackpad's sideways scroll still moves along
  if (!interactive) return;
  e.preventDefault();
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { fly = null; hero.follow = false; camX += e.deltaX * mPerPx() * 0.6; vel = 0; holdUntil = performance.now() + 8000; return; }
  const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;  // lines (Firefox) to pixels
  setZoom(zoomK * Math.exp(dy * 0.0012));
}, { passive: false });
function nudge(dir) { const from = fly ? fly.to : camX; fly = { from: camX, to: from + dir * 7, t0: performance.now(), dur: 420 }; holdUntil = performance.now() + 8000; }

// ================================================================== lights: what's on, fading in, the real lamp light near the camera
const moving = new Set();
function setGoal(lid, v) { goal[lid] = v; if (lvl[lid] !== v) moving.add(lid); }
function stepLights(dt) {
  if (!moving.size) return;
  for (const lid of moving) {
    const d = goal[lid] - lvl[lid], step = dt * 0.8;
    lvl[lid] = Math.abs(d) <= step ? goal[lid] : lvl[lid] + Math.sign(d) * step;
    litBytes[lid * 4] = Math.round(lvl[lid] * 255);
    if (lvl[lid] === goal[lid]) moving.delete(lid);
  }
  litTex.needsUpdate = true;
}
function setLit(n, animate) {
  if (!built) { pendingLit = [n, animate]; return; }
  n = Math.max(0, Math.min(n | 0, ORDER.length));
  const prev = litN, fresh = []; litN = n;
  ORDER.forEach((lid, k) => {
    const on = k < n ? 1 : 0;
    if (animate && on && k >= prev) fresh.push(lid);
    else if (animate) setGoal(lid, on);
    else { goal[lid] = lvl[lid] = on; litBytes[lid * 4] = on * 255; moving.delete(lid); }
  });
  litTex.needsUpdate = true;
  if (fresh.length && hero.ready && interactive) heroGo(fresh);                                 // your character goes and lights it (D43)
  else if (fresh.length) flyTo(LIGHTS[fresh[0]].block.cx + LIGHTS[fresh[0]].x, () => fresh.forEach((lid) => setGoal(lid, 1)));   // go to the new light, then switch it on
}
/* The opening switches the lamps on one by one, nearest first (2026-10-28, his pick). Only lamps he has already lit:
   this replays them, it never adds any. "off" before, "reveal" while it plays, "on" the rest of the time. */
let lampMode = "on", lampT0 = 0, lampDur = 900, lampDelay = new Map();
function lampsShow(mode, ms) {
  lampMode = mode;
  if (mode !== "reveal") return;
  lampT0 = performance.now(); lampDur = ms || 900;
  const lit = LAMPS.filter((L) => lvl[L.lid] > 0.5).map((L) => ({ L, d: Math.abs(worldX(L) - camX) + (L.near ? 6 : 0) })).sort((a, b) => a.d - b.d);
  lampDelay = new Map(lit.map((o, i) => [o.L.lid, lit.length > 1 ? i / (lit.length - 1) * Math.max(0, lampDur - 900) : 0]));   // nearest first, evenly spread
}
function lampF(L, now) {
  if (lampMode === "on") return 1;
  if (lampMode === "off") return 0;
  const d = lampDelay.get(L.lid); return d === undefined ? 0 : Math.min(1, Math.max(0, (now - lampT0 - d) / 900));   // each one warms up over 0.9 s
}
function lampBytes(now) {                                    // what the shaders see for each lamp while they come on
  if (lampMode === "reveal" && now > lampT0 + lampDur + 2000) lampMode = "on";
  LAMPS.forEach((L) => { litBytes[L.lid * 4] = Math.round(lvl[L.lid] * lampF(L, now) * 255); });
  litTex.needsUpdate = true;
}
function updateLamps(t) {
  const now = performance.now();
  if (lampMode !== "on" || lampWasOff) { lampBytes(now); lampWasOff = lampMode !== "on"; }
  LAMPS.forEach((L) => {
    const s = lvl[L.lid] * lampF(L, now), on = s > 0.5;
    if (on !== L.on) { L.on = on; L.headMat.map = on ? lampArt.head.map : lampArt.head.off; L.headMat.needsUpdate = true; }
    L.headMat.emissiveIntensity = 2.4 * s;
    L.cone.visible = s > 0.01; L.cone.material.uniforms.k.value = s;
  });
  BULBS.forEach((B) => { const s = lvl[B.lid]; B.mesh.visible = s > 0.01; B.mat.color.setRGB(1, 0.886, 0.69).multiplyScalar(s); });
  // real light only around the camera: the nearest lit lamps get a light pair, fading out toward the edges (never popping in view)
  const A = 46, cands = [];
  LAMPS.forEach((L) => { if (L.near || lvl[L.lid] <= 0.001) return; const wx = worldX(L), d = Math.abs(wx - camX); if (d < A) cands.push({ L, wx, d }); });
  cands.sort((a, b) => a.d - b.d); cands.length = Math.min(cands.length, POOL.length);
  POOL.forEach((p) => { if (p.lamp && !cands.some((c) => c.L === p.lamp)) p.lamp = null; });
  cands.forEach((c) => { if (POOL.some((p) => p.lamp === c.L)) return; const p = POOL.find((q) => !q.lamp); if (p) { p.lamp = c.L; p.point.color.setHex(c.L.warm); p.spot.color.setHex(c.L.warm); shadowDirty = true; } });
  POOL.forEach((p, i) => {
    if (!p.lamp) { p.point.intensity = p.spot.intensity = 0; return; }
    const wx = worldX(p.lamp), z = p.lamp.z, s = lvl[p.lamp.lid] * lampF(p.lamp, performance.now()) * (1 - smooth(A - 14, A, Math.abs(wx - camX)));
    if (p.point.position.x !== wx) { p.point.position.set(wx, 4.85, z); p.spot.position.set(wx, 4.6, z); p.spot.target.position.set(wx, 0, z); p.spot.target.updateMatrixWorld(); shadowDirty = true; }
    p.point.intensity = 135 * s * FR.light * (1 + Math.sin(t * 3.1 + i * 2.0) * 0.015); p.spot.intensity = 220 * s * FR.light;   // (none on the flat house)
  });
}

// ================================================================== each frame
const _v = new THREE.Vector3();
function faceAt(m, wx) { m.rotation.y = Math.atan2(camera.position.x - wx, camera.position.z - m.position.z); }
const parentX = (m) => (m.parent && m.parent.userData.block ? m.parent.position.x : 0);
function frame(now) { requestAnimationFrame(frame); update(now); }
function update(now) {
  if (!built || !running) { last = now; return; }
  if (now - last < 1000 / Q.fps - 2) return;
  const dt = Math.min(0.1, (now - last) / 1000); last = now; T += dt; const t = T;
  stepCamera(dt, now);
  // blocks: each one sits in the copy of the loop nearest the camera; far ones aren't drawn
  BLOCKS.forEach((b) => { const x = wrapNear(b.cx); b.group.position.x = x; b.group.visible = Math.abs(x - camX) < b.w / 2 + 75; });
  fxNow += (Q.fx - fxNow) * Math.min(1, dt * 3);
  const tiltGoal = tiltDeg * Math.PI / 180; if (Math.abs(tiltGoal - tiltNow) > 1e-4) tiltNow += (tiltGoal - tiltNow) * Math.min(1, dt * 3);
  if (Math.abs(panV - panNow) > 1e-3) panNow += (panV - panNow) * Math.min(1, dt * 4);
  { const yg = yawDeg * Math.PI / 180; if (Math.abs(yg - yawNow) > 1e-4) { yawNow += (yg - yawNow) * Math.min(1, dt * 3); shadowDirty = true; } }
  if (Math.abs(zoomK - zoomNow) > 1e-4) zoomNow += (zoomK - zoomNow) * Math.min(1, dt * 5);
  applyView();
  // things that follow the camera
  const cx = camX;
  sky.position.set(cx, 0, camera.position.z); stars.position.set(cx, 0, camera.position.z);
  water.position.x = cx; water.material.uniforms.ox.value = cx;
  water.material.uniforms.moonX.value = (FR.rect.x + FR.rect.w * 0.82 - (FR.rect.x + FR.rect.w / 2)) / fpx * (viewNow.dist - 10);   // under the moon on screen
  mists.forEach((m, k) => { m.position.x = cx; m.material.map.offset.x = t * (0.004 + k * 0.002) + cx / 60; });
  gardenMist.map.offset.x = t * 0.006; moonBeamMat.opacity = (0.2 + Math.sin(t * 0.21) * 0.04) * FR.fx; streetBeamMat.opacity = (0.22 + Math.sin(t * 0.17 + 1.3) * 0.035) * FR.fx;   // they breathe, slowly; none on the flat house
  speckMat.uniforms.time.value = t; speckMat.uniforms.amp.value = FR.fx; stepForeground(dt);
  layers.forEach((l) => { l.m.position.x = cx; l.map.offset.x = (cx - l.span / 2) / l.L; });
  BACK3D.forEach((k) => { const x = wrapNear(k.cx); k.g.position.x = x; k.g.visible = Math.abs(x - camX) < k.w / 2 + 95; });   // the 3D next row, round the loop like the blocks
  const snap = Math.round(cx / 8) * 8;
  if (snap !== moonSnap) {
    moonSnap = snap; moonLight.position.set(snap + 40, 50, 44); moonLight.target.position.set(snap, 0, 0); moonLight.target.updateMatrixWorld(); shadowDirty = true;
    rimLight.position.set(snap + 28, 32, -60); rimLight.target.position.set(snap, 0, -4); rimLight.target.updateMatrixWorld();
    topLight.position.set(snap + 6, 60, 12); topLight.target.position.set(snap, 0, 0); topLight.target.updateMatrixWorld();
  }
  // the moon: near the top right of the open street, far behind the rooftops (so they cover it if they reach that high)
  moonGrp.visible = FR.light > 0.01;
  moonGrp.children.forEach((m) => { if (m.userData.base === undefined) m.userData.base = m.material.opacity; m.material.opacity = m.userData.base * FR.light; });   // it fades in with the night
  if (moonGrp.visible) {
    const ndcX = (FR.rect.x + FR.rect.w * 0.82) / FR.w * 2 - 1, ndcY = 1 - (FR.rect.y + FR.rect.h * 0.07) / FR.h * 2;
    _v.set(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
    moonGrp.position.copy(camera.position).addScaledVector(_v, 420); moonGrp.quaternion.copy(camera.quaternion);
    moonGrp.scale.setScalar(Math.max(10, FR.rect.h * 0.034) * 420 / fpx);
  }
  water.material.uniforms.time.value = t; starMat.uniforms.time.value = t; grade.uniforms.time.value = t;
  stepLights(dt);
  updateLamps(t);
  for (let i = 0; i < MOTES; i++) {
    const mb = moteBase[i], p = POOL[mb[0]], on = p.lamp && lvl[p.lamp.lid] > 0.5, bx = on ? p.point.position.x : 1e5, bz = on ? p.point.position.z : 0;
    motePos[i * 3] = bx + mb[1] + Math.sin(t * 0.21 * mb[5] + mb[4]) * 0.6;
    motePos[i * 3 + 1] = mb[2] + Math.sin(t * 0.13 * mb[5] + mb[4] * 2.0) * 0.5;
    motePos[i * 3 + 2] = bz + mb[3] + Math.cos(t * 0.17 * mb[5] + mb[4]) * 0.4;
  }
  moteGeo.attributes.position.needsUpdate = true;
  billboards.forEach((m) => { if (!m.parent || m.parent.visible !== false) faceAt(m, m.position.x + parentX(m)); });
  people.forEach((p) => {
    if (p.speed) {
      p.x += p.speed * dt;
      if (p.x - cx > 48) p.x -= 96; if (p.x - cx < -48) p.x += 96;
      p.mesh.position.x = p.shadow.position.x = p.x;
      p.t.offset.x = (1 + Math.floor((t + p.phase) * 4) % 2) / 3;
      p.mesh.position.y = PH / 2 + Math.abs(Math.sin((t + p.phase) * 6.3)) * 0.03;
    } else if (p.talk) p.t.offset.x = (Math.floor((t + p.phase) * 0.9) % 3 === 0 ? 1 : 0) / 3;
    else if (p.broom) { const sw = Math.sin((t + p.phase) * 0.35); p.mesh.position.x = p.shadow.position.x = p.home + sw * 1.2; p.t.offset.x = (1 + Math.floor((t + p.phase) * 2.2) % 2) / 3; }
    faceAt(p.mesh, p.mesh.position.x + parentX(p.mesh));
    if (p.speed) p.mesh.scale.x = p.speed > 0 ? 1 : -1;
    else if (p.broom) p.mesh.scale.x = Math.cos((t + p.phase) * 0.35) > 0 ? 1 : -1;
    else if (p.flip) p.mesh.scale.x = -1;
    if (p.dogMesh) { const dir = p.speed > 0 ? 1 : -1; p.dogMesh.position.x = p.x + dir * 1.1; faceAt(p.dogMesh, p.dogMesh.position.x); p.dogMesh.scale.x = dir; p.dogMesh.material.map.offset.x = (Math.floor((t + p.phase) * 6) % 2) / 2; }
  });
  stepHero(dt, t);
  critters.forEach((c) => c(t));
  cycl.x += cycl.speed * dt; if (cycl.x - cx > 50) cycl.x -= 100;
  cycBike.position.x = cycl.x; cycRider.position.x = cycl.x - 0.2; cycShadow.position.set(cycl.x, 0.02, cycl.z);
  faceAt(cycBike, cycl.x); faceAt(cycRider, cycl.x - 0.2);
  // shadows are redrawn only when a light moved (at most four times a second)
  if (frameNo++ < 3 || (shadowDirty && now - lastShadow > 250)) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; lastShadow = now; }
  // the night's lighting and the effects fade in as the street opens: at t = 0 the house is flat, evenly lit, like the
  // sidebar's picture of it (only his lit windows glow); by t = 1 it's moonlight, lamplight, shadows, blur, glow, grade
  const lt = FR.light, fxT = Math.min(fxNow, FR.fx);
  hemiLight.color.copy(WHITE).lerp(NIGHT.hemiSky, lt); hemiLight.groundColor.copy(WHITE).lerp(NIGHT.hemiGround, lt);
  hemiLight.intensity = lerp(Math.PI * FLAT_FILL, NIGHT.hemi, lt);
  moonLight.intensity = NIGHT.moon * lt; rimLight.intensity = NIGHT.rim * lt; topLight.intensity = NIGHT.top * lt;
  bloom.enabled = fxT > 0.02; bloom.strength = 0.62 * fxT;
  dof.enabled = fxT > 0.02; dof.uniforms.maxR.value = 26 * PR * fxT;   // a little stronger since 2026-10-28 (was 17; 38 was too much), smooth
  dof.uniforms.inner.value = 4.2; dof.uniforms.outer.value = 7;        // and a slightly narrower sharp band (was 5.2 / 8)
  grade.uniforms.amt.value = fxT; grade.uniforms.vig.value = fxT;
  reflEvery = Q.fps > 40 ? 2 : 1;
  draw();
  if (frameNo % 150 === 0) { try { localStorage.setItem("street-x", String(((camX % LOOP) + LOOP) % LOOP)); } catch (e) { /* private window */ } }
}
function draw() {
  renderer.setRenderTarget(sceneRT);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  composer.render();
}
function resize() {
  PR = Math.max(0.5, Q.scale);
  renderer.setPixelRatio(PR); renderer.setSize(CW, CH, false);
  composer.setPixelRatio(PR); composer.setSize(CW, CH);
  sceneRT.setSize(W0(), H0()); dof.uniforms.res.value.set(W0(), H0());
  water.getRenderTarget().setSize(Math.max(64, Math.round(W0() / 4)), Math.max(64, Math.round(H0() / 4)));
  water.material.uniforms.grid.value.set(Math.round(W0() / 3), Math.round(H0() / 3));
}

// ================================================================== build, then the light order
function order() {
  const home = BLOCKS[0].cx, dist = (L) => { const x = L.block.cx + L.x; return Math.abs(((x - home) % LOOP + LOOP * 1.5) % LOOP - LOOP / 2); };
  const lamps = LAMPS.slice().sort((a, b) => dist(a) - dist(b)).map((L) => L.lid);
  const bulbs = BULBS.slice().sort((a, b) => dist(a) - dist(b)).map((B) => B.lid);
  const rest = []; for (let lid = 1; lid < LIGHTS.length; lid++) if (LIGHTS[lid].kind !== "lamp" && LIGHTS[lid].kind !== "bulbs") rest.push(lid);
  let s = 20261027; const r2 = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let a = rest.length - 1; a > 0; a--) { const b = Math.floor(r2() * (a + 1)); [rest[a], rest[b]] = [rest[b], rest[a]]; }
  ORDER = lamps.concat(bulbs, rest);   // streetlamps first (nearest home first), then the bridges' bulbs, then windows in a fixed shuffle
  ORDER.forEach((lid, k) => { KOF[lid] = k; });
}
const ready = (async () => {
  const defs = blockDefs();
  for (const d of defs) await buildBlock(d);
  let x = 0;
  BLOCKS.forEach((b) => { b.cx = x + b.w / 2; x += b.w; b.group.userData.block = true; });
  LOOP = x; HOME = BLOCKS[0].cx;
  buildBackground(LOOP); walkers(); cyclist();
  buildSwags(pendingToday ? pendingToday[1] : 5); buildFrame();
  order();
  let saved = NaN; try { saved = parseFloat(localStorage.getItem("street-x")); } catch (e) { /* private window */ }
  camX = isFinite(saved) ? saved : HOME;
  flushAllPx();                                              // every drawn picture onto its canvas before anything is uploaded or copied
  resize(); applyView();
  built = true;
  if (pendingLit) setLit(pendingLit[0], false);
  await renderer.compileAsync(scene, camera).catch(() => {});
  requestAnimationFrame(frame);
  return stats();
})();
function stats() {
  const kinds = {}; LIGHTS.slice(1).forEach((L) => { kinds[L.kind] = (kinds[L.kind] || 0) + 1; });
  return { lights: ORDER.length, kinds, loop: +LOOP.toFixed(1), blocks: BLOCKS.map((b) => ({ name: b.def.name, w: +b.w.toFixed(1), houses: b.H.length, meshes: b.meshes })) };
}

// ================================================================== what the page can do with the street
function pickAt(clientX, clientY) {                            // the application behind the light under the pointer, or -1
  const r = canvasEl.getBoundingClientRect(), ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  let best = 0, bt = Infinity;
  const test = (lid, bx, x0, x1, y0, y1, z) => { if (lvl[lid] < 0.5) return; const tt = (z - o.z) / d.z; if (!(tt > 0) || tt >= bt) return; const px = o.x + d.x * tt - bx, py = o.y + d.y * tt; if (px >= x0 && px <= x1 && py >= y0 && py <= y1) { bt = tt; best = lid; } };
  WINS.forEach((w) => { if (w.block.group.visible) test(w.lid, w.block.group.position.x, w.x0, w.x1, w.y0, w.y1, w.z); });
  LAMPS.forEach((L) => { if (L.block.group.visible) test(L.lid, L.block.group.position.x, L.x - 0.5, L.x + 0.5, 4.2, 5.5, L.z); });
  return best ? KOF[best] : -1;
}
export const Street = {
  canvas: canvasEl, ready, setLit, stats, pick: pickAt, nudge,
  total: () => ORDER.length, litCount: () => litN,
  setFrame(f) {                                              // t (0 sidebar .. 1 open) or, separately, cam / light / fx
    const t = f.t !== undefined ? f.t : 1;
    FR = Object.assign({ cam: t, light: t, fx: t }, f, { t });
    if (f.w !== CW || f.h !== CH) { CW = f.w; CH = f.h; resize(); }
  },
  lamps(mode, ms) { lampsShow(mode, ms); },                  // "off" / "reveal" (one by one, nearest first, over ms) / "on"
  setQuality(q) { const re = q.scale !== Q.scale; Q = Object.assign({}, Q, q); if (re) resize(); },
  setInteractive(on) { interactive = on; canvasEl.style.cursor = on ? "grab" : ""; },
  run(on) { running = on; },
  bench(n = 20) {                                            // for the mockup page: ms per full frame (waits for the GPU each time)
    const gl = renderer.getContext(), px = new Uint8Array(4); draw(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t0 = performance.now(); for (let i = 0; i < n; i++) { draw(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    return { ms: +((performance.now() - t0) / n).toFixed(1), calls: renderer.info.render.calls, size: [canvasEl.width, canvasEl.height] };
  },
  tilt(dir) {                                                // dir +1 / -1: look down more / less; returns the angle in degrees
    tiltDeg = Math.max(TILT_MIN, Math.min(TILT_MAX, tiltDeg + 2 * Math.sign(dir || 0)));
    try { localStorage.setItem("street-tilt", String(tiltDeg)); } catch (e) { /* private window */ }
    return tiltDeg;
  },
  zoom(dir) { return Math.round(100 / setZoom(zoomK * (dir > 0 ? 1 / 1.15 : 1.15))); },   // dir +1 in / -1 out; returns the zoom in % (100 = his usual view)
  setPortrait(x, glideMs, size) {                            // size: the sidebar picture in metres ({w, h}: with its roof and margin), so the 3D view frames exactly what it shows                                  // the sidebar's house: the opening starts on it (and closing ends on it), straight on
    const art = this.houseArt(x); if (!art) return null;
    let H0 = null; BLOCKS.forEach((b) => b.H.forEach((H) => { if (Math.abs(b.cx + H.x + H.w / 2 - art.x) < 1e-6) H0 = H; }));
    portrait = { x: art.x, w: size ? size.w : art.W / PX, h: size ? size.h : art.H / PX, z: H0 ? H0.zOff : 0 };
    vel = 0; holdUntil = performance.now() + 6000;
    if (glideMs) fly = { from: camX, to: wrapNear(art.x), t0: performance.now(), dur: glideMs }; else { fly = null; camX = wrapNear(art.x); }
    if (!glideMs && H0) { const b0 = BLOCKS.find((b) => b.H.includes(H0)); heroHome(H0, camX - art.x + b0.cx + H0.door); }   // your character is inside; they step out once it's open
    return art.x;
  },
  turn(dir) {                                                // dir +1 / -1: look more to the right / left; returns the angle in degrees
    yawDeg = Math.max(-YAW_MAX, Math.min(YAW_MAX, yawDeg + 3 * Math.sign(dir || 0)));
    try { localStorage.setItem("street-yaw", String(yawDeg)); } catch (e) { /* private window */ }
    return yawDeg;
  },
  pan(dir) {                                                 // dir +1 / -1: the view up (more roof) / down (more canal), 1 m a step
    panV = Math.max(PAN_MIN, Math.min(PAN_MAX, panV + Math.sign(dir || 0)));
    try { localStorage.setItem("street-pan", String(panV)); } catch (e) { /* private window */ }
    return panV;
  },
  setToday(n, target = 5) {                                  // the foreground bulbs: one per application sent today (they fade on and off)
    if (!built) { pendingToday = [n, target]; today = n; return; }
    if (target !== swagN) buildSwags(Math.max(1, Math.min(10, target | 0)));
    today = Math.max(0, n | 0);
  },
  goTo(x, hold = 4000) { fly = null; vel = 0; camX = wrapNear(x); holdUntil = performance.now() + hold; },
  houses() { return BLOCKS.flatMap((b) => b.H.map((H) => b.cx + H.x + H.w / 2)).sort((a, b) => a - b); },   // house centres along the loop (the sidebar's carousel)
  houseArt(x) {                                              // the house nearest x, flat and straight on, for the sidebar (2026-10-28):
    let best = null, bd = 1e9;                               // its facade images and its windows, each with its place in the light order (k)
    BLOCKS.forEach((b) => b.H.forEach((H) => { const cx = b.cx + H.x + H.w / 2, d = Math.abs(((x - cx) % LOOP + LOOP * 1.5) % LOOP - LOOP / 2); if (d < bd) { bd = d; best = { H, cx }; } }));
    if (!best) return null;
    const f = best.H.f;
    return { x: best.cx, W: f.W, H: f.H, day: f.map.image, lit: f.litMap.image, glow: f.emissive.image,
      windows: f.holes.filter((h) => h.lid).map((h) => ({ x: h.x, y: h.y, w: h.w, h: h.h, k: KOF[h.lid] })),
      door: (f.holes.filter((h) => h.kind === "door").map((h) => ({ x: h.x, y: h.y, w: h.w, h: h.h })))[0] || null,   // where your character goes in (D43)
      roof: Object.assign({}, best.H.roof, { tiles: ROOF[best.H.roof.kind].map.image, eave: best.H.eave }),
      look: { fill: FLAT_FILL, exposure: renderer.toneMappingExposure } };   // how the 3D view shows it at the start (the picture copies it)   // metres from the ground; the picture's px = metres * 16
  },
  lightX(k) { const L = LIGHTS[ORDER[k]]; return L ? L.block.cx + L.x : HOME; },
  setCharacter(o) { setHero(o); },
  showcase(on, x) {                                          // the character page's live preview: close up on your character by the door of the house nearest x
    showing = !!on; if (!on) return;
    let H0 = null, b0 = null, bd = 1e9;
    BLOCKS.forEach((b) => b.H.forEach((H) => { const hx = b.cx + H.x + H.w / 2, d = Math.abs(((x - hx) % LOOP + LOOP * 1.5) % LOOP - LOOP / 2); if (d < bd && Math.abs(H.zOff) < 1.5 && H.f.holes.some((h) => h.kind === "door")) { bd = d; H0 = H; b0 = b; } }));   // a house on the main row, with a door
    if (!H0) return;
    const door = wrapNear(b0.cx + H0.door);
    Object.assign(hero, { job: null, queue: [], inside: false, riding: 0, cycle: false, held: 0, dir: -1 });
    heroPole.visible = doorGlow.visible = false;
    showBase = door + 1.1; showZ = H0.zOff + 1.25; showT = 0; hero.x = showBase; hero.z = showZ; camX = showBase; fly = null;
  },                           // data/profile.json "character" (person() options), or the default
  drawPerson(o) { return personArt(o); },                    // a canvas with any character's 3 frames (the picker)
  bike() { if (!hero.job && !hero.queue.length) { hero.cycle = !hero.cycle; hero.follow = true; } return hero.cycle; },   // B: on or off the bike
  character: () => heroArt(),                                // its sprite (3 frames) and size, for the sidebar picture
  walk(dir, on) {                                            // A/D held: walk; taking over finishes any lighting still to do
    if (on) { if (hero.job || hero.queue.length) endJob(true); hero.held = dir; hero.follow = true; } else if (hero.held === dir) hero.held = 0;
  },
  replay(fromK) {                                            // the lights logged while the street was closed: dark again, then the character lights them in turn
    const lids = ORDER.slice(Math.max(0, fromK), litN);
    lids.forEach((lid) => { goal[lid] = lvl[lid] = 0; litBytes[lid * 4] = 0; moving.delete(lid); });
    litTex.needsUpdate = true; heroGo(lids); return lids.length;
  },
  finish() { endJob(true); },                                // skip: every light still to do comes on now
  errands: () => hero.queue.length + (hero.job ? 1 : 0),
  get x() { return camX; }, get loop() { return LOOP; },
  setTime(t) { T = t; },                                     // test pages: jump the scene clock (where the tram is)
  step(n = 1) { for (let i = 0; i < n; i++) { const now = performance.now(); last = now - 40; update(now); } },   // test pages: advance frames by hand (hidden windows don't animate)
  where() { return { x: camX, loop: LOOP, blocks: BLOCKS.map((b) => [b.def.name, b.cx, b.w]), hero: { x: hero.x, z: hero.z, riding: hero.riding, inside: hero.inside, job: hero.job && [hero.job.kind, hero.job.phase, hero.job.k], queue: hero.queue.length } }; },
  dragged() { const d = !!canvasEl._dragged; canvasEl._dragged = false; return d; }
};
