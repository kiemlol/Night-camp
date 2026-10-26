/* The web online client's side of the assassin (js/skills_v21.js:336-343, backend/job_assassin.go): the server lands
   the haste Lv10's shadow echo (a combat event of as_haste) and the katar mastery's second cut on a critical (as_katar)
   as shares of a basic hit; offline each one draws a slash on the monster, drawn here with the skill kit's own look.
   The lethal edge's bleed ticks come as dots of as_bleed (their red: js/online-meters.js DOT_FILL).
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC;
  // skills_v21.js:337 and :342: the slash's size, its turn off the hero's aim at the monster, palette, colour, width
  const SLASHES = {
    as_haste: { r: 80, turn: 0.6, pal: 'shadow', rgb: '190,120,255', thick: 18 },
    as_katar: { r: 90, turn: -0.7, pal: 'blood', rgb: '255,80,110', thick: 22 },
  };
  const LIFE = 0.2, LIFT = 55, FROM_LIFT = 50, TO_LIFT = 45; // (angTo: the hero's chest to the monster's)
  function hero(id) {
    const O = NC.Online, game = NC.game;
    if (!O || !game) return null;
    return id === game.player.id || id === O.getState().playerId ? game.player : O.remotes.get(id) || null;
  }
  function onEvent(event) {
    const data = event.detail, K = NC.SkillKit, game = NC.game;
    const look = data && data.type === 'combat' && !data.dot && SLASHES[data.skillId];
    if (!look || !K || !game) return;
    const e = (game.enemies || []).find((m) => (m.sid || m.id) === data.targetId);
    if (!e) return; // (out of this client's sight)
    const p = hero(data.sourceId || data.actorId);
    const a = p ? NC.angle(p.x, p.y - FROM_LIFT, e.x, e.y - TO_LIFT) : 0;
    K.slashAt(e.x, e.y - LIFT, look.r, a + look.turn, K.P[look.pal], look.rgb, { life: LIFE, thick: look.thick });
  }
  window.addEventListener('nightcamp:online-event', onEvent);
})();
