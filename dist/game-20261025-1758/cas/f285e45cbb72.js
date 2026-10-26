/* maplebow.js — the BOW 2nd jobs' skills made as painted frame-by-frame animations (2026-10-16, the user: "เปลี่ยนสายธนูทุกตัว เป็นสกิลแบบ
   เฟรม เฟรมลื่น" -> the bow lines only (the ranger and the wolf hunter; their class-3 jobs, the moon sniper and
   the pack alpha, power up these same skills), only the skills you press).
   Like the archer's (js/maplefx.js, whose player this uses: NC.MapleFX play / drawT, each frame melted into the next):
   every effect is a painted FRAME-BY-FRAME animation, now TWELVE frames a one-shot (the archer's had six), each frame with
   its own origin and delay; the code places, turns, flips and fades them and draws nothing itself.
   Art: assets/gen/make_maplebow_prompts.py (Codex) -> tools/maplebow_cut.py -> assets/maplebow/ +
   assets/maplebow.manifest.js (merged into NC.ASSET_MANIFEST_MAPLE before maplefx.js loads).
   The skills' numbers are class2_skills_b.js / skills_v21.js's (hits, knockbacks, ranges, stuns, traps, the wolf's
   bite); only the looks change. A skill whose pictures are still loading (or ?maple=0) plays its old look.
   ranger:     ยิงสามดอก, กับดักระเบิด, กับดักน้ำแข็ง, จุดระเบิดกับดัก, ธนูใบไม้ทะลวง, พายุศร, ยิงสไนป์, เล็งจุดตาย, ตาทิพย์, ปลดขีดจำกัด
   wolf hunter: ธนูเขี้ยวหมาป่า, เรียกหมาป่า (+ its bite), สั่งขย้ำ, หอนเรียกพลัง, ฝูงหมาป่าวิญญาณ, ล่าเป้าหมาย (+ the mark over
               the head), คลั่งป่า, เหยี่ยวโฉบล่า (the falcon's strike: its hit and the Lv 10 lightning) */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, RUN = NC.SKILL_RUN, K = NC.SkillKit, SK = NC.SKILLS, MF = NC.MapleFX;
  if (!FX || !V || !RUN || !K || !MF || !MF.play) return;
  const C = K.C || {};
  const LEAF = C.wind || '140,255,150', WOLF = '150,200,255', FALCON = '160,220,255', GOLD = '255,215,90';
  const EMBER = '255,170,90', ICE = C.ice || '160,220,255', SIGHT = '210,255,190';
  const rand = NC.rand, TAU = Math.PI * 2, alive = K.alive;
  const wolfOf = () => NC.Pets && NC.Pets.get('wolf');
  const bowPose = (game, p, i, lock) => K.pose(game, p, K.clip(p, 'arrow', i === undefined ? 1 : i), lock || 0.3);
  const sizeOf = (e) => Math.max(0.85, Math.min(1.6, 0.75 + (e.r || 30) / 120)); // (a bigger monster, a bigger hit)
  const scaleOf = (p, id) => (NC.skillScale ? NC.skillScale(p, id) : 1);

  // each skill's pictures; without them the old look
  const NEEDS = {
    rg_triple: ['triple_cast', 'triple_ball', 'triple_hit'],
    rg_trap: ['trap_fly', 'trap_set', 'trap_boom'],
    rg_freezetrap: ['frost_fly', 'frost_set', 'frost_boom'],
    rg_detonate: ['deto_cast'],
    rg_piercer: ['pierce_cast', 'pierce_ball', 'pierce_hit', 'pierce_vortex'],
    rg_storm: ['storm_up', 'storm_zone', 'storm_arrow', 'storm_hit', 'storm_bolt'],
    rg_snipe: ['snipe_charge', 'snipe_beam', 'snipe_hit'],
    rg_focus: ['aim_cast'],
    rg_truesight: ['sight_cast'],
    rg_unlimit: ['unlimit_cast'],
    wh_fang: ['fang_cast', 'fang_ball', 'fang_hit'],
    wh_wolf: ['wolf_summon', 'wolf_bite'],
    wh_command: ['cmd_blink', 'wolf_bite'],
    wh_howl: ['howl_wave'],
    wh_pack: ['pack_call', 'pack_wolf', 'pack_hit'],
    wh_mark: ['mark_cast', 'mark_loop'],
    wh_frenzy: ['frenzy_cast'],
  };
  const OLD = {};
  for (const id in NEEDS) OLD[id] = RUN[id];
  const ready = (id) => MF.on && MF.ready(...NEEDS[id]);
  // (a buff with no RUN of its own was skilltree.js's castBuff: the pose, the buff, the friends' part, a ring)
  const oldBuff = (game, p, id, lv) => {
    const S = SK[id];
    K.pose(game, p, 'cheer', 0.35);
    K.startBuff(game, p, id, lv);
    K.buffFx(game, p, S.rgb || V.RGB.holy, { style: S.circle || 'holy' });
    if (S.party) K.buffFriends(game, p, Object.assign({ dur: S.dur(lv), rgb: S.rgb }, S.party(lv)));
  };
  const live = (id, self, args) => {
    if (ready(id)) return true;
    if (OLD[id]) OLD[id].apply(self, args);
    else oldBuff(args[0], args[1], id, args[2]);
    return false;
  };
  NC.MapleBow = { NEEDS, ready };

  // an arrow: the cast at the bow (cast, turned with the aim), the painted arrow flying with its tip on the flight point
  // (its trail grows out of the bow, it fades at the end), hit(e, q) on each monster. o: ang, v, range, r, pierce, light,
  // end(q)
  function arrow(game, p, id, o) {
    const [hx, hy] = K.hand(p), a = o.ang === undefined ? p.aim : o.ang;
    return K.shot(game, p, id, {
      from: [hx, hy], ang: a, v: o.v, range: o.range, r: o.r || 34, pierce: o.pierce, rgb: o.light,
      look(ctx, s) {
        const ang = Math.atan2(s.vy, s.vx), end = s.life - s.t;
        MF.drawT(ctx, o.ball, s.t, s.x, s.y, {
          k: o.ballK, rot: ang, flipY: Math.cos(ang) < 0, sx: Math.min(1, 0.25 + s.t / (o.grow || 0.12)), a: Math.min(1, s.t / 0.03 + 0.4, end / 0.1),
        });
      },
      hit: o.hit, end: o.end,
    });
  }
  // a buff's picture round the hero (it follows him), with its light
  function buffLook(p, anim, rgb, o) {
    o = o || {};
    MF.play(anim, p.x, p.y, { at: () => [p.x, p.y], k: o.k });
    V.light(p.x, p.y - 60, o.r || 280, rgb, 0.8, o.life || 0.8, { follow: p });
  }

  // ============================== RANGER ==============================
  // ---------------- ยิงสามดอก: three piercing arrows of forest wind in a narrow fan ----------------
  RUN.rg_triple = function (game, p, lv) {
    if (!live('rg_triple', this, arguments)) return;
    bowPose(game, p, 1, 0.3);
    MF.play('triple_cast', 0, 0, { at: () => K.hand(p), dir: () => p.aim });
    V.at(0.1, () => {
      for (let i = 0; i < 3; i++) {
        const a = p.aim + (i - 1) * 0.14;
        arrow(game, p, 'rg_triple', {
          ball: 'triple_ball', ang: a, v: 1400, range: 900, pierce: true, light: i === 1 ? LEAF : null,
          hit(e, q) {
            K.hit(game, p, 'rg_triple', e, Math.cos(a) * 150, Math.sin(a) * 150 * 0.7, '190,255,180');
            // (online the burst comes with the server's hit, SERVER_HIT below: the monsters are drawn a moment behind
            // the server's, so an arrow seen to strike one could pass it there, a burst with no number: Discord #129)
            if (!e.lookOnly) MF.play('triple_hit', q.x, q.y, { flip: Math.cos(a) < 0 });
          },
        });
      }
    });
  };
  // online: a hit of my skill the server landed on a monster (js/online/world.js), its burst on the monster as drawn
  const SERVER_HIT = (NC.SKILL_SERVER_HIT = NC.SKILL_SERVER_HIT || {});
  SERVER_HIT.rg_triple = (e, p) => { if (ready('rg_triple')) MF.play('triple_hit', e.x, e.y - 45, { flip: e.x < p.x }); };

  // ---------------- the traps: thrown, set on the ground, set off ----------------
  // skills_t1.js's rules (NC.Traps: at most 3 + mods, 25 s, armed after 0.5 s, a monster within its r + the monster's
  // sets it off; rg_detonate fires them all through NC.Traps.fire); only the pieces are pictures
  function placeTrap(game, p, id, x, y, o) {
    const T = NC.Traps;
    const max = 3 + Math.floor(((p.d && p.d.mods && p.d.mods.traps) || 0));
    while (T.list.length >= max) { const old = T.list.shift(); old.fx.dead = true; }
    const t = { id, x, y, r: o.r || 70, boom: o.boom, kind: o.kind };
    const light = V.light(x, y - 10, 110, o.rgb, 0.45, 25);
    t.fx = FX.add({
      type: 'custom', layer: 'low', x, y, life: 25,
      update(q) {
        if (q.t < 0.5) return;
        for (const e of game.enemies) if (alive(e) && NC.dist(e.x, e.y, x, y) < t.r + e.r) { T.fire(game, t); return; }
      },
      draw(ctx, q, u) { MF.drawT(ctx, o.set, q.t, x, y, { a: Math.min(1, q.t / 0.2) * (u > 0.9 ? (1 - u) / 0.1 : 1) }); },
      onEnd() { const i = T.list.indexOf(t); if (i >= 0) T.list.splice(i, 1); light.t = light.life; },
    });
    T.list.push(t);
    return t;
  }
  function throwTrap(game, p, id, o) {
    bowPose(game, p, 0, 0.25);
    const [tx, ty] = K.ground(game, p, 360), from = K.hand(p);
    K.proj({
      x: from[0], y: from[1], life: 0.3,
      update(q) { const k = q.t / 0.3; q.x = NC.lerp(from[0], tx, k); q.y = NC.lerp(from[1], ty - 10, k) - Math.sin(k * Math.PI) * 110; },
      draw(ctx, q) { MF.drawT(ctx, o.fly, q.t, q.x, q.y); },
      onEnd() { placeTrap(game, p, id, tx, ty, o); },
    });
  }
  // กับดักระเบิด: a bronze trap that blows up (hits within 160, stuns 1.2 s)
  RUN.rg_trap = function (game, p, lv) {
    if (!live('rg_trap', this, arguments) || !NC.Traps) return;
    throwTrap(game, p, 'rg_trap', {
      kind: 'blast', rgb: EMBER, r: 70, fly: 'trap_fly', set: 'trap_set',
      boom(game, t, k) {
        MF.play('trap_boom', t.x, t.y);
        V.light(t.x, t.y - 60, 420, EMBER, 1, 0.6);
        V.shake(game, 6);
        for (const e of K.around(game, t.x, t.y, 160)) { K.hit(game, p, 'rg_trap', e, 0, -160, '255,190,120', (p.d.trapK || 1) * (k || 1), { big: true }); K.stun(game, e, 1.2); }
      },
    });
  };
  // กับดักน้ำแข็ง: an ice trap, a ring of spikes (hits within 140, freezes)
  RUN.rg_freezetrap = function (game, p, lv) {
    if (!live('rg_freezetrap', this, arguments) || !NC.Traps) return;
    throwTrap(game, p, 'rg_freezetrap', {
      kind: 'freeze', rgb: ICE, r: 70, fly: 'frost_fly', set: 'frost_set',
      boom(game, t, k) {
        MF.play('frost_boom', t.x, t.y, { layer: 'sorted', dz: 30 });
        V.light(t.x, t.y - 60, 380, ICE, 0.9, 0.9);
        V.shake(game, 6);
        for (const e of K.around(game, t.x, t.y, 140)) { K.hit(game, p, 'rg_freezetrap', e, 0, 0, '170,225,255', (p.d.trapK || 1) * (k || 1)); K.freeze(game, e, SK.rg_freezetrap.freeze(NC.skillLv(p, 'rg_freezetrap'))); }
      },
    });
  };
  // จุดระเบิดกับดัก: a signal spark at the hand, every trap goes off in turn (x1.5)
  RUN.rg_detonate = function (game, p) {
    if (!live('rg_detonate', this, arguments)) return;
    K.pose(game, p, 'cheer', 0.25);
    const [hx, hy] = K.hand(p);
    MF.play('deto_cast', hx, hy - 20, { at: () => { const h = K.hand(p); return [h[0], h[1] - 20]; } });
    V.light(hx, hy, 200, EMBER, 0.8, 0.4, { follow: p });
    const all = NC.Traps ? NC.Traps.list.slice() : [];
    all.forEach((t, i) => V.at(0.12 + i * 0.08, () => NC.Traps.fire(game, t, 1.5)));
  };

  // ---------------- ธนูใบไม้ทะลวง: a spinning drill of leaves through the line, then a leaf vortex that pulls ----------------
  // (the vortex opens where the arrow strikes its first monster, else where it ends: at the end of its flight it fell
  // at the screen's edge, far from everything - Discord #153; the server's: patch 025)
  RUN.rg_piercer = function (game, p, lv) {
    if (!live('rg_piercer', this, arguments)) return;
    bowPose(game, p, 2, 0.5);
    MF.play('pierce_cast', 0, 0, { at: () => K.hand(p), dir: () => p.aim });
    V.at(0.25, () => {
      const a = p.aim;
      V.shake(game, 4);
      let opened = false;
      const vortex = (q) => {
        if (opened) return;
        opened = true;
        const x = q.x, y = q.y + 40, sc = scaleOf(p, 'rg_piercer');
        K.zone(game, p, 'rg_piercer', x, y, 150, 1.4, 0.45, { rgb: LEAF, pull: 140, mul: 0.8, color: '190,255,180', circle: false, glow: false });
        MF.play('pierce_vortex', x, y, { life: 1.4, fadeIn: 0.15, fade: 0.3, k: sc });
      };
      arrow(game, p, 'rg_piercer', {
        ball: 'pierce_ball', ang: a, v: 1200, range: 820, pierce: true, grow: 0.14, light: LEAF,
        hit(e, q) {
          K.hit(game, p, 'rg_piercer', e, Math.cos(a) * 380, Math.sin(a) * 280, '190,255,180', 1, { big: true });
          MF.play('pierce_hit', e.x, e.y - 50, { at: () => [e.x, e.y - 50], k: sizeOf(e), flip: Math.cos(a) < 0 });
          vortex(q);
        },
        end: vortex,
      });
    });
  };

  // ---------------- พายุศร (ultimate): a volley up, a storm ring, forty arrows falling, green lightning ----------------
  RUN.rg_storm = function (game, p, lv) {
    if (!live('rg_storm', this, arguments)) return;
    bowPose(game, p, 2, 0.9);
    const [tx, ty] = K.ground(game, p, 460), sc = scaleOf(p, 'rg_storm'), R = 300 * sc, ir = 70 * sc;
    V.flash('10,30,20', 0.3, 2.6, 'source-over');
    MF.play('storm_zone', tx, ty, { layer: 'low', life: 2.6, fadeIn: 0.25, fade: 0.45, k: sc });
    V.light(tx, ty - 40, 600, LEAF, 0.8, 2.6);
    MF.play('storm_up', 0, 0, { at: () => K.hand(p) });
    // (K.rain's spread and timing: 40 over 2.1 s from 0.45 s, each falling 0.18 s from 90 / -780 off its spot)
    for (let i = 0; i < 40; i++) V.at(0.45 + (i / 39) * 2.1, () => {
      const b = rand(0, TAU), d = Math.sqrt(Math.random()) * R, x = tx + Math.cos(b) * d, y = ty + Math.sin(b) * d * V.SQ;
      const sx = x + 90, sy = y - 780, dur = 0.18, ang = Math.atan2(y - 20 - sy, x - sx);
      K.proj({
        x: sx, y: sy, vx: (x - sx) / dur, vy: (y - 20 - sy) / dur, life: dur,
        draw(ctx, q) { MF.drawT(ctx, 'storm_arrow', q.t, q.x, q.y, { rot: ang, a: Math.min(1, q.t / 0.04 + 0.3) }); },
        onEnd() {
          MF.play('storm_hit', x, y);
          for (const e of K.around(game, x, y, ir)) K.hit(game, p, 'rg_storm', e, 0, 0, '190,255,180');
        },
      });
    });
    for (let i = 0; i < 6; i++) V.at(0.5 + i * 0.35, () => {
      const b = rand(0, TAU), d = rand(0, R), x = tx + Math.cos(b) * d, y = ty + Math.sin(b) * d * V.SQ;
      MF.play('storm_bolt', x, y - 20, { flip: Math.random() < 0.5 });
      V.light(x, y - 200, 420, '150,255,160', 1, 0.3);
      V.shake(game, 5);
    });
  };

  // ---------------- ยิงสไนป์: the aim gathers (0.6 s), a lance of light through the whole line ----------------
  function drawLance(ctx, q, u) {
    const B = NC.ASSET_MANIFEST_MAPLE.snipe_beam, kb = q.len / B.len, c = Math.cos(q.ang);
    const thin = u < 0.15 ? 1 : 1 - Math.pow((u - 0.15) / 0.85, 1.3), grow = Math.min(1, u / 0.07);
    MF.drawT(ctx, 'snipe_beam', q.t, q.x, q.y, { k: kb / B.k, rot: q.ang, flipY: c < 0, sx: grow, sy: 0.3 + 0.7 * thin, a: Math.min(1, thin * 1.5) });
  }
  RUN.rg_snipe = function (game, p, lv) {
    if (!live('rg_snipe', this, arguments)) return;
    bowPose(game, p, 2, 1.0);
    const sure = p.buffs.rg_focus > 0;
    const at = () => { const [hx, hy] = K.hand(p); return [hx + Math.cos(p.aim) * 40, hy + Math.sin(p.aim) * 40]; };
    let charge = null, light = null;
    K.channel(game, p, 0.6, () => {
      if (!charge) charge = MF.play('snipe_charge', 0, 0, { at, life: 0.62 });
      const [hx, hy] = K.hand(p);
      if (!light) light = V.light(hx, hy, 260, LEAF, 0.9, 0.7, { follow: p });
    }, () => {
      const [hx, hy] = K.hand(p), a = p.aim, c = Math.cos(a), s = Math.sin(a), len = 1300;
      if (charge) charge.t = charge.life;
      FX.add({ type: 'custom', layer: 'glow', life: 0.4, x: hx, y: hy, ang: a, len, draw: drawLance });
      V.flash('230,255,220', 0.2, 0.25);
      V.shake(game, 10);
      for (let k = 1; k <= 4; k++) V.light(hx + c * len * (k / 4), hy + s * len * (k / 4), 260, SIGHT, 0.9, 0.4);
      for (const e of K.lineHits(game, hx, hy + 20, a, len, 60)) {
        K.hit(game, p, 'rg_snipe', e, c * 520, s * 380, '210,255,190', 1, { big: true, crit: sure });
        MF.play('snipe_hit', e.x, e.y - 50, { at: () => [e.x, e.y - 50], k: sizeOf(e), flip: c < 0 });
      }
    });
  };

  // ---------------- the buffs: เล็งจุดตาย, ตาทิพย์, ปลดขีดจำกัด ----------------
  function paintedBuff(id, anim, o) {
    RUN[id] = function (game, p, lv) {
      if (!live(id, this, arguments)) return;
      const S = SK[id];
      K.pose(game, p, 'cheer', o.pose || 0.35);
      K.startBuff(game, p, id, lv);
      buffLook(p, anim, o.rgb || S.rgb, o);
      if (S.party) K.buffFriends(game, p, Object.assign({ dur: S.dur(lv), rgb: S.rgb }, S.party(lv)));
      if (o.then) o.then(game, p, lv);
    };
  }
  paintedBuff('rg_focus', 'aim_cast', { rgb: '180,255,150' });
  paintedBuff('rg_truesight', 'sight_cast', { rgb: '200,255,140' });
  paintedBuff('rg_unlimit', 'unlimit_cast', {
    rgb: GOLD, pose: 0.4, r: 420, life: 1.1,
    then(game, p) { V.flash('255,230,120', 0.12, 0.3); V.shake(game, 6); FX.text(p.x, p.y - 210, 'UNLIMIT!', '#ffe070', 56); },
  });

  // ============================== WOLF HUNTER ==============================
  // ---------------- ธนูเขี้ยวหมาป่า: an arrow with a wolf spirit's head; the wolf goes for the one it hits ----------------
  RUN.wh_fang = function (game, p, lv) {
    if (!live('wh_fang', this, arguments)) return;
    bowPose(game, p, 2, 0.4);
    MF.play('fang_cast', 0, 0, { at: () => K.hand(p), dir: () => p.aim });
    V.at(0.2, () => {
      const a = p.aim;
      arrow(game, p, 'wh_fang', {
        ball: 'fang_ball', ang: a, v: 1350, range: 950, light: '255,210,150',
        hit(e, q) {
          K.hit(game, p, 'wh_fang', e, Math.cos(a) * 300, Math.sin(a) * 220, '255,220,170', 1, { big: true });
          MF.play('fang_hit', e.x, e.y - 55, { at: () => [e.x, e.y - 55], k: sizeOf(e), flip: Math.cos(a) < 0 });
          const w = wolfOf();
          if (w) { w.target = e; w.atkT = 0; }
        },
      });
    });
  };

  // ---------------- เรียกหมาป่า: the summon; the wolf's every bite a snap of painted fangs ----------------
  // (the wolf's size, health and bite: class2_skills_b.js's, kept the same: Lv 5 bites bleed, Lv 8 bite all round)
  function wolfSize(p, lv) { const A = SK.wh_alpha.wolf(NC.skillLv(p, 'wh_alpha') || 0); return 0.8 + lv * 0.05 + A.size; }
  function biteLook(e, q, k) {
    const flip = q && q.x > e.x;
    if (MF.ready('wolf_bite')) MF.play('wolf_bite', e.x, e.y - 60, { at: () => [e.x, e.y - 60], k: (k || 1) * sizeOf(e) * 0.9, flip });
    else for (let i = 0; i < 3; i++) FX.add({ type: 'cutline', x: e.x - 30 + i * 18, y: e.y - 90, x1: e.x - 10 + i * 18, y1: e.y - 30, w: 7, color: '255,255,255', life: 0.2 });
  }
  function bite(game, p, q, e, k) {
    const lv = q.lv;
    q.lunge = 0.28;
    const a = NC.angle(q.x, q.y, e.x, e.y);
    NC.tryMove(game.world, q, Math.cos(a) * 26, Math.sin(a) * 18);
    const res = K.hit(game, p, 'wh_wolf', e, Math.cos(a) * 120, Math.sin(a) * 90, '255,230,200', (p.d.petK || 1) * (k || 1));
    biteLook(e, q, Math.min(1.3, 0.85 + (q.scale || 1) * 0.15));
    if (lv >= 5 && res && !res.miss) K.poison(game, p, e, 3, 0.15);
    if (lv >= 8) for (const f of K.around(game, e.x, e.y, 90)) if (f !== e) K.hit(game, p, 'wh_wolf', f, 0, 0, '255,230,200', (p.d.petK || 1) * 0.5 * (k || 1));
  }
  RUN.wh_wolf = function (game, p, lv) {
    if (!live('wh_wolf', this, arguments)) return;
    K.pose(game, p, 'cheer', 0.4);
    const A = SK.wh_alpha.wolf(NC.skillLv(p, 'wh_alpha') || 0);
    const q = NC.Pets.summon(game, p, 'wolf', {
      skill: 'wh_wolf', lv, scale: wolfSize(p, lv), hp: 0.35 + lv * 0.05 + A.hp, every: Math.max(0.55, 0.9 - lv * 0.02),
      name: `หมาป่า Lv ${lv}`, glow: lv >= 10 ? '255,220,120' : null,
      act(game, q, e) { bite(game, p, q, e); },
    });
    MF.play('wolf_summon', q.x, q.y, { k: Math.max(0.9, q.scale || 1) });
    V.light(q.x, q.y - 60, 300, WOLF, 0.9, 1);
    V.at(0.25, () => FX.text(q.x, q.y - 120 * q.scale, 'AWOO!', '#cfe6ff', 36));
  };

  // ---------------- สั่งขย้ำ: the wolf vanishes, is at the target, bites three times (the last stuns) ----------------
  RUN.wh_command = function (game, p, lv) {
    if (!live('wh_command', this, arguments)) return;
    const w = wolfOf(), e = K.target(game, p, 560, 240);
    K.pose(game, p, 'cheer', 0.25);
    if (!w || !e) return;
    FX.text(w.x, w.y - 100, 'ขย้ำ!', '#ffe0b0', 30);
    MF.play('cmd_blink', w.x, w.y, { k: 0.7 * (w.scale || 1) });
    const a = NC.angle(e.x, e.y, w.x, w.y);
    w.x = e.x + Math.cos(a) * 60; w.y = e.y + Math.sin(a) * 36;
    MF.play('cmd_blink', w.x, w.y, { k: 0.7 * (w.scale || 1) });
    w.target = e;
    for (let i = 0; i < 3; i++) V.at(0.05 + i * 0.16, () => {
      if (!alive(e)) return;
      w.lunge = 0.2; w.face = e.x > w.x ? 1 : -1;
      K.hit(game, p, 'wh_command', e, 0, 0, '255,230,200', p.d.petK || 1);
      biteLook(e, w, i === 2 ? 1.45 : 1.2);
      if (i === 2) K.stun(game, e, 0.5);
      V.shake(game, 3);
    });
  };

  // ---------------- หอนเรียกพลัง: the howl (stuns within 260, the buff; the wolf quicker) ----------------
  RUN.wh_howl = function (game, p, lv) {
    if (!live('wh_howl', this, arguments)) return;
    K.pose(game, p, 'cheer', 0.6);
    K.startBuff(game, p, 'wh_howl', lv);
    FX.text(p.x, p.y - 230, 'AWOOOO!', '#cfe6ff', 48);
    buffLook(p, 'howl_wave', WOLF, { r: 420 });
    for (const e of K.around(game, p.x, p.y, 260)) { K.stun(game, e, 1); FX.num(e.x, e.y - 150, '!', { fill: '#cfe6ff', size: 40 }); }
    const w = wolfOf();
    if (w) { MF.play('howl_wave', w.x, w.y, { at: () => [w.x, w.y], k: 0.55 * (w.scale || 1) }); w.fast = 0.8; V.at(SK.wh_howl.dur(lv), () => { if (w.fast === 0.8) w.fast = 1; }); }
  };

  // ---------------- คลั่งป่า: a wild red frenzy on the hunter and the wolf (bigger, quicker for 15 s) ----------------
  RUN.wh_frenzy = function (game, p, lv) {
    if (!live('wh_frenzy', this, arguments)) return;
    K.pose(game, p, 'cheer', 0.4);
    K.startBuff(game, p, 'wh_frenzy', lv);
    buffLook(p, 'frenzy_cast', '255,120,90', { k: 0.72 });
    const w = wolfOf();
    if (w) {
      const base = w.scale;
      w.scale = base * 1.2; w.fast = 0.55; w.tint = ['#ff5a3a', 0.25];
      MF.play('frenzy_cast', w.x, w.y, { at: () => [w.x, w.y], k: 0.42 * (w.scale || 1) });
      V.at(15, () => { if (NC.Pets.list.includes(w)) { w.scale = base; w.fast = 1; w.tint = null; } });
    }
  };

  // ---------------- ล่าเป้าหมาย: the hunt mark (x1.1+ damage taken for 15 s), floating over the head while it lasts ----------------
  RUN.wh_mark = function (game, p, lv) {
    if (!live('wh_mark', this, arguments)) return;
    bowPose(game, p, 0, 0.25);
    const e = K.target(game, p, 620);
    if (!e) { FX.num(p.x, p.y - 170, 'ไม่มีเป้า', { fill: '#cfd8ff', size: 28 }); return; }
    K.vuln(game, e, 1.1 + lv * 0.02, 15, '255,90,90');
    MF.play('mark_cast', e.x, e.y - 70, { at: () => [e.x, e.y - 70], k: sizeOf(e) });
    V.light(e.x, e.y - 70, 200, '255,90,90', 0.7, 0.5);
    const w = !p.remote && wolfOf(); // (another player's mark, js/net.js: my wolf stays mine)
    if (w) { w.target = e; w.atkT = 0; }
  };
  // the mark over a marked (vulnerable) monster's head: the painted loop for the hunter's red mark; any other vuln
  // (the falcon's steel crow, ...) keeps class2_skills_b.js's reticle (the same drawing, copied: FX.def keeps one per type)
  FX.def('vvuln', (ctx, q) => {
    const e = q.e;
    if (!e || !alive(e) || !(e.vuln && e.vuln.until > NC.game.time)) { q.dead = true; return; }
    const rgb = e.vuln.rgb || '255,90,90';
    if (rgb === '255,90,90' && MF.on && MF.ready('mark_loop')) {
      MF.drawT(ctx, 'mark_loop', q.t, e.x, e.y - 175, { a: Math.min(1, q.t / 0.3) });
      return;
    }
    ctx.save(); ctx.globalAlpha *= 0.7 + 0.3 * Math.sin(q.t * 6); ctx.translate(e.x, e.y - 175);
    ctx.strokeStyle = `rgb(${rgb})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.stroke();
    for (let i = 0; i < 4; i++) { const b = (i / 4) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(b) * 7, Math.sin(b) * 7); ctx.lineTo(Math.cos(b) * 18, Math.sin(b) * 18); ctx.stroke(); }
    ctx.restore();
  }, 'high');

  // ---------------- ฝูงหมาป่าวิญญาณ (ultimate): the call, five spirit wolves galloping straight ahead ----------------
  RUN.wh_pack = function (game, p, lv) {
    if (!live('wh_pack', this, arguments)) return;
    K.pose(game, p, 'cheer', 0.8);
    FX.text(p.x, p.y - 240, 'AWOOOOO!', '#cfe6ff', 54);
    V.flash('10,20,40', 0.3, 1.6, 'source-over');
    buffLook(p, 'pack_call', WOLF, { r: 520, life: 1.2 });
    const a = p.aim, c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
    for (let i = 0; i < 5; i++) V.at(0.2 + i * 0.08, () => {
      const off = (i - 2) * 70, hit = new Set();
      FX.add({
        type: 'custom', layer: 'glow', x: p.x - c * 80 + nx * off, y: p.y - s * 60 + ny * off * 0.6, vx: c * 1100, vy: s * 760, life: 0.9,
        update(q, dt) {
          q.x += q.vx * dt; q.y += q.vy * dt;
          for (const e of game.enemies) if (!hit.has(e) && alive(e) && NC.dist(q.x, q.y, e.x, e.y) < 70 + e.r) {
            hit.add(e);
            K.hit(game, p, 'wh_pack', e, c * 420, s * 300, '200,230,255', 1, { big: true });
            MF.play('pack_hit', e.x, e.y - 50, { at: () => [e.x, e.y - 50], k: sizeOf(e), flip: c < 0 });
          }
        },
        draw(ctx, q, u) { MF.drawT(ctx, 'pack_wolf', q.t + i * 0.07, q.x, q.y, { flip: q.vx < 0, a: Math.min(1, q.t / 0.1, (q.life - q.t) / 0.2) * 0.95 }); },
      });
    });
    V.at(0.3, () => V.shake(game, 10));
  };

  // ---------------- เหยี่ยวโฉบล่า (and the falcon's own strikes): the painted strike, the Lv 10 painted lightning ----------------
  // skills_v21.js's falconStrike is inside its file: its damage call (colour FALCON, fill #9fe6ff / the golden one's
  // #ffe28a) shows the strike, and the sparks / slash / bolt it draws right after, that same moment, are left out
  let falconAt = -1, falconE = null, boltAt = -1;
  const dmg0 = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    const res = dmg0.apply(this, arguments);
    if (o && o.color === FALCON && (o.fill === '#9fe6ff' || o.fill === '#ffe28a') && MF.on && MF.ready('blitz_hit', 'blitz_bolt') && game) {
      if (falconAt !== game.time) { falconAt = game.time; falconE = e; MF.play('blitz_hit', e.x, e.y - 60, { at: () => [e.x, e.y - 60], k: sizeOf(e) * (o.fill === '#ffe28a' ? 0.85 : 1), flip: Math.random() < 0.5 }); }
    }
    return res;
  };
  const now = () => (NC.game ? NC.game.time : -2);
  if (K.slashAt) { const s0 = K.slashAt; K.slashAt = function (x, y, r, ang, pal, rgb) { if (rgb === FALCON && falconAt === now()) return; return s0.apply(this, arguments); }; }
  if (V.sparks) { const s0 = V.sparks; V.sparks = function (x, y, n, rgb) { if ((rgb === FALCON || rgb === GOLD) && falconAt === now()) return; return s0.apply(this, arguments); }; }
  if (V.boltAt) {
    const b0 = V.boltAt;
    V.boltAt = function (x0, y0, x1, y1) {
      if (falconAt === now() && falconE && Math.abs(x1 - falconE.x) < 1 && Math.abs(y1 - (falconE.y - 50)) < 1) {
        if (boltAt !== falconAt) { boltAt = falconAt; MF.play('blitz_bolt', x1, y1 + 10, { flip: Math.random() < 0.5 }); V.light(x1, y1 - 100, 260, '255,250,180', 1, 0.25); } // (both falcons strike the same moment: one bolt)
        return;
      }
      return b0.apply(this, arguments);
    };
  }
})();
