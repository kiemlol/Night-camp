/* online/gwar.js — ศึกชิงกองไฟ online (?online): the server runs the war on its four lands (backend guild_war*.go), the
   web's own gwar.js / gwar_ui.js draw it (the fires, their light and banners, the darkness, the HUD, the feed, the
   respawn picker, the end card, the war board at the gate).
     the board   nc_gwar {op:'board'} (refreshed while the board is open and every 30 s): who holds and challenges each land,
                 whether the war is on, whether my guild may go in; ลงชื่อ / ถอน = nc_gwar {op:'sign'|'unsign', land}
     a land      เข้าสนาม = {action:'gwar', kind:'enter', id: land} (at the gate), the server moves the hero (op 104);
                 self.gwar is the war as gwar.js keeps it (GW.match, GW.side, GW.me, the feed, the chop, the fallen wait);
                 the other heroes' players[].gw {s, w, h} colour them and hide them in the dark
     the hands   chopping a tree = {kind:'chop', row: tree + 1} (the server counts the wood and feeds a fire the hero stands
                 by); the respawn fire picked = {kind:'spawn', row: fire + 1 | 0}; Tab's table = {kind:'score'};
                 กลับค่าย = {kind:'leave'}
     the end     the gwar event end: the reward (ถ่านศึก) and the end card
   gwar.js's host, its stand-ins, its own chopping count, feeding and reward stay off (GW.server). Load after world.js. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld, GW = NC.GW;
  if (!O || !O.enabled || !W || !GW) return;
  const G = () => NC.game;
  const send = (o) => W.send(Object.assign({ action: 'gwar' }, o));
  const self = () => (W.snap && W.snap.self) || null;

  // ---------------- the war board ----------------
  let board = null, boardT = 0;
  async function loadBoard() {
    try { const r = await O.rpc('nc_gwar', { op: 'board' }); if (r && r.lands) { board = r; boardT = Date.now(); if (GW.ui.refresh) GW.ui.refresh(); } } catch (e) { console.warn('online gwar: board', e); }
  }
  setInterval(() => { const open = document.querySelector('.gwr-zones'); if (W.ready && (Date.now() - boardT > 30000 || (open && open.offsetParent && Date.now() - boardT > 8000))) loadBoard(); }, 4000);
  const land = (zid) => (board && board.lands.find((l) => l.id === zid)) || null;
  GW.windowAt = () => {
    const t = Date.now();
    if (!board) return { open: false, start: t + 864e5, end: t + 864e5, next: t + 864e5 };
    const skew = board.now ? t - board.now - (t - boardT) : 0; // (the server's clock)
    return { open: !!board.open, start: board.start + skew, end: board.end + skew, next: board.start + skew };
  };
  GW.sidesOf = (zid) => {
    const l = land(zid);
    if (!l) return { owner: '', b: null, r: null };
    const ch = (l.challengers || []).map((g) => ({ gid: g.gid, name: g.name }));
    return l.owner ? { owner: l.owner.gid, b: { gid: l.owner.gid, name: l.owner.name }, r: ch[0] || null } : { owner: '', b: ch[0] || null, r: ch[1] || null };
  };
  GW.seenMatch = (zid) => {
    const l = land(zid), v = l && l.live;
    if (!v) return null;
    const fires = GW.FIRES.map(() => ({ own: '', fuel: 0, lit: 0, by: '' }));
    if (fires[GW.GREAT]) fires[GW.GREAT].own = v.great || '';
    return { m: { id: zid, zone: zid, ph: v.ph || 'f', left: v.left || 0, fires, nm: { b: v.greatName || '', r: v.greatName || '' }, gid: { b: '', r: '' }, owner: '', hold: { b: 0, r: 0 }, win: '' }, t: boardT };
  };
  GW.canEnter = (zid) => { const l = land(zid); return l ? l.enter || 'wait' : 'wait'; };
  GW.signUp = async (zid) => {
    try { const r = await O.rpc('nc_gwar', { op: 'sign', land: zid }); if (r && r.lands) { board = r; boardT = Date.now(); } return (r && r.result) || 'taken'; } catch (e) { return 'taken'; }
  };
  GW.unSign = async (zid) => {
    try { const r = await O.rpc('nc_gwar', { op: 'unsign', land: zid }); if (r && r.lands) { board = r; boardT = Date.now(); } return !!(r && r.result === 'ok'); } catch (e) { return false; }
  };

  // ---------------- going in, coming out ----------------
  GW.enter = function (zid) {
    const why = GW.canEnter(zid);
    if (why !== 'ok') return why;
    const g = G();
    if (NC.Auto && NC.Auto.on && g) NC.Auto.toggle(g);
    GW.me = { k: 0, d: 0, c: 0, w: 0, carry: 0 }; GW.spawnAt = -1; GW.chop = null; GW.feed = []; GW.endSeen = false; GW.seen = {};
    send({ kind: 'enter', id: zid });
    return 'ok';
  };
  let leaving = 0;
  GW.leave = function (why) {
    const g = G();
    if (g && GW.ZONE[g.mapId] && Date.now() - leaving > 3000) { leaving = Date.now(); send({ kind: 'leave' }); }
    if (why) NC.HUD.log(why, 'sys');
  };

  // ---------------- the war, from the server's record ----------------
  const S = {
    chop(g, t) { // (gwar.js's startChop: B or a click by a tree)
      const w = g.world, i = w && w.gwTrees ? w.gwTrees.indexOf(t) : -1;
      if (!GW.match || (GW.match.ph !== 'f' && GW.match.ph !== 'p') || g.player.dead > 0) return false;
      if (GW.me.carry >= GW.RULES.carry) { g.toast(`ถือฟืนได้สูงสุด ${GW.RULES.carry} มัด · ไปเติมไฟฝั่งเรา`); return true; }
      send({ kind: 'chop', row: i >= 0 ? i + 1 : 0 });
      GW.chop = { tree: t, t: 0, swing: 0, sent: Date.now() };
      g.player.face = t.x > g.player.x ? 1 : -1;
      return true;
    },
  };
  GW.server = S;
  let seen = null, lastSpawn = -1;
  W.selfHooks.push((s) => {
    const v = s.gwar;
    if (v === seen) return;
    seen = v;
    if (!v) return;
    GW.side = v.side || '';
    const names = v.names || ['', ''], gid = { b: 'b:' + names[0], r: 'r:' + names[1] };
    GW.gid = gid[GW.side] || '';
    GW.match = { id: v.id, zone: v.land, ph: v.ph, t: v.t || 0, left: v.left || 0, hold: { b: (v.hold || [])[0] || 0, r: (v.hold || [])[1] || 0 },
      gid, nm: { b: names[0], r: names[1] }, owner: v.owned ? gid.b : '', win: v.win || '',
      fires: (v.fires || []).map((f) => ({ own: f.own || '', fuel: f.fuel || 0, lit: f.lit || 0, by: f.by || '', nb: f.nb | 0, nr: f.nr | 0 })) };
    GW.me = Object.assign({ k: 0, d: 0, c: 0, w: 0, carry: 0 }, v.me || {});
    if (Array.isArray(v.feed)) { GW.feed = v.feed.slice(-6).map((q) => ({ text: q.text, side: q.side, t: q.at })); if (GW.ui.feed) GW.ui.feed(); }
    if (v.chop && G() && G().world && G().world.gwTrees) { const t = G().world.gwTrees[v.chop.tree]; if (t && (!GW.chop || GW.chop.tree !== t)) GW.chop = { tree: t, t: v.chop.t || 0, swing: 0 }; }
    else if (!v.chop && GW.chop && !(GW.chop.sent && Date.now() - GW.chop.sent < 800)) GW.chop = null;
    if (v.ph === 'e') GW.endSeen = true; // (the server pays: its end event)
    GW.downOk = v.down && Array.isArray(v.down.ok) ? v.down.ok : null;
  });
  GW.spawnOk = (i) => !!(GW.downOk && GW.downOk.includes(i)) || !!(GW.match && GW.match.ph === 'f' && GW.match.fires[i] && GW.match.fires[i].own === GW.side && !GW.downOk);
  setInterval(() => { // the respawn fire picked in the fallen window
    if (!GW.on() || GW.spawnAt === lastSpawn) return;
    lastSpawn = GW.spawnAt;
    send({ kind: 'spawn', row: GW.spawnAt >= 0 ? GW.spawnAt + 1 : 0 });
  }, 300);
  // the other heroes: their side and wood (gwar.js reads presence gw: [match, side, gid, k, d, c, w, carry])
  W.presenceHooks.push((pl, pr) => {
    const t = pl.gw, v = self() && self().gwar;
    if (!t || !v) return;
    pr.gw = [v.id || '', t.s || '', t.s === 'b' || t.s === 'r' ? (t.s === 'b' ? 'b:' : 'r:') + ((v.names || [])[t.s === 'b' ? 0 : 1] || '') : '', 0, 0, 0, 0, t.w | 0];
  });

  // ---------------- the events ----------------
  let table = null;
  const basePeople = GW.people;
  GW.people = function () {
    if (!table) return basePeople();
    const out = [];
    for (const side of ['b', 'r']) for (const r of table[side] || []) out.push({ peer: r.id, side, name: r.name, job: r.job, lv: r.lv, k: r.k | 0, d: r.d | 0, c: r.c | 0, w: r.w | 0, alive: true, mine: r.id === W.me });
    return out;
  };
  addEventListener('keydown', (e) => { if (e.code === 'Tab' && GW.on() && !e.repeat) send({ kind: 'score' }); }, true);
  W.eventHooks.push((ev) => {
    if (!ev || ev.type !== 'gwar') return;
    const g = G();
    switch (ev.kind) {
      case 'toast': if (g && ev.text) g.toast(ev.text); break;
      case 'fell': if (GW.ui.dead) GW.ui.dead(true); break;
      case 'score': if (ev.tables) { table = { b: ev.tables.b || [], r: ev.tables.r || [] }; if (GW.ui.score) GW.ui.score(); } break;
      case 'end': {
        GW.lastReward = { n: ev.embers | 0, won: !!ev.won, win: ev.win || '' };
        if (ev.tables) table = { b: ev.tables.b || [], r: ev.tables.r || [] };
        const m = GW.match || {};
        if (GW.ui.end) GW.ui.end(Object.assign({}, m, { win: ev.win || m.win || '', zone: m.zone || (g && g.mapId) }));
        break;
      }
      case 'left': table = null; GW.side = ''; break;
      default: break;
    }
  });
})();
