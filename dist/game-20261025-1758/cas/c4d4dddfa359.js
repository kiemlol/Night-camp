/* partysupport.js — the priest's heals, buffs and resurrections reach the REAL players of the party (the balance round of
   2026-10-04; the user: "การปาร์ตี้และอาชีพพระก็มีส่วนสำคัญในการเล่นด้วย"). Before, every heal, party buff and
   resurrection only knew party.js's AI friends (K.friends), so in a real party a priest healed nobody but himself.
     stand-ins   each member of my party on my map (js/partynet.js, net.js presence) has a stand-in in the friends lists
                 (NC.allies: K.friends, the priest's heal, resurrection), where they stand with their HP (their presence
                 hp % x the max HP they send in `mh`). What my skills do to a stand-in in a frame goes to that player:
                   heal     the HP it gained (summed for a quarter second: a +N on their screen)
                   buff     a support job's party buff (priest, bishop, lightkeeper, wisp and their class 3) whole, as if
                            they had cast it themselves (Holy Blessing's STR INT DEX, Swift Grace, Veil of Light...), for its time
                   boost    any other job's party part (the AI friends' share): damage x, damage taken x, attack speed x
                   revive   a resurrection: back on their feet with that share of HP
                 presence field `su`: [[seq, toPeer, kind, a, b, c, d]] (the last 12, about 4 s); each player applies the
                 ones addressed to them once (the first presence only sets where that sender's counter stands); everything
                 from others is clamped (a heal never above the max HP, only known buff skills, short times)
     faint       in a party with a support job on the map a fainted hero waits 10 s for a resurrection before going back to
                 the camp (2.6 s alone)
     EXP         partynet.js adds SUPPORT_EXP (+30% to the shared EXP of a kill) while NC.PartySupport.active(): a support
                 member helped me in the last 90 s, or I am one and helped someone
     auto farm   a support job in a party (NC.Auto.supportMode): stays by the party, heals whoever drops under 70%, raises
                 the fallen, casts the party buffs when they run out, and only fights round the party
   Hooks: NC.allies (read by skillkit.js, priest_skills.js, skills_v21.js, skills_t1.js, class2_skills_c.js), NC.Party.lib.revive,
   NC.skillCasts, NC.HUD.update (the end of a frame: the stand-ins' changes go out, then they take the newest presence),
   NC.Net fields / hooks, NC.heroHit / NC.heroGuards (the boosts), NC.hurtPlayer (the longer faint).
   Test: two tabs with ?netmock in one party (P), one a priest: NC.PartySupport.log lists what went out and came in. */
(function () {
  'use strict';
  const NC = window.NC, net = NC.Net, FX = NC.FX, K = NC.SkillKit, SK = NC.SKILLS;
  const SUPPORT = new Set(['priest', 'bishop', 'lightkeeper', 'wisp', 'starsaint', 'beacon', 'starshepherd']);
  const HELP_S = 90, FAINT_S = 10, KEEP_MS = 4000, OUT_MAX = 12, HEAL_EVERY = 0.25;
  const isSupport = (NC.isSupportJob = (job) => SUPPORT.has(job));
  const PS = (NC.PartySupport = { SUPPORT, log: [], SUPPORT_EXP: 0.3 });
  const G = () => NC.game;
  const PN = () => NC.PartyNet;
  const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  const note = (s) => { PS.log.push(s); if (PS.log.length > 40) PS.log.shift(); };

  // ---------------- the stand-ins ----------------
  const stand = new Map(); // peer -> stand-in
  function standIn(r) {
    let s = stand.get(r.peer);
    if (!s) {
      s = { kind: 'ally', proxy: true, peer: r.peer, name: r.name, x: r.x, y: r.y, r: 20, hp: 1, maxHp: 1, sp: 1, maxSp: 1, dead: 0, inv: 0,
        buffs: {}, cd: {}, skills: {}, job: r.job, lv: r.lv, map: r.map, d: { def: 0, mdef: 0, flee: 0 } };
      stand.set(r.peer, s);
    }
    return s;
  }
  // my party's members on my map, as stand-ins (the AI friends first)
  NC.allies = function (game) {
    const ai = (NC.Party && NC.Party.members) || [];
    // (not inside another player's replayed skill: net.js runs their casts as looks only, with a stand-in game)
    if (!stand.size || !game || (net && net.inLooks && net.inLooks()) || (NC.game && game.player !== NC.game.player)) return ai;
    const ins = [];
    for (const s of stand.values()) if (s.map === game.mapId && s.live) ins.push(s);
    return ins.length ? ai.concat(ins) : ai;
  };

  // ---------------- what goes out ----------------
  let seq = 0;
  const out = []; // [seq, toPeer, kind, a, b, c, d, sentMs]
  const pendingHeal = new Map(); // peer -> HP
  let healT = 0; // (performance.now() of the last flush)
  const lastHelpGiven = { t: -1e9 };
  function send(peer, kind, a, b, c, d) {
    out.push([++seq, peer, kind, a, b === undefined ? 0 : b, c === undefined ? 0 : c, d === undefined ? 0 : d, Date.now()]);
    while (out.length > OUT_MAX) out.shift();
    const g = G();
    lastHelpGiven.t = g ? g.time : 0;
    note(`→ ${(stand.get(peer) || {}).name || peer} ${kind} ${a}${b ? ' ' + b : ''}`);
    if (net) net.send();
  }
  if (net) net.fields.push({ key: 'su', get: () => { const t = Date.now(); while (out.length && t - out[0][7] > KEEP_MS) out.shift(); return out.length ? out.map((o) => o.slice(0, 7)) : null; } });
  // my max HP / SP (the others' stand-ins of me need them to turn my hp % into HP)
  if (net) net.fields.push({ key: 'mh', get: () => { const p = G() && G().player; return p ? [Math.round(p.maxHp), Math.round(p.maxSp)] : null; } });

  // a full buff for the others: a party buff of a support job (the whole skill, as if they cast it)
  const fullBuff = (id) => { const S = SK[id]; return !!(S && S.buff && S.party); };
  let fullT = -1, fullPeers = new Set();
  if (NC.skillCasts) NC.skillCasts.push((game, p, id) => {
    if (!game || p !== game.player || !isSupport(p.job) || !fullBuff(id)) return;
    const S = SK[id], lv = NC.skillLv(p, id) || 1, r = (S.party(lv) && S.party(lv).r) || 520;
    const dur = Math.round(S.dur ? S.dur(lv) : 30);
    fullT = game.time; fullPeers = new Set();
    for (const s of stand.values()) {
      if (!s.live || s.map !== game.mapId || s.dead > 0 || NC.dist(s.x, s.y, p.x, p.y) > r) continue;
      send(s.peer, 'b', id, lv, dur);
      fullPeers.add(s.peer);
    }
  });
  // resurrection of a stand-in: the player is told, the stand-in itself is left as it is
  if (NC.Party && NC.Party.lib && NC.Party.lib.revive) {
    const baseRevive = NC.Party.lib.revive;
    NC.Party.lib.revive = function (game, a, frac) {
      if (a && a.proxy) { if (a.dead > 0) send(a.peer, 'r', +num(frac, 0.05, 1, 0.2).toFixed(2)); a.rezT = game.time; return; }
      return baseRevive.apply(this, arguments);
    };
  }

  // the end of each frame: what my skills did to the stand-ins goes out, then they take the newest presence
  function endFrame(game) {
    const p = game.player, mates = PN() ? PN().onMap() : [];
    for (const s of stand.values()) {
      if (!s.live) continue;
      // heals
      if (s._base !== undefined && s.hp - s._base >= 1 && !(s.dead > 0)) pendingHeal.set(s.peer, (pendingHeal.get(s.peer) || 0) + (s.hp - s._base));
      // the AI-friend share of a party buff (bless / guard / haste), unless that very cast already went out whole
      const skip = fullT === game.time && fullPeers.has(s.peer);
      const boost = (until, k, kind) => {
        const left = (s[until] || 0) - game.time;
        if (left > 0.5 && (s['_s' + until] !== s[until] || s['_s' + k] !== s[k])) {
          s['_s' + until] = s[until]; s['_s' + k] = s[k];
          if (!skip) send(s.peer, 'p', kind, +num(s[k], 0.3, 2, 1).toFixed(3), Math.round(left));
        }
      };
      boost('bless', 'blessK', 'atk'); boost('guardUntil', 'guardK', 'guard'); boost('hasteUntil', 'hasteK', 'haste');
    }
    const nowMs = performance.now();
    if (nowMs - healT >= HEAL_EVERY * 1000 && pendingHeal.size) {
      healT = nowMs;
      for (const [peer, n] of pendingHeal) if (n >= 1) send(peer, 'h', Math.round(n));
      pendingHeal.clear();
    }
    // the newest presence
    const seen = new Set();
    for (const r of mates) {
      const s = standIn(r);
      seen.add(r.peer);
      const mh = Array.isArray(r.mh) ? r.mh : null;
      s.maxHp = mh ? num(mh[0], 1, 1e6, 1) : Math.max(1, s.maxHp);
      s.maxSp = mh ? num(mh[1], 1, 1e6, 1) : Math.max(1, s.maxSp);
      s.hp = s._base = r.dd ? 0 : Math.max(1, Math.round((s.maxHp * r.hpPct) / 100));
      s.dead = r.dd ? 1 : 0;
      s.x = r.x; s.y = r.y; s.map = r.map; s.name = r.name; s.job = r.job; s.lv = r.lv; s.live = !!mh;
    }
    for (const [peer, s] of stand) if (!seen.has(peer)) { s.live = false; s._base = undefined; }
  }

  // ---------------- what comes in ----------------
  const lastSeq = new Map(); // sender peer -> the last seq applied
  const helpedBy = new Map(); // sender peer -> game time of their last help
  const boost = { atk: { k: 1, until: 0 }, guard: { k: 1, until: 0 } };
  function apply(game, r, e) {
    const p = game.player, [, , kind, a, b, c, d] = e, who = r.name || 'เพื่อน';
    helpedBy.set(r.peer, game.time);
    if (kind === 'h') {
      if (p.dead > 0) return;
      const got = Math.round(Math.min(num(a, 0, 1e6, 0), p.maxHp - p.hp));
      if (got < 1) return;
      p.hp += got;
      FX.num(p.x, p.y - 150, '+' + got, { fill: '#8dff8a', size: 44 });
      FX.add({ type: 'vplus', x: p.x, y: p.y, life: 0.9 });
      note(`← ${who} heal ${got}`);
    } else if (kind === 'b') {
      const S = SK[a];
      if (typeof a !== 'string' || !fullBuff(a) || p.dead > 0) return;
      const lv = Math.round(num(b, 1, 20, 1)), dur = num(c, 1, 600, 30);
      K.startBuff(game, p, a, lv, dur);
      if (K.buffFx) K.buffFx(game, p, S.rgb || '255,240,190', { flash: false, r: 120 });
      NC.HUD.log(`${who} ให้ ${S.name || a} Lv ${lv} (${Math.round(dur)} วิ)`, 'item');
      note(`← ${who} buff ${a} ${lv}`);
    } else if (kind === 'p') {
      if (p.dead > 0) return;
      const k = num(b, 0.3, 2, 1), dur = num(c, 1, 300, 10);
      if (a === 'atk') { boost.atk.k = Math.min(1.5, Math.max(1, k)); boost.atk.until = game.time + dur; }
      else if (a === 'guard') { boost.guard.k = Math.max(0.5, Math.min(1, k)); boost.guard.until = game.time + dur; }
      else if (a === 'haste') { p.hasteK = Math.min(1.3, Math.max(1, k)); p.hasteUntil = game.time + dur; }
      note(`← ${who} boost ${a} ${k}`);
    } else if (kind === 'r') {
      if (!(p.dead > 0)) return;
      p.dead = 0; p.hp = Math.max(1, Math.round(p.maxHp * num(a, 0.05, 1, 0.2))); p.inv = 1.5;
      FX.ring(p.x, p.y - 10, 20, 170, '255,230,150', 0.7, 10);
      FX.stars(p.x, p.y - 70, 14, '255,236,160', { speed: 220 });
      game.toast(`${who} ชุบชีวิตให้แล้ว!`);
      if (autoWas && NC.Auto && !NC.Auto.on) setTimeout(() => { if (G() && !NC.Auto.on && G().player.dead <= 0) NC.Auto.toggle(G()); }, 600);
      autoWas = false;
      NC.HUD.log(`${who} ชุบชีวิตคุณ (HP ${Math.round(num(a, 0.05, 1, 0.2) * 100)}%)`, 'item');
      note(`← ${who} revive`);
    }
  }
  if (net) net.hooks.push((r, pr, first) => {
    const list = Array.isArray(pr.su) ? pr.su.filter((e) => Array.isArray(e) && typeof e[0] === 'number') : [];
    const top = list.reduce((m, e) => Math.max(m, e[0]), 0);
    if (first || !lastSeq.has(r.peer)) { lastSeq.set(r.peer, top); return; }
    r.mh = Array.isArray(pr.mh) ? pr.mh : r.mh;
    const g = G();
    if (!g || !g.player || !PN() || !PN().members().includes(r.peer) || r.map !== g.mapId) { lastSeq.set(r.peer, Math.max(lastSeq.get(r.peer), top)); return; }
    const me = net.me();
    for (const e of list.sort((x, y) => x[0] - y[0])) if (e[0] > lastSeq.get(r.peer) && e[1] === me) apply(g, r, e);
    lastSeq.set(r.peer, Math.max(lastSeq.get(r.peer), top));
  });
  // (the presence hook above stores mh only after the first sight: take it on every presence too)
  if (net) net.hooks.push((r, pr) => { if (Array.isArray(pr.mh)) r.mh = pr.mh; });

  // the boosts on me: damage out, damage taken (attack speed: skills_v21.js already reads p.hasteUntil / hasteK)
  const baseHeroHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHeroHit.apply(this, arguments), g = G();
    if (r && r.dmg > 0 && g && g.player && d === g.player.d && boost.atk.until > g.time) r.dmg = Math.max(1, Math.round(r.dmg * boost.atk.k));
    return r;
  };
  if (NC.heroGuards) NC.heroGuards.push((game, p, dmg) => (boost.guard.until > game.time ? Math.max(1, Math.round(dmg * boost.guard.k)) : dmg));

  // ---------------- the faint: wait for a resurrection when a support member is here ----------------
  const supportHere = (game) => !!PN() && PN().onMap().some((r) => isSupport(r.job) && !r.dd);
  let autoWas = false; // (the auto farm was on when I fainted: a resurrection turns it back on)
  const baseHurt = NC.hurtPlayer;
  NC.hurtPlayer = function (game) {
    const p = game.player, was = p.dead > 0, auto = !!(NC.Auto && NC.Auto.on);
    const r = baseHurt.apply(this, arguments);
    if (!was && p.dead > 0 && supportHere(game)) {
      p.dead = FAINT_S; autoWas = auto;
      game.toast(`หมดแรง... พระในปาร์ตี้ชุบชีวิตได้ภายใน ${FAINT_S} วิ`);
    }
    return r;
  };

  // ---------------- the EXP bonus (partynet.js) ----------------
  PS.active = function () {
    const g = G(), p = g && g.player;
    if (!g || !p || !PN() || !PN().pid()) return false;
    if (isSupport(p.job) && g.time - lastHelpGiven.t < HELP_S) return true;
    for (const r of PN().onMap()) if (isSupport(r.job) && g.time - (helpedBy.get(r.peer) || -1e9) < HELP_S) return true;
    return false;
  };

  // ---------------- the auto farm of a support job in a party ----------------
  // (js/autofarm.js asks: whom to stay with, whether someone needs a heal)
  PS.supportMode = (game) => { const p = game && game.player; return !!(p && isSupport(p.job) && PN() && PN().pid() && PN().onMap().length); };
  PS.lead = function (game) {
    const p = game.player;
    let best = null, bd = Infinity;
    for (const s of stand.values()) {
      if (!s.live || s.map !== game.mapId) continue;
      const d = NC.dist(s.x, s.y, p.x, p.y);
      if (d < bd) { bd = d; best = s; }
    }
    return best && { x: best.x, y: best.y, d: bd, who: best };
  };
  PS.needsHeal = (game, p, r) => NC.allies(game).some((a) => a.dead <= 0 && a.maxHp > 0 && a.hp / a.maxHp < 0.7 && NC.dist(a.x, a.y, p.x, p.y) < (r || 440));
  PS.needsRaise = (game, p, r) => NC.allies(game).some((a) => a.dead > 0 && NC.dist(a.x, a.y, p.x, p.y) < (r || 520));

  const baseHud = NC.HUD.update;
  NC.HUD.update = function (game) {
    const r = baseHud.apply(this, arguments);
    if (game && game.player && net && PN()) { try { endFrame(game); } catch (e) { console.warn('partysupport', e); } }
    return r;
  };
})();
