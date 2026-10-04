// ── GUN MODELS — REALISTIC PBR REBUILD ──────────────────────────────────────
// Shapes are unchanged from your originals; every part now uses shared,
// reflective gunmetal/wood/polymer materials so the metal catches the
// environment map. Same geometry, dramatically better surfaces.

// Procedural gunmetal texture: dark base + fine machining grain + micro wear.
function gunmetalTex(base, grain){
  const cv=document.createElement('canvas'); cv.width=cv.height=256; const c=cv.getContext('2d');
  c.fillStyle=base; c.fillRect(0,0,256,256);
  for(let y=0;y<256;y++){
    c.strokeStyle=`rgba(255,255,255,${Math.random()*grain})`;
    c.beginPath(); c.moveTo(0,y); c.lineTo(256,y); c.stroke();
  }
  for(let i=0;i<70;i++){
    c.fillStyle=`rgba(${190+Math.random()*40|0},${195},${205},${Math.random()*0.06})`;
    c.fillRect(Math.random()*256, Math.random()*256, Math.random()*3+1, Math.random()*1.5+0.5);
  }
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
const _texSteel = gunmetalTex('#1d2025', 0.035);
const _texBlack = gunmetalTex('#26282d', 0.025);
const _texDark  = gunmetalTex('#15171b', 0.03);

const matSteel   = new THREE.MeshStandardMaterial({ map:_texSteel, color:0x8b9097, metalness:0.95, roughness:0.33, envMapIntensity:1.3 });
const matBlued   = new THREE.MeshStandardMaterial({ map:_texDark,  color:0x4a4e55, metalness:0.9,  roughness:0.42, envMapIntensity:1.1 });
const matBlack   = new THREE.MeshStandardMaterial({ map:_texBlack, color:0x33363b, metalness:0.8,  roughness:0.55, envMapIntensity:0.9 });
const matChrome  = new THREE.MeshStandardMaterial({ color:0xcaced4, metalness:1.0, roughness:0.1, envMapIntensity:1.7 });
const matWood    = new THREE.MeshStandardMaterial({ map:woodTex, color:0x7a4a22, metalness:0.0, roughness:0.55, envMapIntensity:0.6 });
const matPolymer = new THREE.MeshStandardMaterial({ color:0x1c1f23, metalness:0.15, roughness:0.72, envMapIntensity:0.5 });
const matSight   = new THREE.MeshStandardMaterial({ color:0x0a0a0a, metalness:0.6, roughness:0.4 });

// ── 1911-STYLE PISTOL — high-detail sculpt ──────────────────────────────────
// Checkered grip texture (procedural)
const _gripCheckerTex = (()=>{
  const cv=document.createElement('canvas'); cv.width=cv.height=128; const c=cv.getContext('2d');
  c.fillStyle='#0c0d0f'; c.fillRect(0,0,128,128);
  for(let y=0;y<128;y+=6) for(let x=0;x<128;x+=6){
    c.fillStyle = ((x/6+y/6)&1) ? 'rgba(70,72,78,0.9)' : 'rgba(20,21,24,0.9)';
    c.beginPath(); c.moveTo(x+3,y); c.lineTo(x+6,y+3); c.lineTo(x+3,y+6); c.lineTo(x,y+3); c.closePath(); c.fill();
  }
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,3); return t;
})();
const matGripChecker = new THREE.MeshStandardMaterial({ map:_gripCheckerTex, color:0x44464c, metalness:0.1, roughness:0.85 });
const _serrationGeo = new THREE.BoxGeometry(.004,.05,.012);
const _screwGeo = new THREE.CylinderGeometry(.006,.006,.004,8);

function makePistol(col){
  const g=new THREE.Group();
  const slideBody=new THREE.Mesh(new THREE.BoxGeometry(.052,.07,.42),matBlued);
  slideBody.position.set(0,.018,0); g.add(slideBody);
  const slideTop=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,.42,16,1,false,0,Math.PI),matBlued);
  slideTop.rotation.z=Math.PI/2; slideTop.rotation.y=Math.PI/2; slideTop.position.set(0,.053,0); g.add(slideTop);
  const rib=new THREE.Mesh(new THREE.BoxGeometry(.012,.006,.42),matBlack); rib.position.set(0,.078,0); g.add(rib);
  for(let i=0;i<7;i++){
    const s=new THREE.Mesh(_serrationGeo,matBlack);
    s.position.set(.027,.03,.14+i*.0095); g.add(s);
    const s2=s.clone(); s2.position.x=-.027; g.add(s2);
  }
  const port=new THREE.Mesh(new THREE.BoxGeometry(.01,.03,.07),matSight);
  port.position.set(.027,.03,-.02); g.add(port);
  const rsight=new THREE.Mesh(new THREE.BoxGeometry(.03,.014,.012),matSight); rsight.position.set(0,.086,.19); g.add(rsight);
  const fsight=new THREE.Mesh(new THREE.BoxGeometry(.01,.016,.012),matSight); fsight.position.set(0,.086,-.19); g.add(fsight);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.10,14),matSteel);
  barrel.rotation.x=Math.PI/2; barrel.position.set(0,.03,-.235); g.add(barrel);
  const bushing=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,.025,16),matSteel);
  bushing.rotation.x=Math.PI/2; bushing.position.set(0,.03,-.205); g.add(bushing);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(.05,.04,.34),matBlued);
  frame.position.set(0,-.025,.02); g.add(frame);
  const dust=new THREE.Mesh(new THREE.BoxGeometry(.046,.03,.12),matBlued);
  dust.position.set(0,-.018,-.13); g.add(dust);
  const tgFront=new THREE.Mesh(new THREE.BoxGeometry(.046,.045,.01),matBlued); tgFront.position.set(0,-.062,-.04); g.add(tgFront);
  const tgBot=new THREE.Mesh(new THREE.BoxGeometry(.046,.01,.07),matBlued); tgBot.position.set(0,-.082,-.005); g.add(tgBot);
  const trig=new THREE.Mesh(new THREE.BoxGeometry(.02,.03,.008),matSteel); trig.position.set(0,-.052,.0); g.add(trig);
  const grip=new THREE.Group();
  const gripCore=new THREE.Mesh(new THREE.BoxGeometry(.05,.20,.085),matBlack); grip.add(gripCore);
  for(const sx of [.027,-.027]){
    const panel=new THREE.Mesh(new THREE.BoxGeometry(.004,.17,.075),matGripChecker);
    panel.position.set(sx,0,.004); grip.add(panel);
    for(const sy of [.05,-.05]){
      const screw=new THREE.Mesh(_screwGeo,matSteel);
      screw.rotation.z=Math.PI/2; screw.position.set(sx*1.08,sy,.004); grip.add(screw);
    }
  }
  grip.position.set(0,-.14,.10); grip.rotation.x=.30; g.add(grip);
  const magBase=new THREE.Mesh(new THREE.BoxGeometry(.052,.018,.09),matSteel);
  magBase.position.set(0,-.245,.135); magBase.rotation.x=.30; g.add(magBase);
  const beaver=new THREE.Mesh(new THREE.BoxGeometry(.044,.025,.05),matBlued);
  beaver.position.set(0,-.018,.18); beaver.rotation.x=.5; g.add(beaver);
  const hammer=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.012,12),matSteel);
  hammer.rotation.z=Math.PI/2; hammer.position.set(0,.01,.205); g.add(hammer);
  const safety=new THREE.Mesh(new THREE.BoxGeometry(.012,.012,.04),matSteel);
  safety.position.set(.026,-.01,.15); g.add(safety);
  return g;
}
// ── AK-47 — high-detail sculpt (makeRifle) ──────────────────────────────────
const _akRibGeo = new THREE.BoxGeometry(.05,.008,.006);

function makeRifle(col){
  const g=new THREE.Group();
  const recv=new THREE.Mesh(new THREE.BoxGeometry(.05,.085,.30),matBlued);
  recv.position.set(0,0,.02); g.add(recv);
  const cover=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,.26,12,1,false,0,Math.PI),matBlack);
  cover.rotation.z=Math.PI/2; cover.rotation.y=Math.PI/2; cover.position.set(0,.045,.0); g.add(cover);
  const rsight=new THREE.Mesh(new THREE.BoxGeometry(.05,.02,.03),matBlack); rsight.position.set(0,.052,-.12); g.add(rsight);
  const brl=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.46,12),matSteel);
  brl.rotation.x=Math.PI/2; brl.position.set(0,.02,-.40); g.add(brl);
  const gasTube=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.18,10),matBlack);
  gasTube.rotation.x=Math.PI/2; gasTube.position.set(0,.05,-.30); g.add(gasTube);
  const fsb=new THREE.Mesh(new THREE.BoxGeometry(.03,.05,.03),matBlack); fsb.position.set(0,.04,-.58); g.add(fsb);
  const fpost=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,.03,6),matSteel); fpost.position.set(0,.07,-.58); g.add(fpost);
  const gasBlock=new THREE.Mesh(new THREE.BoxGeometry(.028,.04,.04),matBlack); gasBlock.position.set(0,.035,-.44); g.add(gasBlock);
  const muzzle=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.05,10),matBlack);
  muzzle.rotation.x=Math.PI/2 + .18; muzzle.position.set(0,.02,-.64); g.add(muzzle);
  const rod=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,.40,6),matSteel);
  rod.rotation.x=Math.PI/2; rod.position.set(0,-.005,-.40); g.add(rod);
  const hand=new THREE.Mesh(new THREE.BoxGeometry(.05,.05,.16),matWood);
  hand.position.set(0,.0,-.22); g.add(hand);
  const upperHand=new THREE.Mesh(new THREE.BoxGeometry(.04,.03,.12),matWood);
  upperHand.position.set(0,.06,-.26); g.add(upperHand);
  const magSegs=[
    {y:-.09, z:.01, rx:-.15, h:.09, d:.06},
    {y:-.16, z:.04, rx:-.42, h:.08, d:.055},
    {y:-.22, z:.09, rx:-.72, h:.07, d:.05},
  ];
  for(const m of magSegs){
    const seg=new THREE.Mesh(new THREE.BoxGeometry(.045,m.h,m.d),matBlack);
    seg.position.set(0,m.y,m.z); seg.rotation.x=m.rx; g.add(seg);
    for(let r=0;r<3;r++){
      const rib=new THREE.Mesh(_akRibGeo,matBlued);
      rib.position.set(0,m.y+(r-1)*.025,m.z+m.d/2*0.6); rib.rotation.x=m.rx; g.add(rib);
    }
  }
  const grp=new THREE.Mesh(new THREE.BoxGeometry(.04,.13,.05),matWood);
  grp.position.set(0,-.09,.17); grp.rotation.x=.32; g.add(grp);
  const tg=new THREE.Mesh(new THREE.BoxGeometry(.04,.012,.06),matBlack); tg.position.set(0,-.06,.10); g.add(tg);
  const trig=new THREE.Mesh(new THREE.BoxGeometry(.012,.03,.008),matSteel); trig.position.set(0,-.045,.11); g.add(trig);
  const stk=new THREE.Mesh(new THREE.BoxGeometry(.04,.07,.24),matWood);
  stk.position.set(0,-.005,.34); g.add(stk);
  const heel=new THREE.Mesh(new THREE.BoxGeometry(.04,.11,.04),matWood);
  heel.position.set(0,-.02,.46); heel.rotation.x=-.22; g.add(heel);
  const plate=new THREE.Mesh(new THREE.BoxGeometry(.042,.11,.012),matBlack);
  plate.position.set(0,-.025,.48); plate.rotation.x=-.22; g.add(plate);
  return g;
}
// ── DESERT EAGLE — high-detail sculpt ───────────────────────────────────────
const _deSerrationGeo = new THREE.BoxGeometry(.05,.006,.012);
const _railToothGeo   = new THREE.BoxGeometry(.03,.012,.01);

function makeDeagle(){
  const g=new THREE.Group();
  const slide=new THREE.Mesh(new THREE.BoxGeometry(.062,.10,.50),matChrome);
  slide.position.set(0,.025,0); g.add(slide);
  const topRib=new THREE.Mesh(new THREE.BoxGeometry(.02,.006,.50),matSteel);
  topRib.position.set(0,.078,0); g.add(topRib);
  for(let i=0;i<9;i++){
    const s=new THREE.Mesh(_deSerrationGeo,matSteel);
    s.position.set(.032,.01+i*.009,.14); g.add(s);
    const s2=s.clone(); s2.position.x=-.032; g.add(s2);
  }
  const port=new THREE.Mesh(new THREE.BoxGeometry(.012,.04,.08),matSight);
  port.position.set(.032,.04,-.04); g.add(port);
  const rsight=new THREE.Mesh(new THREE.BoxGeometry(.034,.016,.014),matSight); rsight.position.set(0,.086,.22); g.add(rsight);
  const fsight=new THREE.Mesh(new THREE.BoxGeometry(.012,.02,.014),matSight); fsight.position.set(0,.088,-.235); g.add(fsight);
  const barrel=new THREE.Mesh(new THREE.BoxGeometry(.05,.055,.20),matChrome);
  barrel.position.set(0,.03,-.31); g.add(barrel);
  for(let i=0;i<7;i++){
    const tooth=new THREE.Mesh(_railToothGeo,matSteel);
    tooth.position.set(0,.066,-.39+i*.022); g.add(tooth);
  }
  for(let i=0;i<3;i++){
    const cut=new THREE.Mesh(new THREE.BoxGeometry(.052,.012,.008),matSight);
    cut.position.set(0,.05,-.40-i*.018); g.add(cut);
  }
  const muzzle=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.02,12),matSight);
  muzzle.rotation.x=Math.PI/2; muzzle.position.set(0,.03,-.45); g.add(muzzle);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(.058,.05,.36),matBlack);
  frame.position.set(0,-.03,.04); g.add(frame);
  const railBase=new THREE.Mesh(new THREE.BoxGeometry(.04,.014,.26),matBlack);
  railBase.position.set(0,-.05,-.12); g.add(railBase);
  for(let i=0;i<8;i++){
    const tooth=new THREE.Mesh(_railToothGeo,matBlack);
    tooth.position.set(0,-.062,-.22+i*.026); g.add(tooth);
  }
  const tgFront=new THREE.Mesh(new THREE.BoxGeometry(.05,.055,.012),matBlack); tgFront.position.set(0,-.072,-.05); g.add(tgFront);
  const tgBot=new THREE.Mesh(new THREE.BoxGeometry(.05,.012,.08),matBlack); tgBot.position.set(0,-.098,-.01); g.add(tgBot);
  const trig=new THREE.Mesh(new THREE.BoxGeometry(.02,.038,.01),matSteel); trig.position.set(0,-.062,-.012); g.add(trig);
  const grip=new THREE.Group();
  const gripCore=new THREE.Mesh(new THREE.BoxGeometry(.058,.22,.105),matBlack); grip.add(gripCore);
  for(const sx of [.031,-.031]){
    const panel=new THREE.Mesh(new THREE.BoxGeometry(.004,.18,.09),matPolymer);
    panel.position.set(sx,0,.004); grip.add(panel);
    const screw=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,.004,8),matSteel);
    screw.rotation.z=Math.PI/2; screw.position.set(sx*1.06,-.03,.004); grip.add(screw);
  }
  grip.position.set(0,-.16,.12); grip.rotation.x=.32; g.add(grip);
  const magBase=new THREE.Mesh(new THREE.BoxGeometry(.06,.02,.10),matBlack);
  magBase.position.set(0,-.275,.16); magBase.rotation.x=.32; g.add(magBase);
  const hammer=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.014,12),matSteel);
  hammer.rotation.z=Math.PI/2; hammer.position.set(0,.04,.245); g.add(hammer);
  const safety=new THREE.Mesh(new THREE.BoxGeometry(.014,.018,.03),matSteel);
  safety.position.set(.032,.055,.17); g.add(safety);
  return g;
}
// ── MP5 — high-detail sculpt ────────────────────────────────────────────────
function makeMP5(){
  const g=new THREE.Group();
  const recv=new THREE.Mesh(new THREE.BoxGeometry(.044,.07,.32),matBlack);
  recv.position.set(0,.01,.02); g.add(recv);
  const tube=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.40,12),matBlack);
  tube.rotation.x=Math.PI/2; tube.position.set(0,.05,-.12); g.add(tube);
  const cockNub=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.025,8),matSteel);
  cockNub.rotation.z=Math.PI/2; cockNub.position.set(.026,.055,-.18); g.add(cockNub);
  const rearDrum=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.018,14),matBlack);
  rearDrum.rotation.x=Math.PI/2; rearDrum.position.set(0,.062,.16); g.add(rearDrum);
  const brl=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.16,12),matSteel);
  brl.rotation.x=Math.PI/2; brl.position.set(0,.03,-.30); g.add(brl);
  const muzzle=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.03,10),matBlack);
  muzzle.rotation.x=Math.PI/2; muzzle.position.set(0,.03,-.38); g.add(muzzle);
  const fsRing=new THREE.Mesh(new THREE.TorusGeometry(.022,.005,8,16),matBlack);
  fsRing.position.set(0,.05,-.33); g.add(fsRing);
  const fsPost=new THREE.Mesh(new THREE.CylinderGeometry(.003,.003,.022,6),matSteel);
  fsPost.position.set(0,.04,-.33); g.add(fsPost);
  const hand=new THREE.Mesh(new THREE.BoxGeometry(.04,.045,.16),matPolymer);
  hand.position.set(0,-.01,-.18); g.add(hand);
  for(let i=0;i<3;i++){
    const slot=new THREE.Mesh(new THREE.BoxGeometry(.042,.004,.02),matBlack);
    slot.position.set(0,.005,-.22+i*.04); g.add(slot);
  }
  const mag1=new THREE.Mesh(new THREE.BoxGeometry(.036,.12,.05),matBlack);
  mag1.position.set(0,-.085,.0); mag1.rotation.x=-.08; g.add(mag1);
  const mag2=new THREE.Mesh(new THREE.BoxGeometry(.034,.10,.045),matBlack);
  mag2.position.set(0,-.18,-.02); mag2.rotation.x=-.20; g.add(mag2);
  const magFloor=new THREE.Mesh(new THREE.BoxGeometry(.04,.012,.05),matSteel);
  magFloor.position.set(0,-.235,-.035); magFloor.rotation.x=-.20; g.add(magFloor);
  const triggerHousing=new THREE.Mesh(new THREE.BoxGeometry(.042,.05,.10),matPolymer);
  triggerHousing.position.set(0,-.055,.14); g.add(triggerHousing);
  const grp=new THREE.Mesh(new THREE.BoxGeometry(.04,.12,.05),matPolymer);
  grp.position.set(0,-.10,.19); grp.rotation.x=.30; g.add(grp);
  const tg=new THREE.Mesh(new THREE.BoxGeometry(.038,.012,.05),matBlack); tg.position.set(0,-.075,.13); g.add(tg);
  const trig=new THREE.Mesh(new THREE.BoxGeometry(.012,.026,.008),matSteel); trig.position.set(0,-.062,.14); g.add(trig);
  const selector=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.012,10),matBlack);
  selector.rotation.z=Math.PI/2; selector.position.set(.024,-.04,.15); g.add(selector);
  const cap=new THREE.Mesh(new THREE.BoxGeometry(.044,.07,.025),matBlack);
  cap.position.set(0,.01,.19); g.add(cap);
  return g;
}
// ── AWP — high-detail sculpt ────────────────────────────────────────────────
const matAwpGreen = new THREE.MeshStandardMaterial({ color:0x55603a, metalness:0.2, roughness:0.7, envMapIntensity:0.5 });

function makeAWP(){
  const g=new THREE.Group();
  const brl=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.64,14),matSteel);
  brl.rotation.x=Math.PI/2; brl.position.set(0,.012,-.55); g.add(brl);
  const flute=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.30,10),matBlack);
  flute.rotation.x=Math.PI/2; flute.position.set(0,.012,-.45); g.add(flute);
  const muzzle=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.06,12),matBlack);
  muzzle.rotation.x=Math.PI/2; muzzle.position.set(0,.012,-.85); g.add(muzzle);
  const recv=new THREE.Mesh(new THREE.BoxGeometry(.055,.085,.34),matAwpGreen);
  recv.position.set(0,0,-.05); g.add(recv);
  const boltArm=new THREE.Mesh(new THREE.BoxGeometry(.07,.018,.018),matSteel);
  boltArm.position.set(.05,.02,.10); g.add(boltArm);
  const boltKnob=new THREE.Mesh(new THREE.SphereGeometry(.02,10,8),matSteel);
  boltKnob.position.set(.088,.02,.10); g.add(boltKnob);
  const bipMount=new THREE.Mesh(new THREE.BoxGeometry(.04,.04,.05),matBlack);
  bipMount.position.set(0,-.02,-.62); g.add(bipMount);
  const bipL=new THREE.Mesh(new THREE.CylinderGeometry(.008,.006,.22,8),matBlack);
  bipL.position.set(.06,-.10,-.62); bipL.rotation.z=.45; g.add(bipL);
  const bipR=new THREE.Mesh(new THREE.CylinderGeometry(.008,.006,.22,8),matBlack);
  bipR.position.set(-.06,-.10,-.62); bipR.rotation.z=-.45; g.add(bipR);
  const footL=new THREE.Mesh(new THREE.SphereGeometry(.012,8,6),matBlack); footL.position.set(.11,-.20,-.62); g.add(footL);
  const footR=new THREE.Mesh(new THREE.SphereGeometry(.012,8,6),matBlack); footR.position.set(-.11,-.20,-.62); g.add(footR);
  const scopeTube=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,.30,14),matBlack);
  scopeTube.rotation.x=Math.PI/2; scopeTube.position.set(0,.095,-.05); g.add(scopeTube);
  const scopeBell=new THREE.Mesh(new THREE.CylinderGeometry(.038,.026,.10,14),matBlack);
  scopeBell.rotation.x=Math.PI/2; scopeBell.position.set(0,.095,-.22); g.add(scopeBell);
  const scopeEye=new THREE.Mesh(new THREE.CylinderGeometry(.034,.026,.08,14),matBlack);
  scopeEye.rotation.x=Math.PI/2; scopeEye.position.set(0,.095,.14); g.add(scopeEye);
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.034,16),new THREE.MeshStandardMaterial({color:0x223344,metalness:0.9,roughness:0.1,envMapIntensity:1.5}));
  lens.position.set(0,.095,-.272); g.add(lens);
  const ring1=new THREE.Mesh(new THREE.BoxGeometry(.05,.06,.025),matBlack); ring1.position.set(0,.06,-.14); g.add(ring1);
  const ring2=new THREE.Mesh(new THREE.BoxGeometry(.05,.06,.025),matBlack); ring2.position.set(0,.06,.04); g.add(ring2);
  const turret=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.02,10),matBlack);
  turret.position.set(0,.125,-.05); g.add(turret);
  const mag=new THREE.Mesh(new THREE.BoxGeometry(.04,.07,.07),matBlack);
  mag.position.set(0,-.075,.02); g.add(mag);
  const tg=new THREE.Mesh(new THREE.BoxGeometry(.04,.012,.06),matAwpGreen); tg.position.set(0,-.06,.12); g.add(tg);
  const trig=new THREE.Mesh(new THREE.BoxGeometry(.012,.03,.008),matSteel); trig.position.set(0,-.05,.13); g.add(trig);
  const stockTop=new THREE.Mesh(new THREE.BoxGeometry(.05,.05,.22),matAwpGreen);
  stockTop.position.set(0,.04,.26); g.add(stockTop);
  const stockBot=new THREE.Mesh(new THREE.BoxGeometry(.05,.05,.10),matAwpGreen);
  stockBot.position.set(0,-.06,.20); g.add(stockBot);
  const stockRear=new THREE.Mesh(new THREE.BoxGeometry(.05,.14,.06),matAwpGreen);
  stockRear.position.set(0,-.01,.34); g.add(stockRear);
  const grp=new THREE.Mesh(new THREE.BoxGeometry(.045,.12,.05),matAwpGreen);
  grp.position.set(0,-.07,.14); grp.rotation.x=.25; g.add(grp);
  const cheek=new THREE.Mesh(new THREE.BoxGeometry(.05,.03,.16),matAwpGreen);
  cheek.position.set(0,.07,.22); g.add(cheek);
  const butt=new THREE.Mesh(new THREE.BoxGeometry(.052,.16,.02),matBlack);
  butt.position.set(0,-.01,.40); g.add(butt);
  return g;
}
// ── GLOCK 18 — high-detail sculpt ───────────────────────────────────────────
const _stippleTex = (()=>{
  const cv=document.createElement('canvas'); cv.width=cv.height=128; const c=cv.getContext('2d');
  c.fillStyle='#1a1c20'; c.fillRect(0,0,128,128);
  for(let y=0;y<128;y+=4) for(let x=0;x<128;x+=4){
    const j=(Math.random()*1.5);
    c.fillStyle = Math.random()>0.5 ? 'rgba(60,62,68,0.8)' : 'rgba(10,11,13,0.8)';
    c.beginPath(); c.arc(x+2+j,y+2+j,1.1,0,Math.PI*2); c.fill();
  }
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(3,4); return t;
})();
const matStipple = new THREE.MeshStandardMaterial({ map:_stippleTex, color:0x2a2c30, metalness:0.05, roughness:0.9 });
const _gSerrationGeo = new THREE.BoxGeometry(.004,.045,.011);

// ── GUNS — price list (all free) ─────────────────────────────────────────────
// Buy-phase budget. With no bots there is no kill income yet, so each deploy
// grants a fresh allowance and the price list stays meaningful.
const START_MONEY = 5000;

function makeGlock18(){
  const g=new THREE.Group();
  const slide=new THREE.Mesh(new THREE.BoxGeometry(.056,.075,.42),matBlued);
  slide.position.set(0,.02,0); g.add(slide);
  const topFlat=new THREE.Mesh(new THREE.BoxGeometry(.04,.006,.42),matBlack);
  topFlat.position.set(0,.058,0); g.add(topFlat);
  for(let i=0;i<8;i++){
    const s=new THREE.Mesh(_gSerrationGeo,matBlack);
    s.position.set(.029,.03,.12+i*.009); s.rotation.x=.18; g.add(s);
    const s2=s.clone(); s2.position.x=-.029; g.add(s2);
  }
  for(let i=0;i<5;i++){
    const s=new THREE.Mesh(_gSerrationGeo,matBlack);
    s.position.set(.029,.03,-.15+i*.009); s.rotation.x=.18; g.add(s);
    const s2=s.clone(); s2.position.x=-.029; g.add(s2);
  }
  const port=new THREE.Mesh(new THREE.BoxGeometry(.01,.028,.06),matSight);
  port.position.set(.029,.034,-.01); g.add(port);
  const rsight=new THREE.Mesh(new THREE.BoxGeometry(.03,.014,.012),matSight); rsight.position.set(0,.064,.195); g.add(rsight);
  const fsight=new THREE.Mesh(new THREE.BoxGeometry(.01,.016,.012),matSight); fsight.position.set(0,.065,-.195); g.add(fsight);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.019,.019,.05,14),matSteel);
  barrel.rotation.x=Math.PI/2; barrel.position.set(0,.03,-.215); g.add(barrel);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(.052,.035,.34),matStipple);
  frame.position.set(0,-.022,.03); g.add(frame);
  const dust=new THREE.Mesh(new THREE.BoxGeometry(.048,.028,.14),matStipple);
  dust.position.set(0,-.018,-.13); g.add(dust);
  const rail=new THREE.Mesh(new THREE.BoxGeometry(.03,.01,.10),matBlack);
  rail.position.set(0,-.037,-.12); g.add(rail);
  const takedown=new THREE.Mesh(new THREE.BoxGeometry(.012,.012,.02),matSteel);
  takedown.position.set(.028,-.018,.04); g.add(takedown);
  const slideStop=new THREE.Mesh(new THREE.BoxGeometry(.01,.01,.04),matSteel);
  slideStop.position.set(-.028,-.012,.06); g.add(slideStop);
  const tgFront=new THREE.Mesh(new THREE.BoxGeometry(.046,.05,.012),matStipple); tgFront.position.set(0,-.06,-.035); g.add(tgFront);
  const tgBot=new THREE.Mesh(new THREE.BoxGeometry(.046,.012,.075),matStipple); tgBot.position.set(0,-.083,.0); g.add(tgBot);
  const trig=new THREE.Mesh(new THREE.BoxGeometry(.018,.032,.008),matBlack); trig.position.set(0,-.05,.004); g.add(trig);
  const blade=new THREE.Mesh(new THREE.BoxGeometry(.005,.028,.004),matSight); blade.position.set(0,-.05,-.001); g.add(blade);
  const grip=new THREE.Group();
  const gripCore=new THREE.Mesh(new THREE.BoxGeometry(.052,.21,.10),matStipple); grip.add(gripCore);
  for(const sx of [.028,-.028]){
    const panel=new THREE.Mesh(new THREE.BoxGeometry(.003,.18,.085),matStipple);
    panel.position.set(sx,0,0); grip.add(panel);
  }
  const tail=new THREE.Mesh(new THREE.BoxGeometry(.05,.02,.03),matStipple);
  tail.position.set(0,.10,-.04); grip.add(tail);
  grip.position.set(0,-.15,.085); grip.rotation.x=.18; g.add(grip);
  const mag=new THREE.Mesh(new THREE.BoxGeometry(.05,.10,.095),matBlack);
  mag.position.set(0,-.30,.115); mag.rotation.x=.18; g.add(mag);
  const magFloor=new THREE.Mesh(new THREE.BoxGeometry(.054,.015,.10),matBlack);
  magFloor.position.set(0,-.355,.125); magFloor.rotation.x=.18; g.add(magFloor);
  return g;
}
// ── M4A1 — high-detail sculpt ───────────────────────────────────────────────
const _railToothGeoM = new THREE.BoxGeometry(.034,.01,.008);

function makeM4A1(){
  const g=new THREE.Group();
  const upper=new THREE.Mesh(new THREE.BoxGeometry(.05,.06,.34),matBlack);
  upper.position.set(0,.012,.02); g.add(upper);
  const lower=new THREE.Mesh(new THREE.BoxGeometry(.048,.045,.20),matPolymer);
  lower.position.set(0,-.03,.05); g.add(lower);
  const fwdAssist=new THREE.Mesh(new THREE.CylinderGeometry(.01,.01,.02,8),matBlack);
  fwdAssist.rotation.z=Math.PI/2; fwdAssist.position.set(.028,.018,.14); g.add(fwdAssist);
  const port=new THREE.Mesh(new THREE.BoxGeometry(.01,.025,.05),matSteel);
  port.position.set(.027,.01,.05); g.add(port);
  const handle=new THREE.Mesh(new THREE.BoxGeometry(.025,.045,.16),matBlack);
  handle.position.set(0,.07,.0); g.add(handle);
  const hUp1=new THREE.Mesh(new THREE.BoxGeometry(.025,.025,.02),matBlack); hUp1.position.set(0,.045,-.06); g.add(hUp1);
  const hUp2=new THREE.Mesh(new THREE.BoxGeometry(.025,.025,.02),matBlack); hUp2.position.set(0,.045,.06); g.add(hUp2);
  const rearAperture=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.012,10),matBlack);
  rearAperture.rotation.z=Math.PI/2; rearAperture.position.set(0,.075,.07); g.add(rearAperture);
  const brl=new THREE.Mesh(new THREE.CylinderGeometry(.013,.013,.40,12),matSteel);
  brl.rotation.x=Math.PI/2; brl.position.set(0,.02,-.40); g.add(brl);
  const fh=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.06,12),matBlack);
  fh.rotation.x=Math.PI/2; fh.position.set(0,.02,-.62); g.add(fh);
  for(let i=0;i<3;i++){
    const slot=new THREE.Mesh(new THREE.BoxGeometry(.04,.006,.006),matSteel);
    slot.position.set(0,.02,-.61-i*.012); g.add(slot);
  }
  const fsBase=new THREE.Mesh(new THREE.BoxGeometry(.03,.04,.04),matBlack); fsBase.position.set(0,.045,-.46); g.add(fsBase);
  const wingL=new THREE.Mesh(new THREE.BoxGeometry(.008,.05,.008),matBlack); wingL.position.set(.012,.06,-.46); wingL.rotation.z=.4; g.add(wingL);
  const wingR=new THREE.Mesh(new THREE.BoxGeometry(.008,.05,.008),matBlack); wingR.position.set(-.012,.06,-.46); wingR.rotation.z=-.4; g.add(wingR);
  const fsTop=new THREE.Mesh(new THREE.BoxGeometry(.01,.012,.012),matSteel); fsTop.position.set(0,.085,-.46); g.add(fsTop);
  const swivel=new THREE.Mesh(new THREE.TorusGeometry(.012,.004,6,10),matBlack);
  swivel.rotation.y=Math.PI/2; swivel.position.set(0,-.01,-.46); g.add(swivel);
  const hand=new THREE.Mesh(new THREE.BoxGeometry(.046,.046,.20),matBlack);
  hand.position.set(0,.02,-.24); g.add(hand);
  for(let i=0;i<7;i++){
    const t=new THREE.Mesh(_railToothGeoM,matBlack);
    t.position.set(0,.045,-.32+i*.024); g.add(t);
    const ts=new THREE.Mesh(new THREE.BoxGeometry(.008,.01,.034),matBlack);
    ts.position.set(.024,.02,-.32+i*.024); g.add(ts);
    const ts2=ts.clone(); ts2.position.x=-.024; g.add(ts2);
  }
  const mag=new THREE.Mesh(new THREE.BoxGeometry(.04,.14,.058),matBlack);
  mag.position.set(0,-.12,.04); mag.rotation.x=-.04; g.add(mag);
  const magFloor=new THREE.Mesh(new THREE.BoxGeometry(.044,.014,.06),matBlack);
  mag.add(magFloor); magFloor.position.set(0,-.078,0);
  const grp=new THREE.Mesh(new THREE.BoxGeometry(.038,.11,.05),matPolymer);
  grp.position.set(0,-.085,.15); grp.rotation.x=.28; g.add(grp);
  const tg=new THREE.Mesh(new THREE.BoxGeometry(.036,.012,.05),matBlack); tg.position.set(0,-.052,.10); g.add(tg);
  const trig=new THREE.Mesh(new THREE.BoxGeometry(.012,.028,.008),matSteel); trig.position.set(0,-.04,.11); g.add(trig);
  const tube=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.20,10),matBlack);
  tube.rotation.x=Math.PI/2; tube.position.set(0,-.005,.26); g.add(tube);
  const stockBody=new THREE.Mesh(new THREE.BoxGeometry(.05,.075,.10),matPolymer);
  stockBody.position.set(0,-.02,.34); g.add(stockBody);
  const butt=new THREE.Mesh(new THREE.BoxGeometry(.05,.12,.025),matPolymer);
  butt.position.set(0,-.03,.40); butt.rotation.x=-.12; g.add(butt);
  const stockTop=new THREE.Mesh(new THREE.BoxGeometry(.02,.018,.12),matPolymer);
  stockTop.position.set(0,.02,.33); g.add(stockTop);
  return g;
}


// ── GLB WEAPON LOADER ───────────────────────────────────────────────────────
// Same approach as the operator: one GLTFLoader, models cached by key. Each is
// measured after loading and fitted automatically, because an exported model
// can arrive at any scale or facing any direction.
const gunModels  = {};        // key -> fitted THREE.Group ready to parent to the camera
const gunOffsets = {};        // key -> [x,y,z] hand position
const _gunLoading = {};
const _weaponLoader = new GLTFLoader();
// null until the first model finishes loading — every use site guards for it
let playerGun = null;

// Hand position by class — only across and down. X is flipped by the
// viewmodel setting.
const HAND_POS = {
  melee:   [ .26, -.22 ],
  pistols: [ .24, -.22 ],
  smgs:    [ .26, -.23 ],
  rifles:  [ .27, -.24 ],
  snipers: [ .27, -.24 ],
};
// Depth is derived, not hand-tuned. Models are centred on their origin, so a
// long gun placed at a fixed z pushes its stock toward the camera — an AK at
// the old -0.48 put its rear at 0.13, inside the 0.2 near plane, and it was
// being sliced off. Placing every weapon so its REAR sits at 0.24 keeps the
// whole model in front of the near plane no matter how long it is.
const GRIP_DEPTH = 0.24;
for(const k in GUNS){
  const xy = HAND_POS[GUNS[k].category] || [.26, -.23];
  gunOffsets[k] = [ xy[0], xy[1], -(GRIP_DEPTH + (WEAPON_LEN[k] || 0.5) / 2) ];
}

// Measure the model, put its longest axis down -Z, centre it, and scale it to
// the target length. This is what makes the import work without knowing how
// the artist exported it.
function fitWeaponModel(root, key){
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(), centre = new THREE.Vector3();
  box.getSize(size); box.getCenter(centre);

  const axes = [['x',size.x],['y',size.y],['z',size.z]].sort((a,b)=>b[1]-a[1]);
  const longAxis = axes[0][0], longLen = Math.max(1e-6, axes[0][1]);

  // SUBTRACT: `centre` is world space and already contains root.position, so
  // assigning -centre would leave the model offset by its original position.
  root.position.sub(centre);

  const align = new THREE.Group();
  align.add(root);
  if(longAxis === 'x') align.rotation.y =  Math.PI/2;   // X barrel -> Z
  if(longAxis === 'y') align.rotation.x = -Math.PI/2;   // Y barrel -> Z

  const fix = WEAPON_FIX[key] || {};
  if(fix.flip) align.rotation.y += Math.PI;
  if(fix.rot){ align.rotation.x += fix.rot[0]; align.rotation.y += fix.rot[1]; align.rotation.z += fix.rot[2]; }

  align.userData.baseX = align.rotation.x;
  align.userData.baseY = align.rotation.y;
  align.userData.baseZ = align.rotation.z;

  const scaler = new THREE.Group();
  scaler.add(align);
  const fitScale = ((WEAPON_LEN[key] || 0.5) / longLen) * (fix.scale || 1);
  scaler.scale.setScalar(fitScale);
  align.userData.fitScale = fitScale;

  // Outermost adjustable rotation. Kept separate from `align` so the values in
  // the F6 panel are genuine world-space angles rather than being folded into
  // the auto-fit's Euler, where a 90 degree input could come out as anything.
  const spin = new THREE.Group();
  spin.add(scaler);

  const holder = new THREE.Group();
  holder.add(spin);
  holder.userData.spin = spin;
  holder.userData.scaler = scaler;
  if(fix.pos) scaler.position.set(fix.pos[0], fix.pos[1], fix.pos[2]);

  console.log('fit', key, '| long axis', longAxis,
              '| base yaw', (align.rotation.y*180/Math.PI).toFixed(0) + String.fromCharCode(176),
              '| base pitch', (align.rotation.x*180/Math.PI).toFixed(0) + String.fromCharCode(176));

  holder.traverse(o => {
    if(o.isMesh){
      o.castShadow = false;        // a viewmodel casting shadows is wasted work
      o.frustumCulled = false;     // it sits on the camera, never cull it
      if(o.material) o.material.side = THREE.FrontSide;
    }
  });
  holder.userData.tris = (() => {
    let t = 0;
    holder.traverse(o => { if(o.isMesh && o.geometry){
      const g=o.geometry; t += (g.index ? g.index.count : g.attributes.position.count)/3; } });
    return Math.round(t);
  })();
  return holder;
}

// ── BULLET MODEL ────────────────────────────────────────────────────────────
const BULLET_FILE    = 'Meshy_AI_bullet_0728061523_texture.glb';
const BULLET_FLIP    = false;  // set true if the round flies tail-first
// Rounds are drawn at their true size. At 5x speed they cross ~30 units
// between frames, so they are only on screen for a frame or two — which is
// realistic, but means you barely see the model. Raise this to stretch each
// round along its flight path into a visible tracer streak (6 is a good start).
const BULLET_STRETCH = 1;

let bulletModel = null;   // { geo, mat } normalised to length 1 along -Z

function fitBulletModel(root){
  root.updateMatrixWorld(true);
  const geos = []; let mat = null;
  root.traverse(o => {
    if(!o.isMesh || !o.geometry) return;
    let g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for(const n of Object.keys(g.attributes))
      if(n !== 'position' && n !== 'normal' && n !== 'uv') g.deleteAttribute(n);
    if(!g.attributes.normal) g.computeVertexNormals();
    if(!g.attributes.uv)
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2), 2));
    geos.push(g);
    if(!mat) mat = o.material;
  });
  if(!geos.length) return null;

  let geo = geos[0];
  if(geos.length > 1){
    try { geo = mergeGeometries(geos, false) || geos[0]; } catch(e){ geo = geos[0]; }
  }

  // centre, point the long axis down -Z, then normalise that axis to length 1
  geo.computeBoundingBox();
  const size = new THREE.Vector3(), ctr = new THREE.Vector3();
  geo.boundingBox.getSize(size); geo.boundingBox.getCenter(ctr);
  geo.translate(-ctr.x, -ctr.y, -ctr.z);

  const axes = [['x',size.x],['y',size.y],['z',size.z]].sort((a,b)=>b[1]-a[1]);
  if(axes[0][0] === 'x') geo.rotateY(Math.PI/2);
  if(axes[0][0] === 'y') geo.rotateX(-Math.PI/2);
  if(BULLET_FLIP) geo.rotateY(Math.PI);

  geo.computeBoundingBox();
  const s2 = new THREE.Vector3(); geo.boundingBox.getSize(s2);
  const len = Math.max(1e-6, s2.z);
  geo.scale(1/len, 1/len, 1/len);
  geo.computeBoundingSphere();

  let tris = geo.index ? geo.index.count/3 : geo.attributes.position.count/3;
  console.log('bullet model loaded:', Math.round(tris).toLocaleString(), 'tris');
  return { geo, mat: mat || new THREE.MeshStandardMaterial({ color:0xb87333, metalness:0.95, roughness:0.35 }) };
}

function loadBullet(){
  // The bullet model is no longer drawn (tracers show each shot instead), so
  // it is not downloaded at all.
  return;
  _weaponLoader.load(BULLET_FILE,
    gltf => { bulletModel = fitBulletModel(gltf.scene); },
    undefined,
    err => console.warn('bullet model failed to load, using the built-in round:',
                        BULLET_FILE, err && err.message));
}

function loadWeapon(key, onReady){
  if(gunModels[key]){ onReady && onReady(gunModels[key]); return; }
  const file = WEAPON_FILES[key];
  if(!file){ onReady && onReady(null); return; }
  if(_gunLoading[key]){ _gunLoading[key].push(onReady); return; }
  _gunLoading[key] = [onReady];
  _weaponLoader.load(file, gltf => {
    const fitted = fitWeaponModel(gltf.scene, key);
    gunModels[key] = fitted;
    applyLiveRotation();
    console.log('weapon loaded:', key, fitted.userData.tris.toLocaleString(), 'tris');
    for(const cb of _gunLoading[key]) cb && cb(fitted);
    delete _gunLoading[key];
  }, undefined, err => {
    console.warn('weapon failed to load:', key, file, err && err.message);
    for(const cb of _gunLoading[key]) cb && cb(null);
    delete _gunLoading[key];
  });
}

// Spawn pistol first so the player is never empty-handed, then the rest in the
// background so opening the shop does not stall on a download.
function preloadWeapons(){
  loadBullet();
  loadWeapon('glock18', () => { if(selectedGunKey === 'glock18') equipGun('glock18'); });
  loadWeapon('knife');
  let i = 0;
  const rest = Object.keys(WEAPON_FILES).filter(k => k !== 'glock18' && k !== 'knife');
  (function next(){
    if(i >= rest.length) return;
    loadWeapon(rest[i++], () => setTimeout(next, 60));
  })();
}

// ── VIEWMODEL ADJUST MODE (F6) ──────────────────────────────────────────────
// The fit is automatic, but a whole export batch usually shares one convention,
// so a single rotation normally corrects every weapon at once. GLOBAL mode
// edits that shared offset; PER-GUN mode overrides one weapon on top of it.
const VIEWMODEL_YAW_DEG = 180;  // <<< the only number you should need to touch
const VIEW_ROT_GLOBAL = { x:0, y:VIEWMODEL_YAW_DEG * Math.PI/180, z:0 };

function applyLiveRotation(){
  for(const key in gunModels){
    const spin = gunModels[key] && gunModels[key].userData.spin;
    if(!spin) continue;
    const per = (WEAPON_FIX[key] && WEAPON_FIX[key].rot) || [0,0,0];
    spin.rotation.set(
      VIEW_ROT_GLOBAL.x + per[0],
      VIEW_ROT_GLOBAL.y + per[1],
      VIEW_ROT_GLOBAL.z + per[2]
    );
  }
}

let _adjust = false, _adjustGlobal = true;
const _adjPanel = document.createElement('div');
_adjPanel.style.cssText =
  'position:absolute;top:50%;left:26px;transform:translateY(-50%);z-index:150;display:none;' +
  'font:600 12px/1.6 ui-monospace,monospace;color:#f0dcae;white-space:pre;' +
  'background:rgba(14,10,6,0.88);border:1px solid rgba(217,178,90,.45);' +
  'border-radius:5px;padding:12px 15px;pointer-events:none;';
document.body.appendChild(_adjPanel);

function drawAdjPanel(){
  if(!_adjust){ _adjPanel.style.display='none'; return; }
  const holder = gunModels[selectedGunKey];
  const scaler = holder && holder.userData.scaler;
  const align  = scaler && scaler.children[0];
  const r = n => (n>=0?' ':'') + n.toFixed(2);
  const deg = n => (n*180/Math.PI).toFixed(0).padStart(4) + '\u00b0';
  _adjPanel.style.display='block';
  _adjPanel.textContent =
    'VIEWMODEL ADJUST      [F6] close\n' +
    '--------------------------------\n' +
    'editing   ' + (_adjustGlobal ? 'ALL WEAPONS' : selectedGunKey.toUpperCase()) + '   [G] switch\n' +
    'weapon    ' + selectedGunKey + '\n\n' +
    'yaw       ' + deg(VIEW_ROT_GLOBAL.y) + '   left / right\n' +
    'pitch     ' + deg(VIEW_ROT_GLOBAL.x) + '   up / down\n' +
    'roll      ' + deg(VIEW_ROT_GLOBAL.z) + '   [ / ]\n' +
    '          hold SHIFT for 90' + String.fromCharCode(176) + ' jumps\n' +
    'scale     ' + (align ? r(scaler.scale.x/(align.userData.fitScale||1)) : ' -- ') + '   PgUp / PgDn\n' +
    'offset    ' + (holder ? r(holder.position.x)+' '+r(holder.position.y)+' '+r(holder.position.z) : '--') + '\n' +
    '          J/L  I/K  U/O\n\n' +
    '[Enter] print config to console';
}

addEventListener('keydown', e => {
  if(e.code === 'F6'){
    _adjust = !_adjust; drawAdjPanel();
    if(_adjust) console.log('viewmodel adjust ON — see the on-screen panel');
    e.preventDefault(); return;
  }
  if(!_adjust) return;
  const holder = gunModels[selectedGunKey];
  const scaler = holder && holder.userData.scaler;
  const align  = scaler && scaler.children[0];
  const S = e.shiftKey ? Math.PI/2 : 0.0873;   // 90 deg with shift, else 5 deg
  const T = { y:0, x:0, z:0 };
  let handled = true;

  switch(e.code){
    case 'ArrowLeft':    T.y = -S; break;
    case 'ArrowRight':   T.y =  S; break;
    case 'ArrowUp':      T.x = -S; break;
    case 'ArrowDown':    T.x =  S; break;
    case 'BracketLeft':  T.z = -S; break;
    case 'BracketRight': T.z =  S; break;
    case 'KeyG': _adjustGlobal = !_adjustGlobal; break;
    case 'PageUp':   if(scaler) scaler.scale.multiplyScalar(1.05); break;
    case 'PageDown': if(scaler) scaler.scale.multiplyScalar(0.952); break;
    case 'KeyJ': if(holder) holder.position.x -= 0.02; break;
    case 'KeyL': if(holder) holder.position.x += 0.02; break;
    case 'KeyU': if(holder) holder.position.y += 0.02; break;
    case 'KeyO': if(holder) holder.position.y -= 0.02; break;
    case 'KeyI': if(holder) holder.position.z -= 0.02; break;
    case 'KeyK': if(holder) holder.position.z += 0.02; break;
    case 'Enter': {
      const d = n => +n.toFixed(4);
      console.log('%c--- paste near the top of the file ---', 'color:#d9b25a');
      console.log('const VIEW_ROT_GLOBAL = { x:' + d(VIEW_ROT_GLOBAL.x) +
                  ', y:' + d(VIEW_ROT_GLOBAL.y) + ', z:' + d(VIEW_ROT_GLOBAL.z) + ' };');
      const fixes = Object.keys(WEAPON_FIX).filter(k => WEAPON_FIX[k] && WEAPON_FIX[k].rot);
      if(fixes.length){
        console.log('const WEAPON_FIX = {');
        for(const k of fixes){
          const r0 = WEAPON_FIX[k].rot;
          console.log('  ' + k + ': { rot:[' + d(r0[0]) + ', ' + d(r0[1]) + ', ' + d(r0[2]) + '] },');
        }
        console.log('};');
      }
      break;
    }
    default: handled = false;
  }

  if(T.x || T.y || T.z){
    if(_adjustGlobal){
      VIEW_ROT_GLOBAL.x += T.x; VIEW_ROT_GLOBAL.y += T.y; VIEW_ROT_GLOBAL.z += T.z;
    } else {
      const f = WEAPON_FIX[selectedGunKey] = WEAPON_FIX[selectedGunKey] || {};
      f.rot = f.rot || [0,0,0];
      f.rot[0] += T.x; f.rot[1] += T.y; f.rot[2] += T.z;
    }
    applyLiveRotation();
  }
  drawAdjPanel();
  if(handled) e.preventDefault();
});

const flashLight=new THREE.PointLight(0xff8800,0,1);flashLight.position.set(.28,-.22,-.6);camera.add(flashLight);
