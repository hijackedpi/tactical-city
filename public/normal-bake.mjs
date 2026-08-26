#!/usr/bin/env node
/**
 * normal-bake.mjs — bake high-poly detail into a normal map on a low-poly mesh.
 *
 *   node normal-bake.mjs high.glb low.glb out.glb [--size=2048] [--cage=0.6]
 *
 * This is the step that lets 20k triangles look like 2M, and it is what CS2
 * and every other shipping game does.
 *
 * Meshy already gives you a normal map, but it only knows about the surface
 * detail of the mesh it generated. When you decimate 1.6M down to 20k you throw
 * away MID-frequency geometry — moulding profiles, arch surrounds, cornice
 * steps — and nothing in the existing texture compensates. That is why heavy
 * decimation looks melted.
 *
 * Baking fixes it: for every texel of the low-poly's UV space, find that point
 * in 3D, fire a ray along the low-poly normal, hit the high-poly, and record
 * which way the HIGH-poly was facing. Lighting reads that texture instead of
 * the geometry, so the flat mesh shades as though the detail were still there.
 *
 *   for each texel:  low surface point  --ray-->  high surface
 *                    write (high normal, in low tangent space)
 *
 * Install once:
 *   npm install @gltf-transform/core @gltf-transform/extensions sharp
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import fs from 'fs';

const args = process.argv.slice(2);
const files = args.filter(a => !a.startsWith('--'));
const num = (k,d) => { const a = args.find(x => x.startsWith('--'+k+'=')); return a ? +a.split('=')[1] : d; };
const SIZE = num('size', 2048);
const CAGE = num('cage', 0.6);        // how far to search along the normal

// Green-channel handedness. glTF and three.js expect OpenGL convention (+Y
// pointing up the texture); a bake that computes the bitangent the other way
// round produces normals that light backwards, and the error shows up as hard
// patches whose edges follow UV ISLAND boundaries. Pass --flipy=0 to disable.
const FLIP_Y = num('flipy', 1) !== 0;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// Batch mode. With no filenames, bake every .glb that exists in BOTH folders:
//
//   node normal-bake.mjs                      originals + lowpoly -> here
//   node normal-bake.mjs high.glb low.glb out.glb   just the one
const HIGH_DIR = 'originals', LOW_DIR = 'lowpoly';
let JOBS;
if(files.length >= 3){
  JOBS = [{ high: files[0], low: files[1], out: files[2] }];
} else {
  if(!fs.existsSync(HIGH_DIR) || !fs.existsSync(LOW_DIR)){
    console.error(`batch mode needs both ${HIGH_DIR}/ and ${LOW_DIR}/ folders`);
    console.error('or give three filenames: node normal-bake.mjs high.glb low.glb out.glb');
    process.exit(1);
  }
  JOBS = fs.readdirSync(HIGH_DIR)
    .filter(f => f.toLowerCase().endsWith('.glb') && fs.existsSync(`${LOW_DIR}/${f}`))
    .map(f => ({ high: `${HIGH_DIR}/${f}`, low: `${LOW_DIR}/${f}`, out: f }));
  if(!JOBS.length){ console.error('no matching .glb in both folders'); process.exit(1); }
  console.log(`batch: ${JOBS.length} model(s)\n`);
}

// ── pull every triangle out of a document, in world space ──────────────────
function readTriangles(doc){
  const tris = [];
  const mul = (m,v) => [
    m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],
    m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],
    m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14],
  ];
  const mmul = (a,b) => { const o = new Array(16).fill(0);
    for(let r=0;r<4;r++) for(let c=0;c<4;c++) for(let k=0;k<4;k++) o[c*4+r]+=a[k*4+r]*b[c*4+k];
    return o; };
  const I = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const walk = (node, parent) => {
    const m = mmul(parent, node.getMatrix());
    const mesh = node.getMesh();
    if(mesh) for(const p of mesh.listPrimitives()){
      const pos = p.getAttribute('POSITION'), nrm = p.getAttribute('NORMAL');
      const uv  = p.getAttribute('TEXCOORD_0'), idx = p.getIndices();
      if(!pos) continue;
      // indices live in a scalar accessor — read the raw array, because
      // getX is only defined on vector accessors
      // This gltf-transform build has no per-element accessors, so read every
      // attribute as a raw typed array and index into it by hand.
      const iarr = idx ? idx.getArray() : null;
      const parr = pos.getArray();
      const narr = nrm ? nrm.getArray() : null;
      const tarr = uv  ? uv.getArray()  : null;
      const n = iarr ? iarr.length : pos.getCount();
      for(let i=0;i<n;i+=3){
        const a = iarr?iarr[i]:i, b = iarr?iarr[i+1]:i+1, c = iarr?iarr[i+2]:i+2;
        const P = [a,b,c].map(k => mul(m, [parr[k*3], parr[k*3+1], parr[k*3+2]]));
        const N = narr ? [a,b,c].map(k => [narr[k*3], narr[k*3+1], narr[k*3+2]]) : null;
        const T = tarr ? [a,b,c].map(k => [tarr[k*2], tarr[k*2+1]]) : null;
        tris.push({ P, N, T });
      }
    }
    for(const ch of node.listChildren()) walk(ch, m);
  };
  for(const sc of doc.getRoot().listScenes()) for(const nd of sc.listChildren()) walk(nd, I);
  return tris;
}

// ── uniform grid over the high-poly, so rays do not test every triangle ────
function buildGrid(tris, cells = 64){
  const mn = [Infinity,Infinity,Infinity], mx = [-Infinity,-Infinity,-Infinity];
  for(const t of tris) for(const p of t.P) for(let k=0;k<3;k++){
    if(p[k]<mn[k]) mn[k]=p[k]; if(p[k]>mx[k]) mx[k]=p[k];
  }
  const size = [mx[0]-mn[0]||1, mx[1]-mn[1]||1, mx[2]-mn[2]||1];
  const step = size.map(s => s/cells);
  const bins = new Map();
  const key = (i,j,k) => (i*cells + j)*cells + k;
  tris.forEach((t, ti) => {
    const lo=[0,0,0], hi=[0,0,0];
    for(let k=0;k<3;k++){
      const a = Math.min(t.P[0][k],t.P[1][k],t.P[2][k]), b = Math.max(t.P[0][k],t.P[1][k],t.P[2][k]);
      lo[k] = Math.max(0, Math.floor((a-mn[k])/step[k]));
      hi[k] = Math.min(cells-1, Math.floor((b-mn[k])/step[k]));
    }
    for(let i=lo[0];i<=hi[0];i++) for(let j=lo[1];j<=hi[1];j++) for(let k=lo[2];k<=hi[2];k++){
      const kk = key(i,j,k); let arr = bins.get(kk);
      if(!arr){ arr=[]; bins.set(kk, arr); } arr.push(ti);
    }
  });
  return { mn, step, cells, bins, key };
}

function rayTri(o, d, t){
  const [a,b,c] = t.P;
  const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], e2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
  const h=[d[1]*e2[2]-d[2]*e2[1], d[2]*e2[0]-d[0]*e2[2], d[0]*e2[1]-d[1]*e2[0]];
  const det=e1[0]*h[0]+e1[1]*h[1]+e1[2]*h[2];
  if(Math.abs(det)<1e-12) return null;
  const inv=1/det, s=[o[0]-a[0],o[1]-a[1],o[2]-a[2]];
  const u=(s[0]*h[0]+s[1]*h[1]+s[2]*h[2])*inv;
  if(u<-1e-6||u>1+1e-6) return null;
  const q=[s[1]*e1[2]-s[2]*e1[1], s[2]*e1[0]-s[0]*e1[2], s[0]*e1[1]-s[1]*e1[0]];
  const v=(d[0]*q[0]+d[1]*q[1]+d[2]*q[2])*inv;
  if(v<-1e-6||u+v>1+1e-6) return null;
  const dist=(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*inv;
  return dist>1e-6 ? { dist, u, v } : null;
}

// walk the grid along the ray, nearest hit wins
function cast(grid, tris, o, d, maxD){
  let best = null;
  const steps = 96;
  const seen = new Set();
  for(let s=0;s<=steps;s++){
    const t = (s/steps)*maxD;
    const p = [o[0]+d[0]*t, o[1]+d[1]*t, o[2]+d[2]*t];
    const ci = [0,0,0];
    for(let k=0;k<3;k++) ci[k] = Math.max(0, Math.min(grid.cells-1,
      Math.floor((p[k]-grid.mn[k])/grid.step[k])));
    const arr = grid.bins.get(grid.key(ci[0],ci[1],ci[2]));
    if(!arr) continue;
    for(const ti of arr){
      if(seen.has(ti)) continue; seen.add(ti);
      const h = rayTri(o, d, tris[ti]);
      if(h && h.dist <= maxD && (!best || h.dist < best.dist)) best = { ...h, ti };
    }
  }
  return best;
}

const norm = v => { const l = Math.hypot(v[0],v[1],v[2])||1; return [v[0]/l,v[1]/l,v[2]/l]; };
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

for(const job of JOBS){
  console.log(`\n── ${job.out.slice(0,50)}`);
  console.log('  reading meshes...');
  const highTris = readTriangles(await io.read(job.high));
  const lowDoc   = await io.read(job.low);
  const lowTris  = readTriangles(lowDoc);
  console.log(`  high ${highTris.length.toLocaleString()} triangles`);
  console.log(`  low  ${lowTris.length.toLocaleString()} triangles`);
  if(!lowTris.length || !lowTris[0].T){ console.warn('  skipped: low-poly has no UVs'); continue; }

  console.log('building spatial grid...');
  const grid = buildGrid(highTris);

  // ── rasterise the low-poly in UV space, bake a normal per texel ────────────
  console.log(`baking ${SIZE}x${SIZE}...`);
  const out = Buffer.alloc(SIZE*SIZE*3);
  for(let i=0;i<out.length;i+=3){ out[i]=128; out[i+1]=128; out[i+2]=255; }   // flat
  let hits = 0, texels = 0;

  for(const t of lowTris){
    if(!t.T || !t.N) continue;
    const uv = t.T.map(([u,v]) => [u*SIZE, (1-v)*SIZE]);
    const minX = Math.max(0, Math.floor(Math.min(...uv.map(p=>p[0]))));
    const maxX = Math.min(SIZE-1, Math.ceil(Math.max(...uv.map(p=>p[0]))));
    const minY = Math.max(0, Math.floor(Math.min(...uv.map(p=>p[1]))));
    const maxY = Math.min(SIZE-1, Math.ceil(Math.max(...uv.map(p=>p[1]))));
    const area = (uv[1][0]-uv[0][0])*(uv[2][1]-uv[0][1]) - (uv[2][0]-uv[0][0])*(uv[1][1]-uv[0][1]);
    if(Math.abs(area) < 1e-9) continue;

    // tangent frame from the UV mapping — the normal map is stored in this space
    const e1 = [t.P[1][0]-t.P[0][0], t.P[1][1]-t.P[0][1], t.P[1][2]-t.P[0][2]];
    const e2 = [t.P[2][0]-t.P[0][0], t.P[2][1]-t.P[0][1], t.P[2][2]-t.P[0][2]];
    const du1 = t.T[1][0]-t.T[0][0], dv1 = t.T[1][1]-t.T[0][1];
    const du2 = t.T[2][0]-t.T[0][0], dv2 = t.T[2][1]-t.T[0][1];
    const r = 1/((du1*dv2 - du2*dv1) || 1e-9);
    const tan = norm([(e1[0]*dv2-e2[0]*dv1)*r, (e1[1]*dv2-e2[1]*dv1)*r, (e1[2]*dv2-e2[2]*dv1)*r]);

    for(let py=minY; py<=maxY; py++){
      for(let px=minX; px<=maxX; px++){
        const x = px+0.5, y = py+0.5;
        const w0 = ((uv[1][0]-x)*(uv[2][1]-y) - (uv[2][0]-x)*(uv[1][1]-y)) / area;
        const w1 = ((uv[2][0]-x)*(uv[0][1]-y) - (uv[0][0]-x)*(uv[2][1]-y)) / area;
        const w2 = 1-w0-w1;
        if(w0<-0.002||w1<-0.002||w2<-0.002) continue;
        texels++;

        const P = [0,1,2].map(k => w0*t.P[0][k] + w1*t.P[1][k] + w2*t.P[2][k]);
        const N = norm([0,1,2].map(k => w0*t.N[0][k] + w1*t.N[1][k] + w2*t.N[2][k]));

        // search outward then inward along the normal — a cage in both directions
        const from = [P[0]+N[0]*CAGE, P[1]+N[1]*CAGE, P[2]+N[2]*CAGE];
        const dir  = [-N[0], -N[1], -N[2]];
        const hit = cast(grid, highTris, from, dir, CAGE*2);
        if(!hit) continue;

        const ht = highTris[hit.ti];
        let hn;
        if(ht.N){
          const a = 1-hit.u-hit.v;
          hn = norm([0,1,2].map(k => a*ht.N[0][k] + hit.u*ht.N[1][k] + hit.v*ht.N[2][k]));
        } else {
          hn = norm(cross(
            [ht.P[1][0]-ht.P[0][0], ht.P[1][1]-ht.P[0][1], ht.P[1][2]-ht.P[0][2]],
            [ht.P[2][0]-ht.P[0][0], ht.P[2][1]-ht.P[0][1], ht.P[2][2]-ht.P[0][2]]));
        }
        hits++;

        // into the low-poly's tangent space
        const T = norm([tan[0]-N[0]*dot(N,tan), tan[1]-N[1]*dot(N,tan), tan[2]-N[2]*dot(N,tan)]);
        // Bitangent handedness follows the sign of the UV determinant, not a
        // fixed cross product. Mirrored UV islands flip that sign, which is
        // exactly why the artefacts traced island boundaries.
        const hand = ((du1*dv2 - du2*dv1) < 0) ? -1 : 1;
        const Bx = cross(N, T);
        const B = [Bx[0]*hand, Bx[1]*hand, Bx[2]*hand];
        let ty = dot(hn, B);
        if(FLIP_Y) ty = -ty;
        const tn = norm([dot(hn,T), ty, dot(hn,N)]);

        const o = (py*SIZE + px)*3;
        out[o]   = Math.max(0, Math.min(255, Math.round((tn[0]*0.5+0.5)*255)));
        out[o+1] = Math.max(0, Math.min(255, Math.round((tn[1]*0.5+0.5)*255)));
        out[o+2] = Math.max(0, Math.min(255, Math.round((tn[2]*0.5+0.5)*255)));
      }
    }
  }
  console.log(`  ${texels.toLocaleString()} texels covered, ${hits.toLocaleString()} hit the high-poly (${(100*hits/Math.max(1,texels)).toFixed(0)}%)`);

  const png = await sharp(out, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .png().toBuffer();

  // attach it to the low-poly, replacing whatever normal map was there
  // --keep leaves the original normal map alone, so a bad bake can be compared
  // against the untouched version without re-running the optimiser.
  if(args.includes('--keep')){
    console.log('  --keep: leaving the existing normal map in place');
  } else {
    const tex = lowDoc.createTexture('baked-normal').setImage(png).setMimeType('image/png');
    for(const mat of lowDoc.getRoot().listMaterials()) mat.setNormalTexture(tex);
  }
  await io.write(job.out, lowDoc);
  console.log(`wrote ${job.out}  (${(fs.statSync(job.out).size/1048576).toFixed(1)} MB)`);
}
