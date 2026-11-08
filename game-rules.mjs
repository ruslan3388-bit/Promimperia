const CONTRACT_TEMPLATES = [
  {
    key: 'ore-route',
    title: 'Северный рудный маршрут',
    description: 'Отправить сырьё на металлургический узел',
    resource: 'ore',
    icon: '🪨',
    baseAmount: 36,
    amountStep: 12,
    baseReward: 560,
    rewardStep: 180,
  },
  {
    key: 'steel-order',
    title: 'Заказ машиностроителей',
    description: 'Закрыть поставку конструкционной стали',
    resource: 'steel',
    icon: '🔩',
    baseAmount: 10,
    amountStep: 4,
    baseReward: 900,
    rewardStep: 300,
  },
  {
    key: 'chip-export',
    title: 'Экспорт микросхем',
    description: 'Подготовить партию для экспортного терминала',
    resource: 'chips',
    icon: '💠',
    baseAmount: 3,
    amountStep: 1,
    baseReward: 1800,
    rewardStep: 550,
  },
];

function makeContract(template, stage) {
  return {
    id: `${template.key}-${stage}`,
    key: template.key,
    title: template.title,
    description: template.description,
    resource: template.resource,
    icon: template.icon,
    amount: template.baseAmount + template.amountStep * stage,
    reward: template.baseReward + template.rewardStep * stage,
    stage,
  };
}

export function createContracts(stage = 0) {
  return CONTRACT_TEMPLATES.map(template => makeContract(template, stage));
}

export function getContractProgress(contract, stock = {}) {
  if (!contract?.amount) return 0;
  return Math.min(1, Math.max(0, Number(stock[contract.resource] || 0) / contract.amount));
}

export function fulfillContract(player, contractId) {
  const index = player.contracts?.findIndex(contract => contract.id === contractId) ?? -1;
  if (index < 0) return { ok: false, message: 'Заказ больше недоступен' };

  const contract = player.contracts[index];
  if ((player.stock[contract.resource] || 0) < contract.amount) {
    return { ok: false, message: 'Недостаточно ресурса для сдачи заказа' };
  }

  player.stock[contract.resource] -= contract.amount;
  player.money += contract.reward;
  const nextStage = contract.stage + 1;
  const template = CONTRACT_TEMPLATES.find(item => item.key === contract.key);
  player.contracts[index] = makeContract(template, nextStage);

  return { ok: true, contract, next: player.contracts[index] };
}
