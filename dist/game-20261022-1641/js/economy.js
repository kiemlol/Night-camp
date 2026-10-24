/* economy.js — money in and money out (the Game Bible, pillar 3: "ต้องรู้ว่าเงินเกิดจากไหน และหายออกทางไหน").
     ราคาลอยตัว     what ลุงโกโก้ pays for a material falls once a lot of it was sold today: full price for the first 400,
                   then down to 40% at 3,400; it is back to full every morning (the base price stays in MAT[id].base)
     ตลาดรับซื้อ    five materials a week are bought at x1.5 (the same five for everyone, by the week's number)
     ภาษีตลาด       5% of what a player shop sells (vend.js reads NC.marketTax)
     นายหน้า        ฝากขาย at ลุงโกโก้'s: a material at your own price (up to 3x its base); 1% of the listing is paid up front,
                   5% of each sale; buyers come over time (and while you are away) — the nearer the price to the base, the
                   sooner. Up to 5 listings
     ลูกไฟนำทาง     travel to any map you have been to, from anywhere: 200 coins + 30 per level of the map (a set may make
                   it cheaper or free a few times a day: js/setfx.js)
     ของสวมใส่      gear sold to the merchant or the forge: full price for the day's first 15 pieces, then 1/40 less a piece
                   down to 20% (the owner, 2026-10-07, the endgame balance audit: below)
   the ledger     coins made and spent by kind, per day (NC.Econ.faucet / sink), kept for the balance pass
   The market page (J → ตลาด) shows today's prices, the week's buys, the broker and the shops open online (vend.js).
   Saved: nightcamp.econ.v1. Hooks: MAT prices (every 2 s), a 1 s poll (sales at the merchant: materials gone and coins
   up while standing by him), NC.Hub pages.
   The balance round of 2026-10-04 closed the leaks: a sale is priced piece by piece (NC.Econ.quote / sell, used by every
   NPC that buys: shopwin.js, inventory.js, shop.js, life_farm.js, life_fish.js), the stones are not the merchant's
   (MAT.noNpc), the broker's buyers weigh the price against today's market and their buys count in the day's drop, and
   the bosses' and chests' waits are kept across a reload (st.cd). */
(function () {
  'use strict';
  const NC = window.NC, MAT = NC.MATERIALS, H = NC.Hub;
  if (!H || !MAT) return;
  const esc = H.esc, fmt = (n) => NC.fmtCoins(n), KEY = 'nightcamp.econ.v1';
  const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  const weekNo = () => Math.floor((Date.now() / 86400000 + 3) / 7);
  let st = { day: today(), sold: {}, gearSold: 0, ledger: {}, broker: [], visited: {}, warpsUsed: 0, warpDay: 0 };
  try { if (!NC.ONLINE) st = Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* blocked */ }
  const save = () => { if (NC.game && NC.game.noSave) return; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* blocked */ } };
  for (const id in MAT) if (MAT[id].base === undefined) MAT[id].base = MAT[id].price;

  // ---------------- the ledger ----------------
  const led = () => { const d = today(); if (!st.ledger[d]) { st.ledger[d] = { in: {}, out: {} }; const keys = Object.keys(st.ledger).sort(); while (keys.length > 14) delete st.ledger[keys.shift()]; } return st.ledger[d]; };
  const Econ = (NC.Econ = {
    faucet(kind, n) { if (n > 0) { const L = led(); L.in[kind] = (L.in[kind] || 0) + n; } },
    sink(kind, n) { if (n > 0) { const L = led(); L.out[kind] = (L.out[kind] || 0) + n; } },
    state: st,
  });

  // ---------------- prices ----------------
  const monMats = Object.keys(MAT).filter((id) => /^mat_/.test(id) && !MAT[id].rare && MAT[id].base > 0 && id !== 'mat_opt_stone' && id !== 'mat_drill_stone').sort();
  function weekly() {
    let s = weekNo() * 9301 + 49297; const pick = [], pool = monMats.slice();
    while (pick.length < 5 && pool.length) { s = (s * 9301 + 49297) % 233280; pick.push(pool.splice(Math.floor((s / 233280) * pool.length), 1)[0]); }
    return pick;
  }
  let WEEK = weekly();
  const onlineSelf = () => NC.Online?.active ? NC.Online.getState().lastSnapshot?.self : null;
  const dailySold = () => { const p = onlineSelf(); return p ? (p.econ?.day === p.market?.day ? p.econ.sold || {} : {}) : st.sold; };
  const flow = (id) => { const n = dailySold()[id] || 0; return n <= 400 ? 1 : Math.max(0.4, 1 - (n - 400) / 5000); };
  const priceOf = (id, p) => {
    const market = onlineSelf()?.market;
    if (market) return market.prices[id] || 0;
    const M = MAT[id];
    if (!M || !(M.base > 0) || M.keep) return M ? M.price : 0;
    const bonus = NC.setSellBonus ? NC.setSellBonus(p) : 0;
    return Math.max(1, Math.round(M.base * flow(id) * (WEEK.includes(id) ? 1.5 : 1) * (1 + bonus / 100)));
  };
  function reprice() {
    if (NC.Online?.active) {
      const market = onlineSelf()?.market;
      if (market) for (const id in MAT) MAT[id].price = market.prices[id] || 0;
      return;
    }
    const p = NC.game && NC.game.player;
    if (st.day !== today()) { st.day = today(); st.sold = {}; st.gearSold = 0; WEEK = weekly(); st.warpsUsed = 0; save(); }
    for (const id in MAT) if (MAT[id].base > 0 && !MAT[id].keep) MAT[id].price = priceOf(id, p);
  }
  setInterval(reprice, 2000); reprice();

  // ---------------- a sale, priced piece by piece (the balance round of 2026-10-04) ----------------
  // Before, every sale took the price of the moment for the whole lot, so one "sell all" of a 9,999 stack got full price
  // and the day's drop only touched later sales. Now each piece costs what the drop says once the pieces before it are
  // sold, every NPC that buys (Uncle Coco, the bag at his stall, the farm's ยายกระต่าย, the pond's ตานาก) goes through
  // NC.Econ.sell, and the stones are no merchant's goods any more (noNpc: the forge's, or players' shops).
  for (const id of ['mat_opt_stone', 'mat_drill_stone']) if (MAT[id]) MAT[id].noNpc = true;
  const unitPrice = (id, sold, p) => {
    const M = MAT[id], f = sold <= 400 ? 1 : Math.max(0.4, 1 - (sold - 400) / 5000), bonus = NC.setSellBonus ? NC.setSellBonus(p) : 0;
    return M.base * f * (WEEK.includes(id) ? 1.5 : 1) * (1 + bonus / 100);
  };
  function quote(id, n, p) {
    const M = MAT[id];
    if (!M || !(n > 0) || M.noNpc) return 0;
    if (!(M.base > 0) || M.keep) return Math.round(n * (M.price || 0));
    let total = 0, s = st.sold[id] || 0, left = n;
    while (left > 0) { const k = Math.min(left, s < 400 ? 400 - s : 25); total += k * unitPrice(id, s + k / 2, p); s += k; left -= k; }
    return Math.max(n, Math.round(total));
  }
  const recent = {}; // (sold through NC.Econ.sell since the last 1 s poll: the poll must not count them twice)
  function sell(game, id, n) {
    const p = game.player, got = quote(id, n, p);
    if (!(got > 0)) return 0;
    if (MAT[id].base > 0 && !MAT[id].keep) { st.sold[id] = (st.sold[id] || 0) + n; recent[id] = (recent[id] || 0) + n; }
    Econ.faucet('npc', got); reprice(); save();
    return got;
  }
  NC.marketTax = (gross) => { const tax = Math.round(gross * 0.05); Econ.sink('market', tax); return gross - tax; };

  // ---------------- gear at the merchant: a daily appetite (the owner, 2026-10-07, the endgame balance audit) ----------------
  // A Lv 99 hero sold 10–60 pieces of gear an hour at a price that never fell, 35–50% of all the coins made (110k–900k
  // an hour; materials already fall after 400 a day). Now the merchant (and the forge, which buys the same pieces)
  // pays full price for the day's first 15 pieces, then 1/40 less for each one after, down to 20% from the 47th; back
  // to full every morning. A piece's price before the day's drop is js/gearbag.js basePrice (G4 halved the same day).
  // Online the server counts and pays (backend gear_copies.go gearSalePay; self.market.gearSold is today's count);
  // backend/testdata/gear-sales.json is this rule run by the web (scripts/audit-gear-sales.mjs).
  const GEAR_FULL = 15, GEAR_DROP = 40, GEAR_FLOOR = 0.2;
  const gearFlow = (n) => (n < GEAR_FULL ? 1 : Math.max(GEAR_FLOOR, 1 - (n - GEAR_FULL + 1) / GEAR_DROP));
  const gearPay = (base, n) => (base > 0 ? Math.max(1, Math.round(base * gearFlow(n))) : 0);
  const gearSoldToday = () => {
    if (NC.Online?.active) return onlineSelf()?.market?.gearSold || 0;
    return st.day === today() ? st.gearSold || 0 : 0;
  };
  Econ.gearFlow = () => gearFlow(gearSoldToday());
  Econ.gearPay = (base) => gearPay(base, gearSoldToday());
  // what a piece fetches after `ahead` more pieces of the same bulk sale (js/gearbag.js sellMany's preview)
  Econ.gearPayAhead = (base, ahead) => gearPay(base, gearSoldToday() + Math.max(0, ahead | 0));
  Econ.gearSold = (got) => { // (offline: one piece sold for `got` coins; the server counts its own)
    if (NC.Online?.active) return;
    reprice(); st.gearSold = (st.gearSold || 0) + 1; Econ.faucet('gear', got); save();
  };

  // ---------------- sales at the merchant (materials gone + coins up while standing by him) ----------------
  let snap = null, coins = null;
  const nearShop = (game) => { const S = NC.Shop; return !!(S && game && game.world && game.world.shop && NC.dist(game.player.x, game.player.y, S.npc.x, S.npc.y) < S.talk + 40); };
  setInterval(() => {
    const g = NC.game, p = g && g.player;
    if (!p || !p.mats) return;
    if (NC.Online?.active) { snap = null; coins = null; return; } // online sales/counters are committed by the server
    const c = p.coins || 0;
    if (snap && nearShop(g) && c > coins) {
      let sold = 0;
      for (const id in snap) {
        const d = snap[id] - (p.mats[id] || 0) - (recent[id] || 0); // (NC.Econ.sell already counted its own)
        if (d > 0 && MAT[id] && MAT[id].base > 0) { st.sold[id] = (st.sold[id] || 0) + d; sold += d; }
      }
      if (sold) { Econ.faucet('npc', c - coins); save(); }
    }
    for (const id in recent) delete recent[id];
    snap = Object.assign({}, p.mats); coins = c;
    // the maps we have been to (for the guiding flame)
    if (g.mapId && !st.visited[g.mapId]) { st.visited[g.mapId] = 1; save(); }
    if (++tick % 60 === 0) broker(g, 1); // (the broker's buyers: once a minute)
  }, 1000);
  let tick = 0;

  // ---------------- the bosses' and chests' waits outlive a reload (2026-10-04) ----------------
  // boss.js and dungeons.js keep them in memory on the page clock, so reloading the page brought every boss and chest
  // back at once (their drops and stones without waiting). Kept here on the wall clock (st.cd), put back at load.
  const pageNow = () => performance.now() / 1000, wallNow = () => Date.now() / 1000;
  const cdMaps = () => [['b', NC.Boss && NC.Boss.cooldown], ['c', NC.Dungeons && NC.Dungeons.chestCd]];
  (function restoreCd() {
    const keep = st.cd || {}, shift = pageNow() - wallNow();
    for (const [tag, M] of cdMaps()) {
      if (!M) continue;
      for (const k in keep) if (k.startsWith(tag + ':') && keep[k] > wallNow()) M[k.slice(2)] = keep[k] + shift;
    }
  })();
  function keepCd() {
    const out = {}, shift = wallNow() - pageNow();
    for (const [tag, M] of cdMaps()) if (M) for (const k in M) if (M[k] > pageNow()) out[tag + ':' + k] = Math.round(M[k] + shift);
    st.cd = out;
  }
  setInterval(() => { keepCd(); save(); }, 5000);
  addEventListener('beforeunload', keepCd);

  // ---------------- the broker ----------------
  const MAX_LIST = () => 5 + (NC.Card && NC.Card.active && NC.Card.active() ? 3 : 0);
  function broker(game, minutes) {
    if (Econ.noLocalBroker) return; // (?online: the server's buyers, js/online/market.js)
    const p = game.player;
    let got = 0;
    for (const L of st.broker) {
      if (L.n <= 0) continue;
      // (the buyers weigh the asking price against today's market — the base after the day's drop — and what they buy
      // counts in that drop: the broker can't pay full price for more than the merchant would, 2026-10-04)
      const M = MAT[L.id], market = M ? Math.max(1, M.base * flow(L.id)) : L.price;
      // (the balance check of 2026-10-13: above 1.5x the base nobody buys; the old floor of 2% sold a 3x stack every day)
      const k = M && L.price > M.base * 1.5 ? 0 : Math.max(0.02, Math.min(1, 1.6 - L.price / market));
      for (let m = 0; m < minutes; m++) {
        if (L.n <= 0) break;
        if (Math.random() < (k * minutes > 60 ? 1 : k * 0.12)) { // (a buyer now and then; faster the nearer the base price)
          const n = Math.max(1, Math.min(L.n, Math.ceil(L.n * (0.05 + Math.random() * 0.15))));
          L.n -= n; L.sold = (L.sold || 0) + n;
          if (M && M.base > 0) st.sold[L.id] = (st.sold[L.id] || 0) + n;
          const gross = n * L.price, net = NC.marketTax(gross);
          got += net; L.got = (L.got || 0) + net;
          if (minutes > 60) break;
        }
      }
    }
    if (got > 0) {
      p.coins = (p.coins || 0) + got; Econ.faucet('broker', got);
      NC.HUD.log(`นายหน้าขายของที่ฝากไว้ได้ ${fmt(got)} เหรียญ (หักภาษีแล้ว)`, 'item');
      st.broker = st.broker.filter((L) => L.n > 0 || (L.shown = (L.shown || 0) + 1) < 3);
      save(); H.refresh();
    }
  }
  Econ.brokerTick = (game, minutes) => broker(game, minutes); // (tests drive the buyers by hand)
  Econ.brokerList = (game, id, n, price) => list(game, id, n, price); // (tests list by hand)
  // away: the buyers came meanwhile (up to a day)
  const away = st.left ? Math.min(1440, Math.floor((Date.now() - st.left) / 60000)) : 0;
  addEventListener('beforeunload', () => { st.left = Date.now(); keepCd(); save(); });
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) { baseInit(game); if (away > 1 && st.broker.length) setTimeout(() => broker(game, away), 1500); };

  function list(game, id, n, price) {
    const p = game.player, M = MAT[id];
    if (!M || !(M.base > 0) || M.noNpc || !(n > 0) || n > 999 || NC.matCount(p, id) < n || st.broker.filter((L) => L.n > 0).length >= MAX_LIST()) return 'no'; // (999 a listing at most)
    price = Math.max(1, Math.min(Math.round(price), M.base * 3));
    const fee = Math.max(10, Math.round(n * price * 0.01));
    if ((p.coins || 0) < fee) return 'fee';
    p.coins -= fee; Econ.sink('listing', fee);
    p.mats[id] -= n; if (p.mats[id] <= 0) delete p.mats[id];
    st.broker.push({ id, n, n0: n, price, t: Date.now(), sold: 0, got: 0 });
    NC.HUD.log(`ฝากขาย ${M.name} ×${n} ราคา ${fmt(price)} (ค่าฝาก ${fmt(fee)})`, 'item');
    save(); NC.saveGame(game);
    return 'ok';
  }
  function unlist(game, i) {
    const L = st.broker[i], p = game.player;
    if (!L) return;
    if (L.n > 0) NC.addMat(game, L.id, L.n);
    st.broker.splice(i, 1); save(); NC.saveGame(game);
  }

  // ---------------- the guiding flame ----------------
  const mapLv = (id) => { const t = (NC.MAPS[id] || {}).lvText || ''; const m = /Lv\s*(\d+)/.exec(t); return m ? Number(m[1]) : 1; };
  const warpCost = (p, id) => {
    if (NC.Online?.active) return onlineSelf()?.travel?.costs?.[id] ?? null;
    if (st.warpDay !== today()) { st.warpDay = today(); st.warpsUsed = 0; }
    const free = NC.setWarpFree ? NC.setWarpFree(p) : 0;
    if (st.warpsUsed < free) return 0;
    const off = (NC.setWarpOff ? NC.setWarpOff(p) : 0) + (NC.Card && NC.Card.active && NC.Card.active() ? 30 : 0);
    return Math.round((200 + 30 * mapLv(id)) * (1 - Math.min(80, off) / 100));
  };
  function warp(game, id) {
    if (NC.Online?.active) return NC.Online.action('travel', { mapId: id });
    const p = game.player, c = warpCost(p, id);
    if (!NC.MAPS[id] || id === game.mapId || p.dead > 0) return;
    if ((p.coins || 0) < c) { game.toast('เหรียญไม่พอ'); return; }
    p.coins -= c; Econ.sink('warp', c); st.warpsUsed++; save();
    NC.HUD.panel('journal', false); game.paused = false;
    NC.Maps.go(game, id);
    NC.HUD.log(`ลูกไฟนำทางพาไป ${NC.MAPS[id].name}${c ? ` (${fmt(c)} เหรียญ)` : ' (ฟรี)'}`, 'item');
  }

  // ---------------- pages ----------------
  let form = { id: '', n: 1, price: 0 }, mkTab = 'today';
  function renderMarket(el, game) {
    const p = game.player, near = nearShop(game);
    const tabs = [['today', 'ราคาวันนี้'], ['broker', 'นายหน้าฝากขาย'], ['shops', 'ร้านผู้เล่น']];
    let h = `<div class="bb-h">ตลาด <small>ภาษีตลาด 5% · ราคารับซื้อรีเซ็ตทุกเช้า</small></div>` +
      `<div class="bb-chips">${tabs.map(([k, n]) => `<button class="bb-chip ${mkTab === k ? 'on' : ''}" data-mk="${k}">${n}</button>`).join('')}</div>`;
    if (mkTab === 'today') {
      h += `<div class="bb-h2">ตลาดรับซื้อสัปดาห์นี้ <small>ลุงโกโก้ให้ ×1.5</small></div><div class="bb-list">` +
        Econ.week().map((id) => `<div class="bb-row on"><img src="${NC.matIcon(id)}" alt=""><div class="t"><b>${esc(MAT[id].name)}</b><small>${esc(NC.matSource ? NC.matSource(id) : '')}</small></div><span class="n">${fmt(MAT[id].price)}</span></div>`).join('') + '</div>';
      const mine = Object.keys(p.mats || {}).filter((id) => MAT[id] && MAT[id].base > 0 && !MAT[id].keep && NC.matCount(p, id) > 0);
      h += '<div class="bb-h2">ของในกระเป๋า: ราคาวันนี้</div><table class="bb-table"><tr><th>วัตถุดิบ</th><th class="num">มี</th><th class="num">ราคาปกติ</th><th class="num">วันนี้</th><th class="num">ขายวันนี้แล้ว</th></tr>' +
        mine.map((id) => { const M = MAT[id], f = flow(id); return `<tr><td>${esc(M.name)}</td><td class="num">${NC.matCount(p, id).toLocaleString()}</td><td class="num">${fmt(M.base)}</td>` +
          `<td class="num" style="color:${M.price < M.base ? '#c0392b' : M.price > M.base ? '#1e8a3a' : 'inherit'}">${fmt(M.price)}</td><td class="num">${(dailySold()[id] || 0).toLocaleString()}${f < 1 ? ' ↓' : ''}</td></tr>`; }).join('') + '</table>' +
        '<div class="bb-note">ขายชนิดเดียวกันเกิน 400 ชิ้นในวันเดียว ราคาจะค่อย ๆ ลดลง (ต่ำสุด 40%) และกลับเป็นปกติพรุ่งนี้ · ของที่ขายไม่หมดลองฝากนายหน้า หรือขายในร้านผู้เล่น</div>' +
        `<div class="bb-note">ของสวมใส่: ลุงโกโก้รับราคาเต็มวันละ ${GEAR_FULL} ชิ้น จากนั้นลดชิ้นละ ${100 / GEAR_DROP}% (ต่ำสุด ${GEAR_FLOOR * 100}%) · ขายวันนี้แล้ว ${gearSoldToday()} ชิ้น · ชิ้นต่อไปได้ ${Math.round(Econ.gearFlow() * 100)}%</div>`;
    } else if (mkTab === 'broker') {
      const mats = Object.keys(p.mats || {}).filter((id) => MAT[id] && MAT[id].base > 0 && !MAT[id].keep && !MAT[id].noNpc && NC.matCount(p, id) > 0);
      if (!form.id || !mats.includes(form.id)) form = { id: mats[0] || '', n: 1, price: mats[0] ? Math.round(MAT[mats[0]].base * 1.3) : 0 };
      const M = MAT[form.id];
      h += '<div class="bb-sub">ฝากขายวัตถุดิบในราคาที่ตั้งเอง ผู้ซื้อจะมาเรื่อย ๆ แม้ตอนออกเกม ราคายิ่งใกล้ราคาปกติยิ่งขายไว (ค่าฝาก 1% ภาษีขาย 5%)</div>';
      h += mats.length ? `<div class="bb-form"><select class="bb-input" id="bk-id">${mats.map((id) => `<option value="${id}" ${id === form.id ? 'selected' : ''}>${esc(MAT[id].name)} (มี ${NC.matCount(p, id)})</option>`).join('')}</select>` +
        `<input class="bb-input" id="bk-n" type="number" min="1" max="${NC.matCount(p, form.id)}" value="${form.n}" style="width:calc(110*var(--u))"> ชิ้น ` +
        `<input class="bb-input" id="bk-p" type="number" min="1" max="${M ? M.base * 3 : 1}" value="${form.price}" style="width:calc(130*var(--u))"> เหรียญ/ชิ้น ` +
        `<button class="kw-btn gold" data-bk="go" ${near ? '' : 'disabled'}>ฝากขาย</button></div>` +
        `<div class="bb-sub">ราคาปกติ ${fmt(M ? M.base : 0)} · ตั้งได้สูงสุด ${fmt(M ? M.base * 3 : 0)} · ค่าฝาก ${fmt(Math.max(10, Math.round(form.n * form.price * 0.01)))}${near ? '' : ' · ต้องอยู่ที่ร้านลุงโกโก้ถึงจะฝากได้'}</div>` : '<div class="bb-sub">ยังไม่มีวัตถุดิบให้ฝาก</div>';
      h += `<div class="bb-h2">ของที่ฝากไว้ <small>${st.broker.filter((L) => L.n > 0).length} / ${MAX_LIST()}</small></div><div class="bb-list">` +
        (st.broker.length ? st.broker.map((L, i) => `<div class="bb-row ${L.n <= 0 ? 'done' : ''}"><img src="${NC.matIcon(L.id)}" alt=""><div class="t"><b>${esc((MAT[L.id] || {}).name || L.id)} · ${fmt(L.price)} / ชิ้น</b>` +
          `<small>ขายแล้ว ${L.sold || 0} / ${L.n0} · ได้ ${fmt(L.got || 0)}</small><div class="bb-bar"><i style="width:${((L.sold || 0) / L.n0) * 100}%"></i></div></div>` +
          `<button class="kw-btn ${L.n > 0 ? 'grey' : 'blue'}" data-unlist="${i}">${L.n > 0 ? 'ถอนคืน' : 'เอาออก'}</button></div>`).join('') : '<div class="bb-sub">ยังไม่มี</div>') + '</div>';
    } else {
      const shops = NC.Net && NC.Net.remotes ? [...NC.Net.remotes.values()].filter((r) => r.shop && r.shop.items && r.shop.items.length) : [];
      h += '<div class="bb-sub">ร้านของผู้เล่นที่เปิดอยู่ตอนนี้ (ไปซื้อได้ที่ร้านของเขาในค่าย) · ตั้งร้านเองกด V ที่ค่าย</div>';
      h += shops.length ? '<div class="bb-list">' + shops.map((r) => `<div class="bb-row"><div class="t"><b>${esc(r.shop.name || r.name)}</b><small>${esc(r.name)} · ${r.shop.items.length} รายการ</small></div></div>`).join('') + '</div>'
        : '<div class="bb-empty">ตอนนี้ยังไม่มีร้านผู้เล่นเปิดอยู่ (เล่นออนไลน์ผ่านลิงก์ของเกมเพื่อเห็นร้านคนอื่น)</div>';
    }
    el.innerHTML = h;
  }
  H.add({ id: 'market', name: 'ตลาด', icon: 'ic_market', order: 40, render: renderMarket,
    click(e, game) {
      const t = e.target.closest('[data-mk]'); if (t) { mkTab = t.dataset.mk; return true; }
      const u = e.target.closest('[data-unlist]'); if (u) { unlist(game, Number(u.dataset.unlist)); return true; }
      const b = e.target.closest('[data-bk]');
      if (b && !b.disabled) { const r = list(game, form.id, form.n, form.price); if (r === 'fee') game.toast('เหรียญไม่พอจ่ายค่าฝาก'); else if (r === 'no') game.toast('ฝากไม่ได้ (ของไม่พอ หรือช่องเต็ม)'); return true; }
      return false;
    },
    input(e, game) {
      if (e.target.id === 'bk-id') { form.id = e.target.value; form.price = Math.round(MAT[form.id].base * 1.3); form.n = 1; H.refresh(); }
      else if (e.target.id === 'bk-n') form.n = Math.max(1, Math.min(NC.matCount(game.player, form.id), Number(e.target.value) || 1));
      else if (e.target.id === 'bk-p') form.price = Math.max(1, Math.min(MAT[form.id].base * 3, Number(e.target.value) || 1));
    } });

  function renderWarp(el, game) {
    const p = game.player, self = onlineSelf(), visited = NC.Online?.active ? self?.econ?.visited || {} : st.visited;
    const ids = Object.keys(NC.MAPS).filter((id) => visited[id]).sort((a, b) => mapLv(a) - mapLv(b));
    const free = NC.Online?.active ? self?.travel?.free || 0 : NC.setWarpFree ? NC.setWarpFree(p) : 0;
    const used = NC.Online?.active ? self?.travel?.used || 0 : st.warpsUsed;
    let h = `<div class="bb-h">ลูกไฟนำทาง <small>ไปแมพที่เคยไปแล้วได้ทันที</small></div>` +
      `<div class="bb-sub">ค่าเดินทาง 200 + 30 ต่อเลเวลของแมพ${free ? ` · วาร์ปฟรีวันนี้เหลือ ${Math.max(0, free - used)} ครั้ง (เซ็ต)` : ''}</div><div class="bb-list">`;
    for (const id of ids) {
      const M = NC.MAPS[id], c = warpCost(p, id), here = id === game.mapId;
      h += `<div class="bb-row ${here ? 'on' : ''}"><img src="${H.icon('ic_warp')}" alt=""><div class="t"><b>${esc(M.name)}</b><small>${esc(M.lvText || '')}</small></div>` +
        (here ? '<span class="n">อยู่ที่นี่</span>' : `<button class="kw-btn gold" data-warp="${id}" ${c !== null && (p.coins || 0) >= c ? '' : 'disabled'}>${c === null ? 'กำลังรอราคา' : c ? fmt(c) + ' เหรียญ' : 'ฟรี'}</button>`) + '</div>';
    }
    el.innerHTML = h + '</div>';
  }
  H.add({ id: 'warp', name: 'ลูกไฟนำทาง', icon: 'ic_warp', order: 45, render: renderWarp,
    click(e, game) { const w = e.target.closest('[data-warp]'); if (w && !w.disabled) { warp(game, w.dataset.warp); return false; } return false; } });

  let travelView = '';
  addEventListener('nightcamp:online-snapshot', ({ detail }) => {
    if (!NC.Online?.active) return;
    const s = detail?.snapshot?.self;
    const next = JSON.stringify([detail?.snapshot?.mapId, s?.gold, s?.dead, s?.econ?.visited, s?.travel]);
    if (next !== travelView) { travelView = next; H.refresh(); }
  });

  NC.Econ.priceOf = priceOf; NC.Econ.week = () => onlineSelf()?.market?.weekly || WEEK; NC.Econ.warp = warp; NC.Econ.quote = quote; NC.Econ.sell = sell;
})();
