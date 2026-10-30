import {detectPieces,guessBackground} from './slice.mjs';
self.onmessage=({data:m})=>{try{const data=new Uint8ClampedArray(m.pixels),background=m.mode==='white'?[255,255,255]:m.mode==='auto'?guessBackground(data,m.width,m.height):null;const boxes=detectPieces(data,m.width,m.height,{background,minArea:m.minArea});self.postMessage({boxes,background})}catch(e){self.postMessage({error:e.message})}};
