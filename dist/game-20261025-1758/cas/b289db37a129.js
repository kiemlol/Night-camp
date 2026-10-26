/* forgecraft.js — ป๋าหมูหริ่ง forges every weapon type (the economy plan "ปิดรูรั่ว + ให้เงินมีที่ไป", 2026-10-04: junk and
   coins need somewhere to go besides the merchant, and a weapon of the new grade should not be luck alone). One ธรรมดา
   (A) weapon per type and grade: the 28 catalog types (js/wcatalog.js) and the one-handed swords (js/swords.js); the
   greatswords keep their own (js/greatswords.js) but are priced on the same table:
     which  grade 1: the type's A nearest Lv 10 · grades 2, 3, 4: the grade's first A (Lv ~26 / ~52 / ~77)
     junk   40 / 80 / 150 / 300 of two monster materials from around the weapon's level (60% + 40%; each type a pair
            of its own, so different junk is wanted at the forge)
     ore    metal types: iron 5 / silver 10 / moon silver 20 / fire ore 30 + star ore 3; wooden types (bows, staves,
            instruments, books, puppets, torches): pine / willow / silverwood / ancient wood + moon wood; the orb:
            quartz / amber / soul crystal / obsidian + star ore (the life skills' mining and woodcutting)
     coins  20,000 / 150,000 / 600,000 / 2,000,000
   A made weapon starts with its grade's option rows like a drop (NC.WBAG.make, js/forge.js make). The lucky ones (B, C,
   D, L, moonlit) still only drop. The samurai line's katana and nodachi (js/samurai.js TIERS) are forged the same way. The table below was written from the game's data (each recipe's pair: the species
   living around the weapon's level, by NC.MAT_NATIVE / NC.ROSTER and the maps' levels).
   NC.FORGE_CRAFT: types(), list(type), src(id) — read by the forge's ตีอาวุธ tab. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS;
  const JUNK = [40, 80, 150, 300], COINS = [20000, 150000, 600000, 2000000];
  const ORE = {
    metal: [{ lf_iron: 5 }, { lf_silver: 10 }, { lf_moonsilver: 20 }, { lf_fireore: 30, lf_starore: 3 }],
    wood: [{ lf_pine: 5 }, { lf_willow: 10 }, { lf_silverwood: 20 }, { lf_ancient: 30, lf_moonwood: 3 }],
    crystal: [{ lf_quartz: 5 }, { lf_amber: 10 }, { lf_soul: 20 }, { lf_obsidian: 30, lf_starore: 3 }],
  };
  const WOOD = new Set(['bow', 'xbow', 'staff', 'qstaff', 'instrument', 'puppet', 'torch', 'book']), CRYSTAL = new Set(['orb']);
  const family = (t) => (WOOD.has(t) ? 'wood' : CRYSTAL.has(t) ? 'crystal' : 'metal');
  // type: [grade 1, 2, 3, 4] = [weapon, junk 60%, junk 40%]
  const T = {
    sword: [['sw_copper', 'mat_boar_tusk', 'mat_bat_wing'], ['sw_iron', 'mat_crow_feather', 'mat_sleep_dust'], ['sw_moonsteel', 'mat_gust_orb', 'mat_goat_horn'], ['sw_starmetal', 'mat_fire_wing', 'mat_imp_fork']],
    spear: [['sp_tusk', 'mat_bat_wing', 'mat_leaf_jelly'], ['sp_iron', 'mat_cursed_straw', 'mat_ant_powder'], ['sp_antler', 'mat_glow_web', 'mat_brass_bell'], ['sp_heartwood', 'mat_salamander_scale', 'mat_bell_collar']],
    lance: [['ln_pinecone', 'mat_echo_ear', 'mat_leaf_jelly'], ['ln_pike', 'mat_water_jelly', 'mat_blue_plume'], ['ln_snakefang', 'mat_storm_feather', 'mat_snow_fur'], ['ln_raptor', 'mat_miner_lamp', 'mat_frill_scale']],
    axe: [['ax_tusk', 'mat_honeycomb', 'mat_boar_tusk'], ['ax_bearded', 'mat_frog_lily', 'mat_frog_cheek'], ['ax_damascus', 'mat_black_salt', 'mat_snow_fur'], ['ax_royal', 'mat_kappa_dish', 'mat_shadow_quill']],
    gaxe: [['ga_stoneslime', 'mat_pumpkin_stem', 'mat_boar_tusk'], ['ga_dane', 'mat_frog_lily', 'mat_jelly_cap'], ['ga_bardiche', 'mat_wind_stone', 'mat_stone_feather'], ['ga_warlord', 'mat_ladybug_shell', 'mat_raptor_claw']],
    hammer: [['hm_acorn', 'mat_boar_tusk', 'mat_pumpkin_stem'], ['hm_sledge', 'mat_pearl_horn', 'mat_ant_shell'], ['hm_anvil', 'mat_brass_bell', 'mat_glow_web'], ['hm_titan', 'mat_imp_fork', 'mat_brass_button']],
    mace: [['mc_ladybug', 'mat_pumpkin_stem', 'mat_echo_ear'], ['mc_flanged', 'mat_pearl_horn', 'mat_old_bone'], ['mc_knight', 'mat_scorpion_sting', 'mat_glow_mane'], ['mc_cage', 'mat_bell_collar', 'mat_crystal_wing']],
    dagger: [['dg_flint', 'mat_leaf_jelly', 'mat_carrot_top'], ['dg_hunter', 'mat_turtle_moss', 'mat_nest_fluff'], ['dg_damascus', 'mat_snow_fur', 'mat_black_salt'], ['dg_parry', 'mat_sandstone_slab', 'mat_miner_lamp']],
    katar: [['kt_scarecrow', 'mat_cursed_straw', 'mat_boar_tusk'], ['kt_steel', 'mat_shovel_leg', 'mat_rooster_feather'], ['kt_piercer', 'mat_gust_orb', 'mat_goat_horn'], ['kt_masterwork', 'mat_shadow_quill', 'mat_heron_plume']],
    bow: [['bw_ashwood', 'mat_pumpkin_stem', 'mat_boar_tusk'], ['bw_steel', 'mat_ant_wing', 'mat_sprout_potato'], ['bw_ebony', 'mat_glow_web', 'mat_brass_bell'], ['bw_composite', 'mat_raptor_claw', 'mat_spore_pod']],
    xbow: [['xb_iron', 'mat_echo_ear', 'mat_pumpkin_stem'], ['xb_arbalest', 'mat_zombie_patch', 'mat_dragonfly_wing'], ['xb_hunter', 'mat_glow_mane', 'mat_scorpion_sting'], ['xb_repeater', 'mat_brass_button', 'mat_magma_core']],
    staff: [['st_tusk', 'mat_bat_wing', 'mat_leaf_jelly'], ['st_quartz', 'mat_zombie_patch', 'mat_crab_claw'], ['st_golemfist', 'mat_black_salt', 'mat_snow_fur'], ['st_rootheart', 'mat_crystal_wing', 'mat_sand_orb']],
    orb: [['ob_slingshot', 'mat_leaf_jelly', 'mat_carrot_top'], ['ob_gimbal', 'mat_glow_jelly', 'mat_hedge_spine'], ['ob_geode', 'mat_goat_horn', 'mat_gust_orb'], ['ob_magmacore', 'mat_miner_lamp', 'mat_sandstone_slab']],
    lantern: [['lt_snail', 'mat_nest_fluff', 'mat_bat_wing'], ['lt_hurricane', 'mat_crow_feather', 'mat_sleep_dust'], ['lt_golemhead', 'mat_goat_horn', 'mat_acorn_helm'], ['lt_beacon', 'mat_heron_plume', 'mat_venom_bulb']],
    book: [['bk_slate', 'mat_boar_tusk', 'mat_pumpkin_stem'], ['bk_iron', 'mat_cursed_straw', 'mat_ant_powder'], ['bk_golem', 'mat_wind_stone', 'mat_gust_orb'], ['bk_beetle', 'mat_spore_pod', 'mat_beetle_horn']],
    knuckle: [['kn_spider', 'mat_boar_tusk', 'mat_pumpkin_stem'], ['kn_steel', 'mat_bucket_lid', 'mat_moss_shell'], ['kn_golem', 'mat_toad_gland', 'mat_glow_web'], ['kn_bluesteel', 'mat_magma_core', 'mat_mist_veil']],
    qstaff: [['qs_birch', 'mat_bat_wing', 'mat_leaf_jelly'], ['qs_ironbound', 'mat_water_jelly', 'mat_trout_scale'], ['qs_ironwood', 'mat_gust_orb', 'mat_goat_horn'], ['qs_treeroot', 'mat_sand_orb', 'mat_crystal_wing']],
    huuma: [['hu_samara', 'mat_bat_wing', 'mat_nest_fluff'], ['hu_steel', 'mat_frog_lily', 'mat_jelly_cap'], ['hu_redstone', 'mat_glow_web', 'mat_brass_bell'], ['hu_beetle', 'mat_sandstone_slab', 'mat_cart_wheel']],
    dsword: [['ds_bronze', 'mat_echo_ear', 'mat_pumpkin_stem'], ['ds_saber', 'mat_dragonfly_wing', 'mat_grave_chip'], ['ds_duelist', 'mat_glow_mane', 'mat_scorpion_sting'], ['ds_royal', 'mat_venom_bulb', 'mat_young_bud']],
    bell: [['bl_stoneslime', 'mat_pumpkin_stem', 'mat_boar_tusk'], ['bl_brass', 'mat_pearl_horn', 'mat_old_bone'], ['bl_bronze', 'mat_black_salt', 'mat_snow_fur'], ['bl_magma', 'mat_beetle_horn', 'mat_spore_pod']],
    instrument: [['in_maple', 'mat_boar_tusk', 'mat_bat_wing'], ['in_oak', 'mat_turtle_moss', 'mat_nest_fluff'], ['in_ebony', 'mat_goat_horn', 'mat_gust_orb'], ['in_hurdy', 'mat_mist_veil', 'mat_worm_plate']],
    whip: [['wp_boarhide', 'mat_nest_fluff', 'mat_bat_wing'], ['wp_bullwhip', 'mat_shovel_leg', 'mat_rooster_feather'], ['wp_steelchain', 'mat_brass_bell', 'mat_glow_web'], ['wp_royal', 'mat_orange_core', 'mat_cart_lantern']],
    pistol: [['ps_tusk', 'mat_pumpkin_stem', 'mat_rooster_feather'], ['ps_pepperbox', 'mat_jelly_cap', 'mat_crab_claw'], ['ps_duelist', 'mat_scorpion_sting', 'mat_glow_mane'], ['ps_magma', 'mat_cart_wheel', 'mat_frill_scale']],
    shotgun: [['sg_honey', 'mat_leaf_jelly', 'mat_boar_tusk'], ['sg_double', 'mat_grave_chip', 'mat_hedge_spine'], ['sg_golem', 'mat_snow_fur', 'mat_black_salt'], ['sg_lavaworm', 'mat_heron_plume', 'mat_venom_bulb']],
    scythe: [['sc_boar', 'mat_boar_tusk', 'mat_pumpkin_stem'], ['sc_iron', 'mat_zombie_patch', 'mat_crab_claw'], ['sc_golem', 'mat_spark_tuft', 'mat_puff_spore'], ['sc_beetle', 'mat_root_fiber', 'mat_fire_wing']],
    sickle: [['sk_maple', 'mat_boar_tusk', 'mat_bat_wing'], ['sk_steel', 'mat_glow_jelly', 'mat_hedge_spine'], ['sk_hawkbill', 'mat_glow_web', 'mat_brass_bell'], ['sk_master', 'mat_worm_plate', 'mat_salamander_scale']],
    puppet: [['pp_crab', 'mat_echo_ear', 'mat_pumpkin_stem'], ['pp_tent', 'mat_corn_cob', 'mat_moss_shell'], ['pp_golem', 'mat_golem_core', 'mat_black_salt'], ['pp_magma', 'mat_cart_lantern', 'mat_mole_lamp']],
    wire: [['wr_pebble', 'mat_leaf_jelly', 'mat_echo_ear'], ['wr_anchor', 'mat_sun_petal', 'mat_trout_scale'], ['wr_golem', 'mat_black_salt', 'mat_snow_fur'], ['wr_lavaworm', 'mat_frill_scale', 'mat_kappa_dish']],
    torch: [['tc_pinecone', 'mat_boar_tusk', 'mat_pumpkin_stem'], ['tc_iron', 'mat_bucket_lid', 'mat_moss_shell'], ['tc_golem', 'mat_glow_web', 'mat_toad_gland'], ['tc_magma', 'mat_rock_feather', 'mat_ladybug_shell']],
    // the samurai line's A tiers (js/samurai.js TIERS; the owner, 2026-10-07, the endgame balance audit: the katana and
    // the nodachi had no weapon to forge); metal, a pair of their own, skipped where the samurai line isn't loaded
    katana: [['ka_iron', 'mat_leaf_jelly', 'mat_nest_fluff'], ['ka_steel', 'mat_dragonfly_wing', 'mat_turtle_moss'], ['ka_moonsteel', 'mat_storm_feather', 'mat_glow_mane'], ['ka_starsteel', 'mat_raptor_claw', 'mat_shadow_quill']],
    nodachi: [['nd_iron', 'mat_boar_tusk', 'mat_carrot_top'], ['nd_steel', 'mat_old_bone', 'mat_frog_cheek'], ['nd_oni', 'mat_black_salt', 'mat_scorpion_sting'], ['nd_dragonsteel', 'mat_magma_core', 'mat_worm_plate']],
  };
  const SRC = {}, BY = {};
  for (const t in T) {
    BY[t] = [];
    T[t].forEach((r, i) => {
      if (!r || !ITEMS[r[0]]) return;
      const g = i + 1, craft = { [r[1]]: Math.round(JUNK[i] * 0.6), [r[2]]: Math.round(JUNK[i] * 0.4) };
      Object.assign(craft, ORE[family(t)][i]);
      SRC[r[0]] = { craft, coins: COINS[i], grade: g };
      BY[t].push(r[0]);
    });
  }
  // the greatswords' own recipes on the same table: their junk kept in the same shares, the metal ore and the coins added
  // (were 2,000 / 15,000 / 60,000 / 250,000 coins and 15–24 junk); the trophy legend and the wooden one stay as they are
  for (const id of (NC.GS && NC.GS.list) || []) {
    const s = ITEMS[id].gs.src, g = ITEMS[id].gs.grade;
    if (!s.craft || s.forge || s.shop) continue;
    const n = Object.values(s.craft).reduce((a, b) => a + b, 0), craft = {};
    for (const m in s.craft) craft[m] = Math.max(1, Math.round((JUNK[g - 1] * s.craft[m]) / n));
    s.craft = Object.assign(craft, ORE.metal[g - 1]);
    s.coins = COINS[g - 1];
  }
  const gsList = () => ((NC.GS && NC.GS.list) || []).filter((id) => { const s = ITEMS[id].gs.src; return s.craft || s.shop; });
  NC.FORGE_CRAFT = {
    types: () => Object.keys(NC.WTYPES || {}).filter((t) => (t === 'gsword' ? gsList().length : (BY[t] || []).length)),
    list: (t) => (t === 'gsword' ? gsList() : (BY[t] || []).filter((id) => NC.itemReady(id))),
    src: (id) => (ITEMS[id] && ITEMS[id].gs ? ITEMS[id].gs.src : SRC[id]) || null,
  };
})();
