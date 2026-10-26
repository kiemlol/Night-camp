/* priest_skills.js — what the priest's skills do and look like (the numbers are in priest.js):
   Q ฮีล (heal the hero and the party round him; undead / shadow monsters close by burn), E พรศักดิ์สิทธิ์ (a blessing:
   stronger attacks for a while, for the hero and the party), R แสงศักดิ์สิทธิ์ (a beam of light from the sky onto the
   monster by the mouse), F วงเวทแสงขับมาร (a great holy circle, pillars of light in waves).
   Built like skills.js (NC.SKILL_RUN, NC.skillHelpers, vfx.js). Also: the blessing in NC.derive and among the HUD's
   buff icons, and the priest's class set next to the rogue's in NC.CLASSES. Loaded after skills.js and hud.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, SK = NC.SKILLS, RUN = NC.SKILL_RUN, H = NC.skillHelpers;
  const TAU = Math.PI * 2, rand = NC.rand;
  const HOLY = V.RGB.holy, SKY = '160,215,255', WHITE = '255,250,235', GREEN = '150,255,170';

  // the class set, after the rogue's (the equipment screen's class buttons, the outfit of a job change)
  const at = NC.CLASSES.findIndex((c) => c.id === 'rogue');
  if (!NC.CLASSES.some((c) => c.id === 'priest')) NC.CLASSES.splice(at + 1, 0, NC.PRIEST.cls);

  const party = () => ((NC.allies ? NC.allies(NC.game) : NC.Party && NC.Party.members) || []).filter((a) => a.dead <= 0); // (+ the real players: js/partysupport.js)
  const castClip = (p) => NC.Anim.setOf(NC.Anim.movesFor(p.moves, NC.weaponDef(p))).combo('bolt')[0];
  // a green plus rising over someone who was healed
  FX.def('vplus', (ctx, q, u) => {
    const s = 20 + 8 * Math.sin(u * Math.PI), y = q.y - 120 - 60 * u;
    ctx.save(); ctx.globalAlpha *= 1 - u * u;
    ctx.fillStyle = NC.OUTLINE;
    ctx.fillRect(q.x - s * 0.36 - 3, y - s - 3, s * 0.72 + 6, s * 2 + 6); ctx.fillRect(q.x - s - 3, y - s * 0.36 - 3, s * 2 + 6, s * 0.72 + 6);
    ctx.fillStyle = '#8dff9a';
    ctx.fillRect(q.x - s * 0.36, y - s, s * 0.72, s * 2); ctx.fillRect(q.x - s, y - s * 0.36, s * 2, s * 0.72);
    ctx.restore();
  }, 'glow');
  // the blessing: white wings open behind someone for a moment
  FX.def('vwings', (ctx, q, u) => {
    const o = q.follow, x = o.x, y = o.y - 95, a = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8, open = 0.55 + 0.45 * Math.min(1, u / 0.25);
    ctx.save();
    ctx.globalAlpha *= a;
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(x, y); ctx.scale(side, 1); ctx.rotate(-0.25 * open);
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.bezierCurveTo(40, -70 * open, 110, -80 * open, 120, -30 * open);
      ctx.bezierCurveTo(100, -10, 96, 10, 80, 12);
      ctx.bezierCurveTo(70, 26, 50, 30, 36, 24);
      ctx.bezierCurveTo(26, 30, 14, 24, 6, 10);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,250,0.92)'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
      ctx.strokeStyle = 'rgba(160,190,230,0.9)'; ctx.lineWidth = 3;
      for (const k of [0.35, 0.6, 0.82]) { ctx.beginPath(); ctx.moveTo(10 + 100 * k, -48 * open * (1 - k * 0.4)); ctx.lineTo(8 + 80 * k, 10); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }, 'glow');

  // ======== Q: ฮีล ========
  RUN.pr_heal = function (game, p, lv) {
    H.pose(game, p, 'cheer', 0.35);
    // (another player's heal replayed here, js/net.js: they have no stats on my screen, so only the looks on them, no numbers)
    // (online a presented cast heals no one: the server's heal events draw each '+N' that landed, its plus and ring,
    // js/online/support.js; the look keeps the glow on each)
    const k = SK.pr_heal.heal(lv) / 100, magic = p.d ? (p.d.matk[0] + p.d.matk[1]) / 2 : 0, own = !game.presentationOnly;
    for (const who of p.remote ? [p] : [p, ...party().filter((a) => NC.dist(a.x, a.y, p.x, p.y) < 440)]) {
      V.glowAt(who.x, who.y - 70, 30, 120, GREEN, 0.5, 0.4);
      if (!own) continue;
      const got = Math.max(0, Math.min(Math.round(who.maxHp * k + magic * (1.2 + 0.25 * lv)), who.maxHp - who.hp));
      who.hp += got;
      if (!p.remote) FX.num(who.x, who.y - 150, '+' + got, { fill: '#8dff8a', size: who === p ? 44 : 36 });
      FX.add({ type: 'vplus', x: who.x, y: who.y, life: 0.9 });
      V.ring(who.x, who.y - 6, 20, 120, 8, GREEN, 0.45);
      V.motes(who.x, who.y - 40, 10, GREEN, { spread: 60, rise: 150 });
    }
    V.circle(p.x, p.y, 120, HOLY, 0.8, { style: 'holy', spin: 2, follow: p, a: 0.8 });
    V.light(p.x, p.y - 60, 300, HOLY, 0.7, 0.5, { follow: p });
    // like classic MMOs' Heal: it burns the undead (and the creatures of darkness) close by
    for (const e of H.around(game, p.x, p.y, 260))
      if (e.element === 'undead' || e.element === 'shadow') { H.strike(game, p, 'pr_heal', e, 0, 0, { color: HOLY }); V.flare(e.x, e.y - 50, 60, HOLY, 0.3); }
  };

  // ======== E: พรศักดิ์สิทธิ์ ========
  RUN.blessing = function (game, p, lv) {
    H.pose(game, p, 'cheer', 0.4);
    const S = SK.blessing, dur = S.dur(lv), k = 1 + S.pct(lv) / 100;
    p.buffs.bless = dur; p.blessK = k; p.blessHit = 4 + lv * 2; p.blessOn = true;
    NC.applyGear(game);
    for (const a of party().filter((m) => NC.dist(m.x, m.y, p.x, p.y) < 520)) { a.bless = game.time + dur; a.blessK = k; }
    for (const who of [p, ...party().filter((m) => NC.dist(m.x, m.y, p.x, p.y) < 520)]) {
      FX.add({ type: 'vwings', follow: who, x: who.x, y: who.y, life: 1.2 });
      V.ring(who.x, who.y - 6, 20, 150, 9, SKY, 0.5);
      V.stars(who.x, who.y - 90, 8, '#fff0b0', HOLY, { speed: 240 });
      V.motes(who.x, who.y - 30, 12, HOLY, { spread: 50, rise: 200 });
    }
    V.light(p.x, p.y - 60, 360, SKY, 0.8, 0.6, { follow: p });
    V.flash('255,248,220', 0.1, 0.25);
  };
  // the blessing makes the hero's attacks stronger while it lasts (NC.derive; applyGear again when it ends)
  const baseDerive = NC.derive;
  NC.derive = function (p) {
    const d = baseDerive(p);
    if (p.buffs && p.buffs.bless > 0 && p.blessK) {
      d.atkMul *= p.blessK;
      d.matk = [Math.round(d.matk[0] * p.blessK), Math.round(d.matk[1] * p.blessK)];
      d.hit += p.blessHit || 0;
    }
    return d;
  };
  const baseTick = NC.updateSkills;
  NC.updateSkills = function (game, dt) {
    baseTick(game, dt);
    const p = game.player;
    if (p.blessOn && !(p.buffs.bless > 0)) { p.blessOn = false; NC.applyGear(game); }
    if (p.blessOn && Math.random() < dt * 6) V.motes(p.x + rand(-24, 24), p.y - rand(20, 110), 1, SKY, { rise: 60, spread: 4, size: 0.8 });
  };
  // its icon among the HUD's buffs (hud.js lists its own three)
  const baseBuffs = NC.HUD.renderBuffs;
  NC.HUD.renderBuffs = function (p) {
    baseBuffs.call(this, p);
    const box = document.getElementById('buffs');
    if (!box) return;
    const t = (p.buffs && p.buffs.bless) || 0;
    let d = box.querySelector('[data-k="bless"]');
    if (t > 0 && !d) {
      d = document.createElement('div');
      d.className = 'buff'; d.dataset.k = 'bless'; d.title = SK.blessing.name;
      d.innerHTML = `<img src="${(NC.ASSET_MANIFEST.sk_blessing || {}).src || ''}" alt=""><b></b>`;
      box.appendChild(d);
    }
    if (d && t <= 0) { d.remove(); return; }
    if (d) { d.querySelector('b').textContent = t >= 1 ? Math.ceil(t) : t.toFixed(1); d.classList.toggle('ending', t < 1.5); }
  };

  // ======== R: แสงศักดิ์สิทธิ์ ========
  RUN.holylight = function (game, p, lv) {
    const [gx, gy] = H.ground(game, p, 560);
    const e = H.nearest(game, gx, gy, 240, 1)[0] || H.nearest(game, p.x, p.y, 560, 1, p.aim, 0.9)[0];
    const tx = e ? e.x : gx, ty = e ? e.y : gy;
    H.pose(game, p, castClip(p), 0.3);
    V.gather(H.tip(p)[0], H.tip(p)[1], 10, HOLY, 60, 0.18);
    V.circle(tx, ty, 80, HOLY, 0.6, { style: 'holy', spin: 2.2 });
    V.at(0.1, () => {
      V.beam(tx, ty, 74, 640, HOLY, 0.45);
      V.ring(tx, ty, 10, 150, 10, HOLY, 0.4);
      V.glowAt(tx, ty - 40, 40, 170, HOLY, 0.7, 0.35, { hot: true });
      V.stars(tx, ty - 60, 10, '#ffe68a', HOLY, { speed: 300 });
      V.light(tx, ty - 40, 380, HOLY, 0.9, 0.5);
      V.shake(game, 5);
      for (const m of H.around(game, tx, ty, 90)) H.strike(game, p, 'holylight', m, 0, 0, { big: true, color: HOLY });
    });
  };

  // ======== F: วงเวทแสงขับมาร ========
  RUN.magnus = function (game, p, lv) {
    const [cx, cy] = H.ground(game, p, 360), R = 260;
    H.pose(game, p, 'cheer', 0.9);
    V.circle(cx, cy, R, HOLY, 3.6, { style: 'holy', spin: 0.8, grow: true });
    V.circle(cx, cy, R * 0.6, SKY, 3.6, { style: 'star', spin: -1.3, a: 0.8 });
    V.light(cx, cy - 40, 640, HOLY, 1, 3.6);
    V.gather(cx, cy - 40, 24, HOLY, 280, 0.5);
    V.flash('255,245,210', 0.16, 0.4);
    for (let w = 0; w < 8; w++)
      V.at(0.45 + w * 0.38, () => {
        for (let k = 0; k < 3; k++) {
          const a = rand(0, TAU), r = rand(0, R * 0.85), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * V.SQ;
          V.beam(x, y, 52, 560, k ? HOLY : WHITE, 0.42);
          V.ring(x, y, 10, 80, 6, WHITE, 0.3);
          V.stars(x, y - 40, 4, '#fff3c0', HOLY, { speed: 220 });
        }
        V.ring(cx, cy, R * 0.9, R * 1.04, 8, HOLY, 0.35);
        V.shake(game, 3);
        for (const e of H.around(game, cx, cy, R)) H.strike(game, p, 'magnus', e, 0, 0, { color: HOLY });
      });
    V.at(3.5, () => { V.ring(cx, cy, 30, R * 1.25, 14, HOLY, 0.5); V.flash('255,245,210', 0.12, 0.3); V.shake(game, 9); V.motes(cx, cy - 30, 30, HOLY, { spread: R, rise: 220 }); });
  };
})();
