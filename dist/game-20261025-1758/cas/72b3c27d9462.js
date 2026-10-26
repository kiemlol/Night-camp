/* dummy.js — straw training dummies to test damage on (the user asked for them, 2026-09-27): the three scarecrows of the
   camp's training ground (east of the campfire, by the lookout tower) take hits like monsters but never fall, never
   move or hit back, give no EXP or loot, and show what they took over their heads: DPS over the last 5 seconds, the
   total, the time and the biggest hit (all reset after 6 s without a hit).
     หุ่นฟางธรรมดา    neutral, no armour (the raw numbers)
     หุ่นฟางหุ้มเกราะ   neutral, DEF / MDEF and FLEE like a boss (misses, DEF and criticals show)
     หุ่นฟางอมตะ      undead (holy and fire do more, poison heals nothing)
   Only the hero's own hits count (his summons too); the AI party, the other adventurers and the auto farm leave the
   dummies alone. Their posts are no longer camp props (camp.js): each dummy draws camp_dummy itself, wobbling when hit.
   Also __nc.sim(dt): one frame of the game without drawing it (test runs, the balance harness). Loaded after autofarm.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX;
  const KINDS = [
    { x: 2390, y: 1480, name: 'หุ่นฟางธรรมดา', note: 'ไม่มีเกราะ', lv: 50, element: 'neutral', def: 0, mdef: 0, vdef: 0, imdef: 0, flee: 0 },
    { x: 2565, y: 1520, flip: true, name: 'หุ่นฟางหุ้มเกราะ', note: 'DEF 40 · MDEF 30 · หลบแบบบอส', lv: 80, element: 'neutral', def: 40, mdef: 30, vdef: 45, imdef: 25, flee: 125 },
    { x: 2735, y: 1480, name: 'หุ่นฟางอมตะ', note: 'ธาตุอมตะ · DEF 20', lv: 60, element: 'undead', def: 20, mdef: 20, vdef: 20, imdef: 15, flee: 60 },
  ];
  if (NC.CAMP_SPOT && NC.CAMP_SPOT.dummies) KINDS.forEach((K, i) => { [K.x, K.y] = NC.CAMP_SPOT.dummies[i] || [K.x, K.y]; }); // (camp.js: the big camp)
  const HP = 1e12;
  NC.DUMMY_KINDS = KINDS;

  NC.makeDummy = function (k, x, y) {
    const K = typeof k === 'number' ? KINDS[k] : k;
    return {
      kind: 'enemy', type: 'dummy', dummy: { flip: !!K.flip, note: K.note, log: [], total: 0, hits: 0, max: 0, first: -1, last: -99, crits: 0, miss: 0 },
      name: K.name, lv: K.lv, element: K.element, atkElement: 'neutral',
      x: x === undefined ? K.x : x, y: y === undefined ? K.y : y, sx: 0, sy: 0, r: 34, hp: HP, maxHp: HP,
      atk: [0, 0], def: K.def, vdef: K.vdef, mdef: K.mdef, imdef: K.imdef, hit: 0, flee: K.flee, exp: 0, jexp: 0,
      state: 'idle', t: 0, face: K.flip ? 1 : -1, flash: 0, kbx: 0, kby: 0, slow: 0, z: 0, show: 0, wx: 0, wy: 0,
      anim: NC.rand(0, 10), squash: 0, wob: 0, sort: 0,
    };
  };
  const make = (k) => { const e = NC.makeDummy(k); e.sx = e.x; e.sy = e.y; e.wx = e.x; e.wy = e.y; e.sort = e.y; return e; };

  // the camp's monsters come with the three dummies
  const baseMonsters = NC.Maps.monsters;
  NC.Maps.monsters = function (world) {
    const list = baseMonsters.apply(this, arguments);
    if (world && world.mapId === 'camp') for (let i = 0; i < KINDS.length; i++) list.push(make(i));
    return list;
  };

  // they stand still: no AI, no knockback, no walking home; poison still ticks, frozen / stunned wear off
  const baseUpdate = NC.updateEnemy;
  NC.updateEnemy = function (game, e, dt) {
    if (!e.dummy) return baseUpdate.apply(this, arguments);
    e.t += dt; e.anim += dt;
    e.flash = Math.max(0, e.flash - dt); e.slow = Math.max(0, e.slow - dt); e.show = Math.max(0, e.show - dt);
    e.frozen = Math.max(0, (e.frozen || 0) - dt); e.stun = Math.max(0, (e.stun || 0) - dt);
    e.wob = Math.max(0, e.wob - dt * 2.4);
    e.x = e.sx; e.y = e.sy; e.kbx = e.kby = 0; e.state = 'idle'; e.tgt = null; e.sort = e.y;
    if (e.poison) {
      e.poison.t -= dt; e.poison.acc += dt;
      if (e.poison.acc >= 0.5) { e.poison.acc -= 0.5; NC.damageEnemy(game, e, { dmg: e.poison.dmg, mod: 1 }, 0, 0, { dot: true }); }
      if (e.poison && e.poison.t <= 0) e.poison = null;
    }
    const D = e.dummy;
    if (D.first >= 0 && game.time - D.last > 6) Object.assign(D, { log: [], total: 0, hits: 0, max: 0, first: -1, crits: 0, miss: 0 }); // (a new session)
  };
  // a hit: counted, the dummy wobbles, it never falls
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    if (!e || !e.dummy) return baseDamage.apply(this, arguments);
    const D = e.dummy, hp0 = e.hp = HP;
    baseDamage.call(this, game, e, r, 0, 0, o);
    const got = Math.max(0, Math.round(hp0 - e.hp));
    e.hp = HP; e.dead = false; e.x = e.sx; e.y = e.sy;
    if (D.first < 0) D.first = game.time;
    D.last = game.time;
    if (r && r.miss) { D.miss++; return; }
    if (!got) return;
    D.total += got; D.hits++; D.max = Math.max(D.max, got); if (r && r.crit) D.crits++;
    D.log.push([game.time, got]);
    while (D.log.length && game.time - D.log[0][0] > 5) D.log.shift();
    e.wob = Math.min(1.2, e.wob + (o && o.dot ? 0.05 : 0.35));
  };
  NC.dummyStats = (e) => {
    const D = e.dummy, G = NC.game, now = G ? G.time : 0;
    if (!D || D.first < 0) return null;
    const span = Math.max(0.5, Math.min(5, now - D.first)), recent = D.log.reduce((s, x) => s + x[1], 0);
    return { dps: recent / span, total: D.total, time: Math.max(0, D.last - D.first), hits: D.hits, max: D.max, crits: D.crits, miss: D.miss };
  };

  // the post itself, wobbling on its foot when hit
  const baseDraw = NC.drawEnemy;
  NC.drawEnemy = function (ctx, game, e) {
    if (!e.dummy) return baseDraw.apply(this, arguments);
    const w = e.wob, rot = Math.sin(e.t * 19) * 0.11 * w;
    NC.drawSpr(ctx, 'camp_dummy', e.x, e.y, { flip: e.dummy.flip, rot, sy: 1 - Math.abs(Math.sin(e.t * 19)) * 0.03 * w,
      tint: e.flash > 0 ? ['#ffffff', e.flash * 3] : e.frozen > 0 ? ['#9fdcff', 0.4] : null });
  };
  const baseTop = NC.labelTop;
  NC.labelTop = (e) => (e.dummy ? e.y - 205 : baseTop(e));

  // over its head: the name, then DPS big, then total · time · biggest hit
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const baseBar = NC.drawEnemyBar;
  NC.drawEnemyBar = function (ctx, e, game) {
    baseBar.apply(this, arguments); // (entities.js draws no bar for a dummy; the status marks still come)
    if (!e.dummy || NC.dist(e.x, e.y, game.player.x, game.player.y) > 1400) return;
    const s = NC.dummyStats(e), y = NC.labelTop(e), near = NC.dist(e.x, e.y, game.player.x, game.player.y) < 420;
    NC.drawTag(ctx, e.name, e.x, y - 54, 18, '#fff3cf', e.element);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const line = (text, yy, size, fill) => {
      ctx.font = `800 ${size}px 'Baloo 2', 'Noto Sans Thai', 'Segoe UI', sans-serif`;
      ctx.lineWidth = size * 0.2; ctx.strokeStyle = NC.OUTLINE; ctx.strokeText(text, e.x, yy);
      ctx.fillStyle = fill; ctx.fillText(text, e.x, yy);
    };
    // (the details only for the one the hero stands by: three panels side by side stay readable)
    if (!s) { line('ตีเพื่อวัดดาเมจ', y - 28, 19, '#cfd8ff'); if (near) line(e.dummy.note, y - 8, 14, '#cfd8ff'); }
    else {
      line(`DPS ${fmt(s.dps)}`, y - 29, 28, '#ffd873');
      line(`รวม ${fmt(s.total)} · ${s.time.toFixed(1)} วิ`, y - 6, 15, '#ffffff');
      if (near) line(`สูงสุด ${fmt(s.max)} · คริ ${s.hits ? Math.round((100 * s.crits) / s.hits) : 0}% · พลาด ${s.miss}`, y + 12, 14, '#cfd8ff');
    }
    ctx.restore();
  };

  // (the AI party, the other adventurers, the auto farm and the minimap skip e.dummy themselves; the hero's summons don't)
})();
