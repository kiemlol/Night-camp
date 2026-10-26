/* The web online client's side of the wisp (js/jobs3_skills_c.js ผู้เลี้ยงดวงไฟ, backend/job_wisp.go and
   job_wisp_skills.go). The server runs the wisps and sends:
   - hero meters: on a shepherd wsOrbit (the wisps circling her) and wsBig (drawn big: five with ws_heart Lv5); on any
     hero wsLatched (the wisps latched onto it, every shepherd's) and wsShield (what their shields still soak);
   - a `wisp` event for each look it alone knows: a latch's line to its host, the embrace's rings and words (or "none
     latched"), the bursts where the latched ones sat, the flights of the rush, the bell's call and the swarm (looks
     only: the server strikes), the heart's healing ring, a mark and each of its bursts, a shield's soak (at hostId).
   The local shepherd's orbit, latched wisps and marks are the skill file's own drawer (FX 'j3wisps'), fed the fields it
   reads (p.wsOrbit, which the latch's and the rush's needs read too, p.wsLatch, e.wsMark). The other shepherds' orbits,
   and the latched wisps when the local hero is no shepherd, are drawn with the skill file's looks (NC.WispLooks).
   A presented ws_* cast no longer starts or draws any of this (game.presentationOnly).
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs).
   2026-10-19: js/online.js and its window events are gone; js/online/world.js now calls NC.OnlineWisp.snapshot / .event
   (before that this file was not even loaded, so a shepherd online never had a wisp and every wisp skill said none).
   2026-10-20 (Discord #142): the wisps latched on the local hero are icons with their seconds in the buff row (ws_latch
   from the `latch` events on me and my wsLatched meter; ws_embrace while my wsShield meter is up: WS_LOOK.latchBuffs).
   The shields soak for a latched friend too since server patch 021 (before, only on the shepherd herself), so a friend
   shielded by any shepherd shows ดวงไฟโอบกาย as well, and each soak's number rises over the hero it soaked for. */
(function () {
  const NC = window.NC;
  const EVENT = 'wisp', ORBIT_FX = 'j3wisps', DRAWER = 'wsOnline', LAYER = 'glow';
  const LATCH_PHASE = Math.PI, HOST_PHASE = 1.3; // (the web's phase is each latch's end time: any spread will do)
  const hosts = new Map(); // hero id -> { n, shielded }: the wisps latched onto it
  const orbits = new Map(); // other shepherd id -> { n, big }
  const counts = new Map(); // shepherd id -> its last orbit count (a rise is a regrowth: its sparks)
  let drawer = null, orbitFx = null, mapId = null;
  const LATCH_S = 20; // (backend wsLatchSeconds; a latch this client did not see come: its seconds unknown)
  const onMe = []; // the latches on the local hero: { until } from each `latch` event with me as its host

  const num = (meters, key) => Number(meters?.[key]) || 0;
  const isWS = (p) => !!p && !!NC.isJob && NC.isJob(p, 'wisp');
  const mobOf = (game, id) => (game.enemies || []).find((m) => (m.sid || m.id) === id); // (a mirror's server id is e.sid: by m.id the flights, marks and mark bursts never found their monster)
  const alive = (e) => !!e && !e.dead && e.hp > 0;
  let selfId = null; // (the local hero's server id: js/online/world.js W.me; the web hero has no .id)
  function heroOf(game, id) {
    if (game.player && (game.player.id === id || (selfId && id === selfId))) return game.player;
    return NC.Online?.remotes?.get(id) || null;
  }
  const at = (game, id, x, y) => heroOf(game, id) || { x, y };

  // the latched wisps as the skill file keeps them (p.wsLatch: { host, until, shield })
  function latchList(game) {
    const out = [];
    let k = 0;
    for (const [id, h] of hosts) {
      const host = heroOf(game, id);
      if (host) for (let i = 0; i < h.n; i++) out.push({ host, until: i * LATCH_PHASE + k * HOST_PHASE, shield: h.shielded ? 1 : 0 });
      k++;
    }
    return out;
  }

  NC.FX.def(DRAWER, (ctx) => {
    const game = NC.game, L = NC.WispLooks;
    if (!game || !L || game.presentationOnly) return;
    const t = game.time;
    for (const [id, o] of orbits) {
      const p = heroOf(game, id);
      if (p && !(p.dead > 0)) L.orbit(ctx, p, o.n, o.big, t);
    }
    if (isWS(game.player)) return; // (the local shepherd's j3wisps draws the latched ones)
    for (const l of latchList(game)) if (!(l.host.dead > 0)) L.latched(ctx, l.host, l.until, l.shield > 0, t);
  });
  // (kept by reference, and found by origType too: the priest line's light skin renames j3wisps to 'lk' (js/lightkit.js
  // swap), and a check by type alone added a new one every snapshot - the same leak as js/online-meters.js, 2026-10-19)
  function ensure(type, fx) {
    if (fx && NC.FX.list.includes(fx)) return fx;
    return NC.FX.list.find((f) => f.type === type || f.origType === type) || NC.FX.add({ type, layer: LAYER, life: 1e9, x: 0, y: 0 });
  }

  function regrowSparks(game, L, id, n) {
    const before = counts.get(id);
    counts.set(id, n);
    const p = before !== undefined && n > before && heroOf(game, id);
    if (!p) return;
    const [x, y] = L.pos(p, n - 1, n, game.time);
    L.regrow(x, y);
  }

  function onSnapshot(event) { applySnapshot(event.detail?.snapshot); }
  function applySnapshot(snapshot) {
    const game = NC.game, p = game?.player, L = NC.WispLooks;
    if (!snapshot?.self || !p || !L || game.presentationOnly) return;
    if (snapshot.mapId !== mapId) { mapId = snapshot.mapId; counts.clear(); }
    hosts.clear(); orbits.clear();
    for (const record of [snapshot.self, ...(snapshot.players || [])]) {
      const m = record.meters, latched = num(m, 'wsLatched'), n = num(m, 'wsOrbit');
      if (latched > 0) hosts.set(record.id, { n: latched, shielded: num(m, 'wsShield') > 0 });
      if (record !== snapshot.self && n > 0) orbits.set(record.id, { n, big: num(m, 'wsBig') > 0 });
      regrowSparks(game, L, record.id, n);
    }
    p.wsOrbit = num(snapshot.self.meters, 'wsOrbit');
    const n = num(snapshot.self.meters, 'wsLatched');
    for (let i = onMe.length - 1; i >= 0; i--) if (onMe[i].until <= game.time) onMe.splice(i, 1);
    while (onMe.length > n) onMe.shift(); // (the oldest went first: a burst, a host's most)
    while (onMe.length < n) onMe.push({ until: game.time + LATCH_S });
    if (L.latchBuffs) L.latchBuffs(p, onMe, num(snapshot.self.meters, 'wsShield') > 0 ? onMe : [], game.time);
    p.wsLatch = isWS(p) ? latchList(game) : [];
    if (isWS(p)) orbitFx = ensure(ORBIT_FX, orbitFx);
    if (orbits.size || hosts.size) drawer = ensure(DRAWER, drawer);
  }

  // the flights: each shot from the i-th of the n circling (where this client draws it), gap seconds apart
  function fly(game, L, data) {
    const p = heroOf(game, data.actorId), gap = Number(data.gap) || 0, swarm = data.skillId === 'ws_swarm';
    (data.shots || []).forEach((s, i) => NC.VFX.at(i * gap, () => {
      const e = mobOf(game, s.targetId);
      if (!alive(e)) return; // (out of this client's sight, or down)
      const from = p ? L.pos(p, s.i, s.n, game.time) : [s.x, s.y];
      if (swarm) L.swarm(game, p || game.player, from, e, true);
      else L.fly(game, p || game.player, from, e, data.skillId, Number(data.speed) || 0, null);
    }));
  }
  function mark(game, data) {
    if (!game.player || (data.actorId !== game.player.id && data.actorId !== selfId)) return; // (a shepherd draws her own marks, as on the web; the web hero has no .id)
    const e = mobOf(game, data.targetId);
    if (e) e.wsMark = { until: game.time + (Number(data.seconds) || 0), next: 0 };
  }
  function onWisp(game, L, data) {
    const who = at(game, data.actorId, data.x, data.y), spots = data.at || [];
    switch (data.kind) {
      case 'latch': {
        const h = at(game, data.hostId, data.hx, data.hy); L.latch(who.x, who.y, h.x, h.y);
        if (selfId && data.hostId === selfId) onMe.push({ until: game.time + (Number(data.seconds) || LATCH_S) });
        break;
      }
      case 'embrace':
        if (data.none) { L.none(who.x, who.y); break; }
        (data.hostIds || []).forEach((id, i) => { const h = at(game, id, spots[i]?.[0], spots[i]?.[1]); L.embrace(h.x, h.y); });
        L.embraced(who.x, who.y);
        break;
      case 'burst':
        if (data.none) { L.none(who.x, who.y); break; }
        for (const [x, y] of spots) L.burst(game, x, y);
        break;
      case 'fly': fly(game, L, data); break;
      case 'healRing': L.healRing(data.x, data.y); break;
      case 'mark': mark(game, data); break;
      case 'markBurst': { const e = mobOf(game, data.targetId); if (e) L.markBurst(e); break; }
      case 'soak': { const h = data.hostId ? at(game, data.hostId, data.x, data.y) : who; L.soak(h.x, h.y, Number(data.amount) || 0); break; } // (at the hero it soaked for: patch 021)
      default: break;
    }
  }
  function onEvent(event) { applyEvent(event.detail); }
  function applyEvent(data) {
    const game = NC.game, L = NC.WispLooks;
    if (!data || data.type !== EVENT || !game || !L || game.presentationOnly) return;
    onWisp(game, L, data);
  }

  // (online/world.js calls this module itself; online/oldlooks.js sends the window events to the old looks only)
  // js/online/world.js: every merged snapshot { self, players, mapId } (self with its id) and every server event
  NC.OnlineWisp = Object.freeze({
    snapshot(st, me) { if (me) selfId = me; if (st && st.self) applySnapshot(st.self.id ? st : Object.assign({}, st, { self: Object.assign({ id: me }, st.self) })); },
    event: applyEvent,
  });
})();
