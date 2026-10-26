/* hatpair_data.js — a hat's fit on ONE hairstyle, fitted by hand on the hat fitting page (studio/hats.html, "คู่หมวก × ทรงผม")
   and written there by tools/studio_serve.mjs (or baked from a browser by tools/bake_hatpairs.mjs). js/hatpair.js puts a
   pair's fit over the hat's own fit (js/hatfit_data.js / items.js) when that hat sits on that hair.
   pairs: { hat id: { hair key: { dx, seat, fit, rot (deg), clip, trim } } }; hair key = the hair item ('hair_spiky') or
   'lk:<hairstyle>' for a head made in the character creator (any colour, eyes or mouth). t: when it was saved. */
NC.HATPAIR_DATA = {
 "t": 0,
 "pairs": {}
};
