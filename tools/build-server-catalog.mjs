import fs from "node:fs";
import vm from "node:vm";
// Some browser-only boot hooks launch promises before reaching an absent DOM.
// They have no authority in this build sandbox and are recorded as skipped.
process.on("unhandledRejection", (error) =>
  partial.push({
    module: "async-browser-hook",
    stoppedAt: String(error.message),
  }),
);
const root = new URL("../dist-full/game-20261025-1758/js/", import.meta.url);
const NC = {
  FX: {},
  HUD: {},
  SLOT_NAME: {},
  MONSTERS: {},
  SKILLS: {},
  JOBS: {},
  ITEMS: {},
  clamp: (n, a, b) => Math.max(a, Math.min(b, n)),
};
const context = vm.createContext({
  window: { NC, addEventListener() {} },
  document: {
    getElementById() {
      return null;
    },
    addEventListener() {},
  },
  location: { search: "" },
  URLSearchParams,
  console,
  performance: { now: () => 0 },
});
// These public modules assign data before installing browser hooks. Browser
// hooks intentionally cannot execute in this isolated, offline build context.
const modules = [
  "items",
  "stats",
  "maps",
  "monsters",
  "materials",
  "weapons",
  "class2",
  "class3",
  "jobs3",
  "magicgear",
  "forgecraft",
];
const partial = [];
for (const name of modules) {
  try {
    vm.runInContext(
      fs.readFileSync(new URL(name + ".js", root), "utf8"),
      context,
      { timeout: 1000 },
    );
  } catch (e) {
    partial.push({ module: name, stoppedAt: e.message });
  }
}
// Replay the current build's ordered CAS modules as well, so appended map,
// class, item and skill data are recovered even when their renderer cannot run.
const build = new URL("../dist-full/game-20261025-1758/", import.meta.url);
const index = fs.readFileSync(new URL("index.html", build), "utf8");
for (const [, src] of index.matchAll(/<script[^>]+src="(cas\/[^"]+\.js)"/g)) {
  try {
    vm.runInContext(fs.readFileSync(new URL(src, build), "utf8"), context, {
      timeout: 50,
    });
  } catch (e) {
    partial.push({ module: src, stoppedAt: e.message });
  }
}
const catalog = {};
for (const key of [
  "ITEMS",
  "MAPS",
  "MONSTERS",
  "MATERIALS",
  "MAT_DROPS",
  "JOBS",
  "JOB_WEAPONS",
  "WTYPES",
  "SKILLS",
])
  catalog[key] = NC[key] || {};
// Preserve level-dependent skill costs/damage without evaluating client code at runtime.
catalog.SKILLS = Object.fromEntries(
  Object.entries(NC.SKILLS).map(([id, s]) => [
    id,
    {
      ...s,
      costs: Array.from({ length: 11 }, (_, i) =>
        typeof s.sp === "function" ? s.sp(Math.max(1, i)) : Number(s.sp || 0),
      ),
      multipliers: Array.from({ length: 11 }, (_, i) =>
        typeof s.mul === "function"
          ? s.mul(Math.max(1, i))
          : Number(s.mul || 1),
      ),
    },
  ]),
);
catalog.experience = {
  base: Array.from({ length: 100 }, (_, i) => NC.xpNext(Math.max(1, i))),
  jobs: Object.fromEntries(
    Object.keys(NC.JOBS).map((j) => [
      j,
      Array.from({ length: 101 }, (_, i) => NC.jobNext(Math.max(1, i), j)),
    ]),
  ),
};
catalog.provenance = {
  build: "game-20261025-1758",
  modules,
  partial,
  note: "Public data only; clone server formulas and scenarios are independent.",
};
fs.mkdirSync(new URL("../server/data-catalog/", import.meta.url), {
  recursive: true,
});
fs.writeFileSync(
  new URL("../server/data-catalog/catalog.json", import.meta.url),
  JSON.stringify(catalog, null, 2) + "\n",
);
console.log(
  Object.fromEntries(
    Object.entries(catalog)
      .filter(([, v]) => v && typeof v === "object")
      .map(([k, v]) => [k, Object.keys(v).length]),
  ),
);
