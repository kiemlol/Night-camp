/* rotiming.js — classic MMOs' skill timing (the user, 2026-10-02: "อยากให้สกิลเกมเราคล้ายๆ MMO คลาสสิก ... บางอันคูลดาวน์นานเกินไป
   ตัวตีธรรมดาได้เปรียบมากกว่า"). Their picks: the F skills become big spells like a classic MMO's meteor spell (5–8 s cooldown,
   a long cast, much less damage a cast); a global after-cast delay that gear and cards cut; SP as in classic MMOs (casters drink
   blue potions or sit). The game's timing since 2026-10-03 (the user: "เปิดเลย เราใช้สูตรใหม่แล้ว").
   Each skill's class comes from tools/skillprobe.js (one cast at a clump of dummies, measured):
     s  single target   cooldown none
     a  area at once    cooldown none (an old cooldown up to 4 s), 1 s (up to 8 s), 2 s (longer)
     z  zone that keeps burning   cooldown about as long as it burns (LIFE), so it never stacks much
     d  dash            cooldown half the old one, 3 s at least    m  summon   10 s at most
     h  heal            cooldown none                  u  utility / debuff   6 s at most
     B  big spell (F)   cooldown 6 / 7 / 8 s (was up to 45 / 60 / more); a spell's cast at least 3.5 s (80% DEX / 150,
                        20% fixed: casting.js)
     buffs              up all the time when they last as long as their cooldown (cooldown 1 s), else 30 s at most
   After-cast delay (ดีเลย์หลังร่าย): once a skill goes off no skill can be used for a while (classic MMOs' cast delay, global):
   spells 0.6 s (single) / 0.8 s (area) / 1 s (zone, summon) / 1.2 s (big); physical skills by the attack speed, like
   classic MMOs' attack motion (0.7 s or 0.9 s ÷ the ASPD multiplier: AGI builds chain them faster); dash 0.4 s, heal 0.8 s,
   buff and utility 0.5 s. Cut by gear: the old cdr (ลดคูลดาวน์) cuts the delay too, and the new option row acd
   (ลดดีเลย์หลังร่าย 3–8%), 50% at most. The hotbar shows the delay on every slot (NC.skillCd includes it).
   Damage a cast: DMG (per skill, tuned with tools/balance.js so the builds keep their targets). SP: the spammed skills
   (single, area, dash) cost 25% less, INT gives +0.5% SP regen a point. A basic swing hits one in full, the others
   50% (60% for a combo's shaped blow): NC.RO_SPLASH, entities.js. Basic hits: x1.05, and while the hero only swings
   (no attack skill for 3 s) the worn weapon's refine, option rows and ✦ on top (NC.carryOf: up to about +70%). */
(function () {
  'use strict';
  const NC = window.NC, SK = NC.SKILLS;
  NC.RO_TIME = true;
  if (!SK || !NC.skillCasts) return;

  // ---------------- the classes (tools/skillprobe.js, 2026-10-02) ----------------
  const LIST = {
    s: 'ar_multishot as_knives as_twin bd_lash bd_twirl bi_turnundead bk_crosscut bk_guillotine dk_spiral double fireball gs_kick gs_triple kn_pierce mo_combo mo_impact pal_shieldchain pp_stretch rp_hook sh_katon sm_iai sm_wave wh_command wh_fang wl_soulfire',
    a: 'am_chain ar_snare as_grimtooth as_meteor bash bd_note bd_noterain bi_lexdivina bk_hurl bk_smash bk_whirlwind dk_breath dk_thrust envenom frostdiver gale gs_buckshot gs_ricochet gs_smoke holylight im_breath im_burst im_lance kn_bowling lk_flash lk_swing magnum mg_frostnova mo_chi mo_palms pal_cross pal_strike pp_bind pp_dance q r rg_detonate rg_freezetrap rg_piercer rg_snipe rg_trap rg_triple rp_execute rp_ghost rp_return rp_sweep sh_clone sh_fan sh_huuma sh_kunai sh_raiton sh_ricochet shower sm_bladerain thunder wh_blitz wl_chains wl_hex ws_rush',
    d: 'bk_leap dk_charge dk_leap e mo_snap ro_backstab sh_windblade shadowstep',
    z: 'am_lordthunder am_orbs am_recall as_splasher bi_sanctuary fm_pillar fm_ring fm_sea im_blizzard lk_flare lk_lamp lk_plant mg_firewall sm_float venomdust wl_soulburn wl_wisps',
    m: 'dk_wyvern wh_wolf wl_lantern',
    h: 'bi_heal pal_layhands pr_heal ws_burst ws_latch',
    u: 'ar_charge bk_roar fm_vent gs_special gs_spin im_wall kn_provoke mo_spheres pp_control pp_swap pr_resurrect ro_steal sh_smoke sm_duel wh_mark ws_embrace ws_mark',
    B: 'am_trinity as_deathmark b_blades b_fall b_hellfire b_plague b_quake b_ritual bd_festival bi_miracle dk_roar fm_meteor gs_stars im_iceage judgment lk_dawn magnus meteor mo_asura pal_heaven pp_theatre rg_storm rp_storm sh_shuriken sm_thousand sonic starfall starshot wh_pack wl_parade ws_night',
  };
  const CLASS = {};
  for (const c in LIST) for (const id of LIST[c].split(' ')) CLASS[id] = c;
  // a basic swing that hits several (entities.js weaponHit): the nearest takes it all, the others this much of it
  // (a plain swing, a combo's shaped blow). As in classic MMOs, the area work belongs to the skills (the user, 2026-10-02: ok)
  NC.RO_SPLASH = [0.5, 0.6]; // (35% / 50% at first: the melee basic builds farmed at half their pace, 2026-10-02)
  // cooldowns set by hand (the rules gave too little): the ice mage's two main areas farmed packs at twice anyone's pace
  // (and its burst, which smashes every frozen one at once, wiped frozen packs every 2 s)
  const CD_OVER = { im_lance: 2, im_breath: 2, im_burst: 6 };
  // the skills spammed most cost this much SP (classic MMOs' are moderate; the regen below is INT's) ...
  const SP_K = 0.75;
  // how long a zone burns (s): its cooldown
  const LIFE = { venomdust: 6.5, mg_firewall: 6.8, wl_wisps: 6.6, wl_soulburn: 5.5, as_splasher: 5.5, bi_sanctuary: 6.5, am_lordthunder: 3,
    fm_pillar: 7.2, fm_sea: 6.5, fm_ring: 7.7, im_blizzard: 4, am_orbs: 5, am_recall: 3, lk_plant: 7.5, lk_lamp: 7.5, lk_flare: 7.5, sm_float: 5 };
  // the damage of a cast (x the skill's own): tuned with tools/balance.js, 8 steps over the 78 builds, so each build
  // keeps its old single-target DPS (2026-10-02: 73 of 78 within ±20%; README "เวลาสกิลแบบ MMO คลาสสิก"). The ids of passive procs
  // and buffs' hits are here too (the harness tells damage by the skill that made it)
  const DMG = {
    am_arcaneflux: 1.04, am_chain: 2.5, am_orbs: 2.41, am_trinity: 0.18, am_weave: 2.5, ar_charge: 1.64,
    ar_multishot: 1.4, as_deathmark: 0.21, as_grimtooth: 1.07, as_knives: 0.54, as_meteor: 1.41, as_splasher: 0.72,
    b_blades: 0.27, b_fall: 0.27, b_hellfire: 0.27, b_plague: 0.27, b_quake: 0.27, b_ritual: 0.27, bash: 0.95,
    bd_festival: 0.18, bd_lash: 0.76, bd_note: 0.91, bd_noterain: 0.91, bi_miracle: 0.23, bi_sanctuary: 0.64,
    bk_bleed: 1.22, bk_guillotine: 0.81, bk_smash: 1.22, bk_titan: 1.26, dk_breath: 0.98, dk_charge: 0.96,
    dk_roar: 0.28, dk_spiral: 0.79, dk_tail: 0.37, dk_thrust: 0.62, dk_wyvern: 0.98, double: 1.16, envenom: 0.82,
    fireball: 0.67, fm_meteor: 0.23, fm_pillar: 1.18, fm_ring: 1.37, fm_sea: 1.18, fm_seek: 1.09, fm_vent: 1.09,
    frostdiver: 0.93, gale: 2.0, gs_rapid: 1.18, gs_stars: 0.23, gs_triple: 1.18, holylight: 0.78, im_blizzard: 0.66,
    im_breath: 2.5, im_burst: 0.85, im_iceage: 0.18, im_lance: 0.62, im_shatter: 1.03, judgment: 0.27,
    kn_bowling: 0.75, kn_cleave: 0.37, lk_dawn: 0.18, lk_plant: 1.05, lk_swing: 0.92, magnum: 0.35, magnus: 0.25,
    meteor: 0.28, mg_firewall: 2.03, mo_asura: 0.28, mo_chi: 0.79, mo_impact: 1.6, mo_palms: 0.72, pal_cross: 1.25,
    pal_faithblade: 0.62, pal_heaven: 0.34, pal_holyblade: 0.62, pal_strike: 0.6, pal_zeal: 0.53, pp_bind: 1.88,
    pp_dance: 0.72, pp_guide: 2.5, pp_puppet: 1.44, pp_stretch: 1.88, pp_theatre: 0.18, pr_duple: 0.79,
    rg_fearbreeze: 1.85, rg_piercer: 1.22, rg_storm: 0.4, rg_trap: 0.68, rg_triple: 2.15, ro_backstab: 1.21,
    rp_execute: 0.78, rp_ghost: 1.29, rp_hook: 1.29, rp_storm: 0.23, rp_sweep: 0.78, sh_clone: 0.62, sh_katon: 0.29,
    sh_kunai: 1.29, sh_shuriken: 0.29, sh_throwing: 2.38, sh_windblade: 1.02, shadowstep: 0.83, shower: 1.13,
    sm_bladerain: 1.21, sm_iai: 0.39, sm_mark: 1.2, sm_thousand: 0.27, sonic: 0.3, starfall: 0.3, starshot: 0.27,
    thunder: 0.96, venomdust: 0.42, wh_command: 0.49, wh_pack: 0.27, wh_wolf: 1.05, wl_hex: 0.52, wl_lantern: 0.84,
    wl_parade: 0.29, wl_soulburn: 2.5, wl_soulfire: 0.58, wl_wisps: 0.84, ws_call: 2.26, ws_mark: 2.26, ws_night: 0.18,
    ws_swarm: 1.07
  };
  // (fm_meteor stays 0.23 after its blasts grew to 160 with 2 of 8 rocks aimed, 2026-10-03: at 7 s both, the same Fire Mage
  // Lv 90 with a staff, 10 casts each in turn: one dummy 3.7k vs the Mage's Meteor 1.6k, a clump 13.5k vs 11.1k, spread out
  // 15.9k vs 14.1k, so it beats the 1st-job one everywhere; build 59's DPS +5% single / +3% packs, inside the ±20% band)
  NC.RO_DMG = DMG;

  // ---------------- each skill's new numbers ----------------
  const val = (f, lv) => (typeof f === 'function' ? f(lv) : f) || 0;
  const isMagic = (S) => S.type === 'magic' || S.type === 'heal' || S.type === 'debuff';
  const OLD = (NC.RO_OLD = {}); // id -> { cd, cast } before (for the tuning and the skill card)
  const ACD = {};               // id -> seconds, or 'p' / 'pa' (physical: by the attack speed)
  const CAST = NC.CAST_TIMES || {};
  for (const id in SK) {
    const S = SK[id];
    if (!S || !S.active || /^wp_/.test(id) || NC.kindOf(S) === 'passive') continue;
    const top = Math.min(10, S.max || 10), C = val(S.cd, top), cast0 = NC.castBase ? NC.castBase(id, top) : 0;
    OLD[id] = { cd: C, cast: cast0 };
    const kind = NC.kindOf(S), c = kind === 'buff' ? 'buff' : CLASS[id] || S.ro || (S.ult || S.boss ? 'B' : C >= 8 ? 'a' : 's');
    if (c === 'own') continue; // (a skill that keeps its own timing: S.ro = 'own', e.g. a dash with charges; S.ro also names a class for skills not in LIST)
    const magic = isMagic(S);
    let cd = C, acd = 0.5;
    if (c === 's') { cd = 0; acd = magic ? 0.6 : 'p'; }
    else if (c === 'a') { cd = C <= 4 ? 0 : C <= 8 ? 1 : 2; acd = magic ? 0.8 : 'pa'; }
    else if (c === 'z') { cd = Math.max(3, Math.min(8, LIFE[id] || S.roLife || 5)); acd = 1; }
    else if (c === 'd') { cd = Math.max(3, Math.min(C, C * 0.5)); acd = 0.4; }
    else if (c === 'm') { cd = Math.min(C, 10); acd = 1; }
    else if (c === 'h') { cd = 0; acd = 0.8; }
    else if (c === 'u') { cd = Math.min(C, 6); acd = 0.5; }
    else if (c === 'B') {
      cd = C <= 45 ? 6 : C <= 60 ? 7 : 8; acd = 1.2;
      if (magic && cast0 < 3.5) { if (S.castT !== undefined) S.castT = 3.5; else CAST[id] = 3.5; }
    } else if (c === 'buff') { const dur = val(S.dur, top); cd = dur >= C ? 1 : Math.min(C, 30); acd = 0.5; }
    if (CD_OVER[id] !== undefined) cd = CD_OVER[id];
    if (S.roCd !== undefined) cd = S.roCd; // (a cooldown the skill's own file sets)
    if (c === 's' || c === 'a' || c === 'd') { const sp0 = S.sp; S.sp = (lv) => Math.max(1, Math.round(val(sp0, lv) * SP_K)); }
    S.cd = cd;
    ACD[id] = acd;
    S.roClass = c;
  }

  // ... and INT brings SP back faster: +0.5% regen a point (INT 100: +50%). Added after every other mod, from the INT this
  // derive will have: base + gear + the mods' flat INT, as the Go server does (skills_mods.go). (It read p.d.int, the
  // last derive's, so the points just put into INT only counted from the next applyGear: 2026-10-18 status check)
  const baseMods = NC.skillMods;
  if (baseMods) NC.skillMods = function (p) {
    const m = baseMods.apply(this, arguments);
    if (p && p.kind === 'player' && p.skills) {
      const k = Math.round((((p.base && p.base.int) || 0) + ((p.stats && p.stats.int) || 0) + (m.int || 0)) * 0.5);
      if (k) m.spReg = (m.spReg || 0) + k;
    }
    return m;
  };

  // ---------------- the after-cast delay ----------------
  const cut = (p) => Math.min(0.5, ((p.d && p.d.cdr) || 0) + (((p.d && p.d.mods && p.d.mods.acd) || 0) / 100));
  const aspd = (p) => (p.d && p.d.aspdMul) || 1;
  NC.skillAcdOf = function (p, id) { // (seconds, after the gear's cut)
    const a = ACD[id];
    if (a === undefined) return 0;
    const raw = a === 'p' ? Math.max(0.25, Math.min(0.7, 0.7 / aspd(p))) : a === 'pa' ? Math.max(0.35, Math.min(0.9, 0.9 / aspd(p))) : a;
    return +(raw * (1 - cut(p))).toFixed(2);
  };
  NC.skillCasts.push((game, p, id) => {
    if (!game || p !== game.player) return;
    const a = NC.skillAcdOf(p, id);
    if (a > 0) { p.acdT = a; p.acdFull = a; }
  });
  // Presentation/input timing must keep advancing online. Job skillTicks are disabled by online/world.js
  // (and can be wrapped by visual themes), so keep this clock in the shared update path instead.
  const baseTick = NC.updateSkills;
  NC.updateSkills = function (game, dt) {
    const result = baseTick.apply(this, arguments), p = game && game.player;
    if (p && p.acdT > 0) p.acdT = Math.max(0, p.acdT - (dt || 1 / 60));
    return result;
  };
  // the hotbar, the casting checks and the auto farm read the cooldown through these: the delay counts as one
  const baseCd = NC.skillCd, baseFull = NC.skillCdFull;
  NC.skillCd = (p, id) => Math.max(baseCd(p, id), (p && p.acdT) || 0);
  NC.skillCdFull = (p, id) => ((p && p.acdT) > baseCd(p, id) ? p.acdFull || 1 : baseFull(p, id));
  const baseClear = NC.clearSkillCds;
  NC.clearSkillCds = (p) => { baseClear(p); if (p) p.acdT = 0; };

  // class 3's moon ring fills a bit with every powered-up cast (class3_core.js): as often as the skill can now go off
  // (cooldown against the old one), so the awakening comes about as often as before
  NC.RO_FILL = (id) => { const o = OLD[id], S = SK[id]; if (!o || !S) return 1; return Math.max(0.15, Math.min(1, Math.max(1, val(S.cd, 10)) / Math.max(1, o.cd))); };

  // ---------------- the damage of a cast ----------------
  // (class 3's extra effects — a pillar, a nova... once to three times a powered-up cast — come as often as the casts:
  // their hits, under the power-up's id, are scaled like the moon ring's fill)
  let c3base = null;
  const c3k = (sid) => {
    if (!NC.C3 || !NC.C3.boost) return 1;
    if (!c3base) { c3base = {}; for (const id in NC.C3.boost) c3base[NC.C3.boost[id]] = id; }
    return c3base[sid] ? NC.RO_FILL(c3base[sid]) : 1;
  };
  // ---------------- basic attacks: the carry ----------------
  // the user, 2026-10-02: "โจร หรือพวกสายตีปกติ จะให้อารมณ์ carry ตอน endgame ... ของต้องเยอะถึงจะโหด". Basic hits, and the
  // procs that come off them (BASIC_PROCS, the mage's autospell), do x1.05: the fillers they used to weave in are gone.
  // A hero who only swings — no attack skill (single, area, zone, big spell) for 3 s; buffs, heals, summons, dashes don't
  // count — adds the worn weapon's power (NC.carryOf): +3.5% a refine level, +2 / 4 / 7% a normal / good / god option
  // row, +7% for a ✦ copy: about +70% for a +10 weapon with four god rows. Skill builds never get it, so their tuned
  // balance stays; a basic build starts a little under them and ends well over (the catalog-weapon runs, README).
  const BASIC_K = 1.05, REF_K = 0.035, TIER_K = [0.02, 0.04, 0.07], SHINE_K = 0.07, PURE_T = 3;
  const BASIC_PROCS = new Set('kn_cleave pal_holyblade pal_faithblade dk_tail rg_fearbreeze gs_rapid pr_duple ws_call sh_throwing mo_triple wl_swing am_doublecast'.split(' '));
  const BREAKS = new Set(['s', 'a', 'z', 'B']);
  NC.RO_BREAKS = (id) => !!(SK[id] && BREAKS.has(SK[id].roClass)); // (does casting it end the swing-only streak; tools/balance.js keeps them off a basic build's bar)
  NC.carryOf = (c) => {
    if (!c) return 0;
    let k = (c.ref || 0) * REF_K + (c.sh ? SHINE_K : 0);
    for (const r of c.rows || []) k += TIER_K[r.tier] || 0;
    return k;
  };
  const wornWeapon = (p) => { const W = NC.GEAR || NC.WBAG; return W && W.worn ? W.worn(p) : null; };
  const now = () => (NC.game ? NC.game.time : 0);
  NC.swingOnly = (p) => !!p && !(p._roAtkT > now() - PURE_T);
  // a job's own basic-attack factor (measured with the builds played swing-only, default weapons, against the old
  // timing's damage: a basic build aims at 0.95 of it). The most specific job of the line wins (class 3 -> 2nd -> 1st)
  // (2026-10-02, 180 s fights, default weapons; the old figure is the mean of a 60 s and a 180 s run: the swing-only
  // monk and the autospell warlock hit far over, rogue and ranger over; the priests and the hunter under)
  const BASIC_JOB = { mage: 0.86, archmage: 0.85, warlock: 0.68, ranger: 0.68, wolfhunter: 1.11, rogue: 0.88, priest: 1.14, bishop: 1.09, monk: 0.82 }; // (monk: 0.75 hit the target but its farm fell to 0.6 of before)
  const jobK = (p) => {
    for (const j of NC.jobLine(p.job)) { if (BASIC_JOB[j] !== undefined) return BASIC_JOB[j]; if (!NC.JOBS[j] || NC.JOBS[j].tier < 3) break; }
    return 1; // (a class-3 job takes its 2nd job's; a 2nd job never its 1st job's)
  };
  NC.RO_BASIC_JOB = BASIC_JOB;
  NC.basicCarry = (p) => BASIC_K * jobK(p) * (1 + (NC.swingOnly(p) ? NC.carryOf(wornWeapon(p)) : 0));
  // a swing's other targets take NC.RO_SPLASH of the blow; swinging only, the weapon's carry widens that to 90% at a
  // full weapon (+10 ✦ four god rows): a geared basic build clears packs too (entities.js weaponHit)
  const FULL = 0.7;
  NC.roSplash = (p, shaped) => {
    const base = NC.RO_SPLASH[shaped ? 1 : 0];
    if (!p || !NC.swingOnly(p)) return base;
    return Math.min(0.9, base + (0.9 - base) * Math.min(1, NC.carryOf(wornWeapon(p)) / FULL));
  };
  NC.skillCasts.push((game, p, id) => { if (game && p === game.player && NC.RO_BREAKS(id)) p._roAtkT = game.time; });
  const baseHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    // (whose hit: checked before the call: a hook inside may derive the hero's stats again, a new p.d)
    const hero = NC.game && NC.game.player, mine = !!hero && d === hero.d;
    const r = baseHit.apply(this, arguments), sid = o && o.sid;
    let k = sid ? DMG[sid] || c3k(sid) : 1;
    if (mine && o && (sid ? BASIC_PROCS.has(sid) : !o.skill && (o.kind === 'phys' || o.kind === 'magic'))) {
      k *= NC.basicCarry(hero);
      if (!sid && r && r.dmg > 0 && ranged(hero)) r._shot = 1; // (a basic arrow / bolt: it may burst on the ones near, below)
    }
    if (k !== 1 && r && r.dmg > 0) { r.dmg = Math.max(1, Math.round(r.dmg * k)); r._rk = k; }
    return r;
  };
  // an arrow or a bolt hits one; swinging only, the weapon's carry makes it burst on the ones within 100 too, up to
  // 50% of the hit at a full weapon (the melee swing's others go up to 90%: a bow keeps its distance)
  const ranged = (p) => { const W = NC.weaponDef && NC.weaponDef(p); return !!W && (W.style === 'arrow' || W.style === 'bolt'); };
  NC.roShotSplash = (p) => (p && NC.swingOnly(p) ? 0.5 * Math.min(1, NC.carryOf(wornWeapon(p)) / FULL) : 0);
  // the mage's autospell (skills_v21.js castAt runs the spell on a game marked autoCast): a proc of the swing, so its
  // hits take the swing's factor instead of the cast spell's
  const baseDE = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r) {
    const hero = game && game.player;
    if (game && game.autoCast && hero && r && r.dmg > 0 && !r._auto) { r.dmg = Math.max(1, Math.round((r.dmg / (r._rk || 1)) * NC.basicCarry(hero))); r._auto = 1; }
    const out = baseDE.apply(this, arguments);
    if (r && r._shot && hero && e && !e.pvp && !game.autoCast) {
      r._shot = 0;
      const s = NC.roShotSplash(hero);
      if (s > 0) {
        let n = 0;
        for (const m of game.enemies) {
          if (m === e || m.dead || !(m.hp > 0) || m.pvp || /^chest_/.test(m.type || '') || NC.dist(m.x, m.y, e.x, e.y) > 100 + (m.r || 0)) continue;
          NC.damageEnemy(game, m, { dmg: Math.max(1, Math.round(r.dmg * s)), crit: false, mod: r.mod || 1 }, 0, 0, { color: '255,214,140' }); // (the whole chain: kills, books, PvP)
          n++;
        }
        if (n && NC.FX) NC.FX.ring(e.x, e.y - 40, 10, 100, '255,214,140', 0.3, 6);
      }
    }
    return out;
  };
  // the bag's item card: what the best copy gives a swing-only hero
  if (NC.invCardExtras) NC.invCardExtras.push((p, id) => {
    const it = NC.ITEMS[id], W = NC.GEAR || NC.WBAG;
    if (!it || it.slot !== 'weapon' || !W || !W.copies) return '';
    const best = W.copies(p, id).reduce((a, c) => (!a || NC.carryOf(c) > NC.carryOf(a) ? c : a), null);
    if (!best) return '';
    const c = NC.carryOf(best), f = Math.min(1, c / FULL), st = it.style;
    const area = st === 'arrow' || st === 'bolt' ? ` · ยิงโดนแล้วแตกใส่ตัวใกล้ ${Math.round(50 * f)}%` : st === 'throw' ? '' : ` · ฟันโดนตัวรอง ${Math.round((0.5 + 0.4 * f) * 100)}%`;
    const top = st === 'arrow' || st === 'bolt' ? 'แตก 50%' : st === 'throw' ? '' : 'ตัวรอง 90%';
    return `<div class="gb-abil" style="color:#ffd27a">สายตีปกติ: ตีล้วน (ไม่ใช้สกิลโจมตี 3 วิ) ตีปกติแรงขึ้น +${Math.round((BASIC_K * (1 + c) - 1) * 100)}%${area}` +
      `<br><span style="opacity:.75">โตตามตีบวก +3.5%/ขั้น · ออป +2/4/7% · ✦ +7% (เต็มที่ +79%${top ? ' ' + top : ''})</span></div>`;
  });
  // the HUD: a chip in the buff row while the swing-only bonus is on (the weapon's picture and its +%)
  if (NC.HUD && NC.HUD.renderBuffs) {
    const baseRB = NC.HUD.renderBuffs;
    NC.HUD.renderBuffs = function (p) {
      baseRB.apply(this, arguments);
      const box = document.getElementById('buffs');
      if (!box || !p) return;
      const c = wornWeapon(p), k = c && NC.swingOnly(p) ? NC.carryOf(c) : 0;
      let el = box.querySelector('.ro-carry');
      if (!(k > 0)) { if (el) el.remove(); return; }
      if (!el || el.dataset.id !== c.id) {
        if (el) el.remove();
        const it = NC.ITEMS[c.id], m = it && NC.ASSET_MANIFEST[it.icon || it.sprite];
        el = document.createElement('div');
        el.className = 'buff ro-carry'; el.dataset.id = c.id; el.title = 'ตีล้วน: ตีปกติแรงขึ้นตามอาวุธ';
        el.innerHTML = `<img src="${m ? m.src : ''}" alt=""><b></b>`;
        box.appendChild(el);
      }
      el.classList.remove('ending'); // (skillui.js's loop reads it as a buff with no time left)
      el.querySelector('b').textContent = '+' + Math.round((BASIC_K * (1 + k) - 1) * 100) + '%';
    };
  }

  // ---------------- gear: the option row "ลดดีเลย์หลังร่าย" ----------------
  const W = NC.GEAR || NC.WBAG;
  if (W && W.OPT && !W.OPT.acd) {
    W.OPT.acd = { th: 'ลดดีเลย์', tiers: [[3, 4], [5, 6], [7, 8]], text: (r) => `ดีเลย์หลังร่าย −${r.v}%` };
    const baseRows = W.rowEffects;
    W.rowEffects = function (p) {
      const out = baseRows.apply(this, arguments) || [];
      const c = W.worn && W.worn(p), extra = c && c.rows ? c.rows.filter((r) => r.k === 'acd').map((r) => ({ t: 'mods', acd: r.v })) : [];
      return extra.length ? out.filter((x) => !(x.t === 'vsEl' && x.els && x.els[0] === undefined)).concat(extra) : out;
    };
  }
})();
