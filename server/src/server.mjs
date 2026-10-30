import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { Game, createHero, catalog, RESOURCES } from "./game.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(ROOT, "../.env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const PORT = Number(process.env.PORT || 7350),
  HOST = process.env.HOST || "0.0.0.0";
const SERVER_KEY = process.env.SERVER_KEY || "nightcamp-local-key";
const DATA_DIR = path.resolve(
  process.env.DATA_DIR || path.join(ROOT, "../runtime"),
);
const CLIENT_DIR = path.resolve(
  process.env.CLIENT_DIR || path.join(ROOT, "../../dist"),
);
const FULL_CLIENT_DIR = path.resolve(
  process.env.FULL_CLIENT_DIR || path.join(ROOT, "../../dist-full"),
);
const BUILD = "game-20261025-1758";
fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const DB_FILE = path.join(DATA_DIR, "state.json"),
  SECRET_FILE = path.join(DATA_DIR, ".session-secret");
if (!fs.existsSync(SECRET_FILE))
  fs.writeFileSync(SECRET_FILE, crypto.randomBytes(48).toString("hex"), {
    mode: 0o600,
    flag: "wx",
  });
const secret =
  process.env.SESSION_SECRET || fs.readFileSync(SECRET_FILE, "utf8").trim();
let db = { users: {}, characters: {}, sessions: {}, accounts: {}, version: 2 };
// Never silently reset players' progress when a save is corrupt.
if (fs.existsSync(DB_FILE))
  Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, "utf8")));
db.accounts ||= {};
db.sessions ||= {};
const game = new Game(db);
let dirty = false;
function save() {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
  dirty = false;
}
function user(id) {
  return (
    db.users[id] ||
    (db.users[id] = { id, slots: [null, null, null], createdAt: Date.now() })
  );
}
function hero(uid) {
  return db.characters[user(uid).active];
}
function slotList(uid) {
  const u = user(uid);
  return {
    active: Math.max(0, u.slots.indexOf(u.active)),
    max: 3,
    slots: u.slots.map((id, slot) =>
      id && db.characters[id]
        ? {
            slot,
            empty: false,
            ...db.characters[id],
            look: db.characters[id].appearance || {},
          }
        : { slot, empty: true },
    ),
  };
}
function token(uid, refresh = false) {
  const head = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      uid,
      usn: uid,
      exp: Math.floor(Date.now() / 1000) + (refresh ? 2592000 : 3600),
      jti: crypto.randomUUID(),
      refresh,
    }),
  ).toString("base64url");
  const input = head + "." + payload;
  return (
    input +
    "." +
    crypto.createHmac("sha256", secret).update(input).digest("base64url")
  );
}
function verify(value, refresh = false) {
  try {
    const [head, payload, sig] = String(value).split(".");
    const expected = crypto
        .createHmac("sha256", secret)
        .update(head + "." + payload)
        .digest(),
      got = Buffer.from(sig || "", "base64url");
    if (
      got.length !== expected.length ||
      !crypto.timingSafeEqual(got, expected)
    )
      return null;
    const p = JSON.parse(Buffer.from(payload, "base64url"));
    if (
      p.exp <= Date.now() / 1000 ||
      p.refresh !== refresh ||
      !db.sessions[p.jti]
    )
      return null;
    return p;
  } catch {
    return null;
  }
}
function newSession(uid) {
  const access = token(uid),
    refresh = token(uid, true);
  for (const v of [access, refresh]) {
    const p = JSON.parse(Buffer.from(v.split(".")[1], "base64url"));
    db.sessions[p.jti] = { uid, exp: p.exp };
  }
  save();
  return { token: access, refresh_token: refresh };
}
function requireValue(ok, message) {
  if (!ok) throw new Error(message);
}
const rates = new Map();
function limit(key, max, period = 1000) {
  const t = Date.now();
  let b = rates.get(key);
  if (!b || b.until <= t) {
    b = { n: 0, until: t + period };
    rates.set(key, b);
  }
  requireValue(++b.n <= max, "rate_limit");
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0,
      parts = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > 128 * 1024) {
        reject(new Error("body_too_large"));
        req.destroy();
      } else parts.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(parts).toString() || "{}"));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}
function rpc(uid, method, p = {}) {
  requireValue(
    p && typeof p === "object" && !Array.isArray(p),
    "invalid_payload",
  );
  const u = user(uid),
    h = hero(uid);
  if (method === "nc_status")
    return {
      closing: false,
      supportedSkills: Object.keys(catalog.SKILLS),
      channels: { count: 3, cap: 50 },
      online: [...wss.clients].filter((c) => c.world).length,
      version: 2,
    };
  if (method === "nc_account") return { ok: true, id: uid };
  if (method === "nc_characters") return slotList(uid);
  if (method === "nc_character_create") {
    const slot = Number(p.slot ?? 0);
    requireValue(
      Number.isInteger(slot) && slot >= 0 && slot < 3 && !u.slots[slot],
      "invalid_slot",
    );
    const h = createHero(p.name, p.appearance);
    db.characters[h.id] = h;
    u.slots[slot] = h.id;
    u.active = h.id;
    save();
    return slotList(uid);
  }
  if (method === "nc_character_slot") {
    requireValue(
      ![...wss.clients].some((c) => c.uid === uid && c.world),
      "leave_world_first",
    );
    const slot = Number(p.slot);
    requireValue(
      Number.isInteger(slot) && slot >= 0 && slot < 3,
      "invalid_slot",
    );
    const id = u.slots[slot];
    requireValue(id && db.characters[id], "empty_slot");
    if (p.delete) {
      const h = db.characters[id];
      requireValue(
        !h.partyId &&
          !h.guildId &&
          !Object.values(db.market).some((row) => row.seller === id),
        "character_has_social_or_market_state",
      );
      delete db.characters[id];
      u.slots[slot] = null;
      u.active = u.slots.find(Boolean) || null;
    } else u.active = id;
    save();
    return slotList(uid);
  }
  requireValue(h, "character_required");
  if (method === "nc_join") {
    const w = game.world(
      h.mapId,
      String(p.channelId || h.channelId),
      h.dungeon?.id || "",
    );
    return { matchId: w.id, channelId: w.channelId };
  }
  if (method === "nc_checkin_status") return game.checkin(h);
  if (method === "nc_checkin_claim") {
    const result = game.checkin(h, true);
    save();
    return result;
  }
  if (method === "nc_rankings")
    return {
      rows: Object.values(db.characters)
        .sort((a, b) => b.lv - a.lv || b.xp - a.xp)
        .slice(0, 100)
        .map((h, i) => ({
          rank: i + 1,
          id: h.id,
          name: h.name,
          lv: h.lv,
          job: h.job,
        })),
    };
  if (method === "nc_broker") return { rows: Object.values(db.market) };
  if (method === "nc_chat") return { ok: true };
  throw new Error("unsupported_rpc:" + method);
}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".css": "text/css",
  ".mjs": "text/javascript",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};
const server = http.createServer(async (req, res) => {
  const origin = process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`;
  const allowed =
    !req.headers.origin ||
    req.headers.origin === origin ||
    (process.env.CORS_ORIGINS || "").split(",").includes(req.headers.origin);
  const headers = {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...(allowed && req.headers.origin
      ? { "access-control-allow-origin": req.headers.origin, vary: "Origin" }
      : {}),
  };
  const json = (code, value) => {
    res.writeHead(code, { ...headers, "content-type": "application/json" });
    res.end(JSON.stringify(value));
  };
  try {
    requireValue(allowed, "origin_denied");
    const url = new URL(req.url, "http://localhost"),
      route = url.pathname;
    if (route.startsWith("/v2/") || route.startsWith("/nc/"))
      limit("http:" + req.socket.remoteAddress, 600, 60000);
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        ...headers,
        "access-control-allow-headers": "content-type,authorization",
        "access-control-allow-methods": "GET,POST,OPTIONS",
      });
      return res.end();
    }
    if (req.method === "GET") {
      if (route === "/healthz")
        return json(200, {
          ok: true,
          version: "0.2.0",
          players: [...wss.clients].filter((c) => c.world).length,
        });
      if (route === "/backend-ui.js") {
        res.writeHead(200, { ...headers, "content-type": mime[".js"] });
        return res.end(
          fs.readFileSync(path.join(ROOT, "../public/backend-ui.js")),
        );
      }
      if (route === "/nc/update")
        return json(200, {
          schemaVersion: 1,
          contentVersion: "clone-local-3",
          protocolVersion: 1,
          version: "0.5.16-clone.2",
          platforms: {
            web: {
              build: 2,
              minimumBuild: 2,
              version: "0.5.16-clone.2",
              url: "",
              notes: "",
            },
          },
          notes: [],
        });
      if (route === "/nc/servers")
        return json(200, {
          self: true,
          servers: [
            {
              id: "local",
              no: 1,
              name: "Night Camp",
              url: origin,
              status: "open",
              tags: ["recommended"],
              opened: true,
            },
          ],
        });
      if (route === "/nc/catalog")
        return json(200, {
          items: catalog.ITEMS,
          jobs: catalog.JOBS,
          maps: catalog.MAPS,
          skills: catalog.SKILLS,
          materials: catalog.MATERIALS,
          resources: RESOURCES,
        });
      if (route === "/nc/load")
        return json(200, {
          population: [...wss.clients].filter((c) => c.world).length,
          capacity: 150,
          state: "smooth",
          maps: Object.fromEntries(
            [...game.worlds.values()].map((w) => [w.id, w.players.size]),
          ),
        });
      if (route === "/v2/match")
        return json(200, {
          matches: [...game.worlds.values()]
            .filter((w) => !w.instance)
            .map((w) => ({
              match_id: w.id,
              size: w.players.size,
              authoritative: true,
              label: w.mapId,
            })),
        });
      if (route === "/") {
        res.writeHead(302, {
          location: `/${BUILD}/index.html?online=${encodeURIComponent(origin)}&serverkey=${encodeURIComponent(SERVER_KEY)}`,
        });
        return res.end();
      }
      if (route === "/studio" || route === "/cutout-demo") {
        res.writeHead(302, { location: route + "/" });
        return res.end();
      }
      const relative = route === "/studio/" ? "studio/index.html" : route === "/cutout-demo/" ? "cutout-demo/index.html" : decodeURIComponent(route).replace(/^\/+/, "");
      let file = path.resolve(CLIENT_DIR, relative);
      requireValue(file.startsWith(CLIENT_DIR + path.sep), "invalid_path");
      if (!fs.existsSync(file)) {
        const full = path.resolve(FULL_CLIENT_DIR, relative);
        requireValue(
          full.startsWith(FULL_CLIENT_DIR + path.sep),
          "invalid_path",
        );
        file = full;
      }
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        if (path.basename(file) === "index.html" && !relative.startsWith("studio/") && !relative.startsWith("cutout-demo/")) {
          let html = fs.readFileSync(file, "utf8");
          html = html.replace(
            /(<meta\s+name="nc-online-servers"\s+content=")[^"]*(")/,
            (_, a, b) => a + origin.replace(/["<>]/g, "") + b,
          );
          html = html.replace(
            "</body>",
            '<script src="/backend-ui.js" defer></script></body>',
          );
          res.writeHead(200, { ...headers, "content-type": mime[".html"] });
          return res.end(html);
        }
        res.writeHead(200, {
          ...headers,
          "content-type":
            mime[path.extname(file)] || "application/octet-stream",
        });
        return fs.createReadStream(file).pipe(res);
      }
      return json(404, { message: "not_found" });
    }
    requireValue(req.method === "POST", "method_not_allowed");
    const auth = verify(
      (req.headers.authorization || "").replace(/^Bearer /, ""),
    );
    if (route.startsWith("/v2/account/authenticate/")) {
      limit("auth:" + req.socket.remoteAddress, 30, 60000);
      requireValue(
        req.headers.authorization ===
          "Basic " + Buffer.from(SERVER_KEY + ":").toString("base64"),
        "invalid_server_key",
      );
      const body = await readBody(req),
        kind = route.split("/").pop();
      requireValue(
        ["device", "custom", "email"].includes(kind),
        "unsupported_auth",
      );
      const ident = String(
        kind === "email" ? body.email || "" : body.id || "",
      ).trim();
      requireValue(
        ident.length >= 6 && ident.length <= 200,
        "invalid_identity",
      );
      const accountKey = crypto
        .createHash("sha256")
        .update(kind + ":" + (kind === "email" ? ident.toLowerCase() : ident))
        .digest("hex");
      let account = db.accounts[accountKey];
      if (kind === "email") {
        requireValue(
          typeof body.password === "string" &&
            body.password.length >= 8 &&
            body.password.length <= 128,
          "password_length",
        );
        if (!account) {
          requireValue(
            url.searchParams.get("create") === "true",
            "invalid_credentials",
          );
          const salt = crypto.randomBytes(16).toString("hex");
          account = {
            uid: "user_" + accountKey.slice(0, 24),
            salt,
            password: crypto
              .scryptSync(body.password, salt, 32)
              .toString("hex"),
          };
          db.accounts[accountKey] = account;
        } else
          requireValue(
            crypto.timingSafeEqual(
              Buffer.from(account.password, "hex"),
              crypto.scryptSync(body.password, account.salt, 32),
            ),
            "invalid_credentials",
          );
      } else if (!account) {
        const oldIdentity = kind === "custom" ? "key:" + ident : ident;
        const legacy =
          "user_" +
          crypto
            .createHash("sha256")
            .update(oldIdentity)
            .digest("hex")
            .slice(0, 24);
        account = {
          uid: db.users[legacy] ? legacy : "user_" + accountKey.slice(0, 24),
        };
        db.accounts[accountKey] = account;
      }
      user(account.uid);
      return json(200, newSession(account.uid));
    }
    if (route === "/v2/account/session/refresh") {
      const b = await readBody(req),
        p = verify(b.token, true);
      requireValue(p, "session_expired");
      delete db.sessions[p.jti];
      return json(200, newSession(p.uid));
    }
    requireValue(auth, "unauthorized");
    if (route === "/v2/session/logout") {
      const b = await readBody(req);
      delete db.sessions[auth.jti];
      const p = verify(b.refresh_token, true);
      if (p?.uid === auth.uid) delete db.sessions[p.jti];
      for (const ws of wss.clients)
        if (ws.uid === auth.uid) ws.close(4002, "logged_out");
      save();
      return json(200, {});
    }
    if (route.startsWith("/v2/rpc/")) {
      const b = await readBody(req),
        payload =
          typeof b === "string"
            ? JSON.parse(b || "{}")
            : typeof b.payload === "string"
              ? JSON.parse(b.payload || "{}")
              : b;
      return json(200, {
        payload: JSON.stringify(
          rpc(auth.uid, decodeURIComponent(route.slice(8)), payload),
        ),
      });
    }
    return json(404, { message: "not_found" });
  } catch (e) {
    if (!res.headersSent)
      json(
        e.message === "unauthorized" || e.message === "invalid_credentials"
          ? 401
          : e.message === "rate_limit"
            ? 429
            : 400,
        { message: e.message },
      );
  }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 });
server.on("upgrade", (req, socket, head) => {
  try {
    const u = new URL(req.url, "http://localhost"),
      auth = verify(u.searchParams.get("token"));
    requireValue(u.pathname === "/ws" && auth, "unauthorized");
    const origin = process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`;
    requireValue(
      !req.headers.origin ||
        req.headers.origin === origin ||
        (process.env.CORS_ORIGINS || "")
          .split(",")
          .includes(req.headers.origin),
      "origin_denied",
    );
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.uid = auth.uid;
      ws.jti = auth.jti;
      ws.exp = auth.exp;
      ws.seq = 0;
      ws.alive = true;
      wss.emit("connection", ws);
    });
  } catch {
    socket.destroy();
  }
});
function send(ws, obj) {
  if (ws.readyState === 1 && ws.bufferedAmount < 2e6)
    ws.send(JSON.stringify(obj));
}
function frame(ws, op, value) {
  send(ws, {
    match_data: {
      match_id: ws.world.id,
      op_code: String(op),
      data: Buffer.from(JSON.stringify(value)).toString("base64"),
      reliable: true,
    },
  });
}
function detach(ws) {
  if (
    ws.world &&
    ![...wss.clients].some(
      (other) =>
        other !== ws &&
        other.readyState === 1 &&
        other.heroId === ws.heroId &&
        other.world === ws.world,
    )
  )
    ws.world.players.delete(ws.heroId);
  ws.world = null;
}
function sync(ws) {
  const h = db.characters[ws.heroId];
  if (ws.world && h) frame(ws, 101, game.snapshot(ws.world, h, ws.seq));
}
function flush() {
  for (const { world, event, to } of game.drain())
    for (const ws of wss.clients)
      if (ws.world && (to ? ws.heroId === to : ws.world.id === world))
        frame(ws, 102, event);
}
wss.on("connection", (ws) => {
  ws.on("pong", () => {
    ws.alive = true;
  });
  ws.on("close", () => detach(ws));
  ws.on("error", () => detach(ws));
  ws.on("message", (raw) => {
    let m;
    try {
      limit("ws:" + ws.uid, 100);
      requireValue(
        ws.exp > Date.now() / 1000 && db.sessions[ws.jti],
        "session_expired",
      );
      m = JSON.parse(raw.toString());
      if (m.rpc) {
        const result = rpc(ws.uid, m.rpc.id, JSON.parse(m.rpc.payload || "{}"));
        return send(ws, {
          cid: m.cid,
          rpc: { id: m.rpc.id, payload: JSON.stringify(result) },
        });
      }
      if (m.match_join) {
        const h = hero(ws.uid);
        requireValue(h, "character_required");
        const w = game.world(h.mapId, h.channelId, h.dungeon?.id || "");
        const target = game.worlds.get(m.match_join.match_id);
        requireValue(
          target && target.mapId === h.mapId && target.instance === w.instance,
          "invalid_match",
        );
        detach(ws);
        for (const other of wss.clients)
          if (other !== ws && other.heroId === h.id && other.world) {
            detach(other);
            other.close(4001, "reconnected");
          }
        ws.heroId = h.id;
        ws.world = game.join(h, target.channelId);
        ws.seq = 0;
        send(ws, { cid: m.cid, match: { match_id: ws.world.id } });
        sync(ws);
        return;
      }
      if (m.match_leave) {
        detach(ws);
        return send(ws, {
          cid: m.cid,
          match: { match_id: m.match_leave.match_id },
        });
      }
      if (m.match_data_send) {
        const d = m.match_data_send;
        requireValue(ws.world && d.match_id === ws.world.id, "not_in_match");
        const a = JSON.parse(
            Buffer.from(d.data || "", "base64").toString() || "{}",
          ),
          op = Number(d.op_code);
        if (op === 7)
          return frame(ws, 103, {
            id: a.id,
            clientTime: a.clientTime,
            serverTime: Date.now(),
            ackSeq: ws.seq,
          });
        requireValue(
          Number.isSafeInteger(a.seq) && a.seq > 0,
          "invalid_sequence",
        );
        if (a.seq <= ws.seq) {
          sync(ws);
          return;
        }
        ws.seq = a.seq;
        let result;
        try {
          const beforeCoins = db.characters[ws.heroId].coins;
          result = game.command(db.characters[ws.heroId], ws.world, op, a);
          dirty = true;
          if (
            op === 6 ||
            op === 4 ||
            op === 5 ||
            beforeCoins !== db.characters[ws.heroId].coins
          )
            save();
        } catch (e) {
          frame(ws, 102, {
            type: "error",
            code: e.message,
            message: e.message,
            seq: a.seq,
            requestId: a.requestId,
          });
          sync(ws);
          return;
        }
        if (result?.world) {
          const next = result.world;
          frame(ws, 104, { matchId: next.id });
          ws.world = next;
        } else sync(ws);
        flush();
        return;
      }
      throw new Error("invalid_envelope");
    } catch (e) {
      send(ws, { cid: m?.cid, error: { code: 3, message: e.message } });
    }
  });
});
const loop = setInterval(() => {
  game.tick();
  flush();
  for (const ws of wss.clients) {
    if (ws.world) {
      dirty = true;
      sync(ws);
    }
  }
}, 100);
const persistence = setInterval(() => {
  if (dirty) save();
  const t = Date.now();
  for (const [key, b] of rates) if (b.until < t) rates.delete(key);
  for (const [key, s] of Object.entries(db.sessions))
    if (s.exp < t / 1000) delete db.sessions[key];
}, 1000);
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
}, 30000);
function shutdown() {
  clearInterval(loop);
  clearInterval(persistence);
  clearInterval(heartbeat);
  save();
  for (const ws of wss.clients) ws.terminate();
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
server.listen(PORT, HOST, () =>
  console.log(
    `Night Camp server ready at http://${HOST}:${server.address().port}`,
  ),
);
