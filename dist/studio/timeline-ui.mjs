const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n};
export function mountTimelineTools(actions){
 const bar=node('div');bar.className='creation-tools';
 bar.innerHTML=`<button id="newAnimation">＋ Animation mới</button><button id="addFrame" class="primary">＋ Thêm frame kế tiếp</button><button id="copyPose">Sao chép pose → nhiều frame</button><label>Bước frame (giây)<input id="frameStep" type="number" min="0.01" max="5" step="0.01" value="0.1"></label><p>Frame mới kế thừa tư thế đang chỉnh và tự lưu pose của frame trước. Bấm Ghi pose để lưu riêng frame hiện tại.</p>`;
 document.querySelector('.timeline').prepend(bar);
 const fresh=node('dialog');fresh.className='timeline-dialog';fresh.id='newAnimationDialog';
 fresh.innerHTML=`<form id="newAnimationForm"><h2>ANIMATION MỚI · MỘT KEYFRAME</h2><p>Tạo clip mới trên nhân vật hiện tại. Clip đang mở được thay thế và có thể hoàn tác; lưu project trước nếu muốn giữ một bản riêng.</p><label>Tên animation<input id="newAnimationName" required maxlength="80" value="my_animation"></label><div class="pair"><label>Loại<select id="newAnimationKind"><option value="loop">Đứng / lặp</option><option value="walk">Đi / chạy</option><option value="attack">Đòn đánh</option><option value="pose">Pose một lần</option></select></label><label>Dài (giây)<input id="newAnimationDuration" type="number" min="0.1" max="30" step="0.1" value="1" required></label></div><label>Tư thế frame 1<select id="newAnimationSeed"><option value="current">Giữ tư thế đang chỉnh</option><option value="rest">Tư thế mặc định</option></select></label><p id="newAnimationError" role="status"></p><div class="dialog-actions"><button type="button" id="cancelAnimation">Hủy</button><button type="submit" class="primary">Tạo animation</button></div></form>`;
 const copy=node('dialog');copy.id='copyPoseDialog';copy.className='timeline-dialog';
 copy.innerHTML=`<h2>SAO CHÉP TƯ THẾ</h2><p id="copyPoseSource"></p><p>Chọn một hoặc nhiều frame đích. Chỉ tư thế được chép; thời điểm và đường cong của frame đích được giữ nguyên. Tư thế đang chỉnh ở frame nguồn cũng sẽ được lưu.</p><div class="copy-buttons"><button id="copyAll">Chọn tất cả</button><button id="copyNone">Bỏ chọn</button><span id="copyCount"></span></div><div id="copyTargets"></div><p id="copyPoseError" role="status"></p><div class="dialog-actions"><button id="cancelCopy">Hủy</button><button id="applyCopy" class="primary">Áp dụng pose</button></div>`;
 document.body.append(fresh,copy);
 const $=id=>document.getElementById(id);
 let captured=null;
 $('newAnimation').onclick=()=>{if(!actions.ready())return;$('newAnimationError').textContent='';fresh.showModal()};
 $('cancelAnimation').onclick=()=>fresh.close();
 $('newAnimationForm').onsubmit=e=>{e.preventDefault();try{actions.create({name:$('newAnimationName').value,kind:$('newAnimationKind').value,dur:$('newAnimationDuration').valueAsNumber,seed:$('newAnimationSeed').value});fresh.close()}catch(error){$('newAnimationError').textContent=error.message}};
 $('addFrame').onclick=()=>{if(!actions.ready())return;try{actions.add($('frameStep').valueAsNumber)}catch(error){actions.error(error.message)}};
 const selected=()=>[...copy.querySelectorAll('input:checked')].map(c=>Number(c.value));
 function count(){$('copyCount').textContent=selected().length+' frame đã chọn';$('applyCopy').disabled=selected().length===0}
 $('copyPose').onclick=()=>{if(!actions.ready())return;captured=actions.capture();$('copyPoseError').textContent='';$('copyPoseSource').textContent=`Nguồn: Frame ${captured.index+1} · ${captured.clip.keys[captured.index].t.toFixed(2)} giây (tư thế đang hiển thị).`;
  $('copyTargets').replaceChildren(...captured.clip.keys.flatMap((key,index)=>{if(index===captured.index)return [];const label=node('label');label.className='copy-target';const check=node('input');check.type='checkbox';check.value=index;check.onchange=count;label.append(check,node('span',`Frame ${index+1} · ${key.t.toFixed(2)}s`));return [label]}));
  if(captured.clip.keys.length<2)$('copyPoseError').textContent='Clip mới có một frame. Thêm frame trước khi sao chép.';
  count();copy.showModal();
 };
 $('copyAll').onclick=()=>{copy.querySelectorAll('input').forEach(c=>c.checked=true);count()};$('copyNone').onclick=()=>{copy.querySelectorAll('input').forEach(c=>c.checked=false);count()};$('cancelCopy').onclick=()=>copy.close();
 $('applyCopy').onclick=()=>{try{actions.copy(captured,selected());copy.close()}catch(error){$('copyPoseError').textContent=error.message}};
}
