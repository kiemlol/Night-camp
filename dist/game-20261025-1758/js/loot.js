/* loot.js — every monster drops its own things (the Loot Book, 2026-09-30; the user: "ของดรอปในมอนต่างๆต้องต่างกันนะ",
   "แฟชั่นทั้งหมดจะไม่ดรอปจากมอน", no drop pity: "อยากให้คนบอทนาน ๆ").
     tables     js/loot_data.js: each species' own rows [item, % per kill] (weapons 0.25 / 0.12 / 0.06 / 0.03% by kind,
                outfit pieces 0.15%, their accessory 0.05%, hats 0.08%), the bosses' (3–12% a row), the world legends
     the gate   a monster drops a row only when its level reaches the item's Lv − 5 (or its species' top level): the same
                bat drops its grade-1 things in the camp and its grade-4 things by the misty lake
     legends    any monster Lv 90+: 0.002% for one of the 29 legends
     moonlit ✦  1 in 200 drops is a moonlit copy (js/gearbag.js `sh`)
     chests     a dungeon chest's gear rolls come from its map's monsters' tables
     the gap    (the owner, 2026-10-07, the endgame balance audit; the web's own since 2026-10-18: js/endgame_audit.js
                NC.dropGap) every roll above x the multiplier EXP gets by the level gap between the hero and the
                monster (js/levelgap.js), bosses too; not the chests
     Lv 99 bosses (the same audit) the Hundred-String, the dragon mother and the star's grave's three forms had no
                gear: they drop the Lv 95 G4 sets (the legend pieces the bell tower's, the cathedral's and the roots'
                monsters drop at 0.05–0.15%), their dungeon's G4 weapons and the world legends now, about one legend a
                4 kills (Aurelion, an hour apart: ~2 in 3 kills). The lava dragon's 32 rows were 3% each: one legend a
                kill, ~6 an hour in one channel for a strong ranger; its table x0.2 now (D.bossK, js/endgame_audit.js),
                one in ~5 kills. The Lv 99 maps' own monsters drop their rows x1.35 (the bell tower) and x1.2 (the
                star's grave). The star ore (lf_starore) drops in js/endgame_audit.js
     the news   an epic / boss / legend / moonlit drop goes to the chat (and to the others online through net.js)
   The old random pool (items.js NC.dropLoot) keeps only its potions: nothing fashion ever drops. Only the hero's own
   kills drop (e._heroT: js/wabil.js), like the materials.
   Hooks: NC.dropLoot (potions only), NC.skillKills (the rolls), NC.Net fields/hooks (the news); the rolls ask
   NC.dropGap (js/endgame_audit.js). Online: backend/gear_loot.go, star_ore.go, junk_level.go.
   NC.Loot.table('bat', 80) lists what a Lv 80 bat can drop. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, D = NC.LOOT_DATA || { species: {}, bosses: {}, world: [], top: {} };
  const roll = (pct, k) => Math.random() * 100 < pct * (k == null ? 1 : k); // (k: the level gap, js/endgame_audit.js)
  const fmtNews = [];

  // ---------------- the old pool: potions only ----------------
  // (js/potions.js, 2026-10-04: red 3% / blue 1.5% a kill, sized by the monster's level; it was 14% / 8%, more than a
  // hero drank, so potions were never bought.)
  const baseDrop = NC.dropLoot;
  NC.dropLoot = function (game, x, y, e) {
    const pot = Math.random(), old = !NC.POT, red = old ? 0.14 : 0.03, all = old ? 0.22 : 0.045;
    if (pot < all) game.loot.push({ kind: 'loot', potion: pot < red ? 'red' : 'blue', size: NC.POT ? NC.POT.sizeFor(e && e.lv) : 's',
      x: x + NC.rand(-30, 30), y: y + NC.rand(-10, 10), sort: y, t: 0, z: 0, vz: 480 });
  };
  NC.dropLootOld = baseDrop;

  // ---------------- what a monster can drop at its level ----------------
  const ready = (id) => ITEMS[id] && NC.itemReady(id);
  function table(type, lv) {
    const rows = D.species[type] || [];
    const top = D.top[type] || 99;
    return rows.filter(([id]) => ready(id) && (lv || 1) >= Math.min((ITEMS[id].lvReq || 1) - 5, top));
  }
  const bossRows = (type) => (D.bosses[type] || []).filter(([id]) => ready(id));

  // ---------------- the Lv 99 bosses' tables (the same audit) ----------------
  // [item, % a kill]: the Lv 95 G4 sets (tops and trousers 4%, accessories 2%; Aurelion 5% / 3%), a hat, their
  // dungeon's G4 weapons (5–6%) and the world legends (0.1% each, 3% for one of 30; Aurelion 0.3%: 9%). Legends a kill:
  // ~26% (one in ~4) for the Hundred-String and the dragon mother (15 min apart), ~65% for Aurelion (an hour apart)
  const set = (line, top, acc) => [['top_of_' + line, top], ['pants_of_' + line, top], ['acc_of_' + line, acc]];
  const each = (ids, pct) => ids.map((id) => [id, pct]);
  const legends = (pct) => each(D.world, pct);
  Object.assign(D.bosses, {
    hundred_string: [...set('mg_prism', 4, 2), ...set('rg_windwalk', 4, 2), ['hat_hc_cool_shinobi', 3],
      ...each(['hu_galaxy', 'sc_nightbloom', 'lt_moonmoth', 'wp_tornado', 'sc_tempest', 'ga_kraken', 'ln_storm'], 5), ...legends(0.1)],
    dragon_mother: [...set('hv_guardian', 4, 2), ...set('lt_gold', 4, 2), ['hat_hc_boss_hydra', 3],
      ...each(['dg_whirlpool', 'hm_wave', 'kn_thunder', 'tc_frost', 'sw_frostfang', 'st_aurora', 'wp_jellyfish'], 5), ...legends(0.1)],
    // the star's grave: the first two forms a hat and the grave's weapons, Aurelion the four sets
    sb_aurel: [['hat_hc_cool_winghelm', 3], ...each(['ln_foxfire', 'wp_veil', 'mc_ghostorb', 'bk_fullmoon'], 6), ...legends(0.05)],
    sb_aurel2: [['hat_hc_boss_demonlord', 3], ...each(['qs_spiritglass', 'ps_spirit', 'qs_moonbow', 'kn_constellation', 'tc_comet'], 6), ...legends(0.05)],
    aurelion: [...set('hv_guardian', 5, 3), ...set('lt_gold', 5, 3), ...set('mg_prism', 5, 3), ...set('rg_windwalk', 5, 3),
      ['hat_hc_boss_voidking', 5], ...each(['ax_sunstone', 'hm_sun', 'ps_tide'], 6), ...legends(0.3)],
  });
  // the Lv 99 maps' monsters drop their own rows more often: x1.35 the bell tower's, x1.2 the star's grave's (their HP,
  // EXP and junk: monsters5.js)
  const MORE = { bell_puppet: 1.35, hollow_bellringer: 1.35, bomb_bell: 1.35, bell_lead: 1.35, bell_silver: 1.35,
    first_lamplighter: 1.2, star_crystal: 1.2, glass_warden: 1.2, tiny_meteor: 1.2, lamplighter_gold: 1.2 };
  for (const t in MORE) if (D.species[t]) D.species[t] = D.species[t].map(([id, pct]) => [id, Math.round(pct * MORE[t] * 10000) / 10000]);

  function give(game, e, id, how) {
    const p = game.player, sh = Math.random() * 100 < (D.shiny || 0.5);
    let c = null;
    if (NC.GEAR && NC.GEAR.isInst(id)) c = NC.GEAR.dropAt(game, e.x, e.y, id, { sh });
    else {
      game.loot.push({ kind: 'loot', id, x: e.x + NC.rand(-40, 40), y: e.y, sort: e.y, t: 0, z: 0, vz: 520 });
      NC.FX.stars(e.x, e.y - 40, 8, (NC.RARITY[ITEMS[id].rarity] || NC.RARITY.common).rgb, { speed: 220 });
    }
    const it = ITEMS[id], k = NC.gearKind ? NC.gearKind(it) : 'A', big = /[CDL]/.test(k) || it.rarity === 'legend' || (c && c.sh);
    if (big) news(game, `${p.name || 'นักเดินทาง'} ได้ ${c && c.sh ? '✦ ' : ''}${it.name} จาก${e.name || 'มอน'}!`);
    for (const f of HEARD) f(game, e, id, c, how);
  }
  const HEARD = (NC.lootHeard = []); // (game, e, id, copy, how) every drop (the report, the book)

  NC.skillKills.push((game, e) => {
    const t = e.type, p = game.player;
    if (!t || !p || e._heroT == null || game.time - e._heroT > 3 || e.lootless) return; // (only the hero's own kills; not monkinds.js's split pieces / helpers)
    if (/^chest_/.test(t)) return chest(game, e);
    const B = bossRows(t);
    const gap = (NC.dropGap ? NC.dropGap(p.lv, e.lv) : 1) * (NC.dropChanceK ? NC.dropChanceK(game, e) : 1); // (every roll x the level gap; a boss's table x its bossK: js/endgame_audit.js; a party's threads: js/partybonds.js)
    if (B.length) { const k = gap * ((D.bossK && D.bossK[t]) || 1); for (const [id, pct] of B) if (roll(pct, k)) give(game, e, id, 'boss'); return; }
    for (const [id, pct] of table(t, e.lv)) if (roll(pct, gap)) give(game, e, id, 'drop');
    if ((e.lv || 0) >= 90 && D.world.length && roll(0.002 * D.world.length, gap)) {
      const id = D.world[Math.floor(Math.random() * D.world.length)];
      if (ready(id)) give(game, e, id, 'legend');
    }
  });
  // a chest: a few rolls from what its map's monsters carry (dungeons.js: C.gear)
  const CHEST_ROLLS = { chest_wood: 1, chest_iron: 2, chest_gold: 4 };
  function chest(game, e) {
    const kinds = new Set(game.enemies.map((x) => x.type).filter((x) => D.species[x]));
    const pool = [...kinds].flatMap((k) => table(k, e.lv || 99));
    if (!pool.length) return;
    const sum = pool.reduce((s, r) => s + r[1], 0);
    for (let i = 0; i < (CHEST_ROLLS[e.type] || 1); i++) {
      let r = Math.random() * sum;
      for (const [id, pct] of pool) { r -= pct; if (r <= 0) { give(game, e, id, 'chest'); break; } }
    }
  }

  // ---------------- the news: the chat, and the others online ----------------
  let newsN = 0, newsText = '';
  function news(game, text) {
    newsN++; newsText = text;
    if (NC.Chat) NC.Chat.add({ ch: 'sys', kind: 'level', text: '✦ ' + text });
    else NC.HUD.log(text, 'level');
  }
  if (NC.Net) {
    NC.Net.fields.push({ key: 'ln', get: () => (newsN ? [newsN, newsText] : null) });
    const seen = new Map();
    NC.Net.hooks.push((r, pr, first) => {
      const v = pr && pr.ln;
      if (!Array.isArray(v)) return;
      if (first || !seen.has(r.peer)) { seen.set(r.peer, v[0]); return; }
      if (v[0] !== seen.get(r.peer)) { seen.set(r.peer, v[0]); if (NC.Chat) NC.Chat.add({ ch: 'sys', kind: 'level', text: '✦ ' + NC.Net.clean(String(v[1]), 90) }); }
    });
  }

  NC.Loot = { table: (type, lv) => table(type, lv).map(([id, pct]) => `${ITEMS[id].name} ${pct}%`), bossRows, news, D };
})();
