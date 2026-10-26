/* online-bosses.js — the server's bosses (backend/boss_ai.go, boss_moves.go, boss_hazards.go, boss_story.go) drawn for
   the web online client as the web draws them offline. Offline, js/boss.js, js/dunbosses.js and js/storyboss.js move
   their bosses in NC.updateEnemy (which never runs online) and draw from the fields it leaves; online the server fights
   and this turns its snapshot into those fields and looks:
   - the fight: a boss's state ("<move>_windup", "<move>", roar, chase, recover) and its move (boss.c: the move, the tick
     it began, its wind-up and warned areas) become e.state = the move, e.t = the seconds into it, e.wind, e.ang, e.z
     (a slam's leap, a flier's hover), e.awake and e.raged while NC.drawEnemy draws it, so each file's own draw shows
     it (the Mushroom King's sprite, the dungeon bosses' poses, the story's people as rigged heroes in boss outfits);
     e.awake also brings up boss.js's big HP bar;
   - the warnings the web lays when a move starts (dunbosses.js:135-160, boss.js:124-139): red circles for a slam, a
     screech and the rain, lanes for a swoop, a breath and a charge, filling until they land; then what the landing
     shows (rings, puffs, the shake, the breath's embers, the dash's dust);
   - the orbs (dunbosses.js:272-291): the acid fan and the orb rings fly down the server's lanes (the server decides
     whom they hit; its orbs fly as fast up and down as across, the web's went .62 as fast);
   - the clouds and puddles (boss.hz) until their end tick (boss.js:79-108 sporeCloud, dunbosses.js:91-107 puddle);
   - the news: waking (ตื่นแล้ว!), the rage (โกรธจัด!), the fall (boss.js:303-322 died: rings, stars, shake, the
     respawn line), a world boss's next form (js/storyboss.js:179-201: the ring where it fell, then the server's
     bossRise: the shake and the log line), the lights of the lit bosses; a minion (boss.of) puffs in when first seen.
   Hooks: the nightcamp:online-snapshot / nightcamp:online-event events, NC.drawEnemy. Load after js/storyboss.js.
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, TAU = Math.PI * 2;
  if (!NC.Online || !NC.BOSSES || !FX) return;
  const DB = NC.DUNGEON_BOSSES || {}, STORY = NC.STORY_BOSSES || {};
  const TICK_RATE = 20, WINDUP = '_windup', KING = 'mushking';
  const KING_LOOK = { fx: '140,240,255', rage: '255,120,200', summon: '160,120,220', minion: '170,130,230', slamRing: '255,210,160',
    slamDust: '170,160,190', dash: '170,160,190', light: [420, '110,220,255'], lightLift: 270, leap: 0.38 }; // boss.js:115-131, :171-190, :229
  const DUN_LOOK = { rage: '255,120,160', slamRing: '255,220,170', slamDust: '160,140,130', dash: '160,140,190', leap: 0.36 }; // dunbosses.js:185, :217-238
  const LEAP_HEIGHT = 150, BREATH_TIME = 1, DASH_SPEED = 1150, SWOOP_LOW = 18, SWOOP_RISE = 40, HOVER_BOB = 10; // dunbosses.js:191, :219, :235-255
  const ORB = { acid: { speed: 560, life: 1.3, from: 60, lift: 70, rgb: '150,255,100' }, orbs: { speed: 330, life: 2.6, from: 0, lift: 120, rgb: '130,210,255' } };
  const ORB_R = 30, ORB_HIT = 140, PUDDLE_RGB = '130,230,90', SPORE_RING = '150,255,215', SPORE_BIG = 78;
  const RISE = { ring: [30, 520, 0.9, 12], puff: [24, 260], shake: 14, words: (n) => `★ ${n} ลุกขึ้นมาอีกครั้ง...` }; // storyboss.js:186-197
  const views = new Map(); // boss id -> { e, state, awake, raged, at, move, t0, wu, areas, landed, released, warn[], orbs[], clouds Map, light }
  const minions = new Set();
  let driver = null;

  const game = () => NC.game;
  // (บาโฟเม็ด is online/baph.js's; the current client keeps the server's id in e.sid)
  const BAPH = new Set(['baphomet', 'baphomet_root']);
  const isBoss = (e) => !!(e && e.online && NC.BOSSES[e.type] && !BAPH.has(e.type) && !(e.boss && e.boss.of));
  const sidOf = (e) => (e && (e.sid || e.id));
  const mob = (g, id) => (g.enemies || []).find((o) => sidOf(o) === id);
  const tone = (type) => (DB[type] && DB[type].fx) || KING_LOOK.fx;
  const look = (type) => (type === KING ? KING_LOOK : DUN_LOOK);
  const say = (g, text, kind) => { g.toast?.(text); NC.HUD?.log(text, kind || 'warn'); };
  const shake = (g, s) => { g.shake = Math.max(g.shake || 0, s); };
  const moveOf = (state) => (state && state.endsWith(WINDUP) ? state.slice(0, -WINDUP.length) : state || '');

  // ---------------- the warnings on the ground (dunbosses.js:56-73, boss.js:44-76) ----------------
  function warnCircle(x, y, r, life, owner, rgb) {
    return FX.add({ type: 'custom', layer: 'low', x, y, r, life, owner, draw(ctx, p, u) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.58);
      ctx.fillStyle = `rgba(255,70,90,${0.12 + 0.1 * Math.sin(p.t * 18)})`; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,90,110,0.32)'; ctx.beginPath(); ctx.arc(0, 0, p.r * Math.min(1, u), 0, TAU); ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = `rgba(${rgb || '255,120,130'},0.85)`; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.stroke();
      ctx.restore();
    } });
  }
  function warnLane(x, y, ang, len, w, life, owner) {
    return FX.add({ type: 'custom', layer: 'low', x, y, ang, len, w, life, owner, draw(ctx, p, u) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.62); ctx.rotate(p.ang);
      ctx.fillStyle = `rgba(255,70,90,${0.12 + 0.1 * Math.sin(p.t * 18)})`; NC.rrect(ctx, 0, -p.w / 2, p.len, p.w, p.w / 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,90,110,0.32)'; NC.rrect(ctx, 0, -p.w / 2, Math.max(p.w, p.len * Math.min(1, u)), p.w, p.w / 2); ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,120,130,0.85)'; NC.rrect(ctx, 0, -p.w / 2, p.len, p.w, p.w / 2); ctx.stroke();
      ctx.restore();
    } });
  }
  // ---------------- an orb down a lane (dunbosses.js:75-90), a cloud or puddle (boss.js:79-108, dunbosses.js:92-107) ----------------
  function orb(g, owner, x, y, a, o) {
    return FX.add({ type: 'custom', layer: 'glow', x: x + Math.cos(a) * o.from, y: y + Math.sin(a) * o.from, vx: Math.cos(a) * o.speed, vy: Math.sin(a) * o.speed,
      life: o.life, owner, R: ORB_R, lift: o.lift, rgb: o.rgb, bossOrb: true,
      update(c) { if (g.world && !g.world.fits(c.x, c.y, 6)) c.dead = true; },
      draw(ctx, c) {
        const y = c.y - c.lift;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(c.x, y, 0, c.x, y, c.R * 1.8);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.35, `rgba(${c.rgb},0.85)`); gr.addColorStop(1, `rgba(${c.rgb},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c.x, y, c.R * 1.8, 0, TAU); ctx.fill();
        ctx.restore();
      } });
  }
  function puddle(x, y, R, life, owner) {
    return FX.add({ type: 'custom', layer: 'low', x, y, R, life, owner, draw(ctx, c) {
      const a = Math.min(1, c.t / 0.25) * Math.min(1, (c.life - c.t) / 0.5);
      ctx.save(); ctx.globalAlpha = a * 0.8; ctx.translate(c.x, c.y); ctx.scale(1, 0.58);
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, c.R);
      gr.addColorStop(0, `rgba(${PUDDLE_RGB},0.75)`); gr.addColorStop(0.8, `rgba(${PUDDLE_RGB},0.45)`); gr.addColorStop(1, `rgba(${PUDDLE_RGB},0)`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, c.R, 0, TAU); ctx.fill();
      ctx.restore();
    } });
  }
  function spores(x, y, R, life, owner) {
    return FX.add({ type: 'custom', layer: 'glow', x, y, R, life, owner, seed: Math.random() * 9,
      update(c, dt) { if (Math.random() < dt * 5) FX.add({ type: 'ember', x: c.x + NC.rand(-c.R, c.R) * 0.8, y: c.y + NC.rand(-c.R, c.R) * 0.4, vx: 0, vy: NC.rand(-60, -30), life: NC.rand(0.5, 0.9) }); },
      draw(ctx, c) {
        ctx.save(); ctx.globalAlpha = 0.8 * Math.min(1, c.t / 0.3) * Math.min(1, (c.life - c.t) / 0.6);
        for (let i = 0; i < 5; i++) {
          const ang = c.seed + i * 1.26 + c.t * 0.4, rr = c.R * (0.34 + 0.12 * Math.sin(c.t * 2 + i));
          const px = c.x + Math.cos(ang) * c.R * 0.42, py = c.y + Math.sin(ang) * c.R * 0.24 - 14;
          const gr = ctx.createRadialGradient(px, py, 0, px, py, rr);
          gr.addColorStop(0, 'rgba(150,255,215,0.55)'); gr.addColorStop(0.7, 'rgba(90,200,190,0.28)'); gr.addColorStop(1, 'rgba(90,200,190,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(140,255,215,0.55)'; ctx.lineWidth = 4; ctx.setLineDash([14, 10]);
        ctx.beginPath(); ctx.ellipse(c.x, c.y, c.R, c.R * 0.58, 0, 0, TAU); ctx.stroke();
        ctx.restore();
      } });
  }
  const kill = (list) => { for (const f of list) f.dead = true; list.length = 0; };

  // ---------------- each snapshot: what the bosses show ----------------
  function read(g, e, tick) {
    let v = views.get(e.id);
    if (!v) views.set(e.id, v = { e, state: '', awake: false, raged: false, at: null, move: '', t0: 0, wu: 0, areas: [], landed: new Set(), released: new Set(), warn: [], orbs: [], clouds: new Map(), light: null });
    v.e = e;
    const b = e.boss || {}, state = e.state || 'idle', awake = state !== 'idle' && state !== 'return';
    if (awake && !v.awake && state === 'roar') wake(g, e);
    if (b.rage && !v.raged && awake) rage(g, e);
    if (v.state === 'blink' + WINDUP && state !== v.state) blinked(e);
    v.awake = e.awake = awake; v.raged = e.raged = !!b.rage; v.state = state;
    const c = b.c;
    if (!c || !c.mv) { if (v.move) { kill(v.warn); v.move = ''; v.at = null; } }
    else if (c.at !== v.at || c.mv !== v.move) begin(g, e, v, c, tick);
    clouds(e, v, Array.isArray(b.hz) ? b.hz : [], tick);
  }
  // dunbosses.js:132-169 start, boss.js:120-140 startAttack: the warnings go down as the move begins
  function begin(g, e, v, c, tick) {
    const since = Math.max(0, (tick - c.at) / TICK_RATE), rgb = tone(e.type);
    kill(v.warn);
    Object.assign(v, { at: c.at, move: c.mv, wu: +c.wu || 0, areas: Array.isArray(c.a) ? c.a : [], t0: g.time - since, landed: new Set(), released: new Set() });
    for (const a of v.areas) {
      const life = (+a.t || 0) - since;
      if (life <= 0) continue;
      if (c.mv === 'slam') v.warn.push(warnCircle(a.x, a.y, a.r, life, e));
      else if (c.mv === 'screech' || c.mv === 'rain') v.warn.push(warnCircle(a.x, a.y, a.r, life, e, rgb));
      else if (c.mv === 'swoop' || c.mv === 'breath' || c.mv === 'charge') v.warn.push(warnLane(a.x, a.y, a.ang || 0, a.len, a.w, life, e));
    }
    if (c.mv === 'summon' && since < v.wu) FX.puff(e.x, e.y - 40, 10, { speed: 160, color: e.type === KING ? KING_LOOK.summon : rgb });
  }
  // the clouds and puddles of boss.hz, until their end tick (gone early when the boss sleeps or falls)
  function clouds(e, v, hz, tick) {
    const keep = new Set();
    for (const h of hz) {
      const key = `${h.x},${h.y},${h.end}`, life = (h.end - tick) / TICK_RATE;
      keep.add(key);
      if (v.clouds.has(key) || life <= 0) continue;
      v.clouds.set(key, e.type === KING ? spores(h.x, h.y, h.r >= SPORE_BIG ? SPORE_BIG : h.r, life, e) : puddle(h.x, h.y, h.r, life, e));
    }
    for (const [key, f] of v.clouds) if (!keep.has(key)) { f.dead = true; v.clouds.delete(key); }
  }
  function drop(id) {
    const v = views.get(id);
    if (!v) return;
    kill(v.warn); kill(v.orbs);
    for (const f of v.clouds.values()) f.dead = true;
    const g = game(), L = g?.world?.lights, i = L ? L.indexOf(v.light) : -1;
    if (i >= 0) L.splice(i, 1);
    views.delete(id);
  }
  function wake(g, e) { // dunbosses.js:110-116, boss.js:113-120
    shake(g, 14);
    FX.ring(e.x, e.y - 60, 30, e.type === KING ? 420 : 440, tone(e.type), 0.8, 10);
    if (e.type === KING) FX.stars(e.x, e.y - 260, 16, '150,240,255', { speed: 320 });
    say(g, `${e.name} ตื่นแล้ว!`);
  }
  function rage(g, e) { // dunbosses.js:183-188, boss.js:160-165
    const king = e.type === KING;
    FX.ring(e.x, e.y - 80, 40, king ? 520 : 540, look(e.type).rage, 0.9, 12);
    shake(g, 16);
    say(g, king ? `${e.name} โกรธจัด! (ท่าพุ่งชน · สปอร์มากขึ้น)` : `${e.name} โกรธจัด! (โจมตีเร็วขึ้น แรงขึ้น)`);
  }
  function blinked(e) { // dunbosses.js:328-334: gone in a puff, there in a puff and a ring (no glide between)
    const rgb = tone(e.type);
    FX.puff(e.x, e.y - 60, 12, { speed: 200, color: rgb });
    if (Number.isFinite(e.tx)) { e.x = e.tx; e.y = e.ty; }
    FX.puff(e.x, e.y - 60, 12, { speed: 200, color: rgb });
    FX.ring(e.x, e.y - 40, 20, 220, rgb, 0.5, 8);
  }

  // ---------------- every frame: the landings, the orbs, the breath, the lights ----------------
  function frame(g, dt) {
    for (const v of views.values()) {
      const e = v.e;
      light(g, e, v);
      if (!v.move || e.dead) continue;
      const t = g.time - v.t0, rgb = tone(e.type), L = look(e.type);
      switch (v.move) {
        case 'slam': {
          const a = v.areas[0];
          if (a && t >= a.t && !v.landed.has(0)) {
            v.landed.add(0); shake(g, 18); g.hitstop = Math.max(g.hitstop || 0, 0.05);
            FX.ring(a.x, a.y, 30, 300, L.slamRing, 0.45, 12);
            FX.puff(a.x, a.y, 14, { speed: 320, color: L.slamDust, size: 1.3 });
          }
          break;
        }
        case 'screech':
          if (t >= v.wu && !v.landed.has(0)) {
            v.landed.add(0); shake(g, 10);
            for (let k = 0; k < 3; k++) FX.ring(e.x, e.y - 40, 20 + k * 30, 340, rgb, 0.5 + k * 0.12, 8);
          }
          break;
        case 'rain':
          v.areas.forEach((s, i) => {
            if (t < s.t || v.landed.has(i)) return;
            v.landed.add(i);
            FX.ring(s.x, s.y, 16, 150, rgb, 0.4, 8);
            FX.puff(s.x, s.y, 8, { speed: 200, color: rgb, size: 1.1 });
            for (let k = 0; k < 6; k++) FX.add({ type: 'ember', x: s.x + NC.rand(-50, 50), y: s.y - NC.rand(0, 60), vx: 0, vy: NC.rand(-220, -120), life: 0.7 });
          });
          break;
        case 'breath': {
          const a = v.areas[0];
          if (!a || t < v.wu || t > v.wu + BREATH_TIME) break;
          for (let k = 0; k < 4; k++) {
            const d = Math.random() * a.len, s = (Math.random() - 0.5) * a.w * 0.8;
            const x = a.x + Math.cos(a.ang) * d - Math.sin(a.ang) * s, y = a.y + (Math.sin(a.ang) * d + Math.cos(a.ang) * s) * 0.62;
            FX.add({ type: 'ember', x, y: y - 30, vx: Math.cos(a.ang) * 160, vy: NC.rand(-160, -60), life: NC.rand(0.35, 0.7) });
          }
          if (Math.random() < dt * 12) FX.puff(a.x + Math.cos(a.ang) * NC.rand(80, a.len), a.y + Math.sin(a.ang) * NC.rand(80, a.len) * 0.62, 1, { speed: 40, color: '255,150,60', size: 1.2 });
          break;
        }
        case 'swoop': case 'charge': {
          const a = v.areas[0];
          if (a && t >= v.wu && t < v.wu + a.len / DASH_SPEED && Math.random() < dt * 30) FX.puff(e.x, e.y, 1, { speed: 60, color: L.dash });
          break;
        }
        case 'spores':
          if (t >= v.wu && !v.landed.has(0)) { v.landed.add(0); FX.ring(e.x, e.y - 200, 20, 240, SPORE_RING, 0.5, 8); }
          break;
        case 'acid': case 'orbs':
          v.areas.forEach((a, i) => {
            if (t < a.t || v.released.has(i)) return;
            v.released.add(i);
            const n = a.n || 1, fan = a.fan || 0, o = ORB[v.move];
            for (let k = 0; k < n; k++) {
              const ang = fan > 0 && n > 1 ? a.ang - fan / 2 + (fan * k) / (n - 1) : (a.ang || 0) + (k / n) * TAU;
              v.orbs.push(orb(g, e, a.x, a.y, ang, o));
            }
            if (v.move === 'orbs') FX.ring(e.x, e.y - o.lift, 20, 160, o.rgb, 0.4, 6);
          });
          break;
      }
    }
    for (const v of views.values()) v.orbs = v.orbs.filter((f) => !f.dead && f.t < f.life);
  }
  // dunbosses.js:178-181, boss.js:150-156: the lit bosses' light follows them
  function light(g, e, v) {
    const D = DB[e.type], L = e.type === KING ? KING_LOOK.light : D && D.light;
    if (!L || !g.world || !g.world.lights) return;
    if (!v.light || !g.world.lights.includes(v.light)) { v.light = { x: e.x, y: e.y, r: L[0], rgb: L[1], flick: Math.random() * 10, owner: e, boss: true }; g.world.lights.push(v.light); }
    v.light.x = e.x; v.light.y = e.y - (e.type === KING ? KING_LOOK.lightLift : D.top * 0.55) - (e.z || 0);
  }
  function ensureDriver() {
    if (driver && FX.list.includes(driver)) return;
    driver = FX.add({ type: 'custom', layer: 'low', x: 0, y: 0, life: Infinity, update: (c, dt, g) => frame(g || game(), dt), draw() {} });
  }

  // ---------------- drawing: the offline fields for the offline draw ----------------
  const FIELDS = ['state', 't', 'wind', 'ang', 'z', 'anim'];
  const baseDraw = NC.drawEnemy;
  NC.drawEnemy = function (ctx, g, e) {
    const v = isBoss(e) ? views.get(e.id) : null; // (only the server's monsters are e.online)
    if (!v) return baseDraw.apply(this, arguments);
    const kept = FIELDS.map((k) => e[k]);
    try {
      pose(g, e, v);
      return baseDraw.apply(this, arguments);
    } finally { FIELDS.forEach((k, i) => { e[k] = kept[i]; }); }
  };
  function pose(g, e, v) {
    const state = e.state || 'idle', move = moveOf(state), D = DB[e.type];
    e.anim = g.time;
    if (v.move && move === v.move) {
      const t = g.time - v.t0, a = v.areas[0];
      e.state = v.move; e.t = t; e.wind = v.wu;
      if (a && Number.isFinite(a.ang)) e.ang = a.ang;
      if (v.move === 'slam' && t >= v.wu) e.z = Math.sin(Math.PI * Math.min(1, (t - v.wu) / look(e.type).leap)) * LEAP_HEIGHT;
      else if (D && D.fly) e.z = v.move === 'swoop' ? (t < v.wu ? D.fly + SWOOP_RISE : SWOOP_LOW) : D.fly + Math.sin(g.time * 3) * HOVER_BOB;
      else e.z = 0;
      return;
    }
    e.state = state === 'broken' || state === 'stun' ? 'recover' : state === 'dead' ? 'idle' : state;
    e.t = 0; e.wind = 0;
    e.z = D && D.fly ? D.fly + Math.sin(g.time * 3) * HOVER_BOB : 0;
  }

  // ---------------- the hooks ----------------
  window.addEventListener('nightcamp:online-snapshot', (ev) => {
    const g = game(), data = ev.detail && ev.detail.snapshot;
    if (!g || !data) return;
    ensureDriver();
    // the current client copies only some of a monster's record onto its mirror: the boss's (c, hz, rage, of) here
    if (!(NC.Online && NC.Online.active) && Array.isArray(data.monsters)) {
      const records = new Map(data.monsters.map((m) => [m && m.id, m]));
      for (const e of g.enemies) if (e.online && e.sid && records.has(e.sid)) e.boss = records.get(e.sid).boss || null;
    }
    const seen = new Set();
    for (const e of g.enemies) {
      if (e.boss && e.boss.of) { minion(e, g); continue; }
      if (!isBoss(e)) continue;
      seen.add(e.id);
      read(g, e, data.tick);
    }
    for (const id of [...views.keys()]) if (!seen.has(id)) drop(id);
  });
  function minion(e, g) { // boss_minions.go: a minion puffs in when first seen (dunbosses.js:319, boss.js:240)
    if (minions.has(e.id)) return;
    if (minions.size > 400) minions.clear();
    minions.add(e.id);
    const boss = mob(g, e.boss.of);
    FX.puff(e.x, e.y - 20, 6, { speed: 90, color: boss && boss.type !== KING ? tone(boss.type) : KING_LOOK.minion });
  }
  window.addEventListener('nightcamp:online-event', (ev) => {
    const data = ev.detail, g = game();
    if (!data || !g) return;
    if (data.type === 'bossRise') { // backend/boss_story.go: the next form is up (storyboss.js:192-197)
      const name = (NC.MONSTERS[data.monster] || {}).name || data.monster;
      shake(g, RISE.shake);
      NC.HUD?.log(RISE.words(name), 'warn');
      return;
    }
    if (data.type !== 'combat') return;
    const e = mob(g, data.targetId);
    if (data.dead && isBoss(e)) return fell(g, e);
    const source = mob(g, data.sourceId), v = source && views.get(source.id);
    if (v && (data.move === 'acid' || data.move === 'orbs')) { // the orb that hit is spent (dunbosses.js:80)
      const hero = data.targetId === g.player.id ? g.player : null, x = hero ? hero.x : data.x, y = hero ? hero.y : data.y;
      let best = null, gap = ORB_HIT;
      for (const f of v.orbs) { const d = Math.hypot(f.x - x, f.y - y); if (!f.dead && d < gap) { gap = d; best = f; } }
      if (best) { best.dead = true; FX.puff(best.x, best.y - best.lift, 5, { speed: 110, color: best.rgb }); }
    }
  });
  // boss.js:303-322 died, and a world boss's form that brings the next up (storyboss.js:183-187)
  function fell(g, e) {
    const B = NC.BOSSES[e.type] || {}, D = STORY[e.type];
    drop(e.id);
    shake(g, 20);
    for (let k = 0; k < 3; k++) FX.ring(e.x, e.y - 120, 30 + k * 40, 480 + k * 120, k === 1 ? '255,230,140' : '140,240,255', 0.7 + k * 0.2, 12);
    FX.stars(e.x, e.y - 200, 30, '255,230,140', { speed: 420 });
    say(g, `★ ปราบ ${e.name} สำเร็จ! (กลับมาอีกใน ${Math.round((B.respawn || 0) / 60)} นาที)`, 'exp');
    if (D && D.next) {
      FX.ring(e.x, e.y - 60, RISE.ring[0], RISE.ring[1], D.fx, RISE.ring[2], RISE.ring[3]);
      FX.puff(e.x, e.y - 60, RISE.puff[0], { speed: RISE.puff[1], color: D.fx });
    }
  }
  NC.OnlineBosses = { views, frame: (dt) => frame(game(), dt) }; // (tests read and step it)
})();
