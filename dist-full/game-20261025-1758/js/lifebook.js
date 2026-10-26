/* lifebook.js — the life-skill window (H) in the K look (css/kui.css + css/lifebook.css). Page 5 of the page-by-page
   redesign (2026-09-29): layout "C" of assets/gen/nightcamp_pg_life_c_raw.png, a collection book:
     bookmarks  ตัดไม้ ขุดแร่ ปลูกผัก ตกปลา, each with its tool (the tier the hero has) and level, sticking out of the
                window's left edge
     left page  the skill's level, rank and XP % · its tool: tier stars, the teacher · what the next tier needs (the
                skill's level, coins, materials: have / need) and the upgrade button · the perks, done ones ticked,
                the rest locked
     right page the collection: one card per thing the skill finds (life.js GUIDE), its name and where under it. Found:
                its picture and how many we carry (fish: the biggest caught). Not found yet: a plain "?" (never a dark
                silhouette: the user, "ให้เขาไปลุ้นเอง"), coloured by how rare it is. The picked card's note at the
                bottom. Farming also shows our garden (life_farm.js farmPanel).
   The upgrade button upgrades when everything is there and the hero stands by the tool's teacher (the teachers stay
   the place to upgrade); away from them it leads there (NC.MapRoute, js/mapwin.js).
   It takes over NC.HUD.panel('life') (H, the menu's H button, ?lifewin=wood|mine|farm|fish); the teachers' windows
   (lifementor) stay life.js's. Reads NC.Life (life.js, life_*.js). */
(function () {
  'use strict';
  const NC = window.NC, L = NC.Life;
  if (!L) return;
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MAT = NC.MATERIALS;
  const COIN = () => NC.matIcon('ic_coin');
  const LOCK = () => NC.LOCK_SVG || '';
  const TEACH_MAP = 'homefarm'; // (every life teacher lives on the firefly farm)

  let win = null, tab = 'wood';
  const pick = {}; // the picked card per skill

  // ---------------- building the window ----------------
  function build() {
    win = document.createElement('div');
    win.id = 'lifebook'; win.className = 'kw-panel'; win.hidden = true;
    win.innerHTML = '<div class="lb-wrap"><nav class="lb-marks" id="lb-marks"></nav><section class="kw-win lb-win">' +
      '<header class="kw-title"><span>อาชีพเสริม</span><button class="kw-x" id="lb-close" aria-label="ปิด">✕</button></header>' +
      '<div class="lb-body"><div class="lb-book">' +
        '<div class="lb-page lb-left kw-scroll" id="lb-left"></div>' +
        '<div class="lb-spine"></div>' +
        '<div class="lb-page lb-right kw-scroll" id="lb-right"></div>' +
        '<i class="lb-clasp a"></i><i class="lb-clasp b"></i><i class="lb-ribbon"></i>' +
      '</div></div></section></div>';
    document.body.appendChild(win);
    $('lb-close').addEventListener('click', close);
    $('lb-marks').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b && b.dataset.s !== tab) { tab = b.dataset.s; render(); } });
    $('lb-right').addEventListener('click', (e) => { const b = e.target.closest('[data-mat]'); if (b) { pick[tab] = b.dataset.mat; render(); } });
    $('lb-left').addEventListener('click', (e) => { const b = e.target.closest('[data-up]'); if (b && !b.disabled) upgrade(b.dataset.up); });
  }

  // ---------------- open / close ----------------
  function close() {
    NC.HUD.panel('life', false);
    const g = G();
    if (g) g.paused = false;
  }
  function fit() {
    const wrap = win.querySelector('.lb-wrap');
    wrap.style.transform = 'translate(-50%, -50%)';
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }
  addEventListener('resize', () => setTimeout(() => { if (win && !win.hidden) fit(); }, 0));

  // ---------------- the upgrade: at the teacher; away from them, the way there ----------------
  // (a tool may name its own teacher and map: cooking's ป้าหมีหม้อดำ stands by the campfire in the camp, js/cooking.js)
  const teacherOf = (tool) => (L.TOOLS[tool].teacher ? L.TOOLS[tool].teacher() : L.mentors.find((m) => m.name === L.TOOLS[tool].mentor));
  function nearTeacher(g, tool) {
    const m = teacherOf(tool), p = g.player;
    // (online the server takes it within 180 of the teacher, backend life_actions.go: 150 here leaves the lag room; Discord #101)
    return !!(m && m.here(g) && NC.dist(p.x, p.y, m.x, m.y) < (NC.Online && NC.Online.enabled ? 150 : 240));
  }
  function upgrade(tool) {
    const g = G(), T = L.TOOLS[tool], map = T.map || TEACH_MAP;
    if (nearTeacher(g, tool)) { if (L.upgrade(g, tool)) render(); return; }
    if (g.mapId !== map && NC.MapRoute) {
      NC.MapRoute.set(map);
      NC.HUD.log(`นำทางไปหา${T.mentor} ที่${T.where || 'ฟาร์มหิ่งห้อย'}: เดินตามลูกศรสีทอง`, 'sys');
    } else NC.HUD.log(`${T.mentor}อยู่ในแมพนี้ เดินไปคุยแล้วอัปเกรดได้เลย`, 'sys');
    close();
  }

  // ---------------- drawing ----------------
  const stars = (t) => [1, 2, 3, 4].map((i) => `<i class="${i <= t ? 'on' : ''}">★</i>`).join('');
  // a material's colour: rare (lavender), valuable (gold), the rest light blue once found, cream while still "?"
  const tierOf = (id, found) => { const M = MAT[id] || {}; return M.rare ? 'r-rare' : M.price >= 60 ? 'r-gold' : found ? 'r-blue' : 'r-plain'; };
  function render() {
    if (!win || win.hidden) return;
    const g = G(), p = g.player, r = L.rec(p);
    if (!L.SKILLS[tab]) tab = 'wood';
    $('lb-marks').innerHTML = Object.keys(L.SKILLS).map((s) => {
      const S = L.SKILLS[s], T = L.TOOLS[S.tool];
      return `<button class="lb-mark${s === tab ? ' on' : ''}" data-s="${s}"><img src="${L.lifeIcon(T.sprite(L.toolTier(p, S.tool)))}" alt="">` +
        `<span><b>${esc(S.name)}</b><small>Lv ${r[s] ? r[s].lv : 1}</small></span></button>`;
    }).join('');
    renderLeft(g, p, r);
    renderRight(g, p, r);
    fit();
  }

  function renderLeft(g, p, r) {
    const S = L.SKILLS[tab], R = r[tab] || { lv: 1, xp: 0 }, T = L.TOOLS[S.tool], t = L.toolTier(p, S.tool), max = R.lv >= L.MAXLV;
    const need = L.xpNeed(R.lv), pct = max ? 100 : Math.min(100, (100 * R.xp) / need);
    let h = `<div class="lb-title">${esc(S.name)} <span>Lv ${R.lv} - ${esc(L.rankOf(R.lv))}</span></div>` +
      `<div class="lb-xprow" title="${max ? 'เลเวลสูงสุดแล้ว' : `XP ${R.xp} / ${need}`}"><div class="lb-xp"><i style="width:${pct.toFixed(1)}%"></i></div><b>${max ? 'MAX' : Math.floor(pct) + '%'}</b></div>`;
    // the tool
    h += `<div class="lb-box lb-tool"><span class="lb-tslot"><img src="${L.lifeIcon(T.sprite(t))}" alt=""></span><div>` +
      `<div class="lb-tname">${esc(T.names[t - 1])}</div><div class="lb-stars">${stars(t)}</div><div class="lb-teach">ครู: ${esc(T.mentor)}</div></div></div>`;
    // the next tier
    const c = t < 4 ? L.UPGRADES[S.tool][t - 1] : null;
    if (c) {
      const lvOk = R.lv >= c.lv, coinOk = p.coins >= c.coins, ready = lvOk && L.canPay(p, c), near = nearTeacher(g, S.tool);
      let rows = `<li><img src="${L.lifeIcon(S.icon)}" alt=""><span>${esc(S.name)} Lv ${c.lv} <em class="${lvOk ? 'ok' : 'no'}">${lvOk ? '✓' : `(ตอนนี้ ${R.lv})`}</em></span></li>` +
        `<li><img src="${COIN()}" alt=""><span>${NC.fmtCoins(c.coins)} เหรียญ <em class="${coinOk ? 'ok' : 'no'}">(มี ${NC.fmtCoins(p.coins)})</em></span></li>`;
      for (const id in c.mats) {
        const have = NC.matCount(p, id), ok = have >= c.mats[id], seen = p.matSeen && p.matSeen.has(id);
        rows += `<li>${seen ? `<img src="${NC.matIcon(id)}" alt="">` : '<i class="lb-q">?</i>'}<span>${esc((MAT[id] || {}).name || id)} ×${c.mats[id]} <em class="${ok ? 'ok' : 'no'}">(มี ${have})</em></span></li>`;
      }
      const label = !ready ? 'อัปเกรด' : near ? 'อัปเกรด!' : `ไปอัปเกรดกับ${esc(T.mentor)}`;
      h += `<div class="lb-box lb-next"><div class="lb-h">ขั้นต่อไป: <b>${esc(T.names[t])}</b></div><ul class="lb-needs">${rows}</ul>` +
        `<button class="kw-btn ${ready ? (near ? 'gold' : 'blue') : 'grey'} lb-up" data-up="${S.tool}"${ready ? '' : ' disabled'}>${label}</button></div>`;
    } else h += '<div class="lb-box lb-next"><div class="lb-done">เครื่องมือขั้นสูงสุดแล้ว!</div></div>';
    // the perks
    h += '<div class="lb-box lb-perkbox"><div class="lb-h">ความสามารถ</div><ul class="lb-perks">' +
      S.perks.map(([lv, text]) => `<li class="${R.lv >= lv ? 'on' : ''}"><i>${R.lv >= lv ? '✓' : LOCK()}</i><b>Lv ${lv}</b><span>${esc(text)}</span></li>`).join('') + '</ul></div>';
    $('lb-left').innerHTML = h;
  }

  function renderRight(g, p, r) {
    const S = L.SKILLS[tab], R = r[tab] || { lv: 1 }, T = L.TOOLS[S.tool], t = L.toolTier(p, S.tool), list = L.GUIDE[tab] || [];
    const fish = tab === 'fish', book = (fish && r.fishbook) || {};
    const found = (x) => (fish ? !!book[x.mat] : !!(p.matSeen && p.matSeen.has(x.mat)));
    const got = list.filter(found).length;
    if (!list.some((x) => x.mat === pick[tab])) pick[tab] = (list.find(found) || list[0] || {}).mat;
    const lockOf = (x) => R.lv < x.lv || (x.tier && t < x.tier);
    const whereOf = (x) => (x.where || '-') + (lockOf(x) ? (R.lv < x.lv ? ` · Lv ${x.lv}` : ` · ${T.names[x.tier - 1]}`) : '');
    let h = `<div class="lb-title lb-coltitle">${S.book || (fish ? 'สมุดปลา' : tab === 'farm' ? 'สมุดผัก' : 'สมุดสะสม')}<em>เจอแล้ว ${got} / ${list.length}</em></div>`;
    if (tab === 'farm' && L.farmPanel) h += `<div class="lb-garden">${L.farmPanel(g, p)}</div>`;
    h += `<div class="lb-box lb-grid${list.length > 9 ? ' dense' : ''}">`;
    for (const x of list) {
      const f = found(x), n = fish ? (book[x.mat] && book[x.mat].best) : NC.matCount(p, x.mat);
      h += `<button class="lb-card${x.mat === pick[tab] ? ' sel' : ''}" data-mat="${x.mat}" title="${esc(x.name)}">` +
        `<span class="lb-slot ${tierOf(x.mat, f)}${f ? '' : ' q'}">${f ? `<img src="${NC.matIcon(x.mat)}" alt="">` : '<i>?</i>'}` +
        (f && n ? `<b>${fish ? n + ' ซม.' : '×' + n}</b>` : '') + (x.night ? '<em class="moon">☾</em>' : '') + (lockOf(x) ? `<em class="lk">${LOCK()}</em>` : '') + '</span>' +
        `<span class="lb-cname">${esc(x.name)}</span><span class="lb-cwhere">${esc(whereOf(x))}</span></button>`;
    }
    h += '</div>';
    // the picked card
    const x = list.find((y) => y.mat === pick[tab]);
    if (x) {
      const f = found(x), have = NC.matCount(p, x.mat);
      const need = R.lv < x.lv ? `ต้องมี${esc(S.name)} Lv ${x.lv}` : x.tier && t < x.tier ? `ต้องใช้${esc(T.names[x.tier - 1])}` : '';
      const state = need ? `<span class="no">${need}</span>` : f ? `<span class="ok">${fish ? `จับได้ ${book[x.mat].n} ตัว · ตัวใหญ่สุด ${book[x.mat].best} ซม.` : `เคยได้แล้ว`}</span>` : '<span class="go">ไปหาได้เลย!</span>';
      h += `<div class="lb-pick"><span class="lb-slot lb-bigslot ${tierOf(x.mat, f)}${f ? '' : ' q'}">${f ? `<img src="${NC.matIcon(x.mat)}" alt="">` : '<i>?</i>'}</span><div>` +
        `<div class="lb-pname">${esc(x.name)}${f && !fish ? ` ×${have}` : ''}${x.night ? ' <em>☾ กลางคืน</em>' : ''}</div>` +
        `<div class="lb-where">${esc(x.where || '-')}</div><div class="lb-state">${state}</div></div></div>`;
    }
    $('lb-right').innerHTML = h;
  }

  // ---------------- hooks: H, the menu's button, ?lifewin open this window ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) { baseInit(game); build(); };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (win && id === 'life') {
      const on = show === undefined ? win.hidden : show;
      basePanel('pause', false); // closes every other window (life.js's too)
      win.hidden = !on;
      if (on) render();
      return on;
    }
    if (win) win.hidden = true;
    return basePanel(id, show);
  };
  // (life.js redraws its window when the record changes: this one too)
  const baseRefresh = L.refresh;
  L.refresh = function () { if (baseRefresh) baseRefresh.apply(this, arguments); render(); };
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || !win || win.hidden) return;
    e.stopImmediatePropagation(); e.preventDefault();
    close();
  }, true);
})();
