import {RESOURCES} from './catalog.mjs';
import {SPECIALIZATIONS} from './economy-config.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Math.floor(n||0).toLocaleString('ru-RU');
const CATEGORIES=[
 {key:'raw',label:'Сырьё',items:['ore','coal','timber','grain','oil','stone','sand']},
 {key:'materials',label:'Материалы',items:['steel','boards','flour','alloy','cement','glass','buildingMaterials','fabric']},
 {key:'energy',label:'Энергия и химия',items:['energy','plastic']},
 {key:'food',label:'Продукты',items:['food','bread','clothing']},
 {key:'equipment',label:'Техника',items:['chips','machinery','robots','satellites']}
];
let send,initialized=false,view='market',category='raw',selected='ore',dealMode='players',direction='buy',dealOpen=false,state,lastDealSignature='',prefill=null;
function html(el,markup){if(el&&el.innerHTML!==markup)el.innerHTML=markup;}
function renderTabs(root){
 const active=state.exchange.mine.filter(o=>o.status==='active').length,deliveries=Object.values(state.exchange.deliveries).reduce((a,n)=>a+n,0);
 const labels={market:'Рынок',mine:'Мои заявки'+(active?' '+active:''),deliveries:'Получение'+(deliveries?' '+deliveries:''),history:'История',stats:'Регион'};
 html(root.querySelector('#exchange-tabs'),Object.entries(labels).map(([k,label])=>'<button class="'+(view===k?'selected':'')+'" data-view="'+k+'">'+label+'</button>').join(''));
}
function renderShell(root,p){
 if(initialized)return;initialized=true;
 root.innerHTML='<div class="panel-top"><div><span class="panel-index">ОБЩИЙ РЫНОК РЕГИОНА · 4.0</span><h3>Биржа компаний</h3></div><span class="exchange-role" id="exchange-role"></span></div><p class="panel-help">Склад, цены игроков и объём заявок — по категориям. Лавка выкупает товар примерно за 60% справочной цены.</p><details class="exchange-career"><summary>Специализация и снабжение рабочих</summary><div id="career"></div></details><div class="exchange-tabs" id="exchange-tabs"></div><div id="exchange-content"></div>';
 const career=root.querySelector('#career');
 career.innerHTML='<label class="trade-toolbar">Профессия <select id="career-select">'+Object.entries(SPECIALIZATIONS).map(([k,s])=>'<option value="'+k+'">'+esc(s.name)+'</option>').join('')+'</select><button class="action-btn" id="career-apply">Выбрать</button></label><p id="career-info" class="panel-help"></p>';
 career.querySelector('#career-select').value=p.specialization;
 root.addEventListener('click',ev=>{
  const b=ev.target.closest('button');if(!b)return;
  if(b.dataset.view){view=b.dataset.view;dealOpen=false;lastDealSignature='';renderExchange(state,send);return;}
  if(b.dataset.category){category=b.dataset.category;const cat=CATEGORIES.find(c=>c.key===category);if(!cat.items.includes(selected))selected=cat.items[0];dealOpen=false;lastDealSignature='';renderExchange(state,send);return;}
  if(b.dataset.select){selected=b.dataset.select;dealMode='players';direction='buy';dealOpen=true;prefill=null;lastDealSignature='';renderExchange(state,send);return;}
  if(b.dataset.npcSell){selected=b.dataset.npcSell;dealMode='npc';direction='sell';dealOpen=true;prefill=null;lastDealSignature='';renderExchange(state,send);return;}
  if(b.dataset.mode){dealMode=b.dataset.mode;if(dealMode==='npc')direction='sell';dealOpen=true;lastDealSignature='';renderExchange(state,send);return;}
  if(b.dataset.side){direction=b.dataset.side;prefill=null;lastDealSignature='';renderExchange(state,send);return;}
  if(b.dataset.closeDeal!==undefined){dealOpen=false;lastDealSignature='';renderExchange(state,send);return;}
  if(b.dataset.cancel){send({type:'cancelOrder',orderId:b.dataset.cancel});return;}
  if(b.dataset.claim){send({type:'claimDelivery',key:b.dataset.claim});return;}
  if(b.dataset.fill){
   const o=state.exchange.orders.find(o=>o.id===b.dataset.fill);if(!o)return;
   selected=o.key;category=CATEGORIES.find(c=>c.items.includes(selected))?.key||category;view='market';dealMode='players';direction=o.side==='sell'?'buy':'sell';dealOpen=true;prefill={amount:Math.min(o.remaining,10),price:o.price};lastDealSignature='';renderExchange(state,send);return;
  }
  if(b.id==='career-apply'){const key=root.querySelector('#career-select').value;if(confirm('Выбрать специализацию? Первая смена бесплатна, следующие — 1 500 ₽, раз в 24 часа.'))send({type:'specialize',key});}
 });
 root.addEventListener('input',ev=>{if(ev.target.closest('#deal-form'))updateEstimate(root);});
 root.addEventListener('submit',ev=>{
  if(ev.target.id!=='deal-form')return;ev.preventDefault();const f=ev.target,amount=Number(f.elements.amount.value);
  if(dealMode==='players'){
   const price=Number(f.elements.price.value);if(!Number.isSafeInteger(amount)||amount<1||amount>5000||!Number.isSafeInteger(price)||price<1||price>1000000)return;
   const side=direction;if(confirm((side==='buy'?'Купить ':'Продать ')+amount+' '+RESOURCES[selected].label+' по '+num(price)+' ₽? '+(side==='buy'?'В резерв уйдёт '+num(amount*price)+' ₽.':'В резерв уйдёт '+amount+' ед.')))send({type:'placeOrder',side,key:selected,amount,price});
  }else{
   const type=direction,unit=state.exchange.prices[selected][type],gross=amount*unit;if(!Number.isSafeInteger(amount)||amount<1||amount>5000)return;
   if(confirm((type==='sell'?'Сдать в лавку ':'Купить в лавке ')+amount+' '+RESOURCES[selected].label+' по '+num(unit)+' ₽/ед.? Итого '+num(gross)+' ₽.'))send({type,key:selected,amount});
  }
 });
}
export function npcSellBlockReason(stock,q,amount){
 if(stock<1)return 'На складе нет товара для сдачи.';
 if(q.sellLeft<1)return 'Квота лавки на этот час исчерпана. Повтори после смены часа.';
 if(amount!==undefined&&amount>q.sellLeft)return `За этот час можно сдать не более ${num(q.sellLeft)} ед.`;
 return null;
}
function maxDealAmount(p,q,mode,side,stock,price){
 if(mode==='npc')return side==='sell'?Math.max(0,Math.min(5000,stock,q.sellLeft)):Math.max(0,Math.min(5000,q.buyLeft,Math.floor(p.money/Math.max(1,q.buy)),Math.floor(5000*(1+(p.warehouse||0))-stock)));
 return side==='sell'?Math.max(0,Math.min(5000,stock)):Math.max(0,Math.min(5000,Math.floor(p.money/Math.max(1,price))));
}
function updateEstimate(root){
 const f=root.querySelector('#deal-form');if(!f)return;const amount=Number(f.elements.amount.value),q=state.exchange.prices[selected],stock=state.stock[selected]||0,price=dealMode==='npc'?q.buy:Number(f.elements.price.value),max=maxDealAmount(state,q,dealMode,direction,stock,price),el=root.querySelector('#deal-estimate');if(!el)return;
 f.elements.amount.max=String(Math.max(1,max));f.querySelector('[type="submit"]').disabled=max<1||amount>max;
 if(amount>max){el.textContent='Доступно сейчас: не более '+num(max)+' ед. с учётом склада, денег и квоты.';return;}
 if(dealMode==='players'){el.textContent='Сумма '+num(amount*Number(f.elements.price.value))+' ₽ · заявка действует 72 часа · резерв возвращается после отмены.';}
 else{const unit=q[direction];el.textContent='Итого '+num(amount*unit)+' ₽ · квота на этот час: '+num(q[direction==='buy'?'buyLeft':'sellLeft'])+' ед.';}
}
function renderMarket(root,p,e){
 const cat=CATEGORIES.find(c=>c.key===category)||CATEGORIES[0];category=cat.key;
 const categories='<div class="exchange-categories">'+CATEGORIES.map(c=>'<button class="'+(c.key===category?'selected':'')+'" data-category="'+c.key+'">'+c.label+'<small>'+c.items.length+'</small></button>').join('')+'</div>';
 html(root.querySelector('#exchange-content'),categories+'<div class="market-category-title"><b>'+cat.label+'</b><span>'+cat.items.length+' товаров · выбери действие</span></div><div id="market-resources"></div><div id="deal-panel"></div><details class="market-extra"><summary>Потребности региона и статистика</summary><div id="exchange-demand"></div><p class="panel-help" id="exchange-stats"></p></details>');
 const rows=cat.items.map(k=>{
  const r=RESOURCES[k],q=e.prices[k],stock=p.stock[k]||0,bid=q.bid===null?'—':num(q.bid)+' ₽',ask=q.ask===null?'—':num(q.ask)+' ₽',pct=p.tech?.includes('analytics')?63:60,blocked=npcSellBlockReason(stock,q);
  return '<article class="market-item '+(dealOpen&&selected===k?'active':'')+'"><div class="market-item-top"><span class="market-item-name">'+r.icon+' '+esc(r.label)+'</span><span class="market-stock">Склад <b>'+num(stock)+'</b></span></div><div class="market-item-prices"><span>Цены: покупают <b>'+bid+'</b> · продают <b>'+ask+'</b></span></div><div class="market-item-volume"><span>В заявках: спрос <b>'+num(q.demand)+'</b> · предложение <b>'+num(q.supply)+'</b></span></div><div class="market-item-bottom"><span>Лавка выкупит <b>'+num(q.sell)+' ₽</b> <small>('+pct+'%)</small></span><div><button class="action-btn compact" data-select="'+k+'">Заявка</button><button class="action-btn compact quiet" data-npc-sell="'+k+'" '+(blocked?'disabled title="'+esc(blocked)+'" aria-label="Сдать: '+esc(blocked)+'"':'')+'>Сдать</button></div></div>'+(blocked?'<small class="market-action-note">'+esc(blocked)+'</small>':'')+'</article>';
 }).join('');
 html(root.querySelector('#market-resources'),rows);
 const demand=Object.entries(e.prices).filter(([,q])=>q.demand>0||q.supply>0).sort((a,b)=>b[1].demand-a[1].demand).slice(0,10).map(([k,q])=>'<div class="exchange-row"><span>'+RESOURCES[k].icon+' '+RESOURCES[k].label+'<small>Покупают '+num(q.demand)+' · продают '+num(q.supply)+'</small></span><b>'+(q.bid===null?'—':num(q.bid))+' / '+(q.ask===null?'—':num(q.ask))+' ₽</b></div>').join('')||'<p class="panel-help">Заявок пока нет. Размести ордер, чтобы показать свой спрос.</p>';
 html(root.querySelector('#exchange-demand'),demand);
 const s=e.stats;root.querySelector('#exchange-stats').textContent='Сделок: '+num(s.trades)+' · оборот '+num(s.volume)+' ₽ · комиссии '+num(s.fees)+' ₽. Лавка: выкуп '+num(s.npcIssued)+' ₽ · продажа '+num(s.npcRemoved)+' ₽.';
 renderDeal(root,p,e,cat);
}
function renderDeal(root,p,e,cat){
 const host=root.querySelector('#deal-panel'),belongs=dealOpen&&cat.items.includes(selected);if(!host)return;
 if(!belongs){if(lastDealSignature!==''||host.innerHTML){host.innerHTML='';lastDealSignature='';}return;}
 const sig=selected+'|'+dealMode+'|'+direction,key=selected,r=RESOURCES[key],q=e.prices[key],stock=p.stock[key]||0;
 if(sig!==lastDealSignature){
  const price=prefill?.price??(direction==='buy'?(q.ask||r.price):(q.bid||r.price)),max=maxDealAmount(p,q,dealMode,direction,stock,price),amount=prefill?.amount??Math.max(1,Math.min(10,max||10));
  const modeBtns='<div class="exchange-deal-modes"><button data-mode="players" class="'+(dealMode==='players'?'selected':'')+'">Игроки</button><button data-mode="npc" class="'+(dealMode==='npc'?'selected':'')+'">Лавка</button><button class="deal-close" data-close-deal="1">Свернуть</button></div>';
  const directionBtns='<div class="exchange-deal-sides"><button data-side="buy" class="'+(direction==='buy'?'selected':'')+'">'+(dealMode==='npc'?'Купить у НПС':'Купить у игроков')+'</button><button data-side="sell" class="'+(direction==='sell'?'selected':'')+'">'+(dealMode==='npc'?'Сдать в лавку':'Продать игрокам')+'</button></div>';
  const priceField=dealMode==='players'?'<label>Цена за единицу, ₽<input name="price" type="number" min="1" max="1000000" value="'+price+'" required></label>':'<div class="exchange-fixed-quote"><span>Цена за единицу</span><b>'+num(q[direction])+' ₽</b><small>'+(direction==='sell'?'Лавка выкупает примерно за 60% справочной цены.':'Фиксированная цена лавки.')+'</small></div>';
  const action=dealMode==='players'?'Разместить заявку на 72 часа':direction==='sell'?'Сдать в лавку':'Купить в лавке',disabled=dealMode==='npc'&&(q[direction==='buy'?'buyLeft':'sellLeft']<1||(direction==='sell'&&stock<1));
  host.innerHTML='<section class="exchange-deal"><div class="exchange-deal-title"><div><b>'+r.icon+' '+esc(r.label)+'</b><small>На складе: '+num(stock)+' ед. · квота лавки: купить '+num(q.buyLeft)+', сдать '+num(q.sellLeft)+'</small></div></div>'+modeBtns+directionBtns+'<div class="deal-market-quote" id="deal-market-quote"></div><div class="deal-matching" id="deal-matching"></div><form id="deal-form" class="exchange-deal-form"><label>Количество, ед.<input name="amount" type="number" min="1" max="'+Math.max(1,max)+'" value="'+amount+'" required></label>'+priceField+'<p id="deal-estimate" class="panel-help"></p><button type="submit" class="action-btn" '+(disabled?'disabled':'')+'>'+action+'</button></form></section>';
  lastDealSignature=sig;prefill=null;
 }
 const quote=root.querySelector('#deal-market-quote');if(quote)quote.innerHTML='Лучшие цены игроков: покупают '+(q.bid===null?'—':num(q.bid)+' ₽')+' · продают '+(q.ask===null?'—':num(q.ask)+' ₽')+'<br>В заявках: спрос '+num(q.demand)+' · предложение '+num(q.supply)+' ед.';
 const offers=e.orders.filter(o=>o.key===key&&o.side===(direction==='buy'?'sell':'buy')).sort((a,b)=>(direction==='buy'?a.price-b.price:b.price-a.price)||a.created-b.created).slice(0,3);
 const list=dealMode==='players'?offers.map(o=>'<div class="exchange-row"><span>'+esc(o.name)+' · '+num(o.remaining)+' ед.<small>'+(o.side==='sell'?'Продаёт':'Покупает')+' · '+num(o.price)+' ₽/ед.</small></span><button class="action-btn compact" data-fill="'+esc(o.id)+'">Взять цену</button></div>').join(''):'';
 html(root.querySelector('#deal-matching'),list?'<div class="deal-list-title">Подходящие заявки</div>'+list:'');
 const title=root.querySelector('.exchange-deal-title small');if(title)title.textContent='На складе: '+num(stock)+' ед. · квота лавки: купить '+num(q.buyLeft)+', сдать '+num(q.sellLeft);
 const form=root.querySelector('#deal-form');if(form&&!form.contains(document.activeElement))updateEstimate(root);
}
function renderOther(root,e){
 if(view==='mine'){
  const status={active:'Открыта',filled:'Исполнена',cancelled:'Отменена',expired:'Истекла'};
  return e.mine.slice().reverse().slice(0,30).map(o=>'<div class="exchange-row"><span>'+(RESOURCES[o.key]?.icon||'')+' '+(RESOURCES[o.key]?.label||o.key)+' · '+(o.side==='buy'?'покупаю':'продаю')+'<small>'+(status[o.status]||o.status)+' · '+num(o.remaining)+' / '+num(o.amount)+' ед. · '+num(o.price)+' ₽/ед.</small></span>'+(o.status==='active'?'<button class="action-btn compact" data-cancel="'+esc(o.id)+'">Отменить</button>':'')+'</div>').join('')||'<p class="panel-help">Заявок пока нет.</p>';
 }
 if(view==='deliveries')return Object.entries(e.deliveries).filter(([,n])=>n>0).map(([k,n])=>'<div class="exchange-row"><span>'+RESOURCES[k].icon+' '+RESOURCES[k].label+'<small>Получено по сделкам · '+num(n)+' ед.</small></span><button class="action-btn compact" data-claim="'+k+'">На склад</button></div>').join('')||'<p class="panel-help">Все купленные товары уже на складе.</p>';
 if(view==='history')return e.history.slice(0,30).map(t=>'<div class="exchange-row"><span>'+(RESOURCES[t.key]?.icon||'')+' '+(RESOURCES[t.key]?.label||t.key)+' · '+(t.side==='buy'?'Куплено':'Продано')+' '+num(t.amount)+' ед.<small>'+esc(t.seller)+' → '+esc(t.buyer)+' · '+new Date(t.time).toLocaleString('ru-RU')+'</small></span><b>'+num(t.price)+' ₽/ед.</b></div>').join('')||'<p class="panel-help">Сделок пока нет.</p>';
 const top=Object.entries(e.prices).filter(([,q])=>q.demand>0||q.supply>0).sort((a,b)=>b[1].demand-a[1].demand).slice(0,10);
 const rows=top.map(([k,q])=>'<div class="exchange-row"><span>'+RESOURCES[k].icon+' '+RESOURCES[k].label+'<small>Спрос '+num(q.demand)+' · предложение '+num(q.supply)+' ед.</small></span><b>'+(q.bid===null?'—':num(q.bid))+' / '+(q.ask===null?'—':num(q.ask))+' ₽</b></div>').join('');
 return (rows||'<p class="panel-help">Заявок и сделок пока нет.</p>')+'<p class="panel-help">Оборот игроков: '+num(e.stats.volume)+' ₽ · сделок: '+num(e.stats.trades)+' · комиссии: '+num(e.stats.fees)+' ₽.</p><p class="panel-help">Лавка выкупила товаров на '+num(e.stats.npcIssued)+' ₽ и продала на '+num(e.stats.npcRemoved)+' ₽.</p>';
}
export function renderExchange(p,submit){
 send=submit;state=p;const root=document.querySelector('#exchange');if(!root||!p.exchange)return;const e=p.exchange;renderShell(root,p);
 root.querySelector('#exchange-role').textContent=SPECIALIZATIONS[p.specialization]?.name||'Универсал';root.querySelector('#career-select').value=p.specialization;
 root.querySelector('#career-info').textContent=(SPECIALIZATIONS[p.specialization]?.description||'')+' Хлеб рабочим: '+(p.fed?'обеспечен, выпуск +10%':'без бонуса')+' · спрос '+((p.foodDemand||0)*60).toFixed(1)+' ед./мин.';
 renderTabs(root);
 if(view==='market'){renderMarket(root,p,e);return;}
 lastDealSignature='';const content=root.querySelector('#exchange-content');
 const title={mine:'Мои заявки',deliveries:'Пункт получения',history:'История сделок',stats:'Спрос и состояние рынка'}[view]||'Рынок';
 html(content,'<div class="exchange-secondary-title">'+title+'</div><div class="exchange-secondary-list">'+renderOther(root,e)+'</div>');
}
