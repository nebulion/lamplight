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
