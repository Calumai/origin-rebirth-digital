import { CARDS } from './cards.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDecks(rng) {
  const raw = [];
  for (const t of CARDS.rawCardTypes)
    for (let i = 0; i < CARDS.rawCopiesPerType; i++)
      raw.push({ kind: 'raw', id: t.id, name: t.name, craft: t.craft, img: t.img });

  // 假設：服飾卡洗入原料牌庫（規則書未載明取得管道）
  const clothing = [];
  for (const tribe of Object.keys(CARDS.tribes))
    for (const gender of CARDS.clothing.genders)
      for (const part of Object.keys(CARDS.clothing.parts))
        clothing.push({
          kind: 'clothing', tribe, gender, part,
          score: CARDS.clothing.parts[part],
          name: `${CARDS.tribes[tribe].name}服飾-${gender === 'male' ? '男' : '女'}${part === 'head' ? '頭' : '身'}`,
          img: CARDS.clothing.images[tribe][gender][part]
        });

  const culture = CARDS.cultureCards.map(c => ({ kind: 'culture', ...c }));

  const buildings = [];
  for (const tribe of Object.keys(CARDS.tribes))
    for (let i = 1; i <= CARDS.buildingsPerTribe; i++)
      buildings.push({ kind: 'building', tribe, index: i, score: CARDS.buildingScore, name: `${CARDS.tribes[tribe].name}建築${i}`, img: CARDS.buildingImages[tribe] });

  const craftPool = [];
  for (const [id, c] of Object.entries(CARDS.crafts))
    for (let i = 0; i < CARDS.craftCopiesPerType; i++)
      craftPool.push({ kind: 'craft', id, name: c.name, tribe: c.tribe, score: c.score, img: c.img });

  return {
    rawDeck: shuffle(raw.concat(clothing), rng),
    cultureDeck: shuffle(culture, rng),
    buildingDeck: shuffle(buildings, rng),
    craftPool
  };
}

// rules-spec A14：hot-seat 版族群改玩家自選；chosenTribeIds 由 UI 帶入（設定畫面點卡選擇的結果）。
// 未帶時（Bot／simulate.js 自動對局路徑）完全沿用原本隨機抽取，既有驗收結果不受影響。
function initGame(playerCount, seed, chosenTribeIds) {
  if (playerCount < 2 || playerCount > 4) throw new Error('players must be 2-4');
  const rng = mulberry32(seed);
  const tribeIds = chosenTribeIds && chosenTribeIds.length === playerCount
    ? chosenTribeIds.slice()
    : shuffle(Object.keys(CARDS.tribes), rng).slice(0, playerCount);
  const decks = buildDecks(rng);

  const players = tribeIds.map((tribe, i) => {
    const materials = {};
    for (const m of CARDS.materials) materials[m] = 1; // 4 種各 1
    for (const m of CARDS.tribes[tribe].produces) materials[m] += 1; // 盛產再各 1 → 共 7
    return {
      idx: i, tribe, tribeName: CARDS.tribes[tribe].name,
      materials, hand: [], played: [], buildings: [], clothing: [],
      actionPoints: 0
    };
  });

  return {
    seed, rngState: null,
    players,
    ...decks,
    turn: 0, currentPlayer: 0,
    phase: 'playing',
    endTriggeredBy: null, endTriggerTurn: null,
    log: []
  };
}

export { initGame, mulberry32, shuffle, CARDS };
