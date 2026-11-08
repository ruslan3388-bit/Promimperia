export const VERSION = '4.0';
export const RESOURCES = {
 ore:{label:'Руда',icon:'🪨',price:12}, energy:{label:'Энергия',icon:'⚡',price:8}, steel:{label:'Сталь',icon:'🔩',price:42}, chips:{label:'Микросхемы',icon:'💠',price:180},
 coal:{label:'Уголь',icon:'⬛',price:10}, timber:{label:'Древесина',icon:'🪵',price:14}, grain:{label:'Зерно',icon:'🌾',price:6}, food:{label:'Продукты',icon:'🍞',price:28},
 oil:{label:'Нефть',icon:'🛢️',price:24}, plastic:{label:'Полимеры',icon:'🧪',price:70}, alloy:{label:'Сплавы',icon:'⚙️',price:135}, machinery:{label:'Оборудование',icon:'🏗️',price:450},
 robots:{label:'Роботы',icon:'🤖',price:1800}, satellites:{label:'Спутники',icon:'🛰️',price:12000},
 stone:{label:'Камень',icon:'🪨',price:9}, sand:{label:'Песок',icon:'🏖️',price:7}, cement:{label:'Цемент',icon:'🧱',price:32}, glass:{label:'Стекло',icon:'🪟',price:68}, buildingMaterials:{label:'Стройматериалы',icon:'🏗️',price:150},
 boards:{label:'Доски',icon:'🪵',price:28}, flour:{label:'Мука',icon:'🌾',price:12}, bread:{label:'Хлеб',icon:'🍞',price:24}, fabric:{label:'Ткань',icon:'🧵',price:48}, clothing:{label:'Рабочая одежда',icon:'👕',price:110},
 science:{label:'Наука',icon:'🔬',price:0}
};
export const SECTORS = {base:'Добыча и металлургия',energy:'Энергетика',agro:'Агропром и лес',chem:'Нефтехимия',tech:'Машиностроение',space:'Наука и космос',construction:'Строительство'};
export const BUILDINGS = {
 boardMill:{name:'Столярная мастерская',icon:'🪚',sector:'agro',cost:950,time:30,rate:{timber:-.5,energy:-.1,boards:.4},upkeep:.12},
 mill:{name:'Мельница',icon:'🌾',sector:'agro',cost:800,time:25,rate:{grain:-.8,energy:-.1,flour:.6},upkeep:.1},
 bakery:{name:'Пекарня',icon:'🍞',sector:'agro',cost:1200,time:35,materials:{boards:10},rate:{flour:-.5,energy:-.15,bread:.4},upkeep:.15},
 textile:{name:'Текстильная фабрика',icon:'🧵',sector:'agro',cost:8000,time:80,tech:'agronomy',materials:{boards:30,steel:30},rate:{grain:-.4,energy:-.3,fabric:.15},upkeep:.4},
 tailor:{name:'Швейная фабрика',icon:'👕',sector:'agro',cost:12000,time:100,tech:'agronomy',materials:{boards:40,steel:40},rate:{fabric:-.2,energy:-.25,clothing:.12},upkeep:.5},
 mine:{name:'Рудник',icon:'⛏️',sector:'base',cost:600,time:15,rate:{ore:1.4},upkeep:0},
 power:{name:'Электростанция',icon:'⚡',sector:'energy',cost:700,time:15,rate:{energy:2},upkeep:0},
 smelter:{materials:{boards:8},name:'Плавильня',icon:'🔥',sector:'base',cost:850,time:30,rate:{ore:-1.1,energy:-.35,steel:.65},upkeep:.25},
 lab:{materials:{boards:12},name:'Микролаборатория',icon:'💠',sector:'tech',cost:1400,time:40,rate:{steel:-.3,energy:-.55,chips:.16},upkeep:.4},
 coalMine:{name:'Угольный разрез',icon:'⬛',sector:'base',cost:1800,time:35,tech:'logistics',rate:{coal:1.2,energy:-.15},upkeep:.2},
 thermal:{name:'Теплоэлектроцентраль',icon:'🏭',sector:'energy',cost:4200,time:60,tech:'logistics',materials:{steel:30,boards:20},rate:{coal:-.6,energy:9},upkeep:.8},
 solar:{name:'Солнечный парк',icon:'☀️',sector:'energy',cost:18000,time:120,tech:'energy',materials:{steel:100,chips:30},rate:{energy:7},upkeep:.15},
 sawmill:{name:'Лесокомбинат',icon:'🪵',sector:'agro',cost:2400,time:45,rate:{energy:-.25,timber:.9},upkeep:.3},
 farm:{name:'Агрокомплекс',icon:'🌾',sector:'agro',cost:2800,time:45,rate:{energy:-.35,grain:2.5},upkeep:.5},
 foodPlant:{name:'Пищевой комбинат',icon:'🍞',sector:'agro',cost:6500,time:80,tech:'agronomy',materials:{steel:30,timber:50},rate:{grain:-1.8,energy:-.4,food:.8},upkeep:.8},
 oilWell:{name:'Нефтяная вышка',icon:'🛢️',sector:'chem',cost:9000,time:90,tech:'chemistry',materials:{steel:80},rate:{energy:-.8,oil:1.1},upkeep:1.2},
 refinery:{name:'Полимерный завод',icon:'🧪',sector:'chem',cost:17000,time:120,tech:'chemistry',materials:{steel:150,chips:20},rate:{oil:-.7,energy:-1.2,plastic:.65},upkeep:1.5},
 alloyPlant:{name:'Завод спецсплавов',icon:'⚙️',sector:'base',cost:26000,time:150,tech:'engineering',materials:{steel:200},rate:{steel:-.8,coal:-.3,energy:-1.3,alloy:.5},upkeep:2},
 machinePlant:{name:'Машиностроительный завод',icon:'🏗️',sector:'tech',cost:48000,time:180,tech:'engineering',materials:{alloy:40,chips:50},rate:{steel:-.65,plastic:-.2,chips:-.08,energy:-1.5,machinery:.22},upkeep:2.5},
 university:{name:'Исследовательский центр',icon:'🔬',sector:'space',cost:6000,time:90,tech:'logistics',materials:{steel:40},rate:{energy:-.8,science:.08},upkeep:.7},
 robotics:{name:'Фабрика роботов',icon:'🤖',sector:'tech',cost:110000,time:240,tech:'automation',materials:{machinery:35,alloy:100},rate:{machinery:-.12,chips:-.25,plastic:-.3,energy:-2.5,robots:.12},upkeep:4},
 spaceport:{name:'Орбитальная верфь',icon:'🚀',sector:'space',cost:320000,time:300,tech:'orbital',materials:{robots:40,alloy:300},rate:{robots:-.08,alloy:-.5,chips:-.35,energy:-4,satellites:.035},upkeep:8},
 quarry:{name:'Карьер нерудных материалов',icon:'⛏️',sector:'construction',cost:15000,time:120,tech:'civilEngineering',rate:{energy:-.12,stone:1.4,sand:.9},upkeep:.45},
 cementWorks:{name:'Цементный завод',icon:'🧱',sector:'construction',cost:28000,time:180,tech:'civilEngineering',materials:{steel:120},rate:{stone:-1,coal:-.18,energy:-.6,cement:.72},upkeep:1.1},
 glassworks:{name:'Стекольный комбинат',icon:'🪟',sector:'construction',cost:38000,time:210,tech:'civilEngineering',materials:{steel:150},rate:{sand:-.65,coal:-.15,energy:-.75,glass:.48},upkeep:1.3},
 materialsPlant:{name:'Завод стройматериалов',icon:'🏗️',sector:'construction',cost:80000,time:240,tech:'civilEngineering',materials:{steel:200,machinery:15,boards:80,clothing:20},rate:{cement:-.5,glass:-.28,steel:-.18,energy:-1,buildingMaterials:.4},upkeep:1.8},
 residential:{name:'Жилой квартал',icon:'🏙️',sector:'construction',cost:210000,time:240,tech:'urbanSystems',materials:{buildingMaterials:60,glass:40,steel:120,boards:80,clothing:20},rate:{energy:-.5},upkeep:2,income:24}
};
export const RESEARCH = {
 logistics:{name:'Промышленная логистика',description:'Уголь, ТЭЦ, научные центры и новые поставки.',cost:3500,seconds:180,requires:[],materials:{}},
 agronomy:{name:'Агропромышленный комплекс',description:'Древесина, зерно и пищевая переработка.',cost:6500,seconds:300,requires:['logistics'],materials:{science:15}},
 chemistry:{name:'Нефтехимия',description:'Нефтедобыча и полимеры для новых производств.',cost:16000,seconds:600,requires:['logistics'],materials:{science:30,steel:100}},
 engineering:{name:'Тяжёлое машиностроение',description:'Сплавы и оборудование для автоматизации.',cost:42000,seconds:900,requires:['chemistry'],materials:{science:100,plastic:100}},
 electronics:{name:'Точная электроника',description:'Выпуск микросхем +25%. Основа робототехники.',cost:70000,seconds:1200,requires:['engineering'],materials:{science:180,chips:200}},
 automation:{name:'Робототехника',description:'Фабрики промышленных роботов; весь выпуск +10%.',cost:140000,seconds:1500,requires:['electronics'],materials:{science:300,machinery:100}},
 orbital:{name:'Орбитальная промышленность',description:'Сборка спутников на орбитальной верфи.',cost:360000,seconds:2700,requires:['automation'],materials:{science:600,robots:100,alloy:400}},
 frontier:{name:'Межпланетная связь',description:'Финальный проект: собственная орбитальная сеть.',cost:650000,seconds:3600,requires:['orbital'],materials:{science:900,satellites:10}},
 energy:{name:'Возобновляемая энергетика',description:'Солнечные парки. Расход энергии заводов −20%.',cost:22000,seconds:900,requires:['chemistry'],materials:{science:80,chips:100}},
 efficiency:{name:'Бережливое производство',description:'Весь выпуск +15%, без увеличения потребления.',cost:28000,seconds:600,requires:['agronomy'],materials:{science:70,food:150}},
 analytics:{name:'Торговая аналитика',description:'Закупки дешевле на 7%, продажа дороже на 5%.',cost:40000,seconds:720,requires:['engineering'],materials:{science:100,chips:150}},
 civilEngineering:{name:'Гражданское строительство',description:'Открой карьер, производство цемента, стекла и строительных смесей.',cost:120000,seconds:900,requires:['engineering'],materials:{science:180,steel:250,machinery:25}},
 urbanSystems:{name:'Городские системы',description:'Жилые кварталы превращают стройматериалы в стабильный денежный поток.',cost:300000,seconds:1800,requires:['civilEngineering'],materials:{science:500,glass:180,buildingMaterials:100}}
};
export const GOALS = [
 {id:'foundation',name:'Промышленная площадка',description:'Построй 5 предприятий',kind:'buildings',target:5,reward:3000,science:10},
 {id:'supplier',name:'Надёжный поставщик',description:'Выполни 10 контрактов',kind:'contracts',target:10,reward:9000,science:40},
 {id:'diverse',name:'Диверсификация',description:'Открой 4 исследования',kind:'research',target:4,reward:25000,science:100},
 {id:'industrial',name:'Промышленный район',description:'Построй 25 предприятий',kind:'buildings',target:25,reward:40000,science:120},
 {id:'engineer',name:'Серийное производство',description:'Произведи 300 единиц оборудования',kind:'machinery',target:300,reward:70000,science:150},
 {id:'robot',name:'Автономная фабрика',description:'Произведи 500 роботов',kind:'robots',target:500,reward:160000,science:250},
 {id:'orbit',name:'Выход на орбиту',description:'Произведи 30 спутников',kind:'satellites',target:30,reward:260000,science:300},
 {id:'network',name:'Орбитальная сеть',description:'Заверши мегапроект орбитальной связи',kind:'victory',target:1,reward:1000000,science:1000},
 {id:'civilWorks',name:'Строительный кластер',description:'Построй 10 предприятий строительной отрасли',kind:'sectorBuildings',sector:'construction',target:10,reward:180000,science:260},
 {id:'materials',name:'Новая городская ткань',description:'Произведи 500 единиц стройматериалов',kind:'buildingMaterials',target:500,reward:240000,science:400},
 {id:'districts',name:'Городской архитектор',description:'Построй 5 жилых кварталов',kind:'buildingCount',building:'residential',target:5,reward:500000,science:700}
];
export const PROJECT = {name:'Орбитальная сеть',cost:500000,seconds:600,materials:{satellites:30,robots:200,alloy:1000},tech:'frontier'};
export const MARKET_EVENTS = [
 {name:'Стабильный рынок',text:'Спрос распределён равномерно.',boost:{}},
 {name:'Строительный бум',text:'Регион скупает металл, древесину и оборудование.',boost:{steel:1.25,timber:1.3,machinery:1.2}},
 {name:'Энергетический пик',text:'Повышенный спрос на энергию, уголь и нефть.',boost:{energy:1.3,coal:1.25,oil:1.2}},
 {name:'Экспортный сезон',text:'Продукты и полимеры пользуются особым спросом.',boost:{food:1.35,grain:1.2,plastic:1.25}},
 {name:'Технологическая выставка',text:'Покупатели ищут микросхемы, роботов и спутники.',boost:{chips:1.25,robots:1.3,satellites:1.2}},
 {name:'Городская застройка',text:'Регион ускоряет жилое строительство и закупает материалы.',boost:{stone:1.2,cement:1.3,glass:1.25,buildingMaterials:1.35}}
];
