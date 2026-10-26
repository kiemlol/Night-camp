/* weapons.js — the weapon system of the plan "คลังอาวุธ Night Camp" (approved 2026-09-28):
   - every weapon has a type (NC.WTYPES: 30 of them; one- or two-handed, a pair, melee or not) and every job a list of
     the types it can hold (a 2nd job keeps its 1st job's and unlocks its own: NC.JOB_WEAPONS); a shield goes in the off
     hand (equip.shield) only with a one-handed weapon, and never for the archer family or the reaper; a one-handed
     melee weapon with the other hand free: attack speed +5%
   - skills are bound to weapons (NC.WEAPON_RULES, "n:" what they need, "b:" what gives a bonus; tokens: a weapon type,
     shield, oneh (a one-handed melee weapon), free (one-handed, no shield), melee). With the wrong weapon a skill
     counts as level 0: its passive stops and it can't be cast ("ใช้กับอาวุธนี้ไม่ได้"); the skill window and the
     hotbar grey it out and say what it needs; a buff bound to a weapon ends when that weapon goes. A bonus: k (x damage
     of the skill's hits), cast (x its cast time)
   - two weapon sets (weapon + shield), swapped with G (X is sitting down, rest.js)
   - a job's lane weapons: a hero who owns nothing of a type the job can hold gets that type's basic one (every lane
     is playable from the start; better ones come from drops later), and a buckler if the job carries shields
   Skill levels: NC.skillLv answers 0 for a locked skill; the bookkeeping (points, needs, resonance, the hotbar, the skill
   window) reads the learned level (NC.skillRaw). Loaded after skillpoints.js and skillui.js; the new jobs' files add
   their own rules with NC.weaponRule. */
(function () {
  'use strict';
  const NC = window.NC, SK = NC.SKILLS, FX = NC.FX, ITEMS = NC.ITEMS, HUD = NC.HUD;

  // ---------------- weapon types ----------------
  // h: 1 one-handed / 2 two-handed; pair: one in each hand; m: melee
  const WT = (NC.WTYPES = {
    sword: { name: 'ดาบ', h: 1, m: 1 }, gsword: { name: 'ดาบใหญ่', h: 2, m: 1 }, spear: { name: 'หอก', h: 1, m: 1 },
    lance: { name: 'หอกยาว', h: 2, m: 1 }, axe: { name: 'ขวาน', h: 1, m: 1 }, gaxe: { name: 'ขวานยักษ์', h: 2, m: 1 },
    hammer: { name: 'ค้อนยักษ์', h: 2, m: 1 }, mace: { name: 'กระบอง', h: 1, m: 1 }, dagger: { name: 'มีดคู่', h: 2, pair: 1, m: 1 },
    katar: { name: 'คาทาร์', h: 2, pair: 1, m: 1 }, bow: { name: 'ธนู', h: 2 }, xbow: { name: 'หน้าไม้', h: 2 },
    staff: { name: 'คทา', h: 2 }, orb: { name: 'ออร์บ', h: 1 }, lantern: { name: 'ตะเกียง', h: 2 }, book: { name: 'คัมภีร์', h: 1, m: 1 },
    knuckle: { name: 'สนับมือ', h: 2, pair: 1, m: 1 }, qstaff: { name: 'ไม้พลอง', h: 2, m: 1 }, huuma: { name: 'ดาวยักษ์', h: 2, m: 1 },
    dsword: { name: 'ดาบคู่', h: 2, pair: 1, m: 1 }, bell: { name: 'กระดิ่งวิญญาณ', h: 1 }, instrument: { name: 'เครื่องดนตรี', h: 2 },
    whip: { name: 'แส้', h: 1, m: 1 }, pistol: { name: 'ปืนพกคู่', h: 2, pair: 1 }, shotgun: { name: 'ลูกซอง', h: 2 },
    scythe: { name: 'เคียวใหญ่', h: 2, m: 1 }, sickle: { name: 'เคียวคู่', h: 2, pair: 1, m: 1 }, puppet: { name: 'ไม้เชิดหุ่น', h: 1 },
    wire: { name: 'ด้ายเหล็ก', h: 2, pair: 1, m: 1 }, torch: { name: 'คบเพลิง', h: 1, m: 1 },
  });
  // the weapons from before the types (the new ones carry wtype themselves); anything else by its style
  const OLD = { sword: 'sword', spear: 'lance', axe: 'axe', hammer: 'hammer', greatsword: 'gsword', bow: 'bow', dagger: 'dagger',
    staff: 'staff', staff_moon: 'staff', staff_lantern: 'lantern', staff_bo: 'qstaff', staff_holy: 'staff' };
  const BY_STYLE = { swing: 'sword', thrust: 'lance', smash: 'hammer', bolt: 'staff', arrow: 'bow' };
  const typeOfItem = (it) => it.wtype || OLD[it.id] || (it.dual ? 'dagger' : it.style === 'swing' && it.twoHanded ? 'gsword' : BY_STYLE[it.style]) || 'sword';
  for (const id in ITEMS) if (ITEMS[id].slot === 'weapon') ITEMS[id].wtype = typeOfItem(ITEMS[id]);
  NC.wtypeOf = (W) => (W ? W.wtype || typeOfItem(W) : 'sword');
  const twoHanded = (W) => !!W && (WT[NC.wtypeOf(W)] || {}).h === 2;
  NC.SLOT_NAME.shield = 'โล่';

  // ---------------- what each job can hold ----------------
  const JW = (NC.JOB_WEAPONS = {
    knight: ['sword', 'gsword', 'spear', 'axe'], paladin: ['mace'], dragonknight: ['lance'], berserker: ['gaxe', 'hammer'], swordmaster: ['dsword'],
    mage: ['staff', 'orb'], archmage: [], warlock: ['lantern'], firemage: [], icemage: [],
    archer: ['bow'], ranger: ['xbow'], wolfhunter: [], bard: ['instrument', 'whip'], gunslinger: ['pistol', 'shotgun'],
    rogue: ['dagger', 'sword'], assassin: ['katar'], shinobi: ['huuma'], reaper: ['scythe', 'sickle'], puppeteer: ['puppet', 'wire'],
    priest: ['staff', 'mace'], bishop: ['book'], monk: ['knuckle', 'qstaff'], lightkeeper: ['torch'], wisp: ['bell'],
  });
  const FIRST = ['knight', 'mage', 'archer', 'rogue', 'priest'];
  const NO_SHIELD = new Set(['archer', 'ranger', 'wolfhunter', 'bard', 'gunslinger', 'reaper']);
  NC.jobWeaponTypes = function (job) {
    const J = NC.JOBS[job];
    if (!J || !J.tier) return new Set([...FIRST.flatMap((j) => JW[j]), 'lance']); // a traveler: any 1st job's (and the starting spear)
    return new Set(NC.jobLine(job).flatMap((j) => JW[j] || [])); // (a 2nd / class-3 job also holds its earlier jobs' types)
  };
  NC.jobShield = (job) => { const J = NC.JOBS[job]; return J && J.tier === 3 ? NC.jobShield(J.from) : !NO_SHIELD.has(job); };
  const jobName = (p) => (NC.JOBS[p.job] || NC.JOBS.traveler).name;
  NC.canWield = function (p, id) {
    const it = ITEMS[id];
    if (!it) return false;
    if (it.slot === 'weapon') { const s = NC.jobWeaponTypes(p.job); return !s.size || s.has(NC.wtypeOf(it)); }
    if (it.slot === 'shield') return NC.jobShield(p.job);
    return true;
  };

  // ---------------- what is in hand (cached per weapon + shield) ----------------
  let loKey = null, lo = null;
  function loadout(p) {
    const e = p.equip || {}, key = (e.weapon || '') + '|' + (e.shield || '');
    if (key !== loKey) {
      loKey = key;
      const W = ITEMS[e.weapon], t = NC.wtypeOf(W);
      lo = { t, T: WT[t] || {}, sh: !!(e.shield && ITEMS[e.shield] && !twoHanded(W)) };
    }
    return lo;
  }
  NC.weaponLoadout = (p) => loadout(p);

  // ---------------- the rules ----------------
  const RULES = (NC.WEAPON_RULES = {});
  // NC.weaponRule(id, 'n:sword,gsword b:gsword', { k: 1.2, cast: 0.9, note: '...' })
  NC.weaponRule = function (id, text, extra) {
    const o = { n: [], b: [] };
    for (const part of String(text || '').split(' ').filter(Boolean)) { const [k, v] = part.split(':'); if (o[k] && v) o[k] = v.split(','); }
    RULES[id] = Object.assign(o, extra || {});
  };
  const match = (tok, L) => (tok === 'shield' ? L.sh : tok === 'oneh' ? L.T.h === 1 && !!L.T.m : tok === 'free' ? L.T.h === 1 && !L.sh : tok === 'melee' ? !!L.T.m : L.t === tok);
  const isHero = (p) => !!p && p.kind === 'player' && !!p.equip;
  NC.weaponOk = (p, id) => { const R = RULES[id]; return !R || !R.n.length || !isHero(p) || R.n.some((t) => match(t, loadout(p))); };
  NC.weaponBonus = (p, id) => { const R = RULES[id]; return !!R && R.b.length > 0 && isHero(p) && NC.weaponOk(p, id) && R.b.some((t) => match(t, loadout(p))); };
  const LABEL = { shield: 'โล่', oneh: 'อาวุธมือเดียว', free: 'อาวุธมือเดียว (ไม่ถือโล่)', melee: 'อาวุธประชิด' };
  const tokName = (t) => LABEL[t] || (WT[t] ? WT[t].name : t);
  NC.weaponNeedText = (id) => { const R = RULES[id]; return R && R.n.length ? R.needText || R.n.map(tokName).join(' หรือ ') : ''; };
  // the windows' ✔ / ✕: the rule, and a passive's own condition when it is narrower than the rule (R.works: kn_swordmastery
  // counts at level for its milestones with any melee weapon, its numbers only with a swing weapon that is not a pair)
  NC.weaponWorks = (p, id) => { const R = RULES[id]; return NC.weaponOk(p, id) && !(R && R.works && isHero(p) && !R.works(p)); };
  NC.weaponBonusText = (id) => { const R = RULES[id]; return R && R.b.length ? R.b.map(tokName).join(' / ') + (R.note ? ': ' + R.note : '') : ''; };

  // the plan's rules for the jobs that were there before (the new jobs' files add their own)
  const R = NC.weaponRule;
  // knight
  R('bash', 'b:free', { k: 1.2, note: 'แรงขึ้น 20%' });
  R('kn_bowling', 'b:gsword', { k: 1.8, note: 'โดน 2 ครั้ง' });
  R('kn_swordmastery', 'n:melee', { needText: 'ดาบ ดาบใหญ่ ขวาน หรือกระบอง (ไม่นับดาบคู่)', // (Discord #147; the server: skills_mods.go passiveMods)
    works: (p) => { const W = ITEMS[p.equip && p.equip.weapon]; return !!W && W.style === 'swing' && !W.dual; } });
  R('kn_single', 'n:free');
  R('kn_quicken', 'n:sword,gsword b:gsword', { note: 'ได้ผลเต็ม (ดาบมือเดียวได้ครึ่งเดียว)' });
  R('kn_cleave', 'b:gsword', { k: 1.3, note: 'กวาดแรงขึ้น 30%' });
  R('guard', 'n:shield');
  R('kn_ironskin', 'b:shield', { note: 'DEF จากสกิลนี้ ×1.5' });
  R('kn_pierce', 'n:spear,lance');
  // paladin
  R('pal_holyblade', 'n:oneh b:mace', { k: 1.2, note: 'แสงแรงขึ้น 20%' });
  R('pal_zeal', 'n:oneh'); R('pal_faithblade', 'n:oneh');
  R('pal_shieldchain', 'n:shield'); R('pal_aegis', 'n:shield'); R('pal_reflect', 'n:shield');
  R('pal_bulwark', 'b:shield', { note: 'รับดาเมจลดลงอีก 5%' });
  // dragon knight
  R('dk_thrust', 'n:spear,lance b:lance', { k: 1.2, note: 'แรงขึ้น 20%' });
  R('dk_spiral', 'n:spear,lance b:lance', { k: 1.2, note: 'แรงขึ้น 20%' });
  R('dk_spearmastery', 'n:spear,lance'); R('dk_quicken', 'n:lance'); R('dk_tail', 'n:spear,lance');
  R('dk_breath', 'b:shield', { k: 1.1, note: 'ไฟแรงขึ้น 10%' });
  // mage (the staff: stronger and quicker spells; the orb: the auto line)
  for (const id of ['fireball', 'frostdiver', 'thunder']) R(id, 'b:staff', { k: 1.08, cast: 0.9, note: 'MATK +8% ร่ายเร็วขึ้น 10%' });
  for (const id of ['mg_firewall', 'mg_frostnova']) R(id, 'b:staff', { cast: 0.9, note: 'ร่ายเร็วขึ้น 10%' });
  R('meteor', 'b:staff', { cast: 0.85, note: 'ร่ายเร็วขึ้น 15%' });
  R('mg_autospell', 'b:orb', { note: 'โอกาสร่าย ×1.5' });
  // archmage / warlock
  R('am_overcharge', 'b:staff', { note: 'ผลคีย์สโตนแรงขึ้น 25%' });
  R('am_doublecast', 'b:orb', { note: 'โอกาส ×1.5' });
  R('am_arcaneflux', 'n:orb');
  for (const id of ['wl_swing', 'wl_drain', 'wl_blaze']) R(id, 'n:lantern');
  for (const id of ['wl_chains', 'wl_hex']) R(id, 'b:staff,orb', { k: 1.15, note: 'แรงขึ้น 15%' });
  for (const id of ['wl_wisps', 'wl_lantern']) R(id, 'b:lantern', { note: 'ซัมมอนแรงขึ้น 20%' });
  // archer family: every shot needs a bow
  for (const id of ['ar_bowmastery', 'ar_doubleshot', 'double', 'ar_charge', 'starshot', 'shower', 'ar_multishot', 'gale',
    'rg_fearbreeze', 'rg_triple', 'rg_piercer', 'rg_storm', 'wh_autoblitz', 'wh_wolfrush', 'wh_fang', 'wh_huntmastery']) R(id, 'n:bow');
  R('rg_unlimit', 'n:bow,xbow'); R('rg_focus', 'n:bow,xbow');
  R('rg_snipe', 'n:bow,xbow b:xbow', { k: 1.3, note: 'ทะลุ ดาเมจแรงขึ้น 30%' });
  R('rg_eagle', 'b:xbow', { note: 'ดาเมจคริ +15%' });
  // rogue family
  for (const id of ['ro_double', 'ro_dagger', 'ro_vital']) R(id, 'n:dagger');
  R('ro_backstab', 'b:dagger', { k: 1.2, note: 'แรงขึ้น 20%' });
  R('as_haste', 'n:dagger,katar'); R('as_katar', 'n:dagger,katar'); R('as_twin', 'n:katar');
  R('as_edp', 'b:dagger', { note: 'พิษติดจากทั้งสองมือ' });
  R('sh_throwing', 'b:huuma', { k: 1.25, note: 'ชูริเคนแรงขึ้น 25%' });
  R('sh_huuma', 'n:huuma'); R('sh_shuriken', 'n:huuma');
  // priest family
  R('pr_heal', 'b:staff', { note: 'ฮีล +10%' }); R('bi_heal', 'b:staff', { note: 'ฮีล +10%' });
  R('holylight', 'b:staff', { k: 1.08, note: 'MATK +8%' });
  R('magnus', 'b:staff', { cast: 0.9, note: 'ร่ายเร็วขึ้น 10%' });
  R('pr_macemastery', 'n:mace');
  R('pr_duple', 'b:mace', { note: 'โอกาส +50%' });
  R('bi_turnundead', 'b:book', { k: 1.25, note: 'ใช้ ATK+MATK แรงขึ้น' });
  R('bi_battlehymn', 'n:mace,book'); R('bi_mercy', 'n:mace,book');
  R('mo_triple', 'b:knuckle', { note: 'โอกาส ×1.5' });
  R('mo_palms', 'b:knuckle', { k: 1.2, note: 'แรงขึ้น 20%' });
  R('mo_combo', 'n:knuckle');
  R('mo_fury', 'b:knuckle', { note: 'ความเร็วโจมตีอีก +10%' });
  R('mo_chi', 'b:qstaff', { k: 1.15, note: 'แรงขึ้น 15%' });
  R('mo_impact', 'b:mace', { k: 1.2, note: 'แรงขึ้น 20%' });
  R('mo_ironfist', 'b:mace,qstaff', { note: 'ATK +5%' });

  // ---------------- skill levels: 0 while locked (the bookkeeping reads the learned level) ----------------
  const rawLv = NC.skillLv;
  NC.skillRaw = rawLv;
  let raw = 0;
  NC.skillLv = function (p, id) {
    const lv = rawLv(p, id);
    return lv > 0 && !raw && RULES[id] && !NC.weaponOk(p, id) ? 0 : lv;
  };
  const rawMode = (f) => function () { raw++; try { return f.apply(this, arguments); } finally { raw--; } };
  for (const k of ['skillLeft', 'raiseSkill', 'skillReqMet', 'lineInfo', 'skillForKey', 'skillUsable', 'defaultHotbar', 'autoSlot', 'hotbarOf'])
    if (typeof NC[k] === 'function') NC[k] = rawMode(NC[k]);
  NC.skillLocked = ((base) => (p, id) => (!!base && base(p, id)) || !NC.weaponOk(p, id))(NC.skillLocked);

  // passives of a locked skill stop
  const baseMods = NC.skillMods;
  NC.skillMods = function (p) {
    if (!isHero(p) || !p.skills) return baseMods(p);
    let s1 = null;
    for (const id in p.skills) if (p.skills[id] > 0 && RULES[id] && !NC.weaponOk(p, id)) (s1 = s1 || Object.assign({}, p.skills))[id] = 0;
    if (!s1) return baseMods(p);
    const s0 = p.skills;
    p.skills = s1;
    try { return baseMods(p); } finally { p.skills = s0; }
  };

  // casting a locked skill: refused, saying what it needs
  let warnT = -9;
  const baseCast = NC.castSkill;
  NC.castSkill = function (game, p, key) {
    if (game && p && p === game.player) {
      const id = NC.skillForKey(p, key);
      if (id && !NC.weaponOk(p, id)) {
        if (game.time - warnT > 1) {
          warnT = game.time;
          FX.num(p.x, p.y - 180, 'ใช้กับอาวุธนี้ไม่ได้', { fill: '#ffb0a0', size: 28 });
          HUD.log(`${SK[id].name}: ใช้กับอาวุธนี้ไม่ได้ · ต้องถือ${NC.weaponNeedText(id)}`, 'warn');
        }
        return false;
      }
    }
    return baseCast.apply(this, arguments);
  };

  // the bonuses: harder hits, quicker casts
  const baseHH = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHH.apply(this, arguments), G = NC.game, p = G && G.player;
    if (!p || d !== p.d || !(r.dmg > 0) || !o || !o.sid) return r;
    const Rk = RULES[o.sid];
    if (Rk && Rk.k && NC.weaponBonus(p, o.sid)) r.dmg = Math.max(1, Math.round(r.dmg * Rk.k));
    return r;
  };
  if (NC.castTime) {
    const baseCT = NC.castTime;
    NC.castTime = function (p, id, lv) {
      const t = baseCT.apply(this, arguments), Rk = RULES[id];
      return t > 0 && Rk && Rk.cast && NC.weaponBonus(p, id) ? t * Rk.cast : t;
    };
  }

  // ---------------- gear: the shield's stats, the free hand ----------------
  const baseGear = NC.gearStats;
  NC.gearStats = function (equip) {
    const st = baseGear.apply(this, arguments), sh = equip && equip.shield && ITEMS[equip.shield];
    if (sh && sh.stats && !twoHanded(ITEMS[equip.weapon])) for (const k in sh.stats) st[k] = (st[k] || 0) + sh.stats[k];
    return st;
  };
  const baseDerive = NC.derive;
  NC.derive = function (p) {
    const d = baseDerive.apply(this, arguments);
    if (!isHero(p)) return d;
    const L = loadout(p);
    let k = 0;
    if (L.T.h === 1 && L.T.m && !L.sh) k += 5; // one hand free
    if (NC.isJob(p, 'paladin') && !L.sh) k += 10; // (the plan: the paladin's holy lane, no shield)
    if (k) { d.aspdMul = Math.min(NC.ASPD_CAP, d.aspdMul * (1 + k / 100)); d.aspd = NC.aspdShown(ITEMS[p.equip.weapon], d.aspdMul); }
    d.wtype = L.t; d.shield = L.sh;
    return d;
  };

  // ---------------- equipping ----------------
  function say(game, text) {
    const p = game.player;
    FX.num(p.x, p.y - 180, text, { fill: '#ffb0a0', size: 26 });
    HUD.log(text, 'warn');
  }
  function remember(p) {
    if (!Array.isArray(p.wsets)) p.wsets = [null, null];
    p.wset = p.wset === 1 ? 1 : 0;
    p.wsets[p.wset] = { weapon: p.equip.weapon, shield: p.equip.shield || null };
  }
  // after the weapon changed: a two-handed one puts the shield away; buffs bound to the old weapon end
  function weaponChanged(game, p) {
    if (p.equip.shield && twoHanded(ITEMS[p.equip.weapon])) { p.equip.shield = null; HUD.log('อาวุธสองมือ: เก็บโล่ไว้ก่อน', 'sys'); }
    for (const id in p.buffs || {})
      if (p.buffs[id] > 0 && RULES[id] && RULES[id].n.length && !NC.weaponOk(p, id)) { p.buffs[id] = 0; HUD.log(`${SK[id] ? SK[id].name : id} หมดผล (เปลี่ยนอาวุธ)`, 'sys'); }
    remember(p);
    NC.applyGear(game);
  }
  NC.weaponChanged = weaponChanged;
  const baseEquip = NC.equip;
  NC.equip = function (game, id) {
    const p = game.player, it = ITEMS[id];
    if (!it || !p.owned.has(id) || !NC.itemReady(id)) return baseEquip.apply(this, arguments);
    if (it.slot === 'shield') {
      if (p.equip.shield === id) p.equip.shield = null; // clicking the carried one puts it away
      else {
        if (!NC.jobShield(p.job)) return say(game, `${jobName(p)}ถือโล่ไม่ได้`);
        if (twoHanded(ITEMS[p.equip.weapon])) return say(game, `ถือ${WT[NC.wtypeOf(ITEMS[p.equip.weapon])].name}อยู่ (สองมือ) ถือโล่ไม่ได้`);
        p.equip.shield = id;
      }
      p.fresh.delete(id);
      remember(p);
      NC.applyGear(game);
      FX.stars(p.x, p.y - 70, 10, NC.RARITY[it.rarity].rgb, { speed: 200, size: 0.8 });
      NC.saveGame(game);
      return;
    }
    if (it.slot === 'weapon' && !NC.canWield(p, id)) return say(game, `${jobName(p)}ใช้${WT[NC.wtypeOf(it)].name}ไม่ได้`);
    const was = p.equip.weapon;
    baseEquip.apply(this, arguments);
    if (it.slot === 'weapon' && p.equip.weapon !== was) { weaponChanged(game, p); NC.saveGame(game); }
  };
  // a class look puts on its weapon only if the job can hold it
  const baseClass = NC.equipClass;
  NC.equipClass = function (game, cid) {
    const p = game.player, was = p.equip.weapon;
    baseClass.apply(this, arguments);
    if (!NC.canWield(p, p.equip.weapon)) p.equip.weapon = NC.canWield(p, was) ? was : bestWeapon(p) || p.equip.weapon;
    if (p.equip.weapon !== was || (p.equip.shield && twoHanded(ITEMS[p.equip.weapon]))) { weaponChanged(game, p); NC.saveGame(game); }
  };
  // the weapon to fall back on: the job's class weapon, else the first one it can hold
  function bestWeapon(p) {
    const J = NC.JOBS[p.job] || {}, C = NC.CLASSES.find((c) => c.id === J.cls), cw = C && C.items && C.items.weapon;
    if (cw && p.owned.has(cw) && NC.canWield(p, cw)) return cw;
    return [...p.owned].find((id) => ITEMS[id] && ITEMS[id].slot === 'weapon' && NC.canWield(p, id) && NC.itemReady(id)) || null;
  }

  // ---------------- every lane's weapon ----------------
  const STARTER = (NC.STARTER_WEAPONS = { sword: 'sword', gsword: 'greatsword', spear: 'spear_short', lance: 'spear', axe: 'axe', gaxe: 'greataxe',
    hammer: 'hammer', mace: 'mace', dagger: 'dagger', katar: 'katar', bow: 'bow', xbow: 'crossbow', staff: 'staff', orb: 'orb', lantern: 'staff_lantern',
    book: 'holybook', knuckle: 'knuckle', qstaff: 'staff_bo', huuma: 'huuma', dsword: 'twinswords', bell: 'spiritbell', instrument: 'lute', whip: 'whip',
    pistol: 'pistols', shotgun: 'shotgun', scythe: 'scythe', sickle: 'sickles', puppet: 'puppetbar', wire: 'steelwire', torch: 'torch' });
  function grantStarters(game, p) {
    const J = NC.JOBS[p.job];
    if (!J || !J.tier) return [];
    const owns = (test) => [...p.owned].some((o) => ITEMS[o] && test(ITEMS[o]));
    const got = [];
    const give = (id) => { if (ITEMS[id] && NC.itemReady(id) && !p.owned.has(id)) { p.owned.add(id); p.fresh.add(id); got.push(ITEMS[id].name); } };
    for (const t of NC.jobWeaponTypes(p.job)) if (!owns((it) => it.slot === 'weapon' && NC.wtypeOf(it) === t)) give(STARTER[t]);
    if (NC.jobShield(p.job) && !owns((it) => it.slot === 'shield')) give('buckler');
    if (got.length && HUD.log) HUD.log(`ได้รับอาวุธประจำสาย: ${got.join(' · ')} (กด I เพื่อถือ · G สลับชุดอาวุธ)`, 'item');
    return got;
  }
  NC.grantLaneWeapons = grantStarters;
  const baseChange = NC.changeJob;
  NC.changeJob = function (p, id) {
    const ok = baseChange.apply(this, arguments);
    if (ok && NC.game && p === NC.game.player) grantStarters(NC.game, p);
    return ok;
  };
  // a weapon the job can no longer hold (a save from before the types): the job's own
  function fixWeapon(game, p) {
    if (NC.canWield(p, p.equip.weapon)) return;
    const w = bestWeapon(p), old = ITEMS[p.equip.weapon];
    if (!w) return;
    p.equip.weapon = w;
    HUD.log(`${jobName(p)}ใช้${old ? old.name : 'อาวุธเดิม'}ไม่ได้แล้ว เปลี่ยนเป็น${ITEMS[w].name}`, 'sys');
  }

  // ---------------- two weapon sets (G) ----------------
  NC.swapWeapons = function (game) {
    const p = game && game.player;
    if (!p || p.dead > 0 || game.paused || !p.equip) return;
    if ((p.wswapT || 0) > game.time) return;
    p.wswapT = game.time + 0.4;
    remember(p);
    const next = 1 - p.wset, set = p.wsets[next];
    const label = (s) => (ITEMS[s.weapon] ? ITEMS[s.weapon].name : '-') + (s.shield && ITEMS[s.shield] ? ' + ' + ITEMS[s.shield].name : '');
    if (!set || !set.weapon) {
      p.wsets[next] = Object.assign({}, p.wsets[p.wset]);
      p.wset = next;
      HUD.log(`ชุดอาวุธ ${next + 1} พร้อมแล้ว: เปลี่ยนอาวุธหรือโล่ในกระเป๋า (I) ชุดนี้จะจำไว้ · กด G สลับชุด`, 'sys');
      FX.num(p.x, p.y - 180, `ชุดอาวุธ ${next + 1}`, { fill: '#ffe28a', size: 28 });
      NC.saveGame(game);
      return;
    }
    if (set.weapon && p.owned.has(set.weapon) && NC.canWield(p, set.weapon) && NC.itemReady(set.weapon)) p.equip.weapon = set.weapon;
    p.equip.shield = set.shield && p.owned.has(set.shield) && NC.jobShield(p.job) && !twoHanded(ITEMS[p.equip.weapon]) ? set.shield : null;
    p.wset = next;
    weaponChanged(game, p);
    FX.num(p.x, p.y - 180, `ชุดอาวุธ ${next + 1}`, { fill: '#ffe28a', size: 28 });
    FX.stars(p.x, p.y - 70, 8, '255,230,150', { speed: 180, size: 0.7 });
    HUD.log(`ชุดอาวุธ ${next + 1}: ${label(p.wsets[next])}`, 'sys');
    NC.saveGame(game);
  };
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyG' || e.repeat) return;
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const game = NC.game;
    if (game && game.player && !game.paused) NC.swapWeapons(game);
  });

  // ---------------- saving: the shield rides in equip; the sets in the extra record ----------------
  const KEY = 'nightcamp.save.v1', EXT = (NC.EXT_KEY = 'nightcamp.ext.v1');
  NC.extRead = () => { try { return JSON.parse(localStorage.getItem(EXT) || '{}') || {}; } catch (e) { return {}; } };
  NC.extWrite = (patch) => { try { localStorage.setItem(EXT, JSON.stringify(Object.assign(NC.extRead(), patch))); } catch (e) { /* storage blocked */ } };
  (NC.saveHooks || (NC.saveHooks = [])).push((game) => {
    if (game.noSave) return;
    const p = game.player;
    NC.extWrite({ wsets: p.wsets || null, wset: p.wset || 0 });
  });
  (NC.loadHooks || (NC.loadHooks = [])).push((game, params) => {
    const p = game.player, fresh = NC.ONLINE;
    let s = null;
    if (!fresh) { try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; } }
    const x = fresh ? {} : NC.extRead();
    const sh = s && s.equip && s.equip.shield;
    p.equip.shield = sh && ITEMS[sh] && ITEMS[sh].slot === 'shield' && p.owned.has(sh) ? sh : null;
    p.wsets = Array.isArray(x.wsets) ? x.wsets.slice(0, 2).map((w) => (w && typeof w.weapon === 'string' ? { weapon: w.weapon, shield: w.shield || null } : null)) : [null, null];
    while (p.wsets.length < 2) p.wsets.push(null);
    p.wset = x.wset === 1 ? 1 : 0;
    grantStarters(game, p);
    fixWeapon(game, p);
    if (p.equip.shield && (!NC.jobShield(p.job) || twoHanded(ITEMS[p.equip.weapon]))) p.equip.shield = null;
    remember(p);
    NC.applyGear(game);
    p.hp = p.maxHp; p.sp = p.maxSp;
  });

  // ---------------- the HUD: skills the weapon in hand can't use, greyed on the hotbar ----------------
  const css = document.createElement('style');
  css.textContent = `
    .hslot.wlock img { filter: grayscale(1) brightness(0.55); }
    .hslot.wlock::after { content: '⚔'; position: absolute; right: 3px; top: 1px; font-size: 13px; color: #ff9f8c; text-shadow: 0 1px 2px #000; pointer-events: none; }
  `;
  document.head.appendChild(css);
  const baseHotbar = HUD.updateHotbar;
  HUD.updateHotbar = function (p) {
    raw++;
    try { baseHotbar.apply(this, arguments); } finally { raw--; }
    for (const k of NC.HOTKEYS) {
      const slot = document.getElementById('hs-' + k);
      if (!slot) continue;
      const id = NC.skillForKey(p, k), lock = !!id && !NC.weaponOk(p, id);
      if (slot.classList.contains('wlock') !== lock) slot.classList.toggle('wlock', lock);
    }
  };
})();
