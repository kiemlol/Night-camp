/* worldmap.js — what the K map window (js/mapwin.js) says about every hunting map: a line about it (NC.MAP_NOTES), its
   levels, the elements of the monsters living there and so which jobs do well there (NC.mapInfo, worked out from the
   element table: the attack elements that hit them hard on average, and the ones they shrug off), and what drops
   there. Classic MMO style: at every level there is more than one place to go, and each place suits some jobs better.
   Also: the label over each edge warp shows the elements of the map beyond it, and a monster's name tag is coloured
   by how strong it is next to the hero (NC.levelColor, read by entities.js drawEnemyBar).
   (Its own world-map tab in the old dark map window is gone, 2026-10-21.)
   Reads NC.MAPS (maps.js, fields2.js), NC.ROSTER / NC.MONSTERS (monsters.js, monsters2.js), NC.MAT_DROPS. Load after
   monsters2.js. */
(function () {
  'use strict';
  const NC = window.NC;

  // where each map sat on the old single world-map board (% of its width and height). The web no longer draws that
  // board; scripts/lib/unity-export-web-source.mjs still reads this for Unity's world map (Unity is paused)
  const POS = {
    prime: [25, 9], burnt: [11, 25], wind: [40, 22], woods: [19, 42], meadow: [11, 60], camp: [33, 60], canyon: [33, 77], volcano: [33, 93],
    village: [55, 27], farm: [55, 60], marsh: [72, 45], lake: [86, 23], graveyard: [68, 80], swamp: [87, 64],
    homefarm: [56, 88], // (the life skills' farm, js/life_farm.js: off the camp's east road)
    road: [11, 6], salt: [48, 5], peak: [55, 16], nroad: [66, 8], outer: [76, 5], canal: [92, 6], cathedral: [97, 36], isle: [97, 20], dark: [8, 88],
  };
  // a line about each map
  const NOTE = {
    camp: 'จุดเริ่มต้น · เขตปลอดภัย · ลานตลาด ลานกิลด์ ลานฝึก ลานนัดพบ เนินดูดาว',
    homefarm: 'ฟาร์มของเรา ปลอดภัย ไม่มีมอน · แปลงผัก ครูสอนอาชีพเสริม 3 ตัว · สวนผลไม้กับลานหินให้หัดตัดไม้ ขุดแร่',
    meadow: 'ทุ่งโล่ง มอนหลายธาตุปนกัน ตีไปถอยไปได้สบาย · มีหมู่บ้านกังหันลมให้พัก',
    woods: 'ป่ามืด มอนหลายแบบ · บอสราชาเห็ดเรืองแสง Lv 50 หลับอยู่ในลานราชาเห็ด',
    canyon: 'มอนแข็ง DEF สูง · เหมืองร้างผลึกส้มให้พัก',
    farm: 'ทุ่งหญ้าหน้าไร่ (ทางเข้าจากค่าย) มีสไลม์เขียว ค้างคาว หมูป่า Lv 1–3 ของมือใหม่ · มอนทุ่งหญ้าไม่ตีก่อน · ฟักทองกับแครอทไม่ตีก่อน · อีกากับหุ่นไล่กาในไร่ข้าวโพดตีก่อน · ลานบ้านไร่ปลอดภัย',
    marsh: 'เต่าตะไคร่ DEF สูงมากแต่ MDEF ต่ำ เวทได้เปรียบ (เยอะสุดที่บึงบัวใหญ่) · แมลงปอหลบเก่ง · ท่าน้ำคนหาปลาปลอดภัย',
    graveyard: 'ผีดวงไฟธาตุวิญญาณ: ตีกายภาพไม่มีธาตุเข้าแค่ 25% · สลัวทั้งวัน มีหมอกลอย · ลานหน้าโบสถ์ปลอดภัย',
    burnt: 'ป่าหลังไฟไหม้ ถ่านยังคุ · ภูตเถ้าถ่านธาตุวิญญาณ ตีกายภาพไม่มีธาตุเข้าน้อย · ลานเผาถ่านปลอดภัย',
    wind: 'ที่ราบบนหน้าผา ลมแรง · อินทรีพายุบินเร็ว หลบเก่ง · แกะเมฆไม่ตีก่อน · กระท่อมคนเลี้ยงแกะปลอดภัย',
    swamp: 'มอนธาตุพิษ: สายพิษกับสายเงาแทบไม่เข้า ใช้สายกายภาพหรือธาตุอื่น · ดอกไม้กินคนช้าแต่ตีไกล · กระท่อมแม่มดปลอดภัย',
    volcano: 'ธาตุไฟล้วน: น้ำแข็งได้เปรียบมาก · โกเลมลาวาตีหนัก · บ่อลาวาเรืองแสง · โรงตีเหล็กร้างปลอดภัย',
    lake: 'น้ำ + มืด: สายลม/สายฟ้าได้เปรียบ · ภูตหมอกเงาโปร่งแสง · มีหมอก สลัวทั้งวัน · ท่าเรือเก่าปลอดภัย',
    prime: 'ธาตุดิน: ไฟได้เปรียบ · ต้นไม้ยักษ์โบราณ HP สูงมาก · ใจกลางป่าโบราณ Lv สูงสุด 92',
    batcave: 'ดันเจี้ยนแรก ชั้นเดียว มืดนิดหน่อย มีหีบกับกับดักหนาม · ว่ากันว่าลึกเข้าไปมีรังลับของค้างคาว...',
    batnest: 'รังลับของราชาค้างคาว เปิดเมื่อปราบค้างคาวครบ 100 ตัวในถ้ำ (ทางเปิด 3 นาที)',
    antmine1: 'มดเรียกพวก: ตีตัวหนึ่ง ตัวอื่นที่อยู่ใกล้จะวิ่งมาช่วย · ทางแคบ สายตีหมู่ได้เปรียบ',
    antmine2: 'มดบินหลบเก่ง มดทหาร DEF สูง · หีบเหล็ก',
    antmine3: 'รังนางพญามด: กระโดดทับ พ่นกรด (กรดค้างบนพื้น) เรียกมดงาน · หีบทองหลังบอส',
    crypt1: 'มืดมาก: ตะเกียงของเราส่องได้ไม่ไกล สกิลไฟ/แสงช่วยส่อง · อมตะ ผี วิญญาณเทียน',
    crypt2: 'ห้องราชาสุสาน: ลูกไฟวิญญาณเป็นวง ไฟตกรอบตัว เรียกโครงกระดูก หายตัว',
    lavavent1: 'บ่อลาวาเดินผ่านไม่ได้ หนอนลาวาพุ่งเร็ว อิมป์เปลวไฟ · น้ำแข็งได้เปรียบ',
    lavavent2: 'ถ้ำมังกรลาวา: พ่นไฟเป็นแนว กระโดดทับ อุกกาบาตตกรอบตัว',
    // the story's new places (fields4.js, dungeons2.js)
    road: 'ถนนเก่าของผู้อพยพ เกวียนล่มเต็มทาง · โจรคาราวานพุ่งแทงเร็ว ม้ากลวงชาร์จแรง · ศาลาพักริมทางปลอดภัย',
    salt: 'เมืองด่านเกลือขาวริมแม่น้ำ · ยามด่านเกราะหนา ตีไกล · คนคุมโกดังทุบหนัก · ลอร์ดฮัลวาร์ดอยู่หน้าปราสาท · ลานคนรอข้ามด่านปลอดภัย',
    peak: 'ยอดเขาหิมะตกทั้งวัน · มอนธาตุน้ำ: ไฟได้เปรียบ · หมาป่าหิมะพุ่งเร็ว · หอดูดาวนกฮูกอยู่บนสันเขาเหนือ · ที่หลบพายุปลอดภัย',
    nroad: 'หมู่บ้านร้างริมทางขึ้นเมืองหลวง · ชาวบ้านกลวงเดินช้าแต่ตีไกล · บ้านที่ยังมีตะเกียงปลอดภัย',
    outer: 'ย่านนอกกำแพงเมืองหอระฆัง · ยามกลวง DEF สูงมาก เวทได้เปรียบ · กัปตันอัลดริกเฝ้าประตูเมือง · จัตุรัสน้ำพุปลอดภัย',
    canal: 'คลองมืดกับโรงเทียน · ลูกน้องแคนเดิลธาตุไฟ: น้ำแข็งได้เปรียบ · ประตูหลังหอบัญชีอยู่ริมคลองใต้ · ท่าเรือเล็กปลอดภัย',
    isle: 'เกาะหมอกกลางทะเลสาบ ไปทางเรือจากท่าเรือเก่า · ชาวเมืองหมอกไม่ตีก่อน · โนคเทิร์นอยู่ที่หอหินเก่า',
    dark: 'ป่าที่แสงอยู่ไม่ได้ มืดมาก · กวางไร้แสงธาตุเงา: ศักดิ์สิทธิ์ได้เปรียบ · หุ่นหมายเลขหนึ่งอยู่ที่แคมป์ที่ไฟดับ',
    cathedral: 'ย่านที่สว่างเกินจริง · มอนศักดิ์สิทธิ์: สายเงาได้เปรียบ · ห้องใต้ดินโรงหุ่นอยู่ใกล้ประตู · หอระฆังอยู่ลานระฆังขาว',
    owl1: 'หอดูดาว 3 ชั้น · นกฮูกหินบินได้ DEF สูง · มาจิสเตอร์วอสส์อยู่ในโดมดาวชั้นบนสุด',
    ledger1: 'ชั้นหนังสือสูงเท่าเพดาน · หนังสือบินธาตุวิญญาณ · บราเดอร์ควิลล์อยู่ห้องบัญชีชั้น 2',
    puppet1: 'ห้องขังกับโต๊ะช่างหุ่น · หุ่นไร้หน้าตีเร็ว ด้ายพันคนตีไกล · หุ่นที่ 2–6 รออยู่ตามห้อง',
    bell1: 'หอระฆัง 7 ชั้นสั้น ๆ · หุ่นระฆังทุบหนัก · หุ่นร้อยเชือกอยู่ยอดหอ',
    // the expansion's part 1 (fields5.js): the zones off the old maps
    farm2: 'ไร่ที่ถูกทิ้ง ข้าวโพดท่วมหัว · หนูนามุดดินโผล่ใต้ตัว · หุ่นไล่กามีโล่ฝาถัง ตีจากด้านหลังหรือใช้เวท · ผึ้งทานตะวันเป็นจ่าฝูง',
    meadow2: 'ดอกไม้บานตอนกลางคืน · ดอกไม้ยิงเมล็ดจากไกล · หิ่งห้อยหมอยาฮีลพวก ตีตัวฮีลก่อน · เม่นตายแล้วแตกตัว',
    marsh2: 'ลำธารไหลแรง โรงสีริมน้ำปลอดภัย · กบพ่นน้ำยิงไกล · เห็ดน้ำแตกตัว สายตีหมู่ได้เปรียบ',
    marsh3: 'น้ำตกเรืองแสง · ปูหินโล่ใหญ่กันด้านหน้า · ปลาไหลมุดโคลน · ราชินีกบน้ำตก Lv 34 อยู่ที่แอ่งน้ำตก',
    graveyard2: 'สุสานที่เก่ากว่าเดิม หมอกหนา · ผีขุดหลุมโผล่ใต้ตัว · แม่มดเทียนไขเรียกวิญญาณเทียน · โลงผีระเบิดได้ ตีให้ตายก่อน',
    woods2: 'เห็ดสูงเท่าต้นไม้ · เห็ดพองลมระเบิด · หมาป่าเห็ดจ่าฝูงทำให้ทั้งฝูงเร็วขึ้น ล้มจ่าฝูงแล้วฝูงแตก',
    wind2: 'เกาะหินลอยลม · ภูตลมยิงใบมีดสองลูก · ก้อนหินลอยแตกเป็นสามก้อน · แกะเมฆจ่าฝูง',
    swamp2: 'รากยักษ์ของต้นแม่พิษ · คางคกพองพิษระเบิดวงกว้าง · ดอกแม่พิษฮีลพวก · ทางลงถ้ำรากแม่พิษ',
    canyon2: 'ห้องเหมืองใต้ดินเต็มผลึกส้ม · ตุ่นมุดดิน · คนงานเหมืองผีเรียกค้างคาวผลึก',
    canyon3: 'หุบผาแดงลึก · แมงป่องยิงพิษ · ยักษ์หินทรายถือโล่หิน · ราชาแมงป่องทราย Lv 80',
    prime2: 'ทะเลสาบที่มังกรไพรวางไข่ · แองคิโลโล่หนา · พลีซิโอซอร์ดำน้ำโผล่ใต้ตัว · แม่มังกรไพร Lv 98 เฝ้ารัง',
    roots1: 'ถ้ำใต้หนองพิษ บ่อพิษเรืองแสง · สปอร์พิษลอยยิงไกล · หัวใจต้นแม่พิษ Lv 75 อยู่ชั้น B2',
    grave1: 'หลุมใต้วงหินต้นแรกที่ดาวตกลงมา · มอนธาตุศักดิ์สิทธิ์ · นักบุญออเรลรออยู่ใจกลางดาว',
  };
  // who hits with each element (their skill lines)
  const JOBS = {
    fire: 'จอมเวทสายไฟ · อัศวินสายเพลิง', water: 'จอมเวทสายน้ำแข็ง', wind: 'จอมเวทสายฟ้า · นักธนูสายพรานพฤกษา',
    holy: 'พระ · อัศวินสายผู้พิทักษ์', shadow: 'โจรสายเงา', poison: 'โจรสายพิษ', neutral: 'สายตีกายภาพ (ดาบ ธนู มีด)',
  };
  const ATTACKS = ['fire', 'water', 'wind', 'holy', 'shadow', 'poison', 'neutral'];
  NC.MAP_NOTES = NOTE; NC.MAP_ELEMENT_JOBS = JOBS; // (the K map window reads them: js/mapwin.js)
  const CAMP_ZONES = ['ค่ายกลางป่า']; // (monsters.js still lists the old camp's ruins and forest)

  // ---------------- what lives on a map (monsters.js ROSTER), its elements, what works there ----------------
  const lvRange = (t) => { const m = /(\d+)\D+(\d+)/.exec(t || ''); return m ? [+m[1], +m[2]] : null; };
  const cache = new Map();
  function infoOf(id) {
    if (cache.has(id)) return cache.get(id);
    const M = NC.MAPS[id] || {}, R = (NC.ROSTER || {})[id] || {};
    const keys = id === 'camp' ? CAMP_ZONES : ['*', ...(M.zones || []).map((z) => z.name)];
    const mons = new Map(); // species -> { w: its share of the spawns, lv: [from, to] }
    for (const key of keys) {
      const set = R[key];
      if (!set) continue;
      const zone = (M.zones || []).find((z) => z.name === key);
      for (const slot of ['slime', 'hollow']) {
        const list = set[slot] || [], sum = list.reduce((s, it) => s + it[1], 0) || 1;
        const lv = (zone && zone.lv && zone.lv[slot]) || (M.lv && M.lv[slot]) || null;
        for (const [sp, w] of list) {
          const m = mons.get(sp) || { w: 0, lv: null };
          m.w += w / sum;
          if (lv) m.lv = m.lv ? [Math.min(m.lv[0], lv[0]), Math.max(m.lv[1], lv[1])] : lv.slice();
          mons.set(sp, m);
        }
      }
    }
    for (const [sp] of M.bosses || []) mons.set(sp, { w: 0, lv: M.lv && M.lv[sp], boss: true });
    const share = {};
    let total = 0;
    for (const [sp, m] of mons) {
      if (m.boss) continue;
      const el = (NC.MONSTERS[sp] || {}).element || 'neutral';
      share[el] = (share[el] || 0) + m.w; total += m.w;
    }
    const els = Object.keys(share).sort((a, b) => share[b] - share[a]);
    const mod = {};
    for (const a of ATTACKS) {
      let s = 0;
      for (const el in share) s += NC.elementMod(a, el) * share[el];
      mod[a] = total ? s / total : 1;
    }
    const good = ATTACKS.filter((a) => mod[a] >= 1.2).sort((a, b) => mod[b] - mod[a]);
    const bad = ATTACKS.filter((a) => mod[a] <= 0.6).sort((a, b) => mod[a] - mod[b]);
    const drops = [];
    for (const [sp] of mons) for (const d of (NC.MAT_DROPS || {})[sp] || []) if (!drops.includes(d[0])) drops.push(d[0]);
    const r = { mons, share, total, els, mod, good, bad, drops, lv: lvRange(M.lvText) };
    cache.set(id, r);
    return r;
  }
  NC.mapInfo = infoOf;

  // ---------------- in the world: the elements beyond each edge warp, and name tags by level ----------------
  const baseLabels = NC.Maps.drawLabels;
  NC.Maps.drawLabels = function (ctx, game) {
    baseLabels.apply(this, arguments);
    const p = game.player;
    for (const pt of game.portals) {
      if (!pt.to || !NC.MAPS[pt.to]) continue;
      const d = Math.hypot(pt.x - p.x, pt.y - p.y);
      if (d > 900) continue;
      const els = infoOf(pt.to).els.slice(0, 3);
      if (!els.length) continue;
      // (under the name and the level, where maps.js drawLabels puts them)
      const y = (pt.y < 330 ? pt.y + 120 : pt.y - 150) + Math.sin(game.time * 2) * 4 + (pt.lvText ? 34 : 0) + 38, s = 30, gap = 8;
      const w = els.length * s + (els.length - 1) * gap;
      ctx.save();
      ctx.globalAlpha = NC.clamp((900 - d) / 300, 0, 1);
      els.forEach((el, i) => { const spr = NC.SPR['el_' + el]; if (spr) ctx.drawImage(spr.img, pt.x - w / 2 + i * (s + gap), y - s / 2, s, s); });
      ctx.restore();
    }
  };

  // a monster's name, by the EXP bands (js/levelgap.js): white = within 3 levels (full EXP); stronger yellow (70%), red
  // (40%), deeper reds (20%, 5%); weaker green (70%), grey (40%), darker greys (20%, 5%)
  const STRONGER = ['#ffffff', '#ffd66e', '#ff8f7f', '#ff6f6f', '#ff4f5f'], WEAKER = ['#ffffff', '#a8f09c', '#b9bfcc', '#9ca2ae', '#848a96'];
  NC.levelColor = function (e, game, aimed) {
    const p = game && game.player, b = p && e.lv && NC.levelGapBand ? NC.levelGapBand(p.lv, e.lv) : null;
    if (!b || b.band === 0) return aimed ? '#fff3cf' : '#ffffff';
    const colors = b.stronger ? STRONGER : WEAKER;
    return colors[Math.min(b.band, colors.length - 1)];
  };
})();
