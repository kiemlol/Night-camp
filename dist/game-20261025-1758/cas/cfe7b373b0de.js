/* skillui.js — the HUD side of the skill trees (skilltree.js):
   - the hotbar's 8 skill slots (Q E R F 3 4 5 6): icon, cooldown, level, SP cost, the ultimate's glow
   - the job change cards (a traveler's first jobs, a 1st job's two branches) and the job change itself, shown in the
     skill window (K, js/skillwin.js)
   - the buff icons under the hero's frame: every running buff skill (and the old guard / fire blade / shadow / blessing)
   Replaces hud.js's renderBuffs. Loaded last, before game.js. */
(function () {
  'use strict';
  const NC = window.NC, SK = NC.SKILLS, HUD = NC.HUD;
  const KEYS = NC.HOTKEYS, SHARED = NC.SHARED_SKILLS;
  const $ = (id) => document.getElementById(id);
  const iconSrc = (name) => (NC.ASSET_MANIFEST[name] ? NC.ASSET_MANIFEST[name].src : '');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const JOB = (p) => NC.JOBS[p.job] || NC.JOBS.traveler;

  // ---------------- the hotbar on the HUD ----------------
  const shown = {};
  HUD.updateHotbar = function (p) {
    for (const k of KEYS) {
      const slot = $('hs-' + k);
      if (!slot) continue;
      const id = NC.skillForKey(p, k), S = id && SK[id], src = S ? iconSrc(S.icon) : '';
      if (shown['i' + k] !== src) {
        shown['i' + k] = src;
        const img = slot.querySelector('img');
        if (img) { img.src = src || 'data:,'; img.style.visibility = src ? '' : 'hidden'; }
        slot.title = S ? S.name : '';
        slot.classList.toggle('empty', !S);
        slot.classList.toggle('ult', !!(S && S.ult));
      }
      const cdEl = $('cd-' + k), cdt = $('cdt-' + k), slv = $('slv-' + k), spc = $('spc-' + k);
      if (!S) {
        if (shown['s' + k] !== '') { shown['s' + k] = ''; HUD.setCachedStyle(cdEl, '--p', '0%'); cdt.textContent = ''; slv.textContent = ''; spc.textContent = ''; spc.style.visibility = 'hidden'; HUD.setCachedClass(slot, 'nosp', false); }
        continue;
      }
      const lv = NC.skillLv(p, id), cost = NC.skillCost(p, id, lv), left = NC.skillCd(p, id);
      HUD.setCachedStyle(cdEl, '--p', left > 0 ? (100 * left) / NC.skillCdFull(p, id) + '%' : '0%');
      const t = left > 0 ? (left >= 1 ? String(Math.ceil(left)) : left.toFixed(1)) : '';
      const lvT = S.boss ? 'BOSS' : 'Lv' + lv, spT = 'SP ' + cost, key = t + '|' + lvT + '|' + spT;
      if (shown['s' + k] !== key) { shown['s' + k] = key; cdt.textContent = t; slv.textContent = lvT; spc.textContent = spT; spc.style.visibility = ''; }
      HUD.setCachedClass(slot, 'nosp', p.sp < cost);
    }
  };

  // ---------------- buff icons ----------------
  const OLD = [['guard', 'sk_guard', 'โล่แสงศักดิ์สิทธิ์'], ['fireblade', 'sk_magnum', 'อาวุธติดไฟ'], ['shadow', 'sk_shadowstep', 'คริติคอลแน่นอน'], ['bless', 'sk_blessing', 'พรศักดิ์สิทธิ์']];
  let buffKey = '';
  HUD.renderBuffs = function (p) {
    const B = p.buffs || {}, list = OLD.filter(([k]) => B[k] > 0);
    for (const k in B) if (B[k] > 0 && SK[k] && SK[k].icon && !OLD.some((o) => o[0] === k)) list.push([k, SK[k].icon, SK[k].name]);
    const box = $('buffs');
    if (!box) return;
    const key = list.map((l) => l[0]).join(',');
    if (buffKey !== key) {
      buffKey = key;
      box.textContent = '';
      for (const [k, icon, name] of list) {
        const d = el('div', 'buff');
        d.dataset.k = k; d.title = name;
        d.innerHTML = `<img src="${iconSrc(icon)}" alt=""><b></b>`;
        box.appendChild(d);
      }
    }
    for (const d of box.children) {
      const k = d.dataset.k, t = B[k] || 0;
      HUD.setCachedText(d.querySelector('b'), t >= 1 ? Math.ceil(t) : t.toFixed(1)); HUD.setCachedClass(d, 'ending', t < 1.5);
      // a buff bound to a weapon the hero no longer holds (online the server's buff stays on, js/weapons.js): marked, and
      // its title says what it needs (2026-10-20 Discord #147: "บัฟปริศนา ไม่มีผลต่ออะไรเลย", ใส่ธาตุดาบ with dual swords)
      if (!k || !SK[k]) continue;
      const off = !!(NC.weaponOk && !NC.weaponOk(p, k));
      HUD.setCachedClass(d, 'nowpn', off);
      const tip = off ? `${SK[k].name} · ใช้ไม่ได้กับอาวุธที่ถืออยู่ (ต้องถือ${NC.weaponNeedText(k)})` : SK[k].name;
      if (d.title !== tip) d.title = tip;
    }
  };
  document.addEventListener('click', (ev) => { // (a touch screen has no hover title)
    const d = ev.target.closest && ev.target.closest('#buffs .buff.nowpn');
    if (d && d.title && HUD.toast) HUD.toast(d.title);
  });

  // ---------------- the job change cards ----------------
  HUD.renderJobs = function (list, p) {
    const box = el('div', 'jobs'), ready = NC.canChangeJob(p), J = JOB(p), ids = NC.nextJobs(p);
    if (ids.length <= 2) box.classList.add('two');
    const hd = el('div', 'jobs-h');
    const what = J.tier === 2 ? 'เลื่อนเป็นคลาส 3 (สกิลเดิมยังอยู่ครบ ได้พาสซีฟที่ปลุกพลังสกิล' + J.name + ' ร่างตื่น และชุดไฮคลาส)'
      : J.tier === 1 ? 'เลือกสายอาชีพขั้น 2 (สกิลของ' + J.name + 'ยังอยู่ครบ ได้สกิลสายใหม่เพิ่ม และได้ชุดประจำสาย)' : 'เลือกอาชีพ (Job Lv จะเริ่มใหม่ที่ 1 · แต้มสกิลจาก Job Lv 1-10 ติดตัวไปด้วย · ได้ชุดประจำอาชีพ)';
    const need = J.tier === 2 ? `Job Lv ${NC.jobMax(p)} และ Base Lv ${NC.CLASS3_BASE_LV}` : `Job Lv ${NC.jobMax(p)}`;
    hd.textContent = ready ? 'เปลี่ยนอาชีพได้แล้ว! ' + what : `เปลี่ยนอาชีพได้ที่ ${need} (ตอนนี้ Job Lv ${p.jobLv}${J.tier === 2 ? ' · Base Lv ' + p.lv : ''}) · ดูอาชีพที่เลือกได้:`;
    list.appendChild(hd);
    for (const id of ids) {
      const N = NC.JOBS[id], C = NC.CLASSES.find((c) => c.id === N.cls), card = el('div', 'job' + (ready ? '' : ' locked'));
      const cv = document.createElement('canvas');
      cv.width = 160; cv.height = 190;
      if (C) {
        const eq = Object.assign({}, p.equip, C.items), c2 = cv.getContext('2d');
        c2.fillStyle = 'rgba(16,14,26,0.45)'; c2.beginPath(); c2.ellipse(80, 170, 44, 12, 0, 0, Math.PI * 2); c2.fill();
        NC.drawAvatar(c2, eq, 80, 170, 0.95, 1, { t: 0.4 });
      }
      const icons = N.skills.filter((s) => SK[s] && !SHARED.includes(s)).map((s) => `<img src="${iconSrc(SK[s].icon)}" title="${SK[s].name}" alt="">`).join('');
      card.innerHTML = `<div class="job-name">${N.name}</div><div class="job-desc">${N.desc}</div><div class="job-sk">${icons}</div>`;
      card.prepend(cv);
      const b = el('button', 'big job-go', 'เป็น' + N.name);
      b.disabled = !ready;
      b.addEventListener('click', () => {
        if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'กดอีกครั้งเพื่อยืนยัน'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'เป็น' + N.name; }, 3000); return; }
        this.changeJob(id);
      });
      card.appendChild(b);
      box.appendChild(card);
    }
    list.appendChild(box);
  };

  HUD.changeJob = function (id) {
    const g = this.game, p = g.player, J = NC.JOBS[id];
    if (!NC.changeJob(p, id)) return;
    if (NC.BL && NC.BL.returnLostRunes) NC.BL.returnLostRunes(g, p); // (the runes of the skills the change dropped, js/bl_runes.js)
    if (J.tier >= 2) for (const s of J.skills) if (NC.skillLv(p, s) > 0 && NC.skillSlottable(SK[s])) NC.autoSlot(p, s);
    NC.equipClass(g, J.cls);
    NC.clearSkillCds(p);
    if (NC.Pets) NC.Pets.dismiss(); // the old job's summons and traps go
    if (NC.Traps) for (const t of NC.Traps.list.splice(0)) t.fx.dead = true;
    NC.applyGear(g); p.hp = p.maxHp; p.sp = p.maxSp;
    NC.jobChangeFx(g, p, J.tier === 3 ? 'HIGH CLASS!' : J.tier === 2 ? 'CLASS UP!' : undefined);
    this.log(J.tier === 3 ? `เป็น${J.name}แล้ว! สกิลเดิมยังอยู่ครบ กด K เพื่อเรียนพาสซีฟปลุกพลังของคลาส 3`
      : J.tier === 2 ? `เป็น${J.name}แล้ว! สกิลเดิมยังอยู่ครบ กด K เพื่อเรียนสกิลสายใหม่และจัดแถบสกิล`
      : `เปลี่ยนอาชีพเป็น${J.name}แล้ว! แต้มสกิลคงเหลือ ${NC.skillLeft(p)} แต้ม กด K เพื่อเรียนสกิลและจัดแถบสกิล`, 'level');
    NC.saveGame(g);
    this.panel('skills', false); g.paused = false;
  };
})();
