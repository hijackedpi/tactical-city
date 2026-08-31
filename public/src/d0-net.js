// ════════════════════════════════════════════════════════════════════════════
//  d0-net.js — multiplayer
//
//  Self-contained on purpose. It builds its own DOM and CSS at runtime rather
//  than editing index.template.html, so the whole feature is one file you can
//  delete to get single-player back. The only hooks into the rest of the game
//  are five globals the other parts test for by name:
//
//    netFrozen        movement is locked (buy phase, between rounds, dead)
//    netCanShoot()    a0-loop / 90-input ask before firing
//    netCanBuy()      the shop asks before opening
//    netReportHit()   a landed shot on a remote player, sent for adjudication
//    netReportShot()  a cosmetic tracer for everyone else
//    netReportBuy()   tell the server what we spent
//
//  Every one of them is guarded with `typeof ... === 'function'` at the call
//  site, so the game still runs with this file removed from PARTS.
//
//  THE ONE IDEA THAT MATTERS
//  Remote players are drawn 100 ms in the past. We buffer snapshots and
//  interpolate between the two that straddle `now - 100ms` instead of snapping
//  to the newest. Without it, 20 Hz updates look like teleporting; with it,
//  20 Hz looks smooth. That is the difference between netcode that feels broken
//  and netcode nobody notices.
// ════════════════════════════════════════════════════════════════════════════

const NET_SEND_HZ  = 20;
const NET_INTERP_MS = 100;    // render remotes this far behind live
const NET_BUFFER_MS = 1000;   // how much history to keep per player

let netSocket   = null;
let netInMatch  = false;      // true once a match has actually started
let netFrozen   = false;      // read by a0-loop's movement block
let netMyId     = null;
let netMyTeam   = 't';
let netMyAlive  = false;
let netPhase    = 'LOBBY';
let netPhaseEndsAt = 0;
let netClockSkew = 0;         // localNow - serverNow
let netScore    = { t: 0, ct: 0 };
let netRound    = 0;
let netRoster   = [];
let netIsHost   = false;
let netRoomCode = '';
let netIsPublic = false;

let netRooms    = [];         // the public browse list, pushed by the server
let netBrowsing = false;
let netJoinCode = function(){};   // replaced once the socket exists

const netRemote = new Map();  // id -> { obj, buf:[], name, team, label }
const netTracers = [];        // purely visual, never damages anyone

// ── PUBLIC HOOKS ────────────────────────────────────────────────────────────
function netCanShoot(){ return !netInMatch || (netPhase === 'LIVE' && netMyAlive); }
function netCanBuy(){   return !netInMatch || (netPhase === 'BUY'  && netMyAlive); }

function netReportHit(id, damage, zone){
  if(!netSocket || !netInMatch) return;
  netSocket.emit('hit', { target: id, damage, zone, head: zone === 'head' });
}
function netReportShot(pos, dir){
  if(!netSocket || !netInMatch) return;
  netSocket.emit('shot', {
    x:+pos.x.toFixed(2), y:+pos.y.toFixed(2), z:+pos.z.toFixed(2),
    dx:+dir.x.toFixed(3), dy:+dir.y.toFixed(3), dz:+dir.z.toFixed(3),
  });
}
function netReportBuy(weapon, price){
  if(!netSocket || !netInMatch) return;
  netSocket.emit('buy', { weapon, price });
}

// ── UI ──────────────────────────────────────────────────────────────────────
// Injected rather than authored in the template, so this file stays droppable.
(function injectNetStyles(){
  const css = `
  .net-hide{display:none!important}
  #net-lobby{position:fixed;inset:0;z-index:400;display:flex;align-items:center;
    justify-content:center;background:rgba(9,11,15,.93);backdrop-filter:blur(6px);
    font-family:'Stratum2','Arial Narrow','Segoe UI',sans-serif;color:#e8e4dc}
  #net-panel{width:min(520px,92vw);background:#14181f;border:1px solid #2c3441;
    border-top:3px solid #c08a3e;padding:26px 28px 24px;box-shadow:0 24px 70px rgba(0,0,0,.6)}
  #net-panel h2{margin:0 0 4px;font-size:26px;letter-spacing:.06em;font-weight:700;text-transform:uppercase}
  #net-panel .sub{margin:0 0 20px;font-size:14px;color:#8a93a3;letter-spacing:.02em}
  .net-row{display:flex;gap:10px;margin-bottom:12px}
  .net-in{flex:1;background:#0e1219;border:1px solid #2c3441;color:#e8e4dc;padding:11px 13px;
    font:600 15px/1 'Stratum2','Arial Narrow',sans-serif;letter-spacing:.08em;text-transform:uppercase;outline:none}
  .net-in:focus{border-color:#c08a3e}
  .net-btn{background:#c08a3e;color:#12161c;border:none;padding:11px 18px;cursor:pointer;
    font:700 14px/1 'Stratum2','Arial Narrow',sans-serif;letter-spacing:.12em;text-transform:uppercase;transition:filter .15s}
  .net-btn:hover{filter:brightness(1.12)}
  .net-btn.ghost{background:transparent;color:#8a93a3;border:1px solid #2c3441}
  .net-btn.ghost:hover{color:#e8e4dc;border-color:#4a5567}
  .net-btn:disabled{opacity:.4;cursor:not-allowed;filter:none}
  .net-err{color:#e4695c;font-size:13.5px;min-height:19px;margin:2px 0 10px;letter-spacing:.02em}
  .net-code{font:700 30px/1 'Stratum2','Arial Narrow',sans-serif;letter-spacing:.34em;color:#c08a3e;
    background:#0e1219;border:1px dashed #3a4453;padding:14px;text-align:center;margin-bottom:16px}
  .net-list{max-height:230px;overflow-y:auto;margin-bottom:16px;border:1px solid #222a35}
  .net-p{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid #1c232c;font-size:15px}
  .net-p:last-child{border-bottom:none}
  .net-p i{width:3px;height:16px;background:#c08a3e;display:block}
  .net-p.ct i{background:#3f6d9e}
  .net-p .nm{font-weight:600;letter-spacing:.05em}
  .net-p .tag{margin-left:auto;font-size:11px;color:#6e7482;letter-spacing:.14em;text-transform:uppercase}

  .net-sec{display:flex;align-items:center;gap:10px;margin:14px 0 8px;
    font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#7d7263}
  .net-sec span{white-space:nowrap}
  .net-sec::after{content:'';flex:1;height:1px;background:rgba(217,178,90,.16)}
  .net-mini{background:none;border:1px solid #333c48;color:#8a93a3;cursor:pointer;
    padding:4px 9px;font:700 9.5px/1 inherit;letter-spacing:.12em;text-transform:uppercase;order:3}
  .net-mini:hover{color:#e8e4dc;border-color:#5a6577}
  .net-games{max-height:168px;overflow-y:auto;border:1px solid #222a35;background:rgba(8,10,14,.45)}
  .net-empty{padding:16px 12px;text-align:center;color:#6e7482;font-size:13px;letter-spacing:.03em}
  .net-g{display:flex;align-items:center;gap:10px;padding:9px 11px;
    border-bottom:1px solid #1c232c;font-size:13.5px}
  .net-g:last-child{border-bottom:none}
  .net-g .gn{font-weight:600;letter-spacing:.04em;color:#e4dcc9;flex:1;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .net-g .gp{font-variant-numeric:tabular-nums;color:#c08a3e;font-weight:700;white-space:nowrap}
  .net-g .gs{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#6e7482;white-space:nowrap}
  .net-g button{background:#c08a3e;color:#12161c;border:none;cursor:pointer;padding:6px 12px;
    font:700 10.5px/1 inherit;letter-spacing:.12em;text-transform:uppercase}
  .net-g button:hover{filter:brightness(1.12)}
  .net-g button:disabled{opacity:.35;cursor:not-allowed;filter:none}

  #net-bar{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:180;
    display:flex;align-items:center;gap:0;font-family:'Stratum2','Arial Narrow',sans-serif;
    background:rgba(11,14,19,.82);border:1px solid #2c3441;pointer-events:none}
  #net-bar .sc{font:700 26px/1 'Stratum2','Arial Narrow',sans-serif;padding:8px 16px;min-width:56px;text-align:center;
    font-variant-numeric:tabular-nums}
  #net-bar .sc.t{color:#e0a35a;background:rgba(192,138,62,.14)}
  #net-bar .sc.ct{color:#7fa8d8;background:rgba(63,109,158,.14)}
  #net-bar .mid{padding:5px 18px;text-align:center;min-width:112px}
  #net-bar .clock{font:700 21px/1.1 'Stratum2','Arial Narrow',sans-serif;font-variant-numeric:tabular-nums;color:#e8e4dc}
  #net-bar .ph{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:#8a93a3;margin-top:2px}

  #net-feed{position:fixed;top:14px;right:16px;z-index:180;display:flex;flex-direction:column;
    gap:4px;align-items:flex-end;pointer-events:none;font-family:'Stratum2','Arial Narrow',sans-serif}
  .net-kill{background:rgba(11,14,19,.82);border:1px solid #2c3441;padding:5px 11px;font-size:14px;
    letter-spacing:.04em;display:flex;gap:8px;align-items:center;animation:netIn .18s ease-out}
  @keyframes netIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
  .net-kill .t{color:#e0a35a;font-weight:600}
  .net-kill .ct{color:#7fa8d8;font-weight:600}
  .net-kill .w{color:#6e7482;font-size:12px;letter-spacing:.1em;text-transform:uppercase}

  #net-banner{position:fixed;top:34%;left:50%;transform:translate(-50%,-50%);z-index:190;
    text-align:center;font-family:'Stratum2','Arial Narrow',sans-serif;pointer-events:none;text-shadow:0 3px 18px rgba(0,0,0,.7)}
  #net-banner .big{font:700 46px/1 'Stratum2','Arial Narrow',sans-serif;letter-spacing:.06em;text-transform:uppercase}
  #net-banner .small{font-size:16px;letter-spacing:.2em;text-transform:uppercase;color:#c9ccd2;margin-top:8px}

  #net-resume{position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;
    background:rgba(9,11,15,.72);backdrop-filter:blur(3px);cursor:pointer;
    font-family:'Stratum2','Arial Narrow',sans-serif;color:#e8e4dc;text-align:center}
  #net-resume .box{border:1px solid #2c3441;border-top:3px solid #c08a3e;background:#14181f;
    padding:26px 40px;box-shadow:0 20px 60px rgba(0,0,0,.55)}
  #net-resume .big{font-size:30px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
  #net-resume .sub{font-size:14px;color:#8a93a3;letter-spacing:.1em;margin-top:8px;text-transform:uppercase}
  #net-resume .warn{font-size:13px;color:#e4695c;letter-spacing:.04em;margin-top:12px;min-height:17px}

  #net-board{position:fixed;inset:0;z-index:195;display:flex;align-items:center;justify-content:center;
    background:rgba(9,11,15,.78);font-family:'Stratum2','Arial Narrow',sans-serif;pointer-events:none}
  #net-board table{border-collapse:collapse;background:#14181f;border:1px solid #2c3441;min-width:min(560px,92vw)}
  #net-board th{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:#6e7482;
    padding:9px 14px;text-align:left;background:#0e1219}
  #net-board td{padding:8px 14px;font-size:15px;border-top:1px solid #1c232c;color:#d6d2ca;font-variant-numeric:tabular-nums}
  #net-board tr.t td:first-child{box-shadow:inset 3px 0 0 #c08a3e}
  #net-board tr.ct td:first-child{box-shadow:inset 3px 0 0 #3f6d9e}
  #net-board tr.me td{color:#fff;font-weight:600}
  #net-board tr.dead td{opacity:.42}
  #net-board caption{caption-side:top;padding:12px 14px;font:700 17px/1 'Stratum2','Arial Narrow',sans-serif;
    letter-spacing:.14em;text-transform:uppercase;color:#e8e4dc;background:#0e1219;text-align:left}
  `;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();

const netUI = {};
(function buildNetUI(){
  const mk = (tag, id, html) => {
    const el = document.createElement(tag);
    if(id) el.id = id;
    if(html) el.innerHTML = html;
    document.body.appendChild(el);
    return el;
  };

  netUI.lobby = mk('div', 'net-lobby', `
    <div id="net-panel">
      <h2>de_alcazar</h2>
      <p class="sub">Play with up to 10. First to 8 rounds, sides swap at 7.</p>
      <div class="net-row">
        <input class="net-in" id="net-name" maxlength="14" placeholder="Your name" autocomplete="off">
      </div>

      <div class="net-sec">
        <span>Public games</span>
        <button class="net-mini" id="net-refresh" title="Refresh">Refresh</button>
      </div>
      <div class="net-games" id="net-games">
        <div class="net-empty">Looking for games...</div>
      </div>

      <div class="net-sec"><span>Start your own</span></div>
      <div class="net-row">
        <button class="net-btn" id="net-create-pub" style="flex:1">Create public</button>
        <button class="net-btn ghost" id="net-create-priv" style="flex:1">Create private</button>
      </div>

      <div class="net-sec"><span>Have a code?</span></div>
      <div class="net-row">
        <input class="net-in" id="net-code" maxlength="4" placeholder="Code" autocomplete="off">
        <button class="net-btn" id="net-join">Join</button>
      </div>

      <p class="net-err" id="net-err"></p>
      <div class="net-row">
        <button class="net-btn ghost" id="net-solo" style="flex:1">Play solo instead</button>
      </div>
    </div>`);

  netUI.room = mk('div', 'net-room', `
    <div id="net-panel">
      <h2>Lobby</h2>
      <p class="sub">Share this code. The match starts when the host says so.</p>
      <div class="net-code" id="net-roomcode">----</div>
      <div class="net-list" id="net-roster"></div>
      <div class="net-row">
        <button class="net-btn" id="net-start" style="flex:1">Start match</button>
        <button class="net-btn ghost" id="net-leave">Leave</button>
      </div>
      <p class="net-err" id="net-err2"></p>
    </div>`);
  netUI.room.style.cssText = 'position:fixed;inset:0;z-index:400;display:flex;align-items:center;' +
    'justify-content:center;background:rgba(9,11,15,.93);backdrop-filter:blur(6px);' +
    "font-family:'Stratum2','Arial Narrow','Segoe UI',sans-serif;color:#e8e4dc";
  netUI.room.classList.add('net-hide');

  netUI.bar = mk('div', 'net-bar', `
    <div class="sc t" id="net-sc-t">0</div>
    <div class="mid"><div class="clock" id="net-clock">0:00</div><div class="ph" id="net-ph">Warmup</div></div>
    <div class="sc ct" id="net-sc-ct">0</div>`);
  netUI.bar.classList.add('net-hide');

  netUI.feed   = mk('div', 'net-feed');
  netUI.banner = mk('div', 'net-banner', '<div class="big"></div><div class="small"></div>');
  netUI.banner.classList.add('net-hide');
  netUI.board  = mk('div', 'net-board', '<table><caption>Scoreboard</caption><tbody></tbody></table>');
  netUI.board.classList.add('net-hide');

  netUI.resume = mk('div', 'net-resume', `
    <div class="box">
      <div class="big">Click to resume</div>
      <div class="sub">The round is still running</div>
      <div class="warn" id="net-resume-warn"></div>
    </div>`);
  netUI.resume.classList.add('net-hide');

  netUI.$ = id => document.getElementById(id);
})();

function netErr(msg, which){
  const el = netUI.$(which === 2 ? 'net-err2' : 'net-err');
  if(el) el.textContent = msg || '';
}

function netBanner(big, small, ms){
  const b = netUI.banner;
  b.querySelector('.big').textContent = big;
  b.querySelector('.small').textContent = small || '';
  b.classList.remove('net-hide');
  clearTimeout(netBanner._t);
  if(ms) netBanner._t = setTimeout(() => b.classList.add('net-hide'), ms);
}
function netHideBanner(){ clearTimeout(netBanner._t); netUI.banner.classList.add('net-hide'); }

// ── POINTER LOCK ────────────────────────────────────────────────────────────
// Tab away and the browser drops pointer lock. 90-input reacts by reopening the
// deploy screen, and we have to suppress that — its START button runs
// `money = Math.max(money, START_MONEY)`, so letting it appear mid-match would
// hand out free money every time somebody alt-tabbed.
//
// But suppressing it with nothing in its place left the screen with nothing
// clickable at all: the round kept running, the mouse did nothing, and there
// was no way back in. Hence this overlay. A browser will only re-lock the
// pointer from a real user gesture, so a click is genuinely required — it
// cannot be done automatically on visibilitychange.
function netShouldOfferResume(){
  // Solo counts too. The old #instructions screen used to be the way back in
  // after Esc; with it retired, this overlay is the only route.
  const playing = netInMatch || (typeof window !== 'undefined' && window.ttSoloPlaying);
  if(!playing) return false;
  if(document.pointerLockElement) return false;
  if(netInMatch && netPhase === 'MATCH_END') return false;    // scoreboard needs the cursor
  if(!netUI.lobby.classList.contains('net-hide')) return false;
  if(!netUI.room.classList.contains('net-hide')) return false;
  const shop = document.getElementById('shop');
  if(shop && shop.style.display === 'flex') return false;     // buying, cursor wanted
  const modal = document.getElementById('tt-modal');
  if(modal && modal.classList.contains('on')) return false;   // reading the tutorial
  return true;
}

function netUpdateResume(){
  const want = netShouldOfferResume();
  netUI.resume.classList.toggle('net-hide', !want);
  if(want){
    const sub = netUI.resume.querySelector('.sub');
    if(sub) sub.textContent = netMyAlive ? 'The round is still running' : 'Spectating';
  } else {
    const w = netUI.$('net-resume-warn');
    if(w) w.textContent = '';
  }
}

netUI.resume.addEventListener('click', () => {
  const w = netUI.$('net-resume-warn');
  if(w) w.textContent = '';
  // Chrome refuses a re-lock for about a second after Escape released it, and
  // rejects the promise rather than throwing. Say so instead of looking broken.
  let p;
  try { p = document.body.requestPointerLock(); } catch(e){ p = null; }
  if(p && typeof p.catch === 'function'){
    p.catch(() => { if(w) w.textContent = 'Browser blocked that - wait a second and click again.'; });
  }
});

document.addEventListener('pointerlockchange', () => {
  if(netInMatch || !netUI.lobby.classList.contains('net-hide') || !netUI.room.classList.contains('net-hide')){
    const ins = document.getElementById('instructions');
    if(ins) ins.style.display = 'none';
  }
  netUpdateResume();
});

// Coming back to the tab does not restore the lock by itself, but it is the
// moment the overlay needs to be on screen and ready to be clicked.
document.addEventListener('visibilitychange', netUpdateResume);
window.addEventListener('focus', netUpdateResume);
window.addEventListener('blur', netUpdateResume);

// ── CONNECTION ──────────────────────────────────────────────────────────────
(function loadSocketIO(){
  const s = document.createElement('script');
  s.src = '/socket.io/socket.io.js';
  s.onload = netInit;
  s.onerror = () => {
    netErr('Server not reachable - solo play only.');
    const c = netUI.$('net-create'), j = netUI.$('net-join');
    if(c) c.disabled = true;
    if(j) j.disabled = true;
  };
  document.head.appendChild(s);
})();

function netGoSolo(){
  netBrowse(false);
  netUI.lobby.classList.add('net-hide');
  netUI.room.classList.add('net-hide');
  const ins = document.getElementById('instructions');
  if(ins) ins.style.display = 'flex';
}

function netInit(){
  netSocket = io({ transports: ['websocket', 'polling'] });

  const savedName = (() => { try { return localStorage.getItem('alcazar.name') || ''; } catch(e){ return ''; } })();
  if(savedName) netUI.$('net-name').value = savedName;

  const nameOf = () => {
    const v = (netUI.$('net-name').value || '').trim() || 'PLAYER';
    try { localStorage.setItem('alcazar.name', v); } catch(e){}
    return v;
  };

  netUI.$('net-solo').addEventListener('click', netGoSolo);

  function create(isPublic){
    netErr('');
    netSocket.emit('createRoom', { name: nameOf(), isPublic }, res => {
      if(!res || !res.ok) return netErr((res && res.error) || 'Could not create a lobby.');
      netEnterRoom(res);
    });
  }
  netUI.$('net-create-pub').addEventListener('click',  () => create(true));
  netUI.$('net-create-priv').addEventListener('click', () => create(false));

  netUI.$('net-join').addEventListener('click', () => {
    const code = (netUI.$('net-code').value || '').trim().toUpperCase();
    if(code.length !== 4) return netErr('A lobby code is 4 characters.');
    netJoinCode(code);
  });

  netUI.$('net-refresh').addEventListener('click', () => {
    netSocket.emit('listRooms', list => { netRooms = list || []; netRenderRooms(); });
  });

  netUI.$('net-code').addEventListener('keydown', e => { if(e.key === 'Enter') netUI.$('net-join').click(); });
  netUI.$('net-start').addEventListener('click', () => netSocket.emit('startMatch'));
  netUI.$('net-leave').addEventListener('click', () => location.reload());

  // Used by the code box and by every Join button in the browse list.
  netJoinCode = function(code){
    netErr('');
    netSocket.emit('joinRoom', { code, name: nameOf() }, res => {
      if(!res || !res.ok){
        netErr((res && res.error) || 'Could not join.');
        // the list may be stale if that room just filled or closed
        netSocket.emit('listRooms', l => { netRooms = l || []; netRenderRooms(); });
        return;
      }
      netEnterRoom(res);
    });
  };

  netSocket.on('rooms', list => { netRooms = list || []; netRenderRooms(); });
  netBrowse(true);                       // the lobby is the first thing shown

  netSocket.on('disconnect', () => {
    netInMatch = false; netFrozen = true;
    netBanner('Disconnected', 'Reload to rejoin');
  });

  netSocket.on('youAreHost', () => { netIsHost = true; netRenderRoom(); });
  netSocket.on('roster', r => { netRoster = r; netRenderRoom(); netRenderBoard(); netSyncRemotes(); });
  netSocket.on('you', d => netApplyYou(d));
  netSocket.on('phase', d => netApplyPhase(d));
  netSocket.on('roundReset', d => netRoundReset(d));
  netSocket.on('halftime', d => netBanner('Halftime', 'Sides swapped', 4000));
  netSocket.on('snap', d => netApplySnapshot(d));
  netSocket.on('shot', d => netRemoteShot(d));
  netSocket.on('kill', d => netKillFeed(d));
  netSocket.on('hitConfirm', d => netHitMarker(d));
  netSocket.on('matchEnd', d => netMatchEnd(d));
  netSocket.on('chatSys', msg => netKillFeedRaw(msg));
}

function netEnterRoom(res){
  netMyId = res.id;
  netMyTeam = res.team;
  netIsHost = res.isHost;
  netRoomCode = res.code;
  netIsPublic = !!res.isPublic;
  netBrowsing = false;                   // the server drops us from 'browse'
  netUI.lobby.classList.add('net-hide');
  netUI.room.classList.remove('net-hide');
  netUI.$('net-roomcode').textContent = res.code;
  const sub = netUI.room.querySelector('.sub');
  if(sub) sub.textContent = netIsPublic
    ? 'Public game. Anyone can find this in the browser, or join with the code.'
    : 'Private game. Only people with this code can join.';
  netRenderRoom();
}

function netRenderRoom(){
  const host = netUI.$('net-roster');
  if(!host) return;
  host.innerHTML = netRoster.map(p =>
    '<div class="net-p ' + p.team + '"><i></i><span class="nm">' + netEsc(p.name) + '</span>' +
    '<span class="tag">' + (p.team === 't' ? 'Attack' : 'Defence') +
    (p.id === netMyId ? ' · you' : '') + '</span></div>').join('');
  const start = netUI.$('net-start');
  if(start){
    start.style.display = netIsHost ? '' : 'none';
    start.disabled = netRoster.length < 2;
    start.textContent = netRoster.length < 2 ? 'Waiting for players…' : 'Start match (' + netRoster.length + '/10)';
  }
}

// ── PUBLIC GAME BROWSER ─────────────────────────────────────────────────────
function netRenderRooms(){
  const host = netUI.$('net-games');
  if(!host) return;
  if(!netRooms.length){
    host.innerHTML = '<div class="net-empty">No public games right now.<br>' +
      'Create one and it will show up here for everyone.</div>';
    return;
  }
  host.innerHTML = netRooms.map(r => {
    const state = r.phase === 'LOBBY' ? 'Waiting'
                : r.phase === 'MATCH_END' ? 'Finished'
                : 'Round ' + (r.round + 1) + '  ' + r.score.t + '-' + r.score.ct;
    return '<div class="net-g">' +
      '<span class="gn">' + netEsc(r.name) + '</span>' +
      '<span class="gs">' + state + '</span>' +
      '<span class="gp">' + r.players + '/' + r.max + '</span>' +
      '<button data-code="' + r.code + '"' + (r.full ? ' disabled' : '') + '>' +
      (r.full ? 'Full' : 'Join') + '</button></div>';
  }).join('');
  host.querySelectorAll('button[data-code]').forEach(b => {
    b.addEventListener('click', () => netJoinCode(b.dataset.code));
  });
}

// Subscribe only while the lobby is on screen. Playing a match should never
// carry browse traffic.
function netBrowse(on){
  if(!netSocket || netBrowsing === on) return;
  netBrowsing = on;
  netSocket.emit('browse', on, list => {
    if(list){ netRooms = list; netRenderRooms(); }
  });
}

function netEsc(s){
  return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}

// ── PHASE ───────────────────────────────────────────────────────────────────
function netApplyPhase(d){
  netPhase = d.phase;
  netPhaseEndsAt = d.endsAt;
  netClockSkew = Date.now() - d.serverNow;
  netScore = d.score;
  netRound = d.round;

  if(d.phase !== 'LOBBY' && !netInMatch){
    netInMatch = true;
    netUI.room.classList.add('net-hide');
    netUI.lobby.classList.add('net-hide');
    netUI.bar.classList.remove('net-hide');
    const ins = document.getElementById('instructions');
    if(ins) ins.style.display = 'none';
    if(!document.pointerLockElement) document.body.requestPointerLock();
  }

  netUI.$('net-sc-t').textContent  = netScore.t;
  netUI.$('net-sc-ct').textContent = netScore.ct;
  netUI.$('net-ph').textContent =
    d.phase === 'BUY' ? 'Buy time' :
    d.phase === 'LIVE' ? 'Round ' + (netRound + 1) :
    d.phase === 'ROUND_END' ? 'Round over' :
    d.phase === 'MATCH_END' ? 'Match over' : 'Lobby';

  if(d.phase === 'ROUND_END' && d.result){
    const won = d.result.winner === netMyTeam;
    netBanner(won ? 'Round won' : 'Round lost',
              d.result.reason === 'time' ? 'Time expired' : 'Team eliminated', 4200);
  }
  if(d.phase === 'BUY'){
    netHideBanner();
    netBanner('Buy time', 'Press B to open the shop', 3000);
  }
  netUpdateFrozen();
  netUpdateResume();
}

function netApplyYou(d){
  netMyTeam = d.team;
  const wasAlive = netMyAlive;
  netMyAlive = d.alive;
  if(typeof d.money === 'number'){ money = d.money; updateMoneyUI(); }
  if(typeof d.hp === 'number'){
    health = d.hp;
    updateHUD();
    if(d.hp < 100 && d.hp > 0){
      const f = document.getElementById('hit-flash');
      if(f){ f.style.background = 'rgba(255,0,0,0.4)';
             setTimeout(() => { f.style.background = 'rgba(255,0,0,0)'; }, 80); }
      playPlayerHurt();
    }
  }
  if(wasAlive && !netMyAlive){
    playDeath();
    netBanner('Eliminated', 'Spectating until the round ends');
    // Deliberately KEEP pointer lock while dead. Releasing it used to pop the
    // resume overlay on every single death, and you want to be able to look
    // around while you spectate. Movement is already blocked by netFrozen.
  }
  netUpdateFrozen();
  netUpdateResume();
}

function netUpdateFrozen(){
  netFrozen = netInMatch && (netPhase !== 'LIVE' || !netMyAlive);
}

// A new round: back to spawn, back to a pistol. Losing the rifle you bought is
// the entire reason the economy has any weight.
function netRoundReset(d){
  netMyAlive = true;
  health = 100;
  verticalVelocity = 0;
  netHideBanner();

  slots[1] = 'knife'; slots[2] = 'glock18'; slots[3] = null;
  for(const k in GUNS) owned[k] = (GUNS[k].price === 0);
  activeSlot = 2;
  resetAllAmmo();
  equipGun('glock18');
  updateSlotUI();

  const spawn = TEAM_SPAWNS[netMyTeam];
  const sp = randomSpawnIn(spawn);
  yaw = spawn.yaw; pitch = 0;
  camera.position.set(sp[0], 1.7, sp[1]);
  _playerGroundPos.set(sp[0], 1.7, sp[1]);

  for(const b of enemyBullets) scene.remove(b); enemyBullets.length = 0;
  for(const b of playerBullets) scene.remove(b); playerBullets.length = 0;
  for(const t of netTracers) scene.remove(t.mesh); netTracers.length = 0;

  updateHUD(); updateMoneyUI();
  // A respawn is not a user gesture, so this can be refused. The resume overlay
  // is the fallback and will show itself if the lock did not take.
  if(!document.pointerLockElement){
    try { const p = document.body.requestPointerLock(); if(p && p.catch) p.catch(()=>{}); } catch(e){}
  }
  netUpdateFrozen();
  setTimeout(netUpdateResume, 60);
}

function netMatchEnd(d){
  netInMatch = true;
  netFrozen = true;
  const won = d.winner === netMyTeam;
  netBanner(won ? 'Victory' : 'Defeat', d.score.t + ' — ' + d.score.ct);
  netUI.board.classList.remove('net-hide');
  if(document.pointerLockElement) document.exitPointerLock();
}

// ── SNAPSHOTS AND INTERPOLATION ─────────────────────────────────────────────
// Snapshots are stamped with LOCAL arrival time, not server time. Network
// jitter adds a little noise, but it removes clock synchronisation entirely —
// and at a 100 ms buffer the jitter is well inside the margin.
function netApplySnapshot(d){
  const now = performance.now();
  const seen = new Set();
  for(const row of d.p){
    const [id, x, y, z, yw, pt, moving] = row;
    seen.add(id);
    if(id === netMyId) continue;
    let r = netRemote.get(id);
    if(!r) r = netSpawnRemote(id);
    if(!r) continue;
    r.buf.push({ t: now, x, y, z, yaw: yw, pitch: pt, moving: !!moving });
    while(r.buf.length > 2 && now - r.buf[0].t > NET_BUFFER_MS) r.buf.shift();
    r.lastSeen = now;
  }
  // Anyone absent from the snapshot is dead or gone — hide rather than destroy,
  // because they will be back next round.
  //
  // netDead is NOT the same thing as `visible`, and that distinction matters:
  // a0-loop also drives `visible` for frustum culling, so an ALIVE player who
  // walks off screen goes invisible too. Bullets must still be able to reach
  // them, and must NOT be able to reach a corpse — so the two need separate
  // flags. A body left in `enemies` with no way to tell it is dead is what let
  // an invisible corpse swallow rounds meant for the living.
  for(const [id, r] of netRemote){
    const alive = seen.has(id);
    r.obj.userData.netDead = !alive;
    if(!alive && r.obj.visible) r.obj.visible = false;
  }
}

function netSpawnRemote(id){
  const info = netRoster.find(p => p.id === id);
  const team = info ? info.team : 'ct';
  const obj = makeEnemy(team);
  obj.userData.isRemote = true;
  obj.userData.netId = id;
  obj.userData.netYaw = 0;
  obj.userData.team = team;
  scene.add(obj);
  enemies.push(obj);            // reuse the existing bullet + health-bar path
  const r = { obj, buf: [], name: info ? info.name : '???', team, label: null, lastSeen: 0 };
  // Sit above the health bar, which itself sits above the body — so the whole
  // stack follows _OP_SCALE without three separate numbers to keep in step.
  r.label = netNameTag(r.name, team, (obj.userData.height || 1.81) + 0.61);
  obj.add(r.label);
  netRemote.set(id, r);
  return r;
}

function netDestroyRemote(id){
  const r = netRemote.get(id);
  if(!r) return;
  scene.remove(r.obj);
  const i = enemies.indexOf(r.obj);
  if(i >= 0) enemies.splice(i, 1);
  netRemote.delete(id);
}

// Rebuild when the roster changes — team swaps at halftime mean the body colour
// and the name tag are both stale.
function netSyncRemotes(){
  const live = new Set(netRoster.map(p => p.id));
  for(const id of [...netRemote.keys()]) if(!live.has(id)) netDestroyRemote(id);
  for(const p of netRoster){
    if(p.id === netMyId) continue;
    const r = netRemote.get(p.id);
    if(r && r.team !== p.team) netDestroyRemote(p.id);   // respawned next snapshot
  }
}

function netNameTag(name, team, y){
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const c = cv.getContext('2d');
  c.font = "bold 34px Stratum2, 'Arial Narrow', sans-serif";
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.75)';
  c.strokeText(name, 128, 34);
  c.fillStyle = team === 't' ? '#e0a35a' : '#8fb6e0';
  c.fillText(name, 128, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  spr.scale.set(1.5, 0.375, 1);
  spr.position.y = y || 2.42;
  spr.renderOrder = 1000;
  return spr;
}

// The 100 ms rewind. Find the two samples straddling the render time and lerp.
const _netTmpA = { x:0, y:0, z:0 };
function netInterpolate(now){
  const renderAt = now - NET_INTERP_MS;
  for(const r of netRemote.values()){
    const b = r.buf;
    if(b.length === 0) continue;

    let a = null, c = null;
    for(let i = b.length - 1; i >= 0; i--){
      if(b[i].t <= renderAt){ a = b[i]; c = b[i + 1] || null; break; }
    }
    // Not enough history yet, or we have fallen behind the buffer: sit on the
    // oldest or newest sample rather than extrapolating into a guess.
    if(!a){ a = b[0]; c = b[1] || null; }
    if(!c) c = a;

    const span = c.t - a.t;
    const k = span > 0 ? Math.max(0, Math.min(1, (renderAt - a.t) / span)) : 0;

    r.obj.visible = true;
    r.obj.position.set(a.x + (c.x - a.x) * k, a.y + (c.y - a.y) * k, a.z + (c.z - a.z) * k);
    // Yaw needs the short way round, or a player crossing north spins 350°.
    let dy = c.yaw - a.yaw;
    while(dy >  Math.PI) dy -= Math.PI * 2;
    while(dy < -Math.PI) dy += Math.PI * 2;
    r.obj.userData.netYaw = a.yaw + dy * k;

    // Leg swing, driven from whether they are actually moving.
    const ud = r.obj.userData;
    if(ud.legL){
      if(a.moving){
        ud.walkPhase += 0.22;
        const sw = Math.sin(ud.walkPhase) * 0.42;
        ud.legL.rotation.x = sw;  ud.legR.rotation.x = -sw;
        if(ud.armL){ ud.armL.rotation.x = -0.25 - sw * 0.5; ud.armR.rotation.x = -0.25 + sw * 0.5; }
      } else {
        ud.legL.rotation.x *= 0.8; ud.legR.rotation.x *= 0.8;
      }
    }
    if(r.label) r.label.material.opacity =
      r.obj.position.distanceTo(camera.position) < 45 ? 1 : 0;
  }
}

// ── COSMETIC TRACERS ────────────────────────────────────────────────────────
// These never touch anyone. Damage arrives from the server as a health update,
// so a tracer that also did damage would count every hit twice.
const _netTracerGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 5);
_netTracerGeo.rotateX(-Math.PI / 2);
const _netTracerMat = new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.85 });

function netRemoteShot(d){
  const m = new THREE.Mesh(_netTracerGeo, _netTracerMat);
  m.position.set(d.x, d.y, d.z);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(d.dx, d.dy, d.dz).normalize());
  m.scale.z = 6;
  m.frustumCulled = false;
  scene.add(m);
  netTracers.push({ mesh: m, life: 0, vel: new THREE.Vector3(d.dx, d.dy, d.dz).multiplyScalar(2.4) });
  if(typeof playEnemyShot === 'function') playEnemyShot();
}

function netStepTracers(){
  for(let i = netTracers.length - 1; i >= 0; i--){
    const t = netTracers[i];
    t.mesh.position.add(t.vel);
    if(++t.life > 14){ scene.remove(t.mesh); netTracers.splice(i, 1); }
  }
}

// ── FEEDBACK ────────────────────────────────────────────────────────────────
function netKillFeed(d){
  netKillFeedRaw(
    '<span class="' + d.killerTeam + '">' + netEsc(d.killerName) + '</span>' +
    '<span class="w">' + netEsc(d.weapon) + (d.head ? ' · HS' : '') + '</span>' +
    '<span class="' + d.victimTeam + '">' + netEsc(d.victimName) + '</span>');
  if(d.killer === netMyId && typeof playKill === 'function') playKill();
}

function netKillFeedRaw(html){
  const el = document.createElement('div');
  el.className = 'net-kill';
  el.innerHTML = html;
  netUI.feed.appendChild(el);
  while(netUI.feed.children.length > 5) netUI.feed.removeChild(netUI.feed.firstChild);
  setTimeout(() => el.remove(), 6000);
}

function netHitMarker(d){
  const x = document.getElementById('crosshair') || document.getElementById('cs-crosshair');
  if(!x) return;
  x.style.transform = 'scale(1.45)';
  x.style.filter = d.head ? 'brightness(2.2)' : 'brightness(1.6)';
  setTimeout(() => { x.style.transform = ''; x.style.filter = ''; }, 90);
}

function netRenderBoard(){
  const tb = netUI.board.querySelector('tbody');
  if(!tb) return;
  const order = [...netRoster].sort((a, b) =>
    a.team === b.team ? (b.kills - a.kills) : (a.team === 't' ? -1 : 1));
  tb.innerHTML =
    '<tr><th>Player</th><th>Side</th><th>K</th><th>D</th><th>$</th></tr>' +
    order.map(p =>
      '<tr class="' + p.team + (p.id === netMyId ? ' me' : '') + (p.alive ? '' : ' dead') + '">' +
      '<td>' + netEsc(p.name) + '</td>' +
      '<td>' + (p.team === 't' ? 'Attack' : 'Defence') + '</td>' +
      '<td>' + p.kills + '</td><td>' + p.deaths + '</td>' +
      '<td>' + (p.id === netMyId ? '$' + p.money : '—') + '</td></tr>').join('');
  netUI.board.querySelector('caption').textContent =
    'Scoreboard   ' + netScore.t + ' — ' + netScore.ct + '   ·   Round ' + (netRound + 1);
}

addEventListener('keydown', e => {
  if(e.code === 'Tab' && netInMatch){
    e.preventDefault();
    netRenderBoard();
    netUI.board.classList.remove('net-hide');
  }
});
addEventListener('keyup', e => {
  if(e.code === 'Tab' && netPhase !== 'MATCH_END') netUI.board.classList.add('net-hide');
});

// ── THE NETWORK FRAME ───────────────────────────────────────────────────────
// A loop of its own rather than a fifth hook inside animate(). Ordering against
// the render is irrelevant here: remote bodies are already 100 ms behind by
// design, so one extra frame of latency is not observable.
let _netLastSend = 0;

(function netFrame(){
  requestAnimationFrame(netFrame);
  const now = performance.now();

  if(netSocket && netInMatch){
    if(now - _netLastSend >= 1000 / NET_SEND_HZ){
      _netLastSend = now;
      if(netMyAlive){
        const p = _playerGroundPos;
        // Send FEET height, not eye height. _playerGroundPos.y tracks the eye
        // (it sits at 1.7 when you are stood on the ground), and a remote body's
        // group origin is at its feet — so sending it raw floated every player
        // a full 1.7 units off the floor. a0-loop already does this exact
        // subtraction when it places the local body; this matches it.
        netSocket.emit('input', {
          x: p.x, y: p.y - FEET_OFFSET, z: p.z, yaw, pitch,
          moving: !!(keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD']),
          weapon: selectedGunKey,
        });
      }
    }
    netInterpolate(now);
    netStepTracers();

    // Round clock, counted against the server's deadline corrected for skew.
    const el = netUI.$('net-clock');
    if(el && netPhaseEndsAt){
      const left = Math.max(0, netPhaseEndsAt + netClockSkew - Date.now());
      const s = Math.ceil(left / 1000);
      el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    } else if(el){
      el.textContent = '--:--';
    }
  }
})();

console.log('net: ready — lobby overlay is up, or click "Play solo instead".');
