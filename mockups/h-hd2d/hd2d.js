/* Mockup H v2: an Amsterdam canal built from scratch in the HD-2D style (Octopath Traveler).
 *
 * v2 fixes what a side-by-side with Octopath Traveler II screenshots showed was missing:
 *   camera     looks down ~30°: the street and canal are the stage, roofs show
 *   focus      depth-based bokeh (real distance, per-sample), a blurred near quay framing the bottom
 *   light      almost no fill; warm pools and deep shadows; mist over the water
 *   detail     hand-shaded pixel art (every brick and cobble has a lit and a shadowed edge, soot),
 *              a cafe with an awning and tables, a shop window, signs, ivy, barrels, crates, planters,
 *              bike racks, moored boats, a bridge outlined in bulbs, a string of lights
 *   people     pixel sprites with walk cycles and blob shadows
 *   water      dark, soft reflections, many small glints (densest along the moonlight)
 *   grade      warm, slightly desaturated, soft bloom haze, strong vignette, fine grain
 * Units are metres. Houses face +z. Street z 0..9, canal z 9.4..19, near quay z 19..25.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

if (!document.createElement("canvas").getContext("webgl2")) {
  document.body.insertAdjacentHTML("beforeend", '<p class="msg">This needs WebGL2. In LibreWolf: about:config, set webgl.disabled to false.</p>');
  throw new Error("no webgl2");
}

// ================================================================== pixel art kit
const T0 = performance.now(), MARK = {};                    // mockup only: load timing
let seed = 1014;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
const PX = 16;                                            // pixels per metre, everywhere

function canvas(w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  return [c, g];
}
// setting fillStyle parses the colour every time; skip it when it hasn't changed (anything else that sets fillStyle resets g._c)
const R = (g, x, y, w, h, col) => { if (g._c !== col) { g.fillStyle = col; g._c = col; } g.fillRect(x, y, w, h); };
const P = (g, x, y, col) => { if (g._c !== col) { g.fillStyle = col; g._c = col; } g.fillRect(x, y, 1, 1); };
function tex(c, repeat, data) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function sprite(w, h, draw) { const [c, g] = canvas(w, h); draw(g, w, h); return tex(c); }
function shade(hex, k) {                                  // lighten (k > 0) or darken (k < 0) a colour
  const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return "#" + c.getHexString();
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
  frame: "#e6dcc6", glass: ["#121823", "#18202c", "#0e131b"], glassHi: "#3b4a60",
  lit: ["#ffe6a8", "#ffd27e", "#f2ad55", "#e0913f"], curtain: ["#a5432e", "#8e5a3a", "#6d3a5a", "#c18a4a"],
  shutter: ["#2b4a35", "#22392a"], door: { green: ["#2d4b3a", "#223a2c"], red: ["#6e2a22", "#561f19"], blue: ["#25344a", "#1b2638"] },
  stone: ["#a49c8c", "#8f877a", "#bdb5a4", "#7b7468"], iron: "#1b1a19", beam: "#4a3220", gold: "#d9b25a",
  flowers: ["#d44a3c", "#e9879a", "#f1e3c8", "#d97a2b", "#b84a8a"], leaf: ["#2f4a26", "#3d5c2f", "#25391e", "#4a6b33"],
  skin: ["#e8b896", "#c98e6a", "#8d5a3c", "#f0caa8"], hair: ["#2a1d14", "#5a3a1e", "#c9a35a", "#1a1a1a", "#8a3a1e"],
  coat: ["#3a4a6a", "#6a2e2a", "#2f4a3a", "#5a4a3a", "#7a6a4a", "#3a3a40", "#8a5a2a"]
};

// bricks with a lit top-left and a shadowed bottom-right on each brick (hand-shaded, not flat)
function bricks(g, x0, y0, w, h, pal, mortar) {
  R(g, x0, y0, w, h, mortar);
  for (let y = y0, row = 0; y < y0 + h; y += 3, row++) {
    for (let x = x0 - (row % 2) * 3; x < x0 + w; x += 6) {
      const base = rnd() < 0.05 ? shade(pick(pal), -0.08) : pick(pal);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
        const px = x + i, py = y + j;
        if (px < x0 || px >= x0 + w || py >= y0 + h) continue;
        let col = base;
        if (j === 0 && i < 2) col = shade(base, 0.05);
        if (j === 1 && i > 2) col = shade(base, -0.06);
        P(g, px, py, col);
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
  dark:   { kind: "boards", base: "#2b2d30", line: "#202225" }
};
// a 3x5 pixel font for shop signs (only the letters the street uses)
const FONT = { A: "010101111101101", B: "110101110101110", E: "111100110100111", F: "111100110100100", I: "111010010010111", J: "001001001101010",
  K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101", O: "010101101101010", R: "110101110101101", S: "011100010001110", T: "111010010010010" };
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
  const [c, g] = canvas(W, H), [ec, eg] = canvas(W, H);
  R(eg, 0, 0, W, H, "#000");
  const yB = (yFromGround, h) => H - yFromGround - h;
  const wall = WALLS[s.wall], FR = s.frame || PAL.frame, FRs = shade(FR, -0.18);
  if (wall.kind === "brick") bricks(g, 0, 0, W, H, wall.pal, wall.mortar);
  else if (wall.kind === "boards") { R(g, 0, 0, W, H, wall.base); for (let x = 3; x < W; x += 4) { R(g, x, 0, 1, H, wall.line); R(g, x + 1, 0, 1, H, shade(wall.base, 0.03)); } }
  else { R(g, 0, 0, W, H, wall.base); for (let i = 0; i < W * H / 8; i++) P(g, ri(0, W), ri(0, H), rnd() < 0.5 ? wall.hi : wall.lo);
    for (let i = 0; i < 6; i++) { const x = ri(0, W - 10), y = ri(0, H - 10); R(g, x, y, ri(4, 10), ri(3, 7), shade(wall.base, -0.04)); } }   // patched plaster
  weather(g, W, H);
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
    const y = yB(yb, h), kind = opt.lit ? (rnd() < 0.08 ? "tv" : "warm") : "dark";
    holes.push({ x: x - 1, y: y - 1, w: w + 2, h: h + 2, kind: "win", flowers: !!opt.flowers, balcony: !!opt.balcony });
    if (wall.kind === "brick" && !opt.arch) {                // a relieving arch of contrasting brick over the window
      for (let i = -1; i <= w; i++) { const t = (i + 1) / (w + 1), lift = Math.round(Math.sin(t * Math.PI) * 2); P(g, x + i, y - 3 - lift, wall.accent[(i + 8) % 2]); P(g, x + i, y - 4 - lift, wall.accent[(i + 9) % 2]); }
    }
    R(g, x - 1, y - 1, w + 2, h + 2, FR); R(g, x + w, y - 1, 1, h + 2, FRs);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      let col;
      if (kind === "warm") col = PAL.lit[Math.min(3, Math.floor(yy / h * 3.2 + (rnd() < 0.15 ? 1 : 0)))];
      else if (kind === "tv") col = ["#b8c8e8", "#9fb2d6", "#8296bc", "#6e80a6"][Math.min(3, Math.floor(yy / h * 3.2))];
      else col = (xx - yy === 1 || xx - yy === 2) && yy < h * 0.5 ? PAL.glassHi : pick(PAL.glass);
      P(g, x + xx, y + yy, col); if (kind !== "dark") P(eg, x + xx, y + yy, col);
    }
    const ink = (px, py, pw, ph, col) => { R(g, px, py, pw, ph, col); if (kind !== "dark") R(eg, px, py, pw, ph, "#000"); };
    const extra = rnd();
    if (kind === "warm") {
      if (opt.curtain) { const cc = pick(PAL.curtain); for (const cx of [x, x + w - 2]) { ink(cx, y, 2, h, cc); R(g, cx + (cx === x ? 1 : 0), y, 1, h, shade(cc, -0.1)); } }
      else if (extra < 0.25) { const px = x + ri(2, w - 4); ink(px, y + Math.round(h * 0.5), 2, Math.round(h * 0.5), "#3a2410"); ink(px - 1, y + Math.round(h * 0.45), 4, 2, "#3a2410"); }      // someone inside
      else if (extra < 0.45) { for (let k = 0; k < 3; k++) ink(x + 1 + k * Math.floor(w / 3), y + h - 4, 3, 3, pick(PAL.leaf)); }                                                           // plants
      else if (extra < 0.6) { const px = x + ri(2, w - 6); ink(px, y + 3, 5, 3, "#7a3a1e"); ink(px + 2, y + 6, 1, 4, "#2a1a10"); }                                                      // a lamp with a shade
      else if (extra < 0.75) { for (let yy = 0; yy < h; yy += 2) for (let xx = (yy / 2) % 2; xx < w; xx += 2) P(g, x + xx, y + yy, "#f6efe0"); }                                         // lace
    } else if (kind === "dark") {
      if (extra < 0.18) { for (let yy = 1; yy < h * 0.7; yy += 2) R(g, x, y + yy, w, 1, shade(FR, -0.25)); }                                                                              // blinds
      else if (extra < 0.26) { const px = x + ri(1, w - 5); R(g, px, y + h - 4, 4, 3, "#0b0a09"); P(g, px, y + h - 5, "#0b0a09"); P(g, px + 3, y + h - 5, "#0b0a09"); }                    // a cat on the sill
    }
    // glazing: six panes (two bars) on wider windows, four on narrow ones
    const bars = w >= 13 && rnd() < 0.6 ? [Math.round(w / 3), Math.round(2 * w / 3)] : [Math.floor(w / 2)];
    bars.forEach((bx) => ink(x + bx, y, 1, h, FR));
    ink(x, y + Math.round(h * 0.42), w, 1, FR);
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
    if (kind !== "dark") lit.push({ x: (x + w / 2) / PX, y: (H - y - h / 2) / PX });
  };
  // ground floor: door with fanlight, steps, a number plaque and a bell
  const dx = Math.round(W * 0.12), dw = 17, dh = 40, dcol = PAL.door[s.door];
  R(g, dx - 1, yB(2, dh + 2), dw + 2, dh + 2, PAL.stone[0]); R(g, dx + dw + 1, yB(2, dh + 2), 1, dh + 2, PAL.stone[3]);
  R(g, dx, yB(2, dh), dw, dh, dcol[0]);
  for (let k = 0; k < 3; k++) { R(g, dx + 2, yB(2 + 4 + k * 10, 7), dw - 4, 7, dcol[1]); R(g, dx + 2, yB(2 + 4 + k * 10, 7), dw - 4, 1, shade(dcol[0], 0.06)); }
  P(g, dx + dw - 3, yB(2 + 15, 1), PAL.gold); P(g, dx + dw - 3, yB(2 + 14, 1), shade(PAL.gold, -0.2));
  if (s.doorStyle === "double") { R(g, dx + Math.floor(dw / 2), yB(2, dh), 1, dh, shade(dcol[0], -0.25)); P(g, dx + Math.floor(dw / 2) - 2, yB(2 + 18, 1), PAL.gold); }
  else if (s.doorStyle === "carved") {                     // a carved sunburst in the upper panel
    const cy = yB(2 + dh - 12, 1), cx = dx + Math.floor(dw / 2);
    for (let a = 0; a < 7; a++) { const t = Math.PI * (a + 0.5) / 7; line(g, cx, cy, Math.round(cx + Math.cos(t) * 6), Math.round(cy - Math.sin(t) * 6), shade(dcol[0], 0.14)); }
    R(g, cx - 1, cy - 1, 3, 2, PAL.gold);
  } else if (s.doorStyle === "glass") {                    // glazed upper half behind an iron grille
    const gy = yB(2 + dh - 17, 13);
    R(g, dx + 3, gy, dw - 6, 13, s.fanLit ? PAL.lit[2] : PAL.glass[1]); if (s.fanLit) R(eg, dx + 3, gy, dw - 6, 13, PAL.lit[3]);
    for (let x = dx + 4; x < dx + dw - 3; x += 3) { R(g, x, gy, 1, 13, PAL.iron); R(eg, x, gy, 1, 13, "#000"); }
    R(g, dx + 3, gy + 6, dw - 6, 1, PAL.iron); R(eg, dx + 3, gy + 6, dw - 6, 1, "#000");
  }
  if (s.plaque) gableStone(g, dx + Math.floor(dw / 2) - 6, yB(52, 10), s.plaque);
  R(g, dx + dw + 3, yB(20, 3), 4, 3, "#2a4a8a"); P(g, dx + dw + 4, yB(21, 1), "#f0f0f0"); P(g, dx + dw + 5, yB(21, 1), "#f0f0f0");   // blue enamel house number
  R(g, dx + dw + 3, yB(14, 4), 2, 4, "#8a7a5a"); P(g, dx + dw + 3, yB(16, 1), PAL.gold);                                              // bell plate
  const fan = yB(2 + dh + 1, 6);
  for (let i = 0; i < dw; i++) for (let j = 0; j < 6; j++) if (Math.hypot(i - dw / 2 + 0.5, (j - 6) * 1.6) < dw / 2) { const col = s.fanLit ? PAL.lit[1] : PAL.glass[0]; P(g, dx + i, fan + j, col); if (s.fanLit) P(eg, dx + i, fan + j, col); }
  for (let i = 1; i < dw; i += 3) P(g, dx + i, fan + 5, FR);
  holes.push({ x: dx, y: fan, w: dw, h: H - 2 - fan, kind: "door" });
  R(g, dx - 3, yB(0, 2), dw + 6, 2, PAL.stone[2]); R(g, dx - 2, yB(2, 1), dw + 4, 1, PAL.stone[0]);
  let shop = null;
  if (s.shop) {
    const sw = Math.round(W * 0.5), sx = W - sw - Math.round(W * 0.08), sh = 36, sy = yB(11, sh);
    R(g, sx - 3, sy - 9, sw + 6, 7, s.shop.frame); R(g, sx - 3, sy - 9, sw + 6, 1, shade(s.shop.frame, 0.1));                  // signboard
    if (s.shop.name) { const tw = s.shop.name.length * 4 - 1; pixelText(g, s.shop.name, sx + Math.round((sw - tw) / 2), sy - 8, s.shop.ink || PAL.gold, "rgba(0,0,0,0.55)"); }
    else for (let x = sx; x < sx + sw; x += 2) P(g, x, sy - 6, PAL.gold);
    R(g, sx - 2, sy - 2, sw + 4, sh + 4, s.shop.frame);
    holes.push({ x: sx - 2, y: sy - 2, w: sw + 4, h: sh + 4, kind: "shop" });
    for (let yy = 0; yy < sh; yy++) for (let xx = 0; xx < sw; xx++) { const col = PAL.lit[Math.min(3, Math.floor(yy / sh * 2.6))]; P(g, sx + xx, sy + yy, col); P(eg, sx + xx, sy + yy, shade(col, -0.5)); }   // dimmer glow so the display reads
    // what's inside: drawn into both images, glowing less than the light behind it
    const put = (x, y, w, h, col, glow) => { R(g, x, y, w, h, col); R(eg, x, y, w, h, glow === undefined ? shade(col, -0.7) : glow); };
    const ln = (x0, y0, x1, y1, col) => { line(g, x0, y0, x1, y1, col); line(eg, x0, y0, x1, y1, "#000"); };
    const ring = (cx, cy, r) => { for (let a = 0; a < 28; a++) { const t = a / 28 * Math.PI * 2; put(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), 1, 1, "#141210", "#000"); } };
    const disp = s.shop.display || "shelves";
    if (disp === "shelves") {                                  // the bakery: shelves of bread, loaves on the counter
      for (let k = 1; k < 3; k++) { const shelf = sy + Math.round(sh * k / 3); put(sx, shelf, sw, 1, "#5a3a20", "#000");
        for (let x = sx + 1; x < sx + sw - 3; x += ri(3, 5)) { const gc = pick(s.shop.goods); put(x, shelf - 3, 3, 3, gc); P(g, x, shelf - 3, shade(gc, 0.12)); } }
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
    for (let x = sx + Math.round(sw / 3); x < sx + sw; x += Math.round(sw / 3)) { R(g, x, sy, 1, sh, s.shop.frame); R(eg, x, sy, 1, sh, "#000"); }
    shop = { x: (sx + sw / 2) / PX, w: (sw + 8) / PX, top: (H - sy + 6) / PX };
    lit.push({ x: (sx + sw / 2) / PX, y: (H - sy - sh / 2) / PX, shop: true });
  } else {
    const gw = Math.min(30, Math.round(W * 0.4)), gx = W - gw - Math.round(W * 0.12);
    win(gx, 15, gw, 34, { lit: s.groundLit, curtain: true });
    R(g, gx + 2, yB(3, 8), gw - 4, 8, "#0d0c0b"); for (let x = gx + 3; x < gx + gw - 3; x += 3) R(g, x, yB(3, 8), 1, 8, PAL.iron);
  }
  for (let f = 0; f < s.floors; f++) for (let k = 0; k < s.cols; k++) {
    const ww = 13, wh = Math.round(fh * 0.62), cx = Math.round(W * (k + 1) / (s.cols + 1));
    win(cx - Math.floor(ww / 2), groundH + f * fh + Math.round((fh - wh) * 0.42), ww, wh,
      { lit: rnd() < s.litShare, curtain: rnd() < 0.35, shutters: s.shutters && f < s.floors - 1, flowers: s.flowers && f === 0 && s.balcony !== 1, arch: s.arch,
        balcony: s.balcony === f + 1 && (s.cols === 2 || k === 1) });
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
  {                                                         // one gradient per house so repeated bricks don't read flat (Octopath does this per object)
    const gr = g.createLinearGradient(0, 0, 0, H), k = 0.18 + rnd() * 0.14;
    gr.addColorStop(0, `rgba(255,236,210,${(0.03 + rnd() * 0.04).toFixed(3)})`); gr.addColorStop(0.45, "rgba(0,0,0,0)"); gr.addColorStop(1, `rgba(18,12,8,${k.toFixed(3)})`);
    g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g._c = null; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over";
  }
  return { map: tex(c), emissive: tex(ec), W, H, Eh, Gh, lit, shop, doorX: (dx + dw / 2) / PX, holes, bands, mask, dw };
}

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
  for (let y = y0, row = 0; y < yEnd; y += 5, row++) for (let x = (row % 2) * 3 - 3; x < W; x += 6) {
    const worn = Math.exp(-Math.pow((y - mid) / ((yEnd - y0) * 0.22), 2)) * 0.5;
    let b = pick(["#5d564c", "#4f4840", "#6a6256", "#575047", "#625a4f", "#544c43"]);
    if (rnd() < worn) b = shade(b, 0.06);
    if (rnd() < 0.04) b = shade(b, -0.1);                                                                        // a sunken stone
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
      if ((i === 0 || i === 4) && (j === 0 || j === 3)) continue;
      let col = b;
      if (j === 0 || (i === 0 && j === 1)) col = shade(b, 0.07);
      if (j === 3 || (i === 4 && j === 2)) col = shade(b, -0.08);
      P(g, x + i, y + j, col);
    }
    if (rnd() < 0.06) P(g, x + 5, y + ri(0, 3), pick(["#2c4422", "#3d5a2c"]));                                     // moss in the joints
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

/* Trees are flat pixel-art sprites, like the people (HD-2D: built things are 3D, living things are
   sprites; he asked for this 2026-10-23, the cylinder trees looked like 3D models). Each tree is two
   cards that turn to the camera, half a metre apart: a dark back crown, and in front of it the trunk,
   limbs and the lit front clumps, with gaps where the limbs show. Drawn at the scene's 16 px per
   metre: lit from the upper left, dark underneath, a dark rim around every clump. */
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
const billboards = [], critters = [], dynamic = [];   // dynamic: animated meshes the static merge must leave alone
function tree(x, z, mix) {
  const soil = add(new THREE.PlaneGeometry(1.5, 1.5), std({ color: 0x1c1610, roughness: 1 }), x, 0.015, z, { noCast: true }); soil.rotation.x = -Math.PI / 2;
  const t = treeSprites(mix), g = new THREE.Group();
  const card = (map, dz) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(TW / PX, TH / PX), std({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.14, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }));
    m.position.set(0, TH / PX / 2, dz); m.castShadow = m.receiveShadow = true; g.add(m);
  };
  card(t.back, -0.5); card(t.front, 0);
  g.position.set(x, 0, z); scene.add(g); billboards.push(g);
}

MARK.textures = performance.now() - T0;
// ================================================================== renderer, scene, camera
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
// Speed (2026-10-27, he said it's heavy): render at most ~1280 px wide and let the browser upscale
let maxW = 1280;
let renderScale = () => Math.min(devicePixelRatio, 1.5, maxW / innerWidth);
let PR = renderScale();
renderer.setPixelRatio(PR);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;                       // shadow maps are drawn on the first frames only: 19 extra scene renders per frame saved
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x121726, 0.009);
const camera = new THREE.PerspectiveCamera(19, innerWidth / innerHeight, 1, 900);
const HOME = new THREE.Vector3(0, 17.5, 88);
camera.position.copy(HOME);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 7, 3);
controls.enableDamping = true; controls.enablePan = false;
controls.minDistance = 22; controls.maxDistance = 120;
controls.minPolarAngle = Math.PI * 0.18; controls.maxPolarAngle = Math.PI * 0.49;
/* Camera presets to compare. A wide lens close to tall houses makes them taper toward the bottom
   (keystoning); a long lens from farther away keeps them upright, the way Octopath frames towns. */
const CAMS = {
  a: { fov: 37, pos: [0, 26, 44], target: [0, 5, 6] },
  b: { fov: 21, pos: [0, 30.5, 77], target: [0, 6.5, 4] },          // ~18° down: facades upright, more of each house
  c: { fov: 23, pos: [0, 49, 62], target: [0, 4, 7] },              // ~39° down: plaza view, the street is the stage
  d: { fov: 19, pos: [0, 17.5, 88], target: [0, 7, 3] },            // ~7° down: straight on, barely above (his pick, 2026-10-23)
  e: { fov: 20, pos: [0, 38, 74], target: [0, 5, 3] }               // ~25° down: closer to Octopath's walking camera (to compare, 2026-10-27)
};
function setCam(k) {
  const p = typeof k === "string" ? CAMS[k] : k;
  camera.fov = p.fov; camera.updateProjectionMatrix();
  camera.position.set(...p.pos); controls.target.set(...p.target); HOME.set(...p.pos);
  controls.update();
  document.querySelectorAll("[data-cam]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.cam === k));
}
document.querySelectorAll("[data-cam]").forEach((b) => b.addEventListener("click", () => setCam(b.dataset.cam)));
window.__setCam = setCam;   // mockup only: lets screenshots switch presets
setTimeout(() => { window.__dbg = { scene, mists, water, bloom, dof, grade, renderer, lamps, THREE }; }, 0);   // mockup only: inspect layers from the console
controls.minAzimuthAngle = -0.6; controls.maxAzimuthAngle = 0.6;
let touched = -1e9;
controls.addEventListener("start", () => { touched = performance.now(); });

/* Materials. Every distinct material feature set is a GPU program, and on his PC (AMD integrated, D3D11) each one
   took ~0.25 s to compile: 35 programs = 8 s before the first frame. So almost everything is one of two Lambert
   programs: opaque (map + glow map) or cut-out (the same, alpha-tested, both sides). Only the wet street is
   physically based. ?mat=std brings back the old materials for comparison. */
const FULL_PBR = new URLSearchParams(location.search).get("mat") === "std";
const px1 = (v) => { const t = new THREE.DataTexture(new Uint8Array([v, v, v, 255]), 1, 1); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
const WHITE_TEX = px1(255), BLACK_TEX = px1(0);
const std = (o) => {
  if (FULL_PBR || o.roughnessMap) return new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9 }, o));
  const cut = o.alphaTest > 0 || o.side === THREE.DoubleSide;
  return new THREE.MeshLambertMaterial({
    map: o.map || WHITE_TEX, color: o.color !== undefined ? o.color : 0xffffff,
    emissiveMap: o.emissiveMap || (o.emissive !== undefined ? WHITE_TEX : BLACK_TEX), emissive: o.emissive !== undefined ? o.emissive : 0x000000,
    emissiveIntensity: o.emissiveIntensity !== undefined ? o.emissiveIntensity : 1,
    alphaTest: cut ? 0.5 : 0, side: cut ? THREE.DoubleSide : THREE.FrontSide
  });
};
function add(geo, mat, x, y, z, opts) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  m.castShadow = !(opts && opts.noCast); m.receiveShadow = true;
  scene.add(m); return m;
}

// ================================================================== houses
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
function revealMat(wall) {
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
  slab.scale.setScalar(1 / PX); slab.position.set(x0, 0, zOff - FDEPTH); slab.castShadow = slab.receiveShadow = true; scene.add(slab);
  // the window and door art at the back of each opening
  f.holes.forEach((h) => {
    const g = new THREE.PlaneGeometry(h.w / PX, h.h / PX), u = g.attributes.uv;
    const u0 = h.x / W, u1 = (h.x + h.w) / W, v0 = 1 - (h.y + h.h) / H, v1 = 1 - h.y / H;
    for (let i = 0; i < u.count; i++) u.setXY(i, u0 + u.getX(i) * (u1 - u0), v0 + u.getY(i) * (v1 - v0));
    const back = new THREE.Mesh(g, capMat); back.receiveShadow = true;
    back.position.set(x0 + (h.x + h.w / 2) / PX, (H - h.y - h.h / 2) / PX, zOff - FDEPTH + 0.015); scene.add(back);
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
      add(...trimBox((h.w + 12) / PX, 0.15, 0.6), cx, 0.075, zOff + 0.3);                                     // stoop step
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.85, 0.05), std({ color: 0x15130f, roughness: 0.5, metalness: 0.5 }), cx + sx * ((h.w + 10) / PX / 2), 0.57, zOff + 0.55);
    }
  });
  f.bands.forEach((yb) => add(...trimBox(W / PX + 0.04, 0.11, 0.12), x0 + W / PX / 2, (yb + 1) / PX, zOff + 0.06));
  if (!f.mask) {                                                                     // a deep cornice with a shadowed underside
    add(...trimBox(W / PX + 0.3, 0.32, 0.55), x0 + W / PX / 2, H / PX - 0.2, zOff + 0.22);
    add(...trimBox(W / PX + 0.1, 0.14, 0.32), x0 + W / PX / 2, H / PX - 0.46, zOff + 0.12);
  }
}
const roofMat = std({ map: tex(roofTiles, [1, 1]), roughness: 0.8 });
const cafeSpots = [], shopLights = [], HX = [];
const bracketMat = std({ color: 0x16140f });
// window light thrown onto the street: a pixel trapezoid with the glazing bars in it, added on top (cheap drama)
const spillTex = sprite(16, 24, (g) => { for (let y = 0; y < 24; y++) { const v = Math.pow(1 - y / 24, 1.4); for (let x = 0; x < 16; x++) { const bar = x === 5 || x === 10 || y === 9; const k = v * (bar ? 0.25 : 1) * (x === 0 || x === 15 ? 0.6 : 1); P(g, x, 23 - y, `rgb(${Math.round(255 * k)},${Math.round(176 * k)},${Math.round(92 * k)})`); } } });
const spillMat = new THREE.MeshBasicMaterial({ map: spillTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
function spill(x, z0, w) {
  const near = z0 + 0.4, far = z0 + 3.6, geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute([x - w / 2, 0.02, near, x + w / 2, 0.02, near, x + w * 0.8, 0.02, far, x - w * 0.8, 0.02, far], 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); geo.setIndex([0, 2, 1, 0, 3, 2]);
  const m = new THREE.Mesh(geo, spillMat); m.renderOrder = 2; scene.add(m);
}
let hx = -HOUSES.reduce((a, h) => a + h.w, 0) / 2;
HOUSES.forEach((s, i) => {
  const f = facade(s), w = f.W / PX, h = f.H / PX, eave = f.Eh / PX;
  const zOff = [0.1, -0.15, 0, -0.25, 0.15, -0.1, 0.2, -0.2, 0.05, -0.1, 0.12][i % 11];
  buildFacade(f, s, hx, zOff, std({ map: f.map, emissiveMap: f.emissive, emissive: 0xffffff, emissiveIntensity: 1.25, roughness: 0.92 }));
  const sm = std({ map: tex(sideWall, [DEPTH / 2, eave / 2]), roughness: 0.95 });
  add(new THREE.BoxGeometry(w, eave, DEPTH), sm, hx + w / 2, eave / 2, zOff - FDEPTH - DEPTH / 2 - 0.02);
  const tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(w, 0); tri.lineTo(w / 2, (h - eave) * 0.9); tri.lineTo(0, 0);
  const roof = add(new THREE.ExtrudeGeometry(tri, { depth: DEPTH - 0.6, bevelEnabled: false }), roofMat, hx, eave, zOff - DEPTH);
  roof.geometry.computeBoundingSphere();
  add(new THREE.BoxGeometry(0.14, 0.14, 0.9), std({ color: 0x3a2818 }), hx + w / 2, h - (f.Gh / PX) * 0.2, zOff + 0.45);
  if (i % 3 !== 1) { const chx = hx + w * (rnd() < 0.5 ? 0.3 : 0.7), chz = zOff - DEPTH * (0.45 + rnd() * 0.3);
    add(new THREE.BoxGeometry(0.7, 2.0, 0.7), std({ map: tex(sideWall, [0.4, 1]) }), chx, eave + (h - eave) * 0.55, chz);
    add(new THREE.BoxGeometry(0.85, 0.15, 0.85), std({ color: 0x8f877a }), chx, eave + (h - eave) * 0.55 + 1.05, chz); }
  if (s.awning) {                                          // a striped awning over the shop window
    const aw = add(new THREE.PlaneGeometry(f.shop.w, 1.5), std({ map: awningTex(s.awning[0], s.awning[1]), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), hx + f.shop.x, f.shop.top - 0.62, zOff + 0.65);   // below the signboard, so the shop's name shows
    aw.rotation.x = -1.05;
    // a sign hanging from an iron bracket over the door (faces the street, as in Octopath)
    const sx2 = hx + f.doorX;
    add(new THREE.BoxGeometry(0.05, 0.05, 1.0), bracketMat, sx2, 4.15, zOff + 0.5);
    add(new THREE.BoxGeometry(0.7, 0.04, 0.04), bracketMat, sx2, 4.15, zOff + 0.92);                        // crossbar the chains hang from
    add(new THREE.BoxGeometry(0.03, 0.22, 0.03), bracketMat, sx2 - 0.3, 4.03, zOff + 0.92); add(new THREE.BoxGeometry(0.03, 0.22, 0.03), bracketMat, sx2 + 0.3, 4.03, zOff + 0.92);
    add(new THREE.PlaneGeometry(0.85, 0.64), std({ map: signTex(s.sign), side: THREE.DoubleSide }), sx2, 3.6, zOff + 0.92);
  }
  f.lit.forEach((L) => {
    // only two shops spill real light onto the street (speed); the rest just glow
    if (L.shop && (s.cafe || s.shop.name === "BAKKERIJ")) { const pl = new THREE.PointLight(0xffb45c, 22, 11, 2); pl.position.set(hx + L.x, 1.6, zOff + 1.6); scene.add(pl); shopLights.push(pl); }
  });
  f.lit.forEach((L) => { if (L.y < 3.6) spill(hx + L.x, zOff, L.shop ? f.shop.w - 0.7 : 1.6); });
  if (s.lantern) {                                          // a wall lantern beside the door (glows; no extra light, for speed)
    const lx = hx + f.doorX + f.dw / 2 / PX + 0.35;
    add(new THREE.BoxGeometry(0.04, 0.04, 0.3), bracketMat, lx, 2.95, zOff + 0.15);
    add(new THREE.PlaneGeometry(0.32, 0.4), std({ map: lanternTex, emissiveMap: lanternTex, emissive: 0xffffff, emissiveIntensity: 2.2, side: THREE.DoubleSide }), lx, 2.72, zOff + 0.3, { noCast: true });
  }
  if (s.flag) {                                             // an Amsterdam flag on a pole out of an upper window
    const base = new THREE.Vector3(hx + w * 0.5, eave * 0.6, zOff + 0.05), dir = new THREE.Vector3(0.45, 0.62, 0.64).normalize(), tip = base.clone().addScaledVector(dir, 1.9);
    const pole = add(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6), std({ color: 0xd8d0c0 }), ...base.clone().addScaledVector(dir, 0.95).toArray());
    pole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    // the cloth hangs from the outer part of the pole: its top edge runs along the pole
    const ft = flagTex(), A = base.clone().addScaledVector(dir, 0.75), B = tip.clone().addScaledVector(dir, -0.05), fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute("position", new THREE.Float32BufferAttribute([A.x, A.y, A.z, B.x, B.y, B.z, B.x, B.y - 0.8, B.z, A.x, A.y - 0.8, A.z], 3));
    fgeo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2)); fgeo.setIndex([0, 3, 1, 1, 3, 2]); fgeo.computeVertexNormals();
    const fl = new THREE.Mesh(fgeo, std({ map: ft, alphaTest: 0.5, side: THREE.DoubleSide })); fl.castShadow = true; scene.add(fl);
    dynamic.push(fl); critters.push((t) => { ft.offset.x = (Math.floor(t * 1.6) % 2) / 2; });
  }
  HX.push({ x: hx, w, zOff, door: hx + f.doorX, dw: f.dw / PX, H: h, eave, s, f });
  if (s.cafe) cafeSpots.push(hx + w / 2);
  hx += w;
});

// ================================================================== street, quay, canal, near quay
const STREET_W = 90;
const street = add(new THREE.PlaneGeometry(STREET_W, 9), streetMat(STREET_W, 9, { pavement: true, kerbAtEnd: true, puddles: 9, manholes: [-16, 9, 22], leavesAt: [-27, -14.5, -4.5, 6.5, 26, 36], leafRow: 7.8 }), 0, 0, 4.5, { noCast: true }); street.rotation.x = -Math.PI / 2;
add(new THREE.BoxGeometry(STREET_W, 1.6, 0.4), std({ map: tex(quayStone, [STREET_W / 2, 1]) }), 0, -0.8, 9.2, { noCast: true });
const near = add(new THREE.PlaneGeometry(STREET_W, 7), streetMat(STREET_W, 7, { pavement: false, kerbAtEnd: false, puddles: 4, leavesAt: [-20, 2, 18], leafRow: 2.5 }), 0, 0, 22.4, { noCast: true }); near.rotation.x = -Math.PI / 2;
add(new THREE.BoxGeometry(STREET_W, 1.6, 0.4), std({ map: tex(quayStone, [STREET_W / 2, 1]) }), 0, -0.8, 19.0, { noCast: true });

const waterShader = {
  uniforms: { color: { value: new THREE.Color(0x05080f) }, tDiffuse: { value: null }, textureMatrix: { value: null }, time: { value: 0 }, grid: { value: new THREE.Vector2(640, 360) } },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vPos;
    void main(){ vUv = textureMatrix * vec4(position,1.0); vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform float time; uniform vec2 grid; varying vec4 vUv; varying vec3 vPos;
    float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
    void main(){
      // Octopath's water is dark, a little see-through and drawn: pixel ripples on the scene's 16 px/m grid,
      // reflections only where something bright is mirrored, broken up by the ripples (2026-10-27)
      vec2 px = floor(vPos.xy * 16.0);
      float spd = 1.0 + h21(vec2(px.y, 2.0)) * 2.0;
      vec2 cell = floor(vec2((px.x + floor(time * spd + h21(vec2(px.y, 1.0)) * 40.0)) / 9.0, px.y / 2.0));
      float n = h21(cell), tone = n < 0.2 ? -1.0 : n > 0.85 ? 1.0 : 0.0;
      vec3 c = color * 0.6 + vec3(0.002, 0.005, 0.006) + tone * vec3(0.002, 0.004, 0.005);   // linear values: tiny numbers are already visible
      c += smoothstep(3.3, 4.9, abs(vPos.y)) * vec3(0.003, 0.006, 0.005);          // shallower-looking along the quay walls
      vec2 uv = vUv.xy / vUv.w;
      uv.x += sin(px.y * 0.7 + time * 1.3) * 0.003 + (n - 0.5) * 0.005;
      uv = (floor(uv * grid) + 0.5) / grid;
      vec3 refl = texture2D(tDiffuse, uv).rgb;
      float lum = dot(refl, vec3(0.3, 0.5, 0.2));
      float keep = smoothstep(0.3, 0.8, lum) * (tone < 0.0 ? 0.25 : 1.0);          // only lamps and lit windows survive
      refl = refl * (0.04 + 0.6 * keep);
      c += refl / (1.0 + refl * 1.6);
      // glints: a few twinkling highlights on the ripple crests, densest along the moonlight (to the right)
      vec2 gc = floor(vPos.xy * vec2(5.0, 9.0));
      float moonPath = exp(-pow((vPos.x - 30.0) / 18.0, 2.0));
      float thr = 0.995 - moonPath * 0.03;
      vec2 f = fract(vPos.xy * vec2(5.0, 9.0)) - vec2(0.3 + 0.4 * h21(gc + 7.0), 0.5);
      float dash = step(abs(f.x), 0.09) * step(abs(f.y), 0.12);
      float sp = dash * step(thr, h21(gc)) * pow(0.5 + 0.5 * sin(time * 1.6 + h21(gc + 3.0) * 40.0), 8.0);
      c += mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.82, 0.55), clamp(lum, 0.0, 1.0)) * sp * (1.0 + 4.0 * lum);
      gl_FragColor = vec4(c, 1.0);
    }`
};
const water = new Reflector(new THREE.PlaneGeometry(STREET_W * 2, 9.8), {
  textureWidth: Math.round(innerWidth * 0.25), textureHeight: Math.round(innerHeight * 0.25), shader: waterShader, clipBias: 0.003,
  color: 0x05080f                                       // Reflector overwrites the shader's color with mid-grey unless given one
});
water.getRenderTarget().texture.magFilter = water.getRenderTarget().texture.minFilter = THREE.NearestFilter;
water.rotation.x = -Math.PI / 2; water.position.set(0, -1.25, 14.2);
{ const draw = water.onBeforeRender; let n = 0; water.onBeforeRender = function (...a) { if (n++ % 2 === 0) draw.apply(this, a); }; }   // reflection every other frame (speed)
scene.add(water);

// mist drifting over the water (soft, not pixel: Octopath's haze is smooth)
const mistTex = (() => {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d");
  for (let i = 0; i < 40; i++) { const x = Math.random() * 256, y = 16 + Math.random() * 32, r = 14 + Math.random() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 64); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
})();
const mists = [0, 1, 2].map((k) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(120, 7), new THREE.MeshBasicMaterial({ map: mistTex.clone(), color: 0x8090b0, transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.material.map.wrapS = THREE.RepeatWrapping; m.material.map.repeat.set(2, 1); m.material.map.needsUpdate = true;
  m.rotation.x = -Math.PI / 2; m.position.set(0, -0.9 + k * 0.45, 14.2 + (k - 1) * 1.6); scene.add(m);
  return m;
});

// ================================================================== bridge with bulbs (Amsterdam bridges are outlined in lights)
const BX = 21, BW = 7, bulbs = [];
{
  const span = 19.4 - 9.0, sh = new THREE.Shape();
  sh.moveTo(0, -1.4); sh.lineTo(span, -1.4); sh.lineTo(span, 0.0); sh.quadraticCurveTo(span / 2, 1.5, 0, 0.0); sh.lineTo(0, -1.4);
  const arch = new THREE.Path(); const ac = span / 2, ar = 3.4;
  arch.moveTo(ac - ar, -1.4); arch.absarc(ac, -1.4, ar, Math.PI, 0, true); arch.lineTo(ac - ar, -1.4);
  sh.holes.push(arch);
  const brick = (() => { const [c, g] = canvas(32, 32); bricks(g, 0, 0, 32, 32, PAL.red, PAL.mortarRed); return c; })();
  const bm = std({ map: tex(brick, [0.5, 0.5]) });
  const bridge = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: BW, bevelEnabled: false }), bm);
  bridge.rotation.y = -Math.PI / 2; bridge.position.set(BX + BW / 2, 0, 9.0); bridge.castShadow = bridge.receiveShadow = true; scene.add(bridge);
  // a ring of pale stones around the arch on both faces, standing 12 cm proud of the brick
  const ringTex = (() => { const [c, g] = canvas(16, 16); R(g, 0, 0, 16, 16, "#b9b09c"); for (let x = 0; x < 16; x += 4) R(g, x, 0, 1, 16, "#7e7666"); for (let i = 0; i < 30; i++) P(g, ri(0, 15), ri(0, 15), pick(["#a39a86", "#cfc6b2", "#8e8574"])); return tex(c, [1, 1]); })();
  const ring = new THREE.Shape(), ro = ar + 0.42;
  ring.moveTo(ac - ro, -1.4); ring.absarc(ac, -1.4, ro, Math.PI, 0, true); ring.lineTo(ac + ar, -1.4); ring.absarc(ac, -1.4, ar, 0, Math.PI, false); ring.lineTo(ac - ro, -1.4);
  [[BX - BW / 2, 1], [BX + BW / 2 + 0.12, 1]].forEach(([x]) => { const m = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.12, bevelEnabled: false, curveSegments: 24 }), std({ map: ringTex, roughness: 0.9 })); m.rotation.y = -Math.PI / 2; m.position.set(x, 0, 9.0); m.castShadow = m.receiveShadow = true; scene.add(m); });
  // bulbs along both arches (on the face toward the camera) and along the parapets
  for (let k = 0; k <= 22; k++) {
    const a = Math.PI - k / 22 * Math.PI, z = 9.0 + ac + Math.cos(a) * (ar + 0.15), y = -1.4 + Math.sin(a) * (ar + 0.15);
    if (y > -1.2) bulbs.push([BX - BW / 2 - 0.2, y, z]);
  }
  for (let k = 0; k <= 16; k++) {
    const t = k / 16, z = 9.0 + t * span, y = 0.0 + Math.sin(t * Math.PI) * 0.75 + 0.95;
    bulbs.push([BX - BW / 2 + 0.1, y, z]); bulbs.push([BX + BW / 2 - 0.1, y, z]);
  }
  // cast-iron railings: a pixel ribbon that follows the hump (rails, balusters with knobs, a post every 2 m)
  const railArt = sprite(32, 16, (g) => {
    const I = "#17140f", H2 = "#3a352c";
    R(g, 0, 0, 32, 2, I); R(g, 0, 0, 32, 1, H2); R(g, 0, 13, 32, 2, I);
    for (let x = 1; x < 32; x += 4) { R(g, x, 2, 1, 11, I); P(g, x, 6, H2); }
    R(g, 0, 0, 2, 16, I); R(g, 0, 0, 1, 16, H2);
  });
  railArt.wrapS = THREE.RepeatWrapping;
  [BX - BW / 2 + 0.1, BX + BW / 2 - 0.1].forEach((x) => {
    const N = 32, pos = [], uv = [], idx = [];
    let len = 0, prev = null;
    for (let k = 0; k <= N; k++) {
      const t = k / N, z = 9.0 + t * span, y = Math.sin(t * Math.PI) * 0.75;
      if (prev) len += Math.hypot(z - prev[0], y - prev[1]);
      prev = [z, y];
      pos.push(x, y, z, x, y + 1.0, z); uv.push(len * 16 / 32, 0, len * 16 / 32, 1);
      if (k) { const i = k * 2; idx.push(i - 2, i, i - 1, i - 1, i, i + 1); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, std({ map: railArt, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 })); m.castShadow = true; scene.add(m);
  });
}
// a string of lights between two trees along the quay
const STRING = [[-19, 4.2, 8.3], [-2, 4.2, 8.3]];      // between two lamp posts (the trees are gone)
for (let k = 0; k <= 18; k++) {
  const t = k / 18, x = STRING[0][0] + (STRING[1][0] - STRING[0][0]) * t, y = STRING[0][1] - Math.sin(t * Math.PI) * 0.8;
  bulbs.push([x, y, 8.3]);
}
const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe2b0 }), bulbs.length);   // unlit: bulbs only glow
bulbs.forEach((b, i) => bulbMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(b[0], b[1], b[2])));
scene.add(bulbMesh);

// ================================================================== props
const ironMat = std({ color: 0x16140f, roughness: 0.5, metalness: 0.5 });
const lamps = [];
/* Lamp posts are sprites too: an Amsterdam cast-iron post (stepped base, collars, a ladder bar,
   a four-pane lantern under a crown), 1 x 5.4 m. The post casts shadows; the lantern doesn't, so it
   can't block its own light. */
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
  const part = (cv, top, rows) => { const t = tex(cv); t.repeat.set(1, rows / LAMP_H); t.offset.set(0, 1 - (top + rows) / LAMP_H); return t; };
  return {
    head: { map: part(c, 0, LAMP_HEAD), em: part(ec, 0, LAMP_HEAD) },
    post: { map: part(c, LAMP_HEAD, LAMP_H - LAMP_HEAD) }
  };
})();
function lamp(x, z, shadow, noLight) {
  const g = new THREE.Group(), postH = (LAMP_H - LAMP_HEAD) / PX, headH = LAMP_HEAD / PX;
  const post = new THREE.Mesh(new THREE.PlaneGeometry(1, postH), std({ map: lampArt.post.map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 }));
  post.position.y = postH / 2; post.castShadow = true; g.add(post);
  const head = new THREE.Mesh(new THREE.PlaneGeometry(1, headH), std({ map: lampArt.head.map, emissiveMap: lampArt.head.em, emissive: 0xffffff, emissiveIntensity: 2.4, alphaTest: 0.5, side: THREE.DoubleSide }));
  head.position.y = postH + headH / 2; g.add(head);
  g.position.set(x, 0, z); scene.add(g); billboards.push(g);
  const warm = [0xffb866, 0xffc98a, 0xffa955, 0xffd3a0][lamps.length % 4];      // gas-era lamps never match: vary the warmth
  const light = new THREE.PointLight(warm, 85, 0, 2);                                // the general glow on the facades
  if (shadow) {                                                                      // a brighter pool on the cobbles under the main lamps
    // the pool: a spotlight straight down with real shadows (much cheaper than a point light's six-sided shadow)
    const pool = new THREE.SpotLight(warm, 150, 10, 0.78, 0.35, 2);
    pool.position.set(x, 4.6, z); pool.target.position.set(x, 0, z); scene.add(pool, pool.target);
    pool.castShadow = true; pool.shadow.mapSize.set(512, 512); pool.shadow.bias = -0.002; pool.shadow.camera.near = 0.3; pool.shadow.camera.far = 8;
  }
  light.position.set(x, 4.85, z);
  if (!noLight) { scene.add(light); lamps.push(light); }
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 2.8, 4.4, 24, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float a = smoothstep(-2.2, 2.2, vY) * pow(abs(dot(vN, vV)), 2.0) * 0.06; gl_FragColor = vec4(vec3(1.0,0.75,0.45)*a, 1.0); }`
  }));
  cone.position.set(x, 2.25, z); scene.add(cone);
}
lamp(-19, 8.3, true); lamp(-2, 8.3, true); lamp(13, 8.3, true); lamp(30, 8.3, false);
lamp(-9, 20.0, false, true);                                     // on the near quay: out of focus, framing the shot

/* No street trees (2026-10-27, he felt they blocked the view): low planters with shrubs and flowers, and potted
   cypresses at the ends, all pixel sprites drawn like the old tree crowns (leaf clusters lit from the upper left). */
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
cypress(-27.7, 7.8); cypress(-26.3, 7.8); cypress(35.3, 7.8); cypress(36.7, 7.8);
planter2(-14.5, 7.8, [LEAVES.green, LEAVES.green], ["#e9879a", "#d8507a", "#f1e3c8"]);
planter2(-4.5, 7.8, [LEAVES.green, LEAVES.yellow], ["#f1e3c8", "#f6efe0"]);
planter2(6.5, 7.8, [LEAVES.green, LEAVES.ochre, LEAVES.yellow]);
planter2(26, 7.8, [LEAVES.green, LEAVES.green], ["#8a6ab8", "#a88ad0", "#6a4a98"]);

const bikeMat = () => std({ map: bikeTex, alphaTest: 0.5, side: THREE.DoubleSide });
function bikes(x, n) { for (let k = 0; k < n; k++) { const b = add(new THREE.PlaneGeometry(2.5, 1.5), bikeMat(), x + k * 0.55, 0.75, 7.2 + (k % 2) * 0.1); b.rotation.y = 1.25; } }
bikes(-10, 4); bikes(9.5, 3); bikes(32, 3);
function barrel(x, z) { add(new THREE.CylinderGeometry(0.34, 0.34, 0.85, 10), std({ map: woodTex("#6a4a2c") }), x, 0.43, z); }
const crateMat = std({ map: crateTex });
function crate(x, z, y, top) { const m = top ? [crateMat, crateMat, std({ map: top }), crateMat, crateMat, crateMat] : crateMat; add(new THREE.BoxGeometry(0.7, 0.7, 0.7), m, x, (y || 0) + 0.35, z); }
barrel(-12.5, 1.2); barrel(-11.8, 1.0); crate(-11.0, 1.1); crate(-11.0, 1.1, 0.7, produceTex(["#c83a2a", "#a82a20", "#d8a040"]));
barrel(17.5, 1.1); crate(18.3, 1.0);
function planter(x, z) {
  add(new THREE.BoxGeometry(0.9, 0.55, 0.9), std({ map: woodTex("#3a2a1c") }), x, 0.28, z);
  const b = add(new THREE.PlaneGeometry(1.2, 0.72), std({ map: bushTex, alphaTest: 0.5, side: THREE.DoubleSide }), x, 0.85, z); b.rotation.y = 0.2;
}
planter(-22, 1.0); planter(3.5, 1.1); planter(24, 1.0);
// cafe tables outside the cafe
const cafeX = cafeSpots[0];
const tableMat = std({ color: 0x1c1a18, roughness: 0.4, metalness: 0.6 });
const chairMat = std({ map: woodTex("#5a3a22") });
[[-1.6, 2.4], [0.6, 2.6]].forEach(([dx, z]) => {
  add(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12), tableMat, cafeX + dx, 0.75, z);
  add(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 6), tableMat, cafeX + dx, 0.37, z);
  add(new THREE.BoxGeometry(0.42, 0.45, 0.42), chairMat, cafeX + dx - 0.7, 0.23, z);
  add(new THREE.BoxGeometry(0.42, 0.45, 0.42), chairMat, cafeX + dx + 0.7, 0.23, z);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), std({ color: 0xfff0d0, emissive: 0xffc070, emissiveIntensity: 3 }), cafeX + dx, 0.83, z, { noCast: true });   // a candle
});
// (the candle's point light was dropped for speed: the flames still glow)
// moored boats
function boat(x, z, lantern) {
  const g = new THREE.Group(); g.position.set(x, -1.15, z); scene.add(g);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.55, 1.7), std({ map: woodTex("#3a2a1c") })); hull.castShadow = hull.receiveShadow = true; g.add(hull);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 1.3), std({ color: 0x7a2a22 })); seat.position.y = 0.34; g.add(seat);
  if (lantern) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.2), std({ map: lanternTex, emissiveMap: lanternTex, emissive: 0xffffff, emissiveIntensity: 2.4 })); l.position.set(2.3, 0.6, 0); g.add(l); }
}
boat(-6, 10.6, true); boat(4.5, 10.6, false); boat(-25, 10.6, false);

// ------------------------------------------------------------ the street's personality (2026-10-27)
const spriteMats = new Map();                              // one material per sprite image, so the merge can batch them
const spriteAt = (map, w, h, x, y, z, cast) => { if (!spriteMats.has(map)) spriteMats.set(map, std({ map, alphaTest: 0.5, side: THREE.DoubleSide })); return add(new THREE.PlaneGeometry(w, h), spriteMats.get(map), x, y, z, cast ? undefined : { noCast: true }); };
// hollyhocks against the walls beside some doors, pots of geraniums by another
HX.forEach((H) => {
  if (H.s.hollyhock) { spriteAt(hollyhockTex, 0.75, 2.12, H.door - H.dw / 2 - 0.5, 1.06, H.zOff + 0.3, true); spriteAt(hollyhockTex, 0.7, 1.9, H.door - H.dw / 2 - 1.05, 0.95, H.zOff + 0.4, true); }
  if (H.s.pots) for (const side of [-1, 1]) spriteAt(potTex, 0.62, 0.62, H.door + side * (H.dw / 2 + 0.4), 0.31, H.zOff + 0.4);
});
{ // the flower shop's stall: a bench of buckets, more on the cobbles
  const F = HX[2], cx = F.x + F.f.shop.x;
  add(new THREE.BoxGeometry(2.2, 0.5, 0.55), std({ map: woodTex("#4a3220") }), cx, 0.25, F.zOff + 0.9);
  const stall = sprite(36, 16, (g) => { for (let x = 1; x < 34; x += 6) { R(g, x, 10, 5, 6, "#5a5a62"); R(g, x, 10, 5, 1, "#7a7a84"); const fc = pick(PAL.flowers); for (let k = 0; k < 22; k++) P(g, x + ri(-1, 5), ri(1, 10), rnd() < 0.6 ? fc : pick(PAL.leaf)); } });
  spriteAt(stall, 2.25, 1.0, cx, 1.0, F.zOff + 0.95, true);
  spriteAt(stall, 1.6, 0.72, cx + 0.2, 0.36, F.zOff + 1.55);
}
spriteAt(chalkTex, 0.6, 0.8, HX[5].door - 0.9, 0.4, HX[5].zOff + 0.9, true);                       // the cafe's chalkboard
{ const B = HX[7]; const b = spriteAt(bikeTex, 2.3, 1.38, B.x + B.f.shop.x - 0.3, 0.69, B.zOff + 1.1, true); }   // a bike for sale outside the bike shop
{ const K = HX[9], cx = K.x + K.f.shop.x + 0.6;                                                        // a book cart outside the bookshop
  const spines = sprite(16, 8, (g) => { for (let x = 0; x < 16; x++) { const c = pick(["#7a2a22", "#2a4a6a", "#5a6a3a", "#c8a060", "#d8d0c0"]); R(g, x, ri(0, 2), 1, 8, c); } });
  const wood = std({ map: woodTex("#5a3a22") });
  add(new THREE.BoxGeometry(1.3, 0.75, 0.55), [wood, wood, std({ map: spines }), wood, wood, wood], cx, 0.6, K.zOff + 0.9);
  for (const dx of [-0.55, 0.55]) add(new THREE.BoxGeometry(0.06, 0.25, 0.06), std({ color: 0x1c1a16 }), cx + dx, 0.12, K.zOff + 0.9);
}
{ // an advertising column (reclamezuil) under the trees
  const x = 1.8, z = 7.35, green = std({ color: 0x26392c });
  add(new THREE.CylinderGeometry(0.6, 0.62, 0.3, 16), green, x, 0.15, z);
  add(new THREE.CylinderGeometry(0.52, 0.52, 2.5, 16), std({ map: posterTex }), x, 1.55, z);
  add(new THREE.CylinderGeometry(0.64, 0.6, 0.16, 16), green, x, 2.88, z);
  const dome = add(new THREE.SphereGeometry(0.56, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), green, x, 2.95, z); dome.scale.y = 0.55;
  add(new THREE.SphereGeometry(0.07, 8, 6), std({ color: 0xc8a050 }), x, 3.32, z);
}
{ // bunting across the bike shop and its neighbours
  const A = HX[6], Bh = HX[8], x0 = A.x + 0.4, x1 = Bh.x + Bh.w * 0.6, y0 = 4.95, z = 0.55, N = 30, pos = [], uv = [], idx = [];
  let len = 0, prev = null;
  for (let k = 0; k <= N; k++) {
    const t = k / N, x = x0 + (x1 - x0) * t, y = y0 - Math.sin(t * Math.PI) * 0.5;
    if (prev) len += Math.hypot(x - prev[0], y - prev[1]); prev = [x, y];
    pos.push(x, y - 0.62, z, x, y, z); uv.push(len * 16 / 32, 0, len * 16 / 32, 1);
    if (k) { const i = k * 2; idx.push(i - 2, i, i - 1, i - 1, i, i + 1); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, std({ map: buntingTex, alphaTest: 0.5, side: THREE.DoubleSide })); m.castShadow = true; scene.add(m);
  for (const [hx2, H2] of [[x0, A], [x1, Bh]]) add(new THREE.BoxGeometry(0.04, 0.04, z - H2.zOff), bracketMat, hx2, y0, (z + H2.zOff) / 2);   // hooks in the walls
}
for (let k = 0; k < 7; k++) { const p2 = add(new THREE.PlaneGeometry(0.3, 0.4), std({ map: paperTex }), -24 + rnd() * 48, 0.012, 1.4 + rnd() * 6, { noCast: true }); p2.rotation.set(-Math.PI / 2, 0, rnd() * 6.28); }
// a cat on the cafe's cornice, pigeons on the bookshop's cornice and on the cobbles
const critter = (map, w, h, x, y, z, flip, every) => {
  const m = add(new THREE.PlaneGeometry(w, h), std({ map: map.clone(), alphaTest: 0.5, side: THREE.DoubleSide }), x, y + h / 2, z, { noCast: true });
  m.material.map.needsUpdate = true; billboards.push(m); if (flip) m.scale.x = -1;
  const ph = rnd() * 10; critters.push((t) => { m.material.map.offset.x = (Math.floor((t + ph) / every) % 3 === 0 ? 1 : 0) / 2; });
};
{ const C = HX[5]; critter(catTex, 0.78, 0.62, C.x + 1.4, C.H - 0.04, C.zOff + 0.3, false, 1.7); }
{ const K = HX[9]; critter(pigeonTex, 0.44, 0.38, K.x + 2.0, K.H - 0.04, K.zOff + 0.35, false, 1.1); critter(pigeonTex, 0.44, 0.38, K.x + 2.6, K.H - 0.04, K.zOff + 0.35, true, 0.9); }
[[2.6, 4.2, false], [3.1, 4.6, true], [3.7, 4.1, false], [-7.2, 5.4, true]].forEach(([x, z, fl]) => critter(pigeonTex, 0.44, 0.38, x, 0, z, fl, 0.45 + rnd() * 0.5));
// near quay: railing, bushes and a bench, all out of focus
const railTex = sprite(64, 12, (g) => { R(g, 0, 0, 64, 2, "#14110e"); for (let x = 0; x < 64; x += 6) R(g, x, 0, 2, 12, "#14110e"); });
railTex.wrapS = THREE.RepeatWrapping; railTex.repeat.set(14, 1);
add(new THREE.PlaneGeometry(STREET_W, 1.1), std({ map: railTex, alphaTest: 0.5, side: THREE.DoubleSide }), 0, 0.55, 19.4);
// big and dark: out of focus they become soft shapes along the bottom edge, the way Octopath frames its shots
for (let k = 0; k < 9; k++) { const sc = 1.6 + rnd() * 0.8, b = add(new THREE.PlaneGeometry(2.6 * sc, 1.6 * sc), std({ map: bushTex, color: 0x8a8a8a, alphaTest: 0.5, side: THREE.DoubleSide }), -36 + k * 8.5 + rnd() * 3, 0.8 * sc, 21.6 + rnd() * 2.0); b.rotation.y = (rnd() - 0.5) * 0.6; }
add(new THREE.BoxGeometry(2.0, 0.12, 0.6), std({ map: woodTex("#5a3a22") }), 4, 0.5, 20.6); add(new THREE.BoxGeometry(2.0, 0.6, 0.1), std({ map: woodTex("#5a3a22") }), 4, 0.8, 20.9);
for (const dx of [-0.85, 0.85]) add(new THREE.BoxGeometry(0.08, 0.44, 0.55), bracketMat, 4 + dx, 0.22, 20.62);   // the bench's iron legs (it floated before)
// far skyline behind the roofs
skylineTex.wrapS = THREE.RepeatWrapping;
const skyline = new THREE.Mesh(new THREE.PlaneGeometry(260, 52), new THREE.MeshBasicMaterial({ map: skylineTex, transparent: true, alphaTest: 0.1, color: 0x8a8a9a }));
skyline.position.set(0, 9, -60); skyline.scale.set(1, 0.7, 1); scene.add(skyline);   // low behind the roofs (the straight-on camera sees more of it)

// ================================================================== people
const people = [];
const PH = 2.47, PW = PH * FW / FH;                                   // people drawn 1.3x: Octopath shrinks the world around its characters
function addPerson(opts) {
  const t = person(opts);
  const mesh = add(new THREE.PlaneGeometry(PW, PH), std({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), opts.x, PH / 2 + (opts.y || 0), opts.z, { noCast: true });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1, 0.55, 1); shadow.position.set(opts.x, 0.02 + (opts.y || 0), opts.z); scene.add(shadow);
  if (opts.sit) mesh.scale.set(1, 1, 1);
  if (opts.dog) { opts.dogMesh = add(new THREE.PlaneGeometry(1.0, 0.62), std({ map: dogTex.clone(), alphaTest: 0.5, side: THREE.DoubleSide }), opts.x + 1, 0.31, opts.z + 0.35, { noCast: true }); opts.dogMesh.material.map.needsUpdate = true; dynamic.push(opts.dogMesh); }
  people.push(Object.assign({ mesh, shadow, t, phase: rnd() * 10, home: opts.x }, opts));
}
// the people of the street, each with a look and something that says who they are
addPerson({ x: -20, z: 3.2, speed: 1.15, from: -36, to: 36, coat: "#3a5a4a", hairStyle: "long", hair: "#8a3a1e", scarf: "#b83a3a", bag: "#c8a070", legs: "#2a2228", blush: true });
addPerson({ x: 12, z: 4.6, speed: -0.95, from: -36, to: 36, coat: "#6a4a2a", hat: "cap", hatCol: "#4a4a48", glasses: true, legs: "#2a2a34" });
addPerson({ x: -2, z: 5.6, speed: 1.0, from: -36, to: 36, coat: "#7a2a32", long: true, hairStyle: "bun", hair: "#c9a35a", bouquet: true, tights: "#2a2028", blush: true });   // flowers from BLOEMEN
addPerson({ x: cafeX - 2.3, z: 2.4, sit: true, cup: true, coat: "#2f4a3a", hairStyle: "curly", hair: "#1a1a1a" });
addPerson({ x: cafeX + 1.3, z: 2.6, sit: true, cup: true, coat: "#c8a050", hat: "beanie", hatCol: "#3a5a7a", flip: true });
addPerson({ x: BX - 1.5, z: 14.5, y: 0.75, coat: "#3a3a40", long: true, hat: "beanie", hatCol: "#8a3a2a", scarf: "#d8c8a0" });
addPerson({ x: -18.7, z: 3.0, talk: true, coat: "#4a3a2a", long: true, hat: "bowler", hatCol: "#1e1a18", beard: "#c8c4b8", cane: true, hairStyle: "bald", hair: "#c8c4b8" });   // two neighbours talking
addPerson({ x: -17.7, z: 3.0, talk: true, flip: true, coat: "#3a4a6a", hat: "scarf", hatCol: "#a83a4a", bread: true, long: true });                                              // with bread from BAKKERIJ
addPerson({ x: -12.4, z: 2.2, broom: true, apron: true, coat: "#d8d0c4", hat: "baker", legs: "#3a3a40" });                                                                     // the baker sweeping the step
addPerson({ x: 8, z: 4.0, speed: 0.8, from: -36, to: 36, coat: "#d8a830", long: true, hairStyle: "ponytail", hair: "#2a1d14", lead: true, dog: true, legs: "#2a2a34" });     // a yellow raincoat and a dog
addPerson({ x: -6.9, z: 10.6, y: -1.0, sit: true, coat: "#4a3a5a", hat: "beanie", hatCol: "#2a4a3a" });                                                                       // someone sitting in the moored boat
// a cyclist: a person sprite riding a bike sprite
const cycl = { x: -30, z: 6.4, speed: 4.2 };
const cycBike = add(new THREE.PlaneGeometry(2.5, 1.5), bikeMat(), cycl.x, 0.75, cycl.z);
const cycRider = add(new THREE.PlaneGeometry(PW, PH), std({ map: person({ coat: "#4a5a3a", scarf: "#c86a3a", hairStyle: "short", hair: "#5a3a1e" }), alphaTest: 0.5, side: THREE.DoubleSide }), cycl.x, 1.75, cycl.z);
const cycShadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 12), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false }));
cycShadow.rotation.x = -Math.PI / 2; cycShadow.scale.set(1.3, 0.35, 1); scene.add(cycShadow);

// ================================================================== light: low fill, moon rim, sky
scene.add(new THREE.HemisphereLight(0x33406a, 0x120c08, 0.1));          // little fill: Octopath's drama is contrast
const moonLight = new THREE.DirectionalLight(0x8fa6e0, 0.85);
moonLight.position.set(46, 34, 52);   // low and from the side: sills, cornices and recesses throw shadows
moonLight.castShadow = true; moonLight.shadow.mapSize.set(2048, 2048);
Object.assign(moonLight.shadow.camera, { left: -45, right: 45, top: 30, bottom: -30, near: 1, far: 160 });
scene.add(moonLight);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `varying vec3 vW; void main(){ float t = clamp(vW.y*1.6, 0.0, 1.0); vec3 c = mix(vec3(0.05,0.06,0.1), vec3(0.008,0.012,0.03), t); gl_FragColor = vec4(c,1.0); }`
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), skyMat));
const starPos = [], starPhase = [];
for (let i = 0; i < 700; i++) { const a = rnd() * Math.PI - Math.PI, e = 0.05 + rnd() * 1.3, d = 480; starPos.push(Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d, Math.sin(a) * Math.cos(e) * d); starPhase.push(rnd() * 6.28); }
const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3)); starGeo.setAttribute("phase", new THREE.Float32BufferAttribute(starPhase, 1));
const starMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, fog: false, uniforms: { time: { value: 0 } },
  vertexShader: `attribute float phase; uniform float time; varying float vA; void main(){ vA = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(time * 0.8 + phase * 7.0), 3.0); gl_PointSize = 2.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(vec3(0.9,0.93,1.0) * vA * 0.35, 1.0); }`
});
scene.add(new THREE.Points(starGeo, starMat));

// dust in the lamplight
const MOTES = 60, moteBase = [], motePos = new Float32Array(MOTES * 3);
const lampXs = [-19, -2, 13, 30];
for (let i = 0; i < MOTES; i++) moteBase.push([pick(lampXs) + (rnd() - 0.5) * 5, 0.6 + rnd() * 4.4, 8.3 + (rnd() - 0.5) * 3, rnd() * 6.28, 0.3 + rnd() * 0.7]);
const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
scene.add(new THREE.Points(moteGeo, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `void main(){ gl_PointSize = 2.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `void main(){ gl_FragColor = vec4(0.9, 0.65, 0.4, 1.0); }`
})));


// ================================================================== speed: merge the static street
/* Every object costs a draw call, twice (the canal reflection draws the scene again). Anything that never
   moves is baked into one mesh per material; billboards, people, water and particles stay separate. */
function mergeStatic() {
  const keep = new Set([...dynamic, water, ...mists, ...people.flatMap((p) => [p.mesh, p.shadow]), cycBike, cycRider, cycShadow]);
  billboards.forEach((b) => b.traverse((o) => keep.add(o)));
  scene.updateMatrixWorld(true);
  const buckets = new Map(), drop = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || keep.has(o) || o.material.isShaderMaterial || o.geometry.boundingSphere?.radius > 400) return;
    const g0 = o.geometry;
    if (!g0.attributes.position || !g0.attributes.normal || !g0.attributes.uv) return;
    const g = g0.index ? g0.toNonIndexed() : g0, groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
    const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld), v = new THREE.Vector3();
    groups.forEach((gr) => {
      const mat = Array.isArray(o.material) ? o.material[gr.materialIndex] : o.material, key = mat.uuid + (o.castShadow ? "c" : "") + (o.receiveShadow ? "r" : "");
      if (!buckets.has(key)) buckets.set(key, { mat, cast: o.castShadow, recv: o.receiveShadow, pos: [], nor: [], uv: [] });
      const b = buckets.get(key), P3 = g.attributes.position, N3 = g.attributes.normal, U2 = g.attributes.uv;
      for (let i = gr.start; i < gr.start + gr.count; i++) {
        v.fromBufferAttribute(P3, i).applyMatrix4(o.matrixWorld); b.pos.push(v.x, v.y, v.z);
        v.fromBufferAttribute(N3, i).applyMatrix3(nm).normalize(); b.nor.push(v.x, v.y, v.z);
        b.uv.push(U2.getX(i), U2.getY(i));
      }
    });
    drop.push(o);
  });
  drop.forEach((o) => o.parent.remove(o));
  buckets.forEach((b) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3)); geo.setAttribute("normal", new THREE.Float32BufferAttribute(b.nor, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
    const m = new THREE.Mesh(geo, b.mat); m.castShadow = b.cast; m.receiveShadow = b.recv; scene.add(m);
  });
  return { merged: drop.length, into: buckets.size };
}
MARK.built = performance.now() - T0;
/* Anything that neither stands on the ground (or the water) nor touches something that does is "floating".
   Run before the merge so each object is checked on its own; the result is in window.__floating. */
function findFloating() {
  scene.updateMatrixWorld(true);
  const items = [];
  scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.visible && !o.material.isShaderMaterial && o !== water && !mists.includes(o) && o.material.blending !== THREE.AdditiveBlending) {
    const b = new THREE.Box3().setFromObject(o); if (isFinite(b.min.y) && b.getSize(new THREE.Vector3()).length() < 200) items.push({ o, b }); } });
  const ok = new Set(items.filter((it) => it.b.min.y <= 0.05));
  for (let changed = true; changed;) { changed = false; for (const it of items) { if (ok.has(it)) continue; const e = it.b.clone().expandByScalar(0.05); for (const s2 of ok) if (e.intersectsBox(s2.b)) { ok.add(it); changed = true; break; } } }
  return items.filter((it) => !ok.has(it)).map((it) => ({ geo: it.o.geometry.type, at: it.b.getCenter(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)), size: it.b.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)), tex: it.o.material.map && it.o.material.map.image ? it.o.material.map.image.width + "x" + it.o.material.map.image.height : "-" }));
}
window.__floating = findFloating();
const mergeInfo = mergeStatic();
MARK.merged = performance.now() - T0;

// ================================================================== post: depth bokeh -> bloom -> haze -> grade
const W0 = () => Math.round(innerWidth * PR), H0 = () => Math.round(innerHeight * PR);
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
    float cocAt(float z){ return clamp((abs(z - focus) - inner) / outer, 0.0, 1.0) * maxR; }
    void main(){
      vec4 c0 = texture2D(tDiffuse, vUv);
      float z0 = c0.a * 100.0, r0 = cocAt(z0), m = 1.0 + z0 * 0.02;
      if (r0 < 0.5 && maxR < 0.5) { gl_FragColor = vec4(c0.rgb, 1.0); return; }
      float rot = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
      vec3 acc = c0.rgb; float wsum = 1.0;
      float R = maxR;
      for (int i = 0; i < 24; i++) {
        float fi = float(i) + 0.5, rr = sqrt(fi / 24.0) * R, a = fi * 2.39996 + rot;
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
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.62, 0.7, 0.75);
composer.addPass(bloom);
// the second, whole-screen haze bloom was dropped for speed; the main bloom is a little wider instead
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 0.86);                                         // a little desaturated
      c *= vec3(1.06, 1.0, 0.88);                                        // warm
      c += vec3(0.0, 0.006, 0.012) * (1.0 - smoothstep(0.0, 0.15, l));   // blacks lifted toward teal
      vec3 cs = clamp(c, 0.0, 1.0); c += (cs * cs * (3.0 - 2.0 * cs) - cs) * 0.35;   // a gentle S-curve on 0..1 only (HDR highlights above 1 went negative: cyan and pink)
      float v = smoothstep(1.1, 0.3, length((vUv - vec2(0.5, 0.52)) * vec2(1.2, 1.0)));
      c *= mix(0.28, 1.0, v);                                            // strong vignette
      c += (fract(sin(dot(vUv * 1000.0 + time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.012;   // grain
      gl_FragColor = vec4(c, 1.0);
    }`
});
composer.addPass(grade);
composer.addPass(new OutputPass());

let fx = true;
document.getElementById("fx").addEventListener("click", (e) => {
  fx = !fx;
  e.currentTarget.setAttribute("aria-pressed", fx); e.currentTarget.textContent = fx ? "Effects on" : "Effects off";
  bloom.enabled = grade.enabled = fx;
  dof.uniforms.maxR.value = fx ? 17 * PR : 0.0;
});

// ================================================================== loop
const clock = new THREE.Clock();
const _v = new THREE.Vector3();
function face(m) { m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z); }
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  water.material.uniforms.time.value = t;
  starMat.uniforms.time.value = t;
  grade.uniforms.time.value = t;
  mists.forEach((m, k) => { m.material.map.offset.x = t * (0.004 + k * 0.002); });
  for (let i = 0; i < MOTES; i++) {
    const m = moteBase[i];
    motePos[i * 3] = m[0] + Math.sin(t * 0.21 * m[4] + m[3]) * 0.6;
    motePos[i * 3 + 1] = m[1] + Math.sin(t * 0.13 * m[4] + m[3] * 2.0) * 0.5;
    motePos[i * 3 + 2] = m[2] + Math.cos(t * 0.17 * m[4] + m[3]) * 0.4;
  }
  moteGeo.attributes.position.needsUpdate = true;
  billboards.forEach(face);
  people.forEach((p) => {
    if (p.speed) {
      p.x += p.speed * dt;
      if (p.x > p.to) p.x = p.from; if (p.x < p.from) p.x = p.to;
      p.mesh.position.x = p.shadow.position.x = p.x;
      p.t.offset.x = (1 + Math.floor((t + p.phase) * 4) % 2) / 3;     // two walking frames
      p.mesh.position.y = PH / 2 + Math.abs(Math.sin((t + p.phase) * 6.3)) * 0.03;
    }
    else if (p.talk) p.t.offset.x = (Math.floor((t + p.phase) * 0.9) % 3 === 0 ? 1 : 0) / 3;
    else if (p.broom) {
      const sw = Math.sin((t + p.phase) * 0.35); p.x = p.home + sw * 1.2; p.mesh.position.x = p.shadow.position.x = p.x;
      p.t.offset.x = (1 + Math.floor((t + p.phase) * 2.2) % 2) / 3;
    }
    face(p.mesh);
    if (p.speed) p.mesh.scale.x = p.speed > 0 ? 1 : -1;
    else if (p.broom) p.mesh.scale.x = Math.cos((t + p.phase) * 0.35) > 0 ? 1 : -1;
    else if (p.flip) p.mesh.scale.x = -1;
    if (p.dogMesh) {
      const dir = p.speed > 0 ? 1 : -1; p.dogMesh.position.x = p.x + dir * 1.1; face(p.dogMesh); p.dogMesh.scale.x = dir;
      p.dogMesh.material.map.offset.x = (Math.floor((t + p.phase) * 6) % 2) / 2;
    }
  });
  critters.forEach((c) => c(t));
  cycl.x += cycl.speed * dt; if (cycl.x > 38) cycl.x = -38;
  cycBike.position.x = cycl.x; cycRider.position.x = cycl.x - 0.2; cycShadow.position.set(cycl.x, 0.02, cycl.z);
  face(cycBike); face(cycRider);
  lamps.forEach((l, i) => { l.intensity = 85 * (1 + Math.sin(t * 3.1 + i * 2.0) * 0.015); });
  if (performance.now() - touched > 7000) camera.position.x += ((HOME.x + Math.sin(t * 0.04) * 7) - camera.position.x) * 0.006;
  controls.update();
  camera.updateMatrixWorld();
  dof.uniforms.focus.value = -_v.set(camera.position.x * 0.3, 4.5, 2.0).applyMatrix4(camera.matrixWorldInverse).z;   // view depth of the facades and street: the sharp band
  if (frameNo++ < 3) renderer.shadowMap.needsUpdate = true;
  // dynamic resolution, like the Switch: if frames average over 24 ms for two seconds, render 128 px narrower (down to 768)
  slow = slow * 0.95 + Math.min(dt, 0.1) * 0.05;
  if (frameNo > 120 && t - lastDrop > 2 && slow > 0.024 && maxW > 768) { maxW -= 128; lastDrop = t; dispatchEvent(new Event("resize")); }
  draw();
  requestAnimationFrame(frame);
}
let frameNo = 0, slow = 0.016, lastDrop = 0;
function draw() {
  renderer.setRenderTarget(sceneRT);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  composer.render();
}
// mockup only: time n full frames (forces the GPU to finish), and count lights and draw calls
window.__setWidth = (w) => { maxW = w; dispatchEvent(new Event("resize")); };
window.__bench = (n = 20) => {
  const gl = renderer.getContext(), px = new Uint8Array(4);
  draw(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) { draw(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
  let lights = 0, shadowLights = 0; scene.traverse((o) => { if (o.isLight) { lights++; if (o.castShadow) shadowLights++; } });
  return { mergeInfo, msPerFrame: +((performance.now() - t0) / n).toFixed(1), calls: renderer.info.render.calls, lights, shadowLights, size: [renderer.domElement.width, renderer.domElement.height] };
};
MARK.beforeFirstFrame = performance.now() - T0;
// compile the GPU programs in parallel where the browser allows it, then start; a plain note shows meanwhile
renderer.compileAsync(scene, camera).catch(() => {}).then(() => {
  MARK.compiled = performance.now() - T0;
  frame();
  MARK.firstFrame = performance.now() - T0; window.__load = MARK;
  const note = document.getElementById("loading"); if (note) note.remove();
});
addEventListener("resize", () => {
  PR = renderScale(); renderer.setPixelRatio(PR); composer.setPixelRatio(PR); dof.uniforms.maxR.value = fx ? 17 * PR : 0.0;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  sceneRT.setSize(W0(), H0()); dof.uniforms.res.value.set(W0(), H0());
});
