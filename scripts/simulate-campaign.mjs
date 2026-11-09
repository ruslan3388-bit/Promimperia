import {createPlayer,advance,action,buildOffer,availableResources,quote} from '../engine.mjs';
import {BUILDINGS,RESEARCH,RESOURCES,PROJECT,GOALS} from '../public/catalog.mjs';
const start=1800000000000,p=createPlayer({id:'simulation',name:'Simulation'},start),world={};
const order=['logistics','agronomy','chemistry','energy','engineering','efficiency','electronics','analytics','automation','orbital','frontier'];
const target={power:10,mine:4,smelter:4,lab:4,coalMine:3,thermal:4,university:5,farm:2,sawmill:2,foodPlant:2,oilWell:3,refinery:3,alloyPlant:3,machinePlant:3,solar:2,robotics:3,spaceport:2};
const log=[];
function acquire(materials,budget,t){
 if(p.money<budget)return;
 for(const[k,n]of Object.entries(materials||{})){if(k==='science'||!availableResources(p).includes(k))continue;const need=Math.ceil(Math.max(0,n-p.stock[k]));if(need&&need<=5000&&p.money-need*quote(p,world,k,'buy',t)>=budget)action(p,{type:'buy',key:k,amount:need},world,t);}
}
let finish=null;
for(let sec=5;sec<=24*3600;sec+=5){
 const t=start+sec*1000;advance(p,5,t);
 if(p.victory){finish=sec;break;}
 if(sec%30)continue;
 const next=order.find(k=>!p.tech.includes(k)&&p.research?.key!==k);
 const reserve={ore:60,energy:150,steel:120,chips:70,coal:150,timber:100,grain:150,food:100,oil:150,plastic:150,alloy:150,machinery:70,robots:70,satellites:10};
 if(next)for(const[k,v]of Object.entries(RESEARCH[next].materials))reserve[k]=Math.max(reserve[k]||0,v);
 if(p.tech.includes('frontier'))for(const[k,v]of Object.entries(PROJECT.materials))reserve[k]=Math.max(reserve[k]||0,v);
 for(const k of availableResources(p)){const excess=Math.min(5000,Math.floor(p.stock[k]-(reserve[k]||0)));if(excess>0)action(p,{type:'sell',key:k,amount:excess},world,t);}
 for(const g of GOALS)action(p,{type:'claim',key:g.id},world,t);
 for(const c of [...p.contracts])if(p.stock[c.resource]-c.amount>(reserve[c.resource]||0))action(p,{type:'fulfill',contractId:c.id},world,t);
 if(!p.research&&next){const r=RESEARCH[next];if(r.requires.every(k=>p.tech.includes(k))){acquire(r.materials,r.cost,t);if(action(p,{type:'research',key:next},world,t).ok)log.push({minute:sec/60,research:next});}}
 if(p.tech.includes('frontier')){acquire(PROJECT.materials,PROJECT.cost,t);action(p,{type:'project'},world,t);
  if(!p.project)for(const key of['spaceport','robotics','machinePlant','alloyPlant']){
   const need={satellites:PROJECT.materials.satellites+20,robots:PROJECT.materials.robots+200,alloy:PROJECT.materials.alloy+500};
   const saturated=Object.entries(BUILDINGS[key].rate).filter(([,v])=>v>0).every(([k])=>p.stock[k]>=(need[k]||300));
   if(saturated!==p.paused.includes(key))action(p,{type:'pause',key},world,t);
  }
 }
 const buildOrder=['power','mine','smelter','lab','university','coalMine','thermal','farm','sawmill','foodPlant','oilWell','refinery','alloyPlant','machinePlant','solar','robotics','spaceport'];
 for(const key of buildOrder){if(p.queue.length>=3)break;const count=p.buildings[key]+p.queue.filter(q=>q.key===key).length;if(count>=target[key])continue;const offer=buildOffer(p,key);if(!offer.unlocked)continue;
 if(next&&!p.research&&p.money<RESEARCH[next].cost+offer.cost&&p.buildings.university>=2&&p.buildings[key]>=1)continue;
 acquire(offer.materials,offer.cost,t);action(p,{type:'build',key},world,t);
 }
}
console.log(JSON.stringify({completed:!!finish,minutes:finish?finish/60:null,money:Math.floor(p.money),research:p.tech,buildings:p.buildings,log},null,2));
if(!finish)process.exitCode=1;
