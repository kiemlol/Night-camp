/* online/socialnotify.js — guild names, guild invites and friends on the Go server (?online), with js/notify.js's cards
   (the user, 2026-10-19: "ตอนนี้มองไม่เห็นชื่อกิลคนอื่น ... อยากให้ทำระบบชวนกิลแบบคลิกที่ตัวละครได้ เเล้วมีป็อปอัพเเจ้งเตือน"):
     guild tags   every hero in the snapshot carries the server's public `guild` {name, color, emblem, level, fire} (backend
                  social_runtime.go attachGuildTag); it becomes net.js's presence gu [key, name, color, emblem, lv, fireX,
                  fireY], so js/guild.js draws «name» over the head and that guild's fire where the server keeps it.
                  The key is my guild's id for my own guild's members (one fire, not two), else 'g:' + name.
     guild invite the hero menu's ชวนเข้ากิลด์ (NC.Notify.guildInvite, js/notify.js) = {action:'guild', kind:'invite',
                  targetId} (leader / officer, the server answers only refusals); the invited hero's self.social.invite
                  (2 min) is a card: เข้าร่วมกิลด์ = {kind:'accept'}, ไม่เข้า = {kind:'decline'}.
     friends      NC.Social (js/social.js) answers from self.social: friends (mutual) / requests (to me) / sent (mine);
                  เพิ่มเพื่อน = {action:'friend', kind:'add' | 'accept', targetId}, ลบ = {kind:'remove'}; a request to me is a
                  card (รับเป็นเพื่อน / ไม่รับ / × later). The server's notices and refusals come back as small cards.
     joined       a new member in my guild, a request I sent accepted: small cards.
   Load after online/social.js and js/notify.js. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld, N = NC.Notify;
  if (!O || !O.enabled || !W || !N) return;
  const esc = N.esc;
  const social = () => (W.snap && W.snap.self && W.snap.self.social) || null;
  const rem = (id) => (NC.Net && NC.Net.remotes ? NC.Net.remotes.get(id) : null);
  const remByName = (name) => (NC.Net && NC.Net.remotes ? [...NC.Net.remotes.values()].find((r) => r.name === name) : null);
  // server Unix seconds -> this PC's clock (a PC set ahead or behind must not drop a fresh invite)
  const serverNow = () => (W.snap && Number.isFinite(W.snap.serverTime) && Number.isFinite(O.lastSnapAt) && O.lastSnapAt > 0
    ? W.snap.serverTime + Math.max(0, Date.now() - O.lastSnapAt) : Date.now());
  const localOf = (unixS) => unixS * 1000 - serverNow() + Date.now();

  // ---------------- what I sent: a refusal comes back as a card ----------------
  const pending = new Map(); // action -> { until, fail() }
  function send(a, fail) {
    pending.set(a, { until: Date.now() + 8000, fail });
    W.send(a);
    return a;
  }
  W.eventHooks.push((ev) => {
    if (!ev) return;
    for (const [a, p] of pending) {
      if (p.until < Date.now()) { pending.delete(a); continue; }
      const seq = W.commandSeq && W.commandSeq(a);
      if (!seq || seq !== ev.seq) continue;
      pending.delete(a);
      if (ev.type === 'error') { if (p.fail) p.fail(); if (ev.message) N.info(esc(ev.message), 'info'); }
    }
    if (ev.type === 'social' && ev.action === 'friend' && ev.notice) N.info(esc(ev.notice), 'friend');
    if (ev.type === 'social' && ev.action === 'guild' && ev.kind === 'accept') { // (the guild's name: the next snapshot's self.social)
      setTimeout(() => { const s = social(), g = s && s.guild; N.info(g ? `เข้าร่วมกิลด์ <b>«${esc(g.name)}»</b> แล้ว!` : 'เข้าร่วมกิลด์แล้ว!', 'guild'); }, 700);
    }
  });

  // ---------------- the heroes' guild tags ----------------
  W.presenceHooks.push((pl, pr) => {
    const g = pl.guild;
    if (!g || !g.name) { pr.gu = null; return; }
    const s = social(), mine = s && s.guild, f = g.fire || {};
    pr.gu = [mine && mine.id && mine.name === g.name ? mine.id : 'g:' + g.name, g.name, g.color, g.emblem | 0, Math.max(1, g.level | 0),
      Number.isFinite(f.x) ? f.x : null, Number.isFinite(f.y) ? f.y : null];
  });

  // ---------------- guild invites ----------------
  const invited = new Map(); // peer -> until
  N.guildInvite = {
    state(r) {
      const s = social(), g = s && s.guild;
      if (!g || !r) return null; // (no guild: no line)
      const L = 'ชวนเข้ากิลด์';
      if (r.gu) return r.gu[0] === g.id ? { label: 'อยู่กิลด์เดียวกัน', off: true } : { label: `อยู่กิลด์ «${r.gu[1]}» แล้ว`, off: true };
      if ((s.roster || []).some((m) => m.id === r.peer)) return { label: 'อยู่กิลด์เดียวกัน', off: true };
      if (s.myRole !== 'leader' && s.myRole !== 'officer') return { label: L, off: true, tip: 'หัวหน้าหรือรองหัวหน้ากิลด์เท่านั้นที่ชวนได้' };
      if (s.capacity && (s.roster || []).length >= s.capacity) return { label: 'กิลด์เต็มแล้ว', off: true };
      if ((invited.get(r.peer) || 0) > Date.now()) return { label: 'ชวนแล้ว รอเขาตอบ…', off: true };
      return { label: L };
    },
    send(r) {
      const st = this.state(r);
      if (!st || st.off) return st ? st.tip || st.label : 'ยังไม่มีกิลด์';
      invited.set(r.peer, Date.now() + 120000);
      send({ action: 'guild', kind: 'invite', targetId: r.peer }, () => invited.delete(r.peer));
      N.info(`ส่งคำชวนเข้ากิลด์ให้ <b>${esc(r.name)}</b> แล้ว รอเขากดเข้าร่วม…`, 'guild');
      return 'ok';
    },
    sig: (r) => JSON.stringify([N.guildInvite.state(r)]),
  };
  N.source(() => {
    const s = social(), v = s && s.invite;
    if (!v || !v.guild || s.guild) return [];
    const r = rem(v.from);
    return [{
      key: 'ogi:' + v.guild + ':' + v.from + ':' + (v.until || 0), kind: 'guild', title: 'คำชวนเข้ากิลด์', icon: { gem: v.emblem, color: v.color },
      text: `<b>${esc(v.fromName || (r && r.name) || 'ผู้เล่น')}</b> ชวนคุณเข้ากิลด์ <b class="ncn-g" style="color:${esc(v.color || '#7d5fd8')}">«${esc(v.name)}»</b>` +
        '<small>กดเข้าร่วมได้เลย · ผู้ชวนต้องออนไลน์อยู่</small>',
      until: v.until ? localOf(v.until) : 0, total: 120000, yes: 'เข้าร่วมกิลด์', no: 'ไม่เข้า',
      onYes: () => send({ action: 'guild', kind: 'accept' }), onNo: () => send({ action: 'guild', kind: 'decline' }),
    }];
  });
  // a new member in my guild (the roster grows): a small card for everyone in it
  let roster = null;
  W.selfHooks.push((s) => {
    const soc = s && s.social;
    if (!soc) return;
    const g = soc.guild, ids = g ? (soc.roster || []).map((m) => m.id) : null;
    if (roster && ids && roster.gid === g.id) for (const m of soc.roster || []) if (!roster.ids.has(m.id) && m.id !== W.me) N.info(`<b>${esc(m.name)}</b> เข้าร่วมกิลด์แล้ว`, 'guild');
    roster = ids ? { gid: g.id, ids: new Set(ids) } : null;
  });

  // a party made or grown (online/social.js keeps the party; its chat lines stay): small cards
  let partyIds = null, partyGone = null, partyId = null; // (the party missing from one record: a map change, Discord #174)
  W.selfHooks.push((s) => {
    const pt = s && s.party, ids = pt && pt.members ? pt.members.map((m) => m.id) : [];
    if (!ids.length && partyIds && partyIds.length) { partyGone = { ids: partyIds, id: partyId, at: Date.now() }; partyIds = ids; return; }
    if (partyGone && ids.length) { if (Date.now() - partyGone.at < 2000 && partyGone.id === (pt && pt.id)) partyIds = partyGone.ids; partyGone = null; } // (the same party back at once: no "joined" card)
    partyId = pt && pt.id;
    if (partyIds && ids.join() !== partyIds.join()) {
      const before = new Set(partyIds);
      if (!partyIds.length && ids.length > 1) { const lead = pt.members.find((m) => m.id === pt.leader); N.info(lead && lead.id !== W.me ? `เข้าปาร์ตี้ของ <b>${esc(lead.name)}</b> แล้ว` : 'ตั้งปาร์ตี้แล้ว', 'party'); }
      else if (partyIds.length) for (const m of pt ? pt.members : []) if (!before.has(m.id) && m.id !== W.me) N.info(`<b>${esc(m.name)}</b> เข้าร่วมปาร์ตี้แล้ว`, 'party');
    }
    partyIds = ids;
  });

  // ---------------- friends ----------------
  const F = NC.Social;
  const lists = () => { const s = social() || {}; return { fr: s.friends || [], rq: s.requests || [], sn: s.sent || [] }; };
  function stateOf(r) {
    if (!r) return '';
    const { fr, rq, sn } = lists(), is = (p) => p && (p.id === r.peer || (!p.id && p.name === r.name));
    return fr.some(is) ? 'mutual' : sn.some(is) ? 'sent' : rq.some(is) ? 'received' : '';
  }
  function idOf(name) {
    const { fr, rq, sn } = lists(), r = remByName(name);
    if (r) return r.peer;
    const p = [...fr, ...rq, ...sn].find((x) => x.name === name);
    return p ? p.id : null;
  }
  function addFriend(name) {
    const id = idOf(name), r = rem(id) || { peer: id, name };
    if (!id) { N.info('ส่งคำขอได้เมื่ออีกฝ่ายออนไลน์', 'info'); return; }
    const st = stateOf(r);
    if (st === 'mutual' || st === 'sent') return;
    send({ action: 'friend', kind: st === 'received' ? 'accept' : 'add', targetId: id });
  }
  function removeFriend(name) {
    const p = lists().fr.find((x) => x.name === name);
    if (p) send({ action: 'friend', kind: 'remove', targetId: p.id });
  }
  if (F) {
    F.addFriend = addFriend;
    F.stateOf = stateOf;
    F.online = true;
  }
  let sentIds = null;
  W.selfHooks.push((s) => {
    const soc = s && s.social;
    if (!soc || !F) return;
    const names = (soc.friends || []).map((p) => p.name).filter(Boolean);
    if (JSON.stringify(names) !== JSON.stringify(F.state.friends)) F.state.friends = names; // (the journal's friends page, the hero menu)
    const fr = new Set((soc.friends || []).map((p) => p.id));
    if (sentIds) for (const [id, name] of sentIds) if (fr.has(id)) N.info(`<b>${esc(name)}</b> รับเป็นเพื่อนแล้ว`, 'friend');
    sentIds = new Map((soc.sent || []).map((p) => [p.id, p.name]));
  });
  // the journal's friends page (social.js / p3_jsocial.js / p3_frienddetail.js buttons): to the server, not the local list
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('[data-add],[data-unf]');
    if (!b || b.disabled || !W.ready || !NC.Hub || NC.Hub.page !== 'friends' || !b.closest('#hb-page')) return;
    e.stopPropagation(); e.preventDefault();
    if (b.dataset.add) addFriend(b.dataset.add); else removeFriend(b.dataset.unf);
    setTimeout(() => NC.Hub.refresh && NC.Hub.refresh(), 0);
  }, true);
  // a request to me: a card (× = later: it stays in the server's list)
  N.source(() => lists().rq.filter((p) => p && p.id).map((p) => {
    const r = rem(p.id);
    return {
      key: 'ofr:' + p.id, kind: 'friend', title: 'คำขอเป็นเพื่อน', icon: r && r.equip ? { equip: r.equip } : null, later: true,
      text: `<b>${esc(p.name || 'ผู้เล่น')}</b> ขอเป็นเพื่อนกับคุณ` + (p.lv ? `<small>Lv ${p.lv | 0} · ${esc(((NC.JOBS || {})[p.job] || {}).name || '')}</small>` : ''),
      yes: 'รับเป็นเพื่อน', no: 'ไม่รับ',
      onYes: () => send({ action: 'friend', kind: 'accept', targetId: p.id }), onNo: () => send({ action: 'friend', kind: 'decline', targetId: p.id }),
    };
  }));
})();
