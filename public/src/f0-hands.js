// ════════════════════════════════════════════════════════════════════════════
//  f0-hands.js — viewmodel hands
//
//  Gloved hands gripping whatever you are holding, posed differently per
//  weapon class. Self-contained: delete this file and its PARTS entry and the
//  guns float exactly as they did before.
//
//  WHY THEY HANG OFF THE GUN
//  The hands are parented to playerGun (the fitted holder), not to the camera.
//  That single decision buys most of the behaviour for free:
//    · recoil        a0-loop moves playerGun every frame; children follow
//    · viewmodel     LEFT/RIGHT/HIDDEN already moves and hides the holder
//    · scoping       setScoped() hides playerGun, so the hands go too
//    · title screen  e0-title hides playerGun, likewise
//  None of that needs a single extra line here.
//
//  fitWeaponModel centres each model on its own origin with the barrel down
//  -Z and the long axis scaled to WEAPON_LEN, so in holder-local space the
//  weapon runs from z = +len/2 (butt) to z = -len/2 (muzzle) whatever the
//  artist exported. Grips are therefore expressed as a FRACTION along the
//  weapon and work for every gun without hand-tuning each one.
//
//  HOW A GRIP IS DESCRIBED
//  Two vectors, which is the whole trick:
//    rod  the axis of the thing being held. A pistol grip is a near-vertical
//         post, a rifle handguard is horizontal along the barrel. These are
//         90° apart, and a hand that wraps one does not look like a hand that
//         wraps the other — that difference is what makes an AK read as an AK.
//    arm  which way the forearm leaves the wrist. The roll around `rod` is
//         then solved for, so you never hand-tune Euler angles.
// ════════════════════════════════════════════════════════════════════════════

const HAND_SKIN  = new THREE.MeshStandardMaterial({ color:0xb08258, roughness:0.8,  metalness:0.0  });
const HAND_GLOVE = new THREE.MeshStandardMaterial({ color:0x4b4f57, roughness:0.85, metalness:0.05 });
const HAND_KNUX  = new THREE.MeshStandardMaterial({ color:0x33363c, roughness:0.9,  metalness:0.05 });
const HAND_CUFF  = new THREE.MeshStandardMaterial({ color:0x5a5535, roughness:0.9,  metalness:0.02 });

// Shared geometry — one set for every hand ever built.
const _HG = {
  fist:    new THREE.BoxGeometry(0.090, 0.095, 0.082),
  finger:  new THREE.BoxGeometry(0.088, 0.026, 0.030),
  thumb:   new THREE.BoxGeometry(0.032, 0.050, 0.032),
  wrist:   new THREE.BoxGeometry(0.062, 0.050, 0.072),
  cuff:    new THREE.BoxGeometry(0.080, 0.052, 0.088),
  forearm: new THREE.BoxGeometry(0.066, 0.185, 0.076),
};

// CANONICAL HAND — a closed fist wrapped around a rod that runs along local X
// and passes through the origin. Knuckles face +Z, thumb sits at the +X end of
// the rod, and the forearm leaves the wrist along -Y. Everything else in this
// file is just rotating this one shape onto a grip.
function buildHand(mirror){
  const g = new THREE.Group();
  const m = mirror ? -1 : 1;
  const add = (geo, mat, x, y, z, rx, ry, rz) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(x * m, y, z);
    if(rx || ry || rz) o.rotation.set(rx || 0, (ry || 0) * m, (rz || 0) * m);
    o.castShadow = o.receiveShadow = false;
    o.frustumCulled = false;      // it rides the camera; never cull it
    g.add(o);
  };

  add(_HG.fist,    HAND_GLOVE,  0.006,  0.004,  0.000);
  add(_HG.finger,  HAND_KNUX,   0.006,  0.031,  0.047);   // knuckle row
  add(_HG.finger,  HAND_KNUX,   0.006, -0.004,  0.051);   // second row, curling under
  add(_HG.thumb,   HAND_GLOVE,  0.050,  0.012,  0.026, 0, 0, 0.40);
  add(_HG.wrist,   HAND_SKIN,   0.000, -0.070,  0.002);
  add(_HG.cuff,    HAND_CUFF,   0.000, -0.108,  0.004);
  add(_HG.forearm, HAND_CUFF,   0.000, -0.225,  0.008);
  return g;
}

// ── GRIP STYLES ─────────────────────────────────────────────────────────────
// `at` is the fraction along the weapon: 0 = butt, 1 = muzzle.
// `off` nudges the fist in holder-local units (the rod should end up running
// through the fist, so a hand on the barrel sits just under it while a hand on
// a pistol grip sits well below).
//
// `scale` is not vanity. WEAPON_LEN is not a uniform shrink of reality: the
// Glock is drawn at life size (0.21 for a 202 mm pistol) while the AWP is
// squeezed to 66% (0.74 for 1124 mm), because long guns are foreshortened to
// keep them out of the player's face. A single hand size would therefore be
// right on the pistol and enormous on the sniper. These numbers track that
// same compression per class.
//
// The differences are the point of this file:
//   pistols  both fists on the same near-vertical grip post, the support hand
//            cupping alongside — the modern thumbs-forward stance
//   smgs     support hand forward on a horizontal magwell, elbow tucked in
//   rifles   support hand a long way down the handguard, arm clearly extended
//            — the silhouette that reads instantly as "rifle"
//   snipers  support hand pulled back under the stock rather than out front,
//            because you brace a heavy rifle, you do not steer it
//   melee    one hand, hammer grip along the handle, no support
const GRIP_STYLE = {
  pistols: {
    scale: 1.00,
    main:    { at:0.30, rod:[0, 1, 0.26], arm:[ 0.12, -0.52, 1.00], off:[ 0.006, -0.078,  0.008] },
    support: { at:0.31, rod:[0, 1, 0.26], arm:[-0.34, -0.62, 1.00], off:[-0.056, -0.090,  0.002] },
  },
  smgs: {
    scale: 0.88,
    main:    { at:0.26, rod:[0, 1, 0.30], arm:[ 0.10, -0.66, 1.00], off:[ 0.006, -0.074,  0.006] },
    support: { at:0.56, rod:[0, 0, 1.00], arm:[-0.46, -1.00, 0.30], off:[-0.012, -0.030,  0.000] },
  },
  rifles: {
    scale: 0.82,
    main:    { at:0.24, rod:[0, 1, 0.32], arm:[ 0.10, -0.70, 1.00], off:[ 0.006, -0.072,  0.006] },
    support: { at:0.72, rod:[0, 0, 1.00], arm:[-0.32, -1.00, 0.22], off:[-0.012, -0.030,  0.000] },
  },
  snipers: {
    scale: 0.78,
    main:    { at:0.22, rod:[0, 1, 0.34], arm:[ 0.10, -0.74, 1.00], off:[ 0.006, -0.070,  0.006] },
    support: { at:0.50, rod:[0, 0, 1.00], arm:[-0.20, -1.00, 0.46], off:[-0.012, -0.030,  0.000] },
  },
  melee: {
    scale: 1.00,
    main:    { at:0.32, rod:[0, 0, 1.00], arm:[-0.06, -1.00, 0.34], off:[ 0.008, -0.014,  0.004] },
    support: null,
  },
};

// ── POSING ──────────────────────────────────────────────────────────────────
// Rotate the canonical hand so its local +X lies along `rod`, then roll it
// about `rod` until the forearm (local -Y) points as close to `arm` as the
// rod allows. Solving the roll instead of authoring it is what keeps the
// styles above readable — and correct when a weapon's length changes.
const _HX   = new THREE.Vector3(1, 0, 0);
const _hRod = new THREE.Vector3(), _hArm = new THREE.Vector3();
const _hCur = new THREE.Vector3(), _hCrs = new THREE.Vector3();
const _hQ1  = new THREE.Quaternion(), _hQ2 = new THREE.Quaternion();

function placeHand(hand, spec, len, side, scale){
  // butt is +len/2, muzzle is -len/2, so walk forward from the butt
  const z = (len / 2) - spec.at * len + spec.off[2];
  hand.position.set(spec.off[0] * side, spec.off[1], z);
  hand.scale.setScalar(scale);

  _hRod.set(spec.rod[0] * side, spec.rod[1], spec.rod[2]).normalize();
  _hQ1.setFromUnitVectors(_HX, _hRod);

  // Where the forearm points after that first rotation, and where we want it.
  _hCur.set(0, -1, 0).applyQuaternion(_hQ1);
  _hArm.set(spec.arm[0] * side, spec.arm[1], spec.arm[2]).normalize();

  // Both flattened into the plane perpendicular to the rod — the only part of
  // the difference a roll can actually fix.
  _hCur.addScaledVector(_hRod, -_hCur.dot(_hRod));
  _hArm.addScaledVector(_hRod, -_hArm.dot(_hRod));
  if(_hCur.lengthSq() < 1e-8 || _hArm.lengthSq() < 1e-8){ hand.quaternion.copy(_hQ1); return; }
  _hCur.normalize(); _hArm.normalize();

  const roll = Math.atan2(_hCrs.crossVectors(_hCur, _hArm).dot(_hRod), _hCur.dot(_hArm));
  _hQ2.setFromAxisAngle(_hRod, roll);
  hand.quaternion.copy(_hQ2).multiply(_hQ1);
}

// Build (or rebuild) the pair for one weapon and hang it off the holder.
function attachHands(holder, key){
  const old = holder.userData._hands;
  if(old){ holder.remove(old); }

  const cat   = (GUNS[key] && GUNS[key].category) || 'rifles';
  const style = GRIP_STYLE[cat] || GRIP_STYLE.rifles;
  const len   = (typeof WEAPON_LEN !== 'undefined' && WEAPON_LEN[key]) || 0.5;
  // viewSide flips the whole viewmodel for a left-handed player, so the hands
  // have to flip with it or the thumbs point the wrong way.
  const side  = (typeof viewSide !== 'undefined' ? viewSide : 1);

  const rig = new THREE.Group();
  rig.name = 'viewHands';

  // fitWeaponModel puts the LONG axis down Z but cannot know which end is the
  // muzzle, so WEAPON_FIX.flip exists to spin a backwards model 180 degrees.
  // That spin happens inside the holder, so without this the hands would stay
  // put and end up gripping the barrel. Rotating the whole rig instead of
  // negating coordinates keeps the poses (and the handedness) intact.
  const fix = (typeof WEAPON_FIX !== 'undefined' && WEAPON_FIX[key]) || {};
  if(fix.flip) rig.rotation.y = Math.PI;

  const sc = style.scale || 1;
  const main = buildHand(side < 0);
  placeHand(main, style.main, len, side, sc);
  rig.add(main);

  if(style.support){
    const sup = buildHand(side > 0);          // opposite handedness
    placeHand(sup, style.support, len, side, sc);
    rig.add(sup);
  }

  holder.add(rig);
  holder.userData._hands = rig;
  holder.userData._handsKey = key + ':' + side + ':' + (fix.flip ? 1 : 0);
  return rig;
}

// Idempotent, run once a frame. Cheaper than hooking equipGun, loadWeapon and
// applyViewmodel separately, and it cannot get out of step with a weapon that
// finishes downloading later.
(function handsFrame(){
  requestAnimationFrame(handsFrame);
  if(typeof playerGun === 'undefined' || !playerGun) return;
  if(typeof selectedGunKey === 'undefined' || !selectedGunKey) return;
  const side = (typeof viewSide !== 'undefined' ? viewSide : 1);
  const fix  = (typeof WEAPON_FIX !== 'undefined' && WEAPON_FIX[selectedGunKey]) || {};
  const want = selectedGunKey + ':' + side + ':' + (fix.flip ? 1 : 0);
  if(playerGun.userData._handsKey !== want) attachHands(playerGun, selectedGunKey);
})();

// A dropped weapon is cloned straight from gunModels, which now carries hands.
// Strip them, or the floor ends up littered with disembodied gloves.
if(typeof makeGunPickup === 'function'){
  const _origMakePickup = makeGunPickup;
  makeGunPickup = function(key, x, z){
    const before = new Set(droppedGuns.map(d => d.mesh));
    const r = _origMakePickup(key, x, z);
    for(const dg of droppedGuns){
      if(before.has(dg.mesh)) continue;
      const hands = dg.mesh.getObjectByName('viewHands');
      if(hands && hands.parent) hands.parent.remove(hands);
    }
    return r;
  };
}

console.log('hands: viewmodel grips active (pistol / smg / rifle / sniper / melee)');
