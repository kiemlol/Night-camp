export const REPOSITORY='linhphann66-maker/Night-camp';
const json=async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}: ${url}`);return r.json()};
export async function connectSource(remote=!!window.STUDIO_GITHUB){
 let ref='main',warning='';
 if(remote){try{const data=await json(`https://api.github.com/repos/${REPOSITORY}/commits/main`);if(!/^[a-f0-9]{40}$/.test(data.sha))throw Error('Commit không hợp lệ');ref=data.sha;localStorage.setItem('nightcamp.source.ref',ref)}catch{ref=localStorage.getItem('nightcamp.source.ref')||'main';warning=ref==='main'?'GitHub API chưa phản hồi; đang đọc nhánh main.':'GitHub API chưa phản hồi; dùng commit đã đọc gần nhất.'}}
 let root=remote?`https://raw.githubusercontent.com/${REPOSITORY}/${ref}/`:new URL('../../',location.href).href;
 let prefix=remote?root+'dist/studio/':new URL('./',location.href).href;
 const read=()=>Promise.all(['catalog.json','library-index.json','poses.json','accessories.json'].map(f=>json(prefix+f)));
 let data;try{data=await read()}catch(error){if(!remote||ref==='main')throw error;ref='main';root=`https://raw.githubusercontent.com/${REPOSITORY}/main/`;prefix=root+'dist/studio/';warning='Danh mục ở commit cũ chưa đủ; đang đọc thư viện từ nhánh main.';data=await read()}
 const [catalog,library,poses,accessories]=data;
 const locations=new Map(library.files.map(f=>[f.path,f.storage==='dist'?'dist':'dist-full']));
 return {remote,ref,warning,catalog,library,poses,accessories,assetURL:path=>{if(path.startsWith('data:'))return path;if(!/^[\w./-]+$/.test(path)||path.split('/').includes('..'))throw Error('Đường dẫn không hợp lệ');const buildRoot=remote?root+`${locations.get(path)||'dist-full'}/${catalog.build}/`:new URL(`/${catalog.build}/`,location.href).href;return new URL(path,buildRoot).href}};
}
