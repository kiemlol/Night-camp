export function mountPetEditor(pause){
 const button=document.createElement('button');button.id='petStudioButton';button.textContent='♧ Thú cưng cutout';
 const dialog=document.createElement('dialog');dialog.id='petStudioDialog';dialog.className='pet-mode-dialog';dialog.setAttribute('aria-label','Pet Cutout Studio');
 const frame=document.createElement('iframe');frame.title='Chỉnh rig và animation thú cưng cutout';dialog.append(frame);document.body.append(dialog);
 button.onclick=()=>{pause();if(!frame.src)frame.src=new URL('pets/index.html',location.href).href;else frame.contentWindow?.postMessage({type:'nightcamp.pet.resume'},location.origin);dialog.showModal()};
 document.querySelector('header nav').prepend(button);
 window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===frame.contentWindow&&e.data?.type==='nightcamp.pet.close')dialog.close()});
 dialog.addEventListener('close',()=>frame.contentWindow?.postMessage({type:'nightcamp.pet.pause'},location.origin));
}
