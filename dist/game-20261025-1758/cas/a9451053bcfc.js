/* glasses.js — แว่น: the eyewear slot. Loaded before items.js, which merges NC.GLASSES.items into NC.ITEMS and has
   'glasses' among its slots; avatar.js calls NC.drawGlasses on the head, over the face and under the hat (a hat that
   covers the face covers the glasses too).
   Art: assets/glasses/ + assets/glasses.manifest.js (NC.ASSET_MANIFEST_GLASSES), made with
   assets/gen/make_glasses_prompts.py -> Codex -> tools/glasscut.py, which puts glass in the empty lenses and records
   the two lens centres of every pair (`lens`: [near, far] as fractions of the picture).
   Fitting: every head picture has its two eye centres (EYES: the near eye on the left, the far one on the right,
   measured on the pictures; the creator's heads from the neck, as they are cropped to each look). A pair's lens
   centres are mapped onto them (size + a small turn), so one picture fits every hairstyle and follows the head.
   fit / dx / dy per pair fine-tune that (dx, dy in eye distances); NC.glassFit keeps changes in this browser. */
(function () {
  'use strict';
  const NC = window.NC;
  if (NC.ASSET_MANIFEST_GLASSES) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_GLASSES);

  // the eyes of each head picture: [near, far] centres as fractions of the picture
  const EYES = {
    head_spiky: [[0.545, 0.742], [0.736, 0.725]], head_spiky_brown: [[0.54, 0.743], [0.739, 0.717]],
    head_neat: [[0.559, 0.735], [0.797, 0.704]], head_ponytail: [[0.651, 0.724], [0.852, 0.695]],
    head_long: [[0.56, 0.665], [0.791, 0.638]], head_buzz: [[0.561, 0.711], [0.846, 0.68]],
    head_curly: [[0.595, 0.756], [0.815, 0.737]],
  };
  // the creator's heads (js/look.js): from the neck joint, in world units (its eyes sit at (238, 280) and (334, 274) px
  // of the look frame, the neck at (214, 348), 6 px a unit); any other head uses the same
  const NECK_EYES = [[4.07, -11.22], [20.08, -12.23]];
  function eyesOf(H) {
    const e = EYES[H.name];
    if (e) return [[e[0][0] * H.w, e[0][1] * H.h], [e[1][0] * H.w, e[1][1] * H.h]];
    const n = (H.joints && H.joints.neck) || [H.w * 0.5, H.h * 0.92];
    return NECK_EYES.map(([x, y]) => [n[0] + x, n[1] + y]);
  }
  NC.eyesOf = eyesOf; // (js/hatpair.js: a head's size is measured from its eyes)

  // ---------------- the pairs ----------------
  const items = {};
  const add = (id, name, rarity, stats, desc, fit) => {
    items[id] = Object.assign({ slot: 'glasses', name, sprite: id, rarity, stats, desc, fit: 1, dx: 0, dy: 0 }, fit || {});
  };
  add('glasses_round', 'แว่นกลม', 'common', { int: 1, hit: 2 }, 'กรอบลวดบางสีน้ำตาล อ่านหนังสือได้ทั้งคืนข้างกองไฟ');
  add('glasses_square', 'แว่นกรอบหนา', 'common', { dex: 1, hit: 3 }, 'กรอบดำหนาเตอะ มองเป้าหมายชัดแจ๋ว');
  add('glasses_sun', 'แว่นกันแดด', 'rare', { crit: 0.05, flee: 3 }, 'เท่ไว้ก่อน ศัตรูเดาสายตาไม่ออก');
  add('glasses_moon', 'แว่นจันทร์เสี้ยว', 'rare', { int: 2, sp: 15 }, 'แว่นอ่านคาถาของจอมเวท ประดับอัญมณีม่วง');
  add('glasses_monocle', 'แว่นตาเดียว', 'epic', { dex: 2, crit: 0.04 }, 'เลนส์เดียวกรอบทอง ห้อยสายโซ่ สุภาพบุรุษนักล่า');
  add('glasses_goggles', 'แว่นช่างกล', 'epic', { def: 3, dex: 1 }, 'เลนส์หนาขอบทองเหลืองตอกหมุด กันสะเก็ดไฟจากเตาหลอม');
  add('glasses_heart', 'แว่นหัวใจ', 'fashion', { luk: 3 }, 'มองโลกเป็นสีชมพู');
  add('glasses_star', 'แว่นดาว', 'fashion', { luk: 2, agi: 1 }, 'แว่นปาร์ตี้ประจำคืนรอบกองไฟ');

  // ---------------- fine-tuning kept in this browser (like the hats': NC.hatFit) ----------------
  const FIT_KEY = 'nightcamp.glassfit.v1', FIT = ['fit', 'dx', 'dy'];
  const defaults = {};
  for (const id in items) defaults[id] = { fit: items[id].fit, dx: items[id].dx, dy: items[id].dy };
  NC.glassFit = {
    defaults,
    stored() { try { return JSON.parse(localStorage.getItem(FIT_KEY) || '{}'); } catch (e) { return {}; } },
    load() { const s = this.stored(); for (const id in s) if (items[id]) for (const k of FIT) if (Number.isFinite(s[id][k])) items[id][k] = s[id][k]; },
    save() {
      const out = {};
      for (const id in items) if (FIT.some((k) => Math.abs(items[id][k] - defaults[id][k]) > 1e-6)) out[id] = { fit: +items[id].fit.toFixed(3), dx: +items[id].dx.toFixed(3), dy: +items[id].dy.toFixed(3) };
      try { localStorage.setItem(FIT_KEY, JSON.stringify(out)); return true; } catch (e) { return false; }
    },
    reset(id) { Object.assign(items[id], defaults[id]); },
  };
  NC.glassFit.load();

  // ---------------- drawing (head-piece coordinates: avatar.js has turned the canvas with the head) ----------------
  NC.drawGlasses = function (ctx, H, equip, o) {
    const it = equip && equip.glasses && NC.ITEMS[equip.glasses], gs = it && NC.SPR[it.sprite];
    if (!gs || !gs.lens || !H) return;
    const [A, B] = eyesOf(H), L = gs.lens;
    const p = [L[0][0] * gs.w, L[0][1] * gs.h], q = [L[1][0] * gs.w, L[1][1] * gs.h];
    const dH = Math.hypot(B[0] - A[0], B[1] - A[1]), dG = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    const k = (dH / dG) * (it.fit || 1), rot = Math.atan2(B[1] - A[1], B[0] - A[0]) - Math.atan2(q[1] - p[1], q[0] - p[0]);
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; // the pair turns and grows round the middle of its lenses
    ctx.save();
    ctx.translate((A[0] + B[0]) / 2 + (it.dx || 0) * dH, (A[1] + B[1]) / 2 + (it.dy || 0) * dH);
    ctx.rotate(rot);
    ctx.scale(k, k);
    ctx.drawImage(o && o.silhouette ? NC.tinted(gs.name, o.silhouette) : gs.img, -mx, -my, gs.w, gs.h);
    if (o && o.tint && o.tint[1] > 0) { const a = ctx.globalAlpha; ctx.globalAlpha = a * o.tint[1]; ctx.drawImage(NC.tinted(gs.name, o.tint[0]), -mx, -my, gs.w, gs.h); ctx.globalAlpha = a; }
    ctx.restore();
  };

  NC.GLASSES = { items, EYES, eyesOf };
})();
