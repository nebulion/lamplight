/* Sound: real Amsterdam recordings (credits in README). Off until switched on.
 *
 *   Sound.sent(type)    a bell when something real is logged: usually a Dutch bicycle bell
 *                       (one of three rings); every third application, the Amsterdam tram
 *                       bell from the Leidsestraat
 *   opened street       the Herengracht at night fades in, with a canal boat passing; fades out on close
 *   on the hour         the Westertoren's tune, far away and quiet (real clock)
 *   ambience switch     a quiet Amsterdam street at night, low, for working against
 *
 * Settings are remembered on this device. Nothing plays before you switch sound on.
 */
(function () {
  "use strict";
  var FILES = {
    bike: "/sounds/bike-bells-dutch.mp3",
    tram: "/sounds/tram-leidsestraat.mp3",
    canal: "/sounds/canal-night-herengracht.ogg",
    boat: "/sounds/canal-boat-herengracht.ogg",
    tower: "/sounds/westertoren.ogg",
    street: "/sounds/street-night.mp3"
  };
  var TRAM_DING = { start: 83.45, dur: 1.8 };      // where the tram bell rings in the Leidsestraat recording
  // clean rings in the Dutch bike-bell recording (found by their 2.4-4.8 kHz ring and decay)
  var BIKE_RINGS = [{ start: 4.05, dur: 0.95 }, { start: 11.98, dur: 0.6 }, { start: 4.98, dur: 1.5 }];
  var ctx = null, master = null, cache = {}, canal = null, boat = null, street = null;
  var on = read("sound") === "on", amb = read("ambience") === "on", sentCount = 0, lastTowerHour = -1;

  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function audio() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function buffer(name) {
    if (!cache[name]) {
      cache[name] = fetch(FILES[name]).then(function (r) { return r.arrayBuffer(); })
        .then(function (b) { return new Promise(function (res, rej) { ctx.decodeAudioData(b, res, rej); }); });
    }
    return cache[name];
  }
  // play part of a recording with gentle fades; returns a handle with stop(fadeSeconds)
  function play(name, o) {
    o = o || {};
    if (!on || !audio()) return null;
    var h = { src: null, gain: ctx.createGain(), stopped: false };
    h.gain.gain.value = 0;
    h.gain.connect(master);
    buffer(name).then(function (buf) {
      if (h.stopped) return;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      if (o.loop) { src.loop = true; src.loopStart = 0.5; src.loopEnd = buf.duration - 0.5; }
      src.connect(h.gain);
      var t = ctx.currentTime, start = o.start || 0, dur = o.dur || (buf.duration - start);
      var fi = o.fadeIn || 0.02, fo = o.fadeOut || 0.2, g = o.gain || 0.5;
      h.gain.gain.setValueAtTime(0, t);
      h.gain.gain.linearRampToValueAtTime(g, t + fi);
      if (!o.loop) {
        h.gain.gain.setValueAtTime(g, t + Math.max(fi, dur - fo));
        h.gain.gain.linearRampToValueAtTime(0, t + dur);
        src.start(t, start, dur);
      } else src.start(t, start);
      h.src = src;
    }).catch(function () {});
    h.stop = function (fade) {
      h.stopped = true;
      if (!ctx) return;
      var t = ctx.currentTime, f = fade || 1;
      h.gain.gain.cancelScheduledValues(t);
      h.gain.gain.setValueAtTime(h.gain.gain.value, t);
      h.gain.gain.linearRampToValueAtTime(0, t + f);
      if (h.src) try { h.src.stop(t + f + 0.05); } catch (e) {}
    };
    h.level = function (g, fade) {
      var t = ctx.currentTime;
      h.gain.gain.cancelScheduledValues(t);
      h.gain.gain.setValueAtTime(h.gain.gain.value, t);
      h.gain.gain.linearRampToValueAtTime(g, t + (fade || 1));
    };
    return h;
  }

  /* A calm bed: the quietest, steadiest stretches of a recording (measured, no spikes),
     played back to back with long crossfades so there's no loop point, through a low-pass
     filter that takes the edge off (a canal heard from a warm room). */
  function bed(name, wins, gain, lowpass, fadeIn) {
    if (!on || !audio()) return null;
    var out = ctx.createGain(), lp = ctx.createBiquadFilter(), h = { stopped: false, timer: 0, nodes: [] };
    lp.type = "lowpass"; lp.frequency.value = lowpass; lp.Q.value = 0.5;
    out.gain.value = 0; out.connect(master); lp.connect(out);
    var t = ctx.currentTime;
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(gain, t + (fadeIn || 4));
    var X = 4, i = 0;                                            // seconds of crossfade between stretches
    buffer(name).then(function (buf) {
      var next = ctx.currentTime + 0.05;
      (function schedule() {
        if (h.stopped) return;
        var w = wins[i++ % wins.length], dur = w[1];
        var src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = buf; src.connect(g); g.connect(lp);
        g.gain.setValueAtTime(0, next);
        g.gain.linearRampToValueAtTime(1, next + X);
        g.gain.setValueAtTime(1, next + dur - X);
        g.gain.linearRampToValueAtTime(0, next + dur);
        src.start(next, w[0], dur);
        h.nodes.push(src);
        var startNext = next + dur - X;
        h.timer = setTimeout(schedule, Math.max(0, (startNext - ctx.currentTime - 1) * 1000));
        next = startNext;
      })();
    }).catch(function () {});
    h.stop = function (f) {
      h.stopped = true; clearTimeout(h.timer);
      var tt = ctx.currentTime;
      out.gain.cancelScheduledValues(tt); out.gain.setValueAtTime(out.gain.value, tt); out.gain.linearRampToValueAtTime(0, tt + (f || 2));
      h.nodes.forEach(function (n) { try { n.stop(tt + (f || 2) + 0.1); } catch (e) {} });
    };
    h.level = function (g2, f) { var tt = ctx.currentTime; out.gain.cancelScheduledValues(tt); out.gain.setValueAtTime(out.gain.value, tt); out.gain.linearRampToValueAtTime(g2, tt + (f || 1)); };
    return h;
  }
  // the calmest stretches, found by measuring loudness second by second (steady, no peaks)
  var CALM_STREET = [[114, 20], [186, 24]];                    // a quiet street around 1 AM
  var CALM_CANAL = [[6, 24]];                                   // the Herengracht, softened into a distant hum

  /* ---------------------------------------------------------------- moments */
  function sent(type) {
    sentCount++;
    // the tram bell now and then, for applications; otherwise the bicycle bell
    // usually a bicycle bell; every third application, the tram
    if (type === "application" && sentCount % 3 === 0) tramDing(0.55);
    else bikeRing(BIKE_RINGS[sentCount % BIKE_RINGS.length], 0.5);
  }
  function bikeRing(r, g) { play("bike", { start: r.start, dur: r.dur, gain: g, fadeIn: 0.005, fadeOut: 0.25 }); }
  function tramDing(g) { play("tram", { start: TRAM_DING.start, dur: TRAM_DING.dur, gain: g, fadeOut: 0.6 }); }
  function streetOpened() {
    if (!on) return;
    if (street) street.level(0.04, 2);                           // the work ambience steps back
    // levels measured through the filters: the bed sits a little under the bell (rms ~0.012 vs ~0.019)
    canal = bed("street", CALM_STREET, 6.5, 3800, 4);            // quiet night street (a very quiet recording, so lifted), slightly softened
    boat = bed("canal", CALM_CANAL, 0.24, 700, 6);               // the canal as a faint, distant hum underneath
  }
  function streetClosed() {
    if (canal) { canal.stop(1.2); canal = null; }
    if (boat) { boat.stop(1.2); boat = null; }
    if (street) street.level(0.16, 2);
  }
  function startAmbience() { if (on && amb && !street) street = play("street", { loop: true, gain: 0.16, fadeIn: 3 }); }
  function stopAmbience() { if (street) { street.stop(1.5); street = null; } }

  // the Westertoren on the hour, far away: the first 45 seconds of its tune, very quiet
  setInterval(function () {
    var d = new Date();
    if (!on || document.hidden || d.getMinutes() !== 0 || d.getHours() === lastTowerHour) return;
    lastTowerHour = d.getHours();
    play("tower", { gain: 0.12, fadeIn: 2, dur: 45, fadeOut: 8 });
  }, 20000);

  /* ---------------------------------------------------------------- switches */
  function render() {
    var s = document.getElementById("snd"), a = document.getElementById("amb");
    if (!s) return;
    s.textContent = on ? "Sound on" : "Sound off";
    s.setAttribute("aria-pressed", on);
    a.hidden = !on;
    a.textContent = amb ? "Street ambience on" : "Street ambience off";
    a.setAttribute("aria-pressed", amb);
  }
  function setOn(v) {
    on = v; write("sound", v ? "on" : "off");
    if (v) { audio(); bikeRing(BIKE_RINGS[0], 0.35); startAmbience(); if (document.body.classList.contains("street-open")) streetOpened(); }
    else { stopAmbience(); streetClosed(); }
    render();
  }
  function setAmb(v) { amb = v; write("ambience", v ? "on" : "off"); if (v) startAmbience(); else stopAmbience(); render(); }

  function init() {
    var s = document.getElementById("snd"), a = document.getElementById("amb");
    if (s) s.addEventListener("click", function () { setOn(!on); });
    if (a) a.addEventListener("click", function () { setAmb(!amb); });
    render();
    // browsers only allow sound after a click: if it was left on, wake up on the first one
    if (on) document.addEventListener("pointerdown", function wake() { document.removeEventListener("pointerdown", wake); audio(); startAmbience(); }, { once: true });
    document.addEventListener("street", function (e) { if (e.detail === "open") streetOpened(); else streetClosed(); });
  }

  window.Sound = { init: init, sent: sent };
})();
