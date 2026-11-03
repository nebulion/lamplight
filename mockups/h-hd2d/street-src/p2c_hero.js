// ================================================================== your character (D43, 2026-10-28)
/* One townsperson the person chose (data/profile.json "character": the parts in tracker/character-parts.json, drawn by heroSprite). A/D walk them along the street and the
   camera follows. For each application logged, they go to the new light and light it: by bike when it's far, with a
   lamplighter's pole for lamps, in through the door for a house's windows, and a look up for anything they can't reach
   (bridge bulbs, boats). Only setLit(n, true) (a real log) or replay() (the lights logged while the street was closed)
   sends them: nothing lights on its own. Their sprite draws from its own random sequence, so his lights don't move. */
const HERO_DEFAULT = { coat: "#3a4a6a", hairStyle: "short", hair: "#2a1d14", scarf: "#c8a050", bag: "#6a4a2a", legs: "#2a2a34" };
const LANE = 3.4, WALK = 1.6, RIDE = 6.5, CYCLE = 4.5, BIKE_FROM = 15;   // metres from the houses; m/s on foot, by bike on an errand, by bike with A/D; bike when further than this
const hero = { x: 0, z: LANE, y: 0, dir: 1, held: 0, follow: true, queue: [], job: null, riding: 0, cycle: false, inside: false, ready: false, pedal: 0 };   // cycle: on the bike by choice (B)
// a little of its own colour glows, so the character reads at night away from the lamps (the townsfolk stay dim)
const heroMat = std({ map: WHITE_TEX, emissiveMap: WHITE_TEX, emissive: 0xffffff, emissiveIntensity: 0.34, alphaTest: 0.5, side: THREE.DoubleSide });
const heroMesh = new THREE.Mesh(new THREE.PlaneGeometry(HPW, HPH), heroMat);   // its own, bigger frame (p2d_look.js)
const heroShadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), shadowMat);
heroShadow.rotation.x = -Math.PI / 2; heroShadow.scale.set(1, 0.55, 1);
// their own Dutch bike, the street's bike drawn in lighter colours (the black one vanishes at night): steel wheels, a cream
// frame, a brown crate on the front
const heroBikeTex = bikeSheet(["#8c8a86", "#6c6a66", "#5a5854", "#c8c4bc"], "#d8cdb4", "#3a2a1e", "#9a968e", ["#8a5e34", "#a8743e"]);
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
let heroTex = null, heroPedal = null;
function setHero(o) {                                        // draw the chosen character (heroSprite: no random draws)
  const t = heroSprite(o);
  if (heroTex) heroTex.dispose();
  if (heroPedal) heroPedal.dispose();
  heroPedal = pedalSheet(t.image, HFW, HFH, [14, 29], [15.5, 41]);   // the same character, seated, pedalling
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

/* Things can't pass through each other (2026-11-02, he asked).
   The tram: townsfolk wait at the kerb until it has passed; it slows, rings and stops short for your character, and your
   character won't walk into its side. Fixed things (OBST) and other people: everyone steers round them. Your character and
   the cyclist keep their line and the walkers step aside. */
const tramNow = { on: false, x: 0, z0: 0, z1: 0, dir: 1 };
const TRAM_HALF = () => TRAM_W / 2 + 0.5;
function mustWait(x, dir, z, ahead) {                         // at the kerb, about to step onto the track, with the tram here or coming: wait
  if (!tramNow.on || !dir) return false;
  const dx = tramNow.x - x, half = TRAM_HALF();
  if (Math.abs(dx) < half || dx * dir < 0 || Math.abs(dx) > half + 1.1) return false;
  return z >= tramNow.z0 - (tramNow.dir > 0 ? ahead : 1) && z <= tramNow.z1 + (tramNow.dir < 0 ? ahead : 1);
}
function tramMustStop() {                                     // anyone on the track ahead of it, your character first
  const half = TRAM_HALF(), front = tramNow.dir > 0 ? tramNow.z1 : tramNow.z0;
  const onTrack = (x, z) => { if (Math.abs(x - tramNow.x) >= half) return false; const d = (z - front) * tramNow.dir; return d > -0.5 && d < 9; };
  if (hero.ready && !hero.inside && onTrack(hero.x, hero.z)) return true;
  if (onTrack(cycl.x, cycl.z)) return true;
  return people.some((p) => p.speed && onTrack(p.x, p.zNow));
}
const QUAY_MIN = 1.9, QUAY_MAX = 8.4;
let obstNear = [], moversNow = [];
function nearThings(cx) {                                     // what's close enough to matter, once a frame
  obstNear = [];
  for (const o of OBST) { if (!o.b.group.visible) continue; const bx = o.b.group.position.x, x0 = bx + o.x0, x1 = bx + o.x1; if (x1 > cx - 60 && x0 < cx + 60) obstNear.push({ x0, x1, z0: o.z0, z1: o.z1 }); }
  moversNow = [];
  if (hero.ready && !hero.inside) { const fast = hero.riding > 0 ? 3 : 0.6; moversNow.push({ who: hero, x0: hero.x - fast, x1: hero.x + fast, z0: hero.z - 0.4, z1: hero.z + 0.4 }); }
  moversNow.push({ who: cycl, x0: cycl.x - 1.2, x1: cycl.x + 4, z0: cycl.z - 0.45, z1: cycl.z + 0.45 });
  people.forEach((p) => { if (p.speed && p.zNow < 10) moversNow.push({ who: p, x0: p.x - 0.5, x1: p.x + 0.5, z0: p.zNow - 0.35, z1: p.zNow + 0.35 }); });
}
function clearZ(x, dir, zWant, pad, self) {                   // the nearest free line along the quay for something at x heading dir
  const look = self === hero || self === cycl ? 3.2 : 2.6, a = Math.min(x, x + dir * look), b = Math.max(x, x + dir * look);
  const yields = people.indexOf(self);                         // walkers give way to your character, the cyclist and any walker before them
  let z = zWant;
  for (let pass = 0; pass < 4; pass++) {
    let hit = null;
    for (const o of obstNear) if (b + pad >= o.x0 && a - pad <= o.x1 && z + pad >= o.z0 && z - pad <= o.z1) { hit = o; break; }
    if (!hit && yields >= 0) for (const m of moversNow) {
      if (m.who === self || (people.indexOf(m.who) >= 0 && people.indexOf(m.who) > yields)) continue;
      if (b + pad >= m.x0 && a - pad <= m.x1 && z + pad >= m.z0 && z - pad <= m.z1) { hit = m; break; }
    }
    if (!hit && self === cycl && hero.ready && !hero.inside && moversNow[0] && moversNow[0].who === hero) { const m = moversNow[0]; if (b + pad >= m.x0 && a - pad <= m.x1 && z + pad >= m.z0 && z - pad <= m.z1) hit = m; }
    if (!hit) return z;
    const up = hit.z0 - pad - 0.02, down = hit.z1 + pad + 0.02;
    z = (Math.abs(up - z) <= Math.abs(down - z) && up >= QUAY_MIN) || down > QUAY_MAX ? up : down;
  }
  return Math.max(QUAY_MIN, Math.min(QUAY_MAX, z));
}

/* Stairs (2026-11-02, he asked: entering and leaving, the steps weren't there). Every door has a step (15 cm); the mansions'
   raised entrances have five treads up from each side. Your character's height follows them. */
function stoopOf(H, door, hole) {
  const sill = hole ? (H.f.H - hole.y - hole.h) / PX : 0.12;
  if (H.s.stoop && hole) { const pw = (hole.w + 20) / PX; return { stoep: true, cx: door, pw, top: sill, z1: H.zOff + 1.3, foot: pw / 2 + 0.42 * 5 + 0.35, sill }; }
  return { stoep: false, cx: door, top: 0.15, z1: H.zOff + 0.6, foot: 0, sill };
}
function stoopY(st, x, z) {
  if (z > st.z1 + 0.05) return 0;
  if (!st.stoep) return st.top;
  const dx = Math.abs(x - st.cx);
  if (dx <= st.pw / 2) return st.top;
  const n = Math.floor((dx - st.pw / 2) / 0.42);
  return n >= 5 ? 0 : st.top * (5 - n) / 6;
}
function houseAt(L) {
  return L.block.H.find((H) => L.x >= H.x - 0.05 && L.x <= H.x + H.w + 0.05 && Math.abs(L.z - H.zOff) < 1.2) || null;
}
function jobFor(lid) {
  const L = LIGHTS[lid], lx = nearX(L.block.cx + L.x, hero.x), shift = lx - (L.block.cx + L.x);
  if (L.kind === "lamp") return { lid, kind: "pole", x: lx - 0.7, z: L.z - 0.45, tx: lx, ty: L.y - 0.15 };
  const H = L.kind === "bulbs" ? null : houseAt(L);
  if (H) {
    const hole = H.f.holes.find((h) => h.kind === "door"), dh = hole ? hole.h / PX : 2.4, door = L.block.cx + H.door + shift, st = stoopOf(H, door, hole);
    const side = st.stoep ? (Math.sign(hero.x - door) || -1) : 0;   // a raised entrance: to the foot of its steps, on the side you come from
    return { lid, kind: "door", x: door + side * st.foot, z: H.zOff + (st.stoep ? 0.85 : 0.9), doorX: door, doorZ: H.zOff - FDEPTH + 0.03, dw: H.dw, dh, stoop: st, side };
  }
  return { lid, kind: "look", x: lx - 1.2 * Math.sign(lx - hero.x || 1), z: LANE };
}

/* A job is the trip, then a few timed steps. Each step: [seconds, (u 0..1) => {}, at the end, walking frames?]. */
const doorLight = (j) => (a) => { doorGlow.visible = a > 0.01; doorGlow.material.opacity = a * 0.92; doorGlow.position.set(j.doorX, j.dh / 2 + j.stoop.sill, j.doorZ); doorGlow.scale.set(j.dw, j.dh, 1); };
// up and down a raised entrance's steps, along the front of the house (none for a plain door)
const climbUp = (j) => (j.stoop.stoep ? [[j.stoop.foot / 1.15, (u) => { hero.x = j.x + (j.doorX - j.x) * u; hero.dir = -j.side; }, null, true]] : []);
const climbDown = (j) => (j.stoop.stoep ? [[j.stoop.foot / 1.15, (u) => { hero.x = j.doorX + (j.x - j.doorX) * u; hero.dir = j.side; }, null, true]] : []);
function startJob(lid) {
  const j = jobFor(lid); hero.job = j; j.phase = "go"; j.k = 0; j.u = 0;
  const far = Math.abs(j.x - hero.x) > BIKE_FROM;               // far: gets on the bike, rides, gets off, walks the last steps
  j.bike = far ? (hero.riding >= 1 ? "ride" : "on") : (hero.riding > 0 ? "off" : "");
  const on = () => { setGoal(lid, 1); document.dispatchEvent(new CustomEvent("street", { detail: "lit" })); };   // (the chime, in sound.js)
  if (j.kind === "pole") {
    const dx = j.tx - (j.x + 0.25), dy = j.ty - 1.35, len = Math.hypot(dx, dy), up = Math.atan2(-dx, dy), down = up + 1.9;
    const flame = heroPole.getObjectByName("flame");
    const aim = (u) => { heroPole.visible = true; heroPole.position.set(j.x + 0.25, 1.35, j.z + 0.08); heroPole.children[0].scale.y = len; heroPole.children[0].position.y = len / 2;
      heroPole.rotation.z = down + (up - down) * u; flame.position.y = len; flame.rotation.z = -heroPole.rotation.z; };
    j.steps = [[0.3, () => {}], [0.8, (u) => aim(u * u * (3 - 2 * u)), on], [1.5, () => aim(1)], [0.6, (u) => aim(1 - u), () => { heroPole.visible = false; }]];
  } else if (j.kind === "door") {
    const glow = doorLight(j);
    j.steps = [[0.3, () => {}], ...climbUp(j), [0.5, (u) => glow(u)], [0.5, (u) => { hero.z = j.z + (j.doorZ + 0.25 - j.z) * u; }, () => { hero.inside = true; }, true],
      [0.5, (u) => glow(1 - u)], [0.7, () => {}, on], [1.3, () => {}], [0.4, (u) => glow(u), () => { hero.inside = false; }],
      [0.5, (u) => { hero.z = j.doorZ + 0.25 + (j.z - j.doorZ - 0.25) * u; }, null, true], [0.4, (u) => glow(1 - u)], ...climbDown(j)];
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
    if (mustWait(hero.x, hero.dir, hero.z, 1.2)) return;     // the tram is crossing here: wait for it
    if (j.bike === "ride") {                                 // slows down over the last dozen metres
      if (ad > 3) { hero.x += Math.sign(dx) * Math.min(ad - 3, RIDE * Math.min(1, ad / 12 + 0.25) * dt); hero.z += (clearZ(hero.x, hero.dir, LANE + 0.8, 0.5, hero) - hero.z) * Math.min(1, dt * 3); hero.pedalling = true; return; }
      j.bike = "off";
    }
    if (j.bike === "off") { hero.riding = Math.max(0, hero.riding - dt / 0.35); if (hero.riding > 0) return; j.bike = ""; }
    const dz = j.z - hero.z, d = Math.hypot(dx, dz), s = WALK * dt;
    if (d <= s) { hero.x = j.x; hero.z = j.z; j.phase = "act"; j.k = 0; j.u = 0; return; }
    if (ad > 2.2) { hero.x += Math.sign(dx) * s; hero.z += (clearZ(hero.x, hero.dir, LANE, 0.42, hero) - hero.z) * Math.min(1, dt * 3); return; }   // along the quay, round what's in the way
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
  hero.pedalling = false;
  if (showing) walking = stepShowcase(dt);
  else if (working && hero.job) { stepJob(dt); walking = !!hero.job && (hero.job.phase === "go" ? hero.riding === 0 : hero.stepping); }
  else if (interactive) {                                    // A/D: on foot, or on the bike (B gets on and off)
    hero.riding = hero.cycle ? Math.min(1, hero.riding + dt / 0.35) : Math.max(0, hero.riding - dt / 0.35);
    if (hero.held && (hero.riding >= 1 || hero.riding === 0)) {
      const ride = hero.riding >= 1;
      hero.dir = hero.held;
      if (!mustWait(hero.x, hero.held, hero.z, 1.2)) {         // (the tram's side: they wait; it brakes for them otherwise)
        hero.x += hero.held * (ride ? CYCLE : WALK) * dt;
        hero.z += (clearZ(hero.x, hero.held, ride ? LANE + 0.8 : LANE, ride ? 0.5 : 0.42, hero) - hero.z) * Math.min(1, dt * 3); walking = !ride; hero.pedalling = ride;
      }
    }
  }
  const ride = hero.riding >= 1, show = FR.cam > 0.6 && !hero.inside;
  heroMesh.visible = heroShadow.visible = show;
  const st = hero.job && hero.job.stoop, gy = st ? stoopY(st, hero.x, hero.z) : 0;
  hero.y += (gy - hero.y) * Math.min(1, dt * 16);            // up and down the steps
  if (hero.pedalling) hero.pedal += dt * 9;
  const pf = Math.floor(hero.pedal) % 4;
  const faceTex = ride ? heroPedal : heroTex;
  if (heroMat.map !== faceTex) { heroMat.map = heroMat.emissiveMap = faceTex; }
  heroTex.offset.x = walking ? (1 + Math.floor(t * 5) % 2) / 3 : 0;
  heroPedal.offset.x = pf / 4; heroBikeTex.offset.x = pf / 4;
  heroMesh.position.set(hero.x - (ride ? 0.35 * hero.dir : 0), HPH / 2 + hero.y + (ride ? 0.3 : walking ? Math.abs(Math.sin(t * 7.9)) * 0.03 : 0), hero.z);
  heroShadow.position.set(hero.x, 0.02 + hero.y, hero.z);
  faceAt(heroMesh, hero.x); heroMesh.scale.x = hero.dir;
  heroBike.visible = show && hero.riding > 0;
  if (heroBike.visible) { heroBike.position.set(hero.x + (ride ? 0 : hero.dir * 0.9), 0.75 - (1 - hero.riding) * 0.08, hero.z - 0.06); faceAt(heroBike, hero.x); heroBike.scale.x = hero.dir; }   // (behind the rider, so the legs show in front of the frame)
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
  const hole = H.f.holes.find((h) => h.kind === "door"), dh = hole ? hole.h / PX : 2.4, st = stoopOf(H, doorX, hole), side = st.stoep ? 1 : 0;
  const j = { lid: 0, kind: "exit", phase: "act", k: 0, u: 0, x: doorX + side * st.foot, doorX, z: H.zOff + (st.stoep ? 0.85 : 1.3), doorZ: H.zOff - FDEPTH + 0.03, dw: H.dw, dh, stoop: st, side };
  const glow = doorLight(j), out = j.doorZ + 0.25;
  Object.assign(hero, { x: doorX, z: out, y: stoopY(st, doorX, out), dir: 1, inside: true, follow: true, riding: 0, cycle: false });
  j.steps = [[0.5, () => {}], [0.5, (u) => glow(u), () => { hero.inside = false; }], [0.8, (u) => { hero.z = out + (j.z - out) * u; }, null, true],
    [0.5, (u) => glow(1 - u)], ...climbDown(j)];
  hero.job = j;
}
