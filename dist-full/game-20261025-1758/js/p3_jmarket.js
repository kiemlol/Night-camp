/* p3_jmarket.js — the journal's Market page (mockup p3_jmarket B) and Bot report page + popup (p3_jreport A). Built from
   the picked mockups (UI audit round 3, 2026-10-17; assets/gen/nightcamp_p3_jmarket_b_raw.png, nightcamp_p3_jreport_a_raw.png).
     ตลาด (J → ตลาด, js/economy.js)   tabs ราคาวันนี้ / นายหน้าฝากขาย / ร้านผู้เล่น. ราคาวันนี้: the week's five buys (×1.5) as
                cards, the pouch as a grid of cards (have, today's price with an arrow against the usual price, the usual
                price, sold today, ขาย), and a dark card for the picked material (today's price, have / usual / sold today,
                a 7-day price chart, ขาย 1 / ขายหมด). Selling is Uncle Coco's: at his stall it sells through NC.Econ.sell
                (piece by piece, like js/shopwin.js); away from him the card offers "พาเดินไปหาลุงโกโก้" (NC.CraftGo.walkTo).
                The 7-day chart: economy.js keeps no price history, so this file keeps the day's last price of every
                material from now on (nightcamp.p3market.v1, the last 7 days) and shows only the days it has.
                นายหน้า: the same broker (NC.Econ.brokerList; ถอนคืน goes through economy.js's own click), restyled.
     สรุปบอท (J → สรุปบอท, js/report.js) and its pop-up (.rp-pop): a painted night strip, four number tiles with painted
                icons, the level changes as two pills, the drops as big rows, a dark card with the materials and the rest.
                The pop-up is report.js's own (it exposes no hook for it): its body is redrawn here when it opens.
   Art: assets/p3/jmarket/ (Codex: assets/gen/p3art_jmarket_*). Wraps NC.Hub.tab('market') / ('report'). */
(function () {
  'use strict';
  const NC = window.NC, H = NC.Hub, MAT = NC.MATERIALS, ITEMS = NC.ITEMS;
  if (!H || !MAT) return;
  const esc = H.esc, fmt = (n) => NC.fmtCoins(n || 0), G = () => NC.game;
  const ART = 'assets/p3/jmarket/';
  const coin = () => NC.matIcon('ic_coin');
  const num = (n) => Math.round(n || 0).toLocaleString('en-US');
  const isPort = () => document.documentElement.classList.contains('mob-port');

  // =====================================================================================================================
  // the 7-day price history (economy.js keeps none): the day's last price of every material, the last 7 calendar days
  // =====================================================================================================================
  const HKEY = 'nightcamp.p3market.v1';
  const dayOf = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const today = () => dayOf(new Date());
  const days7 = () => { const d = new Date(), out = []; for (let i = 6; i >= 0; i--) out.push(dayOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i))); return out; };
  let hist = { days: {} };
  try { if (!NC.ONLINE) { const o = JSON.parse(localStorage.getItem(HKEY) || 'null'); if (o && o.days) hist = o; } } catch (e) { /* blocked */ }
  const canSave = () => !NC.ONLINE && !(NC.game && NC.game.noSave);
  const saveHist = () => { if (canSave()) try { localStorage.setItem(HKEY, JSON.stringify(hist)); } catch (e) { /* blocked */ } };
  const tradable = (id) => !!MAT[id] && MAT[id].base > 0 && !MAT[id].keep;
  function record() {
    const keep = new Set(days7()), k = today();
    let ch = false;
    for (const d of Object.keys(hist.days)) if (!keep.has(Number(d))) { delete hist.days[d]; ch = true; }
    const row = hist.days[k] || (hist.days[k] = {});
    for (const id in MAT) if (tradable(id)) { const v = MAT[id].price; if (v > 0 && row[id] !== v) { row[id] = v; ch = true; } }
    if (ch) saveHist();
  }
  setInterval(record, 30000);
  const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const dayName = (d) => `${d % 100} ${TH_MON[Math.floor(d / 100) % 100 - 1]}`;

  // =====================================================================================================================
  // Uncle Coco: selling is done at his stall (as in his own window, js/shopwin.js)
  // =====================================================================================================================
  const nearCoco = (g) => { const S = NC.Shop, p = g && g.player; return !!(S && p && g.world && g.world.shop && p.dead <= 0 && NC.dist(p.x, p.y, S.npc.x, S.npc.y) < S.talk + 40); };
  const nearStall = (g) => { const S = NC.Shop, p = g && g.player; return !!(S && p && g.world && g.world.shop && NC.dist(p.x, p.y, S.npc.x, S.npc.y) < S.talk + 40); }; // (economy.js's own test for the broker)
  function walkCoco(g) {
    const S = NC.Shop;
    if (!S || !g) return;
    NC.HUD.panel('journal', false); g.paused = false;
    const back = () => H.open('market');
    if (NC.CraftGo && NC.CraftGo.walkTo) NC.CraftGo.walkTo(g, { x: S.npc.x, y: S.npc.y + 90, name: 'ลุงโกโก้', near: () => nearCoco(G()), then: back });
    else if (NC.Travel && NC.Travel.go) { NC.Travel.go(g, { map: 'camp', x: S.npc.x, y: S.npc.y + 90, r: 150, name: 'ลุงโกโก้', done: () => setTimeout(back, 200) }); g.toast('กำลังเดินไปหาลุงโกโก้ · เดินเองเพื่อหยุด'); }
  }
  function sellMat(g, id, n) {
    const p = g.player, M = MAT[id], have = NC.matCount(p, id);
    n = Math.min(n, have);
    if (!M || n <= 0 || M.noNpc) return 0;
    const got = NC.Econ && NC.Econ.sell ? NC.Econ.sell(g, id, n) : n * M.price; // (piece by piece: economy.js)
    if (!(got > 0)) return 0;
    p.mats[id] = have - n;
    if (!p.mats[id]) delete p.mats[id];
    p.coins = (p.coins || 0) + got;
    NC.HUD.log(`ขาย ${M.name} ×${n} ได้ ${fmt(got)} เหรียญ`, 'item');
    if (NC.Shop && NC.Shop.npc) { NC.Shop.npc.say = 'ขอบใจจ้า~'; NC.Shop.npc.sayT = 3; NC.Shop.npc.wave = 1; }
    NC.saveGame(g); record();
    return got;
  }
  // why a material can't go to Uncle Coco right now ('' = it can)
  function why(g, id) {
    const M = MAT[id], p = g.player;
    if (!M || NC.matCount(p, id) <= 0) return 'none';
    if (M.noNpc) return 'nonpc';
    if (NC.invLocked && NC.invLocked(id)) return 'lock';
    if (!nearCoco(g)) return 'away';
    return '';
  }

  // =====================================================================================================================
  // ตลาด (mockup B)
  // =====================================================================================================================
  const TM = H.tab('market');
  let tab = 'today', sel = null, sortBy = '', armed = null, flash = 0, bk = { id: '', n: 1, price: 0 };
  const baseClick = TM && TM.click;
  const tier = (id) => { const M = MAT[id]; return M.rare || M.base >= 500 ? 't-lav' : M.base >= 150 ? 't-sky' : 't-cream'; };
  const arrow = (M) => (M.price > M.base ? '<i class="p3m-ar up" title="สูงกว่าราคาปกติ"></i>' : M.price < M.base ? '<i class="p3m-ar down" title="ต่ำกว่าราคาปกติ"></i>' : '<i class="p3m-ar eq" title="เท่าราคาปกติ"></i>');
  const pcol = (M) => (M.price > M.base ? 'up' : M.price < M.base ? 'down' : '');
  const soldOf = (id) => ((NC.Econ && NC.Econ.state && NC.Econ.state.sold) || {})[id] || 0;
  const week = () => (NC.Econ && NC.Econ.week ? NC.Econ.week() : []).filter((id) => MAT[id]);
  const pouch = (p) => Object.keys(p.mats || {}).filter((id) => tradable(id) && NC.matCount(p, id) > 0);
  const SORTS = [['name', 'วัตถุดิบ'], ['have', 'มี'], ['base', 'ราคาปกติ'], ['price', 'วันนี้'], ['sold', 'ขายวันนี้แล้ว']];
  function sorted(p, ids) {
    const by = { name: (a, b) => MAT[a].name.localeCompare(MAT[b].name, 'th'), have: (a, b) => NC.matCount(p, b) - NC.matCount(p, a),
      base: (a, b) => MAT[b].base - MAT[a].base, price: (a, b) => MAT[b].price - MAT[a].price, sold: (a, b) => soldOf(b) - soldOf(a) }[sortBy];
    return by ? ids.slice().sort(by) : ids;
  }
  const isArmed = (k) => !!(armed && armed.k === k && performance.now() - armed.t < 3000);
  const quote = (g, id, n) => (NC.Econ && NC.Econ.quote ? NC.Econ.quote(id, n, g.player) : n * MAT[id].price);

  function head(game) {
    const tabs = [['today', 'ราคาวันนี้'], ['broker', 'นายหน้าฝากขาย'], ['shops', 'ร้านผู้เล่น']];
    return '<div class="p3m-head"><div class="p3m-ht"><h2>ตลาด</h2><p>ภาษีตลาด 5% · ราคารับซื้อรีเซ็ตทุกเช้า</p></div>' +
      `<span class="p3m-coins" title="เหรียญที่มี"><img src="${coin()}" alt=""><b>${fmt(game.player.coins)}</b></span></div>` +
      `<nav class="kw-tabs p3m-tabs">${tabs.map(([k, n]) => `<button class="kw-tab${tab === k ? ' on' : ''}" data-p3mk="${k}">${n}</button>`).join('')}</nav>`;
  }

  function chart(id) {
    const ds = days7(), have = ds.filter((d) => hist.days[d] && hist.days[d][id] > 0);
    const max = Math.max(1, ...have.map((d) => hist.days[d][id])), t = today();
    const bars = ds.map((d) => {
      const v = hist.days[d] && hist.days[d][id];
      const lab = d === t ? 'วันนี้' : String(d % 100);
      return v > 0 ? `<div class="p3m-bar${d === t ? ' now' : ''}" title="${dayName(d)}: ${fmt(v)} เหรียญ"><span>${fmt(v)}</span><i style="height:${Math.max(8, (v / max) * 100).toFixed(1)}%"></i><small>${lab}</small></div>`
        : `<div class="p3m-bar none" title="${dayName(d)}: ไม่มีข้อมูล"><i></i><small>${lab}</small></div>`;
    }).join('');
    const first = Object.keys(hist.days).map(Number).filter((d) => hist.days[d][id] > 0).sort()[0];
    const note = have.length < 7 ? `<small class="p3m-chnote">ยังเก็บข้อมูลไม่ครบ 7 วัน${first ? ` · เริ่มเก็บ ${dayName(first)}` : ''}</small>` : '';
    return `<div class="p3m-chart">${bars}</div>${note}`;
  }

  function detail(game, id) {
    const p = game.player;
    if (!id || !MAT[id]) return '<aside class="kw-card p3m-card p3m-cempty"><div class="p3m-q">?</div><p>ยังไม่มีวัตถุดิบในกระเป๋า<br>ไปล่ามอนแล้วเอาของมาขายที่นี่</p></aside>';
    const M = MAT[id], have = NC.matCount(p, id), sold = soldOf(id), w = why(game, id), wk = week().includes(id);
    let foot = '';
    if (w === 'none') foot = `<div class="p3m-src"><b>ได้จาก</b> ${esc((NC.matSource && NC.matSource(id)) || '—')}</div>`;
    else if (w === 'nonpc') foot = '<div class="p3m-why">ลุงโกโก้ไม่รับซื้อชิ้นนี้ · ขายให้ผู้เล่นได้ในร้านของเรา</div><div class="p3m-btns"><button class="kw-btn gold" data-p3mk="shops">ไปที่ร้านผู้เล่น</button></div>';
    else {
      const allK = 'd:' + id;
      if (w === 'away') foot += `<div class="p3m-walk${performance.now() - flash < 1600 ? ' pulse' : ''}"><small>ขายได้ที่แผงลุงโกโก้กลางค่าย</small><button class="kw-btn gold" data-p3walk="1">พาเดินไปหาลุงโกโก้</button></div>`;
      if (w === 'lock') foot += '<div class="p3m-why">ชิ้นนี้ล็อกไว้ในกระเป๋า · ปลดล็อกในกระเป๋า (I) ก่อนขาย</div>';
      foot += `<div class="p3m-btns"><button class="kw-btn blue" data-p3do="one">ขาย 1</button><button class="kw-btn gold${isArmed(allK) ? ' armed' : ''}" data-p3do="all">${isArmed(allK) ? 'กดอีกครั้ง' : 'ขายหมด'}</button></div>` +
        `<small class="p3m-quote">${isArmed(allK) ? 'ยืนยันขาย' : 'ขายหมด'} ${num(have)} ชิ้น ได้ <b>${fmt(quote(game, id, have))}</b> เหรียญ</small>`;
    }
    return `<aside class="kw-card p3m-card" data-id="${id}">` +
      `<div class="p3m-dtop"><span class="p3m-dic ${tier(id)}"><img src="${NC.matIcon(id)}" alt="">${wk ? '<i class="p3m-rib">×1.5</i>' : ''}</span>` +
      `<div class="p3m-dname"><b>${esc(M.name)}</b><small>ราคาวันนี้</small><div class="p3m-big ${pcol(M)}"><img src="${coin()}" alt=""><em>${fmt(M.price)}</em></div></div></div>` +
      `<dl class="p3m-dl"><dt>มี</dt><dd>${num(have)}</dd><dt>ราคาปกติ</dt><dd>${fmt(M.base)}</dd><dt>ขายวันนี้แล้ว</dt><dd>${num(sold)}${sold > 400 ? ' <small>(ราคาลด)</small>' : ''}</dd></dl>` +
      `<div class="p3m-chh">ราคา 7 วัน</div>${chart(id)}<div class="p3m-foot">${foot}</div></aside>`;
  }

  function todayHtml(game) {
    const p = game.player, wk = week(), mine = pouch(p);
    if (!sel || !MAT[sel]) sel = mine[0] || wk[0] || null;
    const wcards = wk.map((id) => `<button class="p3m-wc ${tier(id)}${id === sel ? ' sel' : ''}" data-p3sel="${id}" title="${esc(MAT[id].name)} · ${esc((NC.matSource && NC.matSource(id)) || '')}">` +
      `<i class="p3m-rib">×1.5</i><img src="${NC.matIcon(id)}" alt=""><b class="${MAT[id].name.length > 13 ? 'long' : ''}">${esc(MAT[id].name)}</b><span class="p3m-wp"><img src="${coin()}" alt="">${fmt(MAT[id].price)}</span></button>`).join('');
    const cards = sorted(p, mine).map((id) => {
      const M = MAT[id], w = why(game, id), k = 'c:' + id;
      const btn = w === 'nonpc' ? '<button class="kw-btn grey p3m-sell" data-p3sell="' + id + '">ร้านผู้เล่น</button>'
        : w === 'lock' ? '<button class="kw-btn grey p3m-sell" data-p3sell="' + id + '">ล็อกอยู่</button>'
          : `<button class="kw-btn ${isArmed(k) ? 'gold armed' : 'blue'} p3m-sell" data-p3sell="${id}">${isArmed(k) ? 'กดอีกครั้ง' : 'ขาย'}</button>`;
      return `<div class="p3m-pc${id === sel ? ' sel' : ''}" data-p3sel="${id}"><img class="ic" src="${NC.matIcon(id)}" alt="">` +
        `<div class="t"><b>${esc(M.name)}</b><small>มี ${num(NC.matCount(p, id))}</small>` +
        `<div class="pr"><em class="${pcol(M)}">${fmt(M.price)}</em>${arrow(M)}</div>` +
        `<div class="mini"><span title="ราคาปกติ">${fmt(M.base)}</span><span title="ขายวันนี้แล้ว">${num(soldOf(id))}</span></div>${btn}</div></div>`;
    }).join('');
    return '<div class="p3m-body">' +
      `<section class="p3m-want"><div class="p3m-wh">ตลาดรับซื้อสัปดาห์นี้ · <span>ลุงโกโก้ให้ ×1.5</span></div><div class="p3m-wrow">${wcards}</div></section>` +
      detail(game, sel) +
      '<section class="p3m-pouch"><div class="p3m-ph">ของในกระเป๋า: ราคาวันนี้' + (mine.length ? ` <small>${mine.length} ชนิด</small>` : '') + '</div>' +
      (mine.length ? `<div class="p3m-sort">${SORTS.map(([k, n]) => `<button class="${sortBy === k ? 'on' : ''}" data-p3sort="${k}" title="เรียงตาม${n}">${n}${sortBy === k ? (k === 'name' ? ' ▲' : ' ▼') : ''}</button>`).join('')}</div>` +
        `<div class="p3m-grid">${cards}</div>` : '<div class="p3m-none"><span class="p3m-q">?</span>ยังไม่มีวัตถุดิบในกระเป๋า · ล่ามอนแล้วของจะมาอยู่ที่นี่</div>') +
      '<div class="p3m-note">ขายชนิดเดียวกันเกิน 400 ชิ้นในวันเดียว ราคาจะค่อย ๆ ลดลง (ต่ำสุด 40%) และกลับเป็นปกติพรุ่งนี้ · ของที่ขายไม่หมดลองฝากนายหน้า หรือขายในร้านผู้เล่น</div>' +
      '</section></div>';
  }

  // ---------------- the broker (economy.js's rules; listing via NC.Econ.brokerList, ถอนคืน via its own click) ----------------
  const maxList = () => 5 + (NC.Card && NC.Card.active && NC.Card.active() ? 3 : 0);
  const fee = () => Math.max(10, Math.round(bk.n * bk.price * 0.01));
  function speed(id, price) { // (economy.js's buyers: above 1.5x the base nobody buys; the nearer today's market, the sooner)
    const M = MAT[id], st = NC.Econ.state, n = (st.sold || {})[id] || 0, market = Math.max(1, M.base * (n <= 400 ? 1 : Math.max(0.4, 1 - (n - 400) / 5000)));
    const k = price > M.base * 1.5 ? 0 : Math.max(0.02, Math.min(1, 1.6 - price / market));
    return k <= 0 ? ['none', 'แพงเกินไป ไม่มีใครซื้อ'] : k >= 0.6 ? ['fast', 'ขายไว'] : k >= 0.3 ? ['mid', 'ขายได้เรื่อย ๆ'] : ['slow', 'ขายช้า'];
  }
  function brokerHtml(game) {
    const p = game.player, st = NC.Econ.state, near = nearStall(game);
    const mats = Object.keys(p.mats || {}).filter((id) => tradable(id) && !MAT[id].noNpc && NC.matCount(p, id) > 0);
    if (!bk.id || !mats.includes(bk.id)) bk = { id: mats[0] || '', n: 1, price: mats[0] ? Math.round(MAT[mats[0]].base * 1.3) : 0 };
    const active = st.broker.filter((L) => L.n > 0).length, M = MAT[bk.id];
    const rows = st.broker.map((L, i) => {
      const m = MAT[L.id] || { name: L.id }, pct = L.n0 ? ((L.sold || 0) / L.n0) * 100 : 0;
      return `<div class="p3m-lr${L.n <= 0 ? ' done' : ''}"><span class="p3m-lic"><img src="${NC.matIcon(L.id)}" alt=""></span><div class="t"><b>${esc(m.name)}</b>` +
        `<small>${fmt(L.price)} เหรียญ / ชิ้น · ขายแล้ว ${num(L.sold || 0)} / ${num(L.n0)} · ได้ ${fmt(L.got || 0)}</small><div class="p3m-pbar"><i style="width:${pct.toFixed(1)}%"></i></div></div>` +
        `<button class="kw-btn ${L.n > 0 ? 'grey' : 'blue'}" data-unlist="${i}">${L.n > 0 ? 'ถอนคืน' : 'เอาออก'}</button></div>`;
    }).join('');
    const picks = mats.map((id) => `<button class="p3m-cell ${tier(id)}${id === bk.id ? ' sel' : ''}" data-p3bkpick="${id}" title="${esc(MAT[id].name)}"><img src="${NC.matIcon(id)}" alt=""><b>${num(NC.matCount(p, id))}</b></button>`).join('');
    let card;
    if (!M) card = '<aside class="kw-card p3m-card p3m-cempty"><div class="p3m-q">?</div><p>ยังไม่มีวัตถุดิบให้ฝาก<br>ล่ามอนแล้วเอาของมาฝากขายที่นี่</p></aside>';
    else {
      const sp = speed(bk.id, bk.price), full = active >= maxList();
      card = `<aside class="kw-card p3m-card p3m-bkcard">` +
        `<div class="p3m-dtop"><span class="p3m-dic ${tier(bk.id)}"><img src="${NC.matIcon(bk.id)}" alt=""></span>` +
        `<div class="p3m-dname"><b>${esc(M.name)}</b><small>ราคาปกติ</small><div class="p3m-big"><img src="${coin()}" alt=""><em>${fmt(M.base)}</em></div></div></div>` +
        `<label class="p3m-fl">จำนวน <small>(มี ${num(NC.matCount(p, bk.id))})</small></label>` +
        `<div class="p3m-step"><button class="p3m-sb" data-p3bkq="n-">−</button><input class="p3m-in" id="p3bk-n" type="number" min="1" max="${Math.min(999, NC.matCount(p, bk.id))}" value="${bk.n}"><button class="p3m-sb" data-p3bkq="n+">+</button><button class="p3m-chip" data-p3bkq="nall">ทั้งหมด</button></div>` +
        `<label class="p3m-fl">ราคาต่อชิ้น <small>(สูงสุด ${fmt(M.base * 3)})</small></label>` +
        `<div class="p3m-step"><button class="p3m-sb" data-p3bkq="p-">−</button><input class="p3m-in" id="p3bk-p" type="number" min="1" max="${M.base * 3}" value="${bk.price}"><button class="p3m-sb" data-p3bkq="p+">+</button></div>` +
        `<div class="p3m-chips"><button class="p3m-chip" data-p3bkq="x1">ราคาปกติ</button><button class="p3m-chip" data-p3bkq="x1.2">×1.2</button><button class="p3m-chip" data-p3bkq="x1.3">×1.3</button><button class="p3m-chip" data-p3bkq="x1.5">×1.5</button></div>` +
        `<dl class="p3m-dl"><dt>ค่าฝาก (1%)</dt><dd id="p3bk-fee">${fmt(fee())}</dd><dt>ความเร็ว</dt><dd class="p3m-sp ${sp[0]}" id="p3bk-sp">${sp[1]}</dd></dl>` +
        '<div class="p3m-foot">' + (near ? '' : `<div class="p3m-walk${performance.now() - flash < 1600 ? ' pulse' : ''}"><small>ฝากขายได้ที่ร้านลุงโกโก้กลางค่าย</small><button class="kw-btn gold" data-p3walk="1">พาเดินไปหาลุงโกโก้</button></div>`) +
        (full ? `<div class="p3m-why">ช่องฝากเต็มแล้ว (${active} / ${maxList()}) · ถอนคืนหรือรอให้ขายหมดก่อน</div>` : '') +
        '<div class="p3m-btns"><button class="kw-btn gold p3m-wide" data-p3bk="go">ฝากขาย</button></div></div></aside>';
    }
    return '<div class="p3m-body">' +
      '<section class="p3m-want p3m-bkl"><div class="p3m-wh">นายหน้าฝากขาย · <span>ตั้งราคาเอง ขายได้แม้ตอนออกเกม</span></div>' +
      '<p class="p3m-lead">ฝากขายวัตถุดิบในราคาที่ตั้งเอง ผู้ซื้อจะมาเรื่อย ๆ แม้ตอนออกเกม ราคายิ่งใกล้ราคาปกติยิ่งขายไว (ค่าฝาก 1% ภาษีขาย 5%)</p>' +
      `<div class="p3m-ph">ของที่ฝากไว้ <small>${active} / ${maxList()}</small></div>` +
      (rows ? `<div class="p3m-list">${rows}</div>` : '<div class="p3m-none"><span class="p3m-q">?</span>ยังไม่ได้ฝากอะไรไว้ · เลือกวัตถุดิบด้านล่าง ตั้งราคา แล้วกดฝากขาย</div>') + '</section>' +
      card +
      `<section class="p3m-pouch"><div class="p3m-ph">เลือกวัตถุดิบที่จะฝาก${mats.length ? ` <small>${mats.length} ชนิด</small>` : ''}</div>` +
      (mats.length ? `<div class="p3m-cells">${picks}</div>` : '<div class="p3m-none"><span class="p3m-q">?</span>ยังไม่มีวัตถุดิบให้ฝาก</div>') + '</section></div>';
  }

  // ---------------- player shops (vend.js over the net) ----------------
  function shopsHtml(game) {
    const shops = NC.Net && NC.Net.remotes ? [...NC.Net.remotes.values()].filter((r) => r.shop && r.shop.items && r.shop.items.length) : [];
    const mapName = (id) => ((NC.MAPS && NC.MAPS[id]) || {}).name || id || '';
    const rows = shops.map((r, i) => {
      const icons = r.shop.items.slice(0, 5).map((L) => (MAT[L.id] ? `<img src="${NC.matIcon(L.id)}" alt="">` : ITEMS[L.id] ? `<canvas width="64" height="64" data-icon="${L.id}"></canvas>` : '')).join('');
      return `<div class="p3m-lr"><span class="p3m-lic shop"><img src="${H.icon('ic_market')}" alt=""></span><div class="t"><b>${esc(r.shop.name || r.name)}</b>` +
        `<small>${esc(r.name)} · ${r.shop.items.length} รายการ · ${esc(mapName(r.map))}</small><div class="p3m-sicons">${icons}</div></div>` +
        `<button class="kw-btn blue" data-p3shop="${i}">เดินไปที่ร้าน</button></div>`;
    }).join('');
    const open = !!(NC.Vend && NC.Vend.open);
    return '<div class="p3m-body">' +
      '<section class="p3m-want p3m-bkl"><div class="p3m-wh">ร้านผู้เล่น · <span>ร้านที่เปิดอยู่ตอนนี้</span></div>' +
      '<p class="p3m-lead">ร้านของผู้เล่นที่เปิดอยู่ตอนนี้ (ไปซื้อได้ที่ร้านของเขาในค่าย) · ตั้งร้านเองกด V ที่ค่าย</p>' +
      (rows ? `<div class="p3m-list">${rows}</div>` : '<div class="p3m-none big"><span class="p3m-q">?</span>ตอนนี้ยังไม่มีร้านผู้เล่นเปิดอยู่<br><small>เล่นออนไลน์ผ่านลิงก์ของเกมเพื่อเห็นร้านคนอื่น</small></div>') + '</section>' +
      `<aside class="kw-card p3m-card p3m-mine"><div class="p3m-dtop"><span class="p3m-dic t-sky"><img src="${H.icon('ic_market')}" alt=""></span>` +
      `<div class="p3m-dname"><b>ร้านของฉัน</b><small>สถานะ</small><div class="p3m-state ${open ? 'on' : ''}">${open ? 'เปิดอยู่' : 'ยังไม่เปิด'}</div></div></div>` +
      '<ul class="p3m-ul"><li>ตั้งร้านขายวัตถุดิบและอุปกรณ์ให้ผู้เล่นคนอื่นได้ที่ค่าย</li><li>ตั้งราคาเอง ผู้เล่นเดินมาซื้อที่ร้าน</li><li>หักภาษีตลาด 5% ของที่ขายได้</li><li>เดินเมื่อไหร่ร้านปิด</li></ul>' +
      `<div class="p3m-foot"><div class="p3m-btns"><button class="kw-btn gold p3m-wide" data-p3vend="1">${open ? 'ดูร้านของฉัน (V)' : 'ตั้งร้านของฉัน (V)'}</button></div></div></aside></div>`;
  }

  if (TM) {
    TM.render = function (el, game) {
      record();
      el.innerHTML = `<div class="p3m p3m-${tab}">${head(game)}${tab === 'broker' ? brokerHtml(game) : tab === 'shops' ? shopsHtml(game) : todayHtml(game)}</div>`;
      for (const cv of el.querySelectorAll('canvas[data-icon]')) try { cv.getContext('2d').drawImage(NC.itemIcon(cv.dataset.icon, 64), 0, 0); } catch (e) { /* (an icon not loaded) */ }
    };
    TM.click = function (e, game) {
      const t = (s) => e.target.closest(s);
      let b;
      if ((b = t('[data-p3mk]'))) { tab = b.dataset.p3mk; return true; }
      if ((b = t('[data-unlist]'))) return baseClick ? baseClick.call(this, e, game) : false; // (economy.js's own ถอนคืน)
      if ((b = t('[data-p3walk]'))) { walkCoco(game); return false; }
      if ((b = t('[data-p3sort]'))) { sortBy = sortBy === b.dataset.p3sort ? '' : b.dataset.p3sort; return true; }
      if ((b = t('[data-p3sell]'))) return sellClick(game, b.dataset.p3sell, true, 'c:' + b.dataset.p3sell);
      if ((b = t('[data-p3do]'))) return sellClick(game, sel, b.dataset.p3do === 'all', 'd:' + sel);
      if ((b = t('[data-p3sel]'))) {
        sel = b.dataset.p3sel; armed = null;
        if (isPort()) setTimeout(() => { const c = document.querySelector('#hb-page .p3m-card'); if (c) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 30);
        return true;
      }
      if ((b = t('[data-p3bkpick]'))) { bk = { id: b.dataset.p3bkpick, n: 1, price: Math.round(MAT[b.dataset.p3bkpick].base * 1.3) }; return true; }
      if ((b = t('[data-p3bkq]'))) { brokerQuick(game, b.dataset.p3bkq); return true; }
      if ((b = t('[data-p3bk]'))) { brokerGo(game); return true; }
      if ((b = t('[data-p3vend]'))) { if (NC.Vend && NC.Vend.setup) NC.Vend.setup(); else game.toast('ตั้งร้านได้ที่ค่าย (V)'); return false; }
      if ((b = t('[data-p3shop]'))) { goShop(game, Number(b.dataset.p3shop)); return false; }
      return false;
    };
    TM.input = function (e, game) {
      const M = MAT[bk.id];
      if (!M) return;
      if (e.target.id === 'p3bk-n') bk.n = Math.max(1, Math.min(999, NC.matCount(game.player, bk.id), Math.floor(Number(e.target.value) || 1)));
      else if (e.target.id === 'p3bk-p') bk.price = Math.max(1, Math.min(M.base * 3, Math.round(Number(e.target.value) || 1)));
      else return;
      const f = document.getElementById('p3bk-fee'), s = document.getElementById('p3bk-sp');
      if (f) f.textContent = fmt(fee());
      if (s) { const sp = speed(bk.id, bk.price); s.className = 'p3m-sp ' + sp[0]; s.textContent = sp[1]; }
    };
  }
  function sellClick(game, id, all, key) {
    if (!id || !MAT[id]) return false;
    sel = id;
    const w = why(game, id);
    if (w === 'away') { flash = performance.now(); game.toast('ขายได้ที่แผงลุงโกโก้กลางค่าย · กด "พาเดินไปหาลุงโกโก้"'); return true; }
    if (w === 'lock') { game.toast('ชิ้นนี้ล็อกไว้ในกระเป๋า · ปลดล็อกในกระเป๋า (I) ก่อนขาย'); return true; }
    if (w === 'nonpc') { tab = 'shops'; game.toast('ลุงโกโก้ไม่รับซื้อชิ้นนี้ · ตั้งร้านขายให้ผู้เล่นได้'); return true; }
    if (w === 'none') return true;
    const n = NC.matCount(game.player, id);
    if (all && n > 1 && !isArmed(key)) { // (a second click within 3 s confirms, like Uncle Coco's ขายทั้งหมด)
      armed = { k: key, t: performance.now() };
      setTimeout(() => { if (armed && armed.k === key && !isArmed(key)) { armed = null; H.refresh(); } }, 3100);
      return true;
    }
    armed = null;
    const got = sellMat(game, id, all ? n : 1);
    if (got > 0) game.toast(`ขาย ${MAT[id].name} ×${all ? num(n) : 1} ได้ ${fmt(got)} เหรียญ`);
    return true;
  }
  function brokerQuick(game, q) {
    const M = MAT[bk.id], have = Math.min(999, NC.matCount(game.player, bk.id));
    if (!M) return;
    if (q === 'n-') bk.n = Math.max(1, bk.n - 1);
    else if (q === 'n+') bk.n = Math.min(have, bk.n + 1);
    else if (q === 'nall') bk.n = Math.max(1, have);
    else if (q === 'p-') bk.price = Math.max(1, bk.price - Math.max(1, Math.round(M.base * 0.05)));
    else if (q === 'p+') bk.price = Math.min(M.base * 3, bk.price + Math.max(1, Math.round(M.base * 0.05)));
    else if (q[0] === 'x') bk.price = Math.max(1, Math.min(M.base * 3, Math.round(M.base * Number(q.slice(1)))));
  }
  function brokerGo(game) {
    const st = NC.Econ.state;
    if (!MAT[bk.id]) return;
    if (!nearStall(game)) { flash = performance.now(); game.toast('ฝากขายได้ที่ร้านลุงโกโก้กลางค่าย · กด "พาเดินไปหาลุงโกโก้"'); return; }
    if (st.broker.filter((L) => L.n > 0).length >= maxList()) { game.toast('ช่องฝากขายเต็มแล้ว · ถอนคืนหรือรอให้ขายหมดก่อน'); return; }
    const r = NC.Econ.brokerList(game, bk.id, bk.n, bk.price);
    if (r === 'fee') game.toast('เหรียญไม่พอจ่ายค่าฝาก');
    else if (r === 'no') game.toast('ฝากไม่ได้ (ของไม่พอ หรือช่องเต็ม)');
    else { game.toast(`ฝากขาย ${MAT[bk.id].name} ×${bk.n} แล้ว`); bk.n = 1; }
  }
  function goShop(game, i) {
    const shops = NC.Net && NC.Net.remotes ? [...NC.Net.remotes.values()].filter((r) => r.shop && r.shop.items && r.shop.items.length) : [];
    const r = shops[i];
    if (!r) { game.toast('ร้านนี้ปิดไปแล้ว'); H.refresh(); return; }
    NC.HUD.panel('journal', false); game.paused = false;
    if (NC.Travel && NC.Travel.go) { NC.Travel.go(game, { map: r.map || 'camp', x: r.x, y: r.y + 70, r: 110, name: r.shop.name || r.name, done: () => game.toast('ถึงร้านแล้ว · คลิกป้ายร้านเพื่อดูของ') }); game.toast(`กำลังเดินไปร้าน ${r.shop.name || r.name}`); }
    else game.toast('ร้านอยู่ในค่าย · คลิกป้ายร้านเพื่อดูของ');
  }

  // =====================================================================================================================
  // สรุปบอท (mockup A): the page and the pop-up
  // =====================================================================================================================
  const TR = H.tab('report');
  const RS = () => (NC.Report && NC.Report.state) || null;
  const rankOf = (id) => { const it = ITEMS[id], k = NC.gearKind ? NC.gearKind(it) : 'A'; return { L: 5, D: 4, C: 3, B: 2 }[k] || (it.rarity === 'legend' ? 4 : it.rarity === 'epic' ? 3 : 1); };
  const potIcon = () => ((NC.ASSET_MANIFEST || {}).ic_potion || {}).src || 'assets/ic_potion.png';
  const RCOL = { rare: '#2f7fd0', epic: '#8a4fd0', legend: '#b87800' }; // (report.js's rarity colours, darker on cream)
  function reportHtml(r, live, okBtn) {
    if (!r) return emptyHtml(okBtn);
    const mins = Math.max(1, Math.round(((r.t1 || Date.now()) - r.t0) / 60000)), hrs = mins / 60;
    const dur = mins >= 90 ? (mins / 60).toFixed(1) + ' ชั่วโมง' : mins + ' นาที';
    const drops = r.drops.filter(([id]) => ITEMS[id]).sort((a, b) => b[1] - a[1] || rankOf(b[0]) - rankOf(a[0]));
    const mats = Object.entries(r.mats).sort((a, b) => b[1] * ((MAT[b[0]] || {}).price || 0) - a[1] * ((MAT[a[0]] || {}).price || 0));
    const matVal = mats.reduce((s, [id, n]) => s + n * ((MAT[id] || {}).price || 0), 0);
    const mapName = esc((NC.MAPS[r.map] || {}).name || r.map || '');
    const tile = (ic, v, lab, sub) => `<div class="p3r-tile"><img src="${ART}${ic}.png" alt=""><b>${v}</b><span>${lab}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const pill = (cls, icon, a, b, lab) => `<div class="p3r-pill ${cls}">${icon}<span class="p3r-pt">${lab} ${a}${b > a ? ` <i>→</i> <em>${b}</em>` : ''}</span>${b > a ? '' : '<small>เท่าเดิม</small>'}<s class="sp1">✦</s><s class="sp2">✦</s><s class="sp3">✦</s></div>`;
    let h = `<div class="p3r-strip"><img src="${ART}rp_night.jpg" alt=""><span class="p3r-cap">${live ? 'กำลังฟาร์มอยู่' : 'สรุปคืนที่ผ่านมา'} · ${dur} · ${mapName}</span></div>`;
    h += '<div class="p3r-tiles">' +
      tile('rp_mon', num(r.kills), 'มอนที่ล่า', `(${num(r.kills / hrs)} ต่อชม.)`) +
      tile('rp_exp', num(r.xp), 'EXP', '') +
      tile('rp_job', num(r.jxp), 'Job EXP', '') +
      tile('rp_coin', fmt(matVal), 'ค่าวัตถุดิบที่เก็บได้', '(ราคาร้าน)') + '</div>';
    h += '<div class="p3r-pills">' + pill('p3r-lv', '<canvas class="p3r-face" data-face="1"></canvas>', r.lv0, r.lv1, 'Lv') +
      pill('p3r-job', `<img class="p3r-book" src="${ART}rp_job.png" alt="">`, r.jlv0, r.jlv1, 'Job') + '</div>';
    h += `<div class="p3r-dh">ของที่ดรอป <b>${drops.length} ชิ้น</b></div>`;
    h += drops.length ? '<div class="p3r-drops">' + drops.slice(0, 30).map(([id, sh, from]) => {
      const it = ITEMS[id], rare = sh || rankOf(id) >= 3;
      return `<div class="p3r-drop${rare ? ' rare' : ''}"><canvas width="128" height="128" data-icon="${id}"></canvas><div class="t"><b style="color:${RCOL[it.rarity] || 'inherit'}">${sh ? '✦ ' : ''}${esc(it.name)}</b><small>จาก${esc(from)}</small></div>` +
        (rare ? '<s class="sp1">✦</s><s class="sp2">✦</s><s class="sp3">✦</s>' : '') + '</div>';
    }).join('') + (drops.length > 30 ? `<div class="p3r-more">และอีก ${drops.length - 30} ชิ้นในกระเป๋า</div>` : '') + '</div>'
      : '<div class="p3r-nodrop"><span class="p3m-q">?</span>รอบนี้ไม่มีอุปกรณ์ดรอป · ของดีหายาก ลองรอบหน้า</div>';
    const mIcons = mats.slice(0, 2).map(([id]) => `<img src="${NC.matIcon(id)}" alt="">`).join('');
    h += '<div class="kw-card p3r-dark">' +
      `<div class="p3r-line"><span class="p3r-lic">${mIcons || `<img src="${ART}rp_coin.png" alt="">`}</span><p><b>วัตถุดิบ:</b> ${mats.length ? mats.slice(0, 16).map(([id, n]) => `${esc((MAT[id] || { name: id }).name)} ×${num(n)}`).join(' · ') : '—'}</p></div>` +
      `<div class="p3r-line"><span class="p3r-lic"><img src="${coin()}" alt=""><img src="${potIcon()}" alt=""></span><p><b>อื่น ๆ:</b> ได้เงิน ${fmt(r.earned)} · ใช้เงิน ${fmt(r.spent)} · ใช้ยา ${num(r.pots)} ขวด · หมดแรง ${num(r.faints)} ครั้ง${r.xpLost ? ` (เสีย EXP ${num(r.xpLost)})` : ''}</p></div></div>`;
    if (r.faints >= 3) h += '<div class="p3r-note">หมดแรงบ่อย ลองให้บอทกลับค่ายเร็วขึ้น ตั้งยาเพิ่ม หรือฟาร์มแมพที่เลเวลต่ำกว่านี้ · ขนนกไออุ่นที่ลุงโกโก้กันการเสีย EXP ได้</div>';
    if (okBtn) h += `<div class="p3r-ok"><button class="kw-btn gold" data-p3rok="1">เยี่ยม! ไปต่อ</button></div>`;
    return `<div class="p3r${live ? ' live' : ''}">${h}</div>`;
  }
  function emptyHtml(okBtn) {
    const A = NC.Auto;
    const ghost = (ic, lab) => `<div class="p3r-tile ghost"><img src="${ART}${ic}.png" alt=""><b>—</b><span>${lab}</span></div>`;
    return '<div class="p3r p3r-empty">' +
      `<div class="p3r-strip"><img src="${ART}rp_night.jpg" alt=""><span class="p3r-cap">ยังไม่มีสรุป · ปล่อยบอทฟาร์มแล้วกลับมาดูที่นี่</span></div>` +
      '<div class="p3r-ecard"><b>บอทฟาร์มให้ตอนเราไม่อยู่ แล้วสรุปให้อ่านตอนกลับมา</b>' +
      '<p>เปิดออโต้ฟาร์ม (Z) แล้วปล่อยให้ฟาร์มสักพัก (5 นาทีขึ้นไป) พอปิดหรือกลับมาเปิดเกม จะเห็นว่าเกิดอะไรขึ้นบ้าง: มอนที่ล่า EXP ของที่ดรอป วัตถุดิบ เงินที่ได้และใช้ไป</p>' +
      '<div class="p3r-tiles">' + ghost('rp_mon', 'มอนที่ล่า') + ghost('rp_exp', 'EXP') + ghost('rp_job', 'Job EXP') + ghost('rp_coin', 'ค่าวัตถุดิบ') + '</div>' +
      '<div class="p3r-pills">' +
        `<div class="p3r-pill p3r-lv ghost"><span class="p3m-q">?</span><span class="p3r-pt">Lv</span><small>เลเวลที่ขึ้นระหว่างฟาร์ม</small></div>` +
        `<div class="p3r-pill p3r-job ghost"><span class="p3m-q">?</span><span class="p3r-pt">Job</span><small>Job เลเวลที่ขึ้น</small></div></div>` +
      `<div class="p3r-ebtns"><button class="kw-btn gold" data-p3rauto="1">${A && A.on ? 'ออโต้ฟาร์มกำลังทำงาน' : 'เริ่มออโต้ฟาร์ม (Z)'}</button><button class="kw-btn blue" data-p3rset="1">ตั้งค่าออโต้ฟาร์ม</button></div></div>` +
      (okBtn ? '<div class="p3r-ok"><button class="kw-btn grey" data-p3rok="1">ปิด</button></div>' : '') + '</div>';
  }
  function paintReport(el, game) {
    for (const cv of el.querySelectorAll('canvas[data-icon]')) try { cv.getContext('2d').drawImage(NC.itemIcon(cv.dataset.icon, 128), 0, 0); } catch (e) { /* (an icon not loaded) */ }
    const p = game && game.player;
    for (const cv of el.querySelectorAll('canvas[data-face]')) {
      const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      const W = Math.max(8, Math.round(r.width * dpr)), Hh = Math.max(8, Math.round(r.height * dpr));
      cv.width = W; cv.height = Hh;
      if (!p) continue;
      const c = cv.getContext('2d');
      c.save(); c.beginPath(); c.arc(W / 2, Hh / 2, Math.min(W, Hh) * 0.48, 0, Math.PI * 2); c.clip();
      c.fillStyle = '#e4f2ff'; c.fillRect(0, 0, W, Hh);
      try { const eq = Object.assign({ glasses: null }, NC.lookEquip ? NC.lookEquip(p.equip) : p.equip), hs = NC.headSpot(eq), k = (Math.min(W, Hh) * 0.8) / hs.w; NC.drawAvatar(c, eq, W / 2 - hs.x * k, Hh * 0.6 - hs.y * k, k, 1, { noWeapon: true }); } catch (e) { /* (a look not loaded yet) */ }
      c.restore();
    }
  }
  function closeJournal(game) { NC.HUD.panel('journal', false); if (game) game.paused = false; }
  if (TR) {
    const baseRender = TR.render;
    TR.render = function (el, game) {
      try { baseRender.call(this, document.createElement('div'), game); } catch (e) { /* (its own side effects: marks the report read) */ }
      const S = RS();
      if (!S) { baseRender.call(this, el, game); return; }
      el.innerHTML = S.run ? reportHtml(S.run, true, false) + '<div class="p3r-prev">รอบก่อน</div>' + reportHtml(S.last, false, true) : reportHtml(S.last, false, true);
      paintReport(el, game);
    };
    const baseClickR = TR.click;
    TR.click = function (e, game) {
      if (e.target.closest('[data-p3rok]')) { closeJournal(game); return false; }
      if (e.target.closest('[data-p3rauto]')) { if (NC.Auto && !NC.Auto.on && NC.Auto.toggle) { closeJournal(game); NC.Auto.toggle(game); } else game.toast('ออโต้ฟาร์มทำงานอยู่ · กด Z เพื่อหยุด'); return false; }
      if (e.target.closest('[data-p3rset]')) { game.paused = NC.HUD.panel('autofarm', true); return false; }
      return baseClickR ? baseClickR.call(this, e, game) : false;
    };
  }

  // the pop-up: report.js builds .rp-pop once and fills #rp-body each time it shows; redraw the body in this design
  function fixPop(pop) {
    const b = pop.querySelector('#rp-body'), S = RS();
    if (!b || !S || pop.hidden || b.querySelector('.p3r')) return;
    pop.classList.add('p3r-pop');
    b.innerHTML = reportHtml(S.last, false, true);
    paintReport(b, G());
    const ok = b.querySelector('[data-p3rok]'), x = pop.querySelector('.kw-x');
    if (ok && x) ok.addEventListener('click', () => x.click()); // (report.js's own close: unpauses the game)
    for (const a of b.querySelectorAll('[data-p3rauto], [data-p3rset]')) a.addEventListener('click', () => { if (x) x.click(); const g = G(); if (!g) return; if (a.dataset.p3rset) g.paused = NC.HUD.panel('autofarm', true); else if (NC.Auto && !NC.Auto.on) NC.Auto.toggle(g); });
  }
  let popSeen = null;
  const watchPop = () => {
    const pop = document.querySelector('.rp-pop');
    if (!pop || pop === popSeen) return;
    popSeen = pop;
    const mo = new MutationObserver(() => fixPop(pop));
    mo.observe(pop, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
    fixPop(pop);
  };
  const bodyMo = new MutationObserver(() => { watchPop(); if (popSeen) bodyMo.disconnect(); });
  bodyMo.observe(document.body, { childList: true });
  watchPop();

  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) { baseInit(game); setTimeout(record, 2500); };
  NC.P3Market = { hist: () => hist, record }; // (tests: the price history)
})();
