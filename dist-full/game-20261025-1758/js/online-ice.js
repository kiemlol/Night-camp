/* The web online client's side of the icemage (js/jobs3_skills_a.js, backend/job_icemage.go): the server breaks the
   frozen monsters and runs the ice armour, and sends an `ice` event for each look, drawn with the skill file's own
   (NC.IceLooks): a break (its shards flying at the monsters named in `to`), the armour's soak and its break, the Lv10
   armour growing back, the cold aura's pulse. The armour's shell comes from the iceArmor meter (js/online-meters.js).
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC;
  function onEvent(event) {
    const data = event.detail, L = NC.IceLooks, game = NC.game;
    if (!data || data.type !== 'ice' || !L || !game) return;
    const byId = (id) => (game.enemies || []).find((m) => m.id === id);
    if (data.kind === 'shatter') {
      const e = byId(data.targetId);
      if (!e) return; // (out of this client's sight)
      L.shatter(game, e, data.depth || 0);
      for (const id of data.to || []) { const f = byId(id); if (f) L.shard(game, game.player, e, f); }
    } else if (data.kind === 'soak') {
      L.soak(data.x, data.y, data.amount || 0);
      if (data.broke) L.armorBreak(data.x, data.y);
    } else if (data.kind === 'aura') L.aura(data.x, data.y);
    else if (data.kind === 'regrow') L.regrow(data.x, data.y);
  }
  window.addEventListener('nightcamp:online-event', onEvent);
})();
