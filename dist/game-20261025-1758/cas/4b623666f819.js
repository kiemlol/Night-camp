/* statuses.js — the elements' statuses on monsters and the reactions between them (skill system v2, the plan the user
   approved on 2026-09-27):
     เผา burn (fire: damage every half second, up to 5 stacks) · เย็นเฉียบ chill (water: slower; the 3rd stack freezes) ·
     ช็อต shock (wind: takes more from wind, a short stun now and then) [the 3rd chill freezes only with ใจน้ำแข็ง Lv 5] · ร้าว crack (earth: less DEF) · พิษ poison (the
     old one, entities.js) · คำสาป curse (shadow: takes more damage, slower) · ชำระ purify (holy: undead and shadow take more)
   A skill hit of the hero (or of his summons) may cause its element's status: S.st = [status, chance %, seconds], else the
   element's default; the element passives (st_<status> in the skill mods) add to the chance. Hitting a monster that
   carries one status with another element sets off a reaction, with its name big on the screen:
     ไอน้ำระเบิด frozen + fire · ไฟฟ้าช็อตน้ำแข็ง chill/frozen + wind · โอเวอร์โหลด shock + fire · พิษลุกไหม้ poison + fire ·
     ไฟลามทุ่ง burn + wind · ชำระล้าง curse + holy
   (d.mods.react: % stronger reactions, the archmage's หลอมรวมธาตุ). Wraps NC.heroHit (after skilltree.js) and
   NC.drawEnemyBar (the status marks over a monster); ticks from NC.skillTicks. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, SK = NC.SKILLS;
  const rand = NC.rand, TAU = Math.PI * 2;
  const alive = (e) => e && !e.dead && e.hp > 0;

  // the statuses: their element, the default chance (%) and length (s) a skill of that element gives, looks
  const ST = (NC.STATUS = {
    burn: { el: 'fire', chance: 15, dur: 4, th: 'เผา', rgb: '255,140,60', max: 5 },
    chill: { el: 'water', chance: 100, dur: 4, th: 'เย็นเฉียบ', rgb: '150,215,255', max: 3 },
    shock: { el: 'wind', chance: 12, dur: 3, th: 'ช็อต', rgb: '255,236,120', max: 1 },
    crack: { el: 'earth', chance: 20, dur: 5, th: 'ร้าว', rgb: '205,160,110', max: 1 },
    curse: { el: 'shadow', chance: 20, dur: 6, th: 'คำสาป', rgb: '190,120,255', max: 1 },
    purify: { el: 'holy', chance: 25, dur: 5, th: 'ชำระ', rgb: '255,225,120', max: 1 },
  });
  const OF_EL = { fire: 'burn', water: 'chill', wind: 'shock', earth: 'crack', shadow: 'curse', holy: 'purify' };
  NC.statusOf = (e, k) => (e.st && e.st[k] && e.st[k].t > 0 ? e.st[k] : null);

  // put a status on a monster (stacks add up to the status's max; the 3rd chill freezes)
  NC.addStatus = function (game, e, k, dur, o) {
    if (!alive(e)) return;
    const S = ST[k];
    if (!S) return;
    if (!e.st) e.st = {};
    const cur = e.st[k] && e.st[k].t > 0 ? e.st[k] : null, p = game.player;
    const s = cur || (e.st[k] = { t: 0, n: 0, acc: 0 });
    s.t = Math.max(s.t, dur || S.dur);
    const m = (p.d && p.d.mods) || {};
    s.n = Math.min(S.max, (cur ? s.n : 0) + (k === 'burn' && m.burn2 ? 2 : 1)); // (ใจเพลิง Lv 5: burns stack two at a time)
    if (k === 'burn') s.dmg = Math.max(s.dmg || 0, Math.max(1, Math.round(Math.max(p.d.batk, p.d.matk[1]) * 0.12 * ((o && o.k) || 1))));
    if (k === 'chill' && s.n >= 3 && (m.iceStack || m.sureFreeze)) { // frozen solid (ใจน้ำแข็ง Lv 5)
      s.n = 0; s.t = 0;
      NC.statusEnemy(game, e, 'freeze', 1.6 + ((p.d.mods && p.d.mods.freezeT) || 0));
      V.sparks(e.x, e.y - 50, 8, S.rgb, { size: 0.8 });
    }
    if (k === 'crack' && !cur) { e.def0 = e.def; e.def = Math.round(e.def * 0.6); }
    if (k === 'curse') { NC.SkillKit.vuln(game, e, 1.15, s.t, S.rgb); e.slow = Math.max(e.slow || 0, s.t); }
    if (k === 'purify' && (e.element === 'undead' || e.element === 'shadow')) NC.SkillKit.vuln(game, e, 1.2, s.t, S.rgb);
  };
  function clear(e, k) {
    if (!e.st || !e.st[k]) return;
    if (k === 'crack' && e.def0 !== undefined) { e.def = e.def0; e.def0 = undefined; }
    e.st[k].t = 0; e.st[k].n = 0;
  }

  // ---------------- reactions ----------------
  // (over a training dummy the word goes above its readout - name, DPS, totals from y - 259 to y - 193, js/dummy.js - and
  // smaller: at y - 210 it covered the DPS, the owner 2026-10-22: "ฟ้อนตรงนี้มันบังเลขหุ่น เลยไม่รู้ดาเมจ")
  NC.reactionLift = (e) => (e && e.dummy ? 300 : 210);
  const said = (e, text, rgb) => FX.num(e.x, e.y - NC.reactionLift(e), text, { fill: `rgb(${rgb})`, size: e.dummy ? 28 : 38 });
  function reaction(game, p, e, el, r) {
    if (e.reactT > game.time) return 1;
    const boost = 1 + (((p.d.mods && p.d.mods.react) || 0) / 100);
    const frozen = e.frozen > 0, chill = NC.statusOf(e, 'chill'), shock = NC.statusOf(e, 'shock'), burn = NC.statusOf(e, 'burn'), curse = NC.statusOf(e, 'curse');
    const poison = e.poison && e.poison.t > 0;
    let k = 1, name = null, rgb = '255,255,255';
    if (el === 'fire' && frozen) { // steam: the ice bursts
      name = 'ไอน้ำระเบิด!'; rgb = '220,240,255'; k = 1 + boost; e.frozen = 0;
      V.smoke(e.x, e.y - 40, 12, '#eef6ff', '#ffffff', { size: 1.3, max: 260, lifeK: 0.9, a: 0.9 });
      V.ring(e.x, e.y, 20, 150, 12, '220,240,255', 0.45);
      V.at(0, () => { for (const f of NC.SkillKit.around(game, e.x, e.y, 130)) if (f !== e) NC.damageEnemy(game, f, { dmg: Math.round(r.dmg * 0.6 * boost), mod: 1 }, 0, 0, { color: '220,240,255' }); });
    } else if (el === 'wind' && (frozen || chill)) { // the cold carries the current further
      name = 'ไฟฟ้าช็อตน้ำแข็ง!'; rgb = '170,230,255';
      clear(e, 'chill');
      const near = game.enemies.filter((f) => f !== e && alive(f) && NC.dist(f.x, f.y, e.x, e.y) < 240).slice(0, 3);
      V.at(0, () => near.forEach((f) => {
        V.boltAt(e.x, e.y - 50, f.x, f.y - 50, '170,230,255', 0.25, { w: 5, jag: 22, seg: 8 });
        NC.damageEnemy(game, f, { dmg: Math.round(r.dmg * 0.6 * boost), mod: 1 }, 0, 0, { color: '170,230,255' });
        NC.statusEnemy(game, f, 'stun', 0.8);
      }));
      NC.statusEnemy(game, e, 'stun', 0.8);
    } else if (el === 'fire' && shock) { // overload: a blast
      name = 'โอเวอร์โหลด!'; rgb = '255,200,110'; clear(e, 'shock');
      V.ring(e.x, e.y, 20, 170, 14, '255,200,110', 0.4);
      V.glowAt(e.x, e.y - 40, 30, 160, '255,200,110', 0.9, 0.35, { hot: true });
      V.at(0, () => { for (const f of NC.SkillKit.around(game, e.x, e.y, 150)) { const a = NC.angle(e.x, e.y, f.x, f.y); NC.damageEnemy(game, f, { dmg: Math.round(r.dmg * 0.8 * boost), mod: 1 }, Math.cos(a) * 420, Math.sin(a) * 300, { color: '255,200,110' }); } });
    } else if (el === 'fire' && poison) { // the poison catches fire
      name = 'พิษลุกไหม้!'; rgb = '180,240,90';
      const pd = e.poison.dmg; e.poison = null;
      V.bubbles(e.x, e.y, 8, '#8ee05a', { spread: 80, size: 1 });
      V.ring(e.x, e.y, 20, 150, 12, '150,230,90', 0.4);
      V.at(0, () => { for (const f of NC.SkillKit.around(game, e.x, e.y, 140)) { NC.damageEnemy(game, f, { dmg: Math.round(pd * 8 * boost), mod: 1 }, 0, 0, { color: '180,240,90' }); NC.statusEnemy(game, f, 'poison', 3, pd); } });
    } else if (el === 'wind' && burn) { // the wind spreads the fire
      name = 'ไฟลามทุ่ง!'; rgb = '255,160,80';
      for (const f of NC.SkillKit.around(game, e.x, e.y, 160)) if (f !== e) {
        for (let i = 0; i < burn.n; i++) NC.addStatus(game, f, 'burn', burn.t);
        V.flameAt(f.x, f.y - 20, 30, 60, V.PAL.fire, 0.5, { vy: -60 });
      }
    } else if (el === 'holy' && curse) { // the light burns the curse away
      name = 'ชำระล้าง!'; rgb = '255,236,160'; k = 1 + boost; clear(e, 'curse');
      V.beam(e.x, e.y, 70, 520, '255,236,160', 0.4);
      const got = Math.round(p.maxHp * 0.05);
      p.hp = Math.min(p.maxHp, p.hp + got);
      FX.num(p.x, p.y - 150, '+' + got, { fill: '#8dff8a', size: 30 });
    }
    if (!name) return 1;
    e.reactT = game.time + 0.4;
    said(e, name, rgb);
    V.shake(game, 5);
    return k;
  }

  // the hero's hits: first a reaction (from what is on the monster already), then the hit's own status
  const baseHeroHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHeroHit(d, e, o), G = NC.game, p = G && G.player;
    if (!p || p.kind !== 'player' || d !== p.d || !(r.dmg > 0) || !alive(e)) return r;
    const el = o.element || d.atkElement;
    if (!el || el === 'neutral' || el === 'ghost' || el === 'undead') return r;
    const k = reaction(G, p, e, el, r);
    if (k !== 1) r.dmg = Math.max(1, Math.round(r.dmg * k));
    const S = o.sid && SK[o.sid], st = S && S.st;
    const kind = st ? st[0] : OF_EL[el];
    if (kind && ST[kind]) {
      let chance = st ? st[1] : ST[kind].chance;
      if (!o.skill) chance *= 0.5; // a weapon hit (an enchanted weapon): half the chance
      chance += (d.stBonus && d.stBonus[kind]) || 0;
      if (Math.random() * 100 < chance) NC.addStatus(G, e, kind, st ? st[2] : ST[kind].dur);
    }
    return r;
  };

  // ---------------- ticking: burn damage, the looks, running out ----------------
  NC.skillTicks.push((game, p, dt) => {
    for (const e of game.enemies) {
      if (!e.st) continue;
      if (!alive(e)) { e.st = null; continue; }
      for (const k in e.st) {
        const s = e.st[k];
        if (!(s.t > 0)) continue;
        s.t -= dt;
        if (k === 'burn') {
          if ((s.acc += dt) >= 0.5) { s.acc -= 0.5; NC.damageEnemy(game, e, { dmg: s.dmg * s.n, mod: 1 }, 0, 0, { dot: true, color: ST.burn.rgb }); }
          if (NC.EmberFX && NC.EmberFX.burning && NC.EmberFX.burning(game, e, s, dt)) { /* (emberfx.js: a Fire Mage's burns lick in its drawn fire) */ }
          else if (Math.random() < dt * (4 + s.n * 2)) V.flameAt(e.x + rand(-18, 18), e.y - rand(10, 60), rand(16, 24), rand(26, 40), V.PAL.fire, 0.35, { vy: -70 });
        } else if (k === 'chill') {
          e.slow = Math.max(e.slow || 0, 0.2);
          if (Math.random() < dt * 5) V.motes(e.x + rand(-20, 20), e.y - rand(20, 70), 1, ST.chill.rgb, { rise: 20, spread: 4, size: 0.8 });
        } else if (k === 'shock') {
          if (Math.random() < dt * 6) V.sparks(e.x + rand(-16, 16), e.y - rand(30, 70), 2, ST.shock.rgb, { size: 0.6, max: 200 });
          if (Math.random() < dt * 0.6) NC.statusEnemy(game, e, 'stun', 0.3);
        } else if (k === 'curse') {
          if (Math.random() < dt * 3) V.motes(e.x + rand(-18, 18), e.y - rand(20, 80), 1, ST.curse.rgb, { rise: 50, spread: 4, size: 0.9 });
        } else if (k === 'purify') {
          if (Math.random() < dt * 3) V.motes(e.x + rand(-18, 18), e.y - rand(20, 80), 1, ST.purify.rgb, { rise: 60, spread: 4, size: 0.8 });
        }
        if (s.t <= 0) clear(e, k);
      }
    }
  });

  // ---------------- the marks over a monster ----------------
  const ORDER = ['burn', 'chill', 'shock', 'crack', 'curse', 'purify'];
  const baseBar = NC.drawEnemyBar;
  NC.drawEnemyBar = function (ctx, e, game) {
    baseBar(ctx, e, game);
    const marks = ORDER.filter((k) => NC.statusOf(e, k));
    if (e.frozen > 0) marks.unshift('frozen');
    if (!marks.length || !alive(e)) return;
    const y = NC.labelTop(e) - 44, w = 22, x0 = e.x - ((marks.length - 1) * w) / 2;
    marks.forEach((k, i) => {
      const x = x0 + i * w, S = ST[k] || { rgb: '190,235,255' }, s = NC.statusOf(e, k);
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fillStyle = 'rgba(20,16,30,0.85)'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = `rgb(${S.rgb})`; ctx.stroke();
      ctx.fillStyle = `rgb(${S.rgb})`;
      if (k === 'burn' && NC.EmberFX && NC.EmberFX.live()) NC.EmberFX.flameLoop(ctx, x, y + 7, 12, 17, game.time * 15, 1, 1); // (emberfx.js)
      else if (k === 'burn') V.flame(ctx, x, y + 6, 11, 15, game.time * 10, V.PAL.fire, 1);
      else if (k === 'chill' || k === 'frozen') V.star(ctx, x, y, 7, 0.4, k === 'frozen' ? '#e8f6ff' : '#a8dcff', 1);
      else if (k === 'shock') { ctx.beginPath(); ctx.moveTo(x + 2, y - 7); ctx.lineTo(x - 3, y + 1); ctx.lineTo(x + 1, y + 1); ctx.lineTo(x - 2, y + 7); ctx.lineWidth = 2.5; ctx.strokeStyle = `rgb(${S.rgb})`; ctx.stroke(); }
      else if (k === 'crack') { ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x, y); ctx.lineTo(x - 2, y + 5); ctx.moveTo(x, y); ctx.lineTo(x + 5, y - 2); ctx.lineWidth = 2; ctx.strokeStyle = `rgb(${S.rgb})`; ctx.stroke(); }
      else if (k === 'curse') V.skull(ctx, x, y, 11, '#d6b0ff', 1);
      else if (k === 'purify') { ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.lineWidth = 2; ctx.stroke(); }
      if (s && s.n > 1) { ctx.font = '800 11px "Baloo 2", sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(String(s.n), x + 8, y + 11); }
      ctx.restore();
    });
  };
})();
