/* rest.js — sitting down to rest, like classic MMOs' sit: X (or Insert) sits the hero on the ground, legs out in front,
   hands resting on the knees, breathing slowly; HP / SP come back twice as fast (four times by the camp's campfire).
   Walking, attacking, a skill, a dash or a hit stands him up again (so does X).
   The pose is a base animation (NC.Anim.BASE.sit): the legs swing forward and the rig lowers the body until the feet
   touch the ground, so it sits by itself; IK puts the hands on the knees. It plugs in from the outside: NC.Anim.setBase
   (the hero's base becomes 'sit' while he sits: a slow sit-down, a quicker stand-up), NC.updateHeroAnim (no idle
   fidgets while sitting), NC.updatePlayer (stand-up triggers, no sliding, the faster recovery), NC.hurtPlayer. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, A = NC.Anim, TAU = Math.PI * 2;

  // ---------------- the pose ----------------
  // (T: the numbers, so the animation lab or a test page can tune them)
  const T = (NC.SIT_POSE = { legF: 1.58, kF: 0.24, legB: 1.5, kB: 0.16, lean: -0.03, head: 0.08, hx: 9, hy: -13, bx: 30, by: -11, eF: 0.4, eB: 0.4 });
  A.BASE.sit = function (t, c, P) {
    const br = Math.sin((TAU * t) / 3.8), late = Math.sin((TAU * (t - 0.45)) / 3.8), sway = Math.sin((TAU * t) / 7.6);
    // legs stretched out in front, the knees just a little bent, the soles up (the rig lowers the body onto the ground)
    P.legF = T.legF; P.kF = T.kF; P.legB = T.legB; P.kB = T.kB;
    // sitting up; the chest breathes, the head follows a little late, looking a little down
    P.lean = T.lean + 0.012 * br; P.breathe = 1 + 0.02 * br;
    P.head = T.head + 0.02 * sway; P.headY = -0.6 * late; P.x = 0;
    // hands resting on the knees (IK: spots from the pelvis, turning with the torso)
    P.hk = 1; P.hx = T.hx + 0.4 * br; P.hy = T.hy + 0.6 * br;
    P.bk = 1; P.bx = T.bx + 0.4 * br; P.by = T.by + 0.6 * br;
    P.aF = 1.0; P.eF = T.eF; P.aB = 1.0; P.eB = T.eB;
    // the weapon put away (resting, hands free, like the reference): it fades out as he sits down
    P.wHide = 1; P.tuck = c.W && c.W.tuck ? 1 : 0; P.wFar = 0; P.wSheath = 0; P.ik = 0; P.plant = 0; P.wz = 0;
  };

  // ---------------- the hero ----------------
  const REGEN = 1, FIRE_REGEN = 3; // extra recovery on top of the normal one (x2 in all, x4 by the campfire)
  const nearFire = (game) => {
    const f = game.world && game.world.campFire, p = game.player;
    return !!f && Math.hypot(p.x - f.x, (p.y - f.y) * 1.3) < 430;
  };
  function sitDown(game) {
    const p = game.player;
    if (!p || p.sit || p.dead > 0 || p.dash || p.channel || p.atk.on) return;
    p.sit = true; p.sitT = 0;
    p.vx = p.vy = 0;
    if (p.anim.act && A.CLIPS[p.anim.act] && A.CLIPS[p.anim.act].fidget) A.stop(p.anim);
    const fire = nearFire(game);
    NC.HUD.log(fire ? 'นั่งพักข้างกองไฟ · HP / SP ฟื้นเร็วขึ้น 4 เท่า (X ลุก)' : 'นั่งพัก · HP / SP ฟื้นเร็วขึ้น 2 เท่า (X ลุก)', 'sys');
  }
  function standUp(game) {
    const p = game.player;
    if (!p || !p.sit) return;
    p.sit = false;
  }
  NC.Rest = { sitDown, standUp, toggle: (game) => (game.player.sit ? standUp(game) : sitDown(game)) };

  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyX' && e.code !== 'Insert') return;
    if (e.repeat || (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName))) return;
    const game = NC.game;
    if (!game || !game.player || game.paused) return;
    NC.Rest.toggle(game);
  });

  // stand up when the player does anything; while sitting, don't slide and recover faster
  const baseUpdate = NC.updatePlayer;
  NC.updatePlayer = function (game, dt) {
    const p = game.player, I = game.input;
    if (p.sit) {
      if (p.dead > 0 || p.dash || p.channel || I.mx || I.my || I.attack || game.mouse.down || I.q || I.e || I.r || I.f) standUp(game);
      else p.vx = p.vy = 0;
    }
    const r = baseUpdate.apply(this, arguments);
    if (p.sit && p.dead <= 0 && p.d) {
      p.sitT += dt;
      const k = nearFire(game) ? FIRE_REGEN : REGEN, hp0 = p.hp, sp0 = p.sp;
      p.hp = Math.min(p.maxHp, p.hp + p.d.hpRegen * k * dt);
      p.sp = Math.min(p.maxSp, p.sp + p.d.spRegen * k * dt);
      p.moving = false; p.running = false;
      // a little sparkle now and then while it heals
      if ((p.hp > hp0 || p.sp > sp0) && (p.sitSpark = (p.sitSpark || 0) - dt) <= 0) {
        p.sitSpark = 1.4;
        FX.stars(p.x + NC.rand(-24, 24), p.y - 70, 3, p.hp > hp0 ? '140,255,150' : '140,190,255', { speed: 60, size: 0.55 });
      }
    }
    return r;
  };
  const baseHurt = NC.hurtPlayer;
  NC.hurtPlayer = function (game) {
    const p = game.player;
    if (p && p.sit && !(p.inv > 0) && !(p.dead > 0)) standUp(game);
    return baseHurt.apply(this, arguments);
  };

  // the base animation: 'sit' while sitting (a slow sit-down, a quicker stand-up); no idle fidgets meanwhile
  const baseSetBase = A.setBase;
  A.setBase = function (st, name, mix) {
    const g = NC.game, p = g && g.player;
    if (p && st === p.anim && p.sit && name !== 'death' && name !== 'dash') { name = 'sit'; if (st.base !== 'sit') mix = 0.5; }
    else if (st.base === 'sit' && name !== 'sit') mix = Math.max(mix || 0, 0.3);
    return baseSetBase.call(this, st, name, mix);
  };
  // tell the player the key once, with the other key hints (hud.js logs those when it starts)
  const baseInit = NC.HUD.init;
  NC.HUD.init = function () {
    const r = baseInit.apply(this, arguments);
    NC.HUD.log('กด X นั่งพัก (HP / SP ฟื้นเร็วขึ้น · ข้างกองไฟในค่ายเร็วกว่านั้นอีก)', 'sys');
    return r;
  };
  const baseAnim = NC.updateHeroAnim;
  NC.updateHeroAnim = function (game) {
    const p = game.player;
    if (p && p.sit && p.anim) p.anim.fidgetT = 0;
    return baseAnim.apply(this, arguments);
  };
})();
