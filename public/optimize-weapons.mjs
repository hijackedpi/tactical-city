#!/usr/bin/env node
/**
 * optimize-weapons.mjs — make Meshy weapon exports usable in a browser.
 *
 *   node optimize-weapons.mjs <folder> [outFolder] [--tris=12000] [--tex=1024]
 *
 * Meshy GLBs are huge for two separate reasons, and you have to fix both:
 *
 *   1. TEXTURES. A 4096x4096 PNG base-colour map is ~20 MB on its own. This is
 *      usually 90%+ of the file. Resizing to 1024 and re-encoding as WebP is
 *      typically a 40-60x saving, and on a gun held 30 cm from the camera you
 *      genuinely cannot see the difference.
 *
 *   2. GEOMETRY. Photogrammetry-style output is often 200k+ triangles for a
 *      prop that needs 10k. Welding then simplifying fixes that.
 *
 * Install once:
 *   npm install @gltf-transform/core @gltf-transform/extensions \
 *               @gltf-transform/functions meshoptimizer sharp
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld, dedup, prune, textureCompress, resample } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const inDir  = args.find(a => !a.startsWith('--')) || '.';
const outDir = args.filter(a => !a.startsWith('--'))[1] || path.join(inDir, 'optimized');
const TRIS   = parseInt((args.find(a => a.startsWith('--tris=')) || '--tris=12000').split('=')[1]);
const TEX    = parseInt((args.find(a => a.startsWith('--tex='))  || '--tex=1024').split('=')[1]);

fs.mkdirSync(outDir, { recursive: true });

const stats = (doc) => {
  let tris = 0;
  for(const m of doc.getRoot().listMeshes())
    for(const p of m.listPrimitives()){
      const i = p.getIndices(), pos = p.getAttribute('POSITION');
      tris += (i ? i.getCount() : (pos ? pos.getCount() : 0)) / 3;
    }
  let texBytes = 0, texList = [];
  for(const t of doc.getRoot().listTextures()){
    const img = t.getImage();
    texBytes += img ? img.byteLength : 0;
    texList.push(t.getSize() ? t.getSize().join('x') : '?');
  }
  return { tris: Math.round(tris), texBytes, texCount: texList.length, texList };
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;

const files = fs.readdirSync(inDir).filter(f => f.toLowerCase().endsWith('.glb'));
if(!files.length){ console.error('no .glb files in ' + inDir); process.exit(1); }

console.log(`\noptimising ${files.length} file(s)  ->  ${outDir}`);
console.log(`target: ${TRIS.toLocaleString()} triangles, ${TEX}px textures, WebP\n`);
console.log('file'.padEnd(34) + 'before'.padStart(10) + 'after'.padStart(10) + '   saved   tris');
console.log('-'.repeat(78));

let totalBefore = 0, totalAfter = 0;
for(const f of files){
  const src = path.join(inDir, f);
  const beforeBytes = fs.statSync(src).size;
  totalBefore += beforeBytes;

  let doc;
  try { doc = await io.read(src); }
  catch(e){ console.log(f.slice(0,33).padEnd(34) + '  READ FAILED — ' + e.message.slice(0,30)); continue; }

  const s0 = stats(doc);
  const ratio = s0.tris > TRIS ? TRIS / s0.tris : 1;

  try {
    await doc.transform(
      dedup(),
      resample(),
      // Weld before simplifying: exporters frequently split every triangle,
      // and an unwelded mesh has no shared edges to collapse.
      weld({ tolerance: 0.0001 }),
      ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 })] : []),
      // This is the big one — textures usually dominate the file size.
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX], quality: 84 }),
      prune(),
    );
  } catch(e){
    console.log(f.slice(0,33).padEnd(34) + '  TRANSFORM FAILED — ' + e.message.slice(0,28));
    continue;
  }

  const s1 = stats(doc);
  const out = path.join(outDir, f.replace(/\.glb$/i, '') + '.glb');
  await io.write(out, doc);
  const afterBytes = fs.statSync(out).size;
  totalAfter += afterBytes;

  const mb = b => (b/1048576).toFixed(1) + 'MB';
  console.log(
    f.slice(0,33).padEnd(34) +
    mb(beforeBytes).padStart(10) +
    mb(afterBytes).padStart(10) +
    ('  ' + (100*(1-afterBytes/beforeBytes)).toFixed(0) + '%').padStart(9) +
    ('   ' + s0.tris.toLocaleString() + '->' + s1.tris.toLocaleString())
  );
}

console.log('-'.repeat(78));
console.log(
  'TOTAL'.padEnd(34) +
  ((totalBefore/1048576).toFixed(0)+'MB').padStart(10) +
  ((totalAfter/1048576).toFixed(0)+'MB').padStart(10) +
  ('  ' + (100*(1-totalAfter/totalBefore)).toFixed(0) + '%').padStart(9)
);
console.log('\nPoint the game at the files in ' + outDir + '\n');
