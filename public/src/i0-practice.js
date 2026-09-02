// ════════════════════════════════════════════════════════════════════════════
//  i0-practice.js — the training centre
//
//  A purpose-built indoor range: marked lanes, configurable targets, and every
//  weapon in the game free to pick up and try. Reached from the "Training"
//  button on the lobby screen.
//
//  Self-contained: delete this file and its PARTS entry and the button, the
//  room, the targets, the panel and the readouts all go with it. The one thing
//  it needs from elsewhere is the `isDummy` skip in a0-loop's AI block —
//  without that the targets would jog over and shoot back.
//
//  WHY IT IS BUILT IN THE SKY
//  The range needs floor and walls that actually stop you, and the city already
//  occupies every square metre of the playfield at ground level. Building at
//  RANGE_Y puts it clear of all of that: nothing else is up there, so no wall
//  can land inside a building and no target can spawn inside a planter. The
//  x/z clamp in a0-loop is on x and z only, so an elevated room is still inside
//  the playable box. Walls are tall enough that you cannot see out.
//
//  WHY THE TARGETS ARE ORDINARY ENEMIES
//  makeEnemy() already gives a body, a health bar, hitboxes scaled to the rig,
//  and a userData shape the bullet loop understands. A dummy is one of those
//  with the AI switched off — so damage, hit zones, headshot multipliers and
//  the kill reward behave exactly as they do against a real player. Practice
//  against a different damage path would be practice at the wrong game.
//
//  THE FACILITY
//  One big hall rather than five rooms with doorways between them. Dividing
//  walls would mean cutting gaps in them, which is fiddly box arithmetic for
//  no gain — you can already walk anywhere, and each bay is defined by the
//  props inside it and the sign over it rather than by being sealed off. The
//  bays are:
//
//    MARKSMAN RANGE   the original lanes, now out to 100 m down the spine
//    DUEL BAY         opponents that move, take cover and SHOOT BACK
//    MOVEMENT COURSE  stepped platforms and beams, targets engaged on the move
//    FLICK GRID       one target at a time, somewhere new every time
//    KNIFE PIT        a ring of bodies at melee range
//
//  Only the marksman range answers to the DISTANCE and TARGETS settings; the
//  other four are purpose-built layouts, which is the point of them.
//
//  WHAT REPLACED THE FIRST TWO BAYS
//  The CQB house and the cover gallery both taught the same thing and neither
//  taught it well: a target standing behind a wall is still a target standing
//  still, and once you know where it is the wall stops mattering. The two
//  things a range genuinely cannot rehearse were an opponent who shoots back
//  and a target whose position you do not already know. That is the duel bay
//  and the flick grid.
//
//  WHY THE ROOM GEOMETRY IS BUILT ONCE AND NEVER REBUILT
//  Target distance is a setting now, so the obvious design is to move the lane
//  markings with the targets. That means disposing and re-creating geometry
//  every time you nudge a slider, and re-running _buildGrid each time. Instead
//  the floor carries permanent range ticks every 10 m — the way a real range is
//  marked — and the targets simply stand wherever the settings put them. The
//  markings never move, so the room is built exactly once per session.
// ════════════════════════════════════════════════════════════════════════════

const RANGE_Y     = 60;      // floor height, well clear of the city
const RANGE_HALFW = 40;      // hall half-width
const RANGE_Z0    = -76;     // far end, behind the targets
const RANGE_Z1    =  44;     // near end, behind the firing line
const RANGE_LINE  =  34;     // where you stand on the marksman range
const RANGE_WALL_H = 9;      // tall enough that you cannot see the city over it
const RANGE_WALL_T = 0.9;

// The marksman range runs down the middle of the hall. Lane logic is clamped
// to this rather than to the hall, or a strafing target would wander into the
// duel bay.
const RANGE_SPINE = 12;      // spine half-width

// The five lane centres. Which of them are used depends on the TARGETS setting.
const RANGE_LANE_X   = [-8.0, -4.0, 0.0, 4.0, 8.0];
// The per-lane distances used by the LANES distance preset — a spread, so one
// glance tells you which range you are missing at. The hall is long enough for
// a genuine 100 m lane now, which is the first time the AWP has had anything
// to do that a rifle could not.
const RANGE_LANE_D   = [10, 25, 45, 70, 100];
// Permanent floor markings.
const RANGE_TICKS    = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

const PRACTICE_MONEY = 20000;   // the shop still works, if you prefer it

// Chest height on the rig, in metres above the target's feet. Used to aim the
// pattern board at the same place you are aiming.
const RANGE_CHEST_Y = 1.29 * 1.62;

let practiceOn = false;
let _rngBuilt  = false;
const _rngMeshes = [];    // everything drawn
const _rngBoxes  = [];    // the subset that blocks bullets and movement
const _rngPlats  = [];    // the subset you can stand on
const _prSlots   = [];    // { x, z, dist, obj, dueAt, shownAt, reacted, phase }

// ── SETTINGS ────────────────────────────────────────────────────────────────
// One table drives the panel, the target layout and the frame loop. `i` is the
// index of the current option; `rebuild` marks the settings that change where
// the targets stand, so the panel knows when to lay them out again.
const RANGE_SET = [
  { key:'bay',     label:'AREA',       opts:['MARKSMAN RANGE', 'DUEL BAY', 'MOVEMENT COURSE',
                                             'FLICK GRID', 'KNIFE PIT'],                    i:0, rebuild:true, warp:true },
  { key:'dist',    label:'DISTANCE',   opts:['LANES', '10 m', '20 m', '30 m', '40 m', '50 m'], i:0, rebuild:true },
  { key:'count',   label:'TARGETS',    opts:['1', '3', '5'],                                   i:2, rebuild:true },
  { key:'move',    label:'MOVEMENT',   opts:['STATIC', 'STRAFE', 'FAST STRAFE', 'POP-UP'],     i:0 },
  { key:'hp',      label:'TARGET HP',  opts:['100', '250', '1000', 'UNLIMITED'],               i:0, rebuild:true },
  { key:'respawn', label:'RESPAWN',    opts:['0.5 s', '1 s', '2 s', '4 s'],                    i:2 },
  { key:'ammo',    label:'AMMO',       opts:['INFINITE', 'REALISTIC'],                         i:0 },
  { key:'pattern', label:'SPRAY BOARD',opts:['ON', 'OFF'],                                     i:0 },
  { key:'numbers', label:'DAMAGE NUMBERS', opts:['ON', 'OFF'],                                 i:0 },
];
const _rsBy = {};
for(const s of RANGE_SET) _rsBy[s.key] = s;
const rsVal = k => _rsBy[k].opts[_rsBy[k].i];
const rsIdx = k => _rsBy[k].i;

// ── MATERIALS ───────────────────────────────────────────────────────────────
const _rngMat = {
  floor: new THREE.MeshStandardMaterial({ color:0x3b3f46, roughness:0.95, metalness:0.0 }),
  wall:  new THREE.MeshStandardMaterial({ color:0x4a4f58, roughness:0.9,  metalness:0.02 }),
  trim:  new THREE.MeshStandardMaterial({ color:0xe0a35a, roughness:0.6,  metalness:0.05 }),
  lane:  new THREE.MeshStandardMaterial({ color:0x2a2d33, roughness:0.95, metalness:0.0 }),
  stop:  new THREE.MeshStandardMaterial({ color:0x33251c, roughness:1.0,  metalness:0.0 }),
  // The roof is a box seen from INSIDE, so its front faces point away from you
  // and back-face culling makes it invisible — you look up into the skybox
  // through a ceiling that is definitely there. DoubleSide is the whole fix.
  // A ceiling's visible face points DOWN, so it catches the ground half of the
  // hemisphere light and none of the sun — a plain dark colour there renders as
  // a black void rather than as a roof. Lighter, with a little emissive, so it
  // reads as a surface under any of the game's quality settings.
  roof:  new THREE.MeshStandardMaterial({ color:0x555c68, roughness:0.95, metalness:0.0,
                                          emissive:0x191c22, side:THREE.DoubleSide }),
  // Unlit on purpose: these are the lights.
  strip: new THREE.MeshBasicMaterial({ color:0xffe0b0 }),
};

// ── GEOMETRY ────────────────────────────────────────────────────────────────
// `solid` registers the box with the world so bullets and footsteps see it;
// `stand` marks the top walkable. Both are held in lists so the room can be
// taken back out of the world when you leave — otherwise its boxes would sit
// in the same x/z grid cells as the city and be tested by every shot fired
// down there for the rest of the session.
function rngBox(w, h, d, cx, cy, cz, mat, solid, stand){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(cx, cy, cz);
  m.castShadow = false; m.receiveShadow = true;
  m.matrixAutoUpdate = false; m.updateMatrix();
  m.visible = false;
  scene.add(m);
  _rngMeshes.push(m);
  if(solid){
    _rngBoxes.push(new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(cx, cy, cz), new THREE.Vector3(w, h, d)));
  }
  if(stand){
    _rngPlats.push({ x0:cx - w/2, x1:cx + w/2, z0:cz - d/2, z1:cz + d/2, top:cy + h/2 });
  }
  return m;
}

// A distance placard. Stood UPRIGHT facing the firing line rather than painted
// flat on the floor: an unrotated plane already faces +Z, which is exactly
// where you are standing, so the text cannot come out mirrored or upside down
// — which is what happened when these lay on the ground.
function rngLabel(text, x, z){
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = 'rgba(14,16,20,0.85)';
  c.fillRect(0, 0, 256, 128);
  c.strokeStyle = '#e0a35a'; c.lineWidth = 6;
  c.strokeRect(3, 3, 250, 122);
  c.fillStyle = '#e0a35a';
  c.font = "bold 76px Stratum2, 'Arial Narrow', sans-serif";
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 128, 68);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75),
    new THREE.MeshBasicMaterial({ map:tex, transparent:true, side:THREE.DoubleSide }));
  m.position.set(x, RANGE_Y + 1.15, z);
  m.matrixAutoUpdate = false; m.updateMatrix();
  m.visible = false;
  scene.add(m); _rngMeshes.push(m);
  rngBox(0.09, 1.15, 0.09, x, RANGE_Y + 0.575, z, _rngMat.wall, false);
}

// ── THE BAYS ────────────────────────────────────────────────────────────────
// Each is a rectangle of floor with its own props, its own targets and its own
// place to stand. `layout` returns the target slots for that bay; only the
// marksman range consults the settings, because the whole point of the other
// four is that their layout IS the drill.
const RANGE_BAYS = [
  { key:'range',    name:'MARKSMAN RANGE',  spawn:[0, RANGE_LINE],  yaw:0 },
  { key:'duel',     name:'DUEL BAY',        spawn:[-27, 30],        yaw:0 },
  { key:'movement', name:'MOVEMENT COURSE', spawn:[27, 34],         yaw:0 },
  { key:'flick',    name:'FLICK GRID',      spawn:[-27, -6],        yaw:0 },
  { key:'knife',    name:'KNIFE PIT',       spawn:[27, -19],        yaw:0 },
];
const bayKey = () => RANGE_BAYS[rsIdx('bay')].key;

// A big sign over a bay entrance. Same upright-plane trick as the distance
// placards, at a size you can read from across the hall.
function rngSign(text, x, z, y){
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 160;
  const c = cv.getContext('2d');
  c.fillStyle = 'rgba(14,16,20,0.90)'; c.fillRect(0, 0, 1024, 160);
  c.strokeStyle = '#e0a35a'; c.lineWidth = 7; c.strokeRect(4, 4, 1016, 152);
  c.fillStyle = '#e0a35a';
  c.font = "bold 88px Stratum2, 'Arial Narrow', sans-serif";
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 512, 86);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 1.5),
    new THREE.MeshBasicMaterial({ map:tex, transparent:true, side:THREE.DoubleSide }));
  m.position.set(x, y, z);
  m.matrixAutoUpdate = false; m.updateMatrix();
  m.visible = false;
  scene.add(m); _rngMeshes.push(m);
}

// ── THE DUEL BAY ────────────────────────────────────────────────────────────
// An arena with scattered hard cover and opponents that are NOT dummies: the
// isDummy flag is off, so a0-loop's AI block runs them exactly as it runs the
// bots in a solo game. They path, they take angles and they shoot back. It is
// the only part of the facility that can go wrong for you, which is the point.
const DUEL_X = -27, DUEL_Z = 12;
const DUEL_COVER = [                   // [ w, h, d, dx, dz ]
  [ 4.0, 1.9, 1.2,  -6,  4 ],
  [ 1.2, 1.9, 4.0,   6,  2 ],
  [ 3.0, 1.2, 3.0,   0, -2 ],
  [ 1.2, 2.4, 3.5,  -3, -9 ],
  [ 4.5, 1.5, 1.2,   5, -10 ],
  [ 1.2, 1.9, 3.0,  -9, -3 ],
  [ 2.4, 1.2, 2.4,   9, -6 ],
];
const DUEL_SPAWNS = [ [-7, -12], [0, -13], [7, -11] ];   // where they come from
const DUEL_HP = 100;

// ── THE MOVEMENT COURSE ─────────────────────────────────────────────────────
// Stepped platforms and a couple of narrow beams. Targets stand off the course
// rather than on it, so you are always shooting while your feet are busy.
const MOV_X = 27, MOV_Z = 18;
const MOV_BLOCKS = [                   // [ w, h, d, dx, dz ]
  [ 6, 0.6, 6,  -7,  8 ],
  [ 6, 1.2, 6,   0,  6 ],
  [ 6, 1.8, 6,   7,  4 ],
  [ 6, 2.4, 6,   0, -2 ],
  [ 6, 1.2, 6,  -7, -4 ],
  [ 2.2, 3.0, 2.2,  8, -8 ],           // a tall step to climb
  [ 12, 0.9, 1.6, -2, -10 ],           // a beam to cross
];
// Along the far edge of the bay, past every block. Scattering them among the
// platforms sounded better and was wrong twice over: two of them ended up
// standing inside a block, and a strafing target walked through one. Beyond
// the course is also the better drill — you cross the obstacles to get an
// angle on them, rather than standing on one to shoot the next.
const MOV_TARGETS = [ [ -9, -14 ], [ -4.5, -14 ], [ 0, -14 ], [ 4.5, -14 ], [ 9, -14 ] ];

// ── THE FLICK GRID ──────────────────────────────────────────────────────────
// Exactly one target, and never twice in the same place. It dies to a single
// hit and reappears somewhere else on the grid almost immediately, so what is
// being trained is finding it and getting on it — the thing a fixed lane can
// never ask of you, because you are already aimed at the lane.
//
// The timing falls out of machinery that already exists: practiceSpawn stamps
// shownAt, and the reaction-time readout measures from there to the first hit.
// On this grid that IS the flick time.
// The grid is a FLOOR PLAN, not a wall. Stacking the rows vertically was the
// obvious reading of "grid" and it left humanoid bodies hovering two metres in
// the air; spreading them in depth instead keeps everyone standing, and varies
// the range as well as the angle, which is more of the drill rather than less.
const FLK_X = -27, FLK_Z = -22;
const FLK_COLS  = [-9, -4.5, 0, 4.5, 9];   // dx across the bay
const FLK_DEPTH = [ 8, 2, -4 ];            // dz: roughly 8, 14 and 20 m out

// ── THE KNIFE PIT ───────────────────────────────────────────────────────────
// A ring of bodies at melee reach, inside a painted border. The border is
// DELIBERATELY not solid: at any height worth seeing, a closed square of wall
// around a 5 m pit is a cage you cannot climb out of. Nothing needs holding in
// anyway — strafe amplitude is zero here.
const KNF_X = 27, KNF_Z = -22, KNF_R = 2.6;

function rangeBuild(){
  if(_rngBuilt) return;
  const W = RANGE_HALFW * 2, L = RANGE_Z1 - RANGE_Z0, cz = (RANGE_Z0 + RANGE_Z1) / 2;

  // Floor: a solid slab you stand on. 1 thick, top exactly at RANGE_Y.
  rngBox(W, 1, L, 0, RANGE_Y - 0.5, cz, _rngMat.floor, true, true);

  // Walls. The far one is a deep backstop so nothing you fire leaves the hall.
  const wy = RANGE_Y + RANGE_WALL_H / 2;
  rngBox(RANGE_WALL_T, RANGE_WALL_H, L, -RANGE_HALFW - RANGE_WALL_T/2, wy, cz, _rngMat.wall, true);
  rngBox(RANGE_WALL_T, RANGE_WALL_H, L,  RANGE_HALFW + RANGE_WALL_T/2, wy, cz, _rngMat.wall, true);
  rngBox(W + RANGE_WALL_T*2, RANGE_WALL_H, RANGE_WALL_T, 0, wy, RANGE_Z1 + RANGE_WALL_T/2, _rngMat.wall, true);
  rngBox(W + RANGE_WALL_T*2, RANGE_WALL_H, 2.0,          0, wy, RANGE_Z0 - 1.0,            _rngMat.stop, true);

  // A roof, so it reads as a building rather than a walled yard. Drawn but NOT
  // solid: jumpPower gets nowhere near 9 m, and an overhead collision box is a
  // way to get someone stuck for no benefit anyone will ever see.
  rngBox(W, 0.4, L, 0, RANGE_Y + RANGE_WALL_H + 0.2, cz, _rngMat.roof, false);
  // Light strips down the roof, purely so the ceiling is not a flat slab.
  for(let z = RANGE_Z0 + 8; z < RANGE_Z1; z += 16){
    rngBox(W - 6, 0.12, 0.7, 0, RANGE_Y + RANGE_WALL_H - 0.2, z, _rngMat.strip, false);
  }

  // ── the marksman spine ──
  rngBox(RANGE_SPINE * 2, 0.04, 0.35, 0, RANGE_Y + 0.02, RANGE_LINE, _rngMat.trim, false);
  for(const lx of RANGE_LANE_X){
    rngBox(0.10, 0.04, RANGE_LINE - RANGE_Z0, lx, RANGE_Y + 0.02,
           (RANGE_LINE + RANGE_Z0) / 2, _rngMat.lane, false);
  }
  // Low kerbs marking the spine off from the bays either side. Knee height, so
  // they read as a boundary without blocking a shot or a stride.
  for(const sx of [-RANGE_SPINE, RANGE_SPINE]){
    rngBox(0.3, 0.5, RANGE_LINE - RANGE_Z0, sx, RANGE_Y + 0.25,
           (RANGE_LINE + RANGE_Z0) / 2, _rngMat.lane, false);
  }
  for(const d of RANGE_TICKS){
    const z = RANGE_LINE - d;
    rngBox(RANGE_SPINE * 2, 0.04, 0.10, 0, RANGE_Y + 0.021, z, _rngMat.lane, false);
    rngLabel(d + 'm', -RANGE_SPINE + 1.0, z);
  }
  rngSign('MARKSMAN RANGE', 0, RANGE_LINE + 4, RANGE_Y + 5.2);

  // ── duel bay ──
  for(const [w, h, d, dx, dz] of DUEL_COVER){
    rngBox(w, h, d, DUEL_X + dx, RANGE_Y + h / 2, DUEL_Z + dz, _rngMat.wall, true, true);
  }
  rngSign('DUEL BAY', DUEL_X, DUEL_Z + 8, RANGE_Y + 4.4);

  // ── movement course ──
  for(const [w, h, d, dx, dz] of MOV_BLOCKS){
    rngBox(w, h, d, MOV_X + dx, RANGE_Y + h / 2, MOV_Z + dz, _rngMat.lane, true, true);
  }
  rngSign('MOVEMENT COURSE', MOV_X, MOV_Z + 13, RANGE_Y + 4.4);

  // ── flick grid ──
  // The cells painted on the floor, so you know the shape of the space the
  // next one can appear in without having to be told.
  const fz0 = FLK_Z + FLK_DEPTH[FLK_DEPTH.length - 1], fz1 = FLK_Z + FLK_DEPTH[0];
  const fw = (FLK_COLS[FLK_COLS.length - 1] - FLK_COLS[0]) + 4;
  for(const dz of FLK_DEPTH){
    rngBox(fw, 0.04, 0.10, FLK_X, RANGE_Y + 0.021, FLK_Z + dz, _rngMat.lane, false);
  }
  for(const dx of FLK_COLS){
    rngBox(0.10, 0.04, (fz1 - fz0) + 4, FLK_X + dx, RANGE_Y + 0.021,
           (fz0 + fz1) / 2, _rngMat.lane, false);
  }
  rngBox(fw + 0.4, 0.05, 0.22, FLK_X, RANGE_Y + 0.022, fz1 + 2.2, _rngMat.trim, false);
  rngSign('FLICK GRID', FLK_X, FLK_Z + 12, RANGE_Y + 4.4);

  // ── knife pit ──
  for(const [w, d, dx, dz] of [[11, 0.5, 0, -5.5], [11, 0.5, 0, 5.5],
                               [0.5, 11, -5.5, 0], [0.5, 11, 5.5, 0]]){
    rngBox(w, 0.45, d, KNF_X + dx, RANGE_Y + 0.225, KNF_Z + dz, _rngMat.stop, false);
  }
  rngSign('KNIFE PIT', KNF_X, KNF_Z + 8.5, RANGE_Y + 4.4);

  _rngBuilt = true;
}

// Put the room into — or take it out of — the world.
function rangeShow(on){
  for(const m of _rngMeshes) m.visible = on;
  for(const b of _rngBoxes){
    const i = obstacles.indexOf(b);
    if(on && i < 0) obstacles.push(b);
    if(!on && i >= 0) obstacles.splice(i, 1);
  }
  for(const p of _rngPlats){
    const i = platforms.indexOf(p);
    if(on && i < 0) platforms.push(p);
    if(!on && i >= 0) platforms.splice(i, 1);
  }
  // Both lookups are cached, so they have to be told the world changed.
  if(typeof _buildGrid === 'function') _buildGrid();
  _pgridBuilt = false;
}

// ── TARGETS ─────────────────────────────────────────────────────────────────
const RANGE_HP = [100, 250, 1000, 1e6];   // "UNLIMITED" is a number the bar can divide by

function practiceSpawn(slot){
  const key = bayKey();
  const e = makeEnemy('ct');
  e.userData.type = 'gunner';
  // The duel bay is the one place these are NOT dummies: leaving isDummy off
  // lets a0-loop's AI block run them, which is the entire bay.
  e.userData.isDummy = (key !== 'duel');
  const hp = key === 'flick' ? 1 : (key === 'duel' ? DUEL_HP : RANGE_HP[rsIdx('hp')]);
  e.userData.hp = hp; e.userData.maxHp = hp;
  // On the flick grid the position is chosen fresh every appearance — that is
  // the drill — so the slot is repositioned before the body is placed.
  if(key === 'flick') prFlickPlace(slot);
  e.position.set(slot.x, RANGE_Y, slot.z);
  scene.add(e);
  enemies.push(e);
  slot.obj = e;
  slot.homeX = slot.x;
  slot.shownAt = performance.now();
  slot.reacted = false;
  slot.down = false;
}

// ── THE FLICK GRID ──────────────────────────────────────────────────────────
// Somewhere on the grid, and never the cell it was just in — repeating a
// position turns a flick drill into a static one for that shot.
let _prFlickCell = -1;
const _prFlicks = [];              // ms per flick, newest last

function prFlickPlace(slot){
  const cells = FLK_COLS.length * FLK_DEPTH.length;
  let c = _prFlickCell;
  for(let guard = 0; guard < 20 && c === _prFlickCell; guard++){
    c = Math.floor(Math.random() * cells);
  }
  _prFlickCell = c;
  slot.x = FLK_X + FLK_COLS[c % FLK_COLS.length];
  slot.homeX = slot.x;
  slot.z = FLK_Z + FLK_DEPTH[Math.floor(c / FLK_COLS.length)];
  const sp = RANGE_BAYS[3].spawn;
  slot.dist = Math.round(Math.hypot(slot.x - sp[0], slot.z - sp[1]));
}

// Called from prOnHit. The reaction machinery has already timed this one.
function prFlickHit(){
  if(!_prReact) return;
  _prFlicks.push(_prReact);
  if(_prFlicks.length > 50) _prFlicks.shift();
}

function prFlickAvg(){
  if(!_prFlicks.length) return 0;
  let t = 0; for(const v of _prFlicks) t += v;
  return Math.round(t / _prFlicks.length);
}

function practiceClearRange(){
  for(const s of _prSlots){
    if(!s.obj) continue;
    const i = enemies.indexOf(s.obj);
    if(i >= 0) enemies.splice(i, 1);
    scene.remove(s.obj);
  }
  _prSlots.length = 0;
}

// Which lanes are in use on the marksman range, and how far down each one the
// target stands.
function rangeLayoutMarksman(){
  const n = [1, 3, 5][rsIdx('count')];
  const lanes = n === 1 ? [RANGE_LANE_X[2]]
              : n === 3 ? [RANGE_LANE_X[1], RANGE_LANE_X[2], RANGE_LANE_X[3]]
                        : RANGE_LANE_X.slice();
  const di = rsIdx('dist');
  return lanes.map((x, k) => {
    // LANES keeps the spread. Any other option is a flat distance for every
    // target, which is what you want when comparing two weapons.
    const dist = di === 0
      ? (n === 5 ? RANGE_LANE_D[k] : (n === 3 ? RANGE_LANE_D[k + 1] : RANGE_LANE_D[2]))
      : [0, 10, 20, 30, 40, 50][di];
    return { x:x, z: RANGE_LINE - dist, dist:dist };
  });
}

// The four purpose-built bays. Each returns absolute positions; `dist` is kept
// for the readouts and is measured from where you stand in that bay.
function rangeLayoutBay(key){
  const bay = RANGE_BAYS.find(b => b.key === key);
  const [sx, sz] = bay.spawn;
  const at = (x, z) => ({ x:x, z:z, dist: Math.round(Math.hypot(x - sx, z - sz)) });

  if(key === 'duel')     return DUEL_SPAWNS.map(([dx, dz]) => at(DUEL_X + dx, DUEL_Z + dz));
  if(key === 'movement') return MOV_TARGETS.map(([dx, dz]) => at(MOV_X + dx, MOV_Z + dz));
  if(key === 'flick'){
    // One slot only. Where it stands is chosen fresh every time it appears —
    // see prFlickPlace — so the layout here is just the opening position.
    return [ at(FLK_X, FLK_Z + FLK_DEPTH[1]) ];
  }
  // knife pit: a ring at melee reach
  const N = 5;
  return Array.from({ length:N }, (_, i) => {
    const a = (i / N) * Math.PI * 2;
    return at(KNF_X + Math.sin(a) * KNF_R, KNF_Z + Math.cos(a) * KNF_R - 1.0);
  });
}

function practiceLayout(){
  const key = bayKey();
  return key === 'range' ? rangeLayoutMarksman() : rangeLayoutBay(key);
}

function practiceBuildTargets(){
  practiceClearRange();
  const layout = practiceLayout();
  for(let k = 0; k < layout.length; k++){
    const ln = layout[k];
    _prSlots.push({
      x: ln.x, homeX: ln.x, z: ln.z, dist: ln.dist,
      obj: null, dueAt: 0, shownAt: 0, reacted: false, down: false,
      // A per-slot phase, so five pop-up targets do not rise as one row.
      phase: k * 0.7,
    });
    practiceSpawn(_prSlots[_prSlots.length - 1]);
  }
  prPanelDraw();
}

// Strafe amplitude. On the marksman range one target gets most of the spine
// and five have to share it without crossing lanes. In the built bays it is
// deliberately small: a target sliding 7 m inside the duel bay would walk
// straight through cover, and in the knife pit there is nowhere to go. The
// flick grid and the duel bay opt out entirely — one is placed fresh every
// time and the other moves itself.
function prStrafeAmp(){
  const key = bayKey();
  if(key === 'knife' || key === 'flick' || key === 'duel') return 0;
  if(key !== 'range') return 1.1;
  return _prSlots.length === 1 ? 7.0 : (_prSlots.length === 3 ? 1.6 : 1.4);
}

// Below the floor slab, which is 1 thick — far enough that no part of the rig
// pokes through, so "down" needs no visibility flag of its own. That matters
// because a0-loop drives `visible` from the frustum every frame and would
// simply turn it back on.
const RANGE_DOWN_Y = RANGE_Y - 2.6;
const RANGE_POP_UP_MS = 1100, RANGE_POP_DOWN_MS = 1400;

function practiceMoveTargets(now){
  // Two bays own their targets' positions outright: the flick grid places
  // them, and the duel bay's opponents walk themselves. Letting the MOVEMENT
  // setting also write to them would fight both.
  const key = bayKey();
  if(key === 'flick' || key === 'duel') return;
  const mode = rsIdx('move');
  const amp = prStrafeAmp();
  for(const s of _prSlots){
    const e = s.obj;
    if(!e) continue;
    if(mode === 1 || mode === 2){
      const sp = mode === 1 ? 0.55 : 1.15;
      e.position.x = s.homeX + Math.sin(now / 1000 * sp + s.phase) * amp;
      e.position.y = RANGE_Y;
      if(s.down){ s.down = false; e.userData.netDead = false; }
    } else if(mode === 3){
      const cyc = RANGE_POP_UP_MS + RANGE_POP_DOWN_MS;
      const t = (now + s.phase * 1000) % cyc;
      const up = t < RANGE_POP_UP_MS;
      e.position.x = s.homeX;
      if(up === s.down){
        // Edge: it just changed state. `netDead` is what the bullet loop and
        // aimDistance both already honour, so a target that is down cannot be
        // hit and does not pull your aim — no new concept needed.
        s.down = !up;
        e.userData.netDead = !up;
        e.position.y = up ? RANGE_Y : RANGE_DOWN_Y;
        if(up){ s.shownAt = now; s.reacted = false; }
      }
    } else {
      e.position.x = s.homeX;
      e.position.y = RANGE_Y;
      if(s.down){ s.down = false; e.userData.netDead = false; }
    }
  }
}

// ── THE WEAPON RACK ─────────────────────────────────────────────────────────
// Every gun, in shop order, cycled with Q and E. Both keys were unbound, and
// swapping has to work with the pointer locked — which rules out clicking a
// list — so this is the whole interface.
const RANGE_CATS = ['melee', 'pistols', 'smgs', 'rifles', 'snipers'];
function rangeGunList(){
  return Object.keys(GUNS).sort((a, b) => {
    const ca = RANGE_CATS.indexOf(GUNS[a].category), cb = RANGE_CATS.indexOf(GUNS[b].category);
    return ca !== cb ? ca - cb : (GUNS[a].order || 0) - (GUNS[b].order || 0);
  });
}

// Deliberately not acquireGun(): that drops whatever you were holding onto the
// floor, and a range knee-deep in discarded rifles is not the idea.
function rangeEquip(key){
  owned[key] = true;
  const s = slotForGun(key);
  slots[s] = key;
  activeSlot = s;
  initAmmo(key);
  equipGun(key);
  updateSlotUI();
  practiceHud();
  prPanelDraw();
}

function rangeCycle(step){
  const list = rangeGunList();
  const i = list.indexOf(selectedGunKey);
  rangeEquip(list[((i < 0 ? 0 : i) + step + list.length) % list.length]);
}

// ── FEEDBACK: WHERE THE ROUND LANDED ────────────────────────────────────────
// The hitZone/hitDamage wrappers and the floating numbers used to live here,
// gated on practiceOn. They are in k0-damage.js now, because knowing what a
// round did is more useful in a real match than on a range — and two files
// wrapping the same two functions would double-count every hit. k0-damage
// calls prOnHit below for anything that wants the statistics.
//
// prOnHit is therefore reached in ALL modes and has to gate itself.

// ── FEEDBACK: STATS ─────────────────────────────────────────────────────────
let _prShots = 0, _prHits = 0;
let _prDeaths = 0;                       // the duel bay can kill you
let _prReact = 0, _prReactBest = 0;      // ms, last and best
// Longest gap between a target appearing and a hit that still counts as a
// reaction rather than as you getting round to it eventually.
const PR_REACT_WINDOW = 3000;
const _prGun = {};                        // key -> { shots, hits, dmg, head }

function prGunRec(k){
  if(!_prGun[k]) _prGun[k] = { shots:0, hits:0, dmg:0, head:0 };
  return _prGun[k];
}

function prResetStats(){
  _prShots = 0; _prHits = 0; _prReact = 0; _prReactBest = 0; _prDeaths = 0;
  kills = 0;
  for(const k in _prGun) delete _prGun[k];
  _prPat.length = 0;
  _prFlicks.length = 0;
  // Numbers still floating belong to the run you just cleared, so they go too.
  if(typeof dmgClear === 'function') dmgClear();
  practiceHud(); prPanelDraw(); prBoardDraw();
}

// Called for every registered hit the local player lands, from k0-damage.
function prOnHit(h, dmg){
  if(!practiceOn) return;
  _prHits++;
  const g = prGunRec(selectedGunKey);
  g.hits++; g.dmg += dmg;
  if(h.zone === 'head') g.head++;

  // Reaction time: from the target being PRESENTED to the first round that
  // lands on it. Only the first hit counts, or a spray would report the time
  // of its last bullet.
  //
  // And only within a window. A target that has been standing there for half a
  // minute has not tested your reaction to anything, and reporting "31402 ms"
  // makes the readout worse than useless — so a hit outside the window simply
  // leaves the last real measurement on screen. In practice that means the
  // number means something in POP-UP, and just after a respawn, and is quiet
  // the rest of the time.
  for(const s of _prSlots){
    if(s.obj !== h.e || s.reacted || !s.shownAt) continue;
    s.reacted = true;
    const dt = Math.round(performance.now() - s.shownAt);
    if(dt <= PR_REACT_WINDOW){
      _prReact = dt;
      if(!_prReactBest || dt < _prReactBest) _prReactBest = dt;
    }
    break;
  }

  if(bayKey() === 'flick') prFlickHit(h);
  practiceHud();
}

// netReportShot runs once per round leaving the barrel, so wrapping it counts
// shots — and hands over the muzzle position and direction, which is all the
// spray board needs.
if(typeof netReportShot === 'function'){
  const _origShot = netReportShot;
  netReportShot = function(pos, dir){
    if(practiceOn){
      _prShots++;
      prGunRec(selectedGunKey).shots++;
      prPatternAdd(pos, dir);
      practiceHud();
    }
    return _origShot(pos, dir);
  };
}

// ── FEEDBACK: THE SPRAY BOARD ───────────────────────────────────────────────
// Where each round crosses the vertical plane the nearest target stands on,
// measured from the point you were aiming at. Misses are plotted too — a spray
// pattern that only showed the rounds that connected would be no pattern at
// all. Because the range runs along -Z and the targets stand square to it, the
// crossing is a plain ray/plane solve rather than anything projective.
const PR_PAT_MAX = 60;
const _prPat = [];        // { dx, dy } in metres, newest last

function prPatternAdd(pos, dir){
  if(rsVal('pattern') !== 'ON' || !_prSlots.length) return;
  // A range instrument, and only that. The plane solve below assumes the
  // targets stand square to -Z, which is true down the spine and true nowhere
  // else — plotting a duel-bay engagement against a plane it was never shot at
  // would produce numbers that look meaningful and are not.
  if(bayKey() !== 'range') return;
  if(dir.z >= -1e-4) return;                 // not fired down the range
  // The target the round passes CLOSEST to, not simply the nearest one down
  // the range. Picking the nearest was wrong the moment more than one lane is
  // in use: a burst aimed at the far lane got plotted against the near one and
  // came out fourteen metres wide, which is not a spray pattern, it is a bug
  // wearing one. Each slot is solved on its own plane and the best match wins.
  let bestD = Infinity, bestPt = null;
  for(const s of _prSlots){
    const t = (s.z - pos.z) / dir.z;
    if(t <= 0 || t > 300) continue;
    const cx = s.obj ? s.obj.position.x : s.homeX;
    const cy = RANGE_Y + RANGE_CHEST_Y;
    const dx = pos.x + dir.x * t - cx;
    const dy = pos.y + dir.y * t - cy;
    const d  = dx*dx + dy*dy;
    if(d < bestD){ bestD = d; bestPt = { dx:dx, dy:dy }; }
  }
  if(!bestPt) return;
  _prPat.push(bestPt);
  if(_prPat.length > PR_PAT_MAX) _prPat.shift();
  prBoardDraw();
}

// Extreme spread of the plotted points, in centimetres — the same measure a
// paper target is scored with.
function prGroupCm(){
  let worst = 0;
  for(let i = 0; i < _prPat.length; i++){
    for(let j = i + 1; j < _prPat.length; j++){
      const dx = _prPat[i].dx - _prPat[j].dx, dy = _prPat[i].dy - _prPat[j].dy;
      const d = dx*dx + dy*dy;
      if(d > worst) worst = d;
    }
  }
  return Math.round(Math.sqrt(worst) * 100);
}

let _prBoard = null, _prBoardCtx = null;
const PR_BOARD_PX = 190, PR_BOARD_M = 1.5;    // half-width shown, in metres

function prBoardDraw(){
  if(!_prBoard) return;
  const on = practiceOn && rsVal('pattern') === 'ON';
  _prBoard.style.display = on ? 'block' : 'none';
  if(!on) return;
  const c = _prBoardCtx, S = PR_BOARD_PX, mid = S / 2;
  const k = mid / PR_BOARD_M;
  c.clearRect(0, 0, S, S);
  c.fillStyle = 'rgba(14,16,20,0.72)';
  c.fillRect(0, 0, S, S);
  c.strokeStyle = 'rgba(224,163,90,0.45)'; c.lineWidth = 1;
  c.strokeRect(0.5, 0.5, S - 1, S - 1);

  // A silhouette box the width of the chest hitbox, so the dots have a scale.
  const halfW = 0.46 * 1.62, headTop = (1.86 - 1.29) * 1.62, low = (1.29 - 0.82) * 1.62;
  c.strokeStyle = 'rgba(160,175,195,0.30)';
  c.strokeRect(mid - halfW * k, mid - headTop * k, halfW * 2 * k, (headTop + low) * k);

  c.strokeStyle = 'rgba(224,163,90,0.55)';
  c.beginPath();
  c.moveTo(mid, mid - 7); c.lineTo(mid, mid + 7);
  c.moveTo(mid - 7, mid); c.lineTo(mid + 7, mid);
  c.stroke();

  for(let i = 0; i < _prPat.length; i++){
    const p = _prPat[i];
    // Newest brightest, so you can read the order of a spray.
    const age = (i + 1) / _prPat.length;
    const px = mid + p.dx * k, py = mid - p.dy * k;
    c.fillStyle = 'rgba(255,209,102,' + (0.18 + age * 0.82).toFixed(3) + ')';
    c.beginPath(); c.arc(px, py, 2.4, 0, Math.PI * 2); c.fill();
  }

  c.fillStyle = '#e8dcc0';
  c.font = "600 11px Stratum2,'Arial Narrow',sans-serif";
  c.textAlign = 'left';
  c.fillText('SPRAY  ' + _prPat.length + ' shots', 7, 15);
  c.textAlign = 'right';
  c.fillText(_prPat.length > 1 ? 'GROUP ' + prGroupCm() + ' cm' : '', S - 7, 15);
}

// ── HUD ─────────────────────────────────────────────────────────────────────
let _prPanel = null;

function practiceHud(){
  if(!_prPanel) return;
  const acc = _prShots ? Math.round(_prHits / _prShots * 100) : 0;
  const name = (GUNS[selectedGunKey] && GUNS[selectedGunKey].name) || selectedGunKey;
  const key = bayKey();
  // Each bay reports the thing it exists to measure. A duel is scored in kills
  // and deaths; the flick grid in milliseconds; everything else in accuracy.
  let extra;
  if(key === 'duel'){
    extra = '<span>' + kills + ' down &middot; ' + _prDeaths +
            (_prDeaths === 1 ? ' death' : ' deaths') + '</span>';
  } else if(key === 'flick'){
    const avg = prFlickAvg();
    extra = '<span>' + (_prFlicks.length ? 'flick ' + _prFlicks[_prFlicks.length-1] + ' ms' +
              (avg ? ' &middot; avg ' + avg : '') +
              (_prReactBest ? ' &middot; best ' + _prReactBest : '')
            : 'flick \u2014') + '</span>';
  } else {
    extra = (_prReact ? '<span>react ' + _prReact + ' ms' +
       (_prReactBest && _prReactBest !== _prReact ? ' (best ' + _prReactBest + ')' : '') +
       '</span>' : '');
  }
  _prPanel.innerHTML =
    '<b>' + RANGE_BAYS[rsIdx('bay')].name + '</b>' +
    '<i>' + name + '</i>' +
    '<span>Q / E weapon</span>' +
    '<span>F setup</span>' +
    '<span>' + _prHits + '/' + _prShots + ' &middot; ' + acc + '%</span>' +
    extra;
}

// ── THE SETUP PANEL ─────────────────────────────────────────────────────────
// Keyboard only: the pointer is locked, so there is nothing to click with.
// Arrow keys are used rather than WASD for the obvious reason.
let _prSetup = null, _prSetupOn = false, _prRow = 0;

function prPanelBuild(){
  if(_prSetup) return;
  const css = document.createElement('style');
  css.textContent =
    '#practice-tag{position:fixed;left:50%;top:14px;transform:translateX(-50%);' +
    'z-index:60;display:none;gap:14px;align-items:center;padding:6px 16px;' +
    "font:600 13px/1 Stratum2,'Arial Narrow',sans-serif;letter-spacing:.09em;" +
    'color:#e8dcc0;background:rgba(14,16,20,.72);border:1px solid rgba(224,163,90,.45);' +
    'border-radius:3px;pointer-events:none;white-space:nowrap}' +
    '#practice-tag b{color:#e0a35a}' +
    '#practice-tag i{font-style:normal;color:#fff}' +
    '#practice-tag span{opacity:.7;font-weight:400;letter-spacing:.04em}' +

    '#practice-board{position:fixed;right:18px;bottom:104px;z-index:60;display:none;' +
    'border-radius:3px;pointer-events:none}' +

    '#practice-setup{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);' +
    'z-index:70;display:none;min-width:430px;padding:18px 20px 16px;' +
    "font:400 13px/1.5 Stratum2,'Arial Narrow',sans-serif;color:#e8dcc0;" +
    'background:rgba(12,14,18,.94);border:1px solid rgba(224,163,90,.5);' +
    'border-radius:4px;pointer-events:none}' +
    '#practice-setup h4{margin:0 0 12px;font-size:13px;letter-spacing:.16em;' +
    'color:#e0a35a;font-weight:700}' +
    '#practice-setup .r{display:flex;justify-content:space-between;align-items:center;' +
    'padding:4px 8px;border-radius:2px;letter-spacing:.07em}' +
    '#practice-setup .r.on{background:rgba(224,163,90,.16)}' +
    '#practice-setup .r .v{color:#fff;font-weight:600}' +
    '#practice-setup .r.on .v{color:#e0a35a}' +
    '#practice-setup .hint{margin-top:12px;opacity:.55;font-size:11px;letter-spacing:.06em}' +
    '#practice-setup table{width:100%;margin-top:12px;border-collapse:collapse;font-size:11px}' +
    '#practice-setup th{text-align:left;opacity:.5;font-weight:400;letter-spacing:.1em;' +
    'padding:3px 6px;border-bottom:1px solid rgba(224,163,90,.22)}' +
    '#practice-setup td{padding:3px 6px;opacity:.9}' +
    '#practice-setup td.n{text-align:right;font-variant-numeric:tabular-nums}';
  document.head.appendChild(css);

  _prSetup = document.createElement('div');
  _prSetup.id = 'practice-setup';
  document.body.appendChild(_prSetup);

  _prBoard = document.createElement('canvas');
  _prBoard.id = 'practice-board';
  _prBoard.width = PR_BOARD_PX; _prBoard.height = PR_BOARD_PX;
  document.body.appendChild(_prBoard);
  _prBoardCtx = _prBoard.getContext('2d');
}

function prPanelDraw(){
  if(!_prSetup || !_prSetupOn) return;
  let h = '<h4>RANGE SETUP</h4>';
  for(let i = 0; i < RANGE_SET.length; i++){
    const s = RANGE_SET[i];
    h += '<div class="r' + (i === _prRow ? ' on' : '') + '">' +
         '<span>' + s.label + '</span>' +
         '<span class="v">' + (i === _prRow ? '&#9664; ' : '') + s.opts[s.i] +
         (i === _prRow ? ' &#9654;' : '') + '</span></div>';
  }
  h += '<div class="r' + (_prRow === RANGE_SET.length ? ' on' : '') + '">' +
       '<span>RESET STATS</span><span class="v">' +
       (_prRow === RANGE_SET.length ? '&#9664; press &#9654;' : '') + '</span></div>';

  const keys = Object.keys(_prGun).filter(k => _prGun[k].shots > 0);
  if(keys.length){
    keys.sort((a, b) => _prGun[b].shots - _prGun[a].shots);
    h += '<table><tr><th>WEAPON</th><th class="n">SHOTS</th><th class="n">HITS</th>' +
         '<th class="n">ACC</th><th class="n">HS</th><th class="n">DMG</th></tr>';
    for(const k of keys){
      const g = _prGun[k];
      h += '<tr><td>' + ((GUNS[k] && GUNS[k].name) || k) + '</td>' +
           '<td class="n">' + g.shots + '</td>' +
           '<td class="n">' + g.hits + '</td>' +
           '<td class="n">' + Math.round(g.hits / g.shots * 100) + '%</td>' +
           '<td class="n">' + g.head + '</td>' +
           '<td class="n">' + g.dmg + '</td></tr>';
    }
    h += '</table>';
  }
  h += '<div class="hint">&#9650;&#9660; row &nbsp; &#9664;&#9654; change &nbsp; F close</div>';
  _prSetup.innerHTML = h;
}

function prPanelToggle(on){
  _prSetupOn = on;
  if(_prSetup) _prSetup.style.display = on ? 'block' : 'none';
  if(on) prPanelDraw();
}

function prPanelMove(d){
  const n = RANGE_SET.length + 1;             // + the reset row
  _prRow = (_prRow + d + n) % n;
  prPanelDraw();
}

// Put the player on the firing point of the bay they have selected. Walking
// there works too — it is one open hall — but nobody wants to hike 60 m to
// look at the knife pit.
function practiceWarp(){
  const bay = RANGE_BAYS[rsIdx('bay')];
  if(typeof _playerGroundPos !== 'undefined' && _playerGroundPos){
    _playerGroundPos.set(bay.spawn[0], RANGE_Y + FEET_OFFSET, bay.spawn[1]);
  }
  yaw = bay.yaw; pitch = 0;
  verticalVelocity = 0; isGrounded = true;
}

function prPanelChange(d){
  if(_prRow === RANGE_SET.length){ if(d > 0) prResetStats(); return; }
  const s = RANGE_SET[_prRow];
  s.i = (s.i + d + s.opts.length) % s.opts.length;
  if(s.warp) practiceWarp();
  if(s.rebuild) practiceBuildTargets();
  if(s.key === 'pattern'){ if(s.opts[s.i] === 'OFF') _prPat.length = 0; prBoardDraw(); }
  if(s.key === 'numbers'){
    // Damage numbers are a whole-game feature now, not a range one; this row
    // is just the most convenient place to reach the switch.
    if(typeof dmgNumbersOn !== 'undefined') dmgNumbersOn = (s.opts[s.i] === 'ON');
    if(s.opts[s.i] === 'OFF' && typeof dmgClear === 'function') dmgClear();
  }
  prPanelDraw();
}

window.addEventListener('keydown', e => {
  if(!practiceOn || !document.pointerLockElement) return;
  if(e.code === 'KeyF'){ prPanelToggle(!_prSetupOn); e.preventDefault(); return; }
  if(_prSetupOn){
    // While the panel is open the arrows drive it and nothing else. Movement
    // stays on WASD, so you can still walk the firing line while setting up.
    if(e.code === 'ArrowUp'){    prPanelMove(-1); e.preventDefault(); return; }
    if(e.code === 'ArrowDown'){  prPanelMove( 1); e.preventDefault(); return; }
    if(e.code === 'ArrowLeft'){  prPanelChange(-1); e.preventDefault(); return; }
    if(e.code === 'ArrowRight'){ prPanelChange( 1); e.preventDefault(); return; }
  }
  if(e.code === 'KeyE'){ rangeCycle( 1); e.preventDefault(); }
  if(e.code === 'KeyQ'){ rangeCycle(-1); e.preventDefault(); }
});

function practiceBanner(on){
  if(!_prPanel){
    prPanelBuild();
    _prPanel = document.createElement('div');
    _prPanel.id = 'practice-tag';
    document.body.appendChild(_prPanel);
  }
  _prPanel.style.display = on ? 'flex' : 'none';
  if(on) practiceHud();
}

// ── DYING IN THE DUEL BAY ───────────────────────────────────────────────────
// a0-loop answers `health <= 0` with resetGame(), which respawns you in the
// city and empties `enemies` — from inside the facility that means being
// thrown out of it mid-drill, with the room still standing and its targets
// gone. Training gets its own answer: patch you up, clear the air, and put you
// back on the firing point of the bay you were in.
if(typeof resetGame === 'function'){
  const _prOrigReset = resetGame;
  resetGame = function(){
    if(!practiceOn) return _prOrigReset.apply(this, arguments);
    _prDeaths++;
    health = 100;
    isReloading = false;
    resetAllAmmo(); syncAmmoIn();
    for(const b of enemyBullets) scene.remove(b);
    enemyBullets.length = 0;
    for(const b of playerBullets) scene.remove(b);
    playerBullets.length = 0;
    if(typeof isScoped !== 'undefined' && isScoped) setScoped(false);
    practiceWarp();
    practiceBuildTargets();
    updateHUD();
    practiceHud();
  };
}

// ── ENTER / LEAVE ───────────────────────────────────────────────────────────
function practiceStart(){
  rangeBuild();
  rangeShow(true);
  practiceOn = true;
  prResetStats();

  // The same handshake e0-title's "Play solo" does: stop the cinematic, put the
  // lobby away, then take the pointer.
  window.ttSoloPlaying = true;
  if(typeof netBrowse === 'function') netBrowse(false);
  for(const id of ['net-lobby', 'net-room']){
    const el = document.getElementById(id);
    if(el) el.classList.add('net-hide');
  }

  practiceBuildTargets();

  // Stand on the firing point of whichever bay is selected, looking down it.
  // yaw 0 is -Z, which is the direction the hall runs.
  practiceWarp();

  money = PRACTICE_MONEY;
  for(const k in GUNS) owned[k] = true;         // the whole rack, free
  rangeEquip(selectedGunKey);
  updateHUD(); updateMoneyUI(); updateSlotUI();
  practiceBanner(true);
  prBoardDraw();
  try { const p = document.body.requestPointerLock(); if(p && p.catch) p.catch(()=>{}); } catch(e){}
}

function practiceStop(){
  practiceOn = false;
  practiceClearRange();
  rangeShow(false);
  practiceBanner(false);
  prPanelToggle(false);
  if(_prBoard) _prBoard.style.display = 'none';
  if(typeof dmgClear === 'function') dmgClear();
  // Do not leave anyone standing on a floor that no longer exists.
  if(typeof _playerGroundPos !== 'undefined' && _playerGroundPos){
    const gy = (typeof groundHeightAt === 'function') ? groundHeightAt(-40, 40, Infinity) : 0;
    _playerGroundPos.set(-40, gy + FEET_OFFSET, 40);
    verticalVelocity = 0; isGrounded = true;
  }
}

// ── THE BUTTON ──────────────────────────────────────────────────────────────
// Added next to "Play solo". e0-title replaces that node to rebind it, and this
// part loads after e0-title, so the row is already in its final state here.
(function practiceButton(){
  const attach = () => {
    const solo = document.getElementById('net-solo');
    if(!solo || document.getElementById('net-practice')) return !!solo;
    const b = document.createElement('button');
    b.className = 'net-btn ghost';
    b.id = 'net-practice';
    b.style.flex = '1';
    b.textContent = 'Training';
    solo.parentNode.insertBefore(b, solo.nextSibling);
    b.addEventListener('click', practiceStart);
    return true;
  };
  if(attach()) return;
  let tries = 0;
  const t = setInterval(() => { if(attach() || ++tries > 40) clearInterval(t); }, 100);
})();

// ── FRAME ───────────────────────────────────────────────────────────────────
const RANGE_RESPAWN_MS = [500, 1000, 2000, 4000];

(function practiceFrame(){
  requestAnimationFrame(practiceFrame);
  if(!practiceOn) return;

  // Joining a real game ends training — leaving five dummies and a floating
  // room in a live round would be worse than useless.
  if(typeof netInMatch !== 'undefined' && netInMatch){ practiceStop(); return; }

  const now = performance.now();
  const respawn = RANGE_RESPAWN_MS[rsIdx('respawn')];
  for(const s of _prSlots){
    // The bullet loop splices a killed enemy straight out of `enemies`, so that
    // is the signal a target went down — there is no death event to listen for.
    // The flick grid ignores the RESPAWN setting: a drill you have to wait two
    // seconds between reps of is not a drill.
    const wait = bayKey() === 'flick' ? 140 : respawn;
    if(s.obj && enemies.indexOf(s.obj) < 0){ s.obj = null; s.dueAt = now + wait; }
    if(!s.obj && now >= s.dueAt) practiceSpawn(s);
  }
  practiceMoveTargets(now);

  // Reloading is worth practising; running dry is not. Spares are topped back
  // up, so the reload itself still costs you the time it always did — unless
  // you have asked for realistic ammo, in which case you get what the gun
  // carries and nothing more.
  if(rsVal('ammo') === 'INFINITE' &&
     typeof gun !== 'undefined' && gun && !gun.melee && reserve < gun.maxAmmo){
    reserve = (gun.spareMags || 2) * gun.maxAmmo;
    if(typeof syncAmmoOut === 'function') syncAmmoOut();
    updateHUD();
  }
  if(money < PRACTICE_MONEY){ money = PRACTICE_MONEY; updateMoneyUI(); }
})();

console.log('practice: training centre ready — "Training" on the lobby screen, F for setup');
