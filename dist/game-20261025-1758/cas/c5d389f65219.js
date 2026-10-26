/* The web online client's side of the mage family's class 3 (js/class3_skills_a.js, the mage section; backend/
   job_starcore.go, job_winterlord.go, job_astral.go, job_hexlord.go). The server runs the four signatures; the client
   draws what it sends with the skill file's own looks (NC.MageC3Looks), after js/online-class3.js (the core's ring,
   back-pieces and effects). Their numbers are the usual combat events.
   - `class3` events: supernova (the starcore's, round where the hero stood), statue (a winterlord's ice statue: where
     and how long; three at most a hero, the oldest goes; it crumbles when its time is over), statueShot (a statue's
     shard at its monster), align (the astral's planets aligning: the spot and the elements; the blast 0.3 s on) and
     ghost (the hexlord's ghost fire leaping from a fallen monster to its neighbours).
   - The astral's planets come as the meters axFire / axWater / axWind / axEarth (the tick each planet goes, in seconds:
     a new value is a new planet), set onto p.axPlanets, which the skill file's drawFront draws round the hero.
   - The hexlord's dark zone is the skill file's drawBack, from the core's c3Awake meter; the motes the offline
     awakening tick throws round it are thrown here each frame, for every awake hexlord in sight.
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC, C3 = NC.C3;
  if (!C3 || !NC.Online) return;
  const PLANET_SECONDS = 12; // backend/job_astral.go axPlanetSeconds (C3A:301)
  const PLANET_METERS = { fire: 'axFire', water: 'axWater', wind: 'axWind', earth: 'axEarth' };
  const STATUE_MOST = 3; // backend/job_winterlord.go wnStatueMost (C3A:239)
  const LASTS = 1e9;
  const statues = new Map(); // hero id -> its statues, oldest first ({ x, y, until, fx, gone })
  let ticker = null;
  const num = (v) => Number(v) || 0;
  const heroOf = (game, id) => (game.player && game.player.id === id ? game.player : NC.Online?.remotes?.get(id));
  const monsterOf = (game, id) => (id ? (game.enemies || []).find((m) => (m.sid || m.id) === id) : null);
  const heroes = (game) => [game.player, ...(NC.Online?.remotes?.values() || [])].filter(Boolean);

  // ---------------- the astral's planets, from its meters ----------------
  function syncPlanets(game, p, meters) {
    if (!p || p.job !== 'astral') return;
    const seen = p.axSeen || (p.axSeen = {}), list = [];
    for (const el in PLANET_METERS) {
      const v = num(meters?.[PLANET_METERS[el]]);
      if (!v) { delete seen[el]; continue; }
      if (!seen[el] || seen[el].v !== v) seen[el] = { v, until: game.time + PLANET_SECONDS }; // (a new planet)
      list.push({ el, v, until: seen[el].until });
    }
    p.axPlanets = list.sort((a, b) => a.v - b.v).map(({ el, until }) => ({ el, until })); // (the oldest first, C3A:300)
  }

  // ---------------- the hexlord's motes, each frame ----------------
  function motes(q, dt) {
    const game = NC.game, L = NC.MageC3Looks;
    if (!game || game.presentationOnly || !L) return;
    for (const p of heroes(game)) if (p.job === 'hexlord' && C3.awake(p)) L.darkMotes(p, dt);
  }
  function syncMotes(game) {
    if (!heroes(game).some((p) => p.job === 'hexlord' && C3.awake(p))) return;
    if (!ticker || !NC.FX.list.includes(ticker)) ticker = NC.FX.add({ type: 'timer', layer: 'none', x: 0, y: 0, life: LASTS, update: motes });
  }

  function onSnapshot(event) {
    const game = NC.game, data = event.detail?.snapshot;
    if (!game || !data?.self || !NC.MageC3Looks) return;
    syncPlanets(game, game.player, data.self.meters);
    for (const remote of NC.Online?.remotes?.values() || []) syncPlanets(game, remote, remote.meters);
    syncMotes(game);
  }

  // ---------------- the winterlord's statues ----------------
  function statue(game, L, data) {
    const seconds = num(data.seconds), list = (statues.get(data.actorId) || []).filter((s) => !s.gone && s.until > game.time);
    while (list.length >= STATUE_MOST) { const old = list.shift(); old.gone = true; if (old.fx) old.fx.dead = true; }
    const s = { x: num(data.x), y: num(data.y), until: game.time + seconds };
    s.fx = L.statue(s, seconds);
    list.push(s);
    statues.set(data.actorId, list);
    NC.VFX.at(seconds, () => { if (!s.gone) { s.gone = true; L.crumble(s); } });
  }

  function onEvent(event) {
    const data = event.detail, game = NC.game, L = NC.MageC3Looks;
    if (!data || data.type !== 'class3' || !game || !L) return;
    const p = heroOf(game, data.actorId), mine = !!p && p === game.player;
    const who = p || { x: num(data.x), y: num(data.y) }; // (the words over a hero out of this client's list)
    switch (data.kind) {
      case 'supernova': L.supernova(game, who, num(data.x), num(data.y), mine); break;
      case 'statue': statue(game, L, data); break;
      case 'statueShot': L.statueShot({ x: num(data.x), y: num(data.y) }, monsterOf(game, data.targetId) || { x: num(data.tx), y: num(data.ty) }); break;
      case 'align': L.align(game, who, num(data.x), num(data.y), Array.isArray(data.els) ? data.els : [], mine); break;
      case 'ghost': {
        const from = { x: num(data.x), y: num(data.y) };
        L.contagion(from);
        for (const h of Array.isArray(data.to) ? data.to : []) L.ghost(from, monsterOf(game, h.id) || { x: num(h.x), y: num(h.y) });
        break;
      }
      default:
    }
  }

  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
  window.addEventListener('nightcamp:online-event', onEvent);
})();
