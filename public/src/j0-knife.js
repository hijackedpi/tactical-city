// ── KNIFE VIEWMODEL ANIMATION ───────────────────────────────────────────────
// Everything the knife did before this file was one line in doShoot:
//
//     gunRecoilZ = gun.recoilZ; gunRecoilY = gun.recoilY;
//
// ...which is the *gun* recoil path. a0-loop turns that into a position nudge
// (0.10 back, 0.04 up) decaying 0.85 a frame. So a knife swing was a small
// backward twitch, identical in kind to firing a pistol, with no rotation, no
// arc, no direction, and no difference between the first swing and the tenth.
//
// This file gives the knife its own pose, driven procedurally off the SAME
// trigger the swing already used, and adds nothing to the gameplay: no new
// damage, no new reach, no new input, no change to when a hit is scored. What
// changes is only what you see.
//
// HOW IT TAKES CONTROL. a0-loop rewrites playerGun.position from gunOffsets +
// recoil every frame. Parts listed later in PARTS register their rAF callback
// later and therefore run after it, so this file simply writes position AND
// rotation afterwards and owns the transform outright — but only while the
// knife is the equipped weapon. Any other weapon and it returns immediately,
// leaving a0-loop's write exactly as it was.

// ── TIMING ──────────────────────────────────────────────────────────────────
// The gate in doShoot is gun.fireInterval = 420 ms, so the whole attack has to
// finish inside that or a fast player sees it cut off mid-motion. The windup
// raises the arm; the strike is deliberately brief — the blade is only
// actually travelling for a tenth of a second, which is what makes it read as
// hard — and the recovery gets the rest. The overhead raises further, so it
// gets a little longer to get up there and a little less to settle.
const KN_DOWN = { windup:0.110, strike:0.100, recover:0.200 };
const KN_OVER = { windup:0.125, strike:0.100, recover:0.185 };
const KN_DRAW  = 0.34;      // deploy, on switching to the knife
const KN_SPRINT_BLEND = 0.16;

// ── POSES ───────────────────────────────────────────────────────────────────
// Each is an offset from the resting viewmodel transform, as
// [ x, y, z, pitch, yaw, roll ]. Lateral terms (x, yaw, roll) are multiplied
// by `viewSide` so a left-handed viewmodel mirrors correctly, and by `dir` so
// one set of numbers describes both the outward slash and the backhand that
// returns along the same path.
//
//   +x right   +y up   -z forward (away from the eye)
//   pitch about X: NEGATIVE drops the tip down, positive lifts it
//                  (the blade lies along -Z, and R_x(t) sends it to
//                   (0, sin t, -cos t), so the sign is not the intuitive one)
//   yaw   about Y: swings the blade across the view
//   roll  about Z: rotates the edge
//
// EVERY ATTACK IS A DOWNWARD STAB. The hand is raised, the blade is cocked
// tip-up, and then the whole thing is driven DOWN and forward with the tip
// rotating hard over — so the travel is mostly in -y and the pitch ends deeply
// negative. The three beats differ in where the blade is raised from, not in
// what it then does.
//
// TWO HARD CONSTRAINTS, both found by rendering these rather than by reasoning
// about them, and both invisible to a numeric test:
//
// 1. NO POSE MAY ADD +Z. 50-weapons places every weapon so its rear sits at
//    z = -0.24 (GRIP_DEPTH), and the camera's near plane is at 0.2 — four
//    centimetres of clearance for the whole viewmodel. The obvious way to
//    write a windup is to pull the hand back toward the eye, and the first
//    draft did exactly that (+0.13 on the slash, +0.18 on the stab, +0.20 on
//    the draw). All three put the butt of the knife through the near plane,
//    where it is sliced open. Every z term below is <= 0.
//
// 2. LATERAL TRAVEL IS MAGNIFIED. The viewmodel sits ~0.37 from the eye, so a
//    14 cm sideways move is a huge angular swing: the first windup put the
//    knife clean off the right of the screen for the whole 100 ms. Distance is
//    the expensive way to make a swing read big. ROTATION is the cheap way —
//    it costs no framing at all — so the travel here is small and the angles
//    are large, which is also how a real arm works: the wrist and elbow turn
//    far more than the fist translates.
const KN_POSE = {
  // Cocked high and out to the side, blade tip up and turned over ready to
  // come down. This is the shoulder-height raise.
  downUp:   [  0.07,  0.19,  0.00,   0.70, -0.30,  0.55 ],
  // Driven straight down and forward, tip rotated hard over past vertical.
  // -1.15 rad is about 66 degrees below the horizontal, so the point leads.
  downHit:  [ -0.06, -0.18, -0.20,  -1.15,  0.20, -0.35 ],

  // The third beat raises higher and more centred — a full overhead — and
  // comes down harder and deeper. Same motion, bigger.
  overUp:   [  0.02,  0.24,  0.00,   0.85, -0.10,  0.20 ],
  overHit:  [ -0.02, -0.20, -0.24,  -1.30,  0.05, -0.10 ],

  // Carried across the chest while running. Not a stab — a hold.
  sprint:   [  0.05, -0.02, -0.02,   0.28, -0.55,  0.60 ],
  // Brought up from below the frame on deploy. This one is DELIBERATELY out
  // of frame vertically at t=0 — that is the whole point of a draw — but it
  // still obeys constraint 1.
  draw:     [  0.03, -0.30, -0.02,   1.15, -0.35,  0.55 ],
};

// The three beats, in order. All stab downward; `dir` mirrors the lateral
// channels so consecutive stabs come down from opposite sides rather than
// repeating one twitch, and the third is the overhead.
const KN_ATTACKS = [
  { up:'downUp', hit:'downHit', dir: 1, time:KN_DOWN },
  { up:'downUp', hit:'downHit', dir:-1, time:KN_DOWN },
  { up:'overUp', hit:'overHit', dir: 1, time:KN_OVER },
];

// A knife is held, not aimed, so the resting pose is NOT square to the screen
// the way a gun's is. This is the small constant tilt that makes it look like
// something in a fist rather than something bolted to the camera.
const KN_REST = [ 0, 0, 0, -0.06, -0.10, 0.14 ];

// ── STATE ───────────────────────────────────────────────────────────────────
let knPhase   = 'idle';   // idle | windup | strike | recover
let knT       = 0;        // seconds into the current phase
let knBeat    = 0;        // which attack comes out next
let knAtk     = KN_ATTACKS[0];   // the one currently playing
let knDir     = 1;        // which side it comes down from
let knJar     = 0;        // impact shudder, 0..1, set when a swing connects
let knDrawT   = KN_DRAW;  // counts up to KN_DRAW; starts finished
let knSprint  = 0;        // 0..1 blend into the run pose
let knIdleT   = 0;        // free-running clock for the breathing sway
let knLastKey = null;
let knLastFrame = 0;

// ── EASING ──────────────────────────────────────────────────────────────────
// The windup eases OUT: the hand snaps back and hangs there for an instant,
// which is what sells the strike that follows. The strike also eases out — a
// slash is stored energy released, fastest at the moment of release and
// decelerating into the follow-through, not a symmetrical sine. Recovery is
// gentler still.
const knOut2 = t => 1 - (1 - t) * (1 - t);
const knOut3 = t => 1 - Math.pow(1 - t, 3);

// pose lerp into the six-slot accumulator
const _knA = [0, 0, 0, 0, 0, 0];
function knMix(from, to, t, side, dir, amt){
  for(let i = 0; i < 6; i++){
    // x(0), yaw(4) and roll(5) are the mirrored channels
    const m = (i === 0 || i === 4 || i === 5) ? side * dir : 1;
    _knA[i] += (from[i] + (to[i] - from[i]) * t) * m * amt;
  }
}

const KN_ZERO = [0, 0, 0, 0, 0, 0];

// ── TRIGGER ─────────────────────────────────────────────────────────────────
// doShoot owns the fire-rate gate, the pointer-lock check, the third-person
// guard and the netCanShoot check, and it is not worth duplicating any of
// them here — nor safe to, since they would drift apart. Instead the wrapper
// watches _lastShotTime, which doShoot only advances on a swing that was
// actually accepted. Changed means swung.
if(typeof doShoot === 'function'){
  const _knOrigShoot = doShoot;
  doShoot = function(){
    const beforeT = (typeof _lastShotTime !== 'undefined') ? _lastShotTime : 0;
    const beforeK = (typeof selectedGunKey !== 'undefined') ? selectedGunKey : null;
    const r = _knOrigShoot.apply(this, arguments);
    if(beforeK === 'knife' && typeof _lastShotTime !== 'undefined' && _lastShotTime !== beforeT){
      knStartSwing();
    }
    return r;
  };
}

function knStartSwing(){
  // Three downward stabs: from the right, from the left, then a full overhead.
  // Mashing the button therefore produces a sequence rather than the same
  // twitch over and over, which was the single most repetitive thing about it.
  knAtk  = KN_ATTACKS[knBeat];
  knDir  = knAtk.dir;
  knBeat = (knBeat + 1) % KN_ATTACKS.length;
  knPhase = 'windup';
  knT = 0;
  knJar = 0;
}

// ── IMPACT ──────────────────────────────────────────────────────────────────
// playHit fires for every hit the player lands, gun or knife. Inside the strike
// window of a knife swing it can only be this swing connecting, so that is a
// free impact signal with no change to the melee code at all.
if(typeof playHit === 'function'){
  const _knOrigHit = playHit;
  playHit = function(){
    if(knPhase === 'windup' || knPhase === 'strike') knJar = 1;
    return _knOrigHit.apply(this, arguments);
  };
}

// Re-deploy whenever the knife becomes the equipped weapon.
function knOnEquip(){ knDrawT = 0; knPhase = 'idle'; knT = 0; knJar = 0; }

function knInPlay(){
  if(typeof _titleShouldRun === 'function' && _titleShouldRun()) return false;
  if(typeof thirdPerson !== 'undefined' && thirdPerson) return false;
  return true;
}

(function knifeFrame(now){
  requestAnimationFrame(knifeFrame);

  // Clamped at BOTH ends. rAF timestamps are monotonic in practice, but a
  // harness driving the loop by hand, a tab restored from bfcache, or a clock
  // adjustment can hand back a `now` behind the last one — and a negative dt
  // runs knDrawT past zero, where `knDrawT / KN_DRAW` goes negative and the
  // cubic in knOut3 grows without bound. Caught here rather than at each use.
  const dt = knLastFrame ? Math.max(0, Math.min(0.05, (now - knLastFrame) / 1000)) : 0;
  knLastFrame = now;

  if(typeof playerGun === 'undefined' || !playerGun) return;
  if(typeof selectedGunKey === 'undefined') return;

  if(selectedGunKey !== knLastKey){
    if(selectedGunKey === 'knife') knOnEquip();
    // Leaving the knife: hand the transform straight back. a0-loop rewrites
    // position next frame anyway, but the rotation is ours alone and nothing
    // else would ever clear it.
    else if(knLastKey === 'knife') playerGun.rotation.set(0, 0, 0);
    knLastKey = selectedGunKey;
  }
  if(selectedGunKey !== 'knife' || !knInPlay()) return;

  knIdleT += dt;
  const side = (typeof viewSide !== 'undefined' ? viewSide : 1);

  // ── advance the swing state machine ──
  if(knPhase !== 'idle'){
    const T = knAtk.time;
    knT += dt;
    if(knPhase === 'windup' && knT >= T.windup){ knT -= T.windup; knPhase = 'strike'; }
    if(knPhase === 'strike' && knT >= T.strike){ knT -= T.strike; knPhase = 'recover'; }
    if(knPhase === 'recover' && knT >= T.recover){ knPhase = 'idle'; knT = 0; }
  }
  knJar = Math.max(0, knJar - dt * 5.5);

  // Run pose blends in only when the hands are otherwise free. Swinging while
  // sprinting should look like a swing, not a compromise between the two.
  const moving = (typeof keys !== 'undefined') &&
                 (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD']) &&
                 (typeof isGrounded === 'undefined' || isGrounded);
  // A fixed RATE, not an exponential approach. The obvious `+= (want - cur) *
  // k` form never actually arrives: at 60 fps it still had 14% of the run pose
  // left 300 ms after you stopped moving, so the knife kept drifting back for
  // half a second after a blend that says 0.16 in its own name. This reaches
  // exactly 0 or 1 in KN_SPRINT_BLEND seconds and then stays there.
  const wantSprint = (moving && knPhase === 'idle') ? 1 : 0;
  const snRate = dt / KN_SPRINT_BLEND;
  knSprint = wantSprint > knSprint ? Math.min(wantSprint, knSprint + snRate)
                                   : Math.max(wantSprint, knSprint - snRate);

  // ── build the pose ──
  for(let i = 0; i < 6; i++) _knA[i] = 0;

  const up  = KN_POSE[knAtk.up];
  const hit = KN_POSE[knAtk.hit];
  const T   = knAtk.time;

  if(knPhase === 'windup'){
    knMix(KN_ZERO, up, knOut2(knT / T.windup), side, knDir, 1);
  } else if(knPhase === 'strike'){
    // A connecting swing does not sweep clean through: the blade is stopped by
    // what it hit. Cutting the travel short is a much stronger cue than any
    // amount of shake, so an impact keeps ~30% of the follow-through back.
    const reach = 1 - 0.30 * knJar;
    knMix(up, hit, knOut3(knT / T.strike) * reach, side, knDir, 1);
  } else if(knPhase === 'recover'){
    const t = knT / T.recover;
    // Overshoot slightly past rest and settle back, so the arm has weight.
    const e = knOut2(t) * (1 + 0.10 * Math.sin(t * Math.PI * 2) * (1 - t));
    knMix(hit, KN_ZERO, Math.min(1.10, e), side, knDir, 1);
  }

  if(knSprint > 0.001) knMix(KN_ZERO, KN_POSE.sprint, knSprint, side, 1, 1);

  if(knDrawT < KN_DRAW){
    knDrawT += dt;
    // Draw runs backwards: full offset at t=0, none by the end.
    const d = 1 - knOut3(Math.max(0, Math.min(1, knDrawT / KN_DRAW)));
    knMix(KN_ZERO, KN_POSE.draw, d, side, 1, 1);
  }

  // Idle life. Small enough that you would not name it if asked, large enough
  // that the knife stops looking welded to the camera.
  if(knPhase === 'idle'){
    const b = 1 - knSprint;
    _knA[1] += Math.sin(knIdleT * 1.5) * 0.006 * b;
    _knA[2] += Math.sin(knIdleT * 1.1 + 0.7) * 0.004 * b;
    _knA[3] += Math.sin(knIdleT * 0.9 + 1.2) * 0.018 * b;
    _knA[5] += Math.sin(knIdleT * 1.3) * 0.024 * b * side;
  }

  // Impact shudder, on top of the shortened arc.
  if(knJar > 0){
    const s = Math.sin(knJar * 34) * knJar;
    _knA[2] += s * 0.020;
    _knA[3] += s * 0.090;
  }

  // ── write it ────────────────────────────────────────────────────────────
  const o = gunOffsets['knife'] || [0.26, -0.22, -0.37];
  playerGun.position.set(
    Math.abs(o[0]) * side + _knA[0],
    o[1] + _knA[1],
    o[2] + _knA[2]
  );
  playerGun.rotation.set(
    KN_REST[3] + _knA[3],
    KN_REST[4] * side + _knA[4],
    KN_REST[5] * side + _knA[5]
  );
})(0);

console.log('knife: viewmodel animation active (draw / idle / sprint / slash-backhand-stab)');
