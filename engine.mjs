import {BUILDINGS, RESOURCES, RESEARCH, GOALS, MARKET_EVENTS, PROJECT} from './public/catalog.mjs';
export const CAP = 999999;
export const OFFLINE_LIMIT = 8*3600;
const has=(o,k)=>Object.hasOwn(o,k);
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createPlayer(identity, now=Date.now()) {
 return normalizePlayer({...identity,money:2500,stock:{ore:20,energy:30},buildings:{mine:1,power:1},lastActiveAt:now},now);
}
export function normalizePlayer(raw,now=Date.now()) {
 const p={...raw,id:String(raw.id),name:String(raw.name||'Инженер').slice(0,32),money:clamp(finite(raw.money,2500),0,1e15),connections:0};
 p.stock=Object.fromEntries(Object.keys(RESOURCES).map(k=>[k,clamp(finite(raw.stock?.[k]),0,CAP)]));
 p.buildings=Object.fromEntries(Object.keys(BUILDINGS).map(k=>[k,Math.floor(clamp(finite(raw.buildings?.[k]),0,60))]));
 p.tech=Array.isArray(raw.tech)?raw.tech.filter(k=>has(RESEARCH,k)):[];
 p.paused=Array.isArray(raw.paused)?raw.paused.filter(k=>has(BUILDINGS,k)):[];
 p.queue=Array.isArray(raw.queue)?raw.queue.filter(q=>has(BUILDINGS,q.key)&&Number.isFinite(q.end)).slice(0,3):[];
 p.research=raw.research&&has(RESEARCH,raw.research.key)&&Number.isFinite(raw.research.end)?raw.research:null;
 p.warehouse=Math.floor(clamp(finite(raw.warehouse),0,20));
 p.claimed=Array.isArray(raw.claimed)?raw.claimed.filter(k=>GOALS.some(g=>g.id===k)):[];
 p.stats={contracts:finite(raw.stats?.contracts,raw.contracts?.reduce((s,c)=>s+(c.stage||0),0)||0),produced:{...raw.stats?.produced}};
 p.lastActiveAt=finite(raw.lastActiveAt,now);p.createdAt=finite(raw.createdAt,now);
 p.onboardingStep=Math.floor(clamp(finite(raw.onboardingStep,raw.buildings?.smelter||raw.stats?.contracts?3:0),0,4));
 p.notifications=Array.isArray(raw.notifications)?raw.notifications.filter(n=>n&&typeof n.text==='string'&&Number.isFinite(n.time)).slice(0,30):[];
 p.contracts=Array.isArray(raw.contracts)?raw.contracts.filter(c=>has(RESOURCES,c.resource)&&c.amount>0&&c.reward>0&&c.id).slice(0,3):[];
 while(p.contracts.length<3)p.contracts.push(makeContract(p,p.contracts.length,0));
 p.project=raw.project&&Number.isFinite(raw.project.end)?raw.project:null;p.victory=Boolean(raw.victory);
 p.status={};p.rates={};p.upkeep=0;p.income=0;
 return p;
}
export const capacity=p=>Math.min(CAP,5000*(1+p.warehouse));
export const unlocked=(p,b)=>!b.tech||p.tech.includes(b.tech);
export function availableResources(p){return Object.keys(RESOURCES).filter(r=>r!=='science'&&Object.values(BUILDINGS).some(b=>unlocked(p,b)&&b.rate[r]>0));}
export function buildOffer(p,key){
 const b=BUILDINGS[key];if(!b)return null;
 const n=p.buildings[key]+p.queue.filter(q=>q.key===key).length;
 const factor=Math.pow(1.18,n);
 return {cost:Math.ceil(b.cost*factor),materials:Object.fromEntries(Object.entries(b.materials||{}).map(([k,v])=>[k,Math.ceil(v*(1+n*.1))])),seconds:Math.min(600,Math.ceil(b.time*(1+n*.12))),unlocked:unlocked(p,b),limit:n>=60};
}
export function makeContract(p,slot,stage){
 const keys=availableResources(p);const resource=keys[(slot+Math.floor(p.stats.contracts/3))%keys.length];
 const amount=Math.ceil((RESOURCES[resource].price>1000?3:RESOURCES[resource].price>100?15:60)*(1+Math.min(stage,100)*.2));
 return {id:`s${slot}-${resource}-${stage}`,resource,stage,slot,title:`Поставка: ${RESOURCES[resource].label}`,description:'Прямая поставка региональному заказчику',icon:RESOURCES[resource].icon,amount,reward:Math.ceil(amount*RESOURCES[resource].price*1.45)};
}
export function market(world,now=Date.now()) {
 const epoch=Math.floor(now/600000);const event=MARKET_EVENTS[epoch%MARKET_EVENTS.length];
 const prices=Object.fromEntries(Object.entries(RESOURCES).map(([k,r],i)=>{
 const swing=1+.12*Math.sin(epoch*.83+i*1.7);const impact=clamp(finite(world.pressure?.[k]),-.15,.15);
 return [k,{...r,price:r.price?Math.max(1,Math.round(r.price*swing*(event.boost[k]||1)*(1-impact))):0}];}));
 return {prices,event:{...event,endsAt:(epoch+1)*600000}};
}
export function quote(p,world,key,side,now){const price=market(world,now).prices[key]?.price||0;return Math.max(1,side==='buy'?Math.ceil(price*1.2*(p.tech.includes('analytics')?.93:1)):Math.floor(price*(p.tech.includes('analytics')?1.05:1)));}
function affordable(p,cost,materials={}){return p.money>=cost&&Object.entries(materials).every(([k,v])=>p.stock[k]>=v);}
function debit(p,cost,materials={}){p.money-=cost;for(const[k,v]of Object.entries(materials))p.stock[k]-=v;}
function refund(p,item){p.money+=Math.floor(item.cost*.8);for(const[k,v]of Object.entries(item.materials||{}))p.stock[k]=Math.min(CAP,p.stock[k]+Math.floor(v*.8));}
export function goalProgress(p,g){
 if(g.kind==='buildings')return Object.values(p.buildings).reduce((s,n)=>s+n,0);
 if(g.kind==='sectorBuildings')return Object.entries(p.buildings).reduce((s,[k,n])=>s+(BUILDINGS[k].sector===g.sector?n:0),0);
 if(g.kind==='buildingCount')return finite(p.buildings[g.building]);
 return g.kind==='contracts'?p.stats.contracts:g.kind==='research'?p.tech.length:g.kind==='victory'?Number(p.victory):finite(p.stats.produced[g.kind]);
}
export function advance(p,seconds,now=Date.now()) {
 const notices=[];
 while(p.queue.length&&p.queue[0].end<=now){const q=p.queue.shift();p.buildings[q.key]++;notices.push(`${BUILDINGS[q.key].name}: строительство завершено`);}
 if(p.research&&p.research.end<=now){const key=p.research.key;if(!p.tech.includes(key))p.tech.push(key);p.research=null;notices.push(`Изучено: ${RESEARCH[key].name}`);}
 if(p.project&&p.project.end<=now){p.project=null;p.victory=true;notices.push('Орбитальная сеть запущена! Кампания завершена, регион продолжает работать.');}
 updateOnboarding(p);
 if(seconds<=0)return notices;
 const before={...p.stock};p.status={};p.upkeep=0;p.income=0;
 const outputBonus=1+(p.tech.includes('efficiency')?.15:0)+(p.tech.includes('automation')?.1:0);
 const order=Object.entries(BUILDINGS).sort(([,a],[,b])=>Number(b.rate.energy>0)-Number(a.rate.energy>0));
 for(const[key,b]of order){
 const count=p.buildings[key];if(!count)continue;
 if(p.paused.includes(key)){p.status[key]={efficiency:0,reason:'На паузе'};continue;}
 const flows=Object.fromEntries(Object.entries(b.rate).map(([k,v])=>[k,v*count*seconds*(v>0?outputBonus*(k==='chips'&&p.tech.includes('electronics')?1.25:1):(k==='energy'&&p.tech.includes('energy')?.8:1))]));
 let scale=1,reason='Работает';const upkeep=b.upkeep*count*seconds;
 for(const[k,v]of Object.entries(flows)){
 const limit=v<0?p.stock[k]/-v:Math.max(0,capacity(p)-p.stock[k])/v;
 if(limit<scale){scale=Math.max(0,limit);reason=v<0?`Не хватает: ${RESOURCES[k].label}`:`Склад заполнен: ${RESOURCES[k].label}`;}
 }
 const income=(b.income||0)*count*seconds,cashBurn=Math.max(0,upkeep-income);
 if(cashBurn>0&&p.money/cashBurn<scale){scale=p.money/cashBurn;reason='Нет средств на обслуживание';}
 for(const[k,v]of Object.entries(flows)){p.stock[k]=Math.max(0,p.stock[k]+v*scale);if(v>0)p.stats.produced[k]=finite(p.stats.produced[k])+v*scale;}
 p.money=Math.min(1e15,Math.max(0,p.money+(income-upkeep)*scale));p.upkeep+=upkeep*scale/seconds;p.income+=income*scale/seconds;p.status[key]={efficiency:Math.round(scale*100),reason};
 }
 p.rates=Object.fromEntries(Object.keys(RESOURCES).map(k=>[k,(p.stock[k]-before[k])/seconds]));updateOnboarding(p);return notices;
}
function updateOnboarding(p){
 if(p.onboardingStep===0&&p.buildings.smelter>0)p.onboardingStep=1;
 const steel=p.contracts.find(c=>c.resource==='steel');
 if(p.onboardingStep===1&&p.stock.steel>=(steel?.amount||60))p.onboardingStep=2;
 if(p.onboardingStep===2&&p.stats.contracts>0)p.onboardingStep=3;
 if(p.onboardingStep===3&&p.tech.includes('logistics'))p.onboardingStep=4;
}
export function action(p,m,world,now=Date.now()) {
 const fail=message=>({ok:false,message});
 const key=String(m.key||'');
 if(m.type==='build'||m.type==='upgrade'){
 if(!has(BUILDINGS,key))return fail('Неизвестное предприятие');const o=buildOffer(p,key);
 if(!o.unlocked)return fail('Сначала изучи требуемую технологию');if(o.limit)return fail('Лимит: 60 предприятий каждого типа');if(p.queue.length>=3)return fail('В очереди уже три строительства');
 if(!affordable(p,o.cost,o.materials))return fail('Не хватает денег или строительных материалов');
 debit(p,o.cost,o.materials);const start=Math.max(now,p.queue.at(-1)?.end||0);p.queue.push({key,start,end:start+o.seconds*1000,cost:o.cost,materials:o.materials});
 return {ok:true,message:`В очереди: ${BUILDINGS[key].name}`};
 }
 if(m.type==='cancelBuild') {if(!p.queue.length)return fail('Очередь пуста');refund(p,p.queue.pop());return {ok:true,message:'Последняя стройка отменена. Возвращено 80% затрат.'};}
 if(m.type==='pause'){if(!has(BUILDINGS,key)||!p.buildings[key])return fail('Предприятие ещё не построено');p.paused=p.paused.includes(key)?p.paused.filter(k=>k!==key):[...p.paused,key];return {ok:true,message:p.paused.includes(key)?'Производство приостановлено':'Производство возобновлено'};}
 if(m.type==='research'){
 if(!has(RESEARCH,key))return fail('Неизвестная технология');const r=RESEARCH[key];
 if(p.tech.includes(key))return fail('Уже изучено');if(p.research)return fail('Исследовательская очередь занята');if(!r.requires.every(t=>p.tech.includes(t)))return fail('Изучи предыдущие технологии');
 if(!affordable(p,r.cost,r.materials))return fail('Не хватает денег или ресурсов для исследования');debit(p,r.cost,r.materials);p.research={key,start:now,end:now+r.seconds*1000,cost:r.cost,materials:r.materials};return {ok:true,message:`Начато: ${r.name}`};
 }
 if(m.type==='cancelResearch'){if(!p.research)return fail('Нет активного исследования');refund(p,p.research);p.research=null;return {ok:true,message:'Исследование отменено; возвращено 80% затрат.'};}
 if(m.type==='warehouse'){const cost=Math.ceil(5000*Math.pow(1.7,p.warehouse));if(p.warehouse>=20)return fail('Склад достиг максимума');if(p.money<cost)return fail('Недостаточно денег');p.money-=cost;p.warehouse++;return {ok:true,message:`Вместимость склада: ${capacity(p)} каждого ресурса`};}
 if(m.type==='buy'||m.type==='sell'){
 if(!has(RESOURCES,key)||key==='science'||!availableResources(p).includes(key))return fail('Ресурс ещё не открыт');
 const unit=quote(p,world,key,m.type,now);const max=m.type==='sell'?Math.floor(p.stock[key]):Math.min(Math.floor(p.money/unit),Math.max(0,Math.floor(capacity(p)-p.stock[key])));
 const amount=m.amount==='max'||m.amount===undefined?Math.min(5000,max):Number(m.amount);
 if(!Number.isSafeInteger(amount)||amount<1||amount>5000)return fail('Размер сделки: от 1 до 5000');if(amount>max)return fail('Не хватает ресурсов, денег или места на складе');
 p.stock[key]+=m.type==='buy'?amount:-amount;p.money+=m.type==='buy'?-amount*unit:amount*unit;
 world.pressure||={};world.pressure[key]=clamp(finite(world.pressure[key])+(m.type==='sell'?1:-1)*amount*.00001,-.15,.15);
 return {ok:true,message:`${m.type==='buy'?'Куплено':'Продано'}: ${amount} ${RESOURCES[key].label} · ${amount*unit} ₽`};
 }
 if(m.type==='readNotifications'){p.notifications=p.notifications.map(n=>({...n,read:true}));return {ok:true,message:'Журнал прочитан'};}
 if(m.type==='fulfill'){
 const index=p.contracts.findIndex(c=>c.id===m.contractId);if(index<0)return fail('Контракт уже недоступен');const c=p.contracts[index];
 if(c.readyAt>now)return fail('Заказчик готовит следующую поставку');
 if(p.stock[c.resource]<c.amount)return fail('Недостаточно товара');p.stock[c.resource]-=c.amount;p.money+=c.reward;p.stats.contracts++;p.stock.science=Math.min(CAP,p.stock.science+2);
 p.contracts[index]={...makeContract(p,index,c.stage+1),readyAt:now+Math.min(300,90+c.stage*5)*1000};updateOnboarding(p);return {ok:true,message:`Контракт выполнен: +${c.reward} ₽ и 2 науки`};
 }
 if(m.type==='claim'){
 const g=GOALS.find(g=>g.id===key);if(!g||p.claimed.includes(key))return fail('Награда недоступна');if(goalProgress(p,g)<g.target)return fail('Цель ещё не достигнута');p.claimed.push(key);p.money+=g.reward;p.stock.science=Math.min(CAP,p.stock.science+g.science);return {ok:true,message:`Цель «${g.name}»: +${g.reward} ₽`};
 }
 if(m.type==='project'){
 if(p.victory||p.project)return fail('Проект уже запущен');if(!p.tech.includes(PROJECT.tech))return fail('Требуется технология межпланетной связи');if(!affordable(p,PROJECT.cost,PROJECT.materials))return fail('Не хватает ресурсов для мегапроекта');debit(p,PROJECT.cost,PROJECT.materials);p.project={start:now,end:now+PROJECT.seconds*1000};return {ok:true,message:'Начато развёртывание орбитальной сети'};
 }
 return fail('Неизвестное действие');
}
export function publicPlayer(p){return {id:p.id,name:p.name,netWorth:Math.floor(p.money+Object.entries(RESOURCES).reduce((s,[k,r])=>s+p.stock[k]*r.price,0)+Object.entries(BUILDINGS).reduce((s,[k,b])=>s+p.buildings[k]*b.cost,0)),online:p.connections>0,victory:p.victory};}
export function privatePlayer(p,world,now=Date.now()) {return {...p,stock:Object.fromEntries(Object.entries(p.stock).map(([k,v])=>[k,Math.floor(v)])),money:Math.floor(p.money),capacity:capacity(p),offers:Object.fromEntries(Object.keys(BUILDINGS).map(k=>[k,buildOffer(p,k)])),trade:Object.fromEntries(availableResources(p).map(k=>[k,{buy:quote(p,world,k,'buy',now),sell:quote(p,world,k,'sell',now)}])),goals:GOALS.map(g=>({...g,progress:Math.min(g.target,Math.floor(goalProgress(p,g))),claimed:p.claimed.includes(g.id)}))};}
