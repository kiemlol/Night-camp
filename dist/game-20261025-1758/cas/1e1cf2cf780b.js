/* fashion.js — ชุดแฟชั่น: cute costume sets, each a plush onesie (a long outfit: top + trousers + shoes in one, the legs
   drawn whole with their feet) plus its matching hat. Loaded before items.js, which merges NC.FASHION.items into
   NC.ITEMS and puts the sets in the equipment screen's "ชุดแฟชั่น" row (one click = the whole costume).
   Art: assets/fashion/ + assets/fashion.manifest.js, made with assets/gen/make_fashion_prompts.py -> Codex ->
   tools/rigcut.py --dir fashion (the onesies) / tools/cutout.py --dir fashion (the hats).
   Hats: fit / seat / dx as in items.js (the Lab's hat fitting works on them too), rim + soft from tools/hat_parts.py. */
(function () {
  'use strict';
  const NC = window.NC;
  const items = {}, sets = [];
  // set id, costume name, hat name, costume stats, hat stats, costume text, hat text, hat fit
  const add = (id, suit, hat, sStats, hStats, sDesc, hDesc, fit) => {
    items['robe_' + id] = { slot: 'robe', name: suit, rig: id, rarity: 'fashion', stats: sStats, desc: sDesc };
    items['hat_' + id] = Object.assign({ slot: 'hat', name: hat, sprite: 'hat_' + id, rarity: 'fashion', clip: true, stats: hStats, desc: hDesc }, fit);
    sets.push({ id: 'fashion_' + id, name: suit.replace(/^ชุด/, ''), icon: 'hat_' + id, fashion: true, items: { robe: 'robe_' + id, cape: null, hat: 'hat_' + id } });
  };
  add('duck', 'ชุดเป็ด', 'หมวกเป็ด', { def: 3, flee: 4, spd: 0.04 }, { luk: 2 },
    'ชุดตัวเป็ดสีเหลืองนุ่มฟู พุงขาว หางกระดกนิด ๆ เท้าพังผืดสีส้ม', 'ปากเป็ดสีส้มยื่นออกมาเหมือนปีกหมวก',
    { fit: 1.25, seat: 0.44, dx: 0.0, soft: 0.6,
      rim: [[0.0, 0.6554], [0.0828, 0.6821], [0.1657, 0.6196], [0.2485, 0.575], [0.3314, 0.5393], [0.4142, 0.5839], [0.4971, 0.6196], [0.5799, 0.6464], [0.6628, 0.6464], [0.7456, 0.6107], [0.8285, 0.5661], [0.9113, 0.575], [0.9942, 0.5393]] });
  add('mushroom', 'ชุดเห็ด', 'หมวกเห็ด', { def: 3, mdef: 5, vit: 1 }, { mdef: 2, int: 1 },
    'ชุดผ้าถักสีครีมเหมือนก้านเห็ด ปกระบายฟู รองเท้าเห็ดจุดขาว', 'หมวกเห็ดแดงจุดขาว บานกว้างกันแดดกันฝน',
    { fit: 1.5, seat: 0.5, dx: 0.0, soft: 0.25,
      rim: [[0.0, 0.64], [0.083, 0.7213], [0.166, 0.7275], [0.249, 0.5838], [0.332, 0.515], [0.415, 0.4588], [0.498, 0.4213], [0.581, 0.4025], [0.664, 0.3963], [0.747, 0.415], [0.83, 0.615], [0.913, 0.5588], [0.996, 0.415]] });
  add('frog', 'ชุดกบ', 'หมวกกบ', { def: 3, agi: 2, hit: 3 }, { agi: 1, luk: 1 },
    'ชุดตัวกบสีเขียวลายจุด พุงเหลืองอ่อน ปกใบไม้ เท้าพังผืด', 'ตาโปนกลมโต แก้มชมพู ยิ้มแป้น',
    { fit: 1.24, seat: 0.44, dx: 0.0, soft: 0.3,
      rim: [[0.0, 0.6554], [0.0829, 0.6911], [0.1657, 0.6464], [0.2486, 0.5929], [0.3314, 0.5482], [0.4143, 0.5036], [0.4972, 0.4679], [0.58, 0.4411], [0.6629, 0.4232], [0.7457, 0.4143], [0.8286, 0.4232], [0.9115, 0.4679], [0.9943, 0.4857]] });
  add('panda', 'ชุดแพนด้า', 'หมวกแพนด้า', { def: 5, vit: 2, hp: 20 }, { vit: 1, def: 1 },
    'ชุดหมีแพนด้าขาวดำ ขนนุ่มฟู เข็มกลัดใบไผ่ หางกลมสีดำ', 'หูกลมสีดำ หน้าแพนด้าตาปรือ',
    { fit: 1.3, seat: 0.46, dx: 0.0, soft: 0.5,
      rim: [[0.0, 0.0182], [0.0829, 0.3894], [0.1657, 0.4197], [0.2486, 0.3591], [0.3315, 0.2985], [0.4144, 0.2379], [0.4972, 0.1924], [0.5801, 0.1621], [0.663, 0.1318], [0.7458, 0.1167], [0.8287, 0.1242], [0.9116, 0.147], [0.9944, 0.147]] });
  add('bunny', 'ชุดกระต่าย', 'หมวกกระต่าย', { def: 2, agi: 1, spd: 0.06 }, { luk: 2 },
    'ชุดกระต่ายสีชมพูพาสเทล พุงขาวฟู เข็มกลัดแครอท หางปุยกลม', 'หูกระต่ายยาว ปลายหูข้างหนึ่งพับลงมา',
    { fit: 1.24, seat: 0.45, dx: 0.0, soft: 0.9,
      rim: [[0.0, 0.4324], [0.0828, 0.4932], [0.1657, 0.4392], [0.2485, 0.3919], [0.3314, 0.3446], [0.4142, 0.3108], [0.497, 0.277], [0.5799, 0.2568], [0.6627, 0.2432], [0.7456, 0.2432], [0.8284, 0.2635], [0.9112, 0.0811], [0.9941, 0.0473]] });
  add('pumpkin', 'ชุดฟักทอง', 'หมวกฟักทอง', { def: 3, mdef: 3, luk: 2 }, { luk: 1, int: 1 },
    'เสื้อฟักทองพองกลม ยิ้มแบบแจ็คโอแลนเทิร์น ปกใบฟักทอง ถุงน่องลายทาง', 'ผลฟักทองส้มกลม ขั้วม้วน ใบเขียว',
    { fit: 1.26, seat: 0.45, dx: 0.0, soft: 0.3,
      rim: [[0.0, 0.6428], [0.0829, 0.7331], [0.1658, 0.6914], [0.2486, 0.6428], [0.3315, 0.5942], [0.4144, 0.5386], [0.4973, 0.5039], [0.5801, 0.4692], [0.663, 0.4483], [0.7459, 0.4414], [0.8288, 0.4483], [0.9116, 0.4692], [0.9945, 0.4692]] });
  // skins from the user's pictures: the costume's own chunky pieces, a tail of its own (rig_<id>_tail, avatar.js), and a
  // HOOD round the face (hood: the head shows only inside its outline, hat_<id>_fill; fit / seat / dx from
  // tools/skincut.py, which fits the hood's opening onto the face)
  const addSkin = (id, suit, hood, sStats, hStats, sDesc, hDesc, fit) => {
    items['robe_' + id] = { slot: 'robe', name: suit, rig: id, rarity: 'fashion', stats: sStats, desc: sDesc };
    items['hat_' + id] = Object.assign({ slot: 'hat', name: hood, sprite: 'hat_' + id, rarity: 'fashion', clip: false, hood: true, soft: 0, stats: hStats, desc: hDesc }, fit);
    sets.push({ id: 'fashion_' + id, name: suit.replace(/^ชุด/, ''), icon: 'hat_' + id, fashion: true, items: { robe: 'robe_' + id, cape: null, hat: 'hat_' + id } });
  };
  addSkin('leopard', 'ชุดเสือดาวหิมะ', 'ฮู้ดเสือดาวหิมะ', { def: 3, agi: 2, crit: 0.03 }, { agi: 1, luk: 1 },
    'เสื้อขนเสือดาวหิมะลายจุด ปกขนฟูสีขาว ผ้าคาดเอวลายจุด กางเกงม่วงหลวม ถุงมือและเท้าอุ้งเท้าใหญ่ หางยาวฟู',
    'หัวเสือดาวหิมะตาเหลือง เขี้ยวคู่ห้อยเหนือหน้าผาก', { fit: 1.289, seat: 0.665, dx: 0.06 });
  addSkin('pinkdino', 'ชุดไดโนชมพู', 'ฮู้ดไดโนชมพู', { def: 4, str: 1, hp: 15 }, { vit: 1, luk: 1 },
    'ชุดไดโนเสาร์สีชมพูนุ่มนิ่ม พุงสีชมพูอ่อน หนามขาวตามหลัง เท้าไดโนมีเล็บ หางมีหนาม',
    'หัวไดโนสีชมพู ฟันขาวรอบหน้า หนามขาวเรียงตามหลัง', { fit: 1.264, seat: 0.665, dx: 0.06 });
  addSkin('blackdino', 'ชุดไดโนดำ', 'ฮู้ดไดโนดำ', { def: 4, str: 2 }, { str: 1, def: 1 },
    'ชุดไดโนเสาร์สีดำนุ่มนิ่ม พุงสีเทาอ่อน หนามขาวตามหลัง เท้าไดโนมีเล็บ หางมีหนาม',
    'หัวไดโนสีดำ ฟันขาวรอบหน้า หนามขาวเรียงตามหลัง', { fit: 1.278, seat: 0.665, dx: 0.06 });
  // the nine-tailed fox: no hood: fox ears behind the head (hat.back: the hair hides their bases) and the ornaments in
  // front of it (hat.front, the same canvas), the ears bouncing a little (soft); nine tails in a fan (robe.tails, three
  // pictures drawn nine times) and two floating fox fires (robe.wisps: from the pelvis, the first behind the body)
  addSkin('kitsune', 'ชุดจิ้งจอกเก้าหาง', 'หูจิ้งจอกกับปิ่นกระดิ่ง', { mdef: 5, int: 3, skill: 0.05 }, { int: 1, luk: 1 },
    'ชุดมิโกะจิ้งจอกเก้าหาง กิโมโนขาวลายซากุระ โอบิแดงโบว์ใหญ่กับกระดิ่งทอง แขนเสื้อยาวพู่แดง ถุงน่องดำ หางขาวปลายชมพู 9 หาง ไฟจิ้งจอกลอยรอบตัว',
    'หูจิ้งจอกขาวในชมพู ปิ่นดอกเหมยแดง กระดิ่งทองกับพู่แดง', { fit: 0.925, seat: 0, dx: 0, hood: false, back: true, front: 'hat_kitsune_front', icon: 'hat_kitsune_icon', soft: 0.35 });
  Object.assign(items.robe_kitsune, {
    tails: { n: 9, spread: [-0.3, 2.75], len: [0.9, 1.08], shorten: 0.18, sprites: ['rig_kitsune_tail', 'rig_kitsune2_tail', 'rig_kitsune3_tail'] },
    wisps: [[-62, -104], [52, -40]],
  });
  // three plush cats: round and chubby, big balloon trousers, a cat hood with the cat's face on top, a curled tail
  addSkin('calico', 'ชุดแมวสามสี', 'ฮู้ดแมวสามสี', { def: 3, luk: 3, flee: 3 }, { luk: 1, agi: 1 },
    'ชุดแมวสามสีขาวส้มดำตัวอ้วนกลม ปกขนฟู ผ้าคาดเอวลายทอ กางเกงบอลลูนตัวใหญ่ อุ้งเท้าชมพู หางม้วน',
    'หัวแมวสามสี หูใหญ่ แก้มชมพู หนวดยาว ปากแมว', { fit: 1.226, seat: 0.665, dx: 0.06 });
  addSkin('blackcat', 'ชุดแมวดำ', 'ฮู้ดแมวดำ', { def: 3, agi: 2, crit: 0.04 }, { agi: 1, luk: 1 },
    'ชุดแมวดำตัวอ้วนกลม ปกขนฟูสีขาว ผ้าคาดเอวลายทอ กางเกงบอลลูนตัวใหญ่ เท้าอุ้งเท้าดำนิ้วขาว หางม้วน',
    'หัวแมวดำตาสีทอง หนวดขาว ขอบขนฟูสีขาวรอบหน้า', { fit: 1.236, seat: 0.665, dx: 0.06 });
  addSkin('whitecat', 'ชุดแมวขาว', 'ฮู้ดแมวขาว', { def: 3, vit: 2, mdef: 3 }, { vit: 1, luk: 1 },
    'ชุดแมวขาวตัวอ้วนกลม ลายรอยเท้าแมวสีชมพู ผ้าคาดเอวลายทอ กางเกงบอลลูนตัวใหญ่ อุ้งเท้าชมพู หางม้วน',
    'หัวแมวขาว หูในชมพู แก้มชมพู ปากแมว', { fit: 1.218, seat: 0.665, dx: 0.06 });
  // (round and chubby: the balloon trousers drawn wider, the body a little wider: avatar.js robe.chub)
  for (const id of ['calico', 'blackcat', 'whitecat']) items['robe_' + id].chub = { legs: 1, body: 1.04 };
  NC.FASHION = { items, sets };
})();
