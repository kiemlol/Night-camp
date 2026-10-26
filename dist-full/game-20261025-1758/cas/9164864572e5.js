/* online/store.js — loaded right after js/store.js: with ?online the guild documents NC.Store serves (guilds/{gid},
   gmembers/{uid}, ginvites/{uid}, gnames/*: js/guild.js's whole world) are made from the Go server's record of the
   hero's guild (self.social: guild, roster, invite, capacity, level, paid; backend social_runtime.go), read-only: what
   the guild window does goes to the server as actions (online/social.js catches its buttons), so the Store's writes on
   those paths are dropped. The leaderboard's ranks / guilds boards come from the server (nc_rankings, below); every
   other path stays on this browser's stand-in as before.
   NC.Store.ready waits for the online world (the server's id is NC.Store.me()), so guild.js starts with the right one. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, S = NC.Store;
  if (!O || !O.enabled || !S) return;
  const GUILD = /^(guilds|gmembers|ginvites|gnames)(\/|$)/;
  const B = { ready: S.ready, me: S.me, get: S.get, set: S.set, update: S.update, del: S.del, query: S.query, watch: S.watch, claim: S.claim };
  const weekNo = () => Math.floor((Date.now() / 86400000 + 3) / 7); // (js/guild.js's week)
  let social = null, myId = null, readyRes = null;
  const watchers = new Set(); // { path, fn, q }

  // ---------------- the documents, made from self.social ----------------
  function guildDoc() {
    const s = social, g = s && s.guild;
    if (!g || !g.id) return null;
    const w = weekNo(), qn = (g.quest && g.quest[String(s.week)]) || 0;
    const boss = g.boss && g.boss[String(s.week)];
    return {
      name: g.name, color: g.color, emblem: g.emblem | 0, leader: g.leader, officers: (g.officers || []).slice(), notice: g.notice || '', created: g.created || 0,
      paid: s.paid ? { [w]: s.upkeep || 0 } : {}, score: Math.round(g.exp || 0), lv: s.level || 1, n: (s.roster || []).length,
      // (the server's totals: guild.js adds the members' counters and these)
      kept: { server: Math.round(g.exp || 0) }, keptc: { server: Math.round(g.coffer || 0) },
      qdone: g.quest && g.quest['done' + s.week] ? { [w]: 1 } : {},
      boss: boss ? { week: w, type: boss.type, done: boss.done ? 1 : 0, hp: 1, t0: 0 } : null,
      _qn: qn, cap: s.capacity || 0,
    };
  }
  // a guild mate on another map (2026-10-20 Discord #137: everyone showed "ออฟไลน์ 1 นาที" in one default look; js/guild.js
  // only found the ones in this room): the roster's online / map / channel, and the look from self.social.online's
  // portrait (as js/online/chwin.js). A portrait is head and shoulders (backend portraitSlots): the campfire's whole body
  // gets the traveler's legs
  function lookOf(id) {
    const live = ((social && social.online) || []).find((x) => x && x.id === id), P = live && live.portrait, W = NC.OnlineWorld;
    if (!P || !P.equip || !W || !W.equipOf) return null;
    try {
      const eq = W.equipOf(P.equip, P.appearance ? { hair: 'created' } : null, P.appearance);
      for (const [k, v] of [['top', 'top_traveler'], ['pants', 'pants_traveler'], ['shoes', 'shoes_traveler'], ['weapon', 'sword']]) if (!eq[k]) eq[k] = v;
      return eq;
    } catch (e) { return null; }
  }
  function memberData(r, gid) {
    const s = social || {}, w = weekNo(), mine = r.id === myId;
    const qn = mine && s.guild && s.guild.quest ? s.guild.quest[String(s.week)] || 0 : 0;
    // (the server's seen is in seconds, js/online/socialnotify.js localOf: as milliseconds it read 1970)
    return { gid, name: r.name, job: r.job, lv: r.lv, map: r.mapId, ch: r.channelId ? String(r.channelId) : '', online: !!r.online,
      seen: r.online ? Date.now() : (r.seen || 0) * 1000, joined: r.joined || 0, gx: 0, dn: 0, kicked: null, role: r.role,
      q: mine ? { week: w, n: qn } : null, eq: r.online && !mine ? lookOf(r.id) : null };
  }
  function memberDoc(uid) {
    const g = social && social.guild;
    if (!g || !g.id) return { gid: null, kicked: null };
    const r = (social.roster || []).find((x) => x.id === uid);
    return r ? memberData(r, g.id) : uid === myId ? { gid: g.id, name: '', gx: 0, dn: 0 } : null;
  }
  function inviteDoc() {
    const v = social && social.invite;
    if (!v || !v.guild) return null;
    return { gid: v.guild, name: v.name, color: v.color, emblem: v.emblem | 0, from: v.from, fromName: v.fromName, t: Date.now() };
  }
  const segs = (p) => String(p).split('/').filter(Boolean);
  function docOf(path) {
    const [coll, id] = segs(path);
    if (coll === 'guilds') { const g = social && social.guild; return g && g.id === id ? guildDoc() : null; }
    if (coll === 'gmembers') return memberDoc(id);
    if (coll === 'ginvites') return id === myId ? inviteDoc() : null;
    return null;
  }
  function queryOf(coll, q) {
    if (coll === 'gmembers') {
      const g = social && social.guild;
      if (!g || !g.id) return [];
      const want = q && q.where && q.where.find((w) => w[0] === 'gid');
      if (want && want[2] !== g.id) return [];
      return (social.roster || []).map((r) => ({ id: r.id, data: memberData(r, g.id) }));
    }
    if (coll === 'guilds') { const d = guildDoc(); return d ? [{ id: social.guild.id, data: d }] : []; }
    return [];
  }
  const tell = (w) => { try { w.fn(segs(w.path).length % 2 === 0 ? docOf(w.path) : queryOf(w.path, w.q)); } catch (e) { console.warn('online store: watch', e); } };

  // ---------------- the leaderboard (js/ranks.js, N): the server's boards, nc_rankings (backend leaderboard.go) ----------------
  // ranks.js asks query('ranks' | 'guilds', { order: [field, 'desc'], limit }) for a board and query('ranks', { where:
  // [[field, '>', mine]] }) for its own place below the list; the rows come back in its { id, data } shape, the hero's own
  // row under NC.Store.me(). Its own row (set 'ranks/<uid>') is not written: the server ranks from the hero's record.
  const KIND = { lvs: 'lv', boss: 'boss', kills: 'kills', coins: 'coins', life: 'life', pvp: 'pvp', score: 'guild' };
  const SLOTS = ['hat', 'hair', 'top', 'pants', 'shoes', 'weapon', 'robe', 'cape', 'glasses'];
  const seasonNo = () => (NC.Season && NC.Season.seasonNo ? NC.Season.seasonNo() : (() => { const d = new Date(); return 1 + Math.max(0, Math.floor(((d.getFullYear() - 2026) * 12 + d.getMonth() - 9) / 3)); })());
  const boards = {}; // kind -> { t, rows, mine }
  function rowOf(r, kind, mine) {
    const sn = seasonNo();
    if (kind === 'guild') return { id: r.id, data: { name: r.name, lv: r.lv | 0, score: r.score || 0, n: r.n | 0, color: r.gcolor, emblem: r.gemb | 0, season: sn } };
    const eq = r.equip || {}, look = r.look || {};
    return {
      id: mine && r.id === mine.id ? S.me() : r.id,
      data: { name: r.name, job: r.job, line: r.line || 'traveler', lv: r.lv | 0, xp: +r.xp || 0, lvs: kind === 'lv' ? r.score : (r.lv | 0) * 1000,
        [kind === 'lv' ? 'lvs' : kind]: r.score || 0, guild: r.guild || null, gcolor: r.gcolor || null, gemb: r.gemb | 0,
        eq: SLOTS.map((k) => look[k] || eq[k] || undefined), season: sn },
    };
  }
  async function board(kind) {
    const b = boards[kind];
    if (b && Date.now() - b.t < 15000) return b;
    const r = await O.rpc('nc_rankings', { kind, job: 'all', limit: 100 });
    if (r && r.available === false) throw new Error(r.reason || 'ตารางนี้ยังไม่เปิด');
    const mine = (r && r.mine) || null;
    return (boards[kind] = { t: Date.now(), mine, rows: ((r && r.rows) || []).map((x) => rowOf(x, kind, mine)) });
  }
  async function ranksQuery(coll, q) {
    await S.ready;
    if (q && q.order) return (await board(KIND[q.order[0]] || (coll === 'guilds' ? 'guild' : 'lv'))).rows.slice(0, q.limit || 100);
    const w = q && q.where && q.where[0];
    const b = w && KIND[w[0]] ? await board(KIND[w[0]]) : null; // (my place: as many rows above me as my rank says)
    const n = b && b.mine && b.mine.rank > 0 ? b.mine.rank - 1 : 0;
    return Array.from({ length: n }, () => ({ id: '', data: { season: seasonNo() } }));
  }
  const RANKS = (c, q) => c === 'ranks' || (c === 'guilds' && q && q.order);

  // ---------------- the Store, guild paths from the server ----------------
  S.ready = new Promise((res) => { readyRes = res; });
  S.me = () => myId || B.me();
  S.get = async (p) => (GUILD.test(p) ? (await S.ready, docOf(p)) : B.get(p));
  S.set = async (p, d) => (GUILD.test(p) || /^ranks\//.test(p) ? undefined : B.set(p, d));
  S.update = async (p, d) => (GUILD.test(p) ? undefined : B.update(p, d));
  S.del = async (p) => (GUILD.test(p) ? undefined : B.del(p));
  S.query = async (c, q) => (RANKS(c, q) ? ranksQuery(c, q) : GUILD.test(c) ? (await S.ready, queryOf(c, q)) : B.query(c, q));
  S.claim = async (p, d) => (GUILD.test(p) ? true : B.claim(p, d));
  S.watch = (p, fn, q) => {
    if (!GUILD.test(p)) return B.watch(p, fn, q);
    const w = { path: p, fn, q };
    watchers.add(w);
    S.ready.then(() => { if (watchers.has(w)) tell(w); });
    return () => watchers.delete(w);
  };
  // the server's record: ready once the world is in; every change of self.social tells the watchers
  O.on('snapshot', (st) => {
    const s = st && st.self;
    if (!s) return;
    if (!myId && s.id) { myId = s.id; B.ready.then(() => readyRes(S.kind)); }
    if (s.social && s.social !== social) {
      social = s.social;
      for (const w of watchers) tell(w);
    }
  });
  NC.OnlineStore = { get social() { return social; }, refresh: () => { for (const w of watchers) tell(w); } };
})();
