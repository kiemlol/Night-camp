/* The web online client's per-job meter tables (js/online.js calls NC.OnlineMeters): what the server's hero meters
   (backend/skills_hooks.go Character.meters) mean to each job's skill file, which offline keeps those fields itself.
   - FIELDS: a number onto the field the skill file reads (js/jobs3_berserker.js p.bkRage, p.bkStack;
     js/jobs3_skills_b.js p.rpSouls, p.gsAmmo, p.gsSpecial; js/jobs3_skills_a.js p.smDance, p.iceArmor: the icemage's
     armour, whose shell the orbit draws while its buff runs);
   - ENUMS: an index (1-based) onto the skill file's name for it (the gunslinger's spin and special element);
   - CLOCKS: a running timer's length onto the skill file's end time (game.time when it runs out), counted from the
     snapshot it first shows up in (the gunslinger's reload);
   - GAUGES: the lasting effects the skill files draw the meters with (the rage bars, the circling souls, the
     chambers). Offline their skill ticks keep them alive; the skill ticks never run online, and each draw shows only
     for its own job;
   - DOT_FILL: the colour of a server dot tick by its skill (poison keeps the offline green; js/jobs3_skills_b.js:677
     the reaper's sickle bleed);
   - the firemage's heat (js/jobs3_skills_a.js NC.heat.v) and its bar;
   - the swordmaster's orbit (js/jobs3_skills_a.js FLOAT, MOONS: the floating swords and the moon blades) from its
     meters, and its blade marks from the server's bladeMark / bladeMarkEnd events (backend/job_swordmaster.go): they
     join the skill file's list, age every frame and, set off, draw its burst.
   A record without a meter means 0. This file is apart from js/online.js so that a new job's rows leave the FX replay
   sources untouched (scripts/export-unity-fx-replay.mjs sourceFiles). */
(function () {
  const NC = window.NC;
  const FIELDS = { rage: 'bkRage', bkStack: 'bkStack', souls: 'rpSouls', gsAmmo: 'gsAmmo', gsSpecial: 'gsSpecial', smDance: 'smDance', iceArmor: 'iceArmor' };
  const ELEMENTS = [undefined, 'fire', 'water', 'wind'];
  const ENUMS = {
    gsSpin: ['gsSpin', [null, 'x3', 'boom', 'elem', 'heal', 'pierce', 'dud']],
    gsSpecialEl: ['gsSpecialEl', ELEMENTS],
    smEl: ['smEl', ELEMENTS],
  };
  const CLOCKS = { gsReload: 'gsReload' };
  const GAUGES = [['bkrage', 'glow'], ['j3souls', 'high'], ['j3ammo', 'glow'], ['j3orbit', 'high'], ['j3marks', 'glow'], ['j3heat', 'glow']];
  const ORBIT_HOLD = 1; // s: each snapshot keeps the orbit up this long (it goes if they stop)
  const MARK_LIFE = 3, MARK_SPARE = 0.5; // js/jobs3_skills_a.js:64 addMark; a mark whose end never came goes after this
  const DOT_FILL = { rp_bleed: '#ff6a7a', as_bleed: '#ff6b6b' }; // (js/skills_v21.js:658 the assassin's bleed)
  const num = (meters, key) => Number(meters?.[key]) || 0;

  function sync(p, meters, game) {
    for (const [key, field] of Object.entries(FIELDS)) p[field] = num(meters, key);
    for (const [key, [field, names]] of Object.entries(ENUMS)) p[field] = names[num(meters, key)] ?? names[0];
    const now = (game && game.time) || 0;
    for (const [key, field] of Object.entries(CLOCKS)) {
      const seconds = num(meters, key);
      if (!seconds) p[field] = 0;
      else if (!(p[field] > 0)) p[field] = now + seconds;
    }
    if (!game || p !== game.player) return;
    for (const [type, layer] of GAUGES) ensureGauge(type, layer);
    syncOrbit(meters, now);
    if (NC.heat) NC.heat.v = num(meters, 'heat'); // (js/jobs3_skills_a.js: the firemage's heat, one for the local hero)
    syncHonor(p, meters, now);
  }

  // the swordmaster's honour from won duels (ท้าดวล): the server keeps the stacks (backend job_swordmaster.go smHonor,
  // ATK +5 each); js/jobs3_skills_a.js reads p.smHonor while p.smHonorT is ahead and only a local kill ever set it, so
  // online the duel never showed its stacks (2026-10-19, Discord). Each snapshot holds it a moment; a rise shouts.
  function syncHonor(p, meters, now) {
    const n = num(meters, 'smHonor'), was = p.smHonor && p.smHonorT > now ? p.smHonor : 0;
    p.smHonor = n;
    p.smHonorT = n ? now + ORBIT_HOLD + 1 : 0;
    if (n > was && NC.FX && NC.FX.text) NC.FX.text(p.x, p.y - 200, `เกียรตินักดาบ ×${n}`, '#ffd27a', 32);
    if (n !== was && NC.applyGear && NC.game) NC.applyGear(NC.game); // (the ATK in the status window)
  }

  // one gauge of each type, kept by reference (like js/jobs3_skills_a.js ensureOrbit): a light skin's look file renames
  // the gauge it draws (js/lightkit.js swap: type 'lk', the name in origType), so a check by type alone missed it and
  // added a new one every snapshot (2026-10-19: Swordmaster + light skin, NC.FX.list over 10,000, 41 -> 22 fps)
  const held = {};
  function ensureGauge(type, layer) {
    const f = held[type];
    if (f && NC.FX.list.includes(f)) return;
    held[type] = NC.FX.list.find((x) => x.type === type || x.origType === type) || NC.FX.add({ type, layer, life: 1e9, x: 0, y: 0 });
  }

  function syncOrbit(meters, now) {
    const O = NC.SwordOrbit;
    if (!O) return;
    const floats = num(meters, 'smFloat');
    if (floats) O.FLOAT.n = floats;
    O.FLOAT.until = floats ? now + ORBIT_HOLD : 0;
    O.FLOAT.el = ELEMENTS[num(meters, 'smFloatEl')] ?? null;
    O.MOONS.until = num(meters, 'smMoons') ? now + ORBIT_HOLD : 0;
  }

  // the server's blade marks: they join the skill file's list; an effect ages them every frame
  let ager = null;
  function ensureAger() {
    if (ager && NC.FX.list.includes(ager)) return;
    ager = NC.FX.add({ type: 'timer', layer: 'none', life: 1e9, x: 0, y: 0, update(q, dt) {
      const list = NC.BladeMarks?.list || [];
      for (let i = list.length - 1; i >= 0; i--) if ((list[i].t += dt) >= list[i].life + MARK_SPARE) list.splice(i, 1);
    } });
  }
  function onMarkEvent(data) {
    const B = NC.BladeMarks;
    if (!B || !data || (data.type !== 'bladeMark' && data.type !== 'bladeMarkEnd')) return;
    const key = `${data.actorId}:${data.id}`, el = data.el || null;
    if (data.type === 'bladeMark') {
      if (B.list.some((m) => m.key === key)) return;
      B.list.push({ key, x: data.x, y: data.y, t: 0, life: MARK_LIFE, ang: data.ang, el });
      B.ensureDrawer(); ensureAger();
      return;
    }
    const at = B.list.findIndex((m) => m.key === key);
    if (at >= 0) B.list.splice(at, 1);
    if (data.burst) B.burstLook({ x: data.x, y: data.y, ang: data.ang, el });
  }
  window.addEventListener('nightcamp:online-event', (event) => onMarkEvent(event.detail));

  NC.OnlineMeters = Object.freeze({ sync, event: onMarkEvent, dotFill: (skillId) => DOT_FILL[skillId] });
})();
