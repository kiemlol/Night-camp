/* The web online client's side of the archmage (js/jobs3_archmage.js, backend/job_archmage.go). The server pairs the
   elements, so a presented cast sets nothing off here (the skill file skips it); what the server does comes as
   `archmage` events, drawn with the skill file's own looks (NC.ArchmageLooks) in a scratch world of monster copies, so
   their hits strike nothing real:
   - fusion: the pair's spell at its spot (k: the recall's power, the Lv10 echo's half);
   - orbs: the two orbs round their monster (or where it stood) for their seconds;
   - shot: an orb of the trinity or of the flux's circle flying at its monster;
   - storm: the double cast's element storm (js/skills_v21.js:389-396); spread: a reaction jumping to its neighbours.
   The meters: amPairA / amPairB, the last fusion's pair (the recall's words, NC.fusionState.pair); amTrinity, the three
   orbs round a hero (the skill file's j3trinity); amFlux, the Lv10 flux's magic circle (js/skills_v21.js:609-613).
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC;
  const ELEMENTS = [undefined, 'fire', 'water', 'wind', 'earth']; // backend/job_archmage.go amElements, 1-based
  const SHOTS = { am_trinity: { v: 1100, r: 30, home: 12 }, am_arcaneflux: { v: 900, r: 34, home: 6 } }; // (:247, skills_v21.js:619)
  const SHOT_RANGE = 700, SHOT_LIFT = 45, SHOT_SIZE = 0.8, SPARK_LIFT = 50;
  const FLUX_RGB = '120,220,255', FLUX_SPIN = 2.2, FLUX_RING_X = 70, FLUX_RING_Y = 22, FLUX_LIFT = 110, FLUX_R = 22;
  const TRINITY_RGB = '220,200,255', TRINITY_SECONDS = 6, TRINITY_LIGHT = 520, TRINITY_LIGHT_A = 0.8, TRINITY_LIGHT_LIFT = 80;
  const STORM = ['fire', 'ice', 'lightning'], STORM_GAP = 0.12, STORM_R = 170, STORM_TEXT_LIFT = 200; // SkillKit.C keys
  const SPREAD_RGB = '230,210,255', SPREAD_LIFT = 50, SPREAD_W = 6, SPREAD_LIFE = 0.25;
  const LASTS = 1e9;
  const rings = new Map(); // hero id -> { hero, trinity, flux }: the circling looks the meters keep up
  const num = (v) => Number(v) || 0;
  const live = (fx) => !!fx && !fx.dead && NC.FX.list.includes(fx);
  const heroOf = (game, id) => (game.player && game.player.id === id ? game.player : NC.Online?.remotes?.get(id));
  const monsterOf = (game, id) => (id ? (game.enemies || []).find((m) => (m.sid || m.id) === id) : null);
  const alive = (m) => !!m && !m.dead && m.hp > 0;

  // a copy of the hero for the looks' hits: its own derived stats, so the heroHit wrappers leave the hits alone
  function proxy(source) {
    const p = NC.makePlayer(source.x, source.y);
    Object.assign(p, { job: source.job, lv: source.lv, jobLv: source.jobLv, aim: source.aim, face: source.face, noPose: true,
      equip: { ...source.equip }, skills: { ...source.skills }, base: { ...source.base }, stats: { ...source.stats },
      d: structuredClone(source.d), buffs: {}, buffLv: {} });
    return p;
  }
  // a scratch world round p: its monsters, the real map's walls
  function scratch(game, p, enemies) {
    const w = game.world;
    const world = { W: w.W, H: w.H, fits: w.fits?.bind(w), isSolid: w.isSolid?.bind(w), spawn: { ...w.spawn }, props: [], lights: [], spawns: [] };
    return { player: p, enemies, loot: [], respawns: [], portals: [], time: game.time, world, mapId: game.mapId,
      mouse: { active: false, wx: p.x, wy: p.y }, input: { mx: 0, my: 0 }, cam: { ...game.cam }, shake: 0, hitstop: 0,
      noSave: true, presentationOnly: true, toast() {} };
  }
  const ghosts = (game) => (game.enemies || []).filter(alive).map((m) => ({ ...m, kbx: 0, kby: 0 }));

  function fusion(game, source, data) {
    if (!source || !Array.isArray(data.pair)) return;
    const p = proxy(source);
    NC.ArchmageLooks.fusion(scratch(game, p, ghosts(game)), p, data.pair, [data.x, data.y], data.k || 1);
  }
  function orbs(game, data) {
    NC.ArchmageLooks.orbs(game, game.player, monsterOf(game, data.targetId), { x: data.x, y: data.y }, [data.el, 'earth'], data.sets || 1, data.seconds || 0, false);
  }
  function shot(game, source, data) {
    const e = monsterOf(game, data.targetId), o = SHOTS[data.skillId];
    if (!source || !alive(e) || !o) return;
    const p = proxy(source), rgb = data.el ? NC.ArchmageLooks.rgb[data.el] : FLUX_RGB;
    NC.SkillKit.shot(scratch(game, p, [e]), p, data.skillId, { from: [data.x, data.y], ang: NC.angle(data.x, data.y, e.x, e.y - SHOT_LIFT),
      v: o.v, range: SHOT_RANGE, r: o.r, home: o.home, target: e, rgb, size: SHOT_SIZE,
      hit(f) { NC.VFX.sparks(f.x, f.y - SPARK_LIFT, 6, rgb, { size: 0.7 }); } });
  }
  function storm(game, data) {
    const K = NC.SkillKit;
    STORM.forEach((c, i) => NC.VFX.at(i * STORM_GAP, () => K.burst(game, data.x, data.y, STORM_R, K.C[c], { shake: 5, stars: 6 })));
    NC.FX.text(data.x, data.y - STORM_TEXT_LIFT, 'พายุธาตุ!', '#d8f0ff', 34);
  }
  function spread(game, data) {
    const e = monsterOf(game, data.targetId) || { x: data.x, y: data.y };
    for (const id of data.to || []) {
      const f = monsterOf(game, id);
      if (f) NC.FX.add({ type: 'cutline', x: e.x, y: e.y - SPREAD_LIFT, x1: f.x, y1: f.y - SPREAD_LIFT, w: SPREAD_W, color: SPREAD_RGB, life: SPREAD_LIFE });
    }
  }
  function onEvent(event) {
    const data = event.detail, game = NC.game;
    if (!data || data.type !== 'archmage' || !game || !NC.ArchmageLooks) return;
    const source = heroOf(game, data.actorId);
    if (data.kind === 'fusion') fusion(game, source, data);
    else if (data.kind === 'orbs') orbs(game, data);
    else if (data.kind === 'shot') shot(game, source, data);
    else if (data.kind === 'storm') storm(game, data);
    else if (data.kind === 'spread') spread(game, data);
  }

  // the trinity's orbs and the flux's circle round each hero while its meter says so
  function trinityRing(r) {
    NC.VFX.light(r.hero.x, r.hero.y - TRINITY_LIGHT_LIFT, TRINITY_LIGHT, TRINITY_RGB, TRINITY_LIGHT_A, TRINITY_SECONDS, { follow: r.hero });
    return NC.FX.add({ type: 'j3trinity', layer: 'glow', life: LASTS, x: r.hero.x, y: r.hero.y, update(q) { q.x = r.hero.x; q.y = r.hero.y; } });
  }
  function fluxCircle(r) {
    return NC.FX.add({ type: 'custom', layer: 'glow', life: LASTS, x: r.hero.x, y: r.hero.y,
      draw(ctx) {
        const h = r.hero, a = (NC.game?.time || 0) * FLUX_SPIN;
        NC.VFX.magicCircle(ctx, h.x + Math.cos(a) * FLUX_RING_X, h.y - FLUX_LIFT + Math.sin(a) * FLUX_RING_Y, FLUX_R, a * 2, FLUX_RGB, 0.9, 'arcane', 1);
      } });
  }
  function keep(r, key, on, make) {
    if (on && !live(r[key])) r[key] = make(r);
    else if (!on && r[key]) { r[key].dead = true; r[key] = null; }
  }
  function onSnapshot(event) {
    const data = event.detail?.snapshot, game = NC.game;
    if (!data || !game || !NC.ArchmageLooks) return;
    const seen = new Set();
    for (const record of [data.self, ...(data.players || [])]) {
      const hero = record && heroOf(game, record.id);
      if (!hero) continue;
      seen.add(record.id);
      const r = rings.get(record.id) || {};
      r.hero = hero;
      keep(r, 'trinity', num(record.meters?.amTrinity) > 0, trinityRing);
      keep(r, 'flux', num(record.meters?.amFlux) > 0, fluxCircle);
      rings.set(record.id, r);
    }
    for (const [id, r] of rings) if (!seen.has(id)) { keep(r, 'trinity', false); keep(r, 'flux', false); rings.delete(id); }
    const m = data.self?.meters, a = ELEMENTS[num(m?.amPairA)], b = ELEMENTS[num(m?.amPairB)];
    if (NC.fusionState) NC.fusionState.pair = a && b ? [a, b] : null; // (the local hero's, as offline)
  }
  window.addEventListener('nightcamp:online-event', onEvent);
  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
})();
