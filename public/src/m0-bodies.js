// ════════════════════════════════════════════════════════════════════════════
//  m0-bodies.js — the real T and CT player models, rigged and animated in code
//
//  The two Meshy models (char_t.glb = Male Insurgent, char_ct.glb = Desert Ops) arrive as a single static
//  mesh with no skeleton. This file:
//
//    1. RIGS them on load. It measures the mesh (crotch, knees, ankles, neck,
//       shoulders, hands), builds a 16-bone skeleton at those joints, and works
//       out skin weights from where each vertex sits on the body. Nothing is
//       hand-placed, so a replacement model drops straight in.
//
//    2. ANIMATES them every frame, entirely procedurally:
//         legs   foot targets that are planted while the body moves over them
//                and lifted on the swing, solved with two-bone IK — so the
//                stride matches the actual speed and direction (no sliding,
//                strafes and backpedals look right)
//         hips   bob twice per stride; a small settle at rest
//         arms   two-bone IK onto the weapon's grip and handguard, so both
//                hands sit on the gun whatever its shape
//         aim    chest, head AND the weapon tilt with where the player is
//                looking up or down
//         idle   breathing when standing still
//         death  a backwards fall with the knees giving way, then the body
//                stays down for a moment before it is cleared
//
//  How it plugs in: the old box "operator" from 60-actors is kept as an
//  invisible driver. It still owns the hitboxes, the weapon attachment
//  (g0-carry) and every userData field the rest of the game reads, so none of
//  that changes. Its box meshes are hidden and the skinned model is added in
//  their place. If a model file fails to load, the box body simply stays
//  visible — nobody is ever invisible.
//
//  Self-contained: delete this file and its PARTS entry and every player goes
//  back to the box model.
// ════════════════════════════════════════════════════════════════════════════

const BODY_FILES = { t: 'char_t.glb', ct: 'char_ct.glb' };
const BODY_H = 1.81;                       // rig authored height (see _OP_BASE_H)
const _bdTpl = { t: null, ct: null };      // rigged templates, one per side
const _bdV = () => new THREE.Vector3();

// ── 1. RIGGING ──────────────────────────────────────────────────────────────

// Smooth 0..1 ramp between a and b.
function _bdSS(a, b, x){ const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// Median of an array of numbers (robust against pouches and holsters).
function _bdMed(a){ if(!a.length) return 0; const s = a.slice().sort((p, q) => p - q); return s[s.length >> 1]; }

// Find the joints of an A/T-posed humanoid, feet at y = 0, centred, facing -Z.
function _bdLandmarks(P){
  const n = P.length / 3, H = BODY_H;
  const slab = (y0, y1, pred) => { const o = []; for(let i = 0; i < n; i++){ const y = P[i*3+1]; if(y >= y0 && y < y1 && (!pred || pred(P[i*3], y, P[i*3+2]))) o.push(i); } return o; };
  const mx = idx => _bdMed(idx.map(i => P[i*3])), mz = idx => _bdMed(idx.map(i => P[i*3+2]));

  // crotch: the lowest height at which the gap between the legs closes and
  // STAYS closed (knees or knee pads that touch only close it briefly)
  let crotchY = 0.45 * H;
  for(let y = 0.30 * H; y < 0.58 * H; y += 0.004 * H){
    let ok = true;
    for(let k = 0; k < 14; k++){ if(slab(y + k * 0.004 * H, y + (k + 1) * 0.004 * H, x => Math.abs(x) < 0.025).length < 2){ ok = false; break; } }
    if(ok){ crotchY = y; break; }
  }
  const hipY   = Math.min(0.54 * H, Math.max(0.44 * H, crotchY + 0.04 * H));
  const ankleY = 0.05 * H;

  // neck: the narrowest point between the shoulders and the head
  let neckY = 0.83 * H, best = 1e9;
  for(let y = 0.78 * H; y < 0.90 * H; y += 0.004 * H){
    const s = slab(y, y + 0.006 * H, x => Math.abs(x) < 0.25);
    if(s.length < 4) continue;
    let w = 0; for(const i of s) w = Math.max(w, Math.abs(P[i*3]));
    if(w < best){ best = w; neckY = y; }
  }
  const headY = neckY + 0.03 * H;
  const spineY = 0.60 * H, chestY = 0.70 * H;
  const spineZ = y => { const s = slab(y - 0.01 * H, y + 0.01 * H, x => Math.abs(x) < 0.12); return s.length ? mz(s) : 0; };

  const J = { hips: [0, hipY, spineZ(hipY)], spine: [0, spineY, spineZ(spineY)],
              chest: [0, chestY, spineZ(chestY)], neck: [0, neckY, spineZ(neckY)],
              head: [0, headY, spineZ(headY)] };

  // torso half-width a little below the neck, where the arms have not started
  let chestHalf = 0;
  { const s = slab(neckY - 0.07 * H, neckY - 0.05 * H, x => Math.abs(x) < 0.30); for(const i of s) chestHalf = Math.max(chestHalf, Math.abs(P[i*3])); }
  const shY = neckY - 0.045 * H;

  for(const side of ['L', 'R']){
    const sg = side === 'L' ? -1 : 1;
    const onSide = x => x * sg > 0.02;

    // ── leg ──
    const thighS = slab(crotchY - 0.10 * H, crotchY - 0.03 * H, onSide);
    const hipX = thighS.length ? mx(thighS) : sg * 0.12;
    const kneeY = ankleY + 0.52 * (hipY - ankleY);
    const kS = slab(kneeY - 0.012 * H, kneeY + 0.012 * H, onSide);
    const aS = slab(ankleY + 0.01 * H, ankleY + 0.035 * H, onSide);
    let toeZ = 0; { const f = slab(0, 0.04 * H, onSide); for(const i of f) toeZ = Math.min(toeZ, P[i*3+2]); }
    J['thigh' + side] = [hipX, hipY, J.hips[2]];
    J['foot'  + side] = [aS.length ? mx(aS) : hipX, ankleY, aS.length ? mz(aS) : 0];
    // knee on the straight line hip -> ankle (nudged a hair forward so it
    // always bends the right way). Measuring it from the surface put it at
    // the front of the knee pads and left every agent standing in a crouch.
    { const f = J['foot' + side], t = (hipY - kneeY) / (hipY - ankleY);
      J['shin' + side] = [hipX + (f[0] - hipX) * t, kneeY, J.hips[2] + (f[2] - J.hips[2]) * t + 0.012]; }
    J['toe'   + side] = [J['foot' + side][0], 0.015 * H, toeZ * 0.9];

    // ── arm: shoulder joint inside the deltoid, hand = farthest point out ──
    const S = new THREE.Vector3(sg * chestHalf * 0.72, shY, spineZ(shY));
    let tip = null, far = -1;
    for(let i = 0; i < n; i++){ const x = P[i*3]; if(x * sg > far && P[i*3+1] > 0.25 * H){ far = x * sg; tip = i; } }
    const T = new THREE.Vector3(P[tip*3], P[tip*3+1], P[tip*3+2]);
    const len = S.distanceTo(T), u = T.clone().sub(S).normalize();
    // pull a point onto the limb's centre line: average of nearby surface
    const centre = (p, r) => {
      const acc = new THREE.Vector3(); let c = 0;
      for(let i = 0; i < n; i++){
        const dx = P[i*3] - p.x, dy = P[i*3+1] - p.y, dz = P[i*3+2] - p.z;
        const along = dx * u.x + dy * u.y + dz * u.z;
        if(Math.abs(along) > 0.02) continue;
        if(dx*dx + dy*dy + dz*dz > r * r) continue;
        acc.x += P[i*3]; acc.y += P[i*3+1]; acc.z += P[i*3+2]; c++;
      }
      return c > 6 ? acc.divideScalar(c) : p;
    };
    const handLen = 0.105 * H;
    const W = centre(S.clone().addScaledVector(u, len - handLen), 0.09);
    const E = centre(S.clone().addScaledVector(u, (len - handLen) * 0.56), 0.11);
    J['upperArm' + side] = [S.x, S.y, S.z];
    J['foreArm'  + side] = [E.x, E.y, E.z];
    J['hand'     + side] = [W.x, W.y, W.z];
    J['tip'      + side] = [T.x, T.y, T.z];
  }
  J._meta = { crotchY, hipY, neckY, headY, chestHalf, ankleY };
  return J;
}

// bone name -> parent, in build order
const _BD_BONES = [
  ['hips', null], ['spine', 'hips'], ['chest', 'spine'], ['neck', 'chest'], ['head', 'neck'],
  ['upperArmL', 'chest'], ['foreArmL', 'upperArmL'], ['handL', 'foreArmL'],
  ['upperArmR', 'chest'], ['foreArmR', 'upperArmR'], ['handR', 'foreArmR'],
  ['thighL', 'hips'], ['shinL', 'thighL'], ['footL', 'shinL'],
  ['thighR', 'hips'], ['shinR', 'thighR'], ['footR', 'shinR'],
  // one bone for all four fingers, from the knuckles: Meshy hands come flat,
  // and curling this round the grip is what makes them HOLD the weapon
  ['fingersL', 'handL'], ['fingersR', 'handR'],
  // ...and two more joints per hand, so the fingers curl rather than tilt
  ['fingers2L', 'fingersL'], ['fingers2R', 'fingersR'],
  ['fingers3L', 'fingers2L'], ['fingers3R', 'fingers2R'],
];
const _BD_IDX = Object.fromEntries(_BD_BONES.map(([b], i) => [b, i]));

// Skin weights: every vertex is first assigned to a body region (arm, leg or
// trunk) and then blended along that region's chain around each joint, which
// gives clean bends without one limb ever pulling on another.
function _bdWeights(P, J, index){
  const n = P.length / 3, H = BODY_H, m = J._meta;
  const NB = _BD_BONES.length, D = new Float32Array(n * NB);   // dense weights, smoothed below
  const v = _bdV(), tmp = _bdV();
  const arm = {};
  for(const s of ['L', 'R']){
    const S = new THREE.Vector3(...J['upperArm' + s]), E = new THREE.Vector3(...J['foreArm' + s]);
    const W = new THREE.Vector3(...J['hand' + s]),     T = new THREE.Vector3(...J['tip' + s]);
    const u = T.clone().sub(S).normalize();
    arm[s] = { S, u, tE: E.clone().sub(S).dot(u), tW: W.clone().sub(S).dot(u), len: T.distanceTo(S) };
    // knuckles: a little under halfway from the wrist to the fingertips; the
    // joint sits at the middle of the hand's cross-section there
    const A = arm[s]; A.tK = A.tW + 0.42 * (A.len - A.tW);
    const kc = new THREE.Vector3(); let kn = 0;
    for(let i = 0; i < n; i++){
      v.set(P[i*3], P[i*3+1], P[i*3+2]).sub(S);
      const t = v.dot(u); if(Math.abs(t - A.tK) > 0.012) continue;
      if(v.addScaledVector(u, -t).length() > 0.08) continue;
      kc.x += P[i*3]; kc.y += P[i*3+1]; kc.z += P[i*3+2]; kn++;
    }
    J['fingers' + s] = kn > 5 ? [kc.x / kn, kc.y / kn, kc.z / kn] : S.clone().addScaledVector(u, A.tK).toArray();
  }
  // Each vertex goes to the body part whose centre line it is closest to
  // (minus that part's thickness), so bulky sleeves, pads and pouches still
  // land on the right limb whatever side of the centre they hang on.
  const V3 = a => new THREE.Vector3(a[0], a[1], a[2]);
  const headTop = [0, m.headY + 0.12 * H, J.head[2]];
  const segs = [
    ['T', V3(J.hips), V3(J.chest), 0.15], ['T', V3(J.chest), V3(J.neck), 0.14], ['T', V3(J.neck), V3(headTop), 0.10],
  ];
  for(const s of ['L', 'R']){
    // the upper-arm segment starts a little OUT from the shoulder joint, so
    // vest straps and backpack straps over the shoulder stay with the chest
    const Sa = V3(J['upperArm' + s]), Ea = V3(J['foreArm' + s]);
    segs.push(['A' + s, Sa.clone().lerp(Ea, 0.18), Ea, 0.065],
              ['A' + s, V3(J['foreArm' + s]),  V3(J['hand' + s]),    0.055],
              ['A' + s, V3(J['hand' + s]),     V3(J['tip' + s]),     0.05],
              ['G' + s, V3(J['thigh' + s]),    V3(J['shin' + s]),    0.09],
              ['G' + s, V3(J['shin' + s]),     V3(J['foot' + s]),    0.07],
              ['G' + s, V3(J['foot' + s]),     V3(J['toe' + s]),     0.05]);
  }
  const _ab = _bdV(), _ap = _bdV();
  const segD = (p, a, b) => { _ab.copy(b).sub(a); _ap.copy(p).sub(a); const t = Math.max(0, Math.min(1, _ap.dot(_ab) / _ab.lengthSq())); return _ap.addScaledVector(_ab, -t).length(); };
  for(let i = 0; i < n; i++){
    v.set(P[i*3], P[i*3+1], P[i*3+2]);
    let region = 'T', bestD = 1e9;
    for(const [r, a, b, rad] of segs){ const d = segD(v, a, b) - rad; if(d < bestD){ bestD = d; region = r; } }
    const w = {};                                   // bone -> weight
    const add = (b, x) => { if(x > 0) w[b] = (w[b] || 0) + x; };

    // ── arm ──
    if(region[0] === 'A'){
      const side = region[1], A = arm[side];
      const t = tmp.copy(v).sub(A.S).dot(A.u);
      const inArm = _bdSS(-0.01, 0.09, t);                         // shoulder blend into chest
      const fore  = _bdSS(A.tE - 0.045, A.tE + 0.045, t);
      const hand  = _bdSS(A.tW - 0.02, A.tW + 0.03, t);
      add('chest', 1 - inArm);
      add('upperArm' + side, inArm * (1 - fore));
      add('foreArm'  + side, inArm * fore * (1 - hand));
      const fing  = _bdSS(A.tK - 0.012, A.tK + 0.018, t);
      add('hand'     + side, inArm * fore * hand * (1 - fing));
      add('fingers'  + side, inArm * fore * hand * fing);
    }
    // ── leg ──
    else if(region[0] === 'G'){
      const ls = region[1];
      const leg  = 1 - _bdSS(m.hipY - 0.09 * H, m.hipY + 0.04 * H, v.y);
      const kneeY = J['shin' + ls][1];
      const shin = 1 - _bdSS(kneeY - 0.035 * H, kneeY + 0.035 * H, v.y);
      const foot = 1 - _bdSS(m.ankleY - 0.012 * H, m.ankleY + 0.025 * H, v.y);
      add('hips', 1 - leg);
      add('thigh' + ls, leg * (1 - shin));
      add('shin'  + ls, leg * shin * (1 - foot));
      add('foot'  + ls, leg * shin * foot);
    }
    // ── trunk and head ──
    else {
      const y = v.y;
      const sp = _bdSS(0.55 * H, 0.63 * H, y);
      const ch = _bdSS(0.65 * H, 0.72 * H, y);
      const nk = _bdSS(m.neckY - 0.03 * H, m.neckY + 0.005 * H, y);
      const hd = _bdSS(m.headY - 0.01 * H, m.headY + 0.025 * H, y);
      add('hips',  1 - sp);
      add('spine', sp * (1 - ch));
      add('chest', sp * ch * (1 - nk));
      add('neck',  sp * ch * nk * (1 - hd));
      add('head',  sp * ch * nk * hd);
    }
    let sum = 0; for(const b in w) sum += w[b];
    if(sum <= 0) D[i * NB] = 1;
    else for(const b in w) D[i * NB + _BD_IDX[b]] = w[b] / sum;
  }
  _bdSmooth(D, NB, P, index, 4);
  // top four, normalised
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4);
  const top = [];
  for(let i = 0; i < n; i++){
    top.length = 0;
    for(let b = 0; b < NB; b++){ const x = D[i * NB + b]; if(x > 0.002) top.push([b, x]); }
    top.sort((a, c) => c[1] - a[1]);
    let sum = 0; for(let k = 0; k < 4 && k < top.length; k++) sum += top[k][1];
    if(sum <= 0){ skinIndex[i*4] = 0; skinWeight[i*4] = 1; continue; }
    for(let k = 0; k < 4 && k < top.length; k++){ skinIndex[i*4+k] = top[k][0]; skinWeight[i*4+k] = top[k][1] / sum; }
  }
  return { skinIndex, skinWeight };
}

// Blend each vertex's weights with its neighbours' a few times. Where the
// region test puts two vertices of one triangle on different body parts
// (armpits, elbows tucked against a vest), the triangle would otherwise be
// stretched into a long flap the moment the arm moves. Vertices sharing a
// position (UV seams) are treated as one, so seams do not tear either.
function _bdSmooth(D, NB, P, index, iters){
  const n = P.length / 3;
  if(!index) return;
  const I = index.array || index;
  // weld by position
  const id = new Int32Array(n), map = new Map(); let u = 0;
  for(let i = 0; i < n; i++){
    const k = Math.round(P[i*3] * 2e4) + ',' + Math.round(P[i*3+1] * 2e4) + ',' + Math.round(P[i*3+2] * 2e4);
    let g = map.get(k); if(g === undefined){ g = u++; map.set(k, g); } id[i] = g;
  }
  // unique-vertex weights = average of their copies
  const W = new Float32Array(u * NB), cnt = new Float32Array(u);
  for(let i = 0; i < n; i++){ const g = id[i]; cnt[g]++; for(let b = 0; b < NB; b++) W[g * NB + b] += D[i * NB + b]; }
  for(let g = 0; g < u; g++) for(let b = 0; b < NB; b++) W[g * NB + b] /= cnt[g];
  // edge list (each triangle edge once per triangle; duplicates just weigh more)
  const T = I.length / 3, ea = new Int32Array(T * 3), eb = new Int32Array(T * 3);
  for(let t = 0; t < T; t++){
    const a = id[I[t*3]], b = id[I[t*3+1]], c = id[I[t*3+2]];
    ea[t*3] = a; eb[t*3] = b; ea[t*3+1] = b; eb[t*3+1] = c; ea[t*3+2] = c; eb[t*3+2] = a;
  }
  const acc = new Float32Array(u * NB), deg = new Float32Array(u);
  for(let it = 0; it < iters; it++){
    acc.fill(0); deg.fill(0);
    for(let e = 0; e < ea.length; e++){
      const a = ea[e], b = eb[e]; deg[a]++; deg[b]++;
      const oa = a * NB, ob = b * NB;
      for(let k = 0; k < NB; k++){ acc[oa + k] += W[ob + k]; acc[ob + k] += W[oa + k]; }
    }
    for(let g = 0; g < u; g++){
      if(!deg[g]) continue;
      const o = g * NB, inv = 1 / deg[g];
      for(let k = 0; k < NB; k++) W[o + k] = 0.5 * W[o + k] + 0.5 * acc[o + k] * inv;
    }
  }
  for(let i = 0; i < n; i++){ const o = id[i] * NB, d = i * NB; for(let b = 0; b < NB; b++) D[d + b] = W[o + b]; }
}

// The hand as it really is in the mesh: the centre of the vertices that the
// hand bone moves, and the plane they lie in (the palm). The hand bone's own
// position is a joint estimate; placing the hand by these instead means the
// middle of the palm, not the wrist, lands on the grip.
function _bdMeasureHands(P, J, SI, SW){
  const V = (i, o) => o.set(P[i*3], P[i*3+1], P[i*3+2]);
  const conf = {};
  for(const side of ['L', 'R']){
    const hb = _BD_IDX['hand' + side], fb = _BD_IDX['fingers' + side], idx = [];
    for(let i = 0; i < SI.length / 4; i++) if((SI[i*4] === hb || SI[i*4] === fb) && SW[i*4] > 0.6) idx.push(i);
    if(idx.length < 40) continue;
    const p = new THREE.Vector3(), E = new THREE.Vector3(...J['foreArm' + side]);
    // wrist: the end of the hand nearest the elbow
    const byE = idx.map(i => [i, V(i, p).distanceTo(E)]).sort((x, y) => x[1] - y[1]);
    const W = new THREE.Vector3(); const nw = Math.max(6, byE.length * 0.08 | 0);
    for(let k = 0; k < nw; k++) W.add(V(byE[k][0], p)); W.divideScalar(nw);
    // fingertip: the hand point farthest from the wrist
    let T = null, far = -1; for(const i of idx){ const d = V(i, p).distanceTo(W); if(d > far){ far = d; T = p.clone(); } }
    const Lh = far, a = T.clone().sub(W).normalize();
    // palm normal: the direction, square to the fingers, in which the finger
    // part of the hand is thinnest
    const e1 = new THREE.Vector3(0, 1, 0); if(Math.abs(e1.dot(a)) > 0.9) e1.set(1, 0, 0);
    e1.addScaledVector(a, -e1.dot(a)).normalize(); const e2 = a.clone().cross(e1);
    const fin = idx.filter(i => { const t = V(i, p).sub(W).dot(a); return t > 0.6 * Lh && t < 0.95 * Lh; });
    let n = e1.clone(), best = 1e9;
    for(let k = 0; k < 36; k++){
      const th = k / 36 * Math.PI, c = new THREE.Vector3().addScaledVector(e1, Math.cos(th)).addScaledVector(e2, Math.sin(th));
      let s1 = 0, s2 = 0; for(const i of fin){ const d = V(i, p).sub(W).dot(c); s1 += d; s2 += d * d; }
      const varc = s2 / fin.length - (s1 / fin.length) ** 2;
      if(varc < best){ best = varc; n = c; }
    }
    // which way the palm faces: the thumb sits on the a x n side of a right
    // hand whose palm faces n, and on the other side of a left hand
    const side3 = a.clone().cross(n); let pos = 0, neg = 0;
    for(const i of idx){ V(i, p).sub(W); const t = p.dot(a); if(t < 0.05 * Lh || t > 0.55 * Lh) continue; const d = p.dot(side3); pos = Math.max(pos, d); neg = Math.max(neg, -d); }
    const thumbPos = pos > neg;
    if((side === 'R') !== thumbPos) n.negate();
    conf[side] = Math.abs(pos - neg) / Math.max(1e-6, pos, neg);
    // hand centre, and the knuckles a little under halfway out
    const C = new THREE.Vector3(); for(const i of idx) C.add(V(i, p)); C.divideScalar(idx.length);
    const tK = 0.45 * Lh, K = new THREE.Vector3(); let nk = 0;
    for(const i of idx){ V(i, p); const t = p.clone().sub(W).dot(a); if(Math.abs(t - tK) < 0.012 * 1){ K.add(p); nk++; } }
    if(nk) K.divideScalar(nk); else K.copy(W).addScaledVector(a, tK);
    // re-split the hand and finger weights along the hand's real axis
    for(let i = 0; i < SI.length / 4; i++){
      let w = 0; const slots = [];
      for(let k = 0; k < 4; k++){ const bi = SI[i*4+k]; if(SW[i*4+k] > 0 && (bi === hb || bi === fb)){ w += SW[i*4+k]; slots.push(k); } }
      if(!slots.length) continue;
      const f = _bdSS(tK - 0.01, tK + 0.02, V(i, p).sub(W).dot(a));
      for(const k of slots) SW[i*4+k] = 0;
      SI[i*4+slots[0]] = hb; SW[i*4+slots[0]] = w * (1 - f);
      let k2 = slots[1];
      if(k2 === undefined){ for(let k = 0; k < 4; k++) if(SW[i*4+k] === 0 && k !== slots[0]){ k2 = k; break; } }
      if(k2 === undefined){ SW[i*4+slots[0]] = w; SI[i*4+slots[0]] = f > 0.5 ? fb : hb; continue; }
      SI[i*4+k2] = fb; SW[i*4+k2] = w * f;
    }
    J['hand' + side]    = W.toArray();
    J['tip' + side]     = T.toArray();
    J['fingers' + side] = K.toArray();
    J['handC' + side]   = C.toArray();
    J['fing' + side]    = a.toArray();
    J['palm' + side]    = n.toArray();
  }
  // The two hands are mirror images, so their palms must face mirror-image
  // ways. If they disagree, the hand whose thumb stood out more clearly wins.
  if(J.palmL && J.palmR){
    const l = J.palmL, r = J.palmR;
    if(-l[0] * r[0] + l[1] * r[1] + l[2] * r[2] < 0){
      const fix = (conf.L || 0) > (conf.R || 0) ? 'R' : 'L';
      J['palm' + fix] = J['palm' + fix].map(x => -x);
    }
  }
}

// Meshy hands often come with the fingers fanned out and the thumb stuck out
// sideways. A single finger bone can curl them but not close them, so close
// them here, in the rest pose: squeeze the fingers sideways towards the middle
// finger, and fold the thumb in against the side of the palm.
const BD_FINGER_CLOSE = 0.45, BD_THUMB_CLOSE = 0.55;
function _bdCloseFingers(P, J, SI, SW){
  if(!J.fingL || !J.palmL) return;
  for(const side of ['L', 'R']){
    const K = new THREE.Vector3(...J['fingers' + side]), W = new THREE.Vector3(...J['hand' + side]);
    const a = new THREE.Vector3(...J['fing' + side]), n = new THREE.Vector3(...J['palm' + side]);
    const lat = a.clone().cross(n).normalize();
    const fb = _BD_IDX['fingers' + side], hb = _BD_IDX['hand' + side];
    const hl = K.distanceTo(W);
    const v = new THREE.Vector3();
    for(let i = 0; i < SI.length / 4; i++){
      let wf = 0, wh = 0;
      for(let k = 0; k < 4; k++){ if(SI[i*4+k] === fb) wf += SW[i*4+k]; else if(SI[i*4+k] === hb) wh += SW[i*4+k]; }
      if(wf + wh < 0.3) continue;
      v.set(P[i*3], P[i*3+1], P[i*3+2]);
      const rel = v.clone().sub(K), d = rel.dot(lat), along = v.clone().sub(W).dot(a);
      // fingers: pull towards the middle line, more towards the tips
      let pull = wf * BD_FINGER_CLOSE * Math.min(1, Math.max(0, along / hl - 0.6));
      // thumb: the part of the hand that sticks out sideways near the wrist
      const thumb = wh * Math.max(0, Math.abs(d) - 0.035) / Math.max(1e-3, Math.abs(d));
      v.addScaledVector(lat, -d * pull);
      if(thumb > 0){
        const off = (Math.abs(d) - 0.035) * Math.sign(d);
        v.addScaledVector(lat, -off * BD_THUMB_CLOSE * wh).addScaledVector(n, Math.abs(off) * 0.4 * wh);
      }
      P[i*3] = v.x; P[i*3+1] = v.y; P[i*3+2] = v.z;
    }
  }
}

// Read a .skin file (made by the Blender rig script): joints + 4 weights per
// vertex. Returns null if it does not belong to this mesh.
function _bdReadSkin(buf, nVerts){
  try {
    const dv = new DataView(buf);
    if(String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'TCSK') return null;
    const n = dv.getUint32(4, true), nb = dv.getUint32(8, true), jl = dv.getUint32(12, true);
    if(n !== nVerts){ console.warn('bodies: skin file is for a different mesh (' + n + ' vs ' + nVerts + ' verts)'); return null; }
    const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 16, jl)));
    let o = 16 + jl; o += (4 - o % 4) % 4;
    const idx = new Uint8Array(buf, o, n * 4), w = new Uint8Array(buf, o + n * 4, n * 4);
    // the file's bone order -> this file's _BD_BONES order
    const map = meta.bones.map(b => _BD_IDX[b]);
    if(map.some(x => x === undefined)) return null;
    const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4);
    for(let i = 0; i < n * 4; i++){ skinIndex[i] = map[idx[i]]; skinWeight[i] = w[i] / 255; }
    return { J: meta.J, skinIndex, skinWeight };
  } catch(e){ console.warn('bodies: bad skin file', e); return null; }
}

// Build the rigged template from a loaded glTF scene.
function _bdBuildTemplate(scene, skin){
  let src = null;
  scene.updateMatrixWorld(true);
  scene.traverse(o => { if(o.isMesh && !src) src = o; });
  if(!src) return null;
  const geo = src.geometry.clone();
  // optimised GLBs often pack position/normal/uv into one interleaved buffer;
  // unpack them so every attribute's .array holds only its own values
  for(const k of Object.keys(geo.attributes)){
    const a = geo.attributes[k];
    if(a.isInterleavedBufferAttribute) geo.setAttribute(k, a.clone());
  }
  geo.applyMatrix4(src.matrixWorld);
  geo.rotateY(Math.PI);                       // models face +Z; players face -Z
  geo.computeBoundingBox();
  const bb = geo.boundingBox, s = BODY_H / (bb.max.y - bb.min.y);
  geo.translate(0, -bb.min.y, 0); geo.scale(s, s, s);
  // centre on the pelvis rather than the bounding box (arms are not symmetric)
  { const P = geo.attributes.position.array; let sx = 0, sz = 0, c = 0;
    for(let i = 0; i < P.length; i += 3){ const y = P[i+1]; if(y > 0.44 * BODY_H && y < 0.56 * BODY_H){ sx += P[i]; sz += P[i+2]; c++; } }
    let cx = c ? sx / c : 0;
    // sideways, centre between the two feet: pouches and holsters on one hip
    // pull the pelvis average off-centre, the feet never lie
    const fx = []; for(let i = 0; i < P.length; i += 3) if(P[i+1] < 0.06 * BODY_H) fx.push(P[i]);
    if(fx.length > 20){
      let split = fx.reduce((a, b) => a + b, 0) / fx.length;
      for(let it = 0; it < 6; it++){
        const l = fx.filter(x => x < split), r = fx.filter(x => x >= split);
        if(!l.length || !r.length) break;
        split = (_bdMed(l) + _bdMed(r)) / 2;
      }
      cx = split;
    }
    if(c) geo.translate(-cx, 0, -sz / c); }

  const P = geo.attributes.position.array;
  let J, skinIndex, skinWeight;
  const sk = skin && _bdReadSkin(skin, P.length / 3);
  if(sk){
    // weights made offline in Blender (heat diffusion, the method proper rigs
    // use) for exactly this mesh, along with the joints they were made for
    J = sk.J; skinIndex = sk.skinIndex; skinWeight = sk.skinWeight;
    console.log('bodies: using Blender skin weights');
  } else {
    J = _bdLandmarks(P);
    ({ skinIndex, skinWeight } = _bdWeights(P, J, geo.index));
    _bdMeasureHands(P, J, skinIndex, skinWeight);
  }
  geo.setAttribute('skinIndex',  new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  _bdCloseFingers(P, J, skinIndex, skinWeight);
  geo.attributes.position.needsUpdate = true;

  // bones: bind pose has identity rotations, so a bone's rest direction is
  // simply the vector to its child joint
  const bones = [];
  for(const [name, parent] of _BD_BONES){
    const b = new THREE.Bone(); b.name = name;
    // joints a rig has no data for (finger segments when rigged in code) sit
    // on their parent and simply carry no weight
    if(!J[name]) J[name] = (parent && J[parent]) ? J[parent].slice() : [0, 0, 0];
    const p = J[name], pp = parent ? J[parent] : [0, 0, 0];
    b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
    if(parent) bones[_BD_IDX[parent]].add(b);
    bones.push(b);
  }
  const mat = src.material;
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.name = 'playerBody';
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.frustumCulled = false;                 // a0-loop culls whole players itself
  const root = new THREE.Group(); root.name = 'bodyRoot'; root.add(mesh);
  root.userData.joints = J;
  return root;
}

// Per weapon class, how far (body units: x right, y up, z back) to move the
// weapon from where g0-carry puts it for the box soldier.
const BD_GUN_SHIFT = {
  rifles:  [-0.09, -0.04, -0.14],
  snipers: [-0.11, -0.03, -0.18],
  smgs:    [-0.08, -0.04, -0.04],
  pistols: [0, 0, 0],
  melee:   [0, 0, 0],
  _:       [0, 0, 0],
};
const _bdShA = new THREE.Vector3(), _bdShB = new THREE.Vector3();
const BD_GRIP_FWD = 0.07;   // trigger hand at least this far in front of the shoulder
// Pistol stance (isosceles): how far out the pistol is held, as a fraction
// of this model's arm reach, and how far below the carry pose's height.
const BD_PISTOL = { reach: 0.93, drop: 0.09 };
const _bdShift = new THREE.Vector3(), _bdCq = new THREE.Quaternion(), _bdCp = new THREE.Vector3(), _bdJC = new THREE.Vector3();
// How the aim pitch is shared out (fractions of the look angle). Chest and
// spine together tilt the shoulders, arms and weapon; `arms` swings the weapon
// further about the shoulders; neck and head finish the look.
const BD_AIM = { spine: 0.28, chest: 0.34, arms: 0.38, neck: 0.12, head: 0.16,
                 spineDown: 0.40, chestDown: 0.42, armsDown: 0.18,
                 pSpineDown: 0.12, pChestDown: 0.14, pArmsDown: 0.74 };   // pistol, looking down

// ── 2. ANIMATION ────────────────────────────────────────────────────────────

const _bdQ = new THREE.Quaternion(), _bdQ2 = new THREE.Quaternion(), _bdQ3 = new THREE.Quaternion(), _bdQG = new THREE.Quaternion();
const _bdPocket = new THREE.Vector3(), _bdPocket2 = new THREE.Vector3();
const _bdM = new THREE.Matrix4(), _bdM2 = new THREE.Matrix4();
const _bdA = _bdV(), _bdB = _bdV(), _bdC = _bdV(), _bdD = _bdV(), _bdE = _bdV(), _bdF = _bdV();
const _bdX = new THREE.Vector3(1, 0, 0), _bdY = new THREE.Vector3(0, 1, 0), _bdZ = new THREE.Vector3(0, 0, 1);

// Per-instance data computed once at attach: rest directions and lengths.
function _bdPrepare(root){
  const mesh = root.children[0], J = root.userData.joints;
  const B = {}; for(const b of mesh.skeleton.bones) B[b.name] = b;
  const P = n => new THREE.Vector3(...J[n]);
  const limb = (a, b, c, pole) => ({
    a: B[a], b: B[b], c: B[c],
    la: P(b).distanceTo(P(a)), lb: P(c).distanceTo(P(b)),
    restA: P(b).sub(P(a)).normalize(), restB: P(c).sub(P(b)).normalize(),
    // the hand's own rest direction, wrist -> fingertips (arms only)
    // hands only: measured finger direction, palm normal, and the offset
    // from the hand bone to the middle of the hand
    restC: J['fing' + c.slice(-1)] && c.startsWith('hand') ? new THREE.Vector3(...J['fing' + c.slice(-1)]) : null,
    palm: J['palm' + c.slice(-1)] && c.startsWith('hand') ? new THREE.Vector3(...J['palm' + c.slice(-1)]) : null,
    handOff: J['handC' + c.slice(-1)] && c.startsWith('hand') ? new THREE.Vector3(...J['handC' + c.slice(-1)]).sub(P(c)) : null,
    fingers: c.startsWith('hand') ? B['fingers' + c.slice(-1)] : null,
    fingers2: c.startsWith('hand') ? B['fingers2' + c.slice(-1)] : null,
    fingers3: c.startsWith('hand') ? B['fingers3' + c.slice(-1)] : null,
    aRest: c.startsWith('hand') ? B[a].position.clone() : null,
    curlAxis: J['fing' + c.slice(-1)] && c.startsWith('hand')
      ? new THREE.Vector3(...J['fing' + c.slice(-1)]).cross(new THREE.Vector3(...J['palm' + c.slice(-1)])).normalize() : null,
    pole,
  });
  return {
    B, root, mesh, J,
    armL: limb('upperArmL', 'foreArmL', 'handL', new THREE.Vector3(0, 0, 1)),     // elbows point back at rest
    armR: limb('upperArmR', 'foreArmR', 'handR', new THREE.Vector3(0, 0, 1)),
    legL: limb('thighL', 'shinL', 'footL', new THREE.Vector3(0, 0, -1)),
    legR: limb('thighR', 'shinR', 'footR', new THREE.Vector3(0, 0, -1)),
    hipsRest: B.hips.position.clone(),
    phase: Math.random() * 6.28, speed: 0, move: 0, dir: new THREE.Vector3(0, 0, -1),
    last: null, lastT: 0, deathT: 0, deathTwist: 0,
  };
}

// World (body-space) quaternion of a bone's parent chain, without touching
// matrixWorld: bones here only ever rotate, and the body root is identity.
function _bdBodyQuat(bone, out){
  out.identity();
  const chain = [];
  for(let o = bone; o && o.isBone; o = o.parent) chain.push(o);
  for(let i = chain.length - 1; i >= 0; i--) out.multiply(chain[i].quaternion);
  return out;
}
function _bdBodyPos(bone, out){
  // position of the bone's origin in body space
  const chain = [];
  for(let o = bone; o && o.isBone; o = o.parent) chain.push(o);
  out.set(0, 0, 0); _bdQ3.identity();
  for(let i = chain.length - 1; i >= 0; i--){
    _bdF.copy(chain[i].position).applyQuaternion(_bdQ3);
    out.add(_bdF);
    _bdQ3.multiply(chain[i].quaternion);
  }
  return out;
}

// Orientation that maps (restDir, restSide) onto (dir, side).
const _bdBasisA = new THREE.Matrix4(), _bdBasisB = new THREE.Matrix4();
function _bdAim(restDir, restPole, dir, pole, out){
  const z1 = _bdA.copy(restDir).normalize();
  const x1 = _bdB.copy(restPole).addScaledVector(z1, -restPole.dot(z1)).normalize();
  const y1 = _bdC.crossVectors(z1, x1);
  _bdBasisA.makeBasis(x1, y1, z1);
  const z2 = _bdD.copy(dir).normalize();
  const x2 = _bdE.copy(pole).addScaledVector(z2, -pole.dot(z2));
  if(x2.lengthSq() < 1e-6) x2.copy(x1); x2.normalize();
  const y2 = _bdF.crossVectors(z2, x2);
  _bdBasisB.makeBasis(x2, y2, z2);
  out.setFromRotationMatrix(_bdBasisB.multiply(_bdBasisA.transpose()));
  return out;
}

// Two-bone IK in body space. `target` is where the end joint should go,
// `pole` the direction the middle joint should point.
const _bdkS = _bdV(), _bdkT = _bdV(), _bdkE = _bdV(), _bdkD = _bdV(), _bdkP = _bdV(), _bdkPq = new THREE.Quaternion();
const _bdkU = new THREE.Quaternion(), _bdkL = new THREE.Quaternion(), _bdkV1 = _bdV(), _bdkV2 = _bdV();
function _bdIK(L, target, pole){
  const a = L.la, b = L.lb;
  _bdBodyPos(L.a, _bdkS);
  _bdkD.copy(target).sub(_bdkS);
  let d = _bdkD.length();
  d = Math.max(Math.abs(a - b) + 1e-3, Math.min(a + b - 1e-3, d));
  _bdkD.normalize();
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  _bdkP.copy(pole).addScaledVector(_bdkD, -pole.dot(_bdkD));
  if(_bdkP.lengthSq() < 1e-6) _bdkP.set(0, 0, 1); _bdkP.normalize();
  _bdkE.copy(_bdkS).addScaledVector(_bdkD, a * cosA).addScaledVector(_bdkP, a * sinA);
  _bdkT.copy(_bdkS).addScaledVector(_bdkD, d);

  // upper bone: body-space orientation, then into the parent's frame
  const restPole = L.pole;
  const qUpperBody = _bdAim(L.restA, restPole, _bdkV1.copy(_bdkE).sub(_bdkS), _bdkP, _bdkU);
  _bdBodyQuat(L.a.parent, _bdkPq);
  L.a.quaternion.copy(_bdkPq.invert().multiply(qUpperBody));
  // lower bone
  const qLowerBody = _bdAim(L.restB, restPole, _bdkV2.copy(_bdkT).sub(_bdkE), _bdkP, _bdkL);
  L.b.quaternion.copy(qUpperBody.invert().multiply(qLowerBody));
}

// Keep a bone's body-space orientation at `q` (feet flat, hands along forearm).
function _bdSetBodyQuat(bone, q){
  _bdBodyQuat(bone.parent, _bdQ2);
  bone.quaternion.copy(_bdQ2.invert().multiply(q));
}

const _bdPitchQ = new THREE.Quaternion(), _bdEu = new THREE.Euler();
const _bdTgtR = _bdV(), _bdTgtL = _bdV(), _bdFoot = _bdV(), _bdHip = _bdV(), _bdPole = _bdV(), _bdPivot = _bdV(), _bdOff = _bdV();

function _bdAnimate(ud, st, obj, now, dt, pitch){
  const B = st.B, J = st.J;

  // ── velocity, in body space (-Z forward), from how far the body moved ──
  obj.getWorldPosition(_bdA);
  // velocity over the REAL time since the last update (dt is capped for the
  // animation, and dividing by it on a slow frame would overstate the speed)
  const rdt = st.lastT ? (now - st.lastT) / 1000 : dt;
  st.lastT = now;
  if(st.last && rdt > 0 && rdt < 0.5){
    const vx = (_bdA.x - st.last.x) / rdt, vz = (_bdA.z - st.last.z) / rdt;
    const yaw = obj.rotation.y;
    const c = Math.cos(-yaw), s = Math.sin(-yaw);
    const lx = vx * c + vz * s, lz = -vx * s + vz * c;     // rotate into the body
    const sc = (ud.rigBody && ud.rigBody.scale.x) || 1;
    const sp = Math.hypot(lx, lz) / sc;                     // rig units per second
    // a teleport (respawn) is not a stride
    if(sp < 12){
      st.speed += (sp - st.speed) * Math.min(1, dt * 10);
      if(sp > 0.05) st.dir.set(lx, 0, lz).normalize();
    }
  } else { st.last = new THREE.Vector3(); }
  st.last.copy(_bdA);
  const moving = st.speed > 0.35;
  st.move += ((moving ? 1 : 0) - st.move) * Math.min(1, dt * 8);
  const m = st.move;

  // Gait: cadence (cycles per second) rises with speed, the rest of the speed
  // goes into a longer step. Players run at ~4-5 rig units/s; a walk-speed
  // jog gets shorter, slower steps.
  const run = Math.min(1, st.speed / 4.5);
  const freq = st.speed > 0.05 ? 0.95 + 0.8 * run : 0;          // cycles/s
  st.phase += freq * dt * Math.PI * 2;
  st.run = (st.run || 0) + (run * m - (st.run || 0)) * Math.min(1, dt * 6);

  // ── death ──
  const dead = !!(ud.isRemote && ud.netDead);
  if(dead && !st.deathT){ st.deathT = now; st.deathTwist = (Math.random() - 0.5) * 0.6; }
  if(!dead && st.deathT){ st.deathT = 0; st.root.quaternion.identity(); st.root.position.set(0, 0, 0); ud._hideDead = false; if(ud._tpGun) ud._tpGun.visible = true; }
  if(st.deathT){
    // Crumple: the knees give, the body drops, then topples back with the
    // arms limp, the legs sliding out straight and the head rolling.
    const t = (now - st.deathT) / 1000;
    const buckle = _bdSS(0, 0.32, t), fall = _bdSS(0.12, 0.85, t), g = fall * fall * (3 - 2 * fall);
    if(ud._tpGun) ud._tpGun.visible = false;
    const tw = st.deathTwist;
    // body-space pose first
    const drop = 0.30 * buckle * (1 - 0.35 * g);
    B.hips.position.set(st.hipsRest.x, st.hipsRest.y - drop, st.hipsRest.z + 0.06 * buckle);
    B.hips.quaternion.identity();
    B.spine.quaternion.setFromAxisAngle(_bdX, -0.32 * buckle * (1 - g) + 0.10 * g);
    B.chest.quaternion.setFromAxisAngle(_bdX, -0.18 * buckle * (1 - g) + 0.06 * g);
    B.neck.quaternion.setFromAxisAngle(_bdX, 0.15 * g);
    B.head.quaternion.setFromAxisAngle(_bdX, 0.25 * g).multiply(_bdQ2.setFromAxisAngle(_bdY, tw * 1.2 * g));
    for(const [side, sg] of [['L', -1], ['R', 1]]){
      const L = side === 'L' ? st.legL : st.legR, fj = J['foot' + side];
      // feet stay planted while the knees give, then the legs straighten out
      _bdFoot.set(fj[0] + sg * 0.06 * g, fj[1] - drop * (1 - g) * 0.0, fj[2] - 0.10 * buckle * (1 - g));
      if(g > 0) _bdFoot.lerp(_bdHip.set(fj[0] + sg * 0.08, fj[1] - drop, fj[2] - 0.02), g);
      _bdIK(L, _bdFoot, _bdPole.set(sg * 0.15, 0, -1));
      _bdSetBodyQuat(L.c, _bdQ.setFromAxisAngle(_bdX, 0.5 * g));
      // arms go limp and flop out to the side as the body lands
      const A = side === 'L' ? st.armL : st.armR;
      if(A.aRest) A.a.position.copy(A.aRest);
      _bdBodyPos(A.a, _bdHip);
      _bdFoot.copy(_bdHip).add(_bdOff.set(sg * (0.08 + 0.22 * g), -(A.la + A.lb) * (0.92 - 0.25 * g), 0.05 + 0.10 * g));
      _bdIK(A, _bdFoot, _bdPole.set(sg * 0.3, 0, 1));
      _bdSetBodyQuat(A.c, _bdBodyQuat(A.b, _bdQ));
      _bdCurl(A, 0.6);
    }
    // then tip the whole body back about the (dropped) hips, and lower it so
    // it ends lying on the ground
    const hy = st.hipsRest.y - drop;
    _bdQ.setFromEuler(_bdEu.set(1.48 * g, tw * 0.8 * g, tw * 0.5 * g));
    st.root.quaternion.copy(_bdQ);
    _bdOff.set(0, hy, 0);
    st.root.position.copy(_bdOff).sub(_bdA.copy(_bdOff).applyQuaternion(_bdQ));
    // rest on whatever part is lowest (soles, then seat, then back and head),
    // so it never floats or sinks into the floor on the way down
    let lift = -1e9;
    for(const [bn, r] of [['footL', 0.09], ['footR', 0.09], ['hips', 0.12], ['chest', 0.13], ['head', 0.10], ['handL', 0.04], ['handR', 0.04]]){
      _bdBodyPos(B[bn], _bdA).applyQuaternion(_bdQ);
      lift = Math.max(lift, r - _bdA.y);
    }
    st.root.position.y = lift;
    ud._hideDead = t > 2.6;
    return;
  }

  // ── hips: bob twice per stride, settle at rest ──
  // lowest just after each foot lands, highest mid-flight; a touch lower the
  // faster you go, so the support leg keeps a slight, not a deep, bend
  const R = st.run;
  const bob = m * (0.008 + 0.018 * R) * (0.5 - 0.5 * Math.cos(st.phase * 2 * Math.PI / Math.PI - 0.6));
  B.hips.position.set(st.hipsRest.x, st.hipsRest.y - m * (0.008 + 0.014 * R) + bob - (0.008 + 0.018 * R) * m, st.hipsRest.z);
  // pelvis turns with the forward leg and dips on the swing side
  _bdQ.setFromAxisAngle(_bdY, Math.sin(st.phase) * (0.05 + 0.05 * R) * m);
  B.hips.quaternion.copy(_bdQ).multiply(_bdQ2.setFromAxisAngle(_bdZ, Math.cos(st.phase) * 0.035 * m));

  // ── spine / head: aim pitch, breathing ──
  const p = Math.max(-1.2, Math.min(1.2, pitch || 0));
  const breathe = Math.sin(now * 0.0017) * 0.018 * (1 - m);
  // aim: the upper body takes about half the pitch (shoulders, arms and gun
  // ride along with it), the arms the rest, the neck and head the remainder
  // looking down bends mostly at the waist, so the arms keep the same hold
  // they have when level (folding them up against the chest looks broken)
  // pistols are held out at arm's length, so looking down tips the arms down
  // rather than bending at the waist (which would fold the gun into the belly)
  const pis = !!(ud._tpStyle && ud._tpStyle === CARRY.pistols);
  const dn = p < 0 && !pis;
  const pdn = pis && p < 0;
  B.spine.quaternion.setFromAxisAngle(_bdX, p * (dn ? BD_AIM.spineDown : pdn ? BD_AIM.pSpineDown : BD_AIM.spine) - (0.03 + 0.09 * st.run) * m * Math.max(0, -st.dir.z));
  // counter-rotate the chest against the pelvis so the shoulders stay square to the aim
  B.spine.quaternion.multiply(_bdQ2.setFromAxisAngle(_bdY, -Math.sin(st.phase) * (0.05 + 0.05 * st.run) * m));
  B.chest.quaternion.setFromAxisAngle(_bdX, p * (dn ? BD_AIM.chestDown : pdn ? BD_AIM.pChestDown : BD_AIM.chest) + breathe);
  B.neck.quaternion.setFromAxisAngle(_bdX, p * BD_AIM.neck);
  B.head.quaternion.setFromAxisAngle(_bdX, p * BD_AIM.head);
  // Long guns: a shooter's stance. The torso turns so the off shoulder comes
  // forward to the handguard; the head turns back so the eyes stay on target,
  // and (in the arms below) the weapon keeps pointing straight ahead.
  const longGun = !!(ud._tpSupport && ud._tpStyle && ud._tpStyle !== CARRY.pistols);
  st.tw = (st.tw || 0) + ((longGun ? BD_SUP.twist : 0) - (st.tw || 0)) * Math.min(1, dt * 8);
  B.spine.quaternion.premultiply(_bdQ2.setFromAxisAngle(_bdY, st.tw));
  B.neck.quaternion.premultiply(_bdQ2.setFromAxisAngle(_bdY, -st.tw * 0.55));
  B.head.quaternion.premultiply(_bdQ2.setFromAxisAngle(_bdY, -st.tw * 0.45));

  // ── legs ──
  // Each foot spends `duty` of the cycle planted, sliding back under the body
  // at exactly the body's speed (so it does not skate), then swings forward
  // through the air to land ahead again. Heel strikes, toe pushes off.
  const duty = 0.62 - 0.2 * R;                                    // walk 62% -> run 42% on the ground
  const cyc = freq > 0 ? 1 / freq : 1;
  const half = Math.min(0.27, st.speed * duty * cyc * 0.5) * m;   // half the ground contact length
  const lat = Math.abs(st.dir.x);                                  // 1 = pure strafe
  for(const [side, off] of [['L', 0], ['R', 0.5]]){
    const L = side === 'L' ? st.legL : st.legR, sg = side === 'L' ? -1 : 1;
    let u = (st.phase / (Math.PI * 2) + off) % 1; if(u < 0) u += 1;
    let fwd, lift = 0, pitchF = 0;
    if(u < duty){                                                  // planted
      const k = u / duty; fwd = half * (1 - 2 * k);
      pitchF = k > 0.75 ? -(k - 0.75) * 4 * 0.45 * m : (k < 0.12 ? (0.12 - k) / 0.12 * 0.22 * m : 0);
    } else {                                                       // swinging
      const k = (u - duty) / (1 - duty), e = k * k * (3 - 2 * k);
      fwd = half * (-1 + 2 * e);
      lift = Math.sin(Math.PI * Math.min(1, k * 1.15)) * (0.07 + 0.11 * R) * m;
      pitchF = (-0.45 + 0.67 * e) * m;                             // toe down after push-off -> toe up for the heel strike
    }
    const fj = J['foot' + side];
    // Sideways: a shuffle, not a stride. The step is shorter, and each foot
    // stays on its own side of the body so the legs never cross.
    const fs = fwd * (1 - 0.45 * lat);
    _bdFoot.set(fj[0], fj[1] + lift, fj[2]).addScaledVector(st.dir, fs);
    const minX = Math.abs(fj[0]) * 0.55 + 0.02;
    if(_bdFoot.x * sg < minX) _bdFoot.x = sg * minX;
    _bdIK(L, _bdFoot, _bdPole.set(sg * 0.12, 0, -1));
    _bdSetBodyQuat(L.c, _bdQ.setFromAxisAngle(_bdX, pitchF));
  }


  // ── arms ──
  const gun = ud._tpGun, style = ud._tpStyle;
  if(gun && style){
    // tilt the weapon with the player's aim, about a point at the shoulders
    if(!gun.userData._bdBase){
      gun.userData._bdBase = { p: gun.position.clone(), q: gun.quaternion.clone() };
    }
    const base = gun.userData._bdBase;
    // These agents' arms are shorter than the box soldier the carry poses
    // were tuned on: bring long guns in towards the centre line and the body
    // so the off hand can reach the handguard with a natural bend.
    // Both sides use ONE set of poses: everything below is fitted on the
    // reference agent (CT), then moved to this agent's shoulders, so the T and
    // the CT hold, aim and carry every weapon identically.
    const RS = _bdRefRig() || st, RJ = RS.J;
    let cat = '_'; for(const k in CARRY) if(CARRY[k] === style) cat = k;
    const sh = _bdShift.fromArray(BD_GUN_SHIFT[cat] || BD_GUN_SHIFT._);
    // Pistols: bring the gun in until the firing arm keeps a soft bend at the
    // elbow. Held at the old box-soldier distance these agents' shorter arms
    // lock dead straight and the stance looks robotic.
    if(style.grip === CARRY.pistols.grip && style.support === CARRY.pistols.support){
      const A = RS.armR, Sh = _bdShA.set(RJ.upperArmR[0], RJ.upperArmR[1], RJ.upperArmR[2]);
      const want = (A.la + A.lb) * BD_PISTOL.reach + (A.handOff ? A.handOff.length() * 0.6 : 0.05);
      sh.y -= BD_PISTOL.drop;
      const rel = _bdShB.set(style.hold[0], style.hold[1] + 0.095, style.hold[2]).add(sh).sub(Sh);
      const b = 2 * rel.z, c = rel.lengthSq() - want * want, disc = b * b - 4 * c;
      if(c > 0 && disc >= 0) sh.z += Math.max(0, (-b - Math.sqrt(disc)) / 2);
    }
    // Long guns: slide the weapon back into the shoulder until this model's
    // off arm can reach the handguard with a natural bend (arm lengths differ
    // a lot between models, so this is measured, not tuned).
    if(ud._tpSupport && !(style.grip === CARRY.pistols.grip && style.support === CARRY.pistols.support)){
      // shoulders as they sit in the shooting stance (torso turned)
      const twQ = _bdQ2.setFromAxisAngle(_bdY, BD_SUP.twist), sp0 = _bdShB.set(RJ.spine[0], 0, RJ.spine[2]);
      const Sh = _bdShA.set(RJ.upperArmL[0], RJ.upperArmL[1], RJ.upperArmL[2]).sub(sp0).applyQuaternion(twQ).add(sp0);
      const ShRz = _bdW1.set(RJ.upperArmR[0], RJ.upperArmR[1], RJ.upperArmR[2]).sub(sp0).applyQuaternion(twQ).add(sp0).z;
      const A = RS.armL;
      const want = (A.la + A.lb) * BD_SUP.reach + (A.handOff ? A.handOff.length() * 0.7 : 0.06);
      const tgt = _bdShB.copy(ud._tpSupport).add(sh);
      const d = tgt.distanceTo(Sh);
      if(d > want){
        // move straight back along the body until the distance is right
        const rel = tgt.sub(Sh), a = 1, b = 2 * rel.z, c = rel.lengthSq() - want * want;
        const disc = b * b - 4 * a * c;
        let dz = disc >= 0 ? Math.max(0, (-b - Math.sqrt(disc)) / 2) : 0.2;
        // but never so far back that the trigger hand ends up beside or
        // behind the shoulder: keep the grip at least BD_GRIP_FWD in front
        const gripZ = style.hold[2] + sh.z, limit = ShRz - BD_GRIP_FWD;
        dz = Math.min(dz, Math.max(0, limit - gripZ));
        sh.z += dz;
      }
    }
    // move the reference pose onto this agent's shoulders
    sh.x += (J.upperArmR[0] - RJ.upperArmR[0]) * 0.5;
    sh.y += ((J.upperArmR[1] + J.upperArmL[1]) - (RJ.upperArmR[1] + RJ.upperArmL[1])) * 0.5;
    sh.z += ((J.upperArmR[2] + J.upperArmL[2]) - (RJ.upperArmR[2] + RJ.upperArmL[2])) * 0.5;
    // Carry the weapon (and every hand target) with the chest, then swing it
    // the rest of the way about the shoulders.
    const qC = _bdBodyQuat(B.chest, _bdCq), pC = _bdBodyPos(B.chest, _bdCp);
    _bdJC.set(J.chest[0], J.chest[1], J.chest[2]);
    const xf = v => v.sub(_bdJC).applyQuaternion(qC).add(pC);
    const pivot = xf(_bdPivot.set(0, J.upperArmR[1], J.upperArmR[2]));
    _bdPitchQ.setFromAxisAngle(_bdX, p * (p < 0 ? (style === CARRY.pistols ? BD_AIM.pArmsDown : BD_AIM.armsDown) : BD_AIM.arms));
    const qG = _bdQG.setFromAxisAngle(_bdY, -(st.tw || 0)).multiply(qC);   // the chest without the stance turn
    // The weapon rides in the right shoulder pocket: it follows that point as
    // the torso turns, but does not turn with it (it stays on target).
    const pocket = _bdPocket.set(J.upperArmR[0] * BD_SUP.pocket, J.upperArmR[1], J.upperArmR[2]);
    const pocketNow = xf(_bdPocket2.copy(pocket));
    const pt = v => v.sub(pocket).applyQuaternion(qG).add(pocketNow).sub(pivot).applyQuaternion(_bdPitchQ).add(pivot);
    pt(gun.position.copy(base.p).add(sh));
    if(_bdIsLong(style)){
      // Long guns: the butt of the stock sits in the shoulder pocket (just in
      // front of this agent's chest, inboard of the right shoulder), the
      // weapon points straight ahead, and it pivots about the pocket to aim.
      const bt = _bdButt(gun), pk = _bdPocketPoint(st);
      const pkNow = xf(_bdPocket2.copy(pk));
      _bdPitchQ.setFromAxisAngle(_bdX, p * (p < 0 ? BD_AIM.armsDown : BD_AIM.arms));
      gun.quaternion.copy(_bdPitchQ).multiply(qG).multiply(base.q);
      gun.position.copy(bt).multiply(gun.scale).applyQuaternion(gun.quaternion).negate().add(pkNow)
         .addScaledVector(_bdFwd.set(0, 0, -1).applyQuaternion(gun.quaternion), BD_SUP.clear);
    }
    gun.quaternion.copy(_bdPitchQ).multiply(qG).multiply(base.q);
    gun.updateMatrix();
    // where the firing hand closes, as a point ON the weapon (so the hand
    // stays on the grip however the body and weapon move)
    if(!gun.userData._bdGripL){
      const M0 = new THREE.Matrix4().compose(base.p, base.q, gun.scale).invert();
      gun.userData._bdGripL = new THREE.Vector3(style.hold[0], style.hold[1], style.hold[2]).applyMatrix4(M0);
    }
    // The gun's own axes in body space: forward (muzzle), up, and right.
    const gF = _bdGF.set(0, 0, -1).applyQuaternion(gun.quaternion);
    const gU = _bdGU.set(0, 1, 0).applyQuaternion(gun.quaternion);
    const gR = _bdGR.set(1, 0, 0).applyQuaternion(gun.quaternion);
    const pistol = style.grip === CARRY.pistols.grip && style.support === CARRY.pistols.support;

    // The model's hands are flat (no finger bones), so a hand is placed by its
    // PALM CENTRE: the wrist goes wherever puts the middle of the palm on the
    // grip, with the fingers laid along it and the palm against it.
    // `hold` is the bottom-rear of the grip; its middle is a little above.
    const gripC = _bdGC.copy(gun.userData._bdGripL).applyMatrix4(gun.matrix)
      .addScaledVector(gU, pistol ? 0.095 : 0.05).addScaledVector(gF, pistol ? 0.01 : 0);
    ud._bdGripC = gripC;
    // firing hand: right side of the grip, palm facing left
    _bdHd.copy(gF).multiplyScalar(pistol ? 1 : 0.8).addScaledVector(gU, pistol ? -0.3 : -0.6).normalize();
    // Pistol: slide the gun along its own axis until this agent's firing elbow
    // has exactly the bend the reference agent's has, so a bigger hand or a
    // longer forearm does not change the stance.
    if(pistol && RS !== st){
      const offR = _bdOff2.copy(gR).multiplyScalar(0.028), nrm = _bdHn.copy(gR).negate();
      const ShO = _bdBodyPos(st.armR.a, _bdShA);
      const ShR = _bdShB.copy(ShO).sub(_bdRt.set(J.upperArmR[0] - RJ.upperArmR[0], J.upperArmR[1] - RJ.upperArmR[1], J.upperArmR[2] - RJ.upperArmR[2]));
      const wR = _bdWristFor(RS.armR, gripC, _bdHd, nrm, offR, _bdW1).sub(_bdRt).sub(ShR);   // reference wrist, rel. its shoulder
      const ang = _bdElbowFor(RS.armR, wR.length());
      const want = Math.sqrt(st.armR.la ** 2 + st.armR.lb ** 2 - 2 * st.armR.la * st.armR.lb * Math.cos(ang));
      const wO = _bdWristFor(st.armR, gripC, _bdHd, nrm, offR, _bdW2).sub(ShO);
      // |wO + t*gF| = want
      const bq = 2 * wO.dot(gF), cq = wO.lengthSq() - want * want, dq = bq * bq - 4 * cq;
      if(dq >= 0){
        const t1 = (-bq + Math.sqrt(dq)) / 2, t2 = (-bq - Math.sqrt(dq)) / 2, t = Math.abs(t1) < Math.abs(t2) ? t1 : t2;
        if(Math.abs(t) < 0.15){ gripC.addScaledVector(gF, t); gun.position.addScaledVector(gF, t); }
      }
    }
    if(cat === 'melee'){
      // a fist round the handle: the handle runs across the palm, fingers
      // pointing down and curled right round it
      // the handle's real centre, measured once from the knife's own mesh
      if(!gun.userData._bdHandle){
        const loc = new THREE.Vector3(), acc = new THREE.Vector3(); let n = 0, zmin = 1e9, zmax = -1e9;
        gun.updateMatrixWorld(true);
        const inv = new THREE.Matrix4().copy(gun.matrixWorld).invert(), mm = new THREE.Matrix4();
        const pts = [];
        gun.traverse(o => { if(!o.isMesh) return; mm.multiplyMatrices(inv, o.matrixWorld); const P = o.geometry.attributes.position;
          for(let i = 0; i < P.count; i += Math.max(1, P.count / 3000 | 0)){ loc.fromBufferAttribute(P, i).applyMatrix4(mm); pts.push(loc.clone()); zmin = Math.min(zmin, loc.z); zmax = Math.max(zmax, loc.z); } });
        // the handle is the rear part (+z is the butt end)
        for(const q of pts) if(q.z > zmax - 0.32 * (zmax - zmin)){ acc.add(q); n++; }
        gun.userData._bdHandle = n ? acc.divideScalar(n) : new THREE.Vector3();
      }
      gripC.copy(gun.userData._bdHandle).multiply(gun.scale).applyQuaternion(gun.quaternion).add(gun.position);
      _bdHd.copy(gU).multiplyScalar(-0.9).addScaledVector(gF, -0.35).normalize();
      _bdPlace(st.armR, gripC, _bdHd, _bdHn.copy(gR).negate(), _bdOff2.copy(gR).multiplyScalar(0.03).addScaledVector(gU, 0.012),
               _bdPole.set(0.35, -0.9, -0.15).applyQuaternion(qC), null, 1.9);
    } else
    _bdPlace(st.armR, gripC, _bdHd, _bdHn.copy(gR).negate(), _bdOff2.copy(gR).multiplyScalar(0.028), _bdPole.set(0.35, -0.9, -0.15).applyQuaternion(qC), _bdBack.copy(gF).negate(), pistol ? 1.65 : 1.45);

    if(ud._tpSupport){
      if(pistol){
        // off hand: left side of the same grip, palm facing right, wrapping
        // over the firing hand's fingers
        _bdHd.copy(gF).addScaledVector(gU, -0.55).normalize();
        _bdPlace(st.armL, gripC, _bdHd, _bdHn.copy(gR), _bdOff2.copy(gR).multiplyScalar(-0.03).addScaledVector(gU, -0.01), _bdPole.set(-0.6, -0.7, 0.3).applyQuaternion(qC), null, 1.4);
      } else {
        // Left hand under the handguard: the palm cups it from below-left and
        // the fingers wrap up its left side towards the top. Where exactly the
        // handguard is, and how thick, is measured from this weapon's mesh.
        const hg = _bdHandguard(gun, ud._tpSupport, sh);
        gun.updateMatrix();
        _bdTgtL.copy(hg.c).applyMatrix4(gun.matrix);                     // handguard centre, body space
        ud._bdSupC = _bdTgtL;
        const nIn = _bdHn.copy(gR).multiplyScalar(BD_SUP.nR).addScaledVector(gU, BD_SUP.nU).normalize();
        const rad = Math.sqrt((hg.rx * nIn.dot(gR)) ** 2 + (hg.ry * nIn.dot(gU)) ** 2) * gun.scale.x;
        // fingers run under the handguard to its right side and curl up it
        _bdHd.copy(gR).multiplyScalar(BD_SUP.nU).addScaledVector(gU, -BD_SUP.nR).normalize()
             .multiplyScalar(1 - BD_SUP.fwd).addScaledVector(gF, BD_SUP.fwd).normalize();
        _bdPlace(st.armL, _bdTgtL, _bdHd, nIn,
                 _bdOff2.copy(nIn).multiplyScalar(-(rad + BD_SUP.palm)),
                 _bdPole.set(-0.6, -0.8, 0.15).applyQuaternion(qC), _bdBack.copy(gF).negate(), BD_SUP.curl);
      }
    } else { _bdHang(st, st.armL, 'L', m, now); _bdSetBodyQuat(st.armL.c, _bdBodyQuat(st.armL.b, _bdQ)); }
    return;
  } else {
    _bdHang(st, st.armR, 'R', m, now);
    _bdHang(st, st.armL, 'L', m, now);
  }
  _bdSetBodyQuat(st.armR.c, _bdBodyQuat(st.armR.b, _bdQ));
  _bdSetBodyQuat(st.armL.c, _bdBodyQuat(st.armL.b, _bdQ));
}

// Point a hand: fingers along `dir`, palm facing `palm` (both in body space).
// Meshy's A-pose hands are flat with the palm facing down.
const _bdGF = _bdV(), _bdGU = _bdV(), _bdGR = _bdV(), _bdHd = _bdV(), _bdHn = _bdV(), _bdRestPalm = new THREE.Vector3(0, -1, 0);
const _bdHq = new THREE.Quaternion();
function _bdHandAim(L, dir, palm){
  if(!L.restC) return;
  _bdAim(L.restC, L.palm || _bdRestPalm, dir.normalize(), palm.normalize(), _bdHq);
  _bdSetBodyQuat(L.c, _bdHq);
}

// Put a hand's palm centre at `centre + off`, fingers along `dir`, palm facing
// `palm`: solve the arm to the wrist that produces that, then turn the hand.
const _bdGC = _bdV(), _bdOff2 = _bdV(), _bdWr = _bdV();
const _bdHq2 = new THREE.Quaternion();
// Curl the fingers towards the palm by `a` radians.
// Meshy's hands come out large for the body; trim them a little.
const BD_HAND_SCALE = 0.88;
function _bdCurl(L, a){
  if(!L.fingers || !L.curlAxis) return;
  // spread over the three finger joints, like a real hand closing
  L.fingers.quaternion.setFromAxisAngle(L.curlAxis, a * 0.42);
  if(L.fingers2) L.fingers2.quaternion.setFromAxisAngle(L.curlAxis, a * 0.62);
  if(L.fingers3) L.fingers3.quaternion.setFromAxisAngle(L.curlAxis, a * 0.48);
}
function _bdPlace(L, centre, dir, palm, off, pole, slide, curl){
  _bdCurl(L, curl == null ? 1.25 : curl);
  if(!L.restC || !L.handOff){ _bdIK(L, _bdWr.copy(centre).add(off), pole); return; }
  // the hand's final orientation first, then the wrist that puts the hand's
  // centre on the target, then the arm to that wrist
  _bdAim(L.restC, L.palm, _bdHd2.copy(dir).normalize(), _bdHn2.copy(palm).normalize(), _bdHq2);
  L.c.scale.setScalar(BD_HAND_SCALE);
  _bdWr.copy(centre).add(off).sub(_bdOff3.copy(L.handOff).multiplyScalar(BD_HAND_SCALE).applyQuaternion(_bdHq2));
  // Out of reach (long guns, short arms)? Slide the hand back along `slide`
  // (towards the body, along the weapon) until the arm can get there with a
  // natural bend, rather than locking the arm straight and tearing the skin.
  // Reach further by bringing the shoulder forward (protraction), as people do
  // when they stretch for a handguard, before resorting to sliding the hand.
  if(L.aRest){
    L.a.position.copy(L.aRest);
    _bdBodyPos(L.a, _bdSh);
    const ex = _bdWr.distanceTo(_bdSh) - (L.la + L.lb) * 0.96;
    if(ex > 0){
      _bdOff4.copy(_bdWr).sub(_bdSh).normalize().multiplyScalar(Math.min(BD_SUP.protract, ex));
      _bdBodyQuat(L.a.parent, _bdTq1).invert();
      L.a.position.add(_bdOff4.applyQuaternion(_bdTq1));
    }
  }
  if(slide){
    _bdBodyPos(L.a, _bdSh);
    const reach = (L.la + L.lb) * 0.985;
    // smallest slide t >= 0 with |wrist + t*slide - shoulder| = reach; if the
    // line never comes that close, stop at its nearest point (never past it)
    const rel = _bdOff4.copy(_bdWr).sub(_bdSh);
    const b = rel.dot(slide), c = rel.lengthSq() - reach * reach;
    if(c > 0){
      const disc = b * b - c;
      let t = disc >= 0 ? -b - Math.sqrt(disc) : -b;
      t = Math.max(0, Math.min(BD_SLIDE_MAX, t));
      _bdWr.addScaledVector(slide, t);
    }
  }
  _bdIK(L, _bdWr, pole);
  // Forearm roll: a wrist only bends, the forearm does the turning. Take the
  // twist about the forearm's axis out of the hand's rotation and give it to
  // the forearm, or the skin round the wrist wrings into a ribbon.
  const qF = _bdBodyQuat(L.b, _bdTq1);                         // forearm, body space
  const rel = _bdTq2.copy(qF).invert().multiply(_bdHq2);       // hand relative to forearm
  const ax = L.restB;                                           // forearm axis (rest = local)
  const d = rel.x * ax.x + rel.y * ax.y + rel.z * ax.z;
  const tw = _bdTq3.set(ax.x * d, ax.y * d, ax.z * d, rel.w);
  if(tw.lengthSq() > 1e-8){
    tw.normalize();
    // most of the roll in the forearm, a little left at the wrist
    const twF = _bdTq4.identity().slerp(tw, 0.85);
    L.b.quaternion.multiply(twF);
  }
  _bdSetBodyQuat(L.c, _bdHq2);
}
const _bdTq1 = new THREE.Quaternion(), _bdTq2 = new THREE.Quaternion(), _bdTq3 = new THREE.Quaternion(), _bdTq4 = new THREE.Quaternion();
const _bdHd2 = _bdV(), _bdHn2 = _bdV(), _bdOff3 = _bdV(), _bdOff4 = _bdV(), _bdSh = _bdV(), _bdBack = _bdV();

const _bdFwd = new THREE.Vector3();
function _bdIsLong(style){ return style === CARRY.rifles || style === CARRY.snipers || style === CARRY.smgs; }
// Rear end of the weapon's stock, in the weapon's own space (measured once).
const _bdButtCache = new Map();
function _bdButt(gun){
  let key = null; gun.traverse(o => { if(!key && o.isMesh) key = o.geometry.uuid; });
  if(_bdButtCache.has(key)) return _bdButtCache.get(key);
  const pts = [], v = new THREE.Vector3(), mm = new THREE.Matrix4();
  gun.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(gun.matrixWorld).invert();
  gun.traverse(o => { if(!o.isMesh || !o.geometry.attributes.position) return;
    mm.multiplyMatrices(inv, o.matrixWorld); const P = o.geometry.attributes.position;
    for(let i = 0; i < P.count; i += Math.max(1, P.count / 20000 | 0)){ v.fromBufferAttribute(P, i).applyMatrix4(mm); pts.push(v.clone()); } });
  const zmax = Math.max(...pts.map(q => q.z)), zmin = Math.min(...pts.map(q => q.z));
  const rear = pts.filter(q => q.z > zmax - (zmax - zmin) * 0.04);
  const c = new THREE.Vector3(); rear.forEach(q => c.add(q)); c.divideScalar(rear.length || 1);
  // the butt pad's centre, a hair in from the very end
  const r = new THREE.Vector3(c.x, c.y, zmax - (zmax - zmin) * 0.01);
  _bdButtCache.set(key, r);
  return r;
}
// The right shoulder pocket on this agent, in rest body space: inboard of the
// shoulder joint, a little below it, on the front surface of the chest.
function _bdPocketPoint(st){
  if(st._pocket) return st._pocket;
  const J = st.J, x = J.upperArmR[0] * BD_SUP.pocket, y = J.upperArmR[1] - 0.035;
  const P = st.mesh.geometry.attributes.position.array;
  let zf = Infinity;
  for(let i = 0; i < P.length; i += 3) if(Math.abs(P[i] - x) < 0.035 && Math.abs(P[i+1] - y) < 0.035) zf = Math.min(zf, P[i+2]);
  if(zf === Infinity) zf = J.upperArmR[2] - 0.1;
  return (st._pocket = new THREE.Vector3(x, y, zf));
}

// Support-hand grip on a long gun's handguard: palm direction (towards the
// gun's axis, in the weapon's right/up plane), how far the fingers point
// forward along the barrel, palm thickness and finger curl.
const BD_SLIDE_MAX = 0.16;   // furthest a hand may slide back along a weapon to reach it
const BD_SUP = { nR: 0.45, nU: 0.89, fwd: 0.3, palm: 0.022, curl: 2.25, twist: -0.5, reach: 0.86, pocket: 0.6, clear: -0.07, protract: 0.11 };
// The handguard where the support hand goes, measured once per weapon model
// in the weapon's own space: its centre line and half-thickness (sideways
// and vertical), ignoring thin parts like sight posts and slings.
const _bdHGCache = new Map();
function _bdHandguard(gun, supBody, sh){
  let key = null; gun.traverse(o => { if(!key && o.isMesh) key = o.geometry.uuid; });
  if(_bdHGCache.has(key)) return _bdHGCache.get(key);
  // the support point (body space, base pose) in gun space
  const base = gun.userData._bdBase;
  const M = new THREE.Matrix4().compose(base.p, base.q, gun.scale);
  const sp = supBody.clone().applyMatrix4(M.clone().invert());
  const pts = [], v = new THREE.Vector3(), mm = new THREE.Matrix4();
  gun.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(gun.matrixWorld).invert();
  gun.traverse(o => { if(!o.isMesh || !o.geometry.attributes.position) return;
    mm.multiplyMatrices(inv, o.matrixWorld); const P = o.geometry.attributes.position;
    for(let i = 0; i < P.count; i += Math.max(1, P.count / 20000 | 0)){ v.fromBufferAttribute(P, i).applyMatrix4(mm); pts.push(v.clone()); } });
  let zs = pts.map(q => q.z); const zmin = Math.min(...zs), zmax = Math.max(...zs), L = zmax - zmin;
  const pick = (z, w) => pts.filter(q => Math.abs(q.z - z) < w);
  let sl = pick(sp.z, L * 0.03); if(sl.length < 30) sl = pick(sp.z, L * 0.06);
  const pc = (arr, f) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.max(0, Math.round(f * (a.length - 1))))]; };
  let r;
  if(sl.length < 10) r = { c: sp, rx: 0.02, ry: 0.025 };
  else {
    const ys = sl.map(q => q.y), xs = sl.map(q => q.x);
    const y0 = pc(ys, 0.08), y1 = pc(ys, 0.92), x0 = pc(xs, 0.08), x1 = pc(xs, 0.92);
    r = { c: new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, sp.z), rx: (x1 - x0) / 2, ry: (y1 - y0) / 2 };
  }
  _bdHGCache.set(key, r);
  return r;
}

// Where a hand's wrist must be for its palm centre to sit at `centre + off`
// with the given finger direction and palm normal (same maths as _bdPlace).
const _bdW1 = new THREE.Vector3(), _bdW2 = new THREE.Vector3(), _bdRt = new THREE.Vector3(), _bdHq3 = new THREE.Quaternion();
function _bdWristFor(L, centre, dir, palm, off, out){
  out.copy(centre).add(off);
  if(!L.restC || !L.handOff) return out;
  _bdAim(L.restC, L.palm, _bdHd2.copy(dir).normalize(), _bdHn2.copy(palm).normalize(), _bdHq3);
  return out.sub(_bdOff3.copy(L.handOff).multiplyScalar(BD_HAND_SCALE).applyQuaternion(_bdHq3));
}
// Interior elbow angle (radians, PI = straight) for a shoulder->wrist distance.
function _bdElbowFor(L, d){
  const a = L.la, b = L.lb; d = Math.max(Math.abs(a - b) + 1e-4, Math.min(a + b - 1e-4, d));
  return Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - d * d) / (2 * a * b))));
}

// The reference agent whose proportions every pose is fitted on (see arms).
let _bdRef = null;
function _bdRefRig(){
  if(!_bdRef && _bdTpl.ct) _bdRef = _bdPrepare(_bdTpl.ct);
  return _bdRef;
}

// arm hanging at the side, swinging opposite the legs
function _bdHang(st, L, side, m, now){
  if(L.aRest) L.a.position.copy(L.aRest);
  _bdBodyPos(L.a, _bdHip);
  const sg = side === 'L' ? -1 : 1;
  const sw = Math.cos(st.phase + (side === 'L' ? Math.PI : 0)) * 0.16 * m;
  _bdFoot.copy(_bdHip).add(_bdOff.set(sg * 0.06, -(L.la + L.lb) * 0.96, -0.02 + sw));
  _bdIK(L, _bdFoot, _bdPole.set(sg * 0.2, 0, 1));
  _bdCurl(L, 0.35);                                  // relaxed hand
  if(L.c) L.c.scale.setScalar(BD_HAND_SCALE);
}

// ── 3. ATTACH ───────────────────────────────────────────────────────────────

const _bdBodies = new Set();

// Swap an operator-shaped object's box meshes for the rigged model.
function bdUpgrade(obj, team){
  const ud = obj && obj.userData;
  if(!ud || !ud.rigBody || ud._sk) return false;
  const tpl = _bdTpl[team === 'ct' ? 'ct' : 't'];
  if(!tpl) return false;
  const root = skeletonClone(tpl);
  root.userData.joints = tpl.userData.joints;
  // hide the box parts — but never the weapon, which lives on the same body
  const gun = ud._tpGun;
  ud.rigBody.traverse(o => {
    if(!o.isMesh) return;
    for(let p = o; p; p = p.parent){ if(p === gun || (p.userData && p.userData.isWeapon)) return; }
    o.visible = false;
  });
  ud.rigBody.add(root);
  ud._sk = _bdPrepare(root);
  ud._bdTeam = team === 'ct' ? 'ct' : 't';
  _bdBodies.add(obj);
  return true;
}

// Tag weapons attached by g0-carry so a later upgrade never hides them.
function _bdTagWeapons(obj){ const g = obj.userData._tpGun; if(g) g.userData.isWeapon = true; }

function _bdUpgradeAll(){
  if(typeof enemies !== 'undefined')
    for(const e of enemies) if(e.userData && !e.userData._sk) bdUpgrade(e, e.userData.team || 't');
  if(typeof _selfObj !== 'undefined' && _selfObj && !_selfObj.userData._sk)
    bdUpgrade(_selfObj, typeof _selfTeam !== 'undefined' && _selfTeam ? _selfTeam : 't');
}

// Every new body gets the model as soon as one exists.
if(typeof makeEnemy === 'function'){
  const _bdMakeEnemy = makeEnemy;
  makeEnemy = function(team){
    const g = _bdMakeEnemy(team);
    if(g.userData) g.userData.team = g.userData.team || team || 't';
    bdUpgrade(g, team || 't');
    return g;
  };
}

// load both models
(function _bdLoad(){
  if(typeof GLTFLoader === 'undefined') return;
  const loader = new GLTFLoader();
  for(const team of ['t', 'ct']){
    // the skin file is optional: without it the model is rigged in code
    const skinP = fetch(BODY_FILES[team].replace(/\.glb$/, '.skin')).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
    loader.load(BODY_FILES[team], async gltf => {
      try {
        _bdTpl[team] = _bdBuildTemplate(gltf.scene, await skinP);
        console.log('bodies: ' + team + ' model rigged');
        _bdUpgradeAll();
      } catch(err){ console.warn('bodies: could not rig ' + team + ' model, keeping the box body', err); }
    }, undefined, err => console.warn('bodies: ' + BODY_FILES[team] + ' failed to load, keeping the box body', err && err.message));
  }
})();

// ── 4. FRAME ────────────────────────────────────────────────────────────────
let _bdLastNow = 0;
(function bdFrame(){
  requestAnimationFrame(bdFrame);
  const now = performance.now();
  const dt = _bdLastNow ? Math.min(0.1, (now - _bdLastNow) / 1000) : 0.016;
  _bdLastNow = now;
  // the self body is rebuilt on a side swap; pick the new one up
  if(typeof _selfObj !== 'undefined' && _selfObj && !_selfObj.userData._sk) _bdUpgradeAll();
  for(const obj of _bdBodies){
    const ud = obj.userData;
    if(!obj.parent){ _bdBodies.delete(obj); continue; }
    // the self body belongs to whichever side you are on now
    if(ud._tpGun) _bdTagWeapons(obj);
    const isSelf = typeof _selfObj !== 'undefined' && obj === _selfObj;
    const shown = isSelf ? !!(obj.parent && obj.parent.visible) : obj.visible;
    if(!shown && !(ud.isRemote && ud.netDead)) { ud._sk.last = null; continue; }
    const pitchNow = isSelf ? (typeof pitch !== 'undefined' ? pitch : 0) : (ud.netPitch || 0);
    _bdAnimate(ud, ud._sk, isSelf ? (obj.parent || obj) : obj, now, dt, pitchNow);
  }
})();

console.log('bodies: rigging T and CT models');
