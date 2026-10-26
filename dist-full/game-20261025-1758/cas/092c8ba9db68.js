/* The web online client's side of the priest (js/skills_v21.js:349-357, backend/job_priest.go): the server rolls duple
   off the priest's basic hits and sends a `priest` event (kind 'duple') as each light comes down; this draws its look on
   that monster, the beam from the sky and the holy circle (:353-354). The heals, blessings, hastes, guards and revives
   of its skills come as `heal` / `teamBuff` / `revive` events (js/online/support.js); its casts replay from the web.
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC;
  const BEAM_W = 70, BEAM_H = 560, BEAM_LIFE = 0.4, CIRCLE_R = 80, CIRCLE_LIFE = 0.5, CIRCLE_SPIN = 2;
  function onEvent(event) {
    const data = event.detail, game = NC.game, V = NC.VFX;
    if (!data || data.type !== 'priest' || data.kind !== 'duple' || !game || !V) return;
    const e = (game.enemies || []).find((m) => (m.sid || m.id) === data.targetId);
    const x = e ? e.x : data.x, y = e ? e.y : data.y;
    V.beam(x, y, BEAM_W, BEAM_H, V.RGB.holy, BEAM_LIFE);
    V.circle(x, y, CIRCLE_R, V.RGB.holy, CIRCLE_LIFE, { style: 'holy', spin: CIRCLE_SPIN, grow: true });
  }
  window.addEventListener('nightcamp:online-event', onEvent);
})();
