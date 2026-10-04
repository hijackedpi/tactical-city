# Tactical City

A two-sided palace map. Drop this whole folder into your `public/`, add the
`.glb` models, and open `index.html`.

```
public/
  index.html            the built game — open this
  build.py / build.mjs  rebuild index.html after editing src/
  split.py              re-derive src/ from index.html (rarely needed)
  src/                  the source, in 13 parts
  *.glb                 your models — see below
```

## Add your models

The game looks for these exact filenames, alongside `index.html`. Eleven are
needed; the twelfth is optional.

| weapon | file |
|---|---|
| knife | `Meshy_AI_knife_0728051812_texture.glb` |
| glock18 | `Meshy_AI_glock18_0728051932_texture.glb` |
| deagle | `Meshy_AI_dessert_eagle_0728051900_texture.glb` |
| mac10 | `Meshy_AI_mac10_0728051853_texture.glb` |
| mp5 | `Meshy_AI_mp5_0728051808_texture.glb` |
| mp7 | `Meshy_AI_mp7_0728051758_texture.glb` |
| ump45 | `Meshy_AI_UMP_0728051848_texture.glb` |
| ak47 | `Meshy_AI_ak47_0728051906_texture.glb` |
| m4a1 | `Meshy_AI_M4A1_0728051925_texture.glb` |
| awp | `Meshy_AI_sniper_0728051839_texture.glb` |
| bullet | `Meshy_AI_bullet_0728061523_texture.glb` |

Optional, only if you set `USE_CHARACTER_MODEL = true` in `src/50-weapons.js`:
`Meshy_AI_Desert_Ops_Soldier_biped_Animation_Walking_withSkin.glb`

**Different filenames?** Edit `WEAPON_FILES` near the top of `src/10-config.js`
and rebuild. A missing file logs a warning and that weapon simply has no model
in hand — the game still runs.

**Serve over http, not file://.** `GLTFLoader` fetches the models, and browsers
block that on `file://`. Your existing `server.js` already handles this.

## Maps

Two maps ship: **Palace** (`alcazar`, the original) and **Overgrowth**
(`overgrowth`, jungle temple ruins). The registry is `MAPS` at the top of
`src/10-config.js`.

A page builds exactly one map, at load. The lobby's map cards store the choice
(`localStorage['tc.map']`) and reload; `?map=overgrowth` in the URL overrides
it. Rooms remember the map they were created on (the server keeps `room.map`),
the public list shows it, and joining a room on another map reloads you onto
that map and joins automatically.

**Adding a map:** add its key to `MAPS` in `10-config.js` *and* to `MAPS` in
`server.js`, write a part like `35-overgrowth.js` that defines a
`buildYourMap()` returning `{ t, ct }` spawn zones, and add an
`else if(MAP_ID === 'yourmap')` branch next to Overgrowth's in `40-map.js`.
Add the new part to `PARTS` in `index.html` too.

Overgrowth is built entirely in code (no downloads). Its layout lives in the
`OVERGROWTH` table, so the help panel's map plan and the lobby thumbnail are
drawn from the same data as the level.

## Editing — no build needed

`index.html` loads the files in `src/` directly, so:

1. edit a file in `src/`
2. save
3. refresh the browser

Live Server reloads for you. That is the whole loop — there is no build step
during development.

It works because the parts load as **classic scripts**, which share one
top-level scope, exactly as if they were pasted end to end. Nothing needs
importing or exporting between them. (three.js itself only ships as a module,
so a small bootstrap in `index.html` imports it and hands it to the global
scope before the parts run.)

## Shipping one file

When you want a single self-contained file — to upload, or to hand to someone
without the folder — run:

```
node build.mjs        # or: python3 build.py
```

That writes `index.bundle.html`, which has everything inlined and needs no
`src/` folder. It does not touch `index.html`, so your dev setup keeps working.

## Why concatenation, not ES modules

The parts are joined into one `<script type="module">` rather than importing
each other. That keeps the original **single shared scope**, so `health`,
`yaw`, `ammo`, `playerGun` and the rest keep working untouched. Converting to
real modules would mean turning every cross-reference into an import/export —
hundreds of edits for no runtime gain. It would also break `file://` entirely.

The split was verified by rebuilding and diffing against the working
`index.html`: byte-for-byte identical.

## The parts

Concatenated in filename order, which is why they're numbered. A variable must
be declared in an earlier part than the one that uses it at load time.

| file | lines | what's in it |
|---|---|---|
| `00-imports.js` | 6 | three.js imports — must stay first |
| `10-config.js` | 230 | weapon table, slots, economy, scope, game state |
| `20-scene.js` | 47 | renderer, scene, environment map, lights |
| `30-textures.js` | 182 | procedural canvas textures |
| `40-map.js` | 1336 | the whole level |
| `50-weapons.js` | 744 | gun models, GLB loader, bullets, F6 adjust |
| `60-actors.js` | 234 | first-person body, enemy rig, collision broadphase |
| `70-hud.js` | 101 | health, ammo panel, magazine pips |
| `80-audio.js` | 312 | sound engine |
| `90-input.js` | 457 | controls, armory, weapon pickups, player constants |
| `a0-loop.js` | 525 | the frame loop |
| `b0-menu.js` | 259 | quality presets, deploy screen, settings, stats panel |
| `c0-boot.js` | 199 | static merge pass, diagnostics, `animate(0)` |

`src/index.template.html` holds all the HTML and CSS, with a
`/*__GAME_SOURCE__*/` marker where the script is injected. Edit HUD markup and
styling there.

## Where to change what

| you want to change | file |
|---|---|
| weapon stats, prices, magazines | `10-config.js` |
| model filenames, sizes, `VIEWMODEL_YAW_DEG` | `10-config.js` |
| bullet speed (`BULLET_SPEED_MULT`) | `10-config.js` |
| starting money (`START_MONEY`) | `10-config.js` |
| level geometry, buildings, cover | `40-map.js` |
| how a model is fitted to the hand | `50-weapons.js` |
| ammo readout, magazine pips | `70-hud.js` |
| key bindings | `90-input.js` |
| movement, jumping, camera | `a0-loop.js` |
| menu text, settings options | `b0-menu.js` |
| HUD markup and CSS | `src/index.template.html` |

## In-game keys

| key | |
|---|---|
| `WASD` `Space` | move, jump |
| `1` `2` `3` | knife / pistol / primary |
| `B` | armory |
| `R` | reload |
| right-click | scope (AWP) |
| `V` | third person |
| `F3` | stats overlay |
| `F4` | cycle quality preset |
| `F6` | viewmodel adjust — arrows rotate, Shift for 90 degrees, Enter prints config |

## Asset size

Your models are around 175 MB, which is a long first load.
`optimize-weapons.mjs` resizes textures and simplifies geometry:

```
npm install @gltf-transform/core @gltf-transform/extensions \
            @gltf-transform/functions meshoptimizer sharp
node optimize-weapons.mjs . optimized --tris=12000 --tex=1024
```

Expect roughly 90% smaller. Most of the size is 4K textures you cannot see at
viewmodel distance. For the bullet, use `--tris=400 --tex=512`.

`shrink-model.mjs` does the same for a rigged character, preserving the
skeleton and its animations.

## GLB structures

`40-map.js` can place models from `.glb` files:

```js
glbStructure('watchtower', x, z, w, h, d, { yaw: 45 });
```

**Collision is authored in code, the model just fills it.** That ordering is
deliberate: obstacles pushed during map build get bucketed by `_buildGrid()`,
which runs once at startup, so a collision box added later inside a load
callback would be invisible to every query. It also means the map plays
correctly from the first frame whether or not the download has finished, and
if a file is missing you get a warning and an invisible-but-solid block rather
than a broken level.

Filenames live in `STRUCTURE_FILES`. The eight measured so far:

| key | tris | native proportion |
|---|---|---|
| `palaceExterior` | 46,095 | 1.00 : 0.57 : 0.89 |
| `grandPalace` | 47,688 | 1.00 : 0.58 : 0.43 |
| `bridge` | 25,082 | 1.00 : 0.56 : 0.43 |
| `cornerBlock` | 47,625 | 0.93 : 0.63 : 1.00 |
| `watchtower` | 38,147 | 0.46 : 1.00 : 0.46 |
| `marketStall` | 26,320 | 1.00 : 0.93 : 0.97 |
| `facadeBlock` | 50,127 | 1.00 : 0.64 : 0.58 |
| `gateway` | 48,820 | 1.00 : 0.64 : 0.70 |

Those ratios are in `STRUCTURE_SHAPE`. Pick a target box matching them or the
model letterboxes inside it — scaling is uniform so nothing distorts, which
means the box's worst-fitting axis wins.

For anything with a passage through it, author the collision by hand instead of
one block, or players walk into an opening that looks passable and stop dead:

```js
glbStructure('gateway', x, z, 14, 10, 8, {
  boxes: [ [-5, 0, 4, 10, 8],            // left pier
           [ 5, 0, 4, 10, 8],            // right pier
           [ 0, 0, 14, 5.8, 8, 4.2] ],   // span, starting at head height
});
```

**Optimise before shipping.** The eight raw files are 213 MB, and 93% of that
is textures — two 4096 PNGs and two 2048 in every single one. Geometry is
already within budget:

```
node optimize-weapons.mjs . optimized --tris=50000 --tex=1024
```

Expect roughly 11 MB for the whole set, with no visible difference on a
building seen at 20 units.

## Adding a part

Drop a numbered `.js` into `src/` and rebuild. Pick the number by when it needs
to run — `45-props.js` loads after the map, before weapons. Nothing to register.

## If the page is blank

Open the browser console. A syntax error reports a line in the **built**
`index.html`, not in a part — search that code in `index.html` to find which
part it came from.
