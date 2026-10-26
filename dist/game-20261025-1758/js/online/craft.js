/* online/craft.js — the smith's and the kitchen's work online (?online): ตีบวก (refine), ขัดเกรด (polish), หินออฟ /
   เจาะออฟ (option stone / drill), ตีอาวุธ (weapon crafting), ทำอาหาร / กิน (cook / eat) and ต้มยา (brew) are rolled by the
   server (backend gear_copies.go, cooking.go, potions_brew.go: action 'forge' kind refine · polish · stone · drill · craft,
   'cook', 'eat', 'brew'). The web's windows keep their looks and their own checks; at the moment one would roll locally
   the try goes to the server instead, and the result popup (js/resultfx.js, its own builders) is drawn from what the
   server's next bag and record say (the server answers a try only with 'character' or an error; backend actions.go).
   Hooks, installed after js/resultfx.js's so they are the outermost: NC.invActs (rf:go), NC.FORGE_TABS' grade tab click
   (data-gtgo), NC.Forge.click (fg-stone, fg-drill, data-make), NC.Forge.craft (forgemake.js), NC.Cook.cook / eat (and
   the cookbook window's own buttons), NC.Brew.brew. Load after online/gear.js. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld;
  if (!O || !O.enabled || !W) return;
  const RF = () => NC.ResultFX || {};
  const bagOf = () => (Array.isArray(O.bag) ? O.bag : []);
  const findU = (list, u) => list.find((c) => c.u === u) || null;
  const mats = () => ((W.snap && W.snap.self && W.snap.self.mats) || {});
  const toast = (t) => { const g = W.game; if (g && g.toast) g.toast(t); };
  let pending = null; // the try waiting for the server: { kind, at, before, ... }

  // the server's forge refusals in Thai (backend gear_copies.go / gear_phase2.go / actions.go; Thai ones pass as they are)
  const FORGE_TH = [[/option row unavailable|no option row/i, 'แถวออฟนี้ไม่มีอยู่จริง เลือกแถวใหม่อีกครั้ง'], [/option kind unavailable/i, 'อุปกรณ์ชิ้นนี้ใส่ออฟชนิดนี้ไม่ได้'],
    [/no option available/i, 'ไม่มีออฟให้สุ่มแล้ว'], [/not enough coins/i, 'เหรียญไม่พอ'], [/copy not owned/i, 'ไม่พบอุปกรณ์ชิ้นนี้ในกระเป๋า'],
    [/polish unavailable|polish rules/i, 'ขัดเกรดชิ้นนี้ไม่ได้'], [/forge unavailable|recipe unavailable/i, 'ทำไม่ได้ตอนนี้'], [/invalid option/i, 'ออฟที่เลือกไม่ถูกต้อง']];
  const thaiForge = (m) => { m = String(m || ''); if (!m) return 'ทำไม่สำเร็จ'; const w = FORGE_TH.find(([re]) => re.test(m)); return w ? w[1] : m; };
  function start(kind, action, info) {
    if (!W.ready) return false;
    if (pending && performance.now() - pending.at < 4000) { toast('รอผลครั้งก่อนสักครู่'); return false; }
    pending = Object.assign({ kind, action, at: performance.now(), bag: bagOf(), mats: Object.assign({}, mats()) }, info || {});
    W.send(action);
    return true;
  }
  // the server's answer: an error ends the try; a 'character' notice waits for the next bag / record to show the result
  W.eventHooks.push((ev) => {
    if (!pending || !ev) return;
    // AUTO keeps attacking while a craft is in flight. Its cooldown / range errors
    // belong to those combat commands, not to the item the player is upgrading.
    const seq = W.commandSeq(pending.action);
    if (!seq || ev.seq !== seq) return;
    if (ev.type === 'error' && performance.now() - pending.at < 5000) {
      const msg = thaiForge(ev.message);
      toast(msg);
      if (NC.HUD) NC.HUD.log(msg, 'warn');
      pending = null;
      // the page again from the server's own bag: a row it does not have was offered again and again (Discord #102)
      if (NC.Forge && NC.Forge.render) setTimeout(() => { try { NC.Forge.render(); } catch (e) { /* closed */ } }, 300);
      return;
    }
    if (ev.type === 'character' && /^(forge|cook|eat|brew)$/.test(ev.action || '')) { pending.ok = true; pending.okAt = performance.now(); }
  });
  // the result: once the server's bag or record moved on after the 'character' notice (or after a short wait)
  setInterval(() => {
    if (!pending || !pending.ok) return;
    const moved = bagOf() !== pending.bag || JSON.stringify(mats()) !== JSON.stringify(pending.mats);
    if (!moved && performance.now() - pending.okAt < 1500) return;
    const p = W.game && W.game.player, done = pending;
    pending = null;
    try { if (p) result(done, p); } catch (e) { console.warn('online: craft result', e); }
    if (NC.Forge && NC.Forge.render) try { NC.Forge.render(); } catch (e) { /* closed */ }
  }, 120);

  // the lessons' counts for what the server did (lessons.js watches the web's own refine / cook / brew, which never roll here)
  const lessonEv = (k) => { if (NC.Lessons && NC.Lessons.ev) NC.Lessons.ev(k); };
  function result(d, p) {
    const R = RF(), show = (r) => R.show && r && R.show(r), now = bagOf(), c = findU(now, d.u);
    if (d.kind === 'refine') lessonEv('refine');
    else if (d.kind === 'stone') lessonEv('optstone');
    else if (d.kind === 'eat') lessonEv('eat');
    else if (d.kind === 'brew') lessonEv('brew');
    else if (d.kind === 'cook' && (mats()[d.itemId] || 0) > (d.mats[d.itemId] || 0)) lessonEv('cook');
    switch (d.kind) {
      case 'refine': {
        const stones = (mats().mat_safety || 0);
        if (!R.refineResult) return;
        const still = !!c, cc = c || d.copy; // (broken: the copy as it was)
        const local = (p.bag || []).find((x) => x.u === d.u) || cc; // (p.bag holds the server's copy now: its own heat, ref)
        show(R.refineResult(p, still ? local : cc, d.before, { stones }, still));
        break;
      }
      case 'polish': if (c && R.polishResult) show(R.polishResult(p, (p.bag || []).find((x) => x.u === d.u) || c, d.before)); break;
      case 'stone': case 'drill': {
        if (!c || !R.optResult) return;
        const mine = (p.bag || []).find((x) => x.u === d.u) || c;
        if (d.kind === 'drill') show(R.optResult(mine, mine.rows.length - 1, true));
        else show(R.optResult(mine, d.row, false, (d.copy.pi || 0) >= 9));
        break;
      }
      case 'craft': {
        const had = new Set(d.bag.map((x) => x.u)), made = now.find((x) => !had.has(x.u) && x.id === d.itemId);
        if (made && R.craftResult) { show(R.craftResult((p.bag || []).find((x) => x.u === made.u) || made)); toast(`ได้รับ ${(NC.ITEMS[made.id] || {}).name || made.id}!`); }
        break;
      }
      case 'cook': {
        const got = (mats()[d.itemId] || 0) - (d.mats[d.itemId] || 0), D = (NC.Cook && NC.Cook.BY && NC.Cook.BY[d.itemId]) || {};
        if (got > 0) show({ kind: 'cook', size: 'small', state: got > d.count ? 'great' : 'ok', icon: R.matIcon ? R.matIcon(d.itemId) : '', color: '#ffb35c', kicker: 'ทำอาหาร',
          title: got > d.count ? 'ได้เพิ่ม!' : 'เสร็จแล้ว!', name: `${D.name || d.itemId} ×${got}`, lines: D.tag ? [{ t: D.tag }] : [] });
        break;
      }
      case 'eat': { const D = (NC.Cook && NC.Cook.BY && NC.Cook.BY[d.itemId]) || {}; toast(`กิน${D.name || ''}แล้ว`); break; }
      case 'brew': {
        const B = NC.Brew || {}, Rc = (B.RECIPES || []).find((x) => x.id === d.itemId), q = Rc && Rc.q;
        const src = q ? ((NC.ASSET_MANIFEST[q.icon] || {}).src || 'assets/' + q.icon + '.png') : '';
        show({ kind: 'brew', size: 'small', state: 'ok', icon: src, color: q && q.color === 'blue' ? '#7cc4ff' : '#ff8a9a', kicker: 'ต้มยา',
          title: 'เสร็จแล้ว!', name: `${q ? q.name : 'ยา'} ×${(B.BATCH || 1) * d.count}`, lines: q && q.what ? [{ t: q.what }] : [] });
        break;
      }
      default: break;
    }
  }

  // ---------------- ตีบวก: the anvil's go button (rf:go:u; js/refine.js's own handler never rolls online) ----------------
  let armedRef = 0;
  function refineAct(game, a) {
    const m = /^rf:go:(\d+)$/.exec(a || '');
    if (!m || !W.ready) return false;
    const p = game.player, u = Number(m[1]), c = (p.bag || []).find((x) => x.u === u);
    if (!c) return true;
    const R = NC.Refine, I = R && R.info ? R.info(p, c) : { n: (c.ref || 0) + 1, safeTo: 99, chance: 0 };
    if ((c.ref || 0) >= 10) { toast('+10 เป็นขั้นสูงสุดแล้ว'); return true; }
    // a step that may fail badly: a second click within 3 s (as js/refine.js asks)
    if (I.n > I.safeTo && armedRef !== u) { armedRef = u; setTimeout(() => { if (armedRef === u) armedRef = 0; }, 3000); toast('กดอีกครั้งเพื่อตีบวก'); return true; }
    armedRef = 0;
    const safe = NC.refineSafe ? NC.refineSafe.get() : true;
    start('refine', { action: 'forge', kind: 'refine', copyId: u, useSafety: !!safe },
      { u, copy: JSON.parse(JSON.stringify(c)), before: { ref: c.ref || 0, n: I.n, safeTo: I.safeTo, chance: I.chance, stones: NC.matCount ? NC.matCount(p, 'mat_safety') : 0, last: null } });
    return true;
  }

  // ---------------- the forge's buttons ----------------
  const domOn = (sel) => document.querySelector(sel);
  let armedDrill = 0;
  function forgeClick(t, game) {
    if (!W.ready || !t) return null;
    const p = game.player;
    if (t.dataset && t.dataset.make) {
      const lockEl = document.querySelector('[data-lock].on');
      const lock = lockEl ? lockEl.dataset.lock || '' : '';
      craftTry(game, t.dataset.make, lock || null);
      return true;
    }
    if (t.id === 'fg-stone' || t.id === 'fg-drill') {
      const ce = domOn('.fg-copy.sel[data-copy]'), u = ce ? Number(ce.dataset.copy) : 0, c = (p.bag || []).find((x) => x.u === u);
      if (!c) { toast('เลือกอาวุธก่อน'); return true; }
      if (t.id === 'fg-drill') {
        if (armedDrill !== u) { armedDrill = u; setTimeout(() => { if (armedDrill === u) armedDrill = 0; }, 3000); toast('กดอีกครั้งเพื่อเจาะออฟ'); return true; }
        armedDrill = 0;
        start('drill', { action: 'forge', kind: 'drill', copyId: u }, { u, copy: JSON.parse(JSON.stringify(c)) });
        return true;
      }
      const re = domOn('.fg-row.sel[data-row]'), ke = domOn('[data-kind].on'), se = domOn('[data-sub].on');
      const row = re ? Number(re.dataset.row) : 0;
      if (!ke) { toast('เลือกชนิดออฟก่อน'); return true; }
      const a = { action: 'forge', kind: 'stone', copyId: u, row, optionKind: ke.dataset.kind };
      if (se && se.dataset.sub) a.optionSub = se.dataset.sub;
      start('stone', a, { u, row, copy: JSON.parse(JSON.stringify(c)) });
      return true;
    }
    return null; // (everything else: the forge's own, local choices)
  }
  function craftTry(game, id, lock) {
    const a = { action: 'forge', kind: 'craft', itemId: id };
    if (lock) a.optionKind = lock;
    return start('craft', a, { itemId: id });
  }

  // ---------------- the grade tab's ขัดเกรด (data-gtgo) ----------------
  let armedPolish = 0;
  function gradeClick(T) {
    if (T._online) return;
    const base = T.click;
    T.click = function (b, game) {
      if (!W.ready || !b || !b.dataset || !b.dataset.gtgo) return base.apply(this, arguments);
      const p = game.player, u = Number(b.dataset.gtgo), c = (p.bag || []).find((x) => x.u === u);
      if (!c) return true;
      const g = NC.Grade && NC.Grade.of ? NC.Grade.of(c) : c.g || 0;
      if (g >= 2 && armedPolish !== u) { armedPolish = u; setTimeout(() => { if (armedPolish === u) armedPolish = 0; }, 3000); return base.apply(this, arguments); } // (its own "กดอีกครั้ง")
      armedPolish = 0;
      if (NC.Grade && NC.Grade.disarm) NC.Grade.disarm(); // (the grade tab's own "กดอีกครั้ง" too: never its browser-side polish online)
      const sealEl = document.querySelector('[data-gtseal]'), seal = !!(sealEl && (sealEl.classList.contains('on') || sealEl.closest('.on')));
      start('polish', { action: 'forge', kind: 'polish', copyId: u, useSeal: seal },
        { u, copy: JSON.parse(JSON.stringify(c)), before: { g, seals: NC.matCount ? NC.matCount(p, 'mat_grade_seal') : 0 } });
      return true;
    };
    T._online = true;
  }

  // ---------------- install, after js/resultfx.js's own hooks (HUD.init) ----------------
  function install() {
    if (NC.invActs && !NC.invActs._online) { NC.invActs.unshift(refineAct); NC.invActs._online = true; }
    for (const T of NC.FORGE_TABS || []) if (T && T.click && /grade/.test(T.key || T.id || '')) gradeClick(T);
    const F = NC.Forge;
    if (F && F.click && !F._online) {
      const base = F.click;
      F.click = function (t, game) { const r = forgeClick(t, game); return r === null ? base.apply(this, arguments) : r; };
      const baseCraft = F.craft;
      if (baseCraft) F.craft = function (game, id, lock) { if (!W.ready) return baseCraft.apply(this, arguments); craftTry(game, id, lock); return null; };
      F._online = true;
    }
    const C = NC.Cook;
    if (C && C.cook && !C._online) {
      const bc = C.cook, be = C.eat;
      C.cook = function (game, id, n) { if (!W.ready) return bc.apply(this, arguments); start('cook', { action: 'cook', itemId: id, count: n === 5 ? 5 : 1 }, { itemId: id, count: n === 5 ? 5 : 1 }); return false; };
      C.eat = function (game, id) { if (!W.ready) return be.apply(this, arguments); start('eat', { action: 'eat', itemId: id }, { itemId: id }); return false; };
      C._online = true;
    }
    const B = NC.Brew;
    if (B && B.brew && !B._online) {
      const bb = B.brew;
      B.brew = function (game, id, batches) {
        if (!W.ready) return bb.apply(this, arguments);
        const P = B.plan ? B.plan(game.player, id, batches) : null;
        if (!P || !P.ok) { toast('วัสดุหรือเหรียญไม่พอ'); return false; }
        start('brew', { action: 'brew', itemId: id, count: batches, items: P.take.map((t) => t[0]).slice(0, 256) }, { itemId: id, count: batches });
        return false;
      };
      B._online = true;
    }
  }
  // the cookbook window's own buttons call its closures: caught before them
  document.addEventListener('click', (e) => {
    if (!W.ready) return;
    const b = e.target && e.target.closest && e.target.closest('button[data-cook], button[data-eat]');
    if (!b || b.disabled || !b.closest('.ck-book, .ck-root, #cookbook, [id^="ck-"]')) return;
    const win = b.closest('[id]') || document;
    if (b.dataset.eat) { e.stopPropagation(); NC.Cook.eat(NC.game, b.dataset.eat); return; }
    const eat = (win.querySelector && win.querySelector('[data-eat]')) || document.querySelector('.ck-eat[data-eat]');
    if (!eat) return;
    e.stopPropagation();
    NC.Cook.cook(NC.game, eat.dataset.eat, Number(b.dataset.cook));
  }, true);
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (g) { const r = baseInit(g); setTimeout(install, 0); return r; };
})();
