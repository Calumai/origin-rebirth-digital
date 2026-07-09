import { CARDS } from './state.js';

// ── 工具 ──────────────────────────────────────────────
function P(state, i) { return state.players[i]; }
function matTotal(p) { return Object.values(p.materials).reduce((a, b) => a + b, 0); }
function log(state, msg) { state.log.push(`[T${state.turn}] ${msg}`); }

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
  const ap = d <= 2 ? 2 : d <= 4 ? 3 : 4;
  const p = state.players[playerIdx];
  p.actionPoints = ap;
  p.turnStartAP = ap;
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
  const c = state.buildingDeck.pop();
  if (c) p.buildings.push(c);
  return c;
}
function takeCraft(state, p, craftId) {
  const i = state.craftPool.findIndex(c => c.id === craftId);
  if (i < 0) return null;
  const c = state.craftPool.splice(i, 1)[0];
  p.played.push(c);
  if (state.craftPool.length === 0 && !state.endTriggeredBy) {
    state.endTriggeredBy = 'craft_pool_empty'; state.endTriggerTurn = state.turn;
  }
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
    p.actionPoints = 0; // 整回合結束
  },

  // 1 點：偷襲（猜拳）
  RAID(state, a, rng) {
    const p = P(state, a.player), t = P(state, a.target);
    if (a.player === a.target) throw new Error('不能偷自己');
    p.actionPoints -= 1;
    if (tryDefend(state, t)) { log(state, `${p.tribeName} 偷襲 ${t.tribeName} 被防禦`); return; }
    if (resolveDuel(state, a, rng)) {
      const m = stealRandomMaterial(t, p, rng);
      log(state, `${p.tribeName} 偷襲 ${t.tribeName} 猜拳勝，奪得 ${m ?? '（無素材可奪）'}`);
    } else log(state, `${p.tribeName} 偷襲 ${t.tribeName} 猜拳敗`);
  },

  // 1 點：交易素材（最多各 2 枚，對方可拒）
  // rules-spec A13：對方拒絕後發起方可猜拳搶，猜拳勝則 a.forced=true 強制成交。
  // accepted / forced / failedChallenge 皆由呼叫端（UI）帶入。
  TRADE(state, a) {
    const p = P(state, a.player), t = P(state, a.target);
    p.actionPoints -= 1;
    if (!a.accepted && !a.forced) {
      log(state, a.failedChallenge ? `${p.tribeName} 猜拳搶交易失敗` : `${t.tribeName} 拒絕交易`);
      return;
    }
    if (a.give.length > 2 || a.get.length > 2) throw new Error('交易上限各 2 枚');
    const count = arr => arr.reduce((o, m) => (o[m] = (o[m] || 0) + 1, o), {});
    const gc = count(a.give), tc = count(a.get);
    for (const [m, n] of Object.entries(gc)) if ((p.materials[m] || 0) < n) { log(state, `交易失敗：${p.tribeName} ${m} 不足`); return; }
    for (const [m, n] of Object.entries(tc)) if ((t.materials[m] || 0) < n) { log(state, `交易失敗：${t.tribeName} ${m} 不足`); return; }
    for (const m of a.give) { p.materials[m]--; t.materials[m] = (t.materials[m] || 0) + 1; }
    for (const m of a.get)  { t.materials[m]--; p.materials[m] = (p.materials[m] || 0) + 1; }
    log(state, a.forced ? `${p.tribeName} 猜拳勝，強制與 ${t.tribeName} 成交` : `${p.tribeName} ⇄ ${t.tribeName} 交易成立`);
  },

  // 1 點：抽原料卡
  DRAW_MATERIAL_CARD(state, a) {
    const p = P(state, a.player);
    p.actionPoints -= 1;
    const c = drawRaw(state, p);
    log(state, `${p.tribeName} 抽原料卡${c ? '' : '（牌庫已空）'}`);
  },

  // 1 點：抽文化卡
  DRAW_CULTURE_CARD(state, a) {
    const p = P(state, a.player);
    p.actionPoints -= 1;
    const c = drawCulture(state, p);
    log(state, `${p.tribeName} 抽文化卡${c ? '' : '（牌庫已空）'}`);
  },

  // 1 點：擲出配對原料卡 → 換工藝卡
  PLAY_RAW_PAIR(state, a) {
    const p = P(state, a.player);
    p.actionPoints -= 1;
    const craftId = a.craftId;
    const need = CARDS.rawCardTypes.filter(t => t.craft === craftId).map(t => t.id);
    const idxs = need.map(id => p.hand.findIndex(c => c.kind === 'raw' && c.id === id));
    if (idxs.some(i => i < 0)) throw new Error('原料未配對');
    idxs.sort((x, y) => y - x).forEach(i => p.hand.splice(i, 1));
    const c = takeCraft(state, p, craftId);
    log(state, `${p.tribeName} 配對原料換得工藝「${c ? c.name : '（池已空）'}」`);
  },

  // 1 點：擲出文化卡（觸發特效）
  PLAY_CULTURE(state, a, rng) {
    const p = P(state, a.player);
    p.actionPoints -= 1;
    const i = p.hand.findIndex(c => c.kind === 'culture' && c.id === a.cardId);
    if (i < 0) throw new Error('手上無此文化卡');
    const card = p.hand.splice(i, 1)[0];
    p.played.push(card);
    log(state, `${p.tribeName} 擲出「${card.name}」`);
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
    if (p.actionPoints < 2) throw new Error('點數不足');
    const four = a.spend; // 4 個不同素材名
    if (new Set(four).size !== 4) throw new Error('需 4 種不同素材');
    for (const m of four) if ((p.materials[m] || 0) < 1) throw new Error(`素材不足: ${m}`);
    p.actionPoints -= 2;
    for (const m of four) p.materials[m]--;
    const c = drawBuilding(state, p);
    log(state, `${p.tribeName} 換抽建築卡「${c ? c.name : '（庫空）'}」`);
    // 結束條件：集滿本族建築
    const own = p.buildings.filter(b => b.tribe === p.tribe).length;
    if (own >= CARDS.buildingsPerTribe && !state.endTriggeredBy) {
      state.endTriggeredBy = `player_${p.idx}_building_set`; state.endTriggerTurn = state.turn;
    }
  },

  // 2 點：用 2 素材向玩家購買原料卡或服飾卡（對方強制指定素材）
  BUY_FROM_PLAYER(state, a) {
    const p = P(state, a.player), t = P(state, a.target);
    if (p.actionPoints < 2) throw new Error('點數不足');
    p.actionPoints -= 2;
    const ci = t.hand.findIndex(c => (c.kind === 'raw' || c.kind === 'clothing') && (a.cardId ? c.id === a.cardId : true));
    if (ci < 0) { log(state, `${t.tribeName} 無可購卡片`); return; }
    const pay = a.pay; // 對方指定 2 素材
    for (const m of pay) if ((p.materials[m] || 0) < 1) { log(state, `素材不足，購買失敗`); return; }
    for (const m of pay) { p.materials[m]--; t.materials[m] = (t.materials[m] || 0) + 1; }
    const card = t.hand.splice(ci, 1)[0];
    if (card.kind === 'clothing') p.clothing.push(card); else p.hand.push(card);
    log(state, `${p.tribeName} 向 ${t.tribeName} 購得「${card.name}」`);
  },

  // 2 點：建築卡互換（猜拳）
  SWAP_BUILDING(state, a, rng) {
    const p = P(state, a.player), t = P(state, a.target);
    if (p.actionPoints < 2) throw new Error('點數不足');
    p.actionPoints -= 2;
    if (!t.buildings.length) { log(state, `${t.tribeName} 無建築卡`); return; }
    if (resolveDuel(state, a, rng)) {
      const want = t.buildings.findIndex(b => b.tribe === p.tribe);
      const bi = want >= 0 ? want : 0;
      const b = t.buildings.splice(bi, 1)[0];
      p.buildings.push(b);
      log(state, `${p.tribeName} 猜拳勝，取得「${b.name}」`);
    } else log(state, `${p.tribeName} 建築互換猜拳敗`);
  },

  // 2 點：強制指定玩家交換原料卡
  // rules-spec A12：發起方可自選給出哪張、換得對方哪張原料卡（UI 帶 myHandIdx/theirHandIdx）；
  // 未指定時（Bot／模擬對局）沿用「各取第一張原料卡」的原路徑，不影響既有驗收結果。
  FORCE_SWAP_RAW(state, a) {
    const p = P(state, a.player), t = P(state, a.target);
    if (a.player === a.target) throw new Error('不能與自己交換');
    if (p.actionPoints < 2) throw new Error('點數不足');
    p.actionPoints -= 2;
    const mi = a.myHandIdx !== undefined ? a.myHandIdx : p.hand.findIndex(c => c.kind === 'raw');
    const ti = a.theirHandIdx !== undefined ? a.theirHandIdx : t.hand.findIndex(c => c.kind === 'raw');
    if (mi < 0 || ti < 0 || !p.hand[mi] || p.hand[mi].kind !== 'raw'
        || !t.hand[ti] || t.hand[ti].kind !== 'raw') {
      log(state, `強制交換失敗（一方無原料卡或選擇無效）`); return;
    }
    const mine = p.hand.splice(mi, 1)[0], theirs = t.hand.splice(ti, 1)[0];
    p.hand.push(theirs); t.hand.push(mine);
    log(state, `${p.tribeName} 以「${mine.name}」強制換得 ${t.tribeName} 的「${theirs.name}」`);
  },

  END_TURN(state, a) { P(state, a.player).actionPoints = 0; }
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

export { applyAction, clothingPairs, ACTIONS, resolveRPSMoves, rollTurnDice };
