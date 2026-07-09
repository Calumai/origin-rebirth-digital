import { initGame, mulberry32, CARDS } from './game-engine/state.js';
import { applyAction, resolveRPSMoves, rollTurnDice } from './game-engine/actions.js';
import { finalScores } from './game-engine/scoring.js';
import { chooseAction, respondTrade } from './game-engine/bot.js';

const EFFECT_LABEL = {
  extra_action: '本回合 +1 行動點',
  draw_building: '抽 1 張建築卡',
  draw_craft: '隨機獲得 1 張工藝卡',
  steal_2: '偷取對方 2 枚素材',
  defend_raid: '防禦偷襲（留在手上可自動擋下）',
  gain_2_any: '獲得任意 2 枚素材'
};

let G = null;
let rng = null;
let ui = {
  screen: 'home',
  setup: { count: 2, names: ['', '', '', ''], bots: [false, false, false, false] },
  nicknames: [],
  isBot: [],
  pass: null,
  draw: null,
  modal: null
};

function isBot(idx) { return !!ui.isBot[idx]; }

// ── 浮動提示（對戰動態）───────────────────────────────
// 動作後把新增的對局 log 逐條浮出，讓真人看得到對手（尤其電腦）在做什麼
function showToast(msg, kind) {
  const layer = document.getElementById('toast-layer');
  if (!layer) return;
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' toast-' + kind : '');
  el.textContent = msg;
  layer.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 350); }, 2200);
}
// 執行動作並把期間新增的 log 浮出
function flashLog(before) {
  for (let i = before; i < G.log.length; i++) {
    const line = G.log[i].replace(/^\[T\d+\]\s*/, '');
    bubbleForLog(line); // 情境對話泡泡
    showToast(line);
  }
}
// 情境對話泡泡：在對應玩家頭像上冒中文台詞（對戰列 .vs-player 順序 = G.players）
function showBubble(idx, text) {
  const layer = document.getElementById('toast-layer');
  const vp = document.querySelectorAll('.vs-player')[idx];
  if (!layer || !vp) return;
  const r = vp.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'speech-bubble';
  el.textContent = text;
  el.style.left = (r.left + r.width / 2) + 'px';
  el.style.top = (r.bottom - 4) + 'px';
  layer.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 1900);
}
function bubbleForLog(line) {
  const idxOf = name => G.players.findIndex(p => p.tribeName === name);
  let m;
  if (m = line.match(/^(.+?) 偷襲 (.+?) 猜拳勝/)) { showBubble(idxOf(m[1]), '受死吧！'); showBubble(idxOf(m[2]), '可惡…'); return; }
  if (m = line.match(/^(.+?) 偷襲 (.+?) 猜拳敗/)) { showBubble(idxOf(m[2]), '哼，想得美！'); return; }
  if (m = line.match(/^(.+?) 偷襲 (.+?) 被防禦/)) { showBubble(idxOf(m[2]), '防住了！'); return; }
  if (m = line.match(/^(.+?) ⇄ (.+?) 交易成立/)) { showBubble(idxOf(m[1]), '成交！'); showBubble(idxOf(m[2]), '好，換吧'); return; }
  if (m = line.match(/^(.+?) 拒絕交易/)) { showBubble(idxOf(m[1]), '休想！'); return; }
  if (m = line.match(/^(.+?) 猜拳勝，強制與 (.+?) 成交/)) { showBubble(idxOf(m[1]), '拿來吧！'); showBubble(idxOf(m[2]), '唔…'); return; }
  if (m = line.match(/^(.+?) 猜拳搶交易失敗/)) { showBubble(idxOf(m[1]), '可惡…'); return; }
  if (m = line.match(/^(.+?) 猜拳勝，取得/)) { showBubble(idxOf(m[1]), '這棟我要了！'); return; }
  if (m = line.match(/^(.+?) 換抽建築卡/)) { showBubble(idxOf(m[1]), '蓋好囉！'); return; }
  if (m = line.match(/^(.+?) 以「.+?」強制換得/)) { showBubble(idxOf(m[1]), '這張歸我！'); return; }
  if (m = line.match(/^(.+?) 配對原料換得工藝/)) { showBubble(idxOf(m[1]), '手藝不錯吧！'); return; }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function nickname(idx) { return esc(ui.nicknames[idx] || ''); }
function currentPlayer() { return G.players[G.currentPlayer]; }

function matIcon(m) {
  return `<img class="mat-coin" src="${CARDS.materialImages[m]}" alt="${m}">`;
}
function tribeBadge(tribeId) {
  const t = CARDS.tribes[tribeId];
  return `<span class="tribe-badge tribe-${tribeId}"><img class="tribe-icon" src="${t.img}" alt="">${t.name}</span>`;
}
function cardThumb(c, size) {
  if (!c.img) return '';
  return `<img class="card-thumb${size === 'sm' ? '-sm' : ''}" src="${c.img}" alt="${c.name}">`;
}
// 建築卡＝一族家屋圖切 4 片拼圖（index 1~4 對應 左上/右上/左下/右下）
// 以 2×2 格盤呈現：已收集的片段拼在正確位置，缺片顯示虛線空格；集滿時縫隙閉合成整張家屋。
function buildingsArea(p) {
  if (!p.buildings.length) return '<span class="muted">（無建築）</span>';
  const byTribe = {};
  for (const b of p.buildings) (byTribe[b.tribe] = byTribe[b.tribe] || []).push(b);
  const POS = ['0% 0%', '100% 0%', '0% 100%', '100% 100%'];
  return Object.entries(byTribe).map(([tribe, list]) => {
    const img = CARDS.buildingImages[tribe];
    const have = {};
    for (const b of list) have[b.index] = b;
    const complete = list.length >= CARDS.buildingsPerTribe;
    const cells = [1, 2, 3, 4].map(idx => have[idx]
      ? `<div class="bld-cell filled" style="background-image:url('${img}');background-position:${POS[idx - 1]}" title="${have[idx].name}"></div>`
      : `<div class="bld-cell empty"></div>`).join('');
    return `<div class="bld-group">
      <div class="bld-puzzle${complete ? ' complete' : ''}">${cells}</div>
      <div class="bld-label">${CARDS.tribes[tribe].name}家屋 ${list.length}/${CARDS.buildingsPerTribe}${complete ? '（完整）' : ''}</div>
    </div>`;
  }).join('');
}
function materialsRow(p) {
  return CARDS.materials.map(m => `<span class="chip mat-icon">${matIcon(m)} ${m} ×${p.materials[m] || 0}</span>`).join('');
}
function availablePairs(p) {
  return Object.entries(CARDS.crafts).filter(([craftId]) => {
    if (!G.craftPool.some(c => c.id === craftId)) return false;
    const need = CARDS.rawCardTypes.filter(t => t.craft === craftId).map(t => t.id);
    return need.every(id => p.hand.some(c => c.kind === 'raw' && c.id === id));
  }).map(([craftId, c]) => ({ craftId, name: c.name }));
}
function canBuyBuilding(p) {
  return CARDS.materials.filter(m => (p.materials[m] || 0) >= 1).length >= 4;
}
function endReasonLabel(reason) {
  if (!reason) return '（未知）';
  if (reason === 'craft_pool_empty') return '工藝池已抽光';
  if (reason === 'decks_exhausted') return '三個牌庫全空，且無人可再配對工藝';
  const m = reason.match(/^player_(\d+)_building_set$/);
  if (m) return `${G.players[+m[1]].tribeName} 集滿本族建築`;
  return reason;
}

// ── render ──────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  let html = '';
  if (ui.screen === 'home') html = renderHome();
  else if (ui.screen === 'story') html = renderStory();
  else if (ui.screen === 'setup') html = renderSetup();
  else if (ui.screen === 'draw') html = renderDraw();
  else if (ui.screen === 'pass') html = `<div class="card-box">${passInner(ui.pass.toIdx, 'revealTurn')}</div>`;
  else if (ui.screen === 'board') html = `<div class="table-surface">${renderBoard()}</div>`;
  else if (ui.screen === 'end') html = renderEnd();
  html += renderModal();
  app.innerHTML = html;
}

function passInner(toIdx, continueFn) {
  const p = G.players[toIdx];
  return `<div class="pass-screen">
    <div class="big">請將裝置交給</div>
    <img class="pass-tribe-img" src="${CARDS.tribes[p.tribe].img}" alt="${p.tribeName}">
    ${tribeBadge(p.tribe)}
    <div class="big">${nickname(toIdx)}</div>
    <div class="muted">其他人請勿偷看畫面</div>
    <button class="primary" onclick="${continueFn}()">我準備好了，開始</button>
  </div>`;
}

// ── home / story ──────────────────────────────────────────
function renderHome() {
  return `
    <section class="home-screen">
      <div class="home-frame">
        <header class="title-plaque">
          <h1>原地重生・返璞歸真</h1>
          <p>一款結合台灣原住民族文化與探索冒險的敘事遊戲。</p>
        </header>
        <div class="tribe-card-stage">
          ${Object.values(CARDS.tribes).map(t => `<div class="tribe-card"><img src="${t.img}" alt="${t.name}"></div>`).join('')}
        </div>
        <div class="home-actions">
          <button class="primary-start-button" onclick="gotoSetup()">開始遊戲</button>
          <button class="secondary-lore-button" onclick="gotoStory()">世界觀介紹</button>
        </div>
      </div>
    </section>`;
}
function renderStory() {
  return `
    <div class="card-box story">
      <h1>世界觀介紹</h1>
      <p>跟姊姊回到 300 年前的臺灣之後，我們化身成為各部落的領袖，進行了一場部落戰爭。戰爭裡面，我們獲得了很多原住民的知識；在戰爭結束時，我們又獲得了一個深埋在地底的盒子——這一次，我們一定要找到回到現代的方法！</p>
      <p>你將成為 <b>邵族</b>、<b>噶瑪蘭族</b>、<b>拉阿魯哇族</b> 或 <b>賽德克族</b> 的領袖，收集素材、交易、偷襲、換取工藝與建築，重建部落並傳承文化。集滿本族 4 張建築卡，或搶下最後一張工藝卡，遊戲便進入結算——分數最高者獲勝。</p>
      <div class="hero-tribes">
        ${Object.entries(CARDS.tribes).map(([id, t]) => `
          <div class="story-tribe">
            <img src="${t.img}" alt="${t.name}">
            <div class="muted">${t.name}<br>盛產：${t.produces.join('、')}</div>
          </div>`).join('')}
      </div>
      <p class="muted">遊戲中還會遇到台灣 16 族的傳說故事文化卡——每一張，都是一段真實流傳的部落故事。</p>
      <div class="hero-ctas">
        <button class="cta cta-primary" onclick="gotoSetup()">開始遊戲</button>
        <button class="cta cta-secondary" onclick="gotoHome()">返回首頁</button>
      </div>
    </div>`;
}
function gotoSetup() { ui.screen = 'setup'; render(); }
function gotoStory() { ui.screen = 'story'; render(); }
function gotoHome() { ui.screen = 'home'; render(); }

// ── setup / draw ──────────────────────────────────────────
function renderSetup() {
  const s = ui.setup;
  return `
    <section class="setup-screen">
      <div class="setup-panel">
        <h2>設定玩家</h2>
        <div class="player-count-row">
          ${[2, 3, 4].map(n => `<button class="option-button${s.count === n ? ' is-active' : ''}" onclick="setCount(${n})">${n} 人</button>`).join('')}
        </div>
        ${Array.from({ length: s.count }).map((_, i) => `
          <div class="player-row">
            <span class="player-tag">P${i + 1}</span>
            ${i === 0
              ? `<span class="player-tag-fixed">真人</span>`
              : `<button class="player-type-button${!s.bots[i] ? ' is-active' : ''}" onclick="setBot(${i}, false)">真人</button>
                 <button class="player-type-button${s.bots[i] ? ' is-active' : ''}" onclick="setBot(${i}, true)">電腦</button>`}
            ${s.bots[i]
              ? `<span class="player-tag-fixed">電腦自動操作</span>`
              : `<input type="text" value="${esc(s.names[i] || '')}" placeholder="玩家 ${i + 1} 暱稱" oninput="setName(${i}, this.value)">`}
          </div>
        `).join('')}
        <div class="center"><button class="primary-start-button" onclick="startDraw()">開始抽族群卡</button></div>
      </div>
    </section>`;
}
function setCount(n) { ui.setup.count = n; render(); }
function setName(i, val) { ui.setup.names[i] = val; }
function setBot(i, val) { ui.setup.bots[i] = val; render(); }
function startDraw() {
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  G = initGame(ui.setup.count, seed);
  rng = mulberry32(seed ^ 0x9e3779b9);
  ui.isBot = ui.setup.bots.slice(0, ui.setup.count);
  let botN = 0;
  ui.nicknames = G.players.map((_, i) => ui.isBot[i]
    ? `電腦${++botN}`
    : ((ui.setup.names[i] || '').trim() || `玩家${i + 1}`));
  ui.screen = 'draw';
  ui.draw = { revealed: 0 };
  render();
}
function renderDraw() {
  const d = ui.draw;
  const allRevealed = d.revealed >= G.players.length;
  return `
    <h1>抽取族群卡</h1>
    <div class="card-box">
      ${G.players.map((p, i) => i < d.revealed
        ? `<div class="row"><img class="tribe-icon-lg" src="${CARDS.tribes[p.tribe].img}" alt="">${tribeBadge(p.tribe)} ${nickname(i)}</div>`
        : `<div class="row muted">P${i + 1}（尚未抽取）</div>`).join('')}
    </div>
    <div class="center">
      ${allRevealed
        ? `<button class="primary" onclick="beginGame()">開始遊戲</button>`
        : `<button class="primary" onclick="revealNext()">抽下一位族群卡</button>`}
    </div>`;
}
function revealNext() { ui.draw.revealed++; render(); }
function beginGame() { startPlayerTurn(0); }

// ── turn flow ──────────────────────────────────────────
function startPlayerTurn(idx) {
  ui.modal = null;
  if (isBot(idx)) {
    // 電腦也「看得到」擲骰動畫，不再靜默（A11）
    ui.screen = 'board';
    ui.modal = { type: 'dice', phase: 'rolling', face: 0, bot: true };
    render();
    let ticks = 0;
    const t = setInterval(() => {
      ui.modal.face = Math.floor(Math.random() * 6);
      render();
      if (++ticks >= 8) {
        clearInterval(t);
        const { die, ap } = rollTurnDice(G, idx, rng);
        ui.modal = { type: 'dice', phase: 'result', die, ap, bot: true };
        render();
        setTimeout(() => { ui.modal = null; render(); setTimeout(runBotStep, 450); }, 950);
      }
    }, 90);
    return;
  }
  ui.screen = 'pass';
  ui.pass = { toIdx: idx, next: 'board' };
  render();
}
// 真人亮牌後先擲骰決定行動點數（A11）
function revealTurn() {
  ui.screen = ui.pass.next;
  ui.modal = { type: 'dice', phase: 'ready', face: null, ap: null };
  render();
}
// 骰子點數方格（CSS 畫，取代 unicode 骰子符號）：3×3 格取標準點位
const DIE_PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
function dieCube(n, extraClass) {
  const active = new Set(DIE_PIPS[n] || []);
  const cells = Array.from({ length: 9 }, (_, i) => `<span class="pip${active.has(i + 1) ? ' on' : ''}"></span>`).join('');
  return `<div class="die-cube${extraClass ? ' ' + extraClass : ''}">${cells}</div>`;
}
function renderDice(m) {
  const who = m.bot ? `${currentPlayer().tribeName} ${nickname(G.currentPlayer)}（電腦） ` : '';
  if (m.phase === 'ready') return `<h3 class="center">回合開始，先擲骰子！</h3>
    <div class="center dice-face">${dieCube(1)}</div>
    <div class="center"><button class="cta cta-primary" onclick="diceRoll()">擲骰子</button></div>`;
  if (m.phase === 'rolling') return `<h3 class="center">${who}擲骰中…</h3>
    <div class="center dice-face">${dieCube(m.face + 1, 'dice-rolling')}</div>`;
  return `<h3 class="center">${who}擲出 ${m.die} 點！</h3>
    <div class="center dice-face">${dieCube(m.die)}</div>
    <p class="center"><b>本回合 ${m.ap} 行動點</b>${m.ap === 4 ? '，手氣真好！' : m.ap === 2 ? '，將就一下…' : ''}</p>
    ${m.bot ? '' : `<p class="center muted">（也可以放棄行動點，選「整回合拿素材」）</p>
    <div class="center"><button class="cta cta-primary" onclick="diceDone()">開始行動</button></div>`}`;
}
function diceRoll() {
  const m = ui.modal;
  m.phase = 'rolling';
  let ticks = 0;
  const t = setInterval(() => {
    if (ui.modal !== m) { clearInterval(t); return; } // 防競態：modal 已關或換人就停，避免誤對他人擲骰
    m.face = Math.floor(Math.random() * 6); // 動畫用亂數，不影響正式判定
    render();
    if (++ticks >= 10) {
      clearInterval(t);
      const { die, ap } = rollTurnDice(G, G.currentPlayer, rng);
      m.phase = 'result'; m.die = die; m.ap = ap;
      render();
    }
  }, 90);
}
function diceDone() { ui.modal = null; render(); }

// 電腦回合：一次做一步，間隔播放讓真人看得到過程
let botGuard = 0;
function runBotStep() {
  if (G.phase !== 'playing') return;
  const p = currentPlayer();
  if (!isBot(p.idx)) return;
  if (p.actionPoints <= 0 || ++botGuard > 60) {
    botGuard = 0;
    p.actionPoints = 0;
    finishTurnAndAdvance();
    return;
  }
  const action = chooseAction(G, p.idx, rng);
  const before = G.log.length;
  try {
    applyAction(G, action, rng); // Bot 猜拳不帶 result，引擎走 RNG 判定（rules-spec A9）
    flashLog(before); // 讓真人看得到電腦在做什麼（對戰動態）
  } catch (e) {
    p.actionPoints = 0; // Bot 動作異常時直接結束回合，避免卡死
  }
  render();
  if (currentPlayer().actionPoints <= 0 || G.phase !== 'playing') {
    botGuard = 0;
    setTimeout(finishTurnAndAdvance, 700);
  } else {
    setTimeout(runBotStep, 700);
  }
}

function finishTurnAndAdvance() {
  if (G.endTriggeredBy && G.currentPlayer === G.players.length - 1) {
    G.phase = 'ended';
    ui.screen = 'end';
    render();
    return;
  }
  G.currentPlayer = (G.currentPlayer + 1) % G.players.length;
  if (G.currentPlayer === 0) G.turn++;

  if (!G.rawDeck.length && !G.cultureDeck.length && !G.buildingDeck.length && !G.endTriggeredBy) {
    const anyPair = G.players.some(pp =>
      Object.keys(CARDS.crafts).some(craftId =>
        G.craftPool.some(c => c.id === craftId) &&
        CARDS.rawCardTypes.filter(t => t.craft === craftId).map(t => t.id)
          .every(id => pp.hand.some(c => c.kind === 'raw' && c.id === id))));
    if (!anyPair) { G.endTriggeredBy = 'decks_exhausted'; G.phase = 'ended'; }
  }

  if (G.phase === 'ended') { ui.screen = 'end'; render(); return; }
  startPlayerTurn(G.currentPlayer);
}

function doAction(action) {
  const before = G.log.length;
  try {
    applyAction(G, action, rng);
    flashLog(before);
  } catch (e) {
    alert('動作失敗：' + e.message);
  }
  ui.modal = null;
  if (currentPlayer().actionPoints <= 0) finishTurnAndAdvance();
  else render();
}

// 對戰列：所有玩家一字排開互相對峙，標出當前行動者與即時領先者，營造對戰感
function versusStrip() {
  const scores = finalScores(G); // 依 player index 排列（含即時盤面分）
  const maxTotal = Math.max(...scores.map(s => s.total));
  const cells = G.players.map((pl, i) => {
    const active = pl.idx === G.currentPlayer;
    const leading = scores[i].total === maxTotal && maxTotal > 0;
    const matN = Object.values(pl.materials).reduce((a, b) => a + b, 0);
    return `<div class="vs-player tribe-${pl.tribe}${active ? ' active' : ''}">
      ${leading ? '<div class="vs-crown">領先</div>' : ''}
      <img src="${CARDS.tribes[pl.tribe].img}" alt="${pl.tribeName}">
      <div class="vs-name">${nickname(pl.idx)}${isBot(pl.idx) ? '（電腦）' : ''}</div>
      <div class="vs-score">${scores[i].total} 分</div>
      <div class="vs-stats">建${pl.buildings.length}・牌${pl.hand.length}・材${matN}</div>
    </div>`;
  });
  return `<div class="versus-strip">${cells.join('<div class="vs-sep"></div>')}</div>`;
}

// ── board ──────────────────────────────────────────
function renderBoard() {
  const p = currentPlayer();
  if (isBot(p.idx)) return renderBotTurn(p);
  const others = G.players.filter(pl => pl.idx !== p.idx);
  const pairs = availablePairs(p);
  const cultureInHand = p.hand.filter(c => c.kind === 'culture');
  const rawInHand = p.hand.filter(c => c.kind === 'raw');

  return `
    <div class="row between">
      <h1>原地重生・返璞歸真</h1>
      <div class="chip">第 ${G.turn + 1} 輪</div>
    </div>
    ${versusStrip()}

    <div class="zone-label">對手</div>
    <div class="zone-opponents">
      ${others.map(pl => `
        <div class="opp-card" style="border-top-color:var(--${pl.tribe})">
          <div class="opp-head"><img class="tribe-icon" src="${CARDS.tribes[pl.tribe].img}" alt="">${nickname(pl.idx)}${isBot(pl.idx) ? '（電腦）' : ''}</div>
          <div class="opp-stats">建${pl.buildings.length}｜牌${pl.hand.length}｜服${pl.clothing.length}｜藝${pl.played.filter(c => c.kind === 'craft').length}｜材${Object.values(pl.materials).reduce((a, b) => a + b, 0)}</div>
        </div>`).join('')}
    </div>

    <div class="card-box battle-field">
      <h3>戰場・公共牌庫</h3>
      <div class="row center">
        <span class="chip"><img class="card-back-sm" src="${CARDS.cardBacks.raw}" alt="">原料牌庫 ${G.rawDeck.length}</span>
        <span class="chip"><img class="card-back-sm" src="${CARDS.cardBacks.culture}" alt="">文化牌庫 ${G.cultureDeck.length}</span>
        <span class="chip"><img class="card-back-sm" src="${CARDS.cardBacks.building}" alt="">建築牌庫 ${G.buildingDeck.length}</span>
        <span class="chip"><img class="card-back-sm" src="${CARDS.cardBacks.craft}" alt="">工藝池 ${G.craftPool.length}</span>
      </div>
      <div class="row center">
        ${Object.entries(CARDS.crafts).map(([id, c]) => `<span class="chip card-chip">${cardThumb(c, 'sm')}${c.name} ×${G.craftPool.filter(x => x.id === id).length}</span>`).join('')}
      </div>
    </div>

    <div class="zone-label">我方</div>
    <div class="card-box zone-self">
      <div class="row between">
        <div>${tribeBadge(p.tribe)} ${nickname(p.idx)} 的回合</div>
        <div class="chip">剩餘行動點數：${p.actionPoints}</div>
      </div>
      <h3>我的素材</h3>
      <div class="row">${materialsRow(p)}</div>
      <h3>我的手牌</h3>
      <div class="row">
        ${rawInHand.map(c => `<div class="hand-card">${cardThumb(c)}<div>${c.name}</div></div>`).join('') || '<span class="muted">（無原料卡）</span>'}
      </div>
      <div class="row">
        ${cultureInHand.map(c => `
          <div class="hand-card culture">
            ${cardThumb(c)}
            <div>${c.name}</div>
            <div class="muted">${EFFECT_LABEL[c.effect] || ''}</div>
            <button ${p.actionPoints < 1 ? 'disabled' : ''} onclick="actionPlayCulture('${c.id}')">擲出</button>
          </div>`).join('') || '<span class="muted">（無文化卡）</span>'}
      </div>
      <h3>已擲出 / 工藝</h3>
      <div class="row">${p.played.map(c => `<span class="chip card-chip">${cardThumb(c, 'sm')}${c.name}</span>`).join('') || '<span class="muted">（無）</span>'}</div>
      <h3>建築</h3>
      <div class="row">${buildingsArea(p)}</div>
      <h3>服飾</h3>
      <div class="row">${p.clothing.map(c => `<span class="chip card-chip">${cardThumb(c, 'sm')}${c.name}</span>`).join('') || '<span class="muted">（無服飾）</span>'}</div>
    </div>

    <div class="card-box action-menu">
      <h3>行動</h3>
      <button ${p.actionPoints !== (p.turnStartAP ?? 3) ? 'disabled' : ''} onclick="actionTakeMaterialsPrompt()">整回合：拿素材<span class="ap-cost">全部</span></button>
      <button ${p.actionPoints < 1 || !others.length ? 'disabled' : ''} onclick="actionRaid()">偷襲（猜拳）<span class="ap-cost">1</span></button>
      <button ${p.actionPoints < 1 || !others.length ? 'disabled' : ''} onclick="actionTrade()">交易<span class="ap-cost">1</span></button>
      <button ${p.actionPoints < 1 || !G.rawDeck.length ? 'disabled' : ''} onclick="actionDrawMaterial()">抽原料卡<span class="ap-cost">1</span></button>
      <button ${p.actionPoints < 1 || !G.cultureDeck.length ? 'disabled' : ''} onclick="actionDrawCulture()">抽文化卡<span class="ap-cost">1</span></button>
      ${pairs.map(pr => `<button ${p.actionPoints < 1 ? 'disabled' : ''} onclick="actionPlayRawPair('${pr.craftId}')">擲出配對換「${pr.name}」<span class="ap-cost">1</span></button>`).join('')}
      <button ${p.actionPoints < 2 || !canBuyBuilding(p) ? 'disabled' : ''} onclick="actionBuyBuilding()">4種素材換抽建築卡<span class="ap-cost">2</span></button>
      <button ${p.actionPoints < 2 || !others.length ? 'disabled' : ''} onclick="actionBuyFromPlayer()">向玩家購卡<span class="ap-cost">2</span></button>
      <button ${p.actionPoints < 2 || !others.length ? 'disabled' : ''} onclick="actionSwapBuilding()">建築互換猜拳<span class="ap-cost">2</span></button>
      <button ${p.actionPoints < 2 || !others.length ? 'disabled' : ''} onclick="actionForceSwapRaw()">強制換原料卡<span class="ap-cost">2</span></button>
      <button class="danger" onclick="actionEndTurn()">結束回合</button>
    </div>

    <div class="log-box">${G.log.slice(-30).map(l => `<div>${esc(l)}</div>`).join('')}</div>
  `;
}

// 電腦回合畫面：不顯示電腦手牌內容，只顯示進度與 log
function renderBotTurn(p) {
  const others = G.players.filter(pl => pl.idx !== p.idx);
  return `
    <div class="row between">
      <h1>原地重生・返璞歸真</h1>
      <div class="chip">第 ${G.turn + 1} 輪</div>
    </div>
    ${versusStrip()}
    <div class="card-box center">
      <div>${tribeBadge(p.tribe)} ${nickname(p.idx)}（電腦）思考中…</div>
      <div class="muted">剩餘行動點數：${p.actionPoints}｜手牌 ${p.hand.length} 張</div>
    </div>
    <div class="card-box">
      <h3>公共區</h3>
      <div class="row">
        <span class="chip"><img class="card-back-sm" src="${CARDS.cardBacks.raw}" alt="">原料牌庫 ${G.rawDeck.length}</span>
        <span class="chip"><img class="card-back-sm" src="${CARDS.cardBacks.culture}" alt="">文化牌庫 ${G.cultureDeck.length}</span>
        <span class="chip"><img class="card-back-sm" src="${CARDS.cardBacks.building}" alt="">建築牌庫 ${G.buildingDeck.length}</span>
        <span class="chip"><img class="card-back-sm" src="${CARDS.cardBacks.craft}" alt="">工藝池 ${G.craftPool.length}</span>
      </div>
    </div>
    <div class="other-players">
      ${others.map(pl => `
        <div class="card-box">
          <div>${tribeBadge(pl.tribe)} ${nickname(pl.idx)}</div>
          <div class="muted">素材共 ${Object.values(pl.materials).reduce((a, b) => a + b, 0)} 枚｜手牌 ${pl.hand.length} 張｜建築 ${pl.buildings.length}｜服飾 ${pl.clothing.length}｜工藝 ${pl.played.filter(c => c.kind === 'craft').length}</div>
        </div>`).join('')}
    </div>
    <div class="log-box">${G.log.slice(-30).map(l => `<div>${esc(l)}</div>`).join('')}</div>
  `;
}

// ── end screen ──────────────────────────────────────────
function renderEnd() {
  const scores = finalScores(G);
  const maxTotal = Math.max(...scores.map(s => s.total));
  return `
    <h1>結算</h1>
    <p class="muted">結束原因：${endReasonLabel(G.endTriggeredBy)}｜共 ${G.turn + 1} 輪</p>
    <table class="score-table">
      <tr><th>族群</th><th>建築</th><th>文化</th><th>工藝</th><th>服飾</th><th>獎勵</th><th>總分</th></tr>
      ${scores.map(s => `<tr style="${s.total === maxTotal ? 'font-weight:bold;background:#f6ecd4;' : ''}">
        <td>${s.tribe} ${nickname(s.player)}</td><td>${s.buildings}</td><td>${s.culture}</td><td>${s.crafts}</td><td>${s.clothing}</td><td>${s.bonus}</td><td>${s.total}</td>
      </tr>`).join('')}
    </table>
    <div class="center"><button class="primary" onclick="location.reload()">重新開始</button></div>`;
}

// ── modal system ──────────────────────────────────────────
function closeModal() { ui.modal = null; render(); }
function closeBtn(label) { return `<div class="row" style="margin-top:12px;"><button onclick="closeModal()">${label || '取消'}</button></div>`; }

function renderModal() {
  if (!ui.modal) return '';
  const m = ui.modal;
  let inner = '';
  if (m.type === 'dice') inner = renderDice(m);
  else if (m.type === 'chooseTarget') inner = renderChooseTarget(m);
  else if (m.type === 'forceSwapPick') inner = renderForceSwapPick(m);
  else if (m.type === 'passOverlay') inner = passInner(m.toIdx, 'passOverlayContinue');
  else if (m.type === 'rps') inner = renderRPS(m);
  else if (m.type === 'materialPicker') inner = renderMaterialPicker(m);
  else if (m.type === 'takeMode') inner = renderTakeMode();
  else if (m.type === 'exchangePickGive') inner = renderExchangeGive(m);
  else if (m.type === 'exchangePickGet') inner = renderExchangeGet();
  else if (m.type === 'buyBuildingPicker') inner = renderBuyBuildingPicker(m);
  else if (m.type === 'tradeOffer') inner = renderTradeOffer(m);
  else if (m.type === 'tradeRespond') inner = renderTradeRespond(m);
  else if (m.type === 'tradeRejected') inner = renderTradeRejected(m);
  else if (m.type === 'buyFromPlayerPick') inner = renderBuyFromPlayerPick(m);
  else if (m.type === 'buyFromPlayerDemand') inner = renderBuyFromPlayerDemand(m);
  return `<div class="overlay"><div class="modal">${inner}</div></div>`;
}

function chooseTargetModal(title, onPick, labelFn) {
  const others = G.players.filter(pl => pl.idx !== G.currentPlayer);
  ui.modal = { type: 'chooseTarget', title, options: others.map(pl => ({ idx: pl.idx, label: labelFn ? labelFn(pl) : `${pl.tribeName} ${nickname(pl.idx)}` })), onPick };
  render();
}
function renderChooseTarget(m) {
  return `<h3>${m.title}</h3>${m.options.map(o => `<button onclick="pickTarget(${o.idx})">${o.label}</button>`).join('')}${closeBtn()}`;
}
function pickTarget(idx) { const cb = ui.modal.onPick; ui.modal = null; cb(idx); }
function passOverlayContinue() { const cb = ui.modal.onReveal; ui.modal = null; cb(); }

// RPS
function startRPS(attackerIdx, defenderIdx, onDone) {
  ui.modal = { type: 'rps', phase: 'attacker', attackerIdx, defenderIdx, attackerMove: null, defenderMove: null, result: null, onDone };
  render();
}
// 猜拳圖示（assets/ui/rps-*.png，見小畫家工作單）；圖未就緒前先顯示中文字，img 載入失敗自動隱藏不留破圖
const RPS_ICONS = ['rock', 'paper', 'scissors'];
const RPS_LABELS = ['石頭', '布', '剪刀'];
function rpsIcon(i) { return `<img class="rps-icon" src="assets/ui/rps-${RPS_ICONS[i]}.png" alt="" onerror="this.style.display='none'">`; }
function rpsButtons() {
  return `<div class="row center">
    <button class="rps-btn" onclick="rpsPick(0)">${rpsIcon(0)}石頭</button>
    <button class="rps-btn" onclick="rpsPick(1)">${rpsIcon(1)}布</button>
    <button class="rps-btn" onclick="rpsPick(2)">${rpsIcon(2)}剪刀</button>
  </div>`;
}
function renderRPS(m) {
  if (m.phase === 'attacker') return `<h3>${G.players[m.attackerIdx].tribeName} ${nickname(m.attackerIdx)} 請出拳</h3>${rpsButtons()}`;
  if (m.phase === 'pass_to_defender') return passInner(m.defenderIdx, 'rpsRevealDefenderReady');
  if (m.phase === 'defender') return `<h3>${G.players[m.defenderIdx].tribeName} ${nickname(m.defenderIdx)} 請出拳</h3>${rpsButtons()}`;
  if (m.phase === 'tie') return `<h3>平手！雙方重新出拳</h3><button class="primary" onclick="rpsAfterTie()">繼續</button>`;
  if (m.phase === 'pass_to_attacker_retry') return passInner(m.attackerIdx, 'rpsRevealAttackerReady');
  if (m.phase === 'reveal') {
    const label = RPS_LABELS;
    const winnerIdx = m.result ? m.attackerIdx : m.defenderIdx;
    return `<h3>結果揭曉</h3>
      <p>${G.players[m.attackerIdx].tribeName}：${label[m.attackerMove]}　vs　${G.players[m.defenderIdx].tribeName}：${label[m.defenderMove]}</p>
      <p><b>${G.players[winnerIdx].tribeName} 勝出！</b></p>
      <button class="primary" onclick="rpsFinish()">繼續</button>`;
  }
  return '';
}
function rpsPick(move) {
  const m = ui.modal;
  if (m.phase === 'attacker') {
    m.attackerMove = move;
    if (isBot(m.defenderIdx)) {
      // 對電腦猜拳：電腦隨機出拳，直接判定
      m.defenderMove = Math.floor(rng() * 3);
      const res = resolveRPSMoves(m.attackerMove, m.defenderMove);
      if (res === null) m.phase = 'tie';
      else { m.result = res; m.phase = 'reveal'; }
    } else {
      m.phase = 'pass_to_defender';
    }
  }
  else if (m.phase === 'defender') {
    m.defenderMove = move;
    const res = resolveRPSMoves(m.attackerMove, m.defenderMove);
    if (res === null) m.phase = 'tie';
    else { m.result = res; m.phase = 'reveal'; }
  }
  render();
}
function rpsRevealDefenderReady() { ui.modal.phase = 'defender'; render(); }
function rpsAfterTie() {
  const m = ui.modal;
  m.attackerMove = null; m.defenderMove = null;
  m.phase = isBot(m.defenderIdx) ? 'attacker' : 'pass_to_attacker_retry';
  render();
}
function rpsRevealAttackerReady() { ui.modal.phase = 'attacker'; render(); }
function rpsFinish() { const m = ui.modal; const cb = m.onDone; const result = m.result; ui.modal = null; cb(result); }

// generic material picker (gain_2_any)
function materialPickerModal(title, count, onConfirm) {
  ui.modal = { type: 'materialPicker', title, count, picks: [], onConfirm };
  render();
}
function renderMaterialPicker(m) {
  const chips = CARDS.materials.map(mat => `<button onclick="materialPick('${mat}')">${matIcon(mat)} ${mat}</button>`).join('');
  const chosen = m.picks.join('、') || '（尚未選擇）';
  return `<h3>${m.title}（選 ${m.count} 個，可重複）</h3><div class="row">${chips}</div><p>已選：${chosen}</p>
    <div class="row">
      <button onclick="materialPickUndo()">上一步</button>
      <button class="primary" ${m.picks.length < m.count ? 'disabled' : ''} onclick="materialPickConfirm()">確認</button>
    </div>`;
}
function materialPick(mat) { const m = ui.modal; if (m.picks.length < m.count) m.picks.push(mat); render(); }
function materialPickUndo() { ui.modal.picks.pop(); render(); }
function materialPickConfirm() { const m = ui.modal; const cb = m.onConfirm; const picks = m.picks.slice(); ui.modal = null; cb(picks); }

// TAKE_MATERIALS
function actionTakeMaterialsPrompt() { ui.modal = { type: 'takeMode' }; render(); }
function renderTakeMode() {
  const p = currentPlayer();
  const produces = CARDS.tribes[p.tribe].produces;
  return `<h3>整回合：拿素材</h3>
    <button class="primary" onclick="takeSimple()">拿本族盛產素材各 1（${produces.join('、')}）</button>
    <button onclick="takeExchangeStart()">用 2 枚同種盛產素材換 1 枚任意素材</button>
    ${closeBtn()}`;
}
function takeSimple() { ui.modal = null; doAction({ type: 'TAKE_MATERIALS', player: G.currentPlayer }); }
function takeExchangeStart() {
  const p = currentPlayer();
  const options = CARDS.tribes[p.tribe].produces.filter(m => (p.materials[m] || 0) >= 2);
  ui.modal = { type: 'exchangePickGive', options };
  render();
}
function renderExchangeGive(m) {
  if (!m.options.length) return `<h3>沒有任何盛產素材達到 2 枚</h3>${closeBtn('返回')}`;
  return `<h3>選擇要付出的盛產素材（2 枚換 1）</h3><div class="row">${m.options.map(x => `<button onclick="exchangeGivePick('${x}')">${matIcon(x)} ${x}</button>`).join('')}</div>${closeBtn()}`;
}
function exchangeGivePick(give) { ui.modal = { type: 'exchangePickGet', give }; render(); }
function renderExchangeGet() {
  return `<h3>選擇想要換得的素材</h3><div class="row">${CARDS.materials.map(x => `<button onclick="exchangeGetPick('${x}')">${matIcon(x)} ${x}</button>`).join('')}</div>`;
}
function exchangeGetPick(get) {
  const give = ui.modal.give;
  ui.modal = null;
  doAction({ type: 'TAKE_MATERIALS', player: G.currentPlayer, mode: 'exchange', give, get });
}

// RAID / SWAP_BUILDING
function actionRaid() {
  chooseTargetModal('選擇偷襲目標', (targetIdx) => {
    startRPS(G.currentPlayer, targetIdx, (attackerWins) => {
      doAction({ type: 'RAID', player: G.currentPlayer, target: targetIdx, result: attackerWins });
    });
  });
}
function actionSwapBuilding() {
  chooseTargetModal('選擇建築互換對象', (targetIdx) => {
    startRPS(G.currentPlayer, targetIdx, (attackerWins) => {
      doAction({ type: 'SWAP_BUILDING', player: G.currentPlayer, target: targetIdx, result: attackerWins });
    });
  }, pl => `${pl.tribeName} ${nickname(pl.idx)}（建築 ${pl.buildings.length} 張）`);
}
function actionForceSwapRaw() {
  const p = currentPlayer();
  if (!p.hand.some(c => c.kind === 'raw')) { alert('你手上沒有原料卡可交換'); return; }
  chooseTargetModal('選擇強制交換對象', (targetIdx) => {
    const t = G.players[targetIdx];
    if (!t.hand.some(c => c.kind === 'raw')) {
      alert(`${t.tribeName} 手上沒有原料卡可交換`);
      ui.modal = null; render(); return;
    }
    ui.modal = { type: 'forceSwapPick', target: targetIdx, myHandIdx: null, theirHandIdx: null };
    render();
  }, pl => `${pl.tribeName} ${nickname(pl.idx)}（原料卡 ${pl.hand.filter(c => c.kind === 'raw').length} 張）`);
}
function renderForceSwapPick(m) {
  const p = currentPlayer();
  const t = G.players[m.target];
  const mine = p.hand.map((c, idx) => ({ c, idx })).filter(x => x.c.kind === 'raw')
    .map(x => `<div class="hand-card${m.myHandIdx === x.idx ? ' selected' : ''}" onclick="forceSwapPickMine(${x.idx})">${cardThumb(x.c)}<div>${x.c.name}</div></div>`).join('');
  // rules-spec A12：對方原料卡蓋牌盲選，不公開內容（只以卡背＋編號呈現）
  const theirs = t.hand.map((c, idx) => ({ c, idx })).filter(x => x.c.kind === 'raw')
    .map((x, i) => `<div class="hand-card back${m.theirHandIdx === x.idx ? ' selected' : ''}" onclick="forceSwapPickTheirs(${x.idx})"><img class="card-thumb" src="${CARDS.cardBacks.raw}" alt="原料卡"><div>原料卡 ${i + 1}</div></div>`).join('');
  return `<h3>強制交換原料卡</h3>
    <p>選擇你要<b>給出</b>的原料卡：</p><div class="row">${mine}</div>
    <p>選擇要向 ${t.tribeName} <b>換得</b>的原料卡（對方蓋牌，翻牌後才知道是什麼）：</p><div class="row">${theirs}</div>
    <div class="row"><button onclick="closeModal()">取消</button>
    <button class="primary" ${m.myHandIdx == null || m.theirHandIdx == null ? 'disabled' : ''} onclick="forceSwapConfirm()">確認交換</button></div>`;
}
function forceSwapPickMine(idx) { ui.modal.myHandIdx = idx; render(); }
function forceSwapPickTheirs(idx) { ui.modal.theirHandIdx = idx; render(); }
function forceSwapConfirm() {
  const m = ui.modal;
  doAction({ type: 'FORCE_SWAP_RAW', player: G.currentPlayer, target: m.target, myHandIdx: m.myHandIdx, theirHandIdx: m.theirHandIdx });
}

// TRADE
function actionTrade() {
  chooseTargetModal('選擇交易對象', (targetIdx) => {
    ui.modal = { type: 'tradeOffer', target: targetIdx, give: [], get: [] };
    render();
  });
}
function renderTradeOffer(m) {
  const t = G.players[m.target];
  const p = currentPlayer();
  const giveOptions = CARDS.materials.filter(x => (p.materials[x] || 0) >= 1);
  const giveChips = giveOptions.map(x => `<button ${m.give.length >= 2 ? 'disabled' : ''} onclick="tradeAddGive('${x}')">${matIcon(x)} ${x}</button>`).join('');
  const getChips = CARDS.materials.map(x => `<button ${m.get.length >= 2 ? 'disabled' : ''} onclick="tradeAddGet('${x}')">${matIcon(x)} ${x}</button>`).join('');
  const giveChosen = m.give.map((x, i) => `<button onclick="tradeRemoveGive(${i})">${x} ✕</button>`).join(' ') || '（無）';
  const getChosen = m.get.map((x, i) => `<button onclick="tradeRemoveGet(${i})">${x} ✕</button>`).join(' ') || '（無）';
  return `<h3>向 ${t.tribeName} ${nickname(m.target)} 提議交易</h3>
    <p>你要給對方（最多 2 枚）：</p><div class="row">${giveChips}</div><p>已選：${giveChosen}</p>
    <p>你要向對方換（最多 2 枚，對方是否持有將由對方確認）：</p><div class="row">${getChips}</div><p>已選：${getChosen}</p>
    <div class="row"><button onclick="closeModal()">取消</button><button class="primary" onclick="tradeSubmit()">送出提案</button></div>`;
}
function tradeAddGive(mat) {
  const m = ui.modal; const p = currentPlayer();
  const used = m.give.filter(x => x === mat).length;
  if (m.give.length < 2 && used < (p.materials[mat] || 0)) m.give.push(mat);
  render();
}
function tradeRemoveGive(i) { ui.modal.give.splice(i, 1); render(); }
function tradeAddGet(mat) { const m = ui.modal; if (m.get.length < 2) m.get.push(mat); render(); }
function tradeRemoveGet(i) { ui.modal.get.splice(i, 1); render(); }
function tradeSubmit() {
  const m = ui.modal;
  const target = m.target, give = m.give.slice(), get = m.get.slice();
  if (isBot(target)) {
    // 電腦自動決定：用 bot.respondTrade，且電腦必須真的持有對方要換的素材
    const t = G.players[target];
    const counts = {};
    for (const x of get) counts[x] = (counts[x] || 0) + 1;
    const hasAll = Object.entries(counts).every(([x, n]) => (t.materials[x] || 0) >= n);
    const accepted = hasAll && respondTrade(G, target, { give, get });
    if (accepted) {
      ui.modal = null;
      doAction({ type: 'TRADE', player: G.currentPlayer, target, give, get, accepted: true });
    } else {
      // 電腦拒絕 → 真人可猜拳搶（A13）
      ui.modal = { type: 'tradeRejected', target, give, get };
      render();
    }
    return;
  }
  ui.modal = { type: 'passOverlay', toIdx: target, onReveal: () => {
    ui.modal = { type: 'tradeRespond', target, give, get };
    render();
  }};
  render();
}
function renderTradeRespond(m) {
  const t = G.players[m.target];
  const p = currentPlayer();
  return `<h3>${t.tribeName} ${nickname(m.target)}，${p.tribeName} 想跟你交易</h3>
    <p>對方要給你：${m.give.join('、') || '（無）'}</p>
    <p>對方想跟你換：${m.get.join('、') || '（無）'}</p>
    <div class="row">
      <button class="danger" onclick="tradeRespondDecide(false)">拒絕</button>
      <button class="primary" onclick="tradeRespondDecide(true)">接受</button>
    </div>`;
}
function tradeRespondDecide(accepted) {
  const m = ui.modal;
  const { target, give, get } = m;
  if (accepted) {
    const action = { type: 'TRADE', player: G.currentPlayer, target, give, get, accepted: true };
    ui.modal = { type: 'passOverlay', toIdx: G.currentPlayer, onReveal: () => { doAction(action); } };
    render();
    return;
  }
  // 拒絕 → 交回發起方，問要不要猜拳搶（A13）
  ui.modal = { type: 'passOverlay', toIdx: G.currentPlayer, onReveal: () => {
    ui.modal = { type: 'tradeRejected', target, give, get };
    render();
  }};
  render();
}
// A13：被拒後發起方可猜拳搶交易
function renderTradeRejected(m) {
  const p = currentPlayer();
  const t = G.players[m.target];
  const cnt = {}; m.get.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
  const canForce = m.get.length > 0 && Object.entries(cnt).every(([x, n]) => (t.materials[x] || 0) >= n);
  return `<h3>${t.tribeName} ${nickname(m.target)} 拒絕了交易！</h3>
    ${canForce
      ? `<p>不甘心嗎？可以發起猜拳搶——<b>贏了就強制成交</b>。</p>
         <div class="row"><button onclick="tradeGiveUp()">算了</button>
         <button class="primary" onclick="tradeChallengeRPS()">剪刀石頭布！</button></div>`
      : `<p>但對方沒有你要換的素材，無法強制成交。</p>
         <div class="row"><button class="primary" onclick="tradeGiveUp()">知道了</button></div>`}`;
}
function tradeGiveUp() {
  const m = ui.modal;
  doAction({ type: 'TRADE', player: G.currentPlayer, target: m.target, give: m.give, get: m.get, accepted: false });
}
function tradeChallengeRPS() {
  const m = ui.modal;
  const { target, give, get } = m;
  startRPS(G.currentPlayer, target, (attackerWins) => {
    doAction(attackerWins
      ? { type: 'TRADE', player: G.currentPlayer, target, give, get, forced: true }
      : { type: 'TRADE', player: G.currentPlayer, target, give, get, accepted: false, failedChallenge: true });
  });
}

// BUY_FROM_PLAYER
function actionBuyFromPlayer() {
  chooseTargetModal('選擇購買對象', (targetIdx) => {
    if (isBot(targetIdx)) {
      // 電腦自動賣卡：優先賣自己配不成對的原料卡，並指定自己最缺的 2 種素材
      const t = G.players[targetIdx];
      const sellable = t.hand.filter(c => c.kind === 'raw' || c.kind === 'clothing');
      if (!sellable.length) {
        doAction({ type: 'BUY_FROM_PLAYER', player: G.currentPlayer, target: targetIdx, pay: [] });
        return;
      }
      const card = sellable[0];
      const sorted = CARDS.materials.slice().sort((a, b) => (t.materials[a] || 0) - (t.materials[b] || 0));
      const pay = [sorted[0], sorted[1]];
      doAction({ type: 'BUY_FROM_PLAYER', player: G.currentPlayer, target: targetIdx, cardId: card.kind === 'raw' ? card.id : undefined, pay });
      return;
    }
    ui.modal = { type: 'passOverlay', toIdx: targetIdx, onReveal: () => {
      ui.modal = { type: 'buyFromPlayerPick', target: targetIdx };
      render();
    }};
    render();
  });
}
function renderBuyFromPlayerPick(m) {
  const t = G.players[m.target];
  const sellable = t.hand.filter(c => c.kind === 'raw' || c.kind === 'clothing');
  if (!sellable.length) return `<h3>${t.tribeName} 手上沒有原料卡或服飾卡可賣</h3><button class="primary" onclick="buyFromPlayerNoCard()">返回買方</button>`;
  const list = sellable.map((c, i) => `<button onclick="buyFromPlayerPickCard(${i})">${c.name}</button>`).join('');
  return `<h3>${t.tribeName} ${nickname(m.target)}，選擇要賣出的卡片</h3><div class="row">${list}</div>`;
}
function buyFromPlayerNoCard() {
  const target = ui.modal.target;
  ui.modal = { type: 'passOverlay', toIdx: G.currentPlayer, onReveal: () => {
    doAction({ type: 'BUY_FROM_PLAYER', player: G.currentPlayer, target, pay: [] });
  }};
  render();
}
function buyFromPlayerPickCard(i) {
  const t = G.players[ui.modal.target];
  const sellable = t.hand.filter(c => c.kind === 'raw' || c.kind === 'clothing');
  const card = sellable[i];
  ui.modal = { type: 'buyFromPlayerDemand', target: ui.modal.target, card, pay: [] };
  render();
}
function renderBuyFromPlayerDemand(m) {
  const chips = CARDS.materials.map(x => `<button ${m.pay.length >= 2 ? 'disabled' : ''} onclick="buyFromPlayerAddPay('${x}')">${matIcon(x)} ${x}</button>`).join('');
  const chosen = m.pay.map((x, i) => `<button onclick="buyFromPlayerRemovePay(${i})">${x} ✕</button>`).join(' ') || '（無）';
  return `<h3>要求買方支付（最多 2 枚）</h3><p>你要賣：${m.card.name}</p><div class="row">${chips}</div><p>已選：${chosen}</p>
    <button class="primary" onclick="buyFromPlayerSubmitDemand()">送出要求</button>`;
}
function buyFromPlayerAddPay(mat) { const m = ui.modal; if (m.pay.length < 2) m.pay.push(mat); render(); }
function buyFromPlayerRemovePay(i) { ui.modal.pay.splice(i, 1); render(); }
function buyFromPlayerSubmitDemand() {
  const m = ui.modal;
  const target = m.target, card = m.card, pay = m.pay.slice();
  ui.modal = { type: 'passOverlay', toIdx: G.currentPlayer, onReveal: () => {
    doAction({ type: 'BUY_FROM_PLAYER', player: G.currentPlayer, target, cardId: card.kind === 'raw' ? card.id : undefined, pay });
  }};
  render();
}

// BUY_BUILDING
function actionBuyBuilding() {
  const p = currentPlayer();
  const options = CARDS.materials.filter(m => (p.materials[m] || 0) >= 1);
  ui.modal = { type: 'buyBuildingPicker', options, picks: [] };
  render();
}
function renderBuyBuildingPicker(m) {
  const chips = m.options.map(mat => {
    const sel = m.picks.includes(mat);
    return `<button onclick="buyBuildingToggle('${mat}')" style="${sel ? 'border-color:var(--accent);background:#f3e9d3;' : ''}">${matIcon(mat)} ${mat}</button>`;
  }).join('');
  return `<h3>選 4 種不同素材換抽建築卡</h3><div class="row">${chips}</div><p>已選 ${m.picks.length}/4</p>
    <div class="row"><button onclick="closeModal()">取消</button><button class="primary" ${m.picks.length === 4 ? '' : 'disabled'} onclick="buyBuildingConfirm()">確認</button></div>`;
}
function buyBuildingToggle(mat) {
  const m = ui.modal;
  const i = m.picks.indexOf(mat);
  if (i >= 0) m.picks.splice(i, 1);
  else if (m.picks.length < 4) m.picks.push(mat);
  render();
}
function buyBuildingConfirm() {
  const picks = ui.modal.picks.slice();
  ui.modal = null;
  doAction({ type: 'BUY_BUILDING', player: G.currentPlayer, spend: picks });
}

// PLAY_RAW_PAIR / PLAY_CULTURE / draws / end turn
function actionPlayRawPair(craftId) { doAction({ type: 'PLAY_RAW_PAIR', player: G.currentPlayer, craftId }); }
function actionPlayCulture(cardId) {
  const p = currentPlayer();
  const card = p.hand.find(c => c.kind === 'culture' && c.id === cardId);
  if (!card) return;
  if (card.effect === 'steal_2') {
    chooseTargetModal(`擲出「${card.name}」— 選擇偷取對象`, (targetIdx) => {
      doAction({ type: 'PLAY_CULTURE', player: G.currentPlayer, cardId, target: targetIdx });
    });
  } else if (card.effect === 'gain_2_any') {
    materialPickerModal(`擲出「${card.name}」— 選擇獲得的素材`, 2, (picks) => {
      doAction({ type: 'PLAY_CULTURE', player: G.currentPlayer, cardId, gain: picks });
    });
  } else {
    doAction({ type: 'PLAY_CULTURE', player: G.currentPlayer, cardId });
  }
}
function actionDrawMaterial() { doAction({ type: 'DRAW_MATERIAL_CARD', player: G.currentPlayer }); }
function actionDrawCulture() { doAction({ type: 'DRAW_CULTURE_CARD', player: G.currentPlayer }); }
function actionEndTurn() { doAction({ type: 'END_TURN', player: G.currentPlayer }); }

Object.assign(window, {
  gotoSetup, gotoStory, gotoHome, diceRoll, diceDone,
  setCount, setName, setBot, startDraw, revealNext, beginGame, revealTurn,
  actionTakeMaterialsPrompt, takeSimple, takeExchangeStart, exchangeGivePick, exchangeGetPick, closeModal,
  actionRaid, actionSwapBuilding, actionForceSwapRaw, pickTarget, passOverlayContinue,
  forceSwapPickMine, forceSwapPickTheirs, forceSwapConfirm,
  rpsPick, rpsRevealDefenderReady, rpsAfterTie, rpsRevealAttackerReady, rpsFinish,
  actionTrade, tradeAddGive, tradeRemoveGive, tradeAddGet, tradeRemoveGet, tradeSubmit, tradeRespondDecide,
  tradeGiveUp, tradeChallengeRPS,
  actionDrawMaterial, actionDrawCulture, actionPlayRawPair, actionPlayCulture,
  materialPick, materialPickUndo, materialPickConfirm,
  actionBuyBuilding, buyBuildingToggle, buyBuildingConfirm,
  actionBuyFromPlayer, buyFromPlayerNoCard, buyFromPlayerPickCard, buyFromPlayerAddPay, buyFromPlayerRemovePay, buyFromPlayerSubmitDemand,
  actionEndTurn
});

render();
