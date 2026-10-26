/* The web online client's side of the gunslinger's rounds (server/server/job_gunslinger.go gunRoundEvent, gunLandedEvent;
   2026-10-25). Offline the hero's own round marks its first landed hit itself (js/jobs3_skills_b.js:284 a NC.basicHits
   hook: the sixth's ring, the boom spin's burst, the pierce spin's cut of light), which never runs online: there the
   server decides the round and sends {type:'gunslinger', kind:'landed', actorId, targetId, x, y, aim, sixth?, spin?},
   drawn here at the struck monster (the boom's and the pierce's blows are its gs_boom / gs_pierce combat events).
   {kind:'round', dud?, click?} is a round that never left: the local hero's own shotFired already shows it from the
   server's meters (its gsSpin, gsReload), so only another gunslinger's is shown, over that hero, at a share. */
(function () {
  const NC = window.NC;
  const SIXTH_FILL = '#ff9a6a', SIXTH_RGB = '255,140,90', BOOM_RGB = '255,160,90', PIERCE_RGB = '200,235,255'; // jobs3_skills_b.js:287-294
  const BOOM_R = 150, PIERCE_LEN = 500;
  let selfId = '';
  const heroOf = (game, id) => (id && id === selfId ? game.player : NC.Online?.remotes?.get(id) || null);

  function landed(game, data) {
    const V = NC.VFX, K = NC.SkillKit, FX = NC.FX;
    const e = (game.enemies || []).find((m) => (m.sid || m.id) === data.targetId);
    const x = e ? e.x : Number(data.x), y = e ? e.y : Number(data.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !V || !FX) return;
    if (data.sixth) { FX.text(x, (e && NC.labelTop ? NC.labelTop(e) : y - 150) - 90, 'นัดที่หก!', SIXTH_FILL, 32); V.ring(x, y - 50, 10, 110, 7, SIXTH_RGB, 0.3); }
    if (data.spin === 'boom' && K) V.at(0.02, () => K.burst(NC.game || game, x, y, BOOM_R, BOOM_RGB, { shake: 5, sparks: 10 }));
    if (data.spin === 'pierce') {
      const a = Number(data.aim) || 0;
      FX.add({ type: 'cutline', x, y: y - 50, x1: x + Math.cos(a) * PIERCE_LEN, y1: y - 50 + Math.sin(a) * PIERCE_LEN, w: 5, color: PIERCE_RGB, life: 0.2 });
    }
  }
  function round(game, data) {
    if (data.actorId === selfId || !(data.dud || data.click)) return; // (mine: shotFired, from the meters)
    const p = heroOf(game, data.actorId), V = NC.VFX, FX = NC.FX;
    if (!p || !FX) return;
    const x = p.x + Math.cos(Number(p.aim) || 0) * 60, y = p.y - 90;
    if (data.click) { FX.text(x, y - 30, 'แชะ', '#cfc6b8', 22); return; }
    if (V) V.smoke(x, y, 3, '#6a6470', '#8a8490', { size: 0.5, lifeK: 0.5, a: 0.7 });
    FX.text(x, y - 30, 'ด้าน...', '#cfc6b8', 26);
  }
  window.addEventListener('nightcamp:online-snapshot', (event) => { selfId = event.detail?.snapshot?.self?.id || selfId; });
  window.addEventListener('nightcamp:online-event', (event) => {
    const data = event.detail, game = NC.game;
    if (!data || data.type !== 'gunslinger' || !game) return;
    const mine = data.actorId === selfId;
    const show = () => (data.kind === 'landed' ? landed(game, data) : data.kind === 'round' ? round(game, data) : null);
    if (mine || !NC.OtherFX) show(); else NC.OtherFX.run(show); // (another's: at a share, js/otherfx.js)
  });
})();
