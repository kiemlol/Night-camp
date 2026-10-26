/* casting.js — classic MMOs' cast bar, the user's idea (2026-09-27): spells, heals, party buffs, summons and ultimates take a
   moment to cast before they go off.
   - cast time = full time x (0.8 x (1 - DEX / 150) + 0.2) x (1 - the cast buffs): DEX cuts 80% of it (all of that at DEX
     150, the classic rule); the other 20% only buffs cut (the fixed part: Swift Chant, Rite of Haste, Memorize Spell;
     mods castRed = % less, all together 60% at most, castFixed0 = no fixed part)
   - while casting the hero stands (no basic attacks, no other skill); stepping off in a new direction cancels it (no
     SP spent, no cooldown); a hit pushes the bar back 0.2 s (twice per cast at most)
   - a bar over the head with the skill's name, a magic circle in the element's colour under the feet, a ring where an
     area spell will land (it lands where the mouse is when the bar fills); the other players see my bar too (net.js)
   Full cast times are CAST below (0 or missing: instant, like most physical skills and the auto-attack lines' buffs).
   Loaded after net.js: its castSkill wraps net.js's, so the others hear of a skill when it goes off. */
(function () {
  'use strict';
  const NC = window.NC, SK = NC.SKILLS, FX = NC.FX, V = NC.VFX, TAU = Math.PI * 2;

  // ---------------- the full cast times (seconds, before DEX) ----------------
  const CAST = {
    // mage / archmage / warlock
    fireball: 0.8, frostdiver: 0.8, thunder: 0.9, meteor: 3, mg_firewall: 1.2, mg_quake: 1, mg_frostnova: 1,
    am_missile: 0.5, am_blizzard: 1.8, am_eclipse: 3, am_chain: 1, am_firepillar: 1.2, am_gravity: 1.5,
    am_inferno: 1.8, am_glacial: 1.2, am_lordthunder: 1.8,
    wl_soulfire: 0.7, wl_wisps: 1, wl_chains: 0.8, wl_parade: 2.5, wl_soulburn: 1, wl_lantern: 1.4, wl_hex: 0.9,
    // priest / bishop
    pr_heal: 0.4, blessing: 0.6, holylight: 0.9, magnus: 2.8, pr_agi: 0.6, pr_angelus: 0.8, pr_aspersio: 0.8, pr_resurrect: 1.5,
    bi_heal: 0.5, bi_barrier: 1, bi_sanctuary: 1.6, bi_miracle: 2.8, bi_magnificat: 1.5, bi_impositio: 0.6, bi_turnundead: 1,
    bi_assumptio: 1.5, bi_lexdivina: 0.8,
    // the others' spells, summons and charged shots
    judgment: 0.8, starshot: 1.2, pal_cross: 0.8, pal_heaven: 1.5, pal_devotion: 0.6, pal_layhands: 0.6,
    dk_breath: 0.5, dk_roar: 1, dk_wyvern: 1.2, rg_snipe: 1, rg_storm: 1.2, wh_wolf: 1, wh_pack: 0.8,
    sh_katon: 0.6, sh_raiton: 0.8, sh_clone: 0.6, mo_asura: 1.2,
    // v2.1: the party buffs
    pr_gloria: 0.8, bi_clementia: 1, bi_canto: 1, bi_sacrament: 1, bi_expiatio: 1, bi_battlehymn: 0.8,
  };
  NC.CAST_TIMES = CAST;
  // where an area spell lands: [how far the mouse may be (skills.js ground), radius] or 'self' (around the caster)
  const AREA = {
    meteor: [440, 300], magnus: [360, 280], mg_firewall: [320, 170], am_blizzard: [460, 260], am_eclipse: [420, 280],
    am_firepillar: [420, 150], am_gravity: [460, 220], am_inferno: [440, 260], am_lordthunder: [440, 280],
    bi_sanctuary: [420, 240], pal_heaven: [380, 260], rg_storm: [460, 280],
    mg_frostnova: ['self', 260], bi_miracle: ['self', 420], wl_parade: ['self', 320],
  };
  NC.CAST_AREA = AREA; // (js/autofarm.js: a long area spell waits for a group)
  NC.castBase = (id, lv) => { const S = SK[id], c = S && (S.castT !== undefined ? S.castT : CAST[id]); return typeof c === 'function' ? c(lv) : c || 0; };
  // (S.castFree(p): no cast right now, e.g. Asura during Fury; p.castInstant / p.castNextK: the next cast only)
  NC.castTime = function (p, id, lv) {
    const S = SK[id], b = NC.castBase(id, lv);
    if (!(b > 0) || (S && S.castFree && S.castFree(p))) return 0;
    const d = p.d || {}, m = d.mods || {};
    const dex = d.dex || 1, red = Math.min(60, m.castRed || 0) / 100, fixed = m.castFixed0 ? 0 : 0.2;
    if (p.castInstant) return 0;
    return b * (0.8 * Math.max(0, 1 - dex / 150) + fixed) * (1 - red) * (p.castNextK || 1);
  };

  // the colour of a skill's circle: its element's
  const EL_RGB = { fire: V.RGB.fire, water: V.RGB.ice, wind: V.RGB.wind, earth: V.RGB.rock, poison: V.RGB.poison, holy: V.RGB.holy,
    shadow: V.RGB.shadow, ghost: '200,235,255', undead: '170,200,150', neutral: '190,215,255' };
  const colourOf = (p, S) => {
    let el = S.element || 'neutral';
    if (S.form) { const f = S.form(p); el = f === 'ice' ? 'water' : f === 'storm' ? 'wind' : 'fire'; }
    return EL_RGB[el] || EL_RGB.neutral;
  };
  const styleOf = (S) => (S.element === 'holy' ? 'holy' : S.element === 'shadow' ? 'occult' : S.ult ? 'star' : 'arcane');

  // ---------------- casting ----------------
  // the hero raises the weapon upright and holds it there till the cast ends (the 'animight' epic pose, held)
  const Anim = NC.Anim;
  // (the template raises it by 0.17 s and lowers it again after 0.83 s: cut at 0.5 s, so a long cast holds it raised)
  if (!Anim.CLIPS.castHold && Anim.CLIPS['animight:41_epic']) Anim.CLIPS.castHold = Object.assign({}, Anim.CLIPS['animight:41_epic'], { hold: true, fidget: false, dur: 0.5 });
  const inner = NC.castSkill;
  NC.castSkill = function (game, p, key) {
    if (!game || p !== game.player || p.castNow) return inner.apply(this, arguments);
    // (Discord #175: a cast whose channel something else took never ends: it is dropped, so the skills work again)
    if (p.casting && !(p.channel && p.channel.cast)) cancel(game, p);
    if (p.casting) return false;
    // working a tree / a vein / a pond (its channel still on): walk off first, the server refuses skills while gathering;
    // a work whose channel something else took is let go of, never left blocking the skills
    if (p.channel && (p.channel.life || p.channel.fish)) return false;
    if (p.lifeAct && NC.Life && NC.Life.stopWork) NC.Life.stopWork(game, p);
    if (p.fishAct && NC.Life && NC.Life.stopFishing) NC.Life.stopFishing(game, p);
    const id = NC.skillForKey(p, key);
    if (!id) return inner.apply(this, arguments);
    const S = SK[id], lv = NC.skillLv(p, id), T = NC.castTime(p, id, lv);
    if (NC.castBase(id, lv) > 0 && NC.skillCd(p, id) <= 0 && (p.castInstant || p.castNextK)) { p.castInstant = false; p.castNextK = 0; } // (spent)
    if (T < 0.05 || S.boss) return inner.apply(this, arguments);
    // (what castSkill turns down anyway: let it say why)
    if (NC.skillCd(p, id) > 0) return false;
    if (S.need && S.need(game, p, lv) !== true) return inner.apply(this, arguments);
    if (p.sp < NC.skillCost(p, id, lv)) return inner.apply(this, arguments);
    start(game, p, id, key, lv, T);
    return true;
  };
  function start(game, p, id, key, lv, T) {
    const S = SK[id];
    p.atk.on = false;
    p.casting = { id, key, lv, t: 0, T, pushed: 0, mv: [game.input.mx || 0, game.input.my || 0], name: S.name, rgb: colourOf(p, S), style: styleOf(S), big: !!S.ult };
    p.channel = { cast: true, t: 0, dur: Infinity, update: tick, end: null };
    p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
    p.combat = 1; p.lastFight = game.time;
    if (Anim.CLIPS.castHold) Anim.play(p.anim, 'castHold');
    looks(game, p);
    if (NC.Net && NC.Net.send) NC.Net.send();
  }
  function tick(game, p, ch, dt) {
    const c = p.casting;
    if (!c) { p.channel = null; return; }
    p.vx *= 0.8; p.vy *= 0.8;
    // stepping off in a new direction: the cast is dropped
    const mx = game.input.mx || 0, my = game.input.my || 0;
    if ((mx || my) && (mx !== c.mv[0] || my !== c.mv[1])) return cancel(game, p, true);
    c.mv = [mx, my];
    if (p.dead > 0 || !NC.skillUsable(p, c.id) || NC.skillForKey(p, c.key) !== c.id) return cancel(game, p);
    p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
    c.t += dt;
    if (c.t >= c.T) finish(game, p);
  }
  function finish(game, p) {
    const c = p.casting;
    p.casting = null; p.channel = null;
    if (p.anim.act === 'castHold') Anim.stop(p.anim);
    p.castNow = true;
    try { NC.castSkill(game, p, c.key); } finally { p.castNow = false; }
    if (NC.Net && NC.Net.send) NC.Net.send();
  }
  function cancel(game, p, shown) {
    p.casting = null;
    if (p.channel && p.channel.cast) p.channel = null;
    if (p.anim.act === 'castHold') Anim.stop(p.anim);
    if (shown) FX.num(p.x, p.y - 190, 'ยกเลิกร่าย', { fill: '#cfd8ff', size: 26 });
    if (NC.Net && NC.Net.send) NC.Net.send();
  }
  NC.cancelCast = (game, p) => { if (p && p.casting) cancel(game, p); };
  // a hit pushes the bar back
  const baseHurt = NC.hurtPlayer;
  NC.hurtPlayer = function (game, dmg, fromX) {
    const p = game.player, hp0 = p && p.hp;
    const r = baseHurt.apply(this, arguments);
    const c = p && p.casting;
    if (c && p.hp < hp0 && c.pushed < 2) { c.t = Math.max(0, c.t - 0.2); c.pushed++; FX.num(p.x + 40, p.y - 175, '-0.2', { fill: '#ffb0a0', size: 22 }); }
    return r;
  };
  // (a map change drops a cast)
  if (NC.Maps && NC.Maps.go) { const baseGo = NC.Maps.go; NC.Maps.go = function (game) { if (game && game.player) NC.cancelCast(game, game.player); return baseGo.apply(this, arguments); }; }

  // ---------------- the looks: the circle under the feet, the ring where it lands, the bar over the head ----------------
  // (they follow whoever casts: the hero, or another player whose cast came over the net; they end with the cast)
  function looks(game, who) {
    const c = who.casting;
    if (!c || c.fx) return;
    c.fx = true;
    const alive = () => who.casting === c;
    const R = c.big ? 150 : 108;
    FX.add({ type: 'custom', layer: 'low', life: 99, x: who.x, y: who.y,
      update(o) { if (!alive()) o.dead = true; },
      draw(ctx, o) {
        const u = Math.min(1, c.t / Math.max(0.05, c.T)), a = Math.min(1, o.t / 0.15);
        V.magicCircle(ctx, who.x, who.y, R * (0.75 + 0.25 * Math.min(1, o.t / 0.2)), o.t * (c.big ? 1.6 : 1.1), c.rgb, 0.55 * a + 0.4 * u, c.style);
        if (c.big) V.magicCircle(ctx, who.x, who.y, R * 1.45, -o.t * 0.7, c.rgb, 0.35 * a, 'star');
        // where an area spell will land
        const A = AREA[c.id];
        if (A) {
          let x = who.x, y = who.y;
          if (A[0] !== 'self') {
            const H = NC.skillHelpers, g = who === game.player ? game : { mouse: who.mouse || { active: false } };
            if (H && H.ground) [x, y] = H.ground(g, who, A[0]);
          }
          const r = A[1] * (NC.skillScale ? NC.skillScale(who.kind === 'player' ? who : null, c.id) : 1);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha *= 0.35 + 0.35 * u;
          ctx.beginPath(); ctx.ellipse(x, y, r, r * V.SQ, 0, 0, TAU);
          ctx.setLineDash([16, 12]); ctx.lineDashOffset = -o.t * 40;
          ctx.lineWidth = 4; ctx.strokeStyle = `rgba(${c.rgb},0.95)`; ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = `rgba(${c.rgb},${0.08 + 0.12 * u})`; ctx.fill();
          ctx.beginPath(); ctx.ellipse(x, y, r * u, r * u * V.SQ, 0, 0, TAU);
          ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,255,255,${0.5 * u})`; ctx.stroke();
          ctx.restore();
        }
      } });
    FX.add({ type: 'custom', layer: 'glow', life: 99, x: who.x, y: who.y,
      update(o) { if (!alive()) o.dead = true; },
      draw(ctx, o) {
        const u = Math.min(1, c.t / Math.max(0.05, c.T));
        const top = (NC.labelTop ? NC.labelTop(who) : who.y - 172) - 10, w = 96, h = 11, x = who.x - w / 2;
        ctx.save();
        ctx.globalAlpha *= Math.min(1, o.t / 0.1);
        ctx.font = "700 17px 'Baloo 2', 'Noto Sans Thai', 'Segoe UI', sans-serif";
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = NC.OUTLINE;
        ctx.strokeText(c.name, who.x, top - 6); ctx.fillStyle = '#ffffff'; ctx.fillText(c.name, who.x, top - 6);
        const rr = (X, Y, W, H, r) => { ctx.beginPath(); ctx.moveTo(X + r, Y); ctx.arcTo(X + W, Y, X + W, Y + H, r); ctx.arcTo(X + W, Y + H, X, Y + H, r); ctx.arcTo(X, Y + H, X, Y, r); ctx.arcTo(X, Y, X + W, Y, r); ctx.closePath(); };
        rr(x - 2, top - 2, w + 4, h + 4, 7); ctx.fillStyle = NC.OUTLINE; ctx.fill();
        rr(x, top, w, h, 5); ctx.fillStyle = '#1c2a1f'; ctx.fill();
        if (u > 0.02) { rr(x, top, w * u, h, 5); const g = ctx.createLinearGradient(0, top, 0, top + h); g.addColorStop(0, '#9ef29a'); g.addColorStop(1, '#2fb357'); ctx.fillStyle = g; ctx.fill(); }
        ctx.restore();
      } });
    // a few motes of the element rising while the bar fills
    FX.add({ type: 'custom', layer: 'glow', life: 99, x: who.x, y: who.y, draw() {},
      update(o, dt) {
        if (!alive()) { o.dead = true; return; }
        if (Math.random() < dt * (c.big ? 30 : 16)) {
          const a = NC.rand(0, TAU), rr = NC.rand(0.5, 1) * R;
          V.motes(who.x + Math.cos(a) * rr, who.y + Math.sin(a) * rr * V.SQ, 1, c.rgb, { rise: 120, spread: 4, size: 0.8 });
        }
      } });
  }

  // ---------------- the other players see my cast ----------------
  const net = NC.Net;
  if (net && net.fields && net.hooks) {
    net.fields.push({ key: 'ct', get: () => { const g = NC.game, c = g && g.player && g.player.casting; return c ? [c.id, +c.T.toFixed(2), +c.t.toFixed(2)] : null; } });
    net.hooks.push((r, pr) => {
      const ct = pr.ct, g = NC.game;
      if (!Array.isArray(ct) || typeof ct[0] !== 'string' || !SK[ct[0]]) { r.casting = null; return; }
      const S = SK[ct[0]], T = Math.max(0.05, Math.min(10, +ct[1] || 1)), t = Math.max(0, Math.min(T, +ct[2] || 0));
      if (r.casting && r.casting.id === ct[0]) return; // (the same cast: it runs on by itself)
      r.casting = { id: ct[0], t, T, name: S.name, rgb: colourOf(r, S), style: styleOf(S), big: !!S.ult, remote: true };
      if (g) looks(g, r);
    });
    // their bars fill with my clock, and stop at full
    const baseTick = NC.skillTicks;
    if (Array.isArray(baseTick)) baseTick.push((game, p, dt) => { for (const r of net.remotes.values()) if (r.casting) r.casting.t = Math.min(r.casting.T, r.casting.t + dt); });
  }
})();
