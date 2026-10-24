/* minimap.js — the new top-right corner: a round, illustrated minimap in a wooden ring, a round sky window for the
   time of day (sun, moon, stars, sunset colours), the time on a little wooden plaque and the zone on a ribbon; plus
   the warm dawn / dusk light in the world (NC.skyAmbient, used by game.js). It replaces NC.HUD.drawMap / drawDial
   (hud.js still calls them every frame, and the big map (M) uses the same drawMap) and keeps its own soft fog. */
(function () {
  'use strict';
  const NC = window.NC, TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const clamp = NC.clamp, lerp = NC.lerp;
  const ART = 5, FOG = 100; // map art: 1 px = 5 units; fog: 1 cell = 100 units

  // ---------------- the map art: the map's own day ground, with trees, houses and rocks drawn on it ----------------
  const CROWN = { // top-down colours of tall things
    tree: '#7ab65e', tree2: '#5f9c55', m_birch: '#d6d46c', m_apple: '#6db35c', w_fir: '#2f6a62', w_oldtree: '#3f8676',
    w_glowshroom: '#5fd2f2', w_shrooms3: '#b58ae8', c_deadtree: '#cbbba8', c_acacia: '#9aac50', c_spire: '#d27a4c',
  };
  const ROOF = { m_cottage: '#eac25c', m_windmill: '#b1aaa6', w_shroomhouse: '#e2544f', c_shack: '#b4663f', tent: '#c99b6b',
    roundtent: '#ece0c4', wagon: '#bcb8b0', crates: '#b98a58', rack: '#9a7454', barrel: '#a8784c' };
  const DOT = { rock: '#aaa4b2', bush: '#5fa058', stone: '#b4b0bc', fence: '#8e6a4c' };
  const LIGHTS = new Set(['torch', 'lamp', 'w_lantern']);

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), f = (v) => clamp(Math.round(v * k), 0, 255);
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  function artOf(world) {
    if (world.mapArt) return world.mapArt;
    const W = Math.ceil(world.W / ART), H = Math.ceil(world.H / ART);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(world.groundDay || world.ground, 0, 0, W, H);
    // a warm paper tone, like a painted map
    c.globalCompositeOperation = 'soft-light';
    c.fillStyle = 'rgba(255,232,190,0.55)'; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
    c.lineJoin = 'round';
    const FP = NC.FIELD_PROPS || {};
    // stone walls (the camp's ruins)
    for (const b of world.blocks || []) {
      const x = b.bx / ART, y = b.by / ART, w = 140 / ART, h = 110 / ART;
      c.fillStyle = '#4b4e66'; c.fillRect(x, y, w + 0.5, h + 0.5);
      c.fillStyle = '#6d7090'; c.fillRect(x + 1, y + 1, w - 2, h * 0.35);
    }
    const props = world.props.slice().sort((a, b) => a.y - b.y);
    // small things first, then roofs, then the crowns on top
    for (const p of props) {
      const s = NC.SPR[p.name];
      if (!s) continue;
      const kind = (FP[p.name] || {}).kind, x = p.x / ART, y = p.y / ART, w = (s.w * p.scale) / ART;
      const col = DOT[kind] || DOT[p.name];
      if (col) {
        c.fillStyle = col; c.strokeStyle = 'rgba(42,36,53,0.55)'; c.lineWidth = 1;
        if (kind === 'fence' || p.name === 'fence') { c.fillRect(x - w * 0.45, y - 2, w * 0.9, 2.5); continue; }
        c.beginPath(); c.ellipse(x, y - 2, Math.max(2.5, w * 0.3), Math.max(2, w * 0.2), 0, 0, TAU); c.fill(); c.stroke();
      }
      if (LIGHTS.has(p.name)) { c.fillStyle = '#ffcf6a'; c.beginPath(); c.arc(x, y - 2, 2.2, 0, TAU); c.fill(); }
    }
    for (const p of props) {
      const col = ROOF[p.name] || (FP[p.name] || {}).roof;
      if (!col) continue;
      const s = NC.SPR[p.name];
      if (!s) continue;
      const w = (s.w * p.scale * 0.72) / ART, h = Math.max(4, (s.h * p.scale * 0.34) / ART), x = p.x / ART - w / 2, y = p.y / ART - h;
      c.fillStyle = 'rgba(30,24,40,0.35)'; c.fillRect(x + 2, y + 2, w, h);
      c.fillStyle = col; c.fillRect(x, y, w, h);
      c.fillStyle = shade(col, 0.72); c.fillRect(x, y + h / 2, w, h / 2);
      c.strokeStyle = 'rgba(42,36,53,0.8)'; c.lineWidth = 1.2; c.strokeRect(x, y, w, h);
    }
    for (const p of props) {
      const col = CROWN[p.name] || (FP[p.name] || {}).crown;
      if (!col) continue;
      const s = NC.SPR[p.name];
      if (!s) continue;
      const r = Math.max(4, (s.w * p.scale * 0.26) / ART), x = p.x / ART, y = (p.y - s.h * p.scale * 0.3) / ART;
      c.fillStyle = 'rgba(30,24,40,0.3)'; c.beginPath(); c.arc(x + 2, y + 3, r, 0, TAU); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.fillStyle = shade(col, 1.18); c.beginPath(); c.arc(x - r * 0.3, y - r * 0.32, r * 0.5, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(42,36,53,0.7)'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
    }
    return (world.mapArt = cv);
  }

  // ---------------- fog: cells the hero has seen; drawn blurred so its edge is soft ----------------
  function fogOf(world) {
    if (world.fogArt) return world.fogArt;
    const w = Math.ceil(world.W / FOG), h = Math.ceil(world.H / FOG), cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d'), img = c.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { img.data[i * 4] = 22; img.data[i * 4 + 1] = 19; img.data[i * 4 + 2] = 34; img.data[i * 4 + 3] = 255; }
    return (world.fogArt = { w, h, cv, c, img, seen: new Uint8Array(w * h), dirty: true });
  }
  function reveal(world, x, y) {
    const F = fogOf(world), R = 6, cx = Math.floor(x / FOG), cy = Math.floor(y / FOG);
    // Exploration runs independently of the 10 Hz canvas paint. The revealed
    // circle depends on the cell only, so repeated positions need no rescan.
    if (NC.HUD.cadenceEnabled && F.lastX === cx && F.lastY === cy) return;
    F.lastX = cx; F.lastY = cy;
    for (let j = -R; j <= R; j++)
      for (let i = -R; i <= R; i++) {
        if (i * i + j * j > R * R) continue;
        const gx = cx + i, gy = cy + j;
        if (gx < 0 || gy < 0 || gx >= F.w || gy >= F.h) continue;
        const k = gy * F.w + gx;
        if (!F.seen[k]) { F.seen[k] = 1; F.img.data[k * 4 + 3] = 0; F.dirty = true; }
      }
  }

  // ---------------- markers ----------------
  let head = null, headKey = '';
  function heroHead(game) {
    const SP = NC.Sprites, miss = SP && SP.equipMissing && SP.equipMissing(game.player.equip); // (gear art still streaming in, js/assets.js: redrawn as it comes)
    const key = JSON.stringify(game.player.equip) + (miss ? '#' + SP.ver : '');
    if (head && key === headKey) return head;
    head = head || document.createElement('canvas');
    head.width = head.height = 96; headKey = key;
    const c = head.getContext('2d');
    c.clearRect(0, 0, 96, 96);
    c.save();
    c.beginPath(); c.arc(48, 48, 44, 0, TAU); c.clip();
    c.fillStyle = '#f3e7cf'; c.fillRect(0, 0, 96, 96);
    const hs = NC.headSpot(game.player.equip), k = 74 / hs.w;
    NC.drawAvatar(c, game.player.equip, 48 - hs.x * k, 56 - hs.y * k, k, 1, { noWeapon: true });
    c.restore();
    return head;
  }
  function crown(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(-s, s * 0.55); ctx.lineTo(-s, -s * 0.35); ctx.lineTo(-s * 0.5, s * 0.05); ctx.lineTo(0, -s * 0.7);
    ctx.lineTo(s * 0.5, s * 0.05); ctx.lineTo(s, -s * 0.35); ctx.lineTo(s, s * 0.55); ctx.closePath();
    ctx.fillStyle = '#ffd35a'; ctx.fill();
    ctx.lineWidth = Math.max(1.5, s * 0.28); ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
    ctx.restore();
  }
  function warpMark(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = NC.OUTLINE; ctx.beginPath(); ctx.arc(0, 0, s * 1.15, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
    g.addColorStop(0, '#fffbe0'); g.addColorStop(0.5, '#8fe3ff'); g.addColorStop(1, '#3a7fd0');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffe28a'; ctx.lineWidth = Math.max(1.2, s * 0.22);
    ctx.beginPath(); ctx.arc(0, 0, s * 0.62, t * 3, t * 3 + Math.PI * 1.3); ctx.stroke();
    ctx.restore();
  }
  function label(ctx, text, x, y, size, fill) {
    ctx.save();
    ctx.font = `600 ${size}px Mitr, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.28; ctx.strokeStyle = NC.OUTLINE; ctx.strokeText(text, x, y);
    ctx.fillStyle = fill; ctx.fillText(text, x, y);
    ctx.restore();
  }

  // ---------------- the map (minimap: round, around the hero; big map: the whole map) ----------------
  function drawMap(ctx, w, h, game, span) {
    if (!NC.HUD.shouldDrawVisual(ctx.canvas, game, span)) return;
    const p = game.player, world = game.world, round = ctx.canvas.id === 'minimap';
    const art = artOf(world), F = fogOf(world), t = game.time;
    if (!round) span = Math.max(world.W, (world.H * w) / h) * 1.04; // the big map shows all of it
    const k = w / span, vh = (span * h) / w;
    const x0 = round ? clamp(p.x - span / 2, 0, Math.max(0, world.W - span)) : (world.W - span) / 2;
    const y0 = round ? clamp(p.y - vh / 2, 0, Math.max(0, world.H - vh)) : (world.H - vh) / 2;
    const X = (x) => (x - x0) * k, Y = (y) => (y - y0) * k;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (round) { ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, TAU); ctx.clip(); }
    ctx.fillStyle = '#16131f'; ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    // the art, cut to the world (the big map can be wider than the world)
    const sx = Math.max(0, x0), sy = Math.max(0, y0), ex = Math.min(world.W, x0 + span), ey = Math.min(world.H, y0 + vh);
    ctx.drawImage(art, sx / ART, sy / ART, (ex - sx) / ART, (ey - sy) / ART, X(sx), Y(sy), (ex - sx) * k, (ey - sy) * k);
    if (F.dirty) { F.c.putImageData(F.img, 0, 0); F.dirty = false; }
    ctx.drawImage(F.cv, sx / FOG, sy / FOG, (ex - sx) / FOG, (ey - sy) / FOG, X(sx), Y(sy), (ex - sx) * k, (ey - sy) * k);
    const s = Math.max(3, w * (round ? 0.022 : 0.009)); // marker size
    const seen = (x, y) => { const gx = Math.floor(x / FOG), gy = Math.floor(y / FOG); return gx >= 0 && gy >= 0 && gx < F.w && gy < F.h && F.seen[gy * F.w + gx]; };
    // warps
    for (const pt of game.portals) {
      if (!seen(pt.x, pt.y)) continue;
      warpMark(ctx, X(pt.x), Y(pt.y), s * 1.3, t);
      if (!round && pt.name) label(ctx, pt.name, X(pt.x), Y(pt.y) - s * 3.2, Math.max(12, w * 0.016), '#fff4d8');
    }
    // monsters (bosses with a crown), then the party, then the hero
    for (const e of game.enemies) {
      if (e.dead || e.dummy || !seen(e.x, e.y)) continue;
      const ex = X(e.x), ey = Y(e.y);
      if (ex < -10 || ey < -10 || ex > w + 10 || ey > h + 10) continue;
      if (NC.BOSSES && NC.BOSSES[e.type]) {
        ctx.strokeStyle = `rgba(255,120,120,${0.5 + 0.4 * Math.sin(t * 5)})`; ctx.lineWidth = Math.max(1.5, s * 0.35);
        ctx.beginPath(); ctx.arc(ex, ey, s * 2.4, 0, TAU); ctx.stroke();
        crown(ctx, ex, ey, s * 1.5);
        if (!round) label(ctx, e.name, ex, ey + s * 3.4, Math.max(12, w * 0.015), '#ffd0d0');
      } else {
        ctx.fillStyle = NC.OUTLINE; ctx.beginPath(); ctx.arc(ex, ey, s * 0.78, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff5f6d'; ctx.beginPath(); ctx.arc(ex, ey, s * 0.55, 0, TAU); ctx.fill();
      }
    }
    for (const b of (NC.Bots && NC.Bots.list) || []) { // other adventurers: small white dots
      if (b.leaving !== undefined || !seen(b.x, b.y)) continue;
      const bx = X(b.x), by = Y(b.y);
      ctx.fillStyle = NC.OUTLINE; ctx.beginPath(); ctx.arc(bx, by, s * 0.82, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f4f1ea'; ctx.beginPath(); ctx.arc(bx, by, s * 0.56, 0, TAU); ctx.fill();
      if (!round) label(ctx, b.name, bx, by - s * 2, Math.max(10, w * 0.011), '#f4f1ea');
    }
    for (const a of [...((NC.Party && NC.Party.members) || []), ...((NC.Net && NC.Net.onMap && NC.Net.onMap()) || [])]) { // party, other players (net.js)
      const ax = X(a.x), ay = Y(a.y);
      ctx.fillStyle = NC.OUTLINE; ctx.beginPath(); ctx.arc(ax, ay, s * 1.05, 0, TAU); ctx.fill();
      ctx.fillStyle = a.dead > 0 ? '#8a8699' : a.def.color; ctx.beginPath(); ctx.arc(ax, ay, s * 0.78, 0, TAU); ctx.fill();
      if (!round) label(ctx, a.name, ax, ay - s * 2.2, Math.max(11, w * 0.013), a.def.color);
    }
    const px = X(p.x), py = Y(p.y), hs = Math.max(20, w * (round ? 0.2 : 0.045));
    // which way the hero looks: a little golden arrow
    const aa = p.aim || 0, ar = hs * 0.62;
    ctx.save(); ctx.translate(px, py); ctx.rotate(aa);
    ctx.beginPath(); ctx.moveTo(ar + hs * 0.26, 0); ctx.lineTo(ar - hs * 0.02, -hs * 0.17); ctx.lineTo(ar - hs * 0.02, hs * 0.17); ctx.closePath();
    ctx.fillStyle = '#ffd35a'; ctx.fill(); ctx.lineWidth = Math.max(1.5, hs * 0.06); ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
    ctx.restore();
    ctx.drawImage(heroHead(game), px - hs / 2, py - hs / 2, hs, hs);
    ctx.strokeStyle = NC.OUTLINE; ctx.lineWidth = Math.max(2, hs * 0.08);
    ctx.beginPath(); ctx.arc(px, py, hs * 0.46, 0, TAU); ctx.stroke();
    if (round) { // a soft shade under the ring
      const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.36, w / 2, h / 2, w * 0.5);
      g.addColorStop(0, 'rgba(20,16,30,0)'); g.addColorStop(1, 'rgba(20,16,30,0.45)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  // ---------------- the sky window ----------------
  const SKY = [ // hour, top, bottom
    [0, '#0b1236', '#1d2b68'], [4.6, '#101a4a', '#2c3a7c'], [5.6, '#3d3d8a', '#f2928a'], [6.6, '#6b98dc', '#ffcf9e'],
    [8, '#4aa4f2', '#c4e8ff'], [16.4, '#4a9eec', '#cfe9ff'], [17.6, '#5b5cb2', '#ffac6c'], [18.7, '#3a3282', '#e87a70'],
    [19.7, '#151d52', '#2d3672'], [24, '#0b1236', '#1d2b68'],
  ];
  const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mixC = (a, b, u) => a.map((v, i) => Math.round(lerp(v, b[i], u)));
  function skyAt(hr) {
    for (let i = 0; i < SKY.length - 1; i++) {
      const [h0, t0, b0] = SKY[i], [h1, t1, b1] = SKY[i + 1];
      if (hr >= h0 && hr <= h1) { const u = (hr - h0) / (h1 - h0); return [mixC(rgbOf(t0), rgbOf(t1), u), mixC(rgbOf(b0), rgbOf(b1), u)]; }
    }
    return [rgbOf(SKY[0][1]), rgbOf(SKY[0][2])];
  }
  const nightOf = (hr) => (hr < 5 || hr >= 19.5 ? 1 : hr < 7 ? (7 - hr) / 2 : hr >= 17.5 ? (hr - 17.5) / 2 : 0);
  const img = (src) => { const i = new Image(); i.src = src; return i; };
  const SUN = img('assets/ui/sky_sun.png'), MOON = img('assets/ui/sky_moon.png');
  const STARS = Array.from({ length: 22 }, (_, i) => [NC.hash(i, 1, 71), NC.hash(i, 2, 71) * 0.62, 0.5 + NC.hash(i, 3, 71), NC.hash(i, 4, 71) * 9]);

  function drawSky(game) {
    const cv = $('dial');
    if (!cv) return;
    if (!NC.HUD.shouldDrawVisual(cv, game)) return;
    const c = cv.getContext('2d'), w = cv.width, h = cv.height, t = game.time;
    const hr = (((game.minutes / 60) % 24) + 24) % 24, n = nightOf(hr), [top, bot] = skyAt(hr);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w, h);
    c.save();
    c.beginPath(); c.arc(w / 2, h / 2, w / 2, 0, TAU); c.clip();
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgb(${top})`); g.addColorStop(1, `rgb(${bot})`);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // stars
    if (n > 0.05)
      for (const [sx, sy, sz, ph] of STARS) {
        c.globalAlpha = n * (0.55 + 0.45 * Math.sin(t * 2.2 + ph));
        c.fillStyle = '#fff8dc';
        c.beginPath(); c.arc(sx * w, sy * h, w * 0.012 * sz, 0, TAU); c.fill();
      }
    c.globalAlpha = 1;
    const horizon = h * 0.74;
    // the sun by day, the moon by night, along an arc from the left hill to the right one
    const body = (im, u, size) => {
      if (u < -0.05 || u > 1.05 || !im.complete) return;
      const x = w * (0.1 + 0.8 * u), y = horizon + h * 0.06 - Math.sin(Math.PI * clamp(u, 0, 1)) * h * 0.5;
      const glow = c.createRadialGradient(x, y, 0, x, y, size * 0.9);
      glow.addColorStop(0, im === SUN ? 'rgba(255,236,160,0.7)' : 'rgba(220,230,255,0.45)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = glow; c.beginPath(); c.arc(x, y, size * 0.9, 0, TAU); c.fill();
      const k = size / Math.max(im.width, im.height);
      c.drawImage(im, x - (im.width * k) / 2, y - (im.height * k) / 2, im.width * k, im.height * k);
    };
    body(SUN, (hr - 5.4) / 13.2, w * 0.36);
    body(MOON, (((hr - 18.3) % 24) + 24) % 24 / 11.4, w * 0.34);
    // clouds by day
    if (n < 0.9) {
      c.globalAlpha = 0.9 * (1 - n);
      c.fillStyle = '#ffffff';
      for (const [bx, by, bs, v] of [[0.2, 0.3, 1, 0.012], [0.7, 0.2, 0.8, 0.018]]) {
        const x = ((bx + t * v) % 1.4) * w - w * 0.2, y = by * h, r = w * 0.07 * bs;
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.arc(x + r, y - r * 0.4, r * 1.2, 0, TAU); c.arc(x + r * 2.1, y, r * 0.9, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
    }
    // hills, with a tiny camp: a tent and its fire
    const hill = (cx, cy, rx, ry, day, night) => {
      c.fillStyle = `rgb(${mixC(rgbOf(day), rgbOf(night), n)})`;
      c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, Math.PI, TAU); c.lineTo(cx + rx, h); c.lineTo(cx - rx, h); c.fill();
      c.strokeStyle = NC.OUTLINE; c.lineWidth = Math.max(1.5, w * 0.018);
      c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, Math.PI, TAU); c.stroke();
    };
    hill(w * 0.22, horizon + h * 0.1, w * 0.46, h * 0.2, '#7cc26a', '#1f3252');
    hill(w * 0.82, horizon + h * 0.14, w * 0.5, h * 0.2, '#5fae5c', '#182a46');
    const tx = w * 0.58, ty = horizon + h * 0.04;
    c.fillStyle = `rgb(${mixC([222, 150, 96], [104, 70, 92], n)})`;
    c.beginPath(); c.moveTo(tx - w * 0.075, ty + h * 0.035); c.lineTo(tx, ty - h * 0.08); c.lineTo(tx + w * 0.075, ty + h * 0.035); c.closePath(); c.fill();
    c.lineWidth = Math.max(1.2, w * 0.014); c.strokeStyle = NC.OUTLINE; c.stroke();
    // its door: dark by day, lit from inside at night
    c.fillStyle = n > 0.5 ? `rgba(255,196,110,${0.6 + 0.3 * Math.sin(t * 3)})` : 'rgba(42,36,53,0.85)';
    c.beginPath(); c.moveTo(tx - w * 0.026, ty + h * 0.035); c.lineTo(tx, ty - h * 0.03); c.lineTo(tx + w * 0.026, ty + h * 0.035); c.closePath(); c.fill();
    const fx = tx + w * 0.13, fy = ty + h * 0.02, fr = w * (0.05 + 0.01 * Math.sin(t * 9));
    const fg = c.createRadialGradient(fx, fy, 0, fx, fy, fr * (1.5 + 2.5 * n));
    fg.addColorStop(0, 'rgba(255,220,120,0.95)'); fg.addColorStop(0.35, 'rgba(255,140,60,0.6)'); fg.addColorStop(1, 'rgba(255,120,50,0)');
    c.fillStyle = fg; c.beginPath(); c.arc(fx, fy, fr * (1.5 + 2.5 * n), 0, TAU); c.fill();
    c.restore();
  }

  // the world's light at dawn and dusk (game.js lighting): the night blue, warmed while the sun is low
  NC.skyAmbient = function (minutes, n) {
    const hr = (((minutes / 60) % 24) + 24) % 24;
    const night = [172, 186, 232], warm = hr > 12 ? [255, 164, 108] : [255, 184, 196];
    const base = [lerp(255, night[0], n), lerp(255, night[1], n), lerp(255, night[2], n)];
    const k = Math.sin(Math.PI * clamp(n, 0, 1)) * (hr > 12 ? 0.6 : 0.45);
    return base.map((v, i) => Math.round(lerp(v, warm[i], k)));
  };

  // ---------------- hooks into the HUD ----------------
  const H = NC.HUD;
  const baseInit = H.init.bind(H), baseReveal = H.reveal.bind(H);
  H.init = function (game) {
    baseInit(game);
    const mm = document.querySelector('.minimap'), dial = document.querySelector('.dial');
    if (mm && !mm.querySelector('.mm-ring')) mm.insertAdjacentHTML('beforeend', '<img class="mm-ring" src="assets/ui/mm_frame.png" alt="">');
    if (dial && !dial.querySelector('.sky-ring')) $('dial').insertAdjacentHTML('afterend', '<img class="sky-ring" src="assets/ui/sky_frame.png" alt="">');
    document.querySelector('.tr') && document.querySelector('.tr').classList.add('tr2');
    H.resize();
  };
  H.reveal = function (x, y) {
    baseReveal(x, y);
    if (NC.game && NC.game.world) reveal(NC.game.world, x, y);
  };
  H.drawMap = drawMap;
  H.drawDial = drawSky;
  NC.minimapArt = artOf;
})();
