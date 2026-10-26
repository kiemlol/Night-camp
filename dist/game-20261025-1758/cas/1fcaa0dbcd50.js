/* shopwin.js — Uncle Coco's shop / the material pouch (B) in the K look (css/kui.css + css/shopwin.css). Page 6 of the
   page-by-page redesign (2026-09-30): layout "A" of assets/gen/nightcamp_pg_shop_a_raw.png:
     left    Uncle Coco behind his counter (assets/kui/shop_coco.jpg: Codex, assets/gen/shop_coco_panel.prompt.txt) with a
             speech bubble: a greeting, his thanks after a sale; away from him: "come and sell at my stall"
     right   folder tabs ขายวัสดุ / ขายอุปกรณ์ / ซื้อของ / รีเซ็ตสกิล (all but the first only at his stall), then:
             ขาย     the materials we carry (never shadows of the rest) · the picked one's dark card: what it is, who drops
                     it, the price, how many we have, ขาย 1 / ขาย 10 / ขายหมด · the total and ขายทั้งหมด (click twice)
             อุปกรณ์  the gear pieces not worn, dearest first, at the bag's price (2026-10-19, a tester: gear was sold only
                     at the smith's or from the bag): the picked one's card with its rows and ขาย (click twice), the
                     bag's green / red arrow on each piece and its verdict line on the card (NC.WCmp); ขายหลายชิ้น
                     shows the bag's own bulk sale card (NC.gearBulkCard). The sales are js/gearbag.js's (saleList,
                     salePrice, sellMany), so online they are the bag's sellgear (js/online/gear.js)
             ซื้อ    the potions (NC.Shop.POTIONS)
             รีเซ็ต  the skill reset (one free gift per character, plus free to Base Lv 40; click twice)
   Same rules as shop.js (which it replaces on screen): the shop when the hero stands by Uncle Coco, else the pouch;
   locked items (inventory.js) are never sold; seeds (MAT.keep) stay out of "sell all". It takes over
   NC.HUD.panel('shop') (B, the menu's B button, a click on him, ?shop); the old #shop stays in the page, unused. */
(function () {
  'use strict';
  const NC = window.NC, S = NC.Shop, MAT = NC.MATERIALS;
  if (!S) return;
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => NC.fmtCoins(n);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const ART = 'assets/kui/shop_coco.jpg';
  const THANKS = ['ขอบใจจ้า~', 'ของดีเลยนะเนี่ย!', 'ลุงให้ราคาดีสุดแล้วนะ~'];
  const AWAY = 'มาขายที่แผงลุงกลางค่ายนะ~';

  let win = null, mode = 'pouch', tab = 'sell', sel = null, hover = null, allArmed = 0, resetArmed = 0, bubble = '';
  let gsel = null, ghover = null, gbulk = false, gArmed = 0; // (the gear tab: the picked piece, the one pointed at, the bulk card shown, a ขาย armed)
  const ids = () => Object.keys(MAT);
  // what "sell everything" sells: not the seeds (MAT.keep) and nothing locked in the bag
  // (the stones are no merchant's goods: noNpc; a sale is priced piece by piece by economy.js, NC.Econ.quote / sell)
  const sellable = (id) => !!MAT[id] && !MAT[id].keep && !MAT[id].noNpc && !(NC.invLocked && NC.invLocked(id));
  const valueOf = (p, id, n) => (NC.Econ && NC.Econ.quote ? NC.Econ.quote(id, n, p) : n * MAT[id].price);
  const worth = (p) => ids().reduce((s, id) => s + (sellable(id) ? valueOf(p, id, NC.matCount(p, id)) : 0), 0);
  const pieces = (p) => ids().reduce((s, id) => s + (sellable(id) ? NC.matCount(p, id) : 0), 0);
  const nearHim = (g) => S.canTrade(g);
  function say(text) { bubble = text; S.npc.say = text; S.npc.sayT = 3.6; S.npc.wave = 1; const b = $('sp-bubble'); if (b) { b.textContent = text; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); } }

  // ---------------- building the window ----------------
  function build() {
    win = document.createElement('div');
    win.id = 'shopwin'; win.className = 'kw-panel'; win.hidden = true;
    win.innerHTML = '<div class="sp-wrap"><section class="kw-win sp-win">' +
      `<header class="kw-title"><span id="sp-title"></span><span class="sp-coins" id="sp-coinbox"><img src="${NC.matIcon('ic_coin')}" alt=""><b id="sp-coins">0</b></span>` +
      '<button class="kw-x" id="sp-close" aria-label="ปิด">✕</button></header>' +
      `<div class="sp-body"><div class="sp-art" style="background-image:url(${ART})"><div class="sp-bubble" id="sp-bubble"></div></div>` +
        '<div class="sp-main"><nav class="kw-tabs sp-tabs" id="sp-tabs">' +
          '<button class="kw-tab" data-tab="sell">ขายวัสดุ</button>' + (NC.GEAR ? '<button class="kw-tab" data-tab="gear">ขายอุปกรณ์</button>' : '') +
          '<button class="kw-tab" data-tab="buy">ซื้อของ</button>' +
          (NC.Brew ? '<button class="kw-tab" data-tab="brew">ต้มยา</button>' : '') + '<button class="kw-tab" data-tab="reset">รีเซ็ตสกิล</button></nav>' + // (ต้มยา: js/brew.js)
          '<div class="sp-panel" id="sp-panel"></div></div></div>' +
      '</section></div>';
    document.body.appendChild(win);
    $('sp-close').addEventListener('click', close);
    $('sp-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b && !b.disabled && b.dataset.tab !== tab) { tab = b.dataset.tab; render(); } });
    const panel = $('sp-panel');
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const g = G();
      if (b.dataset.id) { sel = b.dataset.id; hover = null; render(); }
      else if (b.dataset.gear) { gsel = Number(b.dataset.gear); ghover = null; gbulk = false; gArmed = 0; render(); }
      else if (b.id === 'sp-gsell') sellGear(g, b);
      else if (b.id === 'sp-gbulk') { gbulk = true; ghover = null; render(); }
      else if (b.dataset.act && NC.gearBulkAct) bulkAct(g, b.dataset.act);
      else if (b.dataset.sell) sell(g, sel, b.dataset.sell === 'all' ? Infinity : +b.dataset.sell);
      else if (b.dataset.buy) { const [pid, n] = b.dataset.buy.split(':'); buy(g, pid, +n); }
      else if (b.dataset.walk) walkCoco(g, b.dataset.walk);
      else if (b.dataset.brew && NC.Brew && (mode === 'shop' || brewAway(g))) { const [rid, n] = b.dataset.brew.split(':'); if (NC.Brew.brew(g, rid, +n)) { say(pick(['ต้มเสร็จแล้ว หอมกรุ่นเลย~', 'ยาฝีมือลุง รับรองได้ผล!', 'วัสดุพวกนี้ต้มยาได้ดีจริง ๆ'])); coinFx(); render(); } }
      else if (b.id === 'sp-all') sellAll(g, b);
      else if (b.id === 'sp-reset') resetSkills(g, b);
    });
    panel.addEventListener('mouseover', (e) => {
      if (tab === 'gear') { const r = e.target.closest('[data-gear]'), u = r ? Number(r.dataset.gear) : null; if (u !== ghover) { ghover = u; renderGearCard(); } return; }
      const c = e.target.closest('.sp-cell'), id = c ? c.dataset.id : null;
      if (id !== hover) { hover = id; renderCard(); }
    });
    panel.addEventListener('mouseleave', () => {
      if (tab === 'gear') { if (ghover) { ghover = null; renderGearCard(); } }
      else if (hover) { hover = null; renderCard(); }
    });
  }

  // ---------------- open / close ----------------
  function open() {
    const g = G(), p = g.player;
    mode = nearHim(g) ? 'shop' : 'pouch';
    if (mode === 'pouch') tab = 'sell';
    hover = null; ghover = null; gbulk = false; allArmed = 0; resetArmed = 0; gArmed = 0;
    bubble = mode === 'shop' ? pick(S.GREET || ['ยินดีต้อนรับจ้า~']) : AWAY;
    if (mode === 'shop') S.npc.wave = 1.2;
    render();
    if (p.matNew) p.matNew.clear();
    if (NC.saveTrade) NC.saveTrade(g);
  }
  function close() {
    NC.HUD.panel('shop', false);
    const g = G();
    if (g) g.paused = false;
  }
  function fit() {
    const wrap = win.querySelector('.sp-wrap');
    wrap.style.transform = 'translate(-50%, -50%)';
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }
  addEventListener('resize', () => setTimeout(() => { if (win && !win.hidden) fit(); }, 0));

  // ---------------- drawing ----------------
  function render() {
    if (!win || win.hidden) return;
    const g = G(), p = g.player, shop = nearHim(g);
    const nextMode = shop ? 'shop' : 'pouch';
    if (mode !== nextMode) bubble = shop ? pick(S.GREET || ['ยินดีต้อนรับจ้า~']) : AWAY;
    mode = nextMode;
    $('sp-title').textContent = shop ? 'ร้านลุงโกโก้' : 'กระเป๋าวัสดุ';
    $('sp-coins').textContent = fmt(p.coins);
    $('sp-bubble').textContent = bubble;
    win.querySelector('.sp-art').classList.toggle('away', !shop);
    for (const b of $('sp-tabs').children) {
      b.classList.toggle('on', b.dataset.tab === tab);
      b.disabled = false; // (2026-10-17, the user: no dead clicks — away from him every tab opens, with a way there)
      b.title = !shop && STALL_ONLY[b.dataset.tab] ? STALL_ONLY[b.dataset.tab] + 'ได้ที่ร้านลุงโกโก้ กลางค่ายกลางป่า' : '';
    }
    // every click rebuilds the panel: keep where its lists were scrolled on the same tab (2026-10-19 Discord: clicking an
    // item sent the list back to the top; the way js/hub.js keeps its page)
    const panel = $('sp-panel'), sameTab = panel.dataset.tab === tab;
    const tops = sameTab ? SCROLLERS.map((s) => { const el = panel.querySelector(s); return el ? el.scrollTop : 0; }) : [];
    if (tab === 'buy') renderBuy(p);
    else if (tab === 'gear' && NC.GEAR) renderGear(p, shop);
    else if (tab === 'brew' && NC.Brew) $('sp-panel').innerHTML = NC.Brew.html(p);
    else if (tab === 'reset') renderReset(p);
    else renderSell(p, shop);
    if (!shop) away(g);
    fit();
    panel.dataset.tab = tab;
    if (sameTab) SCROLLERS.forEach((s, i) => { const el = tops[i] && panel.querySelector(s); if (el) el.scrollTop = tops[i]; });
  }
  const SCROLLERS = ['.sp-grid', '.sp-glist', '.sp-buy', '.sp-brew', '.sp-card', '.sp-reset'];
  // away from him (the pouch): buying and the skill reset are shown but done at his stall (a walk button where the
  // button would be); brewing works anywhere out of combat (js/craftgo.js); selling's hint leads to him too
  const brewAway = (g) => !!(NC.CraftGo && NC.CraftGo.ok(g));
  const STALL_ONLY = { buy: 'ซื้อของ', gear: 'ขายอุปกรณ์', reset: 'รีเซ็ตสกิล' }; // (the tabs done only at his stall)
  const walkBtn = (t, why) => `<div class="sp-go"><button class="kw-btn gold" data-walk="${t}">พาเดินไปหาลุงโกโก้</button><small>${esc(why)} · เดินไปเองอัตโนมัติ</small></div>`;
  function away(g) {
    const panel = $('sp-panel');
    if (STALL_ONLY[tab]) {
      panel.querySelectorAll('[data-buy], #sp-reset, #sp-gsell, #sp-gbulk').forEach((b) => { b.disabled = true; });
      const at = panel.querySelector('.sp-buy, .sp-reset, .sp-gleft');
      if (at && !panel.querySelector('.sp-go')) at.insertAdjacentHTML('afterbegin', walkBtn(tab, STALL_ONLY[tab] + 'ได้ที่ร้านลุงโกโก้กลางค่าย'));
    } else if (tab === 'brew') {
      const st = NC.CraftGo ? NC.CraftGo.state(g) : { ok: false, why: '' };
      if (!st.ok) panel.querySelectorAll('[data-brew]').forEach((b) => { b.disabled = true; b.title = st.why; });
      const at = panel.querySelector('.sp-brew');
      if (at && !panel.querySelector('.sp-anywhere')) at.insertAdjacentHTML('afterbegin', `<div class="sp-note sp-anywhere">${st.ok ? 'ต้มยาได้ทุกที่ตอนไม่ได้สู้ (งานฝีมือ Y)' : esc((st.why || 'ตอนนี้ต้มยาไม่ได้') + (st.left ? ` · รออีก ${st.left} วิ` : ''))}</div>`);
    }
  }
  function walkCoco(g, t) {
    close();
    const n = S.npc;
    if (NC.CraftGo && NC.CraftGo.walkTo) NC.CraftGo.walkTo(g, { x: n.x, y: n.y + 90, name: 'ลุงโกโก้', near: () => nearHim(G()), then: () => { tab = t; G().paused = NC.HUD.panel('shop', true); } });
  }
  // a material's slot colour: rare lavender, valuable gold, the rest light blue
  const tint = (id) => (MAT[id].rare ? 'r-rare' : MAT[id].price >= 60 ? 'r-gold' : 'r-blue');
  function renderSell(p, shop) {
    const have = ids().filter((id) => NC.matCount(p, id) > 0);
    if (!sel || !have.includes(sel)) sel = have[0] || null;
    const cells = have.map((id) => `<button class="sp-cell ${tint(id)}${id === sel ? ' sel' : ''}" data-id="${id}" title="${esc(MAT[id].name)}">` +
      `<img src="${NC.matIcon(id)}" alt=""><b>${fmt(NC.matCount(p, id))}</b>${NC.invLocked && NC.invLocked(id) ? '<i class="sp-lock">' + (NC.LOCK_SVG || '') + '</i>' : ''}</button>`).join('');
    $('sp-panel').innerHTML = '<div class="sp-sell"><div class="sp-left">' +
      (have.length ? `<div class="sp-grid kw-scroll">${cells}</div>` : '<div class="sp-empty">ยังไม่มีวัสดุในกระเป๋า<br>ไปล่ามอนสเตอร์ ตัดไม้ ขุดแร่ แล้วค่อยกลับมานะ</div>') +
      `<div class="sp-sum">มี ${have.length} ชนิด · ${fmt(pieces(p))} ชิ้น · มูลค่า <em>${fmt(worth(p))}</em> เหรียญ</div>` +
      (shop ? `<button class="kw-btn gold sp-all" id="sp-all"${pieces(p) ? '' : ' disabled'}>ขายทั้งหมด</button>` : '') +
      '</div><div class="sp-card kw-card" id="sp-card"></div></div>';
    renderCard();
  }
  function renderCard() {
    const box = $('sp-card');
    if (!box) return;
    const p = G().player, id = hover || sel, M = MAT[id];
    if (!M) { box.innerHTML = '<div class="sp-cempty">เลือกวัสดุทางซ้ายเพื่อดูรายละเอียด</div>'; return; }
    const n = NC.matCount(p, id), from = NC.matSource ? NC.matSource(id) : '', lock = !!(NC.invLocked && NC.invLocked(id));
    const can = mode === 'shop' && id === sel && !lock && !M.noNpc;
    box.innerHTML = `<div class="sp-cimg ${tint(id)}"><img src="${NC.matIcon(id)}" alt=""></div>` +
      `<div class="sp-cname${M.rare ? ' rare' : ''}">${esc(M.name)}</div>` +
      `<div class="sp-from"><span>ได้จาก:</span> ${esc(from || '—')}</div>` +
      (M.desc ? `<div class="sp-desc">${esc(M.desc)}</div>` : '') +
      `<div class="sp-line">ราคาขาย: <em>${fmt(M.price)}</em> เหรียญ / ชิ้น</div>` +
      `<div class="sp-line">มีอยู่ <em>${fmt(n)}</em>${n ? ` = <em>${fmt(n * M.price)}</em> เหรียญ` : ''}</div>` +
      (can ? '<div class="sp-btns">' +
        `<button class="kw-btn blue" data-sell="1"${n >= 1 ? '' : ' disabled'}>ขาย 1</button>` +
        `<button class="kw-btn grey" data-sell="10"${n >= 10 ? '' : ' disabled'}>ขาย 10</button>` +
        `<button class="kw-btn gold" data-sell="all"${n ? '' : ' disabled'}>ขายหมด</button></div>`
        : M.noNpc ? `<div class="sp-hint">${esc(M.npcNote || 'ลุงไม่รับซื้อหิน · ใช้ที่ป๋าหมูหริ่ง หรือขายในร้านผู้เล่น')}</div>`
        : lock ? '<div class="sp-hint">ล็อกไว้ในกระเป๋า (I) · ปลดล็อกก่อนถึงจะขายได้</div>'
        : mode === 'shop' ? '<div class="sp-hint">คลิกเพื่อเลือกแล้วขาย</div>' : '<div class="sp-hint">ขายได้ที่ร้านลุงโกโก้ กลางค่ายกลางป่า (แผงผ้าใบแดงขาว)</div>' + walkBtn('sell', 'ขายวัสดุได้ที่ร้านลุงโกโก้'));
  }
  // ---------------- the gear tab: the bag's pieces at the bag's price (js/gearbag.js) ----------------
  const GW = NC.GEAR, ITEMS = NC.ITEMS;
  const gIcons = new Map();
  const gIcon = (id) => {
    if (!gIcons.has(id)) try { gIcons.set(id, NC.itemIcon(id, 96).toDataURL()); } catch (e) { return ''; } // (its art not in yet: drawn next time)
    return gIcons.get(id);
  };
  // a piece's slot colour: moonlit lavender, epic / legend gold, the rest light blue (as the materials')
  // (js/gradetier.js css .sp-gimg.r-g0..4: the item's rarity in the bag's tints; two copies of one weapon tell apart by the grade gems in their tag)
  const gTint = (c) => (NC.copyGradeKey ? 'r-' + NC.copyGradeKey(c) : c.sh ? 'r-rare' : /epic|legend/.test(ITEMS[c.id].rarity) ? 'r-gold' : 'r-blue');
  const gType = (c) => { const it = ITEMS[c.id]; return `${NC.SLOT_NAME[it.slot] || 'เครื่องประดับ'}${it.lvReq ? ' · Lv ' + it.lvReq : ''}`; };
  const gStyle = (c) => (NC.copyStyle ? NC.copyStyle(c) : ''); // (js/gradetier.js: the dark card's name in its rarity colour; the cream rows show the grade tag with its gems)
  const gCmp = (f, p, c) => (NC.WCmp && NC.WCmp[f] ? NC.WCmp[f](p, c) : ''); // (the bag's compare, js/wcompare.js: the arrow on a piece, the verdict line on its card)
  function renderGear(p, shop) {
    const list = GW.saleList(p), today = NC.Econ && NC.Econ.gearFlow ? NC.Econ.gearFlow() : 1;
    if (!list.some((c) => c.u === gsel)) { gsel = list.length ? list[0].u : null; gArmed = 0; }
    const rows = list.map((c) => `<button class="sp-gitem${c.u === gsel && !gbulk ? ' sel' : ''}" data-gear="${c.u}">` +
      `<span class="sp-gimg ${gTint(c)}"><img src="${gIcon(c.id)}" alt="">${gCmp('badge', p, c)}</span>` +
      `<span class="sp-gt"><b>${esc(NC.copyName(c))}</b><small>${esc(gType(c))}${c.rows.length ? ` · ออฟ ${c.rows.length} แถว` : ''}${NC.copyTag ? NC.copyTag(c) : ''}</small></span>` +
      `<span class="sp-gprice"><img src="${NC.matIcon('ic_coin')}" alt="">${fmt(GW.salePrice(c))}</span></button>`).join('');
    $('sp-panel').innerHTML = '<div class="sp-sell sp-gear"><div class="sp-left sp-gleft">' +
      (list.length ? `<div class="sp-glist kw-scroll">${rows}</div>` : '<div class="sp-empty">ยังไม่มีอุปกรณ์ที่ขายได้<br>ชิ้นที่สวมอยู่ต้องถอดก่อนนะ</div>') +
      `<div class="sp-sum">ขายได้ ${fmt(list.length)} ชิ้น (ไม่นับที่สวมอยู่)${today < 1 ? ` · วันนี้รับ <em>${Math.round(today * 100)}%</em>` : ''}</div>` +
      `<button class="kw-btn gold sp-all${gbulk ? ' on' : ''}" id="sp-gbulk"${shop ? '' : ' disabled'}>ขายหลายชิ้น</button>` +
      '</div><div class="sp-card kw-card" id="sp-card"></div></div>';
    renderGearCard();
  }
  function renderGearCard() {
    const box = $('sp-card');
    if (!box || tab !== 'gear') return;
    const p = G().player;
    if (gbulk && !ghover && NC.gearBulkCard) { box.innerHTML = `<div class="sp-gbulkcard">${NC.gearBulkCard(p)}</div>`; return; } // (the bag's own card: js/gearbag.js)
    const c = GW.bag(p).find((x) => x.u === (ghover || gsel));
    if (!c) { box.innerHTML = '<div class="sp-cempty">เลือกอุปกรณ์ทางซ้ายเพื่อดูรายละเอียด</div>'; return; }
    const price = GW.salePrice(c), picked = c.u === gsel && !gbulk, shop = mode === 'shop';
    const armed = picked && gArmed && performance.now() - gArmed <= 3000;
    box.innerHTML = `<div class="sp-cimg ${gTint(c)}"><img src="${gIcon(c.id)}" alt="">${gCmp('badge', p, c)}</div>` +
      `<div class="sp-cname"${gStyle(c)}>${esc(NC.copyName(c))}</div>` +
      `<div class="sp-from">${esc(gType(c))}${NC.copyTag ? NC.copyTag(c) : ''}</div>` + gCmp('line', p, c) +
      (c.rows.length || c.taint ? `<div class="sp-grows">${NC.rowsHtml(c)}</div>` : '') +
      `<div class="sp-line">ราคาขาย: <em>${fmt(price)}</em> เหรียญ</div>` +
      (picked ? `<div class="sp-btns"><button class="kw-btn gold" id="sp-gsell"${shop ? '' : ' disabled'}>${armed ? `กดอีกครั้งเพื่อขาย ${fmt(price)} เหรียญ` : `ขาย ${fmt(price)} เหรียญ`}</button></div>` +
        `<div class="sp-hint">${shop ? 'กดสองครั้งเพื่อขาย · วันละ 15 ชิ้นแรกได้ราคาเต็ม' : 'ขายได้ที่ร้านลุงโกโก้ กลางค่ายกลางป่า (แผงผ้าใบแดงขาว)'}</div>`
        : '<div class="sp-hint">คลิกเพื่อเลือกแล้วขาย</div>');
  }
  function renderBuy(p) {
    const P = S.POTIONS || [], many = P.length > 2; // (three sizes of each since 2026-10-04: js/potions.js — a tighter list, bigger buys)
    const ns = many ? [1, 10, 100] : [1, 5, 10];
    $('sp-panel').innerHTML = `<div class="sp-buy${many ? ' many' : ''}">` + P.map((q) =>
      `<div class="sp-pot"><span class="sp-pimg ${q.color === 'red' || q.id === 'red' ? 'red' : ''}"><img src="${q.icon}" alt=""></span><div class="sp-pt"><b>${esc(q.name)}</b><span>${esc(q.what)}</span><small>มีอยู่ ${fmt(p[q.key] || 0)} ขวด</small></div>` +
      `<div class="sp-price"><img src="${NC.matIcon('ic_coin')}" alt="">${fmt(q.price)}</div>` +
      `<div class="sp-pbtns">${ns.map((n) => `<button class="kw-btn ${n === 1 ? 'blue' : 'grey'}" data-buy="${q.id}:${n}"${S.buyPending || p.coins < q.price * n ? ' disabled' : ''}>ซื้อ ${n}</button>`).join('')}</div></div>`).join('') +
      `<div class="sp-note">${many ? 'ขวดใหญ่ฟื้นมากกว่าแต่แพงกว่า · ปุ่ม 1 / 2 เลือกขวดที่พอดีกับที่ขาดให้เอง (เปลี่ยนได้ที่ ESC → ตั้งค่า) · มอนดรอปยาให้บ้างนาน ๆ ที' : 'ยาแดงกับยาฟ้ายังดรอปจากมอนสเตอร์ได้เหมือนเดิม'}</div></div>`;
  }
  function renderReset(p) {
    // (the levels learned, p.skills: NC.skillLv reads 0 for a skill the weapon in hand can't use, and the reset gives those back too)
    const spent = NC.jobSkills(p).reduce((s, id) => s + Math.max(0, (p.skills[id] | 0) - NC.freeSkillLv(id)), 0), price = NC.skillResetPrice(p), gift = NC.skillResetGiftAvailable(p);
    const pending = NC.OnlineWorld && NC.OnlineWorld.skillResetPending && NC.OnlineWorld.skillResetPending();
    const giftKnown = !(NC.OnlineWorld && NC.OnlineWorld.ready) || p.skillResetUsed !== undefined;
    $('sp-panel').innerHTML = '<div class="sp-reset">' +
      `<span class="sp-rimg"><img src="${(NC.ASSET_MANIFEST.ic_skills || {}).src || 'assets/ic_skills.png'}" alt=""></span>` +
      '<div class="sp-rt"><b>ลงแต้มสกิลใหม่ทั้งหมด</b>' +
      `<span>แต้มสกิลที่ลงไปแล้ว <em>${spent}</em> แต้มกลับมาให้ลงใหม่ (สกิลที่ได้ฟรีตอนเริ่มยังอยู่) เหมาะกับการลองสายใหม่</span>` +
      `<span>สิทธิ์รีสกิลฟรี 1 ครั้งต่อตัวละคร: ${gift ? 'ยังไม่ได้ใช้' : giftKnown ? 'ใช้แล้ว' : 'กำลังตรวจสอบสิทธิ์'}</span>` +
      `<span>ราคา: ${price ? `<em>${fmt(price)}</em> เหรียญ (Base Lv เกิน 40)` : NC.skillResetCoinPrice(p) ? '<em>ฟรี</em> (ใช้สิทธิ์ครั้งนี้)' : '<em>ฟรี</em> จนถึง Base Lv 40'}</span>` +
      `<button class="kw-btn blue" id="sp-reset"${pending || !spent || p.coins < price ? ' disabled' : ''}>${pending ? 'กำลังรีเซ็ตสกิล…' : 'รีเซ็ตสกิล'}</button></div>` +
      '<div class="sp-note">Base Lv ไม่เกิน 40 รีสกิลฟรีโดยไม่ใช้สิทธิ์ · หลังใช้สิทธิ์ เลเวลเกิน 40 คิดเหรียญตามเลเวล</div></div>';
  }
  function coinFx() { const b = $('sp-coinbox'); if (b) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } }

  // ---------------- trading (the same rules as shop.js) ----------------
  function sell(g, id, n) {
    const p = g.player, M = MAT[id], have = NC.matCount(p, id);
    n = Math.min(n, have);
    if (!M || n <= 0 || mode !== 'shop' || M.noNpc || (NC.invLocked && NC.invLocked(id))) return;
    const got = NC.Econ && NC.Econ.sell ? NC.Econ.sell(g, id, n) : n * M.price; // (piece by piece: economy.js)
    p.mats[id] = have - n;
    if (!p.mats[id]) delete p.mats[id];
    p.coins += got;
    NC.HUD.log(`ขาย ${M.name} ×${n} ได้ ${fmt(got)} เหรียญ`, 'item');
    say(pick(THANKS));
    NC.saveGame(g);
    coinFx(); render();
  }
  function sellAll(g, btn) {
    const p = g.player;
    if (mode !== 'shop' || !pieces(p)) return;
    if (performance.now() - allArmed > 3000) { // a second click within 3 s confirms
      allArmed = performance.now();
      btn.textContent = `กดอีกครั้งเพื่อขาย (${fmt(worth(p))} เหรียญ)`;
      setTimeout(() => { if (btn.isConnected && performance.now() - allArmed >= 3000) btn.textContent = 'ขายทั้งหมด'; }, 3100);
      return;
    }
    allArmed = 0;
    let got = 0, n = 0;
    for (const id of Object.keys(p.mats)) if (sellable(id)) { const k = NC.matCount(p, id); got += NC.Econ && NC.Econ.sell ? NC.Econ.sell(g, id, k) : k * MAT[id].price; n += k; delete p.mats[id]; }
    p.coins += got;
    NC.HUD.log(`ขายวัสดุทั้งหมด ${fmt(n)} ชิ้น ได้ ${fmt(got)} เหรียญ`, 'item');
    say('เหมาหมดเลย! ขอบใจมากจ้า~');
    NC.saveGame(g);
    coinFx(); render();
  }
  // one piece: a second click within 3 s sells it through the bag's own sale (NC.GEAR.sellMany: at his stall, never a
  // worn piece, the day's count; online the bag's sellgear with its copy id, js/online/gear.js)
  function sellGear(g) {
    const c = GW.bag(g.player).find((x) => x.u === gsel);
    if (!c || mode !== 'shop') return;
    if (!gArmed || performance.now() - gArmed > 3000) {
      gArmed = performance.now(); renderGearCard();
      setTimeout(() => { if (gArmed && performance.now() - gArmed >= 3000) { gArmed = 0; if (win && !win.hidden) renderGearCard(); } }, 3100);
      return;
    }
    gArmed = 0;
    const r = GW.sellMany(g, [c.u]);
    if (r.n) { say(pick(THANKS)); coinFx(); }
    else if (r.why === 'far') say(AWAY);
    render();
  }
  // the bag's bulk sale card's buttons (its filters, its sale: NC.gearBulkAct); he thanks when pieces went
  function bulkAct(g, a) {
    const had = GW.bag(g.player).length;
    NC.gearBulkAct(g, a);
    if (GW.bag(g.player).length < had) { say('เหมาไปหลายชิ้นเลย! ขอบใจมากจ้า~'); coinFx(); }
    render();
  }
  function buy(g, pid, n) {
    if (S.buy(g, pid, n) && !(NC.Online && NC.Online.enabled)) {
      say(pick(['ใช้ให้คุ้มนะ~', 'ยาดีมีคุณภาพจ้า', 'ขอบใจจ้า~']));
      coinFx();
    }
    render();
  }
  function resetSkills(g, btn) {
    const p = g.player, price = NC.skillResetPrice(p);
    if (mode !== 'shop' || p.coins < price) return;
    if (NC.OnlineWorld && NC.OnlineWorld.skillResetPending && NC.OnlineWorld.skillResetPending()) return;
    if (!resetArmed || performance.now() - resetArmed > 3000) { // a second click within 3 s confirms
      resetArmed = performance.now();
      btn.textContent = price ? `กดอีกครั้งเพื่อจ่าย ${fmt(price)} เหรียญ` : 'กดอีกครั้งเพื่อยืนยัน';
      setTimeout(() => { if (btn.isConnected && performance.now() - resetArmed >= 3000) btn.textContent = 'รีเซ็ตสกิล'; }, 3100);
      return;
    }
    resetArmed = 0;
    if (!NC.resetSkills(g)) { render(); return; }
    say(NC.OnlineWorld && NC.OnlineWorld.ready ? 'กำลังรีเซ็ตสกิล…' : 'ลองสายใหม่ดูนะ สู้ ๆ!');
    coinFx(); render();
  }
  S.render = render;

  // ---------------- hooks: B, the menu's B button, a click on him, ?shop open this window ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) { baseInit(game); build(); };
  const baseUpdate = NC.HUD.update.bind(NC.HUD);
  NC.HUD.update = function (game) {
    baseUpdate(game);
    if (win && !win.hidden && (mode === 'shop') !== nearHim(game)) render();
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (win && id === 'shop') {
      const on = show === undefined ? win.hidden : show;
      basePanel('pause', false); // closes every other window
      win.hidden = !on;
      if (on) open();
      return on;
    }
    if (win) win.hidden = true;
    return basePanel(id, show);
  };
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || !win || win.hidden) return;
    e.stopImmediatePropagation(); e.preventDefault();
    close();
  }, true);
})();
