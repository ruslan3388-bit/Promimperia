const $ = (selector) => document.querySelector(selector);
const RESOURCE_ORDER = ['ore', 'steel', 'energy', 'chips'];
const STORAGE = { ore: 'ore', steel: 'steel', energy: 'energy', chips: 'chips' };
const moneyFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const countFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const tg = window.Telegram?.WebApp;
let socket;
let selfId = '';
let own = null;
let world = { players: [], events: [], online: 0 };
let catalog = {};
let prices = {};
let reconnectTimer;
let toastTimer;

if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor?.('#101513');
  tg.setBackgroundColor?.('#101513');
  tg.enableClosingConfirmation?.();
}

function getDevId() {
  let value = localStorage.getItem('industrial-frontier-id');
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem('industrial-frontier-id', value);
  }
  return value;
}
function getName() {
  const user = tg?.initDataUnsafe?.user;
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Инженер';
}
function connect() {
  clearTimeout(reconnectTimer);
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${location.host}`);
  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ type: 'auth', initData: tg?.initData || '', devId: getDevId(), name: getName() }));
  });
  socket.addEventListener('message', event => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === 'hello') {
      world = data.world || world;
      if (data.telegramAuthRequired && !tg?.initData) showToast('Открой игру через Telegram', true);
      if (own) updateWorld(data.self);
    } else if (data.type === 'ready') {
      own = data.self;
      selfId = own.id;
      world = data.world || world;
      catalog = data.buildings || {};
      prices = data.prices || {};
      document.body.classList.remove('offline');
      $('#connection-label').textContent = `Компания «${own.name}» подключена к региону`;
      $('#footer-status').textContent = 'СИНХРОНИЗИРОВАНО';
      $('#player-avatar').textContent = [...own.name][0]?.toUpperCase() || 'И';
      render();
    } else if (data.type === 'world') {
      world = data.world || world;
      updateWorld(data.self);
    } else if (data.type === 'notice') showToast(data.message);
    else if (data.type === 'error') showToast(data.message, true);
  });
  socket.addEventListener('close', event => {
    document.body.classList.add('offline');
    $('#connection-label').textContent = event.code === 1008 ? 'Не удалось подтвердить Telegram-профиль' : 'Связь с регионом потеряна · переподключение…';
    $('#footer-status').textContent = 'НЕТ СВЯЗИ';
    reconnectTimer = setTimeout(connect, event.code === 1008 ? 7000 : 1800);
  });
  socket.addEventListener('error', () => socket.close());
}
function send(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return showToast('Нет связи с сервером', true);
  socket.send(JSON.stringify(payload));
}
function safeText(value) {
  const span = document.createElement('span');
  span.textContent = String(value ?? '');
  return span.innerHTML;
}
function number(value) { return countFormat.format(Math.floor(value || 0)); }
function updateWorld(privateState = null) {
  if (!own) return;
  if (privateState?.id === selfId) own = privateState;
  else {
    const latest = world.players?.find(player => player.id === selfId);
    if (latest) own = { ...own, ...latest };
  }
  render();
}
function nominalRates() {
  const result = { ore: 0, steel: 0, energy: 0, chips: 0 };
  if (!own) return result;
  for (const [key, count] of Object.entries(own.buildings)) {
    for (const [resource, rate] of Object.entries(catalog[key]?.rate || {})) result[resource] += rate * count;
  }
  return result;
}
function productionScale(result = nominalRates()) {
  return Math.min(1,
    result.energy < 0 ? own.stock.energy / -result.energy : 1,
    result.ore < 0 ? own.stock.ore / -result.ore : 1,
    result.steel < 0 ? own.stock.steel / -result.steel : 1);
}
function rates() {
  const result = nominalRates();
  const scale = productionScale(result);
  for (const key of RESOURCE_ORDER) result[key] *= scale;
  return result;
}
function formatDuration(seconds) {
  if (seconds < 60) return `${Math.max(1, Math.floor(seconds))} сек`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} мин`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes ? `${hours} ч ${minutes} мин` : `${hours} ч`;
}
function renderSupplyAdvisor() {
  const panel = $('#supply-advisor');
  const title = $('#supply-title');
  const message = $('#supply-message');
  const icon = $('#supply-icon');
  const demand = nominalRates();
  const constraints = RESOURCE_ORDER
    .filter(key => demand[key] < -0.001)
    .map(key => ({ key, seconds: Math.max(0, own.stock[key] || 0) / -demand[key] }))
    .sort((a, b) => a.seconds - b.seconds);
  const blocked = productionScale(demand) < 0.999;
  panel.classList.toggle('warning', !blocked && constraints[0]?.seconds <= 8 * 60);
  panel.classList.toggle('critical', blocked);

  if (blocked && constraints.length) {
    const key = constraints[0].key;
    title.textContent = `Дефицит: ${prices[key]?.label?.toLowerCase() || key}`;
    message.textContent = `Часть производств ограничена. Увеличь запас: ${key === 'energy' ? 'построй электростанцию' : key === 'ore' ? 'добавь рудник' : 'расширь плавильню'}.`;
    icon.textContent = '⛔';
  } else if (constraints.length) {
    const { key, seconds } = constraints[0];
    const label = prices[key]?.label?.toLowerCase() || key;
    title.textContent = seconds <= 8 * 60 ? `Скоро закончится ${label}` : 'Цепочка поставок';
    message.textContent = `${label[0].toUpperCase()}${label.slice(1)} хватит примерно на ${formatDuration(seconds)}. ${key === 'energy' ? 'Подумай о новой электростанции.' : key === 'ore' ? 'Подумай о новом руднике.' : 'Подумай о расширении плавильни.'}`;
    icon.textContent = seconds <= 8 * 60 ? '⚠' : '↗';
  } else {
    title.textContent = 'Все цепочки обеспечены';
    message.textContent = 'Запасов хватает для текущих мощностей. Производство идёт без дефицита.';
    icon.textContent = '↗';
  }
}
function render() {
  if (!own) return;
  const production = rates();
  $('#money').textContent = `${number(own.money)} ₽`;
  $('#ore').textContent = number(own.stock.ore);
  $('#steel').textContent = number(own.stock.steel);
  $('#energy').textContent = number(own.stock.energy);
  $('#chips').textContent = number(own.stock.chips);
  $('#ore-rate').textContent = `${production.ore >= 0 ? '+' : ''}${production.ore.toFixed(1)} / сек`;
  $('#steel-rate').textContent = `${production.steel >= 0 ? '+' : ''}${production.steel.toFixed(1)} / сек`;
  $('#energy-rate').textContent = `${production.energy >= 0 ? '+' : ''}${production.energy.toFixed(1)} / сек`;
  $('#chips-rate').textContent = `${production.chips >= 0 ? '+' : ''}${production.chips.toFixed(1)} / сек`;
  const potential = RESOURCE_ORDER.reduce((sum, key) => sum + Math.max(0, production[key]) * (prices[key]?.price || 0), 0);
  $('#income-rate').textContent = `${potential.toFixed(1)} ₽`;
  for (const key of RESOURCE_ORDER) $(`#${key}-meter`).style.width = `${Math.min(100, (own.stock[key] / 120) * 100)}%`;
  const totalBuildings = Object.values(own.buildings).reduce((sum, amount) => sum + amount, 0);
  $('#factory-count').textContent = `${totalBuildings} ${plural(totalBuildings, 'объект', 'объекта', 'объектов')}`;
  renderSupplyAdvisor();
  renderBuildings();
  renderMarket();
  renderContracts();
  renderLeaderboard();
  renderActivity();
  $('#online-count').textContent = `${world.online || 0} ${plural(world.online || 0, 'игрок', 'игрока', 'игроков')} в сети`;
}
function plural(value, one, few, many) {
  const n = Math.abs(value) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}
function renderBuildings() {
  const root = $('#buildings');
  root.replaceChildren();
  const descriptions = {
    mine: 'Добывает руду для металлургии', power: 'Обеспечивает заводы энергией',
    smelter: 'Переплавляет руду в сталь', lab: 'Собирает высокотехнологичные чипы',
  };
  const costOfUpgrade = (base, count) => Math.floor(base * (0.68 + 0.38 * count));
  for (const [key, data] of Object.entries(catalog)) {
    const count = own.buildings[key] || 0;
    const buildCost = data.cost;
    const upgradeCost = costOfUpgrade(data.cost, count);
    const rateText = Object.entries(data.rate).map(([resource, amount]) => `${amount > 0 ? '+' : ''}${amount} ${prices[resource]?.label?.toLowerCase() || resource}/с`).join(' · ');
    const card = document.createElement('article');
    card.className = 'building-card';
    card.innerHTML = `<div class="building-icon">${safeText(data.icon)}</div><div class="building-info"><div class="building-name">${safeText(data.name)} <span class="level-pill">УР. ${count}</span></div><div class="building-desc">${safeText(descriptions[key])} · ${safeText(rateText)}</div></div><div class="building-actions"><button class="action-btn build-btn" data-key="${safeText(key)}" data-action="build" ${own.money < buildCost ? 'disabled' : ''}>＋ ${moneyFormat.format(buildCost)} ₽</button><button class="action-btn upgrade-btn" data-key="${safeText(key)}" data-action="upgrade" ${!count || own.money < upgradeCost ? 'disabled' : ''}>↑ ${moneyFormat.format(upgradeCost)} ₽</button></div>`;
    root.append(card);
  }
}
function renderMarket() {
  const root = $('#market-list');
  root.replaceChildren();
  const estimatedValue = RESOURCE_ORDER.reduce((sum, key) => sum + Math.floor(own.stock[key] || 0) * (prices[key]?.price || 0), 0);
  $('#market-value').textContent = `ОЦЕНКА СКЛАДА: ${moneyFormat.format(estimatedValue)} ₽`;
  for (const key of RESOURCE_ORDER) {
    const info = prices[key];
    const amount = own.stock[key] || 0;
    const row = document.createElement('div');
    row.className = 'market-row';
    row.innerHTML = `<span class="market-resource"><span class="market-icon-small">${safeText(info?.icon || '')}</span>${safeText(info?.label || key)}</span><span class="market-price">${moneyFormat.format(info?.price || 0)} ₽</span><button class="market-sell" data-key="${key}" ${amount < 1 ? 'disabled' : ''}>ПРОДАТЬ ${amount > 0 ? number(amount) : ''} ↗</button>`;
    root.append(row);
  }
}
function renderContracts() {
  const root = $('#contracts-list');
  const contracts = own.contracts || [];
  $('#contract-summary').textContent = `${contracts.length} ${plural(contracts.length, 'активный заказ', 'активных заказа', 'активных заказов')}`;
  root.replaceChildren();
  for (const contract of contracts) {
    const info = prices[contract.resource] || {};
    const stock = own.stock[contract.resource] || 0;
    const progress = Math.min(1, stock / contract.amount);
    const ready = progress >= 1;
    const card = document.createElement('article');
    card.className = `contract-card${ready ? ' ready' : ''}`;
    card.innerHTML = `<div class="contract-icon">${safeText(contract.icon)}</div><div class="contract-body"><div class="contract-title-row"><strong>${safeText(contract.title)}</strong><span class="contract-reward">+${moneyFormat.format(contract.reward)} ₽</span></div><div class="contract-description">${safeText(contract.description)}</div><div class="contract-progress-row"><span>${safeText(info.label || contract.resource)}: <b>${number(stock)} / ${number(contract.amount)}</b></span><span>${Math.round(progress * 100)}%</span></div><div class="contract-meter"><i style="width:${progress * 100}%"></i></div></div><button class="contract-submit" data-contract-id="${safeText(contract.id)}" ${ready ? '' : 'disabled'}>${ready ? 'СДАТЬ ↗' : 'В РАБОТЕ'}</button>`;
    root.append(card);
  }
}

function renderLeaderboard() {
  const root = $('#leaderboard');
  root.replaceChildren();
  const ranking = [...(world.players || [])].sort((a, b) => b.netWorth - a.netWorth);
  $('#leader-count').textContent = String(ranking.length).padStart(2, '0');
  const top = ranking.slice(0, 5);
  if (!top.length) { root.innerHTML = '<div class="empty-leader">Пока никто не вошёл в отрасль.</div>'; return; }
  for (const [index, player] of top.entries()) {
    const row = document.createElement('div');
    row.className = 'leader-row';
    row.innerHTML = `<span class="rank ${index === 0 ? 'first' : ''}">${String(index + 1).padStart(2, '0')}</span><span class="leader-name"><span>${safeText(player.name)}</span>${player.id === selfId ? '<b class="you-tag">ВЫ</b>' : ''}</span><span class="leader-score">${moneyFormat.format(player.netWorth)} ₽</span>`;
    root.append(row);
  }
}
function renderActivity() {
  const root = $('#activity-list');
  root.replaceChildren();
  for (const event of (world.events || []).slice(0, 5)) {
    const chip = document.createElement('div');
    chip.className = 'event-chip';
    chip.innerHTML = `<span class="event-time">${new Date(event.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>${safeText(event.text)}`;
    root.append(chip);
  }
  if (!root.children.length) root.innerHTML = '<div class="event-chip">Отрасль ждёт первых инженеров…</div>';
}
function showToast(message, error = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', error);
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}
$('#buildings').addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (button && !button.disabled) send({ type: button.dataset.action, key: button.dataset.key });
});
$('#market-list').addEventListener('click', event => {
  const button = event.target.closest('button[data-key]');
  if (button && !button.disabled) send({ type: 'sell', key: button.dataset.key });
});
$('#contracts-list').addEventListener('click', event => {
  const button = event.target.closest('button[data-contract-id]');
  if (button && !button.disabled) send({ type: 'fulfill', contractId: button.dataset.contractId });
});
$('#chat-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text) return;
  send({ type: 'chat', text });
  input.value = '';
  input.focus();
});
connect();
