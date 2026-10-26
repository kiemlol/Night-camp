/* online/lobby.js — the online game's front door (?online): a full-screen CHARACTER SELECT over the paused world
   (mockup A "campfire circle", the user's pick 2026-10-18; css/charsel.css, the stage in online/charsel.js). It
   connects to the Go server, shows the account (this browser's own device account, or a username / beta key logged
   in here) in the top-right chip, signs up / logs in in a K window when asked, and stands the account's three hero
   slots (nc_characters) around the campfire: click one to pick it (its card on the right: level, job, map, power,
   last played, gear), double-click / เข้าเล่น / Enter plays it (nc_character_slot + nc_join). An empty slot opens the
   game's own character creator (js/creator.js); its เริ่มผจญภัย sends the name and the look to nc_character_create
   instead of saving locally. ลบตัวละคร opens the delete window (mockup E): what goes with the hero and what stays,
   and the hero's name typed exactly before ลบถาวร works (the server checks the name too: nc_character_slot delete).
   When the first snapshot has filled the world (online/world.js) the screen goes. A lost connection shows here again.
   During the beta the door is KEY ONLY (below): the key window comes first, the username / guest ways are switched off. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online;
  if (!O || !O.enabled) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CS = NC.CharSel;
  // KEY ONLY (the user 2026-10-18: "เอาระบบล็อกอินธรรมดา ปิดไว้ก่อนเเล้วเอาระบบ ล็อกอินด้วย key ... มาใส่เเทน"): the front door asks for a
  // beta key (the server's login_keys.go: Nakama's custom sign-in, a bound key opens its own account on any device); no
  // device account, no username / password, no guest, no sign-up. Those stay below, switched off
  // for good (2026-10-21: no address switch brings them back).
  const KEY_ONLY = (O.keyOnly = true);
  let root = null, game = null, slots = null, creating = null, entered = false, sel = 0, busy = false;

  function build() {
    root = document.createElement('div');
    root.className = 'cs-root';
    root.innerHTML = `
      <canvas class="cs-stage"></canvas>
      <img class="cs-logo" src="assets/loading/logo.png" alt="Night Camp">
      <div class="cs-acct">
        <div class="cs-acct-t"><div class="cs-acct-name"></div><div class="cs-srv"><i></i><span></span></div></div>
        <div class="cs-acct-btns">
          <button class="kw-btn blue cs-login">เข้าสู่ระบบ</button>
          <button class="kw-btn gold cs-signup">สมัครสมาชิก</button>
          <button class="kw-btn grey cs-guest" hidden>เล่นแบบผู้มาเยือน</button>
          <button class="kw-btn grey cs-logout" hidden>ออกจากระบบ</button>
        </div>
      </div>
      <div class="cs-msg kw-info" hidden><span class="i">i</span><span class="cs-msg-t"></span></div>
      <div class="cs-plates"></div>
      <div class="cs-card kw-win" hidden>
        <div class="kw-title"><span class="cs-card-name"></span></div>
        <div class="cs-card-body">
          <div class="cs-card-top">
            <div class="cs-port"><canvas width="220" height="260"></canvas></div>
            <div class="cs-facts"></div>
          </div>
          <div class="cs-gear"></div>
        </div>
      </div>
      <div class="cs-bar">
        <button class="kw-btn cs-delbtn"><img src="assets/charsel/trash.png" alt="">ลบตัวละคร</button>
        <button class="kw-btn gold cs-play">เข้าเล่น</button>
        <div class="cs-count"></div>
      </div>
      <div class="cs-hint">ดับเบิลคลิกที่ตัวละครเพื่อเข้าเล่น · Enter: เข้าเล่น · ← →: เลือกตัว</div>
      <a class="cs-offline" href="?">เล่นแบบออฟไลน์</a>
      <div class="cs-copy">© 2026 Night Camp<span class="cs-copy-x">. Original content rights reserved.</span></div>
      <div class="cs-modal cs-keybox" hidden>
        <form class="kw-win cs-keywin" autocomplete="off">
          <div class="kw-title"><span>เข้าสู่ระบบด้วยคีย์</span></div>
          <div class="cs-key-body">
            <div class="cs-key-sub">ช่วงทดสอบเบต้า เข้าเล่นได้ด้วยคีย์ที่ได้รับเท่านั้น</div>
            <div class="cs-key-srv">เซิร์ฟเวอร์ <b></b></div>
            <div class="cs-key-warn" hidden></div>
            <label class="cs-key-l" for="cs-key-in">คีย์เบต้า</label>
            <input id="cs-key-in" class="cs-key-in" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" maxlength="40" spellcheck="false" autocapitalize="characters">
            <div class="cs-key-meta"><span class="cs-key-n">0 / 20</span><span>พิมพ์เล็ก/ใหญ่ ขีด เว้นวรรค ได้หมด · O = 0, I และ L = 1</span></div>
            <div class="cs-err cs-key-err"></div>
            <button type="submit" class="kw-btn gold cs-key-go" disabled>เข้าเกม</button>
            <div class="cs-key-foot">คีย์จะถูกจำไว้ในเครื่องนี้ ครั้งต่อไปเข้าได้เลย · ออกจากระบบเพื่อใช้คีย์อื่น</div>
          </div>
        </form>
      </div>
      <div class="cs-modal cs-loginbox" hidden>
        <form class="kw-win cs-form" autocomplete="on">
          <div class="kw-title"><span class="cs-form-title"></span><button type="button" class="kw-x cs-cancel" aria-label="ปิด">✕</button></div>
          <div class="cs-form-body">
            <div class="cs-form-sub"></div>
            <input class="cs-user" placeholder="ชื่อผู้ใช้ (a-z 0-9 _ ยาว 4-16)" autocomplete="username" maxlength="16">
            <input class="cs-pass" type="password" placeholder="รหัสผ่าน (8-64 ตัว)" autocomplete="current-password" maxlength="64">
            <input class="cs-key" placeholder="คีย์เบต้า XXXXX-XXXXX-XXXXX-XXXXX" maxlength="32" hidden>
            <div class="cs-err"></div>
            <div class="cs-form-btns">
              <button type="submit" class="kw-btn blue cs-ok">ตกลง</button>
              <button type="button" class="kw-btn grey cs-keymode">ใช้คีย์เบต้า</button>
            </div>
          </div>
        </form>
      </div>
      <div class="cs-modal cs-del" hidden>
        <div class="kw-win cs-delwin" role="dialog" aria-label="ลบตัวละคร">
          <div class="kw-title cs-redtitle"><span>ลบตัวละคร</span><button class="kw-x cs-del-x" aria-label="ปิด">✕</button></div>
          <div class="cs-del-body">
            <div class="cs-del-port"><canvas width="300" height="400"></canvas><div class="cs-del-cap"></div></div>
            <div class="cs-del-r">
              <div class="cs-del-q"></div>
              <div class="kw-card cs-del-lost">
                <div class="cs-del-h">สิ่งที่หายไปกับตัวละครนี้</div>
                <div class="cs-del-row"><img src="assets/ic_bag.png" alt="">กระเป๋า อุปกรณ์ และเหรียญ</div>
                <div class="cs-del-row"><img src="assets/ic_skills.png" alt="">สกิล เควส และอาชีพเสริม</div>
                <div class="cs-del-row"><img src="assets/kui/st_atk.png" alt=""><span class="cs-del-pow"></span></div>
                <div class="cs-del-kept"></div>
              </div>
              <label class="cs-del-l" for="cs-del-in">พิมพ์ชื่อตัวละครเพื่อยืนยัน</label>
              <div class="cs-del-field"><input id="cs-del-in" class="cs-del-in" autocomplete="off" spellcheck="false" maxlength="24"><span class="cs-del-ghost"></span></div>
              <div class="cs-err cs-del-err"></div>
              <div class="cs-del-btns">
                <button class="kw-btn red cs-del-go" disabled>ลบถาวร</button>
                <button class="kw-btn grey cs-del-no">ยกเลิก</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(root);
    $('.cs-srv span', root).textContent = 'เซิร์ฟเวอร์ ' + O.origin.replace(/^https?:\/\//, '');
    CS.mount($('.cs-stage', root));
    $('.cs-login', root).onclick = () => form('login');
    $('.cs-signup', root).onclick = () => form('signup');
    $('.cs-logout', root).onclick = async () => { await O.logout(); restart(); };
    // a device account plays as a guest only once it says so (backend account_guest.go): no trading until it signs up
    $('.cs-guest', root).onclick = async () => { try { await O.rpc('nc_account', { action: 'guest' }); restart(); } catch (e) { msg(words(e), true); } };
    $('.cs-cancel', root).onclick = () => { $('.cs-loginbox', root).hidden = true; };
    $('.cs-keymode', root).onclick = () => form(formMode === 'key' ? 'login' : 'key');
    $('.cs-form', root).onsubmit = (ev) => { ev.preventDefault(); submit(); };
    $('.cs-key-in', root).oninput = keyTyped;
    $('.cs-keywin', root).onsubmit = (ev) => { ev.preventDefault(); submitKey(); };
    $('.cs-play', root).onclick = () => act(sel);
    $('.cs-delbtn', root).onclick = () => askDelete(sel);
    $('.cs-del-x', root).onclick = $('.cs-del-no', root).onclick = () => closeDelete();
    $('.cs-del-in', root).oninput = delCheck;
    $('.cs-del-in', root).onkeydown = (e) => { if (e.key === 'Enter' && !$('.cs-del-go', root).disabled) doDelete(); };
    $('.cs-del-go', root).onclick = doDelete;
    // the heroes on the stage: hover rings them blue, a click picks, a double-click plays
    const stage = $('.cs-stage', root);
    stage.addEventListener('pointermove', (e) => { const i = filledAt(e); CS.hover(i === sel ? -1 : i); stage.style.cursor = i >= 0 ? 'pointer' : ''; });
    stage.addEventListener('pointerleave', () => CS.hover(-1));
    stage.addEventListener('click', (e) => { const i = filledAt(e); if (i >= 0) pick(i); });
    stage.addEventListener('dblclick', (e) => { const i = filledAt(e); if (i >= 0) act(i); });
    // keys typed here never reach the game: arrows pick, Enter plays, Delete asks, Esc closes a window
    root.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') { closeDelete(); $('.cs-loginbox', root).hidden = true; } return; }
      if (e.key === 'Escape') { closeDelete(); $('.cs-loginbox', root).hidden = true; return; }
      if (e.key === 'Enter' && !$('.cs-keybox', root).hidden) { submitKey(); e.preventDefault(); return; }
      if (modalOpen() || !slots) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { pick((sel + (e.key === 'ArrowLeft' ? 2 : 1)) % 3); e.preventDefault(); }
      else if (e.key === 'Enter') { act(sel); e.preventDefault(); }
      else if (e.key === 'Delete') askDelete(sel);
    });
    root.tabIndex = -1;
    addEventListener('resize', place);
  }
  const filledAt = (e) => { const r = e.currentTarget.getBoundingClientRect(), i = CS.hit(e.clientX - r.left, e.clientY - r.top); return slots && slots.slots[i] && !slots.slots[i].empty ? i : -1; };
  const modalOpen = () => !$('.cs-del', root).hidden || !$('.cs-loginbox', root).hidden || !$('.cs-keybox', root).hidden;
  const show = (on) => {
    if (root) { root.hidden = !on; if (on) { CS.start(); place(); setTimeout(() => { if (!modalOpen()) root.focus({ preventScroll: true }); }, 0); } }
    if (game) game.paused = !!on || (NC.Creator && NC.Creator.isOpen);
  };
  // a line under the logo while connecting / loading / on an error; nothing while the heroes simply wait
  const msg = (t, bad) => { const m = $('.cs-msg', root); $('.cs-msg-t', m).textContent = t || ''; m.hidden = !t; m.classList.toggle('bad', !!bad); };

  let formMode = 'login';
  function form(mode) {
    formMode = mode;
    const box = $('.cs-loginbox', root), f = $('.cs-form', root);
    box.hidden = false;
    $('.cs-err', f).textContent = '';
    $('.cs-form-title', f).textContent = mode === 'signup' ? 'สมัครสมาชิก' : mode === 'key' ? 'คีย์เบต้า' : 'เข้าสู่ระบบ';
    $('.cs-form-sub', f).textContent = mode === 'signup' ? 'ตั้งชื่อผู้ใช้และรหัสผ่าน ตัวละครของเครื่องนี้ไปอยู่ในบัญชีด้วย' : mode === 'key' ? 'เข้าเล่นด้วยคีย์เบต้าที่ได้รับ' : 'เข้าสู่ระบบด้วยชื่อผู้ใช้';
    $('.cs-user', f).hidden = $('.cs-pass', f).hidden = mode === 'key';
    $('.cs-key', f).hidden = mode !== 'key';
    $('.cs-keymode', f).textContent = mode === 'key' ? 'ใช้ชื่อผู้ใช้' : 'ใช้คีย์เบต้า';
    $('.cs-keymode', f).hidden = mode === 'signup';
    $('.cs-pass', f).autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    setTimeout(() => (mode === 'key' ? $('.cs-key', f) : $('.cs-user', f)).focus(), 0);
  }
  async function submit() {
    const f = $('.cs-form', root), err = $('.cs-err', f);
    const user = $('.cs-user', f).value.trim().toLowerCase(), pass = $('.cs-pass', f).value;
    err.textContent = '';
    try {
      if (formMode === 'key') await O.loginKey($('.cs-key', f).value);
      else {
        if (!/^[a-z0-9_]{4,16}$/.test(user)) throw new Error('ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 และ _ ยาว 4-16 ตัว');
        if (pass.length < 8 || pass.length > 64) throw new Error('รหัสผ่านต้องยาว 8-64 ตัว');
        if (formMode === 'signup') await O.rpc('nc_account', { action: 'register', username: user, password: pass });
        else await O.loginUsername(user, pass);
      }
      $('.cs-loginbox', root).hidden = true;
      restart();
    } catch (e) { err.textContent = words(e); }
  }
  // the server's refusals in the player's words (English ones from account.go / character_slots.go mapped; Thai ones as they are)
  function words(e) {
    const m = (e && e.message) || String(e || '');
    // a new hero's name and look (backend character_customization.go, wordfilter.go, character_create.go)
    if (/blocked word/i.test(m)) return 'ชื่อนี้มีคำไม่สุภาพ ตั้งชื่ออื่นนะ';
    if (/name is reserved/i.test(m)) return 'ชื่อนี้มีคำสงวน (เช่น GM แอดมิน ทีมงาน ชื่อเกม) ตั้งชื่ออื่นนะ';
    if (/name must be/i.test(m)) return 'ชื่อต้องยาว 2–16 ตัวอักษร';
    if (/invalid name/i.test(m)) return 'ชื่อมีตัวอักษรที่ใช้ไม่ได้';
    if (/invalid appearance/i.test(m)) return 'หน้าตาที่เลือกใช้ไม่ได้ ลองเลือกใหม่';
    if (/slot is taken/i.test(m)) return 'ช่องนี้มีตัวละครแล้ว';
    if (/name is taken/i.test(m)) return 'ชื่อนี้มีคนใช้แล้ว ลองชื่ออื่นนะ'; // (no two heroes share a name: tools/online/patches/001_hero_name_unique.patch)
    if (/wait before changing/i.test(m)) return 'เพิ่งเปลี่ยนไป รอสักครู่แล้วลองใหม่';
    if (/invalid create request/i.test(m)) return 'สร้างตัวละครไม่สำเร็จ ลองใหม่อีกครั้ง';
    if (/invalid credentials|not found|401/i.test(m) || (e && e.status === 401)) return 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
    if (/taken|exists|in use/i.test(m)) return 'ชื่อผู้ใช้นี้มีคนใช้แล้ว';
    if (/content|protocol|update required/i.test(m)) return 'เกมเวอร์ชันนี้ไม่ตรงกับเซิร์ฟเวอร์ (รีเฟรชหน้าเว็บ)';
    if (/name does not match/i.test(m)) return 'ชื่อไม่ตรงกับตัวละคร';
    if (/still in play/i.test(m)) return 'ตัวละครยังอยู่ในเกม รอสักครู่แล้วลองใหม่';
    if (/no character in that slot/i.test(m)) return 'ช่องนี้ไม่มีตัวละครแล้ว';
    return m;
  }

  // ---------------- the key window (KEY_ONLY) ----------------
  const KEY_ABC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // (Crockford's base 32, as the server's normalizeLoginKey)
  function keyChars(t) {
    let out = '';
    for (let c of String(t || '').toUpperCase()) {
      if (c === 'O') c = '0'; else if (c === 'I' || c === 'L') c = '1';
      if (KEY_ABC.includes(c) && out.length < 20) out += c;
    }
    return out;
  }
  // typed or pasted: the key shown in groups of five, the button once all 20 are in
  function keyTyped() {
    const inp = $('.cs-key-in', root), raw = keyChars(inp.value);
    const shown = raw.replace(/(.{5})(?=.)/g, '$1-');
    if (inp.value !== shown) { inp.value = shown; inp.setSelectionRange(shown.length, shown.length); }
    $('.cs-key-n', root).textContent = raw.length + ' / 20';
    $('.cs-key-n', root).classList.toggle('ok', raw.length === 20);
    $('.cs-key-go', root).disabled = busy || raw.length !== 20;
    $('.cs-key-err', root).textContent = '';
  }
  function keyScreen(why) {
    const box = $('.cs-keybox', root);
    slots = null; render();
    msg('');
    box.hidden = false;
    root.classList.add('keyed');
    keyTyped();
    $('.cs-key-err', box).textContent = why || '';
    // which server gets the key (a key typed into a stranger's server is theirs): its host, and a link's refused one
    $('.cs-key-srv b', box).textContent = O.origin.replace(/^https?:\/\//, '');
    const warn = $('.cs-key-warn', box);
    warn.hidden = !O.refusedServer;
    if (O.refusedServer) warn.textContent = 'ลิงก์นี้พยายามเปลี่ยนเซิร์ฟเวอร์เป็น ' + O.refusedServer.replace(/^https?:\/\//, '') + ' เกมไม่ได้ใช้ (อย่าใส่คีย์ในเว็บที่ไม่รู้จัก)';
    setTimeout(() => $('.cs-key-in', box).focus(), 0);
  }
  async function submitKey() {
    const go = $('.cs-key-go', root), raw = keyChars($('.cs-key-in', root).value);
    if (busy || raw.length !== 20) return;
    busy = true; go.disabled = true; go.textContent = 'กำลังตรวจคีย์…';
    try {
      await O.loginKey(raw);
      busy = false; go.textContent = 'เข้าเกม';
      $('.cs-keybox', root).hidden = true; root.classList.remove('keyed');
      $('.cs-key-in', root).value = '';
      restart();
    } catch (e) {
      busy = false; go.textContent = 'เข้าเกม';
      keyTyped();
      const m = (e && e.message) || '';
      $('.cs-key-err', root).textContent = (e && e.status === 401) || /401|not found|invalid/i.test(m) ? 'คีย์ไม่ถูกต้อง ตรวจตัวอักษรอีกครั้ง' : words(e);
      const inp = $('.cs-key-in', root); inp.focus(); inp.select(); // (the button went disabled while checking: the field takes the keys again)
    }
  }

  function accountRow() {
    const a = O.account || {};
    const kind = a.kind === 'username' ? 'บัญชี: <b>' + esc(a.name) + '</b>' : a.kind === 'key' ? '<b>' + esc(a.name) + '</b>' : '<b>ผู้มาเยือน</b> <span class="cs-acct-x">(บัญชีของเบราว์เซอร์นี้)</span>';
    $('.cs-acct-name', root).innerHTML = kind;
    $('.cs-login', root).hidden = a.kind === 'username' || a.kind === 'key';
    $('.cs-signup', root).hidden = a.kind !== 'device';
    $('.cs-logout', root).hidden = a.kind === 'device';
    if (KEY_ONLY) { // (only the key and ออกจากระบบ; no chip before a key is in)
      $('.cs-acct', root).hidden = a.kind !== 'key';
      $('.cs-login', root).hidden = $('.cs-signup', root).hidden = $('.cs-guest', root).hidden = true;
      $('.cs-logout', root).hidden = false;
    }
  }

  // ---------------- the hero slots ----------------
  const jobName = (id) => (NC.JOBS && NC.JOBS[id] && NC.JOBS[id].name) || id || 'นักเดินทาง';
  const mapName = (id) => (NC.MAPS && NC.MAPS[id] && NC.MAPS[id].name) || id || '';
  const filled = () => (slots ? slots.slots.filter((s) => !s.empty) : []);
  const eqOf = (s) => { try { return s && !s.empty && NC.OnlineWorld ? NC.OnlineWorld.equipOf(s.equip, s.look, s.appearance) : null; } catch (e) { return null; } };
  function ago(ms) {
    if (!ms) return '';
    const m = Math.max(0, (Date.now() - ms) / 60000);
    if (m < 2) return 'เมื่อสักครู่';
    if (m < 60) return Math.floor(m) + ' นาทีที่แล้ว';
    if (m < 60 * 24) return Math.floor(m / 60) + ' ชม. ที่แล้ว';
    return Math.floor(m / 1440) + ' วันที่แล้ว';
  }
  const GEAR = [['weapon', 'อาวุธ'], ['hat', 'หมวก'], ['top', 'เสื้อ'], ['pants', 'กางเกง'], ['cape', 'ผ้าคลุม'], ['acc1', 'เครื่องประดับ']];
  const RBG = { common: '#f3ead6', rare: '#cfe6ff', epic: '#e3d2ff', legend: '#ffe7a6', fashion: '#ffd6ec' };

  function render() {
    const list = slots ? slots.slots : [];
    CS.set(list, list.map(eqOf));
    CS.select(sel);
    const s = list[sel];
    // the card on the right
    const card = $('.cs-card', root);
    card.hidden = !s;
    if (s) {
      $('.cs-card-name', card).textContent = s.empty ? 'ช่อง ' + (s.slot + 1) : s.name;
      const facts = $('.cs-facts', card);
      if (s.empty) facts.innerHTML = '<div class="cs-lv">ช่องนี้ยังว่าง</div><div class="cs-sub">สร้างนักเดินทางคนใหม่ได้เลย<br>บัญชีหนึ่งมีได้ 3 ตัว</div>';
      else facts.innerHTML = `<div class="cs-lv">Lv ${s.lv | 0} · ${esc(jobName(s.job))}</div><div class="cs-sub">Job Lv ${s.jobLv | 0}</div>
        <div class="cs-fact"><img src="assets/craftgo/cg_pin.png" alt="">${esc(mapName(s.mapId))}</div>
        <div class="cs-fact"><img src="assets/kui/st_atk.png" alt="">พลัง ${(s.power | 0).toLocaleString('en-US')}</div>
        ${s.savedAt ? `<div class="cs-fact"><img src="assets/gwar/gwi_time.png" alt="">เล่นล่าสุด ${ago(s.savedAt)}</div>` : ''}`;
      card.classList.toggle('empty', !!s.empty);
      const gear = $('.cs-gear', card);
      gear.innerHTML = '';
      gear.hidden = !!s.empty;
      if (!s.empty) for (const [slot, label] of GEAR) {
        const id = s.equip && s.equip[slot], it = id && NC.ITEMS[id];
        const b = document.createElement('div');
        b.className = 'cs-gslot' + (it ? '' : ' none');
        b.title = it ? it.name : label + ': ว่าง';
        if (it) {
          b.style.background = RBG[it.rarity] || RBG.common;
          const c = document.createElement('canvas'); c.width = c.height = 96;
          try { c.getContext('2d').drawImage(NC.itemIcon(id, 96), 0, 0); } catch (e) { /* an item this build cannot draw */ }
          b.appendChild(c);
        }
        gear.appendChild(b);
      }
      portrait($('.cs-port canvas', card), s, false);
    }
    // the bar
    const play = $('.cs-play', root), del = $('.cs-delbtn', root);
    play.textContent = s && s.empty ? 'สร้างตัวละคร' : 'เข้าเล่น';
    play.disabled = busy || !s;
    del.hidden = !s || s.empty;
    del.disabled = busy;
    $('.cs-count', root).textContent = slots ? `ตัวละคร ${filled().length} / ${slots.max || 3}` : '';
    plates();
  }
  // the hero standing in a box (the card's portrait, the delete window's)
  const portraits = new WeakMap();
  function portrait(cv, s, grey) {
    const eq = eqOf(s);
    portraits.set(cv, eq);
    drawPortrait(cv, eq, grey);
    const sp = NC.Sprites;
    if (!eq || !sp || !sp.of) return;
    const names = sp.of.scan(eq);
    if (sp.missing(names)) sp.need(names, 0).then(() => {
      // A slot may have changed while its outfit was streaming; only repaint the current look.
      if (cv.isConnected && portraits.get(cv) === eq) drawPortrait(cv, eq, grey);
    });
  }
  function drawPortrait(cv, eq, grey) {
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!eq) return;
    const x = cv.width / 2, y = cv.height - 18, sc = cv.height / 150;
    ctx.fillStyle = 'rgba(42,36,53,0.16)'; ctx.beginPath(); ctx.ellipse(x, y, 30 * sc, 7 * sc, 0, 0, Math.PI * 2); ctx.fill();
    try {
      const o = { t: 0.4, clip: 'idle', face: 1, key: cv };
      if (grey) o.tint = ['#8a8798', 0.45];
      if (NC.HeroSpine && NC.HeroSpine.preview && NC.HeroSpine.preview(ctx, eq, x, y, sc, o)) return;
      const P = NC.Anim.sample('idle', 0.4, NC.animCtx(eq, { al: 0, walk: 0, moving: false, hurt: 0, idleStyle: 'idle', ready: 'ready' }));
      P.face = 1;
      NC.drawHero(ctx, eq, P, x, y, { scale: sc });
    } catch (e) { /* a look this build cannot draw */ }
  }
  // the name plates over the heroes' heads; an empty slot's plate holds its สร้างตัวละคร button
  function plates() {
    const box = $('.cs-plates', root);
    box.innerHTML = '';
    if (!slots) return;
    for (const s of slots.slots) {
      const el = document.createElement('div');
      el.className = 'cs-plate' + (s.empty ? ' empty' : '') + (s.slot === sel ? ' on' : '');
      el.dataset.slot = s.slot;
      if (s.empty) el.innerHTML = '<div class="cs-plate-n">ช่องว่าง</div><button class="kw-btn gold">สร้างตัวละคร</button>';
      else el.innerHTML = `<div class="cs-plate-n">${esc(s.name)}</div><div class="cs-plate-s">Lv ${s.lv | 0} ${esc(jobName(s.job))}</div>`;
      el.onclick = (e) => { if (s.empty && e.target.closest('button')) act(s.slot); else pick(s.slot); };
      if (!s.empty) el.ondblclick = () => act(s.slot);
      box.appendChild(el);
    }
    place();
  }
  function place() {
    if (!root || root.hidden) return;
    CS.resize();
    for (const el of root.querySelectorAll('.cs-plate')) {
      const i = +el.dataset.slot, p = CS.spot(i), s = slots && slots.slots[i];
      el.style.left = p.x + 'px';
      // (an empty slot's plate hangs from its top: by the log seat (slot 3) the pill over the log and the button before it,
      //  elsewhere the two stacked where a hero's plate would be). Not plain 'log': the HUD's combat log rule (css/style.css .log)
      //  stretched a hero's plate on slot 3 into a tall empty box past the top edge (bug report v0.5.3, 2026-10-19).
      el.classList.toggle('cs-bylog', i === 2 && !!(s && s.empty));
      el.style.top = (s && s.empty ? p.y - (i === 2 ? 255 : 232) * p.k : p.top) + 'px';
    }
  }
  function pick(i) {
    if (!slots || !slots.slots[i]) return;
    sel = i; CS.hover(-1);
    render();
  }
  // เข้าเล่น on a hero, สร้างตัวละคร on an empty slot
  const act = (i) => { if (busy || !slots || !slots.slots[i]) return; if (slots.slots[i].empty) create(i); else enter(i); };

  async function loadSlots(again) {
    msg('กำลังโหลดตัวละคร…');
    try {
      slots = await O.characters();
      const first = slots.slots.find((s) => !s.empty);
      sel = slots.slots[slots.active] && !slots.slots[slots.active].empty ? slots.active : first ? first.slot : 0;
      msg(first ? '' : 'ยังไม่มีตัวละคร สร้างตัวแรกได้เลย');
      render();
    } catch (e) {
      // a 401 here is the old session the server dropped (back from a lost connection), not a wrong key: renew it once
      // from the saved refresh token (2026-10-18 Discord: after a drop the game said "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
      // and only logging out and in again helped); a renewal refused asks for the key with the true reason
      if (!again && e && e.status === 401 && O.renewSession) {
        try { await O.renewSession(); return loadSlots(true); } catch (e2) { e = e2; }
      }
      slots = null; render();
      if (KEY_ONLY && e && e.login) { keyScreen(e.message); return; }
      const m = words(e);
      msg(m, true);
      if (KEY_ONLY && (/คีย์|สมัครสมาชิก/.test(m) || (e && e.status === 401))) { keyScreen(m); return; }
      if (/สมัครสมาชิก/.test(m)) { $('.cs-guest', root).hidden = false; form('signup'); }
      if (/คีย์/.test(m)) form('key');
    }
  }

  async function enter(slot) {
    busy = true; render();
    msg('กำลังเข้าเกม…');
    try {
      if (!slots || slots.active !== slot) slots = await O.pickSlot(slot);
      entered = true;
      O.play('');
    } catch (e) { msg(words(e), true); busy = false; render(); }
  }

  // ---------------- deleting a hero (mockup E) ----------------
  let delSlot = -1;
  function askDelete(i) {
    const s = slots && slots.slots[i];
    if (busy || !s || s.empty) return;
    delSlot = i;
    const box = $('.cs-del', root);
    $('.cs-del-cap', box).textContent = `${s.name} · Lv ${s.lv | 0} ${jobName(s.job)} · Job Lv ${s.jobLv | 0}`;
    $('.cs-del-q', box).innerHTML = `ลบ <b>${esc(s.name)}</b> ถาวรเลยไหม? ย้อนกลับไม่ได้`;
    $('.cs-del-pow', box).textContent = 'พลัง ' + (s.power | 0).toLocaleString('en-US');
    // friends and the guild ride with the account's hero in play (backend character_slots.go withAccountRecords):
    // with another hero left they move to it; the last hero takes the friends list along
    const others = filled().length > 1;
    $('.cs-del-kept', box).textContent = others ? 'ยังอยู่: บัญชี กิลด์ และเพื่อน (ไปอยู่กับตัวที่เหลือ)' : 'นี่คือตัวสุดท้ายของบัญชี: รายชื่อเพื่อนจะหายไปด้วย';
    $('.cs-del-kept', box).classList.toggle('warn', !others);
    $('.cs-del-ghost', box).textContent = s.name;
    $('.cs-del-in', box).value = '';
    $('.cs-del-err', box).textContent = '';
    delCheck();
    portrait($('.cs-del-port canvas', box), s, false);
    box.hidden = false;
    setTimeout(() => $('.cs-del-in', box).focus(), 0);
  }
  function delCheck() {
    const box = $('.cs-del', root), s = slots && slots.slots[delSlot], v = $('.cs-del-in', box).value;
    $('.cs-del-go', box).disabled = busy || !s || v !== s.name;
    $('.cs-del-ghost', box).hidden = !!v;
    $('.cs-del-field', box).classList.toggle('ok', !!s && v === s.name);
  }
  function closeDelete() { if (!root) return; $('.cs-del', root).hidden = true; delSlot = -1; if (!root.hidden) root.focus({ preventScroll: true }); }
  async function doDelete() {
    const box = $('.cs-del', root), s = slots && slots.slots[delSlot], name = $('.cs-del-in', box).value;
    if (busy || !s || name !== s.name) return;
    busy = true; delCheck();
    $('.cs-del-err', box).textContent = '';
    try {
      slots = await O.deleteSlot(delSlot, name);
      busy = false;
      closeDelete();
      const first = slots.slots.find((x) => !x.empty);
      sel = first ? first.slot : 0;
      render();
      msg(`ลบ ${s.name} แล้ว`);
      setTimeout(() => { if ($('.cs-msg-t', root).textContent === `ลบ ${s.name} แล้ว`) msg(''); }, 3500);
    } catch (e) {
      busy = false; delCheck();
      $('.cs-del-err', box).textContent = words(e);
    }
  }

  // an empty slot: the game's creator, its "start" sends the hero to the server
  function create(slot) {
    if (!NC.Creator || !game) return;
    creating = { slot };
    root.hidden = true;
    game.player.name = '';
    NC.Creator.open(game, { mode: 'new' });
    const cancel = document.querySelector('.cr-root .cr-cancel');
    if (cancel) { cancel.hidden = false; cancel.textContent = 'กลับ'; }
  }
  function hookCreator() {
    const LK = NC.Look;
    if (!LK || LK.onlineHook) return;
    LK.onlineHook = true;
    // the creator's เริ่มผจญภัย (after its "ใช้ชื่อ … ใช่ไหม?"): the server makes the hero; a refusal (a rude or reserved
    // name, a taken slot) goes back to the creator, which stays open under it (js/creator.js toServer)
    NC.Creator.online = Object.assign(NC.Creator.online || {}, {
      create({ name, look: L }) {
        if (!creating) return Promise.reject(new Error('ช่องตัวละครหายไป กลับไปเลือกช่องใหม่'));
        const slot = creating.slot;
        const look = { g: L.g, hair: L.hair, hc: L.hc, eyes: L.eyes, ec: L.ec, mouth: L.mouth };
        return O.createHero(slot, name, look).then((list) => {
          creating = null; slots = list; sel = slot;
          show(true); render(); enter(slot);
        }, (e) => { throw new Error(words(e)); });
      },
    });
    // the creator closed without สร้าง: back to the slots
    const baseClose = NC.Creator.close;
    NC.Creator.close = function (saved) {
      const r = baseClose.apply(this, arguments);
      if (!saved && creating) { creating = null; show(true); }
      return r;
    };
  }

  async function restart() {
    entered = false; busy = false;
    O.stop();
    show(true);
    msg('กำลังเชื่อมต่อเซิร์ฟเวอร์…');
    $('.cs-loginbox', root).hidden = true; $('.cs-keybox', root).hidden = true; $('.cs-guest', root).hidden = true; closeDelete();
    root.classList.remove('keyed');
    try {
      await O.prepare();
      accountRow();
      await loadSlots();
    } catch (e) {
      accountRow();
      if (KEY_ONLY && e && (e.needKey || e.login)) { keyScreen(e.needKey ? '' : words(e)); return; }
      msg(words(e), true);
      if (e && e.login) form('login');
    }
  }

  O.on('status', (s, why) => {
    if (!root) return;
    if (s === 'online' && entered) return; // (online/world.js hides the lobby once the world is filled)
    if (s === 'syncing') msg('กำลังโหลดโลก…');
    if (s === 'reconnecting') {
      show(true);
      const line = /คิวที่ (\d+)/.exec(why || ''); // (a full server's line: online/conn.js asks again by itself)
      if (/เซิร์ฟเวอร์เต็ม|server full/.test(why || '')) msg('เซิร์ฟเวอร์เต็ม' + (line ? ' · คิวที่ ' + line[1] : '') + ' · ถึงคิวแล้วจะเข้าเกมให้เอง ไม่ต้องกดอะไร', true);
      else msg('การเชื่อมต่อหลุด กำลังต่อใหม่… ' + (why || ''), true);
    }
    if (s === 'error' && entered) { show(true); msg(words({ message: why || 'เชื่อมต่อไม่ได้' }), true); entered = false; busy = false; loadSlots(); }
  });
  NC.OnlineLobby = { show, hide: () => show(false), restart, get entered() { return entered; }, get slots() { return slots; }, pick, act, askDelete, words }; // (act: online/update.js enters the same hero after an update)

  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (g) {
    baseInit(g);
    game = g;
    build();
    hookCreator();
    show(true);
    restart();
  };
})();
