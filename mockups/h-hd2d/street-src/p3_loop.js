
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
/*@DOF@*/
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
