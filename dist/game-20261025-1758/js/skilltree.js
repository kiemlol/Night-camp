/* skilltree.js — the skill trees and the 8-slot hotbar the user asked for (2026-09-27):
   - every job has 10 skills of its own (actives, buffs, passives) besides the three shared passives; a 2nd job keeps
     its 1st job's skills (the classic MMO way) and its skill points can go into both sets (it starts with the 1st job's 49)
   - some skills need others first (S.req: [[skill, level], ...]); a skill's starting level is S.free (else: actives 1)
   - any learned active or buff can go on any of the 8 hotbar slots (Q E R F 3 4 5 6); p.hotbar, saved with the game
   - cooldowns belong to the skill (p.cd['@' + id]), so moving a skill to another slot keeps its cooldown
   - passives (S.pass(lv, p)) and running buffs (S.buff(lv, p)) change the hero's numbers through NC.derive; the marks
     skills leave on monsters (vulnerable, weak) and the hero's own protections are applied to the hits here
   Replaces stats.js's jobSkills / newSkills / freeSkillLv / skillLeft / raiseSkill / canChangeJob / changeJob and
   skills.js's castSkill / skillForKey. Loaded right after skills.js + skillkit.js, before net.js (it wraps castSkill to
   tell the other players) and party.js (its wrappers go round these). The skill window and the HUD's hotbar are in
   skillui.js. */
(function () {
  'use strict';
  const NC = window.NC, SK = NC.SKILLS, V = NC.VFX, FX = NC.FX, RUN = NC.SKILL_RUN;
  const KEYS = (NC.HOTKEYS = ['q', 'e', 'r', 'f', '3', '4', '5', '6']);
  const SHARED = (NC.SHARED_SKILLS = ['mastery', 'body', 'mind']);
  const JOB = (p) => NC.JOBS[p.job] || NC.JOBS.traveler;
  const uniq = (a) => [...new Set(a)];
  // Learning and paid points use learned ranks even when the held weapon disables their combat effects.
  const learnedLv = (p, id) => (NC.skillRaw || NC.skillLv)(p, id);

  // ---------------- a job's line: the job and the jobs it grew from (a class-3 job -> its 2nd job -> its 1st job) ----------------
  NC.jobLine = function (job) {
    const out = [];
    for (let j = job; j && NC.JOBS[j] && !out.includes(j); j = NC.JOBS[j].tier >= 2 ? NC.JOBS[j].from : null) out.push(j);
    return out;
  };
  // "is the hero this job?": a class-3 job still counts as its 2nd and 1st job (their skill code checks the job id)
  NC.isJob = (p, id) => !!p && (p.job === id || NC.jobLine(p.job).includes(id));

  // ---------------- which skills a job has, and their levels ----------------
  const listOf = (job) => {
    const J = NC.JOBS[job] || NC.JOBS.traveler;
    if (J.tier < 2) return J.skills;
    return uniq(NC.jobLine(job).reverse().flatMap((j) => NC.JOBS[j].skills)); // (the 1st job's first, then the 2nd, the 3rd)
  };
  NC.jobSkills = (p) => listOf(p.job);
  NC.kindOf = (S) => (!S ? 'passive' : S.kind || (!S.active ? 'passive' : S.type === 'buff' ? 'buff' : 'active'));
  NC.freeSkillLv = (id) => { const S = SK[id]; return !S ? 0 : S.free !== undefined ? S.free : S.active ? 1 : 0; };
  NC.newSkills = (job) => { const s = {}; for (const id of listOf(job)) if (SK[id]) s[id] = NC.freeSkillLv(id); return s; };
  // points: one per job level; a 2nd job also has its 1st job's (it changed at the 1st job's top level), a class-3 job
  // its 2nd and 1st job's; and every job after the traveler keeps the traveler's Job Lv 1-10 points, spent or not (the
  // user, 2026-10-19: unspent traveler points vanished at the 1st job change; the server counts the same, patch 008)
  NC.travelerPoints = (job) => {
    const line = NC.jobLine(job), first = NC.JOBS[line[line.length - 1]];
    return first && first.tier >= 1 && NC.JOBS.traveler ? NC.JOBS.traveler.maxJob - 1 : 0;
  };
  NC.skillPoints = (p) => p.jobLv - 1 + NC.travelerPoints(p.job) + NC.jobLine(p.job).slice(1).reduce((s, j) => s + (NC.JOBS[j].tier >= 1 ? NC.JOBS[j].maxJob - 1 : 0), 0);
  NC.skillLeft = (p) => NC.skillPoints(p) - NC.jobSkills(p).reduce((s, id) => s + Math.max(0, learnedLv(p, id) - NC.freeSkillLv(id)), 0);
  NC.skillReq = (id) => (SK[id] && SK[id].req) || [];
  // (S.reqAny: any one of them is enough, e.g. an ultimate open to two lines)
  NC.skillReqMet = (p, id) => { const R = NC.skillReq(id), ok = ([r, lv]) => learnedLv(p, r) >= lv; return !R.length || (SK[id].reqAny ? R.some(ok) : R.every(ok)); };
  NC.raiseSkill = function (p, id) {
    const S = SK[id];
    if (!S || !NC.jobSkills(p).includes(id) || learnedLv(p, id) >= S.max || NC.skillLeft(p) <= 0 || !NC.skillReqMet(p, id)) return false;
    const was = learnedLv(p, id);
    p.skills[id] = was + 1;
    if (was === 0 && slottable(S)) autoSlot(p, id); // a newly learned skill goes on a free slot
    return true;
  };

  // ---------------- job changes: traveler -> a 1st job (Job Lv 10), a 1st job -> one of its two branches (Job Lv 50) ----------------
  NC.nextJobs = function (p) {
    const J = JOB(p);
    if (J.tier === 0) return Object.keys(NC.JOBS).filter((j) => NC.JOBS[j].tier === 1);
    if (J.tier === 1 || J.tier === 2) return Object.keys(NC.JOBS).filter((j) => NC.JOBS[j].tier === J.tier + 1 && NC.JOBS[j].from === p.job);
    return [];
  };
  // a 2nd job becomes a class-3 job at Job Lv 50 and Base Lv NC.CLASS3_BASE_LV (80 since 2026-10-20, the owner: "80 ก็ได้";
  // 99 left a hero capped at Job 50 near Lv 83 farming ~120 h with nothing to unlock). The server's own is
  // class3BaseLevel (server patch 016): the two go out together.
  NC.CLASS3_BASE_LV = 80;
  NC.canChangeJob = (p) => NC.nextJobs(p).length > 0 && p.jobLv >= NC.jobMax(p) && (JOB(p).tier !== 2 || p.lv >= NC.CLASS3_BASE_LV);
  const baseChange = NC.changeJob;
  NC.changeJob = function (p, id) {
    const J = NC.JOBS[id];
    if (!J) return false;
    if (J.tier < 2) {
      const keep = Object.assign({}, p.skills);
      const ok = baseChange(p, id);
      if (!ok) return ok;
      p.hotbar = null;
      for (const s of listOf(id)) if (Number.isFinite(keep[s]) && keep[s] > (p.skills[s] || 0)) p.skills[s] = keep[s]; // (the traveler's shared passives stay)
      return ok;
    }
    if (J.from !== p.job) return false;
    const keep = Object.assign({}, p.skills);
    p.job = id; p.jobLv = 1; p.jobXp = 0;
    p.skills = NC.newSkills(id);
    for (const s of listOf(J.from)) if (Number.isFinite(keep[s])) p.skills[s] = Math.max(p.skills[s] || 0, keep[s]); // (every skill learned so far stays)
    return true;
  };

  // ---------------- lines (สาย) and their resonance ----------------
  // A job's skills sit in lines (J.lines: [{ id, name, el, parent }], S.line = the line's id in its job); a 2nd job's
  // line may continue a line of its 1st job (parent). A line's resonance is the skill levels put into it, plus its
  // parent's (a 2nd-job line) or its fullest child's (a 1st-job line of a 2nd job): 15 / 30 / 45 levels -> tier I / II / III
  // (+10 / 20 / 30% damage for the line's skills, bigger areas from tier II, an aura at tier III).
  NC.RES_STEPS = [15, 30, 45];
  NC.RES_DMG = [0, 10, 20, 30];
  const jobOfSkill = {};
  NC.skillJob = (id) => {
    if (jobOfSkill[id] !== undefined) return jobOfSkill[id];
    const j = Object.keys(NC.JOBS).find((k) => NC.JOBS[k].skills.includes(id) && !SHARED.includes(id)) || null;
    jobOfSkill[id] = j;
    return j;
  };
  NC.lineInfo = function (p) {
    if (JOB(p).tier === 3) { // a class-3 job: its 2nd job's lines, reckoned as the 2nd job (its own skills power those up)
      const real = p.job;
      p.job = JOB(p).from;
      try { return NC.lineInfo(p); } finally { p.job = real; }
    }
    const J = JOB(p), F = J.tier === 2 ? NC.JOBS[J.from] : null, lv = {}, tier = {}, res = {};
    for (const id of NC.jobSkills(p)) {
      const S = SK[id], job = NC.skillJob(id);
      if (!S || !S.line || !job) continue;
      const g = job + ':' + S.line;
      lv[g] = (lv[g] || 0) + NC.skillLv(p, id);
    }
    const lines = (job) => ((NC.JOBS[job] && NC.JOBS[job].lines) || []).map((l) => job + ':' + l.id);
    const children = (g) => (J.tier === 2 ? (J.lines || []).filter((l) => l.parent && J.from + ':' + l.parent === g).map((l) => p.job + ':' + l.id) : []);
    const all = [...lines(F ? J.from : p.job), ...(F ? lines(p.job) : [])];
    for (const g of all) {
      const [job, key] = g.split(':'), L = (NC.JOBS[job].lines || []).find((l) => l.id === key);
      let n = lv[g] || 0;
      if (L && L.parent) n += lv[J.from + ':' + L.parent] || 0;
      else { const c = children(g).map((x) => lv[x] || 0); if (c.length) n += Math.max(...c); }
      res[g] = n;
      tier[g] = NC.RES_STEPS.filter((s) => n >= s).length;
    }
    // each skill's tier: its line's; 'multi' (the mage's elemental ultimate): the best line
    const bySkill = {};
    for (const id of NC.jobSkills(p)) {
      const S = SK[id], job = NC.skillJob(id);
      if (!S || !S.line || !job) continue;
      bySkill[id] = S.line === 'multi' ? Math.max(0, ...all.map((g) => tier[g] || 0)) : tier[job + ':' + S.line] || 0;
    }
    return { lineLv: lv, lineRes: res, lineTier: tier, resBySkill: bySkill };
  };
  // how much bigger a skill's areas are (resonance tier II and up)
  NC.skillScale = (p, id) => (p && p.d && p.d.resBySkill && p.d.resBySkill[id] >= 2 ? 1.15 : 1);

  // ---------------- the hotbar ----------------
  const slottable = (NC.skillSlottable = (S) => !!S && !!S.active && NC.kindOf(S) !== 'passive');
  const usable = (NC.skillUsable = (p, id) => {
    const S = SK[id];
    if (!S || !S.active) return false;
    if (S.boss) return !!NC.classOf && NC.BOSS_ULT[NC.classOf(p.equip)] === id;
    return NC.jobSkills(p).includes(id) && NC.skillLv(p, id) > 0;
  });
  // a new hotbar: the job's skills on their own keys (Q E R F), then the other learned ones on the free slots
  function defaultHotbar(p, first) {
    const hb = {}, ids = NC.jobSkills(p).filter((id) => slottable(SK[id]) && NC.skillLv(p, id) > 0);
    for (const k of KEYS) hb[k] = null;
    const order = first ? ids.filter((id) => first.includes(id)).concat(ids.filter((id) => !first.includes(id))) : ids;
    if (!first) for (const id of ids) { const k = SK[id].key && SK[id].key.toLowerCase(); if (k && KEYS.includes(k) && !hb[k]) hb[k] = id; }
    for (const id of order) if (!KEYS.some((k) => hb[k] === id)) { const k = KEYS.find((kk) => !hb[kk]); if (k) hb[k] = id; }
    return hb;
  }
  NC.defaultHotbar = defaultHotbar;
  const hotbar = (NC.hotbarOf = (p) => { if (!p.hotbar) p.hotbar = defaultHotbar(p); return p.hotbar; });
  function autoSlot(p, id) {
    const hb = hotbar(p);
    if (KEYS.some((k) => hb[k] === id)) return;
    const k = KEYS.find((kk) => !hb[kk] || !usable(p, hb[kk]));
    if (k) hb[k] = id;
  }
  NC.autoSlot = autoSlot;
  // put a skill on a slot (off any other slot it was on); null empties the slot
  NC.assignSlot = function (p, key, id) {
    const hb = hotbar(p);
    if (id) for (const k of KEYS) if (hb[k] === id) hb[k] = null;
    hb[key] = id || null;
  };
  NC.skillForKey = function (p, key) {
    const k = String(key).toLowerCase(), hb = hotbar(p);
    // a boss set's ultimate takes F while the whole set is worn (unless it was put on a slot of its own)
    const boss = NC.classOf && NC.BOSS_ULT[NC.classOf(p.equip)];
    if (k === 'f' && boss && !KEYS.some((kk) => hb[kk] === boss)) return boss;
    const id = hb[k];
    return id && usable(p, id) ? id : null;
  };

  // ---------------- casting ----------------
  const cdKey = (id) => '@' + id;
  NC.skillCdOf = (S, lv) => (typeof S.cd === 'function' ? S.cd(lv) : S.cd) || 0;
  NC.skillCd = (p, id) => (p.cd && p.cd[cdKey(id)]) || 0;
  NC.skillCdFull = (p, id) => (p.cdFull && p.cdFull[cdKey(id)]) || (SK[id] ? NC.skillCdOf(SK[id], NC.skillLv(p, id)) : 1) || 1;
  NC.skillCost = (p, id, lv) => Math.max(0, Math.round(SK[id].sp(lv === undefined ? NC.skillLv(p, id) : lv) * ((p.d && p.d.spCostK) || 1)));
  NC.clearSkillCds = (p) => { for (const k in p.cd) if (k[0] === '@') p.cd[k] = 0; };
  NC.castSkill = function (game, p, key) {
    const id = NC.skillForKey(p, key);
    if (!id) return false;
    const S = SK[id];
    if (!RUN[id] && !S.buff) return false;
    if (!p.buffs) p.buffs = {};
    const lv = NC.skillLv(p, id), cost = NC.skillCost(p, id, lv);
    if (NC.skillCd(p, id) > 0) return false;
    if (S.need) { const why = S.need(game, p, lv); if (why !== true) { warn(game, p, why || 'ใช้ไม่ได้ตอนนี้'); return false; } }
    if (p.sp < cost) { warn(game, p, 'SP ไม่พอ', 'SP ไม่พอสำหรับ ' + S.name); return false; }
    p.sp -= cost;
    p.cd[cdKey(id)] = p.cdFull[cdKey(id)] = NC.skillCdOf(S, lv) * (1 - p.d.cdr);
    if (S.ult) V.flash('255,255,255', 0.08, 0.2);
    if (RUN[id]) RUN[id](game, p, lv, key);
    else castBuff(game, p, id, lv);
    for (const f of CASTS) f(game, p, id, lv);
    return true;
  };
  const CASTS = (NC.skillCasts = []); // (game, p, id, lv) after a skill went off (hiding ends, spheres...)
  function warn(game, p, text, log) {
    if (game.time - (p.noSpT || -9) <= 1) return;
    p.noSpT = game.time;
    FX.num(p.x, p.y - 170, text, { fill: '#8fc8ff', size: 30 });
    NC.HUD.log(log || text, 'warn');
  }
  // a buff skill with no looks of its own: the hero's pose, the buff, a ring of its colour (and the friends' part)
  function castBuff(game, p, id, lv) {
    const S = SK[id], K = NC.SkillKit;
    K.pose(game, p, 'cheer', 0.35);
    K.startBuff(game, p, id, lv);
    K.buffFx(game, p, S.rgb || V.RGB.holy, { style: S.circle || 'holy' });
    if (S.party) K.buffFriends(game, p, Object.assign({ dur: S.dur(lv), rgb: S.rgb }, S.party(lv)));
  }

  // ---------------- passives and buffs change the hero's numbers ----------------
  // mods (all added up): str agi vit int dex luk hit flee def mdef hp sp (flat); atk skill crit spd cdr (%, like the gear's);
  // matk hpPct spPct hpReg spReg aspd (%); batk pdodge vdef (flat); critDmg (% more on a critical), taken (% less damage
  // taken), heal (% more healing), spCost (% cheaper skills), vsDark (% more on undead / shadow), dbl (% chance a basic hit
  // lands twice), poison (% stronger poison), pet (% stronger summons), trap (% stronger traps)
  const SOURCES = (NC.skillModSources = []); // (p) -> mods: spheres, souls... (the skill files add theirs)
  const add = (m, o) => { if (o) for (const k in o) if (o[k]) m[k] = (m[k] || 0) + o[k]; };
  NC.skillMods = function (p) {
    const m = {};
    if (p.kind !== 'player' || !p.skills) return m;
    for (const id of NC.jobSkills(p)) { const S = SK[id], lv = p.skills[id] || 0; if (lv > 0 && S && S.pass) add(m, S.pass(lv, p)); }
    if (p.buffs) for (const id in p.buffs) if (p.buffs[id] > 0 && SK[id] && SK[id].buff) add(m, SK[id].buff((p.buffLv && p.buffLv[id]) || NC.skillLv(p, id) || 1, p));
    for (const f of SOURCES) add(m, f(p));
    return m;
  };
  const PRE_FLAT = ['str', 'agi', 'vit', 'int', 'dex', 'luk', 'hit', 'flee', 'def', 'mdef', 'hp', 'sp'], PRE_PCT = ['atk', 'skill', 'crit', 'spd', 'cdr'];
  const baseDerive = NC.derive;
  NC.derive = function (p) {
    const m = NC.skillMods(p), g0 = p.stats;
    if (Object.keys(m).length) {
      const g = Object.assign({}, g0 || {});
      for (const k of PRE_FLAT) if (m[k]) g[k] = (g[k] || 0) + m[k];
      for (const k of PRE_PCT) if (m[k]) g[k] = (g[k] || 0) + m[k] / 100;
      p.stats = g;
    }
    let d;
    try { d = baseDerive(p); } finally { p.stats = g0; }
    const W = (NC.ITEMS && p.equip && NC.ITEMS[p.equip.weapon]) || {};
    if (m.matk) d.matk = d.matk.map((v) => Math.round(v * (1 + m.matk / 100)));
    if (m.batk) d.batk += Math.round(m.batk);
    if (m.aspd) { d.aspdMul = Math.min(NC.ASPD_CAP, d.aspdMul * (1 + m.aspd / 100)); d.aspd = NC.aspdShown(W, d.aspdMul); }
    if (m.hpPct) d.maxHp = Math.round(d.maxHp * (1 + m.hpPct / 100));
    if (m.spPct) d.maxSp = Math.round(d.maxSp * (1 + m.spPct / 100));
    if (m.hpReg) d.hpRegen *= 1 + m.hpReg / 100;
    if (m.spReg) d.spRegen *= 1 + m.spReg / 100;
    if (m.pdodge) d.pdodge += m.pdodge;
    if (m.vdef) d.vdef += Math.round(m.vdef);
    d.critDmg = Math.min(100, m.critDmg || 0); d.taken = Math.min(80, m.taken || 0); d.healK = 1 + (m.heal || 0) / 100;
    d.spCostK = Math.max(0.3, 1 - (m.spCost || 0) / 100); d.vsDark = m.vsDark || 0; d.dbl = m.dbl || 0;
    d.poisonK = 1 + (m.poison || 0) / 100; d.petK = 1 + (m.pet || 0) / 100; d.trapK = 1 + (m.trap || 0) / 100;
    d.mods = m;
    // element passives: el_<element> = % more damage with that element, st_<status> = % more chance to cause it
    d.elDmg = {}; d.stBonus = {};
    for (const k in m) { if (k.startsWith('el_')) d.elDmg[k.slice(3)] = m[k]; else if (k.startsWith('st_')) d.stBonus[k.slice(3)] = m[k]; }
    if (p.kind === 'player' && p.skills) Object.assign(d, NC.lineInfo(p));
    // a buff that enchants the weapon (holy water, deadly poison): the weapon hits with that element meanwhile
    if (p.kind === 'player' && p.buffs) for (const id in p.buffs) if (p.buffs[id] > 0 && SK[id] && SK[id].enchant) d.atkElement = SK[id].enchant;
    return d;
  };
  // a buff ran out: its changes go (the skill files' per-frame hooks run here too)
  const TICK = (NC.skillTicks = []);
  const baseTick = NC.updateSkills;
  NC.updateSkills = function (game, dt) {
    baseTick(game, dt);
    const p = game.player;
    if (!p.buffOn) p.buffOn = {};
    let changed = false;
    for (const id in p.buffs) {
      const S = SK[id];
      if (!S || !S.buff) continue;
      const on = p.buffs[id] > 0;
      if (on !== !!p.buffOn[id]) { p.buffOn[id] = on; changed = true; }
      if (on && S.aura) S.aura(game, p, dt);
    }
    if (changed) NC.applyGear(game);
    for (const f of TICK) f(game, p, dt);
  };

  // ---------------- hits: the hero's (critical damage, double attack, bane), on marked monsters, from weakened ones ----------------
  const baseHeroHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHeroHit(d, e, o), G = NC.game, p = G && G.player;
    if (!p || p.kind !== 'player' || d !== p.d || !(r.dmg > 0)) return r;
    let k = 1;
    if (o.sid && d.resBySkill && d.resBySkill[o.sid]) k *= 1 + NC.RES_DMG[d.resBySkill[o.sid]] / 100; // the line's resonance
    const el = o.element || d.atkElement;
    if (d.elDmg && d.elDmg[el]) k *= 1 + d.elDmg[el] / 100; // the element's passive (ใจเพลิง...)
    if (r.crit && d.critDmg) k *= 1 + d.critDmg / 100;
    if (d.vsDark && (e.element === 'undead' || e.element === 'shadow')) k *= 1 + d.vsDark / 100;
    if (!o.skill && d.dbl && Math.random() * 100 < d.dbl) { k *= 2; r.double = true; r.hits = 2; }
    if (k !== 1) r.dmg = Math.max(1, Math.round(r.dmg * k));
    if (!o.skill) for (const f of BASIC) f(G, p, e, r);
    return r;
  };
  const BASIC = (NC.basicHits = []); // (game, p, e, r) on the hero's own weapon hits (poisons, marks...)
  const KILLS = (NC.skillKills = []); // (game, e) when a monster falls
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    if (r && r.dmg > 0 && e.vuln && e.vuln.until > game.time) r = Object.assign({}, r, { dmg: Math.round(r.dmg * e.vuln.k) });
    const was = e.hp > 0;
    baseDamage(game, e, r, kx, ky, o);
    if (was && e.hp <= 0) for (const f of KILLS) f(game, e);
  };
  const baseMonsterHit = NC.monsterHit;
  NC.monsterHit = function (m, d) {
    const r = baseMonsterHit(m, d), G = NC.game;
    if (r.dmg > 0 && m.weak && G && m.weak.until > G.time) r.dmg = Math.max(1, Math.round(r.dmg * m.weak.k));
    return r;
  };
  // the hero being hit: the skill files' protections (a shield that soaks, a dodge, SP paying for HP, a reflection),
  // then the passives' "less damage taken"
  let attacker = null;
  const baseMonsterAttack = NC.monsterAttack;
  NC.monsterAttack = function (game, e) { attacker = e; try { return baseMonsterAttack(game, e); } finally { attacker = null; } };
  const GUARDS = (NC.heroGuards = []); // (game, p, dmg, attacker) -> dmg left (0: all of it stopped)
  const baseHurt = NC.hurtPlayer;
  NC.hurtPlayer = function (game, dmg, fromX) {
    const p = game.player;
    if (!p || p.kind !== 'player' || p.inv > 0 || p.dead > 0 || !(dmg > 0)) return baseHurt(game, dmg, fromX);
    for (const f of GUARDS) {
      dmg = f(game, p, dmg, attacker);
      if (!(dmg > 0)) { p.inv = Math.max(p.inv, 0.3); return; }
    }
    if (p.d && p.d.taken) dmg = Math.max(1, Math.round(dmg * (1 - p.d.taken / 100)));
    return baseHurt(game, dmg, fromX);
  };

  // ---------------- saves: the hotbar comes back with the rest ----------------
  const baseInit = NC.initHero;
  NC.initHero = function (p, s) {
    baseInit(p, s);
    s = s || {};
    p.hotbar = null;
    p.buffLv = p.buffLv || {};
    if (s.hotbar && typeof s.hotbar === 'object') {
      const hb = {};
      for (const k of KEYS) hb[k] = typeof s.hotbar[k] === 'string' && SK[s.hotbar[k]] ? s.hotbar[k] : null;
      p.hotbar = hb;
    }
    hotbar(p);
  };
})();
