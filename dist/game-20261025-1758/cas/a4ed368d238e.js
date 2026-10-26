/* notify.js — one place for the questions other players send (the user, 2026-10-19: "ทำระบบ ชวนกิลแบบคลิกที่ตัวละครได้
   เเล้วมีป็อปอัพเเจ้งเตือน ให้กดเข้าร่วมเลย รวมทั้งระบบอื่นๆที่ต้องใช้การแจ้งเตือน"): a card drops in at the top of the screen
   with who asks, what, and the answer buttons; a bar shows the time left. Cards stack (2 shown, the one running out
   first on top, "+N" for the rest).
     NC.Notify.source(fn)       fn() → the asks pending NOW: [{ key, kind, title, text (html), icon, until, total, yes, no,
                                later, onYes, onNo }]; asked every 200 ms, a card goes when its source stops listing it.
                                kind: guild · party · request · duel · friend (the colour); icon: a url, { gem, color } (a
                                guild emblem on its colour) or { equip } (the hero's face); until / total in ms (no until:
                                no bar); later: a × that hides the card until the ask changes.
     NC.Notify.info(text, kind) a card without buttons, gone after 4 s (an answer: "X เข้าร่วมกิลด์แล้ว").
   The sources here: party invites and join requests (NC.PartyNet.incoming / answer: partynet.js offline,
   online/social.js online), duel and arena challenges (NC.PvP.incoming / answer), and offline guild invites
   (NC.Guild.invite / accept). Online, js/online/socialnotify.js adds the server's guild invites and friend requests.
   The old question bars (.pn-ask of partynet.js, online/social.js, pvp.js) still run their clocks but are hidden.
   css/notify.css. Tests: NC.Notify.list(), NC.Notify.info('ทดสอบ'). */
(function () {
  'use strict';
  const NC = window.NC;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const online = () => !!(NC.Online && NC.Online.enabled);
  const SHOW = 2, DONE_MS = 4000, INFO_MS = 4000; // (2 questions at a time keep the hero in view; the rest wait under "+N")
  const sources = [], cards = new Map(); // key -> { el, ask, t0, info }
  const done = new Map(), later = new Map(); // key -> until (answered here: not shown again while the source catches up) / key -> sig
  let box = null, more = null;

  // ---------------- the cards ----------------
  function build() {
    box = document.createElement('div');
    box.id = 'ncnote';
    more = document.createElement('div');
    more.className = 'ncn-more'; more.hidden = true;
    box.appendChild(more);
    document.body.appendChild(box); // (over the windows too: css/notify.css)
    box.addEventListener('mousedown', (e) => e.stopPropagation());
    box.addEventListener('click', onClick);
    document.body.classList.add('ncn-on'); // (css/notify.css hides the old .pn-ask bars)
  }
  const faceCv = (eq) => {
    const cv = document.createElement('canvas');
    if (!eq || !NC.headSpot || !NC.drawAvatar) return null;
    const S = 96;
    cv.width = S; cv.height = S;
    try { const hs = NC.headSpot(eq), k = (S * 0.78) / hs.w; NC.drawAvatar(cv.getContext('2d'), eq, S / 2 - hs.x * k, S * 0.6 - hs.y * k, k, 1, { noWeapon: true, t: 0.3 }); } catch (e) { return null; }
    return cv;
  };
  const ICON = { guild: 'assets/kui/ic_gshield.png', party: 'assets/ic_party.png', request: 'assets/ic_party.png', duel: 'assets/ic_sword.png', friend: 'assets/bible/ic_friends.png', info: 'assets/bible/ic_feather.png' };
  function badge(el, a) {
    const b = el.querySelector('.ncn-badge');
    b.innerHTML = '';
    const ic = a.icon;
    if (ic && ic.equip) { const cv = faceCv(ic.equip); if (cv) { b.classList.add('face'); b.appendChild(cv); return; } }
    if (ic && ic.gem != null) {
      b.classList.add('gem'); b.style.background = ic.color || '#9b7bea';
      b.innerHTML = `<img src="assets/kui/gem_${Math.max(0, Math.min(11, ic.gem | 0))}.png" alt="">`;
      return;
    }
    b.innerHTML = `<img src="${esc(typeof ic === 'string' ? ic : ICON[a.kind] || ICON.info)}" alt="">`;
  }
  function make(a, info) {
    const el = document.createElement('div');
    el.className = `ncn-card k-${a.kind || 'info'}${info ? ' info' : ''}`;
    el.dataset.key = a.key;
    el.innerHTML = '<span class="ncn-badge"></span><div class="ncn-body"><div class="ncn-kick"></div><div class="ncn-t"></div>' +
      (info ? '' : '<div class="ncn-b"><button class="kw-btn blue" data-nn="yes"></button><button class="kw-btn grey" data-nn="no"></button></div>') + '</div>' +
      (a.later ? '<button class="ncn-x" data-nn="later" title="ไว้ทีหลัง">×</button>' : '') +
      '<div class="ncn-bar"><i></i></div>';
    badge(el, a);
    box.insertBefore(el, more.nextSibling); // (the newest on top, under the "+N" line)
    return el;
  }
  function fill(c) {
    const a = c.ask, el = c.el;
    el.querySelector('.ncn-kick').textContent = a.title || '';
    const t = el.querySelector('.ncn-t');
    if (t.innerHTML !== a.text) t.innerHTML = a.text || '';
    const y = el.querySelector('[data-nn="yes"]'), n = el.querySelector('[data-nn="no"]');
    if (y) { y.textContent = a.yes || 'ตกลง'; y.disabled = !!a.busy; }
    if (n) { n.textContent = a.no || 'ไม่'; n.hidden = a.no === false; n.disabled = !!a.busy; }
    const bar = el.querySelector('.ncn-bar'), i = bar.querySelector('i');
    if (c.info) { bar.hidden = false; i.style.width = Math.max(0, 100 - (100 * (Date.now() - c.t0)) / INFO_MS).toFixed(1) + '%'; return; }
    if (!a.until) { bar.hidden = true; return; }
    const total = Math.max(1000, Math.min(600000, a.total || a.until - c.t0)), left = Math.max(0, Math.min(total, a.until - Date.now()));
    bar.hidden = false; i.style.width = ((100 * left) / total).toFixed(1) + '%';
  }
  function drop(key) {
    const c = cards.get(key);
    if (!c) return;
    cards.delete(key);
    c.el.classList.add('out');
    setTimeout(() => c.el.remove(), 180);
  }
  function onClick(e) {
    const b = e.target.closest('[data-nn]'), el = e.target.closest('.ncn-card');
    if (!b || !el || b.disabled) return;
    const c = cards.get(el.dataset.key);
    if (!c) return;
    const a = c.ask, what = b.dataset.nn;
    if (what === 'later') { later.set(a.key, sigOf(a)); drop(a.key); if (a.onLater) run(a.onLater); return; }
    done.set(a.key, Date.now() + DONE_MS);
    drop(a.key);
    run(what === 'yes' ? a.onYes : a.onNo);
  }
  const run = (f) => { if (f) { try { f(); } catch (err) { console.warn('notify: answer', err); } } };
  const sigOf = (a) => a.key + '|' + (a.text || '');

  // ---------------- a soft two-note chime (NC.SFX's volume; ?sfx=0 quiet) ----------------
  let ac = null, lastChime = 0;
  function chime() {
    const vol = NC.SFX && NC.SFX.vol ? NC.SFX.vol() : 0.5;
    if (!vol || document.hidden || Date.now() - lastChime < 600) return;
    lastChime = Date.now();
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') return; // (no click or key yet on this page)
      const t = ac.currentTime;
      for (const [f, d] of [[880, 0], [1318.5, 0.11]]) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.16 * vol, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.42);
        o.connect(g); g.connect(ac.destination); o.start(t + d); o.stop(t + d + 0.45);
      }
    } catch (e) { ac = null; }
  }
  addEventListener('pointerdown', () => { if (ac && ac.state === 'suspended') ac.resume(); }, true);

  // ---------------- every 200 ms: what is pending ----------------
  function tick() {
    if (!NC.game || !NC.game.player) return;
    if (!box) build();
    const away = online() && !(NC.OnlineWorld && NC.OnlineWorld.ready); // (the character select, a reconnect: not in the world)
    if (box.hidden !== away) box.hidden = away;
    if (away) return;
    const now = Date.now(), seen = new Set();
    for (const [k, t] of done) if (t < now) done.delete(k);
    let fresh = false;
    for (const src of sources) {
      let list;
      try { list = src() || []; } catch (e) { console.warn('notify: source', e); continue; }
      for (const a of list) {
        if (!a || !a.key || done.has(a.key)) continue;
        if (later.has(a.key)) { if (later.get(a.key) === sigOf(a)) { seen.add(a.key); continue; } later.delete(a.key); }
        seen.add(a.key);
        let c = cards.get(a.key);
        if (!c) { c = { ask: a, t0: now, el: make(a), info: false }; cards.set(a.key, c); fresh = true; }
        c.ask = a;
        fill(c);
      }
    }
    for (const [k, c] of cards) {
      if (c.info) { if (now - c.t0 > INFO_MS) drop(k); else fill(c); continue; }
      if (!seen.has(k)) drop(k);
    }
    for (const k of later.keys()) if (!seen.has(k)) later.delete(k);
    // the most urgent SHOW cards (the one whose time runs out first; then the ones without a clock, the oldest first;
    // the answers' small cards on top), the rest wait under "+N"
    const rank = (c) => (c.info ? -1e15 + c.t0 : c.ask.until ? c.ask.until : 1e15 + c.t0);
    const live = [...cards.values()].filter((c) => !c.el.classList.contains('out')).sort((x, y) => rank(x) - rank(y));
    live.forEach((c, i) => { if (c.el.style.order !== String(i)) c.el.style.order = String(i); });
    let q = 0, n = 0; // (the small answer cards: 2 at most, never counted against the questions)
    for (const c of live) c.el.hidden = c.info ? ++n > 2 : ++q > SHOW;
    more.hidden = q <= SHOW;
    if (!more.hidden) more.textContent = `+${q - SHOW} การแจ้งเตือน`;
    if (fresh) chime();
  }
  setInterval(tick, 200);

  // ---------------- the sources every game has ----------------
  const who = (id) => (id && NC.Net && NC.Net.remotes ? NC.Net.remotes.get(id) : null);
  const jobOf = (r) => (r ? `<small>Lv ${r.lv | 0} · ${esc(((NC.JOBS || {})[r.job] || {}).name || '')}</small>` : '');
  // party: an invite to me, or (I lead) someone asking to join
  sources.push(() => {
    const PN = NC.PartyNet, v = PN && PN.incoming && PN.incoming();
    if (!v || !PN.answer) return [];
    const req = v.kind === 'request', r = who(v.from);
    return [{
      key: req ? 'pq:' + v.requestId : 'pi:' + (v.pid || '') + ':' + v.from + ':' + (v.n || ''), kind: req ? 'request' : 'party',
      title: req ? 'คำขอเข้าร่วมปาร์ตี้' : 'คำชวนเข้าปาร์ตี้', icon: r && r.equip ? { equip: r.equip } : null,
      text: `<b>${esc(v.name || 'ผู้เล่น')}</b> ${req ? 'ขอเข้าร่วมปาร์ตี้ของคุณ' : 'ชวนคุณเข้าปาร์ตี้'}${jobOf(r)}`,
      until: v.until, total: 30000, yes: req ? 'รับเข้าปาร์ตี้' : 'เข้าร่วม', no: req ? 'ปฏิเสธ' : 'ไม่เข้า',
      onYes: () => PN.answer(true), onNo: () => PN.answer(false),
    }];
  });
  // a duel or an arena match
  sources.push(() => {
    const PV = NC.PvP, v = PV && PV.incoming && PV.incoming();
    if (!v || !PV.answer) return [];
    const r = who(v.from);
    return [{
      key: 'pv:' + (v.sid || v.n + ':' + v.from), kind: 'duel', title: v.arena ? 'คำท้าประลองบนเวที' : 'คำท้าดวล', icon: r && r.equip ? { equip: r.equip } : null,
      text: `<b>${esc(v.name || 'ผู้เล่น')}</b> ${v.arena ? 'ท้าประลองบนเวที (ชนะ 2 ใน 3 ยก)' : 'ท้าดวลกับคุณ'}<small>ตายไม่เสียอะไร เลือดกลับเท่าเดิมเมื่อจบ</small>`,
      until: v.until, total: 15000, yes: 'รับคำท้า', no: 'ไม่รับ',
      onYes: () => PV.answer(true), onNo: () => PV.answer(false),
    }];
  });
  // offline: a guild invite on NC.Store (online's come from the server: online/socialnotify.js)
  sources.push(() => {
    const GD = NC.Guild, v = !online() && GD && GD.invite && GD.invite();
    if (!v || !v.gid || GD.gid()) return [];
    return [{
      key: 'gi:' + v.gid + ':' + (v.t || 0), kind: 'guild', title: 'คำชวนเข้ากิลด์', icon: { gem: v.emblem, color: v.color }, later: true,
      text: `<b>${esc(v.fromName || 'ผู้เล่น')}</b> ชวนคุณเข้ากิลด์ <b class="ncn-g" style="color:${esc(v.color)}">«${esc(v.name)}»</b>`,
      yes: 'เข้าร่วมกิลด์', no: false, onYes: () => GD.accept(),
    }];
  });

  // ---------------- the hero menu's ชวนเข้ากิลด์ (js/playermenu.js mid line) ----------------
  // state(r) → null (no line: I have no guild) | { label, off, tip }; send(r) → 'ok' | why not. Offline: NC.Guild on
  // NC.Store (guild.js sendInvite); online/socialnotify.js puts the server's in its place.
  const guildInvite = {
    state(r) {
      const GD = NC.Guild, gid = GD && GD.gid && GD.gid();
      if (!gid || !r) return null;
      const rank = GD.rankOf ? GD.rankOf(GD.uid()) : '';
      if (r.gu) return r.gu[0] === gid ? { label: 'อยู่กิลด์เดียวกัน', off: true } : { label: `อยู่กิลด์ «${r.gu[1]}» แล้ว`, off: true };
      if (rank !== 'leader' && rank !== 'officer') return { label: 'ชวนเข้ากิลด์', off: true, tip: 'หัวหน้าหรือรองหัวหน้ากิลด์เท่านั้นที่ชวนได้' };
      if (!r.ud) return { label: 'ชวนเข้ากิลด์', off: true, tip: 'ชวนได้เมื่อเล่นออนไลน์' };
      return { label: 'ชวนเข้ากิลด์' };
    },
    send(r) {
      const st = guildInvite.state(r);
      if (!st || st.off) return st ? st.tip || st.label : 'ยังไม่มีกิลด์';
      Promise.resolve(NC.Guild.sendInvite(r)).then((res) => {
        if (res === 'ok') NC.Notify.info(`ส่งคำชวนเข้ากิลด์ให้ <b>${esc(r.name)}</b> แล้ว`, 'guild');
        else NC.Notify.info(res === 'full' ? 'กิลด์เต็มแล้ว' : 'ชวนคนนี้ไม่ได้', 'info');
      });
      return 'ok';
    },
  };
  if (NC.PlayerMenu) {
    const PM = NC.PlayerMenu;
    PM.mid = PM.mid || []; PM.acts = PM.acts || {}; PM.sigs = PM.sigs || [];
    const gi = () => NC.Notify.guildInvite;
    PM.mid.push((r, row) => { const st = gi().state(r); return st ? row('ginv', ICON.guild, esc(st.label), st.off, st.tip) : ''; });
    PM.sigs.push((r) => JSON.stringify(gi().state(r)));
    PM.acts.ginv = (r, g) => { const res = gi().send(r); if (res !== 'ok' && g && g.toast) g.toast(res); };
  }

  NC.Notify = {
    guildInvite,
    source: (fn) => { sources.push(fn); },
    info(text, kind) {
      if (!box) { if (!NC.game) return; build(); }
      const key = 'info:' + Date.now() + ':' + Math.random().toString(36).slice(2, 6);
      const a = { key, kind: kind || 'info', text: text };
      const c = { ask: a, t0: Date.now(), el: make(a, true), info: true };
      cards.set(key, c); fill(c);
    },
    list: () => [...cards.values()].map((c) => ({ key: c.ask.key, kind: c.ask.kind, title: c.ask.title || '', text: c.el.querySelector('.ncn-t').textContent, shown: !c.el.hidden })),
    answer(key, yes) { const el = box && box.querySelector(`.ncn-card[data-key="${CSS.escape(key)}"] [data-nn="${yes ? 'yes' : 'no'}"]`); if (el) el.click(); return !!el; },
    esc,
  };
})();
