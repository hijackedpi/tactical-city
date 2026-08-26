// Drives a real 4-player match against the real server over real sockets.
// Asserts the round machine, elimination, economy, side swap and match end.
const { io } = require('socket.io-client');

const URL = 'http://localhost:3101';
const log = (...a) => console.log(...a);
let failures = 0;
function check(label, got, want){
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if(!ok) failures++;
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label +
    (ok ? '' : '   got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want)));
}

function connect(name){
  return new Promise(res => {
    const s = io(URL, { transports: ['websocket'] });
    s.state = { name, phase: null, you: null, kills: [], phases: [], halftimes: 0, ended: null, snaps: 0 };
    s.on('phase', d => { s.state.phase = d; s.state.phases.push(d.phase); });
    s.on('you', d => { s.state.you = d; });
    s.on('kill', d => s.state.kills.push(d));
    s.on('halftime', () => s.state.halftimes++);
    s.on('matchEnd', d => { s.state.ended = d; });
    s.on('snap', () => s.state.snaps++);
    s.on('roster', r => { s.state.roster = r; });
    s.on('connect', () => res(s));
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitFor = async (fn, ms = 4000) => {
  const t0 = Date.now();
  while(Date.now() - t0 < ms){ if(fn()) return true; await sleep(20); }
  return false;
};

(async () => {
  log('\n─── connecting 4 players ───');
  const A = await connect('ALPHA');
  const B = await connect('BRAVO');
  const C = await connect('CHARLIE');
  const D = await connect('DELTA');

  const code = await new Promise(res => A.emit('createRoom', 'ALPHA', r => res(r.code)));
  log('  lobby code:', code);

  const joins = [];
  for(const [s, n] of [[B, 'BRAVO'], [C, 'CHARLIE'], [D, 'DELTA']])
    joins.push(new Promise(res => s.emit('joinRoom', { code, name: n }, res)));
  const results = await Promise.all(joins);
  check('all three joined', results.map(r => r.ok), [true, true, true]);

  await waitFor(() => A.state.roster && A.state.roster.length === 4);
  const teams = A.state.roster.map(p => p.team);
  const tCount = teams.filter(x => x === 't').length;
  check('teams auto-balanced 2v2', tCount, 2);

  // ── capacity ──
  log('\n─── 10-player cap ───');
  const extras = [];
  for(let i = 0; i < 6; i++) extras.push(await connect('EXTRA' + i));
  const extraRes = [];
  for(const e of extras)
    extraRes.push(await new Promise(res => e.emit('joinRoom', { code, name: 'X' }, res)));
  check('players 5-10 admitted', extraRes.map(r => r.ok), [true, true, true, true, true, true]);
  const eleventh = await connect('ELEVENTH');
  const rej = await new Promise(res => eleventh.emit('joinRoom', { code, name: 'NOPE' }, res));
  check('11th player rejected', rej.ok, false);
  check('rejection explains why', /full/i.test(rej.error), true);
  eleventh.close();
  for(const e of extras) e.close();
  await sleep(120);

  // ── round machine ──
  log('\n─── round machine ───');
  const byTeam = t => [A, B, C, D].filter(s => {
    const me = A.state.roster.find(p => p.id === s.id);
    return me && me.team === t;
  });

  A.emit('startMatch');
  check('match reached BUY', await waitFor(() => A.state.phase && A.state.phase.phase === 'BUY'), true);
  check('everyone alive at buy', A.state.roster.every(p => p.alive), true);
  check('money starts at 800', A.state.you.money, 800);

  // Buying is only legal during the buy phase.
  A.emit('buy', { weapon: 'ak47', price: 2700 });
  await sleep(60);
  check('cannot overspend', A.state.you.money, 800);
  A.emit('buy', { weapon: 'mp5', price: 600 });
  await sleep(60);
  check('affordable buy deducts', A.state.you.money, 200);

  check('went LIVE', await waitFor(() => A.state.phase.phase === 'LIVE', 3000), true);
  check('snapshots flowing', A.state.snaps > 0, true);

  // ── elimination ──
  log('\n─── elimination ends the round ───');
  const meA = A.state.roster.find(p => p.id === A.id);
  const enemyTeam = meA.team === 't' ? 'ct' : 't';
  const enemies = A.state.roster.filter(p => p.team === enemyTeam);
  const allies  = A.state.roster.filter(p => p.team === meA.team);
  check('2 enemies to kill', enemies.length, 2);

  // Friendly fire must be refused.
  const ally = allies.find(p => p.id !== A.id);
  A.emit('hit', { target: ally.id, damage: 100 });
  await sleep(80);
  check('friendly fire ignored', A.state.roster.find(p => p.id === ally.id).alive, true);

  for(const e of enemies){
    for(let i = 0; i < 4; i++){ A.emit('hit', { target: e.id, damage: 34 }); await sleep(35); }
  }
  check('round ended on wipe', await waitFor(() => A.state.phase.phase === 'ROUND_END', 3000), true);
  check('reason is elimination', A.state.phase.result.reason, 'elimination');
  check('winner is our side', A.state.phase.result.winner, meA.team);
  check('two kills credited', A.state.kills.length, 2);
  check('score is 1-0 our way', A.state.phase.score[meA.team], 1);

  // $200 left after the MP5, + 2 kills x $600 (SMG reward), + $3250 win purse.
  check('win purse + SMG kill rewards', A.state.you.money, 200 + 1200 + 3250);
  const loserSock = [B, C, D].find(s => s.state.roster.find(p => p.id === s.id).team === enemyTeam);
  check('loss bonus paid ($800 + 1400)', loserSock.state.you.money, 2200);

  // ── side swap + match end ──
  log('\n─── side swap at 7, match at 8 ───');
  const startTeam = meA.team;
  let guard = 0;
  while(!A.state.ended && guard++ < 40){
    if(!(await waitFor(() => A.state.phase.phase === 'LIVE', 4000))) break;
    // Whichever side we are on now, wipe the other one.
    const myTeamNow = A.state.roster.find(p => p.id === A.id).team;
    const foes = A.state.roster.filter(p => p.team !== myTeamNow && p.alive);
    for(const e of foes){
      for(let i = 0; i < 4; i++){ A.emit('hit', { target: e.id, damage: 34 }); await sleep(20); }
    }
    await waitFor(() => A.state.phase.phase !== 'LIVE', 3000);
  }

  check('halftime fired exactly once', A.state.halftimes, 1);
  const swapped = A.state.roster.find(p => p.id === A.id).team;
  check('our side actually changed', swapped !== startTeam, true);
  check('match ended', !!A.state.ended, true);
  check('winner reached 8', Math.max(A.state.ended.score.t, A.state.ended.score.ct), 8);
  const totalRounds = A.state.ended.score.t + A.state.ended.score.ct;
  check('match was 8-15 rounds', totalRounds >= 8 && totalRounds <= 15, true);

  log('\n─── phase sequence seen ───');
  const transitions = A.state.phases.filter((p, i) => p !== A.state.phases[i - 1]);
  log('  ' + transitions.slice(0, 10).join(' → ') + ' …');

  for(const s of [A, B, C, D]) s.close();
  await sleep(150);
  log('\n' + (failures ? '✗ ' + failures + ' FAILED' : '✓ all checks passed') + '\n');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error:', e); process.exit(1); });
