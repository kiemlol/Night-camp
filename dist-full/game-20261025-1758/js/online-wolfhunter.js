/* The web online client's side of the wolf hunter (js/skills_v21.js:462-600, js/class2_skills_b.js:209-338,
   backend/job_wolfhunter.go): the server flies the falcons and sends where each one is while it is away from its hero's
   side as the hero's meters (whFalcon 1 out / 2 diving / 3 back with whFalconX / whFalconY; the golden one's whGold,
   whGoldX, whGoldY while it is out). At the hero's side a falcon has no meters and is put there as the offline game puts
   it (skills_v21.js:495 perchOf, :522-526). They are drawn with the offline rig (NC.PetRig.falcon, js/petrig.js), for
   every hero on the screen (the other heroes' records carry their meters too); the skill ticks that fly them offline
   never run online. The `wolfhunter` events are the looks of what the server moved or rolled: the wolf's pounce
   (`rush`: smoke where it left and where it lands, skills_v21.js:581-584), its leap at the command (`command`: 'ขย้ำ!',
   its ghost and smoke, class2_skills_b.js:261-265) and the hunter's mark (`mark`: the red reticle over the marked
   monster for its seconds, :279 and :286-297). The local hero's wolf is tinted while its wh_frenzy runs (:304).
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs).
   2026-10-20: js/online.js and its window events are gone; js/online/world.js now calls NC.OnlineWolf.snapshot / .event
   (before that this file was not loaded: the hawk sent online stayed "out" on the web for good, skills_v21.js RUN.wh_blitz,
   and was never drawn, Discord #121 #132). A presented wh_blitz no longer sends the web's own falcon; its need asks this
   file whether the hero's is at his side (NC.OnlineWolf.out). The leap's look comes only from here (online-pets.js: the
   presented wh_command finds no wolf). */
(function () {
  const NC = window.NC;
  const STATES = [null, 'go', 'strike', 'back'];
  const PERCH = { behind: 74, gap: 30, lift: 130, liftGap: 8, warp: 420, follow: 5, faceGap: 24 }; // skills_v21.js:495, :523-526
  const KEYS = [['whFalcon', 'whFalconX', 'whFalconY'], ['whGold', 'whGoldX', 'whGoldY']];
  const EASE = 15, FACE_MIN = 0.3, SPRITE_SCALE = { perch: 1.05, flying: 1.1 };
  const MARK_RGB = '255,90,90', MARK_LIFE = 60, FRENZY_TINT = ['#ff5a3a', 0.25], GOLD_TINT = ['#ffd24a', 0.45];
  const COMMAND = { text: 'ขย้ำ!', fill: '#ffe0b0', size: 30, lift: 100, ghost: '#cfe6ff', ghostA: 0.3 };
  const SMOKE = { n: 5, lift: 20, dark: '#e8e4f4', light: '#ffffff', o: { size: 0.7, lifeK: 0.5 } };
  const flocks = new Map(); // hero id -> { hero, falcons: [brown, golden] }
  let selfId = '', ticker = null; // (the local hero's server id: js/online/world.js W.me; the web hero has no .id)

  const num = (meters, key) => Number(meters?.[key]) || 0;
  function heroOf(game, id) {
    if (id && id === selfId) return game.player;
    return NC.Online?.remotes?.get(id) || null;
  }
  // (backend hasFalcon: the blitz learned too; another hero's record has no skill levels, so its job alone)
  const hasFalcon = (hero) => !!hero && (NC.jobSkills?.(hero) || []).includes('wh_blitz') && (hero !== NC.game?.player || NC.skillLv(hero, 'wh_blitz') > 0);
  function perchOf(hero, f) {
    return [hero.x - (hero.face || 1) * (PERCH.behind + f.i * PERCH.gap), hero.y - PERCH.lift - f.i * PERCH.liftGap];
  }

  // a falcon's drawing: at the hero's side among the characters, in flight over everything (skills_v21.js:513-517)
  function drawFalcon(ctx, flock, f) {
    const game = NC.game, hero = flock.hero;
    if (!game || !hero || hero.dead > 0 || f.st === 'gone') return;
    if (NC.PetRig?.falcon?.(ctx, game, hero, f)) return;
    const name = f.st === 'perch' ? 'pet_falcon' : f.st === 'strike' ? 'pet_falcon_c' : 'pet_falcon_b';
    if (NC.ASSET_MANIFEST?.[name]) {
      NC.drawSpr(ctx, name, f.x, f.y, { flip: f.face > 0, scale: f.st === 'perch' ? SPRITE_SCALE.perch : SPRITE_SCALE.flying, tint: f.gold ? GOLD_TINT : null });
    }
  }
  function ensureFx(flock, f) {
    const FX = NC.FX;
    if (f.fx && FX.list.includes(f.fx) && FX.list.includes(f.fly)) return;
    f.fx = FX.add({ type: 'custom', layer: 'sorted', x: f.x, y: f.y, life: 1e9, sort: flock.hero.y, draw: (ctx) => { if (f.st === 'perch') drawFalcon(ctx, flock, f); } });
    f.fly = FX.add({ type: 'custom', layer: 'glow', x: f.x, y: f.y, life: 1e9, draw: (ctx) => { if (f.st !== 'perch') drawFalcon(ctx, flock, f); } });
  }
  function drop(flock) {
    for (const f of flock.falcons) { if (f.fx) f.fx.dead = true; if (f.fly) f.fly.dead = true; }
  }

  // each frame: at the hero's side a falcon follows its place a beat behind; away it eases to where the server has it
  function step(flock, f, dt) {
    const hero = flock.hero;
    if (f.st === 'perch') {
      const [px, py] = perchOf(hero, f);
      if (Math.hypot(px - f.x, py - f.y) > PERCH.warp) { f.x = px; f.y = py; }
      const k = Math.min(1, dt * PERCH.follow);
      f.x += (px - f.x) * k; f.y += (py - f.y) * k;
      f.face = Math.abs(px - f.x) > PERCH.faceGap ? (px > f.x ? 1 : -1) : hero.face || 1;
    } else if (f.st !== 'gone') {
      const k = 1 - Math.exp(-dt * EASE), dx = (f.tx - f.x) * k;
      if (Math.abs(dx) > FACE_MIN) f.face = dx > 0 ? 1 : -1; // (it faces the way it flies, as the server's does)
      f.x += dx; f.y += (f.ty - f.y) * k;
    }
    if (f.fx) { f.fx.x = f.x; f.fx.y = f.y; f.fx.sort = hero.y + 1; }
  }
  function ensureTicker() {
    if (ticker && NC.FX.list.includes(ticker)) return;
    ticker = NC.FX.add({ type: 'timer', layer: 'none', life: 1e9, x: 0, y: 0, update(q, dt) {
      for (const flock of flocks.values()) for (const f of flock.falcons) step(flock, f, dt);
    } });
  }

  function syncFlock(game, record) {
    const hero = heroOf(game, record.id);
    if (!hasFalcon(hero)) return false;
    let flock = flocks.get(record.id);
    if (!flock) {
      flock = { hero, falcons: [0, 1].map((i) => ({ i, gold: i === 1, st: i === 1 ? 'gone' : 'perch', x: hero.x, y: hero.y - 90, tx: hero.x, ty: hero.y - 90, face: 1, e: null })) };
      flocks.set(record.id, flock);
    }
    flock.hero = hero;
    flock.falcons.forEach((f, i) => {
      const [kSt, kX, kY] = KEYS[i], st = STATES[num(record.meters, kSt)];
      if (st) {
        if (f.gold && f.st === 'gone') { f.x = num(record.meters, kX); f.y = num(record.meters, kY); }
        f.st = st; f.tx = num(record.meters, kX) || f.tx; f.ty = num(record.meters, kY) || f.ty;
      } else f.st = f.gold ? 'gone' : 'perch';
      ensureFx(flock, f);
    });
    return true;
  }
  function frenzyTint(game) {
    const p = game.player, frenzy = p?.buffs?.wh_frenzy > 0;
    for (const q of NC.OnlinePets ? NC.OnlinePets.own(p) : NC.Pets?.list || []) if (q.type === 'wolf' && q.owner === p) q.tint = frenzy ? FRENZY_TINT : null;
  }
  function onSnapshot(event) { applySnapshot(event.detail?.snapshot); }
  function applySnapshot(snapshot) {
    const game = NC.game;
    if (!snapshot?.self || !game || !game.player || !NC.FX) return;
    selfId = snapshot.self.id || selfId;
    const seen = new Set();
    for (const record of [snapshot.self, ...(snapshot.players || [])]) if (record && syncFlock(game, record)) seen.add(record.id);
    for (const [id, flock] of flocks) if (!seen.has(id)) { drop(flock); flocks.delete(id); }
    if (flocks.size) ensureTicker();
    frenzyTint(game);
  }

  function smoke(x, y) { NC.VFX.smoke(x, y - SMOKE.lift, SMOKE.n, SMOKE.dark, SMOKE.light, SMOKE.o); }
  function mark(game, data) {
    const e = (game.enemies || []).find((m) => (m.sid || m.id) === data.targetId); // (a mirror's server id: online/world.js e.sid)
    if (!e) return; // (out of this client's sight)
    e.vuln = { k: data.k || 1, until: game.time + (data.seconds || 0), rgb: MARK_RGB };
    if (e.vulnFx) return;
    e.vulnFx = true;
    NC.FX.add({ type: 'vvuln', e, x: e.x, y: e.y, life: MARK_LIFE, onEnd() { e.vulnFx = false; } });
  }
  function onEvent(event) { applyEvent(event.detail); }
  function applyEvent(data) {
    const game = NC.game;
    if (!data || data.type !== 'wolfhunter' || !game || !NC.VFX) return;
    if (data.kind === 'rush') { smoke(data.fromX, data.fromY); smoke(data.x, data.y); }
    else if (data.kind === 'command') {
      NC.FX.text(data.fromX, data.fromY - COMMAND.lift, COMMAND.text, COMMAND.fill, COMMAND.size);
      NC.VFX.ghost({ x: data.fromX, y: data.fromY }, COMMAND.ghost, COMMAND.ghostA);
      smoke(data.x, data.y);
    } else if (data.kind === 'mark') mark(game, data);
  }
  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
  window.addEventListener('nightcamp:online-event', onEvent);
  // js/online/world.js: every merged snapshot { self, players, mapId } (self with its id; after its heroes are in) and
  // every server event; skills_v21.js asks whether a hero's falcon is away from his side (its wh_blitz need online)
  NC.OnlineWolf = Object.freeze({
    snapshot(st, me) { if (me) selfId = me; if (st && st.self) applySnapshot(st.self.id ? st : Object.assign({}, st, { self: Object.assign({ id: me }, st.self) })); },
    event: applyEvent,
    out(p) { for (const flock of flocks.values()) if (flock.hero === p) return flock.falcons[0].st !== 'perch'; return false; },
  });
})();
