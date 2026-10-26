/* jobfit.js — which maps suit which job (docs/game-bible-online-plan.md, decision 3: advice on the map card, never a
   bonus). The one place for the rules: the web's map card (mapwin.js), the Unity export (ui.jobFit,
   scripts/lib/unity-export-jobfit.mjs) and tests/jobfit.test.mjs all read them.
     a job     its attack elements: its skill lines' elements (a class-3 job: its 2nd job's; 'multi' = fire, water and
               wind) and any element a quarter of its damage skills carry; how magic it is (its damage skills' types,
               its own skills counting most); its reach: magic casts from afar, else its own lanes' weapons (the ones
               its 1st job had not: bow, gun, orb... ranged); how well it clears packs (AREA, from each job's text)
     a map     its roster (monsters.js ROSTER read as worldmap.js infoOf reads it): the elements' shares and what each
               attack element does there on average, the monsters' kinds (monsters.js, monkinds.js), their armour
               (defK / mdefK) and how packed they are (spawns per million square units; a dungeon's halls are packed)
     the fit   a few factors, each a score with a short Thai reason; the sum >= 0.6 เหมาะ, <= -0.75 ลำบาก, else พอได้
     EXP here  the level-gap table (world.json experience.levelGap; LEVEL_GAP until it lands) over the roster's levels
   Two sources, one shape: fromNC(NC) on the web (NC.JobFit.web(), after every script has loaded), fromWorld(world)
   for backend/data/world.json in node. Loads anywhere after core.js; reads the data only when asked. */
(function () {
  'use strict';
  const NC = window.NC = window.NC || {};

  // |monster Lv - hero Lv| up to row[0] -> EXP x row[1] (the user's table, 2026-09-30)
  const LEVEL_GAP = [[3, 1], [8, 0.7], [14, 0.4], [20, 0.2], [999, 0.05]];
  // how well each job clears a pack: 2 its best skills hit many, 1 both, 0 one target at a time (a class-3 job is its
  // 2nd job's unless listed); from the jobs' own descriptions
  const AREA = {
    traveler: 1, knight: 1, mage: 2, archer: 1, rogue: 0, priest: 0,
    paladin: 1, dragonknight: 2, swordmaster: 1, berserker: 1, archmage: 1, firemage: 2, icemage: 2, warlock: 1,
    ranger: 1, wolfhunter: 0, gunslinger: 1, bard: 1, assassin: 0, shinobi: 1, reaper: 1, puppeteer: 1,
    bishop: 1, monk: 0, lightkeeper: 1, wisp: 1,
    hexlord: 2, beacon: 2, // (ghost fire leaps to the next one; the lighthouse beam sweeps round)
    // (js/samurai_skills.js: the crescent, wave and full moon cut wide; the blood line opens one wound at a time and only
    // its bloom bursts them all; the cyclone walks with its hero and the leaves warp through every one in reach)
    samurai: 2, bloodsamurai: 1, windsamurai: 2,
  };
  const DAMAGE = { phys: 0, magic: 1, hybrid: 0.5, best: 0.5 }; // a damage skill's type -> how magic it is
  const SKILL_WEIGHT = [1, 0.6, 0.35, 0.2]; // own skills, the job before's, ...
  const SKILL_EL_SHARE = 0.25; // an element this share of the damage skills carry is one of the job's
  const MAGIC_RANGED = 0.75, MAGIC_MELEE = 0.4; // reach: casts from afar / may still count as melee
  const CROWD_DENSE = 7, CROWD_SPARSE = 5; // spawns per million square units (the zone maps 7.35, the camp 4.5)
  const KIND_MIN = 0.15; // a kind counts once it is this share of the roster
  const ARMOUR_HIGH = 1.6, ARMOUR_LOW = 0.65; // the roster's defK / mdefK (geometric mean)
  const GOOD = 0.6, HARD = -0.75, REASONS = 3;
  const MAGIC = 0.6, PHYSICAL = 0.3; // a job this magic counts as a caster / at most this magic as a fighter
  // each factor's weight: [helps, hurts] per share of the roster (a kind), or a flat score
  const W = {
    elGood: 2, elGoodMax: 1.2, elBad: 2.5, elBadMax: 2, elAvoid: 0.15, // x (multiplier - 1), capped
    shield: [1.5, 2], fly: [1, 0.6], far: [1, 0.8], bomb: [0.8, 1.2], split: [1.5, 1], leader: 1,
    packed: [0.5, 0.3], sparse: 0.3, armour: [0.4, 0.3], ward: [0.3, 0.3], // (thick armour / magic-proof roster)
  };
  const TIER_LV = [[1, 14], [8, 50], [35, 99], [99, 99]]; // the base levels a job tier is usually played at (progression.js refs 5 / 25 / 70 / 99)
  const EXP_WEIGHT = { good: 1.25, okay: 1, hard: 0.7 }, EXP_MIN = 0.4, BEST = 5; // the maps for a hero: EXP here x this
  const CAMP_ZONES = ['ค่ายกลางป่า']; // (worldmap.js: monsters.js still lists the old camp's ruins and forest)
  const EL_TH = { neutral: 'ไม่มีธาตุ', water: 'น้ำ', earth: 'ดิน', fire: 'ไฟ', wind: 'ลม', poison: 'พิษ', holy: 'ศักดิ์สิทธิ์', shadow: 'มืด', ghost: 'วิญญาณ', undead: 'อมตะ' };
  const VERDICT = { good: 'เหมาะ', okay: 'พอได้', hard: 'ลำบาก' };
  const T = { // the reasons
    elGood: (el, m) => `${hit(el)}ได้เปรียบ ×${num(m)}`,
    elBad: (el, m) => `${hit(el)}${m <= 0.3 ? 'ไม่เข้า' : 'ไม่ค่อยเข้า'} ×${num(m)}`,
    elAvoid: (el, m) => (el === 'neutral' ? `ตีแบบไม่มีธาตุเข้าน้อย ×${num(m)}` : `เลี่ยงสกิลธาตุ${EL_TH[el]} ×${num(m)}`),
    shieldMagic: 'มอนโล่เยอะ: เวทไม่โดนบล็อก', shieldPhys: 'มอนโล่เยอะ: เวทหรืออ้อมหลัง',
    flyRanged: 'มอนบินเยอะ: สายยิงไกลได้เปรียบ', flyMelee: 'มอนบินเยอะ: ตีประชิดต้องรอมันโฉบลงมา',
    farRanged: 'มอนยืนยิง/ฮีลอยู่ห่าง ๆ: สายยิงไกลเอื้อมถึง', farMelee: 'มอนยืนยิง/ฮีลอยู่ห่าง ๆ: สายประชิดต้องวิ่งไล่',
    bombRanged: 'มอนระเบิดตัวเอง: ยิงก่อนมันถึงตัว', bombMelee: 'มอนระเบิดตัวเอง: สายประชิดระวัง',
    splitArea: 'มอนแตกตัว: สกิลวงกว้างคุ้ม', splitSingle: 'มอนแตกตัว: สายเป้าเดียวเหนื่อย',
    leader: 'มีจ่าฝูง: สายเป้าเดียวล้มจ่าฝูงได้ไว ฝูงแตก',
    denseArea: 'ฝูงแน่น: สกิลวงกว้างคุ้ม', hallsArea: 'ทางแคบ มอนมาเป็นกลุ่ม: สกิลวงกว้างคุ้ม',
    denseSingle: 'ฝูงแน่น: สายเป้าเดียวเหนื่อย', sparseArea: 'มอนอยู่ห่างกัน: สกิลวงกว้างไม่ค่อยคุ้ม',
    armourMagic: 'มอนเกราะหนา: เวทได้เปรียบ', armourPhys: 'มอนเกราะหนา: ตีกายภาพเข้ายาก',
    wardPhys: 'มอนต้านเวท: สายกายภาพได้เปรียบ', wardMagic: 'มอนต้านเวท: เวทเข้ายาก',
    none: 'ไม่มีอะไรได้เปรียบหรือเสียเปรียบเป็นพิเศษ',
  };
  const num = (m) => String(+m.toFixed(2));
  const hit = (el) => (el === 'neutral' ? 'ตีแบบไม่มีธาตุ' : 'ธาตุ' + EL_TH[el]);
  const round = (v) => Math.round(v * 100) / 100;
  const lvRange = (t) => { const m = /(\d+)\D+(\d+)/.exec(t || ''); return m ? [+m[1], +m[2]] : null; };

  // ---------------- the sources ----------------
  const crowdOf = (n, W, H) => (W && H ? n / ((W * H) / 1e6) : 0);
  function fromWorld(w) {
    const E = w.elements || [], table = w.elementTable || [];
    const maps = {};
    for (const [id, M] of Object.entries(w.maps || {})) {
      const n = (M.spawns || []).filter((s) => !s.boss && !s.chest).length;
      maps[id] = { name: M.name, lvText: M.lvText || '', parent: M.parent || null, dungeon: !!M.dungeon, secret: !!M.secret,
        lv: M.levelRanges || {}, zones: M.zones || [], crowd: crowdOf(n, M.W, M.H) };
    }
    const starters = (w.weapons || {}).starters || {}, attacks = w.basicAttacks || {};
    return {
      jobs: w.jobs || {}, skills: w.skills || {}, monsters: w.monsters || {}, roster: w.roster || {}, maps,
      weapons: (w.weapons || {}).jobTypes || {},
      ranged: Object.keys(starters).filter((t) => ((attacks[starters[t]] || {}).weapon || {}).range),
      mod: (a, d) => { const r = table[E.indexOf(a || 'neutral')]; return r ? Math.max(0, r[E.indexOf(d || 'neutral')] / 100) : 1; },
      levelGap: ((w.experience || {}).levelGap) || null,
    };
  }
  function fromNC(N) {
    const jobs = {}, skills = {}, weapons = {}, maps = {}, mult = N.MOB_MULT || 1;
    for (const [id, J] of Object.entries(N.JOBS || {})) {
      jobs[id] = { name: J.name, tier: J.tier || 0, from: J.from || null, skills: J.skills || [], lines: J.lines || [] };
      weapons[id] = N.jobWeaponTypes ? [...N.jobWeaponTypes(id)].sort() : [];
    }
    for (const [id, S] of Object.entries(N.SKILLS || {})) skills[id] = { element: S.element || null, type: S.type || null };
    for (const [id, M] of Object.entries(N.MAPS || {})) {
      const n = (M.spawns || []).reduce((s, it) => s + Math.round(it[1] * mult), 0);
      maps[id] = { name: M.name, lvText: M.lvText || '', parent: M.parent || null, dungeon: !!M.dungeon, secret: !!M.secret,
        lv: M.lv || {}, zones: M.zones || [], crowd: crowdOf(n, M.W, M.H) };
    }
    const starters = N.STARTER_WEAPONS || {}, items = N.ITEMS || {};
    return {
      jobs, skills, weapons, maps, monsters: N.MONSTERS || {}, roster: N.ROSTER || {},
      ranged: Object.keys(starters).filter((t) => (items[starters[t]] || {}).range),
      mod: N.elementMod || (() => 1), levelGap: (N.EXPERIENCE || {}).levelGap || null,
    };
  }

  // ---------------- a job ----------------
  const chainOf = (src, id) => { const out = []; for (let k = id; k && src.jobs[k] && out.length < 5; k = src.jobs[k].from) out.push(k); return out; };
  const lineEls = (el) => (el === 'multi' ? ['fire', 'water', 'wind'] : el ? [el] : []);
  function profile(src, id) {
    const memo = src.__profiles || (src.__profiles = {});
    if (id in memo) return memo[id];
    const J = src.jobs[id];
    if (!J) return (memo[id] = null);
    const chain = chainOf(src, id), weight = {};
    chain.forEach((k, i) => { for (const s of src.jobs[k].skills || []) if (!(s in weight)) weight[s] = SKILL_WEIGHT[Math.min(i, SKILL_WEIGHT.length - 1)]; });
    let dmg = 0, magic = 0;
    const share = {};
    for (const [s, w] of Object.entries(weight)) {
      const S = src.skills[s];
      if (!S || !(S.type in DAMAGE)) continue;
      dmg += w; magic += w * DAMAGE[S.type];
      const el = S.element || 'neutral';
      share[el] = (share[el] || 0) + w;
    }
    const byShare = Object.keys(share).sort((a, b) => share[b] - share[a]);
    const els = byShare.filter((el) => share[el] / (dmg || 1) >= SKILL_EL_SHARE);
    const lineJob = (J.tier || 0) >= 3 && src.jobs[J.from] ? src.jobs[J.from] : J; // (a class-3 job's lines are its powers)
    for (const L of lineJob.lines || []) for (const el of lineEls(L.el)) if (!els.includes(el)) els.push(el);
    if (!els.length) els.push('neutral');
    const m = dmg ? magic / dmg : 0;
    // its lanes: the weapons its 1st job did not have (a 1st job and the traveler: all of theirs)
    const types = src.weapons[id] || [], first = chain.find((k) => (src.jobs[k].tier || 0) === 1);
    const own = first && first !== id ? types.filter((t) => !(src.weapons[first] || []).includes(t)) : [];
    const lanes = own.length ? own : types, far = lanes.filter((t) => src.ranged.includes(t)).length / (lanes.length || 1);
    const reach = m >= MAGIC_RANGED || far === 1 ? 'ranged' : far === 0 && m < MAGIC_MELEE ? 'melee' : 'mixed';
    const area = chain.map((k) => AREA[k]).find((a) => a !== undefined);
    return (memo[id] = { id, name: J.name, tier: J.tier || 0, elements: els, main: byShare[0] || els[0], magic: round(m), reach, area: area === undefined ? 1 : area });
  }

  // ---------------- a map ----------------
  // its roster as worldmap.js infoOf reads it: species -> { w: its share of each slot's spawns, summed over the zones,
  // lv: [from, to] }
  function rosterOf(src, id) {
    const M = src.maps[id] || {}, R = src.roster[id] || {}, mons = new Map();
    const keys = id === 'camp' ? CAMP_ZONES : ['*', ...(M.zones || []).map((z) => z.name)];
    for (const key of keys) {
      const set = R[key];
      if (!set) continue;
      const zone = (M.zones || []).find((z) => z.name === key);
      for (const slot of ['slime', 'hollow']) {
        const list = set[slot] || [], sum = list.reduce((s, it) => s + it[1], 0) || 1;
        const lv = (zone && zone.lv && zone.lv[slot]) || (M.lv && M.lv[slot]) || null;
        for (const [sp, w] of list) {
          const m = mons.get(sp) || { w: 0, lv: null };
          m.w += w / sum;
          if (lv) m.lv = m.lv ? [Math.min(m.lv[0], lv[0]), Math.max(m.lv[1], lv[1])] : lv.slice();
          mons.set(sp, m);
        }
      }
    }
    return mons;
  }
  function digest(src, id) {
    const memo = src.__maps || (src.__maps = {});
    if (id in memo) return memo[id];
    const M = src.maps[id];
    if (!M) return (memo[id] = null);
    const mons = rosterOf(src, id), share = {}, kinds = {};
    let total = 0, armour = 0;
    for (const [sp, m] of mons) {
      const S = src.monsters[sp] || {}, el = S.element || 'neutral', kind = S.kind || 'melee';
      total += m.w; share[el] = (share[el] || 0) + m.w; kinds[kind] = (kinds[kind] || 0) + m.w;
      armour += m.w * Math.log((S.defK || 1) / (S.mdefK || 1));
    }
    for (const k in share) share[k] /= total || 1;
    for (const k in kinds) kinds[k] /= total || 1;
    const mods = {};
    const mod = (a) => {
      if (!(a in mods)) { let s = 0; for (const el in share) s += src.mod(a, el) * share[el]; mods[a] = total ? s : 1; }
      return mods[a];
    };
    const crowd = M.dungeon ? 'halls' : M.crowd >= CROWD_DENSE ? 'dense' : M.crowd < CROWD_SPARSE ? 'sparse' : 'normal';
    return (memo[id] = { id, mons, total, share, kinds, mod, armour: total ? Math.exp(armour / total) : 1, crowd, lv: lvRange(M.lvText) });
  }

  // ---------------- the fit ----------------
  function fit(src, jobId, mapId) {
    const P = profile(src, jobId), D = digest(src, mapId);
    if (!P || !D || !D.total) return null;
    const out = [], add = (v, text) => { if (Math.abs(v) >= 0.05) out.push({ v: round(v), text }); };
    const kind = (...ks) => ks.reduce((s, k) => s + (D.kinds[k] || 0), 0);
    const ranged = P.reach === 'ranged', melee = P.reach === 'melee', phys = 1 - P.magic;
    // the elements: the best one it has, and a warning about one of its own that barely hurts here
    const best = P.elements.reduce((a, b) => (D.mod(b) > D.mod(a) + 1e-9 ? b : a));
    const m = D.mod(best);
    if (m >= 1.2) add(Math.min(W.elGoodMax, (m - 1) * W.elGood), T.elGood(best, m));
    else if (m <= 0.6) add(-Math.min(W.elBadMax, (1 - m) * W.elBad), T.elBad(best, m));
    else {
      const weak = P.elements.find((el) => D.mod(el) <= 0.6);
      if (weak) add(-W.elAvoid, T.elAvoid(weak, D.mod(weak)));
    }
    // the kinds: [helps, hurts] x their share
    const caster = P.magic >= MAGIC, fighter = P.magic <= PHYSICAL;
    const by = (share, [up, down], good, fine, text, bad) => { if (share >= KIND_MIN) { if (good) add(share * up, text); else if (!fine) add(-share * down, bad); } };
    by(kind('shield'), [W.shield[0], W.shield[1] * phys], caster, false, T.shieldMagic, T.shieldPhys);
    by(kind('fly'), W.fly, ranged, !melee, T.flyRanged, T.flyMelee);
    by(kind('ranged', 'summoner', 'healer'), W.far, ranged, !melee, T.farRanged, T.farMelee);
    by(kind('bomber'), W.bomb, ranged, !melee, T.bombRanged, T.bombMelee);
    by(kind('splitter'), W.split, P.area === 2, P.area === 1, T.splitArea, T.splitSingle);
    if (kind('leader') >= KIND_MIN && P.area === 0) add(kind('leader') * W.leader, T.leader);
    // how packed
    if (D.crowd === 'dense' || D.crowd === 'halls') {
      if (P.area === 2) add(W.packed[0], D.crowd === 'halls' ? T.hallsArea : T.denseArea);
      if (P.area === 0) add(-W.packed[1], T.denseSingle);
    } else if (D.crowd === 'sparse' && P.area === 2) add(-W.sparse, T.sparseArea);
    // armour
    if (D.armour >= ARMOUR_HIGH) {
      if (caster) add(W.armour[0], T.armourMagic);
      else if (fighter) add(-W.armour[1], T.armourPhys);
    } else if (D.armour <= ARMOUR_LOW) {
      if (fighter) add(W.ward[0], T.wardPhys);
      else if (caster) add(-W.ward[1], T.wardMagic);
    }
    const score = round(out.reduce((s, r) => s + r.v, 0));
    const reasons = out.sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, REASONS);
    return { job: jobId, map: mapId, score, verdict: score >= GOOD ? 'good' : score <= HARD ? 'hard' : 'okay', reasons: reasons.length ? reasons : [{ v: 0, text: T.none }] };
  }

  // the jobs that suit a map (เหมาะ), among the tiers usually played at its levels: the best of each family (the 1st
  // job it grew from), the best families first
  const familyOf = (src, id) => chainOf(src, id).find((k) => (src.jobs[k].tier || 0) === 1) || id;
  function top(src, mapId, n = 3) {
    const D = digest(src, mapId);
    if (!D || !D.total) return [];
    const lv = D.lv || [1, 99], seen = new Set();
    return Object.keys(src.jobs).filter((id) => { const t = TIER_LV[src.jobs[id].tier || 0] || TIER_LV[0]; return lv[0] <= t[1] && lv[1] >= t[0]; })
      .map((id) => fit(src, id, mapId)).filter(Boolean)
      .sort((a, b) => b.score - a.score || (src.jobs[b.job].tier || 0) - (src.jobs[a.job].tier || 0) || a.job.localeCompare(b.job))
      .filter((f) => { const fam = familyOf(src, f.job); return f.verdict === 'good' && !seen.has(fam) && seen.add(fam); }).slice(0, n);
  }

  // ---------------- EXP here ----------------
  const levelGap = (src) => (Array.isArray(src.levelGap) && src.levelGap.length ? src.levelGap : LEVEL_GAP);
  function gapMul(table, gap) { for (const [upTo, mul] of table) if (gap <= upTo) return mul; return table.length ? table[table.length - 1][1] : 1; }
  // the share of full EXP the hero gets on a map, over its roster (each species evenly over its levels); null: no monsters
  function mapExp(src, mapId, heroLv) {
    const D = digest(src, mapId);
    if (!D || !D.total || !heroLv) return null;
    const table = levelGap(src);
    let sum = 0, w = 0;
    for (const [, m] of D.mons) {
      const lv = m.lv || D.lv;
      if (!lv) continue;
      let s = 0;
      for (let l = lv[0]; l <= lv[1]; l++) s += gapMul(table, Math.abs(l - heroLv));
      sum += (m.w * s) / (lv[1] - lv[0] + 1); w += m.w;
    }
    return w ? round(sum / w) : null;
  }
  // the maps for a hero: EXP here x how well the job suits it, best first (the maps it gets at least 40% EXP on)
  function best(src, jobId, heroLv, n = BEST) {
    return Object.keys(src.maps).filter((id) => !src.maps[id].secret).map((id) => {
      const f = fit(src, jobId, id), exp = mapExp(src, id, heroLv);
      return f && exp !== null && exp >= EXP_MIN ? { map: id, exp, verdict: f.verdict, score: f.score, value: round(exp * EXP_WEIGHT[f.verdict]) } : null;
    }).filter(Boolean).sort((a, b) => b.value - a.value || b.score - a.score || a.map.localeCompare(b.map)).slice(0, n);
  }

  // ---------------- the Unity export (client-content ui.jobFit) ----------------
  // jobs: each job's profile; maps[id].fit[job] = [score, verdict, [[text index, sign], ...]], maps[id].top: job ids;
  // rank: how best() ranks the maps for a hero
  function table(src) {
    const texts = [], index = new Map();
    const at = (text) => { if (!index.has(text)) { index.set(text, texts.length); texts.push(text); } return index.get(text); };
    const jobs = {}, maps = {};
    for (const id of Object.keys(src.jobs).sort()) {
      const P = profile(src, id);
      jobs[id] = { name: P.name, tier: P.tier, elements: P.elements, reach: P.reach, area: P.area, magic: P.magic };
    }
    for (const id of Object.keys(src.maps).sort()) {
      const row = {};
      for (const job of Object.keys(jobs)) {
        const f = fit(src, job, id);
        if (f) row[job] = [f.score, f.verdict, f.reasons.map((r) => [at(r.text), Math.sign(r.v)])];
      }
      if (Object.keys(row).length) maps[id] = { fit: row, top: top(src, id).map((f) => f.job) };
    }
    return { levelGap: levelGap(src), verdicts: VERDICT, rank: { weight: EXP_WEIGHT, minExp: EXP_MIN, count: BEST }, texts, jobs, maps,
      source: 'js/jobfit.js (docs/game-bible-online-plan.md decision 3: advice only, no bonus)' };
  }

  let web = null; // (the web's source, built once every script has loaded)
  NC.JobFit = {
    LEVEL_GAP, AREA, VERDICT, EL_TH, fromWorld, fromNC, profile, rosterOf, digest, fit, top, levelGap, gapMul, mapExp, best, table,
    web: () => web || (NC.JOBS && NC.MAPS ? (web = fromNC(NC)) : null),
  };
})();
