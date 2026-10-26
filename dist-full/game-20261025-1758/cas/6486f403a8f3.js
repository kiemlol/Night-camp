/* The web online client's side of the paladin (js/skills_v21.js:286-295 and 602-607, js/class2_skills_a.js:262-267,
   backend/job_paladin.go): the server counts the holy blade's fifth swings and the faith blade's tenth, runs the zeal's
   aura and sends the reflection back, and sends a `paladin` event for each look: `holyblade` (the cross of light on
   the monster), `faithblade` (the burst round the hero), `zeal` (the aura's pulse round the hero) and `reflect` (the
   bolt from the hero to the monster that struck it). They are drawn as the offline game draws them; the numbers come
   from the server's combat events, the heals from its `heal` events (js/online/support.js).
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC;
  const CROSS = { r: 110, lift: 60, life: 0.3, thick: 26, turn: Math.PI / 4 }; // skills_v21.js:288-289
  const BURST = { r: 170, shake: 4, stars: 8 }; // :293
  const PULSE = { lift: 6, r0: 30, r1: 170, w: 8, life: 0.35 }; // :605
  const BOLT = { rgb: '160,210,255', from: 70, to: 50, life: 0.2, w: 4, jag: 12, seg: 6 }; // class2_skills_a.js:266
  let selfId = '';

  function heroOf(game, id) {
    if (id && id === selfId) return game.player;
    return NC.Online?.remotes?.get(id) || null;
  }
  const mobOf = (game, id) => (game.enemies || []).find((m) => (m.sid || m.id) === id);

  function cross(game, data) {
    const K = NC.SkillKit, e = mobOf(game, data.targetId);
    const x = e ? e.x : data.x, y = e ? e.y : data.y;
    for (const a of [CROSS.turn, -CROSS.turn]) K.slashAt(x, y - CROSS.lift, CROSS.r, a, K.P.holy, K.C.holy, { life: CROSS.life, thick: CROSS.thick });
  }
  function onEvent(event) {
    const data = event.detail, game = NC.game, K = NC.SkillKit, V = NC.VFX;
    if (!data || data.type !== 'paladin' || !game || !K || !V) return;
    const hero = heroOf(game, data.actorId), self = !!hero && hero === game.player;
    const x = hero ? hero.x : data.x, y = hero ? hero.y : data.y;
    if (data.kind === 'holyblade') cross(game, data);
    else if (data.kind === 'faithblade') K.burst(game, x, y, BURST.r, K.C.holy, { shake: self ? BURST.shake : 0, stars: BURST.stars });
    else if (data.kind === 'zeal') V.ring(x, y - PULSE.lift, PULSE.r0, PULSE.r1, PULSE.w, K.C.holy, PULSE.life);
    else if (data.kind === 'reflect') {
      const e = mobOf(game, data.targetId);
      if (e) V.boltAt(x, y - BOLT.from, e.x, e.y - BOLT.to, BOLT.rgb, BOLT.life, { w: BOLT.w, jag: BOLT.jag, seg: BOLT.seg });
    }
  }
  window.addEventListener('nightcamp:online-snapshot', (event) => { selfId = event.detail?.snapshot?.self?.id || selfId; });
  window.addEventListener('nightcamp:online-event', onEvent);
})();
