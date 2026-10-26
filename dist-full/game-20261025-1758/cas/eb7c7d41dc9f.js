/* The web online client's side of the rogue's steal (js/skills_t1.js RUN.ro_steal; server/server/skills_t1.go, 2026-10-24,
   docs/team/online-missing-looks.md). Offline the skill rolls its chance and adds the monster's material itself; online
   the server rolls and keeps it, and its {type:'steal', actorId, targetId, itemId, ok} says how it went: the skill's own
   look (the hit and the slash) plays on the press and no longer rolls online, and this shows the result as the
   offline skill does: พลาด, or ขโมยได้! with the stars and, for your own steal, the log line. */
(function () {
  const NC = window.NC;
  let selfId = '';
  window.addEventListener('nightcamp:online-snapshot', (event) => { selfId = event.detail?.snapshot?.self?.id || selfId; });
  window.addEventListener('nightcamp:online-event', (event) => {
    const data = event.detail, game = NC.game, FX = NC.FX;
    if (!data || data.type !== 'steal' || !game || !FX) return;
    const e = (game.enemies || []).find((m) => (m.sid || m.id) === data.targetId);
    const x = e ? e.x : Number(data.x), y = e ? e.y : Number(data.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (!data.ok) { FX.num(x, y - 170, 'พลาด', { fill: '#cfd8ff', size: 28 }); return; } // skills_t1.js:309
    FX.num(x, y - 170, 'ขโมยได้!', { fill: '#ffd873', size: 32 }); // :315-317
    if (NC.VFX && NC.VFX.stars) NC.VFX.stars(x, y - 80, 8, '#ffe68a', (NC.SkillKit && NC.SkillKit.C && NC.SkillKit.C.gold) || '255,215,90', { speed: 200 });
    if (data.actorId === selfId && NC.HUD) {
      const M = NC.MATERIALS && NC.MATERIALS[data.itemId];
      NC.HUD.log(`ขโมย ${M ? M.name : 'ของ'} ได้ ×1`, 'item');
    }
  });
})();
