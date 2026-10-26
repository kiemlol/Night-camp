/* class3_core.js — the class-3 ("high class") jobs' shared machinery (the user's brief, 2026-09-28: class 3 is mostly
   PASSIVES that power up the 2nd job's actives — stronger, bigger, more spectacular — so nobody has to press more
   buttons). Every class-3 job (the family files class3_skills_*.js call C3.defineJob) has:
     - a signature passive (its own mechanic, written in the family file as hooks: tick / hit / kill / cast / hurt)
     - four "ปลุกพลัง" passives, two per lane, each powering up ONE 2nd-job skill: its hits do +3% per level, its areas
       grow 2% per level, and its hits set off an extra effect from the library below (a pillar, a nova, an echo, a
       rain, a chain, shards, spikes, falling blades; a heal burst for support skills), 1 / 2 / 3 times a cast at
       Lv 1 / 5 / 10
     - ร่างตื่น (awakening): casting the powered-up skills fills a moon ring under the hero's feet; when it is full the
       hero awakens by itself for 10–18 s: the concept's big back-piece (sun disc, dragon wings, crystal swords ...)
       appears behind him, the powered-up skills hit +15–30% more and set their effect off once more, plus a perk.
   The jobs change at 2nd-job Job Lv 50 and Base Lv NC.CLASS3_BASE_LV, 80 (skilltree.js: NC.nextJobs / NC.canChangeJob / NC.jobLine).
   Looks: assets/class3 (outfits: class3.js; back-pieces c3b_<job> and icons sk_<skill>: tools/c3_art.py). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, SK = NC.SKILLS, RUN = NC.SKILL_RUN;
  const { C, P, TAU } = K;
  const rand = NC.rand, S = K.S, alive = K.alive;
  const lvOf = (p, id) => NC.skillLv(p, id);
  const r1 = (v) => Math.round(v * 10) / 10;
  const C3 = (NC.C3 = { jobs: {}, boost: {}, ids: new Set(), fx: {} });
  const now = () => (NC.game ? NC.game.time : 0);
  const jobOf = (p) => (p && NC.JOBS[p.job] && NC.JOBS[p.job].tier === 3 ? C3.jobs[p.job] : null);
  C3.jobOf = jobOf;
  C3.others = (game, e, r, n) => game.enemies.filter((o) => o !== e && alive(o) && NC.dist(o.x, o.y, e.x, e.y) < r)
    .sort((a, b) => NC.dist(a.x, a.y, e.x, e.y) - NC.dist(b.x, b.y, e.x, e.y)).slice(0, n || 99);
  C3.shout = (p, text, fill) => FX.text(p.x, p.y - 210, text, fill || '#ffe28a', 34);
  C3.isBoss = (e) => !!((NC.BOSSES && NC.BOSSES[e.type]) || e.boss || e.isBoss);

  // =====================================================================================================
  // the effect library: what a powered-up skill sets off on the monster it hit (sid: the ปลุกพลัง skill, whose mul /
  // type / element the extra hits use; o: { rgb, pal, big, style }). Each effect's look is C3.looks[fx](game, x, y, g,
  // o, hit): what it draws at (x, y) with its geometry g (the struck monster, the drops, the hops, the angles), calling
  // hit(...) where its hits land offline; the online client (js/online-class3.js) draws the server's effects
  // (backend/tier3_fx.go) with the same looks and no hits. (The rain and the falling blades strike inside K.rain.)
  // =====================================================================================================
  const FXK = C3.fx, LOOKS = (C3.looks = {});
  const monsterOf = (game, id) => (game.enemies || []).find((m) => m.id === id);
  LOOKS.pillar = (game, x, y, g, o, hit) => {
    const r = o.big ? 120 : 90, rgb = o.rgb || C.holy, b = { rgb: o.rgb, style: o.style || 'holy', delay: 0.14, w: o.big ? 110 : 80, stars: o.big ? 8 : 4, starFill: o.star };
    V.circle(x, y, r, rgb, b.delay + 0.5, { style: b.style, spin: 2, grow: true }); // (K.pillar, skillkit.js:389-397)
    V.at(b.delay, () => {
      V.beam(x, y, b.w, 620, rgb, 0.45);
      K.burst(game, x, y, r, b.rgb || C.gold, Object.assign({ rgb, shake: 5 }, b, { delay: 0 })); // (K.nova's own burst)
      if (hit) hit(x, y, r);
    });
  };
  FXK.pillar = (game, p, sid, e, o) => LOOKS.pillar(game, e.x, e.y, {}, o, (x, y, r) => K.nova(game, p, sid, x, y, r, { fx: false }));
  LOOKS.nova = (game, x, y, g, o, hit) => {
    const r = o.big ? 175 : 130, b = { rgb: o.rgb, kb: 140, stars: o.big ? 10 : 6, starFill: o.star, shake: o.big ? 7 : 4, decal: o.decal };
    K.burst(game, x, y, r, o.rgb || C.gold, b);
    if (hit) hit(x, y, r, b);
    if (o.pal) K.flames(x, y, o.big ? 6 : 3, o.big ? 110 : 70, { pal: o.pal, k: 0.8 });
  };
  FXK.nova = (game, p, sid, e, o) => LOOKS.nova(game, e.x, e.y, {}, o, (x, y, r, b) => K.nova(game, p, sid, x, y, r, Object.assign({}, b, { fx: false })));
  LOOKS.echo = (game, x, y, g, o, hit) => {
    V.at(0.28, () => {
      const e = g.target;
      if (e && !alive(e)) return;
      const ex = e ? e.x : x, ey = e ? e.y : y, a = rand(-0.6, 0.6), pal = o.pal || P.gold;
      K.slashAt(ex, ey - 20, o.big ? 120 : 95, a, pal, o.rgb, { sweep: 2, thick: o.big ? 30 : 22, life: 0.24 });
      K.slashAt(ex, ey - 20, o.big ? 120 : 95, a + Math.PI * 0.55, pal, o.rgb, { sweep: 2, thick: o.big ? 30 : 22, life: 0.24 });
      V.flare(ex, ey - 60, o.big ? 110 : 80, o.rgb, 0.3);
      V.sparks(ex, ey - 50, 10, o.rgb, { size: 0.8 });
      if (hit) hit(e);
    });
  };
  FXK.echo = (game, p, sid, e, o) => LOOKS.echo(game, e.x, e.y, { target: e }, o, () => {
    K.hit(game, p, sid, e, 0, 0, o.rgb, 1, { big: !!o.big });
    if (o.big) for (const x of C3.others(game, e, 120, 3)) K.hit(game, p, sid, x, 0, 0, o.rgb, 0.5);
  });
  // K.rain's falling things (skillkit.js:271-297) for drops rolled already ([x, y, start]): the online client's rain
  function fallLook(drops, o) {
    const rgb = o.rgb || C.gold, [fx, fy] = o.from || [120, -820], t = o.fall || 0.28, ir = o.ir || 70;
    for (const [tx, ty, start] of drops) V.at(start, () => {
      const sx = tx + fx, sy = ty + fy;
      K.proj({
        x: sx, y: sy, vx: (tx - sx) / t, vy: (ty - 20 - sy) / t, life: t,
        draw(ctx, q) { if (o.look) o.look(ctx, q); else K.drawOrb(ctx, q.x, q.y, 10, rgb); },
        onEnd() { V.ring(tx, ty, 8, ir * 1.1, 6, rgb, 0.3); V.glowAt(tx, ty - 16, 12, ir * 1.2, rgb, 0.7, 0.3, { hot: true }); V.sparks(tx, ty - 10, 6, rgb, { size: 0.7, max: 420 }); },
      });
    });
  }
  const rainOf = (o) => ({ rgb: o.rgb, ir: 65, look: o.look || ((ctx, q) => K.drawStar(ctx, q.x, q.y, 14, q.t * 8, 5, o.fill || '#fff3b0')), fall: 0.3, mul: 0.6 });
  LOOKS.rain = (game, x, y, g, o) => fallLook(g.drops || [], rainOf(o));
  FXK.rain = (game, p, sid, e, o) => K.rain(game, p, sid, e.x, e.y, o.big ? 130 : 100, o.big ? 6 : 4, 0.45, rainOf(o));
  // (online: the path the server chose, g.hops [{ id, x, y }]; K.chain draws and strikes offline)
  LOOKS.chain = (game, x, y, g, o, hit) => {
    const hops = g.hops || [];
    if (!hops.length) { V.flare(x, y - 60, 90, o.rgb, 0.3); if (hit) hit(); return; }
    let from = [x, y - 50];
    hops.forEach((h, i) => {
      const f = from, rgb = o.rgb || C.lightning;
      V.at(i * 0.07, () => {
        const c = monsterOf(game, h.id) || h;
        if (c !== h && !alive(c)) return;
        V.boltAt(f[0], f[1], c.x, c.y - 50, rgb, 0.22, { w: o.big ? 7 : 5, jag: 26, seg: 9 });
        V.glowAt(c.x, c.y - 50, 20, 110, rgb, 0.8, 0.25, { hot: true });
        V.sparks(c.x, c.y - 50, 8, rgb, { size: 0.8 });
      });
      from = [h.x, h.y - 50];
    });
  };
  FXK.chain = (game, p, sid, e, o) => {
    const first = C3.others(game, e, 340, 1)[0];
    if (!first) { LOOKS.chain(game, e.x, e.y, {}, o, () => K.hit(game, p, sid, e, 0, 0, o.rgb, 0.6)); return; }
    K.chain(game, p, sid, first, o.big ? 4 : 3, 330, { rgb: o.rgb, mul: 1, fall: 0.9, from: [e.x, e.y - 50], w: o.big ? 7 : 5 });
  };
  // (g.angles: the server's; offline they are rolled here, in the same order as before; hit(a) is a shard's update)
  LOOKS.shards = (game, x, y, g, o, hit) => {
    const n = g.angles ? g.angles.length : o.big ? 6 : 4, fill = o.fill || '#eaf6ff';
    V.flare(x, y - 50, 90, o.rgb, 0.25);
    for (let i = 0; i < n; i++) {
      const a = g.angles ? g.angles[i] : (i / n) * TAU + rand(-0.2, 0.2), sp = 700;
      K.proj({
        x, y: y - 50, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.75, life: o.big ? 0.42 : 0.32,
        draw(ctx, q) { if (o.look) return o.look(ctx, q); K.drawBlade(ctx, q.x, q.y, Math.atan2(q.vy, q.vx) + Math.PI / 2, 26, 7, fill, o.rgb); }, // (o.look: a power-up's own shard, e.g. the ninja's shadow stars)
        update: hit ? hit(a) : undefined,
      });
    }
  };
  FXK.shards = (game, p, sid, e, o) => LOOKS.shards(game, e.x, e.y, {}, o, (a) => {
    const hitSet = new Set();
    return (q) => { for (const x of K.around(game, q.x, q.y + 50, 46)) if (!hitSet.has(x)) { hitSet.add(x); K.hit(game, p, sid, x, Math.cos(a) * 80, Math.sin(a) * 60, o.rgb, 0.4); } };
  });
  // (g.ang: hero -> target; each spike rises where g.target stands then)
  LOOKS.spikes = (game, x, y, g, o, hit) => {
    const n = o.big ? 7 : 5, a = g.ang || 0, step = 46, e = g.target;
    for (let i = 0; i < n; i++) V.at(i * 0.04, () => {
      const sx = (e ? e.x : x) + Math.cos(a) * (i - 1) * step, sy = (e ? e.y : y) + Math.sin(a) * (i - 1) * step * V.SQ;
      V.spikeAt(sx, sy, 30, o.big ? 110 : 84, o.pal || P.ice, 0.8, { glowA: 0.4, rgb: o.rgb, rise: 0.06, sink: true });
      if (hit) hit(sx, sy);
    });
  };
  FXK.spikes = (game, p, sid, e, o) => LOOKS.spikes(game, e.x, e.y, { ang: NC.angle(p.x, p.y, e.x, e.y), target: e }, o, (x, y) => {
    for (const x2 of K.around(game, x, y, 52)) if (!x2._c3sp || x2._c3sp < game.time) { x2._c3sp = game.time + 0.25; K.hit(game, p, sid, x2, 0, 0, o.rgb, 0.45); }
  });
  const bladesOf = (o) => ({ rgb: o.rgb, ir: 60, look: (ctx, q) => K.drawBlade(ctx, q.x, q.y, Math.PI, 56, 11, o.fill || '#e8f2ff', o.rgb), fall: 0.22, from: [0, -700], mul: 0.6 });
  LOOKS.blades = (game, x, y, g, o) => fallLook(g.drops || [], bladesOf(o));
  FXK.blades = (game, p, sid, e, o) => K.rain(game, p, sid, e.x, e.y, o.big ? 120 : 90, o.big ? 6 : 4, 0.4, bladesOf(o));
  // a heal burst (support skills): the hero and the friends near him (g.who), and small stars rising
  LOOKS.heal = (game, x, y, g, o, hit) => {
    for (const who of g.who || []) {
      if (hit) hit(who);
      V.stars(who.x, who.y - 90, 6, o.fill || '#fff0b0', o.rgb, { speed: 200 });
      V.ring(who.x, who.y - 6, 20, 110, 7, o.rgb, 0.45);
    }
  };
  FXK.heal = (game, p, sid, e, o) => {
    const lv = lvOf(p, sid), amt = (p.d.matk[0] + p.d.matk[1]) / 2 * (0.6 + lv * 0.06) * K.healPow(p) * (o.big ? 1.3 : 1);
    LOOKS.heal(game, p.x, p.y, { who: [p, ...K.friends(game, p, 520)] }, o, (who) => K.heal(game, who, amt, { quiet: true }));
  };
  C3.ON_CAST = new Set(['heal']); // (these go off when the skill is cast, not on its hits)

  // an extra effect's hit: a share of the powered-up skill's own hit (12% + 1.2% per level of its multiplier; a skill
  // with small per-tick hits, a zone: at least 0.5 + 0.05 per level of ATK / MATK)
  C3.extraMul = function (of, lv) {
    const O = SK[of], p = NC.game && NC.game.player;
    const m = O && O.mul ? Number(O.mul(Math.max(1, (p && lvOf(p, of)) || 1))) || 0 : 0;
    return Math.max(m * (0.12 + lv * 0.012), 0.5 + lv * 0.05);
  };

  // =====================================================================================================
  // defining a class-3 job
  // =====================================================================================================
  // def: { name, from, hp, sp, rgb, pal, desc, back: { h, dy, dx, spin, bob, flip }, giant,
  //        lanes: [lane A name, lane B name],
  //        sig: { id, name, desc(lv), pass(lv, p), type, element, mul(lv), hooks: { tick, hit, kill, cast, hurt } },
  //        enh: [{ id, name, of: 2nd-job skill, sids: [extra hit ids], fx, lane: 'a'|'b', rgb, pal, style, type, element,
  //                mul(lv), text: what the effect does }, x4],
  //        awaken: { id, name, perk(lv, p) -> stat mods, text, hooks: { hit, tick } } }
  C3.defineJob = function (id, def) {
    C3.jobs[id] = def;
    def.id = id;
    const J = (NC.JOBS[id] = { name: def.name, tier: 3, from: def.from, maxJob: 50, hp: def.hp, sp: def.sp, cls: 'c3_' + id, skills: [], desc: def.desc });
    const sig = def.sig, aw = def.awaken, list = {};
    // the signature
    list[sig.id] = S(Object.assign({ name: sig.name, icon: 'sk_' + sig.id, max: 10, free: 1, pass: sig.pass || (() => ({})) },
      sig.type ? { type: sig.type, element: sig.element || null, mul: sig.mul || (() => 1), sp: () => 0, cd: 0 } : {},
      { desc: (lv, m) => sig.desc(lv, m !== undefined ? m : sig.mul ? Math.round(sig.mul(Math.max(1, lv)) * 100) : 0) })); // (a passive's window text gets no m)
    // the four power-ups
    for (const E of def.enh) {
      const of = SK[E.of], ofName = of ? of.name : E.of, fxText = E.text;
      list[E.id] = S({
        name: E.name, icon: 'sk_' + E.id, max: 10, pass: () => ({}), type: E.type || (of && of.type) || 'phys',
        element: E.element !== undefined ? E.element : of ? of.element || null : null, mul: E.mul || ((lv) => { const q = NC.game && NC.game.player, m = q && q.c3 && q.c3.mul && q.c3.mul[E.id]; return m || C3.extraMul(E.of, lv); }), sp: () => 0, cd: 0,
        desc: (lv) => `ปลุกพลัง "${ofName}": แรงขึ้น ${r1(lv * 2.5)}% วงกว้างขึ้น ${lv * 2}% · ${fxText}${C3.ON_CAST.has(E.fx) || E.onCast ? '' : ` (แรง ${r1(15 + lv * 1.5)}% ของฮิตที่ปลุก)`} ${lv >= 10 ? '3' : lv >= 5 ? '2' : '1'} ครั้งต่อการใช้${lv >= 5 ? ' · เอฟเฟกต์ใหญ่ขึ้น' : ''}`,
      });
      for (const s of [E.of, ...(E.sids || [])]) C3.boost[s] = E.id;
      E.job = id;
    }
    // the awakening
    list[aw.id] = S({
      name: aw.name, icon: 'sk_' + aw.id, max: 5,
      pass: (lv, p) => (C3.awake(p) ? Object.assign({}, aw.perk ? aw.perk(lv, p) : {}) : {}),
      desc: (lv) => `ใช้สกิลที่ปลุกพลังแล้ว วงจันทร์ใต้เท้าเต็ม ร่างตื่นเอง ${8 + lv * 2} วิ: สกิลที่ปลุกพลังแรงขึ้นอีก ${10 + lv * 2}% เอฟเฟกต์ออกเพิ่ม 1 ครั้ง · ${aw.text}`,
    });
    K.def(list);
    for (const k in list) { SK[k].active = false; SK[k].kind = 'passive'; C3.ids.add(k); }
    // the skill window: four lines (signature, lane A, lane B, awakening), needs and levels
    J.lines = [{ id: 'core', name: sig.name, el: 'neutral' }, { id: 'a', name: def.lanes[0], el: 'neutral' },
      { id: 'b', name: def.lanes[1], el: 'neutral' }, { id: 'awaken', name: 'ร่างตื่น', el: 'neutral' }];
    J.skills = [sig.id, ...def.enh.map((E) => E.id), aw.id];
    SK[sig.id].line = 'core';
    for (const E of def.enh) { SK[E.id].line = E.lane; SK[E.id].req = SK[E.of] ? [[E.of, 1]] : []; SK[E.id].grow = 'Lv5 เอฟเฟกต์ออก 2 ครั้งและใหญ่ขึ้น · Lv10 ออก 3 ครั้ง'; }
    SK[aw.id].line = 'awaken'; SK[aw.id].req = [[sig.id, 3]]; SK[aw.id].grow = 'ร่างตื่นนานขึ้น 2 วิ และแรงขึ้นทุกเลเวล';
    SK[sig.id].grow = sig.grow || '';
    return J;
  };

  // =====================================================================================================
  // powered-up skills: more damage, bigger areas, the extra effect
  // =====================================================================================================
  const boosterOf = (p, sid) => {
    const E = C3.boost[sid], J = jobOf(p);
    if (!E || !J || !J.enh.some((x) => x.id === E)) return null;
    return lvOf(p, E) > 0 ? E : null;
  };
  C3.boosterOf = boosterOf;
  const enhDef = (J, id) => J.enh.find((x) => x.id === id);
  const baseScale = NC.skillScale;
  NC.skillScale = function (p, id) {
    const s = baseScale ? baseScale(p, id) : 1, E = p && boosterOf(p, id);
    return E ? s * (1 + lvOf(p, E) * 0.02) : s;
  };
  function state(p) { return p.c3 || (p.c3 = { awk: 0, idle: 0, until: 0, cool: 0, fx: {}, flash: 0 }); }
  C3.state = state;
  C3.awake = (p) => !!p && !!p.c3 && p.c3.until > now();
  // a powered-up skill went off: its effect count starts over, the moon ring fills, the back-piece flashes
  NC.skillCasts.push((game, p, id, lv) => {
    const J = jobOf(p);
    // (online a presented cast only draws: the server fills the ring, awakens, sets the signatures' finishers off and
    // sends each as a class3 event, js/online-class3*.js; a guess here showed them twice, or when the server did not)
    if (!J || game.presentationOnly) return;
    const st = state(p), E = boosterOf(p, id);
    if (J.sig.hooks && J.sig.hooks.cast && lvOf(p, J.sig.id) > 0) J.sig.hooks.cast(game, p, id, lvOf(p, J.sig.id));
    if (!E) return;
    const eLv = lvOf(p, E), D = enhDef(J, E);
    st.fx[E] = { t: game.time, n: 0 };
    st.idle = 0;
    st.flash = game.time;
    if (lvOf(p, J.awaken.id) > 0 && !C3.awake(p)) C3.fill(game, p, (SK[id] && SK[id].ult ? 25 : 10) * (NC.RO_FILL ? NC.RO_FILL(id) : 1)); // (?rotime: casts come oftener, js/rotiming.js)
    if (C3.ON_CAST.has(D.fx) || D.onCast) FXK[D.fx](game, p, E, p, look(J, D, eLv, p)); // (a heal, or a burst round the hero for a buff)
    V.glowAt(p.x, p.y - 80, 40, 160, D.rgb || J.rgb, 0.55, 0.35, { hot: true });
  });
  const look = (J, D, lv, p) => ({ rgb: D.rgb || J.rgb, pal: D.pal || J.pal, style: D.style, fill: D.fill, star: D.star, decal: D.decal, look: D.look, big: lv >= 5 || C3.awake(p) });
  C3.lookOf = look; // (js/online-class3.js: the looks of the server's effects)
  // the hits: the power-up's bonus and its effect, the signature's hit hook
  const baseHH = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHH.apply(this, arguments), G = NC.game, p = G && G.player;
    // (online a presented cast only draws: its hits on the monster copies set nothing off, backend/tier3.go does)
    if (!p || G.presentationOnly || p.kind !== 'player' || d !== p.d || !(r.dmg > 0) || !e || e.kind !== 'enemy') return r;
    const J = jobOf(p);
    if (!J) return r;
    const sid = o && o.sid, mine = sid && C3.ids.has(sid);
    const E = sid && !mine ? boosterOf(p, sid) : null;
    if (E) {
      const lv = lvOf(p, E), aw = C3.awake(p) ? 0.1 + lvOf(p, J.awaken.id) * 0.02 : 0;
      r.dmg = Math.max(1, Math.round(r.dmg * (1 + lv * 0.025 + aw)));
      const st = state(p), D = enhDef(J, E), f = st.fx[E];
      const cap = (lv >= 10 ? 3 : lv >= 5 ? 2 : 1) + (C3.awake(p) ? 1 : 0);
      if (!C3.ON_CAST.has(D.fx) && !D.onCast && f && G.time - f.t < 4 && f.n < cap && G.time - (f.last || -9) > 0.12) {
        f.n++; f.last = G.time;
        (st.mul || (st.mul = {}))[E] = Math.max((o.mul || 1) * (0.15 + lv * 0.015), 0.4 + lv * 0.04); // (the effect: a share of the hit that set it off)
        const target = e;
        V.at(0.02, () => { if (alive(target) || D.fx === 'nova' || D.fx === 'rain') FXK[D.fx](G, p, E, target, look(J, D, lv, p)); });
      }
    }
    if (!mine) {
      const sl = lvOf(p, J.sig.id);
      if (sl > 0 && J.sig.hooks && J.sig.hooks.hit) J.sig.hooks.hit(G, p, e, r, o || {}, sl);
      if (C3.awake(p) && J.awaken.hooks && J.awaken.hooks.hit) J.awaken.hooks.hit(G, p, e, r, o || {}, lvOf(p, J.awaken.id));
    }
    return r;
  };
  NC.skillKills.push((game, e) => {
    const p = game.player, J = jobOf(p);
    if (!J) return;
    const sl = lvOf(p, J.sig.id);
    if (sl > 0 && J.sig.hooks && J.sig.hooks.kill) J.sig.hooks.kill(game, p, e, sl);
  });
  NC.heroGuards.push((game, p, dmg, att) => {
    const J = jobOf(p);
    if (!J) return dmg;
    const sl = lvOf(p, J.sig.id);
    if (sl > 0 && J.sig.hooks && J.sig.hooks.hurt) dmg = J.sig.hooks.hurt(game, p, dmg, att, sl);
    return dmg;
  });

  // =====================================================================================================
  // ร่างตื่น: the moon ring fills, the hero awakens
  // =====================================================================================================
  C3.fill = function (game, p, n) {
    const J = jobOf(p), st = state(p);
    if (!J || lvOf(p, J.awaken.id) <= 0 || C3.awake(p) || st.cool > game.time) return;
    st.awk = Math.min(100, st.awk + n);
    if (st.awk >= 100) C3.awaken(game, p);
  };
  C3.awaken = function (game, p) {
    const J = jobOf(p), st = state(p), lv = lvOf(p, J.awaken.id);
    st.awk = 0; st.start = game.time; st.until = game.time + 8 + lv * 2;
    NC.applyGear(game);
    C3.awakenLooks(game, p, J, lv, true);
    if (J.awaken.hooks && J.awaken.hooks.start) J.awaken.hooks.start(game, p, lv);
  };
  // the awakening's looks (online, js/online-class3.js draws them from the server's events; another hero's awakening
  // does not flash, shake or log the screen: mine is false)
  C3.awakenLooks = function (game, p, J, lv, mine) {
    if (mine) { V.flash(J.rgb, 0.22, 0.45); V.shake(game, 10); V.stop(game, 0.08); }
    K.burst(game, p.x, p.y, 260, J.rgb, { stars: 16, starFill: '#fff6d0', flash: mine ? J.rgb : undefined });
    V.ring(p.x, p.y - 6, 30, 420, 16, J.rgb, 0.7);
    V.light(p.x, p.y - 100, 700, J.rgb, 1, 1.2, { follow: p });
    C3.shout(p, 'ร่างตื่น! ' + J.awaken.name, '#fff1b8');
    if (mine) NC.HUD.log(`${J.awaken.name}! (${8 + lv * 2} วิ)`, 'level');
  };
  C3.awakenEndLook = (game, p, J) => V.ring(p.x, p.y - 6, 200, 30, 8, J.rgb, 0.4);
  NC.skillTicks.push((game, p, dt) => {
    const J = jobOf(p);
    if (!J) { if (p.c3 && p.c3.until) { p.c3.until = 0; NC.applyGear(game); } return; }
    const st = state(p);
    st.idle += dt;
    if (st.until && st.until <= game.time) { // the awakening ends
      st.until = 0; st.cool = game.time + 5;
      NC.applyGear(game);
      C3.awakenEndLook(game, p, J);
      if (J.awaken.hooks && J.awaken.hooks.end) J.awaken.hooks.end(game, p);
    }
    if (!C3.awake(p) && st.idle > 6 && st.awk > 0) st.awk = Math.max(0, st.awk - dt * 8);
    const sl = lvOf(p, J.sig.id);
    if (sl > 0 && J.sig.hooks && J.sig.hooks.tick) J.sig.hooks.tick(game, p, dt, sl);
    if (C3.awake(p)) {
      if (J.awaken.hooks && J.awaken.hooks.tick) J.awaken.hooks.tick(game, p, dt, lvOf(p, J.awaken.id));
      if (Math.random() < dt * 14) V.motes(p.x + rand(-60, 60), p.y - rand(20, 140), 1, J.rgb, { rise: 90, spread: 10, size: 1 });
    }
  });

  // ---------------- looks: the back-piece behind the hero, the moon ring under his feet, the giant ----------------
  function drawBack(ctx, game, p, J, a, k) {
    const B = J.back || {}, s = NC.SPR['c3b_' + J.id], t = game.time;
    const h = (B.h || 230) * k, cx = p.x + (B.dx || 0) * (p.face < 0 ? -1 : 1), cy = p.y + (B.dy || -110) + Math.sin(t * 2.2) * (B.bob === undefined ? 5 : B.bob);
    ctx.save();
    ctx.globalAlpha *= a;
    V.glow(ctx, cx, cy, h * 0.62, J.rgb, 0.35, true);
    if (s) {
      const w = h * (s.w / s.h);
      ctx.translate(cx, cy);
      if (B.spin) ctx.rotate(t * B.spin);
      if (B.face && p.face < 0) ctx.scale(-1, 1);
      ctx.drawImage(s.img, -w / 2, -h / 2, w, h);
      if (B.shine !== false) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.18 + 0.12 * Math.sin(t * 4); ctx.drawImage(s.img, -w / 2, -h / 2, w, h); }
    } else {
      // (no art yet: a ring of the job's colour)
      ctx.lineWidth = 10; ctx.strokeStyle = `rgba(${J.rgb},0.8)`;
      ctx.beginPath(); ctx.arc(cx, cy, h * 0.4, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
  function drawRing(ctx, game, p, J, st) {
    const u = C3.awake(p) ? 1 - (st.until - game.time) / (st.until - st.start) : st.awk / 100;
    if (!C3.awake(p) && st.awk <= 0) return;
    const rx = 52, ry = 18, x = p.x, y = p.y + 2;
    ctx.save();
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,18,36,0.45)';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${J.rgb},${C3.awake(p) ? 0.95 : 0.8})`; ctx.lineWidth = 3.5;
    ctx.beginPath();
    if (C3.awake(p)) ctx.ellipse(x, y, rx, ry, 0, -Math.PI / 2 + u * TAU, Math.PI * 1.5); // (awake: it runs down)
    else ctx.ellipse(x, y, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + u * TAU);
    ctx.stroke();
    if (st.awk >= 80 && !C3.awake(p)) V.glow(ctx, x, y, 70, J.rgb, 0.25 + 0.15 * Math.sin(game.time * 10), true, 0.35);
    ctx.restore();
  }
  C3.drawBack = drawBack; C3.drawRing = drawRing;
  const baseDraw = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    const p = game.player, J = jobOf(p);
    if (!J || !p.pose || p.dead > 0) return baseDraw(ctx, game);
    C3.drawHero(ctx, game, p, J, () => baseDraw(ctx, game));
  };
  // a class-3 hero p drawn by draw() with the ring under its feet, the back-piece behind it, its job's own looks and
  // the giant's size (online, js/online-class3.js draws the other heroes with it too)
  C3.drawHero = function (ctx, game, p, J, draw) {
    const st = state(p), t = game.time;
    drawRing(ctx, game, p, J, st);
    if (C3.awake(p)) {
      const u = Math.min(1, (t - st.start) / 0.4), end = Math.min(1, (st.until - t) / 0.5);
      drawBack(ctx, game, p, J, Math.min(u, end), 0.7 + 0.3 * NC.clamp(u, 0, 1));
    } else if (t - st.flash < 0.6) { // a powered-up skill: the back-piece flashes
      const u = (t - st.flash) / 0.6;
      drawBack(ctx, game, p, J, 0.55 * (1 - u), 0.75 + u * 0.25);
    }
    if (J.giant && C3.awake(p)) { // (the blood-moon warlord grows)
      const g = 1 + 0.25 * Math.min(1, (t - st.start) / 0.35) * Math.min(1, (st.until - t) / 0.35);
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(g, g); ctx.translate(-p.x, -p.y);
      try { if (J.drawBack) J.drawBack(ctx, game, p, st); draw(); } finally { ctx.restore(); }
      if (J.drawFront) J.drawFront(ctx, game, p, st);
      return;
    }
    if (J.drawBack) J.drawBack(ctx, game, p, st);
    draw();
    if (J.drawFront) J.drawFront(ctx, game, p, st);
  };

  // ---------------- art ----------------
  if (NC.ASSET_MANIFEST_CLASS3) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_CLASS3);

  // the class-3 jobs' sets are the class3.js outfits: after defining the jobs, their class ids match (cls: 'c3_<job>')
  C3.finish = function () {
    // weapon rules: a power-up needs what its skill needs (weapons.js reads the skill's own rule)
    if (NC.WEAPON_RULES) for (const id in C3.jobs) for (const E of C3.jobs[id].enh) if (NC.WEAPON_RULES[E.of] && !NC.WEAPON_RULES[E.id]) NC.WEAPON_RULES[E.id] = NC.WEAPON_RULES[E.of];
  };

})();
