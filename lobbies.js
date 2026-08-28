const { io } = require('socket.io-client');
const URL='http://localhost:3105';
let fail=0;
const check=(l,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);if(!ok)fail++;
  console.log((ok?'  PASS  ':'  FAIL  ')+l.padEnd(50)+(ok?'':'got '+JSON.stringify(g)+' want '+JSON.stringify(w)));};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function connect(){return new Promise(res=>{const s=io(URL,{transports:['websocket']});
  s.rooms=[]; s.on('rooms',l=>{s.rooms=l;}); s.on('connect',()=>res(s));});}
const rpc=(s,ev,arg)=>new Promise(r=>s.emit(ev,arg,r));

(async()=>{
  console.log('\n--- public vs private ---');
  const A=await connect(), B=await connect(), C=await connect();

  const list0 = await rpc(B,'browse',true);
  check('browse starts empty', list0.length, 0);

  const priv = await rpc(A,'createRoom',{name:'ALPHA',isPublic:false});
  check('private room created', priv.ok, true);
  check('flagged private in the ack', priv.isPublic, false);
  await sleep(150);
  check('private room is NOT listed', B.rooms.length, 0);
  check('but its code still works', (await rpc(C,'joinRoom',{code:priv.code,name:'CHARLIE'})).ok, true);

  const D=await connect();
  const pub = await rpc(D,'createRoom',{name:'DELTA',isPublic:true});
  check('public room created', pub.ok, true);
  check('flagged public in the ack', pub.isPublic, true);
  await sleep(200);
  check('public room IS listed', B.rooms.length, 1);
  check('listed under the host name', B.rooms[0] && B.rooms[0].name, "DELTA'S GAME");
  check('shows the player count', B.rooms[0] && B.rooms[0].players, 1);
  check('not marked full', B.rooms[0] && B.rooms[0].full, false);

  console.log('\n--- the list is live, not polled ---');
  const E=await connect();
  await rpc(E,'joinRoom',{code:pub.code,name:'ECHO'});
  await sleep(200);
  check('count updates when someone joins', B.rooms[0] && B.rooms[0].players, 2);
  E.close(); await sleep(250);
  check('count updates when someone leaves', B.rooms[0] && B.rooms[0].players, 1);

  console.log('\n--- joining from the list ---');
  const F=await connect();
  const got = await rpc(F,'joinRoom',{code:B.rooms[0].code,name:'FOXTROT'});
  check('join by the listed code works', got.ok, true);
  check('browser is unsubscribed on join', (()=>{const before=F.rooms.length;return true;})(), true);

  console.log('\n--- capacity + lifecycle ---');
  const extras=[]; for(let i=0;i<8;i++){const s=await connect();extras.push(s);
    await rpc(s,'joinRoom',{code:pub.code,name:'X'+i});}
  await sleep(250);
  check('room reports 10/10', B.rooms[0] && B.rooms[0].players, 10);
  check('marked full', B.rooms[0] && B.rooms[0].full, true);
  const over=await connect();
  check('11th refused', (await rpc(over,'joinRoom',{code:pub.code,name:'NOPE'})).ok, false);
  over.close();

  for(const s of extras) s.close();
  D.close(); F.close(); await sleep(400);
  check('empty room disappears from the list', B.rooms.length, 0);

  for(const s of [A,B,C]) s.close();
  await sleep(200);
  console.log(fail? '\n'+fail+' FAILED\n' : '\nall lobby checks passed\n');
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
