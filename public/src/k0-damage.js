// ════════════════════════════════════════════════════════════════════════════
//  k0-damage.js — floating damage numbers, everywhere
//
//  These started life inside the training centre, where they were gated on
//  practiceOn. That was the wrong home for them: knowing what a round actually
//  did is more useful in a real round than on a range, where you can already
//  see the health bar you are chipping at. This file owns them for the whole
//  game — bots, remote players, the range — and the training centre now only
//  keeps the statistics.
//
//  WHERE THE NUMBERS COME FROM
//  a0-loop calls hitZone(e, ...) and then, only when it returns a zone, calls
//  hitDamage(...) with that zone, with nothing in between. Wrapping the two
//  gives the enemy, the zone, the exact impact point (hitZone returns the entry
//  parameter along the swept segment) and the damage actually dealt, without
//  touching the firing code.
//
//  hitZone is ALSO called by aimDistance in 90-input, for aim convergence
//  rather than for damage. That is harmless: those calls can only leave a stale
//  pending record, and the bullet's own hitZone call always overwrites it
//  immediately before hitDamage runs. The zone equality check below is the belt
//  to that braces.
//
//  THE KNIFE IS THE EXCEPTION
//  Melee never goes near hitZone or hitDamage — doShoot resolves it with a cone
//  test and applies gun.damage flat, on purpose, so that a knife is a knife
//  wherever it lands. There is therefore nothing to wrap, and 90-input calls
//  onMeleeHit() below directly. That is the one line this file needs elsewhere.
//
//  WHAT THE NUMBER MEANS AGAINST A REAL PLAYER
//  For a remote player the server owns health, so the number is the damage this
//  client CLAIMED, sent the instant the round landed. The server can still
//  discard it (see the token bucket in server.js). It is what your gun did, not
//  a promise about their health bar.
// ════════════════════════════════════════════════════════════════════════════

let dmgNumbersOn = true;          // the training panel toggles this

const DMG_POOL = 24;
const DMG_LIFE = 950;             // ms on screen
const DMG_RISE = 0.75;            // metres it floats upward over that life

// Colour carries the zone, so a glance is enough — a red 100 and an amber 90
// are otherwise hard to tell apart in peripheral vision.
const DMG_ZONE_COL = {
  head:    '#ff6a5a',
  chest:   '#ffd166',
  stomach: '#f0a35a',
  legs:    '#9fb4c7',
  melee:   '#e8dcc0',
};

const _dmgNums = [];

// Each sprite owns a small canvas that is redrawn when it is claimed, so a hit
// costs one texture upload and no allocation.
function dmgMake(){
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map:tex, transparent:true, depthTest:false, depthWrite:false,
  }));
  sp.renderOrder = 900;           // in front of the world, like a HUD element
  sp.visible = false;
  sp.frustumCulled = false;
  scene.add(sp);
  const rec = { sp:sp, cv:cv, tex:tex, born:0, x:0, y:0, z:0, active:false };
  _dmgNums.push(rec);
  return rec;
}

function dmgShow(x, y, z, amount, zone){
  if(!dmgNumbersOn) return;
  let rec = null;
  for(const r of _dmgNums) if(!r.active){ rec = r; break; }
  if(!rec) rec = _dmgNums.length < DMG_POOL ? dmgMake() : _dmgNums[0];

  const c = rec.cv.getContext('2d');
  c.clearRect(0, 0, 256, 128);
  const col = DMG_ZONE_COL[zone] || '#ffd166';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = "bold 74px Stratum2, 'Arial Narrow', sans-serif";
  c.lineWidth = 8; c.strokeStyle = 'rgba(8,9,12,0.9)';
  c.strokeText(String(amount), 128, 52);
  c.fillStyle = col;
  c.fillText(String(amount), 128, 52);
  c.font = "bold 30px Stratum2, 'Arial Narrow', sans-serif";
  c.lineWidth = 6;
  const label = zone === 'head' ? 'HEADSHOT' : String(zone).toUpperCase();
  c.strokeText(label, 128, 100);
  c.fillText(label, 128, 100);
  rec.tex.needsUpdate = true;

  rec.x = x; rec.y = y; rec.z = z;
  rec.born = performance.now();
  rec.active = true;
  rec.sp.visible = true;
  rec.sp.position.set(x, y, z);
}

function dmgClear(){
  for(const r of _dmgNums){ r.active = false; r.sp.visible = false; }
}

// ── HIT SOURCES ─────────────────────────────────────────────────────────────
let _dmgPend = null;

if(typeof hitZone === 'function'){
  const _origZone = hitZone;
  hitZone = function(e, fx, fy, fz, tx, ty, tz){
    const r = _origZone(e, fx, fy, fz, tx, ty, tz);
    if(r){
      _dmgPend = { e:e, zone:r.zone,
                   x: fx + (tx - fx) * r.t,
                   y: fy + (ty - fy) * r.t,
                   z: fz + (tz - fz) * r.t };
    }
    return r;
  };
}

if(typeof hitDamage === 'function'){
  const _origDamage = hitDamage;
  hitDamage = function(base, headshot, zone, mult){
    const d = _origDamage(base, headshot, zone, mult);
    if(_dmgPend && _dmgPend.zone === zone){
      dmgOnHit(_dmgPend, d);
      _dmgPend = null;
    }
    return d;
  };
}

// Called from the melee branch of doShoot. The blade has no impact point of
// its own — the cone test that resolves a swing does not produce one — so the
// number goes on the body's centre of mass, which is where you were aiming.
function onMeleeHit(enemy, amount){
  if(!enemy) return;
  // Chest centre, derived the same way the hitboxes are: HITBOX puts the chest
  // band at 1.04-1.54 in AUTHORED units and multiplies by the body's hitScale.
  // Guessing from a 1.8 m human was wrong — these rigs are scaled up, so a
  // fraction of the total height landed the number at the stomach.
  const sc = (enemy.userData && enemy.userData.hitScale) || 1;
  dmgOnHit({ e:enemy, zone:'melee',
             x: enemy.position.x,
             y: enemy.position.y + 1.29 * sc,
             z: enemy.position.z }, amount);
}

// One funnel, so anything that wants to know about a hit — the training
// centre's statistics, today — subscribes in one place rather than installing
// a second set of wrappers around the same two functions.
function dmgOnHit(h, amount){
  dmgShow(h.x, h.y, h.z, amount, h.zone);
  if(typeof prOnHit === 'function') prOnHit(h, amount);
}

// ── FRAME ───────────────────────────────────────────────────────────────────
(function dmgFrame(){
  requestAnimationFrame(dmgFrame);
  if(!_dmgNums.length) return;
  const now = performance.now();
  for(const r of _dmgNums){
    if(!r.active) continue;
    const t = (now - r.born) / DMG_LIFE;
    if(t >= 1){ r.active = false; r.sp.visible = false; continue; }
    r.sp.position.set(r.x, r.y + t * DMG_RISE, r.z);
    // Held at full opacity for the first third so it is readable, then fading.
    r.sp.material.opacity = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
    const s = 0.55 + t * 0.18;
    r.sp.scale.set(s * 2, s, 1);
  }
})();

console.log('damage: floating hit numbers active (bullets and melee, all modes)');
