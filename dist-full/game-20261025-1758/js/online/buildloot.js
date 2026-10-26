/* online/buildloot.js — the build loot online (?online): the work is the server's (backend build_loot.go: action
   'buildloot'), the web only asks. Without this the web did it in its own pouch only, and the next snapshot put the pouch
   back as the server had it: the merge "did nothing" (bug 2026-10-19), and the same for every button of the tab below.
   - the skill runes: รวมรูน (kind combine: 3 of a tier into one of the next), จารึก / ถอด (socket / unsocket: a rune put
     into a skill's slot, taken out); the skill cards show the server's record (self.buildLoot.runes -> NC.BL.setRunes,
     js/bl_runes.js). The server also drops the runes.
   - the tab "ธาตุ · น้ำมัน" (js/bl_core.js, at Papa Moo and on the crafting window's page): สกัด / ทั้งหมด (extract
     {itemId, count}), ยางไม้มืด / น้ำค้างจันทร์ (sap / dew), ทำน้ำมัน / ทำกระสุน (oil / ammo {id: element}), ราดยางไม้มืด /
     ล้างรอย on a gear piece (taint / cleanse {copyId}: the piece picked in the list, its copy id is the server's).
   - the bag (I): ทาน้ำมัน (useOil: the server's buff bl_oil_<el>, 10 min), ใส่กระสุน / ถอดกระสุน (loadAmmo / unloadAmmo);
     the loaded ammo is the server's (self.buildLoot.ammoElement / ammoShots -> NC.BL.ammo, which the tab, the bag card
     and the buff row read).
   The windows keep their looks and their own checks; the click goes to the server instead, the result (js/resultfx.js's
   own look, or bl_core's own toast) is drawn from the server's next pouch / bag, and the windows are drawn again.
   Hooks, installed after js/resultfx.js's so they are the outermost: NC.FORGE_TABS' runes and bl tabs' click (the forge
   window and the crafting window's pages), NC.skillCardActs (data-blsock / data-blunsock) and NC.invActs (bl:oil /
   bl:ammo / bl:unload and the oil's / ammo's main button), first in their lists. Load after online/craft.js. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld;
  if (!O || !O.enabled || !W) return;
  const BL = () => NC.BL || {};
  const RF = () => NC.ResultFX || {};
  const ROMAN = ['', 'I', 'II', 'III'];
  const self = () => (W.snap && W.snap.self) || {};
  const mats = () => self().mats || {};
  const record = () => (self().buildLoot && self().buildLoot.runes) || {};
  const ammoOf = () => { const b = self().buildLoot || {}; return { el: b.ammoElement || null, shots: b.ammoShots | 0 }; };
  const taintOf = (u) => { const c = (Array.isArray(O.bag) ? O.bag : []).find((x) => x && x.u === u); return c ? c.taint || '' : null; };
  const toast = (t) => { const g = W.game; if (g && g.toast) g.toast(t); };
  const has = (id) => (W.game && NC.matCount ? NC.matCount(W.game.player, id) : 0);
  const ELTH = (el) => (BL().ELTH ? BL().ELTH(el) : el);
  // (js/bl_core.js rangedW: the weapons the ammo is for)
  const rangedW = (Wp) => !!Wp && (['arrow', 'bolt', 'throw'].includes(Wp.style) || Wp.shot === 'bullet' ||
    /bow|gun|pistol|rifle|kunai|shuriken|huuma|sling/.test((NC.wtypeOf && NC.wtypeOf(Wp)) || ''));
  let pending = null; // the try waiting for the server: { kind, action, at, mats, runes, ammo, taint, ... }

  function start(kind, action, info) {
    if (!W.ready) return false;
    if (pending && performance.now() - pending.at < 4000) { toast('รอผลครั้งก่อนสักครู่'); return false; }
    pending = Object.assign({ kind, action, at: performance.now(), mats: Object.assign({}, mats()), runes: JSON.stringify(record()), ammo: JSON.stringify(ammoOf()) }, info || {});
    if (pending.copyId) pending.taint = taintOf(pending.copyId);
    W.send(action);
    return true;
  }
  // the server's answer: an error ends the try; a 'character' notice waits for the next pouch / record / bag
  W.eventHooks.push((ev) => {
    if (!pending || !ev) return;
    const seq = W.commandSeq(pending.action);
    if (!seq || ev.seq !== seq) return;
    if (ev.type === 'error') {
      toast(ev.message || 'ทำไม่สำเร็จ');
      if (NC.HUD) NC.HUD.log(ev.message || 'ทำไม่สำเร็จ', 'warn');
      pending = null;
      redraw();
      return;
    }
    if (ev.type === 'character' && ev.action === 'buildloot') { pending.ok = true; pending.okAt = performance.now(); }
  });
  // has the server's record shown the try yet? (a piece's taint comes with the bag, the rest with the hero's record)
  function moved(d) {
    if (d.kind === 'taint' || d.kind === 'cleanse') return taintOf(d.copyId) !== d.taint;
    return JSON.stringify(mats()) !== JSON.stringify(d.mats) || JSON.stringify(record()) !== d.runes || JSON.stringify(ammoOf()) !== d.ammo;
  }
  setInterval(() => {
    if (!pending) return;
    if (!pending.ok) { if (performance.now() - pending.at > 6000) { pending = null; redraw(); } return; } // (no answer: let the next click go)
    if (!moved(pending) && performance.now() - pending.okAt < 1500) return;
    const d = pending;
    pending = null;
    mirror(); mirrorAmmo();
    try { result(d); } catch (e) { console.warn('online: build loot result', e); }
    redraw();
  }, 120);

  // what came of it: the popup / toast the offline windows show, from the server's pouch and bag
  const MADE = { extract: 'สกัด', sap: 'สกัด', dew: 'สกัด', oil: 'ทำน้ำมันเคลือบ', ammo: 'ทำกระสุน' };
  function result(d) {
    const R = BL().RUNES || {}, Rn = R[d.k] || {}, X = RF(), B = BL();
    if (d.kind === 'combine') {
      const id = 'bl_rune_' + d.k + '_' + (d.t + 1), got = (mats()[id] || 0) - (d.mats[id] || 0);
      if (got <= 0) return;
      if (X.show) X.show({ kind: 'rune', size: 'small', state: d.t + 1 >= 3 ? 'great' : 'ok', icon: X.matIcon ? X.matIcon(id) : '', color: d.t + 1 >= 3 ? '#ffc94d' : '#9fd8ff',
        kicker: 'รวมรูน', title: d.t + 1 >= 3 ? 'รูนขั้นสูงสุด!' : 'สำเร็จ!', name: `${X.matName ? X.matName(id) : id} ×${got}`, lines: [] });
      else toast(`ได้${Rn.n || 'รูน'} ${ROMAN[d.t + 1]}`);
    } else if (d.kind === 'socket') {
      toast(`จารึก${Rn.n || 'รูน'} ${ROMAN[d.t]} ลงสกิล ${(NC.SKILLS[d.id] || {}).name || d.id}`);
      if (NC.Lessons && NC.Lessons.ev) NC.Lessons.ev('runesock');
    } else if (MADE[d.kind]) {
      const now = mats(), got = Object.keys(now).filter((id) => (now[id] || 0) > (d.mats[id] || 0)).map((id) => [id, now[id] - (d.mats[id] || 0)]);
      if (!got.length) return;
      const [id, n] = got[0], name = (i) => (X.matName ? X.matName(i) : i);
      if (X.show) X.show({ kind: 'ess', size: 'small', state: 'ok', icon: X.matIcon ? X.matIcon(id) : '', color: '#9fd8ff', kicker: MADE[d.kind], title: 'สำเร็จ!',
        name: `${name(id)} ×${n}`, lines: got.slice(1, 3).map(([i2, n2]) => ({ t: `${name(i2)} ×${n2}` })) });
      else toast(`ได้${name(id)} ×${n}`);
    } else if (d.kind === 'taint') {
      const k = taintOf(d.copyId), T = (B.TRAITS || {})[k];
      if (T) toast(`แปดเปื้อน: ${T.name}`);
    } else if (d.kind === 'cleanse') {
      if (taintOf(d.copyId) === '') toast('ล้างรอยแปดเปื้อนแล้ว');
    } else if (d.kind === 'useOil') {
      const p = W.game && W.game.player;
      if ((mats()[B.OIL[d.el]] || 0) >= (d.mats[B.OIL[d.el]] || 0)) return;
      if (p && NC.VFX && NC.VFX.sparks) NC.VFX.sparks(p.x, p.y - 50, 18, '255,220,150', { size: 0.8 });
      toast(`ทาน้ำมันเคลือบ${ELTH(d.el)}แล้ว: อาวุธเป็นธาตุ${ELTH(d.el)} 10 นาที`);
    } else if (d.kind === 'loadAmmo') {
      const a = ammoOf(), p = W.game && W.game.player;
      if (a.el !== d.el) return;
      toast(`ใส่กระสุนธาตุ${ELTH(d.el)} (${a.shots} นัด)${p && rangedW(NC.ITEMS[p.equip.weapon]) ? '' : ' · ใช้กับอาวุธยิงไกลเท่านั้น'}`);
    }
  }
  // the windows drawn again with the server's pouch, record and bag
  function redraw() {
    try { if (NC.CraftGo && NC.CraftGo.isOpen() && NC.CraftGo.render) NC.CraftGo.render(); } catch (e) { /* closed */ }
    try { if (NC.Forge && NC.Forge.render) NC.Forge.render(); } catch (e) { /* closed */ }
    try { if (NC.HUD && NC.HUD.renderSkills) NC.HUD.renderSkills(); } catch (e) { /* closed */ }
    try { if (NC.invRefresh) NC.invRefresh(); } catch (e) { /* closed */ }
  }

  // ---------------- what is socketed: the server's record ----------------
  let lastRec = null;
  function mirror() {
    const B = BL(), rec = record(), j = JSON.stringify(rec);
    if (!B.setRunes || j === lastRec) return false;
    lastRec = j;
    const by = {};
    for (const id in rec) if (Array.isArray(rec[id])) by[id] = rec[id].slice(0, 2).map((r) => (typeof r === 'string' && r && B.RUNES[r.split(':')[0]] ? r : null));
    B.setRunes(by);
    return true;
  }
  // ---------------- the loaded ammo and the oil: the server's ----------------
  // (the server's count, every record: bl_core's own count per hit and its new pack when it runs out are the server's to make)
  function mirrorAmmo() {
    const ST = BL().ammo, g = W.game;
    if (!ST || !g || !g.player) return false;
    const a = ammoOf(), el = a.shots > 0 && (BL().ELS || []).includes(a.el) ? a.el : null, shots = el ? a.shots : 0;
    if (ST.el === el && ST.shots === shots) return false;
    const elWas = ST.el;
    ST.el = el; ST.shots = shots;
    if (elWas !== el) try { NC.applyGear(g); } catch (e) { /* the sheet is redone with the next record */ }
    return true;
  }
  // the oil's buff on the hero (the buff row, the element on the sheet): the server's time left, when its record has the
  // buffs (else the one the server answered: the full 10 min from the moment it did)
  const OIL_SEC = 600;
  function mirrorOil(s) {
    const g = W.game, p = g && g.player, B = BL();
    if (!p || !B.ELS || !NC.SkillKit) return;
    const sb = s && s.buffs && typeof s.buffs === 'object' ? s.buffs : null;
    if (!sb) return;
    let changed = false;
    if (!p.buffs) p.buffs = {};
    for (const el of B.ELS) {
      const id = 'bl_oil_' + el, left = Number(sb[id]) || 0, mine = p.buffs[id] || 0;
      if (left > 0 && Math.abs(left - mine) > 2) { p.buffs[id] = left; (p.buffLv || (p.buffLv = {}))[id] = 1; changed = true; }
      else if (left <= 0 && mine > 0) { p.buffs[id] = 0; changed = true; }
    }
    if (changed) try { NC.applyGear(g); } catch (e) { /* the sheet is redone with the next record */ }
  }
  W.selfHooks.push((s, first) => {
    if (first) lastRec = null;
    const a = mirror(), b = mirrorAmmo();
    mirrorOil(s);
    if ((a || b) && !pending) redraw();
  });

  // ---------------- the forge tabs: รวมรูน (runes), ธาตุ · น้ำมัน (bl) ----------------
  function runesClick(b) {
    const D = b.dataset;
    if (!D.blmerge) return null;
    const [k, tt] = D.blmerge.split(':'), t = Number(tt);
    if (!(t >= 1 && t < 3) || has('bl_rune_' + k + '_' + t) < 3) return true;
    start('combine', { action: 'buildloot', kind: 'combine', id: k + ':' + t }, { k, t });
    return true;
  }
  const RECIPE = { ess: 3, oil: { ess: 5, coins: 300 }, ammo: { ess: 2, coins: 200 }, sap: 10, dew: 10 };
  function blClick(b, game) {
    const D = b.dataset, B = BL(), p = game.player;
    if (D.blext || D.blextall) {
      const id = D.blext || D.blextall, count = D.blextall ? Math.floor(has(id) / RECIPE.ess) : 1;
      if (count < 1 || has(id) < count * RECIPE.ess) return true;
      start('extract', { action: 'buildloot', kind: 'extract', itemId: id, count: Math.min(1000, count) });
      return true;
    }
    if (D.blmake === 'sap' || D.blmake === 'dew') { start(D.blmake, { action: 'buildloot', kind: D.blmake }); return true; } // (the server counts the materials and the night)
    if (D.bloil || D.blammo) {
      const el = D.bloil || D.blammo, R = D.bloil ? RECIPE.oil : RECIPE.ammo, kind = D.bloil ? 'oil' : 'ammo';
      if (B.ESS && has(B.ESS[el]) < R.ess) return true;
      if ((p.coins || 0) < R.coins) return true;
      start(kind, { action: 'buildloot', kind, id: el });
      return true;
    }
    if (b.id === 'bl-sap' || b.id === 'bl-dew') {
      // (the piece picked in the list: bl_core keeps it to itself, the list shows it selected)
      const sel = (b.closest('.fg-wrap') || b.ownerDocument).querySelector('.fg-copy.sel[data-blpick]'), u = sel ? Number(sel.dataset.blpick) : 0;
      if (!u) return true;
      const sap = b.id === 'bl-sap';
      if (has(sap ? 'bl_dark_sap' : 'bl_moon_dew') <= 0 || (!sap && !taintOf(u))) return true;
      start(sap ? 'taint' : 'cleanse', { action: 'buildloot', kind: sap ? 'taint' : 'cleanse', copyId: u }, { copyId: u });
      return true;
    }
    return null; // (the tab's own: its sections, the pick)
  }
  function tabClick(T) {
    if (T._online) return;
    const base = T.click, mine = T.key === 'runes' ? runesClick : blClick;
    T.click = function (b, game) {
      if (!W.ready || !b || !b.dataset || !game || !game.player) return base.apply(this, arguments);
      const r = mine(b, game);
      return r === null ? base.apply(this, arguments) : r;
    };
    T._online = true;
  }

  // ---------------- จารึก / ถอด on the skill card (data-blsock / data-blunsock) ----------------
  function cardAct(game, b) {
    if (!W.ready || !b || !b.dataset) return false;
    const D = b.dataset, B = BL();
    if (D.blsock) {
      const [id, i, k, tt] = D.blsock.split(':'), row = Number(i), t = Number(tt), p = game.player;
      if (!B.fits || !B.fits(id, k) || NC.skillLv(p, id) < B.slotLv(id, row) || has('bl_rune_' + k + '_' + t) <= 0) return true;
      if (start('socket', { action: 'buildloot', kind: 'socket', skillId: id, row, id: k + ':' + t }, { id, k, t }) && B.unpick) B.unpick();
      return true;
    }
    if (D.blunsock) {
      const [id, i] = D.blunsock.split(':');
      start('unsocket', { action: 'buildloot', kind: 'unsocket', skillId: id, row: Number(i) }, { id });
      return true;
    }
    return false;
  }

  // ---------------- the bag: ทาน้ำมัน, ใส่กระสุน, ถอดกระสุน ----------------
  function bagAct(game, a, en) {
    if (!W.ready || !en || en.kind !== 'mat') return false;
    const B = BL(), ELS = B.ELS || [];
    let m = /^bl:(oil|ammo):(\w+)$/.exec(a || '');
    if (!m && a === 'main') {
      const o = ELS.find((x) => en.id === B.OIL[x]), am = ELS.find((x) => en.id === B.AMMO[x]);
      if (o) m = [0, 'oil', o]; else if (am) m = [0, 'ammo', am];
    }
    if (m && ELS.includes(m[2])) {
      const oil = m[1] === 'oil', el = m[2];
      if (has((oil ? B.OIL : B.AMMO)[el]) <= 0) return true;
      start(oil ? 'useOil' : 'loadAmmo', { action: 'buildloot', kind: oil ? 'useOil' : 'loadAmmo', id: el }, { el });
      return true;
    }
    if (a === 'bl:unload') { start('unloadAmmo', { action: 'buildloot', kind: 'unloadAmmo' }); return true; }
    return false;
  }

  // ---------------- install, after js/resultfx.js's own hooks (HUD.init) ----------------
  function install() {
    for (const T of NC.FORGE_TABS || []) if (T && T.click && (T.key === 'runes' || T.key === 'bl')) tabClick(T);
    const A = NC.skillCardActs;
    if (A && !A._online) { A.unshift(cardAct); A._online = true; }
    const I = NC.invActs;
    if (I && !I._blOnline) { I.unshift(bagAct); I._blOnline = true; }
    mirror(); mirrorAmmo(); mirrorOil(self());
  }
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (g) { const r = baseInit(g); setTimeout(install, 0); return r; };
})();
