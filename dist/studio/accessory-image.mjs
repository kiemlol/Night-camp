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
export function fitGlasses(a,bounds,width,height,headWidth){
 // Preserve the original pixels and normalized coordinates for old projects.
 const w=Math.min(headWidth*.45*width/bounds.w,2000,2000*width/height);
 Object.assign(a,{socket:'face',layer:'front',w,h:w*height/width,scale:1,rotation:0,x:0,y:0,visible:true,anchor:[(bounds.x+bounds.w/2)/width,(bounds.y+bounds.h/2)/height]});
 return a;
}
