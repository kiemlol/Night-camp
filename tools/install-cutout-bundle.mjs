import fs from 'node:fs';
import path from 'node:path';
import { validate, gameExport } from '../dist/studio/model.mjs';
const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error('Usage: node tools/install-cutout-bundle.mjs <bundle.json> <new-output-directory>');
const bundle = JSON.parse(fs.readFileSync(input, 'utf8'));
if (bundle.format !== 'nightcamp-cutout-export-v1') throw Error('Invalid bundle');
// Rebuild executable data from validated project; never trust supplied bundle.code.
const exported = gameExport(validate(bundle.project));
const out = path.resolve(output);
if (fs.existsSync(out)) throw Error('Output directory must not exist; no existing assets will be overwritten');
fs.mkdirSync(path.join(out, 'assets'), { recursive:true });
fs.writeFileSync(path.join(out, 'cutout-export.js'), exported.code);
for (const img of exported.images) fs.writeFileSync(path.join(out,'assets',img.file), Buffer.from(img.data.split(',')[1], 'base64'));
fs.writeFileSync(path.join(out, 'project.cutout.json'), JSON.stringify(bundle.project,null,2));
fs.writeFileSync(path.join(out, 'README.txt'), `Rig: ${exported.rig}\nClip: studio:${exported.id}\nCopy generated assets and cutout-export.js into the target client. Keep referenced original assets. Load cutout-export.js after manifest.js and poselib_data.js, BEFORE sprites are loaded and poselib.js runs. Add an item whose rig is ${exported.rig} and connect the clip to the desired movement state. This does not automatically change the live game's character.\n`);
console.log(`Exported rig ${exported.rig}, clip studio:${exported.id}, ${exported.images.length} custom images to ${out}`);
