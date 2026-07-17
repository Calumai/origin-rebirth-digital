import { CARDS } from './state.js';

// Bot v1：規則見企劃書 §3.2
function chooseAction(state, idx, rng) {
  const p = state.players[idx];
  const others = state.players.filter(x => x.idx !== idx);

  // 回合開始（點數未動）時，素材貧乏就整回合拿素材（A11 後點數由擲骰決定，不再固定 3）
  const atTurnStart = p.actionPoints === (p.turnStartAP ?? 3);
  const total = Object.values(p.materials).reduce((a, b) => a + b, 0);
  if (atTurnStart && total < 4) return { type: 'TAKE_MATERIALS', player: idx };

  // 1. 4 種不同素材齊 → 優先買建築，讓 Bot 策略符合主勝利路線
  if (p.actionPoints >= 2) {
    const have = CARDS.materials.filter(m => (p.materials[m] || 0) >= 1);
    if (have.length >= 4 && state.buildingDeck.some(b => b.tribe === p.tribe)) return { type: 'BUY_BUILDING', player: idx, spend: have.slice(0, 4) };
  }

  // 2. 手上原料能配對 → 換工藝（工藝池還有才做）
  if (p.actionPoints >= 1 && (p.culturePlayedThisTurn || 0) < 1) {
    for (const [craftId] of Object.entries(CARDS.crafts)) {
      if (!state.craftPool.some(c => c.id === craftId)) continue;
      const need = CARDS.rawCardTypes.filter(t => t.craft === craftId).map(t => t.id);
      if (need.every(id => p.hand.some(c => c.kind === 'raw' && c.id === id)))
        return { type: 'PLAY_RAW_PAIR', player: idx, craftId };
    }
  }

  // 3. 手上有文化卡且非防禦卡 → 擲出得分/特效（防禦卡留著擋偷襲）
  if (p.actionPoints >= 1 && (p.culturePlayedThisTurn || 0) < 1) {
    const c = p.hand.find(c => c.kind === 'culture' && c.effect !== 'defend_raid');
    if (c) {
      const a = { type: 'PLAY_CULTURE', player: idx, cardId: c.id };
      if (c.effect === 'steal_2') {
        const t = others.sort((x, y) =>
          Object.values(y.materials).reduce((s, n) => s + n, 0) -
          Object.values(x.materials).reduce((s, n) => s + n, 0))[0];
        a.target = t.idx;
      }
      if (c.effect === 'gain_2_any') {
        const missing = CARDS.materials.filter(m => (p.materials[m] || 0) === 0);
        a.gain = missing.length >= 2 ? missing.slice(0, 2)
          : missing.concat(CARDS.materials).slice(0, 2);
      }
      return a;
    }
  }

  // 4. 正向玩家互動：幫助缺少素材的對手，共學則優先找尚未交流過的玩家。
  const eventId = state.currentEvent && state.currentEvent.id;
  if (p.actionPoints >= 1 && !p._sharedThisTurn) {
    const shareChance = eventId === 'mutualaid' || eventId === 'nightgather' ? 0.7 : 0.22;
    if (rng() < shareChance) {
      const material = CARDS.materials.find(m => (p.materials[m] || 0) >= 3 && others.some(t => (t.materials[m] || 0) === 0));
      const target = material && others.find(t => (t.materials[material] || 0) === 0);
      if (material && target) return { type: 'SHARE_MATERIAL', player: idx, target: target.idx, material };
    }
  }

  if (p.actionPoints >= 1 && !p._sharedLearningThisTurn && state.cultureDeck.length >= 2) {
    const learnChance = eventId === 'sharedstories' || eventId === 'nightgather' ? 0.65 : 0.14;
    if (rng() < learnChance) {
      const known = new Set((p.progress && p.progress.partners) || []);
      const target = others.find(t => !known.has(t.idx)) || others[Math.floor(rng() * others.length)];
      if (target) return { type: 'SHARED_LEARNING', player: idx, target: target.idx };
    }
  }

  // 5. 偶爾偷襲素材最多的人
  if (p.actionPoints >= 1 && rng() < 0.15) {
    const t = others.sort((x, y) =>
      Object.values(y.materials).reduce((s, n) => s + n, 0) -
      Object.values(x.materials).reduce((s, n) => s + n, 0))[0];
    if (Object.values(t.materials).some(n => n > 0))
      return { type: 'RAID', player: idx, target: t.idx };
  }

  // 6. 抽卡（原料:文化 = 2:1）
  if (p.actionPoints >= 1) {
    if (state.rawDeck.length && (rng() < 0.67 || !state.cultureDeck.length))
      return { type: 'DRAW_MATERIAL_CARD', player: idx };
    if (state.cultureDeck.length)
      return { type: 'DRAW_CULTURE_CARD', player: idx };
  }

  // 7. 沒牌可抽、又買不了建築 → 整回合拿素材（缺什麼換什麼），推進買建築
  if (atTurnStart) {
    const missing = CARDS.materials.find(m => (p.materials[m] || 0) === 0);
    if (missing) {
      const give = CARDS.tribes[p.tribe].produces.find(m => (p.materials[m] || 0) >= 2);
      if (give) return { type: 'TAKE_MATERIALS', player: idx, mode: 'exchange', give, get: missing };
    }
    return { type: 'TAKE_MATERIALS', player: idx };
  }

  return { type: 'END_TURN', player: idx };
}

// 交易/購買的 Bot 回應（線上版真人會取代這裡）
function respondTrade(state, targetIdx, offer) {
  const t = state.players[targetIdx];
  // 換到本族盛產以外、自己缺的素材就接受
  return offer.give.some(m => (t.materials[m] || 0) === 0);
}

export { chooseAction, respondTrade };
