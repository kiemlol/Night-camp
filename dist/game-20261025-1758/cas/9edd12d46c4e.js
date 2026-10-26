/* Unity's HudCheckin / GameHud.CheckinPopup / GameHud.JournalCheckin, adapted to the web journal.
   The server owns Bangkok days, account-wide progress, both reward tables and every grant. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld, H = NC.Hub;
  if (!O || !O.enabled || !W || !H) return;
  const esc = H.esc, game = () => NC.game, num = n => Number(n || 0).toLocaleString('en-US');
  let status = null, loading = false, claiming = false, error = '', notice = '', tab = 'month', selected = null;
  let account = '', version = 0, lastRead = -Infinity, skew = 0, clearSince = 0, seenDay = '', popup = null, pausedBefore = false, focusBefore = null;
  const now = () => Date.now() + skew;
  const room = () => { const s = W.snap && W.snap.self; return !!(s && (s.pvp || s.trial)); };
  const supported = () => !O.serverStatus || O.serverStatus.checkin !== false;
  const count = t => Array.isArray(t && t.claimed) ? t.claimed.length : Number(t && t.claimed) || 0;
  const size = t => (t && t.rewards || []).length;
  const canClaim = () => !!(status && status.today && status.today.available);
  const key = () => `${O.origin || ''}:${O.userId || (O.session && O.session.userId) || W.me || ''}`;
  const seenKey = () => 'nightcamp.checkin.popup:' + account;
  const lines = (t, slot) => (t && (t.rewards || []).find(r => r.slot === slot) || {}).lines || [];
  const slot = t => Number(t && t.slot) || 0;
  const text = l => l.text || (l.kind === 'title' ? 'ฉายา ' + (l.name || l.id) : `${l.name || l.id || l.kind} ×${num(l.n)}`);
  function icon(l) {
    const names = { coins: 'ic_coin', gems: 'ic_moongem', tokens: 'ic_seasontoken', red: 'ic_potion', blue: 'ic_sppotion',
      feather: 'ic_feather', title: 'ic_crown', rested: 'camp_fire', gachaTicket: 'ic_gacha' };
    const id = l.kind === 'mat' ? l.id : names[l.kind] || l.id || 'ic_rewards';
    const fallback = { ic_coin: 'assets/shop/ic_coin.png', ic_potion: 'assets/ic_potion.png', ic_sppotion: 'assets/ic_sppotion.png',
      ic_crown: 'assets/kui/ic_crown.png', ic_rewards: 'assets/hud2/ic_rewards.png', camp_fire: 'assets/camp/camp_firebase.png' };
    return (NC.ASSET_MANIFEST[id] || NC.ASSET_MANIFEST['bible_' + id] || {}).src || fallback[id] || H.icon(id);
  }
  const reward = l => `<span class="ck-reward"><img src="${esc(icon(l))}" alt=""><span>${esc(text(l))}</span></span>`;
  function remaining() {
    const seconds = Math.max(0, Math.ceil((((status && status.nextDayAt) || now()) - now()) / 1000));
    return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(Math.floor(seconds) % 60).padStart(2, '0')}`;
  }
  function monthName() {
    const m = status && status.month && status.month.key;
    if (!m || !/^\d{4}-\d{2}$/.test(m)) return '';
    return new Date(m + '-01T12:00:00+07:00').toLocaleDateString('th-TH', { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });
  }
  function primary() {
    const word = claiming ? 'กำลังรับของ…' : loading ? 'กำลังโหลด…' : !W.ready ? 'กำลังเชื่อมต่อ…'
      : room() ? 'ออกจากห้องก่อนแล้วค่อยรับ' : canClaim() ? 'รับของวันนี้' : status && status.today.claimed ? 'วันนี้รับแล้ว ✓' : 'รับครบเดือนนี้แล้ว';
    return `<button class="kw-btn gold ck-claim" data-ck="claim" ${!W.ready || !supported() || !canClaim() || loading || claiming || room() ? 'disabled' : ''}>${word}</button>`;
  }
  function tile(t, day, track) {
    const got = day <= count(t), today = day === slot(t), r = (t.rewards || []).find(r => r.slot === day) || {};
    const last = day === size(t), ls = lines(t, day), face = last ? ls.find(l => l.kind === 'gachaTicket') || ls.find(l => l.kind === 'title') || ls[0] : ls[0];
    const state = got ? 'รับแล้ว' : today ? 'วันนี้' : 'ยังไม่ถึง';
    return `<button class="ck-tile ${got ? 'got' : ''} ${today ? 'today' : ''} ${r.milestone ? 'milestone' : ''} ${last ? 'final' : ''} ${selected === track + ':' + day ? 'selected' : ''}"` +
      ` data-ck="select" data-track="${track}" data-day="${day}" aria-label="วันที่ ${day} · ${state} · ${esc(ls.map(text).join(' · '))}" aria-pressed="${selected === track + ':' + day}">` +
      `<span class="ck-day">วันที่ ${day}${r.milestone ? ' ✦' : ''}</span>${face ? `<img src="${esc(icon(face))}" alt=""><span class="ck-amount">${face.kind === 'title' ? 'ฉายาพิเศษ' : '×' + num(face.n)}</span>` : ''}` +
      `<span class="ck-stamp">${got ? '✓' : today ? 'วันนี้' : ''}</span></button>`;
  }
  function footer() {
    return `<div class="ck-footer"><span>วันใหม่ใน <b class="ck-reset">${remaining()}</b><small>เวลาเซิร์ฟเวอร์ · เที่ยงคืนประเทศไทย</small></span>${primary()}</div>`;
  }
  function rules() {
    return `<ul class="ck-rules"><li>วันละ 1 ครั้งต่อบัญชี · ตัวละครที่กดรับเป็นผู้ได้ของ</li>` +
      `<li>นับวันสะสม ไม่ต้องติดต่อกัน · 7 วันแรกรับได้ครั้งเดียวต่อบัญชี</li>` +
      `<li>ปฏิทิน ${size(status.month)} วันเริ่มใหม่ทุกวันที่ 1 ตามเวลาเซิร์ฟเวอร์</li>` +
      `<li>วันที่ ${esc((status.month.milestones || []).join(' · '))} ได้รางวัลใหญ่ · ฉายาไม่มีค่าพลัง</li>` +
      '<li>เปิดหีบรายสัปดาห์เพื่อรับสิทธิ์เช็คย้อนหลัง สูงสุดเดือนละ 3 ครั้ง</li></ul>';
  }
  function render() {
    if (!supported()) return '<div class="ck-empty">เซิร์ฟเวอร์นี้ยังไม่เปิดเช็คอิน</div>';
    if (!status) return `<div class="ck-empty" role="status">${esc(error || 'กำลังโหลดเช็คอิน…')}<button class="kw-btn blue" data-ck="retry" ${loading ? 'disabled' : ''}>${loading ? 'กำลังโหลด…' : 'ลองใหม่'}</button></div>`;
    const t = tab === 'first7' ? status.first7 : status.month, track = tab === 'first7' ? 'first7' : 'month';
    let body = rules();
    if (tab !== 'rules') {
      const chosen = selected && selected.startsWith(track + ':') ? Number(selected.split(':')[1]) : slot(t) || size(t);
      const cosmetic = status.month.cosmetic || {};
      const tickets = (t.rewards || []).flatMap(r => r.lines || []).filter(l => l.kind === 'gachaTicket').reduce((n, l) => n + l.n, 0);
      body = `<div class="ck-heading"><div><h3>${track === 'first7' ? 'ของขวัญ 7 วันแรก' : monthName()}</h3><p>${track === 'first7' ? 'ครั้งเดียวต่อบัญชี · ขาดวันก็สะสมต่อได้' : 'เช็คอินทุกวัน สะสมของ ' + size(t) + ' วัน'}</p></div><b class="ck-progress">${count(t)} / ${size(t)}</b></div>` +
        (track === 'first7' && tickets ? `<p class="ck-goal">สะสมครบ 7 วัน รับรวม ${num(tickets)} ตั๋วสุ่มแฟชั่น + ฉายา <small>เก็บตั๋วไว้ได้ · ใช้กับตู้แฟชั่น · นับดาวและการันตีตามปกติ</small></p>` : '') +
        `<div class="ck-grid ${track}">${(t.rewards || []).map(r => tile(t, r.slot, track)).join('')}</div>` +
        `<div class="ck-detail" aria-live="polite"><b>วันที่ ${chosen}${chosen <= count(t) ? ' · รับแล้ว ✓' : ''}</b><div>${lines(t, chosen).map(reward).join('')}</div></div>` +
        (track === 'month' && cosmetic.words ? `<p class="ck-goal">✦ ครบ ${size(t)} วัน ได้ฉายา “${esc(cosmetic.words)}” <small>ไม่มีค่าพลัง</small></p>` : '');
    }
    const comeback = status.comeback || {}, catchup = status.catchup || {};
    return `<section class="ck-page"><nav class="ck-tabs" aria-label="รางวัลล็อกอิน">${[['month', size(status.month) + ' วัน'], ['first7', '7 วันแรก'], ['rules', 'กติกา']].map(([id, name]) =>
      `<button data-ck="tab" data-tab="${id}" class="${tab === id ? 'on' : ''}" aria-pressed="${tab === id}">${name}</button>`).join('')}</nav>` +
      (error || notice ? `<p class="ck-message ${error ? 'error' : ''}" role="status">${esc(error || notice)}</p>` : '') + body +
      (comeback.ready ? `<div class="ck-comeback"><b>ยินดีต้อนรับกลับ</b><div>${(comeback.items || []).map(reward).join('')}</div><small>รับพร้อมของวันนี้</small></div>` : '') +
      (catchup.left > 0 ? `<button class="ck-makeup" data-ck="makeup" ${!catchup.ready || !W.ready || room() || loading || claiming ? 'disabled' : ''}>เช็คย้อนหลังได้อีก ${catchup.left} ครั้ง</button>` : '') + footer() + '</section>';
  }
  function preview(t, title) {
    const day = slot(t);
    if (!day || count(t) >= size(t) && day < count(t)) return '';
    return `<article class="ck-preview"><header>${title}<b>วันที่ ${day}</b></header><div>${lines(t, day).map(reward).join('')}</div></article>`;
  }
  function popupBody() {
    const t = status.month, today = slot(t), start = Math.min(Math.max(1, Math.floor((today - 1) / 7) * 7 + 1), Math.max(1, size(t) - 6));
    return `<p class="ck-popup-month">${esc(monthName())} · สะสมต่อได้แม้ไม่ได้มาทุกวัน</p>` +
      `<div class="ck-previews">${preview(status.first7, '7 วันแรก')}${preview(t, size(t) + ' วัน')}</div>` +
      (status.comeback && status.comeback.ready ? `<div class="ck-comeback"><b>ของต้อนรับกลับ</b><div>${status.comeback.items.map(reward).join('')}</div></div>` : '') +
      `<div class="ck-week">${Array.from({ length: Math.min(7, size(t)) }, (_, i) => tile(t, start + i, 'month')).join('')}</div>` +
      (error ? `<p class="ck-message error" role="status">${esc(error)}</p>` : '') + footer() +
      '<div class="ck-popup-links"><button data-ck="calendar">ดูปฏิทินทั้งหมด ›</button><button data-ck="close">ไว้รับทีหลัง</button></div>';
  }
  function paint() {
    H.refresh();
    if (popup && !popup.hidden && status) {
      const focusInside = popup.contains(document.activeElement);
      popup.querySelector('.ck-popup-body').innerHTML = popupBody();
      if (focusInside) popup.querySelector('[role="dialog"]').focus();
    }
  }
  function close() {
    if (!popup || popup.hidden) return;
    popup.hidden = true;
    const g = game(); if (g) g.paused = pausedBefore;
    if (focusBefore && focusBefore.isConnected) focusBefore.focus();
  }
  function show() {
    if (!status || !W.ready || !supported() || room() || !canClaim() || !game() || game().player.dead > 0) return false;
    if (!popup) {
      popup = document.createElement('div'); popup.id = 'checkin-popup'; popup.className = 'kw-panel ck-overlay'; popup.hidden = true;
      popup.innerHTML = '<section class="kw-win ck-popup" role="dialog" aria-modal="true" aria-labelledby="ck-popup-title" tabindex="-1"><header class="kw-title"><span id="ck-popup-title">เช็คอินวันนี้</span><button class="kw-x" data-ck="close" aria-label="ปิด">✕</button></header><div class="ck-popup-body"></div></section>';
      popup.addEventListener('click', e => { if (e.target === popup) close(); else handle(e); });
      popup.addEventListener('keydown', e => {
        e.stopPropagation(); // keyboard activation stays in the dialog; game hotkeys must not fire underneath
        if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
        if (e.key === 'Tab') {
          const buttons = [...popup.querySelectorAll('button:not(:disabled)')], first = buttons[0], last = buttons[buttons.length - 1];
          if (e.shiftKey && (document.activeElement === first || document.activeElement === popup.querySelector('[role="dialog"]'))) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }, true);
      document.body.appendChild(popup);
    }
    if (!popup.hidden) return true;
    focusBefore = document.activeElement; pausedBefore = !!game().paused; game().paused = true;
    popup.querySelector('#ck-popup-title').textContent = status.comeback && status.comeback.ready ? 'ยินดีต้อนรับกลับ' : 'เช็คอินวันนี้';
    popup.querySelector('.ck-popup-body').innerHTML = popupBody(); popup.hidden = false;
    popup.querySelector('[role="dialog"]').focus();
    seenDay = String(status.day);
    try { localStorage.setItem(seenKey(), seenDay); } catch (_) { /* session memory still prevents repeat popups */ }
    return true;
  }
  async function load() {
    if (!W.ready || !supported() || loading || claiming) return;
    const token = version; loading = true; lastRead = performance.now(); error = ''; paint();
    try {
      const r = await O.rpc('nc_checkin_status', {});
      if (token !== version || !W.ready) return;
      if (!r || r.ok === false || !r.today || !r.month || !r.first7) throw new Error(r && r.reason || 'โหลดเช็คอินไม่ได้');
      if (status && String(status.day) !== String(r.day)) notice = '';
      status = r;
    } catch (e) { if (token === version) error = e.message || 'โหลดเช็คอินไม่ได้ ลองใหม่อีกครั้ง'; }
    finally { if (token === version) { loading = false; paint(); } }
  }
  async function claim(makeup = false) {
    if (!W.ready || !supported() || !status || room() || claiming || loading || (makeup ? !status.catchup || !status.catchup.ready : !canClaim())) return;
    const token = version; claiming = true; error = notice = ''; paint();
    try {
      const r = await O.rpc('nc_checkin_claim', makeup ? { makeup: true } : {});
      if (token !== version || !W.ready) return;
      if (!r || !r.ok) throw new Error(r && r.reason || 'รับของเช็คอินไม่สำเร็จ ลองใหม่อีกครั้ง');
      status = r.status || null;
      const got = (r.granted || []).flatMap(g => g.lines || []).map(text).join(' · ');
      notice = got ? 'ได้รับ ' + got : 'เช็คอินแล้ว';
      NC.HUD.log(notice, 'level'); game().toast(notice); close();
    } catch (e) { if (token === version) error = e.message || 'รับของเช็คอินไม่สำเร็จ'; }
    finally { if (token === version) { claiming = false; paint(); if (!status) load(); } }
  }
  function open() { close(); NC.Quests.openCalendar(); if (performance.now() - lastRead > 5000 || !status) load(); }
  function handle(e) {
    const b = e.target.closest('[data-ck]'); if (!b) return false;
    if (b.disabled) return true;
    switch (b.dataset.ck) {
      case 'tab': tab = b.dataset.tab; selected = null; paint(); break;
      case 'select': tab = b.dataset.track; selected = b.dataset.track + ':' + b.dataset.day; if (popup && !popup.hidden) open(); paint(); break;
      case 'claim': claim(); break;
      case 'makeup': claim(true); break;
      case 'retry': load(); break;
      case 'calendar': open(); break;
      case 'close': close(); break;
    }
    return true;
  }
  function clear() {
    close(); version++; status = null; loading = claiming = false; error = notice = ''; lastRead = -Infinity; clearSince = 0; selected = null;
  }
  O.on('snapshot', st => {
    const next = key();
    if (account !== next) {
      clear(); account = next; seenDay = '';
      try { seenDay = localStorage.getItem(seenKey()) || ''; } catch (_) { /* storage blocked */ }
    }
    if (Number.isFinite(st.serverTime)) skew = st.serverTime - Date.now();
  });
  O.on('status', s => { if (s === 'reconnecting' || s === 'error') clear(); });
  function watch() {
    if (!W.ready) return;
    const elapsed = performance.now() - lastRead;
    if ((!status && elapsed > 10000) || (status && (now() >= status.nextDayAt ? elapsed > 5000 : elapsed > 60000))) load();
    for (const el of document.querySelectorAll('.ck-reset')) el.textContent = remaining();
    const g = game(), input = g && g.input || {};
    const busy = (!popup || popup.hidden) && (input.mx || input.my || input.attack || g && g.player && (g.player.atk && g.player.atk.on || g.player.channel || g.player.dash));
    const blocked = !g || !g.player || g.player.dead > 0 || g.player.hp <= 0 || busy || (g.hold && (!popup || popup.hidden)) || room() || H.isOpen() ||
      !!(NC.P3Fallen && NC.P3Fallen.isOpen()) || [...document.querySelectorAll('.kw-panel, .cs-root, #preload, #intro, #prologue')].some(el => el !== popup && !el.hidden && el.getClientRects().length);
    if (blocked) { clearSince = 0; close(); return; }
    if (!clearSince) clearSince = performance.now();
    if (status && canClaim() && (!status.today.claimed || status.comeback && status.comeback.ready) && String(status.day) !== seenDay && performance.now() - clearSince >= 1500) show();
  }
  setInterval(watch, 1000);
  (NC.MENU_SIDE || (NC.MENU_SIDE = [])).push({ id: 'checkin', name: 'เช็คอินรายวัน', icon: 'ic_daily', run: open });
  NC.Checkin = { render, handle, open, show, close, load, claim, get status() { return status; } };
})();
