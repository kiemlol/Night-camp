/* hstatus.js — monsters put statuses on the hero, and the hero's resistances (2026-10-11; the user: "อยากได้สถานะต่างๆ
   ด้วย เช่น resistant ... เจาะเกราะ เจาะเวท"). Before this file only the hero put statuses on monsters.
     the statuses   มึน (stun) · แช่แข็ง (freeze) · หลับ (sleep, wakes on a hit): no moving, attacking or casting
                    พิษ · เลือดออก · ไฟไหม้: HP lost every second (never below 1), no HP regen (เลือดออก: no SP regen either)
                    ใบ้ (silence): no skills · ตาบอด (blind): HIT and FLEE −25%, the screen's edge goes dark
                    ช้า (slow): walks at 60%, attacks at 80%
                    After one ends the same one can't come back for 3 s; after any of the first three, none of them for 3 s.
     who puts them  a monster's landed hit (any path: basic hits, its kind's moves, the bosses' moves: they all go through
                    NC.monsterHit just before NC.hurtPlayer): its element first (poison, fire, ghost, shadow, water), else
                    its family (NC.BL.familyOf: spores put to sleep, charges stun, swoops bleed...). Chance 2% + Lv/20 %,
                    elites x1.5, bosses x3 (20% at most), the stopping three x0.6, once per 3 s per monster.
     resisting      res % = the base stat (VIT: stun poison bleed · INT: sleep silence blind · MDEF and a little INT: freeze
                    burn · AGI: slow) + LUK x0.15 for all + gear rows / skills (mods res_<status>), at most 80%; the rare
                    drop-only row "ไม่ติด X" (mods imm_<status>) makes it 100%. The chance is cut by res, the time by res/2.
                    A resisted status shows "ต้าน…" over the head.
     damage taken   every monster hit now knows who hit (the element, near or far, boss, race), so the gear rows of
                    js/gearopts.js work for all of them: rel_<element> (≤50%), rmelee / rrange (≤40%), rboss (≤30%),
                    rrace_<race> (≤40%); the weapons' and sets' own "ต้านธาตุ" (js/wabil.js resist) now works on bosses'
                    moves too.
     cures          ยาเขียวแก้พิษ (poison, bleed, burn) and ยาสามัญประจำค่าย (every lasting status), sold by ลุงโกโก้ in the
                    potion list; used by themselves a moment after a status lands (the auto farm needs nothing new);
                    a click on a status in the buff row uses one too.
   Hooks: NC.monsterHit (who hit, blind's FLEE), NC.heroGuards (the resists), NC.hurtPlayer (rolling a status, waking up),
   NC.updatePlayer (timers, damage over time, the stopping three, slow), NC.castSkill (silence), NC.heroHit (blind's HIT),
   NC.atkSpeed (slow), NC.Party.drawTags (the mark over the head), NC.HUD.renderBuffs (the buff row), NC.saveGame /
   NC.loadGear (the cures, own key). Art: assets/hstatus/ (tools/hstatus_cut.py). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  const KEY = 'nightcamp.hstatus.v1';
  const ICONS = NC.ASSET_MANIFEST_HSTATUS || {};
  if (NC.ASSET_MANIFEST) Object.assign(NC.ASSET_MANIFEST, ICONS);
  const src = (id) => (ICONS[id] ? ICONS[id].src : '');
  const G = () => NC.game;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // online the statuses are the server's (js/online/herostatus.js puts them on p.hst): no damage over time or cure here
  const live = () => !!(NC.OnlineWorld && NC.OnlineWorld.ready);

  // ---------------- the statuses ----------------
  const ST = {
    stun: { th: 'มึน', hard: true, dur: 1.6, by: 'vit', color: '#ffe066', what: 'ขยับ ตี และใช้สกิลไม่ได้' },
    freeze: { th: 'แช่แข็ง', hard: true, dur: 2.4, by: 'mdef', color: '#9fdcff', what: 'ขยับ ตี และใช้สกิลไม่ได้' },
    sleep: { th: 'หลับ', hard: true, dur: 3.5, by: 'int', wake: true, color: '#c9b6ff', what: 'ขยับ ตี และใช้สกิลไม่ได้ · ตื่นเมื่อโดนตี' },
    poison: { th: 'พิษ', dur: 8, dot: 0.012, noHp: true, by: 'vit', color: '#7ddc6a', cure: 'g', what: 'เสีย HP ทุกวินาที · HP ไม่ฟื้นเอง' },
    bleed: { th: 'เลือดออก', dur: 8, dot: 0.016, noHp: true, noSp: true, by: 'vit', color: '#ff6a6a', cure: 'g', what: 'เสีย HP ทุกวินาที · HP และ SP ไม่ฟื้นเอง' },
    burn: { th: 'ไฟไหม้', dur: 5, dot: 0.025, by: 'mdef', color: '#ff9a4d', cure: 'g', what: 'เสีย HP ทุกวินาที' },
    silence: { th: 'ใบ้', dur: 5, by: 'int', color: '#cfd2e6', what: 'ใช้สกิลไม่ได้' },
    blind: { th: 'ตาบอด', dur: 6, by: 'int', color: '#9aa0b4', what: 'HIT และ FLEE −25%' },
    slow: { th: 'ช้า', dur: 5, by: 'agi', color: '#9fe6c0', what: 'เดินช้าลง 40% · ตีช้าลง 20%' },
  };
  const IDS = Object.keys(ST);
  const CAP = 80, IMM_GAP = 3;

  // ---------------- the hero's state ----------------
  const S = (p) => p.hst || (p.hst = {});
  const has = (p, id) => !!(p && p.hst && p.hst[id] && p.hst[id].t > 0);
  const hard = (p) => IDS.some((id) => ST[id].hard && has(p, id));
  const noSkill = (p) => hard(p) || has(p, 'silence');
  const mods = (p) => (p && p.d && p.d.mods) || {};
  // how much of a status the hero shrugs off (%): stats + gear + skills, 80% at most; "ไม่ติด X" = 100
  function resOf(p, id) {
    const d = p.d || {}, m = mods(p);
    if (m['imm_' + id]) return 100;
    const by = ST[id].by;
    const base = by === 'vit' ? d.vit * 0.5 : by === 'int' ? d.int * 0.5 : by === 'agi' ? d.agi * 0.5 : (d.mdef || 0) * 0.6 + (d.int || 0) * 0.2;
    return clamp((base || 0) + (d.luk || 0) * 0.15 + (m['res_' + id] || 0), 0, CAP);
  }
  // put a status on the hero. o: chance (%; none = sure), dur (s), quiet. Returns true when it landed
  function apply(game, id, o) {
    o = o || {};
    const p = game && game.player, D = ST[id];
    if (!D || !p || p.dead > 0 || p.kind !== 'player') return false;
    const t = game.time, imm = p.hstImm || (p.hstImm = {});
    if ((imm[id] || 0) > t || (D.hard && (imm._hard || 0) > t)) return false;
    if (o.chance !== undefined && Math.random() * 100 >= o.chance) return false;
    const res = resOf(p, id);
    if (res > 0 && Math.random() * 100 < res) {
      if (!o.quiet) FX.num(p.x, p.y - 200, res >= 100 ? `กัน${D.th}` : `ต้าน${D.th}`, { fill: D.color, size: 24 });
      imm[id] = t + 1; // (one roll a second for the same status)
      return false;
    }
    if (D.hard) {
      if (p.channel && !p.channel.cast) return false; // (a charge, a flurry: carried through)
      if (NC.cancelCast) NC.cancelCast(game, p);
    }
    const dur = (o.dur || D.dur) * (1 - res / 200), s = S(p), was = s[id] && s[id].t > 0;
    s[id] = { t: Math.max(dur, was ? s[id].t : 0), dur: Math.max(dur, was ? s[id].dur : 0), acc: was ? s[id].acc : 0, at: t };
    if (!was) {
      FX.num(p.x, p.y - 200, D.th + '!', { fill: D.color, size: 30 });
      if (NC.HUD && NC.HUD.log && !o.quiet) NC.HUD.log(`ติดสถานะ ${D.th}${o.from ? ' จาก' + o.from : ''} · ${D.what}`, 'warn');
    }
    cureSoon(p, id);
    return true;
  }
  function end(p, id, game) {
    const s = S(p);
    if (!s[id]) return;
    delete s[id];
    const t = (game || G() || {}).time || 0, imm = p.hstImm || (p.hstImm = {});
    imm[id] = t + IMM_GAP;
    if (ST[id].hard) imm._hard = t + IMM_GAP;
  }
  function cure(game, ids) {
    const p = game.player;
    let n = 0;
    for (const id of ids) if (has(p, id)) { end(p, id, game); n++; }
    return n;
  }

  // ---------------- the cures ----------------
  const CURES = {
    g: { id: 'hs_cure_g', key: 'cureG', name: 'ยาเขียวแก้พิษ', price: 60, ids: ['poison', 'bleed', 'burn'], what: 'แก้พิษ เลือดออก ไฟไหม้ · ใช้เองอัตโนมัติ' },
    p: { id: 'hs_cure_p', key: 'cureP', name: 'ยาสามัญประจำค่าย', price: 300, ids: ['poison', 'bleed', 'burn', 'silence', 'blind', 'slow'], what: 'แก้ทุกสถานะที่ค้างอยู่ (ยกเว้นมึน แช่แข็ง หลับ) · ใช้เองเมื่อติดใบ้ ตาบอด หรือยาเขียวหมด' },
  };
  if (NC.Shop && Array.isArray(NC.Shop.POTIONS))
    for (const k in CURES) { const C = CURES[k]; NC.Shop.POTIONS.push({ id: C.id, name: C.name, what: C.what, icon: src(C.id), price: C.price, key: C.key }); }
  // a lasting status: a cure goes in after a short moment (the green one first when it covers it)
  function cureSoon(p, id) { if (!ST[id].hard) p.hstCureAt = Math.min(p.hstCureAt || Infinity, (G() ? G().time : 0) + 0.6); }
  function useCure(game, p, which, why) {
    const C = CURES[which];
    if (!C || !(p[C.key] > 0)) return false;
    const n = cure(game, C.ids);
    if (!n) return false;
    p[C.key]--;
    FX.num(p.x, p.y - 210, 'หายแล้ว', { fill: '#bff5c8', size: 26 });
    NC.HUD.log(`ใช้${C.name}${why ? ' (' + why + ')' : ''} · เหลือ ${p[C.key]} ขวด`, 'item');
    return true;
  }
  function autoCure(game, p) {
    const left = IDS.filter((id) => !ST[id].hard && has(p, id) && p.hst[id].t > 1.2);
    if (!left.length) return;
    // (the panacea goes in by itself for silence and blindness, or a damage-over-time with no green tonic left; a slow just runs out)
    const green = left.filter((id) => CURES.g.ids.includes(id)), other = left.filter((id) => id === 'silence' || id === 'blind');
    if (other.length && useCure(game, p, 'p', 'อัตโนมัติ')) return;
    if (green.length && !useCure(game, p, 'g', 'อัตโนมัติ') && green.some((id) => p.hst[id].t > 3)) useCure(game, p, 'p', 'อัตโนมัติ');
  }

  // ---------------- who hit the hero ----------------
  // every monster hit runs NC.monsterHit right before NC.hurtPlayer: the attacker is kept for that same moment
  let HIT = null;
  const baseMH = NC.monsterHit;
  NC.monsterHit = function (m, d) {
    const g = G(), p = g && g.player;
    if (!p || d !== p.d) return baseMH.apply(this, arguments);
    const blind = has(p, 'blind'), f0 = d.flee;
    if (blind) d.flee = f0 * 0.75;
    let r;
    try { r = baseMH.apply(this, arguments); } finally { if (blind) d.flee = f0; }
    HIT = { e: m, t: g.time, magic: !!(r && r.magic), far: NC.dist(m.x, m.y, p.x, p.y) > 170 + (m.r || 24) };
    return r;
  };
  const isBoss = (e) => !!(e && ((NC.BOSSES && NC.BOSSES[e.type]) || e.boss || e.isBoss));
  NC.heroGuards.push((game, p, dmg, att) => {
    const h = HIT && HIT.t === game.time ? HIT : null, e = att || (h && h.e);
    if (!e) return dmg;
    const m = mods(p);
    let k = 1;
    const el = e.atkElement || 'neutral';
    if (m['rel_' + el]) k *= 1 - Math.min(50, m['rel_' + el]) / 100;
    if (!att && NC.weaponEffects) for (const a of NC.weaponEffects(p)) if (a.t === 'resist' && a.el === el) k *= 1 - a.pct / 100; // (wabil applies these itself for basic hits)
    const far = h ? h.far : NC.dist(e.x, e.y, p.x, p.y) > 170 + (e.r || 24);
    if (far ? m.rrange : m.rmelee) k *= 1 - Math.min(40, far ? m.rrange : m.rmelee) / 100;
    if (m.rboss && isBoss(e)) k *= 1 - Math.min(30, m.rboss) / 100;
    const race = NC.raceOf ? NC.raceOf(e) : null;
    if (race && m['rrace_' + race]) k *= 1 - Math.min(40, m['rrace_' + race]) / 100;
    return k === 1 ? dmg : Math.max(1, Math.round(dmg * k));
  });

  // ---------------- which monster puts which status ----------------
  const FAM_ST = { spore: 'sleep', sonic: 'silence', thread: 'slow', poison: 'poison', flame: 'burn', hex: 'silence', phase: 'blind',
    charge: 'stun', leap: 'stun', swoop: 'bleed', wave: 'freeze', quake: 'stun', gust: 'slow', shoot: 'bleed', burrow: 'slow',
    split: 'slow', bomb: 'burn', shield: 'stun', star: 'blind', strike: 'bleed' };
  const EL_ST = { poison: 'poison', fire: 'burn', ghost: 'silence', shadow: 'blind', water: 'freeze' };
  const stCache = {};
  function statusOfMon(e) {
    const t = e.type || '';
    if (t in stCache) return stCache[t];
    const M = (NC.MONSTERS && NC.MONSTERS[t]) || {}, el = e.atkElement || M.atkElement || M.element;
    let id = EL_ST[el] || (/bee|wasp|scorpion|snake|toad|venom|sting/.test(t) ? 'poison' : /spider|web/.test(t) ? 'slow' : null);
    if (!id && NC.BL && NC.BL.familyOf) { try { id = FAM_ST[NC.BL.familyOf(t)] || null; } catch (err) { id = null; } }
    return (stCache[t] = id);
  }
  NC.monStatusOf = statusOfMon;
  function inflict(game, e) {
    const id = statusOfMon(e);
    if (!id || (e._hsT && game.time - e._hsT < 3)) return;
    const boss = isBoss(e);
    let ch = (2 + (e.lv || 1) * 0.05) * (boss ? 3 : e.elite || e.champ ? 1.5 : 1);
    if (ST[id].hard) ch *= 0.6;
    ch = Math.min(boss ? 20 : 12, ch);
    if (Math.random() * 100 >= ch) return;
    e._hsT = game.time;
    const M = NC.MONSTERS && NC.MONSTERS[e.type];
    apply(game, id, { from: M ? M.name : '' });
  }
  const baseHurt = NC.hurtPlayer;
  NC.hurtPlayer = function (game, dmg, fromX) {
    const p = game.player, hp0 = p && p.hp;
    const res = baseHurt.apply(this, arguments);
    if (p && p.hp < hp0 && p.dead <= 0) {
      if (has(p, 'sleep')) { end(p, 'sleep', game); FX.num(p.x, p.y - 200, 'ตื่น!', { fill: '#c9b6ff', size: 26 }); }
      const h = HIT && HIT.t === game.time ? HIT : null;
      if (h && h.e && !(NC.PvP && NC.PvP.duel)) inflict(game, h.e);
    }
    return res;
  };

  // ---------------- every frame ----------------
  const baseUpd = NC.updatePlayer;
  NC.updatePlayer = function (game, dt) {
    const p = game.player;
    if (p && (veil || has(p, 'blind'))) drawVeil(p);
    if (!p || !p.hst || p.dead > 0) { if (p && p.dead > 0 && p.hst) p.hst = {}; return baseUpd.apply(this, arguments); }
    const s = p.hst, t = game.time;
    for (const id in s) {
      const D = ST[id], x = s[id];
      if (!D) { delete s[id]; continue; }
      x.t -= dt;
      if (D.dot && !live()) { // (online: the server takes the HP, its number comes in self.hstFx)
        x.acc += dt;
        while (x.acc >= 1) {
          x.acc -= 1;
          const n = Math.max(1, Math.round(p.maxHp * D.dot));
          if (p.hp > 1) { p.hp = Math.max(1, p.hp - n); FX.num(p.x + NC.rand(-20, 20), p.y - 150, n, { fill: D.color, size: 28 }); }
        }
      }
      if (x.t <= 0) end(p, id, game);
    }
    if (p.hstCureAt && t >= p.hstCureAt) { p.hstCureAt = 0; if (!live()) autoCure(game, p); } // (online: the server cures by itself)
    const stop = hard(p), slow = has(p, 'slow'), noHp = IDS.some((id) => ST[id].noHp && has(p, id)), noSp = IDS.some((id) => ST[id].noSp && has(p, id));
    if (!stop && !slow && !noHp && !noSp) return baseUpd.apply(this, arguments);
    const I = game.input, M = game.mouse, x0 = p.x, y0 = p.y, d = p.d, r0 = d && [d.hpRegen, d.spRegen];
    if (stop) {
      I.mx = 0; I.my = 0; I.attack = false; I.attackTap = false; M.down = false;
      for (const k of NC.HOTKEYS || ['q', 'e', 'r', 'f']) I[k] = false;
      p.atk.cd = Math.max(p.atk.cd, 0.05); p.atk.queued = false;
      p.cd = p.cd || {}; p.cd.dash = Math.max(p.cd.dash || 0, 0.05);
    }
    if (d && noHp) d.hpRegen = 0;
    if (d && noSp) d.spRegen = 0;
    let res;
    try { res = baseUpd.apply(this, arguments); }
    finally { if (d && p.d === d) { d.hpRegen = r0[0]; d.spRegen = r0[1]; } }
    if (!p.dash && (stop || slow)) {
      const k = stop ? 0 : 0.6, nx = x0 + (p.x - x0) * k, ny = y0 + (p.y - y0) * k;
      if (!game.world || game.world.fits(nx, ny, p.r || 20)) { p.x = nx; p.y = ny; p.sort = p.y; }
      if (stop) { p.vx = 0; p.vy = 0; p.moving = false; p.running = false; }
    }
    return res;
  };
  // no skills while stopped or silenced (the bar's keys, the cast bar finishing, the monster arts)
  const baseCast = NC.castSkill;
  NC.castSkill = function (game, p) {
    if (p && p === game.player && noSkill(p)) {
      if (!p._hsNoT || game.time - p._hsNoT > 0.8) { p._hsNoT = game.time; FX.num(p.x, p.y - 200, has(p, 'silence') ? 'ใบ้อยู่!' : 'ขยับไม่ได้!', { fill: '#cfd2e6', size: 24 }); }
      return false;
    }
    return baseCast.apply(this, arguments);
  };
  // blind: the hero's HIT −25% (physical hits)
  const baseHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const g = G(), p = g && g.player;
    if (!p || d !== p.d || !has(p, 'blind') || (o && o.kind === 'magic')) return baseHit.apply(this, arguments);
    const h0 = d.hit;
    d.hit = h0 * 0.75;
    try { return baseHit.apply(this, arguments); } finally { d.hit = h0; }
  };
  const baseSpd = NC.atkSpeed;
  NC.atkSpeed = function (p) { const v = baseSpd.apply(this, arguments); return p && p.kind === 'player' && has(p, 'slow') ? v * 0.8 : v; };

  // ---------------- the mark over the head, the dark edge of blindness ----------------
  const P = NC.Party;
  if (P && P.drawTags) {
    const baseTags = P.drawTags;
    P.drawTags = function (ctx, game) {
      baseTags.apply(this, arguments);
      const p = game && game.player;
      if (!p || !p.hst || p.dead > 0) return;
      const on = IDS.filter((id) => has(p, id));
      if (!on.length) return;
      const t = game.time, top = p.y - 215 - (p.z || 0), n = on.length, S = 46;
      on.forEach((id, i) => {
        const sp = NC.SPR['hs_' + id];
        if (!sp) return;
        const x = p.x + (i - (n - 1) / 2) * (S + 6), y = top - 40 + Math.sin(t * 4 + i) * 4;
        ctx.save(); ctx.translate(x, y);
        if (id === 'stun') ctx.rotate(Math.sin(t * 6) * 0.35);
        const left = p.hst[id].t;
        ctx.globalAlpha = left < 1 ? 0.4 + 0.6 * Math.abs(Math.sin(t * 10)) : 1;
        ctx.drawImage(sp.img, -S / 2, -S / 2, S, S);
        ctx.restore();
      });
    };
  }
  let veil = null;
  function drawVeil(p) {
    if (!veil) {
      veil = document.createElement('div');
      veil.id = 'hs-blind';
      veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;transition:opacity .4s;background:radial-gradient(ellipse at 50% 52%,rgba(8,6,16,0) 28%,rgba(8,6,16,.72) 62%,rgba(8,6,16,.94) 100%)';
      document.body.appendChild(veil);
    }
    const o = has(p, 'blind') ? '1' : '0';
    if (veil.style.opacity !== o) veil.style.opacity = o;
  }

  // ---------------- the buff row: one chip per status, a click uses a cure ----------------
  const baseBuffs = NC.HUD.renderBuffs.bind(NC.HUD);
  NC.HUD.renderBuffs = function (p) {
    baseBuffs(p);
    const box = document.getElementById('buffs');
    if (!box || !p) return;
    drawVeil(p);
    for (const id of IDS) {
      let el = box.querySelector('.buff.hs-' + id);
      if (!has(p, id)) { if (el) el.remove(); continue; }
      if (!el) {
        el = document.createElement('div');
        el.className = 'buff hs hs-' + id; el.dataset.hs = id;
        el.innerHTML = `<img src="${src('hs_' + id)}" alt=""><b></b>`;
        box.insertBefore(el, box.firstChild);
      }
      const D = ST[id], C = D.cure === 'g' ? CURES.g : CURES.p, have = (p[CURES.g.key] || 0) + (p[CURES.p.key] || 0);
      el.title = `${D.th}: ${D.what} · ต้านได้ ${Math.round(resOf(p, id))}%${D.hard ? '' : have ? ` · คลิกเพื่อใช้${C.name}` : ' · ซื้อยาแก้ได้ที่ลุงโกโก้'}`;
      el.querySelector('b').textContent = Math.ceil(p.hst[id].t);
      el.classList.remove('ending'); // (the buff row blinks its own buffs that run out; a status shows its seconds instead)
    }
  };
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest && ev.target.closest('.buff.hs');
    const g = G();
    if (!el || !g || !g.player) return;
    const id = el.dataset.hs, p = g.player;
    if (!ST[id] || ST[id].hard) return;
    if (live() && HS.remoteCure) { // (online: the server's stock and statuses, js/online/herostatus.js)
      const which = ST[id].cure === 'g' && p[CURES.g.key] > 0 ? 'g' : p[CURES.p.key] > 0 ? 'p' : '';
      if (!which || !HS.remoteCure(which)) g.toast && g.toast('ไม่มียาแก้ · ซื้อได้ที่ร้านลุงโกโก้');
      return;
    }
    if (!(ST[id].cure === 'g' && useCure(g, p, 'g', '')) && !useCure(g, p, 'p', '')) g.toast && g.toast('ไม่มียาแก้ · ซื้อได้ที่ร้านลุงโกโก้');
  });

  // ---------------- saving the cures ----------------
  (NC.saveHooks || (NC.saveHooks = [])).push((game) => {
    if (game.noSave || !game.player) return;
    try { localStorage.setItem(KEY, JSON.stringify({ g: game.player.cureG || 0, p: game.player.cureP || 0 })); } catch (e) { /* storage blocked */ }
  });
  (NC.loadHooks || (NC.loadHooks = [])).push((game, prm) => {
    const p = game.player;
    p.hst = {}; p.hstImm = {};
    let s = null;
    if (!NC.ONLINE) try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    p.cureG = s ? Math.max(0, s.g | 0) : 0; p.cureP = s ? Math.max(0, s.p | 0) : 0;
  });

  const css = document.createElement('style');
  css.textContent = '#buffs .buff.hs{cursor:pointer}#buffs .buff.hs img{border-radius:50%}';
  document.head.appendChild(css);

  const HS = (NC.HS = { ST, IDS, CURES, apply, cure, end, has, hard, noSkill, resOf, useCure, statusOfMon, remoteCure: null });
})();
