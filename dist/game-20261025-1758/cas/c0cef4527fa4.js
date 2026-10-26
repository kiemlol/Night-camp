/* moonblade.js — ชุดดาบใหญ่ราตรี (MOONBLADE): an endgame GREATSWORD set (the user, 2026-10-15: "ทำชุดดาบใหญ่ ... ให้หน่อย",
   concept A of assets/gen/make_moonblade_prompts.py).
   Our own design: a black-robed night swordsman with a huge guardless cleaver; only the mood of a black-robed soul-reaper
   swordsman, no copy of that character, his sword, mask or emblem.
     robe_moonblade   the black ragged robe, the white sash (rig 'moonblade': parts + the long robe as one garment)
     gs_moonblade     the huge cleaver: no guard, a cloth-wrapped grip, a broken chain at the pommel
   The released form (a long black coat + a slim black blade) was taken OUT of the game on 2026-10-18 (the user asked: its
   name came from another work): its art is kept in assets/gen/_shelved_moonblade_form/, which is never deployed.
   Art: assets/gen/make_moonblade_prompts.py -> tools/rigcut.py (parts), tools/cutout.py (swords) -> assets/moonblade/,
   assets/moonblade.manifest.js. TEST: ?equip=robe_moonblade,gs_moonblade */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, M = NC.ASSET_MANIFEST;
  if (NC.ASSET_MANIFEST_MOONBLADE) Object.assign(M, NC.ASSET_MANIFEST_MOONBLADE);
  if (!M.rig_moonblade_torso || !M.gs_moonblade) return; // (no art yet)

  // ---------------- the pieces ----------------
  ITEMS.robe_moonblade = { slot: 'robe', name: 'ชุดดาบใหญ่ราตรี', rig: 'moonblade', rarity: 'legend', lvReq: 90,
    stats: { str: 6, agi: 3, crit: 0.05, hp: 60 },
    desc: 'ชุดคลุมดำชายขาดรุ่ย คาดผ้าขาว ของนักดาบที่ล่าสิ่งต่างๆ ตอนกลางคืน (ชุดทดสอบ)' };
  const base = ITEMS.greatsword;
  if (base) {
    const W = (id, name, desc, grip) => {
      // (held like every greatsword: the user's own Pose Studio holds; a shoulder carry would be sig: { idle: 'idleShoulder', set: 'storm' })
      const w = Object.assign({}, base, { id, sprite: id, name, rarity: 'legend', lvReq: 90, element: 'shadow', grip, desc,
        dmg: base.dmg ? base.dmg.map((v) => Math.round(v * 2.1)) : base.dmg, trailRgb: '190,196,220' });
      delete w.gs; delete w.inst;
      for (const k of Object.keys(w)) if (k[0] === '_') delete w[k];
      return w;
    };
    ITEMS.gs_moonblade = W('gs_moonblade', 'ดาบใหญ่ราตรี', 'ดาบใหญ่ทรงมีดปังตอ ไม่มีกั่น ด้ามพันผ้าขาว ปลายด้ามห้อยโซ่ขาด (ทดสอบ)', 0.2);
  }
  const order = (ids) => { if (NC.ITEM_ORDER) for (const id of ids) if (ITEMS[id] && !NC.ITEM_ORDER.includes(id)) NC.ITEM_ORDER.push(id); };
  order(['robe_moonblade', 'gs_moonblade']);
  NC.Moonblade = { on: true };
})();
