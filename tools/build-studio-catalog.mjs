import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root = path.resolve(import.meta.dirname, '..');
const base = path.join(root, 'dist-full/game-20261025-1758');
const NC = {};
const context = vm.createContext({ NC, window: { NC }, console: { log() {}, warn() {} } });
for (const file of fs.readdirSync(path.join(base, 'assets')).filter(f => f === 'manifest.js' || f.endsWith('.manifest.js')).sort()) {
  try { vm.runInContext(fs.readFileSync(path.join(base, 'assets', file), 'utf8'), context, { timeout: 1000 }); }
  catch (error) { console.warn(`${file}: ${error.message}`); }
}
const sprites = Object.fromEntries(Object.entries(NC.ASSET_MANIFEST || {}).filter(([name, s]) => name.startsWith('rig_') && s.joints && fs.existsSync(path.join(base, s.src))));
const parts = ['head','torso','armF','armB','legF','legB'];
const rigs = [...new Set(Object.keys(sprites).map(n => n.replace(/^rig_/, '').replace(/_(head|torso|armF|armB|legF|legB)$/, '')))].filter(r => parts.every(p => sprites[`rig_${r}_${p}`])).sort();
fs.mkdirSync(path.join(root, 'dist/studio'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/studio/catalog.json'), JSON.stringify({ build:'game-20261025-1758', rigs, sprites }));
console.log(`Studio: ${rigs.length} complete rigs, ${Object.keys(sprites).length} sprite parts`);
