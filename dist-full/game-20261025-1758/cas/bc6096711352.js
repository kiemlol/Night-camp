/* net.js — playing together online. Published as a Claude Artifact (claude.ai), everyone who has the game open at the
   same time is in one room (the Artifact's `room` capability): each sees the others on the same map — their hero in
   their outfit, walking, sitting, attacking and casting (with the skills' effects), their name and HP — and a list of
   who is online. Monsters stay each player's own: another player's hits and skills are only looks here.
   What travels: one small presence object per player (where, what the body does, the outfit, the last skill cast, and
   what other modules add: chat.js its last lines, vend.js the shop and its trades), about 12 times a second. Outside
   claude.ai (the local game) there is no room and nothing here runs, except with ?netmock: tabs of this browser talk
   through a BroadcastChannel instead (testing on one machine).
   For other modules: NC.Net.fields.push({ key, get }) adds a field to my presence; NC.Net.hooks.push(fn(r, presence,
   first)) hears everyone's (first: the first time that player is seen: counters start there, nothing old is replayed);
   NC.Net.me() is my peer label (the one others address me by), NC.Net.clean(text, max) makes text from others safe.
   Hooks: wraps NC.Party.update / collect / drawTags (party.js) to move and draw the others like party members,
   NC.castSkill (a cast is announced), NC.VFX.flash and NC.FX.add (another player's effects never flash my screen). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX;
  const $ = (id) => document.getElementById(id);
  const SEND_MS = 80, NAME_MAX = 16, PRESENCE_MAX = 3900;
  const SLOTS = ['hat', 'hair', 'top', 'pants', 'shoes', 'weapon', 'robe', 'cape', 'glasses'];
  const COLORS = ['#ffd27a', '#8fe3ff', '#ffa3d1', '#b8f58a', '#c9a8ff', '#ffb38a'];
  const FOLLOW_MS = 160;
  const motionNow = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
  const net = (NC.Net = { room: null, online: false, remotes: new Map(), fields: [], hooks: [] });
  let game = null;

  // text from another player: no control or invisible characters, not too long (it is only ever drawn as text)
  const hidden = (c) => { const n = c.codePointAt(0); return n < 32 || (n >= 0x7f && n <= 0x9f) || n === 0xad || n === 0x61c || n === 0x180e ||
    (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) || (n >= 0x2060 && n <= 0x206f) || n === 0xfeff || (n >= 0xfff9 && n <= 0xfffb); };
  const clean = (net.clean = (s, n) => [...String(s == null ? '' : s)].filter((c) => !hidden(c)).join('').trim().slice(0, n));
  const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  const bytes = (s) => (window.TextEncoder ? new TextEncoder().encode(s).length : s.length * 3);

  // ---------------- the room: claude.ai's, or a stand-in between this browser's tabs (net.forceMock) ----------------
  async function connect() {
    if (NC.Online && NC.Online.enabled && NC.Online.room) return NC.Online.room(); // (?online: the Go server's heroes, js/online/world.js)
    if (net.forceMock && 'BroadcastChannel' in window) return mockRoom();
    if (!window.claude || typeof window.claude.use !== 'function') return null;
    try { return await window.claude.use('room'); } catch (e) { return null; }
  }
  function mockRoom() {
    const ch = new BroadcastChannel('nightcamp-netmock'), id = Math.random().toString(36).slice(2, 10), peers = new Map(), hs = [];
    let mine = Object.freeze({});
    const all = () => Object.freeze([{ peer: id, by: null, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: mine, updatedAt: Date.now() }, ...peers.values()]);
    const tell = () => { const list = all(); hs.forEach((h) => h({ peers: list, joined: [], left: [], updated: [] })); };
    ch.onmessage = (ev) => {
      const m = ev.data;
      if (!m || m.peer === id) return;
      if (m.bye) peers.delete(m.peer);
      else peers.set(m.peer, { peer: m.peer, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: Object.freeze(m.presence || {}), updatedAt: Date.now(), seen: Date.now() });
      tell();
    };
    setInterval(() => {
      ch.postMessage({ peer: id, presence: mine });
      let gone = false;
      for (const [k, p] of peers) if (Date.now() - p.seen > 3500) { peers.delete(k); gone = true; }
      if (gone) tell();
    }, 1000);
    addEventListener('beforeunload', () => ch.postMessage({ peer: id, bye: true }));
    return {
      presence(patch) {
        const o = Object.assign({}, mine, patch);
        for (const k in patch) if (patch[k] === null) delete o[k];
        mine = Object.freeze(o);
        ch.postMessage({ peer: id, presence: mine });
        return Promise.resolve();
      },
      onPeers(h) { hs.push(h); setTimeout(tell, 0); return () => {}; },
      peers: all,
      onConnection(h) { setTimeout(() => h(true), 0); return () => {}; },
      connected: () => true,
    };
  }
  // my peer label: what the others see as my `peer` (and address me by)
  net.me = function () {
    if (!net.room) return null;
    const mine = net.room.peers().find((p) => p.sameTab);
    return mine ? mine.peer : null;
  };
  net.byName = (name) => [...net.remotes.values()].find((r) => r.named && r.name === name) || null;

  // ---------------- what I send ----------------
  let lastSent = '', acSeq = 0, lastAct = null, lastActT = 0, cast = null, csSeq = 0;
  function mine() {
    const p = game.player, st = p.anim, W = NC.weaponDef(p) || {};
    // a new action clip (an attack, a skill's pose, a fidget) bumps the counter, so the others play it once
    if (st.act && (st.act !== lastAct || st.actT < lastActT)) acSeq++;
    lastAct = st.act; lastActT = st.actT;
    const eq = {};
    for (const s of SLOTS) eq[s] = p.equip[s] || null;
    const s = {
      v: 1, nm: clean(p.name, NAME_MAX) || 'ผู้เล่น', mp: game.mapId || 'camp',
      x: Math.round(p.x), y: Math.round(p.y), f: p.face > 0 ? 1 : -1, am: +((p.atk.on ? p.atk.ang : p.aim) || 0).toFixed(2),
      mv: p.moving ? 1 : 0, rn: p.running ? 1 : 0, cb: p.combat > 0.5 ? 1 : 0, dd: p.dead > 0 ? 1 : 0, ds: p.dash ? 1 : 0, st: p.sit ? 1 : 0,
      eq, mo: [p.moves.idle, p.moves.set], lv: p.lv, jb: p.job, hp: Math.round((100 * Math.max(0, p.hp)) / Math.max(1, p.maxHp)),
      ac: st.act ? [st.act, acSeq, +(p.atk.on ? NC.atkSpeed(p, W) : 1).toFixed(2)] : null,
      cs: cast,
    };
    for (const f of net.fields) { try { s[f.key] = f.get(); } catch (e) { s[f.key] = null; } }
    return s;
  }
  function send() {
    if (NC.Online && NC.Online.active) return;
    if (!net.room || !game || !game.player) return;
    const s = mine();
    let j = JSON.stringify(s);
    // the room takes 4 KiB at most: the oldest chat lines go first
    while (bytes(j) > PRESENCE_MAX && Array.isArray(s.cq) && s.cq.length) { s.cq = s.cq.slice(1); j = JSON.stringify(s); }
    if (bytes(j) > PRESENCE_MAX) return;
    if (j === lastSent) return;
    lastSent = j;
    net.room.presence(s).catch(() => {});
  }
  net.send = send;
  // a skill of mine went off: the others replay its looks where I stood, aiming where I aimed
  const baseCast = NC.castSkill;
  NC.castSkill = function (g, p, key) {
    const ok = baseCast.apply(this, arguments);
    if (ok && game && p === game.player) {
      const id = NC.skillForKey(p, key);
      cast = [++csSeq, id, NC.skillLv(p, id), Math.round(p.x), Math.round(p.y), +(p.aim || 0).toFixed(3), Math.round(g.mouse.wx), Math.round(g.mouse.wy), g.mouse.active ? 1 : 0];
      send();
    }
    return ok;
  };

  // ---------------- the others ----------------
  const validItem = (slot, id) => id === null || (typeof id === 'string' && NC.ITEMS[id] && (!NC.ITEMS[id].slot || NC.ITEMS[id].slot === slot));
  function makeRemote(peer, i) {
    const color = COLORS[i % COLORS.length];
    return {
      kind: 'ally', remote: true, peer, name: '', x: 0, y: 0, tx: 0, ty: 0, face: 1, aim: 0, r: 20, vx: 0, vy: 0, sort: 0,
      equip: { hat: null, hair: 'hair_brown', top: 'top_traveler', pants: 'pants_traveler', shoes: 'shoes_traveler', weapon: 'sword', robe: null, cape: null, glasses: null },
      moves: { idle: 'idle', set: 'basic' }, anim: NC.Anim.makeState(), pose: null, hatS: {}, walk: 0, moving: false, running: false,
      mv: false, cb: 0, combat: 0, dd: false, ds: false, st: false, atk: { on: false, ang: 0 }, dead: 0, dash: null, channel: null, inv: 0, hurt: 0,
      hp: 1, maxHp: 1, hpPct: 100, lv: 1, job: 'traveler', buffs: {}, cd: {}, skills: {}, skillLock: 0, lastFight: -99,
      map: null, fresh: true, named: false, synced: false, acSeq: null, acSpeed: 1, csSeq: null, lastCast: -9,
      color, def: { color }, mouse: { wx: 0, wy: 0, active: false }, fake: null, seenPresence: null,
      motion: [], motionOffset: null, motionAt: -Infinity, motionReceived: 0, motionStamped: null,
    };
  }
  // Keep a short server-time history instead of easing toward each new packet. Easing starts fast and slows down
  // every 50–100 ms; interpolating between snapshots keeps a walking hero at a steady speed despite arrival jitter.
  function position(r, x, y, stamp, jump) {
    const now = motionNow(), stamped = typeof stamp === 'number' && Number.isFinite(stamp), t = stamped ? stamp : now;
    if (jump || stamped !== r.motionStamped || now - r.motionReceived > 1000 || !r.motion.length) {
      r.motion.length = 0; r.motionOffset = now - t; r.motionAt = t - FOLLOW_MS;
      r.x = x; r.y = y; r.vx = r.vy = 0;
    }
    r.motionStamped = stamped;
    r.motionReceived = now;
    const last = r.motion[r.motion.length - 1];
    if (!last || t > last.t) {
      r.motion.push({ t, x, y });
      if (r.motion.length > 32) r.motion.shift();
    }
  }
  function follow(r, dt) {
    const samples = r.motion;
    if (!samples.length) return;
    const at = r.motionAt = Math.max(r.motionAt, motionNow() - r.motionOffset - FOLLOW_MS);
    while (samples.length > 2 && samples[1].t <= at) samples.shift();
    const a = samples[0], b = samples[1] || a;
    const k = b.t > a.t ? Math.max(0, Math.min(1, (at - a.t) / (b.t - a.t))) : 0;
    const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
    r.vx = (x - r.x) / Math.max(dt, 1e-3); r.vy = (y - r.y) / Math.max(dt, 1e-3);
    const speed = Math.hypot(r.vx, r.vy);
    r.x = x; r.y = y; r.moving = speed > 1;
    if (r.moving) r.walk += dt * speed * (r.running ? 0.0663 : 0.085);
  }
  function apply(r, pr) {
    if (!pr || pr.v !== 1) return;
    r.name = clean(pr.nm, NAME_MAX) || 'ผู้เล่น';
    const oldMap = r.map;
    r.map = typeof pr.mp === 'string' && NC.MAPS && NC.MAPS[pr.mp] ? pr.mp : 'camp';
    const x = num(pr.x, 0, 30000, r.tx), y = num(pr.y, 0, 30000, r.ty);
    position(r, x, y, pr.tm, r.fresh || oldMap !== r.map || Math.hypot(x - r.tx, y - r.ty) > 600);
    r.tx = x; r.ty = y; r.fresh = false;
    r.face = pr.f < 0 ? -1 : 1; r.aim = num(pr.am, -7, 7, 0);
    r.mv = !!pr.mv; r.running = !!pr.rn; r.cb = pr.cb ? 1 : 0; r.dd = !!pr.dd; r.ds = !!pr.ds; r.st = !!pr.st;
    if (pr.eq && typeof pr.eq === 'object') for (const s of SLOTS) if (s in pr.eq && validItem(s, pr.eq[s])) r.equip[s] = pr.eq[s];
    if (Array.isArray(pr.mo)) {
      if (pr.mo[0] === 'idle' || NC.Anim.BASE[pr.mo[0]]) r.moves.idle = pr.mo[0];
      if (pr.mo[1] === 'custom' || NC.Anim.SETS[pr.mo[1]]) r.moves.set = pr.mo[1];
    }
    r.lv = num(pr.lv, 1, 999, 1) | 0; r.job = NC.JOBS[pr.jb] ? pr.jb : 'traveler'; r.hpPct = num(pr.hp, 0, 100, 100);
    // (the "X เข้ามาในเกม / ออกจากเกมแล้ว" lines are off: the user, 2026-10-18, "แจ้งเตือนเข้าออก รกมาก"; net.joinNotes = true brings them back)
    if (!r.named) { r.named = true; if (net.joinNotes) NC.HUD.log(`${r.name} เข้ามาในเกม (${mapName(r.map)})`, 'item'); }
    const first = !r.synced;
    applyActions(r, pr);
    for (const h of net.hooks) { try { h(r, pr, first); } catch (e) { console.warn('net: hook', e); } }
  }
  function applyActions(r, pr) {
    // what only happens once: a new action clip, a skill cast (never the ones from before I saw them: the first
    // presence only sets where each counter stands)
    const first = !r.synced;
    if (first) {
      r.synced = true;
      r.acSeq = Array.isArray(pr.ac) ? pr.ac[1] : null; r.csSeq = Array.isArray(pr.cs) ? pr.cs[0] : null;
    } else {
      // (js/netsmooth.js: played when the body, drawn a moment behind, gets to where it was done: net.defer)
      const later = (fn) => (net.defer ? net.defer(r, fn) : fn());
      if (Array.isArray(pr.ac) && typeof pr.ac[0] === 'string' && NC.Anim.CLIPS[pr.ac[0]] && pr.ac[1] !== r.acSeq) {
        const clip = pr.ac[0], sp = num(pr.ac[2], 0.3, 5, 1);
        later(() => { if (!r.dd) { NC.Anim.play(r.anim, clip); r.acSpeed = sp; r.lastFight = game.time; } });
        r.acSeq = pr.ac[1];
      }
      if (Array.isArray(pr.cs) && pr.cs[0] !== r.csSeq) {
        const cs = pr.cs;
        later(() => replay(r, cs));
        r.csSeq = pr.cs[0];
      }
    }
  }
  const mapName = (net.mapName = (id) => (NC.MAPS && NC.MAPS[id] && NC.MAPS[id].name) || id);

  function onPeers(change) {
    const seen = new Set();
    for (const pr of change.peers) {
      if (pr.sameTab || pr.kind !== 'viewer') continue; // me (my other tabs count as players)
      seen.add(pr.peer);
      let r = net.remotes.get(pr.peer);
      if (!r) { r = makeRemote(pr.peer, net.remotes.size); net.remotes.set(pr.peer, r); }
      if (pr.presence !== r.seenPresence) { r.seenPresence = pr.presence; try { apply(r, pr.presence); } catch (e) { console.warn('net: bad presence', e); } }
    }
    for (const [id, r] of net.remotes)
      if (!seen.has(id)) { if (r.named && net.joinNotes) NC.HUD.log(`${r.name} ออกจากเกมแล้ว`, 'sys'); net.remotes.delete(id); }
    // The roster is checked twice a second below; position packets must not rebuild its DOM.
  }

  // ---------------- another player's skill: the same code as mine, only looks ----------------
  // (the game as their skill sees it: my world and clock, no monsters to hit, their mouse, their own shake and hitstop)
  const NONE = Object.freeze([]);
  // (on the game server, ?online: a presented cast, as my own casts' looks are, online/world.js castLook: the server heals,
  // marks and rolls for them too and its events draw that for every hero, so the skill files' presentationOnly guards
  // keep a replay from drawing it a second time or writing the shared state, the floating swords, the blade marks)
  const served = () => !!(NC.Online && NC.Online.enabled);
  function fakeOf(r) {
    return r.fake || (r.fake = Object.create(game, {
      enemies: { value: NONE, enumerable: true }, input: { value: { mx: 0, my: 0 } }, mouse: { get: () => r.mouse }, player: { value: r },
      shake: { value: 0, writable: true }, hitstop: { value: 0, writable: true }, presentationOnly: { get: served, enumerable: true },
    }));
  }
  // while one runs (and in every callback of the effects it starts) screen flashes stay theirs
  let depth = 0;
  net.inLooks = () => depth > 0; // (js/partysupport.js: another player's replayed skill never heals or buffs my stand-ins)
  const looks = (fn) => { depth++; try { return fn(); } catch (e) { console.warn('net: remote effect', e); } finally { depth--; } };
  const inLooks = (fn) => function () { depth++; try { return fn.apply(this, arguments); } finally { depth--; } };
  const baseFlash = V.flash;
  V.flash = function () { if (depth > 0) return; return baseFlash.apply(this, arguments); };
  // ...and my HUD's portrait stays mine (a buff of theirs, K.startBuff, runs NC.applyGear on their stand-in game, which
  // redrew the head from their outfit)
  const baseHead = NC.HUD && NC.HUD.refreshHead;
  if (baseHead) NC.HUD.refreshHead = function (g) { if (g && g.player && g.player.remote) return; return baseHead.apply(this, arguments); };
  const baseAdd = FX.add;
  FX.add = function (p) {
    if (depth > 0 && p) { if (typeof p.update === 'function') p.update = inLooks(p.update); if (typeof p.onEnd === 'function') p.onEnd = inLooks(p.onEnd); }
    return baseAdd.call(FX, p);
  };
  // ...and a skill of theirs that needs a monster (K.target finds none on their stand-in game, so it showed nothing):
  // for the skills in AIM, K.target picks the monster of mine nearest their mouse and gives their skill a ghost of it,
  // Object.create(mine): it moves with mine, while what their skill writes on it (a mark, a chase) stays on the ghost.
  // A hit, a mark or a status on a ghost is nothing (looks only); a homing shot at one bursts on it (K.shot only hits
  // game.enemies). (AIM: checked that none keeps its target in a list of mine or touches what the monster holds;
  // pp_control, sm_bladerain and wh_mark skip CHARMED / MARKS / my wolf for a remote. Left out: ro_steal (its steal
  // runs my lessons and saveTrade), wh_command (moves my wolf), bk_crosscut (a remote's dash doesn't move them: no
  // gain), sm_iai and bs_moon (K.target only in later callbacks, after aimId is gone).)
  const LOOK = Symbol('look'), isGhost = (e) => !!(e && e[LOOK]);
  const none = (f) => function () { return [].some.call(arguments, isGhost) ? null : f.apply(this, arguments); };
  const AIM = (net.AIM = new Set(['bd_note', 'sm_duel', 'wh_blitz', 'ws_mark', 'ws_rush',
    'mg_quake', 'ro_backstab', 'pal_shieldchain', 'dk_spiral', 'am_chain', 'am_firepillar', 'am_orbs', 'wl_hex', 'wh_mark',
    'as_deathmark', 'as_splasher', 'sh_raiton', 'sh_ricochet', 'sh_clone', 'bi_turnundead', 'mo_impact', 'mo_asura',
    'fm_pillar', 'fm_sea', 'im_blizzard', 'bk_guillotine', 'sm_bladerain', 'gs_triple', 'gs_ricochet', 'gs_stars',
    'bd_noterain', 'rp_execute', 'rp_hook', 'pp_control']));
  let aimId = null;
  const K = NC.SkillKit, H = NC.skillHelpers;
  if (K && H) {
    const baseTarget = K.target;
    K.target = function (g, p, range, near) {
      const e = baseTarget.apply(this, arguments);
      if (e || !aimId || !p || !p.remote || !game || g === game) return e;
      const mine = baseTarget.call(this, Object.create(g, { enemies: { value: game.enemies } }), p, range, near); // (their mouse, my monsters)
      return mine ? Object.create(mine, { [LOOK]: { value: mine } }) : null;
    };
    for (const k of ['hit', 'strike', 'vuln', 'weak', 'stun', 'freeze', 'poison', 'slow', 'pull']) if (typeof K[k] === 'function') K[k] = none(K[k]);
    H.strike = none(H.strike);
    const baseShot = K.shot;
    K.shot = function (g, p, id, o) {
      const e = o && !o.to && o.target;
      if (!isGhost(e)) return baseShot.apply(this, arguments);
      let done = false;
      return baseShot.call(this, g, p, id, Object.assign({}, o, { trail(q, dt) {
        if (o.trail) o.trail(q, dt);
        if (done || e.dead || !(e.hp > 0) || NC.dist(q.x, q.y, e.x, e.y - 45) >= (o.r || 34) + (e.r || 0)) return;
        done = true;
        if (o.hit) o.hit(e, q); else V.sparks(q.x, q.y, 6, o.rgb || '255,235,190', { size: 0.7 });
        if (!o.pierce) q.dead = true;
      } }));
    };
  }
  // (the last guard, the outermost wrapper, put back on top if something wrapped these since)
  const shield = () => { for (const k of ['damageEnemy', 'statusEnemy', 'addStatus']) if (typeof NC[k] === 'function' && !NC[k][LOOK]) (NC[k] = none(NC[k]))[LOOK] = true; };
  function replay(r, cs) {
    const id = cs[1], S = typeof id === 'string' && NC.SKILLS[id], run = S && NC.SKILL_RUN && NC.SKILL_RUN[id];
    if (!run || r.map !== game.mapId || r.dd) return;
    if (game.time - r.lastCast < 0.25) return; // (a flood: skip)
    r.lastCast = game.time;
    r.x = r.tx = num(cs[3], 0, 30000, r.x); r.y = r.ty = num(cs[4], 0, 30000, r.y); r.aim = num(cs[5], -7, 7, r.aim);
    r.motion.length = 0; // a skill's dash/channel starts at its authoritative cast point
    r.face = Math.cos(r.aim) >= 0 ? 1 : -1;
    r.mouse = { wx: num(cs[6], 0, 30000, r.x), wy: num(cs[7], 0, 30000, r.y), active: !!cs[8] };
    if (Math.hypot(r.x - game.player.x, r.y - game.player.y) > 2400) return; // too far to see
    const lv = Math.max(1, Math.min(S.boss ? NC.BOSS_ULT_LV || 5 : S.max || 10, num(cs[2], 1, 99, 1) | 0));
    r.skills[id] = lv;
    aimId = AIM.has(id) ? id : null;
    shield();
    looks(() => run(fakeOf(r), r, lv, String(S.key || 'q').toLowerCase()));
    aimId = null;
  }

  // ---------------- every frame: follow, animate, the skills' dashes and channels, buffs ----------------
  // Basic shots and buff decorations are remote visuals too. Scope only their
  // creation; animation clocks, attack events and the remote's state keep the
  // same update path, even with OtherFX=0 (logic-bearing FX still update).
  const otherVisual = (fn) => NC.OtherFX ? NC.OtherFX.run(fn) : fn();
  function tick(r, dt) {
    r.skillLock = Math.max(0, r.skillLock - dt);
    for (const k in r.buffs) r.buffs[k] = Math.max(0, r.buffs[k] - dt);
    const fake = fakeOf(r);
    if (r.dash) {
      const d = r.dash;
      d.t += dt;
      looks(() => {
        if ((d.ghost -= dt) <= 0 && r.pose) { d.ghost = 0.028; FX.add({ type: 'hero', x: r.x, y: r.y, equip: Object.assign({}, r.equip), pose: Object.assign({}, r.pose), color: '#9dff8f', life: 0.28 }); }
        if (d.tick) d.tick(fake, r, d, dt);
        if (d.t >= d.dur) { r.dash = null; if (d.end) d.end(fake, r, d); }
      });
    }
    if (r.channel) {
      const c = r.channel;
      c.t += dt;
      looks(() => { c.update(fake, r, c, dt); if (r.channel === c && c.t >= c.dur) { r.channel = null; if (c.end) c.end(fake, r, c); } });
    }
    // the burning blade and the shadow's wisps, as skills.js shows them on the hero
    if (r.buffs.fireblade > 0 && r.pose && Math.random() < dt * 30) {
      const L = NC.weaponLine(r.equip, r.pose, r.x, r.y);
      if (L) { const k = NC.rand(0.3, 1); otherVisual(() => V.flameAt(NC.lerp(L.base[0], L.tip[0], k), NC.lerp(L.base[1], L.tip[1], k) + 6, NC.rand(10, 16), NC.rand(18, 30), V.PAL.fire, NC.rand(0.25, 0.4), { vy: -60 })); }
    }
    if (r.buffs.shadow > 0 && Math.random() < dt * 12) otherVisual(() => V.motes(r.x + NC.rand(-26, 26), r.y - NC.rand(10, 110), 1, V.RGB.shadow, { rise: 70, spread: 4, size: 1 }));
  }
  // a bow or a staff shoots on the swing's 'hit': an arrow or a bolt that only flies (their monsters are theirs)
  function shot(r, W) {
    if (W.style === 'throw') { if (NC.throwLook) otherVisual(() => NC.throwLook(r, W)); return; } // (the ninja's huuma flies out and back: js/throwstar.js)
    if (W.style !== 'arrow' && W.style !== 'bolt') return;
    const L = r.pose && NC.weaponLine(r.equip, r.pose, r.x, r.y), from = L ? (W.style === 'arrow' ? L.hand : L.tip) : [r.x + r.face * 30, r.y - 80];
    const v = W.style === 'arrow' ? 1150 : 900;
    // (a weapon with a shot of its own - a gun's bullet, a shotgun's pellets, a lute's note, a thread, a chime - flies
    // as that shot, jobs3_skills_b/c.js's j3<shot> looks, not as the staff's ball of light)
    const type = W.shot ? 'j3' + W.shot : W.style;
    otherVisual(() => FX.add({ type, layer: 'glow', x: from[0], y: from[1], x0: from[0], y0: from[1], fan: W.shot === 'pellet',
      vx: Math.cos(r.aim) * v, vy: Math.sin(r.aim) * v, life: 0.55, trail: [] }));
  }
  function animate(r, dt) {
    const Anim = NC.Anim, st = r.anim, W = NC.weaponDef(r) || {};
    const MV = Anim.movesFor(r.moves, W), IDLE = Anim.BASE[MV.idle] ? MV.idle : 'idle', SET = Anim.setOf(MV);
    const move = r.running ? (r.combat > 0.5 ? 'runReady' : 'run') : r.combat > 0.5 ? 'walkReady' : 'walk';
    const sit = r.st && !r.moving && Anim.BASE.sit;
    const base = r.dead ? 'death' : r.dash || r.ds ? 'dash' : sit ? 'sit' : r.moving ? move : r.combat > 0.5 ? SET.ready : IDLE;
    if (st.base === 'death' && base !== 'death') { st.from = null; st.base = base; st.baseT = 0; }
    Anim.setBase(st, base, base === 'dash' || base === 'death' ? 0.06 : base === 'sit' || st.base === 'sit' ? 0.4 : 0.16);
    if ((r.dead || sit) && st.act) st.act = null;
    Anim.update(st, dt, st.act ? r.acSpeed || 1 : 1, (ev) => { if (ev === 'hit') shot(r, W); });
    // tick() and animation events continue off screen (including projectile launches). Skip only
    // the visual rig of an idle/walking remote, keeping the previous pose available to effects.
    if (r.pose && !st.act && !r.atk.on && !r.cast && !r.dash && !r.ds && !r.channel && !(r.skillLock > 0) &&
        !r.dead && !(r.hurt > 0) && !(r.buffs.fireblade > 0) && offscreen(r)) {
      r.hatS.init = false;
      return;
    }
    const al = Math.atan2(Math.sin(r.face > 0 ? r.aim : Math.PI - r.aim), Math.cos(r.face > 0 ? r.aim : Math.PI - r.aim));
    const c = NC.animCtx(r.equip, { al: NC.clamp(al, -1.2, 1.2), walk: r.walk, moving: r.moving, hurt: 0, idleStyle: IDLE, ready: SET.ready });
    const P = Anim.evaluate(st, c);
    P.face = r.face;
    NC.hatSpring(r.hatS, r.equip, P, r.vx * r.face, dt);
    if (NC.throwHide) NC.throwHide(r, P); // (the hand is empty while a thrown huuma is out: js/throwstar.js)
    r.pose = P;
  }
  function update(dt) {
    if (net.tick) net.tick(dt); // (js/netsmooth.js: the acts and hits waiting for the bodies)
    for (const r of net.remotes.values()) {
      if (!r.named || r.map !== game.mapId) { r.dash = null; r.channel = null; r.pose = null; continue; }
      if (!r.channel) { // follow what arrives, smoothly
        const ox = r.x, oy = r.y;
        // (js/netsmooth.js: a moment behind, between the two places around that time; else follow() of the motion samples)
        if (net.follow && net.follow(r, dt)) {
          const moved = Math.hypot(r.x - ox, r.y - oy) / Math.max(dt, 1e-3);
          r.vx = (r.x - ox) / Math.max(dt, 1e-3);
          r.moving = r.mv || moved > 60;
          if (r.moving) r.walk += dt * Math.max(moved, 150) * (r.running ? 0.0663 : 0.085);
        } else follow(r, dt);
      }
      r.sort = r.y;
      r.combat += ((r.cb || game.time - r.lastFight < 1.6 ? 1 : 0) - r.combat) * Math.min(1, dt * 8);
      r.dead = r.dd ? 1 : 0;
      r.hurt = Math.max(0, (r.hurt || 0) - dt); // (a duel hit's red flash, js/pvp.js / online/pvp.js: it fades as on the hero, never stays red after the match)
      tick(r, dt);
      try { animate(r, dt); } catch (e) { r.pose = null; }
    }
  }
  net.updateRemotes = (dt) => { if (net.room && game) update(dt); };
  net.onMap = () => [...net.remotes.values()].filter((r) => r.pose && r.map === game.mapId && !r.gwHide); // (gwHide: an enemy in the war's dark, js/gwar.js)

  // ---------------- drawing: name and HP under the others (the bodies go through party.js with the party) ----------------
  function offscreen(who) {
    const c = game.cam;
    // Keep a margin for tall avatars and effects when skipping a remote's visual rig and tags.
    return c && game.vw > 0 && game.vh > 0 &&
      (who.x < c.x - 400 || who.x > c.x + game.vw + 400 || who.y < c.y - 400 || who.y > c.y + game.vh + 400);
  }
  function bar(ctx, x, y, w, h, f, col) {
    ctx.fillStyle = NC.OUTLINE; NC.rrect(ctx, x - 3, y - 3, w + 6, h + 6, (h + 6) / 2); ctx.fill();
    ctx.fillStyle = '#3b3346'; NC.rrect(ctx, x, y, w, h, h / 2); ctx.fill();
    if (f > 0) { ctx.fillStyle = col; NC.rrect(ctx, x, y, Math.max(h, w * NC.clamp(f, 0, 1)), h, h / 2); ctx.fill(); }
  }
  function drawTags(ctx) {
    for (const r of net.remotes.values()) {
      if (!r.pose || r.map !== game.mapId || offscreen(r) || r.gwHide) continue; // (off screen, or hidden by ศึกชิงกองไฟ: js/gwar.js)
      const w = 88, f = r.hpPct / 100, y = r.y + 20;
      bar(ctx, r.x - w / 2, y, w, 9, f, r.dead ? '#6c6878' : f > 0.5 ? '#6ad36a' : f > 0.25 ? '#f2c14e' : '#ee5a5a');
      if (NC.drawTag) NC.drawTag(ctx, r.name, r.x, y + 32, 21, r.color);
    }
  }

  // ---------------- the list of who is online (under the minimap) ----------------
  let list = null, listKey = '';
  function renderList() {
    if (!list || !game) return;
    const rs = [...net.remotes.values()].filter((r) => r.named);
    const key = JSON.stringify([!!net.room, net.online, game.mapId,
      rs.map((r) => [r.peer, r.name, r.job, r.lv, r.map, r.color])]);
    if (key === listKey) return;
    listKey = key;
    list.hidden = !net.room;
    list.textContent = '';
    const head = document.createElement('div');
    head.className = 'net-h';
    head.textContent = net.online ? `ออนไลน์ ${rs.length + 1} คน` : 'กำลังเชื่อมต่อ…';
    list.appendChild(head);
    for (const r of rs.slice(0, 8)) {
      const row = document.createElement('div');
      row.className = 'net-p';
      const nm = document.createElement('b'); nm.textContent = r.name; nm.style.color = r.color;
      const info = document.createElement('span');
      info.textContent = ` Lv ${r.lv} ${(NC.JOBS[r.job] || NC.JOBS.traveler).name} · ${r.map === game.mapId ? 'แมพเดียวกัน' : mapName(r.map)}`;
      row.append(nm, info);
      list.appendChild(row);
    }
  }

  // ---------------- start-up and hooks ----------------
  async function start() {
    const room = await connect();
    if (!room) return;
    net.room = room;
    renderList();
    room.onPeers(onPeers, (e) => { console.warn('net: room closed', e && e.code); net.online = false; renderList(); });
    // Online combat events can precede the next movement snapshot. Consume only
    // the existing actor's action counters; do not restamp its motion history.
    if (room.onAction) room.onAction((id, pr) => {
      const r = net.remotes.get(id);
      if (net.room !== room || !r || !r.synced || r.map !== game.mapId) return;
      r.aim = num(pr.am, -7, 7, r.aim); r.face = pr.f < 0 ? -1 : 1;
      applyActions(r, pr);
    });
    room.onConnection((ok) => {
      net.online = ok; renderList();
      if (ok && !net.greeted) { net.greeted = true; NC.HUD.log('ออนไลน์แล้ว! ใครเปิดเกมนี้อยู่จะเห็นกันในแมพ · กด Enter เพื่อแชท', 'level'); }
    });
    setInterval(send, SEND_MS);
    setInterval(renderList, 500);
  }
  // a stand-in room between this browser's tabs and frames, started later (pvpbot.js: the practice bot in a hidden frame)
  net.startMock = function () { if (net.room || net.starting) return; net.starting = true; net.forceMock = true; start(); };
  const P = NC.Party;
  if (P) {
    const baseUpdate = P.update, baseCollect = P.collect, baseTags = P.drawTags;
    P.update = function (g, dt) { baseUpdate.call(P, g, dt); net.updateRemotes(dt); };
    P.collect = function (list, visible) {
      baseCollect.call(P, list, visible);
      if (net.room) for (const r of net.remotes.values()) if (r.pose && r.map === game.mapId && !r.gwHide && visible(r.x - 120, r.y - 220, r.x + 120, r.y + 40)) list.push(r);
    };
    P.drawTags = function (ctx, g) { baseTags.call(P, ctx, g); if (net.room) drawTags(ctx); };
  }
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (g) {
    baseInit(g);
    game = g;
    list = document.createElement('div');
    list.className = 'netlist'; list.hidden = true;
    $('hud').appendChild(list);
    start();
  };
})();
