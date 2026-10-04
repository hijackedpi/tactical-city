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
  // a reload or held trigger never carries over to the next weapon
  cancelReload(); stopAutoFire();
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
  const RATE = { Melee:0.35, Slow:0.25, Bolt:0.15, Semi:0.5, Fast:0.7, Auto:1 };
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
        '<span>' + g.rpm + '</span><span>' + (g.fireInterval ? (g.fireInterval / 1000).toFixed(g.fireInterval < 1000 ? 2 : 1) + 's cooldown' : g.range) + '</span></div>' +
        btn;
      row.appendChild(card);
    }
  }

  list.querySelectorAll('.sc-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.gun;
      if(btn.dataset.action === 'buy'){
        if(typeof netCanBuy === 'function' && !netCanBuy()){ closeShop(); return; }
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
// Each side gets its own shop look: T is a rust-orange black market, CT a navy
// issued-kit armory. The CSS lives under #shop.side-t / #shop.side-ct.
const SHOP_SIDES = {
  t:  { sub: 'TERRORIST SUPPLY', title: 'BLACK MARKET',
        emblem: '<polygon points="24,2 46,24 24,46 2,24" fill="#1c0f09" stroke="#ff8a2a" stroke-width="2.5"/>' +
                '<text x="24" y="31" text-anchor="middle" font-size="20" font-weight="900" fill="#ff8a2a" font-family="Saira Condensed,Arial Narrow,sans-serif">T</text>' },
  ct: { sub: 'COUNTER-TERRORIST REQUISITION', title: 'CT ARMORY',
        emblem: '<path d="M24 3 L43 10 V24 C43 35 34 42 24 45 C14 42 5 35 5 24 V10 Z" fill="#0a1628" stroke="#4aa3ff" stroke-width="2.5"/>' +
                '<text x="24" y="30" text-anchor="middle" font-size="16" font-weight="900" fill="#4aa3ff" font-family="Saira Condensed,Arial Narrow,sans-serif">CT</text>' },
};
function applyShopSide(){
  const side = (typeof selfTeamNow === 'function' ? selfTeamNow() : 't') === 'ct' ? 'ct' : 't';
  const s = SHOP_SIDES[side];
  shopEl.classList.toggle('side-t',  side === 't');
  shopEl.classList.toggle('side-ct', side === 'ct');
  const sub = document.getElementById('shop-sub'), title = document.getElementById('shop-title'), em = document.getElementById('shop-emblem');
  if(sub) sub.textContent = s.sub;
  if(title) title.textContent = s.title;
  if(em) em.innerHTML = s.emblem;
}
function openShop(){
  // NET HOOK — in a match the shop is only open during buy time. Single-player
  // has no netCanBuy defined, so this is a no-op there.
  if(typeof netCanBuy === 'function' && !netCanBuy()) return;
  applyShopSide();
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
  if(!document.pointerLockElement){ setScoped(false); releaseInputs(); }
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


// ── WHERE THE CROSSHAIR IS ACTUALLY POINTING ────────────────────────────────
// A bullet that starts at the barrel but travels parallel to the view lands
// beside the crosshair forever -- measured at 0.28 units right and 0.18 down,
// at every range. That is most of a head's radius, so "I was aiming right at
// him" genuinely did not connect.
//
// The fix is convergence: find what the crosshair ray hits, then aim the round
// from the muzzle AT THAT POINT. The two lines meet exactly on target, and the
// bullet still visibly leaves the gun.
//
// Cost is one ray query per shot, not per frame, so testing every obstacle in
// the region is fine.
const _nearbyAim = [];
function aimDistance(ox, oy, oz, dx, dy, dz, maxD){
  let best = maxD;

  // obstacles: the standard slab test, nearest entry wins
  const ex = ox + dx * maxD, ey = oy + dy * maxD, ez = oz + dz * maxD;
  _queryRegion(Math.min(ox,ex), Math.min(oz,ez), Math.max(ox,ex), Math.max(oz,ez), _nearbyAim);
  const idx = dx === 0 ? Infinity : 1/dx;
  const idy = dy === 0 ? Infinity : 1/dy;
  const idz = dz === 0 ? Infinity : 1/dz;
  for(let i = 0; i < _nearbyAim.length; i++){
    const b = _nearbyAim[i];
    let t1 = (b.min.x - ox) * idx, t2 = (b.max.x - ox) * idx;
    if(t1 > t2){ const t = t1; t1 = t2; t2 = t; }
    let tmin = t1, tmax = t2;
    t1 = (b.min.y - oy) * idy; t2 = (b.max.y - oy) * idy;
    if(t1 > t2){ const t = t1; t1 = t2; t2 = t; }
    if(t1 > tmin) tmin = t1;
    if(t2 < tmax) tmax = t2;
    if(tmin > tmax) continue;
    t1 = (b.min.z - oz) * idz; t2 = (b.max.z - oz) * idz;
    if(t1 > t2){ const t = t1; t1 = t2; t2 = t; }
    if(t1 > tmin) tmin = t1;
    if(t2 < tmax) tmax = t2;
    if(tmin > tmax || tmax < 0) continue;
    const d = tmin * maxD;
    if(d > 0.5 && d < best) best = d;
  }

  // players, so aiming at someone in open ground converges on THEM rather than
  // on a wall 100 units behind them
  if(typeof hitZone === 'function'){
    for(let i = 0; i < enemies.length; i++){
      // A dead player's body stays in `enemies` until the round resets. Left in
      // here it hijacks the convergence point, bending live rounds toward a
      // corpse that is not even drawn any more.
      if(enemies[i].userData && enemies[i].userData.netDead) continue;
      const hz = hitZone(enemies[i], ox, oy, oz, ex, ey, ez);
      if(hz){ const d = hz.t * maxD; if(d > 0.5 && d < best) best = d; }
    }
  }
  return best;
}

// ── BULLET TRACERS ──────────────────────────────────────────────────────────
// A thin amber line from the muzzle to wherever the round lands, for every
// shot, seen by the shooter AND by everyone else (remote shots draw the same
// line from d0-net). It fades out in a fraction of a second. Purely visual.
const TRACER_LIFE = 220;                        // ms
const _trSparkGeo = new THREE.SphereGeometry(0.05, 6, 4);
// a 1-pixel line: as thin as a line can be drawn, and it stays one pixel wide
// at any distance, so it never thickens up close or disappears far away
const _trLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1)]);
const _trZ = new THREE.Vector3(0, 0, 1), _trDir = new THREE.Vector3();
function spawnTracer(from0, dir, life, skip){
  const d = _trDir.copy(dir).normalize();
  if(!isFinite(d.x)) return;
  // your own line starts a little way out, so it does not begin at the lens
  const from = from0.clone().addScaledVector(d, skip || 0);
  const len = aimDistance(from.x, from.y, from.z, d.x, d.y, d.z, 240);
  if(!(len > 0.3)) return;
  const L = life || TRACER_LIFE, born = performance.now();
  const parts = [];
  const mk = (obj, op) => {
    obj.frustumCulled = false; obj.renderOrder = 5;
    obj.userData.dynamic = true; obj.userData.op0 = op;
    obj.onBeforeRender = () => {
      const k = Math.max(0, 1 - (performance.now() - born) / L);
      obj.material.opacity = obj.userData.op0 * k * k;
    };
    scene.add(obj); parts.push(obj); return obj;
  };
  const line = mk(new THREE.Line(_trLineGeo, new THREE.LineBasicMaterial({ color: 0xff9800, transparent: true,
    opacity: 1, depthWrite: false, fog: false })), 1.0);      // deep amber: shows on pale walls and sand
  line.position.copy(from); line.quaternion.setFromUnitVectors(_trZ, d); line.scale.set(1, 1, len);
  const sp = mk(new THREE.Mesh(_trSparkGeo, new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true,
    opacity: 0.9, depthWrite: false, fog: false })), 0.9);    // little flash where it lands
  sp.position.copy(from).addScaledVector(d, len - 0.05);
  setTimeout(() => { for(const m of parts){ scene.remove(m); m.material.dispose(); } }, L + 30);
  addBulletHole(from, d, len);
}

// ── BULLET HOLES ────────────────────────────────────────────────────────────
// Every shot that ends on a wall, crate or the floor leaves a small dark mark.
// Shots that end on a player leave nothing: the hole only goes down when the
// world surface is the FIRST thing the round meets (players are tested in
// aimDistance, which already gave us `len`). One InstancedMesh holds them all,
// so hundreds of holes cost one draw call; the oldest is reused past the cap.
// Cleared at the start of each round.
const BH_MAX = 256, BH_SIZE = 0.13;
const _bhTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  let gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0.00, 'rgba(8,6,5,1)');
  gr.addColorStop(0.28, 'rgba(14,11,9,0.95)');
  gr.addColorStop(0.42, 'rgba(40,32,26,0.55)');
  gr.addColorStop(0.75, 'rgba(30,24,20,0.18)');
  gr.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const _bhMesh = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(BH_SIZE, BH_SIZE),
  new THREE.MeshBasicMaterial({ map: _bhTex, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  BH_MAX);
_bhMesh.count = 0; _bhMesh.frustumCulled = false; _bhMesh.renderOrder = 2;
_bhMesh.userData.dynamic = true;
scene.add(_bhMesh);
let _bhNext = 0;
const _bhM = new THREE.Matrix4(), _bhQ = new THREE.Quaternion(), _bhQ2 = new THREE.Quaternion();
const _bhP = new THREE.Vector3(), _bhN = new THREE.Vector3(), _bhS = new THREE.Vector3();
const _bhUp = new THREE.Vector3(0, 0, 1), _bhNear = [];

// nearest world surface along the ray, with the face it went in through
function _bhWorldHit(ox, oy, oz, dx, dy, dz, maxD){
  let best = maxD, nx = 0, ny = 0, nz = 0;
  const ex = ox + dx * maxD, ez = oz + dz * maxD;
  _queryRegion(Math.min(ox,ex), Math.min(oz,ez), Math.max(ox,ex), Math.max(oz,ez), _bhNear);
  for(let i = 0; i < _bhNear.length; i++){
    const b = _bhNear[i];
    let tmin = -Infinity, tmax = Infinity, ax = -1;
    const o = [ox, oy, oz], dd = [dx, dy, dz], lo = [b.min.x, b.min.y, b.min.z], hi = [b.max.x, b.max.y, b.max.z];
    let miss = false;
    for(let k = 0; k < 3; k++){
      if(dd[k] === 0){ if(o[k] < lo[k] || o[k] > hi[k]){ miss = true; break; } continue; }
      let t1 = (lo[k] - o[k]) / dd[k], t2 = (hi[k] - o[k]) / dd[k];
      if(t1 > t2){ const t = t1; t1 = t2; t2 = t; }
      if(t1 > tmin){ tmin = t1; ax = k; }
      if(t2 < tmax) tmax = t2;
      if(tmin > tmax){ miss = true; break; }
    }
    if(miss || tmax < 0 || ax < 0 || tmin <= 0.3 || tmin >= best) continue;
    best = tmin; nx = ny = nz = 0;
    const sgn = dd[ax] > 0 ? -1 : 1;
    if(ax === 0) nx = sgn; else if(ax === 1) ny = sgn; else nz = sgn;
  }
  // open floor at y = 0 (not under a raised platform)
  if(dy < 0){
    const t = -oy / dy;
    if(t > 0.3 && t < best && groundHeightAt(ox + dx * t, oz + dz * t, Infinity) < 0.05){
      best = t; nx = 0; ny = 1; nz = 0;
    }
  }
  return best < maxD ? { d: best, nx, ny, nz } : null;
}

function addBulletHole(from, d, len){
  const h = _bhWorldHit(from.x, from.y, from.z, d.x, d.y, d.z, 240);
  if(!h) return;
  // a player was hit first: no hole
  if(h.d > len + 0.05) return;
  // a shot from someone else that passes through YOUR body (you are not in
  // `enemies`, so aimDistance cannot see you) leaves no hole behind you either
  const cp = camera.position;
  const ox = cp.x - from.x, oz = cp.z - from.z;
  if(ox * ox + oz * oz > 2.25){
    const t = Math.max(0, Math.min(h.d, ox * d.x + (cp.y - 0.8 - from.y) * d.y + oz * d.z));
    const qx = from.x + d.x * t - cp.x, qz = from.z + d.z * t - cp.z, qy = from.y + d.y * t;
    if(qx * qx + qz * qz < 0.2 && qy < cp.y + 0.25 && qy > cp.y - 1.9) return;
  }
  _bhN.set(h.nx, h.ny, h.nz);
  _bhP.set(from.x + d.x * h.d, from.y + d.y * h.d, from.z + d.z * h.d).addScaledVector(_bhN, 0.006);
  _bhQ.setFromUnitVectors(_bhUp, _bhN);
  _bhQ2.setFromAxisAngle(_bhUp, Math.random() * Math.PI * 2);   // spin so they do not all match
  _bhQ.multiply(_bhQ2);
  const s = 0.8 + Math.random() * 0.4;
  _bhS.set(s, s, 1);
  _bhM.compose(_bhP, _bhQ, _bhS);
  _bhMesh.setMatrixAt(_bhNext, _bhM);
  _bhNext = (_bhNext + 1) % BH_MAX;
  if(_bhMesh.count < BH_MAX) _bhMesh.count++;
  _bhMesh.instanceMatrix.needsUpdate = true;
}
function clearBulletHoles(){ _bhMesh.count = 0; _bhNext = 0; }

let _lastShotTime = 0;
const _meleeDir  = new THREE.Vector3();   // reused; a swing must not allocate
const _muzzleOff = new THREE.Vector3();
const _aimFwd    = new THREE.Vector3();
const _aimPt     = new THREE.Vector3();
const _spreadV   = new THREE.Vector3();
function doShoot() {
  if(!document.pointerLockElement||playerInCar) return;
  // V is an inspect view, not a firing position. Every shot below is aimed with
  // camera.quaternion and spawned at camera.position, and in third person the
  // camera stands in FRONT of the player looking back — so firing from it would
  // send rounds backwards through your own body. Guarded here rather than at the
  // mousedown handler so the auto-fire interval cannot slip through it either.
  if(typeof thirdPerson !== 'undefined' && thirdPerson) return;
  // NET HOOK — no shooting while frozen in the buy phase, between rounds, or
  // once you are dead and spectating.
  if(typeof netCanShoot === 'function' && !netCanShoot()) return;
  if(gun.melee){
    const nowT = performance.now();
    if(nowT - _lastShotTime < (gun.fireInterval||420)) return;
    _lastShotTime = nowT;
    gunRecoilZ = gun.recoilZ; gunRecoilY = gun.recoilY;
    // the knife slash recording (public/knife.mp3); the old sound only as a fallback
    if(!(typeof playWeaponSample === 'function' && playWeaponSample('knife'))) playGunshot();

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
      if(e.userData.netDead) continue;
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
      // A swing never touches hitZone or hitDamage, so the floating-damage
      // wrappers in k0-damage have nothing to catch. This is that hook.
      if(typeof onMeleeHit === 'function') onMeleeHit(best, dmg);
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
    // COOLDOWN between shots, per gun (fireInterval in 10-config.js). Clicking
    // faster, or an auto-clicker, cannot beat it. Only the built-in auto-fire
    // timer gets 8 ms of slack, because browser timers can tick a hair early
    // and a strict check would then drop every other round.
    if(nowT - _lastShotTime < gun.fireInterval - (_autoTick ? 8 : 0)) return;
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
    // the round itself is invisible: it still flies and does the hit test,
    // but what you see is the tracer
    bm.visible = false;
    // Leave from the barrel of the weapon actually being held. gunOffsets is
    // the model's CENTRE, so push forward by half its length to reach the tip;
    // viewSide mirrors it for a left-handed viewmodel.
    const _go = gunOffsets[selectedGunKey] || [0.26, -0.22, -0.6];
    const _len = (typeof WEAPON_LEN !== 'undefined' && WEAPON_LEN[selectedGunKey]) || 0.5;
    _muzzleOff.set(Math.abs(_go[0]) * viewSide, _go[1], _go[2] - _len / 2);
    _muzzleOff.applyQuaternion(camera.quaternion);
    bm.position.copy(camera.position).add(_muzzleOff);

    // A noSpread weapon is exempt from BOTH halves of the spray model: it
    // takes none of the accumulated inaccuracy, and it adds none for whatever
    // you fire next. Exempting it from only the first half would still leave
    // the AWP punishing your follow-up shot for a round that was, by
    // definition, perfectly placed.
    const spread = gun.noSpread ? 0 : gun.spread + bloom * 0.05 * (gun.bloomMul || 1);
    if(!gun.noSpread) bloom = Math.min(BLOOM_MAX, bloom + (gun.pellets>1 ? 0.25 : 0.18));
    camShake = Math.min(0.5, camShake + gun.recoilZ * 0.9 + 0.12);
    gunKickPitch = Math.min(0.18, gunKickPitch + gun.recoilY + 0.04);

    // Converge on whatever the crosshair is over, then apply spread around
    // that. Without this the round runs parallel to the view and lands beside
    // the target no matter how well you aimed.
    _aimFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const _aimD = aimDistance(camera.position.x, camera.position.y, camera.position.z,
                              _aimFwd.x, _aimFwd.y, _aimFwd.z, 240);
    _aimPt.copy(camera.position).addScaledVector(_aimFwd, Math.max(2, _aimD));
    const dir = _aimPt.clone().sub(bm.position).normalize();
    if(spread > 0){
      _spreadV.set((Math.random()-0.5)*spread, (Math.random()-0.5)*spread, 0)
              .applyQuaternion(camera.quaternion);
      dir.add(_spreadV).normalize();
    }
    // fx/fy/fz is the EYE, not the muzzle. The round is spawned about a metre
    // down the barrel so it looks right, which leaves that metre in front of
    // your face untested — a0-loop sweeps from here on the first step so a
    // point-blank target cannot sit inside the blind spot.
    spawnTracer(bm.position, dir, gun.noSpread ? 360 : TRACER_LIFE, 2.5);   // everyone sees where it went
    bm.userData={vel:dir.multiplyScalar(gun.bulletSpeed), life:0,
                 damage:gun.damage, headshotDamage:gun.headshotDamage||0, zoneDamage:gun.zoneDamage||null,
                 fx:camera.position.x, fy:camera.position.y, fz:camera.position.z};
    scene.add(bm); playerBullets.push(bm);
    // NET HOOK — cosmetic only. Everyone else gets a tracer and a gunshot from
    // our position; the damage travels separately, as a claimed hit.
    if(typeof netReportShot === 'function') netReportShot(bm.position, dir);
  }
  if(ammo===0) startReload();
}

let mouseHeld=false, autoFireInterval=null, _autoTick=false;
function stopAutoFire(){ if(autoFireInterval){ clearInterval(autoFireInterval); autoFireInterval=null; } }
// Losing focus or the mouse lock releases everything that is held, so the
// trigger and movement keys cannot stay stuck down while you are away.
function releaseInputs(){
  mouseHeld = false; stopAutoFire();
  for(const k in keys) keys[k] = false;
}
window.addEventListener('blur', releaseInputs);

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
  stopAutoFire();          // never two loops at once
  doShoot();
  // Any weapon marked Auto keeps firing; the cycle time is per weapon. Semi
  // weapons (the Glock) fire once per click and never start this loop.
  const AUTO_CYCLE = { mac10:70, mp5:80, mp7:75, ump45:95, ak47:110, m4a1:100 };
  if(gun.rpm === 'Auto'){
    const cycle = gun.fireInterval || AUTO_CYCLE[selectedGunKey] || 100;
    autoFireInterval=setInterval(()=>{
      if(!mouseHeld||ammo<=0||isReloading||gun.rpm!=='Auto'){ stopAutoFire(); return; }
      _autoTick = true; try { doShoot(); } finally { _autoTick = false; }
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
