// ── CONFIG ──────────────────────────────────────────────────────────────────
// TACTICAL CITY — a tighter rebuild.
//
// The first version was 184 units across with three lanes and a lot of ways
// between them: two passages plus a window through each divider, on top of the
// three spawn gates. That many connections means a push can always be answered
// from somewhere else, so nothing you commit to really costs anything.
//
// This one is 144 across (about 40% less ground) and each divider has exactly
// ONE passage, at mid-length. To reach a court you either walk its lane or take
// mid and cross — two routes, and picking one genuinely gives the other up.
// The windows stay, but only as sightlines: you can shoot through them, not
// walk through them.
// The town was shrunk to CS2 scale. Scaling the BUILDINGS alone made streets
// wider, not narrower — a smaller building in the same arena leaves more gap,
// so the arena had to come in with them.
//
// 90 x 90 playfield, wall at +/-45. Five blocks reach out to +/-44, so this
// leaves them inside with a unit to spare; at 76 they were poking through the
// curtain wall.
// half-size of the playfield. Overgrowth is built 1.33x bigger (OG_SCALE in
// 35-overgrowth.js), and a0-loop clamps the player to BW - 3.
// The palace is authored at 90 across (curtain wall at +/-47) and built 1.33x
// wider, 120 across, by the scale pass at the end of its section. Heights are
// NOT scaled: buildings stay 12 tall and stairs keep their step height.
const PAL_SCALE = 4 / 3;
const BW_D     = 47;      // design half-size, used while building the palace
const BW       = 47 * (MAP_ID === 'overgrowth' ? ((typeof OG_SCALE === 'number') ? OG_SCALE : 1) : PAL_SCALE);
const EDGE     = 45;      // inner face of the curtain wall
const BORDER_H = 20;
const WING_T   = 4;       // dividers are thinner now, the map is smaller
const WING_H   = 11;
const INNER_H  = 9;
const WT       = 1.2;
const STEP_UP  = 0.55;    // how high you can walk up without jumping
const SPRING_Y = 2.6;     // every arch springs from here

const DIV_W = -22, DIV_E = 22;          // the two dividers
const A_X0  =  24, A_X1  = EDGE;        // A lane
const B_X0  = -EDGE, B_X1 = -24;        // B lane
const T_Z0  =  46, T_Z1  =  68;         // T spawn court
const CT_Z0 = -68, CT_Z1 = -46;         // CT spawn court

// ═══════════════════════════════════════════════════════════════════════════
//  1.  TEXTURES — sandstone, zellige tilework, carved stucco, cedar
// ═══════════════════════════════════════════════════════════════════════════
function _cv(s){ const c=document.createElement('canvas'); c.width=c.height=s; return [c, c.getContext('2d')]; }
function _tex(cv){ const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; return t; }
function _grain(c,s,amt){
  const id=c.getImageData(0,0,s,s);
  for(let i=0;i<id.data.length;i+=4){ const n=(Math.random()-.5)*amt; id.data[i]+=n; id.data[i+1]+=n; id.data[i+2]+=n; }
  c.putImageData(id,0,0);
}
function _streaks(c,s,n,a){
  for(let i=0;i<n;i++){ c.fillStyle=`rgba(74,58,38,${Math.random()*a})`; c.fillRect(Math.random()*s,0,Math.random()*5+1,s); }
}
// draws a horseshoe-arch outline — the motif that ties the whole map together
function _archPath(c, x, y, w, h){
  const r = w/2;
  c.beginPath();
  c.moveTo(x, y+h);
  c.lineTo(x, y+r*0.82);
  c.arc(x+r, y+r*0.82, r, Math.PI, Math.PI*1.62, false);
  c.lineTo(x+w, y+r*0.82);
  c.lineTo(x+w, y+h);
  c.closePath();
}

// Weathered sandstone ashlar — the base masonry everywhere.
const ashlarTex = (()=>{
  const S=512, [cv,c]=_cv(S);
  c.fillStyle='#8a7551'; c.fillRect(0,0,S,S);
  const rowH=64;
  for(let r=0;r<S/rowH;r++){
    const off=(r%2)?56:0;
    for(let col=-1;col<S/112+1;col++){
      const x=col*112+off, y=r*rowH, v=Math.random();
      c.fillStyle=`rgb(${200+v*30|0},${174+v*26|0},${134+v*24|0})`;
      c.fillRect(x+2,y+2,108,rowH-4);
      c.fillStyle='rgba(255,244,212,0.20)'; c.fillRect(x+2,y+2,108,3);
      c.fillStyle='rgba(86,66,42,0.30)';    c.fillRect(x+2,y+rowH-6,108,4);
      for(let i=0;i<20;i++){
        c.fillStyle=`rgba(124,100,68,${Math.random()*0.12})`;
        c.beginPath(); c.arc(x+6+Math.random()*100,y+6+Math.random()*(rowH-12),Math.random()*4+1,0,7); c.fill();
      }
    }
  }
  _grain(c,S,14); _streaks(c,S,14,0.09);
  return _tex(cv);
})();

// Palace facade: ashlar with a blind arcade and a carved string course.
// Painting the arcading into the texture keeps the geometry cheap.
const facadeTex = (()=>{
  const S=512, [cv,c]=_cv(S);
  c.fillStyle='#c2a87c'; c.fillRect(0,0,S,S);
  _grain(c,S,16);
  for(let r=0;r<S;r+=64){                                  // course lines
    c.fillStyle='rgba(120,98,66,0.28)'; c.fillRect(0,r,S,2);
  }
  // blind arcade — five recessed horseshoe niches
  for(let i=0;i<5;i++){
    const x=14+i*98, y=150, w=76, h=250;
    c.save(); _archPath(c,x,y,w,h); c.clip();
    const g=c.createLinearGradient(x,y,x,y+h);
    g.addColorStop(0,'#7b6647'); g.addColorStop(1,'#5d4c35');
    c.fillStyle=g; c.fillRect(x,y,w,h);
    c.restore();
    c.save(); _archPath(c,x,y,w,h);
    c.strokeStyle='#e2cca0'; c.lineWidth=6; c.stroke();
    c.strokeStyle='rgba(90,72,48,0.7)'; c.lineWidth=2; c.stroke(); c.restore();
  }
  // carved string course band
  c.fillStyle='#b09468'; c.fillRect(0,96,S,34);
  c.strokeStyle='rgba(92,74,50,0.55)'; c.lineWidth=3;
  for(let i=0;i<S;i+=24){ c.beginPath(); c.moveTo(i,96); c.lineTo(i+12,130); c.lineTo(i+24,96); c.stroke(); }
  c.fillStyle='rgba(70,56,36,0.35)'; c.fillRect(0,128,S,5);
  _streaks(c,S,10,0.07);
  return _tex(cv);
})();

// ── TEXTURE WORLD SCALE ─────────────────────────────────────────────────────
// sides() tiles every texture every 4 world units by default. That is fine for
// plain stone, but facadeTex holds FIVE blind arches per tile and upperTex holds
// three windows across and two rows down — at a 4u repeat those arches come out
// 0.8u wide and the wall reads as wallpaper rather than architecture.
//
// __sx / __sy say how many world units ONE TILE should span, so the motif lands
// at architectural size: roughly a 3.4u bay and a 9u storey.
facadeTex.__sx = 17; facadeTex.__sy = 9;    // 5 bays across, 1 storey tall

// Upper storey: lime plaster with arched, screened windows.
const upperTex = (()=>{
  const S=512, [cv,c]=_cv(S);
  c.fillStyle='#ddcfae'; c.fillRect(0,0,S,S);
  _grain(c,S,12);
  for(let i=0;i<40;i++){
    c.strokeStyle=`rgba(160,142,110,${Math.random()*0.08})`; c.lineWidth=Math.random()*36+8;
    c.beginPath(); c.moveTo(Math.random()*S,Math.random()*S);
    c.quadraticCurveTo(Math.random()*S,Math.random()*S,Math.random()*S,Math.random()*S); c.stroke();
  }
  for(let i=0;i<3;i++) for(let j=0;j<2;j++){
    const x=44+i*160, y=90+j*230, w=84, h=150;
    c.save(); _archPath(c,x,y,w,h); c.clip();
    c.fillStyle='#2b2419'; c.fillRect(x,y,w,h);
    c.strokeStyle='rgba(180,150,100,0.85)'; c.lineWidth=3;   // mashrabiya lattice
    for(let k=-h;k<w+h;k+=11){
      c.beginPath(); c.moveTo(x+k,y); c.lineTo(x+k+h,y+h); c.stroke();
      c.beginPath(); c.moveTo(x+k,y+h); c.lineTo(x+k+h,y); c.stroke();
    }
    c.restore();
    c.save(); _archPath(c,x,y,w,h);
    c.strokeStyle='#8d7a52'; c.lineWidth=7; c.stroke(); c.restore();
    c.fillStyle='rgba(190,175,140,0.6)'; c.fillRect(x-6,y+h,w+12,7);   // sill
  }
  _streaks(c,S,9,0.06);
  return _tex(cv);
})();
upperTex.__sx = 17; upperTex.__sy = 18;      // 3 windows across, 2 rows down

// Zellige — geometric star tilework for dados, bands and fountains.
const zelligeTex = (()=>{
  const S=256, [cv,c]=_cv(S);
  c.fillStyle='#f0ead8'; c.fillRect(0,0,S,S);
  const cols=['#1d5b6e','#2f8f7a','#c1462f','#e0b23c','#f0ead8'];
  const t=64;
  for(let r=0;r<S/t;r++) for(let q=0;q<S/t;q++){
    const ox=q*t+t/2, oy=r*t+t/2;
    c.fillStyle=cols[(r+q)%2?0:1];
    c.beginPath();                                   // eight-point star
    for(let k=0;k<16;k++){
      const rad=(k%2?t*0.5:t*0.24), a=k*Math.PI/8;
      const px=ox+Math.cos(a)*rad, py=oy+Math.sin(a)*rad;
      k?c.lineTo(px,py):c.moveTo(px,py);
    }
    c.closePath(); c.fill();
    c.fillStyle=cols[2+((r+q)%3)];
    c.beginPath(); c.arc(ox,oy,t*0.13,0,7); c.fill();
  }
  c.strokeStyle='rgba(40,34,24,0.30)'; c.lineWidth=1.5;
  for(let i=0;i<=S;i+=t){ c.beginPath(); c.moveTo(0,i); c.lineTo(S,i); c.stroke();
                          c.beginPath(); c.moveTo(i,0); c.lineTo(i,S); c.stroke(); }
  _grain(c,S,10);
  return _tex(cv);
})();

// Carved stucco — arabesque relief for arch spandrels and upper bands.
const palaceStuccoTex = (()=>{
  const S=256, [cv,c]=_cv(S);
  c.fillStyle='#e6dcc2'; c.fillRect(0,0,S,S);
  c.strokeStyle='rgba(150,132,100,0.55)'; c.lineWidth=2.4;
  for(let i=0;i<26;i++){
    const x=Math.random()*S, y=Math.random()*S, r=14+Math.random()*22;
    c.beginPath();
    for(let k=0;k<=24;k++){
      const a=k/24*Math.PI*2, rr=r*(1+0.34*Math.sin(a*6));
      const px=x+Math.cos(a)*rr, py=y+Math.sin(a)*rr;
      k?c.lineTo(px,py):c.moveTo(px,py);
    }
    c.closePath(); c.stroke();
  }
  c.strokeStyle='rgba(120,102,72,0.35)'; c.lineWidth=1.2;
  for(let i=0;i<S;i+=16){ c.beginPath(); c.moveTo(i,0); c.lineTo(0,i); c.stroke();
                          c.beginPath(); c.moveTo(S-i,S); c.lineTo(S,S-i); c.stroke(); }
  _grain(c,S,8);
  return _tex(cv);
})();

// Marble paving with inlay bands — the courts.
const marbleTex = (()=>{
  const S=512, [cv,c]=_cv(S);
  c.fillStyle='#ded6c4'; c.fillRect(0,0,S,S);
  for(let i=0;i<34;i++){                                    // veining
    c.strokeStyle=`rgba(140,130,112,${Math.random()*0.22+0.05})`; c.lineWidth=Math.random()*2.4+0.4;
    let x=Math.random()*S, y=Math.random()*S; c.beginPath(); c.moveTo(x,y);
    for(let k=0;k<7;k++){ x+=(Math.random()-.5)*130; y+=(Math.random()-.5)*130; c.lineTo(x,y); }
    c.stroke();
  }
  for(let i=0;i<=S;i+=128){                                 // slab joints + inlay
    c.fillStyle='rgba(120,108,88,0.45)'; c.fillRect(0,i,S,3); c.fillRect(i,0,3,S);
    c.fillStyle='#2f6b74'; c.fillRect(0,i+3,S,2); c.fillRect(i+3,0,2,S);
  }
  _grain(c,S,10);
  return _tex(cv);
})();

// Court paving — terracotta with a tile border feel.
const courtTex = (()=>{
  const S=512, [cv,c]=_cv(S);
  c.fillStyle='#8d6a4c'; c.fillRect(0,0,S,S);
  const t=85;
  for(let r=0;r<S/t+1;r++) for(let q=0;q<S/t+1;q++){
    const x=q*t, y=r*t, v=Math.random();
    c.fillStyle=`rgb(${178+v*38|0},${108+v*28|0},${74+v*20|0})`;
    c.fillRect(x+3,y+3,t-6,t-6);
    c.fillStyle='rgba(255,222,182,0.10)'; c.fillRect(x+3,y+3,t-6,3);
    c.fillStyle=`rgba(70,44,28,${Math.random()*0.18})`; c.fillRect(x+3,y+t-9,t-6,4);
  }
  _grain(c,S,16);
  return _tex(cv);
})();

// Dusty open ground for the approaches.
// ── SAND FLOORS ─────────────────────────────────────────────────────────────
// All walkable ground is sand. Three tints of the same material give enough
// cue to tell approach from court from interior, without a tile grid — and
// because they share a family, any seam between them is nearly invisible.
function sandVariant(base, pebble, drift){
  const S=512, [cv,c]=_cv(S);
  c.fillStyle=base; c.fillRect(0,0,S,S);
  _grain(c,S,26);
  for(let i=0;i<80;i++){                              // wind drifts
    c.fillStyle=`rgba(${drift},${Math.random()*0.16+0.04})`;
    c.beginPath();
    c.ellipse(Math.random()*S,Math.random()*S,Math.random()*46+10,Math.random()*16+4,Math.random()*3,0,7);
    c.fill();
  }
  for(let i=0;i<190;i++){                             // grit
    c.fillStyle=`rgba(${pebble},${Math.random()*0.4})`;
    c.beginPath(); c.arc(Math.random()*S,Math.random()*S,Math.random()*2.1+0.5,0,7); c.fill();
  }
  for(let i=0;i<9;i++){                               // scuffed tracks
    c.strokeStyle=`rgba(${pebble},${Math.random()*0.10+0.03})`;
    c.lineWidth=Math.random()*22+8;
    c.beginPath(); c.moveTo(Math.random()*S,0);
    c.bezierCurveTo(Math.random()*S,S/3,Math.random()*S,2*S/3,Math.random()*S,S);
    c.stroke();
  }
  return _tex(cv);
}
const sandApproachTex = sandVariant('#a8916a', '90,76,54', '140,118,84');   // open ground
const sandCourtTex    = sandVariant('#b59c72', '96,80,56', '150,128,92');   // the two courts
const sandRoomTex     = sandVariant('#c0a87e', '104,88,62', '158,136,100'); // swept interiors

const dustTex = (()=>{
  const S=512, [cv,c]=_cv(S);
  c.fillStyle='#a8916a'; c.fillRect(0,0,S,S);
  _grain(c,S,30);
  for(let i=0;i<60;i++){
    c.fillStyle=`rgba(${140+Math.random()*40|0},${118+Math.random()*30|0},84,${Math.random()*0.2})`;
    c.beginPath(); c.ellipse(Math.random()*S,Math.random()*S,Math.random()*40+8,Math.random()*24+5,Math.random()*3,0,7); c.fill();
  }
  for(let i=0;i<150;i++){
    c.fillStyle=`rgba(90,76,54,${Math.random()*0.4})`;
    c.beginPath(); c.arc(Math.random()*S,Math.random()*S,Math.random()*2.2+0.6,0,7); c.fill();
  }
  return _tex(cv);
})();

// Carved cedar — doors, screens, balcony rails.
const cedarTex = (()=>{
  const S=256, [cv,c]=_cv(S);
  c.fillStyle='#5a3a1e'; c.fillRect(0,0,S,S);
  for(let i=0;i<S;i+=32){
    const v=Math.random();
    c.fillStyle=`rgb(${96+v*40|0},${58+v*26|0},${28+v*16|0})`; c.fillRect(0,i,S,28);
    c.fillStyle='rgba(30,16,6,0.55)'; c.fillRect(0,i+28,S,4);
    for(let g=0;g<7;g++){
      c.strokeStyle=`rgba(40,22,8,${Math.random()*0.2})`; c.lineWidth=Math.random()*1.3+0.3;
      c.beginPath(); c.moveTo(0,i+Math.random()*28);
      c.bezierCurveTo(S/3,i+Math.random()*28,2*S/3,i+Math.random()*28,S,i+Math.random()*28); c.stroke();
    }
  }
  c.strokeStyle='rgba(210,180,120,0.30)'; c.lineWidth=2;    // carved diamonds
  for(let y=0;y<S;y+=32) for(let x=0;x<S;x+=32){
    c.beginPath(); c.moveTo(x+16,y+4); c.lineTo(x+28,y+16); c.lineTo(x+16,y+28); c.lineTo(x+4,y+16); c.closePath(); c.stroke();
  }
  _grain(c,S,12);
  return _tex(cv);
})();

// Green copper for domes.
const copperTex = (()=>{
  const S=256, [cv,c]=_cv(S);
  c.fillStyle='#3f8b74'; c.fillRect(0,0,S,S);
  for(let i=0;i<90;i++){
    c.fillStyle=`rgba(${60+Math.random()*70|0},${130+Math.random()*60|0},${110+Math.random()*50|0},${Math.random()*0.5})`;
    c.beginPath(); c.ellipse(Math.random()*S,Math.random()*S,Math.random()*26+6,Math.random()*18+4,Math.random()*3,0,7); c.fill();
  }
  for(let i=0;i<S;i+=16){ c.fillStyle='rgba(20,60,50,0.25)'; c.fillRect(i,0,2,S); }
  _grain(c,S,14);
  return _tex(cv);
})();

const awningTex = (()=>{
  const S=256, [cv,c]=_cv(S);
  for(let i=0;i<S;i+=32){ c.fillStyle=(i/32)%2 ? '#c1462f' : '#e8ddc0'; c.fillRect(i,0,32,S); }
  _grain(c,S,16);
  return _tex(cv);
})();

const crateTex = (()=>{
  const S=256, [cv,c]=_cv(S);
  c.fillStyle='#a37a44'; c.fillRect(0,0,S,S);
  for(let i=0;i<S;i+=40){
    const v=Math.random();
    c.fillStyle=`rgb(${150+v*46|0},${112+v*34|0},${62+v*22|0})`; c.fillRect(0,i,S,36);
    c.fillStyle='rgba(56,34,12,0.45)'; c.fillRect(0,i+36,S,4);
  }
  c.fillStyle='rgba(50,34,16,0.55)'; c.fillRect(6,6,10,S-12); c.fillRect(S-16,6,10,S-12);
  _grain(c,S,14);
  return _tex(cv);
})();

const bagTex = (()=>{
  const S=256, [cv,c]=_cv(S);
  c.fillStyle='#6d6144'; c.fillRect(0,0,S,S);
  for(let r=0;r<4;r++) for(let q=-1;q<5;q++){
    const x=q*64+(r%2?32:0), y=r*64, v=Math.random();
    c.fillStyle=`rgb(${140+v*40|0},${126+v*32|0},${88+v*26|0})`;
    c.beginPath(); c.ellipse(x+32,y+32,32,26,0,0,7); c.fill();
    c.fillStyle='rgba(50,42,26,0.28)';
    c.beginPath(); c.ellipse(x+32,y+52,30,10,0,0,7); c.fill();
  }
  _grain(c,S,20);
  return _tex(cv);
})();

// ═══════════════════════════════════════════════════════════════════════════
//  2.  MULTI-LEVEL GROUND HEIGHT
//      Returns the highest walkable surface AT OR BELOW your feet, which is
//      what makes roofs and upper floors work: standing under a terrace no
//      longer snaps you up onto it.
// ═══════════════════════════════════════════════════════════════════════════
const platforms = [];                       // {x0,x1,z0,z1,top}

// 4, not 16. solidFootprint() emits walkable cells 1.2 units across — up to
// ~425 per building, so 3-4k rects across the map — and a 16-unit bucket meant
// one groundHeightAt() call linearly scanned 200-400 of them. The player calls
// it twice a frame and every other actor once. Quartering the cell size cuts
// the rects tested per query by roughly 16x for the cost of a bigger Map.
const _PGRID = 4;
const _pgrid = new Map();
let _pgridBuilt = false;
function _buildPlatformGrid(){
  _pgrid.clear();
  for(let i=0;i<platforms.length;i++){
    const p = platforms[i];
    const cx0=Math.floor(p.x0/_PGRID), cx1=Math.floor(p.x1/_PGRID);
    const cz0=Math.floor(p.z0/_PGRID), cz1=Math.floor(p.z1/_PGRID);
    for(let cx=cx0;cx<=cx1;cx++) for(let cz=cz0;cz<=cz1;cz++){
      const k = cx*4096 + cz;
      let a=_pgrid.get(k); if(!a){ a=[]; _pgrid.set(k,a); }
      a.push(p);
    }
  }
  _pgridBuilt = true;
}
function groundHeightAt(x, z, feetY){
  if(!_pgridBuilt) _buildPlatformGrid();
  const cell = _pgrid.get(Math.floor(x/_PGRID)*4096 + Math.floor(z/_PGRID));
  if(!cell) return 0;
  const ceiling = (feetY === undefined) ? Infinity : feetY + STEP_UP;
  let h = 0;
  for(let i=0;i<cell.length;i++){
    const p = cell[i];
    if(p.top <= h || p.top > ceiling) continue;
    if(x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) h = p.top;
  }
  return h;
}
window.groundHeightAt = groundHeightAt;

// ═══════════════════════════════════════════════════════════════════════════
//  3.  BUILD PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════
function ground(x0, z0, x1, z1, tex, tile, y){
  const w=x1-x0, d=z1-z0;
  const t=tex.clone(); t.repeat.set(Math.max(1,w/(tile||8)), Math.max(1,d/(tile||8))); t.needsUpdate=true;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d), new THREE.MeshStandardMaterial({map:t, roughness:0.95}));
  m.rotation.x=-Math.PI/2; m.position.set((x0+x1)/2, y===undefined?0.02:y, (z0+z1)/2);
  m.receiveShadow=true; m.matrixAutoUpdate=false; m.updateMatrix(); scene.add(m);
}

function wallX(z, x0, x1, h, tex, baseY, thick){
  if(x1-x0 < 0.05 || h <= 0) return;
  const w=x1-x0, t=thick||WT;
  addBox(w, h, t, (x0+x1)/2, baseY||0, z, sides(tex,w,h,t), true);
}
function wallZ(x, z0, z1, h, tex, baseY, thick){
  if(z1-z0 < 0.05 || h <= 0) return;
  const d=z1-z0, t=thick||WT;
  addBox(t, h, d, x, baseY||0, (z0+z1)/2, sides(tex,t,h,d), true);
}

// Fills the masonry above an arched opening, leaving an elliptical void.
// Every piece sits above the springline, so it shapes the silhouette and stops
// bullets without ever blocking a walking player.
function archFill(axis, fixed, cx, dw, wallTop, tex, thick){
  const rx = dw/2;
  const ry = Math.min(dw/2, wallTop - SPRING_Y - 0.25);
  if(ry <= 0.05) return;
  const N = 6;
  for(let i=0;i<N;i++){
    const y0 = SPRING_Y + ry*(i/N), y1 = SPRING_Y + ry*((i+1)/N);
    const ym = (y0+y1)/2 - SPRING_Y;
    const hw = rx * Math.sqrt(Math.max(0, 1 - (ym/ry)*(ym/ry)));
    const segW = rx - hw;
    if(segW > 0.04){
      for(const s of [-1, 1]){
        const c = cx + s*(hw + segW/2);
        if(axis === 'x') addBox(segW, y1-y0, thick, c, y0, fixed, sides(tex,segW,y1-y0,thick), true);
        else             addBox(thick, y1-y0, segW, fixed, y0, c, sides(tex,thick,y1-y0,segW), true);
      }
    }
  }
  const aTop = SPRING_Y + ry;
  if(wallTop > aTop + 0.05){
    if(axis === 'x') addBox(dw, wallTop-aTop, thick, cx, aTop, fixed, sides(tex,dw,wallTop-aTop,thick), true);
    else             addBox(thick, wallTop-aTop, dw, fixed, aTop, cx, sides(tex,thick,wallTop-aTop,dw), true);
  }
}

// A wall pierced by arched openings.
function archedWallX(z, x0, x1, h, tex, thick, doors){
  // only openings that actually fall inside this span belong to this segment
  const g=(doors||[]).filter(d => d[1] > x0 && d[0] < x1).sort((a,b)=>a[0]-b[0]);
  let cur=x0;
  for(const [a,b] of g){
    if(a>cur) wallX(z, cur, Math.min(a,x1), h, tex, 0, thick);
    cur=Math.max(cur,b);
    archFill('x', z, (a+b)/2, b-a, h, tex, thick||WT);
  }
  if(cur<x1) wallX(z, cur, x1, h, tex, 0, thick);
}
function archedWallZ(x, z0, z1, h, tex, thick, doors){
  const g=(doors||[]).filter(d => d[1] > z0 && d[0] < z1).sort((a,b)=>a[0]-b[0]);
  let cur=z0;
  for(const [a,b] of g){
    if(a>cur) wallZ(x, cur, Math.min(a,z1), h, tex, 0, thick);
    cur=Math.max(cur,b);
    archFill('z', x, (a+b)/2, b-a, h, tex, thick||WT);
  }
  if(cur<z1) wallZ(x, cur, z1, h, tex, 0, thick);
}

// Shoot-through window: solid to the sill, open, solid above.
function windowZ(x, z0, z1, h, tex, thick, sill, head){
  sill = sill===undefined?1.15:sill; head = head===undefined?2.55:head;
  wallZ(x, z0, z1, sill, tex, 0, thick);
  if(h > head) wallZ(x, z0, z1, h-head, tex, head, thick);
}

// Solid mass you can stand on top of (fills from the ground up).
function platform(x0, z0, x1, z1, top, tex){
  const w=x1-x0, d=z1-z0;
  if(w<=0||d<=0||top<=0) return;
  addBox(w, top, d, (x0+x1)/2, 0, (z0+z1)/2, sides(tex,w,top,d), true);
  platforms.push({x0,x1,z0,z1,top});
}

// Walkable slab with OPEN SPACE BENEATH — upper floors, roofs, terraces.
function slab(x0, z0, x1, z1, y, t, tex){
  const w=x1-x0, d=z1-z0;
  if(w<=0||d<=0) return;
  addBox(w, t, d, (x0+x1)/2, y, (z0+z1)/2, sides(tex,w,t,d), true);
  platforms.push({x0,x1,z0,z1,top:y+t});
}

// Stepped stairs — they block bullets like real masonry and are walkable.
function stairsZ(x0, x1, zBase, zTop, top, tex){
  const n=Math.max(2, Math.ceil(top/0.42)), span=zTop-zBase;
  for(let i=0;i<n;i++){
    const h=top*(i+1)/n, a=zBase+span*(i/n), b=zBase+span*((i+1)/n);
    platform(x0, Math.min(a,b), x1, Math.max(a,b), h, tex);
  }
}
function stairsX(z0, z1, xBase, xTop, top, tex){
  const n=Math.max(2, Math.ceil(top/0.42)), span=xTop-xBase;
  for(let i=0;i<n;i++){
    const h=top*(i+1)/n, a=xBase+span*(i/n), b=xBase+span*((i+1)/n);
    platform(Math.min(a,b), z0, Math.max(a,b), z1, h, tex);
  }
}

// ── Decorative geometry (merged later by the FPS pass) ──────────────────────
const _merlonMat = new THREE.MeshStandardMaterial({ map:ashlarTex, roughness:0.9 });
function merlonsX(z, x0, x1, y, step){
  for(let x=x0+0.6; x<x1-0.6; x+=(step||2.6)){
    const m=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.0,1.1), _merlonMat);
    m.position.set(x, y+0.5, z); m.castShadow=true;
    m.matrixAutoUpdate=false; m.updateMatrix(); scene.add(m);
    const cap=new THREE.Mesh(new THREE.ConeGeometry(0.62,0.55,4), _merlonMat);
    cap.position.set(x, y+1.28, z); cap.rotation.y=Math.PI/4;
    cap.matrixAutoUpdate=false; cap.updateMatrix(); scene.add(cap);
  }
}
function merlonsZ(x, z0, z1, y, step){
  for(let z=z0+0.6; z<z1-0.6; z+=(step||2.6)){
    const m=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.0,1.1), _merlonMat);
    m.position.set(x, y+0.5, z); m.castShadow=true;
    m.matrixAutoUpdate=false; m.updateMatrix(); scene.add(m);
    const cap=new THREE.Mesh(new THREE.ConeGeometry(0.62,0.55,4), _merlonMat);
    cap.position.set(x, y+1.28, z); cap.rotation.y=Math.PI/4;
    cap.matrixAutoUpdate=false; cap.updateMatrix(); scene.add(cap);
  }
}

// Moorish column: stone base, slender shaft, carved capital, square abacus.
const _shaftMat   = new THREE.MeshStandardMaterial({ map:marbleTex, roughness:0.42, metalness:0.05 });
const _capitalMat = new THREE.MeshStandardMaterial({ map:palaceStuccoTex, roughness:0.78 });
function column(x, z, h, collide){
  const g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.BoxGeometry(0.78,0.26,0.78), _capitalMat);
  base.position.y=0.13; g.add(base);
  const torus=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.36,0.18,12), _shaftMat);
  torus.position.y=0.35; g.add(torus);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.26,h-1.1,12), _shaftMat);
  shaft.position.y=0.44+(h-1.1)/2; shaft.castShadow=true; g.add(shaft);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.24,0.42,12), _capitalMat);
  cap.position.y=h-0.5; g.add(cap);
  const abacus=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.2,0.72), _capitalMat);
  abacus.position.y=h-0.2; g.add(abacus);
  g.position.set(x,0,z); g.matrixAutoUpdate=false; g.updateMatrix(); scene.add(g);
  if(collide !== false){
    obstacles.push(new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(x, h/2, z), new THREE.Vector3(0.8, h, 0.8)));
  }
}

// A run of columns carrying arches — the riwaq that edges every court.
function arcadeRow(axis, fixed, from, to, spacing, h){
  // Math.abs matters: these rows are called with reversed ranges on the -Z
  // side, and without it the mirrored colonnade loses a column.
  const n=Math.max(1, Math.round(Math.abs(to-from)/spacing));
  for(let i=0;i<=n;i++){
    const p=from+(to-from)*(i/n);
    if(axis==='x') column(p, fixed, h);
    else           column(fixed, p, h);
  }
}

// Green-copper dome on a drum — the palace silhouette.
function dome(x, z, r, baseY, collide){
  const g=new THREE.Group();
  const drum=new THREE.Mesh(new THREE.CylinderGeometry(r,r,r*0.42,16), new THREE.MeshStandardMaterial({map:palaceStuccoTex,roughness:0.8}));
  drum.position.y=r*0.21; drum.castShadow=true; g.add(drum);
  const shell=new THREE.Mesh(new THREE.SphereGeometry(r*0.98,18,12,0,Math.PI*2,0,Math.PI/2),
              new THREE.MeshStandardMaterial({map:copperTex, roughness:0.44, metalness:0.55, envMapIntensity:1.2}));
  shell.position.y=r*0.42; shell.castShadow=true; g.add(shell);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.2,0.5,8), _capitalMat);
  neck.position.y=r*0.42+r*0.96; g.add(neck);
  const finial=new THREE.Mesh(new THREE.SphereGeometry(0.26,10,8),
               new THREE.MeshStandardMaterial({color:0xd9b25a, roughness:0.3, metalness:0.9}));
  finial.position.y=r*0.42+r*0.96+0.42; g.add(finial);
  g.position.set(x, baseY, z); g.matrixAutoUpdate=false; g.updateMatrix(); scene.add(g);
  if(collide !== false){
    obstacles.push(new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(x, baseY + r*0.7, z), new THREE.Vector3(r*2, r*1.4, r*2)));
  }
}

// Zellige-tiled fountain basin — chest-high cover you can also vault.
function fountain(x, z, r, baseY){
  const y = baseY || 0;
  const g=new THREE.Group();
  const basin=new THREE.Mesh(new THREE.CylinderGeometry(r,r*0.94,0.9,16),
              new THREE.MeshStandardMaterial({map:(()=>{const t=zelligeTex.clone();t.repeat.set(6,1);t.needsUpdate=true;return t;})(), roughness:0.5}));
  basin.position.y=0.45; basin.castShadow=true; g.add(basin);
  const water=new THREE.Mesh(new THREE.CircleGeometry(r*0.88,20),
              new THREE.MeshStandardMaterial({color:0x2f6b74, roughness:0.06, metalness:0.5, envMapIntensity:1.6}));
  water.rotation.x=-Math.PI/2; water.position.y=0.82; g.add(water);
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.24,0.9,10), _shaftMat);
  stem.position.y=1.3; g.add(stem);
  const bowl=new THREE.Mesh(new THREE.CylinderGeometry(0.72,0.3,0.24,14), _shaftMat);
  bowl.position.y=1.85; g.add(bowl);
  g.position.set(x,y,z); g.matrixAutoUpdate=false; g.updateMatrix(); scene.add(g);
  obstacles.push(new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y+1.0, z), new THREE.Vector3(r*2, 2.0, r*2)));
  platforms.push({x0:x-r*0.7, x1:x+r*0.7, z0:z-r*0.7, z1:z+r*0.7, top:y+0.9});
}

const _awningMat = new THREE.MeshStandardMaterial({ map:awningTex, roughness:0.9, side:THREE.DoubleSide });
const _poleMat   = new THREE.MeshStandardMaterial({ map:cedarTex, roughness:0.7 });
function awning(x, z, w, depth, y, rotY){
  const g=new THREE.Group();
  const cloth=new THREE.Mesh(new THREE.BoxGeometry(w,0.1,depth), _awningMat);
  cloth.rotation.x=-0.24; cloth.castShadow=true; g.add(cloth);
  for(const sx of [-w/2+0.2, w/2-0.2]){
    const bar=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,depth,6), _poleMat);
    bar.rotation.x=Math.PI/2-0.24; bar.position.set(sx,-0.05,0); g.add(bar);
  }
  g.position.set(x,y,z); g.rotation.y=rotY||0;
  g.matrixAutoUpdate=false; g.updateMatrix(); scene.add(g);
}

// Bazaar stall — awning, counter, goods. Counter is cover.
function stall(x, z, rotY){
  const g=new THREE.Group();
  for(const [px,pz] of [[-1.5,-0.8],[1.5,-0.8],[-1.5,0.8],[1.5,0.8]]){
    const p=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,2.4,6), _poleMat);
    p.position.set(px,1.2,pz); g.add(p);
  }
  const roof=new THREE.Mesh(new THREE.BoxGeometry(3.4,0.1,2.0), _awningMat);
  roof.position.y=2.45; roof.rotation.x=0.1; roof.castShadow=true; g.add(roof);
  const counter=new THREE.Mesh(new THREE.BoxGeometry(3.2,0.95,0.8),
                new THREE.MeshStandardMaterial({map:cedarTex, roughness:0.75}));
  counter.position.set(0,0.48,0.55); counter.castShadow=true; g.add(counter);
  for(let i=0;i<6;i++){
    const s=new THREE.Mesh(new THREE.SphereGeometry(0.12+Math.random()*0.08,7,5),
            new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(Math.random()*0.16+0.03,0.6,0.42), roughness:0.85}));
    s.position.set(-1.3+i*0.52, 1.05, 0.5); g.add(s);
  }
  g.position.set(x,0,z); g.rotation.y=rotY||0;
  g.matrixAutoUpdate=false; g.updateMatrix(); scene.add(g);
  const c=Math.abs(Math.cos(rotY||0)), s=Math.abs(Math.sin(rotY||0));
  obstacles.push(new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, 0.5, z), new THREE.Vector3(c*3.4+s*1.8, 1.0, c*1.8+s*3.4)));
}

// Big storage jar.
function amphora(x, z){
  const m=new THREE.MeshStandardMaterial({map:courtTex, roughness:0.8});
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.SphereGeometry(0.55,12,10), m);
  body.scale.set(1,1.35,1); body.position.y=0.72; body.castShadow=true; g.add(body);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.3,0.4,10), m);
  neck.position.y=1.5; g.add(neck);
  g.position.set(x,0,z); g.matrixAutoUpdate=false; g.updateMatrix(); scene.add(g);
  obstacles.push(new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x,0.8,z), new THREE.Vector3(1.15,1.6,1.15)));
}

function crate(x, z, size, h){
  addBox(size, h, size, x, 0, z, sides(crateTex,size,h,size), true);
  platforms.push({x0:x-size/2, x1:x+size/2, z0:z-size/2, z1:z+size/2, top:h});
}
function crateStack(x, z){ crate(x,z,2.6,1.7); crate(x-0.5,z,1.7,2.9); }
function sandbagsX(z, x0, x1){ wallX(z, x0, x1, 1.1, bagTex); }
function sandbagsZ(x, z0, z1){ wallZ(x, z0, z1, 1.1, bagTex); }

function planter(x, z){
  const g=new THREE.Group();
  const pot=new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.5,0.9,12),
            new THREE.MeshStandardMaterial({map:zelligeTex, roughness:0.55}));
  pot.position.y=0.45; pot.castShadow=true; g.add(pot);
  const leaf=new THREE.MeshStandardMaterial({color:0x4a6b32, roughness:0.9});
  for(let i=0;i<8;i++){
    const l=new THREE.Mesh(new THREE.SphereGeometry(0.42,7,5), leaf);
    l.position.set((Math.random()-0.5)*0.9, 1.3+Math.random()*0.7, (Math.random()-0.5)*0.9);
    l.scale.set(0.5,1.5,0.5); g.add(l);
  }
  g.position.set(x,0,z); g.matrixAutoUpdate=false; g.updateMatrix(); scene.add(g);
  obstacles.push(new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x,0.7,z), new THREE.Vector3(1.3,1.4,1.3)));
}

// Carved cedar door leaf set into an opening — reads as "this is a way through".
function doorLeaf(axis, fixed, cx, w, rotOpen){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w*0.46, 2.5, 0.12),
          new THREE.MeshStandardMaterial({map:cedarTex, roughness:0.7}));
  if(axis==='x') m.position.set(cx - w*0.26, 1.25, fixed);
  else { m.position.set(fixed, 1.25, cx - w*0.26); m.rotation.y=Math.PI/2; }
  m.rotation.y += (rotOpen||0);
  m.matrixAutoUpdate=false; m.updateMatrix(); scene.add(m);
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAP SELECTION
//  Everything from here to TEAM SPAWNS that is specific to the palace is
//  wrapped in `if(MAP_ID === 'alcazar')`. Other maps build themselves from
//  their own part file (35-overgrowth.js) at the TOWN step, using the same
//  primitives, and hand back their spawn zones.
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
//  PALACE RAMPARTS AND THE CITY BEYOND
//  Built AFTER the scale pass, directly in world units (the inner face of the
//  wall is at +/-60), so nothing here is stretched.
//   · the wall: ochre rammed-earth plaster over an ashlar plinth, a zellige
//     tile band, a painted blind arcade, stone pilasters with brass lanterns,
//     a cornice and stepped Moorish merlons; a square tower on each corner
//   · beyond it: date palms whose crowns rise over the wall, a sprawl of
//     whitewashed and ochre houses with domes and minarets, desert to the
//     horizon
// ═══════════════════════════════════════════════════════════════════════════
const rampartTex = (()=>{                     // tapial: rammed earth, plastered
  const S=512, [cv,c]=_cv(S);
  c.fillStyle='#c9965e'; c.fillRect(0,0,S,S);
  for(let y=0;y<S;y+=64){                     // formwork lifts
    const v=Math.random()*16-8;
    c.fillStyle=`rgb(${204+v|0},${155+v|0},${100+v|0})`; c.fillRect(0,y+3,S,58);
    c.fillStyle='rgba(120,78,40,0.35)'; c.fillRect(0,y+61,S,3);
    for(let x=24+(y/64%2)*60;x<S;x+=120){     // putlog holes
      c.fillStyle='rgba(70,44,22,0.75)'; c.fillRect(x,y+50,9,8);
    }
  }
  for(let i=0;i<260;i++){                     // patchy plaster
    c.fillStyle=`rgba(${Math.random()<.5?'236,206,160':'150,104,62'},${Math.random()*0.10})`;
    c.beginPath(); c.ellipse(Math.random()*S,Math.random()*S,Math.random()*40+8,Math.random()*20+6,0,0,7); c.fill();
  }
  _grain(c,S,16); _streaks(c,S,22,0.10);
  const t=_tex(cv); t.__sx=8; t.__sy=8; return t;
})();
const arcadeTex = (()=>{                      // blind horseshoe arcade
  const W=256,H=256, [cv,c]=_cv(W);
  c.fillStyle='#cf9d64'; c.fillRect(0,0,W,H);
  const cx=W/2, top=58, r=74;
  c.fillStyle='#e7c793';                      // carved frame
  c.beginPath(); c.moveTo(cx-r-14,H); c.lineTo(cx-r-14,top+r);
  c.arc(cx,top+r,r+14,Math.PI*0.92,Math.PI*2.08); c.lineTo(cx+r+14,H); c.closePath(); c.fill();
  const g=c.createLinearGradient(0,top,0,H); g.addColorStop(0,'#5c3a20'); g.addColorStop(1,'#8a5a32');
  c.fillStyle=g;                              // the recess
  c.beginPath(); c.moveTo(cx-r,H); c.lineTo(cx-r,top+r);
  c.arc(cx,top+r,r,Math.PI*0.92,Math.PI*2.08); c.lineTo(cx+r,H); c.closePath(); c.fill();
  c.fillStyle='rgba(28,92,104,0.85)';         // tile spandrels
  for(const sx of [10, W-34]) for(let k=0;k<3;k++){ c.save(); c.translate(sx+12,22+k*20); c.rotate(Math.PI/4); c.fillRect(-6,-6,12,12); c.restore(); }
  c.strokeStyle='rgba(90,58,30,0.5)'; c.lineWidth=3; c.strokeRect(1,1,W-2,H-2);
  _grain(c,W,12);
  return _tex(cv);
})();

function buildPalaceRamparts(){
  const IN = EDGE * PAL_SCALE;              // 60: inner face of the wall
  const TH = 5, OUT = IN + TH, H = BORDER_H;
  const WARM = 0xf0c898;                    // warms the plaster under the bright desert sun
  const plaster = new THREE.MeshStandardMaterial({ map:rampartTex, color:WARM, roughness:0.95 });
  const stone   = new THREE.MeshStandardMaterial({ map:ashlarTex, color:0xdcc6a0, roughness:0.9 });
  const tile    = new THREE.MeshStandardMaterial({ map:zelligeTex, roughness:0.45, metalness:0.05 });
  const add = (geo, mat, x, y, z, ry=0, shadow=true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry;
    m.castShadow = shadow; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m); return m;
  };
  const solid = (x0, z0, x1, z1, y1) => obstacles.push(new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, y1, z1)));
  const repeat = (tex, rx, ry) => { const t = tex.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return t; };

  // Each side is built along +x in its own frame, then turned into place.
  // side: [rotation, maps local (u, inward-depth) to world]
  const SIDES = [
    { ry: 0,            P: (u, d) => [u, IN - d] },      // z = +60 wall, inner face towards -z
    { ry: Math.PI,      P: (u, d) => [-u, -IN + d] },    // z = -60
    { ry: -Math.PI / 2, P: (u, d) => [IN - d, -u] },     // x = +60
    { ry: Math.PI / 2,  P: (u, d) => [-IN + d, u] },     // x = -60
  ];
  const LEN = 2 * OUT;
  for(const s of SIDES){
    const at = (u, d, y, geo, mat, shadow) => { const [x, z] = s.P(u, d); return add(geo, mat, x, y, z, s.ry, shadow); };
    // main body: plaster faces, stone top
    const bodyMats = [plaster, plaster, stone, stone,
      new THREE.MeshStandardMaterial({ map:repeat(rampartTex, LEN / 8, H / 8), color:WARM, roughness:0.95 }),
      new THREE.MeshStandardMaterial({ map:repeat(rampartTex, LEN / 8, H / 8), color:WARM, roughness:0.95 })];
    at(0, -TH / 2, H / 2, new THREE.BoxGeometry(LEN, H, TH), bodyMats);
    // ashlar plinth and zellige band
    at(0, 0.18, 1.2, new THREE.BoxGeometry(LEN, 2.4, 0.36),
       new THREE.MeshStandardMaterial({ map:repeat(ashlarTex, LEN / 4, 0.6), color:0xdcc6a0, roughness:0.9 }));
    at(0, 0.08, 2.75, new THREE.BoxGeometry(LEN, 0.7, 0.16),
       new THREE.MeshStandardMaterial({ map:repeat(zelligeTex, LEN / 0.7, 1), roughness:0.45 }), false);
    // (no arch niches on the wall: they read as windows)
    // cornice
    at(0, 0.3, H - 1.6, new THREE.BoxGeometry(LEN, 0.55, 0.6), stone);
    at(0, 0.14, H - 2.2, new THREE.BoxGeometry(LEN, 0.25, 0.3), tile, false);
    // pilasters with lanterns between them
    for(let u = -IN + 7.5; u <= IN - 7.5; u += 15){
      at(u, 0.35, H / 2, new THREE.BoxGeometry(1.8, H, 0.7), stone);
      const [x0, z0] = s.P(u - 0.9, 0.7), [x1, z1] = s.P(u + 0.9, 0);
      solid(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), H);
    }
    for(let u = -IN + 15; u <= IN - 15; u += 15) lantern(s, u);
    // stepped merlons along the inner edge
    for(let u = -OUT + 1.4; u <= OUT - 1.4; u += 2.8){
      at(u, -0.6, H + 0.55, new THREE.BoxGeometry(1.5, 1.1, 1.0), plaster);
      at(u, -0.6, H + 1.35, new THREE.BoxGeometry(0.9, 0.5, 0.8), plaster);
      at(u, -0.6, H + 1.85, new THREE.ConeGeometry(0.42, 0.55, 4).rotateY(Math.PI / 4), plaster);
    }
    // collision for the wall body
    const [ax, az] = s.P(-OUT, -TH), [bx, bz] = s.P(OUT, 0.36);
    solid(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), H + 2);
  }

  function lantern(s, u){
    const brass = new THREE.MeshStandardMaterial({ color:0x8a6a2e, metalness:0.8, roughness:0.35 });
    const glow  = new THREE.MeshStandardMaterial({ color:0xffc98a, emissive:0xffa64a, emissiveIntensity:1.6 });
    const [bx, bz] = s.P(u, 0.45), [lx, lz] = s.P(u, 0.95);
    add(new THREE.BoxGeometry(0.12, 0.12, 0.9), brass, bx, 7.4, bz, s.ry, false);
    add(new THREE.CylinderGeometry(0.28, 0.22, 0.6, 8), glow, lx, 6.9, lz, 0, false);
    add(new THREE.ConeGeometry(0.34, 0.4, 8), brass, lx, 7.4, lz, 0, false);
    add(new THREE.CylinderGeometry(0.22, 0.14, 0.18, 8), brass, lx, 6.52, lz, 0, false);
  }

  // corner towers, outside the play space (their inner corner meets the walls)
  for(const [sx, sz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){
    const c = IN + 5, x = sx * c, z = sz * c, TW = 10, TH2 = 27;
    add(new THREE.BoxGeometry(TW, TH2, TW), [plaster, plaster, stone, stone, plaster, plaster], x, TH2 / 2, z);
    add(new THREE.BoxGeometry(TW + 0.6, 3, TW + 0.6), stone, x, 1.5, z);
    add(new THREE.BoxGeometry(TW + 0.8, 0.6, TW + 0.8), stone, x, TH2 - 0.3, z);
    for(let k = 0; k < 4; k++) for(let j = -2; j <= 2; j++){
      const off = j * 2.2, e = TW / 2 - 0.5;
      const px = k < 2 ? x + off : x + (k === 2 ? e : -e), pz = k < 2 ? z + (k === 0 ? e : -e) : z + off;
      add(new THREE.BoxGeometry(1.2, 1.3, 1.2), plaster, px, TH2 + 0.65, pz);
      add(new THREE.ConeGeometry(0.5, 0.6, 4), plaster, px, TH2 + 1.6, pz, Math.PI / 4);
    }
    solid(x - TW / 2, z - TW / 2, x + TW / 2, z + TW / 2, TH2);
  }

  // ── beyond the wall ────────────────────────────────────────────────────
  const rnd = (() => { let s = 4242; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  const R = (a, b) => a + rnd() * (b - a);
  const outside = (x, z, m) => Math.max(Math.abs(x), Math.abs(z)) > OUT + m;
  const dummy = new THREE.Object3D();
  const inst = (geo, mat, list, shadow) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((f, i) => { f(dummy); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.castShadow = !!shadow; im.receiveShadow = true;
    im.userData.dynamic = true;               // keep out of the static merge
    scene.add(im); return im;
  };

  // desert floor out to the horizon, just under the courtyard floor
  {
    const dt = sandApproachTex.clone(); dt.repeat.set(70, 70); dt.needsUpdate = true;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(900, 900),
      new THREE.MeshStandardMaterial({ map:dt, color:0xe2c79a, roughness:1 }));
    g.rotation.x = -Math.PI / 2; g.position.y = -0.04; g.receiveShadow = true;
    g.matrixAutoUpdate = false; g.updateMatrix(); scene.add(g);
  }

  // the city: houses, domes, minarets
  const houses = [], domes = [], minarets = [], caps = [];
  const HOUSE_COLS = [0xefe6d2, 0xe6d6b6, 0xd8b07a, 0xcf9a62, 0xc4825a, 0xe9dcc0];
  const houseCols = [];
  for(let i = 0; i < 520; i++){
    const a = rnd() * Math.PI * 2, r = R(78, 210);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if(!outside(x, z, 10)) continue;
    const w = R(6, 14), d = R(6, 14), h = R(7, 16) + Math.max(0, 26 - r * 0.1) * rnd();
    houses.push(o => { o.position.set(x, h / 2, z); o.rotation.set(0, Math.round(rnd() * 4) * Math.PI / 2 + R(-.05, .05), 0); o.scale.set(w, h, d); });
    houseCols.push(HOUSE_COLS[(rnd() * HOUSE_COLS.length) | 0]);
    if(rnd() < 0.14){ const dr = Math.min(w, d) * 0.38; domes.push(o => { o.position.set(x, h, z); o.rotation.set(0, 0, 0); o.scale.set(dr, dr, dr); }); }
  }
  for(let i = 0; i < 9; i++){
    const a = i / 9 * Math.PI * 2 + R(-.2, .2), r = R(95, 170), x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = R(38, 52);
    minarets.push(o => { o.position.set(x, h / 2, z); o.rotation.set(0, R(0, 1), 0); o.scale.set(3.4, h, 3.4); });
    caps.push(o => { o.position.set(x, h + 2.2, z); o.rotation.set(0, 0, 0); o.scale.set(2.2, 4.4, 2.2); });
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  const hm = inst(box, new THREE.MeshStandardMaterial({ map:palaceStuccoTex, roughness:0.95 }), houses, false);
  houseCols.forEach((c, i) => hm.setColorAt(i, new THREE.Color(c)));
  if(hm.instanceColor) hm.instanceColor.needsUpdate = true;
  const sph = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  inst(sph, new THREE.MeshStandardMaterial({ color:0xeadfc8, roughness:0.7 }), domes, false);
  inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map:ashlarTex, color:0xf0dcb8, roughness:0.9 }), minarets, false);
  inst(new THREE.ConeGeometry(1, 1, 8), new THREE.MeshStandardMaterial({ color:0x2f7f74, roughness:0.5, metalness:0.2 }), caps, false);
  // one great domed mosque on the skyline behind CT
  {
    const mx = 120, mz = -120;
    add(new THREE.BoxGeometry(34, 18, 34), new THREE.MeshStandardMaterial({ map:palaceStuccoTex, color:0xefe2c6 }), mx, 9, mz, Math.PI / 4, false);
    add(new THREE.SphereGeometry(13, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color:0x2f8a7c, roughness:0.4, metalness:0.25 }), mx, 18, mz, 0, false);
    add(new THREE.CylinderGeometry(0.4, 0.4, 6, 6), new THREE.MeshStandardMaterial({ color:0xd8b04a, metalness:0.8, roughness:0.3 }), mx, 34, mz, 0, false);
  }

  // ── DATE PALMS ringing the wall, crowns rising over it ─────────────────
  // Curved, scarred trunks; crowns of arching feathered fronds (an alpha
  // texture of leaflets on a bent, folded strip) with a few dead fronds
  // hanging below and clusters of dates. All instanced.
  const palmTrunkTex = (() => {
    const W = 128, Hh = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
    const c = cv.getContext('2d');
    c.fillStyle = '#6e5639'; c.fillRect(0, 0, W, Hh);
    for(let y = 0; y < Hh; y += 16){                  // leaf-base scars, offset rows
      const off = (y / 16 % 2) * 16;
      for(let x = -32 + off; x < W + 32; x += 32){
        c.fillStyle = `rgb(${120 + Math.random() * 30 | 0},${96 + Math.random() * 24 | 0},${66 + Math.random() * 18 | 0})`;
        c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x + 15, y + 9); c.lineTo(x + 30, y + 2); c.lineTo(x + 15, y + 15); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(40,28,16,0.55)'; c.lineWidth = 2; c.stroke();
      }
    }
    for(let i = 0; i < 400; i++){ c.fillStyle = `rgba(30,20,10,${Math.random() * 0.15})`; c.fillRect(Math.random() * W, Math.random() * Hh, 2, 6); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 9); t.anisotropy = 4; return t;
  })();
  const frondTex = dry => {
    const W = 512, Hh = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
    const c = cv.getContext('2d'); c.clearRect(0, 0, W, Hh);
    const mid = Hh / 2;
    for(let x = 14; x < W - 6; x += 7){               // leaflets, angled toward the tip
      const t = x / W, len = (Hh * 0.47) * Math.sin(Math.PI * Math.min(1, t * 1.08)) * (0.85 + Math.random() * 0.25);
      for(const s of [-1, 1]){
        const g = dry ? [150 + Math.random() * 40, 112 + Math.random() * 30, 58 + Math.random() * 20]
                      : [62 + Math.random() * 40, 104 + Math.random() * 38, 40 + Math.random() * 24];
        c.strokeStyle = `rgb(${g[0] | 0},${g[1] | 0},${g[2] | 0})`; c.lineWidth = 3.2;
        c.beginPath(); c.moveTo(x, mid); c.quadraticCurveTo(x + len * 0.25, mid + s * len * 0.6, x + len * 0.55, mid + s * len); c.stroke();
      }
    }
    c.strokeStyle = dry ? '#8a6a3c' : '#6f7a3a'; c.lineWidth = 5;   // midrib
    c.beginPath(); c.moveTo(0, mid); c.lineTo(W - 4, mid); c.stroke();
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
  };
  // frond strip: length along +x (0..1), arched down, folded into a shallow V
  const frondGeo = (() => {
    const g = new THREE.PlaneGeometry(1, 0.34, 16, 2); g.translate(0.5, 0, 0); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for(let i = 0; i < p.count; i++){
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, -0.62 * x * x + Math.abs(z) * 0.35);
    }
    g.computeVertexNormals(); return g;
  })();
  const trunkGeo = (() => {
    const g = new THREE.CylinderGeometry(0.36, 0.55, 1, 10, 8); g.translate(0, 0.5, 0);
    const p = g.attributes.position;
    for(let i = 0; i < p.count; i++){
      const y = p.getY(i);
      p.setX(i, p.getX(i) * (y < 0.06 ? 1.35 : 1) + 1.6 * y * y);   // flared foot, gentle curve
    }
    g.computeVertexNormals(); return g;
  })();
  const trunks = [], greens = [], drys = [], dates = [], boots = [];
  for(let i = 0; i < 95; i++){
    const a = rnd() * Math.PI * 2, r = R(68, 100);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if(!outside(x, z, 2.5)) continue;
    const h = R(20, 31), th = R(0, Math.PI * 2), thick = R(0.9, 1.15);
    trunks.push(o => { o.position.set(x, 0, z); o.rotation.set(0, th, 0); o.scale.set(thick, h, thick); });
    const tx = x + 1.6 * thick * Math.cos(th), tz = z - 1.6 * thick * Math.sin(th), ty = h;   // crown position
    boots.push(o => { o.position.set(tx, ty - 0.3, tz); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); });
    const n = 15 + (rnd() * 5 | 0), rot0 = R(0, 6.28);
    for(let k = 0; k < n; k++){
      const az = rot0 + k * 2.399 + R(-0.15, 0.15);       // golden-angle spread
      const pitch = R(-0.35, 0.75) * (1 - (k / n) * 0.6);  // inner fronds stand up, outer arch over
      const L = R(5.2, 7.2);
      greens.push(o => { o.position.set(tx, ty + R(-0.2, 0.3), tz); o.rotation.set(R(-0.25, 0.25), az, pitch, 'YZX'); o.scale.set(L, L, L * R(0.9, 1.2)); });
    }
    for(let k = 0; k < 3 + (rnd() * 3 | 0); k++){        // dead fronds hanging
      const az = R(0, 6.28), L = R(4.5, 6);
      drys.push(o => { o.position.set(tx, ty - 0.6, tz); o.rotation.set(R(-0.3, 0.3), az, R(-1.35, -0.95), 'YZX'); o.scale.set(L, L, L); });
    }
    for(let k = 0; k < (rnd() * 4 | 0); k++){              // date clusters
      const az = R(0, 6.28);
      dates.push(o => { o.position.set(tx + Math.cos(az) * 0.9, ty - 1.4, tz + Math.sin(az) * 0.9); o.rotation.set(0, az, R(-0.3, 0.3)); o.scale.set(0.7, 1.3, 0.7); });
    }
  }
  inst(trunkGeo, new THREE.MeshStandardMaterial({ map:palmTrunkTex, color:0xd8c4a4, roughness:1 }), trunks, true);
  inst(new THREE.ConeGeometry(0.8, 1.4, 9).rotateX(Math.PI), new THREE.MeshStandardMaterial({ map:palmTrunkTex, color:0x9a8160, roughness:1 }), boots, false);
  const frondMat = dry => {
    const map = frondTex(dry);
    const m = new THREE.MeshStandardMaterial({ map, alphaTest:0.45, side:THREE.DoubleSide, roughness:0.8 });
    return m;
  };
  const shadowDepth = map => new THREE.MeshDepthMaterial({ map, alphaTest:0.45, depthPacking:THREE.RGBADepthPacking, side:THREE.DoubleSide });
  const gm = frondMat(false), dm = frondMat(true);
  const gi = inst(frondGeo, gm, greens, true); gi.customDepthMaterial = shadowDepth(gm.map);
  const di = inst(frondGeo, dm, drys, true);   di.customDepthMaterial = shadowDepth(dm.map);
  inst(new THREE.SphereGeometry(0.75, 9, 7), new THREE.MeshStandardMaterial({ color:0xb4652a, roughness:0.6 }), dates, false);

  // (sky: the palace keeps its original plain sky colour and fog)
  console.log('palace: ramparts and city —', houses.length, 'houses,', trunks.length, 'palms');
}

let _mapSpawns = null;
// declared here, before any map builds, because maps push into them
const interiorLights = [];
const _windowDecals  = [];
const trafficLights  = [];
const Y_GROUND = 0.02;
const Y_ROOM   = 0.06;
const _pal0 = { sc: scene.children.length, ob: obstacles.length, pl: platforms.length };
if(MAP_ID === 'alcazar'){

// ═══════════════════════════════════════════════════════════════════════════
//  4.  ATMOSPHERE
// ═══════════════════════════════════════════════════════════════════════════
scene.background = new THREE.Color(0xd3ddea);
scene.fog = new THREE.FogExp2(0xd8caa8, 0.0052);
sun.position.set(70, 130, -55);
sun.color.setHex(0xfff4d8);
sun.intensity = 2.15;
Object.assign(sun.shadow.camera, { near:1, far:340, left:-110, right:110, top:110, bottom:-110 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.needsUpdate = true;

// ═══════════════════════════════════════════════════════════════════════════
//  5.  GROUND
//  Patches are edge to edge, never stacked: two coplanar floors make the depth
//  buffer flicker between them.
// ═══════════════════════════════════════════════════════════════════════════

{
  const base = new THREE.Mesh(new THREE.PlaneGeometry(190, 190),
    new THREE.MeshStandardMaterial({
      map:(()=>{ const t=sandApproachTex.clone(); t.repeat.set(32,32); t.needsUpdate=true; return t; })(),
      roughness:0.97 }));
  base.rotation.x = -Math.PI/2; base.position.y = 0; base.receiveShadow = true;
  base.matrixAutoUpdate = false; base.updateMatrix(); scene.add(base);
}
ground(-EDGE, 22, -22, EDGE, sandCourtTex, 5, Y_GROUND);   // T spawn, northwest
ground( 22, -EDGE, EDGE, -22, sandCourtTex, 5, Y_GROUND);   // CT spawn, southeast
ground(DIV_W, -46, DIV_E, 46, sandApproachTex, 7, Y_GROUND);     // mid
for(const [lx0, lx1] of [[A_X0, A_X1], [B_X0, B_X1]]){
  ground(lx0, -46, lx1, -18, sandApproachTex, 9, Y_GROUND);      // CT-side approach
  ground(lx0,  18, lx1,  46, sandApproachTex, 9, Y_GROUND);      // T-side approach
  ground(lx0, -18, lx1,  18, sandCourtTex,    9, Y_GROUND);      // the court itself
}

// (6. the curtain wall is built after the scale pass: buildPalaceRamparts)

}   // end MAP_ID === 'alcazar' (atmosphere, ground, curtain wall)

// ═══════════════════════════════════════════════════════════════════════════
//  7.  (no spawn gate walls)
//  The old map had walls across z=+/-46 with gates in them. With the spawns
//  moved to opposite corners those walls run straight through both courts, so
//  they are gone. The buildings themselves now shape every route.
// ═══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
//  GLB STRUCTURES
//  Collision is authored here, in code, as a box. The model is then streamed in
//  and scaled to fill that box. The ordering matters: obstacles pushed during
//  map build get bucketed by _buildGrid(), which runs once at startup, so a
//  collision box added later inside a load callback would be invisible to every
//  query. It also means the map plays correctly from the first frame whether or
//  not the download has finished, and a missing file gives a warning plus a
//  solid invisible block rather than a broken level.
// ══════════════════════════════════════════════════════════════════════════

const STRUCTURE_FILES = {
  palaceExterior: 'Meshy_AI_Moroccan_palace_exter_0808145750_texture.glb',
  facadeBlock:    'Meshy_AI_Moroccan_palace_facad_0808145803_texture.glb',
  cornerBlock:    'Meshy_AI_Corner_block_where_tw_0808145624_texture.glb',
  watchtower:     'Meshy_AI_Moroccan_palace_corne_0808145701_texture.glb',
  bridge:         'Meshy_AI_A_stone_bridge_A_lon_0808145825_texture.glb',
  marketStall:    'Meshy_AI_A_market_stall_A_low_0808145834_texture.glb',
  palCrate:       'pal_crate.glb',
  // grandPalace and gateway were deleted. Their 10 placements are reassigned
  // below rather than left pointing at missing files.
};

// Native proportions as exported, normalised to the longest axis. Useful when
// picking a target box: match these or the model letterboxes inside it, since
// uniform scaling lets the worst-fitting axis win.
// Native proportions, normalised to the longest axis, used to choose which
// model best suits a footprint. Measured from the previous exports — if the
// new ones differ, the fit is a little off, but collision is corrected from the
// real geometry once each model loads, so nothing breaks.
const STRUCTURE_SHAPE = {
  palaceExterior: [1.00, 0.57, 0.89],
  facadeBlock:    [1.00, 0.64, 0.58],
  cornerBlock:    [1.00, 0.68, 1.08],   // re-measured from the current export
  watchtower:     [0.46, 1.00, 0.46],
  bridge:         [1.00, 0.56, 0.43],
  marketStall:    [1.00, 0.93, 0.97],
  palCrate:       [1.00, 0.92, 0.99],
};

// Models stream in over several seconds, and each correction invalidates the
// collision and platform lookups. Rebuilding on every single one would be
// wasteful, so flag it and rebuild on the next frame after things go quiet.
let _collisionDirty = false;
let _rebuildTimer = null;
function _scheduleCollisionRebuild(){
  if(_rebuildTimer) clearTimeout(_rebuildTimer);
  _rebuildTimer = setTimeout(() => {
    _rebuildTimer = null;
    if(!_collisionDirty) return;
    _collisionDirty = false;
    if(typeof _buildGrid === 'function') _buildGrid();
    _pgridBuilt = false;                    // groundHeightAt rebuilds on demand
    // Re-arm the shadow bake. sun.shadow.autoUpdate is false and the one-shot
    // needsUpdate fires at boot — before any of this geometry has downloaded —
    // so without this line the 19 buildings, the only things in the scene with
    // real silhouettes, cast no shadow at all. One bake, not per frame.
    if(typeof sun !== 'undefined' && sun.shadow) sun.shadow.needsUpdate = true;
    console.log('collision rebuilt from the loaded geometry');
  }, 400);
}

const _structureLoader = new GLTFLoader();
const _structureCache = {};        // raw models, one download per file
const _structurePending = {};      // placements waiting on a download

// Fit a model inside w x h x d: centre it, sit its base on y=0. Measured from
// the real exports, every one is centred on the origin with its base around
// y = -0.6, so each has to be dropped rather than straddling the ground.
function fitStructure(root, w, h, d, opts){
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(), ctr = new THREE.Vector3();
  box.getSize(size); box.getCenter(ctr);

  // SUBTRACT, do not assign: ctr is world space and already includes the
  // model's own offset, so assigning -ctr would leave it displaced.
  root.position.sub(ctr);

  const inner = new THREE.Group();
  inner.add(root);
  const s = Math.min(w / Math.max(size.x, 1e-6),
                     h / Math.max(size.y, 1e-6),
                     d / Math.max(size.z, 1e-6));
  if(opts.stretch) inner.scale.set(w/size.x, h/size.y, d/size.z);
  else             inner.scale.setScalar(s);

  const scaledH = size.y * (opts.stretch ? h/size.y : s);
  inner.position.y = scaledH / 2;

  const holder = new THREE.Group();
  holder.add(inner);
  holder.rotation.y = (opts.yaw || 0) * Math.PI / 180;
  holder.traverse(o => {
    if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; o.frustumCulled = true; }
  });
  return holder;
}

// Work out where a placed model is actually SOLID at body height, and return
// that as a handful of boxes rather than one that swallows the whole building.
//
// Only geometry between the knee and just over head height can block a player,
// so anything above or below — a roof, an arch springing overhead, a step — is
// ignored. Columns come out as separate boxes with walkable gaps between them,
// which is the entire point: you can walk down a colonnade you can see through.
// Work out where a placed model actually blocks a player, and where it is
// merely raised ground.
//
// The naive version — "anything at body height is a wall" — gets a colonnade
// wrong, because the floor SLAB the columns stand on also sits at body height.
// The whole entrance ends up solid and you cannot get in, even though you are
// looking straight down a walkable hall.
//
// So sample each cell in height layers and read the column of geometry:
//   solid from the ground up, then clear above  ->  a FLOOR, standable
//   solid at head height                        ->  a WALL, blocking
//   nothing                                     ->  open
const _FOOT_CELL  = 1.2;        // sampling grid, about half a player wide
const _FOOT_TOP   = 2.4;        // nothing above this can block you
const _FOOT_LAYER = 0.2;        // height resolution
const _FOOT_HEAD  = 2.0;        // geometry up here means a wall, not a step

function solidFootprint(model, bounds){
  const w = bounds.max.x - bounds.min.x, d = bounds.max.z - bounds.min.z;
  const nx = Math.max(1, Math.min(64, Math.ceil(w / _FOOT_CELL)));
  const nz = Math.max(1, Math.min(64, Math.ceil(d / _FOOT_CELL)));
  if(nx * nz > 3000) return null;
  const nL = Math.ceil(_FOOT_TOP / _FOOT_LAYER);
  const cw = w / nx, cd = d / nz;
  const base = bounds.min.y;

  // one bitmask of occupied height layers per cell
  const col = new Uint32Array(nx * nz);
  const a3 = new THREE.Vector3(), b3 = new THREE.Vector3(), c3 = new THREE.Vector3();
  let any = false;

  model.traverse(o => {
    if(!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    const n = idx ? idx.count : pos.count;
    for(let i = 0; i < n; i += 3){
      const i0 = idx ? idx.getX(i)   : i;
      const i1 = idx ? idx.getX(i+1) : i+1;
      const i2 = idx ? idx.getX(i+2) : i+2;
      a3.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld);
      b3.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld);
      c3.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld);
      const yLo = Math.min(a3.y, b3.y, c3.y) - base;
      const yHi = Math.max(a3.y, b3.y, c3.y) - base;
      if(yHi < 0 || yLo > _FOOT_TOP) continue;
      any = true;
      const l0 = Math.max(0, Math.floor(yLo / _FOOT_LAYER));
      const l1 = Math.min(nL - 1, Math.floor(yHi / _FOOT_LAYER));
      let mask = 0;
      for(let l = l0; l <= l1; l++) mask |= (1 << l);
      const x0 = Math.min(a3.x, b3.x, c3.x), x1 = Math.max(a3.x, b3.x, c3.x);
      const z0 = Math.min(a3.z, b3.z, c3.z), z1 = Math.max(a3.z, b3.z, c3.z);
      const ci0 = Math.max(0, Math.floor((x0 - bounds.min.x) / cw));
      const ci1 = Math.min(nx-1, Math.floor((x1 - bounds.min.x) / cw));
      const cj0 = Math.max(0, Math.floor((z0 - bounds.min.z) / cd));
      const cj1 = Math.min(nz-1, Math.floor((z1 - bounds.min.z) / cd));
      for(let ci = ci0; ci <= ci1; ci++)
        for(let cj = cj0; cj <= cj1; cj++) col[ci*nz + cj] |= mask;
    }
  });
  if(!any) return null;

  const headL = Math.floor(_FOOT_HEAD / _FOOT_LAYER);
  const wall  = new Uint8Array(nx * nz);
  const floorTop = new Float32Array(nx * nz);

  for(let k = 0; k < nx*nz; k++){
    const m = col[k];
    if(!m) continue;
    // Models are SHELLS — a box has faces but nothing between them — so
    // "solid run up from the ground" only ever finds the bottom face, and a
    // plinth's top surface then looks like an overhead obstruction. Reading
    // the HIGHEST surface instead works on shells and solids alike:
    //   reaches head height -> a wall
    //   stops below it      -> a floor at that height
    let topL = -1;
    for(let l = nL - 1; l >= 0; l--) if(m & (1 << l)){ topL = l; break; }
    if(topL < 0) continue;
    if(topL >= headL) wall[k] = 1;
    else floorTop[k] = (topL + 1) * _FOOT_LAYER;
  }

  // merge wall cells along z so a wall is one box, not twenty
  const boxes = [], plats = [];
  const top = bounds.max.y;
  for(let ci = 0; ci < nx; ci++){
    let start = -1;
    for(let cj = 0; cj <= nz; cj++){
      const on = cj < nz && wall[ci*nz + cj];
      if(on && start < 0) start = cj;
      if(!on && start >= 0){
        boxes.push(new THREE.Box3(
          new THREE.Vector3(bounds.min.x + ci*cw,     base, bounds.min.z + start*cd),
          new THREE.Vector3(bounds.min.x + (ci+1)*cw, top,  bounds.min.z + cj*cd)));
        start = -1;
      }
    }
  }
  // The largest rectangle of solid cells, used as an OCCLUDER box.
  //
  // A bounding box is the wrong shape to occlude with: it wraps all the empty
  // space around an irregular building, so a target seen through a real gap
  // gets reported as hidden. This finds the biggest block that is genuinely
  // solid, which can only ever under-occlude — the safe direction.
  //
  // Standard maximal-rectangle-in-a-histogram sweep.
  let core = null;
  {
    const heights = new Int32Array(nz);
    let best = 0, bi0 = 0, bi1 = -1, bj0 = 0, bj1 = -1;
    for(let ci = 0; ci < nx; ci++){
      for(let cj = 0; cj < nz; cj++) heights[cj] = wall[ci*nz + cj] ? heights[cj] + 1 : 0;
      const stack = [];
      for(let cj = 0; cj <= nz; cj++){
        const h = cj < nz ? heights[cj] : 0;
        let start = cj;
        while(stack.length && stack[stack.length-1][1] >= h){
          const [s0, sh] = stack.pop();
          const area = sh * (cj - s0);
          if(area > best){ best = area; bi0 = ci - sh + 1; bi1 = ci; bj0 = s0; bj1 = cj - 1; }
          start = s0;
        }
        stack.push([start, h]);
      }
    }
    if(best >= 4)                                  // ignore slivers
      core = new THREE.Box3(
        new THREE.Vector3(bounds.min.x + bi0*cw, base, bounds.min.z + bj0*cd),
        new THREE.Vector3(bounds.min.x + (bi1+1)*cw, bounds.max.y, bounds.min.z + (bj1+1)*cd));
  }

  // raised floors become standable ground rather than obstacles
  for(let ci = 0; ci < nx; ci++)
    for(let cj = 0; cj < nz; cj++){
      const k = ci*nz + cj;
      if(wall[k] || floorTop[k] <= 0.05) continue;
      plats.push({ x0: bounds.min.x + ci*cw,     x1: bounds.min.x + (ci+1)*cw,
                   z0: bounds.min.z + cj*cd,     z1: bounds.min.z + (cj+1)*cd,
                   top: base + floorTop[k] });
    }
  return { boxes, plats, core };
}

// ── OCCLUSION CULLING ───────────────────────────────────────────────────────
// Three.js only frustum-culls: if a building's bounding box touches the view
// cone it gets drawn, even with a solid wall in front of it. On a street grid
// that is most of the map — you can see three or four buildings from any
// street, but every one of the other thirty is still submitted and shaded.
//
// This is the same idea Source uses precomputed visibility for, done the cheap
// way: fire a few rays from the camera at each building, and if every one is
// stopped by a DIFFERENT building first, skip it this frame.
//
// The work is spread over frames — checking all of them every frame would cost
// more than it saves.
const _structures = [];
// Occlusion culling, with a fade so it does not pop.
//
// Every earlier version snapped, and no amount of better testing fixes that:
// visibility is binary, so the instant a sliver of a building clears an edge it
// appears. Easing the change over a fifth of a second is what actually removes
// it. Set CULL_ENABLED false to draw everything and rely on the poly budget.
const CULL_ENABLED = true;
const FADE_SECONDS = 0.22;         // how long a building takes to fade in or out
// every corner plus the centre — see the comment in the loop below

const _cA = new THREE.Vector3(), _cB = new THREE.Vector3(), _cD = new THREE.Vector3();

// segment-vs-box, the same slab test the bullets use
// Unrolled over x/y/z rather than looping `['x','y','z']`. That literal
// allocated a fresh array on EVERY call, and the culling pass calls this about
// 3,200 times a frame (19 structures squared, nine sample points) — pure GC
// churn, plus three string-keyed property lookups per axis instead of .x/.y/.z.
function _segHitsBox(from, to, b){
  _cD.subVectors(to, from);
  let tmin = 0, tmax = 1;

  let d = _cD.x;
  if(Math.abs(d) < 1e-9){ if(from.x < b.min.x || from.x > b.max.x) return false; }
  else {
    const inv = 1/d;
    let t1 = (b.min.x - from.x) * inv, t2 = (b.max.x - from.x) * inv;
    if(t1 > t2){ const t = t1; t1 = t2; t2 = t; }
    if(t1 > tmin) tmin = t1;
    if(t2 < tmax) tmax = t2;
    if(tmin > tmax) return false;
  }

  d = _cD.y;
  if(Math.abs(d) < 1e-9){ if(from.y < b.min.y || from.y > b.max.y) return false; }
  else {
    const inv = 1/d;
    let t1 = (b.min.y - from.y) * inv, t2 = (b.max.y - from.y) * inv;
    if(t1 > t2){ const t = t1; t1 = t2; t2 = t; }
    if(t1 > tmin) tmin = t1;
    if(t2 < tmax) tmax = t2;
    if(tmin > tmax) return false;
  }

  d = _cD.z;
  if(Math.abs(d) < 1e-9){ if(from.z < b.min.z || from.z > b.max.z) return false; }
  else {
    const inv = 1/d;
    let t1 = (b.min.z - from.z) * inv, t2 = (b.max.z - from.z) * inv;
    if(t1 > t2){ const t = t1; t1 = t2; t2 = t; }
    if(t1 > tmin) tmin = t1;
    if(t2 < tmax) tmax = t2;
    if(tmin > tmax) return false;
  }

  return true;
}

function updateStructureCulling(cam){
  if(!_structures.length) return;
  cam.getWorldPosition(_cA);

  // Every structure, every frame — no round-robin.
  //
  // Spreading the work over frames was the flicker. With 12 of 37 tested per
  // frame, a building took three frames to be re-examined, so walking forward
  // gave 100 ms of lag on every appear and 300 ms on every hide. That reads
  // exactly as blinking. The whole pass is a few thousand slab tests against
  // 0.09 ms of logic time, so there was never a reason to ration it.
  for(const rec of _structures){
    const b = rec.box;
    if(!CULL_ENABLED){ rec.mesh.visible = true; continue; }

    // how far away the target is, so only NEARER buildings are considered as
    // occluders — one behind it cannot hide it, and skipping those halves the
    // work
    const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
    const targetD2 = (cx - _cA.x)*(cx - _cA.x) + (cz - _cA.z)*(cz - _cA.z);

    const mid = (b.min.y + b.max.y) / 2;
    const pts = [
      [(b.min.x+b.max.x)/2, mid, (b.min.z+b.max.z)/2],
      [b.min.x,b.min.y,b.min.z], [b.max.x,b.min.y,b.min.z],
      [b.min.x,b.min.y,b.max.z], [b.max.x,b.min.y,b.max.z],
      [b.min.x,b.max.y,b.min.z], [b.max.x,b.max.y,b.min.z],
      [b.min.x,b.max.y,b.max.z], [b.max.x,b.max.y,b.max.z],
    ];

    let hidden = false;
    for(const other of _structures){
      if(other === rec) continue;
      // The tight inscribed box if we have one, otherwise fall back to the
      // bounding box. The tight box only ever occludes less, never more.
      const ob = other.core || other.box;
      if(ob.containsPoint(_cA)) continue;              // standing inside it
      const ox = (ob.min.x + ob.max.x) / 2, oz = (ob.min.z + ob.max.z) / 2;
      if((ox - _cA.x)*(ox - _cA.x) + (oz - _cA.z)*(oz - _cA.z) > targetD2) continue;
      // one occluder has to cover every sample, or you can see between two of them
      let coversAll = true;
      for(let i = 0; i < pts.length; i++){
        _cB.set(pts[i][0], pts[i][1], pts[i][2]);
        if(!_segHitsBox(_cA, _cB, ob)){ coversAll = false; break; }
      }
      if(coversAll){ hidden = true; break; }
    }

    // Two consecutive identical results before the state changes. Symmetric
    // this time: a building sitting exactly on the boundary would otherwise
    // toggle every frame as the camera jitters.
    if(hidden === rec.wantHidden) rec.agree = (rec.agree || 0) + 1;
    else { rec.wantHidden = hidden; rec.agree = 1; }
    if(rec.agree >= 2) rec.target = rec.wantHidden ? 0 : 1;
  }

  // Fade toward the target rather than snapping.
  //
  // This is what actually removes the pop. Visibility is binary — the instant a
  // sliver of a building clears an edge it becomes visible — so no amount of
  // better testing stops the snap. Easing over a fifth of a second does, and on
  // this GPU shading is nearly free (1.78x the pixels cost 1% of the frame), so
  // the transparency is close to free too.
  const step = Math.min(1, (_frameDt || 0.016) / FADE_SECONDS);
  for(const rec of _structures){
    if(rec.opacity === rec.target){
      // fully faded out: stop drawing it at all, which is where the frames are
      if(rec.opacity === 0 && rec.mesh.visible) rec.mesh.visible = false;
      continue;
    }
    rec.opacity += Math.sign(rec.target - rec.opacity) * step;
    if(Math.abs(rec.target - rec.opacity) < step) rec.opacity = rec.target;
    if(rec.opacity > 0 && !rec.mesh.visible) rec.mesh.visible = true;
    // Only pay for transparency while the fade is actually mid-flight. At rest
    // the building is a plain opaque draw again.
    const fading = rec.opacity < 1;
    for(const m of rec.mats){
      m.opacity = rec.opacity;
      if(m.transparent !== fading) m.transparent = fading;
    }
  }
}
window.updateStructureCulling = updateStructureCulling;

// Place a structure. Collision happens now; the model arrives when it arrives.
//   opts: { yaw, stretch, noCollide, boxes }
//   boxes lets you author collision by hand for anything with a passage
//   through it — offsets are relative to x, z, and the 6th value is a base y.
function glbStructure(key, x, z, w, h, d, opts){
  const o = opts || {};

  // Uniform scaling fits the model INSIDE the box, so it ends up smaller than
  // the footprint on two axes. The collision has to shrink with it, or players
  // walk into thin air where the building used to be. STRUCTURE_SHAPE lets us
  // work out the drawn size here, before the model has even downloaded.
  let cw = w, ch = h, cd = d;
  if(!o.stretch && STRUCTURE_SHAPE[key]){
    const n = STRUCTURE_SHAPE[key];
    const yaw = ((o.yaw || 0) % 180 + 180) % 180;
    const nx = yaw === 90 ? n[2] : n[0];
    const nz = yaw === 90 ? n[0] : n[2];
    const sc = Math.min(w/nx, h/n[1], d/nz);
    cw = nx * sc; ch = n[1] * sc; cd = nz * sc;
  }

  // Remember what we authored so it can be CORRECTED once the real geometry
  // arrives. The guessed box is only as good as STRUCTURE_SHAPE, and a
  // building whose true bounds differ gives you either walls you walk through
  // or invisible ones you cannot see.
  let ownBox = null, ownPlat = null;
  if(!o.noCollide){
    if(o.boxes){
      for(const [ox, oz, bw, bh, bd, by] of o.boxes)
        obstacles.push(new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(x + ox, (by || 0) + bh/2, z + oz),
          new THREE.Vector3(bw, bh, bd)));
    } else {
      ownBox = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(x, ch/2, z), new THREE.Vector3(cw, ch, cd));
      obstacles.push(ownBox);
      ownPlat = { x0:x-cw/2, x1:x+cw/2, z0:z-cd/2, z1:z+cd/2, top:ch };
      platforms.push(ownPlat);
    }
  }

  const file = STRUCTURE_FILES[key];
  if(!file){ console.warn('unknown structure:', key); return; }

  const place = raw => {
    // Fit PER PLACEMENT. Caching the fitted model meant every later placement
    // of the same key inherited the first one's scale — an 18x16 block came out
    // sized for a 32x44 one. That is what put walls where the street should be
    // and left gaps where a wall should be.
    const m = fitStructure(raw.clone(true), w, h, d, o);
    m.position.set(x, o.y || 0, z);        // o.y lifts a model, e.g. a crate on a crate
    scene.add(m);
    m.updateMatrixWorld(true);
    // Clone materials per placement. They come from one cached model, so
    // without this every copy of a building would fade together.
    const mats = [];
    m.traverse(o => {
      if(!o.isMesh || !o.material) return;
      const src = Array.isArray(o.material) ? o.material : [o.material];
      const cl = src.map(mm => {
        const c = mm.clone();
        // Opaque until it actually starts fading. `transparent = true` is NOT
        // free: it moves the mesh into three.js's transparent list, which is
        // depth-sorted back-to-front every single frame, and it gives up the
        // early-z rejection an opaque draw gets. With 19 buildings of many
        // primitives each, that sort was running over hundreds of objects per
        // frame for a fade that is idle almost all of the time. The flag is
        // now toggled by the fade loop, and toggling it needs no shader
        // recompile — three.js reads it at render time to pick the list.
        c.transparent = false;
        c.opacity = 1;
        c.depthWrite = true;
        // Meshy exports everything double-sided, which disables backface
        // culling and doubles the fragments shaded on every wall in the map.
        // You cannot see the inside of a building you cannot enter.
        c.side = THREE.FrontSide;
        // optional colour correction for a model whose texture came out off-palette
        if(o.tint && c.color) c.color.multiply(new THREE.Color(o.tint));
        return c;
      });
      o.material = Array.isArray(o.material) ? cl : cl[0];
      for(const c of cl) mats.push(c);
    });
    const bounds = new THREE.Box3().setFromObject(m);
    bounds.min.y = Math.min(bounds.min.y, 0);
    const rec = { mesh: m, mats, opacity: 1, target: 1, box: bounds };
    // Placements with hand-authored collision (noCollide) never reach the
    // collision rebuild below, which is what re-arms the one-shot shadow bake.
    // Without this, models that stream in after boot cast no shadow at all.
    if(o.noCollide && typeof sun !== 'undefined' && sun.shadow){
      clearTimeout(glbStructure._shadowT);
      glbStructure._shadowT = setTimeout(() => { sun.shadow.needsUpdate = true; }, 400);
    }
    _structures.push(rec);

    // Correct the collision to the geometry actually on screen, and take a
    // tight occluder box while we are walking the mesh anyway. This was lost
    // when the LOD code came out — without it the authored guess stands, which
    // is where walk-through walls and invisible blockers came from.
    if(ownBox && isFinite(bounds.min.x) && bounds.max.x > bounds.min.x){
      const cells = solidFootprint(m, bounds);
      if(cells && cells.core) rec.core = cells.core;
      if(cells && (cells.boxes.length || cells.plats.length)){
        ownBox.makeEmpty();                        // retire the guessed box
        for(const bx of cells.boxes) obstacles.push(bx);
        for(const pl of cells.plats) platforms.push(pl);
      } else {
        ownBox.copy(bounds);
      }
      if(ownPlat){
        ownPlat.x0 = bounds.min.x; ownPlat.x1 = bounds.max.x;
        ownPlat.z0 = bounds.min.z; ownPlat.z1 = bounds.max.z;
        ownPlat.top = bounds.max.y;
      }
      _collisionDirty = true;
      _scheduleCollisionRebuild();
    }
  };
  if(_structureCache[key]){ place(_structureCache[key]); return; }

  // queue placements that arrive while the file is still downloading
  if(_structurePending[key]){ _structurePending[key].push(place); return; }
  _structurePending[key] = [place];

  _structureLoader.load(file, gltf => {
    _structureCache[key] = gltf.scene;           // the RAW model, unscaled
    for(const fn of _structurePending[key]) fn(gltf.scene);
    _structurePending[key] = null;
  }, undefined, err => {
    console.warn('structure failed to load:', key, file, err && err.message,
                 '\n  the collision box is still there, so the map plays correctly');
  });
}

// ── range-safe wrappers ─────────────────────────────────────────────────────
// platform / stairs / sandbags all silently draw NOTHING when handed from > to,
// and the generated blocks below produce reversed ranges freely. Sorting once
// here has already saved this map a colonnade, a set of ledges and a run of
// sandbags.
function platformS(ax0, az0, ax1, az1, top, tex){
  platform(Math.min(ax0,ax1), Math.min(az0,az1), Math.max(ax0,ax1), Math.max(az0,az1), top, tex);
}
function stairsZS(ax0, ax1, zBase, zTop, top, tex){
  stairsZ(Math.min(ax0,ax1), Math.max(ax0,ax1), zBase, zTop, top, tex);
}
function bagsX(z, a, b){ sandbagsX(z, Math.min(a,b), Math.max(a,b)); }
function bagsZ(x, a, b){ sandbagsZ(x, Math.min(a,b), Math.max(a,b)); }

if(MAP_ID === 'alcazar'){

// ═══════════════════════════════════════════════════════════════════════════
//  8.  THE TOWN
//
//  Buildings are the map; the streets are what is left between them. Only the
//  curtain wall is still procedural.
//
//  The spawns sit on a DIAGONAL — T northwest, CT southeast — so this map is
//  symmetric under a 180 degree ROTATION about the centre, not mirrored across
//  z=0 like the old one. Every block is declared once and its partner is
//  generated by (x,z) -> (-x,-z), which makes the two halves identical by
//  construction rather than by careful typing.
//
//  That diagonal gives the four corners a neat property: T spawn, Great Court,
//  CT spawn, Bazaar Court run clockwise, so each team starts near one court and far from
//  the other, the same way round for both.
//
//         NW  T SPAWN       GREAT COURT  NE
//                    [ the town ]
//         SW  BAZAAR COURT     CT SPAWN  SE
// ═══════════════════════════════════════════════════════════════════════════

// The town: 17 buildings.
//
// Drawn in the layout editor, then repaired. The best layout of everything
// tried — 51u longest sightline and 153 exposed cells, against 2,842 for the
// sparsest version and 2,520 for a procedurally generated one.
//
// The repair fixed all nine narrow passages (2-3 units: too tight to walk
// down, wide enough to wedge into) and five sealed pockets. Each edit was
// chosen by measurement rather than guesswork: every candidate — each
// neighbouring block, each of its edges, several step sizes — was tested, and
// one was kept only if it left the map connected AND did not lengthen any
// sightline. Earlier hand-picked fixes had repeatedly traded a 3-unit gap for
// a map-long view, which is much the worse deal.
//
// The result is better on both counts than what went in: 53u to 51u, and 353
// exposed cells to 153.
// ONE BUILDING PER PLOT, AND NO TWO PLOTS TOUCH. Wherever two plots used to
// share an edge (which read as a single wall of buildings) they are pulled
// apart to leave an alley at least 7 units wide at the 120 map size. The
// alleys are offset so none of them lines up into a map-long lane, and a
// watchtower stands in the open plaza east of mid. Measured on lay/palW220:
// all areas connected, no slots, longest sightline about 70-74 design units,
// centre of the map within 10% walking distance from each spawn.
const TOWN = [
  ['north',            3,    24,  16.5,    45 ],
  ['west-hall',      -32,    -1,  -9.5,   9.5 ],
  ['north-east',    21.5,  17.5,    45, 33.75 ],
  ['south-west',     -45,   -45, -29.5,   -31 ],
  ['south',         -8.5,   -45,   8.5,   -22 ],
  ['east',          34.5,    -5,    45,  12.5 ],
  ['east-mid',     16.75,  -8.5,  29.5,     6 ],
  ['west-mid',     -25.5, -21.5,   -13,    -5 ],
  ['mid-hall',         1,     2,  11.5,    19 ],
  ['north-mid',   -23.75,  20.5,    -2,    45 ],
  ['north-west',     -45,  13.5, -31.5,    31 ],
  ['west',           -45,    -9,   -36,   8.5 ],
  ['south-east',   16.25, -24.5,    39, -13.5 ],
  ['south-mid',    -24.5,   -45, -13.5, -26.5 ],
  ['south-east-2',  13.5,   -45,    35, -29.5 ],
];

// Fill a footprint with a building.
//
// `stretch` scales each axis independently to fill the box exactly, which is
// what makes street fronts meet. The catch is that a footprint whose
// proportions differ wildly from the model's gets visibly squashed — the west
// hall was being crushed to a THIRD of its natural depth, which is why some
// buildings looked wrong.
//
// So rather than assigning a model by hand, pick whichever solid model (and
// 90-degree turn) is closest in shape to the footprint. That drops the worst
// distortion from 3.1x to under 2x, and it re-solves itself automatically if a
// footprint is ever moved.
// cornerBlock replaces the deleted grandPalace here. It is squarer in plan
// (0.93 : 1.00) than either of the others, which suits the blocks whose
// footprints are close to square — exactly the ones grandPalace used to take.
const SOLID_MODELS = ['palaceExterior', 'facadeBlock', 'cornerBlock'];

// Pick the model, turn and HEIGHT that fit a footprint with the least
// distortion.
//
// The height was the thing making this hard. It was hand-picked per block, so
// two of the three axes were fixed by the footprint and the third was fighting
// them — the west hall needed a 3.1x squash to fill its box. Letting the height
// follow from the footprint instead removes that fight entirely: choose it as
// the geometric mean of the two horizontal scales and the worst mismatch across
// the whole town drops to 1.38x, which nobody can see.
function bestFit(w, d){
  let best = null;
  for(const key of SOLID_MODELS){
    const n = STRUCTURE_SHAPE[key];
    if(!n) continue;
    for(const yaw of [0, 90]){
      const nx = yaw === 90 ? n[2] : n[0];
      const nz = yaw === 90 ? n[0] : n[2];
      const sx = w/nx, sz = d/nz;
      const sc = Math.sqrt(sx * sz);
      const h  = n[1] * sc;
      if(h < 9 || h > 23) continue;          // keep heights townlike
      const stretch = Math.max(sx, sz) / Math.min(sx, sz);
      if(!best || stretch < best.stretch) best = { key, yaw, h, stretch };
    }
  }
  return best;
}

// ── ONE BUILDING PER PLOT ───────────────────────────────────────────────────
// Every plot holds exactly ONE building model: never two or more butted
// together, which reads as a wall of buildings. The model and its turn are
// chosen per plot to fit with the least distortion, and the height follows
// the plot's size but is held between BLD_HMIN and BLD_HMAX, so buildings are
// close to even (13-17 tall) without any tiny or giant ones. Worst distortion
// across the town is 1.19x.
//
// (A model turned 90 degrees is given its own-axis width and depth, so it is
// no longer fitted before turning, which used to shrink turned buildings.)
//
// Collision is the plot itself, a solid box as tall as the building, which is
// what the town layout was measured with.
const BLD_HMIN = 13, BLD_HMAX = 17;
let worstStretch = 0;
function building(dx0, dz0, dx1, dz1){
  const x0 = dx0 * PAL_SCALE, z0 = dz0 * PAL_SCALE, x1 = dx1 * PAL_SCALE, z1 = dz1 * PAL_SCALE;
  const w = x1 - x0, d = z1 - z0;
  let best = null;
  for(const key of SOLID_MODELS){
    const n = STRUCTURE_SHAPE[key];
    if(!n) continue;
    for(const yaw of [0, 90]){
      const nx = yaw ? n[2] : n[0], nz = yaw ? n[0] : n[2];
      const sx = w / nx, sz = d / nz, sc = Math.sqrt(sx * sz);
      const h = Math.min(BLD_HMAX, Math.max(BLD_HMIN, n[1] * sc));
      const bad = Math.max(Math.abs(Math.log(sx / sz)), Math.abs(Math.log((h / n[1]) / sc)));
      if(!best || bad < best.bad) best = { key, yaw, h, bad };
    }
  }
  if(!best){ console.warn('no model fits footprint', w, 'x', d); return; }
  worstStretch = Math.max(worstStretch, Math.exp(best.bad));
  const yaw = best.yaw + (((dx0 * 13 + dz0 * 7) | 0) % 2 ? 180 : 0);   // vary facing
  const turned = (yaw % 180) !== 0;
  glbStructure(best.key, (x0 + x1) / 2, (z0 + z1) / 2,
               turned ? d : w, best.h, turned ? w : d,
               { stretch: true, noCollide: true, yaw });
  obstacles.push(new THREE.Box3(new THREE.Vector3(dx0, 0, dz0), new THREE.Vector3(dx1, best.h, dz1)));
}
const sameRect = (a2, b2) => a2.every((v, i) => Math.abs(v - b2[i]) < 0.01);
// FREE_LAYOUT: the table above already lists every building, so no partners
// are generated. Set false for a mirrored table, where each entry stands for
// itself and its 180-degree twin.
const FREE_LAYOUT = true;

for(const [, x0, z0, x1, z1] of TOWN){
  building(x0, z0, x1, z1);
  if(FREE_LAYOUT) continue;
  // a block centred on the origin is its own partner; placing it twice would
  // just stack two copies in the same spot
  if(!sameRect([x0, z0, x1, z1], [-x1, -z1, -x0, -z0]))
    building(-x1, -z1, -x0, -z0);
}
console.log('buildings: one per plot,', BLD_HMIN + '-' + BLD_HMAX, 'tall, worst distortion', worstStretch.toFixed(2) + 'x');

// ── the two open courts, in the corners the spawns do not occupy ───────────
ground( 22, 22, EDGE, EDGE, sandCourtTex, 4, Y_GROUND);   // Great Court, northeast
ground(-EDGE,-EDGE, -22,-22, sandCourtTex, 4, Y_GROUND);  // Bazaar Court, southwest

// ── landmarks: a tower in each court corner, flush with the wall ───────────
// Crate cover [x, z, kind] in design units; built after the scale pass.
const PAL_CRATES = [
  [  1.00,  -9.00, 'stack'],
  [  2.44,  -9.00, 'single'],
  [  1.00,  -7.56, 'single'],
  [ -4.50, -15.50, 'single'],
  [ -3.06, -15.50, 'single'],
  [  7.50,  -2.50, 'stack'],
  [  7.50,  -1.06, 'single'],
  [ -5.50,  -1.50, 'single'],
  [-34.50, -18.00, 'stack'],
  [-33.06, -18.00, 'single'],
  [-33.50, -13.00, 'single'],
  [-38.00, -26.40, 'single'],
  [-36.56, -26.40, 'single'],
  [ 30.00,  39.00, 'stack'],
  [ 31.44,  39.00, 'single'],
  [ 30.00,  37.56, 'single'],
  [ 39.50,  37.50, 'single'],
  // (the crate beside T spawn [-33, 36] is removed: no crates at spawn)
  [ 11.90,  -7.90, 'stack'],     // breaks the east-west line past mid
  [ 11.90,  -6.46, 'stack'],
];

window.PAL_CRATES = PAL_CRATES;

// placed at world size (not stretched by the pass); collision added after it
// [x, z, size] world units. The north-east tower sits in its court corner; the
// second one (it used to be buried inside a south-west building) now stands
// alone in the plaza east of mid, a little larger, where it breaks what would
// otherwise be a map-long north-south line through the alleys.
const PAL_TOWERS = [[56.5, 56.5, 5], [17.5 * PAL_SCALE, 12 * PAL_SCALE, 5 * PAL_SCALE]];
for(const [tx, tz, ts] of PAL_TOWERS) glbStructure('watchtower', tx, tz, ts, 11 * ts / 5, ts, { noCollide: true });

// (no gateways: the four arches that stood at the street entrances to the
//  centre are removed. They used the bridge model, and at this map scale
//  they read as clutter in the middle of every junction.)


// ═══════════════════════════════════════════════════════════════════════════
//  9.  STORES AND COVER
//  Stores mark the street corners you will end up calling out. Boxes are the
//  cover you fight around — waist height, so you shoot over them.
// ═══════════════════════════════════════════════════════════════════════════
// (market stalls removed for now — the four that stood at the street corners.
//  Their positions are kept below, commented, so they are easy to bring back.)
// const PAIRS = [
//   ['marketStall', -36,  36], ['marketStall',  36, -16],
//   ['marketStall',  -6, -30], ['marketStall',  40,   4],
// ];

// A prop dropped too near a building leaves a slot too narrow to walk but wide
// enough to stand in — the worst geometry there is. Rather than hand-check
// every position, skip any that lands within `r` of an existing structure.
// Structures are pushed before this runs, so the test sees all of them.
function clearHere(x, z, r){
  for(const b of obstacles){
    if(b.max.y < 2 || b.min.y > 1) continue;      // only real building mass
    if(x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z) return false;
  }
  return true;
}

const COVER = [
  [-56,  56], [ 40,  58], [-20,  10], [ 60,  46],
  [ 52, -40], [ -8, -46], [ 34,  -2], [-58,  26],
  [  4,  30], [-46, -30], [ 62, -56], [ 10, -34],
];
let skipped = 0;
// Crates removed for now. They cost almost nothing to draw — a few hundred
// triangles each against 39M in the buildings — so this is a look decision,
// not a performance one. The amphorae, planters and sandbags stay, and they
// still get the clearance check so nothing lands against a wall.
for(const [x, z] of COVER){
  if(!(clearHere(x, z, 3.5) && clearHere(-x, -z, 3.5))){ skipped++; continue; }
  amphora( x,  z);      amphora( x + 1.4,  z + 1.4);
  amphora(-x, -z);      amphora(-x - 1.4, -z - 1.4);
}
for(const [x, z] of [[-60, 40], [50, 34], [-26, -36], [8, 48]]){
  if(!(clearHere(x, z, 3.5) && clearHere(-x, -z, 3.5))){ skipped++; continue; }
  planter( x,  z);  planter(-x, -z);
}
if(skipped) console.log('cover skipped for clearance:', skipped, 'position(s)');

// ═══════════════════════════════════════════════════════════════════════════
// 10.  HIGH GROUND — a balcony overlooking each court, stairs from the street
// ═══════════════════════════════════════════════════════════════════════════
function perch(ax0, az0, ax1, az1, top){
  const x0=Math.min(ax0,ax1), x1=Math.max(ax0,ax1);
  const z0=Math.min(az0,az1), z1=Math.max(az0,az1);
  addBox(x1-x0, 0.42, z1-z0, (x0+x1)/2, top-0.42, (z0+z1)/2,
         sides(ashlarTex, x1-x0, 0.42, z1-z0), true);
}
for(const sgn of [1, -1]){
  const S = v => sgn * v;
  platformS(S(48), S(50), S(62), S(60), 2.6, ashlarTex);
  stairsZS (S(52), S(60), S(41), S(50), 2.6, ashlarTex);
  wallZ(S(48), Math.min(S(50), S(60)), Math.max(S(50), S(60)), 1.1, ashlarTex, 2.6);
}

// ── PALACE SCALE PASS ───────────────────────────────────────────────────────
// Everything above was built at design size. Stretch it 1.33x horizontally:
// geometry through a parent group, collision and walkable surfaces directly.
// Small props (jars, planters) keep their own size and only move, so they do
// not come out fat; their collision boxes likewise keep size and move.
{
  const S = PAL_SCALE;
  const grp = new THREE.Group();
  grp.scale.set(S, 1, S);
  for(const o of scene.children.slice(_pal0.sc)){
    if(o.userData && o.userData.dynamic) continue;
    scene.remove(o); grp.add(o);
    if(o.isGroup){ o.scale.x /= S; o.scale.z /= S; o.updateMatrix(); }
  }
  grp.updateMatrixWorld(true);
  scene.add(grp);
  const small = (w, d) => w < 2.5 && d < 2.5;
  for(let i = _pal0.ob; i < obstacles.length; i++){
    const b = obstacles[i];
    if(small(b.max.x - b.min.x, b.max.z - b.min.z)){
      const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
      b.translate(new THREE.Vector3(cx * (S - 1), 0, cz * (S - 1)));
    } else { b.min.x *= S; b.max.x *= S; b.min.z *= S; b.max.z *= S; }
  }
  for(let i = _pal0.pl; i < platforms.length; i++){
    const p = platforms[i];
    if(small(p.x1 - p.x0, p.z1 - p.z0)){
      const dx = (p.x0 + p.x1) / 2 * (S - 1), dz = (p.z0 + p.z1) / 2 * (S - 1);
      p.x0 += dx; p.x1 += dx; p.z0 += dz; p.z1 += dz;
    } else { p.x0 *= S; p.x1 *= S; p.z0 *= S; p.z1 *= S; }
  }
  for(const [tx, tz, ts] of PAL_TOWERS)
    obstacles.push(new THREE.Box3(new THREE.Vector3(tx - ts / 2, 0, tz - ts / 2), new THREE.Vector3(tx + ts / 2, 11 * ts / 5, tz + ts / 2)));

  // ── CRATES ─────────────────────────────────────────────────────────────────
  // Wooden crates (pal_crate.glb), placed for cover after the scale pass so
  // they keep their real size. 'single' is one crate, waist high: you shoot
  // over it. 'stack' is two, the top one turned, taller than eye level: it
  // blocks sight. Positions are design units; layout checks in
  // lay/palW220_all.json (all connected, no slots, longest sightline ~70-74).
  const CS = 1.6 * 1.2, CH = 1.47 * 1.2;   // crate footprint and height, world units (1.2x)
  for(const [dx, dz, kind] of PAL_CRATES){
    const cx = dx * S, cz = dz * S;
    const n = kind === 'stack' ? 2 : 1;
    for(let k = 0; k < n; k++)
      glbStructure('palCrate', cx, cz, CS, CH, CS,
                   { stretch: true, noCollide: true, y: k * CH, yaw: ((dx * 7 + dz * 3 + k) | 0) % 4 * 90 + (k ? 12 : 0) });
    obstacles.push(new THREE.Box3(new THREE.Vector3(cx - CS / 2, 0, cz - CS / 2), new THREE.Vector3(cx + CS / 2, n * CH, cz + CS / 2)));
  }
  _mapSpawns = {
    t:  { x0:-45 * S, x1:-35 * S, z0: 35 * S, z1: 45 * S, yaw:  Math.PI * 0.75 },   // NW corner
    ct: { x0: 35 * S, x1: 45 * S, z0:-45 * S, z1:-35 * S, yaw: -Math.PI * 0.25 },   // SE corner
  };
  buildPalaceRamparts();
  console.log('palace: built 1.33x wide,', (EDGE * S * 2).toFixed(0), 'across inside the walls');
}

} else if(MAP_ID === 'overgrowth'){
  _mapSpawns = buildOvergrowth();
}

// ═══════════════════════════════════════════════════════════════════════════
// 11.  TEAM SPAWNS
// ═══════════════════════════════════════════════════════════════════════════
// Spawn zones, 1.5x smaller than they were — 11 units square rather than 16.
//
// randomSpawnIn picks a free point inside the zone, so a tighter zone means the
// team starts closer together and reaches the streets sooner. It still has to
// be big enough that several players can be placed without colliding: at 11
// units and a 0.7-wide player there is room for a squad with space to spare.
// Spawn zones, 10 units square, tucked into the very corners.
//
// The curtain wall is at +/-45, so a zone running 35..45 sits flush against
// both walls of its corner. That is as far apart as the two teams can start,
// which on a diagonal is the full width of the map.
const TEAM_SPAWNS = _mapSpawns || {
  t:  { x0:-45, x1:-35, z0: 35, z1: 45, yaw:  Math.PI * 0.75 },   // NW corner
  ct: { x0: 35, x1: 45, z0:-45, z1:-35, yaw: -Math.PI * 0.25 },   // SE corner
};
window.TEAM_SPAWNS = TEAM_SPAWNS;

function randomSpawnIn(zone, tries){
  for(let i = 0; i < (tries||24); i++){
    const x = zone.x0 + Math.random() * (zone.x1 - zone.x0);
    const z = zone.z0 + Math.random() * (zone.z1 - zone.z0);
    if(!enemyCollides(x, z, 0.6)) return [x, z];
  }
  return [(zone.x0 + zone.x1)/2, (zone.z0 + zone.z1)/2];
}
window.randomSpawnIn = randomSpawnIn;

function updateTrafficLights(){}

// (structures are placed by the street grid above)

// ── STANDABLE SURFACES ──────────────────────────────────────────────────────
// Every solid must also be standable on its top face. If it is not, a player
// who jumps onto it finds nothing supporting them: groundHeightAt returns the
// floor underneath, gravity pulls them down, and they end up trapped INSIDE
// the collision box looking at its interior. Deriving the surfaces from the
// obstacles themselves means this can never be missed for a new prop.
{
  const before = platforms.length;
  const seen = new Set();
  for(const p of platforms) seen.add([p.x0,p.x1,p.z0,p.z1,p.top].map(v=>v.toFixed(2)).join(','));
  for(const b of obstacles){
    const key = [b.min.x,b.max.x,b.min.z,b.max.z,b.max.y].map(v=>v.toFixed(2)).join(',');
    if(seen.has(key)) continue;
    seen.add(key);
    platforms.push({ x0:b.min.x, x1:b.max.x, z0:b.min.z, z1:b.max.z, top:b.max.y });
  }
  console.log('standable surfaces:', before, '->', platforms.length,
              '(' + (platforms.length - before) + ' derived from solids)');
}

console.log('TACTICAL CITY built —',
            'obstacles:', obstacles.length, '| walkable surfaces:', platforms.length);

function makeCar(x, z, ry, hue){
  const g = new THREE.Group();
  const carColor = new THREE.Color().setHSL(hue ?? 0.58, 0.05, 0.72); // light silver
  const bodyMat  = new THREE.MeshStandardMaterial({color: carColor, roughness:0.3, metalness:0.65, envMapIntensity:1.2});
  const darkMat  = new THREE.MeshStandardMaterial({color:0x15171a, roughness:0.6, metalness:0.4});
  const chromeMat= new THREE.MeshStandardMaterial({color:0xcfd4da, roughness:0.18, metalness:0.95, envMapIntensity:1.5});
  const glassMat = new THREE.MeshStandardMaterial({color:0x0e141a, roughness:0.1, metalness:0.5, transparent:true, opacity:0.6, envMapIntensity:1.4});

  // Wheels: radius 0.36, axle at y=0.36 so the tire bottom sits exactly on the ground (y=0).
  const WHEEL_R = 0.36, AXLE_Y = 0.36;

  // ── BODY ── lower body sits low; its bottom (~0.46) overlaps the wheel tops so no gap.
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 4.2), bodyMat);
  lower.position.y = 0.66; lower.castShadow = true; g.add(lower);
  // Belt/door section slightly wider, fills the gap down to the wheels
  const midBody = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.3, 3.9), bodyMat);
  midBody.position.y = 0.5; g.add(midBody);
  // Dark rocker sill at very bottom
  const sill = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 3.4), darkMat);
  sill.position.y = 0.34; g.add(sill);

  // Sloped hood and rear deck
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.22, 1.2), bodyMat);
  hood.position.set(0, 0.9, 1.45); hood.rotation.x = -0.07; hood.castShadow = true; g.add(hood);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.24, 0.95), bodyMat);
  trunk.position.set(0, 0.92, -1.5); trunk.rotation.x = 0.05; g.add(trunk);

  // ── CABIN ── roof narrower & shorter, glass tucked just under it
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 1.6), bodyMat);
  roof.position.set(0, 1.5, -0.15); roof.castShadow = true; g.add(roof);
  // glass box (fills the greenhouse so pillars read against it)
  const greenhouse = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.5, 1.55), glassMat);
  greenhouse.position.set(0, 1.22, -0.15); g.add(greenhouse);
  // windshield + rear (sloped) caps
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.5, 0.06), glassMat);
  windshield.position.set(0, 1.2, 0.66); windshield.rotation.x = -0.5; g.add(windshield);
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.46, 0.06), glassMat);
  rearGlass.position.set(0, 1.22, -0.9); rearGlass.rotation.x = 0.55; g.add(rearGlass);
  // pillars at the 4 roof corners (body color)
  for(const [px,pz,rot] of [[0.74,0.55,-0.5],[-0.74,0.55,-0.5],[0.74,-0.85,0.55],[-0.74,-0.85,0.55]]){
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.55,0.1), bodyMat);
    pillar.position.set(px,1.24,pz); pillar.rotation.x = rot; g.add(pillar);
  }

  // ── FASCIA ──
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.22,0.06), darkMat);
  grille.position.set(0,0.74,2.06); g.add(grille);
  const chromeBar = new THREE.Mesh(new THREE.BoxGeometry(1.14,0.05,0.05), chromeMat);
  chromeBar.position.set(0,0.86,2.07); g.add(chromeBar);
  const fbumper = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.3,0.26), darkMat);
  fbumper.position.set(0,0.5,2.02); g.add(fbumper);
  const rbumper = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.3,0.26), darkMat);
  rbumper.position.set(0,0.5,-2.02); g.add(rbumper);

  // Headlights / tail lights (named meshes used by driving code)
  const hlMat = new THREE.MeshStandardMaterial({color:0xdfeaff, emissive:0xfff2cc, emissiveIntensity:0.7, roughness:0.2});
  const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.36,0.14,0.08), hlMat); hl1.position.set(0.6,0.82,2.04); g.add(hl1);
  const hl2 = new THREE.Mesh(new THREE.BoxGeometry(0.36,0.14,0.08), hlMat); hl2.position.set(-0.6,0.82,2.04); g.add(hl2);
  const tlMat = new THREE.MeshStandardMaterial({color:0x440000, emissive:0xff2222, emissiveIntensity:0.5});
  const tl1 = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.18,0.08), tlMat); tl1.position.set(0.62,0.88,-2.04); g.add(tl1);
  const tl2 = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.18,0.08), tlMat); tl2.position.set(-0.62,0.88,-2.04); g.add(tl2);

  // Mirrors + handles
  for(const sx of [1,-1]){
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.13,0.18), bodyMat);
    cap.position.set(sx*0.98,1.08,0.78); g.add(cap);
  }
  for(const sx of [0.93,-0.93]) for(const pz of [0.4,-0.5]){
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.04,0.2), chromeMat);
    h.position.set(sx,0.92,pz); g.add(h);
  }

  // ── WHEELS ── flat fender flares hug the tires (no floating black boxes)
  const tireMat = new THREE.MeshStandardMaterial({color:0x0a0a0a, roughness:0.9});
  const rimMat  = new THREE.MeshStandardMaterial({color:0xb8bcc2, roughness:0.3, metalness:0.9, envMapIntensity:1.4});
  const wheelPositions = [
    {x: 0.9, z: 1.4,  steer:true}, {x:-0.9, z: 1.4,  steer:true},
    {x: 0.9, z:-1.4,  steer:false},{x:-0.9, z:-1.4,  steer:false},
  ];
  const wheels = [];
  for(const wp of wheelPositions){
    // subtle arch lip on the body, flush to the side (not a big box)
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.95), darkMat);
    lip.position.set(wp.x*0.93, 0.55, wp.z); g.add(lip);

    const wgroup = new THREE.Group();
    wgroup.position.set(wp.x, AXLE_Y, wp.z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.24, 18), tireMat);
    tire.rotation.z = Math.PI/2; tire.castShadow = true; wgroup.add(tire);
    // rim face + spokes built flat on the outer side
    const rimDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.26,16), rimMat);
    rimDisc.rotation.z = Math.PI/2; wgroup.add(rimDisc);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.27,10), chromeMat);
    hub.rotation.z = Math.PI/2; wgroup.add(hub);
    for(let s=0;s<5;s++){
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.06,0.05), rimMat);
      spoke.rotation.x = (s/5)*Math.PI*2;   // spin around the axle (X axis)
      spoke.position.set(wp.x>0?0.13:-0.13, 0, 0);
      // rotate the bar within the wheel plane:
      const holder = new THREE.Group();
      holder.position.x = wp.x>0 ? 0.13 : -0.13;
      holder.rotation.x = (s/5)*Math.PI*2;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.34,0.04), rimMat);
      holder.add(bar);
      wgroup.add(holder);
    }
    g.add(wgroup);
    wheels.push({group: wgroup, tire, steer: wp.steer});
  }

  g.position.set(x,0,z); g.rotation.y = ry; scene.add(g);

  const car = {
    group: g, x, z, angle: ry, speed: 0, steer: 0,
    halfW: 1.05, halfL: 2.2, wheels,
    bodyMat, headlights:[hl1,hl2], taillights:[tl1,tl2], bbox: new THREE.Box3(),
  };
  updateCarBox(car);
  car.obstacle = car.bbox.clone();
  obstacles.push(car.obstacle);
  cars.push(car);
  return car;
}

// Recompute the axis-aligned bounding box of a car at its current angle/pos.
function updateCarBox(car){
  const cosA = Math.abs(Math.cos(car.angle));
  const sinA = Math.abs(Math.sin(car.angle));
  const ex = car.halfW * cosA + car.halfL * sinA;
  const ez = car.halfW * sinA + car.halfL * cosA;
  car.bbox.min.set(car.x - ex, 0, car.z - ez);
  car.bbox.max.set(car.x + ex, 1.8, car.z + ez);
}

// Spawn cars at varied positions around the plaza, all parallel to nearest road
// (or just rotated nicely). The originals were at fixed angles; we'll mimic.
// Vehicles removed — this is a pure infantry map.