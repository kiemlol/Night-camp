/* shieldloot.js — the shields drop (Discord #96, 2026-10-20: "เกมมันไม่มีดรอปโล่หรอครับ"): no drop table had a shield, the
   buckler came only with a job change and the kite shield from nowhere. Each now falls from the monsters that carry one,
   at the catalog's rates (js/loot.js: common .25% · rare .12% · epic .06% · legend .03%; a zone form x2 like
   js/arealoot.js), the level gate as every row's (the monster's Lv ≥ the shield's Lv − 5, or its species' top level); the
   bosses' rows get their rate from js/bossrate.js (loaded after this). The class-3 tower shield stays the dawnwarden's
   own (js/class3.js) and the bell shield stays closed (js/obtjobs.js).
     buckler        the soldiers and crabs: rusty_squire Lv 22, crab 24, shield_crab 34, skeleton (the graveyard's soldiers)
     kiteshield     the knights and guards: myco_knight 46, toll_guard 48, tomb_knight 51, bone_knight 52, obsidian_knight 84,
                    cabinet_guard 87; the bosses ลอร์ดฮัลวาร์ด 46, กาเรธ (the fallen paladin) 68, กัปตันอัลดริก 80
   The line by level (2026-10-20: a shield-carrier had nothing to upgrade to from Lv 50 to 99; items in js/jobs3.js):
     sh_mossshell   Lv 20 common   the marsh's turtle (Lv 14–24)
     sh_glowwing    Lv 30 common   the falls' firefly beetle (27–34), the fallen cap's beetle (38–45)
     sh_owlstone    Lv 55 rare     the observatory's stone owl (50–58); boss มาจิสเตอร์วอสส์ 58
     sh_geode       Lv 65 rare     the crystal golem (64–72), the red golem (57–77)
     sh_hollowcrest Lv 75 epic     the outer city's hollow guard (70–82), the moat turtle (72–82); boss กัปตันอัลดริก 80
     sh_mistclam    Lv 85 epic     the reef's coral golem (86–92), the ship graveyard's anchor brute (86–92)
     sh_midnight    Lv 95 legend   the clock square's hour knight (94–99), the cathedral's temple soldier (92–99);
                    boss คาร์ดินัลเซเวริน 99
   Added after js/book.js, like rebalance.js's glasses: the book's completion stays as it was. The online server reads
   these rows from tools/online/world_delta.json (tools/online/world_export.mjs). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, D = NC.LOOT_DATA;
  if (!D || !D.species || !NC.SPECIES) return;
  const PCT = { common: 0.25, rare: 0.12, epic: 0.06, legend: 0.03 };
  const SPECIES = {
    buckler: ['rusty_squire', 'crab', 'shield_crab', 'skeleton'],
    kiteshield: ['myco_knight', 'toll_guard', 'tomb_knight', 'bone_knight', 'obsidian_knight', 'cabinet_guard'],
    sh_mossshell: ['turtle'],
    sh_glowwing: ['firefly_knight', 'cap_beetle'],
    sh_owlstone: ['stone_owl'],
    sh_geode: ['crystal_golem', 'golem'],
    sh_hollowcrest: ['hollow_guard', 'moat_turtle'],
    sh_mistclam: ['coral_golem', 'anchor_brute'],
    sh_midnight: ['hour_knight', 'temple_soldier'],
  };
  const BOSSES = { kiteshield: ['sb_halvard', 'sb_gareth', 'sb_aldric'], sh_owlstone: ['sb_vosse'], sh_hollowcrest: ['sb_aldric'], sh_midnight: ['sb_severin'] };
  const add = (T, id, p) => { if (!T.some((r) => r[0] === id)) T.push([id, p]); };
  for (const id in SPECIES) {
    const it = ITEMS[id];
    if (!it || it.slot !== 'shield') continue;
    const p = PCT[it.rarity] || PCT.rare;
    for (const sp of SPECIES[id]) {
      if (!NC.SPECIES[sp]) continue;
      add((D.species[sp] = D.species[sp] || []), id, p);
      for (const [eid, E] of Object.entries(NC.SPECIES)) if (E.eliteOf === sp) add((D.species[eid] = D.species[eid] || []), id, p * 2);
    }
  }
  if (D.bosses) for (const id in BOSSES) if (ITEMS[id]) for (const b of BOSSES[id]) add((D.bosses[b] = D.bosses[b] || []), id, 1);
})();
