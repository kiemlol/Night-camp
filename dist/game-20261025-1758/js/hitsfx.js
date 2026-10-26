/* hitsfx.js — the layered hit sounds in the game (2026-10-19; the user picked the ElevenLabs takes on the pick page:
   "เอาทั้งหมดที่คุณเลือกนั้นแหละ"). The takes are files (assets/sfx/, listed in js/sfx_list.js by tools/sfx_process.py);
   js/sfxlayers.js (NC.SFXL) plans which layers stack on a blow; this file plays them on js/sfx.js's AudioContext, at its
   เสียงเอฟเฟกต์ volume:
     swing   the hero's weapon starting to move (each new combo step, seen in NC.updatePlayer): the whoosh, the bow's
             release, the gun's shot (SFXL.swing)
     hit     a blow landing on a monster (js/hitfeel.js's sound piece calls NC.HitSfx.hit): the weapon's own crack, the
             monster's body by what it is made of, the weight, a crit sweetener, the kill (SFXL.hit)
     miss    a blow that misses (NC.damageEnemy, r.miss)
   Each layer takes a random kept take (never the same twice in a row) with SFXL's small pitch / volume wobble. Layers
   whose takes are not made yet (element tails, monster voices, skill phases) are skipped. Until the takes are loaded,
   while a clip records (NC.SFX.log) or with ?hitsfx=0, hitfeel.js plays its old synth patches instead.
   At most 24 voices at once (the oldest stop first) through a compressor, so a crowd of hits never clips.
   A monster's material: NC.MONSTERS[type].sfxMat if set, else its id / name (MAT_RX below), else flesh. */
(function () {
  'use strict';
  const NC = window.NC, L = NC.SFXL, LIST = NC.SFX_LIST;
  if (!L || !LIST || !NC.SFX) return;
  const OFF = false;
  const DIR = 'assets/sfx/', MAX_VOICES = 24, VOL = 0.8;
  const HS = (NC.HitSfx = { ready: false, n: 0, log: null });

  // ---------------- the takes: loaded once, after the first key or click (when sfx.js makes its context) ----------------
  // the one-shots first, all at once (~4 MB of mp3); then the held loops (WAV, ~18 MB) one by one in the background, so
  // a loop that is not in yet is simply skipped
  const bufs = {}, last = {};
  let loading = null, bus = null, comp = null;
  const fetchOne = (ac, f) => fetch(DIR + f).then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((a) => (a ? ac.decodeAudioData(a) : null)).then((b) => { if (b) { bufs[f] = b; HS.n++; } }).catch(() => {});
  function load(ac) {
    if (loading) return loading;
    const shots = [], loops = [];
    for (const id in LIST) for (const f of LIST[id].f) (LIST[id].loop ? loops : shots).push(f);
    loading = Promise.all(shots.map((f) => fetchOne(ac, f))).then(() => {
      HS.ready = true;
      return loops.reduce((p, f) => p.then(() => fetchOne(ac, f)), Promise.resolve());
    }).then(() => { HS.loops = true; });
    return loading;
  }
  function out() {
    const b = NC.SFX.bus && NC.SFX.bus();
    if (!b) return null;
    if (b.ac !== bus) {                       // the compressor in front of sfx.js's master gain
      bus = b.ac; comp = bus.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.12;
      comp.connect(b.out);
      load(bus);
    }
    return HS.ready ? comp : null;
  }
  addEventListener('keydown', () => out(), false);       // (after sfx.js's own capture listener has made the context)
  addEventListener('pointerdown', () => out(), false);
  function take(id) {
    const s = LIST[id];
    if (!s) return null;
    const have = s.f.filter((f) => bufs[f]);
    if (!have.length) return null;
    let f = have[Math.floor(Math.random() * have.length)];
    if (have.length > 1 && f === last[id]) f = have[(have.indexOf(f) + 1) % have.length];
    last[id] = f;
    return bufs[f];
  }
  // one-shots share MAX_VOICES (the oldest stop first); held loops (e.loop) play for e.len seconds, or until the returned
  // handle's stop() when e.hold, and fade out over 0.15 s
  const voices = [], FADE = 0.15;
  function play(evts, pan, o) {
    const dest = out();
    if (!dest) return false;
    const ac = bus, t0 = ac.currentTime + 0.005, held = [];
    const k = o && o.vol != null ? o.vol : 1;
    let pn = dest;
    if (pan && ac.createStereoPanner) { pn = ac.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, pan)); pn.connect(dest); }
    for (const e of evts) {
      const b = take(e.id);
      if (!b) continue;
      const src = ac.createBufferSource(), g = ac.createGain(), at = t0 + (e.t || 0), v = (e.gain == null ? 1 : e.gain) * VOL * k;
      src.buffer = b; src.playbackRate.value = e.rate || 1;
      g.gain.setValueAtTime(v, at);
      src.connect(g); g.connect(pn);
      src.start(at);
      if (e.loop) {
        src.loop = true;
        g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(v, at + 0.08);
        if (!e.hold) { const end = at + Math.max(0.2, e.len || 1); g.gain.setValueAtTime(v, end); g.gain.linearRampToValueAtTime(0.0001, end + FADE); src.stop(end + FADE + 0.05); }
        held.push({ src, g, v });
        continue;
      }
      while (voices.length >= MAX_VOICES) { const old = voices.shift(); try { old.stop(); } catch (er) { /* (already done) */ } }
      voices.push(src);
      src.onended = () => { const i = voices.indexOf(src); if (i >= 0) voices.splice(i, 1); };
    }
    if (HS.log) HS.log.push(evts.map((e) => e.id));
    return { stop() {      // (fades the held loops out now)
      const t = ac.currentTime;
      for (const h of held.splice(0)) {
        try { h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(h.g.gain.value, t); h.g.gain.linearRampToValueAtTime(0.0001, t + FADE); h.src.stop(t + FADE + 0.05); } catch (er) { /* (already stopped) */ }
      }
    } };
  }
  HS.play = play;

  // ---------------- what the hero holds, what the monster is made of ----------------
  const ALIAS = { katana: 'sword', nodachi: 'gsword', rod: 'staff' };
  function wtype(p) {
    const W = p && NC.ITEMS[p.equip && p.equip.weapon];
    const t = W ? (NC.wtypeOf ? NC.wtypeOf(W) : W.wtype) : 'knuckle';     // (bare hands punch)
    return L.W[t] ? t : ALIAS[t] || 'sword';
  }
  // by the species id first, in this order (soldier_ant is a shell, tombstone a stone, stump_shroom wood); the Thai name
  // only when the id says nothing, with whole words (ผีเสื้อ is a moth, แม่มด not an ant)
  const MAT_ID = [
    ['goo', /slime|jelly|ooze|blob|ink_drop/],
    ['bone', /skelet|skull|bone|lich|mummy|zombie|ghoul/],
    ['shell', /crab|beetle|scorp|(^|_)ant(_|$)|turtle|snail|tortoise|mantis|spider|ladybug|hermit|armadillo|weaver|urchin|ammonite|crayfish/],
    ['wood', /stump|tree|treant|wood|(^|_)log(_|$)|puppet|dummy|scarecrow|doll|straw|coffin|cart|herald/],
    ['plant', /pumpkin|mush|shroom|plant|flower|bloom|vine|seed|cactus|fung|maneater|moss|dryad/],
    ['stone', /golem|stone|rock|gargoyle|statue|crystal|marble|geode|pebble|salt_golem|sand_giant|meteor|glass_warden/],
    ['metal', /guard|knight|armou?r|soldier|sentinel|sentry|squire|iron|steel|rail_|automaton|gear|clockwork|rivet|chest_gold/],
    ['spirit', /ghost|spirit|wisp|phantom|wraith|soul|shade|spect|banshee|sprite|devil|chime|mirage/],
  ];
  const MAT_TH = [
    ['goo', /สไลม์|วุ้น/], ['bone', /โครงกระดูก|ซอมบี้|มัมมี่/], ['shell', /ด้วง|แมงป่อง|แมงมุม|กระดอง/],
    ['wood', /ตอไม้|ต้นไม้|หุ่นไม้|หุ่นเชิด/], ['plant', /ฟักทอง|เห็ด/], ['stone', /โกเลม|รูปปั้น/],
    ['metal', /อัศวิน|ชุดเกราะ/], ['spirit', /ผี(?!เสื้อ)|วิญญาณ|ภูต/],
  ];
  const matCache = {};
  function matOf(e) {
    const type = (e && e.type) || '';
    if (matCache[type]) return matCache[type];
    const M = (NC.MONSTERS && NC.MONSTERS[type]) || {};
    const hit = MAT_ID.find(([, rx]) => rx.test(type)) || MAT_TH.find(([, rx]) => rx.test(M.name || ''));
    return (matCache[type] = M.sfxMat || (hit ? hit[0] : 'flesh'));
  }
  HS.matOf = matOf;
  HS.wtype = wtype;
  const isBoss = (e) => !!(e && ((NC.BOSSES && NC.BOSSES[e.type]) || (NC.DUNGEON_BOSSES && NC.DUNGEON_BOSSES[e.type]) || e.boss ||
    e.isBoss || e.storyBoss || e.worldBoss || e.guildBoss || e.rootTag === 'boss'));
  HS.isBoss = isBoss;
  const bigOf = (e) => isBoss(e) || !!(e && (e.r || 0) >= 70);
  // a monster's voice when it is hit: birds, small critters and insects by the id, the rest by the material (wood and
  // metal stay silent); NC.MONSTERS[type].sfxVoice overrides ('none' = silent)
  const V_ID = [
    ['mv_bird', /(^|_)crow|bird|eagle|owl|hawk|gull|rooster|goose|canary|sparrow|chick|heron|kingfisher|vulture|raven|ptero/],
    ['mv_critter', /rabbit|hare|mouse|(^|_)rat(_|$)|squirrel|lamb|ewe|calf|hedgehog|otter|frog|toad|newt|marmot|mole|beaver|muskrat|hatchling|tiny_|baph_kid|mushling|(^|_)bat(_|$)/],
    ['mv_insect', /bee|moth|mosquito|dragonfly|firefly|ladybug|strider|worm|leech|slug|ant(_|$)|beetle|mantis|spider|scorp/],
  ];
  const V_MAT = { flesh: 'mv_beast', goo: 'mv_slime', plant: 'mv_plant', shell: 'mv_insect', bone: 'mv_undead', stone: 'mv_golem', spirit: 'mv_ghost' };
  const voiceCache = {};
  function voiceOf(e) {
    const type = (e && e.type) || '';
    if (type in voiceCache) return voiceCache[type];
    const M = (NC.MONSTERS && NC.MONSTERS[type]) || {};
    const mat = matOf(e), hit = mat !== 'wood' && mat !== 'metal' && V_ID.find(([, rx]) => rx.test(type));   // (a scarecrow or a stone owl does not cry)
    const v = M.sfxVoice ? (M.sfxVoice === 'none' ? null : M.sfxVoice) : hit ? hit[0] : V_MAT[mat] || null;
    return (voiceCache[type] = v);
  }
  HS.voiceOf = voiceOf;

  // ---------------- a blow landing (called by js/hitfeel.js; false = play the old synth patch) ----------------
  // f.r = the hit's result: r.sfxElem (the element used, js/gamesfx.js's NC.heroHit wrapper), r.magic, r.sid (a skill)
  HS.hit = function (game, e, f) {
    if (OFF || !f) return false;
    const p = game && game.player, A = p && p.atk, r = f.r || {}, t = (game && game.time) || 0;
    const el = r.sfxElem && r.sfxElem !== 'neutral' ? r.sfxElem : null;
    const sid = r.sid || (HS.lastSkill && t - HS.lastSkill.t < 2 ? HS.lastSkill.id : null), S = sid && NC.SKILLS && NC.SKILLS[sid];
    // a lingering skill's quick ticks (js/dmgbeats.js 'tick': walls, storms, orbs) land softly, at most one every 0.25 s
    const tick = !!(f.skill && sid && NC.DMG_BEATS && NC.DMG_BEATS[sid] === 'tick' && !f.killed && !f.crit);
    if (tick) { if (t - (HS._tick || -9) < 0.25 && t >= (HS._tick || -9)) return true; HS._tick = t; }
    // the monster cries out now and then (a crit, the kill, a third of the blows), not twice inside 0.7 s
    const voiceId = voiceOf(e);
    const voice = !!voiceId && (f.killed || ((f.crit || Math.random() < 0.33) && t - (e._sfxV || -9) > 0.7));
    if (voice) e._sfxV = t;
    const evts = L.hit({ wtype: wtype(p), mat: matOf(e), crit: !!f.crit, kill: !!f.killed, big: bigOf(e), skill: !!f.skill,
      finisher: !!f.fin, combo: A && A.on ? A.step || 0 : 0, magic: !!r.magic,
      elem: f.skill ? el : null, welem: f.skill ? null : el, hint: S ? sid + ' ' + (S.name || '') : '', voice: voice && !tick, voiceId });
    return play(evts, f.pan || 0, tick ? { vol: 0.45 } : null);
  };

  // ---------------- the swing: each new attack step of the hero ----------------
  if (!OFF) {
    const baseUpd = NC.updatePlayer;
    NC.updatePlayer = function (game, dt) {
      const p = game && game.player, A = p && p.atk;
      const wasOn = !!(A && A.on), key = A ? A.step + '|' + A.name : '', t = p && p.anim ? p.anim.actT : 0;
      const res = baseUpd.apply(this, arguments);
      if (A && A.on && p.dead <= 0 && (!wasOn || A.step + '|' + A.name !== key || (p.anim && p.anim.actT < t - 1e-6))) {
        play(L.swing({ wtype: wtype(p), combo: A.step || 0 }), 0);
      }
      return res;
    };
    // a miss: one airy whiff per moment, the hero's own blows only (no o.quiet)
    const baseDamage = NC.damageEnemy;
    let lastMiss = -1;
    NC.damageEnemy = function (game, e, r, kx, ky, o) {
      const res = baseDamage.apply(this, arguments);
      if (r && r.miss && !(o && (o.quiet || o.dot)) && game && game.time - lastMiss > 0.12) {
        lastMiss = game.time;
        const p = game.player, pan = p && e ? Math.max(-0.6, Math.min(0.6, (e.x - p.x) / 600)) : 0;
        play([{ id: 'miss', t: 0, gain: 0.7, rate: 0.95 + Math.random() * 0.1 }], pan);
      }
      return res;
    };
  }
})();
