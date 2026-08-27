// ════════ SPATIAL-GRID STATIC MERGE (no visual / gameplay change) ════════
// Merges static opaque meshes into chunks bucketed BOTH by material look AND by
// a coarse world-space grid cell. Result: each merged mesh covers only a small
// region, so frustum culling still skips off-screen chunks (unlike a single
// map-spanning merge). You get few draw calls AND culling. Collision/LOS/bullets
// use obstacles[] (Box3s), untouched — gameplay identical.
(function optimizeFPS(){
  const CHUNK = 50;  // grid cell size in world units; smaller = better culling, more chunks

  // Drop invisible micro-shadows from tiny props.
  scene.traverse(o=>{
    if(o.isMesh && o.castShadow && o.geometry){
      o.geometry.computeBoundingSphere();
      const r = o.geometry.boundingSphere ? o.geometry.boundingSphere.radius : 1;
      if(r < 0.45) o.castShadow = false;
    }
  });

  const exclude = new Set([camera]);
  for(const c of cars) exclude.add(c.group);
  if(playerGun) exclude.add(playerGun);

  const _imgIds = new WeakMap();
  let _imgSeq = 0;
  function texKey(t){
    if(!t) return 'none';
    // .clone() copies the image reference, so image identity is stable across
    // clones where uuid is not. Repeat/wrap/offset still separate genuinely
    // different lookups of the same image.
    let id;
    if(t.image){
      id = _imgIds.get(t.image);
      if(id === undefined){ id = ++_imgSeq; _imgIds.set(t.image, id); }
      id = 'img' + id;
    } else {
      id = t.uuid || 't';
    }
    return id
      + ':' + (t.repeat ? t.repeat.x + 'x' + t.repeat.y : '')
      + ':' + (t.offset ? t.offset.x + ',' + t.offset.y : '')
      + ':' + (t.wrapS||0) + ',' + (t.wrapT||0)
      + ':' + (t.colorSpace || t.encoding || '');
  }
  function matKey(m){
    if(!m) return 'null';
    const col = m.color ? m.color.getHexString() : 'xxxxxx';
    const emi = m.emissive ? m.emissive.getHexString() : 'xxxxxx';
    return [
      m.type||'std', col, emi, texKey(m.map),
      m.roughness, m.metalness,
      m.transparent?1:0, (m.opacity==null?1:m.opacity),
      m.side||0, m.envMapIntensity==null?1:m.envMapIntensity,
      m.emissiveIntensity==null?0:m.emissiveIntensity
    ].join('|');
  }

  // Pull out just the triangles that belong to one material, remapped onto a
  // compact vertex buffer.
  //
  // This is the fix for a 6x geometry bug. The old loop cloned the WHOLE
  // geometry once per material slot, never slicing out the group that slot
  // owns. Every box from addBox() carries a six-entry material array from
  // sides(), so every wall, stair and merlon was merged as six coincident
  // copies of itself — six times the triangles, six times the overdraw, and
  // z-fighting wherever two copies landed on the same plane.
  function sliceByMaterial(geo, matIndices, matrix){
    const pos = geo.attributes.position;
    if(!pos) return null;
    const nor = geo.attributes.normal, uv = geo.attributes.uv, src = geo.index;
    const want = new Set(matIndices);

    const list = [];
    if(geo.groups && geo.groups.length){
      for(const gr of geo.groups){
        if(!want.has(gr.materialIndex || 0)) continue;
        for(let i = gr.start; i < gr.start + gr.count; i++) list.push(src ? src.getX(i) : i);
      }
    } else {
      const n = src ? src.count : pos.count;
      for(let i = 0; i < n; i++) list.push(src ? src.getX(i) : i);
    }
    if(!list.length) return null;

    const seen = new Map(), P = [], N = [], U = [], I = [];
    for(const vi of list){
      let ni = seen.get(vi);
      if(ni === undefined){
        ni = seen.size; seen.set(vi, ni);
        P.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
        if(nor) N.push(nor.getX(vi), nor.getY(vi), nor.getZ(vi));
        if(uv)  U.push(uv.getX(vi),  uv.getY(vi));
      }
      I.push(ni);
    }

    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    if(nor) out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    if(uv)  out.setAttribute('uv',     new THREE.Float32BufferAttribute(U, 2));
    out.setIndex(I);
    out.applyMatrix4(matrix);
    if(!nor) out.computeVertexNormals();
    if(!uv)  out.setAttribute('uv',
      new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
    return out;
  }

  const _v = new THREE.Vector3();
  const buckets = new Map();    // key -> { geos:[], cast, recv }
  const matForKey = new Map();
  const toRemove = [];

  scene.traverse(o=>{
    if(!o.isMesh || o.isLight || o.isCamera) return;
    if(exclude.has(o)) return;
    let p = o.parent, skip = false;
    while(p){ if(exclude.has(p)){ skip = true; break; } p = p.parent; }
    if(skip) return;
    if(!o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if(mats.some(m => m && m.transparent)) return;

    o.updateWorldMatrix(true, false);
    // World position of this mesh -> grid cell.
    _v.setFromMatrixPosition(o.matrixWorld);
    const cx = Math.floor(_v.x / CHUNK);
    const cz = Math.floor(_v.z / CHUNK);
    const cellPrefix = cx + ',' + cz + '|';

    // sides() returns each material TWICE — [A,A,B,B,C,C] — so slots must be
    // gathered by material identity first, or the same triangles would be
    // emitted into the same bucket twice over.
    const slotsByMat = new Map();
    for(let gi = 0; gi < mats.length; gi++){
      const mat = mats[gi];
      if(!mat) continue;
      let arr = slotsByMat.get(mat);
      if(!arr){ arr = []; slotsByMat.set(mat, arr); }
      arr.push(gi);
    }

    for(const [mat, slots] of slotsByMat){
      const clean = sliceByMaterial(o.geometry, slots, o.matrixWorld);
      if(!clean) continue;
      const key = cellPrefix + matKey(mat);
      let rec = buckets.get(key);
      if(!rec){ rec = { geos:[], cast:false, recv:false }; buckets.set(key, rec); matForKey.set(key, mat); }
      rec.geos.push(clean);
      rec.cast = rec.cast || o.castShadow;
      rec.recv = rec.recv || o.receiveShadow;
    }
    toRemove.push(o);
  });

  for(const o of toRemove){ if(o.parent) o.parent.remove(o); }

  let chunkCount = 0, fallbackCount = 0;
  for(const [key, rec] of buckets){
    if(!rec.geos.length) continue;
    const mat = matForKey.get(key);
    let merged = null;
    // mergeGeometries needs a bucket to be uniformly indexed or not. Normalise
    // first, then fall back to flattening if the indexed merge is rejected.
    const anyIndexed = rec.geos.some(g => g.index);
    const allIndexed = rec.geos.every(g => g.index);
    if(anyIndexed && !allIndexed){
      for(let i=0;i<rec.geos.length;i++)
        if(rec.geos[i].index) rec.geos[i] = rec.geos[i].toNonIndexed();
    }
    try { merged = mergeGeometries(rec.geos, false); } catch(e){ merged = null; }
    if(!merged && rec.geos.some(g => g.index)){
      try {
        const flat = rec.geos.map(g => g.index ? g.toNonIndexed() : g);
        merged = mergeGeometries(flat, false);
      } catch(e){ merged = null; }
    }
    try { if(!merged) merged = mergeGeometries(rec.geos, false); } catch(e){}
    if(!merged){
      fallbackCount++;
      for(const g of rec.geos){
        const m = new THREE.Mesh(g, mat);
        m.matrixAutoUpdate = false; m.updateMatrix();
        scene.add(m);
      }
      continue;
    }
    rec.geos.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = rec.cast;
    mesh.receiveShadow = rec.recv;
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    mesh.frustumCulled = true;   // each chunk is small -> off-screen ones are skipped
    scene.add(mesh);
    chunkCount++;
  }
  console.log('SPATIAL MERGE → chunks:', chunkCount, '| fell back:', fallbackCount);
})();

// 3) Reuse scratch vectors so the bullet loops stop allocating every frame.
//    These names shadow nothing; the loops below already declare prevPos/prev
//    with `const`, so we instead expose globals the loops can copy into.
window._pbPrev = window._pbPrev || new THREE.Vector3();
window._ebPrev = window._ebPrev || new THREE.Vector3();
// ═══════════════════════════════════════════════════════════════════════════
setTimeout(() => {
  let meshCount = 0, drawables = 0;
  scene.traverse(o => { if(o.isMesh){ meshCount++; if(o.visible) drawables++; } });
  console.log('TOTAL MESHES IN SCENE:', meshCount, '| visible:', drawables,
              '| scene.children:', scene.children.length);
}, 3000);
setTimeout(() => {
  let total=0, isMesh=0, hasGeo=0, transparent=0, inGroup=0, excluded=0, mergeable=0;
  const exclude = new Set([camera]);
  for(const c of cars) exclude.add(c.group);
  if(playerGun) exclude.add(playerGun);
  scene.traverse(o=>{
    if(!o.isMesh) return;
    total++;
    if(o.isLight||o.isCamera) return;
    if(exclude.has(o)){ excluded++; return; }
    let p=o.parent, skip=false, nested=false;
    while(p){ if(p!==scene) nested=true; if(exclude.has(p)){skip=true;break;} p=p.parent; }
    if(skip){ excluded++; return; }
    if(nested) inGroup++;
    if(!o.geometry||!o.geometry.attributes||!o.geometry.attributes.position){ return; }
    hasGeo++;
    const mats = Array.isArray(o.material)?o.material:[o.material];
    if(mats.some(m=>m&&m.transparent)){ transparent++; return; }
    mergeable++;
  });
  console.log('total meshes:',total,'| has geometry:',hasGeo,'| nested in a group:',inGroup,
              '| transparent (skipped):',transparent,'| excluded:',excluded,'| MERGEABLE:',mergeable);
}, 3000);
// BRUTE-FORCE DIAGNOSTIC — toggle these one at a time, reload, check FPS.
// window.addEventListener('keydown', e => {
//   if(e.code === 'Digit1'){ renderer.shadowMap.enabled = !renderer.shadowMap.enabled; scene.traverse(o=>{if(o.isMesh)o.material&&(o.material.needsUpdate=true);}); console.log('shadows:', renderer.shadowMap.enabled); }
//   if(e.code === 'Digit2'){ sun.visible = !sun.visible; console.log('sun light:', sun.visible); }
//   if(e.code === 'Digit3'){ scene.environment = scene.environment ? null : window._savedEnv; console.log('env map:', !!scene.environment); }
//   if(e.code === 'Digit4'){ renderer.setPixelRatio(renderer.getPixelRatio() > 0.6 ? 0.5 : 1); console.log('pixelRatio:', renderer.getPixelRatio()); }
//   if(e.code === 'Digit5'){ for(const il of interiorLights) il.light.visible = !il.light.visible; console.log('interior lights toggled'); }
// });
// window._savedEnv = scene.environment;