/* sfx.js — sound effects made live by WebAudio (no files), 2026-10-06, first for the void dome (the user: "ทำทั้งหมดเลย
   ลองดู" after the list that had "เสียง" in it). Each sound is a little synth patch: fn(ac, out, t0, o) schedules its nodes
   at t0 on any AudioContext, so the same patch plays live and renders offline into a clip's soundtrack.
     NC.SFX.play(name, o)        a one-shot (o.vol, o.pan -1..1)
     NC.SFX.loop(name, o) → h    a held sound; h.stop() fades it out
     NC.SFX.rec(t)               while a capture runs: log events against game time instead of the clock (NC.SFX.log)
     NC.SFX.render(log, secs)    → a WAV (base64 data URL) of those events, for a clip
   Browsers only allow sound after the player's first key or click: the context is made then. Quiet while the tab is
   hidden or a film plays. ESC menu → ตั้งค่า "เสียงเอฟเฟกต์" (ปิด / เบา / กลาง / ดัง), kept in nightcamp.sfx.vol. */
(function () {
  'use strict';
  const NC = window.NC;
  const KEY = 'nightcamp.sfx.vol';
  let vol = 0.5;
  try { const v = localStorage.getItem(KEY); if (v !== null && !isNaN(+v)) vol = +v; } catch (e) { /* (private window) */ }
  const off = false;
  let ac = null, master = null, noiseBuf = null;
  const SFX = (NC.SFX = { vol: () => vol, log: null });

  function noiseOf(a) {
    if (a === ac && noiseBuf) return noiseBuf;
    const b = a.createBuffer(1, a.sampleRate * 1.5, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (a === ac) noiseBuf = b;
    return b;
  }
  function unlock() {
    if (off || ac) { if (ac && ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = vol; master.connect(ac.destination);
    } catch (e) { ac = null; }
  }
  addEventListener('keydown', unlock, true);
  addEventListener('pointerdown', unlock, true);
  const quiet = () => document.hidden || !!document.querySelector('#intro:not([hidden])');

  // ---------------- building blocks ----------------
  const env = (g, t0, a, peak, d, end) => { // attack to peak, decay to end over d
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, end || 0.0001), t0 + a + d);
  };
  const osc = (a, type, f0, f1, t0, dur) => { const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur); o.start(t0); o.stop(t0 + dur + 0.05); return o; };
  const noise = (a, t0, dur) => { const s = a.createBufferSource(); s.buffer = noiseOf(a); s.loop = true; s.start(t0, Math.random()); s.stop(t0 + dur + 0.05); return s; };
  const filt = (a, type, f0, f1, t0, dur, q) => { const f = a.createBiquadFilter(); f.type = type; f.Q.value = q || 0.8; f.frequency.setValueAtTime(f0, t0); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur); return f; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  const G = (a) => a.createGain();

  // ---------------- the patches ----------------
  const P = {
    // the dome rising: a low saw sweeping up through an opening filter, a rising whoosh
    domeRise(a, out, t) {
      const g1 = G(a); env(g1, t, 0.25, 0.32, 0.75);
      chain(osc(a, 'sawtooth', 62, 128, t, 1.0), filt(a, 'lowpass', 260, 1400, t, 0.9, 4), g1, out);
      const g2 = G(a); env(g2, t, 0.5, 0.22, 0.5);
      chain(noise(a, t, 1.0), filt(a, 'bandpass', 300, 2600, t, 0.95, 1.2), g2, out);
      const g3 = G(a); env(g3, t + 0.8, 0.01, 0.35, 0.6);
      chain(osc(a, 'sine', 180, 90, t + 0.8, 0.6), g3, out);
    },
    // the closing pop
    domePop(a, out, t) {
      const g = G(a); env(g, t, 0.005, 0.4, 0.35);
      chain(osc(a, 'sine', 220, 70, t, 0.35), g, out);
      const g2 = G(a); env(g2, t, 0.005, 0.18, 0.4);
      chain(osc(a, 'triangle', 1320, 990, t, 0.4), g2, out);
    },
    // a blow on the dome: a glassy knock with ringing partials
    domeHit(a, out, t, o) {
      const k = (o && o.k) || 1;
      for (const [f, v, d] of [[740, 0.22, 0.5], [1110, 0.14, 0.4], [1660, 0.1, 0.3], [2490, 0.06, 0.22]]) {
        const g = G(a); env(g, t, 0.003, v * k, d);
        chain(osc(a, 'sine', f * (0.98 + Math.random() * 0.04), f * 0.97, t, d), g, out);
      }
      const gn = G(a); env(gn, t, 0.002, 0.25 * k, 0.08);
      chain(noise(a, t, 0.1), filt(a, 'highpass', 2500, 2500, t, 0.1), gn, out);
      const gt = G(a); env(gt, t, 0.003, 0.3 * k, 0.15);
      chain(osc(a, 'sine', 130, 70, t, 0.15), gt, out);
    },
    // cracks spreading: dry clicks and a thin ping
    domeCrack(a, out, t) {
      for (let i = 0; i < 6; i++) {
        const ti = t + i * 0.018 + Math.random() * 0.01, g = G(a); env(g, ti, 0.001, 0.22 - i * 0.025, 0.03);
        chain(noise(a, ti, 0.05), filt(a, 'bandpass', 3000 + Math.random() * 2500, 3000, ti, 0.05, 3), g, out);
      }
      const gp = G(a); env(gp, t, 0.002, 0.08, 0.35);
      chain(osc(a, 'sine', 2900, 2700, t, 0.35), gp, out);
    },
    // the dome breaking: a burst of glass, scattered pings, a low thump
    domeShatter(a, out, t) {
      const gn = G(a); env(gn, t, 0.004, 0.45, 0.7);
      chain(noise(a, t, 0.8), filt(a, 'bandpass', 2600, 6500, t, 0.6, 0.9), gn, out);
      for (let i = 0; i < 12; i++) {
        const ti = t + Math.random() * 0.35, f = 1800 + Math.random() * 4200, g = G(a); env(g, ti, 0.002, 0.07, 0.25);
        chain(osc(a, 'sine', f, f * 0.96, ti, 0.25), g, out);
      }
      const gl = G(a); env(gl, t, 0.004, 0.5, 0.45);
      chain(osc(a, 'sine', 95, 38, t, 0.45), gl, out);
    },
    // the dome pulled in (before the burst): a whoosh rising in pitch and loudness
    domeImplode(a, out, t) {
      const g = G(a); g.gain.setValueAtTime(0.02, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.26); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      chain(noise(a, t, 0.32), filt(a, 'bandpass', 250, 3200, t, 0.28, 1.5), g, out);
      const g2 = G(a); g2.gain.setValueAtTime(0.02, t); g2.gain.exponentialRampToValueAtTime(0.2, t + 0.26); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      chain(osc(a, 'sawtooth', 90, 360, t, 0.28), filt(a, 'lowpass', 600, 2400, t, 0.28), g2, out);
    },
    // the burst: a low boom with a puff of air
    domeBurst(a, out, t) {
      const g = G(a); env(g, t, 0.004, 0.6, 0.6);
      chain(osc(a, 'sine', 110, 34, t, 0.6), g, out);
      const gn = G(a); env(gn, t, 0.003, 0.35, 0.4);
      chain(noise(a, t, 0.45), filt(a, 'lowpass', 1800, 300, t, 0.4), gn, out);
      const gs = G(a); env(gs, t, 0.003, 0.12, 0.5);
      chain(osc(a, 'triangle', 880, 660, t, 0.5), gs, out);
    },
    // a monster bounced off the dome
    domePush(a, out, t) {
      const g = G(a); env(g, t, 0.003, 0.22, 0.16);
      chain(osc(a, 'sine', 170, 85, t, 0.16), g, out);
      const g2 = G(a); env(g2, t, 0.002, 0.07, 0.25);
      chain(osc(a, 'sine', 990, 940, t, 0.25), g2, out);
    },
    // ---- the break styles (js/voidbreaks.js) ----
    // freeze-frame: a sharp crack of a click, a high ring that hangs in the stopped moment
    domeFreeze(a, out, t) {
      const gc = G(a); env(gc, t, 0.001, 0.4, 0.06);
      chain(noise(a, t, 0.08), filt(a, 'highpass', 2500, 2500, t, 0.08), gc, out);
      const gr = G(a); env(gr, t, 0.003, 0.12, 0.6);
      chain(osc(a, 'sine', 3520, 3400, t, 0.6), gr, out);
      const gr2 = G(a); env(gr2, t, 0.003, 0.06, 0.5);
      chain(osc(a, 'sine', 5280, 5150, t, 0.5), gr2, out);
    },
    // plates falling and melting: a low groan, a wet sizzle
    domeMelt(a, out, t) {
      const g = G(a); env(g, t, 0.08, 0.2, 0.9);
      chain(osc(a, 'sawtooth', 80, 46, t, 1.0), filt(a, 'lowpass', 500, 160, t, 1.0, 3), g, out);
      const gs = G(a); env(gs, t + 0.15, 0.1, 0.18, 1.0);
      chain(noise(a, t + 0.15, 1.15), filt(a, 'highpass', 4000, 2200, t + 0.15, 1.1, 0.7), gs, out);
    },
    // turning to stardust: a soft breath and a shower of falling chimes
    domeDust(a, out, t) {
      const gn = G(a); env(gn, t, 0.15, 0.14, 1.1);
      chain(noise(a, t, 1.3), filt(a, 'bandpass', 1500, 6000, t, 1.2, 0.8), gn, out);
      for (let i = 0; i < 16; i++) {
        const ti = t + i * 0.055 + Math.random() * 0.03, f = 2600 - i * 90 + Math.random() * 300, g = G(a); env(g, ti, 0.004, 0.06, 0.5);
        chain(osc(a, 'sine', f, f, ti, 0.5), g, out);
      }
    },
    // thorns flung out of the dome: a quick airy whoosh
    domeThorn(a, out, t) {
      const g = G(a); env(g, t, 0.01, 0.3, 0.25);
      chain(noise(a, t, 0.3), filt(a, 'bandpass', 1200, 5200, t, 0.25, 1.4), g, out);
    },
    // a thorn hits a monster: a dull thud with a glassy tick
    domeStab(a, out, t) {
      const g = G(a); env(g, t, 0.002, 0.25, 0.12);
      chain(osc(a, 'sine', 210, 90, t, 0.12), g, out);
      const g2 = G(a); env(g2, t, 0.001, 0.08, 0.1);
      chain(osc(a, 'triangle', 2400, 2100, t, 0.1), g2, out);
    },
    // the void leaking out: a dark rush rising out of the ground, then sucked back in
    domeDrain(a, out, t) {
      const g = G(a); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.18); g.gain.exponentialRampToValueAtTime(0.12, t + 0.55); g.gain.exponentialRampToValueAtTime(0.3, t + 0.78); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
      chain(noise(a, t, 1.0), filt(a, 'lowpass', 300, 1100, t, 0.5, 2), g, out);
      const gs = G(a); env(gs, t, 0.05, 0.4, 0.8);
      chain(osc(a, 'sine', 70, 40, t, 0.85), gs, out);
    },
    // the drained power flowing into the hero: a soft rising chime
    domeHeal(a, out, t) {
      for (let i = 0; i < 3; i++) {
        const ti = t + i * 0.07, f = [660, 880, 1320][i], g = G(a); env(g, ti, 0.01, 0.1, 0.5);
        chain(osc(a, 'sine', f, f * 1.01, ti, 0.5), g, out);
      }
    },
  };
  SFX.P = P;   // (other files add patches here: js/hitfeel.js hf_hit / hf_heavy / hf_crit / hf_kill)
  // held sounds: start(a, out, t) → stop(t2)
  const LOOPS = {
    domeHum(a, out, t) {
      const g = G(a); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.5);
      const lp = filt(a, 'lowpass', 520, 520, t, 0, 2);
      const o1 = a.createOscillator(), o2 = a.createOscillator(), o3 = a.createOscillator();
      o1.type = 'sine'; o1.frequency.value = 55; o2.type = 'sine'; o2.frequency.value = 110.6; o3.type = 'triangle'; o3.frequency.value = 220.9;
      const g3 = G(a); g3.gain.value = 0.25; o3.connect(g3); g3.connect(lp);
      const lfo = a.createOscillator(), lg = G(a); lfo.frequency.value = 3.2; lg.gain.value = 0.035; lfo.connect(lg); lg.connect(g.gain);
      o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out);
      for (const o of [o1, o2, o3, lfo]) o.start(t);
      return (t2) => {
        g.gain.cancelScheduledValues(t2); g.gain.setValueAtTime(0.09, t2); g.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.35);
        for (const o of [o1, o2, o3, lfo]) o.stop(t2 + 0.4);
      };
    },
  };

  // ---------------- playing ----------------
  const now = () => (SFX.clock ? SFX.clock() : (NC.game && NC.game.time) || 0);   // (SFX.clock: a capture's own clock, frames / fps)
  function dest(a, out, o) {
    if (!o || !o.pan || !a.createStereoPanner) return out;
    const p = a.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); p.connect(out); return p;
  }
  SFX.play = function (name, o) {
    if (SFX.log) { SFX.log.push({ name, t: now(), o }); return; }
    if (off || !ac || vol <= 0 || quiet() || !P[name]) return;
    try { P[name](ac, dest(ac, master, o), ac.currentTime + 0.005, o); } catch (e) { /* a bad patch never stops the game */ }
  };
  let loopId = 0;
  SFX.loop = function (name, o) {
    const id = ++loopId;
    if (SFX.log) { SFX.log.push({ name, t: now(), o, loop: id }); return { stop: () => SFX.log && SFX.log.push({ stop: id, t: now() }) }; }
    if (off || !ac || vol <= 0 || !LOOPS[name]) return { stop() {} };
    let stop = null;
    try { stop = LOOPS[name](ac, dest(ac, master, o), ac.currentTime + 0.005); } catch (e) { stop = null; }
    return { stop: () => { if (stop && ac) stop(ac.currentTime); stop = null; } };
  };
  SFX.rec = function (on) { SFX.log = on ? [] : null; return SFX.log; };
  // render a log into a WAV: t0 = the game time the clip starts at, secs long
  SFX.render = async function (log, t0, secs, gain) {
    const sr = 44100, oac = new OfflineAudioContext(2, Math.ceil(sr * secs), sr);
    const m = oac.createGain(); m.gain.value = gain || 0.6; m.connect(oac.destination);
    const stops = {};
    for (const ev of log) {
      const t = Math.max(0, ev.t - t0);
      if (ev.stop) { if (stops[ev.stop]) stops[ev.stop](t); continue; }
      if (ev.loop) { stops[ev.loop] = LOOPS[ev.name](oac, dest(oac, m, ev.o), t); continue; }
      if (P[ev.name]) P[ev.name](oac, dest(oac, m, ev.o), t, ev.o);
    }
    const buf = await oac.startRendering();
    const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, b = new DataView(new ArrayBuffer(44 + n * 4));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) b.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); b.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 2, true);
    b.setUint32(24, sr, true); b.setUint32(28, sr * 4, true); b.setUint16(32, 4, true); b.setUint16(34, 16, true); w(36, 'data'); b.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { b.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); b.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    const bytes = new Uint8Array(b.buffer); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return 'data:audio/wav;base64,' + btoa(s);
  };

  // ESC menu → ตั้งค่า
  const set = (v) => { vol = +v; if (master) master.gain.value = vol; try { localStorage.setItem(KEY, String(vol)); } catch (e) { /* */ } };
  SFX.set = set;
  // (js/hitsfx.js plays its sample layers on this same context and volume; null while silent or while a clip records)
  SFX.bus = () => (!off && ac && vol > 0 && !quiet() && !SFX.log ? { ac, out: master } : null);
  const rows = (NC.MENU_SETTINGS = NC.MENU_SETTINGS || []);
  const OPTS = [['0', 'ปิด'], ['0.25', 'เบา'], ['0.5', 'กลาง'], ['0.85', 'ดัง']];
  rows.push({ name: 'เสียงเอฟเฟกต์', note: 'เสียงเหวี่ยงอาวุธ เสียงตีโดน (ตามอาวุธและตัวมอน) และเสียงเอฟเฟกต์สกิล', opts: OPTS,
    get: () => OPTS.reduce((b, o) => (Math.abs(+o[0] - vol) < Math.abs(+b[0] - vol) ? o : b))[0], set });
})();
