/* lootfeel.js — drops are taken with some weight (the user, 2026-10-05: "ระบบเก็บของ ตอนนี้เราเดินไปชนของแล้วของก็เข้าตัว
   ผมอยากให้มันดูหน่วงเรื่องนี้หน่อย แต่ไม่ต้องกดเก็บ"): still automatic, never a key, but no longer a snap.
     settle   a drop lies still a moment after it lands (1 s after it fell) before it can be taken
     reach    the hero has to come within 110 (the old pull started at 140–150). A drop he came that near to is his
              from then on (claimed): it still settles first, then comes to him wherever he went (the auto farm and the
              player need not stand and wait for it: a 1 s wait on every kill cost the bot 12–19% of its kills)
     queue    a pile goes one by one: each drop in reach waits its turn, 0.1 s after the one before (a rare one 0.2 s;
              a big pile 0.06 s). Once its turn is given it is the hero's even if he walks on: it follows him
     flight   a hop up (0.16 s; a rare one 0.3 s, higher, with a glint), then a curve to the hero's chest that speeds up
              (0.3 s) and shrinks as it arrives; the kind's own code then takes it (its stars, log and save as before)
   Every kind of drop goes through this (potions and the old items: items.js, materials: materials.js, gear copies:
   gearbag.js): an outer NC.updateLoot keeps a drop's age (l.t) under the 0.7 s those pickers wait for until it reaches
   the hero, then hands it over standing on him. A drop the party routes to someone else (partynet.js l._to) is left alone.
   Hooks: NC.updateLoot, NC.drawLoot (higher and smaller while it flies; gear without its beam), NC.Maps.go (what is
   claimed or in the air when the hero leaves the map is his), NC.MENU_SETTINGS; js/autofarm.js skips the drops that
   NC.LootFeel.coming(l) says come by themselves. Load after gearbag.js (the last file that wraps
   NC.updateLoot when it loads; the map files and partynet.js wrap it later, from outside, and pass through).
   ESC → ตั้งค่า "การเก็บของ": หน่วง (the default) / เร็ว (the old snap). ?fastloot = เร็ว for this load. Saved: nightcamp.lootfeel.v1 */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, TAU = Math.PI * 2;
  const KEY = 'nightcamp.lootfeel.v1';
  let mode = 'slow';
  try { mode = localStorage.getItem(KEY) === 'fast' ? 'fast' : 'slow'; } catch (e) { /* storage blocked */ }
  const SETTLE = 1.0, REACH = 110, FAR = 1400, GAP = 0.1, LIFT = 0.16, FLY = 0.3;
  let claimR = REACH; // (how near the hero claims a drop: a helper may reach further, NC.LootFeel.claimR)
  const isDrop = (l) => l.kind === 'loot' && !!(l.potion || l.id || l.mat || l.inst);
  const MAT = () => NC.MATERIALS || {};
  const isRare = (l) => { if (l.potion) return false; if (!l.mat) return true; const M = MAT()[l.mat]; return !!(M && (M.rare || M.price >= 1000)); };
  const isGear = (l) => !l.potion && !l.mat && !!l.id;
  const cOff = (l) => (l.potion ? 40 : l.mat ? 34 : 66); // (how far above its foot each kind's picture is centred)
  const tint = (l) => {
    if (l.potion) return l.potion === 'red' ? '255,130,150' : '130,185,255';
    if (isGear(l)) { const it = NC.ITEMS[l.id], R = l.inst && NC.Grade ? NC.RARITY['g' + NC.Grade.of(l.inst)] : it && NC.RARITY[it.rarity]; return R ? R.rgb : '255,236,170'; } // (a copy: its colour grade, js/gradetier.js)
    return isRare(l) ? '255,220,120' : '255,236,170';
  };
  const inAir = (f) => f.ph === 'wait' || f.ph === 'lift' || f.ph === 'fly';
  const easeOut = (u) => 1 - (1 - u) * (1 - u);
  let nextAt = 0; // (the queue: the game time the next drop may start)

  // the little trail behind a flying drop (after the night lighting, so it shows in the dark)
  FX.def('lootmote', (ctx, p, u) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${p.color},${0.75 * (1 - u)})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - u * 0.6), 0, TAU); ctx.fill();
    ctx.restore();
  }, 'glow');

  const baseUpdate = NC.updateLoot;
  NC.updateLoot = function (game, dt) {
    if (mode !== 'slow' || !game.player) return baseUpdate.apply(this, arguments);
    dt = dt || 1 / 60;
    const p = game.player, now = game.time, alive = !(p.dead > 0);
    // a full gear bag (gearbag.js, the owner, 2026-10-08): gear stays where it lies instead of flying in and falling back
    const gearFull = !!(NC.GEAR && NC.GEAR.room && !NC.GEAR.room(p));
    let queued = 0;
    for (const l of game.loot) if (l._lf && inAir(l._lf)) queued++;
    if (nextAt > now + 5) nextAt = now; // (the clock went back)
    for (const l of game.loot) {
      if (!isDrop(l)) continue;
      if (l._to) { if (l._lf) { l._lf.h = 0; l._lf.s = 1; l._lf.ph = 'party'; } continue; } // (someone else's: partynet flies it)
      const f = l._lf || (l._lf = { age: 0, ph: 'drop', h: 0, s: 1 });
      f.age += dt;
      if (f.ph === 'go') { f.ph = 'rest'; f.h = 0; f.s = 1; } // (not taken last frame: back on the ground)
      if (f.ph === 'drop' || f.ph === 'rest') {
        const d = NC.dist(l.x, l.y, p.x, p.y);
        if (alive && d <= claimR) f.claim = 1;
        else if (f.claim && d > FAR) f.claim = 0; // (he went far away: it waits where it lies)
      }
      if (f.ph === 'drop') {
        if (f.age >= SETTLE && !(l.z > 0) && !l.vz) f.ph = 'rest';
      } else if (f.ph === 'rest') {
        if (alive && f.claim && !(gearFull && l.inst)) {
          const rare = isRare(l), gap = rare ? GAP * 2 : queued > 8 ? 0.06 : GAP;
          f.start = Math.max(now, nextAt); nextAt = f.start + gap; f.rare = rare; f.ph = 'wait'; f.glint = 0; queued++;
        }
      } else if (f.ph === 'wait') {
        if (now >= f.start) {
          f.ph = 'lift'; f.t0 = now;
          if (isGear(l)) FX.ring(l.x, l.y, 16, 74, tint(l), 0.4, 6); // (its beam goes out as it lifts)
        }
      } else if (f.ph === 'lift') {
        const dur = f.rare ? LIFT * 1.9 : LIFT, u = Math.min(1, (now - f.t0) / dur);
        f.h = easeOut(u) * (f.rare ? 44 : 26);
        f.s = 1 + 0.14 * Math.sin(u * Math.PI);
        if (f.rare && u > 0.5 && !f.glint) { f.glint = 1; FX.stars(l.x, l.y - cOff(l) - f.h, 6, tint(l), { speed: 120, size: 0.6 }); }
        if (u >= 1) {
          const d = NC.dist(l.x, l.y, p.x, p.y);
          f.ph = 'fly'; f.t1 = now; f.sx = l.x; f.sy = l.y; f.sh = f.h; f.trail = 0;
          f.dur = FLY + Math.min(0.35, d / 2200); f.arc = 70 + Math.min(120, d * 0.15); // (from further: longer, higher)
        }
      } else if (f.ph === 'fly') {
        const u = Math.min(1, (now - f.t1) / (f.dur || FLY)), e = u * u; // (it speeds up as it goes)
        // a curve up and over to the hero's chest (it follows him if he walks on)
        const tx = p.x, ty = p.y, th = 70 - cOff(l), cx = (f.sx + tx) / 2, cy = (f.sy + ty) / 2, ch = Math.max(f.sh, th) + (f.arc || 70);
        const a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e;
        l.x = a * f.sx + b * cx + c * tx; l.y = a * f.sy + b * cy + c * ty; f.h = a * f.sh + b * ch + c * th;
        f.s = 1 - 0.42 * e;
        l.sort = e > 0.55 ? p.y + 2 : l.y; // (it comes round in front of the hero as it reaches him)
        if ((f.trail -= dt) <= 0) {
          f.trail = 0.04;
          FX.add({ type: 'lootmote', x: l.x + NC.rand(-5, 5), y: l.y - cOff(l) - f.h + NC.rand(-5, 5), vx: NC.rand(-14, 14), vy: NC.rand(-24, 6),
            life: 0.32, r: f.rare ? 4.5 : 3.2, color: tint(l) });
        }
        if (u >= 1) {
          f.h = 0; f.s = 1;
          if (alive) { f.ph = 'go'; l.x = p.x; l.y = p.y; } else f.ph = 'rest'; // (he fell meanwhile: it lands by him)
        }
      } else if (f.ph === 'party') f.ph = 'rest';
      // the pickers skip what is younger than 0.7 s: kept under it until the drop stands on the hero
      // (never set back to 0: partynet.js reads t === 0 as "dropped this frame")
      if (f.ph === 'go') l.t = Math.max(l.t, 1); else l.t = Math.min(l.t, 0.3);
      if (f.ph === 'lift' || f.ph === 'fly' || f.ph === 'go') { l.z = 0; l.vz = 0; }
    }
    return baseUpdate.apply(this, arguments);
  };

  // drawn higher and smaller while it hops and flies: the kinds' own pictures with the height added; gear in the air
  // is its icon alone (the beam and the ring belong on the ground)
  const baseDraw = NC.drawLoot;
  NC.drawLoot = function (ctx, game, l) {
    const f = l._lf;
    if (mode !== 'slow' || !f || (!f.h && f.s === 1)) return baseDraw.apply(this, arguments);
    const z = (l.z || 0) + f.h, oy = l.y - cOff(l) - z;
    ctx.save();
    if (f.s !== 1) { ctx.translate(l.x, oy); ctx.scale(f.s, f.s); ctx.translate(-l.x, -oy); }
    try {
      if (isGear(l) && (f.ph === 'lift' || f.ph === 'fly')) {
        const rgb = tint(l);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(l.x, oy, 4, l.x, oy, 56);
        g.addColorStop(0, `rgba(${rgb},0.5)`); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g; ctx.fillRect(l.x - 56, oy - 56, 112, 112);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(NC.itemIcon(l.id, 128), l.x - 34, oy - 34, 68, 68);
      } else {
        const z0 = l.z;
        l.z = z;
        try { baseDraw.apply(this, arguments); } finally { l.z = z0; }
      }
    } finally { ctx.restore(); }
  };

  // leaving the map: what is claimed or already on its way to the hero is his (the map's drops are cleared as it goes)
  if (NC.Maps && NC.Maps.go) {
    const baseGo = NC.Maps.go;
    NC.Maps.go = function (game) {
      if (mode === 'slow' && game && game.player && game.loot && !(game.player.dead > 0)) {
        let any = false;
        for (const l of game.loot) {
          const f = l._lf;
          if (!f || l._to || !(inAir(f) || f.claim)) continue;
          f.ph = 'go'; f.h = 0; f.s = 1; l.x = game.player.x; l.y = game.player.y; l.z = 0; l.vz = 0; l.t = 1; any = true;
        }
        if (any) finishNow(game);
      }
      return baseGo.apply(this, arguments);
    };
  }
  // the pickers take what stands on the hero (one pass of the chain; this file keeps the 'go' ones as they are)
  function finishNow(game) {
    const was = mode;
    mode = 'fast'; // (this pass: no phase changes here, the pickers see l.t = 1 at d = 0)
    try { NC.updateLoot(game, 1 / 60); } finally { mode = was; }
  }

  // ESC → ตั้งค่า
  (NC.MENU_SETTINGS = NC.MENU_SETTINGS || []).push({
    name: 'การเก็บของ',
    note: 'หน่วง = ของลอยเข้าตัวทีละชิ้น · เร็ว = แบบเดิม',
    opts: [['slow', 'หน่วง'], ['fast', 'เร็ว']],
    get: () => mode,
    set: (v) => { mode = v === 'fast' ? 'fast' : 'slow'; try { localStorage.setItem(KEY, mode); } catch (e) { /* blocked */ } },
  });
  NC.LootFeel = {
    get mode() { return mode; }, set mode(v) { mode = v === 'fast' ? 'fast' : 'slow'; },
    get claimR() { return claimR; }, set claimR(v) { claimR = Math.max(REACH, +v || REACH); },
    REACH, SETTLE, phase: (l) => (l._lf ? l._lf.ph : ''),
    // a drop that needs nobody to walk to it: claimed, already on its way, or the party's for someone else
    coming: (l) => mode === 'slow' && !!(l._to || (l._lf && (l._lf.claim || inAir(l._lf) || l._lf.ph === 'go'))),
  };
})();
