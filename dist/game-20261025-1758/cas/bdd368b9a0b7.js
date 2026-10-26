/* muramasa.js — MURAMASA, the cursed blood katana (the user, 2026-10-07: "ผมว่าทำ muramasa ดีกว่า" -> picked design A of three:
   a jet-black blade with a blood-red Muramasa-ba hamon, a thorn-vine tsuba, a crimson-wrapped hilt; its own black saya
   with thin glowing crimson cracks). Muramasa is the historical swordsmith whose blades are the blood-hungry cursed
   swords of legend; the design is our own. Art: Codex (assets/gen/make_muramasa_prompts.py) -> tools/longblood_cut.py
   165 --raw muramasa_raw.png --pick 0,1 --id muramasa --saya mu -> assets/samurai/w_muramasa.png, saya_mu.png (+ _glow).
   A two-handed nodachi like the Crimson Ronin's blood blade (its moves, its scabbard at the hip), a little longer and
   stronger; its saya is its own painting (js/sayaart.js SA.add) with the energy running along its red lines; the blood
   aura (js/bloodaura.js) burns on its blade. Admin test item for now: ?equip=muramasa&admin=1. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, base = ITEMS && ITEMS.nodachi_crimson;
  if (!base) return;                                        // (no samurai swords: not an admin)
  const N = { w: 25.5, h: 165, ax: 0.45, grip: 0.196 };    // (tools/longblood_cut.py prints them: _muramasa.json)
  NC.ASSET_MANIFEST.w_muramasa = { src: 'assets/samurai/w_muramasa.png', w: N.w, h: N.h, ax: N.ax, ay: 1.0 };
  const W = Object.assign({}, base, {
    id: 'muramasa', sprite: 'w_muramasa', name: 'มุรามาสะ', rarity: 'legend', grip: N.grip,
    dmg: [92, 118], reach: 228, crit: 0.08, trailRgb: '255,40,64',
    desc: 'ดาบต้องสาปของช่างดาบมุรามาสะ ใบดำสนิท เส้นฮามอนแดงเลือดเป็นคลื่น ว่ากันว่าชักออกจากฝักแล้วต้องได้ดื่มเลือดก่อนจะยอมกลับเข้าฝัก (ไอเทมทดสอบ)',
  });
  for (const k of Object.keys(W)) if (k[0] === '_') delete W[k];          // (the base blade's cached curves: this one has its own)
  if (base.tuck) W.tuck = Object.assign({}, base.tuck, { grip: N.grip });
  ITEMS.muramasa = W;
  if (NC.SayaArt && NC.SayaArt.add) NC.SayaArt.add('muramasa', 'mu');
  if (NC.BloodAura && NC.BloodAura.blades) NC.BloodAura.blades.add('muramasa');
})();
