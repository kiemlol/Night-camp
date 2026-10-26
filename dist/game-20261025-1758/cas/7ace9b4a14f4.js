/* jobs3_archmage.js — the archmage reworked (the plan "อาชีพใหม่ Night Camp", the user's go-ahead 2026-09-28):
   the fire line (เสาเพลิง ทะเลเพลิง ปรมาจารย์เพลิง) went to the Fire Mage and the ice line (พายุหิมะ หอกธารน้ำแข็ง
   ศูนย์สัมบูรณ์) to the Ice Mage (jobs3_skills_a.js). The archmage keeps lightning (พายุอสนี) and his auto line
   (เวทรัวหลอมธาตุ) and gets the mixing mage's own line:
     ผสานธาตุ   two different elements cast within 2 s (a spell by hand, an autospell, a double cast) set off a fusion
               spell of that pair, free:
                 ไฟ + น้ำแข็ง ไอน้ำระเบิด · ไฟ + ลม พายุเพลิง · น้ำแข็ง + ลม ฟ้าผ่าเยือกแข็ง
                 ไฟ + ดิน ลาวาพุ่ง · น้ำแข็ง + ดิน ธารน้ำแข็งถล่ม · ลม + ดิน พายุทราย
               (the mage has no earth spell: ลูกแก้วสองธาตุ brings the earth, paired with the last element cast)
     มหาเวทสามธาตุ  the ultimate: every spell counts as two elements, a fusion every cast
   Points in the moved skills come back by themselves (they're no longer the job's; NC.skillLeft counts the job's own).
   Every elemental RUN is wrapped here to tell the fusion which element went off. Loaded after jobs3_skills_a.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, SK = NC.SKILLS;
  const { C, P, TAU } = K;
  const rand = NC.rand, S = K.S, alive = K.alive;
  const lvOf = (p, id) => NC.skillLv(p, id);
  const pct = (k) => Math.round(k * 100);
  const isAM = (p) => !!p && NC.isJob(p, 'archmage');
  const ELS = ['fire', 'water', 'wind', 'earth'];
  const EL_RGB = { fire: '255,140,60', water: '150,215,255', wind: '255,236,120', earth: '205,160,110' };
  const EL_TH = { fire: 'ไฟ', water: 'น้ำแข็ง', wind: 'ลม', earth: 'ดิน' };
  const STATUS = { fire: 'burn', water: 'chill', wind: 'shock', earth: 'crack' };
  const MOVED = ['am_firepillar', 'am_inferno', 'am_infernomastery', 'am_blizzard', 'am_glacial', 'am_absolutezero'];

  NC.JOBS.archmage.desc = 'จอมเวทสายผสม สายฟ้าเป็นธาตุหลัก ร่ายสองธาตุต่างกันติดกันปลดเวทผสม 6 แบบ ปฏิกิริยาธาตุแรงที่สุดในเกม · เลนคทาเวทผสมหมู่ · เลนออร์บตีปกติรัว เวทคู่';

  // ---------------- the fusions ----------------
  const key = (a, b) => [a, b].sort().join('+');
  const FUSION = {
    'fire+water': { name: 'ไอน้ำระเบิด', rgb: '235,245,255' },
    'fire+wind': { name: 'พายุเพลิง', rgb: '255,150,70' },
    'water+wind': { name: 'ฟ้าผ่าเยือกแข็ง', rgb: '170,230,255' },
    'earth+fire': { name: 'ลาวาพุ่ง', rgb: '255,110,50' },
    'earth+water': { name: 'ธารน้ำแข็งถล่ม', rgb: '180,225,255' },
    'earth+wind': { name: 'พายุทราย', rgb: '225,200,140' },
  };
  const FU = { last: null, lastT: -9, icd: 0, pair: null };
  NC.fusionState = FU;
  // one hit of a fusion: ATK of ทอเวทสองธาตุ's level x share k, in that element; ปฏิกิริยาลูกโซ่ Lv 5 sets up a reaction first
  const SETUP = { wind: 'chill' }; // (wind on a chilled one: the cold current)
  function fhit(game, p, e, el, k, o) {
    if (!alive(e)) return null;
    o = o || {};
    if (lvOf(p, 'am_chainreact') >= 5 && k >= 0.2 && SETUP[el] && !(e.reactT > game.time)) NC.addStatus(game, e, SETUP[el]);
    const r = K.hit(game, p, 'am_weave', e, o.kx || 0, o.ky || 0, EL_RGB[el], k, { element: el });
    if (r && !r.miss && o.st) for (const s of o.st) NC.addStatus(game, e, s);
    return r;
  }
  const near = (game, x, y, r) => K.around(game, x, y, r);
  function fusion(game, p, pair, at, k) {
    const f = FUSION[key(pair[0], pair[1])];
    if (!f) return;
    FU.pair = pair; FU.at = at;
    const [x, y] = at;
    FX.text(x, y - 230, f.name + '!', `rgb(${f.rgb})`, 34);
    V.ring(x, y, 20, 150, 8, EL_RGB[pair[0]], 0.35);
    V.ring(x, y, 30, 190, 8, EL_RGB[pair[1]], 0.4);
    const kk = k || 1, K2 = key(pair[0], pair[1]);
    if (K2 === 'fire+water') { // steam: one big white burst that throws them back
      V.at(0.08, () => {
        K.burst(game, x, y, 220, f.rgb, { smoke: ['#eef6ff', '#ffffff'], flash: '235,245,255', shake: 7, stars: 6 });
        V.smoke(x, y - 30, 16, '#eef6ff', '#ffffff', { size: 1.6, max: 320, lifeK: 1.1, a: 0.9 });
        for (const e of near(game, x, y, 220)) { const a = NC.angle(x, y, e.x, e.y); fhit(game, p, e, Math.random() < 0.5 ? 'fire' : 'water', 1.0 * kk, { kx: Math.cos(a) * 420, ky: Math.sin(a) * 300 }); }
      });
    } else if (K2 === 'fire+wind') { // a fire tornado walking onto the spot, pulling them in
      const z = { x: x - 120, y }, col = NC.ArcaneFX && NC.ArcaneFX.tornado && NC.ArcaneFX.tornado(z, 2.4); // (the Blender fire-tornado column, arcanefx.js)
      let acc = 0, t = 0;
      FX.add({ type: 'timer', layer: 'none', life: 2.4, x, y, update(q, dt) {
        t += dt; z.x += Math.min(160 * dt, Math.max(0, x - z.x));
        for (let i = 0; i < 5; i++) {
          const h = rand(0, 260), rr = 30 + h * 0.35, a = t * 9 + h * 0.05 + i;
          if (Math.random() < dt * (col ? 8 : 30)) V.flameAt(z.x + Math.cos(a) * rr, z.y - h + Math.sin(a) * rr * 0.3, 20 + h * 0.08, 34 + h * 0.1, P.fire, 0.3, { vy: -80 });
        }
        if (Math.random() < dt * 20) FX.add({ type: 'vstreak', x: z.x + rand(-80, 80), y: z.y - rand(20, 240), vx: rand(-300, 300), vy: -100, len: rand(30, 60), w: 3, rgb: '255,200,140', life: 0.25 });
        for (const e of near(game, z.x, z.y, 200)) K.pull(e, z.x, z.y, 900 * dt);
        if ((acc += dt) >= 0.35) { acc -= 0.35; for (const e of near(game, z.x, z.y, 150)) fhit(game, p, e, Math.random() < 0.6 ? 'fire' : 'wind', 0.2 * kk, { st: ['burn'] }); }
      } });
      V.light(x, y - 80, 480, '255,150,70', 0.9, 2.4, { flick: true });
    } else if (K2 === 'water+wind') { // frozen lightning: five pale bolts from the sky
      const got = near(game, x, y, 260);
      for (let i = 0; i < 5; i++) V.at(0.05 + i * 0.09, () => {
        const e = got.length ? got[i % got.length] : null, tx = e ? e.x : x + rand(-120, 120), ty = e ? e.y : y + rand(-60, 60);
        V.boltAt(tx + rand(-60, 60), ty - 640, tx, ty - 40, f.rgb, 0.3, { w: 7, jag: 30, seg: 10 });
        V.spikeAt(tx, ty, 26, 70, P.ice, 0.8, { glowA: 0.4, rgb: f.rgb, rise: 0.06, sink: true });
        V.glowAt(tx, ty - 40, 20, 140, f.rgb, 0.9, 0.3, { hot: true });
        V.shake(game, 3);
        if (e) fhit(game, p, e, i % 2 ? 'water' : 'wind', 0.25 * kk, { st: ['chill'] });
      });
    } else if (K2 === 'earth+fire') { // lava bursting up under them, three times
      for (let i = 0; i < 3; i++) V.at(0.1 + i * 0.3, () => {
        V.decal(x, y, 120, 'crack', 3);
        for (let j = 0; j < 8; j++) V.flameAt(x + rand(-40, 40), y + rand(-10, 10), rand(40, 60), rand(140, 220), P.fire, rand(0.4, 0.6), { vy: -160 });
        V.debris(x, y - 20, 10, P.rock, { size: 0.9, max: 520, layer: 'glow' });
        V.glowAt(x, y - 60, 30, 170, '255,110,50', 0.9, 0.35, { hot: true });
        V.shake(game, 4);
        for (const e of near(game, x, y, 140)) fhit(game, p, e, i === 1 ? 'earth' : 'fire', 0.4 * kk, { ky: -160, st: ['burn', 'crack'] });
      });
      V.decal(x, y, 150, 'scorch', 4);
    } else if (K2 === 'earth+water') { // a slab of glacier drops on the spot
      const t0 = 0.35, sx = x + 80, sy = y - 760;
      K.proj({ x: sx, y: sy, vx: (x - sx) / t0, vy: (y - 30 - sy) / t0, life: t0,
        draw(ctx, q) {
          if (NC.ArcaneFX && NC.ArcaneFX.slab && NC.ArcaneFX.slab(ctx, q)) return V.glow(ctx, q.x, q.y, 120, f.rgb, 0.5, true); // (the Blender ice block, arcanefx.js)
          ctx.save(); ctx.translate(q.x, q.y);
          ctx.beginPath(); ctx.moveTo(-70, -40); ctx.lineTo(-20, -90); ctx.lineTo(60, -70); ctx.lineTo(80, 10); ctx.lineTo(10, 60); ctx.lineTo(-60, 30); ctx.closePath();
          ctx.fillStyle = 'rgba(190,230,255,0.92)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#2a2d4a'; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-40, -40); ctx.lineTo(-10, -70); ctx.lineTo(40, -56); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.stroke();
          ctx.restore();
          V.glow(ctx, q.x, q.y, 120, f.rgb, 0.5, true);
        },
        onEnd() {
          K.burst(game, x, y, 200, f.rgb, { decal: 'frost', shake: 9, stars: 8 });
          V.debris(x, y - 30, 18, P.ice, { size: 1.1, max: 560, layer: 'glow' });
          K.spikes(x, y, 7, 130, P.ice, f.rgb, { k: 1.2 });
          for (const e of near(game, x, y, 200)) { fhit(game, p, e, 'water', 1.1 * kk, { st: ['crack'] }); NC.statusEnemy(game, e, 'freeze', 1.2); }
        } });
    } else if (K2 === 'earth+wind') { // a sandstorm: they can't see (weaker hits), their armour cracks
      K.zone(game, p, 'am_weave', x, y, 240, 3, 0.5, { rgb: f.rgb, style: 'arcane', circle: true, hits: false,
        each(e) { fhit(game, p, e, Math.random() < 0.5 ? 'earth' : 'wind', 0.2 * kk, { st: ['crack'] }); K.weak(game, e, 0.85, 1); },
        tick(z, dt) {
          for (let i = 0; i < 3; i++) if (Math.random() < dt * 30) V.smoke(x + rand(-230, 230), y + rand(-90, 60), 1, '#c9a870', '#f0dcae', { size: 1.2, lifeK: 0.7, vx: rand(200, 420), a: 0.75 });
          if (Math.random() < dt * 30) FX.add({ type: 'vstreak', x: x + rand(-260, 200), y: y - rand(10, 200), vx: 700, vy: 60, len: rand(40, 90), w: 3, rgb: '240,220,170', life: 0.3 });
        } });
    }
  }
  NC.castFusion = fusion;
  NC.ArchmageLooks = { fusion, orbs: orbsLook, rgb: EL_RGB }; // (js/online-archmage.js draws the server's with them)

  // which element a spell went off with (the mage's ultimate: its form's)
  function elOf(p, id) {
    const S = SK[id];
    if (!S) return null;
    if (id === 'meteor' && S.form) return { fire: 'fire', ice: 'water', storm: 'wind' }[S.form(p)] || 'fire';
    return ELS.includes(S.element) ? S.element : null;
  }
  // where a spell was aimed: the monster nearest the mouse, else the nearest in front, else the spot
  function aimOf(game, p) {
    const G = NC.game, m = game && game.mouse, pt = m && m.active ? [m.wx, m.wy] : [p.x + Math.cos(p.aim) * 300, p.y + Math.sin(p.aim) * 200];
    const e = K.nearest(G, pt[0], pt[1], 320, 1)[0] || K.nearest(G, p.x, p.y, 650, 1, p.aim, 0.9)[0];
    return e ? [e.x, e.y] : pt;
  }
  // an element went off: pair it with the last one (or with itself twice during มหาเวทสามธาตุ)
  function onElements(game, p, els, at) {
    if (!isAM(p) || !els.length || (game && game.presentationOnly)) return; // (online the server pairs them: backend/job_archmage.go)
    const lv = lvOf(p, 'am_weave');
    if (!lv) return;
    const G = NC.game, win = lv >= 5 ? 3 : 2, trin = p.amTrinity > G.time;
    let pair = null;
    if (els.length > 1 && els[0] !== els[1]) pair = [els[0], els[1]];
    else if (trin) pair = [els[0], ELS.filter((e) => e !== els[0])[Math.floor(G.time * 3) % 3]];
    else if (FU.last && FU.last !== els[0] && G.time - FU.lastT <= win) pair = [FU.last, els[0]];
    FU.last = els[els.length - 1]; FU.lastT = G.time;
    if (!pair || G.time < FU.icd) return;
    FU.icd = G.time + (trin ? 0.5 : 1.5);
    FU.last = null; // (the pair is used up)
    fusion(G, p, pair, at, 1);
    if (lv >= 10) V.at(0.5, () => fusion(G, p, pair, [at[0] + rand(-40, 40), at[1] + rand(-30, 30)], 0.5));
  }
  NC.fusionElements = onElements;

  // every elemental spell's moves tell the fusion (by hand, an autospell, a double cast: all run through RUN)
  for (const id of Object.keys(RUN)) {
    const Sk = SK[id];
    if (!Sk || !(id === 'meteor' || ELS.includes(Sk.element))) continue;
    if (/^(fm_|im_|sm_)/.test(id)) continue; // (the new jobs' own: never the archmage's)
    const base = RUN[id];
    RUN[id] = function (game, p) {
      const out = base.apply(this, arguments);
      try {
        if (p && p.remote) { const el = elOf(p, id); if (el) { if (p.amEl && p.amEl !== el) p.amPair = [p.amEl, el]; p.amEl = el; } } // (another player's, replayed by net.js: only remembered for their จำเวทผสม)
        else if (isAM(p)) { const el = elOf(p, id); if (el) onElements(game, p, [el], aimOf(game, p)); }
      } catch (err) { console.warn('fusion', id, err); }
      return out;
    };
  }

  // ---------------- the skills ----------------
  K.def({
    am_weave: S({ name: 'ทอเวทสองธาตุ', icon: 'sk_am_weave', type: 'magic', mul: (lv) => 0.3 + lv * 0.04, pass: () => ({}),
      desc: (lv) => `ร่ายสกิลสองธาตุต่างกันติดกันภายใน ${lv >= 5 ? 3 : 2} วิ ได้เวทผสมออกเองฟรี แรง ${pct(0.3 + lv * 0.04)}% ของ MATK · ไฟ+น้ำแข็ง ไอน้ำระเบิด · ไฟ+ลม พายุเพลิง · น้ำแข็ง+ลม ฟ้าผ่าเยือกแข็ง · ไฟ+ดิน ลาวาพุ่ง · น้ำแข็ง+ดิน ธารน้ำแข็งถล่ม · ลม+ดิน พายุทราย (ได้ทุก 1.5 วิ)${lv >= 10 ? ' · เวทผสมออก 2 ครั้ง' : ''}` }),
    am_orbs: S({ name: 'ลูกแก้วสองธาตุ', icon: 'sk_am_orbs', type: 'magic', castT: 0.5, cd: 6, sp: (lv) => 20 + lv, mul: (lv) => 0.07 + lv * 0.01,
      desc: (lv, m) => `ลูกแก้วธาตุของเวทล่าสุดคู่กับลูกแก้วดิน หมุนวนรอบเป้า ${lv >= 5 ? 5 : 4} วิ ทุกครึ่งวิ ${m}% ของ MATK ติดสถานะทั้งสองธาตุ · นับเป็นสองธาตุ: ปลดเวทผสมของคู่นั้นทันที${lv >= 10 ? ' · ลูกแก้ว 2 คู่' : ''}` }),
    am_recall: S({ name: 'จำเวทผสม', icon: 'sk_am_recall', type: 'magic', castT: 0.3, cd: 10, sp: (lv) => 24 + lv, mul: () => 0,
      need: () => (FU.pair ? true : 'ยังไม่มีเวทผสมให้จำ'),
      desc: (lv) => `ปล่อยเวทผสมล่าสุด${FU.pair ? ` (${FUSION[key(FU.pair[0], FU.pair[1])].name})` : ''}ซ้ำที่เป้าทันที แรงขึ้น ${30 + lv * 3}%` }),
    am_chainreact: S({ name: 'ปฏิกิริยาลูกโซ่', icon: 'sk_am_chainreact', max: 5, pass: () => ({ react: 15 }),
      desc: (lv) => `ปฏิกิริยาธาตุแรงขึ้น 15%${lv >= 3 ? ' · ปฏิกิริยาแพร่ไปตัวข้าง ๆ 3 ตัว (35%)' : ''}${lv >= 5 ? ' · เวทผสมเกิดปฏิกิริยาได้ทุกครั้ง' : ''}` }),
    am_trinity: S({ name: 'มหาเวทสามธาตุ', icon: 'sk_am_trinity', ult: true, max: 5, type: 'magic', castT: 1.2, cd: 90, sp: (lv) => 80 + lv * 4, mul: (lv) => 0.4 + lv * 0.08,
      desc: (lv, m) => `ไฟ น้ำแข็ง สายฟ้าหมุนรอบตัว 6 วิ ทุกสกิลที่ร่ายนับเป็นสองธาตุ ปลดเวทผสมทุกครั้ง · ลูกแก้วธาตุยิงศัตรูใกล้สุดทุก 0.6 วิ ${m}% ของ MATK` }),
  });

  RUN.am_orbs = function (game, p, lv) {
    K.pose(game, p, K.clip(p, 'bolt', 0), 0.3);
    if (game.presentationOnly || !isAM(p)) return; // (online the server picks the pair and sends the orbs: js/online-archmage.js)
    const e0 = K.target(game, p, 650, 280);
    const a = FU.last && FU.last !== 'earth' ? FU.last : ['fire', 'water', 'wind'][Math.floor(game.time) % 3], pair = [a, 'earth'];
    const dur = lv >= 5 ? 5 : 4, sets = lv >= 10 ? 2 : 1, spot = e0 ? { x: e0.x, y: e0.y } : (() => { const g = K.ground(game, p, 420); return { x: g[0], y: g[1] }; })();
    orbsLook(game, p, e0, spot, pair, sets, dur, true);
    onElements(game, p, pair, [spot.x, spot.y]);
  };
  // the pair's orbs round e0 (while it lives; else where they are) for dur; every half second one of them (the earth
  // first) strikes what is within 110, or with strike off only rings
  function orbsLook(game, p, e0, spot, pair, sets, dur, strike) {
    let acc = 0, n = 0;
    FX.add({ type: 'j3orbs', layer: 'glow', life: dur, x: spot.x, y: spot.y, pair, sets,
      update(q, dt) {
        if (e0 && alive(e0)) { q.x = e0.x; q.y = e0.y; }
        if ((acc += dt) >= 0.5) {
          acc -= 0.5; n++;
          const el = pair[n % 2];
          if (strike) for (const e of K.around(game, q.x, q.y, 110)) {
            const r = K.hit(game, p, 'am_orbs', e, 0, 0, EL_RGB[el], sets, { element: el });
            if (r && !r.miss) NC.addStatus(game, e, STATUS[el]);
          }
          V.ring(q.x, q.y, 10, 110, 6, EL_RGB[el], 0.25);
        }
      } });
    FX.text(spot.x, spot.y - 200, `ลูกแก้ว${EL_TH[pair[0]]} + ดิน`, `rgb(${EL_RGB[pair[0]]})`, 28);
  }
  FX.def('j3orbs', (ctx, q, u) => {
    const a = Math.min(1, q.t / 0.15) * (u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1);
    ctx.save(); ctx.globalAlpha *= a;
    // the orbit: a faint ring of both colours
    ctx.save(); ctx.translate(q.x, q.y - 60); ctx.scale(1, 30 / 80); ctx.lineWidth = 5;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${EL_RGB[q.pair[0]]},0.35)`; ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI); ctx.stroke();
    ctx.strokeStyle = `rgba(${EL_RGB[q.pair[1]]},0.35)`; ctx.beginPath(); ctx.arc(0, 0, 80, Math.PI, TAU); ctx.stroke();
    ctx.restore();
    for (let s = 0; s < q.sets; s++) for (let i = 0; i < 2; i++) {
      const ang = q.t * 4 + i * Math.PI + s * Math.PI / 2, x = q.x + Math.cos(ang) * 80, y = q.y - 60 + Math.sin(ang) * 30;
      K.drawOrb(ctx, x, y, 19, EL_RGB[q.pair[i]], i ? '#fff0d0' : '#ffffff');
    }
    ctx.restore();
  });
  RUN.am_recall = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.3);
    // (another player's recall replayed here, js/net.js: their last fusion isn't sent, so the pair of their last two
    // elements stands in, and my own last fusion stays mine)
    const keep = p.remote && { pair: FU.pair, at: FU.at }, pair = p.remote ? p.amPair || ['fire', 'water'] : FU.pair;
    if (pair) fusion(game, p, pair, aimOf(game, p), 1.3 + lv * 0.03); // (k runs into every hit of the fusion, the timed ones too)
    if (keep) { FU.pair = keep.pair; FU.at = keep.at; }
    V.circle(p.x, p.y, 100, '200,190,255', 0.5, { style: 'arcane', spin: 3, grow: true });
  };
  RUN.am_trinity = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.5);
    p.amTrinity = game.time + 6;
    V.flash('235,225,255', 0.12, 0.3);
    FX.text(p.x, p.y - 210, 'มหาเวทสามธาตุ!', '#e8dcff', 36);
    K.buffFx(game, p, '220,200,255', { style: 'arcane', r: 200 });
    if (game.presentationOnly || !isAM(p)) return; // (online the server shoots; its ring and orbs: js/online-archmage.js)
    let acc = 0, n = 0;
    FX.add({ type: 'j3trinity', layer: 'glow', life: 6, x: p.x, y: p.y,
      update(q, dt) {
        q.x = p.x; q.y = p.y;
        if ((acc += dt) >= 0.6) {
          acc -= 0.6; n++;
          const el = ['fire', 'water', 'wind'][n % 3], e = K.nearest(game, p.x, p.y, 600, 1)[0];
          if (!e) return;
          const ang = game.time * 3 + (n % 3) * (TAU / 3), from = [p.x + Math.cos(ang) * 90, p.y - 100 + Math.sin(ang) * 34];
          K.shot(game, p, 'am_trinity', { from, ang: NC.angle(from[0], from[1], e.x, e.y - 45), v: 1100, range: 700, r: 30, home: 12, target: e, rgb: EL_RGB[el], size: 0.8,
            hit(f) { const r = K.hit(game, p, 'am_trinity', f, 0, 0, EL_RGB[el], 1, { element: el }); if (r && !r.miss) NC.addStatus(game, f, STATUS[el]); V.sparks(f.x, f.y - 50, 6, EL_RGB[el], { size: 0.7 }); } });
        }
      } });
    V.light(p.x, p.y - 80, 520, '220,200,255', 0.8, 6, { follow: p });
  };
  FX.def('j3trinity', (ctx, q) => {
    const G = NC.game, t = G ? G.time : 0;
    ['fire', 'water', 'wind'].forEach((el, i) => {
      const ang = t * 3 + i * (TAU / 3), x = q.x + Math.cos(ang) * 90, y = q.y - 100 + Math.sin(ang) * 34;
      K.drawOrb(ctx, x, y, 15, EL_RGB[el]);
    });
  });

  // ---------------- ปฏิกิริยาลูกโซ่ Lv 3: a reaction spreads to three neighbours at half ----------------
  const baseHH = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const was = e && e.reactT;
    const r = baseHH.apply(this, arguments), G = NC.game, p = G && G.player;
    if (!p || d !== p.d || !isAM(p) || !(r.dmg > 0) || !e || e.reactT === was || !(e.reactT > G.time)) return r;
    if (lvOf(p, 'am_chainreact') < 3) return r;
    const dmg = Math.max(1, Math.round(r.dmg * 0.35)), rgb = '230,210,255';
    for (const f of G.enemies.filter((x) => x !== e && alive(x) && NC.dist(x.x, x.y, e.x, e.y) < 200).slice(0, 3)) V.at(0.05, () => {
      if (!alive(f)) return;
      FX.add({ type: 'cutline', x: e.x, y: e.y - 50, x1: f.x, y1: f.y - 50, w: 6, color: rgb, life: 0.25 });
      NC.damageEnemy(G, f, { dmg, mod: 1 }, 0, 0, { color: rgb });
    });
    return r;
  };

  // ---------------- lines, the skill list, needs ----------------
  const LINES = [['storm', 'พายุอสนี', 'wind', 'storm', 0], ['fusion', 'ผสานธาตุ', 'multi', null, 0], ['quick', 'เวทรัวหลอมธาตุ', 'multi', 'quick', 1], ['trinity', 'มหาเวทสามธาตุ', 'multi', null, 0]];
  const PLAN = [
    ['am_chain', 'storm', 10, 0, [['thunder', 5]], 'Lv5 กระโดดกลับตัวเดิมได้ · Lv10 แยกเป็น 2 สาย'],
    ['am_lordthunder', 'storm', 10, 0, [['am_chain', 5]], 'Lv5 ฟ้าผ่าถี่ขึ้น · Lv10 เมฆพายุตามตัวเราไปด้วย'],
    ['am_overcharge', 'storm', 5, 0, [['mg_stormheart', 10]], 'Lv1 ช็อตแพร่ไปตัวข้าง ๆ · Lv3 ทุกครั้งที่ 4 ของสกิลสายฟ้าได้ฟ้าผ่าใหญ่ฟรี · Lv5 ร่างเป็นประจุไฟฟ้า'],
    ['am_weave', 'fusion', 10, 1, [], 'Lv5 ร่ายห่างกันได้ 3 วิ · Lv10 เวทผสมออก 2 ครั้ง'],
    ['am_orbs', 'fusion', 10, 0, [['am_weave', 3]], 'Lv5 หมุนนาน 5 วิ · Lv10 ลูกแก้ว 2 คู่'],
    ['am_recall', 'fusion', 10, 0, [['am_weave', 5]], 'แรงขึ้นทุกเลเวล'],
    ['am_chainreact', 'fusion', 5, 0, [['am_weave', 5]], 'Lv1 ปฏิกิริยาแรงขึ้น 15% · Lv3 ปฏิกิริยาแพร่ไปตัวข้าง ๆ ครึ่งผล · Lv5 เวทผสมเกิดปฏิกิริยาได้ทุกครั้ง'],
    ['am_doublecast', 'quick', 10, 0, [['mg_autospell', 5]], 'Lv5 ครั้งที่สองเป็นอีกธาตุ (ปลดเวทผสมได้) · Lv10 ทุก 10 ครั้งปล่อยพายุธาตุเล็ก'],
    ['am_arcaneflux', 'quick', 10, 0, [['mg_staffmastery', 5]], 'Lv5 เวลาร่ายลดลง 20% ระหว่างบัฟ · Lv10 วงเวทหมุนรอบตัว ยิงลูกแก้วเพิ่มเอง'],
    ['am_convergence', 'quick', 5, 0, [], 'Lv1 ร่ายธาตุต่างจากครั้งก่อน ดาเมจ +8% ซ้อน 3 ชั้น · Lv3 ปฏิกิริยาธาตุแรงขึ้น 50% · Lv5 ปฏิกิริยาธาตุทุกครั้งคืน SP'],
    ['am_trinity', 'trinity', 5, 0, ['|', ['am_recall', 5], ['am_chainreact', 3]], 'ทุกสกิลที่ร่ายนับเป็นสองธาตุ'],
  ];
  const J = NC.JOBS.archmage;
  J.lines = LINES.map(([id, name, el, parent, auto]) => ({ id, name, el, parent: parent || null, auto: !!auto }));
  J.skills = PLAN.map((r) => r[0]);
  for (const [id, line, max, free, req, grow] of PLAN) {
    const Sk = SK[id];
    if (!Sk) { console.warn('archmage: no skill', id); continue; }
    Sk.line = line; Sk.max = max; Sk.free = free; Sk.grow = grow;
    const any = req[0] === '|';
    Sk.req = any ? req.slice(1) : req;
    Sk.reqAny = any;
  }

  // ---------------- the skill window's words ----------------
  // ประกายเวท now goes with the orb (weapons.js)
  const d0 = SK.am_arcaneflux.desc;
  SK.am_arcaneflux.desc = function () { return d0.apply(this, arguments).replace('ถือคทา', 'ถือออร์บ'); };

  // ---------------- an old archmage save: the moved skills' points come back, their hotbar slots empty ----------------
  (NC.loadHooks || (NC.loadHooks = [])).push((game, params) => {
    const p = game.player;
    if (!isAM(p) || !p.skills) return;
    // (the hero record drops skills the job no longer has before this runs: count them from the save itself)
    let s = null;
    if (!NC.ONLINE) { try { s = JSON.parse(localStorage.getItem('nightcamp.save.v1') || 'null'); } catch (e) { s = null; } }
    let back = 0;
    for (const id of MOVED) {
      back += Math.max(p.skills[id] || 0, (s && s.job === 'archmage' && s.skills && s.skills[id]) || 0);
      delete p.skills[id];
    }
    if (p.hotbar) for (const k in p.hotbar) if (MOVED.includes(p.hotbar[k])) p.hotbar[k] = null;
    if (back && NC.HUD && NC.HUD.log) V.at(0.5, () => NC.HUD.log(`อาร์คเมจปรับใหม่: สายไฟกับสายน้ำแข็งย้ายไปอยู่จอมเวทไฟ / จอมเวทน้ำแข็ง ได้แต้มสกิลคืน ${back} แต้ม · สายใหม่ "ผสานธาตุ" (กด K)`, 'level'));
  });
})();
