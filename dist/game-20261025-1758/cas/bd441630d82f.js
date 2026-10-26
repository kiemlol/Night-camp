/* online/social.js — the party and the guild online (?online), kept by the Go server (backend party.go, social.go):
   - PARTY: NC.PartyNet (js/partynet.js) answers from self.party ({ id, leader, loot, members [{ id, name, job, lv, hp,
     maxHp, mapId, dead, online }], requests (leader only) }); its actions (invite, request, answer, leave, kick, lead, setRule) are the action
     {action:'party', kind, targetId, loot}; an invite arrives as the event 'partyInvite' (30 s), shown in partynet's own
     bar look (.pn-ask). The list under the hero frame is js/partylist.js, which reads these answers (PN.people of
     js/partywin.js: the server's members, HP, map, fallen) — partynet's loot hand-over stays idle (the server shares
     the EXP and the drops by the leader's rule).
   - GUILD: js/guild.js reads its documents from online/store.js (made from self.social); its window's buttons are
     caught here before guild.js runs them and sent as {action:'guild', kind, ...} (found, invite, accept, decline,
     coffer 10,000 / 100,000, pay, give, boss, leave, kick, promote, leader, notice).
   Load after online/world.js. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld;
  if (!O || !O.enabled || !W) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (id) => document.getElementById(id);
  const log = (t, k) => NC.HUD && NC.HUD.log(t, k || 'item');

  // ================= the party =================
  const PN = NC.PartyNet;
  let party = null, invite = null, invited = new Map(); // invited: peer -> until
  const requested = new Map(), pending = new Map(), answeredRequests = new Set();
  const me = () => W.me;
  // The server creates a real one-person party when its leader first invites
  // someone. It must remain visible/leaveable after a declined or expired invite.
  const inParty = () => !!(party && party.id && Array.isArray(party.members) && party.members.some((m) => m.id === me()));
  const ids = () => (party ? party.members.map((m) => m.id) : []);
  const memberOf = (id) => (party ? party.members.find((m) => m.id === id) : null);
  const nameOf = (id) => (id === me() ? (W.game && W.game.player.name) || 'คุณ' : (memberOf(id) || {}).name || ((NC.Net && NC.Net.remotes.get(id)) || {}).name || 'ผู้เล่น');
  const changed = () => { if (PN) for (const f of PN.listeners || []) { try { f(); } catch (e) { /* a window closed */ } } };
  const send = (o, tracking) => {
    const action = Object.assign({ action: 'party' }, o);
    if (tracking) pending.set(action, tracking);
    W.send(action);
    return action;
  };
  const ACTION_TH = { full: 'ปาร์ตี้เต็ม', own: 'ต้องออกจากปาร์ตี้เดิมก่อน', lead: 'หัวตี้เท่านั้นที่ชวนได้', dup: 'ส่งคำชวนหรือคำขอแล้ว รอคำตอบ', off: 'คนนี้ไม่ได้ออนไลน์แล้ว' };
  // partynet's presence hook consumes pt. Keep the server's stable party ID so
  // clicking a different member cannot send the same request again.
  if (W.presenceHooks) W.presenceHooks.push((pl, pr) => {
    const pt = pl.party;
    pr.pt = pt && (pt.id || pt.leader) && pt.size > 0 ? [pt.id || pt.leader, pt.size] : null;
  });
  function actionFor(r) {
    const state = (kind, label, code = 'ok', disabled = code !== 'ok', tip = '') => ({ kind, label, code, disabled, tip });
    if (!W.ready || !r || !r.peer) return state('invite', 'ชวนเข้าปาร์ตี้', 'off');
    if (inParty() && ids().includes(r.peer)) return state('invite', 'อยู่ปาร์ตี้เดียวกัน', 'dup');
    if (r.pt && r.pt[0] && r.pt[1] > 0) {
      if (r.pt[1] >= (PN.MAX || 4)) return state('request', 'ปาร์ตี้เต็ม', 'full');
      if (inParty()) return state('request', 'ขอเข้าร่วมปาร์ตี้', 'own', false, ACTION_TH.own);
      if ([...requested.values()].some((until) => until > Date.now())) return state('request', 'รอหัวหน้าตอบ…', 'dup');
      return state('request', 'ขอเข้าร่วมปาร์ตี้');
    }
    if (inParty() && party.members.length >= (PN.MAX || 4)) return state('invite', 'ปาร์ตี้เต็ม', 'full');
    if (inParty() && party.leader !== me()) return state('invite', 'ชวนเข้าปาร์ตี้', 'lead', true, ACTION_TH.lead);
    if ((invited.get(r.peer) || 0) > Date.now()) return state('invite', 'ชวนแล้ว รอเขาตอบ…', 'dup');
    return state('invite', 'ชวนเข้าปาร์ตี้');
  }
  const PARTY_TH = {
    'already in a party': 'อยู่ในปาร์ตี้อื่นแล้ว', 'only the party leader can invite': 'หัวตี้เท่านั้นที่ชวนได้', 'party is full': 'ปาร์ตี้เต็มแล้ว',
    'that hero is not on this map': 'ผู้เล่นนั้นไม่ได้อยู่ในแมพนี้', 'no invitation': 'คำชวนหมดเวลาแล้ว', 'that party is gone': 'ปาร์ตี้นั้นไม่มีแล้ว',
    'cannot invite yourself': 'ชวนตัวเองไม่ได้',
    'no party request': 'คำขอเข้าร่วมหมดเวลาแล้ว',
    'party request expired': 'คำขอเข้าร่วมหมดเวลาแล้ว',
    'only the party leader can answer requests': 'เฉพาะหัวหน้าปาร์ตี้ที่ตอบรับคำขอได้',
    'that hero is not in a party': 'ผู้เล่นนี้ไม่ได้อยู่ในปาร์ตี้แล้ว',
    'that party has changed': 'ปาร์ตี้เปลี่ยนไปแล้ว กรุณาส่งคำขอใหม่',
    'leave your current party first': ACTION_TH.own,
    'a party request is already pending': 'มีคำขอเข้าร่วมอยู่แล้ว รอหัวหน้าตอบก่อน',
    'cannot request your own party': 'อยู่ปาร์ตี้เดียวกันแล้ว',
    'that hero is no longer online': 'ผู้เล่นนี้ออฟไลน์แล้ว',
  };
  if (PN) {
    Object.assign(PN, {
      pid: () => (inParty() ? party.id : null),
      roster: () => (inParty() ? { pid: party.id, ver: 1, lead: party.leader, mem: ids(), loot: party.loot || 'f', exp: 'e' } : null),
      members: () => (inParty() ? ids() : []),
      // Presence is server-wide; Net.remotes contains only heroes rendered in our room.
      member: (id) => (inParty() ? memberOf(id) : null),
      others: () => (inParty() ? ids().filter((p) => p !== me()) : []),
      isLeader: () => inParty() && party.leader === me(),
      onMap: () => { const g = W.game; return (inParty() ? ids().filter((p) => p !== me()) : []).map((p) => NC.Net && NC.Net.remotes.get(p)).filter((r) => r && g && r.map === g.mapId); },
      me, inParty, incoming: () => invite, invited: (peer) => (invited.get(peer) || 0) > Date.now(), nameOf,
      actionFor, actionError: (code) => ACTION_TH[code] || 'ทำรายการปาร์ตี้ไม่ได้',
      // where a member is (the server's list: its map, HP and fall; the place only on my map), for js/autosupport.js
      where: (id) => {
        const m = memberOf(id), r = NC.Net && NC.Net.remotes.get(id), g = W.game, here = !!(m && r && g && m.mapId === g.mapId);
        return m ? { name: m.name, job: m.job, lv: m.lv, map: m.mapId, x: here ? r.x : null, y: here ? r.y : null, hp: m.maxHp ? m.hp / m.maxHp : 1, dead: !!m.dead } : null;
      },
      invite(peer) {
        if (!W.ready || !peer) return 'off';
        const r = NC.Net && NC.Net.remotes.get(peer), action = actionFor(r);
        if (action.code !== 'ok') return action.code;
        if (action.kind === 'request') return PN.request(peer);
        invited.set(peer, Date.now() + 30000);
        send({ kind: 'invite', targetId: peer }, { kind: 'invite', key: peer });
        log(`ชวน ${nameOf(peer)} เข้าปาร์ตี้แล้ว รอตอบ…`);
        changed();
        return 'ok';
      },
      request(peer) {
        const r = NC.Net && NC.Net.remotes.get(peer), action = actionFor(r);
        if (action.code !== 'ok') return action.code;
        if (action.kind !== 'request') return 'off';
        requested.set(r.pt[0], Date.now() + 30000);
        send({ kind: 'request', targetId: peer, partyId: r.pt[0] }, { kind: 'request', key: r.pt[0] });
        log('ส่งคำขอเข้าร่วมไปยังหัวหน้าปาร์ตี้แล้ว รอตอบ…');
        changed();
        return 'ok';
      },
      answer(ok) {
        if (!invite || !W.ready) return;
        if (invite.kind === 'request') {
          const v = invite;
          if (!requestRows().some((r) => r.requestId === v.requestId) || party.id !== v.pid) { invite = null; syncRequestAsk(); return; }
          answeredRequests.add(v.requestId);
          send({ kind: ok ? 'approve' : 'reject', targetId: v.from, partyId: v.pid, id: v.requestId }, { kind: 'answer', key: v.requestId });
          invite = null; hideAsk(); syncRequestAsk(); changed();
          return;
        }
        if (ok && inParty()) { if (W.game && W.game.toast) W.game.toast(ACTION_TH.own); return; }
        send({ kind: ok ? 'accept' : 'decline' });
        log(ok ? `ตอบรับคำชวนของ ${invite.name} แล้ว…` : `ไม่รับคำชวนของ ${invite.name}`, ok ? 'item' : 'sys');
        invite = null; hideAsk(); changed();
      },
      leave() { if (W.ready && inParty()) { send({ kind: 'leave' }); log('กำลังออกจากปาร์ตี้…', 'sys'); } },
      kick(peer) { if (PN.isLeader() && peer !== me()) { send({ kind: 'kick', targetId: peer }); log(`ให้ ${nameOf(peer)} ออกจากปาร์ตี้`, 'sys'); } },
      lead(peer) { if (PN.isLeader() && peer !== me()) send({ kind: 'lead', targetId: peer }); },
      setRule(loot) { if (PN.isLeader() && PN.LOOT && PN.LOOT[loot]) send({ kind: 'rules', loot }); },
    });
  }
  // the invite bar (partynet's look)
  let ask = null, askT = null;
  // Requests use server Unix time; a PC clock set ahead must not hide them.
  const requestNow = () => W.snap && Number.isFinite(W.snap.serverTime) && Number.isFinite(O.lastSnapAt) && O.lastSnapAt > 0
    ? W.snap.serverTime + Math.max(0, Date.now() - O.lastSnapAt) : Date.now();
  const requestRows = () => inParty() && party.leader === me() ? (party.requests || []).filter((r) => r.until * 1000 > requestNow()) : [];
  function syncRequestAsk() {
    const rows = requestRows();
    if (invite && invite.kind === 'request' && (!party || party.id !== invite.pid || !rows.some((r) => r.requestId === invite.requestId))) { invite = null; hideAsk(); }
    if (invite) return;
    const r = rows.find((r) => !answeredRequests.has(r.requestId));
    if (!r) return;
    invite = { kind: 'request', from: r.id, name: r.name || 'ผู้เล่น', pid: party.id, requestId: r.requestId, until: r.until * 1000 };
    log(`${invite.name} ขอเข้าร่วมปาร์ตี้`, 'level');
    showAsk();
  }
  function showAsk() {
    if (!ask) {
      ask = document.createElement('div');
      ask.className = 'pn-ask'; ask.hidden = true;
      ask.innerHTML = '<div class="pn-ask-t"></div><div class="pn-ask-b"><button class="kw-btn blue" data-olpn="yes">เข้าร่วม</button>' +
        '<button class="kw-btn grey" data-olpn="no">ไม่เข้า</button></div><div class="pn-ask-bar"><i></i></div>';
      ask.addEventListener('click', (e) => { const b = e.target.closest('[data-olpn]'); if (b && PN) PN.answer(b.dataset.olpn === 'yes'); });
      ($('hud') || document.body).appendChild(ask);
    }
    if (!invite) return;
    const request = invite.kind === 'request';
    ask.querySelector('.pn-ask-t').innerHTML = `<b>${esc(invite.name)}</b> ${request ? 'ขอเข้าร่วมปาร์ตี้' : 'ชวนคุณเข้าปาร์ตี้'}`;
    ask.querySelector('[data-olpn="yes"]').textContent = request ? 'รับเข้าปาร์ตี้' : 'เข้าร่วม';
    ask.querySelector('[data-olpn="no"]').textContent = request ? 'ปฏิเสธ' : 'ไม่เข้า';
    ask.hidden = false;
    clearInterval(askT);
    askT = setInterval(() => {
      const left = invite ? invite.until - (invite.kind === 'request' ? requestNow() : Date.now()) : 0;
      const bar = ask.querySelector('.pn-ask-bar i');
      if (bar) bar.style.width = Math.max(0, (100 * left) / 30000).toFixed(1) + '%';
      if (left <= 0) { invite = null; hideAsk(); syncRequestAsk(); changed(); }
    }, 200);
  }
  function hideAsk() { if (ask) ask.hidden = true; clearInterval(askT); }

  let partyJson = 'null';
  // (Discord #174, 2026-10-21: on a map change or a reconnect the first record came without the party, so the chat said
  // "ไม่ได้อยู่ในปาร์ตี้แล้ว" and a tick later "เข้าปาร์ตี้แล้ว": it read as being kicked. The leaving line waits 2 s,
  // and the same party back within them says nothing)
  let lost = null; // { id, at } of a party gone from the record, not said yet
  const LOST_WAIT = 2000;
  W.selfHooks.push((s) => {
    if (lost && !party && Date.now() - lost.at >= LOST_WAIT) { lost = null; log('ไม่ได้อยู่ในปาร์ตี้แล้ว', 'sys'); } // (still gone: say it now)
    const nowJson = JSON.stringify(s.party || null);
    if (nowJson === partyJson) return; // (the record changes 20 times a second while walking: only a new party matters)
    partyJson = nowJson;
    const was = party;
    party = s.party && s.party.members ? s.party : null;
    if (inParty()) {
      requested.clear();
      if (invite && invite.kind !== 'request') { invite = null; hideAsk(); }
    }
    const currentRequests = new Set((party && party.requests || []).map((r) => r.requestId));
    for (const id of answeredRequests) if (!currentRequests.has(id)) answeredRequests.delete(id);
    if (JSON.stringify(was && was.members.map((m) => m.id)) !== JSON.stringify(party && party.members.map((m) => m.id))) {
      const before = new Set(was ? was.members.map((m) => m.id) : []), now = party ? party.members.map((m) => m.id) : [];
      for (const id of now) if (!before.has(id) && id !== me() && was) log(`${nameOf(id)} เข้าร่วมปาร์ตี้แล้ว`, 'level');
      if (was && !party) lost = { id: was.id, at: Date.now() };
      if (!was && party && party.members.length > 1) {
        const back = lost && lost.id === party.id && Date.now() - lost.at < LOST_WAIT;
        if (lost && !back) log('ไม่ได้อยู่ในปาร์ตี้แล้ว', 'sys'); // (left one, in another: both said)
        lost = null;
        if (!back) log('เข้าปาร์ตี้แล้ว', 'level');
      }
      for (const id of now) invited.delete(id);
    }
    if (party && was && was.loot !== party.loot && PN && PN.LOOT) log(`หัวตี้ตั้งกติกา · ของดรอป: ${PN.LOOT[party.loot]}`, 'sys');
    syncRequestAsk(); changed();
  });

  // ================= events: party invites, answers, refusals =================
  W.eventHooks.push((ev) => {
    if (!ev) return;
    if (ev.type === 'error' || ev.type === 'party') for (const [a, tracking] of pending) {
      const seq = W.commandSeq && W.commandSeq(a);
      if (!seq || seq !== ev.seq) continue;
      pending.delete(a);
      if (ev.type === 'error') {
        if (tracking.kind === 'invite') invited.delete(tracking.key);
        else if (tracking.kind === 'request') requested.delete(tracking.key);
        else if (!['no party request', 'party request expired', 'party is full', 'already in a party', 'that hero is no longer online',
          'that party has changed', 'only the party leader can answer requests'].includes(ev.message)) {
          answeredRequests.delete(tracking.key); syncRequestAsk();
        }
        changed();
      }
    }
    if (ev.type === 'partyInvite') {
      if (inParty()) return;
      invite = { from: ev.fromId, name: ev.fromName || 'ผู้เล่น', pid: ev.partyId, until: Date.now() + (ev.seconds || 30) * 1000 };
      log(`${invite.name} ชวนคุณเข้าปาร์ตี้`, 'level');
      showAsk(); changed();
    } else if (ev.type === 'error' && ev.message) {
      const th = PARTY_TH[ev.message];
      if (th) { log(th, 'warn'); const g = W.game; if (g && g.toast) g.toast(th); }
    } else if (ev.type === 'social' && ev.action === 'guild') {
      const done = { found: 'ตั้งกิลด์แล้ว!', accept: 'เข้ากิลด์แล้ว!', leave: 'ออกจากกิลด์แล้ว', coffer: 'บริจาคเข้าคลังกิลด์แล้ว', pay: 'จ่ายค่ากองไฟสัปดาห์นี้แล้ว',
        give: 'ส่งของเควสกิลด์แล้ว', boss: 'ปลุกบอสกิลด์แล้ว!', notice: 'บันทึกประกาศแล้ว', invite: 'ส่งคำชวนแล้ว' }[ev.kind];
      if (done) log(done, 'level');
    }
  });

  // ================= the guild window's buttons (js/guild.js): server actions =================
  const gsend = (o) => W.send(Object.assign({ action: 'guild' }, o));
  document.addEventListener('click', (e) => {
    if (!W.ready) return;
    const win = e.target && e.target.closest && e.target.closest('#guildwin');
    if (!win) return;
    const b = e.target.closest('[data-g]');
    if (!b || b.disabled) return;
    const a = b.dataset.g, picked = () => { const el = win.querySelector('.gw-mem.sel[data-pick]'); return el ? el.dataset.pick : null; };
    let act = null;
    if (a === 'found') {
      const n = $('gw-name'), name = (n ? n.value : '').trim();
      const col = win.querySelector('.gw-color.on'), gem = win.querySelector('.gw-gem.on');
      if ([...name].length < 2) return; // (guild.js says why)
      act = { kind: 'found', name, color: col ? col.dataset.color : '#ff8a3c', emblem: gem ? Number(gem.dataset.emblem) : 0 };
    } else if (a === 'accept') act = { kind: 'accept' };
    else if (a === 'decline') act = { kind: 'decline' };
    else if (a === 'inv' && b.dataset.u) { act = { kind: 'invite', targetId: b.dataset.u }; b.disabled = true; b.textContent = 'ชวนแล้ว'; }
    else if ((a === 'promote' || a === 'kick' || a === 'lead') && picked()) {
      const u = picked();
      act = a === 'promote' ? { kind: (NC.OnlineStore && NC.OnlineStore.social && NC.OnlineStore.social.guild && (NC.OnlineStore.social.guild.officers || []).includes(u)) ? 'demote' : 'promote', targetId: u }
        : { kind: a === 'kick' ? 'kick' : 'leader', targetId: u };
    } else if (a === 'leave' && b.dataset.sure) act = { kind: 'leave' };
    else if (a === 'nsave') { const ta = $('gw-ntext'); act = { kind: 'notice', notice: (ta ? ta.value : '').trim().slice(0, 120) }; }
    else if (a === 'd10' || a === 'd100') act = { kind: 'coffer', count: a === 'd10' ? 10000 : 100000 };
    else if (a === 'pay') act = { kind: 'pay' };
    else if (a === 'give') act = { kind: 'give' };
    else if (a === 'boss') act = { kind: 'boss' };
    if (!act) return; // (tabs, the invite list, the notice editor, chat, leave's first click: guild.js's own)
    gsend(act);
    // (the notice and leaving: guild.js closes its editor / button itself, its own writes go nowhere online;
    // everything else would change coins, materials or members locally: stopped here)
    if (a !== 'nsave' && a !== 'leave') { e.stopPropagation(); e.preventDefault(); }
  }, true);
})();
