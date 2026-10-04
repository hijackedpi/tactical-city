// ── FIRST-PERSON BODY ── a visible operator body under the camera (legs+torso).
// Head is hidden (camera sits where the head is). Follows camera x/z + yaw, not
// pitch, so the body stays upright while you look up/down.
let _fpBody = null;          // the body group attached to the scene
let thirdPerson = false;     // V toggles a debug third-person camera
let _playerGroundPos = new THREE.Vector3(0, 1.7, 0);  // tracks the player's eye position across view modes
let _fpMixer = null;         // its own animation mixer
let _fpRunAction = null;
const _fpBodyHolder = new THREE.Group();   // we move this to follow the camera
scene.add(_fpBodyHolder);
function buildFirstPersonBody(){
  if(_fpBody || !_operatorReady || !_operatorProto) return;
  _fpBody = skeletonClone(_operatorProto);
  _fpBody.scale.setScalar(OPERATOR_SCALE);
  _fpBody.position.y = 0;                     // this rig has feet at y=0
  // Hide ONLY the head (not the neck — hiding the neck collapsed the torso too,
  // since the neck bone is a parent in the chain).
  _fpBody.traverse(o=>{
    if(o.isBone && (o.name === 'Head' || o.name === 'headfront' || o.name === 'head_end')){
      o.scale.setScalar(0.001);
    }
    if(o.isMesh){ o.castShadow = true; o.frustumCulled = false; }
  });
  // Small back offset so shoulders don't crowd the camera, but not so far the
  // body sits behind you.
  _fpBody.position.z = 0.10;
  _fpBodyHolder.add(_fpBody);
  if(_operatorWalkClip){
    _fpMixer = new THREE.AnimationMixer(_fpBody);
    _fpRunAction = _fpMixer.clipAction(_operatorWalkClip);
    _fpRunAction.play();
    _fpRunAction.paused = true;             // only animate while moving
  }
  console.log('First-person body ready.');
}

// ── ENEMIES ────────────────────────────────────────────────────────────────
// Load the rigged + animated Meshy operator ONCE; every enemy is a SkeletonUtils
// clone (so each keeps its own skeleton + mixer and animates independently).
let _operatorTris = 0;           // triangles in ONE enemy — multiplied per enemy on screen
let _operatorProto = null;       // the loaded gltf.scene (null until ready)
let _operatorWalkClip = null;    // the walking AnimationClip
let _operatorReady = false;
// Set to true to load the rigged character again — point OPERATOR_FILE at a
// decimated GLB first (see shrink-model.mjs), or this costs 252k triangles
// per character drawn.
const USE_CHARACTER_MODEL = false;
const OPERATOR_FILE  = 'Meshy_AI_Desert_Ops_Soldier_biped_Animation_Walking_withSkin.glb';
const OPERATOR_SCALE  = 1.088;   // 1.7-tall model -> ~1.85 units
const OPERATOR_FOOT_Y = 0.0;     // this rig has feet at y=0
const _enemyMixers = [];         // every active enemy's AnimationMixer
(function loadOperator(){
  if(!USE_CHARACTER_MODEL){
    console.log('Character model disabled — skipping', OPERATOR_FILE);
    return;
  }
  const loader = new GLTFLoader();
  loader.load(OPERATOR_FILE, gltf => {
    _operatorProto = gltf.scene;
    _operatorTris = 0;
    _operatorProto.traverse(o => {
      if(o.isMesh && o.geometry){
        const g = o.geometry;
        _operatorTris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      }
    });
    console.log('Operator model:', _operatorTris.toLocaleString(), 'triangles per enemy');
    _operatorProto.traverse(o=>{ if(o.isMesh){ o.castShadow = true; o.frustumCulled = true; } });
    _operatorWalkClip = gltf.animations[0] || null;   // "Armature|walking_man|baselayer"
    _operatorReady = true;
    console.log('Operator (walking) loaded. clip:', _operatorWalkClip && _operatorWalkClip.name);
  }, undefined, err => {
    console.warn('Operator model failed to load — check the .glb is next to your HTML.', err);
    _operatorReady = false;
  });
})();
// ── PRIMITIVE OPERATOR ──────────────────────────────────────────────────────
// A stand-in body, used whenever the rigged GLB is not loaded — which, with
// USE_CHARACTER_MODEL false, is always.
//
// This exists because the old fallback returned a bare Group: no mesh, and no
// userData either, so `e.userData.hp -= dmg` evaluated `undefined - 20` -> NaN
// and `NaN <= 0` is false. Remote players would have been invisible AND
// unkillable. It is also 340 triangles against the rigged model's 252,000, so
// ten of them cost less than one of those.
//
// Geometry and materials are built ONCE at module scope and shared by every
// body; only the team-tinted parts are cloned per player.
// Laid out so the FEET sit at y = 0 and the head tops out at 1.81, matching the
// 1.8-unit player capsule. The first version had no shin: the thigh stopped at
// 0.40 and the boot at 0.28, so the whole body hovered 0.28 above its own
// origin and stood only 1.52 tall.
const _OPS = {
  head:  new THREE.BoxGeometry(0.26, 0.28, 0.28),
  visor: new THREE.BoxGeometry(0.235, 0.09, 0.30),
  neck:  new THREE.BoxGeometry(0.17, 0.14, 0.17),
  torso: new THREE.BoxGeometry(0.50, 0.52, 0.30),
  vest:  new THREE.BoxGeometry(0.54, 0.34, 0.34),
  yoke:  new THREE.BoxGeometry(0.62, 0.15, 0.30),   // shoulder line
  hips:  new THREE.BoxGeometry(0.46, 0.20, 0.28),
  upper: new THREE.BoxGeometry(0.16, 0.44, 0.17),
  fore:  new THREE.BoxGeometry(0.14, 0.28, 0.15),
  hand:  new THREE.BoxGeometry(0.10, 0.12, 0.13),
  thigh: new THREE.BoxGeometry(0.17, 0.46, 0.18),
  shin:  new THREE.BoxGeometry(0.145, 0.44, 0.16),
  boot:  new THREE.BoxGeometry(0.18, 0.12, 0.26),
  // ONE unit cylinder lying along X, scaled per joint. Every limb here swings
  // about X, and a cylinder centred on the axis of rotation is invariant under
  // it — so it can never uncover the joint. See `cap` in buildPrimitiveOperator.
  joint: new THREE.CylinderGeometry(1, 1, 1, 12).rotateZ(Math.PI / 2),
};
const _opGear = new THREE.MeshStandardMaterial({ color:0x2b2d31, roughness:0.85, metalness:0.05 });
const _opSkin = new THREE.MeshStandardMaterial({ color:0x8d6a4d, roughness:0.9,  metalness:0.0  });
const _opVisor= new THREE.MeshStandardMaterial({ color:0x11161c, roughness:0.25, metalness:0.6  });
// Team colour is the whole point of the placeholder — you must be able to tell
// friend from enemy across a courtyard before anything else matters.
const _opTeamMat = {
  t:  new THREE.MeshStandardMaterial({ color:0xc08a3e, roughness:0.8, metalness:0.05 }),  // desert tan
  ct: new THREE.MeshStandardMaterial({ color:0x3f6d9e, roughness:0.8, metalness:0.05 }),  // police blue
};

// ── HOW BIG A PLAYER IS ─────────────────────────────────────────────────────
// The rig below is authored at 1.81 units, matching the 1.8 player capsule.
// This multiplies it. Because the feet are at exactly y = 0, scaling from the
// origin keeps them on the floor — no re-offsetting needed, whatever you set.
//
//   1.00  exactly capsule height, the "correct" value — 1.81 units
//   1.08  a visibly solid operator — 1.95 units
//   1.62  50% larger again — 2.93 units (current)
//
// NOTE the collision capsule is still 1.8 tall and does not scale with this.
// Above ~1.20 the model's head passes through geometry the body is still
// blocked by, and vice versa: a player can walk under an arch their head goes
// straight through. That is cosmetic, not a crash, but it is why the "correct"
// value is 1.00. Hitboxes DO scale with this — see HITBOX further down — so a
// bigger model is correspondingly bigger to shoot.
const _OP_SCALE = 1.62;
const _OP_BASE_H = 1.81;                      // authored height, before scaling

// Arm metrics, published because posing this rig from outside needs them and
// re-deriving them by hand is how they drift out of step with the geometry.
// Shoulder sockets, then the two bone lengths: pivot -> elbow -> hand.
const ARM_SHOULDER = [0.31, 1.50, 0.00];
const ARM_UPPER_LEN = 0.44;
const ARM_FORE_LEN  = 0.32;

function buildPrimitiveOperator(team){
  const b = new THREE.Group();
  const teamMat = _opTeamMat[team] || _opTeamMat.t;
  const put = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    // The sun's shadow map is baked once and never updated, so a moving body
    // that cast shadows would leave a frozen silhouette at its spawn point.
    m.castShadow = false; m.receiveShadow = false;
    b.add(m);
    return m;
  };

  put(_OPS.hips,  _opGear,  0, 0.96, 0);   // 0.86 - 1.06
  put(_OPS.torso, teamMat,  0, 1.32, 0);   // 1.06 - 1.58
  put(_OPS.vest,  _opGear,  0, 1.26, 0);   // 1.09 - 1.43
  // The yoke is what turns two sticks beside a box into shoulders. It reaches
  // out to exactly the arm pivots, so the arms grow out of the body instead of
  // sitting flush against its side — flush faces read as a seam, not a joint.
  put(_OPS.yoke,  teamMat,  0, 1.50, 0);   // 1.425 - 1.575, x +/-0.31
  put(_OPS.neck,  _opSkin,  0, 1.53, 0);   // bridges torso top and head bottom
  put(_OPS.head,  _opSkin,  0, 1.67, 0);   // 1.53 - 1.81
  // Visor and boot toes point down -Z, because -Z is forward: a0-loop sets a
  // remote's rotation.y from netYaw, and the camera's own look vector at that
  // yaw is (-sin, 0, -cos) — local -Z. These used to face +Z, which matched the
  // BOTS' convention (atan2(dx,dz) makes local +Z point at you) but was exactly
  // backwards for people. With bots disabled, that meant every remote player in
  // the game was rendered facing away from wherever they were actually looking.
  put(_OPS.visor, _opVisor, 0, 1.67, -0.02);

  // Limbs hang from pivots at the joint, so rotating the pivot swings the limb
  // from the hip/shoulder rather than about its own centre.
  const jointed = (x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    b.add(pivot);
    return pivot;
  };

  // A cap on the two joints that actually rotate. Radius only has to clear the
  // limb's half DEPTH, because a swing about X moves the top face within a
  // circle of exactly that radius — so the cap covers the sweep at every angle
  // and the seam cannot reopen however the walk cycle is retuned later.
  //
  // This is what used to tear open: the thigh overlapped the hips by 0.02, but
  // a 0.42 rad swing drops its front corner 0.18/2 * sin(0.42) = 0.037. Every
  // stride opened a 0.017 wedge at the hip. The shoulders never even touched —
  // the arms were flush against the torso's side face, which is a seam, not a
  // joint.
  //
  // The knee and elbow get no cap on purpose: thigh/shin and upper/forearm are
  // both children of the SAME pivot and never rotate relative to one another,
  // so their overlap is rigid. A cap there would only be a shape to z-fight
  // with, which is exactly what a sphere did on the first attempt.
  const cap = (parent, y, r, len, mat) => {
    const m = new THREE.Mesh(_OPS.joint, mat);
    m.position.y = y; m.scale.set(len, r, r);
    m.castShadow = false; m.receiveShadow = false;
    parent.add(m);
    return m;
  };

  // Hip joint at 0.90, so the chain reaches the floor exactly:
  //   thigh 0.44-0.90   shin 0.02-0.46   boot 0.00-0.12
  const legL = jointed(-0.13, 0.90), legR = jointed(0.13, 0.90);
  for(const leg of [legL, legR]){
    // len 0.175, not 0.18: at 0.18 the cap's end face landed exactly on the
    // hip block's side face and the two z-fought into a moire ring.
    cap(leg, 0, 0.097, 0.175, teamMat);                 // hip   (thigh depth 0.18)
    const thigh = new THREE.Mesh(_OPS.thigh, teamMat);
    thigh.position.y = -0.23; thigh.castShadow = false; leg.add(thigh);
    const shin = new THREE.Mesh(_OPS.shin, _opGear);
    shin.position.y = -0.66; shin.castShadow = false; leg.add(shin);
    const boot = new THREE.Mesh(_OPS.boot, _opGear);
    boot.position.set(0, -0.84, -0.03); boot.castShadow = false; leg.add(boot);
  }

  // Arms pulled in from 0.33 to 0.31 so the upper arm OVERLAPS the torso by
  // 0.02 instead of being exactly coplanar with it.
  // The elbow BENDS. A straight arm cannot hold a rifle: the hand is stuck on
  // a 0.78 sphere around the shoulder, and a weapon at the ready needs it much
  // closer to the chest than that. So the forearm hangs off its own pivot —
  // which makes the elbow a rotating joint, and therefore one that needs a cap
  // like the other two.
  const armL = jointed(-0.31, 1.50), armR = jointed(0.31, 1.50);
  const hands = [], fores = [];
  for(const arm of [armL, armR]){
    cap(arm, 0, 0.092, 0.17, teamMat);                  // shoulder (arm depth 0.17)
    const upper = new THREE.Mesh(_OPS.upper, teamMat);
    upper.position.y = -0.22; upper.castShadow = false; arm.add(upper);

    const fore = new THREE.Group();                      // elbow pivot
    fore.position.y = -0.44;
    arm.add(fore);
    cap(fore, 0, 0.080, 0.152, _opSkin);                // elbow (forearm depth 0.15)
    const fm = new THREE.Mesh(_OPS.fore, _opSkin);
    fm.position.y = -0.14; fm.castShadow = false; fore.add(fm);

    // A real hand, not a stub: it gives the arm somewhere to end and gives the
    // weapon somewhere to hang. Named so third-person kit can find it.
    const hand = new THREE.Group();
    hand.position.y = -0.32;
    fore.add(hand);
    const hm = new THREE.Mesh(_OPS.hand, _opSkin);
    hm.castShadow = false; hand.add(hm);
    hands.push(hand); fores.push(fore);
  }
  armL.rotation.x = -0.25; armR.rotation.x = -0.25;

  b.scale.setScalar(_OP_SCALE);
  // ARM_* are published because anything posing this rig needs the two bone
  // lengths and the shoulder sockets, and re-deriving them by hand is how they
  // silently drift apart from the geometry above.
  return { body:b, legL, legR, armL, armR,
           foreL: fores[0], foreR: fores[1],
           handL: hands[0], handR: hands[1],
           height: _OP_BASE_H * _OP_SCALE };
}

// The health bar is identical for both body types, so it lives in one place.
function buildHealthBar(){
  const barW = 0.9, barH = 0.12;
  const healthBar = new THREE.Group();
  healthBar.position.y = 2.15;
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(barW+0.06, barH+0.06),
    new THREE.MeshBasicMaterial({ color:0x111111 }));
  barBg.position.z = -0.01; barBg.renderOrder = 998; healthBar.add(barBg);
  const barFill = new THREE.Mesh(new THREE.PlaneGeometry(barW, barH),
    new THREE.MeshBasicMaterial({ color:0x66ee66 }));
  barFill.renderOrder = 999; healthBar.add(barFill);
  // Hidden: no health bar over players. The object is kept (code still updates
  // it) and its spot is where the name tag sits now.
  healthBar.visible = false;
  return { healthBar, barFill, barW };
}

function makeEnemy(team){
  const g=new THREE.Group();

  // If the rigged operator is loaded, clone it WITH its skeleton (SkeletonUtils),
  // give it its own AnimationMixer, and start the walk action (paused until moving).
  if(_operatorReady && _operatorProto){
    const body = skeletonClone(_operatorProto);
    body.scale.setScalar(OPERATOR_SCALE);
    body.position.y = OPERATOR_FOOT_Y;
    body.traverse(o=>{ if(o.isMesh){ o.castShadow = true; o.frustumCulled = false; } }); // skinned: bounds move, don't cull
    g.add(body);

    let mixer = null, walkAction = null;
    if(_operatorWalkClip){
      mixer = new THREE.AnimationMixer(body);
      walkAction = mixer.clipAction(_operatorWalkClip);
      walkAction.play();
      walkAction.paused = true;        // only animate while actually walking
      _enemyMixers.push(mixer);
    }

    const { healthBar, barFill, barW } = buildHealthBar();
    g.add(healthBar);

    g.userData = { hp:100, maxHp:100, walkPhase:0, lastAttack:0, aimT:0,
                   healthBar, barFill, barW, isModel:true, mixer, walkAction,
                   hitScale: OPERATOR_SCALE, height: 1.81 * OPERATOR_SCALE };
    return g;
  }

  // Fallback: the primitive operator. Same userData contract as the rigged
  // path, so every caller — bullets, the AI loop, the network layer — behaves
  // identically whichever body it got.
  const rig = buildPrimitiveOperator(team || 't');
  g.add(rig.body);
  const { healthBar, barFill, barW } = buildHealthBar();
  // Ride above whatever height the rig ended up, so changing _OP_SCALE never
  // buries the bar in the model's head.
  healthBar.position.y = rig.height + 0.34;
  g.add(healthBar);

  g.userData = { hp:100, maxHp:100, walkPhase:0, lastAttack:0, aimT:0,
                 healthBar, barFill, barW, isModel:false,
                 mixer:null, walkAction:null,
                 legL:rig.legL, legR:rig.legR, armL:rig.armL, armR:rig.armR,
                 rigBody:rig.body, foreL:rig.foreL, foreR:rig.foreR,
                 handL:rig.handL, handR:rig.handR,
                 team: team || 't', height: rig.height, hitScale: _OP_SCALE };
  return g;
}

// ══════════════════════════════════════════════════════════════════════════
//  HITBOXES
//
//  Four vertical cylinders stacked on the feet, measured off the rig above and
//  expressed in AUTHORED units — they are multiplied by the body's own scale at
//  test time, so changing _OP_SCALE moves the model and its hitboxes together
//  and they can never drift apart.
//
//  This replaces a test that was horizontal only:
//      if(ddx*ddx + ddz*ddz < 0.5)
//  — no vertical bound at all, so a bullet passing metres over someone's head
//  still registered, and the headshot line was the world-absolute constant
//  1.55, which stopped meaning "head" the moment the model was scaled.
//
//  Multipliers follow the CS convention. A weapon with an explicit
//  headshotDamage (the AWP) keeps its authored number instead.
// ══════════════════════════════════════════════════════════════════════════
const HITBOX = [
  { zone:'head',    y0:1.54, y1:1.86, r:0.24, mult:4.00 },
  { zone:'chest',   y0:1.04, y1:1.54, r:0.46, mult:1.00 },   // torso + arms
  { zone:'stomach', y0:0.82, y1:1.04, r:0.32, mult:1.00 },   // no body multipliers:
  { zone:'legs',    y0:0.00, y1:0.82, r:0.30, mult:1.00 },   // chest, stomach and legs all take base damage
];

// Swept segment vs a vertical cylinder. Returns the entry parameter along the
// segment (0..1), or -1 for a miss.
//
// Solving it properly matters: taking the horizontally-closest point and then
// checking its height is wrong, because the closest approach in plan view can
// sit far outside the cylinder's height band while the segment still passes
// cleanly through it. So we intersect two intervals — the t range inside the
// radius, and the t range inside the height band — and hit only if they overlap.
function _sweptCylinder(sx, sy, sz, ex, ey, ez, cx, cz, y0, y1, r){
  const vx = ex - sx, vy = ey - sy, vz = ez - sz;
  const dx = sx - cx, dz = sz - cz;
  let t0 = 0, t1 = 1;

  const a = vx*vx + vz*vz;
  const c = dx*dx + dz*dz - r*r;
  if(a < 1e-12){
    if(c > 0) return -1;                       // travelling straight up, outside
  } else {
    const b = 2*(dx*vx + dz*vz);
    const disc = b*b - 4*a*c;
    if(disc < 0) return -1;                    // never enters the radius
    const sq = Math.sqrt(disc);
    const ra = (-b - sq) / (2*a), rb = (-b + sq) / (2*a);
    if(ra > t0) t0 = ra;
    if(rb < t1) t1 = rb;
    if(t0 > t1) return -1;
  }

  if(Math.abs(vy) < 1e-12){
    if(sy < y0 || sy > y1) return -1;          // level flight, outside the band
  } else {
    let ta = (y0 - sy) / vy, tb = (y1 - sy) / vy;
    if(ta > tb){ const t = ta; ta = tb; tb = t; }
    if(ta > t0) t0 = ta;
    if(tb < t1) t1 = tb;
    if(t0 > t1) return -1;
  }
  return t0;
}

// Which zone a bullet's path through this frame struck, if any. When the path
// crosses more than one, the one entered FIRST wins — a round rising into a
// chest hits the chest, not the head above it.
function hitZone(e, fx, fy, fz, tx, ty, tz){
  const s  = e.userData.hitScale || 1;
  const cx = e.position.x, cz = e.position.z, base = e.position.y;
  let best = null, bestT = Infinity;
  for(let i = 0; i < HITBOX.length; i++){
    const h = HITBOX[i];
    const t = _sweptCylinder(fx, fy, fz, tx, ty, tz,
                             cx, cz, base + h.y0 * s, base + h.y1 * s, h.r * s);
    if(t >= 0 && t < bestT){ bestT = t; best = h; }
  }
  return best ? { zone: best.zone, mult: best.mult, t: bestT } : null;
}

// Damage for a hit, honouring an authored headshotDamage where one exists.
function hitDamage(baseDamage, headshotDamage, zone, mult, zoneDamage){
  // per-gun damage for each body part (10-config zoneDamage) wins when present
  if(zoneDamage && zoneDamage[zone] != null) return zoneDamage[zone];
  if(zone === 'head' && headshotDamage) return headshotDamage;
  return Math.max(1, Math.round(baseDamage * mult));
}

const _eBoxTmp = new THREE.Box3();
const _frustum   = new THREE.Frustum();
const _projScreen = new THREE.Matrix4();
const _cullSphere = new THREE.Sphere(new THREE.Vector3(), 1.9);
let _frameDt = 0;
let _statsDetail = false;
let _perfT0 = 0, _perfLogic = 0, _perfDraw = 0, _perfFrame = 0, _perfLastFrame = 0;

// ── SPATIAL GRID (broadphase) ───────────────────────────────────────────────
// Static obstacles (everything except the movable car boxes) are bucketed into
// a uniform grid so collision / line-of-sight queries only test nearby boxes
// instead of all ~600. Results are identical; it's purely a culling speedup.
const GRID_CELL = 12;
const _carObstacleSet = new Set(cars.map(c => c.obstacle));
const grid = new Map();
// An integer key, not 'cx,cz'. The string version allocated a fresh string for
// every cell probed, on every collision, line-of-sight and bullet query — which
// is thousands of throwaway strings per frame. The platform grid four files
// later already used this exact encoding; this just brings the two into line.
// 4096 is comfortably wider than the map, which spans about 12 cells.
function _cellKey(cx, cz){ return cx * 4096 + cz; }
function _buildGrid(){
  grid.clear();
  for(const b of obstacles){
    if(_carObstacleSet.has(b)) continue; // cars handled separately (they move)
    const minCx = Math.floor(b.min.x / GRID_CELL), maxCx = Math.floor(b.max.x / GRID_CELL);
    const minCz = Math.floor(b.min.z / GRID_CELL), maxCz = Math.floor(b.max.z / GRID_CELL);
    for(let cx = minCx; cx <= maxCx; cx++){
      for(let cz = minCz; cz <= maxCz; cz++){
        const k = _cellKey(cx, cz);
        let arr = grid.get(k);
        if(!arr){ arr = []; grid.set(k, arr); }
        arr.push(b);
      }
    }
  }
}
// Gather unique static obstacle boxes overlapping an AABB region into `out`.
const _queryScratch = new Set();
let _qStamp = 0;
function _queryRegion(minx, minz, maxx, maxz, out){
  _qStamp++;
  out.length = 0;
  const minCx = Math.floor(minx / GRID_CELL), maxCx = Math.floor(maxx / GRID_CELL);
  const minCz = Math.floor(minz / GRID_CELL), maxCz = Math.floor(maxz / GRID_CELL);
  for(let cx = minCx; cx <= maxCx; cx++){
    for(let cz = minCz; cz <= maxCz; cz++){
      const arr = grid.get(_cellKey(cx, cz));
      if(!arr) continue;
      for(let i=0;i<arr.length;i++){
        const b = arr[i];
        // a box can sit in several cells; the stamp keeps it out of `out` twice
        if(b.__qs !== _qStamp){ b.__qs = _qStamp; out.push(b); }
      }
    }
  }
  // Cars move, so their boxes live outside the static grid. The one being
  // driven is the only one ever spliced out of obstacles, so this reproduces
  // the old result exactly without touching the full obstacle list.
  for(let i=0;i<cars.length;i++){
    const c = cars[i];
    if(c !== currentCar) out.push(c.obstacle);
  }
  return out;
}
_buildGrid();

// Freeze transform updates for all static scene objects (everything that exists
// now except the cars, which move). Saves per-frame matrix recomputation for
// hundreds of buildings, lamps, trees, furniture. Appearance is unchanged.
const _carGroups = new Set(cars.map(c => c.group));
for(const obj of scene.children){
  if(obj === camera) continue;
  if(obj.isLight) continue;
  if(_carGroups.has(obj)) continue;
  obj.matrixAutoUpdate = false;
  obj.updateMatrix();
}
const _nearby = [];

function enemyCollides(x, z, halfW = 0.4, feetY = 0){
  _eBoxTmp.min.set(x-halfW, feetY + 0.25, z-halfW);
  _eBoxTmp.max.set(x+halfW, feetY + 1.8,  z+halfW);
  _queryRegion(x-halfW, z-halfW, x+halfW, z+halfW, _nearby);
  for(let i=0;i<_nearby.length;i++){
    const b = _nearby[i];
    if(b.max.y <= feetY + 0.55) continue;   // a step, not a wall
    if(_eBoxTmp.intersectsBox(b)) return true;
  }
  return false;
}

const SPAWN_MIN_DIST = 35;
const SPAWN_MAX_DIST = 65;
const SPAWN_BATCH_MIN = 1;
const SPAWN_BATCH_MAX = 3;
const MAX_ENEMIES = 12;
const SPAWN_INTERVAL = 6000;

function spawnEnemyAt(x, z){
  const e = makeEnemy();
  e.userData.type='gunner';
  e.position.set(x, 0, z);
  scene.add(e); enemies.push(e);
}

function findSpawnPos(){
  return randomSpawnIn(TEAM_SPAWNS.ct, 24);   // the enemy team holds CT
}

function spawnEnemy(){
  const pos = findSpawnPos();
  if(pos) spawnEnemyAt(pos[0], pos[1]);
}

// Kept for the multiplayer path: spawnEnemyAt(x, z) still builds and adds a
// rigged humanoid. It is simply never called by any AI now.
function spawnBatch(){ /* bots disabled */ }
