/* monsters6.js — written by assets/gen/loot/monsters6_build.py (edit that, not this). The expansion's part 1 (Lv 1-99):
   79 new species for the zone maps (js/fields5.js) and the dungeons (js/dungeons3.js), using monkinds.js's new ways to
   fight; the zone forms (ร่างโซน) of 22 old species (their art hue-shifted at load, stronger, their own drop tables); four
   zone bosses on dunbosses.js's fight; every new species' own material. Art: assets/monsters/ from
   assets/gen/make_monster6_prompts.py. Load after monkinds.js and dungeons2.js. */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC.SPECIES || !NC.ROSTER) return;
  const SLIME = { kind: 'hop', r: 26, hpK: 0.65, atkK: 0.75, defK: 0.4, mdefK: 1.2, agiK: 0.3, dexK: 0.5, expK: 0.8, spd: 0, aggro: 480 };
  const MON = { r: 24, hpK: 1, atkK: 1, defK: 1, mdefK: 0.5, agiK: 0.6, dexK: 0.7, expK: 1.2, spd: 150, aggro: 560 };
  const sp = (base, o) => Object.assign({}, base, o);
  const SPECIES = {
    field_mouse: sp(MON, {"name": "หนูนาขโมยข้าว", "kind": "burrow", "hpK": 1.1, "atkK": 1.1, "defK": 1.0, "mdefK": 0.6, "agiK": 0.8, "dexK": 0.9, "expK": 1.35, "spd": 120, "aggro": 580, "reach": 96, "windup": 0.5, "lunge": 260, "every": 4.5, "element": "earth", "atkElement": "neutral", "r": 22, "dust": "150,120,80", "color": "200,190,170"}),
    sunflower_bee: sp(MON, {"name": "ผึ้งทานตะวัน", "kind": "leader", "hpK": 1.5, "atkK": 1.2, "defK": 1.1, "mdefK": 0.7, "agiK": 1.3, "dexK": 1.0, "expK": 1.8, "spd": 180, "aggro": 600, "hover": 50, "swoop": 560, "flap": 20, "element": "wind", "atkElement": "wind", "base": "fly", "r": 26, "color": "200,190,170"}),
    bucket_scarecrow: sp(MON, {"name": "หุ่นไล่กาถือฝาถัง", "kind": "shield", "hpK": 1.3, "atkK": 1.05, "defK": 1.5, "mdefK": 0.6, "agiK": 0.4, "dexK": 0.8, "expK": 1.4, "spd": 95, "aggro": 560, "reach": 112, "windup": 0.6, "lunge": 200, "element": "earth", "atkElement": "neutral", "r": 28, "color": "200,190,170"}),
    angry_rooster: sp(MON, {"name": "ไก่ป่าเจ้าอารมณ์", "kind": "charge", "hpK": 1.0, "atkK": 1.15, "defK": 0.9, "mdefK": 0.5, "agiK": 1.0, "dexK": 1.0, "expK": 1.3, "spd": 170, "aggro": 600, "dash": [280, 700, 0.36], "element": "wind", "atkElement": "neutral", "leap": 18, "dust": "200,150,90", "r": 26, "color": "200,190,170"}),
    potato_walker: sp(SLIME, {"name": "มันฝรั่งเดินได้", "kind": "hop", "hpK": 0.8, "atkK": 0.85, "defK": 0.6, "mdefK": 1.1, "agiK": 0.4, "dexK": 0.6, "expK": 1.0, "element": "earth", "atkElement": "earth", "color": "190,150,90"}),
    seed_flower: sp(MON, {"name": "ดอกไม้ยิงเมล็ด", "kind": "ranged", "hpK": 0.9, "atkK": 1.0, "defK": 0.7, "mdefK": 0.8, "agiK": 0.8, "dexK": 1.1, "expK": 1.3, "spd": 70, "aggro": 600, "range": 380, "fire": 2.2, "element": "earth", "atkElement": "earth", "shot": {"rgb": "190,230,120", "speed": 460, "size": 12}, "r": 26, "color": "200,190,170"}),
    horn_rabbit: sp(MON, {"name": "กระต่ายเขาเดียว", "kind": "charge", "hpK": 1.0, "atkK": 1.15, "defK": 0.9, "mdefK": 0.5, "agiK": 1.0, "dexK": 1.0, "expK": 1.3, "spd": 170, "aggro": 600, "dash": [300, 780, 0.34], "element": "neutral", "atkElement": "neutral", "leap": 22, "dust": "230,230,240", "r": 26, "color": "200,190,170"}),
    firefly_healer: sp(MON, {"name": "หิ่งห้อยหมอยา", "kind": "healer", "hpK": 0.9, "atkK": 0.7, "defK": 0.7, "mdefK": 1.3, "agiK": 0.6, "dexK": 0.9, "expK": 1.4, "spd": 110, "aggro": 560, "range": 300, "every": 5, "heal": 0.18, "element": "wind", "atkElement": "wind", "r": 20, "light": [120, "170,255,120"], "shot": {"rgb": "170,255,120", "mul": 0.5, "size": 10}, "color": "200,190,170"}),
    sleep_moth: sp(MON, {"name": "ผีเสื้อผงหลับ", "kind": "fly", "hpK": 0.8, "atkK": 1.05, "defK": 0.6, "mdefK": 0.7, "agiK": 1.3, "dexK": 1.0, "expK": 1.25, "spd": 180, "aggro": 600, "hover": 54, "swoop": 440, "flap": 8, "element": "wind", "atkElement": "poison", "light": [110, "210,180,255"], "r": 26, "color": "200,190,170"}),
    hedgehog: sp(MON, {"name": "เม่นแตกตัว", "kind": "splitter", "hpK": 1.2, "atkK": 1.0, "defK": 0.9, "mdefK": 0.7, "agiK": 0.5, "dexK": 0.8, "expK": 1.35, "spd": 110, "aggro": 540, "reach": 100, "windup": 0.55, "lunge": 180, "splitN": 2, "element": "earth", "atkElement": "neutral", "r": 24, "color": "200,190,170"}),
    spit_frog: sp(MON, {"name": "กบพ่นน้ำ", "kind": "ranged", "hpK": 0.9, "atkK": 1.0, "defK": 0.7, "mdefK": 0.8, "agiK": 0.8, "dexK": 1.1, "expK": 1.3, "spd": 120, "aggro": 600, "range": 380, "fire": 2.2, "element": "water", "atkElement": "water", "shot": {"rgb": "130,200,255", "speed": 520, "size": 13}, "r": 26, "color": "200,190,170"}),
    split_shroom: sp(MON, {"name": "เห็ดน้ำแตกตัว", "kind": "splitter", "hpK": 1.2, "atkK": 1.0, "defK": 0.9, "mdefK": 0.7, "agiK": 0.5, "dexK": 0.8, "expK": 1.35, "spd": 110, "aggro": 540, "reach": 100, "windup": 0.55, "lunge": 180, "splitN": 2, "element": "water", "atkElement": "water", "r": 26, "color": "200,190,170"}),
    otter: sp(MON, {"name": "นากนักล่า", "kind": "charge", "hpK": 1.0, "atkK": 1.15, "defK": 0.9, "mdefK": 0.5, "agiK": 1.0, "dexK": 1.0, "expK": 1.3, "spd": 170, "aggro": 600, "dash": [300, 760, 0.36], "element": "water", "atkElement": "neutral", "dust": "160,190,220", "r": 26, "color": "200,190,170"}),
    kingfisher: sp(MON, {"name": "นกกระเต็นดำน้ำ", "kind": "fly", "hpK": 0.8, "atkK": 1.05, "defK": 0.6, "mdefK": 0.7, "agiK": 1.3, "dexK": 1.0, "expK": 1.25, "spd": 180, "aggro": 600, "hover": 60, "swoop": 720, "flap": 18, "element": "water", "atkElement": "water", "r": 26, "color": "200,190,170"}),
    leap_trout: sp(SLIME, {"name": "ปลาเทราต์กระโดด", "kind": "hop", "hpK": 0.8, "atkK": 0.85, "defK": 0.6, "mdefK": 1.1, "agiK": 0.4, "dexK": 0.6, "expK": 1.0, "element": "water", "atkElement": "water", "color": "150,190,170"}),
    shield_crab: sp(MON, {"name": "ปูหินโล่ใหญ่", "kind": "shield", "hpK": 1.3, "atkK": 1.05, "defK": 1.5, "mdefK": 0.6, "agiK": 0.4, "dexK": 0.8, "expK": 1.4, "spd": 95, "aggro": 560, "reach": 112, "windup": 0.6, "lunge": 200, "element": "water", "atkElement": "neutral", "r": 30, "shadow": [56, 15], "color": "200,190,170"}),
    mud_eel: sp(MON, {"name": "ปลาไหลมุดโคลน", "kind": "burrow", "hpK": 1.1, "atkK": 1.1, "defK": 1.0, "mdefK": 0.6, "agiK": 0.8, "dexK": 0.9, "expK": 1.35, "spd": 120, "aggro": 580, "reach": 96, "windup": 0.5, "lunge": 260, "every": 4.5, "element": "water", "atkElement": "water", "dust": "120,100,70", "r": 26, "color": "200,190,170"}),
    dragonfly_lead: sp(MON, {"name": "แมลงปอจ่าฝูง", "kind": "leader", "hpK": 1.5, "atkK": 1.2, "defK": 1.1, "mdefK": 0.7, "agiK": 1.3, "dexK": 1.0, "expK": 1.8, "spd": 180, "aggro": 600, "hover": 60, "swoop": 680, "flap": 26, "element": "wind", "atkElement": "wind", "base": "fly", "r": 26, "color": "200,190,170"}),
    mist_sprite: sp(MON, {"name": "ภูตละอองน้ำ", "kind": "healer", "hpK": 0.9, "atkK": 0.7, "defK": 0.7, "mdefK": 1.3, "agiK": 0.6, "dexK": 0.9, "expK": 1.4, "spd": 110, "aggro": 560, "range": 300, "every": 5, "heal": 0.18, "element": "water", "atkElement": "water", "light": [130, "200,230,255"], "shot": {"rgb": "200,230,255", "mul": 0.5, "size": 10}, "r": 26, "color": "200,190,170"}),
    water_newt: sp(MON, {"name": "ซาลาแมนเดอร์น้ำ", "kind": "melee", "hpK": 1.1, "atkK": 1.1, "defK": 1.0, "mdefK": 0.6, "agiK": 0.6, "dexK": 0.9, "expK": 1.3, "spd": 120, "aggro": 560, "reach": 120, "windup": 0.5, "lunge": 160, "element": "water", "atkElement": "water", "r": 26, "color": "200,190,170"}),
    grave_digger: sp(MON, {"name": "ผีขุดหลุม", "kind": "burrow", "hpK": 1.1, "atkK": 1.1, "defK": 1.0, "mdefK": 0.6, "agiK": 0.8, "dexK": 0.9, "expK": 1.35, "spd": 120, "aggro": 580, "reach": 96, "windup": 0.5, "lunge": 260, "every": 4.5, "element": "ghost", "atkElement": "shadow", "dust": "110,100,110", "seeThrough": 0.9, "r": 26, "color": "200,190,170"}),
    bone_archer: sp(MON, {"name": "โครงกระดูกพลธนู", "kind": "ranged", "hpK": 0.9, "atkK": 1.0, "defK": 0.7, "mdefK": 0.8, "agiK": 0.8, "dexK": 1.1, "expK": 1.3, "spd": 120, "aggro": 600, "range": 380, "fire": 2.2, "element": "undead", "atkElement": "neutral", "shot": {"rgb": "200,220,255", "speed": 620, "size": 10}, "r": 26, "color": "200,190,170"}),
    candle_witch: sp(MON, {"name": "แม่มดเทียนไข", "kind": "summoner", "hpK": 1.0, "atkK": 0.8, "defK": 0.8, "mdefK": 1.1, "agiK": 0.5, "dexK": 0.9, "expK": 1.45, "spd": 100, "aggro": 580, "range": 330, "every": 7, "element": "fire", "atkElement": "fire", "minion": ["candle_wisp", 3], "shot": {"rgb": "255,190,110", "mul": 0.6, "size": 12}, "light": [150, "255,190,110"], "r": 26, "color": "200,190,170"}),
    coffin_bomb: sp(MON, {"name": "โลงผีระเบิด", "kind": "bomber", "hpK": 0.7, "atkK": 1.1, "defK": 0.6, "mdefK": 0.6, "agiK": 0.9, "dexK": 0.9, "expK": 1.2, "spd": 150, "aggro": 560, "blast": 150, "blastMul": 2.2, "fuse": 1.1, "element": "undead", "atkElement": "shadow", "r": 26, "color": "200,190,170"}),
    grave_crow: sp(MON, {"name": "อีกาสุสาน", "kind": "fly", "hpK": 0.8, "atkK": 1.05, "defK": 0.6, "mdefK": 0.7, "agiK": 1.3, "dexK": 1.0, "expK": 1.25, "spd": 180, "aggro": 600, "hover": 56, "swoop": 620, "flap": 12, "element": "shadow", "atkElement": "neutral", "r": 26, "color": "200,190,170"}),
    puff_shroom: sp(MON, {"name": "เห็ดพองลม", "kind": "bomber", "hpK": 0.7, "atkK": 1.1, "defK": 0.6, "mdefK": 0.6, "agiK": 0.9, "dexK": 0.9, "expK": 1.2, "spd": 150, "aggro": 560, "blast": 150, "blastMul": 2.2, "fuse": 1.1, "element": "poison", "atkElement": "poison", "light": [90, "190,160,255"], "r": 26, "color": "200,190,170"}),
    shroom_beetle: sp(MON, {"name": "ด้วงแบกเห็ด", "kind": "shield", "hpK": 1.3, "atkK": 1.05, "defK": 1.5, "mdefK": 0.6, "agiK": 0.4, "dexK": 0.8, "expK": 1.4, "spd": 95, "aggro": 560, "reach": 112, "windup": 0.6, "lunge": 200, "element": "earth", "atkElement": "neutral", "r": 28, "color": "200,190,170"}),
    shroom_wolf: sp(MON, {"name": "หมาป่าเห็ดจ่าฝูง", "kind": "leader", "hpK": 1.5, "atkK": 1.2, "defK": 1.1, "mdefK": 0.5, "agiK": 1.0, "dexK": 1.0, "expK": 1.8, "spd": 170, "aggro": 600, "dash": [320, 780, 0.38], "element": "earth", "atkElement": "neutral", "base": "charge", "leap": 30, "dust": "120,120,160", "light": [120, "120,200,255"], "shadow": [64, 16], "r": 26, "color": "200,190,170"}),
    doctor_shroom: sp(MON, {"name": "เห็ดหมอ", "kind": "healer", "hpK": 0.9, "atkK": 0.7, "defK": 0.7, "mdefK": 1.3, "agiK": 0.6, "dexK": 0.9, "expK": 1.4, "spd": 110, "aggro": 560, "range": 300, "every": 5, "heal": 0.18, "element": "earth", "atkElement": "earth", "shot": {"rgb": "170,255,150", "mul": 0.5, "size": 11}, "r": 26, "color": "200,190,170"}),
    glow_spider: sp(MON, {"name": "แมงมุมใยเรือง", "kind": "ranged", "hpK": 0.9, "atkK": 1.0, "defK": 0.7, "mdefK": 0.8, "agiK": 0.8, "dexK": 1.1, "expK": 1.3, "spd": 120, "aggro": 600, "range": 380, "fire": 2.2, "element": "poison", "atkElement": "poison", "shot": {"rgb": "120,240,230", "speed": 440, "size": 15}, "light": [100, "120,240,230"], "r": 26, "color": "200,190,170"}),
    blade_sprite: sp(MON, {"name": "ภูตลมใบมีด", "kind": "ranged", "hpK": 0.9, "atkK": 1.0, "defK": 0.7, "mdefK": 0.8, "agiK": 0.8, "dexK": 1.1, "expK": 1.3, "spd": 120, "aggro": 600, "range": 380, "fire": 2.2, "element": "wind", "atkElement": "wind", "shot": {"rgb": "170,255,190", "speed": 640, "size": 13, "n": 2, "spread": 0.18}, "r": 26, "color": "200,190,170"}),
    storm_sparrow: sp(MON, {"name": "นกกระจอกพายุ", "kind": "fly", "hpK": 0.8, "atkK": 1.05, "defK": 0.6, "mdefK": 0.7, "agiK": 1.3, "dexK": 1.0, "expK": 1.25, "spd": 180, "aggro": 600, "hover": 64, "swoop": 760, "flap": 24, "element": "wind", "atkElement": "wind", "r": 20, "color": "200,190,170"}),
    cloud_ram_lead: sp(MON, {"name": "แกะเมฆจ่าฝูง", "kind": "leader", "hpK": 1.5, "atkK": 1.2, "defK": 1.1, "mdefK": 0.5, "agiK": 1.0, "dexK": 1.0, "expK": 1.8, "spd": 170, "aggro": 600, "dash": [340, 700, 0.48], "element": "wind", "atkElement": "neutral", "base": "charge", "dust": "220,220,230", "shadow": [66, 18], "r": 32, "color": "200,190,170"}),
    float_rock: sp(MON, {"name": "ก้อนหินลอยแตกตัว", "kind": "splitter", "hpK": 1.2, "atkK": 1.0, "defK": 0.9, "mdefK": 0.7, "agiK": 0.5, "dexK": 0.8, "expK": 1.35, "spd": 110, "aggro": 540, "reach": 100, "windup": 0.55, "lunge": 180, "splitN": 3, "element": "earth", "atkElement": "earth", "r": 30, "light": [80, "170,255,190"], "color": "200,190,170"}),
    cliff_goat: sp(MON, {"name": "แพะผาหน้าผา", "kind": "charge", "hpK": 1.0, "atkK": 1.15, "defK": 0.9, "mdefK": 0.5, "agiK": 1.0, "dexK": 1.0, "expK": 1.3, "spd": 170, "aggro": 600, "dash": [320, 700, 0.44], "element": "earth", "atkElement": "neutral", "dust": "160,140,110", "r": 28, "color": "200,190,170"}),
    bloat_toad: sp(MON, {"name": "คางคกพองพิษ", "kind": "bomber", "hpK": 0.7, "atkK": 1.1, "defK": 0.6, "mdefK": 0.6, "agiK": 0.9, "dexK": 0.9, "expK": 1.2, "spd": 150, "aggro": 560, "blast": 170, "blastMul": 2.2, "fuse": 1.1, "element": "poison", "atkElement": "poison", "light": [90, "170,255,130"], "r": 26, "color": "200,190,170"}),
    split_slug: sp(MON, {"name": "ทากพิษแตกตัว", "kind": "splitter", "hpK": 1.2, "atkK": 1.0, "defK": 0.9, "mdefK": 0.7, "agiK": 0.5, "dexK": 0.8, "expK": 1.35, "spd": 110, "aggro": 540, "reach": 100, "windup": 0.55, "lunge": 180, "splitN": 2, "element": "poison", "atkElement": "poison", "r": 26, "color": "200,190,170"}),
    mother_bloom: sp(MON, {"name": "ดอกแม่พิษ", "kind": "healer", "hpK": 0.9, "atkK": 0.7, "defK": 0.7, "mdefK": 1.3, "agiK": 0.6, "dexK": 0.9, "expK": 1.4, "spd": 110, "aggro": 560, "range": 300, "every": 5, "heal": 0.18, "element": "poison", "atkElement": "poison", "r": 30, "shot": {"rgb": "255,150,220", "mul": 0.6, "size": 12}, "color": "200,190,170"}),
    mosquito: sp(MON, {"name": "ยุงยักษ์", "kind": "fly", "hpK": 0.8, "atkK": 1.05, "defK": 0.6, "mdefK": 0.7, "agiK": 1.3, "dexK": 1.0, "expK": 1.25, "spd": 180, "aggro": 600, "hover": 60, "swoop": 640, "flap": 30, "element": "poison", "atkElement": "poison", "r": 26, "color": "200,190,170"}),
    swamp_croc: sp(MON, {"name": "จระเข้หนองพิษ", "kind": "burrow", "hpK": 1.1, "atkK": 1.1, "defK": 1.0, "mdefK": 0.6, "agiK": 0.8, "dexK": 0.9, "expK": 1.35, "spd": 120, "aggro": 580, "reach": 96, "windup": 0.5, "lunge": 260, "every": 4.5, "element": "poison", "atkElement": "poison", "r": 32, "shadow": [66, 17], "dust": "90,110,80", "color": "200,190,170"}),
    crystal_mole: sp(MON, {"name": "ตุ่นขุดผลึก", "kind": "burrow", "hpK": 1.1, "atkK": 1.1, "defK": 1.0, "mdefK": 0.6, "agiK": 0.8, "dexK": 0.9, "expK": 1.35, "spd": 120, "aggro": 580, "reach": 96, "windup": 0.5, "lunge": 260, "every": 4.5, "element": "earth", "atkElement": "earth", "dust": "220,150,80", "light": [80, "255,170,80"], "r": 26, "color": "200,190,170"}),
    crystal_golem: sp(MON, {"name": "โกเลมผลึกแตกตัว", "kind": "splitter", "hpK": 1.2, "atkK": 1.0, "defK": 0.9, "mdefK": 0.7, "agiK": 0.5, "dexK": 0.8, "expK": 1.35, "spd": 110, "aggro": 540, "reach": 100, "windup": 0.55, "lunge": 180, "splitN": 2, "element": "earth", "atkElement": "earth", "r": 34, "heavy": true, "shadow": [66, 18], "light": [120, "255,170,80"], "slam": 120, "color": "200,190,170"}),
    ghost_miner: sp(MON, {"name": "คนงานเหมืองผี", "kind": "summoner", "hpK": 1.0, "atkK": 0.8, "defK": 0.8, "mdefK": 1.1, "agiK": 0.5, "dexK": 0.9, "expK": 1.45, "spd": 100, "aggro": 580, "range": 330, "every": 7, "element": "ghost", "atkElement": "neutral", "minion": ["crystal_bat", 3], "seeThrough": 0.88, "shot": {"rgb": "190,255,200", "mul": 0.6, "size": 12}, "r": 26, "color": "200,190,170"}),
    crystal_bat: sp(MON, {"name": "ค้างคาวผลึก", "kind": "fly", "hpK": 0.8, "atkK": 1.05, "defK": 0.6, "mdefK": 0.7, "agiK": 1.3, "dexK": 1.0, "expK": 1.25, "spd": 180, "aggro": 600, "hover": 50, "swoop": 620, "flap": 16, "element": "earth", "atkElement": "earth", "light": [90, "255,170,80"], "r": 26, "color": "200,190,170"}),
    haunted_cart: sp(MON, {"name": "รถเข็นแร่ผีสิง", "kind": "charge", "hpK": 1.0, "atkK": 1.15, "defK": 0.9, "mdefK": 0.5, "agiK": 1.0, "dexK": 1.0, "expK": 1.3, "spd": 170, "aggro": 600, "dash": [360, 820, 0.5], "element": "ghost", "atkElement": "neutral", "dust": "200,140,80", "r": 32, "shadow": [60, 16], "heavy": true, "color": "200,190,170"}),
    spit_scorpion: sp(MON, {"name": "แมงป่องยิงพิษ", "kind": "ranged", "hpK": 0.9, "atkK": 1.0, "defK": 0.7, "mdefK": 0.8, "agiK": 0.8, "dexK": 1.1, "expK": 1.3, "spd": 120, "aggro": 600, "range": 380, "fire": 2.2, "element": "fire", "atkElement": "poison", "shot": {"rgb": "160,255,110", "speed": 500, "size": 14}, "r": 26, "color": "200,190,170"}),
    sand_lizard: sp(MON, {"name": "กิ้งก่าทรายจ่าฝูง", "kind": "leader", "hpK": 1.5, "atkK": 1.2, "defK": 1.1, "mdefK": 0.5, "agiK": 1.0, "dexK": 1.0, "expK": 1.8, "spd": 170, "aggro": 600, "dash": [300, 760, 0.36], "element": "fire", "atkElement": "neutral", "base": "charge", "dust": "220,170,110", "r": 26, "color": "200,190,170"}),
    stone_vulture: sp(MON, {"name": "นกแร้งหิน", "kind": "fly", "hpK": 0.8, "atkK": 1.05, "defK": 0.6, "mdefK": 0.7, "agiK": 1.3, "dexK": 1.0, "expK": 1.25, "spd": 180, "aggro": 600, "hover": 70, "swoop": 640, "flap": 8, "element": "earth", "atkElement": "neutral", "r": 26, "color": "200,190,170"}),
    sand_giant: sp(MON, {"name": "ยักษ์หินทราย", "kind": "shield", "hpK": 1.7, "atkK": 1.05, "defK": 1.5, "mdefK": 0.6, "agiK": 0.4, "dexK": 0.8, "expK": 1.4, "spd": 70, "aggro": 560, "reach": 112, "windup": 0.6, "lunge": 200, "element": "earth", "atkElement": "earth", "r": 40, "heavy": true, "shadow": [80, 22], "color": "200,190,170"}),
    dust_devil: sp(MON, {"name": "ผีพายุทราย", "kind": "bomber", "hpK": 0.7, "atkK": 1.1, "defK": 0.6, "mdefK": 0.6, "agiK": 0.9, "dexK": 0.9, "expK": 1.2, "spd": 150, "aggro": 560, "blast": 170, "blastMul": 2.2, "fuse": 1.1, "element": "wind", "atkElement": "wind", "r": 26, "color": "200,190,170"}),
    pterosaur: sp(MON, {"name": "เทอโรซอร์", "kind": "fly", "hpK": 0.8, "atkK": 1.05, "defK": 0.6, "mdefK": 0.7, "agiK": 1.3, "dexK": 1.0, "expK": 1.25, "spd": 180, "aggro": 600, "hover": 76, "swoop": 720, "flap": 9, "element": "wind", "atkElement": "neutral", "r": 28, "color": "200,190,170"}),
    ankylo: sp(MON, {"name": "แองคิโลซอร์หางค้อน", "kind": "shield", "hpK": 1.6, "atkK": 1.05, "defK": 1.5, "mdefK": 0.6, "agiK": 0.4, "dexK": 0.8, "expK": 1.4, "spd": 95, "aggro": 560, "reach": 112, "windup": 0.6, "lunge": 200, "element": "earth", "atkElement": "earth", "r": 38, "heavy": true, "shadow": [80, 20], "slam": 130, "color": "200,190,170"}),
    tiny_dino: sp(MON, {"name": "ไดโนจิ๋วจ่าฝูง", "kind": "leader", "hpK": 1.5, "atkK": 1.2, "defK": 1.1, "mdefK": 0.5, "agiK": 1.0, "dexK": 1.0, "expK": 1.8, "spd": 170, "aggro": 600, "dash": [260, 800, 0.3], "element": "earth", "atkElement": "neutral", "base": "charge", "leap": 20, "r": 22, "dust": "120,110,80", "color": "200,190,170"}),
    hatchling: sp(MON, {"name": "ลูกมังกรไพร", "kind": "ranged", "hpK": 0.9, "atkK": 1.0, "defK": 0.7, "mdefK": 0.8, "agiK": 0.8, "dexK": 1.1, "expK": 1.3, "spd": 120, "aggro": 600, "range": 380, "fire": 2.2, "element": "earth", "atkElement": "wind", "shot": {"rgb": "150,230,110", "speed": 540, "size": 12, "n": 3, "spread": 0.22}, "r": 26, "color": "200,190,170"}),
    plesio: sp(MON, {"name": "พลีซิโอซอร์", "kind": "burrow", "hpK": 1.1, "atkK": 1.1, "defK": 1.0, "mdefK": 0.6, "agiK": 0.8, "dexK": 0.9, "expK": 1.35, "spd": 120, "aggro": 580, "reach": 96, "windup": 0.5, "lunge": 260, "every": 4.5, "element": "water", "atkElement": "water", "r": 34, "shadow": [72, 18], "dust": "120,170,200", "color": "200,190,170"}),
    mother_bat: sp(MON, {"name": "ค้างคาวแม่รัง", "kind": "summoner", "hpK": 1.0, "atkK": 0.8, "defK": 0.8, "mdefK": 1.1, "agiK": 0.5, "dexK": 0.9, "expK": 1.45, "spd": 100, "aggro": 580, "range": 330, "every": 7, "element": "shadow", "atkElement": "shadow", "minion": ["bat", 3], "shot": {"rgb": "190,150,255", "mul": 0.6, "size": 12}, "r": 26, "color": "200,190,170"}),
    echo_bat: sp(MON, {"name": "ค้างคาวคลื่นเสียง", "kind": "ranged", "hpK": 0.9, "atkK": 1.0, "defK": 0.7, "mdefK": 0.8, "agiK": 0.8, "dexK": 1.1, "expK": 1.3, "spd": 120, "aggro": 600, "range": 380, "fire": 2.2, "element": "shadow", "atkElement": "wind", "shot": {"rgb": "200,180,255", "speed": 560, "size": 16}, "r": 26, "color": "200,190,170"}),
    bomb_ant: sp(MON, {"name": "มดระเบิด", "kind": "bomber", "hpK": 0.7, "atkK": 1.1, "defK": 0.6, "mdefK": 0.6, "agiK": 0.9, "dexK": 0.9, "expK": 1.2, "spd": 150, "aggro": 560, "blast": 150, "blastMul": 2.2, "fuse": 1.1, "element": "earth", "atkElement": "fire", "r": 26, "color": "200,190,170"}),
    nurse_ant: sp(MON, {"name": "มดพยาบาล", "kind": "healer", "hpK": 0.9, "atkK": 0.7, "defK": 0.7, "mdefK": 1.3, "agiK": 0.6, "dexK": 0.9, "expK": 1.4, "spd": 110, "aggro": 560, "range": 300, "every": 5, "heal": 0.18, "element": "earth", "atkElement": "earth", "shot": {"rgb": "255,220,120", "mul": 0.5, "size": 10}, "r": 26, "color": "200,190,170"}),
    dig_ant: sp(MON, {"name": "มดขุดอุโมงค์", "kind": "burrow", "hpK": 1.1, "atkK": 1.1, "defK": 1.0, "mdefK": 0.6, "agiK": 0.8, "dexK": 0.9, "expK": 1.35, "spd": 120, "aggro": 580, "reach": 96, "windup": 0.5, "lunge": 260, "every": 4.5, "element": "earth", "atkElement": "earth", "dust": "140,110,80", "r": 26, "color": "200,190,170"}),
    tomb_knight: sp(MON, {"name": "อัศวินโล่หลุมศพ", "kind": "shield", "hpK": 1.3, "atkK": 1.05, "defK": 1.5, "mdefK": 0.6, "agiK": 0.4, "dexK": 0.8, "expK": 1.4, "spd": 95, "aggro": 560, "reach": 112, "windup": 0.6, "lunge": 200, "element": "undead", "atkElement": "neutral", "r": 30, "color": "200,190,170"}),
    bone_pile: sp(MON, {"name": "กองกระดูกแตกตัว", "kind": "splitter", "hpK": 1.2, "atkK": 1.0, "defK": 0.9, "mdefK": 0.7, "agiK": 0.5, "dexK": 0.8, "expK": 1.35, "spd": 110, "aggro": 540, "reach": 100, "windup": 0.55, "lunge": 180, "splitN": 3, "element": "undead", "atkElement": "neutral", "r": 26, "color": "200,190,170"}),
    bone_shaman: sp(MON, {"name": "หมอผีกระดูก", "kind": "healer", "hpK": 0.9, "atkK": 0.7, "defK": 0.7, "mdefK": 1.3, "agiK": 0.6, "dexK": 0.9, "expK": 1.4, "spd": 110, "aggro": 560, "range": 300, "every": 5, "heal": 0.18, "element": "undead", "atkElement": "shadow", "shot": {"rgb": "130,200,255", "mul": 0.6, "size": 12}, "light": [110, "130,200,255"], "r": 26, "color": "200,190,170"}),
    walking_scope: sp(MON, {"name": "กล้องดูดาวเดินได้", "kind": "ranged", "hpK": 0.9, "atkK": 1.0, "defK": 0.7, "mdefK": 0.8, "agiK": 0.8, "dexK": 1.1, "expK": 1.3, "spd": 120, "aggro": 600, "range": 380, "fire": 2.2, "element": "wind", "atkElement": "holy", "shot": {"rgb": "200,220,255", "speed": 700, "size": 11}, "r": 26, "color": "200,190,170"}),
    owlet_lead: sp(MON, {"name": "ลูกนกฮูกจ่าฝูง", "kind": "leader", "hpK": 1.5, "atkK": 1.2, "defK": 1.1, "mdefK": 0.6, "agiK": 0.6, "dexK": 0.9, "expK": 1.8, "spd": 120, "aggro": 560, "reach": 90, "windup": 0.5, "lunge": 220, "element": "wind", "atkElement": "neutral", "base": "melee", "r": 22, "color": "200,190,170"}),
    root_worm: sp(MON, {"name": "หนอนรากมุดดิน", "kind": "burrow", "hpK": 1.1, "atkK": 1.1, "defK": 1.0, "mdefK": 0.6, "agiK": 0.8, "dexK": 0.9, "expK": 1.35, "spd": 120, "aggro": 580, "reach": 96, "windup": 0.5, "lunge": 260, "every": 4.5, "element": "earth", "atkElement": "poison", "dust": "110,90,70", "r": 26, "color": "200,190,170"}),
    poison_spore: sp(MON, {"name": "สปอร์พิษลอย", "kind": "ranged", "hpK": 0.9, "atkK": 1.0, "defK": 0.7, "mdefK": 0.8, "agiK": 0.8, "dexK": 1.1, "expK": 1.3, "spd": 120, "aggro": 600, "range": 380, "fire": 2.2, "element": "poison", "atkElement": "poison", "shot": {"rgb": "200,140,255", "speed": 420, "size": 16}, "light": [80, "200,140,255"], "r": 26, "color": "200,190,170"}),
    bloom_sprout: sp(MON, {"name": "ตัวอ่อนต้นแม่พิษ", "kind": "summoner", "hpK": 1.0, "atkK": 0.8, "defK": 0.8, "mdefK": 1.1, "agiK": 0.5, "dexK": 0.9, "expK": 1.45, "spd": 100, "aggro": 580, "range": 330, "every": 7, "element": "poison", "atkElement": "poison", "minion": ["poison_spore", 2], "shot": {"rgb": "255,150,220", "mul": 0.6, "size": 11}, "r": 26, "color": "200,190,170"}),
    poison_ladybug: sp(MON, {"name": "เต่าทองพิษ", "kind": "bomber", "hpK": 0.7, "atkK": 1.1, "defK": 0.6, "mdefK": 0.6, "agiK": 0.9, "dexK": 0.9, "expK": 1.2, "spd": 150, "aggro": 560, "blast": 150, "blastMul": 2.2, "fuse": 1.1, "element": "poison", "atkElement": "poison", "r": 20, "light": [70, "170,255,130"], "color": "200,190,170"}),
    lava_imp: sp(MON, {"name": "อิมป์พ่นลาวา", "kind": "ranged", "hpK": 0.9, "atkK": 1.0, "defK": 0.7, "mdefK": 0.8, "agiK": 0.8, "dexK": 1.1, "expK": 1.3, "spd": 120, "aggro": 600, "range": 380, "fire": 2.2, "element": "fire", "atkElement": "fire", "shot": {"rgb": "255,140,60", "speed": 480, "size": 15}, "light": [110, "255,140,60"], "r": 26, "color": "200,190,170"}),
    magma_blob: sp(MON, {"name": "ก้อนแมกมาแตกตัว", "kind": "splitter", "hpK": 1.2, "atkK": 1.0, "defK": 0.9, "mdefK": 0.7, "agiK": 0.5, "dexK": 0.8, "expK": 1.35, "spd": 110, "aggro": 540, "reach": 100, "windup": 0.55, "lunge": 180, "splitN": 2, "element": "fire", "atkElement": "fire", "light": [120, "255,130,50"], "embers": true, "r": 26, "color": "200,190,170"}),
    ink_drop: sp(MON, {"name": "หยดหมึกแตกตัว", "kind": "splitter", "hpK": 1.2, "atkK": 1.0, "defK": 0.9, "mdefK": 0.7, "agiK": 0.5, "dexK": 0.8, "expK": 1.35, "spd": 110, "aggro": 540, "reach": 100, "windup": 0.55, "lunge": 180, "splitN": 3, "element": "water", "atkElement": "shadow", "r": 26, "color": "200,190,170"}),
    cabinet_guard: sp(MON, {"name": "ตู้เอกสารโล่", "kind": "shield", "hpK": 1.3, "atkK": 1.05, "defK": 1.5, "mdefK": 0.6, "agiK": 0.4, "dexK": 0.8, "expK": 1.4, "spd": 95, "aggro": 560, "reach": 112, "windup": 0.6, "lunge": 200, "element": "earth", "atkElement": "neutral", "r": 32, "heavy": true, "color": "200,190,170"}),
    repair_puppet: sp(MON, {"name": "หุ่นช่างซ่อม", "kind": "healer", "hpK": 0.9, "atkK": 0.7, "defK": 0.7, "mdefK": 1.3, "agiK": 0.6, "dexK": 0.9, "expK": 1.4, "spd": 110, "aggro": 560, "range": 300, "every": 5, "heal": 0.18, "element": "neutral", "atkElement": "neutral", "shot": {"rgb": "255,200,140", "mul": 0.5, "size": 10}, "r": 26, "color": "200,190,170"}),
    spring_bomb: sp(MON, {"name": "หุ่นสปริงระเบิด", "kind": "bomber", "hpK": 0.7, "atkK": 1.1, "defK": 0.6, "mdefK": 0.6, "agiK": 0.9, "dexK": 0.9, "expK": 1.2, "spd": 150, "aggro": 560, "blast": 150, "blastMul": 2.2, "fuse": 1.1, "element": "neutral", "atkElement": "neutral", "r": 26, "color": "200,190,170"}),
    bomb_bell: sp(MON, {"name": "ระฆังจิ๋วระเบิด", "kind": "bomber", "hpK": 0.6, "atkK": 1.1, "defK": 0.6, "mdefK": 0.6, "agiK": 0.9, "dexK": 0.9, "expK": 1.8, "spd": 150, "aggro": 560, "blast": 150, "blastMul": 2.2, "fuse": 1.1, "element": "wind", "atkElement": "wind", "r": 22, "color": "200,190,170"}),
    bell_lead: sp(MON, {"name": "หุ่นระฆังจ่าฝูง", "kind": "leader", "hpK": 0.9, "atkK": 1.2, "defK": 0.9, "mdefK": 0.6, "agiK": 0.6, "dexK": 0.9, "expK": 2.7, "spd": 120, "aggro": 560, "reach": 130, "windup": 0.5, "lunge": 60, "element": "wind", "atkElement": "neutral", "base": "melee", "slam": 150, "heavy": true, "r": 34, "shadow": [70, 18], "color": "200,190,170"}),
    glass_warden: sp(MON, {"name": "ผู้เฝ้าพื้นแก้ว", "kind": "shield", "hpK": 1.05, "atkK": 1.05, "defK": 1.1, "mdefK": 0.6, "agiK": 0.4, "dexK": 0.8, "expK": 1.7, "spd": 95, "aggro": 560, "reach": 112, "windup": 0.6, "lunge": 200, "element": "holy", "atkElement": "holy", "r": 32, "light": [110, "200,210,255"], "color": "200,190,170"}),
    tiny_meteor: sp(MON, {"name": "ดาวตกจิ๋ว", "kind": "bomber", "hpK": 0.7, "atkK": 1.1, "defK": 0.6, "mdefK": 0.6, "agiK": 0.9, "dexK": 0.9, "expK": 1.45, "spd": 150, "aggro": 560, "blast": 170, "blastMul": 2.2, "fuse": 1.1, "element": "holy", "atkElement": "fire", "r": 20, "light": [120, "255,240,190"], "color": "200,190,170"}),
  };
  Object.assign(NC.SPECIES, SPECIES);
  Object.assign(NC.MONSTERS, SPECIES);

  // the zone forms: an old species, stronger, its art hue-shifted (hue: degrees)
  const ELITE = { hpK: 1.8, atkK: 1.25, defK: 1.2, expK: 2 };
  const elite = (id, base, suffix, hue) => { const B = NC.SPECIES[base]; if (!B) return; const o = Object.assign({}, B, { name: B.name + ' · ' + suffix, hue, eliteOf: base });
    for (const k in ELITE) o[k] = (B[k] || 1) * ELITE[k]; NC.SPECIES[id] = o; NC.MONSTERS[id] = o; };
  elite('crow_red', 'crow', 'ร่างขนแดง', 330);
  elite('boar_silver', 'boar', 'ร่างเขาเงิน', 190);
  elite('turtle_jade', 'turtle', 'ร่างหินเขียว', 60);
  elite('dragonfly_rainbow', 'dragonfly', 'ร่างสายรุ้ง', 120);
  elite('zombie_mold', 'zombie', 'ร่างราเขียว', 80);
  elite('ghost_violet', 'ghost', 'ร่างม่วงหม่น', 260);
  elite('stump_shroom', 'stump', 'ร่างเห็ดขึ้น', 220);
  elite('wolf_frost', 'wolf', 'ร่างน้ำค้างแข็ง', 170);
  elite('eagle_bolt', 'storm_eagle', 'ร่างฟ้าผ่า', 40);
  elite('snake_triple', 'swamp_snake', 'ร่างพิษแดง', 300);
  elite('golem_crystal', 'golem', 'ร่างผลึก', 30);
  elite('scorpion_copper', 'scorpion', 'ร่างทองแดง', 25);
  elite('raptor_plume', 'raptor', 'ร่างขนนก', 240);
  elite('bat_crimson', 'bat', 'ร่างแดงเลือดนก', 320);
  elite('ant_obsidian', 'soldier_ant', 'ร่างนิล', 200);
  elite('knight_rust', 'bone_knight', 'ร่างสนิมแดง', 20);
  elite('owl_star', 'stone_owl', 'ร่างดาว', 210);
  elite('imp_blue', 'fire_imp', 'ร่างไฟฟ้า', 180);
  elite('book_gold', 'flying_book', 'ร่างปกทอง', 40);
  elite('puppet_black', 'faceless_puppet', 'ร่างไม้ดำ', 200);
  elite('bell_silver', 'bell_puppet', 'ร่างเงิน', 180);
  elite('lamplighter_gold', 'first_lamplighter', 'ร่างทอง', 40);
  // their art: the base species' two poses drawn through a hue shift once the pictures are in (a base still streaming
  // in, js/assets.js: the elite's entry waits with it, drawing it asks for the base, and it is painted on arrival)
  const pendingArt = new Map(); // base pose -> derived poses; retained across a failed request until an arrival
  const paint = (S, src, e) => {
    const c = document.createElement('canvas');
    c.width = src.img.naturalWidth || src.img.width; c.height = src.img.naturalHeight || src.img.height;
    const g = c.getContext('2d');
    g.filter = `hue-rotate(${S.hue}deg) saturate(1.25) brightness(1.05)`;
    g.drawImage(src.img, 0, 0);
    e.img = c; delete e.ready; delete e.failed;
  };
  const paintPending = (name) => {
    const pending = pendingArt.get(name), src = NC.SPR[name];
    if (!pending || !src || src.ready === false) return;
    for (const { S, e } of pending) paint(S, src, e);
    pendingArt.delete(name);
  };
  if (NC.Sprites && NC.Sprites.on) NC.Sprites.on(paintPending);
  const baseLoad = NC.loadAssets;
  NC.loadAssets = function () {
    return baseLoad.apply(this, arguments).then((r) => {
      for (const [id, S] of Object.entries(NC.SPECIES)) {
        if (!S.eliteOf) continue;
        for (const suf of ['', '_b']) {
          const name = S.eliteOf + suf, src = NC.SPR[name];
          if (!src || !src.img || NC.SPR[id + suf]) continue;
          const e = (NC.SPR[id + suf] = Object.assign({}, src));
          if (src.ready !== false) { paint(S, src, e); continue; }
          if (NC.Sprites) {
            if (!pendingArt.has(name)) pendingArt.set(name, []);
            pendingArt.get(name).push({ S, e });
            NC.Sprites.alias(id + suf, name);
            NC.Sprites.need([name], 2).then(() => paintPending(name));
          }
        }
      }
      return r;
    });
  };

  // ---------------- the zone bosses (dunbosses.js) ----------------
  const DB = NC.DUNGEON_BOSSES;
  if (DB) {
    DB.frog_queen = {"name": "ราชินีกบน้ำตก", "element": "water", "atkElement": "water", "r": 70, "hpK": 40, "atkK": 1.5, "defK": 1.2, "mdefK": 1.0, "agiK": 0.4, "dexK": 1, "expK": 40, "spd": 90, "aggro": 720, "moves": ["slam", "breath", "summon"], "minion": ["spit_frog", 3], "light": [360, "150,220,255"], "top": 330, "fx": "150,220,255"};
    DB.scorpion_king = {"name": "ราชาแมงป่องทราย", "element": "fire", "atkElement": "poison", "r": 80, "hpK": 50, "atkK": 1.6, "defK": 1.7, "mdefK": 0.8, "agiK": 0.4, "dexK": 1, "expK": 50, "spd": 90, "aggro": 740, "moves": ["slam", "acid", "blink", "summon"], "minion": ["spit_scorpion", 3], "light": [380, "255,200,120"], "top": 320, "fx": "255,200,120"};
    DB.dragon_mother = {"name": "แม่มังกรไพร", "element": "earth", "atkElement": "wind", "r": 90, "hpK": 190, "atkK": 1.8, "defK": 1.5, "mdefK": 1.1, "agiK": 0.4, "dexK": 1.1, "expK": 306, "spd": 85, "aggro": 760, "fly": 40, "moves": ["breath", "swoop", "screech", "summon"], "minion": ["hatchling", 3], "light": [420, "170,255,140"], "top": 380, "fx": "170,255,140"};
    DB.poison_heart = {"name": "หัวใจต้นแม่พิษ", "element": "poison", "atkElement": "poison", "r": 90, "hpK": 55, "atkK": 1.6, "defK": 1.3, "mdefK": 1.2, "agiK": 0.1, "dexK": 1, "expK": 55, "spd": 40, "aggro": 760, "moves": ["acid", "rain", "orbs", "summon"], "minion": ["bloom_sprout", 2], "light": [420, "255,120,220"], "top": 360, "fx": "255,120,220"};
    for (const id of ["frog_queen", "scorpion_king", "dragon_mother", "poison_heart"]) {
      const D = DB[id];
      NC.MONSTERS[id] = { name: D.name, element: D.element, atkElement: D.atkElement, r: D.r, hpK: D.hpK, atkK: D.atkK, defK: D.defK,
        mdefK: D.mdefK, agiK: D.agiK, dexK: D.dexK, expK: D.expK, spd: D.spd, aggro: D.aggro };
      NC.BOSSES[id] = { respawn: 900, drops: 6, top: D.top };
    }
  }

  // ---------------- who lives where ----------------
  const R = (s, h) => ({ '*': { slime: s, hollow: h } });
  Object.assign(NC.ROSTER, {
    farm2: R([['potato_walker', 2], ['field_mouse', 1]], [['bucket_scarecrow', 2], ['angry_rooster', 2], ['sunflower_bee', 1], ['crow_red', 1]]),
    meadow2: R([['seed_flower', 2], ['firefly_healer', 1]], [['horn_rabbit', 2], ['sleep_moth', 2], ['hedgehog', 2], ['boar_silver', 1]]),
    marsh2: R([['leap_trout', 2], ['spit_frog', 1]], [['split_shroom', 2], ['otter', 2], ['kingfisher', 1], ['turtle_jade', 1]]),
    marsh3: R([['mist_sprite', 1], ['mud_eel', 1]], [['shield_crab', 2], ['water_newt', 2], ['dragonfly_lead', 1], ['dragonfly_rainbow', 1]]),
    graveyard2: R([['grave_crow', 2], ['bone_archer', 1]], [['grave_digger', 2], ['coffin_bomb', 1], ['candle_witch', 1], ['zombie_mold', 1], ['ghost_violet', 1]]),
    woods2: R([['glow_spider', 2], ['doctor_shroom', 1]], [['puff_shroom', 2], ['shroom_beetle', 2], ['shroom_wolf', 1], ['stump_shroom', 1], ['wolf_frost', 1]]),
    wind2: R([['storm_sparrow', 2], ['blade_sprite', 1]], [['float_rock', 2], ['cliff_goat', 2], ['cloud_ram_lead', 1], ['eagle_bolt', 1]]),
    swamp2: R([['mosquito', 2], ['mother_bloom', 1]], [['bloat_toad', 2], ['split_slug', 2], ['swamp_croc', 1], ['snake_triple', 1]]),
    canyon2: R([['crystal_bat', 2], ['ghost_miner', 1]], [['crystal_mole', 2], ['crystal_golem', 2], ['haunted_cart', 1], ['golem_crystal', 1]]),
    canyon3: R([['stone_vulture', 2], ['spit_scorpion', 1]], [['sand_giant', 2], ['dust_devil', 1], ['sand_lizard', 1], ['scorpion_copper', 1]]),
    prime2: R([['pterosaur', 2], ['hatchling', 1]], [['ankylo', 2], ['plesio', 2], ['tiny_dino', 1], ['raptor_plume', 1]]),
    roots1: R([['poison_spore', 2], ['poison_ladybug', 1]], [['root_worm', 2], ['bloom_sprout', 1], ['split_slug', 1]]),
    roots2: R([['poison_spore', 1], ['poison_ladybug', 1]], [['root_worm', 2], ['bloom_sprout', 1], ['mother_bloom', 1]]),
  });
  // the old dungeons: the new ones join their lists
  const ADD = {"batcave": [[["echo_bat", 1]], [["mother_bat", 1], ["bat_crimson", 1]]], "antmine1": [[["dig_ant", 1]], [["nurse_ant", 1]]], "antmine2": [[["bomb_ant", 1]], [["nurse_ant", 1], ["dig_ant", 1]]], "antmine3": [[["bomb_ant", 1]], [["ant_obsidian", 1], ["nurse_ant", 1]]], "crypt1": [[["bone_pile", 1]], [["tomb_knight", 1]]], "crypt2": [[["bone_pile", 1]], [["bone_shaman", 1], ["tomb_knight", 1], ["knight_rust", 1]]], "owl1": [[["walking_scope", 1]], [["owlet_lead", 1]]], "owl2": [[["walking_scope", 1]], [["owlet_lead", 1]]], "owl3": [[["walking_scope", 1]], [["owl_star", 1]]], "lavavent1": [[["magma_blob", 1]], [["lava_imp", 1]]], "lavavent2": [[["magma_blob", 1]], [["lava_imp", 1], ["imp_blue", 1]]], "ledger1": [[["ink_drop", 1]], [["cabinet_guard", 1]]], "ledger2": [[["ink_drop", 1]], [["cabinet_guard", 1], ["book_gold", 1]]], "puppet1": [[["spring_bomb", 1]], [["repair_puppet", 1]]], "puppet2": [[["spring_bomb", 1]], [["repair_puppet", 1], ["puppet_black", 1]]], "grave1": [[["tiny_meteor", 1]], [["glass_warden", 1]]], "grave2": [[["tiny_meteor", 1]], [["glass_warden", 1], ["lamplighter_gold", 1]]], "bell1": [[["bomb_bell", 1]], [["bell_lead", 1]]], "bell2": [[["bomb_bell", 1]], [["bell_lead", 1]]], "bell3": [[["bomb_bell", 1]], [["bell_lead", 1]]], "bell4": [[["bomb_bell", 1]], [["bell_lead", 1], ["bell_silver", 1]]], "bell5": [[["bomb_bell", 1]], [["bell_lead", 1], ["bell_silver", 1]]], "bell6": [[["bomb_bell", 1]], [["bell_lead", 1], ["bell_silver", 1]]], "bell7": [[["bomb_bell", 1]], [["bell_lead", 1], ["bell_silver", 1]]]};
  for (const [mp, [s, h]] of Object.entries(ADD)) {
    const R0 = NC.ROSTER[mp];
    if (!R0) continue;
    for (const z of Object.values(R0)) { z.slime = (z.slime || []).concat(s); z.hollow = (z.hollow || []).concat(h); }
  }

  // ---------------- their materials ----------------
  if (NC.MATERIALS && NC.MAT_DROPS) {
    Object.assign(NC.MATERIALS, {
      mat_corn_cob: { name: 'ซังข้าวโพดที่ถูกแทะ', price: 30, desc: 'ซังข้าวโพดที่หนูนาแทะเหลือแต่ครึ่ง' },
      mat_sun_petal: { name: 'กลีบทานตะวันทอง', price: 30, desc: 'กลีบดอกทานตะวันที่ยังอุ่นแดด' },
      mat_bucket_lid: { name: 'ฝาถังบุบ', price: 30, desc: 'ฝาถังสังกะสีบุบเป็นรอยส้อม' },
      mat_rooster_feather: { name: 'ขนหางไก่ป่า', price: 30, desc: 'ขนหางสีส้มแดงยาวเป็นมัน' },
      mat_sprout_potato: { name: 'มันฝรั่งแตกหน่อ', price: 30, desc: 'มันฝรั่งที่หน่อยาวจนเดินหนีได้' },
      mat_hard_seed: { name: 'เมล็ดแข็งดอกยิง', price: 38, desc: 'เมล็ดแข็งเหมือนหิน ยิงทีเจ็บมือ' },
      mat_pearl_horn: { name: 'เขาไข่มุกกระต่าย', price: 38, desc: 'เขาเกลียวสีไข่มุกของกระต่ายเขาเดียว' },
      mat_firefly_tail: { name: 'ก้นหิ่งห้อยเรืองแสง', price: 38, desc: 'แสงเขียวอ่อนที่ไม่ร้อนเลย' },
      mat_sleep_dust: { name: 'ผงง่วงนอน', price: 38, desc: 'ผงสีม่วงอ่อน ดมแล้วหาวทันที' },
      mat_hedge_spine: { name: 'หนามเม่นขาว', price: 38, desc: 'หนามยาวสีขาวปลายชมพู' },
      mat_frog_cheek: { name: 'ถุงน้ำแก้มกบ', price: 52, desc: 'ถุงน้ำใส ๆ ที่กบใช้อมน้ำไว้พ่น' },
      mat_jelly_cap: { name: 'หมวกเห็ดวุ้นน้ำ', price: 52, desc: 'หมวกเห็ดนุ่มเหมือนวุ้น มีหยดน้ำข้างใน' },
      mat_fishbone_knife: { name: 'มีดก้างปลา', price: 52, desc: 'มีดเล็ก ๆ ทำจากก้างปลาใหญ่' },
      mat_blue_plume: { name: 'ขนฟ้าประกาย', price: 52, desc: 'ขนสีฟ้าสดที่เปลี่ยนสีตามแสง' },
      mat_trout_scale: { name: 'เกล็ดเทราต์จุด', price: 52, desc: 'เกล็ดปลามีจุดเล็ก ๆ เป็นประกาย' },
      mat_big_claw: { name: 'ก้ามปูหินใหญ่', price: 64, desc: 'ก้ามแบนหนาใช้เป็นโล่ได้' },
      mat_eel_slime: { name: 'เมือกปลาไหล', price: 64, desc: 'เมือกลื่นในขวดเล็ก' },
      mat_gold_wing: { name: 'ปีกแมลงปอปลายทอง', price: 64, desc: 'ปีกใสขอบสีทอง' },
      mat_mist_drop: { name: 'หยดละอองน้ำตก', price: 64, desc: 'หยดน้ำที่ไม่เคยแห้ง' },
      mat_newt_frill: { name: 'ครีบหลังซาลาแมนเดอร์', price: 64, desc: 'ครีบบางสีฟ้าอ่อนเป็นระบาย' },
      mat_rusty_shovel: { name: 'หัวพลั่วขึ้นสนิม', price: 70, desc: 'หัวพลั่วเก่าที่ขุดมาไม่รู้กี่หลุม' },
      mat_bone_arrow: { name: 'ลูกธนูกระดูก', price: 70, desc: 'ลูกธนูหัวกระดูกขนนกเทา' },
      mat_witch_wax: { name: 'ขี้ผึ้งแม่มด', price: 70, desc: 'ขี้ผึ้งหอมกลิ่นควันเทียน' },
      mat_coffin_nail: { name: 'ตะปูโลงเก่า', price: 70, desc: 'ตะปูสนิมยาวจากโลงที่เดินได้' },
      mat_grave_quill: { name: 'ขนอีกาสุสาน', price: 70, desc: 'ขนสีเทาหม่นกลิ่นดินเปียก' },
      mat_puff_spore: { name: 'สปอร์เห็ดพอง', price: 90, desc: 'สปอร์ขาวฟูที่พองตัวเมื่อโดนลม' },
      mat_red_cap: { name: 'หมวกเห็ดแดงแข็ง', price: 90, desc: 'หมวกเห็ดแดงหนาแข็งเหมือนโล่' },
      mat_glow_mane: { name: 'แผงคอเห็ดเรืองแสง', price: 90, desc: 'ขนแผงคอที่มีเห็ดเรืองแสงขึ้น' },
      mat_shroom_glasses: { name: 'แว่นกลมของเห็ดหมอ', price: 90, desc: 'แว่นกลมเล็ก ๆ ที่เลนส์เป็นสปอร์ใส' },
      mat_glow_web: { name: 'ใยแมงมุมเรืองแสง', price: 90, desc: 'ใยเหนียวที่เรืองแสงฟ้าอมเขียว' },
      mat_wind_edge: { name: 'ใบมีดลม', price: 110, desc: 'ใบไม้คมที่ยังหมุนอยู่ในขวด' },
      mat_spark_tuft: { name: 'ขนหัวฟ้าแลบ', price: 110, desc: 'ขนหัวเล็ก ๆ ที่มีไฟฟ้าวิ่ง' },
      mat_brass_bell: { name: 'กระดิ่งทองเหลืองจ่าฝูง', price: 110, desc: 'กระดิ่งที่แกะทั้งฝูงเดินตามเสียง' },
      mat_wind_stone: { name: 'หินลอยลม', price: 110, desc: 'หินที่ลอยได้เองเมื่อปล่อยมือ' },
      mat_goat_horn: { name: 'เขาแพะผา', price: 110, desc: 'เขาตรงหนาแข็งของแพะผา' },
      mat_toxic_wart: { name: 'ตุ่มพิษเรืองแสง', price: 150, desc: 'ตุ่มพิษเขียวที่ยังเต้นตุบ ๆ' },
      mat_slug_slime: { name: 'เมือกทากพิษ', price: 150, desc: 'เมือกเขียวม่วงที่กัดกร่อนเหล็ก' },
      mat_mother_pollen: { name: 'เกสรแม่พิษ', price: 150, desc: 'เกสรชมพูเขียวที่หอมหวานแต่มีพิษ' },
      mat_mosquito_needle: { name: 'งวงยุงยักษ์', price: 150, desc: 'งวงยาวแหลมเหมือนเข็ม' },
      mat_croc_tooth: { name: 'ฟันจระเข้หนอง', price: 150, desc: 'ฟันแหลมสีเหลืองของจระเข้หนองพิษ' },
      mat_mole_lamp: { name: 'ตะเกียงหัวตุ่น', price: 180, desc: 'ตะเกียงเล็กที่ตุ่นสวมไว้บนหัว' },
      mat_orange_core: { name: 'แกนผลึกส้ม', price: 180, desc: 'แกนผลึกส้มที่เรืองแสงอุ่น ๆ' },
      mat_miner_lamp: { name: 'ตะเกียงหมวกเหมือง', price: 180, desc: 'ตะเกียงหมวกเหมืองที่ยังจุดอยู่' },
      mat_crystal_wing: { name: 'ปีกผลึกค้างคาว', price: 180, desc: 'แผ่นปีกผลึกส้มบางใส' },
      mat_cart_wheel: { name: 'ล้อรถเข็นแร่', price: 180, desc: 'ล้อเหล็กเล็กที่หมุนเองตอนกลางคืน' },
      mat_venom_bulb: { name: 'กระเปาะพิษแมงป่อง', price: 210, desc: 'กระเปาะหางที่ยังมีพิษเหลือ' },
      mat_frill_scale: { name: 'เกล็ดแผงคอกิ้งก่า', price: 210, desc: 'เกล็ดสีส้มจากแผงคอ' },
      mat_rock_feather: { name: 'ขนแร้งหิน', price: 210, desc: 'ขนแข็งเหมือนหินชนวน' },
      mat_sandstone_slab: { name: 'แผ่นหินทรายแดง', price: 210, desc: 'แผ่นหินทรายแดงที่ยักษ์ใช้เป็นโล่' },
      mat_sand_orb: { name: 'ลูกแก้วพายุทราย', price: 210, desc: 'ลูกแก้วที่มีทรายหมุนวนอยู่ข้างใน' },
      mat_ptero_crest: { name: 'หงอนเทอโรซอร์', price: 300, desc: 'หงอนยาวบางสีเขียวอมฟ้า' },
      mat_club_tail: { name: 'ค้อนหางแองคิโล', price: 300, desc: 'ปลายหางเป็นก้อนกระดูกหนักอึ้ง' },
      mat_tiny_claw: { name: 'กรงเล็บไดโนจิ๋ว', price: 300, desc: 'กรงเล็บเล็กแต่คมกริบ' },
      mat_dragon_eggshell: { name: 'เปลือกไข่มังกรไพร', price: 300, desc: 'เปลือกไข่ลายจุดเขียวที่แข็งเหมือนเกราะ' },
      mat_plesio_flipper: { name: 'ครีบพลีซิโอซอร์', price: 300, desc: 'ครีบใหญ่สีฟ้าเข้ม' },
      mat_nest_fluff: { name: 'ขนอกค้างคาวแม่รัง', price: 24, desc: 'ขนนุ่มฟูที่ลูกค้างคาวชอบซุก' },
      mat_echo_ear: { name: 'หูค้างคาวคลื่นเสียง', price: 24, desc: 'หูใหญ่บางที่ได้ยินแม้เสียงกระซิบ' },
      mat_ant_powder: { name: 'ผงระเบิดมด', price: 40, desc: 'ผงแดงในถุงก้นมด ห้ามเขย่า' },
      mat_honey_drop: { name: 'หยดน้ำหวานรักษา', price: 40, desc: 'หยดน้ำหวานสีทองที่มดใช้รักษากัน' },
      mat_shovel_leg: { name: 'ขาพลั่วมด', price: 40, desc: 'ขาหน้ารูปพลั่วของมดขุด' },
      mat_tomb_shard: { name: 'เศษป้ายหลุมศพ', price: 72, desc: 'เศษหินป้ายหลุมศพที่อัศวินใช้เป็นโล่' },
      mat_bone_bundle: { name: 'มัดกระดูกเก่า', price: 72, desc: 'กระดูกหลายชิ้นมัดด้วยเชือก' },
      mat_bone_charm: { name: 'เครื่องรางกระดูกฟ้า', price: 72, desc: 'เครื่องรางกระดูกที่เรืองแสงฟ้า' },
      mat_star_lens: { name: 'เลนส์ดาวกลม', price: 170, desc: 'เลนส์ใสที่มองเห็นดาวแม้กลางวัน' },
      mat_acorn_helm: { name: 'หมวกลูกโอ๊กจิ๋ว', price: 170, desc: 'หมวกลูกโอ๊กที่ลูกนกฮูกใส่' },
      mat_root_fiber: { name: 'เส้นใยรากพิษ', price: 200, desc: 'เส้นใยรากที่เหนียวเหมือนเชือก' },
      mat_spore_pod: { name: 'ฝักสปอร์ม่วง', price: 200, desc: 'ฝักสปอร์ที่ลอยได้เอง' },
      mat_young_bud: { name: 'ดอกตูมแม่พิษ', price: 200, desc: 'ดอกตูมที่ยังไม่บาน อุ่นเหมือนมีชีวิต' },
      mat_ladybug_shell: { name: 'กระดองเต่าทองพิษ', price: 200, desc: 'กระดองม่วงจุดเขียวเรืองแสง' },
      mat_lava_belly: { name: 'ลาวาในพุงอิมป์', price: 240, desc: 'ลาวาอุ่น ๆ ในขวดหินหนา' },
      mat_magma_crust: { name: 'เปลือกแมกมาดำ', price: 240, desc: 'เปลือกดำแข็งที่ข้างในยังร้อน' },
      mat_pen_nib: { name: 'ปากกาหัวเหล็กจม', price: 300, desc: 'หัวปากกาที่จมอยู่ในหยดหมึก' },
      mat_drawer_key: { name: 'กุญแจลิ้นชักเอกสาร', price: 300, desc: 'กุญแจทองเหลืองเล็กที่เปิดได้ทุกลิ้นชัก' },
      mat_tiny_wrench: { name: 'ประแจจิ๋วของหุ่น', price: 340, desc: 'ประแจเล็ก ๆ ที่ขันข้อต่อหุ่นได้พอดี' },
      mat_coil_spring: { name: 'สปริงขดใหญ่', price: 340, desc: 'สปริงเหล็กที่ดีดตัวเองได้' },
      mat_bell_fuse: { name: 'ชนวนระฆังจิ๋ว', price: 400, desc: 'ชนวนสั้น ๆ ที่ยังมีกลิ่นดินปืน' },
      mat_gold_clapper: { name: 'ลิ้นระฆังทอง', price: 400, desc: 'ลิ้นระฆังทองคำเล็กที่ดังใสกว่าทุกระฆัง' },
      mat_star_glass: { name: 'แก้วดาวดำ', price: 460, desc: 'แผ่นแก้วดำที่มีดาวอยู่ข้างใน' },
      mat_meteor_pebble: { name: 'ก้อนดาวตกจิ๋ว', price: 460, desc: 'ก้อนหินดาวตกที่ยังอุ่นเป็นแสงขาว' },
      mat_crown_lily: { name: 'มงกุฎดอกบัวราชินีกบ', price: 3500, rare: true, desc: 'มงกุฎดอกบัวที่ยังมีหยดน้ำตกเกาะอยู่ หายาก!' },
      mat_stone_crown: { name: 'มงกุฎหินราชาแมงป่อง', price: 5000, rare: true, desc: 'มงกุฎหินที่ราชาแมงป่องสวมมาพันปี หายาก!' },
      mat_dragon_leafheart: { name: 'หัวใจใบไม้มังกร', price: 7000, rare: true, desc: 'ใบไม้สีทองที่เต้นเหมือนหัวใจ หายากมาก!' },
      mat_heart_seed: { name: 'เมล็ดหัวใจแม่พิษ', price: 6000, rare: true, desc: 'เมล็ดสีชมพูเข้มที่ยังเต้นตุบ ๆ หายากมาก!' },
    });
    Object.assign(NC.MAT_DROPS, {
      field_mouse: [['mat_corn_cob', 0.55]],
      sunflower_bee: [['mat_sun_petal', 0.55]],
      bucket_scarecrow: [['mat_bucket_lid', 0.55]],
      angry_rooster: [['mat_rooster_feather', 0.55]],
      potato_walker: [['mat_sprout_potato', 0.55]],
      seed_flower: [['mat_hard_seed', 0.55]],
      horn_rabbit: [['mat_pearl_horn', 0.55]],
      firefly_healer: [['mat_firefly_tail', 0.55]],
      sleep_moth: [['mat_sleep_dust', 0.55]],
      hedgehog: [['mat_hedge_spine', 0.55]],
      spit_frog: [['mat_frog_cheek', 0.55]],
      split_shroom: [['mat_jelly_cap', 0.55]],
      otter: [['mat_fishbone_knife', 0.55]],
      kingfisher: [['mat_blue_plume', 0.55]],
      leap_trout: [['mat_trout_scale', 0.55]],
      shield_crab: [['mat_big_claw', 0.55]],
      mud_eel: [['mat_eel_slime', 0.55]],
      dragonfly_lead: [['mat_gold_wing', 0.55]],
      mist_sprite: [['mat_mist_drop', 0.55]],
      water_newt: [['mat_newt_frill', 0.55]],
      grave_digger: [['mat_rusty_shovel', 0.55]],
      bone_archer: [['mat_bone_arrow', 0.55]],
      candle_witch: [['mat_witch_wax', 0.55]],
      coffin_bomb: [['mat_coffin_nail', 0.55]],
      grave_crow: [['mat_grave_quill', 0.55]],
      puff_shroom: [['mat_puff_spore', 0.55]],
      shroom_beetle: [['mat_red_cap', 0.55]],
      shroom_wolf: [['mat_glow_mane', 0.55]],
      doctor_shroom: [['mat_shroom_glasses', 0.55]],
      glow_spider: [['mat_glow_web', 0.55]],
      blade_sprite: [['mat_wind_edge', 0.55]],
      storm_sparrow: [['mat_spark_tuft', 0.55]],
      cloud_ram_lead: [['mat_brass_bell', 0.55]],
      float_rock: [['mat_wind_stone', 0.55]],
      cliff_goat: [['mat_goat_horn', 0.55]],
      bloat_toad: [['mat_toxic_wart', 0.55]],
      split_slug: [['mat_slug_slime', 0.55]],
      mother_bloom: [['mat_mother_pollen', 0.55]],
      mosquito: [['mat_mosquito_needle', 0.55]],
      swamp_croc: [['mat_croc_tooth', 0.55]],
      crystal_mole: [['mat_mole_lamp', 0.55]],
      crystal_golem: [['mat_orange_core', 0.55]],
      ghost_miner: [['mat_miner_lamp', 0.55]],
      crystal_bat: [['mat_crystal_wing', 0.55]],
      haunted_cart: [['mat_cart_wheel', 0.55]],
      spit_scorpion: [['mat_venom_bulb', 0.55]],
      sand_lizard: [['mat_frill_scale', 0.55]],
      stone_vulture: [['mat_rock_feather', 0.55]],
      sand_giant: [['mat_sandstone_slab', 0.55]],
      dust_devil: [['mat_sand_orb', 0.55]],
      pterosaur: [['mat_ptero_crest', 0.55]],
      ankylo: [['mat_club_tail', 0.55]],
      tiny_dino: [['mat_tiny_claw', 0.55]],
      hatchling: [['mat_dragon_eggshell', 0.55]],
      plesio: [['mat_plesio_flipper', 0.55]],
      mother_bat: [['mat_nest_fluff', 0.55]],
      echo_bat: [['mat_echo_ear', 0.55]],
      bomb_ant: [['mat_ant_powder', 0.55]],
      nurse_ant: [['mat_honey_drop', 0.55]],
      dig_ant: [['mat_shovel_leg', 0.55]],
      tomb_knight: [['mat_tomb_shard', 0.55]],
      bone_pile: [['mat_bone_bundle', 0.55]],
      bone_shaman: [['mat_bone_charm', 0.55]],
      walking_scope: [['mat_star_lens', 0.55]],
      owlet_lead: [['mat_acorn_helm', 0.55]],
      root_worm: [['mat_root_fiber', 0.55]],
      poison_spore: [['mat_spore_pod', 0.55]],
      bloom_sprout: [['mat_young_bud', 0.55]],
      poison_ladybug: [['mat_ladybug_shell', 0.55]],
      lava_imp: [['mat_lava_belly', 0.55]],
      magma_blob: [['mat_magma_crust', 0.55]],
      ink_drop: [['mat_pen_nib', 0.55]],
      cabinet_guard: [['mat_drawer_key', 0.55]],
      repair_puppet: [['mat_tiny_wrench', 0.55]],
      spring_bomb: [['mat_coil_spring', 0.55]],
      bomb_bell: [['mat_bell_fuse', 0.74]],
      bell_lead: [['mat_gold_clapper', 0.74]],
      glass_warden: [['mat_star_glass', 0.66]],
      tiny_meteor: [['mat_meteor_pebble', 0.66]],
      crow_red: (NC.MAT_DROPS['crow'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      boar_silver: (NC.MAT_DROPS['boar'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      turtle_jade: (NC.MAT_DROPS['turtle'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      dragonfly_rainbow: (NC.MAT_DROPS['dragonfly'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      zombie_mold: (NC.MAT_DROPS['zombie'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      ghost_violet: (NC.MAT_DROPS['ghost'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      stump_shroom: (NC.MAT_DROPS['stump'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      wolf_frost: (NC.MAT_DROPS['wolf'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      eagle_bolt: (NC.MAT_DROPS['storm_eagle'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      snake_triple: (NC.MAT_DROPS['swamp_snake'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      golem_crystal: (NC.MAT_DROPS['golem'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      scorpion_copper: (NC.MAT_DROPS['scorpion'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      raptor_plume: (NC.MAT_DROPS['raptor'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      bat_crimson: (NC.MAT_DROPS['bat'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      ant_obsidian: (NC.MAT_DROPS['soldier_ant'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      knight_rust: (NC.MAT_DROPS['bone_knight'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      owl_star: (NC.MAT_DROPS['stone_owl'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      imp_blue: (NC.MAT_DROPS['fire_imp'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      book_gold: (NC.MAT_DROPS['flying_book'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      puppet_black: (NC.MAT_DROPS['faceless_puppet'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      bell_silver: (NC.MAT_DROPS['bell_puppet'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      lamplighter_gold: (NC.MAT_DROPS['first_lamplighter'] || []).map(([m, c, lo, hi]) => [m, Math.min(1, c * 1.5), lo, hi]),
      frog_queen: [['mat_crown_lily', 0.2]],
      scorpion_king: [['mat_stone_crown', 0.2]],
      dragon_mother: [['mat_dragon_leafheart', 0.45], ['mat_dragon_eggshell', 1, 8, 14]],
      poison_heart: [['mat_heart_seed', 0.2]],
    });
  }
})();
