// ── QUALITY PRESETS ────────────────────────────────────────────────────────
// Render scale is the strongest lever: pixels scale with the square, so 0.75
// draws 56% of the fragments. Shadow filtering and the environment map are
// both per-fragment costs in the standard material's shader.
const QUALITY = [
  { name:'ULTRA',  dpr:1.00, shadows:true,  soft:true,  env:true,  body:true  },
  { name:'HIGH',   dpr:0.85, shadows:true,  soft:true,  env:true,  body:true  },
  { name:'MEDIUM', dpr:0.75, shadows:true,  soft:false, env:true,  body:false },
  { name:'LOW',    dpr:0.60, shadows:false, soft:false, env:false, body:false },
];
let _qIdx = 0;
let _fpBodyWanted = true;
const _envTex = scene.environment;
let applyQuality = function(i){
  _qIdx = ((i % QUALITY.length) + QUALITY.length) % QUALITY.length;
  const q = QUALITY[_qIdx];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.dpr));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = q.shadows;
  renderer.shadowMap.type = q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  scene.environment = q.env ? _envTex : null;
  _fpBodyWanted = q.body;
  if(typeof _fpBody !== 'undefined' && _fpBody) _fpBody.visible = q.body && !isScoped;
  // changing shadow type / environment alters the shader permutation
  scene.traverse(o => {
    if(o.isMesh && o.material){
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for(const m of ms) m.needsUpdate = true;
    }
  });
  if(q.shadows) sun.shadow.needsUpdate = true;
  console.log('quality:', q.name);
};
addEventListener('keydown', e => {
  if(e.code === 'F4'){ applyQuality(_qIdx + 1); e.preventDefault(); }
});

// ══════════════════════════════════════════════════════════════════════════
//  MENU + SETTINGS
//  Each option is backed by a real engine change; nothing here is decorative.
// ══════════════════════════════════════════════════════════════════════════
const QUALITY_PRESETS = {
  LOW:    { scale:'50%',  shadows:'OFF',  body:false },
  MEDIUM: { scale:'75%',  shadows:'HARD', body:false },
  HIGH:   { scale:'85%',  shadows:'SOFT', body:true  },
  ULTRA:  { scale:'100%', shadows:'SOFT', body:true  },
};

const SETTINGS = [
  { key:'quality',   label:'QUALITY',       opts:['LOW','MEDIUM','HIGH','ULTRA','CUSTOM'], i:3 },
  { key:'scale',     label:'RENDER SCALE',  opts:['50%','60%','75%','85%','100%'],         i:4 },
  { key:'shadows',   label:'SHADOWS',       opts:['OFF','HARD','SOFT'],                    i:2 },
  { key:'fov',       label:'FIELD OF VIEW', opts:['70','75','80','90','100','110'],        i:1 },
  { key:'sens',      label:'SENSITIVITY',   opts:['0.5x','0.75x','1x','1.5x','2x','3x'],   i:2 },
  { key:'volume',    label:'VOLUME',        opts:['OFF','25%','50%','75%','100%'],         i:4 },
  { key:'viewmodel', label:'VIEWMODEL',     opts:['HIDDEN','LEFT','RIGHT'],                i:2 },
  { key:'crosshair', label:'CROSSHAIR',     opts:['RED','GREEN','CYAN','WHITE','AMBER'],   i:0 },
  { key:'stats',     label:'STATS OVERLAY', opts:['OFF','ON'],                             i:0 },
];
const SET = {};
for(const s of SETTINGS) SET[s.key] = s;
const setVal = k => SET[k].opts[SET[k].i];

const XHAIR = { RED:'#ff2b2b', GREEN:'#39ff6a', CYAN:'#3fe4ff', WHITE:'#ffffff', AMBER:'#ffc23d' };

// Viewmodel side is applied on top of whatever offset the current gun uses,
// so it survives weapon switches.
let viewSide = 1;
function applyViewmodel(){
  const v = setVal('viewmodel');
  viewSide = v === 'LEFT' ? -1 : 1;
  if(playerGun){
    const o = gunOffsets[selectedGunKey];
    playerGun.position.set(Math.abs(o[0])*viewSide, o[1], o[2]);
    playerGun.visible = (v !== 'HIDDEN') && !playerInCar && !isScoped;
  }
}

function applySetting(key){
  const v = setVal(key);
  switch(key){
    case 'scale': {
      const f = parseInt(v) / 100;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, f));
      renderer.setSize(innerWidth, innerHeight);
      break;
    }
    case 'shadows': {
      renderer.shadowMap.enabled = (v !== 'OFF');
      renderer.shadowMap.type = (v === 'SOFT') ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      scene.traverse(o => {
        if(o.isMesh && o.material){
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for(const m of ms) m.needsUpdate = true;
        }
      });
      if(v !== 'OFF') sun.shadow.needsUpdate = true;
      break;
    }
    case 'fov':
      DEFAULT_FOV = parseInt(v);
      if(!isScoped){ targetFov = DEFAULT_FOV; }
      break;
    case 'sens':      mouseSens = parseFloat(v); break;
    case 'volume':    masterOut.gain.value = (v === 'OFF') ? 0 : parseInt(v)/100; break;
    case 'viewmodel': applyViewmodel(); break;
    case 'crosshair':
      document.documentElement.style.setProperty('--xhair', XHAIR[v] || '#ff2b2b');
      break;
    case 'stats':     _statsDetail = (v === 'ON'); break;
    case 'quality': {
      const p = QUALITY_PRESETS[v];
      if(!p) break;                       // CUSTOM: leave the others alone
      SET.scale.i   = SET.scale.opts.indexOf(p.scale);
      SET.shadows.i = SET.shadows.opts.indexOf(p.shadows);
      _fpBodyWanted = p.body;
      if(typeof _fpBody !== 'undefined' && _fpBody) _fpBody.visible = p.body && !isScoped;
      applySetting('scale');
      applySetting('shadows');
      break;
    }
  }
}

function nudge(key, dir){
  const s = SET[key];
  s.i = (s.i + dir + s.opts.length) % s.opts.length;
  // Touching a sub-option means the preset no longer describes the state.
  if(key !== 'quality' && ['scale','shadows'].includes(key)){
    SET.quality.i = SET.quality.opts.indexOf('CUSTOM');
  }
  applySetting(key);
  if(key === 'quality') renderSettings();
  else updateSettingRow(key);
  saveSettings();
}

function updateSettingRow(key){
  const el = document.querySelector('.set-value[data-k="' + key + '"]');
  if(el) el.textContent = setVal(key);
  const q = document.querySelector('.set-value[data-k="quality"]');
  if(q) q.textContent = setVal('quality');
}

function renderSettings(){
  const host = document.getElementById('set-list');
  if(!host) return;
  host.innerHTML = SETTINGS.map(s =>
    '<div class="set-row">' +
      '<span class="set-label">' + s.label + '</span>' +
      '<button class="set-arrow" data-k="' + s.key + '" data-d="-1">&lsaquo;</button>' +
      '<span class="set-value" data-k="' + s.key + '">' + setVal(s.key) + '</span>' +
      '<button class="set-arrow" data-k="' + s.key + '" data-d="1">&rsaquo;</button>' +
    '</div>').join('');
  host.querySelectorAll('.set-arrow').forEach(b => {
    b.addEventListener('click', () => nudge(b.dataset.k, +b.dataset.d));
  });
}

// Persist across sessions where storage is available; silently skip where not.
function saveSettings(){
  try {
    const o = {}; for(const s of SETTINGS) o[s.key] = s.i;
    localStorage.setItem('alcazar.settings', JSON.stringify(o));
  } catch(e){}
}
function loadSettings(){
  try {
    const o = JSON.parse(localStorage.getItem('alcazar.settings') || '{}');
    for(const s of SETTINGS)
      if(typeof o[s.key] === 'number' && o[s.key] >= 0 && o[s.key] < s.opts.length) s.i = o[s.key];
  } catch(e){}
}

function showScreen(id){
  for(const el of document.querySelectorAll('.menu-screen')) el.classList.toggle('on', el.id === id);
}
document.getElementById('btn-settings').addEventListener('click', () => {
  renderSettings(); showScreen('scr-settings');
});
document.getElementById('btn-tutorial').addEventListener('click', () => showScreen('scr-tutorial'));
for(const b of document.querySelectorAll('[data-back]'))
  b.addEventListener('click', () => showScreen('scr-main'));

// F4 still cycles quality, and now keeps the menu in step.
applyQuality = function(i){
  const order = ['LOW','MEDIUM','HIGH','ULTRA'];
  const cur = order.indexOf(setVal('quality'));
  const next = order[((cur < 0 ? 3 : cur) + 1) % order.length];
  SET.quality.i = SET.quality.opts.indexOf(next);
  _qIdx = Math.max(0, QUALITY.findIndex(q => q.name === next));   // keep in step
  applySetting('quality');
  renderSettings(); saveSettings();
  console.log('quality:', next);
};

loadSettings();
for(const s of SETTINGS) if(s.key !== 'quality') applySetting(s.key);
applySetting('quality');
renderSettings();

(function perfPanel(){
  const d=document.createElement('div');
  d.style.cssText='position:absolute;top:60px;left:30px;z-index:200;color:#0f0;'+
    'font:bold 13px/1.45 monospace;background:rgba(0,0,0,.62);padding:6px 11px;'+
    'border-radius:5px;pointer-events:none;white-space:pre';
  document.body.appendChild(d);
  // detail lives at module scope (see _statsDetail)
  addEventListener('keydown', e => { if(e.code === 'F3'){ _statsDetail = !_statsDetail; e.preventDefault(); } });

  let f=0, last=performance.now(), fps=0;
  // rolling averages so the numbers are readable rather than flickering
  let aLogic=0, aDraw=0, aFrame=0;
  (function tick(){
    f++;
    const n=performance.now();
    aLogic += (_perfLogic - aLogic)*0.1;
    aDraw  += (_perfDraw  - aDraw )*0.1;
    aFrame += (_perfFrame - aFrame)*0.1;
    if(n-last>=500){
      fps = Math.round(f*1000/(n-last)); f=0; last=n;
      if(!_statsDetail){
        d.textContent = fps + ' FPS';
      } else {
        const r = renderer.info.render;
        const m = renderer.info.memory;
        let visible = 0;
        for(const e of enemies) if(e.visible) visible++;
        // Anything the frame spends outside logic+submit is the GPU catching
        // up (or vsync). A big gap here means JavaScript is not the limit.
        const gpuGap = Math.max(0, aFrame - aLogic - aDraw);
        d.textContent =
          fps + ' FPS   frame ' + aFrame.toFixed(1) + 'ms\n' +
          // Read the SETTING, not _qIdx. The F4 handler was replaced further
          // down by one that drives the settings menu and never updates
          // _qIdx, so this line reported a stale preset for ever.
          '  quality    ' + setVal('quality') + '  [F4]\n' +
          '  render     ' + Math.round(innerWidth*renderer.getPixelRatio()) + 'x'
                          + Math.round(innerHeight*renderer.getPixelRatio()) + '\n' +
          '  logic      ' + aLogic.toFixed(2) + 'ms\n' +
          '  draw submit' + aDraw.toFixed(2) + 'ms\n' +
          '  gpu / vsync' + gpuGap.toFixed(2) + 'ms\n' +
          '  calls      ' + r.calls + '\n' +
          '  triangles  ' + r.triangles.toLocaleString() + '\n' +
          '  geometries ' + m.geometries + '  textures ' + m.textures + '\n' +
          '  enemies    ' + visible + '/' + enemies.length + ' drawn\n' +
          '  model      ' + _operatorTris.toLocaleString() + ' tris each\n' +
          '  => enemies ' + ((visible + 1) * _operatorTris).toLocaleString() + ' tris\n' +
          '  bullets    ' + (playerBullets.length + enemyBullets.length) + '\n' +
          '  [F3] hide';
      }
    }
    requestAnimationFrame(tick);
  })();
})();
// Deploy into the T spawn hall, facing the enemy side.
{
  const sp = randomSpawnIn(TEAM_SPAWNS.t);
  yaw = TEAM_SPAWNS.t.yaw; pitch = 0;
  camera.position.set(sp[0], 1.7, sp[1]);
  _playerGroundPos.set(sp[0], 1.7, sp[1]);
}
animate(0);