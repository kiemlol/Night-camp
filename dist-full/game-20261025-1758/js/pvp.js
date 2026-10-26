/* pvp.js — duels between real players (PvP phase 1, the design doc "Night Camp PvP" 2026-10-02), on net.js's presence:
     ดวล       challenge someone on the same map (click their hero → ท้าดวล in js/playermenu.js's menu, or /duel name in the chat): a ring of fire
               rises round you both, 3-2-1, one round, 2 minutes; HP to 0 (it stops at 1) or 5 s outside the ring loses;
               HP and SP come back as they were when it ends
     ลานประลอง  on the arena map (pvp_lake, js/pvparena.js) the same challenge is a match: best of 3 rounds, 100 s each,
               start mats, full HP / SP and cooldowns every round, the ring shrinks from the 60th second (outside it
               burns 6% HP a second); time out: the higher HP % wins the round
   How a hit lands: the opponent is put into game.enemies as a stand-in (a "proxy", like the training dummies), so every
   attack and skill finds it by itself; my game catches the hit on the stand-in (the outermost NC.damageEnemy) and sends it
   as a hit claim; the opponent's game applies it to its hero through NC.hurtPlayer (shields, Guard and the rest work),
   with the PvP rules: damage x0.4, criticals x0.75, one hit at most 35% of max HP; stun / freeze x0.5 with diminishing
   returns (the 2nd within 15 s half as long, the 3rd a quarter, then 10 s immune), slows x0.5. Each game trusts itself:
   fine between friends, ranked play needs a server (see the doc).
   Presence fields: dv (my challenges) da (my answer) du (the match: the challenger runs it, the other follows) dk (my
   numbers for the opponent's stand-in) hc (hit claims) dl (I lost this round). Testing: two tabs with ?netmock. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, TAU = Math.PI * 2;
  const RULES = { dmg: 0.4, crit: 0.75, cap: 0.35, cc: 0.5, slow: 0.5, dr: 15, immune: 10 };
  const FIELD = { R: 420, sq: 0.58, time: 120, out: 5 };
  const ARENA = { time: 100, shrinkAt: 60, shrinkTo: 90, burn: 0.06, best: 3 };
  const PV = (NC.PvP = { RULES, duel: null, log: [] });
  const net = () => NC.Net;
  const me = () => (net() && net().me ? net().me() : '');
  const G = () => NC.game;
  const rem = (peer) => (net() ? net().remotes.get(peer) : null);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const now = () => Date.now();
  let inviteN = 0, claimSeq = 0;
  let invites = [];          // [n, toPeer, until, arena]
  let answer = null;         // [n, toPeer, ok, until]
  let incoming = null;       // { n, from, name, arena, until }
  let lost = null;           // [duelId, round]
  const claims = [];         // [seq, toPeer, dmg, crit, st, dur]
  const D = () => PV.duel;

  // ---------------- what goes in my presence ----------------
  function fields() {
    const N = net();
    if (!N || !N.fields) return false;
    N.fields.push({ key: 'dv', get: () => { const t = now(); invites = invites.filter((v) => v[2] > t); return invites.length ? invites.map((v) => [v[0], v[1], v[3] ? 1 : 0]) : null; } });
    N.fields.push({ key: 'da', get: () => (answer && answer[3] > now() ? answer.slice(0, 3) : null) });
    N.fields.push({ key: 'du', get: () => {
      const d = D();
      if (!d) return null;
      if (!d.host) return [d.id, d.opp, 'g'];
      return [d.id, d.opp, d.phase, d.round, d.wins[0], d.wins[1], Math.round(d.cx), Math.round(d.cy), Math.round(d.R), d.best, Math.round(d.t * 10), d.arena ? 1 : 0];
    } });
    N.fields.push({ key: 'dk', get: () => {
      const d = D(), g = G(), p = g && g.player;
      if (!d || !p || !p.d) return null;
      const s = p.d;
      return [Math.round(p.maxHp), Math.round(s.def || 0), Math.round(s.vdef || 0), Math.round(s.mdef || 0), Math.round(s.imdef || 0), Math.round(s.flee || 0), s.element || 'neutral', Math.round(p.hp)];
    } });
    N.fields.push({ key: 'hc', get: () => (claims.length ? claims.slice(-12) : null) });
    N.fields.push({ key: 'dl', get: () => lost });
    N.hooks.push(hear);
    return true;
  }

  // ---------------- hearing the others ----------------
  function hear(r, pr, first) {
    const g = G();
    if (!g) return;
    const I = me();
    // a challenge to me
    const dv = Array.isArray(pr.dv) ? pr.dv : [];
    if (first) r.dvSeen = Math.max(0, ...dv.map((v) => v[0] || 0));
    else for (const v of dv) {
      if (!Array.isArray(v) || v[1] !== I || v[0] <= (r.dvSeen || 0)) continue;
      r.dvSeen = v[0];
      if (D() || incoming) { reply(v[0], r.peer, 0); continue; } // (busy)
      incoming = { n: v[0], from: r.peer, name: r.name, arena: !!v[2], until: now() + 15000 };
      showAsk();
    }
    // the answer to my challenge
    const da = pr.da;
    if (!first && Array.isArray(da) && da[1] === I) {
      const iv = invites.find((v) => v[0] === da[0] && v[1] === r.peer);
      if (iv) {
        invites = invites.filter((v) => v !== iv);
        if (da[2] && !D()) startHost(r, iv[3]);
        else if (!da[2]) toast(`${r.name} ไม่รับคำท้า`);
      }
    }
    const d = D();
    // someone else's duel (watching it): their HP drops show as numbers over them
    if (Array.isArray(pr.dk) && (!d || r.peer !== d.opp)) {
      const hp = pr.dk[7];
      if (r.spHp !== undefined && hp < r.spHp - 0.5 && hp > 0) { r.numDir = -(r.numDir || 1); FX.dmg(r.x, r.y - 212, Math.round(r.spHp - hp), { size: 40, fill: '#ffffff', dir: r.numDir }); }
      r.spHp = hp;
    } else r.spHp = undefined;
    if (!d || r.peer !== d.opp) return;
    // the match, from the challenger (I follow it)
    if (!d.host && Array.isArray(pr.du) && pr.du[0] === d.id && pr.du[1] === I) follow(pr.du);
    // the opponent's numbers (their stand-in in my game)
    if (Array.isArray(pr.dk)) d.oppStats = pr.dk;
    // hit claims on me
    const hc = Array.isArray(pr.hc) ? pr.hc : [];
    const top = Math.max(0, ...hc.map((c) => c[0] || 0));
    if (first || d.hcSeen === undefined) d.hcSeen = top;
    else for (const c of hc.slice().sort((a, b) => a[0] - b[0])) {
      if (!Array.isArray(c) || c[0] <= d.hcSeen) continue;
      d.hcSeen = c[0];
      if (c[1] === I) takeHit(g, r, c);
    }
    // the opponent lost a round (I run the match: count it)
    if (d.host && Array.isArray(pr.dl) && pr.dl[0] === d.id && pr.dl[1] === d.round && d.phase === 'f') endRound(1);
    d.seen = now();
  }

  function reply(n, peer, ok) { answer = [n, peer, ok ? 1 : 0, now() + 10000]; }

  // ---------------- starting, following, ending ----------------
  PV.challenge = function (peer) {
    const g = G(), r = rem(peer);
    if (!r || !r.named) return 'off';
    if (D()) return 'busy';
    if (r.map !== g.mapId) return 'far';
    if (invites.some((v) => v[1] === peer)) return 'dup';
    const arena = !!(g.world && g.world.pvpArena);
    if (!arena && NC.dist(r.x, r.y, g.player.x, g.player.y) > 900) return 'far';
    invites.push([++inviteN, peer, now() + 15000, arena]);
    toast(`ส่งคำท้า${arena ? 'ประลอง' : 'ดวล'}ไปหา ${r.name} แล้ว`);
    return 'ok';
  };
  PV.incoming = () => incoming; // (pvpbot.js: the practice bot answers by itself)
  PV.answer = function (ok) {
    const v = incoming;
    incoming = null; hideAsk();
    if (!v) return;
    reply(v.n, v.from, ok && !D());
    if (ok && !D()) PV.pending = { host: v.from, until: now() + 8000, arena: v.arena };
  };

  function newDuel(host, opp, arena) {
    const g = G(), p = g.player;
    return { id: host ? `${me()}:${inviteN}` : '', host, opp, arena, map: g.mapId, best: arena ? ARENA.best : 1, round: 1, wins: [0, 0], phase: 'c', t: 0,
      cx: p.x, cy: p.y, R: FIELD.R, sq: FIELD.sq, keep: { hp: p.hp, sp: p.sp }, out: 0, seen: now(), roundSet: 0, cc: { hard: [], immune: 0, stun: 0, slow: 0 }, lastW: 0 };
  }
  function startHost(r, arena) {
    const g = G(), p = g.player, d = newDuel(true, r.peer, arena);
    const A = g.world && g.world.pvpArena;
    if (arena && A) { d.cx = A.x; d.cy = A.y; d.R = A.ring; d.sq = A.sq; }
    else { d.cx = (p.x + r.x) / 2; d.cy = (p.y + r.y) / 2; }
    PV.duel = d;
    beginRound(d);
    note(`เริ่ม${arena ? 'ประลอง' : 'ดวล'}กับ ${r.name}!`);
  }
  // the guest: the challenger's match state arrives
  function follow(du) {
    const d = D();
    let [, , ph, round, hw, gw, cx, cy, R, best, t10, arena] = du;
    hw |= 0; gw |= 0; best |= 0; cx = +cx || 0; cy = +cy || 0; R = +R || 0; // (the host's presence: numbers only)
    d.cx = cx; d.cy = cy; d.R = R; d.best = best; d.arena = !!arena;
    const was = d.wins[0] + d.wins[1];
    d.wins = [gw, hw];
    if (gw + hw > was && ph !== 'e' && best > 1) { const r = rem(d.opp); big(gw > d.lastW ? 'ชนะยกนี้!' : 'แพ้ยกนี้', `${gw} – ${hw} · ${r ? r.name : ''}`); }
    d.lastW = gw;
    if (arena) { const A = G().world.pvpArena; if (A) d.sq = A.sq; } else d.sq = FIELD.sq;
    if (round !== d.round || (ph === 'c' && d.phase !== 'c')) { d.round = round; d.phase = 'c'; beginRound(d); }
    d.phase = ph; d.t = t10 / 10;
    if (ph === 'e' && !d.over) finish(d, d.wins[0] > d.wins[1] ? 'win' : d.wins[0] < d.wins[1] ? 'lose' : 'draw');
  }
  function guestStart(r, du) {
    const d = newDuel(false, r.peer, !!du[11]);
    d.id = du[0];
    PV.duel = d; PV.pending = null;
    follow(du);
    beginRound(d);
    note(`เริ่ม${d.arena ? 'ประลอง' : 'ดวล'}กับ ${r.name}!`);
  }
  // every round: (arena) full HP / SP, cooldowns, start mats; the ring back to full size
  function beginRound(d) {
    const g = G(), p = g.player;
    if (NC.applyGear) NC.applyGear(g); // (the hero's own max HP in a duel: no newbie power, js/newbie.js)
    d.t = 0; d.phase = 'c'; d.out = 0; d.lostSent = false; lost = null; d.roundSet = d.round;
    const A = g.world && g.world.pvpArena;
    if (d.arena && A) {
      d.R = A.ring;
      const s = A.starts[d.host ? 0 : 1];
      // (several duels on the stage at once, a team fight: each pair on its own row)
      const row = ((d.id.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)) % 3) - 1;
      p.x = s[0]; p.y = s[1] + row * 110; p.face = d.host ? 1 : -1;
      p.hp = p.maxHp; p.sp = p.maxSp; p.cd = {};
    } else if (d.round === 1) { p.hp = p.maxHp; p.sp = p.maxSp; }
    p.dead = 0;
    ringFx(d);
  }
  // the host: a round is over (who: 0 = I lost, 1 = the opponent lost, -1 = time / draw)
  function endRound(who) {
    const d = D();
    if (!d || d.phase !== 'f') return;
    if (who === 1) d.wins[0]++; else if (who === 0) d.wins[1]++;
    const need = Math.ceil(d.best / 2);
    d.phase = d.wins[0] >= need || d.wins[1] >= need || d.round >= d.best ? 'e' : 'p';
    d.t = 0;
    roundBanner(d, who);
    if (d.phase === 'e') finish(d, d.wins[0] > d.wins[1] ? 'win' : d.wins[0] < d.wins[1] ? 'lose' : 'draw');
  }
  function roundBanner(d, who) {
    const r = rem(d.opp), name = r ? r.name : '?';
    const mine = d.host ? who === 1 : who === 0;
    if (d.best > 1) big(who === -1 ? 'เสมอ' : mine ? 'ชนะยกนี้!' : 'แพ้ยกนี้', `${d.wins[0]} – ${d.wins[1]} · ${name}`);
  }
  function finish(d, res) {
    if (d.over) return;
    d.over = true;
    const g = G(), p = g.player, r = rem(d.opp), name = r ? r.name : 'คู่ต่อสู้';
    const score = d.best > 1 ? ` ${d.wins[0]}–${d.wins[1]}` : '';
    big(res === 'win' ? 'ชนะ!' : res === 'lose' ? 'แพ้' : 'เสมอ', `${d.arena ? 'ประลอง' : 'ดวล'}กับ ${name}${score}`);
    note(res === 'win' ? `ชนะ${d.arena ? 'ประลอง' : 'ดวล'} ${name}${score}` : res === 'lose' ? `แพ้${d.arena ? 'ประลอง' : 'ดวล'} ${name}${score}` : `เสมอกับ ${name}`);
    PV.log.push({ vs: name, res, score: [d.wins[0], d.wins[1]], arena: d.arena, at: now() });
    for (const f of NC.pvpEnds || []) { try { f(res, d); } catch (err) { console.warn(err); } } // (ranks.js counts the wins)
    setTimeout(() => {
      if (PV.duel !== d) return;
      PV.duel = null; lost = null; claims.length = 0;
      if (NC.applyGear) NC.applyGear(g); // (max HP back with the newbie power, before HP is put back)
      p.hp = Math.max(1, Math.min(p.maxHp, d.keep.hp)); p.sp = Math.min(p.maxSp, d.keep.sp);
      dropProxy(g);
      hud();
    }, 3000);
  }
  function abort(d, why) {
    if (!d || d.over) return;
    if (why === 'away') { note('คู่ต่อสู้ออกไปแล้ว'); finish(d, 'win'); }
    else if (why === 'left') finish(d, 'lose');
  }

  // ---------------- every frame ----------------
  function frame(g, dt) {
    if (PV.drive) { PV.drive(g, dt); hud(); return; } // (?online: the server runs the match, js/online/pvp.js)
    const p = g.player;
    // a challenge I accepted: the challenger's match appears
    if (PV.pending && !D()) {
      const r = rem(PV.pending.host);
      const du = r && r.lastDu;
      if (du && du[1] === me()) guestStart(r, du);
      else if (now() > PV.pending.until) PV.pending = null;
    }
    if (incoming && now() > incoming.until) { reply(incoming.n, incoming.from, 0); incoming = null; hideAsk(); }
    const d = D();
    if (!d) { hud(); return; }
    const r = rem(d.opp);
    if (!d.over) {
      if (g.mapId !== d.map) { abort(d, 'left'); hud(); return; }
      if (!r || now() - d.seen > 6000 || r.map !== d.map) { abort(d, 'away'); hud(); return; }
    }
    d.t += dt;
    if (d.host && !d.over) {
      if (d.phase === 'c' && d.t >= 3) { d.phase = 'f'; d.t = 0; }
      else if (d.phase === 'p' && d.t >= 2.5) { d.round++; beginRound(d); }
      else if (d.phase === 'f') {
        const limit = d.arena ? ARENA.time : FIELD.time;
        if (d.t >= limit) {
          const mine = p.hp / p.maxHp, theirs = r ? r.hpPct / 100 : 0;
          endRound(Math.abs(mine - theirs) < 0.005 ? -1 : mine > theirs ? 1 : 0);
        }
      }
    }
    if (d.phase === 'c') { const n = 3 - Math.floor(d.t); if (n !== d.shown && n > 0) { d.shown = n; big(String(n), d.best > 1 ? `ยกที่ ${d.round}` : ''); } }
    if (d.phase === 'f' && d.shown !== 0) { d.shown = 0; big('ดวล!', ''); }
    // the arena's ring shrinks
    if (d.arena && d.phase === 'f') {
      const A = g.world.pvpArena;
      if (A) { const k = NC.clamp((d.t - ARENA.shrinkAt) / (ARENA.shrinkTo - ARENA.shrinkAt), 0, 1); if (d.host) d.R = A.ring + (A.ringMin - A.ring) * k; }
    }
    // outside the ring
    if (d.phase === 'f' && !d.over) {
      const out = ((p.x - d.cx) / d.R) ** 2 + ((p.y - d.cy) / (d.R * d.sq)) ** 2 > 1;
      if (d.arena) {
        if (out) { d.burnAcc = (d.burnAcc || 0) + dt; if (d.burnAcc >= 0.5) { d.burnAcc -= 0.5; selfHurt(g, Math.max(1, Math.round(p.maxHp * ARENA.burn * 0.5))); } }
      } else {
        d.out = out ? d.out + dt : 0;
        if (d.out >= FIELD.out) loseRound(g, 'ออกนอกวงไฟ');
      }
    }
    // the opponent's stand-in
    if (d.phase === 'f' && !d.over && r && !r.dd) keepProxy(g, r, d); else dropProxy(g);
    tickCC(g, dt);
    hud();
  }
  function selfHurt(g, dmg) {
    const p = g.player;
    if (dmg >= p.hp) { p.hp = 1; loseRound(g, 'โดนวงไฟเผา'); return; }
    p.hp -= dmg; p.hurt = 0.2;
    FX.num(p.x, p.y - 150, dmg, { size: 30, fill: '#ff9a5a' });
  }
  function loseRound(g, why) {
    const d = D();
    if (!d || d.phase !== 'f' || d.lostSent) return;
    d.lostSent = true;
    if (why) note(why);
    if (d.host) endRound(0);
    else lost = [d.id, d.round];
  }

  // ---------------- the stand-in ----------------
  function keepProxy(g, r, d) {
    let e = d.proxy;
    const S = d.oppStats || [r.maxHp || 1000, 0, 0, 0, 0, 0, 'neutral', 1000];
    if (!e) {
      e = d.proxy = NC.makeDummy({ name: r.name, lv: r.lv || 1, element: S[6] || 'neutral', def: S[1], vdef: S[2], mdef: S[3], imdef: S[4], flee: S[5], note: '' }, r.x, r.y);
      e.type = 'pvpfoe'; e.pvp = r.peer; e.r = 22;
    }
    e.def = S[1]; e.vdef = S[2]; e.mdef = S[3]; e.imdef = S[4]; e.flee = S[5]; e.element = S[6] || 'neutral';
    e.maxHp = Math.max(1, S[0]); e.hp = Math.max(1, Math.round((r.hpPct / 100) * e.maxHp)); e.dead = false;
    e.x = e.sx = e.wx = r.x; e.y = e.sy = e.wy = r.y; e.sort = r.y; e.kbx = e.kby = 0;
    if (!g.enemies.includes(e)) g.enemies.push(e);
  }
  function dropProxy(g) {
    const d = D();
    if (g && g.enemies) g.enemies = g.enemies.filter((e) => !e.pvp);
    if (d) d.proxy = null;
  }
  // a hit on the stand-in: the number here, the claim to them; statuses ride along
  function claim(g, e, r0, o) {
    if (PV.drive) { g.target = e; g.targetT = g.time; return; } // (?online: the server lands the hits, its events show them)
    const d = D();
    if (!d || d.phase !== 'f' || e.pvp !== d.opp) return;
    const top = NC.labelTop(e) - 52;
    if (r0.miss) { e.numDir = -(e.numDir || 1); FX.dmg(e.x, top, 'MISS', { size: 32, fill: '#cfd8ff', dir: e.numDir }); return; }
    const raw = Math.max(1, Math.round(r0.dmg)), shown = Math.max(1, Math.round(raw * RULES.dmg * (r0.crit ? RULES.crit : 1)));
    e.numDir = -(e.numDir || 1);
    if (o && o.dot) FX.num(e.x, top + 30, shown, { size: 30, fill: (o && o.fill) || '#9be35a' });
    else { FX.dmg(e.x, top, shown, { size: r0.crit ? 56 : 44, fill: r0.crit ? '#ffe066' : '#ffffff', crit: r0.crit, dir: e.numDir }); FX.sparks(e.x, e.y - 45, 5, (o && o.color) || '255,255,255'); }
    const rr = rem(e.pvp);
    if (rr) { rr.hurt = 0.25; }
    push(e.pvp, raw, r0.crit ? 1 : 0, 0, 0);
  }
  function push(peer, dmg, crit, st, dur) {
    claims.push([++claimSeq, peer, dmg, crit, st, Math.round(dur * 10) / 10]);
    if (claims.length > 24) claims.splice(0, claims.length - 24);
  }
  // statuses the stand-in got this frame (stun / freeze / slow are fields on it): pass them on
  function statusOut(e) {
    const d = D();
    if (!d || !e.pvp) return;
    if (e.stun > 0) { push(e.pvp, 0, 0, 1, e.stun); e.stun = 0; }
    if (e.frozen > 0) { push(e.pvp, 0, 0, 2, e.frozen); e.frozen = 0; }
    if (e.slow > 0.05) { push(e.pvp, 0, 0, 3, e.slow); e.slow = 0; }
  }

  // ---------------- a hit on me ----------------
  function takeHit(g, r, c) {
    const d = D(), p = g.player;
    if (!d || d.phase !== 'f' || d.over || p.dead > 0) return;
    if (NC.dist(r.x, r.y, p.x, p.y) > 1700) return; // (too far to be real)
    const t = now();
    d.rate = (d.rate || []).filter((x) => x > t - 1000); d.rate.push(t);
    if (d.rate.length > 40) return;
    const [, , dmg, crit, st, dur] = c;
    if (p.evade > 0) { if (!(d.dodgeT > g.time)) { d.dodgeT = g.time + 0.4; FX.text(p.x, p.y - 190, 'หลบ!', '#d8ecff', 28); } return; } // (mid-dash: dash.js; the word once per dodge)
    if (dmg > 0) {
      let v = Math.round(dmg * RULES.dmg * (crit ? RULES.crit : 1));
      v = Math.max(1, Math.min(v, Math.round(p.maxHp * RULES.cap)));
      const inv = p.inv; p.inv = 0;
      d.attacker = r;
      NC.hurtPlayer(g, v, r.x);
      d.attacker = null;
      if (p.inv < inv) p.inv = inv;
    }
    if (st) applyCC(g, st, dur);
  }
  // stun / freeze with diminishing returns; slows
  function applyCC(g, st, dur) {
    const d = D(), p = g.player, C = d.cc, t = g.time;
    if (st === 3) { C.slow = Math.max(C.slow, dur * RULES.slow); return; }
    if (C.immune > t) { FX.text(p.x, p.y - 190, 'ต้านทาน', '#cfe0ff', 26); return; }
    C.hard = C.hard.filter((x) => x > t - RULES.dr);
    const k = [1, 0.5, 0.25][C.hard.length];
    C.hard.push(t);
    if (k === undefined || C.hard.length > 3) { C.immune = t + RULES.immune; FX.text(p.x, p.y - 190, 'ต้านทาน', '#cfe0ff', 26); return; }
    const len = dur * RULES.cc * k;
    if (C.hard.length === 3) C.immune = t + len + RULES.immune;
    C.stun = Math.max(C.stun, len);
    C.kind = st === 2 ? 'freeze' : 'stun';
    FX.text(p.x, p.y - 190, st === 2 ? 'แข็ง!' : 'มึน!', st === 2 ? '#bfe8ff' : '#ffe08a', 30);
  }
  function tickCC(g, dt) {
    const d = D();
    if (!d) return;
    const C = d.cc;
    C.stun = Math.max(0, C.stun - dt); C.slow = Math.max(0, C.slow - dt);
  }

  // ---------------- the ring of fire ----------------
  function ringFx(d) {
    if (d.ring && !d.ring.dead) return;
    d.ring = FX.add({ type: 'pvpRing', layer: 'glow', x: d.cx, y: d.cy, life: 1e9, duel: d });
  }
  FX.def('pvpRing', (ctx, q) => {
    const d = q.duel;
    if (PV.duel !== d) { q.dead = true; return; }
    const t = (NC.game && NC.game.time) || 0, R = d.R, ry = R * d.sq, a = d.phase === 'c' ? Math.min(1, d.t / 0.8) : 1;
    V.glow(ctx, d.cx, d.cy, R, '255,140,60', 0.08 * a, true, d.sq);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 6; ctx.strokeStyle = `rgba(255,150,70,${0.55 * a})`;
    ctx.beginPath(); ctx.ellipse(d.cx, d.cy, R, ry, 0, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,230,160,${0.8 * a})`;
    ctx.beginPath(); ctx.ellipse(d.cx, d.cy, R, ry, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    const n = Math.max(24, Math.round(R / 14));
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU, x = d.cx + Math.cos(ang) * R, y = d.cy + Math.sin(ang) * ry;
      V.flame(ctx, x, y, 16, 26 + 8 * Math.sin(t * 6 + i * 1.7), t * 14 + i * 3.1, V.PAL.fire, 0.85 * a);
    }
  });

  // ---------------- the HUD: the match bar, big words, the question ----------------
  let bar = null, bigEl = null, ask = null;
  function ui() {
    if (bar) return;
    const st = document.createElement('style');
    st.textContent = `
      #pvp-bar{position:absolute;left:50%;top:calc(14*var(--u));transform:translateX(-50%);z-index:24;pointer-events:none;display:flex;align-items:center;gap:calc(12*var(--u));
        padding:calc(6*var(--u)) calc(18*var(--u));border-radius:99px;background:rgba(22,18,40,.82);border:calc(3*var(--u)) solid #ffb15c;color:#fff4dc;font:600 calc(17*var(--u))/1.3 'Mitr',sans-serif;white-space:nowrap}
      #pvp-bar[hidden]{display:none}
      #pvp-bar .pv-hp{width:calc(120*var(--u));height:calc(10*var(--u));border-radius:99px;background:#3b3450;overflow:hidden;border:calc(2*var(--u)) solid #120e22}
      #pvp-bar .pv-hp i{display:block;height:100%;background:#6ad36a}
      #pvp-bar .pv-hp.them i{background:#ee6a5a}
      #pvp-bar .pv-t{color:#ffd27a;min-width:calc(46*var(--u));text-align:center}
      #pvp-bar .pv-w{color:#ffd27a}
      #pvp-big{position:absolute;left:50%;top:32%;transform:translate(-50%,-50%);z-index:24;pointer-events:none;text-align:center;color:#fff4dc;
        font:700 calc(78*var(--u))/1.1 'Mitr',sans-serif;-webkit-text-stroke:calc(4*var(--u)) #2a1d3a;paint-order:stroke;text-shadow:0 calc(6*var(--u)) 0 rgba(0,0,0,.35);opacity:0;transition:opacity .25s}
      #pvp-big small{display:block;font-size:calc(26*var(--u));-webkit-text-stroke:calc(2*var(--u)) #2a1d3a}
      #pvp-big.show{opacity:1}`;
    document.head.appendChild(st);
    const hudEl = document.getElementById('hud') || document.body;
    bar = document.createElement('div'); bar.id = 'pvp-bar'; bar.hidden = true;
    bigEl = document.createElement('div'); bigEl.id = 'pvp-big';
    hudEl.append(bar, bigEl);
  }
  let bigT = 0;
  function big(text, sub) {
    ui();
    bigEl.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : '');
    bigEl.classList.add('show');
    clearTimeout(bigT); bigT = setTimeout(() => bigEl.classList.remove('show'), 1100);
  }
  let lastBar = '';
  function hud() {
    ui();
    const d = D(), g = G();
    if (!d) { if (!bar.hidden) bar.hidden = true; lastBar = ''; return; }
    const r = rem(d.opp), p = g.player;
    const limit = d.arena ? ARENA.time : FIELD.time, left = d.phase === 'f' ? Math.max(0, Math.ceil(limit - d.t)) : d.phase === 'c' ? limit : 0;
    const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const mine = Math.round((100 * p.hp) / p.maxHp), theirs = r ? Math.round(r.hpPct) : 0;
    const h = `<b>${esc(p.name || 'คุณ')}</b><span class="pv-hp"><i style="width:${mine}%"></i></span>` +
      (d.best > 1 ? `<span class="pv-w">${d.wins[0]}–${d.wins[1]}</span>` : '') + `<span class="pv-t">${mm}</span>` +
      `<span class="pv-hp them"><i style="width:${theirs}%"></i></span><b>${esc(r ? r.name : '?')}</b>`;
    if (h !== lastBar) { bar.innerHTML = h; lastBar = h; }
    bar.hidden = false;
    if (d.phase === 'f' && !d.arena && d.out > 0) { const n = Math.ceil(FIELD.out - d.out); if (n !== d.outShown) { d.outShown = n; big(String(n), 'กลับเข้าวงไฟ!'); } }
  }
  function showAsk() {
    if (!ask) {
      ask = document.createElement('div');
      ask.className = 'pn-ask'; ask.hidden = true;
      ask.innerHTML = '<div class="pn-ask-t" id="pv-ask-t"></div><div class="pn-ask-b"><button class="kw-btn blue" data-pv="yes">รับคำท้า</button>' +
        '<button class="kw-btn grey" data-pv="no">ไม่รับ</button></div><div class="pn-ask-bar"><i id="pv-ask-i"></i></div>';
      ask.addEventListener('click', (e) => { const b = e.target.closest('[data-pv]'); if (b) PV.answer(b.dataset.pv === 'yes'); });
      (document.getElementById('hud') || document.body).appendChild(ask);
    }
    const v = incoming;
    if (!v) return;
    const r = rem(v.from);
    document.getElementById('pv-ask-t').innerHTML = `<b>${esc(v.name)}</b> ท้า${v.arena ? 'ประลองบนเวที (ชนะ 2 ใน 3 ยก)' : 'ดวลกับคุณ'}` +
      (r ? `<small>Lv ${r.lv} ${esc((NC.JOBS[r.job] || {}).name || '')} · ตายไม่เสียอะไร เลือดกลับเท่าเดิมเมื่อจบ</small>` : '');
    ask.hidden = false;
  }
  function hideAsk() { if (ask) ask.hidden = true; }
  const toast = (t) => { if (NC.HUD && NC.HUD.toast) NC.HUD.toast(t); };
  const note = (t) => { if (NC.HUD && NC.HUD.log) NC.HUD.log(t, 'level'); };
  // (js/online/pvp.js drives the same match bar, words, ring and question from the server's record)
  PV.ui = { big, note, toast, finish, ringFx, dropProxy, offer(v) { incoming = v; showAsk(); }, closeAsk() { incoming = null; hideAsk(); } };

  // ---------------- hooks (installed at HUD.init: every file's own wrappers are set by then, so these are outermost) ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    if (!fields()) return; // (no online layer)
    ui();
    // hits on the stand-in become claims; it never takes damage itself
    const baseDmg = NC.damageEnemy;
    NC.damageEnemy = function (g, e, r0, kx, ky, o) {
      if (e && e.pvp) { claim(g, e, r0, o); return; }
      return baseDmg.apply(this, arguments);
    };
    // the stand-in follows its player; statuses put on it are passed on
    const baseUpd = NC.updateEnemy;
    NC.updateEnemy = function (g, e) {
      if (e && e.pvp) { statusOut(e); return; }
      return baseUpd.apply(this, arguments);
    };
    const baseStatus = NC.statusEnemy;
    NC.statusEnemy = function (g, e, kind, dur) {
      if (e && e.pvp) { if (kind === 'stun' || kind === 'freeze') push(e.pvp, 0, 0, kind === 'freeze' ? 2 : 1, dur || 1); return; }
      return baseStatus.apply(this, arguments);
    };
    // the stand-in is never drawn (the player's own hero is), nor its bar
    for (const k of ['drawEnemy', 'drawEnemyBar']) {
      const base = NC[k];
      // (drawEnemy is (ctx, game, e), drawEnemyBar is (ctx, e, game): skip whichever argument is the stand-in)
      if (typeof base === 'function') NC[k] = function () { for (const a of arguments) if (a && a.pvp) return; return base.apply(this, arguments); };
    }
    // stunned / frozen: no moving, attacking or casting; slowed: slower
    const baseUpdP = NC.updatePlayer;
    NC.updatePlayer = function (g, dt) {
      const d = D(), p = g.player;
      if (d && d.cc && d.cc.stun > 0) {
        const I = g.input;
        I.mx = 0; I.my = 0; I.attack = false; I.attackTap = false; g.mouse.down = false;
        for (const k of NC.HOTKEYS || []) I[k] = false;
      }
      // (a slow halves this frame's walk; never touches p.d, which applyGear may rebuild mid-frame)
      const slow = d && d.cc && d.cc.slow > 0 && !p.dash, x0 = p.x, y0 = p.y;
      const res = baseUpdP.apply(this, arguments);
      if (slow && !p.dash) { const nx = x0 + (p.x - x0) * 0.5, ny = y0 + (p.y - y0) * 0.5; if (g.world.fits(nx, ny, p.r || 20)) { p.x = nx; p.y = ny; } }
      return res;
    };
    // in a duel the hero never faints: the blow that would end it ends the round instead
    (NC.heroGuards || []).push((g, p, dmg) => {
      const d = D();
      if (!d || d.phase !== 'f' || d.over) return dmg;
      const taken = p.d && p.d.taken ? 1 - p.d.taken / 100 : 1;
      if (dmg * taken >= p.hp) { loseRound(g, ''); return Math.max(0, Math.floor((p.hp - 1) / Math.max(0.01, taken))); }
      return dmg;
    });
    // the frame: the match, the stand-in (before the game moves anyone)
    const baseParty = NC.Party && NC.Party.update;
    if (baseParty) NC.Party.update = function (g, dt) { const res = baseParty.apply(this, arguments); try { frame(g, dt || 1 / 60); } catch (err) { console.warn('pvp', err); } return res; };
    // the challenger's match state: remember the latest per player (the guest starts from it)
    net().hooks.push((r, pr) => { r.lastDu = Array.isArray(pr.du) ? pr.du : null; });
    // right-click a player's hero: challenge them (js/playermenu.js now catches a click on a hero first and opens its menu,
    // whose ท้าดวล calls PV.challenge; this stays for a hero the menu does not take)
    const cv = document.getElementById('view');
    if (cv) cv.addEventListener('mousedown', (ev) => {
      if (ev.button !== 2) return;
      const g = G(), N = net();
      if (!g || !N) return;
      let best = null, bd = 90;
      for (const r of N.remotes.values()) {
        if (!r.named || r.map !== g.mapId) continue;
        const dd = Math.hypot(g.mouse.wx - r.x, g.mouse.wy - (r.y - 60));
        if (dd < bd) { bd = dd; best = r; }
      }
      if (!best) return;
      const res = PV.challenge(best.peer);
      if (res !== 'ok') toast({ busy: 'กำลังดวลอยู่', far: 'อยู่ไกลเกินไป (ต้องแมพเดียวกัน ใกล้กัน)', dup: 'ท้าไปแล้ว รอคำตอบ', off: 'คนนี้ไม่ได้ออนไลน์แล้ว' }[res] || 'ท้าไม่ได้');
    });
  };
  // /duel name (chat.js asks NC.chatCmds for commands it does not know)
  NC.chatCmds = NC.chatCmds || {};
  NC.chatCmds['/duel'] = NC.chatCmds['/ดวล'] = function (rest, say) {
    const N = net();
    if (!N || !N.room) { say('ดวลได้เมื่อเล่นออนไลน์', 'warn'); return; }
    const r = rest && N.byName ? N.byName(rest.trim()) : null;
    if (!r) { say('พิมพ์ /duel ชื่อ (คนที่อยู่แมพเดียวกัน) หรือคลิกตัวละครของเขาแล้วเลือก ท้าดวล', 'warn'); return; }
    const res = PV.challenge(r.peer);
    if (res !== 'ok') say({ busy: 'กำลังดวลอยู่', far: 'ต้องอยู่แมพเดียวกันและใกล้กัน', dup: 'ท้าไปแล้ว รอคำตอบ', off: 'คนนี้ไม่ได้ออนไลน์แล้ว' }[res] || 'ท้าไม่ได้', 'warn');
  };
})();
