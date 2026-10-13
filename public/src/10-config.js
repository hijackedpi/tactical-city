// ── MAPS ───────────────────────────────────────────────────────────────────
// Which map this page builds. The map is built once, at load, so switching
// maps means reloading the page: the lobby's map picker stores the choice and
// reloads. A ?map= link overrides the stored choice, which is how a player is
// moved onto the map of a room they are joining.
//
// Keys are sent to the server and must match its MAPS list in server.js.
const MAPS = {
  alcazar:    { name:'Palace',     blurb:'Sun-baked palace compound. Diagonal spawns, open corner courts, tight streets.' },
  overgrowth: { name:'Overgrowth', blurb:'Jungle ruins with diagonal spawns. Open plains north-west, a tight warren south-east.' },
};
const MAP_ID = (() => {
  let id = null;
  try { id = new URLSearchParams(location.search).get('map'); } catch(e){}
  if(!MAPS[id]){ try { id = localStorage.getItem('tc.map'); } catch(e){} }
  return MAPS[id] ? id : 'alcazar';
})();
window.MAPS = MAPS; window.MAP_ID = MAP_ID;

// ── GUN DEFINITIONS ────────────────────────────────────────────────────────
// price: cost in the shop ($). order: display order in the shop.
const GUNS = {
  knife:   { name:'KNIFE',         ammo:0,  maxAmmo:0,  damage:90, pellets:0, spread:0, reloadTime:0,
             bulletSpeed:0, recoilZ:0.10, recoilY:0.04, bulletSize:0, price:0,    order:0,
             rpm:'Melee', range:'Contact', category:'melee',   melee:true, fireInterval:420 },
  // ── BALANCE ──────────────────────────────────────────────────────────────
  // No armour, 100 hp. Each gun lists its own damage per body part in
  // zoneDamage (head / chest / stomach / legs); `damage` is the chest value.
  // SMGs are cheaper and pay $600 a kill; rifles out-gun them at every range
  // and stay accurate while spraying (bloomMul: how much spraying spreads you).
  // fireInterval is each gun's COOLDOWN between shots (ms). Auto weapons repeat
  // at it; no weapon can be clicked (or auto-clicked) faster than it, and the
  // server refuses hits that arrive faster than it too (server.js FIRE_MS).
  //   knife 420 · glock 200 · deagle 500 · mac-10 120 · mp5 110 · mp7 130
  //   ump-45 140 · ak-47 100 · m4a1 90 · awp 1300
  glock18: { name:'GLOCK 18',      ammo:20, maxAmmo:20, spareMags:3, damage:20, pellets:1, spread:0.018, reloadTime:1300,
             bulletSpeed:5.70, recoilZ:0.08, recoilY:0.03, bulletSize:0.06, price:0,    order:1,
             // semi-automatic: one round per click, no holding to spray.
             rpm:'Semi', range:'Short',  category:'pistols', fireInterval:200, bloomMul:1.0,
             zoneDamage:{ head:54, chest:20, stomach:21, legs:16 } },
  deagle:  { name:'DESERT EAGLE',  ammo:7,  maxAmmo:7,  spareMags:3,  damage:46, pellets:1, spread:0.002, reloadTime:1600,
             bulletSpeed:7.80, recoilZ:0.65, recoilY:0.28, bulletSize:0.08, price:700, order:2,
             rpm:'Slow', range:'Long',   category:'pistols', fireInterval:500, bloomMul:1.6,
             zoneDamage:{ head:92, chest:46, stomach:51, legs:37 } },
  mac10:   { name:'MAC-10',        ammo:30, maxAmmo:30, spareMags:3, damage:15, pellets:1, spread:0.028, reloadTime:1450,
             bulletSpeed:6.20, recoilZ:0.06, recoilY:0.02, bulletSize:0.045, price:1050, order:3,
             rpm:'Auto', range:'Short',  category:'smgs', fireInterval:120, bloomMul:1.4,
             zoneDamage:{ head:38, chest:15, stomach:18, legs:14 } },
  mp5:     { name:'MP5',           ammo:30, maxAmmo:30, spareMags:3, damage:17, pellets:1, spread:0.012, reloadTime:1500,
             bulletSpeed:6.60, recoilZ:0.07, recoilY:0.02, bulletSize:0.045, price:1500, order:4,
             rpm:'Auto', range:'Short',  category:'smgs', fireInterval:110, bloomMul:1.1,
             zoneDamage:{ head:44, chest:17, stomach:19, legs:16 } },
  mp7:     { name:'MP7',           ammo:30, maxAmmo:30, spareMags:3, damage:19, pellets:1, spread:0.010, reloadTime:1550,
             bulletSpeed:6.90, recoilZ:0.06, recoilY:0.02, bulletSize:0.045, price:1600, order:5,
             rpm:'Auto', range:'Medium', category:'smgs', fireInterval:130, bloomMul:1.1,
             zoneDamage:{ head:47, chest:19, stomach:22, legs:17 } },
  ump45:   { name:'UMP-45',        ammo:25, maxAmmo:25, spareMags:3, damage:13, pellets:1, spread:0.020, reloadTime:1600,
             bulletSpeed:6.40, recoilZ:0.09, recoilY:0.03, bulletSize:0.05, price:1200, order:6,
             rpm:'Auto', range:'Short',  category:'smgs', fireInterval:140, bloomMul:1.3,
             zoneDamage:{ head:43, chest:13, stomach:14, legs:12 } },
  ak47:    { name:'AK-47',         ammo:30, maxAmmo:30, spareMags:3, damage:24, pellets:1, spread:0.002, reloadTime:1800,
             bulletSpeed:7.20, recoilZ:0.12, recoilY:0.035, bulletSize:0.05, price:2700, order:7,
             rpm:'Auto', range:'Long',   category:'rifles', fireInterval:100, bloomMul:0.9,
             zoneDamage:{ head:76, chest:24, stomach:36, legs:23 } },
  m4a1:    { name:'M4A1',          ammo:30, maxAmmo:30, spareMags:3, damage:26, pellets:1, spread:0.001, reloadTime:1700,
             bulletSpeed:7.50, recoilZ:0.07, recoilY:0.02, bulletSize:0.05, price:2900, order:8,
             rpm:'Auto', range:'Long',   category:'rifles', fireInterval:90, bloomMul:0.7,
             zoneDamage:{ head:68, chest:26, stomach:34, legs:22 } },
  // noSpread: the round goes exactly where the crosshair is pointing, at any
  // range, always. `spread: 0` alone was not enough — doShoot adds `bloom *
  // 0.05` on top of it, so the AWP inherited the scatter of whatever you had
  // been spraying a moment earlier and could miss a target it was dead on.
  awp:     { name:'AWP',           ammo:5,  maxAmmo:5,  spareMags:3,  damage:115, pellets:1, spread:0, reloadTime:2400,
             bulletSpeed:12.60, recoilZ:0.55, recoilY:0.22, bulletSize:0.07, price:4750, order:9,
             // 115: one shot anywhere on the body kills
             rpm:'Bolt', range:'Extreme', category:'snipers', fireInterval:1300, headshotDamage:115, scopeFov:12,
             noSpread:true,
             zoneDamage:{ head:115, chest:115, stomach:115, legs:88 } },
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
  knife:   'Meshy_AI_knife_1012115741_texture.glb',
  glock18: 'Meshy_AI_A_glock_18_gun_that_i_1012122251_texture.glb',
  deagle:  'Meshy_AI_dessert_eagle_1012115721_texture.glb',
  mac10:   'Meshy_AI_mac10_1012115655_texture.glb',
  mp5:     'Meshy_AI_mp5_1012115747_texture.glb',
  mp7:     'Meshy_AI_mp7_1012115753_texture.glb',
  ump45:   'Meshy_AI_UMP_1012115727_texture.glb',
  ak47:    'Meshy_AI_ak47_1012115706_texture.glb',
  m4a1:    'Meshy_AI_M4A1_1012115715_texture.glb',
  awp:     'Meshy_AI_sniper_1012115733_texture.glb',
};

// ── SKINS ───────────────────────────────────────────────────────────────────
// A skin is just another GLB for the same gun, kept in public/gunskins/. Add
// one here (and its id to SKIN_IDS in server.js) and it shows up in the
// Inventory. Players see every skin; ones they do not own are locked (preview
// only). The loadout — which skin each gun wears — is saved on the account.
// Tiers, lowest to highest: issued, field, elite, prime, apex.
const SKIN_TIERS = {
  issued: { name:'Issued', color:'#9fb0c4' },
  field:  { name:'Field',  color:'#4b69ff' },
  elite:  { name:'Elite',  color:'#8847ff' },
  prime:  { name:'Prime',  color:'#d32ce6' },
  apex:   { name:'Apex',   color:'#eb4b4b' },
};
const GUN_SKINS = {
  glock18: {
    neonspirit:  { name:'Neo-Noir',     file:'gunskins/Meshy_AI_A_glock_18_gun_that_i_1012143420_texture.glb', tier:'apex' },
    sunrisefade: { name:'Fade',         file:'gunskins/Meshy_AI_A_glock_18_gun_that_i_1012143424_texture.glb', tier:'elite' },
    nightskyline: { name:'Moonrise',     file:'gunskins/Meshy_AI_A_glock_18_gun_that_i_1013141844_texture.glb', tier:'elite' },
    moonrabbit:  { name:'Umbral Rabbit', file:'gunskins/Meshy_AI_A_glock_18_gun_that_i_1013141853_texture.glb', tier:'apex' },
  },
  deagle: {
    codewhite:   { name:'Printstream',  file:'gunskins/Meshy_AI_Meshy_AI_dessert_eagl_1012143429_texture.glb', tier:'apex' },
    violetblaze: { name:'Violet Blaze', file:'gunskins/Meshy_AI_Meshy_AI_dessert_eagl_1012143434_texture.glb', tier:'elite' },
    jadetide:    { name:'Jade Tide',    file:'gunskins/Meshy_AI_Meshy_AI_dessert_eagl_1013141955_texture.glb', tier:'field' },
    crimsontide: { name:'Sunset Storm 壱', file:'gunskins/Meshy_AI_Meshy_AI_dessert_eagl_1013142022_texture.glb', tier:'field' },
  },
  mac10: {
    wildcat:     { name:'Stalker',      file:'gunskins/Meshy_AI_Meshy_AI_mac10_101213_1012143441_texture.glb', tier:'elite' },
    duskfade:    { name:'Fade',         file:'gunskins/Meshy_AI_Meshy_AI_mac10_101213_1012143445_texture.glb', tier:'field' },
  },
  mp5: {
    crimsondots: { name:'Crimson Dots', file:'gunskins/Meshy_AI_mp5_1012143524_texture.glb', tier:'issued' },
    aciddrip:    { name:'Acid Drip',    file:'gunskins/Meshy_AI_mp5_1012143529_texture.glb', tier:'field' },
  },
  mp7: {
    raceday:     { name:'Bloodsport',   file:'gunskins/Meshy_AI_mp7_1012143642_texture.glb', tier:'elite' },
    iceblue:     { name:'Ice Blue',     file:'gunskins/Meshy_AI_mp7_1012143650_texture.glb', tier:'field' },
    sunsetfade:  { name:'Fade',         file:'gunskins/Meshy_AI_mp7_1013141859_texture.glb', tier:'elite' },
    acidswirl:   { name:'Neon Ply',     file:'gunskins/Meshy_AI_mp7_1013141907_texture.glb', tier:'prime' },
  },
  ump45: {
    doodlemech:  { name:'Motorized',    file:'gunskins/Meshy_AI_UMP_1012143537_texture.glb', tier:'elite' },
    redracer:    { name:'Red Racer',    file:'gunskins/Meshy_AI_UMP_1012143623_texture.glb', tier:'field' },
  },
  ak47: {
    ivorycrane:  { name:'Crane Flight', file:'gunskins/Meshy_AI_ak47_1012143501_texture.glb', tier:'apex' },
    toonriot:    { name:'Head Shot',    file:'gunskins/Meshy_AI_ak47_1012143507_texture.glb', tier:'elite' },
    orbit:       { name:'Asiimov',      file:'gunskins/Meshy_AI_ak47_1013141826_texture.glb', tier:'apex' },
    cyancircuit: { name:'Cyan Circuit', file:'gunskins/Meshy_AI_ak47_1013141833_texture.glb', tier:'prime' },
  },
  m4a1: {
    petalstorm:  { name:'Petal Storm',  file:'gunskins/Meshy_AI_M4A1_1012143451_texture.glb', tier:'apex' },
    shatter:     { name:'Shatter',      file:'gunskins/Meshy_AI_M4A1_1012143456_texture.glb', tier:'elite' },
    codeivory:   { name:'Printstream',  file:'gunskins/Meshy_AI_M4A1_1013141943_texture.glb', tier:'prime' },
    junglefever: { name:'Jungle Fever', file:'gunskins/Meshy_AI_M4A1_1013141949_texture.glb', tier:'elite' },
  },
  awp: {
    oilslick:    { name:'Chromatic Aberration', file:'gunskins/Meshy_AI_sniper_1012143512_texture.glb', tier:'elite' },
    codechrome:  { name:'Printstream',  file:'gunskins/Meshy_AI_sniper_1012143517_texture.glb', tier:'apex' },
    orbit:       { name:'Asiimov',      file:'gunskins/Meshy_AI_sniper_1013141930_texture.glb', tier:'apex' },
    neonbeast:   { name:'Hyper Beast',  file:'gunskins/Meshy_AI_sniper_1013141937_texture.glb', tier:'prime' },
  },
};
let playerLoadout = {};                     // gun key -> skin id ('default' = base model)
function gunSkinFor(key){
  const id = playerLoadout[key];
  return (id && id !== 'default' && GUN_SKINS[key] && GUN_SKINS[key][id]) || null;
}
function gunFileFor(key){
  const skin = gunSkinFor(key);
  return (skin && skin.file) || WEAPON_FILES[key];
}

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
//
// DELIBERATELY EMPTY, and it must stay that way unless a single weapon is out
// of step with the rest. All ten Meshy exports do come out of fitWeaponModel
// with the muzzle at +Z, which is backwards — but that is ALREADY corrected,
// once, for the whole batch by VIEWMODEL_YAW_DEG in 50-weapons.js, which puts
// 180 degrees on each holder's `spin` group immediately after the fit.
//
// Adding flip:true here as well cost a second 180 degrees. Two half turns is a
// full turn: the muzzle came back round to face the player, in first person and
// on every third-person body. If you ever need to correct the batch again,
// change VIEWMODEL_YAW_DEG — this table is for the odd model that disagrees
// with its batch, not for the batch.
const WEAPON_FIX = {
  // example: ak47: { flip:true, rot:[0, 0, 0], pos:[0, 0, 0], scale:1 },
};

// ── MOVEMENT SPEED PER WEAPON ──────────────────────────────────────────────
// What you hold changes how fast you run, as in CS2. The knife is full speed
// (1.00); everything else is a fraction of it, from CS2's own speeds (knife
// 250 u/s). Scoping uses GUN_MOVE_SCOPED below.
const GUN_MOVE = {
  knife:   1.00,   // fastest
  glock18: 0.93,   // everything else stays below 94%
  mac10:   0.88,
  mp5:     0.88,
  deagle:  0.92,
  ump45:   0.87,
  mp7:     0.86,
  ak47:    0.82,
  awp:     0.83,
  m4a1:    0.77,
};
// Speed while scoped in, as a fraction of knife speed (only the AWP scopes).
const GUN_MOVE_SCOPED = { awp: 0.70 };
window.GUN_MOVE_SCOPED = GUN_MOVE_SCOPED;
window.GUN_MOVE = GUN_MOVE;

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
// ── WEAPON SLOTS HUD ───────────────────────────────────────────────────────
// Right side of the screen: a silhouette of each weapon you carry with its
// slot number. The one in your hands is gold, with its name underneath.
// Side-view weapon silhouettes, muzzle to the left, drawn in a 128 x 40 box.
const GUN_ICONS = {
  knife:
    'M2 21 Q14 13 58 14 L60 14 L60 25 L20 25 Q8 25 2 21 Z' +            // blade
    'M60 10 L65 10 L65 29 L60 29 Z' +                                    // guard
    'M65 15 L104 14 Q110 14 110 19.5 Q110 25 104 25 L65 24 Z' +         // handle
    'M108 15.5 L114 16 L114 23 L108 23.5 Z',                             // pommel
  glock18:
    'M6 9 L62 9 L62 18 L6 18 Z' +                                        // slide
    'M4 11 L6 11 L6 16 L4 16 Z' +                                        // muzzle
    'M14 18 L58 18 L58 22 L14 22 Z' +                                    // frame
    'M42 22 L58 22 L66 38 L52 39 Z',                                     // grip
  deagle:
    'M2 8 L68 7 L70 18 L2 18 Z' +                                        // long slide
    'M2 5 L8 5 L8 8 L2 8 Z' +                                            // front sight
    'M58 4 L64 4 L64 7 L58 7 Z' +                                        // rear sight
    'M14 18 L66 18 L66 23 L14 23 Z' +                                    // frame
    'M50 23 L66 23 L74 39 L58 39 Z',                                     // grip
  mac10:
    'M4 13 L22 13 L22 17 L4 17 Z' +                                      // barrel
    'M22 9 L66 9 L66 22 L22 22 Z' +                                      // box receiver
    'M44 22 L56 22 L58 39 L46 39 Z' +                                    // grip + magazine
    'M48 6 L84 6 L84 8 L48 8 Z M82 6 L86 6 L86 18 L82 18 Z',             // folded wire stock
  mp5:
    'M2 14 L16 14 L16 17 L2 17 Z' +                                      // barrel
    'M16 11 Q16 10 18 10 L38 10 L38 19 L18 19 Q16 19 16 18 Z' +         // handguard
    'M38 9 L80 9 L80 19 L38 19 Z' +                                      // receiver
    'M52 19 L61 19 Q65 29 60 37 L52 35 Q56 28 52 19 Z' +                 // curved magazine
    'M70 19 L78 19 L82 31 L75 32 Z' +                                    // grip
    'M80 11 L114 11 L114 14 L80 14 Z M112 8 L118 8 L118 24 L112 24 Z',   // retractable stock
  mp7:
    'M4 13 L18 13 L18 16 L4 16 Z' +                                      // barrel
    'M18 9 L64 9 L64 20 L18 20 Z' +                                      // body
    'M24 20 L31 20 L31 32 L25 32 Z' +                                    // fore grip
    'M44 20 L53 20 L55 39 L46 39 Z' +                                    // grip + magazine
    'M64 11 L88 11 L88 14 L64 14 Z M86 8 L91 8 L91 21 L86 21 Z',         // stock
  ump45:
    'M2 14 L14 14 L14 17 L2 17 Z' +                                      // barrel
    'M14 9 L72 9 L72 21 L14 21 Z' +                                      // polymer body
    'M38 21 L47 21 L48 39 L39 39 Z' +                                    // straight magazine
    'M58 21 L66 21 L70 32 L63 33 Z' +                                    // grip
    'M72 11 L106 12 L108 24 L100 25 L94 18 L72 18 Z',                   // folding stock
  ak47:
    'M2 12 L30 12 L30 14.5 L2 14.5 Z' +                                  // barrel
    'M7 8 L10 8 L10 12 L7 12 Z' +                                        // front sight
    'M28 11 L54 11 L54 19 L30 19 Q28 19 28 17 Z' +                       // handguard
    'M54 10 L88 10 L88 20 L54 20 Z' +                                    // receiver
    'M54 7.5 L62 7.5 L62 10 L54 10 Z' +                                  // rear sight
    'M58 20 L68 20 Q71 30 64 39 L56 36.5 Q62 29 58 20 Z' +               // banana magazine
    'M78 20 L86 20 L90 32 L83 33 Z' +                                    // grip
    'M88 10 L124 14 L126 27 L118 28 L88 19 Z',                           // stock
  m4a1:
    'M0 12 L24 12 L24 17.5 L0 17.5 Z' +                                  // suppressor
    'M24 13.5 L32 13.5 L32 16 L24 16 Z' +                                // barrel
    'M32 10 L58 10 L58 19 L32 19 Z' +                                    // handguard
    'M58 9 L88 9 L88 19 L58 19 Z' +                                      // receiver
    'M58 6 L84 6 L84 9 L58 9 Z' +                                        // top rail
    'M64 19 L73 19 L75 35 L66 36 Z' +                                    // magazine
    'M80 19 L88 19 L92 31 L85 32 Z' +                                    // grip
    'M88 11 L102 11 L102 15 L88 15 Z' +                                  // buffer tube
    'M100 8 L124 9 L124 25 L104 23 Z',                                   // stock
  awp:
    'M0 11 L5 11 L5 19 L0 19 Z' +                                        // muzzle brake
    'M5 13.5 L46 13.5 L46 16.5 L5 16.5 Z' +                              // long barrel
    'M46 11 L94 11 L94 20 L46 20 Z' +                                    // action
    'M50 6 L56 3 L84 3 L90 6 L90 9 L84 7 L56 7 L50 9 Z' +               // scope
    'M58 7 L62 7 L62 11 L58 11 Z M78 7 L82 7 L82 11 L78 11 Z' +          // scope mounts
    'M70 20 L80 20 L80 27 L70 27 Z' +                                    // magazine
    'M94 11 L126 12 L126 27 L114 28 L106 20 L94 20 Z',                   // thumbhole stock
};
// trigger guards, drawn as thin outlines over the body
const GUN_ICON_GUARDS = {
  glock18: 'M30 22 Q31 29 40 28 L42 22',
  deagle:  'M36 23 Q38 31 48 29 L50 23',
  mac10:   'M32 22 Q33 28 41 27 L44 22',
  mp5:     'M62 19 Q63 25 69 24 L70 19',
  mp7:     'M34 20 Q35 26 42 25 L44 20',
  ump45:   'M49 21 Q50 27 56 26 L58 21',
  ak47:    'M69 20 Q70 26 76 25 L78 20',
  m4a1:    'M74 19 Q75 25 80 24 L80 19',
  awp:     'M84 20 Q85 26 92 25 L94 20',
};

(function slotHudStyle(){
  const css = document.createElement('style');
  css.textContent = `
  #cs-slots{gap:14px !important;align-items:flex-end}
  .cs-slot{display:grid !important;grid-template-columns:auto 16px;column-gap:8px;align-items:start;
    color:rgba(236,239,243,.78) !important;font-size:14px !important;letter-spacing:.4px}
  .cs-slot .cs-ic{width:112px;height:35px;display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.85))}
  .cs-slot .cs-slot-name{grid-column:1;text-align:right;font-size:15px;font-weight:700;margin-top:3px;
    color:#e8b54a;text-shadow:0 1px 3px rgba(0,0,0,.9);display:none;white-space:nowrap}
  .cs-slot.active{color:#e8b54a !important}
  .cs-slot.active .cs-slot-name{display:block}
  .cs-slot.empty{opacity:.35}
  .cs-slot .cs-slot-num{grid-column:2;grid-row:1;width:auto !important;height:auto !important;
    line-height:1 !important;background:none !important;font-size:15px !important;font-weight:700;
    color:rgba(236,239,243,.85) !important;text-shadow:0 1px 3px rgba(0,0,0,.9) !important}
  .cs-slot.active .cs-slot-num{color:#e8b54a !important}
  .cs-slot .cs-dash{width:112px;height:35px;display:flex;align-items:center;justify-content:flex-end;font-size:22px}`;
  document.head.appendChild(css);
})();
function gunIconSVG(key){
  const body = GUN_ICONS[key];
  if(!body) return null;
  const guard = GUN_ICON_GUARDS[key];
  return '<svg class="cs-ic" viewBox="0 0 128 40" aria-hidden="true"><path fill="currentColor" d="' + body + '"/>' +
         (guard ? '<path fill="none" stroke="currentColor" stroke-width="2.2" d="' + guard + '"/>' : '') + '</svg>';
}
function updateSlotUI(){
  for(const el of document.querySelectorAll('.cs-slot')){
    const s = +el.dataset.slot;
    const key = slots[s];
    // rebuild only when the weapon in this slot changes
    if(el.dataset.key !== String(key)){
      el.dataset.key = String(key);
      const icon = key && gunIconSVG(key);
      el.innerHTML = (icon || '<span class="cs-dash">\u2014</span>') +
        '<span class="cs-slot-num">' + s + '</span>' +
        '<span class="cs-slot-name"></span>';
      el.querySelector('.cs-slot-name').textContent = key ? GUNS[key].name : '';
    }
    el.classList.toggle('active', s === activeSlot && !!key);
    el.classList.toggle('empty', !key);
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
  const svg = document.getElementById('scope-svg');
  if(!svg) return;

  // WHY THE VIEWBOX IS IN PIXELS
  // This used to be a fixed 100x100 viewBox stretched over the whole screen,
  // which on a 1920-wide display scales every unit by 19.2. A 0.3 stroke came
  // out nearly 6 px wide, landed on fractional pixel boundaries, and was
  // anti-aliased into a grey smear — that is the "blurry" part. Matching the
  // viewBox to the actual pixel size makes one user unit exactly one CSS
  // pixel, so a stroke-width of 1 IS one pixel; centring the lines on a .5
  // coordinate puts that pixel squarely inside one column or row instead of
  // straddling two, which is what makes them come out properly crisp.
  const W = Math.max(1, window.innerWidth | 0);
  const H = Math.max(1, window.innerHeight | 0);
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('preserveAspectRatio', 'none');

  const cx = Math.round(W / 2) + 0.5;
  const cy = Math.round(H / 2) + 0.5;
  const R  = Math.round(Math.min(W, H) * 0.335);   // lens radius

  // Mil-dot ticks up and down the vertical, and out along the horizontal, for
  // holding over at range. Spaced off the lens radius so they sit the same
  // way at any resolution.
  const step = R / 5;
  let ticks = '';
  for(let i = 1; i <= 4; i++){
    const d = Math.round(step * i) + 0.5;
    const len = i % 2 ? 5 : 9;                     // every other one longer
    ticks += '<line x1="' + (cx - len) + '" y1="' + (cy + d) + '" x2="' + (cx + len) + '" y2="' + (cy + d) + '"/>';
    ticks += '<line x1="' + (cx - len) + '" y1="' + (cy - d) + '" x2="' + (cx + len) + '" y2="' + (cy - d) + '"/>';
    ticks += '<line x1="' + (cx + d) + '" y1="' + (cy - len) + '" x2="' + (cx + d) + '" y2="' + (cy + len) + '"/>';
    ticks += '<line x1="' + (cx - d) + '" y1="' + (cy - len) + '" x2="' + (cx - d) + '" y2="' + (cy + len) + '"/>';
  }

  // The crosshair is ONE unbroken vertical and ONE unbroken horizontal line
  // that meet in the middle. The old reticle stopped both 2 units short of
  // centre, leaving a hole exactly where the shot goes.
  svg.innerHTML =
    '<defs><mask id="scopeHole">' +
      '<rect width="' + W + '" height="' + H + '" fill="#fff"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="#000"/>' +
    '</mask></defs>' +
    '<rect width="' + W + '" height="' + H + '" fill="#000" mask="url(#scopeHole)"/>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="#000" stroke-width="3"/>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R - 2) + '" fill="none" stroke="#2a2a2a" stroke-width="1"/>' +
    // shape-rendering="crispEdges" turns anti-aliasing off for this group. On
    // axis-aligned lines that is exactly what you want and is the other half
    // of the sharpness fix; it is deliberately NOT on the circles above, where
    // it would turn a smooth ring into a staircase.
    '<g stroke="#000" stroke-width="1" shape-rendering="crispEdges">' +
      '<line x1="' + cx + '" y1="' + (cy - R) + '" x2="' + cx + '" y2="' + (cy + R) + '"/>' +
      '<line x1="' + (cx - R) + '" y1="' + cy + '" x2="' + (cx + R) + '" y2="' + cy + '"/>' +
      ticks +
    '</g>';
}

// The reticle is built for one specific pixel size, so it has to be rebuilt
// when that changes or it stops being pixel-aligned — which is the blur it
// exists to avoid.
window.addEventListener('resize', () => { if(isScoped) buildScopeSVG(); });

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
let _reloadTimer = null;
let reloadStartedAt = 0, reloadDur = 0;   // read by the reload animation and HUD
// Stop a reload in progress (weapon switch, death, new round).
function cancelReload(){
  if(_reloadTimer){ clearTimeout(_reloadTimer); _reloadTimer = null; }
  isReloading = false;
  const m = document.getElementById('reload-msg'); if(m) m.style.display = 'none';
}
function startReload(){
  if(isReloading || gun.melee) return;
  if(ammo >= gun.maxAmmo || reserve <= 0) return;
  playReload(); isReloading = true;
  reloadStartedAt = performance.now(); reloadDur = gun.reloadTime;
  document.getElementById('reload-msg').style.display = 'block';
  const key = selectedGunKey;
  _reloadTimer = setTimeout(() => {
    _reloadTimer = null;
    // switched weapon mid-reload: the reload belonged to the other gun
    if(selectedGunKey !== key){ isReloading = false; document.getElementById('reload-msg').style.display = 'none'; return; }
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
// How much of the accumulated spray inaccuracy survives each frame. Applied in
// a0-loop next to the recoil decay. 0.92 recovers in about half a second; 1
// would mean it never recovers, which is what the game did before this existed.
const BLOOM_DECAY = 0.92;
const keys={}, enemies=[], obstacles=[], enemyBullets=[], playerBullets=[];
const _BULLET_FWD = new THREE.Vector3(0, 0, -1);  // bullet model's nose axis
const _scratchPrev = new THREE.Vector3();          // reused each frame, never allocated
const _scratchDir  = new THREE.Vector3();
const _scratchTgt  = new THREE.Vector3();
const _scratchFwd  = new THREE.Vector3();
const _scratchRight= new THREE.Vector3();
const _scratchPlyr = new THREE.Vector3();