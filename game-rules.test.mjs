import test from 'node:test';
import assert from 'node:assert/strict';
import { createContracts, fulfillContract, getContractProgress } from './game-rules.mjs';

test('creates a starter set of contracts with stable ids and rewards', () => {
  const contracts = createContracts();

  assert.equal(contracts.length, 3);
  assert.deepEqual(contracts.map(contract => contract.id), ['ore-route-0', 'steel-order-0', 'chip-export-0']);
  assert.ok(contracts.every(contract => contract.amount > 0 && contract.reward > 0));
});

test('reports contract progress without exceeding 100 percent', () => {
  const contract = createContracts()[0];

  assert.equal(getContractProgress(contract, { ore: 0 }), 0);
  assert.equal(getContractProgress(contract, { ore: contract.amount - 1 }), (contract.amount - 1) / contract.amount);
  assert.equal(getContractProgress(contract, { ore: contract.amount * 2 }), 1);
});

test('does not fulfill a contract when the company lacks stock', () => {
  const player = { money: 2500, stock: { ore: 0 }, contracts: createContracts() };

  const result = fulfillContract(player, player.contracts[0].id);

  assert.equal(result.ok, false);
  assert.equal(player.money, 2500);
  assert.equal(player.stock.ore, 0);
  assert.equal(result.message, 'Недостаточно ресурса для сдачи заказа');
});

test('fulfills a contract, pays the reward, consumes stock, and renews the order', () => {
  const player = { money: 2500, stock: { ore: 100 }, contracts: createContracts() };
  const first = player.contracts[0];

  const result = fulfillContract(player, first.id);

  assert.equal(result.ok, true);
  assert.equal(player.money, 2500 + first.reward);
  assert.equal(player.stock.ore, 100 - first.amount);
  assert.equal(player.contracts[0].stage, 1);
  assert.equal(player.contracts[0].id, 'ore-route-1');
  assert.ok(player.contracts[0].amount > first.amount);
  assert.ok(player.contracts[0].reward > first.reward);
});

test('rejects unknown contract ids without mutating the company', () => {
  const player = { money: 2500, stock: { ore: 100 }, contracts: createContracts() };

  const result = fulfillContract(player, 'missing-contract');

  assert.equal(result.ok, false);
  assert.equal(player.money, 2500);
  assert.equal(player.stock.ore, 100);
  assert.equal(result.message, 'Заказ больше недоступен');
});
