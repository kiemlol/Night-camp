/* gacha.js — how the game earns (the Game Bible, pillar 9: cosmetics and convenience, never power; the user: "แฟชั่น
   ทั้งหมดจะไม่ดรอปจากมอน จะเป็นตู้กาชา").
     ตู้กาชาแฟชั่น  every fashion item (the onesies, the skins, the fashion hats) comes from here: a full costume 2%, a
                   fashion hat 18%, the rest small things (coins, season tokens, a warm feather). The rates are shown.
                   Pity: the 60th pull without a costume gives one. Each pull also gives a gacha star: 120 stars buy any
                   costume you pick. One pull 150 เพชรจันทร์, ten 1,350.
     เพชรจันทร์     the gacha's currency: bought with money (the shop is not open: the game needs its own payments) and a
                   little from playing (season tokens 100 -> 50, the week's chest, the season pass)
     พาสฤดูกาล     50 levels from the season tokens earned (dailies, the week's chest, world bosses): a free line (coins,
                   stones, feathers, gems) and a paid line of cosmetics (closed until payments exist)
     บัตรกองไฟ      the monthly card: storage, +3 broker slots, warps −30%, dailies wait 5 days, a few gems a day; no EXP or
                   drops (closed until payments exist; NC.Card.active())
   Saved: nightcamp.gacha.v1. Page: J → ตู้กาชา. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, H = NC.Hub;
  if (!H) return;
  const esc = H.esc, fmt = (n) => NC.fmtCoins(n), KEY = 'nightcamp.gacha.v1';
  const G = () => NC.game;
  let st = { gems: 0, tickets: 0, pity: 0, stars: 0, pulls: 0, passXp: 0, passGot: 0, lastTokens: null, log: [] };
  try { if (!NC.ONLINE) st = Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* blocked */ }
  const save = () => { if (G() && G().noSave) return; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* blocked */ } };
  NC.Card = { active: () => false };

  // ---------------- the pool ----------------
  const pool = () => {
    const all = Object.keys(ITEMS).filter((id) => ITEMS[id].rarity === 'fashion' && !ITEMS[id].founder && NC.itemReady(id)); // (founder: founder packs only, js/founder.js)
    return { top: all.filter((id) => ITEMS[id].slot !== 'hat'), hats: all.filter((id) => ITEMS[id].slot === 'hat') };
  };
  const RATES = [['top', 2], ['hat', 18], ['coins', 30], ['tokens', 30], ['feather', 20]];
  function pullOne(game) {
    const p = game.player, P = pool();
    st.pity++; st.stars++; st.pulls++;
    let kind;
    if (st.pity >= 60 && P.top.length) kind = 'top';
    else { let r = Math.random() * 100; kind = RATES.find(([, w]) => (r -= w) < 0)[0]; }
    let text = '';
    if ((kind === 'top' && P.top.length) || (kind === 'hat' && P.hats.length)) {
      const list = kind === 'top' ? P.top : P.hats, id = list[Math.floor(Math.random() * list.length)];
      const dup = p.owned.has(id);
      if (kind === 'top') st.pity = 0;
      if (dup) { st.stars += kind === 'top' ? 20 : 5; text = `${ITEMS[id].name} (ซ้ำ · ดาวกาชา +${kind === 'top' ? 20 : 5})`; }
      else { p.owned.add(id); p.fresh.add(id); text = ITEMS[id].name; }
      if (kind === 'top' && NC.Loot) NC.Loot.news(game, `${p.name || 'นักเดินทาง'} ได้ชุด ${ITEMS[id].name} จากตู้กาชา!`);
      return { kind, id, text };
    }
    if (kind === 'coins') { const c = 2000 + p.lv * 50; p.coins += c; text = `${fmt(c)} เหรียญ`; }
    else if (kind === 'tokens') { if (NC.Quests && NC.Quests.state) NC.Quests.state.tokens += 15; text = 'ตราฤดูกาล 15'; }
    else { p.feathers = (p.feathers || 0) + 1; text = 'ขนนกไออุ่น 1'; }
    return { kind, text };
  }
  function pull(game, n, tickets = false) {
    const cost = n === 10 ? 1350 : 150 * n;
    // A ticket is one ordinary draw, including pity and stars. Never fall back to spending gems.
    if (tickets) {
      if ((n !== 1 && n !== 10) || st.tickets < n) { game.toast('ตั๋วสุ่มแฟชั่นไม่พอ'); return null; }
      st.tickets -= n;
    } else {
      if (st.gems < cost) { game.toast('เพชรจันทร์ไม่พอ'); return null; }
      st.gems -= cost;
    }
    const out = [];
    for (let i = 0; i < n; i++) out.push(pullOne(game));
    st.log = out.concat(st.log).slice(0, 30);
    save(); NC.saveGame(game);
    return out;
  }
  function spark(game, id) {
    const p = game.player;
    if (st.stars < 120 || p.owned.has(id) || !ITEMS[id]) return;
    st.stars -= 120; p.owned.add(id); p.fresh.add(id); save(); NC.saveGame(game);
    NC.HUD.log(`แลกดาวกาชาได้ ${ITEMS[id].name}`, 'level');
  }

  // ---------------- the season pass: its XP is the season tokens earned ----------------
  const PASS = [];
  for (let l = 1; l <= 50; l++) PASS.push(l % 10 === 0 ? ['gems', 100] : l % 5 === 0 ? ['opt', 1] : l % 3 === 0 ? ['feather', 1] : l % 2 === 0 ? ['gems', 20] : ['coins', 3000 + l * 500]);
  const PREM = (l) => (l % 10 === 0 ? 'ชุดแฟชั่นประจำฤดูกาล' : l % 5 === 0 ? 'ท่าทางใหม่' : l % 2 === 0 ? 'เพชรจันทร์ 30' : 'กรอบชื่อ / สีย้อม');
  const passLv = () => Math.min(50, Math.floor(st.passXp / 100));
  setInterval(() => {
    const t = NC.Quests && NC.Quests.state ? NC.Quests.state.tokens : null;
    if (t === null) return;
    if (st.lastTokens !== null && t > st.lastTokens) { st.passXp += (t - st.lastTokens) * 10; save(); }
    st.lastTokens = t;
  }, 2000);
  function claimPass(game) {
    const p = game.player;
    while (st.passGot < passLv()) {
      const [k, v] = PASS[st.passGot++];
      if (k === 'gems') st.gems += v; else if (k === 'opt') NC.addMat(game, 'mat_opt_stone', v); else if (k === 'feather') p.feathers = (p.feathers || 0) + v; else p.coins += v;
    }
    save(); NC.saveGame(game);
  }
  const TH = { gems: (v) => `เพชรจันทร์ ${v}`, opt: (v) => `หินออฟ ${v}`, feather: (v) => `ขนนก ${v}`, coins: (v) => `${fmt(v)} เหรียญ` };

  // ---------------- the page ----------------
  let gtab = 'gacha', last = null, sparkPick = null;
  function render(el, game) {
    const p = game.player, P = pool();
    const tabs = [['gacha', 'ตู้กาชา'], ['pass', 'พาสฤดูกาล'], ['shop', 'เพชรจันทร์ · บัตรกองไฟ']];
    let h = `<div class="bb-h">ตู้กาชาแฟชั่น <small>ตั๋ว ${st.tickets.toLocaleString()} · เพชรจันทร์ ${st.gems.toLocaleString()} · ดาวกาชา ${st.stars}</small></div>` +
      `<div class="bb-chips">${tabs.map(([k, n]) => `<button class="bb-chip ${gtab === k ? 'on' : ''}" data-gt="${k}">${n}</button>`).join('')}</div>`;
    if (gtab === 'gacha') {
      h += `<div class="bb-tiles"><div class="bb-tile"><b>${60 - st.pity}</b><span>ครั้งที่เหลือถึงชุดเต็มแน่นอน</span></div><div class="bb-tile"><b>${st.stars}/120</b><span>ดาวกาชา (ครบ 120 เลือกชุดเองได้)</span></div>` +
        `<div class="bb-tile"><b>${P.top.filter((id) => p.owned.has(id)).length}/${P.top.length}</b><span>ชุดเต็มที่มี</span></div><div class="bb-tile"><b>${P.hats.filter((id) => p.owned.has(id)).length}/${P.hats.length}</b><span>หมวกแฟชั่นที่มี</span></div></div>` +
        `<div class="bb-form"><button class="kw-btn gold" data-pull="1" ${st.gems >= 150 ? '' : 'disabled'}>สุ่ม 1 ครั้ง · 150</button><button class="kw-btn gold" data-pull="10" ${st.gems >= 1350 ? '' : 'disabled'}>สุ่ม 10 ครั้ง · 1,350</button></div>`;
      h += `<div class="bb-ticket"><b>ตั๋วสุ่มแฟชั่น ${st.tickets.toLocaleString()} ใบ</b><small>1 ใบ = 1 ครั้ง · นับดาวและการันตีร่วมกับเพชร · เก็บไว้ได้ ไม่หมดอายุ · ผูกกับตัวละครที่รับ</small>` +
        `<div class="bb-form"><button class="kw-btn blue" data-ticket-pull="1" ${st.tickets >= 1 ? '' : 'disabled'}>ใช้ 1 ตั๋ว · สุ่ม 1 ครั้ง</button>` +
        `<button class="kw-btn blue" data-ticket-pull="10" ${st.tickets >= 10 ? '' : 'disabled'}>ใช้ 10 ตั๋ว · สุ่ม 10 ครั้ง</button></div></div>`;
      if (last) h += '<div class="bb-detail"><b>ได้</b><br>' + last.map((r) => `${r.kind === 'top' ? '🌟 ' : r.kind === 'hat' ? '✨ ' : ''}${esc(r.text)}`).join('<br>') + '</div>';
      h += '<div class="bb-h2">อัตรา</div><table class="bb-table"><tr><th>ของ</th><th class="num">โอกาส</th></tr>' +
        `<tr><td>ชุดแฟชั่นเต็มตัว (${P.top.length} แบบ)</td><td class="num">2%</td></tr><tr><td>หมวกแฟชั่น (${P.hats.length} แบบ)</td><td class="num">18%</td></tr>` +
        '<tr><td>เหรียญ</td><td class="num">30%</td></tr><tr><td>ตราฤดูกาล 15</td><td class="num">30%</td></tr><tr><td>ขนนกไออุ่น</td><td class="num">20%</td></tr></table>' +
        '<div class="bb-note">ครบ 60 ครั้งไม่ได้ชุดเต็ม ครั้งที่ 60 ได้แน่นอน · ได้ของซ้ำเปลี่ยนเป็นดาวกาชา · ชุดแฟชั่นใส่ทับอุปกรณ์ ไม่เพิ่มพลังโจมตี</div>';
      if (st.stars >= 120) h += '<div class="bb-h2">แลกดาวกาชา</div><div class="bb-grid">' + P.top.concat(P.hats).filter((id) => !p.owned.has(id)).map((id) => `<button class="bb-cell ${sparkPick === id ? 'sel' : ''}" data-spark="${id}"><canvas width="96" height="96" data-icon="${id}"></canvas></button>`).join('') + '</div>' +
        (sparkPick ? `<div class="bb-form"><button class="kw-btn gold" data-sparkgo="1">แลก ${esc(ITEMS[sparkPick].name)} (120 ดาว)</button></div>` : '');
    } else if (gtab === 'pass') {
      const lv = passLv();
      h += `<div class="bb-sub">เลเวลพาสมาจากตราฤดูกาลที่ได้ (รายวัน หีบสัปดาห์ บอสโลก) · ฤดูกาลที่ ${NC.Season ? NC.Season.seasonNo() : 1}</div>` +
        `<div class="bb-tiles"><div class="bb-tile"><b>${lv}/50</b><span>เลเวลพาส</span></div><div class="bb-tile"><b>${st.passXp % 100}/100</b><span>ไปเลเวลถัดไป</span></div>` +
        `<div class="bb-tile"><b>${lv - st.passGot}</b><span>รางวัลรอรับ</span></div><div class="bb-tile"><b>ปิดอยู่</b><span>ทางพรีเมียม</span></div></div>` +
        `<div class="bb-form"><button class="kw-btn gold" data-passget="1" ${lv > st.passGot ? '' : 'disabled'}>รับรางวัลทั้งหมด</button></div><table class="bb-table"><tr><th>เลเวล</th><th>ฟรี</th><th>พรีเมียม</th></tr>` +
        PASS.map(([k, v], i) => `<tr class="${i < st.passGot ? '' : i < lv ? 'me' : ''}"><td>${i + 1}</td><td>${TH[k](v)}${i < st.passGot ? ' ✔' : ''}</td><td style="opacity:.6">${PREM(i + 1)}</td></tr>`).join('') + '</table>';
    } else {
      h += '<div class="bb-h2">เพชรจันทร์</div><div class="bb-list">' + [[35, 150], [99, 450], [199, 950], [349, 1750], [699, 3700], [1190, 6600]].map(([b, g]) =>
        `<div class="bb-row"><img src="${H.icon('ic_moongem')}" alt=""><div class="t"><b>${g.toLocaleString()} เพชรจันทร์</b><small>${b} บาท</small></div><button class="kw-btn grey" disabled>ยังไม่เปิด</button></div>`).join('') + '</div>' +
        `<div class="bb-h2">แลกจากการเล่น</div><div class="bb-row"><img src="${H.icon('ic_seasontoken')}" alt=""><div class="t"><b>ตราฤดูกาล 100 → เพชรจันทร์ 50</b><small>มีตรา ${NC.Quests ? NC.Quests.tokens() : 0}</small></div>` +
        `<button class="kw-btn gold" data-tok="1" ${NC.Quests && NC.Quests.tokens() >= 100 ? '' : 'disabled'}>แลก</button></div>` +
        '<div class="bb-h2">บัตรกองไฟ (รายเดือน 149 บาท)</div><div class="bb-sub">คลังเพิ่ม 2 แท็บ · ช่องฝากขายเพิ่ม 3 · ค่าวาร์ปลด 30% · รายวันเก็บค้างได้ 5 วัน · เพชรจันทร์วันละ 30 · ไม่มี EXP หรือดรอปเพิ่ม</div>' +
        '<div class="bb-note">การเติมเงินต้องมีระบบชำระเงินและเซิร์ฟเวอร์ของเกมก่อน ตอนนี้เพชรจันทร์ได้จากการเล่นเท่านั้น</div>';
    }
    el.innerHTML = h;
    for (const cv of el.querySelectorAll('canvas[data-icon]')) cv.getContext('2d').drawImage(NC.itemIcon(cv.dataset.icon, 96), 0, 0);
  }
  H.add({ id: 'gacha', name: 'ตู้กาชา', icon: 'ic_gacha', order: 80, render,
    click(e, game) {
      const t = e.target.closest('[data-gt]'); if (t) { gtab = t.dataset.gt; return true; }
      const b = e.target.closest('[data-pull]'); if (b && !b.disabled) { last = pull(game, Number(b.dataset.pull)) || last; return true; }
      const ticket = e.target.closest('[data-ticket-pull]'); if (ticket && !ticket.disabled) { last = pull(game, Number(ticket.dataset.ticketPull), true) || last; return true; }
      const s = e.target.closest('[data-spark]'); if (s) { sparkPick = s.dataset.spark; return true; }
      if (e.target.closest('[data-sparkgo]') && sparkPick) { spark(game, sparkPick); sparkPick = null; return true; }
      if (e.target.closest('[data-passget]')) { claimPass(game); return true; }
      if (e.target.closest('[data-tok]') && NC.Quests && NC.Quests.spendTokens(100)) { st.gems += 50; save(); return true; }
      return false;
    },
    dot: () => passLv() > st.passGot });
  NC.Gacha = { state: st, pool, save }; // (save: js/topup.js after a test purchase)
})();
