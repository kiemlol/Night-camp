/* daynight.js — the night is the game's rhythm (the Game Bible, pillar 1; the story: "กลางวันแค่ 3 ชั่วโมง").
     the clock   daytime (07:00–17:30 on the dial) runs 3.5x faster, dawn and dusk 1.5x: a whole day is ~30 minutes, the
                 day itself ~6 (game.js reads NC.clockRate)
     the night   monsters born at night are 20% tougher and hit 20% harder, but drop their material 20% more often
     ตะวันขึ้น    by day every monster may drop ประกายแดด (5%), the story's and the crafts' sunlight
     the bell    ระฆังพลบค่ำ rings when dusk begins (17:30): who sits by a campfire in the next 3 game hours gets ไออุ่น —
                 EXP +5%, +2% for each other hero sitting near (up to +20%), for 30 minutes
   Hooks: NC.clockRate, NC.makeEnemy (night monsters), NC.skillKills (the extra material, the sunlight), NC.gainXp
   (ไออุ่น), NC.updatePlayer (the sitting check), NC.HUD.init (the buff chip). Test: ?t=17:20 (just before the bell). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  const hourOf = (game) => ((((game.minutes || 0) / 60) % 24) + 24) % 24;
  const isDay = (h) => h >= 7 && h < 17.5;
  const nightK = (game) => { const h = hourOf(game); return h < 5 || h >= 19.5 ? 1 : h < 7 ? (7 - h) / 2 : h >= 17.5 ? (h - 17.5) / 2 : 0; };
  NC.clockRate = (game) => { const h = hourOf(game); return isDay(h) ? 3.5 : h < 5 || h >= 19.5 ? 1 : 1.5; };
  NC.isNightNow = (game) => nightK(game) >= 0.5;

  // ---------------- night monsters ----------------
  const baseMake = NC.makeEnemy;
  NC.makeEnemy = function (type, x, y, lv) {
    const e = baseMake.apply(this, arguments), g = NC.game;
    if (e && g && g.world && g.world.field && nightK(g) >= 0.5 && !e.boss && !/^chest_/.test(type || '')) {
      e.maxHp = Math.round(e.maxHp * 1.2); e.hp = e.maxHp;
      if (Array.isArray(e.atk)) e.atk = e.atk.map((v) => Math.round(v * 1.2));
      e.nightBorn = true;
    }
    return e;
  };
  // ---------------- the extra material at night, the sunlight by day ----------------
  if (NC.MATERIALS) NC.MATERIALS.mat_sunspark = { name: 'ประกายแดด', price: 30, desc: 'เศษแสงแดดอุ่น ๆ ที่มอนสะสมไว้ตอนกลางวัน ใช้ในเควสและงานช่าง หาได้เฉพาะตอนตะวันขึ้น' };
  // its icon (2026-10-06: it had none, so the bag showed an empty slot and its drop was invisible on the ground;
  // painted with assets/gen/mat_sunspark.prompt.txt, cut by tools/icons_cut.py --mat mat_sunspark)
  if (NC.ASSET_MANIFEST_SHOP) NC.ASSET_MANIFEST_SHOP.mat_sunspark = { src: 'assets/shop/mat_sunspark.png', w: 48, h: 48, ax: 0.5, ay: 0.5 };
  const drop = (game, e, id) => game.loot.push({ kind: 'loot', mat: id, x: e.x + NC.rand(-50, 50), y: e.y + NC.rand(-16, 16), sort: e.y, t: 0, z: 0, vz: NC.rand(400, 520), spin: NC.rand(0, 6) });
  NC.skillKills.push((game, e) => {
    if (e._heroT == null || game.time - e._heroT > 3 || !NC.MAT_DROPS || /^chest_/.test(e.type || '')) return;
    const h = hourOf(game);
    if (e.nightBorn || nightK(game) >= 0.5) { const d = (NC.MAT_DROPS[e.type] || [])[0]; if (d && NC.MATERIALS[d[0]] && Math.random() < d[1] * 0.2) drop(game, e, d[0]); }
    if (isDay(h) && Math.random() < 0.05) drop(game, e, 'mat_sunspark');
  });

  // ---------------- the dusk bell and ไออุ่น ----------------
  let lastDay = -1;
  const W = (NC.Warmth = { until: 0, pct: 0, bellDay: -1, open: false });
  const nearFire = (game) => { // (rest.js's own test: the camp's campfire, or a guild's: NC.guildFires)
    const p = game.player, fires = [game.world && game.world.campFire].concat(NC.guildFires ? NC.guildFires(game) : []).filter(Boolean);
    return fires.some((f) => Math.hypot(p.x - f.x, (p.y - f.y) * 1.3) < 430);
  };
  const baseUpd = NC.updatePlayer;
  NC.updatePlayer = function (game, dt) {
    const r = baseUpd.apply(this, arguments), p = game.player, h = hourOf(game), day = Math.floor((game.minutes || 0) / 1440);
    if (h >= 17.5 && h < 17.8 && W.bellDay !== day) {
      W.bellDay = day; W.open = true;
      NC.HUD.log('🔔 ระฆังพลบค่ำ! กลับไปนั่งรอบกองไฟ รับไออุ่น (EXP เพิ่ม 30 นาที)', 'level');
      if (game.toast) game.toast('ระฆังพลบค่ำ · นั่งรอบกองไฟรับไออุ่น');
    }
    if (W.open && (h >= 20.5 || h < 17.5)) W.open = false;
    if (W.open && p.sit && p.dead <= 0 && nearFire(game) && W.until < performance.now()) {
      const others = NC.Net && NC.Net.remotes ? [...NC.Net.remotes.values()].filter((o) => o.map === game.mapId && NC.dist(o.x || 0, o.y || 0, p.x, p.y) < 500).length : 0;
      W.pct = Math.min(20, 5 + 2 * others); W.until = performance.now() + 30 * 60e3;
      NC.HUD.log(`ได้ไออุ่นรอบกองไฟ: EXP +${W.pct}% 30 นาที${others ? ` (มีเพื่อนนั่งด้วย ${others} คน)` : ''}`, 'level');
      FX.stars(p.x, p.y - 80, 14, '255,190,110', { speed: 200 });
    }
    if (lastDay !== day) lastDay = day;
    return r;
  };
  (NC.xpFilters || (NC.xpFilters = [])).push((game, n, jn) => {
    if (W.until > performance.now() && n > 0) n = Math.round(n * (1 + W.pct / 100));
    return [n, jn];
  });
  NC.DayNight = { hourOf, isDay, nightK };
})();
