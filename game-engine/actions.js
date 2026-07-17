import { CARDS } from './state.js';

// ── 工具 ──────────────────────────────────────────────
function P(state, i) { return state.players[i]; }
function matTotal(p) { return Object.values(p.materials).reduce((a, b) => a + b, 0); }
function log(state, msg) { state.log.push(`[T${state.turn}] ${msg}`); }

// A20：翻開下一張公共事件卡（每輪回到第 1 位玩家時呼叫；純索引推進、不消耗 rng，故連線 lockstep 一致）
function flipNextEvent(state) {
  if (!state.eventDeck || !state.eventDeck.length) return;
  state.eventIndex = (state.eventIndex + 1) % state.eventDeck.length;
  state.currentEvent = state.eventDeck[state.eventIndex];
  state.craftRaceClaimed = false; // 工藝競賽的「搶先」旗標隨新事件重置
  log(state, `翻開事件卡「${state.currentEvent.name}」— ${state.currentEvent.desc}`);
}
function eventIs(state, id) { return state.currentEvent && state.currentEvent.id === id; }

function awardSupport(state, p, amount, reason) {
  const cap = CARDS.bonuses.supportScoreCap || 5;
  const before = p.supportScore || 0;
  p.supportScore = Math.min(cap, before + amount);
  const gained = p.supportScore - before;
  if (gained > 0) log(state, `${p.tribeName} ${reason}，互助 +${gained} 分（${p.supportScore}/${cap}）`);
  return gained;
}

function rememberPartner(p, targetIdx, isDeal) {
  p.progress = p.progress || { deals: 0, partners: [] };
  if (isDeal) p.progress.deals += 1;
  if (targetIdx != null && targetIdx !== p.idx && !p.progress.partners.includes(targetIdx)) p.progress.partners.push(targetIdx);
}

// A20：記錄一次「與其他玩家互動成功」→ 更新秘密目標進度，並觸發「夜間集會」事件
// isDeal=true 代表交易或玩家購卡（部落商人目標計數）
function recordInteraction(state, p, targetIdx, isDeal, mutual = false) {
  rememberPartner(p, targetIdx, isDeal);
  if (mutual) rememberPartner(P(state, targetIdx), p.idx, isDeal);
  if (eventIs(state, 'nightgather') && !p._interacted) {
    p._interacted = true;
    const c = drawCulture(state, p);
    if (c) log(state, `${p.tribeName} 夜間集會：互動成功，抽 1 張文化卡`);
  }
}

function rewardMarketInteraction(state, p, t) {
  if (!eventIs(state, 'marketday')) return;
  for (const participant of [p, t]) {
    if (participant._marketRewardRound === state.turn) continue;
    participant._marketRewardRound = state.turn;
    awardSupport(state, participant, 1, '交流市集');
  }
}

function rpsDuel(rng) { // true = 攻方勝（平手重猜）— 供 Bot / 模擬對局使用
  for (;;) {
    const a = Math.floor(rng() * 3), b = Math.floor(rng() * 3);
    if (a !== b) return (a - b + 3) % 3 === 1;
  }
}

// 真人猜拳：0=石頭 1=布 2=剪刀。回傳 true=A勝、false=B勝、null=平手（UI 需重猜）
// rules-spec A9：hot-seat 版猜拳由雙方真實輸入決定，Bot/模擬對局仍用 rpsDuel(rng)
function resolveRPSMoves(moveA, moveB) {
  if (moveA === moveB) return null;
  return (moveA - moveB + 3) % 3 === 1;
}

// action.result（boolean，true=攻方/發起方勝）由 UI 用 resolveRPSMoves 算好後傳入；
// 未提供時（Bot/模擬對局）沿用 rpsDuel(rng) 隨機判定
function resolveDuel(state, a, rng) {
  return a.result !== undefined ? a.result : rpsDuel(rng);
}

// rules-spec A11：回合開始擲骰決定行動點數（1~2→2點、3~4→3點、5~6→4點，期望值 3 與原規則相同）
// 回傳 { die, ap }；die 可由呼叫端預先擲好傳入（UI 動畫用），未傳則用 rng
function rollTurnDice(state, playerIdx, rng, die) {
  const d = die !== undefined ? die : Math.floor(rng() * 6) + 1;
  // A19：上限由 4 砍到 3，避免骰高點一回合做太多事（1-2 點→2、3-6 點→3；期望值 2.67）
  const ap = d <= 2 && !eventIs(state, 'clearweather') ? 2 : 3;
  const p = state.players[playerIdx];
  p.actionPoints = ap;
  p.turnStartAP = ap;
  p._tookMat = false;
  p._interacted = false;
  p._sharedThisTurn = false;
  p._sharedLearningThisTurn = false;
  p._materialLabUsed = false;
  p._rainWatchUsed = false;
  p._craftMentorUsed = false;
  p._communityRepairUsed = false;
  state.log.push(`[T${state.turn}] ${p.tribeName} 擲骰 ${d} 點 → 本回合 ${ap} 行動點`);
  return { die: d, ap };
}

function stealRandomMaterial(from, to, rng) {
  const pool = [];
  for (const [m, n] of Object.entries(from.materials)) for (let i = 0; i < n; i++) pool.push(m);
  if (!pool.length) return null;
  const m = pool[Math.floor(rng() * pool.length)];
  from.materials[m]--; to.materials[m] = (to.materials[m] || 0) + 1;
  return m;
}

function drawRaw(state, p) {
  const c = state.rawDeck.pop();
  if (c) p.hand.push(c);
  return c;
}
function drawCulture(state, p) {
  const c = state.cultureDeck.pop();
  if (c) p.hand.push(c);
  return c;
}
function drawBuilding(state, p) {
  // A19：每族專屬——蓋家屋只抽「自己這族」的家屋，確保每個玩家都湊得滿本族 4 棟，
  // 不會被別人抽走、也不會抽到別族的（對自己不算分）。回傳 null 代表本族 4 棟已抽完（即已蓋滿＝已獲勝）。
  const i = state.buildingDeck.findIndex(b => b.tribe === p.tribe);
  if (i < 0) return null;
  const c = state.buildingDeck.splice(i, 1)[0];
  p.buildings.push(c);
  checkBuildingSetWin(state, p);
  return c;
}
function checkBuildingSetWin(state, p) {
  const own = p.buildings.filter(b => b.tribe === p.tribe).length;
  if (own >= CARDS.buildingsPerTribe && !state.endTriggeredBy) {
    state.endTriggeredBy = `player_${p.idx}_building_set`; state.endTriggerTurn = state.turn;
  }
}
function requireActionPoints(p, cost) {
  if (p.actionPoints < cost) throw new Error('點數不足');
}
function takeCraft(state, p, craftId) {
  const i = state.craftPool.findIndex(c => c.id === craftId);
  if (i < 0) return null;
  const c = state.craftPool.splice(i, 1)[0];
  p.played.push(c);
  return c;
}

// 防禦偷襲：被偷方手上若有 defend_raid 文化卡，自動擲出擋下（假設，見 rules-spec）
function tryDefend(state, defender) {
  const i = defender.hand.findIndex(c => c.kind === 'culture' && c.effect === 'defend_raid');
  if (i < 0) return false;
  const card = defender.hand.splice(i, 1)[0];
  defender.played.push(card);
  log(state, `${defender.tribeName} 擲出「${card.name}」防禦偷襲`);
  return true;
}

// ── 動作定義 ──────────────────────────────────────────
// applyAction(state, action, rng)
// action = { type, player, ...params }；互動回應由呼叫端（bot/伺服器）帶入
const ACTIONS = {

  // 整回合：拿盛產素材 3 枚，或 2 枚相同盛產素材換 1 任意
  TAKE_MATERIALS(state, a) {
    const p = P(state, a.player);
    if (a.mode === 'exchange') {
      const { give, get } = a; // give: 盛產素材名, get: 任意素材名
      if (!CARDS.tribes[p.tribe].produces.includes(give)) throw new Error('give 必須是盛產素材');
      if ((p.materials[give] || 0) < 2) throw new Error('素材不足 2 枚');
      p.materials[give] -= 2; p.materials[get] = (p.materials[get] || 0) + 1;
      log(state, `${p.tribeName} 以 2${give} 換 1${get}`);
    } else {
      for (const m of CARDS.tribes[p.tribe].produces) p.materials[m] += 1;
      log(state, `${p.tribeName} 收取盛產素材各 1`);
    }
    // 事件「豐收季」：本回合第一次拿素材額外 +1 本族盛產
    if (eventIs(state, 'harvest') && !p._tookMat) {
      p._tookMat = true;
      const m = CARDS.tribes[p.tribe].produces[0];
      p.materials[m] = (p.materials[m] || 0) + 1;
      log(state, `${p.tribeName} 豐收季：額外獲得 1 ${m}`);
    }
    p.actionPoints = 0; // 整回合結束
  },

  // 1 點：偷襲（猜拳）
  RAID(state, a, rng) {
    const p = P(state, a.player), t = P(state, a.target);
    if (a.player === a.target) throw new Error('不能偷自己');
    requireActionPoints(p, 1);
    p.actionPoints -= 1;
    if (tryDefend(state, t)) { log(state, `${p.tribeName} 偷襲 ${t.tribeName} 被防禦`); return; }
    if (resolveDuel(state, a, rng)) {
      const m = stealRandomMaterial(t, p, rng);
      log(state, `${p.tribeName} 偷襲 ${t.tribeName} 猜拳勝，奪得 ${m ?? '（無素材可奪）'}`);
      recordInteraction(state, p, a.target, false);
    } else log(state, `${p.tribeName} 偷襲 ${t.tribeName} 猜拳敗`);
  },

  // 1 點：交易素材（最多各 2 枚，對方可拒）
  // rules-spec A13：對方拒絕後發起方可猜拳搶，猜拳勝則 a.forced=true 強制成交。
  // accepted / forced / failedChallenge 皆由呼叫端（UI）帶入。
  TRADE(state, a) {
    const p = P(state, a.player), t = P(state, a.target);
    if (eventIs(state, 'roadblock')) throw new Error('山路封閉：本回合不能交易'); // UI 已停用交易鈕，此為保險
    if (!a.accepted && !a.forced) {
      requireActionPoints(p, 1);
      p.actionPoints -= 1;
      log(state, a.failedChallenge ? `${p.tribeName} 猜拳搶交易失敗` : `${t.tribeName} 拒絕交易`);
      return;
    }
    if (a.give.length > 2 || a.get.length > 2) throw new Error('交易上限各 2 枚');
    const count = arr => arr.reduce((o, m) => (o[m] = (o[m] || 0) + 1, o), {});
    const gc = count(a.give), tc = count(a.get);
    for (const [m, n] of Object.entries(gc)) if ((p.materials[m] || 0) < n) throw new Error(`交易素材不足: ${m}`);
    for (const [m, n] of Object.entries(tc)) if ((t.materials[m] || 0) < n) throw new Error(`對方交易素材不足: ${m}`);
    requireActionPoints(p, 1);
    p.actionPoints -= 1;
    for (const m of a.give) { p.materials[m]--; t.materials[m] = (t.materials[m] || 0) + 1; }
    for (const m of a.get)  { t.materials[m]--; p.materials[m] = (p.materials[m] || 0) + 1; }
    log(state, a.forced ? `${p.tribeName} 猜拳勝，強制與 ${t.tribeName} 成交` : `${p.tribeName} ⇄ ${t.tribeName} 交易成立`);
    recordInteraction(state, p, a.target, true, true);
    rewardMarketInteraction(state, p, t);
  },

  // 1 點：抽原料卡
  DRAW_MATERIAL_CARD(state, a) {
    const p = P(state, a.player);
    const freeStudy = eventIs(state, 'materiallab') && !p._materialLabUsed;
    const cost = freeStudy ? 0 : 1;
    requireActionPoints(p, Math.max(1, cost));
    p.actionPoints -= cost;
    if (freeStudy) {
      p._materialLabUsed = true;
      log(state, `${p.tribeName} 材料試驗：本次抽牌不花行動點`);
    }
    const c = drawRaw(state, p);
    log(state, `${p.tribeName} 抽原料卡${c ? '' : '（牌庫已空）'}`);
    if (eventIs(state, 'rainwatch') && !p._rainWatchUsed) {
      p._rainWatchUsed = true;
      const least = CARDS.materials.slice().sort((x, y) => (p.materials[x] || 0) - (p.materials[y] || 0))[0];
      if (least) {
        p.materials[least] = (p.materials[least] || 0) + 1;
        log(state, `${p.tribeName} 雨勢觀察：額外獲得 1 ${least}`);
      }
    }
  },

  // 1 點：抽文化卡
  DRAW_CULTURE_CARD(state, a) {
    const p = P(state, a.player);
    requireActionPoints(p, 1);
    p.actionPoints -= 1;
    const c = drawCulture(state, p);
    log(state, `${p.tribeName} 抽文化卡${c ? '' : '（牌庫已空）'}`);
  },

  // 1 點：擲出配對原料卡 → 換工藝卡
  PLAY_RAW_PAIR(state, a) {
    const p = P(state, a.player);
    const craftId = a.craftId;
    if (!CARDS.crafts[craftId]) throw new Error('未知工藝');
    if (!state.craftPool.some(c => c.id === craftId)) throw new Error('工藝池已無此卡');
    const need = CARDS.rawCardTypes.filter(t => t.craft === craftId).map(t => t.id);
    const idxs = need.map(id => p.hand.findIndex(c => c.kind === 'raw' && c.id === id));
    if (idxs.some(i => i < 0)) throw new Error('原料未配對');
    requireActionPoints(p, 1);
    p.actionPoints -= 1;
    idxs.sort((x, y) => y - x).forEach(i => p.hand.splice(i, 1));
    const c = takeCraft(state, p, craftId);
    log(state, `${p.tribeName} 配對原料換得工藝「${c ? c.name : '（池已空）'}」`);
    // 事件「工藝競賽」：本回合第一位完成工藝者 +2 分
    if (c && eventIs(state, 'craftrace') && !state.craftRaceClaimed) {
      state.craftRaceClaimed = true;
      p.bonusScore = (p.bonusScore || 0) + 2;
      log(state, `${p.tribeName} 工藝競賽：搶先完成工藝，+2 分`);
    }
    if (c && eventIs(state, 'craftmentor') && !p._craftMentorUsed) {
      p._craftMentorUsed = true;
      const culture = drawCulture(state, p);
      if (culture) log(state, `${p.tribeName} 工藝共學：再抽 1 張文化卡`);
    }
  },

  // 1 點：擲出文化卡（觸發特效）
  PLAY_CULTURE(state, a, rng) {
    const p = P(state, a.player);
    if ((p.culturePlayedThisTurn || 0) >= 1) throw new Error('每回合最多打出 1 張文化卡');
    const i = p.hand.findIndex(c => c.kind === 'culture' && c.id === a.cardId);
    if (i < 0) throw new Error('手上無此文化卡');
    requireActionPoints(p, 1);
    p.actionPoints -= 1;
    p.culturePlayedThisTurn = (p.culturePlayedThisTurn || 0) + 1;
    const card = p.hand.splice(i, 1)[0];
    p.played.push(card);
    log(state, `${p.tribeName} 擲出「${card.name}」`);
    // 事件「文化祭典」：每打出一張文化卡額外 +1 分
    if (eventIs(state, 'festival')) {
      p.bonusScore = (p.bonusScore || 0) + 1;
      log(state, `${p.tribeName} 文化祭典：打出文化卡 +1 分`);
    }
    switch (card.effect) {
      case 'extra_action': p.actionPoints += 1; break;
      case 'draw_building': drawBuilding(state, p); break;
      case 'draw_craft': {
        const c = state.craftPool[Math.floor(rng() * state.craftPool.length)];
        if (c) takeCraft(state, p, c.id);
        break;
      }
      case 'steal_2': {
        const t = P(state, a.target ?? (a.player + 1) % state.players.length);
        if (!tryDefend(state, t)) { stealRandomMaterial(t, p, rng); stealRandomMaterial(t, p, rng); }
        break;
      }
      case 'gain_2_any': {
        const picks = a.gain || [CARDS.materials[0], CARDS.materials[1]];
        for (const m of picks.slice(0, 2)) p.materials[m] = (p.materials[m] || 0) + 1;
        break;
      }
      case 'defend_raid': break; // 主動擲出僅得分
    }
  },

  // 2 點：4 種不同素材換抽建築卡
  BUY_BUILDING(state, a) {
    const p = P(state, a.player);
    const cost = eventIs(state, 'reinforce') ? 1 : 2; // 事件「家屋加固」：蓋家屋行動點 -1（最低 1）
    requireActionPoints(p, cost);
    const four = a.spend; // 4 個不同素材名
    if (new Set(four).size !== 4) throw new Error('需 4 種不同素材');
    for (const m of four) if ((p.materials[m] || 0) < 1) throw new Error(`素材不足: ${m}`);
    p.actionPoints -= cost;
    for (const m of four) p.materials[m]--;
    const c = drawBuilding(state, p);
    log(state, `${p.tribeName} 換抽建築卡「${c ? c.name : '（庫空）'}」`);
    if (c && eventIs(state, 'communityrepair') && !p._communityRepairUsed) {
      p._communityRepairUsed = true;
      p.bonusScore = (p.bonusScore || 0) + 1;
      log(state, `${p.tribeName} 聚落修繕：完成家屋 +1 分`);
    }
  },

  // 2 點：用 2 素材向玩家購買原料卡或服飾卡（對方強制指定素材）
  BUY_FROM_PLAYER(state, a) {
    const p = P(state, a.player), t = P(state, a.target);
    const ci = t.hand.findIndex(c => (c.kind === 'raw' || c.kind === 'clothing') && (a.cardId ? c.id === a.cardId : true));
    if (ci < 0) throw new Error(`${t.tribeName} 無可購卡片`);
    const pay = a.pay; // 對方指定 2 素材
    if (!Array.isArray(pay) || pay.length !== 2) throw new Error('需支付 2 枚素材');
    for (const m of pay) if ((p.materials[m] || 0) < 1) throw new Error(`購買素材不足: ${m}`);
    const cost = eventIs(state, 'marketday') ? 1 : 2;
    requireActionPoints(p, cost);
    p.actionPoints -= cost;
    for (const m of pay) { p.materials[m]--; t.materials[m] = (t.materials[m] || 0) + 1; }
    const card = t.hand.splice(ci, 1)[0];
    if (card.kind === 'clothing') p.clothing.push(card); else p.hand.push(card);
    log(state, `${p.tribeName} 向 ${t.tribeName} 購得「${card.name}」`);
    recordInteraction(state, p, a.target, true, true);
    rewardMarketInteraction(state, p, t);
  },

  // 2 點：建築卡互換（猜拳）
  SWAP_BUILDING(state, a, rng) {
    const p = P(state, a.player), t = P(state, a.target);
    if (!t.buildings.length) throw new Error(`${t.tribeName} 無建築卡`);
    requireActionPoints(p, 2);
    p.actionPoints -= 2;
    if (resolveDuel(state, a, rng)) {
      const want = t.buildings.findIndex(b => b.tribe === p.tribe);
      const bi = want >= 0 ? want : 0;
      const b = t.buildings.splice(bi, 1)[0];
      p.buildings.push(b);
      checkBuildingSetWin(state, p);
      log(state, `${p.tribeName} 猜拳勝，取得「${b.name}」`);
      recordInteraction(state, p, a.target, false);
    } else log(state, `${p.tribeName} 建築互換猜拳敗`);
  },

  // 2 點：強制指定玩家交換原料卡
  // rules-spec A12：發起方可自選給出哪張、換得對方哪張原料卡（UI 帶 myHandIdx/theirHandIdx）；
  // 未指定時（Bot／模擬對局）沿用「各取第一張原料卡」的原路徑，不影響既有驗收結果。
  FORCE_SWAP_RAW(state, a) {
    const p = P(state, a.player), t = P(state, a.target);
    if (a.player === a.target) throw new Error('不能與自己交換');
    const mi = a.myHandIdx !== undefined ? a.myHandIdx : p.hand.findIndex(c => c.kind === 'raw');
    const ti = a.theirHandIdx !== undefined ? a.theirHandIdx : t.hand.findIndex(c => c.kind === 'raw');
    if (mi < 0 || ti < 0 || !p.hand[mi] || p.hand[mi].kind !== 'raw'
        || !t.hand[ti] || t.hand[ti].kind !== 'raw') {
      throw new Error('強制交換失敗（一方無原料卡或選擇無效）');
    }
    requireActionPoints(p, 2);
    p.actionPoints -= 2;
    const mine = p.hand.splice(mi, 1)[0], theirs = t.hand.splice(ti, 1)[0];
    p.hand.push(theirs); t.hand.push(mine);
    log(state, `${p.tribeName} 以「${mine.name}」強制換得 ${t.tribeName} 的「${theirs.name}」`);
    recordInteraction(state, p, a.target, false);
  },

  // 1 點：把一枚有餘裕的素材送給另一位玩家，發起者取得有上限的互助分。
  SHARE_MATERIAL(state, a) {
    const p = P(state, a.player), t = P(state, a.target);
    if (!t || a.player === a.target) throw new Error('請選擇其他玩家');
    if (p._sharedThisTurn) throw new Error('每回合最多互助分享 1 次');
    if (!CARDS.materials.includes(a.material)) throw new Error('未知素材');
    if ((p.materials[a.material] || 0) < 2) throw new Error('需保留 1 枚自用，持有至少 2 枚才能分享');
    requireActionPoints(p, 1);
    p.actionPoints -= 1;
    p._sharedThisTurn = true;
    p.materials[a.material] -= 1;
    t.materials[a.material] = (t.materials[a.material] || 0) + 1;
    log(state, `${p.tribeName} 分享 1 ${a.material} 給 ${t.tribeName}`);
    awardSupport(state, p, 1, '完成互助分享');
    if (eventIs(state, 'mutualaid')) awardSupport(state, p, 1, '互助工班加成');
    recordInteraction(state, p, a.target, false, true);
  },

  // 1 點：雙方各抽一張文化卡。固定抽牌順序，單機與連線 lockstep 都可重現。
  SHARED_LEARNING(state, a) {
    const p = P(state, a.player), t = P(state, a.target);
    if (!t || a.player === a.target) throw new Error('請選擇其他玩家');
    if (p._sharedLearningThisTurn) throw new Error('每回合最多共學交流 1 次');
    if (state.cultureDeck.length < 2) throw new Error('文化牌庫至少需要 2 張卡');
    requireActionPoints(p, 1);
    p.actionPoints -= 1;
    p._sharedLearningThisTurn = true;
    const mine = drawCulture(state, p);
    const theirs = drawCulture(state, t);
    log(state, `${p.tribeName} 與 ${t.tribeName} 共學交流，雙方各抽 1 張文化卡`);
    if (eventIs(state, 'sharedstories')) {
      p.actionPoints += 1;
      log(state, `${p.tribeName} 共學之夜：退回 1 行動點`);
    }
    if (mine || theirs) recordInteraction(state, p, a.target, false, true);
  },

  END_TURN(state, a) {
    const p = P(state, a.player);
    p.actionPoints = 0;
    p.culturePlayedThisTurn = 0;
  }
};

// 服飾配對檢查（同族同性別 頭+身）→ 自動計入，不需擲出
function clothingPairs(p) {
  const pairs = [];
  for (const tribe of Object.keys(CARDS.tribes))
    for (const g of CARDS.clothing.genders) {
      const head = p.clothing.find(c => c.tribe === tribe && c.gender === g && c.part === 'head');
      const body = p.clothing.find(c => c.tribe === tribe && c.gender === g && c.part === 'body');
      if (head && body) pairs.push({ tribe, gender: g });
    }
  return pairs;
}

function applyAction(state, action, rng) {
  if (state.phase !== 'playing') throw new Error('game over');
  const fn = ACTIONS[action.type];
  if (!fn) throw new Error(`unknown action ${action.type}`);
  fn(state, action, rng);
  // 抽到的服飾卡歸入 clothing 區（配對免擲出）
  for (const p of state.players) {
    for (let i = p.hand.length - 1; i >= 0; i--)
      if (p.hand[i].kind === 'clothing') p.clothing.push(p.hand.splice(i, 1)[0]);
  }
  return state;
}

export { applyAction, clothingPairs, ACTIONS, resolveRPSMoves, rollTurnDice, flipNextEvent };
