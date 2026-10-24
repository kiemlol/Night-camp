import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';

const run = promisify(execFile);
const root = '/workspace/work/nightcamp-research/site';
const origin = 'https://play.nightcamp.app/game-20261022-1641/';
const reportPath = '/workspace/work/nightcamp-research/asset-audit.json';
const allowed = new Set(['.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.json', '.ogg', '.mp3', '.wav', '.woff', '.woff2', '.bin', '.atlas', '.svg', '.webmanifest', '.txt']);
const refs = new Map();
const files = [];

async function walk(dir) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, ent.name);
    if (ent.isDirectory()) await walk(file);
    else files.push(file);
  }
}
await walk(root);

function add(raw, source) {
  let value = String(raw || '').trim().replace(/^["'`(]+|["'`),;:]+$/g, '');
  try { value = decodeURIComponent(value); } catch { /* retain literal */ }
  value = value.split(/[?#]/, 1)[0].replace(/^\.\//, '').replace(/^\//, '');
  if (!/^(assets|js|css)\//.test(value) || value.includes('..') || !allowed.has(extname(value).toLowerCase())) return;
  const set = refs.get(value) || new Set(); set.add(source); refs.set(value, set);
}

const pathRx = /(?:assets|js|css)\/[A-Za-z0-9_./@()+-]+\.(?:js|css|png|jpe?g|webp|json|ogg|mp3|wav|woff2?|bin|atlas|svg|webmanifest|txt)(?:\?[^"'`\s)]*)?/gi;
for (const file of files) {
  if (!/\.(?:js|css|html|json|webmanifest|txt)$/i.test(file)) continue;
  let text = '';
  try { text = await readFile(file, 'utf8'); } catch { continue; }
  const source = relative(root, file);
  for (const match of text.matchAll(pathRx)) add(match[0], source);
  for (const match of text.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) add(match[1], source);
  for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) add(match[1], source);
}

const missing = [];
for (const [file, sources] of refs) {
  try { if ((await stat(join(root, file))).size > 0) continue; } catch { /* missing */ }
  missing.push({ file, sources: [...sources].slice(0, 12) });
}

let cursor = 0;
async function fetchOne(row) {
  const out = join(root, row.file);
  await mkdir(dirname(out), { recursive: true });
  try {
    await run('curl', ['--fail', '--location', '--retry', '3', '--retry-all-errors', '--connect-timeout', '10', '--max-time', '60', '--silent', '--show-error', origin + row.file, '--output', out], { maxBuffer: 1024 * 1024 });
    const size = (await stat(out)).size;
    return { ...row, status: 'downloaded', size };
  } catch (error) {
    try {
      const { stdout } = await run('curl', ['--head', '--location', '--max-time', '20', '--silent', '--output', '/dev/null', '--write-out', '%{http_code}', origin + row.file]);
      return { ...row, status: stdout.trim() === '404' ? 'not-found' : 'failed', http_status: stdout.trim() };
    } catch { return { ...row, status: 'failed', http_status: null }; }
  }
}
const results = [];
async function worker() {
  while (cursor < missing.length) results.push(await fetchOne(missing[cursor++]));
}
await Promise.all(Array.from({ length: 16 }, worker));

const report = {
  generated_utc: new Date().toISOString(),
  origin,
  scanned_files: files.length,
  referenced_paths: refs.size,
  missing_before: missing.length,
  downloaded: results.filter((x) => x.status === 'downloaded'),
  not_found: results.filter((x) => x.status === 'not-found'),
  failed: results.filter((x) => x.status === 'failed'),
};
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ scanned_files: report.scanned_files, referenced_paths: report.referenced_paths, missing_before: report.missing_before, downloaded: report.downloaded.length, not_found: report.not_found.length, failed: report.failed.length, report: reportPath }));
