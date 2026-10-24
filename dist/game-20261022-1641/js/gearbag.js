/* gearbag.js — gear as pieces of their own (the Game Bible / Loot Book, 2026-09-30), the greatswords' js/wbag.js made
   general: every catalog weapon (greatswords, swords, the 28 other types), every outfit piece and its accessory and
   every hat that is not a fashion hat is kept per copy in p.bag = [{ u, id, rows, ref, sh }]:
     rows   option rows (weapons only): a drop or a craft starts with its grade's rows (1 / 2 / 2 / 3, boss and legend 3),
            each a random kind and tier ธรรมดา 60% · ดี 30% · เทพ 10% (ป๋าหมูหริ่ง adds and changes them: js/forge.js)
     ref    the refine level +0..+10 (js/refine.js)
     sh     1: a moonlit copy ✦ (1 in 200 drops: the same numbers, a silver-moon glow, its own line in the book)
   The collection (p.owned) still lists a kind while at least one copy is in the bag, so the rest of the game (the bag
   window, weapon sets, job rules) works as before; the copy worn in each slot is p.wu[slot]. Copies are sold one by one
   at the merchant (NC.GEAR.priceOf) and drop from js/loot.js (NC.GEAR.dropAt).
   Also: the option stones fall as before (หินออฟ 0.4%, bosses 1–3, chests; หินเจาะออฟ Lv 50+ 0.02%, bosses 15/25%) and
   NC.WBAG is this module (js/wabil.js reads the worn weapon's rows, js/forge.js the copies).
   Hooks: NC.saveGame / loadGear (own key; the old wbag save is read once), NC.equip, NC.updateLoot / drawLoot,
   NC.skillKills (the stones), and the bag window's NC.invBadge / invCardExtra / invAct. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, FX = NC.FX;
  const KEY = 'nightcamp.gear.v1', OLDKEY = 'nightcamp.wbag.v1';
  const fmt = (n) => NC.fmtCoins(n);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const rint = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ---------------- which items are pieces ----------------
  const wInfo = (it) => it && (it.gs || it.sw || it.wc);
  // (bossGear: a boss's own robe / hat made a piece: js/arealoot.js, the root-possessed bosses)
  const isInst = (id) => { const it = ITEMS[id]; return !!(it && it.rarity !== 'fashion' && (wInfo(it) || it.of || it.bossGear || (it.hc && it.hc !== 'fash'))); };
  for (const id in ITEMS) if (isInst(id)) ITEMS[id].inst = true;
  const gradeOf = (it) => { const w = wInfo(it) || it.of; return w ? w.grade : Math.min(4, 1 + Math.floor(((it.lvReq || 1) - 1) / 25)); };
  const kindOf = (it) => (wInfo(it) || {}).kind || (it.hc === 'boss' || it.bossGear ? 'D' : 'A');
  const slotKey = (it) => (it.slot === 'acc' ? 'acc' : it.slot);
  NC.gearGrade = gradeOf; NC.gearKind = kindOf;

  // ---------------- option rows (weapons) ----------------
  const TIER = [{ th: 'ธรรมดา', color: '#e8e2d4', w: 60 }, { th: 'ดี', color: '#6fb6ff', w: 30 }, { th: 'เทพ', color: '#ffc94d', w: 10 }];
  const STATS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
  const ELS = ['water', 'earth', 'fire', 'wind', 'poison', 'shadow', 'ghost', 'undead'];
  const elTh = (el) => (NC.ELEMENT_INFO && NC.ELEMENT_INFO[el] ? NC.ELEMENT_INFO[el].th : el);
  const RACES = () => NC.RACES || { plant: 'พืช', brute: 'สัตว์', insect: 'แมลง', undead: 'อมตะ', spirit: 'วิญญาณ', formless: 'ไร้รูป', dragon: 'มังกร' };
  const OPT = (NC.WOPTS = {
    atk: { th: 'พลังโจมตี', tiers: [[2, 3], [4, 5], [6, 7]], text: (r) => `ATK +${r.v}%` },
    crit: { th: 'คริติคอล', tiers: [[3, 4], [5, 6], [7, 8]], text: (r) => `คริติคอล +${r.v}%` },
    aspd: { th: 'ตีเร็ว', tiers: [[3, 4], [5, 6], [7, 8]], text: (r) => `ความเร็วโจมตี +${r.v}%` },
    leech: { th: 'ดูดเลือด', tiers: [[1, 1], [2, 2], [3, 3]], text: (r) => `ตีดูดเลือด ${r.v}%` },
    spKill: { th: 'ฆ่าได้ SP', tiers: [[2, 3], [4, 5], [6, 7]], text: (r) => `ฆ่าได้ SP +${r.v}` },
    stat: { th: 'สเตตัส', tiers: [[1, 2], [3, 3], [4, 5]], subs: STATS, subTh: (s) => s.toUpperCase(), text: (r) => `${r.sub.toUpperCase()} +${r.v}` },
    race: { th: 'แรงกับเผ่า', tiers: [[6, 8], [9, 12], [13, 15]], get subs() { return Object.keys(RACES()); }, subTh: (s) => RACES()[s], text: (r) => `แรงกับเผ่า${RACES()[r.sub]} +${r.v}%` },
    el: { th: 'แรงกับธาตุ', tiers: [[6, 8], [9, 12], [13, 15]], subs: ELS, subTh: elTh, text: (r) => `แรงกับมอนธาตุ${elTh(r.sub)} +${r.v}%` },
  });
  const MAX_ROWS = 4, MAX_SAME = 2, OLD_KINDS = new Set(Object.keys(OPT));
  const rollTier = () => { const r = Math.random() * 100; return r < 60 ? 0 : r < 90 ? 1 : 2; };
  // (it, o: the item and how it was made: js/gearopts.js picks the kinds by slot through NC.optPool, a row's own
  // subs through O.subsFor and may turn it special: NC.optRoll)
  function rollRow(rows, k, sub, tier, it, o) {
    const used = (x) => rows.filter((r) => r.k === x).length;
    const pool = NC.optPool ? NC.optPool(it, rows, o) : Object.keys(OPT);
    const kinds = pool.filter((x) => used(x) < MAX_SAME);
    k = k && OPT[k] && used(k) < MAX_SAME ? k : pick(kinds.length ? kinds : pool);
    const O = OPT[k], t = O.fixedTier !== undefined ? O.fixedTier : tier === undefined ? rollTier() : tier, [a, b] = O.tiers[t];
    const row = { k, v: rint(a, b), tier: t };
    const subs = O.subsFor ? O.subsFor(it) : O.subs;
    if (subs) row.sub = sub && subs.includes(sub) ? sub : pick(subs);
    return row;
  }
  NC.rowText = (r) => (OPT[r.k] ? OPT[r.k].text(r) : '');
  const baseRows = (it) => (!wInfo(it) ? (NC.optBaseRows ? NC.optBaseRows(it) : 0) : /[DL]/.test(kindOf(it)) ? 3 : [0, 1, 2, 2, 3][gradeOf(it)] || 1);   // (armour: js/gearopts.js)

  // ---------------- the bag ----------------
  const bag = (p) => p.bag || (p.bag = []);
  const wu = (p) => p.wu || (p.wu = {});
  let uidN = 1;
  function make(id, o) {
    o = o || {};
    const it = ITEMS[id], rows = [];
    const n = o.rows === undefined ? baseRows(it) : o.rows;
    for (let i = 0; i < n; i++) rows.push(rollRow(rows, undefined, undefined, undefined, it, o));
    const c = { u: (Date.now() % 1e9) * 100 + (uidN++ % 100), id, rows, ref: o.ref || 0, sh: o.sh ? 1 : 0 };
    for (const f of NC.gearMakeHooks || []) f(c, it, o); // (js/gearopts.js: a drop's extra row, a craft's locked row and maker)
    return c;
  }
  // the copy worn in a slot (acc1 / acc2 by their key)
  function wornIn(p, key) {
    const id = p.equip && p.equip[key];
    if (!isInst(id)) return null;
    const B = bag(p), want = wu(p)[key];
    const c = B.find((x) => x.u === want && x.id === id) || best(B.filter((x) => x.id === id));
    if (c) wu(p)[key] = c.u;
    return c || null;
  }
  const score = (c) => (c.ref || 0) * 100 + c.rows.reduce((s, r) => s + 1 + r.tier * 2, 0) + (c.sh ? 0.5 : 0);
  const best = (list) => list.reduce((a, c) => (!a || score(c) > score(a) ? c : a), null);
  const worn = (p) => wornIn(p, 'weapon');
  function rowEffects(p) {
    const c = worn(p);
    if (!c || !c.rows.length) return [];
    if (c._fx) return c._fx;
    return (c._fx = c.rows.filter((r) => OLD_KINDS.has(r.k)).map((r) => {   // (the newer kinds: js/gearopts.js)
      if (r.k === 'atk' || r.k === 'crit') return { t: 'mods', [r.k]: r.v };
      if (r.k === 'aspd') return { t: 'aspd', v: r.v };
      if (r.k === 'stat') return { t: 'mods', [r.sub]: r.v };
      if (r.k === 'leech') return { t: 'leech', pct: r.v };
      if (r.k === 'spKill') return { t: 'killSp', sp: r.v };
      if (r.k === 'race') return { t: 'vsRace', race: r.sub, pct: r.v };
      return { t: 'vsEl', els: [r.sub], pct: r.v };
    }));
  }
  const ADD = (NC.gearAdded = []); // (game, copy) when a copy comes into the bag (the book, the report)
  function add(game, c, quiet) {
    const p = game.player;
    bag(p).push(c);
    p.owned.add(c.id);
    if (!quiet) p.fresh.add(c.id);
    for (const f of ADD) f(game, c, quiet);
    NC.saveGame(game);
    return c;
  }
  // a copy out of the bag without saving (remove saves; the bulk sale takes many, then saves once)
  function take(p, c) {
    const B = bag(p), i = B.indexOf(c);
    if (i < 0) return false;
    B.splice(i, 1);
    for (const k in wu(p)) if (wu(p)[k] === c.u) delete wu(p)[k];
    // the last copy gone: the kind leaves the collection (the bag never lets a worn copy go, see invAct)
    if (!B.some((x) => x.id === c.id) && !Object.values(p.equip).includes(c.id)) { p.owned.delete(c.id); p.fresh.delete(c.id); }
    return true;
  }
  function remove(game, c) {
    if (!take(game.player, c)) return;
    NC.applyGear(game); NC.saveGame(game);
  }
  const changed = (game, c) => { delete c._fx; NC.applyGear(game); NC.saveGame(game); };
  // What the merchant pays (the owner, 2026-10-07, the endgame balance audit): selling dropped gear was 35–50% of a Lv 99
  // hero's coins, so grade 4 pays half (was 10,000 a plain weapon) and a world legend 6x it, not 10x (100,000 → 30,000
  // before its rows); D stays 3x. basePrice is the piece's own price (exported as gear.items[id].sellBase); priceOf is
  // the same price before the day's drop: the web's js/endgame_audit.js NC.GEAR.sellPrice takes the drop off it (full for
  // the first 15 pieces a day), and js/economy.js keeps the same count for its own books (NC.Econ.gearPay is that rule).
  const SELL = { 1: 300, 2: 1200, 3: 4000, 4: 5000 }, KMUL = { A: 1, B: 1.2, C: 1.4, D: 3, L: 6 };
  const basePrice = (c) => {
    const it = ITEMS[c.id], g = gradeOf(it), k = wInfo(it) ? 1 : 0.6;
    const rk = NC.optPriceK ? NC.optPriceK(c) : 1 + c.rows.length * 0.25; // (the rows' tiers: js/gearopts.js)
    return Math.round(SELL[g] * k * (KMUL[kindOf(it)] || 1) * rk * (1 + (c.ref || 0) * 0.15) * (c.sh ? 3 : 1));
  };
  const priceOf = basePrice;
  // what a piece fetches today (the day's drop applied once, by js/endgame_audit.js when it is loaded)
  const salePrice = (c) => (NC.GEAR && NC.GEAR.sellPrice ? NC.GEAR.sellPrice(c) : NC.Econ && NC.Econ.gearPay ? NC.Econ.gearPay(basePrice(c)) : basePrice(c));
  // one piece sold at the merchant or the forge (the day's count; online the server counts its own)
  const countSale = (game, c, got) => { if (NC.Econ && NC.Econ.gearSold) NC.Econ.gearSold(got); };
  const copies = (p, id) => bag(p).filter((c) => !id || c.id === id);
  // ---------------- the bag's room, the camp storage and the bulk sale (the owner, 2026-10-08: docs/bag-capacity-plan.md) ----------------
  // The bag holds BAG_MAX pieces that are not worn (worn ones never count, so putting on and taking off always work);
  // Uncle Coco keeps STORE_MAX more per hero. A full bag leaves gear on the ground; a system grant (a class kit, an old
  // save's kind) still goes in over the cap, so nothing is ever lost.
  const BAG_MAX = 200, STORE_MAX = 300;
  // more room bought at Uncle Coco (the owner, 2026-10-08: "ซื้อช่องเพิ่มได้แต่ไม่เกิน 500 ช่อง"): +BAG_STEP a time, never
  // past BAG_HARD, each step dearer (a coin sink for the Lv 99 economy); per hero, like the bag (p.bagExtra)
  const BAG_STEP = 50, BAG_HARD = 500, BAG_PRICES = [100000, 250000, 500000, 1000000, 2000000, 4000000];
  const bagCap = (p) => Math.min(BAG_HARD, BAG_MAX + Math.max(0, p.bagExtra | 0));
  const nextSlotsPrice = (p) => (bagCap(p) >= BAG_HARD ? 0 : BAG_PRICES[Math.floor(Math.max(0, p.bagExtra | 0) / BAG_STEP)] || 0);
  const store = (p) => p.store || (p.store = []);
  const wornUids = (p) => {
    const s = new Set();
    for (const k in p.equip || {}) { const c = wornIn(p, k); if (c) s.add(c.u); }
    return s;
  };
  // the starter and class weapons are never sold (js/economy-rules.js NC.ECONOMY.protected; the server refuses them too,
  // backend economy.go tradableGear): no sale list, bulk sale or ขาย button offers them (2026-10-19, the user)
  const noSale = (c) => { const P = NC.ECONOMY && NC.ECONOMY.protected; return !!(c && P && P.includes(c.id)); };
  const used = (p) => { const w = wornUids(p); let n = 0; for (const c of bag(p)) if (!w.has(c.u)) n++; return n; };
  const room = (p, n = 1) => used(p) + n <= bagCap(p);
  let fullSaid = -1e9;
  const FULL_SAY_MS = 8000; // (told now and then, never every frame a drop waits by the hero)
  function sayFull(game) {
    const t = performance.now();
    if (t - fullSaid < FULL_SAY_MS) return;
    fullSaid = t;
    game.toast(`กระเป๋าอุปกรณ์เต็ม (${bagCap(game.player)} ชิ้น) · ของยังอยู่บนพื้น · ขาย ฝากคลัง หรือขยายกระเป๋าที่ลุงโกโก้`);
  }
  // which pieces the bulk sale offers: not worn, never moonlit, refined ones only when asked, in the chosen grades, and
  // (unless told not to) the best piece of each kind kept, a worn piece of the kind being the kept one
  function pickForSale(p, o) {
    o = o || {};
    const worn = wornUids(p), grades = new Set(o.grades || [1, 2, 3, 4]), keep = new Set();
    if (o.keepBest !== false) {
      const top = new Map();
      for (const c of bag(p)) {
        if (worn.has(c.u)) { top.set(c.id, null); continue; }
        if (top.get(c.id) === null) continue;
        const b = top.get(c.id);
        if (!b || score(c) > score(b)) top.set(c.id, c);
      }
      for (const c of top.values()) if (c) keep.add(c.u);
    }
    return bag(p).filter((c) => !worn.has(c.u) && !keep.has(c.u) && !c.sh && !noSale(c) && (o.refined || !(c.ref > 0)) && grades.has(gradeOf(ITEMS[c.id])));
  }
  const W = (NC.GEAR = NC.WBAG = { TIER, OPT, MAX_ROWS, MAX_SAME, make, add, remove, worn, wornIn, rowEffects, rollRow, changed, priceOf, basePrice,
    countSale, copies, isInst, gradeOf, kindOf, bag, BAG_MAX, STORE_MAX, BAG_STEP, BAG_HARD, BAG_PRICES, bagCap, nextSlotsPrice, store, wornUids,
    used, room, pickForSale, noSale });

  // more room in the bag, bought at Uncle Coco: null when done, else why not
  W.buySlots = function (game) {
    const p = game.player, price = nextSlotsPrice(p);
    if (!price) return 'max';
    if (!nearShop(game)) return 'far';
    if ((p.coins || 0) < price) return 'coins';
    p.coins -= price;
    p.bagExtra = Math.max(0, p.bagExtra | 0) + BAG_STEP;
    if (NC.Econ && NC.Econ.sink) NC.Econ.sink('bagslots', price);
    NC.saveGame(game);
    NC.HUD.log(`ขยายกระเป๋าเป็น ${bagCap(p)} ช่อง (${fmt(price)} เหรียญ)`, 'item');
    return null;
  };

  // into the camp storage and back, at Uncle Coco: null when done, else why not (a stored piece can't be worn, so its
  // kind leaves "owned" with the last copy in the bag; the monster book keeps what it has recorded)
  W.deposit = function (game, u) {
    const p = game.player, c = bag(p).find((x) => x.u === u);
    if (!c) return 'gone';
    if (!nearShop(game)) return 'far';
    if (wornUids(p).has(c.u)) return 'worn';
    if (store(p).length >= STORE_MAX) return 'storeFull';
    take(p, c);
    store(p).push(c);
    NC.applyGear(game); NC.saveGame(game);
    return null;
  };
  W.withdraw = function (game, u) {
    const p = game.player, S = store(p), i = S.findIndex((x) => x.u === u);
    if (i < 0) return 'gone';
    if (!nearShop(game)) return 'far';
    if (!room(p)) return 'bagFull';
    const [c] = S.splice(i, 1);
    add(game, c, true);
    return null;
  };
  // the order a bulk sale goes in: the dearest piece first (it gets the day's full price), then by its uid (both sides
  // agree on ties: backend gear_copies.go sellCopiesOrder)
  const saleOrder = (list) => list.slice().sort((a, b) => basePrice(b) - basePrice(a) || a.u - b.u);
  // what a bulk sale of these pieces pays, piece by piece after the day's drop (offline the preview of sellMany)
  const salePreview = (list) => {
    const ahead = NC.Econ && NC.Econ.gearPayAhead;
    return saleOrder(list).reduce((s, c, i) => s + (ahead ? ahead(basePrice(c), i) : basePrice(c)), 0);
  };
  W.saleOrder = saleOrder; W.salePreview = salePreview;
  // what Uncle Coco buys piece by piece (the bag card's ขาย, his shop window's ขายอุปกรณ์ tab, js/shopwin.js): every piece
  // not worn and not a starter or class weapon (noSale), dearest first (bound ones too: js/rootloot.js; moonlit ones only here, never in the bulk sale), each at
  // what it fetches today
  W.saleList = (p) => { const worn = wornUids(p); return saleOrder(bag(p).filter((c) => !worn.has(c.u) && !noSale(c))); };
  W.salePrice = salePrice;
  // many pieces sold at once at Uncle Coco, each priced in turn as a single sale (every piece counts in the day's drop);
  // worn ones are never sold
  W.sellMany = function (game, uids) {
    const p = game.player;
    if (!nearShop(game)) return { n: 0, got: 0, why: 'far' };
    const worn = wornUids(p), byU = new Map(bag(p).map((c) => [c.u, c]));
    const list = saleOrder([...new Set(uids)].map((u) => byU.get(u)).filter((c) => c && !worn.has(c.u) && !noSale(c)));
    let n = 0, got = 0;
    for (const c of list) {
      const pay = salePrice(c);
      take(p, c); if (NC.gearSold) NC.gearSold(); countSale(game, c, pay);
      got += pay; n++;
    }
    if (!n) return { n: 0, got: 0, why: 'none' };
    p.coins = (p.coins || 0) + got;
    NC.applyGear(game); NC.saveGame(game);
    NC.HUD.log(`ขายอุปกรณ์ ${fmt(n)} ชิ้น ได้ ${fmt(got)} เหรียญ`, 'item');
    return { n, got, why: null };
  };

  // hold a copy (its kind is put on, this very copy)
  W.use = function (game, u) {
    const p = game.player, c = bag(p).find((x) => x.u === u);
    if (!c) return;
    const it = ITEMS[c.id];
    let key = slotKey(it);
    if (key === 'acc') key = p.equip.acc1 === c.id ? 'acc1' : p.equip.acc2 === c.id ? 'acc2' : null;
    if (key) wu(p)[key] = c.u;
    const on = key && p.equip[key] === c.id;
    if (!on) { NC.equip(game, c.id); const k2 = slotKey(it) === 'acc' ? (p.equip.acc1 === c.id ? 'acc1' : 'acc2') : slotKey(it); wu(p)[k2] = c.u; }
    delete c._fx;
    NC.applyGear(game); NC.saveGame(game);
  };
  const baseEquip = NC.equip;
  NC.equip = function (game, id) {
    const p = game.player, was = Object.assign({}, p.equip);
    baseEquip.apply(this, arguments);
    if (isInst(id)) for (const k in p.equip) if (p.equip[k] === id && was[k] !== id) { const c = wornIn(p, k); if (c) delete c._fx; }
  };

  // ---------------- saving ----------------
  const baseSave = NC.saveGame;
  NC.saveGame = function (game) {
    baseSave.apply(this, arguments);
    if (game.noSave) return;
    const p = game.player;
    // (pi: the forge's แต้มช่าง for the option stone, js/forge.js; store: the camp storage)
    const ser = (c) => Object.assign({ u: c.u, id: c.id, rows: c.rows, ref: c.ref || 0, sh: c.sh || 0, pi: c.pi || 0 }, c.taint ? { taint: c.taint } : {}, c.by ? { by: c.by } : {}, c.g != null ? { g: c.g, gp: c.gp || 0 } : {}, c.bd ? { bd: 1 } : {});
    try { localStorage.setItem(KEY, JSON.stringify({ bag: bag(p).map(ser), wu: wu(p), store: store(p).map(ser), bagExtra: Math.max(0, p.bagExtra | 0) })); }
    catch (e) { /* storage blocked */ }
  };
  const baseLoad = NC.loadGear;
  NC.loadGear = function (game, prm) {
    baseLoad.apply(this, arguments);
    const p = game.player;
    p.bag = []; p.wu = {}; p.store = [];
    let s = null;
    if (!NC.ONLINE) try { s = JSON.parse(localStorage.getItem(KEY) || 'null') || JSON.parse(localStorage.getItem(OLDKEY) || 'null'); } catch (e) { s = null; }
    const read = (list, into) => {
      if (Array.isArray(list)) for (const c of list) if (c && isInst(c.id) && Array.isArray(c.rows))
        into.push(Object.assign({ u: c.u, id: c.id, ref: c.ref || 0, sh: c.sh || 0, pi: Math.max(0, Math.min(9, c.pi | 0)), rows: c.rows.filter((r) => r && OPT[r.k]).slice(0, MAX_ROWS) }, typeof c.taint === 'string' ? { taint: c.taint } : {}, typeof c.by === 'string' ? { by: c.by.slice(0, 24) } : {}, c.g >= 0 && c.g <= 5 ? { g: c.g | 0, gp: Math.max(0, Math.min(9, c.gp | 0)) } : {}, c.bd ? { bd: 1 } : {}));
    };
    if (s) { read(s.bag, p.bag); read(s.store, p.store); }
    p.bagExtra = Math.max(0, Math.min(BAG_HARD - BAG_MAX, Math.floor(((s && s.bagExtra) | 0) / BAG_STEP) * BAG_STEP)); // (bought room)
    if (s && s.wu) p.wu = s.wu; else if (s && s.wUid) p.wu = { weapon: s.wUid };
    // the collection and the bag agree: a kind owned without a copy gets one (old saves, test switches), a copy's kind is
    // owned; a kind whose only pieces are in the storage is not owned (it can't be worn from there) and gets none
    const stored = new Set(p.store.map((c) => c.id));
    for (const id of [...p.owned]) if (isInst(id) && !p.bag.some((c) => c.id === id)) {
      if (stored.has(id) && !Object.values(p.equip || {}).includes(id)) p.owned.delete(id);
      else if (!stored.has(id)) p.bag.push(make(id));
    }
    for (const c of p.bag) if (NC.itemReady(c.id)) p.owned.add(c.id);
    NC.applyGear(game);
  };

  // ---------------- on the ground: a copy bounces, flies to the hero and goes into the bag ----------------
  W.dropAt = function (game, x, y, id, o) {
    if (!NC.itemReady(id)) return null;
    const c = make(id, { sh: o && o.sh, src: 'drop' });
    game.loot.push({ kind: 'loot', id, inst: c, x: x + NC.rand(-40, 40), y: y + NC.rand(-14, 14), sort: y, t: 0, z: 0, vz: 560 });
    const R = NC.RARITY[ITEMS[id].rarity] || NC.RARITY.common;
    FX.stars(x, y - 60, c.sh ? 26 : 16, c.sh ? '200,225,255' : R.rgb, { speed: 300 }); FX.ring(x, y, 20, 190, R.rgb, 0.6, 9);
    return c;
  };
  const PICK = (NC.gearPicked = []); // (game, copy) after the hero picks one up (js/loot.js announces rare ones)
  function pick1(game, l) {
    const p = game.player, c = add(game, l.inst), it = ITEMS[c.id], R = NC.RARITY[it.rarity] || NC.RARITY.common;
    FX.stars(p.x, p.y - 70, 16, R.rgb, { speed: 260 }); FX.ring(p.x, p.y, 20, 150, R.rgb, 0.5, 8);
    const god = c.rows.filter((r) => r.tier === 2).length;
    game.toast(`ได้รับ ${c.sh ? '✦ ' : ''}${it.name}!${god ? `  ออฟเทพ ${god} แถว!` : ''}  กด I ดูกระเป๋า`);
    NC.HUD.log(`ได้รับ ${c.sh ? '✦ ' : ''}${it.name}${c.rows.length ? ' · ออฟ ' + c.rows.map(NC.rowText).join(' · ') : ''}`, 'item');
    for (const f of PICK) f(game, c);
  }
  const baseUpdateLoot = NC.updateLoot;
  NC.updateLoot = function (game, dt) {
    const mine = game.loot.filter((l) => l.inst);
    if (!mine.length) return baseUpdateLoot(game, dt);
    game.loot = game.loot.filter((l) => !l.inst);
    baseUpdateLoot(game, dt);
    const p = game.player, full = !room(p);
    for (const l of mine) {
      l.t += dt;
      if (l.vz || l.z > 0) { l.vz -= 1600 * dt; l.z += l.vz * dt; if (l.z <= 0) { l.z = 0; l.vz = l.vz < -200 ? -l.vz * 0.35 : 0; } }
      if (p.dead > 0 || l.t < 0.7) continue;
      const d = NC.dist(l.x, l.y, p.x, p.y);
      if (full) { if (d < 140) sayFull(game); continue; } // (a full bag: the drop stays where it lies)
      if (d < 140) { const k = Math.min(1, dt * 7); l.x += (p.x - l.x) * k; l.y += (p.y - l.y) * k; l.sort = l.y; }
      if (d < 44) { l.done = true; pick1(game, l); }
    }
    game.loot = game.loot.concat(mine.filter((l) => !l.done));
  };

  // ---------------- the option stones ----------------
  const BOSSES = new Set(['bat_king', 'ant_queen', 'crypt_lord', 'lava_dragon', 'mushking']);
  const chance = (pct) => Math.random() * 100 < pct;
  const dropMat = (game, e, id, n) => {
    if (!NC.MATERIALS[id]) return;
    for (let i = 0; i < n; i++)
      game.loot.push({ kind: 'loot', mat: id, x: e.x + NC.rand(-60, 60), y: e.y + NC.rand(-20, 20), sort: e.y, t: 0, z: e.z || 0, vz: NC.rand(400, 540), spin: NC.rand(0, 6) });
  };
  NC.skillKills.push((game, e) => {
    const t = e.type;
    if (!t || e.lootless) return; // (lootless: split pieces, called helpers, a root shade felled without a blessing)
    const chest = /^chest_/.test(t), boss = BOSSES.has(t) || (NC.BOSSES && NC.BOSSES[t]);
    if (boss) { dropMat(game, e, 'mat_opt_stone', rint(1, 3)); if (chance(BOSSES.has(t) ? 25 : 15)) dropMat(game, e, 'mat_drill_stone', 1); }
    else if (chest) { if (chance(20)) dropMat(game, e, 'mat_opt_stone', 1); if (t === 'chest_gold' && chance(10)) dropMat(game, e, 'mat_drill_stone', 1); }
    else {
      if (chance(0.4)) dropMat(game, e, 'mat_opt_stone', 1);
      if ((e.lv || 0) >= 50 && chance(0.02)) dropMat(game, e, 'mat_drill_stone', 1);
    }
  });
  // (the stones themselves: forge.js makes them; when it isn't loaded they are made here)
  if (NC.MATERIALS && !NC.MATERIALS.mat_opt_stone) {
    NC.MATERIALS.mat_opt_stone = { name: 'หินออฟ', price: 2000, desc: 'หินรูนสีม่วง สลักรูปช่องเสียบ ป๋าหมูหริ่งใช้เปลี่ยนออฟของอาวุธหนึ่งแถว' };
    NC.MATERIALS.mat_drill_stone = { name: 'หินเจาะออฟ', price: 50000, rare: true, desc: 'ผลึกสีครามเป็นเกลียวสว่าน ใช้เจาะแถวออฟใหม่ให้อาวุธ หายากมาก!' };
  }

  // ---------------- the bag window: copies, their rows, holding one, selling one ----------------
  NC.rowsHtml = (c, empty) => {
    const out = c.rows.map((r) => `<span class="gb-opt t${r.tier}" style="color:${TIER[r.tier].color}">${esc(NC.rowText(r))}${r.tier === 2 && !NC.Grade ? ' ★' : ''}</span>`); // (t0..t2: js/gradetier.js puts ◆ / ★ before a row)
    for (let i = c.rows.length; i < (empty || 0); i++) out.push('<span class="gb-opt gb-empty">— ว่าง (เจาะได้ที่ป๋าหมูหริ่ง) —</span>');
    return out.join('') || '';
  };
  const nearShop = (game) => { const S = NC.Shop; return !!(S && game && game.world && game.world.shop && game.player.dead <= 0 && NC.dist(game.player.x, game.player.y, S.npc.x, S.npc.y) < S.talk + 40); };
  let armed = 0;
  NC.copyName = (c) => `${c.sh ? '✦ ' : ''}${ITEMS[c.id].name}${c.ref ? ' +' + c.ref : ''}`;
  // a cell's corners: the bag window gives every piece its own cell (en.copy, js/inventory.js); a kind's cell (en.copy
  // missing: an old caller) still counts its pieces
  NC.invBadge = function (p, en) {
    if (en.kind !== 'item' || !isInst(en.id)) return '';
    const list = en.copy ? [en.copy] : copies(p, en.id), top = best(list);
    let h = '';
    if (list.length > 1) h += `<b class="gb-count">×${list.length}</b>`;
    if (top && top.ref) h += `<b class="gb-ref">+${top.ref}</b>`;
    if (list.some((c) => c.sh)) h += '<i class="gb-shiny" title="ประกายจันทร์">✦</i>';
    return h;
  };
  const CARD_EXTRA = (NC.invCardExtras = []); // (p, id, copy) -> html: the other files' lines on the item card (abilities, set passives, the book); copy: the piece shown, when the card is one piece
  CARD_EXTRA.push((p, id) => { // the weapon's own ability (js/wabil_data.js, greatswords.js)
    const it = ITEMS[id], t = it && (it.abilText || (it.gs && it.gs.text !== '—' && it.gs.text));
    return t ? `<div class="gb-abil">✧ ${esc(t)}</div>` : '';
  });
  // the card's piece box: one piece (one, the cell's: its rows, ขาย / ฝากคลัง; the card's own button puts it on) or
  // every piece of the kind (one missing)
  NC.invCardExtra = function (p, id, one) {
    let h = CARD_EXTRA.map((f) => f(p, id, one) || '').join('');
    if (!isInst(id)) return h;
    const all = copies(p, id), list = one ? [one] : all.slice().sort((a, b) => score(b) - score(a)), it = ITEMS[id];
    let key = slotKey(it);
    const on = (key === 'acc' ? [wornIn(p, 'acc1'), wornIn(p, 'acc2')] : [wornIn(p, key)]).filter(Boolean).map((c) => c.u);
    const shop = nearShop(NC.game);
    const today = NC.Econ && NC.Econ.gearFlow ? NC.Econ.gearFlow() : 1; // (the day's drop: js/economy.js)
    const head = one ? `ชิ้นนี้${all.length > 1 ? ` · มีชนิดนี้ ${all.length} ชิ้น` : ''}` : `ของที่มี ${list.length} ชิ้น`;
    h += `<div class="gb-copies"><div class="h">${head}${shop ? ' · ขายได้ที่ร้านนี้' + (today < 1 ? ` (วันนี้รับ ${Math.round(today * 100)}%)` : '') : ''}</div>`;
    for (const c of list) {
      const isOn = on.includes(c.u) && Object.values(p.equip).includes(c.id);
      const btns = (one ? '' : isOn ? '<span class="gb-worn">✔ สวมอยู่</span>' : `<button class="iv-btn blue" data-act="gb:use:${c.u}">ใส่ชิ้นนี้</button>`) + // (one piece: the card says สวมอยู่ itself)
        (shop && !isOn ? (noSale(c) ? '' : `<button class="iv-btn gold" data-act="gb:sell:${c.u}">${armed === c.u ? 'กดอีกครั้ง ' : 'ขาย '}${fmt(salePrice(c))}</button>`) +
          `<button class="iv-btn dark" data-act="gb:put:${c.u}" ${store(p).length >= STORE_MAX ? 'disabled' : ''}>ฝากคลัง</button>` : '');
      h += `<div class="gb-copy${isOn ? ' on' : ''}${c.sh ? ' sh' : ''}"><div class="gb-rows"><b${NC.copyStyle ? NC.copyStyle(c) : ''}>${esc(NC.copyName(c))}</b>${NC.copyTag ? NC.copyTag(c) : ''}${NC.rowsHtml(c)}</div>` +
        (btns ? `<div class="gb-btns">${btns}</div>` : '') + '</div>';
    }
    return h + '</div>';
  };
  // the storage tab's card: one stored piece (one) or the stored pieces of one kind, each taken back into the bag at Uncle Coco
  NC.storeCard = function (p, id, one) {
    const list = one ? [one] : store(p).filter((c) => c.id === id).sort((a, b) => score(b) - score(a)), shop = nearShop(NC.game), full = !room(p);
    let h = `<div class="gb-copies"><div class="h">${one ? 'ชิ้นนี้' : `ในคลัง ${list.length} ชิ้น`} · คลัง ${store(p).length}/${STORE_MAX}</div>`;
    for (const c of list)
      h += `<div class="gb-copy${c.sh ? ' sh' : ''}"><div class="gb-rows"><b${NC.copyStyle ? NC.copyStyle(c) : ''}>${esc(NC.copyName(c))}</b>${NC.copyTag ? NC.copyTag(c) : ''}${NC.rowsHtml(c)}</div>` +
        `<div class="gb-btns"><button class="iv-btn blue" data-act="gb:take:${c.u}" ${shop && !full ? '' : 'disabled'}>เบิกใส่กระเป๋า</button></div></div>`;
    return h + '</div>' + `<div class="iv-hint">${!shop ? 'ฝากและเบิกได้ที่ร้านลุงโกโก้ กลางค่าย' : full ? `กระเป๋าเต็ม (${bagCap(p)} ชิ้น) · ขายหรือฝากของก่อนเบิก` : 'ของในคลังใส่ไม่ได้ ต้องเบิกใส่กระเป๋าก่อน'}</div>`;
  };

  // ---------------- the bulk sale card (the bag's gear tab at Uncle Coco) ----------------
  const bulk = { grades: new Set([1, 2]), keepBest: true, refined: false, armed: 0 };
  const BULK_SHOWN = 12; // (the names listed on the card; the rest counted)
  const bulkPick = (p) => pickForSale(p, { grades: [...bulk.grades], keepBest: bulk.keepBest, refined: bulk.refined });
  NC.gearBulkCard = function (p) {
    const shop = nearShop(NC.game), list = saleOrder(bulkPick(p)), worth = salePreview(list);
    const chip = (act, on, label) => `<button class="iv-btn ${on ? 'blue' : 'grey'}" data-act="${act}">${label}</button>`;
    const names = list.slice(0, BULK_SHOWN).map((c) => `<div>${esc(NC.copyName(c))}</div>`).join('') + (list.length > BULK_SHOWN ? `<div class="src">และอีก ${fmt(list.length - BULK_SHOWN)} ชิ้น</div>` : '');
    const sell = !list.length ? 'ไม่มีชิ้นที่ตรงเงื่อนไข' : bulk.armed ? `กดอีกครั้ง: ${fmt(worth)} เหรียญ` : `ขาย ${fmt(list.length)} ชิ้น`;
    return '<div class="iv-name">ขายอุปกรณ์หลายชิ้น</div>' +
      `<div class="iv-type"><b>อุปกรณ์</b>ในกระเป๋า ${used(p)}/${bagCap(p)} · คลัง ${store(p).length}/${STORE_MAX}</div>` +
      `<div class="iv-acts">${[1, 2, 3, 4].map((g) => chip('gb:bulk:g' + g, bulk.grades.has(g), 'เกรด ' + g)).join('')}</div>` +
      `<div class="iv-acts">${chip('gb:bulk:keep', bulk.keepBest, 'เก็บชิ้นดีสุดของแต่ละอย่าง')}${chip('gb:bulk:ref', bulk.refined, 'รวมชิ้นที่ตีบวกแล้ว')}</div>` +
      `<div class="iv-lines">${names || '<div class="src">ไม่มีชิ้นที่ตรงเงื่อนไข</div>'}</div>` +
      `<div class="iv-main"><div><b>รวม</b>${fmt(worth)} เหรียญ</div></div>` +
      `<div class="iv-acts"><button class="iv-btn gold" data-act="gb:bulk:sell" ${shop && list.length ? '' : 'disabled'}>${sell}</button></div>` +
      `<div class="iv-hint">${shop ? 'ไม่ขายชิ้นที่สวมอยู่และชิ้นประกายจันทร์ ✦ · ขายชิ้นแพงก่อน (วันละ 15 ชิ้นแรกได้ราคาเต็ม)' : 'ขายได้ที่ร้านลุงโกโก้ กลางค่าย'}</div>`;
  };
  NC.gearBulkAct = function (game, a) {
    const m = /^gb:bulk:(g[1-4]|keep|ref|sell)$/.exec(a || '');
    if (!m) return false;
    const k = m[1];
    if (k !== 'sell') bulk.armed = 0;
    if (k[0] === 'g') { const g = Number(k[1]); if (bulk.grades.has(g)) bulk.grades.delete(g); else bulk.grades.add(g); }
    else if (k === 'keep') bulk.keepBest = !bulk.keepBest;
    else if (k === 'ref') bulk.refined = !bulk.refined;
    else if (!bulk.armed) { bulk.armed = performance.now(); setTimeout(() => { bulk.armed = 0; }, 3000); } // (a second press within 3 s sells)
    else {
      bulk.armed = 0;
      const r = W.sellMany(game, bulkPick(game.player).map((c) => c.u));
      if (r.n && !r.pending) game.toast(`ขายอุปกรณ์ ${fmt(r.n)} ชิ้น ได้ ${fmt(r.got)} เหรียญ`); // (online: the server's coins say it)
    }
    return true;
  };

  // ---------------- more room in the bag (the bag's count in the gear tab opens it) ----------------
  let expandArmed = 0;
  const EXPAND_WHY = { far: 'ขยายได้ที่ร้านลุงโกโก้ กลางค่าย', coins: 'เหรียญไม่พอ', max: `ขยายครบ ${BAG_HARD} ช่องแล้ว` };
  NC.gearExpandCard = function (p) {
    const shop = nearShop(NC.game), price = nextSlotsPrice(p), cap = bagCap(p);
    const why = !price ? EXPAND_WHY.max : !shop ? EXPAND_WHY.far : (p.coins || 0) < price ? EXPAND_WHY.coins : '';
    const steps = BAG_PRICES.map((c, i) => `<div class="${BAG_MAX + (i + 1) * BAG_STEP <= cap ? 'on' : ''}">${fmt(BAG_MAX + (i + 1) * BAG_STEP)} ช่อง · ${fmt(c)} เหรียญ</div>`).join('');
    return '<div class="iv-name">ขยายกระเป๋า</div>' +
      `<div class="iv-type"><b>อุปกรณ์</b>ในกระเป๋า ${used(p)}/${cap} ช่อง · สูงสุด ${BAG_HARD}</div>` +
      `<div class="iv-set"><div class="h">ซื้อเพิ่มครั้งละ ${BAG_STEP} ช่อง (ตัวละครนี้)</div>${steps}</div>` +
      `<div class="iv-acts"><button class="iv-btn gold" data-act="gb:expand" ${why ? 'disabled' : ''}>${!price ? 'ขยายครบแล้ว' : expandArmed ? `กดอีกครั้ง: จ่าย ${fmt(price)} เหรียญ` : `ขยาย +${BAG_STEP} ช่อง · ${fmt(price)} เหรียญ`}</button></div>` +
      `<div class="iv-hint">${why || 'ช่องที่ซื้อเป็นของตัวละครนี้ ไม่หายไปไหน'}</div>`;
  };
  NC.gearExpandAct = function (game, a) {
    if (a !== 'gb:expand') return false;
    if (!expandArmed) { expandArmed = performance.now(); setTimeout(() => { expandArmed = 0; }, 3000); return true; } // (a second press within 3 s pays)
    expandArmed = 0;
    const why = W.buySlots(game);
    if (why === 'sent') return true; // (online: the server's snapshot shows the new room)
    if (why) game.toast(EXPAND_WHY[why] || why);
    else game.toast(`กระเป๋าอุปกรณ์ ${bagCap(game.player)} ช่องแล้ว`);
    return true;
  };

  const PUT_WHY = { far: 'ฝากได้ที่ร้านลุงโกโก้ กลางค่าย', worn: 'ถอดชิ้นที่สวมก่อนฝาก', storeFull: `คลังเต็ม (${STORE_MAX} ชิ้น)` };
  const TAKE_WHY = { far: 'เบิกได้ที่ร้านลุงโกโก้ กลางค่าย', bagFull: 'กระเป๋าอุปกรณ์เต็ม' };
  const ACTS = (NC.invActs = []); // (game, a, en) -> true when handled (the other files' buttons)
  NC.invAct = function (game, a, en) {
    for (const f of ACTS) if (f(game, a, en)) return true;
    const m = /^gb:(use|sell|put|take):(\d+)$/.exec(a || '');
    if (!m) return false;
    if (m[1] === 'put' || m[1] === 'take') {
      const why = m[1] === 'put' ? W.deposit(game, Number(m[2])) : W.withdraw(game, Number(m[2]));
      const say = (m[1] === 'put' ? PUT_WHY : TAKE_WHY)[why];
      if (say) game.toast(say);
      return true;
    }
    const p = game.player, c = bag(p).find((x) => x.u === Number(m[2]));
    if (!c) return true;
    if (m[1] === 'use') { armed = 0; W.use(game, c.u); return true; }
    if (!nearShop(game)) { game.toast('ขายของได้ที่ร้านลุงโกโก้ กลางค่าย'); return true; }
    if (armed !== c.u) { armed = c.u; setTimeout(() => { if (armed === c.u) armed = 0; }, 3000); return true; }
    armed = 0;
    const got = salePrice(c); // (the day's sales lower it: js/endgame_audit.js)
    remove(game, c);
    if (NC.gearSold) NC.gearSold();
    p.coins = (p.coins || 0) + got;
    countSale(game, c, got);
    NC.HUD.log(`ขาย ${NC.copyName(c)} ได้ ${fmt(got)} เหรียญ`, 'item');
    NC.saveGame(game);
    return true;
  };

  const css = document.createElement('style');
  css.textContent = `
    .iv-cell .gb-count{position:absolute;left:calc(5*var(--u));bottom:calc(2*var(--u));font:800 calc(15*var(--u))/1 'Baloo 2',sans-serif;color:#fff;-webkit-text-stroke:calc(3*var(--u)) #2a2435;paint-order:stroke fill}
    .iv-cell .gb-ref{position:absolute;right:calc(5*var(--u));top:calc(3*var(--u));font:800 calc(15*var(--u))/1 'Baloo 2',sans-serif;color:#ffd873;-webkit-text-stroke:calc(3*var(--u)) #2a2435;paint-order:stroke fill}
    .iv-cell .gb-shiny{position:absolute;left:calc(5*var(--u));top:calc(2*var(--u));font-style:normal;font-size:calc(16*var(--u));color:#dbe9ff;text-shadow:0 0 calc(6*var(--u)) #8fb8ff}
    .gb-copies{margin-top:calc(10*var(--u));padding:calc(8*var(--u)) calc(10*var(--u));border-radius:calc(12*var(--u));background:rgba(255,255,255,.05);font:400 calc(15*var(--u))/1.45 'Mitr',sans-serif;color:#9ca1c4}
    .gb-copies .h{color:#e9ecff;font-weight:600;margin-bottom:calc(4*var(--u))}
    .gb-copy{display:flex;align-items:center;gap:calc(8*var(--u));padding:calc(6*var(--u)) calc(8*var(--u));margin:calc(4*var(--u)) 0;border-radius:calc(10*var(--u));background:rgba(255,255,255,.04);border:calc(2*var(--u)) solid rgba(255,255,255,.08)}
    .gb-copy.on{border-color:rgba(255,215,120,.6);background:rgba(255,215,120,.08)}.gb-copy b{color:#e9ecff;font-weight:600}.gb-copy.sh b{color:#bcd6ff}
    .gb-rows{flex:1;min-width:0;display:flex;flex-direction:column}.gb-opt{font-size:calc(14*var(--u))}.gb-empty{opacity:.6;font-style:italic}
    .gb-btns{display:flex;flex-direction:column;gap:calc(4*var(--u))}.gb-btns .iv-btn{padding:calc(3*var(--u)) calc(10*var(--u));font-size:calc(14*var(--u));min-height:0;height:auto}
    .gb-worn{font-size:calc(14*var(--u));color:#ffd873;white-space:nowrap;font-weight:600}
    .gb-abil{margin-top:calc(8*var(--u));color:#ffe7a6;font:400 calc(15*var(--u))/1.45 'Mitr',sans-serif}`;
  document.head.appendChild(css);
})();
