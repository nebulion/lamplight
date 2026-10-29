/* Light layer: WebGL2, drawn over the canal scene.
 *
 * The SVG street stays the drawing. This adds light from every lit lamp, window and
 * porthole onto the surfaces around it: walls, sills, cobbles, water. It is blended with
 * color-dodge, which brightens a surface in proportion to its own color, the way real
 * light does. Near-black stays near-black, so nothing glows in the sky.
 *
 * Each light is one small quad (instanced), so the cost depends on how many lights are on,
 * not on screen size. Positions are recomputed every frame from the scene's camera and
 * scroll, so the light follows the drifting street and the zoom exactly.
 * If WebGL2 isn't available, nothing happens and the SVG looks as it did.
 */
(function () {
  "use strict";
  var canvas, gl, prog, vao, instBuf, loc = {}, data = new Float32Array(0), raf = 0;
  var spec = null, sdat = new Float32Array(0), t0 = performance.now();   // second layer: highlights that add light (screen)
  var STRIDE = 15;                                                      // floats per light: box 4, shape 4, color 3, extra 4
  var sprog = null, svao, sbuf, sdata = new Float32Array(0);
  var BRICK_BOUNCE = [1.0, 0.64, 0.46];        // light bounced off old brick and stone picks up their warmth

  var VS = `#version 300 es
  layout(location=0) in vec2 corner;          // -1..1
  layout(location=1) in vec4 box;             // centre x,y (px), half w,h of the light itself (px)
  layout(location=2) in vec4 shape;           // falloff x,y (px), type, intensity
  layout(location=3) in vec3 color;
  layout(location=4) in vec4 extra;           // per-type extras (glints: street x of the lamp, px per unit; glass: side of the lamp)
  uniform vec2 res;
  out vec2 vLocal; out vec4 vBox; out vec4 vShape; out vec3 vColor; out vec4 vExtra;
  void main() {
    vec2 reach = box.zw + shape.xy * 3.0;
    vec2 p = box.xy + corner * reach;
    vLocal = corner * reach;
    vBox = box; vShape = shape; vColor = color; vExtra = extra;
    gl_Position = vec4(p / res * 2.0 - 1.0, 0.0, 1.0) * vec4(1.0, -1.0, 1.0, 1.0);
  }`;

  var FS = `#version 300 es
  precision highp float;
  in vec2 vLocal; in vec4 vBox; in vec4 vShape; in vec3 vColor; in vec4 vExtra;
  uniform float time;
  out vec4 outColor;
  float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main() {
    float type = vShape.z, I = 0.0;
    vec2 p = vLocal;
    if (type > 4.5) {                                   // specular layer (screen blend): wet cobbles, window glass
      vec3 c = vec3(0.0);
      if (type < 5.5) {                                 // wet cobbles under a lamp: a soft smear plus scattered glints
        float k = vExtra.y;
        vec2 u = vec2(vExtra.x + p.x / k, p.y / k);     // street units, fixed to the street so glints don't slide
        float du = (u.x - vExtra.x) / vExtra.z;
        float band = 1.0 - smoothstep(vBox.w / k - 0.6, vBox.w / k, abs(u.y));
        float smear = exp(-du * du * 2.0 - u.y * u.y * 0.45) * 0.10;
        float cs = max(1.1, 5.0 / k), rad = max(0.24, 0.9 / k);   // never smaller than about a pixel, at any zoom
        vec2 cell = floor(u / cs), f = u / cs - cell;
        float h = h21(cell), g = 0.0;
        if (h > 0.8) {
          vec2 at = vec2(0.25 + 0.5 * h21(cell + 7.0), 0.25 + 0.5 * h21(cell + 13.0));
          float r = length((f - at) * cs) / rad;
          g = exp(-r * r) * (0.55 + 0.45 * sin(time * 0.5 + h * 40.0));   // slow, calm shimmer
        }
        I = (smear + g * 0.55 * exp(-du * du * 1.4)) * band;
        c = mix(vColor, vec3(1.0, 0.93, 0.8), 0.45) * I * vShape.w;
      } else {                                          // a dark window pane catching a lamp across the street
        vec2 q = p / max(vBox.zw, vec2(0.5));
        float inside = 1.0 - smoothstep(-0.12, 0.0, sdBox(q, vec2(0.86)));
        vec2 spot = q - vec2(0.38 * vExtra.x, -0.32);
        I = (exp(-dot(spot, spot) * 9.0) + 0.12) * inside;
        c = vColor * I * vShape.w;
      }
      outColor = vec4(c, max(c.r, max(c.g, c.b)));
      return;
    }
    if (type < 0.5) {                                   // window / porthole: light spills onto the wall around it
      float d = sdBox(p, vBox.zw);
      if (d > 0.0) {
        float t = d / vShape.x;
        I = exp(-t * t * 0.9);                          // gaussian: soft from the very edge, no hard rim
        I *= p.y > 0.0 ? 1.0 : 0.4;                     // mostly below the sill
        I *= smoothstep(0.0, vShape.x * 0.8, d);        // ease in from the frame instead of starting at full
      }
    } else if (type < 1.5) {                            // streetlamp: a pool on the wall behind and the cobbles below
      if (sdBox(p, vBox.zw) > 0.0) {
        vec2 q = p / vShape.xy;
        I = exp(-dot(q, q) * 1.6);                      // a wide, faint pool
        I *= p.y > 0.0 ? 1.0 : 0.6;
        I *= smoothstep(0.0, vBox.z * 2.0, sdBox(p, vBox.zw));
      }
    } else if (type < 2.5) {                            // reflection on the water: a soft vertical streak
      vec2 q = p / vec2(vBox.z * 1.3 + 1.0, vShape.y);
      I = exp(-(q.x * q.x * 2.2 + q.y * q.y * 0.7));
    } else if (type < 3.5) {                            // bounce off the cobbles: warm light rising up the lower walls
      vec2 q = p / vShape.xy;
      I = exp(-dot(q, q) * 1.4) * (p.y < 0.0 ? 1.0 : 0.25);
    } else {                                            // bounce around a lit window: a faint warm tint on the brick
      vec2 q = p / vShape.xy;
      I = exp(-dot(q, q) * 1.2) * smoothstep(0.0, vBox.z * 0.8 + 0.5, sdBox(p, vBox.zw));
    }
    I = max(I, 0.0) * vShape.w;
    vec3 c = min(vColor * I, vec3(0.32));               // cap: a lit wall brightens by at most ~1.5x
    outColor = vec4(c, max(c.r, max(c.g, c.b)));
  }`;

  // say plainly whether the lighting is running (some browsers, like LibreWolf, turn WebGL off)
  function status(on, why) {
    var el = document.getElementById("gl-status");
    if (!el) return;
    el.textContent = on ? "Lighting: on (WebGL2)" : "Lighting: off. " + why;
    el.classList.toggle("off", !on);
  }

  /* Shadows. For each lit lamp and each nearby occluder: the occluder's shape projected from the
     lamp onto the wall behind it (scale m = 1 / (1 - depth): a bike near the wall casts a crisp,
     same-size shadow; a tree halfway out casts a big soft one). The lamp's own light is then
     subtracted inside that shape, so shadows are exactly "where this lamp's light doesn't reach".
     Penumbra grows with distance, from the size of the lantern. Canopies are dappled. */
  var SVS = `#version 300 es
  layout(location=0) in vec2 corner;
  layout(location=1) in vec4 lamp;     // lamp centre (px), lamp falloff (px)
  layout(location=2) in vec4 occ;      // occluder centre (px), half size (px)
  layout(location=3) in vec4 prm;      // m, kind, strength, penumbra (px, at the wall)
  layout(location=4) in vec3 color;
  uniform vec2 res;
  out vec2 vP; out vec4 vLamp; out vec4 vOcc; out vec4 vPrm; out vec3 vColor;
  void main() {
    vec2 c = lamp.xy + (occ.xy - lamp.xy) * prm.x;
    vec2 hs = occ.zw * prm.x + vec2(prm.w * 2.0 + 2.0);
    vP = c + corner * hs;
    vLamp = lamp; vOcc = occ; vPrm = prm; vColor = color;
    gl_Position = vec4((vP / res * 2.0 - 1.0) * vec2(1.0, -1.0), 0.0, 1.0);
  }`;
  var SFS = `#version 300 es
  precision highp float;
  in vec2 vP; in vec4 vLamp; in vec4 vOcc; in vec4 vPrm; in vec3 vColor;
  out vec4 o;
  float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    float m = vPrm.x, kind = vPrm.y, pen = max(vPrm.w / m, 0.6);
    vec2 obj = vLamp.xy + (vP - vLamp.xy) / m - vOcc.xy;           // this wall point, traced back to the occluder
    float occ;
    if (kind < 0.5) {                                              // trunk
      occ = 1.0 - smoothstep(-pen, pen, sdBox(obj, vOcc.zw));
    } else if (kind < 1.5) {                                       // canopy: soft ellipse, dappled by the leaves
      float e = length(obj / vOcc.zw);
      float base = 1.0 - smoothstep(0.7, 1.0 + pen / max(vOcc.z, 1.0), e);
      float leaves = noise(obj / max(vOcc.z * 0.16, 1.0)) * 0.6 + noise(obj / max(vOcc.z * 0.06, 1.0)) * 0.4;
      occ = base * smoothstep(0.3, 0.62, leaves);
    } else {                                                       // bike: frame and wheels, mostly see-through
      float d = sdBox(obj, vOcc.zw);
      occ = (1.0 - smoothstep(-pen, pen, d)) * 0.5;
    }
    // how much of this lamp's light would have landed here (same falloff as the lamp pool)
    vec2 q = (vP - vLamp.xy) / vLamp.zw;
    float I = exp(-dot(q, q) * 1.6) * (vP.y > vLamp.y ? 1.0 : 0.6);
    o = vec4(vColor * I * occ * vPrm.z, 0.0);
  }`;

  function hex(c) {
    var n = parseInt(c.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }

  function init() {
    var side = document.getElementById("side");
    if (!side || !window.Scene) return;
    canvas = document.createElement("canvas");
    canvas.className = "lights";
    canvas.setAttribute("aria-hidden", "true");
    var svgEl = document.getElementById("scene");
    side.insertBefore(canvas, svgEl.nextSibling);   // right after the svg, under the nav
    gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) {
      var probe = document.createElement("canvas");
      var gl1 = probe.getContext("webgl") || probe.getContext("experimental-webgl");
      status(false, gl1 ? "This browser has WebGL but not WebGL2." : "WebGL is disabled in this browser.");
      canvas.remove(); return;
    }
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { console.warn("light layer off:", e.message); status(false, "The graphics card refused the shader."); canvas.remove(); gl = null; return; }
    status(true);
    loc.res = gl.getUniformLocation(prog, "res");
    try {
      sprog = gl.createProgram();
      gl.attachShader(sprog, compile(gl.VERTEX_SHADER, SVS));
      gl.attachShader(sprog, compile(gl.FRAGMENT_SHADER, SFS));
      gl.linkProgram(sprog);
      if (!gl.getProgramParameter(sprog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(sprog));
    } catch (e) { console.warn("shadows off:", e.message); sprog = null; }
    if (!sprog) { /* lighting still works without shadows */ }
    else {
      loc.sres = gl.getUniformLocation(sprog, "res");
      svao = gl.createVertexArray();
      gl.bindVertexArray(svao);
      var squad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, squad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      sbuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, sbuf);
      [[1, 4, 0], [2, 4, 16], [3, 4, 32], [4, 3, 48]].forEach(function (a) {
        gl.enableVertexAttribArray(a[0]);
        gl.vertexAttribPointer(a[0], a[1], gl.FLOAT, false, 60, a[2]);
        gl.vertexAttribDivisor(a[0], 1);
      });
      gl.bindVertexArray(null);
    }
    var v = instanced(gl);
    vao = v.vao; instBuf = v.buf;
    loc.time = gl.getUniformLocation(prog, "time");
    spec = specLayer(side, canvas);
    loop();
    watchScreen(svgEl);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) loop(); });
  }

  // one quad, drawn once per light (instanced): box, shape, color, extra
  function instanced(g) {
    var va = g.createVertexArray();
    g.bindVertexArray(va);
    var quad = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, quad);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
    g.enableVertexAttribArray(0);
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
    var buf = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, buf);
    [[1, 4, 0], [2, 4, 16], [3, 3, 32], [4, 4, 44]].forEach(function (a) {
      g.enableVertexAttribArray(a[0]);
      g.vertexAttribPointer(a[0], a[1], g.FLOAT, false, STRIDE * 4, a[2]);
      g.vertexAttribDivisor(a[0], 1);
    });
    g.bindVertexArray(null);
    return { vao: va, buf: buf };
  }

  /* Highlights that add light rather than brighten what's there: wet cobbles glinting under a lamp
     and dark window glass catching the lamps across the street. color-dodge can't show these
     (it can't lift near-black), so they go on their own canvas, blended with screen. */
  function specLayer(side, after) {
    var cv = document.createElement("canvas");
    cv.className = "lights spec";
    cv.setAttribute("aria-hidden", "true");
    side.insertBefore(cv, after.nextSibling);
    var g = cv.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!g) { cv.remove(); return null; }
    try {
      var pr = g.createProgram();
      [[g.VERTEX_SHADER, VS], [g.FRAGMENT_SHADER, FS]].forEach(function (s) {
        var sh = g.createShader(s[0]);
        g.shaderSource(sh, s[1]); g.compileShader(sh);
        if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(sh));
        g.attachShader(pr, sh);
      });
      g.linkProgram(pr);
      if (!g.getProgramParameter(pr, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(pr));
      var v = instanced(g);
      return { cv: cv, gl: g, prog: pr, vao: v.vao, buf: v.buf, res: g.getUniformLocation(pr, "res"), time: g.getUniformLocation(pr, "time") };
    } catch (e) { console.warn("highlights off:", e.message); cv.remove(); return null; }
  }

  // matrix helpers: the computed transform of an element as [a,b,c,d,e,f]
  function m6(el) {
    var t = getComputedStyle(el).transform;
    if (!t || t === "none") return [1, 0, 0, 1, 0, 0];
    var v = t.match(/matrix\(([^)]+)\)/);
    return v ? v[1].split(",").map(Number) : [1, 0, 0, 1, 0, 0];
  }

  function frame() {
    var info = Scene.info(), n = Scene.litCount();
    var svg = info.svg;
    if (!info.lightGeo || !svg) return;

    // the canvas sits exactly over the svg, wherever the svg is (sidebar or opened street)
    var rc = svg.getBoundingClientRect(), dpr = Math.min(window.innerWidth < 820 ? 1.25 : 2, window.devicePixelRatio || 1);   // light is soft; phones don't need full resolution
    canvas.style.left = rc.left + "px"; canvas.style.top = rc.top + "px";
    canvas.style.width = rc.width + "px"; canvas.style.height = rc.height + "px";
    canvas.style.clipPath = getComputedStyle(svg).clipPath;
    var W = Math.max(1, Math.round(rc.width * dpr)), H = Math.max(1, Math.round(rc.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

    // svg user units are css px of the svg box (viewBox = its size)
    var vb = svg.viewBox.baseVal, ux = rc.width / (vb.width || rc.width), uy = rc.height / (vb.height || rc.height);
    var cam = m6(info.cam), sc = m6(info.scroller)[4];
    var s = info.geo.s, quay = info.geo.quay, L = info.LOOP, wy = info.waterY;
    var zoom = Math.sqrt(cam[0] * cam[0] + cam[1] * cam[1]);
    var k = s * zoom * dpr;                               // street units -> device px

    function toPx(xu, yu) {                               // street units (already offset) -> device px
      var sx = xu * s, sy = quay + yu * s;
      return [(cam[0] * sx + cam[2] * sy + cam[4]) * ux * dpr, (cam[1] * sx + cam[3] * sy + cam[5]) * uy * dpr];
    }

    var out = [], sp = [], margin = 60 * k, lampsLit = [];
    function push(cx, cy, hw, hh, fx, fy, type, inten, col, ex, to) {
      if (cx < -margin || cx > W + margin || cy < -margin || cy > H + margin) return;
      ex = ex || [0, 0, 0, 0];
      (to || out).push(cx, cy, hw, hh, fx, fy, type, inten, col[0], col[1], col[2], ex[0], ex[1], ex[2], ex[3]);
    }
    for (var i = 0; i < n && i < info.lightGeo.length; i++) {
      info.lightGeo[i].forEach(function (g) {
        var col = g.rgb || (g.rgb = hex(g.col));
        info.copyOffsets.forEach(function (c) {
          var x = g.x + g.w / 2 + c * L + sc, y = g.y + g.h / 2;
          var p = toPx(x, y);
          var warm = [col[0] * BRICK_BOUNCE[0], col[1] * BRICK_BOUNCE[1], col[2] * BRICK_BOUNCE[2]];
          if (g.type === 1) {
            push(p[0], p[1], g.w / 2 * k, g.h / 2 * k, 40 * k, 30 * k, 1, 0.42, col);
            var gp = toPx(x, -5);                                   // bounce: from the cobbles under the lamp, up the walls
            push(gp[0], gp[1], 0.5 * k, 0.5 * k, 62 * k, 26 * k, 3, 0.16, warm);
            lampsLit.push({ x: x, px: p, fall: [40 * k, 30 * k], col: col });
            // wet cobbles: the quay top (street units 0.3..4.5) glints under the lamp
            var cp = toPx(x, 2.4);
            push(cp[0], cp[1], 34 * k, 2.1 * k, 0, 0, 5, 1, col, [g.x + g.w / 2, k, 16, 0], sp);
          } else {
            push(p[0], p[1], g.w / 2 * k, g.h / 2 * k, (g.water ? 3 : 7) * k, 0, 0, g.water ? 0.25 : 0.3, col);
            if (!g.water) push(p[0], p[1], g.w / 2 * k, g.h / 2 * k, 15 * k, 12 * k, 4, 0.06, warm);
          }
          // its reflection, if the mirrored point lands in the water
          var ry = 2 * wy - y;
          if (!g.water && ry > wy + 2) {
            var rp = toPx(x, ry);
            push(rp[0], rp[1], g.w / 2 * k, g.h / 2 * k, 0, Math.max(6, g.h * 1.4) * k, 2, g.type === 1 ? 0.28 : 0.14, col);
          }
        });
      });
    }

    // dark window panes near a lit lamp catch its reflection (lit windows are too bright to show it)
    if (spec && lampsLit.length && info.windows) {
      info.windows.forEach(function (w, q) {
        var kk = info.kOfW[q];
        if (kk !== undefined && kk < n) return;
        var cyu = w.y + w.h / 2, wxl = w.x + (w.skew || 0) * cyu + w.w / 2;
        info.copyOffsets.forEach(function (c) {
          var wx = wxl + c * L + sc;
          lampsLit.forEach(function (lp) {
            var dx = wx - lp.x;
            if (Math.abs(dx) > 70) return;
            var a = 0.28 * Math.exp(-(dx / 38) * (dx / 38)) * Math.exp(-Math.pow((cyu + 45) / 45, 2));
            if (a < 0.02) return;
            var wp = toPx(wx, cyu);
            push(wp[0], wp[1], w.w / 2 * k, w.h / 2 * k, 0, 0, 6, a, lp.col, [dx < 0 ? 1 : -1, 0, 0, 0], sp);
          });
        });
      });
    }
    var time = (performance.now() - t0) / 1000;
    if (spec) drawSpec(sp, W, H, time);

    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!out.length) return;
    if (data.length < out.length) data = new Float32Array(out.length * 2);
    data.set(out);
    gl.useProgram(prog);
    gl.uniform2f(loc.res, W, H);
    gl.uniform1f(loc.time, time);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, out.length), gl.DYNAMIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, out.length / STRIDE);
    gl.bindVertexArray(null);

    // ---- shadows: take each lamp's light back out where something stands in its way ----
    if (!sprog || !lampsLit.length || !info.occluders) return;
    var sh = [];
    lampsLit.forEach(function (lp) {
      info.copyOffsets.forEach(function (c) {
        info.occluders.forEach(function (oc) {
          var ox = oc.x + c * L + sc;
          if (Math.abs(ox - lp.x) > 75) return;
          var op = toPx(ox, oc.y), m = 1 / (1 - oc.depth);
          var pen = 3 * k * (m - 1);                                // lantern ~6 units wide: wider penumbra the farther it falls
          sh.push(lp.px[0], lp.px[1], lp.fall[0], lp.fall[1], op[0], op[1], oc.w * k, oc.h * k,
            m, oc.kind, oc.kind === 1 ? 0.42 : 0.42, pen, lp.col[0], lp.col[1], lp.col[2]);
        });
      });
    });
    if (!sh.length) return;
    if (sdata.length < sh.length) sdata = new Float32Array(sh.length * 2);
    sdata.set(sh);
    gl.useProgram(sprog);
    gl.uniform2f(loc.sres, W, H);
    gl.bindVertexArray(svao);
    gl.bindBuffer(gl.ARRAY_BUFFER, sbuf);
    gl.bufferData(gl.ARRAY_BUFFER, sdata.subarray(0, sh.length), gl.DYNAMIC_DRAW);
    gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);                  // light buffer minus the blocked light
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, sh.length / 15);
    gl.blendEquation(gl.FUNC_ADD);
    gl.bindVertexArray(null);
  }

  function drawSpec(sp, W, H, time) {
    var g = spec.gl, cv = spec.cv;
    ["left", "top", "width", "height", "clipPath"].forEach(function (p) { cv.style[p] = canvas.style[p]; });
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    g.viewport(0, 0, W, H);
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT);
    if (!sp.length) return;
    if (sdat.length < sp.length) sdat = new Float32Array(sp.length * 2);
    sdat.set(sp);
    g.useProgram(spec.prog);
    g.uniform2f(spec.res, W, H);
    g.uniform1f(spec.time, time);
    g.bindVertexArray(spec.vao);
    g.bindBuffer(g.ARRAY_BUFFER, spec.buf);
    g.bufferData(g.ARRAY_BUFFER, sdat.subarray(0, sp.length), g.DYNAMIC_DRAW);
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE);
    g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, sp.length / STRIDE);
    g.bindVertexArray(null);
  }

  // the street moves ~7 px a second: 30 frames a second looks identical and costs half
  var last = 0, onScreen = true;
  function loop() {
    cancelAnimationFrame(raf);
    (function tick(ts) {
      if (document.hidden || !onScreen) { raf = 0; return; }
      raf = requestAnimationFrame(tick);
      if (ts && ts - last < 32) return;
      last = ts || 0;
      try { frame(); } catch (e) { console.warn("light layer:", e.message); status(false, "It stopped with an error."); return; }
    })();
  }
  function watchScreen(svgEl) {
    if (!window.IntersectionObserver) return;
    new IntersectionObserver(function (es) {
      onScreen = es[0].isIntersecting || document.body.classList.contains("street-open");
      svgEl.classList.toggle("paused", !onScreen);                // also stops the drift animation (CSS)
      if (onScreen && !raf) loop();
    }).observe(svgEl);
  }

  window.Light = { init: init };
})();
