/* ninjastars.js — the ninja's star line, redesigned (the user, 2026-10-01: "ปรับสกิลใหม่ไหม ท่าดาวกระจายให้เข้ากับ
   shuriken เช่นปาเบิ้ล ... ปาหลายดอก หรือแยกร่างแล้วปาหลายอันกระจายชิ่ง", the design in chat, then "ทำเลย").
   The star in the hand is the real one and comes back to it; every extra star is its เงาดาว (the same picture, violet
   and see-through, gone in a puff). The line's mechanic is ชิ่ง: a star that hits bounces on to the next monster it
   hasn't hit.
     ดาวคู่ (sh_throwing, passive)  a throw may bring a shadow twin that crosses the real star (js/throwstar.js)
     พัดดาวกระจาย (sh_fan)         the real star and shadow stars in a fan, out and back (Lv 10: each bounces once)
     ดาวชิ่ง (sh_ricochet)         the real star bounces from monster to monster, harder each time, then home
     ขว้างดาวยักษ์วกกลับ (sh_huuma)         the big boomerang: Lv 5 bigger, Lv 10 hangs spinning at the far end, pulling monsters in
     แยกเงาร่าง (sh_clone)          shadow clones round the target throw shadow stars into the pack; the stars bounce.
                                  Class 3 (จ้าวเงาร้อยร่าง): its standing shadow copies throw with them
     พายุชูริเคน (sh_shuriken)      the ring of stars round the hero (Lv 5: two rings); at the end it bursts outwards
   The entries are here (loaded before skillplan.js, which puts them in their lines); the flights are js/throwstar.js's
   NC.THROW kit, used at run time. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, SK = NC.SKILLS;
  const { TAU } = K, S = K.S, alive = K.alive;
  const pct = (v) => Math.round(v * 100);
  const NINJA = '200,210,255';
  const TH = () => NC.THROW;
  const starOf = (p) => TH().heldStar(p);
  const isBoss = (e) => !!(e.boss || e.isBoss || (NC.BOSSES && NC.BOSSES[e.type]));

  // ---------------- the entries ----------------
  K.def({
    sh_fan: S({ name: 'พัดดาวกระจาย', icon: 'sk_sh_fan', cd: 4, sp: (lv) => 14 + lv, mul: (lv) => 1.1 + lv * 0.13, range: 380,
      desc: (lv, m) => `ปาดาวยักษ์ตรงกลางกับเงาดาว ${lv >= 5 ? 6 : 4} ดอกเป็นรูปพัด ทุกดอกทะลุไป 360 แล้ววนกลับ ศัตรูแต่ละตัวโดนขาไปและขากลับ ครั้งละ ${m}% ของ ATK${lv >= 10 ? ' · ทุกดอกชิ่งต่ออีก 1 ตัวก่อนกลับ' : ''}` }),
    sh_ricochet: S({ name: 'ดาวชิ่ง', icon: 'sk_sh_ricochet', cd: 5, sp: (lv) => 16 + lv, mul: (lv) => 1.3 + lv * 0.18, range: 520,
      desc: (lv, m) => `ปาดาวยักษ์ใส่ตัวที่ใกล้เป้า แล้วชิ่งต่ออีก ${lv >= 10 ? 7 : 4} ตัว แรงขึ้นทีละ 12% แล้วกลับเข้ามือ ครั้งละ ${m}% ของ ATK · เจอตัวเดียว เด้งกลับมาโดนซ้ำได้อีก 2 ครั้ง` }),
  });
  Object.assign(SK.sh_throwing, {
    name: 'ดาวคู่', mul: (lv) => 1.2 + lv * 0.13,
    desc: (lv) => `ปาดาวยักษ์แต่ละครั้ง โอกาส ${lv * 5}% ได้เงาดาวอีกดอก บินโค้งไขว้กับดาวจริงไปแล้ววนกลับอีกฝั่ง โดนทั้งขาไปและขากลับ ${pct(SK.sh_throwing.mul(Math.max(1, lv)))}% ของ ATK${lv >= 5 ? ' · ปลายทางเงาดาวชิ่งต่ออีก 1 ตัว' : ''}${lv >= 10 ? ' · ท่ากระโดดปาได้ดาวคู่ทุกครั้ง' : ''}`,
  });
  const clonesOf = (lv) => (lv >= 10 ? 4 : lv >= 5 ? 3 : 2);
  Object.assign(SK.sh_clone, {
    cd: 9, sp: (lv) => 20 + lv, mul: (lv) => 1.2 + lv * 0.15, range: 480, dur: undefined,
    desc: (lv, m) => `ร่างเงา ${clonesOf(lv)} ร่างโผล่ล้อมเป้า ปาเงาดาวพร้อมกันร่างละ 3 ดอกเข้ากลางฝูง ดาวชิ่งต่อ ${lv >= 10 ? 2 : 1} ครั้ง ดอกละ ${m}% ของ ATK แล้วร่างเงาหายเป็นควัน`,
  });
  Object.assign(SK.sh_huuma, {
    range: 420,
    desc: (lv, m) => `ขว้างดาวยักษ์ยักษ์ไป 420 แล้ววกกลับเข้ามือ โดนทั้งขาไปและขากลับ ครั้งละ ${m}% ของ ATK${lv >= 5 ? ' · ใหญ่ขึ้น' : ''}${lv >= 10 ? ' · ปลายทางหมุนค้าง 0.6 วิ ดูดมอนเข้าหาและบดซ้ำ' : ''}`,
  });
  Object.assign(SK.sh_shuriken, {
    desc: (lv, m) => `วงเงาดาวหมุนรอบตัว ขยายออกแล้วหดเข้า 2.4 วิ ทุก 0.12 วิ ${m}% ของ ATK${lv >= 5 ? ' · สองวงหมุนสวนกัน' : ''} · ตอนจบวงแตก ดาวทุกดอกพุ่งออกไปชิ่งศัตรูรอบตัว`,
  });

  // ---------------- shared bits ----------------
  // the throwing pose from `from` into its clip, so the release matches the stars leaving (K.pose: the lock, the face)
  function throwPose(game, p, clip, from, lock) {
    K.pose(game, p, clip, lock);
    if (p && p.anim && p.anim.act === clip) p.anim.actT = from;
  }
  // the star that leaves the hand: the real one when it is there (a skill's real star: p._sstar), else a shadow
  function takeReal(game, p) { return TH().handFree(game, p); }
  const own = (p, q) => { p._sstar = q; };
  const freeOf = (p) => (q) => { if (p._sstar === q) p._sstar = null; };

  // ---------------- พัดดาวกระจาย ----------------
  // a fan of 5 (Lv 5: 7) stars, the middle one the real star; every monster is hit once on the way out and once on the
  // way back whichever star reaches it (a fan covers ground, it doesn't stack); Lv 10: each star bounces once at the far
  // end before it comes back
  RUN.sh_fan = function (game, p, lv) {
    const W = starOf(p);
    if (!W) return;
    throwPose(game, p, 'throwStar2', 0.07, 0.3);
    const T = TH(), n = lv >= 5 ? 7 : 5, half = lv >= 5 ? 0.62 : 0.5, real = takeReal(game, p);
    const out = new Set(), back = new Set(), bounced = new Set();
    const hitE = (e, q) => { K.hit(game, p, 'sh_fan', e, (q.mx || 0) * 6, (q.my || 0) * 4, NINJA); V.sparks(q.x, q.y, 5, NINJA, { size: 0.6 }); };
    V.at(0.03, () => {
      for (let i = 0; i < n; i++) {
        const mid = i === (n - 1) / 2, ang = p.aim + (i - (n - 1) / 2) * ((half * 2) / (n - 1));
        const A = T.aimFrom(p, ang, false), R = 360 - 34, isReal = mid && real;
        const q = T.star(game, {
          sprite: W.sprite, face: p.face, shadow: !isReal, x: A.from[0], y: A.from[1], rot: A.rot + i * 0.7, world: game.world, life: 3, spin: 24,
          move: T.boomerang(game, { from: A.from, cx: A.cx, cy: A.cy, R, tOut: 0.3, vBack: R / 0.26, hand: T.handNow(p), caught: isReal ? T.catchAt(W.trailRgb || NINJA) : null,
            bounce: lv >= 10 ? { R: 260, skip: bounced, hit: (e, q2) => { bounced.add(e); hitE(e, q2); } } : null }),
          hit(q2, px, py) { if (q2.ph === 'out' || q2.ph === 'back') T.sweep(game, q2, px, py, 38, q2.back ? back : out, (e) => hitE(e, q2)); },
          gone: () => p.dead > 0,
          end: isReal ? freeOf(p) : null,
        });
        if (isReal) own(p, q);
      }
    });
  };

  // ---------------- ดาวชิ่ง ----------------
  // the real star at the monster nearest the aim, then on to the nearest one it hasn't hit (within 340), 4 times (Lv 10:
  // 7), each hit 12% harder and the star 8% faster; a lone monster (a boss): it flies off a little and comes back into it,
  // up to 2 more times; then home into the hand. Nothing to aim at: a plain boomerang
  RUN.sh_ricochet = function (game, p, lv) {
    const W = starOf(p);
    if (!W) return;
    throwPose(game, p, 'throwStar1', 0.1, 0.3);
    const T = TH(), real = takeReal(game, p), maxB = lv >= 10 ? 7 : 4, first = K.target(game, p, 560);
    V.at(0.02, () => {
      const A = T.aimFrom(p, first ? NC.angle(p.x, p.y - 80, first.x, first.y - 45) : p.aim, false), hit = new Set();
      let n = 0, rebounds = 0, v = 1450;
      const strike = (e) => {
        K.hit(game, p, 'sh_ricochet', e, 0, 0, NINJA, 1 + n * 0.12);
        V.sparks(e.x, e.y - 45, 8, NINJA, { size: 0.7 }); V.flare(e.x, e.y - 45, 50, NINJA, 0.16);
        n++; v *= 1.08;
      };
      const plain = first ? null : T.boomerang(game, { from: A.from, cx: A.cx, cy: A.cy, R: A.R, tOut: 0.3, vBack: A.R / 0.26, hand: T.handNow(p), caught: real ? T.catchAt(NINJA) : null });
      const q = T.star(game, {
        sprite: W.sprite, face: p.face, shadow: !real, x: A.from[0], y: A.from[1], rot: A.rot, world: game.world, life: 6, spin: 28,
        move(q, dt) {
          if (plain) return plain(q, dt);
          if (!q.ph) { q.ph = 'seek'; q.tgt = first; }
          if (q.ph === 'seek') {
            if (!alive(q.tgt)) { q.tgt = n <= maxB ? T.next(game, q.x, q.y, 340, hit) : null; if (!q.tgt) q.ph = 'home'; return false; }
            if (!T.toward(q, q.tgt.x, q.tgt.y - 45, v, dt, 12 + (q.tgt.r || 24) * 0.4)) return false;
            const e = q.tgt;
            strike(e); hit.add(e);
            if (n > maxB) { q.ph = 'home'; return false; }
            q.tgt = T.next(game, q.x, q.y, 340, hit);
            if (q.tgt) return false;
            if (rebounds < 2 && alive(e)) { // only this one left: off a little and back into it
              rebounds++; hit.delete(e);
              const side = Math.random() < 0.5 ? -1 : 1;
              q.ph = 'rebound'; q.reb = [e, q.x + side * 140, q.y - 70];
              return false;
            }
            q.ph = 'home';
            return false;
          }
          if (q.ph === 'rebound') {
            if (T.toward(q, q.reb[1], q.reb[2], v * 0.85, dt, 6)) { q.ph = 'seek'; q.tgt = q.reb[0]; }
            return false;
          }
          // home into the hand
          const [hx, hy] = T.handNow(p)();
          if (!T.toward(q, hx, hy, v * 1.1, dt, 30)) return false;
          if (real) T.catchAt(W.trailRgb || NINJA)(hx, hy);
          return true;
        },
        gone: () => p.dead > 0,
        end: real ? freeOf(p) : null,
      });
      if (real) own(p, q);
    });
  };

  // ---------------- ขว้างดาวยักษ์วกกลับ ----------------
  // the big boomerang (420 out, back into the hand), every monster once each way; Lv 5 bigger (and a wider hit); Lv 10 it
  // hangs 0.6 s spinning at the far end: the monsters round it are pulled in (not bosses) and ground (35% every 0.2 s)
  RUN.sh_huuma = function (game, p, lv) {
    const W = starOf(p);
    if (!W) return;
    throwPose(game, p, 'throwStar1', 0.1, 0.35);
    const T = TH(), real = takeReal(game, p), big = lv >= 5, A = T.aimFrom(p, p.aim, false), R = 420 - 34;
    const out = new Set(), back = new Set(), rad = big ? 78 : 58, c = Math.cos(p.aim), s = Math.sin(p.aim);
    let tick = 0;
    const q = T.star(game, {
      sprite: W.sprite, face: p.face, shadow: !real, k: big ? 1.4 : 1.05, x: A.from[0], y: A.from[1], rot: A.rot, glow: NINJA, layer: 'glow', world: game.world, life: 4, spin: 26,
      move: T.boomerang(game, { from: A.from, cx: A.cx, cy: A.cy, R, tOut: 0.55, vBack: R / 0.5, hand: T.handNow(p), caught: real ? T.catchAt(W.trailRgb || NINJA) : null,
        hang: lv >= 10 ? 0.6 : 0,
        during(q2, dt) {
          q2.rot += dt * 30;
          for (const e of K.around(game, q2.x, q2.y + 45, 230)) {
            if (isBoss(e) || e.dummy) continue;
            const k = Math.min(1, dt * 4);
            NC.tryMove(game.world, e, (q2.x - e.x) * k, (q2.y + 45 - e.y) * k);
          }
          if ((tick -= dt) <= 0) {
            tick = 0.2;
            for (const e of K.around(game, q2.x, q2.y + 45, 120)) K.hit(game, p, 'sh_huuma', e, 0, 0, NINJA, 0.35);
            V.ring(q2.x, q2.y + 30, 20, 130, 6, NINJA, 0.25);
          }
        } }),
      hit(q2, px, py) { if (q2.ph !== 'hang') T.sweep(game, q2, px, py, rad, q2.back ? back : out, (e) => { K.hit(game, p, 'sh_huuma', e, c * 120, s * 90, NINJA); V.sparks(q2.x, q2.y, 6, NINJA); }); },
      gone: () => p.dead > 0,
      end: real ? freeOf(p) : null,
    });
    if (real) own(p, q);
  };

  // ---------------- แยกเงาร่าง ----------------
  // the clones: the hero's own figure, dark and see-through, in the overhand throw (released at 0.125 s)
  FX.def('nsclone', (ctx, q) => {
    const p = q.p;
    if (!p || !p.equip) return;
    const a = Math.min(1, q.t * 6, (q.life - q.t) * 5), tt = NC.clamp(q.t - q.t0, 0, 0.34);
    const P = NC.Anim.sample('throwStar1', tt, NC.animCtx(p.equip, { al: q.al }));
    P.face = q.face;
    if (tt >= 0.125) P.wHide = 1;
    NC.drawHero(ctx, p.equip, P, q.x, q.y, { alpha: 0.6 * a, tint: ['#23284a', 0.72] });
  }, 'sorted');
  // one clone's star: straight at the target through the pack; at its first hit it bounces on to the nearest monster it
  // hasn't hit (1 time, Lv 10: 2), then it is gone
  function cloneStar(game, p, W, hx, hy, ang, reach, bounces) {
    const T = TH(), hits = new Set(), cx = Math.cos(ang), cy = Math.sin(ang);
    let left = bounces, d = 0;
    const hitE = (e, q) => { hits.add(e); K.hit(game, p, 'sh_clone', e, cx * 90, cy * 60, NINJA); V.sparks(q.x, q.y, 5, T.SHADE_RGB, { size: 0.6 }); };
    T.star(game, {
      sprite: W.sprite, face: cx >= 0 ? 1 : -1, shadow: true, k: 0.75, x: hx, y: hy, rot: NC.rand(0, TAU), world: game.world, life: 2.2, spin: 28,
      move(q, dt) {
        if (!q.ph) q.ph = 'fly';
        if (q.ph === 'fly') {
          const st = 1250 * dt;
          d += st; q.x += cx * st; q.y += cy * st;
          if (!q.hitOne) return d >= reach;
          q.ph = 'seek'; q.tgt = null;
        }
        if (!alive(q.tgt)) {
          if (left <= 0) return true;
          q.tgt = T.next(game, q.x, q.y, 300, hits);
          if (!q.tgt) return true;
          left--;
        }
        if (!T.toward(q, q.tgt.x, q.tgt.y - 45, 1400, dt, 12)) return false;
        hitE(q.tgt, q); q.tgt = null;
        return left <= 0;
      },
      hit(q, px, py) { if (q.ph === 'fly' && !q.hitOne) T.sweep(game, q, px, py, 34, hits, (e) => { hitE(e, q); q.hitOne = true; }); },
    });
  }
  // shadow clones (2 / Lv 5: 3 / Lv 10: 4) pop up round the target, each throws 3 shadow stars into the middle, then
  // they are gone in smoke; class 3 จ้าวเงาร้อยร่าง: the standing copies beside the hero throw 2 each too
  RUN.sh_clone = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.3);
    const T = TH(), W = starOf(p) || NC.ITEMS.huuma, e0 = K.target(game, p, 520);
    const [tx, ty] = e0 ? [e0.x, e0.y] : K.ground(game, p, 380), n = clonesOf(lv), bounces = lv >= 10 ? 2 : 1;
    const volley = (hx, hy, offs) => {
      const ang = NC.angle(hx, hy, tx, ty - 45), reach = Math.max(220, Math.hypot(tx - hx, ty - 45 - hy) * 1.35);
      for (const off of offs || [-0.16, 0, 0.16]) cloneStar(game, p, W, hx, hy, ang + off, reach, bounces);
    };
    const a0 = NC.rand(0, TAU);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU, x = tx + Math.cos(a) * 185, y = ty + Math.sin(a) * 185 * 0.6, face = tx >= x ? 1 : -1;
      const ang = NC.angle(x, y - 80, tx, ty - 45), al = NC.clamp(Math.atan2(Math.sin(face > 0 ? ang : Math.PI - ang), Math.cos(face > 0 ? ang : Math.PI - ang)), -1.2, 1.2);
      const t0 = 0.04 + i * 0.05;
      V.at(t0, () => V.smoke(x, y - 30, 5, '#7e78a0', '#b8b2d4', { size: 0.8, lifeK: 0.55, a: 0.6 }));
      FX.add({ type: 'nsclone', layer: 'sorted', p, x, y, sort: y, face, al, t0, life: t0 + 0.75,
        onEnd(q) { V.smoke(q.x, q.y - 30, 5, '#7e78a0', '#b8b2d4', { size: 0.8, lifeK: 0.55, a: 0.6 }); } });
      V.at(t0 + 0.125, () => {
        const P = NC.Anim.sample('throwStar1', 0.125, NC.animCtx(p.equip, { al }));
        P.face = face;
        const L = NC.weaponLine(p.equip, P, x, y), [hx, hy] = L ? L.hand : [x + face * 30, y - 95];
        volley(hx, hy);
      });
    }
    // class 3: the standing copies (js/throwstar.js knows where they are)
    const C3 = NC.C3, J = C3 && C3.jobOf && C3.jobOf(p);
    if (J && J.id === 'shadowlord' && NC.skillLv(p, 'sl_legion') > 0 && T.copies) {
      for (let k = 0; k < T.copies(p); k++) V.at(0.12 + k * 0.05, () => { const [hx, hy] = T.copyHand(p, k); volley(hx, hy, [-0.1, 0.1]); }); // (2 stars each)
    }
  };

  // ---------------- พายุชูริเคน ----------------
  // the ring of shadow stars round the hero, swelling out and back in 2.4 s (hits every 0.12 s on the ring's band); Lv 5
  // a second ring inside, turning the other way; at the end it bursts: every star flies outwards and bounces into the
  // nearest monster (no monster takes more than 3 of them)
  RUN.sh_shuriken = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.5);
    V.flash('10,14,30', 0.3, 2.6, 'source-over');
    const T = TH(), W = starOf(p) || NC.ITEMS.huuma, two = lv >= 5, n1 = 10, n2 = 7, life = 2.4;
    const at = (q, i, n, inner) => {
      const R = (q.R || 60) * (inner ? 0.58 : 1), a = (inner ? -q.t * 9 : q.t * 7) + (i / n) * TAU;
      return [p.x + Math.cos(a) * R, p.y - 50 + Math.sin(a) * R * 0.55, a];
    };
    let acc = 0;
    FX.add({
      type: 'vproj', layer: 'glow', x: p.x, y: p.y, life,
      update(q, dt) {
        q.R = 60 + 170 * Math.sin((q.t / life) * Math.PI);
        if ((acc += dt) >= 0.12) {
          acc -= 0.12;
          for (const e of K.around(game, p.x, p.y, q.R + 30)) {
            const d = NC.dist(e.x, e.y, p.x, p.y);
            if (d > q.R - 60 || (two && Math.abs(d - q.R * 0.58) < 50)) K.hit(game, p, 'sh_shuriken', e, 0, 0, NINJA);
          }
        }
      },
      draw(ctx, q) {
        const s = NC.SPR[W.sprite];
        if (!s || !s.img) return;
        const k = T.HELD_K * 0.52;
        for (let i = 0; i < n1; i++) { const [x, y] = at(q, i, n1, false); T.drawShadow(ctx, s, x, y, q.t * 30 + i, k, 1, 1); }
        if (two) for (let i = 0; i < n2; i++) { const [x, y] = at(q, i, n2, true); T.drawShadow(ctx, s, x, y, -q.t * 30 + i, k, -1, 1); }
      },
      onEnd(q) {
        q.t = life; q.R = 60;
        const taken = new Map(), full = new Set();
        const stars = [...Array(n1)].map((_, i) => at(q, i, n1, false)).concat(two ? [...Array(n2)].map((_, i) => at(q, i, n2, true)) : []);
        for (const [x, y, a] of stars) {
          const cx = Math.cos(a), cy = Math.sin(a) * 0.7;
          let d = 0;
          T.star(game, {
            sprite: W.sprite, face: 1, shadow: true, k: 0.52, x, y, rot: a, world: game.world, life: 1.6, spin: 30,
            move(s2, dt) {
              if (!s2.ph) s2.ph = 'out';
              if (s2.ph === 'out') {
                const st = 900 * dt;
                d += st; s2.x += cx * st; s2.y += cy * st;
                if (d < 110) return false;
                s2.tgt = T.next(game, s2.x, s2.y, 420, full);
                if (!s2.tgt) return true;
                const nn = (taken.get(s2.tgt) || 0) + 1; // (taken when chosen: the stars spread over the pack)
                taken.set(s2.tgt, nn); if (nn >= 3) full.add(s2.tgt);
                s2.ph = 'seek';
              }
              if (!alive(s2.tgt)) return true;
              if (!T.toward(s2, s2.tgt.x, s2.tgt.y - 45, 1500, dt, 12)) return false;
              const e = s2.tgt;
              K.hit(game, p, 'sh_shuriken', e, cx * 120, cy * 90, NINJA, 2.5);
              V.sparks(s2.x, s2.y, 5, NINJA, { size: 0.6 });
              return true;
            },
          });
        }
        V.ring(p.x, p.y - 40, 30, 260, 8, NINJA, 0.35);
      },
    });
    V.light(p.x, p.y - 50, 500, NINJA, 0.8, 2.4, { follow: p });
  };
})();
