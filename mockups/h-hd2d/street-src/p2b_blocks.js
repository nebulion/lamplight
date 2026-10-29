
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
