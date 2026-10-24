import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/codex/cua_node/lib/node_modules/playwright');

const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const requests = new Map(), errors = [], consoleErrors = [];
page.on('request', (req) => {
  const u = new URL(req.url());
  requests.set(req.url(), { origin: u.origin, path: u.pathname, method: req.method(), type: req.resourceType(), status: null });
});
page.on('response', (res) => { const row = requests.get(res.request().url()); if (row) row.status = res.status(); });
page.on('requestfailed', (req) => errors.push({ url: req.url(), error: req.failure()?.errorText || 'failed' }));
page.on('pageerror', (err) => consoleErrors.push(String(err)));
await page.goto('https://play.nightcamp.app/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(20000);
const rows = [...requests.values()];
const report = {
  generated_utc: new Date().toISOString(),
  final_url: page.url(),
  title: await page.title(),
  visible_text_sample: (await page.locator('body').innerText()).slice(0, 2500),
  request_count: rows.length,
  origins: Object.fromEntries([...new Set(rows.map((r) => r.origin))].sort().map((o) => [o, rows.filter((r) => r.origin === o).length])),
  status_counts: Object.fromEntries([...new Set(rows.map((r) => String(r.status)))].sort().map((s) => [s, rows.filter((r) => String(r.status) === s).length])),
  api_paths: rows.filter((r) => /api\.nightcamp\.app/.test(r.origin)).map((r) => ({ method: r.method, path: r.path, status: r.status })),
  static_paths: rows.filter((r) => /play\.nightcamp\.app/.test(r.origin)).map((r) => ({ path: r.path, type: r.type, status: r.status })),
  request_failures: errors,
  page_errors: consoleErrors,
};
fs.writeFileSync('/workspace/work/nightcamp-research/original-runtime-survey.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ final_url: report.final_url, request_count: report.request_count, origins: report.origins, status_counts: report.status_counts, api_paths: report.api_paths, request_failures: errors.length, page_errors: consoleErrors.length }));
await browser.close();
