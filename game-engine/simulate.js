import { initGame, mulberry32, CARDS } from './state.js';
import { applyAction, rollTurnDice, flipNextEvent } from './actions.js';
import { finalScores, objectiveProgress } from './scoring.js';
import { chooseAction } from './bot.js';

function validate(state) {
  for (const p of state.players) {
    for (const [m, n] of Object.entries(p.materials))
      if (n < 0 || !Number.isInteger(n)) throw new Error(`非法素材數 ${p.tribeName} ${m}=${n}`);
    if (p.actionPoints < 0) throw new Error(`負點數 ${p.tribeName}`);
    if (p.hand.some(c => c.kind === 'clothing')) throw new Error('服飾卡滯留手牌');
  }
  if (state.craftPool.length < 0) throw new Error('craftPool 異常');
}

function runGame(seed, playerCount, verbose = false) {
  const state = initGame(playerCount, seed);
  const rng = mulberry32(seed ^ 0x9e3779b9);
  let guard = 0;

  while (state.phase === 'playing') {
    if (++guard > 5000) throw new Error(`seed=${seed} 超過 5000 步未結束（疑似死循環）`);
    const p = state.players[state.currentPlayer];
    rollTurnDice(state, state.currentPlayer, rng); // A11：擲骰決定本回合行動點數

    // 一名玩家的回合：連續行動直到點數歸零
    let inner = 0;
    while (p.actionPoints > 0) {
      if (++inner > 50) throw new Error(`seed=${seed} 單回合超過 50 動作`);
      const action = chooseAction(state, p.idx, rng);
      applyAction(state, action, rng);
      validate(state);
    }

    // 結束條件觸發後，該輪最後一人動作完才結束
    if (state.endTriggeredBy && state.currentPlayer === state.players.length - 1) {
      state.phase = 'ended';
      break;
    }
    state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
    if (state.currentPlayer === 0) { state.turn++; flipNextEvent(state); } // A20：新一輪翻下一張事件

    // 補充規則（rules-spec 假設 A5）：三牌庫全空且無人可再換工藝 → 即刻結算
    if (!state.rawDeck.length && !state.cultureDeck.length && !state.buildingDeck.length && !state.endTriggeredBy) {
      const anyPair = state.players.some(pp =>
        Object.keys(CARDS.crafts).some(craftId =>
          state.craftPool.some(c => c.id === craftId) &&
          CARDS.rawCardTypes.filter(t => t.craft === craftId).map(t => t.id)
            .every(id => pp.hand.some(c => c.kind === 'raw' && c.id === id))));
      if (!anyPair) { state.endTriggeredBy = 'decks_exhausted'; state.phase = 'ended'; }
    }
  }

  const scores = finalScores(state);
  if (verbose) {
    console.log(`\n=== seed ${seed} | ${playerCount}人 | ${state.turn} 輪 | 結束原因: ${state.endTriggeredBy} | 當前事件: ${state.currentEvent && state.currentEvent.name} ===`);
    for (const s of scores) {
      const p = state.players[s.player];
      const obj = objectiveProgress(p);
      const objDef = CARDS.objectives.find(o => o.id === p.objective);
      console.log(`  ${s.tribe.padEnd(6)} 建築${s.buildings} 文化${s.culture} 工藝${s.crafts} 服飾${s.clothing} 獎勵${s.bonus} 互助${s.support} 事件${s.eventBonus} 目標[${objDef ? objDef.name : '?'} ${obj.cur}/${obj.target}${s.objectiveDone ? '✓+5' : ''}] → 總分 ${s.total}`);
    }
  }
  return { state, scores };
}

// ── 壓測 ──
const N = parseInt(process.argv[2] || '100', 10);
let ok = 0; const stats = { turns: [], winScores: [], endReasons: {} };
for (let i = 0; i < N; i++) {
  const pc = 2 + (i % 3); // 輪流測 2/3/4 人
  try {
    const { state, scores } = runGame(1000 + i, pc, i < 3);
    ok++;
    stats.turns.push(state.turn);
    stats.winScores.push(Math.max(...scores.map(s => s.total)));
    stats.endReasons[state.endTriggeredBy] = (stats.endReasons[state.endTriggeredBy] || 0) + 1;
  } catch (e) {
    console.error(`✗ game ${i}: ${e.message}`);
  }
}
const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log(`\n─── 壓測結果 ───`);
console.log(`完賽 ${ok}/${N}`);
console.log(`平均輪數 ${avg(stats.turns)}｜輪數範圍 ${Math.min(...stats.turns)}~${Math.max(...stats.turns)}`);
console.log(`平均勝者分數 ${avg(stats.winScores)}`);
console.log(`結束原因分布:`, stats.endReasons);
process.exit(ok === N ? 0 : 1);
