/* online/pvp.js — duels and the lake arena online (?online): the server runs the match (backend pvp*.go), the web's own
   pvp.js draws it (the match bar, 3-2-1, the ring of fire, the round words, the question, the result) through PV.drive
   and PV.ui; the hit claims, the host's match state and the presence fields dv da du dk hc dl are not used.
     challenge  PV.challenge (the hero menu's ท้าดวล, /duel name) = {action:'pvp', kind:'invite', targetId}; the server picks a
                field duel or (both on the public pvp_lake) an arena match, best of 3 in a private room (op 104)
     answer     self.pvpInvite / the pvpInvite event -> pvp.js's question; PV.answer = {kind:'accept'|'decline', id}
     the match  self.pvp: phase (waiting countdown fight overtime pause ended), round, best, wins [mine, theirs],
                remaining, ring {x, y, r, sq}, outsideSeconds, canAttack, cc, opponentId, result; PV.duel follows it
     hits       the opponent's stand-in (pvp.js's proxy, kept online) makes swings and skills aim at them; the swings and
                skills name the opponent (targetId); every hit comes back as a combat event with pvp:true (W.pvpCombat)
     the end    the pvpResult event (score, reason) -> pvp.js's finish; /duel ยอมแพ้ (or /ยอมแพ้) = {kind:'forfeit'}
   While a match is on, the commands the server refuses then are not sent (moves outside the fight, loot, the bridge's
   actions). The team modes and the ranked queue have no web window yet. Load after online/world.js. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld, PV = NC.PvP;
  if (!O || !O.enabled || !W || !PV) return;
  const FX = NC.FX;
  const self = () => (W.snap && W.snap.self) || null;
  const match = () => { const s = self(); return (s && s.pvp) || null; };
  const fighting = () => { const v = match(); return !!(v && (v.phase === 'fight' || v.phase === 'overtime')); };
  const rem = (id) => (NC.Net && NC.Net.remotes ? NC.Net.remotes.get(id) : null);
  const ui = () => PV.ui || {};
  const opponentOf = (v) => v.opponentId || ((v.members || []).find((m) => m.team !== v.myTeam) || {}).id || null;
  const WHY = { hp: 'หมดแรง', outside: 'ออกนอกวงไฟ', ring: 'โดนวงไฟเผา', time: 'หมดเวลา', damage: 'ตัดสินจากดาเมจ', forfeit: 'ยอมแพ้',
    left: 'ออกจากการต่อสู้', disconnect: 'หลุดการเชื่อมต่อ', noshow: 'คู่ต่อสู้ไม่มา', cancelled: 'ยกเลิก', conflict: 'ยกเลิก' };

  // ---------------- challenging, answering ----------------
  const sent = new Map(); // peer -> until (the server's invite lives 15 s)
  PV.challenge = function (peer) {
    const g = NC.game, r = rem(peer);
    if (!r || !r.named) return 'off';
    if (PV.duel || match()) return 'busy';
    if (r.map !== g.mapId) return 'far';
    if ((sent.get(peer) || 0) > Date.now()) return 'dup';
    const arena = !!(g.world && g.world.pvpArena);
    if (!arena && NC.dist(r.x, r.y, g.player.x, g.player.y) > 900) return 'far';
    sent.set(peer, Date.now() + 15000);
    W.send({ action: 'pvp', kind: 'invite', targetId: peer });
    return 'ok';
  };
  PV.answer = function (ok) {
    const v = PV.incoming && PV.incoming();
    if (ui().closeAsk) ui().closeAsk();
    if (!v) return;
    W.send({ action: 'pvp', kind: ok ? 'accept' : 'decline', id: v.sid });
    asked = v.sid; // (not asked again while the server still shows it)
  };
  let asked = null;
  function offer(inv) {
    if (!inv || !inv.id || inv.id === asked || PV.duel) return;
    asked = inv.id;
    const q = PV.incoming && PV.incoming();
    if (q && q.sid === inv.id) return;
    if (ui().offer) ui().offer({ n: inv.id, sid: inv.id, from: inv.fromId, name: inv.name || '?', arena: inv.mode !== 'duel', until: inv.expiresAt || Date.now() + 15000 });
  }
  W.selfHooks.push((s) => {
    if (s.pvpInvite) offer(s.pvpInvite);
    else { const q = PV.incoming && PV.incoming(); if (q && q.sid && ui().closeAsk) ui().closeAsk(); }
  });

  // ---------------- the match, every frame (pvp.js's frame hands it over) ----------------
  const PH = { waiting: 'c', countdown: 'c', fight: 'f', overtime: 'f', pause: 'p', ended: 'e' };
  const done = new Set(); // (matches already finished here: self.pvp lingers a moment after the result)
  PV.drive = function (g, dt) {
    const v = match();
    let d = PV.duel;
    if (d && d.over) done.add(d.id);
    const q = PV.incoming && PV.incoming();
    if (q && q.until && Date.now() > q.until && ui().closeAsk) ui().closeAsk();
    if (!v || (v.mode !== 'duel' && v.mode !== 'arena') || done.has(v.id)) {
      if (d && !d.over && d.online) ui().finish(d, d.wins[0] > d.wins[1] ? 'win' : d.wins[0] < d.wins[1] ? 'lose' : 'draw');
      return;
    }
    const opp = opponentOf(v), p = g.player, r = rem(opp);
    if (!d || d.id !== v.id) {
      d = PV.duel = { id: v.id, online: true, host: false, opp, arena: v.mode !== 'duel', map: g.mapId, best: v.best || 1, round: v.round || 1, wins: [0, 0],
        phase: 'c', t: 0, cx: p.x, cy: p.y, R: 420, sq: 0.58, keep: { hp: p.hp, sp: p.sp }, out: 0, seen: Date.now(), roundSet: 0,
        cc: { hard: [], immune: 0, stun: 0, slow: 0 }, lastW: 0, shown: null };
      ui().note(`เริ่ม${d.arena ? 'ประลอง' : 'ดวล'}กับ ${r ? r.name : 'คู่ต่อสู้'}!`);
    }
    if (d.over) return;
    d.opp = opp; d.map = g.mapId; d.best = v.best || d.best;
    if (v.ring) { d.cx = v.ring.x; d.cy = v.ring.y; d.R = v.ring.r; d.sq = v.ring.sq || d.sq; }
    if (ui().ringFx) ui().ringFx(d);
    const ph = PH[v.phase] || 'c', left = Math.max(0, v.remaining || 0), limit = d.arena ? 100 : 120; // (pvp.js's bar counts limit - t)
    if (v.round !== d.round) { d.round = v.round; d.shown = null; }
    if (ph === 'c') { d.t = 0; const n = Math.max(1, Math.ceil(left)); if (v.phase === 'countdown' && n !== d.shown && n <= 3) { d.shown = n; ui().big(String(n), d.best > 1 ? `ยกที่ ${d.round}` : ''); } }
    else if (ph === 'f') { d.t = limit - left; if (d.shown !== 0) { d.shown = 0; ui().big(v.decider ? 'ยกตัดสิน!' : 'ดวล!', ''); } }
    const w = Array.isArray(v.wins) ? v.wins : [0, 0];
    if (w[0] + w[1] > d.wins[0] + d.wins[1] && d.best > 1 && ph !== 'e') ui().big(w[0] > d.wins[0] ? 'ชนะยกนี้!' : 'แพ้ยกนี้', `${w[0]} – ${w[1]} · ${r ? r.name : ''}`);
    d.wins = [w[0] | 0, w[1] | 0];
    d.phase = ph;
    d.out = v.outsideSeconds || 0;
    // countdown, pause, a stun: the hero stands still (pvp.js's updatePlayer wrapper reads cc.stun)
    const cc = v.cc || {};
    d.cc.stun = Math.max(cc.stun || 0, cc.freeze || 0, v.canAttack === false ? 0.2 : 0);
    d.cc.slow = cc.slow || 0;
    // the opponent's stand-in: swings and skills find it, never drawn (pvp.js)
    if (ph === 'f' && r) {
      let e = d.proxy;
      if (!e || !g.enemies.includes(e)) {
        e = d.proxy = NC.makeDummy({ name: r.name, lv: r.lv || 1, note: '' }, r.x, r.y);
        e.type = 'pvpfoe'; e.pvp = opp; e.online = true; e.sid = opp; e.r = 22;
        g.enemies.push(e);
      }
      const m = (v.members || []).find((x) => x.id === opp);
      e.maxHp = Math.max(1, (m && m.maxHp) || 1000); e.hp = Math.max(1, (m && m.hp) || Math.round(((r.hpPct || 100) / 100) * e.maxHp)); e.dead = false;
      e.x = e.sx = e.wx = r.x; e.y = e.sy = e.wy = r.y; e.sort = r.y; e.kbx = e.kby = 0;
    } else if (d.proxy && ui().dropProxy) ui().dropProxy(g);
  };
  W.eventHooks.push((ev) => {
    if (!ev) return;
    if (ev.type === 'pvpInvite') offer(ev.invite);
    else if (ev.type === 'pvp' && ev.kind === 'invite') { const r = rem(ev.targetId); ui().toast(`ส่งคำท้าไปหา ${r ? r.name : 'เขา'} แล้ว`); }
    else if (ev.type === 'pvp' && ev.kind === 'decline') { for (const [k] of sent) sent.delete(k); ui().toast('อีกฝ่ายไม่รับคำท้า'); }
    else if (ev.type === 'pvpFeed' && ev.kind === 'overtime') ui().big('ต่อเวลา!', ev.seconds ? `${ev.seconds} วินาที ดาเมจแรงขึ้น` : '');
    else if (ev.type === 'pvpResult') {
      const d = PV.duel;
      if (!d || d.over) return;
      if (Array.isArray(ev.score)) d.wins = [ev.score[0] | 0, ev.score[1] | 0];
      ui().finish(d, ev.result === 'win' ? 'win' : ev.result === 'lose' ? 'lose' : 'draw');
      if (ev.reason && WHY[ev.reason]) ui().note(`(${WHY[ev.reason]})`);
    }
  });

  // ---------------- the hits ----------------
  W.pvpCombat = (ev) => {
    const g = NC.game, p = g && g.player, d = PV.duel;
    if (!p) return false;
    if (ev.targetId === W.me) {
      if (ev.evade) { FX.text(p.x, p.y - 190, 'หลบ!', '#d8ecff', 28); return true; }
      return false; // (world.js lowers my HP and shows the number)
    }
    if (!d || ev.targetId !== d.opp) return false; // (someone else's duel: world.js's small number)
    const r = rem(d.opp), x = r ? r.x : (d.proxy || {}).x, y = r ? r.y : (d.proxy || {}).y;
    if (x == null) return true;
    const top = y - 212;
    d.numDir = -(d.numDir || 1);
    if (ev.miss || ev.evade) { FX.dmg(x, top, 'MISS', { size: 32, fill: '#cfd8ff', dir: d.numDir }); return true; }
    const n = Math.max(1, Math.round(ev.damage || 0));
    if (ev.dot) FX.num(x, top + 30, n, { size: 30, fill: '#9be35a' });
    else { FX.dmg(x, top, n, { size: ev.crit ? 56 : 44, fill: ev.crit ? '#ffe066' : '#ffffff', crit: !!ev.crit, dir: d.numDir }); FX.sparks(x, y - 45, 5, '255,255,255'); }
    if (r) r.hurt = 0.25;
    return true;
  };

  // ---------------- what is sent while a match is on ----------------
  const wrap = (name, gate) => { const base = O[name]; O[name] = function () { const a = gate(arguments); return a === false ? undefined : base.apply(this, a || arguments); }; };
  wrap('move', () => (match() && !fighting() ? false : null));
  wrap('pickup', () => (match() ? false : null));
  wrap('attack', (a) => { const v = match(); if (!v) return null; if (!fighting()) return false; return [a[0], opponentOf(v) || undefined]; });
  wrap('skill', (a) => { const v = match(); if (!v) return null; if (!fighting()) return false; return [a[0], a[1], a[2], a[3], opponentOf(v) || undefined]; });
  wrap('action', (a) => {
    const v = match(), f = a[0] || {};
    if (!v) return null;
    if (f.action === 'pvp' || f.action === 'honor') return null;
    if ((f.action === 'potion' || f.action === 'dash') && fighting()) return null;
    return false;
  });

  // ---------------- chat: give up; no practice bot online ----------------
  const C = (NC.chatCmds = NC.chatCmds || {});
  const forfeit = (say) => { if (!match()) { say('ไม่ได้ดวลอยู่', 'warn'); return; } W.send({ action: 'pvp', kind: 'forfeit' }); say('ยอมแพ้แล้ว', 'sys'); };
  C['/ยอมแพ้'] = C['/giveup'] = (rest, say) => forfeit(say);
  const baseDuel = C['/duel'];
  if (baseDuel) C['/duel'] = C['/ดวล'] = function (rest, say) { if (/^\s*(quit|ยอมแพ้|giveup)\s*$/i.test(rest || '')) { forfeit(say); return; } return baseDuel.apply(this, arguments); };
  C['/bot'] = C['/บอท'] = (rest, say) => say('บอทซ้อมดวลใช้ได้ตอนเล่นออฟไลน์เท่านั้น ออนไลน์ท้าผู้เล่นจริงได้เลย (คลิกขวาที่ตัวละคร)', 'warn');
})();
