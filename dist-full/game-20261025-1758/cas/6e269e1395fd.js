/* pvparena.js — the PvP duel arena "เวทีประลองกลางทะเลสาบ" (the user picked mockup C, 2026-10-02): a round stone-and-
   plank platform standing in a calm moonlit lake, a plank bridge in from the south, lantern posts and torches round it,
   rocks, reeds and floating lanterns on the water, pines on the far shore. Always night.
   The ground is ONE painted plate (assets/pvp/pvp_lake_plate.jpg, made by assets/gen/make_pvparena2_prompts.py) instead
   of fieldgen's painted ground; only the platform and the bridge can be walked on. The props are cut from two magenta
   sheets (tools/cutout.py --dir pvp --manifest pvp.manifest.js). The water glints drift (NC.drawWater wrapped).
   Reached from the camp's east edge past the training ground (NC.MAPS.camp.exits 'arena'); ?map=pvp_lake.
   NC.PVP_ARENA: where the stage is (pvp.js draws the duel's ring of fire on it, squashed like the plate's camera). */
(function () {
  'use strict';
  const NC = window.NC, TAU = Math.PI * 2;
  if (NC.ASSET_MANIFEST_PVP) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_PVP);
  const ID = 'pvp_lake', W = 2600, H = 1733, CELL = 10;
  // the platform's top as seen on the plate (an ellipse: the plate's camera is a little flatter than the game's 0.58)
  const STAGE = { x: 1300, y: 668, rx: 925, ry: 365 };
  const BRIDGE = { x0: 1105, x1: 1500, y0: 1000, y1: H };
  NC.PVP_ARENA = { id: ID, x: STAGE.x, y: STAGE.y, rx: STAGE.rx, ry: STAGE.ry, sq: STAGE.ry / STAGE.rx, ring: 700, ringMin: 260,
    starts: [[STAGE.x - 470, STAGE.y + 10], [STAGE.x + 470, STAGE.y + 10]] };

  NC.MAPS[ID] = {
    name: 'เวทีประลองกลางทะเลสาบ', lvText: 'ลานประลอง · PvP', W, H, lifeSafe: true, pvp: true, spawns: [], bots: [],
    warps: [{ id: 'camp', x: 1300, y: 1650, to: 'camp', at: 'arena' }],
  };
  // the camp's way east, past the training ground (camp.js builds roads and warps from NC.MAPS.camp.exits)
  const camp = NC.MAPS.camp;
  if (camp && camp.exits && !camp.exits.some((e) => e.id === 'arena'))
    camp.exits.push({ id: 'arena', x: 2950, y: 1250, to: ID, at: 'camp', road: [[2700, 1355], [2840, 1290], [2960, 1250], [3040, 1250]] });

  // how each prop stands: kind = what it blocks and its shadow; light: [x, y as fractions of w / h from the feet, radius, rgb]
  const PROPS = {
    pv_torchpost: { kind: 'post', light: [0, -0.9, 340, '255,170,90'] },
    pv_lanternpost: { kind: 'post', light: [0.3, -0.66, 300, '255,200,120'] },
    pv_bannerpole: { kind: 'post', light: [0.36, -0.7, 260, '255,200,120'] },
    pv_rock1: { kind: 'rock' }, pv_rock2: { kind: 'rock' }, pv_reeds: { kind: 'low', sway: 1 }, pv_cattails2: { kind: 'low', sway: 1 },
    pv_pine: { kind: 'tree' }, pv_shorebush: { kind: 'bush' }, pv_mooring: { kind: 'post' }, pv_lilies: { kind: 'flat' },
    pv_floatlantern: { kind: 'low', light: [0, -0.55, 200, '255,190,110'], bob: 1 },
  };
  NC.PVP_PROPS = PROPS;
  // [name, x, y, {flip, scale}]: the torches on the platform's rim, lantern posts and banners in the water round it,
  // rocks and reeds, floating lanterns, mooring posts at the bridge's foot, pines and bushes on the far shore (north)
  const ang = (a, k) => [STAGE.x + Math.cos(a) * STAGE.rx * (k || 0.97), STAGE.y + Math.sin(a) * STAGE.ry * (k || 0.97)];
  const PLACED = [
    ['pv_torchpost', ...ang(-2.45)], ['pv_torchpost', ...ang(-0.69), { flip: true }], ['pv_torchpost', ...ang(2.5)], ['pv_torchpost', ...ang(0.64), { flip: true }],
    ['pv_bannerpole', 905, 300], ['pv_bannerpole', 1700, 300, { flip: true }],
    ['pv_lanternpost', 255, 760], ['pv_lanternpost', 2345, 760, { flip: true }], ['pv_lanternpost', 960, 1520], ['pv_lanternpost', 1640, 1520, { flip: true }],
    ['pv_rock1', 170, 1330], ['pv_rock1', 2440, 1390, { flip: true }], ['pv_rock2', 430, 380], ['pv_rock2', 2230, 340, { flip: true }], ['pv_rock2', 2520, 1010],
    ['pv_reeds', 70, 1130], ['pv_reeds', 2540, 1220, { flip: true }], ['pv_reeds', 330, 1620], ['pv_reeds', 2290, 1660, { flip: true }],
    ['pv_reeds', 170, 290], ['pv_reeds', 2440, 250, { flip: true }],
    ['pv_cattails2', 560, 1180], ['pv_cattails2', 2080, 1210, { flip: true }], ['pv_cattails2', 730, 260], ['pv_cattails2', 1890, 240, { flip: true }],
    ['pv_floatlantern', 600, 1290], ['pv_floatlantern', 1980, 1330], ['pv_floatlantern', 2120, 520], ['pv_floatlantern', 420, 560],
    ['pv_mooring', 1050, 1700], ['pv_mooring', 1555, 1700, { flip: true }],
    ['pv_pine', 120, 70], ['pv_pine', 470, 50, { scale: 0.9 }], ['pv_pine', 1040, 60, { scale: 0.85 }], ['pv_pine', 1600, 55, { scale: 0.92 }],
    ['pv_pine', 2150, 60], ['pv_pine', 2480, 75, { scale: 0.88 }],
    ['pv_shorebush', 290, 95], ['pv_shorebush', 760, 85, { scale: 0.9 }], ['pv_shorebush', 1330, 90], ['pv_shorebush', 1880, 85, { scale: 0.85 }], ['pv_shorebush', 2330, 95],
  ];

  function build() {
    const GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);
    const solid = new Uint8Array(GW * GH).fill(1);
    const onStage = (x, y) => ((x - STAGE.x) / STAGE.rx) ** 2 + ((y - STAGE.y) / STAGE.ry) ** 2 < 1;
    const onBridge = (x, y) => x > BRIDGE.x0 && x < BRIDGE.x1 && y > BRIDGE.y0 && y < BRIDGE.y1 - 30;
    for (let gy = 0; gy < GH; gy++)
      for (let gx = 0; gx < GW; gx++) {
        const x = gx * CELL + CELL / 2, y = gy * CELL + CELL / 2;
        if (onStage(x, y) || onBridge(x, y)) solid[gy * GW + gx] = 0;
      }
    const terrainSolid = solid.slice();
    const markEllipse = (cx, cy, rx, ry) => {
      for (let gy = Math.floor((cy - ry) / CELL); gy <= (cy + ry) / CELL; gy++)
        for (let gx = Math.floor((cx - rx) / CELL); gx <= (cx + rx) / CELL; gx++) {
          if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
          const nx = (gx * CELL + CELL / 2 - cx) / rx, ny = (gy * CELL + CELL / 2 - cy) / ry;
          if (nx * nx + ny * ny <= 1) solid[gy * GW + gx] = 1;
        }
    };
    const R = NC.rng(4242);
    const props = [], lights = [];
    for (const [name, x, y, o0] of PLACED) {
      const o = o0 || {}, s = NC.SPR[name], D = PROPS[name] || { kind: 'low' };
      if (!s) continue;
      const scale = o.scale || 1, flip = !!o.flip, w = s.w * scale, h = s.h * scale;
      const p = { kind: 'prop', name, x, y, scale, flip, sort: y };
      if (D.kind === 'post') { markEllipse(x, y - 6, Math.max(18, w * 0.3), 14); p.shadow = [w * 0.4, 10]; }
      else if (D.kind === 'rock') p.shadow = [w * 0.44, w * 0.1];
      else if (D.kind === 'tree') { p.shadow = [w * 0.24, w * 0.06]; p.canopy = { x0: x - w * 0.45, x1: x + w * 0.45, y0: y - h, y1: y - h * 0.3 }; }
      else if (D.kind === 'bush') p.shadow = [w * 0.42, w * 0.1];
      if (p.shadow) p.shadow = [p.shadow[0] / scale, p.shadow[1] / scale]; // (game.js scales contact shadows by p.scale)
      if (D.sway) p.sway = R() * 6;
      if (D.bob) p.bob = R() * TAU;
      if (D.light) {
        const L = D.light;
        lights.push({ x: x + L[0] * w * (flip ? -1 : 1), y: y + L[1] * h + 120, r: L[2] * Math.sqrt(scale), rgb: L[3], flick: R() * 10, owner: name === 'pv_torchpost' ? { name: 'torch' } : p });
      }
      props.push(p);
    }
    // the moon over the lake: a wide cool light on the stage
    lights.push({ x: STAGE.x, y: STAGE.y - 120 + 120, r: 900, rgb: '150,175,255', flick: 0, owner: { name: 'moon' } });

    const plate = NC.SPR.pvp_lake_plate && NC.SPR.pvp_lake_plate.img;
    let ground = plate;
    if (!plate) { ground = document.createElement('canvas'); ground.width = 1300; ground.height = 867; const g = ground.getContext('2d'); g.fillStyle = '#152448'; g.fillRect(0, 0, 1300, 867); }
    const GS = ground.width / W;
    const world = {
      W, H, ground, groundDay: ground, GS, props, decals: [], blocks: [], blockH: 0, lights, solid, terrainSolid, GW, GH, CELL, portals: [],
      spawns: [], bots: [], pvpArena: NC.PVP_ARENA, lake: true,
      spawn: { x: STAGE.x, y: STAGE.y + 200 },
      dusk: 1, ambient: () => [112, 124, 176], // always night, moonlit
      zones: [
        { name: 'เวทีประลอง', test: (x, y) => onStage(x, y) },
        { name: 'สะพานไม้', test: (x, y) => onBridge(x, y) },
        { name: NC.MAPS[ID].name, test: () => true },
      ],
      isSolid(x, y) {
        const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return true;
        return solid[gy * GW + gx] === 1;
      },
      fits(x, y, r) {
        if (this.isSolid(x, y)) return false;
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          if (this.isSolid(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6)) return false;
        }
        return true;
      },
    };
    world.warps = NC.MAPS[ID].warps.map((w) => ({ ...w, ax: 1300, ay: 1420 }));
    // the big map and the minimap: the plate itself, the props on it
    const art = document.createElement('canvas');
    art.width = Math.ceil(W / 5); art.height = Math.ceil(H / 5);
    const a = art.getContext('2d');
    a.drawImage(ground, 0, 0, art.width, art.height);
    world.mapArt = art;
    const mm = document.createElement('canvas');
    mm.width = Math.ceil(W / 10); mm.height = Math.ceil(H / 10);
    mm.getContext('2d').drawImage(art, 0, 0, mm.width, mm.height);
    world.minimap = mm;
    world.glints = Array.from({ length: 70 }, () => ({ x: R() * W, y: 120 + R() * (H - 120), ph: R() * TAU, sp: 0.5 + R() * 0.9, len: 10 + R() * 26, warm: R() < 0.35 }));
    return world;
  }

  // ---------------- hooks ----------------
  const baseField = NC.buildField;
  NC.buildField = function (def) {
    if (def && def.id === ID) { const w = build(); w.mapId = ID; return w; }
    return baseField.apply(this, arguments);
  };
  // the lake shimmers: glints drift and twinkle on the water (never on the stage or the bridge)
  const baseWater = NC.drawWater;
  NC.drawWater = function (ctx, game) {
    if (baseWater) baseWater.apply(this, arguments);
    const w = game && game.world;
    if (!w || !w.lake || !w.glints) return;
    const t = game.time || 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const g of w.glints) {
      const x = g.x + Math.sin(t * 0.3 * g.sp + g.ph) * 30, y = g.y;
      if (((x - STAGE.x) / (STAGE.rx + 40)) ** 2 + ((y - STAGE.y) / (STAGE.ry + 90)) ** 2 < 1) continue;
      if (x > BRIDGE.x0 - 30 && x < BRIDGE.x1 + 30 && y > BRIDGE.y0) continue;
      const a = 0.5 * Math.max(0, Math.sin(t * g.sp * 1.6 + g.ph));
      if (a < 0.03) continue;
      ctx.strokeStyle = g.warm ? `rgba(255,190,120,${a})` : `rgba(190,215,255,${a})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - g.len / 2, y); ctx.lineTo(x + g.len / 2, y); ctx.stroke();
    }
    ctx.restore();
  };
  // floating lanterns bob on the water (drawProp in game.js has no bob: nudge their y a little each frame)
  (NC.assetsLoaded || (NC.assetsLoaded = [])).push(() => {
    const baseLoot = NC.updateLoot;
    NC.updateLoot = function (game) {
      const w = game.world;
      if (w && w.lake) for (const p of w.props) if (p.bob !== undefined) { p.y0 = p.y0 === undefined ? p.y : p.y0; p.y = p.y0 + Math.sin(game.time * 1.4 + p.bob) * 4; }
      return baseLoot.apply(this, arguments);
    };
  });
})();
