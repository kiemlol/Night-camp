/* ultbuff.js — the puppeteer's and the wisp shepherd's ultimates brought up near the ice mage's ยุคน้ำแข็ง (the user,
   2026-10-20: "บัฟตัว หุ่นเชิด กับ ตัว ผู้เลี้ยงดวงไฟหน่อย ตอนนี้ เมจน้ำแข็ง สกิล เมต้ามาก ... ให้โหด ใกล้เคียง สกิลยุคน้ำแข็ง";
   plan A: these two go up, the ice age stays as it is). Measured on a pack of 12 spread over the screen: README
   "บัฟอัลติหุ่นเชิด + ผู้เลี้ยงดวงไฟ".
     โรงละครหุ่นเชิด  the stage goes with the puppeteer (900 round the hero, was 420 on the ground 300 ahead) for 8 s (was 6; its
                     cooldown 11 s, the ice age's whole round of a 3.5 s cast + 8 s); every monster in it is held still and,
                     each second, takes its hit and strikes the nearest other one with OUR power (was its own); every 2 s
                     the threads yank them in toward the hero; at the end "ปิดม่าน" strikes each one hard. A boss is not held:
                     slowed, and it turns on the battle puppet.
     คืนหิ่งห้อยพันดวง  10 s round the shepherd (1000): every monster in it dazzled (its hits do half, slowed) and wisp-marked
                     (a hit on it bursts a wisp, once every half second); every 2 s a wisp dives onto each one and bursts
                     on the 6 nearest; the party takes x0.8, the shepherd gets a wisp shield. (Refilling the circling wisps and
                     a swarm twice as fast were tried and dropped: the single-target and support numbers went up 30-55%.)
     side            ขึงด้ายเหล็ก / รัดด้าย x1.3 (the wire lane read 2,030 single of its 2,900); ฝูงดวงไฟพุ่ง bursts wider.
   New looks are the light kit's painted pieces (js/lightkit.js: line, burst, ring, pillar) and the skills' own looks
   (NC.PuppetLooks, NC.WispLooks); nothing new is drawn by code.
   Online (?online) the Go server runs them (backend patch tools/online/patches/019_ult_buff.patch: ult_buff.go,
   job_puppeteer_skills.go castTheatre, job_wisp*.go): here the numbers and the cards stay, a cast only draws (the stage
   following the hero, the night's ring), the night's marks are a look on the monsters near, and js/online/ultlooks.js
   draws the yanks, the curtain, the rain and the bursts from the server's events. Ship the web and the server together.
   After rotiming.js and lightkit.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, SK = NC.SKILLS, LK = NC.LightKit;
  if (!K || !RUN || !SK || !SK.pp_theatre || !SK.ws_night) return;
  NC.ULT_BUFF = true;
  const ONLINE = NC.ONLINE; // (the server plays them: looks only here)

  // ---------------- the numbers (tuned with the 12-spread pack, README) ----------------
  const TH = { R: 900, dur: 8, cd: 11, mul: (lv) => 0.5 + lv * 0.5, kin: 6, yankEvery: 2, fin: 58 };
  const NT = { reach: 1000, mul: (lv) => 0.5 + lv * 0.1, mark: 2.5, markEvery: 0.5, rain: 9, splashR: 130, splashK: 0.6, splashMost: 6,
    weak: 0.5, guard: 0.8, shield: (lv) => 2 + lv * 0.4 };
  const WIRE = { k: 1.3 }, RUSH = { r: 150, k: 0.7 };

  const THREAD = '215,195,255', THREAD_HEX = '#d7c3ff', WISP = '140,255,220', WISP_HEX = '#8cffdc';
  const alive = K.alive, pct = (k) => Math.round(k * 100);
  const lvOf = (p, id) => NC.skillLv(p, id);
  const isBoss = (e) => !!((NC.BOSSES && NC.BOSSES[e.type]) || e.boss || e.isBoss);
  const isWS = (p) => p && NC.isJob(p, 'wisp');
  const matk = (p) => (p.d ? (p.d.matk[0] + p.d.matk[1]) / 2 : 0);
  const puppet = () => (NC.Pets ? NC.Pets.list.find((q) => /^pp_/.test(q.type) && q.dead <= 0) : null);
  const PPL = NC.PuppetLooks, WSL = NC.WispLooks;

  // =====================================================================================================
  // โรงละครหุ่นเชิด
  // =====================================================================================================
  const T0 = SK.pp_theatre;
  T0.mul = TH.mul;
  T0.cd = TH.cd;
  T0.desc = (lv, m) => `เวทีหุ่นเชิดรอบตัวเรา (วง ${TH.R}) ${TH.dur} วิ ศัตรูทุกตัวบนเวทีถูกตรึงอยู่กับที่ โดน ${m}% ของ ATK ทุกวิ แล้วหันไปฟาดตัวข้าง ๆ ด้วยพลังของเรา · ทุก ${TH.yankEvery} วิ กระตุกด้ายลากมอนเข้าหาเรา · จบโชว์ "ปิดม่าน" ฟาดทุกตัว ${Math.round(m * TH.fin)}% · บอสไม่ถูกตรึง แต่ช้าลงและหันไปตีหุ่นรบ`;
  T0.grow = `วง ${TH.R} ตามตัว ${TH.dur} วิ · มอนฟาดกันด้วยพลังเรา · กระตุกด้าย · ปิดม่าน`;
  const nearestOther = (list, e) => { let best = null, bd = Infinity; for (const o of list) { const d = NC.dist(o.x, o.y, e.x, e.y); if (o !== e && d < bd) { best = o; bd = d; } } return best; };
  // online / a presented cast: the stage only, following the caster, its strings on the monsters on it (the server
  // holds, strikes, yanks and closes the curtain: js/online/ultlooks.js draws those)
  function stageLook(game, p) {
    K.pose(game, p, 'cheer', 0.5);
    FX.text(p.x, p.y - 205, 'โรงละครหุ่นเชิด!', `rgb(${THREAD})`, 34);
    if (LK) LK.ring(p.x, p.y, { r1: TH.R, col: THREAD_HEX, life: 0.8, a: 0.7 });
    const live = () => (NC.game && NC.game.enemies) || game.enemies || [];
    FX.add({ type: 'j3theatre', layer: 'glow', life: TH.dur, x: p.x, y: p.y, R: TH.R,
      update(q) { q.x = p.x; q.y = p.y; q.got = live().filter((e) => alive(e) && !e.pvp && NC.dist(e.x, e.y, p.x, p.y) < TH.R); } });
    if (V.light) V.light(p.x, p.y - 60, TH.R * 1.6, '200,170,255', 0.7, TH.dur, { follow: p });
  }
  RUN.pp_theatre = function (game, p, lv) {
    if (game.presentationOnly || ONLINE) return stageLook(game, p);
    K.pose(game, p, 'cheer', 0.5);
    FX.text(p.x, p.y - 205, 'โรงละครหุ่นเชิด!', `rgb(${THREAD})`, 34);
    V.flash('200,170,255', 0.12, 0.3);
    if (LK) LK.ring(p.x, p.y, { r1: TH.R, col: THREAD_HEX, life: 0.8, a: 0.7 });
    let acc = 0, n = 0, yankT = -1;
    FX.add({ type: 'j3theatre', layer: 'glow', life: TH.dur, x: p.x, y: p.y, R: TH.R,
      update(q, dt) {
        q.x = p.x; q.y = p.y;
        const got = K.around(game, p.x, p.y, TH.R).filter((e) => !e.pvp), pup = puppet(), damp = game.time > yankT;
        for (const e of got) {
          if (isBoss(e)) { K.slow(e, 0.3); if (pup) { e.tgt = pup; e.tgtLock = game.time + 0.5; } continue; }
          e.stun = Math.max(e.stun || 0, 0.15);
          if (damp) { e.kbx *= 0.5; e.kby *= 0.5; }
        }
        q.got = got;
        if ((acc += dt) < 1) return;
        acc -= 1; n++;
        // each one's hit, then its blow (our power) on the nearest other one held
        for (const e of got) K.hit(game, p, 'pp_theatre', e, 0, 0, THREAD);
        for (const e of got) {
          if (isBoss(e)) continue;
          const t = nearestOther(got, e);
          if (!t || !alive(t)) continue;
          if (PPL) PPL.charmStrike(t);
          K.hit(game, p, 'pp_theatre', t, 0, 0, THREAD, TH.kin);
        }
        // every 2 s: the threads yank them in (the hold lets go of the pull for a moment)
        if (n % TH.yankEvery === 0) {
          const [hx, hy] = K.tip(p);
          let any = false;
          for (const e of got) {
            const d = NC.dist(e.x, e.y, p.x, p.y);
            if (isBoss(e) || d < 300) continue; // (a ring round the hero, not a heap on top)
            K.pull(e, p.x, p.y, 9 * Math.min(d - 260, d * 0.4, 300));
            if (LK) LK.line(e.x, e.y - 60, hx, hy, { col: THREAD_HEX, life: 0.3, w: 6 });
            any = true;
          }
          if (any) { yankT = game.time + 0.35; FX.text(p.x, p.y - 235, 'กระตุกด้าย!', `rgb(${THREAD})`, 26); }
        }
      },
      onEnd() { // ปิดม่าน: every one on the stage struck hard
        if (p.dead > 0 || !NC.isJob(p, 'puppeteer')) return;
        const got = K.around(game, p.x, p.y, TH.R).filter((e) => !e.pvp);
        FX.text(p.x, p.y - 215, 'ปิดม่าน!', `rgb(${THREAD})`, 36);
        if (LK) LK.ring(p.x, p.y, { r0: TH.R, r1: 60, col: THREAD_HEX, life: 0.45, a: 0.8 });
        V.shake(game, 8);
        got.forEach((e, i) => V.at(0.12 + i * 0.03, () => {
          if (!alive(e)) return;
          if (LK) LK.burst(e.x, e.y - 50, { k: 0.6, col: THREAD_HEX, n: 6, spark: 4 });
          K.hit(game, p, 'pp_theatre', e, 0, 0, THREAD, TH.fin, { big: true });
        }));
      } });
    if (V.light) V.light(p.x, p.y - 60, TH.R * 1.6, '200,170,255', 0.7, TH.dur, { follow: p });
  };

  // ด้ายสังหาร: the wire and the bind hit harder
  for (const id of ['pp_stretch', 'pp_bind']) { const S = SK[id], m0 = S.mul; S.mul = (lv) => m0(lv) * WIRE.k; }

  // =====================================================================================================
  // คืนหิ่งห้อยพันดวง
  // =====================================================================================================
  const N0 = SK.ws_night;
  N0.mul = NT.mul;
  N0.desc = (lv, m) => `ดวงไฟนับพันลอยขึ้นทั่วจอ 10 วิ ศัตรูโดนดวงไฟรุมวิละ ${m * 2}% ของ MATK · "แสงพร่า" ศัตรูตีเบาลงครึ่งหนึ่งและช้าลง · ดวงไฟติดทุกตัว ใครในทีมตีโดนก็ระเบิดเพิ่ม ${Math.round(m * NT.mark)}% · ทุก 2 วิ ฝนดวงไฟดิ่งใส่ทุกตัว ${Math.round(m * NT.rain)}% ลามตัวข้าง ๆ ${NT.splashMost} ตัว · พวกเราฟื้น HP 2% ทุกวิ รับดาเมจ ×${NT.guard} · เราได้โล่ดวงไฟ ${pct(NT.shield(lv))}% ของ MATK`;
  N0.grow = 'ทั้งจอ 10 วิ · แสงพร่า · ดวงไฟติดทุกตัว · ฝนดวงไฟ · โล่ดวงไฟ';
  const oldNight = RUN.ws_night;
  RUN.ws_night = function (game, p, lv) {
    oldNight.apply(this, arguments); // (the pose, the 10 s, the shout, the fireflies over the screen)
    if (game.presentationOnly || ONLINE) { if (LK) LK.ring(p.x, p.y, { r1: NT.reach, col: WISP_HEX, life: 0.9, a: 0.6 }); return; }
    p.wsNightLv = lv; p.wsNightRain = game.time;
    K.buffFriends(game, p, { r: 1200, dur: 10, guard: NT.guard, rgb: WISP });
    p.wsNightShield = Math.round(matk(p) * NT.shield(lv) * K.healPow(p));
    if (LK) LK.ring(p.x, p.y, { r1: NT.reach, col: WISP_HEX, life: 0.9, a: 0.6 });
  };
  // every 2 s: a wisp dives onto each one and bursts on the ones near it
  function rain(game, p) {
    const list = game.enemies.filter((e) => alive(e) && NC.dist(e.x, e.y, p.x, p.y) < NT.reach);
    list.forEach((e, i) => V.at(i * 0.035, () => {
      if (!alive(e)) return;
      if (LK) LK.pillar(e.x, e.y, { w: 34, h: 520, life: 0.4, col: WISP_HEX, drop: true, impact: true });
      V.at(0.12, () => {
        if (!alive(e) || !(p.wsNight > game.time - 0.5)) return;
        K.hit(game, p, 'ws_night', e, 0, 0, WISP, NT.rain);
        // (the 6 nearest at most, as the ice age's shatter sends 6 shards: a heap of 30 would take it 30 x 29 times)
        const near = K.around(game, e.x, e.y, NT.splashR).filter((o) => o !== e && !o.pvp).sort((a, b) => NC.dist(a.x, a.y, e.x, e.y) - NC.dist(b.x, b.y, e.x, e.y)).slice(0, NT.splashMost);
        for (const o of near) K.hit(game, p, 'ws_night', o, 0, 0, WISP, NT.rain * NT.splashK);
      });
    }));
  }
  // online the marks are a look only (the server bursts them): a tick world.js leaves running (.online)
  const markLook = (game, p) => {
    if (!ONLINE || !isWS(p) || !(p.wsNight > game.time)) return;
    for (const e of game.enemies) if (alive(e) && !e.pvp && NC.dist(e.x, e.y, p.x, p.y) < NT.reach && !(e.wsMark && e.wsMark.until > game.time && e.wsMark.next < 1e8)) e.wsMark = { until: game.time + 0.4, next: 1e9 };
  };
  markLook.online = true;
  NC.skillTicks.push(markLook);
  NC.skillTicks.push((game, p) => {
    if (ONLINE || !isWS(p) || !(p.wsNight > game.time) || game.presentationOnly) return;
    for (const e of game.enemies) {
      if (!alive(e) || e.pvp || NC.dist(e.x, e.y, p.x, p.y) >= NT.reach) continue;
      K.weak(game, e, NT.weak, 0.3);
      K.slow(e, 0.3);
      // the mark's wisp over its head (j3wisps draws it); a real ดวงไฟติดศัตรู keeps its own
      if (!(e.wsMark && e.wsMark.until > game.time && e.wsMark.next < 1e8)) e.wsMark = { until: game.time + 0.4, next: 1e9 };
    }
    if (game.time - (p.wsNightRain || 0) >= 2) { p.wsNightRain = game.time; rain(game, p); }
  });
  // the marks: a hit on a monster under the night (anyone's) bursts a wisp, once every half second
  const baseDE = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r) {
    const out = baseDE.apply(this, arguments);
    const p = game && game.player;
    if (ONLINE || !p || game.presentationOnly || !isWS(p) || !(p.wsNight > game.time) || !e || e.pvp || !alive(e) || !(r && r.dmg > 0)) return out;
    if (game.time < (e._wsnNext || 0) || NC.dist(e.x, e.y, p.x, p.y) >= NT.reach) return out;
    e._wsnNext = game.time + NT.markEvery;
    V.at(0, () => { if (!alive(e)) return; if (WSL) WSL.markBurst(e); K.hit(game, p, 'ws_night', e, 0, 0, WISP, NT.mark); });
    return out;
  };
  // the party's x0.8 (K.buffFriends) is ours too while the night lasts, after the wisp shield soaks what it can
  NC.heroGuards.push((game, p, dmg) => {
    if (ONLINE || !isWS(p) || !(p.wsNight > game.time) || !(dmg > 0)) return dmg;
    dmg *= NT.guard;
    if (p.wsNightShield > 0) {
      const s = Math.min(p.wsNightShield, dmg);
      p.wsNightShield -= s; dmg -= s;
      if (s >= 1 && WSL) WSL.soak(p.x, p.y, s);
    }
    return Math.round(dmg);
  });

  // ฝูงดวงไฟพุ่ง: each wisp bursts wider (150, was 80) and harder on the ones near (70%, was 50%)
  const R0 = SK.ws_rush;
  R0.desc = (lv, m) => `ดวงไฟทุกดวงพุ่งรุมเป้า ดวงละ ${m}% ของ MATK ระเบิดเป็นวงกว้าง ตัวรอบ ๆ โดน ${pct(RUSH.k)}%${lv >= 10 ? ' · ดวงไฟครึ่งหนึ่งเกิดใหม่ทันที' : ''}`;
  function healRing(game, p, x, y) { // ใจดวงไฟ Lv 3 (as jobs3_skills_c.js healRing)
    if (WSL) WSL.healRing(x, y);
    for (const a of [p, ...K.friends(game, p, 900)]) if (NC.dist(a.x, a.y, x, y) < 120 && a.hp < a.maxHp) K.heal(game, a, matk(p) * 0.2 * K.healPow(p), { quiet: true });
  }
  const oldRush = RUN.ws_rush;
  RUN.ws_rush = function (game, p, lv) {
    if (game.presentationOnly || ONLINE || p.remote || !WSL) return oldRush.apply(this, arguments);
    K.pose(game, p, K.clip(p, 'bolt', 0), 0.3);
    const e = K.target(game, p, 750, 300);
    if (!e) return;
    const n = p.wsOrbit || 0, big = lvOf(p, 'ws_heart') >= 5 && n >= 5, t = game.time, heart3 = lvOf(p, 'ws_heart') >= 3;
    for (let i = 0; i < n; i++) {
      const from = WSL.pos(p, i, n, t);
      V.at(i * 0.06, () => WSL.fly(game, p, from, e, 'ws_rush', 700 * (1 + 0.03 * lvOf(p, 'ws_swift')), (f) => {
        K.hit(game, p, 'ws_rush', f, 0, 0, WISP, big ? 1.5 : 1);
        for (const o of K.around(game, f.x, f.y, RUSH.r)) if (o !== f) K.hit(game, p, 'ws_rush', o, 0, 0, WISP, RUSH.k);
        if (heart3) healRing(game, p, f.x, f.y);
      }));
    }
    p.wsOrbit = lv >= 10 ? Math.floor(n / 2) : 0;
    p.wsRegrowT = game.time;
  };

  NC.ULT_BUFF_TUNE = { TH, NT, RUSH, WIRE }; // (the balance kit reads / sets these)
})();
