/* chat.js — the chat window, MMO style: separate player conversations and game activity in the bottom-left window.
   Tabs: แชต (conversations), ทั่วไป (global), แมพ (map/channel), กระซิบ (whispers),
   บันทึก (EXP, items and game events, with its own independent history).
   Enter to type, Enter to send, Esc to leave; the chip before the text picks where it goes (click it, or Tab); ↑ / ↓
   bring back what you sent. Commands: /w name text (whisper) · /r text (answer the last whisper) · /a /m (everyone /
   this map) · /p /g (my party / my guild, 2026-10-01: js/partynet.js, js/guild.js) · /who (who is online) · /sit (sit
   down) · /shop (open a shop, vend.js) · /clear · /help.
   Click a name in the window to whisper to it. What is said to everyone or on the map shows in a bubble over the head.
   Items linked from the bag (Shift + click, the card's แนบในแชท) show as their names in colour, pointing shows the
   item's card: js/chatlink.js (m.items, the box's chips).
   Online chat uses authenticated Nakama RPCs, PostgreSQL history and socket notifications.
   Legacy offline/LAN lines come through net.js ('cq': counter, channel, to whom,
   text) and theirs arrive in NC.Net.hooks. The other adventurers (bots.js) talk on the map channel, and one of them may
   answer when you say something. */
(function () {
  'use strict';
  const NC = window.NC, net = NC.Net;
  const $ = (id) => document.getElementById(id);
  // TEXT_MAX: the server's limit (backend/chat.go, 200 runes); P2P_TEXT_MAX: the offline peer-to-peer packets
  const MAX_LINES = 160, ONLINE_LINES = 1000, PAGE_LINES = 50, TEXT_MAX = 200, P2P_TEXT_MAX = 80, BUBBLE_S = 6, OUT_KEEP = 3, SIZES = ['s', 'm', 'l'];
  const CH = { a: 'ทั่วไป', m: 'แมพ', p: 'ปาร์ตี้', g: 'กิลด์', w: 'กระซิบ', sys: 'ระบบ' };
  const TABS = [['all', 'ทั้งหมด'], ['a', 'ทั่วไป'], ['m', 'แมพ'], ['p', 'ปาร์ตี้'], ['g', 'กิลด์'], ['w', 'กระซิบ'], ['sys', 'บันทึก']];
  // the party's and the guild's own channels: `to` is the party's / the guild's id (js/partynet.js, js/guild.js)
  const groupOf = (ch) => (ch === 'p' ? (NC.PartyNet && NC.PartyNet.pid()) || null : ch === 'g' ? (NC.Guild && NC.Guild.gid()) || null : null);
  const SIZE_KEY = 'nightcamp.chatsize.v1';
  const clean = (s, n) => (net ? net.clean(s, n) : String(s == null ? '' : s).trim().slice(0, n));
  let game = null, win = null, list = null, input = null, chip = null;
  let tab = 'all', channel = 'a', wTo = null, lastFrom = null, size = 'm';
  const lines = [], activity = [], seen = new Set(), unread = { a: 0, m: 0, p: 0, g: 0, w: 0, sys: 0 }, history = [];
  let histAt = -1, seq = 0, meBubble = null, replyAt = 0;
  const out = [], pending = [];
  const myName = () => clean(game && game.player && game.player.name, 16) || 'คุณ';

  // ---------------- the lines ----------------
  const shows = (m, t) => t === 'all' ? m.ch !== 'sys' : m.ch === t || (m.ch === 'notice' && t !== 'sys');
  const currentLines = () => tab === 'sys' ? activity : lines;
  let syncVersion = 0, lineSequence = 0, onlineScope = null;
  const paging = { cursor: '', hasMore: false, initialized: false, busy: false, browsing: false, capped: false, missedLive: false, error: '' };
  const isOnline = () => !!(NC.Online?.active || NC.Online?.enabled);
  const atEnd = () => !list || list.scrollTop + list.clientHeight >= list.scrollHeight - 30;
  // PostgreSQL IDs are decimal strings. Number would collapse distinct BIGINTs
  // above 2^53, changing ordering and pagination at equal timestamps.
  function decimalID(value) {
    const id = String(value ?? '');
    return /^[0-9]+$/.test(id) ? id.replace(/^0+(?=\d)/, '') : '';
  }
  function compareLines(a, b) {
    const aid = decimalID(a.id), bid = decimalID(b.id);
    if (aid && bid) return aid.length - bid.length || (aid < bid ? -1 : aid > bid ? 1 : 0);
    // a local notice keeps its own time among the server's messages (Discord #167, 2026-10-21: "ออฟไลน์อยู่ · กระซิบได้
    // เฉพาะคนที่ออนไลน์" always sorted after every later message, so it stayed at the bottom till a reload)
    if (aid || bid) return (a.t || 0) - (b.t || 0) || (aid ? -1 : 1);
    return a.t - b.t || (a._lineSequence || 0) - (b._lineSequence || 0);
  }
  function rebuildSeen() {
    seen.clear();
    for (const m of lines) if (m.id) seen.add(String(m.id));
  }
  function rememberSeen(id) {
    seen.add(id);
    if (seen.size <= ONLINE_LINES * 2) return;
    const displayed = new Set(lines.filter(m => m.id).map(m => String(m.id)));
    for (const old of seen) {
      if (!displayed.has(old)) { seen.delete(old); break; }
    }
  }
  // (online: a notice of ours is stamped with the server's clock, as the server's lines are; a PC clock set ahead or behind
  // must not pin it at the bottom or hide it above, Discord #167)
  const stampOf = (m) => {
    const W = NC.OnlineWorld, O = NC.Online;
    if (!m.id && isOnline() && W && W.snap && Number.isFinite(W.snap.serverTime) && O && O.lastSnapAt > 0) return W.snap.serverTime + Math.max(0, Date.now() - O.lastSnapAt);
    return Date.now();
  };
  function add(m) {
    m.t = m.t || stampOf(m);
    m._lineSequence = ++lineSequence;
    const buffer = m.ch === 'sys' ? activity : lines;
    const onlineBuffer = buffer === lines && isOnline();
    const cap = onlineBuffer ? ONLINE_LINES : MAX_LINES;
    if (onlineBuffer && buffer.length >= cap && (m.historical || paging.browsing || !atEnd())) {
      if (!m.historical) paging.missedLive = true;
      renderHistoryControls();
      return false;
    }
    const anchor = list && onlineBuffer && !m.historical ? captureScroll() : null;
    buffer.push(m);
    if (m.historical || onlineBuffer) buffer.sort(compareLines);
    if (buffer.length > cap) buffer.shift(); // keep a bounded echo cache independent from displayed rows
    if (!list || m.historical) return true;
    if (shows(m, tab)) {
      if (onlineBuffer) { renderLines(); restoreScroll(anchor, m.mine || anchor?.atEnd); }
      else append(m, true);
    }
    else if (['a', 'm', 'w', 'p', 'g'].includes(m.ch) && !m.mine && !m.historical) { unread[m.ch]++; renderTabs(); }
    renderHistoryControls();
    return true;
  }
  NC.Chat = { add, say: (text) => submit(text), receiveOnline, syncOnline, syncScopeOnline, loadOlderOnline, resetOnline, tickBubbles, drawBubbles };
  function clearPaging() {
    ++syncVersion;
    Object.assign(paging, { cursor: '', hasMore: false, initialized: false, busy: false, browsing: false, capped: false, missedLive: false, error: '' });
  }
  function resetOnline() {
    clearPaging(); onlineScope = null; lines.length = 0; seen.clear(); out.length = 0; pending.length = 0; history.length = 0; histAt = -1;
    lastFrom = wTo = meBubble = null; channel = 'a';
    for (const key in unread) unread[key] = 0;
    if (list) { renderLines(); renderTabs(); renderChip(); renderHistoryControls(); }
  }
  function scopeOf() {
    const state = NC.Online.getState(), self = state.lastSnapshot?.self, guild = self?.social?.guild;
    return { player: state.playerId || '', map: state.mapId || '', channel: state.channelId || '', party: self?.party?.id || '', guild: (typeof guild === 'string' ? guild : guild?.id) || '' };
  }
  const scopeKey = (scope) => JSON.stringify(scope);
  function visibleOnline(m, scope) {
    if (m.ch === 'w') return m.peer === scope.player || m.toPeer === scope.player;
    if (m.ch === 'm') return m.mapId === scope.map && m.channelId === scope.channel;
    if (m.ch === 'p') return !!scope.party && typeof m.group === 'string' && (m.group === 'party:' + scope.party || m.group.startsWith('party:') && m.group.endsWith('/' + scope.party));
    if (m.ch === 'g') return !!scope.guild && m.group === 'guild:' + scope.guild;
    return true;
  }
  function updateScope() {
    if (!isOnline()) return false;
    const scope = scopeOf();
    if (onlineScope && scopeKey(scope) === scopeKey(onlineScope)) return false;
    const changedPlayer = !onlineScope || scope.player !== onlineScope.player;
    const anchor = list ? captureScroll() : null;
    clearPaging();
    for (let i = lines.length - 1; i >= 0; i--) if (changedPlayer || !visibleOnline(lines[i], scope)) lines.splice(i, 1);
    rebuildSeen();
    lastFrom = wTo = meBubble = null;
    for (const key in unread) unread[key] = 0;
    onlineScope = scope;
    if (list) { renderLines(); restoreScroll(anchor, changedPlayer); renderTabs(); renderHistoryControls(); }
    return true;
  }
  function syncScopeOnline() {
    if (updateScope()) return fetchHistoryPage(false);
  }
  function receiveOnline(m, historical = false) {
    if (!isOnline() || !m?.id || !['a', 'm', 'w', 'p', 'g'].includes(m.ch)) return;
    const scopeChanged = updateScope();
    if (scopeChanged && !historical) void fetchHistoryPage(false);
    if (!visibleOnline(m, onlineScope)) return;
    if (seen.has(String(m.id)) && (!historical || lines.some(line => line.id === String(m.id)))) return;
    const state = NC.Online.getState();
    const mine = m.peer === state.playerId;
    add({ ...m, id: String(m.id), mine, historical }); rememberSeen(String(m.id));
    if (!historical && m.ch === 'w' && !mine) lastFrom = { name: m.from, peer: m.peer };
    if (!historical && m.ch !== 'w' && m.mapId === state.mapId && m.channelId === state.channelId) {
      if (mine) meBubble = { text: m.text, t: 0, items: m.items };
      else { const r = NC.Online.remotes.get(m.peer); if (r) r.bubble = { text: m.text, t: 0, items: m.items }; }
    }
  }
  async function syncOnline() {
    if (!isOnline()) return;
    updateScope();
    clearPaging(); lines.length = 0; seen.clear();
    if (list) { renderLines(); renderHistoryControls(); }
    return fetchHistoryPage(false);
  }
  async function loadOlderOnline() {
    if (!isOnline()) return;
    if (updateScope()) return fetchHistoryPage(false);
    if (paging.busy || paging.capped || lines.length >= ONLINE_LINES || paging.initialized && !paging.hasMore && !paging.error) return;
    return fetchHistoryPage(paging.initialized);
  }
  async function fetchHistoryPage(older) {
    if (!isOnline() || paging.busy || !onlineScope) return;
    const version = syncVersion, scope = scopeKey(onlineScope), cursor = older ? paging.cursor : '';
    const limit = Math.min(PAGE_LINES, ONLINE_LINES - lines.length);
    if (limit <= 0) { renderHistoryControls(); return; }
    paging.busy = true; paging.error = '';
    renderHistoryControls();
    try {
      const page = await NC.Online.chat('historyPage', { limit, ...(cursor ? { cursor } : {}) });
      if (version !== syncVersion || !isOnline()) return;
      if (scope !== scopeKey(scopeOf())) { void syncScopeOnline(); return; }
      if (!page) return;
      validateHistoryPage(page, cursor, limit);
      const displayed = new Set(lines.filter(m => m.id).map(m => m.id));
      const incoming = new Set(page.messages.filter(m => visibleOnline(m, onlineScope) && !displayed.has(m.id)).map(m => m.id));
      // Live arrivals can consume the space available when this RPC started.
      // Reject the entire page, keeping its cursor and current rows intact.
      if (incoming.size > ONLINE_LINES - lines.length) { paging.capped = true; paging.browsing = true; return; }
      const anchor = list ? captureScroll() : null;
      for (const m of page.messages) receiveOnline(m, true);
      paging.cursor = page.nextCursor; paging.hasMore = page.hasMore; paging.initialized = true;
      if (older) paging.browsing = true;
      if (list) { renderLines(true); restoreScroll(anchor, !older && anchor?.atEnd); }
    } catch (error) {
      if (version === syncVersion && isOnline() && scope === scopeKey(scopeOf())) {
        paging.error = error.message || 'โหลดประวัติแชตไม่สำเร็จ กรุณาลองอีกครั้ง';
        if (paging.error.includes('โหลดประวัติใหม่')) { paging.cursor = ''; paging.initialized = false; paging.hasMore = false; }
      } else if (version === syncVersion && isOnline()) void syncScopeOnline();
    } finally {
      if (version === syncVersion) { paging.busy = false; renderHistoryControls(); }
    }
  }
  function validateHistoryPage(page, cursor, limit) {
    const valid = Array.isArray(page.messages) && page.messages.length <= limit && typeof page.nextCursor === 'string' && typeof page.hasMore === 'boolean' &&
      (page.hasMore ? page.messages.length > 0 && page.nextCursor && page.nextCursor !== cursor : page.nextCursor === '') &&
      page.messages.every(m => m && typeof m.id === 'string' && /^[1-9][0-9]{0,18}$/.test(m.id) && (m.id.length < 19 || m.id <= '9223372036854775807') &&
        ['a', 'm', 'w', 'p', 'g'].includes(m.ch) && typeof m.peer === 'string' && !!m.peer && typeof m.from === 'string' && typeof m.text === 'string' &&
        Number.isFinite(m.t) && typeof m.mapId === 'string' && typeof m.channelId === 'string' &&
        (m.ch !== 'w' || typeof m.toPeer === 'string') && (!['p', 'g'].includes(m.ch) || typeof m.group === 'string' && !!m.group));
    if (!valid) throw new Error('โหลดประวัติแชตไม่สำเร็จ กรุณาลองอีกครั้ง');
  }
  function renderHistoryControls() {
    const controls = $('cw-history'), older = $('cw-older'), status = $('cw-history-status'), latest = $('cw-latest');
    if (!controls) return;
    controls.hidden = !isOnline() || tab === 'sys';
    if (controls.hidden) return;
    const capped = paging.capped || lines.length >= ONLINE_LINES;
    older.disabled = paging.busy || capped || paging.initialized && !paging.hasMore && !paging.error;
    older.textContent = paging.busy ? 'กำลังโหลด…' : paging.error ? 'ลองอีกครั้ง' : 'โหลดข้อความเก่า';
    status.textContent = paging.error || (capped ? `ประวัติเต็ม · เก็บได้ ${ONLINE_LINES} ข้อความ` : paging.initialized && !paging.hasMore ? 'ถึงข้อความแรกแล้ว' : paging.initialized ? `${lines.filter(m => m.id).length} ข้อความ · โหลดครั้งละ ${PAGE_LINES}` : 'ประวัติแชต');
    latest.hidden = !paging.browsing && !capped && !paging.missedLive;
    latest.disabled = paging.busy;
    latest.textContent = paging.missedLive ? 'มีข้อความใหม่ · ดูล่าสุด' : 'ดูข้อความล่าสุด';
  }
  function captureScroll() {
    const box = list.getBoundingClientRect();
    const row = [...list.children].find(el => el.dataset?.lineKey && el.getBoundingClientRect().bottom > box.top);
    return { atEnd: atEnd(), top: list.scrollTop, key: row?.dataset.lineKey || '', offset: row ? row.getBoundingClientRect().top - box.top : 0 };
  }
  function restoreScroll(anchor, followTail = false) {
    if (!list || !anchor) return;
    if (followTail) { list.scrollTop = list.scrollHeight; return; }
    const row = [...list.children].find(el => el.dataset?.lineKey === anchor.key);
    if (row) list.scrollTop += row.getBoundingClientRect().top - list.getBoundingClientRect().top - anchor.offset;
    else list.scrollTop = anchor.top;
  }
  const sys = (text, kind) => {
    if (tab === 'sys') setTab('all');
    // the same notice again right under itself (Enter pressed again on a whisper that cannot go, Discord #156: four
    // lines of it) is said once: the line flashes instead of a new one
    const last = lines[lines.length - 1];
    if (last && last.ch === 'notice' && !last.help && last.text === text && last.kind === (kind || 'sys') && Date.now() - last.t < 20000) {
      const el = list && [...list.children].reverse().find((d) => d.dataset && d.dataset.lineKey === 'line:' + last._lineSequence);
      if (el && el.animate) el.animate([{ background: 'rgba(255, 160, 160, 0.35)' }, { background: 'transparent' }], { duration: 700 });
      return;
    }
    add({ ch: 'notice', kind: kind || 'sys', text });
  };
  function lineEl(m) {
    const d = document.createElement('div');
    d.dataset.lineKey = m.id ? 'id:' + m.id : 'line:' + m._lineSequence;
    if (m.id) d.dataset.messageId = m.id;
    d.className = 'cl ' + (['sys', 'notice'].includes(m.ch) ? 'cs ' + (m.kind || 'sys') : 'c' + m.ch) + (m.mine ? ' mine' : '') + (m.bot ? ' bot' : '');
    const at = new Date(m.t);
    d.title = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
    if (!['sys', 'notice'].includes(m.ch)) {
      if (m.ch !== 'a') {
        const tag = document.createElement('i');
        tag.textContent = m.ch === 'w' ? (m.mine ? `[ถึง ${m.to}]` : '[กระซิบ]') : `[${CH[m.ch] || 'แมพ'}]`;
        d.appendChild(tag);
      }
    }
    if (m.ch !== 'sys' && !m.note) { // (a note: the party's or the guild's own news, no name)
      const who = document.createElement('b');
      who.textContent = m.from;
      if (!m.mine && !m.bot) { who.className = 'nm'; who.dataset.name = m.from; if (m.peer) who.dataset.peer = m.peer; }
      if (m.color) who.style.color = m.color;
      if (!(m.ch === 'w' && m.mine)) d.appendChild(who); // (my own whisper: just "[ถึง name]")
      d.appendChild(document.createTextNode(': '));
    }
    const tx = document.createElement('span');
    if (m.items && m.items.length && NC.ChatLink) NC.ChatLink.fill(tx, m); // (the linked items' names in their colour: js/chatlink.js)
    else tx.textContent = m.text;
    d.appendChild(tx);
    return d;
  }
  function append(m, one) {
    const atEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 30;
    list.querySelector('.cw-empty')?.remove();
    list.appendChild(lineEl(m));
    while (list.children.length > (isOnline() && tab !== 'sys' ? ONLINE_LINES : MAX_LINES)) list.firstChild.remove();
    if (atEnd || !one || m.mine) list.scrollTop = list.scrollHeight;
  }
  function renderLines(historical = false) {
    if (historical) list.setAttribute('aria-live', 'off');
    list.textContent = '';
    for (const m of currentLines()) if (shows(m, tab)) list.appendChild(lineEl(m));
    if (!list.children.length) {
      const empty = document.createElement('div'); empty.className = 'cw-empty';
      empty.textContent = tab === 'sys' ? 'EXP · ของดรอป · เหตุการณ์ในเกม จะแสดงที่นี่' : 'ยังไม่มีข้อความ · EXP และของดรอปอยู่ในแท็บบันทึก';
      list.appendChild(empty);
    }
    list.scrollTop = list.scrollHeight;
    if (historical) list.setAttribute('aria-live', 'polite');
  }
  function renderTabs() {
    for (const b of win.querySelectorAll('[data-tab]')) {
      const t = b.dataset.tab, n = t === 'all' ? 0 : unread[t] || 0;
      b.classList.toggle('on', t === tab);
      b.setAttribute('aria-selected', String(t === tab));
      b.tabIndex = t === tab ? 0 : -1;
      b.querySelector('b').textContent = n ? (n > 99 ? '99+' : n) : '';
    }
  }
  function renderChip() {
    chip.className = 'cw-chip c' + channel;
    chip.textContent = channel === 'w' ? `กระซิบ: ${wTo ? wTo.name : '?'}` : CH[channel];
  }
  function setTab(t) {
    tab = t;
    if (t !== 'all') unread[t] = 0; else for (const k in unread) unread[k] = 0;
    renderTabs(); renderLines(); renderHistoryControls();
  }

  // ---------------- saying things ----------------
  async function send(ch, text, to) {
    text = Array.from(text).slice(0, TEXT_MAX).join('');
    if (tab === 'sys') setTab('all');
    // the items linked in the box (js/chatlink.js): L.refs go to the server, which puts its own copies of them on the
    // message (server patch 018); L.items are drawn on our own line offline and L.wire rides the peer packet
    const L = NC.ChatLink ? NC.ChatLink.take(text) : null;
    if (isOnline()) {
      // the server's chat (backend/chat.go) carries every channel; party and guild talk go to the sender's own group
      try {
        const fields = { requestId: crypto.randomUUID(), ch, text, ...(ch === 'w' ? { toPeer: to?.peer || '', toName: to?.name || '' } : {}) };
        let message;
        try { message = await NC.Online.chat('send', L && L.refs ? { ...fields, items: L.refs } : fields); }
        catch (error) { // (a server without patch 018 refuses the field: the names go as plain text)
          if (!L || !L.refs || !NC.ChatLink.oldServer(error)) throw error;
          message = await NC.Online.chat('send', { ...fields, requestId: crypto.randomUUID() });
        }
        if (!message) return false;
        if (L) NC.ChatLink.sent();
        receiveOnline(message); return true;
      } catch (error) {
        const why = ch === 'w' && NO_TO.test((error && error.message) || '') ? await whyNoWhisper(to) : '';
        sys(why || (error && error.message) || 'ส่งข้อความไม่สำเร็จ', 'warn'); return false;
      }
    }
    text = Array.from(text).slice(0, P2P_TEXT_MAX).join('');
    const items = L ? L.items : undefined, q = (e) => (L ? e.concat([L.wire]) : e);
    if (ch === 'p' || ch === 'g') {
      const id = groupOf(ch);
      if (!id) { sys(ch === 'p' ? 'ยังไม่ได้อยู่ในปาร์ตี้ (กด P ชวนเพื่อน)' : 'ยังไม่ได้อยู่ในกิลด์ (กด O)', 'warn'); return; }
      out.push(q([++seq, ch, id, text]));
      add({ ch, from: myName(), text, mine: true, items });
    } else if (ch === 'w') {
      const r = to && ((to.peer && net && net.remotes.get(to.peer)) || (net && net.byName(to.name)));
      if (!r) { sys(to ? `ไม่พบ ${to.name} ที่ออนไลน์อยู่` : 'จะกระซิบหาใคร? คลิกชื่อในแชท หรือพิมพ์ /w ชื่อ ข้อความ', 'warn'); return; }
      wTo = { name: r.name, peer: r.peer };
      out.push(q([++seq, 'w', r.peer, text]));
      add({ ch: 'w', from: myName(), to: r.name, text, mine: true, items });
    } else {
      out.push(q([++seq, ch, 0, text]));
      add({ ch, from: myName(), text, mine: true, items });
      meBubble = { text, t: 0, items };
      botsHear(text);
    }
    if (L) NC.ChatLink.sent();
    while (out.length > OUT_KEEP) out.shift();
    if (net && net.send) net.send();
  }
  // a whisper the server would not deliver (backend chat.go: one answer, "ไม่พบผู้รับ หรือชื่อซ้ำกัน ...", for a name
  // nobody online has, two online heroes of that name, or ourselves): the online list says which it was (Discord #156,
  // 2026-10-20: a whisper to a friend who had logged off said "not found or the name is taken", and each Enter said it again)
  const NO_TO = /ไม่พบผู้รับ/;
  async function whyNoWhisper(to) {
    const name = (to && to.name) || '';
    let peers = null;
    try { peers = await NC.Online.chat('peers'); } catch (e) { peers = null; }
    if (!Array.isArray(peers) || !to) return '';
    const meId = NC.Online.getState ? NC.Online.getState().playerId : '';
    const hits = peers.filter((r) => (to.peer ? r.peer === to.peer : r.name === name.trim()));
    const who = name || (hits[0] && hits[0].name) || 'ผู้เล่นคนนี้';
    if (hits.some((r) => r.peer === meId)) return 'กระซิบหาตัวเองไม่ได้';
    if (hits.length > 1) return `มีผู้เล่นชื่อ ${who} ออนไลน์อยู่มากกว่าหนึ่งคน · คลิกชื่อของคนที่ต้องการในแชทเพื่อกระซิบ`;
    if (!hits.length) return `${who} ออฟไลน์อยู่ · กระซิบได้เฉพาะคนที่ออนไลน์${to.peer ? '' : ' (ถ้าพิมพ์ชื่อเอง ลองเช็กตัวสะกดด้วย)'}`;
    return '';
  }
  // "/w name text": the name may have spaces, so the longest online name the rest starts with wins
  function splitName(rest, peers) {
    const names = peers.map(r => r.name).sort((a, b) => b.length - a.length);
    for (const n of names) if (rest === n || rest.startsWith(n + ' ')) return [n, rest.slice(n.length).trim()];
    const i = rest.indexOf(' ');
    return i < 0 ? [rest, ''] : [rest.slice(0, i), rest.slice(i + 1).trim()];
  }
  async function command(text) {
    const sp = text.indexOf(' '), cmd = (sp < 0 ? text : text.slice(0, sp)).toLowerCase(), rest = sp < 0 ? '' : text.slice(sp + 1).trim();
    switch (cmd) {
      case '/w': case '/whisper': case '/กระซิบ': case '/ก': {
        const peers = isOnline() ? await NC.Online.chat('peers') || [] : net ? [...net.remotes.values()].filter(r => r.named) : [];
        const [name, msg] = splitName(rest, peers);
        if (!name) { sys('พิมพ์ /w ชื่อ ข้อความ', 'warn'); return; }
        const r = !isOnline() && net && net.byName(name);
        wTo = { name, peer: r ? r.peer : null }; channel = 'w'; renderChip();
        if (msg) return send('w', msg, wTo);
        return;
      }
      case '/r': case '/reply': case '/ตอบ':
        if (!lastFrom) { sys('ยังไม่มีใครกระซิบมา', 'warn'); return; }
        wTo = lastFrom; channel = 'w'; renderChip();
        if (rest) return send('w', rest, wTo);
        return;
      case '/a': case '/all': case '/ทั่วไป':
        channel = 'a'; renderChip(); if (rest) return send('a', rest); return;
      case '/m': case '/map': case '/แมพ':
        channel = 'm'; renderChip(); if (rest) return send('m', rest); return;
      case '/p': case '/party': case '/ปาร์ตี้': case '/ป':
        channel = 'p'; renderChip(); if (rest) return send('p', rest); return;
      case '/g': case '/guild': case '/กิลด์':
        channel = 'g'; renderChip(); if (rest) return send('g', rest); return;
      case '/who': case '/ใคร': case '/online': {
        if (isOnline()) {
          const peers = await NC.Online.chat('peers');
          if (peers) sys(`ออนไลน์ ${peers.length} คน: ${peers.map(p => p.map ? `${p.name} (${NC.MAPS[p.map]?.name || p.map})` : p.name).join(' · ')}`); // (a map only for friends, party and guild: the server's peersSeenBy)
          return;
        }
        const rs = net ? [...net.remotes.values()].filter((r) => r.named) : [];
        if (!net || !net.room) { sys('ยังไม่ได้เล่นออนไลน์ (เปิดเกมผ่านลิงก์ Claude Artifact เพื่อเล่นกับเพื่อน)', 'sys'); return; }
        sys(`ออนไลน์ ${rs.length + 1} คน: ${[myName() + ' (คุณ)', ...rs.map((r) => `${r.name} Lv ${r.lv} · ${net.mapName(r.map)}`)].join(' · ')}`, 'level');
        return;
      }
      case '/sit': case '/นั่ง':
        if (NC.Rest) NC.Rest.toggle(game); return;
      case '/shop': case '/vend': case '/ร้าน':
        if (NC.Vend) NC.Vend.setup(); return;
      case '/clear': case '/ล้าง':
        currentLines().length = 0; if (tab !== 'sys' && isOnline()) clearPaging(); renderLines(); renderHistoryControls(); return;
      case '/help': case '/?': case '/ช่วย':
        sys('คำสั่ง: /w ชื่อ ข้อความ (กระซิบ) · /r ข้อความ (ตอบกระซิบ) · /a (ทั่วไป) · /m (แมพ) · /p (ปาร์ตี้) · /g (กิลด์) · /who (ใครออนไลน์) · /sit (นั่ง) · /shop (ตั้งร้าน) · /duel ชื่อ (ท้าดวล) · /bot (ดวลกับบอท) · /clear (ล้างแชท) · Tab เปลี่ยนช่อง · คลิกชื่อเพื่อกระซิบ', 'job');
        return;
      default:
        if (NC.chatCmds && NC.chatCmds[cmd]) { NC.chatCmds[cmd](rest, sys); return; } // (other files' commands: pvp.js /duel)
        sys(`ไม่รู้จักคำสั่ง ${cmd} · พิมพ์ /help ดูคำสั่งทั้งหมด`, 'warn');
    }
  }
  async function submit(raw) {
    const text = clean(NC.ChatLink ? NC.ChatLink.plain(raw) : raw, 200); // (a linked item's icon room out: js/chatlink.js)
    if (!text) return;
    history.unshift(text); if (history.length > 20) history.pop();
    try {
      if (text[0] === '/') return await command(text);
      return await send(channel, text, channel === 'w' ? wTo : null);
    } catch (error) { sys(error.message || 'ใช้แชตไม่สำเร็จ', 'warn'); return false; }
  }

  // ---------------- other players (net.js) ----------------
  if (net) {
    net.fields.push({ key: 'cq', get: () => (out.length ? out.slice() : null) });
    net.hooks.push((r, pr, first) => {
      if (isOnline()) return;
      const q = Array.isArray(pr.cq) ? pr.cq.filter((e) => Array.isArray(e) && typeof e[0] === 'number' && Number.isFinite(e[0])) : [];
      const top = q.reduce((m, e) => Math.max(m, e[0]), 0);
      if (first || r.cqSeq === undefined) { r.cqSeq = top; return; }
      for (const e of q.sort((a, b) => a[0] - b[0])) {
        if (e[0] <= r.cqSeq) continue;
        r.cqSeq = e[0];
        hear(r, e);
      }
    });
  }
  function hear(r, e) {
    const ch = e[1], text = clean(e[3], TEXT_MAX);
    if (!text || (ch !== 'a' && ch !== 'm' && ch !== 'w' && ch !== 'p' && ch !== 'g')) return;
    if (ch === 'm' && r.map !== game.mapId) return;
    if ((ch === 'p' || ch === 'g') && (!groupOf(ch) || e[2] !== groupOf(ch))) return; // (another party's / guild's)
    if (ch === 'w' && e[2] !== net.me()) return; // (a whisper to someone else)
    // someone flooding: at most 6 lines in 5 seconds each
    const now = Date.now();
    r.chatTimes = (r.chatTimes || []).filter((t) => now - t < 5000);
    if (r.chatTimes.length >= 6) return;
    r.chatTimes.push(now);
    const items = NC.ChatLink ? NC.ChatLink.wireIn(e[4]) : undefined; // (the items they linked, as they sent them: js/chatlink.js)
    add({ ch, from: r.name, peer: r.peer, text, color: r.color, items });
    if (ch === 'w') lastFrom = { name: r.name, peer: r.peer };
    else if (r.map === game.mapId && ch !== 'p' && ch !== 'g') r.bubble = { text, t: 0, items };
  }

  // ---------------- the other adventurers talk on the map channel, and sometimes answer ----------------
  const REPLY = [
    [/สวัสดี|หวัดดี|ดีจ้า|ดีครับ|ดีค่ะ|hello|hi\b|hey/i, ['หวัดดีจ้า~', 'สวัสดีครับ!', 'ดีจ้า มาล่ามอนด้วยกันนะ', 'หวัดดี ^^', 'ดีค้าบ~']],
    [/ตี้|ปาร์ตี้|party|ไปด้วย/i, ['ตี้ด้วยคน!', 'เวลเท่าไหร่ครับ?', 'ไปบอสเห็ดไหม', 'รอแป๊บ เดี๋ยวตามไป']],
    [/ขาย|ซื้อ|ร้าน|ราคา|เหรียญ/i, ['ขายเท่าไหร่?', 'มีวัสดุอะไรบ้าง', 'เดี๋ยวแวะไปดูร้านนะ', 'ร้านข้างกองไฟของถูกนะ']],
    [/ขอบคุณ|ขอบใจ|thx|thank|ty\b/i, ['ยินดีจ้า~', 'ด้วยความยินดี ^^', 'ไม่เป็นไรเลย']],
    [/555|ฮ่า|haha|lol/i, ['555+', 'ฮ่าๆๆ', '55555']],
    [/บอส|เห็ด/i, ['ราชาเห็ดอยู่ป่าเห็ดทางเหนือ', 'บอสเห็ดตีแรงนะ ระวัง', 'เคยได้มงกุฎไหม?']],
  ];
  const ANY = ['จริงเหรอ', 'สู้ๆ นะ!', 'อืมมม', 'เห็นด้วย!', 'ว่าไงนะ?', 'ok จ้า', 'แมพนี้มอนเยอะดี'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function botsHear(text) {
    const B = NC.Bots && NC.Bots.list, p = game.player;
    if (!B || !B.length || game.time < replyAt || Math.random() > 0.6) return;
    const near = B.filter((a) => a.dead <= 0 && a.leaving === undefined && Math.hypot(a.x - p.x, a.y - p.y) < 1200);
    if (!near.length) return;
    const rule = REPLY.find(([re]) => re.test(text));
    replyAt = game.time + 6;
    pending.push({ a: pick(near), text: pick(rule ? rule[1] : ANY), at: game.time + NC.rand(1.2, 3) });
  }
  function botsTalk() {
    if (isOnline()) return;
    const B = NC.Bots && NC.Bots.list;
    for (let i = pending.length - 1; i >= 0; i--)
      if (game.time >= pending[i].at) { const q = pending.splice(i, 1)[0]; if (q.a && q.a.dead <= 0) { q.a.say = q.text; q.a.sayT = 3.8; } }
    if (!B) return;
    for (const a of B) { // a new line: its timer jumps back up
      if (a.say && a.sayT > (a.chatT === undefined ? 0 : a.chatT) + 0.5) add({ ch: 'm', from: a.name, text: a.say, bot: true });
      a.chatT = a.sayT;
    }
  }

  // ---------------- bubbles over the head (mine, other players'; the adventurers draw their own) ----------------
  const FONT = "500 23px 'Mitr', 'Leelawadee UI', sans-serif";
  function wrap(ctx, text) { // Thai has no spaces between words: break where the line gets too wide
    const res = [];
    let cur = '';
    for (const c of text) {
      if (ctx.measureText(cur + c).width > 250 && cur) { const sp = cur.lastIndexOf(' '); if (sp > 4) { res.push(cur.slice(0, sp)); cur = cur.slice(sp + 1); } else { res.push(cur); cur = ''; } }
      cur += c;
    }
    if (cur) res.push(cur);
    return res.slice(0, 4);
  }
  function bubble(ctx, who, b) {
    ctx.save();
    ctx.font = FONT;
    if (!b.lines) b.lines = wrap(ctx, b.text);
    const lh = 30, w = Math.max(...b.lines.map((l) => ctx.measureText(l).width)) + 30, h = b.lines.length * lh + 16;
    const a = b.t < 0.15 ? b.t / 0.15 : b.t > BUBBLE_S - 0.5 ? (BUBBLE_S - b.t) / 0.5 : 1;
    // (the tip just over the head and a hat: the hero is ~130 tall; it was 250 / 205, a hand above the head — the user,
    // 2026-10-18: "ช่องแชทบนหัวมันสูงไป")
    // (over a stall's sign: its rope's top, js/vend.js signTop; the bubble sat behind the board, 2026-10-20 Discord #135)
    const head = who.y - (who.sit || who.st ? 130 : 175), foot = who.signTop ? Math.min(head, who.signTop - 22) : head - (who.signH || 0);
    const x = who.x - w / 2, y = foot - h;
    ctx.globalAlpha = NC.clamp(a, 0, 1);
    ctx.beginPath(); NC.rrect(ctx, x, y, w, h, 16);
    ctx.moveTo(who.x - 12, y + h); ctx.lineTo(who.x, y + h + 16); ctx.lineTo(who.x + 12, y + h);
    ctx.lineWidth = 6; ctx.strokeStyle = NC.OUTLINE; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = '#fffaf0'; ctx.fill();
    ctx.fillStyle = '#2a2435'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (b.items && b.items.length && NC.ChatLink) NC.ChatLink.bubbleLines(ctx, b, who.x, y + 8, lh); // (linked names in colour: js/chatlink.js)
    else b.lines.forEach((l, i) => ctx.fillText(l, who.x, y + 8 + lh * (i + 0.5)));
    ctx.restore();
  }
  function tickBubbles(dt) {
    if (meBubble && (meBubble.t += dt) > BUBBLE_S) meBubble = null;
    const remotes = isOnline() ? NC.Online.remotes : net?.remotes;
    if (remotes) for (const r of remotes.values()) if (r.bubble && (r.bubble.t += dt) > BUBBLE_S) r.bubble = null;
  }
  function drawBubbles(ctx) {
    const remotes = isOnline() ? NC.Online.remotes : net?.remotes;
    if (remotes) for (const r of remotes.values()) if (r.bubble && r.pose && (isOnline() || r.map === game.mapId)) bubble(ctx, r, r.bubble);
    if (meBubble && game.player) bubble(ctx, { x: game.player.x, y: game.player.y, sit: game.player.sit, signH: game.player.signH, signTop: game.player.signTop }, meBubble);
  }

  // ---------------- the window ----------------
  function build() {
    win = document.createElement('div');
    win.className = 'chatwin'; win.id = 'chatwin';
    win.innerHTML = '<div class="cw-tabs" role="tablist" aria-label="ช่องข้อความ">' + TABS.map(([t, n]) => `<button type="button" role="tab" aria-controls="cw-list" data-tab="${t}">${n}<b></b></button>`).join('') +
      '<button type="button" class="cw-size" id="cw-size" title="ขนาดหน้าต่างแชท" aria-label="ขนาดหน้าต่างแชท"></button></div>' +
      '<div class="cw-history" id="cw-history" hidden><button type="button" id="cw-older">โหลดข้อความเก่า</button><span id="cw-history-status" role="status" aria-live="polite"></span><button type="button" id="cw-latest" hidden>ดูข้อความล่าสุด</button></div>' +
      '<div class="cw-list" id="cw-list" role="log" aria-label="ข้อความ" aria-live="polite"></div>' +
      '<form class="cw-in" id="cw-form"><button type="button" class="cw-chip" id="cw-chip" title="เปลี่ยนช่อง (Tab)"></button>' +
      '<input id="cw-text" maxlength="200" autocomplete="off" aria-label="แชท" placeholder="กด Enter เพื่อพิมพ์ · /help ดูคำสั่ง"></form>';
    $('hud').appendChild(win);
    list = $('cw-list'); input = $('cw-text'); chip = $('cw-chip');
    try { const s = localStorage.getItem(SIZE_KEY); if (SIZES.includes(s)) size = s; } catch (e) { /* storage blocked */ }
    win.classList.add('size-' + size);
    win.querySelector('.cw-tabs').addEventListener('keydown', e => {
      const current = e.target.closest('[data-tab]');
      if (!current || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation();
      const buttons = [...win.querySelectorAll('[data-tab]')], index = buttons.indexOf(current);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      setTab(buttons[next].dataset.tab); buttons[next].focus();
    });
    win.addEventListener('click', (e) => {
      // a mouse click leaves no focus on the window's buttons (Discord #124, 2026-10-20: "set to large, it shrinks back by
      // itself": the size button kept the focus after its click, and the Enter pressed to chat clicked it again, large ->
      // small -> the default; the Enter to chat did nothing either while a button had it). The keyboard keeps its focus.
      const btn = e.target.closest('button');
      if (btn && e.detail > 0) btn.blur();
      if (e.target.id === 'cw-older') { void loadOlderOnline(); return; }
      if (e.target.id === 'cw-latest') { void syncOnline(); return; }
      const t = e.target.closest('[data-tab]');
      if (t) { setTab(t.dataset.tab); return; }
      const nm = e.target.closest('.nm');
      if (nm) { wTo = { name: nm.dataset.name, peer: nm.dataset.peer || null }; channel = 'w'; renderChip(); input.focus(); return; }
      if (e.target.id === 'cw-size') {
        win.classList.remove('size-' + size);
        size = SIZES[(SIZES.indexOf(size) + 1) % SIZES.length];
        win.classList.add('size-' + size);
        try { localStorage.setItem(SIZE_KEY, size); } catch (err) { /* storage blocked */ }
        list.scrollTop = list.scrollHeight;
        return;
      }
      if (e.target === chip) { cycle(); input.focus(); }
    });
    $('cw-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = input.value;
      input.value = ''; histAt = -1;
      if (v.trim()) { const sent = await submit(v); if (sent === false && !input.value) input.value = v; }
      else input.blur();
    });
    input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // the game's keys stay quiet while typing
      if (e.key === 'Escape') { input.value = ''; input.blur(); }
      else if (e.key === 'Tab') { e.preventDefault(); cycle(); }
      else if (e.key === 'ArrowUp' && history.length) { e.preventDefault(); histAt = Math.min(history.length - 1, histAt + 1); input.value = history[histAt]; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); histAt = Math.max(-1, histAt - 1); input.value = histAt < 0 ? '' : history[histAt]; }
    });
    input.addEventListener('keyup', (e) => e.stopPropagation());
    input.addEventListener('focus', () => win.classList.add('typing'));
    input.addEventListener('blur', () => win.classList.remove('typing'));
    // Enter anywhere in the game starts typing
    addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.repeat || !game || document.activeElement === input) return;
      const t = document.activeElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON')) return;
      if (document.querySelector('.panel:not([hidden])')) return; // a window is open
      e.preventDefault();
      input.focus();
    });
    renderTabs(); renderChip(); renderLines(); renderHistoryControls();
  }
  function cycle() {
    const order = ['a', 'm', 'p', 'g', 'w'];
    do channel = order[(order.indexOf(channel) + 1) % order.length];
    while ((channel === 'p' || channel === 'g') && !groupOf(channel));
    if (channel === 'w' && !wTo && !lastFrom) channel = 'a';
    if (channel === 'w' && !wTo) wTo = lastFrom;
    renderChip();
  }

  // ---------------- hooks ----------------
  const baseLog = NC.HUD.log.bind(NC.HUD);
  NC.HUD.log = function (text, kind) { baseLog(text, kind); add({ ch: 'sys', text: String(text), kind: kind || 'sys' }); };
  const P = NC.Party;
  if (P) {
    const baseUpdate = P.update, baseTags = P.drawTags;
    P.update = function (g, dt) { baseUpdate.call(P, g, dt); tickBubbles(dt); botsTalk(); };
    P.drawTags = function (ctx, g) { baseTags.call(P, ctx, g); if (!bubblesLast) drawBubbles(ctx); };
  }
  // the bubbles over everything over the heads: the files loaded after this one (stall signs, guild tags) wrap drawTags
  // later and drew over them (Discord #135); once every file is in, the bubbles go on the outermost wrapper
  let bubblesLast = false;
  function bubblesOnTop() {
    if (bubblesLast || !P) return;
    bubblesLast = true;
    const outer = P.drawTags;
    P.drawTags = function (ctx, g) { outer.call(P, ctx, g); drawBubbles(ctx); };
  }
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (g) {
    game = g;
    build();
    baseInit(g);
    bubblesOnTop();
    if (!lines.some((m) => m.ch === 'notice' && m.help)) add({ ch: 'notice', kind: 'job', help: true, text: 'กด Enter เพื่อแชท · /help ดูคำสั่ง · คลิกชื่อเพื่อกระซิบ' });
  };
})();
