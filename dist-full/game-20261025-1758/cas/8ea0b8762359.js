/* founder.js — the FOUNDER PACK cosmetics of the top-up window (js/topup.js, js/topupwin.js). The founder cards first
   showed Codex-painted icons of things the game didn't have; the user (2026-10-17): "ทำไมไม่ใช้หมวกกับ asset ในเกมเดิม
   เลยอ่ะ ไปทำใหม่ทำไม" -> picked three EXISTING pictures from the game: "หมวก 1, ผ้าคลุม 7, แบบเรืองแสง 8 ทำเป็นของ
   ผู้บุกเบิก (ภาพเดิม ไม่มีค่าพลัง) แล้วเปลี่ยนไอคอนบนการ์ดเป็นภาพของจริง". So every founder item is its own item that
   wears the picture of a game item (its sprite, fit and cloth settings, copied when the game starts):
     หมวกตะเกียงผู้บุกเบิก   hat_founder_lantern   (ไฟริบหรี่ 349 and up)  the picture of หมวกตะเกียงนักสำรวจ
                                                                          (hat_hc_misc_lantern; it glows, hatfx.js)
     ผ้าคลุมเถ้ากองไฟ         cape_founder_ash      (กองไฟ 1,290 and up)    the picture of ผ้าคลุมขนเหยี่ยวรัตติกาล (cape_nfalcon)
     ผ้าคลุมเถ้ากองไฟ เรืองแสง  cape_founder_glow     (ต้นไม้ดำ 3,990)        the picture of ปีกเงาขนเหยี่ยวดำ (cape_efalcon)
   Rules: rarity 'fashion', no stats; founder: true = never in the gacha pool (gacha.js pool()), never dropped (drops skip
   rarity 'fashion'), not in the equipment screen's fashion SET row (a set click hands its items out), no set effects of
   the falcon sets (falconset.js matches its own ids); bound: true = account-bound: never sold, bought or traded (NC.isBound in
   vend.js: not in the shopkeepers' stock, not in a player shop, shown locked in the stall's bag; partynet.js gifts skip it).
   The capes are worn in the cape slot (the costume layer has no cape slot).
   A founder test purchase (topup.js buy) calls NC.Founder.grant(game, sku); a ledger bought before this file existed is
   caught up when the game starts (NC.HUD.init). The cards' icons (assets/topup/it_lanternhat|cloak|cloakglow|emote.png)
   are renders of these items from the game (tools/founder_icons.js; the Codex icons kept in assets/gen/topup_it_codex/).
   Test: ?paytest&topup (buy a founder pack), or ?equip=hat_founder_lantern,cape_founder_glow. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS;
  // founder item -> [the game item whose picture it wears, name, text]
  const FROM = {
    hat_founder_lantern: ['hat_hc_misc_lantern', 'หมวกตะเกียงผู้บุกเบิก', 'หมวกนิรภัยของผู้บุกเบิกค่ายรุ่นแรก ตะเกียงทองเหลืองข้างหน้าไม่เคยดับ'],
    cape_founder_ash: ['cape_nfalcon', 'ผ้าคลุมเถ้ากองไฟ', 'ผ้าคลุมขนสีเถ้าถ่าน ปลายขนแดงเหมือนถ่านที่ยังคุ'],
    cape_founder_glow: ['cape_efalcon', 'ผ้าคลุมเถ้ากองไฟ เรืองแสง', 'ผ้าคลุมเถ้ากองไฟสีม่วงเงา ปลายขนเรืองแสงในความมืด'],
  };
  const LOOK = ['sprite', 'icon', 'fit', 'seat', 'dx', 'clip', 'soft', 'rim', 'rimBehind', 'hood', 'back', 'front', 'art', 'trail', 'wave'];
  const copyLook = (id) => { const src = ITEMS[FROM[id][0]], it = ITEMS[id]; if (src && it) for (const k of LOOK) if (src[k] !== undefined) it[k] = src[k]; };
  const list = [];
  for (const id in FROM) {
    const src = ITEMS[FROM[id][0]];
    if (!src) continue;                                            // (that game item isn't loaded)
    ITEMS[id] = { slot: src.slot, name: FROM[id][1], rarity: 'fashion', stats: {}, founder: true, bound: true,
      desc: FROM[id][2] + ' · ของแพคผู้บุกเบิก ช่วงทดสอบเท่านั้น · ไม่เพิ่มพลัง ผูกกับบัญชี' };
    copyLook(id);
    list.push(id);
  }

  // ---------------- what each founder pack gives (each tier has everything of the tiers below it) ----------------
  const TIERS = {
    f349: ['hat_founder_lantern'],
    f1290: ['hat_founder_lantern', 'cape_founder_ash'],
    f3990: ['hat_founder_lantern', 'cape_founder_ash', 'cape_founder_glow'],
  };
  function grant(game, sku, quiet) {
    const p = game && game.player, got = [];
    if (!p || !TIERS[sku]) return got;
    for (const id of TIERS[sku]) {
      if (!ITEMS[id] || p.owned.has(id)) continue;
      p.owned.add(id); p.fresh.add(id); got.push(id);
    }
    if (got.length && !quiet && NC.HUD && NC.HUD.log) NC.HUD.log(`ของผู้บุกเบิก: ${got.map((id) => ITEMS[id].name).join(' · ')} (ดูในกระเป๋า แท็บแฟชั่น)`, 'level');
    return got;
  }
  const baseInit = NC.HUD.init;
  NC.HUD.init = function (game) {
    for (const id of list) copyLook(id);                          // (the hat's fit as the hat page / Lab left it on the source)
    const r = baseInit.apply(this, arguments);
    const T = NC.TopUp, bought = T && T.state ? T.state().founders || {} : {};
    let n = 0;
    for (const sku in bought) if (bought[sku]) n += grant(game, sku).length;
    if (n) NC.saveGame(game);
    return r;
  };

  if (NC.ITEM_ORDER) for (const id of list) if (!NC.ITEM_ORDER.includes(id)) NC.ITEM_ORDER.push(id);
  NC.Founder = { list, FROM, TIERS, grant, is: (id) => !!(ITEMS[id] && ITEMS[id].founder) };
})();
