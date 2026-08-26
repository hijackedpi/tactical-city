#!/usr/bin/env node
/**
 * build.mjs — same job as build.py, for machines with Node but not Python.
 *
 *   node build.mjs             # writes index.bundle.html (a single self-contained file)
 *   node build.mjs out.html    # or somewhere else
 *
 * Concatenates src/*.js in filename order into the single module script in
 * src/index.template.html. Concatenation (rather than ES imports) keeps the
 * original shared scope, so variables like health, yaw and playerGun keep
 * working without any import/export plumbing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC  = path.join(HERE, 'src');
const OUT  = process.argv[2] || path.join(HERE, 'index.bundle.html');

const tplPath = path.join(SRC, 'index.template.html');
if(!fs.existsSync(tplPath)){
  console.error('missing src/index.template.html');
  process.exit(1);
}
const tpl = fs.readFileSync(tplPath, 'utf8');

const parts = fs.readdirSync(SRC).filter(f => f.endsWith('.js')).sort();
if(!parts.length){ console.error('no .js parts in src/'); process.exit(1); }

const chunks = [], report = [];
for(const f of parts){
  const text = fs.readFileSync(path.join(SRC, f), 'utf8');
  chunks.push(text);
  report.push([f, text.split('\n').length, text.length]);
}

if(!tpl.includes('/*__GAME_SOURCE__*/')){
  console.error('template has lost its /*__GAME_SOURCE__*/ marker');
  process.exit(1);
}
// The replacement MUST go through a function. With a string replacement,
// JavaScript interprets $-sequences specially, and the source contains
// "'$' + money" — the $' there means "everything after the match", which
// silently pastes the closing </script></body></html> into the middle of the
// code. Python's str.replace has no such behaviour, which is why build.py
// never hit this. A function replacement disables the substitution entirely.
const body = chunks.join('\n');
const html = tpl.replace('/*__GAME_SOURCE__*/', () => body);
fs.writeFileSync(OUT, html);

console.log(`built ${path.basename(OUT)} from ${parts.length} parts`);
for(const [f, nl, nc] of report)
  console.log(`   ${f.padEnd(20)} ${String(nl).padStart(5)} lines  ${(nc/1024).toFixed(1).padStart(7)} KB`);
console.log(`   ${''.padEnd(20)} ${''.padStart(5)}         ${(html.length/1024).toFixed(1).padStart(7)} KB output`);

// obvious-breakage check
const n = (html.match(/<script type="module">/g) || []).length;
if(n !== 1) console.log(`\n  WARNING: expected one module script, found ${n}`);
for(const needle of ['function animate(', 'animate(0);', 'DE_ALCAZAR'])
  if(!html.includes(needle)) console.log(`  WARNING: output is missing ${JSON.stringify(needle)}`);
