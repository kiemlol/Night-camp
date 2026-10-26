/* online/life.js — the life skills online (?online): ตัดไม้, ขุดแร่, ตกปลา, ปลูกผัก (js/life*.js) kept by the Go server
   (backend gathering.go, fishing.go, farming.go, life_actions.go). The server's record self.life has the web's own
   shape (wood / mine / fish / farm / cook { lv, xp }, tools, fishbook, garden { n, scare, plots }), so it is written
   straight into p.life and the H book, the garden and the HUD read it as before. The pouch, the life XP and the levels
   are the server's: the web's own drops (NC.Life.drop), XP (NC.Life.addXp) and saves do nothing online, and its
   monsters out of trees, veins and ponds never spawn here (the server spawns its own).
     trees, veins  a node is named "<map>:<x>,<y>" of its prop (the same on both sides). Working one: start when the
                   hero stands at it, a strike on each of the web's swings (its impact), claim when the server says the
                   node is done; the 'gathered' event plays the web's own fall / rubble with the server's rewards. The
                   ring / the glint show the server's marker, so a strike on the mark is the server's perfect hit.
                   Felled trees and mined veins of everyone come from the snapshot's resources (L.felled, L.mined).
     fishing       the web plays the cast, the bobber, the bite and the reel; the server decides: the bite waits for
                   its 'bite', the tension and the catch progress are its own, a lost fish and the catch are its own
                   (press / release follow the web's hold; claim when it is landed).
     garden        plot interactions send explicit intents; the server's answer changes the plot and pays its harvest.
                   Never infer these from a temporarily edited plot: a snapshot or a bridge timeout could erase an
                   unsent interaction, revive a harvested crop or make the same interaction get sent twice.
   Load after online/world.js. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld, L = NC.Life;
  if (!O || !O.enabled || !W || !L) return;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const FX = NC.FX, MAT = NC.MATERIALS, TAU = Math.PI * 2;
  const now = () => performance.now();
  const snapSelf = () => (W.snap && W.snap.self) || {};
  const act = (o) => O.action(o); // (gather and fish controls go at once: their own bucket on the server)
  let lastLife = '', lifeHold = 0;

  // ---------------- the record (garden plots: the server's at / booleans as the web's t0 / 0-1) ----------------
  function webLife(s) {
    const l = clone(s);
    for (const k of ['wood', 'mine', 'fish', 'farm', 'cook']) if (!l[k]) l[k] = { lv: 1, xp: 0 };
    l.tools = Object.assign({ axe: 1, pick: 1, can: 1, rod: 1, pot: 1 }, l.tools || {});
    const g = l.garden || (l.garden = { n: 6, scare: 0, plots: [] });
    g.plots = (g.plots || []).map((q) => {
      const o = { s: q.s || 'empty' };
      if (q.c) o.c = q.c;
      if (q.at) o.t0 = q.at;
      if (q.w) o.w = q.w.map((x) => (x ? 1 : 0));
      if (q.f) o.f = q.f;
      if (q.crow) o.crow = 1;
      return o;
    });
    return l;
  }
  function applyLife(s, force) {
    const p = W.game && W.game.player;
    if (!p || !s) return;
    const j = JSON.stringify(s);
    if (j === lastLife && !force) return;
    if (!force && now() < lifeHold) return; // (an action just sent: its answer first)
    const was = p.life ? clone(p.life) : null;
    lastLife = j;
    p.life = webLife(s);
    if (was) for (const k in L.SKILLS) {
      const a = was[k], b = p.life[k];
      if (!a || !b) continue;
      const S = L.SKILLS[k];
      if (b.lv > a.lv) {
        if (W.game.toast) W.game.toast(`${S.name} Lv ${b.lv}!`);
        if (NC.HUD) NC.HUD.log(`${S.name} ขึ้นเป็น Lv ${b.lv}`, 'item');
        if (FX) { FX.stars(p.x, p.y - 90, 18, S.rgb, { speed: 260 }); FX.ring(p.x, p.y, 20, 170, S.rgb, 0.6, 8); }
      } else if (b.xp > a.xp && FX) FX.text(p.x + 40, p.y - 150, `+${b.xp - a.xp} ${S.name}`, 'rgb(' + S.rgb + ')', 17);
    }
    if (L.refresh) try { L.refresh(); } catch (e) { /* the book is closed */ }
  }
  W.selfHooks.push((s) => { if (s.life) applyLife(s.life, !!W.resyncing); });

  // the server pays: the web's own drops, XP and saves do nothing online
  const baseDrop = L.drop, baseXp = L.addXp, baseSave = L.save, baseRoll = L.roll;
  L.drop = function () { if (W.ready) return; return baseDrop.apply(this, arguments); };
  L.addXp = function (game, s) { if (W.ready) return baseXp.call(this, game, s, 0); return baseXp.apply(this, arguments); }; // (n = 0: the journey's counters still hear it)
  L.save = function () { if (W.ready) { gardenBridge(); return; } return baseSave.apply(this, arguments); };

  // ---------------- trees and veins ----------------
  const idOf = (game, n) => (n && n.key ? n.key : n && n.prop ? `${game.mapId}:${Math.round(n.prop.x)},${Math.round(n.prop.y)}` : null);
  let work = null; // { node, id, at, claimT, startT }
  function patchNode(n) {
    if (!n || n._ol || (n.skill !== 'wood' && n.skill !== 'mine')) return;
    n._ol = true;
    const bStart = n.start, bHit = n.hit, bDone = n.done, bOk = n.ok;
    n.ok = function () { return (!bOk || bOk.apply(this, arguments)) && !(W.ready && busy.has(n.key) && !(work && work.node === n)); };
    n.start = function (game, p, node) {
      if (!W.ready) { if (bStart) bStart.apply(this, arguments); return; }
      // (no web rock monster out of a vein: life_mine.js's 3% made the vein rubble here for 8-10 minutes and its golem
      // never came online; the server rolls its own, gathering.go spawnGatherMonster)
      L.roll = () => false;
      try { if (bStart) bStart.apply(this, arguments); } finally { L.roll = baseRoll; }
      node.left = node.hp = 1e9; // (the server says when it is done)
      const id = idOf(game, node), g = snapSelf().gathering;
      work = { node, id, at: now(), claimT: 0, started: false };
      // the server still works this node (a start it took while the web had let go): carry on with it, no new start
      // (a second start is refused while one runs: "หยุดเดินหรือต่อสู้ก่อนเก็บวัตถุดิบ", 2026-10-18 the quest AUTO looped on it)
      if (g && g.nodeId === id && g.phase !== 'show') { work.started = true; return; }
      if (g) act({ action: 'gather', kind: 'stop' }); // (another node, or one just done: let it go first)
      O.move(0, 0, p.aim || 0, false); // (standing still first: the server refuses a start on the move)
      // The server takes a start only from its hero standing still at the node, out of a swing (gathering.go: Moving,
      // buildBusy, the reach from ITS spot). Sent 140 ms after the stop, it came while that hero still coasted (~0.4 s
      // after the keys let go) or stood a step short of the reach, and was refused: "ขุดไม่ติด", Discord #123. Its
      // snapshot says when (1.5 s at most; then the server's own answer).
      const t0 = now(), reach = (node.reach || 118) - 4;
      const go = () => {
        if (!work || work.node !== node) return;
        const s = snapSelf(), far = Number.isFinite(s.x) && Number.isFinite(s.y) ? Math.hypot(s.x - node.x, s.y - node.y) : 0;
        if ((s.moving || (s.cd && s.cd.attack > 0) || far > reach) && now() - t0 < 1500) { setTimeout(go, 60); return; }
        act({ action: 'gather', kind: 'start', itemId: id }); work.started = true;
      };
      setTimeout(go, g ? 260 : 100);
    };
    n.hit = function (game, p, node) {
      if (bHit) bHit.apply(this, arguments);
      // (only while the server works it: a strike once it is done is refused, "รอรับวัตถุดิบก่อน", and the claim comes next)
      const g = snapSelf().gathering;
      if (W.ready && work && work.node === node && work.started && !(g && g.nodeId === work.id && g.phase !== 'work')) act({ action: 'gather', kind: 'strike' });
    };
    n.done = function () {
      if (!W.ready) return bDone.apply(this, arguments);
      // (online the server ends it: the 'gathered' event plays this, never the web's own count)
    };
    n._olDone = bDone;
  }
  function patchFinders() {
    if (L._olFinders) return;
    L._olFinders = true;
    L.finders = L.finders.map((f) => function (game) {
      const out = f.apply(this, arguments);
      if (W.ready && out) for (const n of out) { patchNode(n); patchFish(n); patchPlot(n, game); }
      return out;
    });
  }
  // every frame while working: the server's marker on the ring / the glint, the claim
  let staleT = 0;
  function gatherFrame(game, p) {
    const g = snapSelf().gathering, a = p.lifeAct;
    // the server works a node the web has let go of (an answer lost, a refusal): stop it there too, or every next start
    // is refused while it waits
    if (!work && g && g.phase !== 'show' && !a) {
      if (!staleT) staleT = now();
      else if (now() - staleT > 1200) { staleT = 0; act({ action: 'gather', kind: 'stop' }); }
    } else staleT = 0;
    if (!work) return;
    if (!a || a.node !== work.node) { // (the web stopped: walked away, a window)
      if (work.started) act({ action: 'gather', kind: 'stop' });
      work = null; return;
    }
    if (g && g.nodeId === work.id) {
      const m = a.mg;
      if (m && typeof g.marker === 'number') {
        if (m.kind === 'ring') { m.spd = 0; m.notch = Math.PI; m.ang = g.marker * TAU; m.half = Math.max(0.05, ((g.gHi - g.gLo) / 2) * TAU); }
        else { m.per = m.per || 1; m.t = (m.per * Math.acos(NC.clamp(1 - 2 * g.marker, -1, 1))) / TAU; if (typeof g.gLo === 'number') m.thr = g.gLo; }
      }
      if (g.phase === 'claim' && now() - work.claimT > 2000) { work.claimT = now(); act({ action: 'gather', kind: 'claim' }); }
    } else if (work.started && now() - work.at > 1500 && !g) { // (the server let it go: too far, an error)
      if (L.stopWork) L.stopWork(game, p);
      work = null;
    }
  }
  // the server's answer: the fall / the rubble (the web's own looks), the rewards
  W.eventHooks.push((ev) => {
    if (!ev) return;
    const game = W.game, p = game && game.player;
    if (ev.type === 'gathered' && p) {
      const w = work;
      work = null;
      if (L.stopWork) L.stopWork(game, p);
      if (w && w.node && w.node._olDone) {
        L.roll = () => false; // (no web monster out of the tree: the server spawns its own)
        try { w.node._olDone(game, p, w.node, p.lifeAct || {}); } catch (e) { console.warn('online: gather looks', e); } finally { L.roll = baseRoll; }
      }
      const got = Object.entries(ev.rewards || {}).map(([id, n]) => `${(MAT[id] || {}).name || id} ×${n}`).join(' · ');
      if (got && NC.HUD) NC.HUD.log(`ได้ ${got}`, 'item');
      if (got && FX) FX.text(p.x, p.y - 200, got, '#ffe7a6', 22);
    } else if (ev.type === 'gatherAlarm' && ev.message) {
      if (game && game.toast) game.toast(ev.message);
    } else if (ev.type === 'error' && work && ev.message && /เก็บ|วัตถุดิบ|เลเวลอาชีพ|ฟื้นตัว|ผู้เล่นอื่น/.test(ev.message)) {
      // (a strike that came as the node finished, a claim a moment early: the work goes on, the claim follows)
      if (/รอรับวัตถุดิบก่อน|ยังเก็บวัตถุดิบไม่เสร็จ/.test(ev.message)) return;
      if (/ยังไม่ได้เริ่มเก็บวัตถุดิบ/.test(ev.message) && now() - work.at < 1500) return; // (a strike before the start reached it)
      if (game && game.toast) game.toast(ev.message);
      if (p && L.stopWork) L.stopWork(game, p);
      if (snapSelf().gathering) act({ action: 'gather', kind: 'stop' }); // (the server's own work stops with the web's)
      work = null;
    }
  });
  // everyone's felled trees and mined veins: the snapshot's resources (missing = fresh)
  const fromServer = { felled: new Set(), mined: new Set() };
  // a tree or a vein another hero works now (the snapshot's owner): not free to take ("มีผู้เล่นอื่นกำลังเก็บอยู่"), so no
  // prompt on it and the quest's AUTO picks another (it went back to the same vein again and again, Discord #123 / #24)
  const busy = new Set();
  O.on('snapshot', (st) => {
    if (!W.ready || !st || !st.resources) return;
    const mine = snapSelf().id;
    busy.clear();
    for (const id in st.resources) { const r = st.resources[id]; if (r && r.owner && r.owner !== mine && !(r.respawnAt > 0)) busy.add(id); }
    const game = W.game, srvNow = st.serverTime || Date.now();
    for (const kind of ['felled', 'mined']) {
      const map = L[kind];
      if (!map) continue;
      const seen = new Set();
      for (const id in st.resources) {
        const r = st.resources[id];
        if (!r || !(r.respawnAt > 0) || id.split(':')[0] !== st.mapId) continue;
        // (a tree id or a vein id: the same key space; each map only holds its own)
        seen.add(id);
        map[id] = game.time + Math.max(0.5, (r.respawnAt - srvNow) / 1000);
        fromServer[kind].add(id);
      }
      for (const id of fromServer[kind]) if (!seen.has(id)) { delete map[id]; fromServer[kind].delete(id); }
    }
  });

  // ---------------- fishing: the web's looks, the server's catch ----------------
  let fish = null; // { pond index, hold, claimT, started }
  function patchFish(n) {
    if (!n || n._olFish || !n.use || !n.pond) return;
    n._olFish = true;
    const bUse = n.use;
    n.use = function (game, p) {
      const r = bUse.apply(this, arguments);
      if (W.ready && p.fishAct) {
        const i = game.world.ponds.indexOf(p.fishAct.pond);
        fish = { pond: i, hold: false, claimT: 0, started: false, at: now() };
        O.move(0, 0, p.aim || 0, false);
        setTimeout(() => { if (fish && p.fishAct) { act({ action: 'fish', kind: 'start', count: Math.max(0, i) }); fish.started = true; } }, 140);
      }
      return r;
    };
  }
  function fishFrame(game, p) {
    const a = p.fishAct, f = snapSelf().fishing;
    if (!fish) return;
    if (!a) { if (fish.started) act({ action: 'fish', kind: 'stop' }); fish = null; return; }
    if (!fish.started) return;
    // the web's hold (its own keys) -> press / release
    if (!!a.hold !== fish.hold) { fish.hold = !!a.hold; act({ action: 'fish', kind: fish.hold ? 'press' : 'release' }); }
    if (!f) return;
    const sp = f.phase;
    if (a.phase === 'wait' || a.phase === 'nibble') {
      if (sp === 'bite' || sp === 'reel') a.wait = 0; // (the server's bite: the web bites now)
      else a.wait = sp === 'nibble' ? Math.min(a.wait, 1.5) : Math.max(a.wait, 1.7);
    }
    if (a.phase === 'reel') {
      a.slackMax = a.snapMax = Infinity; // (the server says when it got away)
      if (typeof f.T === 'number') a.T = f.T;
      if (typeof f.C === 'number') a.C = sp === 'lift' || sp === 'claim' || sp === 'show' ? 1 : Math.min(0.99, f.C);
      if (typeof f.gLo === 'number') { a.gLo = f.gLo; a.gHi = f.gHi; }
    }
    if (sp === 'lost' && a.phase !== 'lost' && a.phase !== 'ready' && a.phase !== 'show') {
      a.phase = 'lost'; a.t = 0; a.why = f.message || 'ปลาหลุด!';
      FX.text(p.x, p.y - 190, a.why, '#ffb0a0', 24);
    }
    if (sp === 'claim' && now() - fish.claimT > 2000) { fish.claimT = now(); act({ action: 'fish', kind: 'claim' }); }
    // (the web's own catch wrote its fish book and pouch: the server's record goes back on once it is shown)
    if (a.phase === 'show' && fish.lastPhase !== 'show') setTimeout(() => { const ss = snapSelf(); if (ss.life) applyLife(ss.life, true); }, 500);
    fish.lastPhase = a.phase;
    if (sp === 'show' && f.catch && a.show && a.show.id !== f.catch) {
      a.show = Object.assign({}, a.show, { id: f.catch, size: f.size || a.show.size, first: false, record: false,
        grade: MAT[f.catch] && MAT[f.catch].rare ? 1 : 0 });
    }
  }
  W.eventHooks.push((ev) => {
    if (!ev || ev.type !== 'fishCaught') return;
    const name = (MAT[ev.itemId] || {}).name || ev.itemId;
    if (NC.HUD) NC.HUD.log(`ตกได้ ${name}${ev.size ? ` ${ev.size} ซม.` : ''}`, 'item');
  });

  // ---------------- the garden ----------------
  const pendingPlots = new Map();
  const plotBefore = new WeakMap();
  let plotScope = null, plotSocket = null;
  function cancelPlotQueue() {
    for (const a of pendingPlots.values()) W.cancelQueued(a);
    pendingPlots.clear();
  }
  function clearFinishedPlots() {
    const scope = `${O.matchId || ''}:${W.me || ''}`;
    if (scope !== plotScope || O.socket !== plotSocket) { cancelPlotQueue(); plotScope = scope; plotSocket = O.socket; }
    for (const [i, a] of pendingPlots) if (W.answered(a, true)) {
      pendingPlots.delete(i);
      const before = plotBefore.get(a), after = snapSelf().life && webLife(snapSelf().life).garden.plots;
      if (!before || !after) continue;
      const b = before[i] || {}, n = after[i] || {};
      const accepted = a.kind === 'till' ? b.s === 'empty' && n.s === 'tilled'
        : a.kind === 'plant' ? b.s === 'tilled' && n.s === 'crop' && n.c === a.itemId
        : a.kind === 'harvest' ? b.s === 'crop' && n.s === 'tilled'
        : a.kind === 'water' && after.some((pl, j) => (pl.w || []).some((wet, k) => wet && !(before[j] && before[j].w && before[j].w[k])));
      // Keep tutorial/journey callbacks, but only after the server's plot confirms this interaction.
      if (accepted) L.addXp(W.game, 'farm', 0);
    }
  }
  O.on('status', (s) => { if (s !== 'online') cancelPlotQueue(); });
  // A second click waits for the same plot's acknowledged action, not a fixed delay. Other plots remain usable.
  L.farmAction = function (game, kind, i, itemId) {
    if (game !== W.game) return false;
    if (!W.ready || O.status !== 'online') return 'pending'; // A reconnect must never fall through to offline rewards.
    clearFinishedPlots();
    if (pendingPlots.has(i)) return 'pending';
    const a = { action: 'life', kind, count: i };
    if (itemId) a.itemId = itemId;
    plotBefore.set(a, clone((game.player.life.garden || {}).plots || []));
    pendingPlots.set(i, a);
    W.send(a);
    return 'sent';
  };
  W.selfHooks.push(clearFinishedPlots);
  function patchPlot() { /* life_farm.js calls L.farmAction before touching a plot. */ }
  function gardenActs(p, s) {
    const out = [], sl = s.life, pl = p.life;
    if (!sl || !pl) return out;
    // the teachers
    const sg = sl.garden || {}, lg = pl.garden || {};
    if ((lg.n || 6) > (sg.n || 6)) out.push({ action: 'life', kind: 'expand' });
    if ((lg.scare || 0) > (sg.scare || 0)) out.push({ action: 'life', kind: 'scare' });
    const st = sl.tools || {}, lt = pl.tools || {};
    for (const t in lt) if ((lt[t] || 1) > (st[t] || 1)) out.push({ action: 'life', kind: 'upgrade', itemId: t });
    return out;
  }
  // the teachers' trades (ยายกระต่าย's seeds and crops, ตานาก's fish): their change of the coins and the pouch, measured
  // around the teacher's own act, goes as one life action through W.trade (kept on the hero until the bridge sends it;
  // the server sells every crop / fish at once). (Before: the bridge guessed them from the coins against the server's,
  // and a snapshot coming first gave the coins and the pouch back: the purchase or the sale was lost, 2026-10-18.)
  const TEACH = {
    seed: (d) => { const k = Object.keys(d).find((x) => /^m:sd_/.test(x) && d[x] > 0); return k ? { action: 'life', kind: 'seeds', itemId: k.slice(5), count: Math.min(100, d[k]) } : null; },
    sellcrops: () => ({ action: 'life', kind: 'sellcrops' }),
    sellfish: () => ({ action: 'life', kind: 'sellfish' }),
  };
  let teacher = 0; // in a teacher's act: its NC.Econ.sell is not Uncle Coco's sale (online/world.js)
  W.sellSkip = () => teacher > 0;
  function teach(m) {
    if (!m || typeof m.act !== 'function' || m._olTrade) return;
    m._olTrade = true;
    const base = m.act;
    m.act = function (game, p, what) {
      const make = TEACH[what];
      if (!W.ready || game !== W.game || !make || !p) return base.apply(this, arguments);
      const was = W.counts(p);
      teacher++; W.hold++; // (the bridge waits: the change is the teacher's, not a merchant trade)
      let r;
      try { r = base.apply(this, arguments); } finally { teacher--; W.hold--; }
      const now = W.counts(p), d = {};
      for (const k of new Set([...Object.keys(was), ...Object.keys(now)])) if ((now[k] | 0) !== (was[k] | 0)) d[k] = (now[k] | 0) - (was[k] | 0);
      const a = Object.keys(d).length ? make(d) : null;
      if (a) W.trade(d, a);
      return r;
    };
  }
  for (const m of L.mentors || []) teach(m);
  if (L.addMentor) { const baseAdd = L.addMentor; L.addMentor = function (m) { const r = baseAdd.apply(this, arguments); teach(m); return r; }; }
  let gardenAt = 0;
  function gardenBridge() {
    const p = W.game && W.game.player, s = snapSelf();
    if (!p || !W.ready || now() < gardenAt) return;
    const acts = gardenActs(p, s);
    if (!acts.length) return;
    gardenAt = now() + 1200 + acts.length * 260;
    lifeHold = gardenAt;
    for (const a of acts) W.send(a);
    setTimeout(() => { const ss = snapSelf(); if (ss.life) applyLife(ss.life, true); }, 1400 + acts.length * 260);
  }
  W.bridgeHooks.push(() => { gardenBridge(); return []; });
  W.eventHooks.push((ev) => {
    if (ev && ev.type === 'farmCrow' && W.game && W.game.toast) W.game.toast(ev.kind === 'shooed' ? 'ไล่อีกาไปแล้ว!' : 'อีกาจิกผักไปแล้ว!');
    if (ev && ev.type === 'error' && ev.message && /plot|seed|crop|garden|teacher|tool|harvest|water|fertil/i.test(ev.message)) {
      const g = W.game; if (g && g.toast) g.toast(ev.message);
      lifeHold = 0; const ss = snapSelf(); if (ss.life) applyLife(ss.life, true);
    }
  });

  // ---------------- every frame ----------------
  const baseUpd = NC.updatePlayer;
  NC.updatePlayer = function (game) {
    const r = baseUpd.apply(this, arguments);
    if (W.ready && game === W.game) {
      patchFinders();
      try { gatherFrame(game, game.player); fishFrame(game, game.player); } catch (e) { console.warn('online: life frame', e); }
    }
    return r;
  };
  NC.OnlineLife = { idOf, get work() { return work; }, get fish() { return fish; } };
})();
