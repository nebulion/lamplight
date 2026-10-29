"""Builds tracker/street3d.js (the 3D street). Never edit the output by hand: edit the part files here or the patches
below, then run   python mockups/h-hd2d/street-src/assemble.py
The pixel kit, facades, lamp art, shrubs and depth of field come from mockup H (../hd2d.js) by line range, patched below;
the rest from p0_head, p1_core, p2_world, p2b_blocks, p3_loop. See docs/ARCHITECTURE.md and docs/TESTING.md."""
import os, re
ST = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ST, "..", "hd2d.js")
OUT = os.path.join(ST, "..", "..", "..", "tracker", "street3d.js")
L = open(SRC, encoding="utf-8").read().split("\n")
rng = lambda a, b: "\n".join(L[a - 1:b])            # 1-based, inclusive
part = lambda n: open(os.path.join(ST, n), encoding="utf-8").read()

def sub(s, a, b, n=1):
    assert s.count(a) == n, (s.count(a), a[:100])
    return s.replace(a, b)

# ---------------------------------------------------------------- fast pixels (2026-10-28, speed: the street took 3.3 s to draw)
# P() and R() used to make one canvas call per pixel or rectangle. Now they write into a pixel buffer per canvas; the buffer
# goes to the canvas only when something else needs the canvas (drawImage onto or from it, a native fill, a texture upload).
# Anything the buffer can't do exactly (non-integer rectangles, other blend modes, alpha, filters, colour formats it
# doesn't parse) falls back to the canvas call, so the pictures come out the same.
FASTPIX = r'''const CTX = CanvasRenderingContext2D.prototype, LIVE = new Set();
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
if (self.caches) caches.keys().then((ks) => ks.forEach((k) => { if (k.startsWith("street-pictures-")) caches.delete(k); })).catch(() => {});'''

# ---------------------------------------------------------------- the pixel kit and facades, patched
kit = rng(28, 355)
kit = sub(kit, '''function shade(hex, k) {                                  // lighten (k > 0) or darken (k < 0) a colour
  const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return "#" + c.getHexString();
}''', '''const SHADES = new Map();
function shade(hex, k) {                                  // lighten (k > 0) or darken (k < 0) a colour (cached: called per pixel)
  const key = hex + k; let v = SHADES.get(key);
  if (!v) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); v = "#" + c.getHexString(); SHADES.set(key, v); }
  return v;
}''')
kit = sub(kit, '''function tex(c, repeat, data) {
  const t = new THREE.CanvasTexture(c);''', '''function tex(c, repeat, data) {
  if (c._g) flushPx(c._g);                                 // the picture must be on the canvas before it becomes a texture
  const t = new THREE.CanvasTexture(c);''')
kit = sub(kit, '''function canvas(w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  return [c, g];
}
// setting fillStyle parses the colour every time; skip it when it hasn't changed (anything else that sets fillStyle resets g._c)
const R = (g, x, y, w, h, col) => { if (g._c !== col) { g.fillStyle = col; g._c = col; } g.fillRect(x, y, w, h); };
const P = (g, x, y, col) => { if (g._c !== col) { g.fillStyle = col; g._c = col; } g.fillRect(x, y, 1, 1); };''', FASTPIX)
kit = sub(kit, '''  dark:   { kind: "boards", base: "#2b2d30", line: "#202225" }''', '''  dark:   { kind: "boards", base: "#2b2d30", line: "#202225" },
  sand:   { kind: "ashlar", base: "#a89c80", hi: "#b8ac90", lo: "#8f846a" }''')
kit = sub(kit, '''T: "111010010010010" };''', '''T: "111010010010010",
  G: "011100101101011", V: "101101101101010", H: "101101111101101", D: "110101101101110", P: "110101110100100", U: "101101101101111", C: "011100100100011", W: "101101101111101" };''')
kit = sub(kit, '''  const [c, g] = canvas(W, H), [ec, eg] = canvas(W, H);''', '''  const [c, g] = canvas(W, H), [ec, eg] = canvas(W, H), [lc, lg] = canvas(W, H);   // day image, glow, and what changes when lit''')
kit = sub(kit, '''  else { R(g, 0, 0, W, H, wall.base); for (let i = 0; i < W * H / 8; i++)''', '''  else if (wall.kind === "ashlar") {                       // sandstone blocks (the Golden Bend's mansions)
    R(g, 0, 0, W, H, wall.base);
    for (let y = 0, row = 0; y < H; y += 8, row++) { R(g, 0, y, W, 1, wall.lo); R(g, 0, y + 1, W, 1, wall.hi); for (let x = (row % 2) * 10; x < W; x += 20) R(g, x, y, 1, 8, wall.lo); }
    for (let i = 0; i < W * H / 14; i++) P(g, ri(0, W), ri(0, H), rnd() < 0.5 ? wall.hi : wall.lo);
  }
  else { R(g, 0, 0, W, H, wall.base); for (let i = 0; i < W * H / 8; i++)''')
kit = sub(kit, '''  weather(g, W, H);
  const groundH''', '''  weather(g, W, H);
  if (s.speklagen) for (let y = H - 72; y > 6; y -= 13) { R(g, 0, y, W, 2, "#c9c0ac"); R(g, 0, y + 2, W, 1, "rgba(0,0,0,0.25)"); g._c = null; }   // bands of stone in the brick (Dutch Renaissance)
  const groundH''')
# windows: every one can light up; dark image in g, lit image in lg, glow in eg
kit = sub(kit, '''    const y = yB(yb, h), kind = opt.lit ? (rnd() < 0.08 ? "tv" : "warm") : "dark";
    holes.push({ x: x - 1, y: y - 1, w: w + 2, h: h + 2, kind: "win", flowers: !!opt.flowers, balcony: !!opt.balcony });''',
'''    const y = yB(yb, h), kind = rnd() < 0.08 ? "tv" : "warm", lid = newLid("window");
    holes.push({ x: x - 1, y: y - 1, w: w + 2, h: h + 2, kind: "win", flowers: !!opt.flowers, balcony: !!opt.balcony, lid });''')
kit = sub(kit, '''    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      let col;
      if (kind === "warm") col = PAL.lit[Math.min(3, Math.floor(yy / h * 3.2 + (rnd() < 0.15 ? 1 : 0)))];
      else if (kind === "tv") col = ["#b8c8e8", "#9fb2d6", "#8296bc", "#6e80a6"][Math.min(3, Math.floor(yy / h * 3.2))];
      else col = (xx - yy === 1 || xx - yy === 2) && yy < h * 0.5 ? PAL.glassHi : pick(PAL.glass);
      P(g, x + xx, y + yy, col); if (kind !== "dark") P(eg, x + xx, y + yy, col);
    }
    const ink = (px, py, pw, ph, col) => { R(g, px, py, pw, ph, col); if (kind !== "dark") R(eg, px, py, pw, ph, "#000"); };''',
'''    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const on = kind === "warm" ? PAL.lit[Math.min(3, Math.floor(yy / h * 3.2 + (rnd() < 0.15 ? 1 : 0)))] : ["#b8c8e8", "#9fb2d6", "#8296bc", "#6e80a6"][Math.min(3, Math.floor(yy / h * 3.2))];
      P(g, x + xx, y + yy, (xx - yy === 1 || xx - yy === 2) && yy < h * 0.5 ? PAL.glassHi : pick(PAL.glass));
      P(lg, x + xx, y + yy, on); P(eg, x + xx, y + yy, on);
    }
    const ink = (px, py, pw, ph, col) => { R(lg, px, py, pw, ph, col); R(eg, px, py, pw, ph, "#000"); };   // seen only when the light is on
    const both = (px, py, pw, ph, col) => { R(g, px, py, pw, ph, col); ink(px, py, pw, ph, col); };''')
kit = sub(kit, '''      if (opt.curtain) { const cc = pick(PAL.curtain); for (const cx of [x, x + w - 2]) { ink(cx, y, 2, h, cc); R(g, cx + (cx === x ? 1 : 0), y, 1, h, shade(cc, -0.1)); } }''',
               '''      if (opt.curtain) { const cc = pick(PAL.curtain); for (const cx of [x, x + w - 2]) { ink(cx, y, 2, h, cc); R(lg, cx + (cx === x ? 1 : 0), y, 1, h, shade(cc, -0.1)); } }''')
kit = sub(kit, '''P(g, x + xx, y + yy, "#f6efe0"); }                                         // lace''', '''P(lg, x + xx, y + yy, "#f6efe0"); }                                        // lace''')
kit = sub(kit, '''    } else if (kind === "dark") {
      if (extra < 0.18)''', '''    }
    { const extra = rnd();                                  // and when it's off
      if (extra < 0.18)''')
kit = sub(kit, '''    bars.forEach((bx) => ink(x + bx, y, 1, h, FR));
    ink(x, y + Math.round(h * 0.42), w, 1, FR);''', '''    bars.forEach((bx) => both(x + bx, y, 1, h, FR));
    both(x, y + Math.round(h * 0.42), w, 1, FR);''')
kit = sub(kit, '''    if (kind !== "dark") lit.push({ x: (x + w / 2) / PX, y: (H - y - h / 2) / PX });''', '''    lit.push({ x: (x + w / 2) / PX, y: (H - y - h / 2) / PX, lid });''')
# the door block, raised on a stoop when there is one, centred on mansions; its fanlight is a light
a = kit.index("  // ground floor: door with fanlight")
endm = "  R(g, dx - 3, yB(0, 2), dw + 6, 2, PAL.stone[2]); R(g, dx - 2, yB(2, 1), dw + 4, 1, PAL.stone[0]);\n"
b = kit.index(endm) + len(endm)
door = kit[a:b]
door = door.replace("const dx = Math.round(W * 0.12), dw = 17", "const D0 = s.stoop ? 22 : 2, dx = s.doorCenter ? Math.round(W / 2 - 8.5) : Math.round(W * 0.12), dw = 17")
for k in ("52", "20", "14", "21", "16"):
    door = door.replace("yB(%s," % k, "yB(D0 + %d," % (int(k) - 2))
door = door.replace("yB(2,", "yB(D0,").replace("yB(2 +", "yB(D0 +").replace("H - 2 - fan", "H - D0 - fan").replace("yB(0, 2), dw + 6", "yB(D0 - 2, 2), dw + 6")
door = sub(door, '''    R(g, dx + 3, gy, dw - 6, 13, s.fanLit ? PAL.lit[2] : PAL.glass[1]); if (s.fanLit) R(eg, dx + 3, gy, dw - 6, 13, PAL.lit[3]);
    for (let x = dx + 4; x < dx + dw - 3; x += 3) { R(g, x, gy, 1, 13, PAL.iron); R(eg, x, gy, 1, 13, "#000"); }
    R(g, dx + 3, gy + 6, dw - 6, 1, PAL.iron); R(eg, dx + 3, gy + 6, dw - 6, 1, "#000");''',
'''    R(g, dx + 3, gy, dw - 6, 13, PAL.glass[1]); R(lg, dx + 3, gy, dw - 6, 13, PAL.lit[2]); R(eg, dx + 3, gy, dw - 6, 13, PAL.lit[3]);
    for (let x = dx + 4; x < dx + dw - 3; x += 3) { R(g, x, gy, 1, 13, PAL.iron); R(lg, x, gy, 1, 13, PAL.iron); R(eg, x, gy, 1, 13, "#000"); }
    R(g, dx + 3, gy + 6, dw - 6, 1, PAL.iron); R(lg, dx + 3, gy + 6, dw - 6, 1, PAL.iron); R(eg, dx + 3, gy + 6, dw - 6, 1, "#000");''')
door = sub(door, '''{ const col = s.fanLit ? PAL.lit[1] : PAL.glass[0]; P(g, dx + i, fan + j, col); if (s.fanLit) P(eg, dx + i, fan + j, col); }
  for (let i = 1; i < dw; i += 3) P(g, dx + i, fan + 5, FR);''', '''{ P(g, dx + i, fan + j, PAL.glass[0]); P(lg, dx + i, fan + j, PAL.lit[1]); P(eg, dx + i, fan + j, PAL.lit[1]); }
  for (let i = 1; i < dw; i += 3) { P(g, dx + i, fan + 5, FR); P(lg, dx + i, fan + 5, FR); P(eg, dx + i, fan + 5, "#000"); }''')
door = sub(door, '''kind: "door" });''', '''kind: "door", lid: newLid("door") });''')
assert "yB(2" not in door, door
kit = kit[:a] + door + kit[b:]
# shop windows: dark at night unless lit
kit = sub(kit, '''    holes.push({ x: sx - 2, y: sy - 2, w: sw + 4, h: sh + 4, kind: "shop" });''', '''    const shopLid = newLid("shop");
    holes.push({ x: sx - 2, y: sy - 2, w: sw + 4, h: sh + 4, kind: "shop", lid: shopLid });''')
kit = sub(kit, '''P(g, sx + xx, sy + yy, col); P(eg, sx + xx, sy + yy, shade(col, -0.5)); }   // dimmer glow so the display reads''',
               '''P(g, sx + xx, sy + yy, pick(PAL.glass)); P(lg, sx + xx, sy + yy, col); P(eg, sx + xx, sy + yy, shade(col, -0.5)); }   // dimmer glow so the display reads''')
kit = sub(kit, '''    const put = (x, y, w, h, col, glow) => { R(g, x, y, w, h, col); R(eg, x, y, w, h, glow === undefined ? shade(col, -0.7) : glow); };
    const ln = (x0, y0, x1, y1, col) => { line(g, x0, y0, x1, y1, col); line(eg, x0, y0, x1, y1, "#000"); };''',
'''    const put = (x, y, w, h, col, glow) => { R(lg, x, y, w, h, col); R(eg, x, y, w, h, glow === undefined ? shade(col, -0.7) : glow); R(g, x, y, w, h, shade(col, -0.62)); };   // unlit: shapes in the dark
    const ln = (x0, y0, x1, y1, col) => { line(lg, x0, y0, x1, y1, col); line(eg, x0, y0, x1, y1, "#000"); line(g, x0, y0, x1, y1, shade(col, -0.62)); };''')
kit = sub(kit, '''put(x, shelf - 3, 3, 3, gc); P(g, x, shelf - 3, shade(gc, 0.12)); }''', '''put(x, shelf - 3, 3, 3, gc); P(lg, x, shelf - 3, shade(gc, 0.12)); }''')
kit = sub(kit, '''{ R(g, x, sy, 1, sh, s.shop.frame); R(eg, x, sy, 1, sh, "#000"); }''', '''{ R(g, x, sy, 1, sh, s.shop.frame); R(lg, x, sy, 1, sh, s.shop.frame); R(eg, x, sy, 1, sh, "#000"); }''')
kit = sub(kit, '''lit.push({ x: (sx + sw / 2) / PX, y: (H - sy - sh / 2) / PX, shop: true });''', '''lit.push({ x: (sx + sw / 2) / PX, y: (H - sy - sh / 2) / PX, shop: true, lid: shopLid });''')
# the ground floor without a shop: one big window, or a cart door (warehouse), two windows (mansion), nothing (narrow house)
kit = sub(kit, '''  } else {
    const gw = Math.min(30, Math.round(W * 0.4)), gx = W - gw - Math.round(W * 0.12);''', '''  } else if (s.warehouse) {                                 // a big arched cart door in the middle
    const cw = 28, ch = 46, cx0 = Math.round(W / 2 - cw / 2), cy0 = yB(0, ch), rr = cw / 2;
    R(g, cx0 - 2, cy0 - 2, cw + 4, ch + 2, PAL.stone[2]);
    for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) { if (yy < rr && Math.hypot(xx - rr + 0.5, rr - yy) > rr) continue; P(g, cx0 + xx, cy0 + yy, xx % 4 === 0 ? "#2a1a10" : xx === rr ? "#1a100a" : pick(["#4a3020", "#4e3424", "#45301e"])); }
    holes.push({ x: cx0, y: cy0 + rr, w: cw, h: ch - rr, kind: "cart" });
  } else if (s.noGround) {
  } else if (s.doorCenter) { for (const fx of [0.2, 0.8]) win(Math.round(W * fx) - 8, 15, 16, 30, { curtain: true }); }
  else {
    const gw = Math.min(30, Math.round(W * 0.4)), gx = W - gw - Math.round(W * 0.12);''')
kit = sub(kit, '''  for (let f = 0; f < s.floors; f++) for (let k = 0; k < s.cols; k++) {
    const ww = 13, wh = Math.round(fh * 0.62)''', '''  if (s.warehouse) for (let f = 0; f < s.floors; f++) {     // stacked loading doors with hourglass shutters, a small window each side
    const y0 = groundH + f * fh, lh = Math.round(fh * 0.8), lw = 18, lx = Math.round(W / 2 - lw / 2), ly = yB(y0 + Math.round((fh - lh) * 0.35), lh);
    R(g, lx - 1, ly - 1, lw + 2, lh + 2, PAL.stone[3]);
    for (let yy = 0; yy < lh; yy++) for (let xx = 0; xx < lw; xx++) { const u = ((xx % 9) + 0.5) / 9, v = (yy + 0.5) / lh; P(g, lx + xx, ly + yy, Math.abs(v - 0.5) > Math.abs(u - 0.5) ? s.shutterCol[1] : s.shutterCol[0]); }
    R(g, lx + 8, ly, 1, lh, "#1a140e"); R(g, lx, ly, lw, 1, shade(s.shutterCol[0], 0.12));
    for (const hy of [3, lh - 4]) { R(g, lx, ly + hy, 4, 1, PAL.iron); R(g, lx + lw - 4, ly + hy, 4, 1, PAL.iron); }
    const ww = 9, wh = Math.round(fh * 0.5);
    for (const fx of [0.17, 0.83]) win(Math.round(W * fx - ww / 2), y0 + Math.round((fh - wh) * 0.42), ww, wh, { curtain: rnd() < 0.3, arch: true });
  }
  else for (let f = 0; f < s.floors; f++) for (let k = 0; k < s.cols; k++) {
    const ww = 13, wh = Math.round(fh * (s.tallWin || 0.62))''')
kit = sub(kit, '''  // rain streaks under the sills''', '''  if (s.heads) for (let k = 0; k <= s.cols; k++) {          // the heads on the piers between the first-floor windows, on consoles
    const px = Math.round(W * (k + 0.5) / (s.cols + 1)), by = yB(groundH + fh + Math.round(fh * 0.45), 1), st = PAL.stone;
    R(g, px - 4, by, 8, 2, st[2]); R(g, px - 4, by + 1, 8, 1, st[3]);
    R(g, px - 3, by - 3, 6, 3, st[0]); R(g, px - 3, by - 3, 1, 3, st[2]); R(g, px - 1, by - 4, 2, 1, st[3]);
    R(g, px - 2, by - 9, 4, 5, st[0]); R(g, px - 2, by - 9, 1, 5, st[2]); R(g, px + 1, by - 7, 1, 3, st[3]); P(g, px - 1, by - 7, st[3]); P(g, px + 1, by - 7, st[3]);
    if (k % 2) R(g, px - 2, by - 10, 4, 2, st[1]); else { P(g, px - 2, by - 10, st[1]); P(g, px + 1, by - 10, st[1]); R(g, px - 1, by - 11, 2, 2, st[1]); }   // helmets and laurels
  }
  // rain streaks under the sills''')
kit = sub(kit, '''    const half = (gy) => {
      if (s.gable === "step")''', '''    const half = (gy) => {
      if (s.gable === "spout") return gy < 0.78 ? 1 - (gy / 0.78) * 0.72 : 0.28 * Math.sqrt(Math.max(0, 1 - ((gy - 0.78) / 0.22) ** 2)) + 0.02;   // a warehouse's spout gable
      if (s.gable === "step")''')
kit = sub(kit, '''  {                                                         // one gradient per house''', '''  const [Lc, Lg] = canvas(W, H); Lg.drawImage(c, 0, 0); Lg.drawImage(lc, 0, 0);   // the lit image: the day image with every window on
  {                                                         // one gradient per house''')
kit = sub(kit, '''    g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g._c = null; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over";
  }
  return { map: tex(c), emissive: tex(ec),''', '''    g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g._c = null; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over";
    Lg.globalCompositeOperation = "source-atop"; Lg.fillStyle = gr; Lg.fillRect(0, 0, W, H); Lg.globalCompositeOperation = "source-over";
  }
  return { map: tex(c), litMap: tex(Lc), emissive: tex(ec),''')
assert "fanLit" not in kit and "kind !== \"dark\"" not in kit, "leftover"

# ---------------------------------------------------------------- 2026-10-28: chunkier pixel art, glass that catches the moon
# Every change keeps the main random sequence exactly where it was (burn() advances it as the old code did), so the
# houses, props and the 584 lights stay put; the new drawing uses its own sequence (rndB).
kit = sub(kit, '''// bricks with a lit top-left and a shadowed bottom-right on each brick (hand-shaded, not flat)
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
}''', '''let seedB = 77;
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
}''')
kit = sub(kit, '''    for (let i = 0; i < W * H / 14; i++) P(g, ri(0, W), ri(0, H), rnd() < 0.5 ? wall.hi : wall.lo);''',
               '''    burn(3 * Math.ceil(W * H / 14));                        // (was a speckle of light and dark pixels: it read as dirt)''')
kit = sub(kit, '''  else { R(g, 0, 0, W, H, wall.base); for (let i = 0; i < W * H / 8; i++) P(g, ri(0, W), ri(0, H), rnd() < 0.5 ? wall.hi : wall.lo);''',
               '''  else { R(g, 0, 0, W, H, wall.base); burn(3 * Math.ceil(W * H / 8));   // plaster: no speckle any more (it read as dirt)''')
kit = sub(kit, '''glass: ["#121823", "#18202c", "#0e131b"], glassHi: "#3b4a60",''',
               '''glass: ["#1a212d", "#202937", "#161c26"], glassHi: "#5a6a84",   // dark glass with the moon in it (2026-10-28; was near black)''')

tex2 = rng(357, 527) + "\n\n" + rng(529, 586) + "\n" + rng(593, 699)
tex2 = sub(tex2, '''  for (let y = y0, row = 0; y < yEnd; y += 5, row++) for (let x = (row % 2) * 3 - 3; x < W; x += 6) {
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
  }''', '''  for (let y = y0, row = 0; y < yEnd; y += 5, row++) for (let x = (row % 2) * 3 - 3; x < W; x += 6) { rnd(); rnd(); rnd(); if (rnd() < 0.06) { rnd(); rnd(); } }   // the old cobbles' draws
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
  }''')

# ---------------------------------------------------------------- facade geometry, patched
geo = rng(806, 907)
geo = sub(geo, "function revealMat(wall) {", "const REVEALS = new Map();\nfunction revealMat(wall) { if (!REVEALS.has(wall)) REVEALS.set(wall, revealMat0(wall)); return REVEALS.get(wall); }\nfunction revealMat0(wall) {")
geo = sub(geo, "slab.castShadow = slab.receiveShadow = true; scene.add(slab);", "slab.castShadow = slab.receiveShadow = true; target.add(slab);")
geo = sub(geo, '''    const back = new THREE.Mesh(g, capMat); back.receiveShadow = true;
    back.position.set(x0 + (h.x + h.w / 2) / PX, (H - h.y - h.h / 2) / PX, zOff - FDEPTH + 0.015); scene.add(back);''',
'''    const back = new THREE.Mesh(h.lid ? lidAttr(g, h.lid) : g, capMat); back.receiveShadow = true;
    back.position.set(x0 + (h.x + h.w / 2) / PX, (H - h.y - h.h / 2) / PX, zOff - FDEPTH + 0.015); target.add(back);
    if (h.lid) {                                           // remember where each light is (to fly to it, and to name it under the pointer)
      const bx = back.position.x, by = back.position.y, hw = h.w / PX / 2, hh = h.h / PX / 2;
      Object.assign(LIGHTS[h.lid], { block: curBlock, x: bx, y: by, z: back.position.z });
      WINS.push({ lid: h.lid, block: curBlock, x0: bx - hw, x1: bx + hw, y0: by - hh, y1: by + hh, z: zOff });
    }''')
geo = sub(geo, '''      add(...trimBox((h.w + 12) / PX, 0.15, 0.6), cx, 0.075, zOff + 0.3);                                     // stoop step''',
'''      if (s.stoop) {                                       // a raised entrance with steps up from both sides (the Golden Bend's stoep)
        const top = (H - h.y - h.h) / PX, pw = (h.w + 20) / PX;
        add(...trimBox(pw, top, 1.3), cx, top / 2, zOff + 0.65);
        for (const sd of [-1, 1]) for (let k = 0; k < 5; k++) { const hh = top * (k + 1) / 6; add(...trimBox(0.42, hh, 0.9), cx + sd * (pw / 2 + 0.21 + (4 - k) * 0.42), hh / 2, zOff + 0.85); }
        for (const sd of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.9, 1.3), ironMat, cx + sd * pw / 2, top + 0.45, zOff + 0.65);
      } else add(...trimBox((h.w + 12) / PX, 0.15, 0.6), cx, 0.075, zOff + 0.3);                                     // stoop step''')
geo = sub(geo, '''      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.85, 0.05), std({ color: 0x15130f, roughness: 0.5, metalness: 0.5 }), cx + sx * ((h.w + 10) / PX / 2), 0.57, zOff + 0.55);''',
'''      if (!s.stoop) for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.85, 0.05), ironMat, cx + sx * ((h.w + 10) / PX / 2), 0.57, zOff + 0.55);''')
geo = sub(geo, '''  f.bands.forEach((yb) =>''', '''  if (s.obelisks && f.mask) for (let y = 1; y < f.Gh; y++) if (f.mask[y] !== f.mask[y - 1]) for (const sd of [-1, 1]) {   // stone obelisks on the gable's steps
    const ob = add(new THREE.ConeGeometry(0.16, 0.7, 4), trimMat, x0 + (W / 2 + sd * (f.mask[y] - 1.5)) / PX, (H - y) / PX + 0.35, zOff - FDEPTH / 2); ob.rotation.y = Math.PI / 4;
  }
  f.bands.forEach((yb) =>''')
geo = sub(geo, "const spillMat = new THREE.MeshBasicMaterial({ map: spillTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });",
               "const spillMat = lidMat(new THREE.MeshBasicMaterial({ map: spillTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), null, \"dim\");")
geo = sub(geo, "function spill(x, z0, w) {", "function spill(x, z0, w, lid) {")
geo = sub(geo, '''  const m = new THREE.Mesh(geo, spillMat); m.renderOrder = 2; scene.add(m);''', '''  lidAttr(geo, lid);
  const m = new THREE.Mesh(geo, spillMat); m.renderOrder = 2; m.castShadow = false; target.add(m);''')
geo = geo.replace("const cafeSpots = [], shopLights = [], HX = [];\n", "")
assert "scene.add" not in geo, re.findall(r".*scene\.add.*", geo)

lampart = rng(1085, 1107)
lampart = sub(lampart, '''  const part = (cv, top, rows) =>''', '''  const [oc, og] = canvas(16, LAMP_H); og.drawImage(c, 0, 0);                    // the same lamp, unlit
  for (let y = 7; y < 15; y++) for (let x = 4; x <= 11; x++) if (x !== 7 && x !== 8) P(og, x, y, y < 9 ? "#4a4c58" : "#30323c");
  const part = (cv, top, rows) =>''')
lampart = sub(lampart, "head: { map: part(c, 0, LAMP_HEAD), em: part(ec, 0, LAMP_HEAD) },", "head: { map: part(c, 0, LAMP_HEAD), em: part(ec, 0, LAMP_HEAD), off: part(oc, 0, LAMP_HEAD) },")
shrubs = rng(1137, 1170)
dofs = rng(1401, 1443)
dofs = sub(dofs, '''      float R = maxR;''', '''      float R = maxR * 1.9;''')
dofs = sub(dofs, '''      for (int i = 0; i < 24; i++) {
        float fi = float(i) + 0.5, rr = sqrt(fi / 24.0) * R''', '''      for (int i = 0; i < 40; i++) {
        float fi = float(i) + 0.5, rr = sqrt(fi / 40.0) * R''')   # more samples: the bigger blur stays smooth
dofs = sub(dofs, '''    float cocAt(float z){ return clamp((abs(z - focus) - inner) / outer, 0.0, 1.0) * maxR; }''',
                 '''    float cocAt(float z){ return clamp((abs(z - focus) - inner) / outer, 0.0, 1.0) * maxR * (z > focus ? 1.9 : 1.0); }   // behind: much more blur, as in Octopath's towns (he found it sharp, 2026-10-28)''')
# (a blocky blur was tried the same day, after Octopath I's torch-lit town; he found it "too blocky and ugly... in the real
# game it's subtle and smooth": removed)
houses = rng(785, 805)

head = part("p0_head.js")
p3 = part("p3_loop.js").replace("/*@DOF@*/", dofs)
out = "\n".join([head, kit, "", "// ---------- tileable and sprite textures", tex2, part("p1_core.js"), houses, geo, lampart, shrubs, part("p2_world.js"), part("p2b_blocks.js"), part("p2d_look.js"), part("p2c_hero.js"), p3])
open(OUT, "w", encoding="utf-8").write(out)
print("wrote", OUT, len(out), "chars,", out.count("\n"), "lines")
