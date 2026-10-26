/* p3_jbook.js — the journal's สมุดสะสม (tab 'book') and สมุดมอน (tab 'mon') redrawn from the mockups the user picked
   (UI audit round 3, 2026-10-17: assets/gen/nightcamp_p3_jbook_a_raw.png and nightcamp_p3_jmon_a_raw.png, both "A").
     สมุดสะสม  header + count, four number tiles, the weapon-type bonus on one line (click: all of it), the category chips
              on one row (the rest behind "อีก N หมวด", a pop-over), a grid of rarity-coloured slots with star pips and
              "?" tokens for what isn't found, and the picked item on a dark navy card (big icon, stars, what they give,
              where it drops -> its page in สมุดมอน, the ลงดาว button).
     สมุดมอน   header + the rule line, tabs ทั้งหมด / แผนที่นี้ / บอส / ธาตุ, the monsters as trading-card tiles (portrait on
              its element's colour, Lv range, 3 pips = 100 / 1,000 / 10,000 kills, kills, the drops: "?" until 100 kills
              and for what isn't found), the picked one on the right: big portrait, element, weak to, found in (+ walk
              me there), kills to the next step, the bonus against it, the drop list (rates from 1,000 kills; a row opens
              the item in สมุดสะสม). The boss tab lists the bosses that drop book items (their kills are counted here:
              localStorage nightcamp.bookboss.v1; boss tables have no kill steps).
   Every rule and number is book.js's (read through NC.Book: the book, allIds, found, starsOf, src); the star button
   goes through book.js's own click so its save runs. Wraps NC.Hub.tab('book' / 'mon') render + click. css/p3_jbook.css
   (jb- / jm- classes; the window takes the mockups' widths through :has()). */
(function () {
  'use strict';
  const NC = window.NC, H = NC.Hub, B = NC.Book, D = NC.LOOT_DATA, ITEMS = NC.ITEMS;
  if (!H || !H.tab || !B || !D) return;
  const TB = H.tab('book'), TM = H.tab('mon');
  if (!TB || !TM) return;
  const baseBookClick = TB.click;
  const esc = H.esc, fmt = (n) => Number(n || 0).toLocaleString('en-US');

  // ---------------- book.js's rules, read the same way ----------------
  const catOf = (it) => (it.slot === 'weapon' ? 'w:' + (NC.wtypeOf ? NC.wtypeOf(it) : 'weapon') : it.slot === 'hat' ? 'hat' : it.slot === 'acc' ? 'acc' : 'outfit');
  const CAT_TH = { hat: 'หมวก', acc: 'เครื่องประดับ', outfit: 'ชุด' };
  const catName = (c) => (c.startsWith('w:') ? ((NC.WTYPES || {})[c.slice(2)] || { name: c.slice(2) }).name : CAT_TH[c]);
  const found = (id) => B.found(id), starsOf = (id) => B.starsOf(id);
  const kills = (s) => B.book.kills[s] || 0;
  const tierOf = (k) => (k >= 10000 ? 3 : k >= 1000 ? 2 : k >= 100 ? 1 : 0);
  const STEP = [100, 1000, 10000], STEP_TH = ['เห็นของที่ดรอป', 'เห็นอัตราดรอป', 'แรงกับมัน +2%'];
  const typeCount = (all, t) => all.filter((id) => found(id) && catOf(ITEMS[id]) === 'w:' + t).length;
  const typePct = (n) => (n >= 40 ? 5 : n >= 30 ? 3 : n >= 20 ? 2 : n >= 10 ? 1 : 0);
  const rowsIn = (s, inAll) => (D.species[s] || []).filter(([id]) => inAll.has(id));
  const monDone = (s, inAll) => { const r = rowsIn(s, inAll); return r.length > 0 && r.every(([id]) => found(id)); };
  const monStars = (s, inAll) => rowsIn(s, inAll).every(([id]) => starsOf(id) >= 3);
  const vsNow = (s, inAll) => (monDone(s, inAll) ? (monStars(s, inAll) ? 6 : 3) : 0) + (kills(s) >= 10000 ? 2 : 0);
  // the copies not worn in any slot (book.js's spare)
  const spare = (p, id) => (NC.GEAR ? NC.GEAR.copies(p, id).filter((c) => { for (const k in p.equip) if (p.equip[k] === c.id && NC.GEAR.wornIn(p, k) === c) return false; return true; }) : []);
  const monName = (s) => (NC.MONSTERS[s] || {}).name || s;
  const srcName = (s) => (s === 'world' ? 'มอนทุกตัว Lv 90+ (หายากมาก)' : (NC.MONSTERS[s] || {}).name || (s.startsWith('sb_') || s.startsWith('wb_') ? 'บอสเนื้อเรื่อง (ยังไม่มา)' : s));
  const mapName = (m) => (NC.MAPS[m] || {}).name || m;
  const EI = () => NC.ELEMENT_INFO || {};
  const elName = (e) => (EI()[e || 'neutral'] || {}).th || e || 'ไม่มีธาตุ';
  const elColor = (e) => (EI()[e || 'neutral'] || {}).color || '#d8cfbf';
  // the element(s) that hit this one hardest (stats.js ELEMENT_TABLE: attack rows x defender columns)
  function weakTo(e) {
    const E = NC.ELEMENTS || [], T = NC.ELEMENT_TABLE, di = E.indexOf(e || 'neutral');
    if (!T || di < 0) return '—';
    let best = 100, who = [];
    E.forEach((a, ai) => { const v = T[ai][di]; if (v > best) { best = v; who = [a]; } else if (v === best && best > 100) who.push(a); });
    return who.length ? `${who.map(elName).join(' / ')} (${best}%)` : 'ไม่มี (ทุกธาตุเท่ากัน)';
  }

  // ---------------- bosses: their kills (book.js counts the species only) ----------------
  // Online NC.skillKills never runs: the server's count of the hero's own replaces this one through NC.JBook.bossKills
  // (online/extras.js, self.feats.bk).
  const BKEY = 'nightcamp.bookboss.v1';
  let bossKills = {};
  try { if (!NC.ONLINE) Object.assign(bossKills, JSON.parse(localStorage.getItem(BKEY) || '{}')); } catch (e) { /* storage blocked */ }
  NC.JBook = Object.assign(NC.JBook || {}, { bossKills: (counts) => { bossKills = Object.assign({}, counts || {}); } });
  if (NC.skillKills) NC.skillKills.push((game, e) => {
    if (!e.type || !D.bosses[e.type] || e._heroT == null || game.time - e._heroT >= 3) return;
    bossKills[e.type] = (bossKills[e.type] || 0) + 1;
    if (!(NC.game && NC.game.noSave)) try { localStorage.setItem(BKEY, JSON.stringify(bossKills)); } catch (er) { /* blocked */ }
  });

  // ---------------- where things live (monsters.js ROSTER x the maps' level ranges) ----------------
  function whereIndex() {
    const R = NC.ROSTER || {}, MP = NC.MAPS || {}, idx = {};
    for (const m in R) {
      const map = MP[m];
      if (!map || m === 'camp') continue;
      for (const z in R[m]) for (const slot in R[m][z]) for (const row of R[m][z][slot] || []) {
        const s = row[0], lv = (map.lv || {})[slot], w = idx[s] || (idx[s] = { maps: [], lv: {}, lo: Infinity, hi: -Infinity });
        if (!w.maps.includes(m)) w.maps.push(m);
        if (lv) {
          w.lo = Math.min(w.lo, lv[0]); w.hi = Math.max(w.hi, lv[1]);
          const o = w.lv[m]; w.lv[m] = o ? [Math.min(o[0], lv[0]), Math.max(o[1], lv[1])] : [lv[0], lv[1]];
        }
      }
    }
    for (const s in idx) idx[s].maps.sort((a, b) => ((idx[s].lv[a] || [999])[0] - (idx[s].lv[b] || [999])[0]));
    return idx;
  }
  const lvText = (lo, hi) => (lo === Infinity || lo == null ? '' : lo === hi ? `Lv ${lo}` : `Lv ${lo}–${hi}`);
  // the bosses whose tables hold book items
  function bossList(inAll) {
    const RB = (NC.RootBoss && NC.RootBoss.B) || {}, at = {};
    for (const m in NC.MAPS) for (const b of NC.MAPS[m].bosses || []) (at[b[0]] = at[b[0]] || []).push(m);
    const out = [];
    for (const b of Object.keys(D.bosses)) {
      if (!NC.MONSTERS[b] || !(D.bosses[b] || []).some(([id]) => inAll.has(id))) continue;
      const rb = RB[b];
      let lv = null, maps = [];
      if (rb) { lv = rb.lv; maps = Object.keys(rb.maps || {}).filter((m) => NC.MAPS[m]); }
      else if (at[b]) {
        maps = at[b];
        const t = (NC.MAPS[maps[0]] || {}).lvText || '', m1 = t.match(/บอส Lv (\d+)/), m2 = t.match(/Lv (\d+)\D+(\d+)/);
        lv = m1 ? +m1[1] : m2 ? +m2[2] : null;
      }
      out.push({ id: b, boss: true, lv, maps, story: b.startsWith('sb_') || b.startsWith('wb_'), equip: rb && rb.equip });
    }
    return out.sort((a, c) => (a.lv || 999) - (c.lv || 999));
  }

  // ---------------- pictures ----------------
  const picCache = {};
  // a drawn picture as a short blob: URL (a data: URL per tile made the 430-tile page's HTML megabytes long)
  function blobUrl(cv) {
    const d = cv.toDataURL('image/png'), bin = atob(d.slice(d.indexOf(',') + 1)), a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([a], { type: 'image/png' }));
  }
  // a monster's own sprite (a hue form's is a canvas: made into a picture once)
  function monSrc(s) {
    const S = NC.SPR[s];
    if (!S || !S.img) return '';
    if (S.img.tagName === 'IMG' || S.ready === false) return S.img.src || S.src || ''; // (ready false: its file, still streaming in, js/assets.js)
    if (picCache[s]) return picCache[s];
    try { return (picCache[s] = blobUrl(S.img)); } catch (e) { return S.src || ''; }
  }
  // a boss drawn as a person (the root-possessed: js/rootboss.js equip) or, without art, its first item
  function bossSrc(x) {
    if (NC.SPR[x.id]) return monSrc(x.id);
    if (picCache[x.id] !== undefined) return picCache[x.id];
    let src = '';
    if (x.equip && NC.Sprites && NC.Sprites.equipMissing && NC.Sprites.equipMissing(x.equip)) return ''; // (its gear's art still streaming in: drawn next time)
    if (x.equip && NC.drawHero && NC.Anim) {
      try {
        const eq = x.equip, W = ITEMS[eq.weapon] || {}, MV = NC.Anim.movesFor({ idle: 'idle', set: 'basic' }, W), SET = NC.Anim.setOf(MV);
        const c = NC.animCtx(eq, { al: 0, walk: 0, moving: false, idleStyle: MV.idle, ready: SET.ready });
        const P = NC.Anim.sample(MV.idle, 0.4, c); P.face = 1;
        const cv = document.createElement('canvas'); cv.width = 360; cv.height = 360;
        NC.drawHero(cv.getContext('2d'), eq, P, 180, 330, { scale: 1.6 });
        src = trim(cv);
      } catch (e) { src = ''; }
    }
    if (!src) { const it = (D.bosses[x.id] || []).map(([id]) => id).find((id) => ITEMS[id]); if (it) try { src = blobUrl(NC.itemIcon(it, 192)); } catch (e) { src = ''; } }
    return (picCache[x.id] = src);
  }
  function trim(cv) {
    const g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data;
    let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
    for (let y = 0; y < cv.height; y += 2) for (let x = 0; x < cv.width; x += 2) if (d[(y * cv.width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return '';
    const o = document.createElement('canvas'); o.width = x1 - x0 + 4; o.height = y1 - y0 + 4;
    o.getContext('2d').drawImage(cv, x0 - 2, y0 - 2, o.width, o.height, 0, 0, o.width, o.height);
    return blobUrl(o);
  }
  const portrait = (x) => (x.boss ? bossSrc(x) : monSrc(x.id));
  const SKULL = '<svg class="sk" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.3C4.3 1.3 1.8 3.8 1.8 7c0 1.9.9 3.3 2.1 4.1v2.2c0 .8.6 1.4 1.3 1.4h5.6c.7 0 1.3-.6 1.3-1.4v-2.2c1.2-.8 2.1-2.2 2.1-4.1 0-3.2-2.5-5.7-6.2-5.7z" fill="currentColor"/>' +
    '<circle cx="5.6" cy="7.3" r="1.7" fill="#fbf6ea"/><circle cx="10.4" cy="7.3" r="1.7" fill="#fbf6ea"/><rect x="6.5" y="11.7" width="1.1" height="2.2" fill="#fbf6ea"/><rect x="8.4" y="11.7" width="1.1" height="2.2" fill="#fbf6ea"/></svg>';
  const paintIcons = (root) => { for (const cv of root.querySelectorAll('canvas[data-icon]')) { const ic = NC.itemIcon(cv.dataset.icon, cv.width > 96 ? 192 : 96); cv.getContext('2d').drawImage(ic, 0, 0, cv.width, cv.height); } };
  const isPhone = () => document.documentElement.classList.contains('mob-port');

  // ======================= สมุดสะสม =======================
  const bs = { cat: null, pick: null, more: false, bonus: false, reveal: false };
  function bookCard(id, game, all, inAll) {
    if (!id || !ITEMS[id]) return '<div class="jb-card kw-card"><div class="jb-none">ยังไม่มีของในหมวดนี้</div></div>';
    const it = ITEMS[id], f = found(id), s = starsOf(id), n2 = B.book.items[id] || 0, R = (NC.RARITY || {})[it.rarity] || {};
    const p = game && game.player, sp = f && p ? spare(p, id).length : 0, src = B.src[id];
    const linkable = src && src !== 'world' && (D.species[src] || (D.bosses[src] && NC.MONSTERS[src]));
    const from = linkable ? `<button class="jb-link" data-jb-mon="${esc(src)}">${esc(srcName(src))} ›</button>` : esc(srcName(src || 'world'));
    let h = `<div class="jb-card kw-card kw-scroll"><div class="jb-big r-${esc(it.rarity)}">` +
      (f ? `<canvas width="192" height="192" data-icon="${esc(id)}"></canvas>` : '<i class="jb-qt">?</i>') + (B.book.sh[id] ? '<i class="sh" title="มีร่างประกายจันทร์">✦</i>' : '') + '</div>' +
      `<b class="jb-name">${f ? esc(it.name) : '???'}</b>` +
      `<div class="jb-meta">${esc(R.name || '')} · Lv ${it.lvReq || 1}${it.slot === 'weapon' ? ' · ' + esc(catName(catOf(it))) : ''}${B.book.sh[id] ? ' · <span class="moon">✦ มีร่างประกายจันทร์</span>' : ''}</div>`;
    if (!f) return h + `<div class="jb-line"><span class="dim">ดรอปจาก</span> ${from}</div><div class="jb-line dim">ยังไม่เคยได้ ออกไปล่าดูสิ</div></div>`;
    // the stars, and the ลงดาว button (book.js's: one spare copy in, the count goes up)
    h += `<div class="jb-stars">${'★'.repeat(s)}<i>${'★'.repeat(3 - s)}</i><span>${s} ดาว</span>` +
      (s < 3 ? `<button class="kw-btn gold jb-starbtn" data-star="${esc(id)}" ${sp ? '' : 'disabled'} title="ใช้ของสำรอง 1 ชิ้น (ชิ้นที่สวมอยู่ไม่นับ)">ลงดาว</button>` : '') + '</div>' +
      `<div class="jb-line dim">ลงแล้ว ${fmt(n2)} ชิ้น · ${s < 3 ? `ครบ ${s === 2 ? 10 : 3} ได้ดาวถัดไป` : 'ดาวเต็ม'}` +
      (s >= 3 ? '' : sp ? ` · สำรอง ${sp}` : ' · <span class="warn">ไม่มีชิ้นสำรอง (ที่สวมไม่นับ)</span>') + '</div>';
    // what the stars give: its monster's whole table at ★★★ = +6% against it (book.js: boss tables have no bonus)
    h += D.species[src] ? `<div class="jb-give">★★★ ทุกชิ้นของ${esc(monName(src))} แรงกับมัน +6% <span class="dim">(ตอนนี้ +${vsNow(src, inAll)}%)</span></div>`
      : '<div class="jb-give">ดาวของชิ้นนี้ไม่มีโบนัสแรง <span class="dim">(นับแค่ตารางมอนในทุ่ง)</span></div>';
    h += `<div class="jb-line"><span class="dim">ดรอปจาก</span> ${from}</div>`;
    return h + '</div>';
  }
  function renderBook(el, game) {
    const all = B.allIds(), inAll = new Set(all), total = all.length;
    const byCat = new Map();
    for (const id of all) { const c = catOf(ITEMS[id]); if (!byCat.has(c)) byCat.set(c, []); byCat.get(c).push(id); }
    const CATS = [...byCat.keys()];
    if (!bs.cat || !byCat.has(bs.cat)) bs.cat = CATS[0];
    const list = byCat.get(bs.cat) || [];
    if (!bs.pick || !list.includes(bs.pick)) bs.pick = list.find(found) || list[0] || null;
    const old = el.querySelector('.jb-grid'), keepTop = old && old.dataset.cat === bs.cat ? old.scrollTop : 0;
    const n = all.filter(found).length;
    const types = CATS.filter((c) => c.startsWith('w:')).map((c) => [c, typePct(typeCount(all, c.slice(2)))]).filter((x) => x[1]);
    const done = Object.keys(D.species).filter((s) => monDone(s, inAll)).length;
    const chip = (c) => { const ids = byCat.get(c); return `<button class="jb-chip${c === bs.cat ? ' on' : ''}" data-jb-cat="${esc(c)}">${esc(catName(c))}<small>${ids.filter(found).length}/${ids.length}</small></button>`; };
    const rule = 'ทุกชนิด: 10 ชิ้น ATK +1% · 20 ชิ้น +2% · 30 ชิ้น +3% · 40 ชิ้น +5% เมื่อถืออาวุธชนิดนั้น';
    let h = '<div class="jb-root">' +
      `<div class="jb-h"><b>สมุดสะสม</b><span>${fmt(n)} / ${fmt(total)} ชิ้น</span></div>` +
      '<div class="jb-tiles">' +
      `<div class="jb-tile"><b>${Math.round((n / Math.max(1, total)) * 100)}%</b><span>ครบแล้ว</span></div>` +
      `<div class="jb-tile"><b>+${Math.floor(n / 100)}</b><span>แต้มสเตตัส (100 ชิ้น +1)</span></div>` +
      `<div class="jb-tile"><b>${fmt(Object.keys(B.book.sh).length)}</b><span>ของประกายจันทร์ ✦</span></div>` +
      `<div class="jb-tile"><b>${fmt(done)}</b><span>มอนที่ครบตาราง (+3% แรงกับตัวนั้น)</span></div></div>` +
      `<button class="jb-bonus${bs.bonus ? ' open' : ''}" data-jb-bonus title="${esc(rule)}"><span><b>โบนัสชนิดอาวุธ:</b> ` +
      (types.length ? types.map(([c, b]) => `${esc(catName(c))} ATK +${b}%`).join(' · ') : 'ยังไม่มี · เก็บอาวุธชนิดเดียวกันครบ 10 ชิ้น ATK +1% เมื่อถือชนิดนั้น') +
      (bs.bonus ? `<em>${esc(rule)}</em>` : '') + `</span><i class="cv">${bs.bonus ? '▴' : '▾'}</i></button>` +
      `<div class="jb-chips">${CATS.map(chip).join('')}<button class="jb-chip more" data-jb-more hidden>อีก ▾</button></div>` +
      `<div class="jb-main"><div class="jb-grid kw-scroll" data-cat="${esc(bs.cat)}">`;
    for (const id of list) {
      const it = ITEMS[id], f = found(id), s = starsOf(id), sel = id === bs.pick ? ' sel' : '';
      h += f ? `<button class="jb-cell r-${esc(it.rarity)}${sel}" data-jb-id="${esc(id)}" title="${esc(it.name)}"><canvas width="96" height="96" data-icon="${esc(id)}"></canvas>` +
        `<i class="st">${'★'.repeat(s)}</i>${B.book.sh[id] ? '<i class="sh">✦</i>' : ''}</button>`
        : `<button class="jb-cell q${sel}" data-jb-id="${esc(id)}" aria-label="ยังไม่พบ"><i class="jb-qt">?</i></button>`;
    }
    h += '</div>' + bookCard(bs.pick, game, all, inAll);
    if (bs.more) h += `<div class="jb-pop"><div class="jb-poph"><b>ทุกหมวด</b><span>${CATS.length} หมวด</span><button class="kw-x jb-popx" data-jb-more aria-label="ปิด">✕</button></div>` +
      `<div class="jb-popchips kw-scroll">${CATS.map(chip).join('')}</div></div>`;
    el.innerHTML = h + '</div></div>';
    paintIcons(el);
    fitChips(el);
    const g = el.querySelector('.jb-grid');
    if (g) {
      g.scrollTop = keepTop;
      if (bs.reveal) { const c = g.querySelector('.jb-cell.sel'); if (c) g.scrollTop = Math.max(0, c.offsetTop - g.clientHeight / 2 + c.offsetHeight / 2); }
    }
    bs.reveal = false;
  }
  // the chips on one row: the rest go behind the last chip ("อีก N หมวด", or the picked one when it is among them)
  function fitChips(el) {
    const row = el.querySelector('.jb-chips');
    if (!row) return;
    const chips = [...row.querySelectorAll('.jb-chip:not(.more)')], more = row.querySelector('.jb-chip.more');
    if (!chips.length) return;
    const y0 = chips[0].offsetTop, off = (c) => c.offsetTop > y0 + 4;
    let hid = chips.filter(off);
    if (!hid.length) return;
    hid.forEach((c) => { c.hidden = true; });
    more.hidden = false;
    const label = () => {
      const sel = hid.find((c) => c.dataset.jbCat === bs.cat);
      more.classList.toggle('on', !!sel);
      more.innerHTML = sel ? `${sel.innerHTML} <i>▾</i>` : `อีก ${hid.length} หมวด <i>▾</i>`;
    };
    label();
    const vis = chips.filter((c) => !c.hidden);
    while (off(more) && vis.length > 1) { const c = vis.pop(); c.hidden = true; hid.unshift(c); label(); }
  }
  TB.render = renderBook;
  TB.click = function (e, game) {
    const st = e.target.closest('[data-star]');
    if (st) return st.disabled ? false : baseBookClick.call(this, e, game); // (book.js gives the copy up and saves)
    const c = e.target.closest('[data-jb-cat]'); if (c) { bs.cat = c.dataset.jbCat; bs.pick = null; bs.more = false; return true; }
    if (e.target.closest('[data-jb-more]')) { bs.more = !bs.more; return true; }
    if (e.target.closest('[data-jb-bonus]')) { bs.bonus = !bs.bonus; return true; }
    const m = e.target.closest('[data-jb-mon]');
    if (m) { openMon(m.dataset.jbMon); return false; }
    const b = e.target.closest('[data-jb-id]');
    if (b) {
      bs.pick = b.dataset.jbId;
      const page = e.currentTarget && e.currentTarget.id === 'hb-page' ? e.currentTarget : document.getElementById('hb-page');
      const old = page && page.querySelector('.jb-card');
      if (!old) return true;
      for (const x of page.querySelectorAll('.jb-cell.sel')) x.classList.remove('sel');
      b.classList.add('sel');
      const all = B.allIds(), t = document.createElement('div');
      t.innerHTML = bookCard(bs.pick, game, all, new Set(all));
      const card = t.firstElementChild;
      old.replaceWith(card); paintIcons(card);
      return false;
    }
    return false;
  };
  // (from สมุดมอน: an item's row opens it here)
  function openBook(id) {
    if (!ITEMS[id]) return;
    bs.cat = catOf(ITEMS[id]); bs.pick = id; bs.more = false; bs.reveal = true;
    H.open('book');
  }

  // ======================= สมุดมอน =======================
  const ms = { tab: 'all', el: null, pick: null, reveal: false };
  const TABS = [['all', 'ทั้งหมด'], ['here', 'แผนที่นี้'], ['boss', 'บอส'], ['el', 'ธาตุ']];
  let io = null;
  function entries(game, inAll, W) {
    const sp = Object.keys(D.species).sort((a, b) => (D.top[a] || 0) - (D.top[b] || 0)).map((s) => ({ id: s }));
    const bosses = bossList(inAll);
    const elOf = (x) => (NC.MONSTERS[x.id] || {}).element || 'neutral';
    if (ms.tab === 'boss') return bosses;
    if (ms.tab === 'here') { const m = game && game.mapId; return sp.filter((x) => W[x.id] && W[x.id].maps.includes(m)).concat(bosses.filter((x) => x.maps.includes(m))); }
    if (ms.tab === 'el') return sp.concat(bosses).filter((x) => elOf(x) === ms.el);
    return sp;
  }
  function monTile(x, inAll, W) {
    const s = x.id, M = NC.MONSTERS[s] || { name: s }, ec = elColor(M.element), sel = s === ms.pick ? ' sel' : '';
    const src = portrait(x), pic = src ? `<img alt="" src="${src}" loading="lazy" decoding="async"${x.boss && !NC.SPR[s] ? ' class="nf"' : ''}>` : '<i class="jb-qt">?</i>';
    let mid, rows, show;
    if (x.boss) {
      rows = D.bosses[s] || []; show = true;
      mid = `<small>${x.lv ? 'Lv ' + x.lv : x.story ? 'เนื้อเรื่อง' : ''}</small><div class="pips"><span class="jm-btag">บอส</span></div>` +
        `<div class="k">${SKULL}<span>${fmt(bossKills[s] || 0)}</span><em>ของ ${rows.filter(([id]) => found(id)).length}/${rows.length}</em></div>`;
    } else {
      const k = kills(s), t = tierOf(k), w = W[s];
      rows = D.species[s] || []; show = t >= 1;
      mid = `<small>${w ? lvText(w.lo, w.hi) : D.top[s] ? 'Lv ' + D.top[s] : ''}</small>` +
        `<div class="pips">${STEP.map((n, i) => `<i class="${t > i ? 'on' : ''}" title="${fmt(n)} ตัว: ${STEP_TH[i]}"></i>`).join('')}</div>` +
        `<div class="k">${SKULL}<span>${fmt(k)}</span><em>ของ ${rows.filter(([id]) => found(id)).length}/${rows.length}</em></div>`;
    }
    const cap = rows.length > 4 ? 3 : 4;
    const drops = rows.slice(0, cap).map(([id]) => (show && ITEMS[id] && found(id) ? `<canvas width="64" height="64" data-lz="${esc(id)}"></canvas>` : '<i class="jm-q">?</i>'));
    if (rows.length > cap) drops.push(`<i class="more">+${rows.length - cap}</i>`);
    return `<button class="jm-tile${sel}" data-jm="${esc(s)}" style="--ec:${ec}"><div class="pt">${pic}</div>` +
      `<div class="tx"><b>${esc(M.name)}${!x.boss && monDone(s, inAll) ? ' <i class="ok">✔</i>' : ''}</b>${mid}</div>` +
      `<div class="drops">${drops.join('') || '<span class="none">ไม่มีของดรอป</span>'}</div></button>`;
  }
  function travelPick(game, maps, lv) {
    if (!game || !game.player || !NC.Travel || !NC.Travel.go || !NC.MapRoute) return null;
    if (maps.includes(game.mapId)) return { here: true };
    const plv = game.player.lv || 1;
    let best = null, bd = Infinity;
    for (const m of maps) {
      const r = lv[m], d = r ? (plv < r[0] ? r[0] - plv : plv > r[1] ? plv - r[1] : 0) : 60;
      if (d >= bd) continue;
      let ok = false;
      try { const p = NC.MapRoute.pathTo(game.mapId, m); ok = !!(p && p.length); } catch (e) { ok = false; }
      if (ok) { bd = d; best = m; }
    }
    return best ? { map: best } : null;
  }
  function monCard(x, game, inAll, W) {
    if (!x) return '<div class="jm-card kw-card"><div class="jb-none">ยังไม่มีมอนในหน้านี้</div></div>';
    const s = x.id, M = NC.MONSTERS[s] || { name: s }, ec = elColor(M.element), src = portrait(x);
    const w = x.boss ? null : W[s], maps = x.boss ? x.maps : w ? w.maps : [], lvm = x.boss ? {} : w ? w.lv : {};
    const k = x.boss ? bossKills[s] || 0 : kills(s), t = x.boss ? 3 : tierOf(k);
    const rows = (x.boss ? D.bosses[s] : D.species[s]) || [], fN = rows.filter(([id]) => found(id)).length;
    const lv = x.boss ? (x.lv ? 'Lv ' + x.lv : '') : w ? lvText(w.lo, w.hi) : D.top[s] ? 'Lv ' + D.top[s] : '';
    let h = `<div class="jm-card kw-card kw-scroll" style="--ec:${ec}"><div class="jm-port">${src ? `<img alt="" src="${src}"${x.boss && !NC.SPR[s] ? ' class="nf"' : ''}>` : '<i class="jb-qt">?</i>'}</div>` +
      `<div class="jm-name">${esc(M.name)}</div><div class="jm-tags">${lv ? `<span class="jm-lv">${lv}</span>` : ''}` +
      (x.boss ? '<span class="jm-tg">บอส</span>' : '') + (M.eliteOf ? '<span class="jm-tg">ร่างหายาก</span>' : '') +
      (!x.boss && monDone(s, inAll) ? '<span class="jm-tg ok">✔ ครบตาราง</span>' : '') + '</div><hr>' +
      `<div class="jm-kv"><span>ธาตุ</span><b><i class="dot"></i>${esc(elName(M.element))}</b></div>` +
      `<div class="jm-kv"><span>แพ้ธาตุ</span><b>${esc(weakTo(M.element))}</b></div>`;
    const names = maps.map(mapName).filter((v, i, a) => a.indexOf(v) === i);
    const go = maps.length ? travelPick(game, maps, lvm) : null;
    h += `<div class="jm-kv"><span>พบที่</span><b>${names.length ? esc(names.slice(0, 3).join(', ')) + (names.length > 3 ? ` และอีก ${names.length - 3} แห่ง` : '') : x.story ? 'บอสเนื้อเรื่อง' : 'ยังไม่พบในแผนที่'}` +
      (go && go.here ? ' <i class="jm-here">อยู่ในแผนที่นี้</i>' : go ? ` <button class="jm-go" data-jm-go="${esc(go.map)}" title="เดินไป${esc(mapName(go.map))}">พาไป${esc(mapName(go.map))} ›</button>` : '') + '</b></div>';
    if (!x.boss) {
      const prev = t ? STEP[t - 1] : 0, next = STEP[t];
      h += `<div class="jm-kv kl"><span>ฆ่าแล้ว</span><b>${fmt(k)} ตัว</b>${t < 3 ? `<small>อีก ${fmt(next - k)} ตัว ${STEP_TH[t]}</small>` : '<small class="ok">ครบทุกขั้นแล้ว</small>'}</div>` +
        (t < 3 ? `<div class="jm-bar"><i style="width:${Math.min(100, ((k - prev) / (next - prev)) * 100)}%"></i></div>` : '');
      h += `<div class="jm-kv" title="ครบตารางในสมุดสะสม +3% · ★★★ ทุกชิ้น +6% · ฆ่าครบ 10,000 ตัว +2%"><span>โบนัส</span><b>แรงกับมันตอนนี้ +${vsNow(s, inAll)}%</b></div>`;
    } else h += `<div class="jm-kv"><span>ล้มแล้ว</span><b>${fmt(k)} ครั้ง</b></div>`;
    h += `<hr><div class="jm-dh">ของที่ดรอป <small>${fN} / ${rows.length} ชิ้น</small></div>`;
    if (!rows.length) h += '<div class="jm-sm">ตัวนี้ไม่มีของลงสมุด</div>';
    else if (t < 1) {
      h += `<div class="jm-lock">ฆ่าอีก ${fmt(100 - k)} ตัว จะเห็นของที่${esc(M.name)}ดรอป</div>` +
        rows.map(() => '<div class="jm-drop off"><i class="jm-q">?</i><span>???</span><em></em></div>').join('');
    } else {
      h += rows.map(([id, pct]) => {
        const f = found(id) && ITEMS[id], rate = !x.boss && t >= 2 ? `${pct}%` : '';
        return ITEMS[id] ? `<button class="jm-drop" data-jm-item="${esc(id)}" title="เปิดในสมุดสะสม">${f ? `<canvas width="80" height="80" data-icon="${esc(id)}"></canvas>` : '<i class="jm-q">?</i>'}` +
          `<span>${f ? esc(ITEMS[id].name) : '???'}${f ? ' <i class="ok">✔</i>' : ''}</span><em>${rate}</em></button>`
          : `<div class="jm-drop off"><i class="jm-q">?</i><span>???</span><em>${rate}</em></div>`;
      }).join('');
      if (!x.boss && t < 2) h += '<div class="jm-sm">ฆ่าครบ 1,000 ตัว จะเห็นอัตราดรอป</div>';
      if (x.boss) h += '<div class="jm-sm">บอสไม่บอกอัตราดรอป</div>';
    }
    return h + '</div>';
  }
  function renderMon(el, game) {
    const all = B.allIds(), inAll = new Set(all), W = whereIndex();
    const SPECIES = Object.keys(D.species), killed = SPECIES.filter((s) => kills(s)).length;
    if (ms.tab === 'el' && !ms.el) ms.el = (NC.MONSTERS[ms.pick] || {}).element || 'neutral';
    const list = entries(game, inAll, W);
    if (!list.some((x) => x.id === ms.pick)) ms.pick = list[0] ? list[0].id : null;
    const pickX = list.find((x) => x.id === ms.pick) || null;
    const old = el.querySelector('.jm-list'), keepTop = old && old.dataset.k === ms.tab + (ms.el || '') ? old.scrollTop : 0;
    let h = '<div class="jm-root"><div class="jm-head">' +
      `<div class="jm-h"><b>สมุดมอน</b><span>ฆ่าแล้ว ${fmt(killed)} / ${fmt(SPECIES.length)} ชนิด</span></div>` +
      '<div class="jm-rule">ฆ่า 100 ตัว เห็นของดรอป · 1,000 เห็นอัตรา · 10,000 แรงกับมัน +2% · ครบตาราง +3%</div>' +
      `<div class="kw-tabs jm-tabs">${TABS.map(([id, n]) => `<button class="kw-tab${ms.tab === id ? ' on' : ''}" data-jm-tab="${id}">${n}</button>`).join('')}</div>`;
    if (ms.tab === 'el') {
      const bosses = bossList(inAll), cnt = {};
      for (const s of SPECIES) { const e = (NC.MONSTERS[s] || {}).element || 'neutral'; cnt[e] = (cnt[e] || 0) + 1; }
      for (const b of bosses) { const e = (NC.MONSTERS[b.id] || {}).element || 'neutral'; cnt[e] = (cnt[e] || 0) + 1; }
      h += `<div class="jm-els">${(NC.ELEMENTS || []).filter((e) => cnt[e]).map((e) => `<button class="jm-el${ms.el === e ? ' on' : ''}" data-jm-el="${e}" style="--ec:${elColor(e)}"><i></i>${esc(elName(e))}<small>${cnt[e]}</small></button>`).join('')}</div>`;
    }
    h += `</div><div class="jm-list kw-scroll" data-k="${esc(ms.tab + (ms.el || ''))}">`;
    if (!list.length) h += `<div class="jm-empty">${ms.tab === 'here' ? `${esc(mapName(game && game.mapId))} ไม่มีมอนลงสมุด` : 'ไม่มีมอนในหน้านี้'}<button class="kw-btn blue" data-jm-tab="all">ดูมอนทั้งหมด</button></div>`;
    else h += list.map((x) => monTile(x, inAll, W)).join('');
    el.innerHTML = h + '</div>' + monCard(pickX, game, inAll, W) + '</div>';
    paintIcons(el.querySelector('.jm-card') || el);
    lazy(el);
    const L = el.querySelector('.jm-list');
    if (L) {
      L.scrollTop = keepTop;
      if (ms.reveal) { const c = L.querySelector('.jm-tile.sel'); if (c) L.scrollTop = Math.max(0, c.offsetTop - L.clientHeight / 2 + c.offsetHeight / 2); }
    }
    if (ms.reveal && isPhone()) { const c = el.querySelector('.jm-card'); if (c) c.scrollIntoView({ block: 'start' }); }
    ms.reveal = false;
  }
  // the tiles' drop icons are drawn when they scroll into sight (430 tiles)
  function lazy(el) {
    if (io) io.disconnect();
    const fill = (t) => { for (const cv of t.querySelectorAll('canvas[data-lz]')) { cv.getContext('2d').drawImage(NC.itemIcon(cv.dataset.lz, 96), 0, 0, cv.width, cv.height); cv.removeAttribute('data-lz'); } };
    if (!('IntersectionObserver' in window)) { el.querySelectorAll('.jm-tile').forEach(fill); return; }
    io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); fill(e.target); } }, { rootMargin: '300px 0px' });
    for (const t of el.querySelectorAll('.jm-tile')) io.observe(t);
  }
  function openMon(id) {
    if (D.species[id]) { ms.tab = 'all'; ms.pick = id; } else if (D.bosses[id]) { ms.tab = 'boss'; ms.pick = id; } else return;
    ms.reveal = true;
    H.open('mon');
  }
  TM.render = renderMon;
  TM.click = function (e, game) {
    const tb = e.target.closest('[data-jm-tab]'); if (tb) { ms.tab = tb.dataset.jmTab; if (ms.tab === 'el' && !ms.el) ms.el = (NC.MONSTERS[ms.pick] || {}).element || 'neutral'; return true; }
    const el = e.target.closest('[data-jm-el]'); if (el) { ms.el = el.dataset.jmEl; return true; }
    const go = e.target.closest('[data-jm-go]');
    if (go) {
      const g = game || NC.game, m = go.dataset.jmGo;
      if (!g || !NC.Travel) return false;
      NC.HUD.panel('journal', false); g.paused = false;
      NC.Travel.go(g, { map: m, x: 0, y: 0, r: 1e9, name: mapName(m), done: () => {} });
      if (g.toast) g.toast(`กำลังเดินไป${mapName(m)} · เดินเองเพื่อหยุด`);
      return false;
    }
    const it = e.target.closest('[data-jm-item]'); if (it) { openBook(it.dataset.jmItem); return false; }
    const t = e.target.closest('[data-jm]');
    if (t) {
      ms.pick = t.dataset.jm;
      const page = document.getElementById('hb-page'), old = page && page.querySelector('.jm-card');
      if (!old) return true;
      for (const x of page.querySelectorAll('.jm-tile.sel')) x.classList.remove('sel');
      t.classList.add('sel');
      const all = B.allIds(), inAll = new Set(all), W = whereIndex(), x = entries(game, inAll, W).find((v) => v.id === ms.pick) || { id: ms.pick };
      const tmp = document.createElement('div');
      tmp.innerHTML = monCard(x, game, inAll, W);
      const card = tmp.firstElementChild;
      old.replaceWith(card); paintIcons(card);
      if (isPhone()) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return false;
    }
    return false;
  };
  NC.P3JBook = { bs, ms, bossKills, openBook, openMon };
})();
