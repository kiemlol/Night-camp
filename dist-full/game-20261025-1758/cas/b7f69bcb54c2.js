/* sfxlayers.js — how Night Camp stacks its layered sounds (2026-10-18, the user: "เอา ElevenLabs แบบแยกชั้น"). The sounds
   themselves are ElevenLabs takes (tools/sfx_eleven.py: ids, groups, prompts); this file only says WHICH layers play
   WHEN, how loud and how high, so a hit is built at play time:
     swing / release   (the weapon moving, ~0.1 s before contact)
     impact            (the weapon's own crack)        + body (what the monster is made of)
     sub               (the weight: light / mid / heavy, crit, ultimate)
     tail              (the element of a skill or an elemental weapon)
     crit sweetener    (ring / snap / glint by weapon)  + voice and kill (the monster)
   Every layer takes a random take with a small pitch and volume wobble, and a combo climbs a little in pitch, so 30
   weapons x 9 materials x 13 elements never repeat exactly. Pure tables and planners, no audio: the player (the pick
   page tools/sfx_pick.html now, the game's sfx.js once the takes are picked) owns the AudioContext and the buffers.
     SFXL.swing(o)        events for the swing / the shot leaving       o.wtype
     SFXL.hit(o)          events for the moment it lands                o.wtype o.mat o.elem o.hint o.crit o.kill o.combo
                                                                        o.finisher o.voice o.big o.skill o.magic
     SFXL.attack(o)       swing + hit at the weapon's own lag (previews)
     SFXL.skill(o)        charge loop -> cast -> travel loop -> hit with the tail -> ground loop
                          o.elem o.hint o.phys o.bow o.charge o.fly o.zone (seconds; 0 = skip that phase)
     SFXL.ult(o, durOf)   rise -> a beat of silence -> the drop          o.kind boom|slash|wave|shatter, o.elem
   An event: { id, t (s from the call), gain (linear), rate (playback rate), loop?, len? (s, held sounds), duck? } */
(function () {
  'use strict';
  // ---------------- weapons: swing (or release), impact, weight 1-3, crit sweetener, lag to contact (s) ----------------
  const L = (th, sw, im, w, cr, lag, more) => Object.assign({ th, sw, im, w, cr, lag }, more || {});
  const W = {
    sword: L('ดาบ', 'sw_light', 'im_blade', 1, 'cr_ring', 0.09),
    gsword: L('ดาบใหญ่', 'sw_heavy', 'im_cleave', 3, 'cr_ring', 0.17),
    spear: L('หอก', 'sw_thrust', 'im_pierce', 1, 'cr_ring', 0.08),
    lance: L('หอกยาว', 'sw_thrust', 'im_pierce', 2, 'cr_ring', 0.11),
    axe: L('ขวาน', 'sw_blunt', 'im_cleave', 2, 'cr_snap', 0.12),
    gaxe: L('ขวานยักษ์', 'sw_heavy', 'im_cleave', 3, 'cr_snap', 0.17),
    hammer: L('ค้อนยักษ์', 'sw_heavy', 'im_crush', 3, 'cr_snap', 0.18),
    mace: L('กระบอง', 'sw_blunt', 'im_blunt', 2, 'cr_snap', 0.12),
    dagger: L('มีดคู่', 'sw_light', 'im_stab', 1, 'cr_ring', 0.07),
    katar: L('คาทาร์', 'sw_light', 'im_stab', 1, 'cr_ring', 0.07),
    bow: L('ธนู', 'rel_bow', 'im_arrow', 1, 'cr_snap', 0.22, { ranged: 1 }),
    xbow: L('หน้าไม้', 'rel_xbow', 'im_arrow', 2, 'cr_snap', 0.18, { ranged: 1 }),
    staff: L('คทา', 'rel_magic', 'im_magic', 1, 'cr_glint', 0.25, { ranged: 1, magic: 1 }),
    orb: L('ออร์บ', 'rel_magic', 'im_magic', 1, 'cr_glint', 0.25, { ranged: 1, magic: 1 }),
    lantern: L('ตะเกียง', 'rel_lantern', 'im_spirit', 1, 'cr_glint', 0.28, { ranged: 1, magic: 1 }),
    book: L('คัมภีร์', 'rel_book', 'im_magic', 1, 'cr_glint', 0.25, { ranged: 1, magic: 1 }),
    knuckle: L('สนับมือ', 'sw_punch', 'im_fist', 2, 'cr_snap', 0.07),
    qstaff: L('ไม้พลอง', 'sw_spin', 'im_blunt', 1, 'cr_snap', 0.11),
    huuma: L('ดาวยักษ์', 'sw_spin', 'im_spin', 2, 'cr_ring', 0.2),
    dsword: L('ดาบคู่', 'sw_light', 'im_blade', 1, 'cr_ring', 0.08),
    bell: L('กระดิ่งวิญญาณ', 'rel_bell', 'im_spirit', 1, 'cr_glint', 0.2, { ranged: 1, magic: 1 }),
    instrument: L('เครื่องดนตรี', 'rel_music', 'im_note', 1, 'cr_glint', 0.22, { ranged: 1, magic: 1 }),
    whip: L('แส้', 'sw_whip', 'im_whip', 1, 'cr_snap', 0.1),
    pistol: L('ปืนพกคู่', 'rel_pistol', 'im_bullet', 1, 'cr_snap', 0.05, { ranged: 1 }),
    shotgun: L('ลูกซอง', 'rel_shotgun', 'im_shot', 3, 'cr_snap', 0.04, { ranged: 1 }),
    scythe: L('เคียวใหญ่', 'sw_reap', 'im_reap', 3, 'cr_ring', 0.16),
    sickle: L('เคียวคู่', 'sw_light', 'im_reap', 1, 'cr_ring', 0.08),
    puppet: L('ไม้เชิดหุ่น', 'rel_puppet', 'im_blunt', 2, 'cr_snap', 0.2, { ranged: 1 }),
    wire: L('ด้ายเหล็ก', 'sw_wire', 'im_string', 1, 'cr_ring', 0.08),
    torch: L('คบเพลิง', 'sw_blunt', 'im_blunt', 2, 'cr_snap', 0.12, { elem: 'fire' }),
  };
  // ---------------- what a monster is made of: its body layer, its voice, how it dies ----------------
  const MAT = {
    flesh: { th: 'เนื้อ ขน (สัตว์ คน)', voice: 'mv_beast', kill: 'kill_small' },
    goo: { th: 'เมือก วุ้น (สไลม์)', voice: 'mv_slime', kill: 'kill_small' },
    plant: { th: 'พืช (ฟักทอง เห็ด)', voice: 'mv_plant', kill: 'kill_small' },
    wood: { th: 'ไม้ (หุ่นไม้ ต้นไม้)', voice: null, kill: 'kill_small' },
    shell: { th: 'กระดอง (ปู ด้วง)', voice: 'mv_insect', kill: 'kill_small' },
    bone: { th: 'กระดูก (โครงกระดูก)', voice: 'mv_undead', kill: 'kill_small' },
    stone: { th: 'หิน (โกเลม)', voice: 'mv_golem', kill: 'kill_big' },
    metal: { th: 'เหล็ก เกราะ (ยาม)', voice: null, kill: 'kill_big' },
    spirit: { th: 'วิญญาณ (ผี)', voice: 'mv_ghost', kill: 'kill_spirit' },
  };
  // ---------------- elements: the game's (NC.ELEMENTS) and the sound's own keys ----------------
  const ELEM = { neutral: null, water: 'ice', earth: 'earth', fire: 'fire', wind: 'wind', poison: 'poison', holy: 'holy',
    shadow: 'shadow', ghost: 'ghost', undead: 'undead', thunder: 'thunder', ice: 'ice', blood: 'blood', arcane: 'arcane' };
  const TH_ELEM = { fire: 'ไฟ', ice: 'น้ำแข็ง', water: 'น้ำ', thunder: 'สายฟ้า', wind: 'ลม', earth: 'ดิน หิน', poison: 'พิษ',
    holy: 'ศักดิ์สิทธิ์', shadow: 'เงามืด', ghost: 'วิญญาณ', undead: 'อันเดด', blood: 'เลือด', arcane: 'เวทบริสุทธิ์' };
  // the game files lightning under 'wind' and both ice and water under 'water': a skill's name / icon picks the right one
  const RX_THUNDER = /thunder|lightning|spark|volt|bolt|สายฟ้า|ฟ้าผ่า|ไฟฟ้า|อสนี/i;
  const RX_WATER = /water|wave|tide|bubble|rain|คลื่น|ฝน|ฟอง|(น้ำ(?!แข็ง))/i;
  const RX_ICE = /ice|frost|freez|snow|blizzard|glacier|น้ำแข็ง|หิมะ|เยือก/i;
  function elemKey(elem, hint, magic) {
    let k = elem in ELEM ? ELEM[elem] : null;
    const h = hint || '';
    if (k === 'wind' && RX_THUNDER.test(h)) k = 'thunder';
    if (elem === 'water') k = RX_ICE.test(h) ? 'ice' : RX_WATER.test(h) ? 'water' : 'ice';
    if (!k && magic) k = 'arcane';
    return k;
  }
  // the skill phases that exist, and what stands in for a missing one
  const PH = {
    chg: ['fire', 'ice', 'thunder', 'holy', 'shadow', 'arcane', 'ki', 'bow'],
    cast: ['fire', 'ice', 'thunder', 'wind', 'earth', 'holy', 'shadow', 'poison', 'arcane', 'blood'],
    fly: ['fire', 'ice', 'thunder', 'shadow', 'holy', 'arcane', 'arrow', 'blade'],
    zone: ['fire', 'ice', 'thunder', 'poison', 'shadow', 'holy', 'wind', 'earth'],
  };
  const FALL = { water: ['ice'], ice: ['water'], ghost: ['shadow'], undead: ['shadow'], blood: ['shadow'], poison: ['shadow'],
    earth: ['ki'], wind: ['ki'] };
  function phase(pre, k) {
    for (const c of [k, ...(FALL[k] || []), 'arcane']) if (c && PH[pre].includes(c)) return pre + '_' + c;
    return null;
  }

  // ---------------- the mix ----------------
  const GAIN = { swing: 0.55, release: 0.8, impact: 1, body: 0.75, sub: [0, 0.45, 0.6, 0.85], subCrit: 1, tail: 0.7,
    wtail: 0.45, crit: 0.75, voice: 0.5, kill: 0.85 };
  const SUB = [null, 'sub_light', 'sub_light', 'sub_heavy'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const db = (d) => Math.pow(10, d / 20);
  // a little wobble per layer: pitch +-5 % (the sub +-2 %), volume +-1.5 dB; a combo climbs 2.5 % a hit up to the 4th
  function ev(id, t, gain, o, more) {
    const climb = 1 + 0.025 * Math.min(4, (o && o.combo) || 0);
    const wob = /^sub_/.test(id) ? 0.02 : 0.05;
    return Object.assign({ id, t, gain: gain * db(rnd(-1.5, 1.5)), rate: climb * rnd(1 - wob, 1 + wob) }, more || {});
  }
  const weapon = (o) => W[(o && o.wtype) || 'sword'] || W.sword;

  function swing(o) {
    const w = weapon(o);
    return [ev(w.sw, 0, w.ranged ? GAIN.release : GAIN.swing, o)];
  }
  function hit(o) {
    o = o || {};
    const w = weapon(o), m = MAT[o.mat] || MAT.flesh, out = [];
    const im = o.impact || (o.skill && (o.magic || w.magic) ? 'im_magic' : w.im);
    out.push(ev(im, 0, GAIN.impact * (o.finisher ? 1.15 : 1), o, o.crit ? { duck: 0.55, len: 0.16 } : null));
    out.push(ev('body_' + (MAT[o.mat] ? o.mat : 'flesh'), 0.004, GAIN.body, o));
    const weight = Math.min(3, (w.w || 1) + (o.finisher ? 1 : 0) + (o.skill ? 1 : 0));
    if (o.crit) out.push(ev('sub_crit', 0, GAIN.subCrit, o));
    else out.push(ev(SUB[weight], 0, GAIN.sub[weight], o));
    // (o.welem: an elemental weapon's plain hit, at the weapon tail's softer level, like the torch's fire)
    const k = o.elem ? elemKey(o.elem, o.hint, o.magic || w.magic) : (o.welem && elemKey(o.welem, o.hint)) || w.elem || null;
    if (k) out.push(ev('tail_' + k, 0.01, o.elem ? GAIN.tail : GAIN.wtail, o));
    if (o.crit) out.push(ev(o.critId || w.cr, 0.012, GAIN.crit, o));
    const voice = o.voiceId !== undefined ? o.voiceId : m.voice;
    if (voice && (o.voice || o.kill)) out.push(ev(voice, 0.03, GAIN.voice, o));
    if (o.kill) out.push(ev(o.big ? 'kill_big' : m.kill, 0.05, GAIN.kill, o));
    return out;
  }
  function attack(o) {
    const w = weapon(o);
    return swing(o).concat(hit(o).map((e) => Object.assign(e, { t: e.t + w.lag })));
  }
  function skill(o) {
    o = Object.assign({ charge: 1.2, fly: 0.6, zone: 0 }, o);
    const w = weapon(o), k = elemKey(o.elem, o.hint, !o.phys) || (o.phys ? null : 'arcane'), out = [];
    let t = 0;
    if (o.charge > 0) {
      const id = o.bow ? 'chg_bow' : o.phys ? 'chg_ki' : phase('chg', k);
      out.push(ev(id, 0, 0.7, null, { loop: true, len: o.charge }));
      t = o.charge;
    }
    if (o.phys) {                       // a weapon skill: the weapon's own swing / shot, the element's burst under it
      out.push(ev(w.sw, t, w.ranged ? GAIN.release : 0.8, null));
      if (k) out.push(ev(phase('cast', k), t, 0.6, null));
    } else out.push(ev(phase('cast', k || 'arcane'), t, 0.9, null));
    if (o.fly > 0) {
      const id = o.bow ? 'fly_arrow' : o.wtype === 'huuma' ? 'fly_blade' : phase('fly', k || 'arcane');
      out.push(ev(id, t + 0.05, 0.6, null, { loop: true, len: o.fly }));
      t += o.fly;
    } else t += o.phys ? w.lag : 0.12;
    for (const e of hit(Object.assign({}, o, { skill: true, magic: !o.phys, elem: o.elem || (o.phys ? null : 'arcane') }))) {
      e.t += t; out.push(e);
    }
    if (o.zone > 0) {
      const id = phase('zone', k || 'arcane');
      if (id) out.push(ev(id, t + 0.1, 0.55, null, { loop: true, len: o.zone }));
    }
    return out;
  }
  function ult(o, durOf) {
    o = o || {};
    const rise = (durOf && durOf('ult_rise')) || 2, t = rise + 0.12;   // the beat of silence before the drop
    const kind = { boom: 'ult_boom', slash: 'ult_slash', wave: 'ult_wave', shatter: 'ult_shatter' }[o.kind] || 'ult_boom';
    const out = [ev('ult_rise', 0, 0.9, null), ev(kind, t, 1, null, { duck: 0.4, len: 0.6 }), ev('sub_ult', t, 0.9, null)];
    if (kind !== 'ult_wave') out.push(ev('ult_wave', t + 0.08, 0.55, null));
    const k = o.elem ? elemKey(o.elem, o.hint, true) : null;
    if (k) out.push(ev('tail_' + k, t + 0.05, 0.8, null));
    return out;
  }

  const SFXL = { W, MAT, ELEM, TH_ELEM, PH, elemKey, phase, swing, hit, attack, skill, ult, GAIN };
  (window.NC || window).SFXL = SFXL;
})();
