/* samurai.js — the Samurai line (the user, 2026-10-03: "ทำอาชีพ ซามูไร เพิ่มให้หน่อยเเต่ยังไม่ต้องใส่ในเกมนะ จะมีเเค่เเอดมิน
   ออกเเบบชุดเท่ๆ มี คราส ซามูไร เเล้ว คราส2 เป็น ซามูไรเลือด กับ ซามูไรลม"): a 1st job, ซามูไร (a katana held in both hands,
   moonlit cuts, the ใจดาบ gauge), and its two 2nd jobs: ซามูไรเลือด (a nodachi; skills paid in HP, bleeding, drinking blood
   back, the crimson shield) and ซามูไรลม (a jade katana; the most mobile job: dash charges, a wind gauge filled by moving).
   Unreleased catalog source: omitted from the player page; build tools insert it when collecting the complete catalog.
   This file: the art (assets/samurai/ + assets/samurai.manifest.js), outfits, hats and swords, class sets,
   weapon types คาตานะ / โนดาจิ and NC.JOBS entries. The skills: samurai_skills.js.
   Art: Codex sheets from assets/gen/make_samurai_prompts.py, cut with tools/rigcut.py + splitparts.py (+ fashion_caps.py
   for the wind set's jade shoulders), tools/cutout.py (hats, swords), tools/sam_hats.py (the hats' seat),
   tools/sam_icons.py (skill icons); the skill effects tools/samurai_fx.py. Loaded after jobs3_berserker.js. */
(function () {
  'use strict';
  const NC = window.NC;

  const ITEMS = NC.ITEMS;
  if (NC.ASSET_MANIFEST_SAMURAI) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_SAMURAI);

  // ---------------- the weapon types and who holds them ----------------
  if (NC.WTYPES) {
    NC.WTYPES.katana = { name: 'คาตานะ', h: 2, m: 1 };
    NC.WTYPES.nodachi = { name: 'โนดาจิ', h: 2, m: 1 };
  }
  if (NC.JOB_WEAPONS) Object.assign(NC.JOB_WEAPONS, { samurai: ['katana'], bloodsamurai: ['nodachi'], windsamurai: [] });
  if (NC.STARTER_WEAPONS) Object.assign(NC.STARTER_WEAPONS, { katana: 'katana_moon', nodachi: 'nodachi_blood' });
  const SAM = ['samurai', 'bloodsamurai', 'windsamurai'];
  const baseShield = NC.jobShield;
  if (baseShield) NC.jobShield = (job) => (SAM.includes(job) ? false : baseShield(job)); // (two hands on the sword: no shield, no buckler handed out)

  // ---------------- the scabbards (the user: "ท่าเก็บดาบต้องเก็บข้างตัวแบบเหน็บข้าง") ----------------
  // A katana lives in its scabbard thrust through the belt at the side: standing, the hand rests on the hilt; walking,
  // it stays at the belt; drawn, the empty scabbard stays at the hip (avatar.js: W.saya, W.sheath.draw). The scabbard
  // follows the blade's own curve: its centre line is read once off the sword's picture (the rows above the guard).
  function sayaOf(W, s) {
    if (W._saya !== undefined) return W._saya;
    const img = s.img;
    if (!img || !img.complete || !img.naturalWidth) return null;
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0);
    let d;
    try { d = c.getImageData(0, 0, cv.width, cv.height).data; } catch (e) { return (W._saya = null); }
    const IW = cv.width, IH = cv.height, rows = [];
    for (let y = 0; y < IH; y++) {
      let a = -1, b = -1;
      for (let x = 0; x < IW; x++) if (d[(y * IW + x) * 4 + 3] > 128) { if (a < 0) a = x; b = x; }
      rows.push(a < 0 ? null : [a, b]);
    }
    const wid = (y) => (rows[y] ? rows[y][1] - rows[y][0] + 1 : 0);
    let g = Math.round(IH * 0.45), gw = 0; // the guard: the widest row between 45% and 88% down
    for (let y = g; y < Math.round(IH * 0.88); y++) if (wid(y) > gw) { gw = wid(y); g = y; }
    while (g > 0 && wid(g - 1) > gw * 0.6) g--;
    const ws = [];
    for (let y = Math.round(g * 0.3); y < Math.round(g * 0.9); y++) if (wid(y)) ws.push(wid(y));
    ws.sort((a, b) => a - b);
    const bw = ws.length ? ws[ws.length >> 1] : 8; // (the blade's usual width, outline included)
    const pts = [];
    for (let y = g - 1; y >= 3; y -= 5) if (rows[y]) pts.push([(rows[y][0] + rows[y][1]) / 2 / IW, y / IH]);
    const last = rows.findIndex((r) => r);
    pts.push([rows[last] ? (rows[last][0] + rows[last][1]) / 2 / IW : pts[pts.length - 1][0], Math.max(0, last - 1) / IH]);
    return (W._saya = { pts, bw: bw / IW });
  }
  const sayaDraw = (col) => function (ctx, W, s, w, h, grip) {
    const sy = sayaOf(W, s);
    if (!sy) return;
    const P = sy.pts.map(([fx, fy]) => [(fx - s.ax) * w, -h * (1 - grip) + fy * h]);
    const sw = sy.bw * w * 0.8, ol = Math.max(1.1, sw * 0.13), n = P.length;
    const line = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
    const at = (u) => { const f = u * (n - 1), i = Math.min(n - 2, Math.floor(f)), k = f - i; return [P[i][0] + (P[i + 1][0] - P[i][0]) * k, P[i][1] + (P[i + 1][1] - P[i][1]) * k]; };
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    const tip = P[n - 1];
    // outline, body, the end rounded
    line(P); ctx.strokeStyle = '#17132b'; ctx.lineWidth = sw + ol * 2; ctx.stroke();
    ctx.fillStyle = '#17132b'; ctx.beginPath(); ctx.arc(tip[0], tip[1], sw / 2 + ol, 0, Math.PI * 2); ctx.fill();
    line(P); ctx.strokeStyle = col.body; ctx.lineWidth = sw; ctx.stroke();
    ctx.fillStyle = col.body; ctx.beginPath(); ctx.arc(tip[0], tip[1], sw / 2, 0, Math.PI * 2); ctx.fill();
    // a lacquer shine down one side
    ctx.save(); ctx.translate(-sw * 0.2, 0); line(P.slice(1, n - 1)); ctx.strokeStyle = col.hi; ctx.globalAlpha *= 0.75; ctx.lineWidth = sw * 0.2; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
    // the mouth fitting, the cord knot, the end cap
    const band = (u0, u1, c) => { line([at(u0), at(u1)]); ctx.strokeStyle = '#17132b'; ctx.lineWidth = sw + ol * 2.2; ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = sw + ol * 0.6; ctx.stroke(); };
    band(0, 0.045, col.band);
    band(0.15, 0.19, col.cord);
    band(0.95, 1, col.band);
    ctx.restore();
  };
  const SAYA = {
    moon: { body: '#1d2142', hi: '#6a7cc4', band: '#c8d0e4', cord: '#3a5bb8' },
    blood: { body: '#5c0b1e', hi: '#d0465e', band: '#d8aa48', cord: '#1a1420' },
    wind: { body: '#eef3ea', hi: '#ffffff', band: '#2e9c84', cord: '#2e9c84' },
  };
  const AT_HIP = [8, -19]; // (where anim.js's idleHilt / readyIai rest the hand on the hilt)
  const katana = (pal, ang, grip) => ({ sheath: { draw: sayaDraw(SAYA[pal]) }, saya: { at: AT_HIP, ang }, sheathAng: ang, tuck: { grip, ang, at: AT_HIP, back: false },
    sig: { idle: 'idleHilt', set: 'blade' } }); // (its own moves: the hand on the hilt; the draw-cut, the diagonal cut, the dash-through)

  // ---------------- the swords (upright, the grip at the bottom, the edge on the right) ----------------
  const W = (id, o) => { ITEMS[id] = Object.assign({ slot: 'weapon', sprite: 'w_' + id, rarity: 'epic', style: 'swing', twoHanded: true }, o); };
  W('katana_moon', { wtype: 'katana', name: 'คาตานะแสงจันทร์', dmg: [40, 54], hitK: 1.25, cd: 0.34, dur: 0.22, hitAt: 0.06, reach: 165, arc: 1.4, kb: 230,
    grip: 0.2, grip2: 10, restAng: -1.95, stance: -0.65, aspd: 1.02, crit: 0.06, trailRgb: '190,210,255', ...katana('moon', 2.84, 0.2),
    desc: 'คาตานะด้ามพันน้ำเงิน ใบเงินโค้ง ถือสองมือ ฟันเร็วและคม' });
  W('nodachi_blood', { wtype: 'nodachi', name: 'โนดาจิโลหิต', dmg: [74, 96], hitK: 2, cd: 0.56, dur: 0.32, hitAt: 0.11, reach: 205, arc: 1.7, kb: 360,
    grip: 0.17, grip2: 12, restAng: -2.1, stance: -0.95, aspd: 0.8, crit: 0.05, ...katana('blood', 2.86, 0.17),
    trailRgb: '255,90,110', desc: 'ดาบยาวใบแดงเข้ม ฟันหนักและไกล ทุกแผลเลือดไหลง่าย' });
  W('katana_wind', { wtype: 'katana', name: 'คาตานะสายลม', dmg: [40, 54], hitK: 1.25, cd: 0.3, dur: 0.2, hitAt: 0.05, reach: 160, arc: 1.35, kb: 210,
    grip: 0.2, grip2: 10, restAng: -1.95, stance: -0.6, aspd: 1.1, crit: 0.08, stats: { agi: 3 }, trailRgb: '150,240,200', ...katana('wind', 2.84, 0.2),
    desc: 'คาตานะใบฟ้าอมเขียว ด้ามขาวหยก ห้อยขนนก เบาจนฟันได้ไวดั่งลม' });

  // ---------------- the katana and nodachi tiers (the owner, 2026-10-07, the endgame balance audit) ----------------
  // The line had its three class swords (katana 40–54, nodachi 74–96) and nothing to drop, forge, refine or roll options
  // on, so a samurai stayed on a Lv 1 sword. Now each type tiers up like the swords and greatswords: grades by level
  // (1 Lv 1–25 · 2 Lv 26–50 · 3 Lv 51–75 · 4 Lv 76–99) and kinds A ธรรมดา (the forge makes them: js/forgecraft.js) ·
  // B ออป · C เวท · D บอส (drops only: js/rebalance.js puts them in the species' tables). Each is a piece of its own like
  // the catalog's (it.wc: js/gearbag.js option rows, refine +10, moonlit, sold piece by piece). Mid ATK: the katana a
  // one-handed sword's x1.1 (two hands, no shield) 55 / 88 / 121 / 154, the nodachi a greatsword's 70 / 110 / 150 / 190;
  // kinds A x1 · B x0.92 · C x0.88 · D x1.2 (tools/wcat_build.py's). They hold and move like the class sword of their
  // type, each in its own scabbard (katana()). Pictures: the six samurai swords recoloured (tools/sam_tiers.py).
  // [id, name, grade, kind, element, Lv, picture it was made from (its grip), look, ability text, abilities (js/wabil.js)]
  const TIER_KIND = { A: 1, B: 0.92, C: 0.88, D: 1.2 }, TIER_RARITY = { A: 'common', B: 'rare', C: 'epic', D: 'legend' };
  const TIER_MID = { katana: [55, 88, 121, 154], nodachi: [70, 110, 150, 190] };
  const TIER_GRIP = { moon: 0.2, wind: 0.2, moonlit: 0.208, tempest: 0.27, blood: 0.17, crimson: 0.191 };
  const TIER_TRAIL = { neutral: '210,225,250', water: '150,210,255', wind: '230,225,140', earth: '225,185,125', fire: '255,150,80',
    poison: '190,140,255', shadow: '175,140,235' };
  const TIERS = {
    katana: [
      ['ka_iron', 'คาตานะเหล็กกล้า', 1, 'A', 'neutral', 10, 'moon', 'คาตานะเหล็กธรรมดา ด้ามพันผ้าน้ำตาล งานช่างหมู่บ้าน'],
      ['ka_sakura', 'คาตานะซากุระ', 1, 'B', 'wind', 18, 'moon', 'ใบเงินอมชมพูดั่งกลีบซากุระ ด้ามพันผ้าม่วงแดง', 'ความเร็วโจมตี +12% · DEF -3',
        [{ t: 'aspd', v: 12 }, { t: 'stat', def: -3 }]],
      ['ka_steel', 'คาตานะเหล็กพับ', 2, 'A', 'neutral', 26, 'moonlit', 'เหล็กพับร้อยชั้น ลายฮามอนชัด ด้ามพันผ้าน้ำตาลแดง'],
      ['ka_mist', 'คาตานะหมอกคราม', 2, 'C', 'water', 40, 'wind', 'ใบฟ้าครามเย็นเฉียบ ด้ามขาวลายน้ำ ห้อยขนนก', '7% หนามน้ำแข็งพุ่งเป็นแนว 200%',
        [{ t: 'proc', fx: 'icespikes', chance: 7, mul: 2, freeze: 1 }]],
      ['ka_moonsteel', 'คาตานะเหล็กจันทรา', 3, 'A', 'neutral', 52, 'moonlit', 'เหล็กเงินอมฟ้าใต้แสงจันทร์ ด้ามพันผ้าคราม'],
      ['ka_ember', 'คาตานะถ่านเพลิง', 3, 'B', 'fire', 64, 'tempest', 'ใบส้มเรืองดั่งถ่านคุ ฮามอนเป็นเปลวไฟ', 'HP ยิ่งน้อยยิ่งแรง สูงสุด +32% ที่ HP 20%',
        [{ t: 'lowHp', max: 32, at: 20 }]],
      ['ka_starsteel', 'คาตานะเหล็กดาว', 4, 'A', 'neutral', 77, 'moonlit', 'เหล็กดาวตกสีครามเข้ม ด้ามพันผ้าทอง งานชั้นครู'],
      ['ka_thunder', 'คาตานะอสนีบาต', 4, 'C', 'wind', 86, 'tempest', 'ใบเหลืองทองแลบประกายสายฟ้า', '9% ฟ้าผ่าลงเป้า 280%',
        [{ t: 'proc', fx: 'lightning', chance: 9, mul: 2.8, st: 'shock' }]],
      ['ka_shogun', 'คาตานะโชกุนราตรี', 4, 'D', 'shadow', 94, 'tempest', 'ดาบประจำตัวโชกุนแห่งราตรี ใบม่วงเงา', '7% ฝูงค้างคาวรุมเป้า 110% · กลางคืน +20% · กลางวัน -8%',
        [{ t: 'proc', fx: 'bats', chance: 7, mul: 1.1, n: 3 }, { t: 'night', night: 20, day: -8 }]],
    ],
    nodachi: [
      ['nd_iron', 'โนดาจิเหล็กดำ', 1, 'A', 'neutral', 12, 'blood', 'ดาบยาวเหล็กดำหนักมือ ด้ามพันผ้าน้ำตาล'],
      ['nd_cedar', 'โนดาจิไม้สนแดง', 1, 'B', 'earth', 22, 'blood', 'ใบสีทองแดงลายไม้สน ด้ามพันผ้าเขียวมอส', 'DEF +3 · ความเร็วโจมตี -5%',
        [{ t: 'stat', def: 3 }, { t: 'aspd', v: -5 }]],
      ['nd_steel', 'โนดาจิเหล็กกล้า', 2, 'A', 'neutral', 28, 'crimson', 'เหล็กกล้ายาวเกือบเท่าตัวคน ด้ามพันแดง'],
      ['nd_frost', 'โนดาจิน้ำค้างแข็ง', 2, 'C', 'water', 44, 'crimson', 'ใบฟ้าน้ำแข็ง ฮามอนเป็นเกล็ดหิมะ', '12% ติดเย็นเฉียบ (3 ชั้นแข็ง)',
        [{ t: 'status', st: 'chill', chance: 12, freeze3: true }]],
      ['nd_oni', 'โนดาจิเขาอสูร', 3, 'A', 'neutral', 54, 'crimson', 'เหล็กแดงคล้ำของนักล่าอสูร ด้ามพันแดง'],
      ['nd_venom', 'โนดาจิพิษงูเห่า', 3, 'B', 'poison', 66, 'crimson', 'ใบม่วงชุ่มพิษ ฮามอนเป็นลายเกล็ดงู', 'ศัตรูติดพิษโดนเรา +22%',
        [{ t: 'vsPoisoned', pct: 22 }]],
      ['nd_dragonsteel', 'โนดาจิเหล็กมังกร', 4, 'A', 'neutral', 78, 'crimson', 'เหล็กมังกรสีทองนวล ด้ามพันทอง งานชั้นครู'],
      ['nd_eclipse', 'โนดาจิสุริยคราส', 4, 'C', 'shadow', 88, 'crimson', 'ใบครามดำดั่งตะวันถูกบัง', '8% ติดคำสาป',
        [{ t: 'status', st: 'curse', chance: 8 }]],
      ['nd_ashura', 'โนดาจิอสูรเพลิง', 4, 'D', 'fire', 95, 'crimson', 'ดาบของอสูรเพลิงหกกร ใบส้มลุกโชน', '10% เสาเพลิงใต้เป้า 260% · 14% เลือดไหล',
        [{ t: 'proc', fx: 'firepillar', chance: 10, mul: 2.6, st: 'burn' }, { t: 'status', st: 'bleed', chance: 14 }]],
    ],
  };
  // each tier's scabbard (sayaDraw): lacquer, its shine, the fittings, the cord
  Object.assign(SAYA, {
    ka_iron: { body: '#3b2f27', hi: '#8c7b6a', band: '#a9a49a', cord: '#6b4a2e' }, ka_sakura: { body: '#f4d9e3', hi: '#ffffff', band: '#b94a72', cord: '#c9587e' },
    ka_steel: { body: '#2b1c16', hi: '#9a6a52', band: '#c9c9c9', cord: '#8a3a22' }, ka_mist: { body: '#e8eff8', hi: '#ffffff', band: '#2f6fb8', cord: '#2f6fb8' },
    ka_moonsteel: { body: '#1a2048', hi: '#7a8cd8', band: '#d6dcef', cord: '#3a4fb8' }, ka_ember: { body: '#2a1712', hi: '#ff9a4a', band: '#d8aa48', cord: '#ff6a2a' },
    ka_starsteel: { body: '#1b1d33', hi: '#6c74b8', band: '#e0c060', cord: '#c9a03a' }, ka_thunder: { body: '#f6f3e2', hi: '#ffffff', band: '#d6b22a', cord: '#d6b22a' },
    ka_shogun: { body: '#24132e', hi: '#a26ad0', band: '#c9a0e0', cord: '#7a3aa8' },
    nd_iron: { body: '#2a2422', hi: '#7a6a62', band: '#8f8f8f', cord: '#4a3324' }, nd_cedar: { body: '#3b2a18', hi: '#a07a48', band: '#7d9a52', cord: '#55703a' },
    nd_steel: { body: '#1d1b22', hi: '#8a8a98', band: '#d8d8d8', cord: '#b84a4a' }, nd_frost: { body: '#dfeef8', hi: '#ffffff', band: '#4aa8e0', cord: '#2a78b8' },
    nd_oni: { body: '#4a0d18', hi: '#c0465a', band: '#d8aa48', cord: '#1a1420' }, nd_venom: { body: '#2a1236', hi: '#a05ad0', band: '#7ad04a', cord: '#7a3aa8' },
    nd_dragonsteel: { body: '#2b2012', hi: '#e0b860', band: '#f0d080', cord: '#b8862a' }, nd_eclipse: { body: '#15122e', hi: '#5a4ab8', band: '#9a8ad8', cord: '#3a2a88' },
    nd_ashura: { body: '#3a1208', hi: '#ff7a2a', band: '#ffc04a', cord: '#ff5a1a' },
  });
  const tierIds = [];
  for (const type in TIERS) {
    const T = ITEMS[type === 'katana' ? 'katana_moon' : 'nodachi_blood'];
    for (const [id, name, grade, kind, el, lv, from, look, abilText, abil] of TIERS[type]) {
      const atk = Math.round(TIER_MID[type][grade - 1] * TIER_KIND[kind]), grip = TIER_GRIP[from];
      const it = Object.assign({}, T, katana(id, T.sheathAng, grip), {
        id, wtype: type, sprite: 'w_' + id, name, rarity: TIER_RARITY[kind], dmg: [Math.round(atk * 0.88), Math.round(atk * 1.12)], grip,
        element: el === 'neutral' ? undefined : el, lvReq: lv, wc: { type, grade, kind, atk, lv }, desc: look, trailRgb: TIER_TRAIL[el] || TIER_TRAIL.neutral,
      });
      delete it._saya; // (the scabbard follows ITS blade's curve)
      if (abil) { it.abil = abil; it.abilText = abilText; }
      ITEMS[id] = it;
      tierIds.push(id);
    }
  }
  if (NC.ITEM_ORDER) for (const id of tierIds) if (!NC.ITEM_ORDER.includes(id)) NC.ITEM_ORDER.push(id);

  // ---------------- the outfits, hats and the class sets ----------------
  // job: [name, 1st job (2nd jobs), sword, hp, sp, look [top, pants, shoes, hat], hat fit, text]
  // (English names, the user 2026-10-03: "ตั้งชื่ออาชีพให้เท่ๆ ภาษาอังกฤษ ไม่เอาซามูไรเลือดแบบนี้": ซามูไร = Moonblade,
  // ซามูไรเลือด = Crimson Ronin, ซามูไรลม = Tempest Ronin; the ids stay samurai / bloodsamurai / windsamurai)
  const JOBS = {
    samurai: ['Moonblade', null, 'katana_moon', 6.5, 2.5,
      [['เกราะซามูไรราตรี', { def: 9, str: 2, agi: 1 }, 'เสื้อกิโมโนน้ำเงินเข้ม เกราะอกแดงชาด บ่าเกราะขอบทอง ผ้าคาดเอวขาว'],
        ['ฮากามะราตรี', { def: 5, agi: 1 }, 'กางเกงฮากามะน้ำเงินเทา'],
        ['รองเท้าฟางผูกเชือก', { def: 3, agi: 1 }, 'รองเท้าหุ้มข้อดำ สายเชือกขาว พื้นฟาง'],
        ['หมวกเกราะจันทร์เสี้ยว', { def: 3, str: 1, dex: 1 }, 'หมวกเกราะดำครึ่งใบ จันทร์เสี้ยวเงินที่หน้าผาก ผ้าคาดหัวขาวปลิว']],
      { fit: 1.22, seat: 0.5, dx: -0.12, clip: false, soft: 0 },
      'นักดาบใต้แสงจันทร์ ถือคาตานะสองมือ ฟันเป็นจันทร์เสี้ยว ชักดาบพุ่งผ่านแล้วแผลเปิดตามหลัง สะสม "ใจดาบ" จนเต็มแล้วปล่อยดาบจันทร์เต็มดวง'],
    bloodsamurai: ['Crimson Ronin', 'samurai', 'nodachi_blood', 7.5, 2.5,
      [['เกราะซามูไรโลหิต', { def: 13, str: 3, vit: 1 }, 'เกราะแดงชาดทั้งตัว ขอบทอง หน้ากากอสูรที่อก ผ้าคาดเอวดำ ผ้าแดงห้อย'],
        ['สนับขาโลหิต', { def: 6, str: 1 }, 'กางเกงดำ สนับแข้งเกราะแดง'],
        ['รองเท้าเกราะโลหิต', { def: 4, vit: 1 }, 'รองเท้าดำหุ้มเหล็ก แถบทอง'],
        ['หมวกเกราะเขาโลหิต', { def: 5, str: 2 }, 'หมวกเกราะแดงดำ เขาโค้งสีเลือดสองข้าง พู่แดงห้อยหลัง']],
      { fit: 1.32, seat: 0.46, dx: -0.1, clip: false, soft: 0 },
      'ซามูไรที่จ่ายเลือดตัวเองแลกท่าดาบ สกิลสายเลือดใช้ HP แทน SP ฟันติดเลือดไหลซ้อนได้ 10 ชั้น แล้วระเบิดแผลหรือดื่มเลือดศัตรูกลับมา สร้างโล่โลหิตที่ระเบิดได้'],
    windsamurai: ['Tempest Ronin', 'samurai', 'katana_wind', 6, 3,
      [['ชุดซามูไรสายลม', { def: 8, agi: 3 }, 'กิโมโนขาวลายเมฆ ผ้าพันคอขาว บ่าเกราะหยก เชือกคาดเอวเขียวห้อยขนนก'],
        ['ฮากามะสายลม', { def: 4, agi: 1 }, 'กางเกงฮากามะเขียวหยก'],
        ['รองเท้าฟางสายลม', { def: 3, agi: 1 }, 'สนับแข้งผ้าขาว รองเท้าฟางสายหยก'],
        ['งอบสายลม', { def: 2, agi: 2, dex: 1 }, 'หมวกฟางทรงกรวย สายรัดคางหยก ริบบิ้นเขียวปลิว']],
      { fit: 1.25, seat: 0.45, dx: -0.06, clip: false, soft: 0 },
      'ซามูไรสายลม เคลื่อนที่ไวที่สุดในเกม ก้าวลมพุ่งได้หลายจังหวะ ยิ่งวิ่งยิ่งสะสมกระแสลมให้แรงและเร็วขึ้น ทิ้งคมลมหวนกลับตามรอยพุ่ง'],
  };
  const sets = [];
  for (const id in JOBS) {
    const [name, from, weapon, hp, sp, look, fit, desc] = JOBS[id];
    const [top, pants, shoes, hat] = look, rarity = from ? 'legend' : 'epic';
    ITEMS['top_' + id] = { slot: 'top', name: top[0], rig: id, rarity, stats: top[1], desc: top[2] };
    ITEMS['pants_' + id] = { slot: 'pants', name: pants[0], rig: id, rarity, stats: pants[1], desc: pants[2] };
    ITEMS['shoes_' + id] = { slot: 'shoes', name: shoes[0], rig: id, rarity, stats: shoes[1], desc: shoes[2] };
    ITEMS['hat_' + id] = Object.assign({ slot: 'hat', name: hat[0], sprite: 'hat_' + id, rarity, stats: hat[1], desc: hat[2] }, fit);
    sets.push({ id, name, icon: 'hat_' + id, items: { hair: 'hair_spiky', robe: null, cape: null, top: 'top_' + id, pants: 'pants_' + id, shoes: 'shoes_' + id, hat: 'hat_' + id, weapon } });
    NC.JOBS[id] = from
      ? { name, tier: 2, from, maxJob: 50, hp, sp, cls: id, skills: [], desc, admin: true }
      : { name, tier: 1, maxJob: 50, hp, sp, cls: id, skills: [], desc, admin: true };
  }
  const at = NC.CLASSES.findIndex((c) => c.id === 'monk');
  NC.CLASSES.splice(at < 0 ? NC.CLASSES.length : at + 1, 0, ...sets.filter((s) => !NC.CLASSES.some((c) => c.id === s.id)));
  NC.SAMURAI = { jobs: SAM, sets, tiers: TIERS }; // (tiers: js/forgecraft.js forges the A ones, js/rebalance.js drops the rest)
})();
