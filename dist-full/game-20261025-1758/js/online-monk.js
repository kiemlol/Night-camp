/* The web online client's side of the monk (js/class2_skills_c.js:164-262, js/skills_v21.js:242-250,
   backend/job_monk.go): the server gathers and spends the spirit spheres and sends their count as the moSpheres meter.
   It goes onto the local hero as p.spheres, the field the skill file reads (the orbit, sphereFx, and the ATK +3% each
   of NC.skillModSources), and the orbit starts from it with the skill file's own look (NC.MonkLooks.sphereFx): a
   presented mo_spheres cast no longer starts one (game.presentationOnly). The other heroes' records carry no meters,
   so only the local hero's orbit shows. The server rolls the triple attack and sends a `monk` event (kind 'triple') for
   its look: the words and the ring on the monster (skills_v21.js:247-248), and, when it gathered a sphere, the
   gathering round the monk (class2_skills_c.js:184-185).
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC;
  const GOLD = '255,210,90', TRIPLE_RGB = '255,200,90', TRIPLE_FILL = '#ffcf6a';

  function onSnapshot(event) {
    const self = event.detail?.snapshot?.self, game = NC.game, p = game?.player, L = NC.MonkLooks;
    if (!self || !p) return;
    const n = Number(self.meters?.moSpheres) || 0;
    p.spheres = n;
    if (!n || !L) return;
    if (p.sphereFx && !NC.FX.list.includes(p.sphereFx)) p.sphereFx = null; // (a new map empties the FX list)
    L.sphereFx(game, p);
  }

  function actorOf(game, id) {
    if (game.player && game.player.id === id) return game.player;
    return NC.Online?.remotes?.get(id) || null;
  }

  function onEvent(event) {
    const data = event.detail, game = NC.game, FX = NC.FX, V = NC.VFX;
    if (!data || data.type !== 'monk' || data.kind !== 'triple' || !game) return;
    const e = (game.enemies || []).find((m) => m.id === data.targetId);
    if (!e) return; // (out of this client's sight)
    FX.text(e.x, NC.labelTop(e) - 90, 'หมัดสามดาว!', TRIPLE_FILL, 30);
    V.ring(e.x, e.y - 40, 10, 110, 8, TRIPLE_RGB, 0.3);
    const p = data.sphere && actorOf(game, data.actorId);
    if (!p) return;
    V.gather(p.x, p.y - 80, 8, GOLD, 90, 0.25);
    V.ring(p.x, p.y - 10, 10, 90, 6, GOLD, 0.3);
  }

  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
  window.addEventListener('nightcamp:online-event', onEvent);
})();
