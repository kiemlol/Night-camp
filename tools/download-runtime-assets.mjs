import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const run = promisify(execFile);
const root = '/workspace/sites/nightcamp-game/dist-full/game-20261025-1758';
const origin = 'https://play.nightcamp.app';
const prefix = '/game-20261025-1758/';
const survey = JSON.parse(await readFile('/workspace/work/nightcamp-research/original-runtime-survey.json', 'utf8'));
const paths = [...new Set(survey.static_paths.map((x) => x.path).filter((x) => x.startsWith(prefix)).map((x) => x.slice(prefix.length)).filter(Boolean))];
const wanted = [];
for (const file of paths) {
  try { if ((await stat(join(root, file))).size > 0) continue; } catch { /* missing */ }
  wanted.push(file);
}

let cursor = 0;
const results = [];
async function worker() {
  while (cursor < wanted.length) {
    const file = wanted[cursor++], out = join(root, file);
    await mkdir(dirname(out), { recursive: true });
    try {
      await run('curl', ['--fail', '--location', '--retry', '4', '--retry-all-errors', '--connect-timeout', '10', '--max-time', '90', '--silent', '--show-error', origin + prefix + file, '--output', out], { maxBuffer: 1024 * 1024 });
      results.push({ file, status: 'downloaded', size: (await stat(out)).size });
    } catch {
      let status = null;
      try { status = (await run('curl', ['--head', '--location', '--max-time', '20', '--silent', '--output', '/dev/null', '--write-out', '%{http_code}', origin + prefix + file])).stdout.trim(); } catch { /* unavailable */ }
      results.push({ file, status: status === '404' ? 'not-found' : status === '403' ? 'forbidden' : 'failed', http_status: status });
    }
  }
}
await Promise.all(Array.from({ length: 12 }, worker));
const report = { generated_utc: new Date().toISOString(), requested: wanted.length, downloaded: results.filter((x) => x.status === 'downloaded'), not_found: results.filter((x) => x.status === 'not-found'), forbidden: results.filter((x) => x.status === 'forbidden'), failed: results.filter((x) => x.status === 'failed') };
await writeFile('/workspace/work/nightcamp-research/runtime-download-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ requested: report.requested, downloaded: report.downloaded.length, not_found: report.not_found.length, forbidden: report.forbidden.length, failed: report.failed.length }));
