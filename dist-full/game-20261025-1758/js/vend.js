/* vend.js — player shops, like classic MMOs' vending. In the camp, V (or the stall button, or /shop in the chat) opens the
   set-up window: pick up to 12 things from your bags (materials, potions, equipment you are not wearing), set how many
   and the price of each, name the shop, open it: the hero sits down with a sign over his head. Walking, attacking or a
   skill stands him up and closes the shop (clicks on the ground are held back meanwhile). Click a sign to see that shop
   and buy.
   Other players' shops come through net.js: the shop travels in the seller's presence ('sh': a counter, the name, the
   list); a purchase is a request in the buyer's presence ('bq') that the seller's game checks against the shop and the
   bags and answers ('ba'): the seller's side changes first (goods out, coins in), the buyer's on the answer (coins held
   meanwhile, back if the answer is no or none comes within 12 s).
   Three other adventurers keep shops by the campfire all the time — potions, second-hand gear, fashion — so there is
   always something to buy; their stock turns over every few minutes, and now and then they call out in the chat.
   Hooks: NC.Party.update / collect / drawTags (the shopkeepers among the characters, the signs), NC.HUD.init / update /
   panel (the windows, the menu button, the "shop open" pill), a capture-phase click on the signs, the V key. */
(function () {
  'use strict';
  const NC = window.NC, net = NC.Net, FX = NC.FX;
  const $ = (id) => document.getElementById(id);
  const MAT = NC.MATERIALS, ITEMS = NC.ITEMS;
  const LIMIT = 12, TITLE_MAX = 30, PRICE_MAX = 9999999, WAIT_MS = 12000, NEAR = 520, RESTOCK = 300;
  // the potions a shop can hold: the six of js/potions.js (ids red / blue are the small ones, as before)
  const POTS = NC.POT ? Object.fromEntries(NC.POT.LIST.map((q) => [q.id, { name: q.name, key: q.key, icon: q.icon, price: q.price, what: q.what, size: q.size }]))
    : { red: { name: 'ยาแดง', key: 'potions', icon: 'ic_potion', price: 25, what: 'ฟื้น HP 25%' }, blue: { name: 'ยาฟ้า', key: 'spPotions', icon: 'ic_sppotion', price: 40, what: 'ฟื้น SP 25%' } };
  const RARITY_PRICE = { common: 120, rare: 480, epic: 1500, legend: 6000, fashion: 2400 };
  const DRAFT_KEY = 'nightcamp.vend.v1';
  const fmt = (n) => (NC.fmtCoins ? NC.fmtCoins(n) : String(Math.floor(n)));
  const clean = (s, n) => (net ? net.clean(s, n) : String(s == null ? '' : s).trim().slice(0, n));
  const rnd = NC.rand, pick = (a) => a[Math.floor(Math.random() * a.length)];
  const coinSrc = () => (NC.matIcon ? NC.matIcon('ic_coin') : '');
  let game = null;

  // ---------------- what can be sold: materials, the two potions, equipment not being worn (never hair) ----------------
  // (more kinds of goods from other files: NC.VEND_KINDS[k] = { label, one, valid, name, sub, worth, suggest, icon, have,
  // take, give, list } — js/gearopts.js 'gear': a piece of gear sold whole with its option rows)
  const VK = (NC.VEND_KINDS = NC.VEND_KINDS || {});
  const one = (k) => k === 'item' || !!(VK[k] && VK[k].one); // (sold one at a time)
  // account-bound items (bound: true, the founder packs' founder: true, js/founder.js) are never sold, bought or traded:
  // not in a shopkeeper's stock, not in my shop, not in anyone's shop read from the net; the bag shows them locked
  const isBound = (NC.isBound = (id) => !!(ITEMS[id] && (ITEMS[id].bound || ITEMS[id].founder)));
  const BOUND_WHY = 'ของผูกบัญชี ขาย/แลกไม่ได้';
  const valid = (k, id) => typeof id === 'string' && (VK[k] ? VK[k].valid(id) : k === 'mat' ? !!MAT[id] : k === 'pot' ? !!POTS[id] : k === 'item' ? !!(ITEMS[id] && ITEMS[id].slot !== 'hair' && !ITEMS[id].inst && !isBound(id) && NC.itemReady(id)) : false);
  const nameOf = (k, id) => (VK[k] ? VK[k].name(id) : k === 'mat' ? MAT[id].name : k === 'pot' ? POTS[id].name : ITEMS[id].name);
  const worth = (k, id) => (VK[k] ? VK[k].worth(id) : k === 'mat' ? MAT[id].price : k === 'pot' ? POTS[id].price : RARITY_PRICE[ITEMS[id].rarity] || 300);
  const suggest = (k, id) => (VK[k] ? VK[k].suggest(id) : k === 'item' ? Math.round(worth(k, id) / 10) * 10 : Math.max(1, Math.round(worth(k, id) * 1.3)));
  function subOf(k, id) {
    if (VK[k]) return VK[k].sub(id);
    if (k === 'mat') return MAT[id].desc;
    if (k === 'pot') return POTS[id].what;
    const it = ITEMS[id], R = NC.RARITY[it.rarity] || {};
    return `${NC.SLOT_NAME[it.slot] || ''} · ${R.name || ''}`;
  }
  const icons = new Map();
  function iconOf(k, id) {
    if (VK[k]) return VK[k].icon(id);
    if (k === 'mat') return NC.matIcon(id);
    if (k === 'pot') return (NC.ASSET_MANIFEST[POTS[id].icon] || {}).src || '';
    if (!icons.has(id)) { try { icons.set(id, NC.itemIcon(id, 96).toDataURL()); } catch (e) { icons.set(id, ''); } }
    return icons.get(id);
  }
  const worn = (p, id) => Object.values(p.equip).includes(id);
  function have(p, k, id) {
    if (VK[k]) return VK[k].have(p, id);
    if (k === 'mat') return NC.matCount(p, id);
    if (k === 'pot') return p[POTS[id].key] || 0;
    return p.owned.has(id) && !worn(p, id) ? 1 : 0;
  }
  function take(k, id, n) {
    const p = game.player;
    if (VK[k]) return VK[k].take(game, id, n);
    if (k === 'mat') { p.mats[id] = NC.matCount(p, id) - n; if (p.mats[id] <= 0) delete p.mats[id]; }
    else if (k === 'pot') p[POTS[id].key] = Math.max(0, (p[POTS[id].key] || 0) - n);
    else { p.owned.delete(id); p.fresh.delete(id); }
  }
  function give(k, id, n) {
    const p = game.player;
    if (VK[k]) return VK[k].give(game, id, n);
    if (k === 'mat') NC.addMat(game, id, n);
    else if (k === 'pot') p[POTS[id].key] = (p[POTS[id].key] || 0) + n;
    else { p.owned.add(id); p.fresh.add(id); }
  }
  function bagOf(p, k) { // what I could put in a shop, by kind
    if (VK[k]) return VK[k].list(p);
    if (k === 'mat') return Object.keys(MAT).filter((id) => NC.matCount(p, id) > 0);
    if (k === 'pot') return Object.keys(POTS).filter((id) => (p[POTS[id].key] || 0) > 0);
    return [...p.owned].filter((id) => valid('item', id) && !worn(p, id));
  }
  // the bound items I carry (not worn): shown locked after the 'item' tab's goods, a click says why (the set-up window)
  const boundOf = (p) => [...p.owned].filter((id) => isBound(id) && ITEMS[id].slot !== 'hair' && NC.itemReady(id) && !worn(p, id));
  const toast = (t) => (game && game.toast ? game.toast(t) : NC.HUD.log(t, 'warn'));
  // a gear listing against the piece I wear (js/wcompare.js; mine = my own set-up bag): data-wc="up|down" for the
  // arrow and the verdict line, laid out by js/p3_vend.js
  const wcX = (k, id, mine) => (NC.WCmp && NC.WCmp.listed ? NC.WCmp.listed(game.player, k, id, mine) : null);
  const wcAttr = (k, id, mine) => { const x = wcX(k, id, mine), v = x == null ? '' : NC.WCmp.verdict(game.player, x); return v === 'up' || v === 'down' ? ` data-wc="${v}"` : ''; };
  const wcLine = (k, id) => { const x = wcX(k, id, false); return x == null ? '' : NC.WCmp.line(game.player, x); };

  // ---------------- my shop ----------------
  const mine = { open: false, title: '', items: [], ver: 0, earned: 0 };
  let draft = { title: '', items: [] }; // the set-up window's list, remembered between visits
  try { const s = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); if (s && Array.isArray(s.items)) draft = { title: String(s.title || ''), items: s.items.filter((L) => L && valid(L.k, L.id)).slice(0, LIMIT) }; } catch (e) { /* none */ }
  const saveDraft = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* storage blocked */ } };
  const here = () => !!(game && (game.mapId === 'camp' || (game.world && game.world.camp)));
  function openShop() {
    const p = game.player;
    if (!here()) { toast('ตั้งร้านได้ในค่ายกลางป่าเท่านั้นนะ'); return; }
    if (p.dead > 0) return;
    const items = draft.items.filter((L) => valid(L.k, L.id))
      .map((L) => ({ k: L.k, id: L.id, n: Math.min(Math.max(1, Math.floor(L.n) || 1), have(p, L.k, L.id)), price: Math.min(PRICE_MAX, Math.max(1, Math.floor(L.price) || 1)) }))
      .filter((L) => L.n > 0);
    if (!items.length) { toast('ใส่ของที่จะขายในร้านอย่างน้อย 1 อย่าง'); return; }
    // Opening a stall is an explicit choice to stay here. AUTO/travel otherwise
    // inject movement again between the online sit and open commands, so the
    // server rejects the shop (or closes it immediately).
    if (NC.QuestAuto && NC.QuestAuto.on) NC.QuestAuto.stop('');
    if (NC.Travel && NC.Travel.on) NC.Travel.stop('');
    if (NC.Auto && NC.Auto.on) NC.Auto.stop(game, 'ตั้งร้านขายของ');
    if (game.input) {
      game.input.mx = game.input.my = 0;
      game.input.attack = false;
    }
    if (NC.Rest && !p.sit) NC.Rest.sitDown(game);
    if (!p.sit) { toast('หยุดโจมตีก่อน แล้วค่อยตั้งร้าน'); return; }
    mine.open = true; mine.items = items; mine.ver++; mine.earned = 0;
    mine.title = clean(draft.title, TITLE_MAX) || `ร้านของ ${clean(p.name, 16) || 'ผู้เล่น'}`;
    NC.HUD.log(`เปิดร้าน "${mine.title}" แล้ว · ${items.length} รายการ · เดินเมื่อไหร่ร้านปิด`, 'level');
    FX.stars(p.x, p.y - 120, 12, '255,220,120', { speed: 200 });
    NC.HUD.panel('vend', false); game.paused = false;
    if (NC.Vend.onOpen) NC.Vend.onOpen(mine, game); // (?online: the server keeps the shop, js/online/market.js)
    if (net) net.send();
  }
  function closeShop(why) {
    if (!mine.open) return;
    mine.open = false; mine.ver++;
    if (NC.Vend.onClose) NC.Vend.onClose(mine, game);
    draft.items = mine.items.map((L) => Object.assign({}, L)); saveDraft();
    NC.HUD.log(`ปิดร้านแล้ว${why ? ` (${why})` : ''} · ขายได้ ${fmt(mine.earned)} เหรียญ`, 'item');
    if (net) net.send();
    render();
  }
  NC.Vend = {
    get open() { return mine.open; },
    setup() { if (game) game.paused = NC.HUD.panel('vend', true); },
    close: () => closeShop(),
    onOpen: null, onClose: null, // (js/online/market.js: fn(mine, game))
    buyOnline: null, // (js/online/market.js: fn(vendor, listing, n, say(text, kind)) buys from another player's shop)
    noKeepers: false, // (?online: no shopkeepers of our own by the fire)
    detail: (k, id) => detailOf(k, id), // (js/p3_vend.js: the picked row's details in someone's shop)
  };

  // ---------------- what a listing is, before buying it (the picked row in someone's shop) ----------------
  // (2026-10-20, the owner: "ไม่ดูรายละเอียดสินค้าก่อนกดซื้อไม่ได้": the row had only its name and one short line)
  const ST = { atk: 'ATK', matk: 'MATK', def: 'DEF', mdef: 'MDEF', hp: 'HP สูงสุด', sp: 'SP สูงสุด', str: 'STR', agi: 'AGI', vit: 'VIT', int: 'INT',
    dex: 'DEX', luk: 'LUK', hit: 'HIT', flee: 'FLEE', crit: 'คริติคอล', aspd: 'ความเร็วโจมตี', skill: 'พลังสกิล', spd: 'ความเร็วเดิน', cdr: 'คูลดาวน์/ดีเลย์สกิล' };
  const statsOf = (s) => Object.entries(s || {}).filter(([, v]) => typeof v === 'number' && v).map(([k, v]) => {
    const pct = Math.abs(v) < 1 && v !== Math.round(v), up = k === 'cdr' ? v < 0 : v > 0; // (cdr: a cut, shown as minus)
    return `${ST[k] || k} ${up ? '+' : '−'}${pct ? Math.round(Math.abs(v) * 100) + '%' : Math.abs(v)}`;
  });
  function detailOf(k, id) {
    try {
      if (!valid(k, id)) return '';
      const p = game && game.player, rows = [];
      const line = (label, text) => { if (text) rows.push(`<div class="vd-dl"><span>${esc(label)}</span><b>${text}</b></div>`); };
      let it = null, c = null;
      if (k === 'gear' && NC.gearDec) { c = NC.gearDec(id); it = c && ITEMS[c.id]; } else if (k === 'item') it = ITEMS[id];
      if (k === 'mat') {
        const M = MAT[id];
        if (M.desc) rows.push(`<div class="vd-dd">${esc(M.desc)}</div>`);
        line('ได้จาก', esc((NC.matSource && NC.matSource(id)) || ''));
      } else if (k === 'pot') {
        const q = POTS[id];
        line('ใช้แล้ว', esc(q.what || ''));
        if (p) line('มีอยู่', esc(fmt(p[q.key] || 0) + ' ขวด'));
      } else if (it) {
        const R = NC.RARITY[it.rarity] || {};
        const T = it.slot === 'weapon' && NC.WTYPES && NC.wtypeOf ? NC.WTYPES[NC.wtypeOf(it)] : null; // (the weapon's kind: ดาบ, ธนู...)
        line('ประเภท', esc([T ? T.name : NC.SLOT_NAME[it.slot] || (it.slot === 'tool' ? 'เครื่องมืออาชีพเสริม' : it.slot), R.name].filter(Boolean).join(' · ')));
        if (it.lvReq) line('ใส่ได้', `<span${p && p.lv < it.lvReq ? ' class="bad"' : ''}>Base Lv ${it.lvReq} ขึ้นไป</span>`);
        const Wc = it.gs || it.sw || it.wc; // (a catalog weapon's numbers: js/greatswords.js, swords.js, wcatalog.js)
        if (Wc && Wc.atk) line('พลังโจมตี', `ATK ${Wc.atk}`);
        if (it.slot === 'weapon' && it.element && it.element !== 'neutral') line('ธาตุ', esc(((NC.ELEMENT_INFO || {})[it.element] || { th: it.element }).th));
        const st = statsOf(it.stats);
        if (st.length) line('ค่าสถานะ', esc(st.join(' · ')));
        if (c && c.ref) line('ตีบวก', '+' + c.ref);
        if (c && NC.copyTag) line('เกรดขัด', NC.copyTag(c));
        if (it.abilText) line('ความสามารถ', esc(it.abilText));
        if (c && NC.rowsHtml && (c.rows && c.rows.length || c.taint)) rows.push(`<div class="vd-drows">${NC.rowsHtml(c)}</div>`);
        if (it.desc) rows.push(`<div class="vd-dd">${esc(it.desc)}</div>`);
      }
      line('ลุงโกโก้รับซื้อ', esc(fmt(worth(k, id)) + ' เหรียญ'));
      return rows.length ? `<div class="vd-detail">${rows.join('')}</div>` : '';
    } catch (e) { return ''; } // (an item the game doesn't know yet: no details)
  }

  // ---------------- trading with other players (net.js) ----------------
  let buying = null, reqSeq = 0;
  const expired = [], acks = [], lastReq = new Map();
  if (net) {
    net.fields.push({ key: 'sh', get: () => (mine.open ? [mine.ver, mine.title, mine.items.map((L) => [L.k, L.id, L.n, L.price])] : null) });
    net.fields.push({ key: 'bq', get: () => (buying ? [buying.seq, buying.to, buying.idx, buying.k, buying.id, buying.n, buying.price] : null) });
    net.fields.push({ key: 'ba', get: () => (acks.length ? acks.slice() : null) });
    // (the shop is read again only when it changed: online every snapshot came here, 20+ a second, and redrew the open
    // shop window each time; on a PC a click's press and release land on different buttons then and the click is lost:
    // "ในคอมไม่สามารถกดซื้อของในร้านค้าคนอื่นได้", 2026-10-20 — a tap on a phone was quick enough)
    net.hooks.push((r, pr, first) => {
      const key = JSON.stringify(pr.sh === undefined ? null : pr.sh);
      const changed = key !== r.shopKey;
      if (changed) { r.shopKey = key; r.shop = readShop(pr.sh); }
      if (first) r.vReq = Array.isArray(pr.bq) && typeof pr.bq[0] === 'number' ? pr.bq[0] : 0;
      else request(r, pr.bq);
      answer(r, pr.ba);
      if (changed && shownVendor === r) renderBuy();
    });
  }
  function readShop(sh) {
    if (!Array.isArray(sh) || !Array.isArray(sh[2])) return null;
    const items = [];
    sh[2].slice(0, LIMIT).forEach((e, i) => {
      if (!Array.isArray(e) || !valid(e[0], e[1])) return;
      const n = Math.floor(Number(e[2])), price = Math.floor(Number(e[3]));
      if (!(n >= 1 && n <= 9999) || !(price >= 1 && price <= PRICE_MAX)) return;
      items.push({ k: e[0], id: e[1], n: one(e[0]) ? 1 : n, price, i });
    });
    return { ver: Number(sh[0]) || 0, title: clean(sh[1], TITLE_MAX) || 'ร้านค้า', items };
  }
  // someone asks to buy from my shop: check it all, hand it over, answer
  function request(r, bq) {
    if (!Array.isArray(bq) || bq[1] !== net.me() || typeof bq[0] !== 'number') return;
    const seq = bq[0];
    if (seq <= (lastReq.has(r.peer) ? lastReq.get(r.peer) : r.vReq || 0)) return;
    lastReq.set(r.peer, seq);
    const [, , idx, k, id, n0, price] = bq, p = game.player;
    const reply = (ok, code) => { acks.push([r.peer, seq, ok ? 1 : 0, code || '']); while (acks.length > 4) acks.shift(); net.send(); };
    if (!mine.open) return reply(false, 'closed');
    const L = mine.items[idx];
    if (!L || L.k !== k || L.id !== id || L.price !== price) return reply(false, 'changed');
    const n = Math.floor(Number(n0));
    if (!(n >= 1) || n > L.n || n > have(p, k, id)) return reply(false, 'stock');
    take(k, id, n);
    L.n -= n;
    if (L.n <= 0) mine.items.splice(idx, 1);
    mine.ver++;
    const gross = price * n, got = NC.marketTax ? NC.marketTax(gross) : gross; // (the market's 5% tax: js/economy.js)
    p.coins += got; mine.earned += got;
    NC.HUD.log(`ขาย ${nameOf(k, id)} ×${n} ให้ ${r.name} ได้ ${fmt(got)} เหรียญ${got < gross ? ` (ภาษีตลาด ${fmt(gross - got)})` : ''}`, 'item');
    FX.stars(p.x, p.y - 150, 10, '255,220,120', { speed: 180, size: 0.8 });
    NC.saveGame(game);
    reply(true);
    if (!mine.items.length) closeShop('ขายหมดแล้ว!');
    render();
  }
  const WHY = { closed: 'ร้านปิดไปแล้ว', changed: 'ของในร้านเปลี่ยนไปแล้ว ลองดูใหม่อีกที', stock: 'ของไม่พอแล้ว' };
  // the seller's answer to my request (also a late one, after I gave up waiting)
  function answer(r, ba) {
    if (!Array.isArray(ba)) return;
    const me = net.me();
    for (const a of ba) {
      if (!Array.isArray(a) || a[0] !== me) continue;
      if (buying && buying.to === r.peer && a[1] === buying.seq) { settle(!!a[2], a[3]); continue; }
      const i = expired.findIndex((b) => b.to === r.peer && b.seq === a[1]);
      if (i >= 0) {
        const b = expired.splice(i, 1)[0];
        if (a[2]) { const p = game.player; p.coins = Math.max(0, p.coins - b.cost); give(b.k, b.id, b.n); NC.HUD.log(`ได้รับ ${nameOf(b.k, b.id)} ×${b.n} จาก ${b.name} (ตอบช้า) จ่าย ${fmt(b.cost)} เหรียญ`, 'item'); NC.saveGame(game); }
      }
    }
  }
  function settle(ok, code) {
    const b = buying, p = game.player;
    buying = null;
    if (ok) {
      give(b.k, b.id, b.n);
      NC.HUD.log(`ซื้อ ${nameOf(b.k, b.id)} ×${b.n} จาก ${b.name} จ่าย ${fmt(b.cost)} เหรียญ`, 'item');
      FX.stars(p.x, p.y - 80, 10, '255,236,160', { speed: 180, size: 0.8 });
      status('ซื้อแล้ว!', 'ok');
    } else {
      p.coins += b.cost;
      status(WHY[code] || 'ซื้อไม่สำเร็จ', 'warn');
    }
    NC.saveGame(game); if (net) net.send();
    renderBuy();
  }

  // ---------------- the adventurers who keep shops by the campfire ----------------
  const KEEPERS = [
    { name: 'มะลิยาดี', title: 'ยาแดง ยาฟ้า ถูกกว่าลุงอีก!', stock: 'pot', equip: { hair: 'hair_long', top: 'top_traveler', pants: 'pants_traveler', shoes: 'shoes_traveler', hat: 'hat_flower', weapon: 'staff' },
      calls: ['ยาแดงยาฟ้า ถูกกว่าร้านลุง แวะมาเลย~', 'ยาหมดก่อนไปล่ามอนไม่ได้นะ!'] },
    { name: 'IronPepper', title: 'อาวุธ ชุด หมวก มือสองสภาพดี', stock: 'gear', equip: { hair: 'hair_spiky', top: 'top_knight', pants: 'pants_knight', shoes: 'shoes_knight', hat: null, weapon: 'axe' },
      calls: ['ของมือสองสภาพดี ราคาคุยได้... ไม่ได้ 555', 'อาวุธดีๆ มีจำนวนจำกัด!'] },
    { name: 'ป้าจิ๋วแฟชั่น', title: 'ชุดแฟชั่นน่ารัก ของแท้ 100%', stock: 'fashion', equip: { hair: 'hair_curly', top: 'top_mage', pants: 'pants_mage', shoes: 'shoes_mage', hat: 'hat_wizard', weapon: 'staff' },
      calls: ['ชุดแฟชั่นใหม่มาแล้วจ้า~', 'ใส่แล้วน่ารักขึ้น 200%!'] },
  ];
  // spots round the plaza (camp.js: the fire at 1520,1470), clear of the benches, the merchant and the roads
  const SPOTS = (NC.CAMP_SPOT && NC.CAMP_SPOT.vend) || [[1960, 1420], [1700, 1190], [1880, 1740], [1110, 1300], [1300, 1800]]; // (camp.js: the big camp's market)
  let keepers = [], stockT = -1e9, callT = 20;
  function stockFor(K) {
    const p = game.player, out = [];
    const deal = (k, id, n, price) => out.push({ k, id, n, price: Math.max(1, Math.round(price)) });
    if (K.stock === 'pot') {
      // every size a little under the merchant's price (js/potions.js): lots of small ones, fewer big ones
      const N = { s: [20, 40], m: [10, 20], l: [4, 10] };
      for (const id in POTS) { const Q = POTS[id], n = N[Q.size || 's']; deal('pot', id, Math.round(rnd(n[0], n[1])), Q.price * rnd(0.84, 0.95)); }
    } else {
      const pool = Object.keys(ITEMS).filter((id) => valid('item', id) && !p.owned.has(id) && // (valid: never a bound / founder item)
        (K.stock === 'fashion' ? ITEMS[id].rarity === 'fashion' : ['common', 'rare', 'epic'].includes(ITEMS[id].rarity)));
      for (let i = 0; i < (K.stock === 'fashion' ? 4 : 5) && pool.length; i++) {
        const id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        deal('item', id, 1, (RARITY_PRICE[ITEMS[id].rarity] * rnd(0.9, 1.3)) / 10 * 10);
      }
      if (!out.length) { deal('pot', 'red', 10, POTS.red.price * 0.95); deal('pot', 'blue', 8, POTS.blue.price * 0.95); } // (all of it bought already)
    }
    for (const L of out) if (L.k === 'item') L.price = Math.round(L.price / 10) * 10;
    return out;
  }
  function placeKeepers() {
    const w = game.world;
    keepers = [];
    const used = [];
    for (const K of KEEPERS) {
      const at = SPOTS.find(([x, y]) => w.fits(x, y, 36) && !used.some(([ux, uy]) => Math.hypot(ux - x, uy - y) < 260));
      if (!at) continue;
      used.push(at);
      keepers.push({ kind: 'ally', keeper: true, bot: true, def: K, name: K.name, x: at[0], y: at[1], sort: at[1], face: at[0] > (NC.CAMP_SPOT ? 1500 : 1520) ? -1 : 1,
        equip: Object.assign({ robe: null, cape: null }, K.equip), anim: NC.Anim.makeState(), pose: null, hatS: {}, dead: 0, inv: 0, hurt: 0, vx: 0, sit: true,
        shop: { title: K.title, items: [] }, earned: 0, say: '', sayT: 0 });
    }
    stockT = -1e9;
  }
  function restock() {
    for (const a of keepers) a.shop.items = stockFor(a.def).map((L, i) => Object.assign(L, { i }));
    stockT = game.time;
  }
  function animateSitting(a, dt) {
    const A = NC.Anim, st = a.anim;
    A.setBase(st, 'sit', 0.01);
    A.update(st, dt, 1);
    const c = NC.animCtx(a.equip, { al: 0, walk: 0, moving: false, hurt: 0, idleStyle: 'idle', ready: 'ready' });
    const P = A.evaluate(st, c);
    P.face = a.face;
    NC.hatSpring(a.hatS, a.equip, P, 0, dt);
    a.pose = P;
  }

  // ---------------- the signs over the shops ----------------
  const vendors = () => {
    const out = here() ? keepers.slice() : [];
    if (net) for (const r of net.remotes.values()) if (r.shop && r.pose && r.map === game.mapId) out.push(r);
    return out;
  };
  function sign(ctx, who, title, own) {
    ctx.save();
    ctx.font = "600 20px 'Mitr', 'Leelawadee UI', sans-serif";
    const tw = Math.min(300, ctx.measureText(title).width), w = tw + 62, h = 42;
    const x = who.x - w / 2, y = who.y - (who.sit || who.st ? 186 : 236) - h, bob = Math.sin((game.time + who.x * 0.01) * 2) * 2;
    const yy = y + bob;
    // two ropes to a little bar above, the board, the coin
    ctx.lineWidth = 3; ctx.strokeStyle = '#5a3a24';
    ctx.beginPath(); ctx.moveTo(x + 18, yy); ctx.lineTo(who.x - 6, yy - 16); ctx.lineTo(x + w - 18, yy); ctx.stroke();
    ctx.beginPath(); NC.rrect(ctx, x, yy, w, h, 10);
    ctx.fillStyle = own ? '#a86a38' : '#8a5a34'; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
    ctx.beginPath(); NC.rrect(ctx, x + 5, yy + 5, w - 10, h - 10, 7);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,150,0.55)'; ctx.stroke();
    const coin = NC.SPR.ic_coin;
    if (coin) ctx.drawImage(coin.img, x + 10, yy + 7, 28, 28);
    ctx.fillStyle = '#fff3cf'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(title, x + 44, yy + h / 2 + 1, tw);
    ctx.restore();
    who.signRect = [x - 6, yy - 18, x + w + 6, yy + h + 6];
    who.signH = h + 30;
    who.signTop = y - 18; // (the ropes' top at the bob's highest: js/chat.js puts a chat bubble above it)
  }
  function bubble(ctx, text, x, y) {
    ctx.save();
    ctx.font = "500 20px 'Mitr', sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(380, ctx.measureText(text).width + 30), h = 40;
    ctx.beginPath(); NC.rrect(ctx, x - w / 2, y - h, w, h, 14);
    ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 9, y - 2); ctx.lineTo(x, y + 12); ctx.lineTo(x + 9, y - 2); ctx.closePath();
    ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.stroke();
    ctx.fillRect(x - 7, y - 6, 14, 6);
    ctx.fillStyle = NC.OUTLINE; ctx.fillText(text, x, y - h / 2 + 1, w - 20);
    ctx.restore();
  }
  function drawSigns(ctx) {
    const p = game.player;
    for (const a of keepers) {
      if (!here() || !a.pose) continue;
      if (NC.drawTag) NC.drawTag(ctx, a.name, a.x, a.y + 34, 20, '#ffffff');
      sign(ctx, a, a.shop.title, false);
      if (a.sayT > 0) bubble(ctx, a.say, a.x, a.y - 186 - (a.signH || 0) - 8);
    }
    if (net) for (const r of net.remotes.values()) {
      if (r.shop && r.pose && r.map === game.mapId) sign(ctx, r, r.shop.title, false);
      else { r.signRect = null; r.signH = 0; r.signTop = 0; }
    }
    if (mine.open && p.pose) sign(ctx, p, mine.title, true);
    else { p.signRect = null; p.signH = 0; p.signTop = 0; }
  }

  // ---------------- every frame ----------------
  function update(dt) {
    const p = game.player;
    if (mine.open && (!p.sit || !here() || p.dead > 0)) closeShop(p.dead > 0 ? 'หมดแรง' : !here() ? 'ออกจากค่าย' : 'ลุกเดินแล้ว');
    if (buying && Date.now() - buying.t > WAIT_MS) { // no answer: nothing happened, the coins come back
      const b = buying; buying = null;
      p.coins += b.cost; expired.push(b); if (expired.length > 8) expired.shift();
      status('ร้านไม่ตอบ ลองใหม่อีกครั้ง', 'warn');
      if (net) net.send();
      renderBuy();
    }
    if (!here() || NC.Vend.noKeepers) { if (keepers.length) keepers = []; return; }
    if (!keepers.length || keepers.world !== game.world) { placeKeepers(); keepers.world = game.world; }
    if (game.time - stockT > RESTOCK) restock();
    for (const a of keepers) {
      animateSitting(a, dt);
      if (a.sayT > 0) a.sayT -= dt;
      if (Math.abs(p.x - a.x) > 40 && Math.hypot(p.x - a.x, p.y - a.y) < 600) a.face = p.x < a.x ? -1 : 1;
    }
    if ((callT -= dt) <= 0 && keepers.length) { // a shopkeeper calls out now and then
      callT = rnd(40, 80);
      const a = pick(keepers);
      if (Math.hypot(p.x - a.x, p.y - a.y) < 1400) { a.say = pick(a.def.calls); a.sayT = 3.8; if (NC.Chat) NC.Chat.add({ ch: 'm', from: a.name, text: a.say, bot: true }); }
    }
  }
  const P = NC.Party;
  if (P) {
    const baseUpdate = P.update, baseCollect = P.collect, baseTags = P.drawTags;
    P.update = function (g, dt) { baseUpdate.call(P, g, dt); update(dt); };
    P.collect = function (list, visible) {
      baseCollect.call(P, list, visible);
      if (here()) for (const a of keepers) if (a.pose && visible(a.x - 120, a.y - 320, a.x + 120, a.y + 40)) list.push(a);
    };
    P.drawTags = function (ctx, g) { baseTags.call(P, ctx, g); drawSigns(ctx); };
  }

  // ---------------- the windows: set-up / my open shop (V), someone's shop (click a sign) ----------------
  let setupWin = null, buyWin = null, bagTab = 'mat', shownVendor = null, statusMsg = null;
  let boundMsg = null; // (a bound item clicked: why, in the set-up window's note for 5 s; the HUD toast is under the window)
  const qty = new Map(); // (buy window) how many of each listing
  function card(id, title) {
    const w = document.createElement('div');
    w.id = id; w.className = 'panel'; w.hidden = true;
    w.innerHTML = `<div class="card shop ${id}"><div class="ptitle"><span class="vd-t">${title}</span>` +
      `<span class="sh-coins"><img src="${coinSrc()}" alt=""><b class="vd-coins">0</b></span><button class="vd-x" aria-label="ปิด">✕</button></div>` +
      '<div class="vd-body"></div></div>';
    document.body.appendChild(w);
    w.querySelector('.vd-x').addEventListener('click', () => { NC.HUD.panel(id, false); game.paused = false; });
    return w;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function render() {
    if (!setupWin || setupWin.hidden) return;
    const p = game.player, body = setupWin.querySelector('.vd-body');
    setupWin.querySelector('.vd-coins').textContent = fmt(p.coins);
    if (mine.open) {
      setupWin.querySelector('.vd-t').textContent = 'ร้านของฉัน';
      body.innerHTML = `<div class="vd-open">ร้าน <b>${esc(mine.title)}</b> เปิดอยู่ · ขายได้แล้ว <em>${fmt(mine.earned)}</em> เหรียญ</div>` +
        '<div class="vd-list">' + (mine.items.map((L) => `<div class="vd-row"><img src="${iconOf(L.k, L.id)}" alt=""><div class="vd-name">${esc(nameOf(L.k, L.id))}<small>${esc(subOf(L.k, L.id))}</small></div>` +
          `<div class="vd-left">เหลือ <b>${L.n}</b></div><div class="sh-price"><img src="${coinSrc()}" alt="">${fmt(L.price)}</div></div>`).join('') || '<div class="vd-empty">ขายหมดแล้ว</div>') + '</div>' +
        '<div class="vd-foot"><span>ลุกเดิน (WASD) หรือกดปุ่มนี้เพื่อปิดร้าน · คนที่ออนไลน์คลิกป้ายเหนือหัวคุณเพื่อซื้อ</span><button class="big alt" data-act="close">ปิดร้าน</button></div>';
      return;
    }
    setupWin.querySelector('.vd-t').textContent = 'ตั้งร้านขายของ';
    const list = bagOf(p, bagTab), inShop = (k, id) => draft.items.some((L) => L.k === k && L.id === id);
    body.innerHTML = `<div class="vd-title"><label for="vd-name">ชื่อร้าน</label><input id="vd-name" maxlength="${TITLE_MAX}" autocomplete="off" placeholder="ร้านของ ${esc(clean(p.name, 16) || 'ผู้เล่น')}" value="${esc(draft.title)}"></div>` +
      '<div class="vd-wrap"><div class="vd-bag"><div class="sh-tabs">' +
      [['mat', 'วัสดุ'], ['pot', 'ยา'], ['item', 'อุปกรณ์']].concat(Object.keys(VK).map((k) => [k, VK[k].label])).map(([k, n]) => `<button data-bag="${k}" class="${k === bagTab ? 'on' : ''}">${n}</button>`).join('') +
      '<span class="sh-where">คลิกของเพื่อวางขาย</span></div><div class="sh-grid vd-grid">' +
      (list.map((id) => `<button class="sh-cell${inShop(bagTab, id) ? ' sel' : ''}" data-add="${esc(bagTab + ':' + id)}"${wcAttr(bagTab, id, true)} title="${esc(nameOf(bagTab, id) + (VK[bagTab] ? ' · ' + subOf(bagTab, id) : ''))}"><img src="${iconOf(bagTab, id)}" alt="">` +
        `${one(bagTab) ? '' : `<b>${have(p, bagTab, id)}</b>`}</button>`).join('') +
        (bagTab === 'item' ? boundOf(p).map((id) => `<button class="sh-cell bd" data-add="item:${id}" data-bd="1" title="${esc(ITEMS[id].name + ' · ' + BOUND_WHY)}" style="opacity:.55">` +
          `<img src="${iconOf('item', id)}" alt=""><i class="vd-bd">ผูกบัญชี</i></button>`).join('') : '') || // (bound: locked, a click says why)
        `<div class="vd-empty">${one(bagTab) ? 'ไม่มีอุปกรณ์ที่ไม่ได้สวมอยู่' : 'ไม่มีของ'}</div>`) +
      '</div></div><div class="vd-list"><div class="vd-h">ของในร้าน ' + draft.items.length + ' / ' + LIMIT + '</div>' +
      (draft.items.map((L, i) => `<div class="vd-row"><img src="${iconOf(L.k, L.id)}" alt=""><div class="vd-name">${esc(nameOf(L.k, L.id))}<small>${VK[L.k] ? esc(subOf(L.k, L.id)) + ' · ' : `มี ${have(p, L.k, L.id)} · `}ลุงรับซื้อ ${fmt(worth(L.k, L.id))}</small></div>` +
        `<div class="vd-qty">${one(L.k) ? '<span>1</span>' : `<button data-q="${i}:-1" aria-label="ลด">−</button><input data-qn="${i}" value="${L.n}" inputmode="numeric" aria-label="จำนวน"><button data-q="${i}:1" aria-label="เพิ่ม">+</button>`}</div>` +
        `<div class="vd-price"><img src="${coinSrc()}" alt=""><input data-pr="${i}" value="${L.price}" inputmode="numeric" aria-label="ราคา"></div>` +
        `<button class="vd-del" data-del="${i}" aria-label="เอาออก">✕</button></div>`).join('') || '<div class="vd-empty">ยังไม่มีของในร้าน · คลิกของในกระเป๋าทางซ้าย</div>') +
      '</div></div>' +
      (boundMsg && Date.now() - boundMsg.t < 5000 ? `<div class="vd-foot"><span class="vd-warn" style="color:#ff8a7a">${esc(boundMsg.text)}</span>` :
        '<div class="vd-foot"><span>ราคาตั้งต้น = ราคาที่ลุงโกโก้รับซื้อ +30% · ตั้งร้านได้ในค่ายกลางป่า · นั่งขายอยู่กับที่ ลุกเดินแล้วร้านปิด</span>') +
      `<button class="big" data-act="open" ${draft.items.length && here() ? '' : 'disabled'}>${here() ? 'เปิดร้าน' : 'ต้องอยู่ในค่ายกลางป่า'}</button></div>`;
  }
  function onSetupClick(ev) {
    const t = ev.target.closest('button');
    if (!t || t.disabled) return;
    const p = game.player;
    if (t.dataset.bag) { bagTab = t.dataset.bag; render(); return; }
    if (t.dataset.add) {
      const [k, id] = t.dataset.add.split(':');
      if (k === 'item' && isBound(id)) { // (account-bound: never in a shop; say why in the window)
        const text = `${ITEMS[id].name} เป็น${BOUND_WHY}`, at = (boundMsg = { text, t: Date.now() });
        toast(text); render(); setTimeout(() => { if (boundMsg === at) { boundMsg = null; render(); } }, 5000);
        return;
      }
      const at = draft.items.findIndex((L) => L.k === k && L.id === id);
      if (at >= 0) draft.items.splice(at, 1);
      else if (draft.items.length >= LIMIT) { toast(`ร้านหนึ่งวางขายได้ ${LIMIT} อย่าง`); return; }
      else draft.items.push({ k, id, n: one(k) ? 1 : Math.min(have(p, k, id), k === 'pot' ? 10 : have(p, k, id)), price: suggest(k, id) });
      saveDraft(); render(); return;
    }
    if (t.dataset.q) { const [i, d] = t.dataset.q.split(':').map(Number), L = draft.items[i]; if (L) { L.n = NC.clamp(L.n + d, 1, Math.max(1, have(p, L.k, L.id))); saveDraft(); render(); } return; }
    if (t.dataset.del) { draft.items.splice(Number(t.dataset.del), 1); saveDraft(); render(); return; }
    if (t.dataset.act === 'open') { readInputs(); openShop(); return; }
    if (t.dataset.act === 'close') closeShop();
  }
  function readInputs() {
    const p = game.player, nm = $('vd-name');
    if (nm) draft.title = clean(nm.value, TITLE_MAX);
    setupWin.querySelectorAll('[data-qn]').forEach((el) => { const L = draft.items[Number(el.dataset.qn)]; if (L) L.n = NC.clamp(Math.floor(Number(el.value)) || 1, 1, Math.max(1, have(p, L.k, L.id))); });
    setupWin.querySelectorAll('[data-pr]').forEach((el) => { const L = draft.items[Number(el.dataset.pr)]; if (L) L.price = NC.clamp(Math.floor(Number(String(el.value).replace(/[^0-9]/g, ''))) || 1, 1, PRICE_MAX); });
    saveDraft();
  }

  function status(text, kind) { statusMsg = { text, kind, t: Date.now() }; }
  // (the same html is not written again: every rewrite throws the buttons away, and a click pressed on one and released on
  // its new copy never happens — js/p3_vend.js lays out what is written here)
  let buyHtml = '';
  const setText = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
  // (and nothing new is written while a press on the window is held: a change that came in between the press and the
  // release (the status line, a count left, another buyer) threw the pressed button away and the click with it, 2026-10-20
  // Discord #150 recheck; it is written once the click is done, unless the click drew the window itself. A press held
  // over 1.5 s no longer waits)
  let pressT = 0, held = null;
  const pressing = () => pressT && performance.now() - pressT < 1500;
  const putBuy = (body, html) => {
    if (html === buyHtml && body.firstElementChild) { held = null; return; }
    if (pressing()) { held = [body, html]; return; }
    held = null; buyHtml = html; body.innerHTML = html;
  };
  const letGo = () => {
    if (!pressT) return;
    pressT = 0;
    setTimeout(() => { if (held && !pressing() && buyWin && !buyWin.hidden) putBuy(held[0], held[1]); }, 0); // (after the click)
  };
  function renderBuy() {
    if (!buyWin || buyWin.hidden || !shownVendor) return;
    const v = shownVendor, p = game.player, shop = v.shop;
    setText(buyWin.querySelector('.vd-coins'), fmt(p.coins));
    const body = buyWin.querySelector('.vd-body');
    if (!shop || (v.remote && !net.remotes.has(v.peer))) { putBuy(body, '<div class="vd-empty">ร้านนี้ปิดไปแล้ว</div>'); return; }
    setText(buyWin.querySelector('.vd-t'), shop.title);
    const wait = buying && buying.to === v.peer;
    const msg = statusMsg && Date.now() - statusMsg.t < 6000 ? statusMsg : null;
    putBuy(body, `<div class="vb-by">ร้านของ <b style="color:${v.color || '#fff3cf'}">${esc(v.name)}</b>${v.bot ? '' : ' · ผู้เล่นออนไลน์'}</div><div class="vd-list">` +
      (shop.items.map((L, j) => {
        const n = NC.clamp(qty.get(L.k + L.id) || 1, 1, L.n), cost = n * L.price, can = !wait && p.coins >= cost;
        return `<div class="vd-row" data-item="${esc(L.k + ':' + L.id)}"${wcAttr(L.k, L.id, false)}><img src="${iconOf(L.k, L.id)}" alt=""><div class="vd-name">${esc(nameOf(L.k, L.id))}<small>${esc(subOf(L.k, L.id))}</small>${wcLine(L.k, L.id)}</div>` +
          `<div class="vd-left">เหลือ <b>${L.n}</b></div><div class="sh-price"><img src="${coinSrc()}" alt="">${fmt(L.price)}</div>` +
          `<div class="vd-qty">${one(L.k) ? '<span>1</span>' : `<button data-bq="${j}:-1" aria-label="ลด">−</button><span>${n}</span><button data-bq="${j}:1" aria-label="เพิ่ม">+</button>`}</div>` +
          `<button class="vb-buy" data-buy="${j}" ${can ? '' : 'disabled'}>ซื้อ ${fmt(cost)}</button></div>`;
      }).join('') || '<div class="vd-empty">ขายหมดแล้ว</div>') + '</div>' +
      `<div class="vb-status ${msg ? msg.kind : ''}">${wait ? 'กำลังรอร้านตอบ…' : msg ? esc(msg.text) : v.bot ? 'ร้านของนักผจญภัย · ของเข้าใหม่ทุกไม่กี่นาที' : 'จ่ายเมื่ออีกฝ่ายยืนยัน · ถ้าไม่ตอบใน 12 วินาที เหรียญจะคืน'}</div>`);
  }
  function onBuyClick(ev) {
    const t = ev.target.closest('button');
    if (!t || t.disabled || !shownVendor || !shownVendor.shop) return;
    const v = shownVendor, items = v.shop.items;
    if (t.dataset.bq) { const [j, d] = t.dataset.bq.split(':').map(Number), L = items[j]; if (L) { qty.set(L.k + L.id, NC.clamp((qty.get(L.k + L.id) || 1) + d, 1, L.n)); renderBuy(); } return; }
    if (t.dataset.buy === undefined) return;
    const L = items[Number(t.dataset.buy)];
    if (!L) return;
    const n = NC.clamp(qty.get(L.k + L.id) || 1, 1, L.n), cost = n * L.price, p = game.player;
    if (p.coins < cost) { status('เหรียญไม่พอ', 'warn'); renderBuy(); return; }
    if (v.keeper) { // a shopkeeper of the camp: right away
      p.coins -= cost; give(L.k, L.id, n);
      L.n -= n; if (L.n <= 0) v.shop.items.splice(v.shop.items.indexOf(L), 1);
      NC.HUD.log(`ซื้อ ${nameOf(L.k, L.id)} ×${n} จาก ${v.name} จ่าย ${fmt(cost)} เหรียญ`, 'item');
      v.say = pick(['ขอบคุณที่อุดหนุนจ้า~', 'ของดีแน่นอน!', 'แวะมาใหม่นะ']); v.sayT = 3.5;
      FX.stars(p.x, p.y - 80, 10, '255,236,160', { speed: 180, size: 0.8 });
      status('ซื้อแล้ว!', 'ok'); NC.saveGame(game); renderBuy();
      return;
    }
    if (NC.Vend.buyOnline) { NC.Vend.buyOnline(v, L, n, (text, kind) => { status(text, kind); renderBuy(); }); return; }
    if (buying) return;
    p.coins -= cost; // held until the seller answers
    buying = { seq: ++reqSeq, to: v.peer, idx: L.i, k: L.k, id: L.id, n, price: L.price, cost, name: v.name, t: Date.now() };
    status('', ''); net.send(); renderBuy();
  }
  function showShop(v) {
    shownVendor = v; qty.clear(); statusMsg = null; buyHtml = ''; held = null; // (a shop opened is drawn afresh)
    game.paused = NC.HUD.panel('vbuy', true);
  }

  // ---------------- hooks into the HUD ----------------
  function stallIcon() { // the menu button's picture: a little sign with a coin
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d');
    g.lineWidth = 5; g.strokeStyle = '#5a3a24';
    g.beginPath(); g.moveTo(26, 30); g.lineTo(48, 12); g.lineTo(70, 30); g.stroke();
    g.beginPath(); NC.rrect(g, 8, 28, 80, 46, 10); g.fillStyle = '#a86a38'; g.fill(); g.lineWidth = 6; g.strokeStyle = NC.OUTLINE; g.stroke();
    const coin = NC.SPR.ic_coin;
    if (coin) g.drawImage(coin.img, 30, 32, 38, 38);
    g.beginPath(); NC.rrect(g, 20, 76, 56, 12, 5); g.fillStyle = '#6a4a30'; g.fill(); g.lineWidth = 4; g.stroke();
    return c.toDataURL();
  }
  let pill = null;
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (g) {
    baseInit(g);
    game = g;
    setupWin = card('vend', 'ตั้งร้านขายของ');
    buyWin = card('vbuy', 'ร้านค้า');
    setupWin.addEventListener('click', onSetupClick);
    setupWin.addEventListener('change', () => readInputs());
    setupWin.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { readInputs(); render(); } });
    buyWin.addEventListener('click', onBuyClick);
    buyWin.addEventListener('pointerdown', () => { pressT = performance.now(); }, true);
    for (const ev of ['pointerup', 'pointercancel', 'blur']) addEventListener(ev, letGo, true);
    const bar = document.querySelector('.menubar'), gear = bar && bar.querySelector('[data-panel="pause"]');
    if (bar) {
      const b = document.createElement('button');
      b.className = 'mbtn'; b.title = 'ตั้งร้านขายของ (V)';
      b.innerHTML = `<img src="${stallIcon()}" alt=""><b>V</b>`;
      b.addEventListener('click', () => { game.paused = NC.HUD.panel('vend'); });
      bar.insertBefore(b, gear || null);
    }
    pill = document.createElement('button');
    pill.className = 'vend-pill'; pill.hidden = true;
    pill.addEventListener('click', () => { game.paused = NC.HUD.panel('vend', true); });
    $('hud').appendChild(pill);
    const keys = document.querySelector('#pause .keys');
    if (keys) {
      const li = document.createElement('li');
      li.innerHTML = '<kbd>V</kbd> ตั้งร้านขายของในค่าย (วัสดุ ยา อุปกรณ์) · คลิกป้ายเหนือหัวร้านอื่นเพื่อซื้อ · <kbd>Enter</kbd> แชท (/help ดูคำสั่ง)';
      keys.insertBefore(li, keys.lastElementChild);
    }
  };
  let pillText = '';
  const baseHud = NC.HUD.update.bind(NC.HUD);
  NC.HUD.update = function (g) {
    baseHud(g);
    if (!pill) return;
    const t = mine.open ? `ร้าน "${mine.title}" เปิดอยู่ · ขายได้ ${fmt(mine.earned)} เหรียญ` : '';
    if (t !== pillText) { pillText = t; pill.textContent = t; pill.hidden = !t; }
    if (buyWin && !buyWin.hidden && (buying || statusMsg)) renderBuy();
    if (held && !pressing() && buyWin && !buyWin.hidden) putBuy(held[0], held[1]); // (a release that never came: written anyway)
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (id === 'vend' || id === 'vbuy') {
      const el = id === 'vend' ? setupWin : buyWin, on = show === undefined ? el.hidden : show;
      basePanel('pause', false); // closes every other window
      setupWin.hidden = true; buyWin.hidden = true;
      el.hidden = !on;
      if (on) { if (id === 'vend') { bagTab = 'mat'; render(); } else renderBuy(); }
      else if (id === 'vbuy') { shownVendor = null; buyHtml = ''; held = null; }
      return on;
    }
    if (setupWin) { setupWin.hidden = true; buyWin.hidden = true; shownVendor = null; buyHtml = ''; held = null; }
    return basePanel(id, show);
  };

  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyV' || e.repeat || !game || !game.player) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    game.paused = NC.HUD.panel('vend');
  });
  // a click on a sign (or the shopkeeper) opens that shop; while my shop is open, other clicks on the ground are held
  // back (a click would stand me up and close it)
  addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !game || !game.player || e.target !== $('view')) return;
    const wx = game.cam.x + (e.clientX * game.dpr) / game.scale, wy = game.cam.y + (e.clientY * game.dpr) / game.scale, p = game.player;
    const hit = vendors().find((v) => (v.signRect && wx >= v.signRect[0] && wx <= v.signRect[2] && wy >= v.signRect[1] && wy <= v.signRect[3]) ||
      (Math.abs(wx - v.x) < 55 && wy > v.y - 170 && wy < v.y + 16));
    const mineHit = mine.open && p.signRect && wx >= p.signRect[0] && wx <= p.signRect[2] && wy >= p.signRect[1] && wy <= p.signRect[3];
    if (hit) {
      e.stopImmediatePropagation(); e.preventDefault();
      if (Math.hypot(hit.x - p.x, hit.y - p.y) > NEAR) { toast('เดินเข้าไปใกล้ร้านก่อนนะ'); return; }
      showShop(hit);
    } else if (mineHit) {
      e.stopImmediatePropagation(); e.preventDefault();
      game.paused = NC.HUD.panel('vend', true);
    } else if (mine.open) {
      e.stopImmediatePropagation(); e.preventDefault();
      toast('ร้านเปิดอยู่ · เดิน (WASD) หรือกด V เพื่อปิดร้าน');
    }
  }, true);
})();
