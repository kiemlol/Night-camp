/* rootloot.js — what รากต้นไม้มืด gives (js/darkroot.js; the user, 2026-10-12: "อยากให้เป็นเหมือนของบอส คนจะได้ไม่ต้องแย่ง
   บอสในแมพหลักกัน" → the design offered and "ทำต่อเลย"):
     the shades of the bosses     every 10th floor's "เงาราก" is a real boss with its real drop table (js/loot.js: each
                                  piece 3%, the crown 4%, stones, its materials), so a hero can hunt a boss's set here
                                  instead of fighting over the field boss. The ten zones' shades are the bosses whose sets
                                  fit their floors' levels (the old picks were by theme: their gear was far over or under
                                  the floors); a zone with several turns them over week by week
     bound to the hero (ผูกตัว)    every gear piece found in the roots is bound (c.bd): it can be worn, refined, polished
                                  and sold to Uncle Coco, but never put in a player's stall or handed to another player —
                                  so the roots fill a hero's own kit, and the field bosses' drops keep their price
     แก่นเงา (shadow cores)        each shade felled gives every hero who hit it one core of that boss; the cores buy the
                                  piece of that boss's set the hero wants (the lobby's "แก่นเงา" window): the end of bad
                                  luck, as the forge's pity (the copy rolls a boss's grade, and is bound too). A piece
                                  costs about three quarters of the kills a field boss takes for it (js/bossrate.js:
                                  a weapon 0.5% → 150 cores, a hat / crown / outfit 1% → 75)
     พรแห่งราก (blessings)         a shade gives its drops and its core only with a blessing: 3 a day, kept up to 6 (a day
                                  missed is not lost). Without one the floors, the EXP, the monsters' drops and the boards
                                  stay open; only the boss's own loot is held back (the user, 2026-10-12: "จำกัดการลงหอคอย
                                  ต่อวัน" → this; "เรทดรอปของบอสต้องยากพอๆกับตีบอสปกติ": the shades roll exactly the field
                                  bosses' rates, and the deep floors don't lift a boss's grade, js/gradetier.js)
     the story's quests           a shade does not count for a story boss quest (js/quests.js)
   Hooks: the zones' boss (a getter), NC.gearMakeHooks, NC.skillKills, NC.copyTag, NC.invCardExtras, the lobby's footExtra /
   lobbyAct / lobbyAfter (js/darkroot_ui.js). NC.RootLoot: SHADES, coreId(boss), items(boss), trade(game, boss, id). */
(function () {
  'use strict';
  const NC = window.NC, R = NC.Root, W = NC.GEAR, ITEMS = NC.ITEMS;
  if (!R || !W) return;
  if (NC.ASSET_MANIFEST_ROOT && NC.ASSET_MANIFEST) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_ROOT);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const BLESS_DAY = 3, BLESS_MAX = 6;
  const costOf = (id) => Math.round(0.75 * 100 / ((NC.BOSS_RATE && NC.BOSS_RATE.of(id)) || 3)); // (cores for one piece)
  const COST = 75; // (the cheapest piece: the log's goal)

  // ---------------- the shades of each zone, by the level of their gear ----------------
  const SHADES = [
    ['sb_ivy'], ['bat_king'], ['mushking'], ['sb_morrow', 'sb_raven', 'sb_ignis'], ['ant_queen'],
    ['crypt_lord'], ['sb_gareth'], ['sb_aldric'], ['sb_gorm', 'sb_puppet1'], ['lava_dragon', 'sb_puppet6'],
  ];
  R.ZONES.forEach((Z, i) => {
    const list = SHADES[i];
    Object.defineProperty(Z, 'boss', { configurable: true, get: () => list[R.weekNo() % list.length] });
    Z.bosses = list;
  });
  const ALL = [...new Set(SHADES.flat())];
  const nameOf = (b) => ((NC.STORY_BOSSES && NC.STORY_BOSSES[b]) || (NC.DUNGEON_BOSSES && NC.DUNGEON_BOSSES[b]) || NC.MONSTERS[b] || {}).name || b;
  const zoneOfBoss = (b) => SHADES.findIndex((l) => l.includes(b));

  // ---------------- the shadow cores (one material per boss) ----------------
  const coreId = (b) => 'mat_shade_' + b;
  const MAT = NC.MATERIALS;
  if (MAT) {
    for (const b of ALL) MAT[coreId(b)] = { name: `แก่นเงา ${nameOf(b)}`, price: 0, rare: true, keep: true, noNpc: true,
      desc: `แก่นควันดำจากเงารากของ${nameOf(b)} สะสมแลกของชิ้นที่อยากได้ของบอสตัวนี้ได้ที่ประตูราก (อาวุธ 150 · หมวก/มงกุฎ/ชุด 75)` };
    const baseIcon = NC.matIcon;
    NC.matIcon = (id) => (/^mat_shade_/.test(id) && NC.ASSET_MANIFEST.ri_shade ? NC.ASSET_MANIFEST.ri_shade.src : baseIcon(id));
    const baseSource = NC.matSource;
    NC.matSource = (id) => (/^mat_shade_/.test(id) ? 'รากต้นไม้มืด: ล้มเงารากของบอสตัวนี้' : baseSource(id));
  }
  // ---------------- the blessings (3 a day, kept up to 6) ----------------
  const st = R.state;
  const dayNo = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  function bless() {
    const d = dayNo();
    if (!st.bless) st.bless = { n: BLESS_DAY, day: d };
    if (st.bless.day !== d) { st.bless.n = Math.min(BLESS_MAX, st.bless.n + BLESS_DAY * Math.max(1, d - st.bless.day)); st.bless.day = d; R.save(); }
    return st.bless.n;
  }
  // a shade is marked as it rises: with no blessing left its loot is held back (loot.js, materials, stones: e.lootless)
  NC.skillTicks.push((game) => {
    if (!onRoot(game)) return;
    for (const e of game.enemies) if (e.rootTag === 'boss' && e._bless === undefined) {
      e._bless = bless() > 0;
      if (!e._bless) { e.lootless = true; NC.HUD.log(`พรแห่งรากหมดแล้ว: ล้มเงาบอสชั้นนี้ได้ EXP แต่ไม่ได้ของบอสและแก่นเงา (พรเติม ${BLESS_DAY} ทุกวัน)`, 'warn'); }
      else NC.HUD.log(`พรแห่งราก ${st.bless.n}/${BLESS_MAX}: ล้มเงาบอสชั้นนี้ได้ของบอส + แก่นเงา (ใช้พร 1)`, 'level');
    }
  });
  R.hudExtra = (fl) => { if (!fl) return ''; const n = bless(); return `<div class="rt-bless${n ? '' : ' none'}">พรแห่งราก ${'●'.repeat(n)}${'○'.repeat(Math.max(0, BLESS_MAX - n))} ${n}/${BLESS_MAX}</div>`; };
  NC.skillKills.push((game, e) => {
    if (!e || e.rootTag !== 'boss' || e._heroT == null || game.time - e._heroT > 4) return;
    if (e.lootless) { NC.HUD.log('พรหมด: ไม่ได้ของบอสรอบนี้', 'warn'); return; }
    st.bless.n = Math.max(0, bless() - 1); R.save();
    const id = coreId(e.type);
    if (!MAT || !MAT[id]) return;
    NC.addMat(game, id, 1);
    const n = NC.matCount(game.player, id);
    NC.HUD.log(`ได้แก่นเงา ${nameOf(e.type)} (มี ${n})${n >= COST ? ' · แลกของได้ที่ประตูราก!' : ''}`, 'item');
  });

  // ---------------- bound pieces ----------------
  const onRoot = (g) => !!(g && /^root_\d+_/.test(g.mapId || ''));
  (NC.gearMakeHooks = NC.gearMakeHooks || []).push((c, it, o) => { if (o && o.src === 'drop' && onRoot(NC.game)) c.bd = 1; });
  const baseTag = NC.copyTag;
  NC.copyTag = (c) => (baseTag ? baseTag(c) : '') + (c && c.bd ? '<i class="gt-tag bd">ผูกตัว</i>' : '');
  NC.invCardExtras.push((p, id, one) => {
    if (!W.isInst(id)) return '';
    const list = one ? [one] : W.copies(p, id), nb = list.filter((c) => c.bd).length;
    if (!nb) return '';
    return `<div class="rl-bound"><img src="${(NC.ASSET_MANIFEST.ri_bound || {}).src || ''}" alt=""><span><b>ผูกตัว${list.length > 1 ? ` (${nb}/${list.length} ชิ้น)` : ''}</b>ได้จากรากต้นไม้มืด · ใส่ ตีบวก ขัดเกรด และขายให้ลุงโกโก้ได้ แต่ตั้งร้านหรือส่งให้ผู้เล่นอื่นไม่ได้</span></div>`;
  });

  // ---------------- the exchange: 10 cores -> one piece of that boss's set ----------------
  function items(b) {
    const rows = (NC.LOOT_DATA && NC.LOOT_DATA.bosses && NC.LOOT_DATA.bosses[b]) || [];
    const ids = rows.map((r) => r[0]).concat(ITEMS['acc_crown_' + b] ? ['acc_crown_' + b] : []);
    // (gear pieces, and the story bosses' old outfit pieces: robes, capes, hats, owned as a kind; never fashion; the samurai line is closed this patch)
    return [...new Set(ids)].filter((id) => ITEMS[id] && ITEMS[id].rarity !== 'fashion' && NC.itemReady(id) && !/katana|nodachi/.test((NC.wtypeOf && NC.wtypeOf(ITEMS[id])) || ''));
  }
  function trade(game, b, id) {
    const p = game.player, cid = coreId(b);
    const cost = costOf(id);
    if (NC.matCount(p, cid) < cost || !items(b).includes(id)) return null;
    if (!W.isInst(id)) { // (an outfit piece kept as a kind: once)
      if (p.owned.has(id)) return null;
      p.mats[cid] -= cost; if (p.mats[cid] <= 0) delete p.mats[cid];
      p.owned.add(id); p.fresh.add(id);
      NC.saveGame(game); if (NC.saveTrade) NC.saveTrade(game);
      NC.HUD.log(`แลกแก่นเงา ${cost} ได้ ${ITEMS[id].name}`, 'level');
      return { id };
    }
    p.mats[cid] -= cost; if (p.mats[cid] <= 0) delete p.mats[cid];
    const c = W.make(id, { src: 'trade' });
    if (NC.Grade) NC.Grade.set(c, NC.Grade.roll('boss', { type: b }));
    c.bd = 1;
    W.add(game, c);
    if (NC.saveTrade) NC.saveTrade(game);
    const g = NC.Grade ? NC.Grade.GRADES[NC.Grade.of(c)] : null;
    NC.HUD.log(`แลกแก่นเงา ${cost} ได้ ${g ? `[${g.name}] ` : ''}${NC.copyName(c)} (ผูกตัว)`, 'level');
    return c;
  }

  // the lobby's window
  let open = false, pick = null;
  const total = (p) => ALL.reduce((s, b) => s + NC.matCount(p, coreId(b)), 0);
  R.footExtra = (p) => `<span class="rl-bless" title="พรแห่งราก: ล้มเงาบอสได้ของบอส + แก่นเงา ${BLESS_DAY} ครั้งต่อวัน สะสมได้ ${BLESS_MAX}">พร <i>${'●'.repeat(bless())}${'○'.repeat(Math.max(0, BLESS_MAX - bless()))}</i><b>${bless()}</b></span><button class="rl-btn" data-act="shade" title="แลกด้วยแก่นเงา"><img src="${(NC.ASSET_MANIFEST.ri_shade || {}).src || ''}" alt=""><b>${total(p)}</b></button>`;
  R.lobbyAct = (act, el, game) => {
    if (act === 'shade') { open = !open; return true; }
    if (act === 'shadex') { open = false; return true; }
    if (act === 'shadeb') { pick = el.dataset.b; return true; }
    if (act === 'shadebuy') { trade(game, pick, el.dataset.id); return true; }
    if (act === 'shop') open = false;
    return false;
  };
  const icons = new Map();
  const iconOf = (id) => { if (!icons.has(id)) { try { icons.set(id, NC.itemIcon(id, 96).toDataURL()); } catch (e) { icons.set(id, ''); } } return icons.get(id); };
  R.lobbyAfter = (lw, sel) => {
    let el = lw.querySelector('#rl-shade');
    if (!el) { el = document.createElement('div'); el.id = 'rl-shade'; el.className = 'rt-shop rl-shade'; lw.querySelector('.rt-lobby').appendChild(el); }
    el.hidden = !open;
    if (!open) return;
    const p = NC.game.player;
    if (!pick || !ALL.includes(pick)) { const z = R.zoneOf(Math.max(10, Math.ceil(sel / 10) * 10)); pick = z.boss; }
    const have = NC.matCount(p, coreId(pick)), list = items(pick);
    el.innerHTML = `<div class="rt-shoph"><img src="${(NC.ASSET_MANIFEST.ri_shade || {}).src || ''}" alt=""><b>แลกด้วยแก่นเงา</b><span>อาวุธ 150 · หมวก/มงกุฎ/ชุด 75 แก่น · ผูกตัว</span><button class="kw-x" data-act="shadex">✕</button></div>` +
      '<div class="rl-body"><div class="rl-bosses kw-scroll">' + ALL.map((b) => {
        const z = zoneOfBoss(b), n = NC.matCount(p, coreId(b)), now = R.ZONES[z].boss === b;
        return `<button class="rl-boss${b === pick ? ' on' : ''}" data-act="shadeb" data-b="${b}"><b>${esc(nameOf(b))}</b><small>ชั้น ${(z + 1) * 10}${now ? '' : ' · สัปดาห์อื่น'}</small><i class="${n >= COST ? 'ok' : ''}">${n}</i></button>`;
      }).join('') + '</div><div class="rl-items kw-scroll">' +
      `<div class="rl-ih"><b>${esc(nameOf(pick))}</b><span>มีแก่น <b>${have}</b></span></div><div class="rl-grid">` +
      (list.length ? list.map((id) => { const it = ITEMS[id];
        const got = !W.isInst(id) && p.owned.has(id);
        const cost = costOf(id);
        return `<button class="rl-it" data-act="shadebuy" data-id="${id}" ${have >= cost && !got ? '' : 'disabled'} title="${esc(it.name)} · Lv ${it.lvReq || 1}"><img src="${iconOf(id)}" alt=""><b>${esc(it.name)}</b><small>${got ? 'มีแล้ว' : cost + ' แก่น'}</small></button>`; }).join('')
        : '<div class="rl-none">บอสตัวนี้ยังไม่มีของประจำตัว</div>') + '</div></div></div>';
  };

  NC.RootLoot = { SHADES, ALL, COST, costOf, coreId, items, trade, nameOf };
})();
