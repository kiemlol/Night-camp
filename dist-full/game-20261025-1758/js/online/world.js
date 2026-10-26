/* online/world.js — the online game in the web's own engine (?online). The Go server owns the world: where everyone is,
   the monsters and their HP, every hit and its number, EXP, levels, the bag, potions and the map. This file lets the
   web game draw and feel all of it with its own art and animations:
     - the hero walks at once under the keys (prediction) and is pulled to the server's position when they part;
       the keys, the swings, the skills, the warps, the potions and picking up go to the server (online/conn.js);
     - game.enemies are mirrors of the server's monsters (NC.makeEnemy for the looks, the snapshot for the rest), slid
       to where the server has them; no local AI, no local damage, no local loot or respawns;
     - the numbers, hurts, kills and rewards come from the server's events;
     - the other heroes are net.js's remote players, fed by the snapshot through a room of our own (NC.Online.room);
       chat.js's lines go to nc_chat and the server's chat notifications come back into the chat window;
     - the hero's level, EXP, job, stats, skills, hotbar, equipment, look, potions, coins and materials are the
       server's (NC.applyGear then works out the rest of the sheet locally, for the HUD and the walk speed).
   Load after every feature (its wrappers must be the outermost) and before game.js. Nothing runs without ?online. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, FX = NC.FX;
  if (!O || !O.enabled) return;
  let game = null, snap = null, me = null, ready = false;
  const mirrors = new Map(); // server monster id -> the game's enemy
  const lootMirrors = new Map(); // server loot id -> the game's loot
  const SLOTS = ['hat', 'hair', 'top', 'pants', 'weapon', 'robe', 'cape', 'glasses', 'fhat', 'frobe', 'shield', 'acc1', 'acc2'];

  // ---------------- the server's equipment and look as the game's items ----------------
  const keyOf = (A) => (A && A.g ? [A.g, A.hair, A.hc, A.eyes, A.ec, A.mouth].join('-') : null);
  const LOOK_SLOTS = ['hat', 'glasses', 'hair', 'top', 'pants', 'robe', 'cape', 'shoes'];
  const LOOK_HIDE = new Set(['hat', 'glasses', 'robe', 'cape']);
  function lookOf(equip, look, appearance) {
    const eq = Object.assign({}, equip);
    for (const slot of LOOK_SLOTS) {
      const id = look && look[slot];
      let changed = false;
      if (slot === 'hair' && id === 'created' && appearance && NC.Look) {
        const hair = NC.Look.register(keyOf(appearance));
        if (hair) { eq.hair = hair; changed = true; }
      } else if (id === 'none' && LOOK_HIDE.has(slot)) { eq[slot] = null; changed = true; }
      else if (id && NC.ITEMS[id] && NC.ITEMS[id].slot === slot) { eq[slot] = id; changed = true; }
      // This is a drawing copy. Inventory's inner renderer must not put a real fashion item back over a look override.
      if (changed && slot === 'hat') eq.fhat = null;
      if (changed && slot === 'robe') eq.frobe = null;
    }
    return eq;
  }
  // a piece this browser doesn't know (an admin-only test item such as MURAMASA or the samurai line's katanas without
  // unreleased job definitions): the hand holds the starter sword instead (a hero always holds one: anim.js reads the
  // weapon's numbers every frame), any other slot stays empty. The server's own piece stays the server's (the bridge
  // below never sends the stand-in back: standIn).
  const STAND_IN = { weapon: 'sword' };
  const shown = (slot, v) => (!v ? null : NC.ITEMS[v] ? v : STAND_IN[slot] && NC.ITEMS[STAND_IN[slot]] ? STAND_IN[slot] : null);
  const standIn = {}; // slot -> the server's piece this browser can't show (for the hero's own equipment)
  function equipOf(equip, look, appearance) {
    const eq = {};
    for (const s of SLOTS) { const v = equip && equip[s]; eq[s] = shown(s, v); }
    if (!eq.hair) eq.hair = 'hair_spiky';
    if (eq.fhat) eq.hat = eq.fhat;
    if (eq.frobe) eq.robe = eq.frobe;
    return lookOf(eq, look, appearance);
  }
  // Server wardrobe is appearance only. The current inventory still owns real equipment and fashion bonuses;
  // leave those objects (and the bridge's diffs) untouched, applying the look only at drawing/pose entry points.
  const baseLookEquip = NC.lookEquip;
  NC.lookEquip = function (equip) {
    const view = baseLookEquip ? baseLookEquip.apply(this, arguments) : equip;
    const p = game && game.player;
    return p && equip === p.equip ? lookOf(view, p.look, p.appearance) : view;
  };
  for (const [key, at] of [['drawHero', 1], ['drawAvatar', 1], ['animCtx', 0], ['hatSpring', 1], ['headSpot', 0], ['weaponLine', 0], ['rigAnchors', 0]]) {
    const original = NC[key];
    if (typeof original !== 'function') continue;
    NC[key] = function (...args) {
      const p = game && game.player, equip = p && p.equip, own = p && args[at] === equip;
      args[at] = NC.lookEquip(args[at]);
      if (!own) return original.apply(this, args);
      // HeroSpine recognizes the local actor by equipment identity. Keep its drawing copy on the actor
      // for this synchronous call too, or wardrobe projection silently falls back to the old rig.
      p.equip = args[at];
      try { return original.apply(this, args); } finally { p.equip = equip; }
    };
  }
  const baseLookDraw = NC.drawPlayer;
  if (baseLookDraw) NC.drawPlayer = function (ctx, g) {
    if (g !== game || !g.player || !g.player.look || !Object.keys(g.player.look).length) return baseLookDraw.apply(this, arguments);
    const p = g.player, equip = p.equip;
    p.equip = NC.lookEquip(equip);
    try { return baseLookDraw.apply(this, arguments); } finally { p.equip = equip; }
  };
  const baseLookEffect = FX && FX.add;
  if (baseLookEffect) FX.add = function (effect) {
    const p = game && game.player, eq = p && p.equip;
    if (eq && effect && effect.type === 'hero' && effect.equip && Math.abs(p.x - effect.x) < 1 && Math.abs(p.y - effect.y) < 1 &&
      Object.keys(eq).every(slot => (eq[slot] || null) === (effect.equip[slot] || null))) effect.equip = NC.lookEquip(eq);
    return baseLookEffect.apply(this, arguments);
  };
  // (for the other online files: online/gear.js, craft.js, quests.js, social.js)
  const W = (NC.OnlineWorld = {
    equipOf, keyOf, mirrors,
    selfHooks: [], // fn(self, first) after the hero's record is applied
    bridgeHooks: [], // fn(self, hero, put) -> actions for what the web's windows changed (run with the bridge; put: W.keep's kinds)
    eventHooks: [], // fn(event) for every server event (102)
    copyIdFor: null, // fn(slot, itemId) -> the bag copy's id for an equip action (online/gear.js)
    presenceHooks: [], // fn(player, presence): more of another hero's record for net.js (shops, duels: online/market.js, pvp.js)
    outHooks: [], // fn(presence): the hero's own presence fields net.js would send (duel invites ...)
    enterHooks: [], // fn(mapId, snapshot) before a map is entered: make the map the server named (online/root.js: the root floors)
    monsterHooks: [], // fn(mirror, monster, game) after each server monster is applied (root tags, the world boss's casts)
    mirrorFrames: {}, // type -> fn(game, mirror, dt, mirrorFrame): a monster's own frame instead of the plain slide
    get snap() { return snap; }, get game() { return game; }, get ready() { return ready; }, get me() { return me; },
  });
  // The normal updateSkills path still advances cast/channel animations and cooldowns. Its job simulation hooks
  // must not also regenerate gauges, spawn attacks, or age/detonate the server's blade marks locally.
  // (a tick marked .online only draws the server's state and stays on: darkroot.js's floor, goal HUD and stairs)
  if (NC.skillTicks) for (let i = 0; i < NC.skillTicks.length; i++) {
    const tick = NC.skillTicks[i];
    if (tick.online) continue;
    NC.skillTicks[i] = function (g, p) { if (g === game && p === game.player) return; return tick.apply(this, arguments); };
  }

  // ---------------- the hero: the server's record ----------------
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let lastGear = null, lastLook = null, lastOwned = null;
  // what the hero's windows changed stays on the hero until the server's record shows it (the stats, the skill levels,
  // the hotbar, the equipment and the job: keepMine; Uncle Coco's purchases and sales: keepTrade): a change the bridge
  // has not sent yet (it waits pendingUntil between rounds), or sent and not answered yet (sent[kind][key]: the value
  // the server should reach). The kind's last action (lastOf[kind]) is answered once a snapshot's ackSeq reaches its
  // seq or the server refused it; an answer gives back what was sent and not taken (refused), and keeps what
  // was changed after it. (Before: a snapshot answering the first + click, or bringing any HP / SP / EXP change, wiped
  // the clicks waiting for the bridge, and the resync wiped them too; 2026-10-18 a second hotbar slot, the shop's next
  // purchases, an unequip and a job change were lost the same way.)
  const srv = { base: null, skills: null, hotbar: null, equip: null, job: null, cnt: null };
  const sent = { base: {}, skills: {}, hotbar: {}, equip: {}, job: {} };
  let lastOf = {}; // kind -> the bridge's last action of that kind
  const seqOf = new WeakMap(), refused = new Set(); // an action -> the seq it went with (0: it did not go); the seqs refused
  function answered(a, strict = false) {
    if (!a) return true;
    const q = seqOf.get(a); // (undefined: still in the queue)
    return q !== undefined && (!q || (!strict && !!W.resyncing) || refused.has(q) || !!(snap && snap.ackSeq >= q));
  }
  function keepMine(kind, local, server, whole) {
    const was = srv[kind], wait = sent[kind], out = {};
    srv[kind] = Object.assign({}, server);
    if (whole || !local || !was) { sent[kind] = {}; return Object.assign({}, server); }
    // A reset can return to the old level after a few new clicks. Matching that
    // old snapshot is not confirmation: retain the whole new build until the
    // reset has both its own success receipt and an authoritative snapshot.
    if (skillReset && (kind === 'skills' || kind === 'hotbar')) return Object.assign({}, local);
    const done = answered(lastOf[kind], true); // elapsed local time cannot reject a server command still in flight
    for (const k of new Set(Object.keys(local).concat(Object.keys(server)))) {
      const l = local[k];
      let keep = l !== was[k]; // (changed here, not sent yet)
      if (k in wait) {
        if (server[k] === wait[k] || done) { keep = l !== wait[k]; delete wait[k]; } // (taken or refused: changed again since?)
        else keep = true; // (sent, not answered yet)
      }
      const v = keep && l !== undefined ? l : server[k];
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  function buildAnswered() {
    return ['base', 'skills', 'equip', 'hotbar', 'job'].some((kind) =>
      lastOf[kind] && Object.keys(sent[kind]).length > 0 && answered(lastOf[kind], true));
  }
  // the potions, the coins and the materials as counts: { potions …, coins, 'm:<material>' }
  function counts(o) {
    const c = { coins: o.coins | 0 };
    for (const [k] of POTKEYS) c[k] = o[k] | 0;
    for (const id in o.mats || {}) if (o.mats[id] > 0) c['m:' + id] = o.mats[id] | 0;
    return c;
  }
  let trades = []; // the purchases and sales sent and not answered: { a: the action, d: { count: change } }
  const sum = (list) => { const t = {}; for (const e of list) for (const k in e.d) t[k] = (t[k] || 0) + e.d[k]; return t; };
  const onWay = () => {
    const total = sum(trades);
    // The bridge may be waiting on an earlier edit when the merchant is clicked.
    if (skillReset && !skillReset.action) total.coins = (total.coins || 0) - skillReset.price;
    return total;
  };
  // the trades the other files' windows made (online/gear.js: pieces sold; online/life.js: the teachers' seeds, crops
  // and fish), noted when made with their change of the counts (W.trade): kept on the hero like Uncle Coco's until the
  // bridge sends them, then on their way with the rest (trades)
  let later = []; // { d: { count: change }, a: the action, out: sent }
  // the materials Uncle Coco's windows sold (the shop, the bag, the market: all through NC.Econ.sell) and what they paid,
  // until the bridge sends them: so a sale and a purchase in one round both go
  const sold = {}; // material -> coins paid
  if (NC.Econ && NC.Econ.sell) {
    const baseSell = NC.Econ.sell;
    NC.Econ.sell = function (g, id) {
      const got = baseSell.apply(this, arguments);
      if (ready && g === game && got > 0 && !(W.sellSkip && W.sellSkip(id))) sold[id] = (sold[id] || 0) + got; // (a teacher's own sale of crops or fish: W.trade, online/life.js)
      return got;
    };
  }
  // what Uncle Coco's windows bought or sold and the bridge has not sent: the hero's counts beyond the server's last and
  // what is on its way. Only a trade, as the bridge sends it (a sale: the materials gone and NC.Econ.sell's coins; a
  // purchase: more potions for fewer coins); the other files' trades are their own (W.trade, later); any other change
  // of these counts is the server's to make.
  function unsentTrade(p) {
    const L = counts(p), was = srv.cnt || {}, t = onWay(), w = sum(later), u = {}; // (the other files' trades are not Uncle Coco's)
    for (const k of new Set([...Object.keys(L), ...Object.keys(was), ...Object.keys(t), ...Object.keys(w)])) { const d = (L[k] | 0) - (was[k] | 0) - (t[k] | 0) - (w[k] | 0); if (d) u[k] = d; }
    let sells = Object.keys(sold).filter((id) => u['m:' + id] < 0).map((id) => ['m:' + id, sold[id]]);
    if (!Object.keys(sold).length && u.coins > 0) sells = Object.keys(u).filter((k) => k.startsWith('m:') && u[k] < 0 && !(W.sellSkip && W.sellSkip(k.slice(2)))).map((k) => [k, null]); // (a sale some other way: more coins)
    const paid = sells.reduce((n, x) => n + (x[1] || 0), 0);
    const buys = (u.coins | 0) - paid < 0 ? POTKEYS.filter(([k]) => u[k] > 0) : [];
    return { u, buys, sells };
  }
  // the server's counts, plus the trades on their way, plus the trade not sent yet
  function keepTrade(p, s, whole) {
    const previousCounts = counts(p);
    const keep = {};
    if (!whole && srv.cnt) {
      const { u, buys, sells } = unsentTrade(p); // (before the answered trades leave)
      for (const [k] of buys) keep[k] = u[k];
      for (const [k] of sells) keep[k] = u[k];
      if (buys.length || sells.length) keep.coins = u.coins;
      const w = sum(later);
      for (const k in w) keep[k] = (keep[k] || 0) + w[k];
    }
    if (whole) { for (const id in sold) delete sold[id]; later = []; }
    trades = whole ? [] : trades.filter((e) => !answered(e.a, true));
    const S = counts(s), t = onWay(), n = (k) => Math.max(0, (S[k] | 0) + (t[k] | 0) + (keep[k] | 0));
    srv.cnt = S;
    for (const [k] of POTKEYS) p[k] = n(k); // zero stock may be omitted from the server's record
    if (s.coins !== undefined) p.coins = n('coins');
    if (s.mats) { p.mats = {}; for (const k of new Set([...Object.keys(S), ...Object.keys(t), ...Object.keys(keep)])) if (k.startsWith('m:') && n(k) > 0) p.mats[k.slice(2)] = n(k); }
    if (!same(previousCounts, counts(p))) {
      if (NC.Shop && NC.Shop.render) NC.Shop.render();
      if (NC.invRefresh) NC.invRefresh(); // (an open bag shows new materials and potions at once, Discord #187)
    }
  }
  function applySelf(s, first) {
    const p = game.player;
    me = s.id || me;
    if (typeof s.name === 'string' && s.name) p.name = s.name;
    // Only the server consumes a free reset. Older servers must not inherit an offline entitlement.
    const resetUsedBefore = p.skillResetUsed;
    if (s.skillResetUsed !== undefined) p.skillResetUsed = Object.assign({}, s.skillResetUsed || {});
    else if (first) delete p.skillResetUsed;
    if (first) { lastOf = {}; lastGear = null; }
    const lvBefore = p.lv, jobLvBefore = p.jobLv, jobBefore = p.job;
    if (s.lv) p.lv = s.lv;
    if (s.xp !== undefined) p.xp = s.xp;
    // a job this browser doesn't know (an unreleased job): a stand-in entry, so the windows
    // that read NC.JOBS[p.job] work. Tier -1 keeps it out of every job list (the job change, the boards); the hero keeps
    // the server's job (no change is ever sent for it), drawn in the traveler's class look, with no skills of its own.
    if (s.job && !NC.JOBS[s.job]) NC.JOBS[s.job] = { name: 'อาชีพที่ยังไม่เปิดในเครื่องนี้', tier: -1, maxJob: 50, hp: 5, sp: 3, cls: 'traveler', skills: [], stand: true, desc: '' };
    if (s.job) p.job = keepMine('job', p.job ? { job: p.job } : null, { job: s.job }, first).job;
    const jobWait = !!s.job && p.job !== s.job; // (the hero's job change on its way: the new job's level and skills stay)
    if (p.job !== jobBefore) lastGear = null; // (the job given back, or the server's new one: its skills and gear below)
    if (s.jobLv && !jobWait) p.jobLv = s.jobLv;
    if (s.jobXp !== undefined && !jobWait) p.jobXp = s.jobXp;
    if (s.moves) p.moves = Object.assign({}, p.moves, s.moves);
    // what NC.applyGear reads: base stats, skills, the equipment, the job
    const gear = { base: s.base, skills: s.skills, equip: s.equip, look: s.look, appearance: s.appearance, job: s.job, lv: s.lv, jobLv: s.jobLv, wset: s.wset };
    if (!same(gear, lastGear)) {
      lastGear = JSON.parse(JSON.stringify(gear));
      if (s.base) p.base = Object.assign({}, p.base || {}, keepMine('base', p.base, s.base, first));
      // Confirming the job already selected locally must keep points allocated
      // while its reply was in flight, including inherited skills. Replace the
      // whole build only on login or when the server actually corrects the job.
      if (s.skills && !jobWait) p.skills = keepMine('skills', p.skills, s.skills, first || p.job !== jobBefore);
      if (s.appearance && NC.Look && keyOf(s.appearance) !== lastLook) {
        lastLook = keyOf(s.appearance);
        NC.Look.setMine(s.appearance, false);
      }
      const eq = {};
      for (const k of SLOTS) { const v = s.equip && s.equip[k]; eq[k] = shown(k, v); standIn[k] = v && !NC.ITEMS[v] ? v : null; }
      if (!eq.hair) eq.hair = 'hair_spiky';
      if (s.look && s.look.hair === 'created' && s.appearance) eq.hair = 'hair_look';
      let mine = null;
      if (p.equip) { mine = {}; for (const k of SLOTS) mine[k] = p.equip[k] || null; }
      const wear = keepMine('equip', mine, eq, first);
      p.equip = Object.assign(p.equip || {}, wear);
      p.look = Object.assign({}, s.look || {}); // replaced whole: removed wardrobe slots return to real gear
      p.appearance = s.appearance ? Object.assign({}, s.appearance) : null;
      try { NC.applyGear(game); } catch (e) { console.warn('online: applyGear', e); }
    }
    if (s.hotbar) {
      const hb = {}, mine = p.hotbar ? {} : null; // (every key: the server's record may name only the slots in use)
      for (const k of new Set(KEYS8.concat(Object.keys(s.hotbar)))) { hb[k] = s.hotbar[k] || null; if (mine) mine[k] = p.hotbar[k] || null; }
      p.hotbar = keepMine('hotbar', mine, hb, first || p.job !== jobBefore);
    }
    if (Array.isArray(s.owned) && (s.owned !== lastOwned || W.resyncing)) { lastOwned = s.owned; p.owned = new Set(s.owned); } // (a delta brings a new list only when it changed)
    // The creator hair is a virtual item belonging to the saved appearance, even while another hairstyle is worn.
    if (p.owned) { if (s.appearance) p.owned.add('hair_look'); else p.owned.delete('hair_look'); }
    keepTrade(p, s, first);
    if (s.gold !== undefined) p.gold = s.gold;
    // the server's numbers win over the local sheet
    if (s.maxHp) p.maxHp = s.maxHp;
    if (s.maxSp) p.maxSp = s.maxSp;
    if (s.hp !== undefined) p.hp = s.hp;
    if (s.sp !== undefined) p.sp = s.sp;
    if (!first && p.lv > lvBefore) {
      FX.text(p.x, p.y - 190, 'LEVEL UP!', '#ffd65c', 64);
      FX.ring(p.x, p.y - 10, 30, 230, '255,214,92', 0.7, 14);
      FX.stars(p.x, p.y - 60, 16, '255,220,110', { speed: 320 });
      NC.HUD.log(`เลเวลอัพ! Base Lv ${p.lv}`, 'level');
      if (!p.atk.on) NC.Anim.play(p.anim, 'cheer');
    }
    if (!first && p.jobLv > jobLvBefore && p.job === jobBefore) { // (not a job change undone)
      FX.text(p.x, p.y - 250, 'JOB LEVEL UP!', '#9fe0ff', 52);
      NC.HUD.log(`Job เลเวลอัพ! Job Lv ${p.jobLv}`, 'job');
    }
    for (const h of W.selfHooks) { try { h(s, first); } catch (e) { console.warn('online: self hook', e); } }
    if (!same(resetUsedBefore, p.skillResetUsed) && NC.Shop && NC.Shop.render) NC.Shop.render();
  }

  // the EXP bars read the server's tables for the hero's own level
  const baseXpNext = NC.xpNext, baseJobNext = NC.jobNext;
  NC.xpNext = function (lv) { const s = snap && snap.self; return s && s.xpNext && lv === s.lv ? s.xpNext : baseXpNext.apply(this, arguments); };
  if (baseJobNext) NC.jobNext = function (lv) { const s = snap && snap.self; return s && s.jobXpNext && lv === s.jobLv ? s.jobXpNext : baseJobNext.apply(this, arguments); };

  // ---------------- monsters: mirrors of the server's ----------------
  const unknown = new Set();
  // the camp's straw dummies (js/dummy.js) are the server's dummy_* monsters
  const DUMMY = { dummy_plain: 0, dummy_armored: 1, dummy_undead: 2 };
  function makeMirror(m) {
    if (m.type in DUMMY && NC.makeDummy && NC.DUMMY_KINDS) {
      const e = NC.makeDummy(DUMMY[m.type], m.x, m.y);
      e.online = true; e.sid = m.id; e.stype = m.type; e.tx = e.sx = e.wx = m.x; e.ty = e.sy = e.wy = m.y; e.sort = m.y; // (stype: its type stays 'dummy' for dummy.js / questauto.js)
      game.enemies.push(e);
      return e;
    }
    if (!NC.MONSTERS[m.type]) { if (!unknown.has(m.type)) { unknown.add(m.type); console.warn('online: no art for monster', m.type); } return null; }
    let e;
    try { e = NC.makeEnemy(m.type, m.x, m.y, m.lv || 1); } catch (err) { console.warn('online: makeEnemy', m.type, err); return null; }
    e.online = true; e.sid = m.id; e.stype = m.type; // compare the server's type, even if an offline look maps a spawn slot to a species
    e.tx = m.x; e.ty = m.y; e.sx = m.spawnX || m.x; e.sy = m.spawnY || m.y;
    game.enemies.push(e);
    return e;
  }
  function syncMonster(e, m) {
    if (m.x !== undefined) e.tx = m.x;
    if (m.y !== undefined) e.ty = m.y;
    if (m.maxHp) e.maxHp = m.maxHp;
    if (m.hp !== undefined) e.hp = m.hp;
    if (m.lv) e.lv = m.lv;
    if (m.face) e.face = m.face;
    if (m.state && m.state !== e.sstate) { // (against the server's last state: a driver may rename e.state)
      const was = e.state;
      e.sstate = m.state; e.state = m.state; e.t = 0;
      if (m.state === 'strike' && e.type === 'hollow') FX.slash(e.x + e.face * 30, e.y - 60, typeof m.aa === 'number' ? m.aa : e.face > 0 ? 0 : Math.PI, 95, '255,120,120', e.face);
      if (was === 'hop' && e.type === 'slime') e.squash = 1;
      if (m.state === 'hop' && e.type === 'slime') { const a = Math.atan2(e.ty - e.y, e.tx - e.x); e.hvx = Math.cos(a); e.hvy = Math.sin(a); }
    }
    if (typeof m.aa === 'number') e.atkAng = m.aa;
    e.frozen = m.frozen ? Math.max(e.frozen || 0, 0.3) : 0;
    e.st = m.st || null;
    if (NC.OnlineStatuses) NC.OnlineStatuses.sync(e, m);
    e.poison = m.poisoned === true ? e.poison || { t: Infinity, dmg: 0, acc: 0 } : null;
    e.hidden = !!(m.mk && m.mk.hid); // a burrower underground (backend monster_kinds.go): no blow reaches it, AUTO waits
    e.tgt = m.tgt || null;
    if (m.tgt === me) { e.show = Math.max(e.show || 0, 2); }
    for (const h of W.monsterHooks) { try { h(e, m, game); } catch (err) { console.warn('online: monster hook', err); } }
  }
  // every frame: slide to the server's place, the little animations (no AI)
  function mirrorFrame(e, dt) {
    // (js/netsmooth.js: a moment behind, between the two snapshots around that time; else the old slide to the last place)
    if (!(W.follow && W.follow(e, dt))) {
      const k = 1 - Math.exp(-dt * 12);
      const d = Math.hypot(e.tx - e.x, e.ty - e.y);
      if (d > 500) { e.x = e.tx; e.y = e.ty; } else { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; }
    }
    e.t += dt; e.anim += dt;
    e.flash = Math.max(0, e.flash - dt);
    e.show = Math.max(0, e.show - dt);
    e.slow = Math.max(0, (e.slow || 0) - dt);
    e.squash = Math.max(0, (e.squash || 0) - dt * 4);
    e.kbx = e.kby = 0;
    if (e.poison && NC.poisonMotes) NC.poisonMotes(e, dt);
    if (e.dummy) {
      e.wob = Math.max(0, (e.wob || 0) - dt * 2.4); e.state = 'idle'; e.sort = e.y;
      const D = e.dummy; // (6 s without a hit: a new session on the board, as js/dummy.js does offline)
      if (D.first >= 0 && game.time - D.last > 6) Object.assign(D, { log: [], total: 0, hits: 0, max: 0, first: -1, crits: 0, miss: 0 });
      return;
    }
    if (e.type === 'slime') e.z = e.state === 'hop' ? Math.sin(Math.PI * Math.min(1, e.t / 0.42)) * 46 : 0;
    else e.z = e.z || 0;
    if (e.frozen > 0) e.frozen = Math.max(0.05, e.frozen); // (the ice stays while the server says so)
    e.sort = e.y;
  }
  const baseUpdEnemy = NC.updateEnemy;
  NC.updateEnemy = function (g, e, dt) {
    if (e && e.online) { const f = W.mirrorFrames[e.type]; return f ? f(g, e, dt, mirrorFrame) : mirrorFrame(e, dt); }
    return baseUpdEnemy.apply(this, arguments);
  };
  // a hit the web's own code works out (a swing's arc, a skill's blast) changes nothing online: the server's events do
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (g, e) { if (O.status !== 'offline' && e && e.online) { if (g === game) { game.target = e; game.targetT = game.time; } return; } return baseDamage.apply(this, arguments); };
  const baseStatus = NC.statusEnemy;
  NC.statusEnemy = function (g, e) { if (e && e.online) return; return baseStatus.apply(this, arguments); };
  // no local monsters, hurts, EXP or respawns online
  NC.Maps.monsters = function () { return []; };
  const baseHurt = NC.hurtPlayer;
  NC.hurtPlayer = function () { if (ready) return; return baseHurt.apply(this, arguments); };
  const baseGain = NC.gainXp;
  NC.gainXp = function () { if (ready) return; return baseGain.apply(this, arguments); };

  function syncMonsters(list) {
    if (game.enemies.some((e) => !e.online)) game.enemies = game.enemies.filter((e) => e.online); // (local spawns: the server spawns its own)
    const seen = new Set();
    for (const m of list) {
      seen.add(m.id);
      let e = mirrors.get(m.id);
      if (e && !e.dead && m.type && (e.stype || e.type) !== m.type) { e.dead = true; mirrors.delete(m.id); e = null; } // (a boss that turns into its next form keeps its id)
      if (m.dead > 0) { if (e && !e.dead) killMirror(e, false); continue; }
      if (!e || e.dead) { e = makeMirror(m); if (!e) continue; mirrors.set(m.id, e); }
      syncMonster(e, m);
    }
    for (const [id, e] of mirrors) if (!seen.has(id)) { e.dead = true; mirrors.delete(id); }
  }
  function killMirror(e, loud) {
    if (e.dead) return;
    e.dead = true; e.hp = 0;
    mirrors.delete(e.sid);
    if (!loud) return;
    FX.puff(e.x, e.y - 30, 9, { speed: 150, color: e.type === 'slime' ? '90,80,150' : '70,60,90' });
    FX.stars(e.x, e.y - 50, 6, e.type === 'slime' ? '190,160,255' : '255,210,120', { speed: 220 });
  }

  // ---------------- events: hits, kills, rewards, the others' swings and skills ----------------
  const numTop = (e) => (NC.labelTop ? NC.labelTop(e) - 52 : e.y - 200);
  function onCombat(ev) {
    if (ev.pvp && W.pvpCombat && W.pvpCombat(ev)) return; // (a duel's hit: online/pvp.js)
    const p = game.player;
    const e = mirrors.get(ev.targetId);
    if (e) {
      if (NC.Auto && NC.Auto.combat) NC.Auto.combat(game, e, ev, ev.sourceId === me || ev.actorId === me);
      e.show = 3;
      if (ev.sourceId === me || ev.actorId === me) { game.target = e; game.targetT = game.time; }
      // (refused: the server would not land our blow, backend hit_refusal.go; the web has no such case, so its MISS)
      if (ev.evade || ev.miss || ev.refused) {
        if (!ev.dot) { e.numDir = -(e.numDir || 1); FX.dmg(e.x, numTop(e), ev.evade ? 'EVADE' : 'MISS', { size: 32, fill: '#cfd8ff', dir: e.numDir }); }
        return;
      }
      if (typeof ev.hp === 'number') e.hp = ev.hp;
      if (ev.dot) {
        const fill = NC.OnlineMeters && NC.OnlineMeters.dotFill(ev.skillId);
        if (ev.damage > 0 && NC.enemyDotLooks) NC.enemyDotLooks(e, ev.damage, fill ? { fill } : undefined);
        if (ev.dead) killMirror(e, true);
        return;
      }
      e.flash = 0.14;
      if (e.dummy) { // (the dummy's DPS board, js/dummy.js)
        const D = e.dummy, got = Math.round(ev.damage || 0);
        if (D.first < 0) D.first = game.time;
        D.last = game.time; D.total += got; D.hits++; D.max = Math.max(D.max, got); if (ev.crit) D.crits++;
        D.log.push([game.time, got]);
        while (D.log.length && game.time - D.log[0][0] > 5) D.log.shift();
        e.wob = Math.min(1.2, (e.wob || 0) + 0.35);
      }
      const mine = ev.sourceId === me || ev.actorId === me;
      const show = () => {
        const fill = ev.crit ? '#ffe066' : mine ? '#ffffff' : '#c9d3e8';
        // The offline helper gives each blow at least one point. Preserve an authoritative zero exactly.
        // (sid + mine: my skill's number in my job's colour and beats, on the ladder, as offline: js/dmgburst.js, Discord #129)
        if (NC.enemyHitLooks && Math.round(ev.damage || 0) > 0) NC.enemyHitLooks(e, { dmg: Math.round(ev.damage || 0), crit: !!ev.crit, hits: ev.hits, sid: mine ? ev.skillId : undefined, mine }, { fill });
        else {
          e.numDir = -(e.numDir || 1);
          FX.dmg(e.x, numTop(e), Math.round(ev.damage || 0), { size: ev.crit ? 60 : 44, fill, crit: !!ev.crit, dir: e.numDir });
          FX.sparks(e.x, e.y - 45, 5, '255,255,255');
        }
        // (the hit's feel: embers, impact burst, flash, light, sound - js/hitfeel.js plays it from NC.damageEnemy offline)
        if (NC.HitFeel && NC.HitFeel.play) NC.HitFeel.play(game, e, { dmg: ev.damage || 0, crit: !!ev.crit, skill: !!ev.skillId }, 0, { quiet: !mine, killed: !!ev.dead }); // (skillId: a skill's hit blinks and jolts harder)
        // (a skill whose look leaves its hit burst to the server's hit, e.g. js/maplebow.js rg_triple: Discord #129)
        const SH = mine && NC.SKILL_SERVER_HIT && NC.SKILL_SERVER_HIT[ev.skillId];
        if (SH) SH(e, game.player, ev);
      };
      if (mine || !NC.OtherFX) show(); else NC.OtherFX.run(show); // (another player's hit: its number and sparks at a share, js/otherfx.js)
      if (ev.dead) killMirror(e, true);
      return;
    }
    if (ev.targetId === me) {
      if (ev.miss) { FX.num(p.x, p.y - 150, ev.lucky ? 'Lucky!' : 'MISS', { fill: ev.lucky ? '#ffe28a' : '#cfd8ff', size: 34 }); return; }
      if (typeof ev.hp === 'number') p.hp = Math.max(0, ev.hp);
      p.hurt = 0.3; p.lastFight = game.time;
      game.shake = Math.max(game.shake, 9);
      FX.num(p.x, p.y - 150, Math.round(ev.damage || 0), { fill: '#ff6b6b', size: 42 });
      const src = mirrors.get(ev.sourceId);
      if (src) lastHitBy = src;
      return;
    }
    const r = remotes.get(ev.targetId);
    if (r && ev.damage) (NC.OtherFX ? NC.OtherFX.run : (f) => f())(() => FX.num(r.x, r.y - 150, Math.round(ev.damage), { fill: '#ff9b9b', size: 30 }));
  }
  let lastHitBy = null;
  function onReward(ev) {
    const p = game.player, e = mirrors.get(ev.monsterId) || null;
    const parts = [];
    const xk = ev.test > 1 ? ` (x${Math.round(ev.test * 10) / 10})` : ''; // (the beta test's EXP x1.5: server patch 015, online/expx5.js)
    if (ev.xp) parts.push(`+${Math.round(ev.xp).toLocaleString()} EXP${xk}`);
    if (ev.jobXp) parts.push(`+${Math.round(ev.jobXp).toLocaleString()} Job EXP${xk}`);
    if (ev.gold) parts.push(`+${ev.gold} เหรียญ`);
    const name = (NC.MONSTERS[ev.monsterType] && NC.MONSTERS[ev.monsterType].name) || ev.monsterType || '';
    if (parts.length) NC.HUD.log(`ปราบ ${name} · ${parts.join(' · ')}`, 'exp');
    // the EXP orbs fly to the hero (looks only: the numbers are the server's)
    const x = e ? e.x : p.x + NC.rand(-120, 120), y = e ? e.y : p.y;
    for (let i = 0; i < 4; i++)
      FX.add({ type: 'orb', x, y: y - 40, vx: NC.rand(-220, 220), vy: NC.rand(-260, -60), drag: 3, life: 3,
        update(o, dt) {
          if (o.t < 0.35) return;
          const pl = game.player, d = NC.dist(o.x, o.y, pl.x, pl.y - 60), sp = 500 + o.t * 900;
          o.vx = ((pl.x - o.x) / d) * sp; o.vy = ((pl.y - 60 - o.y) / d) * sp;
          if (d < 30) o.dead = true;
        } });
  }
  const IGNORE_ERR = new Set(['rate_limit', 'cooldown', 'not_ready', 'busy']);
  function onEvent(ev) {
    if (!game || !ev) return;
    switch (ev.type) {
      case 'combat': onCombat(ev); break;
      case 'reward': onReward(ev); break;
      case 'attack': if (ev.actorId !== me) remoteAttack(ev); break;
      case 'skill': case 'cast':
        if (ev.auto) autoSkill(ev);
        else if (ev.actorId !== me && ev.sourceId !== me) remoteSkill(ev);
        break;
      case 'lootPickup': lootPicked(ev); break;
      case 'error':
        // (a drop asked for in passing and refused is no news: the walk-over pickup tries again by itself, Discord #187)
        if (!IGNORE_ERR.has(ev.code) && ev.message && !/cooling down|too soon|not ready|busy|rate|^loot (claim )?(not owned or )?out of range|^loot gone|loot actions/i.test(ev.message)) { if (game.time - (errT[ev.message] || -9) > 3) { errT[ev.message] = game.time; NC.HUD.log(thaiError(ev), 'warn'); } }
        break;
      case 'quest': if (ev.title && ev.op) NC.HUD.log(`เควส: ${ev.title}`, 'sys'); break;
      case 'connection_error': badge(ev.retrying ? 'กำลังต่อใหม่…' : 'หลุดการเชื่อมต่อ', true); break;
      case 'server_shutdown': NC.HUD.log('เซิร์ฟเวอร์กำลังรีสตาร์ท เดี๋ยวต่อให้ใหม่', 'warn'); break;
      default: break;
    }
    if (NC.OnlineMeters) NC.OnlineMeters.event(ev);
    if (NC.OnlineWisp) NC.OnlineWisp.event(ev);
    if (NC.OnlinePets) NC.OnlinePets.event(ev); // (the summons: js/online-pets.js, -wolfhunter.js, -puppeteer.js)
    if (NC.OnlineWolf) NC.OnlineWolf.event(ev);
    if (NC.OnlinePuppet) NC.OnlinePuppet.event(ev);
    if (NC.OnlineStatuses) NC.OnlineStatuses.event(ev, game);
  }
  const errT = {};
  function thaiError(ev) {
    const m = String(ev.message || '');
    if (/too far|out of range|reach/i.test(m)) return 'ไกลเกินไป';
    if (/not enough sp/i.test(m)) return 'SP ไม่พอ';
    if (/already full/i.test(m)) return 'เต็มอยู่แล้ว ไม่ต้องดื่มยา'; // (potions.go drinkPotion: HP / SP at the top)
    if (/not learned|unsupported/i.test(m)) return 'ยังใช้สกิลนี้ไม่ได้';
    // (the build resets: character_customization.go resetBuild, actions.go)
    if (/merchant is in camp/i.test(m)) return 'รีเซ็ตสกิลได้ที่ร้านลุงโกโก้กลางค่าย';
    if (/not enough coins/i.test(m)) return 'เหรียญไม่พอ';
    if (/no allocated (skill|status) points/i.test(m)) return /skill/i.test(m) ? 'ยังไม่ได้ลงแต้มสกิล' : 'ยังไม่ได้ลงแต้มสเตตัส';
    if (/revive before resetting/i.test(m)) return 'ฟื้นก่อนแล้วค่อยรีเซ็ต';
    if (/finish before changing your build/i.test(m)) return 'รอท่าโจมตีหรือสกิลจบก่อน แล้วค่อยเปลี่ยนสเตตัส/สกิล';
    return m;
  }

  // ---------------- the other heroes: net.js's remotes, fed by the snapshot ----------------
  const remotes = new Map(); // server id -> net.js remote (filled in by net.js; read here for numbers over heads)
  // Chat's public server API is shared with the legacy client. Keep `active` alone: game.js uses that flag to select
  // the legacy renderer; the modular client deliberately keeps the web engine and its wrapped updatePlayer.
  O.remotes = remotes;
  O.getState = () => ({ status: O.status, active: O.enabled, ready: ready && O.status === 'online',
    playerId: me || '', matchId: O.matchId || '', mapId: snap?.mapId || '', channelId: snap?.channelId || '',
    lastSnapshot: snap, rttMs: O.rtt });
  O.chat = async function (action, fields = {}) {
    if (!ready || O.status !== 'online' || !O.socket?.open) throw new Error('ยังไม่ได้เชื่อมต่อแชต กรุณารอเข้าเกม');
    const socket = O.socket, origin = O.origin, player = me;
    const reply = await O.rpc('nc_chat', { ...fields, action });
    if (!ready || O.status !== 'online' || O.socket !== socket || !socket.open || O.origin !== origin || me !== player) return null;
    return reply;
  };
  const roomHandlers = [], actionHandlers = [], peers = new Map(); // server id -> { peer, presence }
  const acts = new Map(); // server id -> [clip, seq, speed]
  const casts = new Map(); // server id -> [seq, skillId, lv, x, y, aim, tx, ty, 1]
  let actSeq = 0;
  function remoteAttack(ev) {
    const r = NC.Net && NC.Net.remotes.get(ev.actorId);
    const known = name => typeof name === 'string' && Object.prototype.hasOwnProperty.call(NC.Anim.CLIPS, name);
    const named = typeof ev.clip === 'string' ? ev.clip : ev.clip && ev.clip.name;
    if (!ev.actorId) return;
    let clip = known(named) ? named : null;
    if (!clip) {
      // Older servers send AttackClip timing without its name. Resolve the accepted weapon's combo step.
      const weapon = typeof ev.weapon === 'string' ? NC.ITEMS[ev.weapon] : null;
      if (typeof ev.weapon === 'string' && (!weapon || weapon.slot !== 'weapon')) return;
      const W = weapon || (r && NC.weaponDef(r)), step = ev.step ?? 0;
      if (!W || !Number.isInteger(step) || step < 0 || step > 2) return;
      clip = NC.Anim.setOf(NC.Anim.movesFor(null, W)).combo(W.style || 'swing')?.[step];
    }
    if (!known(clip)) return;
    const seq = Number.isSafeInteger(ev.seq) ? ev.seq : null, seen = r && r.lastOnlineAttack;
    if (seq !== null && seen && seen.seq === seq && seen.clip === clip && seen.match === O.matchId && seen.socket === O.socket) return;
    if (r) r.lastOnlineAttack = { seq, clip, match: O.matchId, socket: O.socket };
    acts.set(ev.actorId, [clip, ++actSeq, ev.speed || 1]);
    publishRemoteAction(ev.actorId, ev);
  }
  function remoteSkill(ev) {
    const id = ev.actorId || ev.sourceId;
    if (!id || !ev.skillId) return;
    casts.set(id, [++actSeq, ev.skillId, ev.lv || ev.skillLv || 1, ev.x, ev.y, ev.aim || 0, ev.targetX != null ? ev.targetX : ev.x, ev.targetY != null ? ev.targetY : ev.y, 1]);
    publishRemoteAction(id, ev);
  }
  // Events arrive every simulation tick, independently of snapshots. Publish just
  // this known actor's action so two events cannot overwrite one snapshot slot.
  function publishRemoteAction(id, ev) {
    const peer = peers.get(id);
    if (!peer) return; // first presence still establishes counters without replaying old actions
    const pr = { ...peer.presence, ac: acts.get(id) || null, cs: casts.get(id) || null };
    if (Number.isFinite(ev.aim)) { pr.am = ev.aim; pr.f = Math.cos(ev.aim) >= 0 ? 1 : -1; }
    peer.presence = pr;
    for (const h of actionHandlers) { try { h(id, pr); } catch (e) { console.warn('online: action', e); } }
  }
  function presenceOf(pl, mapId, serverTime) {
    const hpPct = pl.maxHp ? Math.round((100 * Math.max(0, pl.hp || 0)) / pl.maxHp) : 100;
    const eq = equipOf(pl.equip, pl.look, pl.appearance);
    let lk = null;
    if (pl.look && pl.look.hair === 'created' && pl.appearance) { eq.hair = 'hair_look'; lk = keyOf(pl.appearance); }
    const pr = {
      v: 1, nm: pl.name || 'ผู้เล่น', mp: mapId, x: pl.x, y: pl.y, tm: serverTime, f: pl.face < 0 ? -1 : 1, am: pl.aim || 0,
      mv: pl.moving ? 1 : 0, rn: pl.moving ? 1 : 0, cb: 0, dd: pl.dead > 0 ? 1 : 0, ds: 0, st: pl.sit ? 1 : 0,
      eq, lk, mo: pl.moves ? [pl.moves.idle || 'idle', pl.moves.set || 'basic'] : ['idle', 'basic'],
      lv: pl.lv || 1, jb: pl.job || 'traveler', hp: hpPct, ac: acts.get(pl.id) || null, cs: casts.get(pl.id) || null,
      ud: pl.id, // (js/guild.js reads it: the guild window's invite list)
    };
    for (const h of W.presenceHooks) { try { h(pl, pr); } catch (e) { console.warn('online: presence', e); } }
    return pr;
  }
  function syncPlayers(list, mapId, serverTime) {
    const seen = new Set();
    for (const pl of list) {
      if (pl.id === me) continue;
      seen.add(pl.id);
      peers.set(pl.id, { peer: pl.id, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: presenceOf(pl, mapId, serverTime), updatedAt: Date.now() });
    }
    for (const id of [...peers.keys()]) if (!seen.has(id)) peers.delete(id);
    for (const id of remotes.keys()) if (!seen.has(id)) remotes.delete(id);
    const all = roomPeers();
    for (const h of roomHandlers) { try { h({ peers: all, joined: [], left: [], updated: [] }); } catch (e) { console.warn('online: peers', e); } }
    if (NC.Net) for (const [id, r] of NC.Net.remotes) if (seen.has(id)) remotes.set(id, r);
  }
  const roomPeers = () => [{ peer: me || 'me', by: null, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: {}, updatedAt: Date.now() }, ...peers.values()];
  // net.js asks for a room (its connect(): NC.Online.room); chat.js's lines ride its presence field cq
  const sentChat = new Set();
  O.room = function () {
    return {
      presence(s) {
        if (s && Array.isArray(s.cq)) for (const line of s.cq) sendChat(line);
        if (s) for (const h of W.outHooks) { try { h(s); } catch (e) { console.warn('online: own presence', e); } }
        return Promise.resolve();
      },
      onAction(h) { actionHandlers.push(h); },
      onPeers(h) { roomHandlers.push(h); setTimeout(() => h({ peers: roomPeers(), joined: [], left: [], updated: [] }), 0); return () => {}; },
      peers: roomPeers,
      onConnection(h) { O.on('status', (s) => h(s === 'online')); setTimeout(() => h(O.status === 'online'), 0); return () => {}; },
      connected: () => O.status === 'online',
    };
  };
  function sendChat(line) {
    const [seq, ch, to, text] = line;
    const key = seq + ':' + ch + ':' + text;
    if (sentChat.has(key)) return;
    sentChat.add(key);
    const req = { action: 'send', requestId: rid(), ch, text: String(text || '').slice(0, 200) };
    if (ch === 'w' && to) req.toPeer = String(to);
    O.rpc('nc_chat', req).catch((e) => NC.Chat && NC.Chat.add({ ch: 'sys', kind: 'warn', text: (e && e.message) || 'ส่งข้อความไม่ได้' }));
  }
  const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2) + 'xxxxxxxx');
  // the server's chat notifications (backend chat.go: {type: 'chat', message: {id, ch, text, from, peer, to, ...}})
  O.on('notification', (n) => {
    if (!ready || O.status !== 'online' || !n || Number(n.code) !== 101) return;
    let box = n.content;
    try { if (typeof box === 'string') box = JSON.parse(box); } catch (_) { return; }
    if (box?.type === 'chat' && box.message) NC.Chat?.receiveOnline?.(box.message);
  });

  // ---------------- loot on the ground (only the hero's own is sent) ----------------
  function lootLook(l) {
    const o = { kind: 'loot', online: true, sid: l.id, x: l.x, y: l.y, sort: l.y, t: 0, z: 0, vz: 480, spin: NC.rand(0, 6) };
    const id = l.itemId || '';
    lootInfo.set(l.id, { material: l.material || '', itemId: !l.material && NC.ITEMS[id] ? id : '', count: l.count || 1, gold: l.material ? 0 : l.gold || 0 });
    if (lootInfo.size > 400) lootInfo.delete(lootInfo.keys().next().value);
    if (l.material) o.mat = l.material;
    else if (/^(red|blue)(_[ml])?$/.test(id)) { o.potion = id.startsWith('red') ? 'red' : 'blue'; o.size = (id.split('_')[1]) || 's'; }
    else if (id && NC.ITEMS[id]) { o.id = id; if (l.inst) o.inst = l.inst; }
    else if (l.gold) o.mat = 'coin';
    else o.potion = 'red';
    return o;
  }
  function syncLoot(list) {
    const seen = new Set();
    for (const l of list || []) {
      seen.add(l.id);
      if (lootMirrors.has(l.id)) continue;
      const o = lootLook(l);
      lootMirrors.set(l.id, o);
      game.loot.push(o);
    }
    for (const [id, o] of lootMirrors) if (!seen.has(id)) { o.done = true; lootMirrors.delete(id); }
  }
  function lootPicked(ev) {
    const p = game.player, info = lootInfo.get(ev.lootId);
    if (info) { ev = Object.assign({}, info, ev); lootInfo.delete(ev.lootId); }
    if (!ev.material && !ev.itemId && info && info.gold) { NC.HUD.log(`ได้รับ ${info.gold.toLocaleString('en-US')} เหรียญ`, 'item'); }
    if (NC.Lessons) NC.Lessons.ev('loot'); // The server confirmed this hero's pickup, including potions and equipment.
    FX.stars(p.x, p.y - 70, 10, '255,230,150', { speed: 220, size: 0.8 });
    const what = ev.material ? (NC.MATERIALS && NC.MATERIALS[ev.material] && NC.MATERIALS[ev.material].name) || ev.material
      : ev.itemId && NC.ITEMS[ev.itemId] ? NC.ITEMS[ev.itemId].name : ev.itemId || '';
    if (what) NC.HUD.log(`ได้รับ ${what}${ev.count > 1 ? ' x' + ev.count : ''}`, 'item');
  }
  // what each drop was (lootLook), kept a while after it leaves the snapshot: the server's 'lootPickup' says only its id,
  // so the "ได้รับ ..." line had nothing to name (Discord #187, 2026-10-21)
  const lootInfo = new Map();
  const baseLoot = NC.updateLoot;
  let pickT = 0;
  NC.updateLoot = function (g, dt) {
    if (!ready) return baseLoot.apply(this, arguments);
    const p = g.player;
    pickT -= dt;
    for (const l of g.loot) {
      if (!l.online) continue;
      l.t += dt;
      if (l.vz || l.z > 0) { l.vz -= 1600 * dt; l.z += l.vz * dt; if (l.z <= 0) { l.z = 0; l.vz = l.vz < -200 ? -l.vz * 0.35 : 0; } }
      // walk over it (or stand near): ask the server; it checks the reach and the owner
      // (Discord #187, 2026-10-21: walking over a drop the hero was already past it on the server - his server spot runs
      // behind the screen's - so the one plain pickup was "too far" and the next try came too late. A claim first: the
      // server remembers the hero touching the drop for a second and reserves it, and a reserved drop's pickup reaches far)
      // (one ask every 0.3 s - the first one two commands - stays inside the server's loot budget, 8 a second; a drop still
      // refused after 6 asks - where the server's hero can't reach it - rests 5 s and is claimed again after; gear is
      // not asked for into a full bag)
      if (p.dead <= 0 && l.t > 0.6 && pickT <= 0 && NC.dist(l.x, l.y, p.x, p.y) < 110 && !l.asked && !(l.inst && NC.GEAR && NC.GEAR.room && !NC.GEAR.room(p))) {
        l.asked = true; pickT = 0.3;
        if (!l.claimed) { l.claimed = true; O.pickup(l.sid, 'claim'); } // (once: a reservation stands)
        O.pickup(l.sid);
        l.asks = (l.asks || 0) + 1;
        setTimeout(() => { l.asked = false; }, l.asks >= 6 ? 5000 : 600);
        if (l.asks >= 6) { l.asks = 0; l.claimed = false; }
      }
    }
    g.loot = g.loot.filter((l) => !l.done);
  };

  // ---------------- the hero's input: moves, swings, skills, potions, warps ----------------
  let sentMove = null, sentAt = 0, lastAtkKey = '', reviveAt = 0;
  function attackTarget(g) {
    const locked = NC.Auto && NC.Auto.on && NC.Auto.target;
    return [locked, g.hover, g.target].find(e => e && e.online && !e.dead && e.hp > 0 && e.state !== 'return') || null;
  }
  const baseUpdPlayer = NC.updatePlayer;
  NC.updatePlayer = function (g, dt) {
    if (!ready || g !== game) return baseUpdPlayer.apply(this, arguments);
    const p = g.player, s = snap && snap.self;
    const dead = !!(s && s.dead > 0);
    if (dead) {
      // fallen (the server says so): the fallen screen's ฟื้นที่ค่าย asks the server, nothing stands up here
      // (a guild war land: the server brings the hero back by itself, at the fire picked: online/gwar.js)
      if (!s.gwar && p.dead > 0 && p.dead <= 0.12 && performance.now() - reviveAt > 1200) { reviveAt = performance.now(); O.action({ action: 'revive' }); }
      const wait = s.gwar && s.gwar.down ? Math.max(0.3, s.gwar.down.left) : s.revive && typeof s.revive.in === 'number' ? s.revive.in : 3;
      // the fallen screen's countdown follows the server's; at its end it runs down here and the revive goes out by
      // itself, as offline (2026-10-18: it was held at 0.3 for good, the screen sat on "ฟื้นที่ค่าย 1" and an AUTO
      // farm or quest stood still until someone clicked)
      if (!(p.dead > 0)) p.dead = Math.max(s.gwar ? 0.3 : 2.6, wait); // (2.6 s: entities.js's own fall)
      else if (wait > 0.3 || s.gwar) p.dead = Math.max(0.3, wait);
      else if (p.dead <= 0.12) p.dead = 0.3; // (asked above: the server's answer stands him up)
    } else if (p.dead > 0) p.dead = 0;
    // A local clip can finish before the server's finisher recovery. Wait for its remaining cooldown
    // instead of drawing a new swing whose only attack command will be rejected.
    if (!p.atk.on && s && s.cd && s.cd.attack > 0) {
      const age = Number.isFinite(O.lastSnapAt) ? Math.max(0, (Date.now() - O.lastSnapAt) / 1000) : 0;
      p.atk.cd = Math.max(p.atk.cd || 0, s.cd.attack - age);
    }
    if (s && s.cd) syncSkillCd(p, s.cd);
    p._walkInput = null;
    // the keys as the server takes them: one unit way. A keyboard diagonal is (1, 1) on the web, √2 as fast, but the
    // keys go to the server as a unit way (below; match.go holdMove), so the prediction walks that way too; else a
    // diagonal ran 41% ahead of the server and was pulled back all the time
    const I = g.input, kx = I.mx, ky = I.my, kl = Math.hypot(kx, ky);
    if (kl > 1) { I.mx = kx / kl; I.my = ky / kl; }
    const x0 = p.x, y0 = p.y;
    const r = baseUpdPlayer.apply(this, arguments);
    if (kl > 1 && I.mx === kx / kl && I.my === ky / kl) { I.mx = kx; I.my = ky; }
    if (dead) { p.hp = 0; return r; }
    holdWalk(g, p, s, x0, y0);
    // a new swing of the combo (started here or by any wrapper since the last frame): the server swings too (it checks
    // the reach and the speed)
    const atk = p.atk.on ? p.atk.serial || p.atk.step + ':' + p.atk.name + ':' + (p.atk.x0 || 0) + ':' + (p.anim.act || '') : '';
    if (atk && atk !== lastAtkKey) {
      lastAtkKey = atk;
      const t = attackTarget(g);
      O.attack(Number.isFinite(p.atk.ang) ? p.atk.ang : p.aim, t ? t.sid : undefined);
    }
    if (!p.atk.on) lastAtkKey = '';
    // the keys: sent when they change, and every 100 ms while held (the server lets a held key run out)
    let dx = I.mx, dy = I.my;
    if (p.channel || p.dash || p.dead > 0 || g.hold) dx = dy = 0; // (hold, not paused: AUTO walks on behind an open window, js/keeprun.js)
    // (going round a prop, js/passprops.js, the keys still go: the server steers round it from its own spot with the
    // same rule, backend walk_round.go. Sending the turned way instead made the server slide into the prop from its
    // own, slightly different spot and stand there while the hero walked on: the tug back of 2026-10-18.)
    if (dx || dy) { const l = Math.hypot(dx, dy); dx /= l; dy /= l; }
    const mv = [+dx.toFixed(3), +dy.toFixed(3)].join(',');
    const now = performance.now();
    if (mv !== sentMove || ((dx || dy) && now - sentAt > 100) || now - sentAt > 1000) {
      O.move(dx, dy, p.aim || 0, true);
      sentMove = mv; sentAt = now;
    }
    reconcile(p, dt, !!(dx || dy));
    return r;
  };
  // the server's hold on the walk the web's own wrappers cannot see online: a cast bar stands him (combat.go: speed 0
  // while casting). Done as hstatus.js does: the frame's step scaled, a dash left alone. Without it the prediction ran
  // on while the server's hero stood, and was pulled back. (A stun, freeze or sleep, and a slow's 60%, come through
  // p.hst: online/herostatus.js puts the server's statuses there and js/hstatus.js scales the step itself; scaling them
  // here too walked a slowed hero at 36%.)
  function serverWalk(s) {
    return s && s.casting ? 0 : 1;
  }
  function holdWalk(g, p, s, x0, y0) {
    const k = serverWalk(s);
    if (k >= 1 || p.dash || p.dead > 0) return;
    const nx = x0 + (p.x - x0) * k, ny = y0 + (p.y - y0) * k;
    if (!g.world || g.world.fits(nx, ny, p.r || 20)) { p.x = nx; p.y = ny; p.sort = p.y; }
    if (!k) { p.vx = p.vy = 0; p.moving = p.running = false; }
  }
  // the hero's place: the keys move him at once; the server's place pulls him back when they drift apart
  let blockedCorrection = null;
  // how far the hero may walk ahead of the server's last place: what he walks in a round trip (online/conn.js pings)
  // and a snapshot gap or two, never under the old 70 px (a fixed 70 px pulled a fast hero on a slow line back all the
  // time). Clamped well under the 420 px snap. Just after the keys go, the lead they went with stays until the server's
  // own stop can have come back (it gets the stop a trip later, then coasts as this hero did); then 6 px. (Before, the
  // 6 px came at once: every stop pulled the hero back toward where the server still was, then on again.)
  const WALK_LEAD = 70, IDLE_LEAD = 6, LEAD_GAP = 0.15, LEAD_RTT = 0.6, SETTLE_COAST = 0.25;
  let settle = null; // { lead, left } after the keys go
  const rttOf = () => { const O = NC.Online; return O && Number.isFinite(O.rtt) && O.rtt > 0 ? Math.min(O.rtt / 1000, LEAD_RTT) : 0.1; };
  const settleTime = () => rttOf() + LEAD_GAP + SETTLE_COAST;
  function walkLead(p) { return Math.max(WALK_LEAD, Math.hypot(p.vx || 0, p.vy || 0) * (rttOf() + LEAD_GAP)); }
  function leadNow(p, dt, moving) {
    if (moving) { const lead = walkLead(p); settle = { lead, left: settleTime() }; return lead; }
    if (settle && (settle.left -= dt) > 0) return settle.lead;
    settle = null;
    return IDLE_LEAD;
  }
  function reconcile(p, dt, moving) {
    const s = snap && snap.self;
    if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.y)) return;
    const ex = s.x - p.x, ey = s.y - p.y, d = Math.hypot(ex, ey);
    const world = game.world, radius = p.r || 20;
    // An old correction may have embedded the prediction in a prop. Recover only
    // to the server's known position; never invent a local hop across the map.
    if (d > 420 || (!p.dash && !world.fits(p.x, p.y, radius) && world.fits(s.x, s.y, radius))) {
      blockedCorrection = null;
      p.x = s.x; p.y = s.y; p.vx = p.vy = 0; p.sort = p.y; return;
    }
    const lead = leadNow(p, dt, moving), walking = lead > IDLE_LEAD; // (while walking the server is a round trip behind)
    if (d > lead) {
      const k = (1 - Math.exp(-dt * (walking ? 3 : 8))) * (1 - lead / d);
      // Prediction follows a detour; a straight interpolation to a delayed
      // snapshot must obey the same collision as walking around that obstacle.
      const x = p.x, y = p.y;
      if (p.dash) NC.rushMove(world, p, ex * k, ey * k, p.dash);
      else NC.tryMove(world, p, ex * k, ey * k);
      if (!p.dash && Math.hypot(p.x - x, p.y - y) < .1 && world.fits(s.x, s.y, radius)) {
        if (!blockedCorrection || blockedCorrection.hero !== p || blockedCorrection.world !== world)
          blockedCorrection = { hero: p, world, time: 0, tick: null, snapshots: 0 };
        const b = blockedCorrection;
        b.time += dt;
        if (Number.isFinite(snap.tick) && snap.tick !== b.tick) { b.tick = snap.tick; b.snapshots++; }
        // If multiple fresh snapshots still place an idle hero across the prop,
        // settle to that authoritative position instead of remaining on the wrong side.
        // (Walking: once the server has had a round trip and a coast to come round too. Two heroes that walk round
        // a prop by the same rule can still part at a tight spot between props, one through and one held: the hero
        // held on the screen waited for the 420 px snap.)
        if (b.time >= (walking ? settleTime() : 1) && b.snapshots >= 3) {
          p.x = s.x; p.y = s.y; p.vx = p.vy = 0; blockedCorrection = null;
        }
      } else blockedCorrection = null;
    } else blockedCorrection = null;
    p.sort = p.y;
  }

  // skills: the server casts them (its SP, cooldowns, hits); here only their looks play. They play on a copy of the game
  // that keeps what the server was sent at the press: the aimed point and the facing, which the server locks when the
  // cast starts (backend/server/combat.go castSkill; offline js/casting.js reads the mouse again when the bar fills), and
  // views of the monsters, so Holy Light's beam falls on the monster the server picks (skills_runtime.go skillTarget)
  // and a shot ends on the first monster in its way. A cast bar's release plays the held look and sends nothing: the
  // press already did (2026-10-18 tester: Magnus drawn where the mouse was 3 s later, Holy Light on the bare mouse point,
  // and the release sent the skill a second time)
  const baseCast = NC.castSkill;
  let held = null; // the look of the cast whose bar is filling: { id, key, aim, look, see }
  NC.castSkill = function (g, p, key) {
    if (!ready || g !== game || p !== game.player) return baseCast.apply(this, arguments);
    if (p.castNow) return release(this, p, key); // (js/casting.js finish: the bar is full)
    if (p.casting && !(p.channel && p.channel.cast) && NC.cancelCast) NC.cancelCast(g, p); // (Discord #175: a cast left without its bar)
    if (p.casting) return false; // (one cast at a time: js/casting.js turns it down, the server too)
    if (p.channel && (p.channel.life || p.channel.fish)) return false; // (working a tree / a vein / a pond: the server refuses skills while gathering)
    // stopped or silenced on the server (online/herostatus.js puts its statuses on p.hst): js/hstatus.js says so over the
    // head and nothing is sent (2026-10-18 tester: the server refused it while the look played and the cooldown ran)
    if (NC.HS && NC.HS.noSkill(p)) return baseCast.apply(this, arguments);
    const id = NC.skillForKey(p, key);
    if (!id) return false;
    if (!O.supports(id)) {
      if (game.time - (p.noSpT || -9) > 1) { p.noSpT = game.time; FX.num(p.x, p.y - 170, 'ยังไม่เปิดออนไลน์', { fill: '#8fc8ff', size: 30 }); }
      return false;
    }
    if (NC.skillCd && NC.skillCd(p, id) > 0) return false;
    if (waiting && waiting.only && waiting.key === key) return false; // (its look still waits for the server's pick, below)
    const t = attackTarget(g), aim = p.aim || 0;
    let tx = g.mouse.active ? g.mouse.wx : p.x + Math.cos(aim) * 300, ty = g.mouse.active ? g.mouse.wy : p.y + Math.sin(aim) * 300;
    // the server refuses any skill whose point is past 700 from the hero (combat.go castSkill "target out of range"), a
    // heal or a party buff too: on a wide screen the mouse is often that far (2026-10-19: the priest's heals and buffs
    // refused as "ไกลเกินไป"). The point comes in along the same line; every skill clamps its ground nearer anyway.
    const far = Math.hypot(tx - p.x, ty - p.y), REACH = 640;
    if (far > REACH) { tx = p.x + ((tx - p.x) * REACH) / far; ty = p.y + ((ty - p.y) * REACH) / far; }
    if (!O.skill(id, aim, tx, ty, t ? t.sid : undefined)) return false;
    const seq = O.seq, cd0 = { ...(p.cd || {}) }, acd0 = p.acdT || 0;
    if (waiting) play(waiting); // (a look still waiting for its aim goes first)
    const cast = castLook(g, aim, tx, ty);
    // an instant skill whose look falls on the monster the server picks (PICK_FIRST): it waits for the server's aim event,
    // as a cast bar's release does, then plays on that monster alone (or on the spot the server names). It played at once
    // on a monster of its own pick from the monsters as drawn, while the server's hits went to another, or none (Discord
    // #144: sonic's eight cuts). No aim within the wait (a server without it): it plays as before
    if (PICK_FIRST.has(id)) {
      const h = (waiting = Object.assign(cast, { id, key, seq, self: this, p, only: true, cd0, acd0 }));
      h.timer = setTimeout(() => { if (waiting === h) play(h); }, aimWait());
      keepRefusable(seq, id, p, cd0, acd0);
      return true;
    }
    let r;
    try { r = baseCast.call(this, cast.look, p, key); } catch (e) { console.warn('online: skill looks', id, e); return true; }
    held = p.casting && p.casting.id === id ? Object.assign(cast, { id, key, seq }) : null;
    keepRefusable(seq, id, p, cd0, acd0);
    return r;
  };
  // The bar and the release follow the server's (2026-10-19, the user: "สกิลแสงพระ กดไม่ค่อยโดนมอนเลย มอนอยู่เป็นกระจุกแต่
  // ดาเมจไม่ขึ้น"): the local bar ran on this screen's own cast time and frames, so on a slow frame the beam fell up to
  // 0.6 s after the server's hits and often on another monster of the group, where no number came. Now:
  //   - the server's `cast` event sets the bar's length (its duration: its DEX and buffs);
  //   - its `aim` event (aim_event.go: the release, with the monster it picked) ends a bar still filling here at once, and
  //     the look falls on that monster's mirror;
  //   - a skill the server aims (learned from its first aim) waits up to a moment after the bar for that aim before the
  //     look plays (no aim: no monster in reach, it plays as before);
  //   - the server's `castPush` (a hit put its bar back) holds this bar (or the waiting look) as long;
  //   - the server's `castCancel` (stepped off) drops the bar and the look.
  const aimed = new Set(); // skill ids the server sent an aim for (they pick a monster at the release)
  const PICK_FIRST = new Set(['sonic']); // instant skills whose look waits for that pick (castSkill above, server patch 025)
  let waiting = null; // a released look waiting for its aim: { ...held, self, p, timer }
  const aimWait = () => Math.max(120, Math.min(450, (O.rtt || 120) * 1.5 + 60));
  function play(h) {
    clearTimeout(h.timer);
    if (waiting === h) waiting = null;
    const p = h.p, aim = p.aim;
    if (NC.skillForKey(p, h.key) !== h.id) return false;
    const look = h.see(), pk = h.pick;
    if (pk && Number.isFinite(pk.x)) {
      const m = pk.targetId && mirrors.get(pk.targetId);
      look.mouse.wx = m ? m.x : pk.x; look.mouse.wy = m ? m.y : pk.y;
    }
    // (PICK_FIRST: the look finds only the server's monster, or none when it fell on the ground)
    if (h.only && pk) look.enemies = pk.targetId ? look.enemies.filter((v) => v.sid === pk.targetId) : [];
    p.aim = h.aim;
    const now = p.castNow;
    p.castNow = true; // (the bar is over: js/casting.js lets it straight through)
    // the server took the SP when the bar began, so js/skilltree.js castSkill's own SP check at the release asked for it a
    // second time: with less than the cost left the look never played ("SP ไม่พอ": a dragon knight's casts, 2026-10-19
    // Discord). The look gets the cost for this call; the server's record keeps the real SP.
    const sp = p.sp, cost = NC.skillCost ? NC.skillCost(p, h.id, NC.skillLv(p, h.id)) || 0 : 0;
    if (p.sp < cost) p.sp = cost;
    // the same for the cooldown and the after-cast delay: the server starts them when the bar begins (or the instant cast
    // goes out), and syncSkillCd below copies them here every snapshot, so by the release js/skilltree.js castSkill found
    // the skill still cooling down and turned its own look away: no buff icon, no p.buffs (AUTO support buffed again and
    // again), no effects for any cast-bar skill (2026-10-21, 0.5.8, the owner: "บัฟพระหาย ... พระก็บัฟเรื่อยๆ"). The look
    // gets them clear for this call; the longer of its own and the server's stay after it
    const ck = '@' + h.id, cdKeep = (p.cd && p.cd[ck]) || 0, acdKeep = p.acdT || 0;
    if (p.cd) p.cd[ck] = 0;
    p.acdT = 0;
    try {
      const r = baseCast.call(h.self, look, p, h.key);
      if (h.cd0) keepRefusable(h.seq, h.id, p, h.cd0, h.acd0); // (PICK_FIRST: the cooldowns its look started go back on a refusal too)
      return r;
    } catch (e) { console.warn('online: skill looks', h.id, e); return true; } finally {
      p.castNow = now; p.sp = sp; if (p.aim === h.aim) p.aim = aim;
      if (!p.cd) p.cd = {};
      p.cd[ck] = Math.max(p.cd[ck] || 0, cdKeep); p.acdT = Math.max(p.acdT || 0, acdKeep);
    }
  }
  O.on('event', (ev) => {
    if (!ev || !game || (ev.actorId !== me && ev.sourceId !== me)) return;
    const p = game.player;
    if (ev.type === 'cast' && held && ev.seq === held.seq && p.casting && p.casting.id === held.id && ev.duration > 0) p.casting.T = ev.duration;
    else if (ev.type === 'aim') {
      if (ev.skillId) aimed.add(ev.skillId);
      if (waiting && waiting.seq === ev.seq) { waiting.pick = ev; play(waiting); }
      else if (held && held.seq === ev.seq) { held.pick = ev; if (p.casting && p.casting.id === held.id) p.casting.t = p.casting.T; }
    } else if (ev.type === 'castPush') { // (a hit put the server's bar back: casting.go castPushEvent, remaining = its bar left)
      const rest = Math.max(0, +ev.remaining || 0);
      if (held && held.seq === ev.seq && p.casting && p.casting.id === held.id) p.casting.t = Math.max(0, p.casting.T - rest);
      else if (waiting && waiting.seq === ev.seq) { const h = waiting; clearTimeout(h.timer); h.timer = setTimeout(() => { if (waiting === h) play(h); }, rest * 1000 + aimWait()); }
    } else if (ev.type === 'castCancel') {
      if (waiting && waiting.seq === ev.seq) { clearTimeout(waiting.timer); waiting = null; }
      if (held && held.seq === ev.seq) { held = null; if (p.casting && NC.cancelCast) NC.cancelCast(game, p); }
    }
  });
  // A skill the server refuses (stopped or silenced before the snapshot said so, out of SP, too far…): the cooldowns the
  // look started go back, so do the after-cast delay and a cast bar still filling, and the reason shows (the look itself
  // has played). Keyed by the command's seq, the refusal's.
  const refusable = new Map();
  // The skills' own cooldowns and the after-cast delay ("acd") are the server's too (Discord #138, 2026-10-20: AUTO kept
  // pressing its first skill, "ใช้สกิลไม่ได้", and swung in between). The look starts them here a moment before the server
  // does, and a cast bar's cooldown only when the bar is full (the server's at its start: a bar dropped here left the
  // server's running), so a skill pressed the moment this screen's count ran out reached a server still counting, was
  // refused, had its cooldown put back to 0 below and was pressed again. Every frame the snapshot's counts (less the time
  // since it came) lift this screen's where they are longer. The server counts in its ticks (20 a second, match.go): a
  // tick takes the commands first and counts down after, and the count leaves a float crumb (0.4 less 8 ticks = 6.9e-17,
  // still "cooling down"), so a count of v there is over for a command only after floor(v / tick) + 1 more ticks; with v
  // read as is, 11 presses in 39 were still refused (measured on the local server, AUTO, the traveler's q / e).
  const CD_SYNC = true, SRV_TICK = 0.05;
  function syncSkillCd(p, cd) {
    if (!CD_SYNC) return;
    const age = Number.isFinite(O.lastSnapAt) && O.lastSnapAt > 0 ? Math.max(0, (Date.now() - O.lastSnapAt) / 1000) : 0;
    for (const k in cd) {
      const v = +cd[k] || 0;
      if (!(v > 0)) continue;
      const left = (Math.floor(v / SRV_TICK) + 1) * SRV_TICK - age;
      if (!(left > 0)) continue;
      if (k === 'acd') p.acdT = Math.max(p.acdT || 0, left);
      else if (NC.SKILLS && NC.SKILLS[k]) { if (!p.cd) p.cd = {}; p.cd['@' + k] = Math.max(p.cd['@' + k] || 0, left); }
    }
  }
  const COOLING = /cooling down|already casting/;
  function keepRefusable(seq, id, p, cd0, acd0) {
    const raised = Object.keys(p.cd || {}).filter((k) => (p.cd[k] || 0) > (cd0[k] || 0)).map((k) => [k, cd0[k] || 0]);
    refusable.set(seq, { id, raised, acd0 });
    if (refusable.size > 16) refusable.delete(refusable.keys().next().value);
  }
  O.on('event', (ev) => {
    if (!ev || ev.type !== 'error' || !refusable.has(ev.seq)) return;
    const r = refusable.get(ev.seq), p = game && game.player;
    refusable.delete(ev.seq);
    if (!p) return;
    for (const [k, v] of r.raised) if (p.cd) p.cd[k] = v;
    p.acdT = Math.min(p.acdT || 0, r.acd0);
    // still counting on the server (its count reaches this screen with the next snapshot, syncSkillCd): that skill waits a
    // moment and so does the next press, instead of going out again at once
    const cooling = CD_SYNC && COOLING.test(ev.message || '');
    if (cooling) { if (!p.cd) p.cd = {}; p.cd['@' + r.id] = Math.max(p.cd['@' + r.id] || 0, 0.6); p.acdT = Math.max(p.acdT || 0, 0.25); }
    if (p.casting && p.casting.id === r.id && NC.cancelCast) { held = null; NC.cancelCast(game, p); }
    if (waiting && waiting.seq === ev.seq) { clearTimeout(waiting.timer); waiting = null; }
    const S = NC.SKILLS && NC.SKILLS[r.id];
    FX.num(p.x, p.y - 200, 'ใช้สกิลไม่ได้', { fill: '#cfd2e6', size: 24 });
    NC.HUD.log(`ใช้${S ? S.name : 'สกิล'}ไม่ได้ · ${cooling ? 'ยังติดคูลดาวน์หรือดีเลย์หลังร่ายบนเซิร์ฟเวอร์' : ev.message || ev.code || 'เซิร์ฟเวอร์ไม่รับ'}`, 'warn');
  });
  function release(self, p, key) {
    const h = held;
    held = null;
    if (!h || h.key !== key || NC.skillForKey(p, key) !== h.id) return false;
    Object.assign(h, { self, p });
    if (h.pick || !aimed.has(h.id)) return play(h);
    waiting = h; // (the server's aim is on its way: the look waits for it a moment)
    h.timer = setTimeout(() => { if (waiting === h) play(h); }, aimWait());
    return true;
  }
  // the game a skill's look plays on: the mouse held on the point sent, and a view of each live monster (it reads the
  // mirror, so it follows the server's place and death; what the skill's code writes on it stays on the view)
  function castLook(g, aim, wx, wy) {
    const views = new WeakMap();
    const view = (e) => { let v = views.get(e); if (!v) views.set(e, (v = Object.create(e, { lookOnly: { value: true } }))); return v; };
    const look = Object.create(g, {
      presentationOnly: { value: true, enumerable: true },
      mouse: { value: Object.assign({}, g.mouse, { active: true, wx, wy }), enumerable: true },
      enemies: { value: [], writable: true, enumerable: true },
    });
    const see = () => { look.enemies = (g.enemies || []).filter((e) => e.online && !e.dead && e.hp > 0).map(view); return look; };
    return { aim, look: see(), see };
  }
  // Server-triggered spells have no matching key press. Run their looks on a scratch hero so an automatic bolt
  // cannot turn the player, replace an attack pose, spend SP or mutate the real job's gauges.
  function autoSkill(ev) {
    const id = ev.actorId || ev.sourceId, source = id === me ? game.player : remotes.get(id);
    const run = NC.SKILL_RUN && NC.SKILL_RUN[ev.skillId];
    if (!source || !run) return;
    const p = NC.makePlayer(source.x, source.y), aim = ev.aim ?? source.aim ?? 0;
    for (const k of ['job', 'lv', 'jobLv', 'hp', 'maxHp', 'sp', 'maxSp', 'face']) if (source[k] !== undefined) p[k] = source[k];
    for (const k of ['equip', 'skills', 'base', 'stats', 'hotbar']) p[k] = { ...source[k] };
    if (source.d) p.d = structuredClone(source.d);
    p.aim = aim; p.noPose = true;
    const level = Math.max(1, ev.lv || ev.skillLv || source.skills?.[ev.skillId] || 1);
    p.skills[ev.skillId] = level;
    const look = castLook(game, aim, ev.targetX ?? ev.x ?? p.x + Math.cos(aim) * 250, ev.targetY ?? ev.y ?? p.y + Math.sin(aim) * 250).look;
    Object.assign(look, { player: p, loot: [], respawns: [], portals: [], input: { mx: 0, my: 0 }, cam: { ...game.cam }, shake: 0, hitstop: 0, noSave: true });
    const beforeGame = NC.game, party = NC.Party && NC.Party.members, pets = NC.Pets && NC.Pets.list;
    const show = () => {
      NC.game = look;
      if (NC.Party) NC.Party.members = [];
      if (NC.Pets) NC.Pets.list = [];
      try { run(look, p, level, 'q'); }
      finally { NC.game = beforeGame; if (NC.Party) NC.Party.members = party; if (NC.Pets) NC.Pets.list = pets; }
    };
    try { if (id === me || !NC.OtherFX) show(); else NC.OtherFX.run(show); } catch (e) { console.warn('online: automatic skill looks', ev.skillId, e); }
  }
  // a look's hit on a view: nothing is rolled and nothing goes off (no procs, no ammo, no learning); the numbers come
  // from the server's combat events (NC.damageEnemy and NC.statusEnemy skip online monsters above)
  const baseHeroHit = NC.heroHit;
  NC.heroHit = function (d, e) { return e && e.lookOnly ? { dmg: 0, miss: false, crit: false, mod: 1 } : baseHeroHit.apply(this, arguments); };
  // a flying shot ends only at the ground's walls (cliffs, water, the map's walls): graves, rocks, trees and the other
  // props let it through, as the server's shots (backend/server/shots.go stepShot: isTerrainSolid, since 2695e8e); the
  // whole collision grid stopped the drawn shot at a grave the server's had passed
  const baseShotWall = NC.shotWall;
  NC.shotWall = function (w, x, y) { return ready ? NC.isTerrainSolid(w, x, y) : baseShotWall.apply(this, arguments); };
  // potions: the server drinks them (its count, its cooldown)
  // The server's character/potion reply has a sequence but no colour. Remember
  // the request so the red-potion lesson follows a successful drink, not a click.
  const pendingPotionLessons = new Map();
  function sendPotion(action, color) {
    if (O.action(action) === false) return false;
    pendingPotionLessons.set(O.seq, color);
    if (pendingPotionLessons.size > 64) pendingPotionLessons.delete(pendingPotionLessons.keys().next().value);
    return true;
  }
  O.on('event', (ev) => {
    if (!ev || !pendingPotionLessons.has(ev.seq)) return;
    if (ev.type === 'error') { pendingPotionLessons.delete(ev.seq); return; }
    if (ev.type !== 'character' || ev.action !== 'potion') return;
    const color = pendingPotionLessons.get(ev.seq);
    pendingPotionLessons.delete(ev.seq);
    if (color === 'red' && NC.Lessons) NC.Lessons.ev('pot');
  });
  O.on('status', (status) => {
    if (status === 'offline' || status === 'reconnecting' || status === 'error') pendingPotionLessons.clear();
  });
  const baseDrink = NC.drinkPotion;
  NC.drinkPotion = function (g, p, color) {
    if (!ready) return baseDrink.apply(this, arguments);
    if (color === 'red' && p.hp >= p.maxHp && NC.Lessons && NC.Lessons.fullPot) NC.Lessons.fullPot(g, p); // (the server refuses a full drink; the lesson step still counts)
    if (p.cd.pot > 0 && color === 'red' || p.cd.sppot > 0 && color === 'blue') return false;
    const pref = NC.POT && NC.POT.st && NC.POT.st.pref && NC.POT.st.pref[color];
    if (!sendPotion(Object.assign({ action: 'potion', kind: color === 'red' ? 'hp' : 'sp' }, pref && pref !== 'auto' ? { size: pref } : {}), color)) return false;
    p.cd[color === 'red' ? 'pot' : 'sppot'] = 0.8;
    FX.stars(p.x, p.y - 60, 8, color === 'red' ? '255,120,140' : '120,180,255', { speed: 140, size: 0.7 });
    return true;
  };
  if (NC.POT && NC.POT.drink) {
    const baseDrinkQ = NC.POT.drink;
    NC.POT.drink = function (g, p, color, size) {
      if (!ready) return baseDrinkQ.apply(this, arguments);
      if (p && color === 'red' && p.hp >= p.maxHp && NC.Lessons && NC.Lessons.fullPot) NC.Lessons.fullPot(g, p);
      if (!p || p.dead > 0 || (p.cd && p.cd[color === 'red' ? 'pot' : 'sppot'] > 0)) return false;
      const q = NC.POT.pick(p, color, size);
      if (!q) return false;
      if (!sendPotion(Object.assign({ action: 'potion', kind: color === 'red' ? 'hp' : 'sp' }, size ? { size } : {}), color)) return false;
      if (p.cd) p.cd[color === 'red' ? 'pot' : 'sppot'] = 0.8;
      return q;
    };
  }
  // warps: standing in one asks the server; its transfer (and the next snapshot's map) moves the hero
  const baseGo = NC.Maps.go;
  NC.Maps.go = function (g, id, at) {
    if (!ready) return baseGo.apply(this, arguments);
    const pt = g.portals.find((q) => q.to === id && q.at === at) || g.portals.find((q) => q.to === id);
    if (pt && pt.id) { O.warp(pt.id); FX.ring(g.player.x, g.player.y, 20, 180, '140,230,255', 0.5); }
    return undefined;
  };
  // the map: whatever the server's snapshot says
  let missingMap = null;
  function enterMap(mapId, s) {
    for (const h of W.enterHooks) { try { h(mapId, snap); } catch (err) { console.warn('online: enter hook', err); } }
    // the old map's mirrors go first: on a map this build lacks they stood frozen, and AUTO went on fighting them
    for (const e of mirrors.values()) e.dead = true;
    mirrors.clear(); lootMirrors.clear();
    if (!NC.MAPS[mapId]) {
      game.enemies = []; game.loot = [];
      if (missingMap !== mapId) { missingMap = mapId; NC.HUD.log('แมพนี้ยังไม่มีในเว็บ: ' + mapId, 'warn'); } // (once, not every snapshot)
      if (NC.Auto && NC.Auto.on && NC.Auto.stop) NC.Auto.stop(game, 'แมพนี้ยังไม่มีในเว็บ'); // (it would steer by the old map's ground)
      return false;
    }
    missingMap = null;
    NC.Maps.enter(game, mapId, null);
    game.enemies = []; game.loot = []; game.respawns = [];
    const p = game.player;
    p.x = s.x; p.y = s.y; p.vx = p.vy = 0; p.sort = p.y;
    game.cam.x = NC.clamp(p.x - game.vw / 2, 0, game.world.W - game.vw);
    game.cam.y = NC.clamp(p.y - 60 - game.vh / 2, 0, game.world.H - game.vh);
    return true;
  }

  // ---------------- the bridge: the web's windows change the hero locally; the difference goes to the server ----------------
  // (the status window's + buttons, the skill window, the hotbar, the bag, the job change, Uncle Coco's buy and sell all
  // end in NC.saveGame: compared with what the server will have once what was sent is in, each difference is an action.
  // The server answers in its next snapshots (ackSeq); whatever it refused is put back then, or by the resync.)
  const KEYS8 = ['q', 'e', 'r', 'f', '3', '4', '5', '6'];
  const POTKEYS = [['potions', 'red'], ['potionsM', 'red_m'], ['potionsL', 'red_l'], ['spPotions', 'blue'], ['spPotionsM', 'blue_m'], ['spPotionsL', 'blue_l'], ['feathers', 'feather'], ['cureG', 'hs_cure_g'], ['cureP', 'hs_cure_p']];
  const queue = [];
  let shopBuy = null;
  let pendingUntil = 0, resyncT = null, skillReset = null; // merchant reset transaction and the edits that depend on it
  setInterval(() => { if (queue.length && O.status === 'online') {
    // Other actions can proceed while a reset is waiting, but learning into its
    // refunded points or replacing its hotbar must not run against the old build.
    const i = queue.findIndex((a) => !skillReset || !skillReset.dependents.has(a));
    if (i < 0) return;
    const [a] = queue.splice(i, 1); seqOf.set(a, 0);
    if (O.action(a) !== false) seqOf.set(a, O.seq);
    else if (skillReset && skillReset.action === a) cancelSkillReset('ส่งคำสั่งรีเซ็ตสกิลไม่สำเร็จ กรุณาลองใหม่');
    else if (shopBuy && shopBuy.action === a) finishShopBuy('ส่งคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่');
  } }, 260); // (the server: 4 actions a second)
  function bridge() {
    if (!ready || !snap || !game || performance.now() < pendingUntil || W.hold > 0) return; // (hold: a window's trade being measured, online/life.js)
    const s = snap.self || {}, p = game.player, acts = [];
    const put = (kind, a) => {
      acts.push(a); lastOf[kind] = a;
      if (skillReset && a !== skillReset.action && (kind === 'skills' || kind === 'hotbar')) skillReset.dependents.add(a);
    };
    const sb = s.base || {}, ss = s.skills || {}, se = s.equip || {};
    // (counted from what the server will have once what was sent is in, so nothing goes twice; sent[] notes the new aim)
    const hasB = (k) => (k in sent.base ? sent.base[k] : sb[k] | 0), hasS = (id) => (id in sent.skills ? sent.skills[id] : ss[id] | 0);
    if (p.base) {
      // a reset (รีเซ็ตสเตตัส): a stat below the server's -> the server's free reset first, then the points from the start values
      const down = (NC.STAT_KEYS || []).some((k) => (p.base[k] | 0) < hasB(k));
      if (down) put('base', { action: 'reset', kind: 'stats' });
      for (const k of NC.STAT_KEYS || []) {
        const from = down ? NC.START_STATS[k] | 0 : hasB(k), n = Math.min(99, (p.base[k] | 0) - from);
        if (n > 0) put('base', { action: 'stat', stat: k, count: n });
        if (down || n > 0) sent.base[k] = from + Math.max(0, n);
      }
    }
    if (p.job && s.job && p.job !== s.job) { // (the new job's skills go once the server has the job)
      if (p.job !== ('job' in sent.job ? sent.job.job : s.job)) { put('job', { action: 'job', job: p.job }); sent.job.job = p.job; }
    } else if (p.skills) {
      // Uncle Coco's รีเซ็ตสกิล (W.skillReset): the server's reset first (it takes the price: a trade until answered),
      // then the levels from the job's free ones
      if (skillReset && !skillReset.action) {
        const a = skillReset.action = { action: 'reset', kind: 'skills' };
        put('skills', a); trades.push({ a, d: { coins: -skillReset.price } });
        for (const id in p.skills) sent.skills[id] = NC.freeSkillLv(id);
      }
      for (const id in p.skills) {
        const from = hasS(id), n = Math.min(20, (p.skills[id] | 0) - from);
        for (let i = 0; i < n; i++) put('skills', { action: 'skill', skillId: id });
        if (n > 0) sent.skills[id] = from + n;
        else if (n < 0 && srv.skills && !(id in sent.skills)) srv.skills[id] = p.skills[id]; // (a level taken away here is not the bridge's to send: the server's comes back)
      }
    }
    const lh = KEYS8.map((k) => (p.hotbar && p.hotbar[k]) || ''), hh = KEYS8.map((k) => (k in sent.hotbar ? sent.hotbar[k] : s.hotbar && s.hotbar[k]) || '');
    // New-job slots depend on that job being accepted, just like its skill levels.
    if (p.job === s.job && lh.join() !== hh.join()) { put('hotbar', { action: 'hotbar', slots: lh }); KEYS8.forEach((k, i) => { sent.hotbar[k] = lh[i] || null; }); }
    for (const slot of SLOTS) {
      const shown = slot === 'hair' && s.look && s.look.hair === 'created' && s.appearance ? 'hair_look' : se[slot];
      const l = (p.equip && p.equip[slot]) || '', v = (slot in sent.equip ? sent.equip[slot] : shown) || '';
      if (l === v) continue;
      if (standIn[slot] && v === standIn[slot] && (l === '' || l === STAND_IN[slot])) continue; // (the stand-in for a piece this browser doesn't know: the server keeps its own)
      if (slot === 'hair' && l === 'hair_look' && s.appearance) {
        put('equip', { action: 'wardrobe', slot: 'hair', itemId: 'created' });
        sent.equip.hair = l;
        continue;
      }
      if ((slot === 'hair' && (l === 'hair_look' || /^hair_lk/.test(l))) || (l !== '' && !NC.ITEMS[l])) { if (srv.equip) srv.equip[slot] = l || null; continue; } // (not the bridge's to send: the server's comes back)
      const c = l && W.copyIdFor ? W.copyIdFor(slot, l) : 0;
      put('equip', Object.assign({ action: 'equip', slot, itemId: l }, c ? { copyId: c } : {}));
      sent.equip[slot] = l || null;
    }
    // Uncle Coco's trades not sent yet (unsentTrade): each sale and purchase goes on its way with its change (trades);
    // a sale's coins as NC.Econ.sell paid them, the rest shared by the list prices (what rounding leaves on the last)
    const tr = unsentTrade(p), made = [];
    for (const [k, got] of tr.sells) { const M = NC.MATERIALS && NC.MATERIALS[k.slice(2)]; made.push([{ action: 'sell', itemId: k.slice(2), count: -tr.u[k] }, { [k]: tr.u[k], coins: got }, ((M && M.price) || 1) * -tr.u[k]]); }
    for (const [k, kind] of tr.buys) for (let left = tr.u[k]; left > 0; left -= 100) {
      const n = Math.min(100, left), D = (NC.Shop && NC.Shop.POTIONS || []).find((q) => q.id === kind) || (NC.POT && NC.POT.DEF && NC.POT.DEF[kind]);
      made.push([{ action: 'buy', kind, count: n }, { [k]: n, coins: null }, ((D && D.price) || 1) * n]);
    }
    for (const id in sold) delete sold[id]; // (on their way now, or not sales after all)
    // the other files' trades (W.trade) with their own changes: a sale before Uncle Coco's purchases, a purchase after
    const go = (e) => { e.out = true; acts.push(e.a); trades.push(e); };
    const lat = later; later = [];
    lat.filter((e) => (e.d.coins | 0) > 0).forEach(go);
    if (made.length) {
      const rest = (tr.u.coins | 0) - made.reduce((t, m) => t + (m[1].coins || 0), 0), float = made.filter((m) => m[1].coins == null);
      const w = float.reduce((t, m) => t + m[2], 0);
      let left = rest;
      for (const m of float) { m[1].coins = Math.round((rest * m[2]) / w); left -= m[1].coins; }
      (float.length ? float[float.length - 1] : made[made.length - 1])[1].coins += left;
      for (const [a, d] of made) { acts.push(a); trades.push({ a, d }); }
    }
    lat.filter((e) => !((e.d.coins | 0) > 0)).forEach(go);
    // (put(kind, action): an action of a kind kept with W.keep, so its answer is known)
    for (const h of W.bridgeHooks) { try { const more = h(s, p, put); if (more && more.length) acts.push(...more); } catch (e) { console.warn('online: bridge hook', e); } }
    if (!acts.length) return;
    pendingUntil = performance.now() + 1200 + acts.length * 260;
    queue.push(...acts);
    clearTimeout(resyncT);
    resyncT = setTimeout(resync, 1400 + acts.length * 260);
  }
  // put the server's record back on the hero (what it refused is undone; what was changed after it was sent, or is
  // still in the queue, stays for the bridge: keepMine, keepTrade)
  function resync() { lastGear = null; W.resyncing = true; try { if (snap && snap.self && game) applySelf(snap.self, false); } finally { W.resyncing = false; } }
  W.send = (a) => { queue.push(a); pendingUntil = Math.max(pendingUntil, performance.now() + 900); clearTimeout(resyncT); resyncT = setTimeout(resync, 1600 + queue.length * 260); };
  function cancelQueued(a) {
    const i = queue.indexOf(a);
    if (i < 0) return false;
    queue.splice(i, 1);
    seqOf.set(a, 0);
    return true;
  }
  W.cancelQueued = cancelQueued; // abandon only unsent commands from a previous garden/session
  W.resync = resync;
  function renderSkillReset() {
    if (NC.HUD.renderSkills) NC.HUD.renderSkills();
    if (NC.HUD.updateHotbar && game) NC.HUD.updateHotbar(game.player);
    if (NC.Shop && NC.Shop.render) NC.Shop.render();
  }
  function cancelSkillReset(message, restore = true) {
    const reset = skillReset;
    if (!reset) return;
    skillReset = null;
    if (reset.action) {
      cancelQueued(reset.action);
      seqOf.set(reset.action, 0); // the price is reconciled by keepTrade, never charged locally twice
    } else if (game) game.player.coins += reset.price;
    for (const a of reset.dependents) cancelQueued(a);
    for (const kind of ['skills', 'hotbar']) {
      sent[kind] = {};
      delete lastOf[kind];
      if (restore && game && snap && snap.self && snap.self[kind]) {
        game.player[kind] = Object.assign({}, snap.self[kind]);
        srv[kind] = Object.assign({}, snap.self[kind]);
      }
    }
    if (restore) resync();
    if (message) NC.HUD.log(message, 'warn');
    renderSkillReset();
  }
  function settleSkillReset() {
    const reset = skillReset, q = reset && reset.action && seqOf.get(reset.action);
    if (!reset || !reset.accepted || !q || !snap || snap.ackSeq < q) return false;
    skillReset = null;
    // Subsequent levels still have their own pending commands; only the reset
    // is settled here. Receipt and snapshot may arrive in either order.
    resync();
    const points = NC.skillLeft(game.player);
    NC.HUD.log(`รีเซ็ตสกิลสำเร็จ${reset.price ? ` จ่าย ${reset.price.toLocaleString()} เหรียญ` : ''} · แต้มสกิลคงเหลือ ${points} แต้ม`, 'level');
    renderSkillReset();
    return true;
  }
  W.skillResetPending = () => !!skillReset;
  W.skillReset = (price) => {
    if (skillReset) return false;
    skillReset = { price: price | 0, action: null, accepted: false, dependents: new Set() };
    return true;
  };
  O.on('event', (ev) => {
    if (!skillReset || !skillReset.action || !ev || !ev.seq || seqOf.get(skillReset.action) !== ev.seq) return;
    if (ev.type === 'error') cancelSkillReset('รีเซ็ตสกิลไม่สำเร็จ คืนสกิลเดิมแล้ว กรุณาลองใหม่ที่ร้านลุงโกโก้');
    else if (ev.type === 'character' && ev.action === 'reset') { skillReset.accepted = true; settleSkillReset(); }
  });
  // for the other online files: their own changes kept like the bridge's (W.keep(kind, local, server, whole) with
  // W.sentOf(kind)[key] = the value sent, the action through the bridge hook's put(kind, action); read W.sentOf each
  // time, a whole record makes a new one), W.answered(action, strict), the counts, and W.trade(d, action) for a trade a window
  // made: d its change of the counts ({ coins, potions…, 'm:<material>': change }); the entry it gives back can still
  // take more (its a and d) until e.out (sent)
  W.keep = (kind, local, server, whole) => { if (!sent[kind]) sent[kind] = {}; return keepMine(kind, local, server, whole); };
  W.sentOf = (kind) => sent[kind] || (sent[kind] = {});
  W.answered = answered; // strict: a local resync timer cannot acknowledge a server-owned action such as harvesting
  W.commandSeq = (a) => seqOf.get(a) || 0; // match a window's response to its own queued action, not an AUTO combat event
  W.counts = counts;
  W.hold = 0;
  W.trade = function (d, a) {
    const e = { d: Object.assign({}, d), a, out: false };
    later.push(e);
    setTimeout(() => { try { bridge(); } catch (err) { console.warn('online: bridge', err); } }, 0); // (after the window's own code is done)
    return e;
  };
  const baseSave = NC.saveGame;
  NC.saveGame = function (g) { if (ready && g === game) { bridge(); return; } return baseSave.apply(this, arguments); };
  setInterval(() => { try { bridge(); } catch (e) { console.warn('online: bridge', e); } }, 700);

  // Buying is an explicit merchant command. Inventory and coins change only when
  // the server sends its record, and a success notice requires this purchase's receipt.
  function renderShopBuy() {
    if (!NC.Shop) return;
    NC.Shop.buyPending = !!shopBuy;
    if (NC.Shop.render) NC.Shop.render();
  }
  function shopNotice(message) { if (game && game.toast) game.toast(message); }
  function shopBuyError(message, code) {
    if (code === 'persistence_unavailable') return 'เซิร์ฟเวอร์กำลังพักการบันทึก ซื้อไม่สำเร็จ กรุณาลองใหม่อีกสักครู่';
    if (code === 'attest_pending') return 'กำลังตรวจสอบการเชื่อมต่อ ซื้อไม่สำเร็จ กรุณาลองใหม่อีกสักครู่';
    if (code === 'rate_limit' || code === 'action_rate_limit') return 'ส่งคำสั่งเร็วเกินไป ซื้อไม่สำเร็จ กรุณาลองใหม่อีกสักครู่';
    if (/coin/i.test(message || '')) return 'เหรียญไม่พอซื้อของ';
    if (/merchant|near.*shop/i.test(message || '')) return 'อยู่ไกลร้านเกินไป กรุณาเดินเข้าใกล้ลุงโกโก้';
    return 'ซื้อไม่สำเร็จ กรุณาลองใหม่';
  }
  function finishShopBuy(error) {
    if (!shopBuy) return;
    const q = seqOf.get(shopBuy.action);
    if (!error && (!shopBuy.accepted || !q || !snap || snap.ackSeq < q)) return;
    const purchase = shopBuy;
    shopBuy = null;
    const message = error || `ซื้อ${purchase.item.name} ×${purchase.count} จ่าย ${purchase.cost.toLocaleString('en-US')} เหรียญ`;
    if (!error && NC.Lessons && NC.Lessons.ev) NC.Lessons.ev('buy');
    NC.HUD.log(message, error ? 'warn' : 'item');
    shopNotice(message);
    renderShopBuy();
  }
  if (NC.Shop) NC.Shop.buy = function (g, id, count) {
    if (!ready || O.status !== 'online' || g !== game || !snap || !snap.self) { shopNotice('รอเชื่อมต่อเซิร์ฟเวอร์ก่อนซื้อของ'); return false; }
    if (shopBuy) { shopNotice('กำลังรอผลซื้อของ'); return false; }
    const item = (NC.Shop.POTIONS || []).find((q) => q.id === id);
    if (!item || !Number.isInteger(count) || count < 1 || count > 100) return false;
    if (!NC.Shop.canTrade || !NC.Shop.canTrade(g)) { shopNotice('กรุณาเดินเข้าใกล้ลุงโกโก้ก่อนซื้อของ'); renderShopBuy(); return false; }
    const cost = item.price * count;
    if (g.player.coins < cost) { shopNotice('เหรียญไม่พอซื้อของ'); return false; }
    const action = { action: 'buy', kind: id, count };
    shopBuy = { action, item, count, cost, accepted: false };
    W.send(action);
    shopNotice('กำลังซื้อของ');
    renderShopBuy();
    return true;
  };
  O.on('event', (ev) => {
    if (!shopBuy || !ev || !ev.seq || seqOf.get(shopBuy.action) !== ev.seq) return;
    if (ev.type === 'error') finishShopBuy(shopBuyError(ev.message, ev.code));
    else if (ev.type === 'character' && ev.action === 'buy') { shopBuy.accepted = true; finishShopBuy(); }
  });

  // a refusal: answered (answered()); one of the bridge's own, or a build / shop word: the server's record back soon
  const bridged = (q) => Object.values(lastOf).some((a) => seqOf.get(a) === q) || trades.some((e) => seqOf.get(e.a) === q);
  O.on('event', (ev) => {
    if (!ev || ev.type !== 'error') return;
    const mine = !!ev.seq && bridged(ev.seq);
    if (ev.seq) { refused.add(ev.seq); if (refused.size > 64) refused.delete(refused.values().next().value); }
    if (mine || (ev.code === 'rejected' && /stat|skill|equip|job|coin|sell|buy|hotbar|merchant|potion/i.test(ev.message || ''))) { clearTimeout(resyncT); resyncT = setTimeout(resync, 300); }
  });

  // ---------------- each snapshot ----------------
  O.on('snapshot', (st) => {
    if (!game || !game.player) return;
    snap = st;
    if (skillReset) { if (!ready) cancelSkillReset('', false); else settleSkillReset(); }
    const buildReply = buildAnswered();
    const tradeReply = trades.some((e) => answered(e.a, true));
    const buyReply = !!shopBuy && answered(shopBuy.action, true);
    if (buildReply) lastGear = null; // an ack-only delta must also settle an optimistic window edit
    const s = st.self || {};
    const first = !ready;
    if (st.mapId !== game.mapId || first) {
      if (st.mapId !== game.mapId && !enterMap(st.mapId, s)) return;
      if (first) { const p = game.player; p.x = s.x; p.y = s.y; p.vx = p.vy = 0; game.enemies = game.enemies.filter((e) => e.online); game.loot = []; game.respawns = []; }
    }
    if (st._selfChanged || first || buildReply || tradeReply || buyReply) applySelf(s, first);
    else { const p = game.player; if (typeof s.hp === 'number') p.hp = s.hp; if (typeof s.sp === 'number') p.sp = s.sp; }
    // Keep long-lived orbit effects alive on unchanged-self deltas too; omitted meters in the merged record mean zero.
    if (NC.OnlineMeters) NC.OnlineMeters.sync(game.player, s.meters, game);
    if (NC.OnlineWisp) NC.OnlineWisp.snapshot(st, me); // (the shepherd's wisps: js/online-wisp.js)
    if (buyReply) finishShopBuy();
    syncMonsters(st.monsters || []);
    syncPlayers(st.players || [], st.mapId, st.serverTime);
    // (the summons and the hawks, after the other heroes are in: js/online-pets.js, -wolfhunter.js, -puppeteer.js)
    if (NC.OnlinePets) NC.OnlinePets.snapshot(st, me);
    if (NC.OnlineWolf) NC.OnlineWolf.snapshot(st, me);
    if (NC.OnlinePuppet) NC.OnlinePuppet.snapshot(st, me);
    syncLoot(st.loot);
    // A reconnect or an earlier frame may already have set the local death timer.
    // The server's down state must still bring back the revive controls.
    if (s.dead > 0) {
      if (!(game.player.dead > 0)) game.player.dead = 3;
      if (NC.P3Fallen && !s.gwar && !s.pvp && !NC.P3Fallen.isOpen()) NC.P3Fallen.show(lastHitBy);
    } else {
      game.player.dead = 0;
      if (NC.P3Fallen) NC.P3Fallen.close(true);
    }
    if (first) {
      ready = true;
      game.paused = false;
      if (NC.OnlineLobby) NC.OnlineLobby.hide();
      NC.HUD.log(`ออนไลน์แล้ว! ${(NC.MAPS[st.mapId] || {}).name || st.mapId} ช่อง ${st.channelId}`, 'level');
    }
    if (O.status === 'online') {
      if (first) NC.Chat?.syncOnline?.();
      else NC.Chat?.syncScopeOnline?.();
    }
  });
  O.on('event', onEvent);
  O.on('event', (ev) => { for (const h of W.eventHooks) { try { h(ev); } catch (e) { console.warn('online: event hook', e); } } });
  O.on('status', (s) => {
    if (s === 'online' && ready) NC.Chat?.syncOnline?.();
    if (s === 'reconnecting' || s === 'error' || s === 'offline') {
      if (skillReset) cancelSkillReset('');
      if (shopBuy) { cancelQueued(shopBuy.action); shopBuy = null; renderShopBuy(); }
      // The next login owns the job. An unsent promotion from the old session
      // must not run later against that freshly restored build.
      const pendingJobs = queue.filter((a) => a.action === 'job');
      for (const a of pendingJobs) cancelQueued(a);
      if (pendingJobs.includes(lastOf.job)) { sent.job = {}; delete lastOf.job; }
      ready = false; snap = null; for (const e of mirrors.values()) e.dead = true; mirrors.clear();
      O.remotes?.clear();
      NC.Chat?.resetOnline?.();
    }
  });

  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (g) {
    game = g;
    g.paused = true; // (the lobby first)
    baseInit(g);
  };

  // ---------------- the badge: online, the ping ----------------
  // (it listens for itself, after the parts above that tests run without a page: the snapshot and status handlers stay
  // free of the DOM. Registered after them, so a snapshot finds `ready` already set by the handler above.)
  let badgeEl = null, badgeWait = true; // (waiting for the first snapshot of a connection, as the handler's `first`)
  function badge(text, bad) {
    if (!badgeEl) { badgeEl = document.createElement('div'); badgeEl.className = 'ol-badge'; (document.getElementById('hud') || document.body).appendChild(badgeEl); } // (in the HUD: the windows cover it)
    badgeEl.classList.toggle('bad', !!bad);
    badgeEl.innerHTML = `<i></i>${text}`;
    badgeEl.dataset.base = text;
  }
  O.on('snapshot', () => { if (badgeWait && ready) { badgeWait = false; badge('ออนไลน์', false); } });
  O.on('transferring', () => { badge('กำลังเปลี่ยนแมพ…', false); });
  O.on('status', (s) => {
    if (s === 'online') badge('ออนไลน์', false);
    if (s === 'reconnecting' || s === 'error' || s === 'offline') {
      badgeWait = true;
      badge(s === 'error' ? 'หลุดการเชื่อมต่อ' : s === 'offline' ? 'ออฟไลน์' : 'กำลังต่อใหม่…', true);
    }
  });
  setInterval(() => {
    if (!badgeEl || O.status !== 'online' || !snap) return;
    const n = 1 + peers.size;
    const txt = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, ''); // (server text: no markup, audit 2026-10-18)
    badgeEl.innerHTML = `<i></i>เซิร์ฟเวอร์ · ${txt((NC.MAPS[snap.mapId] || {}).name || snap.mapId)} ช่อง ${txt(snap.channelId)} · ${n} คนแถวนี้${O.rtt != null ? ` · ${Math.round(O.rtt)} ms` : ''}`;
    // under net.js's "ออนไลน์ N คน" box (by the minimap) when it shows
    const list = document.querySelector('.netlist'), r = list && !list.hidden ? list.getBoundingClientRect() : null;
    if (r && r.height) { badgeEl.style.top = Math.round(r.bottom + 6) + 'px'; badgeEl.style.right = Math.round(innerWidth - r.right) + 'px'; badgeEl.style.bottom = 'auto'; }
  }, 1000);

  // (testing in a background tab: window.__ncOnline)
  window.__ncOnline = { O, get snap() { return snap; }, mirrors, peers, get ready() { return ready; } };
})();
