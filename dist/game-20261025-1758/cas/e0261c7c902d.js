/* jobs3_skills_a.js — the first batch of the new 2nd jobs (the plan "อาชีพใหม่ Night Camp", 2026-09-28):
     นักดาบ       รอยดาบ: slashes leave glowing blade marks for 3 s; finishers set them all off.
                  lane ก ดาบคู่ (เพลงดาบคู่ + เจตจำนงนักดาบ) · lane ข ดาบเวท (ดาบเวท + ท่าชักดาบ, ATK+MATK)
     จอมเวทไฟ     แถบความร้อน 0–100: fire spells heat you up (stronger fire), over 80 you burn; vent it as a nova.
                  lane คทา (นรกเพลิง + ความร้อน) · lane ออร์บ (ลูกไฟรัว + ความร้อน)
     จอมเวทน้ำแข็ง  shatter: a skill hit on a frozen monster breaks it, the shards chill the ones round it.
                  lane คทา (ธารน้ำแข็ง + แตกกระจาย) · lane ออร์บ + โล่ (ปราการน้ำแข็ง: armour, walls)
   The data (outfits, weapons) is in jobs3.js; the weapon rules (n: needs, b: bonus) go to weapons.js's NC.weaponRule.
   A skill of type 'hybrid' hits with ATK + MATK (the magic sword). Built with skillkit.js; loaded after weapons.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, SK = NC.SKILLS;
  const { C, P, TAU } = K;
  const rand = NC.rand, S = K.S, alive = K.alive;
  const r1 = (v) => Math.round(v * 10) / 10;
  const lvOf = (p, id) => NC.skillLv(p, id);
  const on = (p, id) => K.buffOn(p, id);
  const bl = (p, id) => (on(p, id) ? (p.buffLv && p.buffLv[id]) || 1 : 0);
  const roll = (pct) => Math.random() * 100 < pct;
  const wt = (p) => (NC.wtypeOf ? NC.wtypeOf(NC.weaponDef(p)) : '');
  const isBoss = (e) => !!((NC.BOSSES && NC.BOSSES[e.type]) || e.boss || e.isBoss);
  const once = (game, p, tag) => { const o = p._once3 || (p._once3 = {}); if (o[tag] === game.time) return false; o[tag] = game.time; return true; };
  const others = (game, e, r, n) => game.enemies.filter((o) => o !== e && alive(o) && NC.dist(o.x, o.y, e.x, e.y) < r)
    .sort((a, b) => NC.dist(a.x, a.y, e.x, e.y) - NC.dist(b.x, b.y, e.x, e.y)).slice(0, n || 99);
  const castPose = (game, p, lock) => K.pose(game, p, K.clip(p, 'bolt', 0), lock || 0.3);
  const swingPose = (game, p, i, lock) => K.pose(game, p, K.clip(p, 'swing', i || 0), lock || 0.25);
  const shout = (p, text, fill) => FX.text(p.x, p.y - 200, text, fill || '#ffe28a', 32);
  const MOON = '170,215,255', STEEL = '220,235,255', FIRE = C.fire || '255,140,60', ICE = C.ice || '160,220,255', EMBER = '255,190,90';
  const EL_RGB = { fire: '255,140,60', water: '150,215,255', wind: '255,236,120' };
  const EL_TH = { fire: 'ไฟ', water: 'น้ำแข็ง', wind: 'สายฟ้า' };
  const MPAL = ['#6f88d8', '#c8dcff', '#ffffff']; // moonlit steel (the swordmaster's slashes)
  const EL_PAL = { fire: P.fire, water: P.ice, wind: P.lightning };

  // ---------------- the class looks join the class list; the jobs' skills ----------------
  if (NC.JOBS3) {
    const at = NC.CLASSES.findIndex((c) => c.id === 'monk');
    const add = NC.JOBS3.sets.filter((s) => !NC.CLASSES.some((c) => c.id === s.id));
    NC.CLASSES.splice(at < 0 ? NC.CLASSES.length : at + 1, 0, ...add);
  }

  // ---------------- ATK + MATK hits ('hybrid'): one physical hit, as strong as ATK and MATK together ----------------
  const baseHH = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    if (o && o.kind === 'hybrid') {
      const atk = (d.batk + (d.watk[0] + d.watk[1]) / 2) * d.atkMul, matk = (d.matk[0] + d.matk[1]) / 2;
      const G = NC.game, p = G && G.player, heart = p && p.d === d ? lvOf(p, 'sm_heart') : 0;
      const ratio = 0.75 * (1 + matk / Math.max(1, atk)) * (heart ? 1.2 : 1); // (ใจดาบเวท: the two borrow from each other, +20%)
      o = Object.assign({}, o, { kind: 'phys', mul: (o.mul || 1) * ratio });
    }
    const r = baseHH.call(this, d, e, o);
    if (o && o.sid) { r.sid = o.sid; r.skill = !!o.skill; }
    return r;
  };

  // =====================================================================================================
  // นักดาบ
  // =====================================================================================================
  // ---------------- blade marks ----------------
  const MARKS = [];
  const markMax = 14;
  function addMark(game, p, e, n) {
    if (game && game.presentationOnly) return; // (online a presented cast only draws: the server sends its marks)
    for (let i = 0; i < (n || 1); i++) {
      if (MARKS.length >= markMax) MARKS.shift();
      const x = e.x + rand(-40, 40), y = e.y - rand(40, 100);
      MARKS.push({ x, y, t: 0, life: 3, ang: rand(-1.2, 1.2) + (Math.random() < 0.5 ? 0 : Math.PI / 2), el: on(p, 'sm_enchant') && lvOf(p, 'sm_heart') >= 3 ? p.smEl : null });
      V.sparks(x, y, 5, MOON, { size: 0.6 });
    }
    ensureDrawer(game);
  }
  // a mark going off: a cross of light, a hit round it (k: x ATK)
  function burstLook(m) {
    const rgb = m.el ? EL_RGB[m.el] : MOON;
    const pal = m.el ? EL_PAL[m.el] : MPAL;
    K.slashAt(m.x, m.y + 40, 70, m.ang, pal, rgb, { sweep: 1.2, thick: 18, life: 0.2 });
    K.slashAt(m.x, m.y + 40, 70, m.ang + Math.PI / 2, pal, rgb, { sweep: 1.2, thick: 18, life: 0.2 });
    V.glowAt(m.x, m.y, 10, 90, rgb, 0.8, 0.25, { hot: true });
    V.sparks(m.x, m.y, 8, rgb, { size: 0.7 });
  }
  function burstMark(game, p, m, k) {
    burstLook(m);
    const rgb = m.el ? EL_RGB[m.el] : MOON;
    for (const e of K.around(game, m.x, m.y + 50, 90)) K.hit(game, p, 'sm_mark', e, 0, 0, m.el ? rgb : '215,235,255', k, m.el ? { element: m.el } : undefined);
  }
  function detonate(game, p, filter, k, at) {
    if (game && game.presentationOnly) return 0; // (online the server sets its marks off)
    const hit = MARKS.filter((m) => !filter || filter(m));
    for (let i = 0; i < hit.length; i++) {
      const m = hit[i];
      MARKS.splice(MARKS.indexOf(m), 1);
      if (at) { const from = [m.x, m.y]; m.x = at[0] + rand(-30, 30); m.y = at[1] - rand(30, 80); FX.add({ type: 'cutline', x: from[0], y: from[1], x1: m.x, y1: m.y, w: 8, color: MOON, life: 0.2 }); }
      V.at(0.04 * i, () => burstMark(game, p, m, k));
    }
    if (hit.length) V.shake(game, Math.min(8, 2 + hit.length));
    return hit.length;
  }
  NC.bladeMarks = MARKS;
  // for the online client, which keeps the server's marks (js/online-meters.js): the look of one going off
  NC.BladeMarks = { list: MARKS, burstLook, ensureDrawer: () => ensureDrawer() };
  let drawer = null;
  function ensureDrawer(game) {
    if (drawer && FX.list.includes(drawer)) return;
    drawer = FX.add({ type: 'j3marks', layer: 'glow', life: 1e9, x: 0, y: 0 });
  }
  FX.def('j3marks', (ctx) => {
    for (const m of MARKS) {
      const u = m.t / m.life, a = Math.min(1, m.t / 0.1) * (u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1), rgb = m.el ? EL_RGB[m.el] : MOON;
      const blink = u > 0.75 ? 0.6 + 0.4 * Math.sin(m.t * 30) : 1;
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.ang); ctx.globalAlpha *= a * blink; ctx.globalCompositeOperation = 'lighter';
      const L = 34 + 6 * Math.sin(m.t * 6);
      for (const s of [1, -1]) {
        ctx.save(); ctx.rotate(s * 0.62);
        const g = ctx.createLinearGradient(-L, 0, L, 0);
        g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.5, `rgba(${rgb},0.95)`); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.quadraticCurveTo(0, -5, L, 0); ctx.quadraticCurveTo(0, 5, -L, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-L * 0.6, 0); ctx.lineTo(L * 0.6, 0); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      V.glow(ctx, m.x, m.y, 40, rgb, 0.35 * a, true);
    }
  });

  // ---------------- floating magic swords, the thousand moon blades (drawn round the hero) ----------------
  const FLOAT = { n: 0, until: 0, acc: 0, el: null };
  const MOONS = { until: 0 };
  FX.def('j3orbit', (ctx, q) => {
    const G = NC.game, p = G && G.player;
    if (!p) return;
    const t = G.time;
    if (FLOAT.until > t) for (let i = 0; i < FLOAT.n; i++) {
      const a = t * 1.6 + (i / FLOAT.n) * TAU, x = p.x + Math.cos(a) * 70, y = p.y - 90 + Math.sin(a) * 26, rgb = FLOAT.el ? EL_RGB[FLOAT.el] : MOON;
      K.drawBlade(ctx, x, y, -Math.PI / 2 + Math.sin(t * 3 + i) * 0.15, 44, 7, '#e8f2ff', rgb);
    }
    if (p.iceArmor > 0 && p.buffs && p.buffs.im_armor > 0) { // the ice shell: six pale plates turning slowly round the hero
      ctx.save(); ctx.globalAlpha *= 0.55 + 0.1 * Math.sin(t * 3);
      for (let i = 0; i < 6; i++) {
        const a = t * 0.8 + (i / 6) * TAU, x = p.x + Math.cos(a) * 58, y = p.y - 70 + Math.sin(a) * 22, front = Math.sin(a) > 0;
        ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= front ? 1 : 0.5;
        icePlate(ctx);
        ctx.restore();
      }
      ctx.restore();
      V.glow(ctx, p.x, p.y - 70, 110, ICE, 0.18, true);
    }
    if (MOONS.until > t) for (let i = 0; i < 8; i++) {
      const a = -t * 2.2 + (i / 8) * TAU, x = p.x + Math.cos(a) * 110, y = p.y - 70 + Math.sin(a) * 40;
      ctx.save(); ctx.globalAlpha *= 0.75;
      K.drawBlade(ctx, x, y, a + Math.PI / 2, 40, 6, '#6a78b8', '120,140,255');
      ctx.restore();
    }
  });
  // one plate of the ice armour's shell, round (0, 0) (Unity bakes it: scripts/export-unity-content.mjs ice_plate)
  function icePlate(ctx) {
    ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(10, -8); ctx.lineTo(7, 20); ctx.lineTo(-7, 20); ctx.lineTo(-10, -8); ctx.closePath();
    ctx.fillStyle = 'rgba(200,235,255,0.75)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#2a2d4a'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3, -14); ctx.lineTo(-2, 12); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
  }
  let orbitFx = null;
  const ensureOrbit = () => { if (!orbitFx || !FX.list.includes(orbitFx)) orbitFx = FX.add({ type: 'j3orbit', layer: 'high', life: 1e9, x: 0, y: 0 }); };
  NC.SwordOrbit = { FLOAT, MOONS, ensure: ensureOrbit }; // (the online client sets them from the server's meters)
  // the orbit is the swordmaster's own lasting look, as the other jobs' gauges are (souls, chambers); online a presented
  // cast leaves it to the server's meters
  const orbits = (game, p) => !game.presentationOnly && NC.isJob(p, 'swordmaster');

  K.def({
    sm_mark: S({ name: 'รอยดาบ', icon: 'sk_sm_twin', mul: () => 1, sp: () => 0, cd: 0 }), // (the hits of the marks; no one learns it)
    sm_twin: S({ name: 'ดาบคู่ประสาน', icon: 'sk_sm_twin', pass: (lv, p) => (wt(p) === 'dsword' ? { aspd: lv, critDmg: 0 } : null),
      desc: (lv) => `ถือดาบคู่: ตีปกติฟันสองมือ มือซ้ายแรง ${30 + lv * 2}% ความเร็วโจมตี +${lv}% · ทุกครั้งที่ 4 ทิ้งรอยดาบ${lv >= 5 ? ' · รอยที่ครบ 3 วิระเบิดเอง 45%' : ''}${lv >= 10 ? ' · ทิ้งทีละ 2 รอย' : ''}` }),
    sm_moondance: S({ name: 'ระบำใบมีดใต้จันทร์', icon: 'sk_sm_moondance', kind: 'buff', cd: 30, sp: () => 30, rgb: MOON, circle: 'arcane',
      dur: () => 30, buff: (lv, p) => ({ aspd: Math.round((p.smDance || 0) * 1.5), crit: lv >= 10 && (p.smDance || 0) >= 10 ? 10 : 0 }),
      desc: (lv) => `30 วิ: ตีโดนได้ชั้นระบำ สูงสุด 10 ชั้น ชั้นละความเร็วโจมตี +1.5% · ครบ 10 ชั้นตีปกติทุกครั้งทิ้งรอยดาบ${lv >= 5 ? ' · เปลี่ยนเป้าแล้วชั้นไม่หาย' : ''}${lv >= 10 ? ' · ครบ 10 ชั้นคริ +10' : ''}` }),
    sm_bladerain: S({ name: 'สายฝนดาบ', icon: 'sk_sm_bladerain', free: 1, cd: 5, sp: () => 18, mul: (lv) => 0.55 + lv * 0.09,
      desc: (lv, m) => `ฟันรัว 6 ครั้ง ครั้งละ ${m}% ของ ATK ทุกครั้งทิ้งรอยดาบ${lv >= 5 ? ' · เดินได้ระหว่างฟัน' : ''}${lv >= 10 ? ' · ครั้งสุดท้ายดึงรอยดาบทั้งหมดมาระเบิดที่เป้า' : ''}` }),
    sm_thousand: S({ name: 'จันทร์พันดาบ', icon: 'sk_sm_thousand', ult: true, max: 5, cd: 45, sp: () => 60, mul: (lv) => 0.5 + lv * 0.1,
      desc: (lv, m) => `เงาดาบ 8 เล่มโคจรรอบตัว 8 วิ ตีปกติแต่ละครั้งเงาดาบ 2 เล่มพุ่งตาม เล่มละ ${m}% ของ ATK` }),
    sm_duel: S({ name: 'ท้าดวล', icon: 'sk_sm_duel', max: 5, cd: 12, sp: () => 10, mul: () => 0,
      desc: (lv) => `ท้าเป้า 1 ตัว 12 วิ มันหันมาตีเรา เราทำดาเมจใส่มัน +${lv * 4}% · ชนะดวลได้ "เกียรตินักดาบ" ATK +5% 20 วิ ซ้อนได้ 3 ชั้น` }),
    sm_eye: S({ name: 'สายตานักดาบ', icon: 'sk_sm_eye', pass: (lv, p) => (['dsword', 'sword', 'gsword'].includes(wt(p)) ? { critDmg: lv * 2, hit: lv * 2 } : null),
      desc: (lv) => `ถือดาบ: ดาเมจคริ +${lv * 2}% ความแม่น +${lv * 2} · รอยดาบระเบิดคริได้` }),
    sm_enchant: S({ name: 'ใส่ธาตุดาบ', icon: 'sk_sm_enchant', kind: 'buff', cd: 3, sp: () => 20, rgb: EMBER, dur: () => 60, buff: () => ({}),
      desc: (lv) => `60 วิ: ใส่ธาตุไฟ น้ำแข็ง หรือสายฟ้าให้ดาบ (กดซ้ำเพื่อสลับธาตุ) ตีปกติเพิ่ม MATK ${40 + lv * 6}% ธาตุนั้น ติดสถานะของธาตุ · ตีปกติทุกครั้งที่ 3 ทิ้งรอยดาบ${lv >= 5 ? ' · สลับธาตุแล้วครั้งแรกเกิดปฏิกิริยาแรงขึ้น' : ''}${lv >= 10 ? ' · ธาตุเดิมติดดาบอยู่ด้วย (2 ธาตุ)' : ''}` }),
    sm_wave: S({ name: 'คลื่นดาบเวท', icon: 'sk_sm_wave', free: 1, type: 'hybrid', cd: 3, sp: () => 16, mul: (lv) => 0.5 + lv * 0.08,
      desc: (lv, m) => `ฟันปล่อยคลื่นเวทธาตุของดาบไป 500 ${m}% ของ ATK+MATK ทิ้งรอยดาบบนตัวที่โดน${lv >= 5 ? ' · คลื่นทะลุ' : ''}${lv >= 10 ? ' · ปล่อย 3 คลื่นเป็นพัด' : ''}` }),
    sm_float: S({ name: 'ดาบเวทลอย', icon: 'sk_sm_float', type: 'magic', cd: 12, sp: () => 30, mul: (lv) => 0.25 + lv * 0.04,
      desc: (lv, m) => `ดาบเวท ${2 + Math.floor(lv / 4)} เล่มลอยรอบตัว 20 วิ พุ่งใส่เป้าที่เราตีทุก 1 วิ เล่มละ ${m}% ของ MATK ธาตุของดาบ` }),
    sm_heart: S({ name: 'ใจดาบเวท', icon: 'sk_sm_heart', max: 5, pass: () => ({}),
      desc: (lv) => `ATK กับ MATK ยืมค่ากันและกัน: ท่า ATK+MATK แรงขึ้นราว 20%${lv >= 3 ? ' · รอยดาบระเบิดเป็นธาตุของดาบและติดสถานะ' : ''}${lv >= 5 ? ' · ชักดาบแล้วดาบเวทลอยทุกเล่มพุ่งพร้อมกัน' : ''}` }),
    sm_iai: S({ name: 'ชักดาบผ่ารอย', icon: 'sk_sm_iai', cd: 7, sp: () => 20, mul: (lv) => 1.4 + lv * 0.22,
      desc: (lv, m) => `ชาร์จ 0.6 วิ แล้วพุ่งฟันเป็นเส้น 400 ${m}% ของ ATK ×1.6 รอยดาบบนเส้นทางระเบิดทั้งหมด รอยละ 60% · มือว่าง (ไม่ถือโล่): แรงขึ้น 20%${lv >= 10 ? ' · ฆ่าได้คืนคูลดาวน์ครึ่งหนึ่ง' : ''}` }),
    sm_focus: S({ name: 'สมาธิดาบ', icon: 'sk_sm_focus', max: 5, pass: () => ({}),
      desc: (lv) => `ไม่ได้ตี 2 วิ ท่าชักดาบครั้งถัดไปคริแน่นอน${lv >= 3 ? ' · ชาร์จเร็วขึ้น 30%' : ''}${lv >= 5 ? ' · รอยดาบที่ระเบิดจากท่าชักดาบแรง ×1.5' : ''}` }),
  });
  SK.sm_mark.active = false; SK.sm_mark.kind = 'passive';
  // the enchanted blade glows with its element
  SK.sm_enchant.aura = (game, p, dt) => {
    if (!p.smEl || Math.random() > dt * 24) return;
    const [x, y] = K.tip(p), rgb = EL_RGB[p.smEl];
    V.motes(x + rand(-10, 10), y + rand(-10, 10), 1, rgb, { rise: 60, spread: 6, size: 0.9 });
    if (p.smEl === 'fire' && Math.random() < 0.4) V.flameAt(x, y + 10, 14, 24, P.fire, 0.3, { vy: -60 });
    if (p.smEl === 'wind' && Math.random() < 0.3) V.sparks(x, y, 2, rgb, { size: 0.5, max: 160 });
  };

  // ---- casting ----
  RUN.sm_moondance = function (game, p, lv) {
    p.smDance = 0; p.smDanceT = null;
    K.pose(game, p, 'cheer', 0.3);
    K.startBuff(game, p, 'sm_moondance', lv);
    K.buffFx(game, p, MOON, { style: 'arcane' });
    for (let i = 0; i < 8; i++) V.at(i * 0.04, () => K.slashAt(p.x, p.y, 110, (i / 8) * TAU, MPAL, MOON, { sweep: 1, thick: 14, life: 0.25 }));
    shout(p, 'ระบำใบมีด!', '#cfe6ff');
  };
  RUN.sm_bladerain = function (game, p, lv) {
    const t0 = K.target(game, p, 300, 200);
    const walk = lv >= 5;
    for (let i = 0; i < 6; i++) V.at(i * 0.12, () => {
      if (walk) { p.atk.on = false; p.face = Math.cos(p.aim) >= 0 ? 1 : -1; if (NC.Anim.CLIPS && i % 2 === 0) NC.Anim.play(p.anim, K.clip(p, 'swing', i % 3)); }
      else swingPose(game, p, i % 3, 0.16);
      const e = t0 && alive(t0) ? t0 : K.target(game, p, 260, 160);
      const x = e ? e.x : p.x + Math.cos(p.aim) * 120, y = e ? e.y : p.y + Math.sin(p.aim) * 80;
      K.slashAt(x, y - 20, 90, rand(-2.6, 0.6), MPAL, MOON, { sweep: 1.9, thick: 26, life: 0.22 });
      V.sparks(x, y - 60, 6, STEEL, { size: 0.7 });
      for (const f of K.around(game, x, y, 90)) { K.hit(game, p, 'sm_bladerain', f, p.face * 60, 0, '215,235,255'); }
      if (p.remote) return; // (another player's, js/net.js: the cuts only; MARKS are mine)
      if (e) addMark(game, p, e);
      if (i === 5 && lv >= 10 && e) { V.at(0.08, () => { if (alive(e)) detonate(game, p, null, 0.6, [e.x, e.y]); }); }
    });
    if (!walk) p.skillLock = Math.max(p.skillLock || 0, 0.7);
  };
  RUN.sm_thousand = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    if (orbits(game, p)) { MOONS.until = game.time + 8; ensureOrbit(); }
    V.flash('130,150,255', 0.12, 0.3);
    K.buffFx(game, p, '130,150,255', { style: 'arcane', r: 200 });
    shout(p, 'จันทร์พันดาบ!', '#c8d2ff');
  };
  RUN.sm_duel = function (game, p, lv) {
    const e = K.target(game, p, 600, 260);
    if (!e) return;
    swingPose(game, p, 0, 0.2);
    p.duel = { e, until: game.time + 12, lv };
    K.vuln(game, e, 1 + lv * 0.04, 12, '255,210,120');
    e.state = 'chase';
    FX.add({ type: 'cutline', x: p.x, y: p.y - 80, x1: e.x, y1: e.y - 60, w: 6, color: '255,210,120', life: 0.4 });
    FX.text(e.x, NC.labelTop(e) - 90, 'ท้าดวล!', '#ffd27a', 32);
    V.ring(e.x, e.y, 10, 120, 8, '255,210,120', 0.4);
  };
  // the enchant: first cast picks fire; casting it again while on cycles fire -> ice -> lightning
  RUN.sm_enchant = function (game, p, lv) {
    const order = ['fire', 'water', 'wind'];
    const was = on(p, 'sm_enchant') ? p.smEl : null;
    p.smEl2 = was;
    p.smEl = was ? order[(order.indexOf(was) + 1) % 3] : p.smEl || 'fire';
    p.smSwap = lv >= 5 && was ? 1 : 0;
    K.pose(game, p, 'cheer', 0.25);
    K.startBuff(game, p, 'sm_enchant', lv, was ? p.buffs.sm_enchant : 60);
    const rgb = EL_RGB[p.smEl];
    K.buffFx(game, p, rgb, { style: 'arcane', r: 120, flash: false });
    FX.text(p.x, p.y - 200, 'ดาบธาตุ' + EL_TH[p.smEl], `rgb(${rgb})`, 30);
    NC.applyGear(game);
  };
  RUN.sm_wave = function (game, p, lv) {
    swingPose(game, p, 1, 0.28);
    const el = on(p, 'sm_enchant') ? p.smEl : null, rgb = el ? EL_RGB[el] : MOON;
    const angs = lv >= 10 ? [-0.3, 0, 0.3] : [0];
    for (const da of angs) K.shot(game, p, 'sm_wave', {
      from: [p.x + Math.cos(p.aim) * 40, p.y - 60], ang: p.aim + da, v: 1100, range: 500, r: 56, pierce: lv >= 5, rgb,
      hit(e) { K.hit(game, p, 'sm_wave', e, Math.cos(p.aim) * 160, Math.sin(p.aim) * 110, rgb); addMark(game, p, e); V.sparks(e.x, e.y - 50, 6, rgb, { size: 0.7 }); },
      look(ctx, q) {
        const an = Math.atan2(q.vy, q.vx), f = Math.min(1, q.t / 0.06) * (1 - Math.max(0, q.t / q.life - 0.75) / 0.25);
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(an); ctx.globalAlpha *= f; ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.arc(-16, 0, 60, -1.2, 1.2); ctx.arc(-44, 0, 54, 1.1, -1.1, true); ctx.closePath();
        ctx.fillStyle = `rgba(${rgb},0.6)`; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
        ctx.restore();
        V.glow(ctx, q.x, q.y, 70, rgb, 0.45 * f, true);
      },
    });
    V.light(p.x, p.y - 60, 300, rgb, 0.8, 0.3);
  };
  RUN.sm_float = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.3);
    if (orbits(game, p)) {
      FLOAT.n = 2 + Math.floor(lv / 4); FLOAT.until = game.time + 20; FLOAT.acc = 0; FLOAT.el = on(p, 'sm_enchant') ? p.smEl : null;
      ensureOrbit();
    }
    K.buffFx(game, p, FLOAT.el ? EL_RGB[FLOAT.el] : MOON, { style: 'arcane', r: 130, flash: false });
  };
  function fireFloat(game, p, e, all) {
    const n = all ? FLOAT.n : 1, rgb = FLOAT.el ? EL_RGB[FLOAT.el] : MOON;
    for (let i = 0; i < n; i++) {
      const a = game.time * 1.6 + (i / FLOAT.n) * TAU, from = [p.x + Math.cos(a) * 70, p.y - 90 + Math.sin(a) * 26];
      V.at(i * 0.05, () => {
        if (!alive(e)) return;
        K.shot(game, p, 'sm_float', { from, ang: NC.angle(from[0], from[1], e.x, e.y - 45), v: 1300, range: 900, r: 30, home: 14, target: e, rgb,
          look(ctx, q) { K.drawBlade(ctx, q.x, q.y, Math.atan2(q.vy, q.vx), 44, 7, '#e8f2ff', rgb); },
          hit(f) { K.hit(game, p, 'sm_float', f, 0, 0, rgb, 1, FLOAT.el ? { element: FLOAT.el } : undefined); V.sparks(f.x, f.y - 50, 6, rgb, { size: 0.6 }); } });
      });
    }
  }
  RUN.sm_iai = function (game, p, lv) {
    const charge = 0.6 * (lvOf(p, 'sm_focus') >= 3 ? 0.7 : 1);
    const sure = lvOf(p, 'sm_focus') >= 1 && game.time - (p.lastSwingT || 0) >= 2;
    K.pose(game, p, K.clip(p, 'swing', 0), charge + 0.1);
    V.circle(p.x, p.y, 90, MOON, charge, { style: 'arcane', spin: 4, grow: true });
    let acc = 0;
    K.channel(game, p, charge, (ch, dt) => {
      if ((acc += dt) > 0.05) { acc = 0; V.motes(p.x, p.y - 60, 3, MOON, { spread: 80, rise: -120 }); }
    }, () => {
      const ang = p.aim, x0 = p.x, y0 = p.y, dist = 400, got = [];
      const free = NC.weaponLoadout && (() => { const L = NC.weaponLoadout(p); return L.T.h === 1 && !L.sh; })();
      const k = 1.6 * (free ? 1.2 : 1);
      K.dash(game, p, 'sm_iai', ang, dist, 0.16, {
        rgb: MOON, pal: MPAL,
        hit(e) { got.push(e); const r = K.hit(game, p, 'sm_iai', e, Math.cos(ang) * 120, Math.sin(ang) * 90, '215,235,255', k, { crit: sure || undefined }); K.slashAt(e.x, e.y - 60, 80, ang - 0.4, MPAL, MOON, { sweep: 1.2, thick: 22 }); },
        end() {
          const c = Math.cos(ang), s = Math.sin(ang) * 0.8, x1 = p.x, y1 = p.y;
          V.flash('200,225,255', 0.1, 0.2);
          FX.text(p.x, p.y - 200, 'ชักดาบ!', '#dfeaff', 30);
          const nearLine = (m) => {
            const dx = m.x - x0, dy = m.y + 60 - y0, L2 = (x1 - x0) ** 2 + (y1 - y0) ** 2 || 1;
            const u = Math.max(0, Math.min(1, (dx * (x1 - x0) + dy * (y1 - y0)) / L2));
            return Math.hypot(x0 + (x1 - x0) * u - m.x, y0 + (y1 - y0) * u - (m.y + 60)) < 130;
          };
          V.at(0.12, () => detonate(game, p, nearLine, 0.6 * (lvOf(p, 'sm_focus') >= 5 ? 1.5 : 1)));
          if (lvOf(p, 'sm_heart') >= 5 && FLOAT.until > game.time) { const e = got.find(alive) || K.target(game, p, 600, 300); if (e) fireFloat(game, p, e, true); }
          if (lv >= 10) V.at(0.3, () => { if (got.some((e) => !alive(e))) { p.cd['@sm_iai'] *= 0.5; } });
          void c; void s;
        },
      });
    });
  };

  // ---- the basic hits: the off hand, marks, the dance, the enchant, the floating swords, the moon blades ----
  NC.basicHits.push((game, p, e, r) => {
    if (!game || p !== game.player || !(r.dmg > 0) || !NC.isJob(p, 'swordmaster')) return;
    const first = once(game, p, 'sw');
    if (first) p.lastSwingT = game.time;
    const w = wt(p);
    // the off hand of the twin swords: a second, smaller number
    if (w === 'dsword' && lvOf(p, 'sm_twin') && first) {
      const lv = lvOf(p, 'sm_twin'), k = 0.3 + lv * 0.02;
      V.at(0.07, () => { if (alive(e)) NC.damageEnemy(game, e, { dmg: Math.max(1, Math.round(r.dmg * k)), mod: 1, crit: r.crit }, 0, 0, { color: '200,225,255' }); });
      p.smN = (p.smN || 0) + 1;
      if (p.smN % 4 === 0) addMark(game, p, e, lv >= 10 ? 2 : 1);
    }
    // the moonlit dance: stacks, at 10 every hit leaves a mark
    if (on(p, 'sm_moondance') && first && w === 'dsword') {
      if (p.smDanceT && p.smDanceT !== e && bl(p, 'sm_moondance') < 5) p.smDance = 0;
      p.smDanceT = e;
      const was = p.smDance || 0;
      p.smDance = Math.min(10, was + 1);
      if (p.smDance !== was) NC.applyGear(game);
      if (p.smDance >= 10) addMark(game, p, e);
    }
    // the enchanted blade: an extra magic hit of its element; every 3rd hit a mark
    if (on(p, 'sm_enchant') && w === 'sword' && first) {
      const lv = bl(p, 'sm_enchant'), el = p.smEl, rgb = EL_RGB[el];
      const extra = (elx, kk) => {
        const rr = NC.heroHit(p.d, e, { kind: 'magic', mul: (0.4 + lv * 0.06) * kk, skill: true, sid: 'sm_enchant', element: elx });
        if (p.smSwap) { rr.dmg = Math.round(rr.dmg * 1.3); p.smSwap = 0; }
        V.at(0.06, () => { if (alive(e)) NC.damageEnemy(game, e, rr, 0, 0, { color: EL_RGB[elx] }); });
      };
      extra(el, 1);
      if (lv >= 10 && p.smEl2 && p.smEl2 !== el) extra(p.smEl2, 0.5);
      V.sparks(e.x, e.y - 50, 5, rgb, { size: 0.6 });
      p.smEN = (p.smEN || 0) + 1;
      if (p.smEN % 3 === 0) addMark(game, p, e);
    }
    // the floating swords fly at what we hit (every 1 s, one at a time)
    if (FLOAT.until > game.time && first && game.time - (FLOAT.last || 0) >= 1 / Math.max(1, FLOAT.n)) { FLOAT.last = game.time; fireFloat(game, p, e, false); }
    // the thousand moon blades: two shadow blades follow every hit
    if (MOONS.until > game.time && first) {
      const lv = lvOf(p, 'sm_thousand') || 1;
      for (let i = 0; i < 2; i++) V.at(i * 0.06, () => {
        if (!alive(e)) return;
        const a = rand(0, TAU), from = [p.x + Math.cos(a) * 110, p.y - 70 + Math.sin(a) * 40];
        K.shot(game, p, 'sm_thousand', { from, ang: NC.angle(from[0], from[1], e.x, e.y - 45), v: 1400, range: 900, r: 30, home: 16, target: e, rgb: '120,140,255',
          look(ctx, q) { K.drawBlade(ctx, q.x, q.y, Math.atan2(q.vy, q.vx), 40, 6, '#6a78b8', '120,140,255'); },
          hit(f) { K.hit(game, p, 'sm_thousand', f, 0, 0, '160,170,255'); } });
        void lv;
      });
    }
  });
  // the duel: winning it (the challenged one falls) gives the swordsman's honour
  NC.skillKills.push((game, e) => {
    const p = game.player;
    if (!p || !p.duel || p.duel.e !== e || p.duel.until < game.time) return;
    p.duel = null;
    p.smHonor = Math.min(3, (p.smHonor && p.smHonorT > game.time ? p.smHonor : 0) + 1);
    p.smHonorT = game.time + 20;
    NC.applyGear(game);
    shout(p, `เกียรตินักดาบ ×${p.smHonor}`, '#ffd27a');
    K.buffFx(game, p, '255,210,120', { r: 110, flash: false });
  });
  NC.skillModSources.push((p) => (p.smHonor && p.smHonorT > ((NC.game && NC.game.time) || 0) ? { atk: p.smHonor * 5 } : null));
  // the honour's chip in the buff row, its stacks on it (2026-10-20 Discord #75: "เกียรตินักดาบขึ้นแค่ตัวอักษร atk ไม่เพิ่ม
  // ไม่มีบัฟให้ดู": the ATK % did rise, nothing showed it). Online the server's meter has no seconds: each new stack starts 20
  if (NC.HUD && NC.HUD.renderBuffs) {
    const baseBuffs = NC.HUD.renderBuffs;
    let lastN = 0, endT = 0;
    NC.HUD.renderBuffs = function (p) {
      baseBuffs.apply(this, arguments);
      const box = document.getElementById('buffs');
      if (!box || !p) return;
      const now = (NC.game && NC.game.time) || 0, n = p.smHonor && p.smHonorT > now ? p.smHonor : 0;
      if (n > lastN) endT = now + 20;
      lastN = n;
      let el = box.querySelector('.buff.smhonor');
      if (!n) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement('div');
        el.className = 'buff smhonor';
        el.innerHTML = `<img src="${(NC.ASSET_MANIFEST.sk_sm_duel || {}).src || ''}" alt=""><b></b>`;
        box.appendChild(el);
      }
      const left = Math.max(0, Math.ceil(endT - now));
      const tip = `เกียรตินักดาบ ×${n} · ATK +${n * 5}% (ชนะท้าดวล ซ้อนได้ 3 ชั้น)${left ? ` · อีก ${left} วิ` : ''}`;
      if (el.title !== tip) el.title = tip;
      // (the row's loop wrote this chip a buff's seconds: the stacks instead, written past its cache like js/online/expx5.js)
      const b = el.querySelector('b');
      if (b.textContent !== '×' + n) b.textContent = '×' + n;
      el.classList.toggle('ending', left > 0 && left <= 3);
    };
    document.addEventListener('click', (ev) => { // (a touch screen has no hover title)
      const el = ev.target.closest && ev.target.closest('.buff.smhonor');
      if (el && el.title && NC.HUD.toast) NC.HUD.toast(el.title);
    });
  }
  // the enchant's element on the sword's hits
  const baseDerive = NC.derive;
  NC.derive = function (p) {
    const d = baseDerive.apply(this, arguments);
    if (p && p.kind === 'player' && p.buffs) {
      if (p.buffs.sm_enchant > 0 && p.smEl) d.atkElement = p.smEl;
      const w = NC.wtypeOf ? NC.wtypeOf(NC.ITEMS[p.equip && p.equip.weapon]) : '';
      if (w === 'orb' && p.skills && (p.skills.fm_orbfire || 0) > 0 && NC.skillLv(p, 'fm_orbfire') > 0) d.atkElement = 'fire';
      if (w === 'orb' && p.skills && (p.skills.im_winter || 0) > 0 && NC.skillLv(p, 'im_winter') > 0) d.atkElement = 'water';
    }
    return d;
  };

  // ---- every frame: marks age (and may go off), the swords run out ----
  NC.skillTicks.push((game, p, dt) => {
    for (let i = MARKS.length - 1; i >= 0; i--) {
      const m = MARKS[i];
      m.t += dt;
      if (m.t >= m.life) {
        MARKS.splice(i, 1);
        if (NC.isJob(p, 'swordmaster') && lvOf(p, 'sm_twin') >= 5) burstMark(game, p, m, 0.45);
      }
    }
    if (!NC.isJob(p, 'swordmaster') && MARKS.length) MARKS.length = 0;
    if (p.duel && (p.duel.until < game.time || !alive(p.duel.e))) { if (p.duel.until < game.time) p.duel = null; }
    if (on(p, 'sm_moondance') === false && p.smDance) { p.smDance = 0; }
    if (p.smHonor && p.smHonorT <= game.time) { p.smHonor = 0; NC.applyGear(game); }
  });

  // =====================================================================================================
  // จอมเวทไฟ: the heat gauge
  // =====================================================================================================
  const HEAT = { v: 0, idle: 0, vented: -99 };
  NC.heat = HEAT;
  const EMB = () => (NC.EmberFX && NC.EmberFX.live() ? NC.EmberFX : null); // the code-drawn fire (js/emberfx.js), when its sheets are in
  const isFireMage = (p) => p && NC.isJob(p, 'firemage');
  K.def({
    fm_pillar: S({ name: 'เสาเพลิง', icon: 'sk_am_firepillar', free: 1, type: 'magic', element: 'fire', castT: 0.6, cd: 5, sp: () => 22, mul: (lv) => 0.22 + lv * 0.026, heat: 8,
      desc: (lv, m) => `เสาไฟปะทุใต้ศัตรู 3 ครั้ง (ถือคทา 4 ครั้ง) ครั้งละ ${m}% ของ MATK ความร้อน +8${lv >= 5 ? ' · ตัวที่เผาอยู่โดนเพิ่ม 20%' : ''}${lv >= 10 ? ' · ทิ้งพื้นไฟ 3 วิ' : ''}` }),
    fm_sea: S({ name: 'ทะเลเพลิง', icon: 'sk_am_inferno', type: 'magic', element: 'fire', castT: 2, cd: 12, sp: () => 45, mul: (lv) => 0.2 + lv * 0.03, heat: 20,
      desc: (lv, m) => `ทะเลเพลิงรัศมี 320 นาน 6 วิ ทุกครึ่งวิ ${m}% ของ MATK ติดเผา ความร้อน +20${lv >= 5 ? ' · ศัตรูข้างในช้าลง' : ''}${lv >= 10 ? ' · ทะเลเพลิงไหลตามศัตรูที่ใกล้ที่สุด' : ''}` }),
    fm_ring: S({ name: 'วงแหวนเพลิง', icon: 'sk_fm_ring', type: 'magic', element: 'fire', cd: 8, sp: () => 30, mul: (lv) => 0.45 + lv * 0.06, heat: 12,
      desc: (lv, m) => `วงแหวนไฟรอบตัว 4 วิ ศัตรูที่ผ่านโดน ${m}% ของ MATK และถูกผลักออก ความร้อน +12${lv >= 5 ? ' · วงแหวนขยายออกเรื่อย ๆ' : ''}${lv >= 10 ? ' · วงแหวน 2 ชั้น' : ''}` }),
    fm_master: S({ name: 'ปรมาจารย์เพลิง', icon: 'sk_am_infernomastery', max: 5, pass: () => ({}),
      desc: (lv) => `เผาซ้อนได้ 8 ชั้น${lv >= 3 ? ' · ระบายความร้อนแล้ว 5 วิไม่โดนเผาจากความร้อน' : ''}${lv >= 5 ? ' · เผาครบ 8 ชั้นแล้วระเบิดเอง 150% ของ MATK (ตัวละครั้งทุก 5 วิ)' : ''}` }),
    fm_burst: S({ name: 'ไฟระเบิด', icon: 'sk_am_infernomastery', type: 'magic', element: 'fire', mul: () => 1.5, sp: () => 0, cd: 0 }), // (ปรมาจารย์เพลิง Lv 5's blast)
    fm_gauge: S({ name: 'แถบความร้อน', icon: 'sk_fm_gauge', free: 1, pass: () => ({}),
      desc: (lv) => `ร่ายสกิลไฟได้ความร้อน 0–100 ทุก 10 ความร้อน ดาเมจไฟ +${r1(0.5 + lv * 0.1)}% · เกิน 80 เราติดเผาเสีย HP 1% ต่อวิ · ไม่ร่ายไฟ 3 วิ ความร้อนลดวิละ 10${lv >= 5 ? ' (ลดช้าลงครึ่งหนึ่ง)' : ''}${lv >= 10 ? ' · ที่ 100 ความร้อน ร่ายไฟไม่ใช้ SP' : ''}` }),
    fm_vent: S({ name: 'ระบายความร้อน', icon: 'sk_fm_vent', type: 'magic', element: 'fire', cd: 4, sp: () => 10, mul: (lv) => (0.02 + lv * 0.004) * Math.max(10, HEAT.v),
      desc: (lv) => `ปล่อยความร้อนทั้งหมดเป็นระเบิดรอบตัว MATK ${r1(2 + lv * 0.4)}% × ความร้อน (ตอนนี้ ${Math.round(HEAT.v)}) ผลักศัตรูออก${lv >= 5 ? ' · ที่ 100 ทิ้งวงไฟ 4 วิ' : ''}${lv >= 10 ? ' · ระบายแล้วร่ายเร็วขึ้น 30% 5 วิ' : ''}` }),
    fm_forge: S({ name: 'หัวใจเตาหลอม', icon: 'sk_fm_forge', pass: (lv) => ({ hpPct: r1(lv * 1.5) }),
      desc: (lv) => `HP สูงสุด +${r1(lv * 1.5)}% · เผาจากความร้อนของตัวเองลดลง ${lv * 5}%` }),
    fm_orbfire: S({ name: 'ลูกไฟตีปกติ', icon: 'sk_fm_orbfire', pass: (lv, p) => (wt(p) === 'orb' ? { matk: lv * 3 } : null),
      desc: (lv) => `ถือออร์บ: ตีปกติเป็นลูกไฟ MATK +${lv * 3}% ติดเผา 5% ต่อครั้ง ความร้อน +2 ต่อครั้ง` }),
    fm_spread: S({ name: 'ไฟลาม', icon: 'sk_fm_spread', pass: () => ({}),
      desc: (lv) => `ถือออร์บ: ตัวที่ติดเผาตาย ไฟกระโดดไปตัวใกล้ ${1 + Math.floor(lv / 5)} ตัว พร้อมชั้นเผาครึ่งหนึ่ง` }),
    fm_seek: S({ name: 'เพลิงตามติด', icon: 'sk_fm_seek', kind: 'buff', type: 'buff', max: 5, cd: 20, sp: () => 25, rgb: FIRE, dur: () => 20, buff: () => ({}),
      mul: (lv) => 0.12 + lv * 0.03, desc: (lv) => `20 วิ: ลูกไฟตีปกติโดนแล้วแตกเป็นลูกเล็ก 3 ลูกวิ่งหาเป้าเอง ลูกละ ${Math.round((0.12 + lv * 0.03) * 100)}% ของ MATK` }),
    fm_meteor: S({ name: 'อุกกาบาตถล่ม', icon: 'sk_fm_meteor', ult: true, max: 5, type: 'magic', element: 'fire', castT: 2.2, cd: 60, sp: () => 90, mul: (lv) => 2.5 + lv * 0.5, heat: 25,
      desc: (lv, m) => `อุกกาบาต 8 ลูกร่วงใส่วงใหญ่ 3 วิ 2 ลูกพุ่งใส่ศัตรูในวง ลูกละ ${m}% ของ MATK วงระเบิดใหญ่ · ร่ายตอนความร้อน 100 ได้ลูกยักษ์เพิ่ม 1 ลูก (×3.2)` }),
  });
  SK.fm_burst.active = false; SK.fm_burst.kind = 'passive';
  SK.fm_seek.type = 'magic'; SK.fm_seek.element = 'fire'; // (its little fireballs' hits; the cast is a buff)

  RUN.fm_pillar = function (game, p, lv) {
    castPose(game, p, 0.3);
    const e0 = K.target(game, p, 600);
    let [tx, ty] = e0 ? [e0.x, e0.y] : K.ground(game, p, 440);
    const n = wt(p) === 'staff' ? 4 : 3;
    for (let i = 0; i < n; i++) V.at(0.12 + i * 0.22, () => {
      if (e0 && alive(e0)) { tx = e0.x; ty = e0.y; }
      V.circle(tx, ty, 90, FIRE, 0.4, { style: 'arcane', spin: 3 });
      for (let k = 0; k < 7; k++) V.flameAt(tx + rand(-26, 26), ty + rand(-8, 8), rand(40, 60), rand(150, 230), P.fire, rand(0.4, 0.6), { vy: -120 });
      V.glowAt(tx, ty - 80, 30, 160, FIRE, 0.9, 0.35, { hot: true });
      V.light(tx, ty - 60, 360, FIRE, 1, 0.4, { flick: true });
      V.shake(game, 3);
      for (const e of K.around(game, tx, ty, 110)) K.hit(game, p, 'fm_pillar', e, 0, -140, '255,170,90', lv >= 5 && NC.statusOf(e, 'burn') ? 1.2 : 1);
      if (i === n - 1 && lv >= 10) K.zone(game, p, 'fm_pillar', tx, ty, 100, 3, 0.5, { rgb: FIRE, style: 'arcane', color: '255,170,90', circle: false,
        tick() { if (Math.random() < 0.4) V.flameAt(tx + rand(-80, 80), ty + rand(-30, 30), 26, 50, P.fire, 0.4, { vy: -60 }); } });
    });
  };
  RUN.fm_sea = function (game, p, lv) {
    castPose(game, p, 0.3);
    const [tx, ty] = K.ground(game, p, 480), R = 320 * (lv >= 10 ? 1 : 1);
    const z = { x: tx, y: ty };
    const hunt = lv >= 10 ? K.target(game, p, 700, 400) : null;
    K.zone(game, p, 'fm_sea', tx, ty, R, 6, 0.5, {
      rgb: FIRE, style: 'arcane', color: '255,170,90', status: ['burn', 4],
      each(e) { if (lv >= 5) K.slow(e, 0.6); },
      tick(q, dt) {
        if (hunt && alive(hunt)) { q.x += Math.sign(hunt.x - q.x) * Math.min(Math.abs(hunt.x - q.x), 60 * dt); q.y += Math.sign(hunt.y - q.y) * Math.min(Math.abs(hunt.y - q.y), 40 * dt); }
        for (let i = 0; i < 3; i++) if (Math.random() < dt * 30) { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * R; V.flameAt(q.x + Math.cos(a) * d, q.y + Math.sin(a) * d * V.SQ, rand(26, 40), rand(50, 100), P.fire, rand(0.35, 0.55), { vy: -70 }); }
      },
    });
    // (the zone's own hits use the fixed spot; a hunting sea keeps its flames on the moving spot)
    void z;
    V.decal(tx, ty, R * 0.8, 'scorch', 6.5);
    V.light(tx, ty - 40, R * 2.4, FIRE, 0.9, 6, { flick: true });
  };
  RUN.fm_ring = function (game, p, lv) {
    castPose(game, p, 0.25);
    const last = new Map();
    let R = 170;
    const rings = lv >= 10 ? [1, 1.55] : [1];
    K.zone(game, p, 'fm_ring', p.x, p.y, R, 4, 0.1, {
      rgb: FIRE, circle: false, glow: false, hits: false, follow: p,
      tick(z, dt) {
        if (lv >= 5) R = Math.min(300, R + 40 * dt);
        for (const k of rings) {
          const rr = R * k;
          for (let i = 0; i < 3; i++) if (Math.random() < dt * 40) { const a = rand(0, TAU); V.flameAt(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * V.SQ, rand(24, 34), rand(46, 80), P.fire, rand(0.3, 0.45), { vy: -60 }); }
          for (const e of K.around(game, p.x, p.y, rr + 40)) {
            const d = Math.hypot(e.x - p.x, (e.y - p.y) / 0.62);
            if (d < rr - 60) continue;
            const key = e.id || e;
            if (game.time - (last.get(key) || -9) < 1.2) continue;
            last.set(key, game.time);
            const a = NC.angle(p.x, p.y, e.x, e.y);
            K.hit(game, p, 'fm_ring', e, Math.cos(a) * 420, Math.sin(a) * 300, '255,170,90');
          }
        }
      },
    });
    V.light(p.x, p.y - 40, 520, FIRE, 0.8, 4, { follow: p, flick: true });
  };
  RUN.fm_vent = function (game, p, lv) {
    const h = HEAT.v;
    K.pose(game, p, 'cheer', 0.3);
    const r = 220 + h * 1.4;
    K.nova(game, p, 'fm_vent', p.x, p.y, r, { rgb: FIRE, kb: 380, color: '255,170,90', decal: 'scorch', shake: 4 + h / 15, flash: h >= 80 ? '255,160,80' : null, smoke: ['#4a3a3a', '#6a5555'] });
    K.flames(p.x, p.y, 10 + Math.round(h / 6), r * 0.7);
    if (h >= 100 && lv >= 5) K.zone(game, p, 'fm_vent', p.x, p.y, 200, 4, 0.5, { rgb: FIRE, style: 'arcane', color: '255,170,90', mul: 0.3, status: ['burn', 3] });
    if (lv >= 10) p.fmQuick = game.time + 5;
    HEAT.v = 0; HEAT.vented = game.time;
    shout(p, 'ระบายความร้อน!', '#ffb070');
  };
  RUN.fm_seek = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.25);
    K.startBuff(game, p, 'fm_seek', lv);
    K.buffFx(game, p, FIRE, { style: 'arcane', r: 120, flash: false });
  };
  // อุกกาบาตถล่ม: blasts of 160 and every 4th rock (2 of 8) aims at a monster inside the circle (2026-10-03: the user found the
  // 1st-job Meteor stronger; same Fire Mage Lv 90, both Lv 5, 12 casts each on Lv 85 dummies, heat 0: the Mage's 26.7k a
  // clump / 31.5k spread out, ours with 110-radius blasts anywhere 21.8k / 19.0k → now 40.1k / 42.8k, a cast 1.4–1.5x, per
  // second of cooldown (60 s against 50 s) 1.13–1.25x; at 100 heat the giant one on top)
  NC.fmMeteorSpot = (game, tx, ty) => (i, R) => {
    if (i % 4) return null;
    const inside = game.enemies.filter((e) => alive(e) && (e.x - tx) ** 2 + ((e.y - ty) / V.SQ) ** 2 < R * R);
    const e = inside[Math.floor(Math.random() * inside.length)];
    return e ? [e.x + rand(-30, 30), e.y + rand(-18, 18)] : null;
  };
  NC.FM_METEOR_IR = 160;
  RUN.fm_meteor = function (game, p, lv) {
    castPose(game, p, 0.4);
    const [tx, ty] = K.ground(game, p, 520), big = HEAT.v >= 100;
    const look = (s) => (ctx, q) => { V.glow(ctx, q.x, q.y, 70 * s, FIRE, 0.9, true); K.drawOrb(ctx, q.x, q.y, 22 * s, '255,120,50', '#fff0b0'); };
    K.rain(game, p, 'fm_meteor', tx, ty, 300, 8, 2.6, { rgb: FIRE, ir: NC.FM_METEOR_IR, fall: 0.4, color: '255,170,90', status: ['burn', 4], look: look(1), spot: NC.fmMeteorSpot(game, tx, ty),
      land(x, y) { K.flames(x, y, 5, 60); V.decal(x, y, 80, 'scorch', 4); V.shake(game, 4); } });
    if (big) V.at(2.9, () => K.rain(game, p, 'fm_meteor', tx, ty, 1, 1, 0.01, { rgb: FIRE, ir: 240, fall: 0.6, mul: 3.2, look: look(2.4), color: '255,150,70',
      land(x, y) { K.burst(game, x, y, 260, FIRE, { decal: 'scorch', shake: 12, flash: '255,160,80', smoke: ['#4a3a3a', '#6a5555'] }); K.flames(x, y, 18, 200); } }));
    shout(p, big ? 'อุกกาบาตยักษ์!' : 'อุกกาบาตถล่ม!', '#ffb070');
  };

  // heat from fire casts; SP-free at 100 (แถบความร้อน Lv 10); quicker casts after a vent (Lv 10)
  NC.skillCasts.push((game, p, id) => {
    if (!isFireMage(p)) return;
    const S = SK[id];
    if (id === 'fm_vent' || !S) return;
    if (S.element === 'fire' || S.heat) { HEAT.v = Math.min(100, HEAT.v + (S.heat || 8)); HEAT.idle = 0; }
  });
  const baseCost = NC.skillCost;
  NC.skillCost = function (p, id, lv) {
    const c = baseCost.apply(this, arguments);
    return isFireMage(p) && HEAT.v >= 100 && lvOf(p, 'fm_gauge') >= 10 && SK[id] && SK[id].element === 'fire' ? 0 : c;
  };
  if (NC.castTime) {
    const baseCT = NC.castTime;
    NC.castTime = function (p, id, lv) { const t = baseCT.apply(this, arguments); return isFireMage(p) && p.fmQuick > ((NC.game && NC.game.time) || 0) ? t * 0.7 : t; };
  }
  NC.skillModSources.push((p) => (isFireMage(p) ? { el_fire: Math.floor(HEAT.v / 10) * (0.5 + lvOf(p, 'fm_gauge') * 0.1) } : null));
  NC.skillTicks.push((game, p, dt) => {
    if (!isFireMage(p)) { HEAT.v = 0; NC.STATUS.burn.max = 5; return; }
    HEAT.idle += dt;
    if (HEAT.idle > 3) HEAT.v = Math.max(0, HEAT.v - dt * (lvOf(p, 'fm_gauge') >= 5 ? 5 : 10));
    // over 80: we burn (not while the vent's grace lasts)
    const grace = lvOf(p, 'fm_master') >= 3 && game.time - HEAT.vented < 5;
    if (HEAT.v > 80 && !grace && p.dead <= 0) {
      p.fmBurnAcc = (p.fmBurnAcc || 0) + dt;
      if (p.fmBurnAcc >= 0.5) {
        p.fmBurnAcc -= 0.5;
        const dmg = Math.max(1, Math.round(p.maxHp * 0.005 * (1 - lvOf(p, 'fm_forge') * 0.05)));
        if (p.hp > dmg + 1) { p.hp -= dmg; FX.num(p.x, p.y - 150, '-' + dmg, { fill: '#ff9a5a', size: 26 }); }
        if (EMB()) EMB().tongue(p.x + rand(-20, 20), p.y - rand(10, 50), 50, { vy: -60, life: 0.45 }); // (emberfx.js)
        else V.flameAt(p.x + rand(-20, 20), p.y - rand(20, 80), 22, 40, P.fire, 0.4, { vy: -90 });
      }
    }
    NC.STATUS.burn.max = lvOf(p, 'fm_master') >= 1 ? 8 : 5;
    // ปรมาจารย์เพลิง Lv 5: eight burns go off
    if (lvOf(p, 'fm_master') >= 5) for (const e of game.enemies) {
      const b = alive(e) && NC.statusOf(e, 'burn');
      if (b && b.n >= 8 && game.time > (e._fmBurstT || 0)) {
        b.n = 0; b.t = 0; e._fmBurstT = game.time + 5;
        if (EMB()) EMB().blast(game, e.x, e.y, 110, { shake: 5, sparks: 12, tongues: 3, smoke: false }); // (emberfx.js)
        else K.burst(game, e.x, e.y, 110, FIRE, { shake: 5, sparks: 12 });
        for (const f of K.around(game, e.x, e.y, 110)) K.hit(game, p, 'fm_burst', f, 0, -120, '255,170,90');
      }
    }
    ensureHeatBar();
  });
  // burns past 5 stacks (ปรมาจารย์เพลิง) add half as much each: the damage per tick stays about 5.5 stacks' worth at 8
  const baseAdd = NC.addStatus;
  NC.addStatus = function (game, e, k) {
    baseAdd.apply(this, arguments);
    const p = game && game.player, s = e && e.st && e.st.burn;
    if (k === 'burn' && s && s.n > 5 && isFireMage(p)) { s.dmg0 = s.dmg0 && s.n > 5 ? s.dmg0 : s.dmg; s.dmg = Math.max(1, Math.round((s.dmg0 * (5 + (s.n - 5) * 0.5)) / s.n)); }
    else if (k === 'burn' && s) s.dmg0 = 0;
  };
  // the orb's fireballs: burn, heat, the seeking splits
  NC.basicHits.push((game, p, e, r) => {
    if (!game || p !== game.player || !(r.dmg > 0) || !isFireMage(p) || wt(p) !== 'orb') return;
    if (lvOf(p, 'fm_orbfire')) {
      if (roll(5)) NC.addStatus(game, e, 'burn');
      HEAT.v = Math.min(100, HEAT.v + 2); HEAT.idle = 0;
    }
    if (on(p, 'fm_seek') && once(game, p, 'seek')) {
      const lv = bl(p, 'fm_seek');
      const near = others(game, e, 420, 3);
      for (let i = 0; i < 3; i++) {
        const t = near[i % Math.max(1, near.length)] || e;
        K.shot(game, p, 'fm_seek', { from: [e.x, e.y - 50], ang: rand(0, TAU), v: 700, range: 700, r: 26, home: 10, target: t, rgb: FIRE, size: 0.6,
          look: EMB() ? EMB().ballLook(0.26) : undefined, // (emberfx.js)
          hit(f) { K.hit(game, p, 'fm_seek', f, 0, 0, '255,170,90'); if (EMB()) EMB().pop(f.x, f.y - 50, 45); else V.sparks(f.x, f.y - 50, 5, FIRE, { size: 0.6 }); } });
      }
      void lv;
    }
  });
  // ไฟลาม: a burning one falls, its fire jumps
  NC.skillKills.push((game, e) => {
    const p = game.player;
    if (!isFireMage(p) || wt(p) !== 'orb' || !lvOf(p, 'fm_spread')) return;
    const b = e.st && e.st.burn;
    if (!b || !(b.t > 0)) return;
    const n = 1 + Math.floor(lvOf(p, 'fm_spread') / 5), half = Math.max(1, Math.floor(b.n / 2));
    for (const f of others(game, e, 360, n)) {
      for (let i = 0; i < half; i++) NC.addStatus(game, f, 'burn', b.t);
      if (EMB()) { EMB().leap(e, f); continue; } // (emberfx.js: a little fireball arcs over)
      FX.add({ type: 'cutline', x: e.x, y: e.y - 50, x1: f.x, y1: f.y - 50, w: 8, color: FIRE, life: 0.3 });
      V.flameAt(f.x, f.y - 20, 30, 60, P.fire, 0.5, { vy: -60 });
    }
  });
  // the heat bar: over the hero's head
  let heatFx = null;
  function ensureHeatBar() { if (!heatFx || !FX.list.includes(heatFx)) heatFx = FX.add({ type: 'j3heat', layer: 'glow', life: 1e9, x: 0, y: 0 }); }
  FX.def('j3heat', (ctx) => {
    const G = NC.game, p = G && G.player;
    if (!isFireMage(p) || p.dead > 0) return;
    const v = HEAT.v, w = 96, h = 11, x = p.x - w / 2, y = p.y - 232;
    ctx.save();
    ctx.globalAlpha *= v > 0 || G.time - HEAT.vented < 1 ? 1 : 0.55;
    ctx.fillStyle = 'rgba(20,14,28,0.75)'; ctx.strokeStyle = '#2a2435'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 6); ctx.fill(); ctx.stroke();
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#ffcf5a'); g.addColorStop(0.6, '#ff7a3a'); g.addColorStop(1, '#ff3a2a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, (w * v) / 100, h, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x + w * 0.8, y, 2, h);
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = v > 80 ? '#ffb0a0' : '#ffe6b0';
    ctx.strokeStyle = '#1a1422'; ctx.lineWidth = 3;
    const label = 'ความร้อน ' + Math.round(v);
    ctx.strokeText(label, p.x, y - 4); ctx.fillText(label, p.x, y - 4);
    ctx.restore();
    if (v > 80) V.glow(ctx, p.x, p.y - 80, 90, FIRE, 0.25 + 0.1 * Math.sin(G.time * 12), true);
  });

  // =====================================================================================================
  // จอมเวทน้ำแข็ง: shatter
  // =====================================================================================================
  const isIceMage = (p) => p && NC.isJob(p, 'icemage');
  // the armour's lasting shell is the icemage's own (none on the FX capture's job-less hero); online a presented cast
  // leaves it to the server's meter (js/online-meters.js)
  const iceShell = (game, p) => !game.presentationOnly && isIceMage(p);
  K.def({
    im_blizzard: S({ name: 'พายุหิมะ', icon: 'sk_am_blizzard', free: 1, type: 'magic', element: 'water', castT: 1, cd: 10, sp: () => 40, mul: (lv) => 0.5 + lv * 0.07,
      desc: (lv, m) => `พายุหิมะ 5 วิที่เมาส์ วิละ ${m}% ของ MATK เย็นเฉียบทุกวิ ศัตรูช้า · ถือคทา: วงใหญ่ขึ้น 30%${lv >= 10 ? ' · พายุตามเป้าหมาย' : ''}` }),
    im_lance: S({ name: 'หอกธารน้ำแข็ง', icon: 'sk_am_glacial', type: 'magic', element: 'water', castT: 0.7, cd: 6, sp: () => 25, mul: (lv) => 1.6 + lv * 0.22,
      desc: (lv, m) => `หอกน้ำแข็งยักษ์พุ่งทะลุทั้งแนว ${m}% ของ MATK ตัวที่แข็งอยู่โดนสองเท่า` }),
    im_aura: S({ name: 'ลมหนาวรอบตัว', icon: 'sk_im_aura', max: 5, pass: () => ({}), desc: (lv) => `ศัตรูที่อยู่ใกล้เราในระยะ 200 ช้าลง (${lv * 3}% ของเวลา เย็นเฉียบ 1 ชั้นทุก ${6 - lv} วิ)` }),
    im_zero: S({ name: 'ศูนย์สัมบูรณ์', icon: 'sk_am_absolutezero', max: 5, pass: (lv) => ({ iceStack: 1, freezeT: lv >= 3 ? 1 : 0 }),
      desc: (lv) => `เย็นเฉียบครบ 3 ชั้นแข็งเสมอ${lv >= 3 ? ' · แข็งนานขึ้น 1 วิ' : ''}${lv >= 5 ? ' · บอสสะสมเย็นได้ ครบ 5 ครั้งบอสแข็ง 1.5 วิ (ทุก 20 วิ)' : ''}` }),
    im_shatter: S({ name: 'ทุบน้ำแข็ง', icon: 'sk_im_shatter', free: 1, type: 'magic', element: 'water', mul: (lv) => 0.6 + lv * 0.08, pass: () => ({}),
      desc: (lv) => `สกิลโดนตัวที่แข็งอยู่ มันแตกกระจาย ดาเมจเพิ่ม ${Math.round((0.6 + lv * 0.08) * 100)}% ของ MATK เศษน้ำแข็ง ${lv >= 5 ? 6 : 4} ชิ้นกระเด็นไปแช่ตัวข้าง ๆ${lv >= 10 ? ' · ตัวที่โดนเศษจนแข็งแตกต่อเป็นลูกโซ่' : ''}` }),
    im_breath: S({ name: 'ลมหายใจเยือกแข็ง', icon: 'sk_im_breath', type: 'magic', element: 'water', cd: 6, sp: () => 20, mul: (lv) => (0.6 + lv * 0.08) / 2,
      desc: (lv) => `พ่นลมหนาวเป็นกรวย 2 วิ วิละ ${Math.round((0.6 + lv * 0.08) * 100)}% ของ MATK เย็นเฉียบ 2 ชั้นต่อวิ` }),
    im_burst: S({ name: 'ผลึกระเบิด', icon: 'sk_im_burst', type: 'magic', element: 'water', cd: 12, sp: () => 30, mul: (lv) => 2 + lv * 0.3,
      desc: (lv, m) => `ทุบทุกตัวที่แข็งอยู่ในจอให้แตกพร้อมกัน ตัวละ ${m}% ของ MATK${lv >= 10 ? ' · ฆ่าได้คืน SP 5 ต่อตัว' : ''}` }),
    im_armor: S({ name: 'เกราะน้ำแข็ง', icon: 'sk_im_armor', kind: 'buff', cd: 20, sp: () => 35, rgb: ICE, dur: () => 60, buff: () => ({}),
      desc: (lv) => `60 วิ: เกราะดูดซับดาเมจ ${150 + lv * 25}% ของ MATK คนที่ตีเราประชิดติดเย็นเฉียบ · ถือโล่: เกราะหนาขึ้น 40%${lv >= 5 ? ' · เกราะแตกแล้วระเบิดแช่รอบตัว' : ''}${lv >= 10 ? ' · เกราะฟื้นเองทุก 20 วิ' : ''}` }),
    im_wall: S({ name: 'กำแพงน้ำแข็ง', icon: 'sk_im_wall', cd: 10, sp: () => 25, mul: () => 0,
      desc: (lv) => `กำแพงน้ำแข็งยาว 300 นาน ${r1(6 + lv / 2)} วิ ขวางศัตรูไม่ให้ผ่าน${lv >= 10 ? ' · กำแพงแตกแล้วเศษแช่ศัตรูรอบ ๆ' : ''}` }),
    im_winter: S({ name: 'ใจเหมันต์', icon: 'sk_im_winter', pass: (lv, p) => (wt(p) === 'orb' ? { def: lv * 2, mdef: lv, matk: lv * 6 } : null),
      desc: (lv) => `ถือออร์บ: DEF +${lv * 2} MDEF +${lv} ตีปกติเป็นเกล็ดน้ำแข็ง MATK +${lv * 6}% เย็นเฉียบ 5%` }),
    im_iceage: S({ name: 'ยุคน้ำแข็ง', icon: 'sk_im_iceage', ult: true, max: 5, type: 'magic', element: 'water', castT: 1.5, cd: 90, sp: () => 90, mul: (lv) => 0.8 + lv * 0.2,
      desc: (lv, m) => `ทั้งจอหนาวจัด 8 วิ ศัตรูทุกตัวเย็นเฉียบทุกวิ (${m}% ของ MATK) ตัวที่แข็งแตกกระจายเองทุก 2 วิ เราได้เกราะน้ำแข็งฟรี` }),
  });

  // the icemage's looks, apart so that the online client draws the server's with them (js/online-ice.js)
  const LOOK = {
    shatter(game, e, depth) {
      V.debris(e.x, e.y - 40, 14, V.PAL.ice, { size: 1, max: 480, layer: 'glow' });
      V.ring(e.x, e.y, 10, 130, 10, ICE, 0.35);
      V.glowAt(e.x, e.y - 50, 20, 130, ICE, 0.9, 0.3, { hot: true });
      FX.text(e.x, NC.labelTop(e) - 90, depth ? 'แตกต่อ!' : 'แตก!', '#bfe8ff', 30);
      V.shake(game, 3);
    },
    // a shard from the broken e to f: it passes through the others (e, which it starts inside, first of all) and ends
    // on the one it is for
    shard(game, p, e, f, onHit) {
      K.shot(game, p, 'im_shatter', { from: [e.x, e.y - 50], ang: NC.angle(e.x, e.y - 50, f.x, f.y - 45), v: 900, range: 400, r: 30, home: 12, target: f, rgb: ICE, size: 0.6, pierce: true,
        look(ctx, q) { K.drawBlade(ctx, q.x, q.y, Math.atan2(q.vy, q.vx), 26, 7, '#dff4ff', ICE); },
        hit(g, q) { if (g !== f) return; q.dead = true; if (onHit) onHit(g); } });
    },
    soak(x, y, soak) { FX.num(x, y - 140, 'ดูดซับ ' + Math.round(soak), { fill: '#bfe8ff', size: 24 }); V.sparks(x, y - 60, 5, ICE, { size: 0.6 }); },
    armorBreak(x, y) { V.debris(x, y - 60, 16, V.PAL.ice, { size: 1, max: 500, layer: 'glow' }); },
    aura(x, y) { V.ring(x, y, 20, 200, 6, ICE, 0.35); },
    regrow(x, y) { V.ring(x, y, 10, 120, 8, ICE, 0.35); },
    plate: icePlate,
  };
  NC.IceLooks = LOOK;
  // shatter one frozen monster (depth: the chain's step); online the server breaks them and sends each one's look
  function shatter(game, p, e, depth) {
    if (game.presentationOnly || !alive(e) || !(e.frozen > 0)) return;
    const lv = lvOf(p, 'im_shatter');
    e.frozen = 0;
    LOOK.shatter(game, e, depth);
    K.hit(game, p, 'im_shatter', e, 0, 0, '190,235,255', depth ? 0.6 : 1);
    if (!lv) return;
    const n = lv >= 5 ? 6 : 4;
    for (const f of others(game, e, 300, n)) {
      const wasFrozen = f.frozen > 0;
      LOOK.shard(game, p, e, f, (g) => {
        NC.addStatus(game, g, 'chill');
        if (lv >= 10 && depth < 3 && (wasFrozen || g.frozen > 0)) V.at(0.05, () => shatter(game, p, g, depth + 1));
      });
    }
  }
  NC.iceShatter = shatter;
  // a skill hit on a frozen monster: it shatters (the shards and the ultimate's own breaks don't set it off again)
  const baseDmg = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    const p = game && game.player, frozen = e && e.frozen > 0;
    baseDmg.apply(this, arguments);
    if (!frozen || !r || r.miss || !r.skill || !isIceMage(p) || !lvOf(p, 'im_shatter')) return;
    if (r.sid === 'im_shatter' || r.sid === 'im_burst' || r.sid === 'im_iceage') return;
    V.at(0, () => shatter(game, p, e, 0));
  };
  // the lance: frozen ones take double
  const baseHH2 = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHH2.apply(this, arguments);
    if (o && o.sid === 'im_lance' && e.frozen > 0 && r.dmg > 0) r.dmg = Math.round(r.dmg * 2);
    return r;
  };

  RUN.im_blizzard = function (game, p, lv) {
    castPose(game, p, 0.35);
    const [tx, ty] = K.ground(game, p, 480), R = 200 * (NC.weaponBonus && NC.weaponBonus(p, 'im_blizzard') ? 1.3 : 1);
    const hunt = lv >= 10 ? K.target(game, p, 700, 300) : null;
    let acc = 0;
    const z = { x: tx, y: ty };
    FX.add({ type: 'timer', layer: 'none', life: 5, x: tx, y: ty, update(q, dt) {
      if (hunt && alive(hunt)) { z.x += Math.sign(hunt.x - z.x) * Math.min(Math.abs(hunt.x - z.x), 90 * dt); z.y += Math.sign(hunt.y - z.y) * Math.min(Math.abs(hunt.y - z.y), 60 * dt); }
      for (let i = 0; i < 2; i++) if (Math.random() < dt * 24) {
        const a = rand(0, TAU), d = Math.sqrt(Math.random()) * R, x = z.x + Math.cos(a) * d, y = z.y + Math.sin(a) * d * V.SQ;
        FX.add({ type: 'shard', x: x + 120, y: y - 520, vx: -300, vy: 1300, life: 0.4 });
        if (Math.random() < 0.3) V.smoke(x, y - 10, 1, '#e6f6ff', '#ffffff', { size: 0.6, lifeK: 0.6, a: 0.7 });
      }
      if (Math.random() < dt * 30) FX.add({ type: 'vstreak', x: z.x + rand(-R, R), y: z.y - rand(40, 200), vx: -500, vy: 120, len: rand(40, 80), w: 2, rgb: '230,245,255', life: 0.3 });
      if ((acc += dt) >= 1) {
        acc -= 1;
        V.circle(z.x, z.y, R, ICE, 1, { style: 'arcane', spin: 1, a: 0.5 });
        for (const e of K.around(game, z.x, z.y, R)) { K.hit(game, p, 'im_blizzard', e, 0, 0, '170,225,255'); K.slow(e, 1.2); }
      }
    } });
    V.circle(tx, ty, R, ICE, 5, { style: 'arcane', spin: 1, grow: true, a: 0.6 });
    V.decal(tx, ty, R, 'frost', 5.5);
    V.light(tx, ty - 40, R * 2.2, ICE, 0.7, 5);
  };
  RUN.im_lance = function (game, p, lv) {
    castPose(game, p, 0.3);
    const ang = p.aim, from = [p.x + Math.cos(ang) * 40, p.y - 70];
    K.shot(game, p, 'im_lance', { from, ang, v: 1500, range: 900, r: 44, pierce: true, rgb: ICE,
      look(ctx, q) { K.drawBlade(ctx, q.x, q.y, Math.atan2(q.vy, q.vx), 120, 18, '#dff4ff', ICE); },
      trail(q) { if (Math.random() < 0.6) V.sparks(q.x, q.y, 2, ICE, { size: 0.5 }); },
      hit(e) { K.hit(game, p, 'im_lance', e, Math.cos(ang) * 200, Math.sin(ang) * 140, '190,235,255'); V.debris(e.x, e.y - 40, 6, V.PAL.ice, { size: 0.7, max: 300, layer: 'glow' }); } });
    V.shake(game, 3);
  };
  RUN.im_breath = function (game, p, lv) {
    castPose(game, p, 2);
    let acc = 0.5, n = 0;
    V.light(p.x, p.y - 60, 420, ICE, 0.9, 2, { follow: p });
    K.channel(game, p, 2, (ch, dt) => {
      const a = p.aim, hx = p.x + Math.cos(a) * 50, hy = p.y - 70;
      for (let i = 0; i < 3; i++) { const b = a + rand(-0.45, 0.45), sp = rand(420, 640); V.smoke(hx, hy + 20, 1, '#e6f6ff', '#ffffff', { size: 0.7, lifeK: 0.5, vx: Math.cos(b) * sp, vy: Math.sin(b) * sp * 0.7, a: 0.8 }); }
      if (Math.random() < 0.5) FX.add({ type: 'vstreak', x: hx, y: hy, vx: Math.cos(a) * 900, vy: Math.sin(a) * 600, len: 60, w: 3, rgb: '220,240,255', life: 0.3 });
      if ((acc += dt) >= 0.5 && n < 4) {
        acc -= 0.5; n++;
        K.cone(game, p, 'im_breath', 330, 0.55, { color: '190,235,255', each(e, r) { if (r && !r.miss) NC.addStatus(game, e, 'chill'); } });
      }
    });
  };
  RUN.im_burst = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.3);
    const frozen = game.enemies.filter((e) => alive(e) && e.frozen > 0 && NC.dist(e.x, e.y, p.x, p.y) < 1100);
    V.flash('200,235,255', 0.1, 0.25);
    frozen.forEach((e, i) => V.at(i * 0.05, () => {
      if (!alive(e)) return;
      V.beam(e.x, e.y, 60, 360, ICE, 0.3);
      const r = K.hit(game, p, 'im_burst', e, 0, -100, '190,235,255');
      shatter(game, p, e, 0);
      if (lv >= 10 && !alive(e)) p.sp = Math.min(p.maxSp, p.sp + 5);
      void r;
    }));
    if (!frozen.length) FX.text(p.x, p.y - 200, 'ไม่มีศัตรูที่แข็งอยู่', '#bfe8ff', 26);
  };
  // ice armour: soaks damage; attackers in reach get chilled
  const armorMax = (p, lv) => Math.round(((p.d.matk[0] + p.d.matk[1]) / 2) * (1.5 + lv * 0.25) * (NC.weaponLoadout && NC.weaponLoadout(p).sh ? 1.4 : 1));
  RUN.im_armor = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.3);
    K.startBuff(game, p, 'im_armor', lv);
    p.iceArmor = armorMax(p, lv); p.iceArmorLv = lv; p.iceArmorRe = game.time + 20;
    if (iceShell(game, p)) ensureOrbit();
    K.buffFx(game, p, ICE, { style: 'arcane', r: 120 });
    FX.text(p.x, p.y - 200, 'เกราะน้ำแข็ง ' + p.iceArmor, '#bfe8ff', 28);
  };
  NC.heroGuards.push((game, p, dmg, attacker) => {
    if (!on(p, 'im_armor') || !(p.iceArmor > 0)) return dmg;
    const soak = Math.min(p.iceArmor, dmg);
    p.iceArmor -= soak;
    LOOK.soak(p.x, p.y, soak);
    if (attacker && alive(attacker) && NC.dist(attacker.x, attacker.y, p.x, p.y) < 220) NC.addStatus(game, attacker, 'chill');
    if (p.iceArmor <= 0) {
      LOOK.armorBreak(p.x, p.y);
      if ((p.iceArmorLv || 0) >= 5) for (const e of K.around(game, p.x, p.y, 220)) { NC.addStatus(game, e, 'chill'); NC.addStatus(game, e, 'chill'); NC.addStatus(game, e, 'chill'); }
    }
    return dmg - soak;
  });
  RUN.im_wall = function (game, p, lv) {
    castPose(game, p, 0.3);
    const [cx, cy] = K.ground(game, p, 300), a = p.aim + Math.PI / 2, half = 150, dur = 6 + lv / 2;
    const ax = Math.cos(a), ay = Math.sin(a) * V.SQ, nx = -ay, ny = ax;
    const wall = FX.add({ type: 'j3wall', layer: 'high', life: dur, x: cx, y: cy, ax, ay, half,
      update(q, dt) {
        for (const e of game.enemies) {
          if (!alive(e)) continue;
          const dx = e.x - cx, dy = e.y - cy, along = dx * ax + dy * ay;
          if (Math.abs(along) > half + e.r) continue;
          const side = dx * nx + dy * ny, gap = 26 + e.r;
          if (Math.abs(side) < gap) { const s = Math.sign(side) || 1, push = gap - Math.abs(side); e.x += nx * s * push; e.y += ny * s * push; }
        }
      },
      onEnd() {
        V.debris(cx, cy - 40, 20, V.PAL.ice, { size: 1, max: 500, layer: 'glow' });
        if (lv >= 10) for (const e of K.around(game, cx, cy, 220)) { NC.addStatus(game, e, 'chill'); NC.addStatus(game, e, 'chill'); }
      } });
    V.shake(game, 4);
    for (let i = -3; i <= 3; i++) V.sparks(cx + ax * i * 45, cy + ay * i * 45 - 40, 4, ICE, { size: 0.7 });
    void wall;
  };
  FX.def('j3wall', (ctx, q, u) => {
    const a = Math.min(1, q.t / 0.15) * (u > 0.9 ? 1 - (u - 0.9) / 0.1 : 1);
    ctx.save(); ctx.globalAlpha *= a;
    for (let i = -4; i <= 4; i++) {
      const x = q.x + q.ax * i * 36, y = q.y + q.ay * i * 36, h = 110 + ((i * 37) % 3) * 16 - Math.abs(i) * 8;
      ctx.beginPath(); ctx.moveTo(x - 22, y); ctx.lineTo(x - 14, y - h * 0.7); ctx.lineTo(x, y - h); ctx.lineTo(x + 16, y - h * 0.65); ctx.lineTo(x + 22, y); ctx.closePath();
      ctx.fillStyle = 'rgba(190,230,255,0.82)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#2a2d4a'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 6, y - 10); ctx.lineTo(x - 2, y - h * 0.8); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
    V.glow(ctx, q.x, q.y - 60, 180, ICE, 0.25 * a, true);
  }, 'high');
  RUN.im_iceage = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.5);
    V.flash('200,235,255', 0.2, 0.5);
    shout(p, 'ยุคน้ำแข็ง!', '#bfe8ff');
    // our free armour
    const al = Math.max(1, lvOf(p, 'im_armor'));
    K.startBuff(game, p, 'im_armor', al);
    p.iceArmor = Math.max(p.iceArmor || 0, armorMax(p, al)); p.iceArmorLv = al;
    if (iceShell(game, p)) ensureOrbit();
    V.decal(p.x, p.y, 520, 'frost', 8);
    K.buffFriends(game, p, { dur: 8, guard: 0.8, rgb: ICE });
    let acc = 0, n = 0;
    FX.add({ type: 'timer', layer: 'none', life: 8, x: p.x, y: p.y, update(q, dt) {
      for (let i = 0; i < 4; i++) if (Math.random() < dt * 30) FX.add({ type: 'shard', x: p.x + rand(-900, 900) + 120, y: p.y + rand(-500, 400) - 520, vx: -300, vy: 1300, life: 0.4 });
      if (Math.random() < dt * 12) V.smoke(p.x + rand(-700, 700), p.y + rand(-300, 300), 1, '#e6f6ff', '#ffffff', { size: 1.4, lifeK: 1, a: 0.5 });
      if ((acc += dt) >= 1) {
        acc -= 1; n++;
        V.ring(p.x, p.y, 40, 900, 14, ICE, 0.7);
        V.flash('190,230,255', 0.05, 0.3);
        const all = game.enemies.filter((e) => alive(e) && NC.dist(e.x, e.y, p.x, p.y) < 1000);
        for (const e of all) V.sparks(e.x, e.y - 50, 4, ICE, { size: 0.6 });
        for (const e of all) { K.hit(game, p, 'im_iceage', e, 0, 0, '190,235,255'); NC.addStatus(game, e, 'chill'); }
        if (n % 2 === 0) all.filter((e) => e.frozen > 0).forEach((e, i) => V.at(i * 0.04, () => shatter(game, p, e, 1)));
      }
    } });
    V.light(p.x, p.y - 60, 1400, ICE, 0.6, 8, { follow: p });
  };
  // the chill aura, the boss chill of ศูนย์สัมบูรณ์ Lv 5, the armour coming back (Lv 10)
  NC.skillTicks.push((game, p, dt) => {
    if (!isIceMage(p)) return;
    const au = lvOf(p, 'im_aura');
    if (au) {
      p.imAuraT = (p.imAuraT || 0) + dt;
      for (const e of K.around(game, p.x, p.y, 200)) K.slow(e, 0.2);
      if (p.imAuraT >= 6 - au) { p.imAuraT = 0; for (const e of K.around(game, p.x, p.y, 200)) NC.addStatus(game, e, 'chill'); LOOK.aura(p.x, p.y); }
    }
    if (on(p, 'im_armor') && (p.iceArmorLv || 0) >= 10 && game.time > (p.iceArmorRe || 0)) { p.iceArmorRe = game.time + 20; p.iceArmor = armorMax(p, p.iceArmorLv); LOOK.regrow(p.x, p.y); }
    if (!on(p, 'im_armor')) p.iceArmor = 0;
  });
  NC.basicHits.push((game, p, e, r) => {
    if (!game || p !== game.player || !(r.dmg > 0) || !isIceMage(p)) return;
    if (wt(p) === 'orb' && lvOf(p, 'im_winter') && roll(5)) NC.addStatus(game, e, 'chill');
  });
  // bosses shrug statuses off; with ศูนย์สัมบูรณ์ Lv 5 five cold hits freeze one anyway (every 20 s)
  const baseHH3 = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHH3.apply(this, arguments), G = NC.game, p = G && G.player;
    if (p && d === p.d && isIceMage(p) && r.dmg > 0 && isBoss(e) && lvOf(p, 'im_zero') >= 5 && (o.element || d.atkElement) === 'water') {
      e._bchill = (e._bchill || 0) + 1;
      if (e._bchill >= 5 && G.time > (e._bfreezeT || 0)) { e._bchill = 0; e._bfreezeT = G.time + 20; e.frozen = 1.5; FX.text(e.x, NC.labelTop(e) - 90, 'แข็ง!', '#bfe8ff', 34); }
    }
    return r;
  };

  // =====================================================================================================
  // lines, the skill list, the weapon rules
  // =====================================================================================================
  const LINES = {
    swordmaster: [['twin', 'เพลงดาบคู่', 'neutral', 'berserk', 1], ['will', 'เจตจำนงนักดาบ', 'neutral', 'sword', 0], ['spell', 'ดาบเวท', 'multi', 'sword', 0], ['iai', 'ท่าชักดาบ', 'neutral', 'sword', 0]],
    firemage: [['inferno', 'นรกเพลิง', 'fire', 'fire', 0], ['heat', 'ความร้อน', 'fire', null, 0], ['orb', 'ลูกไฟรัว', 'fire', 'quick', 1], ['meteor', 'อุกกาบาตถล่ม', 'fire', null, 0]],
    icemage: [['glacier', 'ธารน้ำแข็ง', 'water', 'ice', 0], ['shatter', 'แตกกระจาย', 'water', null, 0], ['bastion', 'ปราการน้ำแข็ง', 'water', 'quick', 1], ['iceage', 'ยุคน้ำแข็ง', 'water', null, 0]],
  };
  // [id, line, top level, free levels, needs, how it grows]
  const PLAN = {
    swordmaster: [
      ['sm_twin', 'twin', 10, 0, [['kn_quicken', 3]], 'Lv5 รอยที่ครบ 3 วิระเบิดเอง 45% · Lv10 ทุกครั้งที่ 4 ทิ้ง 2 รอย'],
      ['sm_moondance', 'twin', 10, 0, [['sm_twin', 3]], 'Lv5 เปลี่ยนเป้าแล้วชั้นไม่หาย · Lv10 ครบ 10 ชั้นคริ +10'],
      ['sm_bladerain', 'twin', 10, 1, [], 'Lv5 เดินได้ระหว่างฟัน · Lv10 ครั้งสุดท้ายดึงรอยดาบทั้งหมดมาระเบิดที่เป้า'],
      ['sm_thousand', 'twin', 5, 0, [['sm_moondance', 5], ['sm_bladerain', 5]], 'Lv5 เงาดาบแรงขึ้นทุกเลเวล'],
      ['sm_duel', 'will', 5, 0, [], 'Lv5 ดาเมจใส่คู่ดวล +20%'],
      ['sm_eye', 'will', 10, 0, [['kn_swordmastery', 3]], 'Lv10 ดาเมจคริ +20%'],
      ['sm_enchant', 'spell', 10, 0, [], 'Lv5 สลับธาตุแล้วครั้งแรกเกิดปฏิกิริยา · Lv10 ใส่ได้ 2 ธาตุพร้อมกัน'],
      ['sm_wave', 'spell', 10, 1, [], 'Lv5 คลื่นทะลุ · Lv10 ปล่อย 3 คลื่นเป็นพัด'],
      ['sm_float', 'spell', 10, 0, [['sm_wave', 3], ['sm_enchant', 3]], 'จำนวนเล่มเพิ่มทุก 4 เลเวล (2 → 4)'],
      ['sm_heart', 'spell', 5, 0, [['sm_enchant', 5]], 'Lv1 ATK กับ MATK ยืมกันและกัน 20% · Lv3 รอยดาบระเบิดเป็นธาตุ · Lv5 ชักดาบแล้วดาบเวทลอยทุกเล่มพุ่งพร้อมกัน'],
      ['sm_iai', 'iai', 10, 0, [['sm_wave', 1]], 'Lv5 ชาร์จเต็มทะลุทุกตัว · Lv10 ฆ่าได้คืนคูลดาวน์ครึ่งหนึ่ง'],
      ['sm_focus', 'iai', 5, 0, [['sm_iai', 3]], 'Lv1 ไม่ได้ตี 2 วิ ชักดาบครั้งถัดไปคริแน่นอน · Lv3 ชาร์จเร็วขึ้น 30% · Lv5 รอยดาบจากท่าชักดาบแรง ×1.5'],
    ],
    firemage: [
      ['fm_pillar', 'inferno', 10, 1, [], 'Lv5 ตัวที่เผาอยู่โดนเพิ่ม 20% · Lv10 ทิ้งพื้นไฟ 3 วิ'],
      ['fm_sea', 'inferno', 10, 0, [['fm_pillar', 3]], 'Lv5 ศัตรูในทะเลเพลิงช้าลง · Lv10 ไฟลามตามตัวที่หนี'],
      ['fm_ring', 'inferno', 10, 0, [['mg_firewall', 3]], 'Lv5 วงแหวนขยายออกเรื่อย ๆ · Lv10 วงแหวน 2 ชั้น'],
      ['fm_master', 'inferno', 5, 0, [['mg_fireheart', 5]], 'Lv1 เผาซ้อน 8 ชั้น · Lv3 ระบายแล้ว 5 วิไม่โดนเผา · Lv5 เผาครบ 8 ชั้นระเบิดเอง'],
      ['fm_gauge', 'heat', 10, 1, [], 'Lv5 ความร้อนลดช้าลงครึ่งหนึ่ง · Lv10 ที่ 100 ความร้อน ร่ายไฟไม่ใช้ SP'],
      ['fm_vent', 'heat', 10, 0, [['fm_gauge', 2]], 'Lv5 ที่ 100 ความร้อนทิ้งวงไฟ 4 วิ · Lv10 ระบายแล้วร่ายเร็วขึ้น 30% 5 วิ'],
      ['fm_forge', 'heat', 10, 0, [], '-'],
      ['fm_orbfire', 'orb', 10, 0, [['mg_staffmastery', 1]], 'ถือออร์บเท่านั้น'],
      ['fm_spread', 'orb', 10, 0, [['fm_orbfire', 3]], 'Lv5 กระโดด 2 ตัว · Lv10 3 ตัว'],
      ['fm_seek', 'orb', 5, 0, [['fm_orbfire', 5]], 'Lv5 ลูกเล็กแรงขึ้น'],
      ['fm_meteor', 'meteor', 5, 0, ['|', ['fm_sea', 5], ['fm_vent', 5]], 'ร่ายตอนความร้อน 100 ได้ลูกยักษ์'],
    ],
    icemage: [
      ['im_blizzard', 'glacier', 10, 1, [], 'Lv5 เดินได้ระหว่างพายุ · Lv10 พายุตามเป้าหมาย'],
      ['im_lance', 'glacier', 10, 0, [['frostdiver', 5]], 'ตัวที่แข็งโดนสองเท่า'],
      ['im_aura', 'glacier', 5, 0, [], '-'],
      ['im_zero', 'glacier', 5, 0, [['mg_iceheart', 3]], 'Lv1 เย็นเฉียบครบ 3 ชั้นแข็งเสมอ · Lv3 แข็งนานขึ้น 1 วิ · Lv5 บอสแข็งได้'],
      ['im_shatter', 'shatter', 10, 1, [], 'Lv5 เศษ 6 ชิ้น · Lv10 แตกต่อเป็นลูกโซ่'],
      ['im_breath', 'shatter', 10, 0, [['im_shatter', 2]], '-'],
      ['im_burst', 'shatter', 10, 0, [['im_shatter', 5]], 'Lv10 ฆ่าได้คืน SP 5 ต่อตัว'],
      ['im_armor', 'bastion', 10, 0, [], 'Lv5 เกราะแตกแล้วระเบิดแช่รอบตัว · Lv10 เกราะฟื้นเองทุก 20 วิ'],
      ['im_wall', 'bastion', 10, 0, [['im_armor', 3]], 'Lv10 กำแพงแตกแล้วเศษแช่ศัตรูรอบ ๆ'],
      ['im_winter', 'bastion', 10, 0, [['mg_staffmastery', 1]], 'ถือออร์บเท่านั้น'],
      ['im_iceage', 'iceage', 5, 0, ['|', ['im_burst', 5], ['im_armor', 5]], 'ทั้งจอหนาวจัด 8 วิ'],
    ],
  };
  for (const job in PLAN) {
    const J = NC.JOBS[job];
    if (!J) continue;
    J.lines = LINES[job].map(([id, name, el, parent, auto]) => ({ id, name, el, parent: parent || null, auto: !!auto }));
    J.skills = PLAN[job].map((r) => r[0]);
    for (const [id, line, max, free, req, grow] of PLAN[job]) {
      const Sk = SK[id];
      if (!Sk) { console.warn('jobs3: no skill', id); continue; }
      Sk.line = line; Sk.max = max; Sk.free = free; Sk.grow = grow;
      const any = req[0] === '|';
      Sk.req = any ? req.slice(1) : req;
      Sk.reqAny = any;
    }
  }
  if (NC.weaponRule) {
    const R = NC.weaponRule;
    for (const id of ['sm_twin', 'sm_moondance', 'sm_bladerain', 'sm_thousand']) R(id, 'n:dsword');
    R('sm_eye', 'n:dsword,sword,gsword');
    for (const id of ['sm_enchant', 'sm_wave', 'sm_float', 'sm_heart', 'sm_focus']) R(id, 'n:sword');
    R('sm_iai', 'n:sword b:free', { k: 1.2, note: 'แรงขึ้น 20%' });
    R('fm_pillar', 'b:staff', { note: 'ปะทุ 4 ครั้ง' });
    R('fm_sea', 'b:staff', { cast: 0.85, note: 'ร่ายเร็วขึ้น 15%' });
    for (const id of ['fm_orbfire', 'fm_spread', 'fm_seek']) R(id, 'n:orb');
    R('im_blizzard', 'b:staff', { note: 'วงใหญ่ขึ้น 30%' });
    R('im_lance', 'b:staff', { k: 1.1, note: 'แรงขึ้น 10%' });
    R('im_armor', 'b:shield', { note: 'เกราะหนาขึ้น 40%' });
    R('im_winter', 'n:orb');
  }
  // the ice mage's lane: orb + shield (weapons.js's job weapons: the mage's staff and orb; no new type)
})();
