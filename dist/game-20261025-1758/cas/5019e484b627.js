/* The web online client's side of the warlock (js/class2_skills_a.js:660-677, backend/job_warlock.go): the server
   harvests the souls and sends their count as the hero's wlSouls meter. Offline the kill hook starts p.soulFx, the souls
   circling the warlock; online no kill runs on the client, so this draws them from the meter for the local hero only
   (never round a presentation cast's hero), and keeps p.souls, which the skill file's MATK source reads (:673).
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC;
  const TEAL = '90,235,215'; // js/class2_skills_a.js:31
  const SPIN = 1.8, ORBIT_X = 60, ORBIT_Y = 20, LIFT = 110, SIZE = 8, ALPHA = 0.85; // :668-671 p.soulFx
  let souls = 0, orbit = null;

  function draw(ctx) {
    const game = NC.game, p = game && game.player, K = NC.SkillKit;
    if (!p || !K || game.presentationOnly || !souls) return;
    for (let i = 0; i < souls; i++) {
      const a = game.time * SPIN + (i / souls) * Math.PI * 2;
      K.drawGhost(ctx, p.x + Math.cos(a) * ORBIT_X, p.y - LIFT + Math.sin(a) * ORBIT_Y, SIZE, game.time + i, TEAL, ALPHA);
    }
  }
  function onSnapshot(event) {
    const self = event.detail?.snapshot?.self, game = NC.game;
    if (!self || !game || game.presentationOnly || !game.player || !(NC.Online?.active || NC.Online?.enabled)) return;
    souls = Number(self.meters?.wlSouls) || 0;
    game.player.souls = souls ? { n: souls, t: game.time } : null;
    if (!souls) {
      if (orbit) { orbit.dead = true; orbit = null; }
      return;
    }
    if (!orbit || orbit.dead || !NC.FX.list.includes(orbit)) orbit = NC.FX.add({ type: 'vproj', layer: 'glow', x: 0, y: 0, life: 1e9, draw });
  }
  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
})();
