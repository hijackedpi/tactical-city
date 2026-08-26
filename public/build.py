#!/usr/bin/env python3
"""
build.py — assemble src/*.js into a single self-contained index.html

    python3 build.py            # writes index.bundle.html (a single self-contained file)
    python3 build.py out.html   # or somewhere else

The parts are concatenated in filename order, which is why they are numbered.
Concatenation (rather than ES module imports) keeps the original single scope,
so shared variables like `health`, `yaw` and `playerGun` continue to work
without any import/export plumbing — and the result still opens straight from
disk, with no server needed for the HTML itself.

Add a new part by dropping a numbered .js into src/. Order matters:
  00  imports        three.js — must be first
  10  config         tables and shared state
  20  scene          renderer, lights
  30  textures       procedural canvases
  40  map            level geometry
  50  weapons        models, loading, bullets
  60  actors         player body, enemy rig, broadphase
  70  hud            on-screen readouts
  80  audio          sound engine
  90  input          controls, armory
  a0  loop           the frame loop
  b0  menu           deploy screen and settings
  c0  boot           merge pass, diagnostics, start
"""
import os, sys, re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC  = os.path.join(HERE, 'src')
OUT  = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'index.bundle.html')

tpl_path = os.path.join(SRC, 'index.template.html')
if not os.path.exists(tpl_path):
    sys.exit('missing src/index.template.html')
tpl = open(tpl_path, encoding='utf-8').read()

parts = sorted(f for f in os.listdir(SRC) if f.endswith('.js'))
if not parts:
    sys.exit('no .js parts in src/')

chunks, report = [], []
for f in parts:
    text = open(os.path.join(SRC, f), encoding='utf-8').read()
    chunks.append(text)
    report.append((f, text.count('\n') + 1, len(text)))

body = '\n'.join(chunks)
if '/*__GAME_SOURCE__*/' not in tpl:
    sys.exit('template has lost its /*__GAME_SOURCE__*/ marker')
html = tpl.replace('/*__GAME_SOURCE__*/', body)
open(OUT, 'w', encoding='utf-8').write(html)

print(f'built {os.path.basename(OUT)} from {len(parts)} parts')
for f, nl, nc in report:
    print(f'   {f:20} {nl:5} lines  {nc/1024:7.1f} KB')
print(f'   {"":20} {"":5}         {len(html)/1024:7.1f} KB output')

# a quick structural sanity check so a broken build is obvious immediately
opens = html.count('<script type="module">')
if opens != 1:
    print(f'\n  WARNING: expected one module script, found {opens}')
for needle in ['function animate(', 'animate(0);', 'DE_ALCAZAR']:
    if needle not in html:
        print(f'  WARNING: output is missing {needle!r}')
