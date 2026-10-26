/* topupwin.js — the top-up window "เติมเพชรจันทร์ ช่วงทดสอบ", built from the mockup the user picked (2026-10-17: "เอา C
   ทำเเพคให้หน่อย ออกเเบบเเพคให้เลย"; assets/gen/nightcamp_topup_c_raw.png, prompts make_topup_prompts.py).
     top left     the painted banner (assets/topup/banner.jpg) with "เติมตอนนี้ · วันเปิดได้ x2"
     middle       the three founder packs big: a painting each (fd_<id>.jpg), three icons of what is inside, the price
     right        the x2 timeline (5 steps) and "ยอดเติมช่วงทดสอบ" (the ledger's totals, the launch payout)
     bottom       the eight gem packs as one strip (pk_<id>.png), "x2 วันเปิด" stamps, "แนะนำ" on the 799 pack
   A pack opens a confirm sheet with the conditions shown before paying (the Thai consumer-law rule of the design
   Artifact). The rules live in js/topup.js; online purchase requests go to the server.
   Open: the menu bar's moon gem button, the journal's gacha tab "เพชรจันทร์" (and its "ไปหน้าเพชรจันทร์" button),
   NC.HUD.panel('topup'), ?topup. Esc / ✕ close. Art: python tools/topup_cut.py. */
(function () {
  'use strict';
  const NC = window.NC, T = NC.TopUp;
  if (!T) return;
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n = (v) => Math.round(v).toLocaleString('en-US');
  const ART = (f) => `assets/topup/${f}`;
  const GEM = 'assets/bible/ic_moongem.png';
  const FD_COL = { f349: 'ember', f1290: 'fire', f3990: 'root' };
  const STEPS = [
    ['เติมในช่วงทดสอบ', 'b'], ['จบช่วงทดสอบ · ล้างข้อมูล', 'b'], ['วันเปิด: ได้ 100%', 'v'], ['4 สัปดาห์: +25% ทุกสัปดาห์', 'b'], ['ครบ x2', 'g'],
  ];
  let win = null, dlg = null; // dlg: { id } the pack being confirmed, { id, done } after a purchase, { rules: true }

  const gems = () => (NC.Gacha && NC.Gacha.state ? NC.Gacha.state.gems : 0);

  // ---------------- building the window ----------------
  function build() {
    win = document.createElement('div');
    win.id = 'topupwin'; win.className = 'kw-panel'; win.hidden = true;
    win.innerHTML = '<div class="tu-wrap"><section class="kw-win tu-win">' +
      '<header class="kw-title"><span>เติมเพชรจันทร์ ช่วงทดสอบ</span><span class="tu-test">ยังไม่เปิดรับชำระเงิน</span>' +
      `<span class="tu-bal"><img src="${GEM}" alt=""><span>เพชรจันทร์</span><b id="tu-bal">0</b></span>` +
      '<button class="kw-x" id="tu-close" aria-label="ปิด">✕</button></header>' +
      '<div class="tu-body" id="tu-body"></div><div class="tu-dlg" id="tu-dlg" hidden></div></section></div>';
    document.body.appendChild(win);
    $('tu-close').addEventListener('click', close);
    win.addEventListener('click', onClick);
  }

  function packCard(p) {
    return `<button class="tu-pk${p.best ? ' best' : ''}" data-buy="${p.id}"><span class="nm">${esc(p.name)}</span>` +
      `<span class="pic"><img src="${ART('pk_' + p.id + '.png')}" alt=""><i class="x2">x2<small>วันเปิด</small></i>${p.best ? '<em class="rib">แนะนำ</em>' : ''}</span>` +
      `<span class="gm"><img src="${GEM}" alt="">${n(p.gems)}</span><span class="kw-btn gold pr">${n(p.thb)} บาท</span></button>`;
  }
  function founderCard(f) {
    const st = T.state(), owned = !!st.founders[f.id], left = T.founderLeft(f);
    return `<div class="tu-fd ${FD_COL[f.id]}${owned ? ' owned' : ''}"><div class="hd">ผู้บุกเบิก · ${esc(f.name)}</div>` +
      `<button class="pic" data-buy="${f.id}" style="background-image:url(${ART('fd_' + f.id + '.jpg')})">${left !== null ? `<em class="left">เหลือ ${left} / ${f.limit}</em>` : ''}</button>` +
      `<div class="its">${f.shows.map((k) => `<span class="it"><img src="${ART('it_' + k + '.png')}" alt=""></span>`).join('')}</div>` +
      `<button class="kw-btn ${owned ? 'grey' : 'gold'} pr" data-buy="${f.id}">${owned ? 'ซื้อแล้ว' : n(f.thb) + ' บาท'}</button></div>`;
  }

  function render() {
    if (!win || win.hidden) return;
    const t = T.totals();
    $('tu-bal').textContent = n(gems());
    $('tu-body').innerHTML =
      '<div class="tu-top"><div class="tu-main">' +
        `<div class="tu-banner" style="background-image:url(${ART('banner.jpg')})"><b>เติมตอนนี้ · วันเปิดได้ x2</b></div>` +
        '<div class="tu-fds"><div class="tu-fdh">ขายเฉพาะช่วงทดสอบ · หลังเปิดเกมไม่ขายอีก</div>' +
          `<div class="tu-fdrow">${T.FOUNDERS.map(founderCard).join('')}</div></div>` +
      '</div><aside class="tu-side">' +
        `<ol class="tu-steps">${STEPS.map(([s, c], i) => `<li class="${c}"><i>${i + 1}</i><span>${s.replace('x2', '<b>x2</b>')}</span></li>`).join('')}</ol>` +
        '<div class="tu-mine">' +
          `<div class="r1"><span>ยอดเติมช่วงทดสอบ</span><b>${n(t.thb)} บาท</b></div>` +
          `<div class="r2"><span>วันเปิดได้</span><b>${n(t.launch)}</b><small>เพชร (x2)</small></div>` +
          `<p>วันแรก 100% · แล้ว +25% ทุกสัปดาห์ 4 สัปดาห์<br>x2 นับถึง ${n(T.CAP)} เพชรพื้นฐาน</p>` +
          '<div class="bt"><button class="kw-btn blue sm" data-rules="1">กติกาเต็ม</button></div>' +
        '</div></aside></div>' +
      `<div class="tu-strip">${T.PACKS.map(packCard).join('')}</div>` +
      '<div class="tu-foot">ขายแค่ความสวยและความสะดวก · ไม่มีของเพิ่มพลังในร้าน</div>';
    renderDlg();
  }

  // ---------------- the confirm sheet (the conditions before paying), the result, the full rules ----------------
  function renderDlg() {
    const box = $('tu-dlg');
    if (!dlg) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    if (dlg.rules) { box.innerHTML = rulesHtml(); return; }
    const s = T.skuOf(dlg.id), fd = T.isFounder(dlg.id), why = T.blocked(dlg.id), pv = T.previewAdd(s.gems);
    const pic = fd ? `<span class="dp fd" style="background-image:url(${ART('fd_' + s.id + '.jpg')})"></span>` : `<span class="dp"><img src="${ART('pk_' + s.id + '.png')}" alt=""></span>`;
    let h = `<div class="tu-sheet"><div class="tus-t">${dlg.done ? 'เติมสำเร็จ' : 'ยืนยันการเติม'}</div><div class="tus-b">${pic}<div class="tus-i">` +
      `<b class="nm">${fd ? 'ผู้บุกเบิก · ' : ''}${esc(s.name)}</b><span class="pr">${n(s.thb)} บาท</span>` +
      `<span class="gm"><img src="${GEM}" alt="">ได้ทันที ${n(s.gems)} เพชร</span>` +
      `<span class="lx">วันเปิดจริงได้คืน ${n(pv.launch)} เพชร${pv.extra < s.gems ? ` <small>(เกินเพดาน x2 บางส่วนคืน 1 เท่า)</small>` : ''}</span>` +
      (fd ? `<ul class="gets">${s.gets.map((g) => `<li>${esc(g)}</li>`).join('')}<li>ของทุกชิ้นไม่มีสเตตัส · ซื้อได้ 1 ครั้งต่อบัญชี</li></ul>` : '') + '</div></div>';
    if (dlg.done) {
      h += `<div class="tus-ok">ได้เพชรจันทร์ +${n(s.gems)} แล้ว · เลขอ้างอิง ${esc(dlg.ref)}</div>` +
        '<div class="tus-btns"><button class="kw-btn gold" data-gogacha="1">ไปสุ่มตู้กาชา</button><button class="kw-btn grey" data-cancel="1">ตกลง</button></div>';
    } else {
      h += '<ul class="tus-rules"><li>ช่วงทดสอบจะล้างตัวละครและของทั้งหมด แต่ยอดที่เติมคืนเป็นเพชร 2 เท่าในวันเปิด</li>' +
        `<li>วันเปิดได้ 100% ทันที แล้วโบนัสอีก 100% ทยอย 25% ทุกสัปดาห์ 4 สัปดาห์ ไม่เข้าเกมก็ไม่หาย (รับย้อนหลังได้ 180 วัน)</li>` +
        `<li>x2 นับถึง ${n(T.CAP)} เพชรพื้นฐานต่อบัญชี ส่วนเกินคืน 1 เท่า · ผูกกับบัญชี ไม่ใช่ตัวละคร</li>` +
        '<li>ขอคืนเงินได้เต็มจำนวนก่อนวันเปิด (สละสิทธิ์ x2) · ถ้าเลื่อนเปิดเกิน 6 เดือนขอเงินคืนได้</li></ul>' +
        (why ? `<div class="tus-why">${esc(why)}</div><div class="tus-btns"><button class="kw-btn blue" data-rules="1">อ่านกติกาเต็ม</button><button class="kw-btn grey" data-cancel="1">ปิด</button></div>` :
          `<div class="tus-btns"><button class="kw-btn gold" data-confirm="${s.id}">ยืนยัน ${n(s.thb)} บาท</button><button class="kw-btn grey" data-cancel="1">ยกเลิก</button></div>`);
    }
    box.innerHTML = h + '</div>';
  }

  function rulesHtml() {
    const rows = [
      ['นับอะไร', 'เพชรพื้นฐานของแพคที่จ่ายเงินจริงในช่วงทดสอบ ไม่นับโบนัส ของแถม หรือเพชรจากการเล่น'],
      ['เพดาน', `x2 นับถึง ${n(T.CAP)} เพชรพื้นฐานต่อบัญชี ส่วนที่เกินคืน 1 เท่า ไม่มีใครได้คืนน้อยกว่าที่จ่าย`],
      ['ผูกกับ', 'บัญชี Night Camp (Google / Apple / อีเมล) ไม่ใช่ตัวละคร · โอนหรือขายสิทธิ์ไม่ได้'],
      ['ช่องทาง', 'นับเฉพาะเว็บทางการ · เติมผ่านร้านตัวแทนไม่นับ'],
      ['วันเปิด', 'เข้าบัญชีเดิม เลือกเซิร์ฟเวอร์ที่จะรับ (ครั้งเดียว) ได้ 100% ทันทีพร้อมของผู้บุกเบิก · อีก 100% ทยอย 4 สัปดาห์'],
      ['เลื่อนเปิด', 'สัญญายังอยู่ · เลื่อนเกิน 6 เดือน ขอเงินคืนเต็มจำนวนได้ภายใน 60 วัน หรือรอต่อ · ยกเลิกโปรเจกต์ คืนเงินทุกคน'],
      ['ขอคืนเงิน', 'ก่อนวันเปิดคืนเต็มจำนวน (สละสิทธิ์ x2 และของผู้บุกเบิก) · ปฏิเสธการจ่าย = ยกเลิกสิทธิ์ทั้งหมด · โดนแบนเพราะโกง ไม่ได้ x2 แต่ขอเงินต้นคืนได้'],
      ['ผู้เยาว์', 'อายุไม่ถึง 18 ปีต้องได้รับความยินยอมผู้ปกครอง และมีวงเงินต่อเดือน'],
    ];
    return '<div class="tu-sheet wide"><div class="tus-t">กติกาเติมช่วงทดสอบ · คืน x2 วันเปิด</div>' +
      `<dl class="tus-dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` +
      '<div class="tus-h">เปิดขายวันเปิดจริง (ยังไม่ขายในช่วงทดสอบ)</div>' +
      `<div class="tus-launch">${T.LAUNCH.map((L) => `<div><b>${esc(L.name)}</b><small>${esc(L.price)}</small><span>${L.gets.map(esc).join(' · ')}</span></div>`).join('')}</div>` +
      '<div class="tus-btns"><button class="kw-btn grey" data-cancel="1">ปิด</button></div></div>';
  }

  function onClick(e) {
    const b = e.target.closest('[data-buy], [data-confirm], [data-cancel], [data-rules], [data-gogacha]');
    if (!b) { if (dlg && e.target.id === 'tu-dlg') { dlg = null; renderDlg(); } return; }
    if (b.dataset.buy) { dlg = { id: b.dataset.buy }; }
    else if (b.dataset.confirm) {
      const r = T.buy(b.dataset.confirm);
      dlg = r.ok ? { id: b.dataset.confirm, done: true, ref: r.ref } : { id: b.dataset.confirm };
      if (!r.ok && G()) G().toast(r.why);
    } else if (b.dataset.cancel) dlg = null;
    else if (b.dataset.rules) dlg = { rules: true };
    else if (b.dataset.gogacha) { close(); if (NC.Hub) NC.Hub.open('gacha'); return; }
    render();
  }

  // ---------------- open / close ----------------
  function open() {
    NC.HUD.panel('pause', false); // closes every other window
    win.hidden = false; dlg = null;
    render(); fit();
    const g = G(); if (g) g.paused = true;
  }
  function close() {
    if (!win || win.hidden) return;
    win.hidden = true; dlg = null;
    const g = G(); if (g) g.paused = false;
  }
  function fit() {
    const wrap = win.querySelector('.tu-wrap');
    wrap.style.transform = 'translate(-50%, -50%)';
    if (document.documentElement.classList.contains('mob-port')) { wrap.style.transform = 'none'; return; }
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }
  addEventListener('resize', () => setTimeout(() => { if (win && !win.hidden) fit(); }, 0));
  setInterval(() => { if (win && !win.hidden && $('tu-bal')) $('tu-bal').textContent = n(gems()); }, 1000);

  // ---------------- hooks: the menu button, NC.HUD.panel('topup'), the journal's gacha tab, ?topup ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    build();
    const bar = document.querySelector('.menubar'), gear = bar && bar.querySelector('[data-panel="pause"]');
    if (bar) {
      const btn = document.createElement('button');
      btn.className = 'mbtn tu-mbtn'; btn.title = 'เติมเพชรจันทร์ (ช่วงทดสอบ)';
      btn.innerHTML = `<img src="${GEM}" alt=""><b>เพชร</b>`;
      btn.addEventListener('click', () => { if (win.hidden) open(); else close(); });
      bar.insertBefore(btn, gear || null);
    }
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (win && id === 'topup') {
      const on = show === undefined ? win.hidden : show;
      if (on) open(); else close();
      return on;
    }
    if (win && !win.hidden) close();
    return basePanel(id, show);
  };
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || !win || win.hidden) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (dlg) { dlg = null; renderDlg(); } else close();
  }, true);
  // the journal's gacha page: its "เพชรจันทร์" tab and the "ไปหน้าเพชรจันทร์" button open this window
  const TG = NC.Hub && NC.Hub.tab && NC.Hub.tab('gacha');
  if (TG) {
    const baseClick = TG.click;
    TG.click = function (e, game) {
      if (e.target.closest('[data-gt="shop"]')) { open(); return false; }
      return baseClick.call(this, e, game);
    };
  }
  NC.TopUpWin = { open, close, render, isOpen: () => !!(win && !win.hidden) };
})();
