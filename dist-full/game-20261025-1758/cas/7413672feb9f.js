/* items.js — equipment: item data with stats, inventory, loot drops and saving (the bag window: js/inventory.js).
   Slots: hat · glasses · hair · top · pants · shoes · weapon, each worn separately (glasses: js/glasses.js). How the hero is drawn from these
   layers lives in avatar.js. */
(function () {
  'use strict';
  const NC = window.NC;
  const FX = NC.FX;

  NC.RARITY = {
    common: { name: 'ธรรมดา', color: '#ece6d8', rgb: '236,230,216', w: 6 },
    rare: { name: 'หายาก', color: '#6fb6ff', rgb: '111,182,255', w: 4 },
    epic: { name: 'มหากาพย์', color: '#c792ff', rgb: '199,146,255', w: 2.2 },
    legend: { name: 'ตำนาน', color: '#ffc94d', rgb: '255,201,77', w: 1 },
    fashion: { name: 'แฟชั่น', color: '#ff9ad5', rgb: '255,154,213', w: 1.6 }, // the costume sets of fashion.js
  };
  // robe = a one-piece long robe (top + trousers in one, worn over them), cape = over any outfit
  const SLOTS = (NC.SLOTS = ['hat', 'glasses', 'hair', 'top', 'pants', 'robe', 'cape', 'shoes', 'weapon']);
  NC.SLOT_NAME = { hat: 'หมวก', glasses: 'แว่น', hair: 'ทรงผม', top: 'เสื้อ', pants: 'กางเกง', robe: 'ชุดยาว', cape: 'ผ้าคลุม', shoes: 'รองเท้า', weapon: 'อาวุธ' };
  const OFF = { hat: true, glasses: true, robe: true, cape: true }; // slots that can be empty: click the worn one again to take it off

  /* stats: hp / sp (max HP / SP), def / mdef (hard DEF / MDEF: % less damage), str agi vit int dex luk (base stat
     bonuses), hit / flee, spd (move speed), atk (basic attack), skill (skill damage), cdr (skill cooldown), crit.
     element: a weapon's attack element, a long outfit's armour element (stats.js: classic MMOs' ten).
     magic: the weapon's basic attack is magic (MATK x matkMul + the weapon's roll).
     Hair:          head = the head piece with that hairstyle (assets/head_*.png, lined up on the face).
     Top/pants/shoes: rig = which outfit's pieces to use (torso + arms / trouser legs / shoes).
     Hats:          fit = hat width / head width, seat = where its band (brim) sits, in head widths below the top
                    of the skull line; clip = hides the hair above the band, so the hat is worn, not perched on top.
     Weapons:       grip = where the hand holds it (0 = bottom end, 1 = tip): the middle of the wrapped handle, measured
                    on the picture, so the fist closes around it; grip2 = how far down the handle the other hand goes
                    (two-handed); restAng = direction while carried
                    (-PI/2 = straight up), behind = carried on the back, tuck = worn flat at the belt when not
                    fighting (grip = point held by the belt, ang = tip direction, PI = backwards),
                    stance = weapon direction in the fighting stance. */
  const ITEMS = (NC.ITEMS = {
    hair_spiky: { slot: 'hair', name: 'ผมฟูชี้', head: 'head_spiky', rarity: 'common', desc: 'ทรงประจำตัว' },
    hair_neat: { slot: 'hair', name: 'ผมสั้นเรียบ', head: 'head_neat', rarity: 'common', desc: 'เรียบร้อยสุภาพ' },
    hair_ponytail: { slot: 'hair', name: 'ผมหางม้า', head: 'head_ponytail', rarity: 'common', desc: 'มัดรวบ คล่องตัว' },
    hair_long: { slot: 'hair', name: 'ผมยาว', head: 'head_long', rarity: 'common', desc: 'ยาวประบ่า' },
    hair_buzz: { slot: 'hair', name: 'ผมสั้นเกรียน', head: 'head_buzz', rarity: 'common', desc: 'สั้นกุด ไม่ต้องหวี' },
    hair_brown: { slot: 'hair', name: 'ผมฟูสีน้ำตาล', head: 'head_spiky_brown', rarity: 'common', desc: 'ทรงเดิม สีน้ำตาลแบบนักธนู' },
    hair_curly: { slot: 'hair', name: 'ผมหยิก', head: 'head_curly', rarity: 'common', desc: 'หยิกฟูนุ่มนิ่ม' },

    top_traveler: { slot: 'top', name: 'เสื้อนักเดินทาง', rig: 'traveler', rarity: 'common', stats: {}, desc: 'เสื้อผ้าฝ้ายกับผ้าพันคอคู่ใจ' },
    top_ranger: { slot: 'top', name: 'เสื้อนักธนู', rig: 'ranger', rarity: 'rare', stats: { atk: 0.1 }, desc: 'เสื้อหนังสีเขียว ผ้าคลุมคอ กับซองลูกธนูบนหลัง' },
    top_knight: { slot: 'top', name: 'เกราะอกอัศวิน', rig: 'knight', rarity: 'epic', stats: { hp: 30 }, desc: 'เกราะเงินขัดเงา ผ้าพันคอกับผ้าคลุมสีแดง' },
    top_rogue: { slot: 'top', name: 'เสื้อหนังโจร', rig: 'rogue', rarity: 'epic', stats: { crit: 0.08, spd: 0.04 }, desc: 'หนังนุ่มเงียบกริบ กับผ้าพันคอสีเลือด' },
    top_mage: { slot: 'top', name: 'เสื้อคลุมนักเวท', rig: 'mage', rarity: 'epic', stats: { skill: 0.2, cdr: 0.1 }, desc: 'ผ้าสีกรมขลิบทอง ตราปีกทองที่อก' },
    pants_traveler: { slot: 'pants', name: 'กางเกงผ้า', rig: 'traveler', rarity: 'common', stats: {}, desc: 'กางเกงผ้าสีกรม' },
    pants_ranger: { slot: 'pants', name: 'กางเกงนักธนู', rig: 'ranger', rarity: 'rare', stats: { spd: 0.05 }, desc: 'สีเขียว พันแข้งด้วยหนัง' },
    pants_knight: { slot: 'pants', name: 'สนับขาเกราะ', rig: 'knight', rarity: 'epic', stats: { hp: 10, spd: -0.03 }, desc: 'เกราะขาเหล็กเงาทั้งท่อน' },
    pants_rogue: { slot: 'pants', name: 'กางเกงโจร', rig: 'rogue', rarity: 'rare', stats: { spd: 0.05 }, desc: 'รัดกุม ขยับตัวคล่อง' },
    pants_mage: { slot: 'pants', name: 'ชายเสื้อคลุมนักเวท', rig: 'mage', rarity: 'epic', stats: { cdr: 0.05 }, desc: 'ชายผ้ายาวถึงข้อเท้า ขลิบทอง' },
    // ชุดยาว (a whole outfit in one piece, worn over the top / trousers / shoes, which come back when it comes off): its
    // top and skirt are ONE garment picture (rig_<rig>_body, tools/body_piece.py), the legs whole with their boots
    robe_horned_king: { slot: 'robe', name: 'ชุดเกราะราชาเขาอสูร', rig: 'horned_king', rarity: 'legend', stats: { hp: 55, atk: 0.1 }, desc: 'เกราะดำขลิบทองทั้งชุด ผ้าคาดแดงยาวถึงกลางแข้ง' },
    robe_occult_priest: { slot: 'robe', name: 'ชุดคลุมนักบวชลัทธิมืด', rig: 'occult_priest', rarity: 'legend', stats: { skill: 0.25, cdr: 0.1 }, desc: 'ชุดคลุมดำซับแดงยาวถึงข้อเท้า ปักอักขระและกางเขนทอง' },
    robe_shadow_knight: { slot: 'robe', name: 'ชุดเกราะอัศวินเงา', rig: 'shadow_knight', rarity: 'legend', stats: { hp: 60, crit: 0.05 }, desc: 'เกราะดำทั้งชุด คอขนดำ บ่ากะโหลก ผ้าคาดแดงถึงเข่า' },
    robe_plague_shaman: { slot: 'robe', name: 'ชุดคลุมหมอผีโรคระบาด', rig: 'plague_shaman', rarity: 'legend', stats: { skill: 0.15, hp: 15, spd: 0.08 }, desc: 'ผ้าเขียวขาดวิ่นยาวถึงข้อเท้า สร้อยกระดูก ตะเกียงแดง' },
    robe_fallen_paladin: { slot: 'robe', name: 'ชุดเกราะพาลาดินผู้ร่วงหล่น', rig: 'fallen_paladin', rarity: 'legend', stats: { hp: 50, cdr: 0.05 }, desc: 'เกราะดำขลิบทอง ขนสัตว์ขาว ผ้าคาดขาวกางเขนดำ' },
    robe_infernal_warlock: { slot: 'robe', name: 'ชุดคลุมจอมเวทนรก', rig: 'infernal_warlock', rarity: 'legend', stats: { skill: 0.3, cdr: 0.05 }, desc: 'ชุดคลุมดำขลิบม่วงทองยาวถึงข้อเท้า' },
    // ผ้าคลุม (capes): their own slot, over any outfit
    cape_horned_king: { slot: 'cape', name: 'ผ้าคลุมราชาเขาอสูร', sprite: 'rig_horned_king_cape', rarity: 'legend', stats: { hp: 10 }, desc: 'ผ้าคลุมแดงขาดวิ่นยาวถึงข้อเท้า' },
    cape_shadow_knight: { slot: 'cape', name: 'ผ้าคลุมอัศวินเงา', sprite: 'rig_shadow_knight_cape', rarity: 'legend', stats: { atk: 0.03 }, desc: 'ผ้าคลุมแดงคอขนดำ' },
    cape_plague_shaman: { slot: 'cape', name: 'ผ้าคลุมหมอผี', sprite: 'rig_plague_shaman_cape', rarity: 'legend', stats: { spd: 0.03 }, desc: 'ผ้าคลุมเขียวซับแดง ขาดวิ่น' },
    cape_fallen_paladin: { slot: 'cape', name: 'ผ้าคลุมพาลาดินผู้ร่วงหล่น', sprite: 'rig_fallen_paladin_cape', rarity: 'legend', stats: { hp: 10 }, desc: 'ผ้าคลุมขาวขนสัตว์ ซับแดงเปื้อนเลือด' },
    cape_infernal_warlock: { slot: 'cape', name: 'ผ้าคลุมจอมเวทนรก', sprite: 'rig_infernal_warlock_cape', rarity: 'legend', stats: { skill: 0.05 }, desc: 'ผ้าคลุมแดงดำขาดวิ่น' },
    shoes_traveler: { slot: 'shoes', name: 'บูทหนัง', rig: 'traveler', rarity: 'common', stats: {}, desc: 'บูทหนังสีน้ำตาล' },
    shoes_ranger: { slot: 'shoes', name: 'บูทยาวพราน', rig: 'ranger', rarity: 'rare', stats: { spd: 0.07 }, desc: 'เดินป่าได้ทั้งวัน' },
    shoes_knight: { slot: 'shoes', name: 'รองเท้าเกราะ', rig: 'knight', rarity: 'epic', stats: { hp: 5, spd: -0.03 }, desc: 'เหล็กทั้งแท่ง' },
    shoes_rogue: { slot: 'shoes', name: 'บูทย่องเงียบ', rig: 'rogue', rarity: 'rare', stats: { spd: 0.06 }, desc: 'เดินไม่มีเสียง' },
    shoes_mage: { slot: 'shoes', name: 'รองเท้าผ้านุ่ม', rig: 'mage', rarity: 'epic', stats: { skill: 0.05 }, desc: 'เงียบกริบ' },

    hat_straw: { slot: 'hat', name: 'หมวกฟาง', sprite: 'hat_straw', rarity: 'common', fit: 1.4, seat: 0.286, dx: -0.109, clip: true, stats: { hp: 10, spd: 0.04 }, desc: 'กันแดดกันฝน',
      rim: [[0.0, 0.33], [0.0829, 0.42], [0.1658, 0.49], [0.2487, 0.55], [0.3315, 0.55], [0.4144, 0.55], [0.4973, 0.57], [0.5802, 0.56], [0.6631, 0.56], [0.746, 0.53], [0.8289, 0.49], [0.9117, 0.42], [0.9946, 0.3]], soft: 0.4 },
    hat_ranger: { slot: 'hat', name: 'หมวกพราน', sprite: 'hat_ranger', rarity: 'rare', fit: 1.13, seat: 0.31, dx: -0.177, clip: true, stats: { spd: 0.08, crit: 0.05 }, desc: 'ขนนกแดงของนักล่า',
      rim: [[0.0, 0.579], [0.0827, 0.6194], [0.1653, 0.6194], [0.248, 0.6435], [0.3307, 0.6677], [0.4133, 0.6919], [0.496, 0.6839], [0.5787, 0.6677], [0.6613, 0.6435], [0.744, 0.6274], [0.8267, 0.6274], [0.9093, 0.6435], [0.992, 0.5992]], soft: 0.5 },
    hat_helmet: { slot: 'hat', name: 'หมวกเหล็ก', sprite: 'hat_helmet', rarity: 'rare', fit: 1.26, seat: 0.393, dx: -0.107, clip: true, stats: { hp: 25 }, desc: 'เหล็กหนา กันหัวแตก',
      rim: [[0.0, 0.6508], [0.0826, 0.6967], [0.1653, 0.73], [0.2479, 0.7467], [0.3306, 0.7633], [0.4132, 0.7717], [0.4958, 0.7717], [0.5785, 0.7717], [0.6611, 0.7633], [0.7438, 0.7467], [0.8264, 0.73], [0.909, 0.6967], [0.9917, 0.6467]], soft: 0.2 },
    hat_cat: { slot: 'hat', name: 'บีนนี่หูแมว', sprite: 'hat_cat', rarity: 'rare', fit: 1.1, seat: 0.51, dx: -0.107, clip: true, stats: { crit: 0.1 }, desc: 'น่ารักจนศัตรูเผลอ',
      rim: [[0.0, 0.5934], [0.0828, 0.6619], [0.1656, 0.5813], [0.2484, 0.541], [0.3312, 0.5168], [0.414, 0.5006], [0.4968, 0.4926], [0.5795, 0.5006], [0.6623, 0.5168], [0.7451, 0.541], [0.8279, 0.5894], [0.9107, 0.6619], [0.9935, 0.5934]], soft: 1.0 },
    hat_flower: { slot: 'hat', name: 'มงกุฎดอกไม้', sprite: 'hat_flower', rarity: 'epic', fit: 0.92, seat: 0.193, dx: -0.17, clip: false, stats: { cdr: 0.1, hp: 10 }, desc: 'กลิ่นหอมช่วยให้ใจสงบ',
      rim: [[0.0, 0.1176], [0.0826, 0.2647], [0.1653, 0.3676], [0.2479, 0.4118], [0.3305, 0.3824], [0.4132, 0.4706], [0.4958, 0.4118], [0.5784, 0.3824], [0.6611, 0.4118], [0.7437, 0.3529], [0.8263, 0.3235], [0.909, 0.3382], [0.9916, 0.0882]], soft: 0.6, back: true },
    hat_knight: { slot: 'hat', name: 'หมวกอัศวินพู่แดง', sprite: 'hat_knight', rarity: 'epic', fit: 1.32, seat: 0.5, dx: 0, clip: true, stats: { hp: 30 }, desc: 'เหล็กกล้าเปิดหน้า พู่แดงสะบัด',
      rim: [[0.0, 0.2612], [0.0828, 0.3171], [0.1656, 0.35], [0.2484, 0.475], [0.3312, 0.5211], [0.414, 0.5539], [0.4968, 0.5934], [0.5796, 0.2579], [0.6624, 0.2645], [0.7452, 0.3039], [0.828, 0.5539], [0.9108, 0.5539], [0.9936, 0.2941]], soft: 0.15 },
    hat_hood: { slot: 'hat', name: 'ฮู้ดใบไม้นักธนู', sprite: 'hat_hood', rarity: 'rare', fit: 1.15, seat: 0.42, dx: 0, clip: false, stats: { crit: 0.06, spd: 0.04 }, desc: 'หมวกคลุมใบไม้ พรางตัวในป่า',
      rim: [[0.0, 0.205], [0.0827, 0.455], [0.1654, 0.5127], [0.2482, 0.5512], [0.3309, 0.5704], [0.4136, 0.2723], [0.4963, 0.205], [0.579, 0.1569], [0.6618, 0.1281], [0.7445, 0.1281], [0.8272, 0.5223], [0.9099, 0.455], [0.9926, 0.2098]], soft: 0.6 },
    hat_mage: { slot: 'hat', name: 'หมวกนักเวท', sprite: 'hat_mage', rarity: 'epic', fit: 1.45, seat: 0.45, dx: 0, clip: true, stats: { skill: 0.15, cdr: 0.05 }, desc: 'ผ้าสีกรมคาดหนัง หัวเข็มขัดทอง',
      rim: [[0.0, 0.5864], [0.0829, 0.6394], [0.1658, 0.6773], [0.2487, 0.6924], [0.3316, 0.5106], [0.4145, 0.4727], [0.4974, 0.4273], [0.5803, 0.397], [0.6632, 0.3742], [0.7461, 0.5561], [0.829, 0.5333], [0.9119, 0.4803], [0.9948, 0.4045]], soft: 1.0 },
    hat_horned_king: { slot: 'hat', name: 'มงกุฎเขาอสูร', sprite: 'hat_horned_king', rarity: 'legend', fit: 1.65, seat: 0.42, dx: 0, clip: true, stats: { atk: 0.1, crit: 0.05 }, desc: 'มงกุฎทองหนามแหลม เขาอสูรดำ',
      rim: [[0.0, 0.2938], [0.0829, 0.4125], [0.1658, 0.5188], [0.2488, 0.6062], [0.3317, 0.6062], [0.4146, 0.4062], [0.4975, 0.3625], [0.5804, 0.4], [0.6634, 0.4875], [0.7463, 0.4], [0.8292, 0.475], [0.9121, 0.4313], [0.995, 0.3063]], soft: 0.2 },
    hat_occult_priest: { slot: 'hat', name: 'ฮู้ดเขาแกะ', sprite: 'hat_occult_priest', rarity: 'legend', fit: 1.62, seat: 0.36, dx: -0.03, clip: true, stats: { skill: 0.15 }, desc: 'ฮู้ดดำปักกางเขนทอง เขาแกะขด',
      rim: [[0.0, 0.0563], [0.0829, 0.4313], [0.1658, 0.525], [0.2487, 0.5437], [0.3316, 0.5813], [0.4146, 0.5875], [0.4975, 0.5687], [0.5804, 0.1688], [0.6633, 0.1], [0.7462, 0.575], [0.8291, 0.55], [0.912, 0.55], [0.9949, 0.2]], soft: 0.2 },
    // (the boss's closed helm was cut from his picture and covered the wearer's whole face: redrawn open-faced as a hood,
    // assets/gen/boss_openhelms.prompt.txt, cut with tools/skincut.py hoods ... --raw nightcamp_boss_openhelms_raw.png)
    hat_shadow_knight: { slot: 'hat', name: 'หมวกเกราะเขาดำ', sprite: 'hat_shadow_knight_open', icon: 'hat_shadow_knight', art: 2, rarity: 'legend', fit: 1.666, seat: 0.665, dx: 0.06, clip: false, hood: true, soft: 0, stats: { hp: 20, atk: 0.05 }, desc: 'หมวกเกราะเหล็กดำเปิดหน้า เขาอสูรดำ' },
    // (the mask covers the face on purpose: the user keeps it as it was. An open-faced version exists, unused:
    // assets/fashion/hat_plague_shaman_open.png, hood: true, fit 1.565, seat 0.665, dx 0.06)
    hat_plague_shaman: { slot: 'hat', name: 'หน้ากากกะโหลกแพะ', sprite: 'hat_plague_shaman', rarity: 'legend', fit: 1.62, seat: 0.91, dx: 0, clip: true, stats: { crit: 0.08, skill: 0.05 }, desc: 'ฮู้ดเขียว หน้ากากกะโหลกแพะ เขาแกะ',
      rim: [[0.0, 0.4437], [0.0828, 0.4938], [0.1657, 0.5312], [0.2485, 0.5625], [0.3313, 0.5062], [0.4142, 0.4938], [0.497, 0.4938], [0.5798, 0.5], [0.6627, 0.5188], [0.7455, 0.5813], [0.8283, 0.5125], [0.9111, 0.5125], [0.994, 0.2875]], soft: 0.2 },
    hat_fallen_paladin: { slot: 'hat', name: 'มงกุฎกางเขนเขาอสูร', sprite: 'hat_fallen_paladin', rarity: 'legend', fit: 1.6, seat: 0.4, dx: 0, clip: true, stats: { hp: 15, atk: 0.05 }, desc: 'มงกุฎเหล็กกางเขนแดง โซ่ทอง เขาอสูร',
      rim: [[0.0, 0.2062], [0.0829, 0.3125], [0.1657, 0.6], [0.2486, 0.5125], [0.3315, 0.45], [0.4143, 0.4375], [0.4972, 0.4313], [0.5801, 0.4437], [0.6629, 0.4625], [0.7458, 0.5375], [0.8287, 0.5875], [0.9115, 0.3063], [0.9944, 0.1938]], soft: 0.2 },
    hat_infernal_warlock: { slot: 'hat', name: 'หมวกพ่อมดเขานรก', sprite: 'hat_infernal_warlock', rarity: 'legend', fit: 1.85, seat: 0.46, dx: 0, clip: true, stats: { skill: 0.2, cdr: 0.05 }, desc: 'หมวกพ่อมดม่วงดำ โซ่ทอง อัญมณีแดง เขาอสูร',
      rim: [[0.0, 0.45], [0.0828, 0.5687], [0.1657, 0.575], [0.2485, 0.4875], [0.3313, 0.4313], [0.4141, 0.4125], [0.497, 0.4062], [0.5798, 0.4062], [0.6626, 0.4188], [0.7455, 0.55], [0.8283, 0.6062], [0.9111, 0.4], [0.9939, 0.35]], soft: 0.2 },
    hat_wizard: { slot: 'hat', name: 'หมวกพ่อมด', sprite: 'hat_wizard', rarity: 'epic', fit: 1.23, seat: 0.337, dx: 0.118, clip: true, stats: { skill: 0.2 }, desc: 'พลังเวทพุ่งพล่าน',
      rim: [[0.0, 0.5844], [0.0829, 0.6456], [0.1659, 0.6456], [0.2488, 0.6067], [0.3318, 0.59], [0.4147, 0.6344], [0.4977, 0.6844], [0.5806, 0.7122], [0.6636, 0.7289], [0.7465, 0.7289], [0.8294, 0.7067], [0.9124, 0.6622], [0.9953, 0.5622]], soft: 1.0 },

    sword: { slot: 'weapon', name: 'ดาบนักเดินทาง', sprite: 'sword', rarity: 'common', style: 'swing', dmg: [38, 52], hitK: 1.25, cd: 0.34, dur: 0.22, hitAt: 0.06, reach: 150, arc: 1.3, kb: 240, grip: 0.2, restAng: -2.05, stance: -0.55, tuck: { grip: 0.3, ang: 1.05, at: [-9, -8], back: true }, sheath: { from: 0.355, x0: 0.3, x1: 0.7 }, aspd: 1, trailRgb: '200,230,255', desc: 'ฟันเร็ว สมดุล' },
    spear: { slot: 'weapon', name: 'หอกพายุ', sprite: 'spear', rarity: 'rare', style: 'thrust', dmg: [44, 58], hitK: 1.05, cd: 0.4, dur: 0.24, hitAt: 0.08, reach: 255, arc: 0.4, kb: 300, grip: 0.25, restAng: -1.62, stance: -0.25, twoHanded: true, grip2: 14, tuck: { grip: 0.45, ang: -2.05, at: [-5, -28], back: true }, aspd: 1, desc: 'แทงได้ไกล เป็นแนวตรง' },
    axe: { slot: 'weapon', name: 'ขวานป่าเถื่อน', sprite: 'axe', rarity: 'rare', style: 'swing', dmg: [52, 68], cd: 0.46, dur: 0.26, hitAt: 0.08, reach: 155, arc: 1.4, kb: 280, grip: 0.41, restAng: -1.95, stance: -0.95, tuck: { grip: 0.42, ang: 1.05, at: [-9, -8], back: true }, aspd: 0.9, trailRgb: '255,215,160', crit: 0.22, desc: 'โอกาสคริติคอลสูงมาก' },
    hammer: { slot: 'weapon', name: 'ค้อนศิลา', sprite: 'hammer', rarity: 'epic', style: 'smash', dmg: [62, 82], hitK: 1.7, cd: 0.6, dur: 0.34, hitAt: 0.17, reach: 160, arc: 1.5, kb: 420, grip: 0.33, restAng: -1.9, stance: -1.1, tuck: { grip: 0.42, ang: 1.05, at: [-9, -8], back: true }, twoHanded: true, grip2: 11, aspd: 0.9, trailRgb: '255,238,210', stun: 1.4, desc: 'ทุบแรง สั่นสะเทือน ศัตรูช้าลง' },
    greatsword: { slot: 'weapon', name: 'ดาบใหญ่ผู้พิทักษ์', sprite: 'greatsword', rarity: 'epic', style: 'swing', dmg: [74, 96], hitK: 2.2, cd: 0.66, dur: 0.34, hitAt: 0.12, reach: 195, arc: 1.75, kb: 380, grip: 0.25, restAng: -2.35, stance: -0.75, behind: true, twoHanded: true, grip2: 12, tuck: { grip: 0.2, ang: 1.95, at: [-6, -40], back: true }, sheath: { from: 0.345, x0: 0.3, x1: 0.7 }, aspd: 0.78, trailRgb: '255,232,160', slow: 0.3, desc: 'กวาดกว้าง ช้าแต่หนักมาก',
      sig: { idle: 'idleLow', set: 'heavy' } }, // its own moves: held low, point on the ground; rising slash -> cleave -> leap
    // bow: held in the far hand (upright, grip in the middle), the string drawn by the game (bow: where it is tied, as
    // fractions of the picture) so the near hand can pull it back to the cheek
    bow: { slot: 'weapon', name: 'ธนูยาวพราน', sprite: 'bow', icon: 'bow_icon', rarity: 'rare', style: 'arrow', dmg: [36, 48], cd: 0.4, dur: 0.3, hitAt: 0.1, range: 900, kb: 180, grip: 0.5, restAng: -1.5, stance: -1.5, bow: { x: 0.141, top: 0.08, bottom: 0.92 }, tuck: { grip: 0.5, ang: 1.0, at: [5, -24], back: true }, aspd: 1, trailRgb: '255,240,200', desc: 'ยิงไกล แม่นยำ',
      sig: { idle: 'idle', set: 'archer' } },
    // daggers: one in each hand (dual), quick and sharp: the samurai set's draw-cuts and dash-through suit them
    dagger: { slot: 'weapon', name: 'มีดคู่เงา', sprite: 'dagger', rarity: 'rare', style: 'swing', dmg: [26, 36], cd: 0.24, dur: 0.18, hitAt: 0.05, reach: 125, arc: 1.25, kb: 150, grip: 0.14, restAng: -1.9, stance: -0.5, dual: true, tuck: { grip: 0.25, ang: 2.5, at: [-4, -10], back: true }, aspd: 1.35, crit: 0.25, trailRgb: '255,150,150', desc: 'สองมือ เร็ว คริแรง',
      sig: { idle: 'idle', set: 'blade' } },
    staff: { slot: 'weapon', name: 'คทาผลึกจันทรา', sprite: 'staff', rarity: 'legend', style: 'bolt', dmg: [34, 44], cd: 0.34, dur: 0.22, hitAt: 0.06, range: 760, kb: 160, grip: 0.3, restAng: -1.6, stance: -1.15, tuck: { grip: 0.42, ang: -1.22, at: [15, -22], back: true }, aspd: 1.05, magic: true, matkMul: 0.45, stats: { skill: 0.2, int: 3 }, desc: 'ยิงลูกแก้วเวท (ดาเมจเวทจาก MATK) และเพิ่มพลังสกิล' },
  });
  if (NC.FASHION) Object.assign(ITEMS, NC.FASHION.items); // ชุดแฟชั่น (js/fashion.js): costume onesies + their hats
  if (NC.GLASSES) Object.assign(ITEMS, NC.GLASSES.items); // แว่น (js/glasses.js): eyewear, fitted onto each head's eyes
  if (NC.PRIEST) Object.assign(ITEMS, NC.PRIEST.items); // พระ (js/priest.js): the priest's outfit, cap and holy staff
  if (NC.CLASS2) Object.assign(ITEMS, NC.CLASS2.items); // the 2nd jobs (js/class2.js): their outfits, headgear and weapons
  if (NC.JOBS3) Object.assign(ITEMS, NC.JOBS3.items); // the new 2nd jobs (js/jobs3.js): outfits, headgear, the new weapon types, shields
  if (NC.LOOK) Object.assign(ITEMS, NC.LOOK.items); // หน้าตาที่สร้างเอง (js/look.js): my own hair and face, from the creator
  for (const id in ITEMS) ITEMS[id].id = id;

  // the armour pieces' defence (classic-MMO-like hard DEF / MDEF: % less damage) and base stat bonuses, put into their stats
  const ARMOUR = {
    top_traveler: { def: 4 }, top_ranger: { def: 5, dex: 2 }, top_knight: { def: 12, vit: 2 }, top_rogue: { def: 6, agi: 2 }, top_mage: { def: 3, mdef: 8, int: 2 },
    pants_traveler: { def: 2 }, pants_ranger: { def: 3, agi: 1 }, pants_knight: { def: 7 }, pants_rogue: { def: 3, luk: 1 }, pants_mage: { def: 2, mdef: 4 },
    shoes_traveler: { def: 1 }, shoes_ranger: { def: 2 }, shoes_knight: { def: 4 }, shoes_rogue: { def: 2, agi: 1 }, shoes_mage: { def: 1, mdef: 3 },
    robe_horned_king: { def: 16, mdef: 4, str: 3 }, robe_occult_priest: { def: 6, mdef: 16, int: 4 }, robe_shadow_knight: { def: 18, mdef: 3, vit: 3 },
    robe_plague_shaman: { def: 8, mdef: 12, int: 2, vit: 2 }, robe_fallen_paladin: { def: 15, mdef: 8, vit: 2, int: 1 }, robe_infernal_warlock: { def: 6, mdef: 18, int: 5 },
    cape_horned_king: { def: 3, mdef: 2 }, cape_shadow_knight: { def: 4, mdef: 1 }, cape_plague_shaman: { def: 2, mdef: 3 }, cape_fallen_paladin: { def: 3, mdef: 3 }, cape_infernal_warlock: { def: 2, mdef: 4 },
    hat_straw: { def: 1 }, hat_ranger: { def: 2, dex: 1 }, hat_helmet: { def: 5 }, hat_cat: { def: 1, luk: 2 }, hat_flower: { mdef: 3, int: 1 },
    hat_knight: { def: 6, vit: 1 }, hat_hood: { def: 2, dex: 1 }, hat_mage: { def: 1, mdef: 5, int: 2 }, hat_wizard: { def: 1, mdef: 4, int: 2 },
    hat_horned_king: { def: 5, mdef: 2, str: 2 }, hat_occult_priest: { def: 2, mdef: 5, int: 2 }, hat_shadow_knight: { def: 6, mdef: 2, vit: 1 },
    hat_plague_shaman: { def: 3, mdef: 4, luk: 2 }, hat_fallen_paladin: { def: 5, mdef: 4, vit: 1 }, hat_infernal_warlock: { def: 2, mdef: 5, int: 3 },
  };
  for (const id in ARMOUR) if (ITEMS[id]) ITEMS[id].stats = Object.assign({}, ARMOUR[id], ITEMS[id].stats);
  // elements: a weapon's attack, a long outfit's armour (the others are neutral)
  const ELEMENT = {
    spear: 'wind', hammer: 'earth', greatsword: 'holy', staff: 'water',
    robe_horned_king: 'earth', robe_occult_priest: 'shadow', robe_shadow_knight: 'undead', robe_plague_shaman: 'poison', robe_fallen_paladin: 'holy', robe_infernal_warlock: 'fire',
  };
  for (const id in ELEMENT) if (ITEMS[id]) ITEMS[id].element = ELEMENT[id];

  // hat fitting (animation lab: drag a hat on the hero, then save). Where each hat sits, kept in this browser and put
  // over the values above: dx = sideways (+ towards the face), seat = how low its band sits, fit = size (all in head widths)
  const HATFIT_KEY = 'nightcamp.hatfit.v1', HATFIT = ['dx', 'seat', 'fit'];
  // the fits made on the hat fitting page (studio/hats.html -> js/hatfit_data.js) go over the values in the code; the
  // code's own values are kept (NC.hatFitCode) so that page can go back to them
  const BAKED = (NC.HATFIT_DATA && NC.HATFIT_DATA.hats) || {}, BAKED_T = (NC.HATFIT_DATA && NC.HATFIT_DATA.t) || 0;
  NC.hatFitCode = {};
  for (const id in ITEMS) {
    const it = ITEMS[id];
    if (it.slot !== 'hat') continue;
    NC.hatFitCode[id] = { dx: it.dx || 0, seat: it.seat, fit: it.fit, clip: !!it.clip };
    const b = BAKED[id];
    if (b) for (const k of ['dx', 'seat', 'fit', 'clip']) if (b[k] !== undefined) it[k] = b[k];
  }
  const hatDefaults = {};
  for (const id in ITEMS) if (ITEMS[id].slot === 'hat') hatDefaults[id] = { dx: ITEMS[id].dx || 0, seat: ITEMS[id].seat, fit: ITEMS[id].fit };
  NC.hatFit = {
    defaults: hatDefaults,
    load() {
      try {
        const s = JSON.parse(localStorage.getItem(HATFIT_KEY) || '{}');
        // (a fit saved for a hat's older picture doesn't fit its new one: item.art counts the pictures, 1 by default)
        // (and a fit saved in this browser before the hat was fitted on the fitting page gives way to that one)
        for (const id in s) if (hatDefaults[id] && (s[id].art || 1) === (ITEMS[id].art || 1) && !(BAKED[id] && !((s[id].t || 0) > BAKED_T)))
          for (const k of HATFIT) if (Number.isFinite(s[id][k])) ITEMS[id][k] = s[id][k];
      } catch (e) { /* storage unavailable: the built-in fit */ }
    },
    // hats that differ from the built-in fit; true when stored
    save() {
      const out = {};
      for (const id in hatDefaults) {
        const it = ITEMS[id], d = hatDefaults[id];
        if (HATFIT.some((k) => Math.abs((it[k] || 0) - (d[k] || 0)) > 1e-6)) out[id] = { dx: +(it.dx || 0).toFixed(3), seat: +it.seat.toFixed(3), fit: +it.fit.toFixed(3), art: it.art || 1, t: Date.now() };
      }
      try { localStorage.setItem(HATFIT_KEY, JSON.stringify(out)); return true; } catch (e) { return false; }
    },
    stored() { try { return JSON.parse(localStorage.getItem(HATFIT_KEY) || '{}'); } catch (e) { return {}; } },
    reset(id) { Object.assign(ITEMS[id], hatDefaults[id]); },
  };
  NC.hatFit.load();
  // hats added by scripts loaded after this one (class3.js ...) get the same treatment when the game starts loading its
  // art: their code values kept, the fitting page's values put over them, then this browser's Lab fits
  NC.hatFit.adopt = function () {
    let n = 0;
    for (const id in ITEMS) {
      const it = ITEMS[id];
      if (it.slot !== 'hat' || hatDefaults[id]) continue;
      NC.hatFitCode[id] = { dx: it.dx || 0, seat: it.seat, fit: it.fit, clip: !!it.clip };
      const b = BAKED[id];
      if (b) for (const k of ['dx', 'seat', 'fit', 'clip']) if (b[k] !== undefined) it[k] = b[k];
      hatDefaults[id] = { dx: it.dx || 0, seat: it.seat, fit: it.fit };
      n++;
    }
    if (n) NC.hatFit.load();
  };
  (NC.assetsBefore || (NC.assetsBefore = [])).push(() => NC.hatFit.adopt());
  const ORDER = (NC.ITEM_ORDER = Object.keys(ITEMS)); // (js/greatswords.js adds its swords to the collection)
  // a new hero gets nothing but the sword and the plain traveler's clothes (the hair is the hero's own head) — 2026-10-18
  const START = ['hair_spiky', 'top_traveler', 'pants_traveler', 'sword'];
  const DEFAULT = { hat: null, glasses: null, hair: 'hair_spiky', top: 'top_traveler', pants: 'pants_traveler', robe: null, cape: null, weapon: 'sword' }; // (no shoes: js/lowermerge.js)

  // the picture(s) an item needs: nothing is offered in-game until its art is loaded
  NC.itemSprite = function (it) {
    switch (it.slot) {
      case 'hair': return it.head;
      case 'top': case 'robe': return 'rig_' + it.rig + '_torso';
      case 'pants': return 'pants_' + it.rig + '_legF';
      case 'shoes': return 'shoes_' + it.rig + '_legF';
      default: return it.sprite;
    }
  };
  NC.itemReady = function (id) {
    const it = ITEMS[id];
    return !!(it && NC.SPR[NC.itemSprite(it)]);
  };
  NC.weaponDef = (p) => ITEMS[p.equip.weapon];

  NC.gearStats = function (equip) {
    const st = { hp: 0, sp: 0, def: 0, mdef: 0, str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0, hit: 0, flee: 0, spd: 0, atk: 0, skill: 0, cdr: 0, crit: 0 };
    for (const slot of SLOTS) {
      if (equip.robe && (slot === 'top' || slot === 'pants' || slot === 'shoes')) continue; // under the long outfit: not worn
      const it = equip[slot] && ITEMS[equip[slot]];
      if (it && it.stats) for (const k in it.stats) st[k] += it.stats[k];
    }
    return st;
  };

  // the hero's numbers after a change of gear, stats, skills or level (stats.js NC.derive)
  NC.applyGear = function (game) {
    const p = game.player;
    p.stats = NC.gearStats(p.equip);
    if (!p.base) NC.initHero(p, {});
    p.d = NC.derive(p);
    const oldHp = p.maxHp, oldSp = p.maxSp;
    p.maxHp = p.d.maxHp; p.maxSp = p.d.maxSp;
    if (oldHp && p.maxHp > oldHp) p.hp += p.maxHp - oldHp; // more max HP heals by the same amount
    if (oldSp && p.maxSp > oldSp) p.sp += p.maxSp - oldSp;
    p.hp = Math.min(p.hp, p.maxHp);
    p.sp = Math.min(p.sp || 0, p.maxSp);
    if (NC.HUD && NC.HUD.refreshHead) NC.HUD.refreshHead(game);
  };

  // ---------------- classes: one rig, a whole look per class (outfit + headgear + weapon) ----------------
  NC.CLASSES = [
    { id: 'base', name: 'นักเดินทาง', icon: 'sword', items: { hair: 'hair_spiky', robe: null, cape: null, top: 'top_traveler', pants: 'pants_traveler', shoes: 'shoes_traveler', hat: null, weapon: 'sword' } },
    { id: 'knight', name: 'อัศวิน', icon: 'hat_knight', items: { hair: 'hair_spiky', robe: null, cape: null, top: 'top_knight', pants: 'pants_knight', shoes: 'shoes_knight', hat: 'hat_knight', weapon: 'sword' } },
    { id: 'mage', name: 'จอมเวท', icon: 'hat_mage', items: { hair: 'hair_spiky', robe: null, cape: null, top: 'top_mage', pants: 'pants_mage', shoes: 'shoes_mage', hat: 'hat_mage', weapon: 'staff' } },
    { id: 'archer', name: 'นักธนู', icon: 'bow', items: { hair: 'hair_brown', robe: null, cape: null, top: 'top_ranger', pants: 'pants_ranger', shoes: 'shoes_ranger', hat: 'hat_hood', weapon: 'bow' } },
    { id: 'rogue', name: 'โจร', icon: 'dagger', items: { hair: 'hair_spiky', robe: null, cape: null, top: 'top_rogue', pants: 'pants_rogue', shoes: 'shoes_rogue', hat: null, weapon: 'dagger' } },
    { id: 'horned_king', name: 'ราชาเขาอสูร', icon: 'hat_horned_king', boss: true, items: { robe: 'robe_horned_king', cape: 'cape_horned_king', hat: 'hat_horned_king' } },
    { id: 'occult_priest', name: 'นักบวชลัทธิมืด', icon: 'hat_occult_priest', boss: true, items: { robe: 'robe_occult_priest', cape: null, hat: 'hat_occult_priest' } },
    { id: 'shadow_knight', name: 'อัศวินเงา', icon: 'hat_shadow_knight', boss: true, items: { robe: 'robe_shadow_knight', cape: 'cape_shadow_knight', hat: 'hat_shadow_knight' } },
    { id: 'plague_shaman', name: 'หมอผีโรคระบาด', icon: 'hat_plague_shaman', boss: true, items: { robe: 'robe_plague_shaman', cape: 'cape_plague_shaman', hat: 'hat_plague_shaman' } },
    { id: 'fallen_paladin', name: 'พาลาดินผู้ร่วงหล่น', icon: 'hat_fallen_paladin', boss: true, items: { robe: 'robe_fallen_paladin', cape: 'cape_fallen_paladin', hat: 'hat_fallen_paladin' } },
    { id: 'infernal_warlock', name: 'จอมเวทนรก', icon: 'hat_infernal_warlock', boss: true, items: { robe: 'robe_infernal_warlock', cape: 'cape_infernal_warlock', hat: 'hat_infernal_warlock' } },
    ...(NC.FASHION ? NC.FASHION.sets : []), // fashion: true (a costume + its hat)
  ];
  // choosing a class puts on its whole look (its pieces join the collection)
  NC.equipClass = function (game, cid) {
    const C = NC.CLASSES.find((c) => c.id === cid), p = game.player;
    if (!C) return;
    for (const slot in C.items) {
      const id = C.items[slot];
      if (id === undefined) continue; // not part of this set: keep what is worn
      if (id && !NC.itemReady(id)) continue;
      if (id) p.owned.add(id);
      p.equip[slot] = id;
    }
    if (p.moves) p.moves.idle = 'idle'; // and the line-up's stance: upright, hands at the sides, weapon stowed
    NC.applyGear(game);
    FX.stars(p.x, p.y - 70, 14, '255,230,150', { speed: 220, size: 0.8 });
    NC.saveGame(game);
  };
  NC.classOf = (equip) => (NC.CLASSES.find((c) => Object.keys(c.items).every((s) => (c.items[s] || null) === (equip[s] || null))) || {}).id;

  NC.equip = function (game, id) {
    const p = game.player, it = ITEMS[id];
    if (!it || !p.owned.has(id) || !NC.itemReady(id)) return;
    if (OFF[it.slot] && p.equip[it.slot] === id) p.equip[it.slot] = null; // clicking the worn one takes it off
    else {
      p.equip[it.slot] = id;
      if (it.slot === 'top' || it.slot === 'pants' || it.slot === 'shoes') p.equip.robe = null; // one piece of an outfit: the long outfit comes off
    }
    p.fresh.delete(id);
    NC.applyGear(game);
    FX.stars(p.x, p.y - 70, 10, NC.RARITY[it.rarity].rgb, { speed: 200, size: 0.8 });
    NC.saveGame(game);
  };

  // ---------------- saving (per browser; the game still runs if storage is unavailable) ----------------
  const KEY = 'nightcamp.save.v1';
  // What other files keep beside the hero, in place of wrapping NC.saveGame (2026-10-25: 11 wraps): each (game) right
  // after this save, in the order added, with noSave too (each looks at it itself, as each wrap did). A file adds with
  // (NC.saveHooks || (NC.saveHooks = [])).push(f).
  NC.saveGame = function (game) {
    saveHero(game);
    for (const f of NC.saveHooks || []) f(game);
  };
  function saveHero(game) {
    const p = game.player;
    if (game.noSave) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ owned: [...p.owned], fresh: [...p.fresh], equip: p.equip, lv: p.lv, xp: p.xp, potions: p.potions, moves: p.moves,
        name: p.name, job: p.job, jobLv: p.jobLv, jobXp: p.jobXp, experienceVersion: p.experienceVersion, base: p.base, skills: p.skills, spPotions: p.spPotions, hotbar: p.hotbar, skillResetUsed: p.skillResetUsed }));
    } catch (e) { /* storage blocked: progress simply is not kept */ }
  }

  // What other files read beside the hero, in place of wrapping NC.loadGear (2026-10-25: 17 wraps): each (game, params)
  // right after this load, in the order added. A file adds with (NC.loadHooks || (NC.loadHooks = [])).push(f).
  NC.loadGear = function (game, params) {
    loadHero(game, params);
    for (const f of NC.loadHooks || []) f(game, params);
  };
  function loadHero(game, params) {
    const p = game.player;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (NC.ONLINE) { s = null; game.noSave = true; } // (online: the server holds the hero)
    p.owned = new Set(START.filter(NC.itemReady));
    p.fresh = new Set();
    p.equip = Object.assign({}, DEFAULT);
    if (s) {
      // saves from before the outfit was split into top / pants / shoes
      const owned = [];
      for (const id of s.owned || []) {
        const m = /^outfit_(\w+)$/.exec(id);
        if (m) owned.push('top_' + m[1], 'pants_' + m[1], 'shoes_' + m[1]);
        else owned.push(id);
      }
      const eq = Object.assign({}, s.equip || {});
      const om = eq.outfit && /^outfit_(\w+)$/.exec(eq.outfit);
      if (om) { eq.top = 'top_' + om[1]; eq.pants = 'pants_' + om[1]; eq.shoes = 'shoes_' + om[1]; }
      // saves from before the long outfits: a boss's own top / trousers / shoes -> its long outfit (robe_*); a boss top
      // brought its cape along -> the cape is an item of its own now
      const bossOf = (id) => { const m = /^(top|pants|shoes)_(\w+)$/.exec(id || ''); return m && ITEMS['robe_' + m[2]] ? m[2] : null; };
      for (const id of owned.slice()) {
        const b = bossOf(id);
        if (b) owned.push('robe_' + b);
        if (b && /^top_/.test(id) && ITEMS['cape_' + b]) owned.push('cape_' + b);
      }
      const tb = /^top_/.test(eq.top || '') && bossOf(eq.top);
      if (tb) {
        if (!eq.robe) eq.robe = 'robe_' + tb;
        if (!('cape' in eq) && ITEMS['cape_' + tb]) eq.cape = 'cape_' + tb;
      }
      // pieces that are gone: the ones that go with the top worn, or the defaults
      const wornRig = ITEMS[eq.top] && ITEMS[eq.top].rig;
      for (const slot of ['top', 'pants', 'shoes']) {
        if (eq[slot] && !ITEMS[eq[slot]]) {
          const alt = wornRig && slot + '_' + wornRig;
          eq[slot] = alt && ITEMS[alt] && owned.includes(alt) ? alt : undefined;
        }
      }
      for (const id of owned) if (NC.itemReady(id)) p.owned.add(id);
      for (const id of s.fresh || []) if (p.owned.has(id)) p.fresh.add(id);
      for (const slot of SLOTS) {
        const id = eq[slot];
        if (OFF[slot] && id === null) p.equip[slot] = null;
        else if (id && ITEMS[id] && ITEMS[id].slot === slot && p.owned.has(id)) p.equip[slot] = id;
      }
      if (s.lv) { p.lv = NC.clamp(Math.round(s.lv), 1, NC.LV_MAX); p.xp = s.xp || 0; }
      if (typeof s.potions === 'number') p.potions = s.potions;
      if (s.moves) { // the move sets picked in the animation lab
        const A = NC.Anim;
        if (A.BASE[s.moves.idle]) p.moves.idle = s.moves.idle;
        if (A.SETS[s.moves.set] || s.moves.set === 'custom') p.moves.set = s.moves.set;
        if (s.moves.sig === false) p.moves.sig = false; // weapon moves (the greatsword's own) turned off
        const cu = s.moves.custom;
        if (cu && Array.isArray(cu.combo) && cu.combo.length === 3 && cu.combo.every((n) => A.CLIPS[n]))
          p.moves.custom = { ready: A.BASE[cu.ready] ? cu.ready : 'ready', combo: cu.combo.slice() };
      }
    }
    NC.initHero(p, s || {}); // name, job, base stats, skills (an old save: stats 5, its points to spend)
    p.skillResetUsed = Object.assign({}, s && s.skillResetUsed);
    NC.applyGear(game);
    p.hp = p.maxHp; p.sp = p.maxSp;
  }

  // ---------------- loot ----------------
  NC.dropLoot = function (game, x, y) {
    const p = game.player;
    const pot = Math.random();
    if (pot < 0.22) game.loot.push({ kind: 'loot', potion: pot < 0.14 ? 'red' : 'blue', x: x + NC.rand(-30, 30), y: y + NC.rand(-10, 10), sort: y, t: 0, z: 0, vz: 480 });
    const pool = ORDER.filter((id) => NC.itemReady(id) && !ITEMS[id].inst && !p.owned.has(id) && !game.loot.some((l) => l.id === id)); // (inst: weapons with their own drop tables, js/wbag.js)
    if (!pool.length || Math.random() > 0.4) return;
    let r = Math.random() * pool.reduce((s, id) => s + NC.RARITY[ITEMS[id].rarity].w, 0);
    let id = pool[0];
    for (const c of pool) { r -= NC.RARITY[ITEMS[c].rarity].w; if (r <= 0) { id = c; break; } }
    game.loot.push({ kind: 'loot', id, x, y, sort: y, t: 0, z: 0, vz: 520 });
    FX.stars(x, y - 40, 8, NC.RARITY[ITEMS[id].rarity].rgb, { speed: 220 });
  };

  NC.updateLoot = function (game, dt) {
    const p = game.player;
    for (const l of game.loot) {
      l.t += dt;
      if (l.vz || l.z > 0) {
        l.vz -= 1600 * dt;
        l.z += l.vz * dt;
        if (l.z <= 0) { l.z = 0; l.vz = l.vz < -200 ? -l.vz * 0.35 : 0; }
      }
      if (p.dead > 0 || l.t < 0.7) continue;
      const d = NC.dist(l.x, l.y, p.x, p.y);
      if (d < 140) { const k = Math.min(1, dt * 7); l.x += (p.x - l.x) * k; l.y += (p.y - l.y) * k; l.sort = l.y; }
      if (d < 44 && l.potion) {
        l.done = true;
        // (js/potions.js: l.size s / m / l, a drop of its monster's level)
        const q = NC.POT ? NC.POT.add(p, l.potion, l.size) : null;
        if (!q) { if (l.potion === 'red') p.potions++; else p.spPotions++; }
        if (NC.Lessons) NC.Lessons.ev('loot');
        FX.stars(p.x, p.y - 70, 8, l.potion === 'red' ? '255,120,140' : '120,180,255', { speed: 200, size: 0.7 });
        NC.HUD.log(`ได้รับ ${q ? `${q.name} (${q.stat.toUpperCase()})` : l.potion === 'red' ? 'ยาแดง (HP)' : 'ยาฟ้า (SP)'} x1`, 'item');
        continue;
      }
      if (d < 44) {
        l.done = true;
        const it = ITEMS[l.id];
        p.owned.add(l.id); p.fresh.add(l.id);
        if (NC.Lessons) NC.Lessons.ev('loot');
        FX.stars(p.x, p.y - 70, 14, NC.RARITY[it.rarity].rgb, { speed: 260 });
        FX.ring(p.x, p.y, 20, 150, NC.RARITY[it.rarity].rgb, 0.5, 8);
        game.toast(`ได้รับ ${it.name}!  กด I เพื่อสวมใส่`);
        NC.HUD.log(`ได้รับไอเทม ${it.name}`, 'item');
        NC.saveGame(game);
      }
    }
    game.loot = game.loot.filter((l) => !l.done);
  };

  NC.drawLoot = function (ctx, game, l) {
    if (l.potion) { // a potion: just the flask, bobbing (its size's flask: js/potions.js)
      const q = NC.POT && NC.POT.defOf(l.potion, l.size || 's');
      const s = (q && NC.SPR[q.icon]) || NC.SPR[l.potion === 'red' ? 'ic_potion' : 'ic_sppotion'] || NC.SPR.ic_potion, bob = Math.sin(game.time * 4 + l.x * 0.02) * 4;
      if (s) ctx.drawImage(s.img, l.x - 22, l.y - 62 - l.z + bob, 44, 44 * (s.h / s.w));
      return;
    }
    const it = ITEMS[l.id], R = NC.RARITY[it.rarity];
    const t = game.time, bob = Math.sin(t * 3 + l.x * 0.01) * 6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createLinearGradient(0, l.y - 190, 0, l.y);
    beam.addColorStop(0, `rgba(${R.rgb},0)`); beam.addColorStop(1, `rgba(${R.rgb},0.45)`);
    ctx.fillStyle = beam;
    ctx.fillRect(l.x - 18, l.y - 190, 36, 190);
    ctx.strokeStyle = `rgba(${R.rgb},${0.6 + 0.3 * Math.sin(t * 5)})`;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(l.x, l.y, 44, 16, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    const icon = NC.itemIcon(l.id, 128);
    ctx.drawImage(icon, l.x - 34, l.y - 100 - l.z + bob, 68, 68);
  };

  // ---------------- icons ----------------
  const iconCache = new Map();
  // draw pieces pinned at their joints onto a canvas, then fit that into the icon
  function composeFit(c, px, box, draw) {
    const k = Math.min((px * 0.88) / box.w, (px * 0.88) / box.h);
    c.save();
    c.translate((px - box.w * k) / 2, (px - box.h * k) / 2);
    c.scale(k, k);
    c.translate(-box.x, -box.y);
    draw(c);
    c.restore();
  }
  // a weapon sprite turned 45° for its icon: the box of its drawn pixels and their centre's offset from the turning
  // point, in sprite units (once per sprite). 2026-10-06: the icon used to draw every weapon 1.22 x the icon long, which
  // cut off 889 of them (axe and scythe heads, knuckles, books, orbs...): now each is fitted to its own shape
  const turnBox = new Map();
  function turned(s) {
    let r = turnBox.get(s);
    if (r) return r;
    const S = 256 / Math.max(s.w, s.h), D = Math.ceil((s.w + s.h) * S * Math.SQRT1_2) + 4, cv = document.createElement('canvas');
    cv.width = cv.height = D;
    const g = cv.getContext('2d');
    g.translate(D / 2, D / 2); g.rotate(Math.PI / 4);
    g.drawImage(s.img, (-s.w * S) / 2, (-s.h * S) / 2, s.w * S, s.h * S);
    const d = g.getImageData(0, 0, D, D).data;
    let x0 = D, y0 = D, x1 = -1, y1 = -1;
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) if (d[(y * D + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    r = x1 < 0 ? { w: s.w, h: s.h, cx: 0, cy: 0 }
      : { w: (x1 - x0 + 1) / S, h: (y1 - y0 + 1) / S, cx: ((x0 + x1 + 1) / 2 - D / 2) / S, cy: ((y0 + y1 + 1) / 2 - D / 2) / S };
    turnBox.set(s, r);
    return r;
  }
  NC.itemIcon = function (id, px, locked) {
    const key = id + '@' + px + (locked ? '#' : '');
    if (iconCache.has(key)) return iconCache.get(key);
    const it = ITEMS[id], cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high';
    const fitOne = (s) => composeFit(c, px, { x: 0, y: 0, w: s.w, h: s.h }, (g) => g.drawImage(s.img, 0, 0, s.w, s.h));
    if (it.slot === 'weapon') {
      // on the diagonal as before, as long as it fits: its drawn pixels, turned, stay inside 92% of the icon, centred
      const s = NC.SPR[it.icon || it.sprite], tb = turned(s), k = Math.min((px * 1.22) / s.h, (px * 0.92) / Math.max(tb.w, tb.h));
      c.translate(px / 2 - tb.cx * k, px / 2 - tb.cy * k); c.rotate(Math.PI / 4);
      c.drawImage(s.img, -(s.w * k) / 2, -(s.h * k) / 2, s.w * k, s.h * k);
    } else if (it.slot === 'top' || it.slot === 'robe') {
      // torso with both sleeves hanging from the shoulders
      const T = NC.SPR['rig_' + it.rig + '_torso'], A = NC.SPR['rig_' + it.rig + '_armF'], B = NC.SPR['rig_' + it.rig + '_armB'];
      const BD = NC.SPR['rig_' + it.rig + '_body'], K = !BD && NC.SPR['rig_' + it.rig + '_skirt'], tj = T.joints;
      const sl = tj.shoulderL, sr = tj.shoulderR;
      const ax = sl[0] - A.joints.shoulder[0], bx = sr[0] - B.joints.shoulder[0];
      // the skirt where the rig hangs it (avatar.js: 11 above the pelvis, a robe's skirtUp); a long outfit's legs whole,
      // pinned 9 up under the torso (avatar.js TUCK): the front leg on the left hip, the back one on the right
      const kx = K ? tj.pelvis[0] - K.joints.waist[0] : 0, ky = K ? tj.pelvis[1] - (it.skirtUp || 11) - K.joints.waist[1] : 0;
      const LF = it.slot === 'robe' && NC.SPR['rig_' + it.rig + '_legF'], LB = it.slot === 'robe' && NC.SPR['rig_' + it.rig + '_legB'];
      const legAt = (L, hip) => [hip[0] - L.joints.hip[0], hip[1] - 9 - L.joints.hip[1]];
      const pf = LF && legAt(LF, tj.hipL), pb = LB && legAt(LB, tj.hipR);
      // (the one-garment body is the torso with its skirt: placed by its pelvis on the torso's)
      const bdx = BD ? tj.pelvis[0] - BD.joints.pelvis[0] : 0, bdy = BD ? tj.pelvis[1] - BD.joints.pelvis[1] : 0;
      const x0 = Math.min(0, ax, bx, K ? kx : 0, pf ? pf[0] : 0, pb ? pb[0] : 0, BD ? bdx : 0);
      const x1 = Math.max(T.w, ax + A.w, bx + B.w, K ? kx + K.w : 0, pf ? pf[0] + LF.w : 0, pb ? pb[0] + LB.w : 0, BD ? bdx + BD.w : 0);
      const y1 = Math.max(T.h, sl[1] - A.joints.shoulder[1] + A.h, K ? ky + K.h : 0, pf ? pf[1] + LF.h : 0, pb ? pb[1] + LB.h : 0, BD ? bdy + BD.h : 0);
      composeFit(c, px, { x: x0, y: 0, w: x1 - x0, h: y1 }, (g) => {
        g.drawImage(B.img, bx, sr[1] - B.joints.shoulder[1], B.w, B.h);
        if (pb) g.drawImage(LB.img, pb[0], pb[1], LB.w, LB.h);
        if (pf) g.drawImage(LF.img, pf[0], pf[1], LF.w, LF.h);
        if (K && !it.skirtUp) g.drawImage(K.img, kx, ky, K.w, K.h);
        if (BD) g.drawImage(BD.img, bdx, bdy, BD.w, BD.h);
        else g.drawImage(T.img, 0, 0, T.w, T.h);
        if (K && it.skirtUp) g.drawImage(K.img, kx, ky, K.w, K.h);
        g.drawImage(A.img, ax, sl[1] - A.joints.shoulder[1], A.w, A.h);
      });
    } else if (it.slot === 'pants') {
      // (the legs with their boots, js/lowerbody.js; the bare trouser pieces if there are none)
      const leg = (w) => (NC.lowerLeg && NC.lowerLeg(it, w)) || NC.SPR['pants_' + it.rig + '_' + w];
      const L = leg('legF'), R = leg('legB');
      const gap = L.w * 0.62;
      composeFit(c, px, { x: 0, y: 0, w: gap + R.w, h: Math.max(L.h, R.h) }, (g) => {
        g.drawImage(R.img, gap, 0, R.w, R.h);
        g.drawImage(L.img, 0, 0, L.w, L.h);
      });
    } else fitOne(NC.SPR[it.icon && NC.SPR[it.icon] ? it.icon : NC.itemSprite(it)]); // (an icon of its own: a hat in two layers, fashion.js)
    if (locked) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = 'rgba(24,20,34,0.92)';
      c.fillRect(0, 0, px, px);
    }
    iconCache.set(key, cv);
    return cv;
  };

  // the old collection screen (the dark window I opened) is gone: the bag (js/inventory.js) took its place. Left here:
  // which accessory slot the bag's pick fills (set by js/inventory.js, read by js/acc.js's NC.equip)
  NC.EquipUI = { accPick: null };
})();
