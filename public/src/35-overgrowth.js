// ════════════════════════════════════════════════════════════════════════════
//  35-overgrowth.js — OVERGROWTH, the jungle ruins map
//
//  Defines the map; builds nothing until 40-map.js calls buildOvergrowth()
//  (only when MAP_ID === 'overgrowth'). It has to run from inside 40-map
//  because it uses that file's build primitives — ground, platform, stairsZ,
//  slab — and because everything it places must exist before 40-map derives
//  the standable surfaces and 60-actors buckets the collision grid.
//
//  EVERYTHING IS MADE IN CODE. No GLB downloads: ruins, trees, statues, the
//  walls and the river are boxes, cylinders and canvas textures, so the map
//  loads instantly and costs nothing in bandwidth.
//
//  LAYOUT  (+z is south, -z is north; walls at +/-45 in design units)
//
//  DIAGONAL SPAWNS, like the palace: T in the south-west corner, CT in the
//  north-east. No block has a mirror twin, and each quarter plays its own way:
//
//     NORTH-WEST  the PLAINS: open jungle floor around the colossus (the one
//                 stone head on the map), a long ruin wall and stone blocks. Long
//                 sightlines, scattered low cover. T's side: 62u from T
//                 spawn, 79u from CT spawn.
//     SOUTH-EAST  the WARREN: packed ruin blocks, tight alleys and a roofed,
//                 torch-lit tunnel. Close range. CT's side: 61u from CT,
//                 75u from T.
//     CENTRE      MID: the tower where the diagonal routes meet, the river,
//                 the jaguar and the mid doors. T reaches its side of the
//                 tower in 50u, CT reaches its side in 55u.
//     CORNERS     the two spawns, CT's beside its temple and altar.
//
//  MEASURED before any 3D was written: every area connected, no sealed pockets,
//  no slot between 1.2 and 3 units wide (tight enough to wedge in, too tight
//  to walk), longest sightline 69u (the mid diagonal), and walking distance
//  from each spawn to every area checked for balance (lay/fair.py).
// ════════════════════════════════════════════════════════════════════════════

// ── SCALE ───────────────────────────────────────────────────────────────────
// Everything below is authored in DESIGN units (playfield +/-45, 90 across),
// which is what the layout checks measured. The map is then built 1.33x
// bigger: buildOvergrowth() builds at design size and scales the result
// uniformly, geometry, collision, walkable surfaces, lights, models and
// spawns alike, so every proportion the checks verified is preserved, just
// larger (playfield +/-60, 120 across). 40-map reads OG_SCALE for the
// player's edge clamp. Waist-high cover keeps its HEIGHT (see LOW COVER).
const OG_SCALE = 4 / 3;
window.OG_SCALE = OG_SCALE;

const OVERGROWTH = {
  // [x0, z0, x1, z1, height, kind], in design units. Asymmetric: no entry has
  // a mirror twin. Heights are for the code-built fallback; models set their own.
  solids: [
    [24, -45, 34, -37, 9, 'temple'],   // CT spawn temple, its door facing south into the courtyard
    [25, -26, 33, -23, 3.2, 'altar'],   // CT courtyard altar
    [37, -24, 42, -15, 6, 'stelae'],   // CT east stelae, screening the courtyard from the warren
    [-45, -45, -40, -36, 6, 'stelae'],   // plains: stelae in the north-west corner
    [-30, -30, -23, -23, 5.2, 'colossus'],   // plains: the colossus, the only stone head on the map
    [-40.93, -14, -36.07, -9, 4.88, 'stone'],   // plains: big stone block (og_block) where the banyan tree stood
    [-37.2, -29.2, -34.8, -26.8, 2.2, 'stone'],   // plains: stone block cover, west of the colossus
    [-33.2, -36.25, -30.8, -33.85, 2.2, 'stone'],   // plains: stone block cover, under the north wall
    [-6, -6, 4, 4, 17, 'tower'],   // mid: the tower, dead centre where the diagonal routes meet
    [8.57, 4, 13.43, 9, 4.88, 'stone'],   // mid: one big stone block (og_block at its own proportions) where the jaguar statue stood
    [-31.5, 1, -22.5, 9, 8, 'house'],   // temple-house: freestanding building
    [-9, -21.5, -1, -12.5, 8, 'house'],   // temple-house: freestanding building
    [25.5, -16.5, 33.5, -7.5, 8, 'house'],   // temple-house: freestanding building
    [22, 21.5, 30, 30.5, 8, 'house'],   // temple-house: freestanding building
    [28, 1.5, 36, 10.5, 8, 'house'],   // temple-house: freestanding building
    [-25.58, 19.65, -23.18, 22.05, 2.2, 'stone'],   // stone block, 2x a palace crate: cover
    [-15.02, -23, -12.62, -20.6, 2.2, 'stone'],   // stone block, 2x a palace crate: cover
    [-23.84, -14.56, -21.44, -12.16, 2.2, 'stone'],   // stone block, 2x a palace crate: cover
    [29.32, 15.21, 31.72, 17.61, 2.2, 'stone'],   // stone block, 2x a palace crate: cover
    [18.83, -14.21, 21.23, -11.81, 2.2, 'stone'],   // stone block, 2x a palace crate: cover
  ],
  // Long ruin blocks, each ONE model at its own proportions (never stretched):
  // [centre x, centre z, length, turn]. The turn is only ever 0, 90, 180 or
  // 270 degrees: 0/180 run east-west, 90/270 north-south (180 and 270 face
  // the other way). Length 11 or 8; depth is 0.515 of the length and height
  // 0.456 of it, the model's own shape.
  walls: [
    [39.9, 17.12, 10.2, 0],
    [39.9, 28.38, 10.2, 180],
    [17.0, -39.5, 10.2, 90],
    [-36.0, 16, 10.2, 180],
    [-42.37, 5.5, 10.2, 90],
    [-16.3, -6, 10.2, 180],
    [6.0, -28, 10.2, 90],
    [-17.0, 42.17, 10.2, 180],
    [5.0, 17.4, 10.2, 0],
    [20.0, 0, 10.2, 270],
    [13.0, 30, 10.2, 90],
    [-27.97, 37.51, 10.2, 270],
    [-16.39, 28.77, 10.2, 90],
    [-17.21, 10.51, 10.2, 270],
    [-3.58, -32.41, 10.2, 90],
    [9.86, -14.92, 10.2, 180],
    [-8.6, 14.76, 10.2, 90],
    [19.24, 15.07, 10.2, 180],
    [15.5, -25.9, 10.2, 90],
    [-29.56, -4.53, 10.2, 180],
    [12.26, -3.66, 10.2, 90],
    [3.69, 30.99, 10.2, 270],
    [-27, -42.37, 10.2, 180],   // plains: north wall, flush with the edge
  ],

  // waist-high cover [x0,z0,x1,z1]: dense on the plains, sparse in the warren
  low: [
    [-42, -26, -39, -24],
    [-40, -4, -37, -2],
    [-32, -18, -29, -16],
    [-18, -16, -15, -14],
    [-38, 24, -35, 27],
    [20, -20, 23, -17],
    [36, -10, 39, -7],
  ],
  // standing braziers [x0,z0,x1,z1], each flush against a wall
  braziers: [
    [26.5, -37, 27.6, -35.9],
    [30.4, -37, 31.5, -35.9],
    [38, 19.5, 39.1, 20.6],
    [38, 24.9, 39.1, 26],
    [-3.5, 4, -2.4, 5.1],
    [0.4, 4, 1.5, 5.1],
    [-7.5, -22.6, -6.4, -21.5],     // flanking the mid temple-house door
    [-3.6, -22.6, -2.5, -21.5],
  ],
  river:   { z0:-3, z1:1 },
  tunnel:  { x0:35.75, x1:45, z0:19.5, z1:26, y:3.9 },    // roofed corridor in the warren
  spawns: {
    t:  { x0:-44, x1:-35, z0: 35, z1: 44, yaw: -Math.PI * .25 },   // south-west corner, facing north-east (toward mid)
    ct: { x0: 35, x1: 44, z0:-35, z1:-27, yaw: Math.PI * .75 },    // north-east, facing south-west (toward mid)
  },
};
window.OVERGROWTH = OVERGROWTH;
// Collision boxes for a long ruin block [cx, cz, len, deg]: one box when it is
// square to the grid, otherwise a run of overlapping squares along its axis
// (collision is axis-aligned boxes, so a diagonal wall is stepped).
function ogWallBoxes(w){
  const [cx, cz, L, deg] = w, D = L * .515;
  if(deg % 90 === 0){
    const ew = deg % 180 === 0;
    const hw = (ew ? L : D) / 2, hd = (ew ? D : L) / 2;
    return [[cx - hw, cz - hd, cx + hw, cz + hd]];
  }
  const k = Math.max(3, Math.round(L / 1.2)), sz = D * .8, out = [];
  const ux = Math.cos(deg * Math.PI / 180), uz = Math.sin(deg * Math.PI / 180);
  for(let i = 0; i < k; i++){
    const t = -L / 2 + L * (i + .5) / k, x = cx + ux * t, z = cz + uz * t;
    out.push([x - sz / 2, z - sz / 2, x + sz / 2, z + sz / 2]);
  }
  return out;
}
window.ogWallBoxes = ogWallBoxes;


function buildOvergrowth(){
  const O = OVERGROWTH;
  const S = OG_SCALE;
  const _sc0 = scene.children.length, _ob0 = obstacles.length,
        _pl0 = platforms.length, _il0 = interiorLights.length;
  const rnd = (() => { let s = 1337; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  const R = (a, b) => a + rnd() * (b - a);

  // ── TEXTURES ──────────────────────────────────────────────────────────────
  function cv(s){ const c = document.createElement('canvas'); c.width = c.height = s; return [c, c.getContext('2d')]; }
  function tex(c, sx, sy){
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
    if(sx) t.__sx = sx; if(sy) t.__sy = sy || sx;
    return t;
  }
  function speckle(g, s, n, cols, rmin, rmax){
    for(let i = 0; i < n; i++){
      g.fillStyle = cols[(rnd() * cols.length) | 0];
      g.beginPath(); g.ellipse(rnd()*s, rnd()*s, R(rmin,rmax), R(rmin,rmax)*R(.4,1), rnd()*3, 0, 6.283); g.fill();
    }
  }

  // Big weathered stone blocks with moss creeping down from the joints.
  const stoneTex = (() => {
    const S = 512, [c, g] = cv(S);
    g.fillStyle = '#6d6a5c'; g.fillRect(0, 0, S, S);
    const rows = 4;
    for(let r = 0; r < rows; r++){
      const h = S / rows, y = r * h;
      let x = -R(0, 60);
      while(x < S){
        const w = R(90, 190);
        const v = R(-14, 14);
        g.fillStyle = `rgb(${108+v|0},${104+v|0},${88+v|0})`;
        g.fillRect(x + 3, y + 3, w - 6, h - 6);
        // wraparound copy for seamless tiling
        if(x + w > S){ g.fillRect(x - S + 3, y + 3, w - 6, h - 6); }
        // chipped edges
        g.fillStyle = 'rgba(40,38,30,.35)';
        g.fillRect(x + 3, y + h - 9, w - 6, 6);
        g.fillStyle = 'rgba(255,250,230,.08)';
        g.fillRect(x + 3, y + 3, w - 6, 4);
        x += w;
      }
    }
    speckle(g, S, 900, ['rgba(40,38,30,.18)','rgba(150,146,126,.14)','rgba(30,30,24,.12)'], 1, 5);
    // cracks
    g.strokeStyle = 'rgba(28,26,20,.45)'; g.lineWidth = 1.4;
    for(let i = 0; i < 14; i++){
      let x = rnd()*S, y = rnd()*S; g.beginPath(); g.moveTo(x, y);
      for(let k = 0; k < 5; k++){ x += R(-22,22); y += R(4,26); g.lineTo(x, y); }
      g.stroke();
    }
    // moss, heavier toward the top of each course
    for(let i = 0; i < 260; i++){
      const x = rnd()*S, y = rnd()*S;
      const a = R(.08, .3);
      g.fillStyle = `rgba(${60+R(0,30)|0},${92+R(0,40)|0},${36+R(0,20)|0},${a})`;
      g.beginPath(); g.ellipse(x, y, R(6,30), R(3,12), 0, 0, 6.283); g.fill();
    }
    return tex(c, 5, 5);
  })();

  // Same stone, far mossier — lower courses and ground-level walls.
  const mossStoneTex = (() => {
    const S = 512, [c, g] = cv(S);
    g.drawImage(stoneTex.image, 0, 0);
    const gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, 'rgba(58,92,40,.05)'); gr.addColorStop(1, 'rgba(48,82,34,.55)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    for(let i = 0; i < 400; i++){
      g.fillStyle = `rgba(${50+R(0,40)|0},${90+R(0,50)|0},${30+R(0,20)|0},${R(.1,.35)})`;
      g.beginPath(); g.ellipse(rnd()*S, R(S*.3,S), R(4,26), R(3,10), 0, 0, 6.283); g.fill();
    }
    return tex(c, 5, 5);
  })();

  // Carved frieze: stepped frets and blocky glyph panels. Invented motifs.
  const friezeTex = (() => {
    const W = 512, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#7d7866'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#5a5647'; g.fillRect(0, 0, W, 10); g.fillRect(0, H - 10, W, 10);
    const cell = 64;
    for(let i = 0; i < W / cell; i++){
      const x = i * cell;
      g.fillStyle = 'rgba(40,38,30,.55)';
      if(i % 2 === 0){
        // stepped fret
        g.lineWidth = 7; g.strokeStyle = 'rgba(44,42,33,.7)';
        g.beginPath(); g.moveTo(x + 8, H - 22); g.lineTo(x + 8, 24); g.lineTo(x + 52, 24);
        g.lineTo(x + 52, 70); g.lineTo(x + 28, 70); g.lineTo(x + 28, 48); g.stroke();
      } else {
        // glyph panel: framed square with a face-like arrangement
        g.fillRect(x + 8, 20, 48, 88);
        g.fillStyle = '#8a8471';
        g.fillRect(x + 13, 25, 38, 78);
        g.fillStyle = 'rgba(40,38,30,.6)';
        g.fillRect(x + 18, 36, 10, 10); g.fillRect(x + 36, 36, 10, 10);
        g.fillRect(x + 22, 62, 20, 6); g.fillRect(x + 18, 80, 28, 12);
        g.fillRect(x + 30, 48, 4, 12);
      }
    }
    speckle(g, W, 300, ['rgba(40,38,30,.18)','rgba(70,110,50,.18)'], 1, 6);
    const t = tex(c, 6, 1.5); return t;
  })();

  // Jungle floor: dark soil, leaf litter, roots.
  const soilTex = (() => {
    const S = 512, [c, g] = cv(S);
    g.fillStyle = '#4a3f2c'; g.fillRect(0, 0, S, S);
    speckle(g, S, 1800, ['rgba(30,24,16,.35)','rgba(90,76,50,.3)','rgba(70,90,40,.25)','rgba(120,96,56,.22)'], 1, 4);
    // fallen leaves
    for(let i = 0; i < 420; i++){
      const hue = rnd() < .5 ? `rgba(${120+R(0,60)|0},${90+R(0,40)|0},${30+R(0,20)|0},${R(.35,.7)})`
                             : `rgba(${60+R(0,30)|0},${86+R(0,40)|0},${34+R(0,20)|0},${R(.35,.7)})`;
      g.fillStyle = hue;
      g.save(); g.translate(rnd()*S, rnd()*S); g.rotate(rnd()*6.28);
      g.beginPath(); g.ellipse(0, 0, R(3,8), R(1.5,3.5), 0, 0, 6.283); g.fill(); g.restore();
    }
    g.strokeStyle = 'rgba(40,30,18,.4)'; g.lineWidth = 3;
    for(let i = 0; i < 8; i++){
      let x = rnd()*S, y = rnd()*S; g.beginPath(); g.moveTo(x, y);
      for(let k = 0; k < 6; k++){ x += R(-30,30); y += R(-30,30); g.lineTo(x, y); }
      g.stroke();
    }
    return tex(c);
  })();

  // Worn paving with grass pushing through the joints.
  const pavingTex = (() => {
    const S = 512, [c, g] = cv(S);
    g.fillStyle = '#3f5a2c'; g.fillRect(0, 0, S, S);
    const n = 6, s = S / n;
    for(let i = 0; i < n; i++) for(let j = 0; j < n; j++){
      if(rnd() < .08) continue;                       // missing slab: grass shows
      const v = R(-12, 12);
      g.fillStyle = `rgb(${118+v|0},${112+v|0},${94+v|0})`;
      const off = (j % 2) * s / 2;
      g.fillRect(((i * s + off) % S) + 4, j * s + 4, s - 8, s - 8);
      if(((i * s + off) % S) + s > S) g.fillRect(((i * s + off) % S) - S + 4, j * s + 4, s - 8, s - 8);
    }
    speckle(g, S, 700, ['rgba(40,38,30,.2)','rgba(160,150,120,.12)','rgba(60,100,40,.25)'], 1, 5);
    for(let i = 0; i < 160; i++){
      g.fillStyle = `rgba(${50+R(0,30)|0},${100+R(0,40)|0},${30+R(0,20)|0},${R(.2,.5)})`;
      g.beginPath(); g.ellipse(rnd()*S, rnd()*S, R(4,18), R(2,8), rnd()*3, 0, 6.283); g.fill();
    }
    return tex(c);
  })();

  const mossTopTex = (() => {
    const S = 256, [c, g] = cv(S);
    g.fillStyle = '#44652e'; g.fillRect(0, 0, S, S);
    speckle(g, S, 900, ['rgba(30,50,20,.35)','rgba(90,130,50,.3)','rgba(110,100,60,.25)'], 1, 6);
    return tex(c);
  })();

  const barkTex = (() => {
    const W = 128, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#5b4c3a'; g.fillRect(0, 0, W, H);
    for(let i = 0; i < 70; i++){
      g.strokeStyle = `rgba(${30+R(0,30)|0},${24+R(0,20)|0},${16+R(0,10)|0},${R(.3,.7)})`;
      g.lineWidth = R(1, 4);
      const x = rnd()*W; g.beginPath(); g.moveTo(x, 0);
      g.bezierCurveTo(x + R(-10,10), H*.3, x + R(-10,10), H*.7, x + R(-6,6), H); g.stroke();
    }
    speckle(g, W, 120, ['rgba(80,110,50,.35)','rgba(140,130,100,.2)'], 2, 8);
    const t = tex(c); return t;
  })();

  // Alpha-masked foliage cluster: many leaves on a transparent card.
  function leafCard(base, hueJitter){
    const S = 256, [c, g] = cv(S);
    g.clearRect(0, 0, S, S);
    for(let i = 0; i < 150; i++){
      const a = rnd() * 6.283, r = Math.sqrt(rnd()) * S * .42;
      const x = S/2 + Math.cos(a) * r, y = S/2 + Math.sin(a) * r;
      const L = R(14, 30);
      const l = R(-hueJitter, hueJitter);
      g.fillStyle = `rgb(${base[0]+l|0},${base[1]+l*1.4|0},${base[2]+l*.6|0})`;
      g.save(); g.translate(x, y); g.rotate(rnd() * 6.283);
      g.beginPath(); g.ellipse(0, 0, L, L * .38, 0, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(20,30,10,.4)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-L, 0); g.lineTo(L, 0); g.stroke();
      g.restore();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const leafTex  = leafCard([46, 84, 30], 22);
  const leafTex2 = leafCard([70, 98, 34], 20);

  const vineTex = (() => {
    const W = 128, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    for(let v = 0; v < 5; v++){
      let x = R(10, W - 10);
      const len = R(H * .4, H);
      g.strokeStyle = 'rgba(58,78,34,.95)'; g.lineWidth = R(2, 4);
      g.beginPath(); g.moveTo(x, 0);
      for(let y = 0; y < len; y += 16){ x += R(-5, 5); g.lineTo(x, y); }
      g.stroke();
      for(let y = 6; y < len; y += R(7, 14)){
        g.fillStyle = `rgb(${50+R(0,40)|0},${88+R(0,50)|0},${30+R(0,24)|0})`;
        g.save(); g.translate(x + R(-7,7), y); g.rotate(R(-1.2, 1.2));
        g.beginPath(); g.ellipse(0, 0, R(5, 10), R(2.5, 5), 0, 0, 6.283); g.fill(); g.restore();
      }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  // ── MATERIALS ─────────────────────────────────────────────────────────────
  const M = {
    leaf:  new THREE.MeshStandardMaterial({ map:leafTex,  alphaTest:.45, side:THREE.DoubleSide, roughness:.85 }),
    leaf2: new THREE.MeshStandardMaterial({ map:leafTex2, alphaTest:.45, side:THREE.DoubleSide, roughness:.85 }),
    canopyCore: new THREE.MeshStandardMaterial({ color:0x2a4420, roughness:.95 }),
    bark:  new THREE.MeshStandardMaterial({ map:barkTex, roughness:.92 }),
    vine:  new THREE.MeshStandardMaterial({ map:vineTex, alphaTest:.4, side:THREE.DoubleSide, roughness:.9 }),
    stone: new THREE.MeshStandardMaterial({ map:stoneTex, roughness:.9 }),
    dark:  new THREE.MeshStandardMaterial({ color:0x2c2a22, roughness:.95 }),
    gold:  new THREE.MeshStandardMaterial({ color:0xb8923a, roughness:.35, metalness:.8 }),
    jade:  new THREE.MeshStandardMaterial({ color:0x3f8a6a, roughness:.3, metalness:.2 }),
    water: new THREE.MeshStandardMaterial({ color:0x2c4a3c, roughness:.08, metalness:.35, envMapIntensity:1.4, transparent:true, opacity:.9 }),
    mud:   new THREE.MeshStandardMaterial({ color:0x3a3020, roughness:1 }),
    flame: new THREE.MeshBasicMaterial({ color:0xffb050 }),
    wood:  new THREE.MeshStandardMaterial({ color:0x6a5236, roughness:.85 }),
    canvas:new THREE.MeshStandardMaterial({ color:0x7a7258, roughness:.95 }),
  };

  // Box materials with moss on top.
  function stoneMats(t, w, h, d){
    const m = sides(t, w, h, d);
    m[2] = bmat(mossTopTex, Math.max(1, Math.round(w/4)), Math.max(1, Math.round(d/4)));
    return m;
  }
  function deco(geo, mat, x, y, z, ry, rx, rz, shadow){
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if(ry) m.rotation.y = ry; if(rx) m.rotation.x = rx; if(rz) m.rotation.z = rz;
    m.castShadow = shadow !== false; m.receiveShadow = true;
    m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m);
    return m;
  }
  // Collision-only box (the visible form is built separately).
  function solidBox(x0, z0, x1, z1, y0, y1){
    obstacles.push(new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)));
  }

  // ── ATMOSPHERE ────────────────────────────────────────────────────────────
  scene.background = new THREE.Color(0xa9bca0);
  scene.fog = new THREE.FogExp2(0x8fa487, 0.0095);   // thinner than first tuned: the map is 1.33x bigger
  sun.position.set(-55, 120, 70);
  sun.color.setHex(0xfff0c8);
  sun.intensity = 2.3;
  Object.assign(sun.shadow.camera, { near:1, far:340, left:-80, right:80, top:80, bottom:-80 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.needsUpdate = true;

  // ── GROUND ────────────────────────────────────────────────────────────────
  {
    const t = soilTex.clone(); t.repeat.set(40, 40); t.needsUpdate = true;
    const base = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map:t, roughness:.98 }));
    base.rotation.x = -Math.PI/2; base.receiveShadow = true;
    base.matrixAutoUpdate = false; base.updateMatrix(); scene.add(base);
  }
  // paved plazas: the two courts, spawns, mid. Edge to edge, never overlapping.
  // Paving marks the built-up parts; the west plains stay jungle floor, which
  // is half of what makes them read as a different place. Edge to edge,
  // never overlapping.
ground(  8, -45,  45,  -3, pavingTex, 6, 0.02);                 // CT corner and courtyard
  ground(-12, -45,   8,  -3, pavingTex, 7, 0.02);                 // north of mid
  ground(-12,   1,   8,  45, pavingTex, 7, 0.02);                 // south of mid
  ground(  8,   1,  45,  45, pavingTex, 5, 0.02);                 // warren
  ground(-45,  24, -12,  45, pavingTex, 6, 0.02);                 // T corner
  // (the plains, north-west of all this, stay bare jungle floor)

  // ── THE RIVER ─────────────────────────────────────────────────────────────
  // Runs the full width of the map under every structure. Purely visual —
  // shallow enough to walk through, so it changes nothing about routing.
  {
    const { z0, z1 } = O.river;
    const bank = new THREE.Mesh(new THREE.PlaneGeometry(90, z1 - z0 + 1.6), M.mud);
    bank.rotation.x = -Math.PI/2; bank.position.set(0, 0.025, (z0 + z1)/2);
    bank.receiveShadow = true; bank.matrixAutoUpdate = false; bank.updateMatrix(); scene.add(bank);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(90, z1 - z0), M.water);
    w.rotation.x = -Math.PI/2; w.position.set(0, 0.045, (z0 + z1)/2);
    w.matrixAutoUpdate = false; w.updateMatrix(); scene.add(w);
    // stepping stones
    for(let x = -43; x < 43; x += R(2.2, 3.4)){
      if(rnd() < .35) continue;
      deco(new THREE.CylinderGeometry(R(.35,.6), R(.45,.7), .16, 7), M.stone,
           x, 0.08, R(z0 + .5, z1 - .5), rnd()*3, 0, 0, false);
    }
    // reeds along the banks
    for(let i = 0; i < 90; i++){
      const x = R(-44, 44), z = rnd() < .5 ? z0 - R(.1, .8) : z1 + R(.1, .8);
      const h = R(.5, 1.1);
      deco(new THREE.ConeGeometry(.05, h, 4), M.canopyCore, x, h/2, z, 0, R(-.2,.2), R(-.2,.2), false);
    }
  }

  // ── PERIMETER WALL ────────────────────────────────────────────────────────
  // Ruined enclosure at +/-45 (inner face), with a jagged crown and the jungle
  // pressing in behind it.
  {
    const T = 4, H = 8, B = 47;
    for(const [w, d, x, z] of [[B*2+T, T, 0, B], [B*2+T, T, 0, -B], [T, B*2+T, B, 0], [T, B*2+T, -B, 0]]){
      addBox(w, H, d, x, 0, z, stoneMats(mossStoneTex, w, H, d), true);
    }
    // broken crown blocks
    for(let s = -45; s < 45; s += R(2.2, 4.2)){
      for(const [x, z, alongX] of [[s, 46.2, true], [s, -46.2, true], [46.2, s, false], [-46.2, s, false]]){
        if(rnd() < .35) continue;
        const h = R(.5, 2.4), w = R(1.2, 2.6);
        deco(new THREE.BoxGeometry(alongX ? w : 1.6, h, alongX ? 1.6 : w), M.stone, x, H + h/2, z);
      }
    }
  }

  // ── BUILDING BLOCKS ───────────────────────────────────────────────────────
  // A frieze band that wraps a mass at height y, standing proud of the face.
  function frieze(x0, z0, x1, z1, y, h){
    const w = x1 - x0, d = z1 - z0, p = 0.18;
    const mX = new THREE.MeshStandardMaterial({ map:(()=>{const t=friezeTex.clone();t.repeat.set(Math.max(1,Math.round(w/6)),1);t.needsUpdate=true;return t;})(), roughness:.9 });
    const mZ = new THREE.MeshStandardMaterial({ map:(()=>{const t=friezeTex.clone();t.repeat.set(Math.max(1,Math.round(d/6)),1);t.needsUpdate=true;return t;})(), roughness:.9 });
    deco(new THREE.BoxGeometry(w + p*2, h, p), mX, (x0+x1)/2, y + h/2, z0 - p/2 + .01, 0, 0, 0, false);
    deco(new THREE.BoxGeometry(w + p*2, h, p), mX, (x0+x1)/2, y + h/2, z1 + p/2 - .01, 0, 0, 0, false);
    deco(new THREE.BoxGeometry(p, h, d), mZ, x0 - p/2 + .01, y + h/2, (z0+z1)/2, 0, 0, 0, false);
    deco(new THREE.BoxGeometry(p, h, d), mZ, x1 + p/2 - .01, y + h/2, (z0+z1)/2, 0, 0, 0, false);
  }

  // Vines hanging down a face. `face` = 'n','s','e','w'.
  function vines(x0, z0, x1, z1, top, count){
    const faces = [];
    if(z0 > -44.9) faces.push('n'); if(z1 < 44.9) faces.push('s');
    if(x0 > -44.9) faces.push('w'); if(x1 < 44.9) faces.push('e');
    for(let i = 0; i < count; i++){
      const f = faces[(rnd() * faces.length) | 0];
      if(!f) return;
      const len = R(top * .35, top * .9), wd = R(1.2, 2.4);
      const geo = new THREE.PlaneGeometry(wd, len);
      const y = top - len/2;
      if(f === 'n') deco(geo, M.vine, R(x0 + 1, x1 - 1), y, z0 - .06, Math.PI, 0, 0, false);
      if(f === 's') deco(geo, M.vine, R(x0 + 1, x1 - 1), y, z1 + .06, 0, 0, 0, false);
      if(f === 'w') deco(geo, M.vine, x0 - .06, y, R(z0 + 1, z1 - 1), -Math.PI/2, 0, 0, false);
      if(f === 'e') deco(geo, M.vine, x1 + .06, y, R(z0 + 1, z1 - 1), Math.PI/2, 0, 0, false);
    }
  }

  // A tree. Inside the playfield they only ever grow from rooftops, so they
  // never need collision; outside the walls they are scenery.
  function tree(x, z, y, s){
    s = s || 1;
    const h = R(9, 15) * s, r = R(.35, .6) * s;
    deco(new THREE.CylinderGeometry(r * .7, r * 1.25, h, 8), M.bark, x, y + h/2, z, rnd()*3, R(-.06,.06), R(-.06,.06));
    // buttress roots
    for(let i = 0; i < 4; i++){
      const a = i * 1.57 + R(-.3,.3);
      deco(new THREE.BoxGeometry(r * .5, r * 2.4, r * 2.8), M.bark,
           x + Math.cos(a) * r * 1.2, y + r * 1.1, z + Math.sin(a) * r * 1.2, -a, 0, 0, false);
    }
    // canopy: a dark core so it never reads as see-through, then leaf cards
    const cy = y + h;
    const cr = R(3.2, 5.2) * s;
    const core = deco(new THREE.SphereGeometry(cr * .72, 9, 6), M.canopyCore, x, cy, z);
    core.scale.set(1, .55, 1); core.updateMatrix();
    for(let i = 0; i < 7; i++){
      const a = rnd() * 6.283, d = R(0, cr * .7);
      const m = rnd() < .5 ? M.leaf : M.leaf2;
      const card = deco(new THREE.PlaneGeometry(cr * 1.4, cr * 1.4), m,
                        x + Math.cos(a) * d, cy + R(-.6, 1.2), z + Math.sin(a) * d,
                        rnd() * 6.283, -Math.PI/2 + R(-.5, .5), R(-.4,.4));
      card.castShadow = true;
    }
    // a few hanging vines from the canopy
    for(let i = 0; i < 3; i++){
      const len = R(3, 7);
      deco(new THREE.PlaneGeometry(1.2, len), M.vine, x + R(-cr*.6, cr*.6), cy - len/2, z + R(-cr*.6, cr*.6), rnd()*6, 0, 0, false);
    }
  }

  // Low fern clump, knee height, purely visual.
  // Ferns are scattered at random, so refuse any spot inside (or within half
  // a unit of) a structure, cover piece or brazier: a fern poking out of a
  // wall reads as a rendering bug. Ground-level ferns only; the y argument is
  // for ferns deliberately placed on something.
  function blockedAt(x, z){
    for(const b of O.solids.concat(O.low, O.braziers, O.walls.flatMap(ogWallBoxes)))
      if(x > b[0] - .5 && x < b[2] + .5 && z > b[1] - .5 && z < b[3] + .5) return true;
    return false;
  }
  function fern(x, z, y){
    if(!y && blockedAt(x, z)) return;
    const n = 4 + (rnd() * 3 | 0);
    for(let i = 0; i < n; i++){
      const m = rnd() < .5 ? M.leaf : M.leaf2;
      deco(new THREE.PlaneGeometry(R(1, 1.6), R(.6, .9)), m, x + R(-.3,.3), (y||0) + .35, z + R(-.3,.3),
           rnd() * 6.283, R(-.9, -.4), 0, false);
    }
  }

  // Ruin mass: the collision box IS the silhouette's footprint. On top go a
  // stepped crown, broken blocks and sometimes a tree, none of it reachable.
  function ruinMass(x0, z0, x1, z1, h, opts){
    const o = opts || {};
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1)/2, cz = (z0 + z1)/2;
    addBox(w, h, d, cx, 0, cz, stoneMats(o.moss ? mossStoneTex : stoneTex, w, h, d), true);
    // plinth
    deco(new THREE.BoxGeometry(w + .5, .5, d + .5), M.stone, cx, .25, cz, 0, 0, 0, false);
    if(o.frieze !== false && h >= 5) frieze(x0, z0, x1, z1, h * .66, Math.min(1.4, h * .14));
    // stepped crown
    let tx0 = x0, tz0 = z0, tx1 = x1, tz1 = z1, ty = h;
    for(let i = 0; i < (o.tiers || 0); i++){
      const inset = Math.min(w, d) * .14;
      tx0 += inset; tz0 += inset; tx1 -= inset; tz1 -= inset;
      if(tx1 - tx0 < 2 || tz1 - tz0 < 2) break;
      const th = o.tierH || 1.8;
      addBox(tx1 - tx0, th, tz1 - tz0, (tx0+tx1)/2, ty, (tz0+tz1)/2, stoneMats(stoneTex, tx1-tx0, th, tz1-tz0), true);
      ty += th;
    }
    // broken blocks along the roof edge
    const n = Math.round((w + d) / 3);
    for(let i = 0; i < n; i++){
      const onX = rnd() < w / (w + d);
      const bx = onX ? R(x0 + .8, x1 - .8) : (rnd() < .5 ? x0 + .7 : x1 - .7);
      const bz = onX ? (rnd() < .5 ? z0 + .7 : z1 - .7) : R(z0 + .8, z1 - .8);
      const bh = R(.4, 1.6);
      deco(new THREE.BoxGeometry(R(.8, 1.8), bh, R(.8, 1.8)), M.stone, bx, h + bh/2, bz, R(-.2,.2));
    }
    if(o.tree) tree(cx + R(-w*.2, w*.2), cz + R(-d*.2, d*.2), ty, o.tree);
    vines(x0, z0, x1, z1, h, o.vines === undefined ? Math.round((w + d) / 5) : o.vines);
    // ferns at the foot
    for(let i = 0; i < Math.round((w + d) / 6); i++){
      const side = (rnd() * 4) | 0;
      const fx = side < 2 ? R(x0, x1) : (side === 2 ? x0 - .6 : x1 + .6);
      const fz = side >= 2 ? R(z0, z1) : (side === 0 ? z0 - .6 : z1 + .6);
      if(Math.abs(fx) < 44.5 && Math.abs(fz) < 44.5) fern(fx, fz);
    }
    return ty;
  }

  // Temple hall: a long mass with pilasters and a doorway motif on each long
  // face. The doorways are dark recesses — the halls are not enterable.
  function hall(x0, z0, x1, z1, h){
    ruinMass(x0, z0, x1, z1, h, { tiers: 2, tierH: 2.2, tree: 1.2, moss: true });
    const alongZ = (z1 - z0) > (x1 - x0);
    const len = alongZ ? z1 - z0 : x1 - x0;
    for(let p = 3; p < len - 2; p += 5){
      for(const face of [0, 1]){
        if(alongZ){
          const x = face ? x1 + .25 : x0 - .25, z = z0 + p;
          deco(new THREE.BoxGeometry(.5, h * .62, 1), M.stone, x, h * .31, z, 0, 0, 0, false);
        } else {
          const z = face ? z1 + .25 : z0 - .25, x = x0 + p;
          deco(new THREE.BoxGeometry(1, h * .62, .5), M.stone, x, h * .31, z, 0, 0, 0, false);
        }
      }
    }
    // dark false doorways between pilasters
    for(let p = 5.5; p < len - 4; p += 10){
      for(const face of [0, 1]){
        if(alongZ){
          const x = face ? x1 + .02 : x0 - .02;
          deco(new THREE.BoxGeometry(.06, 3.2, 2.2), M.dark, x, 1.6, z0 + p, 0, 0, 0, false);
          deco(new THREE.BoxGeometry(.4, .5, 3.2), M.stone, face ? x1 + .2 : x0 - .2, 3.45, z0 + p, 0, 0, 0, false);
        } else {
          const z = face ? z1 + .02 : z0 - .02;
          deco(new THREE.BoxGeometry(2.2, 3.2, .06), M.dark, x0 + p, 1.6, z, 0, 0, 0, false);
          deco(new THREE.BoxGeometry(3.2, .5, .4), M.stone, x0 + p, 3.45, face ? z1 + .2 : z0 - .2, 0, 0, 0, false);
        }
      }
    }
  }

  // Carved stone head. Collision is the given box; the face points `facing`
  // (radians about y, 0 = toward -z).
  function stoneHead(x0, z0, x1, z1, h, facing, tilt){
    const cx = (x0 + x1)/2, cz = (z0 + z1)/2, s = Math.min(x1 - x0, z1 - z0) / 2;
    solidBox(x0, z0, x1, z1, 0, h);
    const g = new THREE.Group();
    const mat = M.stone;
    const head = new THREE.Mesh(new THREE.BoxGeometry(s*1.8, h*.86, s*1.7), mat); head.position.y = h*.43; g.add(head);
    const helm = new THREE.Mesh(new THREE.BoxGeometry(s*1.95, h*.22, s*1.85), mat); helm.position.y = h*.86; g.add(helm);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(s*1.7, h*.08, .5), mat); brow.position.set(0, h*.62, -s*.86); g.add(brow);
    for(const ex of [-.42, .42]){
      const eye = new THREE.Mesh(new THREE.BoxGeometry(s*.42, h*.08, .3), M.dark); eye.position.set(ex*s, h*.54, -s*.86); g.add(eye);
      const ear = new THREE.Mesh(new THREE.BoxGeometry(.5, h*.3, s*.5), mat); ear.position.set(ex > 0 ? s*.95 : -s*.95, h*.48, 0); g.add(ear);
      const plug = new THREE.Mesh(new THREE.CylinderGeometry(s*.14, s*.14, .3, 10), M.jade);
      plug.rotation.z = Math.PI/2; plug.position.set(ex > 0 ? s*1.12 : -s*1.12, h*.42, 0); g.add(plug);
    }
    const nose = new THREE.Mesh(new THREE.BoxGeometry(s*.42, h*.22, .6), mat); nose.position.set(0, h*.4, -s*.9); g.add(nose);
    const lips = new THREE.Mesh(new THREE.BoxGeometry(s*.8, h*.1, .45), mat); lips.position.set(0, h*.2, -s*.88); g.add(lips);
    g.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(cx, 0, cz); g.rotation.y = facing || 0; if(tilt) g.rotation.z = tilt;
    g.matrixAutoUpdate = false; g.updateMatrix(); scene.add(g);
    for(let i = 0; i < 3; i++) fern(cx + R(-s, s), cz + R(-s, s) + (rnd()<.5 ? -s-1 : s+1));
    // moss cap
    deco(new THREE.BoxGeometry(s*1.9, .12, s*1.8), new THREE.MeshStandardMaterial({ map:mossTopTex, roughness:.95 }), cx, h + .02, cz, facing, 0, 0, false);
  }

  // Waist-high cover: a fallen block, a column drum or a supply crate.
  function lowCover(x0, z0, x1, z1, kind){
    const w = x1 - x0, d = z1 - z0, cx = (x0+x1)/2, cz = (z0+z1)/2;
    const h = kind === 'crate' ? 1.25 : R(1.05, 1.3);
    solidBox(x0, z0, x1, z1, 0, h);
    platforms.push({ x0, x1, z0, z1, top: h });
    if(kind === 'crate'){
      deco(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map:crateTex, roughness:.8 }), cx, h/2, cz);
      deco(new THREE.BoxGeometry(w*.8, .02, d*.8), M.canvas, cx, h + .01, cz, 0, 0, 0, false);
    } else if(kind === 'drum' && useModels){
      // standing column drums (the og_drum model), as many as fit along the
      // long side. Height stays waist-high whatever the map scale.
      const lo = Math.min(w, d), n = Math.max(1, Math.round(Math.max(w, d) / lo));
      for(let i = 0; i < n; i++){
        const t = (i + .5) / n;
        const px = w >= d ? x0 + w * t : cx, pz = w >= d ? cz : z0 + d * t;
        const dia = Math.min(lo, Math.max(w, d) / n) * .98;   // never wider than its slice
        glbStructure('ogDrum', px, pz, dia, h, dia,
                     { stretch: true, noCollide: true, yaw: ((rnd() * 4) | 0) * 90 });
      }
    } else if(kind === 'drum'){
      // standing column drums, as many as fit along the long side
      const lo = Math.min(w, d), n = Math.max(1, Math.round(Math.max(w, d) / lo));
      for(let i = 0; i < n; i++){
        const t = (i + .5) / n;
        const px = w >= d ? x0 + w * t : cx, pz = w >= d ? cz : z0 + d * t;
        deco(new THREE.CylinderGeometry(lo * .48, lo * .5, h, 14), M.stone, px, h/2, pz, rnd()*3);
        deco(new THREE.CylinderGeometry(lo * .47, lo * .47, .1, 14), new THREE.MeshStandardMaterial({ map:mossTopTex, roughness:.95 }), px, h + .04, pz, 0, 0, 0, false);
      }
    } else {
      deco(new THREE.BoxGeometry(w, h, d), bmat(stoneTex, 1, 1), cx, h/2, cz, R(-.02,.02));
      deco(new THREE.BoxGeometry(w * .95, .1, d * .95), new THREE.MeshStandardMaterial({ map:mossTopTex, roughness:.95 }), cx, h + .03, cz, 0, 0, 0, false);
    }
  }

  // ── PLACE THE SOLIDS ──────────────────────────────────────────────────────
  // ── MESHY MODELS ──────────────────────────────────────────────────────────
  // Where a model exists, it replaces the code-built visual. The COLLISION is
  // still the authored box from O.solids (placed here with solidBox), never
  // derived from the mesh: the layout was measured for connectivity, slot
  // widths and sightlines, and a mesh-derived footprint would quietly undo that.
  // Each model is stretched to fill its box exactly, with the height chosen
  // from the model's own proportions so the stretch stays small.
  //
  // Set OG_USE_MODELS = false (or add ?models=0 to the URL) to see the
  // code-built map again. A missing file logs a warning and leaves a solid
  // invisible block, so the map still plays correctly.
  Object.assign(STRUCTURE_FILES, {
    ogHall:     'og_hall_segment.glb',
    ogBlock:    'og_block.glb',
    ogLong:     'og_block_long.glb',
    ogWall:     'og_ruin_wall.glb',
    ogTower:    'og_mid_tower.glb',
    ogTemple:   'og_ct_temple.glb',
    ogColossus: 'og_colossus.glb',
    ogBrazier:  'og_brazier.glb',
    ogDrum:     'og_drum.glb',
  });
  // Native proportions (x : y : z), measured from the optimised files.
  const OG_SHAPE = {
    ogHall:     [1, .769, 1.134],   // doorways on its +z face
    ogBlock:    [1, 1.006, 1.03],
    ogLong:     [1, .456, .515],    // long along x
    ogWall:     [1, .422, .361],    // long along x
    ogTower:    [1, 1.885, 1.118],
    ogTemple:   [1, 1.598, .888],   // doorway on its +z face
    ogColossus: [1, 1.141, 1.158],  // face on its +z side
    ogBrazier:  [1, .666, 1],
    ogDrum:     [1, .691, 1],
  };
  const useModels = (() => {
    try { if(new URLSearchParams(location.search).get('models') === '0') return false; } catch(e){}
    return typeof OG_USE_MODELS === 'undefined' ? true : !!OG_USE_MODELS;
  })();

  // Place one model filling the world box x0..x1, z0..z1. yaw is 0/90/180/270.
  // Returns the height it was given.
  function model(key, x0, z0, x1, z1, yaw, opt){
    const n = OG_SHAPE[key], turned = (yaw % 180) !== 0;
    const lw = turned ? z1 - z0 : x1 - x0;     // the model's own x extent
    const ld = turned ? x1 - x0 : z1 - z0;     // ...and its own z extent
    let h = n[1] * Math.sqrt((lw / n[0]) * (ld / n[2]));
    if(opt && opt.minH) h = Math.max(h, opt.minH);
    if(opt && opt.maxH) h = Math.min(h, opt.maxH);
    // models load asynchronously, after the scale pass, so place them at
    // final (scaled) size and position directly
    glbStructure(key, (x0+x1)/2 * S, (z0+z1)/2 * S, lw * S, h * S, ld * S,
                 Object.assign({ stretch: true, yaw, noCollide: true }, opt || {}));
    return h;
  }
  // Split a long footprint into n equal pieces along its long axis.
  function split(x0, z0, x1, z1, n){
    const out = [], alongZ = (z1 - z0) >= (x1 - x0);
    for(let i = 0; i < n; i++){
      const a = i / n, b = (i + 1) / n;
      out.push(alongZ ? [x0, z0 + (z1-z0)*a, x1, z0 + (z1-z0)*b]
                      : [x0 + (x1-x0)*a, z0, x0 + (x1-x0)*b, z1]);
    }
    return out;
  }
  const WALL_TINT = 0xffffff;
  // The long ruin block at the size it was first used at (a 12 x 7 ruin piece
  // stood 5.8 tall): every wall built from it uses this one height, still
  // well over head height so it blocks sight.
  const LONG_H = 5.8;   // neutral: the wall's sandy texture was re-graded to grey when optimised
  function baseFerns(x0, z0, x1, z1){
    for(let i = 0; i < Math.round((x1 - x0 + z1 - z0) / 5); i++){
      const side = (rnd() * 4) | 0;
      const fx = side < 2 ? R(x0, x1) : (side === 2 ? x0 - .5 : x1 + .5);
      const fz = side >= 2 ? R(z0, z1) : (side === 0 ? z0 - .5 : z1 + .5);
      if(Math.abs(fx) < 44.5 && Math.abs(fz) < 44.5) fern(fx, fz);
    }
  }

  // Returns true if a model took this solid; false to fall through to code.
  function placeModel(x0, z0, x1, z1, h, kind){
    const cx = (x0+x1)/2, cz = (z0+z1)/2, w = x1 - x0, d = z1 - z0;
    const long = Math.max(w, d) / Math.min(w, d);
    let top;
    switch(kind){
      case 'hall': case 'wing': {
        // ONE structure per wall: a single long-ruin-block model (og_block_long) sized to the whole
        // footprint, never a row of buildings butted together. Its own
        // proportions (long, tall, thin) match these footprints closely, so
        // it barely stretches.
        const alongZ = d >= w;
        top = model('ogLong', x0, z0, x1, z1, (alongZ ? 90 : 0) + (rnd() < .5 ? 180 : 0), { minH: LONG_H, maxH: LONG_H });
        solidBox(x0, z0, x1, z1, 0, top);
        break;
      }
      case 'house': {
        // The temple-house model, used ONCE per spot as a freestanding
        // building: open ground on all four sides, so it is fought around.
        // Footprints are 8 x 9, the model's own proportions (1 : 1.134).
        const yaw = cz < -15 ? 0 : (cx > 0 ? 180 : 0);
        top = model('ogHall', x0, z0, x1, z1, yaw, { minH: 7, maxH: 7 });
        solidBox(x0, z0, x1, z1, 0, top);
        // Its colonnade faces are open between the columns; a dark core set
        // just behind them turns each gap into a shadowed doorway rather than
        // a window through a wall you cannot walk through.
        const ch = top * .52;
        deco(new THREE.BoxGeometry(w - .8, ch, d - 3.2), M.dark, cx, ch / 2, cz, 0, 0, 0, false);
        break;
      }
      case 'ruin': case 'doorwall': {
        if(kind === 'doorwall'){
          // one block, not two wall pieces end to end
          top = model('ogBlock', x0, z0, x1, z1, ((rnd() * 4) | 0) * 90, { minH: h, maxH: h });
        } else if(long > 1.3){
          const alongZ = d > w;
          top = model('ogLong', x0, z0, x1, z1, (alongZ ? 90 : 0) + (rnd() < .5 ? 180 : 0));
        } else {
          top = model('ogBlock', x0, z0, x1, z1, ((rnd() * 4) | 0) * 90, { minH: h, maxH: h });
        }
        solidBox(x0, z0, x1, z1, 0, top);
        break;
      }
      case 'long': {
        // The long ruin block at its OWN proportions: the footprint is drawn
        // to the model's shape (1 : 0.515 in plan), so nothing is stretched,
        // and the height follows from the same scale (0.456 of its length).
        top = model('ogLong', x0, z0, x1, z1, (d > w ? 90 : 0) + (rnd() < .5 ? 180 : 0));
        solidBox(x0, z0, x1, z1, 0, top);
        break;
      }
      case 'screen': {
        // A single standing wall that blocks sight: the ruin-wall model, at
        // least 3.5 tall (well over head height), one per spot.
        top = model('ogLong', x0, z0, x1, z1, (d > w ? 90 : 0) + (rnd() < .5 ? 180 : 0),
                    { minH: LONG_H, maxH: LONG_H });
        solidBox(x0, z0, x1, z1, 0, top);
        break;
      }
      case 'stone': {
        // The small stone block: the same block model as the ruins, at twice
        // a palace crate (3.2 wide, 2.94 tall in the world). Tall enough to
        // hide behind, too tall to shoot over.
        top = model('ogBlock', x0, z0, x1, z1, ((rnd() * 4) | 0) * 90, { minH: h, maxH: h });
        solidBox(x0, z0, x1, z1, 0, top);
        break;
      }
      case 'wall': {
        top = model('ogLong', x0, z0, x1, z1, (d > w ? 90 : 0) + (rnd() < .5 ? 180 : 0),
                    { minH: 3.3 });
        solidBox(x0, z0, x1, z1, 0, top);
        break;
      }
      case 'altar': {
        // (no brazier: the model's top is uneven, so one would float)
        top = model('ogLong', x0, z0, x1, z1, 0);
        solidBox(x0, z0, x1, z1, 0, top);
        break;
      }
      case 'tower': {
        top = model('ogTower', x0, z0, x1, z1, 0);
        // wide base, narrower shaft: bullets should hit what you see
        solidBox(x0, z0, x1, z1, 0, top * .3);
        const s = Math.min(w, d) * .31;
        solidBox(cx - s, cz - s, cx + s, cz + s, top * .3, top);
        break;
      }
      case 'temple': {
        top = model('ogTemple', x0, z0, x1, z1, 0);
        solidBox(x0, z0, x1, z1, 0, top * .45);
        solidBox(cx - w * .33, z0, cx + w * .33, z1, top * .45, top);
        break;
      }
      case 'colossus': {
        top = model('ogColossus', x0, z0, x1, z1, 0);
        solidBox(x0, z0, x1, z1, 0, top);
        break;
      }
      default: return false;       // stelae, jaguar, banyan: code-built
    }
    baseFerns(x0, z0, x1, z1);
    return true;
  }

  // ── LONG RUIN BLOCKS, any direction ────────────────────────────────────
  for(const w of O.walls){
    const [cx, cz, L, deg] = w, D = L * .515, H = L * .456;
    const boxes = ogWallBoxes(w);
    for(const b of boxes) solidBox(b[0], b[1], b[2], b[3], 0, H);
    if(useModels){
      // own-axis size, then turned: the model is never stretched
      glbStructure('ogLong', cx * S, cz * S, L * S, H * S, D * S,
                   { stretch: true, noCollide: true, yaw: -deg });
    } else {
      for(const b of boxes) ruinMass(b[0], b[1], b[2], b[3], H, { tiers: 0 });
    }
  }

  for(const [x0, z0, x1, z1, h, kind] of O.solids){
    const cx = (x0+x1)/2, cz = (z0+z1)/2;
    if(useModels && placeModel(x0, z0, x1, z1, h, kind)) continue;
    switch(kind){
      case 'hall':   hall(x0, z0, x1, z1, h); break;
      case 'wing':   ruinMass(x0, z0, x1, z1, h, { tiers: 2, tierH: 1.8, tree: rnd() < .6 ? 1 : 0, moss: true }); break;
      case 'house':  ruinMass(x0, z0, x1, z1, h, { tiers: 2, tierH: 1.6, moss: true }); break;
      case 'ruin':   ruinMass(x0, z0, x1, z1, h, { tiers: 1, tree: rnd() < .5 ? .9 : 0, moss: true }); break;
      case 'doorwall': ruinMass(x0, z0, x1, z1, h, { tiers: 0, vines: 4 }); break;
      case 'long':     ruinMass(x0, z0, x1, z1, (Math.max(x1 - x0, z1 - z0)) * .456, { tiers: 0 }); break;
      case 'screen':   ruinMass(x0, z0, x1, z1, h, { tiers: 0, vines: 2 }); break;
      case 'stone':    ruinMass(x0, z0, x1, z1, h, { tiers: 0 }); break;
      case 'stelae': {
        // a cluster of tall carved stelae, packed into one collision box
        solidBox(x0, z0, x1, z1, 0, h);
        const w = x1 - x0, d = z1 - z0;
        const n = Math.max(2, Math.round(d / 2.6));
        for(let i = 0; i < n; i++){
          const sz = z0 + (i + .5) * d / n, sh = R(h * .75, h);
          const m = new THREE.MeshStandardMaterial({ map:(()=>{const t=friezeTex.clone();t.repeat.set(1,3);t.needsUpdate=true;return t;})(), roughness:.9 });
          deco(new THREE.BoxGeometry(w * .92, sh, d / n * .9), [M.stone, M.stone, M.stone, M.stone, m, m], cx, sh/2, sz, R(-.04,.04));
        }
        deco(new THREE.BoxGeometry(w + .6, .6, d + .6), M.stone, cx, .3, cz, 0, 0, 0, false);
        break;
      }
      case 'tower': {
        // Landmark: a tall stepped tower, broken at the top, a tree growing out
        let top = ruinMass(x0, z0, x1, z1, h * .55, { tiers: 0, moss: true, vines: 10 });
        const tiers = [[8.4, 3.6], [6.8, 3.2], [5.2, 2.6]];
        let y = h * .55;
        for(const [s, th] of tiers){
          addBox(s, th, s, cx, y, cz, stoneMats(stoneTex, s, th, s), true);
          frieze(cx - s/2, cz - s/2, cx + s/2, cz + s/2, y + th * .55, .7);
          y += th;
        }
        // shrine on the crown with a gold roof comb
        addBox(3.6, 2.2, 3.6, cx, y, cz, stoneMats(stoneTex, 3.6, 2.2, 3.6), true);
        deco(new THREE.BoxGeometry(1.2, 1.6, .06), M.dark, cx, y + .8, cz + 1.83, 0, 0, 0, false);
        deco(new THREE.BoxGeometry(3.2, 1.4, .5), M.stone, cx, y + 2.9, cz);
        deco(new THREE.BoxGeometry(2.2, .5, .56), M.gold, cx, y + 3.6, cz);
        tree(cx + 2.4, cz - 2.4, h * .55 + 3.6, .8);
        break;
      }
      case 'temple': {
        // CT spawn temple: stepped, with a grand stair face (decorative)
        const t = ruinMass(x0, z0, x1, z1, h, { tiers: 2, tierH: 2, moss: true });
        // a carved stair relief up the front face (decorative, flush)
        deco(new THREE.BoxGeometry(3.6, h, .3), M.stone, cx, h/2, z1 + .14, 0, 0, 0, false);
        for(let i = 0; i < 10; i++)
          deco(new THREE.BoxGeometry(3.4, .12, .1), M.dark, cx, .5 + i * (h - 1) / 10, z1 + .32, 0, 0, 0, false);
        addBox(3, 2.6, 3, cx, t, cz, stoneMats(stoneTex, 3, 2.6, 3), true);
        deco(new THREE.BoxGeometry(1.1, 1.6, .06), M.dark, cx, t + .8, cz + 1.53, 0, 0, 0, false);
        break;
      }
      case 'altar': {
        ruinMass(x0, z0, x1, z1, h, { tiers: 0, frieze: false, vines: 2 });
        frieze(x0, z0, x1, z1, .6, 1.2);
        brazier(cx, cz, h);
        break;
      }
      case 'jaguar': {
        // pedestal plus a crouched jaguar built from blocks
        solidBox(x0, z0, x1, z1, 0, h);
        const w = x1 - x0, d = z1 - z0;
        deco(new THREE.BoxGeometry(w, 2.2, d), bmat(stoneTex, 1, 1), cx, 1.1, cz);
        frieze(x0, z0, x1, z1, .7, .9);
        const j = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, d * .7), M.stone); body.position.set(0, .65, .3); j.add(body);
        const chest = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.4), M.stone); chest.position.set(0, .9, -d*.28); j.add(chest);
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.3), M.stone); head.position.set(0, 2.1, -d*.3); j.add(head);
        const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.2, .45, .7), M.stone); jaw.position.set(0, 1.6, -d*.3 - .7); j.add(jaw);
        for(const ex of [-.4, .4]){
          const ear = new THREE.Mesh(new THREE.BoxGeometry(.35, .45, .3), M.stone); ear.position.set(ex, 2.8, -d*.3 + .2); j.add(ear);
          const eye = new THREE.Mesh(new THREE.BoxGeometry(.3, .16, .1), M.jade); eye.position.set(ex*.9, 2.25, -d*.3 - .66); j.add(eye);
          const paw = new THREE.Mesh(new THREE.BoxGeometry(.5, .35, .9), M.stone); paw.position.set(ex*1.5, .18, -d*.38); j.add(paw);
        }
        j.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
        j.position.set(cx, 2.2, cz); j.matrixAutoUpdate = false; j.updateMatrix(); scene.add(j);
        break;
      }
      case 'wall': {
        // Ruined free-standing wall: solid to the top, a jagged broken crown
        // and a carved band. Too tall to climb or see over.
        const w = x1 - x0, d = z1 - z0;
        addBox(w, h, d, cx, 0, cz, stoneMats(mossStoneTex, w, h, d), true);
        deco(new THREE.BoxGeometry(w + .4, .4, d + .4), M.stone, cx, .2, cz, 0, 0, 0, false);
        frieze(x0, z0, x1, z1, h * .55, .45);
        const along = w >= d, len = along ? w : d;
        for(let p = .6; p < len - .4; p += R(.8, 1.5)){
          if(rnd() < .3) continue;
          const bh = R(.25, 1.1), bw = R(.6, 1.2);
          deco(new THREE.BoxGeometry(along ? bw : Math.min(w, 1.3), bh, along ? Math.min(d, 1.3) : bw), M.stone,
               along ? x0 + p : cx, h + bh/2, along ? cz : z0 + p, R(-.1, .1));
        }
        vines(x0, z0, x1, z1, h, Math.round(len / 3));
        for(let i = 0; i < 3; i++) fern(along ? R(x0, x1) : x0 - .6, along ? z1 + .6 : R(z0, z1));
        break;
      }
      case 'banyan': {
        // A giant strangler fig grown over a buried ruin: one huge trunk,
        // thick buttress roots fanning out across the whole footprint, broken
        // masonry caught between them, a wide canopy and aerial roots hanging
        // down. The only colossal stone head left on the map is the colossus.
        const w = x1 - x0, d = z1 - z0, rad = Math.min(w, d) / 2;
        const tr = rad * .34, th = h * 1.6;
        deco(new THREE.CylinderGeometry(tr * .8, tr * 1.15, th, 12), M.bark, cx, th / 2, cz, rnd() * 3);
        // secondary trunks wrapped around the main one
        for(let i = 0; i < 4; i++){
          const a = i * 1.57 + R(-.4, .4), r2 = tr * R(.35, .5);
          deco(new THREE.CylinderGeometry(r2 * .6, r2, th * R(.55, .85), 7), M.bark,
               cx + Math.cos(a) * tr * .85, th * .35, cz + Math.sin(a) * tr * .85, 0, R(-.12, .12), R(-.12, .12));
        }
        // buttress roots: tall thin fins tapering out to the footprint edge
        for(let i = 0; i < 9; i++){
          const a = i / 9 * 6.283 + R(-.15, .15), len = rad * R(.75, 1.0), rh = R(1.6, 2.6);
          const fin = deco(new THREE.BoxGeometry(len, rh, .35), M.bark,
                           cx + Math.cos(a) * len / 2, rh / 2 - .1, cz + Math.sin(a) * len / 2, -a, 0, 0);
          fin.geometry.translate(0, 0, 0);
          // taper: a second, lower fin further out
          deco(new THREE.BoxGeometry(len * .45, rh * .45, .3), M.bark,
               cx + Math.cos(a) * len * .85, rh * .22, cz + Math.sin(a) * len * .85, -a, 0, 0, false);
        }
        // masonry caught in the roots
        for(let i = 0; i < 5; i++){
          const a = rnd() * 6.283, r3 = R(tr * 1.3, rad * .8), bs = R(.7, 1.3);
          deco(new THREE.BoxGeometry(bs, bs * .8, bs * 1.1), M.stone, cx + Math.cos(a) * r3, bs * .35, cz + Math.sin(a) * r3, rnd() * 3, R(-.2, .2), R(-.2, .2));
        }
        // canopy: a wide flat crown, built from several leaf masses
        const cy = th;
        for(let i = 0; i < 6; i++){
          const a = i / 6 * 6.283, dd = rad * R(.6, 1.1);
          const core = deco(new THREE.SphereGeometry(rad * R(.65, .85), 9, 6), M.canopyCore,
                            cx + Math.cos(a) * dd, cy + R(-.5, 1), cz + Math.sin(a) * dd);
          core.scale.set(1, .45, 1); core.updateMatrix();
        }
        for(let i = 0; i < 16; i++){
          const a = rnd() * 6.283, dd = R(0, rad * 1.5);
          deco(new THREE.PlaneGeometry(rad * 1.3, rad * 1.3), rnd() < .5 ? M.leaf : M.leaf2,
               cx + Math.cos(a) * dd, cy + R(-.4, 1.4), cz + Math.sin(a) * dd,
               rnd() * 6.283, -Math.PI / 2 + R(-.5, .5), R(-.4, .4));
        }
        // aerial roots hanging from the crown to the ground
        for(let i = 0; i < 10; i++){
          const a = rnd() * 6.283, dd = R(tr * 1.6, rad * 1.3), len = cy * R(.5, .95);
          deco(new THREE.CylinderGeometry(.05, .08, len, 4), M.bark,
               cx + Math.cos(a) * dd, cy - len / 2, cz + Math.sin(a) * dd, 0, 0, 0, false);
        }
        for(let i = 0; i < 6; i++){
          const len = R(3, 6);
          deco(new THREE.PlaneGeometry(1.4, len), M.vine, cx + R(-rad, rad), cy - len / 2, cz + R(-rad, rad), rnd() * 6, 0, 0, false);
        }
        // Collision: the root mass as a knee-to-waist block across the
        // footprint (it reads as a tangle you go around), plus the trunk.
        solidBox(x0 + .3, z0 + .3, x1 - .3, z1 - .3, 0, 2.2);
        solidBox(cx - tr * 1.2, cz - tr * 1.2, cx + tr * 1.2, cz + tr * 1.2, 0, th);
        for(let i = 0; i < 4; i++) fern(cx + R(-rad - 1, rad + 1), cz + (rnd() < .5 ? -rad - .8 : rad + .8));
        break;
      }
      case 'colossus': stoneHead(x0, z0, x1, z1, h, Math.PI, .1); break;     // half-toppled, facing the court's entrances
    }
  }

  // Code-built brazier, used only when models are off (?models=0).
  function brazier(x, z, y){
    y = y || 0;
    deco(new THREE.CylinderGeometry(.34, .22, .7, 8), M.stone, x, y + .35, z);
    deco(new THREE.CylinderGeometry(.42, .34, .2, 8), M.stone, x, y + .78, z);
    makeFire(x, y + .82, z, .55);
  }

  // ── WEST COURT: RUINED WALLS ──────────────────────────────────────────────
  // No raised structure here: nothing in this court lifts a player off the
  // ground. The walls in O.solids ('wall') are head-height-plus, so they block
  // sight and bullets and are fought around, never climbed. One tree grows in
  // the corner behind them, tight enough to the walls that the gap is narrower
  // than a player rather than a slot to wedge into.
  // (the corner tree that stood here is gone: the stelae now fill that corner)

  // ── THE TUNNELS: ROOF ───────────────────────────────────────────────────────
  // The lane between the tunnel blocks is roofed over, which turns it into a
  // dark corridor lit by torches. The roof is solid to bullets but sits far
  // above head height, so nothing about movement changes.
  {
    const t = O.tunnel, w = t.x1 - t.x0, d = t.z1 - t.z0;
    addBox(w, .7, d, (t.x0+t.x1)/2, t.y, (t.z0+t.z1)/2, stoneMats(stoneTex, w, .7, d), true);
    // beams under the roof
    for(let z = t.z0 + 1.5; z < t.z1; z += 3)
      deco(new THREE.BoxGeometry(w, .45, .5), M.stone, (t.x0+t.x1)/2, t.y - .22, z, 0, 0, 0, false);
    // torches on the walls
    for(const [x, z] of [[38.5, 20.25], [43.5, 20.25], [40.5, 25.75], [44.2, 25.75]]){
      deco(new THREE.CylinderGeometry(.06, .05, .7, 6), M.wood, x, 2.3, z, 0, 0, 0, false);
      deco(new THREE.CylinderGeometry(.13, .07, .16, 8), M.dark, x, 2.68, z, 0, 0, 0, false);
      makeFire(x, 2.72, z, .34);
    }
    // one warm light for the whole tunnel, driven by a0-loop's interior-light
    // logic (only lit while you are inside)
    const light = new THREE.PointLight(0xffa24a, 0, 18, 1.6);
    light.position.set(40.5, 3.2, 23); light.visible = false; scene.add(light);
    interiorLights.push({ light, cx: 40.5, cz: 23, radius: 6 });
    // hanging roots through cracks in the roof
    for(let i = 0; i < 10; i++){
      const len = R(1.2, 2.6);
      deco(new THREE.PlaneGeometry(.8, len), M.vine, R(t.x0 + 1, t.x1 - 1), t.y - len/2, R(t.z0 + 1, t.z1 - 1), rnd()*6, 0, 0, false);
    }
  }

  // ── BRAZIERS ─────────────────────────────────────────────────────────────
  for(const [x0, z0, x1, z1] of O.braziers){
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if(useModels){
      const h = model('ogBrazier', x0, z0, x1, z1, ((rnd() * 4) | 0) * 90);
      solidBox(x0, z0, x1, z1, 0, h);
      makeFire(cx, h * .78, cz, (x1 - x0) * .85);     // sits down inside the bowl
    } else {
      solidBox(x0, z0, x1, z1, 0, .9);
      brazier(cx, cz, 0);
    }
  }

  // ── LOW COVER ─────────────────────────────────────────────────────────────
  // (built after the scale pass at the end of this function)

  // ── THE JUNGLE BEYOND THE WALLS ───────────────────────────────────────────
  // A ring of big trees so the horizon is canopy, not sky.
  for(let i = 0; i < 70; i++){
    const a = (i / 70) * 6.283 + R(-.04, .04);
    // a SQUARE ring, following the wall. A circle of radius 54 cuts inside
    // the square playfield at the corners (54 * 0.707 = 38), which put trees,
    // with no collision, inside both corner spawns.
    const r = R(54, 66), c = Math.cos(a), sn = Math.sin(a), k = r / Math.max(Math.abs(c), Math.abs(sn));
    tree(c * k, sn * k, 0, R(1.3, 1.9));
  }
  for(let i = 0; i < 30; i++){
    const a = rnd() * 6.283, r = R(72, 95);
    tree(Math.cos(a) * r, Math.sin(a) * r, 0, R(1.6, 2.2));
  }
  // trees whose canopies lean in over the wall
  for(const [x, z] of [[-50.5,-30],[-50.5,20],[50.5,-5],[50.5,30],[-20,50.5],[25,50.5],[-30,-50.5],[10,-50.5]]){
    tree(x, z, 0, 1.25);
  }

  // Ferns along the inside foot of the perimeter wall
  for(let i = 0; i < 120; i++){
    const s = R(-44, 44), side = (rnd() * 4) | 0;
    const x = side === 0 ? -44.3 : side === 1 ? 44.3 : s;
    const z = side === 2 ? -44.3 : side === 3 ? 44.3 : s;
    fern(x, z);
  }
  // ...and scattered through the open ground, never on a route's centreline
  for(let i = 0; i < 90; i++){
    const x = R(-44, 44), z = R(-44, 44);
    fern(x, z);
  }

  // (fires animate in fireLoop and opt out of the static merge via userData.dynamic)

  // ── SCALE PASS ────────────────────────────────────────────────────────────
  // Re-parent everything this build added to the scene into one group scaled
  // by S. Meshes keep their own static matrices; the group supplies the
  // scale, and the static-merge pass in c0-boot reads matrixWorld, so it
  // bakes the scale in. Collision boxes and walkable surfaces are scaled
  // to match.
  {
    const grp = new THREE.Group();
    grp.scale.setScalar(S);
    const added = scene.children.slice(_sc0);
    for(const o of added){ scene.remove(o); grp.add(o); }
    grp.updateMatrixWorld(true);
    scene.add(grp);
    for(let i = _ob0; i < obstacles.length; i++){ obstacles[i].min.multiplyScalar(S); obstacles[i].max.multiplyScalar(S); }
    for(let i = _pl0; i < platforms.length; i++){
      const p = platforms[i]; p.x0 *= S; p.x1 *= S; p.z0 *= S; p.z1 *= S; p.top *= S;
    }
    for(let i = _il0; i < interiorLights.length; i++){
      const il = interiorLights[i]; il.cx *= S; il.cz *= S; il.radius *= S;
      if(il.light.distance) il.light.distance *= S;
    }
  }

  // fires were built in design units inside the scaled group: note where
  // they ended up in the world, for billboarding and the shared light
  for(const fx of fireFX){ fx.root.updateWorldMatrix(true, false); fx.root.getWorldPosition(fx.world); }
  if(fireFX.length && !fireLight){
    fireLight = new THREE.PointLight(0xff8a3c, 0, 14, 1.8);
    fireLight.castShadow = false;
    scene.add(fireLight);      // never hidden: toggling visibility recompiles shaders
  }

  // ── LOW COVER (after scaling) ─────────────────────────────────────────────
  // Footprints scale with the map; HEIGHT does not. Scaled, waist-high cover
  // would stand about 1.7 tall, eye level, and nobody could shoot over it.
  O.low.forEach(([x0, z0, x1, z1], i) => {
    const kinds = ['block', 'drum'];   // no wooden crates: they read as palace props, not jungle ruins
    lowCover(x0 * S, z0 * S, x1 * S, z1 * S, kinds[i % 2]);
  });

  console.log('OVERGROWTH built —', O.solids.length + O.walls.length, 'structures,', O.low.length, 'cover pieces, scale', S.toFixed(2));
  const sp = {};
  for(const k in O.spawns){
    const z = O.spawns[k];
    sp[k] = { x0: z.x0 * S, x1: z.x1 * S, z0: z.z0 * S, z1: z.z1 * S, yaw: z.yaw };
  }
  return sp;
}

// ════════════════════════════════════════════════════════════════════════════
//  FIRE
//  Built entirely in code. Each fire is:
//    flame   a camera-facing (around Y) quad with a noise shader: two layers of
//            fractal noise scroll upward at different speeds, carving ragged
//            tongues out of a teardrop that narrows with height. Colour comes
//            from a temperature ramp: white-hot at the base centre, then yellow,
//            orange, and deep red at the tips. Additive, no depth write.
//    core    a second, smaller and faster flame inside the first, for depth
//    glow    an additive radial sprite that breathes with the flame
//    smoke   a soft dark noise wisp rising above, normal blending
//    embers  a handful of sparks that rise, drift and wink out
//  plus ONE shared point light that moves to whichever fire is nearest the
//  camera and flickers. A light per fire would multiply the lighting cost of
//  every surface on the map; the nearest fire is the only one whose light
//  you can actually read on the stone.
// ════════════════════════════════════════════════════════════════════════════
const fireFX = [];
let fireLight = null;

const _FIRE_NOISE = `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x),
               mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0., a = .5;
    for(int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= .5; }
    return v;
  }`;
const _FIRE_VERT = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const _FLAME_FRAG = `
  uniform float uTime, uSeed, uSpeed, uHeat;
  varying vec2 vUv;
  ${_FIRE_NOISE}
  void main(){
    float t = uTime * uSpeed;
    vec2 q = vec2(vUv.x - .5, vUv.y);
    // domain warp: noise displaced by noise, scrolled upward. This is what
    // twists the flame into separate licking tongues instead of a blob.
    vec2 p = vec2(q.x * 3.4 + uSeed, q.y * 2.3 - t * 2.6);
    vec2 w = vec2(fbm(p + vec2(0., t * .4)), fbm(p + vec2(5.2, 1.3) - vec2(0., t * .3)));
    float n = fbm(p + 1.9 * w);
    // gentle whole-flame sway from a slow breeze
    q.x += (noise(vec2(t * .7 + uSeed, 7.)) - .5) * .16 * q.y * q.y;
    // teardrop field, narrowing with height, eaten away from the top by noise
    float shape = length(vec2(q.x * (2.2 + q.y * 3.4), (q.y - .06) * 1.5));
    float c = 1. - 2.4 * max(0., shape - n * max(0., q.y + .2) * 1.15);
    c = clamp(c, 0., 1.);
    c *= smoothstep(.0, .07, q.y) * (1. - smoothstep(.82, 1., q.y));
    float temp = c * c * (1.25 - q.y * .9) * uHeat;
    vec3 col = mix(vec3(.38, .04, .01), vec3(.95, .26, .03), smoothstep(.02, .30, temp));
    col = mix(col, vec3(1., .55, .10), smoothstep(.30, .62, temp));
    col = mix(col, vec3(1., .82, .44), smoothstep(.62, .92, temp));
    col = mix(col, vec3(1., .96, .86), smoothstep(.92, 1.15, temp));
    float a = smoothstep(.0, .35, c);
    gl_FragColor = vec4(col * a * 1.5, a);
  }`;
const _SMOKE_FRAG = `
  uniform float uTime, uSeed, uNear;
  varying vec2 vUv;
  ${_FIRE_NOISE}
  void main(){
    vec2 uv = vUv; float t = uTime;
    float n = fbm(vec2(uv.x * 2.5 + uSeed + sin(t * .3) * .3, uv.y * 2. - t * .55));
    float width = mix(.12, .45, uv.y);
    float body = 1. - smoothstep(0., width, abs(uv.x - .5 + (n - .5) * .35 * uv.y));
    float a = body * smoothstep(.0, .25, uv.y) * (1. - smoothstep(.45, 1., uv.y)) * smoothstep(.35, .75, n) * .2 * uNear;
    gl_FragColor = vec4(vec3(.16, .15, .14), a);
  }`;

let _glowTex = null;
function _fireGlowTex(){
  if(_glowTex) return _glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,200,120,1)'); r.addColorStop(.25, 'rgba(255,130,40,.55)');
  r.addColorStop(.6, 'rgba(200,60,10,.12)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}

function _flameMat(seed, speed, heat){
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uSpeed: { value: speed }, uHeat: { value: heat } },
    vertexShader: _FIRE_VERT, fragmentShader: _FLAME_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// A fire whose base sits at (x, y, z), `size` wide. Built into the scene in
// whatever units the caller is using (Overgrowth builds in design units and
// scales the whole group afterwards).
function makeFire(x, y, z, size){
  const root = new THREE.Group();
  root.position.set(x, y, z);
  const seed = Math.random() * 50;
  const bill = new THREE.Group();          // turned to face the camera each frame
  root.add(bill);

  const outer = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 1.9), _flameMat(seed, 1, 1));
  outer.position.y = size * .95 - size * .05;
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(size * .62, size * 1.1), _flameMat(seed + 13.7, 1.5, 1.15));
  inner.position.set(0, size * .6 - size * .04, .01);
  const smoke = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.2, size * 3.0), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uNear: { value: 1 } },
    vertexShader: _FIRE_VERT, fragmentShader: _SMOKE_FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  smoke.position.y = size * 1.4 + size * 1.7;
  // a third flame turned 90 degrees and offset in time, so the fire has body
  // and keeps shifting shape rather than reading as one painted card
  const side = new THREE.Mesh(new THREE.PlaneGeometry(size * .85, size * 1.6), _flameMat(seed + 31.3, .85, .95));
  side.position.y = size * .8 - size * .05; side.rotation.y = Math.PI / 2;
  for(const m of [outer, inner, side, smoke]){ m.renderOrder = 3; m.frustumCulled = false; bill.add(m); }
  smoke.renderOrder = 2;

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: _fireGlowTex(), color: 0xffffff, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: .55 }));
  glow.scale.set(size * 3.2, size * 3.2, 1);
  glow.position.y = size * .55;
  root.add(glow);

  // embers
  const N = 14, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const life = new Float32Array(N), vel = new Float32Array(N * 3);
  const respawn = i => {
    pos[i*3] = (Math.random() - .5) * size * .4; pos[i*3+1] = Math.random() * size * .5; pos[i*3+2] = (Math.random() - .5) * size * .4;
    vel[i*3] = (Math.random() - .5) * size * .5; vel[i*3+1] = size * (1.2 + Math.random() * 1.6); vel[i*3+2] = (Math.random() - .5) * size * .5;
    life[i] = Math.random();
  };
  for(let i = 0; i < N; i++) respawn(i);
  const eg = new THREE.BufferGeometry();
  eg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  eg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const embers = new THREE.Points(eg, new THREE.PointsMaterial({
    size: Math.max(.04, size * .08), vertexColors: true, transparent: true, depthWrite: false,
    map: _fireGlowTex(), alphaTest: .01, blending: THREE.AdditiveBlending }));   // round, soft sparks
  embers.frustumCulled = false;
  root.add(embers);

  for(const o of [root, bill, outer, inner, side, smoke, glow, embers]) o.userData.dynamic = true;
  scene.add(root);
  fireFX.push({ root, bill, smokeMat: smoke.material, mats: [outer.material, inner.material, side.material, smoke.material], glow, embers,
                pos, col, life, vel, respawn, size, seed, world: new THREE.Vector3() });
}

(function fireLoop(){
  requestAnimationFrame(fireLoop);
  if(!fireFX.length) return;
  const now = performance.now() / 1000;
  const dt = Math.min(.05, now - (fireLoop.last || now)); fireLoop.last = now;
  const cam = (typeof camera !== 'undefined') ? camera.position : null;
  let near = null, nearD = Infinity;
  for(const fx of fireFX){
    for(const m of fx.mats) m.uniforms.uTime.value = now + fx.seed;
    if(cam){
      fx.bill.rotation.y = Math.atan2(cam.x - fx.world.x, cam.z - fx.world.z);
      const dx = cam.x - fx.world.x, dz = cam.z - fx.world.z, d2 = dx*dx + dz*dz;
      if(d2 < nearD){ nearD = d2; near = fx; }
      // smoke is a flat card: fade it out up close, where you would see that
      fx.smokeMat.uniforms.uNear.value = Math.min(1, Math.max(0, (Math.sqrt(d2) - 2) / 5));
    }
    const fl = .8 + Math.sin(now * 11 + fx.seed) * .08 + Math.sin(now * 23.7 + fx.seed * 2) * .06 + Math.sin(now * 5.3 + fx.seed) * .06;
    fx.glow.material.opacity = .42 * fl;
    const gs = fx.size * 3.2 * (.92 + fl * .1);
    fx.glow.scale.set(gs, gs, 1);
    // embers: rise, drift, wink out, respawn at the base
    const { pos, col, life, vel } = fx;
    for(let i = 0; i < life.length; i++){
      life[i] += dt * .7;
      if(life[i] >= 1){ fx.respawn(i); life[i] = 0; }
      pos[i*3]   += (vel[i*3] + Math.sin(now * 3 + i) * fx.size * .3) * dt;
      pos[i*3+1] += vel[i*3+1] * dt;
      pos[i*3+2] += vel[i*3+2] * dt;
      const k = (1 - life[i]) * (life[i] < .1 ? life[i] * 10 : 1);
      col[i*3] = k; col[i*3+1] = k * .45; col[i*3+2] = k * .08;
    }
    fx.embers.geometry.attributes.position.needsUpdate = true;
    fx.embers.geometry.attributes.color.needsUpdate = true;
  }
  if(fireLight && near){
    const d = Math.sqrt(nearD);
    fireLight.position.set(near.world.x, near.world.y + near.size * 1.2, near.world.z);
    const fl = .78 + Math.sin(now * 13.1) * .1 + Math.sin(now * 29.3) * .07 + Math.sin(now * 4.7) * .05;
    fireLight.intensity = d < 30 ? 3.2 * fl * Math.min(1, (30 - d) / 8) : 0;
  }
})();
