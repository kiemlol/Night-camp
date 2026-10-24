/* herospine_crowd.js — a crowd of heroes on screen without the lag (the user, 2026-10-18: "ปรับปรุง triagle rig ให้ถ้าคนออน
   เยอะๆ จะไม่เเลค" -> "ทำข้อ 1+2+4 เลย ใส่ไฟล์ใหม่ไม่ชนแชทอื่น แล้ววัดก่อน/หลังให้ดู"). Measured before (the chat folder's
   out_crowd_bench, the RTX 5060 laptop): every other hero drawn live costs ~0.45 ms (the rig: about half of it the WebGL
   canvas copied onto the game's canvas, one copy per hero) to ~1.5 ms (the cut-out moved by the rig in a hat and another
   outfit), so 60 heroes on screen ran at 9-11 fps. Here the other heroes NC.Party.draw draws (online players, the party,
   the map's adventurers, the shopkeepers) are put in tiers each frame, nearest to the player first:
   - LIVE: the party, the one targeted and the nearest few: drawn every frame exactly as before.
   - SHARED FRAMES (1): a hero who only stands, waits in his fighting stance, walks or runs, in a look the rig draws and
     that two or more heroes on screen wear, is drawn from baked pictures of that move: one picture per look x move x frame
     of the loop (12 a second standing, 20 walking, 24 running), facing right, mirrored when he faces left (the rig and the
     cut-out are mirrored the same way), kept in one cache for everyone (oldest out first, a memory budget): drawing one is
     one drawImage. The pictures come from the rig's own drawing (HS.drawAt for the traveler look, HS.lookAt for every
     other look: the game's cut-out in the rig's moves), the hair at rest.
   - ATTACK FRAMES (2026-10-18, 200-player boss test): ordinary attacks and supported cast poses share frames too. HS.attackFrame
     reads the rig's own target/hit-time mapping, so each actor keeps his clip and phase; facing is still mirrored per
     actor. The whole equipped look and sampling rate belong to the key. Party members/targets stay live as before.
     Duplicate misses within one render frame bake once, instead of repeating GPU-to-Canvas copies and counting the
     same picture's memory repeatedly. Every name and HP bar still shows through the normal text renderer.
   - OWN PICTURE (2): anyone else (unsupported attacks, active casting bars, hurt, dying, sitting, dashing, at a life skill, a look nobody else on
     screen wears, the rig off) is drawn the normal way into his own small canvas 10-24 times a second and that picture is
     put where he stands every frame.
   Every picture is cut to what the drawing covered (a scratch canvas records each drawImage's corners). The pictures are
   made before the world is drawn (NC.Party.collect, after the sort), within a time budget per frame: first the heroes
   with no picture yet, then the ones who just started something (an attack, a fall), the missing shared frames, then
   the longest overdue; the rest keep their last picture one more frame.
   - (4) past the nearest N only the shadow, the name and the HP bar show. ESC -> ตั้งค่า "ผู้เล่นอื่นบนจอ":
     อัตโนมัติ (one step down while the game runs under 45 fps, back up after a while over 57) / สูง / กลาง / ต่ำ.
   ?crowd=0 off (every hero live as before), ?crowd=high|mid|low this quality for this load (no auto).
   NC.Crowd: stats(), set(q), quality, level (the step auto picked), on, liveN (tests: how many nearest stay live). */
(function () {
  'use strict';
  const NC = window.NC, P = NC.Party;
  if (!P) return;
  const KEY = 'nightcamp.crowd.v1';
  // per quality: the nearest drawn live (besides the party and the target), own pictures a second, the time (ms) a frame
  // may spend making pictures, the most bodies shown, the shared pictures' memory budget (MB)
  const Q = {
    high: { live: 4, fps: 24, ms: 5, cap: 120, mb: 96 },
    mid: { live: 2, fps: 16, ms: 3.5, cap: 70, mb: 64 },
    low: { live: 0, fps: 10, ms: 2.5, cap: 40, mb: 40 },
  };
  const STEPS = ['high', 'mid', 'low'];
  let quality = 'auto';
  try { const v = localStorage.getItem(KEY); if (v === 'auto' || Q[v]) quality = v; } catch (e) { /* storage blocked */ }
  const C = (NC.Crowd = { on: true, get quality() { return quality; }, get cap() { return cur().cap; }, level: 0, sharedAttacks: true }); // (cap: online/conn.js tells the server the most other heroes drawn)
  const cur = () => Q[quality === 'auto' ? STEPS[C.level] : quality];
  const HS = NC.HeroSpine;

  // ---------------- who is a hero, how near: the tiers ----------------
  const view = () => document.getElementById('view');
  let mainCtx = null;
  const isHero = (a, p) => !!(a && a !== p && a.equip && a.pose && a.anim && typeof a.anim === 'object' && !a.pet);
  const partyPeers = () => { try { return NC.PartyNet && NC.PartyNet.others ? NC.PartyNet.others() : []; } catch (e) { return []; } };
  const TIER = new WeakMap();                      // hero -> { f: the frame, t: 'live' | 'cache' | 'hide', pic, flip }
  const LIVE = 'live', CACHE = 'cache', HIDE = 'hide';
  const SIGN = new Map();                          // the look's key -> how many heroes (not live) wear it this frame
  let frame = 0;
  const ranked = [];
  function rank(game) {
    const q = cur(), peers = partyPeers(), mem = P.members || [];
    ranked.sort((a, b) => a._crowdD - b._crowdD);
    let near = 0;
    SIGN.clear();
    ranked.forEach((a, i) => {
      const keep = a === game.target || mem.indexOf(a) >= 0 || (a.peer && peers.indexOf(a.peer) >= 0);
      const t = !C.on || keep ? LIVE : near++ < (C.liveN != null ? C.liveN : q.live) ? LIVE : i >= q.cap ? HIDE : CACHE;
      let T = TIER.get(a);
      if (!T) TIER.set(a, (T = {}));
      // (his picture of the frame before: held while nothing new is ready within the budget - the WebGL2 screen's bakes cost
      // more, and a hero starting an attack showed no body for up to 10 frames, 2026-10-19)
      if (T.f !== frame - 1 || T.t !== CACHE) T.last = null;
      else if (T.pic) { T.last = T.pic; T.lastFlip = T.flip; }
      T.f = frame; T.t = t; T.pic = null; T.flip = false; T.keep = keep;
      if (t === CACHE) { a._crowdSig = sigOf(a.equip); SIGN.set(a._crowdSig, (SIGN.get(a._crowdSig) || 0) + 1); }
    });
  }

  // ---------------- a picture of what one draw puts down, cut to what it covered ----------------
  // One scratch canvas (the box: attacks' slashes, big weapons held up, lying dead; the feet at BOX[2], BOX[3] game units)
  // records every drawImage's corners while a hero is drawn into it; the covered part (+ the ground under his feet: the
  // cut-out's small shadows are paths) is copied into the picture's own canvas, so a picture holds the hero, not the box.
  const BOX = [380, 360, 190, 285];
  const ZMAX = 1.7;                                // (a phone's 3x screen: the far heroes' pictures at most 1.7 px a unit)
  const zq = (z) => Math.min(ZMAX, Math.pow(2, Math.round(Math.log2(z) * 4) / 4));   // (quarter octaves: a small zoom punch keeps the pictures)
  let scr = null, sx = null, bx0 = 0, by0 = 0, bx1 = 0, by1 = 0;
  const cover = (m, X, Y) => { const px = m.a * X + m.c * Y + m.e, py = m.b * X + m.d * Y + m.f; if (px < bx0) bx0 = px; if (px > bx1) bx1 = px; if (py < by0) by0 = py; if (py > by1) by1 = py; };
  // (the WebGL2 screen with its layers in one context, js/gl2d_layers.js: the pictures are GPU canvases, so the hero rig's
  // picture goes into them without a read back)
  const mkCanvas = (w, h) => (NC.GL2D && NC.GL2D.layers ? NC.GL2D.canvas(w || 1, h || 1) : document.createElement('canvas'));
  // (a GPU canvas is sized in one go: width then height made its texture twice; the sizes are rounded up to 32 px so a
  //  picture that grows a little keeps its texture - each new one costs, most on Apple GPUs, 2026-10-19)
  const size = (c, w, h) => { if (c.resize) c.resize(w, h); else { c.width = w; c.height = h; } };
  const up32 = (v) => Math.ceil(v / 32) * 32;
  // (the WebGL2 screen's rig meshes, js/gl2d_mesh.js, go straight into the batch with no drawImage to record: the box
  // herospine.js blit() gives its drawImage is recorded here. Without it every hero the rig draws (the traveler look) had
  // a picture cut to the ground under his feet: a name and an HP bar with no body in a fighting crowd, 2026-10-19)
  const RG = NC.GL2D && NC.GL2D.rig;
  if (RG && RG.hero) {
    const baseRig = RG.hero, PAD = 6;              // (PAD = herospine.js blit's)
    RG.hero = function (ctx, R, F, x, y, k, flip) {
      const ok = baseRig.apply(this, arguments);
      if (ok && sx && ctx === sx) {
        const m = ctx.getTransform(), s = flip ? -k : k;
        for (let i = 0; i < 4; i++) cover(m, x + s * (i & 1 ? F.maxX + PAD : F.minX - PAD), y - k * (i & 2 ? F.maxY + PAD : F.minY - PAD));
      }
      return ok;
    };
  }
  function scratch(Z) {
    const W = Math.ceil(BOX[0] * Z), H = Math.ceil(BOX[1] * Z);
    if (!scr) {
      scr = mkCanvas(); sx = scr.getContext('2d');
      const DI = sx.drawImage;
      sx.drawImage = function (img) {
        const n = arguments.length, iw = img.naturalWidth || img.videoWidth || img.width || 0, ih = img.naturalHeight || img.videoHeight || img.height || 0;
        const dx = n >= 8 ? arguments[5] : arguments[1], dy = n >= 8 ? arguments[6] : arguments[2];
        const dw = n >= 8 ? arguments[7] : n >= 4 ? arguments[3] : iw, dh = n >= 8 ? arguments[8] : n >= 4 ? arguments[4] : ih;
        const m = this.getTransform();
        for (let k = 0; k < 4; k++) cover(m, dx + (k & 1 ? dw : 0), dy + (k & 2 ? dh : 0));
        return DI.apply(this, arguments);
      };
    }
    if (scr.width < W || scr.height < H) size(scr, Math.max(scr.width, W), Math.max(scr.height, H));
    sx.setTransform(1, 0, 0, 1, 0, 0);
    sx.clearRect(0, 0, W, H);
    sx.globalAlpha = 1; sx.globalCompositeOperation = 'source-over'; sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = 'high';
    // (the ground under his feet always: the cut-out's shadows)
    bx0 = (BOX[2] - 50) * Z; bx1 = (BOX[2] + 50) * Z; by0 = (BOX[3] - 20) * Z; by1 = (BOX[3] + 14) * Z;
    return [W, H];
  }
  // draw(cx) with the scratch's transform set (his feet at BOX[2], BOX[3]) -> the covered part into pic (made or reused)
  function capture(Z, draw, pic) {
    const [W, H] = scratch(Z);
    sx.setTransform(Z, 0, 0, Z, 0, 0);
    if (draw(sx) === false) return null;
    const x0 = Math.max(0, Math.floor(bx0) - 2), y0 = Math.max(0, Math.floor(by0) - 2), x1 = Math.min(W, Math.ceil(bx1) + 2), y1 = Math.min(H, Math.ceil(by1) + 2);
    const w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return null;
    const aw = up32(w), ah = up32(h);
    pic = pic || { c: mkCanvas(aw, ah) };
    const c = pic.c;
    // (an own picture: grows as needed, shrinks when far too big)
    if (c.width < w || c.height < h || c.width * c.height > aw * ah * 3) size(c, aw, ah);
    const cx = c.getContext('2d');
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.clearRect(0, 0, c.width, c.height);
    cx.drawImage(scr, x0, y0, w, h, 0, 0, w, h);
    pic.w = w; pic.h = h; pic.ox = x0 / Z - BOX[2]; pic.oy = y0 / Z - BOX[3]; pic.Z = Z; pic.bytes = c.width * c.height * 4;
    return pic;
  }
  // a picture at his feet (x, y), mirrored for a left-facing hero (shared frames are baked facing right)
  function put(ctx, pic, x, y, flip) {
    const W = pic.w / pic.Z, H = pic.h / pic.Z;
    if (!flip) { ctx.drawImage(pic.c, 0, 0, pic.w, pic.h, x + pic.ox, y + pic.oy, W, H); return; }
    ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1);
    ctx.drawImage(pic.c, 0, 0, pic.w, pic.h, pic.ox, pic.oy, W, H);
    ctx.restore();
  }

  // ---------------- (1) shared frames: the plain moves ----------------
  const FPS = { idle: 12, ready: 12, walk: 20, run: 24 };
  function clipFor(move, equip) {
    const R = HS.rig(), f = HS.famOf({ equip });
    if (f === 'sword') return move === 'run' ? HS.run : move;
    const n = f + '_' + (move === 'ready' ? 'idle' : move);
    return R.anims[n] ? n : move === 'run' ? HS.run : move;
  }
  // the look's key: every worn piece, the creator's head
  const SLOTS = ['hair', 'hat', 'glasses', 'top', 'pants', 'shoes', 'weapon', 'shield', 'robe', 'cape', 'fhat', 'frobe', 'acc1', 'acc2'];
  function sigOf(eq) {
    let s = '';
    for (const k of SLOTS) s += (eq[k] || '') + '|';
    const h = eq.hair && NC.ITEMS[eq.hair], hs = h && h.head && NC.SPR[h.head];
    if (hs) s += (hs.name || h.head) + ':' + (hs.look || '');
    return s;
  }
  // a hero who only stands / waits / walks / runs in a look the rig draws -> [move, mode] or null
  function plain(a) {
    if (!HS || !HS.on || !HS.others || !HS.drawAt || !HS.lookAt) return null;
    if (a.dead > 0 || a.hurt > 0 || a.inv > 0 || (a.fade !== undefined && a.fade < 1) || a.dash || a.ds || a.channel || a.casting) return null;
    const st = a.anim;
    const attack = st.act && C.sharedAttacks && HS.attackFrame ? HS.attackFrame(a) : null;
    if ((st.act && !attack) || st.base === 'sit' || st.base === 'death' || a.st || a.toolShow || a.fishAct || ((a.atk && a.atk.on) && !attack) || (a.pose && a.pose.wHide > 0.5)) return null;
    const eq = a.equip, W = eq.weapon && NC.ITEMS[eq.weapon];
    if (!W || W.slot === 'tool') return null;
    const mode = HS.fits(eq) ? 'rig' : HS.look ? 'look' : null;
    if (!mode) return null;
    return [a.moving ? (a.running ? 'run' : 'walk') : a.combat > 0.5 ? 'ready' : 'idle', mode, attack];
  }
  const SHARED = new Map();                        // key -> picture (Map order = least recently used first)
  let sharedBytes = 0;
  const ST = new WeakMap();                        // hero -> his clock in the plain moves: { clip, ct, lx, ly, lt, sp }
  const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  // A rig's painted slash is also another player's effect. It used to bypass
  // FX.add/OtherFX entirely. Keep the whole slash for a stable share of attacks
  // (not randomly flickering pieces of each swing). Own, party and selected
  // actors retain their priority; nearby live bodies still animate fully.
  function noSlash(a) {
    const of = NC.OtherFX;
    if (!a.remote || !of || of.pct >= 100) return false;
    if (of.pct <= 0) return true;
    return hash(String(a.peer || a.id || a.name || '') + '|' + (a.acSeq == null ? '' : a.acSeq) + '|' + (a.anim.act || '')) % 100 >= of.pct;
  }
  // his frame of the move now (his own clock, paced like the rig paces it: walk / run by how fast he really goes)
  // -> { key, e (the picture, if made), near (the nearest frame made, while his is not), bake() }
  function frameOf(a, game, pm, Z) {
    const [move, mode, attack] = pm, eq = a.equip, clip = attack ? attack.clip : clipFor(move, eq), A = HS.rig().anims[clip];
    if (!A) return null;
    let s = ST.get(a);
    if (!s) ST.set(a, (s = { clip: null, ct: 0, lx: a.x, ly: a.y, lt: game.time, sp: 0 }));
    const dt = Math.max(0, Math.min(0.1, game.time - s.lt));
    if (dt > 0) { const v = Math.hypot(a.x - s.lx, a.y - s.ly) / dt; s.sp += (v - s.sp) * Math.min(1, dt * 10); }
    s.lx = a.x; s.ly = a.y; s.lt = game.time;
    if (s.clip !== clip) { s.clip = clip; s.ct = (hash(String(a.peer || a.name || '')) % 1000) / 1000 * A.d; }
    const rate = move === 'run' ? Math.max(0.6, Math.min(2.6, s.sp / 310)) : move === 'walk' ? Math.max(0.8, Math.min(2.6, (s.sp / 150) * 1.85)) : 1;
    s.ct = (s.ct + dt * rate) % A.d;
    // (a look only he wears on screen: his own picture - the shared pictures are for the looks the crowd shares)
    if ((SIGN.get(a._crowdSig) || 0) < 2) return null;
    if (NC.Sprites && NC.Sprites.equipMissing && NC.Sprites.equipMissing(eq)) return null; // (his gear's art still streaming in, js/assets.js: nothing shared is baked from it)
    const N = Math.max(6, Math.min(48, Math.round(A.d * (attack ? cur().fps : FPS[move]))));
    const fi = Math.max(0, Math.min(N - 1, Math.floor(((attack ? attack.t : s.ct) / A.d) * N)));
    // Attack time comes from the actor, never a shared/random idle clock. N is
    // part of the key so an Auto quality change cannot reuse a different phase.
    const noFx = !!attack && noSlash(a);
    const head = mode + '|' + clip + (attack ? '@' + N : '') + '|', tail = '|' + Z + '|fx' + (noFx ? 0 : 1) + '|' + a._crowdSig, key = head + fi + tail;
    const e = SHARED.get(key);
    if (e) { SHARED.delete(key); SHARED.set(key, e); return { key, e }; }     // (most recently used: last)
    let near = null;
    for (let d = 1; d <= 3 && !near; d++) {
      // An attack's last frame must never wrap around to its first wind-up.
      const hi = attack ? Math.min(N - 1, fi + d) : (fi + d) % N;
      const lo = attack ? Math.max(0, fi - d) : (fi - d + N) % N;
      near = SHARED.get(head + hi + tail) || SHARED.get(head + lo + tail) || null;
    }
    return {
      key, near,
      bake() {
        // Several heroes can miss the same key before this frame's work starts.
        // Bake it once: overwriting it used to count its bytes repeatedly too.
        const ready = SHARED.get(key);
        if (ready) return ready;
        const t = ((fi + 0.5) / N) * A.d, o = { face: 1, noFx };
        const pic = capture(Z, (cx) => !!(mode === 'rig' ? HS.drawAt(cx, eq, clip, t, BOX[2], BOX[3], o) : HS.lookAt(cx, eq, clip, t, BOX[2], BOX[3], o)));
        if (!pic) return null;
        SHARED.set(key, pic); sharedBytes += pic.bytes;
        const budget = cur().mb * 1048576;
        for (const [k, v] of SHARED) { if (sharedBytes <= budget) break; SHARED.delete(k); sharedBytes -= v.bytes; }
        return pic;
      },
    };
  }

  // ---------------- (2) his own picture, redrawn a few times a second ----------------
  const OWN = new WeakMap();                       // hero -> { c, w, h, ox, oy, Z, t (when drawn), act, dead, used }
  const OWNS = new Set();                          // (the own pictures in use, to empty the ones nobody used for a while)
  let ownBytes = 0, sweepT = 0;
  const baseDraw = P.draw;
  let suppressingSlash = false;
  const baseHero = NC.drawHero;
  if (baseHero) NC.drawHero = function (ctx, equip, pose, x, y, o) {
    return baseHero.call(this, ctx, equip, pose, x, y, suppressingSlash ? Object.assign({}, o, { noFx: true }) : o);
  };
  function redraw(game, a, o, Z, noFx) {
    const was = suppressingSlash;
    suppressingSlash = noFx;
    try { return capture(Z, (cx) => { cx.translate(BOX[2] - a.x, BOX[3] - a.y); baseDraw.call(P, cx, game, a); }, o); }
    finally { suppressingSlash = was; }
  }
  // (every 2 s) the own pictures of heroes gone, or drawn another way, for 2 s: emptied
  function sweep(game) {
    if (game.time - sweepT < 2) return;
    sweepT = game.time; ownBytes = 0;
    for (const o of OWNS) {
      if (frame - o.used > 120) { o.c.width = o.c.height = 0; o.t = -1; o.bytes = 0; OWNS.delete(o); }
      else ownBytes += o.bytes || 0;
    }
  }

  // ---------------- the pictures of this frame, within the time budget ----------------
  const work = [];
  let spent = 0, made = 0, lastFXPct = null;
  function plan(game) {
    const m = mainCtx.getTransform(), z = Math.hypot(m.a, m.b) || 1, Z = zq(z), q = cur(), t0 = performance.now();
    const fxPct = NC.OtherFX ? NC.OtherFX.pct : 100;
    if (lastFXPct !== null && fxPct !== lastFXPct) {
      SHARED.clear(); sharedBytes = 0;
      for (const o of OWNS) o.t = -1;
    }
    lastFXPct = fxPct;
    work.length = 0;
    for (const a of ranked) {
      const T = TIER.get(a);
      if (T.t !== CACHE) continue;
      const pm = plain(a), fr = pm && frameOf(a, game, pm, Z);
      if (fr && fr.e) { T.pic = fr.e; T.flip = (a.face || 1) < 0; continue; }
      let o = OWN.get(a);
      if (!o) { o = { c: mkCanvas(), t: -1, act: null, dead: 0, Z }; OWN.set(a, o); }
      const noFx = noSlash(a);
      if (o.Z !== Z || o.noFx !== noFx) o.t = -1;
      o.used = frame; OWNS.add(o);
      if (fr) {                                    // (his shared frame is not made yet: make it, meanwhile the nearest one)
        work.push({ pri: 5e5, a, T, fr, o });
        if (fr.near) { T.pic = fr.near; T.flip = (a.face || 1) < 0; }
        else if (o.t >= 0 && game.time - o.t < 0.4) T.pic = o;
        continue;
      }
      if (o.t >= 0) T.pic = o;
      const act = a.anim.act, dead = a.dead > 0 ? 1 : 0;
      const pri = o.t < 0 ? 1e9 : act !== o.act || dead !== o.dead ? 1e6 : game.time - o.t - 1 / q.fps;
      if (pri >= 0) work.push({ pri, a, T, o, act, dead, noFx });
    }
    work.sort((x, y) => y.pri - x.pri);
    made = 0;
    for (const w of work) {
      const used = performance.now() - t0;
      // (the budget; heroes with nothing to show yet may take up to three budgets: a map full of people appears at once)
      if (used > q.ms && !(w.pri >= 1e9 && used < q.ms * 3)) break;
      made++;
      if (w.fr) {
        const pic = w.fr.bake();
        if (pic) { w.T.pic = pic; w.T.flip = (w.a.face || 1) < 0; }
        continue;
      }
      if (redraw(game, w.a, w.o, Z, w.noFx)) {
        w.o.t = game.time; w.o.act = w.act; w.o.dead = w.dead; w.o.Z = Z; w.o.noFx = w.noFx;
        w.T.pic = w.o; w.T.flip = false;
      }
    }
    spent = performance.now() - t0;
  }

  // ---------------- (4) the frame rate: one step down while it runs slow, back up after a while ----------------
  let fpsT0 = 0, fpsN = 0, fps = 60, lastStep = 0, blockUp = 0, lastAt = 0;
  function watch() {
    const now = performance.now();
    if (document.hidden) { fpsT0 = 0; return; }
    if (lastAt && now - lastAt > 500) fpsT0 = 0;                     // (a pause, a load: start over)
    lastAt = now;
    if (!fpsT0) { fpsT0 = now; fpsN = 0; return; }
    fpsN++;
    if (now - fpsT0 < 1500) return;
    fps = (fpsN * 1000) / (now - fpsT0); fpsT0 = now; fpsN = 0;
    if (quality !== 'auto' || !C.on || ranked.length < 6) return;
    if (fps < 45 && C.level < STEPS.length - 1 && now - lastStep > 3000) {
      if (now - lastStep < 12000) blockUp = now + 120000;            // (it went straight back down: stay down longer)
      C.level++; lastStep = now; blockUp = Math.max(blockUp, now + 30000);
    } else if (fps > 57 && C.level > 0 && now > blockUp && now - lastStep > 8000) { C.level--; lastStep = now; }
  }

  // ---------------- the hooks: the outermost NC.Party.collect / draw ----------------
  const baseCollect = P.collect;
  P.collect = function (list, visible) {
    const r = baseCollect.apply(this, arguments);
    const g = NC.game, p = g && g.player;
    // (only the world's own draw list: a window looking for someone collects with a visible() that says yes to anything)
    if (!p || visible(-1e9, -1e9, -1e9 + 1, -1e9 + 1)) return r;
    if (!mainCtx && view()) mainCtx = view().getContext('2d');
    frame++;
    ranked.length = 0;
    for (const a of list) if (isHero(a, p)) { a._crowdD = (a.x - p.x) * (a.x - p.x) + (a.y - p.y) * (a.y - p.y) * 1.6; ranked.push(a); }
    rank(g);
    if (C.on && mainCtx) plan(g);
    watch();
    sweep(g);
    return r;
  };
  P.draw = function (ctx, game, a) {
    const T = C.on && a && TIER.get(a);
    if (ctx !== mainCtx || !T || T.f !== frame) return baseDraw.apply(this, arguments);
    if (T.t === LIVE) {
      if (T.keep || !noSlash(a)) return baseDraw.apply(this, arguments);
      const was = suppressingSlash; suppressingSlash = true;
      try { return baseDraw.apply(this, arguments); } finally { suppressingSlash = was; }
    }
    if (T.t === HIDE) return;
    if (!T.pic && T.last) { T.pic = T.last; T.flip = T.lastFlip; }
    if (!T.pic) return;
    put(ctx, T.pic, a.x, a.y, T.flip);
  };

  // ESC -> ตั้งค่า
  (NC.MENU_SETTINGS = NC.MENU_SETTINGS || []).push({
    name: 'ผู้เล่นอื่นบนจอ',
    note: 'คนเยอะแล้วกระตุก: อัตโนมัติ = ลดเองเมื่อเฟรมตก · ต่ำ = ลื่นสุด',
    opts: [['auto', 'อัตโนมัติ'], ['high', 'สูง'], ['mid', 'กลาง'], ['low', 'ต่ำ']],
    get: () => quality,
    set: (v) => C.set(v),
  });
  C.set = (v) => {
    if (v !== 'auto' && !Q[v]) return;
    quality = v; C.level = 0; blockUp = 0;
    try { localStorage.setItem(KEY, v); } catch (e) { /* storage blocked */ }
  };
  // (tests, the bench) what the tiers hold
  C.stats = () => {
    const n = { live: 0, cache: 0, hide: 0 };
    for (const a of ranked) { const T = TIER.get(a); if (T && T.f === frame) n[T.t]++; }
    return { quality, step: STEPS[C.level], fps: +fps.toFixed(1), heroes: ranked.length, tiers: n, sharedPictures: SHARED.size,
      sharedMB: +(sharedBytes / 1048576).toFixed(1), ownPictures: OWNS.size, ownMB: +(ownBytes / 1048576).toFixed(1),
      madeLastFrame: made, msLastFrame: +spent.toFixed(2) };
  };
  C.tierOf = (a) => { const T = TIER.get(a); return T && T.f === frame ? T.t : null; };
  C.clear = () => { SHARED.clear(); sharedBytes = 0; };
})();
