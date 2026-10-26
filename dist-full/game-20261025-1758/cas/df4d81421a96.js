/* online/expx5.js — the beta test's EXP x1.5 as a buff badge (the owner, 2026-10-20: "ทำระบบคูณเลเวล X5 เฉพาะ ช่วง ทดสอบนี้
   โดยเขียนเป็น buff icon กำกับเลย", then the same day: "เปลี่ยนเป็น X1.5 ก็พอ"). The server pays it (server patch 015,
   backend test_exp.go): every monster kill's EXP and Job EXP x1.5 (rounded down) while the back office's "expx5" event
   switch is on (the id kept its first name); while it pays, self.live (and nc_status.live) carry "exp": 1.5 and each
   reward event says "test": 1.5.
   Here: the painted x1.5 badge first in the HUD's buff row (#buffs) while self.live.exp > 1, with a hover line saying what
   it does and a click repeating it as a toast; the kill line in the log says "(x1.5)" (online/world.js onReward reads the
   reward's "test"). The rate keeps one decimal (1.5 stays 1.5). The switch off -> no "exp" -> the badge leaves with the
   next snapshot. An older server never sends "exp": no badge, as it pays x1. Quests, lessons and the offline farm keep
   their own pay (the badge says kills).
   Art: assets/expx5/expx5_a..d.png (the x1.5 badges: tools/expx5_cut.py, prompt assets/gen/exp15.prompt.txt), b (blue,
   level-up chevrons) by default, ?expx5=a|c|d shows another. Load after online/world.js. Test hook: NC.OnlineExpX5. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld;
  if (!O || !O.enabled || !W || !NC.HUD) return;
  const ART = 'assets/expx5/expx5_b.png';
  let rate = 0; // the server's rate while the test pays (0: none)

  const rateOf = (live) => {
    const k = live && typeof live === 'object' ? Number(live.exp) : 0;
    return Number.isFinite(k) && k > 1 ? Math.round(k * 10) / 10 : 0; // (one decimal: x1.5, not x2)
  };
  // (self.live comes with the first snapshot and again whenever a switch changes: a record without it keeps the rate)
  W.selfHooks.push((s) => { if (s && s.live !== undefined) rate = rateOf(s.live); });

  const text = (k) => `EXP x${k} ช่วงทดสอบ · ล่ามอนได้ EXP และ Job EXP x${k} · มีเฉพาะช่วงทดสอบนี้`;

  // ---------------- the badge in the buff row ----------------
  const baseBuffs = NC.HUD.renderBuffs.bind(NC.HUD);
  NC.HUD.renderBuffs = function (p) {
    baseBuffs(p);
    const box = document.getElementById('buffs');
    if (!box) return;
    let el = box.querySelector('.buff.expx5');
    if (!(rate > 1)) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.className = 'buff expx5';
      el.innerHTML = `<img src="${ART}" alt=""><b>EXP</b>`;
      box.insertBefore(el, box.firstChild);
    }
    if (el.dataset.rate !== String(rate)) { el.dataset.rate = String(rate); el.title = text(rate); }
    // (the row's own loop gives every chip a skill buff's seconds and blinks it when they run out: skillui.js)
    const b = el.querySelector('b');
    if (b.textContent !== 'EXP') b.textContent = 'EXP';
    el.classList.remove('ending');
  };
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest && ev.target.closest('.buff.expx5');
    if (el && rate > 1 && NC.HUD.toast) NC.HUD.toast(text(rate));
  });

  const css = document.createElement('style');
  css.textContent = '#buffs .buff.expx5{cursor:pointer;background:transparent;border-color:transparent;box-shadow:none}' +
    '#buffs .buff.expx5 img{border-radius:50%;filter:drop-shadow(0 0 calc(5*var(--u)) rgba(120,200,255,.55))}' +
    '#buffs .buff.expx5 b{right:auto;left:50%;transform:translateX(-50%);bottom:calc(-11*var(--u));font-size:calc(12*var(--u));color:#ffe28a}';
  document.head.appendChild(css);

  NC.OnlineExpX5 = { rate: () => rate, set: (k) => { rate = rateOf({ exp: k }); }, art: ART };
})();
