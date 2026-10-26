/* maps.js — the map list, classic MMO style: the camp in the middle and hunting fields around it, joined by warps
   at the map edges. Walk into a warp and the next map loads (a short fade), the minimap and the map name change,
   and the map you are on (and where) is remembered. Field layouts are drawn by fieldgen.js from the numbers here;
   the camp is world.js, which cuts the roads to its exits (NC.MAPS.camp.exits). */
(function () {
  'use strict';
  const NC = window.NC;
  const SAVE_KEY = 'nightcamp.map.v1';
  // how many monsters every map has, times its numbers below (the fields' spawns, the camp's NC.ENEMY_SPAWNS)
  NC.MOB_MULT = 4;

  NC.MAPS = {
    camp: {
      name: 'ค่ายกลางป่า', lvText: 'Lv 1–10',
      // exits through the camp's forest: world.js adds a road to each and the warp at its end
      exits: [
        { id: 'west', x: 130, y: 1640, to: 'meadow', at: 'east', road: [[700, 1700], [420, 1668], [80, 1640]] },
        { id: 'north', x: 1395, y: 140, to: 'woods', at: 'east', road: [[1450, 1080], [1418, 640], [1395, 70]] },
        { id: 'south', x: 3062, y: 3150, to: 'canyon', at: 'north' }, // the old road out of the ruins' south gate
      ],
    },

    meadow: {
      name: 'ทุ่งหญ้าแสงจันทร์', lvText: 'Lv 8–18', biome: 'meadow', W: 5600, H: 3800, seed: 11,
      lv: { slime: [8, 16], hollow: [12, 18] },
      spawns: [['slime', 22], ['hollow', 9]],
      warps: [
        { id: 'east', x: 5470, y: 1900, to: 'camp', at: 'west' },
        { id: 'north', x: 1900, y: 130, to: 'woods', at: 'south' },
      ],
      roads: [
        { w: 86, pts: [[5560, 1900], [5000, 1950], [4400, 1820], [3800, 1900], [3300, 1960], [2800, 1850], [2350, 1500], [2050, 1000], [1920, 500], [1900, 40]] },
        { w: 66, pts: [[3300, 1960], [3050, 2400], [2500, 2750], [1800, 2950], [1300, 3050]] },
        { w: 56, pts: [[3800, 1900], [3860, 1450], [3920, 1050]] },
      ],
      ponds: [
        { x: 960, y: 3060, rx: 480, ry: 280, lilies: 16 }, { x: 4520, y: 2920, rx: 340, ry: 190, lilies: 8 },
        { x: 780, y: 1320, rx: 260, ry: 150, lilies: 5 },
      ],
      landmarks: [
        ['m_windmill', 4350, 1350], ['m_cottage', 3500, 1480], ['m_cottage', 3040, 1420, { flip: true }], ['m_well', 3280, 1680],
        ['m_haystack', 4650, 1500], ['m_haystack', 4800, 1580, { scale: 0.9, flip: true }], ['m_haystack', 4150, 1600, { scale: 0.85 }],
        ['m_apple', 2720, 1150], ['m_apple', 4950, 1150, { flip: true }],
      ],
      fences: [['m_fence', 4480, 5000, 1700]],
      safe: [[2750, 950, 5100, 1760]],
      zones: [
        { name: 'หมู่บ้านกังหันลม', rect: [2750, 950, 5100, 1760] },
        { name: 'บึงบัวใต้จันทร์', rect: [300, 2500, 2000, 3700] },
      ],
    },

    woods: {
      name: 'ป่าเห็ดเรืองแสง', lvText: 'Lv 25–40 · บอส Lv 50', biome: 'woods', W: 5200, H: 4000, seed: 23,
      lv: { slime: [25, 31], hollow: [30, 36], mushling: [32, 38], mushking: [50, 50] },
      spawns: [['hollow', 16], ['slime', 12]],
      // the boss: ราชาเห็ดเรืองแสง (boss.js) sleeps in a clearing ringed by giant glowing mushrooms
      bosses: [['mushking', 3950, 780]],
      clear: [{ x: 3950, y: 760, r: 500, glow: true }],
      rings: [{ x: 3950, y: 760, r: 430, names: ['w_shrooms_small', 'w_glowflowers'], n: 30, gap: [1.3, 2.2] }],
      warps: [
        { id: 'south', x: 1900, y: 3870, to: 'meadow', at: 'north' },
        { id: 'east', x: 5070, y: 2000, to: 'camp', at: 'north' },
      ],
      roads: [
        { w: 64, pts: [[1900, 3960], [1950, 3400], [2250, 2900], [2700, 2550], [3300, 2250], [3900, 2100], [4500, 2020], [5160, 2000]] },
        { w: 58, pts: [[2700, 2550], [2300, 2050], [1800, 1550], [1450, 1150]] },
        { w: 52, pts: [[3300, 2250], [3550, 1600], [3800, 1000]] },
        { w: 52, pts: [[1950, 3400], [1300, 3100], [800, 2600]] },
      ],
      ponds: [{ x: 3600, y: 3200, rx: 380, ry: 210, lilies: 6 }],
      lanterns: ['w_lantern', 560],
      landmarks: [
        ['w_shroomhouse', 1350, 1050], ['w_shroomhouse', 1850, 1280, { flip: true, scale: 0.9 }],
        ['w_glowshroom', 1100, 1300], ['w_shrooms3', 1600, 900], ['w_glowshroom', 2100, 1100, { scale: 0.8, flip: true }],
        ['w_stump', 1550, 1450],
        // around the boss arena (the trail comes in from the south-west)
        ['w_glowshroom', 3420, 640, { scale: 1.1 }], ['w_shrooms3', 3560, 390], ['w_glowshroom', 3900, 300, { scale: 1.25 }],
        ['w_shrooms3', 4250, 380, { flip: true }], ['w_glowshroom', 4490, 620, { flip: true, scale: 1.1 }],
      ],
      safe: [[1000, 750, 2250, 1550], [3350, 250, 4650, 1350]],
      zones: [
        { name: 'หมู่บ้านเห็ดพราย', rect: [1000, 700, 2250, 1600] },
        { name: 'ลานราชาเห็ด', rect: [3350, 250, 4650, 1300] },
        { name: 'บึงเงาจันทร์', rect: [3100, 2850, 4150, 3600], lv: { slime: [34, 38], hollow: [34, 40] } },
      ],
    },

    canyon: {
      name: 'ผาหินแดง', lvText: 'Lv 60–72', biome: 'canyon', W: 4600, H: 3200, seed: 37,
      lv: { slime: [60, 66], hollow: [66, 72] },
      spawns: [['hollow', 14], ['slime', 8]],
      warps: [{ id: 'north', x: 2300, y: 130, to: 'camp', at: 'south' }],
      roads: [
        { w: 78, pts: [[2300, 50], [2280, 600], [2060, 1150], [2150, 1650], [2600, 2000], [3200, 2250], [3700, 2450]] },
        { w: 64, pts: [[2060, 1150], [1500, 1480], [1020, 1900], [720, 2500]] },
      ],
      mesas: [
        { x: 1000, y: 850, rx: 470, ry: 250, deco: 6 }, { x: 3520, y: 800, rx: 560, ry: 280, deco: 8 },
        { x: 3150, y: 1480, rx: 250, ry: 140, deco: 3 }, { x: 1560, y: 2620, rx: 380, ry: 200, deco: 4 },
        { x: 4180, y: 1960, rx: 270, ry: 210, deco: 4 },
      ],
      ponds: [{ x: 2480, y: 2760, rx: 250, ry: 140 }],
      landmarks: [
        ['c_shack', 3780, 2330], ['c_minecart', 3480, 2560], ['c_minecart', 4040, 2600, { flip: true }],
        ['c_crystals', 3620, 2720], ['c_crystals', 4180, 2420, { scale: 1.2 }], ['c_crystals', 3300, 2400, { scale: 0.8 }],
        ['c_sign', 2200, 1080], ['c_spire', 2750, 1150], ['c_spire', 1750, 2050, { flip: true, scale: 0.9 }],
      ],
      safe: [[3250, 2150, 4400, 2900]],
      zones: [
        { name: 'เหมืองร้างผลึกส้ม', rect: [3200, 2100, 4450, 2950] },
      ],
    },
  };

  // spawn levels: a field's zones carry their own level table (the camp's come from stats.js)
  const baseLevel = NC.spawnLevel;
  NC.spawnLevel = function (world, type, x, y) {
    const z = world && world.zones ? world.zones.find((zn) => zn.test(x, y)) : null;
    const map = world && world.field && NC.MAPS[world.field].lv;
    const r = (z && z.lv && z.lv[type]) || (map && map[type]);
    if (r) return Math.round(NC.rand(r[0], r[1]));
    return baseLevel ? baseLevel(world, type, x, y) : 1;
  };

  // built maps are kept (switching back is instant); only the last few, each holds two big ground canvases
  const cache = new Map(), KEEP = 3;
  const worldOf = (id) => {
    let w = cache.get(id);
    if (w) cache.delete(id);
    else {
      const def = NC.MAPS[id];
      w = id === 'camp' ? NC.buildWorld() : NC.buildField(Object.assign({ id }, def));
      w.mapId = id;
    }
    cache.set(id, w); // most recent last
    while (cache.size > KEEP) cache.delete(cache.keys().next().value);
    return w;
  };

  // Resume the saved map, or start at the camp.
  let startPos = null;
  function first(game, params) {
    let id = 'camp';
    startPos = null;
    if (!NC.ONLINE) {
      try {
        const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
        if (s && NC.MAPS[s.map]) { id = s.map; startPos = [s.x, s.y]; }
      } catch (e) { /* no save */ }
    }
    game.mapId = id;
    return worldOf(id);
  }
  function startAt(world) {
    if (startPos && world.fits(startPos[0], startPos[1], 20)) return startPos;
    return [world.spawn.x, world.spawn.y];
  }

  // what game.js keeps as portals: the camp's pair (each jumps to the other) and the warps to other maps
  function portals(world) {
    const out = (world.portals || []).map((pt, i) => ({ x: pt.x, y: pt.y, charge: 0, cool: false, link: i ^ 1 }));
    for (const w of world.warps || [])
      out.push({ x: w.x, y: w.y, charge: 0, cool: false, id: w.id, to: w.to, at: w.at, name: NC.MAPS[w.to].name, lvText: NC.MAPS[w.to].lvText });
    return out;
  }
  function monsters(world) {
    return campSpawns(world).map(([type, x, y]) => NC.makeEnemy(type, x, y, NC.spawnLevel(world, type, x, y)));
  }
  // the fields place NC.MOB_MULT times their numbers themselves (fieldgen.js); the camp's hand-placed spots each get
  // company: the same monster a little way round it, where it can stand (always the same places), never nearer the
  // middle of the camp (where the hero starts) than 520
  function campSpawns(world) {
    if (world.spawns) return world.spawns;
    const out = [], k = Math.max(1, Math.round(NC.MOB_MULT || 1)), home = world.spawn || { x: -1e4, y: -1e4 };
    (NC.ENEMY_SPAWNS || []).forEach(([type, x, y], i) => {
      out.push([type, x, y]);
      for (let j = 1; j < k; j++)
        for (let t = 0; t < 8; t++) {
          const a = ((j - 1) / (k - 1)) * Math.PI * 2 + i * 0.9 + t * 0.7, d = 150 + ((i * 37 + j * 53 + t * 29) % 90);
          const sx = Math.round(x + Math.cos(a) * d), sy = Math.round(y + Math.sin(a) * d * 0.7);
          if (Math.hypot(sx - home.x, sy - home.y) < 520 || !world.fits(sx, sy, 34) || out.some((s) => Math.hypot(s[1] - sx, s[2] - sy) < 90)) continue;
          out.push([type, sx, sy]); break;
        }
    });
    return out;
  }

  function save(game) {
    if (!game || !game.player || game.noSave) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ map: game.mapId || 'camp', x: Math.round(game.player.x), y: Math.round(game.player.y) }));
    } catch (e) { /* storage full or blocked */ }
  }
  setInterval(() => save(NC.game), 5000);
  addEventListener('beforeunload', () => save(NC.game));

  // the fade shown while the next map is built
  let veil = null;
  function curtain() {
    if (veil) return veil;
    veil = document.createElement('div');
    veil.style.cssText = 'position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'background:#120f1c;opacity:0;pointer-events:none;transition:opacity .28s ease;color:#f3e7cf;font-family:Mitr,sans-serif;';
    veil.innerHTML = '<div style="font-size:clamp(22px,3.2vw,44px);font-weight:600;letter-spacing:.02em"></div>' +
      '<div style="font-size:clamp(14px,1.6vw,22px);opacity:.7;margin-top:.4em"></div>';
    document.body.appendChild(veil);
    return veil;
  }

  function enter(game, id, at) {
    const prev = game.world, world = worldOf(id), p = game.player;
    game.world = world; game.mapId = id;
    const w = (world.warps || []).find((v) => v.id === at);
    p.x = w ? w.ax : world.spawn.x; p.y = w ? w.ay : world.spawn.y;
    p.vx = p.vy = 0; p.sort = p.y;
    game.portals = portals(world);
    for (const pt of game.portals) if (pt.id === at) pt.cool = true;
    game.enemies = NC.Maps.monsters(world);
    game.respawns = []; game.loot = []; game.flies = [];
    if (NC.FX && NC.FX.list) NC.FX.list.length = 0;
    // The pending judgment lived in FX.list. Release its guard when the
    // callback is cancelled, retaining faith for the next heal in this map.
    p._ssBusy = false;
    game.target = null; game.hover = null; game.hitstop = 0; game.shake = 0;
    game.zoneName = '';
    game.cam.x = NC.clamp(p.x - game.vw / 2, 0, world.W - game.vw);
    game.cam.y = NC.clamp(p.y - 60 - game.vh / 2, 0, world.H - game.vh);
    if (NC.HUD.mapChanged) NC.HUD.mapChanged(game, prev); // the minimap's fog of this map
    if (NC.Party) NC.Party.onMap(game); // the party comes along
    if (NC.Graphics) NC.Graphics.sceneChanged();
    if (NC.Gfx?.sceneChanged) NC.Gfx.sceneChanged();
    save(game);
  }

  let busy = false;
  function go(game, id, at) {
    if (busy || !NC.MAPS[id]) return;
    busy = true;
    const perf = NC.Perf?.enabled ? NC.Perf : null, previousPhase = perf?.phase;
    if (perf) { perf.mark('map-transfer-start', { from: game.mapId, to: id }); perf.setPhase('map-loading'); }
    const v = curtain();
    v.children[0].textContent = NC.MAPS[id].name;
    v.children[1].textContent = NC.MAPS[id].lvText || '';
    v.style.opacity = 1;
    const was = game.paused;
    game.paused = true; game.warping = true; // (warping: the world holds even behind an open window, js/keeprun.js)
    setTimeout(() => {
      try { enter(game, id, at); } finally {
        game.paused = was; game.warping = false; busy = false;
        if (perf) {
          perf.mark('map-transfer-end', { mapId: game.mapId });
          perf.setPhase(NC.Online?.active && !NC.Online.ready ? 'map-loading' : was ? 'paused' : previousPhase === 'warmup' ? 'warmup' : 'active');
        }
        setTimeout(() => { v.style.opacity = 0; }, 120);
      }
    }, 300);
  }

  // the destination's name over each warp while the hero is near (world space, drawn after the lighting)
  function drawLabels(ctx, game) {
    const p = game.player;
    for (const pt of game.portals) {
      if (!pt.to) continue;
      const d = Math.hypot(pt.x - p.x, pt.y - p.y);
      if (d > 900) continue;
      const a = NC.clamp((900 - d) / 300, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.font = '600 34px Mitr, sans-serif';
      const y = (pt.y < 330 ? pt.y + 120 : pt.y - 150) + Math.sin(game.time * 2) * 4; // under a warp at the top edge
      ctx.lineWidth = 9; ctx.strokeStyle = NC.OUTLINE; ctx.strokeText(pt.name, pt.x, y);
      ctx.fillStyle = '#fff4d8'; ctx.fillText(pt.name, pt.x, y);
      if (pt.lvText) {
        ctx.font = '500 24px Mitr, sans-serif';
        ctx.lineWidth = 7; ctx.strokeText(pt.lvText, pt.x, y + 34);
        ctx.fillStyle = '#9fe0ff'; ctx.fillText(pt.lvText, pt.x, y + 34);
      }
      ctx.restore();
    }
  }

  NC.Maps = { world: worldOf, first, startAt, portals, monsters, go, enter, save, drawLabels };
})();
