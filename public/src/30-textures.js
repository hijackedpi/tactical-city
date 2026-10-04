// ── TEXTURES ───────────────────────────────────────────────────────────────
function noiseCanvas(s,base,amt,extra){
  const cv=document.createElement('canvas'); cv.width=cv.height=s;
  const c=cv.getContext('2d');
  c.fillStyle=base; c.fillRect(0,0,s,s);
  const id=c.getImageData(0,0,s,s);
  for(let i=0;i<id.data.length;i+=4){const n=(Math.random()-.5)*amt; id.data[i]+=n;id.data[i+1]+=n;id.data[i+2]+=n;}
  c.putImageData(id,0,0);
  if(extra) extra(c,s);
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
const asphaltTex=(()=>{
  const t=noiseCanvas(512,'#282828',32,(c,s)=>{
    for(let i=0;i<50;i++){c.beginPath();c.moveTo(Math.random()*s,Math.random()*s);for(let j=0;j<4;j++)c.lineTo(Math.random()*s,Math.random()*s);c.strokeStyle=`rgba(0,0,0,${Math.random()*.12+.02})`;c.lineWidth=Math.random()+.2;c.stroke();}
  }); t.repeat.set(30,30); t.needsUpdate=true; return t;
})();
const paverTex=(()=>{
  const t=noiseCanvas(512,'#b0a898',25,(c,s)=>{
    c.strokeStyle='rgba(70,62,55,.3)';c.lineWidth=2;
    for(let r=0;r<s/32+1;r++)for(let col=0;col<s/64+1;col++){const ox=r%2?32:0;c.strokeRect(col*64+ox,r*32,64,32);}
  }); t.repeat.set(8,8); t.needsUpdate=true; return t;
})();
const brickTex=(()=>{
  const cv=document.createElement('canvas');cv.width=cv.height=512;const c=cv.getContext('2d');
  c.fillStyle='#7a6a60';c.fillRect(0,0,512,512);
  for(let row=0;row<512/33+1;row++){const off=row%2?40:0;for(let col=-1;col<512/85+1;col++){
    const x=col*85+off,y=row*33,r=140+Math.random()*45|0,g=72+Math.random()*28|0,b=48+Math.random()*22|0;
    c.fillStyle=`rgb(${r},${g},${b})`;c.fillRect(x,y,80,28);
    c.fillStyle='rgba(255,220,180,.1)';c.fillRect(x,y,80,3);
    c.fillStyle='rgba(0,0,0,.18)';c.fillRect(x,y+25,80,3);
  }}
  const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
})();
const brickRedTex=(()=>{
  const cv=document.createElement('canvas');cv.width=cv.height=512;const c=cv.getContext('2d');
  c.fillStyle='#5a4a40';c.fillRect(0,0,512,512);
  for(let row=0;row<512/33+1;row++){const off=row%2?40:0;for(let col=-1;col<512/85+1;col++){
    const x=col*85+off,y=row*33,r=170+Math.random()*55|0,g=55+Math.random()*22|0,b=40+Math.random()*18|0;
    c.fillStyle=`rgb(${r},${g},${b})`;c.fillRect(x,y,80,28);
    c.fillStyle='rgba(255,200,160,.12)';c.fillRect(x,y,80,3);
    c.fillStyle='rgba(0,0,0,.22)';c.fillRect(x,y+25,80,3);
  }}
  const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
})();
const brickGreyTex=(()=>{
  const cv=document.createElement('canvas');cv.width=cv.height=512;const c=cv.getContext('2d');
  c.fillStyle='#3a3a3a';c.fillRect(0,0,512,512);
  for(let row=0;row<512/33+1;row++){const off=row%2?40:0;for(let col=-1;col<512/85+1;col++){
    const x=col*85+off,y=row*33,v=80+Math.random()*40|0;
    c.fillStyle=`rgb(${v},${v+2},${v+4})`;c.fillRect(x,y,80,28);
    c.fillStyle='rgba(200,200,210,.12)';c.fillRect(x,y,80,3);
    c.fillStyle='rgba(0,0,0,.22)';c.fillRect(x,y+25,80,3);
  }}
  const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
})();
const stuccoTex=(()=>{
  const t=noiseCanvas(512,'#c9b896',18,(c,s)=>{
    for(let i=0;i<300;i++){c.fillStyle=`rgba(0,0,0,${Math.random()*.04})`;c.beginPath();c.arc(Math.random()*s,Math.random()*s,Math.random()*4+1,0,Math.PI*2);c.fill();}
    for(let i=0;i<8;i++){c.fillStyle=`rgba(70,60,45,${Math.random()*.08+.02})`;c.fillRect(Math.random()*s,0,Math.random()*6+2,s);}
  }); return t;
})();
const windowedTex=(()=>{
  const cv=document.createElement('canvas');cv.width=cv.height=512;const c=cv.getContext('2d');
  c.fillStyle='#aaa39a';c.fillRect(0,0,512,512);
  const id=c.getImageData(0,0,512,512);
  for(let i=0;i<id.data.length;i+=4){const n=(Math.random()-.5)*22; id.data[i]+=n;id.data[i+1]+=n;id.data[i+2]+=n;}
  c.putImageData(id,0,0);
  for(let row=0;row<8;row++)for(let col=0;col<6;col++){
    const x=20+col*80,y=20+row*60;
    c.fillStyle=Math.random()>.4?`rgba(255,240,180,${Math.random()*.5+.4})`:'rgba(30,40,55,.85)';
    c.fillRect(x,y,60,40);
    c.strokeStyle='rgba(40,40,40,.5)';c.lineWidth=2;c.strokeRect(x,y,60,40);
    c.beginPath();c.moveTo(x+30,y);c.lineTo(x+30,y+40);c.stroke();
  }
  const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
})();

const concreteTex=noiseCanvas(512,'#8e8880',35,(c,s)=>{
  for(let i=0;i<18;i++){c.beginPath();c.moveTo(Math.random()*s,Math.random()*s);for(let j=0;j<4;j++)c.lineTo(Math.random()*s,Math.random()*s);c.strokeStyle=`rgba(40,35,30,${Math.random()*.1+.02})`;c.lineWidth=Math.random()+.3;c.stroke();}
});
const glassTex=(()=>{
  const cv=document.createElement('canvas');cv.width=cv.height=256;const c=cv.getContext('2d');
  c.fillStyle='rgba(80,100,130,.6)';c.fillRect(0,0,256,256);
  for(let r=0;r<6;r++)for(let col=0;col<5;col++){const x=10+col*50,y=10+r*40;c.fillStyle=Math.random()>.3?`rgba(255,240,190,${Math.random()*.4+.3})`:"rgba(20,30,50,.7)";c.fillRect(x,y,40,30);}
  const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
})();
const metalTex=noiseCanvas(256,'#5a5f66',20);
const woodTex=noiseCanvas(256,'#8b6914',18,(c,s)=>{c.strokeStyle='rgba(60,40,10,.25)';c.lineWidth=1;for(let i=0;i<8;i++){c.beginPath();c.moveTo(0,i*s/8);c.lineTo(s,i*s/8);c.stroke();}});
const rustTex=noiseCanvas(256,'#3a3a3a',20,(c,s)=>{for(let i=0;i<35;i++){c.fillStyle=`rgba(${140+Math.random()*60|0},${50+Math.random()*30|0},20,${Math.random()*.4+.1})`;c.beginPath();c.ellipse(Math.random()*s,Math.random()*s,Math.random()*25+4,Math.random()*18+4,Math.random()*Math.PI,0,Math.PI*2);c.fill();}});

const sandstoneTex=(()=>{
  const cv=document.createElement('canvas');cv.width=cv.height=512;const c=cv.getContext('2d');
  c.fillStyle='#c9a878';c.fillRect(0,0,512,512);
  const id=c.getImageData(0,0,512,512);
  for(let i=0;i<id.data.length;i+=4){const n=(Math.random()-.5)*22; id.data[i]+=n;id.data[i+1]+=n;id.data[i+2]+=n;}
  c.putImageData(id,0,0);
  for(let y=0;y<512;y+=Math.random()*40+20){
    c.fillStyle=`rgba(${130+Math.random()*40|0},${100+Math.random()*30|0},${70+Math.random()*30|0},${Math.random()*.18+.05})`;
    c.fillRect(0,y,512,Math.random()*4+1);
  }
  const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
})();
const darkConcreteTex=(()=>{
  const cv=document.createElement('canvas');cv.width=cv.height=512;const c=cv.getContext('2d');
  c.fillStyle='#4a4845';c.fillRect(0,0,512,512);
  const id=c.getImageData(0,0,512,512);
  for(let i=0;i<id.data.length;i+=4){const n=(Math.random()-.5)*30; id.data[i]+=n;id.data[i+1]+=n;id.data[i+2]+=n;}
  c.putImageData(id,0,0);
  for(let x=128;x<512;x+=128){c.fillStyle='rgba(20,18,15,.5)';c.fillRect(x-1,0,2,512);}
  c.fillStyle='rgba(20,18,15,.4)';c.fillRect(0,256,512,2);
  for(let i=0;i<6;i++){c.fillStyle=`rgba(${30+Math.random()*30|0},${25+Math.random()*25|0},20,${Math.random()*.15+.05})`;c.fillRect(Math.random()*512,0,Math.random()*6+2,512);}
  const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
})();
const tileTex=(()=>{
  const cv=document.createElement('canvas');cv.width=cv.height=512;const c=cv.getContext('2d');
  c.fillStyle='#d6c9a8';c.fillRect(0,0,512,512);
  for(let r=0;r<512/64+1;r++)for(let col=0;col<512/64+1;col++){
    const x=col*64,y=r*64;
    const v=210+Math.random()*30|0;
    c.fillStyle=`rgb(${v},${v-15},${v-40})`;
    c.fillRect(x+1,y+1,62,62);
  }
  c.strokeStyle='rgba(70,55,40,.6)';c.lineWidth=2;
  for(let i=0;i<=512;i+=64){c.beginPath();c.moveTo(0,i);c.lineTo(512,i);c.stroke();c.beginPath();c.moveTo(i,0);c.lineTo(i,512);c.stroke();}
  const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
})();

const _matCache = new Map();
function bmat(t,rx,ry){
  const key = t.uuid + '_' + rx + '_' + ry;
  if(_matCache.has(key)) return _matCache.get(key);
  const m=t.clone(); m.repeat.set(rx,ry); m.needsUpdate=true;
  const mat = new THREE.MeshStandardMaterial({map:m,roughness:.88});
  _matCache.set(key, mat);
  return mat;
}
// A texture may declare how many world units one tile should cover, via __sx
// and __sy. Without that everything repeats every 4 units, which is right for
// plain stone but shrinks a five-arch facade motif to 0.8u per arch.
function sides(t,w,h,d){
  const sx = t.__sx || 4, sy = t.__sy || 4;
  const rx = Math.max(1, Math.round(w/sx));
  const ry = Math.max(1, Math.round(h/sy));
  const rz = Math.max(1, Math.round(d/sx));
  return [bmat(t,rz,ry), bmat(t,rz,ry), bmat(t,rx,rz), bmat(t,rx,rz), bmat(t,rx,ry), bmat(t,rx,ry)];
}

function addBox(w,h,d,x,y,z,mats,collide=true){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mats);
  m.position.set(x,y+h/2,z); m.castShadow=true; m.receiveShadow=true;
  m.matrixAutoUpdate=false; m.updateMatrix();
  scene.add(m);
  if(collide) obstacles.push(new THREE.Box3().setFromObject(m));
  return m;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TACTICAL CITY — one royal palace complex, built as a CS-style two-sided map.

   The walls ARE the buildings. Lane dividers are 6-thick two-storey palace
   wings pierced by vaulted passages; spawns are gate courts; the two open courts are the
   Great Court and the Bazaar Court.

   FOUR ENTERABLE STRUCTURES, each a real route rather than decoration:
     · Palace Hall (A)  — run through it between approaches, or go around.
                          Exterior stairs both sides reach a roof terrace.
     · Riad (B)         — same footprint, built round an open courtyard, so
                          its roof is a walkable ring.
     · Mid arcades (x2) — colonnades you climb for an angle down mid.
   Everything else is solid, so the lane routing stays exactly as verified.

   LAYOUT (+Z is the T side, -Z is CT; mirrored across z=0)

        x=-90          x=-33   x=0   x=+33          x=+90
   z=-88 ┌──────────────────────────────────────────────┐
         │              CT  GATE  COURT                 │
   z=-58 ╞═══ gate ═══════╤══ gate ══╤═══ gate ═════════╡
         │  BAZAAR APPR.  │ W        │  GREAT APPR.     │
   z=-24 ├────────────────┤ E   CT   ├──────────────────┤
         │  BAZAAR COURT  │ S  MID   │  GREAT COURT     │
         │  [RIAD] souk   │ T        │  souk  [HALL]    │
   z=+24 ├────────────────┤ W        ├──────────────────┤
         │  BAZAAR APPR.  │ I        │  GREAT APPR.     │
   z=+58 ╞═══ gate ═══════╧══ gate ══╧═══ gate ═════════╡
         │              T   GATE  COURT                 │
   z=+88 └──────────────────────────────────────────────┘

   The wings (x=±30) carry two vaulted passages each plus a mashrabiya window
   at z≈0 — mid control is leverage on both flanks, not just a third lane.
   ═══════════════════════════════════════════════════════════════════════════ */
