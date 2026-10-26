/* class3_skills_c.js — the class-3 jobs of the priest family (class3_core.js has the machinery):
     นักบุญแสงดาว (บิชอป)              ศรัทธาแสงดาว: heals that overflow (and every heal a little) gather faith; full, star judgments fall
     ปรมาจารย์หมัดดาวตก (นักพรต)        คอมโบดาวตก: a combo counter; every 20 hits a meteor falls on the target
     ผู้เฝ้าประภาคาร (ผู้จุดตะเกียง)      ลำแสงประภาคาร: a lighthouse beam turns round the hero, burning foes, healing friends
     ผู้เลี้ยงดวงดาว (ผู้เลี้ยงดวงไฟ)      หลอมดวงดาว: with three wisps or more a big star forms and shoots now and then */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, SK = NC.SKILLS, C3 = NC.C3;
  const { C, P, TAU } = K;
  const rand = NC.rand, alive = K.alive;
  const lvOf = (p, id) => NC.skillLv(p, id);
  const r1 = (v) => Math.round(v * 10) / 10;
  const STAR = '255,226,120', SKY = '160,210,255', FIRE = '255,140,50', BEAM = '255,220,140';
  const inFight = (game, p) => game.time - (p._c3fight || -99) < 3;
  // the looks the server's events call for online (js/online-class3-priest.js; backend/job_starsaint.go ...): the
  // judgment and its pillars, the meteor's fall, the big star's flight, the beam's sparks
  const LOOKS = (NC.PriestC3Looks = {});

  // =====================================================================================================
  // นักบุญแสงดาว
  // =====================================================================================================
  const PILLAR = { rgb: STAR, style: 'holy', delay: 0.18, stars: 8, starFill: '#fff6d0' }, PILLAR_R = 110;
  // (another hero's judgment does not flash the screen: mine is false)
  LOOKS.judgment = (game, p, mine) => { if (mine) V.flash(STAR, 0.12, 0.3); C3.shout(p, 'ดาวพิพากษา!', '#fff1b8'); };
  // K.pillar's look (skillkit.js:389-397) without its hits
  LOOKS.pillar = (game, x, y) => {
    V.circle(x, y, PILLAR_R, STAR, PILLAR.delay + 0.5, { style: PILLAR.style, spin: 2, grow: true });
    V.at(PILLAR.delay, () => { V.beam(x, y, PILLAR_R * 0.8, 620, STAR, 0.45); K.burst(game, x, y, PILLAR_R, STAR, Object.assign({ rgb: STAR, shake: 5 }, PILLAR, { delay: 0 })); });
  };
  function judgment(game, p, lv) {
    p.ssFaith = 0;
    const ts = K.nearest(game, p.x, p.y, 650, 3);
    ts.forEach((t, i) => V.at(i * 0.12, () => K.pillar(game, p, 'ss_faith', t.x, t.y, PILLAR_R, PILLAR)));
    if (ts.length) { LOOKS.judgment(game, p, true); C3.fill(game, p, 12); }
  }
  C3.defineJob('starsaint', {
    name: 'นักบุญแสงดาว', from: 'bishop', hp: 5.5, sp: 7.7, rgb: STAR, pal: P.holy, lanes: ['เยียวยาแสงดาว', 'พิพากษาแสงดาว'],
    desc: 'นักบุญผู้ถือแสงดาว ฮีลที่ล้นหลอดเก็บเป็นศรัทธา เต็มแล้วดาวพิพากษาตกใส่ศัตรู · ร่างตื่นวงแหวนดาวทองหลังตัว',
    back: { h: 280, dy: -150, spin: 0.12 },
    sig: {
      id: 'ss_faith', name: 'ศรัทธาแสงดาว', type: 'magic', element: 'holy', mul: (lv) => 2.2 + lv * 0.22, pass: (lv) => ({ el_holy: r1(lv * 1.5), matk: lv }),
      desc: (lv, m) => `ดาเมจธาตุแสง +${r1(lv * 1.5)}% MATK +${lv}% · ทุกครั้งที่เราฮีล ได้ศรัทธา 3 แต้ม และฮีลที่ล้นหลอด (1% ของ HP คนนั้น = 1 แต้ม) · เต็ม 100 ดาวพิพากษาตกใส่ศัตรู 3 ตัวใกล้สุด ตัวละ ${m}% ของ MATK ธาตุแสง`,
      grow: 'แรงขึ้นทุกเลเวล',
    },
    enh: [
      { id: 'ss_heal', name: 'เยียวยาแสงดาว', of: 'bi_heal', lane: 'a', fx: 'heal', rgb: STAR, text: 'ฮีลตัวเราและเพื่อนรอบตัวอีกก้อนตาม MATK ดาวร่วงรอบตัว' },
      { id: 'ss_sanct', name: 'ลานแสงดวงดาว', of: 'bi_sanctuary', lane: 'a', fx: 'heal', rgb: SKY, text: 'ฮีลทั้งทีมอีกก้อนตอนร่าย' },
      { id: 'ss_turn', name: 'ขับไล่ด้วยแสงดาว', of: 'bi_turnundead', lane: 'b', fx: 'pillar', rgb: STAR, style: 'holy', text: 'เสาแสงดาวผ่าลงเป้า' },
      { id: 'ss_lex', name: 'ตราดาวพิพากษา', of: 'bi_lexdivina', lane: 'b', fx: 'rain', rgb: STAR, text: 'ห่าดาวตกใส่รอบเป้า' },
    ],
    awaken: {
      id: 'ss_awaken', name: 'ร่างนักบุญ', text: 'ฮีลแรงขึ้น 30% ทีมรอบตัวรับดาเมจลดลง 20%', perk: () => ({ heal: 30, taken: 20 }),
      hooks: { start(game, p, lv) { K.buffFriends(game, p, { dur: 8 + lv * 2, rgb: STAR, guard: 0.8 }); } },
    },
  });
  // the faith: counted on the heals the saint gives (K.heal)
  const baseHeal = K.heal;
  K.heal = function (game, who, amount, o) {
    const p = game && game.player, before = who ? who.hp : 0, got = baseHeal.apply(this, arguments);
    // (online a presented heal only draws: the server keeps the faith, backend/job_starsaint.go)
    if (p && !game.presentationOnly && p.job === 'starsaint' && lvOf(p, 'ss_faith') > 0 && who && (who === p || who.kind !== 'enemy')) {
      const over = Math.max(0, amount - got), mx = Math.max(1, who.maxHp || 1);
      p.ssFaith = Math.min(100, (p.ssFaith || 0) + 3 + (over / mx) * 100);
      if (p.ssFaith >= 100 && !p._ssBusy) { p._ssBusy = true; V.at(0.2, () => { p._ssBusy = false; judgment(game, p, lvOf(p, 'ss_faith')); }); }
    }
    return got;
  };
  C3.jobs.starsaint.drawFront = (ctx, game, p) => {
    const f = (p.ssFaith || 0) / 100;
    if (f <= 0 || !lvOf(p, 'ss_faith')) return;
    V.glow(ctx, p.x, p.y - 226, 20 + f * 20, STAR, 0.3 + f * 0.4, f >= 1);
    K.drawStar(ctx, p.x, p.y - 226, 6 + f * 8, game.time, 8, '#fff2b0');
  };

  // =====================================================================================================
  // ปรมาจารย์หมัดดาวตก
  // =====================================================================================================
  const meteorLook = (ctx, q) => { V.glow(ctx, q.x, q.y, 40, FIRE, 0.8, true); V.flame(ctx, q.x, q.y - 10, 26, 44, q.t * 20, P.fire, 1); K.drawOrb(ctx, q.x, q.y, 12, '255,120,60', '#fff0b0'); };
  const meteorLand = (game, x, y, big) => { K.flames(x, y, big ? 6 : 3, big ? 90 : 50, { pal: P.fire, k: big ? 1 : 0.7 }); V.decal(x, y, big ? 90 : 55, 'scorch', 2, { rgb: FIRE, n: 7 }); if (big) V.shake(game, 6); };
  function meteor(game, p, e, k, big) {
    K.rain(game, p, 'mf_combo', e.x, e.y, 20, 1, 0.01, { rgb: FIRE, ir: big ? 130 : 80, look: meteorLook, fall: 0.3, from: [160, -760], mul: k,
      land: (x, y) => meteorLand(game, x, y, big) });
  }
  // the meteor falling onto (x, y), where the server rolled it: K.rain's drop (skillkit.js:276-285) without its hits
  LOOKS.meteor = (game, x, y, big) => {
    const ir = big ? 130 : 80, sx = x + 160, sy = y - 760, t = 0.3;
    K.proj({ x: sx, y: sy, vx: (x - sx) / t, vy: (y - 20 - sy) / t, life: t, draw: meteorLook,
      onEnd() { V.ring(x, y, 8, ir * 1.1, 6, FIRE, 0.3); V.glowAt(x, y - 16, 12, ir * 1.2, FIRE, 0.7, 0.3, { hot: true }); V.sparks(x, y - 10, 6, FIRE, { size: 0.7, max: 420 }); meteorLand(game, x, y, big); } });
  };
  C3.defineJob('meteorfist', {
    name: 'ปรมาจารย์หมัดดาวตก', from: 'monk', hp: 8.2, sp: 4.4, rgb: '255,120,60', pal: P.fire, lanes: ['คอมโบดาวตก', 'ปราณดาวตก'],
    desc: 'ปรมาจารย์หมัด นับคอมโบ ทุก 20 ฮิตดาวตกลงใส่เป้า · ร่างตื่นออร่าไฟกับลูกปราณ ทุกหมัดเรียกดาวตก',
    back: { h: 290, dy: -125, bob: 3 },
    sig: {
      id: 'mf_combo', name: 'คอมโบดาวตก', type: 'phys', element: 'fire', mul: (lv) => 1.6 + lv * 0.16,
      desc: (lv, m) => `ทุกฮิต (ตีปกติและสกิล) ต่อคอมโบ (ขาดเกิน 2 วิ เริ่มใหม่) · ทุก 20 ฮิต ดาวตกลงใส่เป้า ${m}% ของ ATK ธาตุไฟ วงกว้าง 130`,
      grow: 'แรงขึ้นทุกเลเวล',
      hooks: {
        hit(game, p, e, r, o, lv) {
          if (game.time - (p._mfT || -99) > 2) p.mfCombo = 0;
          p._mfT = game.time;
          p.mfCombo = (p.mfCombo || 0) + 1;
          if (p.mfCombo % 20 === 0) { const t = e; V.at(0.05, () => meteor(game, p, t, 1, true)); C3.fill(game, p, 6); }
        },
      },
    },
    enh: [
      { id: 'mf_storm', name: 'ชุดหมัดดาวตก', of: 'mo_combo', lane: 'a', fx: 'rain', rgb: FIRE, look: meteorLook, text: 'ห่าดาวตกเล็กลงใส่รอบเป้า' },
      { id: 'mf_palms', name: 'ฝ่ามือร้อยดาว', of: 'mo_palms', lane: 'a', fx: 'echo', rgb: '255,170,90', pal: P.fire, text: 'ฝ่ามือไฟฟาดซ้ำ' },
      { id: 'mf_impact', name: 'ฝ่ามือทะลวงดาวตก', of: 'mo_impact', lane: 'b', fx: 'pillar', rgb: FIRE, style: 'occult', text: 'เสาไฟผ่าลงเป้า' },
      { id: 'mf_crush', name: 'หมัดดาวตกถล่มฟ้า', of: 'mo_asura', lane: 'b', fx: 'nova', rgb: '255,150,70', pal: P.fire, decal: 'scorch', text: 'คลื่นระเบิดไฟแผ่จากเป้า' },
    ],
    awaken: {
      id: 'mf_awaken', name: 'ร่างเพลิงปราณ', text: 'ทุกหมัดเรียกดาวตกเล็ก 50% ความเร็วโจมตี +15%', perk: () => ({ aspd: 15 }),
      hooks: { hit(game, p, e, r, o) { if (game.time - (p._mfM || -9) < 0.3) return; p._mfM = game.time; const t = e; V.at(0.03, () => meteor(game, p, t, 0.3, false)); } },
    },
  });
  C3.jobs.meteorfist.drawFront = (ctx, game, p) => { // the combo counter
    const n = p.mfCombo || 0;
    if (n < 3 || game.time - (p._mfT || -99) > 2 || !lvOf(p, 'mf_combo')) return;
    ctx.save();
    ctx.font = '900 30px "Leelawadee UI", Tahoma, sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 6; ctx.strokeStyle = '#2a1410'; ctx.fillStyle = n % 20 >= 15 ? '#ffd35c' : '#ff9a5a';
    const y = p.y - 232 - Math.max(0, 0.15 - (game.time - p._mfT)) * 60;
    ctx.strokeText(n + ' HIT', p.x, y); ctx.fillText(n + ' HIT', p.x, y);
    ctx.restore();
  };

  // =====================================================================================================
  // ผู้เฝ้าประภาคาร
  // =====================================================================================================
  const beams = (p) => (C3.awake(p) ? 3 : 1);
  LOOKS.beamSpark = (e) => V.sparks(e.x, e.y - 50, 3, BEAM, { size: 0.6 }); // (a beam's hit)
  C3.defineJob('beacon', {
    name: 'ผู้เฝ้าประภาคาร', from: 'lightkeeper', hp: 6.6, sp: 6.6, rgb: BEAM, pal: P.holy, lanes: ['คบเพลิงประภาคาร', 'โคมประภาคาร'],
    desc: 'ผู้เฝ้าแสงประภาคาร ลำแสงหมุนรอบตัว เผาศัตรู ฮีลเพื่อนที่โดนแสง · ร่างตื่นลำแสงหมุนกวาดสามทาง',
    back: { h: 290, dy: -150 },
    sig: {
      id: 'bc_beam', name: 'ลำแสงประภาคาร', type: 'magic', element: 'holy', mul: (lv) => 0.55 + lv * 0.055,
      desc: (lv, m) => `ระหว่างสู้ ลำแสงประภาคารยาว 480 หมุนรอบตัว (รอบละ 4 วิ) ศัตรูในลำแสงโดน ${m}% ของ MATK ธาตุแสงทุก 0.4 วิ เพื่อนในลำแสงฟื้น HP 1%`,
      grow: 'แรงขึ้นทุกเลเวล',
      hooks: {
        hit(game, p) { p._c3fight = game.time; },
        tick(game, p, dt, lv) {
          p._bcA = ((p._bcA || 0) + dt * (TAU / 4)) % TAU;
          if (!inFight(game, p) && !game.enemies.some((e) => alive(e) && NC.dist(e.x, e.y, p.x, p.y) < 500)) { p._bcOn = Math.max(0, (p._bcOn || 0) - dt * 3); return; }
          p._bcOn = Math.min(1, (p._bcOn || 0) + dt * 3);
          p._bcAcc = (p._bcAcc || 0) + dt;
          if (p._bcAcc < 0.4) return;
          p._bcAcc = 0;
          for (let b = 0; b < beams(p); b++) {
            const a = p._bcA + (b / beams(p)) * TAU;
            for (const e of game.enemies) {
              if (!alive(e) || NC.dist(e.x, e.y, p.x, p.y) > 480) continue;
              let d = Math.abs(NC.angle(p.x, p.y, e.x, e.y) - a) % TAU; if (d > Math.PI) d = TAU - d;
              if (d < 0.28) { K.hit(game, p, 'bc_beam', e, 0, 0, BEAM); LOOKS.beamSpark(e); }
            }
            for (const f of K.friends(game, p, 480)) { let d = Math.abs(NC.angle(p.x, p.y, f.x, f.y) - a) % TAU; if (d > Math.PI) d = TAU - d; if (d < 0.3) K.heal(game, f, f.maxHp * 0.01, { quiet: true }); }
          }
        },
      },
    },
    enh: [
      { id: 'bc_swing', name: 'ฟาดเปลวประภาคาร', of: 'lk_swing', lane: 'a', fx: 'nova', rgb: BEAM, pal: P.holy, text: 'วงแสงแผ่จากเป้า' },
      { id: 'bc_flash', name: 'แสงไล่เงาประภาคาร', of: 'lk_flash', lane: 'a', fx: 'pillar', rgb: '255,240,200', style: 'holy', text: 'เสาแสงประภาคารผ่าลงเป้า' },
      { id: 'bc_flare', name: 'โคมเรืองรองประภาคาร', of: 'lk_flare', lane: 'b', fx: 'heal', rgb: BEAM, text: 'ฮีลทั้งทีมอีกก้อนตอนร่าย' },
      { id: 'bc_dawn', name: 'รุ่งอรุณประภาคาร', of: 'lk_dawn', lane: 'b', fx: 'nova', rgb: '255,200,120', text: 'คลื่นแสงยักษ์แผ่จากเป้า' },
    ],
    awaken: { id: 'bc_awaken', name: 'ร่างผู้เฝ้าประภาคาร', text: 'ลำแสงเพิ่มเป็น 3 ทาง ฮีลแรงขึ้น 20% MATK +10%', perk: () => ({ heal: 20, matk: 10 }) },
  });
  C3.jobs.beacon.drawBack = (ctx, game, p) => { // the beam(s): long soft wedges of warm light on the ground
    const on = p._bcOn || 0;
    if (on <= 0 || !lvOf(p, 'bc_beam')) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < beams(p); b++) {
      const a = (p._bcA || 0) + (b / beams(p)) * TAU, x0 = p.x, y0 = p.y - 70;
      const g = ctx.createLinearGradient(x0, y0, x0 + Math.cos(a) * 480, y0 + Math.sin(a) * 480 * V.SQ);
      g.addColorStop(0, `rgba(${BEAM},${0.55 * on})`); g.addColorStop(1, `rgba(${BEAM},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, y0);
      for (const s of [-0.26, 0.26]) ctx.lineTo(x0 + Math.cos(a + s) * 480, y0 + Math.sin(a + s) * 480 * V.SQ);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };

  // =====================================================================================================
  // ผู้เลี้ยงดวงดาว
  // =====================================================================================================
  const STAR_NOVA = { rgb: STAR, stars: 8, starFill: '#fff6d0', shake: 3 };
  // the big star's flight from (x0, y0) at t, then land() (C3C:185-189)
  function starFlight(x0, y0, t, land) {
    const tt = 0.3;
    V.glowAt(x0, y0, 20, 90, STAR, 0.9, 0.3, { hot: true });
    K.proj({ x: x0, y: y0, vx: (t.x - x0) / tt, vy: (t.y - 60 - y0) / tt, life: tt,
      draw(ctx, q) { V.glow(ctx, q.x, q.y, 50, STAR, 0.8, true); K.drawStar(ctx, q.x, q.y, 18, q.t * 10, 5, '#fff6c0'); },
      onEnd() { land(); } });
  }
  // (online: its burst is K.nova's look alone, where the monster is when it lands)
  LOOKS.star = (game, x0, y0, t) => starFlight(x0, y0, t, () => K.burst(game, t.x, t.y, 100, STAR, STAR_NOVA));
  C3.defineJob('starshepherd', {
    name: 'ผู้เลี้ยงดวงดาว', from: 'wisp', hp: 5, sp: 7.7, rgb: STAR, pal: P.gold, lanes: ['ดวงดาวรักษา', 'ดวงดาวโจมตี'],
    desc: 'ผู้เลี้ยงดวงดาว มีดวงไฟครบสามดวงหลอมเป็นดาวใหญ่ยิงแรงเป็นระยะ · ร่างตื่นเกลียวดาวหมุนรอบตัว',
    back: { h: 290, dy: -140, spin: 0.2 },
    sig: {
      id: 'st_merge', name: 'หลอมดวงดาว', type: 'magic', element: 'holy', mul: (lv) => 1.4 + lv * 0.14,
      desc: (lv, m) => `มีดวงไฟลอยรอบตัว 3 ดวงขึ้นไป ทุก ${r1(6 - lv * 0.2)} วิ หลอมเป็นดาวใหญ่ยิงใส่ศัตรูใกล้สุด ${m}% ของ MATK ธาตุแสง (ไม่เสียดวงไฟ)`,
      grow: 'ถี่ขึ้นและแรงขึ้นทุกเลเวล',
      hooks: {
        tick(game, p, dt, lv) {
          if ((p.wsOrbit || 0) < 3 && !C3.awake(p)) { p._stT = 0; return; }
          p._stT = (p._stT || 0) + dt * (C3.awake(p) ? 2.5 : 1);
          if (p._stT < 6 - lv * 0.2) return;
          p._stT = 0;
          const t = K.nearest(game, p.x, p.y, 650, 1)[0];
          if (!t) return;
          starFlight(p.x, p.y - 200, t, () => { K.nova(game, p, 'st_merge', t.x, t.y, 100, STAR_NOVA); C3.fill(game, p, 4); });
        },
      },
    },
    enh: [
      { id: 'st_latch', name: 'ดวงดาวเกาะเพื่อน', of: 'ws_latch', lane: 'a', fx: 'heal', rgb: STAR, text: 'ฮีลตัวเราและเพื่อนรอบตัวอีกก้อนตอนส่ง' },
      { id: 'st_burst', name: 'ดวงดาวแตกฮีล', of: 'ws_burst', lane: 'a', fx: 'heal', rgb: '255,240,190', text: 'ฮีลทั้งทีมอีกก้อน ดาวร่วงรอบตัว' },
      { id: 'st_rush', name: 'ฝูงดาวพุ่ง', of: 'ws_rush', lane: 'b', fx: 'rain', rgb: STAR, text: 'ห่าดาวตกใส่รอบเป้า' },
      { id: 'st_mark', name: 'ดาวติดศัตรู', of: 'ws_mark', lane: 'b', fx: 'chain', rgb: STAR, text: 'ประกายดาวกระโดดต่อ 3–4 ตัว' },
    ],
    awaken: { id: 'st_awaken', name: 'ร่างผู้เลี้ยงดวงดาว', text: 'ดาวใหญ่ยิงถี่ขึ้น 2.5 เท่า (ไม่ต้องมีดวงไฟครบ) MATK +10%', perk: () => ({ matk: 10 }) },
  });

  C3.finish();
})();
