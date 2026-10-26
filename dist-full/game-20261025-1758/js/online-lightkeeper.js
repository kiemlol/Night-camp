/* The web online client's side of the lightkeeper (js/jobs3_skills_c.js:377-549, backend/job_lightkeeper.go): the
   server keeps each hero's zones of light and sends them as `lightkeeper` events:
   - `zones`, whenever they change and at every half-second pulse: the aura's radius round the hero (0 none) and each
     flame, planted torch and lamp (its id, kind, place, radius, the seconds it has left; a Lv10 lamp's `follow` and the
     friend it drifts after now, `followId`);
   - `flare`: each lamp's flare (none: 'ยังไม่มีโคม' over the keeper, as offline);
   - `rise`: the lighthouse Lv5 raising the fallen keeper.
   They are drawn with the skill file's own looks (NC.LightkeeperLooks, the offline j3zones / j3lampobj), each hero's
   own zones round that hero, for every lightkeeper on the screen. The skill tick that ages and moves them offline never
   runs online, and a presented cast no longer adds to the offline list (game.presentationOnly); its light still shows.
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC;
  const AURA_HOLD = 1.5; // s: each zones event keeps the aura up this long (they come every 0.5 s while it lasts)
  const FOLLOW = { rate: 2, lift: 20 }; // jobs3_skills_c.js:509: a Lv10 lamp drifts x min(1, 2 dt) toward its friend, 20 below
  const keepers = new Map(); // hero id -> { zones: Map(zone id -> zone), aura, auraUntil }
  let selfId = '', mapId = '', ground = null, ticker = null;

  function heroOf(game, id) {
    if (id && (id === selfId || id === game.player?.id)) return game.player;
    return NC.Online?.remotes?.get(id) || null;
  }
  const isKeeper = (hero) => !!hero && hero.dead <= 0 && NC.isJob?.(hero, 'lightkeeper');

  function dropZone(z) { if (z.obj) z.obj.dead = true; }
  function dropKeeper(id) {
    const k = keepers.get(id);
    if (!k) return;
    for (const z of k.zones.values()) dropZone(z);
    keepers.delete(id);
  }

  // the lamp or torch standing among the characters (the offline j3lampobj)
  function ensureObject(z) {
    if (z.kind !== 'lamp' && z.kind !== 'torch') return;
    if (z.obj && NC.FX.list.includes(z.obj)) return;
    z.obj = NC.FX.add({ type: 'custom', layer: 'sorted', x: z.x, y: z.y, sort: z.y, life: 1e9, draw: (ctx) => NC.LightkeeperLooks?.object(ctx, z, NC.game?.time || 0) });
  }
  // the glow of every keeper's aura and zones on the ground (the offline j3zones)
  function ensureDrawers() {
    const FX = NC.FX;
    if (!ground || !FX.list.includes(ground)) {
      ground = FX.add({ type: 'custom', layer: 'low', x: 0, y: 0, life: 1e9, draw: (ctx) => {
        const game = NC.game, L = NC.LightkeeperLooks;
        if (!game || !L) return;
        for (const [id, k] of keepers) {
          const hero = heroOf(game, id);
          if (hero && k.aura > 0 && game.time < k.auraUntil) L.ground(ctx, { kind: 'aura', x: hero.x, y: hero.y, r: k.aura }, game.time);
          for (const z of k.zones.values()) L.ground(ctx, z, game.time);
        }
      } });
    }
    if (!ticker || !FX.list.includes(ticker)) ticker = FX.add({ type: 'timer', layer: 'none', x: 0, y: 0, life: 1e9, update: (q, dt) => step(dt) });
  }
  // each frame: a zone past its time goes; a Lv10 lamp drifts after its friend as the skill tick moves it (:509)
  function step(dt) {
    const game = NC.game;
    if (!game) return;
    for (const [id, k] of keepers) {
      for (const [zid, z] of k.zones) {
        if (game.time > z.until) { dropZone(z); k.zones.delete(zid); continue; }
        const f = z.followId ? heroOf(game, z.followId) : null, t = Math.min(1, dt * FOLLOW.rate);
        if (f) { z.x += (f.x - z.x) * t; z.y += (f.y + FOLLOW.lift - z.y) * t; }
        if (z.obj) { z.obj.x = z.x; z.obj.y = z.y; z.obj.sort = z.y; }
      }
      if (!k.zones.size && !(game.time < k.auraUntil)) keepers.delete(id);
    }
  }

  function onZones(game, data) {
    const hero = heroOf(game, data.actorId);
    if (!isKeeper(hero)) { dropKeeper(data.actorId); return; }
    const k = keepers.get(data.actorId) || { zones: new Map(), aura: 0, auraUntil: 0 };
    keepers.set(data.actorId, k);
    k.aura = Number(data.aura) || 0;
    k.auraUntil = k.aura > 0 ? game.time + AURA_HOLD : 0;
    const seen = new Set();
    for (const s of Array.isArray(data.zones) ? data.zones : []) {
      if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.y) || !(s.r > 0)) continue;
      seen.add(s.id);
      const z = k.zones.get(s.id) || { id: s.id };
      Object.assign(z, { kind: s.kind, x: s.x, y: s.y, r: s.r, until: game.time + (Number(s.left) || 0), follow: !!s.follow, followId: s.followId || '' });
      k.zones.set(s.id, z);
      ensureObject(z);
    }
    for (const [zid, z] of k.zones) if (!seen.has(zid)) { dropZone(z); k.zones.delete(zid); }
    ensureDrawers();
  }
  function onEvent(event) {
    const data = event.detail, game = NC.game, L = NC.LightkeeperLooks;
    if (!data || data.type !== 'lightkeeper' || !game || !L) return;
    if (data.kind === 'zones') onZones(game, data);
    else if (data.kind === 'flare') {
      const lamps = Array.isArray(data.lamps) ? data.lamps : [];
      for (const z of lamps) L.flare(game, z);
      if (!lamps.length) L.noLamps(heroOf(game, data.actorId) || data);
    } else if (data.kind === 'rise') L.rise(heroOf(game, data.actorId) || data);
  }
  // a keeper gone from the snapshot, fallen or no longer a lightkeeper takes its zones with it; a new map, all of them
  function onSnapshot(event) {
    const snapshot = event.detail?.snapshot, game = NC.game;
    if (!snapshot?.self || !game) return;
    selfId = snapshot.self.id || selfId;
    if (snapshot.mapId !== mapId) { mapId = snapshot.mapId; for (const id of [...keepers.keys()]) dropKeeper(id); ground = ticker = null; return; }
    for (const id of [...keepers.keys()]) if (!isKeeper(heroOf(game, id))) dropKeeper(id);
  }
  window.addEventListener('nightcamp:online-event', onEvent);
  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
})();
