// ════════════════════════════════════════════════════════════════════════════
//  h0-self.js — your own body, seen in third person
//
//  V already toggled a chase camera long before this file existed. What it did
//  NOT do was give you anything to look at: a0-loop calls buildFirstPersonBody()
//  behind `if(USE_CHARACTER_MODEL ...)`, that flag is false, so _fpBody stayed
//  null and pressing V pulled the camera back off an empty patch of street.
//
//  This builds the same primitive operator every remote player uses, stands it
//  where you are standing, and hands it your current weapon through g0-carry —
//  so what you see when you press V is exactly what your opponents see of you,
//  which is the only version of this worth having.
//
//  Self-contained: delete this file and its PARTS entry and V goes back to
//  being a camera-only debug toggle.
// ════════════════════════════════════════════════════════════════════════════

const _selfHolder = new THREE.Group();
scene.add(_selfHolder);

let _selfObj   = null;    // enemy-shaped wrapper, so g0-carry can pose it
let _selfTeam  = null;    // rebuilt when you swap sides at halftime
let _selfPhase = 0;       // walk cycle
let _selfWasThird = false;

// Same numbers d0-net drives remote players with, so your legs move like
// everyone else's rather than at some private speed.
const SELF_SWING_STEP = 0.22;
const SELF_SWING_AMP  = 0.42;

function selfBuild(team){
  if(_selfObj){ _selfHolder.remove(_selfObj); _selfObj = null; }

  const rig = buildPrimitiveOperator(team);
  const obj = new THREE.Group();
  obj.add(rig.body);
  // Shaped exactly like makeEnemy's userData for the fields g0-carry reads, so
  // the weapon and the arm IK are the same code path remote players use. If it
  // looks right on them it looks right here, and it cannot drift.
  obj.userData = {
    legL: rig.legL, legR: rig.legR,
    armL: rig.armL, armR: rig.armR,
    foreL: rig.foreL, foreR: rig.foreR,
    handL: rig.handL, handR: rig.handR,
    rigBody: rig.body,
  };
  _selfHolder.add(obj);
  _selfObj = obj;
  _selfTeam = team;
  return obj;
}

function selfTeamNow(){
  if(typeof netInMatch !== 'undefined' && netInMatch &&
     typeof netMyTeam !== 'undefined' && netMyTeam) return netMyTeam;
  return 't';
}

// Playing, rather than sat on the title screen with the cinematic running.
function selfInPlay(){
  if(typeof _titleShouldRun === 'function' && _titleShouldRun()) return false;
  return true;
}

(function selfFrame(){
  requestAnimationFrame(selfFrame);

  const want = (typeof thirdPerson !== 'undefined') && thirdPerson && selfInPlay();

  // Leaving third person: hand the viewmodel back to the settings layer rather
  // than guessing at its visibility — applyViewmodel already knows about the
  // HIDDEN setting, scoping and vehicles, and this file should not re-derive
  // any of that.
  if(_selfWasThird && !want){
    if(typeof applyViewmodel === 'function') applyViewmodel();
    else if(typeof playerGun !== 'undefined' && playerGun) playerGun.visible = true;
  }
  _selfWasThird = want;

  _selfHolder.visible = want;
  if(!want) return;

  // The viewmodel hangs off the camera, and in third person the camera is 5.5
  // behind you — so an unhidden gun floats in mid-air between you and the
  // lens. The hands go with it, being children of the holder.
  if(typeof playerGun !== 'undefined' && playerGun) playerGun.visible = false;

  const team = selfTeamNow();
  if(!_selfObj || _selfTeam !== team) selfBuild(team);
  const ud = _selfObj.userData;

  // _playerGroundPos tracks the EYE, and this rig's origin is at its feet —
  // the same subtraction d0-net does before sending a position over the wire.
  const pp = _playerGroundPos;
  _selfHolder.position.set(pp.x, pp.y - FEET_OFFSET, pp.z);
  // No + PI here: the rig's front is local -Z, which is exactly where a body at
  // rotation.y = yaw looks. (The old _fpBody line needed the half turn because
  // the GLB faced the other way.)
  _selfHolder.rotation.y = yaw;

  // Weapon in hand, via the same attach + IK remote players use.
  if(typeof tpAttach === 'function' && typeof selectedGunKey !== 'undefined'){
    if(ud._tpKey !== selectedGunKey) tpAttach(_selfObj, selectedGunKey);
    if(typeof tpPose === 'function') tpPose(ud);
  }

  // Legs. The arms are owned by the carry pose above and deliberately do not
  // swing — same split as remote players: lower body walks, upper body aims.
  const moving = (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD']) && isGrounded;
  if(moving){
    _selfPhase += SELF_SWING_STEP;
    const sw = Math.sin(_selfPhase) * SELF_SWING_AMP;
    ud.legL.rotation.x = sw; ud.legR.rotation.x = -sw;
  } else {
    ud.legL.rotation.x *= 0.8; ud.legR.rotation.x *= 0.8;
  }
})();

console.log('self: V shows your own body (same rig your opponents see)');
