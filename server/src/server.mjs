import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 7350);
const HOST = process.env.HOST || '0.0.0.0';
const SERVER_KEY = process.env.SERVER_KEY || 'nightcamp-clone-dev-key';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, '..', 'data'));
const DB_FILE = path.join(DATA_DIR, 'state.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

const now = () => Date.now();
const id = (prefix) => `${prefix}_${crypto.randomBytes(9).toString('hex')}`;
const b64 = (s) => Buffer.from(String(s)).toString('base64');
const json = (res, status, value) => { const body = JSON.stringify(value); res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); res.end(body); };
const readBody = (req) => new Promise((resolve, reject) => { let s = ''; req.on('data', (c) => { s += c; if (s.length > 2e6) reject(new Error('body too large')); }); req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error('invalid json')); } }); req.on('error', reject); });
const clone = (v) => JSON.parse(JSON.stringify(v));

const defaultQuest = () => ({ main: { index: 0, id: 'first-night', state: 'active', objectives: [{ have: 0, need: 3, kind: 'dummy' }], keys: [] }, daily: { day: 0, list: [], week: { days: 0, claimed: false } }, rep: {}, tokens: 0, flags: {} });
const blankHero = (name, appearance = {}) => ({
  id: id('hero'), name: String(name || 'Traveler').slice(0, 24), appearance, mapId: 'camp', channelId: '1',
  x: 2200, y: 1600, lv: 1, xp: 0, xpNext: 100, job: 'traveler', jobLv: 1, jobXp: 0, jobXpNext: 100,
  hp: 126, hpMax: 126, sp: 13, spMax: 13, coins: 250, gems: 0, statPts: 0, skillPts: 0,
  equip: { weapon: 'sword', hair: 'hair_spiky' }, wu: { weapon: 1 }, bag: [], store: [], bagExtra: 0,
  materials: {}, potions: { hp: 3, sp: 3 }, quests: defaultQuest(), flags: {}, skills: {}, statuses: [],
});
let db = { users: {}, sessions: {}, characters: {}, version: 1 };
try { if (fs.existsSync(DB_FILE)) db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch { /* start clean */ }
let saveTimer;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)), 100); }

const sessions = new Map();
function tokenFor(userId, refresh = false) { const token = `${b64(JSON.stringify({ uid: userId, exp: Math.floor(now() / 1000) + (refresh ? 2592000 : 3600) }))}.${crypto.randomBytes(12).toString('hex')}`; return token; }
function authUser(req) { const h = req.headers.authorization || ''; if (!h.startsWith('Bearer ')) return null; const s = sessions.get(h.slice(7)); return s && s.exp > now() ? s.userId : null; }
function newSession(userId) { const access = tokenFor(userId), refresh = tokenFor(userId, true); sessions.set(access, { userId, refresh, exp: now() + 3600000 }); return { token: access, refresh_token: refresh }; }
function userFor(id0) { return db.users[id0] || (db.users[id0] = { id: id0, slots: [null, null, null], createdAt: now() }); }
function currentHero(uid) { const u = userFor(uid); const c = u.active && db.characters[u.active]; return c || (u.slots.find(Boolean) && db.characters[u.slots.find(Boolean)]); }

const worlds = new Map();
function worldFor(matchId, uid, hero) {
  let w = worlds.get(matchId); if (w) return w;
  const monsters = [
    { id: id('mob'), type: 'dummy_plain', x: 2450, y: 1600, lv: 1, hp: 100, hpMax: 100 },
    { id: id('mob'), type: 'dummy_armored', x: 2650, y: 1600, lv: 2, hp: 140, hpMax: 140 },
  ];
  w = { matchId, uid, hero, mapId: hero.mapId || 'camp', channelId: hero.channelId || '1', players: new Map(), monsters, loot: [], seq: 0, clients: new Set() };
  worlds.set(matchId, w); return w;
}
function selfWire(h) { return { ...clone(h), mapId: h.mapId || 'camp', channelId: h.channelId || '1', wu: h.wu || {}, bag: h.bag || [], store: h.store || [], quests: h.quests || defaultQuest() }; }
function snapshot(w, full = true) {
  const self = selfWire(w.hero);
  return { full, mapId: w.mapId, channelId: w.channelId, tick: Math.floor(now() / 50), self, players: [...w.players.values()].filter((p) => p.id !== self.id), monsters: clone(w.monsters), loot: clone(w.loot), bag: clone(w.hero.bag || []), store: clone(w.hero.store || []) };
}
function sendFrame(client, op, value) { const raw = Buffer.from(JSON.stringify(value)); client.send(JSON.stringify({ match_data: { match_id: client.matchId, op_code: String(op), data: raw.toString('base64'), reliable: true } })); }
function event(w, value) { for (const c of w.clients) if (c.readyState === 1) sendFrame(c, 102, value); }
function fullSync(client) { sendFrame(client, 101, snapshot(client.world, true)); }
function deltaSync(client) { sendFrame(client, 101, snapshot(client.world, false)); }

function rpc(uid, method, payload = {}) {
  const u = userFor(uid); let hero = currentHero(uid);
  if (method === 'nc_status') return { closing: false, supportedSkills: [], channels: { count: 1, cap: 50 }, online: 1, version: db.version };
  if (method === 'nc_account') return { ok: true };
  if (method === 'nc_characters') return { slots: u.slots.map((x) => x ? { slot: u.slots.indexOf(x), ...clone(db.characters[x]) } : null) };
  if (method === 'nc_character_create') { const slot = Math.max(0, Math.min(2, Number(payload.slot) || 0)); if (u.slots[slot]) throw new Error('slot occupied'); const h = blankHero(payload.name, payload.appearance); db.characters[h.id] = h; u.slots[slot] = h.id; u.active = h.id; save(); return { ok: true, character: clone(h) }; }
  if (method === 'nc_character_slot') { const slot = Math.max(0, Math.min(2, Number(payload.slot) || 0)); if (payload.delete && u.slots[slot]) { delete db.characters[u.slots[slot]]; u.slots[slot] = null; save(); return { ok: true }; } if (u.slots[slot]) { u.active = u.slots[slot]; hero = db.characters[u.active]; save(); return { ok: true, character: clone(hero) }; } return { ok: false }; }
  if (method === 'nc_checkin_status') return { ok: true, day: Math.floor(now() / 86400000), claimed: false, first7: [], month: [] };
  if (method === 'nc_checkin_claim') return { ok: true, claimed: true, reward: { coins: 25 } };
  if (method === 'nc_gwar') return { lands: [], result: 'ok' };
  if (method === 'nc_rankings') return { rows: [] };
  if (method === 'nc_chat') return { ok: true };
  if (method === 'nc_join') return { matchId: id('match'), channelId: String(payload.channelId || hero?.channelId || '1') };
  return {};
}
function applyCommand(w, op, body, client) {
  const h = w.hero; const seq = Number(body.seq || 0); if (seq <= (client.lastSeq || 0)) return; client.lastSeq = seq;
  if (op === 1) { h.x += Math.max(-12, Math.min(12, Number(body.dx) || 0)); h.y += Math.max(-12, Math.min(12, Number(body.dy) || 0)); }
  else if (op === 2 || op === 3) { const target = w.monsters.find((m) => body.targetId ? m.id === body.targetId : m.hp > 0); if (target) { target.hp = Math.max(0, target.hp - (op === 3 ? 24 : 12)); event(w, { type: 'hit', targetId: target.id, amount: op === 3 ? 24 : 12, seq }); if (target.hp <= 0) { h.xp += target.lv * 10; h.coins += target.lv * 5; h.quests.main.objectives[0].have = Math.min(3, (h.quests.main.objectives[0].have || 0) + 1); event(w, { type: 'kill', targetId: target.id, xp: target.lv * 10, coins: target.lv * 5, seq }); target.hp = target.hpMax; } } }
  else if (op === 4) { const i = w.loot.findIndex((x) => x.id === body.lootId); if (i >= 0) { const [drop] = w.loot.splice(i, 1); h.materials[drop.itemId] = (h.materials[drop.itemId] || 0) + 1; event(w, { type: 'pickup', lootId: body.lootId, itemId: drop.itemId, seq }); } }
  else if (op === 5 && body.portalId) { h.mapId = String(body.portalId); w.mapId = h.mapId; event(w, { type: 'transfer', mapId: w.mapId, seq }); }
  else if (op === 6) applyAction(w, body, client);
  save(); deltaSync(client); sendFrame(client, 103, { id: body.id, ackSeq: seq });
}
function applyAction(w, a, client) {
  const h = w.hero, kind = String(a.kind || a.action || '');
  if (a.action === 'quest') { const q = h.quests.main; if (a.op === 'take') q.state = 'active'; if (a.op === 'choose') { h.quests.flags[`choice:${a.id}`] = a.choice; q.state = 'done'; } if (a.op === 'handin' && q.objectives[0].have >= q.objectives[0].need) { q.state = 'done'; h.coins += 100; } event(w, { type: 'quest', op: a.op === 'handin' ? 'done' : a.op, id: a.id || q.id, panels: [] }); }
  else if (a.action === 'potion') { const k = a.kind === 'sp' ? 'sp' : 'hp'; if ((h.potions?.[k] || 0) > 0) { h.potions[k]--; if (k === 'hp') h.hp = h.hpMax; else h.sp = h.spMax; event(w, { type: 'heal', kind: k, amount: k === 'hp' ? h.hpMax : h.spMax }); } }
  else if (a.action === 'stat') { const key = String(a.key || 'str'); if (h.statPts > 0) { h.statPts--; h.stats = h.stats || {}; h.stats[key] = (h.stats[key] || 1) + 1; } }
  else if (a.action === 'equip' && a.itemId) { h.equip[a.slot || 'weapon'] = a.itemId; event(w, { type: 'equip', slot: a.slot, itemId: a.itemId }); }
  else if (a.action === 'rest') { h.hp = h.hpMax; h.sp = h.spMax; }
  else if (a.action === 'travel' && a.mapId) { h.mapId = String(a.mapId); w.mapId = h.mapId; }
  else if (a.action === 'auto') event(w, { type: 'auto', on: a.kind === 'start' });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,authorization', 'access-control-allow-methods': 'GET,POST,OPTIONS' }); return res.end(); }
  const u = new URL(req.url, `http://${req.headers.host}`), uid = authUser(req);
  if (req.method === 'GET' && u.pathname === '/nc/update') return json(res, 200, { schemaVersion: 1, contentVersion: 'clone-local-1', protocolVersion: 1, version: 'clone-0.1.0', platforms: { web: { minimumBuild: 0 } }, notes: [] });
  if (req.method === 'GET' && u.pathname === '/nc/servers') return json(res, 200, { self: true, servers: [{ id: 'local', no: 1, name: 'Clone Local', url: process.env.PUBLIC_ORIGIN || `http://localhost:${PORT}`, status: 'open', tags: ['recommended'], opened: true }] });
  if (req.method === 'GET' && u.pathname === '/nc/load') return json(res, 200, { population: [...worlds.values()].reduce((n, w) => n + w.clients.size, 0), capacity: 50, state: 'smooth', maps: {} });
  if (req.method === 'GET' && u.pathname === '/healthz') return json(res, 200, { ok: true, service: 'nightcamp-clone-server' });
  if (req.method === 'POST' && u.pathname.startsWith('/v2/account/authenticate/')) { const body = await readBody(req); const kind = u.pathname.split('/').pop(); const identity = kind === 'device' ? String(body.id) : kind === 'custom' ? `key:${body.id}` : `email:${body.email}`; const userId = id('user') + '_' + crypto.createHash('sha1').update(identity).digest('hex').slice(0, 12); userFor(userId); return json(res, 200, newSession(userId)); }
  if (req.method === 'POST' && u.pathname === '/v2/account/session/refresh') { const b = await readBody(req); const old = [...sessions.values()].find((s) => s.refresh === b.token); if (!old) return json(res, 401, { message: 'session expired' }); return json(res, 200, newSession(old.userId)); }
  if (req.method === 'POST' && u.pathname === '/v2/session/logout') return json(res, 200, {});
  if (req.method === 'POST' && u.pathname.startsWith('/v2/rpc/')) { if (!uid) return json(res, 401, { message: 'unauthorized' }); const p = await readBody(req); let payload = {}; try { payload = JSON.parse(p.payload || '{}'); } catch {} try { return json(res, 200, { payload: JSON.stringify(rpc(uid, decodeURIComponent(u.pathname.slice('/v2/rpc/'.length)), payload)) }); } catch (e) { return json(res, 400, { message: e.message }); } }
  if (req.method === 'GET' && u.pathname === '/v2/match') return json(res, 200, { matches: [] });
  return json(res, 404, { message: 'not found' });
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => { const u = new URL(req.url, `http://${req.headers.host}`); if (u.pathname !== '/ws') return socket.destroy(); const token = u.searchParams.get('token') || ''; const session = sessions.get(token); if (!session || session.exp <= now()) return socket.destroy(); wss.handleUpgrade(req, socket, head, (client) => { client.userId = session.userId; client.matchId = null; client.world = null; client.on('message', (raw) => onMessage(client, raw)); }); });
function onMessage(client, raw) {
  let m; try { m = JSON.parse(raw.toString()); } catch { return; }
  if (process.env.DEBUG_WS) console.log('ws in', Object.keys(m), m.cid || '', m.match_join || '');
  if (m.rpc) { const p = JSON.parse(m.rpc.payload || '{}'); if (m.rpc.id === 'nc_join') { const uid = client.userId || id('user'); client.userId = uid; const h = currentHero(uid) || (userFor(uid), null); if (!h) { client.send(JSON.stringify({ cid: m.cid, rpc: { id: m.rpc.id, payload: JSON.stringify({ matchId: id('match') }) } })); return; } const result = rpc(uid, 'nc_join', p); client.matchId = result.matchId; client.world = worldFor(result.matchId, uid, h); client.world.clients.add(client); client.send(JSON.stringify({ cid: m.cid, rpc: { id: m.rpc.id, payload: JSON.stringify(result) } })); return; } const result = rpc(client.userId, m.rpc.id, p); client.send(JSON.stringify({ cid: m.cid, rpc: { id: m.rpc.id, payload: JSON.stringify(result) } })); return; }
  if (m.match_join) { client.matchId = m.match_join.match_id; if (!client.world) { const h = currentHero(client.userId); if (!h) return; client.world = worldFor(client.matchId, client.userId, h); } client.world.clients.add(client); if (process.env.DEBUG_WS) console.log('ws join', client.matchId, !!client.world); client.send(JSON.stringify({ cid: m.cid, match: { match_id: client.matchId } })); fullSync(client); return; }
  if (m.match_leave) { client.world?.clients.delete(client); client.send(JSON.stringify({ cid: m.cid, match: { match_id: m.match_leave.match_id } })); return; }
  if (m.match_data_send) { const d = m.match_data_send, data = JSON.parse(Buffer.from(d.data || '', 'base64').toString() || '{}'); applyCommand(client.world, Number(d.op_code), data, client); }
}
wss.on('connection', (client) => client.on('close', () => client.world?.clients.delete(client)));
server.listen(PORT, HOST, () => console.log(`Night Camp clone server listening on ${HOST}:${PORT}`));
