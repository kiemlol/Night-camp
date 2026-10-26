/* journey.js — เส้นทางนักเดินทาง: the guided journey for new players (the user, 2026-10-12: "ทำระบบเควสแนะนำ เหมือนสอน
   ให้ไปไหนทำอะไร แบบ journey แบบกดออโต้ได้เลย ช่วงเควสแรกๆ"; ends at Lv 20 after Ivy, "2 ดีกว่า"; looks: mockup B
   "ภูตไฟพูดบอก", assets/gen/nightcamp_journey_b_raw.png).
     the guide   ประกาย, a little ember spirit from the campfire (assets/journey/sp_*.png, Codex), floating beside the hero
                 with a speech bubble: the step, where, the progress, the reward, AUTO and skip
     the stages  1 คืนแรก (Lv 1–10, ends with the first job) · 2 พ้นแสงไฟ (Lv 10–20, ends with Ivy, the first story boss);
                 tabs + a bar of step dots across the top centre, a chest at the end of each (coins + potions)
     AUTO        walks the hero there across maps (js/autotravel.js) and does what can be done: talks to the NPC, opens
                 the window, switches the auto farm on for the step's monster, plays the story quest's next objective
     the way     firefly lights on the ground to where the step is (or the warp towards it) and a gold arrow over it
                 (assets/journey/fly.jpg, arrow.png); a step that is a button (the bag, status, skills...) puts a ring and a
                 bouncing arrow on that button
     rewards     coins and the potions a step teaches with (the quest rules: no EXP, no gear)
   Steps are checked from counters this file keeps (kills, sells, refines, potions, sitting, stat / skill points, gathering,
   windows opened, maps reached), so a step done before it comes up counts at once where that makes sense.
   Saved: nightcamp.journey.v1. Also fixes what the first quests needed: green slimes on the farm by the camp road (the
   story's MQ02 / MQ03 had none anywhere), a warning at the camp's south exit (a Lv 55–78 map next to the start).
   Test: ?journey=2.4 (stage 2, step 4) · ?nojourney (hidden) · NC.Journey. */
(function () {
  'use strict';
  const NC = window.NC;
  const G = () => NC.game;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY = 'nightcamp.journey.v1';
  const fmt = (n) => (NC.fmtCoins ? NC.fmtCoins(n) : String(n));

  // ---------------- the first quests' fixes ----------------
  // green slimes (the story's first hunt, MQ02, and its jelly, MQ03) only lived in the old camp: a strip along the farm's
  // road in from the camp gets them, Lv 1–5, with eight fixed spots so there are always some
  const SLIME_ZONE = 'ทุ่งสไลม์ริมทาง';
  if (NC.MAPS.farm && !NC.MAPS.farm.zones.some((z) => z.name === SLIME_ZONE)) {
    NC.MAPS.farm.zones.unshift({ name: SLIME_ZONE, rect: [600, 1300, 1900, 1720], lv: { slime: [1, 5], hollow: [3, 6] } });
    if (NC.ROSTER.farm) NC.ROSTER.farm[SLIME_ZONE] = { slime: [['slime_green', 1]], hollow: [['slime_green', 1]] };
    const SPOTS = [[700, 1380], [880, 1620], [1050, 1400], [1230, 1640], [1400, 1380], [1560, 1600], [1720, 1400], [1820, 1640]];
    const baseBuild = NC.buildField;
    NC.buildField = function (def) {
      const w = baseBuild.apply(this, arguments);
      if (def && def.id === 'farm' && w && w.spawns) for (const [x, y] of SPOTS) w.spawns.push(['slime', x, y]);
      return w;
    };
  }
  // (the new camp has no monsters: its old roster sent the quests' "let the bot farm" to the camp for green slimes)
  if (NC.ROSTER && NC.ROSTER.camp) delete NC.ROSTER.camp;
  // the camp's south road goes straight to ผาหินแดง (Lv 55–78): a red warning over that exit for a low hero
  const baseLabels = NC.Maps.drawLabels;
  NC.Maps.drawLabels = function (ctx, game) {
    baseLabels.apply(this, arguments);
    const p = game.player;
    if (game.mapId !== 'camp' || !p || p.lv >= 45) return;
    for (const w of game.portals) if (w.to === 'canyon' && NC.dist(p.x, p.y, w.x, w.y) < 1100) {
      ctx.save();
      ctx.font = "700 26px 'Mitr', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = NC.OUTLINE || '#2a2435';
      const y = w.y - 215 + Math.sin(game.time * 3) * 4;
      ctx.strokeText('อันตราย! มอน Lv 55+', w.x, y); ctx.fillStyle = '#ff6a6a'; ctx.fillText('อันตราย! มอน Lv 55+', w.x, y);
      ctx.restore();
    }
  };

  // ---------------- what the player did (counters) ----------------
  let st = { stage: 0, step: 0, base: {}, chest: {}, done: false, hide: false, ev: {} };
  let loaded = false;
  try { if (!NC.ONLINE) { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) { st = Object.assign(st, s); loaded = true; } } } catch (e) { /* blocked */ }
  const ev = st.ev;
  let saveKey = KEY, keyed = false; // (?online: one journey per hero on this device, NC.Journey.useSave)
  const save = () => { const g = G(); if (g && g.noSave && !keyed) return; try { localStorage.setItem(saveKey, JSON.stringify(st)); } catch (e) { /* blocked */ } };
  const bump = (k, n) => { ev[k] = (ev[k] || 0) + (n || 1); dirty = true; };
  let dirty = false;

  NC.skillKills.push((game, e) => { if (!e) return; bump('kill'); bump('k_' + e.type); });
  const wrap = (obj, name, after) => { if (!obj || typeof obj[name] !== 'function') return; const base = obj[name]; obj[name] = function () { const r = base.apply(this, arguments); try { after(r, arguments); } catch (e) { /* the counter never breaks the game */ } return r; }; };
  wrap(NC, 'equip', () => bump('equip'));
  wrap(NC, 'drinkPotion', () => bump('pot'));
  if (NC.POT) wrap(NC.POT, 'drink', () => bump('pot'));
  if (NC.Rest) wrap(NC.Rest, 'toggle', () => { const g = G(); if (g && g.player.sit) bump('sit'); });
  if (NC.Econ) wrap(NC.Econ, 'sell', () => bump('sell'));
  wrap(NC, 'raiseStat', (r) => { if (r !== false && r !== 0) bump('stat'); });
  wrap(NC, 'raiseSkill', (r) => { if (r) bump('skill'); });
  if (NC.Life) wrap(NC.Life, 'addXp', () => bump('life'));
  if (NC.invActs) NC.invActs.unshift((game, a) => { if (/^rf:go:/.test(a || '')) bump('refine'); return false; });
  wrap(NC.HUD, 'mapChanged', (r, a) => {
    const game = a[0], prev = a[1] && (a[1].mapId || a[1].field); // (maps.js passes the previous world)
    bump('m_' + game.mapId);
    // a warp home from far away (not walked in from a neighbour): the world map's guiding flame
    if (game.mapId === 'camp' && prev && NC.MapRoute) { const path = NC.MapRoute.pathTo(prev, 'camp'); if (path && path.length > 2) bump('warphome'); }
  });
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-qt="daily"]')) bump('daily'); }, true);

  // ---------------- where things are ----------------
  const npc = (id) => { const n = NC.StoryNPC && NC.StoryNPC.byId(id); return n ? { map: n.map, x: n.x, y: n.y + 60, r: 150, name: n.name || id, npc: id } : null; };
  const SPOT = {
    coco: () => NC.Shop && NC.Shop.npc ? { map: 'camp', x: NC.Shop.npc.x, y: NC.Shop.npc.y + 90, r: 140, name: 'ลุงโกโก้' } : null,
    forge: () => NC.Forge && NC.Forge.npc ? { map: 'camp', x: NC.Forge.npc.x - 60, y: NC.Forge.npc.y + 90, r: 150, name: 'ป๋าหมูหริ่ง' } : null,
    ivy: () => ({ map: 'meadow', x: 3925, y: 1455, r: 220, name: 'ไอวี่' }),
  };
  const mapHere = (id) => { const g = G(); return !!(g && g.mapId === id); };
  // the field that suits the hero's level (for a step that needs levels / job levels)
  const farmMap = (p) => (p.lv < 8 ? 'farm' : p.lv < 16 ? 'meadow' : 'marsh');
  const mapName = (id) => (NC.MAPS[id] || {}).name || id;
  const mapIdByName = (name) => Object.keys(NC.MAPS).find((k) => NC.MAPS[k].name === name) || null;
  // the maps a species lives on (the camp never: no monsters there)
  const whereLives = (sp) => Object.keys(NC.ROSTER || {}).find((m) => m !== 'camp' && NC.MAPS[m] && JSON.stringify(NC.ROSTER[m]).includes(`"${sp}"`)) || null;
  const tier = (p) => ((NC.JOBS[p.job] || {}).tier || 0);

  // ---------------- AUTO: the things a step can do ----------------
  const autoOn = () => !!(NC.Auto && NC.Auto.on);
  function farm(game, sp, mapId, quiet) {
    const A = NC.Auto;
    if (!A) return;
    A.set.off = sp ? Object.keys(NC.MONSTERS).filter((x) => x !== sp) : [];
    const go = () => { if (!A.on) A.toggle(game); if (!quiet) NC.HUD.log(`ออโต้ฟาร์ม: ${sp ? 'ล่าเฉพาะ' + ((NC.MONSTERS[sp] || {}).name || sp) : 'ล่าทุกตัวในแมพ'} (Z หยุด)`, 'level'); };
    const m = mapId || game.mapId;
    if (m !== game.mapId) travel(game, { map: m, x: null, y: null, name: mapName(m) }, go); else go();
  }
  // walk to a place (a map alone: its arrival point, i.e. done on entering it)
  function travel(game, to, then) {
    if (!to || !NC.Travel) return;
    const t = Object.assign({}, to);
    if (t.x == null) { t.x = 0; t.y = 0; t.r = 1e9; }
    t.done = (g) => { if (then) setTimeout(() => then(g), 250); };
    NC.Travel.go(game, t);
  }
  const openPanel = (id) => (game) => { game.paused = NC.HUD.panel(id, true); };
  // the story quest's next objective (stage 2's last steps): take / hand in at its giver, farm its monster, or level up
  function storyAuto(game) {
    const Q = NC.Quests, q = Q && Q.cur(), p = game.player;
    if (!q) return;
    const giver = q.giver && npc(q.giver);
    if (!Q.state.on) {
      if (p.lv < Q.lvNeed(q)) { farm(game, null, farmMap(p)); return; }
      if (giver) travel(game, giver, () => NC.StoryNPC.open(q.giver));
      return;
    }
    if (Q.ready && Q.ready(q, p)) { if (giver) travel(game, giver, () => NC.StoryNPC.open(q.giver)); return; }
    const k = q.obj.findIndex((o, i) => o.k !== 'talk' && !(Q.objDone ? Q.objDone(q, o, i, p) : false));
    const o = q.obj[k >= 0 ? k : 0] || {};
    if (o.k === 'boss') { travel(game, SPOT.ivy(), null); return; }
    if ((o.k === 'kill' || o.k === 'qd') && o.sp) { farm(game, o.sp, whereLives(o.sp) || mapIdByName(q.map) || game.mapId); return; }
    if (o.k === 'life') { travel(game, { map: mapIdByName(q.map) || 'homefarm', x: null, y: null, name: q.map }, null); NC.HUD.log('เก็บของอาชีพเสริมเองนะ (เดินไปใกล้ ๆ แล้วกดเก็บ)', 'sys'); return; }
    const m = mapIdByName(q.map);
    if (m && m !== 'camp') farm(game, null, m); else if (giver) travel(game, giver, () => NC.StoryNPC.open(q.giver));
  }

  // ---------------- the steps (js/journey_data.js: the same steps the server and Unity read) ----------------
  const since = (k) => (ev[k] || 0) - (st.base[k] || 0);
  const ever = (k) => ev[k] || 0;
  const BTN = {
    bag: '.menubar [data-panel="bag"]', status: '.menubar [data-panel="status"]', skills: '.menubar [data-panel="skills"]',
    map: '.menubar [data-panel="bigmap"]', journal: '.menubar .mbtn[title*="(J)"]', party: '.menubar .mbtn[title*="(P)"]', auto: '#af-btn',
  };
  const D = NC.JOURNEY_DATA || { stages: [] };
  // a step's check -> a number to hold against its need
  function val(c, p, need) {
    if (!c) return 0;
    const Q = NC.Quests;
    switch (c.k) {
      case 'any': return Math.max(0, ...c.of.map((x) => val(x, p, need)));
      case 'ever': return ever(c.ev);
      case 'since': return since(c.ev);
      case 'map': return ever('m_' + c.map) || mapHere(c.map) ? need : 0;
      case 'jobLv': return tier(p) >= 1 ? need : p.jobLv || 1;
      case 'tier': return tier(p) >= (c.n || 1) ? need : 0;
      case 'done': return Q && Q.done(c.id) ? need : 0;
      case 'reached': return Q && Q.reached && Q.reached(c.id) ? need : 0;
    }
    return 0;
  }
  // where a target is on this side: an NPC, a map's nearest monster of a kind, a map, a point
  function place(t) {
    if (!t) return null;
    if (t.npc) return t.npc === 'coco' ? SPOT.coco() : t.npc === 'forge' ? SPOT.forge() : npc(t.npc);
    const g = G();
    if (t.sp && g && g.mapId === t.map) {
      const p = g.player, near = g.enemies.filter((e) => e.type === t.sp && !e.dead).sort((a, b) => NC.dist(a.x, a.y, p.x, p.y) - NC.dist(b.x, b.y, p.x, p.y))[0];
      if (near) return { map: t.map, x: near.x, y: near.y, r: 220 };
    }
    if (t.x != null) return { map: t.map, x: t.x, y: t.y, r: 220 };
    return { map: t.map, x: null, y: null, r: 1e9, name: mapName(t.map) };
  }
  // what AUTO does for a step
  function doAuto(game, a) {
    if (!a) return;
    const p = game.player;
    switch (a.k) {
      case 'npc': {
        const t = place({ npc: a.npc });
        if (!t) return;
        travel(game, t, (g) => { if (a.panel) openPanel(a.panel)(g); else if (NC.StoryNPC && NC.StoryNPC.byId(a.npc)) NC.StoryNPC.open(a.npc); });
        return;
      }
      case 'go': travel(game, place({ map: a.map }), null); return;
      case 'farm': farm(game, a.sp || null, a.lvMap ? farmMap(p) : a.map || game.mapId); return;
      case 'panel': openPanel(a.panel)(game); return;
      case 'stat': if (NC.statusLeft(p) > 0) openPanel('status')(game); else farm(game, null, farmMap(p)); return;
      case 'potion': if (NC.drinkPotion) NC.drinkPotion(game, p, 'red'); return;
      case 'sit': if (NC.Rest && !p.sit) NC.Rest.toggle(game); return;
      case 'warp': if (NC.Econ && NC.Econ.warp) NC.Econ.warp(game, a.map); return;
      case 'daily': NC.Hub.open('quest'); setTimeout(() => { const b = document.querySelector('[data-qt="daily"]'); if (b) b.click(); }, 120); return;
      case 'story': storyAuto(game); return;
    }
  }
  const STAGES = D.stages.map((S) => Object.assign({}, S, { steps: S.steps.map((x) => Object.assign({}, x, {
    prog: (p) => val(x.check, p, x.need),
    auto: x.auto ? (g) => doAuto(g, x.auto) : null,
    target: x.target ? () => place(x.target) : null,
    wait: x.wait === 'statPoints' ? (p) => (NC.statusLeft(p) > 0 ? '' : 'ขึ้นเลเวลก่อนนะ จะได้แต้มมาอัพ') : null,
    progText: x.progress === 'story' ? () => storyText() : null,
  })) }));
  function storyText() {
    const Q = NC.Quests, q = Q && Q.cur();
    if (!q) return '';
    const i = Q.data.indexOf(q), end = Q.data.findIndex((x) => x.id === 'MQ15');
    return `เควส ${Math.min(i + 1, end + 1)} / ${end + 1} · ${q.title}`;
  }
  const cur = () => (st.done ? null : (STAGES[st.stage] || {}).steps ? STAGES[st.stage].steps[st.step] : null);
  const stageDone = () => !STAGES[st.stage] || st.step >= STAGES[st.stage].steps.length;

  // ---------------- moving on ----------------
  let flash = 0, talkT = 0;
  function startStep(game) {
    const s = cur();
    st.base = Object.assign({}, ev);
    talkT = 2.2; openT = 8;
    if (s && s.give) give(game, s.give, false);
    save(); render(true);
  }
  function give(game, r, loud) {
    if (NC.Journey.noPay) return; // (?online: only the server pays: js/online/extras.js)
    const p = game.player, bits = [];
    if (r.coins) { p.coins = (p.coins || 0) + r.coins; bits.push(fmt(r.coins) + ' เหรียญ'); }
    for (const c of ['red', 'blue']) if (r[c]) {
      if (NC.POT) NC.POT.add(p, c, NC.POT.sizeFor(p.lv), r[c]); else if (c === 'red') p.potions += r[c]; else p.spPotions += r[c];
      bits.push(`ยา${c === 'red' ? 'แดง' : 'ฟ้า'} ${r[c]}`);
    }
    if (bits.length) NC.HUD.log((loud ? '' : 'ประกายให้ ') + bits.join(' · '), 'level');
  }
  function complete(game) {
    const s = cur();
    if (!s) return;
    if (s.coins && !NC.Journey.noPay) { game.player.coins = (game.player.coins || 0) + s.coins; NC.HUD.log(`เส้นทางนักเดินทาง: ${s.title} ✔ +${fmt(s.coins)} เหรียญ`, 'level'); }
    if (game.toast) game.toast('สำเร็จ! ' + s.title);
    flash = 2.2;
    if (NC.Travel && NC.Travel.on) NC.Travel.stop('');
    st.step++;
    if (stageDone()) { save(); render(true); return; } // (the chest waits to be opened)
    startStep(game);
  }
  function skip(game) {
    if (!cur()) return;
    st.step++;
    if (!stageDone()) startStep(game); else { save(); render(true); }
  }
  function openChest(game) {
    if (!stageDone() || st.done) return;
    const S = STAGES[st.stage];
    give(game, S.chest, true);
    st.chest[st.stage] = Date.now();
    showReward(S);
    st.stage++; st.step = 0;
    if (!STAGES[st.stage]) { st.done = true; NC.HUD.log('จบเส้นทางนักเดินทางแล้ว! ต่อจากนี้ทำเควสเนื้อเรื่อง (J) กับกระดานรายวัน', 'level'); save(); render(true); return; }
    startStep(game);
  }

  // ---------------- the page bits ----------------
  let root = null, sayEl = null, spEl = null, topEl = null, spotEl = null, rewEl = null, dlgEl = null;
  const IMG = (n) => `assets/journey/${n}`;
  const COIN = () => (NC.matIcon ? NC.matIcon('ic_coin') : '');
  function build() {
    root = document.createElement('div');
    root.id = 'journey';
    root.innerHTML = '<div class="jn-top" id="jn-top"></div><img class="jn-spirit" id="jn-spirit" alt="ประกาย"><div class="jn-say" id="jn-say"></div><div class="jn-spot" id="jn-spot" hidden></div>';
    document.body.appendChild(root);
    // the ring on a button inside a window (the story talk's "รับเควส"): over the windows, outside #journey (hidden then)
    dlgEl = document.createElement('div');
    dlgEl.className = 'jn-spot jn-dlg'; dlgEl.hidden = true;
    dlgEl.innerHTML = `<img src="${IMG('arrow.png')}" alt=""><b></b>`;
    document.body.appendChild(dlgEl);
    sayEl = $('jn-say'); spEl = $('jn-spirit'); topEl = $('jn-top'); spotEl = $('jn-spot');
    spEl.style.cssText = 'position:absolute;left:0;top:0;width:calc(84 * var(--u));pointer-events:auto;cursor:pointer;filter:drop-shadow(0 0 calc(14 * var(--u)) rgba(255,170,60,0.7));';
    spEl.src = IMG('sp_idle.png');
    spEl.addEventListener('click', () => { if (st.hide) { st.hide = false; pinned = false; } else { pinned = !pinned; openT = 0; } save(); render(true); });
    root.addEventListener('click', (e) => {
      const game = G(); if (!game) return;
      if (e.target.closest('[data-jauto]')) { const s = cur(); if (s && s.auto) { s.auto(game); pinned = false; openT = 0; render(true); } return; }
      if (e.target.closest('[data-jskip]')) { skip(game); return; }
      if (e.target.closest('[data-jhide]')) { st.hide = true; pinned = false; openT = 0; save(); render(true); return; }
      if (e.target.closest('[data-jmin]')) { pinned = false; openT = 0; render(true); return; }
      if (e.target.closest('[data-jopen]')) { pinned = true; render(true); return; }
      if (e.target.closest('[data-jchest]')) { openChest(game); return; }
      if (e.target.closest('[data-jok]')) { if (rewEl) { rewEl.remove(); rewEl = null; } return; }
    });
  }
  function showReward(S) {
    if (rewEl) rewEl.remove();
    rewEl = document.createElement('div');
    rewEl.className = 'jn-reward';
    rewEl.innerHTML = `<img class="ch" src="${IMG('chest_open.png')}" alt=""><h3>จบช่วง "${esc(S.name)}"!</h3>` +
      `<p>${fmt(S.chest.coins)} เหรียญ · ยาแดง ${S.chest.red} · ยาฟ้า ${S.chest.blue}</p>` +
      (STAGES[st.stage + 1] ? `<p>ต่อไป: ช่วง ${st.stage + 2} "${esc(STAGES[st.stage + 1].name)}" (${STAGES[st.stage + 1].lv})</p>` : '<p>จบเส้นทางนักเดินทางแล้ว ต่อจากนี้ไปตามเควสเนื้อเรื่องได้เลย</p>') +
      '<button class="kw-btn gold" data-jok="1">รับ</button>';
    root.appendChild(rewEl);
  }
  // the bar of stages and steps (top centre) and the bubble's words
  let lastKey = '', lastFull = null, pinned = false, openT = 0; // (the bubble opens in full for a new step, then folds to one line)
  function render(force) {
    if (!root) return;
    const game = G(), p = game && game.player;
    if (!p) return;
    const off = st.done || !!(NC.Lessons && NC.Lessons.active && NC.Lessons.active()); // (js/lessons.js teaches the first chapter)
    root.hidden = off && !rewEl;
    if (off) return;
    const S = STAGES[st.stage], s = cur();
    const need = s ? s.need : 1, n = s ? Math.max(0, Math.min(need, Math.floor(s.prog(p) || 0))) : 0;
    const key = [st.stage, st.step, n, st.hide, autoOn(), NC.Travel && NC.Travel.on, s && s.wait ? s.wait(p) : '', s && s.progText ? s.progText() : '', !s || pinned || openT > 0].join('|');
    if (!force && key === lastKey) return;
    lastKey = key;
    const full = !s || pinned || openT > 0;
    if (lastFull !== full) { lastFull = full; force = true; }
    // (every dot shows its number; the ones done a tick: the names were only on hover, which phones don't have)
    topEl.innerHTML = `<div class="jn-bar"><span class="jn-stg"><i>${st.stage + 1}</i>${esc(S.name)}<small>${S.lv}</small></span><div class="jn-dots">` +
      S.steps.map((x, i) => `<i class="${i < st.step ? 'done' : i === st.step ? 'cur' : ''}" title="${i + 1}. ${esc(x.title)}">${i < st.step ? '✓' : i + 1}</i>`).join('') +
      `</div><div class="jn-chest${stageDone() ? ' ready' : ''}" data-jchest="1" title="รางวัลจบช่วง: ${fmt(S.chest.coins)} เหรียญ + ยา" style="background-image:url(${IMG(stageDone() ? 'chest_open.png' : 'chest.png')})"></div></div>`;
    sayEl.classList.toggle('mini', !full);
    const moving = NC.Travel && NC.Travel.on, farming = autoOn(), busy = moving || farming;
    if (!s) { // the stage is done: open its chest
      sayEl.innerHTML = `<span class="jn-step">จบช่วง ${st.stage + 1} แล้ว!</span><h3>เปิดหีบรางวัลเลย</h3>` +
        `<div class="jn-rew"><img src="${COIN()}" alt="">${fmt(S.chest.coins)} เหรียญ · ยาแดง ${S.chest.red} · ยาฟ้า ${S.chest.blue}</div>` +
        '<div class="jn-act"><button class="jn-auto" data-jchest="1"><img src="' + IMG('chest.png') + '" alt="">เปิดหีบ</button></div>';
    } else if (!full) { // small: one line, AUTO at its side (the spirit or the line opens it all)
      sayEl.innerHTML = `<button class="jn-mauto${busy ? ' on' : ''}" data-jauto="1" title="${moving ? 'กำลังไป...' : farming ? 'บอทกำลังทำ' : 'AUTO: พาไปทำให้'}"><img src="${IMG('sp_point.png')}" alt=""></button>` +
        `<div class="jn-mtxt" data-jopen="1"><b><em>${st.step + 1}/${S.steps.length}</em>${esc(s.title)}</b><small>${moving ? 'กำลังไป · ' : farming ? 'บอทกำลังทำ · ' : ''}${s.progText ? esc(s.progText()) : `${n} / ${need}`}</small>` +
        `<span class="jn-mbar"><i style="width:${((100 * n) / need).toFixed(1)}%"></i></span></div><button class="jn-x" data-jhide="1" title="ซ่อน (กดที่ประกายเพื่อเปิด)">×</button>`;
    } else {
      const wait = s.wait ? s.wait(p) : '';
      sayEl.innerHTML = '<button class="jn-hide" data-jmin="1" title="ย่อ">–</button>' +
        `<span class="jn-step">ขั้น ${st.step + 1} <em>/ ${S.steps.length}</em></span>` +
        `<h3>${esc(s.title)}</h3><div class="jn-where">${esc(s.where)}</div>` +
        `<div class="jn-prog"><i style="width:${((100 * n) / need).toFixed(1)}%"></i><span>${s.progText ? esc(s.progText()) : `${n} / ${need}`}</span></div>` +
        `<div class="jn-hint">${wait ? esc(wait) : s.hint || ''}</div>` +
        `<div class="jn-act"><button class="jn-auto${busy ? ' on' : ''}" data-jauto="1"><img src="${IMG('sp_point.png')}" alt="">${moving ? 'กำลังไป...' : farming ? 'บอทกำลังทำ' : 'AUTO'}</button>` +
        (s.coins ? `<span class="jn-rew"><img src="${COIN()}" alt="">${fmt(s.coins)}</span>` : '') + '<button class="jn-skip" data-jskip="1">ข้าม</button></div>';
    }
  }

  // ---------------- every frame: check the step, place the spirit, the bubble and the ring ----------------
  const toScreen = (game, x, y) => [((x - game.cam.x) * game.scale) / game.dpr, ((y - game.cam.y) * game.scale) / game.dpr];
  const u = () => parseFloat(getComputedStyle(root).getPropertyValue('--u')) || 1; // (#journey has its own unit on phones)
  let checkT = 0, uv = 1, uT = 0;

  // ---------------- where the bubble and the spirit go ----------------
  // The UI audit (2026-10-17): above the hero's head the bubble covered the campfire and the NPCs' words, and the spirit
  // parked on Talumen's face, the very NPC step 1 sends you to. Now the spirit stays by the hero's head and the bubble
  // takes the side (left / right, raised / level, above / under) that covers the least: the step's target, the NPCs,
  // the campfire, the hero, the HUD. It only moves to another side when that one is clearly better.
  const HUD_AVOID = '.cframe, #hud .tr, .qt-box, #zone.show, #chatwin, #hud .hotbar, #hud .hud-br, #bossbar, #mb-chatline, #mb-chat, ' +
    '#mb-menu, #mb-items, #mb-stick, #mb-attack, #mb-skills .hslot, #mb-exp';
  let hudRects = [], hudT = 0, placeK = '', placeHold = 0;
  const inter = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const area = (a) => (a[2] - a[0]) * (a[3] - a[1]);
  function readHud() {
    hudRects = [];
    for (const e of document.querySelectorAll(HUD_AVOID)) {
      if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') continue;
      const r = e.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) hudRects.push([r.left, r.top, r.right, r.bottom, 3]);
    }
  }
  function worldRects(game) {
    const out = [];
    const box = (x0, y0, x1, y1, w) => { const [a, b] = toScreen(game, x0, y0), [c, d] = toScreen(game, x1, y1); out.push([a, b, c, d, w]); };
    const SN = NC.StoryNPC;
    if (SN && SN.list) for (const n of SN.list) if (n.map === game.mapId && (!SN.present || SN.present(n))) {
      const wide = n.sayT > 0 ? 80 : 0; // (their words float over them)
      box(n.x - 110 - wide, n.y - 300, n.x + 110 + wide, n.y + 70, 2);
    }
    const shop = NC.Shop && game.world && game.world.shop ? NC.Shop.npc : null, smith = NC.Forge && game.mapId === 'camp' ? NC.Forge.npc : null;
    for (const n of [shop, smith]) if (n) box(n.x - 120, n.y - 280, n.x + 120, n.y + 70, 2);
    if (NC.Life && NC.Life.mentors) for (const m of NC.Life.mentors) if (m.here && m.here(game)) box(m.x - 120, m.y - 280, m.x + 120, m.y + 70, 2);
    if (game.mapId === 'camp' && NC.CAMP_SPOT && NC.CAMP_SPOT.fire) { const f = NC.CAMP_SPOT.fire; box(f.x - 150, f.y - 240, f.x + 150, f.y + 70, 2); }
    const s = cur(), t = s && s.target && s.target();
    if (t && t.map === game.mapId && t.x != null && t.r < 1e8) box(t.x - 130, t.y - 270, t.x + 130, t.y + 60, 4);
    return out;
  }
  function placeAll(game, p, mini) {
    const W = innerWidth, H = innerHeight;
    const [hx, headY] = toScreen(game, p.x, p.y - 150), [, footY] = toScreen(game, p.x, p.y + 12), [, bodyTop] = toScreen(game, p.x, p.y - 175);
    const hero = [hx - 60 * uv, bodyTop, hx + 60 * uv, footY + 66 * uv, 3]; // (with the name under the feet)
    const bw = sayEl.offsetWidth || 360 * uv, bh = sayEl.offsetHeight || 70 * uv, sw = 84 * uv, sh = 84 * uv, gap = 6 * uv;
    const obst = worldRects(game).concat(hudRects);
    const view = [0, 0, W, H];
    const cands = [];
    for (const side of [-1, 1]) {
      const scx = hx + side * 70 * uv, scy = headY + 4 * uv;
      const sp = [scx - sw / 2, scy - sh / 2, scx + sw / 2, scy + sh / 2];
      const bx = side < 0 ? sp[0] - gap - bw : sp[2] + gap, cx = hx - bw / 2;
      const S = side < 0 ? 'L' : 'R', tail = side < 0 ? 'tr' : 'tl';
      cands.push({ k: S + 'up', side, sp, b: [bx, scy + 30 * uv - bh, bx + bw, scy + 30 * uv], tail: tail + ' low', pref: side < 0 ? 0 : 0.03 });
      cands.push({ k: S + 'mid', side, sp, b: [bx, scy - bh / 2, bx + bw, scy + bh / 2], tail, pref: side < 0 ? 0.05 : 0.07 });
      cands.push({ k: S + 'top', side, sp, b: [cx, sp[1] - gap - bh, cx + bw, sp[1] - gap], tail: 'tb', pref: 0.1 });
      // (under the feet: the spirit comes down beside the legs, by the bubble's top corner)
      const lowY = footY + 34 * uv, lx = hx + side * 98 * uv, spLow = [lx - sw / 2, lowY - sh / 2, lx + sw / 2, lowY + sh / 2];
      cands.push({ k: S + 'bot', side, sp: spLow, b: [cx + side * bw * 0.22, footY + 72 * uv, cx + side * bw * 0.22 + bw, footY + 72 * uv + bh], tail: 'tt', pref: 0.16 });
    }
    for (const c of cands) {
      let s = 0;
      for (const o of obst) s += inter(c.b, o) * o[4] + inter(c.sp, o) * o[4] * 0.8;
      s += inter(c.b, hero) * 3;
      s += (area(c.b) - inter(c.b, view)) * 6 + (area(c.sp) - inter(c.sp, view)) * 6;
      c.score = s + c.pref * area(c.b);
    }
    cands.sort((a, b) => a.score - b.score);
    let pick = cands[0];
    const was = cands.find((c) => c.k === placeK);
    if (was && (placeHold > 0 || was.score <= pick.score + 0.12 * area(pick.b))) pick = was; // (no hopping side to side)
    else if (pick.k !== placeK) { placeK = pick.k; placeHold = 0.6; }
    // keep it on the screen (under the stage bar)
    const topMin = topEl && topEl.offsetHeight ? topEl.getBoundingClientRect().bottom + 6 : 8;
    let [x0, y0] = pick.b;
    x0 = Math.max(8, Math.min(W - 8 - bw, x0)); y0 = Math.max(topMin, Math.min(H - 8 - bh, y0));
    // a tail under / over the bubble points at the spirit (--tx: where along the bubble's width)
    const tx = Math.max(0.14, Math.min(0.86, ((pick.sp[0] + pick.sp[2]) / 2 - x0) / bw));
    return { x: x0, y: y0, sp: pick.sp, side: pick.side, tx, tail: mini ? pick.tail.replace(' low', '') : pick.tail };
  }
  // the stage bar: top centre, or under the hero's frame / the minimap when it would sit on them (phones)
  function placeBar() {
    topEl.style.top = '';
    const r = topEl.getBoundingClientRect();
    let y = r.top;
    for (const sel of ['.cframe', '#hud .tr', '#bossbar', '#mb-chat', '#mb-menu']) {
      const e = document.querySelector(sel);
      if (!e || !e.getClientRects().length) continue;
      const q = e.getBoundingClientRect();
      if (q.right > r.left && q.left < r.right && q.bottom > y && q.top < y + r.height) y = Math.max(y, q.bottom + 6);
    }
    if (y !== r.top) topEl.style.top = y + 'px';
  }
  // which story NPC's talk is open (T and a click open it without NC.StoryNPC.open: counted here)
  let talkWho = '';
  function talkOpen() {
    const w = $('snpc'), nm = $('sn-name');
    if (!w || w.hidden || !nm) { talkWho = ''; return null; }
    const SN = NC.StoryNPC, name = nm.textContent.split(' · ')[0];
    const n = SN && SN.list.find((k) => k.name === name);
    if (n && talkWho !== n.id) { talkWho = n.id; bump('talk_' + n.id); } // (a second count from NC.StoryNPC.open is harmless)
    return w;
  }
  // a ring on the window's button the step wants (the talk's "รับเควส" / "ส่งเควส")
  function dlgHint(game) {
    const s = cur(), w = talkOpen();
    const want = s && s.auto && w && !st.hide ? w.querySelector('[data-sn="take"]:not([disabled]), [data-sn="in"]:not([disabled])') : null;
    if (!want) { dlgEl.hidden = true; return; }
    const r = want.getBoundingClientRect();
    dlgEl.hidden = false;
    dlgEl.style.left = r.left - 4 + 'px'; dlgEl.style.top = r.top - 4 + 'px'; dlgEl.style.width = r.width + 8 + 'px'; dlgEl.style.height = r.height + 8 + 'px';
    const say = want.dataset.sn === 'take' ? 'กดรับเควสเลย!' : 'ส่งเควสได้แล้ว!';
    const b = dlgEl.querySelector('b'); if (b.textContent !== say) b.textContent = say;
  }

  function tick(game) {
    if (!root || !game.player) return;
    const p = game.player, dt = game.dtLast || 1 / 60;
    if (st.done || (NC.Lessons && NC.Lessons.active && NC.Lessons.active())) { if (!rewEl) root.hidden = true; if (dlgEl) dlgEl.hidden = true; document.documentElement.classList.remove('jn-on'); return; }
    // one guide at a time: the story quest's box at the right waits while the journey shows (it's back once hidden: ×)
    document.documentElement.classList.toggle('jn-on', !st.hide);
    dlgHint(game);
    // the step
    checkT -= dt;
    if (checkT <= 0) {
      checkT = 0.25;
      const s = cur();
      if (s && (s.prog(p) || 0) >= s.need) complete(game);
      const d = dirty; dirty = false;
      render(d); if (d) save();
    }
    flash = Math.max(0, flash - dt); talkT = Math.max(0, talkT - dt); openT = Math.max(0, openT - dt);
    // hidden while a window is up (the game pauses for them)
    const show = !game.paused;
    sayEl.style.display = show && !st.hide ? '' : 'none';
    spEl.style.display = show ? '' : 'none';
    topEl.style.display = show ? '' : 'none';
    if (!show) { spotEl.hidden = true; return; }
    if ((uT -= dt) <= 0) { uv = u(); uT = 1; }
    if ((hudT -= dt) <= 0) { hudT = 0.5; readHud(); placeBar(); }
    placeHold = Math.max(0, placeHold - dt);
    const at = placeAll(game, p, sayEl.classList.contains('mini'));
    sayEl.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`;
    sayEl.style.setProperty('--tx', (at.tx * 100).toFixed(1) + '%');
    if (sayEl.dataset.tail !== at.tail) { sayEl.classList.remove('tl', 'tr', 'tb', 'tt', 'low', 'flip'); sayEl.classList.add(...at.tail.split(' ')); sayEl.dataset.tail = at.tail; }
    const bob = Math.sin(performance.now() / 380) * 4 * uv;
    const moving = NC.Travel && NC.Travel.on;
    const pose = flash > 0 ? 'sp_cheer' : moving ? 'sp_point' : talkT > 0 ? 'sp_talk' : 'sp_idle';
    const want = IMG(pose + '.png');
    if (!spEl.src.endsWith(want)) spEl.src = want;
    // (it looks at the hero, or the way when walking)
    const look = moving && NC.Travel.path && NC.Travel.path[0] ? (NC.Travel.path[0][0] < p.x ? -1 : 1) : at.side < 0 ? 1 : -1;
    spEl.style.transform = `translate(${at.sp[0].toFixed(1)}px, ${(at.sp[1] + bob).toFixed(1)}px) scaleX(${look})`;
    // the ring on a HUD button
    const s = cur();
    const btn = s && s.spot && !(s.prog(p) >= s.need) && document.querySelector(BTN[s.spot]);
    const r = btn && btn.offsetParent !== null ? btn.getBoundingClientRect() : null;
    if (r && r.width > 0) {
      spotEl.hidden = false;
      spotEl.style.left = r.left - 4 + 'px'; spotEl.style.top = r.top - 4 + 'px'; spotEl.style.width = r.width + 8 + 'px'; spotEl.style.height = r.height + 8 + 'px';
      const html = `<img src="${IMG('arrow.png')}" alt="">`; // (the words are in the bubble already)
      if (spotEl.dataset.k !== s.id) { spotEl.innerHTML = html; spotEl.dataset.k = s.id; }
    } else spotEl.hidden = true;
  }

  // ---------------- the firefly trail and the arrow (in the world, after the lighting) ----------------
  const pic = (f) => { const i = new Image(); i.src = IMG(f); return i; };
  const FLY = pic('fly.jpg'), FLY2 = pic('fly2.jpg'), ARROW = pic('arrow.png');
  const ok = (i) => i.complete && i.naturalWidth > 0;
  // where the trail leads on this map: the travel's own path, else the step's place (or the warp towards it)
  function trailTo(game) {
    const T = NC.Travel, p = game.player;
    if (T && T.on && T.path && T.path.length) return { pts: T.path, end: T.next || T.target };
    const s = cur();
    const t = s && s.target && s.target();
    if (!t || (t.map === game.mapId && (t.x == null || t.r >= 1e8))) return null;
    let end = t;
    if (t.map !== game.mapId) {
      const route = NC.MapRoute && NC.MapRoute.pathTo(game.mapId, t.map);
      end = route && route.length > 1 && game.portals.find((w) => w.to === route[1]);
      if (!end) return null;
    }
    if (NC.dist(p.x, p.y, end.x, end.y) < 160) return { pts: [], end };
    return { pts: [[end.x, end.y]], end };
  }
  const baseFx = NC.FX.draw;
  NC.FX.draw = function (ctx, layer) {
    baseFx.apply(this, arguments);
    const game = G();
    if (layer !== 'glow' || !game || !game.player || st.done || game.paused || (NC.Lessons && NC.Lessons.active && NC.Lessons.active())) return; // (js/lessons.js)
    const tr = trailTo(game);
    if (!tr) return;
    const p = game.player, t = game.time;
    ctx.save();
    // fireflies every 75 units along the way (up to ~1100 units ahead), drifting a little, a wave of light running ahead
    if (ok(FLY) && ok(FLY2)) {
      ctx.globalCompositeOperation = 'lighter';
      let ax = p.x, ay = p.y, walked = 60, k = 0;
      const pts = tr.pts.length ? tr.pts : [];
      for (const [bx, by] of pts) {
        const L = NC.dist(ax, ay, bx, by);
        while (walked < L && k < 10) {
          const f = walked / L, x = ax + (bx - ax) * f + Math.sin(t * 1.7 + k) * 6, y = ay + (by - ay) * f + Math.cos(t * 1.3 + k * 1.4) * 5;
          const wave = 0.55 + 0.45 * Math.sin(t * 4 - k * 0.7), S = 52 + 14 * wave, img = k % 3 === 1 ? FLY2 : FLY;
          ctx.globalAlpha = Math.min(1, 0.6 + 0.4 * wave) * (k < 2 ? 0.65 : 1);
          ctx.drawImage(img, x - S / 2, y - S / 2 - 6, S, S);
          ctx.drawImage(img, x - S / 4, y - S / 4 - 6, S / 2, S / 2); // (twice over: a bright core, the glow round it)
          walked += 85; k++;
        }
        if (k >= 10) break;
        walked -= L; ax = bx; ay = by;
      }
    }
    // the arrow over the place (or the warp)
    const e = tr.end;
    if (e && ok(ARROW) && NC.dist(p.x, p.y, e.x, e.y) < 2400) {
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      const h = 54, w = (ARROW.naturalWidth / ARROW.naturalHeight) * h, y = e.y - (e.npc ? 210 : 120) - Math.abs(Math.sin(t * 3.4)) * 16;
      ctx.drawImage(ARROW, e.x - w / 2, y - h, w, h);
    }
    ctx.restore();
  };

  // ---------------- hooks ----------------
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    const on = basePanel(id, show);
    if (on && id) bump('p_' + id);
    return on;
  };
  if (NC.StoryNPC && NC.StoryNPC.open) { const baseOpen = NC.StoryNPC.open; NC.StoryNPC.open = function (id) { bump('talk_' + id); return baseOpen.apply(this, arguments); }; }
  if (NC.Travel) NC.Travel.onStop = () => render(true);
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    build();
    const p = game.player;
    // an old save (no journey yet): past it already? (Lv 20+: done; a job already: from stage 2)
    if (!loaded) {
      if (p && p.lv >= 20) st.done = true;
      else if (p && tier(p) >= 1) { st.stage = 1; st.step = 0; }
    }
    if (!loaded) startStep(game); else render(true);
  };
  const baseUpdate = NC.HUD.update.bind(NC.HUD);
  let lastT = performance.now();
  NC.HUD.update = function (game) {
    baseUpdate(game);
    const now = performance.now(); game.dtLast = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    try { tick(game); } catch (e) { console.error(e); }
  };

  NC.Journey = { STAGES, state: st, cur, complete, skip, openChest, render, farm, travel, storyAuto };
  // ?online (online/extras.js, once the server names the hero): the page never saves online, so the journey started over
  // on every visit; this hero's own is kept on this device now (a hero new here: done when past Lv 20 or the lessons)
  NC.Journey.useSave = (key, game) => {
    if (!key || (keyed && saveKey === key)) return;
    saveKey = key; keyed = true;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { /* blocked */ }
    const keep = ev; // (the counters' object stays the same one: the hooks above hold it)
    for (const k of Object.keys(keep)) delete keep[k];
    Object.assign(keep, (s && s.ev) || {});
    Object.assign(st, { stage: 0, step: 0, base: {}, chest: {}, done: false, hide: false }, s || {}, { ev: keep });
    game = game || G();
    const p = game && game.player;
    if (!s && p) {
      if (p.lv >= 20 || (NC.Lessons && NC.Lessons.state && NC.Lessons.state.done)) st.done = true;
      else if (tier(p) >= 1) { st.stage = 1; st.step = 0; }
      if (!st.done) startStep(game);
    }
    save();
    render(true);
  };
})();
