/* social.js — people who need each other (the Game Bible, pillar 6): friends and the party board (J → เพื่อน).
     เพื่อน     heroes met online can be added; a friend's map shows when online; ไปหาเพื่อน takes the guiding flame there.
     หาปาร์ตี้  a flag in the presence ('pf'): who wants a party shows on the board.
   The guilds moved to js/guild.js (2026-10-01: shared on NC.Store, the guild window O) and the party to
   js/partynet.js (real players). Saved: nightcamp.social.v1 (the old local guild in it is no longer read).
   Hooks: NC.Hub's page, NC.Net fields / hooks. */
(function () {
  'use strict';
  const NC = window.NC, MAT = NC.MATERIALS, H = NC.Hub;
  if (!H) return;
  const esc = H.esc, fmt = (n) => NC.fmtCoins(n), KEY = 'nightcamp.social.v1';
  const G = () => NC.game;
  const weekNo = () => Math.floor((Date.now() / 86400000 + 3) / 7);
  let st = { friends: [], guild: null, pf: false };
  try { if (!NC.ONLINE) st = Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* blocked */ }
  const save = () => { if (G() && G().noSave) return; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* blocked */ } };
  const me = () => (G() && G().player && G().player.name) || 'คุณ';

  // ---------------- online: the party board flag ----------------
  if (NC.Net) {
    NC.Net.fields.push({ key: 'pf', get: () => (st.pf ? 1 : null) });
    NC.Net.hooks.push((r, pr) => { r.pf = !!pr.pf; });
  }

  // ---------------- friends ----------------
  const online = () => (NC.Net && NC.Net.remotes ? [...NC.Net.remotes.values()] : []);
  function addFriend(name) { if (!st.friends.includes(name)) { st.friends.push(name); save(); NC.HUD.log(`เพิ่ม ${name} เป็นเพื่อนแล้ว`, 'item'); } }

  // ---------------- the page ----------------
  function renderFriends(el, game) {
    const on = online(), p = game.player;
    let h = `<div class="bb-h">เพื่อน · หาปาร์ตี้ <small>ออนไลน์ ${on.length} คน</small></div>` +
      `<div class="bb-form"><button class="kw-btn ${st.pf ? 'gold' : 'blue'}" data-pf="1">${st.pf ? '✔ กำลังหาปาร์ตี้ (กดเพื่อยกเลิก)' : 'ขึ้นป้ายหาปาร์ตี้'}</button></div>`;
    const pf = on.filter((r) => r.pf);
    if (pf.length) h += '<div class="bb-h2">คนที่กำลังหาปาร์ตี้</div><div class="bb-list">' + pf.map((r) => `<div class="bb-row on"><div class="t"><b>${esc(r.name)}</b><small>Lv ${r.lv} · ${esc((NC.JOBS[r.job] || {}).name || '')} · ${esc((NC.MAPS[r.map] || {}).name || r.map || '')}</small></div></div>`).join('') + '</div>';
    h += '<div class="bb-h2">เพื่อน</div>' + (st.friends.length ? '<div class="bb-list">' + st.friends.map((n) => {
      const r = on.find((x) => x.name === n);
      return `<div class="bb-row ${r ? 'on' : 'done'}"><img src="${H.icon('ic_friends')}" alt=""><div class="t"><b>${esc(n)}</b><small>${r ? `ออนไลน์ · Lv ${r.lv} · ${esc((NC.MAPS[r.map] || {}).name || '')}` : 'ออฟไลน์'}</small></div>` +
        (r && r.map && r.map !== game.mapId && NC.Econ ? `<button class="kw-btn gold" data-go="${esc(r.map)}">ไปหาเพื่อน</button>` : '') + `<button class="kw-btn grey" data-unf="${esc(n)}">ลบ</button></div>`;
    }).join('') + '</div>' : '<div class="bb-sub">ยังไม่มีเพื่อน · คนที่ออนไลน์อยู่จะอยู่ด้านล่าง</div>');
    const others = on.filter((r) => !st.friends.includes(r.name));
    h += '<div class="bb-h2">คนที่ออนไลน์อยู่ตอนนี้</div>' + (others.length ? '<div class="bb-list">' + others.map((r) => `<div class="bb-row"><div class="t"><b>${esc(r.name)}</b><small>Lv ${r.lv}${r.gu ? ' · «' + esc(r.gu[1]) + '»' : ''}</small></div><button class="kw-btn blue" data-add="${esc(r.name)}">เพิ่มเพื่อน</button></div>`).join('') + '</div>'
      : '<div class="bb-empty">ตอนนี้ไม่มีใครออนไลน์ (เล่นผ่านลิงก์ออนไลน์ของเกมเพื่อเจอคนอื่น)</div>');
    h += '<div class="bb-note">กระซิบ: พิมพ์ /w ชื่อ ข้อความ ในแชท · ชวนปาร์ตี้ได้ที่หน้าต่างปาร์ตี้ (P)</div>';
    el.innerHTML = h;
  }
  H.add({ id: 'friends', name: 'เพื่อน', icon: 'ic_friends', order: 65, render: renderFriends,
    click(e, game) {
      const pf = e.target.closest('[data-pf]'); if (pf) { st.pf = !st.pf; save(); return true; }
      const a = e.target.closest('[data-add]'); if (a) { addFriend(a.dataset.add); return true; }
      const u = e.target.closest('[data-unf]'); if (u) { st.friends = st.friends.filter((n) => n !== u.dataset.unf); save(); return true; }
      const go = e.target.closest('[data-go]'); if (go && NC.Econ) { NC.Econ.warp(game, go.dataset.go); return false; }
      return false;
    } });
  NC.Social = { state: st, addFriend }; // (addFriend: js/playermenu.js, a click on a hero's เพิ่มเพื่อน)
})();
