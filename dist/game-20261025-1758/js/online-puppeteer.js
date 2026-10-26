/* The web online client's side of the puppeteer (js/jobs3_skills_c.js:61-374, backend/job_puppeteer.go,
   job_puppeteer_skills.go): the server runs the puppet (a pets.go summon: js/online-pets.js and petrig.js draw it and its
   strings), the hooked monsters and the steel wires, and sends a `puppeteer` event for each look, drawn with the skill
   file's own (NC.PuppetLooks): the build's name as a puppet is made, its rebuilding, each strike of the puppet on its
   target (the crossbow's bolt a look only), its special moves, the swap, the dance's spins, the hooks, a Lv10 hooked
   monster's burst, the wires (strung, crossing, dropped, reeled in by the bind). Each hero's wires and hooked monsters
   are its own (keyed by the event's actorId) and last as the server says: a wire its `seconds`, a hook until it ends or
   its monster falls; the thread from the hero's hand to a hooked monster is drawn as the puppet's strings are
   (petrig.js puppetStrings). A presented pp_stretch / pp_control / pp_puppet cast no longer starts any of this
   (game.presentationOnly). A hooked monster's blow (combat `pp_charm`) gets its slash, a wire's cut its sparks.
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs).
   2026-10-20: js/online.js and its window events are gone; js/online/world.js now calls NC.OnlinePuppet.snapshot / .event
   (before that this file was not loaded: the server's puppet struck unseen beside a local one, Discord #113 #138). The
   swap and the dance are drawn only from here (js/online-pets.js: their presented casts find no puppet); another hero's
   new puppet's name is its replayed cast's (js/net.js plays RUN.pp_puppet whole), so here only mine; another's looks at a
   share (js/otherfx.js). */
(function () {
  const NC = window.NC;
  const EVENT = 'puppeteer', THREAD = '215,195,255', CHARM_HIT = 'pp_charm', WIRE_CUT = 'pp_stretch', DRAWER = 'ppOnlineStrings';
  const BROKE_LOG = 'หุ่นรบพัง', HAND_LIFT = 60, THREAD_A = 0.55, THREAD_W = 1.4, THREAD_SAG = 30;
  const heroes = new Map(); // actorId -> { wires: Map(id -> wire), hooks: Map(monster id -> until) }
  let drawer = null, mapId = null, selfId = null; // (the local hero's server id: js/online/world.js W.me; the web hero has no .id)

  const stateOf = (id) => { let h = heroes.get(id); if (!h) heroes.set(id, (h = { wires: new Map(), hooks: new Map() })); return h; };
  const mobOf = (game, id) => (game.enemies || []).find((m) => (m.sid || m.id) === id); // (a mirror's server id: online/world.js e.sid)
  function actorOf(game, id) {
    if (game.player && (game.player.id === id || (selfId && id === selfId))) return game.player;
    return NC.Online?.remotes?.get(id) || null;
  }
  function ensureDrawer() {
    if (!drawer || !NC.FX.list.includes(drawer)) drawer = NC.FX.add({ type: DRAWER, layer: 'high', life: 1e9, x: 0, y: 0 });
  }
  // the thread from the hand to a hooked monster (as petrig.js puppetStrings draws the puppet's)
  function thread(ctx, from, e) {
    const [hx, hy] = from, x = e.x, y = e.y - HAND_LIFT;
    ctx.save(); ctx.strokeStyle = `rgba(${THREAD},${THREAD_A})`; ctx.lineWidth = THREAD_W;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + x) / 2, Math.min(hy, y) - THREAD_SAG, x, y); ctx.stroke();
    ctx.restore();
  }
  NC.FX.def(DRAWER, (ctx) => {
    const game = NC.game, L = NC.PuppetLooks, K = NC.SkillKit;
    if (!game || !L || !K) return;
    for (const [id, h] of heroes) {
      for (const [wid, w] of h.wires) if (game.time > w.until) h.wires.delete(wid); else L.wire(ctx, w, game.time);
      const p = actorOf(game, id);
      for (const [mid, until] of h.hooks) {
        const e = mobOf(game, mid);
        if (!p || !e || e.dead > 0 || game.time > until) { h.hooks.delete(mid); continue; }
        thread(ctx, K.tip(p), e);
      }
    }
  });

  function hook(game, L, data) {
    const p = actorOf(game, data.actorId), from = p ? NC.SkillKit.tip(p) : [data.x, data.y - HAND_LIFT];
    const h = stateOf(data.actorId);
    for (const t of data.targets || []) {
      const e = mobOf(game, t.id);
      if (!e) continue; // (out of this client's sight)
      L.hook(from, e, !!t.boss);
      if (!t.boss) h.hooks.set(t.id, game.time + (Number(data.seconds) || 0));
    }
    ensureDrawer();
  }
  function wire(game, L, data) {
    const h = stateOf(data.actorId);
    for (const [x, y] of data.cross || []) L.cross(game, x, y);
    for (const id of data.ends || []) h.wires.delete(id);
    h.wires.set(data.id, { x0: data.x0, y0: data.y0, x1: data.x1, y1: data.y1, t0: game.time, until: game.time + (Number(data.seconds) || 0) });
    ensureDrawer();
  }
  function bind(L, data) {
    const h = stateOf(data.actorId);
    h.wires.clear();
    for (const [x0, y0, x1, y1] of data.wires || []) L.reel({ x0, y0, x1, y1 }, data.x, data.y - HAND_LIFT);
    if (data.got > 0) L.bound({ x: data.x, y: data.y });
  }
  function puppetHit(game, L, data) {
    const e = mobOf(game, data.targetId), q = { x: data.x, y: data.y };
    if (!e) return;
    if (data.build === 'xbow') L.bolt(game, game.player, q, e, () => {}); // (a look: the server's bolt strikes)
    else L.slash(q, e);
  }
  function onPuppeteer(game, L, data) {
    const at = { x: data.x, y: data.y };
    switch (data.kind) {
      case 'puppet': if (data.actorId === selfId) L.built(at, data.build); break;
      case 'rebuilt': L.rebuilt(at); break;
      case 'broke': if (data.actorId === selfId) NC.HUD?.log?.(BROKE_LOG, 'warn'); break;
      case 'hit': puppetHit(game, L, data); break;
      case 'special': if (data.build === 'axe') L.spin(at); else L.roar(at); break;
      case 'swap': L.swap(data.x0, data.y0, data.x, data.y); break;
      case 'dance': L.dance(game, at, data.i || 0); break;
      case 'charm': hook(game, L, data); break;
      case 'charmBurst': L.charmBurst(game, data.x, data.y); break;
      case 'wire': wire(game, L, data); break;
      case 'wireEnd': for (const id of data.ids || []) stateOf(data.actorId).wires.delete(id); break;
      case 'bind': bind(L, data); break;
      default: break; // ('theatre': the presented cast draws the ring and its strings)
    }
  }
  function onEvent(event) { applyEvent(event.detail); }
  function applyEvent(data) {
    const game = NC.game, L = NC.PuppetLooks;
    if (!data || !game || !L) return;
    const mine = data.actorId === selfId || data.sourceId === selfId;
    const show = (fn) => (mine || !NC.OtherFX ? fn() : NC.OtherFX.run(fn));
    if (data.type === 'combat' && (data.skillId === CHARM_HIT || data.skillId === WIRE_CUT)) {
      const e = mobOf(game, data.targetId);
      if (e) show(() => (data.skillId === CHARM_HIT ? L.charmStrike : L.wireCut)(e));
      return;
    }
    if (data.type === EVENT) show(() => onPuppeteer(game, L, data));
  }
  function onSnapshot(event) { applySnapshot(event.detail?.snapshot); }
  function applySnapshot(snapshot) {
    if (!snapshot || snapshot.mapId === mapId) return;
    mapId = snapshot.mapId; heroes.clear(); // (a new map: its wires and hooks are gone with it)
  }

  window.addEventListener('nightcamp:online-event', onEvent);
  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
  // js/online/world.js: every merged snapshot { self, players, mapId } and every server event
  NC.OnlinePuppet = Object.freeze({
    snapshot(st, me) { if (me) selfId = me; applySnapshot(st); },
    event: applyEvent,
  });
})();
