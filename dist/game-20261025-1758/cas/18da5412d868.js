/* herospine.js — the hero played from his Spine rig (the user, 2026-10-16: "ลองใส่ในเกมเลย"), for the look the rig was
   made for: the traveler's clothes, the spiky hair and the traveler's sword (the starting look), nothing on the head or
   the back. The rig NCHero is built by the rig builder (build_nchero.py + nchero_sword.py + nchero_sit.py),
   kept in Spine Rig Studio's rigs/NCHero and brought in by tools/hero_spine.py (assets/herospine.rig.js + the
   atlas page assets/herospine/herospine.png). Our own small player, like js/baphspine.js, plus what this rig uses on top:
   scale keys (the sword hand turned over in the run and the walk), slot alpha keys (the sword put away as he sits, the
   slash smears fading), held (stepped) keys.
   The hero's own state picks the move: idle / ready (the fighting stance), walk / run / dash (paced by how fast he really
   goes), the 3-hit sword combo (cut1-3 / swing1-3 -> sword1, sword2, sword4 / sword3: each cut's hit frame lands on the
   game's hit), sitting (X: sit_down,
   sit, stand_up), a hit flinch laid over whatever plays, death. Skills play the weapon's own attacks (SKILL_N / SKILL_RE;
   the cast bar holds the first attack's wind-up). Anything else (emotes) is drawn the old way while it plays.
   The life skills (2026-10-17, "rig ใหม่ไม่มีท่า ตัดไม้กับตกปลาหรอ"): the tool in his hand (js/life.js p.toolShow) is its own
   hold family (TOOLFAM: lf_axe / lf_pick / lf_hoe / lf_can / lf_rod, empty hands lf_hand) drawn from the tool's own sprite,
   with its own work moves from nchero_life.py (LIFE: lfChop -> lf_chop, smash1 -> lf_mine / lf_till, lfWater -> lf_water,
   lfKneel -> lf_kneel, each hit frame on the game's impact) and the fishing phases (fishing(): ready, cast, reel, the
   catch held up); the fishing line starts at the rig's rod tip (NC.weaponLine) and the catch sits between the rig's hands
   (NC.rigJoints haN / haF).
   EVERY OTHER LOOK (2026-10-17): any outfit, robe, onesie, hat, hair, glasses or cape is drawn by the game's own cut-out
   (avatar.js) in the rig's moves - HS.drawLook reads the rig's bones back as the cut-out's pose each frame (lookPose).
   NC.drawHero keeps working for everything else (ghosts / silhouettes, the hero-shaped bosses): the player's own hero goes
   through here, the other heroes in the world (party, bots, online players) through js/herospine_others.js; the windows that show a hero standing (the bag, the status page, the menu, the creator...) use HS.preview. ?spinehero=0 off, ?spinehero=1 on whatever he wears (tests).
   NC.HeroSpine.debug = true draws the bones.
   Every weapon (2026-10-17, "ต่อท่าถืออาวุธทุกประเภทเข้าเกมเลย ใส่อาวุธชิ้นไหนก็ใช้ท่าตามประเภท และภาพของอาวุธชิ้นนั้น"): the
   weapon's type (NC.WTYPES, 30 of them) picks the rig's hold family (FAM: <family>_idle / _walk / _run, the sword's own
   idle / ready / walk / run), and the weapon slots ('sword', the shoulder rest's 'sword_back' + 'sword_front', a pair's
   'weapon_B' in the far hand) show the EQUIPPED ITEM'S own picture: its game sprite, laid on the slot's bone with its
   grip (manifest ax + the item's grip) on the bone and its tip along the bone (the far hand: along the bone + 90 deg),
   6 rig px per game unit; a shoulder rest splits it 12 u from the grip (the root over the arm, the blade behind the head).
   The rig's own pictures stay for the items they were drawn from (RIG_ART: sharper). The sword's cut combo plays for the
   blade families; other attacks keep the old drawing.
   Attacks per weapon type (2026-10-17, "ทำท่าโจมตีของริกแยกตามประเภทอาวุธต่อเลย เริ่มจากขวานใหญ่กับปืน"): ATK maps a family's
   own combo acts to the rig's attacks (the great axe's heavyChop1-3 -> greataxe_atk1-3, the guns' gun1-3 -> pistol_atk1-3 /
   shotgun_atk1-3; nchero_attacks.py), each clip's hit frame (J.attacks, from the build) on the game's 'hit' event.
   While the rig draws him, NC.weaponLine (where skills and shots start: the gun's muzzle, the axe's head) is read off the
   rig's weapon bone - the far gun's for pistol_atk2.
   More (2026-10-17, "ทำท่าโจมตีของริกต่อ: หอก คทา ธนู"): thrust1-3 -> spear_atk1-3 (two hands on the shaft), castBolt1-3 ->
   staff_atk1-3 (the bolt leaves the orb), bow1-3 -> bow_atk1-3: the bow goes to the far hand and the near hand draws the
   string to the chin; the string is drawn here for any bow (stringQuads: the item's tie points, W.bow, its middle pulled
   to the rig's 'nock' bone by the nock's scaleY - 1; the rig's own 'bowstring' mesh is for the studio), and a sprite bow
   carried in the near hand gets its straight string (the game's bow pictures have none). */
(function () {
  'use strict';
  const NC = window.NC, DATA = NC.HERO_SPINE;
  if (!DATA) return;
  if (NC.ASSET_MANIFEST_HEROSPINE) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_HEROSPINE);
  // the run: 'run' = the dash (the user, 2026-10-17: "เราใช้ท่าวิ่งแดชแทนสิ"; lean 28, the back leg straight at the push,
  // the sword held up in front); ?herorun=a is run A (the run before it), b|c|d the other first choices, e|f|g the runs
  // after the research, dash_a|dash_b the dash with the sword low / trailing, ?herorun=drag the old leaning sword drag. Every one plays at rate 1 at the game's run speed (310 px/s)
  const HS = (NC.HeroSpine = { on: true, force: false, look: true, lookHead: true, debug: false, physics: true, atkLegs: true,
    run: 'run' });
  const D2R = Math.PI / 180, PAD = 6, STEP = 1 / 60;
  // game px per Spine unit at the hero's scale 1 (the rig's 870 px tall hero next to the cut-out hero: matched by eye)
  const SCALE = 0.1508;
  // (the cut-out drawn in the rig's moves at the rig's size: avatar.js draws 0.87 game px a unit, the rig 6 x SCALE)
  const LOOK_K = (6 * SCALE) / 0.87;

  // ---------------- the rig, as typed arrays ----------------
  function prep(J) {
    const nb = J.bones.length, ns = J.slots.length;
    const R = { J, nb, ns, par: new Int16Array(nb), sx: new Float32Array(nb), sy: new Float32Array(nb), sr: new Float32Array(nb),
      len: new Float32Array(nb), name: J.bones.map((b) => b[0]), atts: {}, slotAtt: J.slots.map((s) => s[2]), anims: {} };
    J.bones.forEach((b, i) => { R.par[i] = b[1]; R.sx[i] = b[2]; R.sy[i] = b[3]; R.sr[i] = b[4]; R.len[i] = b[5]; });
    let base = 0;
    for (const [k, a] of Object.entries(J.atts)) {
      const n = a.uv.length / 2, off = new Int32Array(n);
      let p = 0;
      for (let v = 0; v < n; v++) { off[v] = p; p += 1 + a.v[p] * 4; }
      R.atts[k] = { base, n, off, w: Float32Array.from(a.v), tri: Uint16Array.from(a.tri.map((t) => t + base)), uv: a.uv };
      base += n;
    }
    R.nv = base;
    R.uv = new Float32Array(base * 2);
    for (const a of Object.values(R.atts)) R.uv.set(a.uv, a.base * 2);
    R.pos = new Float32Array(base * 2);
    R.alpha = new Float32Array(base).fill(1);
    R.idx = new Uint16Array(Object.values(R.atts).reduce((s, a) => s + a.tri.length, 0));
    for (const [name, A] of Object.entries(J.anims)) {
      const b = {};
      for (const [bi, k] of Object.entries(A.b))
        b[bi] = { r: k.r ? Float32Array.from(k.r) : null, t: k.t ? Float32Array.from(k.t) : null, s: k.s ? Float32Array.from(k.s) : null };
      const c = {};
      for (const [si, k] of Object.entries(A.c || {})) c[si] = Float32Array.from(k);
      R.anims[name] = { d: A.d, b, s: A.s, c };
    }
    return R;
  }
  let RIG = null;
  const rig = () => RIG || (RIG = prep(DATA.hero));

  // ---------------- poses: deltas from the setup pose, so moves mix by weight ----------------
  function at(K, stride, t, out, w) {
    const n = K.length / stride;
    if (t <= K[0] || n === 1) { for (let c = 1; c < stride; c++) out[c - 1] += w * K[c]; return; }
    if (t >= K[(n - 1) * stride]) { for (let c = 1; c < stride; c++) out[c - 1] += w * K[(n - 1) * stride + c]; return; }
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (K[m * stride] <= t) lo = m; else hi = m; }
    const t0 = K[lo * stride], t1 = K[hi * stride], u = (t - t0) / (t1 - t0 || 1);
    for (let c = 1; c < stride; c++) out[c - 1] += w * (K[lo * stride + c] + (K[hi * stride + c] - K[lo * stride + c]) * u);
  }
  const tmp = [0, 0];
  function addClip(R, clip, t, w, P) {
    const A = R.anims[clip];
    if (!A || w <= 0) return;
    for (const bi in A.b) {
      const k = A.b[bi];
      if (k.r) { tmp[0] = 0; at(k.r, 2, t, tmp, w); P.r[bi] += tmp[0]; }
      if (k.t) { tmp[0] = tmp[1] = 0; at(k.t, 3, t, tmp, w); P.x[bi] += tmp[0]; P.y[bi] += tmp[1]; }
      if (k.s) { tmp[0] = tmp[1] = 0; at(k.s, 3, t, tmp, w); P.kx[bi] += tmp[0] - w; P.ky[bi] += tmp[1] - w; }  // (scale: from 1)
    }
  }
  const stepped = (keys, t) => { let v; for (const k of keys) { if (k[0] <= t) v = k; else break; } return v; };
  function alphaOf(A, si, t) { const K = A && A.c[si]; if (!K) return 1; tmp[0] = 0; at(K, 2, t, tmp, 1); return tmp[0]; }

  // ---------------- bones -> world (y up), with scale ----------------
  function world(R, L, M, from) {
    for (let i = from || 0; i < R.nb; i++) {
      const p = R.par[i], r = L.r[i] * D2R, cs = Math.cos(r), sn = Math.sin(r), kx = L.kx[i], ky = L.ky[i], x = L.x[i], y = L.y[i], o = i * 6;
      const la = cs * kx, lb = -sn * ky, lc = sn * kx, ld = cs * ky;
      if (p < 0) { M[o] = la; M[o + 1] = lb; M[o + 2] = lc; M[o + 3] = ld; M[o + 4] = x; M[o + 5] = y; continue; }
      const q = p * 6, pa = M[q], pb = M[q + 1], pc = M[q + 2], pd = M[q + 3];
      M[o] = pa * la + pb * lc; M[o + 1] = pa * lb + pb * ld; M[o + 2] = pc * la + pd * lc; M[o + 3] = pc * lb + pd * ld;
      M[o + 4] = pa * x + pb * y + M[q + 4]; M[o + 5] = pc * x + pd * y + M[q + 5];
    }
  }
  const rotW = (M, i) => Math.atan2(M[i * 6 + 2], M[i * 6]);
  function ik(R, L, M, p, c, tg, bend) {
    const o = p * 6, px = M[o + 4], py = M[o + 5], tx = M[tg * 6 + 4] - px, ty = M[tg * 6 + 5] - py;
    const l1 = Math.hypot(L.x[c], L.y[c]), l2 = R.len[c];
    if (!l1 || !l2) return;
    let cs = (tx * tx + ty * ty - l1 * l1 - l2 * l2) / (2 * l1 * l2);
    cs = cs < -1 ? -1 : cs > 1 ? 1 : cs;
    const a2 = Math.acos(cs) * bend, aa = l1 + l2 * cs, bb = l2 * Math.sin(a2);
    const a1 = Math.atan2(ty * aa - tx * bb, tx * aa + ty * bb), gp = R.par[p];
    L.r[p] = (a1 - (gp >= 0 ? rotW(M, gp) : 0)) / D2R;
    L.r[c] = a2 / D2R;
  }

  // ---------------- the move, from the hero's own state ----------------
  // the game's sword combo -> the rig's cuts: the game's hit time (its 'hit' event) lands on the cut's hit frame
  // (the traveler's sword fights with js/cutmoves.js's cut combo: a diagonal cut, a rising backhand, a jumping chop)
  const SWING = { swing1: ['sword1', 0.27], swing2: ['sword2', 0.28], swing3: ['sword3', 0.31],
    cut1: ['sword1', 0.27], cut2: ['sword2', 0.28], cut3: ['sword4', 0.58], thrust1: ['sword3', 0.31], thrust2: ['sword3', 0.31], thrust3: ['sword3', 0.31] };
  const LOOP = { idle: 1, ready: 1, walk: 1, run: 1, run_drag: 1, run_a: 1, run_b: 1, run_c: 1, run_d: 1, run_e: 1, run_f: 1, run_g: 1, dash_a: 1, dash_b: 1, sit: 1, lf_fish_reel: 1 };
  const looping = (name) => LOOP[name] || /_(idle|walk|run)$/.test(name);
  // the game's weapon types -> the rig's hold families (nchero_weapons.py)
  const FAM = { sword: 'sword', katana: 'sword', nodachi: 'sword', rod: 'staff', gsword: 'greatsword', spear: 'spear', lance: 'spear',
    qstaff: 'spear', axe: 'axe', mace: 'axe', torch: 'axe', gaxe: 'greataxe', hammer: 'hammer', dagger: 'dagger', katar: 'katar',
    knuckle: 'knuckle', wire: 'knuckle', dsword: 'dsword', sickle: 'dsword', bow: 'bow', xbow: 'xbow', staff: 'staff', lantern: 'staff',
    orb: 'orb', bell: 'orb', book: 'orb', puppet: 'orb', instrument: 'lute', whip: 'whip', pistol: 'pistol', shotgun: 'shotgun',
    scythe: 'scythe', huuma: 'huuma' };
  // the families whose attacks the rig's sword cuts can stand in for (the others keep the old drawing while attacking)
  const CUTS = { sword: 1, axe: 1, dagger: 1, dsword: 1, katar: 1, greatsword: 1, greataxe: 1, scythe: 1, spear: 1 };
  // the items the rig's own (sharper) pictures were drawn from: their weapon slots keep the rig's meshes
  const RIG_ART = { sword: 'sword', axe: 'axe', greatsword: 'greatsword', spear: 'spear', hammer: 'hammer', staff: 'staff', bow: 'bow', dagger: 'dagger' };
  const WSLOT = { sword: 'near', sword_back: 'back', sword_front: 'front', weapon_B: 'far' };
  // a family's own combo acts -> the rig's attacks (J.attacks: each one's hit frame, and which gun fires)
  const ATK = { greataxe: { heavyChop1: 'greataxe_atk1', heavyChop2: 'greataxe_atk2', heavyChop3: 'greataxe_atk3' },
    pistol: { gun1: 'pistol_atk1', gun2: 'pistol_atk2', gun3: 'pistol_atk3' },
    shotgun: { gun1: 'shotgun_atk1', gun2: 'shotgun_atk2', gun3: 'shotgun_atk3' },
    spear: { thrust1: 'spear_atk1', thrust2: 'spear_atk2', thrust3: 'spear_atk3' },
    staff: { castBolt1: 'staff_atk1', castBolt2: 'staff_atk2', castBolt3: 'staff_atk3' },
    bow: { bow1: 'bow_atk1', bow2: 'bow_atk2', bow3: 'bow_atk3' },
    // the pairs (2026-10-17, "ทำท่าโจมตีของริกต่อ: มีด ดาบคู่ คาตาร์"): the dagger's blade set (iaiS1-3: the third a dash through,
    // the cut landing after), the twin swords' / sickles' cut and swing combos, the katar's punches
    dagger: { iaiS1: 'dagger_atk1', iaiS2: 'dagger_atk2', iaiS3: 'dagger_atk3', swing1: 'dagger_atk1', swing2: 'dagger_atk2', cut1: 'dagger_atk1', cut2: 'dagger_atk2' },
    dsword: { cut1: 'dsword_atk1', cut2: 'dsword_atk2', cut3: 'dsword_atk3', swing1: 'dsword_atk1', swing2: 'dsword_atk2', swing3: 'dsword_atk3' },
    katar: { swing1: 'katar_atk1', swing2: 'katar_atk2', swing3: 'katar_atk3', cut1: 'katar_atk1', cut2: 'katar_atk2', cut3: 'katar_atk3' },
    // the heavy ones (2026-10-17, "ทำท่าโจมตีของริกต่อ: ค้อน เคียว ดาบใหญ่"): the hammer's and the scythe's heavyChop1-3, the
    // greatsword's own set (gsRise a rising cut, gsCleave, gsLeap) and the plain combos some greatswords use
    hammer: { heavyChop1: 'hammer_atk1', heavyChop2: 'hammer_atk2', heavyChop3: 'hammer_atk3', smash1: 'hammer_atk1', smash2: 'hammer_atk2', smash3: 'hammer_atk3' },
    scythe: { heavyChop1: 'scythe_atk1', heavyChop2: 'scythe_atk2', heavyChop3: 'scythe_atk3' },
    greatsword: { gsRise: 'greatsword_atk1', gsCleave: 'greatsword_atk2', gsLeap: 'greatsword_atk3', swing1: 'greatsword_atk2', swing2: 'greatsword_atk1',
      swing3: 'greatsword_atk3', cut1: 'greatsword_atk2', cut2: 'greatsword_atk1', cut3: 'greatsword_atk3', heavyChop1: 'greatsword_atk2', heavyChop3: 'greatsword_atk3' },
    // (2026-10-17, "ทำท่าโจมตีของริกต่อ: ขวาน สนับมือ แส้"): the axe's own chops (maces and torches: cut1-3), the knuckles'
    // punches (the steel wire: thrust1-3), the whip's cracks
    axe: { axeChop1: 'axe_atk1', axeChop2: 'axe_atk2', axeChop3: 'axe_atk3', cut1: 'axe_atk1', cut2: 'axe_atk2', cut3: 'axe_atk3',
      swing1: 'axe_atk1', swing2: 'axe_atk2', swing3: 'axe_atk3' },
    knuckle: { swing1: 'knuckle_atk1', swing2: 'knuckle_atk2', swing3: 'knuckle_atk3', thrust1: 'knuckle_atk1', thrust2: 'knuckle_atk2', thrust3: 'knuckle_atk3',
      cut1: 'knuckle_atk1', cut2: 'knuckle_atk2', cut3: 'knuckle_atk3' },
    whip: { swing1: 'whip_atk1', swing2: 'whip_atk2', swing3: 'whip_atk3', cut1: 'whip_atk1', cut2: 'whip_atk2', cut3: 'whip_atk3' },
    // (2026-10-17, "ทำท่าโจมตีของริกต่อ: หน้าไม้ ออร์บ เครื่องดนตรี ดาวยักษ์"): the crossbow's shots (bow1-3: from the hip, crouched,
    // braced at the shoulder), the orb's / bell's / puppet's casts (the book's swings), the instrument's bolts, the huuma's
    // throws (the star leaves the hand on the hit frame: pose() hides the weapon slots while it flies, p.pose.wHide)
    xbow: { bow1: 'xbow_atk1', bow2: 'xbow_atk2', bow3: 'xbow_atk3' },
    orb: { castBolt1: 'orb_atk1', castBolt2: 'orb_atk2', castBolt3: 'orb_atk3', bolt1: 'orb_atk1', bolt2: 'orb_atk2', bolt3: 'orb_atk3',
      swing1: 'orb_atk1', swing2: 'orb_atk2', swing3: 'orb_atk3', cut1: 'orb_atk1', cut2: 'orb_atk2', cut3: 'orb_atk3' },
    lute: { bolt1: 'lute_atk1', bolt2: 'lute_atk2', bolt3: 'lute_atk3', castBolt1: 'lute_atk1', castBolt2: 'lute_atk2', castBolt3: 'lute_atk3',
      swing1: 'lute_atk1', swing2: 'lute_atk2', swing3: 'lute_atk3' },
    huuma: { throwStar1: 'huuma_atk1', throwStar2: 'huuma_atk2', throwStar3: 'huuma_atk3' } };
  const HITS = DATA.hero.attacks || {};
  // the life skills (the user, 2026-10-17: "rig ใหม่ไม่มีท่า ตัดไม้กับตกปลาหรอ"): js/life.js puts the TOOL in his hand while he
  // works (p.toolShow swaps it into p.equip.weapon for the draw: the axe / pickaxe / hoe / can / rod of his tier, t_none =
  // empty hands), so the tool is drawn from its own sprite like any item; each tool is its own hold family (nchero_life.py:
  // <tool>_idle = the working stance, _walk, _run) with its own work moves, each hit frame on the game's impact time
  // (life.js CLIPS 0.2 / 0.232, life_farm.js's V.at 0.24 / 0.25), so they play the act's own clock
  const TOOLFAM = { t_axe: 'lf_axe', t_pick: 'lf_pick', t_hoe: 'lf_hoe', t_can: 'lf_can', t_rod: 'lf_rod', t_none: 'lf_hand' };
  const toolFam = (id) => { const m = /^t_[a-z]+/.exec(id || ''); return m ? TOOLFAM[m[0]] || null : null; };
  const LIFE = { lfChop: { lf_axe: 'lf_chop' }, smash1: { lf_pick: 'lf_mine', lf_hoe: 'lf_till' }, lfWater: { lf_can: 'lf_water' },
    lfKneel: { '*': 'lf_kneel' } };
  const isWork = (name) => /^lf_/.test(name || '') && !/_(idle|walk|run)$/.test(name);
  // fishing (life_fish.js p.fishAct.phase), the rod in both hands: waiting = the rod's idle; aim holds a point of the cast's
  // draw-back by the power, the cast plays on from its release frame (J.attacks hit) as the line flies; the reel pulls
  // faster the tighter the line; lift (the fish out of the water) is the yank at the start of lf_fish_show, show the rest
  const ease = (u) => u * u * (3 - 2 * u);
  // (then the user, 2026-10-17: "ทำรายละเอียดตรงนี้ด้วยสิ") laid over those moves while the line is out: the rod BENDS towards
  // the water (S.bend: radians at the tip, drawn by rodQuads; the line starts at the bent tip) - a little under the float's
  // weight, a dip on each nibble, tugged down at the bite, by the tension while reeling, and harder at each jerk of the fish
  // (life_fish.js resets a.jerk when the fish tugs); the rod and the upper body give a little at a dip, a bite or a jerk
  // (S.add: degrees on the 'sword' and 'body_2' bones). The press at the bite hooks it: the reel opens with lf_fish_hook (the
  // rod snapped up); a lost fish plays lf_fish_lost (a slump). Both are eased in pose(), so the phases run into each other
  function fishing(p, S, R) {
    const a = p.fishAct, ph = a.phase, rel = HITS.lf_fish_cast ? HITS.lf_fish_cast.hit : 0.32, now = NC.game ? NC.game.time : performance.now() / 1000;
    const T = Math.max(0, Math.min(1, a.T || 0));
    if (ph === 'reel') { if (S.jk != null && a.jerk > S.jk + 0.05) S.jerkAt = now; S.jk = a.jerk; } else S.jk = null;
    const jerk = S.jerkAt != null ? Math.exp(-(now - S.jerkAt) * 9) : 0;
    let bend = 0, rod = 0, lean = 0;
    if (ph === 'wait' || ph === 'nibble') { const d = Math.max(0, Math.min(1, (a.dip || 0) / 0.25)); bend = 0.07 + 0.25 * d; rod = -6 * d; lean = -1.5 * d; }
    else if (ph === 'bite') { const w = 0.5 + 0.5 * Math.sin(now * 38); bend = 0.3 + 0.2 * w; rod = -5 - 6 * w; lean = -2.5 * w; }
    else if (ph === 'reel') { bend = 0.16 + 0.62 * T + 0.38 * jerk; rod = -10 * jerk; lean = -4 * jerk; }
    else if (ph === 'lift') bend = 0.5 * Math.max(0, 1 - a.t / 0.35);
    S.bend = bend; S.add = { sword: rod, body_2: lean };
    if (ph === 'aim' && R.anims.lf_fish_cast) return ['lf_fish_cast', rel * (0.25 + 0.75 * ease(Math.max(0, Math.min(1, a.power || 0)))), 1];
    if (ph === 'fly' && R.anims.lf_fish_cast) return ['lf_fish_cast', Math.min(R.anims.lf_fish_cast.d, rel + a.t), 1];
    if (ph === 'reel' && a.t < 0.3 && R.anims.lf_fish_hook) return ['lf_fish_hook', a.t, 1];
    if (ph === 'reel' && R.anims.lf_fish_reel) return ['lf_fish_reel', null, 0.6 + 1.2 * T];
    if ((ph === 'lift' || ph === 'show') && R.anims.lf_fish_show) return ['lf_fish_show', Math.min(R.anims.lf_fish_show.d, ph === 'lift' ? Math.min(0.5, a.t) : 0.5 + a.t), 1];
    if (ph === 'lost' && R.anims.lf_fish_lost) return ['lf_fish_lost', Math.min(R.anims.lf_fish_lost.d, a.t), 1];
    return [R.anims.lf_rod_idle ? 'lf_rod_idle' : clipFor('idle', p, R), null, 1];
  }
  // skills (2026-10-17, the user: "ท่าสกิลก็ใช้ท่าตีปกติก็ได้นะไม่ต้องไปเพิ่มอะไรพิเศษ"): a skill's pose plays the weapon's own
  // attack - the act's number picks which (cut2, bolt2, bow2... -> <fam>_atk2), the buff/ult raise 'cheer' and the leaps the
  // third; the cast bar (castHold / castFloat: held acts) holds the first attack's wind-up (J.attacks wind) till the spell goes
  const SKILL_N = { cheer: 3, gsLeap: 3, gsRise: 1, gsCleave: 2, throwKunai: 2, castRelease: 1, 'animight:41_epic': 1 };
  const SKILL_RE = /^(cut|swing|thrust|smash|heavyChop|axeChop|iaiS|bolt|castBolt|bow|gun|throwStar|stormS|stormB)([123])$/;
  const HOLD = { castHold: 1, castFloat: 1 };
  const skillN = (act) => { if (HOLD[act]) return 1; if (SKILL_N[act]) return SKILL_N[act]; const m = SKILL_RE.exec(act); return m ? +m[2] : 0; };
  const isAttack = (name) => /^sword[1-4]$|_atk\d$/.test(name || '');
  const weaponOf = (p) => { const id = p.equip && p.equip.weapon; return id ? NC.ITEMS[id] : null; };
  const famOf = (p) => {
    const W = weaponOf(p); if (!W) return 'sword';
    const tf = W.slot === 'tool' && toolFam(p.equip.weapon); if (tf) return tf;       // (a life skill's tool)
    const t = (NC.wtypeOf ? NC.wtypeOf(W) : W.wtype) || W.wtype; return FAM[t] || 'sword';
  };
  // the clip for a base move ('idle', 'ready', 'walk', 'run') with this hero's weapon
  function clipFor(base, p, R) {
    const f = famOf(p);
    if (f === 'sword') return base === 'run' ? HS.run : base;
    const n = f + '_' + (base === 'ready' ? 'idle' : base);
    return R.anims[n] ? n : base === 'run' ? HS.run : base;
  }
  // -> [clip, its hit time, the time to hold (a cast bar) or undefined] or null
  function atkOf(p, act, R) {
    const f = famOf(p), c = ATK[f] && ATK[f][act];
    if (c && R.anims[c] && HITS[c]) return [c, HITS[c].hit];
    const n = skillN(act), hold = HOLD[act];
    if (n) {
      const own = f + '_atk' + n;
      if (R.anims[own] && HITS[own]) return hold ? [own, HITS[own].hit, HITS[own].wind] : [own, HITS[own].hit];
      const s = SWING['cut' + n];
      if (f === 'sword') return hold ? [s[0], s[1], s[1] * 0.6] : s;
    }
    return SWING[act] && CUTS[f] ? SWING[act] : null;
  }
  // the rig's time for the game's: its hit frame on the game's hit, the rest stretched over what is left of the act
  function actT(st, R, m) {
    const clip = NC.Anim.CLIPS[st.act], ev = clip.ev && clip.ev.find((e) => e[1] === 'hit');
    const hit = ev ? ev[0] : clip.dur * 0.4, t = st.actT, A = R.anims[m[0]];
    if (t < hit) return [m[0], (t / hit) * m[1]];
    return [m[0], m[1] + ((t - hit) * (A.d - m[1])) / Math.max(0.05, clip.dur + (clip.out || 0.1) - hit)];
  }
  // -> [clip, absolute time or null (advance it), rate] or null (the old drawing)
  function target(p, S, R) {
    const st = p.anim;
    S.bend = 0; S.add = null;                                                      // (fishing() sets them)
    if (p.dead > 0) return ['die', Math.max(0, 2.6 - p.dead), 1];
    if (p.fishAct && famOf(p) === 'lf_rod') return fishing(p, S, R);
    if (st && st.act) {
      const lf = LIFE[st.act], lc = lf && (lf[famOf(p)] || lf['*']);              // (a life skill's work move)
      if (lc && R.anims[lc]) return [lc, Math.min(st.actT, R.anims[lc].d), 1];
      const m = atkOf(p, st.act, R);
      if (m && m[2] != null) return [m[0], Math.min(m[2], st.actT), 1]; // (a cast bar: the wind-up, held)
      if (m) { const [c, t] = actT(st, R, m); return [c, t, 1]; }
      if (!(NC.Anim.CLIPS[st.act] && NC.Anim.CLIPS[st.act].fidget)) return null;
    }
    if (st && st.base === 'sit') return ['sit', null, 1];
    if (p.dash) { const RUN = clipFor('run', p, R); return [RUN, null, 1.5 * (RUN === 'run_drag' ? 1.75 : 1)]; }
    if (p.moving) { const [c, rate] = moveClip(p, S, R); return [c, null, rate]; }
    return [clipFor(p.combat > 0.5 ? 'ready' : 'idle', p, R), null, 1];
  }
  // the steps he is making on the move -> [clip, rate]
  function moveClip(p, S, R) {
    const RUN = clipFor('run', p, R), RR = RUN === 'run_drag' ? 1.75 : 1;
    // going away from where he faces (fighting on the move, a party member kiting): he steps BACK - the walk played
    // backwards, never a run - not forward steps sliding the wrong way (the user, 2026-10-18: "มูนวอก")
    const back = (S.vx || 0) * (p.face || 1) < -40 && Math.abs(S.vx) > S.speed * 0.35;
    if (back) return [clipFor('walk', p, R), -Math.max(0.8, Math.min(2.6, (S.speed / 150) * 1.85))];
    if (p.running) return [RUN, Math.max(0.6, Math.min(2.6, (S.speed / 310) * RR))];
    return [clipFor('walk', p, R), Math.max(0.8, Math.min(2.6, (S.speed / 150) * 1.85))];
  }
  function state(p) {
    // (a hero first seen sitting - a stall keeper, another player resting by the fire - is already seated: no sit-down)
    const seated = p.anim && p.anim.base === 'sit' && !p.moving ? { name: 'sit', t: 0 } : null;
    return p._hspine || (p._hspine = { cur: seated, prev: null, fade: 0, fadeD: 0, hit: -1, hurt: 0, last: null, speed: 0, lx: p.x, ly: p.y, phys: null, acc: 0, face: 1 });
  }
  function start(S, name, t, fadeD) {
    if (S.cur) { S.prev = S.cur; S.fade = 0; S.fadeD = fadeD; }
    S.cur = { name, t: t || 0 };
  }
  // advance the state; false when this frame belongs to the old drawing
  function advance(p, S, dt, R) {
    if (dt > 0) {
      const v = Math.hypot(p.x - S.lx, p.y - S.ly) / dt, k = Math.min(1, dt * 10);
      S.speed += (v - S.speed) * k;
      S.vx = (S.vx || 0) + ((p.x - S.lx) / dt - (S.vx || 0)) * k;               // (sideways, for stepping back)
    }
    const T = target(p, S, R);
    if (!T) { S.cur = null; S.prev = null; return false; }
    let [name, abs, rate] = T;
    const cur = S.cur && S.cur.name;
    // sitting: sit_down, then the loop; getting up: stand_up plays out before standing (unless he goes somewhere)
    if (name === 'sit') {
      if (cur === 'sit_down' && S.cur.t >= R.anims.sit_down.d) { start(S, 'sit', 0, 0.001); S.prev = null; }
      else if (cur !== 'sit_down' && cur !== 'sit') start(S, 'sit_down', 0, 0.12);
    } else if ((cur === 'sit' || cur === 'sit_down') && /idle$|ready$/.test(name)) start(S, 'stand_up', 0, 0.06);
    else if (cur === 'stand_up' && S.cur.t < R.anims.stand_up.d && /idle$|ready$/.test(name)) { /* let it play out */ }
    else if (cur !== name) {
      // (back to walking / running after a shot on the move: it carries on from the steps the legs were making)
      const t0 = abs != null ? abs : S.legs && S.legs.name === name && S.legW > 0.01 ? S.legs.t : S.gait && S.gait.walk === name ? S.gait.ph * R.anims[name].d : 0;
      start(S, name, t0, isAttack(name) || isWork(name) ? 0.06 : name === 'die' ? 0.1 : 0.16);
    }
    if (S.cur.name === name && abs != null) S.cur.t = abs;
    else {
      S.cur.t += dt * (S.cur.name === name ? rate : 1);
      if (looping(S.cur.name)) { const d = R.anims[S.cur.name].d; S.cur.t = ((S.cur.t % d) + d) % d; } // (a step back runs it backwards)
    }
    if (S.prev) { S.prev.t += dt; S.fade += dt; if (S.fade >= S.fadeD) S.prev = null; }
    // fighting on the move (the user, 2026-10-18: an archer's / a gunner's shots slid his feet along the ground, "ขาสไลด์";
    // the old cut-out skips an attack's leg keys while walking, anim.js LOWER): the attack plays on the upper body and the
    // legs keep stepping. At walking pace (the slowed walk of an attack or a skill, a step back) the rig's own walk can't
    // keep up - its planted foot covers ~27 px a second at rate 1, the game walks him at 124-140 - so the steps are worked
    // out from the ground he covers (S.gait, pose()): a planted foot stays where it was put on the ground, the stride as
    // long as his legs reach, the step rate from the distance; the walk clip's arms and body follow the same steps. At
    // running pace the run clip's legs carry on under an attack (S.legs)
    const mv = HS.atkLegs && p.moving && !p.dash && p.dead <= 0 && name !== 'sit' && !isWork(name) ? moveClip(p, S, R) : null;
    const runC = mv && mv[1] > 0 && p.running ? mv[0] : null, walkC = mv && !runC && R.anims[mv[0]] ? mv[0] : null;
    if (runC && R.anims[runC]) {
      const d = R.anims[runC].d;
      if (!S.legs || S.legs.name !== runC) S.legs = { name: runC, t: S.cur.name === runC ? S.cur.t : S.prev && S.prev.name === runC ? S.prev.t : 0 };
      else if (S.cur.name === runC) S.legs.t = S.cur.t;                           // (just running: the run's own steps)
      else S.legs.t = (((S.legs.t + dt * mv[1]) % d) + d) % d;
    }
    S.legW = (S.legW || 0) + ((runC ? 1 : 0) - (S.legW || 0)) * Math.min(1, dt * 12);
    if (S.legW < 0.002 && !runC) S.legs = null;
    if (walkC || S.gait) {
      const wc = walkC || S.gait.walk, d = R.anims[wc].d;
      // (starting: on the walk's own steps, else from where the near foot stands - it stays planted, the far one steps first)
      if (!S.gait) S.gait = { ph: S.cur.name === wc ? S.cur.t / d : S.prev && S.prev.name === wc ? S.prev.t / d : gaitFrom(R, S) };
      // (the ground covered this frame, in rig px: backwards when he steps back; still counted while the steps fade out, so a
      // planted foot stays put as the next move takes over)
      const back = walkC ? mv[1] < 0 : S.gait.back;
      const dd = (Math.hypot(p.x - S.lx, p.y - S.ly) / SCALE) * (back ? -1 : 1);
      let dph = (GAIT.duty * dd) / (2 * GAIT.a);
      dph = Math.max(-dt * GAIT.maxCycle, Math.min(dt * GAIT.maxCycle, dph));
      S.gait.ph = (((S.gait.ph + dph) % 1) + 1) % 1;
      S.gait.walk = wc; S.gait.back = back;
      if (S.cur.name === wc) S.cur.t = S.gait.ph * d;                             // (the walk's arms on the same steps)
    }
    S.gw = (S.gw || 0) + ((walkC ? 1 : 0) - (S.gw || 0)) * Math.min(1, dt * 12);
    if (S.gw < 0.002 && !walkC) S.gait = null;
    // a new hit: the flinch laid over the move
    if (p.hurt > S.hurt + 1e-4 && p.dead <= 0) S.hit = 0;
    S.hurt = p.hurt || 0;
    if (S.hit >= 0) { S.hit += dt; if (S.hit > R.anims.hit.d) S.hit = -1; }
    return true;
  }

  // ---------------- one frame of the rig ----------------
  function pose(p, S, dt, R, mvx, only) {
    const nb = R.nb;
    const D = S.D || (S.D = { r: new Float32Array(nb), x: new Float32Array(nb), y: new Float32Array(nb), kx: new Float32Array(nb), ky: new Float32Array(nb) });
    D.r.fill(0); D.x.fill(0); D.y.fill(0); D.kx.fill(0); D.ky.fill(0);
    const w = S.prev ? Math.min(1, S.fade / S.fadeD) : 1, sm = w * w * (3 - 2 * w);
    addClip(R, S.cur.name, S.cur.t, sm, D);
    if (S.prev) addClip(R, S.prev.name, S.prev.t, 1 - sm, D);
    if (S.hit >= 0) addClip(R, 'hit', S.hit, isAttack(S.cur.name) ? 0.5 : 0.8, D);
    // (on the move) the lower body from the steps he is making (advance()), not from the attack - on the ground: a jump's
    // legs (the 'cha' bone up in the air) stay the attack's, and an attack's slide along the ground gives way to the steps
    const ci = bi(R, 'cha'), hi = bi(R, 'hip'), up = Math.max(0, Math.min(1, D.y[ci] / 48)), ground = 1 - up * up * (3 - 2 * up);
    if (S.legs && S.legW > 0.002 && (S.cur.name !== S.legs.name || S.prev)) {
      const lw = S.legW * ground;
      if (lw > 0.002) {
        const G = S.G || (S.G = { r: new Float32Array(nb), x: new Float32Array(nb), y: new Float32Array(nb), kx: new Float32Array(nb), ky: new Float32Array(nb) });
        G.r.fill(0); G.x.fill(0); G.y.fill(0); G.kx.fill(0); G.ky.fill(0);
        addClip(R, S.legs.name, S.legs.t, 1, G);
        for (const n of LEG_BONES) {
          const i = bi(R, n); if (i < 0) continue;
          D.r[i] += (G.r[i] - D.r[i]) * lw; D.x[i] += (G.x[i] - D.x[i]) * lw; D.y[i] += (G.y[i] - D.y[i]) * lw;
          D.kx[i] += (G.kx[i] - D.kx[i]) * lw; D.ky[i] += (G.ky[i] - D.ky[i]) * lw;
        }
        D.x[ci] *= 1 - lw;
      }
    }
    // the worked-out steps (walking pace): each foot planted for GAIT.duty of its cycle, sliding back under him exactly as
    // far as he goes, then lifted forward in an arc; the other foot half a cycle on. The hips drop to GAIT.hip (a fighting
    // crouch: the long stride needs the reach) and bob with the steps; the boots turn as the walk clip turns them
    const gw = S.gait && S.gw > 0.002 ? S.gw * ground : 0;
    if (gw > 0.002) {
      const G = S.G || (S.G = { r: new Float32Array(nb), x: new Float32Array(nb), y: new Float32Array(nb), kx: new Float32Array(nb), ky: new Float32Array(nb) });
      G.r.fill(0); G.x.fill(0); G.y.fill(0); G.kx.fill(0); G.ky.fill(0);
      const A = R.anims[S.gait.walk], ph = S.gait.ph;
      if (A) addClip(R, S.gait.walk, ph * A.d, 1, G);
      const a = GAIT.a, du = GAIT.duty;
      for (const [tg, ft, off, u0] of GAIT_FEET) {
        const it = bi(R, tg), iF = bi(R, ft), u = (ph + u0) % 1;
        let x, y = 0;
        if (u < du) x = a - (2 * a * u) / du;
        else { const s = (u - du) / (1 - du), e = s * s * (3 - 2 * s); x = -a + 2 * a * e; y = GAIT.lift * Math.sin(Math.PI * s); }
        D.x[it] += (off + x - D.x[it]) * gw; D.y[it] += (y - D.y[it]) * gw;   // (on the ground: the hips may shift over it)
        D.r[iF] += (G.r[iF] - D.r[iF]) * gw;
      }
      const hy = Math.min(D.y[hi], GAIT.hip) - GAIT.bob * (0.5 + 0.5 * Math.cos(4 * Math.PI * ph));
      D.y[hi] += (hy - D.y[hi]) * gw;
      D.x[ci] *= 1 - gw;
    }
    // (fishing) the rod and the body giving a little at a dip, a bite or a jerk, and the rod's bend: eased in and out
    const SA = S.addS || (S.addS = {}), ke = dt > 0 ? Math.min(1, dt * 14) : 1;
    for (const n of ADD_BONES) {
      SA[n] = (SA[n] || 0) + (((S.add && S.add[n]) || 0) - (SA[n] || 0)) * ke;
      const i = bi(R, n); if (i >= 0 && Math.abs(SA[n]) > 1e-3) D.r[i] += SA[n];
    }
    S.bendS = (S.bendS || 0) + ((S.bend || 0) - (S.bendS || 0)) * (dt > 0 ? Math.min(1, dt * 12) : 1);
    S.bendUsed = 0;                                             // (the bend the rod is drawn with: none while it is split)
    const L = S.L || (S.L = { r: new Float32Array(nb), x: new Float32Array(nb), y: new Float32Array(nb), kx: new Float32Array(nb), ky: new Float32Array(nb) });
    for (let i = 0; i < nb; i++) { L.r[i] = R.sr[i] + D.r[i]; L.x[i] = R.sx[i] + D.x[i]; L.y[i] = R.sy[i] + D.y[i]; L.kx[i] = 1 + D.kx[i]; L.ky[i] = 1 + D.ky[i]; }
    const M = S.M || (S.M = new Float32Array(nb * 6));
    world(R, L, M);
    if (gw > 0.002) reachDrop(R, L, M);                          // (the worked-out steps: the hips lower if a foot is out of reach)
    for (const [pb, c, tg, bend] of R.J.ik) { ik(R, L, M, pb, c, tg, bend); world(R, L, M, pb); }
    // physics: the hair tufts and the scarf's tail, springs on their turn, pushed by how they move (his own steps too)
    if (HS.physics && R.J.phys.length) {
      if (!S.phys) S.phys = R.J.phys.map(([b]) => ({ b, off: 0, vel: 0, px: M[b * 6 + 4], py: M[b * 6 + 5] }));
      S.acc = Math.min(S.acc + dt, 0.1);
      const steps = Math.floor(S.acc / STEP);
      S.acc -= steps * STEP;
      R.J.phys.forEach(([b, inertia, strength, damping], k) => {
        const ph = S.phys[k], o = b * 6, X = M[o + 4], Y = M[o + 5], th = rotW(M, b), len = R.len[b] || 40;
        const dx = X - ph.px - mvx, dy = Y - ph.py;
        ph.px = X; ph.py = Y;
        ph.off -= ((-dx * Math.sin(th) + dy * Math.cos(th)) / len) * inertia;
        for (let s = 0; s < steps; s++) { ph.vel += -strength * ph.off * STEP; ph.off += ph.vel * STEP; ph.vel *= damping; }
        ph.off = Math.max(-0.7, Math.min(0.7, ph.off));
        L.r[b] += ph.off / D2R;
        world(R, L, M, b);
      });
    }
    // the slots: attachments (the face, the slashes) from the move (the flinch's face on top), alpha from the moves
    const A = R.anims[S.cur.name], Pv = S.prev && R.anims[S.prev.name], H = S.hit >= 0 && R.anims.hit, att = R.slotAtt.slice();
    if (A.s) for (const si in A.s) { const k = stepped(A.s[si], S.cur.t); if (k) att[si] = k[1]; }
    if (H && H.s) for (const si in H.s) { const k = stepped(H.s[si], S.hit); if (k) att[si] = k[1]; }
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, ni = 0;
    const P = R.pos, AL = R.alpha, sprites = [], item = weaponOf(p), own = item && RIG_ART[item.id], fam = famOf(p);
    // (the creator's head: its back hair behind everything, its head where the rig's head mesh goes, no face patch)
    const LH = (!only || only === 'noFx') && HS.lookHead ? lookHeadOf(p.equip) : null;
    if (LH) {
      const q = headQuad(LH, LH.under, R, M);
      if (q) { sprites.push({ at: 0, q, al: 1 }); for (let v = 0; v < 8; v += 2) { const X = q.pos[v], Y = q.pos[v + 1]; if (X < minX) minX = X; if (X > maxX) maxX = X; if (Y < minY) minY = Y; if (Y > maxY) maxY = Y; } }
    }
    for (let si = 0; si < R.ns; si++) {
      const an = att[si];
      if (!an) continue;
      const sname = R.J.slots[si][0], kind = WSLOT[sname];
      if (only && (only === 'noFx' ? sname === 'fx' : !only[sname])) continue;
      if (kind && p.pose && p.pose.wHide > 0.5) continue; // (the thrown huuma: out of his hand while it flies)
      const al = sm * alphaOf(A, si, S.cur.t) + (Pv ? (1 - sm) * alphaOf(Pv, si, S.prev.t) : 0);
      if (al <= 0.003) continue;
      const grow = (q) => { for (let v = 0; v < 8; v += 2) { const X = q.pos[v], Y = q.pos[v + 1]; if (X < minX) minX = X; if (X > maxX) maxX = X; if (Y < minY) minY = Y; if (Y > maxY) maxY = Y; } };
      if (LH && (sname === 'head' || sname === 'face')) {
        if (sname === 'head') { const q = headQuad(LH, LH.over, R, M); if (q) { sprites.push({ at: ni, q, al }); grow(q); } }
        continue;
      }
      // the bow's string while the bow is in the far hand: drawn from the item's own tie points (the rig's mesh is for the studio)
      if (sname === 'bowstring') {
        if (item && item.bow) for (const q of stringQuads(item, 'far', R.J.slots[si][1], M, R, S.L)) { sprites.push({ at: ni, q, al }); grow(q); }
        continue;
      }
      // a weapon slot: the equipped item's own picture (unless the rig's picture is of this very item)
      if (kind && item && !(own && an.slice(an.indexOf('/') + 1) === own && R.atts[sname + '/' + an])) {
        if (kind === 'near' && fam === 'lf_rod' && S.bendS > 0.004 && !S.look) {     // (the rod bent towards the water)
          for (const q of rodQuads(item, R.J.slots[si][1], M, S.bendS)) { sprites.push({ at: ni, q, al }); grow(q); }
          S.bendUsed = S.bendS;
          continue;
        }
        const q = weaponQuad(item, kind, R.J.slots[si][1], M, fam);
        if (q) {
          sprites.push({ at: ni, q, al }); grow(q);
          if (kind === 'near' && item.bow) for (const sq of stringQuads(item, 'near', R.J.slots[si][1], M, R, S.L)) { sprites.push({ at: ni, q: sq, al }); grow(sq); }
        }
        continue;
      }
      const a = R.atts[sname + '/' + an];
      if (!a) continue;
      const W = a.w;
      for (let v = 0; v < a.n; v++) {
        let pp = a.off[v];
        const cnt = W[pp++];
        let X = 0, Y = 0;
        for (let k = 0; k < cnt; k++, pp += 4) {
          const o = W[pp] * 6, bx = W[pp + 1], by = W[pp + 2], ww = W[pp + 3];
          X += ww * (M[o] * bx + M[o + 1] * by + M[o + 4]); Y += ww * (M[o + 2] * bx + M[o + 3] * by + M[o + 5]);
        }
        const j = (a.base + v) * 2;
        P[j] = X; P[j + 1] = Y; AL[a.base + v] = al;
        if (X < minX) minX = X; if (X > maxX) maxX = X; if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
      }
      R.idx.set(a.tri, ni); ni += a.tri.length;
    }
    return { M, L, att, ni, minX, minY, maxX, maxY, sprites, name: S.cur.name };
  }

  // an item's picture on a weapon bone, laid like the rig's own weapon pictures (the build's frame, J.wf: the grip's
  // bone-local spot and the tip's angle there; near = the 'sword' bone, far = 'hand_B'), 6 rig px per game unit; the
  // shoulder rest's halves cut wf.cut rig px from the grip towards the tip (huuma: held up whole behind the head)
  const PX_PER_UNIT = 6, OVER = 6, ADD_BONES = ['sword', 'body_2'];
  // the lower body: the hips' bob and both legs (IK: the feet's targets ride the 'cha' bone, the boots turn on them)
  const LEG_BONES = ['hip', 'leg_F', 'leg_F_1', 'leg_F_2', 'IK_leg_F_2', 'foot_F', 'leg_B', 'leg_B_1', 'leg_B_2', 'IK_leg_B_2', 'foot_B'];
  // the worked-out steps (advance(), pose()), rig px: a = half the stride (each foot +-a about its place under the hip),
  // duty = the share of a foot's cycle it stands on the ground, lift = the swing's height, hip = the hips' height while
  // stepping (down from the setup: the reach for the stride), bob = how much they dip with each step, maxCycle = the most
  // steps (per foot) a second - faster than that the feet would blur, and slide a little instead
  const GAIT = { a: 80, duty: 0.6, lift: 22, hip: -26, bob: 5, maxCycle: 4.5 };
  // [the foot's IK target, the boot, its place across from the setup (the near foot a little back, the far one ahead), phase]
  const GAIT_FEET = [['IK_leg_F_2', 'foot_F', -4, 0], ['IK_leg_B_2', 'foot_B', 4, 0.5]];
  // a planted foot further from its hip joint than the leg reaches would leave the boot off the shin: the hips come down
  // just enough (for the leg that needs it most)
  // the phase that keeps the near foot where it stands now (last frame's pose): the steps start without a slide
  function gaitFrom(R, S) {
    const L = S.L; if (!L) return 0;
    const it = bi(R, GAIT_FEET[0][0]), x = L.x[it] - R.sx[it] - GAIT_FEET[0][2];
    return Math.max(0, Math.min(GAIT.duty * 0.95, ((GAIT.a - x) * GAIT.duty) / (2 * GAIT.a)));
  }
  function reachDrop(R, L, M) {
    let drop = 0;
    for (const [j, l2, tg] of [['leg_F', 'leg_F_2', 'IK_leg_F_2'], ['leg_B', 'leg_B_2', 'IK_leg_B_2']]) {
      const o = bi(R, j) * 6, t = bi(R, tg) * 6, k2 = bi(R, l2), reach = (Math.hypot(R.sx[k2], R.sy[k2]) + R.len[k2]) * 0.985;
      const dx = M[t + 4] - M[o + 4], dy = M[o + 5] - M[t + 5];
      if (Math.abs(dx) >= reach) continue;
      drop = Math.max(drop, dy - Math.sqrt(reach * reach - dx * dx));
    }
    if (drop <= 0) return;
    const hi = bi(R, 'hip'), ci = bi(R, 'cha');
    L.y[hi] -= drop / Math.max(0.5, Math.hypot(M[ci * 6 + 1], M[ci * 6 + 3]));
    world(R, L, M, hi);
  }
  // a fishing rod bent towards the water (the user, 2026-10-17: "ทำรายละเอียดตรงนี้ด้วยสิ"): its picture in slices from the
  // grip to the tip along a curve that turns more towards the tip (bend: the tip's turn, radians, clockwise = down to the
  // line); the butt below the grip stays straight. rodBend(len, bend) -> the curve at the slice ends: [along, across, turn]
  const ROD_N = 10;
  function rodBend(len, bend) {
    const out = [[0, 0, 0]], K = ROD_N * 4, ds = len / K;
    let al = 0, ac = 0;
    for (let k = 1; k <= K; k++) {
      const ph = bend * Math.pow((k - 0.5) / K, 2);
      al += Math.cos(ph) * ds; ac += Math.sin(ph) * ds;
      if (k % 4 === 0) out.push([al, ac, bend * Math.pow(k / K, 2)]);
    }
    return out;
  }
  function rodQuads(W, bone, M, bend) {
    const f = DATA.hero.wf.near, spr = NC.SPR[W.sprite || W.id];
    if (!spr || !spr.img || !spr.w || !spr.h || spr.ready === false) return []; // (ready false: still streaming in, js/assets.js)
    const Wd = spr.w * PX_PER_UNIT, Ht = spr.h * PX_PER_UNIT, gx = (spr.ax == null ? 0.5 : spr.ax) * Wd, gy = Ht * (1 - (W.grip == null ? 0.2 : W.grip));
    const o = bone * 6, th = f.tip * D2R, Vx = Math.cos(th), Vy = Math.sin(th), Ux = Math.sin(th), Uy = -Math.cos(th);
    const toW = (X, Y) => [M[o] * X + M[o + 1] * Y + M[o + 4], M[o + 2] * X + M[o + 3] * Y + M[o + 5]];
    // a point of the curve [along, across, turn] + the picture's u -> the rig (the cross axis turned with the curve)
    const at = (c, u) => {
      const du = u - gx, cp = Math.cos(c[2]), sp = Math.sin(c[2]);
      const ux = -sp * Vx + cp * Ux, uy = -sp * Vy + cp * Uy;
      return toW(f.grip[0] + c[0] * Vx + c[1] * Ux + du * ux, f.grip[1] + c[0] * Vy + c[1] * Uy + du * uy);
    };
    const C = rodBend(gy, bend), out = [], quad = (A, B, va, vb) => {
      const p0 = at(A, 0), p1 = at(A, Wd), p2 = at(B, Wd), p3 = at(B, 0);
      out.push({ name: W.sprite || W.id, img: spr.img, pos: new Float32Array([p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]]),
        uv: new Float32Array([0, va / Ht, 1, va / Ht, 1, vb / Ht, 0, vb / Ht]) });
    };
    for (let i = 0; i < ROD_N; i++) quad(C[i + 1], C[i], gy - (gy * (i + 1)) / ROD_N, gy - (gy * i) / ROD_N);   // (tip side first)
    quad([0, 0, 0], [-(Ht - gy), 0, 0], gy, Ht);                                                                // (the butt)
    return out;
  }
  function weaponQuad(W, kind, bone, M, fam) {
    const WF = DATA.hero.wf, f = kind === 'far' ? WF.far : WF.near;
    const name = W.sprite || W.id, spr = NC.SPR[name], man = spr;      // (the sprite carries its manifest's w, h, ax)
    if (!spr || !spr.img || !spr.w || !spr.h || !(spr.img.naturalWidth || spr.img.width) || spr.ready === false) return null; // (ready false: still streaming in, js/assets.js)
    const Wd = man.w * PX_PER_UNIT, Ht = man.h * PX_PER_UNIT, gx = (man.ax == null ? 0.5 : man.ax) * Wd, gy = Ht * (1 - (W.grip == null ? 0.2 : W.grip));
    let v0 = 0, v1 = Ht;                                   // (rig px down the picture)
    const cut = (WF.cuts && WF.cuts[fam]) || WF.cut;                 // (a twin sword is cut just past its guard)
    if (kind === 'back' && WF.whole.indexOf(fam) < 0) v1 = Math.min(Ht, gy - cut + OVER);
    if (kind === 'front') v0 = Math.max(0, gy - cut);
    if (v1 <= v0) return null;
    const o = bone * 6, a = M[o], b = M[o + 1], c = M[o + 2], d = M[o + 3], tx = M[o + 4], ty = M[o + 5];
    const pos = new Float32Array(8), uv = new Float32Array(8), corners = [[0, v0], [Wd, v0], [Wd, v1], [0, v1]];
    const th = f.tip * D2R, cs = Math.sin(th), sn = -Math.cos(th);         // (turned by tip - 90: the picture's up -> the tip)
    corners.forEach(([u, v], k) => {
      const du = u - gx, up = gy - v;
      const X = f.grip[0] + du * cs - up * sn, Y = f.grip[1] + du * sn + up * cs;
      pos[k * 2] = a * X + b * Y + tx; pos[k * 2 + 1] = c * X + d * Y + ty;
      uv[k * 2] = u / Wd; uv[k * 2 + 1] = v / Ht;
    });
    return { name, img: spr.img, pos, uv };
  }
  // a bow's string: from its top tie to its bottom tie (W.bow: x, top, bottom, fractions of its picture), laid like its
  // picture (weaponQuad's mapping); in the far hand its middle is drawn to the nock bone by the pull (the nock's scaleY - 1).
  // Quads of the atlas's string strip (dark, cream, dark), 20 rig px wide
  function stringQuads(W, kind, bone, M, R, L) {
    const spr = NC.SPR[W.sprite || W.id], b = W.bow, sa = R.atts['bowstring/' + 'SW/bowstring'];
    if (!spr || !spr.w || !b || !sa) return [];
    const WF = DATA.hero.wf, f = kind === 'far' ? WF.far : WF.near;
    const Wd = spr.w * PX_PER_UNIT, Ht = spr.h * PX_PER_UNIT, gx = (spr.ax == null ? 0.5 : spr.ax) * Wd, gy = Ht * (1 - (W.grip == null ? 0.2 : W.grip));
    const th = f.tip * D2R, cs = Math.sin(th), sn = -Math.cos(th), o = bone * 6;
    const toW = (u, v) => {
      const du = u - gx, up = gy - v, X = f.grip[0] + du * cs - up * sn, Y = f.grip[1] + du * sn + up * cs;
      return [M[o] * X + M[o + 1] * Y + M[o + 4], M[o + 2] * X + M[o + 3] * Y + M[o + 5]];
    };
    const top = toW(b.x * Wd, b.top * Ht), bot = toW(b.x * Wd, b.bottom * Ht);
    let mid = null;
    if (kind === 'far') {
      if (R.nockI == null) R.nockI = R.name.indexOf('nock');
      const k = R.nockI, pull = k >= 0 && L ? Math.max(0, Math.min(1, L.ky[k] - 1)) : 0;
      if (pull > 0.01) { const cx = (top[0] + bot[0]) / 2, cy = (top[1] + bot[1]) / 2; mid = [cx + (M[k * 6 + 4] - cx) * pull, cy + (M[k * 6 + 5] - cy) * pull]; }
    }
    const uv = sa.uv, u0 = uv[0], u1 = uv[2], va = uv[1], vb = uv[7];
    const seg = (A, B) => {
      let dx = B[0] - A[0], dy = B[1] - A[1]; const d = Math.hypot(dx, dy) || 1; dx = (-dy / d) * 10; dy = ((B[0] - A[0]) / d) * 10;
      return { tex: 'atlas', pos: new Float32Array([A[0] - dx, A[1] - dy, A[0] + dx, A[1] + dy, B[0] + dx, B[1] + dy, B[0] - dx, B[1] - dy]),
        uv: new Float32Array([u0, va, u1, va, u1, vb, u0, vb]) };
    };
    return mid ? [seg(top, mid), seg(mid, bot)] : [seg(top, bot)];
  }
  const spriteTex = new Map();
  function spriteTexture(name, img) {
    let t = spriteTex.get(name);
    if (t) return t;
    t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    spriteTex.set(name, t);
    return t;
  }

  // ---------------- WebGL: the meshes into a canvas ----------------
  let glc = null, gl = null, prog = null, U = {}, failed = false, vbo = null, ubo = null, abo = null, ibo = null, tex = null;
  let qv = null, qu = null, qa = null, qi = null;                  // (a weapon picture's quad)
  const VS = `#version 300 es
in vec2 a_pos; in vec2 a_uv; in float a_alpha; uniform vec4 u_box; out vec2 v_uv; out float v_a;
void main() { gl_Position = vec4((a_pos.x - u_box.x) / u_box.z * 2.0 - 1.0, (a_pos.y - u_box.y) / u_box.w * 2.0 - 1.0, 0.0, 1.0); v_uv = a_uv; v_a = a_alpha; }`;
  const FS = `#version 300 es
precision mediump float;
in vec2 v_uv; in float v_a; uniform sampler2D u_tex; uniform vec3 u_tint; uniform float u_tintK; out vec4 o;
void main() { vec4 c = texture(u_tex, v_uv); c.rgb = mix(c.rgb, u_tint * c.a, u_tintK); o = c * v_a; }`;
  let lostN = 0;
  function init() {
    // (the browser dropped the GL context - a GPU reset, a long-hidden tab: everything drawn through it came out empty and
    // the hero vanished. A new context then, or after a few losses the old drawing)
    if (gl && gl.isContextLost()) { gl = null; tex = null; spriteTex.clear(); failed = ++lostN > 3; }
    if (gl || failed) return !!gl;
    try {
      glc = document.createElement('canvas'); glc.width = 512; glc.height = 512;
      gl = glc.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: true });
      if (!gl) throw new Error('no webgl2');
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      for (const k of ['box', 'tex', 'tint', 'tintK']) U[k] = gl.getUniformLocation(prog, 'u_' + k);
      U.pos = gl.getAttribLocation(prog, 'a_pos'); U.uv = gl.getAttribLocation(prog, 'a_uv'); U.alpha = gl.getAttribLocation(prog, 'a_alpha');
      gl.uniform1i(U.tex, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      vbo = gl.createBuffer(); ubo = gl.createBuffer(); abo = gl.createBuffer(); ibo = gl.createBuffer();
      qv = gl.createBuffer(); qu = gl.createBuffer(); qa = gl.createBuffer(); qi = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, qi); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
      return true;
    } catch (err) {
      failed = true; gl = null;
      console.warn('herospine: off', err && err.message);
      return false;
    }
  }
  function texture(R) {
    if (tex) return tex;
    const s = NC.SPR[R.J.page];
    if (!s || !s.img || !s.img.naturalWidth) return null;
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s.img);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindBuffer(gl.ARRAY_BUFFER, ubo); gl.bufferData(gl.ARRAY_BUFFER, R.uv, gl.STATIC_DRAW);
    return tex;
  }
  const hexRgb = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

  // ---------------- which heroes ----------------
  const LOOK = { top: 'top_traveler', pants: 'pants_traveler' };
  // (the hair: the rig's own spiky head, or a head made in the creator: look.js's pictures on the rig's head bone)
  const hairFits = (equip) => equip.hair === 'hair_spiky' || (HS.lookHead && !!lookHeadOf(equip));
  const BARE = ['hat', 'glasses', 'cape', 'robe', 'shield', 'fhat', 'frobe'];
  // (any weapon: its type picks the holds, its own picture is drawn; empty-handed keeps the old drawing)
  const fitsLook = (equip) => (HS.force && !HS.look) || (Object.entries(LOOK).every(([k, v]) => equip[k] === v) && hairFits(equip) && BARE.every((k) => !equip[k]));
  HS.fits = (equip) => !!equip.weapon && !!NC.ITEMS[equip.weapon] && fitsLook(equip);
  HS.famOf = famOf;

  // the rig's meshes (and weapon pictures) of a frame into the GL canvas, then onto ctx with his feet at (x, y)
  function blit(ctx, R, t, F, x, y, k, flip, o) {
    // (the WebGL2 screen, js/gl2d_mesh.js: the meshes straight into the screen's batch; a plain 2D canvas keeps the way below)
    if (!HS.debug && NC.GL2D && NC.GL2D.rig && NC.GL2D.rig.on && NC.GL2D.rig.hero(ctx, R, F, x, y, k, flip, o)) return;
    // render at about twice the size it shows on screen (sharp after the scale-down, cheap)
    const m = ctx.getTransform(), zoom = Math.hypot(m.a, m.b) || 1, rs = Math.max(0.12, Math.min(1, k * zoom * 2));
    const x0 = Math.floor(F.minX) - PAD, y0 = Math.floor(F.minY) - PAD, BW = Math.ceil(F.maxX) + PAD - x0, BH = Math.ceil(F.maxY) + PAD - y0;
    const RW = Math.min(2048, Math.ceil(BW * rs)), RH = Math.min(2048, Math.ceil(BH * rs));
    if (RW > glc.width || RH > glc.height) { glc.width = Math.max(glc.width, RW); glc.height = Math.max(glc.height, RH); }
    gl.viewport(0, glc.height - RH, RW, RH);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform4f(U.box, x0, y0, BW, BH);
    const tint = o.tint && o.tint[1] > 0 ? o.tint : null, tc = tint ? hexRgb(tint[0]) : [0, 0, 0];
    gl.uniform3f(U.tint, tc[0], tc[1], tc[2]); gl.uniform1f(U.tintK, tint ? Math.min(1, tint[1]) : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, R.pos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, abo); gl.bufferData(gl.ARRAY_BUFFER, R.alpha, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, R.idx.subarray(0, F.ni), gl.DYNAMIC_DRAW);
    const meshes = (from, to) => {                       // the rig's meshes, indices [from, to)
      if (to <= from) return;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.enableVertexAttribArray(U.pos); gl.vertexAttribPointer(U.pos, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, ubo); gl.enableVertexAttribArray(U.uv); gl.vertexAttribPointer(U.uv, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, abo); gl.enableVertexAttribArray(U.alpha); gl.vertexAttribPointer(U.alpha, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.drawElements(gl.TRIANGLES, to - from, gl.UNSIGNED_SHORT, from * 2);
    };
    let from = 0;
    for (const sp of F.sprites) {                         // a weapon picture where its slot is in the draw order
      meshes(from, sp.at); from = sp.at;
      gl.bindTexture(gl.TEXTURE_2D, sp.q.tex === 'atlas' ? t : spriteTexture(sp.q.name, sp.q.img));
      gl.bindBuffer(gl.ARRAY_BUFFER, qv); gl.bufferData(gl.ARRAY_BUFFER, sp.q.pos, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(U.pos); gl.vertexAttribPointer(U.pos, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, qu); gl.bufferData(gl.ARRAY_BUFFER, sp.q.uv, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(U.uv); gl.vertexAttribPointer(U.uv, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, qa); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([sp.al, sp.al, sp.al, sp.al]), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(U.alpha); gl.vertexAttribPointer(U.alpha, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, qi);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }
    meshes(from, F.ni);
    // Spine (y up, the root at his feet) -> the game (y down)
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.drawImage(glc, 0, 0, RW, RH, x0 * k, -(y0 + BH) * k, BW * k, BH * k);
    if (HS.debug) {
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffd400';
      for (let i = 0; i < R.nb; i++) {
        const q = i * 6, X = F.M[q + 4], Y = F.M[q + 5], Ln = R.len[i];
        ctx.beginPath(); ctx.moveTo(X * k, -Y * k); ctx.lineTo((X + F.M[q] * Ln) * k, -(Y + F.M[q + 2] * Ln) * k); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // the player's hero, drawn at (x, y) = his feet, facing p.face; false when it can't (then the old drawing)
  HS.draw = function (ctx, p, x, y, o) {
    if (!HS.on || !init()) return false;
    const R = rig(), t = texture(R);
    if (!t) return false;
    const S = state(p), game = NC.game, now = game ? game.time : performance.now() / 1000;
    const dt = S.last == null ? 0 : Math.max(0, Math.min(0.1, now - S.last));
    S.last = now;
    const flip = (p.face || 1) < 0, k = SCALE * (o.scale || 1);
    const mvx = (p.x - S.lx) / k * (flip ? -1 : 1);
    if (!advance(p, S, dt, R)) { S.lx = p.x; S.ly = p.y; return false; }
    S.look = false;
    const F = pose(p, S, dt, R, mvx, o.noFx ? 'noFx' : null);
    S.lx = p.x; S.ly = p.y; S.drawnAt = now; S.flip = flip;
    { const m0 = ctx.getTransform(); S.screen = [m0.a * x + m0.c * y + m0.e, m0.b * x + m0.d * y + m0.f, Math.hypot(m0.a, m0.b)]; }   // (tests: where his feet are on the canvas)
    blit(ctx, R, t, F, x, y, k, flip, o);
    return true;
  };

  // ---------------- every other look: the rig moves the game's own cut-out hero ----------------
  // (2026-10-17, the user: "ทำสองข้อเลย" - the outfits, hats and hair.) The cut-out hero (avatar.js) stands on the very
  // joints this rig was built from (6 rig px a unit: pelvis -> neck, the shoulders, the elbow at 0.45 and the knee at 0.47
  // of the limb, the legs tucked 9 u), so each frame the rig's bones are read back as the cut-out's pose (anim.js's
  // channels: lean, breathe, head, aF/eF, aB/eB, legF/kF, legB/kB, wAng, wLen, wFar, pull, wz, rot, sq, turn, x, y) and the
  // game draws every outfit, robe, onesie, hat, hood, hair, pair of glasses, cape and tail itself, moving as the rig
  // moves; the rig's painted slashes go behind him. ?herolook=0: those looks keep the old drawing
  const bix = {};
  const bi = (R, n) => (bix[n] != null ? bix[n] : (bix[n] = R.name.indexOf(n)));
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // the bones in the cut-out's frame: game units, y down, in the 'cha' bone's frame (its turn, squash and flip are the
  // cut-out's own rot, sq and turn)
  function readBones(R, M) {
    const c = bi(R, 'cha') * 6, a = M[c], b = M[c + 1], cc = M[c + 2], d = M[c + 3], tx = M[c + 4], ty = M[c + 5];
    const det = a * d - b * cc || 1, ia = d / det, ib = -b / det, ic = -cc / det, id = a / det;
    const pt = (X, Y) => { const dx = X - tx, dy = Y - ty; return [(ia * dx + ib * dy) / 6, -(ic * dx + id * dy) / 6]; };
    const vec = (X, Y) => [ia * X + ib * Y, -(ic * X + id * Y)];
    const org = (n) => { const o = bi(R, n) * 6; return pt(M[o + 4], M[o + 5]); };
    const tip = (n) => { const i = bi(R, n), o = i * 6, l = R.len[i]; return pt(M[o + 4] + M[o] * l, M[o + 5] + M[o + 2] * l); };
    const xa = (n) => { const o = bi(R, n) * 6, v = vec(M[o], M[o + 2]); return Math.atan2(v[1], v[0]); };
    const xl = (n) => { const o = bi(R, n) * 6, v = vec(M[o], M[o + 2]); return Math.hypot(v[0], v[1]); };
    const ya = (n) => { const o = bi(R, n) * 6, v = vec(M[o + 1], M[o + 3]); return Math.atan2(v[1], v[0]); };
    return { pel: org('hip'), neck: org('head'), head: xa('head'), aF1: xa('arm_F_1'), aF2: xa('arm_F_2'), aB1: xa('arm_B_1'), aB2: xa('arm_B_2'),
      lF1: xa('leg_F_1'), lF2: xa('leg_F_2'), lB1: xa('leg_B_1'), lB2: xa('leg_B_2'), sw: xa('sword'), swLen: xl('sword'), far: ya('hand_B'),
      shF: org('arm_F_1'), handF: tip('arm_F_2'), shB: org('arm_B_1'), handB: tip('arm_B_2') };
  }
  // the setup pose = the pieces as drawn (the cut-out's pose with every channel at rest)
  let REST = null;
  function restBones(R) {
    if (REST) return REST;
    const n = R.nb, M = new Float32Array(n * 6), one = new Float32Array(n).fill(1);
    world(R, { r: R.sr, x: R.sx, y: R.sy, kx: one, ky: one }, M);
    const Z = readBones(R, M);
    Z.restF = Math.atan2(Z.handF[1] - Z.shF[1], Z.handF[0] - Z.shF[0]);
    Z.restB = Math.atan2(Z.handB[1] - Z.shB[1], Z.handB[0] - Z.shB[0]);
    Z.headR = rotW(M, bi(R, 'head'));                           // (the head bone's turn in the setup pose: the pictures stand upright)
    return (REST = Z);
  }
  let SLOTI = null;
  const turnX = (T) => { if (!T) return 1; const c = Math.cos(T); return (c < 0 ? -1 : 1) * (0.3 + 0.7 * Math.pow(Math.abs(c), 0.6)); };
  // the rig's frame -> the cut-out's pose (a copy of the game's own, so the hat spring, the face and the rest carry on)
  function lookPose(p, equip, R, F, S) {
    const Z = restBones(R), Q = readBones(R, F.M), L = F.L, P = Object.assign({}, p.pose);
    const d = (k) => wrapA(Q[k] - Z[k]);
    const v0 = [Z.neck[0] - Z.pel[0], Z.neck[1] - Z.pel[1]], v1 = [Q.neck[0] - Q.pel[0], Q.neck[1] - Q.pel[1]];
    P.lean = wrapA(Math.atan2(v1[1], v1[0]) - Math.atan2(v0[1], v0[0]));
    P.breathe = Math.hypot(v1[0], v1[1]) / (Math.hypot(v0[0], v0[1]) || 1);
    P.head = d('head') - 0.45 * P.lean; P.headY = 0;
    // (the cut-out turns a limb picture by its shoulder -> hand line, then flexes it at the elbow; the leg by its thigh)
    P.aF = Z.restF + d('aF1'); P.eF = d('aF1') - d('aF2');
    P.aB = Z.restB + d('aB1'); P.eB = d('aB1') - d('aB2');
    P.legF = -d('lF1'); P.kF = d('lF2') - d('lF1');
    P.legB = -d('lB1'); P.kB = d('lB2') - d('lB1');
    // the weapon: in the near hand along the 'sword' bone; a bow drawn in the far hand along hand_B's tip (+90 deg)
    if (!SLOTI) { SLOTI = {}; R.J.slots.forEach((sl, i) => { SLOTI[sl[0]] = i; }); }
    const at = (n) => SLOTI[n] != null && F.att[SLOTI[n]];
    const near = at('sword') || at('sword_back') || at('sword_front'), farOnly = !near && at('weapon_B');
    P.wFar = farOnly ? 1 : 0;
    P.wAng = farOnly ? Q.far : Q.sw;
    P.wLen = farOnly ? 1 : Math.max(0.15, Math.min(1.2, Q.swLen / (Z.swLen || 1)));
    P.wz = !at('sword') && at('sword_back') ? 1 : 0;           // (up over his shoulder: behind the head)
    if (/^lf_/.test(F.name) && !near && !at('weapon_B')) P.wHide = 1;   // (a life move with nothing in his hands: planting, the catch held up)
    // (the second of a pair - twin pistols, daggers, katars - in the far fist: the rig's far weapon angle, avatar.js's P.w2a)
    const Wi = NC.ITEMS[equip.weapon];
    if (Wi && Wi.dual && !farOnly && at('weapon_B')) P.w2a = Q.far; else delete P.w2a;
    const nk = bi(R, 'nock');
    P.pull = farOnly && nk >= 0 ? Math.max(0, Math.min(1, L.ky[nk] - 1)) : 0;
    P.wPush = 0; P.gAdj = 0; P.tuck = 0; P.wBehind = 0; P.wSheath = 0; P.ik = 0; P.hk = 0; P.bk = 0; P.plant = 0; P.aBack = 0;
    P.act = 1;                                                  // (the cut-out's grip rule lets go: the rig has posed the wrist)
    // the whole body: the 'cha' bone's turn, squash and flip
    const ci = bi(R, 'cha'), sq = L.ky[ci] || 1, sxq = 1 + (1 - sq) * 0.6, fl = L.kx[ci] / sxq;
    P.rot = -L.r[ci] * D2R; P.sq = sq; P.turn = fl >= 0.999 ? 0 : Math.acos(Math.max(-1, Math.min(1, fl)));
    // the pelvis where the rig has it: the cut-out turns / squashes round his feet and stands the lower foot on the ground
    const h = bi(R, 'hip') * 6, Wx = F.M[h + 4] / 6, Wy = -F.M[h + 5] / 6, tX = turnX(P.turn) || 1;
    const ux = Wx / tX, cr = Math.cos(-P.rot), sr = Math.sin(-P.rot), vx = ux * cr - Wy * sr, vy = ux * sr + Wy * cr;
    // standing still, the game draws its standing legs (js/idlefeet.js: the front foot turned toward us, the back one half
    // turned), pictures made for its own idle: they keep the game's leg angles and stance; the rig moves the rest (the user,
    // 2026-10-17: "ทำไมตัวละคร ปกติมันยืน ขาแปลกๆ idle" - the rig's straight legs turned those pictures into two posts)
    if (NC.heroStanding && NC.heroStanding() && S && S.cur && looping(S.cur.name) && !/walk|run|dash/.test(S.cur.name) && p.pose) {
      P.legF = p.pose.legF; P.kF = p.pose.kF; P.legB = p.pose.legB; P.kB = p.pose.kB; P.x = p.pose.x || 0; P.y = p.pose.y || 0;
      return P;
    }
    P.x = 0; P.y = 0;
    const E = NC.lookEquip ? NC.lookEquip(equip) || equip : equip, A = NC.rigAnchors && NC.rigAnchors(E, P);
    P.x = vx / sxq; P.y = vy / sq - (A ? A.pel[1] : -Q.pel[1]);
    return P;
  }

  // ---------------- the creator's head (look.js) on the rig's head bone ----------------
  // (2026-10-17, the user: "ทำหัวจากหน้าสร้างตัวละคร (ผม ตา ปาก) เข้าริกใหม่เลย") look.js bakes a look into two pictures at
  // 6 px a unit, the rig's own scale: <head>_u (the back hair: drawn behind everything) and <head>_o (the head, the eyes,
  // the mouth and the front hair). They ride the 'head' bone, laid by their neck joint on the bone's root the way the rig's
  // own head picture lies in the setup pose; the rig's head mesh and its face patch step aside. ?herohead=0: off
  const lookHeadOf = (equip) => {
    const h = equip && NC.ITEMS[equip.hair], s = h && h.head && NC.SPR[h.head];
    return s && s.under && s.over && s.joints && s.joints.neck ? s : null;
  };
  function headQuad(S0, sp, R, M) {
    const img = sp && sp.img;
    if (!img || !img.width || !img.height || sp.ready === false) return null;
    const Z = restBones(R), o = bi(R, 'head') * 6, px = (NC.LOOK_FRAME && NC.LOOK_FRAME.scale) || 6;
    const W = img.width, H = img.height, nx = S0.joints.neck[0] * px, ny = S0.joints.neck[1] * px;
    const c0 = Math.cos(-Z.headR), s0 = Math.sin(-Z.headR), a = M[o], b = M[o + 1], c = M[o + 2], d = M[o + 3], tx = M[o + 4], ty = M[o + 5];
    const pos = new Float32Array(8), uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    [[0, 0], [W, 0], [W, H], [0, H]].forEach(([u, v], k) => {
      const X0 = u - nx, Y0 = ny - v, X = X0 * c0 - Y0 * s0, Y = X0 * s0 + Y0 * c0;     // (picture px -> the bone's frame)
      pos[k * 2] = a * X + b * Y + tx; pos[k * 2 + 1] = c * X + d * Y + ty;
    });
    // (the name carries the look: a new look is a new texture)
    return { name: sp.name + ':' + (S0.look || ''), img, pos, uv };
  }
  const FXONLY = { fx: 1 }, NO_PARTS = Object.freeze({});
  // the cut-out hero in the rig's moves: false when it can't (then the old drawing, the game's own moves)
  HS.drawLook = function (ctx, p, equip, x, y, o) {
    if (!HS.on || !HS.look || !init()) return false;
    const R = rig(), t = texture(R);
    if (!t) return false;
    const S = state(p), game = NC.game, now = game ? game.time : performance.now() / 1000;
    const dt = S.last == null ? 0 : Math.max(0, Math.min(0.1, now - S.last));
    S.last = now;
    const flip = (p.face || 1) < 0, k = SCALE * (o.scale || 1);
    const mvx = (p.x - S.lx) / k * (flip ? -1 : 1);
    if (!advance(p, S, dt, R)) { S.lx = p.x; S.ly = p.y; return false; }
    S.look = true;                                              // (the cut-out draws its own straight rod)
    const F = pose(p, S, dt, R, mvx, o.noFx ? NO_PARTS : FXONLY);
    S.lx = p.x; S.ly = p.y; S.drawnAt = now; S.flip = flip;
    { const m0 = ctx.getTransform(); S.screen = [m0.a * x + m0.c * y + m0.e, m0.b * x + m0.d * y + m0.f, Math.hypot(m0.a, m0.b)]; }
    if (F.ni > 0) blit(ctx, R, t, F, x, y, k, flip, o);         // (the slashes: behind him)
    const P = lookPose(p, equip, R, F, S);
    S.lookP = P;                                                // (tests: the pose the cut-out got)
    baseDH.call(this, ctx, equip, P, x, y, Object.assign({}, o, { scale: (o.scale || 1) * LOOK_K }));
    return true;
  };
  // (the hat fitting page, studio/hats.js - the user, 2026-10-17: "อันนี้คือจัดหมวกด้วย rig ใหม่นะ") any look in one of the
  // rig's moves at time t, the way the game draws a hero wearing a hat (the cut-out in the rig's moves), not tied to a
  // player: his feet at (x, y), o.face 1 / -1. A standing move keeps the game's own standing legs, as in the game.
  const AT = {};
  HS.lookK = LOOK_K;                                            // (the cut-out's size in the rig's moves, x its own)
  HS.lookAt = function (ctx, equip, clip, t, x, y, o) {
    o = o || {};
    if (!init()) return false;
    const R = rig(), tx = texture(R), A = R.anims[clip];
    if (!tx || !A) return false;
    const face = o.face || 1, loop = looping(clip), base = NC.Anim.sample('idle', loop ? t % 3.2 : 0, NC.animCtx(equip));
    base.face = face;
    const p = { equip, pose: base, face, x: 0, y: 0 };
    const S = AT[clip] || (AT[clip] = { hit: -1, phys: null, acc: 0 });
    S.cur = { name: clip, t: loop ? ((t % A.d) + A.d) % A.d : Math.max(0, Math.min(A.d, t)) }; S.prev = null; S.hit = -1;
    const F = pose(p, S, 0, R, 0, o.noFx ? NO_PARTS : FXONLY), k = SCALE * (o.scale || 1);
    if (F.ni > 0 && !o.noFx) blit(ctx, R, tx, F, x, y, k, face < 0, o);
    const P = lookPose(p, equip, R, F, null);
    if (/(^|_)(idle|ready)$/.test(clip)) { P.legF = base.legF; P.kF = base.kF; P.legB = base.legB; P.kB = base.kB; P.x = base.x || 0; P.y = base.y || 0; }
    P.face = face;
    baseDH.call(this, ctx, equip, P, x, y, Object.assign({}, o, { scale: (o.scale || 1) * LOOK_K }));
    return true;
  };
  // (the same page) the moves to look at with this weapon: stand, walk, run, its three attacks, sit
  HS.moves = function (equip) {
    const R = rig(), p = { equip }, f = famOf(p);
    const out = [['ยืน', clipFor('idle', p, R)], ['เดิน', clipFor('walk', p, R)], ['วิ่ง', clipFor('run', p, R)]];
    (f === 'sword' ? ['sword1', 'sword2', 'sword4'] : [1, 2, 3].map((n) => f + '_atk' + n)).forEach((c, i) => out.push(['ตี ' + (i + 1), c]));
    out.push(['นั่ง', 'sit']);
    return out.filter(([, c]) => R.anims[c]).map(([label, clip]) => ({ label, clip, d: R.anims[clip].d, loop: looping(clip) }));
  };
  // where his weapon is while the rig draws him (the game's NC.weaponLine: shots, skills and sparks start at its tip):
  // the weapon bone of the last frame, the equipped item's grip and length (the far gun's while pistol_atk2 fires it)
  // (W: the item asked about - life_fish.js asks for the rod's tip with a copy of his gear, the line starting there)
  HS.weaponLine = function (p, x, y, scale, W) {
    const S = p._hspine, game = NC.game;
    W = W || weaponOf(p);
    if (!S || !S.cur || !S.M || S.drawnAt == null || !game || game.time - S.drawnAt > 0.1 || !W) return null;
    const bend = !S.look && /^t_rod/.test(W.sprite || '') ? S.bendUsed || 0 : 0;    // (a bent rod: the line leaves its bent tip)
    return lineOf(S.M, W, HITS[S.cur.name], x, y, SCALE * (scale || 1), S.flip ? -1 : 1, bend);
  };
  function lineOf(M, W, A, x, y, k, sg, bend) {
    const spr = NC.SPR[W.sprite || W.id];
    if (!spr || !spr.h) return null;
    const R = rig(), WF = DATA.hero.wf, f = A && A.muzzle === 'far' ? WF.far : WF.near;
    const o = R.name.indexOf(f.bone) * 6, th = f.tip * D2R;
    const len = spr.h * PX_PER_UNIT * (1 - (W.grip == null ? 0.2 : W.grip));      // (the grip to the tip, rig px)
    const at = (d) => {
      let al = d, ac = 0;
      if (bend > 0.004 && d > 0) { const C = rodBend(d, bend * Math.pow(d / len, 2)), c = C[C.length - 1]; al = c[0]; ac = c[1]; }
      const X = f.grip[0] + al * Math.cos(th) + ac * Math.sin(th), Y = f.grip[1] + al * Math.sin(th) - ac * Math.cos(th);
      return [x + sg * (M[o] * X + M[o + 1] * Y + M[o + 4]) * k, y - (M[o + 2] * X + M[o + 3] * Y + M[o + 5]) * k];
    };
    return { hand: at(0), base: at(len * 0.3), tip: at(len * 0.98) };
  }
  // where his hands are while the rig draws him (life_fish.js holds the catch between them: NC.rigJoints' haN / haF):
  // the near fist (the weapon bone's root, the grip) and the far fist (hand_B)
  function handsOf(M, x, y, k, sg) {
    const R = rig(), at = (n) => { const o = bi(R, n) * 6; return [x + sg * M[o + 4] * k, y - M[o + 5] * k]; };
    return { haN: at('sword'), haF: at('hand_B') };
  }
  HS.hands = function (p, x, y, scale) {
    const S = p._hspine, game = NC.game;
    if (!S || !S.cur || !S.M || S.drawnAt == null || !game || game.time - S.drawnAt > 0.1) return null;
    return handsOf(S.M, x, y, SCALE * (scale || 1), S.flip ? -1 : 1);
  };
  const baseWL = NC.weaponLine;
  if (baseWL) NC.weaponLine = function (equip, P, x, y, scale) {
    const g = NC.game, p = g && g.player;
    // (his own gear, or a copy of it with the same pose - the fishing line asks with the rod put in)
    if (HS.on && p && (equip === p.equip || (P && P === p.pose))) { const L = HS.weaponLine(p, x, y, scale, NC.ITEMS[equip.weapon]); if (L) return L; }
    return baseWL.apply(this, arguments);
  };
  const baseRJ = NC.rigJoints;
  if (baseRJ) NC.rigJoints = function (equip, P, x, y, scale) {
    const J = baseRJ.apply(this, arguments), g = NC.game, p = g && g.player;
    if (J && HS.on && p && P && P === p.pose) { const H = HS.hands(p, x, y, scale); if (H) Object.assign(J, H); }
    return J;
  };
  // (tests, proof sheets) the full rig art in a clip at time t (any gear: a tool is drawn from its sprite), his feet at
  // (x, y); o.face, o.scale, o.pose (wHide...). -> { hands, line } where his hands and the held item's line are
  HS.drawAt = function (ctx, equip, clip, t, x, y, o) {
    o = o || {};
    if (!init()) return null;
    const R = rig(), tx = texture(R), A = R.anims[clip];
    if (!tx || !A) return null;
    const face = o.face || 1, p = { equip, pose: o.pose || {}, face, x: 0, y: 0 };
    const S = { hit: -1, phys: null, acc: 0, cur: { name: clip, t: Math.max(0, Math.min(A.d, t)) }, prev: null, bend: o.bend || 0, add: o.add || null };
    const F = pose(p, S, 0, R, 0, o.noFx ? 'noFx' : null), k = SCALE * (o.scale || 1), W = weaponOf(p);
    blit(ctx, R, tx, F, x, y, k, face < 0, o);
    return { hands: handsOf(F.M, x, y, k, face < 0 ? -1 : 1), line: W ? lineOf(F.M, W, HITS[clip], x, y, k, face < 0 ? -1 : 1, famOf(p) === 'lf_rod' ? S.bendUsed : 0) : null, d: A.d };
  };
  // ---------------- the hero in the windows ----------------
  // (2026-10-18, the user: "หน้าแต่งตัวตัวละครยังเป็นกระดูกเก่านะ") every page that shows the hero standing - the bag, the
  // status page, the menu, the creator, the job cards, the stall, the gacha banner, the cooking pot - draws him in the
  // rig's own moves, like in the game: the traveler look as the full rig art, any other look as the cut-out moved by the
  // rig (lookPose). His feet at (x, y), scale as NC.drawHero's. o: t (seconds), face, turn (the creator's spin, radians),
  // clip (a base move 'idle' / 'ready' / 'walk' / 'run' for his weapon's family, or a rig clip such as 'sword1'),
  // noWeapon (the plain idle, nothing in his hands; an empty-handed hero too), alpha, tint, key (the hair and scarf
  // springs and the blend between moves live per key: a string, default the canvas). false -> the caller's old drawing
  const PV = new Map(), PVC = new WeakMap(), BASE_MOVES = { idle: 1, ready: 1, walk: 1, run: 1 };
  // (whether HS.preview draws this look: the pages that play moves of their own ask first)
  HS.canPreview = (equip) => HS.on && !!equip && init() && !!texture(rig()) && (fitsLook(equip) || HS.look);
  HS.preview = function (ctx, equip, x, y, scale, o) {
    o = o || {};
    if (!HS.on || !equip || !init()) return false;
    const R = rig(), tx = texture(R);
    if (!tx) return false;
    const bare = !!o.noWeapon || !equip.weapon || !NC.ITEMS[equip.weapon], full = fitsLook(equip);
    if (!full && !HS.look) return false;
    const want = o.clip || 'idle';
    const clip = BASE_MOVES[want] ? (bare ? (want === 'run' ? HS.run : want) : clipFor(want, { equip }, R)) : want, A = R.anims[clip];
    if (!A) return false;
    const loop = looping(clip), tt = o.t || 0, ct = loop ? ((tt % A.d) + A.d) % A.d : Math.max(0, Math.min(A.d, tt));
    const key = o.key != null ? o.key : ctx.canvas, map = typeof key === 'object' && key ? PVC : PV;
    let S = map.get(key);
    if (!S) map.set(key, (S = { hit: -1, phys: null, acc: 0, last: null, cur: null, prev: null, fade: 0, fadeD: 0 }));
    const now = performance.now() / 1000, gap = S.last == null ? -1 : now - S.last, dt = gap > 0.004 ? Math.min(0.1, gap) : 0;
    S.last = now;
    if (gap >= 0 && !dt) { S.prev = null; S.phys = null; }   // (several heroes on one canvas in one frame: each as he is, springs at rest)
    else if (dt && S.cur && S.cur.name !== clip) { S.prev = S.cur; S.fade = 0; S.fadeD = 0.15; }   // (an attack back to standing: blended)
    if (S.prev) { S.prev.t += dt; S.fade += dt; if (S.fade >= S.fadeD) S.prev = null; }
    S.cur = { name: clip, t: ct }; S.hit = -1; S.bend = 0; S.add = null; S.look = !full;
    const face = o.face || 1, base = NC.Anim.sample('idle', loop ? tt % 3.2 : 0, NC.animCtx(equip));
    base.face = face; base.wHide = bare ? 1 : 0;
    const p = { equip, pose: base, face, x: 0, y: 0 }, k = SCALE * scale;
    if (full) {
      const F = pose(p, S, dt, R, 0);
      ctx.save();
      ctx.translate(x, y);
      if (o.turn) ctx.scale(turnX(o.turn), 1);                 // (the creator's spin: narrowed, flipped half way, like the cut-out)
      blit(ctx, R, tx, F, 0, 0, k, face < 0, o);
      ctx.restore();
      return true;
    }
    const F = pose(p, S, dt, R, 0, FXONLY);
    if (F.ni > 0 && !o.turn) blit(ctx, R, tx, F, x, y, k, face < 0, o);   // (an attack's slashes: behind him)
    const P = lookPose(p, equip, R, F, null);
    if (/(^|_)(idle|ready)$/.test(clip)) { P.legF = base.legF; P.kF = base.kF; P.legB = base.legB; P.kB = base.kB; P.x = base.x || 0; P.y = base.y || 0; }
    P.face = face; P.wHide = 0;
    if (o.turn) P.turn = o.turn;
    baseDH.call(NC, ctx, equip, P, x, y, { scale: scale * LOOK_K, noWeapon: bare, alpha: o.alpha, tint: o.tint });
    return true;
  };

  // (tests) what plays
  HS.status =(p) => { const S = p._hspine; return S && S.cur ? { clip: S.cur.name, t: +S.cur.t.toFixed(3), prev: S.prev && S.prev.name, hit: +S.hit.toFixed(2), speed: Math.round(S.speed) } : null; };
  // Crowd pictures sample the very same attack/cast mapping and hit timing as
  // advance(). This reads an actor without creating/changing his rig state;
  // unsupported acts and free-running base moves keep their existing paths.
  HS.attackFrame = (p) => {
    if (!p || !p.anim || !p.anim.act || p.dead > 0 || p.fishAct) return null;
    const R = rig(), T = target(p, { speed: 0 }, R), A = T && R.anims[T[0]];
    return A && Number.isFinite(T[1]) ? { clip: T[0], t: Math.max(0, Math.min(A.d, T[1])) } : null;
  };
  HS.rig = rig;

  // the old swing trail follows the old drawing's blade: while the rig draws him, its own painted slashes stand in
  const baseTrail = NC.drawTrail;
  NC.drawTrail = function (ctx, game) {
    const S = game && game.player && game.player._hspine;
    if (S && S.cur && S.drawnAt === game.time) return;
    return baseTrail.apply(this, arguments);
  };

  // the player's own hero goes through here; everything else keeps the old drawing
  const baseDH = NC.drawHero;
  NC.drawHero = function (ctx, equip, P, x, y, o) {
    const g = NC.game, p = g && g.player;
    if (HS.on && p && equip === p.equip && P === p.pose && !(o && (o.silhouette || o.scale))) {
      if (HS.fits(equip)) { if (HS.draw(ctx, p, x, y, o || {})) return; }
      else if (equip.weapon && NC.ITEMS[equip.weapon] && HS.drawLook(ctx, p, equip, x, y, o || {})) return;
    }
    return baseDH.apply(this, arguments);
  };
  // the standing hero of the equipment pages (the bag, the status page, the job cards: NC.drawAvatar) in the rig's idle;
  // the head-and-shoulders portraits (noWeapon: party frames, the minimap marker, the ranks) keep the old drawing
  const baseDA = NC.drawAvatar;
  NC.drawAvatar = function (ctx, equip, x, y, scale, face, o) {
    if (!(o && o.noWeapon) && HS.preview(ctx, equip, x, y, scale, { t: (o && o.t) || 0, face: face || 1 })) return;
    return baseDA.apply(this, arguments);
  };
})();
