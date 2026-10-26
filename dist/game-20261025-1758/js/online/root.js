/* online/root.js — รากต้นไม้มืด online (?online): the server runs the run and its floors (backend darkroot*.go), the web's
   own darkroot.js / darkroot_ui.js / rootloot.js draw it.
     the lobby  เข้า / เริ่มที่กองไฟ = {action:'root', kind:'start', mode, count: floor}; พร้อม (a party member) = {kind:
                'ready'} (the server takes the ready members in with the leader); ตามหัวตี้ = {kind:'resume'}; the seed shop
                = {kind:'buy', count: row}; frames = {kind:'frame', id}; the shade cores = {kind:'exchange', targetId: boss,
                itemId}; the boards = {kind:'board', mode, id: 'w'|'s'|'a'} answered by the event rootBoard
     a floor    the server moves the hero (op 104) to root_<floor>_<run>: made here by darkroot.js's own defineFloor (the
                same seed the server's layout came from), its walls and warps set from self.rootMap.rules; the goal, the
                fires, the waves and the boss are the server's (NC.Root.server: darkroot.js reads its count, its records
                and rewards stay on the server); the stairs open when the server says the floor is done, going down /
                out are the warps 'down' / 'out' (world.js's Maps.go)
     records    self.rootState (cp, s / w / a, frames, frame, bless) into NC.Root.state, in place
   Load after online/world.js. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld, R = NC.Root;
  if (!O || !O.enabled || !W || !R || !R.defineFloor) return;
  const self = () => (W.snap && W.snap.self) || null;
  const SV = (R.server = { run: null, stairs: false, elapsed: 0, revives: 0, week: R.weekNo() });
  const send = (o) => W.send(Object.assign({ action: 'root' }, o));

  // ---------------- the floor maps ----------------
  W.enterHooks.push((mapId) => {
    const q = R.parseFloor(mapId);
    if (q && !NC.MAPS[mapId]) R.defineFloor(q.f, q.rid);
  });
  // the server's walls, warps and way in over the web's own build of the same floor
  const baseBuild = NC.buildField;
  NC.buildField = function (def) {
    const w = baseBuild.apply(this, arguments);
    const rm = self() && self().rootMap, r = rm && rm.rules;
    if (!def || !def.root || !r || !w) return w;
    if (rm.id && rm.id !== `root_${def.root.f}_${def.root.rid}`) return w;
    try {
      if (typeof r.solid === 'string' && r.GW === w.GW && r.GH === w.GH) {
        const bin = atob(r.solid);
        if (bin.length === w.solid.length) for (let i = 0; i < bin.length; i++) w.solid[i] = bin.charCodeAt(i) ? 1 : 0;
      } else if (r.solid) console.warn('online root: the floor grid differs', r.GW, r.GH, w.GW, w.GH);
      if (typeof r.terrainSolid === 'string' && r.GW === w.GW && r.GH === w.GH) {
        const bits = atob(r.terrainSolid), n = w.GW * w.GH;
        if (bits.length === Math.ceil(n / 8)) {
          w.terrainSolid = new Uint8Array(n);
          for (let i = 0; i < n; i++) w.terrainSolid[i] = (bits.charCodeAt(i >> 3) >> (i & 7)) & 1;
        }
      }
      for (const sw of r.warps || []) { const lw = (w.warps || []).find((x) => x.id === sw.id); if (lw) { lw.x = sw.x; lw.y = sw.y; } }
      if (r.spawn && w.spawn) { w.spawn.x = r.spawn.x; w.spawn.y = r.spawn.y; }
    } catch (e) { console.warn('online root: rules', e); }
    return w;
  };

  // ---------------- the server's record ----------------
  let seenState = null, seenRoot = null;
  const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  W.selfHooks.push((s) => {
    const rs = s.rootState;
    if (rs && rs !== seenState) {
      seenState = rs;
      const st = R.state;
      if (rs.cp) st.cp = rs.cp;
      for (const k of ['s', 'w', 'a']) if (rs[k]) st[k] = { best: rs[k].best | 0, t: Object.assign({}, rs[k].t || {}) };
      st.frames = Array.isArray(rs.frames) ? rs.frames.slice() : st.frames;
      st.frame = rs.frame || null;
      if (rs.bless != null) st.bless = { n: rs.bless | 0, day: Math.floor(Date.now() / 86400000) };
      if (rs.week) { st.week = rs.week; SV.week = rs.week; }
      if (rs.season) st.season = rs.season;
    }
    const r = s.root || null;
    if (r !== seenRoot) {
      seenRoot = r;
      SV.run = (r && r.run) || null; SV.stairs = !!(r && r.stairs); SV.revives = r ? r.revives | 0 : 0; SV.elapsed = r ? +r.elapsed || 0 : 0;
    }
    const fl = R.floor(), run = SV.run;
    if (fl && run && run.floor === fl.f) { fl.t = SV.elapsed; fl.stage = run.stage | 0; fl.mine = run.have | 0; fl.fires = run.fireMask | 0; }
  });
  // the specials: the server tags them (rings, the bigger elites, their names)
  W.monsterHooks.push((e, m) => {
    if (m.rootTag && e.rootTag !== m.rootTag) {
      e.rootTag = m.rootTag;
      if (m.rootTag === 'elite' && !/^หัวหน้า/.test(e.name || '')) e.name = 'หัวหน้า' + e.name;
      else if (m.rootTag === 'key' && !/กลืนแก่นราก/.test(e.name || '')) e.name += ' (กลืนแก่นราก)';
      else if (m.rootTag === 'boss' && !/^เงาราก/.test(e.name || '')) e.name = 'เงาราก ' + e.name;
    }
    if (m.rootScale) e.rootScale = m.rootScale;
    if (m.boss && m.boss.awake) e.awake = true;
  });
  W.eventHooks.push((ev) => {
    if (!ev) return;
    if (ev.type === 'rootClear') NC.HUD.log(`(เซิร์ฟเวอร์) ผ่านชั้น ${ev.floor} · ${R.clock(ev.seconds || 0)}${ev.checkpoint ? ` · จุดเซฟชั้น ${ev.checkpoint}` : ''}`, 'sys');
    else if (ev.type === 'rootPending' && ev.message) NC.HUD.log(ev.message, 'sys');
  });
  // a chest that paid nothing: in the roots each chest pays a hero once a week and never comes back (server patch 007,
  // darkroot_rewards.go rootChestOnce). Its kill's reward comes with a 'chest' event when it paid; none within a moment =
  // this week's chest was opened already (by the hero, or the party's top damage dealer opened theirs)
  const chestPaid = new Set();
  W.eventHooks.push((ev) => {
    if (!ev) return;
    if (ev.type === 'chest') { chestPaid.add(ev.id); setTimeout(() => chestPaid.delete(ev.id), 5000); return; }
    if (ev.type !== 'reward' || !/^chest_/.test(ev.monsterType || '') || !R.parseFloor(NC.game && NC.game.mapId)) return;
    const id = ev.monsterId;
    setTimeout(() => { if (!chestPaid.has(id)) NC.HUD.log('หีบใบนี้ว่างแล้ว · ในรากต้นไม้มืด หีบแต่ละใบให้ของคนละครั้งต่อสัปดาห์ (ของเป็นของคนที่ตีแรงสุด)', 'warn'); }, 2500);
  });

  // ---------------- the lobby ----------------
  const closeLobby = () => { NC.HUD.panel('rootlobby', false); if (NC.game) NC.game.paused = false; };
  R.startRun = function (game, f, mode) {
    send({ kind: 'start', mode: mode === 'party' ? 'party' : 'solo', count: Math.max(1, f | 0) });
    closeLobby();
    NC.HUD.log(`ขอลงรากต้นไม้มืด ชั้น ${f}…`, 'sys');
    return true;
  };
  R.followLeader = function () { send({ kind: 'resume' }); closeLobby(); return true; }; // (darkroot_ui.js's เข้า / ตามหัวตี้ call these two)
  // ออกจากราก (js/stuckhelp.js: the floor HUD's button, /ออกราก): backend rootExit pays the cleared floors and moves the
  // hero to the camp's root gate, even when down; the map change ends the run here (darkroot.js's tick)
  R.exitRun = function () { if (O.status !== 'online') return false; send({ kind: 'exit' }); return true; };
  const baseAct = R.lobbyAct;
  R.lobbyAct = function (act, el, game) {
    if (act === 'ready') { if (!R.lobby.ready) send({ kind: 'ready' }); R.lobby.ready = true; return true; }
    if (act === 'buy') { send({ kind: 'buy', count: Number(el.dataset.i) | 0 }); return true; }
    if (act === 'frame' || act === 'framex') {
      const fr = el.closest('.rt-si') && el.closest('.rt-si').querySelector('.rt-frame'), m = fr && /\bf-(\w+)/.exec(fr.className);
      const id = act === 'framex' ? el.dataset.f : m ? m[1] : '';
      send({ kind: 'frame', id: R.state.frame === id ? '' : id || '' });
      return true;
    }
    if (act === 'shadebuy') {
      const b = document.querySelector('#rootlobby .rl-boss.on');
      if (b && b.dataset.b) send({ kind: 'exchange', targetId: b.dataset.b, itemId: el.dataset.id });
      return true;
    }
    return baseAct ? baseAct.apply(this, arguments) : false;
  };

  // ---------------- the boards: darkroot_ui.js asks the Store for root / rootp ----------------
  const S = NC.Store, SL = ['hat', 'hair', 'top', 'pants', 'shoes', 'weapon', 'robe', 'cape', 'glasses'];
  const boards = {}, waiting = {};
  W.eventHooks.push((ev) => {
    if (!ev || ev.type !== 'rootBoard') return;
    const k = ev.mode + ':' + ev.period, rows = (ev.rows || []).map((r) => {
      const eq = r.equip || {}, look = r.look || {}, P = ev.period;
      return { id: r.key, data: { name: r.name, job: r.job, line: r.line || 'traveler', guild: r.guild || null, frame: r.frame || null,
        eq: SL.map((s) => look[s] || eq[s] || null), [P + 'F']: (r.record && r.record.best) | 0, [P + 'T']: +r.seconds || 0, [P + 'Score']: r.score || 0,
        mem: (r.members || []).map((m) => ({ name: m.name })), n: (r.members || []).length || 1, season: R.seasonNo(), week: R.weekNo() } };
    });
    boards[k] = { t: Date.now(), rows };
    for (const f of waiting[k] || []) f(rows);
    waiting[k] = [];
  });
  function board(mode, period) {
    const k = mode + ':' + period, b = boards[k];
    if (b && Date.now() - b.t < 15000) return Promise.resolve(b.rows);
    return new Promise((res) => {
      (waiting[k] = waiting[k] || []).push(res);
      send({ kind: 'board', mode, id: period });
      setTimeout(() => res((boards[k] && boards[k].rows) || []), 5000);
    });
  }
  if (S) {
    const baseQ = S.query;
    S.query = async function (c, q) {
      if (c !== 'root' && c !== 'rootp') return baseQ.apply(this, arguments);
      const mode = c === 'rootp' ? 'party' : 'solo';
      if (q && q.order) { const period = String(q.order[0]).charAt(0); return board(mode, 'wsa'.includes(period) ? period : 's'); }
      const w = q && q.where && q.where[0]; // (my place: the rows above my score)
      if (!w) return [];
      const period = String(w[0]).charAt(0), rows = await board(mode, 'wsa'.includes(period) ? period : 's');
      return rows.filter((r) => (r.data[w[0]] || 0) > w[2]);
    };
  }
})();
