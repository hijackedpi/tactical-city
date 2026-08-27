// ── GUN DEFINITIONS ────────────────────────────────────────────────────────
// price: cost in the shop ($). order: display order in the shop.
const GUNS = {
  knife:   { name:'KNIFE',         ammo:0,  maxAmmo:0,  damage:90, pellets:0, spread:0, reloadTime:0,
             bulletSpeed:0, recoilZ:0.10, recoilY:0.04, bulletSize:0, price:0,    order:0,
             rpm:'Melee', range:'Contact', category:'melee',   melee:true, fireInterval:420 },
  glock18: { name:'GLOCK 18',      ammo:15, maxAmmo:15, spareMags:2, damage:18, pellets:1, spread:0.018, reloadTime:1300,
             bulletSpeed:5.70, recoilZ:0.08, recoilY:0.03, bulletSize:0.06, price:0,    order:1,
             rpm:'Auto', range:'Short',  category:'pistols' },
  deagle:  { name:'DESERT EAGLE',  ammo:7,  maxAmmo:7,  spareMags:2,  damage:60, pellets:1, spread:0, reloadTime:1600,
             bulletSpeed:7.80, recoilZ:0.65, recoilY:0.28, bulletSize:0.08, price:1600, order:2,
             rpm:'Slow', range:'Long',   category:'pistols', fireInterval:750 },
  mac10:   { name:'MAC-10',        ammo:30, maxAmmo:30, spareMags:2, damage:13, pellets:1, spread:0.026, reloadTime:1450,
             bulletSpeed:6.20, recoilZ:0.06, recoilY:0.02, bulletSize:0.045, price:1050, order:3,
             rpm:'Auto', range:'Short',  category:'smgs' },
  mp5:     { name:'MP5',           ammo:20, maxAmmo:20, spareMags:3, damage:15, pellets:1, spread:0.012, reloadTime:1500,
             bulletSpeed:6.60, recoilZ:0.07, recoilY:0.02, bulletSize:0.045, price:1500, order:4,
             rpm:'Auto', range:'Short',  category:'smgs' },
  mp7:     { name:'MP7',           ammo:35, maxAmmo:35, spareMags:2, damage:16, pellets:1, spread:0.010, reloadTime:1550,
             bulletSpeed:6.90, recoilZ:0.06, recoilY:0.02, bulletSize:0.045, price:1500, order:5,
             rpm:'Auto', range:'Medium', category:'smgs' },
  ump45:   { name:'UMP-45',        ammo:25, maxAmmo:25, spareMags:2, damage:20, pellets:1, spread:0.014, reloadTime:1600,
             bulletSpeed:6.40, recoilZ:0.09, recoilY:0.03, bulletSize:0.05, price:1200, order:6,
             rpm:'Auto', range:'Medium', category:'smgs' },
  ak47:    { name:'AK-47',         ammo:30, maxAmmo:30, spareMags:3, damage:20, pellets:1, spread:0, reloadTime:1800,
             bulletSpeed:7.20, recoilZ:0.10, recoilY:0.03, bulletSize:0.05, price:2700, order:7,
             rpm:'Auto', range:'Long',   category:'rifles' },
  m4a1:    { name:'M4A1',          ammo:20, maxAmmo:20, spareMags:4, damage:18, pellets:1, spread:0.004, reloadTime:1700,
             bulletSpeed:7.50, recoilZ:0.07, recoilY:0.02, bulletSize:0.05, price:3100, order:8,
             rpm:'Auto', range:'Long',   category:'rifles' },
  awp:     { name:'AWP',           ammo:5,  maxAmmo:5,  spareMags:2,  damage:80, pellets:1, spread:0, reloadTime:2400,
             bulletSpeed:12.60, recoilZ:0.55, recoilY:0.22, bulletSize:0.07, price:4750, order:9,
             rpm:'Bolt', range:'Extreme', category:'snipers', fireInterval:1100, headshotDamage:100, scopeFov:12 },
};

// Muzzle velocity multiplier. Applied here, immediately after the table and
// before anything copies from it — `gun` is snapshotted further down, so
// scaling later would leave the spawn weapon on its original speed.
const BULLET_SPEED_MULT = 3;
for(const k in GUNS) GUNS[k].bulletSpeed *= BULLET_SPEED_MULT;

// ── WEAPON MODELS ───────────────────────────────────────────────────────────
// Loaded from GLB exactly like the operator model. Filenames live here so they
// are trivial to change; anything missing simply never appears in the hand and
// logs a warning rather than breaking the game.
const WEAPON_FILES = {
  knife:   'Meshy_AI_knife_0807085337_texture.glb',
  glock18: 'Meshy_AI_glock18_0807085448_texture.glb',
  deagle:  'Meshy_AI_dessert_eagle_0807085803_texture.glb',
  mac10:   'Meshy_AI_mac10_0807085434_texture.glb',
  mp5:     'Meshy_AI_mp5_0807085408_texture.glb',
  mp7:     'Meshy_AI_mp7_0807085345_texture.glb',
  ump45:   'Meshy_AI_UMP_0807085429_texture.glb',
  ak47:    'Meshy_AI_AK_47_rifle_0807085442_texture.glb',
  m4a1:    'Meshy_AI_M4A1_0807085437_texture.glb',
  awp:     'Meshy_AI_sniper_0807085425_texture.glb',
};

// Target length of the weapon's longest axis in world units. The loader scales
// each model to hit this, so it does not matter what scale it was exported at.
// Derived from real overall lengths (Glock 202mm ... AWP 1124mm) with the AK
// anchored at 0.62 on screen. Ordering is therefore always correct: pistol <
// SMG < rifle < sniper.
const WEAPON_LEN = {
  knife:   0.26,   // combat knife
  glock18: 0.21,   // 202 mm
  deagle:  0.27,   // 274 mm
  mac10:   0.35,   // 295 mm folded
  mp7:     0.47,   // 590 mm
  mp5:     0.52,   // 680 mm
  ump45:   0.52,   // 690 mm
  m4a1:    0.60,   // 840 mm
  ak47:    0.62,   // 880 mm
  awp:     0.74,   // 1124 mm
};

// Per-weapon corrections, filled in with F6 in game (see the adjust mode).
// flip:true turns a model that ended up pointing back at the camera.
const WEAPON_FIX = {
  // example: ak47: { flip:true, rot:[0, 0, 0], pos:[0, 0, 0], scale:1 },
};

let selectedGunKey = 'glock18';
let gun = {...GUNS.glock18};

// ── WEAPON SLOTS ────────────────────────────────────────────────────────────
// Slot 1: empty (knife later). Slot 2: pistol-category. Slot 3: non-pistol.
const slots = { 1: 'knife', 2: 'glock18', 3: null };
let activeSlot = 2;   // start holding the pistol
function slotForGun(key){
  const c = GUNS[key].category;
  return c === 'melee' ? 1 : (c === 'pistols' ? 2 : 3);
}
function updateSlotUI(){
  for(const el of document.querySelectorAll('.cs-slot')){
    const s = +el.dataset.slot;
    const key = slots[s];
    const nameEl = el.querySelector('.cs-slot-name');
    if(s === 1){ nameEl.innerText = key ? GUNS[key].name : '—'; }
    else nameEl.innerText = key ? GUNS[key].name : '—';
    el.classList.toggle('active', s === activeSlot);
    el.classList.toggle('empty', s !== 1 && !key);
  }
}

// ── MONEY & OWNERSHIP ───────────────────────────────────────────────────────
const KILL_REWARD = 100;
let money = 0;
const owned = {};
for(const k in GUNS) owned[k] = (GUNS[k].price === 0);   // knife + glock free

// ── SCOPE STATE ────────────────────────────────────────────────────────────
let mouseSens = 1;          // driven by the settings menu
let isScoped = false;
let DEFAULT_FOV = 75;
let currentFov = DEFAULT_FOV;
let targetFov = DEFAULT_FOV;
function buildScopeSVG(){
  // CS-style scope: smaller true-circle lens, centered, thin crosshair.
  const svg = document.getElementById('scope-svg');
  if(!svg) return;
  svg.setAttribute('preserveAspectRatio','xMidYMid slice');
  svg.innerHTML = `
    <defs>
      <mask id="scopeHole">
        <rect width="100" height="100" fill="white"/>
        <circle cx="50" cy="50" r="30" fill="black"/>
      </mask>
    </defs>
    <rect width="100" height="100" fill="#000" mask="url(#scopeHole)"/>
    <circle cx="50" cy="50" r="30" fill="none" stroke="#000" stroke-width="1"/>
    <circle cx="50" cy="50" r="29.6" fill="none" stroke="#1a1a1a" stroke-width="0.25"/>
    <line x1="50" y1="20" x2="50" y2="48" stroke="#000" stroke-width="0.3"/>
    <line x1="50" y1="52" x2="50" y2="80" stroke="#000" stroke-width="0.3"/>
    <line x1="20" y1="50" x2="48" y2="50" stroke="#000" stroke-width="0.3"/>
    <line x1="52" y1="50" x2="80" y2="50" stroke="#000" stroke-width="0.3"/>
  `;
}
function setScoped(on){
  if(isScoped === on) return;
  if(playerInCar) return;          // no scoping while driving
  if(!gun.scopeFov) return;        // gun must support a scope
  isScoped = on;
  if(on){
    targetFov = gun.scopeFov;
    buildScopeSVG();
    document.getElementById('scope-overlay').style.display='block';
    document.body.classList.add('scoped');
    if(playerGun) playerGun.visible = false;
  } else {
    targetFov = DEFAULT_FOV;
    document.getElementById('scope-overlay').style.display='none';
    document.body.classList.remove('scoped');
    if(playerGun) applyViewmodel();
  }
}
window.addEventListener('contextmenu', e => e.preventDefault());

// ── VEHICLE STATE ──────────────────────────────────────────────────────────
const cars = [];                    // {group, pos:{x,z}, angle, speed, halfW, halfL, color, wheels:[], steeringWheel}
let playerInCar = false;
let currentCar = null;
const CAR_MAX_SPEED = 0.55;         // units per frame at top speed
const CAR_MAX_REVERSE = 0.22;
const CAR_ACCEL = 0.012;
const CAR_BRAKE = 0.025;
const CAR_FRICTION = 0.992;         // velocity decay per frame
const CAR_TURN_RATE = 0.038;        // radians per frame at max grip
const CAR_HANDBRAKE_DECAY = 0.94;

// (scope system removed)

window.addEventListener('contextmenu', e => e.preventDefault());

// ── STATE ──────────────────────────────────────────────────────────────────
let health=100, ammo=15, maxAmmo=15, reserve=0, isReloading=false, kills=0;

// Ammo is tracked per weapon. Keeping it on a single pair of globals would let
// a player refill simply by switching guns and back, which makes a finite
// reserve meaningless.
const ammoState = {};
function initAmmo(key){
  const g = GUNS[key];
  ammoState[key] = { mag: g.ammo, reserve: (g.spareMags || 0) * g.ammo };
}
function resetAllAmmo(){ for(const k in GUNS) initAmmo(k); }
function syncAmmoOut(){                       // globals -> store
  const st = ammoState[selectedGunKey];
  if(st){ st.mag = ammo; st.reserve = reserve; }
}
function syncAmmoIn(){                        // store -> globals
  if(!ammoState[selectedGunKey]) initAmmo(selectedGunKey);
  const st = ammoState[selectedGunKey];
  ammo = st.mag; reserve = st.reserve;
}

// One reload path for both the R key and the auto-reload on empty.
function startReload(){
  if(isReloading || gun.melee) return;
  if(ammo >= gun.maxAmmo || reserve <= 0) return;
  playReload(); isReloading = true;
  document.getElementById('reload-msg').style.display = 'block';
  setTimeout(() => {
    const need = gun.maxAmmo - ammo;
    const take = Math.min(need, reserve);
    ammo += take; reserve -= take;
    syncAmmoOut();
    isReloading = false;
    document.getElementById('reload-msg').style.display = 'none';
    updateHUD();
  }, gun.reloadTime);
}
let yaw=0, pitch=0, verticalVelocity=0, isGrounded=true;
const gravity=0.015, jumpPower=0.25;
let gunRecoilZ=0, gunRecoilY=0;
// Enhanced weapon feel
let camShake = 0;                 // decays each frame, jitters the camera
let bloom = 0;                    // accumulated spray inaccuracy (0..1)
let swayTime = 0;                 // drives idle/walk weapon sway
let gunKickPitch = 0;             // visual muzzle climb that recovers
const BLOOM_MAX = 1;
const keys={}, enemies=[], obstacles=[], enemyBullets=[], playerBullets=[];
const _BULLET_FWD = new THREE.Vector3(0, 0, -1);  // bullet model's nose axis
const _scratchPrev = new THREE.Vector3();          // reused each frame, never allocated
const _scratchDir  = new THREE.Vector3();
const _scratchTgt  = new THREE.Vector3();
const _scratchFwd  = new THREE.Vector3();
const _scratchRight= new THREE.Vector3();
const _scratchPlyr = new THREE.Vector3();