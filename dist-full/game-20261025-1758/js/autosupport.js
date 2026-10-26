/* autosupport.js — โหมดซัพพอร์ต: the AUTO's second mode, for the support jobs (priest, bishop, lightkeeper, wisp shepherd
   and their class 3; NC.isSupportJob, js/partysupport.js). The user, 2026-10-18: "ทำระบบ พระโหมดซับพอท ... แบบออโต้
   เลือกเป็นโหมด ซับก็จะล็อกเดินตาม แล้วใช้สกิลซับใส่อย่างเดียว".
     the mode     the AUTO window (Z / the AUTO button, js/autofarm.js + js/p3_autofarm.js) gets a switch ฟาร์ม | ซัพพอร์ต
                  in its title bar; in ซัพพอร์ต its four cards are this file's (who, how close, the skills, potions)
     the lock     one party member to stay with: picked on a card, or a click on their hero → "ตามซัพคนนี้"
                  (js/playermenu.js), or อัตโนมัติ (the party leader, else the nearest); a lock mark over their head
     follow       stays behind them at the distance picked (ชิด 150 / ใกล้ 250 / เว้นระยะ 380) on the auto farm's paths;
                  a friend on another map: walks after them through the warps (NC.Travel, js/autotravel.js), then on
     skills       ONLY the support skills on the hotbar, never a swing or an attack skill, in this order:
                    ชุบ   a fallen member (the locked one first), walking up to them
                    ฮีล   whoever is under the HP line picked (50 / 70 / 90%; the locked friend counts a little lower),
                          the priest himself too; walks nearer when they are out of the heal's reach
                    โล่   the wisp's embrace on latched friends; ม่านแสง (bi_barrier) while a fight is on
                    บัฟ   a party buff when the priest's own has run out (with the friend in reach), or when a member in
                          reach was not there for the last cast (a newcomer, a friend just raised)
                  a slot can be switched off on the card; SP is kept back for the heals while buffing
     rest         potions at the auto farm's lines; sits down when SP / HP is low and the friend stands still, up again
                  when they move off or someone needs him
     ซัพ+ตี    (2026-10-19, SET.supFight, the user: "เพิ่มตัวเลือก ซัพ + ช่วยตี ในโหมดซัพพอร์ตเลย (ฮีล/บัฟก่อน ว่างแล้วช่วยตีมอน
               รอบเพื่อน เก็บ SP ไว้ฮีล)"): with nobody to raise, heal or buff and the friend close by, drive() hands the
               frame back to the auto farm with out.fight = the friend's spot: it fights only monsters round the friend (the
               ones after a party member first), its attack skills keep the SP of two heals (one with blue potions on) and
               the attack slots switched off here (supOff) stay off; the follow lets him stray to FIGHT_LEASH while he fights
   Plugs in from the outside: js/autofarm.js asks NC.AutoSupport.active() / drive() each frame (its A.kit walks), and
   js/p3_autofarm.js draws this file's cards (NC.AutoSupport.cards) in support mode; NC.Auto.toggle (a press while walking
   after a friend stops the walk), NC.Party.drawTags (the lock mark), NC.PlayerMenu.more / acts (the menu line),
   NC.PartyNet.where (where a member is, js/partynet.js and js/online/social.js), NC.skillCasts (who a buff reached),
   NC.HUD.init / update. Settings go with the auto farm's (localStorage nightcamp.auto.v1): mode, supLock, supDist,
   supHeal, supWarp, supOff, supFight. Online the server heals and buffs the party (backend heals.go, party_support.go): the keys
   are pressed the same way. Test: ?aiparty (the test-only AI friends) or two ?netmock tabs in one party. */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC || !NC.Auto || !NC.Auto.kit) return;
  const A = NC.Auto, SET = A.set, K = A.kit, dist = NC.dist;
  const $ = (id) => document.getElementById(id);
  const KEY = 'nightcamp.auto.v1';
  const DEF = { mode: 'farm', supLock: '', supDist: 'mid', supHeal: 0.7, supWarp: true, supOff: [], supFight: false };
  for (const k in DEF) if (SET[k] === undefined) SET[k] = Array.isArray(DEF[k]) ? DEF[k].slice() : DEF[k];
  if (!Array.isArray(SET.supOff)) SET.supOff = [];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(SET)); } catch (e) { /* storage blocked */ } };
  const DIST = { close: 150, mid: 250, far: 380 };
  const HEAL_R = 340, RAISE_R = 380, LOOK_R = 1000, BUFF_R = 520;
  const FIGHT_R = 380, FIGHT_LEASH = 520; // (ซัพ+ตี: monsters within FIGHT_R of the friend · how far he may stray while fighting)
  const online = () => !!(NC.Online && NC.Online.enabled);
  const mapName = (id) => ((NC.MAPS || {})[id] || {}).name || id || '';
  const jobName = (j) => ((NC.JOBS || {})[j] || {}).name || '';
  const PN = () => NC.PartyNet;

  const AS = (NC.AutoSupport = { lock: null });
  AS.supportJob = (job) => !!(NC.isSupportJob && NC.isSupportJob(job));
  // support mode is on: the switch says so, the hero is a support job, and the quest's AUTO is not the one driving
  AS.active = (game) => {
    const p = game && game.player;
    return !!(p && SET.mode === 'support' && AS.supportJob(p.job) && !(NC.QuestAuto && NC.QuestAuto.on));
  };

  // ---------------- the members: who is in my party, where, how they are ----------------
  // a view of each: key (their peer id; ai:<i> for the test-only AI friends), ref (their hero on my map), name, job, lv,
  // map, x, y, hp (0..1), dead, face, here (on my map), equip, leader, moving
  const motion = new Map(); // key -> { x, y, t, v }
  function mates(game) {
    const list = [], pn = PN(), others = pn && pn.others ? pn.others() : [];
    const lead = pn && pn.roster && pn.roster() ? pn.roster().lead : null;
    for (const peer of others) {
      const w = pn.where ? pn.where(peer) : null, r = NC.Net && NC.Net.remotes.get(peer);
      const here = !!(r && r.map === game.mapId && !r.gwHide);
      list.push({
        key: peer, ref: here ? r : null, name: (r && r.name) || (w && w.name) || (pn.nameOf ? pn.nameOf(peer) : 'เพื่อน'),
        job: (r && r.job) || (w && w.job) || '', lv: (r && r.lv) || (w && w.lv) || 0,
        map: here ? game.mapId : (w && w.map) || (r && r.map) || null,
        x: here ? r.x : w ? w.x : null, y: here ? r.y : w ? w.y : null,
        hp: here ? (typeof r.hpPct === 'number' ? r.hpPct / 100 : 1) : w ? w.hp : 1,
        dead: here ? !!(r.dd || r.dead > 0) : !!(w && w.dead), face: here ? r.face || 1 : 1, here, equip: r && r.equip, leader: lead === peer,
      });
    }
    ((NC.Party && NC.Party.members) || []).forEach((a, i) => list.push({
      key: 'ai:' + i, ref: a, name: a.name || 'เพื่อน', job: a.job || '', lv: a.lv || 0, map: game.mapId, x: a.x, y: a.y,
      hp: a.maxHp ? a.hp / a.maxHp : 1, dead: a.dead > 0, face: a.face || 1, here: true, equip: a.equip, ai: true,
    }));
    for (const m of list) {
      if (!m.here || m.x == null) continue;
      const s = motion.get(m.key);
      if (!s) { motion.set(m.key, { x: m.x, y: m.y, t: game.time, v: 0 }); continue; }
      if (game.time - s.t >= 0.25) { s.v = dist(s.x, s.y, m.x, m.y) / (game.time - s.t); s.x = m.x; s.y = m.y; s.t = game.time; }
      m.moving = s.v > 40;
    }
    return list;
  }
  // the one to stay with: the locked one, else the party leader, else the nearest on my map
  function lockOf(game, list) {
    if (SET.supLock) { const m = list.find((x) => x.key === SET.supLock); if (m) return m; }
    const lead = list.find((x) => x.leader);
    if (lead) return lead;
    const p = game.player, here = list.filter((x) => x.here && x.x != null).sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y));
    return here[0] || list[0] || null;
  }

  // ---------------- the support skills on the hotbar ----------------
  const RAISE = new Set(['pr_resurrect']);
  const GUARD = new Set(['bi_barrier']); // (a self buff that covers the friends round him too: K.buffFriends)
  function supKind(id, S) {
    if (!S) return null;
    if (RAISE.has(id) || S.revive) return 'raise';
    if (id === 'ws_embrace') return 'shield';
    if (S.heal || S.type === 'heal') return 'heal';
    const kind = NC.kindOf ? NC.kindOf(S) : S.type === 'buff' ? 'buff' : 'active';
    if (kind === 'buff' && GUARD.has(id)) return 'guard';
    if (kind === 'buff' && S.party) return 'buff';
    return null;
  }
  AS.kindOf = supKind;
  const TAG = { raise: 'ชุบ', heal: 'ฮีล', buff: 'บัฟ', guard: 'โล่', shield: 'โล่' };
  function slots(p) {
    const out = [];
    for (const k of NC.HOTKEYS || ['q', 'e', 'r', 'f']) {
      const id = NC.skillForKey(p, k), S = id && NC.SKILLS[id], kind = supKind(id, S);
      if (kind) out.push({ k, id, S, lv: NC.skillLv(p, id), kind });
    }
    return out;
  }
  const lamps = []; // (where my lamps stand, js/jobs3_skills_c.js lk_lamp: lk_flare bursts them)
  const PRE = { // what a skill needs besides its cooldown and SP (who: the one it is for)
    ws_burst: (g, p) => !!(p.wsLatch && p.wsLatch.length),
    ws_embrace: (g, p) => !!(p.wsLatch && p.wsLatch.some((l) => !(l.shield > 0))),
    lk_flare: (g, p, who) => !!who && lamps.some((z) => g.time < z.until && dist(z.x, z.y, who.x, who.y) < 210),
  };
  function ready(game, p, s, who) {
    if (!(s.lv > 0) || SET.supOff.includes(s.id)) return false;
    if ((NC.skillCd ? NC.skillCd(p, s.id) : p.cd[s.k]) > 0) return false;
    if (NC.skillCost && p.sp < NC.skillCost(p, s.id, s.lv)) return false;
    if (NC.skillLocked && NC.skillLocked(p, s.id)) return false;
    if (online() && NC.Online.supports && !NC.Online.supports(s.id)) return false;
    // (online the server knows who has fallen: the resurrection's own check sees only this screen's stand-ins)
    if (s.S.need && !(online() && s.kind === 'raise') && s.S.need(game, p, s.lv) !== true) return false;
    return !PRE[s.id] || PRE[s.id](game, p, who);
  }
  const radiusOf = (S, lv) => { const P = typeof S.party === 'function' ? S.party(lv) : null; return (P && P.r) || BUFF_R; };

  // who a party buff reached when it was cast: a member in reach who was not there gets it again (6 s apart at most)
  const coverage = new Map(), buffT = new Map(), wasDead = new Set();
  if (NC.skillCasts) NC.skillCasts.push((game, p, id, lv) => {
    if (!game || p !== game.player || !AS.active(game)) return;
    const S = NC.SKILLS[id], kind = supKind(id, S);
    if (kind === 'buff' || kind === 'guard') {
      const r = radiusOf(S, lv || NC.skillLv(p, id));
      coverage.set(id, new Set(mates(game).filter((m) => m.here && !m.dead && m.x != null && dist(m.x, m.y, p.x, p.y) < r).map((m) => m.key)));
      buffT.set(id, game.time);
    }
    if (id === 'lk_lamp' && game.mouse) {
      const M = game.mouse, a = Math.atan2(M.wy - p.y, M.wx - p.x), d = Math.min(320, dist(p.x, p.y, M.wx, M.wy));
      lamps.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, until: game.time + 24 });
      while (lamps.length > 6) lamps.shift();
    }
  });
  function noteFalls(list) { // (a member raised again lost their buffs: they count as not reached)
    for (const m of list) {
      if (m.dead) wasDead.add(m.key);
      else if (wasDead.has(m.key)) { wasDead.delete(m.key); for (const set of coverage.values()) set.delete(m.key); }
    }
  }
  const fightNear = (game, x, y, r) => game.enemies.some((e) => K.alive(e) && !e.dummy && dist(e.x, e.y, x, y) < r);

  // ---------------- what to do now ----------------
  // { k, aim, say, note } a skill to press, { go: member, say, note } a walk up to someone first, or null
  function choose(game, p, list, lock, sl) {
    const here = list.filter((m) => m.here && m.x != null && dist(m.x, m.y, p.x, p.y) < LOOK_R);
    const me = { key: 'me', name: 'ตัวเอง', x: p.x, y: p.y, hp: p.hp / p.maxHp, me: true };
    const lockFirst = (a, b) => (b === lock) - (a === lock) || dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y);
    // ชุบ: the fallen, the locked friend first
    const raise = sl.filter((s) => s.kind === 'raise' && !SET.supOff.includes(s.id));
    if (raise.length) {
      for (const m of here.filter((x) => x.dead).sort(lockFirst)) {
        if (dist(m.x, m.y, p.x, p.y) > RAISE_R) return { go: m, say: 'ไปชุบ', note: m.name };
        const s = raise.find((x) => ready(game, p, x, m));
        if (s) return { k: s.k, aim: [m.x, m.y - 40], say: 'ชุบชีวิต', note: m.name };
      }
    }
    // ฮีล: whoever is under the line, the lowest first (the locked friend counts 10% lower)
    const heals = sl.filter((s) => s.kind === 'heal' && !SET.supOff.includes(s.id));
    if (heals.length) {
      const low = (m) => m.hp - (m === lock ? 0.1 : 0);
      const hurt = [me].concat(here.filter((m) => !m.dead)).filter((m) => m.hp < SET.supHeal).sort((a, b) => low(a) - low(b));
      const m = hurt[0];
      if (m) {
        if (!m.me && dist(m.x, m.y, p.x, p.y) > HEAL_R) return { go: m, say: 'ไปฮีล', note: m.name };
        const s = heals.find((x) => ready(game, p, x, m));
        if (s) return { k: s.k, aim: [m.x, m.y - 40], say: 'ฮีล', note: `${m.name} ${Math.round(m.hp * 100)}%` };
      }
    }
    // โล่ and บัฟ: with the friend in reach; SP kept back for the heals (unless blue potions do that)
    const blues = NC.POT ? NC.POT.count(p, 'blue') : p.spPotions;
    const keep = heals.length && !(SET.spPot > 0 && blues > 0) ? 0.3 : 0;
    const inFight = fightNear(game, p.x, p.y, 380) || (lock && lock.here && lock.x != null && fightNear(game, lock.x, lock.y, 450));
    for (const s of sl) {
      if (s.kind !== 'buff' && s.kind !== 'guard' && s.kind !== 'shield') continue;
      if (SET.supOff.includes(s.id)) continue;
      const r = radiusOf(s.S, s.lv), reach = (m) => dist(m.x, m.y, p.x, p.y) < r * 0.85;
      if (lock && lock.here && lock.x != null && !lock.dead && !reach(lock)) continue; // (in reach first: the follow brings him)
      if (NC.skillCost && p.sp - NC.skillCost(p, s.id, s.lv) < p.maxSp * keep) continue;
      if (!ready(game, p, s, lock)) continue;
      const aim = lock && lock.here && lock.x != null ? [lock.x, lock.y - 40] : null;
      if (s.kind === 'shield') return { k: s.k, aim, say: 'โล่', note: s.S.name };
      if (s.kind === 'guard' && !inFight) continue;
      const mine = p.buffs && p.buffs[s.id] > 0, cov = coverage.get(s.id);
      const missed = here.some((m) => !m.dead && reach(m) && !(cov && cov.has(m.key)));
      if (!mine || (missed && game.time - (buffT.get(s.id) || -99) > 6)) return { k: s.k, aim, say: 'บัฟ', note: s.S.name };
    }
    return null;
  }

  // a spot behind the friend (the side they turn their back to), on open ground; kept while they stand still
  let spot = null;
  function spotFor(game, m, D) {
    if (spot && spot.key === m.key && dist(spot.bx, spot.by, m.x, m.y) < 50 && game.time < spot.t) return spot.at;
    const R = Math.max(90, D * 0.7), back = m.face > 0 ? Math.PI : 0;
    let at = [m.x, m.y];
    for (const da of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2, Math.PI]) {
      const a = back + da, x = m.x + Math.cos(a) * R, y = m.y + Math.sin(a) * R * 0.55;
      if (game.world.fits(x, y, 24) && !K.nearWarp(game, x, y)) { at = [x, y]; break; }
    }
    spot = { key: m.key, bx: m.x, by: m.y, t: game.time + 1.5, at };
    return at;
  }
  const tokens = new Map(); // (a steady key per member for the stall check, js/autofarm.js progress)
  const token = (m) => m.ref || tokens.get(m.key) || (tokens.set(m.key, { key: m.key }), tokens.get(m.key));
  function walk(game, dt, out, m, x, y) {
    const v = K.steer(game, x, y, dt);
    // (no way to them counts as getting nowhere too: the stall ladder's hop out of a pocket a knock-back left him in,
    // js/autofarm.js shutIn, Discord #151)
    if (!v) { K.progress(game, dt, token(m), x, y, () => {}); return false; }
    out.mx = v[0]; out.my = v[1];
    K.progress(game, dt, token(m), x, y, () => {});
    return true;
  }

  // a friend on another map: the walk there (warps and all, js/autotravel.js), then support goes on
  let travel = null, noted = '';
  function goAfter(game, m) {
    if (!NC.Travel || !NC.MapRoute || !NC.MapRoute.pathTo(game.mapId, m.map)) return false;
    travel = { key: m.key, map: m.map, name: m.name };
    A.stop(game, ''); // (quietly: the walk takes over)
    NC.Travel.go(game, { map: m.map, x: 0, y: 0, r: 1e9, name: m.name, done: (g) => { travel = null; if (!A.on) A.toggle(g); } });
    NC.HUD.log(`โหมดซัพพอร์ต · ตาม ${m.name} ไป${mapName(m.map)}`, 'sys');
    return true;
  }

  // ---------------- driving (js/autofarm.js drive() hands over the frame) ----------------
  let nextT = 0, follow = false, sat = false, restBlock = 0;
  AS.drive = function (game, dt, out, threat) {
    const p = game.player, list = mates(game), lock = lockOf(game, list), sl = slots(p);
    noteFalls(list);
    AS.lock = lock;
    if (SET.supLock && (!lock || lock.key !== SET.supLock) && noted !== SET.supLock) { noted = SET.supLock; NC.HUD.log('โหมดซัพพอร์ต · คนที่ล็อกไว้ไม่อยู่ในปาร์ตี้แล้ว ตามหัวตี้แทน', 'sys'); }
    if (!lock) { K.say('ซัพพอร์ต', 'รอเพื่อนเข้าปาร์ตี้'); return out; }
    // the friend is on another map
    if (!lock.here && lock.map && lock.map !== game.mapId) {
      if (SET.supWarp && goAfter(game, lock)) return out;
      K.say('รอเพื่อน', `${lock.name} อยู่${mapName(lock.map)}`);
      return out;
    }
    const D = DIST[SET.supDist] || DIST.mid, d = lock.x != null ? dist(p.x, p.y, lock.x, lock.y) : 0;
    const busy = p.skillLock > 0 || p.channel || p.dash;
    const act = busy ? null : choose(game, p, list, lock, sl);
    // sitting: up again when someone needs him, the friend walks off, something comes, or he is full
    if (sat && !p.sit) { sat = false; restBlock = game.time + 12; } // (stood up by the player: no rest for a while)
    if (p.sit) {
      if (threat || act || (lock.here && !lock.dead && (d > D + 60 || lock.moving)) || (p.sp >= p.maxSp * 0.9 && p.hp >= p.maxHp * 0.9)) { NC.Rest.standUp(game); sat = false; }
      else { K.say('นั่งพัก', `SP ${Math.round((100 * p.sp) / p.maxSp)}% · รอ ${lock.name}`); return out; }
    }
    if (act && game.time >= nextT) {
      if (act.go) {
        if (walk(game, dt, out, act.go, act.go.x, act.go.y)) { K.say(act.say, act.note); return out; }
      } else {
        out.key = act.k; out.aim = act.aim; nextT = game.time + 0.45; follow = false;
        K.say(act.say, act.note);
        return out;
      }
    }
    // follow: behind them, at the distance picked (moving off past it + 40, stopping well inside it)
    if (lock.here && lock.x != null) {
      const fighting = SET.supFight && A.target && K.alive(A.target); // (ซัพ+ตี: a monster round the friend on its way)
      if (!follow && d > (fighting ? Math.max(D + 40, FIGHT_LEASH) : D + 40)) follow = true;
      if (follow) {
        const s = spotFor(game, lock, D);
        if (d < D * 0.55 || dist(p.x, p.y, s[0], s[1]) < 36) follow = false;
        else if (walk(game, dt, out, lock, s[0], s[1])) { K.say('ตาม', lock.name); return out; }
        else follow = false;
      }
    }
    // ซัพ+ตี: nothing to support and the friend close: the auto farm fights round them (js/autofarm.js reads out.fight)
    if (SET.supFight && lock.here && !lock.dead && lock.x != null && (!busy || (A.target && K.alive(A.target)))) {
      const heals = sl.filter((s) => s.kind === 'heal' && !SET.supOff.includes(s.id));
      const hc = heals.reduce((m, s) => Math.max(m, NC.skillCost ? NC.skillCost(p, s.id, s.lv) || 0 : 0), 0);
      const blues = NC.POT ? NC.POT.count(p, 'blue') : p.spPotions;
      out.fight = { x: lock.x, y: lock.y, r: FIGHT_R, name: lock.name, keep: hc * (SET.spPot > 0 && blues > 0 ? 1 : 2), off: SET.supOff };
      return out;
    }
    // rest: SP or HP low with no potions for it, the friend standing still nearby, nothing about
    if (SET.rest && NC.Rest && !threat && !p.sit && game.time > restBlock && (!lock.here || (d <= D + 40 && !lock.moving))) {
      const reds = NC.POT ? NC.POT.count(p, 'red') : p.potions, blues = NC.POT ? NC.POT.count(p, 'blue') : p.spPotions;
      const lowSp = p.sp < p.maxSp * 0.25 && !(SET.spPot > 0 && blues > 0), lowHp = p.hp < p.maxHp * 0.4 && !(SET.hpPot > 0 && reds > 0);
      if (lowSp || lowHp) { NC.Rest.sitDown(game); sat = true; K.say('นั่งพัก'); return out; }
    }
    K.say('ซัพพอร์ต', lock.dead ? `${lock.name} หมดแรง` : `${lock.name} HP ${Math.round(lock.hp * 100)}%`);
    return out;
  };

  // a press of Z / AUTO while walking after a friend to another map: that walk stops (support stays off)
  const baseToggle = NC.Auto.toggle;
  NC.Auto.toggle = function (game) {
    if (travel && NC.Travel && NC.Travel.on) { travel = null; NC.Travel.stop('ปิดโหมดซัพพอร์ต'); return; }
    if (!A.on && game && AS.active(game)) { follow = false; spot = null; nextT = 0; noted = ''; }
    return baseToggle.apply(this, arguments);
  };

  // ---------------- the lock mark over the friend ----------------
  if (NC.Party && NC.Party.drawTags) {
    const baseTags = NC.Party.drawTags;
    NC.Party.drawTags = function (ctx, g) {
      baseTags.apply(this, arguments);
      const m = AS.lock, s = NC.SPR && NC.SPR.ic_lock;
      if (!A.on || !m || !m.here || !s || !AS.active(g)) return;
      const x = m.ref ? m.ref.x : m.x, y = (m.ref ? m.ref.y : m.y) - 172 + Math.sin(g.time * 4) * 4, S = 38;
      if (x == null || y == null) return;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(g.time * 2) * 0.12); ctx.drawImage(s.img, -S / 2, -S / 2, S, S); ctx.restore();
    };
  }

  // ---------------- a click on a friend's hero: "ตามซัพคนนี้" (js/playermenu.js) ----------------
  const healIcon = (p) => {
    const s = slots(p).find((x) => x.kind === 'heal') || slots(p)[0];
    const M = s && NC.ASSET_MANIFEST[s.S.icon];
    return (M && M.src) || ((NC.ASSET_MANIFEST_AUTO || {}).ic_auto || {}).src || 'assets/auto/ic_auto.png';
  };
  const inMyParty = (peer) => { const pn = PN(); return !!(pn && pn.others && pn.others().includes(peer)); };
  if (NC.PlayerMenu) {
    NC.PlayerMenu.more = NC.PlayerMenu.more || [];
    NC.PlayerMenu.acts = NC.PlayerMenu.acts || {};
    NC.PlayerMenu.more.push((r, row) => {
      const g = NC.game, p = g && g.player;
      if (!p || !AS.supportJob(p.job)) return '';
      const now = A.on && AS.active(g) && AS.lock && AS.lock.key === r.peer;
      if (!inMyParty(r.peer)) return row('as-follow', healIcon(p), 'ตามซัพ (ชวนเข้าปาร์ตี้ก่อน)', true, 'ฮีลและบัฟถึงแค่คนในปาร์ตี้เดียวกัน');
      return row('as-follow', healIcon(p), now ? 'กำลังซัพคนนี้อยู่' : 'ตามซัพคนนี้', now);
    });
    NC.PlayerMenu.acts['as-follow'] = (r, g) => {
      if (!inMyParty(r.peer)) return;
      SET.mode = 'support'; SET.supLock = r.peer; save();
      NC.HUD.log(`โหมดซัพพอร์ต · ล็อก ${r.name}`, 'sys');
      if (!A.on) A.toggle(g); else { follow = false; spot = null; }
      later();
    };
  }

  // ---------------- the window: the mode switch and the four support cards (in js/p3_autofarm.js's frame) ----------------
  const ICON = {
    mates: 'assets/ic_party.png', dist: 'assets/craftgo/cg_pin.png', skill: 'assets/ic_skills.png', pot: 'assets/ic_potion.png',
    auto: ((NC.ASSET_MANIFEST_AUTO || {}).ic_auto || {}).src || 'assets/auto/ic_auto.png',
  };
  const later = () => { if (NC.P3AF) NC.P3AF.render(); syncBar(); };
  let bar = null;
  function syncBar() {
    if (!bar) return;
    const g = NC.game, p = g && g.player, show = !!(p && AS.supportJob(p.job));
    bar.hidden = !show;
    for (const b of bar.querySelectorAll('button')) b.classList.toggle('on', (b.dataset.asMode === 'support') === (SET.mode === 'support'));
    const t = bar.previousElementSibling; // (the window's title)
    if (t && t.tagName === 'SPAN') t.textContent = show && SET.mode === 'support' ? 'ออโต้ซัพพอร์ต' : 'ออโต้ฟาร์ม';
  }
  AS.cards = function (game, H) {
    const p = game.player, list = mates(game), lock = lockOf(game, list), sl = slots(p), esc = H.esc, tick = H.tick;
    const auto = !SET.supLock || !list.some((m) => m.key === SET.supLock);
    const lead = list.find((m) => m.leader);
    const pct = (v) => Math.round(Math.max(0, Math.min(1, v)) * 100);
    // who
    const tiles = list.map((m) => {
      const on = !auto && SET.supLock === m.key, sub = !m.here ? (m.map ? mapName(m.map) : 'ไม่อยู่') : `${jobName(m.job)} Lv ${m.lv | 0}`;
      return `<button class="p3af-mon as-mate${on ? ' on' : ''}${m.here ? '' : ' away'}${auto && lock === m ? ' now' : ''}" data-as-lock="${esc(m.key)}" title="${esc(m.name)}">${tick}` +
        (m.leader ? '<i>หัวตี้</i>' : '') + `<canvas width="128" height="128" data-as-face="${esc(m.key)}"></canvas><b>${esc(m.name)}</b><em>${esc(sub)}</em>` +
        `<span class="as-hp${m.dead ? ' dead' : ''}"><i style="width:${m.dead ? 0 : pct(m.hp)}%"></i></span></button>`;
    });
    const autoTile = `<button class="p3af-mon as-mate as-auto${auto ? ' on' : ''}" data-as-lock="" title="ตามหัวตี้ ถ้าเราเป็นหัวตี้เองก็ตามคนที่ใกล้ที่สุด">${tick}` +
      `<span class="as-pic"><img src="${ICON.auto}" alt=""></span><b>อัตโนมัติ</b><em>${lead ? 'ตาม ' + esc(lead.name) : 'คนที่ใกล้สุด'}</em></button>`;
    const n = tiles.length + 1;
    const who = list.length
      ? `<div class="p3af-sub">ล็อกเพื่อนที่จะเดินตามและซัพ${lock ? ` · ตอนนี้: <b>${esc(lock.name)}</b>` : ''}</div><div class="p3af-mons n${Math.min(Math.max(n, 3), 9)}">${autoTile}${tiles.join('')}</div>`
      : '<div class="p3af-empty">ยังไม่มีเพื่อนในปาร์ตี้<br>คลิกตัวเพื่อน → ชวนเข้าปาร์ตี้ แล้วค่อยเลือกคนที่จะซัพ</div>';
    // how close
    const row = (k, name, note) => `<button class="p3af-range as-dist${SET.supDist === k ? ' on' : ''}" data-as-dist="${k}"><span class="as-steps s-${k}"><i></i><i></i></span><b>${name} <small>${note}</small></b>${tick}</button>`;
    const distIn = row('close', 'ชิดตัว', '(ห่าง 150)') + row('mid', 'ใกล้ ๆ', '(ห่าง 250)') + row('far', 'เว้นระยะ', '(ห่าง 380)') +
      `<button class="p3af-tog${SET.supWarp ? ' on' : ''}" data-as-warp="1"><span>เพื่อนวาร์ปไปแมพอื่น เดินตามไปด้วย</span>${tick}</button>`;
    // skills: the hotbar, support ones on, the others never used here
    const keys = NC.HOTKEYS || ['q', 'e', 'r', 'f'];
    const slotHtml = keys.map((k) => {
      const id = NC.skillForKey(p, k), S = id && NC.SKILLS[id], kind = supKind(id, S);
      const src = S && NC.ASSET_MANIFEST[S.icon] ? NC.ASSET_MANIFEST[S.icon].src : S && NC.SPR[S.icon] ? NC.SPR[S.icon].src || '' : '';
      if (!S) return `<button class="p3af-slot empty" disabled title="ช่องว่าง"><i>${k.toUpperCase()}</i><span class="p3af-sk"></span>${tick}</button>`;
      const fightSlot = !kind && SET.supFight && NC.kindOf && NC.kindOf(S) !== 'passive'; // (ซัพ+ตี: an attack slot, switchable)
      if (!kind && !fightSlot) return `<button class="p3af-slot as-nosup" disabled title="${esc(S.name || '')} · ไม่ใช้ในโหมดซัพ (ไม่ตีมอน)"><i>${k.toUpperCase()}</i><span class="p3af-sk">${src ? `<img src="${src}" alt="">` : ''}</span><u class="as-tag no">ไม่ใช้</u></button>`;
      if (fightSlot) {
        const on = !SET.supOff.includes(id);
        return `<button class="p3af-slot${on ? ' on' : ''}" data-as-slot="${esc(id)}" title="${esc(S.name || '')} · ใช้ตอนว่างจากซัพ"><i>${k.toUpperCase()}</i>` +
          `<span class="p3af-sk">${src ? `<img src="${src}" alt="">` : ''}</span><u class="as-tag atk">ตี</u>${tick}</button>`;
      }
      const on = !SET.supOff.includes(id);
      return `<button class="p3af-slot${on ? ' on' : ''}" data-as-slot="${esc(id)}" title="${esc(S.name || '')}"><i>${k.toUpperCase()}</i>` +
        `<span class="p3af-sk">${src ? `<img src="${src}" alt="">` : ''}</span><u class="as-tag ${kind}">${TAG[kind]}</u>${tick}</button>`;
    }).join('');
    const skillIn = '<div class="p3af-pair as-fight">' +
      `<button class="p3af-pill${SET.supFight ? '' : ' blue'}" data-as-fight="0" title="ใช้แค่ชุบ ฮีล โล่ บัฟ ไม่ตีมอนเลย">ซัพอย่างเดียว</button>` +
      `<button class="p3af-pill${SET.supFight ? ' blue' : ''}" data-as-fight="1" title="ชุบ ฮีล บัฟก่อน ว่างแล้วช่วยตีมอนรอบเพื่อน เก็บ SP ไว้ฮีล">ซัพ + ช่วยตี</button></div>` +
      `<div class="p3af-slots">${slotHtml}</div>` + (sl.length ? '' : '<div class="as-warn">ยังไม่มีสกิลฮีล ชุบ หรือบัฟปาร์ตี้ในแถบสกิล · ใส่ได้ที่หน้าสกิล (K)</div>') +
      '<div class="as-heal"><span class="p3af-lbl">ฮีลเมื่อ HP ต่ำกว่า</span><div class="p3af-pills">' +
      [0.5, 0.7, 0.9].map((v) => `<button class="p3af-pill${SET.supHeal === v ? ' blue' : ''}" data-as-heal="${v}">${Math.round(v * 100)}%</button>`).join('') + '</div></div>';
    // potions and rest
    const S = SET, pctTxt = (v) => (v ? Math.round(v * 100) + '%' : 'ไม่ใช้');
    const potIn =
      '<div class="p3af-lbl">ดื่มยาแดงเมื่อ HP ต่ำกว่า</div><div class="p3af-pills">' +
      [0, 0.3, 0.5, 0.7].map((v) => `<button class="p3af-pill${S.hpPot === v ? ' blue' : ''}" data-hp="${v}">${pctTxt(v)}</button>`).join('') + '</div>' +
      '<div class="p3af-lbl">ดื่มยาฟ้าเมื่อ SP ต่ำกว่า</div><div class="p3af-pills">' +
      [0, 0.2, 0.4].map((v) => `<button class="p3af-pill${S.spPot === v ? ' blue' : ''}" data-sp="${v}">${pctTxt(v)}</button>`).join('') + '</div>' +
      `<button class="p3af-tog${S.rest ? ' on' : ''}" data-rest="1"><span>นั่งพักตอนเพื่อนยืนนิ่ง (SP/HP ต่ำและยาหมด)</span>${tick}</button>`;
    const on = A.on || !!(travel && NC.Travel && NC.Travel.on);
    return '<div class="p3af-grid as-grid">' +
      H.card('c-mon', ICON.mates, 'ซัพใคร', who) + H.card('c-range', ICON.dist, 'ระยะเดินตาม', distIn) +
      H.card('c-skill', ICON.skill, 'สกิลซัพ', skillIn) + H.card('c-pot', ICON.pot, 'ยาและการพัก', potIn) + '</div>' +
      '<div class="p3af-foot"><div class="p3af-note"><span>โหมดซัพพอร์ต: เดินตามเพื่อนที่ล็อก ' +
      (SET.supFight ? '<b>ชุบ ฮีล โล่ บัฟ</b> ก่อน ว่างแล้ว<b>ช่วยตีมอนรอบเพื่อน</b> (เก็บ SP ไว้ฮีล) · ' : 'ใช้แค่ <b>ชุบ ฮีล โล่ บัฟ</b> ไม่ตีมอนเลย · ') +
      'คลิกตัวเพื่อน → <b>ตามซัพคนนี้</b> ก็ได้ · <b>Z</b> เปิด/ปิด · เดินเองก็หยุด</span></div>' +
      `<button class="p3af-go${on ? ' stop' : ''}" data-p3="go">${on ? 'หยุดซัพ' : 'เริ่มซัพ'}</button></div>`;
  };
  // the members' faces (the hero's head, as js/playermenu.js draws it)
  AS.drawn = function (box) {
    const g = NC.game;
    if (!g) return;
    const list = mates(g);
    box.querySelectorAll('canvas[data-as-face]').forEach((cv) => {
      const m = list.find((x) => x.key === cv.dataset.asFace), c = cv.getContext('2d'), S = cv.width;
      c.clearRect(0, 0, S, S);
      if (!m || !m.equip || !NC.headSpot || !NC.drawAvatar) { cv.classList.add('none'); return; }
      try { const hs = NC.headSpot(m.equip), k = (S * 0.74) / hs.w; NC.drawAvatar(c, m.equip, S / 2 - hs.x * k, S * 0.6 - hs.y * k, k, 1, { noWeapon: true, t: 0.3 }); } catch (e) { cv.classList.add('none'); }
    });
    syncBar();
  };

  function onClick(ev) {
    const b = ev.target.closest('button');
    if (!b || b.disabled) return;
    const d = b.dataset, g = NC.game;
    if (d.asMode) {
      if (SET.mode === d.asMode) return;
      SET.mode = d.asMode; A.target = null; follow = false; spot = null;
      if (A.on && g) A.say(d.asMode === 'support' ? 'ซัพพอร์ต' : 'หาเป้าหมาย');
    } else if (d.asLock !== undefined) { SET.supLock = d.asLock; noted = ''; follow = false; spot = null; }
    else if (d.asDist) { SET.supDist = d.asDist; follow = false; }
    else if (d.asWarp) SET.supWarp = !SET.supWarp;
    else if (d.asSlot) { const i = SET.supOff.indexOf(d.asSlot); if (i >= 0) SET.supOff.splice(i, 1); else SET.supOff.push(d.asSlot); }
    else if (d.asHeal) SET.supHeal = Number(d.asHeal);
    else if (d.asFight) { SET.supFight = d.asFight === '1'; if (!SET.supFight) A.target = null; }
    else return;
    save(); later();
  }

  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    const win = $('autofarm'), title = win && win.querySelector('.ptitle'), first = title && title.querySelector('span');
    if (!win || !title) return;
    bar = document.createElement('div');
    bar.className = 'as-mode'; bar.id = 'as-mode'; bar.hidden = true;
    bar.innerHTML = '<button data-as-mode="farm">ฟาร์ม</button><button data-as-mode="support">ซัพพอร์ต</button>';
    if (first) first.after(bar); else title.prepend(bar);
    win.addEventListener('click', onClick);
    syncBar();
  };
  A.say = K.say;

  // the status line while walking after a friend to another map (the auto farm's own line is off then)
  const baseHud = NC.HUD.update.bind(NC.HUD);
  let walkLine = '';
  NC.HUD.update = function (game) {
    baseHud(game);
    if (travel && !(NC.Travel && NC.Travel.on)) travel = null; // (stopped: walking himself, a fall, no way)
    const el = $('af-state'), btn = $('af');
    const line = travel && !A.on ? `ตามไป${mapName(travel.map)} · ${travel.name}` : '';
    if (line !== walkLine) {
      walkLine = line;
      if (el) { if (line) { el.textContent = line; el.hidden = false; } else if (!A.on) { el.textContent = ''; el.hidden = true; } }
      if (btn) btn.classList.toggle('on', !!line || A.on);
      later();
    }
    if (bar && !bar.hidden !== !!(game.player && AS.supportJob(game.player.job))) syncBar();
  };
})();
