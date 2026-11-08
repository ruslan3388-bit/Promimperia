import {createServer} from 'node:http';
import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {extname,join,relative,isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';
import {BUILDINGS,RESOURCES,RESEARCH,VERSION} from './public/catalog.mjs';
import {createPlayer,normalizePlayer,advance,action,market,publicPlayer,privatePlayer,OFFLINE_LIMIT} from './engine.mjs';
import {createStore} from './storage.mjs';
const ROOT=fileURLToPath(new URL('.',import.meta.url)),PUBLIC=join(ROOT,'public');
const PORT=Number(process.env.PORT||3000),TOKEN=process.env.BOT_TOKEN||'';
const store=createStore(process.env.GAME_DATA_FILE||join(ROOT,'data','world.json'));
const players=new Map();const world={events:[],pressure:{}};
let lastTick=Date.now(),shuttingDown=false;
function recordCompletions(p,messages,now){for(const text of messages){p.notifications.unshift({id:randomUUID(),text,time:now,read:false});}p.notifications=p.notifications.slice(0,30);}
const saved=await store.load();
if(saved){
 world.events=(saved.events||[]).slice(0,30);world.pressure=saved.pressure||{};
 for(const raw of saved.players){const p=normalizePlayer(raw);players.set(p.id,p);
 const elapsed=Math.max(0,Math.min(OFFLINE_LIMIT,Math.floor((lastTick-saved.savedAt)/1000),Math.floor((p.lastActiveAt+OFFLINE_LIMIT*1000-saved.savedAt)/1000)));
 for(let t=0;t<elapsed;t+=5){const step=Math.min(5,elapsed-t),now=saved.savedAt+(t+step)*1000;recordCompletions(p,advance(p,step,now),now);}
 recordCompletions(p,advance(p,0,lastTick),lastTick);}
}
function addEvent(text){world.events.unshift({id:randomUUID(),text,time:Date.now()});world.events.length=Math.min(30,world.events.length);}
function serializable(){return {...world,players:[...players.values()].map(({status,rates,upkeep,connections,...p})=>({...p,lastActiveAt:connections?Date.now():p.lastActiveAt}))};}
function save(){return store.save(serializable()).catch(()=>console.error('Campaign save failed; check disk space and permissions'));}
await save();
function verify(initData){
 if(!TOKEN||typeof initData!=='string')return null;
 try{const p=new URLSearchParams(initData),hash=p.get('hash');if(!hash||!/^[a-f0-9]{64}$/i.test(hash))return null;p.delete('hash');
 const check=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
 const secret=createHmac('sha256','WebAppData').update(TOKEN).digest();const expected=createHmac('sha256',secret).update(check).digest();
 if(!timingSafeEqual(expected,Buffer.from(hash,'hex')))return null;
 const date=Number(p.get('auth_date'));if(!Number.isFinite(date)||Date.now()/1000-date>86400||date>Date.now()/1000+60)return null;
 const u=JSON.parse(p.get('user')||'{}');if(!Number.isSafeInteger(u.id)||u.id<=0)return null;
 return {id:`tg-${u.id}`,name:[u.first_name,u.last_name].filter(Boolean).join(' ').slice(0,32)||'Инженер'};
 }catch{return null;}
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 try{const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/health'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({ok:true,version:VERSION,online:[...players.values()].filter(p=>p.connections>0).length,persistence:store.status()}));}
 const pathname=decodeURIComponent(url.pathname==='/'?'/index-v3.html':url.pathname);const file=resolve(PUBLIC,'.'+pathname);const rel=relative(PUBLIC,file);
 if(rel.startsWith('..')||isAbsolute(rel)){res.writeHead(403);return res.end('Forbidden');}
 const content=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-cache','x-content-type-options':'nosniff'});res.end(content);
 }catch{res.writeHead(404);res.end('Not found');}
});
const wss=new WebSocketServer({server,maxPayload:16384});
const send=(ws,data)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));};
function snapshot(now=Date.now()){return {...market(world,now),players:[...players.values()].map(publicPlayer).sort((a,b)=>b.netWorth-a.netWorth).slice(0,20),events:world.events,online:[...players.values()].filter(p=>p.connections>0).length,serverTime:now,storage:store.status()};}
function broadcast(){const now=Date.now(),view=snapshot(now);for(const ws of wss.clients)if(ws.playerId){const p=players.get(ws.playerId);send(ws,{type:'world',world:view,self:privatePlayer(p,world,now)});}}
const limits=new Map();
wss.on('connection',ws=>{
 let player=null;let chatWindow=0,chatCount=0;
 const authTimer=setTimeout(()=>{if(!player)ws.close(1008,'Authentication required');},10000);
 send(ws,{type:'hello',version:VERSION,telegramAuthRequired:Boolean(TOKEN)});
 ws.on('error',()=>{});
 ws.on('message',raw=>{
 try{const m=JSON.parse(raw);if(!m||typeof m!=='object'||Array.isArray(m))return;
 if(!player){if(m.type!=='auth')return ws.close(1008,'Authenticate first');let identity=verify(m.initData);
 if(TOKEN&&!identity)return ws.close(1008,'Telegram authentication failed');
 if(!identity){const id=String(m.devId||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40);if(!id)return ws.close(1008,'Player id required');identity={id:`dev-${id}`,name:String(m.name||'Инженер').replace(/[<>\u0000-\u001f]/g,'').slice(0,32)};}
 player=players.get(identity.id);if(!player){player=createPlayer(identity);players.set(player.id,player);addEvent(`${player.name} основал компанию`);}else player.name=identity.name;
 const away=player.connections?0:Math.min(OFFLINE_LIMIT,Math.max(0,Math.floor((Date.now()-player.lastActiveAt)/1000)));
 player.connections++;player.lastActiveAt=Date.now();ws.playerId=player.id;clearTimeout(authTimer);
 send(ws,{type:'ready',version:VERSION,self:privatePlayer(player,world),world:snapshot(),prices:market(world).prices,buildings:BUILDINGS,research:RESEARCH,away});void save();return;}
 const now=Date.now();if(now-(limits.get(player.id)||0)<150)return send(ws,{type:'error',message:'Подожди мгновение перед следующим действием'});limits.set(player.id,now);player.lastActiveAt=now;
 if(m.type==='chat'){
 if(now-chatWindow>10000){chatWindow=now;chatCount=0;}if(++chatCount>5)return send(ws,{type:'error',message:'Пауза между сообщениями'});
 const text=String(m.text||'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,160);if(text)addEvent(`${player.name}: ${text}`);
 }else{const result=action(player,m,world,now);send(ws,{type:result.ok?'notice':'error',message:result.message});if(!result.ok)return;
 if(['fulfill','claim','project','research'].includes(m.type))addEvent(`${player.name}: ${result.message}`);}
 void save();broadcast();
 }catch{send(ws,{type:'error',message:'Некорректная команда'});}
 });
 ws.on('close',()=>{clearTimeout(authTimer);if(player){player.connections=Math.max(0,player.connections-1);player.lastActiveAt=Date.now();void save();}});
});
const ticker=setInterval(()=>{
 const now=Date.now(),seconds=Math.min(5,Math.max(0,(now-lastTick)/1000));lastTick=now;
 for(const p of players.values()){
 const active=p.connections>0||now-p.lastActiveAt<OFFLINE_LIMIT*1000;
 const notices=advance(p,active?seconds:0,now);recordCompletions(p,notices,now);for(const text of notices){addEvent(`${p.name}: ${text}`);for(const ws of wss.clients)if(ws.playerId===p.id)send(ws,{type:'notice',message:text});}
 }
 for(const key of Object.keys(world.pressure))world.pressure[key]*=.999;
 broadcast();
},1000);
const autosave=setInterval(save,5000);
async function shutdown(){if(shuttingDown)return;shuttingDown=true;clearInterval(ticker);clearInterval(autosave);for(const ws of wss.clients)ws.close(1012,'Server update');await save();await store.flush();server.close();setTimeout(()=>process.exit(0),300).unref();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
server.listen(PORT,process.env.GAME_HOST||'0.0.0.0',()=>console.log(`Industrial Frontier ${VERSION}: http://localhost:${server.address().port}`));
