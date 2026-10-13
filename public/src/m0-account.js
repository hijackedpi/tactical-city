// ════════════════════════════════════════════════════════════════════════════
//  m0-account.js — accounts (Google sign-in) and the Inventory screen
//
//  Sign-in is optional. Guests play exactly as before. A signed-in player gets
//  their Google name and picture on the title screen and a LOADOUT — which
//  skin each gun wears — saved on their account on the server (server.js,
//  "ACCOUNTS"). Skins themselves are just extra GLBs listed in GUN_SKINS
//  (10-config.js); there are none yet, so every gun shows its default.
//
//  First visit: click the Google button once. After that the server's session
//  cookie (180 days) signs you in on arrival with no click, and if it ever
//  expires Google One Tap offers the same account back with one tap.
//
//  Needs the game server (node server.js). On VS Code's Go Live there is no
//  server, so the panel says so and the rest of the game is unaffected.
// ════════════════════════════════════════════════════════════════════════════

let acctUser = null;                       // the signed-in account, or null
const ACCT_GUNS = ['knife','glock18','deagle','mac10','mp5','mp7','ump45','ak47','m4a1','awp'];

(function injectAccountStyles(){
  const css = document.createElement('style');
  css.textContent = `
  #acct-bar{display:flex;align-items:center;gap:12px;margin:0 -22px 14px;padding:12px 22px;
    border-bottom:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02);min-height:58px}
  .acct-av{width:36px;height:36px;border-radius:50%;background:#20262f;flex:0 0 auto;
    border:2px solid rgba(217,178,90,.55);object-fit:cover;display:grid;place-items:center;
    font:800 15px/1 var(--tt-font,sans-serif);color:#e8c877;overflow:hidden}
  .acct-av img{width:100%;height:100%;object-fit:cover;display:block}
  #acct-bar .acct-who{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
  #acct-bar .acct-who b{font:800 15px/1 var(--tt-font,sans-serif);letter-spacing:.08em;text-transform:uppercase;
    color:#f2e6cf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #acct-bar .acct-who em{font:700 10.5px/1 var(--tt-font,sans-serif);font-style:normal;letter-spacing:.18em;
    text-transform:uppercase;color:#8f98a6}
  #acct-bar .acct-who em.ok{color:#7ec98f}
  #acct-bar .acct-btn{background:transparent;color:#c9bda6;border:1px solid #333c48;cursor:pointer;
    padding:8px 12px;font:700 11px/1 var(--tt-font,sans-serif);letter-spacing:.14em;text-transform:uppercase}
  #acct-bar .acct-btn:hover{color:#fff;border-color:#5a6577}
  #acct-bar .acct-btn.gold{color:#e8c877;border-color:rgba(217,178,90,.5)}
  #acct-bar .acct-btn.gold:hover{background:rgba(217,178,90,.1)}
  #acct-gbtn{min-height:40px;display:flex;align-items:center}
  #acct-bar .acct-hint{font:500 12.5px/1.4 var(--tt-font,sans-serif);color:#8f98a6;flex:1;min-width:0}
  #acct-bar .acct-hint b{color:#d8cbb2}

  /* sign-in window (Steam-style): username + password, or Google */
  #al-modal{position:fixed;inset:0;z-index:430;display:none;align-items:center;justify-content:center;
    background:radial-gradient(ellipse at 50% 40%,rgba(18,22,30,.8),rgba(4,6,9,.94));backdrop-filter:blur(8px);
    font-family:var(--tt-font,sans-serif);color:var(--tt-cream,#f4ecdc)}
  #al-modal.on{display:flex}
  #al-box{position:relative;width:min(420px,92vw);background:linear-gradient(180deg,rgba(20,24,32,.98),rgba(13,16,22,.99));
    border:1px solid rgba(255,255,255,.08);box-shadow:0 40px 120px rgba(0,0,0,.7);padding:30px 32px 26px}
  #al-box::before{content:'';position:absolute;left:0;right:0;top:0;height:3px;
    background:linear-gradient(90deg,var(--tt-t,#e0a35a),var(--tt-gold-hi,#f5d68d) 50%,var(--tt-ct,#6fa3dc))}
  #al-x{position:absolute;top:12px;right:12px;width:34px;height:34px;display:grid;place-items:center;background:none;
    border:1px solid rgba(255,255,255,.1);color:#9aa3b0;cursor:pointer;font:400 20px/1 sans-serif}
  #al-x:hover{color:#fff;border-color:var(--tt-gold,#dca24c)}
  #al-k{font:700 11px/1 var(--tt-font,sans-serif);letter-spacing:.34em;text-transform:uppercase;color:var(--tt-gold,#dca24c)}
  #al-t{font:900 italic 30px/1 var(--tt-font,sans-serif);letter-spacing:.04em;text-transform:uppercase;margin:8px 0 20px}
  .al-tabs{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:20px}
  .al-tab{background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;padding:11px 0 10px;color:#8f98a6;
    font:800 13px/1 var(--tt-font,sans-serif);letter-spacing:.18em;text-transform:uppercase;margin-bottom:-1px}
  .al-tab.on{color:var(--tt-gold-hi,#f5d68d);border-bottom-color:var(--tt-gold,#dca24c)}
  .al-f{display:block;margin-bottom:13px}
  .al-f span{display:block;font:700 11px/1 var(--tt-font,sans-serif);letter-spacing:.2em;text-transform:uppercase;color:#8f98a6;margin-bottom:7px}
  .al-f input{width:100%;box-sizing:border-box;background:#0b0e14;border:1px solid #2c3441;color:#f4ecdc;padding:12px 13px;
    font:600 15px/1 var(--tt-font,sans-serif);letter-spacing:.04em;outline:none}
  .al-f input:focus{border-color:var(--tt-gold,#dca24c)}
  .al-f small{display:block;margin-top:6px;font:500 12px/1.3 var(--tt-font,sans-serif);color:#6c7380}
  #al-err{min-height:18px;font:600 13px/1.4 var(--tt-font,sans-serif);color:#ff9a8a;margin:2px 0 10px}
  #al-go{width:100%;padding:14px;border:none;cursor:pointer;background:linear-gradient(180deg,#f3d387,#cf9a43);color:#1d1408;
    font:800 15px/1 var(--tt-font,sans-serif);letter-spacing:.22em;text-transform:uppercase}
  #al-go:hover{filter:brightness(1.08)} #al-go:disabled{opacity:.6;cursor:wait}
  #al-or{display:flex;align-items:center;gap:12px;margin:20px 0 14px;font:700 11px/1 var(--tt-font,sans-serif);letter-spacing:.24em;
    text-transform:uppercase;color:#6c7380}
  #al-or::before,#al-or::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.1)}
  #al-google{display:flex;justify-content:center;min-height:44px}
  #al-foot{margin-top:16px;text-align:center;font:500 12.5px/1.45 var(--tt-font,sans-serif);color:#6c7380}
  #acct-bar .acct-btn.big{padding:10px 16px;font-size:12px}

  /* inventory: its own screen */
  #inv-screen{position:fixed;inset:0;z-index:421;display:none;flex-direction:column;font-family:var(--tt-font,sans-serif);color:#f4ecdc;
    background:radial-gradient(ellipse 70% 60% at 50% 45%,#1d2430 0%,#0d1117 62%,#07090c 100%)}
  #inv-screen.on{display:flex;animation:invIn .25s ease-out}
  @keyframes invIn{from{opacity:0;transform:scale(1.01)}to{opacity:1;transform:none}}
  #inv-screen::before{content:'';position:absolute;left:0;right:0;top:0;height:3px;
    background:linear-gradient(90deg,var(--tt-t,#e0a35a),var(--tt-gold-hi,#f5d68d) 50%,var(--tt-ct,#6fa3dc))}
  #inv-top{display:flex;align-items:center;gap:18px;padding:22px 32px 18px;border-bottom:1px solid rgba(255,255,255,.07)}
  #inv-tt span{display:block;font:700 11px/1 var(--tt-font,sans-serif);letter-spacing:.34em;text-transform:uppercase;color:var(--tt-gold,#dca24c)}
  #inv-tt b{display:block;font:900 italic 38px/1 var(--tt-font,sans-serif);letter-spacing:.04em;text-transform:uppercase;margin-top:6px}
  #inv-who{margin-left:auto;display:flex;align-items:center;gap:12px}
  #inv-who .acct-av{width:42px;height:42px}
  #inv-who b{display:block;font:800 16px/1 var(--tt-font,sans-serif);letter-spacing:.1em;text-transform:uppercase}
  #inv-who em{display:block;margin-top:5px;font:700 10.5px/1 var(--tt-font,sans-serif);font-style:normal;letter-spacing:.18em;text-transform:uppercase;color:#8f98a6}
  #inv-close{width:44px;height:44px;display:grid;place-items:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);
    color:#c9c1b1;cursor:pointer;font:400 26px/1 sans-serif;transition:all .15s}
  #inv-close:hover{color:#fff;border-color:var(--tt-gold,#dca24c);background:rgba(220,162,76,.12)}
  #inv-wrap{flex:1;display:grid;grid-template-columns:280px 1fr 300px;min-height:0}
  .inv-grp{font:700 11px/1 var(--tt-font,sans-serif);letter-spacing:.28em;text-transform:uppercase;color:#7a8290;padding:18px 24px 8px}
  #inv-list{overflow-y:auto;border-right:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.2);padding-bottom:16px}
  .inv-row{display:flex;align-items:center;gap:12px;width:100%;background:none;border:none;border-left:3px solid transparent;cursor:pointer;
    padding:9px 20px 9px 21px;text-align:left;color:#c4bba9;transition:background .15s,color .15s}
  .inv-row:hover{background:rgba(255,255,255,.04);color:#f4ecdc}
  .inv-row.on{border-left-color:var(--tt-gold,#dca24c);background:linear-gradient(90deg,rgba(220,162,76,.16),rgba(220,162,76,0));color:#f4ecdc}
  .inv-row-ic{width:70px;height:26px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;color:#a99c84}
  .inv-row.on .inv-row-ic{color:var(--tt-gold-hi,#f5d68d)}
  .inv-row-ic svg{width:70px;height:22px}
  .inv-row-tx b{display:block;font:800 14px/1 var(--tt-font,sans-serif);letter-spacing:.12em}
  .inv-row-tx em{display:block;margin-top:4px;font:600 11.5px/1 var(--tt-font,sans-serif);font-style:normal;letter-spacing:.06em;color:#8a806e}
  #inv-stage{position:relative;min-width:0;overflow:hidden}
  #inv-stage::before{content:'';position:absolute;left:50%;top:62%;width:70%;height:90px;transform:translate(-50%,-50%);
    background:radial-gradient(ellipse at center,rgba(220,162,76,.22),rgba(220,162,76,0) 70%);pointer-events:none}
  #inv-stage::after{content:'';position:absolute;inset:0;pointer-events:none;
    background:repeating-linear-gradient(0deg,rgba(255,255,255,.012) 0 1px,transparent 1px 4px)}
  #inv-cv{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;z-index:1}
  #inv-cv:active{cursor:grabbing}
  #inv-ic-fallback{position:absolute;inset:0;display:none;align-items:center;justify-content:center;color:#d8cbb2}
  #inv-ic-fallback:not(:empty){display:flex}
  #inv-ic-fallback svg{width:60%;height:auto;max-height:40%}
  #inv-name{position:absolute;left:34px;bottom:30px;z-index:2;pointer-events:none}
  #inv-name em{display:block;font:700 12px/1 var(--tt-font,sans-serif);font-style:normal;letter-spacing:.3em;text-transform:uppercase;color:var(--tt-gold,#dca24c)}
  #inv-name b{display:block;font:900 italic 54px/1 var(--tt-font,sans-serif);letter-spacing:.03em;text-transform:uppercase;margin:6px 0 4px}
  #inv-name span{font:600 15px/1 var(--tt-font,sans-serif);letter-spacing:.1em;color:#a99c84}
  #inv-hint{position:absolute;right:28px;bottom:30px;z-index:2;pointer-events:none;font:700 11px/1 var(--tt-font,sans-serif);
    letter-spacing:.24em;text-transform:uppercase;color:#6c7380;transition:opacity .4s}
  #inv-skins{overflow-y:auto;border-left:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.2);padding-bottom:18px}
  .inv-skin-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 20px}
  .inv-skin{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;padding:12px 12px 11px;
    background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.09);border-bottom:3px solid #6b7280;color:#c4bba9;cursor:pointer;
    font-family:var(--tt-font,sans-serif);transition:all .15s}
  .inv-skin:hover:not(:disabled):not(.soon){border-color:rgba(220,162,76,.5)}
  .inv-skin:disabled{cursor:default}
  .inv-skin.on{border-color:var(--tt-gold,#dca24c);background:linear-gradient(180deg,rgba(220,162,76,.18),rgba(220,162,76,.04))}
  .inv-skin-ic{width:100%;height:42px;display:flex;align-items:center;justify-content:center;color:#d8cbb2}
  .inv-skin-ic svg{width:100%;height:30px}
  .inv-skin b{font:800 13px/1 var(--tt-font,sans-serif);letter-spacing:.12em;text-transform:uppercase;color:#f4ecdc}
  .inv-skin em{font:700 10px/1 var(--tt-font,sans-serif);font-style:normal;letter-spacing:.16em;text-transform:uppercase;color:#7a8290}
  .inv-skin.on em{color:var(--tt-gold-hi,#f5d68d)}
  .inv-skin.soon{border-style:dashed;border-bottom:1px dashed rgba(255,255,255,.12);cursor:default;opacity:.7}
  .inv-lock{width:100%;height:42px;display:flex;align-items:center;justify-content:center;color:#6c7380}
  .inv-lock svg{width:22px;height:22px}
  .inv-skin .tier{position:absolute;top:8px;right:9px;font:800 9.5px/1 var(--tt-font,sans-serif);letter-spacing:.16em;text-transform:uppercase}
  .inv-skin.locked .inv-skin-ic{opacity:.45;filter:grayscale(.6)}
  .inv-skin .lk{position:absolute;left:9px;top:8px;width:14px;height:14px;color:#8a909b}
  .inv-skin.sel{outline:2px solid var(--tt-gold-hi,#f5d68d);outline-offset:-2px}
  #inv-act{margin:16px 20px 0}
  #inv-act .eq{width:100%;padding:13px;border:none;cursor:pointer;background:linear-gradient(180deg,#f3d387,#cf9a43);color:#1d1408;
    font:800 14px/1 var(--tt-font,sans-serif);letter-spacing:.2em;text-transform:uppercase}
  #inv-act .eq:hover{filter:brightness(1.08)}
  #inv-act .st{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;padding:12px;border:1px solid rgba(255,255,255,.12);
    font:800 13px/1 var(--tt-font,sans-serif);letter-spacing:.18em;text-transform:uppercase;color:#8f98a6;box-sizing:border-box}
  #inv-act .st.ok{color:var(--tt-gold-hi,#f5d68d);border-color:rgba(220,162,76,.45)}
  #inv-act .st svg{width:15px;height:15px}
  #inv-act p{margin:9px 0 0;font:500 12.5px/1.45 var(--tt-font,sans-serif);color:#8a806e;text-align:center}
  #inv-name .tg{display:inline-block;margin-left:10px;padding:4px 8px 3px;font:800 11px/1 var(--tt-font,sans-serif);letter-spacing:.18em;
    text-transform:uppercase;vertical-align:4px;border:1px solid currentColor}
  .inv-note{margin:16px 20px 0;padding:12px 14px;border:1px solid rgba(220,162,76,.25);background:rgba(220,162,76,.06);
    font:500 13px/1.5 var(--tt-font,sans-serif);color:#cdbfa5}
  @media (max-width:980px){
    #inv-wrap{grid-template-columns:1fr;grid-template-rows:auto 46vh auto;overflow-y:auto}
    #inv-list{display:flex;overflow-x:auto;border-right:none;padding:0} #inv-list .inv-grp{display:none}
    .inv-row{flex:0 0 auto;width:auto;border-left:none;border-bottom:3px solid transparent} .inv-row.on{border-bottom-color:var(--tt-gold,#dca24c)}
    #inv-name b{font-size:36px} #inv-top{padding:16px 18px}
  }
  /* Inventory has its own button under the logo, away from the Deploy panel
     (and from How to play / Settings), so it is on screen without scrolling */
  #tt-open-inv{margin-top:clamp(18px,3vh,30px);display:inline-flex;align-items:center;gap:16px;cursor:pointer;
    padding:13px 26px 13px 16px;background:rgba(10,13,18,.6);border:1px solid rgba(220,162,76,.45);
    color:var(--tt-cream,#f4ecdc);font-family:var(--tt-font,sans-serif);text-align:left;backdrop-filter:blur(4px);
    clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);
    transition:background .15s,border-color .15s,transform .15s;opacity:0;animation:tFade .7s 1.2s ease-out forwards}
  #tt-open-inv:hover{background:rgba(220,162,76,.16);border-color:var(--tt-gold-hi,#f5d68d);transform:translateY(-1px)}
  #tt-open-inv .ic{width:44px;height:44px;display:grid;place-items:center;background:rgba(220,162,76,.14);color:var(--tt-gold-hi,#f5d68d)}
  #tt-open-inv .ic svg{width:24px;height:24px}
  #tt-open-inv b{display:block;font:800 18px/1 var(--tt-font,sans-serif);letter-spacing:.22em;text-transform:uppercase}
  #tt-open-inv small{display:block;margin-top:6px;font:700 11px/1 var(--tt-font,sans-serif);letter-spacing:.2em;text-transform:uppercase;color:#a99c84}
  #tt-open-inv .ar{margin-left:10px;color:var(--tt-gold,#dca24c);font:800 18px/1 sans-serif}
  /* phone: keep the close button on screen */
  @media (max-width:600px){
    #inv-top{gap:10px;padding:14px 14px 12px} #inv-tt b{font-size:28px}
    #inv-who em{display:none} #inv-who b{font-size:13px;max-width:30vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #inv-who .acct-av{width:34px;height:34px} #inv-close{flex:0 0 auto}
  }
  `;
  document.head.appendChild(css);
})();

// ── SERVER TALK ─────────────────────────────────────────────────────────────
async function acctFetch(url, body){
  const r = await fetch(url, body === undefined
    ? { credentials: 'same-origin' }
    : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch(e){}
  if(!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
  return j;
}

function acctSetUser(a){
  acctUser = a || null;
  playerLoadout = acctUser ? Object.assign({}, acctUser.loadout) : {};
  acctRenderBar();
  acctRenderInventory();
  acctSyncName();
  acctReloadSkins();
}

// A gun whose skin changed needs its model fetched again. Only the skinned
// guns are touched; everything else keeps its cached model.
const _acctLoadedWith = {};
function acctReloadSkins(){
  if(typeof loadWeapon !== 'function' || typeof gunModels !== 'object') return;
  for(const key of ACCT_GUNS){
    const want = (typeof gunFileFor === 'function') ? gunFileFor(key) : null;
    if(!want) continue;
    if(_acctLoadedWith[key] === undefined) _acctLoadedWith[key] = WEAPON_FILES[key];
    if(_acctLoadedWith[key] === want) continue;
    _acctLoadedWith[key] = want;
    delete gunModels[key];
    loadWeapon(key, () => { if(selectedGunKey === key && typeof equipGun === 'function') equipGun(key); });
  }
}

// Name box <-> account name. Signing in fills the box with the account name;
// editing the box renames the account (the server trims it the same way).
let _acctNameWired = false;
function acctSyncName(){
  const box = document.getElementById('net-name');
  if(!box) return;
  if(acctUser){
    box.value = acctUser.name;
    try { localStorage.setItem('alcazar.name', acctUser.name); } catch(e){}
  }
  if(_acctNameWired) return;
  _acctNameWired = true;
  box.addEventListener('change', () => {
    if(!acctUser) return;
    const v = box.value.trim();
    if(!v || v.toUpperCase() === acctUser.name) return;
    acctFetch('/api/name', { name: v }).then(j => { acctUser = j.account; acctRenderBar(); acctRenderInventory(); }).catch(() => {});
  });
}

// ── GOOGLE ──────────────────────────────────────────────────────────────────
let _gClientId = null, _gLoaded = false, _gInit = false, _gFailed = false;
function acctLoadGoogle(cb){
  if(_gLoaded){ cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true; s.defer = true;
  s.onload = () => { _gLoaded = true; cb(); };
  s.onerror = () => { _gFailed = true; acctRenderLoginGoogle(); };
  document.head.appendChild(s);
}
function acctGoogleInit(){
  if(_gInit || !_gLoaded || !_gClientId || !window.google) return;
  _gInit = true;
  google.accounts.id.initialize({
    client_id: _gClientId,
    auto_select: true,                 // returning player: One Tap signs in without a click
    use_fedcm_for_prompt: true,
    callback: async resp => {
      try {
        const j = await acctFetch('/auth/google', { credential: resp.credential });
        acctSetUser(j.account);
        acctCloseLogin();
      } catch(e){ acctLoginError(e.message); }
    },
  });
}
function acctRenderGoogleButton(host, text){
  if(!host || !_gInit) return;
  host.innerHTML = '';
  google.accounts.id.renderButton(host, { theme: 'filled_black', size: 'large', shape: 'rectangular',
                                          text: text || 'continue_with', logo_alignment: 'left', width: 300 });
}
function acctSignOut(){
  acctFetch('/auth/logout', {}).catch(() => {});
  if(_gInit && window.google) try { google.accounts.id.disableAutoSelect(); } catch(e){}
  acctSetUser(null);
}

// ── TITLE SCREEN BAR ────────────────────────────────────────────────────────
let _acctState = 'loading';            // loading | noserver | ready
function acctAvatarHTML(a){
  const initial = (a.name || '?').charAt(0).toUpperCase();
  return '<span class="acct-av">' + (a.avatar
    ? '<img src="' + a.avatar.replace(/"/g, '') + '" alt="" referrerpolicy="no-referrer" onerror="this.remove()">' : '') +
    (a.avatar ? '' : initial) + '</span>';
}
function acctRenderBar(err){
  const bar = document.getElementById('acct-bar');
  if(!bar) return;
  if(acctUser){
    bar.innerHTML = acctAvatarHTML(acctUser) +
      '<span class="acct-who"><b></b><em class="ok">Signed in</em></span>' +
      '<button type="button" class="acct-btn gold" id="acct-inv">Inventory</button>' +
      '<button type="button" class="acct-btn" id="acct-out">Sign out</button>';
    bar.querySelector('b').textContent = acctUser.name;
    bar.querySelector('#acct-inv').addEventListener('click', invOpen);
    bar.querySelector('#acct-out').addEventListener('click', acctSignOut);
    return;
  }
  if(_acctState === 'noserver'){
    bar.innerHTML = '<span class="acct-hint">Accounts need the game server (<b>node server.js</b>). Playing as a guest.</span>';
    return;
  }
  if(_acctState === 'loading'){
    bar.innerHTML = '<span class="acct-hint">Checking sign-in&hellip;</span>';
    return;
  }
  bar.innerHTML =
    '<button type="button" class="acct-btn gold big" id="acct-login" style="flex:1">Sign in</button>' +
    '<button type="button" class="acct-btn big" id="acct-join" style="flex:1">Create account</button>';
  bar.querySelector('#acct-login').addEventListener('click', () => acctOpenLogin('login'));
  bar.querySelector('#acct-join').addEventListener('click', () => acctOpenLogin('join'));
}

// ── SIGN-IN WINDOW ──────────────────────────────────────────────────────────
// Like Steam: a Tactical City account with a username and password, or
// "Continue with Google" (that one shows once GOOGLE_CLIENT_ID is set on the
// server). Either way the session cookie keeps you signed in on that browser.
let _alMode = 'login';
function acctBuildLogin(){
  if(document.getElementById('al-modal')) return;
  const m = document.createElement('div');
  m.id = 'al-modal';
  m.innerHTML = `
    <div id="al-box" role="dialog" aria-modal="true">
      <button type="button" id="al-x" aria-label="Close">&times;</button>
      <div id="al-k">Tactical City</div>
      <div id="al-t">Account</div>
      <div class="al-tabs">
        <button type="button" class="al-tab" data-m="login">Sign in</button>
        <button type="button" class="al-tab" data-m="join">Create account</button>
      </div>
      <form id="al-form" autocomplete="on" novalidate>
        <label class="al-f"><span>Username</span><input id="al-user" name="username" maxlength="16" autocomplete="username" spellcheck="false"></label>
        <label class="al-f"><span>Password</span><input id="al-pass" name="password" type="password" maxlength="128"></label>
        <label class="al-f" id="al-pass2-row"><span>Confirm password</span><input id="al-pass2" type="password" maxlength="128" autocomplete="new-password"></label>
        <div id="al-err"></div>
        <button type="submit" id="al-go">Sign in</button>
      </form>
      <div id="al-gwrap"><div id="al-or">or</div><div id="al-google"></div></div>
      <div id="al-foot"></div>
    </div>`;
  document.body.appendChild(m);
  m.querySelector('#al-x').addEventListener('click', acctCloseLogin);
  m.addEventListener('click', e => { if(e.target === m) acctCloseLogin(); });
  m.querySelectorAll('.al-tab').forEach(t => t.addEventListener('click', () => acctLoginMode(t.dataset.m)));
  // typing here must not reach the game's hotkeys (B, V, Tab...)
  m.addEventListener('keydown', e => {
    e.stopPropagation();
    if(e.code === 'Escape') acctCloseLogin();
  });
  m.querySelector('#al-form').addEventListener('submit', e => { e.preventDefault(); acctLoginSubmit(); });
}
function acctLoginMode(mode){
  _alMode = mode;
  const m = document.getElementById('al-modal');
  m.querySelectorAll('.al-tab').forEach(t => t.classList.toggle('on', t.dataset.m === mode));
  const join = mode === 'join';
  m.querySelector('#al-pass2-row').style.display = join ? '' : 'none';
  m.querySelector('#al-pass').autocomplete = join ? 'new-password' : 'current-password';
  m.querySelector('#al-go').textContent = join ? 'Create account' : 'Sign in';
  m.querySelector('#al-foot').innerHTML = join
    ? '3&ndash;16 letters, numbers or _. Password at least 6 characters.'
    : 'New here? <a href="#" id="al-sw" style="color:var(--tt-gold-hi,#f5d68d)">Create an account</a>';
  const sw = m.querySelector('#al-sw');
  if(sw) sw.addEventListener('click', e => { e.preventDefault(); acctLoginMode('join'); });
  acctLoginError('');
  acctRenderLoginGoogle();
}
function acctRenderLoginGoogle(){
  const w = document.getElementById('al-gwrap');
  if(!w) return;
  const show = !!_gClientId && !_gFailed;
  w.style.display = show ? '' : 'none';
  if(show && _gInit) acctRenderGoogleButton(w.querySelector('#al-google'), _alMode === 'join' ? 'signup_with' : 'continue_with');
}
function acctLoginError(msg){
  const e = document.getElementById('al-err');
  if(e) e.textContent = msg || '';
}
function acctOpenLogin(mode){
  acctBuildLogin();
  acctLoginMode(mode || 'login');
  document.getElementById('al-modal').classList.add('on');
  setTimeout(() => { const u = document.getElementById('al-user'); if(u) u.focus(); }, 30);
}
function acctCloseLogin(){
  const m = document.getElementById('al-modal');
  if(m) m.classList.remove('on');
}
window.acctOpenLogin = acctOpenLogin;
async function acctLoginSubmit(){
  const $ = id => document.getElementById(id);
  const username = $('al-user').value.trim(), password = $('al-pass').value;
  if(!username || !password) return acctLoginError('Enter a username and password.');
  if(_alMode === 'join'){
    if(!/^[A-Za-z0-9_]{3,16}$/.test(username)) return acctLoginError('Username must be 3-16 letters, numbers or _.');
    if(password.length < 6) return acctLoginError('Password must be at least 6 characters.');
    if(password !== $('al-pass2').value) return acctLoginError('Passwords do not match.');
  }
  $('al-go').disabled = true;
  try {
    const j = await acctFetch(_alMode === 'join' ? '/auth/register' : '/auth/login', { username, password });
    acctSetUser(j.account);
    $('al-pass').value = ''; $('al-pass2').value = '';
    acctCloseLogin();
  } catch(e){ acctLoginError(e.message); }
  finally { $('al-go').disabled = false; }
}

function acctBuildBar(){
  const panel = document.querySelector('#net-lobby #net-panel');
  if(!panel || document.getElementById('acct-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'acct-bar';
  const ph = panel.querySelector('.tt-ph');
  if(ph) ph.after(bar); else panel.insertBefore(bar, panel.firstChild);
  acctRenderBar();
}

// ── INVENTORY SCREEN ────────────────────────────────────────────────────────
// Its own full screen, separate from How to play / Settings. Left: every
// weapon, grouped. Middle: the selected weapon turning on a stage (a small
// second three.js renderer that only draws while this screen is open; drag to
// spin it). Right: that weapon's skins. There are no skins yet, so each gun
// shows Default plus a "coming soon" slot.
const INV_GROUPS = [['melee','Melee'],['pistols','Pistols'],['smgs','SMGs'],['rifles','Rifles'],['snipers','Sniper']];
let invSel = 'ak47';
let invPrev = null;            // skin id being previewed (null = the equipped one)
let inv3 = null;
const _invSkinCache = {};     // skin file -> fitted model, for previews of skins not in use

function invBuild(){
  if(document.getElementById('inv-screen')) return;
  const el = document.createElement('div');
  el.id = 'inv-screen';
  el.innerHTML = `
    <div id="inv-top">
      <div id="inv-tt"><span>Tactical City</span><b>Inventory</b></div>
      <div id="inv-who"></div>
      <button type="button" id="inv-close" aria-label="Close">&times;</button>
    </div>
    <div id="inv-wrap">
      <aside id="inv-list"></aside>
      <section id="inv-stage">
        <canvas id="inv-cv"></canvas>
        <div id="inv-ic-fallback"></div>
        <div id="inv-name"><em></em><b></b><span></span></div>
        <div id="inv-hint">Drag to rotate</div>
      </section>
      <aside id="inv-skins"></aside>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('#inv-close').addEventListener('click', invClose);
  el.querySelector('#inv-list').addEventListener('click', e => {
    const r = e.target.closest('[data-gun]'); if(!r) return;
    invSel = r.dataset.gun; invPrev = null; acctRenderInventory(); invShowModel(invSel);
  });
  el.querySelector('#inv-skins').addEventListener('click', e => {
    // equip the previewed skin (only offered when you own it)
    if(e.target.closest('#inv-equip')){
      if(!acctUser) return;
      const id = invPrevId();
      const lo = Object.assign({}, acctUser.loadout, { [invSel]: id });
      acctFetch('/api/loadout', { loadout: lo }).then(j => { invPrev = null; acctSetUser(j.account); invShowModel(invSel); }).catch(() => {});
      return;
    }
    // any tile, owned or locked, previews that skin on the stage
    const t = e.target.closest('[data-skin]'); if(!t) return;
    invPrev = t.dataset.skin;
    acctRenderInventory(); invShowModel(invSel);
  });
  addEventListener('keydown', e => { if(e.code === 'Escape' && el.classList.contains('on')) invClose(); });
  addEventListener('resize', () => { if(el.classList.contains('on')) invResize(); });

  // drag to spin
  const cv = el.querySelector('#inv-cv');
  let drag = null;
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); el.querySelector('#inv-hint').style.opacity = 0; });
  cv.addEventListener('pointermove', e => {
    if(!drag || !inv3) return;
    inv3.yaw += (e.clientX - drag.x) * 0.012;
    inv3.pitch = Math.max(-0.6, Math.min(0.6, inv3.pitch + (e.clientY - drag.y) * 0.008));
    drag = { x: e.clientX, y: e.clientY };
  });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('pointercancel', () => { drag = null; });
}

function invOpen(){
  invBuild();
  const el = document.getElementById('inv-screen');
  el.classList.add('on');
  acctRenderInventory();
  invInit3D();
  invResize();
  invShowModel(invSel);
  if(inv3 && !inv3.raf) invLoop();
  if(typeof netUpdateResume === 'function') netUpdateResume();
}
function invClose(){
  const el = document.getElementById('inv-screen');
  if(el) el.classList.remove('on');
  if(inv3 && inv3.raf){ cancelAnimationFrame(inv3.raf); inv3.raf = 0; }
  if(typeof netUpdateResume === 'function') netUpdateResume();
}
window.invOpen = invOpen;
window.invClose = invClose;

function invInit3D(){
  if(inv3 !== null) return;
  inv3 = false;
  if(typeof THREE !== 'object') return;
  try {
    const cv = document.getElementById('inv-cv');
    const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xfff0d8, 0x141920, 1.3));
    const key = new THREE.DirectionalLight(0xfff4e6, 2.6); key.position.set(2.5, 4, 5); sc.add(key);
    const rim = new THREE.DirectionalLight(0x9ec0ff, 2.0); rim.position.set(-4, 2, -4); sc.add(rim);
    const warm = new THREE.DirectionalLight(0xffb46b, 1.0); warm.position.set(4, -1, 1); sc.add(warm);
    const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
    cam.position.set(0, 0.25, 5.2); cam.lookAt(0, 0, 0);
    const pivot = new THREE.Group(); sc.add(pivot);
    inv3 = { r, sc, cam, pivot, holder: null, tok: 0, yaw: 0, pitch: 0.08, raf: 0, t0: performance.now() };
    // studio reflections so metal reads as metal
    import('three/addons/environments/RoomEnvironment.js').then(m => {
      const pm = new THREE.PMREMGenerator(r);
      sc.environment = pm.fromScene(new m.RoomEnvironment(), 0.04).texture;
      pm.dispose();
    }).catch(() => {});
  } catch(e){ inv3 = false; console.warn('inventory preview unavailable:', e && e.message); }
}
function invResize(){
  if(!inv3) return;
  const cv = inv3.r.domElement, w = cv.clientWidth || 600, h = cv.clientHeight || 400;
  inv3.r.setSize(w, h, false);
  inv3.cam.aspect = w / h;
  // keep a long rifle inside a narrow stage
  inv3.cam.position.z = 5.2 * Math.max(1, 1.5 / inv3.cam.aspect);
  inv3.cam.updateProjectionMatrix();
}
function invLoop(){
  if(!inv3) return;
  const t = (performance.now() - inv3.t0) / 1000;
  inv3.pivot.rotation.y = inv3.yaw + Math.sin(t * 0.45) * 0.42;
  inv3.pivot.rotation.x = inv3.pitch + Math.sin(t * 0.7) * 0.03;
  inv3.pivot.position.y = Math.sin(t * 1.1) * 0.03;
  inv3.r.render(inv3.sc, inv3.cam);
  inv3.raf = requestAnimationFrame(invLoop);
}
function invFallback(show){
  const fb = document.getElementById('inv-ic-fallback');
  if(!fb) return;
  fb.innerHTML = show ? ((typeof gunIconSVG === 'function' && gunIconSVG(invSel)) || '') : '';
  fb.style.display = show ? '' : 'none';
}
// The model for a gun in a given skin. The skin the player has equipped is the
// in-game model (loadWeapon); any other skin is loaded once just for the
// preview. Its turn is copied from the in-game model so every skin of a gun
// faces the same way on the stage.
function invGetModel(key, skinId, cb){
  loadWeapon(key, base => {
    const skin = skinId && skinId !== 'default' && GUN_SKINS[key] && GUN_SKINS[key][skinId];
    const file = skin ? skin.file : WEAPON_FILES[key];
    const inUse = (typeof gunFileFor === 'function') ? gunFileFor(key) : WEAPON_FILES[key];
    if(file === inUse){ cb(base); return; }
    const done = m => {
      const a = base && base.userData.spin, b = m && m.userData.spin;
      if(a && b) b.rotation.copy(a.rotation);
      cb(m);
    };
    if(_invSkinCache[file]){ done(_invSkinCache[file]); return; }
    if(typeof _weaponLoader !== 'object' || typeof fitWeaponModel !== 'function'){ cb(base); return; }
    _weaponLoader.load(file, g => { _invSkinCache[file] = fitWeaponModel(g.scene, key); done(_invSkinCache[file]); },
                       undefined, () => cb(null));
  });
}
function invEquippedId(key){ return (acctUser && acctUser.loadout && acctUser.loadout[key]) || 'default'; }
function invPrevId(){ return invPrev || invEquippedId(invSel); }

function invShowModel(key){
  if(!inv3){ invFallback(true); return; }
  const st = inv3, tok = ++st.tok;
  if(st.holder){ st.pivot.remove(st.holder); st.holder = null; }
  st.yaw = 0;
  if(typeof loadWeapon !== 'function'){ invFallback(true); return; }
  invFallback(false);
  invGetModel(key, invPrevId(), fitted => {
    if(tok !== st.tok) return;
    if(!fitted){ invFallback(true); return; }
    const c = fitted.clone(true);
    // The equipped gun carries the first-person hands (f0-hands adds a
    // 'viewHands' rig to it). The showcase is the weapon alone.
    const hands = [];
    c.traverse(o => { if(o.name === 'viewHands') hands.push(o); });
    for(const h of hands) h.parent && h.parent.remove(h);
    c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1);
    c.visible = true;
    c.traverse(o => { o.visible = true; });
    const side = new THREE.Group(); side.add(c);
    side.rotation.y = Math.PI / 2;            // barrel to the left, side on
    const box = new THREE.Box3().setFromObject(side);
    const size = new THREE.Vector3(), mid = new THREE.Vector3();
    box.getSize(size); box.getCenter(mid);
    side.position.sub(mid);
    const fit = new THREE.Group(); fit.add(side);
    const len = Math.max(size.x, size.y, size.z, 1e-6);
    fit.scale.setScalar((key === 'knife' ? 2.0 : GUNS[key] && GUNS[key].category === 'pistols' ? 1.9 : 2.7) / len);
    st.pivot.add(fit);
    st.holder = fit;
  });
}

function invSkinsFor(key){
  const skins = (typeof GUN_SKINS === 'object' && GUN_SKINS[key]) || {};
  const owned = acctUser ? (acctUser.inventory || []) : [];
  return [{ id: 'default', name: 'Default', tier: null, owned: true }].concat(
    Object.keys(skins).map(id => ({ id, name: skins[id].name, tier: skins[id].tier, owned: owned.includes(key + ':' + id) })));
}
function invEsc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]); }

function acctRenderInventory(){
  const el = document.getElementById('inv-screen');
  if(!el || typeof GUNS !== 'object') return;
  const lo = (acctUser && acctUser.loadout) || {};
  const skinName = k => { const id = lo[k] || 'default'; const s = invSkinsFor(k).find(x => x.id === id); return s ? s.name : 'Default'; };

  // who
  const who = el.querySelector('#inv-who');
  if(acctUser){
    who.innerHTML = acctAvatarHTML(acctUser) + '<span><b>' + invEsc(acctUser.name) + '</b><em>Loadout saved to your account</em></span>';
  } else {
    who.innerHTML = '<span><b>Guest</b><em>Sign in to save a loadout</em></span>' +
      (_acctState === 'ready' ? '<button type="button" class="acct-btn gold big" id="inv-login" style="background:transparent;color:var(--tt-gold-hi,#f5d68d);' +
        'border:1px solid rgba(220,162,76,.5);cursor:pointer;padding:10px 16px;font:800 12px/1 var(--tt-font,sans-serif);letter-spacing:.16em;text-transform:uppercase">Sign in</button>' : '');
    const il = who.querySelector('#inv-login');
    if(il) il.addEventListener('click', () => acctOpenLogin('login'));
  }

  // list
  el.querySelector('#inv-list').innerHTML = INV_GROUPS.map(([cat, label]) => {
    const keys = ACCT_GUNS.filter(k => GUNS[k] && GUNS[k].category === cat);
    if(!keys.length) return '';
    return '<div class="inv-grp">' + label + '</div>' + keys.map(k =>
      '<button type="button" class="inv-row' + (k === invSel ? ' on' : '') + '" data-gun="' + k + '">' +
      '<span class="inv-row-ic">' + ((typeof gunIconSVG === 'function' && gunIconSVG(k)) || '') + '</span>' +
      '<span class="inv-row-tx"><b>' + invEsc(GUNS[k].name) + '</b><em>' + invEsc(skinName(k)) + '</em></span></button>').join('');
  }).join('');

  // stage caption
  const g = GUNS[invSel];
  el.querySelector('#inv-name em').textContent = ({melee:'Melee',pistols:'Pistol',smgs:'SMG',rifles:'Rifle',snipers:'Sniper'})[g.category] || '';
  el.querySelector('#inv-name b').textContent = g.name;
  const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const tierOf = t => (t && typeof SKIN_TIERS === 'object' && SKIN_TIERS[t]) || null;
  const list = invSkinsFor(invSel);
  const cur = lo[invSel] || 'default';
  if(!list.some(s => s.id === invPrev)) invPrev = null;
  const prev = list.find(s => s.id === invPrevId()) || list[0];

  // caption: the skin on the stage, with its tier, and a lock if you do not own it
  const pt = tierOf(prev.tier);
  el.querySelector('#inv-name span').innerHTML = invEsc(prev.name) +
    (pt ? '<span class="tg" style="color:' + pt.color + '">' + pt.name + '</span>' : '') +
    (prev.owned ? '' : '<span class="tg" style="color:#8f98a6">Locked</span>');

  // skins
  const tiles = list.map(s => {
    const t = tierOf(s.tier);
    return '<button type="button" class="inv-skin' + (s.id === cur ? ' on' : '') + (s.owned ? '' : ' locked') +
      (s.id === prev.id ? ' sel' : '') + '" data-skin="' + invEsc(s.id) + '"' +
      (t ? ' style="border-bottom-color:' + t.color + '"' : '') + '>' +
      (s.owned ? '' : '<span class="lk">' + LOCK + '</span>') +
      (t ? '<span class="tier" style="color:' + t.color + '">' + t.name + '</span>' : '') +
      '<span class="inv-skin-ic">' + ((typeof gunIconSVG === 'function' && gunIconSVG(invSel)) || '') + '</span>' +
      '<b>' + invEsc(s.name) + '</b><em>' + (s.id === cur ? 'Equipped' : s.owned ? 'Owned' : 'Locked') + '</em></button>';
  }).join('');

  // what you can do with the skin on the stage
  let act;
  if(prev.id === cur)       act = '<div class="st ok">Equipped</div>';
  else if(!prev.owned)      act = '<div class="st">' + LOCK + 'Locked</div><p>You do not own this skin yet. Preview only.</p>';
  else if(!acctUser)        act = '<div class="st">Sign in to equip</div>';   // (not reachable until skins can be owned)
  else                      act = '<button type="button" class="eq" id="inv-equip">Equip ' + invEsc(prev.name) + '</button>';

  el.querySelector('#inv-skins').innerHTML =
    '<div class="inv-grp">Skins</div><div class="inv-skin-grid">' + tiles +
    (list.length > 1 ? '' : '<div class="inv-skin soon"><span class="inv-lock">' + LOCK +
      '</span><b>Coming soon</b><em>New skins drop here</em></div>') + '</div>' +
    '<div id="inv-act">' + act + '</div>' +
    (acctUser ? '' : '<p class="inv-note">Guests always use the default look. Sign in and your loadout follows you to any device.</p>');
}

// ── BOOT ────────────────────────────────────────────────────────────────────
(function acctBoot(){
  acctBuildBar();
  invBuild();

  // Inventory is its own thing: a button of its own under the logo, not in
  // the How to play / Settings row.
  const hero = document.querySelector('#net-lobby .tt-hero');
  if(hero && !document.getElementById('tt-open-inv')){
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'tt-open-inv';
    b.innerHTML = '<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">' +
      '<path d="M3 10h13l2-2h3v4h-4l-1 2h-4l-1 4H8l1-4H3z"/></svg></span>' +
      '<span><b>Inventory</b><small>Your loadout &amp; skins</small></span><span class="ar">&rsaquo;</span>';
    hero.appendChild(b);
    b.addEventListener('click', invOpen);
  }

  (async () => {
    let cfg;
    try { cfg = await acctFetch('/auth/config'); }
    catch(e){ _acctState = 'noserver'; acctRenderBar(); return; }
    _acctState = 'ready';
    _gClientId = cfg.clientId || null;

    // already signed in from a previous visit? (session cookie)
    let me = null;
    try { me = (await acctFetch('/auth/me')).account; } catch(e){}
    if(me) acctSetUser(me);
    else { acctRenderBar(); acctRenderInventory(); }

    // Google is an extra way in, only when the server has a Client ID
    if(_gClientId) acctLoadGoogle(() => {
      acctGoogleInit();
      acctRenderLoginGoogle();
      // One Tap: a returning Google account is offered with a single tap
      if(!acctUser) try { google.accounts.id.prompt(); } catch(e){}
    });
  })();
})();
