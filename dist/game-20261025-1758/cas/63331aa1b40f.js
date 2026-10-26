/* jobteaser.js — "อาชีพใหม่ เร็ว ๆ นี้" under the job change tab (the owner, 2026-10-20: "ใส่อาชีพใหม่เข้าไปด้วยแต่ ไม่เปิดให้
   เปลี่ยนอาชีพ รวมทั้งซามูไรด้วย ใส่ไปอวดเฉยๆในหน้าเปลี่ยนอาชีพ"). The samurai line and the three new main lines (merchant,
   crow-mask doctor, bellringer) shown in the old job cards' look (skillui.js HUD.renderJobs, css/skillwin.css .job), each
   with its picture, what it does, its two 2nd jobs and its skills, and a "เร็ว ๆ นี้" button that only says so.
   Nothing here can make a hero those jobs: their source modules (js/samurai.js, js/obtjobs.js) are omitted from the page and
   they are absent from NC.JOBS for players, and online the server keeps them closed. The pictures and icons are a snapshot in assets/jobteaser
   (drawn 2026-10-20 from catalog source with the card's own NC.drawAvatar call, 2x), so this file needs none of their code.
   ?jobteaser=0 hides it. Styles: css/jobteaser.css.
   Also: the real cards are drawn again once their outfit art has streamed in (redrawWhenReady). */
(function () {
  'use strict';
  const NC = window.NC, HUD = NC.HUD;
  if (!HUD || typeof HUD.renderJobs !== 'function') return;
  const A = 'assets/jobteaser/';

  // id: [name, what it does, its two 2nd jobs, its skills: [icon, name]] (as the jobs have them, 2026-10-20)
  const LINES = [
    ['samurai', 'Moonblade', 'นักดาบใต้แสงจันทร์ ถือคาตานะสองมือ ฟันเป็นจันทร์เสี้ยว ชักดาบพุ่งผ่านแล้วแผลเปิดตามหลัง สะสม "ใจดาบ" จนเต็มแล้วปล่อยดาบจันทร์เต็มดวง',
      ['Crimson Ronin', 'Tempest Ronin'],
      [['sa_crescent', 'ฟันจันทร์เสี้ยว'], ['sa_wave', 'คลื่นดาบจันทร์'], ['sa_fullmoon', 'ดาบจันทร์เต็มดวง'], ['sa_draw', 'ชักดาบแสงจันทร์'],
        ['sa_counter', 'ท่าสวนกลับ'], ['sa_katana', 'ชำนาญคาตานะ'], ['sa_ki', 'ใจดาบ'], ['sa_flow', 'ฟันต่อเนื่อง']]],
    ['peddler', 'พ่อค้าเร่', 'พ่อค้าแบกเป้ เหวี่ยงหีบเหล็กห้อยโซ่ ปาสินค้าในเป้ใส่มอน ของที่ปาเป็นธาตุตามวัสดุของมอนตัวนั้น ขยะในกระเป๋าจึงมีค่า',
      ['นายคาราวาน', 'เจ้าหนี้'],
      [['mc_toss', 'ปาของขาย'], ['mc_crate', 'ลังไม้กระแทก'], ['mc_sale', 'ล้างสต็อก'], ['mc_swing', 'เหวี่ยงหีบ'],
        ['mc_slam', 'หีบทุบ'], ['mc_strong', 'หีบหนัก'], ['mc_knack', 'มือขายของ'], ['mc_thrift', 'ของไม่หมดเป้']]],
    ['crowdoc', 'หมอหน้ากากกา', 'หมอหน้ากากกา ขวดยาขวดเดียว โดนเพื่อนเป็นยารักษา โดนมอนเป็นพิษ ติด "ไข้" ที่ลามไปตัวข้าง ๆ ตอนมอนตาย',
      ['หมอยาราตรี', 'ผู้หว่านโรค'],
      [['cw_flask', 'ปาขวดยา'], ['cw_mist', 'หมอกยา'], ['cw_night', 'คืนแห่งการรักษา'], ['cw_fever', 'ไข้ลาม'],
        ['cw_inject', 'ฉีดยา'], ['cw_antidote', 'ยาถอนพิษ'], ['cw_cane', 'ไม้เท้าหัวกา'], ['cw_study', 'ตำราหมอ']]],
    ['bellringer', 'ผู้ตีระฆัง', 'ผู้ตีระฆัง ตีเป้าเดิมนับเสียง ครบสามครั้งเกิดคลื่นเสียงใหญ่ เสียงสะท้อนเด้งต่อตัวข้าง ๆ ทำให้มอนมึน',
      ['ผู้เฝ้าหอระฆัง', 'ผู้ตีระฆังสุดท้าย'],
      [['br_strike', 'ตีระฆัง'], ['br_ring', 'คลื่นเสียง'], ['br_great', 'ระฆังสามครา'], ['br_toll', 'กังวานที่สาม'],
        ['br_echo', 'เสียงสะท้อน'], ['br_daze', 'มึนเสียง'], ['br_beat', 'จังหวะระฆัง'], ['br_rope', 'เหวี่ยงเชือก']]],
  ];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const pics = new Map(); // id -> Image (loaded once)
  const pic = (id) => { let im = pics.get(id); if (!im) { im = new Image(); im.src = A + id + '.png'; pics.set(id, im); } return im; };
  const SOON = 'อาชีพนี้ยังไม่เปิดให้เปลี่ยน · เร็ว ๆ นี้';

  function card(L) {
    const [id, name, desc, kids, skills] = L, c = el('div', 'job soon');
    // (the picture on the card's own canvas: css/skillwin.css sizes .job canvas; 2x for a sharp look)
    const cv = document.createElement('canvas');
    cv.width = 320; cv.height = 380;
    const im = pic(id), draw = () => cv.getContext('2d').drawImage(im, 0, 0, 320, 380);
    if (im.complete && im.naturalWidth) draw(); else im.addEventListener('load', draw, { once: true });
    const icons = skills.map(([k, n]) => `<img src="${A}sk_${k}.png" title="${esc(n)}" alt="">`).join('');
    c.innerHTML = '<i class="jt-badge">เร็ว ๆ นี้</i>' +
      `<div class="job-name">${esc(name)}</div><div class="job-desc">${esc(desc)}</div>` +
      `<div class="jt-next">ขั้น 2: ${kids.map(esc).join(' · ')}</div><div class="job-sk">${icons}</div>`;
    c.prepend(cv);
    const b = el('button', 'big job-go jt-go', 'เร็ว ๆ นี้');
    b.title = SOON;
    b.addEventListener('click', () => { if (HUD.toast) HUD.toast(SOON); }); // (says why, never changes the job)
    c.appendChild(b);
    return c;
  }

  // The real cards (skillui.js) draw their hero once, when the tab opens; a job's outfit art streams in (js/stream.js), so a
  // 2nd job's card often showed a head and a floating weapon (2026-10-20, seen on a phone). Each card is drawn again, the
  // same way, once its outfit has arrived.
  function redrawWhenReady(cv, eq) {
    const S = NC.Sprites;
    if (!S || !S.equipMissing || !S.equipMissing(eq)) return; // (equipMissing also asks for what is missing)
    let tries = 0;
    const tick = () => {
      if (!cv.isConnected) return;
      if (S.equipMissing(eq) && ++tries < 60) { setTimeout(tick, 250); return; }
      const c2 = cv.getContext('2d');
      c2.clearRect(0, 0, cv.width, cv.height);
      c2.fillStyle = 'rgba(16,14,26,0.45)'; c2.beginPath(); c2.ellipse(80, 170, 44, 12, 0, 0, Math.PI * 2); c2.fill();
      NC.drawAvatar(c2, eq, 80, 170, 0.95, 1, { t: 0.4 });
    };
    setTimeout(tick, 250);
  }

  const baseRender = HUD.renderJobs;
  HUD.renderJobs = function (list, p) {
    const r = baseRender.apply(this, arguments);
    const cvs = [...list.querySelectorAll('.jobs:not(.jt-row) > .job > canvas')];
    NC.nextJobs(p).forEach((id, i) => {
      const N = NC.JOBS[id], C = N && NC.CLASSES.find((c) => c.id === N.cls);
      if (C && cvs[i]) redrawWhenReady(cvs[i], Object.assign({}, p.equip, C.items));
    });
    const shown = LINES.filter((L) => !NC.JOBS[L[0]]); // (a line that became a real job shows as one, not twice)
    if (!shown.length) return r;
    list.appendChild(el('div', 'jobs-h jt-h', 'อาชีพใหม่ เร็ว ๆ นี้ <small>ยังเปลี่ยนไม่ได้ ดูไว้ก่อนนะ</small>'));
    const box = el('div', 'jobs jt-row');
    for (const L of shown) box.appendChild(card(L));
    list.appendChild(box);
    return r;
  };
  NC.JobTeaser = { LINES }; // (tests)
})();
