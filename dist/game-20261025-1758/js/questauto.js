/* questauto.js — AUTO พาไปทำทุกขั้น (the user, 2026-10-18: "เควส auto เควสที่สอง หรือเควสอื่นๆ ต้องกดออโต้เเล้วพาไปทำเลยนะ
   ตอนนี้ผมติด ที่เควสนี้ กด auto เเล้วไม่มีอะไรเกิดขึ้น"). ฟืนคืนแรก was stuck twice: its own step "ตัด 1 ครั้ง" only walked
   to the farm, and its story goal "ตัดไม้ 30" walked back to the camp and said "gather yourself"; MQ03's materials, MQ04's
   carrots and the dummies did nothing either.
   One press of AUTO (the tracker under the hero's frame, the talk window's "AUTO พาไปทำ", the story tracker after the
   lessons, the journey's story steps) now plays the quest on, step after step, until something needs the player:
     walk      to the place / the map / the giver (js/autotravel.js); the talk window opens there and its รับเควส /
               ส่งเควส presses itself after 3 s (a click in the window stops the count); the story pictures wait for you
     fight     the auto farm (js/autofarm.js) on the step's monster, on the map that suits the hero (the nearest one where
               it lives at a level he can take), switched off when the goal is met; a material to hand in: the monster
               that drops it; a story boss: its map and spot; a level too low for the next quest: it levels him first
     gather    wood and ore: the nearest tree / vein that gives it (this map first, else the nearest map that has it),
               walked to and worked (js/life.js) strike after strike, then the next, until the goal is met; a monster
               that attacks meanwhile is fought first (the auto farm), then back to work
     garden    carrots and the other crops: seeds bought from ยายกระต่าย when there are none, the open plots tilled,
               planted, watered each stage, waited for (the tracker counts the minutes) and picked
     dummies   hit 5 times, then a hotbar skill on them (the hero's own attack and keys)
     potion / sitting   drinks a red potion (none: Uncle Coco's shop) / sits down by the campfire
     windows   a step that is the player's own click (sell, buy, refine, cook, equip, a window to open...) opens the window
               on its page with the ring on the button (lessons.js), and AUTO waits; a press of AUTO opens it again
   Walking or clicking the ground yourself, Z, dying, or a press of AUTO while it runs stops it. The tracker's button says
   what it is doing, and a story goal shows its own count ("ตัดไม้เบิร์ชหรือโอ๊ก 7/30") instead of "ทำเป้าของเควสให้ครบ".
   Hooks: clicks on the AUTO buttons (caught before lessons.js / journey.js), NC.updatePlayer (the outermost: the player's
   own input, the dummy hits), NC.HUD.update (the chain, the jobs, the goals, the tracker's words), NC.Travel.stop.
   Needs NC.Lessons.step (lessons.js) and NC.Life.work / strike (life.js). Test: ?questauto=0 (the old AUTO), NC.QuestAuto. */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC.Lessons || !NC.Journey || !NC.Quests || !NC.Travel) return;
  const G = () => NC.game;
  const LS = () => NC.Lessons, QS = () => NC.Quests, J = () => NC.Journey, LF = () => NC.Life;
  const MAT = NC.MATERIALS || {};
  const dist = NC.dist;
  const $ = (id) => document.getElementById(id);
  const mapName = (id) => (NC.MAPS[id] || {}).name || id;
  const strip = (h) => String(h || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const tier = (p) => ((NC.JOBS[p.job] || {}).tier || 0);
  const log = (t) => NC.HUD && NC.HUD.log(t, 'sys');
  const toast = (t) => { const g = G(); if (g && g.toast) g.toast(t); };

  const QA = (NC.QuestAuto = { on: false, note: '', job: null, lvGoal: 0 });
  let lastKey = null, waiting = false, job = null, chk = 0, cd = null, quiet = false;
  const own = { farm: false, farmOn: false, key: null, set: null }; // (a farm the chain started: its key, the settings it changed)

  // ---------------- where things are ----------------
  const route = (a, b) => { if (a === b) return 0; const r = NC.MapRoute && NC.MapRoute.pathTo(a, b); return r && r.length > 1 ? r.length - 1 : 99; };
  const info = (id) => { try { return NC.mapInfo ? NC.mapInfo(id) : null; } catch (e) { return null; } };
  // the map to hunt a species on: where it lives at a level the hero can take, the nearest (this map first)
  function bestMap(sp, p) {
    const g = G();
    let best = null, bs = Infinity;
    for (const id of Object.keys(NC.MAPS)) {
      if (id === 'camp' || NC.MAPS[id].camp) continue;
      const I = info(id), m = I && I.mons && I.mons.get(sp);
      if (!m || m.boss) continue;
      const lo = (m.lv && m.lv[0]) || (I.lv && I.lv[0]) || 1, r = route(g.mapId, id);
      if (r >= 99) continue;
      const s = r * 2 + Math.max(0, lo - p.lv - 2) * 1.5 - (m.w || 0);
      if (s < bs) { bs = s; best = id; }
    }
    return best;
  }
  // the map to level on: monsters round the hero's level, the nearest
  function levelMap(p) {
    const g = G();
    let best = null, bs = Infinity;
    for (const id of Object.keys(NC.MAPS)) {
      const M = NC.MAPS[id];
      if (id === 'camp' || M.camp || M.dungeon || M.parent || id === 'homefarm') continue;
      const I = info(id);
      if (!I || !I.lv || !I.mons || !I.mons.size) continue;
      const [lo, hi] = I.lv, r = route(g.mapId, id);
      if (r >= 99 || lo > p.lv + 1) continue;
      const s = r + Math.max(0, p.lv - hi) * 0.8 + (lo > p.lv ? 1 : 0);
      if (s < bs) { bs = s; best = id; }
    }
    return best || (p.lv < 8 ? 'farm' : p.lv < 16 ? 'meadow' : 'marsh');
  }
  // who drops a material, and where to hunt it
  function dropper(id, p) {
    let best = null;
    for (const sp in NC.MAT_DROPS || {}) {
      const d = (NC.MAT_DROPS[sp] || []).find((x) => x[0] === id);
      if (!d || !NC.MONSTERS[sp] || (NC.BOSSES && NC.BOSSES[sp])) continue;
      const m = bestMap(sp, p);
      if (!m) continue;
      const I = info(m), lo = ((I.mons.get(sp) || {}).lv || [1])[0];
      const s = route(G().mapId, m) * 2 + Math.max(0, lo - p.lv - 2) * 1.5 - d[1] * 2;
      if (!best || s < best.s) best = { sp, map: m, s };
    }
    return best;
  }
  // a quest's giver: where to stand, and how the quest is taken / handed in there
  function giverSpot(q) {
    const GV = NC.StoryNPC && NC.StoryNPC.giverOf ? NC.StoryNPC.giverOf(q) : null;
    if (!GV || !GV.npcObj) return null;
    const o = GV.npcObj;
    return { map: GV.map, x: o.x - 60, y: o.y + 90, r: 150, name: GV.name, id: q.giver, story: !!o.storyNpc };
  }

  // ---------------- the state, as one key: a change means the step it served is done ----------------
  function objIdx(q, p) {
    const Q = QS();
    let k = q.obj.findIndex((o, i) => o.k !== 'talk' && !Q.objDone(q, o, i, p));
    if (k < 0) k = q.obj.findIndex((o, i) => !Q.objDone(q, o, i, p));
    return k;
  }
  // the level a species asks on a map: its lowest there, less one (2026-10-18: ค่าที่พัก, Lv 3, sent the hero to the
  // Lv 8–16 bat cave for wings; three falls and AUTO gave up). Far above the hero: he trains up to it first
  const monLo = (sp, mapId) => { const I = info(mapId), m = I && I.mons && I.mons.get(sp); return (m && m.lv && m.lv[0]) || (I && I.lv && I.lv[0]) || 1; };
  const needLv = (sp, mapId, p) => { const want = monLo(sp, mapId) - 1; return want > p.lv + 1 ? want : 0; };
  const pointsLeft = (p, ev) => (ev === 'stat' ? (NC.statusLeft ? NC.statusLeft(p) : 0) : NC.skillLeft ? NC.skillLeft(p) : 0);
  function key() {
    const g = G(), p = g.player, L = LS(), Q = QS(), q = Q.cur();
    let a = '';
    if (L.active()) {
      const l = L.cur(), c = L.step ? L.step() : null;
      a = l ? `${l.id}:${L.lessonState()}:${c ? l.steps.indexOf(c) : -1}` : 'end';
      if (c && (c.ev === 'stat' || c.ev === 'skillup')) a += pointsLeft(p, c.ev) > 0 ? ':pt' : ':-'; // (no point to spend: it levels first)
    }
    let b = '';
    if (q) { // (only what changes the next move: a level reached counts before the quest is taken, the job level for ห้าทางเดิน)
      const on = Q.state.on;
      b = `${q.id}:${on ? (Q.ready(q, p) ? 'r' : objIdx(q, p)) : p.lv >= Q.lvNeed(q) ? 'lv' : '-'}${q.id === 'MQ08' ? ((p.jobLv || 1) >= 10 || tier(p) >= 1 ? ':j' : ':-') : ''}`;
    }
    return a + '|' + b + (QA.lvGoal ? (p.lv >= QA.lvGoal ? '|lvok' : '|lv') : '');
  }

  // ---------------- the actions ----------------
  // (a stop the chain made itself is not the player's: no "stopped" from the hooks)
  const self = (fn) => { quiet = true; try { return fn(); } finally { quiet = false; } };
  function travel(game, to, then) { J().travel(game, to, then); }
  function farm(game, sp, mapId, boss) {
    const A = NC.Auto;
    if (!A) return;
    if (!own.set) own.set = { off: A.set.off.slice(), boss: A.set.boss, loot: A.set.loot };
    own.farm = true; own.farmOn = false; own.key = key();
    if (boss) A.set.boss = true;
    J().farm(game, sp, mapId, true);
    if (sp) log(`AUTO: ล่า${(NC.MONSTERS[sp] || {}).name || sp} ที่${mapName(mapId)}`);
    else log(`AUTO: ฟาร์มที่${mapName(mapId)}`);
  }
  function endFarm(game) {
    const A = NC.Auto;
    if (A && A.on && (own.farmOn || own.farm)) self(() => A.toggle(game));
    if (A && own.set) { A.set.off = own.set.off; A.set.boss = own.set.boss; A.set.loot = own.set.loot; }
    own.farm = false; own.farmOn = false; own.key = null; own.set = null;
  }
  function endJob(game) {
    if (!job) return;
    const p = game.player;
    if (job.defend && NC.Auto && NC.Auto.on) self(() => NC.Auto.toggle(game));
    if (p.lifeAct && LF() && LF().stopWork) LF().stopWork(game, p);
    if (NC.Travel.on && NC.Travel.target && NC.Travel.target.qa) self(() => NC.Travel.stop(''));
    job = null; QA.job = null; QA.note = '';
  }
  function startJob(j) { j.key = key(); job = j; QA.job = j; }
  // a lesson step lessons.js already knows how to help with (the windows, the giver)
  function lessonsAuto() { own.farm = true; own.farmOn = false; own.key = key(); if (!own.set && NC.Auto) own.set = { off: NC.Auto.set.off.slice(), boss: NC.Auto.set.boss, loot: NC.Auto.set.loot }; LS().auto(); }

  // ---------------- what to do now ----------------
  function next(game) {
    const p = game.player, L = LS(), Q = QS();
    waiting = false; QA.note = ''; QA.lvGoal = 0;
    endFarm(game);
    if (QA.trainTo && p.lv >= QA.trainTo) QA.trainTo = 0;
    if (QA.trainTo) { lastKey = key(); levelUp(game, QA.trainTo); QA.note = `มอนแรงเกินไป · ฝึกให้ถึง Lv ${QA.trainTo} ก่อน`; return; } // (a fall while training keeps the goal)
    lastKey = key();
    if (L.active()) {
      const l = L.cur(), s = L.lessonState();
      if (!l || s === 'story') return story(game);
      if (s === 'offer' && l.mq) { const q = Q.cur(); if (q && q.id === l.mq && p.lv < Q.lvNeed(q)) return levelUp(game, Q.lvNeed(q)); }
      if (s === 'offer' || s === 'ready') return lessonsAuto();
      const c = L.step ? L.step() : null;
      if (!c) return story(game);
      if (step(game, l, c) !== false) return;
      return lessonsAuto();
    }
    return story(game);
  }
  // a lesson's own step (false: lessons.js's AUTO does it)
  function step(game, l, c) {
    const p = game.player;
    const SN = NC.StoryNPC, who = (id) => (SN && SN.byId(id)) || (id === 'coco' && NC.Shop ? NC.Shop.npc : null);
    const talkTo = /^talk_/.test(c.ev || '') ? c.ev.slice(5) : null;
    if ((talkTo || c.near) && who(talkTo || c.near)) { // (walk up to them; a talk step opens the talk there)
      const id = talkTo || c.near, n = who(id);
      travel(game, { map: n.map || 'camp', x: n.x - 60, y: n.y + 90, r: 150, name: n.name || '' }, (g) => { if (talkTo) NC.Lessons.talk(g, id, true); });
      return;
    }
    if (c.ev === 'chop') return startJob(gatherJob('wood', null, 'ตัดไม้'));
    if (c.ev === 'loot' && NC.Auto) {
      farm(game, 'slime_green', c.go || 'farm');
      NC.Auto.set.loot = true; // collecting is this lesson's goal, even when ordinary farming skips drops
      return;
    }
    if (c.ev === 'dummy' || (c.ev === 'skill' && c.at === 'dummy')) return startJob(dummyJob(c.ev === 'skill'));
    if (c.ev === 'pot') {
      const n = NC.POT ? NC.POT.count(p, 'red') : p.potions, full = p.hp >= p.maxHp; // (full: the lesson counts the press, js/lessons.js fullPot)
      if ((n > 0 || full) && NC.drinkPotion) { NC.drinkPotion(game, p, 'red'); if (!full) toast('ดื่มยาแดงแล้ว (ปุ่ม 1)'); return; }
      return toShop(game, 'ไม่มียาแดง ซื้อที่ลุงโกโก้ก่อนนะ');
    }
    if (c.go === 'lv' || c.joblv) return levelUp(game, 0);
    if (c.tier) return jobsTab(game);
    if ((c.ev === 'stat' || c.ev === 'skillup') && pointsLeft(p, c.ev) <= 0) { // (the window would show no + to press)
      QA.note = c.ev === 'stat' ? 'ขึ้นเลเวลก่อน จะได้แต้มสเตตัส' : 'ขึ้น Job Lv ก่อน จะได้แต้มสกิล';
      return farm(game, null, levelMap(p));
    }
    if (c.ev === 'life') return startJob(gatherJob('wood', null, 'ตัดไม้'));
    return false;
  }
  function toShop(game, why) {
    const S = NC.Shop && NC.Shop.npc;
    if (!S) return;
    if (why) toast(why);
    travel(game, { map: 'camp', x: S.x, y: S.y + 90, r: 140, name: 'ลุงโกโก้' }, (g) => { g.paused = NC.HUD.panel('shop', true); });
  }
  function levelUp(game, need) {
    const p = game.player, m = levelMap(p);
    if (need) { QA.note = `ฟาร์มให้ถึง Lv ${need} ก่อน`; QA.lvGoal = need; } // (key() changes when he gets there: the farm stops, the chain goes on)
    farm(game, null, m);
  }
  // the story quest on now (the lessons' story steps, MQ04–07 between them, every quest after the lessons)
  function story(game) {
    const p = game.player, Q = QS(), q = Q.cur();
    if (!q || !q.ok) { stop(q ? 'บทต่อไปมาในอัปเดตหน้า' : 'จบเรื่องที่มีแล้ว'); return; }
    if (!Q.state.on) { if (p.lv < Q.lvNeed(q)) return levelUp(game, Q.lvNeed(q)); return toGiver(game, q); }
    if (Q.ready(q, p)) return toGiver(game, q);
    const k = objIdx(q, p), o = q.obj[k] || {};
    if (o.k === 'kill' || o.k === 'qd') {
      const m = bestMap(o.sp, p) || mapIdByName(q.map) || game.mapId, lv = needLv(o.sp, m, p);
      if (lv) { levelUp(game, lv); QA.note = `ฝึกให้ถึง Lv ${lv} ก่อน (${(NC.MONSTERS[o.sp] || {}).name || o.sp} Lv ${monLo(o.sp, m)}+)`; return; }
      if (o.when) QA.note = `ของเควสดรอปเฉพาะ${o.when === 'night' ? 'กลางคืน' : 'กลางวัน'}`;
      return farm(game, o.sp, m);
    }
    if (o.k === 'mat') return fetchMat(game, o.id);
    if (o.k === 'life') return gatherMats(game, o.ids);
    if (o.k === 'boss') return boss(game, o.sp);
    if (o.k === 'pay') { QA.note = 'ฟาร์มเหรียญให้พอค่าผ่านทาง'; return farm(game, null, levelMap(p)); }
    if (o.k === 'talk' && q.id === 'MQ08') {
      if (tier(p) < 1 && (p.jobLv || 1) < 10) { QA.note = 'ฝึกให้ถึง Job Lv 10'; return farm(game, null, levelMap(p)); }
      return jobsTab(game);
    }
    return toGiver(game, q);
  }
  // the job change is the player's own choice: the skill window on its jobs tab, and AUTO waits
  function jobsTab(game) {
    game.paused = NC.HUD.panel('skills', true);
    setTimeout(() => { const b = document.querySelector('#skillwin [data-tab="jobs"]:not(.on)'); if (b) b.click(); }, 120);
    toast('เลือกอาชีพแรกของเจ้า แล้ว AUTO จะพาไปต่อ');
  }
  const mapIdByName = (name) => Object.keys(NC.MAPS).find((k) => NC.MAPS[k].name === name) || null;
  function toGiver(game, q) {
    const t = giverSpot(q), Q = QS();
    if (!t) { toast('รับ / ส่งเควสได้ที่ ' + (NC.questWhere ? NC.questWhere(q) : 'ค่ายกลางป่า')); return; }
    travel(game, t, (g) => {
      if (t.story) { NC.StoryNPC.open(t.id); return; }
      if (t.id === 'coco' && NC.Lessons.talk && NC.Lessons.talk(g, 'coco', true)) return;
      if (!Q.state.on) Q.take(g); else Q.handIn(g); // (ยายกระต่าย: no talk window of her own)
    });
  }
  function fetchMat(game, id) {
    const p = game.player;
    if (/^lf_/.test(id)) return gatherMats(game, [id]);
    const d = dropper(id, p);
    if (!d) { stop(`ไม่รู้ว่าจะหา${(MAT[id] || {}).name || id}ที่ไหน`); return; }
    const lv = needLv(d.sp, d.map, p);
    if (lv) { levelUp(game, lv); QA.note = `ฝึกให้ถึง Lv ${lv} ก่อน (${(MAT[id] || {}).name || id} ดรอปจาก${(NC.MONSTERS[d.sp] || {}).name || d.sp} Lv ${monLo(d.sp, d.map)}+)`; return; }
    QA.note = `${(MAT[id] || {}).name || id} ดรอปจาก${(NC.MONSTERS[d.sp] || {}).name || d.sp}`;
    farm(game, d.sp, d.map);
  }
  function boss(game, sp) {
    const D = NC.StoryBoss && NC.StoryBoss.S && NC.StoryBoss.S[sp];
    if (!D) { stop('ไม่รู้ว่าบอสอยู่ที่ไหน'); return; }
    QA.note = `บอส ${D.name} · ${mapName(D.map)}`;
    travel(game, { map: D.map, x: D.at[0], y: D.at[1] + 220, r: 320, name: D.name, qa: 'boss' }, (g) => farm(g, sp, D.map, true));
  }
  // a life-skill find: wood / ore (worked), crops (the garden)
  function gatherMats(game, ids) {
    const L = LF();
    if (!L) return;
    const isIn = (k) => (L.GUIDE[k] || []).some((x) => ids.includes(x.mat));
    if (isIn('farm')) return startJob(gardenJob(ids));
    if (isIn('mine')) return startJob(gatherJob('mine', ids, 'ขุดแร่'));
    return startJob(gatherJob('wood', ids, 'ตัดไม้'));
  }

  // ---------------- job: woodcutting / mining ----------------
  const matByName = {};
  for (const id in MAT) if (/^lf_/.test(id)) matByName[MAT[id].name] = id;
  const nodeMat = (n) => { const lb = String(n.label || ''), i = lb.lastIndexOf(' · '); return i >= 0 ? matByName[lb.slice(i + 3)] || null : null; };
  function nodesHere(game) { const out = []; for (const f of LF().finders) { const a = f(game); if (a) for (const n of a) out.push(n); } return out; }
  // the maps a material is said to be found on (the life book's "where to go")
  function mapsFor(skill, ids) {
    const L = LF(), out = new Set();
    const names = Object.keys(NC.MAPS).map((k) => [k, NC.MAPS[k].name]);
    for (const gd of L.GUIDE[skill] || []) {
      if (ids && !ids.includes(gd.mat)) continue;
      for (const part of String(gd.where || '').split(/\s*·\s*/)) {
        const w = part.replace(/\s*(B\d.*|ชั้น.*|\d+–\d+)$/, '').trim();
        if (w.length < 2) continue;
        for (const [k, nm] of names) if (nm === w || nm.startsWith(w) || (w.length >= 4 && w.startsWith(nm))) out.add(k);
      }
    }
    if (skill === 'mine') for (const [m, kind] of L.fieldVeins || []) if (!ids || ids.includes('lf_' + kind)) out.add(m);
    return [...out];
  }
  function gatherJob(skill, ids, verb) {
    return {
      kind: 'gather', skill, ids, verb, node: null, bad: new Set(), tried: new Set(), strikeT: 0, defend: false, calm: 0, look: 0,
      label() { return this.defend ? 'สู้ก่อน' : verb + 'อยู่'; },
      tick(game, dt) {
        const p = game.player, L = LF();
        // a monster on us: the auto farm fights it, then back to work
        // (NC.Auto.afterMe: online e.tgt is the server's id of the hero, not the hero)
        const foe = game.enemies.find((e) => !e.dead && e.hp > 0 && !e.dummy && (NC.Auto && NC.Auto.afterMe ? NC.Auto.afterMe(game, e) : e.tgt === p) && dist(e.x, e.y, p.x, p.y) < 420);
        if (foe) {
          this.calm = 2;
          if (!this.defend && NC.Auto && !NC.Auto.on) { this.defend = true; self(() => { if (p.lifeAct) L.stopWork(game, p); if (NC.Travel.on) NC.Travel.stop(''); NC.Auto.toggle(game); }); }
          return;
        }
        if (this.defend) { this.calm -= dt; if (this.calm > 0) return; this.defend = false; if (NC.Auto && NC.Auto.on) self(() => NC.Auto.toggle(game)); }
        if (p.hp < p.maxHp * 0.45 && p.cd && !(p.cd.pot > 0) && (NC.POT ? NC.POT.count(p, 'red') : p.potions) > 0 && NC.drinkPotion) NC.drinkPotion(game, p, 'red');
        if (p.lifeAct) { this.strikeT -= dt; if (this.strikeT <= 0) { this.strikeT = 0.1; L.strike(game, p); } return; }
        if (NC.Travel.on || p.skillLock > 0) return;
        // at the node: work it
        const n = this.node;
        if (n) {
          this.node = null;
          if ((!n.ok || n.ok()) && dist(p.x, p.y, n.x, n.y) < (n.reach || 130) + 30) { L.work(game, p, n); if (!p.lifeAct) this.bad.add(n); return; }
          if (!n.ok || n.ok()) this.bad.add(n);
        }
        if ((this.look -= dt) > 0) return;
        this.look = 0.3;
        // the next node on this map
        const tool = (L.SKILLS[skill] || {}).tool;
        const list = nodesHere(game).filter((m) => m.skill === skill && !this.bad.has(m) && (!m.ok || m.ok()) && L.lvOf(p, skill) >= (m.lv || 1) &&
          (!m.tier || L.toolTier(p, tool) >= m.tier) && (!ids || ids.includes(nodeMat(m))));
        list.sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y));
        const m = list[0];
        if (m) {
          this.node = m;
          const sp = standAt(game, m);
          if (dist(p.x, p.y, m.x, m.y) < (m.reach || 130) - 10) return; // (in reach already: worked next tick)
          NC.Travel.go(game, { map: game.mapId, x: sp[0], y: sp[1], r: 26, name: verb, qa: 'node', node: m });
          return;
        }
        // none here: the nearest map that has it
        this.tried.add(game.mapId);
        const maps = mapsFor(skill, ids || (skill === 'wood' ? ['lf_oak', 'lf_birch'] : null)).filter((k) => !this.tried.has(k) && route(game.mapId, k) < 99);
        if (!maps.length && (this.rounds = (this.rounds || 0) + 1) < 2) { this.tried = new Set([game.mapId]); this.look = 20; return; } // (all tried: the felled / mined ones grow back, one more round after a rest)
        const risk = (id) => { const I = info(id), lo = I && I.lv ? I.lv[0] : 1; return route(game.mapId, id) + Math.max(0, lo - p.lv) * 0.5; }; // (near, and its monsters not far above the hero)
        maps.sort((a, b) => risk(a) - risk(b));
        if (maps.length) { log(`AUTO: ไป${verb}ที่${mapName(maps[0])}`); NC.Travel.go(game, { map: maps[0], x: 0, y: 0, r: 1e9, name: mapName(maps[0]), qa: 'map' }); return; }
        const what = ids ? ids.map((k) => (MAT[k] || {}).name || k).join(' / ') : 'ต้นไม้';
        const gd = ids && (L.GUIDE[skill] || []).find((x) => ids.includes(x.mat));
        stop(gd && L.lvOf(p, skill) < gd.lv ? `ต้องมี${L.SKILLS[skill].name} Lv ${gd.lv} ก่อน` : `ตอนนี้หา${what}ไม่เจอ ลองใหม่ทีหลังนะ`);
      },
    };
  }
  // a free spot in reach of a node, on the hero's side
  function standAt(game, n) {
    const p = game.player, w = game.world, D = Math.max(50, Math.min(85, (n.reach || 120) - 38));
    const a0 = Math.atan2(p.y - n.y, p.x - n.x);
    for (const da of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.2, -2.2, Math.PI]) {
      const x = n.x + Math.cos(a0 + da) * D, y = n.y + Math.sin(a0 + da) * D * 0.7;
      if (w.fits(x, y, 24)) return [x, y];
    }
    return [n.x, n.y + 40];
  }

  // ---------------- job: the garden (ยายกระต่าย's plots) ----------------
  function gardenJob(ids) {
    const L = LF(), crop = ids[0].replace(/^lf_/, ''), seed = 'sd_' + crop;
    return {
      kind: 'garden', ids, waitTxt: '', buyT: 0,
      label() { return this.waitTxt ? 'รอผักโต' : 'ปลูกผักอยู่'; },
      tick(game) {
        const p = game.player;
        if (game.mapId !== 'homefarm') {
          if (!NC.Travel.on) { const m = L.mentors.find((x) => x.id === 'rabbit'); NC.Travel.go(game, { map: 'homefarm', x: m ? m.x + 60 : 1100, y: m ? m.y + 80 : 1800, r: 120, name: 'ฟาร์มหิ่งห้อย', qa: 'map' }); }
          return;
        }
        if (NC.Travel.on || p.skillLock > 0 || p.lifeAct || game.paused) return;
        const pop = document.querySelector('.lf-pop:not([hidden])');
        if (pop) { const b = pop.querySelector(`button[data-seed="${crop}"]:not([disabled])`); if (b) b.click(); else if (L.closePop) L.closePop(); return; }
        const plots = (game.world.lfPlots || []).filter((n) => !n.ok || n.ok());
        if (!plots.length) return;
        const Q = QS(), q = Q.cur(), k = q && q.obj.findIndex((o) => o.k === 'life' && o.ids.includes('lf_' + crop));
        const have = q && k >= 0 ? Q.state.prog[k] || 0 : 0, need = q && k >= 0 ? q.obj[k].n : 10;
        const verbs = plots.map((n) => n.verb);
        const growing = verbs.filter((v) => v === 'รดน้ำ' || v === 'ดูแปลงผัก' || v === 'เก็บเกี่ยว').length;
        const more = have + growing * 2 < need; // (a watered crop gives 2–3)
        let want = plots.find((n) => n.verb === 'เก็บเกี่ยว') || plots.find((n) => n.verb === 'รดน้ำ');
        if (!want && more) want = plots.find((n) => n.verb === 'ปลูกผัก') || plots.find((n) => n.verb === 'พรวนดิน');
        if (want && want.verb === 'ปลูกผัก' && NC.matCount(p, seed) <= 0) return this.buy(game);
        this.buys = 0;
        if (!want) {
          // waiting for the crops: the nearest one's time left
          const lb = plots.map((n) => String(n.label || '')).find((s) => /อีก/.test(s));
          this.waitTxt = lb ? lb.replace(/^.*?อีก\s*/, 'อีก ').replace(/\s*★.*$/, '') : '';
          QA.note = this.waitTxt ? `รอผักโต ${this.waitTxt}` : '';
          return;
        }
        this.waitTxt = ''; QA.note = '';
        if (dist(p.x, p.y, want.x, want.y) > 80) { NC.Travel.go(game, { map: 'homefarm', x: want.x, y: want.y + 46, r: 30, name: 'แปลงผัก', qa: 'node', node: want }); return; }
        L.work(game, p, want);
      },
      buy(game) {
        const p = game.player, m = L.mentors.find((x) => x.id === 'rabbit');
        if (!m) return;
        if (dist(p.x, p.y, m.x, m.y) > 150) { NC.Travel.go(game, { map: 'homefarm', x: m.x + 40, y: m.y + 70, r: 60, name: m.name, qa: 'node' }); return; }
        if (performance.now() < this.buyT) return;
        this.buyT = performance.now() + 1500;
        // (her window's "ซื้อ 5" button does exactly this: mentor.act; online, life.js sends what changed)
        // (online the pouch is the server's: the seeds may come a moment later, so three tries before giving up)
        if ((this.buys = (this.buys || 0) + 1) > 3) { stop(`ซื้อ${(MAT[seed] || {}).name || 'เมล็ด'}ไม่ได้ (เหรียญไม่พอ หรือปลูกผัก Lv ยังไม่ถึง)`); return; }
        if (m.act) m.act(game, p, 'seed', crop, { dataset: { act: `seed:${crop}:${p.coins >= 100 ? 5 : 1}` } });
      },
    };
  }

  // ---------------- job: the training dummies ----------------
  function dummyOf(game) {
    if (game.mapId !== 'camp') return null;
    const s = NC.CAMP_SPOT && NC.CAMP_SPOT.dummies && NC.CAMP_SPOT.dummies[0];
    let best = null, bd = Infinity;
    for (const e of game.enemies) if (e.dummy && e.type === 'dummy') { const d = s ? dist(e.x, e.y, s[0], s[1]) : 0; if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function skillKey(game, p) {
    for (const k of NC.HOTKEYS || ['q', 'e']) {
      const id = NC.skillForKey && NC.skillForKey(p, k), S = id && NC.SKILLS[id];
      if (!S || S.type === 'buff' || S.type === 'passive') continue;
      if ((NC.skillCd ? NC.skillCd(p, id) : p.cd[k]) > 0) continue;
      if (NC.skillCost && p.sp < NC.skillCost(p, id, NC.skillLv(p, id))) continue;
      return k;
    }
    return null;
  }
  function dummyJob(skill) {
    return {
      kind: 'dummy', skill, castT: 0,
      label() { return 'ตีหุ่นอยู่'; },
      tick(game) {
        const p = game.player, s = NC.CAMP_SPOT && NC.CAMP_SPOT.dummies && NC.CAMP_SPOT.dummies[0];
        if (NC.Travel.on || !s) return;
        const d = dummyOf(game);
        if (!d) { NC.Travel.go(game, { map: 'camp', x: s[0] - 100, y: s[1] + 20, r: 50, name: 'หุ่นฟาง', qa: 'map' }); return; }
        if (dist(p.x, p.y, d.x, d.y) > 150) NC.Travel.go(game, { map: 'camp', x: d.x - 95, y: d.y + 15, r: 40, name: 'หุ่นฟาง', qa: 'node' });
      },
      input(game) {
        const p = game.player, d = dummyOf(game);
        if (!d || NC.Travel.on || dist(p.x, p.y, d.x, d.y) > 170) return null;
        const o = { aim: [d.x, d.y - 50], attack: true };
        if (this.skill && game.time > this.castT) { const k = skillKey(game, p); if (k) { o.key = k; o.attack = false; this.castT = game.time + 1.5; } }
        return o;
      },
    };
  }

  // ---------------- on / off ----------------
  function start(game) {
    if (!game || !game.player || game.player.dead > 0) return;
    QA.on = true; lastKey = null; waiting = false; downs = 0; downAt = ''; QA.retries = 0; QA.trainTo = 0; QA.stuckN = 0; QA.stuckMap = '';
    if (NC.Auto && NC.Auto.on) self(() => NC.Auto.toggle(game)); // (one driver at a time: the quest's AUTO takes over the farm)
    log('AUTO: พาไปทำเควส (เดินเอง / Z / กด AUTO อีกครั้ง = หยุด)');
    next(game);
  }
  function stop(why) {
    const g = G();
    if (!QA.on) return;
    QA.on = false; waiting = false; retreat = false;
    if (g) { self(() => { endJob(g); endFarm(g); if (NC.Travel.on) NC.Travel.stop(''); }); }
    if (why) { log('หยุด AUTO · ' + why); toast(why); }
    decorate();
  }
  // running: a press stops it; waiting (a window the player closed, a step done by hand): a press tries again
  function press(game) {
    if (!QA.on) { start(game); return; }
    const running = NC.Travel.on || job || (NC.Auto && NC.Auto.on && own.farmOn);
    if (running) stop('ปิด AUTO'); else next(game);
  }
  Object.assign(QA, { start: () => start(G()), stop, next: () => next(G()), press: () => press(G()), key, waiting: () => QA.on && waiting, busy: () => !!(QA.on && (NC.Travel.on || job || (NC.Auto && NC.Auto.on))), bestMap, levelMap, dropper, mapsFor });

  // the buttons: the tracker's AUTO, the talk window's "AUTO พาไปทำ", the journey's story steps
  document.addEventListener('click', (e) => {
    const t = e.target && e.target.closest ? e.target.closest('#lstrack [data-ls="auto"], #qdlg [data-qd="auto"], #journey [data-jauto]') : null;
    const g = G();
    if (!t || !g || !g.player) return;
    if (t.closest('#journey')) { // (the journey's other steps keep their own AUTO)
      const Js = J().state, D = NC.JOURNEY_DATA, raw = D && D.stages[Js.stage] && D.stages[Js.stage].steps[Js.step];
      if (!raw || !raw.auto || raw.auto.k !== 'story') return;
    }
    e.stopPropagation(); e.preventDefault();
    if (t.closest('#qdlg')) { const x = $('qd-x'); if (x) x.click(); if (QA.on && !job && !NC.Travel.on) { next(g); return; } }
    press(g);
    decorate();
  }, true);
  J().storyAuto = (game) => story(game || G()); // (lessons.js's AUTO asks it for a story step: the goals above)

  // the player's own hands stop it; a stop the chain did not make itself (stuck, no way) stops it too
  const baseStop = NC.Travel.stop;
  NC.Travel.stop = function (why) {
    const was = NC.Travel.on, t = NC.Travel.target;
    const r = baseStop.apply(this, arguments);
    if (!was || quiet || !QA.on || !why || why === 'หมดแรง') return r; // (a fall: tick() takes it up again at the camp)
    if (job && t && t.qa === 'node' && why !== 'เดินเอง' && why !== 'หมดแรง') { if (t.node && job.bad) job.bad.add(t.node); return r; } // (that tree is out of reach: the next one)
    // stuck on the way (online the server's pull-back can wedge the walk): plan the way again from here, three times on
    // one map before it gives up (2026-10-18: one "ติดทาง" ended the whole chain)
    if (/^ติดทาง/.test(why)) {
      const g = G(), m = g ? g.mapId : '';
      if (QA.stuckMap !== m) { QA.stuckMap = m; QA.stuckN = 0; }
      if (++QA.stuckN <= 3) { endJob(g); lastKey = null; return r; }
    }
    stop(why);
    return r;
  };
  // the player turning the farm AUTO off (Z, its button) while the quest's AUTO runs: both stop. The quest's AUTO
  // switched the farm AUTO back on at the next monster, so "off" did nothing (2026-10-20 Discord #134 "ปิดแล้ว แต่ยังทำงาน")
  if (NC.Auto && NC.Auto.toggle) {
    const baseToggle = NC.Auto.toggle;
    NC.Auto.toggle = function (game) {
      const wasOn = NC.Auto.on, r = baseToggle.apply(this, arguments);
      if (wasOn && !NC.Auto.on && !quiet && QA.on) stop('ปิดออโต้');
      return r;
    };
  }
  const baseUP = NC.updatePlayer;
  NC.updatePlayer = function (game, dt) {
    if (!QA.on) return baseUP.apply(this, arguments);
    const p = game.player, I = game.input, M = game.mouse;
    if (I.mx || I.my || M.down) { stop('ควบคุมเอง'); return baseUP.apply(this, arguments); }
    let keep = null;
    try { if (job && job.tick) job.tick(game, dt); } catch (e) { console.error(e); }
    const o = job && job.input ? job.input(game, dt) : null;
    if (o) {
      if (o.attack) I.attack = true;
      if (o.key) I[o.key] = true;
      if (o.aim) { keep = { wx: M.wx, wy: M.wy, active: M.active }; M.wx = o.aim[0]; M.wy = o.aim[1]; M.active = true; }
    }
    try { return baseUP.apply(this, arguments); } finally { if (keep) { M.wx = keep.wx; M.wy = keep.wy; M.active = keep.active; } }
  };

  // ---------------- every frame: the chain, the farm's goal, the talk window, the tracker's words ----------------
  let downAt = '', downs = 0, wasDead = false, emptyT = 0, retreat = false;
  function tick(game) {
    const p = game.player, A = NC.Auto;
    if (!QA.on) return;
    // fallen: back at the camp it goes on (the same goal twice more at most: then it is too strong for now)
    if (p.dead > 0) {
      if (!wasDead) {
        wasDead = true;
        const k = key(); downs = k === downAt ? downs + 1 : 1; downAt = k;
        // (the auto farm and the walk stop by themselves on a fall: only our own bits are put back)
        if (job) job.defend = false;
        self(() => endJob(game));
        if (A && own.set) { A.set.off = own.set.off; A.set.boss = own.set.boss; A.set.loot = own.set.loot; }
        own.farm = false; own.farmOn = false; own.key = null; own.set = null;
      }
      return;
    }
    if (wasDead) {
      wasDead = false;
      // the third fall on the same goal: too strong for now. Home to the camp (the hero gets up where he fell), then off
      // (2026-10-18: it stopped there, and the quest looked stuck: now it trains two levels where it is safe and tries
      // again, up to four times; a fall while training counts on its own goal)
      if (downs >= 3 && (QA.retries = (QA.retries || 0) + 1) <= 4) {
        const lv = p.lv + 2;
        downs = 0; downAt = '';
        self(() => endJob(game));
        endFarm(game);
        log(`AUTO: มอนแรงเกินไป · ฝึกให้ถึง Lv ${lv} ก่อน แล้วไปต่อเอง`);
        QA.trainTo = lv;
        next(game);
        return;
      }
      if (downs >= 3) {
        const why = 'มอนแรงเกินไป ฝึกเลเวลก่อนแล้วค่อยกด AUTO ใหม่';
        if (game.mapId !== 'camp') { log('AUTO: กลับค่ายก่อน · ' + why); retreat = true; travel(game, { map: 'camp', x: null, y: null, name: mapName('camp') }, () => stop(why)); job = null; }
        else stop(why);
        return;
      }
      lastKey = null; log('AUTO: ฟื้นแล้ว ไปต่อ');
    }
    if (A && A.on && own.farm && !own.farmOn) { own.farmOn = true; } // retain the goal from before farming began, even if a reply completed it before this frame
    if (A && !A.on && own.farmOn) { own.farmOn = false; own.farm = false; if (own.set) { A.set.off = own.set.off; A.set.boss = own.set.boss; A.set.loot = own.set.loot; own.set = null; } stop('ออโต้ฟาร์มหยุด'); return; }
    talkCount();
    if (retreat) return; // (walking home after the third fall: it stops there)
    if ((chk -= 1 / 60) > 0) return;
    chk = 0.25;
    const k = key();
    if (own.farmOn && k !== own.key) { endFarm(game); } // (its goal is met)
    // a farm with nothing to hunt (switched on in the camp by hand, a cleared map): AUTO picks the place again
    if (own.farmOn && A && A.on) {
      const live = game.enemies.some((e) => !e.dead && e.hp > 0 && !e.dummy && !e.npc);
      emptyT = live ? 0 : emptyT + 0.25;
      if (emptyT > 6) { emptyT = 0; endFarm(game); lastKey = null; }
    }
    if (job) { if (job.key !== k) endJob(game); else return; }
    if (NC.Travel.on || (A && A.on) || p.lifeAct || game.hold) return;
    if ([...document.querySelectorAll('.sp-pop')].some((e) => !e.hidden)) return;
    if (game.paused) {
      // a window open: a step done in it (sold, now buy; a stat point, now the skill +1; the lesson ready) moves the chain
      // on, so the next window or the walk comes by itself (before, AUTO sat still until the window was closed)
      const d = $('qdlg');
      if (k !== lastKey && !(d && !d.hidden)) next(game);
      return;
    }
    if (k !== lastKey) next(game); else waiting = true;
  }
  // the talk window AUTO walked to: its big button presses itself after 3 s (a click in it stops the count)
  function talkCount() {
    const d = $('qdlg');
    if (!d || d.hidden) { if (d) delete d.dataset.qaHold; cd = null; return; }
    if (!d.dataset.qaWired) { d.dataset.qaWired = '1'; d.addEventListener('mousedown', () => { d.dataset.qaHold = '1'; if (cd && cd.b) cd.b.textContent = cd.txt; cd = null; }); }
    const b = d.dataset.qaHold ? null : d.querySelector('[data-qd="take"]:not([disabled]), [data-qd="in"]:not([disabled]), [data-qd="staken"]:not([disabled]), [data-qd="sin"]:not([disabled])');
    if (!b) {
      // taken / handed in and the window stays (a lesson of its own): it steps aside for AUTO to go on
      const go = !d.dataset.qaHold && d.querySelector('[data-qd="auto"], [data-qd="goto"]');
      if (!go) { cd = null; return; }
      if (!cd || cd.b) cd = { b: null, t: performance.now() };
      if (performance.now() - cd.t > 900) { cd = null; const x = $('qd-x'); if (x) x.click(); }
      return;
    }
    if (!cd || cd.b !== b) cd = { b, t: performance.now(), txt: b.textContent };
    const left = 3 - (performance.now() - cd.t) / 1000;
    const txt = `${cd.txt} (${Math.max(1, Math.ceil(left))})`;
    if (left <= 0) { b.textContent = cd.txt; cd = null; b.click(); return; }
    if (b.textContent !== txt) b.textContent = txt;
  }
  // the tracker: what AUTO does now on its button, the story goal's own count instead of "ทำเป้าของเควสให้ครบ"
  function goalText() {
    const g = G(), p = g.player, Q = QS(), q = Q.cur();
    if (!q || !Q.state.on) return '';
    const k = objIdx(q, p), o = q.obj[k];
    if (!o) return '';
    return strip(Q.objText(o, k, p));
  }
  function decorate() {
    const trk = $('lstrack');
    if (!trk || trk.hidden) return;
    const b = trk.querySelector('[data-ls="auto"]'), g = G();
    const A = NC.Auto, busy = NC.Travel.on || (A && A.on);
    if (b && QA.on) {
      const txt = NC.Travel.on ? 'กำลังไป' : job ? job.label() : A && A.on ? 'บอททำอยู่' : 'AUTO';
      if (b.textContent !== txt) b.textContent = txt;
      if (!b.classList.contains('on')) b.classList.add('on');
      b.title = 'AUTO เปิดอยู่ · กดอีกครั้งเพื่อหยุด';
      b.dataset.qa = '1';
    } else if (b && b.dataset.qa) { // (off again: back to lessons.js's own words until it redraws the row)
      delete b.dataset.qa; b.title = '';
      b.textContent = NC.Travel.on ? 'กำลังไป' : A && A.on ? 'บอททำอยู่' : 'AUTO';
      b.classList.toggle('on', !!busy);
    }
    const sm = trk.querySelector('.ls-row.cur small:not(.ls-goals)');
    if (sm && g && g.player) {
      if (sm.dataset.qaBase === undefined) sm.dataset.qaBase = sm.textContent; // (lessons.js redraws the row: a new element)
      const base = sm.dataset.qaBase;
      let t = base === 'ทำเป้าของเควสให้ครบ' ? goalText() || base : base;
      if (QA.on && QA.note) t += ' · ' + QA.note;
      if (sm.textContent !== t) sm.textContent = t;
    }
  }
  const baseUpdate = NC.HUD.update.bind(NC.HUD);
  NC.HUD.update = function (game) {
    baseUpdate(game);
    try { if (game && game.player) { tick(game); decorate(); } } catch (e) { console.error(e); }
  };
})();
