// ════════════════════════════════════════════════════════════════════════════
//  l0-perf.js — adaptive resolution
//
//  THE PROBLEM THIS EXISTS FOR
//  "Sometimes my FPS cannot go higher than 30." That is almost never a 30 fps
//  cap. WebGL presents on vsync and cannot opt out of it, so the frame rate is
//  not continuous — it can only be the refresh rate divided by a whole number.
//  On a 60 Hz display the available rates are 60, 30, 20, 15. A frame that
//  takes 16.0 ms shows at 60. A frame that takes 17.0 ms misses its slot and
//  waits for the next one, so it shows at 30 — the same 30 you would get from a
//  frame that took twice as long. One millisecond over budget and half the
//  frame rate is gone, which is why it reads as a hard cap rather than as a
//  gradual slowdown, and why it comes and goes as you turn to face heavier or
//  lighter parts of the map.
//
//  THE FIX
//  Render fewer pixels until the frame fits back inside its slot. Fragment cost
//  scales with the square of the render scale, so trimming 15% off draws 28%
//  fewer pixels — usually far more than the millisecond or two needed to get
//  back under the line. The scale is raised again when there is headroom.
//
//  WHY IT TARGETS A FRAME TIME RATHER THAN THE REFRESH RATE
//  The first version of this file tried to learn the display's refresh interval
//  from the frame times it observed, and trim whenever a frame took much longer
//  than one slot. That is exactly backwards, and the tests caught it: a machine
//  that is ALWAYS halved never produces a full-rate frame to learn from, so the
//  estimate settles on 33.3 ms, every frame looks like a perfectly good single
//  slot, and the controller sits there doing nothing on the one machine that
//  needed it. It targets a frame time now — 16.7 ms for 60 fps, from the FPS
//  TARGET setting — which needs nothing learned and cannot be fooled that way.
//
//  WHY GROWTH IS TIMED RATHER THAN MEASURED
//  Vsync also destroys the signal in the other direction. Once the frame fits,
//  every frame presents at exactly one slot no matter how much headroom is
//  left, so there is no measurement that says "you could afford more pixels".
//  The only way to find out is to try. So a rise is a PROBE: after a quiet
//  period the scale steps up, and if the frame starts missing again it steps
//  straight back down and the quiet period required before the next probe
//  doubles. After a few failures the probes are minutes apart, which is what
//  stops the visible 60/30 pulsing that a naive controller produces.
//
//  WHAT IT DOES NOT DO
//  It never renders above the scale the settings menu asks for — it only ever
//  trims. RENDER SCALE stays the ceiling, and the whole thing is off with one
//  switch.
// ════════════════════════════════════════════════════════════════════════════

const AP_MIN_FACTOR   = 0.55;   // never trim below this much of the chosen scale
const AP_STEP_DOWN    = 0.06;
const AP_STEP_UP      = 0.03;   // deliberately half the step down
const AP_WINDOW       = 60;     // frames in the rolling sample
const AP_CHECK_EVERY  = 30;     // frames between decisions
const AP_SLOW         = 1.15;   // median > target * this => missing, shrink
const AP_OK           = 1.05;   // median <= target * this => holding the target
const AP_PROBE_MS     = 8000;   // quiet time before the first upward probe
const AP_PROBE_MAX    = 6;      // doubling caps here: 8 s << 6 is ~8.5 minutes
const AP_WARMUP_MS    = 3000;   // ignore the first seconds — assets are landing

let _apFactor  = 1;             // multiplier on the settings' render scale
let _apFails   = 0;             // consecutive probe failures, for the backoff
let _apFailT   = 0;             // when the frame last missed
let _apLastUp  = 0;             // when the last upward probe happened
let _apFrames  = [];
let _apTick    = 0;
let _apStart   = performance.now();
let _apStatus  = '';            // read by the F3 overlay
let _apLastCeil = -1;           // the RENDER SCALE this file last saw

// Milliseconds one frame is allowed. 60 fps unless the FPS TARGET setting says
// otherwise — the complaint this file answers is being stuck at 30, not being
// at 72 on a 144 Hz panel, so a floor is the right shape of goal.
function apTargetMs(){
  if(typeof setVal !== 'function' || typeof SET === 'undefined' || !SET.fpstarget) return 1000 / 60;
  const n = parseInt(setVal('fpstarget'), 10);
  return 1000 / (isFinite(n) && n > 0 ? n : 60);
}

function apAdaptiveOn(){
  // Off unless the setting says otherwise. Reading it live rather than caching
  // means the menu needs no hook here.
  if(typeof setVal !== 'function' || typeof SET === 'undefined' || !SET.adaptive) return true;
  return setVal('adaptive') === 'ON';
}

// What the settings menu is asking for, which is the ceiling this file trims
// from. Derived rather than intercepted: applySetting('scale') already owns
// the number, and wrapping it would have to survive being called from inside
// applySetting('quality') as well.
function apCeiling(){
  if(typeof setVal !== 'function') return Math.min(window.devicePixelRatio, 1);
  const pct = parseInt(setVal('scale'), 10);
  return Math.min(window.devicePixelRatio, (isFinite(pct) ? pct : 100) / 100);
}

function apApply(){
  const want = apCeiling() * _apFactor;
  if(Math.abs(renderer.getPixelRatio() - want) < 0.002) return;
  renderer.setPixelRatio(want);
  renderer.setSize(innerWidth, innerHeight);
}

function apMedian(a){
  const s = a.slice().sort((x, y) => x - y);
  return s[s.length >> 1];
}

(function apFrame(){
  requestAnimationFrame(apFrame);

  // _perfFrame is maintained by a0-loop; nothing here needs its own clock.
  if(typeof _perfFrame === 'undefined' || !_perfFrame) return;

  const now = performance.now();

  // A deliberate change to RENDER SCALE outranks anything this file decided:
  // the trim starts over from the new ceiling rather than being carried across
  // and quietly making the new setting mean something else.
  const ceil = apCeiling();
  if(_apLastCeil >= 0 && Math.abs(ceil - _apLastCeil) > 0.002){
    _apFactor = 1; _apFails = 0; _apFailT = 0; _apLastUp = 0; _apFrames.length = 0;
  }
  if(_apLastCeil !== ceil){ _apLastCeil = ceil; apApply(); }

  _apFrames.push(_perfFrame);
  if(_apFrames.length > AP_WINDOW) _apFrames.shift();

  if(!apAdaptiveOn()){
    if(_apFactor !== 1){ _apFactor = 1; _apFails = 0; apApply(); }
    _apStatus = '';
    return;
  }
  // Only while actually playing. Frame times on the title screen are measuring
  // a different scene, and adapting to it would arrive at the wrong answer for
  // the one that matters.
  if(!document.pointerLockElement) return;
  if(now - _apStart < AP_WARMUP_MS) return;
  if(_apFrames.length < AP_WINDOW) return;
  if(++_apTick < AP_CHECK_EVERY) return;
  _apTick = 0;

  const target = apTargetMs();
  const med = apMedian(_apFrames);

  if(med > target * AP_SLOW && _apFactor > AP_MIN_FACTOR){
    // Missing. If this happened right after a probe, that probe was the cause,
    // so the wait before the next one doubles.
    if(now - _apLastUp < AP_PROBE_MS * 2) _apFails = Math.min(AP_PROBE_MAX, _apFails + 1);
    _apFailT = now;
    _apFactor = Math.max(AP_MIN_FACTOR, +(_apFactor - AP_STEP_DOWN).toFixed(3));
    apApply();
  } else if(med <= target * AP_OK && _apFactor < 1){
    // Holding the target with pixels to spare — but vsync hides HOW much to
    // spare, so the only way to find out is to try. See the header.
    const wait = AP_PROBE_MS * Math.pow(2, _apFails);
    if(now - _apFailT >= wait && now - _apLastUp >= wait){
      _apFactor = Math.min(1, +(_apFactor + AP_STEP_UP).toFixed(3));
      _apLastUp = now;
      apApply();
    }
  }

  // What the overlay reports. Naming the cause is most of the value: it is the
  // difference between "the machine is slow" and "the frame missed its slot by
  // a hair and lost half the rate for it".
  const missing = med > target * AP_SLOW;
  _apStatus =
    '  frame/target ' + med.toFixed(1) + ' / ' + target.toFixed(1) + 'ms' +
    (missing ? '  <= MISSING' : '') + '\n' +
    '  adaptive   ' + Math.round(_apFactor * 100) + '% of scale' +
    (_apFactor < 1 ? ' (trimmed)' : '') + '\n';
})();

console.log('perf: adaptive resolution active — trims render scale to hold the vsync slot');
