/* p3_vend.js — the my-shop window #vend and someone's shop #vbuy (mockup p3_vend A). Built from the picked mockup (UI
   audit round 3, 2026-10-17): the title bar with the coins; on the left the shop's name and "your bag" (folder tabs +
   a grid of rarity slots with counts); on the right a painted market stall (assets/p3/vend/stall.jpg, Codex) with the
   hero drawn LIVE behind the counter (NC.drawHero, the player's own look), a "on sale n / 12" sign and the 12 sale slots
   laid on the counter with paper price tags; the note and a gold OPEN SHOP under the stall. A slot opens a little card
   (how many, the price per piece, take it back). #vbuy: the seller behind the same stall, their goods on the counter,
   the list with prices, how many and buy buttons on the left, the status under the stall.
   vend.js keeps every rule and its own render (inside its closure): after each render of .vd-body this file reads what
   it drew (a MutationObserver) and lays the same data out again with the same data-* buttons and inputs (#vd-name,
   data-add / data-bag / data-q / data-qn / data-pr / data-del / data-act, data-bq / data-buy), so vend.js's click and
   input handlers do all the work. This file only keeps which slot is picked; to redraw for that it sends vend.js's own
   Enter (which reads the inputs and renders). */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC || !NC.HUD || !NC.Vend) return;
  const $ = (id) => document.getElementById(id);
  const DRAFT_KEY = 'nightcamp.vend.v1', LIMIT = 12;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const txt = (el) => (el ? el.textContent : '');
  const src = (el) => (el ? el.getAttribute('src') || '' : '');
  const coin = () => (NC.matIcon ? NC.matIcon('ic_coin') : '');
  const arw = (v) => (v && NC.WCmp && NC.WCmp.arrow ? NC.WCmp.arrow(v) : ''); // (vend.js's data-wc: better / worse than the worn piece, js/wcompare.js)
  const G = () => NC.game;
  let setupWin = null, buyWin = null, raf = 0;
  const st = { sel: null, bsel: 0, vendorName: '', vendorEq: null, nRows: 0 };

  // ---------------- a soft rarity colour for a bag slot ----------------
  const RT = { common: 'cream', rare: 'blue', epic: 'lav', legend: 'gold', fashion: 'pink' };
  function tone(k, id) {
    try {
      if (k === 'pot') return /blue/.test(id) ? 'blue' : 'pink';
      if (k === 'mat') { const pr = (NC.MATERIALS[id] || {}).price || 0; return pr <= 12 ? 'cream' : pr <= 30 ? 'blue' : pr <= 60 ? 'mint' : pr <= 120 ? 'lav' : pr <= 300 ? 'gold' : 'pink'; }
      if (k === 'item') return RT[(NC.ITEMS[id] || {}).rarity] || 'cream';
      if (k === 'gear' && NC.gearDec) {
        const d = NC.gearDec(id), gk = d && NC.copyGradeKey ? NC.copyGradeKey(d) : null; // (the piece's colour key = its rarity, js/gradetier.js)
        if (gk) return ['cream', 'mint', 'blue', 'lav', 'gold', 'pink'][Number(gk.slice(1))] || 'cream';
        return RT[d && NC.ITEMS[d.id] ? NC.ITEMS[d.id].rarity : ''] || 'cream';
      }
    } catch (e) { /* unknown: plain */ }
    return 'cream';
  }

  // ---------------- the stall: painting, the hero behind the counter, the counter's front over him ----------------
  const stall = (sign, slots, lower, extra) =>
    '<div class="p3v-stall"><div class="p3v-back"></div><canvas class="p3v-hero"></canvas><div class="p3v-front"></div>' +
    `<div class="p3v-sign"><span>${sign}</span></div><div class="p3v-lower"><div class="p3v-slots">${slots}</div>${lower}</div>${extra || ''}</div>`;
  // one canvas per window, put back in place after every render (a new one would blink empty for a frame)
  const heroCv = new Map();
  function keepCanvas(win, B) {
    const ph = B.querySelector('canvas.p3v-hero');
    if (!ph) return;
    if (!heroCv.has(win)) { heroCv.set(win, ph); return; }
    ph.replaceWith(heroCv.get(win));
  }
  const emptySlots = (n, attr) => Array.from({ length: Math.max(0, LIMIT - n) }, () => `<div class="p3v-slot empty"${attr || ''}></div>`).join('');
  const tag = (price) => `<span class="p3v-tag"><img src="${coin()}" alt="">${esc(price)}</span>`;

  // ---------------- #vend: setting up my shop ----------------
  function parseSetup(B) {
    const nm = B.querySelector('#vd-name'), ob = B.querySelector('[data-act="open"]');
    return {
      name: nm ? nm.value : '', ph: nm ? nm.placeholder : '', max: nm ? nm.maxLength : 30,
      tabs: [...B.querySelectorAll('[data-bag]')].map((b) => ({ k: b.dataset.bag, label: b.textContent, on: b.classList.contains('on') })),
      cells: [...B.querySelectorAll('[data-add]')].map((b) => ({ add: b.dataset.add, title: b.title, src: src(b.querySelector('img')), n: txt(b.querySelector('b')), sel: b.classList.contains('sel'), bd: !!b.dataset.bd, wc: b.dataset.wc || '' })), // (bd: account-bound, vend.js)
      bagEmpty: txt(B.querySelector('.vd-bag .vd-empty')),
      head: txt(B.querySelector('.vd-list .vd-h')),
      rows: [...B.querySelectorAll('.vd-list .vd-row')].map((r) => {
        const qn = r.querySelector('[data-qn]'), pr = r.querySelector('[data-pr]'), nmEl = r.querySelector('.vd-name');
        return { src: src(r.querySelector('img')), name: nmEl && nmEl.firstChild ? nmEl.firstChild.textContent : '', sub: txt(nmEl && nmEl.querySelector('small')),
          one: !qn, n: qn ? qn.value : '1', price: pr ? pr.value : '' };
      }),
      note: txt(B.querySelector('.vd-foot span')), warn: !!B.querySelector('.vd-foot .vd-warn'), // (warn: a bound item's why, vend.js)
      open: ob ? { dis: ob.disabled, text: ob.textContent } : null,
    };
  }
  function renderSetup(B) {
    const M = parseSetup(B), game = G(), inCamp = !!(game && (game.mapId === 'camp' || (game.world && game.world.camp)));
    st.nRows = M.rows.length;
    if (st.sel !== null && st.sel >= M.rows.length) st.sel = null;
    const cells = M.cells.map((c) => {
      const [k, id] = c.add.split(':');
      if (c.bd) return `<button class="p3v-cell bd" data-add="${esc(c.add)}" data-bd="1" title="${esc(c.title)}"><img src="${esc(c.src)}" alt=""><i class="p3v-bd">ผูกบัญชี</i></button>`; // (locked: vend.js says why)
      return `<button class="p3v-cell t-${tone(k, id)}${c.sel ? ' sel' : ''}" data-add="${esc(c.add)}" title="${esc(c.title)}"><img src="${esc(c.src)}" alt="">` +
        `${c.n ? `<b>${esc(c.n)}</b>` : ''}${c.sel ? '<i class="p3v-in" aria-hidden="true"></i>' : ''}${arw(c.wc)}</button>`;
    }).join('') || `<div class="p3v-empty">${esc(M.bagEmpty || 'ไม่มีของ')}</div>`;
    const slots = M.rows.map((r, i) => `<div class="p3v-slot full${st.sel === i ? ' sel' : ''}" data-p3sel="${i}" title="${esc(r.name)} · แตะเพื่อตั้งจำนวนและราคา">` +
      `<button class="p3v-x" data-del="${i}" aria-label="เอาออกจากร้าน">✕</button><img src="${esc(r.src)}" alt=""><b>${esc(r.name)}</b>` +
      `<span class="p3v-line"><em>×${esc(r.n)}</em>${tag(r.price)}</span></div>`).join('') + emptySlots(M.rows.length, ' data-p3="emptyslot"');
    const btn = inCamp ? `<button class="p3v-go" data-act="open">${esc(M.open && !M.open.dis ? M.open.text : 'เปิดร้าน')}</button>`
      : '<button class="p3v-go" data-p3="walk">ต้องอยู่ในค่าย · พาเดินไป</button>';
    const lower = `<div class="p3v-note${M.warn ? ' warn' : ''}">${esc(M.note)}</div>${btn}`;
    const m = /(\d+)\s*\/\s*(\d+)/.exec(M.head) || [0, M.rows.length, LIMIT];
    let pop = '';
    if (st.sel !== null) {
      const r = M.rows[st.sel], i = st.sel, col = i % 6;
      const left = Math.max(8, Math.min(24 + col * 113 + 51 - 170, 712 - 348));
      pop = `<div class="p3v-pop" style="--px:${left}"><div class="p3v-pop-h"><img src="${esc(r.src)}" alt=""><div><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></div>` +
        '<button class="p3v-pop-x" data-p3="unsel" aria-label="ปิด">✕</button></div>' +
        `<div class="p3v-pop-r"><span>จำนวน</span>${r.one ? '<em>1 ชิ้น (ขายทีละชิ้น)</em>' :
          `<span class="p3v-step"><button data-q="${i}:-1" aria-label="ลด">−</button><input data-qn="${i}" value="${esc(r.n)}" inputmode="numeric" aria-label="จำนวน"><button data-q="${i}:1" aria-label="เพิ่ม">+</button></span>`}</div>` +
        `<div class="p3v-pop-r"><span>ราคาต่อชิ้น</span><label class="p3v-price"><img src="${coin()}" alt=""><input data-pr="${i}" value="${esc(r.price)}" inputmode="numeric" aria-label="ราคา"></label></div>` +
        `<div class="p3v-pop-f"><button class="p3v-pop-del" data-del="${i}">เอาออกจากร้าน</button><button class="p3v-pop-ok" data-p3="unsel">ตกลง</button></div></div>`;
    }
    B.innerHTML = '<div class="p3v setup"><div class="p3v-left">' +
      `<div class="p3v-name"><label for="vd-name">ชื่อร้าน:</label><input id="vd-name" maxlength="${M.max}" autocomplete="off" placeholder="${esc(M.ph)}" value="${esc(M.name)}"></div>` +
      '<div class="p3v-h">กระเป๋าของคุณ <small>แตะของเพื่อวางขาย</small></div>' +
      `<div class="p3v-tabs">${M.tabs.map((t) => `<button data-bag="${esc(t.k)}" class="${t.on ? 'on' : ''}">${esc(t.label)}</button>`).join('')}</div>` +
      `<div class="p3v-grid">${cells}</div></div>` +
      stall(`วางขาย <b>${m[1]} / ${m[2]}</b>`, slots, lower, pop) + '</div>';
    st.heroOf = 'me';
    kick();
  }

  // ---------------- #vend while my shop is open ----------------
  function renderOpen(B) {
    const info = B.querySelector('.vd-open'), rows = [...B.querySelectorAll('.vd-list .vd-row')].map((r) => {
      const nmEl = r.querySelector('.vd-name');
      return { src: src(r.querySelector('img')), name: nmEl && nmEl.firstChild ? nmEl.firstChild.textContent : '', sub: txt(nmEl && nmEl.querySelector('small')),
        left: txt(r.querySelector('.vd-left b')), price: txt(r.querySelector('.sh-price')).trim() };
    });
    const empty = txt(B.querySelector('.vd-list .vd-empty')), note = txt(B.querySelector('.vd-foot span'));
    st.sel = null;
    const list = rows.map((r) => `<div class="p3v-row"><img src="${esc(r.src)}" alt=""><div class="p3v-rn"><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></div>` +
      `<span class="p3v-left-n">เหลือ <b>${esc(r.left)}</b></span>${tag(r.price)}</div>`).join('') || `<div class="p3v-empty">${esc(empty || 'ขายหมดแล้ว')}</div>`;
    const slots = rows.map((r) => `<div class="p3v-slot full ro"><img src="${esc(r.src)}" alt=""><b>${esc(r.name)}</b><span class="p3v-line"><em>×${esc(r.left)}</em>${tag(r.price)}</span></div>`).join('') + emptySlots(rows.length);
    B.innerHTML = '<div class="p3v open"><div class="p3v-left">' +
      `<div class="p3v-openbox"><span class="p3v-live">ร้านเปิดอยู่</span><div>${info ? info.innerHTML : ''}</div></div>` +
      `<div class="p3v-h">ของที่วางขาย <small>คนในค่ายคลิกป้ายเหนือหัวคุณเพื่อซื้อ</small></div><div class="p3v-rows">${list}</div></div>` +
      stall(`ขายอยู่ <b>${rows.length} / ${LIMIT}</b>`, slots, `<div class="p3v-note">${esc(note)}</div><button class="p3v-go grey" data-act="close">ปิดร้าน</button>`) + '</div>';
    st.heroOf = 'me';
    kick();
  }

  // ---------------- #vbuy: someone else's shop ----------------
  function findVendor(name) {
    const list = [];
    try { if (NC.Party && NC.Party.collect) NC.Party.collect(list, () => true); } catch (e) { /* none */ }
    let v = list.find((a) => a && a.keeper && a.name === name) || list.find((a) => a && a.name === name && a.equip);
    if (!v && NC.Net && NC.Net.remotes) v = [...NC.Net.remotes.values()].find((r) => r.name === name);
    return v && v.equip ? v.equip : null;
  }
  function renderBuy(B) {
    const by = B.querySelector('.vb-by'), status = B.querySelector('.vb-status');
    if (!by) { // the shop closed
      B.innerHTML = '<div class="p3v buy"><div class="p3v-left"><div class="p3v-empty big">' + esc(txt(B.querySelector('.vd-empty')) || 'ร้านนี้ปิดไปแล้ว') + '</div></div>' +
        stall('ร้านปิดแล้ว', emptySlots(0), '<div class="p3v-note">เจ้าของร้านลุกเดินไปแล้ว · ลองร้านอื่นในค่ายดูนะ</div><button class="p3v-go grey" data-p3="closewin">ปิดหน้าต่าง</button>') + '</div>';
      st.heroOf = null; kick();
      return;
    }
    const name = txt(by.querySelector('b'));
    if (name !== st.vendorName) { st.vendorName = name; st.vendorEq = findVendor(name); }
    const rows = [...B.querySelectorAll('.vd-list .vd-row')].map((r) => {
      const nmEl = r.querySelector('.vd-name'), q = r.querySelector('.vd-qty'), b = r.querySelector('[data-buy]');
      return { src: src(r.querySelector('img')), name: nmEl && nmEl.firstChild ? nmEl.firstChild.textContent : '', sub: txt(nmEl && nmEl.querySelector('small')),
        left: txt(r.querySelector('.vd-left b')), price: txt(r.querySelector('.sh-price')).trim(), one: !(q && q.querySelector('[data-bq]')), n: txt(q && q.querySelector('span')) || '1',
        j: b ? b.dataset.buy : '', buy: txt(b).trim(), dis: !!(b && b.disabled), item: r.dataset.item || '', // (vend.js: k:id, for the details)
        wc: r.dataset.wc || '', vl: (r.querySelector('.wc-vline') || {}).outerHTML || '' }; // (the compare: vend.js's arrow and verdict line, js/wcompare.js)
    });
    const waiting = /รอร้านตอบ/.test(txt(status));
    if (st.bsel >= rows.length) st.bsel = 0;
    const list = rows.map((r, i) => `<div class="p3v-row b${i === st.bsel ? ' sel' : ''}" data-p3pick="${i}" data-item="${esc(r.item)}"><span class="p3v-ri"><img src="${esc(r.src)}" alt="">${arw(r.wc)}</span>` +
      `<div class="p3v-rn"><b>${esc(r.name)}</b><small>${esc(r.sub)}</small>${r.vl}</div>${tag(r.price)}` +
      `<div class="p3v-rb"><span class="p3v-left-n">เหลือ <b>${esc(r.left)}</b></span>` +
      (r.one ? '<span class="p3v-step one">1 ชิ้น</span>' : `<span class="p3v-step"><button data-bq="${r.j}:-1" aria-label="ลด">−</button><span>${esc(r.n)}</span><button data-bq="${r.j}:1" aria-label="เพิ่ม">+</button></span>`) +
      `<button class="p3v-buy" data-buy="${r.j}" ${waiting ? 'disabled' : ''}>${esc(r.buy)}</button></div>${i === st.bsel ? more(r.item) : ''}</div>`).join('') ||
      `<div class="p3v-empty">${esc(txt(B.querySelector('.vd-list .vd-empty')) || 'ขายหมดแล้ว')}</div>`;
    const slots = rows.map((r, i) => `<div class="p3v-slot full${i === st.bsel ? ' sel' : ''}" data-p3pick="${i}" title="${esc(r.name)}"><img src="${esc(r.src)}" alt=""><b>${esc(r.name)}</b>` +
      `<span class="p3v-line"><em>×${esc(r.left)}</em>${tag(r.price)}</span>${arw(r.wc)}</div>`).join('') + emptySlots(rows.length);
    const S = rows[st.bsel];
    const go = S ? `<button class="p3v-go" data-buy="${S.j}" ${waiting ? 'disabled' : ''}>${esc(S.buy)} <small>· ${esc(S.name)}${S.one ? '' : ' ×' + esc(S.n)}</small></button>`
      : '<button class="p3v-go grey" data-p3="closewin">ปิดหน้าต่าง</button>';
    B.innerHTML = '<div class="p3v buy"><div class="p3v-left">' +
      `<div class="p3v-seller"><span>${by.innerHTML}</span></div><div class="p3v-h">ของในร้าน <small>${rows.length} รายการ · แตะของบนแผงเพื่อเลือก</small></div>` +
      `<div class="p3v-rows">${list}</div></div>` +
      stall(`ร้านของ <b>${esc(name)}</b>`, slots, `<div class="p3v-note ${status ? esc(status.className.replace('vb-status', '').trim()) : ''}">${esc(txt(status))}</div>${go}`) + '</div>';
    st.heroOf = 'vendor';
    kick();
  }
  // the picked row's details under it (vend.js NC.Vend.detail: what it is, its numbers, its option rows, what Coco pays)
  function more(item) {
    const at = item ? item.indexOf(':') : -1;
    if (at < 0 || !NC.Vend.detail) return '';
    const html = NC.Vend.detail(item.slice(0, at), item.slice(at + 1));
    return html ? `<div class="p3v-more">${html}</div>` : '';
  }

  // ---------------- after every render of vend.js ----------------
  function mine(B) { const f = B && B.firstElementChild; return !!(f && f.classList.contains('p3v')); }
  // (vend.js redraws the shop window every frame while a purchase is pending or its message shows: when what it drew is
  // the same as last time, the same nodes go back in, so a click that is half done (pressed, not yet released) still lands)
  const last = new Map();
  function redo(win) {
    const B = win && win.querySelector('.vd-body');
    if (!B || mine(B) || win.hidden) return;
    const sig = B.innerHTML + '|' + st.sel + '|' + st.bsel + '|' + (G() && G().mapId), L = last.get(win);
    if (L && L.sig === sig && L.root) { B.replaceChildren(L.root); return; }
    try {
      if (win === buyWin) renderBuy(B);
      else if (B.querySelector('.vd-open')) renderOpen(B);
      else if (B.querySelector('#vd-name')) renderSetup(B);
      else return;
      keepCanvas(win, B);
      last.set(win, { sig, root: B.firstElementChild });
    } catch (e) { console.warn('p3_vend', e); }
  }
  // ask vend.js to read the inputs and draw again (its own Enter key), then lay it out
  function refresh() {
    if (!setupWin || setupWin.hidden) return;
    setupWin.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  // ---------------- the hero (or the seller) behind the counter ----------------
  function drawIn(cv, eq) {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    if (!eq || !NC.drawHero || !NC.Anim) return;
    const t = performance.now() / 1000, ac = NC.animCtx ? NC.animCtx(eq) : undefined;
    if (NC.HeroSpine && NC.HeroSpine.preview && NC.HeroSpine.preview(c, eq, W * 0.47, H * 0.9, H / 128, { t, noWeapon: true })) return; // (the hero rig's idle, js/herospine.js)
    const P = NC.Anim.sample('idle', t, ac);
    P.face = 1;
    NC.drawHero(c, eq, P, W * 0.47, H * 0.9, { scale: H / 128, noWeapon: true }); // (head, shoulders and arms over the counter, like the mockup)
  }
  function loop() {
    raf = 0;
    let any = false;
    const g = G(), p = g && g.player;
    for (const w of [setupWin, buyWin]) {
      if (!w || w.hidden) continue;
      const cv = w.querySelector('canvas.p3v-hero');
      if (!cv) continue;
      any = true;
      const eq = w === buyWin ? (st.heroOf === 'vendor' ? st.vendorEq : null) : p ? (NC.lookEquip ? NC.lookEquip(p.equip) : p.equip) : null;
      drawIn(cv, eq);
    }
    if (any) raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }

  // ---------------- clicks: which slot is picked (before vend.js's own handler) ----------------
  function onSetupCapture(ev) {
    const el = ev.target;
    if (!(el instanceof Element)) return;
    const b = el.closest('button'), slot = el.closest('[data-p3sel]'), game = G();
    if (b && b.dataset.add && !b.disabled && !b.dataset.bd) { // a bag slot (not a bound one: vend.js only says why): put it in (then pick it) or take it out
      if (b.classList.contains('sel')) st.sel = null;
      else if (st.nRows < LIMIT) st.sel = st.nRows;
      return;
    }
    if (b && b.dataset.del !== undefined) { const i = Number(b.dataset.del); st.sel = st.sel === i ? null : st.sel !== null && st.sel > i ? st.sel - 1 : st.sel; return; }
    if (b && b.dataset.p3 === 'unsel') { st.sel = null; refresh(); return; }
    if (b && b.dataset.p3 === 'walk') { walkToCamp(); return; }
    if (b) return; // (vend.js's buttons)
    if (slot) { const i = Number(slot.dataset.p3sel); st.sel = st.sel === i ? null : i; refresh(); return; }
    const empty = el.closest('[data-p3="emptyslot"]');
    if (empty && game) game.toast('แตะของในกระเป๋าทางซ้ายเพื่อวางขาย (ได้ 12 อย่าง)');
  }
  function walkToCamp() {
    const g = G();
    if (!g) return;
    NC.HUD.panel('vend', false); g.paused = false;
    const S = NC.CAMP_SPOT && NC.CAMP_SPOT.vend, at = S ? S[S.length - 1] : [1500, 3020];
    if (NC.Travel && NC.Travel.go) {
      NC.Travel.go(g, { map: 'camp', x: at[0], y: at[1] - 120, r: 220, name: 'ลานตลาดในค่าย', done: () => setTimeout(() => NC.Vend.setup(), 200) });
      g.toast('กำลังเดินกลับค่าย · ถึงแล้วจะเปิดหน้าตั้งร้านให้ · เดินเองเพื่อหยุด');
    } else if (NC.MapRoute && NC.MapRoute.set) { NC.MapRoute.set('camp'); g.toast('ตามลูกศรสีทองกลับไปที่ค่าย'); }
  }
  function onBuyCapture(ev) {
    const el = ev.target;
    if (!(el instanceof Element)) return;
    const b = el.closest('button'), pick = el.closest('[data-p3pick]'), g = G();
    if (b && b.dataset.p3 === 'closewin') { NC.HUD.panel('vbuy', false); if (g) g.paused = false; return; }
    if (b) return; // (vend.js's: how many, buy)
    if (pick) {
      st.bsel = Number(pick.dataset.p3pick);
      const B = buyWin.querySelector('.vd-body');
      // redraw from the rows already on screen: ask vend.js to draw (a + then - would change nothing but costs a render), so just mark
      B.querySelectorAll('[data-p3pick]').forEach((x) => x.classList.toggle('sel', Number(x.dataset.p3pick) === st.bsel));
      const row = B.querySelector(`.p3v-row[data-p3pick="${st.bsel}"]`);
      if (row && !row.querySelector('.p3v-more')) { B.querySelectorAll('.p3v-more').forEach((x) => x.remove()); row.insertAdjacentHTML('beforeend', more(row.dataset.item)); }
      if (row && pick.classList.contains('p3v-slot')) row.scrollIntoView({ block: 'nearest' });
      const go = B.querySelector('.p3v-go'), r = row && row.querySelector('[data-buy]');
      if (go && r) {
        const n = row.querySelector('.p3v-step span'), nm = txt(row.querySelector('.p3v-rn b'));
        go.dataset.buy = r.dataset.buy; go.disabled = r.disabled;
        go.innerHTML = `${esc(txt(r))} <small>· ${esc(nm)}${n ? ' ×' + esc(txt(n)) : ''}</small>`;
      }
    }
  }

  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (g) {
    baseInit(g);
    setupWin = $('vend'); buyWin = $('vbuy');
    for (const w of [setupWin, buyWin]) {
      if (!w) continue;
      const card = w.querySelector('.card'), B = w.querySelector('.vd-body');
      if (!card || !B) continue;
      card.classList.add('p3v-win');
      new MutationObserver(() => redo(w)).observe(B, { childList: true });
    }
    if (setupWin) setupWin.addEventListener('click', onSetupCapture, true);
    if (buyWin) buyWin.addEventListener('click', onBuyCapture, true);
    addEventListener('resize', () => kick());
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    const wasBuy = buyWin && buyWin.hidden;
    if (id === 'vend' && setupWin && setupWin.hidden) st.sel = null;
    const r = basePanel(id, show);
    if (id === 'vbuy' && wasBuy && buyWin && !buyWin.hidden) { st.bsel = 0; st.vendorName = ''; }
    if (id === 'vend' || id === 'vbuy') { redo(setupWin); redo(buyWin); kick(); }
    return r;
  };
})();
