// ── INPUT ──────────────────────────────────────────────────────────────────
document.getElementById('start-btn').addEventListener('click',()=>{
  money = Math.max(money, START_MONEY);   // never stranded without a buy
  equipGun(selectedGunKey);
  updateHUD(); updateMoneyUI(); updateSlotUI();
  document.body.requestPointerLock();
});

// ── MONEY + SHOP UI ─────────────────────────────────────────────────────────
function updateMoneyUI(){
  const m = document.getElementById('cs-money');
  if(m) m.innerText = '$' + money;
  const sm = document.getElementById('shop-money');
  if(sm) sm.innerText = '$' + money;
}
function addMoney(amount){
  money += amount;
  updateMoneyUI();
}
// Swap the equipped weapon (model + stats), preserving full mag on swap.
function equipGun(key){
  if(!owned[key]) return;
  if(isScoped) setScoped(false);
  selectedGunKey = key;
  gun = {...GUNS[key]};
  maxAmmo = gun.maxAmmo;
  syncAmmoIn();
  if(playerGun) camera.remove(playerGun);
  playerGun = gunModels[key] || null;
  if(playerGun){
    playerGun.position.set(...gunOffsets[key]);
    playerGun.visible = !playerInCar;
    camera.add(playerGun);
    applyViewmodel();
  } else {
    // Still downloading: the stats and ammo are live immediately, and the
    // model slots into the hand as soon as it arrives.
    loadWeapon(key, m => { if(m && selectedGunKey === key) equipGun(key); });
  }
  updateHUD();
}

// ── GROUND-DROPPED GUN PICKUPS ──────────────────────────────────────────────
const droppedGuns = [];   // { key, mesh, x, z, canPickAt }
function makeGunPickup(key, x, z){
  const proto = gunModels[key];
  if(!proto) return;                             // not downloaded yet
  const mesh = proto.clone();
  mesh.position.set(x, 0.10, z);                 // resting on the floor
  // Lay it on its side, random heading. The models are already fitted to real
  // world size by the loader, so no extra scaling here.
  mesh.rotation.set(0, Math.random()*Math.PI*2, Math.PI/2);
  mesh.visible = true;
  mesh.traverse(o => { if(o.isMesh) o.frustumCulled = true; });
  scene.add(mesh);
  // Can't be picked up for 1s after dropping, so it won't instantly re-grab.
  droppedGuns.push({ key, mesh, x, z, canPickAt: performance.now() + 1000 });
}
function dropGun(key, x, z){
  if(!key) return;
  // Drop it well clear of the player so you're not standing on it.
  const a = Math.random()*Math.PI*2;
  makeGunPickup(key, x + Math.cos(a)*3.0, z + Math.sin(a)*3.0);
}

// Put a gun into its slot, dropping whatever was there, and equip it.
function acquireGun(key){
  const s = slotForGun(key);
  const prev = slots[s];
  if(prev && prev !== key){
    owned[prev] = false;                         // no longer owned (it's on the ground)
    dropGun(prev, camera.position.x, camera.position.z);
  }
  slots[s] = key;
  owned[key] = true;
  initAmmo(key);                 // a bought weapon comes with its full spares
  activeSlot = s;
  equipGun(key);
  updateSlotUI();
}

// Switch to a slot by number key (only if it holds a gun).
function switchToSlot(s){
  if(playerInCar) return;
  const key = slots[s];
  if(!key) return;                 // empty slot (e.g. slot 1 knife) — ignore for now
  activeSlot = s;
  equipGun(key);
  updateSlotUI();
}

// Check if the player is standing on a dropped gun; if so, pick it up.
// Guns just dropped have a short "settle" delay + a no-instant-regrab guard so
// picking one up can't immediately re-trigger on the gun it drops in its place.
function checkGunPickups(){
  if(playerInCar) return;
  const now = performance.now();
  const px = camera.position.x, pz = camera.position.z;
  const PICKUP_R2 = 2.0 * 2.0;
  for(let i = droppedGuns.length - 1; i >= 0; i--){
    const dg = droppedGuns[i];
    if(now < dg.canPickAt) continue;        // still settling — not grabbable yet
    const dx = px - dg.x, dz = pz - dg.z;
    if(dx*dx + dz*dz < PICKUP_R2){
      scene.remove(dg.mesh);
      droppedGuns.splice(i, 1);
      acquireGun(dg.key);
      break;                                 // one pickup per frame
    }
  }
}

const shopEl = document.getElementById('shop');
function renderShop(){
  const list = document.getElementById('shop-list');
  list.innerHTML = '';
  const CATEGORIES = [
    {key:'melee',   label:'MELEE'},
    {key:'pistols', label:'PISTOLS'},
    {key:'smgs',    label:'SMGs'},
    {key:'rifles',  label:'RIFLES'},
    {key:'snipers', label:'SNIPERS'},
  ];
  // Bars are scaled against the best value in the arsenal so they compare
  // weapons against each other rather than against an arbitrary maximum.
  const all = Object.keys(GUNS);
  const maxDmg = Math.max(...all.map(k => GUNS[k].damage));
  const maxAmmo = Math.max(...all.map(k => GUNS[k].maxAmmo)) || 1;
  const RATE = { Melee:0.35, Slow:0.25, Bolt:0.15, Fast:0.7, Auto:1 };
  const RANGE = { Contact:0.12, Short:0.35, Medium:0.6, Long:0.85, Extreme:1 };

  for(const cat of CATEGORIES){
    const keys = all.filter(k => GUNS[k].category === cat.key)
                    .sort((a,b) => GUNS[a].order - GUNS[b].order);
    if(!keys.length) continue;
    const h = document.createElement('div');
    h.className = 'shop-section-header'; h.innerHTML = '<span>' + cat.label + '</span>';
    list.appendChild(h);
    const row = document.createElement('div');
    row.className = 'shop-section-row';
    list.appendChild(row);

    for(const key of keys){
      const g = GUNS[key];
      const isOwned = !!owned[key];
      const isEquipped = selectedGunKey === key;
      const afford = money >= g.price;
      const card = document.createElement('div');
      card.className = 'shop-card' + (isEquipped ? ' equipped-card' : (isOwned ? ' owned' : ''));

      const priceTxt = isOwned ? 'OWNED' : (g.price === 0 ? 'FREE' : '$' + g.price.toLocaleString());
      const priceCls = isOwned ? 'owned' : (afford ? '' : 'cant');

      let btn;
      if(isEquipped)      btn = '<button class="sc-btn equipped" disabled>EQUIPPED</button>';
      else if(isOwned)    btn = '<button class="sc-btn equip" data-action="equip" data-gun="' + key + '">EQUIP</button>';
      else                btn = '<button class="sc-btn buy' + (afford ? '' : ' locked') + '" data-action="buy" data-gun="' + key + '"' + (afford ? '' : ' disabled') + '>BUY</button>';

      const bar = (label, frac) =>
        '<div class="sc-bar"><span>' + label + '</span><i><b style="width:' +
        Math.round(Math.max(0.04, Math.min(1, frac)) * 100) + '%"></b></i></div>';

      card.innerHTML =
        '<div class="sc-top"><span class="sc-name">' + g.name + '</span>' +
        '<span class="sc-price ' + priceCls + '">' + priceTxt + '</span></div>' +
        '<div class="sc-cat">' + cat.label + '</div>' +
        '<div class="sc-bars">' +
          bar('DMG',  g.damage / maxDmg) +
          bar('RATE', RATE[g.rpm] != null ? RATE[g.rpm] : 0.5) +
          bar('RNGE', RANGE[g.range] != null ? RANGE[g.range] : 0.5) +
        '</div>' +
        '<div class="sc-meta"><span>' + (g.melee ? 'MELEE'
            : g.maxAmmo + '+' + ((g.spareMags||0) * g.ammo)) + '</span>' +
        '<span>' + g.rpm + '</span><span>' + g.range + '</span></div>' +
        btn;
      row.appendChild(card);
    }
  }

  list.querySelectorAll('.sc-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.gun;
      if(btn.dataset.action === 'buy'){
        if(money >= GUNS[key].price && !owned[key]){
          addMoney(-GUNS[key].price);
          owned[key] = true;
          acquireGun(key);
          // NET HOOK — spend locally so the UI is instant, then tell the server,
          // which is the record of truth and will push back a corrected figure.
          if(typeof netReportBuy === 'function') netReportBuy(key, GUNS[key].price);
          renderShop();
        }
      } else {
        equipGun(key);
        renderShop();
      }
    });
  });
}
function openShop(){
  // NET HOOK — in a match the shop is only open during buy time. Single-player
  // has no netCanBuy defined, so this is a no-op there.
  if(typeof netCanBuy === 'function' && !netCanBuy()) return;
  renderShop();
  updateMoneyUI();
  shopEl.style.display = 'flex';
  if(document.pointerLockElement) document.exitPointerLock();
}
function closeShop(){
  shopEl.style.display = 'none';
  // If a game is in progress (player already deployed), re-lock the pointer.
  const menuOpen = document.getElementById('instructions').style.display === 'flex';
  if(!menuOpen) document.body.requestPointerLock();
}
document.getElementById('shop-btn').addEventListener('click', openShop);
document.getElementById('shop-close').addEventListener('click', closeShop);
document.addEventListener('pointerlockchange',()=>{
  // Don't force the menu open just because the shop grabbed the pointer.
  const shopOpen = document.getElementById('shop').style.display === 'flex';
  if(!shopOpen){
    document.getElementById('instructions').style.display = document.pointerLockElement ? 'none' : 'flex';
  }
  if(!document.pointerLockElement) setScoped(false);
});
document.addEventListener('mousemove',e=>{
  if(!document.pointerLockElement) return;
  yaw-=e.movementX*0.002*mouseSens; pitch-=e.movementY*0.002*mouseSens;
  // Allow looking down further when driving (for chase cam comfort)
  // On foot: let the player look almost straight down to see their own body.
  const pitchMin = playerInCar ? -1.0 : -1.45;   // ~ -83° down on foot
  const pitchMax = playerInCar ?  0.5 :  1.45;   // ~ +83° up
  pitch=Math.max(pitchMin,Math.min(pitchMax,pitch));
  // Camera basis is updated each frame, not here
});
window.addEventListener('keydown',e=>{
  keys[e.code]=true;
  // 1/2/3: switch weapon slots
  if(e.code==='Digit1'){ switchToSlot(1); return; }
  if(e.code==='Digit2'){ switchToSlot(2); return; }
  if(e.code==='Digit3'){ switchToSlot(3); return; }
  // B: toggle shop (works during play)
  if(e.code==='KeyB'){
    const shopOpen = document.getElementById('shop').style.display === 'flex';
    const menuOpen = document.getElementById('instructions').style.display === 'flex';
    if(!menuOpen){ shopOpen ? closeShop() : openShop(); }
    return;
  }
  // E is unbound — there are no vehicles on this map.
  // V: toggle debug third-person view
  if(e.code==='KeyV' && !playerInCar){
    thirdPerson = !thirdPerson;
    if(thirdPerson){
      // entering 3rd person: remember where the player is standing
      _playerGroundPos.copy(camera.position);
    } else {
      // returning to 1st person: put the camera back at the player's eye spot
      camera.position.copy(_playerGroundPos);
    }
    return;
  }
  if(playerInCar) return; // suppress other on-foot bindings while driving
  if(e.code==='Space'&&isGrounded){verticalVelocity=jumpPower;isGrounded=false;}
  if(e.code==='KeyR') startReload();
});
window.addEventListener('keyup',e=>{keys[e.code]=false;});

let _lastShotTime = 0;
const _meleeDir = new THREE.Vector3();   // reused; a swing must not allocate
function doShoot() {
  if(!document.pointerLockElement||playerInCar) return;
  // NET HOOK — no shooting while frozen in the buy phase, between rounds, or
  // once you are dead and spectating.
  if(typeof netCanShoot === 'function' && !netCanShoot()) return;
  if(gun.melee){
    const nowT = performance.now();
    if(nowT - _lastShotTime < (gun.fireInterval||420)) return;
    _lastShotTime = nowT;
    gunRecoilZ = gun.recoilZ; gunRecoilY = gun.recoilY;
    playGunshot();

    // A forgiving cone rather than a ray — a knife swing that demands pixel
    // aim feels broken. But it is now bounded VERTICALLY too: the old test was
    // horizontal distance plus a facing dot, so you could stab someone standing
    // on a roof three units over your head.
    const MELEE_REACH = 2.2;
    const MELEE_ARC   = 0.55;      // dot product; ~57 degrees either side
    const dir = _meleeDir.set(0, 0, -1).applyQuaternion(camera.quaternion);

    // Nearest valid target, not simply the first one in the array.
    let best = null, bestD = Infinity;
    for(let j = enemies.length - 1; j >= 0; j--){
      const e = enemies[j];
      const dx = e.position.x - camera.position.x;
      const dz = e.position.z - camera.position.z;
      const d = Math.hypot(dx, dz);
      if(d > MELEE_REACH || d > bestD) continue;
      if(d > 1e-4 && (dx/d)*dir.x + (dz/d)*dir.z < MELEE_ARC) continue;
      // Vertical gate: your eye has to be somewhere alongside their body.
      // Generous enough to stab up or down a step, not up onto a roof.
      const h = e.userData.height || 1.81;
      if(camera.position.y < e.position.y - 1.0)     continue;
      if(camera.position.y > e.position.y + h + 0.6) continue;
      best = e; bestD = d;
    }

    if(best){
      // Melee ignores the zone multipliers on purpose — a knife is a knife
      // wherever it lands, and 90 x 4 for a head hit would be absurd.
      const dmg = gun.damage;
      if(best.userData.isRemote){
        netReportHit(best.userData.netId, dmg, 'melee');
        playHit();
      } else {
        best.userData.hp -= dmg; playHit();
        if(best.userData.hp <= 0){
          scene.remove(best);
          const k = enemies.indexOf(best);
          if(k >= 0) enemies.splice(k, 1);
          kills++; addMoney(KILL_REWARD); playKill(); updateHUD();
        }
      }
    }
    return;
  }
  if(isReloading||ammo<=0) return;
  if(gun.fireInterval){
    const nowT = performance.now();
    if(nowT - _lastShotTime < gun.fireInterval) return;
    _lastShotTime = nowT;
  }
  ammo--; syncAmmoOut(); updateHUD();
  gunRecoilZ=gun.recoilZ; gunRecoilY=gun.recoilY;
  playShootSound();
  flashLight.intensity=5; setTimeout(()=>flashLight.intensity=0,60);
  if(!gun._geo){
    // Real bullet: a copper round — cylinder body + pointed ogive tip, aligned to travel (-Z).
    const r = gun.bulletSize * 1.1;
    const body = new THREE.CylinderGeometry(r, r, gun.bulletSize*2.4, 10);
    const tip  = new THREE.ConeGeometry(r, gun.bulletSize*2.0, 10);
    tip.translate(0, gun.bulletSize*2.2, 0);                 // tip sits on the front of the body
    gun._geo = mergeGeometries([body, tip], false) || body;  // combined bullet shape
    gun._geo.rotateX(-Math.PI/2);                            // lay it along -Z (direction of travel)
    gun._mat = new THREE.MeshStandardMaterial({
      color: 0xb87333, metalness: 0.95, roughness: 0.35, envMapIntensity: 1.2  // copper
    });
  }
  for(let p=0;p<gun.pellets;p++){
    let bm;
    if(bulletModel){
      bm = new THREE.Mesh(bulletModel.geo, bulletModel.mat);
      const L = gun.bulletSize * 4.4;             // same overall length as the built-in round
      bm.scale.set(L, L, L * BULLET_STRETCH);
      bm.frustumCulled = false;
    } else {
      bm = new THREE.Mesh(gun._geo, gun._mat);
    }
    const muzzleOffset=new THREE.Vector3(0.28,-0.18,-0.6);
    muzzleOffset.applyQuaternion(camera.quaternion);
    bm.position.copy(camera.position).add(muzzleOffset);
    const spread = gun.spread + bloom * 0.05;
    bloom = Math.min(BLOOM_MAX, bloom + (gun.pellets>1 ? 0.25 : 0.18));
    camShake = Math.min(0.5, camShake + gun.recoilZ * 0.9 + 0.12);
    gunKickPitch = Math.min(0.18, gunKickPitch + gun.recoilY + 0.04);
    const dir=new THREE.Vector3(
      (Math.random()-0.5)*spread,
      (Math.random()-0.5)*spread,
      -1
    ).normalize().applyQuaternion(camera.quaternion).normalize();
    bm.userData={vel:dir.multiplyScalar(gun.bulletSpeed), life:0, damage:gun.damage, headshotDamage:gun.headshotDamage||0};
    scene.add(bm); playerBullets.push(bm);
    // NET HOOK — cosmetic only. Everyone else gets a tracer and a gunshot from
    // our position; the damage travels separately, as a claimed hit.
    if(typeof netReportShot === 'function') netReportShot(bm.position, dir);
  }
  if(ammo===0) startReload();
}

let mouseHeld=false, autoFireInterval=null;

document.addEventListener('mousedown',e=>{
  if(!document.pointerLockElement) return;
  if(playerInCar) return; // no shooting from car
  if(e.button===2){
    // Right-click: toggle scope ON for guns with scopeFov
    e.preventDefault();
    setScoped(true);
    return;
  }
  if(e.button!==0) return;
  mouseHeld=true;
  doShoot();
  // Any weapon marked Auto keeps firing; the cycle time is per weapon.
  const AUTO_CYCLE = { glock18:90, mac10:70, mp5:80, mp7:75, ump45:95, ak47:110, m4a1:100 };
  if(gun.rpm === 'Auto'){
    const cycle = AUTO_CYCLE[selectedGunKey] || 100;
    autoFireInterval=setInterval(()=>{
      if(!mouseHeld||ammo<=0||isReloading){ clearInterval(autoFireInterval); autoFireInterval=null; return; }
      doShoot();
    }, cycle);
  }
});

document.addEventListener('mouseup',e=>{
  if(e.button===2){
    setScoped(false);
    return;
  }
  if(e.button!==0) return;
  mouseHeld=false;
  if(autoFireInterval){ clearInterval(autoFireInterval); autoFireInterval=null; }
});

window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

// Enemy bullets: real copper rounds, same style as player bullets.
const _eBulletGeo = (()=>{
  const r = 0.05 * 1.1;
  const body = new THREE.CylinderGeometry(r, r, 0.05*2.4, 10);
  const tip  = new THREE.ConeGeometry(r, 0.05*2.0, 10);
  tip.translate(0, 0.05*2.2, 0);
  const geo = mergeGeometries([body, tip], false) || body;
  geo.rotateX(-Math.PI/2);   // nose along -Z
  return geo;
})();
const _eBulletMat = new THREE.MeshStandardMaterial({
  color: 0xb87333, metalness: 0.95, roughness: 0.35, envMapIntensity: 1.2  // copper
});

function isBlocked(fx, fy, fz, tx, ty, tz){
  const dx = tx-fx, dy = ty-fy, dz = tz-fz;
  const maxT = 1;
  const idx = dx===0 ? Infinity : 1/dx;
  const idy = dy===0 ? Infinity : 1/dy;
  const idz = dz===0 ? Infinity : 1/dz;
  _queryRegion(Math.min(fx,tx), Math.min(fz,tz), Math.max(fx,tx), Math.max(fz,tz), _nearbyLOS);
  for(let i=0;i<_nearbyLOS.length;i++){
    const b = _nearbyLOS[i];
    let tmin = (b.min.x - fx) * idx;
    let tmax = (b.max.x - fx) * idx;
    if(tmin > tmax){ const t=tmin; tmin=tmax; tmax=t; }
    let tymin = (b.min.y - fy) * idy;
    let tymax = (b.max.y - fy) * idy;
    if(tymin > tymax){ const t=tymin; tymin=tymax; tymax=t; }
    if(tmin > tymax || tymin > tmax) continue;
    if(tymin > tmin) tmin = tymin;
    if(tymax < tmax) tmax = tymax;
    let tzmin = (b.min.z - fz) * idz;
    let tzmax = (b.max.z - fz) * idz;
    if(tzmin > tzmax){ const t=tzmin; tzmin=tzmax; tzmax=t; }
    if(tmin > tzmax || tzmin > tmax) continue;
    if(tzmin > tmin) tmin = tzmin;
    if(tzmax < tmax) tmax = tzmax;
    if(tmax < 0 || tmin > maxT) continue;
    return true;
  }
  return false;
}
const _nearbyLOS = [];

// ── PLAYER CONSTANTS ───────────────────────────────────────────────────────
const playerSpeed = 0.14;

const FEET_OFFSET = 1.7;
const PLAYER_HALF = 0.35;

// Camera height ONLY. Deliberately separate from FEET_OFFSET: the physics keep
// tracking the player at 1.7 exactly as before — collision, ground snapping,
// the body placement and what we send over the network are all untouched — and
// this lifts nothing but the rendered eye to the model's head.
// 1.67 is the head/visor centre in the rig's authored units (_OPS, 60-actors.js).
const EYE_HEIGHT = 1.67 * ((typeof _OP_SCALE !== 'undefined') ? _OP_SCALE : 1);
const _playerBox = new THREE.Box3();
const STEP_UP_H = 0.55;   // anything this low is a step, not a wall
function playerCollides(x, z, feetY){
  const f = feetY || 0;
  _playerBox.min.set(x-PLAYER_HALF, f + 0.25, z-PLAYER_HALF);
  _playerBox.max.set(x+PLAYER_HALF, f + 1.8,  z+PLAYER_HALF);
  _queryRegion(x-PLAYER_HALF, z-PLAYER_HALF, x+PLAYER_HALF, z+PLAYER_HALF, _nearbyPC);
  for(let i=0;i<_nearbyPC.length;i++){
    const b = _nearbyPC[i];
    if(b.max.y <= f + STEP_UP_H) continue;   // low enough to step onto
    if(_playerBox.intersectsBox(b)) return true;
  }
  return false;
}
const _nearbyPC = [];

// Is the camera itself buried in geometry? Uses a tighter radius than the body
// (the eye is a point, not a torso) but wider than the near plane, so the near
// plane can never slice into a wall face.
const _eyeBox = new THREE.Box3();
const _nearbyEye = [];
const EYE_R = 0.28;
function eyeBlocked(x, z, feetY){
  const f = feetY || 0;
  _eyeBox.min.set(x-EYE_R, f + 0.25, z-EYE_R);
  _eyeBox.max.set(x+EYE_R, f + 1.8,  z+EYE_R);
  _queryRegion(x-EYE_R, z-EYE_R, x+EYE_R, z+EYE_R, _nearbyEye);
  for(let i=0;i<_nearbyEye.length;i++){
    const b = _nearbyEye[i];
    if(b.max.y <= f + STEP_UP_H) continue;   // low enough to stand on, not a wall
    if(_eyeBox.intersectsBox(b)) return true;
  }
  return false;
}
