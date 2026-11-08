import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHmac} from 'node:crypto';
import WebSocket from 'ws';
import {createPlayer} from './engine.mjs';
import {BUILDINGS,VERSION} from './public/catalog.mjs';
const token='123456789:test-token-for-isolated-integration';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function command(ws,m){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',listener);reject(Error('Command timeout'));},5000);function listener(raw){const v=JSON.parse(raw);if(v.requestId===m.requestId){clearTimeout(timer);ws.off('message',listener);resolve(v);}}ws.on('message',listener);ws.send(JSON.stringify(m));});}
test('two buyers race through WebSocket; replay and restart preserve a single transfer',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'exchange-live-'));let proc;let sockets=[];
 try{const file=join(dir,'world.json'),players=[1001,1002,1003].map(id=>{const p=createPlayer({id:`tg-${id}`,name:'Trader'});for(const k of Object.keys(p.buildings))p.buildings[k]=0;p.stock.ore=id===1001?10:0;p.money=10000;return p;});await writeFile(file,JSON.stringify({players,savedAt:Date.now()}));
 let s=await start(file);proc=s.cp;for(const id of[1001,1002,1003])sockets.push((await auth(s.port,true,id)).ws);
 const sell={type:'placeOrder',side:'sell',key:'ore',amount:10,price:10,requestId:'sell-once'};assert.equal((await command(sockets[0],sell)).type,'notice');assert.equal((await command(sockets[0],sell)).type,'notice');
 await Promise.all([1,2].map(i=>command(sockets[i],{type:'placeOrder',side:'buy',key:'ore',amount:10,price:10,requestId:'buy-'+i})));
 const disk=JSON.parse(await readFile(file,'utf8'));assert.equal(disk.exchange.trades.length,1);assert.equal(disk.players.reduce((n,p)=>n+(p.deliveries?.ore||0),0),10);
 for(const ws of sockets)ws.close();await wait(100);proc.kill();await new Promise(r=>proc.once('exit',r));sockets=[];
 s=await start(file);proc=s.cp;const joined=await auth(s.port,true,1001);sockets.push(joined.ws);assert.equal(joined.data.self.stock.ore,0);assert.equal(joined.data.self.exchange.history.length,1);assert.equal((await command(joined.ws,sell)).type,'notice');
 }finally{for(const ws of sockets)ws.close();if(proc&&!proc.killed){proc.kill();await new Promise(r=>proc.once('exit',r));}await rm(dir,{recursive:true,force:true});}
});
function start(file){return new Promise((resolve,reject)=>{const cp=spawn(process.execPath,['server-v3.mjs'],{env:{...process.env,PORT:'0',GAME_HOST:'127.0.0.1',GAME_DATA_FILE:file,BOT_TOKEN:token},windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';const timer=setTimeout(()=>{cp.kill();reject(Error('Server startup timeout '+log));},8000);cp.stderr.on('data',b=>{log+=b;});cp.once('exit',code=>{if(code)reject(Error(log));});cp.stdout.on('data',b=>{const m=String(b).match(/localhost:(\d+)/);if(m){clearTimeout(timer);resolve({cp,port:Number(m[1])});}});});}
function proof(id=424242){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Integration'}),signature:'signed-field-included'});const data=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');const key=createHmac('sha256','WebAppData').update(token).digest();p.set('hash',createHmac('sha256',key).update(data).digest('hex'));return p.toString();}
function auth(port,valid=true,id=424242){return new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}`);const timer=setTimeout(()=>{ws.close();reject(Error('Auth timeout'));},6000);ws.on('error',reject);ws.on('message',b=>{const m=JSON.parse(b);if(m.type==='hello')ws.send(JSON.stringify({type:'auth',initData:valid?proof(id):'hash=invalid'}));if(m.type==='ready'){clearTimeout(timer);resolve({ws,data:m});}});ws.on('close',code=>{if(!valid){clearTimeout(timer);resolve({code});}});});}
test('Telegram signature, persisted trade, timed completion and restart through real WebSocket',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'frontier-integration-'));let proc,ws;
 try{const file=join(dir,'world.json'),p=createPlayer({id:'tg-424242',name:'Integration'});p.research={key:'logistics',start:Date.now()-200000,end:Date.now()-1};p.queue=[{key:'mine',start:Date.now()-100000,end:Date.now()-1}];await writeFile(file,JSON.stringify({version:3,savedAt:Date.now(),players:[p]}));
 let s=await start(file);proc=s.cp;assert.equal((await auth(s.port,false)).code,1008);
 let joined=await auth(s.port);ws=joined.ws;assert.ok(joined.data.self.tech.includes('logistics'));assert.equal(joined.data.self.buildings.mine,2);
 const result=new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Trade timeout')),5000);ws.on('message',b=>{const m=JSON.parse(b);if(m.type==='world'&&m.self.money<2500){clearTimeout(t);resolve(m.self);}});});ws.send(JSON.stringify({type:'buy',key:'ore',amount:10}));const traded=await result;await wait(250);
 const disk=JSON.parse(await readFile(file,'utf8'));assert.equal(disk.players[0].money,traded.money);ws.close();await wait(150);proc.kill();await new Promise(r=>proc.once('exit',r));
 s=await start(file);proc=s.cp;joined=await auth(s.port);ws=joined.ws;assert.equal(joined.data.self.money,traded.money);assert.equal(joined.data.self.buildings.mine,2);assert.equal(joined.data.self.tech.filter(t=>t==='logistics').length,1);
 const health=await(await fetch(`http://127.0.0.1:${s.port}/health`)).json();assert.ok(health.persistence.ok);assert.equal(health.version,VERSION);
 for(const route of['/','/catalog.mjs','/app-v3.js','/game-v3.css'])assert.equal((await fetch(`http://127.0.0.1:${s.port}${route}`)).status,200);
 }finally{ws?.close();if(proc&&!proc.killed){proc.kill();await new Promise(r=>proc.once('exit',r));}await rm(dir,{recursive:true,force:true});}
});

test('offline replay respects the individual eight-hour deadline across restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'frontier-offline-'));let proc,ws;
 try{
  const file=join(dir,'world.json'),time=Date.now();
  const p=createPlayer({id:'tg-424242',name:'Offline'},time-9*3600000);
  p.warehouse=20;p.buildings.power=0;p.stock.ore=0;
  await writeFile(file,JSON.stringify({version:3,savedAt:time-2*3600000,players:[p]}));
  const s=await start(file);proc=s.cp;const joined=await auth(s.port);ws=joined.ws;
  // The player was last active nine hours ago. At the two-hour-old save,
  // just one hour of the offline-production allowance remained.
  const expected=3600*BUILDINGS.mine.rate.ore;
  assert.ok(Math.abs(joined.data.self.stock.ore-expected)<2,'Only the remaining one hour is replayed');
 }finally{ws?.close();if(proc&&!proc.killed){proc.kill();await new Promise(r=>proc.once('exit',r));}await rm(dir,{recursive:true,force:true});}
});
