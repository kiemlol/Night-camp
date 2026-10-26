/* samglow.js — the samurai swords painted with the artist's six-pass method, their HAMON glowing (the user, 2026-10-04,
   after the berserker greatsword: "ทำดาบซามูไร หลักการแบบนี้ด้วย"). One per samurai job, each the premium version of
   the job's sword (art: assets/gen/make_samgl_prompts.py -> tools/samgl_cut.py):
     katana_moonlit   Moonblade      the hamon breathes pale moonlight blue, silver-blue sparkles drift off it
     nodachi_crimson  Crimson Ronin  the hamon beats blood red like a heart (as the berserker sword), embers rise
     katana_tempest   Tempest Ronin  the hamon flickers teal like a gust, little wind wisps stream off it
   Two light layers per sword (tools/veinglow.py --hue): <sprite>_vein.png (the hamon pushed hot) and _bloom.png (its
   halo, PAD px bigger) drawn with 'lighter' while the blade is OUT (never in its scabbard), brighter on swings, and
   drawn again after the night's darkness (the gs_berserk.js way: the frame remembered, redrawn in NC.drawTrail).
   Unreleased catalog items: registered only when the samurai weapon source is present.
   Load after samurai.js and gs_berserk.js. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, FX = NC.FX;
  const DIR = 'assets/samurai/';
  // numbers from tools/samgl_cut.py (assets/gen/_samgl/numbers.json): sprite size in game units, grip, vein points
  const SW = {
    katana_moonlit: { base: 'katana_moon', name: 'คาตานะแสงจันทร์ (ลงสีใหม่)', rgb: '150,190,255', beat: 'breath',
      desc: 'คาตานะเหล็กเย็นเงาจันทร์ เส้นฮามอนเรืองสีฟ้าจันทร์ หายใจช้าๆ (ไอเทมทดสอบ)',
      w: 18.1, h: 100, ax: 0.531, grip: 0.208, pad: 24, pts: [[0.571,0.552],[0.643,0.481],[0.411,0.152],[0.482,0.377],[0.607,0.316],[0.5,0.371],[0.518,0.361],[0.589,0.587],[0.589,0.352],[0.643,0.5],[0.589,0.332],[0.625,0.387],[0.643,0.461],[0.429,0.148],[0.571,0.294],[0.411,0.177]] },
    nodachi_crimson: { base: 'nodachi_blood', name: 'โนดาจิโลหิต (ลงสีใหม่)', rgb: '255,55,45', beat: 'heart',
      desc: 'โนดาจิเหล็กเลือด เส้นฮามอนสีแดงเต้นเป็นจังหวะหัวใจ (ไอเทมทดสอบ)',
      w: 21.8, h: 132, ax: 0.543, grip: 0.191, pad: 24, pts: [[0.597,0.53],[0.672,0.414],[0.373,0.094],[0.463,0.303],[0.552,0.187],[0.493,0.291],[0.507,0.276],[0.493,0.163],[0.597,0.261],[0.612,0.426],[0.567,0.212],[0.493,0.323],[0.642,0.387],[0.269,0.091],[0.403,0.158],[0.463,0.126]] },
    katana_tempest: { base: 'katana_wind', name: 'คาตานะสายลม (ลงสีใหม่)', rgb: '80,240,210', beat: 'gust',
      desc: 'คาตานะเหล็กลมฟ้าอมเขียว เส้นฮามอนสีเขียวมรกตไหววูบตามลม (ไอเทมทดสอบ)',
      w: 19.7, h: 104, ax: 0.525, grip: 0.27, pad: 24, pts: [[0.574,0.494],[0.557,0.438],[0.525,0.168],[0.59,0.357],[0.59,0.276],[0.574,0.351],[0.557,0.342],[0.443,0.55],[0.541,0.332],[0.574,0.444],[0.623,0.298],[0.557,0.376],[0.525,0.429],[0.492,0.165],[0.557,0.258],[0.443,0.23]] },
  };
  const L = {};
  for (const [id, c] of Object.entries(SW)) {
    const base = ITEMS[c.base];
    if (!base || !c.w) { delete SW[id]; continue; }          // (no samurai catalog loaded, or no art yet)
    const spr = 'w_' + id;
    NC.ASSET_MANIFEST[spr] = { src: DIR + spr + '.png', w: c.w, h: c.h, ax: c.ax, ay: 1.0 };
    const W = Object.assign({}, base, { id, sprite: spr, name: c.name, desc: c.desc, grip: c.grip });
    delete W._saya;                                           // (the scabbard reads ITS blade's curve, js/samurai.js)
    if (base.tuck) W.tuck = Object.assign({}, base.tuck, { grip: c.grip });
    ITEMS[id] = W;
    L[id] = { vein: new Image(), bloom: new Image() };
    L[id].vein.src = DIR + spr + '_vein.png'; L[id].bloom.src = DIR + spr + '_bloom.png';
  }
  if (!Object.keys(SW).length) return;

  // ---------------- the beat of each hamon ----------------
  const pulse = (x, at, w) => Math.exp(-(((x - at) / w) ** 2));
  function beat(kind, t, swinging) {
    let b;
    if (kind === 'heart') { const c = t % 1.3; b = 0.42 + 0.58 * Math.max(pulse(c, 0.12, 0.09), 0.7 * pulse(c, 0.36, 0.1)); }
    else if (kind === 'breath') b = 0.55 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 2.8));
    else b = 0.5 + 0.22 * Math.sin(t * 7.3) * Math.sin(t * 2.1) + 0.18 * pulse(t % 1.7, 0.3, 0.12);   // (a gust: uneven)
    return swinging ? Math.min(1.35, b + 0.55) : b;
  }

  // ---------------- drawn over the sword (and again after the night's darkness) ----------------
  const H = { hero: null, inv: null, t: 0, sparkT: 0, frames: [] };
  const baseDP = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    const p = game.player;
    if (!p || !SW[p.equip.weapon]) return baseDP.apply(this, arguments);
    H.hero = p; H.t = game.time; H.inv = ctx.getTransform().inverse();
    try { return baseDP.apply(this, arguments); } finally { H.hero = null; }
  };
  function layers(ctx, f) {
    const { ox, oy, w, h, px, a, lay } = f;
    ctx.globalCompositeOperation = 'lighter';
    if (lay.bloom.complete && lay.bloom.naturalWidth) {
      const g1 = f.pad * px, g2 = f.pad * px * 2.2;
      for (let left = a * 1.3; left > 0.01; left -= 1) { ctx.globalAlpha = Math.min(1, left); ctx.drawImage(lay.bloom, ox - g1, oy - g1, w + 2 * g1, h + 2 * g1); }
      ctx.globalAlpha = Math.min(1, 0.5 * a); ctx.drawImage(lay.bloom, ox - g2, oy - g2 * 0.5, w + 2 * g2, h + g2);
    }
    ctx.globalAlpha = Math.min(1, 0.55 + 0.45 * a);
    ctx.drawImage(lay.vein, ox, oy, w, h);
    if (a > 0.9) { ctx.globalAlpha = Math.min(1, a - 0.9); ctx.drawImage(lay.vein, ox, oy, w, h); }
  }
  const baseDW = NC.drawWeapon;
  NC.drawWeapon = function (ctx, Wd, hx, hy, ang, o) {
    baseDW.apply(this, arguments);
    o = o || {};
    const c = Wd && SW[Wd.id], lay = c && L[Wd.id];
    if (!c || o.silhouette || o.sayaOnly || o.sheath > 0.5 || !lay.vein.complete || !lay.vein.naturalWidth) return;  // (sheathed: dark)
    const s = NC.SPR[Wd.sprite];
    if (!s) return;
    const p = H.hero, t = p ? H.t : performance.now() / 1000;
    const swinging = !!(p && p.atk && p.atk.on);
    const k = (o.scale || 1) * 0.95, w = s.w * k, h = s.h * k, grip = o.grip === undefined ? Wd.grip : o.grip;
    const f = { ox: -s.ax * w, oy: -h * (1 - grip), w, h, px: w / lay.vein.naturalWidth, a: beat(c.beat, t, swinging), lay, pad: c.pad };
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ang + Math.PI / 2);
    if (o.len !== undefined && o.len !== 1) ctx.scale(1, o.len);
    if (p) {
      f.m = ctx.getTransform(); H.frames.push(f);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(lay.vein, f.ox, f.oy, w, h);
    } else layers(ctx, f);                                   // (a window, a portrait: drawn right here)
    if (p && H.inv && t > H.sparkT && c.pts.length) {
      H.sparkT = t + (swinging ? 0.035 : 0.14);
      const q = c.pts[(Math.random() * c.pts.length) | 0];
      const wp = H.inv.transformPoint(ctx.getTransform().transformPoint(new DOMPoint(f.ox + q[0] * w, f.oy + q[1] * h)));
      spark(c, wp.x, wp.y, swinging, p.facing || p.dir || 1);
      light(c, p, f.a);
    }
    ctx.restore();
  };
  const baseTrail = NC.drawTrail;
  NC.drawTrail = function (ctx, game) {
    if (H.frames.length) {
      ctx.save();
      for (const f of H.frames) { ctx.setTransform(f.m); layers(ctx, f); }
      ctx.restore();
      H.frames.length = 0;
    }
    return baseTrail.apply(this, arguments);
  };
  // a soft light of the hamon's colour round the hero (fx.js ages it; refreshed while the blade is out)
  const lights = {};
  function light(c, p, a) {
    let l = lights[c.rgb];
    if (!l || !FX.lights.includes(l)) { l = lights[c.rgb] = { x: p.x, y: p.y - 40, r: 170, rgb: c.rgb, a: 0, life: 0.5, t: 0, follow: p, oy: -40 }; FX.lights.push(l); }
    l.a = 0.3 + 0.35 * Math.min(1, a); l.t = 0.05;
  }
  // what drifts off the hamon: moon sparkles (four-point, slow), blood embers (rising), wind wisps (streaming back)
  function spark(c, x, y, hot, face) {
    const kind = c.beat, rgb = c.rgb;
    const wind = kind === 'gust', moon = kind === 'breath';
    FX.add({ type: 'custom', layer: 'glow', x, y, life: NC.rand(0.5, wind ? 0.8 : 1.0),
      vx: wind ? -face * NC.rand(40, hot ? 140 : 80) : NC.rand(-14, 14), vy: wind ? NC.rand(-20, 6) : -NC.rand(moon ? 12 : 30, hot ? 90 : (moon ? 30 : 55)), drag: 0.6,
      r: NC.rand(1.2, hot ? 2.6 : 2.0), rot: NC.rand(0, 6.28),
      draw(ctx, q, u) {
        const al = (1 - u) * (u < 0.15 ? u / 0.15 : 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (moon) {                                          // a little four-point star
          const r = q.r * 2.2 * (1 - 0.3 * u);
          ctx.translate(q.x, q.y); ctx.rotate(q.rot + u);
          ctx.fillStyle = `rgba(225,238,255,${al})`;
          ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.22, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.22, 0); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(0, r * 0.22); ctx.lineTo(r, 0); ctx.lineTo(0, -r * 0.22); ctx.closePath(); ctx.fill();
          ctx.fillStyle = `rgba(${rgb},${al * 0.3})`; ctx.beginPath(); ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2); ctx.fill();
        } else if (wind) {                                   // a short streak along its flight
          const len = 7 + 10 * (1 - u);
          ctx.strokeStyle = `rgba(${rgb},${al})`; ctx.lineWidth = q.r; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - Math.sign(q.vx || 1) * len, q.y - (q.vy || 0) * 0.04); ctx.stroke();
          ctx.strokeStyle = `rgba(230,255,250,${al * 0.8})`; ctx.lineWidth = q.r * 0.45;
          ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - Math.sign(q.vx || 1) * len * 0.5, q.y); ctx.stroke();
        } else {                                             // an ember
          ctx.fillStyle = `rgba(255,${(90 + 110 * (1 - u)) | 0},60,${al})`;
          ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 - 0.4 * u), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(${rgb},${al * 0.25})`;
          ctx.beginPath(); ctx.arc(q.x, q.y, q.r * 3.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      } });
  }
  NC.SamGlow = { swords: SW, beat };
})();
