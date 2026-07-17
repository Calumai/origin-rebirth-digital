import assert from 'node:assert/strict';
import { initGame, mulberry32, CARDS } from './state.js';
import { applyAction, rollTurnDice } from './actions.js';
import { scorePlayer } from './scoring.js';

function game(seed = 4102) {
  return { state: initGame(2, seed, ['thao', 'kavalan']), rng: mulberry32(seed ^ 0x9e3779b9) };
}

assert.equal(CARDS.events.length, 14, '公共事件應擴充為 14 張');

{
  const { state, rng } = game();
  const p = state.players[0], t = state.players[1];
  const material = CARDS.tribes[p.tribe].produces[0];
  const beforeMine = p.materials[material], beforeTheirs = t.materials[material];
  rollTurnDice(state, 0, rng, 4);
  applyAction(state, { type: 'SHARE_MATERIAL', player: 0, target: 1, material }, rng);
  assert.equal(p.materials[material], beforeMine - 1);
  assert.equal(t.materials[material], beforeTheirs + 1);
  assert.equal(p.supportScore, 1);
  assert.ok(p.progress.partners.includes(1));
  assert.ok(t.progress.partners.includes(0));
  assert.throws(() => applyAction(state, { type: 'SHARE_MATERIAL', player: 0, target: 1, material }, rng), /每回合最多/);
}

{
  const { state, rng } = game(4103);
  state.currentEvent = CARDS.events.find(event => event.id === 'sharedstories');
  rollTurnDice(state, 0, rng, 5);
  const beforeAP = state.players[0].actionPoints;
  const beforeDeck = state.cultureDeck.length;
  applyAction(state, { type: 'SHARED_LEARNING', player: 0, target: 1 }, rng);
  assert.equal(state.players[0].actionPoints, beforeAP, '共學之夜應退回 1 行動點');
  assert.equal(state.cultureDeck.length, beforeDeck - 2);
  assert.equal(state.players[0].hand.filter(card => card.kind === 'culture').length, 1);
  assert.equal(state.players[1].hand.filter(card => card.kind === 'culture').length, 1);
}

{
  const { state, rng } = game(4104);
  state.currentEvent = CARDS.events.find(event => event.id === 'materiallab');
  rollTurnDice(state, 0, rng, 3);
  const beforeAP = state.players[0].actionPoints;
  applyAction(state, { type: 'DRAW_MATERIAL_CARD', player: 0 }, rng);
  assert.equal(state.players[0].actionPoints, beforeAP, '材料試驗首次抽原料卡應免費');
}

{
  const { state, rng } = game(4105);
  state.currentEvent = CARDS.events.find(event => event.id === 'clearweather');
  assert.equal(rollTurnDice(state, 0, rng, 1).ap, 3, '天候放晴時低點數也應有 3 行動點');
}

{
  const { state } = game(4106);
  state.players[0].supportScore = 99;
  assert.equal(scorePlayer(state.players[0]).support, CARDS.bonuses.supportScoreCap, '互助分必須套用上限');
}

console.log('事件與互助機制測試通過');
