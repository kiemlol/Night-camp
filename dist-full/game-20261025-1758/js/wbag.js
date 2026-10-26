/* wbag.js — weapons as pieces of their own (the item plan, 2026-09-28): a weapon with `inst` (the greatswords of
   js/greatswords.js) is kept per copy in p.bag = [{ u, id, rows: [{ k, v, tier, sub }], ref }] and the hero holds one
   copy (p.wUid). The collection (p.owned) still lists the kind while at least one copy is in the bag, so the rest of the
   game (weapon sets, job rules) works as before.
     option rows (the user's rules): a drop or a craft starts with the grade's rows (1 / 2 / 2 / 3, bosses and the
     legend 3), each a random kind and a random tier ธรรมดา 60% · ดี 30% · เทพ 10%; ป๋าหมูหริ่ง (js/forge.js) adds a
     row for 1,000,000 coins + a หินเจาะออฟ (4 rows at the most, on every weapon) and puts a chosen kind into a row with a
     หินออฟ (its tier rolled again); two rows of one kind at the most
     drops: each sword's source (greatswords.js): its species 1.5 / 1.2 / 1.0 / 0.8% by grade, its boss 30%, the iron
     chest 8%, the meteor-storm sword 0.2% from any monster Lv 76+; the stones: หินออฟ 0.4% (bosses 1-3, chests 20%),
     หินเจาะออฟ 0.02% from Lv 50+ monsters (map bosses 15%, dungeon bosses 25%, gold chests 10%)
   Own save (nightcamp.wbag.v1). Wraps NC.saveGame / loadGear / equip / canWield / updateLoot, NC.skillKills (drops). The
   row effects are run by js/wabil.js (NC.WBAG.rowEffects). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, FX = NC.FX, GS = NC.GS;
  const KEY = 'nightcamp.wbag.v1';
  const fmt = (n) => NC.fmtCoins(n);
  for (const id of GS.list) ITEMS[id].inst = true; // (the greatswords are kept per copy)
  const rint = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ---------------- option rows ----------------
  const TIER = [{ th: 'ธรรมดา', color: '#e8e2d4', w: 60 }, { th: 'ดี', color: '#6fb6ff', w: 30 }, { th: 'เทพ', color: '#ffc94d', w: 10 }];
  const STATS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
  const ELS = ['water', 'earth', 'fire', 'wind', 'poison', 'shadow', 'ghost', 'undead'];
  const elTh = (el) => (NC.ELEMENT_INFO && NC.ELEMENT_INFO[el] ? NC.ELEMENT_INFO[el].th : el);
  const OPT = (NC.WOPTS = {
    atk: { th: 'พลังโจมตี', tiers: [[2, 3], [4, 5], [6, 7]], text: (r) => `ATK +${r.v}%` },
    crit: { th: 'คริติคอล', tiers: [[3, 4], [5, 6], [7, 8]], text: (r) => `คริติคอล +${r.v}%` },
    aspd: { th: 'ตีเร็ว', tiers: [[3, 4], [5, 6], [7, 8]], text: (r) => `ความเร็วโจมตี +${r.v}%` },
    leech: { th: 'ดูดเลือด', tiers: [[1, 1], [2, 2], [3, 3]], text: (r) => `ตีดูดเลือด ${r.v}%` },
    spKill: { th: 'ฆ่าได้ SP', tiers: [[2, 3], [4, 5], [6, 7]], text: (r) => `ฆ่าได้ SP +${r.v}` },
    stat: { th: 'สเตตัส', tiers: [[1, 2], [3, 3], [4, 5]], subs: STATS, subTh: (s) => s.toUpperCase(), text: (r) => `${r.sub.toUpperCase()} +${r.v}` },
    race: { th: 'แรงกับเผ่า', tiers: [[6, 8], [9, 12], [13, 15]], subs: Object.keys(NC.RACES), subTh: (s) => NC.RACES[s], text: (r) => `แรงกับเผ่า${NC.RACES[r.sub]} +${r.v}%` },
    el: { th: 'แรงกับธาตุ', tiers: [[6, 8], [9, 12], [13, 15]], subs: ELS, subTh: elTh, text: (r) => `แรงกับมอนธาตุ${elTh(r.sub)} +${r.v}%` },
  });
  const MAX_ROWS = 4, MAX_SAME = 2;
  const rollTier = () => { const r = Math.random() * 100; return r < 60 ? 0 : r < 90 ? 1 : 2; };
  function rollRow(rows, k, sub) {
    const used = (x) => rows.filter((r) => r.k === x).length;
    const kinds = Object.keys(OPT).filter((x) => used(x) < MAX_SAME);
    k = k && used(k) < MAX_SAME ? k : pick(kinds);
    const O = OPT[k], tier = rollTier(), [a, b] = O.tiers[tier];
    const row = { k, v: rint(a, b), tier };
    if (O.subs) row.sub = sub && O.subs.includes(sub) ? sub : pick(O.subs);
    return row;
  }
  NC.rowText = (r) => OPT[r.k].text(r);
  const baseRows = (id) => { const g = ITEMS[id].gs; return g.kind === 'D' || g.kind === 'L' ? 3 : GS.GRADES[g.grade].rows; };

  // ---------------- the bag ----------------
  const bag = (p) => p.bag || (p.bag = []);
  let uidN = 1;
  function make(id, o) {
    o = o || {};
    const rows = [];
    for (let i = 0; i < (o.rows === undefined ? baseRows(id) : o.rows); i++) rows.push(rollRow(rows));
    return { u: (Date.now() % 1e9) * 100 + (uidN++ % 100), id, rows, ref: 0 };
  }
  const isInst = (id) => !!(ITEMS[id] && ITEMS[id].inst);
  function worn(p) {
    const id = p.equip && p.equip.weapon;
    if (!isInst(id)) return null;
    const B = bag(p);
    const it = B.find((c) => c.u === p.wUid && c.id === id) || B.find((c) => c.id === id) || null;
    if (it) p.wUid = it.u;
    return it;
  }
  // a copy's rows as wabil.js specs (kept on the copy until its rows change)
  function rowEffects(p) {
    const c = worn(p);
    if (!c || !c.rows.length) return [];
    if (c._fx) return c._fx;
    return (c._fx = c.rows.map((r) => {
      if (r.k === 'atk' || r.k === 'crit') return { t: 'mods', [r.k]: r.v };
      if (r.k === 'aspd') return { t: 'aspd', v: r.v };
      if (r.k === 'stat') return { t: 'mods', [r.sub]: r.v };
      if (r.k === 'leech') return { t: 'leech', pct: r.v };
      if (r.k === 'spKill') return { t: 'killSp', sp: r.v };
      if (r.k === 'race') return { t: 'vsRace', race: r.sub, pct: r.v };
      return { t: 'vsEl', els: [r.sub], pct: r.v };
    }));
  }
  function add(game, c, quiet) {
    const p = game.player;
    bag(p).push(c);
    p.owned.add(c.id);
    if (!quiet) p.fresh.add(c.id);
    NC.saveGame(game);
    return c;
  }
  function remove(game, c) {
    const p = game.player, B = bag(p), i = B.indexOf(c);
    if (i < 0) return;
    B.splice(i, 1);
    if (!B.some((x) => x.id === c.id)) { p.owned.delete(c.id); p.fresh.delete(c.id); }
    if (p.wUid === c.u) p.wUid = null;
    NC.saveGame(game);
  }
  const changed = (game, c) => { delete c._fx; NC.applyGear(game); NC.saveGame(game); };
  const priceOf = (c) => { const g = ITEMS[c.id].gs; return Math.round(GS.GRADES[g.grade].sell * (g.kind === 'D' || g.kind === 'L' ? 3 : 1) * (1 + c.rows.length * 0.25)); };
  NC.WBAG = { TIER, OPT, MAX_ROWS, MAX_SAME, make, add, remove, worn, rowEffects, rollRow, changed, priceOf, copies: (p, id) => bag(p).filter((c) => !id || c.id === id), isInst };

  // hold a copy (the weapon of that kind is put on, this very copy)
  NC.WBAG.use = function (game, u) {
    const p = game.player, c = bag(p).find((x) => x.u === u);
    if (!c) return;
    p.wUid = c.u;
    if (p.equip.weapon !== c.id) NC.equip(game, c.id);
    else { NC.applyGear(game); NC.saveGame(game); }
  };
  // a minimum level (the only limit, like classic MMOs)
  const baseCanWield = NC.canWield;
  NC.canWield = function (p, id) {
    const it = ITEMS[id];
    if (it && it.lvReq && p.lv < it.lvReq) return false;
    return baseCanWield(p, id);
  };
  const baseEquip = NC.equip;
  NC.equip = function (game, id) {
    const p = game.player, it = ITEMS[id];
    if (it && it.lvReq && p.lv < it.lvReq && p.owned.has(id)) {
      game.toast(`${it.name} ต้อง Base Lv ${it.lvReq}`);
      NC.HUD.log(`${it.name}: ต้อง Base Lv ${it.lvReq} ขึ้นไปถึงจะถือได้`, 'warn');
      return;
    }
    const was = p.equip.weapon;
    baseEquip.apply(this, arguments);
    if (isInst(id) && p.equip.weapon === id && was !== id) { const c = worn(p); if (c) delete c._fx; NC.applyGear(game); }
  };

  // ---------------- saving ----------------
  const baseSave = NC.saveGame;
  NC.saveGame = function (game) {
    baseSave(game);
    if (game.noSave) return;
    const p = game.player;
    try { localStorage.setItem(KEY, JSON.stringify({ bag: bag(p).map((c) => ({ u: c.u, id: c.id, rows: c.rows, ref: c.ref || 0 })), wUid: p.wUid || null })); } catch (e) { /* storage blocked */ }
  };
  const baseLoad = NC.loadGear;
  NC.loadGear = function (game, prm) {
    baseLoad(game, prm);
    const p = game.player;
    p.bag = []; p.wUid = null;
    let s = null;
    if (!NC.ONLINE) try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (s && Array.isArray(s.bag))
      for (const c of s.bag) if (c && isInst(c.id) && Array.isArray(c.rows))
        p.bag.push({ u: c.u, id: c.id, ref: c.ref || 0, rows: c.rows.filter((r) => r && OPT[r.k]).slice(0, MAX_ROWS) });
    if (s) p.wUid = s.wUid || null;
    // the collection and the bag agree: a kind listed without a copy gets one (test switches, old saves), a copy's kind is listed
    for (const id of [...p.owned]) if (isInst(id) && !p.bag.some((c) => c.id === id)) p.bag.push(make(id));
    for (const c of p.bag) if (NC.itemReady(c.id)) p.owned.add(c.id);
    NC.applyGear(game);
  };

  // ---------------- drops ----------------
  const BOSSES = new Set(['bat_king', 'ant_queen', 'crypt_lord', 'lava_dragon', 'mushking']);
  const MOB_RATE = { 1: 1.5, 2: 1.2, 3: 1.0, 4: 0.8 };
  const bySpecies = {}, byBoss = {}, byChest = {}, rare = [];
  for (const id of GS.list) {
    const s = ITEMS[id].gs.src;
    if (s.mob) (bySpecies[s.mob] = bySpecies[s.mob] || []).push(id);
    if (s.boss) (byBoss[s.boss] = byBoss[s.boss] || []).push(id);
    if (s.chest) (byChest[s.chest] = byChest[s.chest] || []).push(id);
    if (s.rare) rare.push([id, s.rare]);
  }
  NC.WBAG.sources = { bySpecies, byBoss, byChest, rare };
  const chance = (pct) => Math.random() * 100 < pct;
  function dropSword(game, e, id) {
    if (!NC.itemReady(id)) return;
    const c = make(id);
    game.loot.push({ kind: 'loot', id, inst: c, x: e.x + NC.rand(-40, 40), y: e.y + NC.rand(-14, 14), sort: e.y, t: 0, z: e.z || 0, vz: 560 });
    const R = NC.RARITY[ITEMS[id].rarity];
    FX.stars(e.x, e.y - 60, 16, R.rgb, { speed: 300 }); FX.ring(e.x, e.y, 20, 190, R.rgb, 0.6, 9);
  }
  const dropMat = (game, e, id, n) => {
    if (!NC.MATERIALS[id]) return;
    for (let i = 0; i < n; i++)
      game.loot.push({ kind: 'loot', mat: id, x: e.x + NC.rand(-60, 60), y: e.y + NC.rand(-20, 20), sort: e.y, t: 0, z: e.z || 0, vz: NC.rand(400, 540), spin: NC.rand(0, 6) });
  };
  NC.skillKills.push((game, e) => {
    const t = e.type;
    if (!t) return;
    const chest = /^chest_/.test(t), boss = BOSSES.has(t) || (NC.BOSSES && NC.BOSSES[t]);
    for (const id of bySpecies[t] || []) if (chance(MOB_RATE[ITEMS[id].gs.grade])) dropSword(game, e, id);
    for (const id of byBoss[t] || []) if (chance(30)) dropSword(game, e, id);
    for (const id of byChest[t] || []) if (chance(8)) dropSword(game, e, id);
    if (!chest && !boss) for (const [id, lv] of rare) if ((e.lv || 0) >= lv && chance(0.2)) dropSword(game, e, id);
    // the stones
    if (boss) { dropMat(game, e, 'mat_opt_stone', rint(1, 3)); if (chance(BOSSES.has(t) ? 25 : 15)) dropMat(game, e, 'mat_drill_stone', 1); }
    else if (chest) { if (chance(20)) dropMat(game, e, 'mat_opt_stone', 1); if (t === 'chest_gold' && chance(10)) dropMat(game, e, 'mat_drill_stone', 1); }
    else {
      if (chance(0.4)) dropMat(game, e, 'mat_opt_stone', 1);
      if ((e.lv || 0) >= 50 && chance(0.02)) dropMat(game, e, 'mat_drill_stone', 1);
    }
  });

  // on the ground: a copy bounces, flies to the hero and goes into the bag with its rows
  function pick1(game, l) {
    const p = game.player, c = add(game, l.inst), it = ITEMS[c.id], R = NC.RARITY[it.rarity];
    FX.stars(p.x, p.y - 70, 16, R.rgb, { speed: 260 }); FX.ring(p.x, p.y, 20, 150, R.rgb, 0.5, 8);
    const god = c.rows.filter((r) => r.tier === 2).length;
    game.toast(`ได้รับ ${it.name}!${god ? `  ออฟเทพ ${god} แถว!` : ''}  กด I เพื่อถือ`);
    NC.HUD.log(`ได้รับ ${it.name} · ออฟ ${c.rows.map(NC.rowText).join(' · ') || 'ไม่มี'}`, 'item');
  }
  const baseUpdateLoot = NC.updateLoot;
  NC.updateLoot = function (game, dt) {
    const mine = game.loot.filter((l) => l.inst);
    if (!mine.length) return baseUpdateLoot(game, dt);
    game.loot = game.loot.filter((l) => !l.inst);
    baseUpdateLoot(game, dt);
    const p = game.player;
    for (const l of mine) {
      l.t += dt;
      if (l.vz || l.z > 0) { l.vz -= 1600 * dt; l.z += l.vz * dt; if (l.z <= 0) { l.z = 0; l.vz = l.vz < -200 ? -l.vz * 0.35 : 0; } }
      if (p.dead > 0 || l.t < 0.7) continue;
      const d = NC.dist(l.x, l.y, p.x, p.y);
      if (d < 140) { const k = Math.min(1, dt * 7); l.x += (p.x - l.x) * k; l.y += (p.y - l.y) * k; l.sort = l.y; }
      if (d < 44) { l.done = true; pick1(game, l); }
    }
    game.loot = game.loot.concat(mine.filter((l) => !l.done));
  };

  // ---------------- a copy's rows and a sword's source, as text ----------------
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  NC.rowsHtml = (c, empty) => {
    const out = c.rows.map((r) => `<span class="wb-opt" style="color:${TIER[r.tier].color}">${esc(NC.rowText(r))}${r.tier === 2 ? ' ★' : ''}</span>`);
    for (let i = c.rows.length; i < (empty || 0); i++) out.push('<span class="wb-opt wb-empty">— ว่าง (เจาะได้ที่ป๋าหมูหริ่ง) —</span>');
    return out.join('') || '<span class="wb-opt wb-empty">ไม่มีออฟ</span>';
  };
  const srcText = (s) => s.mob ? `ดรอปจาก${(NC.MONSTERS[s.mob] || {}).name || s.mob}` : s.boss ? `ดรอปจากบอส${(NC.MONSTERS[s.boss] || {}).name || s.boss}`
    : s.chest ? 'หีบเหล็กในดันเจี้ยน' : s.shop ? `ป๋าหมูหริ่งขาย ${fmt(s.shop)} เหรียญ` : s.rare ? `ดรอปหายากจากมอน Lv ${s.rare}+` : s.forge ? 'ป๋าหมูหริ่งหลอม (ถ้วยรางวัลบอสครบ 5)' : 'ป๋าหมูหริ่งตี';
  NC.gsSourceText = srcText;

  // (the styles: a small sheet of their own)
  const css = document.createElement('style');
  css.textContent = '.wb-opt{font-size:12.5px}.wb-empty{color:#8a8274;font-style:italic}';
  document.head.appendChild(css);
})();
