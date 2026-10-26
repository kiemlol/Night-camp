/* The web online client's side of the priest family's class 3 (js/class3_skills_c.js; backend/job_starsaint.go,
   job_meteorfist.go, job_beacon.go, job_starshepherd.go). The server runs the four signatures; the client draws them:
   - from every hero's record's meters, the fields the skill file's own drawFront / drawBack read (class3_core.js's
     C3.drawHero draws them for the local hero and, through js/online-class3.js, for the others):
       ssFaith -> p.ssFaith (the star over the saint's head);
       mfCombo -> p.mfCombo, and p._mfT when it counts on (the combo counter, shown while the server sends it);
       bcA, bcOn -> p._bcA, p._bcOn (the beam's wedges on the ground: its angle runs on between snapshots at the
       server's 2π / 4 a second);
   - from `class3` events (their numbers are the usual combat and heal events), with the skill file's looks
     (NC.PriestC3Looks): ssJudgment (the flash, the local hero's only, and the shout), ssPillar (a judgment pillar
     where it falls), mfMeteor (the meteor falling onto the server's spot), stStar (the big star flying at its monster);
     and a bc_beam hit's sparks from its combat event.
   Another hero's record carries no skills, so its signature (Lv1 at least on any class-3 hero) is set for the looks'
   level checks. Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC, C3 = NC.C3, L = NC.PriestC3Looks;
  if (!C3 || !NC.Online || !L) return;
  const SIGS = { starsaint: 'ss_faith', meteorfist: 'mf_combo', beacon: 'bc_beam', starshepherd: 'st_merge' };
  const TURN = (2 * Math.PI) / 4; // (js/class3_skills_c.js:125 the beam: a turn in 4 s)
  const num = (meters, key) => Number(meters?.[key]) || 0;
  const heroOf = (game, id) => (game.player && game.player.id === id ? game.player : NC.Online?.remotes?.get(id));
  const monsterOf = (game, id) => (id ? (game.enemies || []).find((m) => (m.sid || m.id) === id) : null);

  // a hero's fields from its meters
  function sync(game, p, meters) {
    const sig = p && SIGS[p.job];
    if (!sig) return;
    if (p !== game.player && !NC.skillLv(p, sig)) p.skills = Object.assign({}, p.skills, { [sig]: 1 }); // (kept: js/online.js merges a remote's skills)
    if (p.job === 'starsaint') p.ssFaith = num(meters, 'ssFaith');
    else if (p.job === 'meteorfist') {
      const n = num(meters, 'mfCombo');
      if (n && n !== p.mfCombo) p._mfT = game.time; // (a hit counted: the counter pops, C3C:105)
      p.mfCombo = n;
    } else if (p.job === 'beacon') {
      p._bcOn = num(meters, 'bcOn');
      p._bcSrv = { a: num(meters, 'bcA'), t: game.time };
    }
  }
  function onSnapshot(event) {
    const game = NC.game, data = event.detail?.snapshot;
    if (!game || !data?.self || game.presentationOnly) return;
    sync(game, game.player, data.self.meters);
    for (const remote of NC.Online?.remotes?.values() || []) sync(game, remote, remote.meters);
  }

  // the beam turns on between snapshots from the server's last angle
  function wrapBeam() {
    const J = C3.jobs.beacon, base = J && J.drawBack;
    if (!base || base.online) return;
    J.drawBack = function (ctx, game, p, st) {
      if (p._bcSrv) p._bcA = p._bcSrv.a + (game.time - p._bcSrv.t) * TURN;
      return base.call(this, ctx, game, p, st);
    };
    J.drawBack.online = true;
  }

  function onEvent(event) {
    const data = event.detail, game = NC.game;
    if (!data || !game || game.presentationOnly) return;
    if (data.type === 'combat' && data.skillId === 'bc_beam') {
      const e = monsterOf(game, data.targetId);
      if (e) L.beamSpark(e);
      return;
    }
    if (data.type !== 'class3') return;
    const p = heroOf(game, data.actorId);
    if (data.kind === 'ssJudgment') { if (p) L.judgment(game, p, p === game.player); }
    else if (data.kind === 'ssPillar') L.pillar(game, data.x, data.y);
    else if (data.kind === 'mfMeteor') L.meteor(game, data.x, data.y, !!data.big);
    else if (data.kind === 'stStar') L.star(game, data.fromX, data.fromY, monsterOf(game, data.targetId) || { x: data.x, y: data.y });
  }

  wrapBeam();
  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
  window.addEventListener('nightcamp:online-event', onEvent);
})();
