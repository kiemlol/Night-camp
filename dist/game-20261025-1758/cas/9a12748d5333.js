/* monsters8.js — the monsters of the hunting areas' new sections (js/fields7.js), from NC.AREA_DATA (js/areas_data.js,
   written by assets/gen/loot/areas_build.py from areas_data.py: edit that). Like the pilot's js/monsters7.js: every
   section holds 6 kinds, 3 of its area, 2 of its own (each fights in one of monkinds.js's ways), 1 rare form (a
   hue-shifted copy of one of its own: monsters6.js's loader paints it; HP x1.8, EXP x2, about 1 in 30 of the section's
   monsters). Each new species drops its own material, the rare forms their base's at x1.5. Gear tables come with the
   next drop_plan.py run (each item keeps exactly one source). Art: assets/monsters/ (areas_build.py prompts -> mon8_*
   sheets). Load after monsters7.js and js/areas_data.js. */
(function () {
  'use strict';
  const NC = window.NC, D = NC.AREA_DATA;
  if (!D || !NC.SPECIES || !NC.ROSTER) return;
  // the same bases as monsters6.js
  const SLIME = { kind: 'hop', r: 26, hpK: 0.65, atkK: 0.75, defK: 0.4, mdefK: 1.2, agiK: 0.3, dexK: 0.5, expK: 0.8, spd: 0, aggro: 480 };
  const MON = { r: 24, hpK: 1, atkK: 1, defK: 1, mdefK: 0.5, agiK: 0.6, dexK: 0.7, expK: 1.2, spd: 150, aggro: 560 };
  for (const [id, S] of Object.entries(D.species)) {
    if (NC.SPECIES[id]) continue;
    const o = Object.assign({}, S.kind === 'hop' ? SLIME : MON, S);
    NC.SPECIES[id] = o; NC.MONSTERS[id] = o;
  }
  const ELITE = { hpK: 1.8, atkK: 1.25, defK: 1.2, expK: 2 };
  for (const [id, base, suffix, hue] of D.elites) {
    const B = NC.SPECIES[base];
    if (!B || NC.SPECIES[id]) continue;
    const o = Object.assign({}, B, { name: B.name + ' · ' + suffix, hue, eliteOf: base });
    for (const k in ELITE) o[k] = (B[k] || 1) * ELITE[k];
    NC.SPECIES[id] = o; NC.MONSTERS[id] = o;
  }
  // who lives where (the maps' 'slime' / 'hollow' slots, by zone; '*' = the rest of the map); only species that exist
  // and have their pictures (a sheet not cut yet: its two wait, the area's old ones fill in)
  const PIC = NC.ASSET_MANIFEST_MONSTERS || {};
  const known = (list) => list.filter(([id]) => NC.SPECIES[id] && (PIC[NC.SPECIES[id].eliteOf || id] || !D.species[NC.SPECIES[id].eliteOf || id]));
  for (const [map, zones] of Object.entries(D.roster)) {
    if (NC.ROSTER[map]) continue;
    const sec = D.sections.find((s) => s.id === map), par = sec && NC.ROSTER[sec.parent] && NC.ROSTER[sec.parent]['*'];
    const R = {};
    for (const [z, v] of Object.entries(zones)) {
      const slime = known(v.slime), hollow = known(v.hollow);
      if (z !== '*' && (!slime.length || !hollow.length)) continue; // (that zone falls back to the rest of the map)
      R[z] = { slime: slime.length ? slime : par ? par.slime : [], hollow: hollow.length ? hollow : par ? par.hollow : [] };
    }
    NC.ROSTER[map] = R;
  }
  if (NC.MATERIALS && NC.MAT_DROPS) {
    for (const [id, m] of Object.entries(D.materials)) if (!NC.MATERIALS[id]) NC.MATERIALS[id] = m;
    for (const [id, d] of Object.entries(D.drops)) if (!NC.MAT_DROPS[id]) NC.MAT_DROPS[id] = d;
  }
})();
