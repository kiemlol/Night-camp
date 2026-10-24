/* inventory.js — the bag, MMO style. The user picked concept "K" (2026-09-29, "เอาเเบบนี้ครับ":
   assets/gen/nightcamp_mob_inv_raw.png): three windows over the game.
     ตัวละคร     the hero, big, among the worn slots (tab สวมใส่) or the costume slots (tab แฟชั่น); a strip of combat
                 numbers and a button to the status window (C)
     กระเป๋า     four tabs: อุปกรณ์ · แฟชั่น · ฟาร์ม (the life-skill tools, logs, ores, crops, seeds, fish) · อื่นๆ
                 (potions, monster materials). Only what the hero owns, the rest empty frames: no dark silhouettes (the
                 user: "ให้เขาไปลุ้นเอง"). A search box, sort (ชนิด / หายาก / เลเวล or ราคา), coins, sell-all at the merchant.
     รายละเอียด  the item picked (or pointed at): grade, level and job tags, its numbers, its outfit set, how it compares
                 with what is worn, and its buttons (สวมใส่ / ถอดออก, ใช้, ขาย at ลุงโกโก้, ล็อก; ตีบวก: not built yet)
   The costume layer: fashion items (rarity 'fashion': the onesies, the skins, the fashion hats) are worn in
   p.equip.fhat / p.equip.frobe, over the gear. The hero is drawn in them (the world, the portrait, the minimap, the
   others online) while the stats stay the gear's, plus the costume's own small bonus.
   It took the old collection screen's place (that dark window is gone from the page): I, the bag button and
   ?bag (?bag=farm: that tab) open this; B away from the merchant opens it on อื่นๆ (next to him B is still his shop).
   Locked materials are left out of every sale (they count as MAT.keep; shop.js asks NC.invLocked).
   Hooks: NC.HUD.init / panel, NC.equip / equipClass / gearStats / loadGear, NC.drawPlayer / drawHero / headSpot,
   NC.Net fields + hooks. Saved: the costume rides in p.equip (the gear save), the locks under nightcamp.inv.v1.
   Art: assets/inv/ (assets/gen/inv_icons.prompt.txt -> tools/cutout.py, see README). Load after the item, life and
   shop files, before game.js. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, MAT = NC.MATERIALS, FX = NC.FX;
  const $ = (id) => document.getElementById(id);
  if (NC.ASSET_MANIFEST_INV) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_INV);
  const G = () => NC.game;
  const icon = (id) => ((NC.ASSET_MANIFEST || {})[id] || {}).src || NC.matIcon(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => NC.fmtCoins(n);
  const sgn = (v) => (v > 0 ? '+' : '') + Math.round(v * 100) / 100;
  const pct = (v) => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';

  // ======================= the costume layer =======================
  const LOOK = { fhat: 'hat', frobe: 'robe' }; // costume key -> the gear slot it is drawn in place of
  const isFashion = (id) => !!(id && ITEMS[id] && ITEMS[id].rarity === 'fashion');
  const lookKey = (id) => (!isFashion(id) ? null : ITEMS[id].slot === 'hat' ? 'fhat' : ITEMS[id].slot === 'robe' ? 'frobe' : null);
  // an equip as it is drawn: the costume over the gear (the same object when nothing is worn over it)
  NC.lookEquip = function (equip) {
    if (!equip || (!equip.fhat && !equip.frobe)) return equip;
    const e = Object.assign({}, equip);
    for (const k in LOOK) if (equip[k]) e[LOOK[k]] = equip[k];
    return e;
  };
  const gearOnly = (equip) => { const e = Object.assign({}, equip); for (const k in LOOK) delete e[k]; return e; };

  // stats: the costume's own small bonus on top of the gear
  const baseGear = NC.gearStats;
  NC.gearStats = function (equip) {
    const st = baseGear.apply(this, arguments);
    for (const k in LOOK) {
      const it = equip && lookKey(equip[k]) === k && ITEMS[equip[k]];
      if (it && it.stats) for (const s in it.stats) st[s] = (st[s] || 0) + it.stats[s];
    }
    return st;
  };
  // a fashion item goes over the gear (the worn one again: off)
  const baseEquip = NC.equip;
  NC.equip = function (game, id) {
    const p = game.player, k = lookKey(id);
    if (!k) return baseEquip.apply(this, arguments);
    if (!p.owned.has(id) || !NC.itemReady(id)) return;
    if (NC.itemLvOk && !NC.itemLvOk(p, id)) { game.toast(`${ITEMS[id].name} ต้อง Base Lv ${ITEMS[id].lvReq} ขึ้นไป`); return; }
    p.equip[k] = p.equip[k] === id ? null : id;
    p.fresh.delete(id);
    NC.applyGear(game);
    FX.stars(p.x, p.y - 70, 10, NC.RARITY.fashion.rgb, { speed: 200, size: 0.8 });
    NC.saveGame(game);
  };
  // a fashion set (fashion.js) goes over the gear too
  const baseClass = NC.equipClass;
  NC.equipClass = function (game, cid) {
    const C = NC.CLASSES.find((c) => c.id === cid);
    if (!C || !C.fashion) return baseClass.apply(this, arguments);
    const p = game.player;
    for (const s in C.items) { const id = C.items[s], k = lookKey(id); if (k && NC.itemReady(id)) { p.owned.add(id); p.equip[k] = id; } }
    NC.applyGear(game);
    NC.saveGame(game);
  };

  // drawing: the world (the gear swapped for the costume while the hero is drawn, so the hat effects of hatfx.js follow
  // the hat that shows), and every other picture of the hero (previews, the portrait, the minimap, after-images, others)
  const baseDraw = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    const e = game.player && game.player.equip;
    if (!e || (!e.fhat && !e.frobe)) return baseDraw.apply(this, arguments);
    const was = { hat: e.hat, robe: e.robe };
    for (const k in LOOK) if (e[k]) e[LOOK[k]] = e[k];
    try { return baseDraw.apply(this, arguments); } finally { e.hat = was.hat; e.robe = was.robe; }
  };
  const baseHero = NC.drawHero;
  NC.drawHero = function (ctx, equip) {
    if (!equip || (!equip.fhat && !equip.frobe)) return baseHero.apply(this, arguments);
    const a = Array.prototype.slice.call(arguments);
    a[1] = NC.lookEquip(equip);
    return baseHero.apply(this, a);
  };
  const baseSpot = NC.headSpot;
  if (baseSpot) NC.headSpot = function (equip) { return baseSpot.call(this, NC.lookEquip(equip)); };
  // online: the others see the costume (a field of my presence, put on their copy of me)
  if (NC.Net) {
    NC.Net.fields.push({ key: 'lk', get: () => { const e = G().player.equip; return e.fhat || e.frobe ? [e.fhat || null, e.frobe || null] : null; } });
    NC.Net.hooks.push((r, pr) => {
      if (!r.equip) return;
      const lk = Array.isArray(pr.lk) ? pr.lk : [];
      r.equip.fhat = lookKey(lk[0]) === 'fhat' && NC.itemReady(lk[0]) ? lk[0] : null;
      r.equip.frobe = lookKey(lk[1]) === 'frobe' && NC.itemReady(lk[1]) ? lk[1] : null;
    });
  }

  // ======================= locked materials =======================
  const KEY = 'nightcamp.inv.v1';
  const locks = new Set(), keep0 = {}; // keep0: a material's own "keep" (the seeds), from before any lock
  NC.invLocked = (id) => locks.has(id);
  function setLock(id, on) {
    if (!MAT[id]) return;
    if (!(id in keep0)) keep0[id] = !!MAT[id].keep;
    if (on) locks.add(id); else locks.delete(id);
    MAT[id].keep = on || keep0[id]; // (the merchant's "sell all" leaves what is kept)
  }
  // online the page never saves (?fresh), so the locks went on every refresh (2026-10-19, Discord): there they are kept
  // per hero on this device under the key online/extras.js gives (NC.invLockKey, the lessons' own hero key)
  let lockKey = '';
  function saveLocks(game) {
    if (game.noSave && !lockKey) return;
    try { localStorage.setItem(lockKey || KEY, JSON.stringify({ v: 1, locks: [...locks] })); } catch (e) { /* storage blocked */ }
  }
  NC.invLockKey = (key) => {
    if (!key || key === lockKey) return;
    lockKey = key;
    let l = null;
    try { l = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { l = null; }
    for (const id of [...locks]) setLock(id, false);
    for (const id of (l && l.locks) || []) if (MAT[id]) setLock(id, true); // (the bag draws them the next time it renders)
  };

  // loading: the costume (from the gear save), fashion pieces worn in the gear slots moved over the gear (saves from
  // before the costume layer, ?equip=), the locks
  const baseLoad = NC.loadGear;
  NC.loadGear = function (game, params) {
    baseLoad.apply(this, arguments);
    const p = game.player;
    let s = null, l = null;
    if (!NC.ONLINE) {
      try { s = JSON.parse(localStorage.getItem('nightcamp.save.v1') || 'null'); } catch (e) { s = null; }
      try { l = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { l = null; }
    }
    const e = (s && s.equip) || {};
    for (const k in LOOK) p.equip[k] = lookKey(e[k]) === k && p.owned.has(e[k]) && NC.itemReady(e[k]) ? e[k] : null;
    for (const k in LOOK) {
      const id = p.equip[LOOK[k]];
      if (lookKey(id) === k) { if (!p.equip[k]) p.equip[k] = id; p.equip[LOOK[k]] = null; }
    }
    for (const id of [...locks]) setLock(id, false);
    for (const id of (l && l.locks) || []) if (MAT[id]) setLock(id, true);
    NC.applyGear(game);
    p.hp = p.maxHp; p.sp = p.maxSp;
  };

  // ======================= what the bag holds =======================
  // (คลัง: the camp storage at Uncle Coco, js/gearbag.js, the owner, 2026-10-08)
  const TABS = [['gear', 'อุปกรณ์', 'ic_sword'], ['fashion', 'แฟชั่น', 'inv_bow'], ['farm', 'ฟาร์ม', 'inv_sprout'], ['etc', 'อื่นๆ', 'ic_pouch'], ['store', 'คลัง', 'inv_lock']];
  // the worn slots round the hero: [key, label, column: L / R / B (the row under him)]
  const GEAR_SLOTS = [['hat', 'หมวก', 'L'], ['cape', 'ผ้าคลุม', 'L'], ['acc1', 'ประดับ 1', 'L'], ['acc2', 'ประดับ 2', 'L'],
    ['glasses', 'แว่น', 'R'], ['top', 'เสื้อ', 'R'], ['pants', 'กางเกง+รองเท้า', 'R'], ['weapon', 'อาวุธ', 'B'], ['shield', 'โล่', 'B']];
  const LOOK_SLOTS = [['hair', 'ทรงผม', 'L'], ['fhat', 'หมวกแฟชั่น', 'L'], ['frobe', 'ชุดแฟชั่น', 'R']];
  const SLOT_ITEMS = { hat: ['hat'], cape: ['cape'], acc1: ['acc'], acc2: ['acc'], glasses: ['glasses'], top: ['top', 'robe'], pants: ['pants'],
    weapon: ['weapon'], shield: ['shield'], hair: ['hair'], fhat: ['hat'], frobe: ['robe'] };
  const SLOT_LABEL = Object.assign({}, ...GEAR_SLOTS.concat(LOOK_SLOTS).map(([k, l]) => ({ [k]: l })), { top: 'เสื้อ / ชุดยาว' });
  const GROUP = ['weapon', 'shield', 'hat', 'glasses', 'top', 'robe', 'pants', 'cape', 'acc', 'hair']; // (no shoes: js/lowermerge.js)
  const OFFABLE = new Set(['hat', 'glasses', 'robe', 'cape', 'acc', 'shield']); // worn ones come off (the rest only change)
  const RANK = { legend: 4, epic: 3, rare: 2, fashion: 2, common: 1 };
  const TIER_RARITY = ['common', 'rare', 'epic', 'legend'];
  // the potions (the numbers of the 1 / 2 keys in entities.js, the prices of shop.js)
  // (three sizes of each since 2026-10-04: js/potions.js holds them)
  const POT = NC.POT ? Object.fromEntries(NC.POT.LIST.map((q, i) => [q.id, { name: q.name, key: q.key, stat: q.stat, icon: q.icon, hot: q.color === 'red' ? '1' : '2',
    price: q.price, what: q.what, color: q.color, size: q.size, order: i }])) : {
    red: { name: 'ยาแดง', key: 'potions', stat: 'hp', icon: 'ic_potion', hot: '1', price: 25, what: 'ฟื้น HP 25% (อย่างน้อย 30)' },
    blue: { name: 'ยาฟ้า', key: 'spPotions', stat: 'sp', icon: 'ic_sppotion', hot: '2', price: 40, what: 'ฟื้น SP 25% (อย่างน้อย 15)' },
  };
  const LIFE_KIND = [['เมล็ดพันธุ์', /^sd_/], ['ของจากการตกปลา', /^fs_/], ['อัญมณี', /^lf_(ruby|sapphire|emerald|topaz|amethyst)$/],
    ['แร่', /^lf_(stone|copper|quartz|iron|silver|moonsilver|soul|orange|obsidian|fireore|starore)$/],
    ['ผลผลิต', /^lf_(carrot|potato|wheat|herb|pumpkin|moonflower)$/], ['ของจากต้นไม้', /^lf_/]];
  const matKind = (id) => (MAT[id].kindTh ? 'อื่นๆ · ' + MAT[id].kindTh : MAT[id].life ? 'ฟาร์ม · ' + (LIFE_KIND.find((k) => k[1].test(id)) || ['วัตถุดิบ'])[0] : 'อื่นๆ · วัสดุจากมอนสเตอร์'); // (kindTh: a file's own word, cooking.js 'อาหาร')

  let itemOrder = null, matOrder = null;
  const orderOf = (id) => {
    if (!itemOrder) itemOrder = new Map((NC.ITEM_ORDER || []).map((x, i) => [x, i]));
    return itemOrder.has(id) ? itemOrder.get(id) : 1e6;
  };
  const matIdx = (id) => {
    if (!matOrder || !matOrder.has(id)) matOrder = new Map(Object.keys(MAT).map((x, i) => [x, i]));
    return matOrder.get(id);
  };
  const worn = (p, id) => !!id && Object.values(p.equip).includes(id);
  const tooLow = (p, id) => !!(NC.itemLvOk && !NC.itemLvOk(p, id));

  // one bag entry: k (its key), kind (item / mat / pot / tool), id, name, rarity, and what the sorting and badges use.
  // A gear piece (js/gearbag.js copies) is one cell per COPY, never a stack (the user, 2026-10-19: a white sword and a
  // green one picked up went into one cell): en.copy is that piece, its key c:<u> in the bag and z:<u> in the storage.
  function entry(kind, id, p, copy) {
    if (kind === 'i') {
      const it = ITEMS[id];
      if (!it) return null;
      const low = tooLow(p, id), W = it.slot === 'weapon' || it.slot === 'shield';
      const en = { k: copy ? 'c:' + copy.u : 'i:' + id, kind: 'item', id, it, name: it.name, rarity: NC.RARITY[it.rarity] ? it.rarity : 'common', rank: RANK[it.rarity] || 1,
        group: GROUP.indexOf(it.slot), val: it.lvReq || 0, order: orderOf(id), worn: copy ? copyWorn(p, copy) : worn(p, id), low,
        nojob: W && !low && NC.canWield && !NC.canWield(p, id), isNew: p.fresh.has(id), copy: copy || null };
      if (NC.invEntryHook) NC.invEntryHook(en, p); // (js/gradetier.js: a piece shows its own colour grade)
      return en;
    }
    if (kind === 's') { // a piece in the camp storage (copy), or a kind of them (the old saves' way: its pieces on the card)
      const it = ITEMS[id], n = copy ? 1 : ((p.store || []).filter((c) => c.id === id)).length;
      if (!it || !n) return null;
      const en = { k: copy ? 'z:' + copy.u : 's:' + id, kind: 'store', id, it, name: it.name, rarity: NC.RARITY[it.rarity] ? it.rarity : 'common', rank: RANK[it.rarity] || 1,
        group: GROUP.indexOf(it.slot), val: it.lvReq || 0, order: orderOf(id), n: copy ? undefined : n, copy: copy || null };
      if (copy && NC.invEntryHook) NC.invEntryHook(en, p);
      return en;
    }
    if (kind === 'm') {
      const M = MAT[id];
      if (!M) return null;
      return { k: 'm:' + id, kind: 'mat', id, M, name: M.name, rarity: M.rare ? 'legend' : 'common', rank: M.rare ? 4 : 1, group: 1,
        val: M.price || 0, order: matIdx(id), n: NC.matCount(p, id), img: NC.matIcon(id), isNew: !!(p.matNew && p.matNew.has(id)), locked: locks.has(id) };
    }
    if (kind === 'p') {
      const Q = POT[id];
      return Q && { k: 'p:' + id, kind: 'pot', id, Q, name: Q.name, rarity: 'common', rank: 1, group: 0, val: Q.price, order: Q.order !== undefined ? Q.order : id === 'red' ? 0 : 1, n: p[Q.key] || 0, img: icon(Q.icon) };
    }
    if (kind === 't') {
      const L = NC.Life, T = L && L.TOOLS[id];
      if (!T) return null;
      const tier = L.toolTier(p, id);
      return { k: 't:' + id, kind: 'tool', id, T, tier, name: T.names[tier - 1], rarity: TIER_RARITY[tier - 1], rank: tier, group: 0, val: tier,
        order: Object.keys(L.TOOLS).indexOf(id), img: L.lifeIcon(T.sprite(tier)) };
    }
    return null;
  }
  // the piece a c: / z: key names (online the server's bag is cloned anew with every snapshot: found by its uid)
  const copyOf = (p, k) => {
    const Gr = NC.GEAR, u = Number(k.slice(2));
    return (Gr && (k[0] === 'c' ? Gr.bag(p) : Gr.store(p)).find((c) => c.u === u)) || null;
  };
  const entryOf = (k, p) => {
    if (!k) return null;
    p = p || G().player;
    if (k[0] === 'c' || k[0] === 'z') { const c = copyOf(p, k); return c ? entry(k[0] === 'c' ? 'i' : 's', c.id, p, c) : null; }
    return entry(k[0], k.slice(2), p);
  };
  // this very piece is the one worn (not just its kind)
  const copyWorn = (p, c) => Object.keys(p.equip).some((k) => p.equip[k] === c.id && NC.GEAR.wornIn(p, k) === c);
  // the bag cell of what a worn slot holds: a gear piece's own copy, else its kind
  const cellKey = (p, slot, id) => {
    const Gr = NC.GEAR, c = Gr && Gr.isInst(id) && Gr.wornIn(p, slot === 'top' && p.equip.robe ? 'robe' : slot);
    return c ? 'c:' + c.u : 'i:' + id;
  };
  const newKey = (en) => (en.kind === 'item' ? 'i:' + en.id : en.k); // (NEW marks are per kind: p.fresh)
  const catOf = (it) => (it.rarity === 'fashion' || it.slot === 'hair' ? 'fashion' : 'gear');

  // everything in a tab (the filter and the search applied), sorted
  function entries(t, bare) {
    const p = G().player, out = [];
    let byKind = null; // item id -> its pieces in the bag
    if (t === 'gear' && NC.GEAR) {
      byKind = new Map();
      for (const c of NC.GEAR.bag(p)) if (NC.GEAR.isInst(c.id)) { const l = byKind.get(c.id); if (l) l.push(c); else byKind.set(c.id, [c]); }
    }
    if (t === 'gear' || t === 'fashion') {
      for (const id of p.owned) {
        const it = ITEMS[id];
        if (!it || it.slot === 'tool' || catOf(it) !== t || !NC.itemReady(id)) continue;
        if (!bare && filter && !filter.slots.includes(it.slot)) continue;
        const mine = byKind && byKind.get(id); // (gear pieces: a cell each)
        if (mine) for (const c of mine) out.push(entry('i', id, p, c));
        else out.push(entry('i', id, p));
      }
    } else if (t === 'store') {
      if (NC.GEAR) for (const c of NC.GEAR.store(p)) out.push(entry('s', c.id, p, c));
      else for (const id of new Set((p.store || []).map((c) => c.id))) out.push(entry('s', id, p));
    } else {
      if (t === 'farm' && NC.Life) for (const id in NC.Life.TOOLS) out.push(entry('t', id, p));
      if (t === 'etc') for (const id in POT) if (p[POT[id].key] > 0) out.push(entry('p', id, p));
      for (const id in MAT) if (NC.matCount(p, id) > 0 && !!MAT[id].life === (t === 'farm')) out.push(entry('m', id, p));
    }
    const q = bare ? '' : query.trim().toLowerCase();
    const list = out.filter((en) => en && (!q || en.name.toLowerCase().includes(q)));
    // by kind: gear by slot, then the best first; materials in the order they are made (wood, ores, gems, crops, seeds, fish;
    // the monsters' by level), which keeps each kind together
    // (pieces of one kind: the colour grade first, then the refine, then the oldest; they never swap places between draws)
    const piece = (a, b) => (a.copy && b.copy ? (b.copy.ref || 0) - (a.copy.ref || 0) || a.copy.u - b.copy.u : 0);
    const type = (a, b) => a.group - b.group || (a.kind === b.kind && a.kind !== 'item' ? a.order - b.order || b.rank - a.rank : b.rank - a.rank || b.val - a.val || a.order - b.order) || piece(a, b);
    list.sort(sort === 'rarity' ? (a, b) => b.rank - a.rank || type(a, b) : sort === 'value' ? (a, b) => b.val - a.val || b.rank - a.rank || type(a, b) : type);
    return list;
  }
  const hasNew = (t) => {
    const p = G().player;
    if (t === 'store') return false; // (nothing new arrives in the storage by itself)
    if (t === 'gear' || t === 'fashion') return [...p.fresh].some((id) => ITEMS[id] && ITEMS[id].slot !== 'tool' && catOf(ITEMS[id]) === t && p.owned.has(id));
    return !!p.matNew && [...p.matNew].some((id) => MAT[id] && !!MAT[id].life === (t === 'farm') && NC.matCount(p, id) > 0);
  };

  // ======================= the window =======================
  let win = null, heroCv = null, grid = null, detail = null, io = null, raf = 0;
  let tab = 'gear', ctab = 'gear', filter = null, query = '', sort = 'type', sel = null, hover = null;
  let shownNew = [], sellArmed = 0, tabArmed = 0, drunk = 0;
  const SORTS = { type: 'ชนิด', rarity: 'หายาก', value: 'เลเวล' };

  function build(game) {
    win = document.createElement('div');
    win.id = 'inv'; win.className = 'panel iv-panel'; win.hidden = true;
    win.innerHTML = '<div class="iv-wrap">' +
      '<section class="iv-win iv-char"><header class="iv-title"><span>ตัวละคร</span></header>' +
        '<div class="iv-tabs iv-tabs-s"><button data-ctab="gear">สวมใส่</button><button data-ctab="fashion">แฟชั่น</button></div>' +
        '<div class="iv-stage"><canvas id="iv-hero"></canvas><div class="iv-who" id="iv-who"></div>' +
          '<div class="iv-col L" id="iv-colL"></div><div class="iv-col R" id="iv-colR"></div><div class="iv-row" id="iv-rowB"></div>' +
          '<div class="iv-note" id="iv-note"></div></div>' +
        '<div class="iv-strip" id="iv-strip"></div></section>' +
      '<section class="iv-win iv-bag"><header class="iv-title"><span>กระเป๋า</span><button class="iv-x" id="iv-close" aria-label="ปิด">✕</button></header>' +
        '<div class="iv-tabs iv-tabs-b" id="iv-tabs"></div>' +
        '<div class="iv-find"><button class="iv-chip" id="iv-chip" hidden></button>' +
          '<label class="iv-search"><input id="iv-q" type="text" placeholder="ค้นหาชื่อ" maxlength="24" autocomplete="off"></label></div>' +
        '<div class="iv-grid" id="iv-grid"></div>' +
        `<div class="iv-foot"><span class="iv-coins"><img src="${NC.matIcon('ic_coin')}" alt=""><b id="iv-coins">0</b></span>` +
          '<span class="iv-count" id="iv-count"></span>' +
          `<button class="iv-btn blue" id="iv-sort"><img src="${icon('inv_sort')}" alt=""><span></span></button>` +
          '<button class="iv-btn gold" id="iv-sellall">ขายทั้งหมด</button><button class="iv-btn gold" id="iv-bulk" hidden>ขายหลายชิ้น</button></div></section>' +
      '<aside class="iv-detail" id="iv-detail"></aside></div>';
    document.body.appendChild(win);
    heroCv = $('iv-hero'); grid = $('iv-grid'); detail = $('iv-detail');

    $('iv-close').addEventListener('click', close); // (a click beside the windows does nothing: it closes only with ✕, I, B or Esc)
    win.querySelectorAll('[data-ctab]').forEach((b) => b.addEventListener('click', () => {
      ctab = b.dataset.ctab;
      if (filter) filter = null;
      if (tab === 'gear' || tab === 'fashion') setTab(ctab === 'fashion' ? 'fashion' : 'gear');
      render();
    }));
    $('iv-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { setTab(b.dataset.tab); filter = null; render(); } });
    $('iv-chip').addEventListener('click', () => { filter = null; render(); });
    $('iv-q').addEventListener('input', (e) => { query = e.target.value; renderGrid(); renderDetail(); });
    $('iv-sort').addEventListener('click', () => { const k = Object.keys(SORTS); sort = k[(k.indexOf(sort) + 1) % k.length]; renderGrid(); renderFoot(); });
    $('iv-sellall').addEventListener('click', (e) => sellTab(G(), e.currentTarget));
    const openCard = (k) => { sel = k; hover = null; grid.querySelectorAll('.iv-cell.sel').forEach((c) => c.classList.remove('sel')); renderDetail(); };
    $('iv-bulk').addEventListener('click', () => openCard(BULK));
    $('iv-count').addEventListener('click', () => { if (tab === 'gear' && NC.gearExpandCard) openCard(EXPAND); }); // (more room: js/gearbag.js)
    // the grid: a click picks, a double / right click puts on or uses; pointing shows it in the card
    grid.addEventListener('click', (e) => { const c = e.target.closest('[data-k]'); if (c) pick(c.dataset.k); });
    grid.addEventListener('dblclick', (e) => { const c = e.target.closest('[data-k]'); if (c) { pick(c.dataset.k); act('main'); } });
    grid.addEventListener('contextmenu', (e) => { e.preventDefault(); const c = e.target.closest('[data-k]'); if (c) { pick(c.dataset.k); act('main'); } });
    grid.addEventListener('mouseover', (e) => { const c = e.target.closest('[data-k]'), k = c ? c.dataset.k : null; if (k !== hover) { hover = k; renderDetail(); } });
    grid.addEventListener('mouseleave', () => { if (hover) { hover = null; renderDetail(); } });
    // the worn slots: a click shows that kind in the bag (and the worn one in the card); pointing shows it
    const stage = win.querySelector('.iv-stage');
    stage.addEventListener('click', (e) => {
      const w = e.target.closest('[data-wset]');
      if (w) { swapSet(G(), Number(w.dataset.wset)); return; }
      const s = e.target.closest('[data-slot]');
      if (s) slotClick(s.dataset.slot);
    });
    stage.addEventListener('mouseover', (e) => {
      const s = e.target.closest('[data-slot]'), id = s && slotItem(G().player, s.dataset.slot), k = id ? cellKey(G().player, s.dataset.slot, id) : null;
      if (k !== hover) { hover = k; renderDetail(); }
    });
    stage.addEventListener('mouseleave', () => { if (hover) { hover = null; renderDetail(); } });
    $('iv-strip').addEventListener('click', (e) => {
      if (e.target.closest('#iv-stats')) { const g = G(); g.paused = NC.HUD.panel('status', true); }
      if (e.target.closest('#iv-dye') && NC.Dye) NC.Dye.open(ctab === 'fashion' ? 'frobe' : 'outfit'); // (js/dye.js)
    });
    detail.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) act(b.dataset.act, b); });
  }

  // ---------------- open / close ----------------
  function opened(game, want) {
    if (want) setTab(want);
    hover = null; sellArmed = tabArmed = 0;
    render();
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function close() {
    const game = G();
    NC.HUD.panel('bag', false);
    if (game) game.paused = false;
  }
  function closed(game) {
    flushNew(game);
    query = ''; filter = null; hover = null;
    if ($('iv-q')) $('iv-q').value = '';
  }
  NC.invRefresh = () => { if (win && !win.hidden) render(); }; // (the open bag drawn again: the server's bag / storage came, js/online/gear.js)
  // a cell's entry by its key, a worn slot's cell key (js/chatlink.js: Shift + click links the item in the chat)
  NC.invEntryAt = (k) => entryOf(k);
  NC.invSlotKey = (key) => { const p = G().player, id = slotItem(p, key); return id ? cellKey(p, key, id) : null; };
  function setTab(t) {
    if (t === tab) return;
    flushNew(G());
    tab = t; sel = null;
    if (t === 'gear' || t === 'fashion') ctab = t;
  }
  // the NEW marks shown in a tab go when you leave it (or close the bag)
  function flushNew(game) {
    if (!game || !shownNew.length) return;
    const p = game.player;
    for (const k of shownNew) { if (k[0] === 'i') p.fresh.delete(k.slice(2)); else if (k[0] === 'm' && p.matNew) p.matNew.delete(k.slice(2)); }
    shownNew = [];
    NC.saveGame(game);
  }

  // ---------------- drawing the windows ----------------
  function render() {
    if (!win || win.hidden) return;
    fit();
    renderChar(); renderTabs(); renderGrid(); renderDetail(); renderFoot();
  }
  // a screen narrower than 16:9 (the HUD's --u follows the height there): the windows shrink to fit
  function fit() {
    const wrap = win.querySelector('.iv-wrap');
    wrap.style.transform = 'translateX(-50%)';
    const top = wrap.getBoundingClientRect().top;
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - top - 8) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translateX(-50%) scale(${k.toFixed(4)})`;
  }
  addEventListener('resize', () => setTimeout(() => { if (win && !win.hidden) { fit(); drawHero(); } }, 0)); // (after game.js sets --u)

  const slotItem = (p, key) => (key === 'top' && p.equip.robe ? p.equip.robe : p.equip[key] || null);
  function renderChar() {
    const game = G(), p = game.player;
    win.querySelectorAll('[data-ctab]').forEach((b) => b.classList.toggle('on', b.dataset.ctab === ctab));
    const cols = { L: $('iv-colL'), R: $('iv-colR'), B: $('iv-rowB') };
    for (const c in cols) cols[c].textContent = '';
    for (const [key, label, col] of ctab === 'fashion' ? LOOK_SLOTS : GEAR_SLOTS) {
      const id = slotItem(p, key), covered = !!p.equip.robe && (key === 'pants' || key === 'shoes');
      const b = document.createElement('button');
      b.className = 'iv-slot' + (covered ? ' covered' : '') + (filter && filter.key === key ? ' on' : '');
      b.dataset.slot = key;
      b.title = covered ? `${label} (อยู่ใต้ชุดยาว)` : id ? ITEMS[id].name : `${label}: ว่าง`;
      const box = document.createElement('span');
      const gk = id && NC.wornGradeKey ? NC.wornGradeKey(p, key === 'top' && p.equip.robe ? 'robe' : key) : null; // (the worn piece's colour key = its rarity, js/gradetier.js)
      box.className = 'iv-sbox ' + (id ? 'r-' + (gk || ITEMS[id].rarity) : 'empty');
      if (id) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 128;
        cv.getContext('2d').drawImage(NC.itemIcon(id, 128), 0, 0);
        box.appendChild(cv);
        if (NC.wornGems) box.insertAdjacentHTML('beforeend', NC.wornGems(p, key === 'top' && p.equip.robe ? 'robe' : key)); // (the piece's grade gems, js/gradetier.js)
      }
      const lbl = document.createElement('span');
      lbl.className = 'lbl';
      lbl.textContent = key === 'top' && p.equip.robe ? 'ชุดยาว' : label;
      b.append(box, lbl);
      if (key === 'weapon' && Array.isArray(p.wsets)) { // the two weapon sets (G)
        const w = document.createElement('span');
        w.className = 'iv-wset'; w.title = 'ชุดอาวุธ (G)';
        w.innerHTML = [0, 1].map((i) => `<i data-wset="${i}" class="${(p.wset || 0) === i ? 'on' : ''}">${i + 1}</i>`).join('');
        b.appendChild(w);
      }
      cols[col].appendChild(b);
    }
    const J = NC.JOBS[p.job] || NC.JOBS.traveler;
    $('iv-who').innerHTML = `<b>${esc(p.name || '')}</b><span>Lv ${p.lv} · ${esc(J.name)}</span>`;
    $('iv-note').textContent = ctab === 'fashion' ? 'ใส่ทับอุปกรณ์ · ค่าพลังยังมาจากอุปกรณ์ข้างใต้' : '';
    const d = p.d || {}, W = ITEMS[p.equip.weapon] || {}, avg = (r) => Math.round(((r && r[0]) || 0) / 2 + ((r && r[1]) || 0) / 2);
    const atk = W.magic ? `<span><b>MATK</b>${avg(d.matk)}</span>` : `<span><b>ATK</b>${(d.batk || 0) + avg(d.watk)}</span>`;
    $('iv-strip').innerHTML = atk + `<span><b>DEF</b>${d.def || 0}+${d.vdef || 0}</span><span><b>HIT</b>${d.hit || 0}</span><span><b>FLEE</b>${d.flee || 0}</span>` +
      `<button class="iv-btn blue" id="iv-stats" title="หน้าสถานะ (C)"><img src="${icon('inv_stats')}" alt="">สถานะ</button>` +
      (NC.Dye ? '<button class="iv-btn gold" id="iv-dye" title="ย้อมสีชุดและหมวก (แค่หน้าตา)">ย้อมสี</button>' : ''); // (js/dye.js)
    drawHero();
  }

  function renderTabs() {
    $('iv-tabs').innerHTML = TABS.map(([id, name, ic]) =>
      `<button data-tab="${id}" class="${id === tab ? 'on' : ''}"><img src="${icon(ic)}" alt=""><span>${name}</span>${hasNew(id) ? '<i class="iv-dot"></i>' : ''}</button>`).join('');
    const chip = $('iv-chip');
    chip.hidden = !filter;
    if (filter) chip.innerHTML = `${esc(filter.label)} <b>✕</b>`;
  }

  // icons are drawn when their cell comes into view (a tab can hold hundreds of weapons)
  const paint = (cv) => { if (cv.dataset.icon) { cv.getContext('2d').drawImage(NC.itemIcon(cv.dataset.icon, 128), 0, 0); delete cv.dataset.icon; } };
  // The cells stay between renders, one per entry key (a piece's own c:<uid>): an update of the open bag (a pickup, a
  // sale, a refine: NC.invRefresh) refills only the cells whose look changed and moves only those out of place, where it
  // rebuilt every button and canvas (2026-10-21: 35–190 ms a pickup with 100–200 pieces; inventory-cells.spec.mjs).
  const cells = new Map(); // entry key -> { el, sig }
  function cellLook(p, en) {
    let h = '', title = en.name;
    if (en.n !== undefined) h += `<b class="iv-n">${en.n > 9999 ? '9999+' : en.n}</b>`;
    if (en.kind === 'tool') h += `<b class="iv-n">${en.tier}/4</b>`;
    if (en.isNew) h += '<i class="iv-new">NEW</i>';
    if (en.copy && en.kind === 'item' && NC.copyName) title = NC.copyName(en.copy);
    if (en.worn) h += '<i class="iv-e" title="สวมอยู่">E</i>';
    if (en.low) h += `<i class="iv-lv">Lv ${en.it.lvReq}</i>`;
    if (en.nojob) h += '<i class="iv-nj" title="อาชีพนี้ใช้ไม่ได้">✕</i>';
    if (en.locked) h += `<img class="iv-lk" src="${icon('inv_lock')}" alt="" title="ล็อกไว้">`;
    if (NC.invBadge) h += NC.invBadge(p, en); // (js/gearbag.js: copies, refine, moonlit)
    const cls = `iv-cell r-${en.rarity}${en.k === sel ? ' sel' : ''}${en.worn ? ' worn' : ''}${en.low ? ' low' : ''}${en.nojob ? ' nojob' : ''}`;
    const pic = en.kind === 'item' || en.kind === 'store' ? 'cv:' + en.id : 'im:' + en.img;
    return { cls, title, h, pic, sig: [cls, title, h, pic].join('\u0001') };
  }
  function fillCell(c, en, look, i) {
    c.className = look.cls;
    c.dataset.k = en.k;
    if (en.kind === 'item') c.dataset.id = en.id; else delete c.dataset.id; // (the kind, whichever piece: js/lessons.js rings the gift by it)
    c.title = look.title;
    let pic = c.firstChild;
    if (!pic || pic.__pic !== look.pic) { // (the same picture is kept, painted or still waiting for its turn)
      if (pic && io) io.unobserve(pic);
      if (en.kind === 'item' || en.kind === 'store') {
        pic = document.createElement('canvas');
        pic.width = pic.height = 128; pic.dataset.icon = en.id;
        if (i < 40 || !io) paint(pic); else io.observe(pic);
      } else {
        pic = document.createElement('img');
        pic.src = en.img; pic.alt = ''; pic.draggable = false;
      }
      pic.__pic = look.pic;
      c.textContent = '';
      c.appendChild(pic);
    } else while (pic.nextSibling) pic.nextSibling.remove();
    if (look.h) c.insertAdjacentHTML('beforeend', look.h);
  }
  function renderGrid() {
    const p = G().player, list = entries(tab);
    if (!io && window.IntersectionObserver) io = new IntersectionObserver((es) => {
      for (const en of es) if (en.isIntersecting) { paint(en.target); io.unobserve(en.target); }
    }, { root: grid, rootMargin: '160px' });
    if (!CARDS[sel] && (!sel || !list.some((en) => en.k === sel))) sel = (list.find((en) => en.worn) || list[0] || {}).k || null; // (the worn one first)
    const view = [tab, filter ? filter.key : '', query, sort].join('|'), same = view === renderGrid.view;
    renderGrid.view = view;
    shownNew = shownNew.filter((k) => !list.some((en) => newKey(en) === k)).concat([...new Set(list.filter((en) => en.isNew).map(newKey))]);
    const keep = new Set(list.map((en) => en.k));
    let at = grid.firstChild;
    list.forEach((en, i) => {
      const look = cellLook(p, en);
      let cell = cells.get(en.k);
      if (!cell) cells.set(en.k, (cell = { el: document.createElement('button'), sig: null }));
      if (cell.sig !== look.sig) { fillCell(cell.el, en, look, i); cell.sig = look.sig; }
      // pass over a cell leaving the grid, or one in the way of the very next (it moves at its own turn): only the cells out
      // of place move, where every cell after a sold piece was taken out and put back (a restyle of the whole grid)
      while (at && at !== cell.el && at.dataset.k && (!keep.has(at.dataset.k) || at.nextSibling === cell.el)) at = at.nextSibling;
      if (cell.el === at) at = at.nextSibling;
      else grid.insertBefore(cell.el, at);
    });
    for (const [k, cell] of cells) if (!keep.has(k)) { // (a piece gone, or another tab's)
      if (io && cell.el.firstChild) io.unobserve(cell.el.firstChild);
      cell.el.remove();
      cells.delete(k);
    }
    // the empty cells after them, to a full row (at least 30)
    const empties = grid.querySelectorAll(':scope > .iv-cell.empty'), want = Math.max(30, Math.ceil(list.length / 5) * 5) - list.length;
    for (let i = empties.length; i < want; i++) {
      const c = document.createElement('div');
      c.className = 'iv-cell empty';
      grid.appendChild(c);
    }
    for (let i = want; i < empties.length; i++) empties[i].remove();
    // (the same list again, after putting something on: the cells stayed, so the grid keeps its scroll by itself; reading or
    // setting scrollTop here would lay the whole window out again, 6–7 ms with 200 pieces)
    if (!same) { grid.scrollTop = 0; const s = grid.querySelector('.iv-cell.sel'); if (s) grid.scrollTop = Math.max(0, s.offsetTop - grid.clientHeight / 2); }
    // (the gear tab counts the bag's room, the hero's own cap with the room bought: js/gearbag.js bagCap; the storage tab its own)
    const Gr = NC.GEAR, cnt = $('iv-count');
    if (Gr && Gr.used && tab === 'gear') {
      const n = Gr.used(p);
      const cap = Gr.bagCap ? Gr.bagCap(p) : Gr.BAG_MAX;
      cnt.textContent = `อุปกรณ์ ${n}/${cap}${Gr.nextSlotsPrice && Gr.nextSlotsPrice(p) ? ' ＋' : ''}`;
      cnt.classList.toggle('full', n >= cap);
      cnt.classList.add('more');
    } else if (Gr && Gr.store && tab === 'store') {
      cnt.textContent = `คลัง ${Gr.store(p).length}/${Gr.STORE_MAX}`;
      cnt.classList.toggle('full', Gr.store(p).length >= Gr.STORE_MAX);
    } else {
      cnt.textContent = list.length ? `${list.length} ชิ้น` : query ? 'ไม่พบ' : 'ยังว่างอยู่';
      cnt.classList.remove('full');
    }
    if (tab !== 'gear') cnt.classList.remove('more');
  }

  function renderFoot() {
    const game = G(), p = game.player;
    $('iv-coins').textContent = fmt(p.coins || 0);
    const sb = $('iv-sort');
    sb.querySelector('span').textContent = 'เรียง: ' + (sort === 'value' && (tab === 'farm' || tab === 'etc') ? 'ราคา' : SORTS[sort]);
    const sa = $('iv-sellall'), mats = tab === 'farm' || tab === 'etc';
    sa.hidden = !mats;
    if (mats && !tabArmed) sa.textContent = 'ขายทั้งหมด';
    $('iv-bulk').hidden = !(tab === 'gear' && NC.gearBulkCard); // (js/gearbag.js: many pieces at once)
  }

  // ---------------- the item card ----------------
  const elName = (el) => ((NC.ELEMENT_INFO || {})[el || 'neutral'] || { th: el || '-' }).th;
  const STAT = { def: 'DEF', mdef: 'MDEF', hp: 'HP สูงสุด', sp: 'SP สูงสุด', str: 'STR', agi: 'AGI', vit: 'VIT', int: 'INT', dex: 'DEX', luk: 'LUK', hit: 'HIT', flee: 'FLEE' };
  const FRAC = { crit: 'โอกาสคริติคอล', atk: 'พลังโจมตี', skill: 'พลังสกิล', cdr: NC.RO_TIME ? 'คูลดาวน์/ดีเลย์สกิล' : 'คูลดาวน์สกิล', spd: 'ความเร็วเดิน' };
  const STAT_ORDER = ['def', 'mdef', 'hp', 'sp', 'str', 'agi', 'vit', 'int', 'dex', 'luk', 'hit', 'flee', 'crit', 'atk', 'skill', 'cdr', 'spd'];
  const statText = (k, v) => (STAT[k] ? `${STAT[k]} ${sgn(v)}` : k === 'cdr' ? `${FRAC.cdr} ${v > 0 ? '-' : '+'}${Math.abs(Math.round(v * 100))}%` : FRAC[k] ? `${FRAC[k]} ${pct(v)}` : `${k} ${sgn(v)}`);
  const statKeys = (...ss) => STAT_ORDER.filter((k) => ss.some((s) => s && s[k])).concat(...ss.map((s) => Object.keys(s || {}).filter((k) => !STAT_ORDER.includes(k))));
  const BONUS = { hpPct: 'HP +%s%', vit: 'VIT +%s', aspd: 'ความเร็วโจมตี +%s%', crit: 'คริติคอล +%s%', matk: 'MATK +%s%', spPct: 'SP +%s%', hit: 'HIT +%s', dex: 'DEX +%s' };
  const bonusText = (m) => Object.keys(m || {}).map((k) => (BONUS[k] || k + ' +%s').replace('%s', m[k])).join(' · ');
  const gradeOf = (it) => (it.gs || it.sw || it.wc || it.of || {}).grade || 0;
  const jobName = (p) => (NC.JOBS[p.job] || NC.JOBS.traveler).name;
  const wtype = (it) => ((NC.WTYPES || {})[NC.wtypeOf ? NC.wtypeOf(it) : ''] || null);

  function typeText(it) {
    if (it.slot === 'weapon') { const T = wtype(it); return T ? `${T.name} · ${T.pair ? 'ถือคู่' : T.h === 1 ? 'มือเดียว' : 'สองมือ'}` : 'อาวุธ'; }
    if (it.rarity === 'fashion' && (it.slot === 'hat' || it.slot === 'robe')) return it.slot === 'hat' ? 'หมวกแฟชั่น' : 'ชุดแฟชั่น';
    return NC.SLOT_NAME[it.slot] || it.slot;
  }
  // why it can't be put on now ('' when it can)
  function whyNot(p, id) {
    const it = ITEMS[id];
    if (tooLow(p, id)) return `ต้อง Base Lv ${it.lvReq} (ตอนนี้ Lv ${p.lv})`;
    if (it.slot === 'weapon' && NC.canWield && !NC.canWield(p, id)) return `${jobName(p)}ใช้${(wtype(it) || { name: 'อาวุธนี้' }).name}ไม่ได้`;
    if (it.slot === 'shield') {
      if (NC.jobShield && !NC.jobShield(p.job)) return `${jobName(p)}ถือโล่ไม่ได้`;
      const W = wtype(ITEMS[p.equip.weapon] || {});
      if (W && W.h === 2 && p.equip.shield !== id) return `ถือ${W.name}อยู่ (สองมือ) ถือโล่ไม่ได้`;
    }
    return '';
  }
  // the worn item it would replace
  function rival(p, id) {
    const it = ITEMS[id], k = lookKey(id);
    if (k) return p.equip[k];
    if (it.slot === 'acc') return p.equip.acc1 || p.equip.acc2 || null;
    return p.equip[it.slot] || null;
  }
  function compareHtml(p, id, en) {
    const it = ITEMS[id];
    if (en && en.copy && !en.worn && worn(p, id)) return '<div class="iv-cmp"><div class="h">เทียบกับชิ้นที่สวมอยู่ (ชนิดเดียวกัน)</div>ค่าพลังพื้นฐานเท่ากัน · ต่างกันที่เกรด ออฟ และตีบวก</div>';
    if (worn(p, id)) return `<div class="iv-cmp now">✔ ${lookKey(id) ? 'ใส่ทับอยู่' : 'สวมอยู่'}</div>`;
    if (it.slot === 'hair') return '';
    const cur = rival(p, id), C = cur && ITEMS[cur], rows = [];
    if (it.slot === 'weapon' && it.dmg) {
      const d = Math.round((it.dmg[0] + it.dmg[1]) / 2 - (C && C.dmg ? (C.dmg[0] + C.dmg[1]) / 2 : 0));
      if (d) rows.push([d > 0, `ATK ${d > 0 ? '+' : ''}${d}`]);
    }
    const A = it.stats || {}, B = (C && C.stats) || {};
    for (const s of statKeys(A, B)) { const d = (A[s] || 0) - (B[s] || 0); if (Math.abs(d) > 1e-9) rows.push([d > 0, statText(s, d)]); }
    const vs = C ? esc(C.name) : 'ช่องที่ว่าง';
    if (!rows.length) return `<div class="iv-cmp"><div class="h">เทียบกับ ${vs}</div>ค่าพลังเท่ากัน</div>`;
    return `<div class="iv-cmp"><div class="h">เทียบกับ ${vs}</div>` +
      rows.slice(0, 6).map(([up, t]) => `<div class="${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${t}</div>`).join('') + '</div>';
  }
  function setHtml(p, it) {
    const OF = NC.OUTFITS, S = it.of && OF && OF.sets[it.of.set];
    if (!S) return '';
    const w = OF.setOf(p), on = !!w && w.S === S;
    const has = (iid) => (ITEMS[iid].slot === 'acc' ? NC.accWorn(p, iid) : p.equip[ITEMS[iid].slot] === iid);
    const pieces = ['top', 'pants'].map((s) => S.items[s]).concat([S.acc]).filter((iid) => ITEMS[iid]);
    return `<div class="iv-set"><div class="h">${esc(S.name)} <small>สาย${esc((OF.LINE[S.line] || {}).th || '')} · ขั้น ${S.grade}</small></div>` +
      pieces.map((iid) => `<div class="${has(iid) ? 'on' : ''}">${has(iid) ? '●' : '○'} ${esc(ITEMS[iid].name)}</div>`).join('') +
      `<div class="b ${on ? 'on' : ''}">ครบ 2 ชิ้น: ${bonusText(S.bonus[0])}</div><div class="b ${on && w.n >= 2 ? 'on' : ''}">ครบ 3 ชิ้น: ${bonusText(S.bonus[1])}</div></div>`;
  }

  function itemCard(p, en) {
    const id = en.id, it = en.it, R = NC.RARITY[en.rarity] || NC.RARITY[it.rarity] || NC.RARITY.common, grade = gradeOf(it), why = whyNot(p, id); // (en.rarity: a copy's colour grade, js/gradetier.js)
    const tags = [], main = [], lines = [];
    if (it.lvReq) tags.push(`<span class="iv-tag ${tooLow(p, id) ? 'bad' : 'lv'}">Lv ${it.lvReq}</span>`);
    if (it.slot === 'weapon') {
      const t = NC.wtypeOf ? NC.wtypeOf(it) : '', jobs = Object.keys(NC.JOB_WEAPONS || {}).filter((j) => NC.JOB_WEAPONS[j].includes(t) && NC.JOBS[j]).map((j) => NC.JOBS[j].name);
      if (jobs.length) tags.push(`<span class="iv-tag">อาชีพ: ${esc(jobs.join(' · '))}</span>`);
      if (it.dmg) main.push(`<div><b>ATK</b>${it.dmg[0]}–${it.dmg[1]}${it.magic ? ' <small>(เวท)</small>' : ''}</div>`);
      main.push(`<div><b>ธาตุ</b>${esc(elName(it.element))}</div>`);
      if (it.cd) main.push(`<div><b>ความเร็ว</b>${(1 / it.cd).toFixed(1)} ครั้ง/วิ</div>`);
      if (it.reach || it.range) main.push(`<div><b>ระยะ</b>${it.reach || it.range}</div>`);
      if (it.hitK && it.hitK !== 1) lines.push(`<div>พลังตีปกติ ×${it.hitK}</div>`);
      if (it.crit) lines.push(`<div>${statText('crit', it.crit)}</div>`);
      if (it.stun) lines.push('<div>ทำให้ศัตรูช้าลง</div>');
      const tier = NC.weaponTier ? NC.weaponTier(it) : 0;
      if (tier) lines.push(`<div class="fx">เอฟเฟกต์ตอนตี ระดับ ${tier}</div>`);
    } else if (it.slot === 'shield') tags.push('<span class="iv-tag">มือรอง</span>');
    if (it.of && NC.OUTFITS) tags.push(`<span class="iv-tag">สาย${esc((NC.OUTFITS.LINE[it.of.line] || {}).th || '')}</span>`);
    if (lookKey(id)) tags.push('<span class="iv-tag pink">ใส่ทับอุปกรณ์</span>');
    if (it.slot === 'robe' && it.element) main.push(`<div><b>ธาตุเกราะ</b>${esc(elName(it.element))}</div>`);
    const st = it.stats || {}, keys = statKeys(st).filter((k) => st[k]);
    for (const k of keys) (main.length < 4 && it.slot !== 'weapon' ? main : lines).push(`<div>${statText(k, st[k])}</div>`);
    if (!main.length) main.push(`<div class="dim">${it.slot === 'hair' ? 'ทรงผม · ไม่มีค่าพลัง' : 'ไม่มีค่าพลัง'}</div>`);
    const desc = it.of ? String(it.desc || '').split(' · ')[0] : it.desc;
    const on = en.worn, canOff = on && (OFFABLE.has(it.slot) || !!lookKey(id));
    const mainBtn = on ? (canOff ? '<button class="iv-btn blue" data-act="main">ถอดออก</button>' : '<button class="iv-btn blue" disabled>สวมอยู่</button>')
      : `<button class="iv-btn blue" data-act="main" ${why ? 'disabled' : ''}>สวมใส่</button>`;
    const refine = NC.invRefineBtn ? NC.invRefineBtn(p, id) : catOf(it) === 'gear' ? '<button class="iv-btn grey" disabled title="ระบบตีบวกยังไม่เปิด">ตีบวก</button>' : '';
    return (grade ? `<div class="iv-stars" title="เกรด ${grade} จาก 4">${'★'.repeat(grade)}<i>${'★'.repeat(4 - grade)}</i><span>เกรด ${grade}</span></div>` : '') +
      `<div class="iv-name" style="color:${R.color}">${esc(en.copy && NC.copyName ? NC.copyName(en.copy) : it.name)}</div>` +
      `<div class="iv-type"><b style="color:${R.color}">${esc(R.name)}</b>${esc(typeText(it))}</div>` +
      (tags.length ? `<div class="iv-tags">${tags.join('')}</div>` : '') +
      (why && !on ? `<div class="iv-why">${esc(why)}</div>` : '') +
      `<div class="iv-hero"><span class="iv-big r-${en.rarity}"><canvas data-big="${esc(id)}" width="256" height="256"></canvas></span><div class="iv-main">${main.join('')}</div></div>` +
      (lines.length ? `<div class="iv-lines">${lines.join('')}</div>` : '') +
      // (js/gearbag.js etc.: this piece's rows and buttons, abilities, set passive; en.copy: the piece the cell is)
      setHtml(p, it) + (NC.invCardExtra ? NC.invCardExtra(p, id, en.copy) : '') + compareHtml(p, id, en) +
      (desc ? `<div class="iv-desc">${esc(desc)}</div>` : '') +
      `<div class="iv-acts">${mainBtn}${refine}</div>` +
      `<div class="iv-hint">${refine && !NC.invRefineBtn ? 'ตีบวก: เร็ว ๆ นี้ · ' : ''}ดับเบิลคลิก / คลิกขวา = สวมใส่ หรือถอด</div>`;
  }

  const nearShop = (game) => { const S = NC.Shop; return !!(S && game && game.world && game.world.shop && game.player.dead <= 0 && NC.dist(game.player.x, game.player.y, S.npc.x, S.npc.y) < S.talk + 40); };
  function matCard(p, en) {
    const id = en.id, M = en.M, n = en.n, color = NC.RARITY[en.rarity].color, price = M.noNpc ? 0 : M.price || 0, lk = locks.has(id);
    const shop = nearShop(G()), can = shop && price > 0 && !lk && n > 0, from = NC.matSource ? NC.matSource(id) : '';
    const worth = (k) => (NC.Econ && NC.Econ.quote ? NC.Econ.quote(id, k, p) : k * price); // (what a sale of k pays, piece by piece: economy.js)
    const sellAll = sellArmed && sel === en.k ? `กดอีกครั้ง: ${fmt(worth(n))} เหรียญ` : `ขายหมด (${fmt(n)})`;
    return `<div class="iv-name" style="color:${color}">${esc(M.name)}</div>` +
      `<div class="iv-type"><b style="color:${color}">${M.rare ? 'หายาก' : 'ธรรมดา'}</b>${esc(matKind(id))}</div>` +
      (lk ? '<div class="iv-tags"><span class="iv-tag">ล็อกไว้</span></div>' : '') +
      `<div class="iv-hero"><span class="iv-big r-${en.rarity}"><img src="${en.img}" alt=""></span><div class="iv-main">` +
        `<div><b>มีอยู่</b>${fmt(n)} ชิ้น</div><div><b>ราคา</b>${price ? fmt(price) + ' / ชิ้น' : M.noNpc ? 'ลุงไม่รับซื้อ' : 'ขายไม่ได้'}</div>` +
        (price && n > 1 ? `<div><b>รวม</b>${fmt(worth(n))} เหรียญ</div>` : '') + '</div></div>' +
      (M.noNpc ? `<div class="iv-lines"><div class="src">${esc(M.npcNote || 'ใช้ที่ป๋าหมูหริ่ง หรือขายในร้านผู้เล่น')}</div></div>` : '') +
      (NC.matCardExtras ? NC.matCardExtras.map((f) => f(p, en) || '').join('') : '') + // (other files' lines and buttons: js/cooking.js)
      (from ? `<div class="iv-lines"><div class="src">ได้จาก: ${esc(from)}</div></div>` : '') +
      (/^sd_/.test(id) ? '<div class="iv-lines"><div class="src">ปลูกที่แปลงผักในฟาร์มหิ่งห้อย</div></div>' : '') +
      (M.desc ? `<div class="iv-desc">${esc(M.desc)}</div>` : '') +
      (price ? `<div class="iv-acts"><button class="iv-btn gold" data-act="sell1" ${can ? '' : 'disabled'}>ขาย 1</button>` +
        `<button class="iv-btn gold" data-act="sellall" ${can ? '' : 'disabled'}>${sellAll}</button></div>` : '') +
      `<div class="iv-acts"><button class="iv-btn dark" data-act="lock"><img src="${icon(lk ? 'inv_lock' : 'inv_unlock')}" alt="">${lk ? 'ปลดล็อก' : 'ล็อก'}</button></div>` +
      `<div class="iv-hint">${lk ? 'ของที่ล็อกไว้จะไม่ถูกขาย ทั้งขายทีละชิ้นและขายทั้งหมด' : price && !shop ? 'ขายได้ที่ร้านลุงโกโก้ กลางค่าย' : 'ล็อกไว้กันขายพลาด'}</div>`;
  }
  function potCard(p, en) {
    const Q = en.Q, full = Q.stat === 'hp' ? p.hp >= p.maxHp : p.sp >= p.maxSp;
    return `<div class="iv-name" style="color:${NC.RARITY.common.color}">${Q.name}</div><div class="iv-type"><b>ธรรมดา</b>อื่นๆ · ยา</div>` +
      `<div class="iv-hero"><span class="iv-big r-common"><img src="${en.img}" alt=""></span><div class="iv-main">` +
        `<div>${Q.what}</div><div><b>มีอยู่</b>${en.n} ขวด</div><div><b>ปุ่มลัด</b>${Q.hot}</div></div></div>` +
      `<div class="iv-lines"><div class="src">ร้านลุงโกโก้ขายขวดละ ${Q.price} เหรียญ · มอนก็ดรอป${NC.POT && Q.color ? ` · ดื่มครั้งนี้ได้ ${NC.POT.heal(p, NC.POT.DEF[en.id])}` : ''}</div></div>` +
      `<div class="iv-acts"><button class="iv-btn blue" data-act="main" ${full || p.dead > 0 ? 'disabled' : ''}>ใช้</button></div>` +
      (full ? `<div class="iv-hint">${Q.stat.toUpperCase()} เต็มอยู่แล้ว</div>` : '');
  }
  function toolCard(p, en) {
    const L = NC.Life, T = en.T, S = L.SKILLS[T.skill], lv = L.lvOf(p, T.skill), up = en.tier < 4 && (L.UPGRADES[en.id] || [])[en.tier - 1];
    const color = NC.RARITY[en.rarity].color;
    const need = up ? Object.keys(up.mats || {}).map((m) => { const have = NC.matCount(p, m);
      return `<div class="${have >= up.mats[m] ? 'on' : ''}">${esc((MAT[m] || {}).name || m)} ×${up.mats[m]} <small>(มี ${have})</small></div>`; }).join('') : '';
    return `<div class="iv-stars" title="ขั้น ${en.tier} จาก 4">${'★'.repeat(en.tier)}<i>${'★'.repeat(4 - en.tier)}</i><span>ขั้น ${en.tier}</span></div>` +
      `<div class="iv-name" style="color:${color}">${esc(en.name)}</div><div class="iv-type"><b style="color:${color}">เครื่องมือ</b>ฟาร์ม · ${esc(S ? S.name : '')}</div>` +
      `<div class="iv-hero"><span class="iv-big r-${en.rarity}"><img src="${en.img}" alt=""></span><div class="iv-main">` +
        `<div><b>${esc(S ? S.name : '')}</b>Lv ${lv}${L.rankOf ? ` <small>(${esc(L.rankOf(lv))})</small>` : ''}</div><div><b>ขั้น</b>${en.tier} / 4</div></div></div>` +
      (up ? `<div class="iv-set"><div class="h">ขั้นต่อไป: ${esc(T.names[en.tier])}</div><div class="${lv >= up.lv ? 'on' : ''}">ต้อง ${esc(S.name)} Lv ${up.lv}</div>` +
        `<div class="${(p.coins || 0) >= up.coins ? 'on' : ''}">${fmt(up.coins)} เหรียญ</div>${need}</div>` : '<div class="iv-lines"><div class="fx">ขั้นสูงสุดแล้ว</div></div>') +
      `<div class="iv-lines"><div class="src">อัปเกรดได้ที่ ${esc(T.mentor)}</div></div>` +
      '<div class="iv-acts"><button class="iv-btn blue" data-act="life">เปิดหน้าอาชีพเสริม (H)</button></div>';
  }
  // the cards that are not an entry (js/gearbag.js): ขายหลายชิ้น, and ขยายกระเป๋า (the gear tab's count)
  const BULK = '#bulk', EXPAND = '#expand';
  const CARDS = { [BULK]: ['gearBulkCard', 'gearBulkAct'], [EXPAND]: ['gearExpandCard', 'gearExpandAct'] };
  function storeCard(p, en) {
    const it = en.it, R = NC.RARITY[en.rarity] || NC.RARITY.common, c = en.copy;
    const kinds = c ? (NC.GEAR ? NC.GEAR.store(p).filter((x) => x.id === en.id).length : 1) : en.n;
    return `<div class="iv-name" style="color:${R.color}">${esc(c && NC.copyName ? NC.copyName(c) : it.name)}</div>` +
      `<div class="iv-type"><b style="color:${R.color}">${esc(R.name)}</b>${esc(typeText(it))} · ในคลัง</div>` +
      `<div class="iv-hero"><span class="iv-big r-${en.rarity}"><canvas data-big="${esc(en.id)}" width="256" height="256"></canvas></span>` +
        `<div class="iv-main"><div><b>ในคลัง</b>${fmt(kinds)} ชิ้น${c ? ' (ชนิดนี้)' : ''}</div></div></div>` +
      (NC.storeCard ? NC.storeCard(p, en.id, c) : '');
  }
  function renderDetail() {
    if (!detail) return;
    if (!hover && CARDS[sel] && NC[CARDS[sel][0]]) {
      detail.className = 'iv-detail';
      detail.innerHTML = NC[CARDS[sel][0]](G().player);
      return;
    }
    const p = G().player, en = entryOf(hover || (CARDS[sel] ? null : sel), p);
    if (!en || (en.kind === 'item' && !p.owned.has(en.id)) || (en.kind === 'mat' && en.n <= 0)) {
      detail.className = 'iv-detail';
      detail.innerHTML = tab === 'store' && NC.invStoreHint ? NC.invStoreHint() // (js/wcard.js: where to put in / take out)
        : '<div class="iv-empty"><b>เลือกของในกระเป๋า</b><span>ชี้หรือแตะที่ของเพื่อดูรายละเอียด<br>ดับเบิลคลิกหรือคลิกขวาเพื่อสวมใส่ / ใช้</span></div>';
      return;
    }
    const own = NC.invItemCard && (en.kind === 'item' || en.kind === 'store') ? NC.invItemCard(p, en, { setHtml, whyNot, typeText, OFFABLE }) : ''; // (js/wcard.js: a gear piece's card with the compare)
    if (own) {
      // the card is rebuilt on every press, hover and online bag update: the same piece keeps its scrolled body
      // (2026-10-19 Discord: the window jumped back to the top after a click)
      const piece = en.id + ':' + ((en.copy && en.copy.u) || ''), body = detail.querySelector('.wc-body');
      const top = body && detail.dataset.piece === piece ? body.scrollTop : 0;
      detail.className = 'iv-detail wc-card'; detail.innerHTML = own; detail.dataset.piece = piece;
      if (NC.invCardDone) NC.invCardDone(detail, en); // (js/chatlink.js: the แนบในแชท button)
      const nb = top && detail.querySelector('.wc-body');
      if (nb) nb.scrollTop = top;
      return;
    }
    detail.dataset.piece = '';
    detail.className = 'iv-detail rd-' + en.rarity; // (the frame's colour: rd-, not the r- fills)
    detail.innerHTML = en.kind === 'item' ? itemCard(p, en) : en.kind === 'store' ? storeCard(p, en) : en.kind === 'mat' ? matCard(p, en)
      : en.kind === 'pot' ? potCard(p, en) : toolCard(p, en);
    if (NC.invCardDone) NC.invCardDone(detail, en);
    const big = detail.querySelector('canvas[data-big]');
    if (big) big.getContext('2d').drawImage(NC.itemIcon(big.dataset.big, 256), 0, 0);
  }

  // ---------------- the hero, breathing in the middle ----------------
  function drawHero() {
    const game = G();
    if (!heroCv || !game || !game.player) return;
    const r = heroCv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (heroCv.width !== W || heroCv.height !== H) { heroCv.width = W; heroCv.height = H; }
    const c = heroCv.getContext('2d'), p = game.player, k = H / 250, fx = W / 2, fy = H * 0.77;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(42,36,53,0.16)';
    c.beginPath(); c.ellipse(fx, fy, 52 * k, 13 * k, 0, 0, Math.PI * 2); c.fill();
    const eq = ctab === 'fashion' ? NC.lookEquip(p.equip) : gearOnly(p.equip); // (the gear tab shows the gear under the costume)
    NC.drawAvatar(c, eq, fx, fy, k, 1, { t: performance.now() / 1000, idle: NC.Anim.movesFor(p.moves, ITEMS[p.equip.weapon]).idle });
  }
  function loop() {
    raf = 0;
    if (!win || win.hidden) return;
    drawHero();
    raf = requestAnimationFrame(loop);
  }

  // ---------------- doing things ----------------
  function pick(k) {
    const game = G(), p = game.player;
    if (sel !== k) { sel = k; sellArmed = 0; }
    grid.querySelectorAll('.iv-cell.sel').forEach((c) => c.classList.remove('sel'));
    const c = grid.querySelector(`[data-k="${CSS.escape(k)}"]`);
    if (c) c.classList.add('sel');
    const en = (k[0] === 'i' || k[0] === 'c') && entryOf(k, p); // (NEW is per kind: every piece of it loses the mark)
    if (en && p.fresh.delete(en.id)) grid.querySelectorAll(`[data-id="${CSS.escape(en.id)}"] .iv-new`).forEach((n) => n.remove());
    hover = null;
    renderDetail();
  }
  function slotClick(key) {
    const p = G().player, id = slotItem(p, key), t = LOOK_SLOTS.some((s) => s[0] === key) ? 'fashion' : 'gear';
    if (filter && filter.key === key) filter = null;
    else filter = { key, slots: SLOT_ITEMS[key] || [key], label: 'กรอง: ' + (SLOT_LABEL[key] || key) };
    setTab(t);
    if (id) sel = cellKey(p, key, id);
    render();
  }
  function act(a) {
    const game = G(), p = game.player;
    if (a === 'life') { game.paused = NC.HUD.panel('life', true); return; }
    if (CARDS[sel]) { const f = NC[CARDS[sel][1]]; if (f && f(game, a)) render(); return; } // (js/gearbag.js)
    const en = entryOf(sel, p);
    if (!en) { if (/^wc:coco/.test(a) && NC.invAct) NC.invAct(game, a, null); return; } // (the empty storage tab's walk button)
    if (NC.invAct && NC.invAct(game, a, en)) { render(); return; } // (js/gearbag.js: hold a copy, refine...)
    if (a === 'main') {
      if (en.kind === 'item') wear(game, en.id, en.worn ? null : en.copy); // (a piece not worn: this very piece goes on)
      else if (en.kind === 'pot') drink(game, en.id);
    } else if (a === 'sell1') sellMat(game, en.id, 1);
    else if (a === 'sellall') {
      if (performance.now() - sellArmed > 3000) { sellArmed = performance.now(); renderDetail(); return; } // a second click within 3 s sells
      sellArmed = 0;
      sellMat(game, en.id, Infinity);
    } else if (a === 'lock') { setLock(en.id, !locks.has(en.id)); saveLocks(game); }
    render();
  }
  function wear(game, id, copy) {
    const p = game.player, why = whyNot(p, id);
    if (why && !worn(p, id)) { game.toast(why); return; }
    if (NC.EquipUI) NC.EquipUI.accPick = filter && (filter.key === 'acc1' || filter.key === 'acc2') ? filter.key : null; // (acc.js: which accessory slot)
    try { if (copy && NC.GEAR && NC.GEAR.use) NC.GEAR.use(game, copy.u); else NC.equip(game, id); } // (js/gearbag.js: that copy in its slot)
    finally { if (NC.EquipUI) NC.EquipUI.accPick = null; }
  }
  function swapSet(game, i) {
    const p = game.player;
    if ((p.wset || 0) === i || !NC.swapWeapons) return;
    const was = game.paused;
    game.paused = false; p.wswapT = 0; // (swapping is refused while paused; the bag pauses the game)
    try { NC.swapWeapons(game); } finally { game.paused = was; }
    render();
  }
  function drink(game, kind) {
    const p = game.player, Q = POT[kind], now = performance.now();
    if (!Q || p.dead > 0 || !(p[Q.key] > 0) || now - drunk < 800) return; // (the game is paused: a real-time cooldown)
    const max = Q.stat === 'hp' ? p.maxHp : p.maxSp, cur = p[Q.stat];
    if (cur >= max) return;
    if (NC.POT && Q.color) { // this very size (js/potions.js); the cooldown counts in real time while the bag pauses the game
      if (p.cd) p.cd[Q.stat === 'hp' ? 'pot' : 'sppot'] = 0;
      if (!NC.POT.drink(game, p, Q.color, Q.size)) return;
      drunk = now;
      NC.HUD.log(`ใช้${Q.name} ${Q.stat.toUpperCase()} +${Math.round(p[Q.stat] - cur)}`, 'item');
      NC.saveGame(game);
      return;
    }
    const heal = Math.round(Math.min(Math.max(Q.stat === 'hp' ? 30 : 15, max * 0.25), max - cur));
    p[Q.stat] += heal; p[Q.key]--; drunk = now;
    if (p.cd) p.cd[Q.stat === 'hp' ? 'pot' : 'sppot'] = 0.8;
    FX.num(p.x, p.y - 150, '+' + heal, { fill: Q.stat === 'hp' ? '#8dff8a' : '#8fc8ff', size: 42 });
    NC.HUD.log(`ใช้${Q.name} ${Q.stat.toUpperCase()} +${heal}`, 'item');
    NC.saveGame(game);
  }
  function sellMat(game, id, n) {
    const p = game.player, M = MAT[id], have = NC.matCount(p, id);
    n = Math.min(n, have);
    if (!M || !(M.price > 0) || n <= 0 || M.noNpc || locks.has(id) || !nearShop(game)) return;
    const got = NC.Econ && NC.Econ.sell ? NC.Econ.sell(game, id, n) : n * M.price; // (piece by piece: economy.js; never the stones)
    p.mats[id] = have - n;
    if (!p.mats[id]) delete p.mats[id];
    p.coins += got;
    NC.HUD.log(`ขาย ${M.name} ×${n} ได้ ${fmt(got)} เหรียญ`, 'item');
    NC.saveGame(game);
  }
  // the footer's "sell all": what the tab shows (the search applies), never what is locked or kept (the seeds)
  function sellTab(game, btn) {
    const p = game.player;
    if (!nearShop(game)) { game.toast('ขายของได้ที่ร้านลุงโกโก้ กลางค่าย'); return; }
    const ids = entries(tab).filter((en) => en.kind === 'mat' && !MAT[en.id].keep && !MAT[en.id].noNpc && MAT[en.id].price > 0).map((en) => en.id);
    const value = (id) => (NC.Econ && NC.Econ.quote ? NC.Econ.quote(id, NC.matCount(p, id), p) : NC.matCount(p, id) * MAT[id].price);
    const n = ids.reduce((s, id) => s + NC.matCount(p, id), 0), got = ids.reduce((s, id) => s + value(id), 0);
    if (!n) { game.toast('ไม่มีของที่ขายได้ในหน้านี้ (ของที่ล็อกกับเมล็ดพันธุ์จะไม่ถูกขาย)'); return; }
    if (performance.now() - tabArmed > 3000) { // a second click within 3 s confirms
      tabArmed = performance.now();
      btn.textContent = `กดอีกครั้ง: ${fmt(got)} เหรียญ`;
      setTimeout(() => { if (performance.now() - tabArmed >= 3000) { tabArmed = 0; renderFoot(); } }, 3100);
      return;
    }
    tabArmed = 0;
    let paid = 0;
    for (const id of ids) { paid += NC.Econ && NC.Econ.sell ? NC.Econ.sell(game, id, NC.matCount(p, id)) : NC.matCount(p, id) * MAT[id].price; delete p.mats[id]; }
    p.coins += paid;
    NC.HUD.log(`ขายทั้งหมด ${fmt(n)} ชิ้น ได้ ${fmt(paid)} เหรียญ`, 'item');
    NC.saveGame(game);
    render();
  }

  // ======================= hooks into the HUD =======================
  // Online the old collection screen (#bag, NC.EquipUI in items.js: every class / boss / fashion set one click away)
  // never shows: no key or button opens it, yet on 2026-10-21 a player brought it up on the live site through the
  // browser's developer tools (the owner: "ทำไมมีคนเข้าหน้านี้ได้ด้วยอ่ะ"). Its clicks only change this screen (the server
  // refuses gear the hero does not own, and since server patch 034 a look of it too); here it stays hidden for good
  if (NC.ONLINE) {
    const css = document.createElement('style');
    css.textContent = '#bag{display:none!important}';
    document.head.appendChild(css);
  }
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    build(game);
    const b = document.querySelector('.menubar [data-panel="bag"]');
    if (b) b.title = 'กระเป๋า (I)';
    const li = [...document.querySelectorAll('#pause .keys li')].find((l) => /^I$/.test((l.querySelector('kbd') || {}).textContent || ''));
    if (li) li.innerHTML = '<kbd>I</kbd> กระเป๋า — อุปกรณ์ แฟชั่น (ใส่ทับชุด) ของฟาร์ม ของอื่นๆ · ดูตัวละครและของที่สวมอยู่ · ชี้ที่ของเพื่อดูรายละเอียด';
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    const game = G();
    // B away from the merchant: the bag on อื่นๆ (next to him: his shop, shop.js)
    const pouch = id === 'shop' && show !== false && !!game && !nearShop(game);
    if (!win && id === 'bag' && NC.ONLINE) return false; // (the old screen never stands in for this one online: above)
    if (win && (id === 'bag' || pouch)) {
      const want = pouch ? 'etc' : null, open = !win.hidden;
      const on = show === undefined ? !(open && (!want || tab === want)) : show;
      if (open && !on) closed(game);
      basePanel('pause', false); // closes every other window
      win.hidden = !on;
      if (on) opened(game, want);
      return on;
    }
    if (win && !win.hidden) { win.hidden = true; closed(game); }
    return basePanel(id, show);
  };
  // Esc closes the bag (instead of opening the menu over it)
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || !win || win.hidden) return;
    e.stopImmediatePropagation(); e.preventDefault();
    close();
  }, true);
})();
