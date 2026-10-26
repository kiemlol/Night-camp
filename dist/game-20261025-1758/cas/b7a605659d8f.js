/* online/chwin.js — ย้ายแชนแนล: the window for moving between a map's channels in the online game (?online), from the
   user's pick F (assets/gen/nightcamp_chsrv_f_raw.png, 2026-10-18): "CH 3" on a chip under the minimap's zone ribbon
   opens it; two folder tabs:
     แชนแนล  one row per channel: CH n, a load bar coloured by how full, heroes / cap, the round faces of the people the
             hero knows there and one tag (อยู่ที่นี่ · ปาร์ตี้: name · เพื่อน: name · กิลด์: n · เต็ม · คนเยอะ · ว่าง);
     เพื่อน   the party, friends and guild members online, where they are (map + CH) and a jump to their channel.
   The dark card on the right shows the picked channel (or person) and the ย้ายแชนแนล / ยกเลิก buttons. While moving, a
   toast in the middle of the screen. The move itself, the loads and the rules are online/channels.js (NC.OnlineChannels:
   loads, why, to); who is where comes from the server's social view (self.social: friends, online, roster: mapId +
   channelId, backend social_runtime.go) and the party (self.party: mapId only, its channel from the same view).
   Test: ?chwin opens it once the world is in. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online;
  if (!O || !O.enabled) return;
  const C = () => NC.OnlineChannels, W = () => NC.OnlineWorld;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mapName = (id) => ((NC.MAPS || {})[id] && NC.MAPS[id].name) || id || '';
  const jobName = (j) => ((NC.JOBS || {})[j] || {}).name || '';
  const G = () => { const w = W(); return w && w.game; };
  const LEVEL = { full: 'เต็ม', busy: 'คนเยอะ', mid: 'ปานกลาง', quiet: 'คนน้อย', empty: 'ว่าง' };
  const KIND = { party: 'ปาร์ตี้', friend: 'เพื่อน', guild: 'กิลด์' };
  const RANK = { party: 0, friend: 1, guild: 2 };

  let win = null, chip = null, toastEl = null, tab = 'ch', sel = null, selPeer = null, loads = null, loadErr = '', timer = 0, toastT = 0;
  let loadVersion = 0;
  const hasCapacity = (row) => Number.isFinite(row.cap) && row.cap > 0;
  const countLabel = (row) => (row.estimated ? 'อย่างน้อย ' : '') + row.heroes + (hasCapacity(row) ? ' / ' + row.cap : '');

  // ---------------- who the hero knows, and where they are ----------------
  // id -> { id, name, lv, job, kinds: [party|friend|guild], online, mapId, ch, eq }
  function people() {
    const w = W(), snap = w && w.snap, self = (snap && snap.self) || {}, me = w && w.me;
    const s = (NC.OnlineStore && NC.OnlineStore.social) || {};
    const out = new Map(), seen = new Map(); // seen: id -> the server's online record (mapId, channelId, portrait)
    for (const p of s.online || []) if (p && p.id) seen.set(p.id, p);
    for (const p of s.friends || []) if (p && p.id && p.mapId && !seen.has(p.id)) seen.set(p.id, p);
    const add = (id, kind, rec) => {
      if (!id || id === me) return;
      let r = out.get(id);
      if (!r) out.set(id, (r = { id, name: '', lv: 0, job: '', kinds: [], online: false, mapId: '', ch: '', eq: null }));
      if (!r.kinds.includes(kind)) r.kinds.push(kind);
      if (rec) {
        r.name = r.name || rec.name || '';
        r.lv = r.lv || rec.lv | 0;
        r.job = r.job || rec.job || '';
        if (rec.online) r.online = true;
        if (rec.mapId && !r.mapId) r.mapId = rec.mapId;
        if (rec.channelId && !r.ch) r.ch = String(rec.channelId);
      }
    };
    for (const m of (self.party && self.party.members) || []) add(m.id, 'party', m);
    for (const f of s.friends || []) add(f.id, 'friend', f);
    for (const g of s.roster || []) add(g.id, 'guild', g);
    const remotes = (NC.Net && NC.Net.remotes) || new Map();
    for (const r of out.values()) {
      const live = seen.get(r.id), here = remotes.get(r.id);
      if (live) { r.online = true; r.mapId = live.mapId || r.mapId; r.ch = live.channelId ? String(live.channelId) : r.ch; r.name = live.name || r.name; r.lv = live.lv || r.lv; r.job = live.job || r.job; }
      if (here && here.equip) { r.eq = here.equip; r.online = true; if (snap) { r.mapId = snap.mapId; r.ch = String(snap.channelId); } } // (in this very room)
      else if (live && live.portrait && live.portrait.equip && w.equipOf) {
        const P = live.portrait;
        try {
          r.eq = w.equipOf(P.equip, P.appearance ? { hair: 'created' } : null, P.appearance);
          // (a portrait is head and shoulders, backend portraitSlots: no legs, and the rig can't pose without them)
          if (!r.eq.pants) r.eq.pants = 'pants_traveler';
          if (!r.eq.top) r.eq.top = 'top_traveler';
        } catch (e) { r.eq = null; }
      }
      r.kinds.sort((a, b) => RANK[a] - RANK[b]);
    }
    return [...out.values()];
  }
  const sortPeople = (list) => list.sort((a, b) => (b.online - a.online) || (RANK[a.kinds[0]] - RANK[b.kinds[0]]) || a.name.localeCompare(b.name, 'th'));

  // ---------------- the channels: loads from Nakama's match list (channels.js), the social view as a stand-in ----------------
  async function refresh() {
    const c = C(), w = W();
    if (!c || !w || !w.snap || O.status !== 'online') return;
    const version = ++loadVersion, origin = O.origin, mapId = c.mapId();
    const current = () => version === loadVersion && O.origin === origin && c.mapId() === mapId && O.status === 'online';
    try {
      const result = await c.loads(mapId);
      if (!current()) return;
      loads = { ...result, origin }; loadErr = '';
    } catch (e) {
      if (!current()) return;
      loadErr = (e && e.message) || 'อ่านจำนวนคนไม่ได้';
      // (the social view's online heroes: up to 100, so only a hint)
      const s = (NC.OnlineStore && NC.OnlineStore.social) || {}, n = {};
      for (const p of s.online || []) if (p.mapId === mapId && p.channelId) n[p.channelId] = (n[p.channelId] || 0) + 1;
      n[c.current()] = (n[c.current()] || 0) + 1;
      const L = loads && loads.origin === origin && loads.mapId === mapId ? loads : { count: Math.max(1, ...Object.keys(n).map(Number)) };
      const chs = [];
      for (let i = 1; i <= L.count; i++) { const ch = String(i), h = n[ch] || 0; chs.push({ ch, heroes: h, cap: null, full: false, here: ch === c.current(), level: 'quiet', estimated: true }); }
      loads = { origin, mapId, count: L.count, cap: null, capKnown: false, here: c.current(), channels: chs, at: Date.now() };
    }
    if (win && !win.hidden) render();
  }

  // ---------------- faces ----------------
  const face = (key, eq, cls) => (eq
    ? `<span class="chw-face${cls ? ' ' + cls : ''}"><canvas data-face="${esc(key)}"></canvas></span>`
    : `<span class="chw-face q${cls ? ' ' + cls : ''}"><i>?</i></span>`);
  function drawFaces(root, looks) {
    for (const cv of root.querySelectorAll('canvas[data-face]')) {
      let eq = looks[cv.dataset.face];
      if (!eq || !NC.headSpot || !NC.drawAvatar) continue;
      if (!eq.weapon) eq = Object.assign({}, eq, { weapon: 'sword' }); // (the pose needs a weapon; it is not drawn)
      const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, S = Math.max(48, Math.round(Math.max(r.width, r.height) * dpr)) || 96;
      cv.width = S; cv.height = S;
      const c = cv.getContext('2d');
      try {
        // (the small round faces show the head filling the circle, as in the mockup; the card's big one head and shoulders)
        const big = cv.parentElement.classList.contains('big'), hs = NC.headSpot(eq), k = (S * (big ? 0.8 : 1)) / hs.w;
        NC.drawAvatar(c, eq, S / 2 - hs.x * k, S * (big ? 0.58 : 0.54) - hs.y * k, k, 1, { noWeapon: true, t: 0.3 });
      } catch (e) { console.warn('chwin: face', e); }
    }
  }

  // ---------------- the window ----------------
  function build() {
    win = document.createElement('div');
    win.id = 'chwin'; win.className = 'kw-panel'; win.hidden = true;
    win.innerHTML = '<div class="chw-wrap"><section class="kw-win chw-win">' +
      '<header class="kw-title"><span>ย้ายแชนแนล</span><button class="kw-x" id="chw-x" aria-label="ปิด">✕</button></header>' +
      '<nav class="kw-tabs chw-tabs"><button class="kw-tab on" data-chtab="ch">แชนแนล</button><button class="kw-tab" data-chtab="fr">เพื่อน <small id="chw-frn"></small></button></nav>' +
      '<div class="chw-body"><div class="chw-list kw-scroll" id="chw-list"></div><aside class="kw-card chw-card" id="chw-card"></aside></div>' +
      '</section><p class="chw-rule">ย้ายแชนแนล: รอ <b>5 วินาที</b>ต่อครั้ง · ย้ายระหว่าง<b>ต่อสู้</b>ไม่ได้</p></div>';
    document.body.appendChild(win);
    $('chw-x').addEventListener('click', close);
    win.addEventListener('mousedown', (e) => { if (e.target === win) close(); });
    win.addEventListener('click', onClick);
    win.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.chw-row[data-ch]');
      if (row && !e.target.closest('button.kw-btn')) { sel = row.dataset.ch; move(sel); }
    });
    addEventListener('resize', () => { if (win && !win.hidden) fit(); });
  }
  function onClick(e) {
    const b = e.target.closest('[data-chtab], [data-ch], [data-peer], [data-go], [data-cancel]');
    if (!b) return;
    const D = b.dataset;
    if (D.chtab) { tab = D.chtab; render(); return; }
    if (D.cancel) { close(); return; }
    if (D.go) { if (!b.disabled) move(D.go); return; }
    if (D.peer) { selPeer = D.peer; render(); return; }
    if (D.ch) { sel = D.ch; render(); }
  }

  // the tag a channel row wears (the mockup's order: you, the party, a friend, the guild, then how full)
  function rowTag(c, here) {
    if (c.here) return '<span class="chw-tag here">อยู่ที่นี่</span>';
    const by = (k) => here.filter((p) => p.kinds[0] === k);
    for (const k of ['party', 'friend']) {
      const l = by(k);
      if (l.length) return `<span class="chw-tag ${k}">${KIND[k]}${l.length === 1 ? ': ' + esc(l[0].name) : ' ' + l.length + ' คน'}</span>`;
    }
    const g = by('guild');
    if (g.length) return `<span class="chw-tag guild">กิลด์: ${g.length}</span>`;
    if (c.full) return '<span class="chw-tag full">เต็ม</span>';
    if (c.level === 'busy') return '<span class="chw-tag busy">คนเยอะ</span>';
    if (c.level === 'empty') return '<span class="chw-tag empty">ว่าง</span>';
    return '';
  }
  function renderChannels(list, card, all, looks) {
    const c = C(), L = loads, mine = c.current(), mapId = c.mapId();
    if (!L || L.mapId !== mapId) { list.innerHTML = '<div class="chw-wait">กำลังดูว่าแต่ละแชนแนลมีกี่คน…</div>'; card.innerHTML = ''; return; }
    if (!sel || !L.channels.some((x) => x.ch === sel)) sel = (all.find((p) => p.mapId === mapId && p.ch && p.ch !== mine) || {}).ch || mine;
    const p = G() && G().player;
    let h = '';
    for (const x of L.channels) {
      const here = all.filter((q) => q.online && q.mapId === mapId && q.ch === x.ch);
      const known = hasCapacity(x), pct = known ? Math.min(100, (x.heroes / x.cap) * 100) : 0;
      let faces = '';
      if (x.here && p) { looks.me = p.equip; faces += face('me', p.equip); }
      for (const q of here.slice(0, x.here ? 2 : 3)) { looks['p:' + q.id] = q.eq; faces += face('p:' + q.id, q.eq); }
      h += `<div class="chw-row lv-${x.level}${x.here ? ' here' : ''}${x.full ? ' full' : ''}${x.ch === sel ? ' sel' : ''}" data-ch="${esc(x.ch)}">` +
        `<b class="chw-n">CH ${esc(x.ch)}</b><span class="chw-bar"${known ? '' : ' style="visibility:hidden"'}><i style="width:${x.full ? 100 : pct.toFixed(1)}%"></i></span>` +
        `<span class="chw-cnt">${countLabel(x)}</span><span class="chw-faces">${faces}</span>${rowTag(x, here)}</div>`;
    }
    list.innerHTML = h;
    // the card: the picked channel
    const x = L.channels.find((q) => q.ch === sel) || L.channels[0];
    const here = sortPeople(all.filter((q) => q.online && q.mapId === mapId && q.ch === x.ch));
    const kinds = [...new Set(here.map((q) => q.kinds[0]))];
    const label = !here.length ? '' : kinds.length > 1 ? 'คนที่คุณรู้จักที่นี่:' : kinds[0] === 'party' ? 'เพื่อนร่วมปาร์ตี้ที่นี่:' : kinds[0] === 'friend' ? 'เพื่อนที่นี่:' : 'คนในกิลด์ที่นี่:';
    let who = '';
    if (here.length === 1) {
      const q = here[0];
      looks['c:' + q.id] = q.eq;
      who = `<div class="chw-one">${face('c:' + q.id, q.eq, 'big')}<div><b>${esc(q.name)}</b><small>${KIND[q.kinds[0]]}${q.lv ? ' · Lv ' + q.lv : ''}</small></div></div>`;
    } else if (here.length) {
      who = '<div class="chw-few">' + here.slice(0, 3).map((q) => { looks['c:' + q.id] = q.eq; return `<div class="chw-p">${face('c:' + q.id, q.eq)}<b>${esc(q.name)}</b><span class="chw-tag ${q.kinds[0]}">${KIND[q.kinds[0]]}</span></div>`; }).join('') +
        (here.length > 3 ? `<small class="chw-more">และอีก ${here.length - 3} คน</small>` : '') + '</div>';
    } else who = `<p class="chw-none">${x.here ? 'คุณอยู่แชนแนลนี้' : 'ไม่มีเพื่อน ปาร์ตี้ หรือคนในกิลด์ที่แชนแนลนี้'}</p>`;
    const why = x.here ? 'อยู่แชนแนลนี้แล้ว' : x.full ? `CH ${x.ch} เต็มแล้ว` : c.why(x.ch);
    card.innerHTML = `<h2>แชนแนล ${esc(x.ch)}${x.here ? ' <span class="chw-me">ที่คุณอยู่</span>' : ''}</h2>` +
      `<p class="chw-load">${countLabel(x)} คน · <b class="lv-${x.level}">${LEVEL[x.level]}</b></p><hr>` +
      (label ? `<p class="chw-lbl">${label}</p>` : '') + who +
      `<div class="chw-acts">${why ? `<p class="chw-why">${esc(why)}</p>` : ''}` +
      `<button class="kw-btn blue" data-go="${esc(x.ch)}"${why ? ' disabled' : ''}>ย้ายแชนแนล</button>` +
      '<button class="kw-btn grey" data-cancel="1">ยกเลิก</button></div>';
  }
  function renderFriends(list, card, all, looks) {
    const c = C(), mapId = c.mapId(), mine = c.current();
    const on = sortPeople(all.filter((q) => q.online)), off = all.filter((q) => !q.online);
    if (!selPeer || !on.some((q) => q.id === selPeer)) selPeer = (on.find((q) => q.mapId === mapId && q.ch && q.ch !== mine) || on[0] || {}).id || null;
    let h = '';
    for (const q of on) {
      looks['f:' + q.id] = q.eq;
      const same = q.mapId === mapId, where = same ? (q.ch ? `แมพนี้ · CH ${esc(q.ch)}` : 'แมพนี้') : `${esc(mapName(q.mapId))}${q.ch ? ' · CH ' + esc(q.ch) : ''}`;
      const act = !same ? '<span class="chw-tag empty">แมพอื่น</span>' : q.ch === mine ? '<span class="chw-tag here">อยู่ด้วยกัน</span>'
        : q.ch ? `<button class="kw-btn blue chw-go" data-go="${esc(q.ch)}"${c.why(q.ch) ? ' disabled' : ''}>ไป CH ${esc(q.ch)}</button>` : '';
      h += `<div class="chw-row fr${q.id === selPeer ? ' sel' : ''}" data-peer="${esc(q.id)}">${face('f:' + q.id, q.eq)}` +
        `<div class="chw-who"><b>${esc(q.name)}</b><small>${q.lv ? 'Lv ' + q.lv : ''}${jobName(q.job) ? ' · ' + esc(jobName(q.job)) : ''}</small></div>` +
        `<span class="chw-where">${where}</span><span class="chw-tag ${q.kinds[0]}">${q.kinds.map((k) => KIND[k]).join(' · ')}</span>${act}</div>`;
    }
    if (!on.length) h += '<div class="chw-wait">ยังไม่มีเพื่อน ปาร์ตี้ หรือคนในกิลด์ที่ออนไลน์อยู่</div>';
    if (off.length) h += `<div class="chw-off">ออฟไลน์อยู่ ${off.length} คน: ${off.slice(0, 8).map((q) => esc(q.name)).join(' · ')}${off.length > 8 ? ' …' : ''}</div>`;
    list.innerHTML = h;
    const q = on.find((x) => x.id === selPeer);
    if (!q) { card.innerHTML = '<h2>เพื่อน</h2><p class="chw-none">เพื่อนที่ออนไลน์จะขึ้นที่นี่ พร้อมแมพและแชนแนลที่เขาอยู่</p><div class="chw-acts"><button class="kw-btn grey" data-cancel="1">ยกเลิก</button></div>'; return; }
    looks['c:' + q.id] = q.eq;
    const same = q.mapId === mapId;
    const why = !same ? `${q.name} อยู่${mapName(q.mapId) ? 'ที่ ' + mapName(q.mapId) : 'แมพอื่น'} · ย้ายแชนแนลได้ในแมพเดียวกัน` : !q.ch ? 'ไม่รู้ว่าเขาอยู่แชนแนลไหน' : q.ch === mine ? 'อยู่แชนแนลเดียวกับคุณแล้ว' : c.why(q.ch);
    const L = loads && loads.mapId === mapId ? loads.channels.find((x) => x.ch === q.ch) : null;
    card.innerHTML = `<h2>${esc(q.name)}</h2><p class="chw-load">${q.lv ? 'Lv ' + q.lv : ''}${jobName(q.job) ? ' · ' + esc(jobName(q.job)) : ''}</p><hr>` +
      `<div class="chw-one">${face('c:' + q.id, q.eq, 'big')}<div><b>${same && q.ch ? 'CH ' + esc(q.ch) : esc(mapName(q.mapId) || '—')}</b>` +
      `<small>${same ? 'แมพนี้' : 'แมพอื่น'}${L ? ` · ${countLabel(L)} คน` : ''}</small><span class="chw-kinds">${q.kinds.map((k) => `<span class="chw-tag ${k}">${KIND[k]}</span>`).join('')}</span></div></div>` +
      `<div class="chw-acts">${why ? `<p class="chw-why">${esc(why)}</p>` : ''}` +
      `<button class="kw-btn blue" data-go="${esc(q.ch || '')}"${why ? ' disabled' : ''}>ไปแชนแนลของเขา</button>` +
      '<button class="kw-btn grey" data-cancel="1">ยกเลิก</button></div>';
  }
  function render() {
    if (!win || win.hidden || !C()) return;
    const list = $('chw-list'), card = $('chw-card'), keep = list.scrollTop;
    for (const t of win.querySelectorAll('[data-chtab]')) t.classList.toggle('on', t.dataset.chtab === tab);
    const all = people(), looks = {}, on = all.filter((q) => q.online).length;
    $('chw-frn').textContent = on ? String(on) : '';
    list.classList.toggle('frs', tab === 'fr');
    if (tab === 'fr') renderFriends(list, card, all, looks); else renderChannels(list, card, all, looks);
    list.scrollTop = keep;
    drawFaces(win, looks);
  }
  function fit() {
    const wrap = win.querySelector('.chw-wrap');
    if (document.documentElement.classList.contains('mob-port')) { wrap.style.transform = ''; return; } // (css/chwin.css: a full-width sheet)
    wrap.style.transform = 'translate(-50%, -50%)';
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }

  // ---------------- open / close / move ----------------
  function open(t) {
    const g = G();
    if (!win || !g || !g.player || !C() || O.status !== 'online' || !O.snap) return false;
    if (t) tab = t;
    NC.HUD.panel('pause', false); // (closes the other windows)
    win.hidden = false;
    g.paused = true;
    sel = null; selPeer = null;
    if (!loads || loads.origin !== O.origin || loads.mapId !== C().mapId()) loads = null;
    render(); fit();
    refresh();
    clearInterval(timer); timer = setInterval(refresh, 4000);
    return true;
  }
  function close() {
    if (!win || win.hidden) return;
    win.hidden = true;
    loadVersion++;
    clearInterval(timer); timer = 0;
    const g = G();
    if (g) g.paused = false;
  }
  function toast(text, kind, ms) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'chw-toast'; (document.getElementById('hud') || document.body).appendChild(toastEl); }
    toastEl.className = 'chw-toast ' + (kind || '');
    toastEl.innerHTML = `<span class="chw-spin"></span><b>${esc(text)}</b>`;
    toastEl.hidden = false;
    clearTimeout(toastT);
    if (ms) toastT = setTimeout(() => { toastEl.hidden = true; }, ms);
  }
  function move(ch) {
    const c = C();
    if (!c || !ch) return;
    const why = c.why(ch);
    if (why) { toast(why, 'bad', 2200); return; }
    close();
    c.to(ch);
  }
  // channels.js tells how a move went
  O.on('channel', (ev) => {
    if (!ev) return;
    if (ev.state === 'moving') toast(`กำลังย้ายไป CH ${ev.to}…`, 'moving');
    else if (ev.state === 'done') { toast(`มาถึง CH ${ev.now} แล้ว`, 'ok', 1800); if (NC.HUD) NC.HUD.log(`ย้ายมาแชนแนล ${ev.now} แล้ว`, 'level'); }
    else if (ev.state === 'refused') { toast(ev.message || 'ย้ายไม่ได้', 'bad', 2600); if (NC.HUD && ev.from) NC.HUD.log(`${ev.message || 'ย้ายไม่ได้'} · อยู่ CH ${ev.now || ev.from} เหมือนเดิม`, 'sys'); }
    else if (ev.state === 'failed') { toast(ev.message || 'ย้ายแชนแนลไม่สำเร็จ', 'bad', 3000); if (NC.HUD) NC.HUD.log(ev.message || 'ย้ายแชนแนลไม่สำเร็จ', 'sys'); }
    loadVersion++; loads = null; chipText();
  });

  // ---------------- the chip under the minimap ----------------
  function canChannel() {
    const c = C(), id = c ? c.mapId() : '', def = (NC.MAPS || {})[id] || {};
    if (!c || O.status !== 'online' || !O.snap || !/^\d+$/.test(c.current())) return false;
    return !(/^(tower_|root_|pvp_)/.test(id) || def.pvp || def.arena || def.gwar);
  }
  function chipText() {
    if (!chip) return;
    const c = C(), ok = canChannel(), busy = c && c.busy;
    chip.hidden = !ok && !busy;
    chip.innerHTML = busy ? 'CH …' : `CH ${esc(c ? c.current() : '')}<i></i>`;
    chip.classList.toggle('on', !!win && !win.hidden);
  }
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    build();
    const zone = $('zonelbl');
    chip = document.createElement('button');
    chip.className = 'chw-chip'; chip.id = 'chw-chip'; chip.title = 'ย้ายแชนแนล'; chip.hidden = true;
    chip.addEventListener('click', () => { if (win.hidden) open('ch'); else close(); chipText(); });
    if (zone && zone.parentNode) zone.parentNode.insertBefore(chip, zone.nextSibling); else (document.getElementById('hud') || document.body).appendChild(chip);
    setInterval(chipText, 500);
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (win && id === 'chwin') { const on = show === undefined ? win.hidden : show; if (on) open(); else close(); return on; }
    if (win && !win.hidden) close();
    return basePanel(id, show);
  };
  addEventListener('keydown', (e) => {
    if (!win || win.hidden) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.code === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); close(); return; }
    if (tab === 'ch' && loads && (e.code === 'ArrowDown' || e.code === 'ArrowUp')) {
      const L = loads.channels, i = Math.max(0, L.findIndex((x) => x.ch === sel)), j = Math.min(L.length - 1, Math.max(0, i + (e.code === 'ArrowDown' ? 1 : -1)));
      sel = L[j].ch; render();
      const row = win.querySelector('.chw-row.sel');
      if (row) row.scrollIntoView({ block: 'nearest' });
      e.preventDefault(); e.stopImmediatePropagation();
    } else if (e.code === 'Enter' && tab === 'ch' && sel) { e.preventDefault(); e.stopImmediatePropagation(); move(sel); }
  }, true);

  NC.ChannelWin = { open, close, isOpen: () => !!win && !win.hidden, refresh, people, toast };
})();
