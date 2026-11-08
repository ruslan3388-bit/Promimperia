export const SPECIALIZATIONS={
 generalist:{name:'Универсал',sectors:[],description:'Доступны все отрасли; производство без специализационной надбавки.'},
 forestry:{name:'Лесопромышленник',buildings:['sawmill','boardMill'],description:'Лесокомбинат выпускает древесину, мастерская — доски. Выпуск +25%.'},
 baker:{name:'Фермер и пекарь',buildings:['farm','foodPlant','mill','bakery','textile','tailor'],description:'Зерно, мука, хлеб, ткань и одежда. Выпуск +25%.'},
 metal:{name:'Металлург',buildings:['mine','smelter','coalMine','alloyPlant'],description:'Руда, уголь, сталь и сплавы. Выпуск +25%.'},
 energy:{name:'Энергетик и химик',buildings:['power','thermal','solar','oilWell','refinery'],description:'Энергия, топливо и полимеры. Выпуск +25%.'},
 engineer:{name:'Инженер',buildings:['lab','university','machinePlant','robotics','spaceport'],description:'Микросхемы, оборудование, роботы и спутники. Выпуск +25%.'},
 builder:{name:'Строитель',sectors:['construction'],description:'Камень, цемент, стекло и город. Выпуск и доход +25%.'},
 merchant:{name:'Торговец',buildings:[],description:'Торговая специализация: 24 заявки и комиссия продавца 1%.'}
};
export const MARKET_RULES={maxQuantity:5000,maxPrice:1000000,orderHours:72,switchHours:24,switchCost:1500};
export const RESEARCH_BRANCHES={logistics:['*'],agronomy:['baker','forestry'],chemistry:['energy','engineer','builder','metal'],engineering:['metal','engineer','builder'],electronics:['engineer'],automation:['engineer'],orbital:['engineer'],frontier:['engineer'],energy:['energy','engineer'],efficiency:['*'],analytics:['merchant'],civilEngineering:['builder'],urbanSystems:['builder']};
export function sectorBonus(p,key,b){const s=SPECIALIZATIONS[p.specialization];return s&&(s.sectors?.includes(b.sector)||s.buildings?.includes(key))?1.25:1;}
export function specializationAllowsBuilding(p,key,b){if(!p.specializationAt||p.specialization==='generalist')return true;if(key==='mine'||key==='power')return true;const s=SPECIALIZATIONS[p.specialization];return Boolean(s&&(s.sectors?.includes(b.sector)||s.buildings?.includes(key)));}
export function specializationAllowsResearch(p,key){if(!p.specializationAt||p.specialization==='generalist')return true;const roles=RESEARCH_BRANCHES[key]||[];return roles.includes('*')||roles.includes(p.specialization);}
export function primarySector(p,buildings){const s=SPECIALIZATIONS[p.specialization];if(!s)return 'base';if(p.specialization==='generalist')return 'base';return s.sectors?.[0]||buildings[s.buildings?.[0]]?.sector||'base';}
export function buildingSpecialization(key,b){return Object.entries(SPECIALIZATIONS).find(([,s])=>s.sectors?.includes(b.sector)||s.buildings?.includes(key))?.[1]?.name||'Универсал';}
export function researchSpecialization(key){const roles=RESEARCH_BRANCHES[key]||[];return roles.includes('*')?'Доступно всем':roles.map(role=>SPECIALIZATIONS[role]?.name).filter(Boolean).join(', ')||'Другая специализация';}
