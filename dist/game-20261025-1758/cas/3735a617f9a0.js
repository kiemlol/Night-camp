/* online/servers.js — choosing the game server in the online game (?online): NC.OnlineServers.
   Every Go server is its own world: its own database, heroes, guilds and rankings; heroes never move between servers
   (the owner, backend server_directory.go: few servers, a new one opens only when the last is full). Any server serves
   GET /nc/servers, the operator's list {self, servers: [{id, no, name, url, status open|maintenance, tags new|recommended,
   opened}]} (only https origins), and GET /nc/load, how full it is {population, capacity, state smooth|busy|full|
   maintenance}. This file merges that list with the servers this browser knows (the local Docker server when the page
   runs on localhost, the one it plays on now), reads each one's light and ping, remembers how many heroes the account
   has on each (from the lobby's nc_characters, per server: conn.js keeps one account per server origin), and moves the
   client to another server (in place before the world was entered, else a reload of the page).
   The page that shows all this comes from the user's pick (assets/gen/make_chsrv_prompts.py a / b / c). */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online;
  if (!O || !O.enabled) return;
  const N = NC.Nakama, store = O.store;
  const KEY_SERVER = 'nightcamp.online.server', KEY_HEROES = 'nightcamp.online.heroes:', KEY_LAST = 'nightcamp.online.lastPlayed';
  const LOCAL_URL = location.origin;
  const onLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const S = (NC.OnlineServers = {});
  const norm = (u) => String(u || '').replace(/\/+$/, '');

  // GET a server's own path without an account (the list and the light are public)
  async function get(url, path, ms) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 5000);
    try {
      const res = await fetch(norm(url) + path, { signal: ctl.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally { clearTimeout(t); }
  }

  // ---------------- the list ----------------
  S.list = async function () {
    const out = [], byUrl = new Map();
    const add = (e, from) => {
      const url = norm(e.url);
      if (!url || byUrl.has(url)) return;
      const s = { id: e.id || url, no: e.no | 0, name: e.name || url.replace(/^https?:\/\//, ''), url, status: e.status || 'open', tags: e.tags || [], opened: e.opened || '', from };
      byUrl.set(url, s); out.push(s);
    };
    let self = '';
    try {
      const d = await get(O.origin, '/nc/servers');
      self = d.self || '';
      for (const e of d.servers || []) add(e, 'list');
    } catch (e) { /* this server has no list: the known ones below */ }
    // the server we are on: when the operator's list names it (self), its row is the one with our origin or that id
    // (the list may name it by another address of the same server, e.g. the CDN's own domain behind api.nightcamp.app)
    const mine = out.find((s) => s.url === O.origin) || (self && out.find((s) => s.id === self));
    if (mine && mine.url !== O.origin) { byUrl.delete(mine.url); mine.url = O.origin; byUrl.set(O.origin, mine); }
    if (!byUrl.has(O.origin)) add({ id: self || 'here', no: 0, name: O.origin === LOCAL_URL ? 'เซิร์ฟเวอร์ทดสอบในเครื่อง' : O.origin.replace(/^https?:\/\//, ''), url: O.origin }, 'here');
    if (onLocalhost && !byUrl.has(LOCAL_URL)) add({ id: 'local', no: 0, name: 'เซิร์ฟเวอร์ทดสอบในเครื่อง', url: LOCAL_URL }, 'local');
    out.sort((a, b) => (a.no || 999) - (b.no || 999));
    const last = store.get(KEY_LAST, null);
    for (const s of out) { s.current = s.url === O.origin; s.heroes = S.heroesOn(s.url); s.lastPlayed = !!last && last.url === s.url; }
    return out;
  };

  // one server's light: the operator's maintenance wins, else /nc/load's state; ping = the fastest of two reads
  S.load = async function (s) {
    if (s.status === 'maintenance') return Object.assign(s, { state: 'maintenance', ms: null });
    let best = Infinity, j = null;
    for (let i = 0; i < 2; i++) {
      const t0 = performance.now();
      try { j = await get(s.url, '/nc/load', 4000); best = Math.min(best, performance.now() - t0); } catch (e) { break; }
    }
    if (!j) return Object.assign(s, { state: 'offline', ms: null });
    return Object.assign(s, { state: j.state || 'smooth', population: j.population | 0, capacity: j.capacity | 0, ms: Math.round(best) });
  };
  S.loadAll = async function () { const list = await S.list(); await Promise.all(list.map(S.load)); return list; };

  // ---------------- the account's heroes on each server ----------------
  S.heroesOn = (url) => store.get(KEY_HEROES + norm(url), null); // { n, heroes: [{name, lv, job}], at } or null
  function keep(url, r) {
    if (!r || !Array.isArray(r.slots)) return;
    const heroes = r.slots.filter((s) => !s.empty).map((s) => ({ name: s.name, lv: s.lv | 0, job: s.job || '', look: s.look || null, appearance: s.appearance || null, equip: s.equip || null }));
    store.set(KEY_HEROES + norm(url), { n: heroes.length, heroes, at: Date.now() });
  }
  const baseChars = O.characters;
  O.characters = async function () { const r = await baseChars.apply(this, arguments); keep(O.origin, r); return r; };
  const baseCreate = O.createHero;
  O.createHero = async function () { const r = await baseCreate.apply(this, arguments); keep(O.origin, r); return r; };
  const baseDelete = O.deleteSlot;
  O.deleteSlot = async function () { const r = await baseDelete.apply(this, arguments); keep(O.origin, r); return r; };

  O.on('status', (s) => { if (s === 'online') store.set(KEY_LAST, { url: O.origin, at: Date.now() }); }); // (the "last played" chip)

  // ---------------- moving to another server ----------------
  S.current = () => O.origin;
  S.pick = function (s) {
    const url = norm(s && s.url);
    if (!url || url === O.origin) return false;
    if (s.state === 'maintenance' || s.status === 'maintenance') throw new Error('เซิร์ฟเวอร์นี้ปิดปรับปรุงอยู่');
    store.set(KEY_SERVER, url);
    const entered = NC.OnlineWorld && NC.OnlineWorld.ready;
    const page = NC.PAGE || { path: location.pathname, search: location.search, hash: location.hash }; // (boot.js: the address bar may show only the site root)
    const q = new URLSearchParams(page.search);
    if (entered || /^https?:/.test(q.get('online') || '')) { // a world of the old server is loaded: start the page again
      q.set('online', '');
      location.href = page.path + '?' + q.toString().replace(/=(&|$)/g, '$1') + page.hash;
      return true;
    }
    O.stop();
    O.session = null; O.serverStatus = null; O.release = null; O.account = null;
    O.client = new N.Client(url, O.keyFor ? O.keyFor(url) : O.client.serverKey); // (each server its own key: conn.js)
    O.origin = url;
    O.emit('server', url);
    if (NC.OnlineLobby) NC.OnlineLobby.restart();
    return true;
  };
})();
