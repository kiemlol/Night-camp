/* The web online client's side of the archer family's class-3 jobs (js/class3_skills_b.js:28-229; backend/
   job_moonsniper.go, job_packalpha.go, job_maestro.go, job_outlaw.go). The server runs their signatures and their
   awakenings' hooks; the client draws them from what it sends:
   - two meters of every hero's record: msFocus (the moonsniper's focus, 0-5: its five small moons) and olShots (the
     outlaw's count to midnight: its clock) go onto p.msFocus / p.olShots, which the jobs' own drawFront reads for the
     local hero (js/class3_core.js) and the others (js/online-class3.js);
   - `class3` events, drawn with the skill file's looks (C3.jobs.<job>.looks) where the server set them off: moonLine
     (the moonlight line), moonSplit (the awake moonlight arrows), wolf (the spirit wolf's run; each of its bites, a
     combat event of pa_howl, gets its slash), band (the forest band's notes) and deadeye (midnight's crosshairs and
     shots); a packalpha's awaken event gets its howl. Their numbers are the usual combat events.
   After js/online-class3.js; apart from js/online.js so the FX replay sources stay untouched
   (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC, C3 = NC.C3;
  if (!C3 || !NC.Online) return;
  const METERS = { msFocus: 'msFocus', olShots: 'olShots' };
  const WOLF_BITE = 'pa_howl';
  const num = (meters, key) => Number(meters?.[key]) || 0;
  const heroOf = (game, id) => (game.player && game.player.id === id ? game.player : NC.Online?.remotes?.get(id));
  const monsterOf = (game, id) => (id ? (game.enemies || []).find((m) => (m.sid || m.id) === id) : null);
  const targetsOf = (game, list) => (list || []).map((t) => monsterOf(game, t.id)).filter(Boolean);
  const looksOf = (job) => C3.jobs[job]?.looks;
  const wolfAng = new Map(); // (the last wolf's angle by hero: its bites' slashes)

  function sync(p, meters) {
    if (!p) return;
    for (const [key, field] of Object.entries(METERS)) p[field] = num(meters, key);
  }
  function onSnapshot(event) {
    const game = NC.game, data = event.detail?.snapshot;
    if (!game || !data?.self) return;
    sync(game.player, data.self.meters);
    for (const remote of NC.Online?.remotes?.values() || []) sync(remote, remote.meters);
  }

  // each event kind's look (the hero p set it off)
  const DRAW = {
    moonLine: (game, p, data) => looksOf('moonsniper')?.line(data.x, data.y, data.ang, monsterOf(game, data.targetId)),
    moonSplit: (game, p, data) => looksOf('moonsniper')?.split(p, targetsOf(game, data.targets)),
    wolf: (game, p, data) => { wolfAng.set(data.actorId, data.ang); looksOf('packalpha')?.wolf(data.x, data.y, data.ang, data.len); },
    band: (game, p, data) => looksOf('maestro')?.band(p, targetsOf(game, data.targets)),
    deadeye: (game, p, data) => looksOf('outlaw')?.deadeye(game, p, targetsOf(game, data.targets), p === game.player),
  };
  function onEvent(event) {
    const data = event.detail, game = NC.game;
    if (!data || !game) return;
    if (data.type === 'combat' && data.skillId === WOLF_BITE) {
      const e = monsterOf(game, data.targetId);
      if (e && wolfAng.has(data.actorId)) looksOf('packalpha')?.bite(e, wolfAng.get(data.actorId));
      return;
    }
    if (data.type !== 'class3') return;
    const p = heroOf(game, data.actorId);
    if (!p) return; // (out of this client's sight)
    if (data.kind === 'awaken' && data.job === 'packalpha') looksOf('packalpha')?.howl(p);
    DRAW[data.kind]?.(game, p, data);
  }

  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
  window.addEventListener('nightcamp:online-event', onEvent);
})();
