/* online/channels.js — moving between a map's channels (ช่อง) in the online game (?online): NC.OnlineChannels.
   Every map of the Go server opens several channels, copies of the map with their own heroes and monsters (backend
   channels.go: NC_CHANNELS x NC_CHANNEL_CAP; 4 x 60 on the test server, 32 x 40 when unset). The owner (server_directory.go):
   heroes never move between servers, channels switch freely. The server has no in-match "change channel" command:
   nc_join takes {channelId} once the hero has left the map's match (main.go join: "leave current session before channel
   change" until the old room's last save has landed). So a move here = leave the match on the same socket, ask nc_join
   for the channel (again while the old room still saves), join the new match. The hero keeps the spot and everything.
   A full channel ("channel full; choose another channel") puts the hero back in the channel he came from.
   How full each channel is: Nakama's match list (GET /v2/match, the rooms' labels {mapId, channelId} and sizes).
   How many channels: nc_status.channels {count, cap} if the server ever sends it, else the bound in nc_join's answer
   to channel 33 ("channel must be 1..N"; always out of range, maxChannels is 32). Capacity stays unknown until reported.
   Events: NC.Online.on('channel', fn({ state: 'moving' | 'done' | 'refused' | 'failed', from, to, now, message })).
   The window that shows all this is online/chwin.js (the user's pick F of assets/gen/make_chsrv_prompts.py). */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online;
  if (!O || !O.enabled) return;
  const COOLDOWN = 5000;   // ms between two moves
  const FIGHT = 5;         // s after the last swing, cast or hit
  const MAX = 32;          // backend maxChannels
  const C = (NC.OnlineChannels = { busy: false, lastMove: 0 });

  C.current = () => (O.snap ? String(O.snap.channelId) : '');
  C.mapId = () => (O.snap ? O.snap.mapId : '');
  // Every nc_join, including a channel switch, uses the identity checked by conn.js.
  const ident = () => ({ contentVersion: O.release.contentVersion, platform: O.clientIdentity.platform,
    appBuild: O.clientIdentity.appBuild, protocolVersion: O.release.protocolVersion });
  function setStatus(s) { O.status = s; O.emit('status', s); }

  // ---------------- how many channels, how full ----------------
  const layouts = {}; // per server origin
  C.layout = async function () {
    const origin = O.origin;
    const s = O.serverStatus && O.serverStatus.channels;
    if (s && s.count > 0) {
      const capKnown = Number.isInteger(s.cap) && s.cap > 0;
      return { count: s.count | 0, cap: capKnown ? s.cap : null, capKnown };
    }
    if (layouts[origin]) return layouts[origin];
    let count = 0;
    try {
      await O.refreshRelease(); // an old server needs a join probe; use the current minimum first
      await O.rpc('nc_join', Object.assign(ident(), { channelId: String(MAX + 1) }));
    } catch (e) { const m = /1\.\.(\d+)/.exec((e && e.message) || ''); if (m) count = +m[1]; }
    if (!count) return { count: Math.max(1, +C.current() || 1), cap: null, capKnown: false };
    return (layouts[origin] = { count, cap: null, capKnown: false });
  };
  const fullSeen = new Map(); // server + map + channel -> last server-confirmed full response (shown for 30 s)
  const fullKey = (origin, mapId, ch) => JSON.stringify([origin, mapId, ch]);
  C.loads = async function (mapId) {
    const origin = O.origin, client = O.client;
    mapId = mapId || C.mapId();
    // (no map yet, e.g. between a reconnect and its first full snapshot: Nakama's list refuses "+label.mapId:" with a
    // syntax error, 2 a second from the open channel windows after the 2026-10-24 switch; the window shows its estimate)
    if (!mapId) throw new Error('ยังไม่รู้ว่าอยู่แมพไหน');
    const L = await C.layout();
    if (O.origin !== origin || O.client !== client) throw new Error('เปลี่ยนเซิร์ฟเวอร์ระหว่างโหลดช่อง');
    if (O.session.expired(30000)) await O.rpc('nc_status', {}); // (O.rpc refreshes the session and keeps it)
    // (Nakama's label query: a quoted term finds nothing, the bare id does; other characters escaped. The rows are checked below.)
    const q = new URLSearchParams({ limit: '100', authoritative: 'true', query: '+label.mapId:' + String(mapId).replace(/[^\w]/g, (c) => '\\' + c) });
    if (O.origin !== origin || O.client !== client) throw new Error('เปลี่ยนเซิร์ฟเวอร์ระหว่างโหลดช่อง');
    const j = await client.http('GET', '/v2/match?' + q, undefined, 'Bearer ' + O.session.token);
    if (O.origin !== origin || O.client !== client) throw new Error('เปลี่ยนเซิร์ฟเวอร์ระหว่างโหลดช่อง');
    const n = {};
    for (const m of (j && j.matches) || []) {
      let lb;
      try { lb = JSON.parse(m.label || '{}'); } catch (e) { continue; }
      if (lb.mapId !== mapId || lb.mode || !/^\d+$/.test(lb.channelId || '')) continue; // (PvP rooms, Boss Trials)
      n[lb.channelId] = (n[lb.channelId] || 0) + (m.size | 0);
    }
    const cap = L.cap;
    const here = C.current(), channels = [];
    for (let i = 1; i <= L.count; i++) {
      const ch = String(i), heroes = n[ch] || 0;
      const key = fullKey(origin, mapId, ch), seen = fullSeen.get(key);
      const recentFull = seen !== undefined && Date.now() - seen < 30000;
      if (seen !== undefined && !recentFull) fullSeen.delete(key);
      const full = (L.capKnown && heroes >= cap) || recentFull;
      channels.push({ ch, heroes, cap, full, here: ch === here, level: full ? 'full' : heroes === 0 ? 'empty' : L.capKnown && heroes >= cap * 0.75 ? 'busy' : L.capKnown && heroes >= cap * 0.4 ? 'mid' : 'quiet' });
    }
    return { mapId, count: L.count, cap, capKnown: L.capKnown, here, channels, at: Date.now() };
  };

  // ---------------- may the hero move now ----------------
  C.why = function (ch) {
    ch = String(ch == null ? '' : ch);
    if (O.status !== 'online' || !O.snap || !O.socket || !O.socket.open) return 'ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์';
    if (C.busy) return 'กำลังย้ายแชนแนลอยู่';
    if (!/^\d+$/.test(ch) || +ch < 1 || +ch > MAX) return 'ไม่มีแชนแนลนี้';
    if (ch === C.current()) return 'อยู่ช่องนี้แล้ว';
    const W = NC.OnlineWorld, g = W && W.game, p = g && g.player, s = O.snap.self || {};
    const id = C.mapId(), def = (NC.MAPS || {})[id] || {};
    if (s.dead > 0 || (p && p.dead > 0)) return 'ฟื้นก่อนแล้วค่อยย้ายแชนแนล';
    if (/^(tower_|root_|pvp_)/.test(id) || def.pvp || def.arena || def.gwar) return 'แมพนี้ย้ายแชนแนลไม่ได้'; // (Dark Root, the tower, PvP, a guild war land: one room each)
    if (s.pvp || s.duel) return 'กำลังดวลอยู่ ย้ายแชนแนลไม่ได้';
    const left = Math.ceil((C.lastMove + COOLDOWN - Date.now()) / 1000);
    if (left > 0) return `รออีก ${left} วินาที`;
    if (p && g && g.time - (p.lastFight == null ? -99 : p.lastFight) < FIGHT) return 'ออกจากการต่อสู้ก่อนสักครู่';
    if (p && (p.cast || p.castHold)) return 'รอร่ายเวทจบก่อน';
    return '';
  };

  // ---------------- the move ----------------
  let move = null;
  const disconnected = () => new Error('การเชื่อมต่อหลุดระหว่างย้ายช่อง');
  // One lifetime for the whole move: even an SDK leave/RPC/join promise that never settles must be cancellable.
  // Every continuation checks ownership so a late answer cannot replace a newer connection's room.
  function beginMove(sock, origin, selfId) {
    let reject, resolveSnapshot, timer;
    const failed = new Promise((_, r) => { reject = r; });
    failed.catch(() => {}); // cancellation can arrive before the next SDK promise is awaited
    const delays = new Set();
    const tx = {
      sock, origin, selfId, expected: null, error: null,
      snapshot: new Promise((r) => { resolveSnapshot = r; }),
      fail(e) { if (!tx.error) { tx.error = e; reject(e); } },
      check() {
        if (tx.error) throw tx.error;
        if (move !== tx || O.socket !== sock || O.origin !== origin || !sock.open || O.status !== 'channel') throw disconnected();
      },
      async wait(p) { const value = await Promise.race([p, failed]); tx.check(); return value; },
      delay(ms) {
        return tx.wait(new Promise((r) => {
          const id = setTimeout(() => { delays.delete(id); r(); }, ms); delays.add(id);
        }));
      },
      watch(ms, message) { clearTimeout(timer); timer = setTimeout(() => tx.fail(new Error(message)), ms); },
      receive(s) {
        const e = tx.expected;
        if (!e || !s || !s.self || s.self.id !== selfId || s.mapId !== e.mapId || String(s.channelId) !== e.channelId || O.matchId !== e.matchId) return;
        try { tx.check(); resolveSnapshot(s); } catch (error) { tx.fail(error); }
      },
      dispose() { clearTimeout(timer); for (const id of delays) clearTimeout(id); delays.clear(); if (move === tx) move = null; },
    };
    // The save/retry phase can take longer than the first snapshot; neither phase may hang forever.
    tx.watch(60000, 'เซิร์ฟเวอร์ยังย้ายช่องไม่เสร็จ ลองใหม่อีกครั้ง');
    return tx;
  }
  O.on('snapshot', (s) => { if (move) move.receive(s); });
  O.on('status', (s) => { if (move && s !== 'channel') move.fail(disconnected()); });
  O.on('server', () => { if (move) move.fail(disconnected()); });
  // nc_join for a channel ('' = the one the server has saved), again while the old room still saves the hero
  async function joinWith(tx, ch) {
    const req = ident();
    if (ch) req.channelId = ch;
    for (let i = 0; i < 40; i++) {
      tx.check();
      try { return await tx.wait(tx.sock.rpc('nc_join', req)); } catch (e) {
        tx.check();
        const m = (e && e.message) || '';
        if (/leave current session|previous session is saving|switching character|try again/i.test(m)) { await tx.delay(200 + i * 40); continue; }
        if (ch && /full|channel must be/i.test(m)) return { refused: /full/i.test(m) ? `CH ${ch} เต็มแล้ว` : `ไม่มี CH ${ch}` };
        throw e;
      }
    }
    throw new Error('เซิร์ฟเวอร์ยังบันทึกห้องเดิมไม่เสร็จ ลองใหม่อีกครั้ง');
  }
  C.to = async function (ch) {
    ch = String(ch);
    let why = C.why(ch);
    if (why) { O.emit('channel', { state: 'refused', to: ch, now: C.current(), message: why }); return false; }
    try { await O.refreshRelease(); } catch (e) {
      O.emit('channel', { state: 'refused', to: ch, now: C.current(),
        message: e && e.update ? 'ต้องอัปเดตแอปก่อนย้ายแชนแนล' : 'ตรวจรุ่นเกมไม่สำเร็จ ลองใหม่อีกครั้ง' });
      return false;
    }
    why = C.why(ch); // a release gate may have stopped the socket while the check was in flight
    if (why) { O.emit('channel', { state: 'refused', to: ch, now: C.current(), message: why }); return false; }
    const sock = O.socket, origin = O.origin, prev = O.matchId, from = C.current(), mapId = C.mapId();
    const tx = move = beginMove(sock, origin, O.snap.self.id);
    C.busy = true; C.lastMove = Date.now();
    O.emit('channel', { state: 'moving', from, to: ch });
    let state = 'done', message = '';
    try {
      O.matchId = null; O.snap = null; // (conn.js drops the old room's last packets)
      setStatus('channel');
      tx.check();
      await tx.wait(sock.leaveMatch(prev));
      let join = await joinWith(tx, ch);
      if (join.refused) {
        state = 'refused'; message = join.refused;
        if (/เต็ม/.test(message)) fullSeen.set(fullKey(origin, mapId, ch), Date.now());
        join = await joinWith(tx, ''); // back where he was
      }
      if (!join || !join.matchId) throw new Error('เซิร์ฟเวอร์ไม่ส่งห้องของแชนแนลมา');
      tx.check();
      tx.expected = { matchId: join.matchId, mapId: join.mapId || mapId, channelId: String(join.channelId || (state === 'refused' ? from : ch)) };
      O.matchId = join.matchId;
      tx.watch(12000, 'ไม่ได้รับข้อมูลช่องใหม่จากเซิร์ฟเวอร์');
      await tx.wait(sock.joinMatch(join.matchId, { eventBatch: '1' }));
      const snapshot = await tx.wait(tx.snapshot);
      O.channelId = String(snapshot.channelId);
      tx.dispose();
      setStatus('online');
    } catch (e) {
      state = 'failed'; message = (e && e.message) || 'ย้ายแชนแนลไม่สำเร็จ';
      console.warn('online: channel', e);
      tx.dispose();
      if (O.socket === sock) { O.matchId = null; O.snap = null; sock.close(); } // conn.js reconnects into the saved channel
    } finally { tx.dispose(); C.busy = false; C.lastMove = Date.now(); }
    O.emit('channel', { state, from, to: ch, now: C.current(), message });
    return state === 'done';
  };
})();
