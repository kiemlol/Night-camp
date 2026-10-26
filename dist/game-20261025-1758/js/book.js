/* book.js — สมุดสะสม and สมุดมอน (the Loot Book: "ของทุกชิ้นลงสมุดสะสม"), two pages of the journal (J, js/hub.js).
     สมุดสะสม  every droppable item (js/loot_data.js) as a card: found ones show their picture and stars, the rest a plain
              "?" (the user: never a dark silhouette, "ให้เขาไปลุ้นเอง"). An item is written in the first time it comes
              into the bag. Stars: give up spare copies — 3 in all = ★★, 10 = ★★★. A moonlit ✦ copy is its own line.
     rewards  every 100 items in the book: +1 status point · 10 / 20 / 30 / 40 of one weapon type: ATK +1 / 2 / 3 / 5%
              with that type · a monster's whole table found: +3% damage to it (+6% when all ★★★)
     สมุดมอน   each species: how many we have killed; 100 kills show what it drops ("?" for what we haven't found) and where
              it lives, 1,000 show the rates, 10,000 give +2% damage to it and a title
   The book is the account's (every hero in this browser shares it): nightcamp.book.v1.
   Hooks: NC.gearAdded (a copy came in), NC.skillKills (kills), NC.statusLeft, NC.skillModSources, NC.heroHit,
   NC.invCardExtras (the bag card shows the book line). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, H = NC.Hub, D = NC.LOOT_DATA;
  if (!H || !D) return;
  const esc = H.esc, KEY = 'nightcamp.book.v1';
  const book = { items: {}, sh: {}, kills: {} };
  try { if (!NC.ONLINE) Object.assign(book, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage blocked */ }
  book.items = book.items || {}; book.sh = book.sh || {}; book.kills = book.kills || {};
  let dirty = false;
  const save = () => { dirty = false; if (NC.game && NC.game.noSave) return; try { localStorage.setItem(KEY, JSON.stringify(book)); } catch (e) { /* blocked */ } };
  setInterval(() => { if (dirty) save(); }, 5000);
  addEventListener('beforeunload', () => { if (dirty) save(); });

  // ---------------- what belongs in the book ----------------
  const SPECIES = [];
  const src = {}; // item -> where it drops
  // (filled again when a later file adds rows: the root-possessed bosses' pieces, the new areas' species - js/arealoot.js)
  function fill() {
    for (const s of Object.keys(D.species)) { if (!SPECIES.includes(s)) SPECIES.push(s); for (const [id] of D.species[s]) src[id] = src[id] || s; }
    for (const b in D.bosses) for (const [id] of D.bosses[b]) src[id] = src[id] || b;
    for (const id of D.world) src[id] = src[id] || 'world';
  }
  fill();
  // (the pictures load after this file: the list is made the first time it is needed with them in)
  let ALLc = null;
  const allIds = () => (ALLc && ALLc.length ? ALLc : (fill(), ALLc = Object.keys(src).filter((id) => ITEMS[id] && NC.itemReady(id))));
  // (a list made while the pictures were still loading - the HUD asks at start - held only 37 items: made again once loaded)
  const baseLoad = NC.loadAssets;
  if (baseLoad) NC.loadAssets = function () { return Promise.resolve(baseLoad.apply(this, arguments)).then((r) => { ALLc = null; return r; }); };
  const catOf = (it) => (it.slot === 'weapon' ? 'w:' + (NC.wtypeOf ? NC.wtypeOf(it) : 'weapon') : it.slot === 'hat' ? 'hat' : it.slot === 'acc' ? 'acc' : 'outfit');
  const CAT_TH = { hat: 'หมวก', acc: 'เครื่องประดับ', outfit: 'ชุด' };
  const catName = (c) => (c.startsWith('w:') ? ((NC.WTYPES || {})[c.slice(2)] || { name: c.slice(2) }).name : CAT_TH[c]);
  const cats = () => [...new Set(allIds().map((id) => catOf(ITEMS[id])))];
  const starsOf = (id) => { const n = book.items[id] || 0; return n >= 10 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0; };
  const found = (id) => (book.items[id] || 0) > 0;
  const count = () => allIds().filter(found).length;

  // online the server's book (self.book, js/online/extras.js) replaces these with every new record of the hero: an item it
  // does not book (the shields: not gear copies) came back as new every 2 s - "ลงสมุดสะสม: โล่ไม้กลม" over and over (Discord
  // #131). Online an item is written (and said) once a session; the server's book stays the one that counts.
  const said = new Set();
  function write(id, sh) {
    if (!src[id]) return;
    if (NC.Online && NC.Online.enabled) { const k = id + (sh ? '+' : ''); if (said.has(k)) return; said.add(k); }
    let news = false;
    if (!book.items[id]) { book.items[id] = 1; news = true; }
    if (sh && !book.sh[id]) { book.sh[id] = 1; news = true; }
    if (news) {
      dirty = true;
      const n = count();
      NC.HUD.log(`ลงสมุดสะสม: ${sh ? '✦ ' : ''}${ITEMS[id].name} (${n}/${allIds().length})`, 'item');
      if (n % 100 === 0) NC.HUD.log(`สมุดสะสมครบ ${n} ชิ้น! แต้มสเตตัส +1`, 'level');
      if (NC.game) NC.applyGear(NC.game);
    }
  }
  if (NC.gearAdded) NC.gearAdded.push((game, c) => write(c.id, c.sh));
  // (items that are not copies: into the collection straight away)
  setInterval(() => { const g = NC.game; if (g && g.player && g.player.owned) for (const id of g.player.owned) if (src[id] && !book.items[id]) write(id); }, 2000);
  NC.skillKills.push((game, e) => { if (e.type && D.species[e.type] && e._heroT != null && game.time - e._heroT < 3) { book.kills[e.type] = (book.kills[e.type] || 0) + 1; dirty = true; } });

  // ---------------- the rewards ----------------
  const baseLeft = NC.statusLeft;
  NC.statusLeft = (p) => baseLeft(p) + Math.floor(count() / 100);
  const typeBonus = (t) => { const n = allIds().filter((id) => found(id) && catOf(ITEMS[id]) === 'w:' + t).length; return n >= 40 ? 5 : n >= 30 ? 3 : n >= 20 ? 2 : n >= 10 ? 1 : 0; };
  NC.skillModSources.push((p) => {
    if (!p || p.kind !== 'player' || !p.equip.weapon || !NC.wtypeOf) return null;
    const b = typeBonus(NC.wtypeOf(ITEMS[p.equip.weapon] || {}));
    return b ? { atk: b } : null;
  });
  const monDone = (s) => { const rows = (D.species[s] || []).filter(([id]) => allIds().includes(id)); return rows.length > 0 && rows.every(([id]) => found(id)); };
  const monStars = (s) => (D.species[s] || []).filter(([id]) => allIds().includes(id)).every(([id]) => starsOf(id) >= 3);
  const vsCache = {};
  setInterval(() => { for (const s of SPECIES) vsCache[s] = (monDone(s) ? (monStars(s) ? 6 : 3) : 0) + ((book.kills[s] || 0) >= 10000 ? 2 : 0); }, 3000);
  const baseHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHit(d, e, o), g = NC.game;
    if (g && g.player && d === g.player.d && e && r.dmg > 0 && vsCache[e.type]) r.dmg = Math.max(1, Math.round(r.dmg * (1 + vsCache[e.type] / 100)));
    return r;
  };

  // ---------------- giving copies up for stars ----------------
  // the copies not worn in any slot
  const spare = (p, id) => (NC.GEAR ? NC.GEAR.copies(p, id).filter((c) => { for (const k in p.equip) if (p.equip[k] === c.id && NC.GEAR.wornIn(p, k) === c) return false; return true; }) : []);
  function star(game, id) {
    const p = game.player, c = spare(p, id).sort((a, b) => (a.ref || 0) - (b.ref || 0) || a.rows.length - b.rows.length)[0];
    if (!c) return;
    NC.GEAR.remove(game, c);
    book.items[id] = (book.items[id] || 0) + 1; dirty = true;
    NC.HUD.log(`ลงดาว ${ITEMS[id].name}: ${book.items[id]} ชิ้น ${'★'.repeat(starsOf(id))}`, 'item');
    save();
  }
  NC.Book = { book, write, count, allIds, src, starsOf, found, fill };

  // ---------------- the bag card: the book line ----------------
  if (NC.invCardExtras) NC.invCardExtras.push((p, id) => {
    if (!src[id]) return '';
    const n = book.items[id] || 0, s = starsOf(id), next = s >= 3 ? 0 : s === 2 ? 10 : 3;
    return `<div class="gb-abil" style="color:#bcd6ff">สมุดสะสม ${'★'.repeat(s) || '—'} · ลงแล้ว ${n} ชิ้น${next ? ` · ครบ ${next} ได้ดาวถัดไป (หน้า J)` : ''}</div>`;
  });

  // ---------------- page: สมุดสะสม ----------------
  let cat = null, pick = null, monPick = null;
  const srcName = (s) => (s === 'world' ? 'มอนทุกตัว Lv 90+ (หายากมาก)' : (NC.MONSTERS[s] || {}).name || (s.startsWith('sb_') || s.startsWith('wb_') ? 'บอสเนื้อเรื่อง (ยังไม่มา)' : s));
  function renderBook(el, game) {
    const CATS = cats();
    if (!cat || !CATS.includes(cat)) cat = CATS[0];
    const p = game.player, n = count(), list = allIds().filter((id) => catOf(ITEMS[id]) === cat);
    const byType = CATS.filter((c) => c.startsWith('w:')).map((c) => [c, typeBonus(c.slice(2))]).filter((x) => x[1]);
    let h = `<div class="bb-h">สมุดสะสม <small>${n} / ${allIds().length} ชิ้น</small></div>` +
      `<div class="bb-tiles"><div class="bb-tile"><b>${Math.round((n / Math.max(1, allIds().length)) * 100)}%</b><span>ครบแล้ว</span></div>` +
      `<div class="bb-tile"><b>+${Math.floor(n / 100)}</b><span>แต้มสเตตัสจากสมุด (ทุก 100 ชิ้น)</span></div>` +
      `<div class="bb-tile"><b>${Object.keys(book.sh).length}</b><span>ประกายจันทร์ ✦</span></div>` +
      `<div class="bb-tile"><b>${SPECIES.filter(monDone).length}</b><span>มอนที่ครบตาราง (+3% แรงกับตัวนั้น)</span></div></div>` +
      (byType.length ? `<div class="bb-sub">โบนัสชนิดอาวุธ: ${byType.map(([c, b]) => `${esc(catName(c))} ATK +${b}%`).join(' · ')}</div>` : '') +
      `<div class="bb-chips">${CATS.map((c) => { const all = allIds().filter((id) => catOf(ITEMS[id]) === c); return `<button class="bb-chip ${c === cat ? 'on' : ''}" data-cat="${c}">${esc(catName(c))}<small>${all.filter(found).length}/${all.length}</small></button>`; }).join('')}</div>` +
      '<div class="bb-grid">';
    for (const id of list) {
      const it = ITEMS[id], f = found(id), s = starsOf(id);
      h += f ? `<button class="bb-cell r-${it.rarity} ${pick === id ? 'sel' : ''}" data-id="${id}"><canvas width="96" height="96" data-icon="${id}"></canvas>` +
        `<i class="st">${'★'.repeat(s)}</i>${book.sh[id] ? '<i class="sh">✦</i>' : ''}</button>`
        : `<button class="bb-cell q r-${it.rarity} ${pick === id ? 'sel' : ''}" data-id="${id}">?</button>`;
    }
    h += '</div>';
    if (pick && ITEMS[pick]) {
      const it = ITEMS[pick], f = found(pick), n2 = book.items[pick] || 0, sp = spare(p, pick).length, s = starsOf(pick);
      h += `<div class="bb-detail"><b>${f ? esc(it.name) : '???'}</b> · ${esc((NC.RARITY[it.rarity] || {}).name || '')} · Lv ${it.lvReq || 1}<br>` +
        `<span class="dim">ดรอปจาก:</span> ${esc(srcName(src[pick]))}` +
        (f ? `<br>ลงแล้ว ${n2} ชิ้น · ${'★'.repeat(s)}${s < 3 ? ` · ต้องครบ ${s === 2 ? 10 : 3} ชิ้นสำหรับดาวถัดไป` : ' (เต็ม)'}${book.sh[pick] ? ' · ✦ มีร่างประกายจันทร์' : ''}` +
          (s < 3 ? `<br><button class="kw-btn gold" data-star="${pick}" ${sp ? '' : 'disabled'}>ลงดาว (ใช้ของ 1 ชิ้น · มีสำรอง ${sp})</button>` : '') : '<br><span class="dim">ยังไม่เคยได้ ออกไปล่าดูสิ</span>') + '</div>';
    }
    el.innerHTML = h;
    for (const cv of el.querySelectorAll('canvas[data-icon]')) cv.getContext('2d').drawImage(NC.itemIcon(cv.dataset.icon, 96), 0, 0);
  }
  H.add({ id: 'book', name: 'สมุดสะสม', icon: 'ic_collection', order: 20, render: renderBook,
    click(e, game) {
      const c = e.target.closest('[data-cat]'); if (c) { cat = c.dataset.cat; pick = null; return true; }
      const s = e.target.closest('[data-star]'); if (s && !s.disabled) { star(game, s.dataset.star); return true; }
      const b = e.target.closest('[data-id]'); if (b) { pick = b.dataset.id; return true; }
      return false;
    } });

  // ---------------- page: สมุดมอน ----------------
  const MAPTH = {};
  for (const m in NC.MAPS || {}) MAPTH[m] = NC.MAPS[m].name;
  function renderMon(el, game) {
    const rows = SPECIES.map((s) => [s, book.kills[s] || 0]).sort((a, b) => (D.top[a[0]] || 0) - (D.top[b[0]] || 0));
    let h = `<div class="bb-h">สมุดมอน <small>ฆ่าแล้ว ${rows.filter((r) => r[1]).length} / ${SPECIES.length} ชนิด</small></div>` +
      '<div class="bb-sub">ฆ่าครบ 100 ตัว เห็นของที่มอนตัวนั้นดรอป · 1,000 ตัว เห็นอัตรา · 10,000 ตัว แรงกับมันเพิ่ม 2% · ครบตารางในสมุดสะสม แรงเพิ่ม 3%</div><div class="bb-list">';
    for (const [s, k] of rows) {
      const M = NC.MONSTERS[s] || { name: s }, lvl = k >= 10000 ? 3 : k >= 1000 ? 2 : k >= 100 ? 1 : 0, next = [100, 1000, 10000][lvl] || 10000;
      const img = (NC.SPR[s] && NC.SPR[s].src) || ((NC.ASSET_MANIFEST_MONSTERS || {})[s] || {}).src || '';
      h += `<div class="bb-row ${monPick === s ? 'on' : ''}" data-mon="${s}" style="cursor:pointer">${img ? `<img src="${img}" alt="" style="transform:scaleX(-1)">` : ''}` +
        `<div class="t"><b>${esc(M.name)} ${monDone(s) ? '✔' : ''}</b><small>${(D.species[s] || []).filter(([id]) => found(id)).length} / ${(D.species[s] || []).length} ชิ้น · ${'◆'.repeat(lvl)}${'◇'.repeat(3 - lvl)}</small>` +
        `<div class="bb-bar"><i style="width:${Math.min(100, (k / next) * 100)}%"></i></div></div><span class="n">${k.toLocaleString()}</span></div>`;
      if (monPick === s) {
        if (k < 100) h += `<div class="bb-detail">ฆ่าอีก ${(100 - k).toLocaleString()} ตัว จะเห็นของที่${esc(M.name)}ดรอป</div>`;
        else h += `<div class="bb-detail"><b>${esc(M.name)}</b> ดรอป:<br>` + (D.species[s] || []).map(([id, pct]) => {
          const f = found(id);
          return `${f ? esc(ITEMS[id].name) : '<span class="dim">???</span>'}${lvl >= 2 ? ` <span class="dim">${pct}%</span>` : ''}${f ? ' <span class="ok">✔</span>' : ''}`;
        }).join(' · ') + '</div>';
      }
    }
    el.innerHTML = h + '</div>';
  }
  H.add({ id: 'mon', name: 'สมุดมอน', icon: 'ic_monbook', order: 25, render: renderMon,
    click(e) { const r = e.target.closest('[data-mon]'); if (r) { monPick = monPick === r.dataset.mon ? null : r.dataset.mon; return true; } return false; } });
})();
