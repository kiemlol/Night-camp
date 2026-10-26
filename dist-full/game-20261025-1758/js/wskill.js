/* wskill.js — weapons that strengthen one job's skills, like classic MMOs' (the user, 2026-09-30: "อาวุธบางอันจะส่งผลเสริมต่อ
   ความแรงสกิล อาชีพนั้นๆด้วย ... คทาบางอันจะบวกความแรงสกิล meteor ... ธนูบางอันจะบวกความแรงสกิลบางอย่าง เพื่อให้เกิดสายและ
   บิ้วที่แตกต่างออกไป"). Every weapon of the item plan that has a design of its own gets a skill of a job that can hold
   it; the plain ones (kind A) keep their top ATK instead:
     kind B  ออปพิเศษ      the skill's damage +15%
     kind C  ปลุกเวท       the skill's damage +10% and its cooldown −15%
     kind D  บอส          the skill's damage +25% and its cast −20% (a skill with no cast: its cooldown −20%)
     kind L  ตำนาน         two skills: +30% and +20% damage
   The numbers are the same at every grade, so a low-grade weapon that fits a build keeps its place (the classic MMO way).
   A skill is chosen among the damage skills of the jobs that bring the weapon's type (a 1st job its own types, a 2nd
   job its new ones, or its 1st job's when it has none; a skill whose weapon rule needs another type is left out), the weapon's element first (a fire staff boosts fire spells), then
   the skill that the fewest weapons of that type boost so far, so every skill of a lane gets weapons at every grade.
   Deterministic (sorted ids, no randomness): the same weapon always boosts the same skill. it.wsk = [{ sid, job, dmg,
   cast, cd }] and it.wskText.
   Hooks: NC.heroHit (the damage of the skill's hits: o.sid), NC.castTime (the cast), NC.skillCasts (the cooldown just
   set), the bag's item card (NC.invCardExtras). Test: NC.WSkill.of('st_...'), NC.WSkill.bySkill('meteor'). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, SK = NC.SKILLS, JOBS = NC.JOBS;
  if (!SK || !JOBS || !NC.JOB_WEAPONS) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const WT = NC.WTYPES || {};
  const wInfo = (it) => it && (it.gs || it.sw || it.wc);
  const KIND = { B: [{ dmg: 15 }], C: [{ dmg: 10, cd: 15 }], D: [{ dmg: 25, cast: 20 }], L: [{ dmg: 30 }, { dmg: 20 }] };

  // ---------------- which skills a weapon type can boost ----------------
  // a job holds a type (its own list, or its 1st job's); a skill fits when its weapon rule doesn't ask for another type
  const fits = (sid, t) => {
    const R = NC.WEAPON_RULES && NC.WEAPON_RULES[sid];
    if (!R || !R.n || !R.n.length) return true;
    const T = WT[t] || {};
    return R.n.some((k) => k === t || (k === 'melee' && T.m) || ((k === 'oneh' || k === 'free') && T.h === 1 && T.m) || k === 'shield');
  };
  // (hits only: not heals, buffs or debuffs; types phys / magic / best / hybrid)
  const isDamage = (S) => !!S && typeof S.mul === 'function' && !S.pass && !S.buff && !S.heal && ['phys', 'magic', 'best', 'hybrid'].includes(S.type);
  const CAND = {}; // type -> [{ sid, job }]
  for (const job of Object.keys(JOBS).sort()) {
    const J = JOBS[job];
    if (!J || !(J.tier === 1 || J.tier === 2) || !Array.isArray(J.skills)) continue;
    // a job's skills go on the types it brings itself (a 1st job's, or a 2nd job's new ones: the gunslinger's guns, not the
    // archer's bow); a 2nd job with no types of its own (the fire mage, the wolf hunter) takes its 1st job's
    const own = NC.JOB_WEAPONS[job] || [], first = J.tier === 2 && J.from ? NC.JOB_WEAPONS[J.from] || [] : [];
    const types = new Set(own.length ? own : first);
    for (const t of types) for (const sid of J.skills) {
      if (!isDamage(SK[sid]) || !fits(sid, t)) continue;
      const L = CAND[t] || (CAND[t] = []);
      if (!L.some((c) => c.sid === sid)) L.push({ sid, job });
    }
  }
  // a 2nd job's skill counts for its own lane first: the job that the skill belongs to
  const jobOfSkill = {};
  for (const job of Object.keys(JOBS)) { const J = JOBS[job]; if (J && Array.isArray(J.skills) && (J.tier === 1 || J.tier === 2)) for (const sid of J.skills) if (!jobOfSkill[sid] || J.tier === 2) jobOfSkill[sid] = job; }

  // ---------------- the weapons get theirs ----------------
  const used = {}; // type|sid -> how many weapons boost it
  const weapons = Object.keys(ITEMS).filter((id) => ITEMS[id].slot === 'weapon' && wInfo(ITEMS[id]) && KIND[wInfo(ITEMS[id]).kind]).sort((a, b) => {
    const A = wInfo(ITEMS[a]), B = wInfo(ITEMS[b]);
    return (A.grade - B.grade) || (A.kind < B.kind ? -1 : A.kind > B.kind ? 1 : 0) || (a < b ? -1 : 1);
  });
  for (const id of weapons) {
    const it = ITEMS[id], w = wInfo(it), t = NC.wtypeOf ? NC.wtypeOf(it) : it.wtype, list = CAND[t];
    if (!list || !list.length) continue;
    const el = it.element || 'neutral', out = [];
    for (const spec of KIND[w.kind]) {
      const score = (c) => {
        const S = SK[c.sid], same = (S.element || 'neutral') === el && el !== 'neutral' ? 0 : 1;
        return [same, used[t + '|' + c.sid] || 0, c.sid];
      };
      const pick = list.filter((c) => !out.some((o) => o.sid === c.sid)).map((c) => [score(c), c])
        .sort((a, b) => (a[0][0] - b[0][0]) || (a[0][1] - b[0][1]) || (a[0][2] < b[0][2] ? -1 : 1))[0];
      if (!pick) break;
      const c = pick[1], S = SK[c.sid];
      used[t + '|' + c.sid] = (used[t + '|' + c.sid] || 0) + 1;
      const hasCast = NC.castBase && NC.castBase(c.sid, 1) > 0;
      const o = { sid: c.sid, job: jobOfSkill[c.sid] || c.job, dmg: spec.dmg || 0, cast: 0, cd: spec.cd || 0 };
      if (spec.cast) { if (hasCast) o.cast = spec.cast; else o.cd = spec.cast; }
      out.push(o);
    }
    if (!out.length) continue;
    it.wsk = out;
    it.wskText = out.map(textOf).join(' · ');
  }
  function textOf(o) {
    const S = SK[o.sid], J = JOBS[o.job], parts = [];
    if (o.dmg) parts.push(`แรงขึ้น ${o.dmg}%`);
    if (o.cast) parts.push(`ร่ายเร็วขึ้น ${o.cast}%`);
    if (o.cd) parts.push(`คูลดาวน์ −${o.cd}%`);
    return `สกิล ${S ? S.name : o.sid}${J ? ' (' + J.name + ')' : ''} ${parts.join(' ')}`;
  }

  // ---------------- in play ----------------
  const boostOf = (p, sid) => {
    if (!p || p.kind !== 'player' || !p.equip) return null;
    const W = ITEMS[p.equip.weapon];
    return (W && W.wsk && W.wsk.find((o) => o.sid === sid)) || null;
  };
  NC.weaponSkillBoost = boostOf;
  const baseHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHit.apply(this, arguments), G = NC.game, p = G && G.player;
    if (o && o.sid && p && d === p.d && r && r.dmg > 0) { const b = boostOf(p, o.sid); if (b && b.dmg) r.dmg = Math.max(1, Math.round(r.dmg * (1 + b.dmg / 100))); }
    return r;
  };
  const baseCast = NC.castTime;
  if (baseCast) NC.castTime = function (p, id) { const t = baseCast.apply(this, arguments), b = boostOf(p, id); return b && b.cast ? t * (1 - b.cast / 100) : t; };
  // the cooldown just set when the skill went off (skilltree.js keeps it under '@' + the skill's id)
  if (NC.skillCasts) NC.skillCasts.push((game, p, id) => {
    const b = boostOf(p, id), k = '@' + id;
    if (!b || !b.cd || !p.cd || !(p.cd[k] > 0)) return;
    p.cd[k] *= 1 - b.cd / 100;
    if (p.cdFull) p.cdFull[k] = p.cd[k];
  });

  // ---------------- the bag's item card ----------------
  if (NC.invCardExtras) NC.invCardExtras.push((p, id) => {
    const it = ITEMS[id];
    if (!it || !it.wsk) return '';
    return '<div class="wsk-box"><div class="h">เสริมสกิล</div>' + it.wsk.map((o) => `<div class="wsk-line">${esc(textOf(o))}</div>`).join('') + '</div>';
  });
  const css = document.createElement('style');
  css.textContent = '.wsk-box{margin:8px 0 2px;padding:8px 10px;border-radius:10px;background:rgba(120,90,200,.14);border:1px solid rgba(170,140,255,.28)}' +
    '.wsk-box .h{font-weight:600;color:#cdb8ff;font-size:13px;margin-bottom:3px}.wsk-line{color:#efe6ff;font-size:13px;line-height:1.5}';
  document.head.appendChild(css);

  NC.WSkill = {
    of: (id) => (ITEMS[id] && ITEMS[id].wsk) || null,
    text: (id) => (ITEMS[id] && ITEMS[id].wskText) || '',
    bySkill: (sid) => Object.keys(ITEMS).filter((id) => ITEMS[id].wsk && ITEMS[id].wsk.some((o) => o.sid === sid)),
    candidates: CAND,
  };
})();
