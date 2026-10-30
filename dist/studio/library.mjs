const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e};
export function mountLibrary(initial,actions){
 let source=initial, page=0, selected=null, objectURL=null;
 const panel=el('dialog',null,'asset-browser');panel.id='assetBrowser';
 panel.innerHTML=`<div class="ab-head"><div><h2>THƯ VIỆN GITHUB</h2><p id="ab-source"></p></div><button id="ab-close">Đóng ✕</button></div><div id="ab-summary"></div><div class="ab-filters"><input id="ab-search" placeholder="Tìm tên: sword, tree, traveler, pose…" aria-label="Tìm asset"><select id="ab-type"><option value="all">Tất cả file</option><option value="image">Ảnh / map / tile</option><option value="audio">Âm thanh</option><option value="cutout">Rig cutout chỉnh được</option><option value="spine">Rig Spine & clip</option><option value="animation">Mã animation / pose / rig</option><option value="source">Các file khác</option></select></div><div class="ab-body"><div><div id="ab-results"></div><div class="ab-pages"><button id="ab-prev">← Trước</button><span id="ab-page"></span><button id="ab-next">Sau →</button></div></div><section id="ab-preview"><p>Chọn một file để xem trước. Chỉ tải nội dung khi bạn chọn.</p></section></div>`;
 document.body.append(panel);
 const $=id=>panel.querySelector('#'+id);
 const opener=el('button','▦ Toàn bộ thư viện');opener.id='browseLibrary';
 const refresh=el('button','↻ Tải lại GitHub');refresh.id='refreshLibrary';refresh.onclick=async()=>{refresh.disabled=true;try{await actions.refresh()}finally{refresh.disabled=false}};
 const nav=document.querySelector('header nav');nav.prepend(opener,refresh);
 const report=error=>{const p=el('p','Lỗi: '+error.message);p.style.color='#ffb39e';$('ab-preview').append(p)};
 const run=fn=>async()=>{try{await fn()}catch(e){report(e)}};
 opener.onclick=()=>{panel.showModal();render()};$('ab-close').onclick=()=>{panel.close();clearPreview()};
 function clearPreview(){for(const a of panel.querySelectorAll('audio'))a.pause();if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null}}
 function update(s){source=s;$('ab-source').textContent=`${source.remote?'linhphann66-maker/Night-camp · '+source.ref.slice(0,7):'Kho local'} · ${source.catalog.build}`;const counts={};for(const f of source.library.files)counts[f.kind]=(counts[f.kind]||0)+1;$('ab-summary').textContent=`${source.library.files.length.toLocaleString('vi-VN')} file · ${counts.image||0} ảnh · ${counts.audio||0} âm thanh · ${source.catalog.rigs.length} rig cutout · ${source.library.spine.length} rig Spine · ${Object.keys(source.poses).length} clip Pose Studio`;page=0;render()}
 function rows(){const type=$('ab-type').value,q=$('ab-search').value.trim().toLowerCase();let items=type==='cutout'?source.catalog.rigs.map(name=>({path:name,kind:'cutout'})):type==='spine'?source.library.spine.map(s=>({...s,label:s.name,kind:'spine'})):source.library.files.filter(f=>type==='all'||f.kind===type);return items.filter(f=>(f.label||f.path).toLowerCase().includes(q))}
 function render(){const list=rows(),pages=Math.max(1,Math.ceil(list.length/50));page=Math.max(0,Math.min(pages-1,page));$('ab-results').replaceChildren(...list.slice(page*50,page*50+50).map(file=>{const b=el('button',null,'ab-file');const icon=el('span',({image:'▧',audio:'♫',spine:'◇',cutout:'✦'})[file.kind]||'⌘');const title=el('span',file.label||file.path);const size=el('small',file.bytes?Math.ceil(file.bytes/1024)+' KB':file.kind);b.append(icon,title,size);b.onclick=run(()=>preview(file));return b}));$('ab-page').textContent=`${page+1} / ${pages} · ${list.length} kết quả`;$('ab-prev').disabled=page===0;$('ab-next').disabled=page>=pages-1}
 async function preview(file){clearPreview();selected=file;$('ab-preview').replaceChildren(el('h3',file.label||file.path));const view=$('ab-preview');
  if(file.kind==='cutout'){view.append(el('p','Rig sáu bộ phận, có thể mở và chỉnh trong Studio.'));const b=el('button','Mở rig trong editor','primary');b.onclick=run(async()=>{await actions.rig(file.path);panel.close()});view.append(b);return}
  if(file.kind==='spine'){const entries=file.name?[file]:source.library.spine.filter(s=>s.path===file.path);for(const rig of entries){view.append(el('h4',`${rig.name} · ${rig.bones} xương`),el('p',rig.animations.join(' · ')))}view.append(el('p','Dữ liệu rig/clip có thể tải về. Editor v1 chỉ chỉnh hệ cutout; chưa phát/chỉnh mesh Spine trong cửa sổ này.'))}
  const url=source.assetURL(file.path);
  if(file.kind==='image'){const img=el('img');img.crossOrigin='anonymous';img.alt=file.path;img.src=url;view.append(img);const b=el('button','Dùng ảnh cho bộ phận đang chọn','primary');b.onclick=run(async()=>{await actions.apply(file);panel.close()});view.append(b)}
  else if(file.kind==='audio'){const audio=el('audio');audio.controls=true;audio.preload='metadata';audio.src=url;view.append(audio)}
  const open=el('a','Mở file gốc ↗');open.href=url;open.target='_blank';open.rel='noopener';view.append(open);
  const download=el('button','Tải file');download.onclick=run(async()=>{const r=await fetch(url);if(!r.ok)throw Error('HTTP '+r.status);objectURL=URL.createObjectURL(await r.blob());const a=el('a');a.href=objectURL;a.download=file.path.split('/').at(-1);a.click()});view.append(download);
  if(!['image','audio'].includes(file.kind)){const r=await fetch(url);if(!r.ok)throw Error('HTTP '+r.status);const text=await r.text();if(selected!==file)return;const pre=el('pre',text.slice(0,40000));view.append(pre);if(text.length>40000)view.append(el('p','Đang hiển thị 40.000 ký tự đầu; tải file để xem đầy đủ.'))}
 }
 $('ab-search').oninput=()=>{page=0;render()};$('ab-type').onchange=()=>{page=0;render()};$('ab-prev').onclick=()=>{page--;render()};$('ab-next').onclick=()=>{page++;render()};
 panel.addEventListener('close',clearPreview);update(source);return {update};
}
