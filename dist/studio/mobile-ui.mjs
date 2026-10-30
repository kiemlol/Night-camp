// Reuse the actual editor controls: switching tabs must never reload a project
// or replace inputs and their listeners. Desktop keeps the original columns.
export function mountMobileNavigation(){
 const $=id=>document.getElementById(id),main=document.querySelector('main');
 const media=matchMedia('(max-width: 900px)');
 const wrap=(nodes,id)=>{
  const section=document.createElement('section');section.id=id;section.className='studio-section';
  nodes[0].before(section);section.append(...nodes);return section;
 };
 const library=document.querySelector('aside.library'),inspector=document.querySelector('aside.inspector');
 const libNodes=[...library.children],anchorStart=libNodes.findIndex(n=>n.tagName==='H2'&&n!==libNodes[0]);
 const accessories=$('accessoryPanel');
 const character=wrap(libNodes.slice(0,anchorStart),'characterPanel');
 const anchors=wrap(libNodes.slice(anchorStart,libNodes.indexOf(accessories)),'anchorPanel');
 const inspectorNodes=[...inspector.children],poseStart=inspectorNodes.findIndex(n=>n.tagName==='H2'&&n!==inspectorNodes[0]);
 const animation=wrap(inspectorNodes.slice(0,poseStart),'animationPanel');
 const pose=wrap(inspectorNodes.slice(poseStart),'posePanel');
 const timeline=document.querySelector('.timeline');timeline.id='timelinePanel';
 const timelineTitle=document.createElement('h2');timelineTitle.className='mobile-only';timelineTitle.textContent='Frame & timeline';timeline.prepend(timelineTitle);
 const project=document.createElement('section');project.id='projectPanel';project.className='studio-section';
 project.innerHTML='<h2>Project & thư viện</h2><p class="hint">Mở, lưu hoặc xuất project. Duyệt toàn bộ asset hay tải lại dữ liệu GitHub tại đây.</p>';
 main.append(project);
 const nav=document.querySelector('header nav');nav.id='projectActions';
 const navHome=document.createComment('desktop project actions');nav.before(navHome);
 const toolbar=document.querySelector('.toolbar'),scrub=$('scrub');
 const dock=document.createElement('section');dock.className='mobile-preview-controls';dock.setAttribute('aria-label','Điều khiển preview');main.append(dock);
 const toolbarHome=document.createComment('desktop playback controls');toolbar.before(toolbarHome);
 const scrubHome=document.createComment('desktop scrubber');scrub.before(scrubHome);
 const deleteKey=$('deleteKey'),deleteHome=document.createComment('desktop delete key');deleteKey.before(deleteHome);
 const tabs=[
  {id:'preview',label:'Preview asset',icon:'◉'},
  {id:'pets',label:'Thú cưng cutout',icon:'♧',action:()=>document.getElementById('petStudioButton').click()},
  {id:'character',label:'Nhân vật & ảnh bộ phận',icon:'✦',panel:character},
  {id:'anchors',label:'Điểm neo & xương',icon:'◇',panel:anchors},
  {id:'accessories',label:'Phụ kiện & vũ khí',icon:'♧',panel:accessories},
  {id:'animation',label:'Thiết lập animation',icon:'▶',panel:animation},
  {id:'timeline',label:'Frame & timeline',icon:'◆',panel:timeline},
  {id:'pose',label:'Chỉnh tư thế',icon:'⌁',panel:pose},
  {id:'project',label:'Project & thư viện',icon:'▦',panel:project},
 ];
 const header=document.querySelector('header'),title=document.createElement('span');title.id='mobileTabTitle';title.className='mobile-only';
 header.firstElementChild.append(title);
 const toggle=document.createElement('button');toggle.id='mobileMenuButton';toggle.className='mobile-only';toggle.type='button';
 toggle.setAttribute('aria-label','Mở danh mục Studio');toggle.setAttribute('aria-haspopup','dialog');toggle.setAttribute('aria-controls','mobileMenu');toggle.setAttribute('aria-expanded','false');
 toggle.innerHTML='<span aria-hidden="true">☰</span>';
 header.append(toggle);
 const menu=document.createElement('dialog');menu.id='mobileMenu';menu.className='studio-mobile-menu';menu.setAttribute('aria-labelledby','mobileMenuTitle');
 menu.innerHTML='<div class="mobile-menu-heading"><h2 id="mobileMenuTitle">Danh mục Studio</h2><button type="button" id="closeMobileMenu" aria-label="Đóng danh mục">✕</button></div><nav aria-label="Các mục chỉnh sửa"></nav><p>Chọn một mục để chỉnh. Preview luôn ở phía trên.</p>';
 document.body.append(menu);
 let current='preview';
 const buttons=new Map();
 function close(){if(menu.open)menu.close();toggle.setAttribute('aria-expanded','false')}
 function render(){
  document.body.classList.toggle('studio-mobile',media.matches);
  document.body.dataset.mobileTab=current;
  title.textContent=tabs.find(t=>t.id===current).label;
  for(const tab of tabs){
   if(tab.panel){tab.panel.classList.add('mobile-editor-panel');tab.panel.hidden=media.matches&&tab.id!==current}
   buttons.get(tab.id)?.setAttribute('aria-current',tab.id===current?'page':'false');
  }
  project.hidden=!media.matches||current!=='project';
  if(media.matches){project.append(nav);dock.append(toolbar,scrub);$('keys').after(deleteKey)}
  else{navHome.after(nav);toolbarHome.after(toolbar);scrubHome.after(scrub);deleteHome.after(deleteKey);close()}
 }
 function select(id){
  const tab=tabs.find(t=>t.id===id);if(!tab)return;
  if(tab.action){close();tab.action();return}
  current=id;close();render();
  // Each tab keeps its scroll position; the document itself never scrolls.
 }
 for(const tab of tabs){
  const button=document.createElement('button');button.type='button';button.dataset.studioTab=tab.id;
  const icon=document.createElement('span');icon.textContent=tab.icon;icon.setAttribute('aria-hidden','true');
  button.append(icon,document.createTextNode(tab.label));button.onclick=()=>select(tab.id);
  menu.querySelector('nav').append(button);buttons.set(tab.id,button);
 }
 toggle.onclick=()=>{menu.showModal();toggle.setAttribute('aria-expanded','true')};
 $('closeMobileMenu').onclick=close;
 menu.addEventListener('close',()=>toggle.setAttribute('aria-expanded','false'));
 menu.addEventListener('click',e=>{if(e.target!==menu)return;const r=menu.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()});
 // Existing desktop shortcut should navigate instead of scrolling a hidden tab.
 $('jumpAccessories').addEventListener('click',e=>{if(media.matches){e.preventDefault();e.stopImmediatePropagation();select('accessories')}},true);
 media.addEventListener('change',render);render();
 return {select};
}
