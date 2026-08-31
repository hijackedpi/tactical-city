// ════════════════════════════════════════════════════════════════════════════
//  g0-carry.js — third-person weapons
//
//  Puts a visible weapon in every remote player's hands and puts their hands on
//  it, so you can see what someone is carrying before they shoot you.
//  Self-contained: delete this file and its PARTS entry and remote players go
//  back to walking around empty-handed.
//
//  WHERE THE WEAPON KEY COMES FROM
//  Nothing new goes over the wire. d0-net already sends `weapon: selectedGunKey`
//  with every input packet, the server already stores it on the player and
//  already publishes it in the roster. This file reads netRoster and believes it.
//
//  WHY THE ARMS ARE SOLVED, NOT POSED
//  The first version hand-authored shoulder and elbow angles per weapon class.
//  It looked fine on a rifle and fell apart everywhere else: the support hand
//  ended up 0.28 to the left of the barrel, holding nothing. Hand-tuned angles
//  cannot keep two hands on one weapon across five classes and ten lengths.
//  So the weapon is placed first and the arms are solved onto it with two-bone
//  IK. Move the weapon, retune a grip fraction, add a gun of any length — the
//  hands follow, because they are derived rather than guessed.
//
//  WHY IT RUNS IN ITS OWN FRAME LOOP
//  d0-net drives remote limbs from netInterpolate inside its own rAF loop. This
//  part is loaded after d0-net, so its rAF callback is registered after d0-net's
//  on every frame and therefore runs after it — the carry pose lands on top of
//  the walk swing rather than under it. Same trick f0-hands uses.
// ════════════════════════════════════════════════════════════════════════════

// Real overall lengths in metres, straight out of 10-config's own comments.
// WEAPON_LEN is deliberately NOT this — long guns are foreshortened there to
// keep them out of the player's face in first person. Nobody is looking down a
// remote player's sights, so third person uses honest proportions and a rifle
// visibly out-reaches a pistol.
const TP_LEN = {
  knife:0.30, glock18:0.202, deagle:0.274, mac10:0.295, mp7:0.59,
  mp5:0.68, ump45:0.69, m4a1:0.84, ak47:0.88, awp:1.124,
};

// Clone the real GLB only when the local player has already downloaded it for
// their own use; otherwise build a stand-in out of boxes.
//
// This is deliberate, and it is about the 271 MB of assets. Pulling a rifle down
// because an OPPONENT is holding one means a firefight can kick off several
// multi-megabyte downloads mid-round, on the machine least able to afford the
// stall. The Glock alone decodes to 24.75 MB and 70,533 triangles, and nine of
// those cloned onto remote players is 635k triangles of gun.
//
// The stand-in costs about 30 triangles, is always available, and still tells
// you the thing that matters at range: whether that silhouette is holding a
// pistol or an AWP. Flip this to true once the assets are optimised.
const TP_LOAD_MISSING = false;

const _tpGunMat   = new THREE.MeshStandardMaterial({ color:0x33373d, roughness:0.6,  metalness:0.5 });
const _tpWoodMat  = new THREE.MeshStandardMaterial({ color:0x6b4a2c, roughness:0.85, metalness:0.0 });
const _tpBladeMat = new THREE.MeshStandardMaterial({ color:0xb9c0c8, roughness:0.3,  metalness:0.8 });

// ── CARRY STYLES ────────────────────────────────────────────────────────────
// All in the rig's authored units (feet 0, head 1.81), which is the space the
// shoulders in ARM_SHOULDER live in too.
//
//   hold     where the firing hand goes
//   aim      barrel attitude: pitch down a little, yaw so the butt tucks into
//            the right shoulder while the muzzle stays near the centre line
//   grip     fraction along the weapon the firing hand holds — same convention
//            f0-hands uses, so a weapon is held in the same place in both views
//   support  fraction the other hand holds, or null for one-handed
//
// The classes differ the way they do in the viewmodel, and for the same reason:
//   pistols  hands together, arms pushed out front
//   smgs     support hand on the magwell, elbows in
//   rifles   support hand well down the handguard
//   snipers  support hand back under the stock — you brace a heavy rifle
//   melee    one hand, blade carried low
const CARRY = {
  pistols: { hold:[0.10, 1.30, -0.42], aim:[-0.02, 0.03, 0], grip:0.20, support:0.28 },
  smgs:    { hold:[0.20, 1.26, -0.16], aim:[-0.06, 0.10, 0], grip:0.40, support:0.80 },
  rifles:  { hold:[0.20, 1.26, -0.14], aim:[-0.06, 0.10, 0], grip:0.30, support:0.66 },
  snipers: { hold:[0.21, 1.27, -0.12], aim:[-0.06, 0.10, 0], grip:0.27, support:0.58 },
  melee:   { hold:[0.24, 1.15, -0.24], aim:[ 0.28, 0.06, 0], grip:0.22, support:null },
};

// ── WHERE ON THE WEAPON THE HAND ACTUALLY CLOSES ────────────────────────────
// A fraction along the weapon is only half the answer: it says how far forward
// the hand is, not how far DOWN. Hold a rifle by a point on its centre line and
// the hand ends up inside the receiver with the pistol grip dangling below it.
//
// Rather than hand-tune a drop for ten models that are all shaped differently
// (the MAC-10's magazine is its grip; the AWP has a bipod where a handguard
// would be), measure it from the model. One pass over the real geometry gives,
// for any fraction along the weapon, how far the metal reaches up and down —
// and that is enough to place a hand honestly:
//
//   firing hand   sits just above the LOWEST point at the grip fraction, which
//                 is the bottom of the pistol grip on every real gun
//   support hand  sits at the MIDDLE of the geometry at its fraction, because
//                 it wraps a handguard rather than hanging off one
//
// Checked against the measured profiles of the glock, MP5, AK and AWP: the rule
// lands within a few millimetres of where each grip visibly is.
const TP_BINS = 24;
const TP_HAND_RISE = 0.035;      // half a fist, in metres
const _tpProfiles = {};

function tpProfile(key){
  if(key in _tpProfiles) return _tpProfiles[key];
  const proto = (typeof gunModels !== 'undefined') && gunModels[key];
  if(!proto) return (_tpProfiles[key] = null);

  const len = (typeof WEAPON_LEN !== 'undefined' && WEAPON_LEN[key]) || 0.5;
  const lo = new Float64Array(TP_BINS).fill(Infinity);
  const hi = new Float64Array(TP_BINS).fill(-Infinity);
  const v = new THREE.Vector3(), m = new THREE.Matrix4(), inv = new THREE.Matrix4();
  proto.updateMatrixWorld(true);
  inv.copy(proto.matrixWorld).invert();      // holder-local, whatever it is parented to

  proto.traverse(o => {
    if(!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
    if(o.name === 'viewHands' || (o.parent && o.parent.name === 'viewHands')) return;
    const p = o.geometry.attributes.position;
    m.multiplyMatrices(inv, o.matrixWorld);
    // A few thousand samples is plenty for a min/max envelope, and keeps this
    // cheap on a 70k-triangle model.
    const stride = Math.max(1, Math.floor(p.count / 4000));
    for(let i = 0; i < p.count; i += stride){
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      const f = (len / 2 - v.z) / len;                       // 0 at the butt
      const b = f <= 0 ? 0 : f >= 1 ? TP_BINS - 1 : (f * TP_BINS) | 0;
      if(v.y < lo[b]) lo[b] = v.y;
      if(v.y > hi[b]) hi[b] = v.y;
    }
  });
  return (_tpProfiles[key] = { lo, hi, len });
}

// Nearest non-empty bin to `f`, so a gap in the model never returns Infinity.
function tpSpanAt(prof, f){
  const b0 = Math.max(0, Math.min(TP_BINS - 1, (f * TP_BINS) | 0));
  for(let d = 0; d < TP_BINS; d++){
    for(const b of (d ? [b0 - d, b0 + d] : [b0])){
      if(b < 0 || b >= TP_BINS) continue;
      if(prof.lo[b] !== Infinity) return { lo: prof.lo[b], hi: prof.hi[b] };
    }
  }
  return null;
}

// Hand heights in metres, for a weapon drawn at `len` metres.
function tpHandHeights(key, style, len){
  const prof = tpProfile(key);
  if(!prof){
    // The box stand-in, whose grip this file put there itself.
    return { gripY: -0.070, supportY: 0 };
  }
  const k = len / prof.len;                    // fitted units -> metres on the body
  const g = tpSpanAt(prof, style.grip);
  const gripY = g ? g.lo * k + TP_HAND_RISE : -0.070;
  let supportY = 0;
  if(style.support != null){
    const sp = tpSpanAt(prof, style.support);
    // A pistol's off hand cups the firing hand rather than a handguard, so it
    // follows the grip rule instead of the mid-body one.
    if(sp) supportY = (style.grip === CARRY.pistols.grip && style.support === CARRY.pistols.support)
      ? sp.lo * k + TP_HAND_RISE
      : (sp.lo + sp.hi) * 0.5 * k;
  }
  return { gripY, supportY };
}
// Which way each elbow is pushed: down, out to the side, and a little back.
// Without this the solver is free to put the elbow anywhere on a circle, and
// it will happily choose "bent up behind the head".
const TP_POLE = [0.75, -1.0, 0.42];

// Resting pose for an arm with nothing to do (the off hand on a knife).
const TP_REST_ARM = -0.22, TP_REST_FORE = 0.30;

// ── STAND-IN WEAPONS ────────────────────────────────────────────────────────
// Built at the same length the real model would be, so turning TP_LOAD_MISSING
// on does not move anybody's hands or change their silhouette.
function tpBuildStandIn(key, len){
  const cat = (GUNS[key] && GUNS[key].category) || 'rifles';
  const g = new THREE.Group();
  const add = (w, h, d, mat, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(0, y, z); m.castShadow = false; g.add(m);
  };
  if(cat === 'melee'){
    add(0.024, 0.034, len * 0.52, _tpBladeMat, 0, -len * 0.24);
    add(0.032, 0.046, len * 0.40, _tpWoodMat,  0,  len * 0.30);
    return g;
  }
  const grip = CARRY[cat] ? CARRY[cat].grip : 0.26;
  add(0.038, 0.062, len,           _tpGunMat,  0.000, 0);                    // receiver
  add(0.034, 0.092, 0.055,         _tpGunMat, -0.070, len * (0.5 - grip));   // pistol grip
  if(cat !== 'pistols'){
    add(0.032, 0.110, 0.058,       _tpGunMat, -0.074, len * (0.30 - grip));  // magazine
    add(0.046, 0.058, len * 0.24,  _tpWoodMat, -0.006, len * 0.37);          // stock
  }
  return g;
}

// ── TWO-BONE IK ─────────────────────────────────────────────────────────────
// Closed form, no iteration. Given the shoulder socket and a target for the
// hand, put the elbow on the circle where both bones can reach, pick the point
// on that circle nearest the pole, then build the shoulder's frame directly:
// local -Y down the upper arm, local X along the bend axis. The elbow angle
// then falls out of the forearm's direction in that frame.
const _ikS = new THREE.Vector3(), _ikT = new THREE.Vector3(), _ikE = new THREE.Vector3();
const _ikD = new THREE.Vector3(), _ikP = new THREE.Vector3(), _ikF = new THREE.Vector3();
const _ikX = new THREE.Vector3(), _ikY = new THREE.Vector3(), _ikZ = new THREE.Vector3();
const _ikM = new THREE.Matrix4();

function tpSolveArm(armPivot, forePivot, sx, sy, sz, tx, ty, tz, side){
  const L1 = (typeof ARM_UPPER_LEN !== 'undefined' ? ARM_UPPER_LEN : 0.44);
  const L2 = (typeof ARM_FORE_LEN  !== 'undefined' ? ARM_FORE_LEN  : 0.32);

  _ikS.set(sx, sy, sz);
  _ikD.set(tx - sx, ty - sy, tz - sz);
  let d = _ikD.length();
  if(d < 1e-5){ _ikD.set(0, -1, 0); d = 1e-5; }
  _ikD.divideScalar(d);
  // Clamp instead of failing: a target further away than the arm is long just
  // straightens it, which is what a real shoulder does too.
  d = Math.max(Math.abs(L1 - L2) + 1e-3, Math.min(L1 + L2 - 1e-3, d));

  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));

  _ikP.set(TP_POLE[0] * side, TP_POLE[1], TP_POLE[2]);
  _ikP.addScaledVector(_ikD, -_ikP.dot(_ikD));               // only the part across the bone
  if(_ikP.lengthSq() < 1e-8){ _ikP.set(0, 0, 1).addScaledVector(_ikD, -_ikD.z); }
  _ikP.normalize();
  _ikE.copy(_ikS).addScaledVector(_ikD, a).addScaledVector(_ikP, h);

  _ikY.subVectors(_ikS, _ikE).normalize();                   // upper arm hangs down local -Y
  _ikF.set(tx - _ikE.x, ty - _ikE.y, tz - _ikE.z).normalize();
  _ikX.crossVectors(_ikF, _ikY);
  if(_ikX.lengthSq() < 1e-8) _ikX.crossVectors(_ikP, _ikY);  // arm dead straight
  _ikX.normalize();
  _ikZ.crossVectors(_ikX, _ikY).normalize();
  _ikM.makeBasis(_ikX, _ikY, _ikZ);
  armPivot.quaternion.setFromRotationMatrix(_ikM);

  // Forearm rest direction is local -Y, so after a bend of t about local X it
  // points (0, -cos t, -sin t) in the frame just built.
  forePivot.rotation.set(Math.atan2(-_ikF.dot(_ikZ), -_ikF.dot(_ikY)), 0, 0);
}

// ── ATTACH ──────────────────────────────────────────────────────────────────
const _tpQ = new THREE.Quaternion(), _tpE = new THREE.Euler();
const _tpOff = new THREE.Vector3(), _tpSup = new THREE.Vector3();

function tpAttach(obj, key){
  const ud = obj.userData;
  if(!ud || !ud.handR || !ud.foreR || !ud.rigBody) return false;   // not our rig

  if(ud._tpGun && ud._tpGun.parent) ud._tpGun.parent.remove(ud._tpGun);

  const cat   = (GUNS[key] && GUNS[key].category) || 'rifles';
  const style = CARRY[cat] || CARRY.rifles;
  const len   = TP_LEN[key] || 0.6;

  let gun = null;
  if(typeof gunModels !== 'undefined' && gunModels[key]){
    gun = gunModels[key].clone();
    // gunModels IS the live viewmodel holder, so this clone carries f0-hands'
    // first-person gloves. Left on, every remote player would be holding a gun
    // with a second pair of hands already welded to it.
    const stray = gun.getObjectByName('viewHands');
    if(stray && stray.parent) stray.parent.remove(stray);
    // clone() copies `visible`, and the thing being cloned is the LIVE
    // viewmodel holder whose visibility is driven for reasons that have nothing
    // to do with this body: it is false while you are scoped, while the
    // VIEWMODEL setting is HIDDEN, while the title cinematic runs, and while
    // h0-self is hiding it for the third-person view. Cloned as-is, the weapon
    // is born invisible and the player appears to be holding nothing.
    // Only the holder ROOT is ever touched by that machinery, so forcing it
    // here cannot override anything the artist authored inside the model.
    // makeGunPickup does the same thing to dropped guns, for the same reason.
    gun.visible = true;
    // fitWeaponModel turns culling off because the viewmodel rides the camera.
    // A weapon on someone else's body across the map should cull normally.
    gun.traverse(o => { if(o.isMesh) o.frustumCulled = true; });
    const fitted = (typeof WEAPON_LEN !== 'undefined' && WEAPON_LEN[key]) || len;
    gun.scale.setScalar(len / fitted);
  } else {
    gun = tpBuildStandIn(key, len);
    if(TP_LOAD_MISSING && typeof loadWeapon === 'function') loadWeapon(key);
  }

  // Parented to the rig body, NOT to a hand: the hands are solved onto the
  // weapon, so the weapon has to be the fixed thing. It also means the muzzle
  // cannot wander when the pose is retuned.
  _tpE.set(style.aim[0], style.aim[1], style.aim[2]);
  gun.quaternion.setFromEuler(_tpE);

  // Measured from the model itself: how far below its centre line the pistol
  // grip hangs, and where the handguard sits.
  const hh = tpHandHeights(key, style, len);

  // Slide it along AND across itself so the GRIP, not the model's centre, sits
  // at `hold`. Without the along part a pistol and an AWP would both be held in
  // the middle and the AWP's stock would come out through the player's back;
  // without the across part the hand closes inside the receiver with the grip
  // swinging under it.
  _tpOff.set(0, hh.gripY, len * (0.5 - style.grip)).applyQuaternion(gun.quaternion);
  gun.position.set(style.hold[0] - _tpOff.x, style.hold[1] - _tpOff.y, style.hold[2] - _tpOff.z);
  ud.rigBody.add(gun);

  // Where the support hand has to be: the point at `support` along the weapon,
  // at the height the metal actually is there.
  if(style.support != null){
    _tpSup.set(0, hh.supportY - hh.gripY, len * (style.grip - style.support))
          .applyQuaternion(gun.quaternion);
    _tpSup.add(new THREE.Vector3(style.hold[0], style.hold[1], style.hold[2]));
  }

  ud._tpGun = gun;
  ud._tpKey = key;
  ud._tpStyle = style;
  ud._tpSupport = style.support == null ? null : _tpSup.clone();
  return true;
}

// Reassert the pose every frame: d0-net swings both arms from the shoulder
// whenever a player is moving, which would otherwise wave the rifle around like
// a walking stick. Legs keep swinging; the upper body stays on the weapon.
function tpPose(ud){
  const st = ud._tpStyle;
  if(!st) return;
  const S = (typeof ARM_SHOULDER !== 'undefined' ? ARM_SHOULDER : [0.31, 1.50, 0]);
  tpSolveArm(ud.armR, ud.foreR,  S[0], S[1], S[2], st.hold[0], st.hold[1], st.hold[2],  1);
  if(ud._tpSupport){
    const t = ud._tpSupport;
    tpSolveArm(ud.armL, ud.foreL, -S[0], S[1], S[2], t.x, t.y, t.z, -1);
  } else {
    // rotation.set is enough to undo a quaternion set by a previous solve —
    // Three.js keeps the two in step through Euler's change callback.
    ud.armL.rotation.set(TP_REST_ARM, 0, 0);
    ud.foreL.rotation.set(TP_REST_FORE, 0, 0);
  }
}

// ── FRAME ───────────────────────────────────────────────────────────────────
(function tpFrame(){
  requestAnimationFrame(tpFrame);
  if(typeof netRemote === 'undefined' || typeof netRoster === 'undefined') return;

  for(const [id, r] of netRemote){
    const obj = r.obj;
    if(!obj || !obj.userData || !obj.userData.handR) continue;
    const info = netRoster.find(p => p.id === id);
    const key  = (info && info.weapon) || 'glock18';
    if(obj.userData._tpKey !== key && !tpAttach(obj, key)) continue;
    tpPose(obj.userData);
  }
})();

console.log('carry: remote players are holding their weapons' +
            (TP_LOAD_MISSING ? '' : ' (stand-ins for models not downloaded)'));
