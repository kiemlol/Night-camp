/* The web online client's side of the shinobi (js/class2_skills_b.js, backend/job_shinobi.go): the server runs the
   substitute's logs (a heroGuard, which never runs online) and sends a `shinobi` event for each one, drawn with the
   skill file's own looks (NC.ShinobiLooks): the log where the hero stood (x, y) and the word where he stepped to
   (toX, toY). The shadow clones' bodies and stars come from sh_clone's cast replay; their hits are the server's.
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC;
  function onEvent(event) {
    const data = event.detail, L = NC.ShinobiLooks;
    if (!data || data.type !== 'shinobi' || !L || !NC.game) return;
    if (data.kind === 'substitute') {
      L.substitute.log(data.x, data.y);
      L.substitute.swapped(data.toX ?? data.x, data.toY ?? data.y);
    }
  }
  window.addEventListener('nightcamp:online-event', onEvent);
})();
