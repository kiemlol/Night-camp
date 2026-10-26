/* chatlink.js — items linked in the chat (the user, 2026-10-20: "an item link system in the chat: link an item and its
   name shows in the chat in its colour, so the people in the chat know what item it is when they point at it"; they
   picked mockup A, assets/gen/nightcamp_ilink_a_raw.png: classic [brackets] in the rarity's colour with a small icon,
   the item card beside the chat when pointed at).
   - Linking: Shift + click a cell in the bag (or a worn slot), or the card's แนบในแชท button. The item goes into the chat
     box as a chip ([icon name] in its colour, a 1/3 count at the box's end); at most 3 per message. Backspace / Delete
     take a chip out whole, the arrows step over it.
   - On the wire the text keeps "[name]" where each link is (a client without this file reads plain text), and the
     message carries the items: online js/chat.js sends refs ({u: copy id} or {id: kind}) and the server (patch 018,
     tools/online/patches) asks the sender's match for its own copies, so the card shows what really is in that bag
     ("ของจริง · เซิร์ฟเวอร์ตรวจแล้ว"); offline / peer lines carry the copies as the sender sent them (not checked).
   - Showing: each link in the line is [icon name] in the rarity's colour; pointing opens the item's card beside the chat
     window (picture, rarity, type, Lv, element, polish gems, stats, option rows, ability, the compare with the hero's own
     worn piece from js/wcompare.js, who linked it and when); a click pins it (✕ / Esc / a click elsewhere closes);
     phones: a tap. Bubbles over the head draw the linked names in their colour too.
   Hooks: js/chat.js (NC.ChatLink take / sent / oldServer / plain / fill / wireIn / bubbleLines), js/inventory.js
   (NC.invEntryAt, NC.invSlotKey, NC.invCardDone), NC.invActs ('cl:link'). css/chatlink.css. ?chatlink=0: off. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, MAT = NC.MATERIALS || {};
  if (!NC.Chat) return;
  const MAX = 3, SP = '　'; // links in one message; the icon's room before a chip's "[" in the box (never sent)
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const toast = (t) => { const g = G(); if (g && g.toast) g.toast(t); };
  const asset = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || (NC.matIcon ? NC.matIcon(k) : '');
  const GEAR_SLOTS = ['weapon', 'shield', 'hat', 'glasses', 'top', 'robe', 'pants', 'cape', 'acc'];

  // ---------------- what a link is: { id, copy?, rows, ref, sh, g, taint, by } ----------------
  // id: an item (ITEMS), a material (NC.MATERIALS) or 'p:<potion>'; copy: one gear piece with its own rows and refine
  const potOf = (id) => (NC.POT && NC.POT.LIST ? NC.POT.LIST.find((q) => q.id === id) : null) || null;
  function kindOf(id) {
    if (typeof id !== 'string' || id.length > 48) return '';
    if (id.startsWith('p:')) return potOf(id.slice(2)) ? 'pot' : '';
    if (ITEMS[id]) return 'item';
    return MAT[id] ? 'mat' : '';
  }
  function nameOf(x) {
    const k = kindOf(x.id);
    if (k === 'item') return x.copy && NC.copyName ? NC.copyName(x) : ITEMS[x.id].name;
    if (k === 'mat') return MAT[x.id].name;
    if (k === 'pot') return potOf(x.id.slice(2)).name;
    return '';
  }
  function rarityOf(x) {
    const k = kindOf(x.id);
    if (k === 'item') return NC.RARITY[ITEMS[x.id].rarity] ? ITEMS[x.id].rarity : 'common';
    if (k === 'mat') return MAT[x.id].rare ? 'legend' : 'common'; // (as the bag's cells: js/inventory.js entry)
    return 'common';
  }
  const icons = new Map();
  function iconUrl(x) {
    const k = kindOf(x.id);
    if (k === 'mat') return NC.matIcon(x.id);
    if (k === 'pot') return asset(potOf(x.id.slice(2)).icon);
    if (k !== 'item') return '';
    if (icons.has(x.id)) return icons.get(x.id);
    let u = '';
    try { u = NC.itemIcon(x.id, 64).toDataURL(); } catch (e) { u = ''; }
    if (u.length > 400) icons.set(x.id, u); // (a streamed sprite not loaded yet is an empty canvas: tried again next time)
    return u;
  }
  // a link as it may arrive (the server's, another player's packet): only the fields a card reads, in their ranges
  const str = (s, n) => (typeof s === 'string' ? s.replace(/[<>"'`]/g, '').slice(0, n) : '');
  const int = (v, lo, hi) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Math.round(Number(v)))) : lo);
  function clean(x) {
    if (!x || typeof x !== 'object' || !kindOf(x.id)) return null;
    const o = { id: x.id };
    if (x.copy && ITEMS[x.id]) {
      o.copy = true;
      o.rows = (Array.isArray(x.rows) ? x.rows : []).filter((r) => r && typeof r.k === 'string').slice(0, 6)
        .map((r) => Object.assign({ k: str(r.k, 24), v: Number(r.v) || 0, tier: int(r.tier, 0, 3) }, r.sub ? { sub: str(r.sub, 24) } : {}));
      o.ref = int(x.ref, 0, 20);
      o.sh = x.sh ? 1 : 0;
      if (x.g != null) o.g = int(x.g, 0, 5);
      if (x.taint) o.taint = str(x.taint, 24);
      if (x.by) o.by = str(x.by, 24);
    }
    return o;
  }
  const itemsOf = (m) => m._cl || (m._cl = (Array.isArray(m.items) ? m.items : []).slice(0, MAX).map(clean).filter(Boolean));

  // where each link sits in a message's text: its "[name]", else the next [...] (another version's name), else the end
  function places(text, items) {
    const out = [];
    let at = 0;
    for (const x of items) {
      const want = '[' + nameOf(x) + ']';
      let s = text.indexOf(want, at), e = s + want.length;
      if (s < 0) {
        const re = /\[[^[\]\n]{1,60}\]/g;
        re.lastIndex = at;
        const m = re.exec(text);
        if (m) { s = m.index; e = s + m[0].length; } else { s = e = text.length; }
      }
      out.push({ x, s, e });
      at = e;
    }
    return out;
  }

  // ---------------- linking an item from the bag ----------------
  function fromEntry(en) {
    if (!en) return null;
    if ((en.kind === 'item' || en.kind === 'store') && ITEMS[en.id]) {
      const c = en.copy;
      if (!c) return { ref: { id: en.id }, item: { id: en.id } };
      return { ref: { u: c.u }, item: clean({ id: c.id, copy: true, rows: c.rows, ref: c.ref, sh: c.sh, g: c.g, taint: c.taint, by: c.by }) };
    }
    if (en.kind === 'mat' && MAT[en.id]) return { ref: { id: en.id }, item: { id: en.id } };
    if (en.kind === 'pot' && potOf(en.id)) return { ref: { id: 'p:' + en.id }, item: { id: 'p:' + en.id } };
    return null;
  }
  function linkEntry(en) {
    const L = fromEntry(en);
    if (!L || !L.item) { toast('ของชิ้นนี้แนบในแชทไม่ได้'); return false; }
    return attach(L);
  }

  // ---------------- the chips in the chat box ----------------
  // The box stays a plain <input> (Thai typing, the caret, history all as before): a chip is the text SP + "[name]",
  // and a mirror under the transparent text draws it as a coloured pill with the icon in the SP's room.
  let input = null, box = null, mirror = null, count = null, chips = [], noServer = false;
  const chipText = (c) => SP + '[' + c.name + ']';
  function spans(v) { // each chip's [s, e) in the box's text, in order (chips no longer there left out)
    const out = [];
    let at = 0;
    for (const c of chips) {
      const i = v.indexOf(chipText(c), at);
      if (i < 0) continue;
      out.push({ c, s: i, e: i + chipText(c).length });
      at = i + chipText(c).length;
    }
    return out;
  }
  function prune() { const keep = new Set(spans(input.value).map((x) => x.c)); chips = chips.filter((c) => keep.has(c)); }
  const mob = () => document.documentElement.classList.contains('mob');
  function attach(L) {
    if (!input) return false;
    prune();
    if (chips.length >= MAX) { toast(`แนบไอเทมได้ ${MAX} ชิ้นต่อข้อความ`); return false; }
    const chip = { name: nameOf(L.item), item: L.item, ref: L.ref };
    const t = chipText(chip), v = input.value;
    if (Array.from(v + t).length > 198) { toast('ข้อความยาวเกินไป แนบเพิ่มไม่ได้'); return false; }
    let pos = document.activeElement === input ? input.selectionStart : v.length;
    for (const x of spans(v)) if (pos > x.s && pos < x.e) pos = x.e; // (never inside a chip)
    const pre = v.slice(0, pos), post = v.slice(pos), lead = pre && !/\s$/.test(pre) ? ' ' : '', tail = post.startsWith(' ') ? '' : ' ';
    const at = pre.length + lead.length;
    const old = spans(v).map((x) => ({ c: x.c, s: x.s >= pos ? x.s + lead.length + t.length + tail.length : x.s }));
    input.value = pre + lead + t + tail + post;
    chips = old.concat([{ c: chip, s: at }]).sort((a, b) => a.s - b.s).map((x) => x.c);
    if (mob()) { document.documentElement.classList.add('mob-chat'); toast('แนบในแชทแล้ว · ปิดกระเป๋าแล้วพิมพ์ต่อ'); }
    else { input.focus(); const end = at + t.length + tail.length; input.setSelectionRange(end, end); }
    sync();
    return true;
  }
  function sync() {
    if (!input) return;
    const v = input.value, S = spans(v);
    box.classList.toggle('has', S.length > 0);
    count.textContent = S.length ? `${S.length}/${MAX}` : '';
    if (!S.length) { mirror.textContent = ''; return; }
    let h = '', at = 0;
    for (const x of S) {
      const u = iconUrl(x.c.item);
      h += esc(v.slice(at, x.s)) + `<span class="cl-ich r-${rarityOf(x.c.item)}"><i class="ic"${u ? ` style="background-image:url('${u}')"` : ''}>${SP}</i>` +
        `<i class="br">[</i>${esc(x.c.name)}<i class="br">]</i></span>`;
      at = x.e;
    }
    mirror.innerHTML = h + esc(v.slice(at)) + ' ';
    mirror.scrollLeft = input.scrollLeft;
  }
  function onKey(e) {
    const S = spans(input.value);
    if (!S.length) return;
    const a = input.selectionStart, b = input.selectionEnd;
    if (e.key === 'Backspace' || e.key === 'Delete') {
      let s = a, t = b;
      if (a === b) {
        const x = e.key === 'Backspace' ? S.find((y) => a > y.s && a <= y.e) : S.find((y) => a >= y.s && a < y.e);
        if (!x) return;
        s = x.s; t = x.e;
      } else {
        for (const x of S) if (x.s < t && x.e > s) { s = Math.min(s, x.s); t = Math.max(t, x.e); }
        if (s === a && t === b) return; // (no chip cut in half: the box does it)
      }
      e.preventDefault();
      input.setRangeText('', s, t, 'start');
      prune(); sync();
    } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && a === b && !e.shiftKey) {
      const x = e.key === 'ArrowLeft' ? S.find((y) => a > y.s && a <= y.e) : S.find((y) => a >= y.s && a < y.e);
      if (x) { e.preventDefault(); const to = e.key === 'ArrowLeft' ? x.s : x.e; input.setSelectionRange(to, to); sync(); }
    }
  }
  function snap() { // a caret put inside a chip goes to its end
    if (!input || input.selectionStart !== input.selectionEnd) return;
    const a = input.selectionStart, x = spans(input.value).find((y) => a > y.s && a < y.e);
    if (x) input.setSelectionRange(x.e, x.e);
    sync();
  }
  let raf = 0;
  function follow() { // the mirror scrolls with the box while it is being typed in
    raf = 0;
    if (!input || document.activeElement !== input || !box.classList.contains('has')) return;
    if (mirror.scrollLeft !== input.scrollLeft) mirror.scrollLeft = input.scrollLeft;
    raf = requestAnimationFrame(follow);
  }

  // ---------------- js/chat.js asks ----------------
  // the box's text as it is sent: the icons' room out
  const plain = (raw) => String(raw == null ? '' : raw).split(SP + '[').join('[').split(SP).join(' ');
  // the chips found in the text being sent, in order: refs (the server's), items (our own line), wire (a peer packet)
  function take(text) {
    const L = { refs: [], items: [], wire: [] };
    let at = 0;
    for (const c of chips) {
      const want = '[' + c.name + ']', i = text.indexOf(want, at);
      if (i < 0) continue;
      at = i + want.length;
      L.refs.push(c.ref); L.items.push(c.item); L.wire.push(c.item);
      if (L.items.length >= MAX) break;
    }
    if (!L.items.length) return null;
    if (noServer) L.refs = null; // (a server without patch 018: the names go as plain text)
    return L;
  }
  function sent() { chips = []; if (input) sync(); }
  // a server without patch 018 refuses the unknown field "items" (backend match.go decode: คำสั่งแชตไม่ถูกต้อง)
  function oldServer(error) {
    const yes = /คำสั่งแชตไม่ถูกต้อง|unknown field/i.test(String((error && error.message) || error || ''));
    if (yes) noServer = true;
    return yes;
  }
  const wireIn = (a) => (Array.isArray(a) ? a.slice(0, MAX).map(clean).filter(Boolean) : undefined);

  // the line's text with each link as [icon name] in its colour
  function fill(tx, m) {
    const text = String(m.text || ''), items = itemsOf(m);
    let at = 0;
    places(text, items).forEach((P, i) => {
      if (P.s > at) tx.appendChild(document.createTextNode(text.slice(at, P.s)));
      else if (P.s === text.length && at === text.length && text) tx.appendChild(document.createTextNode(' '));
      tx.appendChild(linkEl(P.x, m, i));
      at = Math.max(at, P.e);
    });
    if (at < text.length) tx.appendChild(document.createTextNode(text.slice(at)));
  }
  function linkEl(x, m, i) {
    const a = document.createElement('a'), u = iconUrl(x);
    a.className = 'cl-link r-' + rarityOf(x);
    a.tabIndex = 0;
    a.setAttribute('role', 'button');
    a.title = 'ชี้เพื่อดู · คลิกเพื่อปักการ์ด';
    a.innerHTML = `<i class="b">[</i>${u ? `<img src="${u}" alt="">` : ''}<span>${esc(nameOf(x))}</span><i class="b">]</i>`;
    a._cl = { x, m, i };
    return a;
  }

  // the bubble over the head: the linked names in their colour (dark, on the bubble's cream)
  const INK = { common: '#6b5f4a', rare: '#1f6fd1', epic: '#7a45c9', legend: '#a8740c', fashion: '#c2408a' };
  function bubbleLines(ctx, b, cx, top, lh) {
    const text = String(b.text || '');
    if (!b.cmap) {
      b.cmap = [];
      for (const P of places(text, itemsOf(b))) for (let k = P.s; k < P.e; k++) b.cmap[k] = INK[rarityOf(P.x)] || INK.common;
    }
    const base = ctx.fillStyle;
    let at = 0;
    ctx.textAlign = 'left';
    b.lines.forEach((l, i) => {
      const f = text.indexOf(l, at), s = f < 0 ? at : f;
      at = s + l.length;
      let x = cx - ctx.measureText(l).width / 2, seg = '', col = null;
      const y = top + lh * (i + 0.5);
      const flush = () => { if (!seg) return; ctx.fillStyle = col || base; ctx.fillText(seg, x, y); x += ctx.measureText(seg).width; seg = ''; };
      for (let k = 0; k < l.length; k++) { const c = b.cmap[s + k] || null; if (c !== col) { flush(); col = c; } seg += l[k]; }
      flush();
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = base;
  }

  // ---------------- the item's card (mockup A) ----------------
  const OPT = () => NC.WOPTS || {};
  const elInfo = (el) => (NC.ELEMENT_INFO || {})[el || 'neutral'] || { th: el || 'ไม่มีธาตุ' };
  function typeText(it) {
    if (it.slot === 'weapon') {
      const T = (NC.WTYPES || {})[NC.wtypeOf ? NC.wtypeOf(it) : ''];
      return T ? `${T.name} · ${T.pair ? 'ถือคู่' : T.h === 1 ? 'มือเดียว' : 'สองมือ'}` : 'อาวุธ';
    }
    if (it.rarity === 'fashion') return 'แฟชั่น · ' + ((NC.SLOT_NAME || {})[it.slot] || it.slot);
    return (NC.SLOT_NAME || {})[it.slot] || it.slot;
  }
  function rowHtml(r) {
    const O = OPT()[r.k], sp = !!(O && O.special);
    let t = '';
    try { t = O ? O.text(r) : NC.rowText(r); } catch (e) { t = ''; }
    return t ? `<div class="r t${sp ? 's' : r.tier}">${esc(t)}</div>` : '';
  }
  const tr = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
  let fakeU = 0;
  const pieces = new WeakMap(); // (a link's copy as a piece of its own for the compare: a made-up u under 0)
  function pieceOf(x) {
    if (!x.copy) return x.id;
    if (!pieces.has(x)) pieces.set(x, Object.assign({}, x, { rows: (x.rows || []).slice(), u: -(1e6 + ++fakeU) }));
    return pieces.get(x);
  }
  function gearHtml(p, x, it) {
    const d = pieceOf(x), C = NC.WCmp, P = C ? C.piece(p, d) : null;
    const rows = [];
    let side = '';
    if (it.lvReq) side += `<div class="cl-lv">ใส่ได้ Lv ${it.lvReq}</div>`;
    const el = P ? P.el : it.element || 'neutral';
    if (it.slot === 'weapon' || el !== 'neutral') {
      const E = elInfo(el), ic = asset('el_' + el);
      side += `<div class="cl-el">${ic ? `<img src="${ic}" alt="">` : ''}<span>${esc(E.th || el)}</span></div>`;
    }
    if (P && P.grade != null && NC.gradeGems) side += `<div class="cl-gems" title="เกรดขัด">${NC.gradeGems(P.grade, 'pol', true)}</div>`;
    if (it.slot === 'weapon') {
      if (it.dmg) rows.push(tr(it.magic ? 'ATK <small>(เวท)</small>' : 'ATK', `${it.dmg[0]}–${it.dmg[1]}`));
      if (x.copy) rows.push(tr('ตีบวก', `+${x.ref || 0}${x.ref && P ? ` <small>(ATK +${P.refAtk}%)</small>` : ''}`));
      if (it.cd) rows.push(tr('ความเร็วตี', `${(1 / it.cd).toFixed(1)} ครั้ง/วิ`));
      if (P && P.range) rows.push(tr('ระยะ', P.range));
    } else {
      const st = it.stats || {};
      if (st.def) rows.push(tr('DEF', st.def));
      if (st.mdef) rows.push(tr('MDEF', st.mdef));
      if (st.hp) rows.push(tr('HP สูงสุด', st.hp));
      for (const k of Object.keys(st).filter((k) => !['def', 'mdef', 'hp'].includes(k) && st[k]).slice(0, 3)) {
        const v = st[k], frac = Math.abs(v) < 1;
        rows.push(tr(esc(k.toUpperCase()), (v > 0 ? '+' : '') + (frac ? Math.round(v * 100) + '%' : v)));
      }
      if (x.copy) rows.push(tr('ตีบวก', `+${x.ref || 0}`));
    }
    const opts = (x.rows || []).map(rowHtml).join('');
    const abil = P && P.abil ? `<div class="cl-abil">${esc(P.abil)}</div>` : '';
    const vs = C && it.rarity !== 'fashion' && GEAR_SLOTS.includes(it.slot) ? C.line(p, d) : '';
    return { vs, side, body: (rows.length ? `<table class="cl-tab">${rows.join('')}</table>` : '') + (opts ? `<div class="cl-opts">${opts}</div>` : '') + abil };
  }
  function cardHtml(x, m) {
    const p = G() && G().player, k = kindOf(x.id), r = rarityOf(x), R = NC.RARITY[r] || NC.RARITY.common;
    let type = '', vs = '', side = '', body = '', pic = '';
    if (k === 'item') {
      const it = ITEMS[x.id];
      type = typeText(it);
      pic = `<canvas data-cl="${esc(x.id)}" width="256" height="256"></canvas>`;
      if (GEAR_SLOTS.includes(it.slot) && it.rarity !== 'fashion' && p) ({ vs, side, body } = gearHtml(p, x, it));
      else body = it.desc ? `<div class="cl-desc">${esc(String(it.desc).split(' · ')[0])}</div>` : '';
      if (it.rarity === 'fashion') body = '<div class="cl-desc">ชุดแฟชั่น ใส่ทับอุปกรณ์ ไม่มีค่าพลัง</div>' + body;
    } else if (k === 'mat') {
      const M = MAT[x.id], from = NC.matSource ? NC.matSource(x.id) : '';
      type = 'วัสดุ';
      pic = `<img src="${esc(iconUrl(x))}" alt="">`;
      body = (M.price && !M.noNpc ? `<table class="cl-tab">${tr('ลุงโกโก้รับซื้อ', NC.fmtCoins(M.price) + ' / ชิ้น')}</table>` : '') +
        (from ? `<div class="cl-desc">ได้จาก: ${esc(from)}</div>` : '') + (M.desc ? `<div class="cl-desc">${esc(M.desc)}</div>` : '');
    } else if (k === 'pot') {
      const Q = potOf(x.id.slice(2));
      type = 'ยา';
      pic = `<img src="${esc(iconUrl(x))}" alt="">`;
      body = Q.what || Q.desc ? `<div class="cl-desc">${esc(Q.what || Q.desc)}</div>` : '';
    }
    const at = new Date(m.t || Date.now()), hm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
    const who = m.mine ? 'คุณ' : m.from || '?';
    const check = !x.copy ? '' : m.id ? '<div class="cl-ok">ของจริง · เซิร์ฟเวอร์ตรวจจากกระเป๋าแล้ว</div>'
      : m.mine ? '<div class="cl-ok">ของในกระเป๋าของคุณ</div>' : '<div class="cl-ok no">ข้อมูลจากผู้ส่ง · ยังไม่ได้ตรวจ</div>';
    return `<header class="cl-hd"><i></i><i></i><button class="cl-x" type="button" aria-label="ปิด">✕</button></header><div class="cl-body">` +
      (vs ? `<div class="cl-vs">${vs}</div>` : '') +
      `<div class="cl-top"><div class="cl-pic r-${r}">${pic}</div><div class="cl-side">` +
        `<div class="cl-name">${esc(nameOf(x))}</div><div class="cl-rib r-${r}">${esc(R.name)}</div><div class="cl-type">${esc(type)}</div>${side}</div></div>` +
      body +
      `<footer class="cl-ft">${check}<div>แนบโดย <b>${esc(who)}</b> ${hm}${x.copy ? ' · ค่าตอนแนบ' : ''}</div></footer></div>`;
  }

  let card = null, shown = null, pinned = false, hideT = 0;
  function showCard(a, pin) {
    if (!card || !a || !a._cl) return;
    clearTimeout(hideT);
    shown = a; pinned = !!pin;
    card.className = 'cl-card r-' + rarityOf(a._cl.x) + (pinned ? ' pin' : '');
    card.innerHTML = cardHtml(a._cl.x, a._cl.m);
    card.hidden = false;
    for (const cv of card.querySelectorAll('canvas[data-cl]')) {
      try { cv.getContext('2d').drawImage(NC.itemIcon(cv.dataset.cl, 256), 0, 0); } catch (e) { /* not loaded yet */ }
    }
    place();
  }
  function hideCard() { clearTimeout(hideT); if (card) card.hidden = true; shown = null; pinned = false; }
  // beside the chat window, its tail at the link (a phone: in the middle of the screen)
  function place() {
    if (!card || card.hidden || !shown) return;
    const gap = 12, vw = innerWidth, vh = innerHeight, cw = card.offsetWidth, ch = card.offsetHeight;
    if (!shown.isConnected) return;
    const r = shown.getBoundingClientRect(), w = ($('chatwin') || shown).getBoundingClientRect();
    let left = w.right + gap, top = r.top + r.height / 2 - ch * 0.42, side = true;
    if (mob() || left + cw > vw - gap) { left = Math.max(gap, Math.min(vw - cw - gap, r.left)); top = r.top - ch - gap; side = false; }
    if (!side && top < gap) top = Math.min(vh - ch - gap, r.bottom + gap);
    if (mob()) { left = (vw - cw) / 2; top = (vh - ch) / 2; }
    top = Math.max(gap, Math.min(vh - ch - gap, top));
    card.style.left = Math.round(left) + 'px';
    card.style.top = Math.round(top) + 'px';
    card.classList.toggle('tail', side && !mob());
    card.style.setProperty('--ty', Math.round(Math.max(24, Math.min(ch - 24, r.top + r.height / 2 - top))) + 'px');
  }

  // ---------------- setting up (after the chat window is built) ----------------
  function setup() {
    input = $('cw-text');
    const list = $('cw-list');
    if (!input || !list || box) return;
    box = document.createElement('div');
    box.className = 'cl-box';
    input.parentNode.insertBefore(box, input);
    mirror = document.createElement('div');
    mirror.className = 'cl-mirror';
    mirror.setAttribute('aria-hidden', 'true');
    count = document.createElement('b');
    count.className = 'cl-count';
    box.append(mirror, input, count);
    input.addEventListener('keydown', onKey);
    input.addEventListener('input', () => { prune(); sync(); });
    for (const ev of ['keyup', 'mouseup', 'select']) input.addEventListener(ev, snap);
    input.addEventListener('scroll', () => { mirror.scrollLeft = input.scrollLeft; });
    input.addEventListener('focus', () => { prune(); sync(); if (!raf) raf = requestAnimationFrame(follow); });
    input.addEventListener('blur', sync);

    card = document.createElement('div');
    card.className = 'cl-card'; card.hidden = true;
    document.body.appendChild(card);
    card.addEventListener('click', (e) => { if (e.target.closest('.cl-x')) hideCard(); });
    list.addEventListener('mouseover', (e) => {
      const a = e.target.closest('.cl-link');
      if (!a || pinned || mob()) return;
      if (a !== shown) showCard(a, false); else clearTimeout(hideT);
    });
    list.addEventListener('mouseout', (e) => {
      const a = e.target.closest('.cl-link');
      if (!a || pinned || (e.relatedTarget && a.contains(e.relatedTarget))) return;
      hideT = setTimeout(hideCard, 140);
    });
    list.addEventListener('click', (e) => {
      const a = e.target.closest('.cl-link');
      if (!a) return;
      e.preventDefault(); e.stopPropagation();
      if (pinned && shown === a) hideCard(); else showCard(a, true);
    });
    list.addEventListener('keydown', (e) => {
      const a = e.target.closest && e.target.closest('.cl-link');
      if (a && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); showCard(a, true); }
    });
    list.addEventListener('scroll', () => { if (pinned) place(); else if (shown) hideCard(); });
    addEventListener('resize', place);
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && pinned) { hideCard(); e.stopPropagation(); } }, true);
    document.addEventListener('pointerdown', (e) => { if (pinned && !card.contains(e.target) && !e.target.closest('.cl-link')) hideCard(); }, true);
  }

  // Shift + click in the bag: a cell, or a worn slot (the click is ours; the shift's text selection and the box's
  // focus loss are stopped on the press)
  const bagKey = (t) => {
    if (!t || !t.closest || !t.closest('#inv')) return null;
    const cell = t.closest('[data-k]');
    if (cell) return cell.dataset.k;
    const slot = t.closest('[data-slot]');
    return slot && NC.invSlotKey ? NC.invSlotKey(slot.dataset.slot) : null;
  };
  document.addEventListener('mousedown', (e) => { if (e.shiftKey && bagKey(e.target)) e.preventDefault(); }, true);
  document.addEventListener('click', (e) => {
    if (!e.shiftKey || !NC.invEntryAt) return;
    const k = bagKey(e.target);
    if (!k) return;
    e.preventDefault(); e.stopPropagation();
    linkEntry(NC.invEntryAt(k));
  }, true);

  // the card's แนบในแชท button (js/inventory.js renderDetail; the press comes back as the bag action 'cl:link')
  NC.invCardDone = function (detail, en) {
    if (!fromEntry(en)) return;
    const b = '<button class="iv-btn blue cl-linkb" data-act="cl:link" title="Shift + คลิกที่ช่องของก็แนบได้"><i></i>แนบในแชท</button>';
    const foot = detail.querySelector('footer.wc-acts');
    if (foot) foot.insertAdjacentHTML('beforebegin', `<div class="cl-cardrow">${b}</div>`);
    else detail.insertAdjacentHTML('beforeend', `<div class="iv-acts cl-cardrow">${b}</div>`);
  };
  if (NC.invActs) NC.invActs.unshift((game, a, en) => { if (a !== 'cl:link') return false; linkEntry(en); return true; });

  const baseInit = NC.HUD.init;
  NC.HUD.init = function (g) { const r = baseInit.apply(this, arguments); setup(); return r; };

  NC.ChatLink = { take, sent, oldServer, plain, fill, wireIn, bubbleLines, attach, linkEntry, fromEntry, clean, nameOf, rarityOf, MAX, get chips() { return chips.slice(); } };
})();
