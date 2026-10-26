/* mmreal.js — the minimap and the map window's "แมพนี้" drawn from the real map (the user, 2026-10-17: "เอาแมพจริงมาทำ
   มินิแมพในเกม"; with js/wmreal.js for the world tabs). Instead of minimap.js's map art (the day ground with round tree
   crowns and roof boxes painted on it): the map itself seen from above in daylight, its ground, decals, props and walls,
   1 px = 5 units as before, so minimap.js's markers and fog sit on it unchanged. The props go down a few milliseconds a
   frame (a map change does not hitch); the big view draws the rest at once. shop.js's coin goes on once the props are
   down; life_wood.js still drops the art to redraw a felled tree. ?mmreal=0: minimap.js's own art. Load after js/minimap.js. */
(function () {
  'use strict';
  const NC = window.NC, H = NC.HUD;
  if (!H || !H.drawMap) return;
  const ART = 5, BUDGET = 4; // (minimap.js's 1 px = 5 units; ms of drawing a frame)
  const sortKey = (o) => (o.sort != null ? o.sort : o.y != null ? o.y : o.by);

  function begin(world) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(world.W / ART); cv.height = Math.ceil(world.H / ART);
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    const g = world.groundDay || world.ground;
    if (g) c.drawImage(g, 0, 0, cv.width, cv.height);
    const things = (world.props || []).filter((p) => NC.SPR[p.name]).concat(world.blocks || []);
    things.sort((a, b) => sortKey(a) - sortKey(b));
    cv.real = { c, i: 0, list: (world.decals || []).map((d) => ({ decal: d })).concat(things) };
    cv.shopMarked = true; // (shop.js: no coin until the props are down)
    world.mapArt = cv;
  }
  function step(world, all) {
    const cv = world.mapArt, J = cv && cv.real;
    if (!J || J.i >= J.list.length) return;
    const c = J.c, t0 = performance.now();
    c.setTransform(1 / ART, 0, 0, 1 / ART, 0, 0);
    while (J.i < J.list.length && (all || performance.now() - t0 < BUDGET)) {
      // (a picture still streaming in, js/assets.js: the drawing waits for it, in order; NC.drawSpr has asked for it)
      const o = J.list[J.i], sn = o.decal ? o.decal.name : o.name, sp = sn && NC.SPR[sn];
      if (sp && sp.ready === false) { NC.Sprites.want(sn); break; }
      J.i++;
      if (o.decal) NC.drawSpr(c, o.decal.name, o.decal.x, o.decal.y);
      else if (o.art) c.drawImage(o.art.cv, o.bx - o.art.pad, o.by - world.blockH - o.art.pad, o.art.w, o.art.h);
      else NC.drawSpr(c, o.name, o.x, o.y, { flip: o.flip, scale: o.scale });
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (J.i >= J.list.length) cv.shopMarked = false;
  }

  // the fog (minimap.js world.fogArt: unseen cells opaque, seen ones clear): unseen ground dimmed, not hidden, so the map
  // shows before we walk it; what we have seen stays bright
  const FOG_A = 150;
  function dimFog(world) {
    const F = world.fogArt;
    if (!F || F.dimmed) return;
    for (let i = 0; i < F.w * F.h; i++) if (!F.seen[i]) F.img.data[i * 4 + 3] = FOG_A;
    F.dimmed = true; F.dirty = true;
  }

  const base = H.drawMap;
  H.drawMap = function (ctx, w, h, game) {
    const world = game && game.world;
    if (world && world.W && (world.groundDay || world.ground)) {
      if (!world.mapArt || !world.mapArt.real) begin(world); // (a new map, an art another file built, or one dropped to redraw)
      step(world, ctx.canvas.id !== 'minimap');
    }
    const out = base.apply(this, arguments);
    if (world) dimFog(world); // (made by the first draw; it shows dimmed from the next frame)
    return out;
  };
})();
