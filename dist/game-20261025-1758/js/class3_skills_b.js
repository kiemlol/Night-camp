/* class3_skills_b.js — the class-3 jobs of the archer and rogue families (class3_core.js has the machinery):
     พรานจันทร์เงียบ (เรนเจอร์)          สมาธิใต้จันทร์: standing still gathers focus; at five, the next skill shot pierces the whole line
     จ่าฝูงจันทร์เต็มดวง (นักล่าหมาป่า)   หมาป่าวิญญาณ: in a fight, a spirit wolf dashes through the target now and then
     วาทยกรแห่งป่า (นักกวี)             วงดนตรีแห่งป่า: while a song or dance plays, a forest band shoots golden notes
     มือปืนเที่ยงคืน (มือปืน)            เที่ยงคืนตรง: every twelfth shot slows time, marks targets and fires at them all
     นักฆ่าจันทรคราส (นักฆ่า)           สะสมความมืด: crits gather darkness; at ten the next skill brings an eclipse strike
     จ้าวเงาร้อยร่าง (นินจา)            ร่างเงาถาวร: shadow copies stand by and repeat the skill hits
     ผู้เก็บเกี่ยวจันทรา (ยมทูต)          จันทร์เก็บเกี่ยว: souls and kills wax the moon; full, a giant crescent slash
     จ้าวโรงหุ่นราตรี (นักเชิดหุ่น)        การแสดงสามองก์: three skills within 6 s and the curtain falls in a golden burst */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, SK = NC.SKILLS, C3 = NC.C3;
  const { C, P, TAU } = K;
  const rand = NC.rand, alive = K.alive;
  const lvOf = (p, id) => NC.skillLv(p, id);
  const r1 = (v) => Math.round(v * 10) / 10;
  const MOON = '200,230,255', SILVER = '225,235,255', WOLF = '150,210,255', GOLD = '255,214,110', RED = '255,70,70', DARK = '170,110,255', VIO = '190,120,255';
  const MOONPAL = ['#6f88d8', '#c8dcff', '#ffffff'], GOLDPAL = P.gold, REDPAL = ['#8a1030', '#ff4a5a', '#ffe0e0'];
  const arrowLook = (rgb) => (ctx, q) => K.drawArrow(ctx, { x: q.x, y: q.y, vx: 0, vy: 1 }, rgb, 1.1, false);
  const shot = (game, p, sid, x0, y0, t, rgb, k, draw) => {
    const tt = 0.18;
    K.proj({ x: x0, y: y0, vx: (t.x - x0) / tt, vy: (t.y - 60 - y0) / tt, life: tt, draw: draw || ((ctx, q) => K.drawArrow(ctx, q, rgb, 1, true)),
      onEnd() { if (alive(t)) { K.hit(game, p, sid, t, 0, 0, rgb, k); V.sparks(t.x, t.y - 60, 5, rgb, { size: 0.7 }); } } });
  };
  const inFight = (game, p) => game.time - (p._c3fight || -99) < 3;
  NC.basicHits.push((game, p) => { p._c3fight = game.time; });

  // =====================================================================================================
  // พรานจันทร์เงียบ
  // =====================================================================================================
  // the archer family's looks with no hits (online, js/online-class3-archer.js draws the server's with them:
  // backend/job_moonsniper.go, job_packalpha.go, job_maestro.go, job_outlaw.go): shot()'s flight, and the moonlight
  // line from a hero at (x, y) along a, flaring on its target e
  const shotLook = (x0, y0, t, rgb, draw) => {
    const tt = 0.18;
    K.proj({ x: x0, y: y0, vx: (t.x - x0) / tt, vy: (t.y - 60 - y0) / tt, life: tt, draw: draw || ((ctx, q) => K.drawArrow(ctx, q, rgb, 1, true)),
      onEnd() { if (alive(t)) V.sparks(t.x, t.y - 60, 5, rgb, { size: 0.7 }); } });
  };
  const moonLineLook = (x, y, a, e) => {
    const x0 = x, y0 = y - 60;
    FX.add({ type: 'cutline', x: x0, y: y0, x1: x0 + Math.cos(a) * 1000, y1: y0 + Math.sin(a) * 700, w: 18, color: MOON, life: 0.35 });
    if (e) V.flare(e.x, e.y - 60, 160, MOON, 0.3);
  };
  C3.defineJob('moonsniper', {
    name: 'พรานจันทร์เงียบ', from: 'ranger', hp: 6, sp: 3.9, rgb: MOON, pal: MOONPAL, lanes: ['สไนป์จันทร์', 'พรานจันทร์'],
    desc: 'พรานซุ่มยิงใต้แสงจันทร์ ยืนนิ่งสะสมสมาธิ นัดถัดไปทะลุทั้งแนว · ร่างตื่นจันทร์เต็มดวงหลังตัว ตีปกติยิงศรแสงเพิ่ม',
    back: { h: 270, dy: -135 },
    sig: {
      id: 'ms_still', name: 'สมาธิใต้จันทร์', type: 'phys', element: null, mul: (lv) => 1.6 + lv * 0.16, pass: (lv) => ({ dex: lv, critDmg: lv * 3 }),
      desc: (lv, m) => `DEX +${lv} ดาเมจคริ +${lv * 3}% · ยืนนิ่งได้สมาธิ 1 ขั้นทุก 0.5 วิ (สูงสุด 5) · ครบ 5 สกิลถัดไปที่โดนแรงขึ้น ${30 + lv * 4}% และยิงศรแสงจันทร์ทะลุทั้งแนวยาว 1000 ${m}% ของ ATK · เดินแล้วสมาธิหาย`,
      grow: 'แรงขึ้นทุกเลเวล',
      hooks: {
        tick(game, p, dt) {
          const still = Math.hypot(p.vx || 0, p.vy || 0) < 30;
          p.msFocus = still ? Math.min(5, (p.msFocus || 0) + dt * 2) : Math.max(0, (p.msFocus || 0) - dt * 6);
        },
        hit(game, p, e, r, o, lv) {
          if (!o.skill || (p.msFocus || 0) < 5) return;
          p.msFocus = 0;
          r.dmg = Math.round(r.dmg * (1.3 + lv * 0.04));
          const a = NC.angle(p.x, p.y, e.x, e.y);
          moonLineLook(p.x, p.y, a, e);
          for (const t of K.lineHits(game, p.x, p.y, a, 1000, 60)) if (t !== e) K.hit(game, p, 'ms_still', t, Math.cos(a) * 160, Math.sin(a) * 120, MOON);
          C3.fill(game, p, 6);
        },
      },
    },
    enh: [
      { id: 'ms_snipe', name: 'ยิงสไนป์จันทร์เงียบ', of: 'rg_snipe', lane: 'a', fx: 'echo', rgb: MOON, pal: MOONPAL, text: 'ศรแสงจันทร์ยิงซ้ำที่เป้า' },
      { id: 'ms_piercer', name: 'ศรจันทร์ทะลวง', of: 'rg_piercer', lane: 'a', fx: 'pillar', rgb: SILVER, style: 'arcane', text: 'เสาแสงจันทร์ผ่าลงเป้า' },
      { id: 'ms_trap', name: 'กับดักจันทร์แตก', of: 'rg_trap', lane: 'b', fx: 'nova', rgb: '150,240,220', text: 'คลื่นแสงจันทร์แผ่จากกับดัก' },
      { id: 'ms_triple', name: 'ห่าศรแสงจันทร์', of: 'rg_triple', lane: 'b', fx: 'rain', rgb: MOON, look: arrowLook(MOON), text: 'ห่าศรแสงตกใส่รอบเป้า' },
    ],
    awaken: {
      id: 'ms_awaken', name: 'ร่างพรานจันทร์', text: 'ตีปกติยิงศรแสงไปอีก 2 เป้าข้าง ๆ 40% ความเร็วโจมตี +15%', perk: () => ({ aspd: 15, hit: 20 }),
      hooks: {
        hit(game, p, e, r, o) {
          if (o.skill || game.time - (p._msSplit || -9) < 0.2) return;
          p._msSplit = game.time;
          for (const t of C3.others(game, e, 360, 2)) shot(game, p, 'ms_still', p.x, p.y - 70, t, MOON, 0.35);
        },
      },
    },
  });
  C3.jobs.moonsniper.looks = { line: moonLineLook, split: (p, ts) => { for (const t of ts) shotLook(p.x, p.y - 70, t, MOON); } };
  C3.jobs.moonsniper.drawFront = (ctx, game, p) => { // the focus: five small moons over the head
    const f = p.msFocus || 0; // (online another hero's record has no skills: its signature starts learned, C3:124)
    if (f <= 0 || !(lvOf(p, 'ms_still') || p.remote)) return;
    for (let i = 0; i < 5; i++) {
      const x = p.x - 40 + i * 20, y = p.y - 228, on = f >= i + 1;
      V.glow(ctx, x, y, on ? 16 : 8, MOON, on ? 0.7 : 0.25, on);
      ctx.save(); ctx.fillStyle = on ? '#f4f8ff' : 'rgba(200,220,255,0.35)'; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill(); ctx.restore();
    }
  };

  // =====================================================================================================
  // จ่าฝูงจันทร์เต็มดวง
  // =====================================================================================================
  // the spirit wolf's run from (x0, y0) along a, len long (update(q): its bites; online, js/online-class3-archer.js draws
  // the server's `wolf` event with none: backend/job_packalpha.go)
  function wolfLook(x0, y0, a, len, update) {
    const dur = 0.35;
    K.proj({ x: x0, y: y0, vx: Math.cos(a) * len / dur, vy: Math.sin(a) * len * 0.7 / dur, life: dur,
      draw(ctx, q) {
        const s = NC.SPR.c3b_packalpha;
        V.glow(ctx, q.x, q.y, 70, WOLF, 0.5, true);
        if (s) { ctx.save(); ctx.translate(q.x, q.y); if (Math.cos(a) < 0) ctx.scale(-1, 1); ctx.globalAlpha *= 0.9; ctx.drawImage(s.img, -55, -55, 110, 110 * s.h / s.w); ctx.restore(); }
        else K.drawGhost(ctx, q.x, q.y, 20, q.t, WOLF, 0.9);
      },
      update });
    V.ring(x0, y0 + 60, 20, 140, 8, WOLF, 0.35);
  }
  const wolfBite = (e, a) => K.slashAt(e.x, e.y - 50, 70, a, MOONPAL, WOLF, { sweep: 1.6, thick: 18, life: 0.2 });
  function spiritWolf(game, p, t, k) {
    const a = NC.angle(p.x, p.y, t.x, t.y), x0 = p.x - Math.cos(a) * 80, y0 = p.y - 60, len = NC.dist(x0, y0, t.x, t.y) + 260;
    const hit = new Set();
    wolfLook(x0, y0, a, len, (q) => { for (const e of K.around(game, q.x, q.y + 60, 70)) if (!hit.has(e)) { hit.add(e); K.hit(game, p, 'pa_howl', e, Math.cos(a) * 200, Math.sin(a) * 140, WOLF, k); wolfBite(e, a); } });
  }
  const howlLook = (p) => FX.text(p.x, p.y - 250, 'อาวู้ววว!', '#dff0ff', 30);
  C3.defineJob('packalpha', {
    name: 'จ่าฝูงจันทร์เต็มดวง', from: 'wolfhunter', hp: 6.6, sp: 3.9, rgb: WOLF, pal: MOONPAL, lanes: ['หมาป่าจันทร์', 'นักล่าจันทร์'],
    desc: 'ราชาหมาป่าวิญญาณ หมาป่าวิญญาณพุ่งทะลุเป้าให้เองระหว่างสู้ · ร่างตื่นหัวหมาป่ายักษ์หลังตัว หอนเสริมทีม',
    back: { h: 270, dy: -140, face: true, bob: 6 },
    sig: {
      id: 'pa_howl', name: 'หมาป่าวิญญาณ', type: 'phys', element: null, mul: (lv) => 1.5 + lv * 0.15, pass: (lv) => ({ pet: lv * 3, atk: lv }),
      desc: (lv, m) => `ระหว่างสู้ ทุก ${r1(6 - lv * 0.25)} วิ หมาป่าวิญญาณพุ่งทะลุเป้าใกล้สุดและทุกตัวในแนว ${m}% ของ ATK · สัตว์เรียกแรงขึ้น ${lv * 3}% ATK +${lv}%`,
      grow: 'ถี่ขึ้นและแรงขึ้นทุกเลเวล',
      hooks: {
        hit(game, p) { p._c3fight = game.time; },
        tick(game, p, dt, lv) {
          if (!inFight(game, p)) return;
          p._paT = (p._paT || 0) + dt * (C3.awake(p) ? 2 : 1);
          if (p._paT < 6 - lv * 0.25) return;
          p._paT = 0;
          const t = K.nearest(game, p.x, p.y, 600, 1)[0];
          if (t) spiritWolf(game, p, t);
        },
      },
    },
    enh: [
      { id: 'pa_command', name: 'สั่งขย้ำจ่าฝูง', of: 'wh_command', lane: 'a', fx: 'echo', rgb: WOLF, pal: MOONPAL, text: 'เขี้ยววิญญาณขย้ำซ้ำ' },
      { id: 'pa_pack', name: 'ฝูงวิญญาณจันทร์', of: 'wh_pack', lane: 'a', fx: 'nova', rgb: WOLF, text: 'คลื่นหอนแผ่จากเป้า' },
      { id: 'pa_blitz', name: 'เหยี่ยวจันทร์โฉบ', of: 'wh_blitz', lane: 'b', fx: 'rain', rgb: SILVER, text: 'ห่าขนนกแสงตกใส่',
        look: (ctx, q) => K.drawBlade(ctx, q.x, q.y, Math.PI, 26, 10, '#f4f8ff', SILVER) },
      { id: 'pa_fang', name: 'ธนูเขี้ยวจ่าฝูง', of: 'wh_fang', lane: 'b', fx: 'shards', rgb: '240,230,210', fill: '#fbf5e6', text: 'เขี้ยวหมาป่ากระจายออกจากเป้า' },
    ],
    awaken: {
      id: 'pa_awaken', name: 'ร่างจ่าฝูง', text: 'หอนเสริมทีม ATK +10% หมาป่าวิญญาณพุ่งถี่ขึ้นสองเท่า ATK +10% ความเร็วโจมตี +10%', perk: () => ({ atk: 10, aspd: 10, pet: 20 }),
      hooks: { start(game, p, lv) { K.buffFriends(game, p, { dur: 8 + lv * 2, rgb: WOLF, atk: 1.1 }); howlLook(p); } },
    },
  });
  C3.jobs.packalpha.looks = { wolf: wolfLook, bite: wolfBite, howl: howlLook };

  // =====================================================================================================
  // วาทยกรแห่งป่า
  // =====================================================================================================
  const drawNote = (ctx, x, y, s, fill) => {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = fill; ctx.strokeStyle = NC.OUTLINE || '#2a2435'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.55, s * 0.4, -0.4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(s * 0.4, -s * 1.5, s * 0.18, s * 1.5); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.58, -s * 1.5); ctx.quadraticCurveTo(s * 1.2, -s * 1.1, s * 0.9, -s * 0.6); ctx.stroke();
    ctx.restore();
  };
  const noteLook = (ctx, q) => { V.glow(ctx, q.x, q.y, 26, GOLD, 0.6, true); drawNote(ctx, q.x, q.y, 11, '#ffd35c'); };
  // the band's notes at ts, each flying with fly(x0, y0, t) (shot() offline; online, js/online-class3-archer.js draws
  // the server's `band` event with shotLook: backend/job_maestro.go)
  const bandLook = (p, ts, fly) => {
    ts.forEach((t, i) => V.at(i * 0.08, () => fly(p.x + (i - 1) * 40, p.y - 150, t)));
    if (ts.length) V.stars(p.x, p.y - 140, 4, '#fff0b0', GOLD, { speed: 160 });
  };
  C3.defineJob('maestro', {
    name: 'วาทยกรแห่งป่า', from: 'bard', hp: 5.5, sp: 5, rgb: GOLD, pal: GOLDPAL, lanes: ['ระบำทองคำ', 'โน้ตทองคำ'],
    desc: 'วาทยกรยามราตรี ระหว่างเล่นเพลง วงดนตรีสัตว์ป่ายิงโน้ตทองใส่ศัตรูเอง · ร่างตื่นริบบิ้นโน้ตทองหมุนรอบตัว',
    back: { h: 260, dy: -130, spin: 0.15 },
    sig: {
      id: 'mt_band', name: 'วงดนตรีแห่งป่า', type: 'phys', element: null, mul: (lv) => 0.4 + lv * 0.04,
      desc: (lv, m) => `ระหว่างเล่นเพลงหรือระบำ วงดนตรีสัตว์ป่า (กบตีกลอง นกฮูกเป่าขลุ่ย) บรรเลงยิงโน้ตทองใส่ศัตรู ${lv >= 5 ? 3 : 2} ตัวทุก 2 วิ ตัวละ ${m}% ของ ATK`,
      grow: 'Lv5 ยิง 3 ตัว · แรงขึ้นทุกเลเวล',
      hooks: {
        tick(game, p, dt, lv) {
          if (!(p.bdPerf && p.bdPerf.length)) return;
          p._mtT = (p._mtT || 0) + dt * (C3.awake(p) ? 2 : 1);
          if (p._mtT < 2) return;
          p._mtT = 0;
          const ts = K.nearest(game, p.x, p.y, 600, lv >= 5 ? 3 : 2);
          bandLook(p, ts, (x0, y0, t) => shot(game, p, 'mt_band', x0, y0, t, GOLD, 1, noteLook));
        },
      },
    },
    enh: [
      { id: 'mt_twirl', name: 'ระบำควงไฟทองคำ', of: 'bd_twirl', lane: 'a', fx: 'nova', rgb: GOLD, pal: P.fire, text: 'วงไฟทองแผ่จากเป้า' },
      { id: 'mt_lash', name: 'ฟาดแส้ดาวตก', of: 'bd_lash', lane: 'a', fx: 'chain', rgb: '230,180,255', text: 'ประกายดาวกระโดดต่อ 3–4 ตัว' },
      { id: 'mt_note', name: 'โน้ตทองคำ', of: 'bd_note', lane: 'b', fx: 'shards', rgb: GOLD, fill: '#fff0b0', text: 'โน้ตทองแตกกระจายจากเป้า' },
      { id: 'mt_rain', name: 'ฝนโน้ตทองคำ', of: 'bd_noterain', lane: 'b', fx: 'rain', rgb: GOLD, look: noteLook, text: 'ห่าโน้ตทองตกใส่' },
    ],
    awaken: { id: 'mt_awaken', name: 'ร่างวาทยกร', text: 'วงดนตรียิงถี่ขึ้นสองเท่า DEX +10 ความเร็วโจมตี +10%', perk: () => ({ dex: 10, aspd: 10 }) },
  });
  C3.jobs.maestro.looks = { band: (p, ts) => bandLook(p, ts, (x0, y0, t) => shotLook(x0, y0, t, GOLD, noteLook)) };

  // =====================================================================================================
  // มือปืนเที่ยงคืน
  // =====================================================================================================
  FX.def('c3cross', (ctx, q, u) => { // a crosshair on a marked target
    const e = q.e, a = 1 - u * 0.3, r = 40 - u * 12;
    ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = `rgba(${RED},0.95)`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(e.x, e.y - 60, r, 0, TAU); ctx.stroke();
    for (let i = 0; i < 4; i++) { const b = i * Math.PI / 2 + u * 2; ctx.beginPath(); ctx.moveTo(e.x + Math.cos(b) * r * 0.6, e.y - 60 + Math.sin(b) * r * 0.6); ctx.lineTo(e.x + Math.cos(b) * r * 1.4, e.y - 60 + Math.sin(b) * r * 1.4); ctx.stroke(); }
    ctx.restore();
  });
  // midnight's looks on the marked ts, hit(t) as each shot lands (online, js/online-class3-archer.js draws the server's
  // `deadeye` event with none, backend/job_outlaw.go; another hero's midnight does not stop or flash the screen: mine
  // is false)
  function deadeyeLook(game, p, ts, mine, hit) {
    if (mine !== false) { V.stop(game, 0.12); V.flash('60,20,40', 0.18, 0.4, 'source-over'); }
    C3.shout(p, 'เที่ยงคืน!', '#ffb0b0');
    for (const t of ts) FX.add({ type: 'c3cross', layer: 'glow', x: t.x, y: t.y, e: t, life: 0.45 });
    ts.forEach((t, i) => V.at(0.35 + i * 0.06, () => {
      if (!alive(t)) return;
      FX.add({ type: 'cutline', x: p.x, y: p.y - 70, x1: t.x, y1: t.y - 60, w: 8, color: RED, life: 0.2 });
      V.flare(t.x, t.y - 60, 90, RED, 0.25);
      if (hit) hit(t);
    }));
  }
  function deadeye(game, p, lv) {
    const ts = K.nearest(game, p.x, p.y, 700, 3 + (lv >= 5 ? 1 : 0) + (lv >= 10 ? 1 : 0) + (C3.awake(p) ? 1 : 0));
    if (!ts.length) return;
    deadeyeLook(game, p, ts, true, (t) => K.hit(game, p, 'ol_deadeye', t, 0, 0, RED, 1, { crit: true }));
    C3.fill(game, p, 8);
  }
  C3.defineJob('outlaw', {
    name: 'มือปืนเที่ยงคืน', from: 'gunslinger', hp: 5.5, sp: 3.9, rgb: RED, pal: REDPAL, lanes: ['ปืนพกเที่ยงคืน', 'ลูกซองเที่ยงคืน'],
    desc: 'มือปืนนอกกฎหมายยามเที่ยงคืน ยิงครบ 12 นัด เวลาช้าลงแล้วเล็งยิงหลายเป้า · ร่างตื่นกระสุนหกนัดโคจร ไม่ต้องบรรจุ',
    back: { h: 240, dy: -125, spin: 0.7 },
    sig: {
      id: 'ol_deadeye', name: 'เที่ยงคืนตรง', type: 'phys', element: null, mul: (lv) => 0.8 + lv * 0.08,
      desc: (lv, m) => `ยิงปกติครบ 12 นัด เวลาช้าลงชั่วครู่ เล็ง ${3 + (lv >= 5 ? 1 : 0) + (lv >= 10 ? 1 : 0)} เป้าใกล้สุดแล้วยิงพร้อมกัน นัดละ ${m}% ของ ATK`,
      grow: 'Lv5 4 เป้า · Lv10 5 เป้า · แรงขึ้นทุกเลเวล',
      hooks: {
        hit(game, p, e, r, o, lv) {
          if (o.skill) return;
          p.olShots = (p.olShots || 0) + 1;
          if (p.olShots >= 12) { p.olShots = 0; deadeye(game, p, lv); }
        },
        tick(game, p) { if (C3.awake(p)) { p.gsAmmo = 6; p.gsReload = 0; } }, // (awake: no reloading)
      },
    },
    enh: [
      { id: 'ol_triple', name: 'ยิงสามนัดเที่ยงคืน', of: 'gs_triple', lane: 'a', fx: 'echo', rgb: RED, pal: REDPAL, text: 'กระสุนเงายิงซ้ำ' },
      { id: 'ol_ricochet', name: 'กระสุนสะท้อนดาว', of: 'gs_ricochet', lane: 'a', fx: 'chain', rgb: RED, text: 'กระสุนแดงกระโดดต่อ 3–4 ตัว' },
      { id: 'ol_buckshot', name: 'ลูกปรายดาวแดง', of: 'gs_buckshot', lane: 'b', fx: 'shards', rgb: RED, fill: '#ffd0d0', text: 'ดาวแดงแตกกระจายจากเป้า' },
      { id: 'ol_stars', name: 'ยิงดาวตกนับร้อย', of: 'gs_stars', lane: 'b', fx: 'rain', rgb: '255,220,150', text: 'ห่าดาวตกลงใส่' },
    ],
    awaken: { id: 'ol_awaken', name: 'ร่างมือปืนเที่ยงคืน', text: 'ไม่ต้องบรรจุกระสุน เที่ยงคืนตรงเล็งเพิ่ม 1 เป้า', perk: () => ({}) },
  });
  C3.jobs.outlaw.looks = { deadeye: deadeyeLook };
  C3.jobs.outlaw.drawFront = (ctx, game, p) => { // twelve ticks round a small clock: the count to midnight
    const n = p.olShots || 0; // (online another hero's record has no skills: its signature starts learned, C3:124)
    if (!n || !(lvOf(p, 'ol_deadeye') || p.remote)) return;
    const x = p.x + 60, y = p.y - 215;
    ctx.save();
    for (let i = 0; i < 12; i++) { const b = -Math.PI / 2 + (i / 12) * TAU; ctx.fillStyle = i < n ? '#ff5a5a' : 'rgba(255,200,200,0.3)'; ctx.beginPath(); ctx.arc(x + Math.cos(b) * 12, y + Math.sin(b) * 12, 2.6, 0, TAU); ctx.fill(); }
    ctx.restore();
  };

  // =====================================================================================================
  // นักฆ่าจันทรคราส
  // =====================================================================================================
  // the eclipse's looks (online, js/online-class3-rogue.js draws the server's, backend/job_eclipse.go; another hero's
  // eclipse does not darken the screen: mine is false)
  const eclipseLook = (p, mine) => {
    if (mine !== false) V.flash('10,6,20', 0.35, 0.5, 'source-over');
    FX.add({ type: 'vglow', x: p.x, y: p.y - 120, r0: 40, r1: 220, rgb: '255,200,80', a: 0.8, life: 0.5, hot: true });
    C3.shout(p, 'จันทรคราส!', '#ffd89a');
  };
  const eclipseSlash = (p, t) => {
    V.ghost && V.ghost(p, '#2a1a3e', 0.3);
    K.slashAt(t.x, t.y - 50, 120, rand(0, TAU), ['#1a1026', '#ffd35c', '#fff6d0'], '255,200,80', { sweep: 2.2, thick: 30, life: 0.25 });
    K.slashAt(t.x, t.y - 50, 120, rand(0, TAU), ['#1a1026', '#ffd35c', '#fff6d0'], '255,200,80', { sweep: 2.2, thick: 30, life: 0.25 });
  };
  function eclipse(game, p, lv) {
    p.ecDark = 0;
    const ts = K.nearest(game, p.x, p.y, 480, 3);
    if (!ts.length) return;
    eclipseLook(p);
    ts.forEach((t, i) => V.at(0.12 + i * 0.12, () => {
      if (!alive(t)) return;
      eclipseSlash(p, t);
      K.hit(game, p, 'ec_dark', t, 0, 0, '255,200,80', 1, { crit: true, big: true });
    }));
    C3.fill(game, p, 10);
  }
  C3.defineJob('eclipse', {
    name: 'นักฆ่าจันทรคราส', from: 'assassin', hp: 7.2, sp: 3.3, rgb: '255,200,80', pal: ['#1a1026', '#ffd35c', '#fff6d0'], lanes: ['คริคราส', 'พิษคราส'],
    desc: 'นักฆ่าแห่งคราส คริสะสมความมืด ครบสิบฟันสามเป้าในพริบตา · ร่างตื่นวงคราสหลังตัว',
    back: { h: 260, dy: -130, spin: 0.08 },
    sig: {
      id: 'ec_dark', name: 'สะสมความมืด', type: 'phys', element: 'shadow', mul: (lv) => 1.4 + lv * 0.14,
      desc: (lv, m) => `ตีคริได้ความมืด 1 ชั้น (สูงสุด 10) · ครบ 10 สกิลถัดไปเรียก "จันทรคราส" ฟัน 3 เป้าใกล้สุด ตัวละ ${m}% ของ ATK คริแน่นอน`,
      grow: 'แรงขึ้นทุกเลเวล',
      hooks: {
        hit(game, p, e, r) { if (r.crit) p.ecDark = Math.min(10, (p.ecDark || 0) + 1); },
        cast(game, p, id, lv) { if ((p.ecDark || 0) >= 10 && SK[id] && SK[id].active) V.at(0.15, () => eclipse(game, p, lv)); },
      },
    },
    enh: [
      { id: 'ec_twin', name: 'เขี้ยวคู่คราส', of: 'as_twin', lane: 'a', fx: 'echo', rgb: '255,120,120', pal: REDPAL, text: 'เงามีดฟันไขว้ซ้ำ' },
      { id: 'ec_meteor', name: 'อุกกาบาตเงาคราส', of: 'as_meteor', lane: 'a', fx: 'nova', rgb: '255,200,80', text: 'วงคราสสีทองแผ่จากเป้า' },
      { id: 'ec_grim', name: 'เขี้ยวมัจจุราชคราส', of: 'as_grimtooth', lane: 'b', fx: 'spikes', rgb: DARK, pal: P.shadow, text: 'หนามเงาพุ่งจากพื้นเป็นแนว' },
      { id: 'ec_splash', name: 'ระเบิดพิษคราส', of: 'as_splasher', lane: 'b', fx: 'shards', rgb: '120,230,90', fill: '#dfffc0', text: 'เศษพิษกระจายจากเป้า' },
    ],
    awaken: { id: 'ec_awaken', name: 'ร่างจันทรคราส', text: 'คริ +10 ดาเมจคริ +10%', perk: () => ({ crit: 10, critDmg: 10 }) },
  });
  C3.jobs.eclipse.looks = { eclipse: eclipseLook, slash: eclipseSlash };
  C3.jobs.eclipse.drawFront = (ctx, game, p) => { // (online another hero's record has no skills: its signature starts learned, C3:124)
    const n = p.ecDark || 0;
    if (!n || !(lvOf(p, 'ec_dark') || p.remote)) return;
    const x = p.x, y = p.y - 226, r = 12;
    ctx.save();
    V.glow(ctx, x, y, 30, '255,200,80', n >= 10 ? 0.7 : 0.3, true);
    ctx.fillStyle = '#fff2c0'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1026'; ctx.beginPath(); ctx.arc(x + r * 2 * (1 - n / 10), y, r, 0, TAU); ctx.fill(); // (the dark disc slides over the moon)
    ctx.restore();
  };

  // =====================================================================================================
  // จ้าวเงาร้อยร่าง
  // =====================================================================================================
  const copies = (p) => (lvOf(p, 'sl_legion') >= 5 ? 2 : 1) + (C3.awake(p) ? 2 : 0);
  // a shadow copy's strike from (sx, sy) at e (online, js/online-class3-rogue.js draws the server's: backend/job_shadowlord.go)
  const copyLook = (sx, sy, e) => {
    FX.add({ type: 'cutline', x: sx, y: sy, x1: e.x, y1: e.y - 50, w: 8, color: VIO, life: 0.18 });
    K.slashAt(e.x, e.y - 50, 90, rand(0, TAU), P.shadow, VIO, { sweep: 1.8, thick: 20, life: 0.2 });
  };
  C3.defineJob('shadowlord', {
    name: 'จ้าวเงาร้อยร่าง', from: 'shinobi', hp: 6.6, sp: 3.9, rgb: VIO, pal: P.shadow, lanes: ['ซัดเงา', 'คาถาเงา'],
    desc: 'จ้าวแห่งเงา ร่างเงายืนข้างตัวและทำท่าซ้ำตามสกิล · ร่างตื่นร่างเงาเพิ่มอีกสองร่าง',
    back: { h: 250, dy: -118, dx: -50, face: true, bob: 3, shine: false },
    sig: {
      id: 'sl_legion', name: 'ร่างเงาถาวร', type: 'phys', element: 'shadow', mul: () => { const q = NC.game && NC.game.player; return (q && q.c3 && q.c3.mul && q.c3.mul.sl_legion) || 1; }, // (a share of the hit it copies)
      desc: (lv) => `ร่างเงา ${lv >= 5 ? 2 : 1} ร่างยืนข้างตัว ทุกครั้งที่สกิลโดน ร่างเงาทำซ้ำ ${r1(15 + lv * 1.5)}% ของฮิตนั้น (ครั้งละ 1 ร่าง)`,
      grow: 'Lv5 ร่างเงา 2 ร่าง · ซ้ำแรงขึ้นทุกเลเวล',
      hooks: { // (js/throwstar.js replaces this hit: the copy throws a shadow star at the monster instead of the cut)
        hit(game, p, e, r, o, lv) {
          if (!o.skill || (e._slT || 0) > game.time) return;
          e._slT = game.time + 0.18;
          const st = C3.state(p);
          (st.mul || (st.mul = {})).sl_legion = (o.mul || 1) * (0.15 + lv * 0.015) * (C3.awake(p) ? 1.3 : 1);
          const n = copies(p), k = (p._slI = ((p._slI || 0) + 1) % n);
          V.at(0.22, () => {
            if (!alive(e)) return;
            const side = k % 2 ? 1 : -1, sx = p.x + side * (50 + Math.floor(k / 2) * 40), sy = p.y - 60;
            copyLook(sx, sy, e);
            K.hit(game, p, 'sl_legion', e, 0, 0, VIO);
          });
        },
      },
    },
    enh: [
      { id: 'sl_huuma', name: 'ดาวยักษ์พายุเงา', of: 'sh_huuma', lane: 'a', fx: 'shards', rgb: VIO, fill: '#e6dcff', text: 'เศษเงาคมกระจายจากเป้า' },
      { id: 'sl_katon', name: 'คาถาไฟเงาม่วง', of: 'sh_katon', lane: 'a', fx: 'pillar', rgb: '220,110,255', style: 'occult', text: 'เสาไฟสีม่วงผ่าลงเป้า' },
      { id: 'sl_raiton', name: 'คาถาสายฟ้าร้อยร่าง', of: 'sh_raiton', lane: 'b', fx: 'chain', rgb: '255,236,120', text: 'สายฟ้ากระโดดต่อ 3–4 ตัว' },
      { id: 'sl_wind', name: 'ใบมีดวายุเงา', of: 'sh_windblade', lane: 'b', fx: 'echo', rgb: '140,255,150', pal: P.wind, text: 'เงาใบมีดลมฟันซ้ำ' },
    ],
    awaken: { id: 'sl_awaken', name: 'ร่างจ้าวเงา', text: 'ร่างเงาเพิ่ม 2 ร่าง ทำซ้ำแรงขึ้น 30% AGI +10', perk: () => ({ agi: 10 }) },
  });
  C3.jobs.shadowlord.looks = { copy: copyLook };
  C3.jobs.shadowlord.drawBack = (ctx, game, p) => { // the shadow copies: the hero himself, dark violet, a step to either side
    if (!(lvOf(p, 'sl_legion') || p.remote) || !p.pose) return; // (online another hero's count is its slCopies meter)
    const n = p.remote ? p.slCopies || 0 : copies(p), t = game.time;
    for (let k = 0; k < n; k++) {
      const side = k % 2 ? 1 : -1, dx = side * (50 + Math.floor(k / 2) * 40) * (p.face || 1), dy = -6 - Math.floor(k / 2) * 6;
      NC.drawHero(ctx, p.equip, p.pose, p.x + dx, p.y + dy, { alpha: 0.42 + 0.06 * Math.sin(t * 4 + k), tint: ['#3a1f5c', 0.85] });
    }
  };

  // =====================================================================================================
  // ผู้เก็บเกี่ยวจันทรา
  // =====================================================================================================
  // the crescent's looks round its hits (online, js/online-class3-rogue.js draws the server's, backend/job_harvester.go,
  // with no hits; another hero's crescent does not flash or shake the screen: mine is false)
  const crescentLook = (game, p, cx, cy, a, hits, mine) => {
    if (mine !== false) V.flash('200,225,255', 0.2, 0.4);
    K.slashAt(cx, cy - 30, 380, a + Math.PI / 2, MOONPAL, '200,225,255', { sweep: 2.8, thick: 70, life: 0.4 });
    K.slashAt(cx, cy - 30, 300, a + Math.PI / 2, MOONPAL, '200,225,255', { sweep: 2.6, thick: 40, life: 0.35 });
    if (hits) hits();
    if (mine !== false) { V.shake(game, 12); V.stop(game, 0.06); }
    C3.shout(p, 'จันทร์เต็มดวง!', '#e6f2ff');
  };
  function crescent(game, p, lv) {
    p.hvPhase = 0;
    const a = p.aim, cx = p.x + Math.cos(a) * 200, cy = p.y + Math.sin(a) * 120;
    crescentLook(game, p, cx, cy, a, () => {
      for (const e of K.around(game, cx, cy, 420)) K.hit(game, p, 'hv_phase', e, Math.cos(a) * 300, Math.sin(a) * 220, '200,225,255', 1, { big: true });
    });
    C3.fill(game, p, 15);
  }
  C3.defineJob('harvester', {
    name: 'ผู้เก็บเกี่ยวจันทรา', from: 'reaper', hp: 7.2, sp: 3.3, rgb: '190,220,255', pal: MOONPAL, lanes: ['เคียวจันทร์', 'เคียวคู่จันทร์'],
    desc: 'ผู้เก็บเกี่ยวใต้จันทร์ วิญญาณทำให้จันทร์ขึ้นทีละข้าง เต็มดวงฟันเสี้ยวจันทร์ยักษ์ · ร่างตื่นจันทร์ซีดดวงใหญ่หลังตัว',
    back: { h: 280, dy: -140 },
    sig: {
      id: 'hv_phase', name: 'จันทร์เก็บเกี่ยว', type: 'phys', element: null, mul: (lv) => 3.5 + lv * 0.35,
      desc: (lv, m) => `ได้วิญญาณหรือฆ่าศัตรู จันทร์ขึ้น 1 ข้าง ครบ 8 ข้าง สกิลถัดไปฟันเสี้ยวจันทร์ยักษ์กว้าง 420 ${m}% ของ ATK`,
      grow: 'แรงขึ้นทุกเลเวล',
      hooks: {
        tick(game, p) { const s = p.rpSouls || 0; if (s > (p._hvSouls || 0)) p.hvPhase = Math.min(8, (p.hvPhase || 0) + (s - (p._hvSouls || 0))); p._hvSouls = s; },
        kill(game, p) { p.hvPhase = Math.min(8, (p.hvPhase || 0) + 1); if (C3.awake(p)) p.rpSouls = Math.min(10, (p.rpSouls || 0) + 1); },
        cast(game, p, id, lv) { if ((p.hvPhase || 0) >= 8 && SK[id] && SK[id].active) V.at(0.15, () => crescent(game, p, lv)); },
      },
    },
    enh: [
      { id: 'hv_sweep', name: 'ฟันเก็บเกี่ยวจันทร์', of: 'rp_sweep', lane: 'a', fx: 'nova', rgb: '190,220,255', text: 'วงเสี้ยวจันทร์แผ่จากเป้า' },
      { id: 'hv_execute', name: 'ประหารจันทร์เต็มดวง', of: 'rp_execute', lane: 'a', fx: 'pillar', rgb: '220,235,255', style: 'arcane', text: 'เสาแสงจันทร์ผ่าลงเป้า' },
      { id: 'hv_return', name: 'เคียววกกลับจันทร์', of: 'rp_return', lane: 'b', fx: 'echo', rgb: '160,200,255', pal: MOONPAL, text: 'เงาเคียวฟันซ้ำ' },
      { id: 'hv_hook', name: 'เกี่ยววิญญาณจันทร์', of: 'rp_hook', lane: 'b', fx: 'chain', rgb: '130,200,255', text: 'โซ่วิญญาณกระโดดต่อ 3–4 ตัว' },
    ],
    awaken: { id: 'hv_awaken', name: 'ร่างผู้เก็บเกี่ยว', text: 'ฆ่าได้วิญญาณเพิ่มอีก 1 ATK +10% เดินเร็วขึ้น 10%', perk: () => ({ atk: 10, spd: 10 }) },
  });
  C3.jobs.harvester.looks = { crescent: crescentLook };
  C3.jobs.harvester.drawFront = (ctx, game, p) => { // the moon over the head, waxing
    const f = (p.hvPhase || 0) / 8;
    if (!(lvOf(p, 'hv_phase') || p.remote)) return; // (online another hero's record has no skills: its signature starts learned)
    const x = p.x, y = p.y - 228, r = 11;
    ctx.save();
    V.glow(ctx, x, y, 34, '200,225,255', 0.2 + f * 0.5, f >= 1);
    ctx.fillStyle = 'rgba(40,50,80,0.8)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#eef6ff'; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2); ctx.ellipse(x, y, r * Math.abs(1 - 2 * f), r, 0, Math.PI / 2, -Math.PI / 2, f < 0.5); ctx.fill();
    ctx.restore();
  };

  // =====================================================================================================
  // จ้าวโรงหุ่นราตรี
  // =====================================================================================================
  // the curtain's looks (online, js/online-class3-rogue.js draws the server's, backend/job_showmaster.go: the drapes, and
  // 0.3 s on K.nova's own burst with no hits; another hero's does not flash or shake the screen: mine is false)
  const curtainLook = (x, y) => {
    for (const s of [-1, 1]) FX.add({ type: 'vproj', layer: 'glow', x, y, life: 0.5, draw(ctx, q) {
      const u = q.t / 0.5, w = 180 * (u < 0.5 ? u * 2 : 1), a = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      ctx.save(); ctx.globalAlpha *= a * 0.85; ctx.fillStyle = '#9a1a2e'; ctx.fillRect(s < 0 ? x - 190 : x + 190 - w, y - 260, w, 280);
      ctx.fillStyle = '#ffd35c'; ctx.fillRect(s < 0 ? x - 190 : x + 190 - w, y - 262, w, 8); ctx.restore();
    } });
  };
  const curtainNova = (mine) => ({ rgb: GOLD, kb: 260, stars: 18, starFill: '#fff0b0', shake: mine !== false ? 8 : 0, flash: mine !== false ? GOLD : undefined });
  const curtainBurst = (game, p, x, y, mine) => { K.burst(game, x, y, 240, GOLD, curtainNova(mine)); C3.shout(p, 'ปิดม่าน!', '#ffe7a0'); };
  const actLook = (p, n) => FX.text(p.x, p.y - 200, 'องก์ ' + n, '#ffe7a0', 26);
  function curtain(game, p, lv) {
    p.soActs = [];
    const t = K.nearest(game, p.x, p.y, 600, 1)[0], [x, y] = t ? [t.x, t.y] : [p.x, p.y];
    curtainLook(x, y);
    V.at(0.3, () => {
      K.nova(game, p, 'so_acts', x, y, 240, curtainNova());
      C3.shout(p, 'ปิดม่าน!', '#ffe7a0');
    });
    C3.fill(game, p, 12);
  }
  C3.defineJob('showmaster', {
    name: 'จ้าวโรงหุ่นราตรี', from: 'puppeteer', hp: 6, sp: 4.4, rgb: GOLD, pal: GOLDPAL, lanes: ['หุ่นทองคำ', 'ด้ายทองคำ'],
    desc: 'เจ้าของโรงละครหุ่นยามราตรี ใช้สกิลครบสามองก์ ม่านทองปิดฉากระเบิด · ร่างตื่นหุ่นอัศวินยักษ์โผล่ข้างตัว',
    back: { h: 220, dy: -110, dx: 95, face: true, bob: 10, shine: false },
    sig: {
      id: 'so_acts', name: 'การแสดงสามองก์', type: 'phys', element: null, mul: (lv) => 2 + lv * 0.2, pass: (lv) => ({ pet: lv * 2 }),
      desc: (lv, m) => `ใช้สกิลครบ 3 ครั้งภายใน 6 วิ ม่านทองปิดฉากที่เป้า ระเบิดวงกว้าง 240 ${m}% ของ ATK · หุ่นรบแรงขึ้น ${lv * 2}%`,
      grow: 'แรงขึ้นทุกเลเวล',
      hooks: {
        cast(game, p, id, lv) {
          if (!SK[id] || !SK[id].active) return;
          p.soActs = (p.soActs || []).filter((t) => game.time - t < 6);
          p.soActs.push(game.time);
          actLook(p, p.soActs.length);
          if (p.soActs.length >= 3) V.at(0.2, () => curtain(game, p, lv));
        },
      },
    },
    enh: [
      { id: 'so_dance', name: 'ระบำหุ่นยักษ์', of: 'pp_dance', lane: 'a', fx: 'nova', rgb: GOLD, text: 'วงทองแผ่จากเป้า' },
      { id: 'so_swap', name: 'สลับร่างละคร', of: 'pp_swap', lane: 'a', fx: 'shards', rgb: GOLD, fill: '#fff0b0', text: 'เศษทองกระจายจากเป้า' },
      { id: 'so_stretch', name: 'ขึงด้ายทองคำ', of: 'pp_stretch', lane: 'b', fx: 'chain', rgb: GOLD, text: 'ด้ายทองกระโดดต่อ 3–4 ตัว' },
      { id: 'so_bind', name: 'รัดด้ายทองคำ', of: 'pp_bind', lane: 'b', fx: 'pillar', rgb: GOLD, style: 'holy', text: 'เสาทองผ่าลงเป้า' },
    ],
    awaken: { id: 'so_awaken', name: 'ร่างจ้าวโรงหุ่น', text: 'หุ่นอัศวินยักษ์โผล่ข้างตัว หุ่นรบแรงขึ้น 50% DEX +10', perk: () => ({ pet: 50, dex: 10 }) },
  });
  C3.jobs.showmaster.looks = { act: actLook, curtain: curtainLook, burst: curtainBurst };

  C3.finish();
})();
