/* jobcards.js — the job change page as one card per job (the user, 2026-10-19: "หน้าเปลี่ยนอาชีพตัวละครอยากให้ดีไซน์เป็นการ์ด
   แต่ละอาชีพเลย"; picked layout A of assets/gen/nightcamp_jc_a_raw.png, then "เอาดีไซน์การ์ดแบบภาพตัวอย่างเลย เหมือน 100%").
   Replaces skillui.js's HUD.renderJobs (the skill window's เลือกอาชีพ / เลื่อนขั้น 2 / เลื่อนคลาส 3 tab, js/skillwin.js):
   tall cards side by side, built to the mockup's measurements (css/jobcards.css), each with
     the gold frame, a gem on a gold mount in the job's colour, a gold star in each top corner · the painting
     (assets/jobcard/<id>.webp; the hero on the rig over the job's colour until the painting exists), the job's text sliding
     up when pointed at · the name on an arched ribbon with folded tails · role and weapon chips with line icons ·
     โจมตี / ป้องกัน / เล่นง่าย as 5 stars · signature skills (one per line) · "ต่อไปเป็นได้" with the next jobs' heads
     (assets/jobcard/<id>_face.webp, the game's own hero) · the take-it button (press twice to confirm).
   A single card (a 2nd job's class 3) gets a side panel: the job's path and what the change brings.
   The window widens on this tab and its skill bar hides. Taking a job is HUD.changeJob as before. */
(function () {
  'use strict';
  const NC = window.NC, HUD = NC.HUD, SK = NC.SKILLS, SHARED = NC.SHARED_SKILLS || [];
  if (!HUD) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const iconSrc = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || '';
  const JOB = (p) => NC.JOBS[p.job] || NC.JOBS.traveler;
  const art = (id) => `assets/jobcard/${id}.webp`;
  const faceImg = (id) => `<i class="jc-face"><img alt="" src="assets/jobcard/${id}_face.webp"></i>`;

  // id: [colour, role, attack, defense, easy, role icon]
  const CARD = (NC.JOBCARD = {
    knight: ['#d8452f', 'แนวหน้า', 3, 5, 5, 'shield'], mage: ['#8a4fd8', 'ดาเมจเวท', 5, 1, 3, 'book'], archer: ['#3f9a3c', 'ระยะไกล', 4, 2, 4, 'bow'],
    rogue: ['#c0303f', 'คริติคอล', 5, 2, 2, 'blade'], priest: ['#2f6fd0', 'ผู้รักษา', 2, 3, 4, 'sun'],
    paladin: ['#d9a32c', 'แทงก์ทีม', 2, 5, 4, 'shield'], dragonknight: ['#d9542a', 'บุกทะลวง', 4, 4, 3, 'flame'], swordmaster: ['#3c7fd8', 'ดาบคู่', 5, 3, 3, 'blade'],
    berserker: ['#a8262f', 'คลั่งเลือด', 5, 3, 2, 'flame'], archmage: ['#5b54d8', 'เวทผสม', 5, 1, 2, 'book'], warlock: ['#7a3fc0', 'สาปศัตรู', 4, 2, 3, 'moon'],
    firemage: ['#e0662a', 'เวทไฟ', 5, 1, 4, 'flame'], icemage: ['#4aa8e0', 'เวทน้ำแข็ง', 4, 2, 3, 'spark'], ranger: ['#2f8f6a', 'สไนป์ กับดัก', 5, 2, 3, 'bow'],
    wolfhunter: ['#5a7ea0', 'คู่หมาป่า', 4, 3, 4, 'paw'], bard: ['#d99a2a', 'เพลงหนุนทีม', 3, 2, 3, 'note'], gunslinger: ['#b0602a', 'มือปืน', 5, 2, 3, 'bow'],
    assassin: ['#9a2035', 'ลอบสังหาร', 5, 1, 3, 'blade'], shinobi: ['#3a4fa0', 'คาถานินจา', 4, 2, 2, 'blade'], reaper: ['#7d5aa8', 'เก็บวิญญาณ', 5, 2, 3, 'moon'],
    puppeteer: ['#8a5ab0', 'เชิดหุ่น', 4, 3, 2, 'spark'], bishop: ['#d9b03a', 'ฮีลหมู่', 1, 4, 4, 'sun'], monk: ['#2a9a8a', 'หมัดปราณ', 5, 3, 2, 'fist'],
    lightkeeper: ['#e0a030', 'เขตแสง', 2, 3, 4, 'sun'], wisp: ['#6aa8d8', 'ดวงไฟวิญญาณ', 3, 2, 3, 'spark'],
    dawnwarden: ['#e0a92a', 'แทงก์รุ่งสาง', 3, 5, 4, 'shield'], dragonbound: ['#c8342a', 'เลือดมังกร', 5, 4, 3, 'flame'], starblade: ['#4a86e0', 'ดาบดวงดาว', 5, 3, 3, 'blade'],
    starcore: ['#e8862a', 'ดวงอาทิตย์', 5, 1, 3, 'flame'], winterlord: ['#5ab4e8', 'จ้าวน้ำแข็ง', 4, 3, 3, 'spark'], astral: ['#3c4fc0', 'ดาวเคราะห์ธาตุ', 5, 1, 2, 'book'],
    hexlord: ['#2aa8b8', 'ไฟผีลูกโซ่', 5, 2, 3, 'moon'], bloodmoon: ['#b0202a', 'คลั่งจันทร์', 5, 2, 2, 'moon'], moonsniper: ['#4a9a9a', 'ซุ่มยิง', 5, 2, 3, 'bow'],
    packalpha: ['#6a90d0', 'ฝูงวิญญาณ', 4, 3, 4, 'paw'], maestro: ['#7a4ac0', 'วงดนตรี', 3, 2, 3, 'note'], outlaw: ['#a83a2a', 'กระสุนหยุดเวลา', 5, 2, 2, 'bow'],
    eclipse: ['#b08a2a', 'คราสมรณะ', 5, 1, 2, 'blade'], shadowlord: ['#6a3fa0', 'ร่างเงา', 4, 2, 2, 'moon'], harvester: ['#3a6aa8', 'จันทร์เก็บเกี่ยว', 5, 2, 3, 'moon'],
    showmaster: ['#c0392b', 'โรงละครหุ่น', 4, 3, 2, 'spark'], starsaint: ['#d9b03a', 'ศรัทธาดวงดาว', 1, 4, 4, 'sun'], meteorfist: ['#d8442a', 'หมัดดาวตก', 5, 3, 2, 'fist'],
    beacon: ['#c99a2a', 'ประภาคาร', 3, 3, 4, 'sun'], starshepherd: ['#7aa0d8', 'ดวงดาวนำทาง', 3, 2, 3, 'spark'],
  });

  // ---------------- the line icons of the chips (navy strokes in a white circle, as in the mockup) ----------------
  const P = {
    shield: '<path d="M12 3.2l7 2.8v5.2c0 4.6-3.1 8.1-7 9.6-3.9-1.5-7-5-7-9.6V6z"/>',
    book: '<path d="M3.5 5.5c3-1 6-.8 8.5 1 2.5-1.8 5.5-2 8.5-1v12.6c-3-1-6-.8-8.5 1-2.5-1.8-5.5-2-8.5-1zM12 6.5v12.6"/>',
    bow: '<path d="M7 3.5c6.5 2.5 9.5 10.5 4 17M7 3.5l4 17M4 19.5l15.5-15.5M15.5 4h4v4"/>',
    blade: '<path d="M19.5 4.5l-9.8 9.8-2.4-.4.4-2.4 9.8-9.8zM8.6 13.2l2.2 2.2M7.2 16.8l-2.7 2.7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
    flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.6 3-5.6 3.6-9.3 2.4 1.6 3.3 3.6 3.2 5.6 1.1-.8 1.8-2 1.9-3.4 2.3 2 3.3 4.4 3.3 7.1 0 3.6-2.6 6.2-5.5 6.2z"/>',
    moon: '<path d="M15.5 3.6a8.6 8.6 0 1 0 4.9 13.3A7 7 0 0 1 15.5 3.6z"/>',
    spark: '<path d="M12 2.8l2 7.2 7.2 2-7.2 2-2 7.2-2-7.2-7.2-2 7.2-2z"/>',
    paw: '<circle cx="7" cy="9" r="1.9"/><circle cx="11" cy="6.2" r="1.9"/><circle cx="15.4" cy="7" r="1.9"/><circle cx="18" cy="11" r="1.7"/><path d="M8.5 16.2c0-2.6 2.2-4.7 4.5-4.7s4.2 2.4 3.6 5c-.5 2-2.6 2.4-4.1 2.4s-4-.4-4-2.7z"/>',
    note: '<path d="M9.5 17.5V5.2l10-2v12M9.5 17.5a2.6 2.2 0 1 1-5.2 0 2.6 2.2 0 1 1 5.2 0zM19.5 15.2a2.6 2.2 0 1 1-5.2 0 2.6 2.2 0 1 1 5.2 0z"/>',
    fist: '<path d="M6.5 10.5V7.8a1.6 1.6 0 0 1 3.2 0v2.2-3.2a1.6 1.6 0 0 1 3.2 0v3.2-2.6a1.6 1.6 0 0 1 3.2 0v3.4-1.4a1.6 1.6 0 0 1 3.2 0v4.2c0 3.6-2.6 6-6 6h-1.4c-3 0-5.4-2.4-5.4-5.4v-1.2a1.8 1.8 0 0 1 3.6 0"/>',
    sword: '<path d="M19.5 4.5l-9.5 9.5M19.5 4.5h-3l-8.8 8.8M19.5 4.5v3l-8.8 8.8M6.2 12.4l5.4 5.4M8.4 15.6l-3.9 3.9"/>',
    staff: '<path d="M5 19.5l9.5-9.5"/><circle cx="16.8" cy="7.2" r="3.2"/><path d="M15.2 3.6l1.6 0M20.4 7.2v1.6"/>',
    spear: '<path d="M4.5 19.5L16 8M16 8l1.2-4.4L21 2.8l-.8 3.8L16 8z"/>',
    axe: '<path d="M6 20l10-10M12.5 6.5c2-2.8 5.2-3.8 7.8-3 .8 2.6-.2 5.8-3 7.8z"/>',
    gun: '<path d="M3.5 9.5h14l2.5-2v4H11l-1.5 5.5H6.2l1.3-5.5h-4z"/>',
    scythe: '<path d="M7 21l7-17M14 4c3.5-.4 6.4 1.2 7 4-3-1.6-6.4-1.4-8.6-.5"/>',
  };
  const icon = (k) => `<i class="jc-ic"><svg viewBox="0 0 24 24">${P[k] || P.spark}</svg></i>`;
  const WICON = { sword: 'sword', gsword: 'sword', dsword: 'sword', katar: 'blade', dagger: 'blade', huuma: 'blade', wire: 'blade',
    sickle: 'scythe', scythe: 'scythe', spear: 'spear', lance: 'spear', qstaff: 'spear', axe: 'axe', gaxe: 'axe', hammer: 'axe', mace: 'axe',
    staff: 'staff', orb: 'staff', lantern: 'staff', torch: 'staff', bell: 'staff', book: 'book', puppet: 'staff', bow: 'bow', xbow: 'bow',
    pistol: 'gun', shotgun: 'gun', instrument: 'note', whip: 'blade', knuckle: 'fist' };

  // ---------------- the card's gold pieces (SVG, sized in u by the CSS) ----------------
  const STAR = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z';
  const MOUNT = '<svg class="jc-mount" viewBox="0 0 66 48"><defs><linearGradient id="jcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b0"/>' +
    '<stop offset=".5" stop-color="#f2c14e"/><stop offset="1" stop-color="#c98a22"/></linearGradient></defs>' +
    '<path d="M3 24c5-6 12-8 19-5-4 1.5-6 3.5-7 6.5-3-1.6-7-2.2-12-1.5zM63 24c-5-6-12-8-19-5 4 1.5 6 3.5 7 6.5 3-1.6 7-2.2 12-1.5z" fill="url(#jcg)" stroke="#2a2440" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M33 2l17.5 22L33 46 15.5 24z" fill="url(#jcg)" stroke="#2a2440" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<path class="jc-gemf" d="M33 9.5l11.5 14.5L33 38.5 21.5 24z" stroke="#2a2440" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M33 11.5l6.8 9.2H33z" fill="#fff" opacity=".65"/><path d="M33 38.5L44.5 24H33z" fill="#000" opacity=".22"/></svg>';
  const CSTAR = `<svg class="jc-cstar" viewBox="0 0 24 24"><path d="${STAR}" fill="#ffd34d" stroke="#2a2440" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  // the arched name ribbon: tails folding behind, the plate curving up (viewBox in u: the card is 277u, the ribbon 281u)
  const RIBBON = '<svg class="jc-rsvg" viewBox="0 0 281 66" preserveAspectRatio="none">' +
    '<path class="jc-tail" d="M3 26l57-6v40L3 64l15-19z"/><path class="jc-tail" d="M278 26l-57-6v40l57 4-15-19z"/>' +
    '<path class="jc-fold" d="M54 56l6 6v-8zM227 56l-6 6v-8z"/>' +
    '<path class="jc-plate" d="M54 12Q140.5 -6 227 12v44q-86.5-17-173 0z"/>' +
    '<path class="jc-pline" d="M59 16q81.5-15.5 163 0v36q-81.5-15.5-163 0z"/></svg>';
  const CURL = '<svg class="jc-curl" viewBox="0 0 16 34"><path d="M13 2C3 6 1 13 6 18c3 3 2 9-3 14" fill="none" stroke="#2a2440" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M13 2C3 6 1 13 6 18c3 3 2 9-3 14" fill="none" stroke="#f0c050" stroke-width="2.6" stroke-linecap="round"/></svg>';

  const classOf = (id) => NC.CLASSES.find((c) => c.id === (NC.JOBS[id] || {}).cls);
  const later = (id) => Object.keys(NC.JOBS).filter((j) => NC.JOBS[j].from === id && !NC.JOBS[j].admin);
  // the weapon in the job's painting (its class outfit's), else the first type the job unlocks
  function weaponOf(id) {
    const JW = NC.JOB_WEAPONS || {}, J = NC.JOBS[id];
    const C = classOf(id), wid = C && C.items && C.items.weapon, W = wid && NC.ITEMS[wid];
    const types = [];
    if (W) types.push(NC.wtypeOf ? NC.wtypeOf(W) : W.wtype);
    for (const t of JW[id] || (J && J.tier === 3 ? JW[J.from] : null) || []) if (!types.includes(t)) types.push(t);
    const ok = types.filter((t) => NC.WTYPES && NC.WTYPES[t]);
    return { name: ok.length ? NC.WTYPES[ok[0]].name : '', icon: WICON[ok[0]] || 'sword' }; // (one, as the mockup: the weapon in the painting)
  }
  // one skill per line (the line's first), up to 4; a job without lines: its first 3
  function signature(id) {
    const J = NC.JOBS[id], own = (J.skills || []).filter((s) => SK[s] && !SHARED.includes(s));
    const out = [];
    if (J.lines && J.lines.length) for (const L of J.lines) { const s = own.find((x) => SK[x].line === L.id); if (s && out.length < 4) out.push(s); }
    for (const s of own) if (out.length < 3 && !out.includes(s)) out.push(s);
    return out.slice(0, 4);
  }
  // a name too long for its chip, ribbon or button gets a smaller font (--fit, a factor on the CSS size, so it holds at any
  // --u: desktop, the phone carousel). Measured on the text itself; the window may be scaled (skillwin.js fit()).
  function fitText(els) {
    els = [...els];
    for (const e of els) e.style.removeProperty('--fit');
    for (let pass = 0; pass < 3; pass++) for (const e of els) {
      const w = e.offsetWidth;
      if (!w) continue;
      const cs = getComputedStyle(e), room = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const rg = document.createRange();
      rg.selectNodeContents(e);
      const text = rg.getBoundingClientRect().width / (e.getBoundingClientRect().width / w);
      const over = cs.overflowX !== 'visible' ? e.scrollWidth > e.clientWidth : text > room + 1; // (a clipped box: exact; the ribbon: by the text)
      if (over) e.style.setProperty('--fit', Math.max(0.6, (parseFloat(e.style.getPropertyValue('--fit')) || 1) * Math.min(room / text, 0.99) * 0.98).toFixed(3));
    }
  }
  const FIT = '.jc-chip b, .jc-ribbon span, .job-go';
  const stars = (n) => { let h = ''; for (let i = 0; i < 5; i++) h += `<svg class="${i < n ? 'on' : ''}" viewBox="0 0 24 24"><path d="${STAR}"/></svg>`; return h; };

  // the hero on the rig over the job's colour, while its painting is missing
  function rigArt(box, id) {
    const cv = document.createElement('canvas');
    cv.width = 360; cv.height = 480; cv.className = 'jc-rig';
    box.appendChild(cv);
    const C = classOf(id), p = NC.game && NC.game.player;
    const eq = Object.assign({}, p ? p.equip : {}, C ? C.items : {});
    const draw = () => {
      if (!cv.isConnected) return;
      const c = cv.getContext('2d');
      c.clearRect(0, 0, 360, 480);
      c.fillStyle = 'rgba(10,8,20,0.35)'; c.beginPath(); c.ellipse(180, 420, 80, 18, 0, 0, Math.PI * 2); c.fill();
      if (!(NC.HeroSpine && NC.HeroSpine.preview(c, eq, 180, 420, 2.3, { t: 0.4, key: 'jc_' + id }))) NC.drawAvatar(c, eq, 180, 420, 2.3, 1, { t: 0.4 });
    };
    for (const t of [0, 400, 1200, 3000]) setTimeout(draw, t); // (outfit sprites stream in: draw again when they are there)
  }

  function card(id, ready) {
    const N = NC.JOBS[id], D = CARD[id] || ['#6a6078', '', 3, 3, 3, 'spark'], wp = weaponOf(id), next = later(id);
    const c = el('div', 'job jc-card' + (ready ? '' : ' locked'));
    c.style.setProperty('--jc', D[0]);
    c.dataset.job = id;
    const nameLen = [...N.name].length;
    const sk = signature(id);
    const faces = next.map((j) => `<figure title="${esc(NC.JOBS[j].name)}">${faceImg(j)}<figcaption>${esc(NC.JOBS[j].name)}</figcaption></figure>`).join('');
    c.innerHTML =
      `<div class="jc-art"><img alt="" src="${art(id)}"><div class="jc-desc">${esc(N.desc)}</div></div>` +
      MOUNT + CSTAR.replace('jc-cstar', 'jc-cstar l') + CSTAR.replace('jc-cstar', 'jc-cstar r') +
      CURL.replace('jc-curl', 'jc-curl l') + CURL.replace('jc-curl', 'jc-curl r') +
      `<div class="jc-ribbon${nameLen > 11 ? ' long' : nameLen > 7 ? ' mid' : ''}">${RIBBON}<span>${esc(N.name)}</span></div>` +
      `<div class="jc-chips"><span class="jc-chip">${icon(D[5])}<b>${esc(D[1])}</b></span>` +
        (wp.name ? `<span class="jc-chip">${icon(wp.icon)}<b>${esc(wp.name)}</b></span>` : '') + '</div>' +
      `<div class="jc-rates"><b>โจมตี</b><span>${stars(D[2])}</span><b>ป้องกัน</b><span>${stars(D[3])}</span><b>เล่นง่าย</b><span>${stars(D[4])}</span></div>` +
      `<div class="jc-sk n${sk.length}">${sk.map((s) => `<img src="${iconSrc(SK[s].icon)}" alt="" title="${esc(SK[s].name)}">`).join('')}</div>` +
      (next.length ? `<div class="jc-later"><b>ต่อไปเป็นได้:</b></div><div class="jc-faces n${next.length}">${faces}</div>`
        : `<div class="jc-text">${esc(N.desc)}</div>`);
    const img = c.querySelector('.jc-art img');
    img.addEventListener('error', () => { img.remove(); rigArt(c.querySelector('.jc-art'), id); }, { once: true });
    const b = el('button', 'big job-go');
    const label = 'เป็น' + N.name;
    b.textContent = ready ? label : 'ยังเปลี่ยนไม่ได้';
    b.disabled = !ready;
    b.addEventListener('click', () => {
      if (!b.dataset.armed) {
        b.dataset.armed = '1'; b.textContent = 'กดอีกครั้งเพื่อยืนยัน'; c.classList.add('on'); fitText([b]);
        setTimeout(() => { delete b.dataset.armed; b.textContent = label; c.classList.remove('on'); fitText([b]); }, 3000);
        return;
      }
      HUD.changeJob(id);
    });
    c.appendChild(b);
    // a tap on a touch screen: the card lifts and shows its text, a second tap puts it back (a mouse points instead;
    // a swipe through the carousel is no tap: no click)
    c.addEventListener('click', (e) => {
      if (matchMedia('(hover: hover)').matches || e.target.closest('.job-go')) return;
      for (const o of c.parentNode.querySelectorAll('.jc-card.on')) if (o !== c) o.classList.remove('on');
      c.classList.toggle('on');
    });
    return c;
  }

  // one card (a 2nd job -> its class 3): the line so far and what the change brings
  function info(id, p) {
    const N = NC.JOBS[id], from = NC.JOBS[N.from] || JOB(p), line = NC.jobLine(id).slice().reverse();
    const path = line.map((j, i) => (i ? '<b>›</b>' : '') + `<figure class="${j === id ? 'on' : ''}">${faceImg(j)}<figcaption>${esc(NC.JOBS[j].name)}</figcaption></figure>`).join('');
    const brings = N.tier === 3
      ? [`สกิลของ${from.name}ยังอยู่ครบทุกสกิล`, `ได้พาสซีฟที่ปลุกพลังสกิล${from.name}ให้แรงขึ้น`, 'ร่างตื่นอัตโนมัติระหว่างสู้ พร้อมชิ้นหลังเรืองแสง', 'ได้ชุดไฮคลาสของ' + N.name]
      : [`สกิลของ${from.name}ยังอยู่ครบ`, 'ได้สกิลสายใหม่ของ' + N.name, 'ได้ชุดประจำสาย'];
    const box = el('div', 'jc-info');
    box.innerHTML = `<h3>เส้นทางอาชีพ</h3><div class="jc-path">${path}</div>` +
      `<h3>เปลี่ยนแล้วได้อะไร</h3><ul>${brings.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
    return box;
  }

  HUD.renderJobs = function (list, p) {
    const ready = NC.canChangeJob(p), J = JOB(p), ids = NC.nextJobs(p);
    const hd = el('div', 'jobs-h jc-h');
    const what = J.tier === 2 ? 'เลื่อนเป็นคลาส 3 · สกิลเดิมยังอยู่ครบ ได้พาสซีฟปลุกพลังสกิล' + J.name + ' ร่างตื่น และชุดไฮคลาส'
      : J.tier === 1 ? 'เลือกสายอาชีพขั้น 2 · สกิลของ' + J.name + 'ยังอยู่ครบ ได้สกิลสายใหม่ และชุดประจำสาย'
      : 'Job Lv จะเริ่มใหม่ที่ 1 · แต้มสกิลติดตัวไปด้วย · ได้ชุดประจำอาชีพ';
    const need = J.tier === 2 ? `Job Lv ${NC.jobMax(p)} และ Base Lv ${NC.CLASS3_BASE_LV}` : `Job Lv ${NC.jobMax(p)}`;
    hd.textContent = ready ? 'เปลี่ยนอาชีพได้แล้ว! ' + what
      : `เปลี่ยนอาชีพได้ที่ ${need} (ตอนนี้ Job Lv ${p.jobLv}${J.tier === 2 ? ' · Base Lv ' + p.lv : ''}) · ดูอาชีพที่เลือกได้:`;
    list.appendChild(hd);
    const row = el('div', 'jobs jc-row n' + ids.length);
    for (const id of ids) row.appendChild(card(id, ready));
    if (ids.length === 1) row.appendChild(info(ids[0], p));
    list.appendChild(row);
    const fit = () => { if (row.isConnected) fitText(row.querySelectorAll(FIT)); };
    requestAnimationFrame(fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); // (Mitr may arrive after the first layout)
  };
})();
