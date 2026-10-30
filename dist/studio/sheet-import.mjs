import {PARTS} from './model.mjs';
import {mergeBoxes} from './slice.mjs';
const names={head:'Đầu',torso:'Thân',armF:'Tay gần',armB:'Tay xa',legF:'Chân gần',legB:'Chân xa'};
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n};
export function mountSheetImporter(actions){
 const dialog=el('dialog');dialog.id='sheetDialog';dialog.className='sheet-dialog';
 dialog.innerHTML=`<div class="sheet-header"><h2>TỰ CẮT ẢNH THÀNH TÀI NGUYÊN</h2><button id="sheetClose">Đóng ✕</button></div><p>Nhận diện các mảnh rời bởi khoảng trong suốt hoặc nền màu đồng nhất. Không tự tách tay/chân đang dính liền nhau.</p><div class="sheet-tools"><label>Nền<select id="sheetMode"><option value="auto">Tự nhận diện</option><option value="transparent">Trong suốt</option><option value="white">Trắng</option></select></label><label>Lọc bụi (pixel)<input id="sheetArea" type="number" min="1" max="10000" value="12"></label><button id="sheetScan">Phân tích lại</button><button id="sheetMerge">Gộp vùng đã chọn</button></div><p id="sheetStatus" role="status"></p><canvas id="sheetPreview"></canvas><div id="sheetParts"></div><div class="sheet-footer"><button id="sheetStore">Lưu các mảnh vào tài nguyên</button><button id="sheetApply" class="primary">Lưu & gán bộ phận đã chọn</button></div>`;
 document.body.append(dialog);const $=id=>dialog.querySelector('#'+id),ctx=$('sheetPreview').getContext('2d');
 let canvas,original,boxes=[],resources=[],generation=0,worker=null,cancel=null,closed=false;
 const report=e=>$('sheetStatus').textContent='Lỗi: '+e.message;
 const safe=fn=>async()=>{try{await fn()}catch(e){report(e)}};
 $('sheetClose').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{closed=true;generation++;worker?.terminate();worker=null;cancel?.();cancel=null});
 function busy(flag){for(const id of ['sheetScan','sheetMerge','sheetStore','sheetApply'])$(id).disabled=flag}
 function draw(){const view=$('sheetPreview');view.width=canvas.width;view.height=canvas.height;ctx.clearRect(0,0,view.width,view.height);ctx.drawImage(canvas,0,0);ctx.lineWidth=Math.max(2,canvas.width/350);ctx.font=`${Math.max(12,canvas.width/50)}px sans-serif`;boxes.forEach((b,i)=>{ctx.strokeStyle='#d3ed92';ctx.strokeRect(b.x,b.y,b.w,b.h);ctx.fillStyle='#edffb8';ctx.fillText(String(i+1),b.x+3,b.y+18)})}
 function crop(b){const c=document.createElement('canvas');c.width=b.w+4;c.height=b.h+4;const cx=c.getContext('2d');cx.drawImage(canvas,b.x,b.y,b.w,b.h,2,2,b.w,b.h);return c.toDataURL('image/png')}
 function render(){
  draw();resources=boxes.map((b,i)=>({id:'piece_'+Date.now()+'_'+i,name:'Mảnh '+(i+1),src:crop(b),rect:b,w:b.w+4,h:b.h+4}));
  $('sheetParts').replaceChildren(...resources.map((r,i)=>{const row=el('div');row.className='sheet-piece';const check=el('input');check.type='checkbox';check.className='sheet-selected';check.checked=true;check.dataset.index=i;const img=el('img');img.src=r.src;const name=el('input');name.value=r.name;name.maxLength=80;name.setAttribute('aria-label','Tên mảnh '+(i+1));name.onchange=()=>r.name=name.value;const select=el('select');select.dataset.index=i;select.className='sheet-slot';select.append(new Option('Chỉ lưu tài nguyên',''),...PARTS.map(p=>new Option(names[p],p)));row.append(check,img,name,select);return row}));
  $('sheetStatus').textContent=`Tìm được ${boxes.length} mảnh. Chọn vai trò trước khi gán; có thể chỉ lưu tài nguyên.`;
 }
 async function scan(){
  const mine=++generation;worker?.terminate();busy(true);$('sheetStatus').textContent='Đang tìm các vùng ảnh rời…';
  try{canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);canvas.getContext('2d').drawImage(original,0,0);const image=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height),minArea=Math.max(1,Math.min(10000,+$('sheetArea').value||12));
   const result=await new Promise((resolve,reject)=>{cancel=()=>resolve({cancelled:true});worker=new Worker(new URL('./slice-worker.mjs',import.meta.url),{type:'module'});worker.onmessage=e=>{worker.terminate();worker=null;cancel=null;e.data.error?reject(Error(e.data.error)):resolve(e.data)};worker.onerror=e=>{worker?.terminate();worker=null;cancel=null;reject(Error(e.message))};worker.postMessage({pixels:image.data.buffer,width:canvas.width,height:canvas.height,mode:$('sheetMode').value,minArea},[image.data.buffer])});
   if(mine!==generation||closed)return;
   if(result.background){const c=canvas.getContext('2d'),im=c.getImageData(0,0,canvas.width,canvas.height);for(let i=0;i<im.data.length;i+=4)if(Math.max(...result.background.map((v,j)=>Math.abs(v-im.data[i+j])))<=28)im.data[i+3]=0;c.putImageData(im,0,0)}
   boxes=result.boxes;if(!boxes.length){resources=[];$('sheetParts').replaceChildren();$('sheetStatus').textContent='Không tìm thấy mảnh. Thử nền Trong suốt hoặc giảm ngưỡng lọc bụi.';draw()}else render();
  }finally{if(mine===generation)busy(false)}
 }
 $('sheetScan').onclick=safe(scan);
 $('sheetMerge').onclick=safe(()=>{const indexes=[...dialog.querySelectorAll('.sheet-selected:checked')].map(c=>+c.dataset.index);if(indexes.length<2)throw Error('Chọn ít nhất hai vùng để gộp');const merged=mergeBoxes(indexes.map(i=>boxes[i]));boxes=boxes.filter((_,i)=>!indexes.includes(i));boxes.push(merged);boxes.sort((a,b)=>a.y-b.y||a.x-b.x);render()});
 const chosen=()=>[...dialog.querySelectorAll('.sheet-selected:checked')].map(c=>+c.dataset.index);
 async function store(apply){const indexes=chosen();if(!indexes.length)throw Error('Chọn ít nhất một mảnh');const selected=indexes.map(i=>resources[i]),assignments={};if(apply){for(const slot of dialog.querySelectorAll('.sheet-slot'))if(slot.value&&indexes.includes(+slot.dataset.index)){if(assignments[slot.value])throw Error('Mỗi bộ phận chỉ nhận một mảnh. Gộp vùng nếu cần.');assignments[slot.value]=resources[+slot.dataset.index]}if(!Object.keys(assignments).length)throw Error('Chọn vai trò đầu/thân/tay/chân cho ít nhất một mảnh')}
  await actions.store(selected,assignments);dialog.close();
 }
 $('sheetStore').onclick=safe(()=>store(false));$('sheetApply').onclick=safe(()=>store(true));
 return {async open(img){closed=false;canvas=document.createElement('canvas');const scale=Math.min(1,2048/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);original=document.createElement('canvas');original.width=canvas.width;original.height=canvas.height;original.getContext('2d').drawImage(canvas,0,0);boxes=[];resources=[];dialog.showModal();await scan()},async gallery(items){if(!items?.length)throw Error('Chưa có tài nguyên đã cắt');closed=false;dialog.showModal();$('sheetPreview').width=1;$('sheetPreview').height=1;$('sheetParts').replaceChildren(...items.map(r=>{const row=el('div');row.className='sheet-piece';const img=el('img');img.src=r.src;row.append(img,el('span',r.name));const select=el('select');select.append(...PARTS.map(p=>new Option(names[p],p)));const apply=el('button','Gán');apply.onclick=safe(async()=>{await actions.store([],{[select.value]:r});dialog.close()});row.append(select,apply);return row}));$('sheetStatus').textContent=`${items.length} tài nguyên đã lưu trong project.`;busy(true)}};
}
