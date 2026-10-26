/* darkice.js — DARK ICE: the ice line turned dark while the hero wears the ROOTBOUND set (js/rootbound.js; the user,
   2026-10-07: "ลองทำสกิลสายน้ำแข็งเป็นสายมืดให้หน่อย ท่าใส่ชุดนี้ น้ำแข็งจะเป็นน้ำแข็งมืด" + "สกิลใส่ bloom ด้วย").
   Nothing new is drawn: the same Blender ice of js/frostfx.js and js/crystalburst.js, re-tinted by tools/darkice.py into
   black-violet obsidian whose rims run from violet into blood red ("สีแดงผสมนิดนึง") with a violet-crimson bloom halo baked
   under each crystal (assets/vfx3d/darkice/frost,
   assets/vfx3d/crystal_burst/dark), and the ice colours of every glow, ring, spark, mote, flash, smoke and number mapped
   to violet-crimson ones. While the player's hero wears a ROOTBOUND piece:
     pictures   frostfx's spikes, lance, tornado, block, shards (NC.FrostFX.A, swapped in place) and the crystal burst's
                'dark' variant (NC.CrystalFX.variant)
     palette    V.PAL.ice (the same array, its colours swapped: frostfx tells ice by that array), V.RGB.ice
     colours    the ice rgb / hex strings passed to V.* / FX.add / FX.text / FX.num / K.hit / K.buffFx mapped (MAP)
     frost      the frost decals tinted violet instead of blue (FrostFX / CrystalFX .decalFilter)
     numbers    the ice jobs' damage-number colour (NC.DmgFX.JOBCOL)
     bloom      the night's glow passes of the ice pictures stronger (FrostFX.glowK) so the halo spills as light; the
                blizzard funnel's wind glow weaker (FrostFX.windK): dark wind, not a pink haze
   It follows the local player's outfit (a remote player's ice keeps its own look for now). NC.DarkIce.on = false = off. */
(function () {
  'use strict';
  const NC = window.NC, V = NC.VFX, FX = NC.FX, K = NC.SkillKit, FF = NC.FrostFX, CF = NC.CrystalFX;
  if (!V || !FX || !FF || !FF.A) return;
  const DI = (NC.DarkIce = { on: true, active: false });
  const MINE = (e) => !!e && (e.robe === 'robe_rootbound' || e.hat === 'hat_rootbound' || e.weapon === 'staff_rootbound');
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const D = 'assets/vfx3d/darkice/frost/', CB = 'assets/vfx3d/crystal_burst/dark/';
  const A = FF.A;
  const ORIG = { spikes: A.spikes.slice(), lance: A.lance, tornado: A.tornado, block: A.block, shards: A.shards.slice() };
  const DARK = {
    spikes: [0, 1, 2, 3, 4, 5].map((i) => load(D + 'spike_' + i + '.webp')), lance: load(D + 'lance.webp'), tornado: load(D + 'tornado.webp'),
    block: load(D + 'block.webp'), shards: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => load(CB + 'shard_' + i + '.webp')),
  };
  // the ice colours (js/vfx.js, jobs3_skills_a.js, frostfx.js, crystalburst.js, statuses.js) and their dark twins
  // (2026-10-08 the user: "อยากให้น้ำแข็งมีสีแดงผสมนิดนึง แล้วใช้ bloom เรืองแสงด้วย": violet with some blood red in it)
  const MAP = {
    '140,210,255': '206,66,196', '190,235,255': '232,112,206', '170,225,255': '220,88,200', '200,235,255': '236,128,214',
    '190,230,255': '230,104,204', '230,245,255': '244,176,224', '220,240,255': '240,160,220', '150,215,255': '210,74,196',
    '160,220,255': '214,80,198',
    '#bfe8ff': '#f0a0d8', '#dff4ff': '#f6cce6', '#e6f6ff': '#3a1430', '#a8dcff': '#e48ac8', '#e8f6ff': '#f4d4e8', '#bfeaff': '#e9a2d6',
    '#8fd8ff': '#c0408e', '#a9e4ff': '#e88ac6',
  };
  const PAL0 = V.PAL.ice.slice(), PALD = ['#3a1040', '#c43a9c', '#ffc4dc'];
  const RGB0 = V.RGB.ice, RGBD = MAP[RGB0] || '206,66,196';
  let JC0 = null;                                            // (js/dmgburst.js loads after this file: looked up when needed)
  const FILTER = 'sepia(1) hue-rotate(282deg) saturate(3.4) brightness(1.1)';   // (the frost on the ground: violet-crimson)

  function set(on) {
    DI.active = on;
    const P = on ? DARK : ORIG;
    for (let i = 0; i < A.spikes.length; i++) A.spikes[i] = P.spikes[i] || ORIG.spikes[i];
    for (let i = 0; i < A.shards.length; i++) A.shards[i] = P.shards[i] || ORIG.shards[i];
    A.lance = P.lance; A.tornado = P.tornado; A.block = P.block;
    const pal = on ? PALD : PAL0;
    for (let i = 0; i < V.PAL.ice.length; i++) V.PAL.ice[i] = pal[i];    // (the same array: frostfx knows ice by it)
    V.RGB.ice = on ? RGBD : RGB0;
    FF.decalFilter = on ? FILTER : null;
    FF.glowK = on ? 3 : null;
    FF.glowBlur = on ? 5 : null;                               // (the bloom: the glow twins of the crystals drawn blurred too)
    FF.windK = on ? 0.55 : null;                               // (the funnel's wind: dark, not a pink haze)
    if (CF) { CF.variant = on ? 'dark' : 'ink'; CF.decalFilter = on ? FILTER : null; }
    const JC = NC.DmgFX && NC.DmgFX.JOBCOL;
    if (JC) {
      if (!JC0) JC0 = { icemage: JC.icemage, winterlord: JC.winterlord };
      JC.icemage = on ? '#e46cc4' : JC0.icemage; JC.winterlord = on ? '#f2b8dc' : JC0.winterlord;
    }
  }
  // the outfit is looked at every frame the hero is drawn
  const baseDP = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    const p = (NC.game && NC.game.player) || (game && game.player), want = !!(DI.on && p && MINE(p.equip));   // (the local hero: a party member drawn through here never switches it)
    if (want !== DI.active) set(want);
    return baseDP.apply(this, arguments);
  };

  // ---------------- the colours ----------------
  const m = (v) => (typeof v === 'string' && MAP[v]) || v;
  const mo = (o) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return m(o);
    let c = null;
    for (const k of ['rgb', 'color', 'colour', 'fill', 'stroke', 'glow']) if (typeof o[k] === 'string' && MAP[o[k]]) { c = c || Object.assign({}, o); c[k] = MAP[o[k]]; }
    return c || o;
  };
  // args: which arguments to map (all when none); only colour strings and option objects are touched, never the
  // game, the hero or a monster (K.hit / K.buffFx: their colour argument alone)
  const wrap = (obj, name, args) => {
    const f = obj && obj[name];
    if (typeof f !== 'function') return;
    obj[name] = function () {
      if (!DI.active) return f.apply(this, arguments);
      const a = Array.prototype.slice.call(arguments);
      for (let i = 0; i < a.length; i++) if (!args || args.includes(i)) a[i] = mo(a[i]);
      return f.apply(this, a);
    };
  };
  // (not V.spike / V.spikeAt's palette nor K.drawBlade: frostfx tells ice there by the exact ice values)
  for (const n of ['glow', 'glowAt', 'light', 'ring', 'sparks', 'circle', 'flash', 'beam', 'stars', 'magicCircle', 'motes']) wrap(V, n);
  // the ice's frost smoke ('#e6f6ff' with white) goes dark: plum with a dusky rose, not white puffs
  const baseSmoke = V.smoke;
  if (baseSmoke) V.smoke = function () {
    const a = Array.prototype.slice.call(arguments);
    if (DI.active && a.includes('#e6f6ff')) for (let i = 0; i < a.length; i++) { if (a[i] === '#e6f6ff') a[i] = '#3a1430'; else if (a[i] === '#ffffff') a[i] = '#7a2c62'; }
    return baseSmoke.apply(this, a);
  };
  wrap(FX, 'text'); wrap(FX, 'num');
  if (K) { wrap(K, 'hit', [6]); wrap(K, 'buffFx', [2]); }
  // FX.add keeps the very object it is given (callers hold on to it): its colour fields are changed in place
  const baseAdd = FX.add;
  FX.add = function (p) {
    if (DI.active && p && typeof p === 'object') for (const k of ['rgb', 'color', 'colour', 'fill', 'stroke', 'glow']) if (typeof p[k] === 'string' && MAP[p[k]]) p[k] = MAP[p[k]];
    return baseAdd.apply(this, arguments);
  };
})();
