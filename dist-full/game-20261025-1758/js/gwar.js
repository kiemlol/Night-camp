/* gwar.js — ศึกชิงกองไฟ, the guild war (the user, 2026-10-14: "ผมอยากทำระบบกิลวอล เป็นแบบมีหลายแคมไฟ ยึดแคมไฟกัน" ->
   mockups -> "ทำเลย" -> "มันไม่ใช่เป็นแมพโซนแยก แล้วยึดเป็นแมพหรอ": four lands, each its own map that a guild holds for
   the week; on each land the owner defends against ONE challenger guild; whoever holds the great fire when the hour is
   up holds the land). The lands and their art: js/gwar_zones.js. On every land:
     5 fires           ไฟฝั่งป้องกัน · ไฟปีกใต้ · กองไฟใหญ่ (the heart of the land) · ไฟปีกเหนือ · ไฟฝั่งบุก. The war starts with
                       the owner holding the great fire and its own fire, the challenger its own fire; the flanks are ash.
                       A land with no owner: its first two challengers, the great fire is ash.
     the end           whoever holds the great fire when the time is up takes the land (ash at the end: the owner keeps
                       it); the small fires are respawn points and each makes its side douse 15% faster
     one bar a fire    ฟืน (firewood) is the fire's life: it burns down by itself (a full small fire in 4 min), faster
                       while enemies outnumber the defenders in its ring (4 a second per extra enemy, 3 at most); at 0 it
                       is ash; 8 s in the ring with no enemy lights it in your colour, with 30 firewood
     firewood          chop the land's trees (B or a click, 3 s a bundle, carry 3), walk into your own fire's ring to
                       feed it (+15 a bundle); a death drops what you carry
     darkness          outside the firelight you only see round yourself and your side (320 units); enemies in the dark
                       are not drawn, not on the minimap and cannot be hit
     death             costs nothing; 10 s, then back at your camp or at one of your fires that is not under attack
   Who fights where (NC.Store): gwzone/{land} = the owner { gid, name, week }; gwsign/{land}-{week}-{1|2} = a challenger
   { owner: gid, name, at } (one slot on an owned land, two on a free one; a guild's leader or officer signs up at the war
   board, one land a week). The fires are run by ONE game per land: the lowest peer on that map (presence gwm); the others
   follow it and send what only they know (gw: my side and numbers, gwk: my stand-in's numbers, gwh: hit claims, gwd:
   firewood I put in, gwx: my deaths); the host writes the new owner at the end. Hits between players are pvp.js's way
   (stand-ins in game.enemies, claims, the PvP rules). All of it is cheatable from the browser: the real war runs on the
   game server; NC.GWAR_RULES / NC.GWAR_GEO / NC.GWAR_ZONES are the data the server and Unity port from.
   Windows: js/gwar_ui.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, TAU = Math.PI * 2;
  if (NC.ASSET_MANIFEST_GWAR) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_GWAR);
  const GEO = NC.GWAR_GEO, ZONES = NC.GWAR_ZONES || [];
  if (!GEO || !ZONES.length) return;
  const { W, H, FIRES, CAMPS, ROADS } = GEO, SQ = 0.58, GREAT = FIRES.findIndex((f) => f.kind === 'great');
  const ZONE = Object.fromEntries(ZONES.map((z) => [z.id, z]));
  const now = () => Date.now();
  const G = () => NC.game;
  const net = () => NC.Net;
  const me = () => (net() && net().room && net().me ? net().me() || 'me' : 'me');

  // ---------------- the rules (the server's and Unity's numbers come from here) ----------------
  const RULES = (NC.GWAR_RULES = {
    minutes: 60, prep: 60, endHold: 30,
    small: { max: 100, burn: 100 / 240, ring: 230, light: [320, 4] }, // light radius = a + b x firewood
    great: { max: 200, burn: 200 / 300, ring: 330, light: [420, 3] },
    douse: 4, douseCap: 3, douseBonus: 0.15, lightS: 8, litFuel: 30, wood: 15, carry: 3, chopS: 3, feedS: 0.5,
    respawnS: 10, vision: 320, perSide: 20, schedule: { day: 6, hour: 20 }, // Saturday 20:00 (local clock here; the server's later)
    reward: { base: 10, cap: 150, perCap: 4, perKill: 2, perWood: 0.5, perMin: 0.5, win: 1.5, land: 20 },
  });
  const SIDE = {
    b: { name: 'ฝั่งป้องกัน', free: 'ฝั่งฟ้า', col: '#6cbcff', rgb: '120,175,255', banner: 'gw_banner_blue' },
    r: { name: 'ฝั่งบุก', free: 'ฝั่งแดง', col: '#ff7466', rgb: '255,120,95', banner: 'gw_banner_red' },
  };
  const other = (s) => (s === 'b' ? 'r' : s === 'r' ? 'b' : '');
  const K = (f) => RULES[f.kind];
  const inRing = (f, x, y, pad) => { const R = K(f).ring + (pad || 0); return ((x - f.x) / R) ** 2 + ((y - f.y) / (R * SQ)) ** 2 < 1; };

  // ---------------- the four maps ----------------
  for (const z of ZONES)
    NC.MAPS[z.id] = {
      name: z.name, lvText: 'ศึกชิงกองไฟ · ดินแดนกิลด์', biome: z.biome, W, H, seed: z.seed, lifeSafe: true, pvp: true, gwar: z.id,
      spawns: [], bots: [], warps: [], roads: ROADS, landmarks: z.marks, spawn: [CAMPS.b.x, CAMPS.b.y + 140],
      clear: [...FIRES.map((f) => ({ x: f.x, y: f.y, r: f.kind === 'great' ? 560 : 420 })), { x: CAMPS.b.x, y: CAMPS.b.y, r: 520 }, { x: CAMPS.r.x, y: CAMPS.r.y, r: 520 },
        ...(z.lake ? [{ x: z.lake.x, y: z.lake.y, r: z.lake.rx * 0.92 }] : [])],
    };
  const baseField = NC.buildField;
  NC.buildField = function (def) {
    const w = baseField.apply(this, arguments);
    const z = def && ZONE[def.id];
    if (!z) return w;
    w.dusk = 1; w.ambient = () => z.amb; // darker than any field: the fires are what you see by
    w.bots = []; w.gwar = z.id;
    const mark = (cx, cy, rx, ry) => {
      for (let gy = Math.floor((cy - ry) / w.CELL); gy <= (cy + ry) / w.CELL; gy++)
        for (let gx = Math.floor((cx - rx) / w.CELL); gx <= (cx + rx) / w.CELL; gx++) {
          if (gx < 0 || gy < 0 || gx >= w.GW || gy >= w.GH) continue;
          const nx = (gx * w.CELL + w.CELL / 2 - cx) / rx, ny = (gy * w.CELL + w.CELL / 2 - cy) / ry;
          if (nx * nx + ny * ny <= 1) w.solid[gy * w.GW + gx] = 1;
        }
    };
    if (z.lake) paintIce(w, z.lake);
    // the great fire on its stone dais (the ash valley): drawn under everything standing on it, walkable
    if (z.dais && NC.SPR.ga_dais) { const f = FIRES[GREAT]; w.props.push({ kind: 'prop', name: 'ga_dais', x: f.x, y: f.y + 175, scale: 1, flip: false, sort: f.y - 420 }); }
    // the fire pits stand solid in their rings; each fire has a light that follows its firewood and colour
    w.gwFires = FIRES.map((f, i) => {
      const big = f.kind === 'great';
      mark(f.x, f.y - 6, big ? 150 : 82, big ? 62 : 36);
      const L = { x: f.x, y: f.y - 160, r: 0, rgb: '255,190,110', flick: i * 2.3, owner: { name: 'gwfire' } };
      w.lights.push(L);
      const ban = { kind: 'prop', name: 'gw_banner_none', x: f.x + (big ? 270 : 165), y: f.y - (big ? 70 : 40), scale: 1, flip: false, sort: f.y - (big ? 70 : 40), shadow: [18, 6] };
      w.props.push(ban);
      return { i, f, L, ban };
    });
    // the camps' own small fires (never taken): the side's flame, a wide light: where you come back to life
    for (const s of ['b', 'r']) {
      const C = CAMPS[s];
      mark(C.x, C.y - 6, 82, 36);
      w.lights.push({ x: C.x, y: C.y - 160, r: 560, rgb: SIDE[s].rgb, flick: s === 'b' ? 5 : 8, owner: { name: 'gwcamp' } });
    }
    w.gwTrees = w.props.filter((p) => z.chop.includes(p.name));
    w.spawn = { x: CAMPS.b.x, y: CAMPS.b.y + 140 };
    return w;
  };
  // the frozen lake: ice painted over the ground (both grounds: the minimap paints from the day one), cracks, a snow rim
  function paintIce(w, L) {
    for (const cv of [w.ground, w.groundDay]) {
      if (!cv) continue;
      const c = cv.getContext('2d'), k = w.GS;
      c.save(); c.scale(k, k);
      const pts = [];
      for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU, r = 1 + (NC.fbm(Math.cos(a) * 1.5 + 3, Math.sin(a) * 1.5 + 3, 71, 3) - 0.5) * 0.25; pts.push([L.x + Math.cos(a) * L.rx * r, L.y + Math.sin(a) * L.ry * r]); }
      const trace = () => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
      c.lineJoin = 'round';
      c.strokeStyle = 'rgb(176,192,214)'; c.lineWidth = 60; trace(); c.stroke();
      c.fillStyle = 'rgb(70,104,146)'; trace(); c.fill();
      c.save(); trace(); c.clip();
      const g = c.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.rx);
      g.addColorStop(0, 'rgba(140,190,230,0.55)'); g.addColorStop(1, 'rgba(40,70,120,0.4)');
      c.fillStyle = g; c.fillRect(L.x - L.rx * 1.3, L.y - L.ry * 1.3, L.rx * 2.6, L.ry * 2.6);
      const R = NC.rng(9031);
      c.strokeStyle = 'rgba(220,240,255,0.5)'; c.lineWidth = 4; c.lineCap = 'round';
      for (let n = 0; n < 70; n++) {
        let x = L.x + (R() - 0.5) * L.rx * 1.8, y = L.y + (R() - 0.5) * L.ry * 1.8;
        c.beginPath(); c.moveTo(x, y);
        for (let s = 0; s < 4; s++) { x += (R() - 0.5) * 160; y += (R() - 0.5) * 70; c.lineTo(x, y); }
        c.stroke();
      }
      c.fillStyle = 'rgba(235,245,255,0.35)';
      for (let n = 0; n < 160; n++) { c.beginPath(); c.ellipse(L.x + (R() - 0.5) * L.rx * 1.9, L.y + (R() - 0.5) * L.ry * 1.9, 20 + R() * 60, 4 + R() * 8, 0, 0, TAU); c.fill(); }
      c.restore();
      c.strokeStyle = NC.OUTLINE; c.lineWidth = 6; trace(); c.stroke();
      c.restore();
    }
  }

  // ---------------- the schedule: one war a week (Saturday 20:00 for an hour) ----------------
  function windowAt(t) {
    const len = RULES.minutes * 60000;
    const d = new Date(t), S = RULES.schedule;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() - S.day + 7) % 7), S.hour, 0, 0).getTime();
    if (t >= start && t < start + len) return { open: true, start, end: start + len, next: start };
    const next = t < start ? start : start + 7 * 86400000;
    return { open: false, start: next, end: next + len, next };
  }
  const weekOf = (t) => Math.floor((t / 86400000 + 3) / 7);
  const warWeek = () => weekOf(windowAt(now()).start); // the week of the war that is on or next

  // ---------------- who holds which land, who challenges (NC.Store) ----------------
  const S = NC.Store;
  const REG = { owners: {}, signs: {}, ready: false };
  if (S && S.watch) {
    S.watch('gwzone', (rows) => { REG.owners = {}; for (const r of rows || []) if (ZONE[r.id] && r.data && r.data.gid) REG.owners[r.id] = r.data; REG.ready = true; if (GW.ui.refresh) GW.ui.refresh(); });
    S.watch('gwsign', (rows) => {
      REG.signs = {};
      for (const r of rows || []) {
        const m = /^(gw_\w+)-(\d+)-([12])$/.exec(r.id);
        if (!m || !ZONE[m[1]] || +m[2] !== warWeek() || !r.data || !r.data.owner) continue;
        (REG.signs[m[1]] = REG.signs[m[1]] || [])[+m[3] - 1] = { gid: r.data.owner, name: r.data.name, at: r.data.at };
      }
      if (GW.ui.refresh) GW.ui.refresh();
    });
  }
  // the two sides of a land this week: the owner defends (blue) against the challenger (red); a free land: its two challengers
  function sidesOf(zid) {
    const o = REG.owners[zid], sg = (REG.signs[zid] || []).filter((q) => q && (!o || q.gid !== o.gid)); // (a challenger that already took it: not against itself)
    return o ? { owner: o.gid, b: { gid: o.gid, name: o.name }, r: sg[0] || null } : { owner: '', b: sg[0] || null, r: sg[1] || null };
  }
  const myGid = () => (NC.Guild && NC.Guild.gid && NC.Guild.gid()) || '';
  const myGuild = () => NC.Guild && NC.Guild.guild && NC.Guild.guild();
  // sign my guild up to challenge a land (the leader or an officer, before the war, one land a week)
  async function signUp(zid) {
    const gid = myGid(), gd = myGuild();
    if (!gid || !gd) return 'noguild';
    const rank = NC.Guild.rankOf ? NC.Guild.rankOf(NC.Guild.uid()) : 'leader';
    if (rank !== 'leader' && rank !== 'officer') return 'rank';
    if (windowAt(now()).open) return 'running';
    const wk = warWeek();
    for (const z of ZONES) if ((REG.signs[z.id] || []).some((q) => q && q.gid === gid)) return 'already';
    if (REG.owners[zid] && REG.owners[zid].gid === gid) return 'own';
    const name = (net() && net().clean ? net().clean(gd.name, 16) : String(gd.name).slice(0, 16));
    const slots = REG.owners[zid] ? [1] : [1, 2];
    for (const n of slots) if (await S.claim(`gwsign/${zid}-${wk}-${n}`, { owner: gid, name, at: now() })) return 'ok';
    return 'taken';
  }
  async function unSign(zid) {
    const gid = myGid(), wk = warWeek();
    const i = (REG.signs[zid] || []).findIndex((q) => q && q.gid === gid);
    if (i < 0 || windowAt(now()).open) return false;
    await S.del(`gwsign/${zid}-${wk}-${i + 1}`);
    return true;
  }

  // ---------------- the war state ----------------
  // the match (one per land): { id, zone, ph 'p' prep | 'f' fight | 'e' end | 'x' closed, t (s in this phase), left (s to the
  //   end), hold {b, r} (s each side held the great fire), gid {b, r}, nm {b, r}, owner (gid), fires [{ own, fuel, lit, by }], win }
  const GW = (NC.GW = {
    RULES, GEO, ZONES, ZONE, FIRES, CAMPS, ROADS, SIDE, GREAT, inRing, windowAt, other, warWeek, sidesOf, signUp, unSign, reg: REG,
    side: '', gid: '', match: null, host: false, me: { k: 0, d: 0, c: 0, w: 0, carry: 0 }, spawnAt: -1,
    feed: [], seen: {}, chop: null, ui: {}, // (gwar_ui.js fills ui)
    zone: () => { const g = G(); return (g && ZONE[g.mapId]) || null; },
    on: () => !!GW.zone(),
  });
  const sideName = (m, s) => (m && m.nm[s]) || (m && !m.owner ? SIDE[s].free : SIDE[s].name);
  GW.sideName = sideName;
  function startFires(m) { // the war begins: the owner holds the great fire and its own; the challenger its own
    const out = FIRES.map(() => ({ own: '', fuel: 0, lit: 0, by: '' }));
    const give = (i, s) => { out[i].own = s; out[i].fuel = K(FIRES[i]).max; out[i].by = s; };
    if (m.gid.b) give(0, 'b');
    if (m.gid.r) give(4, 'r');
    if (m.owner && m.gid.b === m.owner) give(GREAT, 'b');
    return out;
  }
  function newMatch(zid) {
    const win = windowAt(now()), sd = sidesOf(zid);
    return { id: zid.slice(3, 6) + now().toString(36), zone: zid, ph: 'p', t: 0, left: Math.max(60, (win.end - now()) / 1000), hold: { b: 0, r: 0 },
      gid: { b: (sd.b && sd.b.gid) || '', r: (sd.r && sd.r.gid) || '' }, nm: { b: (sd.b && sd.b.name) || '', r: (sd.r && sd.r.name) || '' }, owner: sd.owner || '',
      fires: FIRES.map((f) => ({ own: '', fuel: K(f).max, lit: 0, by: '' })), win: '' };
  }
  // packed for the presence: [id, ph, t, left, hold b, hold r, gid b, gid r, name b, name r, win, owner, (own, fuel, lit*10, by) x5]
  const SC = { '': 0, b: 1, r: 2 }, CS = ['', 'b', 'r'];
  function pack(m) {
    const a = [m.id, m.ph, Math.round(m.t * 10) / 10, Math.round(m.left), Math.round(m.hold.b), Math.round(m.hold.r), m.gid.b, m.gid.r, m.nm.b, m.nm.r, m.win, m.owner];
    for (const f of m.fires) a.push(SC[f.own], Math.round(f.fuel * 10) / 10, Math.round(f.lit * 10), SC[f.by]);
    return a;
  }
  const clean = (s, n) => (net() && net().clean ? net().clean(s, n) : String(s || '').slice(0, n));
  const fin = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  function unpack(a, zid) {
    if (!Array.isArray(a) || a.length < 12 + FIRES.length * 4 || typeof a[0] !== 'string') return null;
    const m = { id: a[0].slice(0, 16), zone: zid, ph: ['p', 'f', 'e', 'x'].includes(a[1]) ? a[1] : 'f', t: fin(a[2], 0, 1e5, 0), left: fin(a[3], -1e4, 1e5, 0),
      hold: { b: fin(a[4], 0, 1e5, 0), r: fin(a[5], 0, 1e5, 0) }, gid: { b: clean(a[6], 32), r: clean(a[7], 32) }, nm: { b: clean(a[8], 16), r: clean(a[9], 16) },
      win: CS.includes(a[10]) ? a[10] : '', owner: clean(a[11], 32), fires: [] };
    for (let i = 0; i < FIRES.length; i++) {
      const o = 12 + i * 4, mx = K(FIRES[i]).max;
      m.fires.push({ own: CS[a[o]] || '', fuel: fin(a[o + 1], 0, mx, 0), lit: fin(a[o + 2], 0, 999, 0) / 10, by: CS[a[o + 3]] || '' });
    }
    return m;
  }

  // ---------------- who is on this land (me and the other players) ----------------
  function people() {
    const g = G(), out = [], p = g && g.player;
    if (!p || !GW.on()) return out;
    if (GW.side) out.push({ peer: me(), side: GW.side, gid: GW.gid, x: p.x, y: p.y, alive: p.dead <= 0, mine: true, carry: GW.me.carry, name: p.name, lv: p.lv, job: p.job, k: GW.me.k, d: GW.me.d, c: GW.me.c, w: GW.me.w });
    const N = net();
    if (N && N.room) for (const r of N.remotes.values()) {
      if (!r.named || r.map !== g.mapId || !r.gw || !r.gw[1]) continue;
      out.push({ peer: r.peer, side: r.gw[1], gid: r.gw[2], x: r.x, y: r.y, alive: !r.dd, r, carry: r.gw[7] | 0, name: r.name, lv: r.lv, job: r.job, k: r.gw[3] | 0, d: r.gw[4] | 0, c: r.gw[5] | 0, w: r.gw[6] | 0 });
    }
    return out;
  }
  GW.people = people;

  // ---------------- the host: the lowest peer on the land runs its fires ----------------
  function hostPeer() {
    const g = G();
    let best = GW.side ? me() : null;
    const N = net();
    if (N && N.room) for (const r of N.remotes.values()) if (r.named && r.map === g.mapId && r.gw && r.gw[1] && (best === null || r.peer < best)) best = r.peer;
    return best;
  }
  const lightR = (f, st, ph) => (ph === 'p' || st.own || st.lit > 0 ? K(f).light[0] + K(f).light[1] * st.fuel : 0);
  function countRings(m) { // how many of each side stand in each ring
    const P = people().filter((q) => q.alive && q.side);
    FIRES.forEach((f, i) => {
      let nb = 0, nr = 0;
      for (const q of P) if (inRing(f, q.x, q.y)) { if (q.side === 'b') nb++; else nr++; }
      m.fires[i].nb = nb; m.fires[i].nr = nr;
    });
  }
  const smallHeld = (m, s) => m.fires.filter((st, i) => i !== GREAT && st.own === s).length;
  function hostStep(g, dt) {
    const m = GW.match;
    m.t += dt; m.left -= dt;
    if (m.ph === 'p') {
      if (!m.gid.b && !m.gid.r) { const sd = sidesOf(m.zone); m.gid = { b: (sd.b && sd.b.gid) || '', r: (sd.r && sd.r.gid) || '' }; m.nm = { b: (sd.b && sd.b.name) || '', r: (sd.r && sd.r.name) || '' }; m.owner = sd.owner || ''; }
      if (m.t >= RULES.prep) { m.ph = 'f'; m.t = 0; m.fires = startFires(m); }
      return;
    }
    if (m.ph === 'e') { if (m.t >= RULES.endHold) { m.ph = 'x'; m.t = 0; } return; }
    if (m.ph !== 'f') return;
    countRings(m);
    const P = people().filter((q) => q.alive && q.side && m.gid[q.side] && m.gid[q.side] === q.gid);
    FIRES.forEach((f, i) => {
      const st = m.fires[i], R = K(f);
      let nb = 0, nr = 0;
      for (const q of P) if (inRing(f, q.x, q.y)) { if (q.side === 'b') nb++; else nr++; }
      if (st.own) {
        const def = st.own === 'b' ? nb : nr, att = st.own === 'b' ? nr : nb, A = other(st.own);
        st.fuel -= R.burn * dt;
        if (att > def) st.fuel -= RULES.douse * Math.min(RULES.douseCap, att - def) * (1 + RULES.douseBonus * smallHeld(m, A)) * dt;
        if (st.fuel <= 0) { st.fuel = 0; st.by = A; st.own = ''; st.lit = 0; }
      } else {
        const one = nb > 0 && nr === 0 ? 'b' : nr > 0 && nb === 0 ? 'r' : '';
        if (one) {
          if (st.by !== one) { st.by = one; st.lit = 0; }
          st.lit += dt;
          if (st.lit >= RULES.lightS) { st.own = one; st.fuel = RULES.litFuel; st.lit = 0; }
        } else if (!(nb > 0 && nr > 0)) st.lit = Math.max(0, st.lit - dt * 0.5);
      }
    });
    const gf = m.fires[GREAT].own;
    if (gf) m.hold[gf] += dt;
    if (m.left <= 0) {
      m.ph = 'e'; m.t = 0;
      m.win = gf || (m.owner && m.gid.b === m.owner ? 'b' : '');
      settle(m);
    }
  }
  // the land's new holder (the host writes it once)
  function settle(m) {
    if (m.settled) return;
    m.settled = true;
    const gid = m.win && m.gid[m.win];
    if (!gid || gid.startsWith('test_') || !S) return;
    S.set('gwzone/' + m.zone, { gid, name: m.nm[m.win] || '', week: warWeek(), at: now(), held: Math.round(m.hold[m.win]) });
  }
  // firewood the others put in (their presence gwd: [seq, fire, n]); the host applies each once
  function hostWood(r, list) {
    if (!GW.match || !Array.isArray(list)) return;
    const top = Math.max(0, ...list.map((v) => (Array.isArray(v) ? v[0] | 0 : 0)));
    if (GW.seen['w' + r.peer] === undefined) { GW.seen['w' + r.peer] = top; return; }
    for (const v of list) {
      if (!Array.isArray(v) || (v[0] | 0) <= GW.seen['w' + r.peer]) continue;
      GW.seen['w' + r.peer] = v[0] | 0;
      addWood(v[1] | 0, r.gw && r.gw[1], Math.min(3, v[2] | 0));
    }
  }
  function addWood(i, side, n) {
    const m = GW.match, f = FIRES[i], st = m && m.fires[i];
    if (!st || !f || !side || st.own !== side || m.ph !== 'f') return;
    st.fuel = Math.min(K(f).max, st.fuel + RULES.wood * n);
  }

  // ---------------- what I tell the others ----------------
  let woodSeq = 0, deathSeq = 0, claimSeq = 0;
  const woodOut = [], deathOut = [], claims = [];
  const N0 = net();
  if (N0 && N0.fields) {
    N0.fields.push({ key: 'gw', get: () => (GW.on() && GW.side && GW.match ? [GW.match.id, GW.side, GW.gid, GW.me.k, GW.me.d, GW.me.c, GW.me.w, GW.me.carry] : null) });
    N0.fields.push({ key: 'gwm', get: () => (GW.on() && GW.host && GW.match ? pack(GW.match) : null) });
    N0.fields.push({ key: 'gwd', get: () => (GW.on() && woodOut.length ? woodOut.slice(-6) : null) });
    N0.fields.push({ key: 'gwx', get: () => (GW.on() && deathOut.length ? deathOut.slice(-4) : null) });
    N0.fields.push({ key: 'gwh', get: () => (GW.on() && claims.length ? claims.slice(-12) : null) });
    N0.fields.push({ key: 'gwk', get: () => {
      const g = G(), p = g && g.player;
      if (!GW.on() || !p || !p.d) return null;
      const s = p.d;
      return [Math.round(p.maxHp), Math.round(s.def || 0), Math.round(s.vdef || 0), Math.round(s.mdef || 0), Math.round(s.imdef || 0), Math.round(s.flee || 0), s.element || 'neutral', Math.round(p.hp)];
    } });
    N0.hooks.push(hear);
  }
  function hear(r, pr, first) {
    r.gw = Array.isArray(pr.gw) && typeof pr.gw[0] === 'string' ? [pr.gw[0].slice(0, 16), CS.includes(pr.gw[1]) ? pr.gw[1] : '', clean(pr.gw[2], 32), fin(pr.gw[3], 0, 9999, 0), fin(pr.gw[4], 0, 9999, 0), fin(pr.gw[5], 0, 9999, 0), fin(pr.gw[6], 0, 99999, 0), fin(pr.gw[7], 0, 3, 0)] : null;
    r.gwm = pr.gwm && ZONE[r.map] ? unpack(pr.gwm, r.map) : null;
    if (r.gwm) r.gwmT = now();
    r.gwk = Array.isArray(pr.gwk) ? pr.gwk : null;
    const g = G();
    if (!GW.on() || !g || r.map !== g.mapId) { GW.seen['w' + r.peer] = undefined; GW.seen['x' + r.peer] = undefined; GW.seen['h' + r.peer] = undefined; return; }
    if (GW.host) hostWood(r, pr.gwd);
    // their deaths: who got them (my kills), the kill feed
    const gx = Array.isArray(pr.gwx) ? pr.gwx : [];
    const top = Math.max(0, ...gx.map((v) => (Array.isArray(v) ? v[0] | 0 : 0)));
    if (first || GW.seen['x' + r.peer] === undefined) GW.seen['x' + r.peer] = top;
    else for (const v of gx.slice().sort((a, b) => a[0] - b[0])) {
      if (!Array.isArray(v) || (v[0] | 0) <= GW.seen['x' + r.peer]) continue;
      GW.seen['x' + r.peer] = v[0] | 0;
      const killer = typeof v[1] === 'string' ? v[1] : '';
      if (killer && killer === me()) { GW.me.k++; if (FX.text) FX.text(g.player.x, g.player.y - 210, 'ล้มศัตรู!', '#ffd27a', 30); }
      feed(`${nameOf(killer)} ล้ม ${r.name}`, r.gw ? other(r.gw[1]) : '');
    }
    // hit claims on me
    const hc = Array.isArray(pr.gwh) ? pr.gwh : [];
    const ht = Math.max(0, ...hc.map((c) => (Array.isArray(c) ? c[0] | 0 : 0)));
    if (first || GW.seen['h' + r.peer] === undefined) GW.seen['h' + r.peer] = ht;
    else for (const c of hc.slice().sort((a, b) => a[0] - b[0])) {
      if (!Array.isArray(c) || (c[0] | 0) <= GW.seen['h' + r.peer]) continue;
      GW.seen['h' + r.peer] = c[0] | 0;
      if (c[1] === me()) takeHit(g, { peer: r.peer, x: r.x, y: r.y, side: r.gw && r.gw[1] }, fin(c[2], 0, 1e7, 0), !!c[3], c[4] | 0, fin(c[5], 0, 10, 0));
    }
  }
  function nameOf(peer) {
    const g = G();
    if (!peer) return 'ความมืด';
    if (peer === me()) return (g && g.player && g.player.name) || 'คุณ';
    const r = net() && net().remotes.get(peer);
    return r ? r.name : '?';
  }
  function feed(text, side) {
    GW.feed.push({ text, side, t: now() });
    if (GW.feed.length > 6) GW.feed.shift();
    if (GW.ui.feed) GW.ui.feed();
  }
  GW.feedLine = feed;

  // ---------------- joining a land ----------------
  // the latest match seen in anyone's presence on that land (from the camp too: the war board shows it)
  function seenMatch(zid) {
    let best = null;
    const N = net();
    if (N && N.room) for (const r of N.remotes.values()) if (r.gwm && r.map === zid && (!best || r.gwmT > best.t)) best = { m: r.gwm, t: r.gwmT, peer: r.peer };
    return best;
  }
  GW.seenMatch = seenMatch;
  function mySide(zid, gid) {
    const sd = sidesOf(zid);
    return sd.b && sd.b.gid === gid ? 'b' : sd.r && sd.r.gid === gid ? 'r' : '';
  }
  GW.mySide = mySide;
  // can I go in? 'ok', or the reason
  GW.canEnter = function (zid) {
    const g = G();
    if (!g || !g.player || !ZONE[zid]) return 'wait';
    const gid = myGid();
    if (!gid) return 'noguild';
    const s = seenMatch(zid);
    if (!windowAt(now()).open && !(s && s.m.ph !== 'x')) return 'closed';
    if (s && (s.m.ph === 'e' || s.m.ph === 'x')) return 'over';
    const side = mySide(zid, gid);
    if (!side) return 'notyours';
    if (people().filter((q) => q.side === side).length >= RULES.perSide) return 'crowd';
    return 'ok';
  };
  GW.enter = function (zid) {
    const g = G(), why = GW.canEnter(zid);
    if (why !== 'ok') return why;
    GW.gid = myGid(); GW.side = mySide(zid, GW.gid);
    const s = seenMatch(zid);
    GW.match = s ? Object.assign({}, s.m) : null;
    GW.me = { k: 0, d: 0, c: 0, w: 0, carry: 0 }; GW.spawnAt = -1; GW.chop = null; GW.feed = []; GW.endSeen = false; GW.seen = {}; GW.arrive = true;
    if (NC.Auto && NC.Auto.on) NC.Auto.toggle(g); // (no auto farm in a war)
    NC.Maps.go(g, zid);
    return 'ok';
  };
  GW.leave = function (why) {
    const g = G();
    GW.side = ''; GW.host = false; GW.chop = null; dropProxies(g);
    if (g && ZONE[g.mapId]) {
      NC.Maps.go(g, 'camp');
      setTimeout(() => { const gg = G(); if (gg && gg.mapId === 'camp') { gg.player.x = GATE.x; gg.player.y = GATE.y + 170; } unpaint(); if (GW.ui.hud) GW.ui.hud(); }, 420);
    }
    if (why) NC.HUD.log(why, 'sys');
  };

  // ---------------- every frame on a land ----------------
  let lastFires = null, hudT = 0, warnT = 0;
  function frame(g, dt) {
    const p = g.player, z = GW.zone();
    if (!z) { if (GW.side) { GW.side = ''; GW.host = false; dropProxies(g); } lastFires = null; return; }
    // on a land without a side after a reload: join if the war is on for my guild, else back to the camp
    if (!GW.side || (GW.match && GW.match.zone !== z.id)) {
      if (GW.server) return; // (?online: the server's record says the side, js/online/gwar.js)
      GW.side = '';
      if (GW.canEnter(z.id) === 'ok') { GW.gid = myGid(); GW.side = mySide(z.id, GW.gid); const s = seenMatch(z.id); GW.match = s ? Object.assign({}, s.m) : null; GW.arrive = true; GW.me = { k: 0, d: 0, c: 0, w: 0, carry: 0 }; }
      if (!GW.side) { GW.leave('ศึกชิงกองไฟยังไม่เปิดสำหรับกิลด์ของคุณ · กลับค่าย'); return; }
    }
    if (NC.Auto && NC.Auto.on) { NC.Auto.toggle(g); g.toast('ในศึกชิงกองไฟใช้ออโต้ไม่ได้'); }
    // who runs this land's war
    const hp = GW.server ? '' : hostPeer(), wasHost = GW.host; // (?online: the server runs the war, js/online/gwar.js)
    GW.host = hp === me();
    if (GW.host) {
      if (!wasHost) { // taking over: the freshest state anyone sent, or a new war
        const s = seenMatch(z.id);
        if (s && (!GW.match || s.m.id === GW.match.id)) GW.match = Object.assign({}, s.m);
        for (const r of (net() && net().remotes.values()) || []) GW.seen['w' + r.peer] = undefined;
      }
      if (!GW.match) GW.match = newMatch(z.id);
      hostStep(g, dt);
    } else {
      const r = net() && net().remotes.get(hp);
      if (r && r.gwm) GW.match = r.gwm;
    }
    const m = GW.match;
    if (!m) return;
    if (!GW.host) countRings(m);
    if (GW.arrive) { GW.arrive = false; p.x = CAMPS[GW.side].x; p.y = CAMPS[GW.side].y + 140; p.vx = p.vy = 0; }
    // the fires changed hands: the feed, and my credit for a fire I helped light
    if (lastFires && m.ph === 'f' && lastFires.ph === 'f') m.fires.forEach((st, i) => {
      const was = lastFires[i];
      if (!was || was.own === st.own) return;
      const f = FIRES[i];
      if (st.own) {
        feed(`${sideName(m, st.own)} จุด${f.name}`, st.own);
        if (st.own === GW.side && p.dead <= 0 && inRing(f, p.x, p.y, 40)) { GW.me.c++; if (FX.text) FX.text(p.x, p.y - 210, 'จุดไฟสำเร็จ!', SIDE[GW.side].col, 30); }
        if (i === GREAT && GW.ui.big) GW.ui.big(st.own === GW.side ? 'เรายึดกองไฟใหญ่!' : 'กองไฟใหญ่ถูกยึด!', sideName(m, st.own));
      } else feed(`${f.name}ดับแล้ว`, other(was.own));
    });
    if (lastFires && lastFires.ph === 'p' && m.ph === 'f' && GW.ui.big) GW.ui.big('เริ่มศึก!', m.owner ? `${sideName(m, 'b')} ป้องกันกองไฟใหญ่` : 'กองไฟใหญ่ยังไม่มีเจ้าของ');
    if (m.ph === 'f' && m.left < 60 && m.left > 10.5 && (warnT -= dt) <= 0 && Math.ceil(m.left) % 20 === 0) { warnT = 2; if (GW.ui.big) GW.ui.big(`อีก ${Math.ceil(m.left)} วินาที`, 'ใครถือกองไฟใหญ่ตอนหมดเวลา ได้ครองดินแดน'); }
    // the last ten seconds: a big count
    if (m.ph === 'f' && m.left <= 10.5 && m.left > 0 && Math.ceil(m.left) !== GW.lastCount) { GW.lastCount = Math.ceil(m.left); if (GW.ui.big) GW.ui.big(String(GW.lastCount), `กองไฟใหญ่: ${m.fires[GREAT].own ? sideName(m, m.fires[GREAT].own) : 'ไม่มีใครถือ'}`); }
    lastFires = m.fires.map((st) => ({ own: st.own })); lastFires.ph = m.ph;
    // the end
    if (m.ph === 'e' && !GW.endSeen) { GW.endSeen = true; if (!GW.server) reward(g, m); } // (?online: the server pays, its end event shows it)
    if (m.ph === 'x' || (m.ph === 'e' && m.t > RULES.endHold + 3)) { GW.leave('ศึกชิงกองไฟจบแล้ว'); return; }
    // where I come back to life; the respawn wait
    g.world.spawn = spawnPoint(g);
    if (p.dead > 0) p.dead = Math.min(p.dead, RULES.respawnS);
    vision(g);
    if (m.ph === 'f' && !GW.server) { keepProxies(g); tickCC(g, dt); } else dropProxies(g); // (?online: the server's stand-ins take the hits)
    chopStep(g, dt);
    feedStep(g, dt);
    keepFx(g);
    lights(g);
    if ((hudT += dt) > 0.5) { hudT = 0; if (GW.ui.hud) GW.ui.hud(); }
  }

  // where to come back: the camp, or one of my side's fires that no enemy stands in
  function enemyIn(f) { return people().some((q) => q.alive && q.side && q.side !== GW.side && inRing(f, q.x, q.y, 60)); }
  function spawnOk(i) {
    const m = GW.match, st = m && m.fires[i];
    return !!(st && m.ph === 'f' && st.own === GW.side && !enemyIn(FIRES[i]));
  }
  GW.spawnOk = spawnOk;
  function spawnPoint() {
    const C = CAMPS[GW.side] || CAMPS.b;
    if (GW.spawnAt >= 0 && spawnOk(GW.spawnAt)) { const f = FIRES[GW.spawnAt]; return { x: f.x, y: f.y + K(f).ring * SQ * 0.6 }; }
    return { x: C.x, y: C.y + 140 };
  }

  // ---------------- the dark: who I can see ----------------
  function litAt(x, y) {
    const m = GW.match;
    if (!m) return false;
    for (let i = 0; i < FIRES.length; i++) {
      const f = FIRES[i], r = lightR(f, m.fires[i], m.ph) * 0.8;
      if (r > 0 && Math.hypot(x - f.x, (y - f.y) / 0.8) < r) return true;
    }
    for (const s of ['b', 'r']) if (Math.hypot(x - CAMPS[s].x, (y - CAMPS[s].y) / 0.8) < 460) return true;
    return false;
  }
  GW.litAt = litAt;
  function seesIt(x, y, P) {
    if (litAt(x, y)) return true;
    for (const q of P) if (q.side === GW.side && Math.hypot(q.x - x, q.y - y) < RULES.vision) return true;
    return false;
  }
  function vision(g) {
    const P = people(), N = net();
    if (N && N.room) for (const r of N.remotes.values()) {
      if (r.map !== g.mapId || !r.gw) { r.gwHide = false; continue; }
      r.gwHide = !!(r.gw[1] && r.gw[1] !== GW.side && !seesIt(r.x, r.y, P));
      const Sd = SIDE[r.gw[1]];
      if (Sd) { if (!r.gwCol0) r.gwCol0 = r.color; r.color = Sd.col; r.def.color = Sd.col; }
    }
  }
  function unpaint() { // back in the camp: the others' colours come back
    const N = net();
    if (N && N.room) for (const r of N.remotes.values()) { r.gwHide = false; if (r.gwCol0) { r.color = r.gwCol0; r.def.color = r.gwCol0; r.gwCol0 = null; } }
  }

  // ---------------- hits between the sides (pvp.js's way: stand-ins and claims) ----------------
  const PR = () => (NC.PvP && NC.PvP.RULES) || { dmg: 0.4, crit: 0.75, cap: 0.35, cc: 0.5, slow: 0.5, dr: 15, immune: 10 };
  const proxies = new Map();
  function keepProxies(g) {
    const want = new Set();
    for (const q of people()) {
      if (q.mine || !q.side || q.side === GW.side || !q.alive) continue;
      if (q.r.gwHide) continue;
      want.add(q.peer);
      let e = proxies.get(q.peer);
      const st = q.r.gwk || [q.r.maxHp || 1000, 0, 0, 0, 0, 0, 'neutral', 1000];
      if (!e) {
        e = NC.makeDummy({ name: q.name, lv: q.lv || 1, element: st[6] || 'neutral', def: st[1], vdef: st[2], mdef: st[3], imdef: st[4], flee: st[5], note: '' }, q.x, q.y);
        e.type = 'pvpfoe'; e.gwp = q.peer; e.r = 22;
        proxies.set(q.peer, e);
      }
      e.def = st[1]; e.vdef = st[2]; e.mdef = st[3]; e.imdef = st[4]; e.flee = st[5]; e.element = st[6] || 'neutral';
      e.maxHp = Math.max(1, st[0]);
      e.hp = Math.max(1, Math.round(((q.r.hpPct || 0) / 100) * e.maxHp)); e.dead = false;
      e.x = e.sx = e.wx = q.x; e.y = e.sy = e.wy = q.y; e.sort = q.y; e.kbx = e.kby = 0;
      if (!g.enemies.includes(e)) g.enemies.push(e);
    }
    for (const peer of [...proxies.keys()]) if (!want.has(peer)) proxies.delete(peer);
    g.enemies = g.enemies.filter((e) => !e.gwp || proxies.get(e.gwp) === e);
  }
  function dropProxies(g) {
    proxies.clear();
    if (g && g.enemies) g.enemies = g.enemies.filter((e) => !e.gwp);
  }
  // a hit on a stand-in: the number here, and the claim sent to the other player
  function claim(g, e, r0, o) {
    const m = GW.match;
    if (!m || m.ph !== 'f') return;
    const top = (NC.labelTop ? NC.labelTop(e) : e.y - 130) - 52, R = PR();
    if (r0.miss) { e.numDir = -(e.numDir || 1); FX.dmg(e.x, top, 'MISS', { size: 32, fill: '#cfd8ff', dir: e.numDir }); return; }
    const raw = Math.max(1, Math.round(r0.dmg)), shown = Math.max(1, Math.round(raw * R.dmg * (r0.crit ? R.crit : 1)));
    e.numDir = -(e.numDir || 1);
    if (o && o.dot) FX.num(e.x, top + 30, shown, { size: 30, fill: (o && o.fill) || '#9be35a' });
    else { FX.dmg(e.x, top, shown, { size: r0.crit ? 56 : 44, fill: r0.crit ? '#ffe066' : '#ffffff', crit: r0.crit, dir: e.numDir }); FX.sparks(e.x, e.y - 45, 5, (o && o.color) || '255,255,255'); }
    const rr = net() && net().remotes.get(e.gwp);
    if (rr) rr.hurt = 0.25;
    push(e.gwp, raw, r0.crit ? 1 : 0, 0, 0);
  }
  function push(peer, dmg, crit, st, dur) {
    claims.push([++claimSeq, peer, dmg, crit, st, Math.round(dur * 10) / 10]);
    if (claims.length > 24) claims.splice(0, claims.length - 24);
  }
  function statusOut(e) {
    if (e.stun > 0) { push(e.gwp, 0, 0, 1, e.stun); e.stun = 0; }
    if (e.frozen > 0) { push(e.gwp, 0, 0, 2, e.frozen); e.frozen = 0; }
    if (e.slow > 0.05) { push(e.gwp, 0, 0, 3, e.slow); e.slow = 0; }
  }
  // a hit on me from another player's claim
  let attacker = null;
  const cc = { hard: [], immune: 0, stun: 0, slow: 0 };
  const rate = [];
  function takeHit(g, from, dmg, crit, st, dur) {
    const m = GW.match, p = g && g.player;
    if (!m || m.ph !== 'f' || !p || p.dead > 0 || !GW.side || from.side === GW.side) return;
    if (Math.hypot(from.x - p.x, from.y - p.y) > 1700) return; // (too far to be real)
    const t = now();
    while (rate.length && rate[0] < t - 1000) rate.shift();
    rate.push(t);
    if (rate.length > 60) return;
    if (p.evade > 0) { if (FX.text) FX.text(p.x, p.y - 190, 'หลบ!', '#d8ecff', 28); return; }
    const R = PR();
    if (dmg > 0) {
      let v = Math.round(dmg * R.dmg * (crit ? R.crit : 1));
      v = Math.max(1, Math.min(v, Math.round(p.maxHp * R.cap)));
      const inv = p.inv; p.inv = 0;
      attacker = from.peer;
      try { NC.hurtPlayer(g, v, from.x); } finally { attacker = null; }
      if (p.inv < inv) p.inv = inv;
      if (GW.chop) { GW.chop = null; g.toast('โดนโจมตี · หยุดตัดไม้'); }
    }
    if (st) applyCC(g, st, dur);
  }
  GW.takeHit = takeHit;
  function applyCC(g, st, dur) {
    const p = g.player, t = g.time, R = PR();
    if (st === 3) { cc.slow = Math.max(cc.slow, dur * R.slow); return; }
    if (cc.immune > t) { if (FX.text) FX.text(p.x, p.y - 190, 'ต้านทาน', '#cfe0ff', 26); return; }
    cc.hard = cc.hard.filter((x) => x > t - R.dr);
    const k = [1, 0.5, 0.25][cc.hard.length];
    cc.hard.push(t);
    if (k === undefined) { cc.immune = t + R.immune; return; }
    const len = dur * R.cc * k;
    if (cc.hard.length === 3) cc.immune = t + len + R.immune;
    cc.stun = Math.max(cc.stun, len);
    if (FX.text) FX.text(p.x, p.y - 190, st === 2 ? 'แข็ง!' : 'มึน!', st === 2 ? '#bfe8ff' : '#ffe08a', 30);
  }
  function tickCC(g, dt) { cc.stun = Math.max(0, cc.stun - dt); cc.slow = Math.max(0, cc.slow - dt); }
  // the blow that would end me: I fall in the war (no EXP lost, no walk back to the camp), the killer gets the credit
  if (NC.heroGuards) NC.heroGuards.push((g, p, dmg) => {
    if (!GW.on() || !GW.side || !GW.match || GW.match.ph !== 'f') return dmg;
    const taken = p.d && p.d.taken ? 1 - p.d.taken / 100 : 1;
    if (dmg * taken < p.hp) return dmg;
    fall(g, attacker);
    return 0;
  });
  function fall(g, killer) {
    const p = g.player;
    p.hp = 0; p.dead = RULES.respawnS; p.atk.on = false;
    GW.me.d++;
    deathOut.push([++deathSeq, killer || '']);
    if (deathOut.length > 8) deathOut.shift();
    const lost = GW.me.carry; GW.me.carry = 0; GW.chop = null;
    FX.puff(p.x, p.y - 30, 10, { speed: 150, color: '120,110,140' });
    feed(`${nameOf(killer)} ล้ม ${p.name || 'คุณ'}`, other(GW.side));
    NC.HUD.log(`คุณล้มในศึก${lost ? ` · ฟืน ${lost} มัดหล่นหาย` : ''} · ฟื้นใน ${RULES.respawnS} วินาที (ตายไม่เสียอะไร)`, 'warn');
    if (GW.ui.dead) GW.ui.dead(true);
  }

  // ---------------- firewood: chop the land's trees, feed my fires ----------------
  function treeNear(g, x, y, reach) {
    let best = null, bd = reach || 150;
    for (const t of g.world.gwTrees || []) { const d = Math.hypot(t.x - x, (t.y - y) * 1.3); if (d < bd) { bd = d; best = t; } }
    return best;
  }
  GW.treeNear = treeNear;
  function startChop(g, t) {
    if (GW.server && GW.server.chop) return GW.server.chop(g, t); // (?online: the server chops)
    const p = g.player, m = GW.match;
    if (!m || (m.ph !== 'f' && m.ph !== 'p') || p.dead > 0) return false;
    if (GW.me.carry >= RULES.carry) { g.toast(`ถือฟืนได้สูงสุด ${RULES.carry} มัด · ไปเติมไฟฝั่งเรา`); return true; }
    GW.chop = { tree: t, t: 0, swing: 0 };
    p.face = t.x > p.x ? 1 : -1;
    return true;
  }
  function chopStep(g, dt) {
    const c = GW.chop, p = g.player;
    if (!c) return;
    if (p.dead > 0 || p.moving || p.atk.on || p.dash) { GW.chop = null; return; }
    c.t += dt; c.swing -= dt;
    if (c.swing <= 0) {
      c.swing = 0.75;
      const clip = ['slash1', 'attack1', 'chop'].find((n) => NC.Anim.CLIPS[n]);
      if (clip) NC.Anim.play(p.anim, clip);
      FX.puff(c.tree.x + (p.x < c.tree.x ? -24 : 24), c.tree.y - 60, 3, { speed: 90, size: 0.5, color: '170,150,140' });
    }
    if (c.t >= RULES.chopS) {
      if (!GW.server) GW.me.carry++; // (?online: the server's count)
      woodFly(c.tree.x, c.tree.y - 90, p);
      if (GW.me.carry >= RULES.carry) { GW.chop = null; g.toast(`ฟืนเต็ม ${RULES.carry} มัด · เดินเข้าวงไฟฝั่งเราเพื่อเติม`); }
      else c.t = 0;
    }
  }
  function woodFly(x, y, to) {
    if (!NC.SPR.gw_wood) return;
    FX.add({ type: 'custom', layer: 'glow', life: 0.55, x, y, draw(ctx, q, u) {
      const k = u * u, tx = to.x, ty = to.y - 110;
      NC.drawSpr(ctx, 'gw_wood', x + (tx - x) * k, y + (ty - y) * k - Math.sin(u * Math.PI) * 90, { scale: 0.55 + 0.15 * (1 - u), alpha: 1 - 0.3 * u });
    } });
  }
  let feedAcc = 0;
  function feedStep(g, dt) {
    if (GW.server) return; // (?online: the server feeds the fire the hero stands by)
    const p = g.player, m = GW.match;
    if (!m || m.ph !== 'f' || p.dead > 0 || !GW.me.carry) { feedAcc = 0; return; }
    const i = FIRES.findIndex((f, j) => m.fires[j].own === GW.side && inRing(f, p.x, p.y) && m.fires[j].fuel < K(f).max - 4);
    if (i < 0) { feedAcc = 0; return; }
    if ((feedAcc += dt) < RULES.feedS) return;
    feedAcc = 0;
    GW.me.carry--; GW.me.w++;
    const f = FIRES[i];
    if (GW.host) addWood(i, GW.side, 1);
    else { woodOut.push([++woodSeq, i, 1]); if (woodOut.length > 12) woodOut.shift(); }
    if (NC.SPR.gw_wood) FX.add({ type: 'custom', layer: 'glow', life: 0.45, x: p.x, y: p.y, draw(ctx, q, u) {
      NC.drawSpr(ctx, 'gw_wood', p.x + (f.x - p.x) * u, p.y - 100 + (f.y - 80 - p.y + 100) * u - Math.sin(u * Math.PI) * 80, { scale: 0.5, alpha: 1 - u * 0.5 });
    } });
    if (FX.text) FX.text(f.x, f.y - 240, `+${RULES.wood} ฟืน`, '#ffd27a', 26);
  }
  // B next to a tree of the land (B is the pouch elsewhere; life.js has no trees here), or a click on its trunk
  const typing = () => { const t = document.activeElement; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); };
  addEventListener('keydown', (e) => {
    const g = G();
    if (!GW.on() || !g || !g.player || g.paused || e.repeat || typing() || e.code !== 'KeyB') return;
    const t = treeNear(g, g.player.x, g.player.y, 170);
    if (!t) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (!GW.chop) startChop(g, t);
  }, true);
  addEventListener('mousedown', (e) => {
    const g = G();
    if (e.button !== 0 || !GW.on() || !g || !g.player || g.paused || e.target !== document.getElementById('view')) return;
    const wx = g.cam.x + (e.clientX * g.dpr) / g.scale, wy = g.cam.y + (e.clientY * g.dpr) / g.scale;
    const t = (g.world.gwTrees || []).find((q) => Math.abs(wx - q.x) < 60 && wy > q.y - 260 && wy < q.y + 10);
    if (!t || Math.hypot(t.x - g.player.x, t.y - g.player.y) > 230) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (!GW.chop) startChop(g, t);
  }, true);

  // ---------------- the end: rewards (once a war), the window (gwar_ui.js), back to the camp ----------------
  if (NC.MATERIALS) {
    NC.MATERIALS.mat_warember = { name: 'ถ่านศึก', price: 0, rare: true, keep: true, noNpc: true, desc: 'ถ่านที่ยังคุจากศึกชิงกองไฟ เก็บไว้แลกของรางวัลศึก (ความสะดวกและของแต่งตัว ไม่มีพลัง)' };
    const baseIcon = NC.matIcon;
    if (baseIcon) NC.matIcon = (id) => (id === 'mat_warember' && NC.ASSET_MANIFEST.gw_ember ? NC.ASSET_MANIFEST.gw_ember.src : baseIcon(id));
    const baseSource = NC.matSource;
    if (baseSource) NC.matSource = (id) => (id === 'mat_warember' ? 'ศึกชิงกองไฟ: เล่นจนจบศึก (ฝั่งชนะได้ ×1.5 และโบนัสครองดินแดน)' : baseSource(id));
  }
  let minuteT = 0;
  function reward(g, m) {
    const Rw = RULES.reward, mins = Math.min(RULES.minutes, minuteT / 60);
    let n = Rw.base + GW.me.c * Rw.perCap + GW.me.k * Rw.perKill + GW.me.w * Rw.perWood + mins * Rw.perMin;
    const won = !!m.win && m.win === GW.side;
    if (won) n = n * Rw.win + Rw.land;
    n = Math.min(Rw.cap, Math.round(n));
    let got = [];
    try { got = JSON.parse(localStorage.getItem('nightcamp.gwar.got') || '[]'); } catch (e) { got = []; }
    const fresh = !got.includes(m.id);
    if (fresh && NC.addMat) {
      NC.addMat(g, 'mat_warember', n);
      got.push(m.id); try { localStorage.setItem('nightcamp.gwar.got', JSON.stringify(got.slice(-20))); } catch (e) { /* full */ }
      NC.HUD.log(`ศึกชิงกองไฟจบ · ${won ? 'ฝั่งเราครองดินแดน!' : m.win ? 'ฝั่งเราแพ้' : 'ไม่มีใครได้ดินแดน'} · ถ่านศึก +${n}`, 'level');
    }
    GW.lastReward = { n: fresh ? n : 0, won, win: m.win };
    if (GW.ui.end) GW.ui.end(m);
  }

  // ---------------- drawn in the world: pits, flames, rings ----------------
  const FLAME = { b: ['gw_fl_blue_a', 'gw_fl_blue_b'], r: ['gw_fl_red_a', 'gw_fl_red_b'], g: ['gw_fl_gold_a', 'gw_fl_gold_b'] };
  function drawFirePit(ctx, x, y, big, fl, scale, t, seed) {
    const pit = big ? 'gw_bigpit' : 'gw_smallpit', s = NC.SPR[pit];
    if (!s) return;
    NC.drawSpr(ctx, pit, x, y);
    if (!fl) return;
    const fr = FLAME[fl], k = Math.floor(t * 7 + seed) % 2, F = NC.SPR[fr[k]];
    if (F) {
      const sway = Math.sin(t * 5.3 + seed) * 0.05, sy = 1 + Math.sin(t * 9.1 + seed * 2) * 0.05;
      ctx.save();
      ctx.translate(x, y - s.h * (big ? 0.26 : 0.3));
      ctx.transform(1, 0, sway, 1, 0, 0);
      ctx.scale(scale, scale * sy);
      NC.drawSpr(ctx, fr[k], 0, 0);
      ctx.restore();
    }
    // the pit's front stones and the logs' feet over the flame's base
    ctx.save();
    ctx.beginPath(); ctx.rect(x - s.w, y - s.h * (big ? 0.3 : 0.36), s.w * 2, s.h);
    ctx.clip();
    NC.drawSpr(ctx, pit, x, y);
    ctx.restore();
  }
  FX.def('gwFire', (ctx, q) => {
    const g = G(), m = GW.match;
    if (!g || !ZONE[g.mapId]) { q.dead = true; return; }
    const t = g.time || 0;
    if (q.camp) { drawFirePit(ctx, q.x, q.y, false, q.camp, 0.5, t, q.seed); return; }
    const f = FIRES[q.i], st = m && m.fires[q.i], big = f.kind === 'great', R = K(f);
    if (!st) { drawFirePit(ctx, f.x, f.y, big, null, 0, t, q.seed); return; }
    if (m.ph === 'p') { drawFirePit(ctx, f.x, f.y, big, 'g', big ? 1.15 : 0.62, t, q.seed); return; }
    if (st.own) { drawFirePit(ctx, f.x, f.y, big, st.own, (big ? 1.2 : 0.66) * (0.5 + 0.5 * st.fuel / R.max), t, q.seed); return; }
    const ash = big ? 'gw_bigash' : 'gw_smallash';
    if (st.lit > 0 && st.by) drawFirePit(ctx, f.x, f.y, big, st.by, (big ? 0.3 : 0.18) + (big ? 0.5 : 0.3) * (st.lit / RULES.lightS), t, q.seed);
    else if (NC.SPR[ash]) NC.drawSpr(ctx, ash, f.x, f.y);
  });
  FX.def('gwRings', (ctx, q) => {
    const g = G(), m = GW.match;
    if (!g || !ZONE[g.mapId]) { q.dead = true; return; }
    if (!m || m.ph !== 'f') return;
    const t = g.time || 0;
    FIRES.forEach((f, i) => {
      const st = m.fires[i], R = K(f).ring, col = st.own ? SIDE[st.own].rgb : st.by && st.lit > 0 ? SIDE[st.by].rgb : '230,225,240';
      const fight = st.nb > 0 && st.nr > 0;
      ctx.save();
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,16,30,0.5)';
      ctx.beginPath(); ctx.ellipse(f.x, f.y, R, R * SQ, 0, 0, TAU); ctx.stroke();
      ctx.lineWidth = 3.5; ctx.strokeStyle = `rgba(${col},${(st.own ? 0.55 : 0.35) + (fight ? 0.25 * Math.sin(t * 8) : 0)})`;
      if (!st.own) ctx.setLineDash([22, 16]);
      ctx.beginPath(); ctx.ellipse(f.x, f.y, R, R * SQ, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    });
  });
  function keepFx(g) {
    const w = g.world;
    if (!w.gwFx || w.gwFx.some((q) => q.dead || !FX.list.includes(q))) {
      if (w.gwFx) for (const q of w.gwFx) q.dead = true;
      w.gwFx = FIRES.map((f, i) => FX.add({ type: 'gwFire', layer: 'sorted', x: f.x, y: f.y, sort: f.y + 2, life: 1e9, i, seed: i * 1.7 }));
      for (const s of ['b', 'r']) w.gwFx.push(FX.add({ type: 'gwFire', layer: 'sorted', x: CAMPS[s].x, y: CAMPS[s].y, sort: CAMPS[s].y + 2, life: 1e9, camp: s, seed: s === 'b' ? 3 : 5 }));
      w.gwFx.push(FX.add({ type: 'gwRings', layer: 'low', x: 0, y: 0, life: 1e9 }));
    }
  }
  // each fire's light: the holder's colour, as wide as its firewood; the banner by it shows who holds it
  function lights(g) {
    const m = GW.match;
    for (const o of g.world.gwFires || []) {
      const st = m && m.fires[o.i];
      if (!st) continue;
      const R = lightR(o.f, st, m.ph);
      o.L.r = m.ph === 'p' || st.own ? R : st.lit > 0 ? 160 + 120 * (st.lit / RULES.lightS) : 90;
      o.L.rgb = m.ph === 'p' ? '255,190,110' : st.own ? SIDE[st.own].rgb : st.lit > 0 && st.by ? SIDE[st.by].rgb : '255,120,70';
      o.ban.name = st.own && m.ph === 'f' ? SIDE[st.own].banner : 'gw_banner_none';
    }
  }

  // world-space marks over the night: each fire's firewood bar and lighting ring, names, wood on backs, chopping
  const baseLabels = NC.Maps.drawLabels;
  NC.Maps.drawLabels = function (ctx, game) {
    baseLabels.apply(this, arguments);
    if (game.mapId === 'camp' && game.world && game.world.gwGate) drawGateLabel(ctx, game);
    if (!GW.on() || !GW.match) return;
    const m = GW.match, p = game.player, t = game.time;
    FIRES.forEach((f, i) => {
      const st = m.fires[i], R = K(f), d = Math.hypot(p.x - f.x, p.y - f.y);
      if (d > 1500) return;
      const a = NC.clamp((1500 - d) / 400, 0, 1), y = f.y - (f.kind === 'great' ? 470 : 300);
      label(ctx, f.name + (f.kind === 'great' ? ' · หัวใจดินแดน' : ''), f.x, y - 34, a, st.own ? SIDE[st.own].col : '#e8e2f2', f.kind === 'great' ? 30 : 26);
      if (m.ph !== 'f') return;
      const w = f.kind === 'great' ? 200 : 150, h = 14, x0 = f.x - w / 2;
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = NC.OUTLINE; NC.rrect(ctx, x0 - 3, y - 3, w + 6, h + 6, 10); ctx.fill();
      ctx.fillStyle = '#3b3346'; NC.rrect(ctx, x0, y, w, h, 7); ctx.fill();
      if (st.own) { ctx.fillStyle = SIDE[st.own].col; NC.rrect(ctx, x0, y, Math.max(h, w * st.fuel / R.max), h, 7); ctx.fill(); }
      ctx.restore();
      if (!st.own && st.lit > 0 && st.by) { // lighting: a ring that fills
        ctx.save(); ctx.globalAlpha = a;
        ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(42,36,53,0.9)'; ctx.beginPath(); ctx.arc(f.x, y - 80, 30, 0, TAU); ctx.stroke();
        ctx.lineWidth = 6; ctx.strokeStyle = SIDE[st.by].col; ctx.beginPath(); ctx.arc(f.x, y - 80, 30, -Math.PI / 2, -Math.PI / 2 + TAU * NC.clamp(st.lit / RULES.lightS, 0, 1)); ctx.stroke();
        ctx.restore();
        label(ctx, 'กำลังจุดไฟ', f.x, y + 40, a, SIDE[st.by].col, 22);
      } else if (st.own && (st.own === 'b' ? st.nr > st.nb : st.nb > st.nr)) label(ctx, 'กำลังโดนดับ!', f.x, y + 40, a * (0.7 + 0.3 * Math.sin(t * 8)), '#ffb070', 24);
      else if (!st.own) label(ctx, 'เถ้า · ยืนในวงเพื่อจุด', f.x, y + 40, a * 0.8, '#bdb6c8', 20);
    });
    // over every head in sight: the guild's banner tag in its side's colour (who is who in the fight), the wood carried
    for (const q of people()) {
      if ((q.r && q.r.gwHide) || !q.side) continue;
      if (Math.abs(q.x - game.cam.x - game.vw / 2) > game.vw / 2 + 200 || Math.abs(q.y - game.cam.y - game.vh / 2) > game.vh / 2 + 300) continue;
      guildTag(ctx, q, q.alive ? 1 : 0.45, game.time);
      if (q.carry && q.alive) for (let k = 0; k < q.carry; k++) NC.drawSpr(ctx, 'gw_wood', q.x - 26 + k * 26, q.y - 272 - k * 6, { scale: 0.32 });
    }
    // the tree being chopped: a ring that fills; a hint next to a tree
    const c = GW.chop;
    if (c) {
      const x = c.tree.x, y = c.tree.y - 300;
      ctx.save();
      ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(42,36,53,0.9)'; ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.stroke();
      ctx.lineWidth = 6; ctx.strokeStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + TAU * NC.clamp(c.t / RULES.chopS, 0, 1)); ctx.stroke();
      ctx.restore();
      label(ctx, `ตัดไม้ ${GW.me.carry}/${RULES.carry}`, x, y - 46, 1, '#ffe7b0', 24);
    } else if (p.dead <= 0 && GW.me.carry < RULES.carry && (m.ph === 'f' || m.ph === 'p')) {
      const tr = treeNear(game, p.x, p.y, 170);
      if (tr) label(ctx, 'กด B ตัดไม้เป็นฟืน', tr.x, tr.y - 280 + Math.sin(t * 3) * 4, 1, '#fff4d8', 24);
    }
  };
  // the guild tag: a small banner pill over the head (the side's colour, the guild's name)
  const TAGY = 212;
  function guildTag(ctx, q, a, t) {
    const m = GW.match, S = SIDE[q.side], text = sideName(m, q.side), y = q.y - TAGY;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '600 22px Mitr, sans-serif';
    const w = ctx.measureText(text).width + 46, h = 32, x0 = q.x - w / 2;
    ctx.fillStyle = 'rgba(20,16,34,0.82)'; NC.rrect(ctx, x0, y - h / 2, w, h, h / 2); ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = S.col; ctx.stroke();
    // the little banner on the left
    ctx.fillStyle = S.col;
    ctx.beginPath(); ctx.moveTo(x0 + 13, y - 9); ctx.lineTo(x0 + 27, y - 9); ctx.lineTo(x0 + 27, y + 9); ctx.lineTo(x0 + 20, y + 4); ctx.lineTo(x0 + 13, y + 9); ctx.closePath(); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = 5; ctx.strokeStyle = NC.OUTLINE; ctx.strokeText(text, x0 + 34, y + 1);
    ctx.fillStyle = q.side === 'b' ? '#d6ecff' : '#ffd9d3'; ctx.fillText(text, x0 + 34, y + 1);
    ctx.restore();
  }
  function label(ctx, text, x, y, a, fill, size) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = `600 ${size}px Mitr, sans-serif`;
    ctx.lineWidth = size / 4; ctx.strokeStyle = NC.OUTLINE; ctx.strokeText(text, x, y);
    ctx.fillStyle = fill; ctx.fillText(text, x, y);
    ctx.restore();
  }

  // ---------------- the minimap: the fires in their colours (hidden enemies stay off it: net.js) ----------------
  function hookMinimap() {
    const HU = NC.HUD, base = HU.drawMap;
    if (!base || base.gw) return;
    HU.drawMap = function (ctx, w, h, game, span) {
      base.apply(this, arguments);
      if (!GW.on() || !GW.match) return;
      const world = game.world, p = game.player, round = ctx.canvas.id === 'minimap';
      if (!round) span = Math.max(world.W, (world.H * w) / h) * 1.04;
      const k = w / span, vh = (span * h) / w;
      const x0 = round ? NC.clamp(p.x - span / 2, 0, Math.max(0, world.W - span)) : (world.W - span) / 2;
      const y0 = round ? NC.clamp(p.y - vh / 2, 0, Math.max(0, world.H - vh)) : (world.H - vh) / 2;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (round) { ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, TAU); ctx.clip(); }
      const s = Math.max(4, w * (round ? 0.05 : 0.016));
      const icon = (name, x, y, sz) => { const Sp = NC.SPR[name]; if (Sp) ctx.drawImage(Sp.img, x - sz / 2, y - sz / 2, sz, (sz * Sp.h) / Sp.w); };
      FIRES.forEach((f, i) => {
        const st = GW.match.fires[i], X = (f.x - x0) * k, Y = (f.y - y0) * k, sz = s * (f.kind === 'great' ? 2.6 : 2);
        icon(st.own ? (st.own === 'b' ? 'gwi_fire_b' : 'gwi_fire_r') : GW.match.ph === 'p' ? 'gwi_great' : 'gwi_ash', X, Y - sz * 0.15, sz);
      });
      for (const sd of ['b', 'r']) { const C = CAMPS[sd]; icon('gwi_banner', (C.x - x0) * k, (C.y - y0) * k, s * 1.6); }
      ctx.restore();
    };
    HU.drawMap.gw = true;
  }

  // ---------------- the camp: the war gate north of the guild lane (the war board: js/gwar_ui.js) ----------------
  const GATE = (GW.gate = { x: 4680, y: 980 });
  const baseWorld = NC.buildWorld;
  NC.buildWorld = function () {
    const w = baseWorld.apply(this, arguments);
    if (!w || !w.shop) return w; // (the camp only)
    const s = NC.SPR.gw_gate, gw = s ? s.w : 440;
    const inBox = (x, y) => Math.abs(x - GATE.x) < gw * 0.7 && y > GATE.y - 300 && y < GATE.y + 160;
    w.props = w.props.filter((q) => !(inBox(q.x, q.y) && q.name !== 'camp_fire'));
    if (s) {
      w.props.push({ kind: 'prop', name: 'gw_gate', x: GATE.x, y: GATE.y, scale: 1, flip: false, sort: GATE.y, shadow: [gw * 0.4, 28],
        canopy: { x0: GATE.x - gw * 0.48, x1: GATE.x + gw * 0.48, y0: GATE.y - s.h, y1: GATE.y - 60 } });
      const mark = (cx, cy, rx, ry) => {
        for (let gy = Math.floor((cy - ry) / w.CELL); gy <= (cy + ry) / w.CELL; gy++)
          for (let gx = Math.floor((cx - rx) / w.CELL); gx <= (cx + rx) / w.CELL; gx++) {
            if (gx < 0 || gy < 0 || gx >= w.GW || gy >= w.GH) continue;
            const nx = (gx * w.CELL + w.CELL / 2 - cx) / rx, ny = (gy * w.CELL + w.CELL / 2 - cy) / ry;
            if (nx * nx + ny * ny <= 1) w.solid[gy * w.GW + gx] = 1;
          }
      };
      mark(GATE.x - gw * 0.36, GATE.y - 20, gw * 0.14, 36); mark(GATE.x + gw * 0.36, GATE.y - 20, gw * 0.14, 36);
    }
    w.gwGate = GATE;
    return w;
  };
  const nearGate = (g) => g.mapId === 'camp' && g.player && g.player.dead <= 0 && NC.dist(g.player.x, g.player.y, GATE.x, GATE.y + 30) < 320;
  GW.nearGate = nearGate;
  function drawGateLabel(ctx, game) {
    const p = game.player, d = Math.hypot(p.x - GATE.x, p.y - GATE.y);
    if (d > 1100) return;
    const a = NC.clamp((1100 - d) / 300, 0, 1), y = GATE.y - ((NC.SPR.gw_gate && NC.SPR.gw_gate.h) || 430) - 30 + Math.sin(game.time * 2) * 4;
    label(ctx, 'ศึกชิงกองไฟ · 4 ดินแดน', GATE.x, y, a, '#ffd27a', 36);
    label(ctx, nearGate(game) ? 'กด T หรือคลิกเพื่อเปิดกระดานศึก' : windowAt(now()).open ? 'ศึกกำลังเปิดอยู่!' : 'เปิดทุกวันเสาร์ 20:00 · ท้าชิงได้ที่กระดานศึก', GATE.x, y + 36, a, '#fff4d8', 24);
  }
  addEventListener('keydown', (e) => {
    const g = G();
    if (e.code !== 'KeyT' || e.repeat || !g || !g.player || g.paused || !nearGate(g) || typing()) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (GW.ui.board) GW.ui.board();
  }, true);
  addEventListener('mousedown', (e) => {
    const g = G();
    if (e.button !== 0 || !g || g.mapId !== 'camp' || !g.player || e.target !== document.getElementById('view')) return;
    const wx = g.cam.x + (e.clientX * g.dpr) / g.scale, wy = g.cam.y + (e.clientY * g.dpr) / g.scale;
    const s = NC.SPR.gw_gate, gw = s ? s.w : 440, gh = s ? s.h : 430;
    if (Math.abs(wx - GATE.x) > gw * 0.45 || wy < GATE.y - gh || wy > GATE.y + 20) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (nearGate(g)) { if (GW.ui.board) GW.ui.board(); } else g.toast('เดินเข้าไปใกล้ประตูศึกก่อนนะ');
  }, true);

  // ---------------- hooks (outermost: installed after every HUD.init wrapper has run) ----------------
  let hooked = false;
  function install(game) {
    if (hooked) return;
    hooked = true;
    hookMinimap();
    const baseDmg = NC.damageEnemy;
    NC.damageEnemy = function (g, e, r0, kx, ky, o) {
      if (e && e.gwp) { claim(g, e, r0, o); return; }
      return baseDmg.apply(this, arguments);
    };
    const baseUpd = NC.updateEnemy;
    NC.updateEnemy = function (g, e) {
      if (e && e.gwp) { statusOut(e); return; }
      return baseUpd.apply(this, arguments);
    };
    const baseStatus = NC.statusEnemy;
    NC.statusEnemy = function (g, e, kind, dur) {
      if (e && e.gwp) { if (kind === 'stun' || kind === 'freeze') push(e.gwp, 0, 0, kind === 'freeze' ? 2 : 1, dur || 1); return; }
      return baseStatus.apply(this, arguments);
    };
    for (const k of ['drawEnemy', 'drawEnemyBar']) {
      const base = NC[k];
      if (typeof base === 'function') NC[k] = function () { for (const a of arguments) if (a && a.gwp) return; return base.apply(this, arguments); };
    }
    // stunned: no moving or attacking; slowed: half the walk
    const baseUpdP = NC.updatePlayer;
    NC.updatePlayer = function (g, dt) {
      const p = g.player, on = GW.on() && GW.side;
      if (on && cc.stun > 0) {
        const I = g.input;
        I.mx = 0; I.my = 0; I.attack = false; I.attackTap = false; g.mouse.down = false;
        for (const k of NC.HOTKEYS || []) I[k] = false;
      }
      const slow = on && cc.slow > 0 && !p.dash, x0 = p.x, y0 = p.y;
      const res = baseUpdP.apply(this, arguments);
      if (slow && !p.dash) { const nx = x0 + (p.x - x0) * 0.5, ny = y0 + (p.y - y0) * 0.5; if (g.world.fits(nx, ny, p.r || 20)) { p.x = nx; p.y = ny; } }
      return res;
    };
    // no duels in a war
    if (NC.PvP && NC.PvP.challenge) {
      const baseCh = NC.PvP.challenge;
      NC.PvP.challenge = function () { if (GW.on()) return 'war'; return baseCh.apply(this, arguments); };
    }
    // the war runs with the party's update (before the game moves anyone)
    const baseParty = NC.Party && NC.Party.update;
    if (baseParty) NC.Party.update = function (g, dt) {
      const res = baseParty.apply(this, arguments);
      try {
        const was = GW.side;
        frame(g, dt || 1 / 60);
        if (was && !GW.side) { unpaint(); if (GW.ui.hud) GW.ui.hud(); } // (back in the camp: the war bar goes)
        if (GW.side) minuteT += dt || 0; else minuteT = 0;
      } catch (err) { console.warn('gwar', err); }
      return res;
    };
  }
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    setTimeout(() => install(game), 0);
  };
})();
