/* store.js — what every player should see the same: the leaderboard and the guilds (the user, 2026-10-01: "ทำระบบ guild
   และ leader board"). Documents at slash paths, a shape copied from the Claude Artifact's db capability:
     online      the game published as an Artifact with capabilities {db, user}: it IS that db (shared by everyone the
                 Artifact is shared with; they must be Contributors to write). See README "กิลด์ อันดับ ปาร์ตี้".
     localhost   a stand-in kept in this browser (localStorage, one key 'ncs:<path>' per document), live across its
                 tabs (BroadcastChannel), so two ?netmock tabs see each other's writes. One browser = one shared world.
   NC.Store.ready -> Promise (the backend picked); NC.Store.kind 'db' | 'local'; NC.Store.me() -> this player's id (the
   account's id online; on localhost one per browser, one per tab with ?netmock, or ?uid=...).
   get(path) -> data | null · set(path, data) · update(path, data) (merges; makes the doc when missing) · del(path) ·
   query(coll, { where: [[field, op, value]], order: [field, 'asc' | 'desc'], limit }) -> [{ id, data }] ·
   watch(path or coll, fn, query) -> unsubscribe (a doc: fn(data | null); a collection: fn([{ id, data }])) ·
   claim(path, data) -> true when the doc was free and is now ours (a unique name: lease, read, write).
   Writes to one doc go one at a time (the db asks for it) and only when the data changed. */
(function () {
  'use strict';
  const NC = window.NC;
  const IDKEY = 'nightcamp.uid';
  const S = (NC.Store = { kind: 'local' });
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const segs = (p) => String(p).split('/').filter(Boolean);
  const isDoc = (p) => segs(p).length % 2 === 0;
  const merge = (a, b) => {
    const o = Object.assign({}, a);
    for (const k in b) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? merge(o[k], b[k]) : b[k];
    return o;
  };
  const cmp = (op) => ({
    '==': (a, b) => a === b, '!=': (a, b) => a !== b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
    in: (a, b) => (b || []).includes(a), 'not-in': (a, b) => !(b || []).includes(a), 'array-contains': (a, b) => Array.isArray(a) && a.includes(b),
  })[op] || (() => false);

  // ---------------- who I am ----------------
  let myId = null;
  S.me = () => myId;
  function localId() {
    const store = localStorage;
    try {
      let id = store.getItem(IDKEY);
      if (!id) { id = 'u' + Math.random().toString(36).slice(2, 10); store.setItem(IDKEY, id); }
      return id;
    } catch (e) { return 'u' + Math.random().toString(36).slice(2, 10); }
  }

  // ---------------- the local stand-in ----------------
  // one localStorage key per document ('ncs:' + path), read fresh on every call: tabs writing at the same moment touch
  // only their own documents (a single shared blob let one tab's stale copy wipe another's writes)
  const PRE = 'ncs:';
  const rd = (p) => { try { const v = localStorage.getItem(PRE + p); return v == null ? null : JSON.parse(v); } catch (e) { return null; } };
  const wr = (p, d) => { try { if (d == null) localStorage.removeItem(PRE + p); else localStorage.setItem(PRE + p, JSON.stringify(d)); } catch (e) { /* full or blocked */ } };
  let bc = null;
  try { bc = new BroadcastChannel('nightcamp.store'); } catch (e) { /* old browser */ }
  const watchers = new Set();
  const fireAll = () => { for (const w of watchers) w(); };
  if (bc) bc.onmessage = () => fireAll(); // (another tab wrote: read again)
  const runQuery = (coll, q) => {
    const n = segs(coll).length + 1, pre = PRE + segs(coll).join('/') + '/', rows = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(pre)) continue;
      const path = k.slice(PRE.length);
      if (segs(path).length !== n) continue;
      const d = rd(path);
      if (d) rows.push({ id: segs(path)[n - 1], data: d });
    }
    let out = rows;
    for (const [f, op, v] of (q && q.where) || []) out = out.filter((r) => cmp(op)(r.data[f], v));
    if (q && q.order) {
      const [f, dir] = q.order, k = dir === 'desc' ? -1 : 1;
      out.sort((a, b) => (a.data[f] === undefined ? 1 : b.data[f] === undefined ? -1 : a.data[f] < b.data[f] ? -k : a.data[f] > b.data[f] ? k : 0));
    } else out.sort((a, b) => (a.id < b.id ? -1 : 1));
    return q && q.limit ? out.slice(0, q.limit) : out;
  };
  const changed = (p) => { if (bc) bc.postMessage(p); fireAll(); };
  const local = {
    get: async (p) => rd(p),
    set: async (p, d) => { wr(p, clone(d)); changed(p); },
    update: async (p, d) => { wr(p, merge(rd(p) || {}, clone(d))); changed(p); },
    del: async (p) => { wr(p, null); changed(p); },
    query: async (c, q) => runQuery(c, q),
    watch(p, fn, q) {
      let last = '';
      const w = () => { const v = isDoc(p) ? rd(p) : runQuery(p, q), s2 = JSON.stringify(v); if (s2 !== last) { last = s2; fn(clone(v)); } };
      watchers.add(w); setTimeout(w, 0);
      return () => watchers.delete(w);
    },
    claim: async (p, d) => { if (rd(p)) return false; wr(p, clone(d)); changed(p); return true; },
  };

  // ---------------- the Artifact's db ----------------
  function online(db) {
    const qOf = (c, q) => {
      let r = db.collection(c);
      for (const [f, op, v] of (q && q.where) || []) r = r.where(f, op, v);
      if (q && q.order) r = r.orderBy(q.order[0], q.order[1] || 'asc');
      if (q && q.limit) r = r.limit(q.limit);
      return r;
    };
    const rows = (qs) => qs.docs.map((d) => ({ id: d.id, data: d.data() ? clone(d.data()) : {} }));
    return {
      get: async (p) => { const s = await db.doc(p).get(); return s.exists ? clone(s.data()) : null; },
      set: (p, d) => db.doc(p).set(clone(d)),
      update: async (p, d) => { const r = db.doc(p), s = await r.get(); return s.exists ? r.update(clone(d)) : r.set(clone(d)); },
      del: (p) => db.doc(p).delete(),
      query: async (c, q) => rows(await qOf(c, q).get()),
      watch(p, fn, q) {
        const err = (e) => console.warn('store: watch', p, e && e.code);
        return isDoc(p) ? db.doc(p).onSnapshot((s) => fn(s.exists ? clone(s.data()) : null), err) : qOf(p, q).onSnapshot((qs) => fn(rows(qs)), err);
      },
      async claim(p, d) {
        const r = db.doc(p), lease = await r.acquire({ holder: myId, ttlMs: 5000 });
        if (!lease.acquired) return false;
        const s = await r.get();
        if (s.exists && s.data() && s.data().owner) return false;
        await r.set(clone(d));
        return true;
      },
    };
  }

  // ---------------- the backend, and the writes one at a time per doc ----------------
  let B = local;
  const lastW = new Map(), chain = new Map();
  const queue = (p, f) => { const prev = chain.get(p) || Promise.resolve(); const next = prev.catch(() => {}).then(f); chain.set(p, next); return next; };
  S.ready = (async () => {
    try {
      const use = window.claude && window.claude.use;
      if (use) {
        const db = await Promise.race([window.claude.use('db'), new Promise((r) => setTimeout(() => r(null), 8000))]);
        const user = db && (await window.claude.use('user'));
        const id = user && (await user.id());
        if (db && id) { B = online(db); S.kind = 'db'; myId = id; return S.kind; }
      }
    } catch (e) { console.warn('store: no db, local', e); }
    myId = localId();
    return S.kind;
  })();
  S.get = async (p) => { await S.ready; return B.get(p); };
  S.set = async (p, d) => { await S.ready; const s = JSON.stringify(d); if (lastW.get(p) === s) return; lastW.set(p, s); return queue(p, () => B.set(p, d)); };
  S.update = async (p, d) => { await S.ready; lastW.delete(p); return queue(p, () => B.update(p, d)); };
  S.del = async (p) => { await S.ready; lastW.delete(p); return queue(p, () => B.del(p)); };
  S.query = async (c, q) => { await S.ready; return B.query(c, q); };
  S.watch = (p, fn, q) => { let off = null, dead = false; S.ready.then(() => { if (!dead) off = B.watch(p, fn, q); }); return () => { dead = true; if (off) off(); }; };
  S.claim = async (p, d) => { await S.ready; return B.claim(p, d); };
})();
