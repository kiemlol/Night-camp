/* class3_skills_a.js — the class-3 jobs of the knight and mage families (class3_core.js has the machinery):
     ผู้พิทักษ์รุ่งสาง (พาลาดิน)       แสงรุ่งสาง: damage taken and skill hits fill the dawn; full, the next skill lets out a sun burst
     อัศวินผสานมังกร (อัศวินมังกร)     เลือดมังกรเดือด: skill hits leave embers, five of them blow up as dragon fire
     นักดาบกลุ่มดาว (นักดาบ)          กลุ่มดาวคมดาบ: five blade marks join into a star and go off together
     จอมคลั่งจันทร์เลือด (เบอร์เซิร์กเกอร์) จันทร์เลือด: the less HP, the harder the hits, and lifesteal below half HP
     จอมเวทดาวฤกษ์ (จอมเวทไฟ)         ใจดาว: over 80 heat no self-burn and hotter fire; venting a full gauge is a supernova
     จ้าวเหมันต์ (จอมเวทน้ำแข็ง)       รูปปั้นน้ำแข็ง: monsters that die frozen stand as ice statues that shoot shards
     จอมเวทดาราจักร (อาร์คเมจ)        ดาวเคราะห์โคจร: each element cast adds a planet; three different ones align and blast
     จ้าวคืนเดือนดับ (วอร์ล็อกตะเกียง)  คำสาปติดต่อ: a monster the hexlord's skills hit that dies passes ghost fire on */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, SK = NC.SKILLS, C3 = NC.C3;
  const { C, P, TAU } = K;
  const rand = NC.rand, alive = K.alive;
  const lvOf = (p, id) => NC.skillLv(p, id);
  const r1 = (v) => Math.round(v * 10) / 10;
  const GOLD = '255,214,110', SUN = '255,196,80', FIRE = '255,140,50', MOON = '170,215,255', ICE = '140,210,255', VIO = '190,140,255', TEAL = '90,240,210', DARK = '170,110,255';
  const SUNPAL = ['#ff9a1a', '#ffd35c', '#fffbe0'], MOONPAL = ['#6f88d8', '#c8dcff', '#ffffff'], TEALPAL = ['#1e8f86', '#5ff0d2', '#e8fff9'];

  // =====================================================================================================
  // ผู้พิทักษ์รุ่งสาง
  // =====================================================================================================
  // the knight family's looks, apart from their rules: online, js/online-class3-knight.js draws the server's events
  // (backend/job_dawnwarden.go, job_dragonbound.go, job_starblade.go, job_bloodmoon.go) with them; mine is false for
  // another hero's, which neither shakes nor flashes the screen
  const KL = (C3.knightLooks = {});
  const quiet = (o, mine) => (mine ? o : Object.assign({}, o, { shake: 0, flash: undefined }));
  const dawn = (p) => p.dwDawn || 0;
  const SUN_BURST = { rgb: SUN, kb: 260, stars: 18, starFill: '#fff6d0', shake: 9, flash: SUN, decal: 'scorch' };
  KL.sunBurst = (game, p, mine) => {
    K.burst(game, p.x, p.y, 230, SUN, quiet(SUN_BURST, mine)); // (K.nova's own look: dw_dawn's areas never grow)
    V.beam(p.x, p.y, 200, 700, SUN, 0.5);
    for (let i = 0; i < 12; i++) V.at(i * 0.02, () => K.slashAt(p.x, p.y - 40, 170, (i / 12) * TAU, SUNPAL, SUN, { sweep: 0.8, thick: 16, life: 0.3 }));
    C3.shout(p, 'ตะวันแตก!', '#ffe7a0');
  };
  function sunBurst(game, p, lv) {
    p.dwDawn = 0;
    KL.sunBurst(game, p, true);
    K.nova(game, p, 'dw_dawn', p.x, p.y, 230, Object.assign({ fx: false }, SUN_BURST));
    K.heal(game, p, p.maxHp * 0.1);
    C3.fill(game, p, 20);
  }
  C3.defineJob('dawnwarden', {
    name: 'ผู้พิทักษ์รุ่งสาง', from: 'paladin', hp: 9.5, sp: 3.3, rgb: SUN, pal: SUNPAL, lanes: ['ดาบแสงตะวัน', 'ปราการรุ่งสาง'],
    desc: 'อัศวินแห่งรุ่งสาง ดาเมจที่รับสะสมเป็นแสงตะวัน ปล่อยเป็นตะวันแตก · ปลุกพลังสกิลพาลาดิน · ร่างตื่นมีจานตะวันหลังตัว',
    back: { h: 270, dy: -115, spin: 0.12 },
    sig: {
      id: 'dw_dawn', name: 'แสงรุ่งสาง', type: 'phys', element: 'holy', mul: (lv) => 2.2 + lv * 0.25,
      desc: (lv, m) => `ดาเมจที่รับ (1% HP = 1.5 แต้ม) กับสกิลที่โดนศัตรู (2 แต้ม) สะสมแสงรุ่งสาง เต็ม 100 สกิลถัดไปปล่อย "ตะวันแตก" รอบตัว ${m}% ของ ATK ธาตุแสง + ฮีล 10% HP · ตอนนี้ ${Math.round((NC.game && NC.game.player.dwDawn) || 0)}`,
      grow: 'ตะวันแตกแรงขึ้นทุกเลเวล',
      hooks: {
        hurt(game, p, dmg) { p.dwDawn = Math.min(100, dawn(p) + (dmg / Math.max(1, p.maxHp)) * 150); return dmg; },
        hit(game, p, e, r, o) { if (o.skill && o.sid !== 'dw_dawn') p.dwDawn = Math.min(100, dawn(p) + 2); },
        cast(game, p, id, lv) { if (dawn(p) >= 100 && SK[id] && SK[id].active) V.at(0.1, () => sunBurst(game, p, lv)); },
      },
    },
    enh: [
      { id: 'dw_strike', name: 'ฟันตะวันขึ้น', of: 'pal_strike', lane: 'a', fx: 'pillar', rgb: SUN, style: 'holy', text: 'เสาแสงตะวันผ่าลงเป้า' },
      { id: 'dw_cross', name: 'ตะวันแผดเผา', of: 'pal_cross', lane: 'a', fx: 'nova', rgb: SUN, pal: SUNPAL, text: 'คลื่นแสงตะวันแผ่เป็นวงจากเป้า' },
      { id: 'dw_chain', name: 'โล่ตะวันพิฆาต', of: 'pal_shieldchain', lane: 'b', fx: 'chain', rgb: GOLD, text: 'สายฟ้าทองกระโดดต่อไปอีก 3–4 ตัว' },
      { id: 'dw_hands', name: 'มือรุ่งอรุณ', of: 'pal_layhands', lane: 'b', fx: 'heal', rgb: SUN, text: 'ฮีลตัวเราและเพื่อนรอบตัวอีกก้อนตาม MATK' },
    ],
    awaken: { id: 'dw_awaken', name: 'ร่างอาทิตย์อุทัย', text: 'รับดาเมจลดลง 20% (+2% ต่อเลเวล) DEF +10', perk: (lv) => ({ taken: 20 + lv * 2, def: 10 }) },
  });
  C3.jobs.dawnwarden.drawFront = (ctx, game, p) => { // the dawn gathering: a small sun over the head that grows
    const v = dawn(p) / 100;
    if (v <= 0 || !lvOf(p, 'dw_dawn')) return;
    const x = p.x, y = p.y - 225, r = 6 + v * 12;
    V.glow(ctx, x, y, r * 3.2, SUN, 0.35 + (v >= 1 ? 0.25 * Math.sin(game.time * 10) : 0), true);
    K.drawStar(ctx, x, y, r, game.time * 0.8, 8, v >= 1 ? '#fff6c8' : '#ffd35c');
  };

  // =====================================================================================================
  // อัศวินผสานมังกร
  // =====================================================================================================
  const EMBER_BLAST = { rgb: FIRE, kb: 160, stars: 6, starFill: '#ffe0a0', decal: 'scorch' };
  KL.ember = (e) => V.flameAt(e.x + rand(-20, 20), e.y - rand(30, 80), 18, 30, P.fire, 0.35, { vy: -80 });
  KL.emberBlast = (game, x, y, mine) => {
    K.burst(game, x, y, 130, FIRE, quiet(EMBER_BLAST, mine)); // (K.nova's own look: db_ember's areas never grow)
    K.flames(x, y, 7, 90, { pal: P.fire });
    V.flare(x, y - 60, 140, FIRE, 0.3);
  };
  KL.breath = (p, a) => {
    for (let i = 0; i < 5; i++) V.at(i * 0.03, () => V.flameAt(p.x + Math.cos(a) * (60 + i * 36), p.y - 60 + Math.sin(a) * (60 + i * 36) * 0.6, 34 + i * 6, 50 + i * 8, P.fire, 0.35, { vx: Math.cos(a) * 240, vy: -40 }));
  };
  function emberBlast(game, p, e, lv) {
    e._ember = 0; e._emberCd = game.time + 1.2;
    KL.emberBlast(game, e.x, e.y, true);
    K.nova(game, p, 'db_ember', e.x, e.y, 130, Object.assign({ fx: false }, EMBER_BLAST));
    C3.fill(game, p, 5);
  }
  C3.defineJob('dragonbound', {
    name: 'อัศวินผสานมังกร', from: 'dragonknight', hp: 9, sp: 2.8, rgb: '255,110,60', pal: P.fire, lanes: ['หอกมังกร', 'เพลิงมังกร'],
    desc: 'อัศวินที่มีเลือดมังกร สกิลทิ้งเกล็ดไฟ ครบห้าชั้นระเบิดไฟมังกร · ร่างตื่นปีกมังกรกาง ตีปกติพ่นไฟ',
    back: { h: 250, dy: -120, bob: 7 },
    sig: {
      id: 'db_ember', name: 'เลือดมังกรเดือด', type: 'phys', element: 'fire', mul: (lv) => 2 + lv * 0.2, pass: (lv) => ({ atk: lv }),
      desc: (lv, m) => `ATK +${lv}% · สกิลที่โดนศัตรูทิ้งเกล็ดไฟ 1 ชั้น (หายใน 6 วิ) ครบ 5 ชั้นระเบิดไฟมังกร ${m}% ของ ATK รอบตัวนั้น`,
      grow: 'ระเบิดไฟมังกรแรงขึ้นทุกเลเวล',
      hooks: {
        hit(game, p, e, r, o, lv) {
          if (!o.skill || (e._emberCd || 0) > game.time) return; // (after a blast the scales need 1.2 s to heat up again)
          if (game.time - (e._emberT || -99) > 6) e._ember = 0;
          e._emberT = game.time;
          e._ember = (e._ember || 0) + 1;
          KL.ember(e);
          if (e._ember >= 5) { const t = e; V.at(0.05, () => { if (alive(t) || t.hp <= 0) emberBlast(game, p, t, lv); }); }
        },
      },
    },
    enh: [
      { id: 'db_thrust', name: 'แทงเขี้ยวมังกร', of: 'dk_thrust', lane: 'a', fx: 'echo', rgb: FIRE, pal: P.fire, text: 'หัวมังกรเพลิงพุ่งฟาดซ้ำ' },
      { id: 'db_spiral', name: 'สว่านพายุเพลิง', of: 'dk_spiral', lane: 'a', fx: 'spikes', rgb: FIRE, pal: P.fire, text: 'เปลวไฟพุ่งจากพื้นเป็นแนว' },
      { id: 'db_breath', name: 'ลมหายใจมังกรดำ', of: 'dk_breath', lane: 'b', fx: 'rain', rgb: FIRE, text: 'ห่าลูกไฟตกใส่รอบเป้า',
        look: (ctx, q) => { V.glow(ctx, q.x, q.y, 34, FIRE, 0.7, true); K.drawOrb(ctx, q.x, q.y, 11, FIRE, '#fff0b0'); } },
      { id: 'db_leap', name: 'มังกรดิ่งฟ้า', of: 'dk_leap', lane: 'b', fx: 'nova', rgb: FIRE, pal: P.fire, decal: 'scorch', text: 'ลงแล้วระเบิดไฟวงใหญ่' },
    ],
    awaken: {
      id: 'db_awaken', name: 'ร่างผสานมังกร', text: 'ตีปกติพ่นไฟเป็นกรวย เดินเร็วขึ้น 20% ความเร็วโจมตี +10%', perk: () => ({ spd: 20, aspd: 10 }),
      hooks: {
        hit(game, p, e, r, o) {
          if (o.skill || game.time - (p._dbBreath || -9) < 0.45) return;
          p._dbBreath = game.time;
          const a = NC.angle(p.x, p.y, e.x, e.y);
          KL.breath(p, a);
          K.cone(game, p, 'db_ember', 240, 0.45, { ang: a, mul: 0.35, color: FIRE });
        },
      },
    },
  });

  // =====================================================================================================
  // นักดาบกลุ่มดาว
  // =====================================================================================================
  const PENTA = [0, 2, 4, 1, 3, 0];
  FX.def('c3star', (ctx, q, u) => { // the five marks joined as a star
    const a = u < 0.2 ? u / 0.2 : 1 - Math.max(0, (u - 0.7) / 0.3);
    ctx.save(); ctx.globalAlpha *= a; ctx.globalCompositeOperation = 'lighter';
    for (const [w, col] of [[10, `rgba(${MOON},0.35)`], [4, `rgba(${MOON},0.95)`], [1.5, '#ffffff']]) {
      ctx.lineWidth = w; ctx.strokeStyle = col; ctx.beginPath();
      PENTA.forEach((i, k) => { const m = q.pts[i]; if (k) ctx.lineTo(m[0], m[1]); else ctx.moveTo(m[0], m[1]); });
      ctx.stroke();
    }
    for (const m of q.pts) V.glow(ctx, m[0], m[1], 36, MOON, 0.8, true);
    ctx.restore();
  });
  const STAR_NOVA = { rgb: MOON, stars: 3, starFill: '#eaf2ff', shake: 3, flare: false };
  KL.star = (pts) => { // the five marks joined ([x, y] each, oldest first)
    FX.add({ type: 'c3star', layer: 'glow', x: 0, y: 0, pts, life: 0.7 });
    V.stars((pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2, 8, '#eaf2ff', MOON, { speed: 260 });
  };
  KL.starNova = (game, x, y, mine) => { // one mark going off, 0.3 s later (K.nova's own look at its foot: sb_stars's areas never grow)
    K.burst(game, x, y + 40, 95, MOON, quiet(STAR_NOVA, mine));
    K.slashAt(x, y + 30, 80, rand(0, TAU), MOONPAL, MOON, { sweep: 1.4, thick: 16, life: 0.2 });
  };
  KL.starFlash = () => V.flash(MOON, 0.08, 0.2);
  KL.blade = (game, p, tgt, hit) => { // the awake crystal blade from over the hero; hit() where it lands offline
    const x0 = p.x - (p.face || 1) * 40 + rand(-40, 40), y0 = p.y - 170 + rand(-20, 20), t = 0.22;
    K.proj({ x: x0, y: y0, vx: (tgt.x - x0) / t, vy: (tgt.y - 60 - y0) / t, life: t,
      draw(ctx, q) { K.drawBlade(ctx, q.x, q.y, Math.atan2(q.vy, q.vx) + Math.PI / 2, 44, 9, '#eaf4ff', MOON); },
      onEnd() { if (alive(tgt)) { if (hit) hit(); V.sparks(tgt.x, tgt.y - 60, 6, MOON, { size: 0.7 }); } } });
  };
  C3.defineJob('starblade', {
    name: 'นักดาบกลุ่มดาว', from: 'swordmaster', hp: 7.7, sp: 4.4, rgb: MOON, pal: MOONPAL, lanes: ['ดาบคู่ดารา', 'ดาบเวทดารา'],
    desc: 'นักดาบใต้ดวงดาว รอยดาบครบห้ารอยต่อเป็นดาวห้าแฉกแล้วระเบิด · ร่างตื่นมีดาบคริสตัลหกเล่มกางหลัง',
    back: { h: 250, dy: -118 },
    sig: {
      id: 'sb_stars', name: 'กลุ่มดาวคมดาบ', type: 'phys', element: null, mul: (lv) => 0.5 + lv * 0.05,
      desc: (lv, m) => `มีรอยดาบครบ 5 รอย รอยต่อเส้นกันเป็นดาวห้าแฉกแล้วระเบิดพร้อมกัน รอยละ ${m}% ของ ATK (แทนระเบิดปกติ)${lv >= 5 ? ' · ติดสถานะมึน 0.5 วิ' : ''}`,
      grow: 'Lv5 ดาวห้าแฉกทำให้มึน · แรงขึ้นทุกเลเวล',
      hooks: {
        tick(game, p, dt, lv) {
          const M = NC.bladeMarks;
          if (!M || M.length < 5 || game.time - (p._sbStar || -9) < 2) return;
          p._sbStar = game.time;
          const five = M.splice(0, 5), pts = five.map((m) => [m.x, m.y]);
          KL.star(pts);
          V.at(0.3, () => {
            for (const m of five) {
              KL.starNova(game, m.x, m.y, true);
              K.nova(game, p, 'sb_stars', m.x, m.y + 40, 95, Object.assign({ fx: false, status: lv >= 5 ? ['stun', 0.5] : null }, STAR_NOVA));
            }
            KL.starFlash();
            C3.fill(game, p, 8);
          });
        },
      },
    },
    enh: [
      { id: 'sb_rain', name: 'ฝนดาบดารา', of: 'sm_bladerain', lane: 'a', fx: 'blades', rgb: MOON, fill: '#eaf4ff', text: 'ดาบคริสตัลตกใส่รอบเป้า' },
      { id: 'sb_thousand', name: 'พันดาบดารา', of: 'sm_thousand', lane: 'a', fx: 'rain', rgb: MOON, fill: '#eaf4ff', text: 'ฝนดาวตกลงใส่เป้า' },
      { id: 'sb_wave', name: 'คลื่นดาบทางช้างเผือก', of: 'sm_wave', lane: 'b', fx: 'shards', rgb: VIO, fill: '#efe8ff', type: 'hybrid', text: 'เศษดาวแตกกระจายจากเป้า' },
      { id: 'sb_iai', name: 'ชักดาบผ่าดาว', of: 'sm_iai', lane: 'b', fx: 'echo', rgb: MOON, pal: MOONPAL, text: 'เงาดาบดาวฟันซ้ำอีกครั้ง' },
    ],
    awaken: {
      id: 'sb_awaken', name: 'ร่างดาบดารา', text: 'ตีปกติยิงดาบคริสตัลตามไป ความเร็วโจมตี +15% คริ +10', perk: () => ({ aspd: 15, crit: 10 }),
      hooks: {
        hit(game, p, e, r, o) {
          if (o.skill || game.time - (p._sbFly || -9) < 0.25) return;
          p._sbFly = game.time;
          KL.blade(game, p, e, () => K.hit(game, p, 'sb_stars', e, 0, 0, MOON, 0.45));
        },
      },
    },
  });

  // =====================================================================================================
  // จอมเวทดาวฤกษ์
  // =====================================================================================================
  const HEAT = NC.heat || { v: 0 };
  // the mage family's looks (NC.MageC3Looks: js/online-class3-mage.js draws the server's with them, backend/job_starcore.go,
  // job_winterlord.go, job_astral.go, job_hexlord.go). mine: the local hero's, the only one that flashes and shakes the
  // screen; hit (offline): the hits, where the look lands.
  const MAGE = (NC.MageC3Looks = {});
  const SUPERNOVA = { rgb: '255,200,90', kb: 420, stars: 20, starFill: '#fff6d0', decal: 'scorch' };
  MAGE.supernova = (game, p, x, y, mine, hit) => {
    if (mine) { V.flash('255,230,160', 0.3, 0.5); V.shake(game, 12); V.stop(game, 0.06); }
    K.burst(game, x, y, 330, SUPERNOVA.rgb, mine ? SUPERNOVA : Object.assign({}, SUPERNOVA, { shake: 0 })); // (K.nova's own; sc_core's areas never grow)
    if (hit) hit();
    V.ring(x, y - 10, 40, 520, 22, '255,240,190', 0.6);
    K.flames(x, y, 14, 260, { pal: SUNPAL, k: 1.2 });
    C3.shout(p, 'ซูเปอร์โนวา!', '#fff1b8');
  };
  C3.defineJob('starcore', {
    name: 'จอมเวทดาวฤกษ์', from: 'firemage', hp: 4.4, sp: 8.3, rgb: '255,170,70', pal: SUNPAL, lanes: ['นรกดาวฤกษ์', 'หัวใจดาว'],
    desc: 'จอมเวทดวงอาทิตย์ ความร้อน 80 ขึ้นไปไม่เผาตัวเองและไฟแรงขึ้น ระบายตอนเต็มเป็นซูเปอร์โนวา · ร่างตื่นมีวงไฟโคโรนา',
    back: { h: 260, dy: -120, spin: 0.25 },
    sig: {
      id: 'sc_core', name: 'ใจดาว', type: 'magic', element: 'fire', mul: (lv) => 3 + lv * 0.3,
      desc: (lv, m) => `ความร้อนเกิน 80 ไม่เผาตัวเอง · ระบายความร้อนตอนเต็ม 100 เป็น "ซูเปอร์โนวา" วงกว้าง 330 ${m}% ของ MATK เพิ่มจากระเบิดปกติ`,
      grow: 'ซูเปอร์โนวาแรงขึ้นทุกเลเวล',
      hooks: {
        tick(game, p) { if (HEAT.v > 80) p.fmBurnAcc = 0; p._scHeat = HEAT.v; }, // (the firemage's own tick burns at 0.5 s: never reached)
                cast(game, p, id, lv) {
          if (id !== 'fm_vent' || (p._scHeat || 0) < 95) return;
          V.at(0.12, () => {
            MAGE.supernova(game, p, p.x, p.y, true, () => K.nova(game, p, 'sc_core', p.x, p.y, 330, Object.assign({}, SUPERNOVA, { fx: false })));
            C3.fill(game, p, 20);
          });
        },
      },
    },
    enh: [
      { id: 'sc_pillar', name: 'เสาสุริยะ', of: 'fm_pillar', lane: 'a', fx: 'pillar', rgb: '255,200,90', style: 'holy', text: 'เสาไฟสุริยะสีขาวทองผ่าลงเป้า' },
      { id: 'sc_sea', name: 'ทะเลดวงอาทิตย์', of: 'fm_sea', lane: 'a', fx: 'rain', rgb: '255,180,70', text: 'ดวงอาทิตย์จิ๋วตกห่าใส่',
        look: (ctx, q) => { V.glow(ctx, q.x, q.y, 36, '255,200,90', 0.8, true); K.drawStar(ctx, q.x, q.y, 13, q.t * 6, 8, '#fff2b0'); } },
      { id: 'sc_ring', name: 'วงแหวนโคโรนา', of: 'fm_ring', lane: 'b', fx: 'shards', rgb: FIRE, fill: '#ffe6a0', text: 'เปลวไฟกระจายออกจากเป้า' },
      { id: 'sc_vent', name: 'ระเบิดดาวฤกษ์', of: 'fm_vent', lane: 'b', fx: 'nova', rgb: '255,190,80', pal: SUNPAL, decal: 'scorch', text: 'ระเบิดไฟซ้ำที่ศัตรูที่โดน' },
    ],
    awaken: { id: 'sc_awaken', name: 'ร่างดาวฤกษ์', text: 'ร่ายเร็วขึ้น 20% MATK +5%', perk: () => ({ matk: 5 }) },
  });
  if (NC.castTime) {
    const baseCT = NC.castTime;
    NC.castTime = function (p) { const t = baseCT.apply(this, arguments); return p && p.job === 'starcore' && C3.awake(p) ? t * 0.8 : t; };
  }

  // =====================================================================================================
  // จ้าวเหมันต์
  // =====================================================================================================
  const STATUES = [];
  FX.def('c3statue', (ctx, q) => {
    const s = q.s, a = Math.min(1, q.t / 0.2) * Math.min(1, (q.life - q.t) / 0.4);
    ctx.save(); ctx.globalAlpha *= a;
    V.glow(ctx, s.x, s.y - 50, 90, ICE, 0.35, true);
    for (const [dx, h, w] of [[-18, 70, 22], [16, 84, 26], [0, 110, 30], [-30, 44, 16], [30, 50, 18]]) V.spike(ctx, s.x + dx, s.y, w, h, dx * 0.004, P.ice, 0.95, 0.4);
    ctx.restore();
  }, 'high');
  MAGE.statue = (s, life) => { const fx = FX.add({ type: 'c3statue', x: s.x, y: s.y, sort: s.y, life, s }); V.sparks(s.x, s.y - 50, 12, ICE, { size: 0.9 }); return fx; };
  MAGE.crumble = (s) => V.debris(s.x, s.y - 40, 8, P.ice);
  MAGE.statueShot = (s, t, hit) => { // (a shard from the statue's top at t; hit, offline, as it lands on t still alive)
    const x0 = s.x, y0 = s.y - 100, tt = 0.2;
    K.proj({ x: x0, y: y0, vx: (t.x - x0) / tt, vy: (t.y - 50 - y0) / tt, life: tt,
      draw(ctx, q) { K.drawBlade(ctx, q.x, q.y, Math.atan2(q.vy, q.vx) + Math.PI / 2, 30, 8, '#e8f8ff', ICE); },
      onEnd() { if (alive(t)) { if (hit) hit(); V.sparks(t.x, t.y - 50, 6, ICE); } } });
  };
  C3.defineJob('winterlord', {
    name: 'จ้าวเหมันต์', from: 'icemage', hp: 5, sp: 7.7, rgb: ICE, pal: P.ice, lanes: ['ธารน้ำแข็งจักรพรรดิ', 'ปราการจักรพรรดิ'],
    desc: 'จักรพรรดิแห่งฤดูหนาว ศัตรูที่ตายตอนแข็งกลายเป็นรูปปั้นน้ำแข็งยิงเศษใส่ตัวอื่น · ร่างตื่นมีเกล็ดหิมะยักษ์',
    back: { h: 260, dy: -120, spin: 0.1 },
    sig: {
      id: 'wn_statue', name: 'รูปปั้นน้ำแข็ง', type: 'magic', element: 'water', mul: (lv) => 0.45 + lv * 0.05,
      desc: (lv, m) => `ศัตรูที่ตายตอนแข็งกลายเป็นรูปปั้นน้ำแข็ง ${Math.round(6 + lv * 0.4)} วิ (สูงสุด 3 รูป) ยิงเศษน้ำแข็งใส่ศัตรูใกล้สุดทุก 1 วิ ${m}% ของ MATK ธาตุน้ำ`,
      grow: 'รูปปั้นอยู่นานขึ้นและยิงแรงขึ้นทุกเลเวล',
      hooks: {
        kill(game, p, e, lv) {
          if (!(e.frozen > 0) && !(e.status && e.status.freeze > 0)) return;
          if (STATUES.length >= 3) { const old = STATUES.shift(); if (old.fx) old.fx.dead = true; }
          const s = { x: e.x, y: e.y, until: game.time + 6 + lv * 0.4, acc: 0 };
          s.fx = MAGE.statue(s, s.until - game.time);
          STATUES.push(s);
        },
        tick(game, p, dt) {
          for (let i = STATUES.length - 1; i >= 0; i--) {
            const s = STATUES[i];
            if (s.until <= game.time) { STATUES.splice(i, 1); MAGE.crumble(s); continue; }
            s.acc += dt;
            if (s.acc < 1) continue;
            s.acc -= 1;
            const t = K.nearest(game, s.x, s.y, 420, 1)[0];
            if (!t) continue;
            MAGE.statueShot(s, t, () => K.hit(game, p, 'wn_statue', t, 0, 0, ICE));
          }
        },
        hurt(game, p, dmg, att) { // (the armour power-up: shards back at whoever hits the shell)
          const lv = lvOf(p, 'wn_armor');
          if (lv > 0 && K.buffOn(p, 'im_armor') && att && alive(att) && game.time - (p._wnRef || -9) > 0.8) {
            p._wnRef = game.time;
            C3.fx.shards(game, p, 'wn_armor', p, { rgb: ICE, fill: '#e8f8ff', big: lv >= 5 });
          }
          return dmg;
        },
      },
    },
    enh: [
      { id: 'wn_blizzard', name: 'พายุจักรพรรดิหิมะ', of: 'im_blizzard', lane: 'a', fx: 'rain', rgb: ICE, text: 'ห่าเศษน้ำแข็งตกใส่',
        look: (ctx, q) => K.drawBlade(ctx, q.x, q.y, Math.PI, 30, 9, '#e8f8ff', ICE) },
      { id: 'wn_lance', name: 'หอกน้ำแข็งยักษ์', of: 'im_lance', lane: 'a', fx: 'spikes', rgb: ICE, pal: P.ice, text: 'หนามน้ำแข็งพุ่งจากพื้นเป็นแนว' },
      { id: 'wn_burst', name: 'ผลึกแตกดาว', of: 'im_burst', lane: 'b', fx: 'nova', rgb: ICE, text: 'วงระเบิดน้ำแข็งแผ่จากเป้า' },
      { id: 'wn_armor', name: 'เกราะผลึกจักรพรรดิ', of: 'im_armor', lane: 'b', fx: 'shards', onCast: true, rgb: ICE, fill: '#e8f8ff', type: 'magic', element: 'water',
        text: 'ร่ายแล้วเศษน้ำแข็งพุ่งรอบตัว และระหว่างมีเกราะ ใครตีเราโดนเศษสะท้อน' },
    ],
    awaken: {
      id: 'wn_awaken', name: 'ร่างจักรพรรดิหิมะ', text: 'ศัตรูที่แข็งอยู่โดนแรงขึ้น 30% MDEF +20', perk: () => ({ mdef: 20 }),
      hooks: { hit(game, p, e, r) { if (e.frozen > 0 || (e.status && e.status.freeze > 0)) r.dmg = Math.round(r.dmg * 1.3); } },
    },
  });

  // =====================================================================================================
  // จอมเวทดาราจักร
  // =====================================================================================================
  const PLANET = { fire: '255,120,70', water: '120,190,255', wind: '255,230,110', earth: '210,170,110' };
  const ALIGN = { rgb: '220,180,255', kb: 300, stars: 14, starFill: '#f3e8ff', shake: 8, flash: '220,180,255' };
  MAGE.align = (game, p, tx, ty, els, mine, hit) => { // (the planets' beams, then the blast 0.3 s on)
    els.forEach((e2, i) => V.at(i * 0.08, () => V.beam(tx + (i - 1) * 40, ty, 70, 700, PLANET[e2], 0.4)));
    V.at(0.3, () => {
      K.burst(game, tx, ty, 190, ALIGN.rgb, mine ? ALIGN : Object.assign({}, ALIGN, { shake: 0, flash: null })); // (K.nova's own; ax_planets' areas never grow)
      for (const e2 of els) V.ring(tx, ty, 20, 260, 10, PLANET[e2], 0.5);
      if (hit) hit();
    });
    C3.shout(p, 'เรียงดาว!', '#efe0ff');
  };
  C3.defineJob('astral', {
    name: 'จอมเวทดาราจักร', from: 'archmage', hp: 4.4, sp: 8.3, rgb: '210,170,255', pal: P.shadow, lanes: ['พายุดาราจักร', 'ผสานดาราจักร'],
    desc: 'จอมเวทจักรวาล ร่ายธาตุไหนได้ดาวเคราะห์ธาตุนั้น ครบสามธาตุเรียงดาวระเบิด · ร่างตื่นมีวงโคจรสามวง',
    back: { h: 250, dy: -118, spin: 0.35 },
    sig: {
      id: 'ax_planets', name: 'ดาวเคราะห์โคจร', type: 'magic', element: null, mul: (lv) => 1.4 + lv * 0.14,
      desc: (lv, m) => `ร่ายเวทธาตุไฟ น้ำ ลม หรือดิน ได้ดาวเคราะห์ธาตุนั้นโคจรรอบตัว (อยู่ 12 วิ) ครบ 3 ธาตุต่างกัน "เรียงดาว" ระเบิดที่เป้า ${m}% ของ MATK${lv >= 5 ? ' · ร่างตื่นใช้แค่ 2 ธาตุ' : ''}`,
      grow: 'Lv5 ระหว่างร่างตื่นเรียงดาวได้ด้วย 2 ธาตุ · แรงขึ้นทุกเลเวล',
      hooks: {
        cast(game, p, id, lv) {
          const el = SK[id] && SK[id].element;
          if (!PLANET[el]) return;
          const P2 = (p.axPlanets = (p.axPlanets || []).filter((q) => q.until > game.time && q.el !== el));
          P2.push({ el, until: game.time + 12 });
          if (P2.length > 3) P2.shift();
          const need = lv >= 5 && C3.awake(p) ? 2 : 3;
          if (P2.length < need) return;
          const els = P2.map((q) => q.el);
          p.axPlanets = [];
          const t = K.target(game, p, 700, 300), [tx, ty] = t ? [t.x, t.y] : K.ground(game, p, 500);
          MAGE.align(game, p, tx, ty, els, true, () => {
            K.nova(game, p, 'ax_planets', tx, ty, 190, Object.assign({}, ALIGN, { fx: false }));
            C3.fill(game, p, 15);
          });
        },
      },
    },
    enh: [
      { id: 'ax_chain', name: 'สายฟ้าดาราจักร', of: 'am_chain', lane: 'a', fx: 'chain', rgb: C.lightning || '150,220,255', type: 'magic', element: 'wind', text: 'สายฟ้ากระโดดต่ออีก 3–4 ตัว' },
      { id: 'ax_lord', name: 'อสนีจักรวาล', of: 'am_lordthunder', lane: 'a', fx: 'pillar', rgb: '255,236,120', style: 'arcane', type: 'magic', element: 'wind', text: 'เสาฟ้าผ่าจากกาแล็กซีลงเป้า' },
      { id: 'ax_orbs', name: 'ลูกแก้วดาวเคราะห์', of: 'am_orbs', lane: 'b', fx: 'shards', rgb: VIO, fill: '#efe6ff', type: 'magic', text: 'เศษดาวแตกกระจายจากเป้า' },
      { id: 'ax_recall', name: 'จำเวทจักรวาล', of: 'am_recall', lane: 'b', fx: 'echo', rgb: VIO, pal: P.shadow, type: 'magic', text: 'เวทวงซ้อนระเบิดซ้ำที่เป้า' },
    ],
    awaken: { id: 'ax_awaken', name: 'ร่างดาราจักร', text: 'MATK +15% คูลดาวน์ลด 10% (เรียงดาวด้วย 2 ธาตุเมื่อกลไก Lv5)', perk: () => ({ matk: 15, cdr: 10 }) },
  });
  C3.jobs.astral.drawFront = (ctx, game, p) => { // the planets
    const L = (p.axPlanets || []).filter((q) => q.until > game.time);
    L.forEach((q, i) => {
      const a = game.time * 1.4 + (i / Math.max(1, L.length)) * TAU, x = p.x + Math.cos(a) * 70, y = p.y - 100 + Math.sin(a) * 26;
      V.glow(ctx, x, y, 30, PLANET[q.el], 0.6, true);
      K.drawOrb(ctx, x, y, 9, PLANET[q.el], '#ffffff');
    });
  };

  // =====================================================================================================
  // จ้าวคืนเดือนดับ
  // =====================================================================================================
  MAGE.ghost = (from, t, hit) => { // (ghost fire from a fallen monster at t; hit, offline, as it lands on t still alive)
    const x0 = from.x, y0 = from.y - 60, tt = 0.35;
    K.proj({ x: x0, y: y0, vx: (t.x - x0) / tt, vy: (t.y - 60 - y0) / tt, life: tt,
      draw(ctx, q) { K.drawGhost(ctx, q.x, q.y, 13, q.t, TEAL, 0.95); },
      onEnd() {
        if (!alive(t)) return;
        if (hit) hit();
        V.flameAt(t.x, t.y - 40, 26, 44, TEALPAL, 0.4, { vy: -70 });
      } });
  };
  MAGE.contagion = (e) => V.flameAt(e.x, e.y - 30, 34, 60, TEALPAL, 0.5, { vy: -90 });
  MAGE.darkMotes = (p, dt) => { if (Math.random() < dt * 20) { const a = rand(0, TAU), d = rand(60, 320); V.motes(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * V.SQ, 1, '60,40,90', { rise: 40, spread: 6, size: 1.6 }); } };
  function ghostTo(game, p, from, t) {
    MAGE.ghost(from, t, () => { K.hit(game, p, 'hx_contagion', t, 0, 0, TEAL); K.vuln(game, t, 1.1, 5, TEAL); t._hxT = game.time; });
  }
  C3.defineJob('hexlord', {
    name: 'จ้าวคืนเดือนดับ', from: 'warlock', hp: 5, sp: 7.7, rgb: TEAL, pal: TEALPAL, lanes: ['ไฟผีเดือนดับ', 'คำสาปเดือนดับ'],
    desc: 'จ้าวแห่งผีและตะเกียง ศัตรูที่โดนสาปตายแล้วไฟผีกระโดดไปตัวข้าง ๆ · ร่างตื่นมีผีใหญ่หลังตัวและเขตมืด',
    back: { h: 270, dy: -135, bob: 10 },
    sig: {
      id: 'hx_contagion', name: 'คำสาปติดต่อ', type: 'magic', element: 'shadow', mul: (lv) => 0.7 + lv * 0.08,
      desc: (lv, m) => `ศัตรูที่โดนสกิลเราภายใน 5 วิแล้วตาย ไฟผีกระโดดไป ${lv >= 10 ? 4 : lv >= 5 ? 3 : 2} ตัวใกล้สุด ${m}% ของ MATK ธาตุมืด และรับดาเมจ +10% 5 วิ (ต่อเป็นทอด ๆ ได้)`,
      grow: 'Lv5 กระโดด 3 ตัว · Lv10 4 ตัว',
      hooks: {
        hit(game, p, e, r, o) { if (o.skill) e._hxT = game.time; },
        kill(game, p, e, lv) {
          if (game.time - (e._hxT || -99) > 5) return;
          for (const t of C3.others(game, e, 360, lv >= 10 ? 4 : lv >= 5 ? 3 : 2)) ghostTo(game, p, e, t);
          MAGE.contagion(e);
          C3.fill(game, p, 3);
        },
      },
    },
    enh: [
      { id: 'hx_soulfire', name: 'ไฟวิญญาณเดือนดับ', of: 'wl_soulfire', lane: 'a', fx: 'chain', rgb: TEAL, type: 'magic', element: 'shadow', text: 'ไฟผีกระโดดต่ออีก 3–4 ตัว' },
      { id: 'hx_soulburn', name: 'เผาวิญญาณลุกลาม', of: 'wl_soulburn', lane: 'a', fx: 'nova', rgb: TEAL, pal: TEALPAL, type: 'magic', element: 'shadow', text: 'วงไฟผีแผ่จากเป้า' },
      { id: 'hx_hex', name: 'ตราคำสาปเดือนดับ', of: 'wl_hex', lane: 'b', fx: 'pillar', rgb: DARK, style: 'arcane', type: 'magic', element: 'shadow', text: 'เสาเงาผ่าลงเป้า' },
      { id: 'hx_chains', name: 'โซ่เงาเดือนดับ', of: 'wl_chains', lane: 'b', fx: 'spikes', rgb: DARK, pal: P.shadow, type: 'magic', element: 'shadow', text: 'หนามเงาพุ่งจากพื้นเป็นแนว' },
    ],
    awaken: {
      id: 'hx_awaken', name: 'ร่างจ้าวผี', text: 'เขตมืดรอบตัว 320: ศัตรูในเขตโดนแรงขึ้น 20% · MATK +10%', perk: () => ({ matk: 10 }),
      hooks: {
        hit(game, p, e, r) { if (NC.dist(e.x, e.y, p.x, p.y) < 320) r.dmg = Math.round(r.dmg * 1.2); },
        tick(game, p, dt) { MAGE.darkMotes(p, dt); },
      },
    },
  });
  C3.jobs.hexlord.drawBack = (ctx, game, p) => { // the moonless zone round the awakened hexlord
    if (!C3.awake(p)) return;
    ctx.save(); ctx.globalAlpha *= 0.28;
    ctx.fillStyle = '#140d24'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 320, 320 * V.SQ, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${TEAL},0.5)`; ctx.beginPath(); ctx.ellipse(p.x, p.y, 320, 320 * V.SQ, 0, 0, TAU); ctx.stroke(); ctx.restore();
  };

  // =====================================================================================================
  // จอมคลั่งจันทร์เลือด (from the berserker, jobs3_berserker.js)
  // =====================================================================================================
  const BLOODRGB = '230,40,60', RPAL = ['#8a1030', '#e0335a', '#ffd0dc'];
  KL.bloodMotes = (p) => { if (p.hp < p.maxHp * 0.5 && Math.random() < 0.15) V.motes(p.x + rand(-30, 30), p.y - rand(10, 90), 1, BLOODRGB, { rise: 70, spread: 8 }); };
  KL.wave = (game, p, a, mine) => { // the awake shockwave at angle a
    K.slashAt(p.x + Math.cos(a) * 100, p.y - 30, 190, a + Math.PI / 2, RPAL, BLOODRGB, { sweep: 2.4, thick: 44, life: 0.24 });
    if (mine) V.shake(game, 3);
  };
  C3.defineJob('bloodmoon', {
    name: 'จอมคลั่งจันทร์เลือด', from: 'berserker', hp: 9, sp: 2.8, rgb: BLOODRGB, pal: RPAL, lanes: ['ดาบใหญ่จันทร์เลือด', 'พสุธาจันทร์เลือด'], giant: true,
    desc: 'นักรบคลั่งใต้จันทร์สีเลือด เลือดยิ่งน้อยยิ่งตีแรงและดูดเลือด · ร่างตื่นตัวโตเป็นยักษ์ จันทร์แดงหลังตัว',
    back: { h: 290, dy: -140, bob: 4 },
    sig: {
      id: 'bm_moon', name: 'จันทร์เลือด', type: 'phys', element: null, mul: (lv) => 1 + lv * 0.1,
      desc: (lv) => `ทุกฮิตแรงขึ้นตาม HP ที่หายไป: หายไปครึ่งหนึ่ง แรงขึ้น ${Math.round((0.3 + lv * 0.03) * 50)}% · HP ต่ำกว่า 50% ดูดเลือด ${r1(1 + lv * 0.2)}% ของดาเมจ`,
      grow: 'แรงขึ้นและดูดเลือดมากขึ้นทุกเลเวล',
      hooks: {
        hit(game, p, e, r, o, lv) {
          const miss = 1 - p.hp / Math.max(1, p.maxHp);
          if (miss > 0) r.dmg = Math.round(r.dmg * (1 + miss * (0.3 + lv * 0.03)));
          if (miss > 0.5 && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.round(r.dmg * (1 + lv * 0.2) / 100)));
        },
        tick(game, p) { KL.bloodMotes(p); },
      },
    },
    enh: [
      { id: 'bm_cross', name: 'ฟันกากบาทจันทร์เลือด', of: 'bk_crosscut', lane: 'a', fx: 'echo', rgb: BLOODRGB, pal: RPAL, text: 'เงาดาบสีเลือดฟันไขว้ซ้ำ' },
      { id: 'bm_guillotine', name: 'ประหารจันทร์เลือด', of: 'bk_guillotine', lane: 'a', fx: 'pillar', rgb: BLOODRGB, style: 'occult', text: 'เสาแสงสีเลือดผ่าลงเป้า' },
      { id: 'bm_smash', name: 'ทุบจันทร์แตก', of: 'bk_smash', lane: 'b', fx: 'nova', rgb: '230,120,80', decal: 'crack', text: 'คลื่นแผ่นดินแตกแผ่จากเป้า' },
      { id: 'bm_leap', name: 'กระโดดจันทร์ถล่ม', of: 'bk_leap', lane: 'b', fx: 'spikes', rgb: '230,120,80', pal: P.rock, text: 'หินแหลมสีเลือดพุ่งจากพื้นเป็นแนว' },
    ],
    awaken: {
      id: 'bm_awaken', name: 'ร่างยักษ์จันทร์เลือด', text: 'ตัวโตเป็นยักษ์ ATK +15% รับดาเมจลด 15% ตีปกติส่งคลื่นกระแทก', perk: () => ({ atk: 15, taken: 15 }),
      hooks: {
        hit(game, p, e, r, o) {
          if (o.skill || game.time - (p._bmWave || -9) < 0.35) return;
          p._bmWave = game.time;
          const a = NC.angle(p.x, p.y, e.x, e.y);
          KL.wave(game, p, a, true);
          K.cone(game, p, 'bm_moon', 300, 0.6, { ang: a, kb: 220, mul: 0.5, color: BLOODRGB });
        },
      },
    },
  });
  C3.finish();
})();
