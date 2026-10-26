/* jobs3_berserker.js — the knight's third 2nd job, เบอร์เซิร์กเกอร์ (the plan "อาชีพใหม่ Night Camp" + the research
   in the berserker report, 2026-09-28): a RAGE meter (โทสะ, 0–100 in three bars) filled by hitting, by being hit and
   by kills, fading after 4 s out of a fight; the finishers spend every full bar and hit ×1 / ×1.5 / ×2.2 harder; at
   100 the hero hits 10% harder. Bleed (เลือดไหล) is its own damage over time, 15% ATK a second per stack, up to 5.
     lane ดาบใหญ่ (greatsword)        ฟันกากบาท · ดาบพายุหมุน · ฟันประหาร        (trades HP: สัญญาเลือด)
     lane ขวาน / ค้อนยักษ์ (earth)     ทุบสะสมพลัง · กระโดดทุบธรณี · ขว้างอาวุธ      (stuns, knockdowns)
     auto line โลหิตคลั่ง               เลือดเดือด · สัญญาเลือด · อัลติ พิโรธไททัน
     team line จ่าฝูง                  คำรามศึก · คำรามท้ารบ
   Data (outfit, hat, the great axe) in jobs3.js; icons sk_bk_* (tools/j3_icons.py sheets 1–2). Loaded after
   jobs3_skills_c.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, SK = NC.SKILLS;
  const { C, P, TAU } = K;
  const rand = NC.rand, S = K.S, alive = K.alive;
  const lvOf = (p, id) => NC.skillLv(p, id);
  const r1 = (v) => Math.round(v * 10) / 10;
  const isBK = (p) => p && NC.isJob(p, 'berserker');
  const wt = (p) => (NC.wtypeOf ? NC.wtypeOf(NC.weaponDef(p)) : '');
  const RAGE = '255,70,60', BLOOD = '220,30,60', EARTH = '215,160,100';
  const RPAL = ['#8a1030', '#e0335a', '#ffd0dc'];
  const BAR = 100 / 3;
  const shout = (p, text, fill) => FX.text(p.x, p.y - 200, text, fill || '#ff9a8a', 32);

  // ---------------- rage ----------------
  const rage = (p) => p.bkRage || 0;
  const bars = (p) => Math.floor(rage(p) / BAR + 1e-6);
  const BAR_K = [1, 1, 1.5, 2.2];
  function gain(game, p, n) {
    if (!isBK(p) || (p.bkNoRage || 0) > game.time) return;
    const was = bars(p);
    p.bkRage = Math.min(100, rage(p) + n); p.bkIdle = 0;
    if (bars(p) > was) V.ring(p.x, p.y - 6, 20, 120, 6, RAGE, 0.35);
  }
  NC.bkRage = { gain, bars, rage };
  // a finisher spends the full bars (the titan's wrath: always 3); returns the bars spent (0: none, not cast)
  function spend(game, p) {
    if (K.buffOn(p, 'bk_titan')) return 3;
    const n = bars(p);
    if (n > 0) p.bkRage = rage(p) - n * BAR;
    else if (lvOf(p, 'bk_pact') >= 5 && p.hp > p.maxHp * 0.1) { if (!game.presentationOnly) p.hp -= Math.round(p.maxHp * 0.08); FX.num(p.x, p.y - 150, 'จ่ายเลือด', { fill: '#ff6a6a', size: 26 }); return 1; }
    return n;
  }

  // ---------------- bleed ----------------
  function bleed(game, p, e, n) {
    if (!alive(e)) return;
    const b = e.bkBleed || (e.bkBleed = { n: 0, until: 0, acc: 0 });
    b.n = Math.min(5, (b.until > game.time ? b.n : 0) + n); b.until = game.time + 5;
    V.sparks(e.x, e.y - 60, 4 + n * 2, BLOOD, { size: 0.7 });
  }
  NC.bkBleed = bleed;

  K.def({
    bk_bleed: S({ name: 'เลือดไหล', icon: 'sk_bk_crosscut', mul: () => 0.15, sp: () => 0, cd: 0 }),
    bk_crosscut: S({ name: 'ฟันกากบาท', icon: 'sk_bk_crosscut', free: 1, cd: 4, sp: () => 10, mul: (lv) => 1.2 + lv * 0.1,
      desc: (lv, m) => `พุ่งเข้าหาเป้าแล้วฟันไขว้ 2 ครั้ง ครั้งละ ${m}% ของ ATK ลงเลือด 2 ชั้น (15% ATK ต่อวิต่อชั้น 5 วิ สูงสุด 5 ชั้น) โทสะ +15${lv >= 5 ? ' · ฟันครั้งที่ 3 ตวัดขึ้น' : ''}${lv >= 10 ? ' · พุ่งทะลุ' : ''}` }),
    bk_whirlwind: S({ name: 'ดาบพายุหมุน', icon: 'sk_bk_whirlwind', cd: 6, sp: () => 15, mul: (lv) => 0.45 + lv * 0.04,
      need: (game, p) => (bars(p) >= 1 || K.buffOn(p, 'bk_titan') ? true : 'โทสะไม่พอ (ต้อง 1 ช่อง)'),
      desc: (lv, m) => `ใช้โทสะ 1 ช่อง หมุนดาบ 2.5 วิ ตีทุกตัวรอบตัว 5 ครั้งต่อวิ ครั้งละ ${m}% ของ ATK${lv >= 5 ? ' · ดูดศัตรูเข้ามา' : ''}${lv >= 10 ? ' · ปิดด้วยฟันกวาด 300%' : ''}` }),
    bk_guillotine: S({ name: 'ฟันประหาร', icon: 'sk_bk_guillotine', cd: 8, sp: () => 12, mul: (lv) => 2.5 + lv * 0.25,
      need: (game, p) => (bars(p) >= 1 || K.buffOn(p, 'bk_titan') || lvOf(p, 'bk_pact') >= 5 ? true : 'โทสะไม่พอ (ต้อง 1 ช่อง)'),
      desc: (lv, m) => `ใช้โทสะทุกช่อง กระโดดสับลง ${m}% ของ ATK × 1 / 1.5 / 2.2 ตามช่อง · ศัตรูเลือดต่ำกว่า 30% หรือมึนโดนสองเท่า · ระเบิดเลือดไหลชั้นละ 60% · ฆ่าได้คืน 1 ช่องและคูลดาวน์` }),
    bk_smash: S({ name: 'ทุบสะสมพลัง', icon: 'sk_bk_smash', free: 1, element: 'earth', cd: 5, sp: () => 14, mul: (lv) => 3 + lv * 0.25,
      desc: (lv, m) => `ง้างสะสมพลัง 0.7 วิ (ไม่สะดุ้ง) แล้วทุบเป็นกรวย ${m}% ของ ATK ธาตุดิน โทสะ +16 · ค้อน: มึน 2 วิ · ขวาน: ลงเลือด 3 ชั้น${lv >= 10 ? ' · แรงเพิ่ม 40% แลก HP 5%' : ''}` }),
    bk_leap: S({ name: 'กระโดดทุบธรณี', icon: 'sk_bk_leap', element: 'earth', cd: 10, sp: () => 18, mul: (lv) => 2 + lv * 0.2,
      need: (game, p) => (bars(p) >= 1 || K.buffOn(p, 'bk_titan') || lvOf(p, 'bk_pact') >= 5 ? true : 'โทสะไม่พอ (ต้อง 1 ช่อง)'),
      desc: (lv, m) => `ใช้โทสะทุกช่อง กระโดดไปไกล 350 ทุบลง ${m}% ของ ATK × ตามช่อง ศัตรูล้ม 1 วิ · 2 ช่องขึ้นไป: พื้นแตกสั่น 3 วิ ตีทุก 0.5 วิ 40% ศัตรูช้าลง` }),
    bk_hurl: S({ name: 'ขว้างอาวุธ', icon: 'sk_bk_hurl', element: 'earth', cd: 6, sp: () => 14, mul: (lv) => 1.3 + lv * 0.08,
      desc: (lv, m) => `ขว้างอาวุธไป 500 แล้ววกกลับ โดนทั้งขาไปขากลับ ครั้งละ ${m}% ของ ATK โทสะ +12 · ขวาน: ลงเลือด · ค้อน: มึน 0.8 วิ และดึงศัตรูเข้ามา` }),
    bk_frenzy: S({ name: 'เลือดเดือด', icon: 'sk_bk_frenzy', pass: (lv, p) => ({ aspd: Math.min(10, p.bkStack || 0) * 2, crit: r1(lv * 0.5), dbl: (p.bkStack || 0) >= 10 ? 15 + lv : 0 }),
      desc: (lv) => `ตีเป้าเดิมติดกันได้ชั้นเลือดเดือด ชั้นละความเร็วโจมตี +2% สูงสุด 10 ชั้น คริ +${r1(lv * 0.5)} · ครบ 10 ชั้น โอกาสตีเบิ้ล ${15 + lv}% · ค้อน: ทุก 4 ครั้งมึน 0.5 วิ · ขวาน: คริได้ชั้นเพิ่ม` }),
    bk_pact: S({ name: 'สัญญาเลือด', icon: 'sk_bk_pact', max: 5, pass: (lv, p) => ({ atk: Math.min(25, Math.floor((1 - p.hp / Math.max(1, p.maxHp)) * 100 / 3)) }),
      desc: (lv) => `ATK +1% ทุก 3% ของ HP ที่หายไป (สูงสุด 25%)${lv >= 3 ? ' · 60 วิครั้ง: โดนตีตายเหลือ 1 HP อมตะ 3 วิ' : ''}${lv >= 5 ? ' · ท่าปิดจ่าย HP 8% แทนโทสะได้ · HP ต่ำกว่า 50% ดูดเลือด 3%' : ''}` }),
    bk_titan: S({ name: 'พิโรธไททัน', icon: 'sk_bk_titan', ult: true, max: 5, kind: 'buff', type: 'buff', cd: 90, sp: () => 40, rgb: RAGE, circle: 'occult',
      dur: () => 8, buff: () => ({ taken: 25, spd: 15 }), mul: (lv) => 0.6 + lv * 0.06,
      need: (game, p) => (bars(p) >= 1 ? true : 'โทสะไม่พอ (ต้อง 1 ช่อง)'),
      desc: (lv, m) => `ใช้โทสะทั้งหมด (อย่างน้อย 1 ช่อง) ตัวโตเป็นยักษ์ 6 วิ + 2 วิต่อช่อง รับดาเมจลด 25% ศัตรูรอบตัวช้าลง ตีปกติส่งคลื่นกระแทก ${m}% ของ ATK · ท่าปิดไม่ใช้โทสะและนับเป็น 3 ช่อง · จบแล้วระเบิด 400% และ 8 วิไม่ได้โทสะ` }),
    bk_warcry: S({ name: 'คำรามศึก', icon: 'sk_bk_warcry', kind: 'buff', type: 'buff', cd: 30, sp: () => 30, rgb: RAGE, circle: 'occult', dur: () => 20,
      buff: (lv) => ({ atk: 5 + lv, aspd: lv }), party: (lv) => ({ atk: 1 + (5 + lv) / 100 }),
      desc: (lv) => `20 วิ: ทีม ATK +${5 + lv}% ความเร็วโจมตี +${lv}% · โทสะ +30 · ศัตรูรอบตัวรับดาเมจ +15% 6 วิ${lv >= 5 ? ' · ทีม HP สูงสุด +10%' : ''}` }),
    bk_roar: S({ name: 'คำรามท้ารบ', icon: 'sk_bk_roar', max: 5, cd: 15, sp: () => 20, mul: () => 0,
      desc: (lv) => `ดึงศัตรูรอบตัว 320 เข้ามา มันตีเบาลง 20% 4 วิ · ต่อตัวที่ดึงได้ รับดาเมจลด 4% (สูงสุด 20%) 6 วิ และโทสะ +5` }),
  });
  SK.bk_bleed.active = false; SK.bk_bleed.kind = 'passive';

  // ---------------- casting ----------------
  const slash = (x, y, r, a, pal, rgb, o) => K.slashAt(x, y, r, a, pal || RPAL, rgb || RAGE, o);
  RUN.bk_crosscut = function (game, p, lv) {
    const t = K.target(game, p, 300, 200), a = t ? NC.angle(p.x, p.y, t.x, t.y) : p.aim, d = t ? Math.max(40, NC.dist(p.x, p.y, t.x, t.y) - (lv >= 10 ? -60 : 70)) : 120;
    K.pose(game, p, K.clip(p, 'swing', 0), 0.35);
    gain(game, p, 15);
    const cut = (i) => {
      const cx = p.x + Math.cos(a) * 80, cy = p.y + Math.sin(a) * 50;
      slash(cx, cy - 20, 130, a + (i % 2 ? 0.8 : -0.8) + Math.PI / 2, RPAL, RAGE, { sweep: 2.2, thick: 34, life: 0.26 });
      for (const e of K.around(game, cx, cy, 130)) {
        const r = K.hit(game, p, 'bk_crosscut', e, Math.cos(a) * 150, Math.sin(a) * 110, RAGE);
        if (r && !r.miss && i === 0) bleed(game, p, e, 2);
      }
      V.shake(game, 4);
    };
    K.dash(game, p, 'bk_crosscut', a, d, 0.14, { rgb: RAGE, hit() {}, end() {
      cut(0); V.at(0.12, () => cut(1));
      if (lv >= 5) V.at(0.24, () => { slash(p.x + Math.cos(a) * 70, p.y - 40, 140, -Math.PI / 2, RPAL, RAGE, { sweep: 2.6, thick: 36, life: 0.28 }); for (const e of K.around(game, p.x + Math.cos(a) * 80, p.y, 130)) K.hit(game, p, 'bk_crosscut', e, 0, -60, RAGE, 1.2); });
    } });
  };
  RUN.bk_whirlwind = function (game, p, lv) {
    if (!K.buffOn(p, 'bk_titan')) p.bkRage = Math.max(0, rage(p) - BAR);
    let acc = 0, spin = 0;
    K.pose(game, p, K.clip(p, 'swing', 2), 0.3); // (no spin clip: the swing, then the spinning blades carry it)
    p.channel = {
      t: 0, dur: 2.5,
      update(game, p, ch, dt) {
        p.vx *= 0.9; p.vy *= 0.9;
        spin += dt * 16;
        if (Math.random() < 0.9) slash(p.x, p.y - 30, 150, spin, RPAL, RAGE, { sweep: 1.6, thick: 26, life: 0.16 });
        if ((acc += dt) >= 0.2) {
          acc -= 0.2;
          for (const e of K.around(game, p.x, p.y, 230)) {
            if (lv >= 5) K.pull(e, p.x, p.y, 90);
            K.hit(game, p, 'bk_whirlwind', e, 0, 0, RAGE);
          }
          V.ring(p.x, p.y - 6, 60, 220, 8, RAGE, 0.18);
        }
      },
      end(game, p) {
        if (lv >= 10) { slash(p.x, p.y - 30, 240, p.aim, RPAL, RAGE, { sweep: 3.2, thick: 44, life: 0.32 }); K.nova(game, p, 'bk_whirlwind', p.x, p.y, 250, { rgb: RAGE, mul: 3 / SK.bk_whirlwind.mul(lv), kb: 380, big: true }); } // (300% ATK)
      },
    };
  };
  RUN.bk_guillotine = function (game, p, lv) {
    const n = spend(game, p), k = BAR_K[Math.min(3, Math.max(1, n))];
    const t = K.target(game, p, 320, 200), [tx, ty] = t ? [t.x, t.y] : K.ground(game, p, 200);
    const a = NC.angle(p.x, p.y, tx, ty);
    K.pose(game, p, 'gsLeap', 0.5);
    K.dash(game, p, 'bk_guillotine', a, Math.max(40, NC.dist(p.x, p.y, tx, ty) - 60), 0.22, { rgb: RAGE, hit() {}, end() {
      V.beam(tx, ty, 90, 520, RAGE, 0.3);
      slash(tx, ty - 60, 150, Math.PI / 2, RPAL, RAGE, { sweep: 1.2, thick: 50, life: 0.3 });
      for (const e of K.around(game, tx, ty, 150)) {
        const low = e.hp < e.maxHp * 0.3 || (e.status && e.status.stun > 0) || e.stun > 0;
        const b = e.bkBleed && e.bkBleed.until > game.time ? e.bkBleed.n : 0;
        const r = K.hit(game, p, 'bk_guillotine', e, 0, 0, RAGE, k * (low ? 2 : 1) + b * 0.6 / SK.bk_guillotine.mul(lv), { big: true });
        if (b) { e.bkBleed.n = 0; V.sparks(e.x, e.y - 60, 16, BLOOD, { size: 1 }); }
        if (r && e.hp <= 0 && !game.presentationOnly) { gain(game, p, BAR); p.cd['@bk_guillotine'] = 0; } // (online the server's kill resets it)
      }
      V.shake(game, 8 + n * 2); V.stop(game, 0.05);
    } });
    if (n >= 2) shout(p, n >= 3 ? 'ประหาร!!!' : 'ประหาร!!');
  };
  RUN.bk_smash = function (game, p, lv) {
    const W = wt(p), a = p.aim;
    K.pose(game, p, K.clip(p, 'smash', 0), 1);
    V.light(p.x, p.y - 60, 300, EARTH, 0.8, 0.9, { follow: p });
    K.channel(game, p, 0.7, (ch) => { if (Math.random() < 0.6) V.motes(p.x + rand(-40, 40), p.y - rand(0, 40), 1, EARTH, { rise: 120, spread: 10 }); p.inv = Math.max(p.inv, 0.05); }, () => {
      const x = p.x + Math.cos(a) * 110, y = p.y + Math.sin(a) * 70;
      if (lv >= 10 && p.hp > p.maxHp * 0.1) p.hp -= Math.round(p.maxHp * 0.05);
      const got = K.cone(game, p, 'bk_smash', 260, 0.7, { ang: a, kb: 320, mul: lv >= 10 ? 1.4 : 1, color: EARTH, big: true }); // (mul: x the skill's own)
      for (const e of got) { if (W === 'hammer') K.stun(game, e, 2); else if (W === 'gaxe' || W === 'axe') bleed(game, p, e, 3); }
      K.burst(game, x, y, 150, EARTH, { decal: 'crack', shake: 10, stars: 6 });
      V.debris(x, y - 20, 12, P.rock);
      gain(game, p, 16);
    });
  };
  RUN.bk_leap = function (game, p, lv) {
    const n = spend(game, p), k = BAR_K[Math.min(3, Math.max(1, n))];
    const [tx, ty] = K.ground(game, p, 350), a = NC.angle(p.x, p.y, tx, ty), d = Math.min(350, NC.dist(p.x, p.y, tx, ty));
    K.pose(game, p, 'gsLeap', 0.6);
    K.dash(game, p, 'bk_leap', a, Math.max(60, d), 0.34, { rgb: EARTH, hit() {}, end(p) {
      K.nova(game, p, 'bk_leap', p.x, p.y, 200, { rgb: EARTH, mul: k, kb: 300, big: true, decal: 'crack', shake: 12, status: ['stun', 1], smoke: ['#6a5a50', '#8a7a70'] });
      V.debris(p.x, p.y - 20, 16, P.rock);
      if (n >= 2) K.zone(game, p, 'bk_leap', p.x, p.y, 180, 3, 0.5, { mul: 0.4 / SK.bk_leap.mul(lv), rgb: EARTH, each: (e) => K.slow(e, 1) }); // (40% ATK a tick)
    } });
  };
  RUN.bk_hurl = function (game, p, lv) {
    const W = wt(p), a = p.aim, x0 = p.x, y0 = p.y - 60, reach = 500, hit = new Set(), back = new Set();
    K.pose(game, p, K.clip(p, 'swing', 1), 0.3);
    gain(game, p, 12);
    const spr = NC.weaponDef(p) && NC.weaponDef(p).sprite;
    p.bkThrown = game.time + 1.1;
    const hitIt = (e, set) => {
      if (set.has(e)) return;
      set.add(e);
      K.hit(game, p, 'bk_hurl', e, Math.cos(a) * 120, Math.sin(a) * 90, EARTH);
      if (W === 'hammer') { K.stun(game, e, 0.8); K.pull(e, p.x, p.y, 220); } else bleed(game, p, e, 1);
    };
    K.proj({ x: x0, y: y0, life: 1.1, spin: 0,
      update(q, dt) {
        const u = q.t / 1.1, s = u < 0.5 ? u / 0.5 : 1 - (u - 0.5) / 0.5, bx = x0 + (u < 0.5 ? Math.cos(a) * reach * s : 0), by = y0 + (u < 0.5 ? Math.sin(a) * reach * 0.7 * s : 0);
        if (u < 0.5) { q.x = bx; q.y = by; } else { q.x = NC.lerp(q.x, p.x, Math.min(1, dt * 8)); q.y = NC.lerp(q.y, p.y - 60, Math.min(1, dt * 8)); }
        q.spin += dt * 18;
        for (const e of K.around(game, q.x, q.y + 60, 70)) hitIt(e, u < 0.5 ? hit : back);
      },
      draw(ctx, q) { if (spr && NC.SPR[spr]) NC.drawSpr(ctx, spr, q.x, q.y + 30, { rot: q.spin, scale: 0.8 }); else K.drawBlade(ctx, q.x, q.y, q.spin, 60, 16, '#ccc', EARTH); } });
  };
  RUN.bk_titan = function (game, p, lv) {
    const n = Math.max(1, bars(p));
    p.bkRage = 0;
    K.pose(game, p, 'cheer', 0.4);
    K.startBuff(game, p, 'bk_titan', lv, 6 + n * 2);
    K.buffFx(game, p, RAGE, { style: 'occult', r: 220 });
    V.flash(RAGE, 0.2, 0.4); V.shake(game, 12);
    shout(p, 'พิโรธไททัน!', '#ff8a7a');
  };
  RUN.bk_warcry = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    K.startBuff(game, p, 'bk_warcry', lv);
    K.buffFx(game, p, RAGE, { style: 'occult' });
    K.buffFriends(game, p, { dur: 20, rgb: RAGE, atk: 1 + (5 + lv) / 100 });
    for (const e of K.around(game, p.x, p.y, 360)) K.vuln(game, e, 1.15, 6, RAGE);
    V.ring(p.x, p.y - 6, 30, 380, 14, RAGE, 0.5);
    gain(game, p, 30);
    shout(p, 'อาาาาา!', '#ffb09a');
  };
  RUN.bk_roar = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    const got = K.around(game, p.x, p.y, 320);
    for (const e of got) { K.pull(e, p.x, p.y, 420); K.weak(game, e, 0.8, 4); }
    p.bkGuard = { k: Math.min(20, got.length * 4), until: game.time + 6 };
    V.ring(p.x, p.y - 6, 320, 40, 12, RAGE, 0.4);
    V.shake(game, 6);
    gain(game, p, got.length * 5);
    shout(p, 'เข้ามา!', '#ffb09a');
  };

  // ---------------- basic hits: rage, frenzy stacks, the hammer's stun, the titan's shockwave ----------------
  NC.basicHits.push((game, p, e, r) => {
    if (!isBK(p)) return;
    const W = wt(p);
    gain(game, p, (W === 'gsword' || W === 'hammer' || W === 'gaxe' ? 8 : 5) + (r.crit ? 3 : 0));
    if (lvOf(p, 'bk_frenzy') > 0) {
      const was = p.bkStack || 0;
      p.bkStack = p.bkLast === e ? Math.min(10, was + 1 + (r.crit && (W === 'axe' || W === 'gaxe') ? 1 : 0)) : 1;
      p.bkLast = e; p.bkStackT = game.time;
      if ((p.bkStack >= 10) !== (was >= 10) || Math.floor(p.bkStack / 3) !== Math.floor(was / 3)) NC.applyGear(game);
      if (W === 'hammer' && (p._bkHam = (p._bkHam || 0) + 1) % 4 === 0) K.stun(game, e, 0.5);
    }
    if (K.buffOn(p, 'bk_titan') && game.time - (p._bkWave || -9) > 0.3) {
      p._bkWave = game.time;
      const a = NC.angle(p.x, p.y, e.x, e.y);
      slash(p.x + Math.cos(a) * 90, p.y - 30, 170, a + Math.PI / 2, RPAL, RAGE, { sweep: 2.4, thick: 40, life: 0.24 });
      K.cone(game, p, 'bk_titan', 280, 0.6, { ang: a, kb: 200, color: RAGE });
    }
    if (lvOf(p, 'bk_pact') >= 5 && p.hp < p.maxHp * 0.5) p.hp = Math.min(p.maxHp, p.hp + Math.round(r.dmg * 0.03));
  });

  // ---------------- every frame: rage fades, bleeds tick, the titan ends, the frenzy goes cold ----------------
  NC.skillTicks.push((game, p, dt) => {
    if (!isBK(p)) { p.bkRage = 0; return; }
    p.bkIdle = (p.bkIdle || 0) + dt;
    if (p.bkIdle > 4 && rage(p) > 0) p.bkRage = Math.max(0, rage(p) - dt * 10);
    if (p.bkStack && game.time - (p.bkStackT || 0) > 3) { p.bkStack = 0; NC.applyGear(game); }
    for (const e of game.enemies) {
      const b = e.bkBleed;
      if (!b || b.n <= 0) continue;
      if (b.until <= game.time || !alive(e)) { b.n = 0; continue; }
      b.acc += dt;
      if (b.acc >= 1) { b.acc -= 1; K.hit(game, p, 'bk_bleed', e, 0, 0, BLOOD, b.n); V.sparks(e.x, e.y - 50, 3, BLOOD, { size: 0.6 }); }
    }
    if (p._bkTitan && !K.buffOn(p, 'bk_titan')) { // the wrath ends: an aftershock, then no rage for 8 s
      p._bkTitan = false;
      K.nova(game, p, 'bk_titan', p.x, p.y, 260, { rgb: RAGE, mul: 4 / SK.bk_titan.mul(Math.max(1, lvOf(p, 'bk_titan'))), kb: 420, big: true, decal: 'crack', shake: 12 });
      p.bkNoRage = game.time + 8;
    } else if (K.buffOn(p, 'bk_titan')) {
      p._bkTitan = true;
      for (const e of K.around(game, p.x, p.y, 260)) K.slow(e, 0.3);
    }
    if (rage(p) >= 100 && Math.random() < dt * 10) V.flameAt(p.x + rand(-30, 30), p.y - rand(20, 100), 20, 34, RPAL, 0.35, { vy: -80 });
  });
  // rage from being hit, the roar's guard, the pact's last stand; at 100 rage: +10% ATK
  NC.heroGuards.push((game, p, dmg) => {
    if (!isBK(p)) return dmg;
    gain(game, p, (dmg / Math.max(1, p.maxHp)) * 100);
    if (p.bkGuard && p.bkGuard.until > game.time) dmg = Math.max(1, Math.round(dmg * (1 - p.bkGuard.k / 100)));
    if (lvOf(p, 'bk_pact') >= 3 && dmg >= p.hp && game.time - (p.bkLast1 || -99) > 60) {
      p.bkLast1 = game.time; p.inv = Math.max(p.inv, 3);
      dmg = Math.max(0, p.hp - 1);
      shout(p, 'ยังไม่ล้ม!', '#ff6a6a'); V.flash(BLOOD, 0.2, 0.4);
    }
    return dmg;
  });
  NC.skillModSources.push((p) => (isBK(p) && rage(p) >= 100 ? { atk: 10 } : null));
  NC.skillKills.push((game) => { const p = game.player; if (isBK(p)) gain(game, p, 5); });
  // the giant during the titan's wrath
  const baseDraw = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    const p = game.player;
    if (!isBK(p) || !K.buffOn(p, 'bk_titan') || !p.pose || p.dead > 0 || (NC.C3 && NC.C3.awake(p) && NC.C3.jobOf(p) && NC.C3.jobOf(p).giant)) return baseDraw(ctx, game);
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1.25, 1.25); ctx.translate(-p.x, -p.y);
    try { baseDraw(ctx, game); } finally { ctx.restore(); }
  };
  // the rage gauge over the head: three bars
  FX.def('bkrage', (ctx) => {
    const G = NC.game, p = G && G.player;
    if (!p || !isBK(p) || p.dead > 0) return;
    const w = 90, h = 10, x = p.x - w / 2, y = p.y - 236, v = rage(p);
    ctx.save();
    ctx.globalAlpha *= v > 0 ? 1 : 0.5;
    for (let i = 0; i < 3; i++) {
      const bx = x + i * (w / 3 + 1), bw = w / 3 - 2, f = NC.clamp((v - i * BAR) / BAR, 0, 1);
      ctx.fillStyle = 'rgba(20,14,24,0.75)'; ctx.fillRect(bx - 1, y - 1, bw + 2, h + 2);
      ctx.fillStyle = f >= 1 ? '#ff4a3a' : '#a0302e'; ctx.fillRect(bx, y, bw * f, h);
      if (f >= 1) { ctx.fillStyle = 'rgba(255,220,200,0.5)'; ctx.fillRect(bx, y, bw, 3); }
    }
    ctx.restore();
  });
  let gauge = null;
  NC.skillTicks.push((game, p) => { if (isBK(p) && (!gauge || !FX.list.includes(gauge))) gauge = FX.add({ type: 'bkrage', layer: 'glow', life: 1e9, x: 0, y: 0 }); });

  // =====================================================================================================
  // lines, the skill list, the weapon rules
  // =====================================================================================================
  const J = NC.JOBS.berserker;
  if (J) {
    J.lines = [['gs', 'เพลงดาบใหญ่', 'neutral', 'sword', 0], ['earth', 'ทลายพสุธา', 'earth', null, 0], ['blood', 'โลหิตคลั่ง', 'neutral', 'berserk', 1], ['pack', 'จ่าฝูง', 'neutral', 'guard', 0]]
      .map(([id, name, el, parent, auto]) => ({ id, name, el, parent: parent || null, auto: !!auto }));
    const PLAN = [
      ['bk_crosscut', 'gs', 10, 1, [], 'Lv5 ฟันครั้งที่ 3 · Lv10 พุ่งทะลุ'],
      ['bk_whirlwind', 'gs', 10, 0, [['bk_crosscut', 3]], 'Lv5 ดูดศัตรูเข้ามา · Lv10 ปิดด้วยฟันกวาด 300%'],
      ['bk_guillotine', 'gs', 10, 0, [['bk_crosscut', 5]], 'แรงขึ้นตามช่องโทสะ ×1 / 1.5 / 2.2'],
      ['bk_smash', 'earth', 10, 1, [], 'Lv10 แรงเพิ่ม 40% แลก HP 5%'],
      ['bk_leap', 'earth', 10, 0, [['bk_smash', 3]], '2 ช่องขึ้นไป พื้นแตกสั่น 3 วิ'],
      ['bk_hurl', 'earth', 10, 0, [['bk_smash', 1]], 'ขวาน ลงเลือด · ค้อน มึนและดึง'],
      ['bk_frenzy', 'blood', 10, 0, [['kn_quicken', 1]], 'ครบ 10 ชั้นตีเบิ้ล'],
      ['bk_pact', 'blood', 5, 0, [['bk_frenzy', 3]], 'Lv1 เลือดน้อยแรงขึ้น · Lv3 รอดตาย 1 ครั้งต่อ 60 วิ · Lv5 จ่าย HP แทนโทสะ ดูดเลือด'],
      ['bk_titan', 'blood', 5, 0, ['|', ['bk_guillotine', 5], ['bk_leap', 5]], 'ร่างยักษ์ ตีปกติส่งคลื่นกระแทก'],
      ['bk_warcry', 'pack', 10, 0, [], 'Lv5 ทีม HP สูงสุด +10%'],
      ['bk_roar', 'pack', 5, 0, [['bk_warcry', 3]], 'ดึงศัตรูแล้วรับดาเมจลดลง'],
    ];
    J.skills = PLAN.map((r) => r[0]);
    for (const [id, line, max, free, req, grow] of PLAN) {
      const Sk = SK[id];
      if (!Sk) continue;
      Sk.line = line; Sk.max = max; Sk.free = free; Sk.grow = grow;
      const any = req[0] === '|';
      Sk.req = (any ? req.slice(1) : req).filter(([r]) => SK[r]);
      Sk.reqAny = any;
    }
  }
  if (NC.weaponRule) {
    const R = NC.weaponRule;
    for (const id of ['bk_crosscut', 'bk_whirlwind', 'bk_guillotine']) R(id, 'n:gsword');
    for (const id of ['bk_smash', 'bk_leap', 'bk_hurl']) R(id, 'n:gaxe,hammer,axe');
    R('bk_frenzy', 'n:melee');
  }
})();
