import {renderExchange} from './exchange-ui.mjs';
import {BUILDINGS,RESOURCES,SECTORS,RESEARCH,PROJECT} from './catalog.mjs';
import {primarySector,SPECIALIZATIONS,buildingSpecialization,specializationAllowsBuilding,specializationAllowsResearch,researchSpecialization} from './economy-config.mjs';
const $=s=>document.querySelector(s),fmt=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>fmt.format(Math.floor(n||0));
const tg=window.Telegram?.WebApp;
if(tg){tg.ready();tg.expand();tg.setHeaderColor?.('#101513');}
let socket,own,world={},sector='base',lastSpecialty='',timer,toastTimer,holdUntil=0,offset=0,economyHistory=[],historyOwner='',lastHistoryAt=0,pendingAction=null;
const now=()=>Date.now()+offset;
const remaining=end=>{const n=Math.max(0,Math.ceil((end-now())/1000));return n>=3600?`${Math.floor(n/3600)} ч ${Math.floor(n%3600/60)} мин`:n>=60?`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`:`${n} сек`;};
function html(id,markup){const el=$(id);if(el&&el.innerHTML!==markup)el.innerHTML=markup;}
function toast(text,error=false){$('#toast').textContent=text;$('#toast').classList.toggle('error',error);$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
function send(m){if(socket?.readyState!==WebSocket.OPEN||!own)return toast('Дождись подключения к региону',true);socket.send(JSON.stringify({...m,requestId:crypto.randomUUID()}));}
const historyKey=id=>`industrial-economy-history-${id}`;
function captureEconomy(){
 if(!own)return;
 if(historyOwner!==own.id){historyOwner=own.id;try{const stored=JSON.parse(localStorage.getItem(historyKey(own.id))||'[]');economyHistory=Array.isArray(stored)?stored.filter(x=>Number.isFinite(x.t)&&x.t>now()-600000&&['money','energy','ore','steel','efficiency'].every(k=>Number.isFinite(x[k]))).slice(-120):[];}catch{economyHistory=[];}}
 const time=now();if(time-lastHistoryAt<5000)return;lastHistoryAt=time;
 const states=Object.values(own.status||{}),efficiency=states.length?states.reduce((sum,s)=>sum+s.efficiency,0)/states.length:100;
 economyHistory.push({t:time,money:own.money,energy:own.stock.energy,ore:own.stock.ore,steel:own.stock.steel,efficiency});
 economyHistory=economyHistory.filter(x=>x.t>time-600000).slice(-120);try{localStorage.setItem(historyKey(own.id),JSON.stringify(economyHistory));}catch{}
}
function onboarding(){
 const step=own.onboardingStep||0;
 if(!own.specializationAt)return {n:1,total:1,done:0,title:'Выбери роль в экономике региона',description:'Пекарь, лесопромышленник, металлург или торговец? Специализация даёт преимущество, а базовые цепочки доступны всем.',href:'#exchange',cta:'Выбрать профессию',progress:'Первый выбор бесплатно'};
 if(step>=4){
  if(!own.tech.includes('engineering'))return {n:5,total:7,done:4,title:'Подготовь промышленную базу',description:'Изучи тяжёлое машиностроение: оно откроет гражданское строительство и новую городскую экономику.',href:'#research',cta:'Открыть науку',progress:'0 / 1'};
  if(!own.tech.includes('civilEngineering'))return {n:5,total:7,done:4,title:'Открой гражданское строительство',description:'Исследуй новую отрасль, чтобы добывать камень и песок, выпускать цемент и стекло.',href:'#research',cta:'Изучить отрасль',progress:own.research?.key==='civilEngineering'?`Завершение через ${remaining(own.research.end)}`:'0 / 1'};
  if(!own.tech.includes('urbanSystems'))return {n:6,total:7,done:5,title:'Собери строительный кластер',description:'Карьер, цементный и стекольный заводы дадут сырьё для стройматериалов. Запасись ими и изучи городские системы.',href:'#industry',cta:'Открыть строительство',progress:`Стекло ${num(Math.min(180,own.stock.glass))} / 180 · смеси ${num(Math.min(100,own.stock.buildingMaterials))} / 100`};
  if(!own.buildings.residential)return {n:7,total:7,done:6,title:'Построй первый жилой квартал',description:'Квартал требует энергии и материалов, зато создаёт постоянный денежный поток.',href:'#industry',cta:'Построить квартал',progress:'0 / 1'};
  return {n:7,total:7,done:7,title:'Городская экономика запущена',description:'Масштабируй строительную отрасль, следи за энергией и вкладывай доход в новые предприятия.',href:'#industry',cta:'Развивать город',progress:`${num(own.buildings.residential)} кварталов`};
 }
 if(step===0){const queued=own.queue.some(q=>q.key==='smelter');return {n:1,title:'Запусти металлургию',description:queued?'Плавильня уже строится. Подожди завершения очереди, затем проверь выпуск стали.':'Построй плавильню: она превращает руду и энергию в сталь.',href:'#industry',cta:queued?'Открыть очередь':'К предприятиям',progress:'0 / 4'};}
 if(step===1){const contract=own.contracts.find(c=>c.resource==='steel'),target=contract?.amount||60;return {n:2,title:'Произведи первую партию стали',description:`Нужно ${num(target)} ед. стали. Если плавильня остановилась, проверь запасы руды, энергии и место на складе.`,href:'#industry',cta:'Проверить производство',progress:`${num(Math.min(target,own.stock.steel))} / ${num(target)}`};}
 if(step===2)return {n:3,title:'Выполни первый контракт',description:'Сдай готовый заказ и получи деньги с наукой. Стальной контракт даст хороший запас на первое исследование.',href:'#contracts',cta:'Открыть заказы',progress:`${num(own.stats.contracts)} / 1`};
 return {n:4,title:'Изучи промышленную логистику',description:'Открой «Наука» и начни первое исследование. Если не хватает 3 500 ₽, продай часть стали на рынке.',href:'#research',cta:own.tech.includes('logistics')?'Выбрать исследование':'Открыть науку',progress:own.research?.key==='logistics'?`Завершение через ${remaining(own.research.end)}`:'0 / 1'};
}
function renderOnboarding(){const o=onboarding(),total=o.total||4,done=o.done??own.onboardingStep??0;html('#next-step',`<div class="next-step-copy"><span class="panel-index">СЛЕДУЮЩИЙ ШАГ · ${o.n} ИЗ ${total}</span><h2>${o.title}</h2><p>${o.description}</p><div class="step-track" aria-label="Шаг ${o.n} из ${total}">${Array.from({length:total},(_,i)=>i+1).map(n=>`<i class="${n<=done?'done':''} ${n===o.n?'current':''}"></i>`).join('')}<span>${o.progress}</span></div></div><a class="next-step-cta" href="${o.href}">${o.cta} <span>↗</span></a>`);}
function renderEconomy(){const metrics=[['money','Капитал','₽'],['energy','Энергия','⚡'],['ore','Руда','🪨'],['steel','Сталь','🔩'],['efficiency','Работа заводов','%']];html('#economy-history',metrics.map(([key,label,unit])=>{const values=economyHistory.map(x=>x[key]),min=Math.min(...values,0),max=Math.max(...values,1),span=max-min||1,points=values.map((v,i)=>`${values.length<2?100:i/(values.length-1)*200},${38-(v-min)/span*34}`).join(' '),last=values.at(-1)??0,first=values[0]??0,change=last-first,trend=change>0?'up':change<0?'down':'flat';return `<div class="economy-row"><span>${label}<b>${key==='efficiency'?`${Math.round(last)}%`:`${num(last)} ${unit}`}</b></span><svg viewBox="0 0 200 42" preserveAspectRatio="none" role="img" aria-label="${label}: ${trend==='up'?'рост':trend==='down'?'снижение':'стабильно'}"><polyline class="sparkline ${trend}" points="${points||'0,38 200,38'}"/></svg><small class="${trend}">${change>0?'+':''}${key==='efficiency'?`${Math.round(change)} п.п.`:`${num(change)} ${unit}`}</small></div>`;}).join(''));}
function renderCompletions(){const items=own.notifications||[],unread=items.filter(n=>!n.read).length;$('#completion-count').textContent=`${unread} новых`;
 $('#player-avatar').dataset.unread=unread?String(unread):'';$('#read-completions').hidden=!unread;
 html('#completion-list',items.length?items.slice(0,10).map(n=>`<div class="completion-row ${n.read?'':'unread'}"><i></i><span>${esc(n.text)}</span><time>${new Date(n.time).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</time></div>`).join(''):'<p class="panel-help">Завершения строительства и исследований появятся здесь.</p>');}
function openProfile(){if(!own)return;$('#profile-name').textContent=`Компания «${own.name}»`;const playerId=own.id.startsWith('tg-')?own.id.slice(3):own.id;html('#profile-details',`<div><span>Идентификатор</span><b>${esc(playerId)}</b></div><div><span>Основана</span><b>${new Date(own.createdAt).toLocaleDateString('ru-RU',{year:'numeric',month:'long',day:'numeric'})}</b></div><div><span>Объектов</span><b>${num(Object.values(own.buildings).reduce((a,b)=>a+b,0))}</b></div><div><span>Контрактов выполнено</span><b>${num(own.stats.contracts)}</b></div><div><span>Сохранение</span><b>${world.storage?.ok?'Синхронизировано':'Проверить соединение'}</b></div>`);$('#copy-player-id').dataset.copy=playerId;$('#profile-dialog').showModal();}
function askAction(action,title,details){pendingAction=action;$('#confirm-title').textContent=title;$('#confirm-details').textContent=details;$('#confirm-dialog').showModal();}
function connect(){
 clearTimeout(timer);const endpoint=new URL('.',import.meta.url);endpoint.protocol=location.protocol==='https:'?'wss:':'ws:';socket=new WebSocket(endpoint.href);
 socket.onopen=()=>{let id=localStorage.getItem('industrial-frontier-id');if(!id){id=crypto.randomUUID();localStorage.setItem('industrial-frontier-id',id);}socket.send(JSON.stringify({type:'auth',initData:tg?.initData||'',devId:id,name:'Инженер'}));};
 socket.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
 if(m.type==='ready'||m.type==='world'){
 own=m.self;world=m.world;offset=world.serverTime-Date.now();captureEconomy();document.body.classList.remove('offline');
 $('#connection-label').textContent=`Компания «${own.name}» · регион подключён`;$('#online-count').textContent=`${world.online} в сети`;$('#player-avatar').textContent=own.name[0];
 $('#footer-status').textContent=world.storage?.ok?'ПРОГРЕСС СОХРАНЯЕТСЯ':'ОШИБКА СОХРАНЕНИЯ';
 if(m.type==='ready'&&m.away>60)toast(`С возвращением! Производство за время отсутствия учтено (до 8 часов).`);
 render();
 }else if(m.type==='notice'||m.type==='error')toast(m.message,m.type==='error');};
 socket.onclose=e=>{document.body.classList.add('offline');$('#connection-label').textContent=e.code===1008?'Открой игру кнопкой «Играть» в Telegram':'Восстанавливаем связь…';$('#footer-status').textContent='НЕТ СВЯЗИ';timer=setTimeout(connect,e.code===1008?12000:2000);};
 socket.onerror=()=>socket.close();
}
function materials(items){return Object.entries(items||{}).map(([k,v])=>`<span class="${own.stock[k]<v?'shortage':''}">${RESOURCES[k].icon} ${num(own.stock[k])} / ${num(v)}</span>`).join(' · ');}
const canPay=(cost,items={})=>own.money>=cost&&Object.entries(items).every(([k,v])=>own.stock[k]>=v);
const button=(label,type,key='',disabled=false,extra='')=>`<button class="action-btn" data-action="${type}" data-key="${key}" ${disabled?'disabled':''} ${extra}>${label}</button>`;
function render(){if(!own||Date.now()<holdUntil)return;
 if(own.specialization!==lastSpecialty){lastSpecialty=own.specialization;sector=primarySector(own,BUILDINGS);}
 const completed=own.tech.length;
 renderOnboarding();renderEconomy();renderCompletions();renderExchange(own,send);
 const chapter=own.victory&&own.tech.includes('urbanSystems')?6:own.victory?5:own.tech.includes('orbital')?4:own.tech.includes('engineering')?3:completed?2:1;
 const chapterName=chapter===6?'Город будущего':chapter===5?'Орбитальная империя':chapter===4?'Выход на орбиту':chapter===3?'Технологический рывок':chapter===2?'Диверсификация':'Промышленный старт';
 html('#campaign-summary',`<div><small>ГЛАВА ${chapter} / 6</small><strong>${chapterName}</strong></div><div><b>${completed} / ${Object.keys(RESEARCH).length}</b><span>технологий</span></div><div><b>${num(own.stats.contracts)}</b><span>поставок выполнено</span></div><a href="#goals">Цели и награды ↗</a>`);
 const featured=['energy','ore','steel','science'];
  html('#metrics',`<article class="metric-card balance-card"><div class="metric-heading">КАПИТАЛ · ₽</div><div class="metric-value">${num(own.money)} ₽</div><div class="metric-foot">Денежный поток: ${(own.income||0)-(own.upkeep||0)>=0?'+':''}${((own.income||0)-(own.upkeep||0)).toFixed(1)} ₽/с<br>Доход +${(own.income||0).toFixed(1)} · обслуживание −${(own.upkeep||0).toFixed(1)} ₽/с</div></article>`+featured.map(k=>`<article class="metric-card"><div class="metric-heading">${RESOURCES[k].label} <span>${RESOURCES[k].icon}</span></div><div class="metric-value">${num(own.stock[k])}</div><div class="metric-foot">${(own.rates[k]||0)>=0?'+':''}${(own.rates[k]||0).toFixed(2)} / сек · лимит ${num(own.capacity)}</div><div class="meter"><i style="width:${Math.min(100,own.stock[k]/own.capacity*100)}%"></i></div></article>`).join(''));
 const mainSector=primarySector(own,BUILDINGS),otherSectors=Object.entries(SECTORS).filter(([k])=>k!==mainSector);
 html('#sector-tabs',`<button class="sector-tab ${sector===mainSector?'selected':''}" data-sector="${mainSector}">★ ${SECTORS[mainSector]}</button><details class="other-branches" ${sector!==mainSector?'open':''}><summary>${sector===mainSector?'Другие отрасли':'Просмотр отраслей'} · ${otherSectors.length}</summary><div>${otherSectors.map(([k,v])=>`<button class="sector-tab ${sector===k?'selected':''}" data-sector="${k}">⌑ ${v}</button>`).join('')}</div></details>`);
  const guides={all:'Сырьё → материалы → машины → роботы → спутники. Новая ветка: камень и песок → цемент и стекло → городской доход.',base:'Руда → сталь. Сталь + уголь → спецсплавы.',energy:'Уголь → ТЭЦ → энергия. Солнечные парки работают без топлива.',agro:'Зерно → пищевые продукты. Лесокомбинаты поставляют древесину.',chem:'Нефть + энергия → полимеры → машиностроение.',tech:'Сталь + полимеры + микросхемы → оборудование → роботы.',space:'Исследовательский центр → технологии. Роботы + сплавы + чипы → спутники.',construction:'Карьер → цемент и стекло → стройматериалы → жилые кварталы с постоянным доходом.'};
 $('#chain-guide').textContent=guides[sector];
 $('#factory-count').textContent=`${Object.values(own.buildings).reduce((a,b)=>a+b,0)} объектов`;
 html('#construction-queue',own.queue.length?`<b>Строительная очередь · ${own.queue.length}/3</b>`+own.queue.map((q,i)=>`<div class="queue-item"><span>${i+1}. ${BUILDINGS[q.key].name}</span><b>${remaining(q.end)}</b></div>`).join('')+button('Отменить последнюю · возврат 80%','cancelBuild'):'<span class="panel-help">Строительная очередь свободна · до трёх объектов</span>');
 html('#buildings',Object.entries(BUILDINGS).filter(([key,b])=>sector==='all'||b.sector===sector||key==='mine'||key==='power'||(sector===mainSector&&own.specialization!=='generalist'&&specializationAllowsBuilding(own,key,b))).map(([key,b])=>{
 const count=own.buildings[key],o=own.offers[key],state=own.status[key],paused=own.paused.includes(key);
  if(!o.specializationOpen)return `<article class="branch-teaser"><span>🔒 ${b.icon} ${b.name}</span><small>Ветка: ${buildingSpecialization(key,b)}</small></article>`;
  const rates=Object.entries(b.rate).map(([k,v])=>`${v>0?'+':''}${v} ${RESOURCES[k].icon}/с`).join(' · '),income=b.income?`<br>Доход ${b.income} ₽/с на объект`:'';
  return `<article class="building-card ${!o.unlocked?'locked':''}"><div class="building-icon">${b.icon}</div><div class="building-info"><div class="building-name">${b.name}<span class="level-pill">×${count}</span></div><div class="building-desc">${rates}<br>Обслуживание ${b.upkeep} ₽/с на объект${income}</div><div class="plant-status ${state?.efficiency<100?'shortage':''}">${count?esc(state?.reason||'Запуск…')+' · '+(state?.efficiency||0)+'%':o.unlocked?'Готово к строительству':'Нужно: '+RESEARCH[b.tech].name}</div><div class="materials">${materials(o.materials)}</div></div><div class="building-actions">${button(`${count?'Расширить':'Строить'} · ${num(o.cost)} ₽<small>${Math.ceil(o.seconds/60)} мин</small>`,'build',key,!o.unlocked||o.limit||own.queue.length>=3||!canPay(o.cost,o.materials))}${count?button(paused?'▶ Запустить':'Ⅱ Пауза','pause',key):''}</div></article>`;
 }).join(''));
 const blocked=Object.entries(own.status).filter(([,s])=>s.efficiency<100);
 $('#supply-title').textContent=blocked.length?`${blocked.length} производств работают не полностью`:'Производственные цепочки обеспечены';
 $('#supply-message').textContent=blocked.slice(0,2).map(([k,s])=>`${BUILDINGS[k].name}: ${s.reason}`).join(' · ')||'Следи за ёмкостью склада и расходами на обслуживание.';
 $('#supply-advisor').classList.toggle('warning',blocked.length>0);
 renderMarket();renderResearch();renderGoals();renderContracts();renderRegion();
}
function renderMarket(){
 const event=world.event;$('#market-event').textContent=`Государственная лавка: резерв для одиночной игры. Покупка у игроков часто выгоднее. Квоты обновляются каждый час.`;
 const selected=$('#trade-amount').value;
 html('#market-list',Object.entries(own.trade).map(([k,price])=>{
 const buyAmount=selected==='max'?Math.min(5000,own.exchange?.prices[k]?.buyLeft??5000,Math.floor(own.money/price.buy),Math.max(0,own.capacity-own.stock[k])):Number(selected);
 const sellAmount=selected==='max'?Math.min(5000,own.exchange?.prices[k]?.sellLeft??5000,own.stock[k]):Number(selected);
 return `<div class="trade-row"><div class="trade-resource">${RESOURCES[k].icon} <b>${RESOURCES[k].label}</b><small>На складе: ${num(own.stock[k])}</small></div><div class="trade-buttons">${button(`Купить · ${num(price.buy)} ₽/ед.`,'buy',k,buyAmount>(own.exchange?.prices[k]?.buyLeft??5000)||buyAmount<1||buyAmount*price.buy>own.money||buyAmount>own.capacity-own.stock[k])}${button(`Продать · ${num(price.sell)} ₽/ед.`,'sell',k,sellAmount>(own.exchange?.prices[k]?.sellLeft??5000)||sellAmount<1||sellAmount>own.stock[k])}</div></div>`;
 }).join(''));
 const value=Object.entries(own.trade).reduce((s,[k,v])=>s+own.stock[k]*v.sell,0);$('#market-value').textContent=`СКЛАД: ${num(value)} ₽`;
 const cost=Math.ceil(5000*Math.pow(1.7,own.warehouse));html('#warehouse-controls',`<div class="warehouse-box"><span>Склад ур. ${own.warehouse+1}<small>${num(own.capacity)} ед. каждого ресурса</small></span>${button(`+5 000 мест · ${num(cost)} ₽`,'warehouse','',own.warehouse>=20||own.money<cost)}</div>`);
}
function renderResearch(){
 $('#research-count').textContent=`${own.tech.length} / ${Object.keys(RESEARCH).length}`;
 html('#research-queue',own.research?`<div class="queue-item"><span>${RESEARCH[own.research.key].name} · ${remaining(own.research.end)}</span>${button('Отменить · 80%','cancelResearch')}</div>`:'<p class="panel-help">Очередь исследований свободна</p>');
 const entries=Object.entries(RESEARCH),active=entries.filter(([key])=>specializationAllowsResearch(own,key)),other=entries.filter(([key])=>!specializationAllowsResearch(own,key));
 const cards=([key,r])=>{const done=own.tech.includes(key),running=own.research?.key===key,prerequisiteLocked=!r.requires.every(k=>own.tech.includes(k));return `<article class="tech-card ${done?'complete':''}"><div class="tech-heading"><b>${r.name}</b><span>${done?'✓ Изучено':running?remaining(own.research.end):`${r.seconds/60} мин`}</span></div><p>${r.description}</p><div class="materials">${materials(r.materials)}</div><small>${r.requires.length?'После: '+r.requires.map(k=>RESEARCH[k].name).join(', '):'Начальная технология'}</small>${button(done?'Изучено':running?'Исследуется':`Изучить · ${num(r.cost)} ₽`,'research',key,done||!!own.research||prerequisiteLocked||!canPay(r.cost,r.materials))}</article>`;};
 html('#research-list',active.map(cards).join('')+(other.length?`<details class="locked-tech"><summary>Другие направления · ${other.length}</summary>${other.map(([key,r])=>`<div class="branch-teaser"><span>🔒 ${r.name}</span><small>${researchSpecialization(key)}</small></div>`).join('')}</details>`:''));
}
function renderGoals(){
 html('#goals-list',own.goals.map(g=>`<article class="goal-card ${g.claimed?'complete':''}"><b>${g.name}</b><p>${g.description}</p><div class="contract-progress-row"><span>${num(g.progress)} / ${num(g.target)}</span><span>+${num(g.reward)} ₽ · ${g.science} 🔬</span></div><div class="contract-meter"><i style="width:${g.progress/g.target*100}%"></i></div>${button(g.claimed?'Награда получена':'Забрать награду','claim',g.id,g.claimed||g.progress<g.target)}</article>`).join(''));
 html('#megaproject',`<div class="project-box"><div><span class="panel-index">ФИНАЛЬНЫЙ МЕГАПРОЕКТ</span><h3>${PROJECT.name}</h3><p>${own.victory?'Связь с орбитой установлена. Развивай регион дальше и соревнуйся в рейтинге.':own.project?'Развёртывание сети: '+remaining(own.project.end):'Создай независимую спутниковую сеть. Технология «Межпланетная связь», 10 минут на запуск.'}</p><div class="materials">${materials(PROJECT.materials)}</div></div>${button(own.victory?'Сеть работает':own.project?'Запуск…':`Развернуть · ${num(PROJECT.cost)} ₽`,'project','',own.victory||!!own.project||!own.tech.includes(PROJECT.tech)||!canPay(PROJECT.cost,PROJECT.materials))}</div>`);
}
function renderContracts(){
 $('#contract-summary').textContent=`${own.stats.contracts} выполнено`;
 html('#contracts-list',own.contracts.map(c=>{const ratio=Math.min(1,own.stock[c.resource]/c.amount);const waiting=c.readyAt>now();return `<article class="contract-card ${ratio>=1?'ready':''}"><div class="contract-icon">${RESOURCES[c.resource].icon}</div><div class="contract-body"><div class="contract-title-row"><strong>${esc(c.title)}</strong><span class="contract-reward">+${num(c.reward)} ₽</span></div><div class="contract-description">Поставка и +2 очка науки</div><div class="contract-progress-row"><span>${num(own.stock[c.resource])} / ${num(c.amount)}</span><span>${Math.floor(ratio*100)}%</span></div><div class="contract-meter"><i style="width:${ratio*100}%"></i></div></div><button class="contract-submit" data-action="fulfill" data-contract="${esc(c.id)}" ${ratio<1||waiting?'disabled':''}>${waiting?remaining(c.readyAt):'Поставить ↗'}</button></article>`;}).join(''));
}
function renderRegion(){
 $('#leader-count').textContent=world.players.length;
 html('#leaderboard',world.players.slice(0,8).map((p,i)=>`<div class="leader-row"><span class="rank">${i+1}</span><span class="leader-name">${esc(p.name)} ${p.id===own.publicId?'<b class="you-tag">ВЫ</b>':''}${p.victory?' 🛰️':''}</span><span class="leader-score">${num(p.netWorth)} ₽</span></div>`).join(''));
 html('#activity-list',world.events.slice(0,8).map(e=>`<div class="event-chip" title="${esc(e.text)}"><span class="event-time">${new Date(e.time).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</span>${esc(e.text)}</div>`).join(''));
}
document.addEventListener('pointerdown',()=>{holdUntil=Date.now()+350;});
document.addEventListener('click',e=>{
 const tab=e.target.closest('[data-sector]');if(tab){sector=tab.dataset.sector;holdUntil=0;return render();}
 const close=e.target.closest('[data-dialog-close]');if(close){close.closest('dialog')?.close();pendingAction=null;return;}
 if(e.target.id==='player-avatar'){openProfile();return;}
 if(e.target.id==='copy-player-id'){if(navigator.clipboard?.writeText)navigator.clipboard.writeText(e.target.dataset.copy||'').then(()=>toast('ID скопирован'),()=>toast('Не удалось скопировать ID',true));else toast('Буфер обмена недоступен',true);return;}
 if(e.target.id==='confirm-accept'){if(pendingAction)send(pendingAction);pendingAction=null;$('#confirm-dialog').close();return;}
 const b=e.target.closest('button[data-action]');if(!b||b.disabled)return;
 const type=b.dataset.action,key=b.dataset.key,amount=['buy','sell'].includes(type)?($('#trade-amount').value==='max'?'max':Number($('#trade-amount').value)):undefined,action={type,key,contractId:b.dataset.contract,amount};
 if(type==='project')return askAction(action,'Развернуть орбитальную сеть?','Будет списано 500 000 ₽ и ресурсы проекта. После подтверждения начнётся 10-минутный запуск.');
 if(type==='cancelBuild'){const job=own.queue.at(-1);return askAction(action,'Отменить строительство?',`${BUILDINGS[job.key].name}: вернётся 80% затрат. Остальные сроки стройки сохранятся.`);}
 if(type==='cancelResearch')return askAction(action,'Отменить исследование?','Вернётся 80% денег и материалов. Текущий прогресс исследования потеряется.');
 if(type==='build'&&own.offers[key].cost>=20000)return askAction(action,'Подтвердить расширение?',`${BUILDINGS[key].name}: ${num(own.offers[key].cost)} ₽ и материалы. Стройка встанет в очередь.`);
 if(type==='research'&&RESEARCH[key].cost>=100000)return askAction(action,'Подтвердить исследование?',`${RESEARCH[key].name}: ${num(RESEARCH[key].cost)} ₽ и материалы. Исследование займёт ${Math.round(RESEARCH[key].seconds/60)} минут.`);
 if(type==='sell'){const count=amount==='max'?Math.min(5000,own.exchange?.prices[key]?.sellLeft??5000,Math.floor(own.stock[key])):amount;if(count>=1000)return askAction({...action,amount:count},`Продать ${num(count)} ед. ${RESOURCES[key].label}?`,`Цена ${num(own.trade[key].sell)} ₽/ед. · выручка около ${num(count*own.trade[key].sell)} ₽.`);}
 send(action);
});
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){dialog.close();pendingAction=null;}});
window.addEventListener('scroll',()=>requestAnimationFrame(()=>{const sections=['exchange','industry','market','contracts','research'].map(id=>document.getElementById(id));let active=sections[0];for(const section of sections){const rect=section.getBoundingClientRect();if(rect.top<innerHeight*.48&&rect.bottom>90)active=section;}for(const link of document.querySelectorAll('.mobile-dock a')){const selected=link.hash===`#${active.id==='market'?'exchange':active.id}`;link.classList.toggle('active',selected);if(selected)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}}),{passive:true});
$('#trade-amount').addEventListener('change',()=>{if(own)renderMarket();});
$('#chat-form').addEventListener('submit',e=>{e.preventDefault();const input=$('#chat-input');if(input.value.trim()){send({type:'chat',text:input.value.trim()});input.value='';}});
connect();
