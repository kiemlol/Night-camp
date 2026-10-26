/* baphrig.js — the world boss Baphomet (js/baphomet.js) moved by js/meshrig.js's auto rig (2026-10-16, the user:
   "ผมอยากให้บาโฟเม็ดใช้ auto rig" -> a mesh on the painted sprites with automatic weights). His four pictures (form 1
   standing / swinging, form 2 standing / swinging) keep their painting; each gets bones placed by eye on it (in the
   picture's pixels, he faces left) and the poses below bend them every frame:
     idle      breathing (chest, head a beat later), the cape and its rags waving (cape1 -> cape2 lagging), the loincloth,
               the tail swishing, the scythe swaying in his hand; form 2's trailing roots wave too
     chase     the body bobbing on each step, the legs stepping in turn, the cape streaming back
     winding   (before a sweep, a quake, a spin) leaning back, the scythe arm drawn up
     swing     (the swinging picture) the lunge settling, the scythe following through, the cape whipping
     roar      the head thrown back, the chest swelling, a shudder; hurt: a flinch; the change: trembling
   NC.BaphRig.draw(ctx, e, sprite, x, y, o) -> false when the rig can't draw (baphomet.js then draws the plain sprite).
   ?meshrig=0: the plain sprites. */
(function () {
  'use strict';
  const NC = window.NC, MR = NC.MeshRig;
  if (!MR) return;
  const B = (n, p, h, t) => ({ n, p, h, t });
  // form 1, standing (701 x 570)
  MR.def('baphomet', [
    B('hips', null, [360, 420], [350, 330]), B('spine', 'hips', [350, 330], [330, 250]),
    B('head', 'spine', [300, 240], [230, 175]), B('horn', 'head', [290, 180], [330, 90]),
    B('armF', 'spine', [285, 270], [185, 305]), B('scythe', 'armF', [185, 305], [110, 60]),
    B('staff', 'scythe', [185, 305], [245, 500]), B('blade', 'scythe', [110, 60], [440, 70]), B('bladeL', 'scythe', [100, 70], [40, 230]),
    B('armB', 'spine', [420, 300], [470, 410]),
    B('cape1', 'spine', [430, 240], [560, 300]), B('cape2', 'cape1', [560, 300], [690, 370]), B('capeLow', 'cape1', [500, 330], [530, 480]),
    B('cloth', 'hips', [340, 370], [330, 490]), B('tail', 'hips', [520, 450], [640, 470]),
    B('legF', null, [300, 440], [255, 545]), B('legB', null, [440, 445], [520, 545]),
  ]);
  // form 1, swinging (948 x 483)
  MR.def('baphomet_b', [
    B('hips', null, [530, 340], [500, 260]), B('spine', 'hips', [500, 260], [460, 200]),
    B('head', 'spine', [440, 200], [310, 170]), B('horn', 'head', [420, 120], [470, 30]),
    B('armF', 'spine', [420, 245], [330, 300]), B('scythe', 'armF', [330, 300], [150, 345]),
    B('staff', 'scythe', [330, 300], [600, 240]), B('blade', 'scythe', [150, 345], [440, 455]), B('bladeL', 'scythe', [140, 340], [30, 280]),
    B('armB', 'spine', [560, 210], [540, 275]),
    B('cape1', 'spine', [560, 150], [740, 135]), B('cape2', 'cape1', [740, 135], [930, 250]),
    B('cloth', 'hips', [520, 320], [560, 420]), B('tail', 'hips', [690, 300], [790, 330]),
    B('legF', null, [440, 370], [400, 455]), B('legB', null, [640, 360], [760, 460]),
  ]);
  // form 2, standing (888 x 600)
  MR.def('baphomet_root', [
    B('hips', null, [450, 440], [440, 340]), B('spine', 'hips', [440, 340], [430, 260]),
    B('head', 'spine', [420, 240], [330, 200]), B('horn', 'head', [400, 160], [470, 40]),
    B('hornL', 'head', [330, 150], [280, 110]), B('hornR', 'head', [470, 120], [610, 130]),
    B('armF', 'spine', [380, 285], [270, 320]), B('scythe', 'armF', [270, 320], [200, 60]),
    B('staff', 'scythe', [270, 320], [330, 510]), B('blade', 'scythe', [200, 60], [40, 140]), B('bladeL', 'scythe', [60, 150], [150, 410]),
    B('armB', 'spine', [560, 300], [610, 420]),
    B('cape1', 'spine', [520, 240], [610, 420]), B('cape2', 'cape1', [610, 420], [690, 550]), B('trail', 'cape1', [650, 420], [860, 560]),
    B('legF', null, [390, 470], [330, 580]), B('legB', null, [540, 470], [560, 580]),
  ]);
  // form 2, swinging (950 x 554)
  MR.def('baphomet_root_b', [
    B('hips', null, [470, 390], [440, 300]), B('spine', 'hips', [440, 300], [400, 230]),
    B('head', 'spine', [370, 220], [220, 210]), B('horn', 'head', [300, 130], [360, 20]),
    B('hornL', 'head', [230, 160], [160, 160]), B('hornR', 'head', [400, 100], [520, 90]),
    B('armF', 'spine', [380, 300], [320, 350]), B('scythe', 'armF', [320, 350], [130, 400]),
    B('staff', 'scythe', [320, 350], [460, 320]), B('blade', 'scythe', [130, 400], [380, 490]), B('bladeL', 'scythe', [120, 395], [20, 360]),
    B('armB', 'spine', [480, 270], [400, 330]),
    B('cape1', 'spine', [500, 180], [700, 230]), B('cape2', 'cape1', [700, 230], [930, 330]), B('trail', 'cape1', [650, 300], [900, 400]),
    B('capeLow', 'hips', [480, 330], [560, 440]),
    B('legB', null, [600, 420], [640, 520]),
  ]);

  const ease = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
  // the pose now: {bone: {r (radians, + = clockwise on screen), x, y (picture px), s}}
  function pose(e, sprite) {
    const P = {}, add = (n, r, x, y, s) => { const q = P[n] || (P[n] = { r: 0, x: 0, y: 0, s: 1 }); q.r += r || 0; q.x += x || 0; q.y += y || 0; if (s) q.s *= s; };
    const t = e.anim || 0, br = Math.sin(t * 2), swing = /_b$/.test(sprite);
    // idle: breathing, cloth and tail
    add('hips', 0, 0, br * 2.5);
    add('spine', br * 0.015, 0, 0, 1 + br * 0.006);
    add('head', Math.sin(t * 2 - 0.6) * 0.035);
    add('armF', Math.sin(t * 2 - 0.3) * 0.02); add('scythe', Math.sin(t * 1.3) * 0.03);
    add('armB', Math.sin(t * 2 + 1) * 0.05);
    add('cape1', Math.sin(t * 1.6) * 0.05); add('cape2', Math.sin(t * 1.6 - 0.9) * 0.1); add('capeLow', Math.sin(t * 1.7 - 0.5) * 0.06);
    add('trail', Math.sin(t * 1.4 - 1.2) * 0.07);
    add('cloth', Math.sin(t * 1.8 - 0.4) * 0.07); add('tail', Math.sin(t * 2.6) * 0.16);
    add('hornR', Math.sin(t * 2 - 1) * 0.02); add('hornL', Math.sin(t * 2 - 1.3) * 0.02);
    const st = e.state, winding = e.t < (e.wind || 0);
    if (st === 'chase' && !swing) { // walking: a bob on each step, the legs in turn, the cape streaming
      const w = Math.sin(t * 3.4);
      add('hips', 0, 0, -Math.abs(w) * 8);
      add('legF', w * 0.1); add('legB', -w * 0.1);
      add('cape1', 0.06 + w * 0.03); add('cape2', 0.1 + Math.sin(t * 3.4 - 1) * 0.08); add('trail', 0.06 + Math.sin(t * 3.4 - 1.4) * 0.06);
      add('head', Math.sin(t * 6.8) * 0.02); add('tail', Math.sin(t * 3.4 - 0.5) * 0.1);
    }
    if (winding && !swing && (st === 'sweep' || st === 'quake' || st === 'spin' || st === 'spikes' || st === 'whip')) {
      const u = ease(e.t / e.wind); // leaning back, the scythe drawn up
      add('spine', 0.1 * u); add('armF', 0.2 * u); add('scythe', 0.12 * u); add('head', 0.05 * u);
      add('cape2', 0.12 * u); add('hips', 0, 4 * u, 3 * u);
    }
    if (swing) { // the lunge settles, the scythe follows through, the cape whips
      const a = Math.max(0, e.t - (e.wind || 0)), k = Math.exp(-a * 5);
      add('spine', -0.07 * k); add('scythe', -0.16 * k + Math.sin(a * 14) * 0.03 * k); add('armF', -0.08 * k);
      add('cape1', 0.08 * k); add('cape2', 0.22 * k * Math.cos(a * 16)); add('trail', 0.15 * k * Math.cos(a * 13));
      add('hips', 0, -10 * k, 0); add('head', -0.04 * k);
    }
    if (st === 'roar') { // the head thrown back, the chest swelling, a shudder
      const u = Math.min(1, e.t / 0.3) * Math.max(0, Math.min(1, (1.4 - e.t) / 0.3));
      add('head', 0.14 * u); add('spine', 0.06 * u, 0, 0, 1 + 0.03 * u); add('hips', 0, Math.sin(t * 50) * 2.5 * u, 0);
      add('cape1', 0.1 * u); add('cape2', 0.18 * u * Math.sin(t * 9));
    }
    if (e.changing) { // trembling as the roots climb him
      const u = Math.min(1, e.t / 1.4);
      add('spine', Math.sin(t * 38) * 0.025 * u); add('head', 0.1 * u + Math.sin(t * 31) * 0.03 * u);
      add('cape2', Math.sin(t * 12) * 0.2 * u); add('trail', Math.sin(t * 10) * 0.2 * u); add('armF', -0.05 * u);
    }
    if (e.flash > 0) { add('head', 0.07); add('spine', 0.04); } // (a flinch)
    return P;
  }
  MR.warm(['baphomet', 'baphomet_b', 'baphomet_root', 'baphomet_root_b']);
  NC.BaphRig = {
    pose,
    draw: (ctx, e, sprite, x, y, o) => MR.draw(ctx, sprite, x, y, o, pose(e, sprite)),
  };
})();
