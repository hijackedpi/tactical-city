const { io } = require('socket.io-client');
const URL = 'http://localhost:3107';
const conn = () => new Promise(r => { const s = io(URL, { transports: ['websocket'] }); s.on('connect', () => r(s)); });
const rpc = (s, e, a) => new Promise(r => s.emit(e, a, r));
(async () => {
  const A = await conn(), B = await conn();
  const ra = await rpc(A, 'createRoom', { name: 'A', isPublic: false, map: 'overgrowth' });
  await rpc(B, 'joinRoom', { code: ra.code, name: 'B' });
  const log = { A: [], B: [] };
  for(const [k, s] of [['A', A], ['B', B]]){
    let lastYou = null;
    s.on('you', d => { lastYou = d.team; });
    s.on('roundReset', d => log[k].push({ round: d.round, reset: d.teams && d.teams[s.id], you: lastYou }));
  }
  A.emit('startMatch');
  await new Promise(r => setTimeout(r, 8000));
  let fail = 0;
  for(const k of ['A', 'B']){
    const rows = log[k].filter(x => x.round >= 6 && x.round <= 9);
    console.log(k, rows.map(x => `r${x.round}: team-in-reset=${x.reset} last-you-before-reset=${x.you}`).join(' | '));
    const r7 = rows.find(x => x.round === 7), r8 = rows.find(x => x.round === 8);
    if(!r7 || !r8 || r7.reset === r8.reset) fail++;
  }
  console.log(fail ? 'FAIL' : 'PASS: every player has their new team at the start of round 8');
  process.exit(fail ? 1 : 0);
})();
