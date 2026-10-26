/* The web online client's side of the summons (js/pets.js, backend/pets.go): the server moves and fights them, and
   each hero's record carries its own (`pets`: id, type, x, y, face, hp, maxHp, scale, name, glow, look, moving, acts,
   left). After each snapshot NC.Pets.list holds one pets.js-shaped summon for each, marked `remote` so pets.js only eases
   it to the server's place and counts its looks (petrig.js / petspine.js still animate it from how it moves); a new
   attack (acts) plays its lunge, and its blows are the server's combat events (online/world.js shows their numbers on
   the monsters). The `pet` events are its coming and going (a puppet's going breaks it apart, petrig.js), a combat event
   on a summon ('pet': true) its hurt and number.
   No summon of the web's own online: pets.js's Pets.summon gives a cast's look a stand-in only, Pets.dismiss leaves these
   alone. A skill's look and its need see only its caster's summons (NC.SKILL_RUN / NC.SKILLS[id].need run with
   Pets.list = them), so another hero's wolf or puppet is never mine; the leap, the swap and the dance find none, the
   server's events draw them (js/online-wolfhunter.js, js/online-puppeteer.js). The hero's own puppet is the running buff
   pp_puppet that AUTO and the buff row read (jobs3_skills_c.js:241 sets it in a skill tick that is off online).
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs).
   2026-10-20: js/online.js and its window events are gone; js/online/world.js now calls NC.OnlinePets.snapshot / .event
   (before that this file was not even loaded: every summon on the screen was a local one with its own fight, whose bites
   did nothing, while the server's fought unseen - Discord #121 #132 #113 #138). */
(function () {
  const NC = window.NC;
  const LUNGE = 0.2, FIRE = 0.35, HURT = 0.3, HURT_INV = 0.35; // pets.js / party.js hurtAlly
  const HURT_LIFT = 150, HURT_SIZE = 34, HURT_FILL = '#ffa0a0';
  const WARP = 600; // further than this from where the server has it (a portal, a leap, a swap): there at once
  const PUPPET = /^pp_/, PP_BUFF = 'pp_puppet', PP_BUFF_SECONDS = 999; // (jobs3_skills_c.js:241)
  const SERVER_MOVES = new Set(['wh_command', 'pp_swap', 'pp_dance']); // (their looks find no summon: see above)
  const DECOY = { fly: 0, speed: 340, r: 20, reach: 110, solid: true, shadow: [24, 8] }; // (bl_arts.js decoys)
  const byId = new Map();
  let selfId = null, mapId = null;

  const on = () => !!(NC.Online && NC.Online.enabled);
  const ownOf = (p) => { const out = []; if (p) for (const q of byId.values()) if (q.owner === p) out.push(q); return out; };
  function ownerOf(game, id) {
    if (!id) return null;
    if (id === selfId) return game.player;
    return NC.Online?.remotes?.get(id) || null;
  }
  // a monster art's decoy is drawn as its monster (record.look; bl_arts.js decoys)
  function kindOf(record) {
    if (!record.look) return NC.Pets.KINDS[record.type] || null;
    const S = NC.SPR || {}, a = S[record.look] ? record.look : 'slime_green';
    return Object.assign({ a, b: S[a + '_b'] ? a + '_b' : a }, DECOY);
  }
  function make(record, T, owner, game) {
    return {
      kind: 'ally', pet: true, remote: true, type: record.type, T, owner, skill: record.skill, lv: record.lv, name: record.name || '', glow: record.glow || null,
      x: record.x, y: record.y, tx: record.x, ty: record.y, r: T.r, sort: record.y, face: record.face || 1, anim: Math.random() * 5,
      moving: false, lunge: 0, fire: 0, target: null, dead: 0, inv: 0, hurt: 0, hp: record.hp, maxHp: record.maxHp, scale: record.scale || 1, fade: 0,
      until: Infinity, lastFight: -99, pose: true, acts: record.acts || 0, d: { flee: 0, pdodge: 0, def: 0, vdef: 0, mdef: 0, armorElement: 'neutral' },
      time0: game.time,
    };
  }
  function apply(q, record, owner, game) {
    q.owner = owner; q.tx = record.x; q.ty = record.y; q.face = record.face || q.face; q.moving = !!record.moving;
    if (Math.hypot(q.tx - q.x, q.ty - q.y) > WARP) { q.x = q.tx; q.y = q.ty; }
    q.hp = record.hp; q.maxHp = record.maxHp; q.scale = record.scale || 1; q.name = record.name || ''; q.glow = record.glow || null; q.lv = record.lv;
    q.until = record.left > 0 ? game.time + record.left : Infinity;
    if ((record.acts || 0) > q.acts) { q.lunge = LUNGE; q.fire = FIRE; q.lastFight = game.time; }
    q.acts = record.acts || 0;
  }
  function puppetBuff(p) {
    if (!p) return;
    const pp = !!NC.isJob && NC.isJob(p, 'puppeteer'), q = pp && ownOf(p).find((x) => PUPPET.test(x.type));
    if (!p.buffs) p.buffs = {};
    if (q) {
      p.buffs[PP_BUFF] = PP_BUFF_SECONDS;
      if (!p.buffLv) p.buffLv = {};
      p.buffLv[PP_BUFF] = q.lv || NC.skillLv(p, PP_BUFF) || 1;
    } else if (p.buffs[PP_BUFF] > 0) p.buffs[PP_BUFF] = 0;
  }
  function applySnapshot(st) {
    const game = NC.game, Pets = NC.Pets;
    if (!st || !st.self || !game || !game.player || !Pets) return;
    if (st.mapId !== mapId) { mapId = st.mapId; byId.clear(); } // (a new map: its summons come in where the server has them)
    const seen = new Set();
    for (const hero of [st.self, ...(st.players || [])]) {
      if (!hero || (hero !== st.self && hero.id === selfId)) continue;
      const owner = ownerOf(game, hero === st.self ? selfId : hero.id);
      if (!owner) continue;
      for (const record of hero.pets || []) {
        const T = record && record.hp > 0 && kindOf(record);
        if (!T) continue;
        let q = byId.get(record.id);
        if (!q) { q = make(record, T, owner, game); byId.set(record.id, q); }
        apply(q, record, owner, game);
        seen.add(record.id);
      }
    }
    for (const id of [...byId.keys()]) if (!seen.has(id)) byId.delete(id);
    Pets.list.length = 0; // (no summon of the web's own online: pets.js)
    Pets.list.push(...byId.values());
    puppetBuff(game.player);
  }

  // a summon gone with its look (fallen, its time up; a quiet one - recast, a job change - only leaves the record), as
  // pets.js's own Pets.dismiss plays it: petrig.js breaks a puppet apart, pets.js the smoke
  function gone(data) {
    const Pets = NC.Pets, q = byId.get(data.id);
    if (!q) { Pets.dismissLook(data.x, data.y, data.glow); return; }
    byId.delete(data.id);
    // (my own fallen one says so, as pets.js onFaint; a puppet's breaking is js/online-puppeteer.js's 'broke')
    if (q.owner === NC.game.player && !(q.hp > 0) && !PUPPET.test(q.type)) NC.HUD.log(`${q.name || 'ผู้ช่วย'}หมดแรง · เรียกใหม่ได้เมื่อสกิลพร้อม`, 'warn');
    const real = Pets.list, i = real.indexOf(q);
    if (i >= 0) real.splice(i, 1);
    q.remote = false;
    Pets.list = [q];
    try { Pets.dismiss(q.type, false); } finally { Pets.list = real; }
  }
  function applyEvent(data) {
    const Pets = NC.Pets, game = NC.game;
    if (!data || !Pets || !game) return;
    if (data.type === 'pet') {
      const look = () => { if (data.kind === 'summon') Pets.summonLook(data.x, data.y, data.glow); else if (data.kind === 'dismiss') gone(data); };
      if (data.actorId === selfId || data.kind === 'dismiss' || !NC.OtherFX) look(); else NC.OtherFX.run(look); // (another's: at a share, js/otherfx.js)
      return;
    }
    if (data.type !== 'combat' || data.pet !== true) return;
    const q = byId.get(data.targetId);
    if (q) { q.hurt = HURT; q.inv = HURT_INV; q.hp = Math.max(0, Number(data.hp) || 0); }
    NC.FX.num(data.x, data.y - HURT_LIFT, data.damage, { fill: HURT_FILL, size: HURT_SIZE });
  }

  // the skills' looks and needs: their caster's summons only (the leap, the swap, the dance: none)
  function within(list, fn, self, args) {
    const Pets = NC.Pets, real = Pets.list;
    Pets.list = list;
    try { return fn.apply(self, args); } finally { Pets.list = real; }
  }
  const RUN = NC.SKILL_RUN, SK = NC.SKILLS;
  if (NC.Pets && RUN) for (const id of Object.keys(RUN)) {
    const run = RUN[id];
    if (typeof run !== 'function') continue;
    const none = SERVER_MOVES.has(id);
    const g = function (game, p) { return on() ? within(none ? [] : ownOf(p), run, this, arguments) : run.apply(this, arguments); };
    Object.assign(g, run); // (its flags: lightkit.js lkSkin, reaperlight.js rlEnsure ...)
    g._orig = run._orig || run; // (js/bl_runes.js tells a skill's kind from the real one)
    RUN[id] = g;
  }
  if (NC.Pets && SK) for (const id of Object.keys(SK)) {
    const S = SK[id], need = S && S.need;
    if (typeof need !== 'function') continue;
    S.need = function (game, p) { return on() ? within(ownOf(p), need, this, arguments) : need.apply(this, arguments); };
  }

  // js/online/world.js: every merged snapshot { self, players, mapId } (after its heroes are in) and every server event
  NC.OnlinePets = Object.freeze({
    snapshot(st, me) { if (me) selfId = me; applySnapshot(st); },
    event: applyEvent,
    own: ownOf, // (the hero's summons of the server's: js/online-wolfhunter.js)
  });
})();
