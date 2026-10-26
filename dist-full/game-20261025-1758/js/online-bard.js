/* The web online client's side of the bard (js/jobs3_skills_b.js:331-575, backend/job_bard.go, job_bard_skills.go):
   the server plays the songs and dances and sends the ones playing as hero meters, two slots (bdPerf1/2: the
   performance's index + 1 in SONGS + DANCES, bdVerse1/2: its verse, bdNext1/2: seconds to the next). On the local hero
   they become p.bdPerf, the field the skill file reads (FX 'j3perf': "♪ <song> · ท่อน N" and its bar over the bard; the
   songs' numbers of NC.skillModSources), and the labels' drawer starts from them (NC.BardLooks.ensurePerf): a presented
   song no longer starts it (game.presentationOnly). The skill ticks never run online, so the notes that fly off a
   playing bard (:540) and the fireflies round the monsters a firefly dance reaches (:552) are drawn here, for every bard
   whose record carries the meters. The server sends a `bard` event for each look its state decides, drawn with the
   skill file's own (NC.BardLooks): a verse rising, a finale (and the stars' cut cooldown), the SP running out, the
   festival's campfire standing where it was lit, and a monster it lulls to sleep.
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC;
  const PERFS = ['bd_tempo', 'bd_warm', 'bd_stars', 'bd_firefly', 'bd_lure']; // backend/job_bard.go bdPerformances
  const SLOTS = [['bdPerf1', 'bdVerse1', 'bdNext1'], ['bdPerf2', 'bdVerse2', 'bdNext2']];
  const HALF = 0.5, FOE_REACH = 400; // js/jobs3_skills_b.js:543-553 the dances' effects every half second, within 400
  const num = (meters, key) => Number(meters?.[key]) || 0;
  let heroes = []; // [hero, its performances] from the last snapshot
  let ticker = null, acc = 0;

  function perfsOf(meters, p, now) {
    const out = [];
    for (const [perf, verse, next] of SLOTS) {
      const id = PERFS[num(meters, perf) - 1];
      if (id) out.push({ id, lv: NC.skillLv(p, id) || 1, verse: num(meters, verse) || 1, next: now + num(meters, next) });
    }
    return out;
  }

  // the notes off every playing bard, the fireflies round what a firefly dance reaches
  function ensureTicker() {
    if (ticker && NC.FX.list.includes(ticker)) return;
    ticker = NC.FX.add({ type: 'timer', layer: 'none', life: 1e9, x: 0, y: 0, update(q, dt) {
      const L = NC.BardLooks, game = NC.game;
      if (!L || !game || game.presentationOnly) return;
      const half = (acc += dt) >= HALF;
      if (half) acc -= HALF;
      for (const [hero, perfs] of heroes) {
        if (hero.dead > 0) continue;
        for (const pf of perfs) {
          L.playing(hero, dt);
          if (half && pf.id === 'bd_firefly') for (const e of NC.SkillKit.around(game, hero.x, hero.y, FOE_REACH)) L.firefly(e);
        }
      }
    } });
  }

  function onSnapshot(event) {
    const snap = event.detail?.snapshot, game = NC.game, p = game?.player, L = NC.BardLooks;
    if (!snap?.self || !p || !L || game.presentationOnly) return;
    p.bdPerf = NC.isJob(p, 'bard') ? perfsOf(snap.self.meters, p, game.time) : [];
    const next = p.bdPerf.length ? [[p, p.bdPerf]] : [];
    for (const record of snap.players || []) {
      const hero = NC.Online?.remotes?.get(record.id);
      const perfs = hero && NC.isJob(hero, 'bard') ? perfsOf(record.meters, hero, game.time) : [];
      if (perfs.length) next.push([hero, perfs]);
    }
    heroes = next;
    if (p.bdPerf.length) L.ensurePerf();
    if (heroes.length) ensureTicker();
  }

  function actorOf(game, id) {
    if (game.player && (game.player.id === id || NC.Online?.getState?.().playerId === id)) return game.player;
    return NC.Online?.remotes?.get(id) || null;
  }

  function onEvent(event) {
    const data = event.detail, game = NC.game, L = NC.BardLooks;
    if (!data || data.type !== 'bard' || !game || !L) return;
    if (data.kind === 'fire') { L.campfire(data.x, data.y, Number(data.seconds) || 0); return; }
    if (data.kind === 'sleep') {
      const e = (game.enemies || []).find((m) => m.id === data.targetId);
      if (e) L.sleep(e); // (out of this client's sight: nothing)
      return;
    }
    const who = actorOf(game, data.actorId);
    if (!who || !NC.SKILLS[data.skillId]) return;
    if (data.kind === 'verse') L.verse(who, data.skillId, Number(data.verse) || 1);
    else if (data.kind === 'spOut') L.spOut(who);
    else if (data.kind === 'finale') {
      L.finale(who, who === game.player); // (the screen flashes for the local bard's own finale only)
      if (data.cd) L.cd(who);
    }
  }

  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
  window.addEventListener('nightcamp:online-event', onEvent);
})();
