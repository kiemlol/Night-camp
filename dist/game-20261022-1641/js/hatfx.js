/* hatfx.js — hats that look precious (the user, 2026-09-29: "หมวกให้มีเอฟเฟกต์ด้วย บางใบ ให้ดูแพง"). Visual only.
   - every legend hat (and, fainter and slower, every epic one) has a light that sweeps across it now and then;
   - some hats have their own effect: glows on their gems / eyes / flames, embers or spores rising, snow or rain
     falling, ghost wisps, shadow smoke, crystals circling the head, lightning crackling, fireflies, rainbow sparkles
     (the table FXH below; positions are fractions of the hat picture, sizes are in hundredths of its width);
   - lamp and fire hats light up the night round the player (FX.lights, like aura99.js).
   avatar.js calls NC.hatFx(ctx, hat, box, o, layer) in the head's frame (it turns and flips with the head): layer 0
   before the head is painted (glows and the back half of what circles the head), layer 1 after the hat. Everything is
   worked out from the clock, not spawned, so it shows wherever the hero is drawn: in the world, on bots and friends,
   in the equipment screen's doll, in the Lab, on the hat fitting page. */
(function () {
  'use strict';
  const NC = window.NC, V = NC.VFX, TAU = Math.PI * 2;
  const clock = () => (NC.HATFX && NC.HATFX.at != null ? NC.HATFX.at : performance.now() / 1000); // (NC.HATFX.at: a fixed moment, for pictures)
  const frac = (x) => x - Math.floor(x);
  const hash = (i, s) => frac(Math.sin(i * 127.1 + s * 311.7) * 43758.5453);
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------------- the effects of single hats ----------------
  // aura: a soft glow behind (c, r, a) · glow: pulsing lights on points · rise / fall: particles (kind: ember, spore,
  // wisp, bubble, smoke, snow, rain, dust, rainbow) · twinkle: four-point glints · orbit: crystals circling the head ·
  // bolts: lightning between points · flies: fireflies wandering
  const A = (rgb, a, c, r) => ({ k: 'aura', rgb, a, c: c || [0.5, 0.45], r: r || 0.6 });
  const G = (pts, rgb, r, a, pulse) => ({ k: 'glow', pts, rgb, r, a, pulse: pulse || 0.6 });
  const R = (kind, rgb, n, u, v, h, speed, size, o) => Object.assign({ k: 'rise', kind, rgb, n, u, v, h, speed, size }, o || {});
  const F = (kind, rgb, n, u, v, h, speed, size, o) => Object.assign({ k: 'fall', kind, rgb, n, u, v, h, speed, size }, o || {});
  const TW = (pts, rgb, size, rate) => ({ k: 'twinkle', pts, rgb, size: size || 5, rate: rate || 0.45 });
  const FXH = {
    hat_hc_boss_mushking: [A('185,120,255', 0.3), G([[0.22, 0.2], [0.52, 0.08], [0.85, 0.3]], '200,150,255', 0.12, 0.4), R('spore', '180,160,255', 7, [0.1, 0.9], 0.25, 0.8, 0.35, 1.3)],
    hat_hc_boss_batking: [A('255,80,90', 0.2), TW([[0.5, 0.42], [0.33, 0.56], [0.72, 0.6]], '255,210,130', 6)],
    hat_hc_boss_antqueen: [A('255,190,80', 0.2), G([[0.42, 0.08], [0.93, 0.1]], '255,190,80', 0.09, 0.55, 0.9), TW([[0.52, 0.58]], '255,220,140', 6)],
    hat_hc_boss_cryptlord: [A('120,190,255', 0.32), G([[0.17, 0.3], [0.5, 0.13], [0.82, 0.3]], '150,215,255', 0.13, 0.5, 1.3), R('wisp', '140,210,255', 6, [0.12, 0.88], 0.25, 0.75, 0.5, 1.4)],
    hat_hc_boss_lavadragon: [A('255,110,40', 0.3), G([[0.1, 0.06], [0.9, 0.06]], '255,120,40', 0.08, 0.45, 1.1), R('ember', '255,140,50', 9, [0.05, 0.95], 0.35, 0.85, 0.55, 1)],
    hat_hc_boss_demonlord: [A('140,60,200', 0.24), G([[0.62, 0.65]], '255,60,80', 0.06, 0.7, 1.2), R('smoke', '110,60,170', 6, [0.02, 0.98], 0.3, 0.5, 0.28, 2.2)],
    hat_hc_boss_frostqueen: [A('160,220,255', 0.32), TW([[0.5, 0.1], [0.25, 0.35], [0.78, 0.35], [0.62, 0.62]], '200,240,255', 6, 0.55), F('snow', '220,245,255', 8, [-0.1, 1.1], 0.2, 0.6, 0.3, 1)],
    hat_hc_boss_stormlord: [A('255,220,120', 0.22), G([[0.55, 0.2]], '255,220,100', 0.13, 0.4, 2), { k: 'bolts', pts: [[0.45, 0.18], [0.65, 0.2], [0.2, 0.32], [0.85, 0.3], [0.5, 0.02]], rgb: '255,235,140', rate: 2.4 }],
    hat_hc_boss_voidking: [A('150,90,255', 0.3), { k: 'orbit', n: 5, c: [0.5, 0.5], rx: 0.46, ry: 0.13, speed: 0.2, fill: ['#6a34c8', '#b07cff'], rgb: '175,110,255', size: 5 }, TW([[0.5, 0.15], [0.5, 0.6]], '220,180,255', 6)],
    hat_hc_boss_treelord: [G([[0.12, 0.4], [0.25, 0.5], [0.68, 0.3], [0.88, 0.55]], '255,200,80', 0.07, 0.55, 0.7), { k: 'flies', n: 5, c: [0.5, 0.35], rx: 0.6, ry: 0.4, rgb: '230,255,120' }],
    hat_hc_boss_kraken: [A('80,220,210', 0.2), R('bubble', '170,255,240', 6, [0.1, 0.9], 0.25, 0.75, 0.4, 1.4)],
    hat_hc_boss_phoenix: [A('255,140,40', 0.36, [0.5, 0.4], 0.7), R('ember', '255,170,60', 11, [0.08, 0.92], 0.2, 1.0, 0.6, 1.1), TW([[0.85, 0.55]], '255,230,140', 7)],
    hat_hc_boss_golem: [A('120,255,240', 0.18), G([[0.3, 0.35], [0.55, 0.25], [0.72, 0.45], [0.2, 0.6]], '120,255,240', 0.1, 0.4, 0.8)],
    hat_hc_boss_werewolf: [G([[0.555, 0.385]], '255,40,40', 0.05, 0.9, 1.4), R('dust', '255,90,90', 3, [0.2, 0.8], 0.3, 0.5, 0.25, 1)],
    hat_hc_boss_spiderqueen: [A('160,80,220', 0.22), G([[0.52, 0.47]], '200,100,255', 0.08, 0.6, 0.9), TW([[0.52, 0.47], [0.25, 0.3], [0.8, 0.3]], '230,190,255', 5)],
    hat_hc_boss_nightmare: [A('150,70,255', 0.3), G([[0.63, 0.72]], '200,120,255', 0.05, 0.7), R('wisp', '190,110,255', 4, [0.08, 0.28], 0.28, 0.6, 0.6, 1.5), R('wisp', '190,110,255', 4, [0.68, 0.88], 0.28, 0.6, 0.6, 1.5, { seed: 7 })],
    hat_hc_boss_moonwitch: [A('120,140,255', 0.2), G([[0.57, 0.46]], '225,235,255', 0.12, 0.6, 0.5), TW(null, '220,230,255', 5, 0.5)],
    hat_hc_boss_hydra: [A('60,200,180', 0.18), G([[0.5, 0.12], [0.2, 0.3], [0.82, 0.33]], '255,230,90', 0.035, 0.8, 1)],
    hat_hc_cool_winghelm: [TW([[0.65, 0.5], [0.2, 0.2], [0.82, 0.15]], '220,240,255', 6), G([[0.65, 0.5]], '120,190,255', 0.07, 0.5)],
    hat_hc_cool_ironcrown: [G([[0.62, 0.5]], '255,60,60', 0.08, 0.55, 0.9), TW([[0.62, 0.5], [0.3, 0.4]], '255,200,200', 5)],
    hat_hc_cool_kabuto: [TW([[0.3, 0.15], [0.62, 0.1], [0.5, 0.42]], '255,225,140', 6)],
    hat_hc_cool_gentleman: [TW([[0.4, 0.62], [0.55, 0.45]], '255,240,220', 5)],
    hat_hc_cool_shinobi: [R('smoke', '70,60,90', 3, [0.1, 0.4], 0.5, 0.35, 0.3, 1.8)],
    hat_hc_misc_campfire: [G([[0.5, 0.42]], '255,160,60', 0.3, 0.5, 2.6), R('ember', '255,170,70', 7, [0.35, 0.65], 0.25, 0.9, 0.8, 0.9), R('smoke', '120,110,120', 2, [0.45, 0.55], 0.05, 0.5, 0.25, 1.6, { a: 0.6 })],
    hat_hc_misc_candle: [G([[0.5, 0.12]], '255,190,90', 0.34, 0.55, 2.2)],
    hat_hc_misc_cloud: [F('rain', '140,195,255', 7, [0.15, 0.85], 0.95, 0.35, 1.4, 1)],
    hat_hc_misc_fireflyjar: [G([[0.5, 0.45]], '220,255,120', 0.35, 0.3, 0.6), { k: 'flies', n: 3, c: [0.5, 0.45], rx: 0.2, ry: 0.2, rgb: '230,255,120' }, { k: 'flies', n: 2, c: [0.5, 0.3], rx: 0.9, ry: 0.5, rgb: '230,255,120', seed: 5 }],
    hat_hc_misc_crystal: [G([[0.12, 0.5], [0.3, 0.25], [0.5, 0.1], [0.72, 0.25], [0.88, 0.45]], '255,150,230', 0.07, 0.5, 0.8), TW([[0.5, 0.1], [0.6, 0.75], [0.3, 0.25]], '255,220,255', 6)],
    hat_hc_misc_unicorn: [G([[0.6, 0.08]], '255,220,255', 0.08, 0.6, 0.9), R('rainbow', '', 7, [0.35, 0.85], 0.2, 0.6, 0.45, 1.2)],
    hat_hc_misc_antennae: [G([[0.2, 0.12], [0.72, 0.12]], '255,230,150', 0.1, 0.6, 0.7)],
    hat_hc_misc_lantern: [G([[0.86, 0.27]], '255,230,150', 0.22, 0.6, 0.4)],
    hat_hc_misc_book: [R('dust', '255,220,120', 6, [0.2, 0.8], 0.3, 0.6, 0.35, 1)],
  };
  // lamp and fire hats: the night light round the player (r: how far, a: how bright)
  const LIGHT = {
    hat_hc_misc_campfire: { rgb: '255,170,90', r: 230, a: 0.62, flick: true }, hat_hc_misc_candle: { rgb: '255,200,120', r: 190, a: 0.55, flick: true },
    hat_hc_misc_lantern: { rgb: '255,230,160', r: 240, a: 0.6 }, hat_hc_misc_fireflyjar: { rgb: '220,255,140', r: 170, a: 0.45 },
    hat_hc_boss_cryptlord: { rgb: '140,200,255', r: 180, a: 0.45 }, hat_hc_boss_lavadragon: { rgb: '255,130,60', r: 180, a: 0.45 },
    hat_hc_boss_phoenix: { rgb: '255,170,70', r: 210, a: 0.5 },
  };

  // ---------------- drawing ----------------
  function sparkle(ctx, x, y, s, a, rgb, rot) {
    if (a < 0.02) return;
    V.glow(ctx, x, y, s * 2.2, rgb, 0.7 * a, true);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, a)})`;
    V.flarePath(ctx, x, y, s, s * 0.2, rot || 0); ctx.fill();
    ctx.restore();
  }
  const hue = (h) => { // a rainbow colour as 'r,g,b'
    const f = (n) => { const k = (n + h * 6) % 6; return Math.round(255 * (1 - 0.55 * Math.max(0, Math.min(k, 4 - k, 1)))); };
    return `${f(5)},${f(3)},${f(1)}`;
  };
  function particle(ctx, kind, x, y, r, a, rgb, ph, i) {
    if (a < 0.02) return;
    switch (kind) {
      case 'ember':
        V.glow(ctx, x, y, r * 4, rgb, 0.75 * a, true);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,240,200,${a})`;
        ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, TAU); ctx.fill(); ctx.restore();
        break;
      case 'spore': case 'dust': case 'wisp': {
        V.glow(ctx, x, y, r * (kind === 'wisp' ? 5 : 3.2), rgb, (kind === 'wisp' ? 0.55 : 0.7) * a, kind !== 'dust');
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${0.8 * a})`;
        ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, TAU); ctx.fill(); ctx.restore();
        break;
      }
      case 'bubble':
        ctx.save(); ctx.globalAlpha *= a;
        ctx.strokeStyle = `rgb(${rgb})`; ctx.lineWidth = Math.max(0.6, r * 0.35);
        ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(x - r * 0.5, y - r * 0.5, r * 0.4, 0, TAU); ctx.fill();
        ctx.restore();
        break;
      case 'smoke':
        ctx.save(); ctx.fillStyle = `rgba(${rgb},${0.32 * a})`;
        ctx.beginPath(); ctx.arc(x, y, r * (1.6 + ph * 2.4), 0, TAU); ctx.fill(); ctx.restore();
        break;
      case 'snow':
        V.glow(ctx, x, y, r * 3, rgb, 0.5 * a, false);
        ctx.save(); ctx.fillStyle = `rgba(255,255,255,${0.95 * a})`; ctx.beginPath(); ctx.arc(x, y, r * 0.9, 0, TAU); ctx.fill(); ctx.restore();
        break;
      case 'rain':
        ctx.save(); ctx.strokeStyle = `rgba(${rgb},${0.9 * a})`; ctx.lineWidth = Math.max(0.8, r * 0.7); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - r * 0.6, y + r * 4.5); ctx.stroke(); ctx.restore();
        break;
      case 'rainbow':
        sparkle(ctx, x, y, r * 3.2, a, hue(frac(i * 0.37 + ph)), ph * 2);
        break;
    }
  }

  function layer(ctx, hat, b, t, L, back) {
    const K = b.w / 100, X = (u) => b.x + u * b.w, Y = (v) => b.y + v * b.h, seed = L.seed || 0;
    switch (L.k) {
      case 'aura':
        if (back) V.glow(ctx, X(L.c[0]), Y(L.c[1]), L.r * b.w, L.rgb, L.a * (0.82 + 0.18 * Math.sin(t * 1.6)), false);
        break;
      case 'glow':
        if (!back) L.pts.forEach(([u, v], i) => V.glow(ctx, X(u), Y(v), L.r * b.w, L.rgb, L.a * (0.7 + 0.3 * Math.sin(t * L.pulse * TAU + i * 1.9)), true));
        break;
      case 'rise': case 'fall':
        if (back) break;
        for (let i = 0; i < L.n; i++) {
          const h1 = hash(i, 1 + seed), h2 = hash(i, 2 + seed), h3 = hash(i, 3 + seed);
          const ph = frac(t * L.speed * (0.7 + 0.6 * h3) + h1);
          const u = lerp(L.u[0], L.u[1], h2) + Math.sin(t * 1.7 + i * 2.3) * (L.kind === 'snow' ? 0.05 : 0.02);
          const y = Y(L.v) + (L.k === 'rise' ? -1 : 1) * ph * L.h * b.w;
          const a = Math.sin(ph * Math.PI) * (L.a || 1) * (L.kind === 'ember' ? 0.8 + 0.2 * Math.sin(t * 20 + i) : 1);
          const r = L.size * K * (L.kind === 'rain' || L.kind === 'bubble' || L.kind === 'smoke' ? 1 : 2.1) * (0.7 + 0.6 * h3) * (L.kind === 'wisp' || L.kind === 'ember' ? 1 - ph * 0.5 : 1);
          particle(ctx, L.kind, X(u), y, r, a, L.rgb, ph, i);
        }
        break;
      case 'twinkle': {
        if (back) break;
        const n = L.pts ? L.pts.length : 4;
        for (let i = 0; i < n; i++) {
          const q = t * L.rate + hash(i, 5 + seed), ph = frac(q), cyc = Math.floor(q);
          if (ph > 0.3) continue;
          const [u, v] = L.pts ? L.pts[i] : [lerp(0.05, 0.95, hash(cyc, i + 11)), lerp(0.0, 0.5, hash(cyc, i + 17))];
          sparkle(ctx, X(u), Y(v), L.size * K * Math.sin((ph / 0.3) * Math.PI) * 1.2, Math.sin((ph / 0.3) * Math.PI), L.rgb, ph * 3);
        }
        break;
      }
      case 'orbit':
        for (let i = 0; i < L.n; i++) {
          const ang = t * L.speed * TAU + (i / L.n) * TAU, depth = Math.sin(ang);
          if ((depth < 0) !== back) continue;
          const x = X(L.c[0]) + Math.cos(ang) * L.rx * b.w, y = Y(L.c[1]) + depth * L.ry * b.w + Math.sin(t * 2 + i) * 2 * K;
          const s = L.size * K * (0.8 + 0.25 * depth), a = back ? 0.55 : 1;
          V.glow(ctx, x, y, s * 3, L.rgb, 0.5 * a, false);
          ctx.save(); ctx.globalAlpha *= a;
          ctx.beginPath(); ctx.moveTo(x, y - s * 1.5); ctx.lineTo(x + s * 0.8, y); ctx.lineTo(x, y + s * 1.5); ctx.lineTo(x - s * 0.8, y); ctx.closePath();
          ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(0.8, s * 0.3); ctx.strokeStyle = '#2a1f3d'; ctx.stroke();
          ctx.fillStyle = L.fill[0]; ctx.fill();
          ctx.beginPath(); ctx.moveTo(x, y - s * 1.5); ctx.lineTo(x - s * 0.8, y); ctx.lineTo(x, y + s * 0.2); ctx.closePath(); ctx.fillStyle = L.fill[1]; ctx.fill();
          ctx.restore();
        }
        break;
      case 'bolts': {
        if (back) break;
        const q = t * L.rate, ph = frac(q), cyc = Math.floor(q);
        if (ph > 0.4 || hash(cyc, 3) < 0.25) break;
        const P = L.pts, i0 = Math.floor(hash(cyc, 1) * P.length), i1 = (i0 + 1 + Math.floor(hash(cyc, 2) * (P.length - 1))) % P.length;
        const pts = V.boltPoints(X(P[i0][0]), Y(P[i0][1]), X(P[i1][0]), Y(P[i1][1]), 6, 7 * K, cyc * 13 + 1);
        const a = (1 - ph / 0.4) * (0.7 + 0.3 * Math.sin(t * 60));
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        const line = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); };
        line(); ctx.strokeStyle = `rgba(${L.rgb},${0.55 * a})`; ctx.lineWidth = 8 * K; ctx.stroke();
        line(); ctx.strokeStyle = `rgba(${L.rgb},${a})`; ctx.lineWidth = 3.2 * K; ctx.stroke();
        line(); ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1.4 * K; ctx.stroke();
        ctx.restore();
        V.glow(ctx, pts[0][0], pts[0][1], 14 * K, L.rgb, 0.8 * a, true);
        V.glow(ctx, pts[pts.length - 1][0], pts[pts.length - 1][1], 14 * K, L.rgb, 0.8 * a, true);
        break;
      }
      case 'flies':
        if (back) break;
        for (let i = 0; i < L.n; i++) {
          const a1 = 0.5 + hash(i, 21 + seed), a2 = 0.4 + hash(i, 22 + seed), p0 = hash(i, 23 + seed) * TAU;
          const x = X(L.c[0]) + Math.sin(t * a1 + p0) * L.rx * b.w * 0.5, y = Y(L.c[1]) + Math.cos(t * a2 * 1.3 + p0) * L.ry * b.w * 0.5;
          const blink = Math.pow(Math.max(0, Math.sin(t * (1.2 + a2) + p0 * 2)), 2);
          V.glow(ctx, x, y, 7 * K, L.rgb, 0.8 * blink, true);
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,220,${0.9 * blink})`;
          ctx.beginPath(); ctx.arc(x, y, 1.3 * K, 0, TAU); ctx.fill(); ctx.restore();
        }
        break;
    }
  }

  // the sweeping shine: the hat's picture again, only a slanted band of it, added as light
  const shineCv = document.createElement('canvas'), sg = shineCv.getContext('2d');
  function shine(ctx, b, t, every, a, off) {
    const u = frac(t / every + off) * (every / 0.9); // the band crosses in 0.9 s, then rests
    if (u > 1.3) return;
    const img = b.hs.img, W = img.width, H = img.height;
    if (!W || !H) return;
    if (shineCv.width !== W || shineCv.height !== H) { shineCv.width = W; shineCv.height = H; } else sg.clearRect(0, 0, W, H);
    sg.globalCompositeOperation = 'source-over';
    sg.drawImage(img, 0, 0);
    sg.globalCompositeOperation = 'source-in';
    const x = lerp(-0.35, 1.35, u / 1.3) * W, bw = W * 0.16;
    sg.setTransform(1, 0, -0.45, 1, H * 0.45, 0); // slanted
    const gr = sg.createLinearGradient(x - bw, 0, x + bw, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,250,235,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    sg.fillStyle = gr; sg.fillRect(-W, 0, W * 3, H);
    sg.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= a;
    ctx.drawImage(shineCv, b.x, b.y, b.w, b.h);
    ctx.restore();
  }
  const shineOk = (hat) => !hat.back && !hat.rimBehind && !hat.hood && !hat.front;
  const offOf = new Map();
  const off = (id) => { if (!offOf.has(id)) offOf.set(id, hash(id.length * 7 + id.charCodeAt(4), 9)); return offOf.get(id); };

  NC.hatFx = function (ctx, hat, b, o, lay) {
    const t = clock(), id = hat.sprite, list = FXH[id];
    if (list) for (const L of list) layer(ctx, hat, b, t, L, lay === 0);
    if (lay === 1 && shineOk(hat)) {
      if (hat.rarity === 'legend') shine(ctx, b, t, 3.2, 0.55, off(id));
      else if (hat.rarity === 'epic') shine(ctx, b, t, 5, 0.35, off(id));
    }
  };
  NC.HATFX = { list: FXH, light: LIGHT };

  // ---------------- the night light of lamp and fire hats (the player) ----------------
  let lamp = null;
  const baseDraw = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    baseDraw(ctx, game);
    const p = game.player, hat = p && NC.ITEMS[p.equip && p.equip.hat], Lt = hat && LIGHT[hat.sprite];
    if (!Lt || p.dead > 0) return;
    if (!lamp || !NC.FX.lights.includes(lamp)) {
      lamp = { x: p.x, y: p.y - 110, r: Lt.r, rgb: Lt.rgb, a: 0, life: 0.6, t: 0, follow: p, oy: -110 };
      NC.FX.lights.push(lamp);
    }
    lamp.rgb = Lt.rgb; lamp.r = Lt.r; lamp.flick = !!Lt.flick;
    lamp.a = Lt.a; lamp.t = 0.05; // (kept alive while worn; fx.js fades it out once it's taken off)
  };
})();
