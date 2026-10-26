/* online/market.js — trading and the shop windows online (?online), through the web's own windows:
     นายหน้า     the J page's market → broker (economy.js + p3_jmarket.js): the listings are the server's (self.broker,
                 backend broker.go), listing = {action:'broker', kind:'list', itemId, count, price}, ถอนคืน =
                 {kind:'unlist', listingId}; the buyers are the server's (economy.js's own ones stop: noLocalBroker),
                 their money comes as the event brokerSale
     ร้านผู้เล่น  vend.js's set-up window and signs: opening = sit, then {action:'vend', kind:'open', name, listings[{k, id,
                 n, price, copyId}]} (a piece with options is the item and its copy id); the shop is self.shop and every
                 hero's players[].shop, drawn by vend.js from the presence field 'sh' it already reads; buying =
                 {kind:'buy', targetId, shopId, listing, count}; a sale = the event vendorSale. The three shopkeepers by
                 the fire are not there online (NC.Vend.noKeepers): their goods would come from nowhere
     ตู้กาชา      the J page's gacha (gacha.js + p3_jgacha.js): pull / pullTicket / exchangeStars / claimPass / exchangeTokens are the
                 server's ({action:'gacha', kind, count, itemId}, closed while the back office's switch is off); the
                 gems, bound tickets, pity, stars and pass come from self.gacha
     เติมเพชรจันทร์ topupwin.js's buy = {action:'topup', kind:'buy', itemId} (test purchases only while the server allows)
   Load after online/extras.js (it keeps W.sat, what the server was told about sitting). */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld;
  if (!O || !O.enabled || !W) return;
  const G = () => NC.game;
  const fmt = (n) => (NC.fmtCoins ? NC.fmtCoins(n) : String(n));
  const log = (t, k) => NC.HUD && NC.HUD.log(t, k || 'item');
  const refresh = () => { if (NC.Hub && NC.Hub.refresh) try { NC.Hub.refresh(); } catch (e) { /* closed */ } };
  const nameOf = (id) => (NC.MATERIALS[id] || NC.ITEMS[id] || {}).name || id;
  let errorFor = null; // fn(message) -> true: the next refusal belongs to that window
  W.eventHooks.push((ev) => { if (ev && ev.type === 'error' && errorFor) { const f = errorFor; errorFor = null; f(ev.message || ''); } });

  // ---------------- the broker ----------------
  const E = NC.Econ;
  if (E && E.state) {
    E.noLocalBroker = true;
    let seen;
    W.selfHooks.push((s) => {
      if (s.broker === seen) return;
      seen = s.broker;
      const list = E.state.broker || (E.state.broker = []);
      list.length = 0;
      for (const L of (s.broker && s.broker.items) || []) list.push(Object.assign({}, L));
      refresh();
    });
    E.brokerList = (game, id, n, price) => {
      const p = game.player;
      if (!(n > 0) || NC.matCount(p, id) < n) return 'no';
      W.send({ action: 'broker', kind: 'list', itemId: id, count: Math.floor(n), price: Math.max(1, Math.round(price)) });
      errorFor = (m) => { if (game.toast) game.toast(m || 'ฝากขายไม่ได้'); };
      return 'ok';
    };
    const TM = NC.Hub && NC.Hub.tab && NC.Hub.tab('market');
    if (TM) {
      const base = TM.click;
      TM.click = function (e, game) {
        const u = e.target.closest('[data-unlist]');
        if (u) {
          const L = E.state.broker[Number(u.dataset.unlist)];
          if (L && L.listingId) W.send({ action: 'broker', kind: 'unlist', listingId: L.listingId });
          return false;
        }
        return base ? base.call(this, e, game) : false;
      };
    }
    W.eventHooks.push((ev) => { if (ev && ev.type === 'brokerSale' && ev.gold) log(`นายหน้าขายของที่ฝากไว้ได้ ${fmt(ev.gold)} เหรียญ (หักภาษีแล้ว)`); });
  }

  // ---------------- player shops ----------------
  const V = NC.Vend;
  if (V) {
    V.noKeepers = true;
    const toServer = (L) => {
      if (L.k === 'gear') { const d = NC.gearDec && NC.gearDec(L.id); return d ? { k: 'item', id: d.id, n: 1, price: L.price, copyId: d.u } : null; }
      if (L.k === 'mat' || L.k === 'pot' || L.k === 'item') return { k: L.k, id: L.id, n: L.n, price: L.price };
      return null;
    };
    const toWeb = (L) => (L.k === 'item' && L.copy && NC.gearEnc ? ['gear', NC.gearEnc(L.copy), 1, L.price] : [L.k, L.id, L.n, L.price]);
    let mine = null, opened = false, openT = 0;
    V.onOpen = (m, game) => {
      const listings = m.items.map(toServer).filter(Boolean);
      if (!listings.length) { V.close(); return; }
      mine = m; opened = false; openT = Date.now();
      if (!W.sat) { W.sat = true; W.send({ action: 'rest', kind: 'sit' }); } // (first: the server's sit closes a shop)
      W.send({ action: 'vend', kind: 'open', name: m.title, listings });
      errorFor = (msg) => { if (mine && !opened) { const g = G(); if (g && g.toast) g.toast('เปิดร้านไม่ได้: ' + msg); mine = null; V.close(); } };
    };
    V.onClose = () => { if (mine && opened) W.send({ action: 'vend', kind: 'close' }); mine = null; opened = false; };
    let shopSeen;
    W.selfHooks.push((s) => {
      if (s.shop === shopSeen) return;
      shopSeen = s.shop;
      if (!mine) return;
      if (s.shop) { opened = true; mine.items = s.shop.listings.map((L) => { const a = toWeb(L); return { k: a[0], id: a[1], n: a[2], price: a[3] }; }); mine.ver++; }
      else if (opened) { mine = null; opened = false; V.close(); }
    });
    setInterval(() => { if (mine && !opened && Date.now() - openT > 4000) { mine = null; V.close(); log('เซิร์ฟเวอร์ไม่ได้เปิดร้านให้ ลองใหม่อีกครั้ง', 'warn'); } }, 1000);
    W.eventHooks.push((ev) => {
      if (!ev || ev.type !== 'vendorSale') return;
      if (mine) mine.earned = (mine.earned || 0) + (ev.gold || 0);
      log(`ขาย ${nameOf(ev.itemId)} ×${ev.count || 1} ได้ ${fmt(ev.gold || 0)} เหรียญ`);
      const p = G() && G().player;
      if (p && NC.FX) NC.FX.stars(p.x, p.y - 150, 10, '255,220,120', { speed: 180, size: 0.8 });
    });
    // the others' shops: their players[].shop as vend.js's 'sh' ([version, title, [[k, id, n, price]...]]), the shop's id kept
    const shopIds = new Map(), verOf = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
    W.presenceHooks.push((pl, pr) => {
      if (pl.shop && Array.isArray(pl.shop.listings) && pl.shop.listings.length) {
        shopIds.set(pl.id, pl.shop.id);
        pr.sh = [verOf(pl.shop.id), pl.shop.title || '', pl.shop.listings.map(toWeb)];
      } else shopIds.delete(pl.id);
    });
    let buying = null;
    // (stop in camp: the server refuses a buyer who walks, fights, fishes or runs AUTO, backend vendor.go - it came out in
    // English before, 2026-10-19 Discord "ซื้อของร้านที่ตั้งไม่ได้")
    const WHY = [[/stop in camp/, 'หยุดเดินและปิด AUTO ในค่ายก่อน แล้วค่อยซื้อ'], [/closed|far/, 'ร้านปิดไปแล้ว หรืออยู่ไกลเกินไป'], [/changed/, 'ของในร้านเปลี่ยนไปแล้ว ลองดูใหม่อีกที'], [/stock/, 'ของไม่พอแล้ว'], [/gold|coin|เหรียญ/, 'เหรียญไม่พอ']];
    V.buyOnline = (v, L, n, say) => {
      const sid = shopIds.get(v.peer);
      if (!sid) { say('ร้านปิดไปแล้ว', 'warn'); return; }
      if (buying && Date.now() - buying.t < 4000) return;
      buying = { say, L, n, from: v.name, t: Date.now() };
      W.send({ action: 'vend', kind: 'buy', targetId: v.peer, shopId: sid, listing: L.i, count: n });
      errorFor = (msg) => { if (!buying) return; const b = buying; buying = null; const w = WHY.find(([re]) => re.test(msg)); b.say(w ? w[1] : msg || 'ซื้อไม่สำเร็จ', 'warn'); };
      say('กำลังซื้อ…', '');
    };
    W.eventHooks.push((ev) => {
      if (!ev || ev.type !== 'character' || ev.action !== 'vend' || !buying) return;
      const b = buying; buying = null; errorFor = null;
      log(`ซื้อ ${b.L.k === 'gear' ? 'ของมีออฟ' : nameOf(b.L.id)} ×${b.n} จาก ${b.from} จ่าย ${fmt(b.n * b.L.price)} เหรียญ`);
      b.say('ซื้อแล้ว!', 'ok');
    });
  }

  // ---------------- the gacha ----------------
  const GS = NC.Gacha && NC.Gacha.state;
  if (GS) {
    const take = (g) => { if (!g) return; GS.tickets = g.tickets || 0; for (const k of ['gems', 'pity', 'stars', 'pulls', 'passXp', 'passGot']) if (g[k] !== undefined) GS[k] = g[k]; if (Array.isArray(g.log)) GS.log = g.log.slice(); };
    let seen;
    W.selfHooks.push((s) => { if (s.gacha !== seen) { seen = s.gacha; take(s.gacha); refresh(); } });
    const gacha = (kind, more) => W.send(Object.assign({ action: 'gacha', kind }, more || {}));
    const TG = NC.Hub && NC.Hub.tab && NC.Hub.tab('gacha');
    if (TG) {
      const base = TG.click;
      TG.click = function (e, game) {
        const b = e.target.closest('[data-pull]');
        if (b) { if (!b.disabled) gacha('pull', { count: Number(b.dataset.pull) || 1 }); return false; }
        const ticket = e.target.closest('[data-ticket-pull]');
        if (ticket) { if (!ticket.disabled) gacha('pullTicket', { count: Number(ticket.dataset.ticketPull) || 1 }); return false; }
        if (e.target.closest('[data-sparkgo]')) {
          const sel = document.querySelector('#hb-page [data-spark].sel');
          if (sel) gacha('exchangeStars', { itemId: sel.dataset.spark });
          return false;
        }
        if (e.target.closest('[data-passget]')) { gacha('claimPass'); return false; }
        if (e.target.closest('[data-tok]')) { gacha('exchangeTokens'); return false; }
        return base ? base.call(this, e, game) : false;
      };
    }
    W.eventHooks.push((ev) => {
      if (!ev || ev.type !== 'character' || (ev.action !== 'gacha' && ev.action !== 'topup')) return;
      if (ev.gacha) take(ev.gacha);
      for (const r of ev.results || []) log(`${r.kind === 'top' ? '🌟 ' : r.kind === 'hat' ? '✨ ' : ''}ได้ ${r.text}`, r.kind === 'top' || r.kind === 'hat' ? 'level' : 'item');
      if (ev.action === 'topup' && ev.kind === 'buy') log(`(ทดสอบ) ได้เพชรจันทร์ ${(ev.gems || 0).toLocaleString()}`);
      refresh();
    });
  }

  // ---------------- top-up ----------------
  if (NC.TopUp) {
    NC.TopUp.buy = (id) => {
      W.send({ action: 'topup', kind: 'buy', itemId: id });
      return { ok: false, why: 'ส่งคำขอเติมไปที่เซิร์ฟเวอร์แล้ว รอผลสักครู่' };
    };
  }
})();
