
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
