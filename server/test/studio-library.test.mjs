import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..');
const library=JSON.parse(fs.readFileSync(path.join(root,'dist/studio/library-index.json')));
test('Studio library covers the union of both game archives with resolvable paths',()=>{
 const paths=new Set(library.files.map(f=>f.path));assert.equal(paths.size,library.files.length);
 for(const storage of ['dist','dist-full']){function walk(dir,relative=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name),r=relative?relative+'/'+e.name:e.name;if(e.isDirectory())walk(p,r);else assert.ok(paths.has(r),'Missing '+r)}}walk(path.join(root,storage,library.build))}
 for(const f of library.files)assert.ok(fs.existsSync(path.join(root,f.storage,library.build,f.path)));
 assert.equal(library.files.filter(f=>f.kind==='audio').length,62);
 assert.ok(library.spine.every(s=>s.bones>0&&s.animations.length>0&&paths.has(s.path)));
});
test('GitHub reader pins asset paths to a commit and rejects parent traversal',async()=>{
 const old={window:globalThis.window,location:globalThis.location,localStorage:globalThis.localStorage,fetch:globalThis.fetch};const commit='a'.repeat(40),seen=[];
 Object.assign(globalThis,{window:{STUDIO_GITHUB:true},location:{href:'https://studio.example/'},localStorage:{setItem(){},getItem(){return null}},fetch:async url=>{seen.push(url);return {ok:true,json:async()=>url.includes('/commits/')?{sha:commit}:url.endsWith('library-index.json')?{files:[{path:'assets/extra.png',storage:'dist'}]}:url.endsWith('catalog.json')?{build:library.build}: {}}}});
 try{const {connectSource}=await import('../../dist/studio/source.mjs');const s=await connectSource();assert.equal(s.ref,commit);assert.ok(s.assetURL('assets/extra.png').includes('/'+commit+'/dist/'+library.build+'/'));assert.throws(()=>s.assetURL('../private'));assert.ok(seen.slice(1).every(url=>url.includes(commit)))}finally{Object.assign(globalThis,old)}
});
test('GitHub reader recovers when a cached old commit has no accessory catalog yet',async()=>{
 const old={window:globalThis.window,location:globalThis.location,localStorage:globalThis.localStorage,fetch:globalThis.fetch},commit='b'.repeat(40);
 Object.assign(globalThis,{window:{STUDIO_GITHUB:true},location:{href:'https://studio.example/'},localStorage:{setItem(){},getItem(){return commit}},fetch:async url=>({ok:!url.includes('/commits/')&&!url.includes(commit+'/dist/studio/accessories.json'),status:url.includes('/commits/')?403:404,json:async()=>url.endsWith('catalog.json')?{build:library.build}:url.endsWith('library-index.json')?{files:[]}:url.endsWith('accessories.json')?[]:{}})});
 try{const {connectSource}=await import('../../dist/studio/source.mjs');const s=await connectSource();assert.equal(s.ref,'main');assert.match(s.warning,/commit cũ/);assert.ok(s.assetURL('assets/sword.png').includes('/main/'))}finally{Object.assign(globalThis,old)}
});
