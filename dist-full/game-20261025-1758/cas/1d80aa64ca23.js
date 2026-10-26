/* The web online client's side of js/monkinds.js's eight new ways to fight (backend/monster_kinds*.go). Offline,
   monkinds.js's updateEnemy moves the bolts, fades the heal beam and spurs the pack, and its drawing (with monsters.js)
   reads e.state, e.t, e.act, e.atkAng, e.shots, e.beam, e.hidden, e.popX / popY, e.rush and e.mini. Online the server
   plays them; this turns its snapshots and events into those same fields, so the offline drawing shows them unchanged:
   - each snapshot (docs/backend-contract.md "New fighting styles"): a new kind's e.t starts again when its state changes
     (online.js only counts it on), e.act from mk.act and e.atkAng from aa (the aim line of a shot's wind-up), e.hidden / popX /
     popY from mk.hid / px / py (the mound, and the ring where it rises), e.rush from mk.rush (the gold ring), e.mini from
     mk.mini (a piece at .58). A burrower dazed underground stays a mound. Each new block (mk.blk) throws sparks off the
     shield's front and says บล็อก at most every .5 s (:252-255); coming out of the ground (popped) bursts the dirt (:195-197); a summoner's
     helper puffs in the first time it is seen near it (:109);
   - monster_shot: the bolts join the shooter's e.shots with the muzzle puff (:50) and fly each frame for their life
     (the server's, to their wall); the combat event of the one that hits (`shot`) takes it away with its puff (:60);
   - monster_heal: the green beam (e.beam, .6 s), the number and the stars (:112-116);
   - monster_blast: the bomber's ring, dust and shake (:151-153).
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  'use strict';
  const NC = window.NC;
  const RUSH = 1.3, MINI = 0.58, BEAM = 0.6, BLOCK_EVERY = 0.5, DAZED = new Set(['stun', 'broken']);
  const KINDS = new Set(['ranged', 'summoner', 'healer', 'bomber', 'burrow', 'shield', 'splitter', 'leader']);
  const SHOT = { rgb: '255,220,150', z: 50, puffLift: 50, muzzle: 30 }; // js/monkinds.js:45-50, :60
  const DIRT = { color: '140,110,80', ring: '220,190,150', puff: 12, speed: 200, ringFrom: 20, ringTo: 110, ringLife: 0.5, ringWidth: 8, moundDust: 18 }; // :189, :195-196
  const HEAL = { fill: '#8fe06a', size: 30, lift: 40, stars: '150,255,150', count: 6, speed: 140, starLift: 50 }; // :114-115
  const BLOCK = { text: 'บล็อก', fill: '#cfe3ff', size: 28, lift: 20, sparks: '220,235,255', front: 34, sparkLift: 50 }; // :254-255
  const BLAST = { rgb: '255,170,80', from: 20, grow: 1.2, life: 0.7, width: 12, dust: 16, speed: 260, lift: 30, shake: 10 }; // :151-153
  const CALL = { rgb: '200,170,255', from: 10, to: 90, life: 0.6, width: 6 }; // :109
  const seen = new WeakMap(); // mob -> { state, blk, blockAt }
  let ticker = null;

  const game = () => NC.game;
  const species = (e) => (NC.SPECIES && e && NC.SPECIES[e.type]) || null;
  const mobById = (id) => (game()?.enemies || []).find((m) => (m.sid || m.id) === id); // (the current client: e.sid)
  const online = () => !!(NC.Online && (NC.Online.active || NC.Online.enabled));
  const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const heroById = (g, id) => (!id ? null : id === g.player?.id || id === NC.Online?.getState?.().playerId ? g.player : NC.Online?.remotes?.get(id) || null);

  // ---------------- every snapshot: the fields the offline drawing reads ----------------
  function onSnapshot(event) {
    const g = game(), records = event.detail?.snapshot?.monsters;
    if (!g || !Array.isArray(records) || !online()) return;
    ensureTicker();
    const byId = new Map((g.enemies || []).map((e) => [e.sid || e.id, e]));
    for (const r of records) {
      const e = r && byId.get(r.id);
      if (e) apply(g, e, r, byId);
    }
  }

  function apply(g, e, r, byId) {
    const mk = r.mk && typeof r.mk === 'object' ? r.mk : null, S = species(e);
    const was = seen.get(e), state = String(r.state || '');
    if (!was) helperArrives(e, r, byId);
    if (was && was.state !== state && S && KINDS.has(S.kind)) { // (the old kinds keep online.js's clock)
      e.t = 0;
      if (state === 'popped') risen(e, S);
    }
    e.act = mk?.act || null;
    if (Number.isFinite(r.aa)) e.atkAng = r.aa;
    else if (state === 'windup') { const h = heroById(g, r.tgt); if (h) e.atkAng = Math.atan2(h.y - e.y, h.x - e.x); } // (an aim of exactly 0 is left out)
    e.hidden = !!mk?.hid;
    e.popX = num(mk?.px, e.x); e.popY = num(mk?.py, e.y);
    if (e.hidden && DAZED.has(state)) e.state = mk?.px ? 'rise' : 'under'; // (dazed underground it stays a mound)
    e.rush = mk?.rush ? RUSH : 0;
    e.mini = mk?.mini ? MINI : 0;
    const blk = num(mk?.blk, 0), next = { state, blk, blockAt: was?.blockAt || 0 };
    if (was && blk > was.blk) next.blockAt = blocked(g, e, next.blockAt);
    seen.set(e, next);
  }

  // :109 a summoner's helper appears in a ring of its colour (a boss's minions have their own puff)
  function helperArrives(e, r, byId) {
    const owner = r.boss && byId.get(r.boss.of), O = species(owner);
    if (!O || O.kind !== 'summoner' || r.mk?.mini || r.dead) return;
    NC.FX.ring(e.x, e.y, CALL.from, CALL.to, O.fx || CALL.rgb, CALL.life, CALL.width);
  }

  // :195-197 out of the ground: the dirt bursts
  function risen(e, S) {
    NC.FX.puff(e.x, e.y, DIRT.puff, { speed: DIRT.speed, color: S.dust || DIRT.color });
    NC.FX.ring(e.x, e.y, DIRT.ringFrom, DIRT.ringTo, DIRT.ring, DIRT.ringLife, DIRT.ringWidth);
  }

  // :252-255 a hit on the shield's front: sparks every time, the word at most every .5 s
  function blocked(g, e, blockAt) {
    NC.FX.sparks(e.x + (e.face || 1) * BLOCK.front, e.y - BLOCK.sparkLift, 4, BLOCK.sparks);
    if (blockAt > g.time) return blockAt;
    NC.FX.num(e.x, NC.labelTop(e) - BLOCK.lift, BLOCK.text, { fill: BLOCK.fill, size: BLOCK.size });
    return g.time + BLOCK_EVERY;
  }

  // ---------------- every frame: the bolts fly, the beam fades, the mound throws dust ----------------
  function ensureTicker() {
    const FX = NC.FX;
    if (ticker && FX.list.includes(ticker)) return;
    ticker = FX.add({ type: 'custom', layer: 'none', x: 0, y: 0, life: Infinity, draw() {}, update(_, dt) {
      const g = game();
      if (!g || !online()) return;
      for (const e of g.enemies || []) step(e, dt);
    } });
  }

  function step(e, dt) {
    if (e.shots && e.shots.length) {
      for (const s of e.shots) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; }
      e.shots = e.shots.filter((s) => s.t < s.life);
    }
    if (e.beam) { e.beam.t -= dt; if (e.beam.t <= 0 || !e.beam.m || e.beam.m.dead) e.beam = null; }
    const S = species(e);
    if (e.state === 'under' && S && Math.random() < dt * DIRT.moundDust) NC.FX.puff(e.x, e.y, 1, { speed: 50, size: 0.6, color: S.dust || DIRT.color });
  }

  // ---------------- the server's events ----------------
  function onEvent(event) {
    const data = event.detail;
    if (!data || !online()) return;
    if (data.type === 'monster_shot') shot(data);
    else if (data.type === 'monster_heal') heal(data);
    else if (data.type === 'monster_blast') blast(data);
    else if (data.type === 'combat' && data.move === 'shot') landed(data);
  }

  function shot(data) {
    const e = mobById(data.sourceId), S = species(e);
    if (!e || !Array.isArray(data.shots)) return;
    const rgb = S?.shot?.rgb || SHOT.rgb;
    e.shots = (e.shots || []).concat(data.shots.filter((b) => Array.isArray(b) && b.length >= 6).map(([id, x, y, vx, vy, life]) => ({ id, x, y, vx, vy, life, t: 0, z: SHOT.z })));
    NC.FX.puff(e.x + (e.face || 1) * SHOT.muzzle, e.y - SHOT.puffLift, 3, { speed: 60, size: 0.5, color: rgb });
  }

  function landed(data) {
    const e = mobById(data.sourceId), S = species(e);
    const s = e?.shots?.find((b) => b.id === data.shot);
    if (!s) return;
    e.shots = e.shots.filter((b) => b !== s);
    NC.FX.puff(s.x, s.y - s.z, 5, { speed: 120, size: 0.6, color: S?.shot?.rgb || SHOT.rgb });
  }

  function heal(data) {
    const e = mobById(data.sourceId), m = mobById(data.targetId);
    if (!m) return;
    if (e) e.beam = { m, t: BEAM };
    if (Number(data.heal) > 0) NC.FX.num(m.x, NC.labelTop(m) - HEAL.lift, '+' + Math.round(data.heal), { fill: HEAL.fill, size: HEAL.size });
    NC.FX.stars(m.x, m.y - HEAL.starLift, HEAL.count, HEAL.stars, { speed: HEAL.speed });
  }

  function blast(data) {
    const g = game(), e = mobById(data.sourceId), S = species(e) || {};
    const x = num(data.x, e?.x), y = num(data.y, e?.y), R = num(data.r, S.blast || 150);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    NC.FX.ring(x, y, BLAST.from, R * BLAST.grow, S.fx || BLAST.rgb, BLAST.life, BLAST.width);
    NC.FX.puff(x, y - BLAST.lift, BLAST.dust, { speed: BLAST.speed, color: S.color || BLAST.rgb });
    if (g) g.shake = Math.max(g.shake || 0, BLAST.shake);
  }

  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
  window.addEventListener('nightcamp:online-event', onEvent);
})();
