/* wabil.js — what a weapon does besides its damage: the abilities of the greatswords (js/greatswords.js, it.gs.abil)
   and the option rows of the copy in hand (js/wbag.js NC.WBAG.rowEffects). One list of specs per hero, run from the
   engine's hooks:
     stat changes           aspd (%), stat (flat str..luk, def...), mods (the rows: atk / crit / aspd %, stats)
                            -> NC.skillModSources (read when the gear changes)
     damage on every hit    vsRace (race), vsEl (the monster's element), vsBig (bosses and big ones / small ones),
                            vsPoisoned, lowHp (up to max % at `at` % HP), night (by night / by day)   -> NC.heroHit
     on the weapon's hits   leech (pct of the damage, sp per swing; night / poisoned only), hpCost (% HP per swing),
                            status (chance % of burn / chill (freeze3) / poison (+slow) / shock / crack / curse / bleed),
                            proc (chance % of a spell: windline lightning spores bats holyburst icespikes firepillar
                            fireballs meteor breath), summon (chance % of helpers), every (n hits -> a spell),
                            pierce (the one behind the target takes pct %)                        -> NC.basicHits
     on a kill              killHeal (% HP), killSp (SP), killSummon (helpers)                    -> NC.skillKills
     when hit               reflect (% back to the attacker), resist (% less from an element)     -> NC.heroGuards
     all the time           dayNight (the weapon's element by day / by night)                     -> NC.skillTicks
   The spells hit as hidden skills (wp_*: physical, never miss, x the hero's ATK), so resonance / statuses / the
   damage numbers treat them like skills. Helpers (the ant queen's soldiers, the grave king's skeletons) are ghosts of
   those monsters fighting for 10 s, drawn among the characters (NC.Party.collect / draw). Races: NC.RACES / NC.raceOf. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, SK = NC.SKILLS, K = NC.SkillKit, ITEMS = NC.ITEMS, P = NC.Party;
  const C = V.RGB, PAL = V.PAL, TAU = Math.PI * 2, rand = NC.rand, clamp = NC.clamp;
  const alive = (e) => e && !e.dead && e.hp > 0;

  // ---------------- races and sizes ----------------
  NC.RACES = { plant: 'พืช', brute: 'สัตว์', insect: 'แมลง', undead: 'อมตะ', spirit: 'วิญญาณ', formless: 'ไร้รูป', dragon: 'มังกร' };
  const RACE_OF = {};
  const race = (r, ids) => ids.split(' ').forEach((id) => { RACE_OF[id] = r; });
  race('plant', 'stump char_stump pumpkin carrot maneater mushling mushking elder_treant scarecrow');
  race('brute', 'boar wolf bat fire_bat frog crab turtle ember_fox cloud_ram poison_toad swamp_snake crow storm_eagle shadow_heron bat_king');
  race('insect', 'bee moth scorpion dragonfly rhino_beetle cave_spider worker_ant soldier_ant flying_ant ant_queen');
  race('undead', 'skeleton zombie bone_knight crypt_lord');
  race('spirit', 'ghost tombstone ash_wisp gust_sprite mist_wraith candle_wisp fire_imp kappa');
  race('formless', 'golem magma_golem lava_worm');
  race('dragon', 'lava_dragon salamander raptor');
  NC.raceOf = (e) => RACE_OF[e.type] || (/^slime/.test(e.type || '') ? 'formless' : 'brute');
  const isBoss = (e) => !!((NC.BOSSES && NC.BOSSES[e.type]) || e.boss || e.isBoss);
  NC.isBigMon = (e) => isBoss(e) || (e.r || 24) >= 34;
  NC.isSmallMon = (e) => !isBoss(e) && (e.r || 24) <= 22;

  // 0 by day, 1 at night (hud.js's dial); a dungeon is always dark
  const nightK = (game) => {
    const hr = ((((game.minutes || 0) / 60) % 24) + 24) % 24, n = hr < 5.5 || hr >= 19 ? 1 : hr < 7 ? (7 - hr) / 1.5 : hr >= 17.5 ? (hr - 17.5) / 1.5 : 0;
    const M = NC.MAPS && NC.MAPS[game.mapId];
    return M && M.dungeon ? 1 : n;
  };
  NC.nightK = NC.nightK || nightK;

  // ---------------- the hero's list ----------------
  const NONE = [];
  function effects(p) {
    const W = p && p.equip && ITEMS[p.equip.weapon];
    const own = (W && (W.abil || (W.gs && W.gs.abil))) || NONE; // (it.abil: js/wabil_data.js, every catalog weapon)
    const rows = NC.WBAG && p.kind === 'player' ? NC.WBAG.rowEffects(p) : NONE;
    const more = NC.gearFx && p.kind === 'player' ? NC.gearFx(p) : NONE; // (set passives, boss sets: js/setfx.js)
    return rows.length || more.length ? own.concat(rows, more) : own;
  }
  NC.weaponEffects = effects;

  // stat changes (read when the gear changes: NC.applyGear)
  NC.skillModSources.push((p) => {
    let m = null;
    for (const a of effects(p)) {
      if (a.t === 'aspd') { m = m || {}; m.aspd = (m.aspd || 0) + a.v; }
      else if (a.t === 'stat' || a.t === 'mods') { m = m || {}; for (const k in a) if (k !== 't') m[k] = (m[k] || 0) + a[k]; }
    }
    return m;
  });

  // ---------------- damage on every hit (the weapon's and the skills') ----------------
  const baseHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHit(d, e, o), G = NC.game, p = G && G.player;
    if (!p || p.kind !== 'player' || d !== p.d || !e || !(r.dmg > 0)) return r;
    e._heroT = G.time;
    const fx = effects(p);
    if (!fx.length) return r;
    let k = 1;
    for (const a of fx) {
      if (a.t === 'vsRace') { if (NC.raceOf(e) === a.race) k *= 1 + a.pct / 100; }
      else if (a.t === 'vsEl') { if (a.els.includes(e.element || 'neutral')) k *= 1 + a.pct / 100; }
      else if (a.t === 'vsBig') { if (NC.isBigMon(e)) k *= 1 + a.pct / 100; else if (NC.isSmallMon(e)) k *= 1 + a.small / 100; }
      else if (a.t === 'vsPoisoned') { if (e.poison && e.poison.t > 0) k *= 1 + a.pct / 100; }
      else if (a.t === 'lowHp') { const f = p.hp / Math.max(1, p.maxHp); k *= 1 + (a.max / 100) * clamp((1 - f) / (1 - a.at / 100), 0, 1); }
      else if (a.t === 'night') { const n = nightK(G); k *= 1 + (n * a.night + (1 - n) * a.day) / 100; }
    }
    if (k !== 1) r.dmg = Math.max(1, Math.round(r.dmg * k));
    return r;
  };

  // ---------------- the spells: hidden physical skills that never miss ----------------
  const PS = (id, name, element) => { SK[id] = { id, name, kind: 'active', active: true, hidden: true, max: 1, type: 'phys', element, mul: () => 1, sp: () => 0, cd: 0 }; };
  PS('wp_wind', 'ใบมีดลม', 'wind'); PS('wp_bolt', 'ฟ้าผ่า', 'wind'); PS('wp_spore', 'สปอร์พิษ', 'poison'); PS('wp_bats', 'ฝูงค้างคาว', 'shadow');
  PS('wp_holy', 'แสงศักดิ์สิทธิ์', 'holy'); PS('wp_ice', 'หนามน้ำแข็ง', 'water'); PS('wp_pillar', 'เสาเพลิง', 'fire'); PS('wp_fireball', 'ลูกไฟ', 'fire');
  PS('wp_meteor', 'อุกกาบาต', null); PS('wp_breath', 'ลมหายใจมังกร', 'fire'); PS('wp_crescent', 'คลื่นเสี้ยวจันทร์', null); PS('wp_helper', 'ผู้ช่วย', null);
  const hand = (p) => NC.skillHelpers.hand(p);
  const SPELL = {
    windline(game, p, e, a) {
      K.shot(game, p, 'wp_wind', { from: hand(p), ang: NC.angle(p.x, p.y - 45, e.x, e.y - 45), v: 1050, range: 560, pierce: true, r: 46, style: 'blade',
        rgb: '170,240,200', fill: '#e6fff0', size: 1.7, mul: a.mul, kb: 120, sure: true,
        trail: (q) => { if (Math.random() < 0.5) V.sparks(q.x, q.y, 1, '170,240,200', { size: 0.6, max: 200 }); } });
    },
    lightning(game, p, e, a) {
      V.boltAt(e.x + rand(-30, 30), e.y - 760, e.x, e.y - 40, '255,236,120', 0.3, { w: 8, jag: 34, seg: 11 });
      V.flare(e.x, e.y - 50, 120, '255,236,120', 0.3); V.shake(game, 5);
      V.glowAt(e.x, e.y - 30, 20, 150, '255,236,120', 0.9, 0.3, { hot: true });
      const res = K.hit(game, p, 'wp_bolt', e, 0, 0, '255,236,120', a.mul, { sure: true, big: true });
      if (res && !res.miss && a.st) NC.addStatus(game, e, a.st);
    },
    spores(game, p, e, a) {
      V.smoke(e.x, e.y - 20, 8, '#b98cff', '#e6d6ff', { size: 1.1, lifeK: 0.8, a: 0.7 });
      K.nova(game, p, 'wp_spore', e.x, e.y, 130, { rgb: '190,140,255', kb: 60, mul: a.mul, sure: true, stars: 0, shake: 3,
        each: (x, res) => { if (res && !res.miss) K.poison(game, p, x, 5, 0.25); } });
    },
    bats(game, p, e, a) {
      for (let i = 0; i < (a.n || 3); i++) V.at(i * 0.13, () => {
        if (!alive(e)) return;
        K.shot(game, p, 'wp_bats', { from: [p.x + rand(-40, 40), p.y - 120 + rand(-30, 20)], ang: NC.angle(p.x, p.y - 120, e.x, e.y - 45) + rand(-0.6, 0.6),
          v: 820, range: 900, home: 9, target: e, r: 30, mul: a.mul, kb: 60, sure: true,
          look: (ctx, q) => {
            if (!NC.SPR.bat) return K.drawOrb(ctx, q.x, q.y, 9, '175,140,235');
            V.glow(ctx, q.x, q.y, 34, '175,140,235', 0.5, true);
            NC.drawSpr(ctx, Math.sin(q.t * 40) > 0 ? 'bat' : (NC.SPR.bat_b ? 'bat_b' : 'bat'), q.x, q.y + 18, { scale: 0.42, flip: q.vx > 0 });
          } });
      });
    },
    holyburst(game, p, e, a) {
      K.heal(game, p, p.maxHp * (a.heal || 3) / 100);
      K.nova(game, p, 'wp_holy', p.x, p.y, 150, { rgb: C.holy, kb: 110, mul: a.mul, sure: true, stars: 8, starFill: '#fff3c0', shake: 3 });
    },
    icespikes(game, p, e, a) {
      const n = 6, ang = NC.angle(p.x, p.y, e.x, e.y), step = 46, hit = new Set();
      for (let i = 0; i < n; i++) V.at(i * 0.04, () => {
        const x = e.x + Math.cos(ang) * (i - 1) * step, y = e.y + Math.sin(ang) * (i - 1) * step * V.SQ;
        V.spikeAt(x, y, 30, 100, PAL.ice, 0.8, { glowA: 0.4, rgb: '150,215,255', rise: 0.06, sink: true });
        for (const x2 of K.around(game, x, y, 52)) if (!hit.has(x2)) {
          hit.add(x2);
          const res = K.hit(game, p, 'wp_ice', x2, 0, 0, '150,215,255', a.mul, { sure: true });
          if (res && !res.miss && a.freeze) K.freeze(game, x2, a.freeze);
        }
      });
    },
    firepillar(game, p, e, a) {
      K.flames(e.x, e.y, 5, 50, { pal: PAL.fire, k: 0.9 });
      K.pillar(game, p, 'wp_pillar', e.x, e.y, 95, { rgb: '255,140,60', delay: 0.16, mul: a.mul, sure: true, stars: 0, pal: PAL.fire,
        each: (x, res) => { if (res && !res.miss && a.st) NC.addStatus(game, x, a.st); } });
    },
    fireballs(game, p, e, a) {
      const near = [e, ...game.enemies.filter((x) => x !== e && alive(x) && NC.dist(x.x, x.y, p.x, p.y) < 600)].slice(0, a.n || 2);
      for (let i = 0; i < (a.n || 2); i++) V.at(i * 0.1, () => {
        const t = near[i % near.length];
        if (!alive(t)) return;
        K.shot(game, p, 'wp_fireball', { from: hand(p), ang: NC.angle(p.x, p.y - 45, t.x, t.y - 45) + (i ? 0.5 : -0.5), v: 760, range: 900, home: 7, target: t,
          r: 36, rgb: '255,140,60', size: 1.2, mul: a.mul, kb: 120, sure: true, core: '#fff0c0',
          trail: (q) => { if (Math.random() < 0.6) V.flameAt(q.x, q.y + 10, 22, 34, PAL.fire, 0.3, { vy: -40 }); } });
      });
    },
    meteor(game, p, e, a) {
      const tx = e.x, ty = e.y, sx = tx + 260, sy = ty - 980, t = 0.5;
      V.circle(tx, ty, 170, '255,150,70', t + 0.3, { style: 'holy', spin: 2, grow: true });
      K.proj({ x: sx, y: sy, vx: (tx - sx) / t, vy: (ty - 30 - sy) / t, life: t,
        draw(ctx, q) {
          V.glow(ctx, q.x, q.y, 110, '255,150,70', 0.8, true);
          ctx.save(); ctx.fillStyle = '#5b4a52'; ctx.strokeStyle = NC.OUTLINE; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(q.x, q.y, 34, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ff9a4a'; ctx.beginPath(); ctx.arc(q.x - 8, q.y - 8, 12, 0, TAU); ctx.fill(); ctx.restore();
        },
        update(q) { if (Math.random() < 0.9) V.flameAt(q.x + rand(-14, 14), q.y + rand(-14, 14), 34, 60, PAL.fire, 0.35, { vy: -80 }); },
        onEnd() {
          V.flash('255,190,120', 0.12, 0.3);
          V.smoke(tx, ty - 10, 10, '#4a4048', '#8a7a80', { size: 1.4, lifeK: 1 });
          K.flames(tx, ty, 8, 120, { pal: PAL.fire, k: 1.1 });
          K.nova(game, p, 'wp_meteor', tx, ty, 200, { rgb: '255,150,70', kb: 240, mul: a.mul, sure: true, shake: 12, stars: 0, decal: 'crack', big: true });
        } });
    },
    breath(game, p, e, a) {
      const ang = NC.angle(p.x, p.y, e.x, e.y);
      for (let i = 0; i < 12; i++) V.at(i * 0.025, () => {
        const d = 60 + i * 24, sp = rand(-0.45, 0.45) * (d / 300);
        V.flameAt(p.x + Math.cos(ang + sp) * d, p.y + Math.sin(ang + sp) * d * V.SQ, 34 + i * 3, 60 + i * 4, PAL.fire, 0.45, { vy: -60 });
      });
      V.glowAt(p.x + Math.cos(ang) * 150, p.y - 30, 30, 220, '255,140,60', 0.8, 0.35, { hot: true });
      K.cone(game, p, 'wp_breath', 320, 0.6, { ang, kb: 130, mul: a.mul, color: '255,140,60',
        each: (x, res) => { if (res && !res.miss && a.st) NC.addStatus(game, x, a.st); } });
    },
    crescent(game, p, e, a) {
      const night = nightK(game) >= 0.5, rgb = night ? '170,150,255' : '255,220,140';
      K.shot(game, p, 'wp_crescent', { from: [p.x, p.y - 60], ang: NC.angle(p.x, p.y - 60, e.x, e.y - 45), v: 900, range: 720, pierce: true, r: 80, rgb,
        mul: a.mul, kb: 160, sure: true, big: true,
        trail: (q) => { if (Math.random() < 0.7) V.sparks(q.x + rand(-20, 20), q.y + rand(-60, 60), 1, rgb, { size: 0.7, max: 160 }); },
        look: (ctx, q) => { // a fat crescent of light: a filled moon shape, a soft glow round it
          const ang = Math.atan2(q.vy, q.vx), R = 105;
          V.glow(ctx, q.x, q.y, 170, rgb, 0.55, true);
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(ang);
          const moon = (k) => { ctx.beginPath(); ctx.arc(-30, 0, R * k, -1.25, 1.25); ctx.arc(-70, 0, R * k * 1.02, 1.05, -1.05, true); ctx.closePath(); };
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(${rgb},0.45)`; moon(1.15); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = `rgba(${rgb},0.95)`; ctx.strokeStyle = NC.OUTLINE; ctx.lineWidth = 4; moon(1); ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(-30, 0, R * 0.92, -0.9, 0.9); ctx.arc(-44, 0, R * 0.9, 0.8, -0.8, true); ctx.closePath(); ctx.fill();
          ctx.restore();
        } });
      V.flash(rgb, 0.06, 0.2);
    },
  };

  // ---------------- statuses from the weapon ----------------
  const ST_TH = { bleed: 'เลือดไหล' };
  function status(game, p, e, a) {
    if (a.st === 'poison') { K.poison(game, p, e, 5, 0.25); if (a.slow) K.slow(e, a.slow); return; }
    if (a.st === 'bleed') {
      const had = e.wpBleed && e.wpBleed.t > 0;
      e.wpBleed = { t: 5, acc: 0, dmg: Math.max(1, Math.round(p.d.batk * 0.12)) };
      if (!had) FX.num(e.x, e.y - 150, ST_TH.bleed, { fill: '#ff6a6a', size: 26 });
      return;
    }
    NC.addStatus(game, e, a.st);
    if (a.st === 'chill' && a.freeze3) {
      const s = NC.statusOf(e, 'chill');
      if (s && s.n >= 3) { s.n = 0; s.t = 0; K.freeze(game, e, 1.4); V.sparks(e.x, e.y - 50, 8, '150,215,255', { size: 0.8 }); }
    }
  }

  // ---------------- helpers: ghosts of monsters that fight for a while ----------------
  const HELP = { ant: { spr: 'soldier_ant', mul: 0.55, rgb: '255,200,120' }, skeleton: { spr: 'skeleton', mul: 0.7, rgb: '190,215,255' } };
  const helpers = [];
  let helperMap = null;
  function summon(game, p, e, a) {
    const H = HELP[a.kind];
    if (!H || !NC.SPR[H.spr]) return;
    const mine = helpers.filter((h) => h.kind === a.kind);
    if (mine.length >= (a.max || 2)) mine[0].t = a.dur; // (at the most: the oldest one is renewed)
    else {
      const x = (e ? e.x : p.x) + rand(-60, 60), y = (e ? e.y : p.y) + rand(-30, 30);
      helpers.push({ wHelper: true, kind: a.kind, spr: H.spr, mul: H.mul, rgb: H.rgb, x, y, sort: y, t: a.dur, face: 1, atkT: 0.4, pose: 0, dead: 0 });
      helperMap = game.mapId;
      V.ring(x, y, 12, 90, 6, H.rgb, 0.4); V.smoke(x, y - 10, 6, '#cfc6e0', '#ffffff', { size: 0.9, lifeK: 0.7 });
      FX.num(x, y - 140, 'มาช่วยแล้ว!', { fill: `rgb(${H.rgb})`, size: 24 });
    }
  }
  function updateHelpers(game, p, dt) {
    if (!helpers.length) return;
    if (game.mapId !== helperMap || p.dead > 0) { helpers.length = 0; return; }
    for (let i = helpers.length - 1; i >= 0; i--) {
      const h = helpers[i];
      h.t -= dt; h.atkT -= dt; h.pose = Math.max(0, h.pose - dt);
      if (h.t <= 0) { V.smoke(h.x, h.y - 20, 6, '#cfc6e0', '#ffffff', { size: 0.8, lifeK: 0.6 }); helpers.splice(i, 1); continue; }
      if (!alive(h.target) || NC.dist(h.target.x, h.target.y, p.x, p.y) > 520)
        h.target = game.enemies.filter((e) => alive(e) && NC.dist(e.x, e.y, p.x, p.y) < 480).sort((a, b) => NC.dist(a.x, a.y, h.x, h.y) - NC.dist(b.x, b.y, h.x, h.y))[0] || null;
      const tx = h.target ? h.target.x : p.x - 80 * (p.face || 1), ty = h.target ? h.target.y : p.y + 20, d = NC.dist(h.x, h.y, tx, ty);
      const stop = h.target ? 70 + (h.target.r || 24) : 40;
      if (d > stop) { const k = Math.min(1, (260 * dt) / d); h.x += (tx - h.x) * k; h.y += (ty - h.y) * k; }
      if (Math.abs(tx - h.x) > 6) h.face = tx > h.x ? 1 : -1;
      h.sort = h.y;
      if (h.target && d <= stop + 10 && h.atkT <= 0) {
        h.atkT = 0.9; h.pose = 0.25;
        K.hit(game, p, 'wp_helper', h.target, h.face * 90, 0, h.rgb, h.mul, { sure: true });
        V.sparks(h.target.x, h.target.y - 40, 5, h.rgb, { size: 0.7 });
      }
    }
  }
  const baseCollect = P.collect;
  P.collect = function (list, visible) {
    baseCollect.call(P, list, visible);
    for (const h of helpers) if (visible(h.x - 100, h.y - 180, h.x + 100, h.y + 30)) list.push(h);
  };
  const baseDraw = P.draw;
  P.draw = function (ctx, game, a) {
    if (!a.wHelper) return baseDraw.call(P, ctx, game, a);
    const bob = Math.abs(Math.sin(game.time * 9 + a.x * 0.01)) * 5, fade = clamp(a.t / 0.5, 0, 1);
    ctx.save();
    ctx.globalAlpha *= 0.92 * fade;
    V.glow(ctx, a.x, a.y - 40, 90, a.rgb, 0.45, true);
    ctx.fillStyle = 'rgba(16,14,26,0.35)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, 30, 9, 0, 0, TAU); ctx.fill();
    const spr = a.pose > 0 && NC.SPR[a.spr + '_b'] ? a.spr + '_b' : a.spr;
    NC.drawSpr(ctx, spr, a.x, a.y - bob, { flip: a.face > 0, scale: 0.8, tint: ['#fff0c0', 0.12] }); // (monster art faces left)
    ctx.globalCompositeOperation = 'lighter'; V.glow(ctx, a.x, a.y - 8, 44, a.rgb, 0.5, true); // (a glow at the feet: it fights for you)
    ctx.restore();
  };

  // ---------------- the weapon's own hits ----------------
  const cool = new WeakMap(); // spec -> when it may go off again (one spell per swing, however many it hits)
  const ready = (a, t, gap) => { if ((cool.get(a) || 0) > t) return false; cool.set(a, t + (gap || 0.25)); return true; };
  const roll = (pct) => Math.random() * 100 < pct;
  NC.basicHits.push((game, p, e, r) => {
    if (!(r.dmg > 0) || !alive(p)) return;
    const fx = effects(p);
    if (!fx.length) return;
    const t = game.time;
    for (const a of fx) {
      switch (a.t) {
        case 'leech': {
          if (a.night && nightK(game) < 0.5) break;
          if (a.poisoned && !(e.poison && e.poison.t > 0)) break;
          if (a.sp) { if (ready(a, t, 0.2)) { if (p.sp < a.sp) { a._dry = t + 0.2; break; } p.sp -= a.sp; } else if ((a._dry || 0) > t) break; }
          const got = Math.min(p.maxHp - p.hp, Math.round(r.dmg * a.pct / 100));
          if (got > 0) { p.hp += got; if (!p._leechNum || t - p._leechNum > 0.4) { p._leechNum = t; FX.num(p.x, p.y - 150, '+' + got, { fill: '#8dff8a', size: 28 }); } }
          break;
        }
        case 'hpCost':
          if (ready(a, t, 0.2) && p.hp > 1) p.hp = Math.max(1, p.hp - Math.max(1, Math.round(p.maxHp * a.pct / 100)));
          break;
        case 'status': if (roll(a.chance)) status(game, p, e, a); break;
        case 'proc': if (SPELL[a.fx] && roll(a.chance) && ready(a, t)) SPELL[a.fx](game, p, e, a); break;
        case 'summon': if (roll(a.chance) && ready(a, t)) summon(game, p, e, a); break;
        case 'every':
          if (!ready(a, t, 0.12)) break; // (a swing counts once)
          p._wEvery = (p._wEvery || 0) + 1;
          if (p._wEvery >= a.n) { p._wEvery = 0; SPELL[a.fx](game, p, e, a); }
          break;
        case 'pierce': {
          const ang = NC.angle(p.x, p.y, e.x, e.y), c = Math.cos(ang), s = Math.sin(ang);
          const [kx, ky] = K.push([p.x, p.y], e, 200 * ((a.kb || 1) - 1));
          e.kbx = (e.kbx || 0) + kx; e.kby = (e.kby || 0) + ky;
          for (const x of game.enemies) {
            if (x === e || !alive(x)) continue;
            const dx = x.x - e.x, dy = (x.y - e.y) / 0.62, along = dx * c + dy * s, side = Math.abs(-dx * s + dy * c);
            if (along > 0 && along < 170 && side < 60 + x.r) {
              NC.damageEnemy(game, x, { dmg: Math.max(1, Math.round(r.dmg * a.pct / 100)), mod: r.mod }, c * 160, s * 110, { color: '220,230,255' });
              V.sparks(x.x, x.y - 40, 5, '220,230,255', { size: 0.6 });
            }
          }
          break;
        }
      }
    }
  });

  // ---------------- kills, hits taken, every frame ----------------
  NC.skillKills.push((game, e) => {
    const p = game.player;
    if (!p || p.dead > 0 || !e._heroT || game.time - e._heroT > 1.5) return; // (only the hero's own kills)
    for (const a of effects(p)) {
      if (a.t === 'killHeal') { const got = Math.min(p.maxHp - p.hp, Math.round(p.maxHp * a.pct / 100)); if (got > 0) { p.hp += got; FX.num(p.x, p.y - 150, '+' + got, { fill: '#8dff8a', size: 28 }); } }
      else if (a.t === 'killSp') { const got = Math.min(p.maxSp - p.sp, a.sp); if (got > 0) { p.sp += got; FX.num(p.x, p.y - 180, '+' + got + ' SP', { fill: '#8fc8ff', size: 24 }); } }
      else if (a.t === 'killSummon') summon(game, p, e, a);
    }
  });
  NC.heroGuards.push((game, p, dmg, att) => {
    for (const a of effects(p)) {
      if (a.t === 'resist' && att && att.atkElement === a.el) dmg = Math.max(1, Math.round(dmg * (1 - a.pct / 100)));
      else if (a.t === 'reflect' && att && alive(att)) {
        NC.damageEnemy(game, att, { dmg: Math.max(1, Math.round(dmg * a.pct / 100)), mod: 1 }, 0, 0, { color: '225,185,125' });
        V.sparks(att.x, att.y - 40, 5, '225,185,125', { size: 0.6 });
      }
    }
    return dmg;
  });
  NC.skillTicks.push((game, p, dt) => {
    // the weapon's element by day / by night (the legend)
    const W = p.equip && ITEMS[p.equip.weapon];
    const dn = W && (W.abil || (W.gs && W.gs.abil) || NONE).find((a) => a.t === 'dayNight');
    if (dn && p.d && !(p.buffs && Object.keys(p.buffs).some((id) => p.buffs[id] > 0 && SK[id] && SK[id].enchant))) p.d.atkElement = nightK(game) >= 0.5 ? dn.night : dn.day;
    if (W !== p._wLast) { p._wLast = W; p._wEvery = 0; }
    // bleeding monsters (the raptor tail): 12% of ATK every half second for 5 s
    for (const e of game.enemies) {
      const b = e.wpBleed;
      if (!b || b.t <= 0) continue;
      if (!alive(e)) { b.t = 0; continue; }
      b.t -= dt; b.acc += dt;
      if (b.acc >= 0.5) {
        b.acc -= 0.5;
        NC.damageEnemy(game, e, { dmg: b.dmg, mod: 1 }, 0, 0, { color: '255,90,90' });
        if (V.drip) V.drip(e.x, e.y - 60, '220,40,60'); else V.sparks(e.x, e.y - 50, 3, '220,40,60', { size: 0.5 });
      }
    }
    updateHelpers(game, p, dt);
  });
  NC.WABIL = { SPELL, helpers, effects, nightK };
})();
