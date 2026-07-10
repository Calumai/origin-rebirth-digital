import { CARDS } from './state.js';
import { clothingPairs } from './actions.js';

function scorePlayer(p) {
  const detail = {};

  // 01 建築卡：只有本族建築計分
  const ownBuildings = p.buildings.filter(b => b.tribe === p.tribe);
  detail.buildingCount = ownBuildings.length; // 本族家屋「棟數」——家屋數量決勝的主排序鍵
  detail.buildings = ownBuildings.reduce((s, b) => s + b.score, 0);

  // 03 文化卡：已擲出者計分
  detail.culture = p.played.filter(c => c.kind === 'culture')
    .reduce((s, c) => s + c.score, 0);

  // 04 工藝卡 5 分
  const crafts = p.played.filter(c => c.kind === 'craft');
  detail.crafts = crafts.reduce((s, c) => s + c.score, 0);

  // 05 服飾：完整一套 5 分（頭2+身3 → 成套即 5）
  const pairs = clothingPairs(p);
  detail.clothing = pairs.length * CARDS.clothing.pairScore;

  // 06 獎勵
  let bonus = 0;
  const ownBuild = p.buildings.filter(b => b.tribe === p.tribe).length;
  if (ownBuild >= CARDS.buildingsPerTribe) bonus += CARDS.bonuses.fullOwnBuildingSet;

  const craftTribes = new Set(crafts.map(c => c.tribe));
  if (craftTribes.size >= 4) bonus += CARDS.bonuses.fullCraftSet;

  const foods = new Set(p.played.filter(c => c.kind === 'culture' && c.food).map(c => c.tribe));
  if (foods.size >= 4) bonus += CARDS.bonuses.fullFoodSet;

  const ownDoll = ['male', 'female'].every(g => pairs.some(x => x.tribe === p.tribe && x.gender === g));
  if (ownDoll) bonus += CARDS.bonuses.ownTribeDollBothGenders;
  detail.bonus = bonus;

  detail.total = detail.buildings + detail.culture + detail.crafts + detail.clothing + bonus;
  return detail;
}

function finalScores(state) {
  return state.players.map(p => ({ player: p.idx, tribe: p.tribeName, ...scorePlayer(p) }));
}

export { scorePlayer, finalScores };
