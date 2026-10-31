// Coordinates always refer to the full image, not the padded preview canvas.
export function alphaBounds(data,width,height){
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>0){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)}
 if(right<left)throw Error('Ảnh hoàn toàn trong suốt');
 return {x:left,y:top,w:right-left+1,h:bottom-top+1};
}
export function imageRect(width,height){const k=Math.min(220/width,155/height);return {x:(250-width*k)/2,y:(190-height*k)/2,w:width*k,h:height*k}}
export function previewAnchor(clientX,clientY,box,rect){return [
 Math.max(0,Math.min(1,((clientX-box.left)*250/box.width-rect.x)/rect.w)),
 Math.max(0,Math.min(1,((clientY-box.top)*190/box.height-rect.y)/rect.h))
]}
export function fitGlasses(a,bounds,width,height){
 // Position/anchor repair must never resize an authored accessory.
 Object.assign(a,{socket:'face',layer:'front',x:0,y:0,visible:true,anchor:[(bounds.x+bounds.w/2)/width,(bounds.y+bounds.h/2)/height]});
 return a;
}
export function restoreShrunkGlassesSize(a,bounds,width,height,headWidth,authoredAspect=height/width){
 // Explicit opt-in repair for the short-lived .45 default, not an auto migration.
 // Skip resized/rescaled or stretched images; don't guess at custom dimensions.
 const near=(x,y)=>Math.abs(x-y)<=.003;
 if(a.scale!==1||(!near(a.h,a.w*height/width)&&!near(a.h,a.w*authoredAspect)))return false;
 const bad=headWidth*.45;
 if(near(a.w,headWidth*.85))return false;
 if(!near(a.w,bad)&&!near(a.w*bounds.w/width,bad))return false;
 const factor=.85/.45,w=a.w*factor,h=a.h*factor;
 if(w>2000||h>2000)return false;
 a.w=w;a.h=h;return true;
}
