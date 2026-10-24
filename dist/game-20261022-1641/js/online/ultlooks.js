/* online/ultlooks.js — the looks of the puppeteer's and the wisp shepherd's buffed ultimates online (?online; js/ultbuff.js,
   the server's patch 019 ult_buff.go). The server holds, strikes and bursts; a cast only draws its stage / night
   (js/ultbuff.js), and the events below draw what the server alone knows, with the same light kit pieces as offline:
     puppeteer theatreYank { from: [[x, y]...] }  the threads from where each monster stood to the caster's hand
     puppeteer curtain { at: [[x, y]...] }       ปิดม่าน: the words, the closing ring, a burst on each
     combat pp_theatre with kin                   a held monster's blow on its neighbour (the hooked monster's slash)
     wisp rain { at, gap }                        a wisp diving onto each monster in the night, one after another
     wisp markBursts { targetIds }                the night's mark bursts of the last tick
   (the night's shield soak comes as the wisp's own 'soak', js/online-wisp.js). Load after online/world.js. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld;
  if (!O || !O.enabled || !W || !NC.ULT_BUFF) return;
  const FX = NC.FX, V = NC.VFX, LK = NC.LightKit, K = NC.SkillKit;
  const THREAD = '215,195,255', THREAD_HEX = '#d7c3ff', WISP_HEX = '#8cffdc', HAND_LIFT = 60;
  const heroOf = (id) => { const g = W.game; if (!g) return null; if (id && id === W.me) return g.player; return (O.remotes && O.remotes.get(id)) || null; };
  const mob = (id) => { const g = W.game; return g ? (g.enemies || []).find((e) => e.id === id && !(e.dead > 0)) : null; };

  function yank(ev) {
    const p = heroOf(ev.actorId), [hx, hy] = p ? K.tip(p) : [ev.x, ev.y - HAND_LIFT];
    for (const [x, y] of ev.from || []) if (LK) LK.line(x, y - HAND_LIFT, hx, hy, { col: THREAD_HEX, life: 0.3, w: 6 });
    FX.text(p ? p.x : ev.x, (p ? p.y : ev.y) - 235, 'กระตุกด้าย!', `rgb(${THREAD})`, 26);
  }
  function curtain(ev) {
    const p = heroOf(ev.actorId), x = p ? p.x : ev.x, y = p ? p.y : ev.y;
    FX.text(x, y - 215, 'ปิดม่าน!', `rgb(${THREAD})`, 36);
    if (LK) LK.ring(x, y, { r0: 900, r1: 60, col: THREAD_HEX, life: 0.45, a: 0.8 });
    if (ev.actorId === W.me && W.game) V.shake(W.game, 8);
    (ev.at || []).forEach(([ax, ay], i) => V.at(0.12 + i * 0.03, () => { if (LK) LK.burst(ax, ay - 50, { k: 0.6, col: THREAD_HEX, n: 6, spark: 4 }); }));
  }
  function rain(ev) {
    const gap = Number(ev.gap) || 0.035;
    (ev.at || []).forEach(([x, y], i) => V.at(i * gap, () => { if (LK) LK.pillar(x, y, { w: 34, h: 520, life: 0.4, col: WISP_HEX, drop: true, impact: true }); }));
  }
  W.eventHooks.push((ev) => {
    if (!ev) return;
    if (ev.type === 'combat' && ev.skillId === 'pp_theatre' && ev.kin) { const e = mob(ev.targetId); if (e && NC.PuppetLooks) NC.PuppetLooks.charmStrike(e); return; }
    if (ev.type === 'puppeteer') { if (ev.kind === 'theatreYank') yank(ev); else if (ev.kind === 'curtain') curtain(ev); return; }
    if (ev.type === 'wisp') {
      if (ev.kind === 'rain') rain(ev);
      else if (ev.kind === 'markBursts' && NC.WispLooks) for (const id of ev.targetIds || []) { const e = mob(id); if (e) NC.WispLooks.markBurst(e); }
    }
  });
})();
