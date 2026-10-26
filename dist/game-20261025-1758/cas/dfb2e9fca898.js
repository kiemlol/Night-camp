/* online/charsel.js — the stage of the online character select (mockup A "campfire circle", the user's pick 2026-10-18;
   assets/gen/make_charsel_prompts.py, art cut by tools/charsel_cut.py). One canvas behind online/lobby.js's screen:
   the painted camp (assets/charsel/camp_bg.jpg, cover-fitted), the game's own campfire on its bare patch (camp_firebase +
   VFX.flame, as js/partywin.js), and the account's heroes as the slots, standing around the fire in their outfits
   (NC.HeroSpine.preview, else NC.drawHero). The selected one stands on the golden ring (assets/charsel/ring.png, drawn
   'lighter'), the others a little smaller and darker; a hovered one gets the ring tinted blue. Spots are in the
   painting's pixels; lobby.js asks NC.CharSel.spot(i) where to put each name plate. */
(function () {
  'use strict';
  const NC = window.NC;
  const BW = 1536, BH = 1024, TAU = Math.PI * 2;
  // [feet x, feet y, face, ring width] per slot in the painting (slot 2 stands before the log seat with the lantern)
  const SPOTS = [[290, 724, 1, 250], [716, 702, -1, 230], [926, 740, -1, 230]];
  const FIRE = [512, 726]; // the bare patch: the fire's base
  const FIRE_W = 262;      // camp_firebase's width in the painting's pixels
  const TONGUES = [[-30, 40, 86, 1.7], [34, 42, 92, 3.1], [0, 62, 138, 0], [-14, 30, 62, 4.4], [18, 28, 56, 5.2]]; // (camp.js)
  const BODY = 2.5;        // hero scale per painting pixel (NC.drawHero's scale)
  const img = (src) => { const i = new Image(); i.src = src; return i; };
  const BG = img('assets/charsel/camp_bg.jpg'), RING = img('assets/charsel/ring.png');

  let cv = null, ctx = null, raf = 0, slots = [], sel = 0, hover = -1, eqs = [], dpr = 1;
  let fit = { k: 1, ox: 0, oy: 0, w: 1, h: 1 };
  const blueRing = document.createElement('canvas');

  function resize() {
    if (!cv) return;
    const r = cv.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    if (h > w * 1.1) { // an upright phone: the three spots fill the width, the feet at 40% of the height (css/charsel.css)
      const k = w / 940;
      fit = { k, ox: w / 2 - 608 * k, oy: h * 0.4 - 715 * k, w, h, port: true };
      return;
    }
    const k = Math.max(w / BW, h / BH);
    fit = { k, ox: (w - BW * k) / 2, oy: (h - BH * k) / 2, w, h };
  }
  // the screen spot (CSS px) of a slot's feet, its scale, and how tall the hero stands there
  function spot(i) {
    const s = SPOTS[i] || SPOTS[0], k = fit.k, on = i === sel;
    const ks = BODY * k * (on ? 1 : 0.9);
    return { x: fit.ox + s[0] * k, y: fit.oy + s[1] * k, face: s[2], ring: s[3] * k, ks, k, top: fit.oy + s[1] * k - 128 * ks };
  }
  // which slot's hero is under a screen point (CSS px), -1 for none
  function hit(x, y) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < SPOTS.length; i++) {
      const p = spot(i), hw = 46 * p.ks;
      if (x < p.x - hw || x > p.x + hw || y < p.top - 10 * p.ks || y > p.y + 14 * p.ks) continue;
      const d = Math.abs(x - p.x);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function drawFire(c, t) {
    const b = NC.SPR && NC.SPR.camp_firebase, V = NC.VFX, k = fit.k;
    const fx = fit.ox + FIRE[0] * k, fy = fit.oy + FIRE[1] * k;
    if (!b) return;
    const s = (FIRE_W * k) / b.w, bw = b.w * s, bh = b.h * s;
    c.drawImage(b.img, fx - bw * b.ax, fy - bh * (b.ay || 1), bw, bh);
    if (V && V.flame) {
      const cx = fx - bw * b.ax + bw * 0.5, cy = fy - bh * (b.ay || 1) + bh * 0.58;
      for (const [dx, fw, fh, ph] of TONGUES) {
        const flick = 0.84 + 0.16 * Math.sin(t * 5.3 + ph * 2) + 0.06 * Math.sin(t * 13 + ph);
        V.flame(c, cx + dx * s + Math.sin(t * 2.1 + ph) * 3 * s, cy, fw * s, fh * s * flick, t * 7 + ph, V.PAL.fire, 1);
      }
    }
  }
  function glow(c, t) {
    const k = fit.k, fx = fit.ox + FIRE[0] * k, fy = fit.oy + (FIRE[1] - 60) * k;
    const fl = 0.93 + 0.05 * Math.sin(t * 7.3) + 0.03 * Math.sin(t * 17.1);
    const g = c.createRadialGradient(fx, fy, 12 * k, fx, fy, 520 * k * fl);
    g.addColorStop(0, 'rgba(255,170,80,0.30)'); g.addColorStop(0.5, 'rgba(255,140,60,0.10)'); g.addColorStop(1, 'rgba(255,140,60,0)');
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(0, 0, fit.w, fit.h); c.restore();
  }
  function ring(c, p, t, blue) {
    if (!RING.complete || !RING.naturalWidth) return;
    let src = RING;
    if (blue) { // (the gold piece tinted: code only tints the painted ring)
      if (blueRing.width !== RING.naturalWidth) {
        blueRing.width = RING.naturalWidth; blueRing.height = RING.naturalHeight;
        const b = blueRing.getContext('2d');
        b.drawImage(RING, 0, 0); b.globalCompositeOperation = 'source-atop'; b.fillStyle = 'rgba(120,190,255,0.85)'; b.fillRect(0, 0, blueRing.width, blueRing.height);
      }
      src = blueRing;
    }
    const w = p.ring * (1 + 0.02 * Math.sin(t * 2.4)), h = (w * RING.naturalHeight) / RING.naturalWidth;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.globalAlpha = blue ? 0.7 : 1;
    c.drawImage(src, p.x - w / 2, p.y - h * 0.52, w, h);
    if (!blue) { c.globalAlpha = 0.35 + 0.3 * Math.sin(t * 3); c.drawImage(src, p.x - w / 2, p.y - h * 0.52, w, h); } // (a breathing glow)
    c.restore();
  }
  function hero(c, i, p, t) {
    const eq = eqs[i];
    if (!eq) return;
    const on = i === sel, ph = i * 1.37;
    const o = { t: t + ph, clip: 'idle', face: p.face, key: 'charsel' + i };
    if (!on) o.tint = ['#1c1830', 0.3];
    if (NC.HeroSpine && NC.HeroSpine.preview && NC.HeroSpine.preview(c, eq, p.x, p.y, p.ks, o)) return;
    const P = NC.Anim.sample('idle', t + ph, NC.animCtx ? NC.animCtx(eq) : undefined);
    P.face = p.face;
    c.save();
    if (!on) c.filter = 'brightness(0.72)';
    NC.drawHero(c, eq, P, p.x, p.y, { scale: p.ks });
    c.restore();
  }
  function draw(t) {
    if (!cv) return;
    resize();
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#0d0b1a'; c.fillRect(0, 0, fit.w, fit.h);
    if (BG.complete && BG.naturalWidth) c.drawImage(BG, fit.ox, fit.oy, BW * fit.k, BH * fit.k);
    if (fit.port) { // (the painting's lower edge fades into the dark under it)
      const y1 = fit.oy + BH * fit.k, g = c.createLinearGradient(0, y1 - 90 * fit.k, 0, y1);
      g.addColorStop(0, 'rgba(13,11,26,0)'); g.addColorStop(1, '#0d0b1a');
      c.fillStyle = g; c.fillRect(0, y1 - 90 * fit.k, fit.w, 90 * fit.k + 1);
    }
    glow(c, t);
    const order = SPOTS.map((s, i) => i).sort((a, b) => SPOTS[a][1] - SPOTS[b][1]);
    let fireDone = false;
    for (const i of order) {
      const s = slots[i], p = spot(i);
      if (!fireDone && SPOTS[i][1] > FIRE[1]) { drawFire(c, t); fireDone = true; }
      if (s && !s.empty) { c.fillStyle = 'rgba(16,10,26,0.34)'; c.beginPath(); c.ellipse(p.x, p.y, 44 * p.ks, 10 * p.ks, 0, 0, TAU); c.fill(); }
      if (i === sel && s) ring(c, p, t, false); // (an empty slot picked shows its ring too: "this place"; none before the slots load)
      if (!s || s.empty) continue;
      if (i === hover && i !== sel) ring(c, p, t, true);
      hero(c, i, p, t);
    }
    if (!fireDone) drawFire(c, t);
  }
  function loop() {
    raf = 0;
    if (!cv || !cv.isConnected || cv.closest('[hidden]')) return;
    draw(performance.now() / 1000);
    raf = requestAnimationFrame(loop);
  }

  NC.CharSel = {
    SPOTS, FIRE,
    mount(canvas) { cv = canvas; ctx = cv.getContext('2d'); resize(); },
    set(list, eqList) { slots = list || []; eqs = eqList || []; },
    select(i) { sel = i; }, get selected() { return sel; },
    hover(i) { hover = i; },
    start() { if (!raf) raf = requestAnimationFrame(loop); },
    resize, spot, hit, draw, // (draw(t): tests in a background tab, which gets no animation frames)
  };
})();
