// ════════════════════════════════════════════════════════════════════════════
//  e0-title.js — the title screen
//
//  Self-contained: injects its own CSS and restyles the existing screens rather
//  than editing index.template.html. Delete this file and its PARTS entry and
//  the old menu comes back untouched.
//
//  WHAT WAS WRONG
//
//  1. It never showed the game. `#instructions` had an opaque background plus
//     an 85 KB base64 JPEG, so the palace behind the menu was a photograph.
//     The real map was already being rendered every frame by animate()'s
//     early-return path, and was completely covered up.
//
//  2. Nothing moved, which reads as a loading screen rather than a game.
//
//  3. The lobby panel sat on top of all of it as a separate dark box, so the
//     first thing anyone actually saw was a form. The lobby IS the title
//     screen now; the title is drawn into it.
//
//  4. Exposed, the map is nearly white: bright sandstone under ambient 0.6 +
//     hemi 0.4 + a 1.8 sun at tone-mapping exposure 1.0. A dark scrim over
//     that just gives mud. So the menu drops the exposure and cools the sky
//     into dusk, and puts both back the moment you deploy.
//
//     (Fog is NOT the culprit, despite appearances. 20-scene.js sets density
//     0.018, but 40-map.js:695 replaces scene.fog outright with a warm
//     FogExp2(0xd8caa8, 0.0052) — so the map is barely fogged already. The
//     menu nudges it only to stay consistent if that ever changes.)
// ════════════════════════════════════════════════════════════════════════════

(function injectTitleStyles(){
  const css = `
  /* ── both entry screens become windows onto the live map ── */
  #instructions{ background:transparent !important; color:#f4ecdc; }
  #instructions::after{ display:none !important; }   /* drop the baked JPEG */
  #instructions::before{
    background:
      linear-gradient(180deg, rgba(6,8,12,.20) 0%, rgba(6,8,12,.04) 30%,
                              rgba(6,8,12,.52) 66%, rgba(5,7,10,.92) 100%),
      radial-gradient(ellipse 130% 90% at 50% 38%,
                      rgba(0,0,0,0) 42%, rgba(4,6,9,.70) 100%) !important;
  }
  /* The lobby used to cover #instructions with an opaque panel. Now that it is
     transparent, the old menu shows through underneath as a duplicate title —
     so hide it whenever either lobby screen is up. */
  body:has(#net-lobby:not(.net-hide)) #instructions,
  body:has(#net-room:not(.net-hide)) #instructions{ display:none !important; }

  #net-lobby, #net-room{
    background:transparent !important;
    backdrop-filter:none !important;
    align-items:flex-end !important;
    justify-content:flex-start !important;
  }
  /* the lobby needs the same scrim, since it no longer brings its own */
  #net-lobby::before, #net-room::before{
    content:''; position:absolute; inset:0; pointer-events:none;
    background:
      linear-gradient(180deg, rgba(6,8,12,.20) 0%, rgba(6,8,12,.04) 30%,
                              rgba(6,8,12,.52) 66%, rgba(5,7,10,.92) 100%),
      radial-gradient(ellipse 130% 90% at 50% 38%,
                      rgba(0,0,0,0) 42%, rgba(4,6,9,.70) 100%);
  }

  /* ── the shared title block, injected into the lobby ── */
  .tt-wrap{
    position:relative; z-index:2;
    padding:0 0 clamp(34px,6vh,74px) clamp(30px,6vw,92px);
    max-width:min(720px,90vw);
  }
  .tt-kick{
    font:700 11px/1 'Stratum2','Arial Narrow',sans-serif;
    letter-spacing:7px; text-transform:uppercase; color:#d9a75a;
    margin-bottom:12px;
    opacity:0; animation:tFade .7s .12s ease-out forwards;
  }
  .tt-title{
    font:800 clamp(44px,8.6vw,124px)/.92 'Stratum2','Arial Narrow',sans-serif;
    letter-spacing:clamp(2px,.5vw,8px);
    margin:0; white-space:nowrap; color:#f7edda;
    text-shadow:0 8px 46px rgba(0,0,0,.9), 0 1px 0 rgba(255,240,214,.18);
  }
  .tt-title .tl{
    display:inline-block; opacity:0; transform:translateY(.34em);
    animation:tRise .6s cubic-bezier(.22,.9,.28,1) forwards;
  }
  .tt-title .tl.dim{ color:#c98f4a; }
  .tt-rule{
    height:2px; width:clamp(140px,24vw,280px); margin:17px 0 14px;
    background:linear-gradient(90deg,#d9b25a,rgba(217,178,90,0));
    transform-origin:left center; opacity:0;
    animation:tGrow .8s .5s cubic-bezier(.22,.9,.28,1) forwards;
  }
  .tt-sub{
    margin:0 0 24px; max-width:46ch; font-size:15px; line-height:1.65;
    color:#cdb794; opacity:0; animation:tFade .7s .58s ease-out forwards;
  }

  /* ── lobby controls, restyled to belong to the composition ── */
  #net-lobby #net-panel, #net-room #net-panel{
    background:rgba(14,17,23,.62) !important;
    backdrop-filter:blur(9px);
    border:1px solid rgba(217,178,90,.22) !important;
    border-top:2px solid #c98f4a !important;
    box-shadow:0 20px 60px rgba(0,0,0,.5) !important;
    width:min(430px,88vw) !important;
    padding:20px 22px 18px !important;
    opacity:0; animation:tFade .6s .66s ease-out forwards;
  }
  /* the panel's own heading is redundant next to the big title */
  #net-lobby #net-panel h2{ display:none !important; }
  #net-lobby #net-panel .sub{
    margin:0 0 14px !important; font-size:13px !important; color:#9c8a70 !important;
    letter-spacing:.04em;
  }
  #net-lobby .net-btn, #net-room .net-btn{ letter-spacing:.14em; }
  #net-lobby .net-btn:not(.ghost){ background:linear-gradient(#f0cf7c,#c99a3f); color:#20160b; }

  /* ── solo path: same composition for #scr-main ── */
  #instructions:has(#scr-main.on){ align-items:flex-end; justify-content:flex-start; }
  #instructions:has(#scr-main.on) .menu-card{
    text-align:left; width:auto; max-width:min(760px,88vw);
    padding:0 0 clamp(34px,6vh,74px) clamp(30px,6vw,92px);
  }
  #scr-main #title{
    font-size:clamp(44px,8.6vw,124px) !important; line-height:.92 !important;
    letter-spacing:clamp(2px,.5vw,8px) !important; margin:0 0 2px !important;
    white-space:nowrap;
    text-shadow:0 8px 46px rgba(0,0,0,.9), 0 1px 0 rgba(255,240,214,.18) !important;
  }
  #scr-main #title .tl{
    display:inline-block; opacity:0; transform:translateY(.34em);
    animation:tRise .6s cubic-bezier(.22,.9,.28,1) forwards;
  }
  #scr-main #title .tl.dim{ color:#c98f4a; }
  #scr-main .menu-rule{
    margin:17px 0 14px !important; width:clamp(140px,24vw,280px) !important;
    background:linear-gradient(90deg,#d9b25a,rgba(217,178,90,0)) !important;
    transform-origin:left center; opacity:0;
    animation:tGrow .8s .5s cubic-bezier(.22,.9,.28,1) forwards;
  }
  #scr-main #desc{
    margin:0 0 24px !important; max-width:46ch !important;
    opacity:0; animation:tFade .7s .58s ease-out forwards;
  }
  #scr-main .menu-btns{ flex-direction:row !important; align-items:flex-start !important;
    flex-wrap:wrap; gap:11px !important; }
  #scr-main .mbtn{
    width:auto !important; min-width:150px; padding:15px 28px !important;
    background:rgba(20,24,30,.55); backdrop-filter:blur(6px);
    opacity:0; animation:tFade .55s ease-out forwards;
  }
  #scr-main .mbtn:nth-of-type(1){ animation-delay:.68s }
  #scr-main .mbtn:nth-of-type(2){ animation-delay:.76s }
  #scr-main .mbtn:nth-of-type(3){ animation-delay:.84s }
  #scr-main .mbtn.primary{ min-width:200px; background:linear-gradient(#f0cf7c,#c99a3f) !important; }
  #scr-main .menu-kicker{ opacity:0; animation:tFade .7s .12s ease-out forwards; }
  #scr-main .menu-foot{ margin-top:24px !important; opacity:0; animation:tFade .6s .95s ease-out forwards; }

  @keyframes tFade{ to{ opacity:1 } }
  @keyframes tRise{ to{ opacity:1; transform:none } }
  @keyframes tGrow{ from{ opacity:0; transform:scaleX(.18) } to{ opacity:1; transform:none } }

  /* The HUD used to be hidden by the menu's opaque background. Now that the
     menu is a window, it has to be hidden deliberately. */
  body.title-mode #crosshair, body.title-mode #cs-health, body.title-mode #cs-money,
  body.title-mode #cs-ammo, body.title-mode #cs-slots, body.title-mode #cs-pickup-prompt,
  body.title-mode #reload-msg, body.title-mode #enter-prompt, body.title-mode #speedo,
  body.title-mode #shop-btn{ display:none !important; }

  @media (prefers-reduced-motion:reduce){
    .tt-kick,.tt-title .tl,.tt-rule,.tt-sub,#net-lobby #net-panel,
    #scr-main .menu-kicker,#scr-main #title .tl,#scr-main .menu-rule,
    #scr-main #desc,#scr-main .mbtn,#scr-main .menu-foot{
      animation:none !important; opacity:1 !important; transform:none !important;
    }
  }
  `;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();

// ── LETTERING ───────────────────────────────────────────────────────────────
// Split into per-letter spans so they can rise in sequence.
function _titleSplit(el, text){
  el.innerHTML = '';
  [...text].forEach((ch, i) => {
    const sp = document.createElement('span');
    sp.className = 'tl' + (ch === '_' || i < 3 ? ' dim' : '');
    sp.textContent = ch;
    sp.style.animationDelay = (0.18 + i * 0.034).toFixed(3) + 's';
    el.appendChild(sp);
  });
}

// The big title, drawn into the lobby so the lobby IS the title screen.
(function buildLobbyTitle(){
  const lobby = document.getElementById('net-lobby');
  if(!lobby) return;                       // d0-net absent: solo path only
  const panel = lobby.querySelector('#net-panel');
  if(!panel) return;
  const wrap = document.createElement('div');
  wrap.className = 'tt-wrap';
  wrap.innerHTML =
    '<div class="tt-kick">Two-sided palace map</div>' +
    '<h1 class="tt-title"></h1>' +
    '<div class="tt-rule"></div>' +
    '<p class="tt-sub">A royal palace split down the middle. Two spawns, two flanks ' +
    'and a contested centre.</p>';
  lobby.insertBefore(wrap, panel);
  wrap.appendChild(panel);                 // panel now sits inside the composition
  _titleSplit(wrap.querySelector('.tt-title'), 'DE_ALCAZAR');
})();

// The solo screen's own <h1>. resetGame() rewrites it to "ELIMINATED", which
// would wipe the spans, so re-split whenever the text changes.
(function buildSoloTitle(){
  const el = document.getElementById('title');
  if(!el) return;
  const go = () => { if(!el.querySelector('.tl')) _titleSplit(el, (el.textContent||'').trim()); };
  go();
  new MutationObserver(go).observe(el, { childList: true });
})();

// ── CINEMATIC CAMERA + MENU MOOD ────────────────────────────────────────────
// animate() early-returns without pointer lock and only renders, so while the
// menu is up nothing else touches the camera and this drives it freely.
//
// It must NOT run mid-match: tab away during a round and you want to see where
// you actually are, not a fly-around. Hence the netInMatch check.
// Framing note: the map is a walled compound. A low camera just stares at the
// outside of the curtain wall (11 high, merlons to ~13), so this sits well
// above it and looks down INTO the courtyard — roughly a 33 degree depression.
const TITLE_CAM = {
  radius: 60, height: 38, lookAt: 3,
  period: 165,          // seconds per revolution — slow enough to feel still
  pushFrom: 22,         // extra distance at the start, eased away
  pushSecs: 5.5,
  fov: 52,              // tighter than gameplay's 75
  fogDensity: 0.0055,
  exposure: 0.46,       // the map is near-white at 1.0; this is dusk
  sky: 0x24405e,
};

let _titleActive = false, _titleT0 = 0;
let _fogWas = null, _fovWas = null, _expWas = null, _skyWas = null;

function _titleShouldRun(){
  if(document.pointerLockElement) return false;
  if(typeof netInMatch !== 'undefined' && netInMatch) return false;
  return true;
}

function _titleEnter(){
  _titleActive = true;
  _titleT0 = performance.now();
  document.body.classList.add('title-mode');
  if(scene.fog && _fogWas === null){ _fogWas = scene.fog.density; scene.fog.density = TITLE_CAM.fogDensity; }
  if(_fovWas === null){ _fovWas = camera.fov; camera.fov = TITLE_CAM.fov; camera.updateProjectionMatrix(); }
  if(_expWas === null){ _expWas = renderer.toneMappingExposure; renderer.toneMappingExposure = TITLE_CAM.exposure; }
  if(_skyWas === null && scene.background && scene.background.isColor){
    _skyWas = scene.background.getHex();
    scene.background = new THREE.Color(TITLE_CAM.sky);
  }
}

function _titleExit(){
  _titleActive = false;
  document.body.classList.remove('title-mode');
  if(scene.fog && _fogWas !== null){ scene.fog.density = _fogWas; _fogWas = null; }
  if(_expWas !== null){ renderer.toneMappingExposure = _expWas; _expWas = null; }
  if(_skyWas !== null){ scene.background = new THREE.Color(_skyWas); _skyWas = null; }
  if(_fovWas !== null){
    // Restore through currentFov, not the saved value: animate()'s FOV easing
    // only runs when currentFov and targetFov disagree, so it would never undo
    // this by itself and every round would start at 52 degrees.
    camera.fov = (typeof currentFov === 'number') ? currentFov : _fovWas;
    camera.updateProjectionMatrix();
    _fovWas = null;
  }
}

const _titleTmp = new THREE.Vector3();
(function titleFrame(){
  requestAnimationFrame(titleFrame);
  const want = _titleShouldRun();
  if(want && !_titleActive) _titleEnter();
  else if(!want && _titleActive) _titleExit();
  if(!_titleActive) return;

  const t = (performance.now() - _titleT0) / 1000;
  const k = Math.min(1, t / TITLE_CAM.pushSecs);
  const push = TITLE_CAM.pushFrom * Math.pow(1 - k, 3);        // easeOutCubic
  const ang = (t / TITLE_CAM.period) * Math.PI * 2 + 0.55;
  const r = TITLE_CAM.radius + push;

  camera.position.set(
    Math.sin(ang) * r,
    TITLE_CAM.height + push * 0.3 + Math.sin(t * 0.1) * 1.5,
    Math.cos(ang) * r
  );
  camera.lookAt(_titleTmp.set(0, TITLE_CAM.lookAt, 0));
})();

console.log('title: live map backdrop (the 85 KB baked JPEG is no longer used)');


// ════════════════════════════════════════════════════════════════════════════
//  SETTINGS + HOW TO PLAY
//
//  These existed only on #instructions, which the lobby now hides — so until
//  this, nothing could reach either. Both live in one modal here, and the solo
//  screen's buttons are rewired to it so there is a single version of each.
//
//  Settings does NOT reimplement anything: it physically moves b0-menu's
//  #set-list node into this panel and calls its renderSettings(). Every option
//  keeps driving the real engine state, and keeps persisting to localStorage.
//
//  The reference tables are generated from GUNS and from the constants they
//  describe, so they cannot drift out of date the way hand-written docs do.
// ════════════════════════════════════════════════════════════════════════════
(function buildTitleModal(){

  const style = document.createElement('style');
  style.textContent = `
  #tt-modal{position:fixed;inset:0;z-index:420;display:none;align-items:center;
    justify-content:center;background:rgba(6,8,12,.82);backdrop-filter:blur(7px);
    font-family:'Stratum2','Arial Narrow','Segoe UI',sans-serif;color:#eee6d6}
  #tt-modal.on{display:flex}
  #tt-box{width:min(940px,94vw);height:min(80vh,760px);display:flex;flex-direction:column;
    background:rgba(15,18,24,.96);border:1px solid rgba(217,178,90,.24);
    border-top:2px solid #c98f4a;box-shadow:0 30px 90px rgba(0,0,0,.62)}
  #tt-head{display:flex;align-items:center;gap:4px;padding:0 8px 0 22px;
    border-bottom:1px solid rgba(217,178,90,.16);flex:0 0 auto;flex-wrap:wrap}
  #tt-head .ttl{font-weight:800;font-size:17px;letter-spacing:.16em;text-transform:uppercase;
    margin-right:14px;color:#f2e6cf;padding:15px 0}
  .tt-tab{background:none;border:none;color:#8a7f6c;cursor:pointer;padding:16px 13px;
    font:700 12px/1 inherit;letter-spacing:.13em;text-transform:uppercase;
    border-bottom:2px solid transparent;transition:color .15s}
  .tt-tab:hover{color:#d8cbb2}
  .tt-tab.on{color:#e8c877;border-bottom-color:#c98f4a}
  #tt-close{margin-left:auto;background:none;border:1px solid #333c48;color:#9aa3b0;
    cursor:pointer;font:700 12px/1 inherit;letter-spacing:.12em;padding:9px 14px}
  #tt-close:hover{color:#fff;border-color:#5a6577}
  #tt-body{overflow-y:auto;padding:24px 26px 30px;flex:1 1 auto;line-height:1.6}
  .tt-pane{display:none}
  .tt-pane.on{display:block;animation:tFade .2s ease-out}
  .tt-h{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#c98f4a;
    font-weight:700;margin:26px 0 10px;padding-bottom:7px;border-bottom:1px solid rgba(217,178,90,.14)}
  .tt-pane > .tt-h:first-child{margin-top:0}
  .tt-p{max-width:74ch;color:#c9bda6;margin:0 0 13px;font-size:14.5px}
  .tt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(228px,1fr));gap:7px 20px;margin-bottom:6px}
  .tt-row{display:flex;align-items:center;gap:9px;font-size:14px;color:#ddd3bf;padding:3px 0}
  .tt-row .lbl{color:#9c917f}
  kbd.tt-k{display:inline-block;min-width:26px;text-align:center;padding:4px 7px;
    background:#20262f;border:1px solid #39414d;border-bottom-width:2px;border-radius:3px;
    font:700 11.5px/1 inherit;color:#e9dfc9;letter-spacing:.04em}
  table.tt-t{border-collapse:collapse;width:100%;margin:4px 0 16px;font-size:13.5px}
  table.tt-t th{text-align:left;font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;
    color:#8a7f6c;font-weight:700;padding:8px 11px;background:rgba(255,255,255,.03)}
  table.tt-t td{padding:7px 11px;border-top:1px solid rgba(255,255,255,.06);color:#d5cab4;
    font-variant-numeric:tabular-nums}
  table.tt-t tr:hover td{background:rgba(217,178,90,.05)}
  .tt-good{color:#7ec98f}.tt-bad{color:#e08a7e}.tt-gold{color:#e8c877}
  .tt-t-col{color:#e0a35a;font-weight:700}.tt-ct-col{color:#7fa8d8;font-weight:700}
  .tt-note{border-left:2px solid #c98f4a;background:rgba(201,143,74,.07);
    padding:11px 15px;margin:14px 0;font-size:13.5px;color:#cdbfa5;max-width:74ch}
  .tt-map-wrap{display:flex;gap:26px;flex-wrap:wrap;align-items:flex-start}
  .tt-legend{font-size:13.5px;color:#c9bda6;min-width:210px;flex:1}
  .tt-legend div{display:flex;align-items:center;gap:9px;padding:4px 0}
  .tt-legend i{width:12px;height:12px;flex:0 0 auto;border-radius:2px;display:block}
  #tt-body .set-list{max-width:600px;margin-left:0 !important;margin-right:auto !important}
  `;
  document.head.appendChild(style);

  // ── reference tables, generated from the live config ──────────────────────
  const gunRows = Object.keys(GUNS)
    .sort((a,b) => GUNS[a].order - GUNS[b].order)
    .map(k => {
      const g = GUNS[k];
      const kill = { knife:1500, glock18:300, deagle:300, mac10:600, mp5:600,
                     mp7:600, ump45:600, ak47:300, m4a1:300, awp:100 }[k] || 300;
      return '<tr><td>' + g.name + '</td>' +
        '<td>' + (g.price ? '$' + g.price.toLocaleString() : '<span class="tt-good">free</span>') + '</td>' +
        '<td>' + g.damage + '</td>' +
        '<td>' + (g.melee ? '&mdash;' : g.maxAmmo + ' + ' + ((g.spareMags||0) * g.ammo)) + '</td>' +
        '<td>' + g.range + '</td>' +
        '<td class="tt-gold">$' + kill + '</td></tr>';
    }).join('');

  // Keys are arrays, not space-separated strings: "Left click" is ONE key, but
  // W/A/S/D are four, and splitting on spaces cannot tell those apart.
  const KEYS = [
    [['W','A','S','D'],'Move'], [['Space'],'Jump'], [['Mouse'],'Aim'],
    [['Left click'],'Fire'], [['Right click'],'Scope (AWP only)'],
    [['R'],'Reload'], [['1'],'Knife'], [['2'],'Pistol'], [['3'],'Primary weapon'],
    [['B'],'Buy menu (buy time only)'], [['Tab'],'Hold for scoreboard'],
    [['V'],'Third person'], [['Esc'],'Release the mouse'],
    [['F3'],'Performance stats'], [['F4'],'Cycle quality preset'],
  ].map(([keys,d]) =>
    '<div class="tt-row">' +
    keys.map(k => '<kbd class="tt-k">' + k + '</kbd>').join(' ') +
    '<span class="lbl">' + d + '</span></div>').join('');

  // World coords -> a 200x200 top-down plan. +z is north, so it maps to -y.
  const px = x => ((x + 47) / 94 * 200).toFixed(1);
  const py = z => ((47 - z) / 94 * 200).toFixed(1);
  const box = (x0,z0,x1,z1,fill,stroke) =>
    `<rect x="${px(x0)}" y="${py(z1)}" width="${(px(x1)-px(x0)).toFixed(1)}" height="${(py(z0)-py(z1)).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;

  const MAP_SVG = `
  <svg viewBox="-6 -6 212 212" width="330" height="330" style="flex:0 0 auto;background:#12100c;border:1px solid #2e2a22">
    <rect x="0" y="0" width="200" height="200" fill="#1d1913"/>
    ${box(-45,-45,45,45,'#241f17','#5d4a2c')}
    ${box(22,22,45,45,'#3d3320','#a8813c')}
    ${box(-45,-45,-22,-22,'#3d3320','#a8813c')}
    ${box(-45,35,-35,45,'#4a3a1c','#e0a35a')}
    ${box(35,-45,45,-35,'#1e3049','#7fa8d8')}
    <text x="${px(33)}" y="${py(33)}" fill="#e8c877" font-size="15" font-weight="700" text-anchor="middle" font-family="sans-serif">A</text>
    <text x="${px(-33)}" y="${py(-33)}" fill="#e8c877" font-size="15" font-weight="700" text-anchor="middle" font-family="sans-serif">B</text>
    <text x="${px(-40)}" y="${py(40)}" fill="#e0a35a" font-size="8" font-weight="700" text-anchor="middle" font-family="sans-serif">T</text>
    <text x="${px(40)}" y="${py(-40)}" fill="#7fa8d8" font-size="8" font-weight="700" text-anchor="middle" font-family="sans-serif">CT</text>
    <line x1="${px(-35)}" y1="${py(35)}" x2="${px(22)}" y2="${py(22)}" stroke="#e0a35a" stroke-width="1.4" stroke-dasharray="4 3" opacity=".75"/>
    <line x1="${px(35)}" y1="${py(-35)}" x2="${px(-22)}" y2="${py(-22)}" stroke="#7fa8d8" stroke-width="1.4" stroke-dasharray="4 3" opacity=".75"/>
    <text x="100" y="102" fill="#6b6152" font-size="8" text-anchor="middle" font-family="sans-serif">MID</text>
    <text x="100" y="-1" fill="#5c5344" font-size="7" text-anchor="middle" font-family="sans-serif">N</text>
  </svg>`;

  const modal = document.createElement('div');
  modal.id = 'tt-modal';
  modal.innerHTML = `
   <div id="tt-box">
    <div id="tt-head">
      <span class="ttl">De_Alcazar</span>
      <button class="tt-tab on" data-p="controls">Controls</button>
      <button class="tt-tab" data-p="round">The round</button>
      <button class="tt-tab" data-p="money">Money</button>
      <button class="tt-tab" data-p="damage">Damage</button>
      <button class="tt-tab" data-p="map">The map</button>
      <button class="tt-tab" data-p="settings">Settings</button>
      <button id="tt-close">Close</button>
    </div>
    <div id="tt-body">

      <div class="tt-pane on" data-p="controls">
        <div class="tt-h">Controls</div>
        <div class="tt-grid">${KEYS}</div>
        <div class="tt-h">Weapons</div>
        <p class="tt-p">You always carry a knife and a pistol. A primary goes in slot 3.
          Buy during buy time with <kbd class="tt-k">B</kbd>. Die and you lose your primary,
          so most rounds start with a decision about what you can afford.</p>
        <table class="tt-t">
          <tr><th>Weapon</th><th>Price</th><th>Damage</th><th>Ammo</th><th>Range</th><th>Reward / kill</th></tr>
          ${gunRows}
        </table>
        <div class="tt-note">The AWP kill reward is deliberately low and the knife's is
          the highest in the game. That is the trade: the safest weapon barely pays,
          and the most dangerous one pays for a full buy.</div>
      </div>

      <div class="tt-pane" data-p="round">
        <div class="tt-h">How a match runs</div>
        <p class="tt-p">Two teams, up to ten players. <strong class="tt-t-col">Attack</strong>
          starts in the north-west corner, <strong class="tt-ct-col">Defence</strong> in the
          south-east. First team to <strong>8 round wins</strong> takes the match, and sides
          swap once <strong>7 rounds</strong> have been played, so both halves are played
          from both corners.</p>
        <table class="tt-t">
          <tr><th>Phase</th><th>Length</th><th>What happens</th></tr>
          <tr><td class="tt-gold">Buy</td><td>15s</td><td>Frozen in spawn. Shop open. You can look around but not move.</td></tr>
          <tr><td class="tt-gold">Live</td><td>1:55</td><td>Round is running. Last team standing wins it.</td></tr>
          <tr><td class="tt-gold">Round over</td><td>5s</td><td>Result and payouts, then straight into the next buy.</td></tr>
        </table>
        <div class="tt-h">Winning a round</div>
        <div class="tt-row"><span class="tt-good">&#9656;</span><span>Eliminate every player on the other team.</span></div>
        <div class="tt-row"><span class="tt-good">&#9656;</span><span>Or hold more players alive than they do when the clock runs out.</span></div>
        <div class="tt-row"><span class="lbl">&#9656;</span><span>A dead tie on the clock goes to Defence.</span></div>
        <div class="tt-note">Death is not respawn. Once you are down you spectate until the
          round ends, so trading your life for one kill is rarely worth it.</div>
      </div>

      <div class="tt-pane" data-p="money">
        <div class="tt-h">The economy</div>
        <p class="tt-p">Money carries between rounds and resets to $800 at the swap.
          It is capped at $16,000. You keep your money when you die &mdash; you only lose
          the gun, which is what makes losing an expensive rifle hurt.</p>
        <table class="tt-t">
          <tr><th>Event</th><th>Payout</th></tr>
          <tr><td>Start of each half</td><td class="tt-gold">$800</td></tr>
          <tr><td>Win a round</td><td class="tt-good">+$3,250</td></tr>
          <tr><td>Lose 1 round in a row</td><td>+$1,400</td></tr>
          <tr><td>Lose 2 in a row</td><td>+$1,900</td></tr>
          <tr><td>Lose 3 in a row</td><td>+$2,400</td></tr>
          <tr><td>Lose 4 in a row</td><td>+$2,900</td></tr>
          <tr><td>Lose 5 or more</td><td>+$3,400</td></tr>
          <tr><td>Kill</td><td class="tt-gold">$100 &ndash; $1,500 by weapon</td></tr>
        </table>
        <div class="tt-note">The loss bonus climbs the longer you lose, and resets the
          moment you win one. That is what makes a save round worth playing: go cheap
          now, and the round after next you can afford everything.</div>
      </div>

      <div class="tt-pane" data-p="damage">
        <div class="tt-h">Where you hit matters</div>
        <p class="tt-p">Every body is four stacked hit zones. The same bullet does very
          different damage depending on which one it passes through.</p>
        <table class="tt-t">
          <tr><th>Zone</th><th>Multiplier</th><th>AK-47 (20 base)</th></tr>
          <tr><td class="tt-bad">Head</td><td class="tt-bad">4.00&times;</td><td>80</td></tr>
          <tr><td>Stomach</td><td>1.25&times;</td><td>25</td></tr>
          <tr><td>Chest and arms</td><td>1.00&times;</td><td>20</td></tr>
          <tr><td>Legs</td><td>0.75&times;</td><td>15</td></tr>
        </table>
        <p class="tt-p">You start each round with 100 health and there is no regeneration
          and no armour. Four chest hits from an AK, or two to the head.</p>
        <div class="tt-note">The AWP is the exception: it carries its own headshot value
          rather than a multiplier, so it does not scale to an absurd number. Anywhere it
          lands, it hurts.</div>
      </div>

      <div class="tt-pane" data-p="map">
        <div class="tt-h">De_Alcazar</div>
        <p class="tt-p">A walled palace compound, 94 by 94 units. The layout is
          <strong>diagonal, not mirrored</strong>: spawns and sites alternate around the
          four corners, so each team begins near one site and far from the other.</p>
        <div class="tt-map-wrap">
          ${MAP_SVG}
          <div class="tt-legend">
            <div><i style="background:#e0a35a"></i> <strong class="tt-t-col">Attack spawn</strong> &mdash; north-west</div>
            <div><i style="background:#7fa8d8"></i> <strong class="tt-ct-col">Defence spawn</strong> &mdash; south-east</div>
            <div><i style="background:#a8813c"></i> <strong>A site</strong> &mdash; north-east, the Great Court</div>
            <div><i style="background:#a8813c"></i> <strong>B site</strong> &mdash; south-west, the Bazaar Court</div>
            <div><i style="background:#5d4a2c"></i> Curtain wall &mdash; the hard edge of the map</div>
            <p class="tt-p" style="margin-top:14px;font-size:13.5px">
              Dashed lines are each team's short route. Attack reaches A quickly and B the
              long way round; Defence is the reverse. Whoever holds <strong>mid</strong>
              can rotate to either site faster than the other team can.</p>
          </div>
        </div>
      </div>

      <div class="tt-pane" data-p="settings">
        <div class="tt-h">Settings</div>
        <p class="tt-p">Every option here changes real engine state and is remembered
          between sessions. <strong>Render scale</strong> is by far the strongest lever if
          the frame rate is low &mdash; pixels scale with the square, so 75% draws barely
          over half the work. Changing any individual option switches Quality to Custom.</p>
        <div id="tt-set-host"></div>
      </div>

    </div>
   </div>`;
  document.body.appendChild(modal);

  // Move b0-menu's live settings list in, rather than rebuilding it. Its
  // renderSettings() finds the node by id, so everything keeps working.
  const host = modal.querySelector('#tt-set-host');
  const setList = document.getElementById('set-list');
  if(host && setList){
    host.appendChild(setList);
    if(typeof renderSettings === 'function') renderSettings();
  }

  const panes = [...modal.querySelectorAll('.tt-pane')];
  const tabs  = [...modal.querySelectorAll('.tt-tab')];
  function show(name){
    tabs.forEach(t => t.classList.toggle('on', t.dataset.p === name));
    panes.forEach(p => p.classList.toggle('on', p.dataset.p === name));
    modal.querySelector('#tt-body').scrollTop = 0;
  }
  tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.p)));

  function open(name){ modal.classList.add('on'); show(name || 'controls'); }
  function close(){ modal.classList.remove('on'); }
  modal.querySelector('#tt-close').addEventListener('click', close);
  modal.addEventListener('click', e => { if(e.target === modal) close(); });
  addEventListener('keydown', e => {
    if(e.code === 'Escape' && modal.classList.contains('on')) close();
  });
  window.ttOpen = open;

  // ── entry points ──────────────────────────────────────────────────────────
  // The lobby had no way to reach either of these at all.
  const panel = document.querySelector('#net-lobby #net-panel');
  if(panel){
    const row = document.createElement('div');
    row.className = 'net-row';
    row.style.marginTop = '2px';
    row.innerHTML =
      '<button class="net-btn ghost" id="tt-open-tut" style="flex:1">How to play</button>' +
      '<button class="net-btn ghost" id="tt-open-set" style="flex:1">Settings</button>';
    panel.appendChild(row);
    row.querySelector('#tt-open-tut').addEventListener('click', () => open('controls'));
    row.querySelector('#tt-open-set').addEventListener('click', () => open('settings'));
  }

  // Point the solo screen's buttons at the same modal, so there is one version
  // of each rather than two that can drift apart.
  const bs = document.getElementById('btn-settings');
  const bt = document.getElementById('btn-tutorial');
  if(bs){ const c = bs.cloneNode(true); bs.replaceWith(c);
          c.addEventListener('click', () => open('settings')); }
  if(bt){ const c = bt.cloneNode(true); bt.replaceWith(c);
          c.addEventListener('click', () => open('controls')); }
})();