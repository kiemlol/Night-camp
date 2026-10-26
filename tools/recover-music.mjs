import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const build = new URL("../dist-full/game-20261025-1758/", import.meta.url);
const source = fs.readFileSync(new URL("js/music_list.js", build), "utf8");
const tracks = [
  ...new Set(
    [...source.matchAll(/"src":\s*"(assets\/music\/[^"]+)"/g)].map((m) => m[1]),
  ),
];
let next = 0,
  downloaded = 0;
const failures = [];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (next < tracks.length) {
      const relative = tracks[next++],
        file = fileURLToPath(new URL(relative, build));
      if (fs.existsSync(file) && fs.statSync(file).size > 0) continue;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const code = await new Promise((resolve) => {
        const p = spawn("curl", [
          "--fail",
          "--silent",
          "--show-error",
          "--retry",
          "1",
          "--max-time",
          "45",
          "https://play.nightcamp.app/game-20261025-1758/" + relative,
          "--output",
          file,
        ]);
        p.on("exit", resolve);
        p.on("error", () => resolve(1));
      });
      if (code) failures.push(relative);
      else downloaded++;
    }
  }),
);
console.log({ tracks: tracks.length, downloaded, failures });
if (failures.length) process.exitCode = 1;
