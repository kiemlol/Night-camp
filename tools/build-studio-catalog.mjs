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
const files=[],seen=new Set();
function walk(dir,origin,storage){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p,origin,storage);else{const relative=path.relative(origin,p).replaceAll(path.sep,'/');if(seen.has(relative))continue;seen.add(relative);const ext=path.extname(p).toLowerCase();const kind=['.png','.webp','.jpg','.jpeg','.svg'].includes(ext)?'image':['.m4a','.mp3','.ogg','.wav'].includes(ext)?'audio':relative.endsWith('.rig.js')?'spine':/anim|pose|spine|rig/i.test(relative)?'animation':'source';files.push({path:relative,storage,kind,bytes:fs.statSync(p).size})}}}
walk(base,base,'dist-full');
const compact=path.join(root,'dist/game-20261025-1758');
walk(compact,compact,'dist');
vm.runInContext(fs.readFileSync(path.join(base,'js/poselib_data.js'),'utf8'),context);
const spine=[];
for(const [file,key] of [['herospine.rig.js','HERO_SPINE'],['petspine.rig.js','PET_SPINE'],['baphspine.rig.js','BAPH_SPINE']]){
 vm.runInContext(fs.readFileSync(path.join(base,'assets',file),'utf8'),context);
 for(const [name,data] of Object.entries(NC[key]||{}))spine.push({name,path:'assets/'+file,bones:data.bones.length,animations:Object.keys(data.anims||{})});
}
fs.writeFileSync(path.join(root,'dist/studio/poses.json'),JSON.stringify(NC.POSE_LIB));
fs.writeFileSync(path.join(root,'dist/studio/library-index.json'),JSON.stringify({build:'game-20261025-1758',generatedAt:new Date().toISOString(),files,spine,spriteManifest:NC.ASSET_MANIFEST}));
console.log(`Library: ${files.length} files, ${spine.length} Spine rigs, ${Object.keys(NC.POSE_LIB).length} Pose Studio clips`);
console.log(`Studio: ${rigs.length} complete rigs, ${Object.keys(sprites).length} sprite parts`);
