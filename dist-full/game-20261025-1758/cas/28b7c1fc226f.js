/* online/nakama.js — the smallest Nakama client the online game needs, in plain browser JS (no SDK, no build step):
   sign in over HTTP (this browser's device id, a username = an email on users.nightcamp.invalid, a beta key = a custom
   id), refresh the session, call RPCs, and one WebSocket for the match (join, leave, send a command, hear snapshots and
   events) and the server's notifications. The official Nakama protobuf adapter carries game JSON as UTF-8 bytes;
   JSON sockets remain available with client.socketFormat = 'json'. Requests keep their cid in either format.
   The Go server (satjakul160842/nightcamp-backend) decides everything; this file only carries messages.
   Used by online/conn.js. */
(function () {
  'use strict';
  const NC = window.NC || (window.NC = {});

  const enc = new TextEncoder(), dec = new TextDecoder();
  function toB64(str) {
    const b = enc.encode(str);
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(b64) {
    const s = atob(b64 || ''), b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return dec.decode(b);
  }
  function bytesFromB64(b64) {
    const s = atob(b64 || ''), bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes;
  }
  // a JWT's payload (exp, uid): only read, never trusted for anything but "has it run out"
  function jwt(token) {
    try { return JSON.parse(fromB64(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return {}; }
  }

  class NakamaError extends Error {
    constructor(status, message, code) { super(message || 'Nakama ' + status); this.status = status; this.code = code; }
  }

  class Session {
    constructor(token, refresh) {
      this.token = token; this.refresh = refresh || '';
      const t = jwt(token), r = refresh ? jwt(refresh) : {};
      this.userId = t.uid || ''; this.username = t.usn || '';
      this.expires = (t.exp || 0) * 1000; this.refreshExpires = (r.exp || 0) * 1000;
    }
    expired(ms) { return Date.now() + (ms || 0) >= this.expires; }
    refreshExpired(ms) { return !this.refresh || Date.now() + (ms || 0) >= this.refreshExpires; }
  }

  class Client {
    constructor(origin, serverKey) {
      this.origin = String(origin).replace(/\/+$/, '');
      this.serverKey = serverKey;
      this.timeout = 12000;
      this.socketFormat = 'protobuf';
    }
    async http(method, path, body, auth) {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), this.timeout);
      try {
        const res = await fetch(this.origin + path, {
          method, signal: ctl.signal,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: auth },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        let j = null;
        try { j = text ? JSON.parse(text) : {}; } catch (e) { j = { message: text }; }
        if (!res.ok) throw new NakamaError(res.status, (j && (j.message || j.error)) || res.statusText, j && j.code);
        return j;
      } catch (e) {
        if (e.name === 'AbortError') throw new NakamaError(0, 'หมดเวลาเชื่อมต่อเซิร์ฟเวอร์');
        if (e instanceof NakamaError) throw e;
        throw new NakamaError(0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
      } finally { clearTimeout(t); }
    }
    basic() { return 'Basic ' + btoa(this.serverKey + ':'); }
    async auth(kind, body, create, username) {
      const q = new URLSearchParams({ create: create ? 'true' : 'false' });
      if (username) q.set('username', username);
      const j = await this.http('POST', `/v2/account/authenticate/${kind}?${q}`, body, this.basic());
      return new Session(j.token, j.refresh_token);
    }
    device(id) { return this.auth('device', { id }, true); }
    email(email, password, create) { return this.auth('email', { email, password }, !!create); }
    custom(id, create) { return this.auth('custom', { id }, create !== false); }
    async refreshSession(s) {
      const j = await this.http('POST', '/v2/account/session/refresh', { token: s.refresh }, this.basic());
      return new Session(j.token, j.refresh_token || s.refresh);
    }
    async logout(s) {
      try { await this.http('POST', '/v2/session/logout', { token: s.token, refresh_token: s.refresh }, 'Bearer ' + s.token); } catch (e) { /* gone already */ }
    }
    // an RPC: the payload is a JSON string inside JSON (Nakama's HTTP gateway), the reply's payload a JSON string
    async rpc(s, id, payload) {
      const j = await this.http('POST', '/v2/rpc/' + encodeURIComponent(id), JSON.stringify(payload == null ? {} : payload), 'Bearer ' + s.token);
      if (!j || j.payload == null || j.payload === '') return {};
      try { return JSON.parse(j.payload); } catch (e) { return j.payload; }
    }
    async get(path) { return this.http('GET', path, undefined, undefined); }
    socket() { return new Socket(this); }
  }

  // ---------------- the socket ----------------
  class Socket {
    constructor(client) {
      this.client = client; this.ws = null; this.adapter = null; this.format = 'json'; this.cid = 0; this.wait = new Map();
      this.onmatchdata = null; this.onnotification = null; this.onclose = null; this.onerror = null;
      this.open = false;
    }
    connect(session) {
      const url = this.client.origin.replace(/^http/, 'ws') + '/ws?lang=th&status=true&token=' + encodeURIComponent(session.token);
      return new Promise((resolve, reject) => {
        let settled = false;
        const origin = new URL(this.client.origin), createPb = window.Nakama && window.Nakama.createProtobufAdapter;
        const binary = this.client.socketFormat === 'protobuf' && typeof createPb === 'function';
        const t = setTimeout(() => { if (!settled) { settled = true; this.close(); reject(new NakamaError(0, 'หมดเวลาเชื่อมต่อซ็อกเก็ต')); } }, 10000);
        const opened = () => { this.open = true; if (!settled) { settled = true; clearTimeout(t); resolve(this); } };
        const failed = () => { if (!settled) { settled = true; clearTimeout(t); reject(new NakamaError(0, 'ซ็อกเก็ตเชื่อมต่อไม่ได้')); } if (this.onerror) this.onerror(); };
        const closed = (ev) => {
          this.open = false;
          for (const w of this.wait.values()) w.reject(new NakamaError(0, 'ซ็อกเก็ตปิดแล้ว'));
          this.wait.clear();
          if (!settled) { settled = true; clearTimeout(t); reject(new NakamaError(0, 'ซ็อกเก็ตปิดแล้ว')); }
          if (this.onclose) this.onclose(ev);
        };
        if (binary) {
          const adapter = (this.adapter = createPb());
          this.format = 'protobuf';
          // The pinned official adapter joins host + ':' + port + '/ws'. Its string suffix also retains a reverse
          // proxy's path; the envelope codec and message handling stay entirely in the official adapter.
          const suffix = (origin.port || (origin.protocol === 'https:' ? '443' : '80')) + origin.pathname.replace(/\/+$/, '');
          adapter.connect(origin.protocol === 'https:' ? 'wss://' : 'ws://', origin.hostname, suffix, true, session.token);
          adapter.onOpen = opened; adapter.onError = failed; adapter.onClose = closed;
          adapter.onMessage = (envelope) => this.receiveEnvelope(envelope);
        } else {
          const ws = (this.ws = new WebSocket(url));
          this.format = 'json';
          ws.onopen = opened; ws.onerror = failed; ws.onclose = closed;
          ws.onmessage = (ev) => this.receive(ev.data);
        }
      });
    }
    receive(raw) {
      let m;
      try { m = JSON.parse(raw); } catch (e) { return; }
      this.receiveEnvelope(m);
    }
    receiveEnvelope(m) {
      if (m.cid) {
        const w = this.wait.get(m.cid);
        if (!w) return;
        this.wait.delete(m.cid);
        if (m.error) w.reject(new NakamaError(m.error.code || 0, m.error.message, m.error.code));
        else w.resolve(m);
        return;
      }
      if (m.match_data) {
        const d = m.match_data;
        if (this.onmatchdata) {
          const op = Number(d.op_code), bytes = d.data ? (this.format === 'protobuf' ? d.data : bytesFromB64(d.data)) : new Uint8Array(0);
          this.onmatchdata({ matchId: d.match_id, op, bytes, text: op === 201 || op === 202 ? '' : dec.decode(bytes) });
        }
      } else if (m.notifications) {
        for (const n of m.notifications.notifications || []) {
          let content = n.content;
          try { content = JSON.parse(n.content); } catch (e) { /* plain text */ }
          if (this.onnotification) this.onnotification(Object.assign({}, n, { content }));
        }
      } else if (m.error && this.onerror) this.onerror(m.error);
    }
    request(body, ms) {
      if (!this.isOpen()) return Promise.reject(new NakamaError(0, 'ยังไม่ได้เชื่อมต่อ'));
      const cid = String(++this.cid);
      body.cid = cid;
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => { if (this.wait.delete(cid)) reject(new NakamaError(0, 'เซิร์ฟเวอร์ไม่ตอบ')); }, ms || 15000);
        this.wait.set(cid, { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
        this.sendEnvelope(body);
      });
    }
    async joinMatch(matchId, metadata) {
      const join = { match_id: matchId };
      if (metadata) join.metadata = metadata;
      const m = await this.request({ match_join: join }); return m.match;
    }
    async leaveMatch(matchId) { try { await this.request({ match_leave: { match_id: matchId } }, 3000); } catch (e) { /* the server may have dropped us already */ } }
    sendMatch(matchId, op, obj) {
      if (!this.isOpen()) return false;
      const text = JSON.stringify(obj);
      this.sendEnvelope({ match_data_send: { match_id: matchId, op_code: this.format === 'protobuf' ? Number(op) : String(op), data: this.format === 'protobuf' ? enc.encode(text) : toB64(text), reliable: true } });
      return true;
    }
    async rpc(id, payload) {
      const m = await this.request({ rpc: { id, payload: JSON.stringify(payload == null ? {} : payload) } });
      const p = m.rpc && m.rpc.payload;
      if (!p) return {};
      try { return JSON.parse(p); } catch (e) { return p; }
    }
    isOpen() { return this.adapter ? this.adapter.isOpen() : !!(this.ws && this.ws.readyState === 1); }
    sendEnvelope(body) { if (this.adapter) this.adapter.send(body); else this.ws.send(JSON.stringify(body)); }
    close() { this.open = false; try { if (this.adapter) this.adapter.close(); else if (this.ws) this.ws.close(); } catch (e) { /* */ } }
  }

  NC.Nakama = { Client, Session, Socket, NakamaError, toB64, fromB64 };
})();
