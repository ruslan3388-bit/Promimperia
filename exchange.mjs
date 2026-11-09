import {randomUUID} from 'node:crypto';
import {RESOURCES} from './public/catalog.mjs';
import {SPECIALIZATIONS,MARKET_RULES} from './public/economy-config.mjs';
const tradable=k=>Object.hasOwn(RESOURCES,k)&&k!=='science';
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const ok=message=>({ok:true,message}),fail=message=>({ok:false,message});
export function initExchange(w){w.exchange||={};const e=w.exchange;e.orders||=[];e.trades||=[];e.fees||=0;e.npcIssued||=0;e.npcRemoved||=0;return e;}
export function initTrader(p){p.specialization=Object.hasOwn(SPECIALIZATIONS,p.specialization)?p.specialization:'generalist';p.specializationAt||=0;p.deliveries||={};p.tradeHistory||=[];p.receipts||=[];p.npcQuota||={day:'',bought:{},sold:{}};}
function deliver(p,k,n){p.deliveries[k]=(p.deliveries[k]||0)+n;}
function note(p,text,time){p.notifications.unshift({id:randomUUID(),text,time,read:false});p.notifications.length=Math.min(p.notifications.length,30);}
function refund(o,players){const p=players.get(o.owner);if(!p)throw Error('Missing escrow owner');if(o.side==='buy')p.money+=o.remaining*o.price;else deliver(p,o.key,o.remaining);}
export function expireOrders(w,players,now=Date.now()){
 const e=initExchange(w);for(const o of e.orders)if(o.status==='active'&&o.expires<=now){refund(o,players);o.status='expired';note(players.get(o.owner),'Заявка истекла: резерв возвращён',now);}
 e.orders=[...e.orders.filter(o=>o.status==='active'),...e.orders.filter(o=>o.status!=='active'&&o.expires>now-7*86400000).slice(-2000)];
}
function settle(w,players,buy,sell,amount,price,now){
 const e=initExchange(w),buyer=players.get(buy.owner),seller=players.get(sell.owner);
 const gross=amount*price,fee=Math.ceil(gross*(seller.specialization==='merchant'?.01:.02));
 buy.remaining-=amount;sell.remaining-=amount;buyer.money+=amount*(buy.price-price);seller.money+=gross-fee;deliver(buyer,buy.key,amount);e.fees+=fee;
 if(!buy.remaining)buy.status='filled';if(!sell.remaining)sell.status='filled';
 const t={id:randomUUID(),key:buy.key,amount,price,time:now,buyer:buyer.name,seller:seller.name,fee};e.trades.unshift(t);e.trades=e.trades.slice(0,200);
 for(const [p,side]of [[buyer,'buy'],[seller,'sell']]){p.tradeHistory.unshift({...t,side});p.tradeHistory=p.tradeHistory.slice(0,100);note(p,`${side==='buy'?'Куплено':'Продано'} на бирже: ${amount} ${RESOURCES[buy.key].label} по ${price} ₽`,now);}
}
function match(w,players,incoming,now){
 const candidates=w.exchange.orders.filter(o=>o.status==='active'&&o.owner!==incoming.owner&&o.side!==incoming.side&&o.key===incoming.key&&o.expires>now&&
 (incoming.side==='buy'?o.price<=incoming.price:o.price>=incoming.price)).sort((a,b)=>(incoming.side==='buy'?a.price-b.price:b.price-a.price)||a.created-b.created);
 for(const o of candidates){if(!incoming.remaining)break;settle(w,players,incoming.side==='buy'?incoming:o,incoming.side==='sell'?incoming:o,Math.min(o.remaining,incoming.remaining),o.price,now);}
}
export function exchangeAction(p,m,w,players,now=Date.now()){
 initTrader(p);const e=initExchange(w);expireOrders(w,players,now);
 if(m.type==='specialize'){
  if(!Object.hasOwn(SPECIALIZATIONS,m.key))return fail('Неизвестная специализация');if(m.key===p.specialization)return fail('Эта специализация уже выбрана');
  const first=!p.specializationAt;if(!first&&now-p.specializationAt<MARKET_RULES.switchHours*3600000)return fail('Специализацию можно менять раз в 24 часа');
  if(!first&&p.money<MARKET_RULES.switchCost)return fail('Смена стоит 1 500 ₽');if(!first)p.money-=MARKET_RULES.switchCost;p.specialization=m.key;p.specializationAt=now;return ok('Специализация: '+SPECIALIZATIONS[m.key].name);
 }
 if(m.type==='claimDelivery'){
  if(!tradable(m.key))return fail('Неизвестный ресурс');const n=Math.min(p.deliveries[m.key]||0,Math.max(0,Math.floor(5000*(1+p.warehouse)-p.stock[m.key])));
  if(n<1)return fail('Освободи место на складе');p.deliveries[m.key]-=n;p.stock[m.key]+=n;return ok(`Получено: ${n} ${RESOURCES[m.key].label}`);
 }
 if(m.type==='cancelOrder'){
  const o=e.orders.find(o=>o.id===m.orderId&&o.owner===p.id&&o.status==='active');if(!o)return fail('Заявка уже исполнена или недоступна');refund(o,players);o.status='cancelled';return ok('Резерв возвращён. Товары доступны в разделе «Получение».');
 }
 if(m.type!=='placeOrder')return fail('Неизвестное действие');
 const {key,side,amount,price}=m;if(!tradable(key)||!['buy','sell'].includes(side))return fail('Проверь товар и направление');
 if(!int(amount,1,MARKET_RULES.maxQuantity)||!int(price,1,MARKET_RULES.maxPrice))return fail('Количество: 1–5 000; цена: 1–1 000 000 ₽');
 if(e.orders.filter(o=>o.owner===p.id&&o.status==='active').length>=(p.specialization==='merchant'?24:8))return fail('Лимит активных заявок');
 if(side==='sell'&&p.stock[key]<amount)return fail('Недостаточно товара');if(side==='buy'&&p.money<amount*price)return fail('Недостаточно денег для резерва');
 if(side==='sell')p.stock[key]-=amount;else p.money-=amount*price;
 const o={id:randomUUID(),owner:p.id,name:p.name,key,side,price,amount,remaining:amount,created:now,expires:now+MARKET_RULES.orderHours*3600000,status:'active'};
 e.orders.push(o);match(w,players,o,now);return ok(o.status==='filled'?'Сделка завершена. Товар — в разделе «Получение».':'Заявка размещена на 72 часа. Резерв удерживается до сделки или отмены.');
}
export function npcPrices(key,p={}){const base=RESOURCES[key].price;return {buy:Math.ceil(base*1.3*(p.tech?.includes('analytics')?.93:1)),sell:Math.max(1,Math.floor(base*.6*(p.tech?.includes('analytics')?1.05:1)))};}
export function npcAction(p,m,w,now=Date.now()){
 initTrader(p);const e=initExchange(w),key=m.key;if(!tradable(key))return fail('Ресурс недоступен');
 const day=new Date(now).toISOString().slice(0,13);if(p.npcQuota.day!==day)p.npcQuota={day,bought:{},sold:{}};
 const buy=m.type==='buy',prices=npcPrices(key,p),unit=buy?prices.buy:prices.sell;
 // Each company has a protected hourly emergency allowance; other players cannot exhaust it.
 const quota=Math.max(10,Math.floor(60000/Math.max(1,RESOURCES[key].price))),used=(buy?p.npcQuota.bought:p.npcQuota.sold);
 const max=Math.min(quota-(used[key]||0),buy?Math.min(Math.floor(p.money/unit),Math.floor(5000*(1+p.warehouse)-p.stock[key])):Math.floor(p.stock[key]),5000);
 const amount=m.amount==='max'||m.amount===undefined?max:Number(m.amount);
 if(!int(amount,1,5000)||amount>max)return fail('Не хватает денег, товара, места или суточной квоты лавки');
 p.stock[key]+=buy?amount:-amount;p.money+=buy?-amount*unit:amount*unit;used[key]=(used[key]||0)+amount;
 if(buy)e.npcRemoved+=amount*unit;else e.npcIssued+=amount*unit;
 return ok(`${buy?'Куплено в лавке':'Сдано в лавку'}: ${amount} ${RESOURCES[key].label} · ${amount*unit} ₽`);
}
export function exchangeView(w,p,now=Date.now()){
 const e=initExchange(w),active=e.orders.filter(o=>o.status==='active'&&o.expires>now);
 return {orders:active.map(({owner,...o})=>({...o,mine:owner===p.id})),mine:e.orders.filter(o=>o.owner===p.id).slice(-50).map(({owner,...o})=>o),history:p.tradeHistory||[],deliveries:p.deliveries||{},specialization:p.specialization,specializationAt:p.specializationAt,
  stats:{volume:e.trades.reduce((s,t)=>s+t.amount*t.price,0),trades:e.trades.length,fees:e.fees,npcIssued:e.npcIssued,npcRemoved:e.npcRemoved},
  prices:Object.fromEntries(Object.keys(RESOURCES).filter(tradable).map(k=>{const sells=active.filter(o=>o.key===k&&o.side==='sell'),buys=active.filter(o=>o.key===k&&o.side==='buy');const quota=Math.max(10,Math.floor(60000/Math.max(1,RESOURCES[k].price)));const q=p.npcQuota?.day===new Date(now).toISOString().slice(0,13)?p.npcQuota:{};return [k,{...npcPrices(k,p),bid:buys.length?Math.max(...buys.map(o=>o.price)):null,ask:sells.length?Math.min(...sells.map(o=>o.price)):null,supply:sells.reduce((s,o)=>s+o.remaining,0),demand:buys.reduce((s,o)=>s+o.remaining,0),buyLeft:quota-(q.bought?.[k]||0),sellLeft:quota-(q.sold?.[k]||0)}];}))};
}
