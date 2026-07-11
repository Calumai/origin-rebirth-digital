import { CARDS } from './state.js';
import { clothingPairs } from './actions.js';

// A20：秘密目標進度計算——回傳 { cur, target, done }。大多可由結束盤面推得，
// 只有「交易/購卡次數(deals)」與「互動過的玩家(partners)」需要 actions.js 執行期累計。
function objectiveProgress(p) {
  const def = CARDS.objectives.find(o => o.id === p.objective);
  const target = def ? def.target : 0;
  let cur = 0;
  switch (p.objective) {
    case 'obj_house':     cur = p.buildings.filter(b => b.tribe === p.tribe).length; break;
    case 'obj_culture':   cur = p.played.filter(c => c.kind === 'culture').length; break;
    case 'obj_craft':     cur = new Set(p.played.filter(c => c.kind === 'craft').map(c => c.id)).size; break;
    case 'obj_trade':     cur = (p.progress && p.progress.deals) || 0; break;
    case 'obj_collector': cur = CARDS.materials.filter(m => (p.materials[m] || 0) >= 3).length; break;
    case 'obj_social':    cur = (p.progress && p.progress.partners && p.progress.partners.length) || 0; break;
  }
  return { cur, target, done: target > 0 && cur >= target };
}

function scorePlayer(p) {
  const detail = {};

  // 01 建築卡：只有本族建築計分
  const ownBuildings = p.buildings.filter(b => b.tribe === p.tribe);
  detail.buildingCount = ownBuildings.length; // 本族家屋「棟數」——家屋數量決勝的主排序鍵
  detail.buildings = ownBuildings.reduce((s, b) => s + b.score, 0);

  // 03 文化卡：已擲出者計分
  detail.culture = p.played.filter(c => c.kind === 'culture')
    .reduce((s, c) => s + Math.min(1, c.score), 0);

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

  // A20：秘密目標（完成 +5）與事件加分（文化祭典 +1／張、工藝競賽 +2）
  const obj = objectiveProgress(p);
  detail.objectiveDone = obj.done;
  detail.objective = obj.done ? CARDS.objectiveBonus : 0;
  detail.eventBonus = p.bonusScore || 0;

  detail.total = detail.buildings + detail.culture + detail.crafts + detail.clothing + bonus + detail.objective + detail.eventBonus;
  return detail;
}

function finalScores(state) {
  return state.players.map(p => ({ player: p.idx, tribe: p.tribeName, ...scorePlayer(p) }));
}

export { scorePlayer, finalScores, objectiveProgress };
