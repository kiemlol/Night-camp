// Local silhouette estimator, not an anatomical/semantic ML model.
// Distance-to-edge suppresses narrow ears, horns and wings when locating a solid cap.
export const LANDMARK_NAMES=['Trán','Gáy','Cằm'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fromBox=(x0,y0,x1,y1)=>[[x0+(x1-x0)*.8,y0+(y1-y0)*.16],[x0+(x1-x0)*.08,y0+(y1-y0)*.58],[x0+(x1-x0)*.67,y0+(y1-y0)*.93]];
export function detectHatLandmarks(data,width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||data.length!==width*height*4)throw Error('Dữ liệu ảnh mũ không hợp lệ');
 const k=Math.min(1,224/Math.max(width,height)),w=Math.max(2,Math.round(width*k)),h=Math.max(2,Math.round(height*k)),stride=w+2,n=(w+2)*(h+2),mask=new Uint8Array(n),d=new Float32Array(n);
 let count=0,x0=w,y0=h,x1=0,y1=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.min(width-1,Math.floor((x+.5)*width/w)),sy=Math.min(height-1,Math.floor((y+.5)*height/h)),i=(y+1)*stride+x+1;if(data[(sy*width+sx)*4+3]>=48){mask[i]=1;d[i]=10000;count++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}}
 if(count<12)throw Error('Không đủ phần ảnh rõ để nhận diện mũ');
 const diag=Math.SQRT2;
 for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){const i=y*stride+x;if(mask[i])d[i]=Math.min(d[i],d[i-1]+1,d[i-stride]+1,d[i-stride-1]+diag,d[i-stride+1]+diag)}
 let peak=0,best=0;
 for(let y=h;y>=1;y--)for(let x=w;x>=1;x--){const i=y*stride+x;if(mask[i]){d[i]=Math.min(d[i],d[i+1]+1,d[i+stride]+1,d[i+stride-1]+diag,d[i+stride+1]+diag);if(d[i]>best){best=d[i];peak=i}}}
 const threshold=best*.62,seen=new Uint8Array(n),queue=[peak];seen[peak]=1;let cx0=w,cy0=h,cx1=0,cy1=0;
 for(let q=0;q<queue.length;q++){const i=queue[q],x=i%stride-1,y=Math.floor(i/stride)-1;cx0=Math.min(cx0,x);cx1=Math.max(cx1,x);cy0=Math.min(cy0,y);cy1=Math.max(cy1,y);for(const j of [i-1,i+1,i-stride,i+stride])if(!seen[j]&&mask[j]&&d[j]>=threshold){seen[j]=1;queue.push(j)}}
 const pad=threshold*.45,box=[clamp((cx0-pad)/w,0,1),clamp((cy0-pad)/h,0,1),clamp((cx1+1+pad)/w,0,1),clamp((cy1+1+pad)/h,0,1)],coverage=count/(w*h),bulk=best/Math.min(x1-x0+1,y1-y0+1);
 const aspect=(box[2]-box[0])*width/Math.max(1,(box[3]-box[1])*height),confidence=coverage>.97?.15:aspect>1.9||aspect<.5?.3:clamp(.35+bulk*1.4+(queue.length>count*.1?.15:0),.15,.88);
 return {points:fromBox(...box),box,confidence,method:'silhouette-core',version:1};
}
export function headLandmarks(data,width,height){
 let x0=width,y0=height,x1=-1,y1=-1;for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>=48){x0=Math.min(x,x0);x1=Math.max(x,x1);y0=Math.min(y,y0);y1=Math.max(y,y1)}
 if(x1<0)throw Error('Ảnh đầu không có nội dung');return fromBox(x0/width,y0/height,(x1+1)/width,(y1+1)/height);
}
function validPoints(points,min=0,max=1){return Array.isArray(points)&&points.length===3&&points.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&v>=min&&v<=max))}
export function validateHeadFit(fit){
 if(!fit||fit.version!==1||!['silhouette-core','manual'].includes(fit.method)||!validPoints(fit.points)||!validPoints(fit.target,-2,3)||!Number.isFinite(fit.confidence)||fit.confidence<0||fit.confidence>1)throw Error('Mốc ôm đầu không hợp lệ');return fit;
}
export function fitHatToHead(attachment,fit,width,height,head){
 validateHeadFit(fit);if(![width,height,head.w,head.h].every(v=>Number.isFinite(v)&&v>0))throw Error('Kích thước ảnh / đầu không hợp lệ');
 const source=fit.points.map(p=>[p[0]*width,p[1]*height]),target=fit.target.map(p=>[p[0]*head.w,p[1]*head.h]),center=points=>points.reduce((sum,p)=>[sum[0]+p[0]/3,sum[1]+p[1]/3],[0,0]),a=center(source),b=center(target);
 const area=ps=>Math.abs((ps[1][0]-ps[0][0])*(ps[2][1]-ps[0][1])-(ps[1][1]-ps[0][1])*(ps[2][0]-ps[0][0]));if(area(fit.points)<1e-5||area(fit.target)<1e-5)throw Error('Ba mốc không được trùng nhau hoặc nằm trên một đường thẳng');
 let dot=0,cross=0,norm=0;for(let i=0;i<3;i++){const x=source[i][0]-a[0],y=source[i][1]-a[1],u=target[i][0]-b[0],v=target[i][1]-b[1];dot+=x*u+y*v;cross+=x*v-y*u;norm+=x*x+y*y}
 if(norm<1e-8||Math.hypot(dot,cross)<1e-8)throw Error('Ba mốc phải cách nhau, không được trùng nhau');
 const k=Math.hypot(dot,cross)/norm,w=width*k,h=height*k,rotation=Math.atan2(cross,dot),hb=head.head||[.5,0,.8];
 if(w<1||h<1||w>2000||h>2000)throw Error('Mốc suy ra kích thước quá lớn / nhỏ; hãy chỉnh lại ba mốc');
 const cos=Math.cos(rotation),sin=Math.sin(rotation),error=Math.sqrt(source.reduce((sum,p,i)=>{const x=(p[0]-a[0])*k,y=(p[1]-a[1])*k;return sum+(b[0]+cos*x-sin*y-target[i][0])**2+(b[1]+sin*x+cos*y-target[i][1])**2},0)/3);
 return {...attachment,socket:'head',w,h,scale:1,rotation,anchor:[a[0]/width,a[1]/height],x:b[0]-head.w*hb[0],y:b[1]-head.h*hb[1],headFit:structuredClone(fit),fitError:error};
}
export function referenceHeadLandmarks(attachment,points,head){
 if(!validPoints(points))throw Error('Mốc của mũ mẫu không hợp lệ');const hb=head.head||[.5,0,.8],c=Math.cos(attachment.rotation),s=Math.sin(attachment.rotation);
 return points.map(p=>{const x=(p[0]-attachment.anchor[0])*attachment.w*attachment.scale,y=(p[1]-attachment.anchor[1])*attachment.h*attachment.scale;return [(head.w*hb[0]+attachment.x+c*x-s*y)/head.w,(head.h*hb[1]+attachment.y+s*x+c*y)/head.h]});
}
