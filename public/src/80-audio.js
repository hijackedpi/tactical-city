// ── SOUND ENGINE ───────────────────────────────────────────────────────────
const AC = new (window.AudioContext || window.webkitAudioContext)();
// Single output stage: every sound connects here instead of the destination,
// which gives the settings menu one place to set volume.
const masterOut = AC.createGain();
masterOut.gain.value = 1;
masterOut.connect(AC['destination']);
document.addEventListener('click', () => { if (AC.state === 'suspended') AC.resume(); }, {once:true});

function noiseBuffer(dur, shape) {
  const n = AC.sampleRate * dur | 0;
  const buf = AC.createBuffer(1, n, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * shape(i / n);
  return buf;
}
function biquad(type, freq, dest) {
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  f.connect(dest || masterOut); return f;
}

function playGunshot() {
  const t = AC.currentTime;
  const crackN = noiseBuffer(0.004, x => 1 - x);
  const crackHP = biquad('highpass', 2000);
  const crackG = AC.createGain(); crackG.gain.setValueAtTime(3.5, t); crackG.gain.exponentialRampToValueAtTime(0.001, t + 0.004);
  const crackSrc = AC.createBufferSource(); crackSrc.buffer = crackN;
  crackSrc.connect(crackHP); crackHP.connect(crackG); crackG.connect(masterOut);
  crackSrc.start(t); crackSrc.stop(t + 0.004);
  const bodyN = noiseBuffer(0.12, x => Math.pow(1 - x, 1.4));
  const bodyLP = biquad('lowpass', 900); const bodyHP = biquad('highpass', 200, bodyLP);
  const bodyG = AC.createGain(); bodyG.gain.setValueAtTime(2.0, t); bodyG.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  const bodySrc = AC.createBufferSource(); bodySrc.buffer = bodyN;
  bodySrc.connect(bodyHP); bodyLP.connect(bodyG); bodyG.connect(masterOut);
  bodySrc.start(t); bodySrc.stop(t + 0.12);
  const sub = AC.createOscillator(); sub.type = 'sine';
  sub.frequency.setValueAtTime(90, t); sub.frequency.exponentialRampToValueAtTime(30, t + 0.09);
  const subG = AC.createGain(); subG.gain.setValueAtTime(1.0, t); subG.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  sub.connect(subG); subG.connect(masterOut); sub.start(t); sub.stop(t + 0.09);
}
function playRifleShot() {
  const t = AC.currentTime;
  const crackN = noiseBuffer(0.003, x => 1 - x);
  const crackHP = biquad('highpass', 3000);
  const crackG = AC.createGain(); crackG.gain.setValueAtTime(5.0, t); crackG.gain.exponentialRampToValueAtTime(0.001, t + 0.003);
  const crackSrc = AC.createBufferSource(); crackSrc.buffer = crackN;
  crackSrc.connect(crackHP); crackHP.connect(crackG); crackG.connect(masterOut);
  crackSrc.start(t); crackSrc.stop(t + 0.003);
  const bodyN = noiseBuffer(0.08, x => Math.pow(1 - x, 2.0));
  const bodyBP = biquad('bandpass', 700); bodyBP.Q.value = 0.8;
  const bodyG = AC.createGain(); bodyG.gain.setValueAtTime(2.5, t); bodyG.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  const bodySrc = AC.createBufferSource(); bodySrc.buffer = bodyN;
  bodySrc.connect(bodyBP); bodyBP.connect(bodyG); bodyG.connect(masterOut);
  bodySrc.start(t); bodySrc.stop(t + 0.08);
}
function playShootSound() {
  const k = selectedGunKey;
  if(k==='awp')           playAWPShot();
  else if(k==='m4a1' && playWeaponSample('m4a1')) return;
  else if(k==='deagle')   playDeagleShot();
  else if(k==='ak47' || k==='m4a1' || k==='mp5' || k==='mp7' || k==='mac10' || k==='ump45')
                          playRifleShot();
  else                    playGunshot();
}
// ── AWP ─────────────────────────────────────────────────────────────────────
// The big one. Built in layers, all synthesised:
//   crack  — the supersonic snap at the very front
//   blast  — a wide, driven burst of noise (the muzzle blast)
//   thump  — a deep pitched-down sine you feel more than hear
//   boom   — a chesty low-mid band of noise that carries the weight
//   tail   — a long outdoor reverb (generated impulse) plus two slapback
//            echoes off the palace walls, rolling off over ~1.5 s
//   bolt   — after the shot, the bolt is worked: up/back, then forward/down
// Everything runs through a compressor so it hits hard without clipping.
// far = true is the version you hear when someone ELSE fires one: quieter,
// duller, no bolt.
const _awpIR = (() => {
  const len = AC.sampleRate * 1.8 | 0, buf = AC.createBuffer(2, len, AC.sampleRate);
  for(let ch = 0; ch < 2; ch++){
    const d = buf.getChannelData(ch); let lp = 0;
    for(let i = 0; i < len; i++){
      const x = i / len, n = Math.random() * 2 - 1;
      lp += (n - lp) * (0.35 - 0.3 * x);               // darker as it decays
      d[i] = lp * Math.pow(1 - x, 3.2) * (i < AC.sampleRate * 0.012 ? i / (AC.sampleRate * 0.012) : 1);
    }
  }
  return buf;
})();
const _awpDrive = (() => {
  const n = 1024, c = new Float32Array(n);
  for(let i = 0; i < n; i++){ const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * 3.2) / Math.tanh(3.2); }
  return c;
})();
// ── RECORDED WEAPON SAMPLES ─────────────────────────────────────────────────
// Weapons with a recorded sound (files in public/). Anything not listed, or a
// file that fails to load, uses the synthesised sound instead.
const WEAPON_SAMPLES = { awp: 'awp_02.mp3', m4a1: 'm4a1-s.mp3', knife: 'knife.mp3' };
const _samples = {};
for(const [key, file] of Object.entries(WEAPON_SAMPLES)){
  fetch(file).then(r => { if(!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(b => AC.decodeAudioData(b)).then(buf => { _samples[key] = buf; })
    .catch(err => console.warn(file + ' failed to load, using the synthesised sound:', err && err.message));
}
// Plays a weapon's sample. far = someone else firing it: quieter and duller.
function playWeaponSample(key, far){
  const buf = _samples[key];
  if(!buf) return false;
  const src = AC.createBufferSource(); src.buffer = buf;
  const g = AC.createGain(); g.gain.value = far ? 0.35 : 0.9;
  src.connect(g);
  if(far){ const lp = biquad('lowpass', 2400); g.connect(lp); } else g.connect(masterOut);
  src.start();
  return true;
}
function playAWPShot(far) {
  if(playWeaponSample('awp', far)) return;
  _playAWPSynth(far);
}
function _playAWPSynth(far) {
  const t = AC.currentTime;
  const out = AC.createDynamicsCompressor();
  out.threshold.value = -10; out.knee.value = 6; out.ratio.value = 6; out.attack.value = 0.002; out.release.value = 0.25;
  const vol = AC.createGain(); vol.gain.value = far ? 0.42 : 0.9;     // peaks just under full scale
  const tone = biquad('lowpass', far ? 2600 : 16000, vol);
  // brick-wall limiter last, so the loudest layer can never clip
  const lim = AC.createDynamicsCompressor();
  lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.12;
  out.connect(tone); vol.connect(lim); lim.connect(masterOut);
  // reverb + slapback echoes, fed from the dry mix
  const wet = AC.createGain(); wet.gain.value = far ? 0.9 : 0.55;
  const verb = AC.createConvolver(); verb.buffer = _awpIR;
  const verbLP = biquad('lowpass', 3200, out);
  wet.connect(verb); verb.connect(verbLP);
  for(const [dt, g] of [[0.17, 0.32], [0.38, 0.18]]){
    const dl = AC.createDelay(1); dl.delayTime.value = dt;
    const eg = AC.createGain(); eg.gain.value = g;
    const elp = biquad('lowpass', 1800, eg);
    wet.connect(dl); dl.connect(elp); eg.connect(out);
  }
  const dry = AC.createGain(); dry.gain.value = 1; dry.connect(out); dry.connect(wet);
  const noise = (dur, shape) => { const s = AC.createBufferSource(); s.buffer = noiseBuffer(dur, shape); return s; };

  if(!far){                                            // 1) crack
    const c = noise(0.006, x => 1 - x), hp = biquad('highpass', 2800, dry);
    const g = AC.createGain(); g.gain.setValueAtTime(6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.006);
    c.connect(g); g.connect(hp); c.start(t); c.stop(t + 0.006);
  }
  {                                                     // 2) blast, driven
    const n = noise(0.32, x => Math.pow(1 - x, 1.6));
    const sh = AC.createWaveShaper(); sh.curve = _awpDrive; sh.oversample = '2x';
    const lp = biquad('lowpass', 2400, dry), hp = biquad('highpass', 120, lp);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(3.2, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    n.connect(g); g.connect(sh); sh.connect(hp); n.start(t); n.stop(t + 0.32);
  }
  {                                                     // 3) thump
    const o = AC.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.28);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(far ? 1.4 : 2.6, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(g); g.connect(dry); o.start(t); o.stop(t + 0.33);
  }
  {                                                     // 4) boom
    const n = noise(0.55, x => Math.pow(1 - x, 2.2));
    const bp = biquad('bandpass', 260, dry); bp.Q.value = 0.9;
    const g = AC.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(4.5, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    n.connect(g); g.connect(bp); n.start(t); n.stop(t + 0.55);
  }
  if(!far){                                             // 5) bolt: two metal clacks
    for(const [dt, f, lvl] of [[0.62, 3400, 0.9], [0.70, 2200, 0.6], [0.86, 2800, 1.0], [0.93, 1400, 0.7]]){
      const c = noise(0.03, x => Math.pow(1 - x, 4));
      const bp = biquad('bandpass', f, masterOut); bp.Q.value = 6;
      const g = AC.createGain(); g.gain.value = lvl * 0.45;
      c.connect(g); g.connect(bp); c.start(t + dt); c.stop(t + dt + 0.03);
    }
  }
}
function playDeagleShot() {
  const t = AC.currentTime;
  // 1) Supersonic CRACK — very sharp, very loud transient
  const crackN = noiseBuffer(0.008, x => 1 - x);
  const crackHP = biquad('highpass', 2500);
  const crackG = AC.createGain();
  crackG.gain.setValueAtTime(8.0, t);
  crackG.gain.exponentialRampToValueAtTime(0.001, t + 0.008);
  const crackSrc = AC.createBufferSource(); crackSrc.buffer = crackN;
  crackSrc.connect(crackHP); crackHP.connect(crackG); crackG.connect(masterOut);
  crackSrc.start(t); crackSrc.stop(t + 0.008);
  // 2) Main BLAST body — big mid punch
  const bodyN = noiseBuffer(0.35, x => Math.pow(1 - x, 0.9));
  const bodyBP = biquad('bandpass', 900); bodyBP.Q.value = 0.6;
  const bodyG = AC.createGain();
  bodyG.gain.setValueAtTime(6.0, t);
  bodyG.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  const bodySrc = AC.createBufferSource(); bodySrc.buffer = bodyN;
  bodySrc.connect(bodyBP); bodyBP.connect(bodyG); bodyG.connect(masterOut);
  bodySrc.start(t); bodySrc.stop(t + 0.35);
  // 3) Deep cannon SUB — heavy low-end boom
  const sub = AC.createOscillator(); sub.type = 'sine';
  sub.frequency.setValueAtTime(140, t);
  sub.frequency.exponentialRampToValueAtTime(22, t + 0.30);
  const subG = AC.createGain();
  subG.gain.setValueAtTime(3.2, t);
  subG.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
  sub.connect(subG); subG.connect(masterOut); sub.start(t); sub.stop(t + 0.30);
  // 4) TAIL / echo — long ringing decay so it sounds huge and magnificent
  const tailN = noiseBuffer(0.7, x => Math.pow(1 - x, 2.2));
  const tailLP = biquad('lowpass', 1400);
  const tailG = AC.createGain();
  tailG.gain.setValueAtTime(0.0, t);
  tailG.gain.linearRampToValueAtTime(1.6, t + 0.02);
  tailG.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  const tailSrc = AC.createBufferSource(); tailSrc.buffer = tailN;
  tailSrc.connect(tailLP); tailLP.connect(tailG); tailG.connect(masterOut);
  tailSrc.start(t); tailSrc.stop(t + 0.7);
  // 5) Metallic ring — the "magnificent" high shimmer
  const ring = AC.createOscillator(); ring.type = 'triangle';
  ring.frequency.setValueAtTime(2200, t);
  ring.frequency.exponentialRampToValueAtTime(1100, t + 0.5);
  const ringG = AC.createGain();
  ringG.gain.setValueAtTime(0.0, t);
  ringG.gain.linearRampToValueAtTime(0.4, t + 0.005);
  ringG.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  ring.connect(ringG); ringG.connect(masterOut); ring.start(t); ring.stop(t + 0.5);
}
// someone else firing: the AWP is unmistakable at any range
function playEnemyShot(weapon) {
  if(weapon === 'awp') playAWPShot(true);
  else if(!(weapon && playWeaponSample(weapon, true))) playGunshot();
}
function playHit() {
  const t = AC.currentTime;
  const thudN = noiseBuffer(0.08, x => Math.pow(1 - x, 2));
  const lp = biquad('lowpass', 400);
  const g = AC.createGain(); g.gain.setValueAtTime(1.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  const src = AC.createBufferSource(); src.buffer = thudN;
  src.connect(lp); lp.connect(g); g.connect(masterOut); src.start(t); src.stop(t + 0.08);
}
function playKill() {
  const t = AC.currentTime;
  const thudN = noiseBuffer(0.08, x => Math.pow(1 - x, 1.8));
  const lp1 = biquad('lowpass', 350);
  const g1 = AC.createGain(); g1.gain.setValueAtTime(2.2, t); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  const s1 = AC.createBufferSource(); s1.buffer = thudN;
  s1.connect(lp1); lp1.connect(g1); g1.connect(masterOut); s1.start(t); s1.stop(t + 0.08);
}
function playPlayerHurt() {
  const t = AC.currentTime;
  const impactN = noiseBuffer(0.06, x => Math.pow(1 - x, 2.5));
  const lp = biquad('lowpass', 500);
  const g = AC.createGain(); g.gain.setValueAtTime(1.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  const src = AC.createBufferSource(); src.buffer = impactN;
  src.connect(lp); lp.connect(g); g.connect(masterOut); src.start(t); src.stop(t + 0.06);
}
function playReload() {
  const t = AC.currentTime;
  const scrapeN = noiseBuffer(0.14, x => 0.3 + 0.7 * Math.sin(x * Math.PI));
  const bp1 = biquad('bandpass', 700); bp1.Q.value = 0.7;
  const gs = AC.createGain(); gs.gain.setValueAtTime(0.18, t); gs.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  const ss = AC.createBufferSource(); ss.buffer = scrapeN;
  ss.connect(bp1); bp1.connect(gs); gs.connect(masterOut); ss.start(t); ss.stop(t + 0.14);
}
function playDeath() {
  const t = AC.currentTime;
  const thudN = noiseBuffer(0.25, x => Math.pow(1 - x, 1.2));
  const lp = biquad('lowpass', 250);
  const g = AC.createGain(); g.gain.setValueAtTime(1.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  const src = AC.createBufferSource(); src.buffer = thudN;
  src.connect(lp); lp.connect(g); g.connect(masterOut); src.start(t); src.stop(t + 0.25);
}

// ── ENGINE SOUND (looped, while in car) ────────────────────────────────────
// Continuous oscillator whose frequency tracks car speed. Created lazily.
let engineOsc = null, engineGain = null, engineFilter = null;
function startEngine(){
  if(engineOsc) return;
  engineOsc = AC.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 60;
  engineFilter = AC.createBiquadFilter();
  engineFilter.type = 'lowpass'; engineFilter.frequency.value = 400;
  engineGain = AC.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(masterOut);
  engineOsc.start();
}
function stopEngine(){
  if(!engineOsc) return;
  try { engineOsc.stop(); } catch(e){}
  engineOsc.disconnect(); engineFilter.disconnect(); engineGain.disconnect();
  engineOsc = null; engineGain = null; engineFilter = null;
}
function updateEngine(speed){
  if(!engineOsc) return;
  const speedFrac = Math.abs(speed) / CAR_MAX_SPEED;
  const targetFreq = 60 + speedFrac * 180;
  const targetGain = 0.04 + speedFrac * 0.07;
  engineOsc.frequency.linearRampToValueAtTime(targetFreq, AC.currentTime + 0.1);
  engineGain.gain.linearRampToValueAtTime(targetGain, AC.currentTime + 0.1);
  engineFilter.frequency.linearRampToValueAtTime(400 + speedFrac * 800, AC.currentTime + 0.1);
}
function playCarImpact(){
  const t = AC.currentTime;
  const n = noiseBuffer(0.18, x => Math.pow(1 - x, 1.2));
  const lp = biquad('lowpass', 220);
  const g = AC.createGain(); g.gain.setValueAtTime(2.0, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  const s = AC.createBufferSource(); s.buffer = n;
  s.connect(lp); lp.connect(g); g.connect(masterOut); s.start(t); s.stop(t + 0.18);
  // metallic ring
  const ring = AC.createOscillator(); ring.type = 'triangle'; ring.frequency.value = 1800;
  const rg = AC.createGain(); rg.gain.setValueAtTime(0.0, t); rg.gain.linearRampToValueAtTime(0.18, t + 0.005); rg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  ring.connect(rg); rg.connect(masterOut); ring.start(t); ring.stop(t + 0.4);
}

// ── CAR ENTER / EXIT ───────────────────────────────────────────────────────
function findNearestCar(){
  const cp = camera.position;
  let best = null, bestDist = 9.0; // must be within 3 units (sqrt(9))
  for(const car of cars){
    const dx = car.x - cp.x, dz = car.z - cp.z;
    const d = dx*dx + dz*dz;
    if(d < bestDist){ bestDist = d; best = car; }
  }
  return best;
}
function enterCar(car){
  if(playerInCar) return;
  if(isScoped) setScoped(false);
  mouseHeld = false;
  if(autoFireInterval){ clearInterval(autoFireInterval); autoFireInterval = null; }

  playerInCar = true;
  currentCar = car;
  // Remove this car from obstacles while driving so it doesn't collide with itself
  const idx = obstacles.indexOf(car.obstacle);
  if(idx >= 0) obstacles.splice(idx, 1);

  // Hide first-person gun & make camera ride the car as chase cam
  if(playerGun) playerGun.visible = false;
  document.body.classList.add('driving');
  document.getElementById('speedo').style.display = 'block';
  document.getElementById('enter-prompt').style.display = 'none';

  // Sync yaw to car's heading so camera looks the right way at first
  // Car faces +Z in local space; in world it points (sin(angle), 0, cos(angle)).
  // We want yaw such that camera's forward (-sin(yaw), -cos(yaw)) aligns with
  // the car's forward direction. So yaw = angle + PI.
  yaw = car.angle + Math.PI;
  pitch = -0.18; // slight downward tilt for chase view

  if(AC.state === 'suspended') AC.resume();
  startEngine();
  updateHUD();
}
function exitCar(forced = false){
  if(!playerInCar || !currentCar) return;
  const car = currentCar;

  // Place player to the LEFT of the car (driver-side exit) at safe ground level.
  // Car's local +X axis is "right"; we want to put player along -X relative to car.
  // World-space left direction is (-cos(angle), 0, sin(angle)).
  const exitCandidates = [
    [-Math.cos(car.angle),  Math.sin(car.angle)],
    [ Math.cos(car.angle), -Math.sin(car.angle)],
    [-Math.sin(car.angle), -Math.cos(car.angle)],
    [ Math.sin(car.angle),  Math.cos(car.angle)],
    [-Math.cos(car.angle) - Math.sin(car.angle), Math.sin(car.angle) - Math.cos(car.angle)],
    [ Math.cos(car.angle) - Math.sin(car.angle),-Math.sin(car.angle) - Math.cos(car.angle)],
  ];
  let exitX = car.x, exitZ = car.z;
  if(!forced){
    for(const [dx, dz] of exitCandidates){
      const len = Math.hypot(dx, dz) || 1;
      const tx = car.x + (dx/len) * 2.6;
      const tz = car.z + (dz/len) * 2.6;
      if(!playerCollides(tx, tz)){ exitX = tx; exitZ = tz; break; }
    }
  }
  camera.position.set(exitX, 1.7, exitZ);
  // Keep current yaw (camera was looking from chase cam, that's fine)
  pitch = 0;
  verticalVelocity = 0; isGrounded = true;

  // Restore this car as an obstacle
  updateCarBox(car);
  car.obstacle.copy(car.bbox);
  obstacles.push(car.obstacle);

  // Zero out car momentum so it doesn't drift away
  car.speed = 0;
  car.steer = 0;

  playerInCar = false;
  currentCar = null;

  if(playerGun) playerGun.visible = true;
  document.body.classList.remove('driving');
  document.getElementById('speedo').style.display = 'none';

  stopEngine();
  updateHUD();
}
