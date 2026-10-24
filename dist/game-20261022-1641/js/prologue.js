/* prologue.js — the story film that plays after "เริ่มเกม" on the title (js/intro.js lends it its WebGL2 screen: the
   sprite batch, bloom and grade). ~65 s, Thai narration in captions, then straight into the game:
     1. the world: Aurelion over the City of Bells, the silent bell, Nocturne drags the star down, it shatters in seven,
        the shards go to six who stood behind him;
     2. the six generals, cut like an anime opening's character intros: a close-up on the glowing eyes, a whip-pull
        out to their power in their own colour, their name card (pictures assets/prologue/pro_*.jpg), then Nocturne;
     3. the world since: three hours of sun, the Hollowing, the refugees, the fire that never dies, someone walking
        out of the dark ... "คือคุณ": a push into the fire in their eye, a flash, and the game fades in.
   The story panels are the game-style story art (assets/prologue/c3_*.jpg, from the story video v3).
   Plays once per device (localStorage nightcamp.prologue.seen); ?intro=1 or ?prologue=1 always plays it,
   ?prologue=0 never. A click or a key = the next shot; Esc or "ข้าม" = straight into the game.
   Load right after js/intro.js (it needs nothing from NC). */
(function () {
  'use strict';
  const SEEN = 'nightcamp.prologue.seen', DIR = 'assets/prologue/';
  const EXT = () => window.NCPrologueExt || {}; // shots drawn by other files ({ ext: name } in SHOTS)

  function wanted() {
    try { return !localStorage.getItem(SEEN); } catch (e) { return true; }
  }

  // ---------------- the film ----------------
  // a story panel: pic, seconds, zoom from -> to, centre from -> to (fractions of the picture), caption, effect
  const S = (pic, dur, z0, z1, c0, c1, cap, fx, o) => Object.assign({ pic, dur, z0, z1, c0, c1, cap, fx }, o || {});
  // the generals: picture, name, title, English, colour, the side their name card goes on, where the eyes are
  const GEN = [
    { id: 'ivy', name: 'ไอวี่', title: 'ผู้ขโมยไฟ', en: 'IVY · THE FIRE THIEF', col: [0.78, 0.52, 1], card: 'L', eye: [0.7, 0.375], fx: 'violet' },
    { id: 'morrow', name: 'หมอมอร์โรว์', title: 'หมอผีแห่งโรคระบาด', en: 'DOCTOR MORROW · THE PLAGUE SHAMAN', col: [0.62, 1, 0.42], card: 'R', eye: [0.325, 0.33], fx: 'plague' },
    { id: 'raven', name: 'ไรเวน', title: 'พี่ชายในเงา', en: 'RAVEN · THE BROTHER IN THE SHADOW', col: [0.68, 0.5, 0.98], card: 'L', eye: [0.72, 0.33], fx: 'shadow' },
    { id: 'ignis', name: 'อิกนิส', title: 'ผู้ป้อนไฟ', en: 'IGNIS · THE FIRE FEEDER', col: [1, 0.55, 0.2], card: 'R', eye: [0.27, 0.44], fx: 'fire' },
    { id: 'gareth', name: 'กาเรธ', title: 'คำสาบานที่แตก', en: 'GARETH · THE BROKEN OATH', col: [1, 0.86, 0.48], card: 'L', eye: [0.7, 0.405], fx: 'holy' },
    { id: 'gorm', name: 'กอร์ม', title: 'ราชาเขาอสูร', en: 'GORM · THE HORNED KING', col: [0.95, 0.68, 0.38], card: 'R', eye: [0.31, 0.37], fx: 'earth' },
    { id: 'nocturne', name: 'อาร์ชบิชอปโนคเทิร์น', title: 'ชายผู้ดับตะวัน', en: 'ARCHBISHOP NOCTURNE · THE MAN WHO KILLED THE DAWN', col: [0.7, 0.62, 1], card: 'B', eye: [0.5, 0.365], fx: 'void', dur: 3.7 },
  ];
  const SHOTS = [
    // 0. three hundred years before: the Black Knight (the hero, though no one says so) charges the Dark Tree, and is
    //    never seen again (the user: "พระเอกในสามร้อยปีที่แล้วเคยเป็นขุนพลอัศวินเกราะดำ ... ดาบแดงดำ"); hard anime cuts
    { title: 'สามร้อยปีก่อน', dur: 2.2 },
    S('k_wide', 4.0, 1.0, 1.08, [0.5, 0.55], [0.5, 0.42], 'ครั้งหนึ่ง เคยมีขุนพลอัศวินในชุดเกราะดำ ผู้เดินไปท้าทายต้นไม้แห่งความมืดเพียงลำพัง', 'snow'),
    S('k_helm', 1.9, 1.04, 1.14, [0.5, 0.5], [0.5, 0.48], '', 'helm', { cut: true, star: [0.62, 0.38] }),
    S('k_sword', 1.7, 1.0, 1.1, [0.5, 0.5], [0.5, 0.5], '', 'bolts', { cut: true }),
    // the red power gathered in a black-and-white manga panel (js/prologue_manga.js; the user: "ฉากขาวดำแบบนี้เลย")
    { ext: 'manga', dur: 4.5 },
    S('k_charge', 1.4, 1.0, 1.12, [0.5, 0.5], [0.56, 0.5], '', 'rush', { cut: true }),
    S('k_strike', 1.7, 1.08, 1.0, [0.5, 0.5], [0.5, 0.5], '', 'kstrike', { cut: true }),
    // (an animated version of the cut was tried and the user kept the drawing above: "เอาเป็นฉากแบบเดิมดีกว่า". It is
    //  still here, unused: put { anim: 'kslash', bg: 'k_bg', dur: 3.4, cut: true } in place of the line above)
    S('k_after', 4.6, 1.06, 1.0, [0.5, 0.5], [0.5, 0.55], 'แต่ไม่มีใครรู้ว่า... อัศวินดำหายไปไหน', 'after', { cut: true, star: [0.37, 0.78] }),
    { title: 'สามร้อยปีต่อมา', dur: 2.4 },
    S('c3_bell', 5.2, 1.0, 1.1, [0.5, 0.5], [0.5, 0.4], 'ตลอดสามร้อยปีนั้น ไม่เคยมีเช้าไหนที่ดาว "ออเรเลียน" ไม่ขึ้นเหนือเมืองหอระฆัง', 'stars', { star: [0.46, 0.24] }),
    S('c3_silent', 3.8, 1.0, 1.12, [0.5, 0.6], [0.5, 0.45], 'จนเช้าวันหนึ่ง... ระฆังไม่ดัง', 'dust'),
    S('c3_pull', 4.8, 1.12, 1.0, [0.5, 0.3], [0.5, 0.5], 'คืนนั้น อาร์ชบิชอปโนคเทิร์นดึงดาวลงมาจากฟ้า แล้วทุบมันด้วยมือตัวเอง', 'goldrise', { star: [0.5, 0.35] }),
    S('c3_shatter', 3.4, 1.0, 1.16, [0.5, 0.45], [0.5, 0.42], 'ดาวแตกเป็นเจ็ดเสี่ยง', 'shatter', { star: [0.5, 0.28] }),
    S('c3_shard', 4.6, 1.0, 1.12, [0.5, 0.5], [0.5, 0.45], 'เสี่ยงหนึ่งฝังอยู่ในอกของเขา อีกหกเสี่ยง เขามอบให้คนหกคนที่ยืนอยู่ข้างหลัง', 'shard', { star: [0.5, 0.55] }),
    S('c3_generals', 3.6, 1.12, 1.0, [0.5, 0.5], [0.5, 0.5], 'หกขุนพลแห่งดาวแตก... ทุกคนมีเหตุผลที่ยอมยืนข้างชายผู้ดับตะวัน', 'storm'),
    ...GEN.map((g) => ({ gen: g, dur: g.dur || 2.9 })),
    S('c3_shortday', 4.6, 1.0, 1.08, [0.45, 0.5], [0.58, 0.5], 'นับจากวันนั้น ตะวันขึ้นตอนสี่โมง และตกตอนบ่ายโมง... สามชั่วโมง คือทั้งหมดที่โลกนี้เหลืออยู่', 'sunset', { star: [0.52, 0.36] }),
    S('c3_city', 4.6, 1.0, 1.1, [0.5, 0.5], [0.5, 0.6], 'ความมืดกลืนผู้คนทีละน้อย สีจาง ความทรงจำหาย จนเมืองหอระฆังกลวงไปทั้งเมือง', 'hollow'),
    S('c3_refugees', 4.4, 1.0, 1.12, [0.5, 0.55], [0.52, 0.45], 'คนที่หนีรอดมาได้ เดินตามแสงสีส้มแสงเดียวที่ยังเหลืออยู่กลางป่า', 'embers', { star: [0.62, 0.42] }),
    S('c3_keeper', 4.2, 1.12, 1.0, [0.5, 0.5], [0.5, 0.5], 'กองไฟที่ไม่เคยมอด... ค่ายสุดท้ายของผู้รอดชีวิต', 'embers', { star: [0.6, 0.62] }),
    S('c3_emerge', 4.6, 1.0, 1.12, [0.5, 0.5], [0.5, 0.45], 'แล้วคืนหนึ่ง มีคนเดินออกมาจากความมืด ไม่มีชื่อ ไม่มีอดีต', 'flies'),
    S('c3_eyes', 4.4, 1.0, 1.1, [0.5, 0.5], [0.42, 0.55], 'คนคนนั้น... คือคุณ', 'eye', { star: [0.36, 0.58], last: true }),
  ];
  let total = 0;
  for (const s of SHOTS) { s.t0 = total; total += s.dur; }

  // ---------------- the pictures (loaded early, only if the film will play) ----------------
  const PICS = {};
  const files = [...new Set(SHOTS.filter((s) => s.pic).map((s) => s.pic))].map((p) => [p, p + '.jpg'])
    .concat(...GEN.map((g) => ['', '_a', '_b'].map((k) => ['pro_' + g.id + k, 'pro_' + g.id + k + '.jpg'])))
    // (the animated cut's pictures only when a shot uses it)
    .concat(SHOTS.some((s) => s.anim) ? [['k_bg', 'k_bg.jpg']].concat([1, 2, 3, 4].map((i) => ['kpose' + i, 'kpose_' + i + '.png']),
      ...['kslash', 'kshock', 'kbolt', 'kburst'].map((f) => [['fx_' + f, 'fx/' + f + '.webp'], ['fx_' + f + '_g', 'fx/' + f + '_glow.webp']])) : [])
    // (the shots drawn by other files, window.NCPrologueExt, e.g. js/prologue_manga.js: their own pictures)
    .concat(...SHOTS.filter((s) => s.ext && EXT()[s.ext]).map((s) => EXT()[s.ext].files || []));
  // the effect sheets' frames (tools/knight_fx.py writes the same into fx/meta.json)
  const FXM = { kslash: { w: 1024, h: 760, cols: 4, n: 14 }, kshock: { w: 768, h: 768, cols: 4, n: 10 }, kbolt: { w: 512, h: 512, cols: 4, n: 8 }, kburst: { w: 640, h: 640, cols: 4, n: 8 } };
  let loading = null;
  function preload() {
    if (loading) return loading;
    loading = Promise.all(files.map(([k, f]) => new Promise((ok) => {
      const im = new Image();
      im.onload = () => { PICS[k] = im; ok(); };
      im.onerror = () => { console.warn('prologue: no ' + f); ok(); };
      im.src = DIR + f;
    })));
    return loading;
  }
  // after the title's own pictures; only when the title film is up (a page with switches, e.g. the online player's
  // ?online&nointro, never shows the film: its 14 MB of pictures are not fetched there; begin() still loads them)
  if (wanted() && document.getElementById('intro')) setTimeout(preload, 1500);

  // ---------------- begin: called by intro.js when "เริ่มเกม" is pressed ----------------
  function begin(K, done) {
    preload();
    const TEX = {};
    const tex = (k) => TEX[k] || (PICS[k] && (TEX[k] = K.texFrom(PICS[k])));
    // the captions and the name cards (HTML over the canvas: crisp Thai text)
    const ui = document.createElement('div');
    ui.className = 'pr-ui';
    ui.innerHTML = '<div class="pr-cap"></div><div class="pr-title"></div><div class="pr-card"><b></b><i></i><em></em></div><div class="pr-hint">คลิก = ฉากต่อไป · Esc = ข้ามเข้าเกม</div>';
    K.root.appendChild(ui);
    const capEl = ui.querySelector('.pr-cap'), card = ui.querySelector('.pr-card'), titleEl = ui.querySelector('.pr-title');
    const cardB = card.querySelector('b'), cardI = card.querySelector('i'), cardE = card.querySelector('em');
    let t = 0, ended = false, out = 0, lastI = -1;
    // textures drawn in code: a magic circle for Ivy / Nocturne, a feather for Raven
    const SIGIL = K.canvasTex(256, 256, (g, w) => {
      g.translate(w / 2, w / 2); g.strokeStyle = '#fff'; g.lineWidth = 3;
      for (const r of [118, 100, 60]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
      g.lineWidth = 2; g.beginPath();
      for (let i = 0; i <= 7; i++) { const a = (i * 4 * Math.PI) / 7 - Math.PI / 2; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 100, Math.sin(a) * 100); }
      g.stroke();
      for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 104, Math.sin(a) * 104); g.lineTo(Math.cos(a) * (i % 3 ? 112 : 116), Math.sin(a) * (i % 3 ? 112 : 116)); g.stroke(); }
    });
    const FEATHER = K.canvasTex(64, 128, (g) => {
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 4); g.quadraticCurveTo(58, 60, 34, 124); g.lineTo(30, 124); g.quadraticCurveTo(6, 60, 32, 4); g.fill();
    });

    // ---------- the screen in "screen units": x from -aspect to aspect, y from -1 (bottom) to 1 ----------
    const A = () => K.aspect;
    function sq(tx, x, y, r, col, add) { // a square sprite
      const a = A();
      K.quad(tx.t, add !== false, [[(x - r) / a, y + r], [(x + r) / a, y + r], [(x + r) / a, y - r], [(x - r) / a, y - r]], [0, 0, 1, 1], col);
    }
    function rot(tx, x, y, rw, rh, ang, col, add) { // a rotated rectangle sprite
      const a = A(), c = Math.cos(ang), s = Math.sin(ang);
      const P = [[-rw, rh], [rw, rh], [rw, -rh], [-rw, -rh]].map(([px, py]) => [(x + px * c - py * s) / a, y + px * s + py * c]);
      K.quad(tx.t, add !== false, P, [0, 0, 1, 1], col);
    }
    function line(tx, x0, y0, x1, y1, w, col, add) { // a soft line from one point to another
      const a = A(), dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1e-4, nx = (-dy / l) * w, ny = (dx / l) * w;
      K.quad(tx.t, add !== false, [[(x0 + nx) / a, y0 + ny], [(x1 + nx) / a, y1 + ny], [(x1 - nx) / a, y1 - ny], [(x0 - nx) / a, y0 - ny]], [0, 0, 1, 1], col);
    }
    function bolt(x0, y0, x1, y1, seed, w, col) { // a jagged lightning bolt (and its glow)
      let s = seed;
      const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const n = 9, pts = [[x0, y0]], dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
      for (let i = 1; i < n; i++) { const k = i / n, o = (r() - 0.5) * l * 0.22; pts.push([x0 + dx * k + nx * o, y0 + dy * k + ny * o]); }
      pts.push([x1, y1]);
      for (let i = 0; i < n; i++) {
        line(K.TX.glow, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w * 5, [col[0], col[1], col[2], col[3] * 0.35]);
        line(K.TX.white, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, [1, 1, 1, col[3]]);
      }
    }

    // ---------- the picture on screen: covers it, zoomed and panned; where a point of it lands ----------
    let win = [0, 0, 1, 1];
    function picture(tx, z, cx, cy, alpha, sx, sy) {
      if (window.NC?.ScreenShake && !window.NC.ScreenShake.enabled()) { sx = 0; sy = 0; }
      const ia = tx.w / tx.h, sa = A();
      let ww, wh;
      if (sa > ia) { ww = 1 / z; wh = ia / sa / z; } else { wh = 1 / z; ww = sa / ia / z; }
      const u0 = K.clamp(cx - ww / 2 + (sx || 0), 0, 1 - ww), v0 = K.clamp(cy - wh / 2 + (sy || 0), 0, 1 - wh);
      win = [u0, v0, ww, wh];
      K.screen(tx, -1, -1, 1, 1, [1, 1, 1, alpha], { uv: [u0, v0, u0 + ww, v0 + wh] });
    }
    const at = (u, v) => [((u - win[0]) / win[2] * 2 - 1) * A(), 1 - (v - win[1]) / win[3] * 2]; // picture -> screen units

    // ---------- particles in screen units ----------
    const parts = [];
    let seed = 99;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    function emit(p) { if (parts.length < 800) parts.push(Object.assign({ t: 0, ax: 0, ay: 0, a: 1, add: true, tx: K.TX.dot, spin: 0, ang: 0 }, p)); }
    function stepParts(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt; if (p.t > p.life) { parts.splice(i, 1); continue; }
        p.vx += p.ax * dt; p.vy += p.ay * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.ang += p.spin * dt;
        if (p.wob) p.x += Math.sin(p.t * 3 + p.ph) * p.wob * dt;
      }
    }
    function drawParts() {
      for (const p of parts) {
        let a = p.a * Math.min(1, p.t * 6) * Math.min(1, (p.life - p.t) * 2.5);
        if (p.tw) a *= 0.5 + 0.5 * Math.sin(p.t * 9 + p.ph);
        const col = [p.c[0], p.c[1], p.c[2], a];
        if (p.streak) line(p.tx, p.x - p.vx * p.streak, p.y - p.vy * p.streak, p.x, p.y, p.s, col, p.add);
        else if (p.rw) rot(p.tx, p.x, p.y, p.rw, p.rh, p.ang, col, p.add);
        else sq(p.tx, p.x, p.y, p.s, col, p.add);
      }
    }
    function speedLines(dt, rate, col) { // anime focus lines rushing in from the edges
      for (let i = 0; i < 3; i++) if (rnd() < dt * rate) {
        const ang = rnd() * Math.PI * 2, r0 = 1.9, v = 9 + rnd() * 5;
        emit({ x: Math.cos(ang) * r0 * A(), y: Math.sin(ang) * r0, vx: -Math.cos(ang) * v, vy: -Math.sin(ang) * v, life: 0.13, s: 0.004 + rnd() * 0.006, streak: 0.06, tx: K.TX.white, c: col, a: 0.55 });
      }
    }
    // what a shot drawn by another file gets to draw with (see js/prologue_manga.js)
    const api = { K, tex, picture, at, sq, rot, line, emit, rnd, A, speedLines };

    // ---------- each effect: what it emits and what it draws, given the shot's local time u (seconds) ----------
    function effect(sh, u, dt, k) {
      const fx = sh.fx, st = sh.star ? at(sh.star[0], sh.star[1]) : [0, 0];
      if (fx === 'stars') {
        if (rnd() < dt * 26) emit({ x: (rnd() * 2 - 1) * A(), y: 0.15 + rnd() * 0.85, vx: 0, vy: 0, life: 1.4 + rnd(), s: 0.006 + rnd() * 0.01, c: [1, 0.95, 0.8], tw: 1, ph: rnd() * 9 });
        sq(K.TX.glow, st[0], st[1], 0.32 + 0.04 * Math.sin(u * 3), [1, 0.85, 0.5, 0.45 * k]);
      } else if (fx === 'dust') {
        if (rnd() < dt * 30) emit({ x: (rnd() * 2 - 1) * A(), y: 1.05, vx: 0.02, vy: -0.08 - rnd() * 0.08, life: 6, s: 0.004 + rnd() * 0.006, c: [0.85, 0.85, 0.95], a: 0.5, wob: 0.04, ph: rnd() * 9 });
      } else if (fx === 'goldrise') {
        if (rnd() < dt * 60) emit({ x: st[0] + (rnd() - 0.5) * 0.5, y: st[1] - 0.6 + rnd() * 0.3, vx: (rnd() - 0.5) * 0.1, vy: 0.3 + rnd() * 0.5, life: 1.6, s: 0.008 + rnd() * 0.01, c: [1, 0.85, 0.45], wob: 0.15, ph: rnd() * 9 });
        sq(K.TX.glow, st[0], st[1], 0.6 + 0.1 * Math.sin(u * 5), [1, 0.85, 0.5, 0.35 * k]);
      } else if (fx === 'shatter') {
        if (u >= 0.3 && u - dt < 0.3) { // the star breaks: seven big shards and a storm of sparks
          for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.3; emit({ x: st[0], y: st[1], vx: Math.cos(a) * 1.4, vy: Math.sin(a) * 1.4, ax: -Math.cos(a) * 0.6, ay: -Math.sin(a) * 0.6, life: 2.6, s: 0.06, c: [1, 0.92, 0.6], streak: 0.12, tx: K.TX.glow }); }
          for (let i = 0; i < 90; i++) { const a = rnd() * Math.PI * 2, v = 0.5 + rnd() * 2; emit({ x: st[0], y: st[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: -0.5, life: 0.8 + rnd() * 1.2, s: 0.006 + rnd() * 0.008, c: [1, 0.85, 0.5], streak: 0.05 }); }
        }
        sq(K.TX.glow, st[0], st[1], 0.4 + 1.6 * Math.exp(-4 * Math.max(0, u - 0.3)) * (u > 0.3 ? 1 : 0), [1, 0.9, 0.6, 0.6 * k]);
      } else if (fx === 'shard') {
        if (rnd() < dt * 30) emit({ x: st[0] + (rnd() - 0.5) * 1.6, y: st[1] + (rnd() - 0.5) * 0.8, vx: 0, vy: 0.1 + rnd() * 0.1, life: 2, s: 0.006 + rnd() * 0.008, c: [1, 0.85, 0.5], wob: 0.1, ph: rnd() * 9 });
        sq(K.TX.glow, st[0], st[1], 0.45 + 0.08 * Math.sin(u * 6), [1, 0.82, 0.45, 0.5 * k]);
      } else if (fx === 'storm') {
        for (let i = 0; i < 4; i++) if (rnd() < dt * 60) emit({ x: (rnd() * 2.4 - 1.2) * A(), y: 1.2, vx: -0.35, vy: -2.6, life: 1, s: 0.0025, streak: 0.04, tx: K.TX.white, c: [0.7, 0.75, 0.95], a: 0.35, add: false });
        for (const lt of [0.9, 2.3]) if (u > lt && u < lt + 0.14) bolt(-0.4 * A() + lt * 0.3, 1.1, -0.1 * A() + lt * 0.25, 0.25, 7 + lt * 10, 0.006, [0.8, 0.85, 1, 1]);
      } else if (fx === 'sunset') {
        sq(K.TX.glow, st[0], st[1], 0.5, [1, 0.7, 0.4, 0.45 * k * (1 - K.sm(1.5, 4.4, u))]);
      } else if (fx === 'hollow') {
        if (rnd() < dt * 24) emit({ x: (rnd() * 2 - 1) * A(), y: 1.05, vx: 0.03, vy: -0.1 - rnd() * 0.06, life: 6, s: 0.005 + rnd() * 0.006, c: [0.75, 0.75, 0.78], a: 0.6, wob: 0.06, ph: rnd() * 9, add: false });
      } else if (fx === 'embers') {
        if (rnd() < dt * 40) emit({ x: st[0] + (rnd() - 0.5) * 0.25, y: st[1] + rnd() * 0.05, vx: (rnd() - 0.5) * 0.1, vy: 0.25 + rnd() * 0.35, life: 2 + rnd(), s: 0.005 + rnd() * 0.006, c: [1, 0.55, 0.2], wob: 0.2, ph: rnd() * 9 });
        sq(K.TX.glow, st[0], st[1], 0.3 + 0.03 * Math.sin(u * 11), [1, 0.55, 0.2, 0.3 * k]);
      } else if (fx === 'flies') {
        if (rnd() < dt * 8) emit({ x: (rnd() * 2 - 1) * A(), y: -0.8 + rnd() * 1.2, vx: (rnd() - 0.5) * 0.05, vy: 0.03, life: 3, s: 0.01, c: [0.85, 1, 0.55], tw: 1, ph: rnd() * 9, tx: K.TX.glow });
      } else if (fx === 'snow' || fx === 'helm' || fx === 'after' || fx === 'bolts' || fx === 'rush' || fx === 'kstrike') {
        // snow over every shot of the knight (streaking past in the charge)
        const fast = fx === 'rush' || fx === 'kstrike';
        if (rnd() < dt * (fast ? 70 : 34)) emit({ x: (rnd() * 2.4 - 1.2) * A(), y: 1.1, vx: fast ? -2.6 : -0.06, vy: fast ? -0.4 : -0.16 - rnd() * 0.12, life: fast ? 1 : 7, s: 0.004 + rnd() * 0.007, c: [0.85, 0.9, 1], a: 0.75, wob: fast ? 0 : 0.05, ph: rnd() * 9, streak: fast ? 0.05 : 0 });
        if (fx === 'helm') { // the visor burns red
          sq(K.TX.glow, st[0], st[1], 0.55 + 0.06 * Math.sin(u * 9), [1, 0.1, 0.08, 0.45 * k]);
          if (rnd() < dt * 20) emit({ x: st[0] + (rnd() - 0.5) * 0.9, y: st[1] + (rnd() - 0.5) * 0.6, vx: (rnd() - 0.5) * 0.3, vy: 0.2 + rnd() * 0.3, life: 0.8, s: 0.005, c: [1, 0.2, 0.15], streak: 0.04 });
        }
        if (fx === 'bolts') { // the painting's red lightning flickers (a red glow pulsing over the blade), sparks fly off
          const fl = 0.5 + 0.5 * Math.sin(u * 37) * Math.sin(u * 13);
          sq(K.TX.glow, 0.25 * A(), 0.05, 0.9, [1, 0.1, 0.08, (0.12 + 0.18 * fl) * k]);
          if (rnd() < dt * 60) { const a = rnd() * Math.PI * 2, v = 0.6 + rnd() * 1.4; emit({ x: 0, y: 0, vx: Math.cos(a) * v * A(), vy: Math.sin(a) * v, life: 0.5, s: 0.005, c: [1, 0.2, 0.12], streak: 0.05 }); }
        }
        if (fx === 'rush') { // red sparks torn off behind him, focus lines
          if (rnd() < dt * 80) emit({ x: (rnd() * 0.6 - 0.1) * A(), y: -0.6 + rnd() * 0.5, vx: -2.4 - rnd() * 1.2, vy: (rnd() - 0.5) * 0.3, life: 0.6, s: 0.006, c: [1, 0.18, 0.12], streak: 0.05 });
          speedLines(dt, 50, [1, 0.85, 0.85]);
        }
        if (fx === 'kstrike') { // the slash: a red-black crescent burning across, then everything goes white
          if (u > 0.08 && u < 0.6) { const a = 1 - (u - 0.08) / 0.52; line(K.TX.glow, -1.3 * A(), 0.75, 1.3 * A(), -0.45, 0.09, [1, 0.1, 0.08, 0.9 * a]); line(K.TX.white, -1.3 * A(), 0.75, 1.3 * A(), -0.45, 0.012, [0.02, 0, 0.02, a], false); }
          if (u - dt < 0.08 && u >= 0.08) for (let i = 0; i < 90; i++) { const a = rnd() * Math.PI * 2, v = 0.8 + rnd() * 2.6; emit({ x: 0, y: 0.1, vx: Math.cos(a) * v * A(), vy: Math.sin(a) * v, life: 0.5 + rnd() * 0.7, s: 0.006, c: rnd() < 0.7 ? [1, 0.15, 0.1] : [1, 0.9, 0.9], streak: 0.06 }); }
        }
        if (fx === 'after') { // the last red sparks dying on the abandoned sword
          if (rnd() < dt * 8) emit({ x: st[0] + (rnd() - 0.5) * 0.12, y: st[1] + (rnd() - 0.5) * 0.3, vx: 0, vy: 0.12, life: 1.2, s: 0.006, c: [1, 0.2, 0.12], tw: 1, ph: rnd() * 9 });
          sq(K.TX.glow, st[0], st[1], 0.22 + 0.04 * Math.sin(u * 5), [1, 0.12, 0.1, 0.3 * k * (1 - K.sm(1, 4.4, u) * 0.6)]);
        }
      } else if (fx === 'eye') {
        sq(K.TX.glow, st[0], st[1], 0.16 + 0.03 * Math.sin(u * 13) + 0.02 * Math.sin(u * 29), [1, 0.6, 0.25, 0.55 * k]);
      }
    }

    // ---------- an effect sheet's frame, centred at (x, y) screen units, wd wide (its bloom sheet added on top) ----------
    function fxf(name, f, x, y, wd, alpha, flip) {
      const m = FXM[name], tx = tex('fx_' + name), tg = tex('fx_' + name + '_g');
      if (!tx || f < 0 || f >= m.n) return;
      f = Math.floor(f);
      const rows = Math.ceil(m.n / m.cols), col = f % m.cols, row = Math.floor(f / m.cols);
      const u0 = col / m.cols, v0 = row / rows, u1 = u0 + 1 / m.cols, v1 = v0 + 1 / rows, a = A(), hh = (wd * m.h) / m.w / 2, hw = wd / 2;
      const P = [[(x - hw) / a, y + hh], [(x + hw) / a, y + hh], [(x + hw) / a, y - hh], [(x - hw) / a, y - hh]];
      const uv = flip ? [u1, v0, u0, v1] : [u0, v0, u1, v1];
      K.quad(tx.t, false, P, uv, [1, 1, 1, alpha == null ? 1 : alpha]);
      if (tg) K.quad(tg.t, true, P, uv, [1, 1, 1, (alpha == null ? 1 : alpha) * 0.9]);
    }
    // a drawn pose of the knight: its feet (or its middle) at (x, y), px = the pose's pixel size -> screen units
    function pose(i, x, y, mid, o) {
      const tx = tex('kpose' + i);
      if (!tx) return;
      o = o || {};
      const k = 0.0028 * (o.scale || 1), w = tx.w * k, h = tx.h * k, a = A(), y0 = mid ? y - h / 2 : y;
      const P = [[(x - w / 2) / a, y0 + h], [(x + w / 2) / a, y0 + h], [(x + w / 2) / a, y0], [(x - w / 2) / a, y0]];
      K.quad(tx.t, !!o.add, P, [0, 0, 1, 1], o.col || [1, 1, 1, 1], 0, 0, o.sil || 0);
    }
    // ---------- the knight's leap and cut, animated ----------
    const KA = { A: [0.16, 0.9], B: [0.42, 0.4], C: [0.55, 0.5], D: [0.55, 0.9], H: [0.76, 0.55] };
    const SLASH_W = 1.3; // the cut's width (x the screen's aspect): its arc crosses the trunk
    const T_LEAP = 0.4, T_CUT = 0.78, T_IMP = 0.9, T_FOL = 1.08, T_WHITE = 2.7;
    let kShake = 0;
    function kanim(u, dt) {
      const fx = {};
      // the camera: a small push in through the leap, the hit shakes it hard
      const z = 1 + 0.06 * K.sm(T_LEAP, T_CUT, u) - 0.03 * K.sm(T_FOL, T_WHITE, u);
      if (u >= T_IMP && u - dt < T_IMP) kShake = 0.03;
      kShake = Math.max(0, kShake - dt * 0.05);
      const rum = u < T_LEAP ? 0.002 : 0;
      const sx = (rnd() - 0.5) * (kShake + rum), sy = (rnd() - 0.5) * (kShake + rum);
      if (tex('k_bg')) picture(tex('k_bg'), z, 0.5, 0.5, 1, sx, sy);
      K.flush();
      const P = (p) => at(p[0], p[1]);
      const H = P(KA.H);
      // the wound left on the tree: the cut's own glow, burning on after it has gone
      if (u > T_FOL + 0.25) { const g = 0.55 + 0.25 * Math.sin(u * 7), tg = tex('fx_kslash_g'); if (tg) { const m = FXM.kslash, wd = SLASH_W * A(), hh = (wd * m.h) / m.w / 2, hw = wd / 2, a = A(), x = H[0] - 0.05 * A(), y = H[1] + 0.12; K.quad(tg.t, true, [[(x - hw) / a, y + hh], [(x + hw) / a, y + hh], [(x + hw) / a, y - hh], [(x - hw) / a, y - hh]], [0.25, 0.25, 0.5, 0.5], [1, 1, 1, g * K.sm(T_FOL + 0.25, T_FOL + 0.7, u)]); } }
      K.flush();
      if (u < T_LEAP) { // the crouch: red lightning bursting off him, the ground glowing red
        const a = P(KA.A);
        sq(K.TX.glow, a[0], a[1], 0.45, [1, 0.1, 0.08, 0.35 + 0.15 * Math.sin(u * 40)]);
        K.flush();
        pose(1, a[0], a[1]);
        K.flush();
        fxf('kbolt', (u * 24) % 8, a[0], a[1] + 0.35, 1.3, 0.9);
        if (rnd() < dt * 60) emit({ x: a[0] + (rnd() - 0.5) * 0.4, y: a[1] + 0.05, vx: (rnd() - 0.5) * 0.4, vy: 0.4 + rnd() * 0.8, life: 0.5, s: 0.006, c: [1, 0.2, 0.12], streak: 0.05 });
      } else if (u < T_CUT) { // the leap: an arc up towards the tree, red afterimages trailing
        const s = (q) => { q = K.eOut(K.clamp(q, 0, 1)); const a = P(KA.A), b = P(KA.B), c = [(a[0] + b[0]) / 2 - 0.1 * A(), b[1] + 0.25]; const m = 1 - q; return [m * m * a[0] + 2 * m * q * c[0] + q * q * b[0], m * m * (a[1] + 0.3) + 2 * m * q * c[1] + q * q * b[1]]; };
        const q = (u - T_LEAP) / (T_CUT - T_LEAP);
        for (let i = 3; i >= 1; i--) { const g = s(q - i * 0.09); pose(2, g[0], g[1], true, { sil: 0.3, col: [1, 1, 1, 0.5 - i * 0.12] }); }
        K.flush();
        const g = s(q);
        pose(2, g[0], g[1], true);
        speedLines(dt, 60, [1, 0.8, 0.8]);
        if (rnd() < dt * 80) emit({ x: g[0] - 0.1 + (rnd() - 0.5) * 0.3, y: g[1] + (rnd() - 0.5) * 0.4, vx: -1.6 - rnd(), vy: -0.6 - rnd() * 0.5, life: 0.4, s: 0.006, c: [1, 0.18, 0.12], streak: 0.05 });
      } else if (u < T_FOL) { // the cut and the frozen hit
        const q = K.clamp((u - T_CUT) / (T_IMP - T_CUT), 0, 1), b = P(KA.B), c = P(KA.C);
        pose(3, K.lerp(b[0], c[0], q), K.lerp(b[1], c[1], q), true);
        K.flush();
        const f = u < T_IMP ? (u - T_CUT) * 30 : 4;   // (the hit holds the cut on its brightest frame)
        fxf('kslash', f, H[0] - 0.05 * A(), H[1] + 0.12, SLASH_W * A(), 1);
        if (u >= T_IMP) fxf('kburst', Math.min(3, (u - T_IMP) * 40), H[0], H[1], 1.3, 1);
        // the impact frames: red, inverted, red, then the picture again
        if (u >= T_IMP) {
          const w = u - T_IMP;
          if (w < 0.045) { fx.impact = 1; fx.impCol = [1, 0.18, 0.15]; }
          else if (w < 0.09) { fx.impact = 1; fx.impCol = [1, 0.96, 0.94]; fx.impInv = 1; }
          else if (w < 0.135) { fx.impact = 1; fx.impCol = [1, 0.18, 0.15]; }
          else fx.flash = [0.6, 0.55, 0.55];
        }
      } else { // the follow-through: he lands past the tree, the cut tears away, the shock rolls out
        const q = K.eOut(K.clamp((u - T_FOL) / 0.5, 0, 1)), d = P(KA.D);
        fxf('kshock', (u - T_FOL) * 22, H[0], H[1], 1.6, 1);
        K.flush();
        pose(4, d[0] + q * 0.05, d[1]);
        K.flush();
        fxf('kslash', 4 + (u - T_FOL) * 20, H[0] - 0.05 * A(), H[1] + 0.12, SLASH_W * A(), 1);
        if (u - T_FOL < 0.6) fxf('kbolt', (u * 24) % 8, H[0], H[1], 1.1, 1 - (u - T_FOL) / 0.6);
        if (u - dt < T_FOL) {
          for (let i = 0; i < 50; i++) { const a = rnd() * Math.PI * 2, v = 0.5 + rnd() * 1.8; emit({ x: H[0], y: H[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v + 0.4, ay: -2.2, life: 1.4, rw: 0.012 + rnd() * 0.02, rh: 0.008 + rnd() * 0.014, tx: K.TX.white, c: [0.14, 0.08, 0.1], add: false, spin: (rnd() - 0.5) * 9 }); }
          for (let i = 0; i < 80; i++) { const a = rnd() * Math.PI * 2, v = 0.6 + rnd() * 2.4; emit({ x: H[0], y: H[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + rnd() * 0.8, s: 0.006, c: rnd() < 0.75 ? [1, 0.16, 0.1] : [0.85, 0.4, 1], streak: 0.06 }); }
        }
        fx.zoom = 0.06 * Math.exp(-5 * (u - T_FOL)); fx.zc = [0.62, 0.5];
        const wv = K.sm(T_WHITE, 3.4, u); fx.flash = [wv * 1.3, wv * 1.25, wv * 1.25];
      }
      return fx;
    }

    // ---------- a general's cut, drawn like an anime action cut (the user: "เฟรมการต่อสู้โชวสกิล ... ดูเหมือน anime"):
    // the glowing eyes close up -> the wind-up drawing (pro_<id>_a) -> an impact frame (the strike in two tones) ->
    // the strike drawing (pro_<id>_b) with a big shake -> the held pose (pro_<id>) and the name card.
    // Without the two fight drawings it falls back to the eyes and a whip-pull out to the pose.
    function general(g, u, dt, dur) {
      const c = g.col, base = tex('pro_' + g.id), fa = tex('pro_' + g.id + '_a'), fb = tex('pro_' + g.id + '_b');
      const frames = !!(fa && fb);
      const T1 = 0.38, T2 = frames ? 0.95 : T1, T3 = frames ? 1.03 : T1, T4 = frames ? 1.75 : T1;
      const E = (o) => emit(Object.assign({ c }, o));
      const out = { tint: [K.lerp(1, c[0], 0.15), K.lerp(1, c[1], 0.15), K.lerp(1, c[2], 0.15)] };
      let hold = 0; // how far into the held pose (0..1, for its own effects)
      if (u < T1) { // the eyes, close
        if (base) picture(base, 2.5 + u * 0.4, g.eye[0], g.eye[1], 1);
        K.flush();
        const e = at(g.eye[0], g.eye[1]);
        sq(K.TX.glow, e[0], e[1], 0.5, [c[0], c[1], c[2], 0.35]);
        speedLines(dt, 70, [1, 1, 1]);
        out.flash = u < 0.08 ? [c[0] * 0.5, c[1] * 0.5, c[2] * 0.5] : null; out.zoom = 0.05;
      } else if (u < T2) { // the wind-up: a slow push in, the power pulled in towards them, the ground rumbling
        const v = (u - T1) / (T2 - T1), r = 0.004;
        picture(fa, 1.02 + v * 0.08, 0.5, 0.5, 1, (rnd() - 0.5) * r, (rnd() - 0.5) * r);
        K.flush();
        for (let i = 0; i < 3; i++) if (rnd() < dt * 70) {
          const a = rnd() * Math.PI * 2, d = 1.3 + rnd() * 0.5;
          E({ x: Math.cos(a) * d * A(), y: Math.sin(a) * d, vx: -Math.cos(a) * d * 2.2 * A(), vy: -Math.sin(a) * d * 2.2, life: 0.42, s: 0.006, streak: 0.05 });
        }
        if (u - T1 < 0.06) out.flash = [0.35, 0.35, 0.35];
      } else if (u < T3) { // the impact frame
        picture(fb, 1.08, 0.5, 0.5, 1);
        out.impact = 1; out.impCol = [K.lerp(1, c[0], 0.35), K.lerp(1, c[1], 0.35), K.lerp(1, c[2], 0.35)];
      } else if (u < T4) { // the strike: a big shake, the zoom blur easing out, sparks bursting out
        const v = (u - T3) / (T4 - T3), sh = Math.exp(-6 * v) * 0.02;
        picture(fb, 1.1 - v * 0.05, 0.5, 0.5, 1, (rnd() - 0.5) * sh, (rnd() - 0.5) * sh);
        K.flush();
        if (u - dt < T3) for (let i = 0; i < 70; i++) { const a = rnd() * Math.PI * 2, sp = 1 + rnd() * 2.6; E({ x: 0, y: 0, vx: Math.cos(a) * sp * A(), vy: Math.sin(a) * sp, life: 0.4 + rnd() * 0.6, s: 0.005 + rnd() * 0.008, streak: 0.06 }); }
        speedLines(dt, 40, [1, 1, 1]);
        out.zoom = 0.1 * Math.pow(1 - v, 3); out.zc = [0.5, 0.5];
        if (v < 0.08) out.flash = [0.4, 0.4, 0.4];
      } else { // the held pose with the name
        if (frames) {
          hold = K.eOut((u - T4) / 0.6);
          picture(base, K.lerp(1.16, 1.05, hold) + (u - T4) * 0.02, 0.5, 0.5, 1);
        } else { // (no fight drawings: the whip-pull out of the eyes)
          hold = K.eOut((u - T4) / 0.28);
          const sh = Math.exp(-7 * (u - T4)) * 0.012;
          picture(base, K.lerp(2.7, 1.06, hold) + (u - T4) * 0.04, K.lerp(g.eye[0], 0.5, hold), K.lerp(g.eye[1], 0.5, hold), 1, (rnd() - 0.5) * sh, (rnd() - 0.5) * sh);
          out.zoom = Math.max(0, 0.22 * (1 - hold));
          if (u - T4 < 0.07) out.flash = [0.6, 0.6, 0.6];
        }
        K.flush();
      }
      // the element, all through the cut
      const strikeNow = u >= T3 && u - dt < T3, inHold = u >= T4;
      if (g.fx === 'violet' || g.fx === 'void') {
        if (rnd() < dt * 50) E({ x: (rnd() * 2 - 1) * A(), y: -1.05, vx: (rnd() - 0.5) * 0.1, vy: 0.4 + rnd() * 0.5, life: 2, s: 0.008 + rnd() * 0.012, wob: 0.4, ph: rnd() * 9 });
        if (inHold) { const p = at(g.fx === 'void' ? 0.5 : 0.62, 0.55); rot(SIGIL, p[0], p[1], 0.7, 0.7, u * 0.6, [c[0], c[1], c[2], 0.22 * hold]); }
        if (g.fx === 'void' && rnd() < dt * 30) E({ x: (rnd() * 2 - 1) * A(), y: (rnd() * 2 - 1), vx: 0, vy: 0, life: 1.2, s: 0.006, c: [1, 0.95, 0.75], tw: 1, ph: rnd() * 9 });
      } else if (g.fx === 'plague') {
        if (rnd() < dt * 22) E({ x: (rnd() * 2 - 1) * A(), y: -1.05, vx: (rnd() - 0.5) * 0.05, vy: 0.15 + rnd() * 0.25, life: 3, s: 0.015 + rnd() * 0.02, tx: K.TX.ring, wob: 0.15, ph: rnd() * 9, a: 0.7 });
        if (rnd() < dt * 30) E({ x: (rnd() * 2 - 1) * A(), y: -0.7 + rnd() * 0.6, vx: 0.08, vy: 0.03, life: 2.4, s: 0.18 + rnd() * 0.2, tx: K.TX.glow, a: 0.12 });
      } else if (g.fx === 'shadow') {
        if (rnd() < dt * 24) E({ x: (rnd() * 2 - 1) * A(), y: 1.1, vx: -0.1, vy: -0.25 - rnd() * 0.2, life: 4, rw: 0.03, rh: 0.07, tx: FEATHER, c: [0.05, 0.03, 0.08], add: false, a: 0.9, spin: (rnd() - 0.5) * 3, ang: rnd() * 6 });
        if (u > T3 && u < T3 + 0.35) { const a = 1 - (u - T3) / 0.35; line(K.TX.glow, -1.2 * A(), 0.25, 1.2 * A(), -0.05, 0.06, [c[0], c[1], c[2], 0.8 * a]); line(K.TX.white, -1.2 * A(), 0.25, 1.2 * A(), -0.05, 0.007, [1, 1, 1, a]); }
      } else if (g.fx === 'fire') {
        for (let i = 0; i < 2; i++) if (rnd() < dt * 60) E({ x: (rnd() * 2 - 1) * A(), y: -1.05, vx: (rnd() - 0.5) * 0.3, vy: 0.7 + rnd() * 0.9, life: 1.4, s: 0.006 + rnd() * 0.01, wob: 0.6, ph: rnd() * 9, c: rnd() < 0.5 ? [1, 0.5, 0.15] : [1, 0.8, 0.35] });
      } else if (g.fx === 'holy') {
        if (rnd() < dt * 40) E({ x: (rnd() * 2 - 1) * A(), y: (rnd() * 2 - 1), vx: 0, vy: 0.2, life: 1.2, s: 0.006 + rnd() * 0.008, tw: 1, ph: rnd() * 9 });
        if (rnd() < dt * 50) E({ x: (rnd() * 2 - 1) * A(), y: -1.05, vx: (rnd() - 0.5) * 0.2, vy: 0.5 + rnd() * 0.7, life: 1.5, s: 0.006 + rnd() * 0.008, wob: 0.3, ph: rnd() * 9 });
        if (inHold) { const p = at(0.5, 0.75); sq(K.TX.glow, p[0], p[1], 0.9, [c[0], c[1], c[2], (0.18 + 0.12 * Math.sin(u * 14)) * hold]); }
      } else if (g.fx === 'earth') {
        if (strikeNow) for (let i = 0; i < 40; i++) E({ x: (rnd() * 2 - 1) * A(), y: -1.05, vx: (rnd() - 0.5) * 0.6, vy: 1.2 + rnd() * 1.4, ay: -2.6, life: 1.8, rw: 0.012 + rnd() * 0.025, rh: 0.012 + rnd() * 0.02, tx: K.TX.white, c: [0.16, 0.11, 0.08], add: false, spin: (rnd() - 0.5) * 8 });
        if (rnd() < dt * 40) E({ x: (rnd() * 2 - 1) * A(), y: -1.05, vx: (rnd() - 0.5) * 0.2, vy: 0.4 + rnd() * 0.5, life: 1.4, s: 0.006 + rnd() * 0.008, wob: 0.3, ph: rnd() * 9 });
      }
      // the name card, over the held pose
      const cin = K.sm(T4 + 0.05, T4 + 0.35, u) * (1 - K.sm(dur - 0.25, dur - 0.02, u));
      cardB.textContent = g.name; cardI.textContent = g.title; cardE.textContent = g.en;
      card.className = 'pr-card side-' + g.card;
      card.style.setProperty('--c', `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`);
      card.style.opacity = cin.toFixed(3);
      card.style.transform = `${g.card === 'B' ? 'translateX(-50%) ' : ''}translateX(${((1 - cin) * (g.card === 'R' ? 60 : g.card === 'L' ? -60 : 0)).toFixed(1)}px) skewX(-6deg)`;
      return out;
    }

    // ---------------- one frame ----------------
    function frame(dt) {
      t += dt;
      let i = SHOTS.findIndex((s) => t < s.t0 + s.dur);
      if (i < 0) i = SHOTS.length - 1;
      const sh = SHOTS[i], u = t - sh.t0;
      if (i !== lastI) { if (sh.title) parts.length = 0; lastI = i; } // (a title card starts clean: no snow left over)
      K.clear(0, 0, 0);
      K.setFog([0, 0, 0]);
      stepParts(dt);
      let fx = {};
      // a title card on black ("สามร้อยปีก่อน" / "สามร้อยปีต่อมา")
      const ta = sh.title ? K.sm(0.2, 0.7, u) * (1 - K.sm(sh.dur - 0.5, sh.dur - 0.05, u)) : 0;
      if (titleEl.textContent !== (sh.title || '')) titleEl.textContent = sh.title || '';
      titleEl.style.opacity = ta.toFixed(3);
      if (sh.title) {
        card.style.display = 'none';
      } else if (sh.gen) {
        card.style.display = '';
        fx = general(sh.gen, u, dt, sh.dur) || {};
      } else if (sh.anim) {
        card.style.display = 'none';
        effect({ fx: 'snow' }, u, dt, 1);
        fx = kanim(u, dt);
      } else if (sh.ext) { // a shot drawn by another file (window.NCPrologueExt[sh.ext].draw)
        card.style.display = 'none';
        const E = EXT()[sh.ext];
        fx = (E && E.draw(api, u, dt, sh)) || {};
      } else {
        card.style.display = 'none';
        // a story panel, cross-fading in over the one before (unless that was a general's hard cut)
        const prev = SHOTS[i - 1], fade = prev && prev.title ? K.sm(0, 0.9, u) : prev && prev.pic && !prev.gen && !sh.cut ? K.sm(0, 0.6, u) : 1;
        if (fade < 1 && prev.pic && tex(prev.pic)) { const pu = (prev.dur + u) / prev.dur; picture(tex(prev.pic), K.lerp(prev.z0, prev.z1, pu), K.lerp(prev.c0[0], prev.c1[0], pu), K.lerp(prev.c0[1], prev.c1[1], pu), 1); }
        const k = u / sh.dur, e = k * 0.4 + K.eInOut(k) * 0.6;
        let z = K.lerp(sh.z0, sh.z1, e), cx = K.lerp(sh.c0[0], sh.c1[0], e), cy = K.lerp(sh.c0[1], sh.c1[1], e);
        if (sh.last) { const p = K.sm(sh.dur - 1.6, sh.dur, u); z *= 1 + p * p * 3.5; cx = K.lerp(cx, sh.star[0], p); cy = K.lerp(cy, sh.star[1], p); }
        let sx = 0, sy = 0;
        if (sh.fx === 'shatter' && u > 0.3) { const a = Math.exp(-4 * (u - 0.3)) * 0.01; sx = (rnd() - 0.5) * a; sy = (rnd() - 0.5) * a; }
        if (sh.fx === 'kstrike' && u > 0.08) { const a = Math.exp(-5 * (u - 0.08)) * 0.018; sx = (rnd() - 0.5) * a; sy = (rnd() - 0.5) * a; }
        if (sh.fx === 'rush') { sx = (rnd() - 0.5) * 0.004; sy = (rnd() - 0.5) * 0.004; }
        if (tex(sh.pic)) picture(tex(sh.pic), z, cx, cy, fade, sx, sy);
        K.flush();
        effect(sh, u, dt, fade);
        if (sh.fx === 'shatter' && u > 0.3) fx.flash = Array(3).fill(Math.exp(-5 * (u - 0.3)) * 0.8);
        if (sh.fx === 'storm') for (const lt of [0.9, 2.3]) if (u > lt && u < lt + 0.14) fx.flash = [0.25, 0.27, 0.35];
        if (sh.fx === 'hollow') fx.sat = K.lerp(0.85, 0.12, K.sm(0.5, sh.dur - 0.5, u));
        if (sh.fx === 'rush') { fx.zoom = 0.045; fx.zc = [0.72, 0.45]; }
        if (sh.fx === 'helm' || sh.fx === 'bolts') { if (u < 0.07) fx.flash = [0.5, 0.06, 0.05]; }
        if (sh.fx === 'kstrike') {
          if (u < 0.08) { fx.impact = 1; fx.impCol = [1, 0.25, 0.2]; }
          else { const sh2 = Math.exp(-5 * (u - 0.08)); fx.zoom = 0.25 * sh2; fx.zc = [0.5, 0.5]; }
          const w = K.sm(sh.dur - 0.45, sh.dur, u); fx.flash = [w * 1.3, w * 1.25, w * 1.25];
        }
        if (sh.fx === 'after') { const w = 1 - K.sm(0, 0.9, u); fx.flash = [w * 1.3, w * 1.25, w * 1.25]; fx.sat = 0.85; }
        if (sh.fx === 'sunset') fx.tint = [K.lerp(1, 0.6, K.sm(1.5, 4.4, u)), K.lerp(1, 0.62, K.sm(1.5, 4.4, u)), K.lerp(1, 0.85, K.sm(1.5, 4.4, u))];
        if (sh.last) { const p = K.sm(sh.dur - 1.6, sh.dur, u); fx.zoom = p * 0.25; fx.zc = [0.5, 0.5]; const f = K.sm(sh.dur - 0.7, sh.dur, u); fx.flash = [f * 1.1, f * 0.8, f * 0.55]; }
      }
      K.flush();
      drawParts();
      K.flush();
      // the caption
      const cap = sh.cap || '', ca = sh.cap ? K.sm(0.25, 0.6, u) * (1 - K.sm(sh.dur - 0.45, sh.dur - 0.1, u)) : 0;
      if (capEl.textContent !== cap) capEl.textContent = cap;
      capEl.style.opacity = ca.toFixed(3);
      // in from black at the start; the end flashes into the game
      const fadeIn = 1 - K.sm(0, 0.8, t);
      K.postFx({ thr: fx.thr == null ? 0.55 : fx.thr, bloomK: fx.bloomK == null ? 0.8 : fx.bloomK, vig: 0.9, fade: Math.max(fadeIn, out), zoom: fx.zoom || 0, zc: fx.zc, flash: fx.flash || [0, 0, 0], sat: fx.sat, tint: fx.tint, impact: fx.impact, impCol: fx.impCol, impInv: fx.impInv });
      if (t >= total && !ended) end();
    }
    function end() {
      ended = true;
      try { localStorage.setItem(SEEN, '1'); } catch (e) { /* storage blocked */ }
      ui.classList.add('gone');
      done();
    }
    // a click / a key: on to the next shot (a general's cut counts as one); Esc / "ข้าม": into the game
    function next() {
      const i = SHOTS.findIndex((s) => t < s.t0 + s.dur);
      if (i < 0 || i >= SHOTS.length - 1) { t = total - 0.75; return; }
      t = SHOTS[i + 1].t0; parts.length = 0;
    }
    function skip() { if (t < total - 0.75) { t = total - 0.75; parts.length = 0; } }
    window.__prologue = { at(v) { t = v; parts.length = 0; }, get t() { return t; }, total, SHOTS };
    return { frame, next, skip };
  }

  window.NCPrologue = { wanted, begin, preload };
})();
