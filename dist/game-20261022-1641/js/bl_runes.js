/* bl_runes.js — "ดรอปสร้างบิล" part 2: skill runes (รูนจารึกสกิล). A rune goes INTO A SKILL (not into gear, so it is not a
   card): the same skill plays differently by its runes. A skill gets its first rune slot at half its max level (Lv 5 of
   10) and its second at its max (Lv 10). A rune fits only skills of its kind (projectile, area, melee, attack, buff,
   summon, any). Runes drop at tier I (0.15% from the monster families that match them; heavy from map bosses, blood
   from story bosses, focus / execute from elite forms); Papa Moo merges 3 into the next tier (I -> II -> III).
   Socketing / removing (free, the rune comes back) is on the skill's card in the skills window (K).
   Hooks: NC.skillCardExtras / NC.skillCardActs (js/skillwin.js), NC.FORGE_TABS, SkillKit K.shot (extra shots, pierce,
   bounce), NC.skillScale (area size), NC.skillCost + NC.skillCasts (HP cost, cooldown, after-cast delay, echo, pull,
   rush, linger, skyfall, shell, share), NC.skillAcdOf, NC.heroHit (damage factors, statuses), NC.damageEnemy (corpse
   bursts, drops), NC.heroGuards (the shell), NC.Pets.summon (longer summons), NC.saveGame / NC.loadGear.
   NC.BL.socket('fireball', 0, 'split', 3) sockets an owned rune. */
(function () {
  'use strict';
  const NC = window.NC, SK = NC.SKILLS, RUN = NC.SKILL_RUN, MAT = NC.MATERIALS, K = NC.SkillKit, V = NC.VFX, BL = NC.BL;
  if (!BL) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const alive = (e) => e && !e.dead && e.hp > 0;
  const ROMAN = ['', 'I', 'II', 'III'];
  const ON = { proj: 'ลูกยิง', area: 'พื้นที่', melee: 'ประชิด', attack: 'สกิลโจมตี', buff: 'บัฟ', pet: 'เรียกสัตว์', any: 'ทุกสกิล' };
  // key, name, fits, tiers' text, values per tier [I, II, III]
  const RUNES = {
    split: { n: 'รูนแยก', on: 'proj', t: ['ลูกยิง +1 · ดาเมจ −30%', 'ลูกยิง +2 · ดาเมจ −30%', 'ลูกยิง +2 · ดาเมจ −20%'], extra: [1, 2, 2], k: [0.7, 0.7, 0.8] },
    pierce: { n: 'รูนทะลุ', on: 'proj', t: ['ทะลุศัตรู · ดาเมจ −15%', 'ทะลุศัตรู · ดาเมจ −8%', 'ทะลุศัตรู เต็มแรง'], k: [0.85, 0.92, 1] },
    bounce: { n: 'รูนสะท้อน', on: 'proj', t: ['เด้งไปตัวถัดไป 1 ครั้ง 60%', 'เด้ง 2 ครั้ง 60%', 'เด้ง 3 ครั้ง 80%'], n2: [1, 2, 3], k: [0.6, 0.6, 0.8] },
    echo: { n: 'รูนก้อง', on: 'attack', t: ['ร่ายซ้ำเองหลัง 0.6 วิ ดาเมจ 30%', 'ร่ายซ้ำ 40%', 'ร่ายซ้ำ 55%'], k: [0.3, 0.4, 0.55] },
    wide: { n: 'รูนขยาย', on: 'area', t: ['พื้นที่ +30% · ดาเมจ −10%', 'พื้นที่ +45% · ดาเมจ −10%', 'พื้นที่ +60% · ดาเมจ −5%'], s: [1.3, 1.45, 1.6], k: [0.9, 0.9, 0.95] },
    focus: { n: 'รูนหดแน่น', on: 'area', t: ['พื้นที่ −40% · ดาเมจ +25%', 'ดาเมจ +35%', 'ดาเมจ +50%'], s: [0.6, 0.6, 0.6], k: [1.25, 1.35, 1.5] },
    linger: { n: 'รูนค้าง', on: 'area', t: ['ทิ้งวงค้าง 2 วิ ตีทุกวิ 15%', 'ค้าง 3 วิ · 20%', 'ค้าง 4 วิ · 25%'], d: [2, 3, 4], k: [0.15, 0.2, 0.25] },
    pull: { n: 'รูนดูด', on: 'area', t: ['ดูดศัตรูรอบจุดเล็งเข้ากลาง', 'ดูด + ช้า 2 วิ', 'ดูด + มึน 0.8 วิ'] },
    corpse: { n: 'รูนระเบิดศพ', on: 'attack', t: ['ตัวที่ตายจากสกิลนี้ระเบิด 50% ATK', 'ระเบิด 75% ATK', 'ระเบิด 100% ATK'], k: [0.5, 0.75, 1] },
    haste: { n: 'รูนเร็ว', on: 'any', t: ['คูลดาวน์และดีเลย์ −15% · ดาเมจ −10%', '−22% · ดาเมจ −10%', '−30% · ดาเมจ −10%'], c: [0.85, 0.78, 0.7] },
    heavy: { n: 'รูนหนัก', on: 'attack', t: ['ดาเมจ +20% · ดีเลย์หลังร่าย +30%', 'ดาเมจ +30% · ดีเลย์ +30%', 'ดาเมจ +40% · ดีเลย์ +25%'], k: [1.2, 1.3, 1.4], c: [1.3, 1.3, 1.25] },
    blood: { n: 'รูนเลือด', on: 'any', t: ['ใช้ HP แทน SP (1 SP = 2 HP) · ดาเมจ +15%', 'ดาเมจ +20%', 'ดาเมจ +25% · 1 SP = 1.5 HP'], hp: [2, 2, 1.5], k: [1.15, 1.2, 1.25] },
    execute: { n: 'รูนประหาร', on: 'attack', t: ['เป้าเลือดต่ำกว่า 30% ดาเมจ +30%', 'ต่ำกว่า 30% · +45%', 'ต่ำกว่า 35% · +60%'], at: [0.3, 0.3, 0.35], k: [1.3, 1.45, 1.6] },
    corrode: { n: 'รูนกัดกร่อน', on: 'attack', t: ['ติดพิษ 4 วิ', 'พิษแรงขึ้น', 'พิษแรงสุด'], k: [0.05, 0.075, 0.1] },
    burn: { n: 'รูนเผา', on: 'attack', t: ['ติดไฟ 3 วิ', 'ติดไฟ 4 วิ', 'ติดไฟ 5 วิ'], d: [3, 4, 5] },
    curse: { n: 'รูนสาป', on: 'attack', t: ['เป้ารับดาเมจทุกแหล่ง +8% 5 วิ', '+12%', '+16%'], k: [1.08, 1.12, 1.16] },
    skyfall: { n: 'รูนตกฟ้า', on: 'attack', t: ['ดาวตกตามลงมา 1 ลูก 40%', '1 ลูก 60%', '2 ลูก 50%'], n2: [1, 1, 2], k: [0.4, 0.6, 0.5] },
    rush: { n: 'รูนพุ่ง', on: 'melee', t: ['พุ่งหาเป้า 3 ช่องก่อนตี', 'พุ่ง 4 ช่อง', 'พุ่ง 5 ช่อง · ดาเมจ +15%'], d: [120, 160, 200], k: [1, 1, 1.15] },
    ambush: { n: 'รูนซุ่ม', on: 'melee', t: ['ตีแรกใส่ตัวที่ยังไม่สู้ +40%', '+60%', '+80%'], k: [1.4, 1.6, 1.8] },
    stagger: { n: 'รูนกระแทก', on: 'melee', t: ['มึน 0.4 วิ', 'มึน 0.6 วิ', 'มึน 0.8 วิ'], d: [0.4, 0.6, 0.8] },
    pal: { n: 'รูนคู่หู', on: 'pet', t: ['สัตว์ที่เรียกอยู่นานขึ้น 30%', '+50%', '+70%'], k: [1.3, 1.5, 1.7] },
    share: { n: 'รูนแบ่งปัน', on: 'buff', t: ['บัฟติดเพื่อนรอบตัว (ผล 50%)', 'ผล 65%', 'ผล 80%'], k: [0.5, 0.65, 0.8] },
    shell: { n: 'รูนเปลือก', on: 'buff', t: ['บัฟแล้วได้โล่ 8% HP สูงสุด', 'โล่ 12%', 'โล่ 16%'], k: [0.08, 0.12, 0.16] },
    moonrite: { n: 'รูนจันทร์', on: 'any', t: ['กลางคืนดาเมจ +20% · กลางวัน −10%', 'กลางคืน +30%', 'กลางคืน +40%'], k: [1.2, 1.3, 1.4] },
  };
  const RKEYS = Object.keys(RUNES);
  // the runes' own hits (a lingering zone, a falling star, a corpse burst): hidden skills, ATK or MATK (the higher)
  for (const [id, name] of [['bl_linger', 'วงค้าง'], ['bl_skyfall', 'ดาวตก'], ['bl_corpse', 'ระเบิดศพ']])
    SK[id] = { id, name, hidden: true, active: false, kind: 'active', type: 'best', element: null, max: 1, mul: () => 1, sp: () => 0, cd: 0, desc: () => name };
  const rid = (k, t) => 'bl_rune_' + k + '_' + t;
  for (const k of RKEYS) for (let t = 1; t <= 3; t++) {
    MAT[rid(k, t)] = { name: RUNES[k].n + ' ' + ROMAN[t], price: [0, 400, 1500, 5000][t], rare: t >= 2, kindTh: 'รูนจารึก',
      desc: `ใส่ในสกิลชนิด${ON[RUNES[k].on]}: ${RUNES[k].t[t - 1]} · ใส่ที่หน้าสกิล (K) · รวม 3 อันเป็นขั้นถัดไปที่ป๋าหมูหริ่ง` };
    const ic = NC.ASSET_MANIFEST_BUILDLOOT && NC.ASSET_MANIFEST_BUILDLOOT['bl_rune_' + k];
    if (ic && NC.ASSET_MANIFEST_SHOP) NC.ASSET_MANIFEST_SHOP[rid(k, t)] = ic;
  }

  // ---------------- what kind a skill is ----------------
  const KIND = {};
  function kindsOf(id) {
    if (KIND[id]) return KIND[id];
    const S = SK[id], out = new Set(['any']);
    if (!S) return (KIND[id] = out);
    let f = RUN[id]; while (f && f._orig) f = f._orig;   // (wrapped runs: js/vcstorm.js keeps the real one)
    const kind = NC.kindOf ? NC.kindOf(S) : S.kind, src = f ? String(f) : '', rc = S.roClass;
    if (kind === 'buff') out.add('buff');
    if (rc === 'm' || /Pets\.summon/.test(src)) out.add('pet');
    if (kind === 'active' && !['heal', 'buff'].includes(S.type)) {
      out.add('attack');
      if (/\.shot\(/.test(src)) out.add('kshot');
      if (/\.shot\(|\bproj\(|vproj|\.chain\(|shootArrow|Arrow\(|missile|bullet|kunai|shuriken|fireball|bolt/i.test(src)) out.add('proj');
      if (['a', 'z', 'B'].includes(rc) || /\.nova\(|\.rain\(|\.zone\(|\baround\(|\.pillar\(/.test(src) || (NC.CAST_AREA && NC.CAST_AREA[id])) out.add('area');
      const job = NC.skillJob && NC.skillJob(id), ws = (job && NC.JOB_WEAPONS && NC.JOB_WEAPONS[job]) || [];
      if (!out.has('proj') && !out.has('area') && ws.length && ws.every((w) => /bow|gun|pistol|rifle|kunai|huuma|shuriken/.test(w))) out.add('proj');
      if (rc === 'd' || /\.dash\(|\.cone\(|\.blink\(/.test(src) || (!out.has('proj') && !out.has('area'))) out.add('melee');
    }
    return (KIND[id] = out);
  }
  const fits = (id, k) => kindsOf(id).has(RUNES[k].on) && (k !== 'pierce' || kindsOf(id).has('kshot'));   // (pierce needs SkillKit's shots)
  // the skill's two slots open at half its max level and at its max
  const slotLv = (id, i) => { const m = (SK[id] && SK[id].max) || 10; return i === 0 ? Math.max(1, Math.ceil(m / 2)) : m >= 2 ? m : 99; };

  // ---------------- what the hero has socketed ----------------
  const RS = { by: {} };   // skill id -> ['split:3', null]
  const runesOf = (id) => RS.by[id] || [];
  const runeOn = (id, k) => { for (const r of runesOf(id)) if (r && r.startsWith(k + ':')) return Number(r.split(':')[1]); return 0; };
  const v = (k, key, t) => RUNES[k][key][t - 1];
  function socket(game, id, i, k, t) {
    const p = game.player;
    if (!fits(id, k) || NC.skillLv(p, id) < slotLv(id, i) || BL.has(p, rid(k, t)) <= 0) return false;
    const cur = runesOf(id)[i];
    if (cur) { const [ck, ct] = cur.split(':'); BL.give(game, rid(ck, Number(ct)), 1); }
    BL.take(p, rid(k, t), 1);
    const row = (RS.by[id] = runesOf(id).slice()); row[i] = k + ':' + t;
    NC.saveTrade(game); save(game);
    return true;
  }
  function unsocket(game, id, i) {
    const cur = runesOf(id)[i];
    if (!cur) return;
    const [ck, ct] = cur.split(':');
    BL.give(game, rid(ck, Number(ct)), 1);
    RS.by[id] = runesOf(id).slice(); RS.by[id][i] = null;
    NC.saveTrade(game); save(game);
  }
  // every socketed rune back to the bag; how many. Uncle Coco's skill reset (js/shop.js NC.resetSkills) takes every skill
  // below its slots: the runes stayed there hidden and were lost (bug report #83, 2026-10-19). Offline only: online the
  // server's reset gives them back (backend patch 014) and the record follows (js/online/buildloot.js).
  function returnAll(game) {
    let n = 0;
    for (const id in RS.by) for (const r of RS.by[id] || []) if (r) { const [k, t] = r.split(':'); BL.give(game, rid(k, Number(t)), 1); n++; }
    RS.by = {};
    if (n) { NC.saveTrade(game); save(game); }
    return n;
  }

  // ---------------- projectiles: more of them, through, bouncing ----------------
  const baseShot = K.shot;
  let inShot = false;
  K.shot = function (game, p, id, o) {
    if (inShot || !p || p !== game.player || !runeOn(id, 'pierce')) return baseShot.apply(this, arguments);
    return baseShot.call(this, game, p, id, Object.assign({}, o, { pierce: true }));
  };
  function bounceFrom(game, p, id, e, left, done) {
    if (left <= 0) return;
    const next = game.enemies.filter((x) => alive(x) && !done.has(x) && NC.dist(x.x, x.y, e.x, e.y) < 360).sort((a, b) => NC.dist(a.x, a.y, e.x, e.y) - NC.dist(b.x, b.y, e.x, e.y))[0];
    if (!next) return;
    done.add(next);
    V.at(0.08, () => {
      if (!alive(next)) return;
      inShot = true;
      try {
        baseShot(game, p, id, { from: [e.x, e.y - 45], ang: NC.angle(e.x, e.y - 45, next.x, next.y - 45), v: 900, range: 420, r: 40, target: next, home: 6,
          hit(x) { BOUNCE.k = v('bounce', 'k', runeOn(id, 'bounce') || 1); BOUNCE.on = true; try { K.hit(game, p, id, x, 0, 0); } finally { BOUNCE.k = 1; BOUNCE.on = false; } bounceFrom(game, p, id, x, left - 1, done); } });
      } finally { inShot = false; }
    });
  }
  const BOUNCE = { k: 1, on: false, t: {} };

  // ---------------- areas: bigger / smaller ----------------
  const baseScale = NC.skillScale;
  NC.skillScale = function (p, id) {
    let s = baseScale ? baseScale(p, id) : 1;
    if (p && NC.game && p === NC.game.player) { const w = runeOn(id, 'wide'), f = runeOn(id, 'focus'); if (w) s *= v('wide', 's', w); if (f) s *= v('focus', 's', f); }
    return s;
  };

  // ---------------- cost: blood pays HP (and the sacrifice taint, js/bl_core.js) ----------------
  const baseCost = NC.skillCost;
  NC.skillCost = function (p, id, lv) {
    const c = baseCost(p, id, lv);
    if (!p || !NC.game || p !== NC.game.player || !(c > 0)) return c;
    if (runeOn(id, 'blood')) return 0;
    if (p.sp < c && BL.traitsOf(p).has('sacrifice') && p.hp > c * 2 + 1) return 0;
    return c;
  };
  const hpCostOf = (p, id, lv) => {
    const real = baseCost(p, id, lv), b = runeOn(id, 'blood');
    if (b) return Math.ceil(real * v('blood', 'hp', b));
    if (p.sp < real && BL.traitsOf(p).has('sacrifice')) return real * 2;
    return 0;
  };

  // ---------------- after a cast: cooldown, HP, echo, pull, rush, linger, skyfall, buffs ----------------
  const ECHO = { id: null, k: 1, until: 0 };
  let inEcho = false;
  const aimSpot = (game, p) => (game.mouse && game.mouse.active ? [game.mouse.wx, game.mouse.wy + 10] : [p.x + Math.cos(p.aim || 0) * 260, p.y + Math.sin(p.aim || 0) * 200]);
  NC.skillCasts.push((game, p, id, lv) => {
    if (!p || p !== game.player || inEcho) return;
    const R = runesOf(id);
    if (!R.some(Boolean)) return;
    const hp = hpCostOf(p, id, lv);
    if (hp > 0) { p.hp = Math.max(1, p.hp - hp); if (NC.FX && NC.FX.text) NC.FX.text(p.x, p.y - 120, '-' + hp, '255,90,110'); }
    const h = runeOn(id, 'haste');
    if (h) for (const k of ['@' + id]) { if (p.cd[k]) p.cd[k] *= v('haste', 'c', h); if (p.cdFull[k]) p.cdFull[k] *= v('haste', 'c', h); }
    const [sx, sy] = aimSpot(game, p);
    const pu = runeOn(id, 'pull');
    if (pu) for (const e of game.enemies) if (alive(e) && !e.boss && NC.dist(e.x, e.y, sx, sy) < 280) {
      const d = NC.dist(e.x, e.y, sx, sy), k = Math.min(1, 140 / Math.max(1, d));
      NC.tryMove ? NC.tryMove(game.world, e, (sx - e.x) * k * 0.8, (sy - e.y) * k * 0.8) : 0;
      if (pu >= 2) e.slow = Math.max(e.slow || 0, 2);
      if (pu >= 3) NC.statusEnemy(game, e, 'stun', 0.8);
      if (V.sparks) V.sparks(e.x, e.y - 40, 4, '190,150,255', { size: 0.6 });
    }
    const ru = runeOn(id, 'rush');
    if (ru) {
      const tgt = (K.nearest ? K.nearest(game, sx, sy, 400, 1)[0] : null);
      const tx = tgt ? tgt.x : sx, ty = tgt ? tgt.y : sy, d = NC.dist(p.x, p.y, tx, ty), go = Math.max(0, Math.min(v('rush', 'd', ru), d - 60));
      if (go > 10) K.blink(game, p, p.x + ((tx - p.x) / d) * go, p.y + ((ty - p.y) / d) * go, { rgb: '255,220,120', ghost: '#e8c070', line: true });
    }
    const li = runeOn(id, 'linger');
    if (li && K.zone) K.zone(game, p, 'bl_linger', sx, sy, 110, v('linger', 'd', li), 1, { rgb: '150,230,170', mul: (SK[id].mul ? SK[id].mul(lv) : 1) * v('linger', 'k', li) });
    const sk = runeOn(id, 'skyfall');
    if (sk) for (let i = 0; i < v('skyfall', 'n2', sk); i++) V.at(0.35 + i * 0.2, () => starfall(game, p, id, sx + NC.rand(-60, 60), sy + NC.rand(-30, 30), v('skyfall', 'k', sk)));
    const spl = runeOn(id, 'split');
    if (spl && RUN[id]) for (let i = 1; i <= v('split', 'extra', spl); i++) rerun(game, p, id, lv, (i % 2 ? 1 : -1) * 0.22 * Math.ceil(i / 2), 0.05 * i);
    const ec = runeOn(id, 'echo');
    if (ec && RUN[id]) {
      const aim = p.aim, mouse = game.mouse ? Object.assign({}, game.mouse) : null;
      V.at(0.6, () => {
        if (p.dead > 0) return;
        const g = mouse ? Object.create(game, { mouse: { value: mouse } }) : game;
        const a0 = p.aim, lock = p.skillLock;
        ECHO.id = id; ECHO.k = v('echo', 'k', ec); ECHO.until = game.time + 1.2;
        inEcho = true; p.noPose = true; p.aim = aim;
        try { RUN[id](g, p, lv, 'q'); } catch (err) { console.warn('rune echo', id, err); }
        finally { inEcho = false; p.noPose = false; p.aim = a0; p.skillLock = lock; }
        if (V.ring) V.ring(p.x, p.y, 20, 120, 8, '150,210,255', 0.4);
      });
    }
    const sh = runeOn(id, 'share');
    if (sh && K.buffFriends) K.buffFriends(game, p, { r: 520, dur: 20, atk: 1 + 0.2 * v('share', 'k', sh), guard: 1 - 0.2 * v('share', 'k', sh), rgb: '255,170,190' });
    const sl = runeOn(id, 'shell');
    if (sl) { p._blShell = { hp: Math.round(p.maxHp * v('shell', 'k', sl)), until: game.time + 8 }; if (V.ring) V.ring(p.x, p.y, 30, 110, 8, '120,220,210', 0.5); }
  });
  // the same skill again with no pose, SP or cooldown, aimed da off (the split rune's extra volleys)
  function rerun(game, p, id, lv, da, delay) {
    const aim = p.aim, mouse = game.mouse && game.mouse.active ? game.mouse : null;
    V.at(delay, () => {
      if (p.dead > 0) return;
      const a = aim + da, ang = mouse ? NC.angle(p.x, p.y, mouse.wx, mouse.wy) + da : a, d = mouse ? NC.dist(p.x, p.y, mouse.wx, mouse.wy) : 300;
      const g = Object.create(game, { mouse: { value: { wx: p.x + Math.cos(ang) * d, wy: p.y + Math.sin(ang) * d, sx: 0, sy: 0, active: true, down: false } } });
      const a0 = p.aim, lock = p.skillLock;
      inEcho = true; p.noPose = true; p.aim = a;
      try { RUN[id](g, p, lv, 'q'); } catch (err) { console.warn('rune split', id, err); }
      finally { inEcho = false; p.noPose = false; p.aim = a0; p.skillLock = lock; }
    });
  }
  function starfall(game, p, id, x, y, k) {
    if (V.beam) V.beam(x, y, 50, 520, '255,225,140', 0.35);
    if (V.ring) V.ring(x, y, 10, 110, 8, '255,225,140', 0.45);
    if (V.sparks) V.sparks(x, y - 20, 14, '255,225,140', { size: 0.9 });
    for (const e of game.enemies) if (alive(e) && NC.dist(e.x, e.y, x, y) < 100) {
      const r = NC.heroHit(p.d, e, { kind: (SK[id] && SK[id].type === 'magic') ? 'magic' : 'phys', mul: k * ((SK[id] && SK[id].mul) ? SK[id].mul(Math.max(1, NC.skillLv(p, id))) : 1), skill: true, sid: 'bl_skyfall', element: 'holy', sure: true });
      NC.damageEnemy(game, e, r, 0, -60, { color: '255,225,140' });
    }
  }
  // the after-cast delay: haste shortens it, heavy lengthens it
  if (NC.skillAcdOf) {
    const baseAcd = NC.skillAcdOf;
    NC.skillAcdOf = function (p, id) {
      let a = baseAcd(p, id);
      if (p && NC.game && p === NC.game.player && a > 0) { const h = runeOn(id, 'haste'), he = runeOn(id, 'heavy'); if (h) a *= v('haste', 'c', h); if (he) a *= v('heavy', 'c', he); }
      return a;
    };
  }
  // the shell soaks hits
  if (NC.heroGuards) NC.heroGuards.push((game, p, dmg) => {
    const S = p._blShell;
    if (!S || S.hp <= 0 || game.time > S.until) return dmg;
    const soak = Math.min(S.hp, dmg);
    S.hp -= soak;
    return dmg - soak;
  });
  // longer summons
  if (NC.Pets && NC.Pets.summon) {
    const baseSummon = NC.Pets.summon;
    NC.Pets.summon = function (game, p, type, o) {
      const pt = o && o.skill && runeOn(o.skill, 'pal');
      if (pt && o.dur) o = Object.assign({}, o, { dur: o.dur * v('pal', 'k', pt) });
      return baseSummon.call(this, game, p, type, o);
    };
  }

  // ---------------- damage: per hit ----------------
  const baseHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHit(d, e, o), G = NC.game, p = G && G.player;
    if (!p || p.kind !== 'player' || d !== p.d || !e || !(r.dmg > 0)) return r;
    const id = o && o.sid;
    let k = 1;
    if (e._blCurse && e._blCurse.until > G.time) k *= e._blCurse.k;
    if (id === 'bl_linger') return finish(r, k);
    if (!id || !runesOf(id).some(Boolean)) return finish(r, k);
    e._blSid = id; e._blSidT = G.time;
    const t = (key) => runeOn(id, key);
    let x;
    if ((x = t('split'))) k *= v('split', 'k', x);
    if ((x = t('pierce'))) k *= v('pierce', 'k', x);
    if ((x = t('wide'))) k *= v('wide', 'k', x);
    if ((x = t('focus'))) k *= v('focus', 'k', x);
    if (t('haste')) k *= 0.9;
    if ((x = t('heavy'))) k *= v('heavy', 'k', x);
    if ((x = t('blood'))) k *= v('blood', 'k', x);
    if ((x = t('execute')) && e.hp / Math.max(1, e.maxHp) < v('execute', 'at', x)) k *= v('execute', 'k', x);
    if ((x = t('rush'))) k *= v('rush', 'k', x);
    if ((x = t('ambush')) && !e._blTouched) k *= v('ambush', 'k', x);
    if ((x = t('moonrite'))) k *= BL.night(G) ? v('moonrite', 'k', x) : 0.9;
    if (ECHO.id === id && G.time < ECHO.until && inEchoHit()) k *= ECHO.k;
    if (BOUNCE.k !== 1) k *= BOUNCE.k;
    if ((x = t('bounce')) && !BOUNCE.on && kindsOf(id).has('proj') && G.time - (BOUNCE.t[id] || -9) > 0.12) { BOUNCE.t[id] = G.time; bounceFrom(G, p, id, e, v('bounce', 'n2', x), new Set([e])); }
    if ((x = t('corrode')) && !(e.poison && e.poison.t > 2)) NC.statusEnemy(G, e, 'poison', 4, Math.max(1, Math.round(r.dmg * v('corrode', 'k', x))));
    if ((x = t('burn')) && NC.addStatus) NC.addStatus(G, e, 'burn', v('burn', 'd', x));
    if ((x = t('curse'))) e._blCurse = { k: v('curse', 'k', x), until: G.time + 5 };
    if ((x = t('stagger')) && (!e._blStagT || G.time - e._blStagT > 1.5)) { e._blStagT = G.time; NC.statusEnemy(G, e, 'stun', v('stagger', 'd', x)); }
    e._blTouched = true;
    return finish(r, k);
  };
  // (the echo's own hits are the ones in its window; the first cast's late hits share it, a small gift)
  const inEchoHit = () => true;
  const finish = (r, k) => { if (k !== 1) r.dmg = Math.max(1, Math.round(r.dmg * k)); return r; };

  // ---------------- kills: corpse bursts, rune drops ----------------
  const FAM_RUNE = { split: 'split', bomb: 'corpse', heal: 'share', shield: 'shell', summon: 'pal', shoot: 'pierce', burrow: 'ambush', sonic: 'echo',
    spore: 'linger', swoop: 'haste', leap: 'stagger', charge: 'rush', poison: 'corrode', flame: 'burn', thread: 'pull', star: 'skyfall', hex: 'curse',
    phase: 'moonrite', quake: 'wide', wave: 'bounce', gust: 'haste', strike: 'stagger' };
  const famOf = NC.BL.familyOf = function (type) {
    const M = NC.MONSTERS[type] || {}, i = type, el = M.element || 'neutral', has = (...ws) => ws.some((w) => i.includes(w));
    if (has('scarecrow')) return 'hex';
    if (has('split', 'slime', 'magma_blob', 'ink_drop')) return 'split';
    if (has('bomb', 'explod', 'coffin', 'puff', 'spring')) return 'bomb';
    if (has('heal', 'nurse', 'doctor', 'repair')) return 'heal';
    if (has('shield', 'turtle', 'cabinet', 'golem', 'guard', 'tomb_knight', 'warden')) return 'shield';
    if (has('mother', 'lead', 'alpha', 'queen')) return 'summon';
    if (has('spit', 'shooter', 'archer', 'seed', 'scorpion')) return 'shoot';
    if (has('burrow', 'dig', 'mole', 'worm', 'eel', 'root', 'grave_digger', 'miner')) return 'burrow';
    if (has('bat')) return 'sonic';
    if (has('moth', 'sleep', 'spore', 'shroom', 'mushling')) return 'spore';
    if (has('crow', 'eagle', 'sparrow', 'vulture', 'owl', 'kingfisher', 'pterosaur', 'heron', 'dragonfly', 'flying', 'bee', 'mosquito', 'book')) return 'swoop';
    if (has('leap', 'frog', 'toad', 'rabbit', 'trout', 'hedgehog', 'goat', 'otter')) return 'leap';
    if (has('boar', 'rhino', 'ram', 'horse', 'ankylo', 'dino', 'raptor', 'hound', 'wolf', 'deer', 'giant', 'rooster', 'carrot', 'beetle', 'cart')) return 'charge';
    if (has('puppet', 'thread', 'hand', 'string', 'scope')) return 'thread';
    if (el === 'poison') return 'poison';
    if (el === 'fire') return 'flame';
    if (el === 'holy') return 'star';
    if (el === 'ghost' || el === 'undead' || has('ghost', 'wisp', 'candle', 'spirit', 'sprite', 'tombstone', 'zombie', 'skeleton', 'bone')) return 'hex';
    if (el === 'shadow' || has('hollow', 'shadow', 'mist', 'lightless')) return 'phase';
    return { earth: 'quake', water: 'wave', wind: 'gust' }[el] || 'strike';
  };
  const isMapBoss = (e) => !!(NC.BOSSES && NC.BOSSES[e.type]) || e.isBoss;
  const isStory = (e) => /^sb_/.test(e.type || '') || e.type === 'aurelion';
  const RATE = { normal: 0.0015, elite: 0.01, boss: 0.08, story: 0.1 };
  NC.BL.runeFor = function (e) {
    const M = NC.SPECIES && NC.SPECIES[e.type];
    if (isStory(e)) return ['blood', RATE.story];
    if (isMapBoss(e)) return ['heavy', RATE.boss];
    if (M && M.eliteOf) return [Math.random() < 0.5 ? 'focus' : 'execute', RATE.elite];
    return [FAM_RUNE[famOf(e.type)] || 'stagger', RATE.normal];
  };
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    const was = e.hp;
    baseDamage(game, e, r, kx, ky, o);
    if (!(was > 0 && e.hp <= 0) || e.lootless || game.time - (e._heroT || -9) > 1) return;
    const p = game.player;
    // a corpse burst: the skill that last hit it has the corpse rune
    const sid = game.time - (e._blSidT || -9) < 0.6 ? e._blSid : null, ct = sid && runeOn(sid, 'corpse');
    if (ct && !e._blBurst) {
      e._blBurst = true;
      if (V.ring) V.ring(e.x, e.y, 10, 150, 10, '255,140,90', 0.5);
      if (V.sparks) V.sparks(e.x, e.y - 40, 16, '255,160,100', { size: 0.9 });
      for (const x of game.enemies) if (x !== e && alive(x) && NC.dist(x.x, x.y, e.x, e.y) < 150) {
        const rr = NC.heroHit(p.d, x, { kind: 'phys', mul: v('corpse', 'k', ct), skill: true, sid: 'bl_corpse', sure: true });
        NC.damageEnemy(game, x, rr, (x.x - e.x) * 2, (x.y - e.y) * 2, { color: '255,160,100' });
      }
    }
    // a rune drop
    const [k, rate] = NC.BL.runeFor(e);
    if (Math.random() < rate) game.loot.push({ kind: 'loot', mat: rid(k, 1), x: e.x + NC.rand(-30, 30), y: e.y + NC.rand(-12, 12), sort: e.y, t: 0, z: e.z || 0, vz: NC.rand(420, 560), spin: NC.rand(0, 6) });
  };

  // ---------------- the skill card: two rune slots ----------------
  let picking = null;   // { id, i }
  (NC.skillCardExtras = NC.skillCardExtras || []).push((p, id) => {
    const S = SK[id];
    if (!S || (NC.kindOf && NC.kindOf(S) === 'passive') || S.boss || S.hidden) return '';
    const lv = NC.skillLv(p, id), kinds = [...kindsOf(id)].filter((k) => k !== 'any').map((k) => ON[k]);
    let h = `<div class="skw-sec bl-runes"><div class="bl-rh"><b>รูนจารึก</b><small>${kinds.length ? 'ใส่รูนชนิด: ' + kinds.join(' · ') + ' · ทุกสกิล' : 'ใส่รูนชนิด: ทุกสกิล'}</small></div>`;
    for (let i = 0; i < 2; i++) {
      const need = slotLv(id, i);
      if (need > (S.max || 10)) continue;
      const cur = runesOf(id)[i];
      // (a rune left in a slot its skill no longer reaches, by a skill reset before 2026-10-19: shown, and it comes out)
      if (lv < need && !cur) { h += `<div class="bl-slot locked">ช่อง ${i + 1}: ปลดล็อกที่สกิล Lv ${need}</div>`; continue; }
      if (cur) {
        const [k, t] = cur.split(':'), R = RUNES[k];
        h += `<div class="bl-slot${lv < need ? ' locked' : ''}"><img src="${BL.icon('bl_rune_' + k)}" alt=""><span><b>${esc(R.n)} ${ROMAN[t]}</b><small>${lv < need ? `ช่องล็อก (สกิล Lv ${need}) · ถอดเก็บเข้ากระเป๋าได้` : esc(R.t[t - 1])}</small></span>` +
          `<button class="kw-btn grey" data-blunsock="${id}:${i}">ถอด</button></div>`;
      } else h += `<div class="bl-slot empty"><span>ช่อง ${i + 1}: ว่าง</span><button class="kw-btn blue" data-blpickrune="${id}:${i}">ใส่รูน</button></div>`;
      if (picking && picking.id === id && picking.i === i) {
        const mine = [];
        for (const k of RKEYS) if (fits(id, k)) for (let t = 3; t >= 1; t--) if (BL.has(p, rid(k, t)) > 0) mine.push([k, t]);
        h += '<div class="bl-pick">' + (mine.length ? mine.map(([k, t]) => `<button class="bl-rune" data-blsock="${id}:${i}:${k}:${t}" title="${esc(RUNES[k].t[t - 1])}">` +
          `<img src="${BL.icon('bl_rune_' + k)}" alt=""><span><b>${esc(RUNES[k].n)} ${ROMAN[t]}</b><small>${esc(RUNES[k].t[t - 1])} · มี ${BL.has(p, rid(k, t))}</small></span></button>`).join('') :
          '<div class="bl-none">ยังไม่มีรูนที่ใส่สกิลนี้ได้ · รูนดรอปจากมอน (สายที่ตรงกับรูน)</div>') + '</div>';
      }
    }
    return h + '</div>';
  });
  (NC.skillCardActs = NC.skillCardActs || []).push((game, b) => {
    const D = b.dataset;
    if (D.blpickrune) { const [id, i] = D.blpickrune.split(':'); picking = picking && picking.id === id && picking.i === Number(i) ? null : { id, i: Number(i) }; return true; }
    if (D.blsock) { const [id, i, k, t] = D.blsock.split(':'); if (socket(game, id, Number(i), k, Number(t))) { picking = null; game.toast(`จารึก${RUNES[k].n} ${ROMAN[t]} ลงสกิล ${SK[id].name}`); } return true; }
    if (D.blunsock) { const [id, i] = D.blunsock.split(':'); unsocket(game, id, Number(i)); return true; }
    return false;
  });

  // ---------------- Papa Moo: merge 3 runes into the next tier ----------------
  function renderTab(body, game) {
    const p = game.player, rows = [];
    for (const k of RKEYS) for (let t = 1; t <= 3; t++) if (BL.has(p, rid(k, t)) > 0) rows.push([k, t]);
    body.innerHTML = '<div class="fg-make">' + (rows.length ? rows.map(([k, t]) => {
      const n = BL.has(p, rid(k, t)), ok = t < 3 && n >= 3;
      return `<div class="fg-recipe"><img class="fg-ic" src="${BL.icon('bl_rune_' + k)}" alt=""><div class="fg-rt"><b>${esc(RUNES[k].n)} ${ROMAN[t]} ×${n}</b>` +
        `<small>ใส่ในสกิลชนิด${ON[RUNES[k].on]} · ${esc(RUNES[k].t[t - 1])}</small>${t < 3 ? `<div class="fg-need"><span>3 อัน → ${esc(RUNES[k].n)} ${ROMAN[t + 1]}: ${esc(RUNES[k].t[t])}</span></div>` : ''}</div>` +
        (t < 3 ? `<button class="big" data-blmerge="${k}:${t}" ${ok ? '' : 'disabled'}>รวม</button>` : '<span class="bl-max">ขั้นสูงสุด</span>') + '</div>';
    }).join('') : '<div class="fg-empty">ยังไม่มีรูน · รูนขั้น I ดรอปจากมอนสายที่ตรงกับรูนนั้น บอสแมพดรอปรูนหนัก บอสเนื้อเรื่องดรอปรูนเลือด</div>') + '</div>' +
      '<div class="st-note">ใส่รูนที่หน้าสกิล (K): ช่องแรกเปิดที่ครึ่งหนึ่งของเลเวลสูงสุดของสกิล ช่องที่สองที่เลเวลสูงสุด · ถอดได้ฟรี รูนกลับเข้ากระเป๋า</div>';
  }
  function clickTab(t, game) {
    if (!t.dataset.blmerge) return false;
    const p = game.player, [k, tt] = t.dataset.blmerge.split(':'), tier = Number(tt);
    if (tier >= 3 || BL.has(p, rid(k, tier)) < 3) return true;
    BL.take(p, rid(k, tier), 3); BL.give(game, rid(k, tier + 1), 1);
    game.toast(`ได้${RUNES[k].n} ${ROMAN[tier + 1]}`); NC.saveTrade(game);
    return true;
  }
  (NC.FORGE_TABS = NC.FORGE_TABS || []).push({ key: 'runes', label: 'รูน', render: renderTab, click: clickTab });

  // ---------------- saving ----------------
  const KEY = NC.BL_SAVE_KEY || 'nightcamp.buildloot.v1';
  function save(game) {
    if (game.noSave) return;
    let s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
    s.runes = RS.by;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage blocked */ }
  }
  const baseSave = NC.saveGame;
  NC.saveGame = function (game) { baseSave.apply(this, arguments); save(game); };
  const baseLoad = NC.loadGear;
  NC.loadGear = function (game, prm) {
    baseLoad.apply(this, arguments);
    RS.by = {};
    if (!NC.ONLINE) try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); if (s && s.runes && typeof s.runes === 'object') for (const id in s.runes) if (SK[id] && Array.isArray(s.runes[id])) RS.by[id] = s.runes[id].slice(0, 2).map((r) => (typeof r === 'string' && RUNES[r.split(':')[0]] ? r : null)); } catch (e) { /* none */ }
  };

  Object.assign(NC.BL, { RUNES, runesOf, runeOn, kindsOf, fits, slotLv, rid, returnAll,
    socket: (id, i, k, t) => socket(NC.game, id, i, k, t),
    // (js/online/buildloot.js: online what is socketed is the server's record; the picker closes once a rune is sent)
    setRunes: (by) => { RS.by = by || {}; }, unpick: () => { picking = null; } });
})();
