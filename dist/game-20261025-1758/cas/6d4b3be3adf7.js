/* party.js — a classic-MMO-style party of AI friends. Invite up to three (P, or the party button): they follow the hero
   from map to map, fight with their own weapons and one skill each (the knight provokes monsters onto himself, the
   mage throws fireballs, the archer shoots two arrows, the rogue slashes with poison, the healer heals and revives),
   faint instead of dying, and show in a party list under the hero's frame, on the minimap and with HP bars under
   their feet. Everyone is the hero's level; their kills give the hero EXP as usual.
   Monsters can pick a party member as their target: while such a monster is updated, game.player stands for that
   friend, so the monster AI in entities.js / boss.js works unchanged (its hits land in hurtAlly). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, TAU = Math.PI * 2;
  const SAVE_KEY = 'nightcamp.party.v1', MAX = 3;
  const $ = (id) => document.getElementById(id);
  const clamp = NC.clamp, rand = NC.rand, dist = NC.dist, angle = NC.angle;

  // the friends who can join
  const ROSTER = [
    { id: 'leon', name: 'ลีออน', job: 'knight', role: 'tank', roleTh: 'แทงก์', color: '#8fd3ff',
      equip: { hair: 'hair_neat', top: 'top_knight', pants: 'pants_knight', shoes: 'shoes_knight', hat: 'hat_knight', weapon: 'sword' },
      stat: { str: 0.55, agi: 0.2, vit: 0.85, int: 0.05, dex: 0.3, luk: 0.1 }, hpK: 1.9, defAdd: 24, dmgK: 0.5, range: 0,
      skill: { name: 'ยั่วยุ', cd: 9, icon: 'sk_guard', desc: 'ตะโกนเรียกมอนรอบตัว 380 หน่วยให้หันมาตีตัวเอง 6 วิ' },
      desc: 'ยืนแนวหน้า HP และพลังป้องกันสูง ดึงมอนออกจากตัวคุณ' },
    { id: 'mira', name: 'มิร่า', job: 'mage', role: 'mage', roleTh: 'เวทโจมตี', color: '#dcb2ff',
      equip: { hair: 'hair_ponytail', top: 'top_mage', pants: 'pants_mage', shoes: 'shoes_mage', hat: 'hat_mage', weapon: 'staff' },
      stat: { str: 0.05, agi: 0.2, vit: 0.3, int: 0.9, dex: 0.5, luk: 0.1 }, hpK: 1, dmgK: 0.6, range: 380,
      skill: { name: 'ลูกไฟ', cd: 6, icon: 'sk_fireball', desc: 'ลูกไฟระเบิดเป็นวง ดาเมจเวทธาตุไฟ 220%' },
      desc: 'ยิงเวทจากระยะไกล ลูกไฟระเบิดโดนมอนหลายตัว' },
    { id: 'finn', name: 'ฟินน์', job: 'archer', role: 'archer', roleTh: 'ยิงไกล', color: '#b4ec88',
      equip: { hair: 'hair_brown', top: 'top_ranger', pants: 'pants_ranger', shoes: 'shoes_ranger', hat: 'hat_hood', weapon: 'bow' },
      stat: { str: 0.2, agi: 0.45, vit: 0.3, int: 0.05, dex: 0.9, luk: 0.2 }, hpK: 1.05, dmgK: 0.55, range: 420,
      skill: { name: 'ยิงคู่', cd: 5, icon: 'sk_double', desc: 'ยิงธนูสองดอกพร้อมกัน ดอกละ 140%' },
      desc: 'ยิงธนูแม่นยำจากระยะไกลที่สุดในทีม' },
    { id: 'kai', name: 'ไค', job: 'rogue', role: 'rogue', roleTh: 'ประชิด', color: '#ffab9a',
      equip: { hair: 'hair_spiky', top: 'top_rogue', pants: 'pants_rogue', shoes: 'shoes_rogue', hat: null, weapon: 'dagger' },
      stat: { str: 0.6, agi: 0.8, vit: 0.3, int: 0.05, dex: 0.35, luk: 0.3 }, hpK: 1.15, dmgK: 0.55, range: 0,
      skill: { name: 'ฟันพิษ', cd: 5, icon: 'sk_envenom', desc: 'ฟันไขว้สองครั้งธาตุพิษ ครั้งละ 160%' },
      desc: 'ว่องไว ฟันรัวระยะประชิด' },
    { id: 'luna', name: 'ลูน่า', job: 'priest', role: 'healer', roleTh: 'ผู้รักษา', color: '#a6ffd2',
      equip: { hair: 'hair_long', top: 'top_priest', pants: 'pants_priest', shoes: 'shoes_priest', hat: 'hat_priest', weapon: 'staff_holy' },
      stat: { str: 0.05, agi: 0.25, vit: 0.45, int: 0.85, dex: 0.35, luk: 0.15 }, hpK: 1.1, dmgK: 0.35, range: 340,
      skill: { name: 'ฮีล · ชุบชีวิต', cd: 3.2, icon: 'sk_heal', desc: 'รักษาเพื่อนที่เลือดต่ำกว่า 70% (รวมตัวคุณ) · ชุบชีวิตเพื่อนที่หมดแรง' },
      desc: 'อยู่แนวหลัง คอยรักษาทุกคนในปาร์ตี้' },
  ];
  const BY_ID = Object.fromEntries(ROSTER.map((r) => [r.id, r]));
  // where friends walk while following: behind the hero (x: back from where the hero faces)
  const SLOTS = [[115, -58], [115, 58], [205, 0]];

  const party = (NC.Party = { members: [], ROSTER, swapped: null });
  let hitter = null; // the friend whose hit is being dealt (NC.damageEnemy: aggro)

  // ---------------- a friend ----------------
  function make(def, x, y) {
    return {
      kind: 'ally', def, id: def.id, name: def.name, x, y, r: 20, vx: 0, vy: 0, face: 1, aim: 0, sort: y,
      equip: Object.assign({ robe: null, cape: null }, def.equip), anim: NC.Anim.makeState(), pose: null, hatS: {},
      walk: 0, moving: false, running: false, combat: 0, lastFight: -99,
      atk: { on: false, step: 0, name: null, ang: 0, cd: 0.4, chain: -1, lastEnd: -9, tgt: null },
      inv: 0, hurt: 0, dead: 0, lv: 0, hp: 1, maxHp: 1, sp: 1, maxSp: 1, d: null, buffs: {},
      target: null, retarget: 0, skillCd: 1.5 + Math.random() * 2, cast: null, stuck: 0,
    };
  }

  // numbers: the base stats of the role at the hero's level, gear, job (stats.js NC.derive)
  function rebuild(a, lv) {
    const R = a.def, base = {};
    for (const k of NC.STAT_KEYS) base[k] = clamp(Math.round(3 + lv * R.stat[k]), 1, NC.STAT_MAX || 99);
    const rec = { lv, base, job: NC.JOBS[R.job] ? R.job : 'traveler', jobLv: 30, equip: a.equip, skills: NC.newSkills(), stats: NC.gearStats(a.equip), buffs: {} };
    const d = NC.derive(rec);
    d.maxHp = Math.round(d.maxHp * R.hpK);
    d.def = Math.min(90, d.def + (R.defAdd || 0));
    const fh = a.maxHp > 1 ? a.hp / a.maxHp : 1, fs = a.maxSp > 1 ? a.sp / a.maxSp : 1;
    a.lv = lv; a.d = d; a.stats = rec.stats; a.base = base;
    a.maxHp = d.maxHp; a.maxSp = d.maxSp;
    a.hp = a.dead > 0 ? 0 : Math.max(1, Math.round(a.maxHp * fh)); a.sp = a.maxSp * fs;
  }

  const alive = (e) => e && !e.dead && e.hp > 0;
  const members = () => party.members;
  // everyone a monster may target: the friends, the bots and the hero's summons (pets.js)
  const actors = () => party.members.concat(NC.Bots ? NC.Bots.list : [], NC.Pets ? NC.Pets.targets() : []);

  // ---------------- who to fight ----------------
  function engaged(game, e, role) {
    const P = game.player, dp = dist(e.x, e.y, P.x, P.y);
    if (dp > 700) return false;
    if (e.awake === false && e.state === 'idle') return false; // a sleeping boss waits for the hero
    return e === game.target || e.show > 0 || !!e.tgt || e.awake === true ||
      e.state === 'chase' || e.state === 'windup' || e.state === 'strike' || e.state === 'recover' || dp < (role === 'tank' ? 430 : 260);
  }
  function needsHeal(game, a) {
    const P = game.player;
    if (P.dead <= 0 && P.hp / P.maxHp < 0.7 && dist(a.x, a.y, P.x, P.y) < 600) return P;
    let low = null;
    for (const m of members()) if (m.dead <= 0 && m.hp / m.maxHp < 0.7 && dist(a.x, a.y, m.x, m.y) < 600 && (!low || m.hp / m.maxHp < low.hp / low.maxHp)) low = m;
    return low;
  }
  function pick(game, a) {
    const P = game.player;
    if (P.dead > 0) return null;
    const role = a.def.role, T = alive(game.target) ? game.target : null;
    let best = null, bs = Infinity;
    for (const e of game.enemies) {
      if (!alive(e) || e.dummy || !engaged(game, e, role)) continue; // (the training dummies are the hero's)
      let s = dist(a.x, a.y, e.x, e.y);
      if (e === T) s -= 260; // help with what the hero is hitting
      if (role === 'tank' && e.tgt !== a) s -= 170 - Math.min(170, dist(e.x, e.y, P.x, P.y) * 0.3); // pull what threatens the others
      if (role === 'healer') s += 200; // only when nobody needs a heal
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }
  const valid = (game, a, e) => alive(e) && game.enemies.includes(e) && dist(e.x, e.y, game.player.x, game.player.y) < 900;

  // ---------------- hits ----------------
  function strike(game, a, e, o) {
    const r = NC.heroHit(a.d, e, { kind: o.kind || 'phys', mul: o.mul || 1, element: o.element, flat: o.flat || 0 });
    if (!r.miss) r.dmg = Math.max(1, Math.round(r.dmg * a.def.dmgK * (a.bless > game.time ? a.blessK || 1 : 1))); // (the priest's blessing)
    const tg = game.target, tt = game.targetT;
    // a bot's kill is its own: no EXP orbs, drops, log line or kill count for the hero (bots.js)
    const quiet = !!a.bot, k0 = game.kills, l0 = game.loot.length, f0 = FX.list.length, log0 = NC.HUD.log;
    if (quiet) NC.HUD.log = () => {};
    hitter = a;
    try { NC.damageEnemy(game, e, r, o.kx || 0, o.ky || 0, { big: o.big, color: o.color }); }
    finally {
      hitter = null; game.target = tg; game.targetT = tt; // the hero's target frame stays on the hero's own target
      if (quiet) {
        NC.HUD.log = log0;
        if (!alive(e)) {
          game.kills = k0;
          game.loot.splice(l0);
          for (let i = FX.list.length - 1; i >= f0; i--) if (FX.list[i].type === 'orb') FX.list.splice(i, 1);
          if (a.onKill) a.onKill(game, a, e);
        }
      }
    }
    a.lastFight = game.time;
  }

  // a projectile: 'arrow', 'bolt' (fx.js draws them) or 'fire' (a fireball, drawn here)
  function shoot(game, a, e, o) {
    const line = a.pose && NC.weaponLine(a.equip, a.pose, a.x, a.y);
    const from = line ? (o.type === 'arrow' ? line.hand : line.tip) : [a.x + a.face * 30, a.y - 80];
    const ang = angle(from[0], from[1], e.x, e.y - 45) + (o.spread || 0);
    const v = o.type === 'arrow' ? 1150 : o.type === 'fire' ? 760 : 900, bx = Math.cos(ang), by = Math.sin(ang);
    FX.add({
      type: o.type === 'fire' ? 'custom' : o.type, layer: 'glow', x: from[0], y: from[1], vx: bx * v, vy: by * v, life: 1.1, big: o.big, trail: [],
      update(p) {
        if (o.type === 'fire') { p.trail.push([p.x, p.y]); if (p.trail.length > 9) p.trail.shift(); if (Math.random() < 0.6) FX.add({ type: 'ember', x: p.x, y: p.y, vx: rand(-40, 40), vy: rand(-80, -20), life: rand(0.3, 0.6) }); }
        for (const m of game.enemies)
          if (alive(m) && dist(p.x, p.y, m.x, m.y - 45) < 32 + m.r) {
            p.dead = true;
            strike(game, a, m, { kind: o.kind, mul: o.mul, element: o.element, flat: o.flat, kx: bx * 160, ky: by * 160, big: o.big });
            if (o.type === 'arrow') FX.sparks(p.x, p.y, 5, '255,240,210');
            else if (o.type === 'bolt') FX.ring(p.x, p.y, 8, 70, '150,220,255', 0.3, 7);
            if (o.onHit) o.onHit(p.x, p.y, m);
            return;
          }
        if (NC.shotWall(game.world, p.x, p.y + 60)) { p.dead = true; if (o.onHit) o.onHit(p.x, p.y, null); else FX.puff(p.x, p.y, 2, { speed: 50, size: 0.5 }); }
      },
      draw(ctx, p) { // (only the fireball comes here)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        p.trail.forEach(([x, y], i) => {
          const u = (i + 1) / p.trail.length, r = 8 + 16 * u;
          ctx.fillStyle = `rgba(255,${120 + 60 * u},60,${0.25 * u})`;
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        });
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 34);
        g.addColorStop(0, 'rgba(255,250,210,1)'); g.addColorStop(0.35, 'rgba(255,180,70,0.95)'); g.addColorStop(1, 'rgba(255,90,30,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 34, 0, TAU); ctx.fill();
        ctx.restore();
      },
    });
  }

  // the friend's basic attack hit (the 'hit' key of the attack clip)
  function allyHit(game, a, W) {
    const A = a.atk, e = A.tgt;
    if (!alive(e)) return;
    const fin = A.step === 2, mul = [1, 1.15, 1.8][A.step];
    if (W.style === 'bolt' || W.style === 'arrow') {
      shoot(game, a, e, { type: W.style === 'arrow' ? 'arrow' : 'bolt', kind: W.magic ? 'magic' : 'phys', mul: W.magic ? mul * 0.6 : mul, big: fin, flat: W.magic && W.dmg ? rand(W.dmg[0], W.dmg[1]) * mul : 0 });
      return;
    }
    if (dist(a.x, a.y, e.x, e.y) > (W.reach || 90) + e.r + 70) return; // it got away
    const ang = angle(a.x, a.y, e.x, e.y), kb = (W.kb || 220) * (fin ? 1.6 : 1);
    strike(game, a, e, { kind: 'phys', mul, kx: Math.cos(ang) * kb, ky: Math.sin(ang) * kb, big: fin });
    FX.slash(e.x - Math.cos(ang) * 16, e.y - 58, ang - 0.5, fin ? 86 : 68, W.trailRgb || '235,245,255', a.face);
  }

  function attack(game, a, e, W) {
    const A = a.atk;
    const step = game.time - A.lastEnd < 0.9 && A.chain >= 0 && A.chain < 2 ? A.chain + 1 : 0;
    A.on = true; A.step = step; A.tgt = e; A.ang = angle(a.x, a.y - 50, e.x, e.y - 45);
    A.name = NC.Anim.setOf({ idle: 'idle', set: 'basic' }).combo(W.style)[step];
    a.face = Math.cos(A.ang) >= 0 ? 1 : -1;
    a.lastFight = game.time;
    NC.Anim.play(a.anim, A.name);
  }

  // ---------------- skills ----------------
  function castPose(a, W) {
    const name = NC.Anim.setOf({ idle: 'idle', set: 'basic' }).combo(W.style === 'arrow' ? 'arrow' : 'bolt')[0];
    if (NC.Anim.CLIPS[name]) NC.Anim.play(a.anim, name);
  }
  function beam(from, to, rgb) {
    FX.add({
      type: 'custom', layer: 'glow', life: 0.45, x: from.x, y: from.y, draw(ctx, p, u) {
        const x0 = from.x, y0 = from.y - 80, x1 = to.x, y1 = to.y - 70;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${rgb},${0.7 * (1 - u)})`; ctx.lineWidth = 10 * (1 - u) + 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - 70, x1, y1); ctx.stroke();
        ctx.restore();
      },
    });
  }
  function healCross(x, y) {
    FX.add({
      type: 'custom', layer: 'glow', life: 0.9, x, y, draw(ctx, p, u) {
        const s = 22 + 10 * Math.sin(u * Math.PI), yy = p.y - 120 - 50 * u;
        ctx.save(); ctx.globalAlpha = 1 - u * u;
        ctx.fillStyle = NC.OUTLINE;
        ctx.fillRect(p.x - s * 0.36 - 3, yy - s - 3, s * 0.72 + 6, s * 2 + 6); ctx.fillRect(p.x - s - 3, yy - s * 0.36 - 3, s * 2 + 6, s * 0.72 + 6);
        ctx.fillStyle = '#7dff9a';
        ctx.fillRect(p.x - s * 0.36, yy - s, s * 0.72, s * 2); ctx.fillRect(p.x - s, yy - s * 0.36, s * 2, s * 0.72);
        ctx.restore();
      },
    });
  }
  function heal(game, a, who) {
    const amt = Math.round(who.maxHp * 0.16 + (a.d.matk[0] + a.d.matk[1]) * 0.9);
    const got = Math.max(0, Math.min(amt, who.maxHp - who.hp));
    who.hp += got;
    beam(a, who, '140,255,170');
    FX.num(who.x, who.y - 150, '+' + got, { fill: '#8dff8a', size: 40 });
    FX.ring(who.x, who.y - 8, 20, 120, '140,255,170', 0.5, 8);
    FX.stars(who.x, who.y - 70, 8, '160,255,190', { speed: 150, size: 0.7 });
    healCross(who.x, who.y);
  }
  function explode(game, a, x, y) {
    FX.ring(x, y, 20, 170, '255,170,80', 0.45, 12);
    FX.puff(x, y, 10, { speed: 220, color: '255,150,70', size: 1.1 });
    FX.stars(x, y - 20, 8, '255,200,120', { speed: 260 });
    game.shake = Math.max(game.shake, 5);
    for (const m of game.enemies) if (alive(m) && ((m.x - x) / 150) ** 2 + ((m.y - y) / 95) ** 2 < 1) strike(game, a, m, { kind: 'magic', mul: 2.2, element: 'fire', kx: 0, ky: 0 });
  }
  function trySkill(game, a, W) {
    const P = game.player, R = a.def, e = a.target;
    switch (R.role) {
      case 'tank': {
        const near = game.enemies.filter((m) => alive(m) && dist(m.x, m.y, a.x, a.y) < 380 && engaged(game, m, 'tank'));
        if (!near.length) return;
        for (const m of near) { m.tgt = a; m.tgtLock = game.time + 6; FX.num(m.x, NC.labelTop(m) - 16, '!', { fill: '#ff9a5a', size: 52 }); }
        FX.ring(a.x, a.y - 20, 30, 380, '255,130,90', 0.6, 10);
        FX.text(a.x, a.y - 200, 'มาทางนี้!', '#ffd2a8', 36);
        if (NC.Anim.CLIPS.cheer) NC.Anim.play(a.anim, 'cheer');
        break;
      }
      case 'mage':
        if (!alive(e) || dist(a.x, a.y, e.x, e.y) > 480) return;
        castPose(a, W);
        shoot(game, a, e, { type: 'fire', kind: 'magic', mul: 1, element: 'fire', big: true, onHit: (x, y) => explode(game, a, x, y) });
        break;
      case 'archer':
        if (!alive(e) || dist(a.x, a.y, e.x, e.y) > 520) return;
        castPose(a, W);
        for (const s of [-0.06, 0.06]) shoot(game, a, e, { type: 'arrow', kind: 'phys', mul: 1.4, spread: s });
        FX.stars(a.x + a.face * 40, a.y - 90, 5, '200,255,160', { speed: 120, size: 0.6 });
        break;
      case 'rogue': {
        if (!alive(e) || dist(a.x, a.y, e.x, e.y) > 130 + e.r) return;
        const ang = angle(a.x, a.y, e.x, e.y);
        for (const k of [0, 1]) {
          strike(game, a, e, { kind: 'phys', mul: 1.6, element: 'poison', kx: Math.cos(ang) * 60, ky: Math.sin(ang) * 60 });
          FX.slash(e.x, e.y - 55, ang + (k ? 0.9 : -0.9), 80, '140,255,110', k ? -a.face : a.face);
          if (!alive(e)) break;
        }
        FX.puff(e.x, e.y - 40, 4, { speed: 70, color: '130,220,90', size: 0.7 });
        if (NC.Anim.CLIPS[a.atk.name || '']) NC.Anim.play(a.anim, NC.Anim.setOf({ idle: 'idle', set: 'basic' }).combo(W.style)[2]);
        break;
      }
      case 'healer': {
        const down = members().find((m) => m !== a && m.dead > 0 && dist(a.x, a.y, m.x, m.y) < 450);
        if (down) { a.cast = { t: 0, dur: 1.4, who: down }; castPose(a, W); break; }
        const who = needsHeal(game, a);
        if (!who) return;
        castPose(a, W); heal(game, a, who);
        break;
      }
    }
    a.skillCd = R.skill.cd * rand(0.9, 1.2);
    a.lastFight = game.time;
  }

  // ---------------- being hit, fainting, getting up ----------------
  function hurtAlly(game, a, dmg, fromX) {
    if (a.inv > 0 || a.dead > 0) return;
    // the hero's shields on a friend (ดวงไฟโอบกาย: jobs3_skills_c.js wsSoak), first as on the hero (skilltree.js heroGuards)
    for (const f of NC.allyGuards || []) if (!((dmg = f(game, a, dmg)) > 0)) { a.inv = 0.3; return; }
    if (a.guardUntil > game.time) dmg *= a.guardK || 1; // a protection from the hero's skills (skillkit.js buffFriends)
    if (a.hurtMod) dmg = a.hurtMod(game, a, dmg); // (a summon's own)
    dmg = Math.max(1, Math.round(dmg));
    a.hp -= dmg; a.inv = 0.35; a.hurt = 0.3; a.lastFight = game.time;
    FX.num(a.x, a.y - 150, dmg, { fill: '#ffa0a0', size: 34 });
    NC.tryMove(game.world, a, (Math.sign(a.x - fromX) || 1) * 16, 0);
    if (a.hp <= 0) faint(game, a);
  }
  function faint(game, a) {
    if (a.onFaint) return a.onFaint(game, a); // (bots)
    a.hp = 0; a.dead = 25; a.atk.on = false; a.cast = null; a.target = null;
    FX.puff(a.x, a.y - 30, 8, { speed: 130, color: '120,110,140' });
    NC.HUD.log(`${a.name} หมดแรง · ฟื้นเองใน 25 วิ หรือให้ผู้รักษาชุบชีวิต`, 'warn');
    for (const e of game.enemies) if (e.tgt === a) { e.tgt = null; e.tgtLock = 0; }
  }
  function revive(game, a, frac) {
    a.dead = 0; a.hp = Math.max(1, Math.round(a.maxHp * frac)); a.inv = 1.5;
    FX.ring(a.x, a.y - 10, 20, 170, '255,230,150', 0.7, 10);
    FX.stars(a.x, a.y - 70, 12, '255,236,160', { speed: 200 });
    NC.HUD.log(`${a.name} ลุกขึ้นสู้ต่อแล้ว`, 'item');
  }
  // an attack that covers an area (the Mushroom King's slam and spores): every friend inside takes the monster's hit
  party.hurtArea = function (game, e, x, y, r, mul) {
    for (const a of members()) {
      if (a.dead > 0 || a.inv > 0 || ((a.x - x) / r) ** 2 + ((a.y - y) / (r * 0.58)) ** 2 >= 1) continue;
      const res = NC.monsterHit(e, a.d);
      if (res.miss) { FX.num(a.x, a.y - 150, 'MISS', { fill: '#cfd8ff', size: 30 }); a.inv = 0.3; continue; }
      hurtAlly(game, a, res.dmg * (mul || 1), e.x);
    }
  };

  function warpTo(game, a, slot) {
    const P = game.player, S = SLOTS[slot % SLOTS.length], f = P.face || 1;
    let x = P.x - f * S[0] * 0.7, y = P.y + S[1] * 0.7;
    if (!game.world.fits(x, y, a.r)) { x = P.x; y = P.y; }
    a.x = x; a.y = y; a.vx = a.vy = 0; a.stuck = 0; a.target = null; a.sort = y;
    FX.puff(x, y - 20, 5, { speed: 70, color: '200,210,240' });
  }

  // ---------------- every frame ----------------
  function think(game, a, slot, dt) {
    const P = game.player, world = game.world, W = NC.ITEMS[a.equip.weapon] || {};
    a.inv = Math.max(0, a.inv - dt); a.hurt = Math.max(0, a.hurt - dt);
    a.atk.cd = Math.max(0, a.atk.cd - dt); a.skillCd = Math.max(0, a.skillCd - dt);
    a.combat += ((game.time - a.lastFight < 2.2 ? 1 : 0) - a.combat) * Math.min(1, dt * 8);
    a.moving = false;
    if (a.dead > 0) { a.dead -= dt; if (a.dead <= 0) revive(game, a, 0.3); a.sort = a.y; return; }
    const k0 = a.combat > 0.5 ? 0.5 : 2; // recovery: faster out of a fight
    a.hp = Math.min(a.maxHp, a.hp + a.d.hpRegen * k0 * dt);
    a.sp = Math.min(a.maxSp, a.sp + a.d.spRegen * dt);
    if (a.cast) { // the healer bringing someone back
      a.cast.t += dt;
      const w = a.cast.who;
      if (Math.random() < dt * 14) FX.add({ type: 'ember', x: w.x + rand(-30, 30), y: w.y - rand(0, 40), vx: 0, vy: rand(-120, -60), life: 0.7 });
      if (w.dead <= 0 || !members().includes(w)) a.cast = null;
      else if (a.cast.t >= a.cast.dur) { beam(a, w, '255,236,160'); revive(game, w, 0.5); a.cast = null; }
      a.sort = a.y; return;
    }
    const dP = dist(a.x, a.y, P.x, P.y);
    if (dP > 1400) { warpTo(game, a, slot); return; }
    if ((a.retarget -= dt) <= 0 || (a.target && !valid(game, a, a.target))) { a.target = pick(game, a); a.retarget = rand(0.5, 0.9); }
    if (a.skillCd <= 0 && P.dead <= 0 && !a.atk.on) trySkill(game, a, W);
    if (a.cast) return;
    const e = P.dead > 0 ? null : a.target;
    let gx, gy, speed = 330;
    if (e) {
      const de = dist(a.x, a.y, e.x, e.y), reach = a.def.range || (W.reach || 90) * 0.7 + e.r;
      if (de > reach) { gx = e.x; gy = e.y; }
      else if (a.def.range && de < reach * 0.45) { const ang = angle(e.x, e.y, a.x, a.y); gx = a.x + Math.cos(ang) * 140; gy = a.y + Math.sin(ang) * 90; }
      else if (!a.atk.on && a.atk.cd <= 0) attack(game, a, e, W);
      a.aim = angle(a.x, a.y - 50, e.x, e.y - 45);
      if (!a.atk.on) a.face = Math.cos(a.aim) >= 0 ? 1 : -1;
      if (dist(e.x, e.y, P.x, P.y) > 820) a.target = null; // don't run off after it
    } else {
      const S = SLOTS[slot % SLOTS.length], f = P.face || 1;
      gx = P.x - f * S[0]; gy = P.y + S[1];
      if (dist(a.x, a.y, gx, gy) < 44) gx = undefined;
      speed = dP > 380 ? 345 : 240;
      if (gx === undefined && !P.moving) a.face = P.face || a.face;
    }
    let mx = 0, my = 0;
    if (gx !== undefined) { const d = dist(a.x, a.y, gx, gy); if (d > 6) { mx = (gx - a.x) / d; my = (gy - a.y) / d; } }
    // friends keep a little space from each other and from the hero
    for (const o of [P, ...members()]) {
      if (o === a || o.dead > 0) continue;
      const d = dist(a.x, a.y, o.x, o.y);
      if (d > 0 && d < 46) { mx += ((a.x - o.x) / d) * 0.7; my += ((a.y - o.y) / d) * 0.7; }
    }
    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    const sp = speed * (a.atk.on ? 0.35 : 1), k = 1 - Math.exp(-dt * 12);
    a.vx += (mx * sp - a.vx) * k; a.vy += (my * sp - a.vy) * k;
    const ox = a.x, oy = a.y;
    NC.tryMove(world, a, a.vx * dt, a.vy * dt);
    const moved = Math.hypot(a.x - ox, a.y - oy) / Math.max(dt, 1e-3);
    a.moving = moved > 40;
    a.running = a.moving && moved > (a.running ? 170 : 210);
    if (a.moving) a.walk += dt * moved * (a.running ? 0.0663 : 0.085);
    if (a.moving && !e && Math.abs(a.vx) > 30) a.face = a.vx > 0 ? 1 : -1;
    if ((Math.abs(mx) + Math.abs(my) > 0.5) && moved < 20) { if ((a.stuck += dt) > 2.2) warpTo(game, a, slot); } else a.stuck = 0;
    a.sort = a.y;
  }

  // the rig's pose, like the hero's (entities.js updateHeroAnim): base walk / run / stance, attacks on top
  function animate(game, a, dt) {
    const Anim = NC.Anim, st = a.anim, W = NC.ITEMS[a.equip.weapon] || {};
    const SET = Anim.setOf(Anim.movesFor({ idle: 'idle', set: 'basic' }, W));
    const move = a.running ? (a.combat > 0.5 ? 'runReady' : 'run') : a.combat > 0.5 ? 'walkReady' : 'walk';
    const base = a.dead > 0 ? 'death' : a.moving ? move : a.combat > 0.5 ? SET.ready : 'idle';
    if (st.base === 'death' && base !== 'death') { st.from = null; st.base = base; st.baseT = 0; }
    Anim.setBase(st, base, base === 'death' ? 0.06 : 0.16);
    if (a.dead > 0 && st.act) { st.act = null; a.atk.on = false; }
    Anim.update(st, dt, a.atk.on ? NC.atkSpeed(a, W) : 1, (ev) => { if (ev === 'hit' && a.atk.on) allyHit(game, a, W); });
    if (a.atk.on && (st.act !== a.atk.name || st.outT >= 0)) {
      a.atk.on = false; a.atk.lastEnd = game.time; a.atk.chain = a.atk.step;
      a.atk.cd = a.atk.step === 2 ? rand(0.7, 1.1) : rand(0.08, 0.2);
    }
    // Keep clocks and hit callbacks above live everywhere. Only skip an idle/walking rig's visual pose;
    // attacks, revives and effects that read weaponLine still need an up-to-date pose off screen.
    const cam = game.cam;
    if (a.pose && !st.act && !a.atk.on && !a.cast && !a.dash && !a.channel && !(a.skillLock > 0) &&
        !(a.dead > 0) && !(a.hurt > 0) && !(a.buffs && a.buffs.fireblade > 0) &&
        cam && game.vw > 0 && game.vh > 0 &&
        (a.x < cam.x - 400 || a.x > cam.x + game.vw + 400 || a.y < cam.y - 400 || a.y > cam.y + game.vh + 400)) {
      a.hatS.init = false; // do not turn the gap between sampled poses into a spring impulse on re-entry
      return;
    }
    const aim = a.atk.on ? a.atk.ang : a.aim;
    const al = Math.atan2(Math.sin(a.face > 0 ? aim : Math.PI - aim), Math.cos(a.face > 0 ? aim : Math.PI - aim));
    const c = NC.animCtx(a.equip, { al: clamp(al, -1.2, 1.2), walk: a.walk, moving: a.moving, hurt: a.hurt / 0.3, idleStyle: 'idle', ready: SET.ready });
    const P = Anim.evaluate(st, c);
    P.face = a.face;
    NC.hatSpring(a.hatS, a.equip, P, a.vx * a.face, dt);
    a.pose = P;
  }

  let last = null;
  party.update = function (game, dt) {
    const P = game.player, M = members();
    if (NC.Bots) NC.Bots.update(game, dt); // the other adventurers on this map (bots.js)
    if (!M.length) { last = null; return; }
    // the hero jumped (a portal, a respawn at the camp): everyone comes along
    if (last && Math.hypot(P.x - last[0], P.y - last[1]) > 600) M.forEach((a, i) => warpTo(game, a, i));
    last = [P.x, P.y];
    M.forEach((a, i) => {
      if (a.lv !== P.lv) rebuild(a, P.lv);
      think(game, a, i, dt);
      animate(game, a, dt);
    });
    updateBox();
  };
  // a new map: stand around the hero where he arrived
  party.onMap = function (game) {
    last = null;
    if (NC.Bots) NC.Bots.onMap(game);
    members().forEach((a, i) => { warpTo(game, a, i); a.atk.on = false; a.cast = null; });
  };

  // ---------------- drawing (game.js puts friends in the depth-sorted list) ----------------
  party.collect = function (list, visible) {
    for (const a of actors()) if (a.pose && visible(a.x - 120, a.y - 220, a.x + 120, a.y + 40)) list.push(a);
  };
  party.draw = function (ctx, game, a) {
    if (!a.pose) return;
    const blink = a.dead <= 0 && a.inv > 0 && a.hurt <= 0 && Math.floor(game.time * 20) % 2 === 0;
    const tint = a.hurt > 0 && a.dead <= 0 ? ['#ff5a5a', (a.hurt / 0.3) * 0.6] : a.dead > 0 ? ['#8a90b0', 0.4] : null;
    NC.drawHero(ctx, a.equip, a.pose, a.x, a.y, { alpha: (a.dead > 0 ? 0.8 : blink ? 0.6 : 1) * (a.fade === undefined ? 1 : a.fade), tint });
  };
  function bar(ctx, x, y, w, h, f, col) {
    ctx.fillStyle = NC.OUTLINE; NC.rrect(ctx, x - 3, y - 3, w + 6, h + 6, (h + 6) / 2); ctx.fill();
    ctx.fillStyle = '#3b3346'; NC.rrect(ctx, x, y, w, h, h / 2); ctx.fill();
    if (f > 0) { ctx.fillStyle = col; NC.rrect(ctx, x, y, Math.max(h, w * clamp(f, 0, 1)), h, h / 2); ctx.fill(); }
  }
  party.drawTags = function (ctx, game) {
    for (const a of members()) {
      if (!a.pose) continue;
      const w = 88, x = a.x - w / 2, y = a.y + 20, f = a.hp / a.maxHp;
      bar(ctx, x, y, w, 9, f, a.dead > 0 ? '#6c6878' : f > 0.5 ? '#6ad36a' : f > 0.25 ? '#f2c14e' : '#ee5a5a');
      if (NC.drawTag) NC.drawTag(ctx, a.name, a.x, y + 32, 21, a.def.color);
      if (a.dead > 0 && NC.drawTag) NC.drawTag(ctx, `หมดแรง ${Math.ceil(a.dead)}`, a.x, a.y - 120, 20, '#d6dbff');
      if (a.cast) { // the revive circle
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const u = a.cast.t / a.cast.dur, w2 = a.cast.who;
        ctx.strokeStyle = `rgba(255,230,150,${0.5 + 0.3 * Math.sin(game.time * 12)})`; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.ellipse(w2.x, w2.y, 70, 40, 0, -Math.PI / 2, -Math.PI / 2 + TAU * u); ctx.stroke();
        ctx.restore();
      }
    }
    if (NC.Bots) NC.Bots.drawTags(ctx, game, bar);
  };

  // ---------------- monsters picking a friend as their target ----------------
  const baseUpdate = NC.updateEnemy;
  NC.updateEnemy = function (game, e, dt) {
    let t = e.tgt;
    if (t && (t.dead > 0 || !actors().includes(t))) { e.tgt = t = null; e.tgtLock = 0; }
    if (!t) return baseUpdate(game, e, dt);
    const real = game.player;
    game.player = t; party.swapped = real;
    try { baseUpdate(game, e, dt); } finally { game.player = real; party.swapped = null; }
  };
  const baseHurt = NC.hurtPlayer;
  NC.hurtPlayer = function (game, dmg, fromX) {
    const t = game.player;
    if (t && t.kind === 'ally') return hurtAlly(game, t, dmg, fromX);
    return baseHurt(game, dmg, fromX);
  };
  // who a monster goes for after a hit: the friend who hit it (sometimes), the hero (sometimes); a provoke holds
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    baseDamage(game, e, r, kx, ky, o);
    if (!alive(e) || r.miss || e.tgtLock > game.time) return;
    if (hitter) { if (!e.tgt ? dist(e.x, e.y, game.player.x, game.player.y) > 420 || Math.random() < 0.35 : Math.random() < 0.3) e.tgt = hitter; }
    else if (e.tgt && Math.random() < 0.5) e.tgt = null;
  };

  // ---------------- joining and leaving ----------------
  function save(game) {
    if (game.noSave) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(members().map((a) => a.id))); } catch (e) { /* storage blocked */ }
  }
  party.invite = function (game, id) {
    const def = BY_ID[id];
    if (!def || members().some((a) => a.id === id) || members().length >= MAX) return false;
    const a = make(def, game.player.x, game.player.y);
    rebuild(a, game.player.lv);
    party.members.push(a);
    warpTo(game, a, party.members.length - 1);
    FX.ring(a.x, a.y - 10, 20, 150, '255,230,150', 0.6, 9);
    FX.stars(a.x, a.y - 80, 10, '255,236,160', { speed: 180 });
    NC.HUD.log(`${def.name} (${NC.JOBS[def.job].name}) เข้าร่วมปาร์ตี้`, 'item');
    save(game); renderBox();
    return true;
  };
  party.leave = function (game, id) {
    const i = members().findIndex((a) => a.id === id);
    if (i < 0) return;
    const a = party.members[i];
    FX.puff(a.x, a.y - 30, 8, { speed: 110, color: '200,210,240' });
    for (const e of game.enemies) if (e.tgt === a) { e.tgt = null; e.tgtLock = 0; }
    party.members.splice(i, 1);
    NC.HUD.log(`${a.name} ออกจากปาร์ตี้`, 'sys');
    save(game); renderBox();
  };

  // ---------------- the party list (under the hero's frame) ----------------
  function face(cv, equip) {
    const c = cv.getContext('2d'), S = cv.width;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, S, S);
    c.save();
    c.beginPath(); c.arc(S / 2, S / 2, S * 0.46, 0, TAU); c.clip();
    c.fillStyle = '#f3e7cf'; c.fillRect(0, 0, S, S);
    const hs = NC.headSpot(equip), k = (S * 0.77) / hs.w;
    NC.drawAvatar(c, equip, S / 2 - hs.x * k, S * 0.58 - hs.y * k, k, 1, { noWeapon: true });
    c.restore();
  }
  let box = null;
  function renderBox() {
    if (!box) return;
    box.innerHTML = members().map((a) =>
      `<div class="pm" data-id="${a.id}"><div class="pm-face"><canvas width="96" height="96"></canvas></div><div class="pm-body">` +
      `<div class="pm-top"><span class="pm-name" style="color:${a.def.color}">${a.name}</span><span class="pm-job">${NC.JOBS[a.def.job].name} · Lv <b></b></span></div>` +
      `<div class="pm-bar hp"><i></i><em></em></div><div class="pm-bar sp"><i></i></div></div></div>`).join('');
    members().forEach((a, i) => face(box.children[i].querySelector('canvas'), a.equip));
    box.hidden = !members().length;
  }
  function updateBox() {
    if (!box) return;
    members().forEach((a, i) => {
      const row = box.children[i];
      if (!row) return;
      const hp = row.querySelector('.hp i'), sp = row.querySelector('.sp i'), txt = row.querySelector('.hp em'), lv = row.querySelector('.pm-job b');
      hp.style.width = (100 * clamp(a.hp / a.maxHp, 0, 1)).toFixed(1) + '%';
      sp.style.width = (100 * clamp(a.sp / a.maxSp, 0, 1)).toFixed(1) + '%';
      const t = a.dead > 0 ? `หมดแรง ${Math.ceil(a.dead)} วิ` : `${Math.ceil(a.hp)} / ${a.maxHp}`;
      if (txt.textContent !== t) txt.textContent = t;
      if (lv.textContent !== String(a.lv)) lv.textContent = a.lv;
      row.classList.toggle('down', a.dead > 0);
      row.classList.toggle('low', a.dead <= 0 && a.hp / a.maxHp < 0.3);
    });
  }

  // ---------------- start-up: hooks into the HUD ----------------
  // (the party window, P, is js/partywin.js; the old dark one built here is gone, 2026-10-21)
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    box = document.createElement('div');
    box.id = 'partybox'; box.className = 'partybox'; box.hidden = true;
    $('hud').appendChild(box);
    // the menu button (P), before the gear (ESC)
    const bar = document.querySelector('.menubar'), gear = bar && bar.querySelector('[data-panel="pause"]');
    if (bar) {
      const b = document.createElement('button');
      b.className = 'mbtn'; b.title = 'ปาร์ตี้ (P)';
      b.innerHTML = '<img src="assets/ic_party.png" alt=""><b>P</b>';
      b.addEventListener('click', () => { game.paused = NC.HUD.panel('party'); });
      bar.insertBefore(b, gear || null);
    }
    // The AI friends are a test tool only (the user, 2026-09-30: a party is real players, js/partynet.js): nobody comes back
    // from last time (2026-10-21: no ?party / ?aiparty switches any more)
    const ids = [];
    for (const id of ids.slice(0, MAX)) if (BY_ID[id]) {
      const a = make(BY_ID[id], game.player.x, game.player.y);
      rebuild(a, game.player.lv);
      party.members.push(a);
    }
    party.onMap(game);
    renderBox();
  };
  // the pieces bots.js builds its adventurers from
  party.lib = { make, rebuild, animate, attack, strike, shoot, explode, heal, hurtAlly, castPose, alive, revive };

  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyP' || e.repeat || !NC.game || !NC.game.player) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    NC.game.paused = NC.HUD.panel('party');
  });
})();
