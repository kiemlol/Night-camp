/* partynet.js — a party of REAL players (the user, 2026-10-01: "ระบบปาร์ตี้แบบปรับการดรอปไอเทมจากหัวตี้"; a party is real
   players only: party.js's AI friends stay a test tool, ?aiparty). Up to 4 heroes online at the same time (net.js's room).
     หัวตี้ (the leader)  invites, makes another member leader, kicks, and sets the party's rules:
       ของดรอป  ใครเจอคนนั้นได้ (f) · ผลัดกันรับ (t) · สุ่มให้สมาชิก (r) · หัวตี้เก็บ (l)
       EXP      ต่างคนต่างได้ (o) · แบ่งเท่ากัน (e: +20% for each other member, +30% more while a support job —
                priest, bishop, lightkeeper, wisp — keeps helping: js/partysupport.js; split by everyone. Was +10% a member
                before the balance round of 2026-10-04)
     Only members on the same map count, and for EXP only the ones within 20 levels of whoever made the kill.
     Monsters' drops (gear copies, items, materials) are handed over; potions, coins and what is gathered (life skills)
     always stay with whoever found them.
   Each player's monsters and drops are their own, so the finder's game hands things over, through the presence:
     pr  the leader's roster [pid, ver, leaderPeer, [members' peers], loot, exp]: everyone follows the newest
         (a new version counts only from the roster's leader, or from the leader it replaces)
     pt  [pid, n] the party I think I am in (the leader drops a member who stops saying so)
     pi  the leader's invites [[n, toPeer, pid]]          pa  my answer to one [n, leaderPeer, pid, 1 | 0]
     pg  what I hand over: [[seq, toPeer, { m: { matId: n }, g: [[id, rows, ref, sh]], i: [itemId], x: [exp, jobExp] }]],
         kept until that member acks it (pk [[fromPeer, seq]]); after 30 s (or when they are gone) it comes back to me.
   A member gone for 6 s while leading: the next member in the roster leads. A kill's drops are marked by an outer
   NC.damageEnemy (set at HUD.init, so it wraps every other file's); the EXP share scales the kill's orbs (NC.skillKills).
   NC.PartyNet: pid() · roster() · members() · isLeader() · onMap() · invite(peer) · answer(ok) · leave() · kick(peer) ·
   lead(peer) · setRule(loot, exp) · incoming() · invited(peer) · log (the last hand-over lines) · listeners (fn() on a
   change) · LOOT / EXPM (the rules' names). The window is js/partywin.js; the party list under the hero frame is
   js/partylist.js (2026-10-19: one list for this game and ?online's). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, net = NC.Net;
  if (NC.ASSET_MANIFEST_SOCIAL && NC.ASSET_MANIFEST) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_SOCIAL); // (the loot icons, the crown, the guild emblems)
  if (!net) return;
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const MAX = 4, GAP = 20, BONUS = 0.2, INVITE_MS = 30000, HAND_MS = 30000, LEAD_GONE_MS = 6000, OUT_BYTES = 1800;
  const LOOT = { f: 'ใครเจอคนนั้นได้', t: 'ผลัดกันรับ', r: 'สุ่มให้สมาชิก', l: 'หัวตี้เก็บ' };
  const EXPM = { o: 'ต่างคนต่างได้', e: 'แบ่งเท่ากัน' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PN = (NC.PartyNet = { LOOT, EXPM, MAX, GAP, log: [], listeners: [] });

  // ---------------- the state ----------------
  let pid = null; // the party I am in (or joining)
  let roster = null; // { pid, ver, lead, mem: [peers], loot, exp }: the newest one seen (or made)
  let publish = false; // I send `pr` (I lead, or I just handed the lead over and the new leader has not taken it yet)
  let handoff = null; // { R, until }: the roster I left behind (I left while leading): sent a few seconds more
  let joinWait = 0; // (an invite accepted: until then I wait to see myself in the roster)
  let wasIn = false;
  const invites = []; // [n, toPeer, pid, untilMs]
  let inviteN = 0, incoming = null, answer = null;
  const joinedAt = new Map(), seenAt = new Map(), recent = new Map();
  let leadGone = 0, turn = 0;
  let outSeq = 0;
  const out = []; // [seq, toPeer, payload, sentMs, toName]
  const pending = new Map(); // toPeer -> { m, g, i, x, names }
  const applied = new Map(), ackT = new Map();

  const me = () => net.me();
  const rem = (peer) => net.remotes.get(peer);
  const inParty = () => !!(pid && roster && roster.pid === pid && roster.mem.includes(me()));
  const members = () => (inParty() ? roster.mem.slice() : []);
  const others = () => members().filter((p) => p !== me());
  const isLeader = () => inParty() && roster.lead === me();
  const onMap = () => { const g = G(); return others().map(rem).filter((r) => r && r.named && g && r.map === g.mapId); };
  const nameOf = (peer) => (peer === me() ? (G() && G().player.name) || 'คุณ' : (rem(peer) && rem(peer).name) || 'ผู้เล่น');
  const newId = () => 'p' + Math.random().toString(36).slice(2, 9);
  const peerStr = (v) => typeof v === 'string' && v.length > 0 && v.length <= 64;
  let dirty = true;
  const changed = () => { dirty = true; for (const f of PN.listeners) { try { f(); } catch (e) { console.warn('partynet: listener', e); } } };
  function line(text, kind) {
    PN.log.push({ text, t: Date.now() });
    if (PN.log.length > 8) PN.log.shift();
    if (NC.Chat && NC.Chat.add) NC.Chat.add({ ch: 'p', note: true, text }); // (the chat's party tab, and ทั้งหมด)
    else NC.HUD.log(text, kind || 'item');
  }

  Object.assign(PN, {
    pid: () => (inParty() ? pid : null), roster: () => (inParty() ? roster : null), members, others, isLeader, onMap, me,
    inParty, incoming: () => incoming, invited: (peer) => invites.some((v) => v[1] === peer), nameOf,
    // where a member is, on any map (js/autosupport.js follows the one it supports across maps)
    where: (peer) => { const r = rem(peer); return r ? { name: r.name, job: r.job, lv: r.lv, map: r.map, x: r.x, y: r.y, hp: r.hpPct / 100, dead: !!r.dd } : null; },
  });

  // ---------------- what I send ----------------
  const rosterArr = (R) => [R.pid, R.ver, R.lead, R.mem, R.loot, R.exp];
  net.fields.push({ key: 'pr', get: () => (publish && roster && pid ? rosterArr(roster) : handoff && Date.now() < handoff.until ? rosterArr(handoff.R) : null) });
  net.fields.push({ key: 'pt', get: () => (pid ? [pid, inParty() ? roster.mem.length : 0] : null) });
  net.fields.push({ key: 'pi', get: () => (invites.length ? invites.map((v) => [v[0], v[1], v[2]]) : null) });
  net.fields.push({ key: 'pa', get: () => (answer && Date.now() < answer[4] ? answer.slice(0, 4) : null) });
  net.fields.push({ key: 'pg', get: () => (out.length ? out.map((o) => [o[0], o[1], o[2]]) : null) });
  net.fields.push({ key: 'pk', get: () => { const a = []; for (const [p, s] of applied) if (Date.now() - (ackT.get(p) || 0) < 120000) a.push([p, s]); return a.length ? a : null; } });

  // ---------------- what I hear ----------------
  function rosterOf(a) {
    if (!Array.isArray(a) || a.length < 6) return null;
    const [id, ver, lead, mem, loot, exp] = a;
    if (!peerStr(id) || !Number.isFinite(ver) || !peerStr(lead) || !Array.isArray(mem) || !mem.length || mem.length > MAX || !mem.every(peerStr) || !mem.includes(lead)) return null;
    return { pid: id, ver: ver | 0, lead, mem: mem.slice(), loot: LOOT[loot] ? loot : 'f', exp: EXPM[exp] ? exp : 'o' };
  }
  function consider(R, from) {
    if (!roster || roster.pid !== R.pid) { roster = R; changed(); return; }
    if (R.ver < roster.ver) return;
    if (R.ver === roster.ver) {
      // (two leaders made one version: the lower peer's wins, the same on every side)
      if (R.lead !== roster.lead && R.lead < roster.lead && from === R.lead) { roster = R; changed(); }
      return;
    }
    if (from !== R.lead && from !== roster.lead) return; // only a leader changes the party
    roster = R;
    changed();
  }
  const canBeInvited = () => !inParty() || roster.mem.length <= 1;
  net.hooks.push((r, pr) => {
    r.pr = rosterOf(pr.pr);
    r.pt = Array.isArray(pr.pt) && peerStr(pr.pt[0]) ? [pr.pt[0], Math.max(0, Math.min(MAX, pr.pt[1] | 0))] : null;
    seenAt.set(r.peer, Date.now());
    const m = me();
    if (!m) return;
    if (r.pr && pid && r.pr.pid === pid) consider(r.pr, r.peer);
    // an invite for me
    if (Array.isArray(pr.pi)) for (const v of pr.pi) {
      if (!Array.isArray(v) || v[1] !== m || !peerStr(v[2]) || !canBeInvited()) continue;
      if (incoming && incoming.from === r.peer && incoming.n === v[0]) continue;
      if (answer && answer[1] === r.peer && answer[0] === v[0]) continue;
      incoming = { n: v[0], from: r.peer, name: r.name, pid: v[2], until: Date.now() + INVITE_MS };
      NC.HUD.log(`${r.name} ชวนคุณเข้าปาร์ตี้ (Lv ${r.lv} ${(NC.JOBS[r.job] || {}).name || ''})`, 'level');
      showAsk();
      changed();
    }
    // my invitee's answer (I lead)
    if (isLeader() && Array.isArray(pr.pa) && pr.pa[1] === m && pr.pa[2] === pid) {
      const v = invites.find((x) => x[0] === pr.pa[0] && x[1] === r.peer);
      if (v) {
        invites.splice(invites.indexOf(v), 1);
        if (pr.pa[3] && roster.mem.length < MAX && !roster.mem.includes(r.peer)) {
          joinedAt.set(r.peer, Date.now());
          bump({ mem: roster.mem.concat(r.peer) });
          line(`${r.name} เข้าร่วมปาร์ตี้แล้ว`, 'level');
        } else if (!pr.pa[3]) { NC.HUD.log(`${r.name} ไม่รับคำชวนเข้าปาร์ตี้`, 'sys'); changed(); }
      }
    }
    if (Array.isArray(pr.pg)) receive(r, pr.pg);
    if (Array.isArray(pr.pk)) for (const a of pr.pk) if (Array.isArray(a) && a[0] === m) acked(r.peer, a[1]);
  });

  // ---------------- every quarter second: who leads, who is in ----------------
  function bump(patch) {
    roster = Object.assign({}, roster, patch, { ver: roster.ver + 1 });
    roster.mem = roster.mem.slice();
    publish = true;
    changed();
    net.send();
  }
  function outOfParty(text) {
    pid = null; roster = null; publish = false; joinWait = 0; wasIn = false; invites.length = 0; leadGone = 0;
    if (text) line(text, 'sys');
    changed();
  }
  function settle() {
    const m = me(), t = Date.now();
    if (!m) return;
    if (handoff && t > handoff.until) handoff = null;
    if (answer && t > answer[4]) answer = null;
    if (incoming && t > incoming.until) { incoming = null; hideAsk(); changed(); }
    if (!pid) { publish = false; return; }
    if (!roster || roster.pid !== pid) {
      if (joinWait && t > joinWait) outOfParty('เข้าปาร์ตี้ไม่สำเร็จ (หัวตี้ไม่ตอบ)');
      return;
    }
    if (!roster.mem.includes(m)) {
      if (joinWait && t < joinWait) return; // (accepted: the leader adds me soon)
      if (joinWait) return outOfParty('เข้าปาร์ตี้ไม่สำเร็จ (ปาร์ตี้เต็มหรือหัวตี้ยกเลิก)');
      return outOfParty(wasIn ? 'คุณไม่ได้อยู่ในปาร์ตี้แล้ว (หัวตี้ให้ออก)' : '');
    }
    if (joinWait) { joinWait = 0; wasIn = true; line(`เข้าร่วมปาร์ตี้ของ ${nameOf(roster.lead)} แล้ว · ของดรอป: ${LOOT[roster.loot]} · EXP: ${EXPM[roster.exp]}`, 'level'); }
    wasIn = true;
    for (const p of roster.mem) if (p !== m) recent.set(p, t);
    if (roster.lead === m) {
      publish = true;
      let gone = null;
      for (const p of roster.mem) {
        if (p === m) continue;
        const r = rem(p), j = joinedAt.get(p) || 0;
        if (!r ? t - (seenAt.get(p) || j || t) > 20000 : (!r.pt || r.pt[0] !== pid) && t - j > 5000) (gone = gone || []).push(p);
      }
      if (gone) { for (const p of gone) line(`${nameOf(p)} ออกจากปาร์ตี้`, 'sys'); bump({ mem: roster.mem.filter((p) => !gone.includes(p)) }); }
      for (let i = invites.length - 1; i >= 0; i--) if (t > invites[i][3]) { NC.HUD.log(`${nameOf(invites[i][1])} ไม่ได้ตอบคำชวนเข้าปาร์ตี้`, 'sys'); invites.splice(i, 1); changed(); }
      return;
    }
    // a member: stop sending the roster once the new leader sends theirs; take over if the leader is gone
    const L = rem(roster.lead);
    if (publish && L && L.pr && L.pr.pid === pid && L.pr.ver >= roster.ver) publish = false;
    if (L) { leadGone = 0; return; }
    if (!leadGone) leadGone = t;
    if (t - leadGone < LEAD_GONE_MS) return;
    const rest = roster.mem.filter((p) => p !== roster.lead && (p === m || rem(p)));
    if (rest[0] === m) {
      leadGone = 0;
      roster = Object.assign({}, roster, { ver: roster.ver + 1, lead: m, mem: rest });
      publish = true;
      line('หัวตี้ออกจากเกมไปแล้ว · คุณเป็นหัวตี้แทน', 'level');
      changed();
    }
  }

  // ---------------- the actions ----------------
  PN.invite = function (peer) {
    const r = rem(peer), m = me();
    if (!r || !m || !r.named) return 'off';
    if (inParty() && !isLeader()) return 'lead';
    if (r.pt && r.pt[1] > 1) return 'busy';
    if (!pid) { pid = newId(); roster = { pid, ver: 1, lead: m, mem: [m], loot: 'f', exp: 'o' }; publish = true; wasIn = true; }
    if (roster.mem.includes(peer) || invites.some((v) => v[1] === peer)) return 'dup';
    if (roster.mem.length + invites.length >= MAX) return 'full';
    invites.push([++inviteN, peer, pid, Date.now() + INVITE_MS]);
    NC.HUD.log(`ชวน ${r.name} เข้าปาร์ตี้แล้ว รอตอบ…`, 'item');
    changed(); net.send();
    return 'ok';
  };
  PN.answer = function (ok) {
    if (!incoming) return;
    const v = incoming;
    incoming = null; hideAsk();
    answer = [v.n, v.from, v.pid, ok ? 1 : 0, Date.now() + 12000];
    if (ok) {
      if (pid) leaveQuiet();
      pid = v.pid; roster = null; publish = false; joinWait = Date.now() + 9000; wasIn = false;
      NC.HUD.log(`ตอบรับคำชวนของ ${v.name} แล้ว…`, 'item');
    } else NC.HUD.log(`ไม่รับคำชวนของ ${v.name}`, 'sys');
    changed(); net.send();
  };
  function leaveQuiet() {
    if (isLeader() && roster.mem.length > 1) {
      const rest = roster.mem.filter((p) => p !== me());
      handoff = { R: Object.assign({}, roster, { ver: roster.ver + 1, lead: rest[0], mem: rest }), until: Date.now() + 8000 };
    }
    pid = null; roster = null; publish = false; joinWait = 0; wasIn = false; invites.length = 0;
  }
  PN.leave = function () {
    if (!pid) return;
    const n = members().length;
    leaveQuiet();
    if (n > 1) line('คุณออกจากปาร์ตี้แล้ว', 'sys');
    changed(); net.send();
  };
  PN.kick = function (peer) {
    if (!isLeader() || peer === me() || !roster.mem.includes(peer)) return;
    line(`ให้ ${nameOf(peer)} ออกจากปาร์ตี้`, 'sys');
    bump({ mem: roster.mem.filter((p) => p !== peer) });
  };
  PN.lead = function (peer) {
    if (!isLeader() || peer === me() || !roster.mem.includes(peer)) return;
    line(`${nameOf(peer)} เป็นหัวตี้แล้ว`, 'level');
    bump({ lead: peer });
  };
  PN.setRule = function (loot, exp) {
    if (!isLeader()) return;
    const L = LOOT[loot] ? loot : roster.loot, E = EXPM[exp] ? exp : roster.exp;
    if (L === roster.loot && E === roster.exp) return;
    bump({ loot: L, exp: E });
    line(`หัวตี้ตั้งกติกา · ของดรอป: ${LOOT[L]} · EXP: ${EXPM[E]}`, 'sys');
  };

  // ---------------- handing things over ----------------
  function goods(peer) {
    let g = pending.get(peer);
    if (!g) pending.set(peer, (g = { m: {}, g: [], i: [], x: [0, 0], names: [] }));
    return g;
  }
  const MATS = () => NC.MATERIALS || {};
  const itemName = (l) => (l.mat ? (MATS()[l.mat] || {}).name || l.mat : (l.inst && l.inst.sh ? '✦ ' : '') + ((NC.ITEMS[l.id] || {}).name || l.id));
  // a kill's drops: pick who gets each (the finder's game decides, by the leader's rule)
  function route(game) {
    let pool = null;
    for (const l of game.loot) {
      if (!l._kill || l._pt) continue;
      l._pt = 1;
      if (l.potion || !inParty() || roster.loot === 'f') continue;
      if (!pool) { const on = onMap().map((r) => r.peer); pool = roster.mem.filter((p) => p === me() || on.includes(p)); }
      if (pool.length < 2) continue;
      let to = me();
      if (roster.loot === 't') to = pool[turn++ % pool.length];
      else if (roster.loot === 'r') to = pool[Math.floor(Math.random() * pool.length)];
      else if (roster.loot === 'l') to = pool.includes(roster.lead) ? roster.lead : me();
      if (to === me()) continue;
      const g = goods(to);
      if (l.mat) g.m[l.mat] = (g.m[l.mat] || 0) + 1;
      else if (l.inst) g.g.push([l.inst.id, (l.inst.rows || []).map((r) => [r.k, r.v, r.tier, r.sub || null]), l.inst.ref || 0, l.inst.sh ? 1 : 0, NC.Grade ? NC.Grade.of(l.inst) : -1, l.inst.bd ? 1 : 0]); // (the 5th: the colour grade, js/gradetier.js)
      else if (l.id) g.i.push(l.id);
      else continue;
      g.names.push(itemName(l));
      l._to = to; l._at = 0;
    }
  }
  const outBytes = () => JSON.stringify(out.map((o) => [o[0], o[1], o[2]])).length;
  function flush() {
    for (const [peer, g] of pending) {
      const pay = {};
      if (Object.keys(g.m).length) pay.m = g.m;
      if (g.g.length) pay.g = g.g;
      if (g.i.length) pay.i = g.i;
      if (g.x[0] >= 1 || g.x[1] >= 1) pay.x = [Math.round(g.x[0]), Math.round(g.x[1])];
      if (!Object.keys(pay).length) { pending.delete(peer); continue; }
      if (out.length && outBytes() + JSON.stringify(pay).length > OUT_BYTES) continue; // (full: waits for the acks)
      pending.delete(peer);
      out.push([++outSeq, peer, pay, Date.now(), nameOf(peer)]);
      if (g.names.length) {
        const cnt = {};
        for (const n of g.names) cnt[n] = (cnt[n] || 0) + 1;
        line(`${nameOf(peer)} ได้ ${Object.entries(cnt).map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(', ')} (${LOOT[roster ? roster.loot : 'f']})`);
      }
    }
    // not taken in time (or they are gone): it comes back to me
    const t = Date.now();
    for (let i = out.length - 1; i >= 0; i--) {
      const o = out[i], r = rem(o[1]);
      if (t - o[3] > HAND_MS || (!r && t - o[3] > 8000)) { out.splice(i, 1); take(o[2], o[4], true); }
    }
  }
  function acked(peer, s) {
    for (let i = out.length - 1; i >= 0; i--) if (out[i][1] === peer && out[i][0] <= s) out.splice(i, 1);
  }
  function receive(r, list) {
    const m = me(), was = applied.get(r.peer) || 0;
    let last = was;
    for (const e of list) {
      if (!Array.isArray(e) || e[1] !== m || !(e[0] > last)) continue;
      last = e[0];
      if (!(roster && roster.mem.includes(r.peer)) && Date.now() - (recent.get(r.peer) || 0) > 120000) continue; // (only from my party)
      take(e[2], r.name, false);
    }
    if (last !== was) { applied.set(r.peer, last); ackT.set(r.peer, Date.now()); net.send(); }
  }
  // a gear copy from another player: only rows that can really roll
  function gearOf(a) {
    const W = NC.GEAR;
    if (!W || !Array.isArray(a) || typeof a[0] !== 'string' || !W.isInst(a[0]) || !NC.itemReady(a[0])) return null;
    const rows = [];
    for (const r of Array.isArray(a[1]) ? a[1].slice(0, W.MAX_ROWS) : []) {
      const O = Array.isArray(r) && W.OPT[r[0]], tier = Array.isArray(r) ? r[2] | 0 : -1;
      if (!O || tier < 0 || tier > 2) return null;
      const [lo, hi] = O.tiers[tier], v = r[1] | 0;
      if (v < lo || v > hi) return null;
      const row = { k: r[0], v, tier };
      if (O.subs) { if (!O.subs.includes(r[3])) return null; row.sub = r[3]; }
      rows.push(row);
    }
    const c = W.make(a[0], { rows: 0 });
    c.rows = rows; c.ref = Math.max(0, Math.min(20, a[2] | 0)); c.sh = a[3] ? 1 : 0;
    if (a[4] >= 0 && a[4] <= 5) c.g = a[4] | 0; // (js/gradetier.js)
    if (a[5] === 1) c.bd = 1; // (bound: a piece from รากต้นไม้มืด, js/rootloot.js)
    return c;
  }
  function take(pay, from, back) {
    const game = G();
    if (!game || !game.player || !pay || typeof pay !== 'object') return;
    const p = game.player, got = [];
    if (pay.m && typeof pay.m === 'object') for (const id in pay.m) {
      const n = Math.max(0, Math.min(999, pay.m[id] | 0));
      if (n && MATS()[id]) { NC.addMat(game, id, n); got.push(`${MATS()[id].name}${n > 1 ? ' ×' + n : ''}`); }
    }
    // (a hand-over already left its sender, so it goes in even past a full bag, like a system grant: nothing is lost;
    // js/gearbag.js, the owner, 2026-10-08)
    if (Array.isArray(pay.g)) for (const a of pay.g.slice(0, 24)) {
      const c = gearOf(a);
      if (c) { NC.GEAR.add(game, c); got.push((c.sh ? '✦ ' : '') + NC.ITEMS[c.id].name); }
    }
    if (NC.GEAR.room && !NC.GEAR.room(p, 0)) game.toast(`กระเป๋าอุปกรณ์เกิน ${NC.GEAR.bagCap ? NC.GEAR.bagCap(p) : NC.GEAR.BAG_MAX} ชิ้น · ขายหรือฝากคลังที่ลุงโกโก้`);
    if (Array.isArray(pay.i)) for (const id of pay.i.slice(0, 24)) {
      const it = typeof id === 'string' && NC.ITEMS[id];
      if (it && !it.inst && it.rarity !== 'fashion' && !(NC.isBound && NC.isBound(id)) && NC.itemReady(id)) { p.owned.add(id); p.fresh.add(id); got.push(it.name); } // (isBound: account-bound items never change hands, js/vend.js)
    }
    let xp = 0;
    if (Array.isArray(pay.x)) {
      const cap = NC.xpNext ? NC.xpNext(Math.max(1, p.lv)) * 0.25 : 1e6;
      xp = Math.max(0, Math.min(cap, +pay.x[0] || 0)); const jx = Math.max(0, Math.min(cap, +pay.x[1] || 0));
      if (xp > 0 || jx > 0) NC.gainXp(game, xp, jx);
    }
    if (got.length) {
      if (NC.saveTrade) NC.saveTrade(game);
      NC.saveGame(game);
      FX.stars(p.x, p.y - 70, 12, '255,236,160', { speed: 220, size: 0.8 });
      line(back ? `ส่งให้ ${from} ไม่สำเร็จ · ของกลับมาที่คุณ: ${got.join(', ')}` : `คุณได้ ${got.join(', ')} จาก ${from} (ปาร์ตี้)`);
    }
    if (xp >= 1 && !back) { xpGot += xp; if (!xpShow) xpShow = setTimeout(showXp, 900); }
  }
  let xpGot = 0, xpShow = 0;
  function showXp() {
    xpShow = 0;
    const g = G();
    if (g && g.player && xpGot >= 1) FX.text(g.player.x, g.player.y - 250, `+${Math.round(xpGot).toLocaleString()} EXP ปาร์ตี้`, '#8fd3ff', 30);
    xpGot = 0;
  }

  // the kill's EXP, shared evenly (the orbs of the kill that just fell: they all have t 0 now)
  NC.skillKills.push((game, e) => {
    if (!inParty() || roster.exp !== 'e' || e._heroT == null || game.time - e._heroT > 3) return;
    const p = game.player, mates = onMap().filter((r) => Math.abs((r.lv | 0) - p.lv) <= GAP && !r.dd);
    if (!mates.length) return;
    const orbs = FX.list.filter((o) => o.type === 'orb' && o.t === 0 && !o._pt);
    if (!orbs.length) return;
    const sup = NC.PartySupport && NC.PartySupport.active() ? NC.PartySupport.SUPPORT_EXP : 0; // (a support job helping: js/partysupport.js)
    // each sharer's pot: + PN.extraK (js/partybonds.js: the kill's threads near that sharer, the job mix)
    const kOf = (who) => (1 + BONUS * mates.length + sup + (PN.extraK ? PN.extraK(who, mates) : 0)) / (mates.length + 1);
    const k = kOf(null);
    let xp = 0, jx = 0;
    for (const o of orbs) { o._pt = 1; xp += o.xp || 0; jx += o.jxp || 0; o.xp = (o.xp || 0) * k; o.jxp = (o.jxp || 0) * k; }
    for (const r of mates) { const g = goods(r.peer), kr = kOf(r); g.x[0] += xp * kr; g.x[1] += jx * kr; }
  });

  // ---------------- the drops on the ground: the ones for others fly to them ----------------
  function fly(game, dt) {
    let gone = false;
    for (const l of game.loot) {
      if (!l._to) continue;
      l._at += dt;
      if (l._at < 0.55) continue; // (the bounce first)
      const r = rem(l._to), here = r && r.pose && r.map === game.mapId;
      if (!here) { if (l._at > 1.1) { l._gone = gone = true; FX.puff(l.x, l.y - 20, 5, { speed: 80, color: '255,236,190' }); } continue; }
      const tx = r.x, ty = r.y - 10, d = Math.hypot(tx - l.x, ty - l.y), step = (320 + l._at * 1200) * dt;
      if (d < 34 || l._at > 2.6) { l._gone = gone = true; FX.stars(tx, r.y - 70, 10, '255,236,160', { speed: 200, size: 0.8 }); continue; }
      l.x += ((tx - l.x) / d) * Math.min(d, step); l.y += ((ty - l.y) / d) * Math.min(d, step); l.sort = l.y;
    }
    if (gone) game.loot = game.loot.filter((l) => !l._gone);
  }

  // ---------------- the invite question ----------------
  let ask = null;
  function showAsk() {
    if (!ask) {
      ask = document.createElement('div');
      ask.className = 'pn-ask'; ask.hidden = true;
      ask.innerHTML = '<div class="pn-ask-t" id="pn-ask-t"></div><div class="pn-ask-b"><button class="kw-btn blue" data-pn="yes">เข้าร่วม</button>' +
        '<button class="kw-btn grey" data-pn="no">ไม่เข้า</button></div><div class="pn-ask-bar"><i id="pn-ask-i"></i></div>';
      ask.addEventListener('click', (e) => { const b = e.target.closest('[data-pn]'); if (b) PN.answer(b.dataset.pn === 'yes'); });
      ($('hud') || document.body).appendChild(ask);
    }
    const v = incoming;
    if (!v) return;
    const r = rem(v.from);
    $('pn-ask-t').innerHTML = `<b>${esc(v.name)}</b> ชวนคุณเข้าปาร์ตี้` + (r ? `<small>Lv ${r.lv} ${esc((NC.JOBS[r.job] || {}).name || '')} · ${esc(net.mapName(r.map))}</small>` : '');
    ask.hidden = false;
  }
  function hideAsk() { if (ask) ask.hidden = true; }

  // ---------------- hooks ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    // the kill's drops: an outer NC.damageEnemy (every file's own wrappers are set by now, so they are all inside)
    const baseDmg = NC.damageEnemy;
    NC.damageEnemy = function (g, e) {
      const L0 = g.loot, n0 = L0.length, was = e && e.hp > 0;
      const res = baseDmg.apply(this, arguments);
      if (was && e.hp <= 0) {
        if (g.loot === L0) { for (let i = n0; i < g.loot.length; i++) g.loot[i]._kill = 1; }
        else for (const l of g.loot) if (l.t === 0 && !('_pt' in l)) l._kill = 1;
      }
      return res;
    };
    const baseLoot = NC.updateLoot;
    NC.updateLoot = function (g, dt) {
      route(g);
      for (const l of g.loot) if (l._to) l.t = Math.min(l.t, 0.3); // (never mine: the pickers skip what is younger than 0.7 s)
      const res = baseLoot.apply(this, arguments);
      fly(g, dt || 1 / 60);
      return res;
    };
    setInterval(() => {
      if (!net.room) return;
      settle();
      flush();
      if (incoming && ask && !ask.hidden) { const i = $('pn-ask-i'); if (i) i.style.width = Math.max(0, (100 * (incoming.until - Date.now())) / INVITE_MS).toFixed(1) + '%'; }
      if (dirty) { dirty = false; for (const f of PN.ticks) { try { f(); } catch (e) { /* (the window) */ } } }
    }, 250);
  };
  PN.ticks = []; // (fn() after a change, at most 4 times a second: the window redraws)

  // a small crown over the leader's name in the world
  const P = NC.Party;
  if (P && P.drawTags) {
    const baseTags = P.drawTags;
    P.drawTags = function (ctx, game) {
      baseTags.apply(this, arguments);
      if (!inParty() || !net.room) return;
      const crown = NC.SPR.ic_crown;
      for (const p of roster.mem) {
        const r = p === me() ? null : rem(p);
        const x = r ? r.x : game.player.x, y = r ? r.y + 52 : game.player.y + 52;
        if (r && (!r.pose || r.map !== game.mapId)) continue;
        if (p === me()) continue; // (my own tag: the HUD frame shows it)
        ctx.save();
        ctx.font = '600 15px Mitr, sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
        ctx.lineWidth = 5; ctx.strokeStyle = NC.OUTLINE || '#2a2435';
        const t = roster.lead === p ? 'หัวตี้' : 'ปาร์ตี้';
        ctx.strokeText(t, x, y + 22); ctx.fillStyle = roster.lead === p ? '#ffd873' : '#8ff08a'; ctx.fillText(t, x, y + 22);
        if (roster.lead === p && crown) ctx.drawImage(crown.img, x - ctx.measureText(t).width / 2 - 26, y + 6, 22, 22); // (the crown beside "หัวตี้")
        ctx.restore();
      }
    };
  }
})();
