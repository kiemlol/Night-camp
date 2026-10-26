/* inkstage.js — every melee line's skills STAGED like the reaper's (2026-10-20, the user: "ทำไมของเคียวมันดูมีอะไรมากกว่าตัวอื่น
   ตัวอื่นเหมือนมีเเค่แสงๆไหม เช็คดู ให้มันได้ระดับเดียวกันดิ"). The reaper's skills read richer because each one has a wind-up, a
   heavy impact, something torn out of every monster hit and an ultimate that dims the world; the other skins only turned the
   code-drawn pieces into light. js/inklight.js IL.stage gives each line the same layers, in its own pieces and colours:
     a cast      the line's sigil popping in flat under the hero, ink under it, its bits rising
     a hit       what the monster gives up (โจร shadow torn out, นักฆ่า blood light, นินจา a star spun off, เบอร์เซิร์กเกอร์
                 sparks + dust, อัศวิน steel shards, พาลาดิน a gold glint + a feather, อัศวินมังกร embers, นักดาบ crossed
                 moon cuts), flying back toward the hero like the reaper's souls
     a big hit / a crit   the line's impact piece, a shock ring, cracks of its light, an ink splat, dust, a camera punch
     an ultimate the world dimmed under the light + a camera punch + a bigger flourish
   Load after js/roguelight.js, js/berserklight.js and js/knightlight.js. */
(function () {
  'use strict';
  const NC = window.NC, LK = NC.LightKit, IL = NC.InkLight;
  if (!LK || !IL || !IL.stage) return;
  const rand = NC.rand, PI = Math.PI, TAU = PI * 2;
  const isJob = (p, j) => !!p && (p.job === j || (NC.isJob ? NC.isJob(p, j) : false));
  const has = (n) => IL.has(n);
  const zoom = (x, y, k, d) => { if (NC.GLFX && NC.GLFX.zoom) NC.GLFX.zoom(x, y, k, d); };
  const ult = (p, f) => { IL.dim(1.1, 0.34); zoom(p.x, p.y - 60, 0.05, 0.3); f(); };

  // =====================================================================================================
  // the rogue line: โจร shadow violet, นักฆ่า crimson, นินจา moon steel
  // =====================================================================================================
  const VIOL = '#b48cff', CRIM = '#e4152f', STEEL = '#c4dcff';
  const rogueKind = (p) => (isJob(p, 'assassin') ? 'asn' : isJob(p, 'shinobi') ? 'nin' : 'rog');
  const RG = NC.RogueLight;
  if (RG) {
    const look = {
      rog: { col: VIOL, sigil: 'rg_ring', bit: 'mote', tear: { n: 'mote', col: VIOL, dark: 'rg_vtorn', darkLen: 80 }, star: 'rg_mark', starCol: VIOL },
      asn: { col: CRIM, sigil: 'rg_mark', bit: 'drop', tear: { n: 'drop', col: CRIM, len: 14 }, star: 'rg_claw', starCol: null },
      nin: { col: STEEL, sigil: 'ng_star', bit: 'mote', tear: { n: 'ng_star', col: null, len: 26, count: 1 }, star: 'ng_huuma', starCol: null },
    };
    const flourish = (p, k, big) => { const L = look[k]; IL.flourish(p, { r: big ? 170 : 110, col: L.col, sigil: L.sigil, paint: k !== 'rog', spin: k === 'nin' ? 6 : 2.5, bit: L.bit, n: big ? 12 : 6, ink: k === 'nin' ? 'rg_vbomb' : 'rg_vsplat' }); };
    IL.stage(RG, {
      cast: (p) => flourish(p, rogueKind(p), false),
      ult: (p) => ult(p, () => flourish(p, rogueKind(p), true)),
      hit: (game, p, e) => {
        const k = rogueKind(p), L = look[k];
        IL.tear(p, e, L.tear);
        if (k === 'asn' && has('rg_spray')) LK.part({ n: 'rg_spray', x: e.x + (e.x > p.x ? 50 : -50), y: e.y - 55, rot: e.x > p.x ? 0 : PI, len: 110, life: 0.3, a: 0.9, col: null, white: 0.3, g: 0.6, fade: LK.out(1.3) });
        if (k === 'nin') LK.part({ n: 'glint', x: e.x, y: e.y - 60, rot: rand(0, PI), len: 46, life: 0.2, a: 1, col: STEEL, white: 0.5, g: 0.6, fade: LK.out(1.2) });
      },
      big: (game, p, e) => {
        const k = rogueKind(p), L = look[k];
        if (k === 'asn' && IL.framesReady && IL.framesReady('asf_blood')) IL.frames('asf_blood', e.x, e.y - 55, { size: 300, grow: [0.8, 1.15] });
        IL.impact(e, { col: L.col, star: L.star, starCol: L.starCol, k: 1, dust: 'rg_vbomb', ink: k === 'asn' && IL.has('bk_vcrater') ? 'bk_vcrater' : undefined,
          extra: (x, y) => { if (k === 'asn' && has('rg_spray')) LK.part({ n: 'rg_spray', x: x + 70, y, rot: 0, len: 190, life: 0.4, a: 1, col: null, white: 0.3, g: 0.7, fade: LK.out(1.3) }); } });
      },
    });
  }

  // =====================================================================================================
  // the berserker: rage light, blood ink
  // =====================================================================================================
  const RAGE = '#ff5a3c', HOT = '#ff9a4a';
  const BK = NC.BerserkLight;
  if (BK) {
    const flourish = (p, big) => {
      IL.flourish(p, { r: big ? 190 : 120, col: RAGE, sigil: 'bk_roar', paint: true, spin: 0.5, bit: 'bk_flames', bitLen: big ? 60 : 40, n: big ? 10 : 5, ink: 'bk_vcrater' });
      if (big) IL.puffs(p.x, p.y, 4, 120, 1.2, { n: ['bk_vsmoke'], a: 0.45 });
    };
    IL.stage(BK, {
      cast: (p) => flourish(p, false),
      ult: (p) => ult(p, () => flourish(p, true)),
      hit: (game, p, e) => {
        IL.tear(p, e, { n: 'spike_mid', col: HOT, len: 40, stretch: true, count: 2 });
        if (has('bk_spark')) LK.part({ n: 'bk_spark', x: e.x + (e.x > p.x ? 40 : -40), y: e.y - 50, rot: e.x > p.x ? rand(-0.3, 0.2) : PI + rand(-0.2, 0.3), len: 120, life: 0.24, a: 1, col: null, white: 0.3, g: 0.6, fade: LK.out(1.3) });
        if (Math.random() < 0.4 && has('bk_vdust')) IL.dark({ n: 'bk_vdust', x: e.x, y: e.y, vx: 0, vy: -10, rot: 0, len: 110, life: 0.6, a: 0.35, layer: 'low', grow: (u) => 0.5 + 0.6 * u, fade: LK.inOut(0.1, 0.6) });
      },
      big: (game, p, e) => IL.impact(e, { col: RAGE, star: 'bk_impact', starCol: null, k: 1.1, ink: 'bk_vcrater', dust: 'bk_vdust',
        extra: (x, y) => { if (has('bk_rips')) LK.part({ n: 'bk_rips', x, y, rot: rand(-0.2, 0.2), len: 200, life: 0.3, a: 1, col: null, white: 0.35, g: 0.7, fade: LK.out(1.3) }); } }),
    });
  }

  // =====================================================================================================
  // the knight line: อัศวิน steel, พาลาดิน gold, อัศวินมังกร fire, นักดาบ moon (the knight line's own light pieces + ink)
  // =====================================================================================================
  const KL = NC.KnightLight;
  if (KL) {
    const K4 = {
      knight: { col: '#d8ecff', sigil: 'sigil', bit: 'chip', star: 'impact', hit: (p, e) => { IL.tear(p, e, { n: 'spike_mid', col: '#e6f2ff', len: 36, stretch: true, count: 3 }); } },
      paladin: { col: '#ffd66e', sigil: 'sigil', bit: 'feather_s', star: 'sunburst', hit: (p, e) => { IL.tear(p, e, { n: 'glint', col: '#ffe08a', len: 30, count: 1 }); LK.part({ n: 'feather_s', x: e.x, y: e.y - 70, vx: rand(-40, 40), vy: -60, drag: 1, rot: rand(0, TAU), spin: rand(-2, 2), len: 26, life: 0.8, a: 0.9, col: '#ffe9b0', white: 0.4, g: 0.6, fade: LK.inOut(0.1, 0.6), sway: 5, swayA: 8, ph: rand(0, 6) }); } },
      dragonknight: { col: '#ff9a4a', sigil: 'sigil_band', bit: 'mote', star: 'blast', hit: (p, e) => { IL.tear(p, e, { n: 'mote', col: '#ff8a3a', len: 16, count: 3 }); if (has('flare_h')) LK.part({ n: 'flare_h', x: e.x, y: e.y - 55, rot: rand(-0.3, 0.3), len: 120, life: 0.16, a: 0.8, col: '#ffb070', white: 0.3, g: 0.5, fade: LK.out(1.3) }); } },
      swordmaster: { col: '#bcd8ff', sigil: 'sigil_band', bit: 'stardust', star: 'slash_x', hit: (p, e) => { if (has('slash_thin')) { const a = rand(-0.5, 0.5); for (const d of [0, 1.4]) LK.part({ n: 'slash_thin', x: e.x, y: e.y - 60, rot: a + d, len: 120, life: 0.2, a: 0.9, col: '#cfe4ff', white: 0.45, g: 0.6, fade: LK.out(1.3) }); } IL.tear(p, e, { n: 'glint', col: '#bcd8ff', len: 26, count: 1 }); } },
    };
    const lineOf = (p) => (isJob(p, 'paladin') ? 'paladin' : isJob(p, 'dragonknight') ? 'dragonknight' : isJob(p, 'swordmaster') ? 'swordmaster' : 'knight');
    const flourish = (p, big) => {
      IL.ensureInk();
      const L = K4[lineOf(p)];
      IL.flourish(p, { r: big ? 180 : 115, col: L.col, sigil: L.sigil, spin: 1.8, bit: L.bit, bitLen: L.bit === 'feather_s' ? 22 : undefined, n: big ? 12 : 6, ink: 'rg_vsplat' });
    };
    IL.stage(KL, {
      skip: (p) => isJob(p, 'berserker'),   // (the berserker's line keeps its old look, the owner 2026-10-21)
      cast: (p) => flourish(p, false),
      ult: (p) => ult(p, () => flourish(p, true)),
      hit: (game, p, e) => { IL.ensureInk(); K4[lineOf(p)].hit(p, e); },
      big: (game, p, e) => { const L = K4[lineOf(p)]; IL.impact(e, { col: L.col, star: L.star, k: 1, dust: 'rg_vbomb' }); },
    });
  }
})();
