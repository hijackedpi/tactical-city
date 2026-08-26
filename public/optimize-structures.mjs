#!/usr/bin/env node
/**
 * optimize-structures.mjs — per-type budgets for the map's GLB structures.
 *
 *   node optimize-structures.mjs [folder] [outFolder]
 *
 * The weapon optimiser applies one budget to every file. Structures should not
 * work that way: a gateway you walk through deserves far more detail than a
 * crate you glance at, and a building repeated twenty times costs twenty times
 * whatever you give it.
 *
 * So the budget lives in the BUDGET table below, keyed the same way as
 * STRUCTURE_FILES in 40-map.js. Edit a number, re-run, done.
 *
 * `placed` is how many copies the map puts in the scene — the script uses it to
 * report the real cost, which is what actually matters. 100k on a model placed
 * twenty times is two million triangles.
 *
 * Install once:
 *   npm install @gltf-transform/core @gltf-transform/extensions \
 *               @gltf-transform/functions meshoptimizer sharp
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld, dedup, prune, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// ── the budget ─────────────────────────────────────────────────────────────
// match: a substring that identifies the file
// tris:  triangle ceiling for that model
// tex:   texture size
// placed: how many copies the map creates, for cost reporting
// Three detail levels per model, swapped by distance in game.
//
// Measured from the F3 panel: this GPU costs ~6.8 ms per million triangles and
// shading is nearly free — 1.78x the pixels changed the frame by 1%. So every
// frame you win has to come from geometry, and the cheapest geometry to give
// up is the geometry you cannot see properly anyway.
//
// near  is what you stand next to and judge the model by — keep it high
// mid   is across a street, where the silhouette matters and the carving does not
// far   is across the map, where it is a few hundred pixels tall
//
// With occlusion culling leaving ~25 buildings drawn, a typical mix of 3 near,
// 8 mid and 14 far comes to about 3.4M triangles — inside the 3.5M that this
// card needs for 60 fps, while the building in your face keeps its detail.
// 600k everywhere, with occlusion culling doing the work instead.
//
// Reduction is what melts these meshes — at 600k they look right, at 95k they
// come out shrink-wrapped, and that happens with Meshy's own remesher too. So
// the detail genuinely needs the triangles, and the frames have to come from
// somewhere else: not drawing the buildings you cannot see.
//
// All 37 drawing at 600k is 31M triangles, which is ~5 fps on this GPU.
// Culling was measured at roughly a quarter drawn, so expect nearer 8M and
// ~20 fps. Fewer, larger buildings is what closes the rest of that gap.
const BUDGET = [
  { key:'cornerBlock',    match:'Corner_block',   tris:600000, placed: 6 },
  { key:'facadeBlock',    match:'palace_facad',   tris:600000, placed: 8 },
  { key:'palaceExterior', match:'palace_exter',   tris:600000, placed: 7 },
  { key:'watchtower',     match:'palace_corne',   tris:600000, placed: 2 },
  { key:'bridge',         match:'stone_bridge',   tris:271000, placed: 6 },
  { key:'marketStall',    match:'market_stall',   tris:600000, placed: 8 },
];

// Per-slot texture sizes. The metallic-roughness map is the reason stone reads
// as wet plastic, so it is dropped and the material forced fully rough.
const TEX = {
  normal:    2048,
  baseColor: 2048,
  metalRough: null,
  emissive:   null,
};

// Per-slot texture sizes. Sizing every map the same is wasteful: your exports
// carry a 4096 metallic-roughness and a 4096 EMISSIVE on buildings that do not
// glow, which together are most of the download and most of the texture memory.

const args   = process.argv.slice(2);
const inDir  = args.find(a => !a.startsWith('--')) || '.';
const outDir = args.filter(a => !a.startsWith('--'))[1] || path.join(inDir, 'optimized');

function budgetFor(name){
  return BUDGET.find(b => name.includes(b.match)) || null;
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
fs.mkdirSync(outDir, { recursive: true });
await MeshoptSimplifier.ready;

const files = fs.readdirSync(inDir).filter(f => f.toLowerCase().endsWith('.glb'));
if(!files.length){ console.error('no .glb files in ' + inDir); process.exit(1); }

let sceneTris = 0, beforeMB = 0, afterMB = 0;
const rows = [];

for(const f of files){
  const b = budgetFor(f);
  if(!b){ console.log(`  skip  ${f}  (no budget entry)`); continue; }
  const src = path.join(inDir, f);
  const doc = await io.read(src);

  let tris = 0;
  for(const m of doc.getRoot().listMeshes())
    for(const pr of m.listPrimitives()){
      const i = pr.getIndices(), pos = pr.getAttribute('POSITION');
      tris += (i ? i.getCount() : (pos ? pos.getCount() : 0)) / 3;
    }
  const ratio = Math.min(1, b.tris / Math.max(1, tris));
  // A looser error is fine now: the normal map carries the surface detail, so
  // the mesh only has to hold the silhouette.

  await doc.transform(
    dedup(),
    // Weld before simplifying: exporters split vertices, and an unwelded mesh
    // has no shared edges to collapse — the simplifier tears it instead.
    weld({ tolerance: 0.0001 }),
    // A tight error bound. The default is looser and it shows: at these
    // reductions the difference between 0.001 and 0.01 is the difference
    // between crisp mouldings and melted ones.
    ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.001, lockBorder: true })] : []),
    // Each slot at its own size. Order matters: the more specific slot rules
    // run first, then a catch-all for anything unlisted.
    textureCompress({ encoder: sharp, targetFormat: 'webp',
                      slots: /normalTexture/, resize: [TEX.normal, TEX.normal] }),
    textureCompress({ encoder: sharp, targetFormat: 'webp',
                      slots: /baseColorTexture/, resize: [TEX.baseColor, TEX.baseColor] }),
    prune(),
  );

  // Sandstone is fully rough and not metallic. The exported metallic-roughness
  // map made every wall glossy, which reads as shrink-wrap once the surface is
  // even slightly smoothed.
  for(const mat of doc.getRoot().listMaterials()){
    if(TEX.metalRough === null && mat.getMetallicRoughnessTexture())
      mat.setMetallicRoughnessTexture(null);
    mat.setMetallicFactor(0);
    mat.setRoughnessFactor(1);
  }

  // Drop emissive outright. A stone wall does not glow, and at 4096 it was one
  // of the two biggest textures in every file.
  if(TEX.emissive === null)
    for(const mat of doc.getRoot().listMaterials()){
      if(mat.getEmissiveTexture()) mat.setEmissiveTexture(null);
      mat.setEmissiveFactor([0, 0, 0]);
    }
  await doc.transform(prune());

  let after = 0;
  for(const m of doc.getRoot().listMeshes())
    for(const pr of m.listPrimitives()){
      const i = pr.getIndices(), pos = pr.getAttribute('POSITION');
      after += (i ? i.getCount() : (pos ? pos.getCount() : 0)) / 3;
    }

  const dst = path.join(outDir, f);
  await io.write(dst, doc);
  const inMB = fs.statSync(src).size/1048576, outMB = fs.statSync(dst).size/1048576;
  beforeMB += inMB; afterMB += outMB;
  sceneTris += after * b.placed;
  rows.push([b.key, Math.round(tris), Math.round(after), b.placed, Math.round(after*b.placed), inMB, outMB]);
}

console.log('\n' + 'model'.padEnd(16) + 'before'.padStart(10) + 'after'.padStart(10) +
            'placed'.padStart(8) + 'in scene'.padStart(11) + 'MB'.padStart(10));
console.log('-'.repeat(66));
for(const [k, before, after, placed, scene, inMB, outMB] of rows)
  console.log(k.padEnd(16) + before.toLocaleString().padStart(10) + after.toLocaleString().padStart(10) +
              String(placed).padStart(8) + scene.toLocaleString().padStart(11) +
              `  ${inMB.toFixed(0)}->${outMB.toFixed(1)}`.padStart(10));
console.log('-'.repeat(66));
console.log(`${'TOTAL IN SCENE'.padEnd(16)}${(sceneTris/1e6).toFixed(2)}M triangles`);
console.log(`${'DOWNLOAD'.padEnd(16)}${beforeMB.toFixed(0)} MB -> ${afterMB.toFixed(1)} MB`);
const geoMB = (sceneTris*0.6*32 + sceneTris*3*4) / 1048576;
console.log(`${'GPU GEOMETRY'.padEnd(16)}~${geoMB.toFixed(0)} MB`);
// everything draws, so the scene total IS what is in frame
const ms = 6.79*sceneTris/1e6 - 7.3;
console.log(`\n${'IN FRAME'.padEnd(16)}${(sceneTris/1e6).toFixed(2)}M triangles (all of them — no culling)`);
console.log(`${'ESTIMATED'.padEnd(16)}${ms.toFixed(0)} ms  ~${Math.round(1000/ms)} fps on this GPU`);
