/* monskills.js — monsters of the later maps use skills (the balance round of 2026-10-11; the user: "มอนแมพหลังๆต้องมีสกิล
   นะ เพื่อให้สมดุล บางตัวจะยิงไกล หรือมีสกิลแปลกๆ อาชีพบางอาชีพจะได้ตีแต่ละแมพถนัดต่างกัน").
     who            every monster from Lv 25 (the same bat stays simple on the first maps); a second skill from Lv 60 for
                    the species that have two. Bosses keep their own moves (boss.js, dunbosses.js, storyboss.js).
     the skills     every one is shown first (a red circle, lane or line on the ground fills up) so it can be dodged:
                    spit (a shot from afar) · volley (three) · lob (a blast falls where the hero stands) · slam (a ring
                    round itself) · breath (a lane in front, its element's status) · pool (a puddle under the hero) ·
                    blink (appears beside the hero) · leap (jumps onto the hero's spot) · pull (a tether drags the hero
                    in) · harden (3 s: physical hits do 30%) · ward (3 s: magic does 30%) · evade (dodges physical
                    hits, hops away) · thorns (3 s: melee hits come back) · howl (wakes and speeds up the pack)
     who gets what  from the species' kind, family (NC.BL.familyOf), element and name: golems harden and slam, ghosts
                    blink and ward, birds evade or volley, fire beasts breathe fire, slimes leave puddles, wolves howl...
     map fit        each map adds up its monsters (their skills, DEF / MDEF / FLEE) into which play fits it best:
                    สายประชิด (melee) · สายยิงไกล (ranged) · สายเวท (magic) · สายกวาดฝูง (area);
                    shown when the hero arrives (toast + log) and kept in NC.MonSkills.fit(mapId)
   Hooks: NC.updateEnemy (casting: the monster stands while it winds up; outermost, after js/balance_1011.js: a calm
   monster never casts), NC.heroHit (harden, ward, evade, thorns), NC.updatePlayer (the map's fit on arrival). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, TAU = Math.PI * 2;
  const G = () => NC.game;
  const rand = NC.rand, dist = NC.dist;
  const LV1 = 25, LV2 = 60;

  // ---------------- the skills ----------------
  // cd (s), range (from the hero), wind (s of warning), th (the name shown), and what it does
  const SK = {
    spit: { cd: 7, range: 560, wind: 0.5, th: 'ยิงไกล' },
    volley: { cd: 9, range: 600, wind: 0.6, th: 'ยิงกระจาย' },
    lob: { cd: 9, range: 620, wind: 0.95, th: 'ปาตกใส่' },
    slam: { cd: 8, range: 190, wind: 0.75, th: 'ทุบพื้น' },
    breath: { cd: 10, range: 300, wind: 0.8, th: 'พ่น' },
    pool: { cd: 11, range: 520, wind: 0.7, th: 'แอ่ง' },
    blink: { cd: 9, range: 900, min: 300, wind: 0.35, th: 'วาร์ป' },
    leap: { cd: 10, range: 650, min: 220, wind: 0.85, th: 'กระโจน' },
    pull: { cd: 11, range: 560, min: 220, wind: 0.6, th: 'ดึง' },
    harden: { cd: 11, range: 400, wind: 0.3, th: 'ร่างแข็ง' },
    ward: { cd: 11, range: 600, wind: 0.3, th: 'ม่านเวท' },
    evade: { cd: 0, range: 0, th: 'หลบ' }, // (passive: in NC.heroHit)
    skittish: { cd: 0, range: 0, th: 'หลบประชิด' }, // (passive: dodges blows from close by only; the ranged maps)
    thorns: { cd: 12, range: 260, wind: 0.3, th: 'หนามสะท้อน' },
    howl: { cd: 16, range: 700, wind: 0.5, th: 'หอนเรียกฝูง' },
  };
  const COL = { fire: '255,140,60', water: '120,200,255', earth: '210,170,110', wind: '170,240,200', poison: '170,240,110', holy: '255,236,150',
    shadow: '175,130,255', ghost: '150,240,230', undead: '190,215,255', neutral: '255,220,150' };
  const ST_OF = { fire: 'burn', water: 'freeze', poison: 'poison', shadow: 'blind', ghost: 'silence', undead: 'bleed', wind: 'slow', earth: 'stun', holy: 'blind' };

  // ---------------- who gets what ----------------
  const SPEC = () => NC.SPECIES || {};
  const has = (t, ...ws) => ws.some((w) => t.includes(w));
  function pickFor(t) {
    const S = SPEC()[t] || NC.MONSTERS[t] || {}, el = S.element || 'neutral', kind = S.kind || '';
    let fam = ''; try { fam = NC.BL && NC.BL.familyOf ? NC.BL.familyOf(t) : ''; } catch (e) { fam = ''; }
    // their way of fighting first where it is already special (a shooter shoots, a bomber bursts), then names (the
    // clearest), then the kind and family, then the element
    if (kind === 'ranged') return ['volley', 'lob'];
    if (kind === 'bomber') return ['leap'];
    if (has(t, 'golem', 'crystal', 'stone_owl', 'owl_star', 'rock', 'ankylo', 'rhino', 'turtle', 'beetle', 'tombstone', 'sand_giant')) return ['harden', 'slam'];
    if (has(t, 'ghost', 'wraith', 'wisp', 'mist', 'lamplighter', 'specter', 'citizen')) return ['blink', 'ward'];
    if (has(t, 'book', 'paper', 'scope', 'cardinal', 'temple', 'stargazer')) return ['ward', 'volley'];
    if (has(t, 'wolf', 'hound', 'raptor', 'rat', 'bandit', 'dino', 'lizard_lead', 'shroom_wolf')) return ['howl', 'leap'];
    if (has(t, 'eagle', 'vulture', 'giant_crow', 'pterosaur', 'storm', 'sparrow')) return ['volley', 'evade'];
    if (has(t, 'crow', 'bat', 'moth', 'mosquito', 'dragonfly', 'fox', 'rabbit', 'heron', 'deer', 'imp', 'kingfisher')) return t.includes('imp') ? ['blink', 'lob'] : ['evade', 'blink'];
    if (has(t, 'salamander', 'lizard', 'croc', 'snow_wolf', 'ice_goat', 'dragon', 'kappa')) return t.includes('kappa') ? ['spit', 'pull'] : ['breath', 'leap'];
    if (has(t, 'scorpion', 'hedgehog', 'crab', 'maneater', 'thorn', 'cactus')) return ['thorns', 'spit'];
    if (has(t, 'frog', 'toad', 'thread', 'binder', 'hand', 'puppet', 'snake')) return t.includes('snake') || t.includes('toad') ? ['spit', 'pool'] : ['pull', 'slam'];
    if (has(t, 'zombie', 'skeleton', 'knight', 'bone', 'guard', 'soldier', 'villager', 'bell', 'carthorse', 'horse', 'cart')) return ['slam', 'pull'];
    if (has(t, 'slime', 'blob', 'slug', 'bloom', 'spore', 'shroom', 'ink')) return ['pool', 'lob'];
    if (has(t, 'goat', 'ram', 'boar', 'giant', 'treant', 'stump', 'mole', 'worm')) return ['slam', 'harden'];
    if (kind === 'healer' || kind === 'summoner') return ['ward', 'blink'];
    if (kind === 'shield') return ['thorns', 'slam'];
    if (kind === 'fly') return ['evade', 'volley'];
    if (kind === 'charge') return ['leap', 'howl'];
    if (fam === 'flame' || el === 'fire') return ['breath', 'lob'];
    if (el === 'water') return ['spit', 'breath'];
    if (el === 'poison') return ['pool', 'spit'];
    if (el === 'shadow' || el === 'ghost') return ['blink', 'ward'];
    if (el === 'wind') return ['evade', 'volley'];
    return ['slam', 'spit'];
  }
  const cache = {};
  function of(t, lv) {
    if (!t || (NC.BOSSES && NC.BOSSES[t]) || (NC.STORY_BOSSES && NC.STORY_BOSSES[t]) || (lv || 0) < LV1) return [];
    if (NC.NO_MONSKILLS && NC.NO_MONSKILLS[t]) return []; // (a boss's own minions: js/baphomet.js's kids)
    const L = cache[t] || (cache[t] = pickFor(t));
    return lv >= LV2 ? L.slice(0, 2) : L.slice(0, 1);
  }
  // ---------------- each later map's style: which play it favours ----------------
  // set by hand so every play has its maps in every level band (worked out by the monsters' stats alone, 33 of 53 maps
  // came out "magic": the later monsters are armoured). A map's monsters then lean their skills that way:
  //   ranged  they brawl up close (slams, breath, thorns): stand off and shoot
  //   melee   they shoot, blink, pull and ward off magic: close in and hit
  //   magic   they harden against blows and dodge them (spells never miss)
  //   area    they come as packs (howls): sweep them
  const STYLE = {
    graveyard: 'magic', crypt1: 'magic', wind: 'magic', owl1: 'magic', canyon2: 'magic', canyon: 'magic', volcano: 'magic', puppet2: 'magic', bell1: 'magic', bell5: 'magic', grave2: 'magic',
    marsh3: 'ranged', antmine2: 'ranged', burnt: 'ranged', woods: 'ranged', owl2: 'ranged', peak: 'ranged', swamp: 'ranged', roots2: 'ranged', lavavent1: 'ranged', ledger2: 'ranged',
    prime: 'ranged', prime2: 'ranged', bell2: 'ranged', bell6: 'ranged', grave1: 'ranged',
    antmine1: 'melee', road: 'melee', salt: 'melee', owl3: 'melee', crypt2: 'melee', roots1: 'melee', nroad: 'melee', outer: 'melee', ledger1: 'melee', lake: 'melee',
    puppet1: 'melee', isle: 'melee', cathedral: 'melee', bell3: 'melee', bell7: 'melee',
    marsh2: 'area', graveyard2: 'area', woods2: 'area', antmine3: 'area', wind2: 'area', swamp2: 'area', canyon3: 'area', lavavent2: 'area', canal: 'area', dark: 'area', bell4: 'area',
  };
  const LEAN = {
    ranged: { blink: 'thorns', leap: 'slam', pull: 'slam', spit: 'breath', volley: 'breath', lob: 'slam', harden: 'thorns' },
    melee: { slam: 'lob', breath: 'spit', pool: 'spit', thorns: 'ward', harden: 'ward' }, // (no slams near a fighter here; lob hits whoever stands still)
    magic: { ward: 'harden', blink: 'evade', pull: 'slam', spit: 'lob', volley: 'lob', thorns: 'harden' },
    area: {},
  };
  function lean(list, style, t) {
    const L = LEAN[style] || {};
    let out = list.map((id) => L[id] || id);
    if (style === 'area' && !out.includes('howl')) { const S = SPEC()[t] || {}; if (['charge', 'fly', 'melee', 'hop'].includes(S.kind)) out[0] = 'howl'; }
    out = out.filter((id, i) => out.indexOf(id) === i);
    return out;
  }
  const leanCache = {};
  // every monster of a styled map also carries the map's own skill (its signature: what makes that play the right one
  // there; measured 2026-10-11, the leaned skills alone moved the bots' farming 0-7%)
  const SIGN = { magic: ['harden'], melee: ['ward', 'pull', 'blink'], ranged: ['skittish', 'ward'], area: ['howl'] }; // (pull and blink: only on a hero standing off, 220 / 300+ away)
  function ofOn(t, lv, mapId) {
    const base = of(t, lv), st = STYLE[mapId];
    if (!st || !base.length) return base;
    const k = mapId + '|' + t + '|' + (lv >= LV2 ? 2 : 1);
    if (leanCache[k]) return leanCache[k];
    const L = lean(base, st, t);
    for (const id of SIGN[st]) if (!L.includes(id)) L.push(id);
    return (leanCache[k] = L);
  }
  const skillsOf = (e) => {
    const m = (G() && G().mapId) || '';
    return e._msLv === e.lv && e._msT === e.type && e._msMap === m ? e._ms : ((e._msLv = e.lv), (e._msT = e.type), (e._msMap = m), (e._ms = ofOn(e.type, e.lv || 1, m)));
  };

  // ---------------- hitting the hero ----------------
  const elOf = (e) => e.atkElement || ((NC.MONSTERS[e.type] || {}).atkElement) || e.element || 'neutral';
  const rgbOf = (e) => COL[elOf(e)] || COL.neutral;
  // an aimed shot can miss; an area never does (the warning was the chance to step out)
  function hitHero(game, e, mul, sure, st) {
    const p = game.player;
    if (!p || p.dead > 0 || p.inv > 0) return false;
    const d = sure ? Object.assign({}, p.d, { flee: -1e4 }) : p.d;
    let r;
    try { r = NC.monsterHit(e, d); } catch (err) { return false; }
    if (r.miss) { FX.num(p.x, p.y - 150, r.lucky ? 'Lucky!' : 'MISS', { fill: r.lucky ? '#ffe28a' : '#cfd8ff', size: 34 }); p.inv = 0.25; return false; }
    NC.hurtPlayer(game, Math.max(1, Math.round(r.dmg * mul)), e.x);
    if (st && NC.HS) NC.HS.apply(game, st, { chance: 35, from: e.name || '' });
    return true;
  }
  const inEllipse = (x, y, cx, cy, r) => ((x - cx) / r) ** 2 + ((y - cy) / (r * 0.58)) ** 2 < 1;

  // ---------------- the warnings (as the dungeon bosses') ----------------
  function warnCircle(x, y, r, life, owner, rgb) {
    return FX.add({ type: 'custom', layer: 'low', x, y, r, life, owner, draw(ctx, p, u) {
      if (owner && owner.dead) return;
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.58);
      ctx.fillStyle = `rgba(255,70,90,${0.12 + 0.1 * Math.sin(p.t * 18)})`; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,90,110,0.32)'; ctx.beginPath(); ctx.arc(0, 0, p.r * Math.min(1, u), 0, TAU); ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = `rgba(${rgb || '255,120,130'},0.85)`; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.stroke();
      ctx.restore();
    } });
  }
  function warnLane(x, y, ang, len, w, life, owner) {
    return FX.add({ type: 'custom', layer: 'low', x, y, ang, len, w, life, owner, draw(ctx, p, u) {
      if (owner && owner.dead) return;
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.62); ctx.rotate(p.ang);
      ctx.fillStyle = `rgba(255,70,90,${0.12 + 0.1 * Math.sin(p.t * 18)})`; NC.rrect(ctx, 0, -p.w / 2, p.len, p.w, p.w / 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,90,110,0.32)'; NC.rrect(ctx, 0, -p.w / 2, Math.max(p.w, p.len * Math.min(1, u)), p.w, p.w / 2); ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,120,130,0.85)'; NC.rrect(ctx, 0, -p.w / 2, p.len, p.w, p.w / 2); ctx.stroke();
      ctx.restore();
    } });
  }
  const inLane = (x, y, lx, ly, a, len, w) => { const dx = x - lx, dy = (y - ly) / 0.62, along = dx * Math.cos(a) + dy * Math.sin(a), across = -dx * Math.sin(a) + dy * Math.cos(a); return along > -20 && along < len && Math.abs(across) < w / 2; };
  function orb(game, e, x, y, a, v, rgb, mul, R) {
    return FX.add({ type: 'custom', layer: 'glow', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.62, life: 1.6, owner: e, R: R || 22,
      update(c, dt, g) {
        const p = g.player;
        if (g.world && g.world.fits && !g.world.fits(c.x, c.y + 50, 6)) { c.dead = true; return; }
        if (p && p.dead <= 0 && Math.hypot(p.x - c.x, (p.y - 50 - c.y) * 1.2) < c.R + 22) { hitHero(g, c.owner, mul, false); c.dead = true; FX.puff(c.x, c.y, 5, { speed: 110, color: rgb }); }
      },
      draw(ctx, c) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.R * 1.8);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.35, `rgba(${rgb},0.85)`); gr.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c.x, c.y, c.R * 1.8, 0, TAU); ctx.fill();
        ctx.restore();
      } });
  }
  function puddle(game, e, x, y, R, life, rgb, mul, st) {
    return FX.add({ type: 'custom', layer: 'low', x, y, R, life, owner: e, tick: 0.3,
      update(c, dt, g) {
        c.tick -= dt;
        const p = g.player;
        if (c.tick <= 0 && c.t > 0.2 && p && p.dead <= 0 && inEllipse(p.x, p.y, c.x, c.y, c.R)) { c.tick = 0.7; hitHero(g, c.owner, mul, true, Math.random() < 0.35 ? st : null); }
      },
      draw(ctx, c) {
        const a = Math.min(1, c.t / 0.25) * Math.min(1, (c.life - c.t) / 0.5);
        ctx.save(); ctx.globalAlpha = a * 0.8; ctx.translate(c.x, c.y); ctx.scale(1, 0.58);
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, c.R);
        gr.addColorStop(0, `rgba(${rgb},0.75)`); gr.addColorStop(0.8, `rgba(${rgb},0.45)`); gr.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, c.R, 0, TAU); ctx.fill();
        ctx.restore();
      } });
  }
  const shout = (e, id) => FX.num(e.x, (NC.labelTop ? NC.labelTop(e) : e.y - 120) - 24, SK[id].th + '!', { fill: '#ffd0a0', size: 26 });

  // ---------------- the warnings on the ground now, and the way out of them (the auto farm steps out: js/autofarm.js) ----------------
  let DANGER = [];
  // never toward a warp (a step through one changes the map: the auto farm would stop) or into a wall
  const nearWarp = (g, x, y, r) => (g.portals || []).some((pt) => pt.to && Math.hypot(pt.x - x, pt.y - y) < r);
  function safeWay(g, p, dx, dy) {
    for (const turn of [0, 0.9, -0.9, 1.8, -1.8, Math.PI]) {
      const c = Math.cos(turn), s2 = Math.sin(turn), x = dx * c - dy * s2, y = dx * s2 + dy * c;
      const tx = p.x + x * 160, ty = p.y + y * 110;
      if (!nearWarp(g, tx, ty, 260) && (!g.world || !g.world.fits || g.world.fits(tx, ty, p.r || 20))) return [x, y];
    }
    return null;
  }
  function escape(p) {
    const g = G(), t = g ? g.time : 0;
    DANGER = DANGER.filter((d) => d.until > t && !d.e.dead);
    for (const d of DANGER) {
      if (d.r) {
        if (!inEllipse(p.x, p.y, d.x, d.y, d.r + 30)) continue;
        const a = NC.angle(d.x, d.y, p.x, p.y) || 0; return safeWay(g, p, Math.cos(a), Math.sin(a));
      }
      if (inLane(p.x, p.y, d.x, d.y, d.ang, d.len + 30, d.w + 40)) {
        const side = -(p.x - d.x) * Math.sin(d.ang) + ((p.y - d.y) / 0.62) * Math.cos(d.ang) >= 0 ? 1 : -1;
        return safeWay(g, p, -Math.sin(d.ang) * side, Math.cos(d.ang) * side);
      }
    }
    return null;
  }

  // ---------------- casting: a warning, then the effect ----------------
  // e._msCast = { id, t, at: [x, y], ang }: the monster stands still meanwhile
  function begin(game, e, id) {
    const S = SK[id], p = game.player, rgb = rgbOf(e), W = S.wind;
    const c = { id, t: 0, wind: W, at: [p.x, p.y], ang: NC.angle(e.x, e.y, p.x, p.y) };
    const sign = (SIGN[STYLE[game.mapId]] || []).includes(id) && id !== 'howl';
    e._msCast = c; e._msCd = e._msCd || {}; e._msCd[id] = game.time + S.cd * (sign ? 0.7 : 1) * rand(0.85, 1.2);
    e.face = p.x > e.x ? 1 : -1;
    shout(e, id);
    // (the auto farm notices 6 warnings in 10, like a player paying some attention: fleeing every one, a ranged bot
    // hardly shot at all, measured 2026-10-11)
    const until = game.time + W, seen = Math.random() < 0.6, R = (x, y, r) => seen && DANGER.push({ e, x, y, r, until }), L = (len, w) => seen && DANGER.push({ e, x: e.x, y: e.y, ang: c.ang, len, w, until });
    if (id === 'slam') { warnCircle(e.x, e.y, 190, W, e, rgb); R(e.x, e.y, 190); }
    else if (id === 'lob' || id === 'leap') { const r = id === 'leap' ? 140 : 125; warnCircle(c.at[0], c.at[1], r, W, e, rgb); R(c.at[0], c.at[1], r); }
    else if (id === 'breath') { warnLane(e.x, e.y, c.ang, 320, 150, W, e); L(320, 150); }
    else if (id === 'pull' || id === 'spit') { const len = Math.min(620, dist(e.x, e.y, p.x, p.y) + 60); warnLane(e.x, e.y, c.ang, len, id === 'pull' ? 46 : 30, W, e); L(len, id === 'pull' ? 90 : 60); }
    else if (id === 'pool') { warnCircle(c.at[0], c.at[1], 110, W, e, rgb); R(c.at[0], c.at[1], 115); }
    else if (id === 'howl') FX.ring(e.x, e.y - 40, 30, 420, rgb, 0.6, 8);
  }
  function fire(game, e, c) {
    const p = game.player, rgb = rgbOf(e), el = elOf(e), st = ST_OF[el], id = c.id;
    if (!p || p.dead > 0) return;
    if (id === 'spit') orb(game, e, e.x + e.face * 26, e.y - 50, NC.angle(e.x, e.y - 50, p.x, p.y - 50), 640, rgb, 1.25, 20);
    else if (id === 'volley') { const a = NC.angle(e.x, e.y - 50, p.x, p.y - 50); for (const d of [-0.22, 0, 0.22]) orb(game, e, e.x + e.face * 26, e.y - 50, a + d, 560, rgb, 0.8, 16); }
    else if (id === 'lob') {
      const [x, y] = c.at;
      FX.ring(x, y, 20, 130, rgb, 0.4, 10); FX.puff(x, y - 20, 10, { speed: 220, color: rgb });
      if (inEllipse(p.x, p.y, x, y, 125)) hitHero(game, e, 1.5, true, st);
    } else if (id === 'slam') {
      FX.ring(e.x, e.y, 20, 200, rgb, 0.45, 12); game.shake = Math.max(game.shake, 6);
      if (inEllipse(p.x, p.y, e.x, e.y, 190)) hitHero(game, e, 1.6, true, el === 'earth' || el === 'neutral' ? 'stun' : st);
    } else if (id === 'breath') {
      for (let i = 0; i < 8; i++) FX.puff(e.x + Math.cos(c.ang) * (40 + i * 34), e.y - 40 + Math.sin(c.ang) * (i * 20), 2, { speed: 70, size: 0.8, color: rgb });
      if (inLane(p.x, p.y, e.x, e.y, c.ang, 320, 150)) hitHero(game, e, 1.8, true, st);
    } else if (id === 'pool') puddle(game, e, c.at[0], c.at[1], 115, 5, rgb, 0.35, st);
    else if (id === 'blink') {
      const a = (p.aim || 0) + Math.PI + rand(-0.6, 0.6), x = p.x + Math.cos(a) * 90, y = p.y + Math.sin(a) * 60;
      if (!game.world || !game.world.fits || game.world.fits(x, y, e.r || 24)) { FX.puff(e.x, e.y - 30, 8, { speed: 140, color: rgb }); e.x = x; e.y = y; e.sort = y; FX.puff(x, y - 30, 8, { speed: 140, color: rgb }); }
    } else if (id === 'leap') {
      const [x, y] = c.at;
      if (!game.world || !game.world.fits || game.world.fits(x, y, e.r || 24)) { FX.puff(e.x, e.y, 6, { speed: 120, color: '210,200,180' }); e.x = x; e.y = y; e.sort = y; }
      FX.ring(x, y, 20, 150, rgb, 0.4, 10); game.shake = Math.max(game.shake, 5);
      if (inEllipse(p.x, p.y, x, y, 140)) hitHero(game, e, 1.5, true, null);
    } else if (id === 'pull') {
      if (inLane(p.x, p.y, e.x, e.y, c.ang, Math.min(660, dist(e.x, e.y, p.x, p.y) + 80), 90) && !(p.channel && !p.channel.cast)) {
        const a = NC.angle(p.x, p.y, e.x, e.y), d = Math.max(0, Math.min(240, dist(e.x, e.y, p.x, p.y) - 90));
        if (!nearWarp(game, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.62, 260)) // (never onto a warp)
          for (let s = 0; s < 8; s++) NC.tryMove(game.world, p, Math.cos(a) * d / 8, Math.sin(a) * d / 8 * 0.62);
        hitHero(game, e, 0.8, true, null);
      }
    } else if (id === 'harden') { e._msHard = game.time + 3; FX.ring(e.x, e.y - 40, 20, 90, '230,210,160', 0.5, 10); }
    else if (id === 'ward') { e._msWard = game.time + 3; FX.ring(e.x, e.y - 40, 20, 90, '140,190,255', 0.5, 10); }
    else if (id === 'thorns') { e._msThorn = game.time + 3; FX.ring(e.x, e.y - 40, 20, 90, '255,150,120', 0.5, 10); }
    else if (id === 'howl') {
      for (const m of game.enemies) {
        if (m === e || m.dead || m.hp <= 0 || dist(m.x, m.y, e.x, e.y) > 700) continue;
        m.rush = 1.35; m.rushT = game.time + 5; m._provokedT = game.time;
      }
      e.rush = 1.35; e.rushT = game.time + 5;
    }
  }

  // ---------------- every monster's frame ----------------
  const baseUpd = NC.updateEnemy;
  NC.updateEnemy = function (game, e, dt) {
    if (!e || e.dead || e.hp <= 0 || e.kind !== 'enemy' && e.kind !== undefined || e.pvp || e.dummy) return baseUpd.apply(this, arguments);
    const list = skillsOf(e);
    if (!list.length) return baseUpd.apply(this, arguments);
    if (NC.Bal1011 && NC.Bal1011.isCalm(e)) { e._msCast = null; return baseUpd.apply(this, arguments); }
    const c = e._msCast;
    if (c) { // winding up: it stands (knockback still slides it), then the skill goes off
      c.t += dt;
      if (Math.abs(e.kbx || 0) + Math.abs(e.kby || 0) > 1) { NC.tryMove(game.world, e, e.kbx * dt, e.kby * dt); const k = Math.exp(-dt * 9); e.kbx *= k; e.kby *= k; }
      if (e.stun > 0 || e.frozen > 0) { e._msCast = null; return baseUpd.apply(this, arguments); } // (a stun breaks the cast)
      if (c.t >= c.wind) { e._msCast = null; try { fire(game, e, c); } catch (err) { console.warn('monskill', c.id, err); } }
      return;
    }
    const res = baseUpd.apply(this, arguments);
    // (thorns / harden / ward: a ring now and then while it lasts)
    const t = game.time;
    if ((e._msHard > t || e._msWard > t || e._msThorn > t) && (!e._msRingT || t - e._msRingT > 0.45)) {
      e._msRingT = t; FX.ring(e.x, e.y - 40, 50, 70, e._msHard > t ? '230,210,160' : e._msWard > t ? '140,190,255' : '255,150,120', 0.4, 6);
    }
    const p = game.player;
    if (!p || p.dead > 0 || e.state === 'idle' || e.state === 'return' || e.state === 'rest' || e.stun > 0 || e.frozen > 0) return res;
    if ((e._msNext || 0) > t) return res;
    e._msNext = t + 0.5; // (a look twice a second)
    const d = dist(e.x, e.y, p.x, p.y);
    for (const id of list) {
      const S = SK[id];
      if (!S.wind || (e._msCd && e._msCd[id] > t) || d > S.range || d < (S.min || 0)) continue;
      if (Math.random() > 0.45) continue;
      begin(game, e, id);
      break;
    }
    return res;
  };

  // ---------------- what the hero's hits meet ----------------
  const baseHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const g = G(), t = g ? g.time : 0, magic = !!(o && o.kind === 'magic');
    const L = e ? skillsOf(e) : [], pl = g && g.player, close = !!(pl && e && dist(e.x, e.y, pl.x, pl.y) < 240);
    if (e && !magic && (L.includes('evade') || (L.includes('skittish') && close)) && !(o && o.crit) && (e._msEvT || 0) < t) {
      const ch = L.includes('skittish') && close ? 0.45 : Math.max(0.1, Math.min(0.4, 0.4 - ((d.hit || 0) - (e.flee || 0)) / 500));
      if (Math.random() < ch) {
        e._msEvT = t + 0.6;
        const p = g && g.player, a = p ? NC.angle(p.x, p.y, e.x, e.y) : 0;
        e.kbx = (e.kbx || 0) + Math.cos(a) * 520; e.kby = (e.kby || 0) + Math.sin(a) * 320;
        FX.num(e.x, (NC.labelTop ? NC.labelTop(e) : e.y - 120) - 20, 'หลบ!', { fill: '#cfe8ff', size: 26 });
        return { dmg: 0, miss: true, crit: false, mod: 1 };
      }
    }
    const r = baseHit.apply(this, arguments);
    if (!e || !r || !(r.dmg > 0)) return r;
    if (!magic && e._msHard > t) { r.dmg = Math.max(1, Math.round(r.dmg * 0.3)); r.blocked = true; }
    if (magic && e._msWard > t) { r.dmg = Math.max(1, Math.round(r.dmg * 0.3)); r.blocked = true; }
    if (!magic && e._msThorn > t && g && g.player && d === g.player.d && dist(e.x, e.y, g.player.x, g.player.y) < 220) {
      const p = g.player, back = Math.max(1, Math.min(Math.round(r.dmg * 0.25), Math.round(p.maxHp * 0.05)));
      if (p.hp > 1) { p.hp = Math.max(1, p.hp - back); FX.num(p.x, p.y - 160, back, { fill: '#ff9b78', size: 30 }); }
    }
    return r;
  };

  // ---------------- each map: which play fits it ----------------
  const FIT = { melee: 'สายประชิด', ranged: 'สายยิงไกล', magic: 'สายเวท', area: 'สายกวาดฝูง' };
  const fitCache = {};
  function fit(mapId) {
    if (mapId in fitCache) return fitCache[mapId];
    const M = NC.MAPS && NC.MAPS[mapId], R = NC.ROSTER && NC.ROSTER[mapId];
    if (!M || !R) return (fitCache[mapId] = null);
    let hi = 0; for (const t in M.lv || {}) { const v = M.lv[t]; hi = Math.max(hi, Array.isArray(v) ? v[1] || v[0] : v); }
    if (hi < LV1) return (fitCache[mapId] = null);
    const w = {}; let n = 0;
    for (const z in R) for (const slot in R[z]) for (const [t, k] of R[z][slot]) { w[t] = (w[t] || 0) + k; n += k; }
    const f = { physRes: 0, magRes: 0, evasive: 0, antiMelee: 0, antiRanged: 0, packs: 0 }, skills = {};
    for (const t in w) {
      const S = SPEC()[t] || NC.MONSTERS[t] || {}, k = w[t] / n, L = ofOn(t, hi, mapId);
      for (const id of L) skills[id] = (skills[id] || 0) + k;
      f.physRes += k * ((S.defK || 1) - 1) + (L.includes('harden') ? k : 0);
      f.magRes += k * ((S.mdefK || 1) - 1) + (L.includes('ward') ? k : 0);
      f.evasive += k * ((S.agiK || 1) - 1) + (L.includes('evade') ? k : 0);
      f.antiMelee += (['slam', 'breath', 'thorns', 'pool'].filter((x) => L.includes(x)).length) * k + (S.kind === 'bomber' ? k * 0.5 : 0);
      f.antiRanged += (['blink', 'leap', 'pull', 'spit', 'volley', 'lob'].filter((x) => L.includes(x)).length) * k + (S.kind === 'ranged' ? k * 0.5 : 0);
      f.packs += (L.includes('howl') ? k : 0) + (['summoner', 'leader', 'splitter'].includes(S.kind) ? k : 0);
    }
    const score = {
      magic: 2 * f.physRes + f.evasive + f.antiMelee * 0.6 - 2 * f.magRes,
      ranged: f.antiMelee * 1.2 + f.magRes + f.evasive * 0.4 - f.antiRanged * 1.2 - f.physRes * 0.8,
      melee: f.antiRanged * 1.2 + f.magRes * 1.2 - f.antiMelee * 1.1 - f.physRes - f.evasive * 0.6,
      area: f.packs * 2.2 + (Object.keys(w).length >= 5 ? 0.3 : 0),
    };
    // (a map with a style says that one; one without (a new map) is worked out from its monsters)
    const top = STYLE[mapId] ? [STYLE[mapId]] : Object.keys(score).sort((a, b) => score[b] - score[a]).slice(0, 1);
    const watch = Object.keys(skills).sort((a, b) => skills[b] - skills[a]).slice(0, 3).map((id) => SK[id].th);
    return (fitCache[mapId] = { best: top, th: top.map((k) => FIT[k]), watch, score, f });
  }
  // arriving on a map: what fits it
  let lastMap = null;
  const baseUpdP = NC.updatePlayer;
  NC.updatePlayer = function (game) {
    if (game.mapId !== lastMap) {
      lastMap = game.mapId;
      const F = fit(game.mapId), M = NC.MAPS && NC.MAPS[game.mapId];
      if (F) setTimeout(() => { if (NC.HUD && NC.HUD.log) NC.HUD.log(`${M && M.name ? M.name + ' · ' : ''}เหมาะกับ ${F.th.join(' / ')} · ระวัง ${F.watch.join(' ')}`, 'level'); }, 1200);
    }
    return baseUpdP.apply(this, arguments);
  };

  NC.MonSkills = { SK, of, ofOn, fit, FIT, STYLE, escape, LV1, LV2 };
})();
