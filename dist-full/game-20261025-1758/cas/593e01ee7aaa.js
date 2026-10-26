/* playermenu.js — a click on another player's hero opens a small menu by their head (the user, 2026-10-18: "หมายถึงเวลาคลิก
   ตัวเพื่อนอ่ะ มันต้องมีให้เลือกโปรไฟล์ไม่ใช่หรอ"): their face, name, Lv · job, guild, then
     ดูโปรไฟล์       their page in the journal (js/p3_frienddetail.js: the hero, what they wear, guild / party / place, buttons)
     กระซิบ          the chat with "/w name "
     ชวนเข้าปาร์ตี้   NC.PartyNet.invite (its own answers: full, busy, leader only ...)
     ชวนเข้ากิลด์     js/notify.js's line through NC.PlayerMenu.mid (only with a guild; leader / officer; the invited hero gets a card)
     เพิ่มเพื่อน      social.js's list (a friend already: shown, greyed; online the server's request: sent / รับเป็นเพื่อน)
     ท้าดวล          NC.PvP.challenge (same map, near)
   Left click on a hero opens it, except where heroes fight each other (a PvP map, the guild war, the arena, a duel going
   on): there the left click stays an attack. A monster under the mouse wins over a hero behind it. The right click on a
   hero opens it too (it used to send a duel challenge at once: the challenge is now the menu's last line).
   The menu follows the hero; it closes on a click elsewhere, Esc, an action, or when they leave the map / screen.
   Hooks: a capture mousedown on the window (after vend.js and storynpc.js, whose shop signs and NPCs win), NC.Net.onMap.
   css/playermenu.css. Tests: NC.PlayerMenu.open(peer). */
(function () {
  'use strict';
  const NC = window.NC;
  const G = () => NC.game;
  const net = () => NC.Net;
  if (!net()) return;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = (g, t) => { if (g && g.toast) g.toast(t); };
  const jobName = (j) => ((NC.JOBS || {})[j] || {}).name || '';
  const IC = { profile: 'assets/bible/ic_journal.png', whisper: 'assets/bible/ic_feather.png', party: 'assets/ic_party.png',
    friend: 'assets/bible/ic_friends.png', duel: 'assets/ic_sword.png' };

  let box = null, cur = null, raf = 0; // cur: the remote hero the menu is for

  // ---------------- which hero is under the mouse ----------------
  const onMap = () => (net().onMap ? net().onMap() : []).filter((r) => r.named);
  const worldAt = (g, e) => [g.cam.x + (e.clientX * g.dpr) / g.scale, g.cam.y + (e.clientY * g.dpr) / g.scale];
  function heroAt(g, wx, wy) {
    let best = null, bd = 1e9;
    for (const r of onMap()) {
      if (Math.abs(wx - r.x) > 44 || wy < r.y - 140 || wy > r.y + 16) continue; // (the body: ~130 units tall over the feet)
      const d = Math.hypot(wx - r.x, wy - (r.y - 60));
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }
  const monsterAt = (g, wx, wy) => (g.enemies || []).some((m) => m && m.hp > 0 && !m.dead && !m.dummy && Math.hypot(wx - m.x, wy - (m.y - 30)) < (m.r || 24) + 26);
  function fightMap(g) {
    const M = (NC.MAPS || {})[g.mapId] || {};
    return !!(M.pvp || M.gwar || (g.world && g.world.pvpArena) || (NC.PvP && (NC.PvP.duel || NC.PvP.pending)));
  }

  // ---------------- the menu ----------------
  function build() {
    box = document.createElement('div');
    box.id = 'pmenu'; box.hidden = true;
    document.body.appendChild(box);
    box.addEventListener('mousedown', (e) => e.stopPropagation());
    box.addEventListener('click', onClick);
  }
  function face(cv, eq) {
    if (!eq || !NC.headSpot || !NC.drawAvatar) return;
    const b = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, S = Math.max(48, Math.round(Math.max(b.width, b.height) * dpr)) || 96;
    cv.width = S; cv.height = S;
    const c = cv.getContext('2d');
    try { const hs = NC.headSpot(eq), k = (S * 0.78) / hs.w; NC.drawAvatar(c, eq, S / 2 - hs.x * k, S * 0.6 - hs.y * k, k, 1, { noWeapon: true, t: 0.3 }); } catch (e) { console.warn('playermenu: face', e); }
  }
  function render() {
    const r = cur, g = G(), S = NC.Social && NC.Social.state, fr = !!(S && (S.friends || []).includes(r.name));
    const fs = NC.Social && NC.Social.stateOf ? NC.Social.stateOf(r) : ''; // (online: the server's sent / received requests, online/socialnotify.js)
    const PN = NC.PartyNet, R = PN && PN.roster(), mine = R && R.mem.includes(r.peer), partyAction = PN && PN.actionFor && PN.actionFor(r);
    const gu = Array.isArray(r.gu) ? r.gu : null;
    const row = (act, img, label, off, tip) => `<button class="pm-row" data-pm="${act}"${off ? ' disabled' : ''}${tip ? ` title="${esc(tip)}"` : ''}><img src="${img}" alt=""><span>${label}</span></button>`;
    box.innerHTML = '<div class="pm-head"><span class="pm-face"><canvas></canvas></span><div class="pm-who">' +
      `<b>${esc(r.name)}${fr ? ' <i class="pm-fr">เพื่อน</i>' : ''}</b><small>Lv ${r.lv | 0} · ${esc(jobName(r.job))}</small>` +
      (gu ? `<small class="pm-gu">«${esc(gu[1] || '')}»</small>` : '') + '</div></div>' +
      `<button class="kw-btn blue pm-main" data-pm="profile"><img src="${IC.profile}" alt="">ดูโปรไฟล์</button>` +
      '<div class="pm-list">' +
      row('whisper', IC.whisper, 'กระซิบ') +
      (partyAction ? row('party', IC.party, esc(partyAction.label), partyAction.disabled, partyAction.tip)
        : mine ? row('party', IC.party, 'อยู่ปาร์ตี้เดียวกัน', true) : PN && PN.invited(r.peer) ? row('party', IC.party, 'ชวนแล้ว รอเขาตอบ…', true)
        : row('party', IC.party, 'ชวนเข้าปาร์ตี้', !PN, PN ? '' : 'ชวนปาร์ตี้ได้เมื่อเล่นออนไลน์')) +
      ((NC.PlayerMenu && NC.PlayerMenu.mid) || []).map((f) => f(r, row) || '').join('') + // (js/notify.js ชวนเข้ากิลด์)
      (fr ? row('friend', IC.friend, 'เป็นเพื่อนกันแล้ว', true) : fs === 'sent' ? row('friend', IC.friend, 'ขอเป็นเพื่อนแล้ว รอตอบ…', true)
        : row('friend', IC.friend, fs === 'received' ? 'รับเป็นเพื่อน' : 'เพิ่มเพื่อน', !(NC.Social && NC.Social.addFriend))) +
      row('duel', IC.duel, 'ท้าดวล', !(NC.PvP && NC.PvP.challenge) || fightMap(g) && !(g.world && g.world.pvpArena)) +
      ((NC.PlayerMenu && NC.PlayerMenu.more) || []).map((f) => f(r, row) || '').join('') + // (more lines: js/autosupport.js ตามซัพคนนี้)
      '</div>';
    face(box.querySelector('.pm-face canvas'), r.equip);
  }
  function open(r) {
    if (!box) build();
    cur = r;
    render();
    box.hidden = false;
    place();
    if (!raf) raf = requestAnimationFrame(follow);
  }
  function close() {
    cur = null;
    if (box) box.hidden = true;
  }
  // by the hero's head, on the side with room; clamped to the screen
  function place() {
    const g = G(), r = cur;
    if (!g || !r || !box) return false;
    if (r.map !== g.mapId || !r.named || r.gwHide || !net().remotes.has(r.peer)) { close(); return false; }
    const sx = ((r.x - g.cam.x) * g.scale) / g.dpr, sy = ((r.y - 120 - g.cam.y) * g.scale) / g.dpr, hw = (60 * g.scale) / g.dpr;
    if (sx < -40 || sy < -40 || sx > innerWidth + 40 || sy > innerHeight + 40) { close(); return false; }
    const w = box.offsetWidth, h = box.offsetHeight;
    let x = sx + hw, left = false;
    if (x + w > innerWidth - 8) { x = sx - hw - w; left = true; }
    const y = Math.max(8, Math.min(innerHeight - h - 8, sy - 20));
    box.style.left = Math.round(Math.max(8, x)) + 'px'; box.style.top = Math.round(y) + 'px';
    box.classList.toggle('left', left);
    return true;
  }
  function follow() {
    raf = 0;
    if (!cur || !box || box.hidden) return;
    if (place()) raf = requestAnimationFrame(follow);
  }
  // the hero changed (level, clothes, party, friend): draw the menu again
  let lastSig = '';
  setInterval(() => {
    if (!cur || !box || box.hidden) return;
    if (!place()) return;
    const S = NC.Social && NC.Social.state, PN = NC.PartyNet;
    const s = JSON.stringify([cur.lv, cur.job, cur.equip, cur.gu, cur.pt, S && S.friends, PN && PN.roster(), PN && PN.invited(cur.peer), PN && PN.actionFor && PN.actionFor(cur),
      NC.Social && NC.Social.stateOf ? NC.Social.stateOf(cur) : '', ((NC.PlayerMenu && NC.PlayerMenu.sigs) || []).map((f) => f(cur))]);
    if (s !== lastSig) { lastSig = s; render(); }
  }, 500);

  function whisper(g, name) {
    setTimeout(() => {
      const i = $('cw-text');
      if (!i) { toast(g, `พิมพ์ /w ${name} ข้อความ ในแชท`); return; }
      i.value = `/w ${name} `; i.focus();
      try { i.setSelectionRange(i.value.length, i.value.length); } catch (e) { /* (some inputs) */ }
    }, 30);
  }
  function onClick(e) {
    const b = e.target.closest('[data-pm]'), g = G(), r = cur;
    if (!b || b.disabled || !g || !r) return;
    const act = b.dataset.pm;
    close();
    if (act === 'profile') {
      const TF = NC.Hub && NC.Hub.tab && NC.Hub.tab('friends');
      if (TF && TF.fd) TF.fd.open(r.name, r.peer); else toast(g, 'เปิดหน้าโปรไฟล์ไม่ได้');
    } else if (act === 'whisper') whisper(g, r.name);
    else if (act === 'party') {
      const res = NC.PartyNet.invite(r.peer);
      if (res !== 'ok') toast(g, NC.PartyNet.actionError ? NC.PartyNet.actionError(res) : { full: 'ปาร์ตี้เต็มแล้ว', busy: 'คนนี้อยู่ในปาร์ตี้อื่น', lead: 'หัวตี้เท่านั้นที่ชวนได้', dup: 'ชวนไปแล้ว', off: 'คนนี้ไม่ได้ออนไลน์แล้ว' }[res] || 'ชวนไม่ได้');
    } else if (act === 'friend') NC.Social.addFriend(r.name);
    else if (act === 'duel') {
      const res = NC.PvP.challenge(r.peer);
      if (res !== 'ok') toast(g, { busy: 'กำลังดวลอยู่', far: 'อยู่ไกลเกินไป เข้าไปใกล้กันก่อน', dup: 'ท้าไปแล้ว รอคำตอบ', off: 'คนนี้ไม่ได้ออนไลน์แล้ว' }[res] || 'ท้าดวลไม่ได้');
    } else { const run = NC.PlayerMenu && NC.PlayerMenu.acts && NC.PlayerMenu.acts[act]; if (run) run(r, g); } // (the lines added from outside)
  }

  // ---------------- clicks ----------------
  addEventListener('mousedown', (e) => {
    const g = G(), view = $('view');
    if (!g || !g.player || !view) return;
    if (box && !box.hidden && !box.contains(e.target)) close(); // (a click anywhere else closes it; on a hero it opens again below)
    if (e.target !== view || (e.button !== 0 && e.button !== 2) || g.paused) return;
    const [wx, wy] = worldAt(g, e), r = heroAt(g, wx, wy);
    if (!r) return;
    if (e.button === 0 && (fightMap(g) || monsterAt(g, wx, wy))) return; // (where heroes fight, or a monster in front: the swing)
    e.stopImmediatePropagation(); e.preventDefault();
    g.mouse.down = false;
    open(r);
  }, true);
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && box && !box.hidden) { e.stopImmediatePropagation(); e.preventDefault(); close(); } }, true);

  NC.PlayerMenu = { open: (peer) => { const r = net().remotes.get(peer); if (r) open(r); }, close, get cur() { return cur; } }; // (+ more / mid / sigs / acts from outside)
})();
