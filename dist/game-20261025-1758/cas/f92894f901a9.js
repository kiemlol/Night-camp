/* The web online client's side of the outfit sets' guards (js/setfx.js; server/server/equipment_set_runtime.go,
   2026-10-24, docs/team/online-missing-looks.md). Offline setfx.js's hurt guards draw them as the hero is struck; online
   the hero is never struck here (online/world.js turns NC.hurtPlayer off), the server guards and sends
   {type:'setfx', sourceId, effect, fire, x, y} for each: block (กันได้!), shield (โล่!), shell (หดในกระดอง!), gel (the gel
   shield's ring) and revive (ฟื้นคืน!, in fire for the phoenix set), drawn as setfx.js draws them on that hero. */
(function () {
  const NC = window.NC;
  // js/setfx.js:178, :186-187, :190, :192, :206-208
  const LOOKS = {
    block: { ring: [20, 110, 6, '190,240,255', 0.4], text: ['กันได้!', 150, '#bfefff', 26] },
    shield: { ring: [20, 130, 8, '255,230,150', 0.5], text: ['โล่!', 160, '#ffe7a6', 28] },
    shell: { text: ['หดในกระดอง!', 160, '#b6f0a0', 26] },
    gel: { ring: [16, 100, 6, '140,220,255', 0.4] },
  };
  let selfId = '';
  const heroOf = (game, id) => (id && id === selfId ? game.player : NC.Online?.remotes?.get(id) || null);

  function draw(game, data) {
    const V = NC.VFX, FX = NC.FX, who = heroOf(game, data.sourceId);
    const x = who ? who.x : Number(data.x), y = who ? who.y : Number(data.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !V || !FX) return;
    if (data.effect === 'revive') {
      const fire = !!data.fire;
      V.ring(x, y - 40, 20, 180, 10, fire ? '255,160,80' : '255,240,200', 0.6);
      FX.stars(x, y - 80, 14, fire ? '255,170,90' : '255,240,200', { speed: 260 });
      FX.num(x, y - 170, 'ฟื้นคืน!', { fill: '#ffe7a6', size: 34 });
      return;
    }
    const L = LOOKS[data.effect];
    if (!L) return;
    if (L.ring) V.ring(x, y - 40, ...L.ring);
    if (L.text) FX.num(x, y - L.text[1], L.text[0], { fill: L.text[2], size: L.text[3] });
  }
  window.addEventListener('nightcamp:online-snapshot', (event) => { selfId = event.detail?.snapshot?.self?.id || selfId; });
  window.addEventListener('nightcamp:online-event', (event) => {
    const data = event.detail, game = NC.game;
    if (data && data.type === 'setfx' && game) draw(game, data);
  });
})();
