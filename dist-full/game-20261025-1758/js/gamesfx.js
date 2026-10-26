/* gamesfx.js — the rest of the ElevenLabs sound set in the game (2026-10-19; the user: "สร้างเสียงกลุ่มที่เหลือต่อเลย" and
   then "เอาตามที่คุณเลือกเลย ไม่ต้องรอผมฟัง"). js/hitsfx.js loads and plays the takes (NC.HitSfx.play) and does the
   swings and hits; this file hooks every other moment, the hero's own only (other players' replays stay silent):
     skills    a cast bar or a charge (p.casting / p.channel) holds a charge loop (chg_<element>, chg_ki for weapon
               skills, chg_bow for bows; an ultimate's bar plays the rise instead), the release (NC.skillCasts) the cast
               burst (cast_<element>; weapon skills: the weapon's swing + the element's burst), a projectile
               (NC.SkillKit.shot) a short travel loop, a ground zone / rain (SkillKit.zone / rain) its ground loop for
               as long as it lasts; ultimates drop with ult_boom / slash / wave / shatter + sub_ult + the element's tail
     elements  NC.heroHit marks each hit with the element it used (r.sfxElem) so hitsfx.js adds the element's tail
     buffs     a buff skill: buff_up, a guard / shield skill buff_shield, a heal heal (SkillKit.heal on the hero too)
     monsters  a monster's blow at the hero (NC.monsterHit): claw / bite / spit by the monster; a dodge; the hero hurt
               (NC.hurtPlayer: lower HP) or a blow stopped by a guard (same HP): parry
     bosses    (NC.updateEnemy, and online the mirrored state): waking up = roar, a new wind-up = warning, a slam
               landing = slam, the rage under half HP (or Baphomet's change) = enrage; by distance to the hero
     statuses  stun / freeze / the rest (st_curse) landing on the hero (p.hst) or put on a monster by the hero
     life      level up (base or job), loot picked up, coins in, a potion drunk
   Online (js/online/world.js): the server's hits on the hero, picked-up loot and the hero's level come through
   NC.OnlineWorld's eventHooks / selfHooks. ?hitsfx=0 turns this file off with hitsfx.js. */
(function () {
  'use strict';
  const NC = window.NC, L = NC.SFXL, HS = NC.HitSfx;
  if (!L || !HS || !HS.play) return;
  const SK = () => NC.SKILLS || {};
  const gameOf = () => NC.game || (window.__nc && window.__nc.game) || null;
  const tOf = (game) => (game && game.time) || 0;
  const gates = {};
  const gate = (k, t, gap) => { if (gates[k] != null && t - gates[k] < gap && t >= gates[k]) return false; gates[k] = t; return true; };
  const E = (id, t, gain, more) => Object.assign({ id, t: t || 0, gain: gain == null ? 1 : gain, rate: 0.96 + Math.random() * 0.08 }, more || {});
  const mine = (game, p) => !!(game && p && p === game.player && !p.remote);
  const panAt = (game, x) => { const p = game && game.player; return p && x != null ? Math.max(-0.6, Math.min(0.6, (x - p.x) / 600)) : 0; };
  // loudness by distance to the hero: full inside 500 px, nothing past `far`
  const near = (game, x, y, far) => {
    const p = game && game.player;
    if (!p || x == null) return 1;
    const d = Math.hypot(x - p.x, (y == null ? p.y : y) - p.y), f = far || 1500;
    return d <= 500 ? 1 : d >= f ? 0 : 1 - (d - 500) / (f - 500);
  };
  const at = (game, x, y, evts, far) => { const k = near(game, x, y, far); if (k > 0.03) HS.play(evts, panAt(game, x), { vol: k }); };

  // ---------------- the skill's sound: its element, physical or magic, bow ----------------
  const isBow = (p) => { const t = HS.wtype(p); return t === 'bow' || t === 'xbow'; };
  function physOf(p, S) {
    if (S.type === 'phys') return true;
    if (S.type === 'best') { const d = p.d || {}; return (d.atk || 0) >= (d.matk || 0) && !(L.W[HS.wtype(p)] || {}).magic; }
    return false;
  }
  function elemOf(p, S, id) {
    let el = S.element;
    if (!el) el = p.buffs && p.buffs.fireblade > 0 ? 'fire' : p.d && p.d.atkElement;
    if (!el || el === 'neutral') return physOf(p, S) ? null : 'arcane';
    return L.elemKey(el, id + ' ' + (S.name || ''), !physOf(p, S)) || null;
  }
  const ULT = { fire: 'ult_boom', earth: 'ult_boom', shadow: 'ult_boom', blood: 'ult_boom', poison: 'ult_boom', undead: 'ult_boom',
    ice: 'ult_shatter', thunder: 'ult_shatter', arcane: 'ult_shatter', holy: 'ult_wave', wind: 'ult_wave', water: 'ult_wave', ghost: 'ult_wave' };
  const SHIELD_RX = /guard|shield|barrier|aegis|dome|ward|bulwark|โล่|บาเรีย|ปราการ|กำแพง|เกราะ/i;
  function shieldy(S, id, lv) {
    if (SHIELD_RX.test(id + ' ' + (S.name || ''))) return true;
    try { const b = S.buff && S.buff(lv); return !!(b && b.taken > 0); } catch (e) { return false; }
  }

  // the release (after any cast bar): one call per skill that went off
  if (Array.isArray(NC.skillCasts)) NC.skillCasts.push(function (game, p, id, lv) {
    if (!mine(game, p)) return;
    const S = SK()[id];
    if (!S) return;
    const t = tOf(game);
    HS.lastSkill = { id, t };
    const kind = NC.kindOf ? NC.kindOf(S) : S.buff ? 'buff' : 'active';
    const k = elemOf(p, S, id), phys = physOf(p, S), evts = [];
    if (S.ult) {
      const drop = phys ? 'ult_slash' : ULT[k] || 'ult_boom';
      evts.push(E(drop, 0, 1), E('sub_ult', 0, 0.9));
      if (drop !== 'ult_wave') evts.push(E('ult_wave', 0.08, 0.55));
      if (k) evts.push(E('tail_' + k, 0.05, 0.8));
    } else if (kind === 'buff' || S.type === 'buff') {
      evts.push(E(S.heal ? 'heal' : shieldy(S, id, lv) ? 'buff_shield' : 'buff_up', 0, 0.85));
    } else if (phys) {
      for (const e of L.swing({ wtype: HS.wtype(p) })) evts.push(Object.assign(e, { gain: e.gain * 1.3 }));
      if (k) { const c = L.phase('cast', k); if (c) evts.push(E(c, 0, 0.55)); }
    } else {
      const c = L.phase('cast', k || 'arcane');
      if (c) evts.push(E(c, 0, 0.9));
    }
    if (S.heal && kind !== 'buff' && gate('heal', t, 0.4)) evts.push(E('heal', 0.05, 0.7));
    // a lingering skill (js/dmgbeats.js marks zones, storms and orbs 'tick'): its ground loop while it lasts
    if (!S.ult && NC.DMG_BEATS && NC.DMG_BEATS[id] === 'tick' && gate('zone:' + id, t, 0.5)) {
      let dur = 3;
      try { if (typeof S.dur === 'function') dur = +S.dur(lv) || 3; } catch (e) { /* (keep 3 s) */ }
      const z = L.phase('zone', k || 'arcane');
      if (z) evts.push(E(z, 0.25, 0.4, { loop: true, len: Math.min(6, Math.max(1, dur)) }));
    }
    HS.play(evts, 0);
  });
  // the first-job skills' projectiles (skills.js proj(): an FX 'vproj' without the skill id). The skill's code makes it
  // just BEFORE NC.skillCasts runs, so a vproj made in the same frame is matched at the release; one made later (a
  // delayed volley) within 0.3 s of the release is matched here
  let projAt = -1, projLife = 0.6;
  function flyFor(game, id, life) {
    const p = game.player, S = SK()[id] || {}, k = elemOf(p, S, id);
    const f = isBow(p) ? 'fly_arrow' : L.phase('fly', k || 'arcane');
    if (f && gate('fly', tOf(game), 0.12)) HS.play([E(f, 0.02, 0.45, { loop: true, len: Math.min(1.2, Math.max(0.35, +life || 0.6)) })], 0);
  }
  if (Array.isArray(NC.skillCasts)) NC.skillCasts.push(function (game, p, id) {
    if (mine(game, p) && projAt === tOf(game)) flyFor(game, id, projLife);
  });
  if (NC.FX && NC.FX.add) {
    const baseAdd = NC.FX.add;
    NC.FX.add = function (o) {
      const res = baseAdd.apply(this, arguments);
      if (o && o.type === 'vproj') {
        const game = gameOf(), t = tOf(game), ls = HS.lastSkill;
        projAt = t; projLife = o.life;
        if (ls && t > ls.t && t - ls.t < 0.3) flyFor(game, ls.id, o.life);
      }
      return res;
    };
  }

  // a projectile flying and a zone on the ground (NC.SkillKit, called through the object)
  const K = NC.SkillKit;
  if (K) {
    if (K.shot) {
      const baseShot = K.shot;
      K.shot = function (game, p, id, o) {
        const res = baseShot.apply(this, arguments);
        if (mine(game, p) && gate('fly', tOf(game), 0.12)) {
          const S = SK()[id] || {}, k = elemOf(p, S, id || '');
          const f = isBow(p) ? 'fly_arrow' : HS.wtype(p) === 'huuma' ? 'fly_blade' : physOf(p, S) && !k ? 'fly_blade' : L.phase('fly', k || 'arcane');
          if (f) HS.play([E(f, 0.03, 0.45, { loop: true, len: 0.55 })], 0);
        }
        return res;
      };
    }
    const ground = (name, durAt) => {
      const base = K[name];
      if (!base) return;
      K[name] = function (game, p, id) {
        const res = base.apply(this, arguments);
        if (mine(game, p) && gate('zone:' + id, tOf(game), 0.5)) {
          const S = SK()[id] || {}, z = L.phase('zone', elemOf(p, S, id || '') || 'arcane'), dur = +arguments[durAt] || 2;
          if (z) HS.play([E(z, 0.1, 0.4, { loop: true, len: Math.min(6, Math.max(0.8, dur)) })], 0);
        }
        return res;
      };
    };
    ground('zone', 6);   // zone(game, p, id, x, y, r, dur, every, o)
    ground('rain', 7);   // rain(game, p, id, x, y, R, n, dur, o)
    if (K.heal) {
      const baseHeal = K.heal;
      K.heal = function (game, who, amount) {
        const got = baseHeal.apply(this, arguments);
        if (game && who === game.player && (got || amount) > 0 && gate('heal', tOf(game), 0.4)) HS.play([E('heal', 0, 0.6)], 0);
        return got;
      };
    }
  }

  // the element each hit used (the skill's, or the weapon's: stats.js uses o.element || d.atkElement)
  if (NC.heroHit) {
    const baseHit = NC.heroHit;
    NC.heroHit = function (d, e, o) {
      const r = baseHit.apply(this, arguments);
      if (r && typeof r === 'object') r.sfxElem = (o && o.element) || (d && d.atkElement) || null;
      return r;
    };
  }

  // ---------------- a monster's blow at the hero ----------------
  const MA_SPIT = /spit|archer|shooter|spore|caster|witch|imp|shaman|mage|puffer|sprite|wisp|lantern|bell|book|toad|frog/;
  function maOf(m) {
    const M = (NC.MONSTERS && NC.MONSTERS[m.type]) || {};
    if (M.sfxAttack) return M.sfxAttack;
    const mat = HS.matOf(m), v = HS.voiceOf(m);
    if (M.ranged || M.shoot || MA_SPIT.test(m.type || '') || mat === 'goo' || mat === 'plant') return 'ma_spit';
    if (v === 'mv_beast' || v === 'mv_critter' || v === 'mv_undead' || v === 'mv_bird') return 'ma_bite';
    return 'ma_claw';
  }
  if (NC.monsterHit) {
    const baseMH = NC.monsterHit;
    NC.monsterHit = function (m, d) {
      const r = baseMH.apply(this, arguments);
      const game = gameOf(), p = game && game.player;
      if (p && d === p.d && m && r) {
        const t = tOf(game);
        if (gate('ma', t, 0.09)) at(game, m.x, m.y, [E(maOf(m), 0, 0.7)]);
        if (r.miss && gate('dodge', t, 0.15)) HS.play([E('dodge', 0.02, r.lucky ? 0.8 : 0.55)], panAt(game, m.x));
      }
      return r;
    };
  }
  if (NC.hurtPlayer) {
    const baseHurt = NC.hurtPlayer;
    NC.hurtPlayer = function (game, dmg, fromX) {
      const p = game && game.player;
      const hp0 = p && p.hp, inv0 = p && p.inv, dead0 = p && p.dead, sa0 = p && p.saCounter;
      const res = baseHurt.apply(this, arguments);
      if (p && dmg > 0 && dead0 <= 0) {
        const t = tOf(game);
        if (p.hp < hp0) { if (gate('hurt', t, 0.2)) HS.play([E('hurt', 0.01, 0.8)], panAt(game, fromX)); }
        else if (!(inv0 > 0) && (p.hp === hp0 || (sa0 && !p.saCounter)) && gate('parry', t, 0.15)) HS.play([E('parry', 0, 0.85)], panAt(game, fromX));
      }
      return res;
    };
  }

  // ---------------- bosses: roar, warning, slam, rage ----------------
  const SLAMS = { slam: 1, quake: 1, stomp: 1, smash: 1 };
  function bossCheck(game, e) {
    if (!e || !HS.isBoss(e) || e.hp <= 0) return;
    const was = e._sfxB || { s: null, d: false, r: !!e.raged, a: false }, s = e.state, now = { s, d: !!e.done, r: !!e.raged, a: !!e.awake };
    e._sfxB = now;                        // (a boss that is already awake the first time it is seen roars once)
    const t = tOf(game), id = e.id || e.type;
    if ((!was.a && now.a) || (s === 'roar' && was.s !== 'roar')) { if (gate('roar:' + id, t, 4)) at(game, e.x, e.y, [E('boss_roar', 0, 1)], 2200); }
    else if (s !== was.s && e.wind > 0 && gate('warn:' + id, t, 0.8)) at(game, e.x, e.y, [E('boss_warn', 0, 0.85)], 1900);
    if (SLAMS[was.s] && !was.d && (s !== was.s || now.d) && gate('slam:' + id, t, 0.5)) at(game, e.x, e.y, [E('boss_slam', 0, 1)], 2000);
    if ((!was.r && now.r) || (s === 'change' && was.s !== 'change')) { if (gate('rage:' + id, t, 3)) at(game, e.x, e.y, [E('boss_enrage', 0, 1)], 2400); }
  }
  if (NC.updateEnemy) {
    const baseUE = NC.updateEnemy;
    NC.updateEnemy = function (game, e) {
      const res = baseUE.apply(this, arguments);
      if (e && e._sfxB !== false) { if (HS.isBoss(e)) bossCheck(game, e); else e._sfxB = false; }
      return res;
    };
  }

  // ---------------- statuses ----------------
  const ST = { stun: 'st_stun', sleep: 'st_stun', freeze: 'st_freeze' };
  function heroStatus(game, p) {
    const h = p.hst;
    if (!h) return;
    const seen = (p._sfxSt = p._sfxSt || {});
    for (const k in h) {
      const s = h[k], a = s && s.at;
      if (seen[k] === a) continue;
      seen[k] = a;
      if (gate('hst', tOf(game), 0.2)) HS.play([E(ST[k] || 'st_curse', 0, ST[k] ? 0.75 : 0.55)], 0);
    }
    for (const k in seen) if (!h[k]) delete seen[k];
  }
  if (NC.statusEnemy) {
    const baseSE = NC.statusEnemy;
    NC.statusEnemy = function (game, e, kind) {
      const had = e && (kind === 'stun' ? e.stun > 0 : kind === 'freeze' ? e.frozen > 0 : true);
      const res = baseSE.apply(this, arguments);
      if (e && !had && ST[kind] && gate('mst', tOf(game), 0.25)) at(game, e.x, e.y, [E(ST[kind], 0, 0.55)], 1300);
      return res;
    };
  }
  if (NC.addStatus) {
    const baseAS = NC.addStatus;
    NC.addStatus = function (game, e, k) {
      const had = e && e.st && e.st[k];
      const res = baseAS.apply(this, arguments);
      if (e && k === 'curse' && !had && gate('mst', tOf(game), 0.25)) at(game, e.x, e.y, [E('st_curse', 0, 0.55)], 1300);
      return res;
    };
  }

  // ---------------- life: level up, loot, coins, potions ----------------
  let lvSeen = null;
  const levelUp = (game) => { if (gate('lvup', tOf(game), 1)) HS.play([E('levelup', 0, 1, { rate: 1 })], 0); };
  if (NC.gainXp) {
    const baseXp = NC.gainXp;
    NC.gainXp = function (game) {
      const p = game && game.player, l0 = p && p.lv, j0 = p && p.jobLv;
      const res = baseXp.apply(this, arguments);
      if (p && (p.lv > l0 || p.jobLv > j0)) levelUp(game);
      return res;
    };
  }
  if (NC.updateLoot) {
    const baseLoot = NC.updateLoot;
    NC.updateLoot = function (game) {
      const before = game && Array.isArray(game.loot) ? game.loot.slice() : null;
      const res = baseLoot.apply(this, arguments);
      if (before && before.length) {
        const left = new Set(game.loot);
        let got = 0;
        for (const l of before) if (!left.has(l) && l.done && !l.online && !l._to) got++;
        if (got && gate('pickup', tOf(game), 0.07)) HS.play([E('pickup', 0, 0.7)], 0);
      }
      return res;
    };
  }
  const potion = (game) => { if (gate('potion', tOf(game), 0.15)) HS.play([E('potion', 0, 0.75)], 0); };
  if (NC.drinkPotion) {
    const baseDP = NC.drinkPotion;
    NC.drinkPotion = function (game) { const ok = baseDP.apply(this, arguments); if (ok) potion(game); return ok; };
  }
  if (NC.POT && NC.POT.drink) {
    const basePD = NC.POT.drink;
    NC.POT.drink = function (game) { const q = basePD.apply(this, arguments); if (q) potion(game); return q; };
  }

  // ---------------- every frame of the hero: the cast bar / charge loop, statuses, coins ----------------
  let castNow = null, castH = null, chanNow = null, chanH = null, coins = null;
  const baseUpd = NC.updatePlayer;
  NC.updatePlayer = function (game) {
    const res = baseUpd.apply(this, arguments);
    const p = game && game.player;
    if (!p) return res;
    // a cast bar: a held charge loop (an ultimate's bar: the rise, once)
    const c = p.casting && !p.casting.remote ? p.casting : null;
    if (c !== castNow) {
      if (castH) { castH.stop(); castH = null; }
      castNow = c;
      const S = c && SK()[c.id];
      if (S) {
        if (S.ult || c.big) HS.play([E('ult_rise', 0, 0.85, { rate: 1 })], 0);
        else {
          const k = elemOf(p, S, c.id), id = isBow(p) ? 'chg_bow' : physOf(p, S) ? 'chg_ki' : L.phase('chg', k || 'arcane');
          if (id) castH = HS.play([E(id, 0, 0.6, { loop: true, hold: true })], 0) || null;
        }
      }
    }
    // a skill's charge or channel without a bar (not gathering / fishing)
    const ch = p.channel && !p.channel.cast && !p.channel.life && !p.channel.fish ? p.channel : null;
    if (ch !== chanNow) {
      if (chanH) { chanH.stop(); chanH = null; }
      chanNow = ch;
      const ls = HS.lastSkill, S = ch && ls && tOf(game) - ls.t < 0.5 ? SK()[ls.id] : null;
      if (S) {
        const k = elemOf(p, S, ls.id), id = isBow(p) ? 'chg_bow' : physOf(p, S) ? 'chg_ki' : L.phase('chg', k || 'arcane');
        if (id) chanH = HS.play([E(id, 0, 0.5, { loop: true, hold: true })], 0) || null;
      }
    }
    if (p.dead > 0 && (castH || chanH)) { if (castH) castH.stop(); if (chanH) chanH.stop(); castH = chanH = null; }
    heroStatus(game, p);
    if (typeof p.coins === 'number') {
      if (coins != null && p.coins > coins && gate('coin', tOf(game), 0.12)) HS.play([E('coin', 0, 0.7)], 0);
      coins = p.coins;
    }
    if (lvSeen === null) lvSeen = { lv: p.lv, job: p.jobLv };
    return res;
  };

  // ---------------- online: the server's events ----------------
  const W = NC.OnlineWorld;
  if (W) {
    if (Array.isArray(W.eventHooks)) W.eventHooks.push(function (ev) {
      const game = W.game || gameOf(), p = game && game.player;
      if (!ev || !p) return;
      const t = tOf(game);
      if (ev.type === 'combat' && ev.targetId != null && ev.targetId === W.me && !ev.pvp) {
        const m = W.mirrors && W.mirrors.get(ev.sourceId);
        if (m && gate('ma', t, 0.09)) at(game, m.x, m.y, [E(maOf(m), 0, 0.7)]);
        if (ev.miss) { if (gate('dodge', t, 0.15)) HS.play([E('dodge', 0.02, ev.lucky ? 0.8 : 0.55)], m ? panAt(game, m.x) : 0); }
        else if (ev.damage > 0 && gate('hurt', t, 0.2)) HS.play([E('hurt', 0.01, 0.8)], m ? panAt(game, m.x) : 0);
      } else if (ev.type === 'lootPickup' && gate('pickup', t, 0.07)) HS.play([E('pickup', 0, 0.7)], 0);
    });
    if (Array.isArray(W.selfHooks)) W.selfHooks.push(function (s, first) {
      const game = W.game || gameOf();
      if (!s) return;
      if (!first && lvSeen && ((s.lv || 0) > (lvSeen.lv || 0) || (s.jobLv || 0) > (lvSeen.job || 0))) levelUp(game);
      lvSeen = { lv: s.lv, job: s.jobLv };
    });
    if (Array.isArray(W.monsterHooks)) W.monsterHooks.push(function (e, m, game) { if (e && HS.isBoss(e)) bossCheck(game, e); });
  }
})();
