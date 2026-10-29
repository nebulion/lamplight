
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
