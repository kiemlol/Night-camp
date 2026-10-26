/* class2_skills_c.js — the priest's two 2nd jobs, ten skills each (the priest's own stay too):
     บิชอป   วงแสงเยียวยา · ม่านแสงคุ้มภัย (บัฟ) · ลานแสงเยียวยา · ปาฏิหาริย์ (อัลติ) · บทสวดฟื้นมานา (บัฟ) · มือประทานพลัง (บัฟ) ·
             สมาธิภาวนา · ขับไล่อมตะ · ปีกแสงคุ้มกาย (บัฟ) · ตราแสงตรึง                      -> heals, shields, party buffs
     นักพรต   ปล่อยพลังปราณ · กายเหล็ก (บัฟ) · ฝ่ามือร้อยทิศ · หมัดสิ้นปราณ (อัลติ) · ลูกปราณ · หมัดเหล็ก · ชุดหมัดพายุ ·
             ก้าวไร้เงา · ก้าวกระโดด · ฝ่ามือทะลวงปราณ                                     -> spirit spheres and fists
   The monk's spheres (p.spheres, up to the skill's level): each gives ATK +3%, some skills spend them for more power.
   Built with skillkit.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, SK = NC.SKILLS;
  const { C, P, TAU } = K;
  const rand = NC.rand, S = K.S;
  const r1 = (v) => Math.round(v * 10) / 10;

  NC.JOBS.bishop.skills = ['bi_heal', 'bi_barrier', 'bi_sanctuary', 'bi_miracle', 'bi_magnificat', 'bi_impositio', 'bi_meditatio', 'bi_turnundead', 'bi_assumptio', 'bi_lexdivina'];
  NC.JOBS.monk.skills = ['mo_chi', 'mo_ironbody', 'mo_palms', 'mo_asura', 'mo_spheres', 'mo_ironfist', 'mo_combo', 'mo_dodge', 'mo_snap', 'mo_impact'];

  const HOLY = C.holy, GREEN = '150,255,170', SKY = '160,215,255', CHI = '90,235,215', GOLD = C.gold;

  K.def({
    // ======== bishop ========
    bi_heal: S({ name: 'วงแสงเยียวยา', icon: 'sk_bi_heal', free: 1, type: 'magic', element: 'holy', cd: 4, sp: (lv) => 16 + lv * 2, mul: (lv) => 1.4 + lv * 0.2,
      heal: (lv) => 14 + lv * 1.6, desc: (lv, m) => `วงแสงรักษาตัวเองและเพื่อนรอบตัว ${r1(14 + lv * 1.6)}% ของ HP สูงสุด + ตามพลังเวท · ศัตรูรอบตัวโดนแสง ${m}% ของ MATK` }),
    bi_barrier: S({ name: 'ม่านแสงคุ้มภัย', icon: 'sk_bi_barrier', kind: 'buff', req: [['blessing', 5]], cd: 20, sp: (lv) => 24 + lv * 2, rgb: GOLD,
      dur: () => 20, buff: () => ({}), soak: (lv) => 12 + lv * 2,
      desc: (lv) => `บาเรียทอง 20 วิ ดูดซับดาเมจได้ ${12 + lv * 2}% ของ HP สูงสุด + MATK x2 (เพื่อนรอบตัวรับดาเมจลดลง 15%)` }),
    bi_sanctuary: S({ name: 'ลานแสงเยียวยา', icon: 'sk_bi_sanctuary', type: 'magic', element: 'holy', req: [['bi_heal', 3]], cd: 16, sp: (lv) => 30 + lv * 2,
      mul: (lv) => 0.5 + lv * 0.07, heal: (lv) => 3 + lv * 0.3,
      desc: (lv, m) => `เขตศักดิ์สิทธิ์ที่เมาส์ 8 วิ ทุก 0.5 วิ ฟื้น HP พวกเรา ${r1(3 + lv * 0.3)}% และแสงเผาศัตรู ${m}% ของ MATK` }),
    bi_miracle: S({ name: 'ปาฏิหาริย์', icon: 'sk_bi_miracle', ult: true, type: 'magic', element: 'holy', req: [['bi_sanctuary', 5]], cd: 60, sp: (lv) => 60 + lv * 4,
      mul: (lv) => 4.5 + lv * 0.6, desc: (lv, m) => `ตะวันแสงศักดิ์สิทธิ์: ฟื้น HP ทุกคน 60% ชุบเพื่อนที่หมดแรง แสงพิพากษาศัตรูรอบตัว ${m}% ของ MATK และอวยพร ATK/MATK +15% 20 วิ` }),
    bi_magnificat: S({ name: 'บทสวดฟื้นมานา', icon: 'sk_bi_magnificat', kind: 'buff', req: [['bi_meditatio', 3]], cd: 60, sp: () => 40, rgb: SKY,
      dur: (lv) => 30 + lv * 5, buff: (lv) => ({ spReg: 100, spPct: lv }), party: () => ({}),
      desc: (lv) => `เพลงสรรเสริญ ${30 + lv * 5} วิ: ฟื้น SP เร็วขึ้น 2 เท่า SP สูงสุด +${lv}%` }),
    bi_impositio: S({ name: 'มือประทานพลัง', icon: 'sk_bi_impositio', kind: 'buff', req: [['blessing', 3]], cd: 40, sp: (lv) => 20 + lv * 2, rgb: GOLD,
      dur: () => 60, buff: (lv) => ({ batk: lv * 5 }), party: (lv) => ({ atk: 1 + lv * 0.02 }),
      desc: (lv) => `60 วิ: ATK +${lv * 5} (เพื่อนรอบตัวตีแรงขึ้น ${lv * 2}%)` }),
    bi_meditatio: S({ name: 'สมาธิภาวนา', icon: 'sk_bi_meditatio', pass: (lv) => ({ heal: lv * 3, spReg: lv * 3, spPct: lv }),
      desc: (lv) => `พลังฮีล +${lv * 3}% · ฟื้น SP +${lv * 3}% · SP สูงสุด +${lv}%` }),
    bi_turnundead: S({ name: 'ขับไล่อมตะ', icon: 'sk_bi_turnundead', type: 'magic', element: 'holy', req: [['holylight', 5]], cd: 5, sp: (lv) => 20 + lv,
      mul: (lv) => 3 + lv * 0.5, desc: (lv, m) => `ลำแสงศักดิ์สิทธิ์ขับไล่ศัตรูใกล้เมาส์ ${m}% ของ MATK (อมตะและความมืดโดน x2)` }),
    bi_assumptio: S({ name: 'ปีกแสงคุ้มกาย', icon: 'sk_bi_assumptio', kind: 'buff', req: [['bi_barrier', 5]], cd: 60, sp: () => 50, rgb: HOLY,
      dur: (lv) => 20 + lv * 2, buff: (lv) => ({ taken: 20 + lv * 2 }), party: (lv) => ({ guard: 1 - (0.2 + lv * 0.02) }),
      desc: (lv) => `ปีกทองโอบทั้งทีม ${20 + lv * 2} วิ: ตัวเองและเพื่อนรอบตัวรับดาเมจลดลง ${20 + lv * 2}%` }),
    bi_lexdivina: S({ name: 'ตราแสงตรึง', icon: 'sk_bi_lexdivina', type: 'magic', element: 'holy', req: [['bi_turnundead', 3]], cd: 10, sp: (lv) => 18 + lv,
      mul: (lv) => 0.5 + lv * 0.1, hold: (lv) => 2 + lv * 0.3, desc: (lv, m) => `ตราศักดิ์สิทธิ์ที่เมาส์ ${m}% ของ MATK ตรึงศัตรู ${r1(2 + lv * 0.3)} วิ` }),

    // ======== monk ========
    mo_chi: S({ name: 'ปล่อยพลังปราณ', icon: 'sk_mo_chi', free: 1, cd: 3, sp: (lv) => 10 + lv, mul: (lv) => 2.2 + lv * 0.3,
      desc: (lv, m) => `คลื่นปราณพุ่งทะลุทั้งแนว ${m}% ของ ATK · มีลูกปราณ: ใช้ 1 ลูก แรงขึ้น 50%` }),
    mo_ironbody: S({ name: 'กายเหล็ก', icon: 'sk_mo_ironbody', kind: 'buff', req: [['mo_ironfist', 3]], cd: 25, sp: (lv) => 20 + lv, rgb: '255,200,110', circle: 'star',
      dur: (lv) => 10 + lv * 0.5, buff: (lv) => ({ taken: 30 + lv * 3, atk: 10, spd: -10 }),
      aura: (game, p, dt) => { if (Math.random() < dt * 6) V.motes(p.x + rand(-24, 24), p.y - rand(20, 110), 1, '255,200,110', { rise: 50, spread: 4 }); },
      desc: (lv) => `${r1(10 + lv * 0.5)} วิ: รับดาเมจลดลง ${30 + lv * 3}% ATK +10% (เดินช้าลงนิด)` }),
    mo_palms: S({ name: 'ฝ่ามือร้อยทิศ', icon: 'sk_mo_palms', req: [['mo_chi', 3]], cd: 8, sp: (lv) => 20 + lv * 2, mul: (lv) => 0.6 + lv * 0.09,
      desc: (lv, m) => `ฝ่ามือรัว 10 ครั้งข้างหน้า ครั้งละ ${m}% ของ ATK แล้วผลักกระเด็น` }),
    mo_asura: S({ name: 'หมัดสิ้นปราณ', icon: 'sk_mo_asura', ult: true, req: [['mo_spheres', 5]], cd: 50, sp: (lv) => 40 + lv * 3, mul: (lv) => 12 + lv * 2,
      desc: (lv, m) => `ใช้ SP ที่เหลือทั้งหมดและลูกปราณทุกลูก พุ่งหมัดเพลิงวิญญาณใส่ศัตรู ${m}% ของ ATK · SP ที่ใช้เพิ่มพลังได้ถึง 2 เท่า ลูกปราณลูกละ +10%` }),
    mo_spheres: S({ name: 'ลูกปราณ', icon: 'sk_mo_spheres', max: 5, cd: 1.5, sp: () => 8, mul: () => 0, type: 'buff',
      desc: (lv) => `สะสมลูกปราณ 1 ลูก (สูงสุด ${lv}) ลูกละ ATK +3% · บางสกิลใช้ลูกปราณเพิ่มพลัง` }),
    mo_ironfist: S({ name: 'หมัดเหล็ก', icon: 'sk_mo_ironfist', pass: (lv) => ({ atk: lv * 3, hit: lv }), desc: (lv) => `ATK +${lv * 3}% · ความแม่น +${lv}` }),
    mo_combo: S({ name: 'ชุดหมัดพายุ', icon: 'sk_mo_combo', req: [['mo_palms', 3]], cd: 6, sp: (lv) => 16 + lv, mul: (lv) => 1.8 + lv * 0.28,
      desc: (lv, m) => `หมัดชุด 4 จังหวะข้างหน้า ครั้งละ ${m}% ของ ATK จังหวะสุดท้ายผลักกระเด็น` }),
    mo_dodge: S({ name: 'ก้าวไร้เงา', icon: 'sk_mo_dodge', pass: (lv) => ({ flee: lv * 2, pdodge: Math.floor(lv / 2) }),
      desc: (lv) => `หลบหลีก +${lv * 2} · หลบสมบูรณ์ +${Math.floor(lv / 2)}%` }),
    mo_snap: S({ name: 'ก้าวกระโดด', icon: 'sk_mo_snap', req: [['mo_spheres', 2]], cd: 3, sp: () => 12, mul: () => 0, type: 'buff',
      desc: () => 'ก้าวพริบตาไปที่เมาส์ (ไกลสุด 380) ทิ้งเส้นแสงทองไว้' }),
    mo_impact: S({ name: 'ฝ่ามือทะลวงปราณ', icon: 'sk_mo_impact', req: [['mo_chi', 5]], cd: 5, sp: (lv) => 14 + lv, mul: (lv) => 3 + lv * 0.45,
      desc: (lv, m) => `ฝ่ามือส่งปราณทะลุเกราะ ${m}% ของ ATK ไม่สนใจ DEF (คริติคอลแน่นอน)` }),
  });

  // ================= bishop =================
  const castPose = (game, p, lock) => K.pose(game, p, K.clip(p, 'bolt', 0), lock || 0.3);
  const everyone = (game, p, r) => [p, ...K.friends(game, p, r)];
  RUN.bi_heal = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.35);
    const k = SK.bi_heal.heal(lv) / 100, magic = p.d ? (p.d.matk[0] + p.d.matk[1]) / 2 : 0; // (no stats: another player's, replayed as looks by js/net.js)
    for (const who of everyone(game, p, 520)) K.heal(game, who, (who.maxHp * k + magic * (1.5 + lv * 0.3)) * K.healPow(p));
    V.circle(p.x, p.y, 220, GREEN, 1, { style: 'holy', spin: 1.6, grow: true, follow: p });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; V.beam(p.x + Math.cos(a) * 150, p.y + Math.sin(a) * 150 * V.SQ, 30, 300, GREEN, 0.45, { a: 0.6 }); }
    K.nova(game, p, 'bi_heal', p.x, p.y, 220, { rgb: HOLY, color: '255,240,190', fx: false });
    V.light(p.x, p.y - 60, 420, GREEN, 0.8, 0.6, { follow: p });
  };
  FX.def('vkyrie', (ctx, q, u) => {
    const o = q.follow, a = V.fade(u, 0.06, 0.1), pulse = q.hitT ? Math.max(0, 1 - (q.t - q.hitT) / 0.3) : 0;
    V.glow(ctx, o.x, o.y - 70, 140, GOLD, 0.2 * a + 0.35 * pulse, false);
    V.dome(ctx, o.x, o.y - 20, 88 + pulse * 10, 112 + pulse * 12, GOLD, a * 0.9, q.t);
  }, 'glow');
  RUN.bi_barrier = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.35);
    const dur = K.startBuff(game, p, 'bi_barrier', lv);
    p.kyrie = Math.round((p.maxHp * SK.bi_barrier.soak(lv)) / 100 + (p.d.matk[0] + p.d.matk[1]));
    if (p.kyrieFx) p.kyrieFx.dead = true;
    // (the dome lasts the buff: a bishop's own, as the monk's spheres are; the FX capture's hero has no job)
    // (online the dome comes from the server's biKyrie meter, the local hero's only: js/online-bishop.js)
    if (NC.isJob(p, 'bishop') && !game.presentationOnly) p.kyrieFx = FX.add({ type: 'vkyrie', follow: p, x: p.x, y: p.y, life: dur });
    K.buffFx(game, p, GOLD, { r: 170 });
    K.buffFriends(game, p, { dur, guard: 0.85, rgb: GOLD });
    FX.num(p.x, p.y - 190, 'บาเรีย ' + p.kyrie, { fill: '#ffe28a', size: 30 });
  };
  // the barrier soaks hits until it is used up
  NC.heroGuards.push((game, p, dmg) => {
    if (!(p.buffs.bi_barrier > 0) || !(p.kyrie > 0)) return dmg;
    const soak = Math.min(p.kyrie, dmg);
    p.kyrie -= soak;
    if (p.kyrieFx) p.kyrieFx.hitT = p.kyrieFx.t;
    V.sparks(p.x, p.y - 80, 6, GOLD, { size: 0.7 });
    if (p.kyrie <= 0) { p.buffs.bi_barrier = 0; if (p.kyrieFx) p.kyrieFx.dead = true; V.ring(p.x, p.y - 20, 40, 170, 8, GOLD, 0.4); FX.num(p.x, p.y - 190, 'บาเรียแตก', { fill: '#ffe28a', size: 28 }); }
    return dmg - soak;
  });
  RUN.bi_sanctuary = function (game, p, lv) {
    castPose(game, p, 0.35);
    const [tx, ty] = K.ground(game, p, 420), R = 190, k = SK.bi_sanctuary.heal(lv) / 100;
    K.zone(game, p, 'bi_sanctuary', tx, ty, R, 8, 0.5, {
      rgb: HOLY, style: 'holy', spin: 0.6, color: '255,240,190',
      tick(z, dt) { if (Math.random() < dt * 10) { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * R; V.motes(tx + Math.cos(a) * d, ty + Math.sin(a) * d * V.SQ, 1, HOLY, { rise: 120, spread: 4 }); } },
      pulse() {
        if (game.presentationOnly) return; // (online the server heals the ones in it: backend/job_bishop_skills.go)
        for (const who of everyone(game, p, 2000)) if (K.within(who, tx, ty, R)) K.heal(game, who, who.maxHp * k * K.healPow(p), { quiet: true });
      },
    });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; V.beam(tx + Math.cos(a) * R * 0.85, ty + Math.sin(a) * R * 0.85 * V.SQ, 34, 380, HOLY, 8, { a: 0.35 }); }
  };
  RUN.bi_miracle = function (game, p, lv) {
    K.pose(game, p, 'cheer', 1.0);
    V.flash('255,250,230', 0.35, 0.6);
    V.beam(p.x, p.y, 260, 1100, HOLY, 1.4);
    V.circle(p.x, p.y, 420, HOLY, 1.6, { style: 'holy', spin: 0.8, grow: true });
    FX.add({ type: 'vwings', follow: p, x: p.x, y: p.y, life: 1.6 });
    if (!game.presentationOnly) for (const who of everyone(game, p, 700)) K.heal(game, who, who.maxHp * 0.6 * K.healPow(p)); // (online: the server's)
    for (const a of ((NC.allies ? NC.allies(game) : NC.Party && NC.Party.members) || [])) if (a.dead > 0 && NC.dist(a.x, a.y, p.x, p.y) < 700) { NC.Party.lib.revive(game, a, 0.5); V.beam(a.x, a.y, 110, 700, HOLY, 0.7); }
    p.buffs.bless = Math.max(p.buffs.bless || 0, 20); p.blessK = Math.max(p.blessK || 1, 1.15); p.blessHit = p.blessHit || 10; p.blessOn = true;
    K.buffFriends(game, p, { dur: 20, atk: 1.15, rgb: HOLY });
    NC.applyGear(game);
    V.at(0.4, () => {
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; V.beam(p.x + Math.cos(a) * 280, p.y + Math.sin(a) * 280 * V.SQ, 50, 600, HOLY, 0.5, { a: 0.8 }); }
      K.nova(game, p, 'bi_miracle', p.x, p.y, 420, { rgb: HOLY, color: '255,240,190', big: true, stars: 20, shake: 14 });
    });
  };
  RUN.bi_turnundead = function (game, p, lv) {
    castPose(game, p, 0.3);
    const e = K.target(game, p, 560);
    if (!e) { FX.num(p.x, p.y - 170, 'ไม่มีเป้า', { fill: '#cfd8ff', size: 28 }); return; }
    V.circle(e.x, e.y, 90, HOLY, 0.5, { style: 'holy', spin: 2.4 });
    V.at(0.12, () => {
      if (!K.alive(e)) return;
      V.beam(e.x, e.y, 90, 760, '255,250,230', 0.5);
      const dark = e.element === 'undead' || e.element === 'shadow';
      K.hit(game, p, 'bi_turnundead', e, 0, -100, '255,250,220', dark ? 2 : 1, { big: true });
      K.burst(game, e.x, e.y, 110, HOLY, { shake: dark ? 9 : 5, stars: 10 });
    });
  };
  FX.def('vseal', (ctx, q, u) => {
    const a = V.fade(u, 0.1, 0.25);
    V.magicCircle(ctx, q.x, q.y, q.r, q.t * 1.2, SKY, a, 'holy', V.SQ);
    V.magicCircle(ctx, q.x, q.y, q.r * 0.6, -q.t * 2, HOLY, a * 0.9, 'star', V.SQ);
  }, 'low');
  RUN.bi_lexdivina = function (game, p, lv) {
    castPose(game, p, 0.3);
    const [tx, ty] = K.ground(game, p, 440), hold = SK.bi_lexdivina.hold(lv);
    FX.add({ type: 'vseal', x: tx, y: ty, r: 150, life: hold + 0.3 });
    V.at(0.12, () => K.nova(game, p, 'bi_lexdivina', tx, ty, 150, { rgb: SKY, color: '200,230,255', shake: 4, flare: false,
      each(e, r) { if (!r) return; K.stun(game, e, hold); V.boltAt(e.x, e.y - 160, e.x, e.y - 40, SKY, 0.3, { w: 4, jag: 8, seg: 5 }); } }));
  };

  // ================= monk =================
  // spirit spheres: gathered one at a time, up to the skill's level; ATK +3% each; they orbit the monk
  const spheres = (p) => p.spheres || 0;
  const useSphere = (p, n) => { const k = Math.min(spheres(p), n || 1); p.spheres = spheres(p) - k; if (k && NC.game) NC.applyGear(NC.game); return k; };
  NC.skillModSources.push((p) => (p.spheres ? { atk: p.spheres * 3 } : null));
  function sphereFx(game, p) {
    if (p.sphereFx && !p.sphereFx.dead) return;
    p.sphereFx = FX.add({ type: 'vproj', layer: 'glow', x: p.x, y: p.y, life: 1e9,
      update(q) { if (!spheres(p) || !NC.isJob(p, 'monk')) { q.dead = true; p.sphereFx = null; } },
      draw(ctx) {
        const n = spheres(p);
        for (let i = 0; i < n; i++) { const a = game.time * 2.2 + (i / n) * TAU, x = p.x + Math.cos(a) * 58, y = p.y - 80 + Math.sin(a) * 22; K.drawOrb(ctx, x, y, 7, '255,210,90', '#fff6d0'); }
      } });
  }
  NC.MonkLooks = { sphereFx }; // (the online client starts the orbit from the server's meter: js/online-monk.js)
  RUN.mo_spheres = function (game, p, lv) {
    if (spheres(p) >= lv) { FX.num(p.x, p.y - 170, `ลูกปราณเต็ม (${lv})`, { fill: '#ffe28a', size: 26 }); return; }
    p.spheres = spheres(p) + 1;
    NC.applyGear(game);
    if (!game.presentationOnly) sphereFx(game, p); // (online the orbit is the server's moSpheres meter: js/online-monk.js)
    V.gather(p.x, p.y - 80, 8, '255,210,90', 90, 0.25);
    V.ring(p.x, p.y - 10, 10, 90, 6, '255,210,90', 0.3);
  };
  const fistPose = (game, p, i, lock) => K.pose(game, p, K.clip(p, 'thrust', i === undefined ? 1 : i), lock || 0.35);
  RUN.mo_chi = function (game, p, lv) {
    fistPose(game, p, 2, 0.4);
    const k = useSphere(p) ? 1.5 : 1;
    V.at(0.12, () => {
      const a = p.aim;
      V.ring(K.hand(p)[0], K.hand(p)[1], 10, 120, 10, CHI, 0.3, { sq: 1 });
      K.shot(game, p, 'mo_chi', { from: K.hand(p), ang: a, v: 1100, range: 700, pierce: true, rgb: CHI, size: 2 * k, core: '#e9fffb', color: '150,255,235',
        trail(q) { if (Math.random() < 0.8) FX.add({ type: 'vstreak', x: q.x, y: q.y + rand(-10, 10), vx: -q.vx * 0.1, vy: -q.vy * 0.1, len: 50, w: 4, rgb: CHI, life: 0.25 }); },
        hit(e, q) { K.hit(game, p, 'mo_chi', e, Math.cos(a) * 300, Math.sin(a) * 220, '150,255,235', k, { big: k > 1 }); V.ring(e.x, e.y, 10, 90, 6, CHI, 0.3); } });
      V.shake(game, 4);
    });
  };
  RUN.mo_palms = function (game, p, lv) {
    fistPose(game, p, 0, 1.1);
    let n = 0;
    K.channel(game, p, 1.0, (ch) => {
      while (n < 10 && ch.t >= n * 0.09) {
        const a = p.aim + rand(-0.4, 0.4), d = rand(60, 150), x = p.x + Math.cos(a) * d, y = p.y - 70 + Math.sin(a) * d * 0.6;
        NC.Anim.play(p.anim, K.clip(p, 'thrust', n % 3));
        V.glowAt(x, y, 10, 60, '255,190,110', 0.9, 0.2, { hot: true });
        V.ring(x, y, 4, 50, 5, '255,190,110', 0.2, { sq: 1 });
        K.cone(game, p, 'mo_palms', 200, 0.7, { kb: n === 9 ? 460 : 30, color: '255,210,150', big: n === 9 });
        V.shake(game, n === 9 ? 8 : 2);
        n++;
      }
    });
  };
  RUN.mo_combo = function (game, p, lv) {
    for (let i = 0; i < 4; i++) V.at(i * 0.13, () => {
      fistPose(game, p, i % 3, 0.2);
      const a = p.aim, x = p.x + Math.cos(a) * 110, y = p.y - 60 + Math.sin(a) * 70;
      V.flare(x, y, 70 + i * 20, '255,190,110', 0.2);
      V.sparks(x, y, 8, '255,210,150', { ang: a, spread: 0.8 });
      K.cone(game, p, 'mo_combo', 190, 0.8, { kb: i === 3 ? 520 : 60, color: '255,210,150', big: i === 3 });
      V.shake(game, i === 3 ? 9 : 3);
      if (i === 3) V.stop(game, 0.06);
    });
  };
  RUN.mo_snap = function (game, p, lv) {
    const [tx, ty] = K.ground(game, p, 380);
    useSphere(p);
    K.blink(game, p, tx, ty, { ghost: '#ffd873', fill: '#f2e6c8', hi: '#fff6e0', rgb: '255,210,90' });
    V.ring(p.x, p.y, 10, 110, 6, '255,210,90', 0.3);
  };
  RUN.mo_impact = function (game, p, lv) {
    fistPose(game, p, 2, 0.4);
    const e = K.target(game, p, 230, 150) || K.nearest(game, p.x, p.y, 230, 1, p.aim, 0.9)[0];
    V.at(0.14, () => {
      const a = p.aim, x = p.x + Math.cos(a) * 110, y = p.y - 60 + Math.sin(a) * 70;
      V.ring(x, y, 10, 150, 12, CHI, 0.35, { sq: 1 });
      V.flare(x, y, 150, CHI, 0.3);
      if (e && K.alive(e)) { K.hit(game, p, 'mo_impact', e, Math.cos(a) * 420, Math.sin(a) * 300, '150,255,235', 1, { crit: true, big: true }); V.sparks(e.x, e.y - 50, 14, CHI, { ang: a, spread: 0.6 }); }
      V.shake(game, 9); V.stop(game, 0.07);
    });
  };
  RUN.mo_asura = function (game, p, lv) {
    const e = K.target(game, p, 420) || K.nearest(game, p.x, p.y, 420, 1)[0];
    const extra = Math.max(0, p.sp), orbs = useSphere(p, 99);
    p.sp = 0;
    const k = (1 + Math.min(1, extra / 200)) * (1 + orbs * 0.1);
    V.flash('40,10,0', 0.45, 0.9, 'source-over');
    V.gather(p.x, p.y - 80, 20, '255,190,90', 200, 0.4);
    FX.text(p.x, p.y - 240, 'ASURA!', '#ffd873', 60);
    const tx = e ? e.x : p.x + Math.cos(p.aim) * 200, ty = e ? e.y : p.y + Math.sin(p.aim) * 140;
    V.at(0.4, () => {
      const a = NC.angle(p.x, p.y, tx, ty), d = Math.max(0, NC.dist(p.x, p.y, tx, ty) - 70);
      K.dash(game, p, 'mo_asura', a, d, 0.14, { rgb: '255,190,90', hit() {},
        end() {
          fistPose(game, p, 2, 0.5);
          V.flare(tx, ty - 60, 320, '255,190,90', 0.5, { spin: 1 });
          K.flames(tx, ty, 18, 160, { k: 1.4, pal: P.gold });
          K.nova(game, p, 'mo_asura', tx, ty, 180, { rgb: '255,190,90', color: '255,220,150', mul: k, kb: 700, big: true, sure: true, decal: 'crack', smoke: ['#cfc3b2', '#f2eadc'], flash: '255,230,170', shake: 20, stars: 18 });
          V.stop(game, 0.14);
        } });
    });
  };
})();
