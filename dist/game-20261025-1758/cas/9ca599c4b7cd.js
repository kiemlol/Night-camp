/* topup.js — เติมเพชรจันทร์ (the user, 2026-10-17: "ทำเเพคเติมเงินเเบบ หิวเงินเนียนๆ ... ทำเป้น ช่วงทดสอบ เติมเงิน
   พอเปิดจริงจะได้คูณ 2" then "ใส่เข้าเกมเลย"). The design is the Artifact "แพคเติมเงิน Night Camp"
   (https://claude.ai/artifact/15Dc5D5cWhR84mSJ2wwEVh). This file holds the data and the rules; the page is its own file.
     บันไดเพชร      8 packs, 35-6,590 THB, 150 gems = one pull (gacha.js prices stay)
     ผู้บุกเบิก      3 founder packs, sold in the closed beta only (the last one 300 accounts)
     ช่วงทดสอบ x2   every base gem bought in the beta comes back x2 at launch: 100% on the first login, then +25% a week
                   for 4 weeks; x2 counts up to 50,000 base gems an account, the rest comes back x1
     วันเปิดจริง     the monthly card, the pass, the traveler fund, the starter pack: shown, not sold in the beta
   Offline purchases are unavailable. Online purchases are sent to the server by js/online/market.js.
   Saved: nightcamp.topup.v1 (the ledger, the founder counts). ?topup opens the page. */
(function () {
  'use strict';
  const NC = window.NC;
  const KEY = 'nightcamp.topup.v1';

  const PACKS = [
    { id: 'g35', name: 'ประกายไฟ', thb: 35, gems: 150 },
    { id: 'g99', name: 'ถ่านแดง', thb: 99, gems: 430 },
    { id: 'g199', name: 'ตะเกียงเดินทาง', thb: 199, gems: 880 },
    { id: 'g399', name: 'กองไฟเล็ก', thb: 399, gems: 1800 },
    { id: 'g799', name: 'หีบเพชรจันทร์', thb: 799, gems: 3680, best: true },
    { id: 'g1590', name: 'บ่อจันทร์', thb: 1590, gems: 7450 },
    { id: 'g3290', name: 'เงาต้นไม้ดำ', thb: 3290, gems: 15700 },
    { id: 'g6590', name: 'รากจันทร์ดำ', thb: 6590, gems: 32000 },
  ];
  // the first top-up of each tier (launch only): +100% for tiers 1-4, +50% for 5-8
  PACKS.forEach((p, i) => { p.first = i < 4 ? p.gems : Math.round(p.gems / 2); p.rate = p.gems / p.thb; });

  const FOUNDERS = [
    // shows: the three icons on the card (assets/topup/it_<name>.png)
    { id: 'f349', name: 'ไฟริบหรี่', thb: 349, gems: 1500, shows: ['lanternhat', 'title', 'gems_s'], gets: ['หมวกตะเกียงผู้บุกเบิก', 'ฉายา "ผู้บุกเบิกค่าย"'] },
    { id: 'f1290', name: 'กองไฟ', thb: 1290, gems: 5800, shows: ['cloak', 'emote', 'gems_m'], gets: ['ทุกอย่างในขั้นไฟริบหรี่', 'ผ้าคลุม "เถ้ากองไฟ"', 'ท่าทาง "นั่งผิงไฟ"', 'บัตรกองไฟ 30 วัน (นับจากวันเปิด)'] },
    { id: 'f3990', name: 'ต้นไม้ดำ', thb: 3990, gems: 18500, limit: 300, shows: ['cloakglow', 'stone', 'gems_l'], gets: ['ทุกอย่างในขั้นกองไฟ', 'ผ้าคลุมเถ้ากองไฟ แบบเรืองแสง', 'ชื่อสลักบนหินผู้บุกเบิกข้างกองไฟกลางค่าย', 'บัตรกองไฟ 90 วัน'] },
  ];
  const SOLD_START = 13; // the Dark Tree founder pack: sold elsewhere so far (a stand-in until the server counts it)

  // shown in the beta, sold at launch
  const LAUNCH = [
    { id: 'card', name: 'บัตรกองไฟ', price: '179 บาท / 30 วัน', gets: ['ได้ทันที 300 เพชร + วันละ 40 (รวม 1,500)', 'คลัง +2 แท็บ · ช่องฝากขาย +3 · ค่าวาร์ป −30%', 'เควสรายวันเก็บค้างได้ 5 วัน', 'ไม่เพิ่ม EXP ไม่เพิ่มดรอป'] },
    { id: 'pass', name: 'พาสฤดูกาล', price: '399 / 799 บาท ต่อฤดู', gets: ['พรีเมียม: 750 เพชร ชุดประจำฤดู ท่าทาง 4 กรอบแชท 2', 'พลัส: + 1,050 เพชรทันที + ชุดประจำฤดูอีก 1 สี', 'ขั้นพาสได้จากการเล่นเท่านั้น ไม่ขายการข้ามขั้น'] },
    { id: 'fund', name: 'กองทุนนักเดินทาง', price: '299 บาท ครั้งเดียว', gets: ['เพชรตามเลเวลสูงสุดในบัญชี Lv 10 ถึง 99', 'รวม 4,500 เพชร', 'ถึง Lv 99 ใช้เวลาเล่นราว 300 ชั่วโมงบอท'] },
    { id: 'starter', name: 'แพคตะเกียงแรก', price: '59 บาท ครั้งเดียว', gets: ['300 เพชร', 'หมวกแฟชั่น 1 ใบ เลือกเองจาก 5 ใบ', 'ท่าทาง "โบกตะเกียง"'] },
  ];

  const CAP = 50000; // base gems counted x2 an account; above it x1
  const RATE_AVG = 4.6;

  let st = { buys: [], founders: {}, seq: 0 };
  try { if (!NC.ONLINE) st = Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage blocked */ }
  const skuOf = (id) => PACKS.find((p) => p.id === id) || FOUNDERS.find((f) => f.id === id) || null;
  const isFounder = (id) => FOUNDERS.some((f) => f.id === id);

  function totals() {
    const thb = st.buys.reduce((a, b) => a + b.thb, 0), base = st.buys.reduce((a, b) => a + b.gems, 0);
    const doubled = Math.min(base, CAP), launch = doubled * 2 + Math.max(0, base - CAP);
    const bonus = launch - base, week = Math.floor(bonus / 4);
    return { thb, base, launch, day1: base, bonus, weeks: [week, week, week, bonus - week * 3], capLeft: Math.max(0, CAP - base), count: st.buys.length };
  }
  // what one more purchase of `gems` base gems adds at launch (the cap counted): { now, launch, extra }
  function previewAdd(gems) {
    const t = totals(), after = Math.min(t.base + gems, CAP) * 2 + Math.max(0, t.base + gems - CAP);
    return { now: gems, launch: after - t.launch, extra: after - t.launch - gems };
  }
  const founderLeft = (f) => (f.limit ? Math.max(0, f.limit - SOLD_START - (st.founders[f.id] || 0)) : null);

  // why a sku can't be bought now (null = it can)
  function blocked(id) {
    const s = skuOf(id);
    if (!s) return 'ไม่มีแพคนี้';
    return 'ช่วงทดสอบยังไม่เปิดรับเงินจริง: เกมยังไม่มีระบบชำระเงิน · หน้านี้ให้ดูแพคและกติกา x2 ไว้ก่อน';
  }

  function buy(id) {
    return { ok: false, why: blocked(id) };
  }

  NC.TopUp = { PACKS, FOUNDERS, LAUNCH, CAP, RATE_AVG, state: () => st, totals, previewAdd, founderLeft, blocked, buy, skuOf, isFounder };
})();
