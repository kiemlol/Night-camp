/* online/gear.js — the hero's gear pieces online (?online): the server's bag (snapshot `bag`, sent only when it changed:
   backend bag_wire.go) is the web's p.bag of copies { u, id, rows, ref, sh, pi, g, gp, taint, by, bd } (the same shape:
   the server's gearCopy was ported from js/gearbag.js), and self.wu is p.wu (the copy worn in each slot). So the bag
   window (I), the item cards, the option rows and the grade colours read the server's pieces unchanged.
   What the windows do with a piece goes to the server: wearing one (the equip action carries its copyId, through the
   bridge in online/world.js), selling pieces at Uncle Coco (sellgear copyIds). Load after online/world.js.
   The camp storage (คลัง) the same way: snapshot `store` is p.store, ฝากคลัง / เบิกใส่กระเป๋า are the store action and
   the bag's room bought at Uncle Coco is bagexpand (self.bagExtra is p.bagExtra). */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld;
  if (!O || !O.enabled || !W) return;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const toast = (t) => { const g = W.game; if (g && g.toast) g.toast(t); };
  let lastBag = null;
  const selling = new Map(); // copy id -> its sale (W.trade's entry) until the server answers it

  // the server's bag on the hero, whenever it comes (and the worn copies with every record)
  function applyBag(force) {
    const g = W.game;
    if (!g || !g.player) return;
    const p = g.player;
    if (Array.isArray(O.bag) && (force || O.bag !== lastBag)) {
      lastBag = O.bag;
      // (a piece sold here stays out until the server answers: sold, or refused and back)
      const there = new Set(O.bag.map((c) => c && c.u));
      for (const [u, e] of selling) if (!there.has(u) || W.answered(e.a)) selling.delete(u);
      p.bag = clone(O.bag).filter((c) => c && NC.ITEMS[c.id] && !selling.has(c.u));
      for (const c of p.bag) { if (!Array.isArray(c.rows)) c.rows = []; c.ref = c.ref || 0; c.sh = c.sh || 0; }
      for (const c of p.bag) if (!p.owned.has(c.id)) p.owned.add(c.id);
      look();
      if (NC.applyGear) try { NC.applyGear(g); } catch (e) { /* the sheet is redone with the next record */ }
    }
  }
  // the worn copies: the server's, and a copy picked here stays until the server has it (W.keep: not sent yet, or
  // sent and not answered; a refused one goes back to the server's)
  W.selfHooks.push((s, first) => {
    const p = W.game && W.game.player;
    if (!p) return;
    if (first) { selling.clear(); open = null; moving.clear(); expanding = null; } // (a new record: the server's bag as it is)
    p.wu = W.keep('wu', p.wu ? Object.assign({}, p.wu) : null, s.wu || {}, first);
    applyBag(!!W.resyncing); // (a resync puts the server's bag back too: a refused sale or craft)
    applyStore(first || !!W.resyncing);
    const room = Math.max(0, s.bagExtra | 0);
    if (room !== (p.bagExtra | 0)) {
      const more = !first && room > (p.bagExtra | 0);
      p.bagExtra = room;
      if (more) { toast(`กระเป๋าอุปกรณ์ ${NC.GEAR.bagCap(p)} ช่องแล้ว`); expanding = null; }
      if (NC.invRefresh) NC.invRefresh();
    }
  });
  O.on('snapshot', (st, raw) => {
    if (!raw || !W.ready) return;
    if (raw.bag !== undefined) applyBag(true);
    if (raw.store !== undefined) applyStore(true);
    if ((raw.bag !== undefined || raw.store !== undefined) && NC.invRefresh) NC.invRefresh();
  });

  // ---------------- the camp storage at Uncle Coco (backend bag_rules.go storePut / storeTake) ----------------
  // the server's storage on the hero, the same copies as the bag (js/gearbag.js reads p.store for the คลัง tab)
  let lastStore = null;
  function applyStore(force) {
    const p = W.game && W.game.player;
    if (!p || !Array.isArray(O.storage) || (!force && O.storage === lastStore)) return;
    lastStore = O.storage;
    p.store = clone(O.storage).filter((c) => c && NC.ITEMS[c.id]);
    for (const c of p.store) { if (!Array.isArray(c.rows)) c.rows = []; c.ref = c.ref || 0; c.sh = c.sh || 0; }
    // (a piece on its way is done once the lists show it moved)
    for (const [u, e] of moving) if (!(e.put ? p.bag : p.store).some((c) => c.u === u)) moving.delete(u);
  }
  // ฝากคลัง / เบิกใส่กระเป๋า: checked here like js/gearbag.js deposit / withdraw (at the server's reach: NC.Shop.canTrade),
  // then sent; the piece moves when the server's next bag and storage come. One try per piece until then.
  const moving = new Map(); // copy id -> { put, a: the action, at }
  const STORE_WAIT_MS = 5000;
  function storeAct(game, a) {
    const m = /^gb:(put|take):(\d+)$/.exec(a || '');
    if (!m) return false;
    const G = NC.GEAR, p = game.player, u = Number(m[2]), put = m[1] === 'put';
    if (!W.ready) { toast('รอเชื่อมต่อเซิร์ฟเวอร์ก่อน'); return true; }
    const was = moving.get(u);
    if (was && performance.now() - was.at < STORE_WAIT_MS) return true;
    if (!(put ? p.bag : G.store(p)).some((c) => c.u === u)) return true;
    const why = !NC.Shop || !NC.Shop.canTrade || !NC.Shop.canTrade(game) ? (put ? 'ฝากได้ที่ร้านลุงโกโก้ กลางค่าย' : 'เบิกได้ที่ร้านลุงโกโก้ กลางค่าย')
      : put && G.wornUids(p).has(u) ? 'ถอดชิ้นที่สวมก่อนฝาก'
      : put && G.store(p).length >= G.STORE_MAX ? `คลังเต็ม (${G.STORE_MAX} ชิ้น)`
      : !put && !G.room(p) ? `กระเป๋าอุปกรณ์เต็ม (${G.bagCap(p)} ชิ้น) · ขายหรือฝากของก่อนเบิก` : '';
    if (why) { toast(why); return true; }
    const action = { action: 'store', kind: m[1], copyId: u };
    moving.set(u, { put, a: action, at: performance.now() });
    W.send(action);
    return true;
  }
  if (NC.invActs) NC.invActs.unshift(storeAct);

  // more room in the bag (js/gearbag.js buySlots): the server takes the coins (backend bag_rules.go buyBagSlots)
  let expanding = null;
  const G0 = NC.GEAR;
  if (G0 && G0.buySlots) G0.buySlots = function (game) {
    const p = game.player, price = G0.nextSlotsPrice(p);
    if (!price) return 'max';
    if (!NC.Shop || !NC.Shop.canTrade || !NC.Shop.canTrade(game)) return 'far';
    if ((p.coins || 0) < price) return 'coins';
    if (!W.ready) return 'รอเชื่อมต่อเซิร์ฟเวอร์ก่อน';
    if (expanding && performance.now() - expanding.at < STORE_WAIT_MS) return 'sent';
    expanding = { a: { action: 'bagexpand' }, at: performance.now() };
    W.send(expanding.a);
    return 'sent';
  };

  // the server's refusal of a store / bagexpand try: its own words (Thai, backend bag_rules.go)
  W.eventHooks.push((ev) => {
    if (!ev || ev.type !== 'error' || !ev.seq) return;
    for (const [u, e] of moving) if (W.commandSeq(e.a) === ev.seq) { moving.delete(u); toast(ev.message || 'ทำไม่สำเร็จ'); }
    if (expanding && W.commandSeq(expanding.a) === ev.seq) { expanding = null; toast(ev.message || 'ขยายกระเป๋าไม่สำเร็จ'); }
  });

  // the equip action names the piece: the copy the bag window put on (p.wu), else the best of that kind
  W.copyIdFor = function (slot, itemId) {
    const p = W.game && W.game.player;
    if (!p || !Array.isArray(p.bag)) return 0;
    const it = NC.ITEMS[itemId];
    if (!it || !it.inst) return 0;
    const mine = p.bag.filter((c) => c.id === itemId);
    if (!mine.length) return 0;
    const want = p.wu && p.wu[slot];
    const c = mine.find((x) => x.u === want) || mine.slice().sort((a, b) => (b.ref || 0) - (a.ref || 0))[0];
    return c.u;
  };

  // ---------------- selling pieces (the bag window's ขาย, the smith's): noted at the sale itself ----------------
  // both call NC.gearSold right after the piece left the bag and before its coins come: the piece is the copy gone
  // since the bag was last seen (each click, each bag from the server), its price the one they pay (NC.GEAR.sellPrice,
  // before NC.gearSold counts the sale). Noted with W.trade, it is kept on the hero (coins, the piece out of the bag)
  // through snapshots until the bridge sends it; the sales of one round go as one sellgear (200 ids at most: a message
  // is 4096 bytes). (Before: the bridge guessed a sale from more coins and pieces gone, and a snapshot coming first gave
  // the coins back: the sale was lost, 2026-10-18.)
  let seen = new Map(), open = null; // copy id -> copy (the bag before this click); the sale still taking more pieces
  function look() { const p = W.game && W.game.player; seen = new Map(Array.isArray(p && p.bag) ? p.bag.map((c) => [c.u, c]) : []); }
  document.addEventListener('pointerdown', look, true);
  document.addEventListener('click', look, true);
  function noteSale(p) {
    const have = new Set(p.bag.map((c) => c.u));
    let gone = [...seen.values()].filter((c) => !have.has(c.u) && !selling.has(c.u));
    if (!gone.length && Array.isArray(O.bag)) gone = O.bag.filter((c) => c && !have.has(c.u) && !selling.has(c.u)); // (no click seen: the server's bag)
    if (gone.length !== 1) { console.warn('online: a piece sold, but which?', gone.map((c) => c.u)); return; }
    const c = gone[0], G = NC.GEAR || {};
    const price = G.sellPrice ? G.sellPrice(c) : G.priceOf ? G.priceOf(c) : 0;
    if (!open || open.out || open.a.copyIds.length >= 200) open = W.trade({ coins: 0 }, { action: 'sellgear', copyIds: [] });
    open.a.copyIds.push(c.u);
    open.d.coins += price;
    selling.set(c.u, open);
    seen.delete(c.u);
  }
  if (NC.gearSold) {
    const baseSold = NC.gearSold;
    NC.gearSold = function () {
      const p = W.game && W.game.player;
      if (W.ready && p && Array.isArray(p.bag)) try { noteSale(p); } catch (e) { console.warn('online: gear sale', e); }
      return baseSold.apply(this, arguments);
    };
  }
  // a worn piece the window swapped for another copy of the same kind: the equip action with the new copy (once; a
  // copy that cannot go — not in the bag, not of the worn kind — gives the slot back to the server's)
  W.bridgeHooks.push((s, p, put) => {
    const sw = s.wu || {}, lw = p.wu || {}, wait = W.sentOf('wu');
    for (const slot in lw) {
      const u = lw[slot];
      if (!u || u === (slot in wait ? wait[slot] : sw[slot])) continue;
      const id = p.equip && p.equip[slot];
      if (!id || id !== (s.equip || {})[slot]) continue; // (a new kind: the equip diff in world.js sends it with this copy)
      if (Array.isArray(p.bag) && p.bag.some((c) => c.u === u && c.id === id)) { put('wu', { action: 'equip', slot, itemId: id, copyId: u }); wait[slot] = u; }
      else if (sw[slot]) p.wu[slot] = sw[slot];
      else delete p.wu[slot];
    }
  });
})();
