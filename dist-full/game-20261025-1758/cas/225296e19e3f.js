/* The web online client's side of the knight's sword waves (js/skills_v21.js swordWave; server/server/fx_sword_wave.go,
   2026-10-24, docs/team/online-missing-looks.md). Offline the hero's own swings count to a wave (NC.basicHits), which
   never runs online: there the server counts them and sends {type:'knight', kind:'wave', actorId, x, y, aim, size, rage,
   delay} for each wave it strikes with. This flies the same crescent (NC.swordWaveLook) from the hero when the wave
   leaves, `delay` seconds on: steel, or the berserk's red (rage), at its size. The damage is the server's combat events. */
(function () {
  const NC = window.NC;
  const SPEED = 1150, RANGE = 560, STEEL = '200,230,255', RAGE = '255,70,60'; // skills_v21.js swordWave, RAGE
  const FROM = 40, LIFT = 60, DIP = 20; // swordWave's from: 40 ahead, 60 up, 20 x the aim's dip
  let selfId = '';
  const heroOf = (game, id) => (id && id === selfId ? game.player : NC.Online?.remotes?.get(id) || null);

  function fly(game, data) {
    const hero = heroOf(game, data.actorId), a = Number(data.aim) || 0, s = Number(data.size) || 1;
    const x = hero ? hero.x : Number(data.x), y = hero ? hero.y : Number(data.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !NC.swordWaveLook) return;
    const rgb = data.rage ? RAGE : STEEL;
    NC.FX.add({ type: 'custom', x: x + Math.cos(a) * FROM, y: y - LIFT + Math.sin(a) * DIP, vx: Math.cos(a) * SPEED,
      vy: Math.sin(a) * SPEED, life: RANGE / SPEED, draw(ctx, q) { NC.swordWaveLook(ctx, q, s, rgb); } });
  }
  window.addEventListener('nightcamp:online-snapshot', (event) => { selfId = event.detail?.snapshot?.self?.id || selfId; });
  window.addEventListener('nightcamp:online-event', (event) => {
    const data = event.detail, game = NC.game;
    if (!data || data.type !== 'knight' || data.kind !== 'wave' || !game || !NC.FX) return;
    const delay = Math.max(0, Number(data.delay) || 0);
    if (delay > 0 && NC.VFX?.at) NC.VFX.at(delay, () => fly(NC.game || game, data));
    else fly(game, data);
  });
})();
