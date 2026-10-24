// dmgbeats.js — the beats of every skill's effect for the burst damage numbers (js/dmgburst.js): sid → delays (s) after
// the hit, one number on each (the damage lands once; the parts add up to it); 'tick' = a small quick number (zones,
// beams, channels, damage over time). Read from each skill's VFX code, 2026-10-03 (the user: "ให้สกิลของทุกอาชีพแตกเลข
// ตามจังหวะเอฟเฟกต์"); the last file to define a skill's look wins (emberfx, frostfx, arcanefx, ninjastars, heavenfx).
// A skill missing here: 2 beats (an ultimate 4), or a tick when it hits the same monster again within 0.45 s. A 'tick'
// skill's big finisher (a hit flagged big) still gets 3 beats. The Samurai line sets its own (js/samurai_skills.js BEATS).
NC.DMG_BEATS = {
  am_arcaneflux: [0], // small homing orb from aura every 1.5 s
  am_blizzard: 'tick', // blizzard zone hits every 0.35 s for 3.5 s
  am_chain: [0, 0.05], // lightning bolt strikes then spark burst, per jump
  am_doublecast: [0, 0.06], // one of three element bursts 0.12 s apart
  am_eclipse: [0, 0.05, 0.1, 0.16], // ultimate: ring plus six beams per wave, x3 nova finale
  am_firepillar: [0, 0.07], // each of 3 fire-tornado columns bursts up
  am_glacial: [0, 0.06], // ice spear pierces with shard sparks
  am_gravity: 'tick', // black hole zone hits every 0.35 s for 3 s
  am_inferno: 'tick', // fire zone hits every 0.4 s for 4 s
  am_lordthunder: [0], // each storm bolt a full number
  am_missile: [0, 0.05], // each moon missile: flare then ring
  am_orbs: 'tick', // orbiting element orbs hit every 0.5 s
  am_trinity: 'tick', // orbiting orbs auto-fire a shot every 0.6 s
  am_weave: [0, 0.06, 0.12], // fusion blasts (steam, glacier slab); tornado/sand also tick here
  ar_charge: [0, 0.06], // heavy arrow slams, then a burst on the target
  ar_multishot: [0], // each fan arrow one light hit with sparks
  ar_snare: [0, 0.06], // thorn spikes snap up, then vines wrap it
  as_deathmark: [0], // ten warp cuts 0.08 s apart; x3 X finale shares sid
  as_grimtooth: [0, 0.05], // shadow spike erupts under each monster once
  as_knives: [0], // single poison knife hit, small sparks
  as_meteor: [0, 0.05, 0.1], // eight radial blood slashes plus burst nova
  as_splasher: [0, 0.06, 0.12], // poison bomb blast: burst, bubbles, goo, smoke
  as_twin: [0], // each of two dash slashes calls its own hit
  ax_chain: [0, 0.05], // core chain: bolt lands plus glow sparks
  ax_lord: [0, 0.06, 0.12], // core pillar: beam strikes, burst ring, stars
  ax_orbs: [0], // core shards: one small shard each, several at once
  ax_planets: [0, 0.05, 0.1, 0.16], // planet alignment: three beams then big nova, rings
  ax_recall: [0, 0.05, 0.1], // core echo: X of two cuts plus flare
  b_blades: [0], // each spectral sword stabs once, 0.07 s apart
  b_fall: [0, 0.05, 0.1, 0.16], // ultimate: one big pillar per monster, ring, crack, sparks
  b_hellfire: [0, 0.06], // vortex waves 0.3 s apart
  b_plague: [0, 0.05, 0.1, 0.16], // ultimate: miasma skull blast, smoke ring, big ring
  b_quake: [0, 0.12, 0.24], // three spike rings burst at 0, 0.12, 0.24 s
  b_ritual: [0, 0.06, 0.12], // hands squeeze, then crimson pillar with ring and sparks
  bash: [0, 0.06, 0.12], // great slash, impact starburst, ground crack ring, hitstop
  bc_beam: 'tick', // rotating lighthouse beam hits every 0.4 s
  bc_dawn: [0, 0.06, 0.12], // core nova: burst ring, glow, stars on target
  bc_flash: [0, 0.06, 0.12], // core pillar: beam strikes, burst ring, stars
  bc_swing: [0, 0.06, 0.12], // core nova: burst ring, glow, stars on target
  bd_festival: 'tick', // campfire burn aura hits every 1s for 15s
  bd_lash: [0, 0.06], // whip line cracks then fire slash on target
  bd_note: [0], // bouncing note projectile, light spark pop per hit
  bd_noterain: [0], // each note lands: a full number
  bd_twirl: 'tick', // fire whip circling, hits every 0.25s for 2s
  bi_heal: [0], // heal nova, fx off: no impact look on monsters
  bi_lexdivina: [0, 0.06], // seal burst plus a bolt dropping on each monster
  bi_miracle: [0, 0.05, 0.1, 0.16], // ultimate: ten beams plus big burst with stars
  bi_sanctuary: 'tick', // holy zone hits every 0.5 s for 8 s
  bi_turnundead: [0, 0.06, 0.12], // sky beam, then burst with ring, sparks and stars
  bk_bleed: 'tick', // bleed damage over time each second
  bk_crosscut: [0, 0.07], // one cut per hit call (combo of 2-3 cuts)
  bk_guillotine: [0, 0.06, 0.12], // drop chop: beam, down slash, bleed burst, hitstop
  bk_hurl: [0, 0.06], // spinning thrown weapon passes through, out and back
  bk_leap: [0, 0.06, 0.12], // big slam nova; optional 0.5 s quake zone shares sid
  bk_smash: [0, 0.06, 0.12], // cone slam: burst ring, crack, debris, stars
  bk_titan: [0, 0.06], // giant basic-hit shockwave slash; end aftershock nova shares sid
  bk_whirlwind: 'tick', // spinning channel hits every 0.2 s (lv10 end sweep shares sid)
  bm_cross: [0, 0.05, 0.1], // core echo: X of two cuts plus flare
  bm_guillotine: [0, 0.06, 0.12], // core pillar: beam strikes, burst ring, stars
  bm_leap: [0, 0.04, 0.08], // core spikes: line erupts past target 0.04 s apart
  bm_moon: [0, 0.06], // awakened giant shockwave slash cone on basic hits
  bm_smash: [0, 0.06, 0.12], // core nova: burst ring, glow, stars on target
  db_breath: 'tick', // core rain: 4-6 drops over 0.45 s hit repeatedly
  db_ember: [0, 0.06, 0.12], // ember blast nova, flames, flare; awakening flame cone
  db_leap: [0, 0.06, 0.12], // core nova: burst ring, glow, stars on target
  db_spiral: [0, 0.04, 0.08], // core spikes: line erupts past target 0.04 s apart
  db_thrust: [0, 0.05, 0.1], // core echo: X of two cuts plus flare
  dk_breath: 'tick', // channelled fire cone hits every 0.15 s, 8 times
  dk_charge: [0, 0.06], // charge impact then fire flare on each monster
  dk_leap: [0, 0.06, 0.12], // landing slam: flame ring burst, scorch, smoke, hitstop
  dk_roar: [0, 0.06, 0.12], // fire ring waves 0.3 s apart; x2.5 finale shares sid
  dk_spiral: [0], // drill hits: a full number on each
  dk_tail: [0, 0.06], // piercing fire lance hit, sets burn
  dk_thrust: [0, 0.06], // spear thrust then fire jet along the line
  dk_wyvern: [0, 0.06], // wyvern pet fireball lands and bursts small
  double: [0, 0.05], // per arrow: arrow hit then flare and ring
  dw_chain: [0, 0.05], // core chain: bolt lands plus glow sparks
  dw_cross: [0, 0.06, 0.12], // core nova: burst ring, glow, stars on target
  dw_dawn: [0, 0.05, 0.1, 0.16], // sun burst: big nova, beam, 12 radial slashes
  dw_strike: [0, 0.06, 0.12], // core pillar: beam strikes, burst ring, stars
  e: [0], // dash passes through: one small wind slash with leaves
  ec_dark: [0, 0.05, 0.1], // eclipse strike: two crossing slashes, big crit
  ec_grim: [0, 0.04, 0.08], // core spikes: line erupts past target 0.04 s apart
  ec_meteor: [0, 0.06, 0.12], // core nova: burst ring, glow, stars on target
  ec_splash: [0], // core shards: one small shard each, several at once
  ec_twin: [0, 0.05, 0.1], // core echo: X of two cuts plus flare
  envenom: [0, 0.05], // per slash (two moves): poison cut then drips splash
  fireball: [0, 0.06], // fireball lands in an ember dome explosion
  fm_burst: [0, 0.06, 0.12], // 8-burn detonation: ember dome blast with sparks
  fm_meteor: [0, 0.05, 0.1, 0.16], // ultimate: each meteor lands in fire dome, debris, scorch
  fm_pillar: [0, 0.07], // each eruption: fire column bursts up, sparks spray
  fm_ring: [0, 0.06], // fire band crossing hit plus pop splash on monster
  fm_sea: 'tick', // lava pool zone hits every 0.5 s
  fm_seek: [0], // little seeking fireball, small pop
  fm_vent: [0, 0.06, 0.12], // big fire dome blast, sparks, flame tongues
  frostdiver: [0, 0.05, 0.1], // spike groups erupt
  gale: [0, 0.06], // piercing wind arrow hit then wind ring and puff
  gs_buckshot: [0], // each of 9 pellets hits separately at once; already many numbers
  gs_kick: [0, 0.06], // point-blank blast: fire arc slash then smoke burst
  gs_pellet: [0], // shotgun basic's extra pellet, tiny hit; damage path carries no sid
  gs_rapid: [0], // one free extra bullet, single spark impact
  gs_ricochet: [0], // chain bounce: tracer line plus sparks, one blow per monster
  gs_smoke: [0, 0.06, 0.12], // grenade lands: burst ring, flare, smoke cloud
  gs_stars: [0, 0.05], // each falling star lands: a full number
  gs_triple: [0], // three separate bullets 0.08s apart, each a single spark hit
  holylight: [0, 0.06], // light beam strikes then ring and stars burst
  hv_execute: [0, 0.06, 0.12], // core pillar: beam strikes, burst ring, stars
  hv_hook: [0, 0.05], // core chain: bolt lands plus glow sparks
  hv_phase: [0, 0.05, 0.1, 0.16], // giant double crescent slash, flash, hitstop
  hv_return: [0, 0.05, 0.1], // core echo: X of two cuts plus flare
  hv_sweep: [0, 0.06, 0.12], // core nova: burst ring, glow, stars on target
  hx_chains: [0, 0.04, 0.08], // core spikes: line erupts past target 0.04 s apart
  hx_contagion: [0, 0.06], // ghost projectile hits plus ghost-fire flame
  hx_hex: [0, 0.06, 0.12], // core pillar: beam strikes, burst ring, stars
  hx_soulburn: [0, 0.06, 0.12], // core nova: burst ring, glow, stars on target
  hx_soulfire: [0, 0.05], // core chain: bolt lands plus glow sparks
  im_blizzard: [0], // funnel hits once a second
  im_breath: 'tick', // channelled cone breath hits every 0.5 s
  im_burst: [0, 0.06, 0.12], // crystal cluster shatters: star flash, 16 shards fly
  im_iceage: [0, 0.06], // ultimate cold pulse each second
  im_lance: [0, 0.06, 0.12], // lance pierces, shards burst, ice spikes sprout
  im_shatter: [0, 0.06], // frozen block breaks: debris burst plus ring
  judgment: [0, 0.05, 0.1, 0.16], // ultimate: giant light sword lands, rings, beams, sparks
  kn_bowling: [0, 0.06], // per spin (two moves): slash sweeps, then ring burst
  kn_cleave: [0, 0.06], // flying crescent sword wave hit
  kn_pierce: [0], // three thrusts 0.1 s apart, each one thin cut
  lk_dawn: 'tick', // dawn burns dark monsters screen-wide every 0.5s
  lk_flash: [0, 0.06, 0.12], // holy flash nova: ring, flare, stars, light beam
  lk_plant: 'tick', // planted torch burns nearby every 0.5s for 20s
  lk_radiance: 'tick', // light aura burns dark monsters every 0.5s
  lk_swing: [0, 0.06], // torch fire arc slash plus flames burst on target
  magnum: [0, 0.06, 0.12], // fire ring bursts out: flame burst plus two rings
  magnus: [0, 0.06], // pillar waves 0.38 s apart
  meteor: [0, 0.06, 0.12], // fire form: each rock lands in big dome, debris
  mf_combo: [0, 0.06, 0.12], // one meteor lands: ring, flames, scorch (awakening small ones)
  mf_crush: [0, 0.06, 0.12], // core nova: burst ring, glow, stars on target
  mf_impact: [0, 0.06, 0.12], // core pillar: beam strikes, burst ring, stars
  mf_palms: [0, 0.05, 0.1], // core echo: X of two cuts plus flare
  mf_storm: 'tick', // core rain: 4-6 drops over 0.45 s hit repeatedly
  mg_firewall: 'tick', // lava wall burns whoever touches it every 0.3 s
  mg_frostnova: [0, 0.06, 0.12], // ice nova burst, ring and spike circle erupt
  mg_quake: [0], // spike waves 0.14 s apart, each one eruption
  mo_asura: [0, 0.05, 0.1, 0.16], // ultimate: flare, flames, crack, stars, big shake
  mo_chi: [0, 0.06], // chi wave passes through, ring pops on target
  mo_combo: [0, 0.05], // one punch of four (0.13 s apart): flare plus sparks
  mo_impact: [0, 0.06, 0.12], // heavy palm: chi ring, flare, spark spray, hitstop
  mo_palms: [0], // barrage of palms: a full number on each
  ms_piercer: [0, 0.06, 0.12], // core pillar: beam strikes, burst ring, stars
  ms_snipe: [0, 0.05, 0.1], // core echo: X of two cuts plus flare
  ms_still: [0, 0.06], // piercing moon arrow line plus flare; awakening split arrows
  ms_trap: [0, 0.06, 0.12], // core nova: burst ring, glow, stars on target
  ms_triple: 'tick', // core rain: 4-6 drops over 0.45 s hit repeatedly
  mt_band: [0, 0.05], // golden note shot lands with sparks
  mt_lash: [0, 0.05], // core chain: bolt lands plus glow sparks
  mt_note: [0], // core shards: one small shard each, several at once
  mt_rain: 'tick', // core rain: 4-6 drops over 0.45 s hit repeatedly
  mt_twirl: [0, 0.06, 0.12], // core nova: burst ring, glow, stars on target
  ol_buckshot: [0], // core shards: one small shard each, several at once
  ol_deadeye: [0, 0.06], // time-slow crit shot: tracer line plus flare
  ol_ricochet: [0, 0.05], // core chain: bolt lands plus glow sparks
  ol_stars: 'tick', // core rain: 4-6 drops over 0.45 s hit repeatedly
  ol_triple: [0, 0.05, 0.1], // core echo: X of two cuts plus flare
  pa_blitz: 'tick', // core rain: 4-6 drops over 0.45 s hit repeatedly
  pa_command: [0, 0.05, 0.1], // core echo: X of two cuts plus flare
  pa_fang: [0], // core shards: one small shard each, several at once
  pa_howl: [0, 0.06], // spirit wolf dashes through plus slash
  pa_pack: [0, 0.06, 0.12], // core nova: burst ring, glow, stars on target
  pal_cross: [0, 0.05, 0.1], // X of light arms, then beams burst up
  pal_faithblade: [0, 0.06], // holy burst round hero with ring and stars
  pal_heaven: [0, 0.06], // each sword lands (heavenfx): impact shards then light column
  pal_holyblade: [0, 0.05], // holy X of two cuts on the target
  pal_sacrifice: [0, 0.06, 0.12], // big holy blast: beam, ring, stars, crack decal
  pal_shieldchain: [0, 0.06], // bouncing shield bash: sparks then ring per monster
  pal_strike: [0, 0.06], // big gold slash then holy flare over the cone
  pal_zeal: 'tick', // holy aura burns around hero every second
  pp_bind: [0, 0.06], // wires reel in, drag and cinch tight, strong single bind
  pp_control: [0, 0.06], // Lv10 charmed monster dies and bursts on neighbours
  pp_dance: [0, 0.06], // each of three 0.3s-apart puppet spins: 360 slash
  pp_guide: 'tick', // thread line cuts crossers every 0.5s
  pp_puppet: [0, 0.06], // puppet axe/shield slash arc on target (xbow arrow too)
  pp_stretch: 'tick', // steel wire trap hits touching monsters every 0.5s
  pp_theatre: [0, 0.06], // ultimate strings, once a second
  pr_duple: [0, 0.06], // holy beam from sky plus circle on target
  pr_heal: [0], // heal burns undead: one small holy flare
  q: [0, 0.06, 0.12], // golden cloud ring bursts out, two expanding rings and flare
  r: [0], // each flying ice shard is one blow; several shards may hit
  rg_fearbreeze: [0], // each extra arrow one light hit, arrows 0.05 s apart
  rg_freezetrap: [0, 0.06], // trap ring then ice spikes burst up
  rg_piercer: [0, 0.06], // big leaf arrow hit plus ring; vortex ticks share sid
  rg_snipe: [0, 0.06], // piercing laser shot then spark spray, hitstop
  rg_storm: 'tick', // rain of 40 arrows over 2.1 s
  rg_trap: [0, 0.06, 0.12], // trap explosion: flames, debris, smoke, scorch ring
  rg_triple: [0], // single light arrow hit with small sparks
  ro_backstab: [0, 0.06], // blood slash then sparks spray, with hitstop
  ro_raid: [0, 0.05, 0.1], // six shadow slashes fan out, then burst ring
  ro_steal: [0], // one light shadow slash
  rp_execute: [0, 0.05, 0.1], // moon beam drops, heavy downward cut, shake, big hit
  rp_ghost: [0], // ghost dash passes through, soul motes only
  rp_hook: [0, 0.06], // hooked monster yanked in, then a crescent cut
  rp_return: [0, 0.06], // spinning thrown sickle cuts through, out and back
  rp_storm: 'tick', // soul storm orbiting, hits every 0.5s for 6s
  rp_sweep: [0, 0.06], // each of two 360 scythe spins: big sweep plus shake
  sb_iai: [0, 0.05, 0.1], // core echo: X of two cuts plus flare
  sb_rain: 'tick', // core blades: 4-6 falling blades over 0.4 s
  sb_stars: [0, 0.06], // star mark small burst plus slash; awakening crystal blade
  sb_thousand: 'tick', // core rain: 4-6 drops over 0.45 s hit repeatedly
  sb_wave: [0], // core shards: one small shard each, several at once
  sc_core: [0, 0.05, 0.1, 0.16], // supernova: flash, hitstop, huge nova, ring, flames
  sc_pillar: [0, 0.06, 0.12], // core pillar: beam strikes, burst ring, stars
  sc_ring: [0], // core shards: one small shard each, several at once
  sc_sea: 'tick', // core rain: 4-6 drops over 0.45 s hit repeatedly
  sc_vent: [0, 0.06, 0.12], // core nova: burst ring, glow, stars on target
  sh_clone: [0], // many small shadow stars, each one light hit
  sh_fan: [0, 0.05], // spinning star slices through, out and back
  sh_huuma: [0, 0.05, 0.1], // big spinning huuma grinds through, out and back
  sh_katon: [0, 0.05], // fire petal hit then small flare
  sh_kunai: [0, 0.06, 0.12], // stuck kunai explodes: flames, ring, scorch, smoke
  sh_raiton: [0, 0.05, 0.1], // three lightning bolts slam plus big burst
  sh_ricochet: [0, 0.06], // star strikes with sparks plus flare, then bounces
  sh_shuriken: 'tick', // star ring hits every 0.12 s for 2.4 s
  sh_throwing: [0], // shadow twin star passes, one light hit
  sh_windblade: [0, 0.06], // wind dash slash cuts each monster passed
  shadowstep: [0, 0.06], // appears beside it: shadow slash then smoke puff
  shower: 'tick', // rain of 20 arrows 0.032 s apart
  sl_huuma: [0], // core shards: one small shard each, several at once
  sl_katon: [0, 0.06, 0.12], // core pillar: beam strikes, burst ring, stars
  sl_legion: [0], // copy's shadow star echo, one light hit
  sl_raiton: [0, 0.05], // core chain: bolt lands plus glow sparks
  sl_wind: [0, 0.05, 0.1], // core echo: X of two cuts plus flare
  sm_bladerain: [0, 0.06], // each of 6 moves: slash plus sparks, mark appears
  sm_enchant: [0], // small element proc on basic hit, few sparks
  sm_float: [0], // single small floating sword stab, few sparks
  sm_iai: [0, 0.06, 0.14], // dash cut on target, then cutline and flash at dash end
  sm_mark: [0, 0.05], // mark bursts as an X of two cuts
  sm_thousand: [0], // one homing shadow blade, plain light hit
  sm_wave: [0, 0.06], // flying crescent wave hit plus sparks and mark
  so_acts: [0, 0.06, 0.12], // curtain closes then golden nova with stars
  so_bind: [0, 0.06, 0.12], // core pillar: beam strikes, burst ring, stars
  so_dance: [0, 0.06, 0.12], // core nova: burst ring, glow, stars on target
  so_stretch: [0, 0.05], // core chain: bolt lands plus glow sparks
  so_swap: [0], // core shards: one small shard each, several at once
  sonic: [0], // flurry of 8 cuts: a full number on each
  ss_faith: [0, 0.06, 0.12], // star judgment pillar per target, burst with stars
  ss_lex: 'tick', // core rain: 4-6 drops over 0.45 s hit repeatedly
  ss_turn: [0, 0.06, 0.12], // core pillar: beam strikes, burst ring, stars
  st_mark: [0, 0.05], // core chain: bolt lands plus glow sparks
  st_merge: [0, 0.06, 0.12], // big star shot lands as nova with stars
  st_rush: 'tick', // core rain: 4-6 drops over 0.45 s hit repeatedly
  starfall: [0], // each falling star one impact; stars land 0.15 s apart
  starshot: [0, 0.05, 0.1, 0.16], // ultimate: starlight laser hits once, big, with sparks
  thunder: [0, 0.05, 0.1], // heavy bolt, thin bolt, flare and chain arc per target
  venomdust: 'tick', // poison cloud zone hits every 0.5 s
  wh_command: [0, 0.05], // each of three bites 0.16 s apart: lunge plus claws
  wh_fang: [0, 0.06], // arrow impact then three fang claw marks
  wh_pack: [0, 0.06], // spirit wolf rams through with a spark burst
  wh_wolf: [0, 0.05], // wolf pet bite lunge plus three claw marks
  wl_blaze: [0, 0.06], // small soul-fire burst on target splashes neighbours
  wl_chains: [0, 0.06], // rune burst then chains snap onto the monster
  wl_hex: [0, 0.06, 0.12], // hex mark detonates: burst ring, stars, flash
  wl_lantern: [0], // lantern pet's single soul-tether drain
  wl_parade: [0], // each ghost of the parade a full number
  wl_soulburn: 'tick', // curse burns every 0.5 s for 6 s
  wl_soulfire: [0, 0.06], // soul fireball explodes in a ring, ghost rises
  wl_swing: [0, 0.06], // ghost lands on monster, glow pop
  wl_wisps: 'tick', // three orbiting wisps shoot ghosts about every 0.33 s
  wn_armor: [0], // reflect/cast shards: one small shard each, several at once
  wn_blizzard: 'tick', // core rain: 4-6 drops over 0.45 s hit repeatedly
  wn_burst: [0, 0.06, 0.12], // core nova: burst ring, glow, stars on target
  wn_lance: [0, 0.04, 0.08], // core spikes: line erupts past target 0.04 s apart
  wn_statue: [0, 0.05], // statue ice shard lands with sparks, every 1 s
  ws_call: [0], // one wisp flies in, small spark pop
  ws_mark: [0], // marked wisp pops a small ring when monster is hit
  ws_night: 'tick', // fireflies swarm all monsters every 0.5s for 10s
  ws_rush: [0], // each wisp 0.06s apart is its own hit; volley already
  ws_swarm: 'tick', // orbiting wisps auto-shoot small orbs, staggered 0.08s volleys
};
