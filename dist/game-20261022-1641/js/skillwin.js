/* skillwin.js — the skill window (K) in the K look (css/kui.css + css/skillwin.css). Page 3 of the page-by-page redesign
   (2026-09-29): layout "B" of assets/gen/nightcamp_pg_skills_b_raw.png (the user: "ลุยเลยทำเลย"; B because most jobs
   have 4-5 lines of 1-5 skills, too many for one column per line):
     top      the job, Job Lv and the skill points left · folder tabs: one per job in the hero's line (a 2nd job shows its
              1st job's too), ทั่วไป, and เลื่อนอาชีพ while there is a next job (gold when it can be taken)
     left     the skills by line: a line's header (its element, name, ตีปกติ, the resonance bar), then one compact row per
              skill: icon (drag it onto the bar), name, level, kind, +1
     right    the picked skill's dark card: what it does now and at the next level, SP, cooldown, cast, element, damage
              type, the skills and the weapon it needs, the weapon bonus, +1 เรียน and ใส่แถบสกิล
     bottom   the skill bar Q E R F 3 4 5 6: drag a skill on, drag a slot onto another to swap or off the bar to empty it,
              right-click to empty; or point at a skill and press the slot's key; or ใส่แถบสกิล, then click a slot
   It takes over NC.HUD.panel('skills') (K, ?skills); the old #skills window stays in the page, unused. The job change
   cards are skillui.js's HUD.renderJobs (restyled here). Same skill helpers as skillui.js (skilltree.js, skillplan.js,
   weapons.js). */
(function () {
  'use strict';
  const NC = window.NC, SK = NC.SKILLS, HUD = NC.HUD, KEYS = NC.HOTKEYS, SHARED = NC.SHARED_SKILLS;
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  // The window shows what was learned; skillLv is the combat level and becomes 0 with the wrong weapon.
  const learnedLv = (p, id) => (NC.skillRaw || NC.skillLv)(p, id);
  const icon = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || '';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const JOB = (p) => NC.JOBS[p.job] || NC.JOBS.traveler;
  const KIND = { active: 'แอคทีฟ', buff: 'บัฟ', passive: 'พาสซีฟ' };
  const TYPE = { phys: 'ดาเมจกายภาพ', magic: 'ดาเมจเวท', best: 'ATK หรือ MATK ที่สูงกว่า', buff: 'เสริมพลัง', heal: 'ฟื้นฟู', summon: 'อัญเชิญ', debuff: 'ลดพลังศัตรู' };
  const MIXED = { am_orbs: 1, am_recall: 1, am_trinity: 1 }; // (the archmage's two-element spells: jobs3_archmage.js)
  const ROMAN = ['', 'I', 'II', 'III'];
  const EL_COL = { fire: '#ff8a55', water: '#6fb4ff', wind: '#5cd18a', earth: '#d19c5c', poison: '#bf8af0', holy: '#f2cc4d', shadow: '#a594ff', neutral: '#b9ad94', multi: '#ffbf4a' };
  const HINT = 'ลากสกิลมาวางที่นี่<small>หรือชี้ที่สกิลแล้วกดปุ่มช่อง · คลิกขวาที่ช่อง = เอาออก</small>';
  const LOCK = '<svg class="skw-lock" viewBox="0 0 16 18" aria-hidden="true"><path d="M4.2 8V5.6a3.8 3.8 0 0 1 7.6 0V8" fill="none" stroke="currentColor" stroke-width="2.4"/>' +
    '<rect x="1.4" y="7.4" width="13.2" height="10" rx="2.6" fill="currentColor"/><circle cx="8" cy="12.4" r="1.7" fill="#fff"/></svg>';
  NC.LOCK_SVG = LOCK;

  let win = null, tab = null, lastTab = null, sel = null, armed = null, hover = null;

  // ---------------- the tabs ----------------
  function tabsOf(p) {
    const J = JOB(p), own = (j) => NC.JOBS[j].skills.filter((s) => !SHARED.includes(s) && SK[s]);
    const tabs = [{ id: p.job, label: 'สกิล' + J.name, ids: own(p.job) }];
    for (const j of NC.jobLine(p.job).slice(1)) tabs.push({ id: j, label: 'สกิล' + NC.JOBS[j].name, ids: own(j) });
    tabs.push({ id: 'shared', label: 'ทั่วไป', ids: SHARED.slice() });
    if (NC.nextJobs(p).length) tabs.push({ id: 'jobs', label: J.tier === 2 ? 'เลื่อนคลาส 3' : J.tier === 1 ? 'เลื่อนขั้น 2' : 'เลือกอาชีพ', gold: NC.canChangeJob(p) });
    return tabs;
  }

  // ---------------- building the window ----------------
  function build() {
    win = document.createElement('div');
    win.id = 'skillwin'; win.className = 'kw-panel'; win.hidden = true;
    win.innerHTML = '<div class="skw-wrap"><section class="kw-win skw-win">' +
      '<header class="kw-title"><span>สกิล</span><button class="kw-x" id="skw-close" aria-label="ปิด">✕</button></header>' +
      '<div class="skw-sub" id="skw-sub"></div>' +
      '<nav class="kw-tabs skw-tabs" id="skw-tabs"></nav>' +
      '<div class="skw-body" id="skw-body">' +
        '<div class="skw-list kw-scroll" id="skw-list"></div>' +
        '<div class="skw-card kw-card" id="skw-card"></div>' +
        '<div class="skw-jobs kw-scroll" id="skw-jobs"></div>' +
      '</div>' +
      '<div class="skw-bar kw-inset"><div class="skw-bar-h">แถบสกิล</div><div class="skw-slots" id="skw-slots"></div><div class="skw-hint" id="skw-hint"></div></div>' +
      '</section></div>';
    document.body.appendChild(win);
    $('skw-close').addEventListener('click', close);
    $('skw-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (b && b.dataset.tab !== tab) { tab = b.dataset.tab; armed = null; render(); }
    });

    // the list: pick a row, +1, drag an icon, point + a slot key
    const list = $('skw-list');
    list.addEventListener('click', (e) => {
      const plus = e.target.closest('[data-plus]'), r = e.target.closest('.skw-row');
      if (plus) { if (!plus.disabled && NC.raiseSkill(G().player, plus.dataset.plus)) { sel = plus.dataset.plus; saveAndRedraw(); } return; }
      if (r && r.dataset.id !== sel) {
        sel = r.dataset.id; render();
        if (document.documentElement.classList.contains('mob-port')) $('skw-card').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); // (upright phone: the card is under the list)
      }
    });
    list.addEventListener('mouseover', (e) => { const r = e.target.closest('.skw-row'); hover = r && r.dataset.slot ? r.dataset.id : null; });
    list.addEventListener('mouseleave', () => { hover = null; });
    list.addEventListener('dragstart', (e) => {
      const ic = e.target.closest('.skw-ic.drag'), r = ic && ic.closest('.skw-row');
      if (!r) return;
      e.dataTransfer.setData('text/plain', 'skill:' + r.dataset.id); e.dataTransfer.effectAllowed = 'move';
    });

    // the card: +1 เรียน, ใส่แถบสกิล, drag its icon
    const card = $('skw-card');
    card.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if ((NC.skillCardActs || []).some((f) => f(G(), b))) { saveAndRedraw(); return; } // (hook: the extra rows' buttons)
      if (b.dataset.learn) { if (NC.raiseSkill(G().player, b.dataset.learn)) saveAndRedraw(); }
      else if (b.dataset.unslot) { NC.assignSlot(G().player, b.dataset.unslot, null); saveAndRedraw(); } // (no right-click on a phone)
      else if (b.dataset.arm) { armed = armed === b.dataset.arm ? null : b.dataset.arm; render(); }
    });
    card.addEventListener('dragstart', (e) => {
      const ic = e.target.closest('.skw-big.drag');
      if (ic) { e.dataTransfer.setData('text/plain', 'skill:' + ic.dataset.id); e.dataTransfer.effectAllowed = 'move'; }
    });
    card.addEventListener('mouseover', (e) => { const ic = e.target.closest('.skw-big.drag'); if (ic) hover = ic.dataset.id; });

    // the bar
    const slots = $('skw-slots');
    const slotOf = (e) => e.target.closest('.skw-slot');
    slots.addEventListener('dragstart', (e) => {
      const s = slotOf(e);
      if (s && e.target.tagName === 'IMG') { e.dataTransfer.setData('text/plain', 'slot:' + s.dataset.key); e.dataTransfer.effectAllowed = 'move'; }
    });
    slots.addEventListener('dragend', (e) => {
      const s = slotOf(e);
      if (s && e.dataTransfer.dropEffect === 'none') { NC.assignSlot(G().player, s.dataset.key, null); saveAndRedraw(); }
    });
    slots.addEventListener('dragover', (e) => { const s = slotOf(e); if (s) { e.preventDefault(); s.classList.add('over'); } });
    slots.addEventListener('dragleave', (e) => { const s = slotOf(e); if (s) s.classList.remove('over'); });
    slots.addEventListener('drop', (e) => {
      const s = slotOf(e);
      if (!s) return;
      e.preventDefault();
      const p = G().player, hb = NC.hotbarOf(p), k = s.dataset.key, d = e.dataTransfer.getData('text/plain') || '';
      if (d.startsWith('slot:')) { const from = d.slice(5), a = hb[from], b = hb[k]; hb[from] = b; hb[k] = a; }
      else if (d.startsWith('skill:')) NC.assignSlot(p, k, d.slice(6));
      armed = null; saveAndRedraw();
    });
    slots.addEventListener('click', (e) => {
      const s = slotOf(e);
      if (!s) return;
      const p = G().player;
      if (armed) { NC.assignSlot(p, s.dataset.key, armed); armed = null; saveAndRedraw(); return; }
      const id = NC.skillForKey(p, s.dataset.key); // (a filled slot: show its skill)
      if (id && SK[id]) { const t = tabOfSkill(p, id); if (t) { tab = t; sel = id; render(); } }
    });
    slots.addEventListener('contextmenu', (e) => {
      const s = slotOf(e);
      if (!s) return;
      e.preventDefault();
      const p = G().player;
      if (NC.hotbarOf(p)[s.dataset.key]) { NC.assignSlot(p, s.dataset.key, null); saveAndRedraw(); }
    });
  }
  const tabOfSkill = (p, id) => { const t = tabsOf(p).find((x) => x.ids && x.ids.includes(id)); return t ? t.id : SK[id] && SK[id].boss ? 'shared' : null; };
  function saveAndRedraw() { const g = G(); NC.applyGear(g); NC.saveGame(g); render(); }

  // ---------------- open / close ----------------
  function open() { armed = null; hover = null; render(); }
  function close() {
    HUD.panel('skills', false);
    const g = G();
    if (g) g.paused = false;
  }
  function fit() {
    const wrap = win.querySelector('.skw-wrap');
    wrap.style.transform = 'translate(-50%, -50%)';
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }
  addEventListener('resize', () => setTimeout(() => { if (win && !win.hidden) fit(); }, 0)); // (after game.js sets --u)

  // ---------------- drawing ----------------
  function render() {
    if (!win || win.hidden) return;
    const p = G().player, J = JOB(p), left = NC.skillLeft(p), total = NC.skillPoints(p);
    const inherited = total - (p.jobLv - 1);
    $('skw-sub').innerHTML = `${esc(J.name)} · Job Lv ${p.jobLv} / ${J.maxJob} · แต้มสกิลคงเหลือ <b class="${left > 0 ? 'some' : ''}">${left}</b>` +
      `<span class="skw-point-detail" id="skw-point-detail"><span>แต้มทั้งหมด ${total}</span><span>ใช้แล้ว ${total - left}</span>` +
      (inherited > 0 ? `<span>สะสมจากอาชีพเดิม ${inherited}</span>` : '') + '</span>';
    const tabs = tabsOf(p);
    if (!tabs.some((t) => t.id === tab)) tab = tabs[0].id;
    const tb = $('skw-tabs');
    tb.textContent = '';
    for (const t of tabs) {
      const b = el('button', 'kw-tab' + (t.id === tab ? ' on' : '') + (t.gold ? ' gold' : ''), t.label);
      b.dataset.tab = t.id;
      if (t.gold) b.appendChild(el('i', 'skw-dot'));
      tb.appendChild(b);
    }
    const jobs = tab === 'jobs';
    $('skw-body').classList.toggle('jobs-on', jobs);
    if (jobs) {
      const box = $('skw-jobs');
      box.textContent = '';
      HUD.renderJobs(box, p);
      if (lastTab !== tab) box.scrollTop = 0;
    } else {
      renderList(p, tabs.find((t) => t.id === tab));
      renderCard(p);
    }
    lastTab = tab;
    renderBar(p);
    fit();
  }

  function groupsOf(p, T) {
    const TJ = NC.JOBS[T.id], out = [];
    if (TJ && TJ.lines && TJ.lines.length) {
      for (const L of TJ.lines) { const ids = T.ids.filter((id) => SK[id].line === L.id); if (ids.length) out.push({ L, ids }); }
      const rest = T.ids.filter((id) => !TJ.lines.some((l) => l.id === SK[id].line));
      if (rest.length) out.push({ name: 'สกิลนอกสาย', ids: rest });
    } else {
      for (const [kind, name] of [['active', 'สกิลกดใช้'], ['buff', 'บัฟ (กดใช้ มีผลช่วงหนึ่ง)'], ['passive', 'สกิลติดตัว (ทำงานตลอด)']]) {
        const ids = T.ids.filter((id) => NC.kindOf(SK[id]) === kind);
        if (ids.length) out.push({ name, ids });
      }
    }
    if (T.id === 'shared') {
      const boss = NC.BOSS_ULT && NC.BOSS_ULT[NC.classOf(p.equip)];
      if (boss && SK[boss]) out.push({ name: 'อัลติชุดบอส (ใส่ครบชุดอยู่)', ids: [boss] });
    }
    return out;
  }

  function renderList(p, T) {
    const list = $('skw-list'), keep = lastTab === tab ? list.scrollTop : 0, groups = groupsOf(p, T);
    const all = groups.flatMap((g) => g.ids);
    if (!all.includes(sel)) sel = all.find((id) => learnedLv(p, id) > 0) || all[0] || null;
    list.textContent = '';
    for (const g of groups) {
      list.appendChild(lineHead(p, T.id, g));
      const box = el('div', 'skw-rows');
      for (const id of g.ids) box.appendChild(row(p, id));
      list.appendChild(box);
    }
    list.scrollTop = keep;
  }

  // a line's header: its element, name, the auto-attack mark, the resonance (15 / 30 / 45 levels in the line)
  function lineHead(p, job, g) {
    const h = el('div', 'skw-line');
    if (!g.L) { h.innerHTML = `<b>${esc(g.name)}</b>`; return h; }
    const L = g.L, d = p.d || {}, key = job + ':' + L.id, n = (d.lineRes && d.lineRes[key]) || 0, t = (d.lineTier && d.lineTier[key]) || 0;
    h.style.setProperty('--el', EL_COL[L.el] || EL_COL.neutral);
    const ic = icon(SK[g.ids[g.ids.length - 1]].icon); // (the line's top skill: its emblem)
    const name = (L.name.startsWith('สาย') ? '' : 'สาย') + L.name;
    let html = `<span class="skw-lic"><img src="${ic}" alt=""></span><b>${esc(name)}</b>${L.auto ? '<span class="kw-tag skw-auto" title="สายนี้ทำงานกับการตีปกติ">ตีปกติ</span>' : ''}`;
    if (!(NC.JOBS[job] && NC.JOBS[job].tier === 3)) { // (class 3: its skills power up the 2nd job's lines)
      const next = NC.RES_STEPS.find((s) => n < s), top = NC.RES_STEPS[NC.RES_STEPS.length - 1];
      html += `<span class="skw-res" title="เรโซแนนซ์: เลเวลสกิลรวมของสายนี้ ครบ ${NC.RES_STEPS.join(' / ')} สกิลสายนี้แรงขึ้น ${NC.RES_DMG.slice(1).map((v) => '+' + v + '%').join(' / ')}">` +
        `<i style="width:${Math.min(100, (100 * n) / (next || top)).toFixed(1)}%"></i></span><span class="skw-resn">เรโซแนนซ์ ${n}${next ? ' / ' + next : ''}</span>` +
        (t ? `<span class="skw-tier">ขั้น ${ROMAN[t]} +${NC.RES_DMG[t]}%</span>` : '');
    }
    h.innerHTML = html;
    return h;
  }

  function reqText(p, id) {
    const S = SK[id], R = NC.skillReq(id), no = R.filter(([q, l]) => learnedLv(p, q) < l);
    if (no.length && !(S.reqAny && no.length < R.length)) return 'ต้องเรียน ' + (S.reqAny ? R : no).map(([q, l]) => `${SK[q] ? SK[q].name : q} Lv ${l}`).join(S.reqAny ? ' หรือ ' : ' · ');
    if (S.reqFn && !S.reqFn(p)) return 'ต้องมี ' + (S.reqText || 'เงื่อนไขพิเศษ');
    return '';
  }

  // one compact row: icon (drag), name (+ what it still needs), level, kind, +1
  function row(p, id) {
    const S = SK[id], lv = learnedLv(p, id), kind = NC.kindOf(S), met = NC.skillReqMet(p, id), left = NC.skillLeft(p);
    const wok = NC.weaponWorks ? NC.weaponWorks(p, id) : NC.weaponOk ? NC.weaponOk(p, id) : true, can = NC.skillSlottable(S) && NC.skillUsable(p, id);
    const slot = KEYS.find((k) => NC.hotbarOf(p)[k] === id);
    const r = el('div', 'skw-row' + (lv ? '' : ' none') + (id === sel ? ' sel' : '') + (armed === id ? ' armed' : '') + (met ? '' : ' lock') + (wok ? '' : ' wlock'));
    r.dataset.id = id;
    if (can) r.dataset.slot = '1';
    const need = met ? '' : reqText(p, id);
    const plusOk = !S.boss && lv < S.max && left > 0 && met;
    r.innerHTML = `<span class="skw-ic${can ? ' drag' : ''}"${can ? ' draggable="true" title="ลากไปวางบนแถบสกิล"' : ''}><img src="${icon(S.icon)}" alt="" draggable="false">` +
      (slot ? `<em>${slot.toUpperCase()}</em>` : '') + '</span>' +
      `<span class="skw-name"><b>${esc(S.name)}</b></span>` +
      `<span class="skw-lv">${S.boss ? 'BOSS' : `Lv ${lv}<small>/${S.max}</small>`}</span>` +
      `<span class="kw-tag k-${S.ult ? 'ult' : kind}">${S.ult ? (NC.RO_TIME ? 'ท่าใหญ่' : 'อัลติ') : KIND[kind]}</span>` +
      (S.boss ? '<span></span>' : `<button class="skw-plus" data-plus="${id}"${plusOk ? '' : ' disabled'} title="${plusOk ? 'เรียน +1 เลเวล (ใช้ 1 แต้ม)' : lv >= S.max ? 'เลเวลสูงสุดแล้ว' : !met ? 'ยังเรียนไม่ได้' : 'แต้มสกิลหมด'}">+1</button>`) +
      (need ? `<span class="skw-need1">${LOCK}${esc(need)}</span>` : !wok ? `<span class="skw-need1 w">${LOCK}ไม่มีผล · ต้องถือ${esc(NC.weaponNeedText(id))}</span>` : '');
    return r;
  }

  // the dark card of the picked skill
  function renderCard(p) {
    const c = $('skw-card'), id = sel, S = id && SK[id];
    if (!S) { c.innerHTML = '<div class="skw-empty">เลือกสกิลทางซ้ายเพื่อดูรายละเอียด</div>'; return; }
    const lv = learnedLv(p, id), kind = NC.kindOf(S), met = NC.skillReqMet(p, id), left = NC.skillLeft(p), L1 = Math.max(1, lv);
    const say = (l) => (S.active ? S.desc(l, Math.round(S.mul(l) * 100 * ((NC.RO_DMG && NC.RO_DMG[id]) || 1))) : S.desc(l));
    const can = NC.skillSlottable(S) && NC.skillUsable(p, id);
    const tags = [`<span class="kw-tag k-${S.ult ? 'ult' : kind}">${S.ult ? (NC.RO_TIME ? 'ท่าใหญ่' : 'อัลติ') : KIND[kind]}</span>`];
    if (S.active) {
      tags.push(`<span class="skw-chip">SP ${NC.skillCost(p, id, L1)}</span>`, `<span class="skw-chip">คูลดาวน์ ${+NC.skillCdOf(S, L1).toFixed(1)} วิ</span>`);
      const ct = NC.castTime ? NC.castTime(p, id, L1) : 0;
      if (ct >= 0.05) tags.push(`<span class="skw-chip">ร่าย ${ct.toFixed(2)} วิ</span>`);
      const ad = NC.skillAcdOf ? NC.skillAcdOf(p, id) : 0; // (?rotime: the after-cast delay, js/rotiming.js)
      if (ad > 0) tags.push(`<span class="skw-chip">ดีเลย์ ${ad} วิ</span>`);
      if (kind === 'active') {
        tags.push(`<span class="skw-chip">${MIXED[id] ? 'สองธาตุ (ผสม)' : S.element ? 'ธาตุ' + esc(NC.ELEMENT_INFO[S.element].th) : 'ธาตุตามอาวุธ'}</span>`);
        if (TYPE[S.type]) tags.push(`<span class="skw-chip dm">${TYPE[S.type]}</span>`);
      }
    }
    const slot = KEYS.find((k) => NC.hotbarOf(p)[k] === id);
    if (slot) tags.push(`<span class="skw-chip on">ช่อง ${slot.toUpperCase()}</span>`);

    const now = S.boss ? say(L1) : lv ? say(lv) : 'ยังไม่ได้เรียน';
    const next = S.boss ? 'อัลติชุดบอส: ใช้แทน F ตอนใส่ชุดครบ (เลเวลคงที่)' : lv < S.max ? `<b>Lv ${lv + 1}:</b> ${esc(say(lv + 1))}` : 'เลเวลสูงสุดแล้ว';
    const R = NC.skillReq(id);
    let needs = '';
    if (R.length) needs += `<div class="skw-need"><span>ต้องเรียนก่อน${S.reqAny ? ' (อย่างใดอย่างหนึ่ง)' : ''}</span>` +
      R.map(([q, l]) => { const ok = learnedLv(p, q) >= l; return `<i class="${ok ? 'ok' : 'no'}">${ok ? '✔' : '✕'} ${esc(SK[q] ? SK[q].name : q)} Lv ${l}</i>`; }).join('') + '</div>';
    if (S.reqFn) { const ok = S.reqFn(p); needs += `<div class="skw-need"><i class="${ok ? 'ok' : 'no'}">${ok ? '✔' : '✕'} ${esc(S.reqText || 'เงื่อนไขพิเศษ')}</i></div>`; }
    const wNeed = NC.weaponNeedText ? NC.weaponNeedText(id) : '', wBonus = NC.weaponBonusText ? NC.weaponBonusText(id) : '';
    if (wNeed) { const ok = NC.weaponWorks ? NC.weaponWorks(p, id) : NC.weaponOk(p, id); needs += `<div class="skw-wpn ${ok ? 'ok' : 'no'}">${ok ? '✔' : '✕ ไม่มีผลกับอาวุธนี้ ·'} ต้องถือ${esc(wNeed)}</div>`; }
    if (wBonus) { const on = NC.weaponBonus(p, id); needs += `<div class="skw-wpn bo${on ? ' on' : ''}">${on ? '★' : '☆'} โบนัส ${esc(wBonus)}</div>`; }

    const plusOk = !S.boss && lv < S.max && left > 0 && met;
    let why = S.boss ? '' : lv >= S.max ? 'เลเวลสูงสุดแล้ว' : !met ? 'ยังเรียนไม่ได้: เรียนสกิลที่ต้องการก่อน' : '';
    if (!S.boss && lv < S.max && left <= 0) {
      const earn = p.jobLv < NC.jobMax(p) ? 'เพิ่ม Job Lv เพื่อรับแต้มอีก 1 แต้ม หรือ' : '';
      const reset = NC.skillResetPrice(p) === 0 ? 'รีเซ็ตฟรี' : 'รีเซ็ตสกิล';
      why += (why ? ' · ' : '') + `แต้มสกิลหมด: ${earn}${reset}ที่ร้านลุงโกโก้ในค่าย`;
    }
    c.innerHTML = `<div class="skw-ch"><span class="skw-big${can ? ' drag' : ''}" data-id="${id}"${can ? ' draggable="true" title="ลากไปวางบนแถบสกิล"' : ''}><img src="${icon(S.icon)}" alt="" draggable="false"></span>` +
      `<div class="skw-chd"><div class="skw-cn">${esc(S.name)} <span class="skw-clv">${S.boss ? 'อัลติชุดบอส' : `Lv ${lv} / ${S.max}`}</span></div>` +
      `<div class="skw-tags">${tags.join('')}</div></div></div>` +
      `<div class="skw-sec skw-now">${esc(now)}</div><div class="skw-sec skw-next">${next}</div>` + (needs ? `<div class="skw-sec">${needs}</div>` : '') +
      (NC.skillCardExtras || []).map((f) => f(p, id)).join('') + // (hook: other files' rows on the card, e.g. rune slots: js/bl_runes.js)
      '<div class="skw-btns">' + (S.boss ? '' : `<button class="kw-btn blue" data-learn="${id}"${plusOk ? '' : ' disabled'}>+1 เรียน</button>`) +
      (can ? `<button class="kw-btn ${armed === id ? 'gold' : 'grey'}" data-arm="${id}">${armed === id ? 'เลือกช่องด้านล่าง' : slot ? 'ย้ายช่อง' : 'ใส่แถบสกิล'}</button>` : '') +
      (slot ? `<button class="kw-btn red skw-off" data-unslot="${slot}" title="เอาออกจากช่อง ${slot.toUpperCase()}">เอาออก</button>` : '') + '</div>' +
      (why ? `<div class="skw-why">${why}</div>` : '');
  }

  // the skill bar Q E R F · 3 4 5 6
  function renderBar(p) {
    const box = $('skw-slots'), hb = NC.hotbarOf(p);
    box.textContent = '';
    KEYS.forEach((k) => {
      const id = NC.skillForKey(p, k), S = id && SK[id];
      const s = el('div', 'skw-slot' + (S ? '' : ' empty') + (S && S.ult ? ' ult' : '') + (armed ? ' armed' : '') + (S && id === sel ? ' sel' : ''));
      s.dataset.key = k;
      s.innerHTML = `<span class="key">${k.toUpperCase()}</span>` +
        (S ? `<img src="${icon(S.icon)}" alt="" title="${esc(S.name)}"${hb[k] === id ? ' draggable="true"' : ''}>` : '<i>+</i>');
      box.appendChild(s);
    });
    $('skw-hint').innerHTML = armed && SK[armed] ? `คลิกช่องที่จะใส่<small>"${esc(SK[armed].name)}" หรือกดปุ่มช่องนั้น</small>` : HINT;
  }

  // pointing at a skill (or with ใส่แถบสกิล on) and pressing a slot's key puts it there (the game doesn't see that key)
  const CODE = { KeyQ: 'q', KeyE: 'e', KeyR: 'r', KeyF: 'f', Digit3: '3', Digit4: '4', Digit5: '5', Digit6: '6' };
  addEventListener('keydown', (e) => {
    if (!win || win.hidden) return;
    if (e.code === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); if (armed) { armed = null; render(); } else close(); return; }
    const k = CODE[e.code], id = armed || hover;
    if (!k || !id) return;
    e.preventDefault(); e.stopImmediatePropagation();
    NC.assignSlot(G().player, k, id);
    armed = null;
    saveAndRedraw();
  }, true);

  // ---------------- hooks: K, ?skills and everything that calls HUD.panel('skills') open this window ----------------
  const baseInit = HUD.init.bind(HUD);
  HUD.init = function (game) { baseInit(game); build(); };
  const basePanel = HUD.panel.bind(HUD);
  HUD.panel = function (id, show) {
    if (win && id === 'skills') {
      const on = show === undefined ? win.hidden : show;
      basePanel('pause', false); // closes every other window
      win.hidden = !on;
      if (on) open();
      return on;
    }
    if (win) win.hidden = true;
    return basePanel(id, show);
  };
  // (whatever redraws the old window redraws this one while it is open)
  const baseRender = HUD.renderSkills;
  HUD.renderSkills = function () { if (win && !win.hidden) return render(); return baseRender.apply(this, arguments); };
})();
