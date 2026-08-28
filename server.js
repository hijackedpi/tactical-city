// ════════════════════════════════════════════════════════════════════════════
//  de_alcazar — game server
//
//  Static file host (as before) plus an authoritative round server.
//
//  WHAT THE SERVER OWNS, AND WHY
//  Movement is relayed, not simulated: each client tells us where it is and we
//  forward that on. That is cheatable, and deliberately so — it costs 20 lines
//  instead of 2000 and it is the right trade for a game you play with friends.
//
//  Round state is NOT relayed. Phase, score, health, deaths and money all live
//  here, because ten clients each deciding independently when a round ended is
//  not a game, it is ten different games. This is the one part that would be
//  painful to retrofit later, so it is authoritative from day one.
// ════════════════════════════════════════════════════════════════════════════
const express = require('express');
const http    = require('http');
const path    = require('path');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { pingInterval: 10000, pingTimeout: 20000 });

// ── STATIC FILES, AND WHY THE CACHE RULES MATTER ────────────────────────────
// express.static defaults to maxAge 0, and builds its ETag from file SIZE and
// MTIME (see send/etag: '"' + size + '-' + mtime + '"'). Every deploy is a
// fresh git checkout, which stamps every file with a new mtime — so every
// ETag changes, every browser cache misses, and all ~270 MB of models download
// again even though not one byte of them changed. That is why the game is
// rough for a while after each deploy and fine afterwards.
//
// Assets are content-addressed by name (a Meshy export never changes under a
// given filename), so they get a year and `immutable`: the browser serves them
// from disk WITHOUT asking, and a redeploy cannot invalidate them.
//
// The catch: if you ever replace a .glb while keeping its filename, browsers
// will keep the old one for a year. Change the filename when the content
// changes — which is what WEAPON_FILES / STRUCTURE_FILES already do.
//
// Code and markup get `no-cache`, which does NOT mean "never cache" — it means
// "revalidate before use". Those files are small, so a 304 is cheap, and it
// keeps your edits deploying instantly.
const IMMUTABLE = /\.(glb|gltf|bin|png|jpe?g|webp|ktx2|woff2?|mp3|ogg)$/i;
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  setHeaders(res, filePath){
    if(IMMUTABLE.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    else                         res.setHeader('Cache-Control', 'no-cache');
  },
}));

// ── RULES ───────────────────────────────────────────────────────────────────
const MAX_PLAYERS   = 10;      // 5v5
const MIN_TO_START  = 2;
const ROUNDS_TO_WIN = 8;       // first to 8
const SWAP_AFTER    = 7;       // sides swap once 7 rounds have been played

// Overridable so you can run a whole match in seconds while testing:
//   BUY_MS=800 LIVE_MS=2000 ROUND_END_MS=400 npm start
const envMs = (name, dflt) => Number(process.env[name]) || dflt;
const BUY_MS       = envMs('BUY_MS', 15000);        // frozen in spawn, shop open
const LIVE_MS      = envMs('LIVE_MS', 115000);      // 1:55, same as CS
const ROUND_END_MS = envMs('ROUND_END_MS', 5000);   // beat before the next buy
const TICK_MS      = envMs('TICK_MS', 50);          // 20 Hz snapshot rate

// CS-style economy. The loss bonus is what creates eco rounds: lose repeatedly
// and you accumulate enough to force-buy, so a losing team is never dead money.
const START_MONEY  = 800;
const MAX_MONEY    = 16000;
const WIN_REWARD   = 3250;
const LOSS_BONUS   = [1400, 1900, 2400, 2900, 3400];   // by consecutive losses
const KILL_REWARD  = {                                  // by weapon key
  knife: 1500, glock18: 300, deagle: 300,
  mac10: 600, mp5: 600, mp7: 600, ump45: 600,
  ak47: 300, m4a1: 300, awp: 100,
};
const DEFAULT_KILL_REWARD = 300;

// ── ROOMS ───────────────────────────────────────────────────────────────────
/** @type {Map<string, Room>} */
const rooms = new Map();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no I/O/0/1
function makeCode(){
  let code;
  do {
    code = '';
    for(let i = 0; i < 4; i++)
      code += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
  } while(rooms.has(code));
  return code;
}

function createRoom(hostId, opts){
  const o = opts || {};
  const room = {
    code: makeCode(),
    hostId,
    // Public rooms appear in the browse list; private ones are reachable only
    // by their code. Both work identically once you are inside.
    isPublic: !!o.isPublic,
    name: '',                       // filled from the host's name on join
    players: new Map(),
    phase: 'LOBBY',
    phaseEndsAt: 0,
    round: 0,                       // rounds completed
    score: { t: 0, ct: 0 },
    lossStreak: { t: 0, ct: 0 },
    sidesSwapped: false,
    lastResult: null,               // {winner, reason} for the round-end card
    phaseTimer: null,
    tickTimer: null,
  };
  rooms.set(room.code, room);
  room.tickTimer = setInterval(() => tick(room), TICK_MS);
  return room;
}

function destroyRoom(room){
  clearTimeout(room.phaseTimer);
  clearInterval(room.tickTimer);
  rooms.delete(room.code);
  broadcastRooms();
}

// Balance on join rather than letting players pick — with a 10 cap and drop-in
// joining, self-selection reliably produces 7v3.
function pickTeam(room){
  let t = 0, ct = 0;
  for(const p of room.players.values()) (p.team === 't' ? t++ : ct++);
  if(t < ct) return 't';
  if(ct < t) return 'ct';
  return Math.random() < 0.5 ? 't' : 'ct';
}

// Rooms offered to the browser. Full and in-progress rooms are included
// rather than hidden: a list that silently drops entries reads as broken, and
// seeing "10/10" tells you more than an empty screen does.
function publicRoomList(){
  const out = [];
  for(const r of rooms.values()){
    if(!r.isPublic || r.players.size === 0) continue;
    out.push({
      code: r.code,
      name: r.name || 'Open game',
      players: r.players.size,
      max: MAX_PLAYERS,
      phase: r.phase,
      round: r.round,
      score: r.score,
      full: r.players.size >= MAX_PLAYERS,
    });
  }
  // Fullest first: a room with people in it is the one worth joining.
  return out.sort((a, b) => b.players - a.players).slice(0, 40);
}

// Pushed rather than polled. Clients sitting on the lobby screen join the
// 'browse' socket.io room and are told when anything changes, so the list is
// live without every idle client hammering the server on a timer.
function broadcastRooms(){
  io.to('browse').emit('rooms', publicRoomList());
}

function makePlayer(id, name, team){
  return {
    id, name, team,
    alive: false, hp: 0,
    money: START_MONEY,
    kills: 0, deaths: 0, score: 0,
    weapon: 'glock18',
    x: 0, y: 1.7, z: 0, yaw: 0, pitch: 0,
    moving: false,
    lastHitAt: 0,
  };
}

// ── SERIALISATION ───────────────────────────────────────────────────────────
// Two shapes, sent at very different rates. The snapshot is the 20 Hz one, so
// it carries only what has to be smooth; everything else rides on phase events.
function snapshotOf(room){
  const out = [];
  for(const p of room.players.values()){
    if(!p.alive) continue;
    out.push([
      p.id,
      Math.round(p.x * 100) / 100,
      Math.round(p.y * 100) / 100,
      Math.round(p.z * 100) / 100,
      Math.round(p.yaw * 1000) / 1000,
      Math.round(p.pitch * 1000) / 1000,
      p.moving ? 1 : 0,
    ]);
  }
  return out;
}

function rosterOf(room){
  return [...room.players.values()].map(p => ({
    id: p.id, name: p.name, team: p.team, alive: p.alive, hp: p.hp,
    kills: p.kills, deaths: p.deaths, money: p.money, weapon: p.weapon,
  }));
}

function phasePayload(room){
  return {
    phase: room.phase,
    endsAt: room.phaseEndsAt,
    serverNow: Date.now(),          // lets clients correct for clock skew
    round: room.round,
    score: room.score,
    sidesSwapped: room.sidesSwapped,
    result: room.lastResult,
    roundsToWin: ROUNDS_TO_WIN,
  };
}

function broadcastPhase(room){
  io.to(room.code).emit('phase', phasePayload(room));
  io.to(room.code).emit('roster', rosterOf(room));
  // Money is per-player and secret-ish, so it goes direct rather than in roster.
  for(const p of room.players.values())
    io.to(p.id).emit('you', { id: p.id, team: p.team, money: p.money, hp: p.hp, alive: p.alive });
}

function tick(room){
  if(room.phase === 'LIVE' || room.phase === 'BUY')
    io.to(room.code).emit('snap', { t: Date.now(), p: snapshotOf(room) });
}

// ── PHASE MACHINE ───────────────────────────────────────────────────────────
function setPhase(room, phase, ms, after){
  clearTimeout(room.phaseTimer);
  room.phase = phase;
  room.phaseEndsAt = ms ? Date.now() + ms : 0;
  broadcastPhase(room);
  broadcastRooms();                 // the list shows phase and score
  if(ms) room.phaseTimer = setTimeout(() => after(room), ms);
}

function startMatch(room){
  room.round = 0;
  room.score = { t: 0, ct: 0 };
  room.lossStreak = { t: 0, ct: 0 };
  room.sidesSwapped = false;
  room.lastResult = null;
  for(const p of room.players.values()){
    p.money = START_MONEY;
    p.kills = 0; p.deaths = 0;
  }
  beginBuy(room);
}

function beginBuy(room){
  // Everyone comes back alive with a fresh pistol. Losing your rifle on death
  // is the whole reason the economy has any tension.
  for(const p of room.players.values()){
    p.alive = true;
    p.hp = 100;
    p.weapon = 'glock18';
  }
  io.to(room.code).emit('roundReset', { round: room.round + 1 });
  setPhase(room, 'BUY', BUY_MS, beginLive);
}

function beginLive(room){
  setPhase(room, 'LIVE', LIVE_MS, () => {
    // Elimination has no natural timeout rule, so the side with more players
    // standing takes it. A dead tie goes to CT, matching CS convention.
    const alive = countAlive(room);
    const winner = alive.t > alive.ct ? 't' : alive.ct > alive.t ? 'ct' : 'ct';
    endRound(room, winner, 'time');
  });
}

function countAlive(room){
  let t = 0, ct = 0;
  for(const p of room.players.values())
    if(p.alive) (p.team === 't' ? t++ : ct++);
  return { t, ct };
}

// Called after every death. Cheap enough to run eagerly.
function checkElimination(room){
  if(room.phase !== 'LIVE') return;
  const a = countAlive(room);
  if(a.t === 0 && a.ct === 0) return endRound(room, 'ct', 'trade');
  if(a.t === 0)  return endRound(room, 'ct', 'elimination');
  if(a.ct === 0) return endRound(room, 't',  'elimination');
}

function endRound(room, winner, reason){
  if(room.phase !== 'LIVE') return;
  clearTimeout(room.phaseTimer);

  const loser = winner === 't' ? 'ct' : 't';
  room.score[winner]++;
  room.round++;
  room.lastResult = { winner, reason };

  // Payouts. Winners take a flat purse; losers take an escalating consolation
  // that resets the moment they win one.
  room.lossStreak[loser] = Math.min(room.lossStreak[loser] + 1, LOSS_BONUS.length);
  room.lossStreak[winner] = 0;
  const lossPay = LOSS_BONUS[Math.max(0, room.lossStreak[loser] - 1)];
  for(const p of room.players.values()){
    p.money = Math.min(MAX_MONEY, p.money + (p.team === winner ? WIN_REWARD : lossPay));
    p.alive = false;
  }

  if(room.score[winner] >= ROUNDS_TO_WIN) return endMatch(room, winner);

  setPhase(room, 'ROUND_END', ROUND_END_MS, r => {
    if(r.round === SWAP_AFTER && !r.sidesSwapped) swapSides(r);
    beginBuy(r);
  });
}

function swapSides(room){
  room.sidesSwapped = true;
  for(const p of room.players.values()){
    p.team = p.team === 't' ? 'ct' : 't';
    p.money = START_MONEY;         // both sides restart the economy at halftime
  }
  const s = room.score;
  room.score = { t: s.ct, ct: s.t };
  room.lossStreak = { t: 0, ct: 0 };
  io.to(room.code).emit('halftime', { score: room.score });
}

function endMatch(room, winner){
  for(const p of room.players.values()) p.alive = false;
  room.lastResult = { winner, reason: 'match' };
  setPhase(room, 'MATCH_END', 0, () => {});
  io.to(room.code).emit('matchEnd', { winner, score: room.score, roster: rosterOf(room) });
}

// ── CONNECTIONS ─────────────────────────────────────────────────────────────
function roomOf(socket){
  const code = socket.data.room;
  return code ? rooms.get(code) : null;
}

function cleanName(n){
  return String(n || 'PLAYER').replace(/[^\w \-]/g, '').trim().slice(0, 14).toUpperCase() || 'PLAYER';
}

io.on('connection', socket => {

  // Accepts either a bare name (the original shape) or {name, isPublic}, so an
  // older client keeps working and simply gets a private room.
  socket.on('createRoom', (arg, cb) => {
    const isObj = arg && typeof arg === 'object';
    const name  = cleanName(isObj ? arg.name : arg);
    const room  = createRoom(socket.id, { isPublic: isObj && !!arg.isPublic });
    room.name   = name + "'S GAME";
    joinRoom(socket, room, name, cb);
  });

  socket.on('joinRoom', ({ code, name }, cb) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if(!room) return cb && cb({ ok: false, error: 'No lobby with that code.' });
    if(room.players.size >= MAX_PLAYERS) return cb && cb({ ok: false, error: 'That lobby is full (10 players).' });
    joinRoom(socket, room, cleanName(name), cb);
  });

  // Browsing. A client on the lobby screen subscribes and gets pushed updates;
  // it is dropped from the subscription the moment it is inside a room, so a
  // player never receives list traffic while actually playing.
  socket.on('browse', (on, cb) => {
    if(on){ socket.join('browse'); if(cb) cb(publicRoomList()); }
    else socket.leave('browse');
  });
  socket.on('listRooms', cb => { if(cb) cb(publicRoomList()); });

  function joinRoom(socket, room, name, cb){
    const team = pickTeam(room);
    const p = makePlayer(socket.id, name, team);
    // Drop-in mid-match: you sit out until the next round rather than appearing
    // in the middle of a live one.
    if(room.phase === 'BUY'){ p.alive = true; p.hp = 100; }
    room.players.set(socket.id, p);
    socket.join(room.code);
    socket.leave('browse');            // you are in a game now, not shopping
    socket.data.room = room.code;
    cb && cb({ ok: true, code: room.code, id: socket.id, team,
               isHost: room.hostId === socket.id, max: MAX_PLAYERS,
               isPublic: room.isPublic, roomName: room.name });
    io.to(room.code).emit('chatSys', name + ' joined');
    broadcastPhase(room);
    broadcastRooms();
  }

  socket.on('startMatch', () => {
    const room = roomOf(socket);
    if(!room || room.hostId !== socket.id) return;
    if(room.phase !== 'LOBBY' && room.phase !== 'MATCH_END') return;
    if(room.players.size < MIN_TO_START)
      return socket.emit('chatSys', 'Need at least ' + MIN_TO_START + ' players.');
    startMatch(room);
  });

  // 20 Hz from each client. Trusted, clamped only enough to stop nonsense
  // reaching other clients' renderers.
  socket.on('input', d => {
    const room = roomOf(socket);
    if(!room) return;
    const p = room.players.get(socket.id);
    if(!p || !p.alive) return;
    if(!Number.isFinite(d.x) || !Number.isFinite(d.y) || !Number.isFinite(d.z)) return;
    p.x = Math.max(-60, Math.min(60, d.x));
    p.y = Math.max(-5,  Math.min(40, d.y));
    p.z = Math.max(-60, Math.min(60, d.z));
    p.yaw = d.yaw || 0;
    p.pitch = d.pitch || 0;
    p.moving = !!d.moving;
    if(typeof d.weapon === 'string') p.weapon = d.weapon.slice(0, 12);
  });

  // Purely cosmetic — lets everyone else see a tracer and hear the shot.
  socket.on('shot', d => {
    const room = roomOf(socket);
    if(!room || room.phase !== 'LIVE') return;
    const p = room.players.get(socket.id);
    if(!p || !p.alive) return;
    socket.to(room.code).emit('shot', {
      id: socket.id, weapon: p.weapon,
      x: d.x, y: d.y, z: d.z, dx: d.dx, dy: d.dy, dz: d.dz,
    });
  });

  // The shooter's client decides it connected; we decide what that costs.
  // Tier 1 trusts the claim but still owns the consequences, so every client
  // agrees on who is alive.
  socket.on('hit', ({ target, damage, head }) => {
    const room = roomOf(socket);
    if(!room || room.phase !== 'LIVE') return;
    const shooter = room.players.get(socket.id);
    const victim  = room.players.get(target);
    if(!shooter || !victim || !shooter.alive || !victim.alive) return;
    if(shooter.id === victim.id) return;
    if(shooter.team === victim.team) return;          // no friendly fire

    const now = Date.now();
    if(now - shooter.lastHitAt < 25) return;          // crude rate limit
    shooter.lastHitAt = now;

    // 300, not 120. A headshot multiplier can legitimately exceed 100 — a
    // Deagle head hit is 60 x 4 = 240 — and the old ceiling silently ate that,
    // turning one-shot kills into survivable hits. Still a sanity bound.
    const dmg = Math.max(1, Math.min(300, Number(damage) || 0));
    victim.hp -= dmg;
    io.to(victim.id).emit('you', { id: victim.id, team: victim.team, money: victim.money, hp: Math.max(0, victim.hp), alive: victim.hp > 0 });
    io.to(shooter.id).emit('hitConfirm', { head: !!head, lethal: victim.hp <= 0 });

    if(victim.hp <= 0){
      victim.alive = false;
      victim.hp = 0;
      victim.deaths++;
      shooter.kills++;
      shooter.money = Math.min(MAX_MONEY,
        shooter.money + (KILL_REWARD[shooter.weapon] ?? DEFAULT_KILL_REWARD));
      io.to(room.code).emit('kill', {
        killer: shooter.id, killerName: shooter.name, killerTeam: shooter.team,
        victim: victim.id, victimName: victim.name, victimTeam: victim.team,
        weapon: shooter.weapon, head: !!head,
      });
      io.to(shooter.id).emit('you', { id: shooter.id, team: shooter.team, money: shooter.money, hp: shooter.hp, alive: true });
      io.to(room.code).emit('roster', rosterOf(room));
      checkElimination(room);
    }
  });

  // Client spends locally for responsiveness and tells us after; we are the
  // record of truth and push the corrected figure straight back.
  socket.on('buy', ({ weapon, price }) => {
    const room = roomOf(socket);
    if(!room || room.phase !== 'BUY') return;
    const p = room.players.get(socket.id);
    if(!p) return;
    const cost = Math.max(0, Math.min(MAX_MONEY, Number(price) || 0));
    if(cost > p.money) return socket.emit('you', { id: p.id, team: p.team, money: p.money, hp: p.hp, alive: p.alive });
    p.money -= cost;
    if(typeof weapon === 'string') p.weapon = weapon.slice(0, 12);
    socket.emit('you', { id: p.id, team: p.team, money: p.money, hp: p.hp, alive: p.alive });
  });

  socket.on('chat', msg => {
    const room = roomOf(socket);
    if(!room) return;
    const p = room.players.get(socket.id);
    if(!p) return;
    const text = String(msg || '').slice(0, 120);
    if(!text.trim()) return;
    io.to(room.code).emit('chat', { name: p.name, team: p.team, text });
  });

  socket.on('disconnect', () => {
    const room = roomOf(socket);
    if(!room) return;
    const p = room.players.get(socket.id);
    room.players.delete(socket.id);
    if(p) io.to(room.code).emit('chatSys', p.name + ' left');

    if(room.players.size === 0) return destroyRoom(room);
    broadcastRooms();
    // Host migration, so one person leaving does not strand the lobby.
    if(room.hostId === socket.id){
      room.hostId = room.players.keys().next().value;
      io.to(room.hostId).emit('youAreHost');
    }
    io.to(room.code).emit('roster', rosterOf(room));
    checkElimination(room);          // their death may have ended the round
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('de_alcazar server on port ' + PORT);
});

module.exports = { app, server, io, rooms };
