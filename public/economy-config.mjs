export const SPECIALIZATIONS={
 generalist:{name:'Универсал',sectors:[],description:'Все базовые цепочки доступны. Выбери отрасль, чтобы выпускать на 25% больше.'},
 forestry:{name:'Лесопромышленник',buildings:['sawmill','boardMill'],description:'Древесина и доски для фабрик. Выпуск +25%.'},
 baker:{name:'Фермер и пекарь',sectors:['agro'],description:'Зерно, мука, хлеб и продукты. Выпуск +25%.'},
 metal:{name:'Металлург',sectors:['base'],description:'Руда, уголь, сталь и сплавы. Выпуск +25%.'},
 energy:{name:'Энергетик и химик',sectors:['energy','chem'],description:'Энергия, топливо, полимеры. Выпуск +25%.'},
 engineer:{name:'Инженер',sectors:['tech','space'],description:'Компоненты, машины и наука. Выпуск +25%.'},
 builder:{name:'Строитель',sectors:['construction'],description:'Материалы и город. Выпуск и доход +25%.'},
 merchant:{name:'Торговец',sectors:[],description:'24 заявки вместо 8. Комиссия продавца 1% вместо 2%.'}
};
export const MARKET_RULES={maxQuantity:5000,maxPrice:1000000,orderHours:72,switchHours:24,switchCost:1500};
export function sectorBonus(p,key,b){const s=SPECIALIZATIONS[p.specialization];return s&&(s.sectors?.includes(b.sector)||s.buildings?.includes(key))?1.25:1;}
