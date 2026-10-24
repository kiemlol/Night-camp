/* online/conn.js — the online game's connection to the Go/Nakama server (NC.Online), the browser's twin of the Unity
   client's NightCampConnection: the account (this browser's device, a username, a beta key), the server's release
   gate (/nc/update: content and protocol versions), nc_status, nc_join, the map's match, its snapshots (op 101: full or
   delta, merged here exactly as backend delta.go writes them), events (102), pongs (103), map transfers (104) and
   reconnects with back-off. Nothing here plays the game: online/world.js shows what the snapshots say and
   online/input.js sends what the player presses.
   Wire (backend match.go): client -> server 1 move {dx,dy,aim,running}, 2 attack {aim,targetId}, 3 skill {skillId,aim,
   targetX,targetY,targetId}, 4 pickup {lootId[,kind]}, 5 warp {portalId}, 6 action {action,…}, 7 ping {id,clientTime},
   8 device check answer; every command carries seq, which snapshots acknowledge as ackSeq.
   Events: NC.Online.on('snapshot' | 'event' | 'status' | 'transfer' | 'chat', fn). */
(function () {
  'use strict';
  const NC = window.NC;
  const N = NC.Nakama;
  const params = new URLSearchParams(location.search);
  const RETRY = [1000, 2000, 4000, 8000, 15000, 15000];
  // Desktop releases have their own minimum, separate from the Unity/native policy.
  // Until a server advertises desktop-* we keep sending its legacy OS identity.
  const DESKTOP = window.NCDesktop && window.NCDesktop.app === 'pc' ? window.NCDesktop : null;
  const WEB_BUILD = 2; // web build 1 was also sent by the installed desktop 1.0.4
  function desktopBuild(version) {
    const parts = /^(\d{1,3})\.(\d{1,2})\.(\d{1,2})(?:[-+].*)?$/.exec(String(version || ''));
    if (!parts) return 0;
    const [, major, minor, patch] = parts.map(Number);
    return major * 10000 + minor * 100 + patch;
  }
  function identity(release) {
    if (!DESKTOP) return { platform: 'web', appBuild: WEB_BUILD, desktop: false, policy: release.platforms && release.platforms.web };
    const os = ['macos', 'windows', 'linux'].includes(DESKTOP.os) ? DESKTOP.os : '';
    const separate = 'desktop-' + os;
    const platform = release.platforms && release.platforms[separate] ? separate : os;
    return { platform, appBuild: desktopBuild(DESKTOP.version), desktop: true,
      policy: release.platforms && release.platforms[platform] };
  }

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } },
  };

  // where the server is: ?online=http://host:7350 (remembered), else the last one, else the local Docker server
  // (?serverkey=… with it is remembered for that server: a real server has its own key, tools/online/prod)
  const keyOf = (url) => 'nightcamp.online.key:' + url;
  // (the 2026-10-18 security audit: a link with ?online=<another server> was remembered for good, so a stranger's link
  // could send the beta key, the password and the device id to their own server.) On a public host only the server the
  // build baked in (index.html <meta name="nc-online-servers">, tools/online/build_web.py --server) may come from a link,
  // https only; online/servers.js still moves between the operator's listed servers. A page on this PC (localhost,
  // file://) takes any server as before.
  const LOCAL_PAGE = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const BAKED = ((document.querySelector('meta[name="nc-online-servers"]') || {}).content || '').split(/[\s,]+/).map((u) => u.replace(/\/+$/, '')).filter(Boolean);
  const urlServerOk = (o) => LOCAL_PAGE || (/^https:\/\//.test(o) && BAKED.includes(o));
  let refusedServer = null;
  function serverOrigin() {
    let o = params.get('online');
    if (o && /^https?:\/\//.test(o)) {
      o = o.replace(/\/+$/, '');
      if (!urlServerOk(o)) refusedServer = o; // (not used, not remembered: online/lobby.js says so on the key window)
      else {
        store.set('nightcamp.online.server', o);
        if (params.get('serverkey')) store.set(keyOf(o), params.get('serverkey'));
      }
    }
    o = store.get('nightcamp.online.server', null);
    return o || 'http://127.0.0.1:7350';
  }
  // a server's key: the one remembered for it, else the local test server's (js/online/servers.js asks it per server)
  const keyFor = (url) => store.get(keyOf(String(url || '').replace(/\/+$/, '')), null) || store.get('nightcamp.online.key', null) || 'nightcamp-local-key';
  const serverKey = () => (params.get('serverkey') && !refusedServer ? params.get('serverkey') : null) || keyFor(serverOrigin());
  function deviceId() {
    let id = store.get('nightcamp.online.device', null);
    if (!id || id.length < 10) {
      id = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '');
      store.set('nightcamp.online.device', id);
    }
    return id;
  }

  // ---------------- the snapshot merge (backend delta.go; Unity SnapshotMerger.cs) ----------------
  const dropNulls = (o) => { for (const k in o) if (o[k] === null) delete o[k]; return o; };
  function mergeSnapshot(state, pk) {
    if (!pk || typeof pk.mapId !== 'string' || typeof pk.channelId !== 'string') throw new Error('snapshot without map/channel');
    if (pk.full !== false) {
      if (!pk.self || typeof pk.self !== 'object') throw new Error('full snapshot without self');
      dropNulls(pk.self);
      pk.players = (pk.players || []).map(dropNulls);
      pk.monsters = (pk.monsters || []).map(dropNulls);
      pk.loot = pk.loot || [];
      pk._selfChanged = true;
      return pk;
    }
    if (!state || state.mapId !== pk.mapId || state.channelId !== pk.channelId) throw new Error('delta without a full snapshot');
    for (const k in pk) {
      if (k === 'self' || k === 'players' || k === 'monsters' || k === 'removedPlayers' || k === 'removedMonsters' || k === 'full') continue;
      state[k] = pk[k];
    }
    state._selfChanged = false;
    if (pk.self) {
      state.self = state.self || {};
      for (const k in pk.self) {
        if (k !== 'id') state._selfChanged = true;
        if (pk.self[k] === null) delete state.self[k]; else state.self[k] = pk.self[k];
      }
    }
    for (const [key, rem] of [['players', 'removedPlayers'], ['monsters', 'removedMonsters']]) {
      let list = state[key] || (state[key] = []);
      if (pk[rem] && pk[rem].length) { const gone = new Set(pk[rem]); list = state[key] = list.filter((e) => !gone.has(e.id)); }
      if (pk[key] && pk[key].length) {
        const index = new Map(list.map((e) => [e.id, e]));
        for (const ch of pk[key]) {
          const e = index.get(ch.id);
          if (!e) { list.push(dropNulls(ch)); index.set(ch.id, ch); continue; }
          for (const k in ch) { if (ch[k] === null) delete e[k]; else e[k] = ch[k]; }
        }
      }
    }
    return state;
  }

  // ---------------- the connection ----------------
  const O = (NC.Online = {
    enabled: params.has('online'),
    status: 'offline', client: null, session: null, socket: null, matchId: null, snap: null, serverStatus: null,
    release: null, clientIdentity: null, mandatoryUpdate: null, releaseCheckedAt: 0,
    userId: null, seq: 0, rtt: null, lastSnapAt: 0, account: null,
    handlers: {}, mergeSnapshot, store, keyFor,
    on(ev, fn) { (this.handlers[ev] || (this.handlers[ev] = [])).push(fn); },
    emit(ev, a, b) { for (const fn of this.handlers[ev] || []) { try { fn(a, b); } catch (e) { console.warn('online: ' + ev, e); } } },
  });
  let gen = 0, retries = 0, firstSnap = null, transferring = false, pingT = null, watchT = null, matchReceiver = null;

  function setStatus(s, why) { if (O.status === s && !why) return; O.status = s; O.emit('status', s, why); }

  // the account to play as on this server: { kind: device|username|key, name, auth, refresh }
  const acctKey = () => 'nightcamp.online.acct:' + O.client.origin;
  O.savedAccount = () => store.get(acctKey(), null);
  function saveAccount(kind, name, s) { store.set(acctKey(), { kind, name: name || '', auth: s.token, refresh: s.refresh }); O.account = { kind, name }; }
  O.forgetAccount = () => store.del(acctKey());

  O.client = new N.Client(serverOrigin(), serverKey());
  O.origin = O.client.origin;
  O.refusedServer = refusedServer; O.localPage = LOCAL_PAGE;

  async function session() {
    let saved = O.savedAccount();
    if (saved && O.keyOnly && saved.kind !== 'key') saved = null; // (the key-only front door, online/lobby.js: other saved ways in wait)
    if (saved && saved.auth) {
      let s = new N.Session(saved.auth, saved.refresh);
      if (!s.expired(60000)) { O.account = { kind: saved.kind, name: saved.name }; return s; }
      if (!s.refreshExpired(60000)) {
        try { s = await O.client.refreshSession(s); saveAccount(saved.kind, saved.name, s); return s; } catch (e) { if (e.status !== 401) throw e; }
      }
      if (saved.kind !== 'device') { O.forgetAccount(); const err = new Error('ต้องเข้าสู่ระบบอีกครั้ง'); err.login = true; throw err; }
    }
    if (O.keyOnly) { const err = new Error('ใส่คีย์เบต้าเพื่อเข้าเล่น'); err.needKey = true; throw err; } // (no device account: the key window asks)
    const s = await O.client.device(deviceId());
    saveAccount('device', '', s);
    return s;
  }
  // logging in on the title: a username (an email on the server) or a beta key
  O.loginUsername = async function (username, password) {
    const name = String(username || '').trim().toLowerCase();
    const s = await O.client.email(name + '@users.nightcamp.invalid', password, false);
    saveAccount('username', name, s); O.session = s; return s;
  };
  O.loginKey = async function (key) {
    const k = normalKey(key);
    if (!k) throw new Error('คีย์ไม่ถูกต้อง');
    const s = await O.client.custom(k, true);
    saveAccount('key', 'คีย์ ' + k.slice(0, 5) + '…', s); O.session = s; return s;
  };
  // a session the server turned down (401) while its own clock says it is fine: a fresh one from the saved refresh
  // token, else the saved way in is forgotten and the player is asked to sign in again (online/lobby.js loadSlots)
  O.renewSession = async function () {
    const saved = O.savedAccount(), s0 = O.session || (saved && saved.auth ? new N.Session(saved.auth, saved.refresh) : null);
    if (!s0 || s0.refreshExpired(30000)) { O.forgetAccount(); const err = new Error('ต้องเข้าสู่ระบบอีกครั้ง'); err.login = true; throw err; }
    try { O.session = await O.client.refreshSession(s0); } catch (e) {
      if (e && e.status === 401) { O.forgetAccount(); O.session = null; const err = new Error('ต้องเข้าสู่ระบบอีกครั้ง'); err.login = true; throw err; }
      throw e;
    }
    if (saved) saveAccount(saved.kind, saved.name, O.session);
    O.userId = O.session.userId;
    return O.session;
  };
  O.logout = async function () { if (O.session) await O.client.logout(O.session); O.forgetAccount(); O.session = null; O.account = null; };
  function normalKey(t) {
    const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    let out = '';
    for (let c of String(t || '').toUpperCase()) {
      if ('- \t\r\n'.includes(c)) continue;
      if (c === 'O') c = '0'; else if (c === 'I' || c === 'L') c = '1';
      if (!A.includes(c) || out.length >= 20) return null;
      out += c;
    }
    return out.length === 20 ? out : null;
  }

  // the release gate (/nc/update): read before the world and again on every reconnect, since a server deploy may bring a
  // new world (contentVersion: nc_join would refuse the old one for good) or protocol (online/update.js: 'release')
  async function readRelease() {
    const prev = O.release, r = await O.client.get('/nc/update');
    if (!r || r.schemaVersion !== 1) throw new Error('เซิร์ฟเวอร์ตอบรุ่นเกมไม่ถูกต้อง');
    O.release = r;
    O.releaseCheckedAt = Date.now();
    O.clientIdentity = identity(r);
    const id = O.clientIdentity, minimum = id.policy && Number(id.policy.minimumBuild);
    O.mandatoryUpdate = id.desktop && (!id.platform || !id.appBuild || (Number.isFinite(minimum) && id.appBuild < minimum))
      ? { platform: id.platform, appBuild: id.appBuild, minimumBuild: minimum || 0, release: id.policy || null }
      : null;
    O.emit('release', r, prev);
    if (O.mandatoryUpdate) {
      const error = new Error('game update required: app');
      error.update = true;
      throw error;
    }
  }
  O.refreshRelease = readRelease;
  // the steps before the world: release gate, session, status (the lobby calls these, then O.play)
  O.prepare = async function () {
    setStatus('connecting');
    await readRelease();
    O.session = await session();
    O.userId = O.session.userId;
    O.serverStatus = await O.client.rpc(O.session, 'nc_status', {});
    if (O.serverStatus && O.serverStatus.closing) throw new Error('เซิร์ฟเวอร์กำลังปิดปรับปรุง');
    setStatus('ready');
    return O.serverStatus;
  };
  // http: over HTTP even with the socket open (a payload or an answer bigger than a socket message: js/bugreport.js)
  O.rpc = async function (id, payload, http) {
    if (!O.session) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
    if (O.session.expired(30000) && !O.session.refreshExpired(30000)) {
      O.session = await O.client.refreshSession(O.session);
      const saved = O.savedAccount();
      if (saved) saveAccount(saved.kind, saved.name, O.session);
    }
    if (!http && O.socket && O.socket.open) return O.socket.rpc(id, payload);
    return O.client.rpc(O.session, id, payload);
  };
  O.characters = () => O.rpc('nc_characters', {});
  O.pickSlot = (slot) => O.rpc('nc_character_slot', { slot });
  O.deleteSlot = (slot, name) => O.rpc('nc_character_slot', { slot, delete: true, name });
  O.createHero = (slot, name, appearance) =>
    O.rpc('nc_character_create', { slot, name, appearance, requestId: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).replace(/[^A-Za-z0-9]/g, '').slice(0, 32) });

  // ---------------- into the world ----------------
  O.play = function (channelId) {
    const my = ++gen;
    retries = 0;
    O.channelId = channelId || '';
    loop(my);
  };
  O.stop = function () {
    gen++;
    closeSocket();
    setStatus('offline');
  };
  function closeSocket() {
    if (matchReceiver) { matchReceiver.close(); matchReceiver = null; }
    clearInterval(pingT); clearInterval(watchT);
    if (O.socket) { O.socket.onclose = null; O.socket.close(); }
    O.socket = null; O.matchId = null; O.snap = null; O.posBinary = false; viewSent = null; posNids.clear();
  }

  async function loop(my) {
    while (my === gen) {
      let why = '';
      try {
        await attempt(my);
        return;
      } catch (e) {
        if (my !== gen) return;
        why = (e && e.message) || 'เชื่อมต่อไม่ได้';
        console.warn('online: connection', e);
        closeSocket();
        const permanent = e && (e.login || e.update || e.status === 401 || /update required|สมัครสมาชิก|คีย์/.test(why));
        if (permanent || retries >= RETRY.length) { setStatus('error', why); O.emit('event', { type: 'connection_error', message: why, retrying: false }); return; }
      }
      setStatus('reconnecting', why);
      O.emit('event', { type: 'connection_error', message: why, retrying: true });
      await new Promise((r) => setTimeout(r, RETRY[retries++]));
    }
  }

  async function attempt(my) {
    if (!O.session || O.session.expired(60000)) await O.prepare();
    else if (retries || !O.release || Date.now() - O.releaseCheckedAt > 30000) await readRelease();
    // A stale lobby cannot enter after the server raises the minimum app build.
    if (O.mandatoryUpdate) { const error = new Error('game update required: app'); error.update = true; throw error; }
    if (my !== gen) return;
    setStatus('connecting');
    const sock = new N.Socket(O.client);
    await sock.connect(O.session);
    if (my !== gen) { sock.close(); return; }
    O.socket = sock;
    sock.onnotification = (n) => { if (my === gen) O.emit('notification', n); };
    const lost = new Promise((resolve) => { sock.onclose = () => resolve('ซ็อกเก็ตปิด'); });
    bindMatchReceiver(sock, my);
    const req = { contentVersion: O.release.contentVersion, platform: O.clientIdentity.platform,
      appBuild: O.clientIdentity.appBuild, protocolVersion: O.release.protocolVersion };
    if (O.channelId) req.channelId = String(O.channelId);
    const join = await sock.rpc('nc_join', req);
    if (!join || !join.matchId) throw new Error('เซิร์ฟเวอร์ไม่ส่งห้องแมพมา');
    O.matchId = join.matchId;
    O.snap = null;
    setStatus('syncing');
    const ready = new Promise((resolve, reject) => { firstSnap = { resolve, reject }; setTimeout(() => reject(new Error('ไม่ได้รับข้อมูลโลกจากเซิร์ฟเวอร์')), 15000); });
    await sock.joinMatch(join.matchId, matchMetadata());
    await ready;
    retries = 0;
    setStatus('online');
    clearInterval(pingT); pingT = setInterval(ping, 5000);
    clearInterval(watchT); watchT = setInterval(() => { if (O.status === 'online' && Date.now() - O.lastSnapAt > 10000) sock.close(); }, 2000);
    const why = await lost;
    if (my === gen) throw new Error(why);
  }

  function matchMetadata() {
    const codec = window.NightCampTransportCodec;
    const meta = codec && codec.supportsTransportCompression() ? { eventBatch: '1', compression: 'zlib1' } : { eventBatch: '1' };
    // (group B, 2026-10-19, online/posbin.js + server patch 006: positions as bytes after the JSON, and the view this
    // screen needs; a server without the patch ignores both)
    if (NC.PosBin) meta.pos = 'bin1';
    const v = viewTold();
    if (v) { meta.view = v; viewSent = v; }
    return meta;
  }
  // the view told to the server: how far this screen reaches (the world drawn round the hero, + walking-in room) and the
  // most other heroes drawn (js/herospine_crowd.js's cap for its quality now; a phone's is lower), "R,N" (N 0 = no cap)
  function viewTold() {
    const g = NC.game;
    if (!g || !(g.vw > 0) || !(g.vh > 0)) return null;
    const r = Math.round(Math.min(1800, Math.max(900, Math.hypot(g.vw, g.vh) / 2 + 350)) / 50) * 50;
    const n = NC.Crowd && NC.Crowd.on && NC.Crowd.cap > 0 ? NC.Crowd.cap : 0;
    return r + ',' + n;
  }
  // a changed view (the window resized, the crowd quality stepped) goes as opcode 9 {r, n}, only to a server that answered
  // the binary wire (patch 006 also reads op 9; an older server would refuse an unknown command). Every second it also
  // carries t, the tick this screen draws the monsters at now (2026-10-21, Discord #129): the server measures how far
  // behind its present that is (the road both ways + js/netsmooth.js's render delay) and strikes this hero's arrows and
  // bullets on the monsters where they were drawn, at most 0.5 s back (server patch 026 lag_comp.go). An older server
  // reads only r and n.
  let viewSent = null;
  setInterval(() => {
    if (!O.socket || !O.matchId || O.status !== 'online' || !O.posBinary) return;
    const v = viewTold();
    if (!v) return;
    const t = drawnTick();
    if (v === viewSent && t == null) return;
    const [r, n] = v.split(',').map(Number);
    if (O.socket.sendMatch(O.matchId, 9, t == null ? { r, n } : { r, n, t })) viewSent = v;
  }, 1000);
  // the tick the monsters are drawn at now on this match's clock (NetSmooth's render moment / the server's 50 ms tick);
  // null while NetSmooth has no clock for this match yet (a map change on its way)
  function drawnTick() {
    const S = NC.NetSmooth, tick = O.snap && O.snap.tick;
    if (!S || !S.K || S.K.off == null || typeof tick !== 'number') return null;
    const t = S.renderTime() / 50;
    return isFinite(t) && Math.abs(t - tick) < 30 ? Math.round(t * 10) / 10 : null;
  }
  function bindMatchReceiver(sock, my) {
    // Channel switches also call the socket directly. Capabilities belong to
    // every join on this connection, including those outside conn.js.
    if (typeof sock.joinMatch === 'function') {
      const join = sock.joinMatch.bind(sock);
      sock.joinMatch = (id, metadata) => {
        const capabilities = matchMetadata(), next = { ...metadata, ...capabilities };
        if (!capabilities.compression) delete next.compression;
        return join(id, next);
      };
    }
    if (matchReceiver) matchReceiver.close();
    const codec = window.NightCampTransportCodec;
    if (!codec) { sock.onmatchdata = m => { if (my === gen && O.socket === sock) receive(m); }; return; }
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const receiver = codec.createOrderedMatchReceiver({
      isCurrent: () => my === gen && O.socket === sock,
      deliver: frame => receive({ ...frame, text: posFrame(frame) ? '' : frame.compressed || typeof frame.text !== 'string' ? decoder.decode(frame.bytes) : frame.text }),
      onError: error => {
        if (my !== gen || O.socket !== sock) return;
        console.warn('online: match transport', error);
        sock.close(); // a reconnect starts with a complete snapshot, never a partially decoded delta
      },
    });
    matchReceiver = receiver;
    sock.onmatchdata = frame => { if (my === gen && O.socket === sock) return receiver.enqueue(frame); };
    const lost = sock.onclose, close = sock.close.bind(sock);
    let localClose = false, closeNotified = false, drainTimer = null;
    const finishClose = (...args) => {
      if (closeNotified) return;
      closeNotified = true;
      if (drainTimer !== null) clearTimeout(drainTimer);
      receiver.close();
      if (my === gen && O.socket === sock && lost) lost(...args);
    };
    sock.close = (...args) => { localClose = true; receiver.close(); return close(...args); };
    sock.onclose = (...args) => {
      if (localClose || my !== gen || O.socket !== sock) { finishClose(...args); return; }
      // A server can send its compressed terminal notice immediately before
      // closing. Decode received frames before reconnecting; a local stop still
      // cancels at once, and an old completion cannot revive a new connection.
      drainTimer = setTimeout(() => finishClose(...args), 2000);
      void receiver.drain().then(() => finishClose(...args), () => finishClose(...args));
    };
  }

  const pings = new Map();
  function ping() {
    if (!O.socket || !O.matchId) return;
    const id = Math.random().toString(36).slice(2, 12);
    pings.set(id, performance.now());
    if (pings.size > 16) pings.delete(pings.keys().next().value);
    O.socket.sendMatch(O.matchId, 7, { id, clientTime: Date.now() });
  }

  // a snapshot frame with the positions block (online/posbin.js): its first byte is the version, a JSON one starts with '{'
  const posFrame = (m) => m.op === 101 && !!NC.PosBin && !!m.bytes && m.bytes.length > 0 && m.bytes[0] === NC.PosBin.VERSION;
  const utf8 = new TextDecoder('utf-8', { fatal: true });
  const posNids = new Map(); // (the rows' numbers on this connection: online/posbin.js apply)
  function receive(m) {
    if (m.matchId !== O.matchId) return;
    let j, block = null;
    try {
      if (posFrame(m)) { const f = NC.PosBin.split(m.bytes); j = JSON.parse(utf8.decode(f.json)); block = f.block; O.posBinary = true; }
      else j = JSON.parse(m.text);
    } catch (e) { if (m.compressed) throw e; console.warn('online: bad json', m.op); if (posFrame(m) && O.socket) O.socket.close(); return; }
    if (m.op === 101) {
      try {
        if (block) NC.PosBin.apply(j, block, posNids); // (the positions back into the rows: the same packet the JSON wire gives)
        O.snap = mergeSnapshot(O.snap, j);
      } catch (e) { console.warn('online: snapshot', e); if (O.socket) O.socket.close(); return; }
      O.lastSnapAt = Date.now();
      if (j.bag !== undefined) O.bag = j.bag;
      if (j.store !== undefined) O.storage = j.store;
      if (firstSnap) { firstSnap.resolve(); firstSnap = null; }
      if (transferring) { transferring = false; O.emit('transfer', O.snap); }
      O.emit('snapshot', O.snap, j);
    } else if (m.op === 102) {
      const events = j?.type === 'eventBatch' ? j.events : [j];
      if (!Array.isArray(events) || events.length > 128 || events.some((e) => !e || typeof e !== 'object' || Array.isArray(e) || typeof e.type !== 'string' || e.type === 'eventBatch')) {
        if (m.compressed) throw new Error('Invalid compressed event batch');
        console.warn('online: invalid event batch'); return;
      }
      const current = gen;
      for (const e of events) {
        if (e.type === 'session_replaced' || e.type === 'login_key_required') {
          gen++; closeSocket(); setStatus('error', e.type === 'session_replaced' ? 'บัญชีนี้เข้าสู่ระบบจากที่อื่นแล้ว' : 'ต้องใช้คีย์ที่ใช้งานได้');
        }
        O.emit('event', e);
        if (gen !== current) break;
      }
    } else if (m.op === 103) {
      const t = pings.get(j.id);
      if (t != null) { pings.delete(j.id); O.rtt = performance.now() - t; }
    } else if (m.op === 104) {
      transfer(j.matchId);
    } else if (m.op === 105) {
      // the device check (backend attest_match.go): a browser has no device key; the server's mode decides
    }
  }

  async function transfer(target) {
    if (!target || target === O.matchId || !O.socket) return;
    const prev = O.matchId, sock = O.socket;
    O.matchId = target; O.snap = null; transferring = true;
    setStatus('transferring');
    O.emit('transferring', target);
    try {
      await sock.leaveMatch(prev);
      await sock.joinMatch(target, matchMetadata());
      setStatus('online');
    } catch (e) { console.warn('online: transfer', e); sock.close(); }
  }

  // ---------------- commands ----------------
  function send(op, fields) {
    if (op === 6 && fields.action === 'gm') return false;
    if (!O.socket || !O.matchId || O.status !== 'online') return false;
    fields.seq = ++O.seq;
    return O.socket.sendMatch(O.matchId, op, fields);
  }
  const fin = (v) => (Number.isFinite(v) ? v : 0);
  const aimOf = (a) => { a = fin(a); while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return +a.toFixed(4); };
  O.move = (dx, dy, aim, running) => send(1, { dx: +fin(dx).toFixed(3), dy: +fin(dy).toFixed(3), aim: aimOf(aim), running: !!running });
  O.attack = (aim, targetId) => send(2, targetId ? { aim: aimOf(aim), targetId } : { aim: aimOf(aim) });
  O.skill = (skillId, aim, tx, ty, targetId) => {
    const f = { skillId, aim: aimOf(aim) };
    if (Number.isFinite(tx) && Number.isFinite(ty)) { f.targetX = Math.round(tx); f.targetY = Math.round(ty); }
    if (targetId) f.targetId = targetId;
    return send(3, f);
  };
  O.pickup = (lootId, kind) => send(4, kind ? { lootId, kind } : { lootId });
  O.warp = (portalId) => send(5, { portalId });
  O.action = (fields) => send(6, Object.assign({}, fields));
  O.supports = (skillId) => !!(O.serverStatus && (O.serverStatus.supportedSkills || []).includes(skillId));
})();
