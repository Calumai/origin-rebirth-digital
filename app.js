import { initGame, mulberry32, shuffle, CARDS } from './game-engine/state.js';
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
  // A16：單機固定「1 位真人 vs 電腦」，P2-P4 一律電腦（多真人是未來的線上連線功能，不做同機交接）
  setup: { count: 2, names: ['', '', '', ''], bots: [false, true, true, true], tribes: [null, null, null, null] },
  nicknames: [],
  isBot: [],
  pass: null,
  modal: null,
  tutorial: null,
  homeSelectedTribe: 0, // 首頁族群 carousel 目前反白的是哪一張（純瀏覽用，不影響實際選族群——那在設定畫面走 A14 流程）
  net: null,      // 連線對戰進行中：{ role, myIdx, players }；null＝單機
  netLobby: null, // 連線大廳表單狀態
  netRps: null    // 連線猜拳互動暫存
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

// 動態抽卡動畫（仿爐石戰記真實效果：卡面直接從牌庫快速滑到手牌，
// 不是慢慢翻面——爐石的抽卡是「彈出＋平滑滑動＋縮放」，沒有 3D 翻牌懸疑感）
// deckSel：牌庫圖示的 CSS class；targetEl：飛行終點（新卡落點）DOM 元素。
function flyDrawnCard(deckSel, backImg, targetEl, drawnCard) {
  const deckEl = document.querySelector(deckSel);
  const layer = document.getElementById('toast-layer');
  if (!deckEl || !targetEl || !layer || !drawnCard) return;
  const sr = deckEl.getBoundingClientRect();
  const er = targetEl.getBoundingClientRect();
  if (!sr.width || !er.width) return;

  targetEl.style.visibility = 'hidden'; // 真卡先藏起來，等飛行動畫抵達終點才現身，避免瞬間重複顯示

  const ghost = document.createElement('div');
  ghost.className = 'draw-flight';
  ghost.innerHTML = `
    <img class="draw-flight-img" src="${drawnCard.img || ''}" alt="">
    <div class="draw-flight-name">${esc(drawnCard.name || '')}</div>`;
  layer.appendChild(ghost);

  const flight = ghost.animate([
    { left: sr.left + 'px', top: sr.top + 'px', width: sr.width + 'px', height: sr.height + 'px', opacity: 0.5, offset: 0 },
    { left: sr.left + 'px', top: sr.top + 'px', width: sr.width + 'px', height: sr.height + 'px', opacity: 1, offset: 0.1 },
    { left: er.left + 'px', top: er.top + 'px', width: er.width + 'px', height: er.height + 'px', opacity: 1, offset: 1 }
  ], { duration: 380, easing: 'cubic-bezier(.22,.7,.24,1)', fill: 'forwards' });

  flight.onfinish = () => {
    ghost.remove();
    targetEl.style.visibility = 'visible';
  };
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function nickname(idx) { return esc(ui.nicknames[idx] || ''); }
function currentPlayer() { return G.players[G.currentPlayer]; }

function matIcon(m) {
  return `<img class="mat-coin" src="${CARDS.materialImages[m]}" alt="${m}">`;
}
// 行動點數用圓點呈現：亮＝還可以用，暗＝已用掉。total 給幾顆點、remaining 給亮幾顆
function apPips(remaining, total) {
  const n = Math.max(total, remaining, 0);
  return Array.from({ length: n }, (_, i) => `<span class="ap-pip${i < remaining ? '' : ' used'}"></span>`).join('');
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
function buildingPuzzleHTML(tribe, list, big) {
  const img = CARDS.buildingImages[tribe];
  const have = {};
  for (const b of list) have[b.index] = b;
  const complete = list.length >= CARDS.buildingsPerTribe;
  const POS = ['0% 0%', '100% 0%', '0% 100%', '100% 100%'];
  const cells = [1, 2, 3, 4].map(idx => have[idx]
    ? `<div class="bld-cell filled" style="background-image:url('${img}');background-position:${POS[idx - 1]}" title="${have[idx].name}"></div>`
    : `<div class="bld-cell empty"></div>`).join('');
  return `<div class="bld-group${big ? ' bld-group-big' : ''}">
    <div class="bld-puzzle${complete ? ' complete' : ''}${big ? ' bld-puzzle-big' : ''}">${cells}</div>
    <div class="bld-label">${CARDS.tribes[tribe].name}家屋 ${list.length}/${CARDS.buildingsPerTribe}${complete ? '（完整）' : ''}</div>
  </div>`;
}
// 主視覺：永遠顯示玩家本族的建築進度（即使 0 片也顯示空拼圖框，提醒目標），用於畫面中央主視覺區
function buildingsCenterpiece(p) {
  const ownList = p.buildings.filter(b => b.tribe === p.tribe);
  return buildingPuzzleHTML(p.tribe, ownList, true);
}
// 次要：玩家手上其他族建築（互換得來的），小尺寸列在旁邊，不搶主視覺
function buildingsOtherArea(p) {
  const others = p.buildings.filter(b => b.tribe !== p.tribe);
  if (!others.length) return '';
  const byTribe = {};
  for (const b of others) (byTribe[b.tribe] = byTribe[b.tribe] || []).push(b);
  return Object.entries(byTribe).map(([tribe, list]) => buildingPuzzleHTML(tribe, list, false)).join('');
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
function turnHint(p) {
  if (p.actionPoints <= 0) return '行動點用完了，請結束回合。';
  if (canBuyBuilding(p) && p.actionPoints >= 2) return '四種素材到齊了，現在可以優先蓋家屋。';
  const pairs = availablePairs(p);
  if (pairs.length && p.actionPoints >= 1) return `你手上有可配對原料，可以換工藝「${pairs[0].name}」。`;
  const missing = CARDS.materials.filter(m => (p.materials[m] || 0) < 1);
  if (p.actionPoints === (p.turnStartAP ?? p.actionPoints) && missing.length) return `先補素材吧，目前缺 ${missing.join('、')}。`;
  if (p.actionPoints < 2) return '剩 1 點行動，適合抽卡、打出文化卡或結束回合。';
  return '還有行動點，可以補素材、抽卡，或嘗試干擾對手。';
}
function actionButton(label, onClick, cost, disabled, reason = '', extraClass = '') {
  const title = disabled && reason ? ` title="${esc(reason)}"` : '';
  const classes = [extraClass, !disabled ? 'action-ready' : ''].filter(Boolean).join(' ');
  return `<button class="${classes}" ${disabled ? 'disabled' : ''}${title} onclick="${onClick}">${label}<span class="ap-cost">${cost}</span></button>`;
}
// 目標提示面板：把「怎麼贏」變成看得見的檢查清單，治「不知道要幹嘛、淪為一直抽卡」
function goalPanel(p) {
  const ownCount = p.buildings.filter(b => b.tribe === p.tribe).length;
  const remain = Math.max(0, CARDS.buildingsPerTribe - ownCount);
  const missing = CARDS.materials.filter(m => (p.materials[m] || 0) < 1);
  const produces = CARDS.tribes[p.tribe].produces;
  let next;
  if (remain === 0) {
    next = '<b>你已蓋滿 4 間家屋！</b>撐到遊戲結束就能贏。';
  } else if (missing.length === 0) {
    next = '<b>四種素材到齊了！</b>去下面按〈蓋家屋〉抽家屋卡。';
  } else {
    const notProduced = missing.filter(m => !produces.includes(m));
    next = notProduced.length
      ? `你還缺 <b>${missing.join('、')}</b>。<b>${notProduced.join('、')}</b> 本族不盛產 → 用「拿素材」裡的 2 換 1，或去「交易 / 偷襲」跟別人拿。`
      : `你還缺 <b>${missing.join('、')}</b> → 按「拿素材」補齊。`;
  }
  const dots = CARDS.materials.map(m => {
    const has = (p.materials[m] || 0) >= 1;
    return `<span class="goal-mat${has ? ' ok' : ' miss'}">${matIcon(m)}<span class="goal-mat-name">${m}</span><span class="goal-mat-mark">${has ? '✓' : '缺'}</span></span>`;
  }).join('');
  return `
    <div class="goal-panel tut-goal">
      <div class="goal-head">目標：蓋滿 <b>4</b> 間家屋${remain > 0 ? `（還差 <b>${remain}</b> 間）` : '（已完成）'}</div>
      <div class="goal-mats-label">蓋 1 間家屋要「4 種素材各 1」：</div>
      <div class="goal-mats">${dots}</div>
      <div class="goal-next">${next}</div>
    </div>`;
}
function endReasonLabel(reason) {
  if (!reason) return '（未知）';
  if (reason === 'craft_pool_empty') return '工藝池已抽光';
  if (reason === 'building_deck_empty') return '建築牌庫已抽光';
  if (reason === 'decks_exhausted') return '三個牌庫全空，且無人可再配對工藝';
  const m = reason.match(/^player_(\d+)_building_set$/);
  if (m) return `${G.players[+m[1]].tribeName} 集滿本族建築`;
  return reason;
}

// ── render ──────────────────────────────────────────
let lastRenderedScreen = null;
function render() {
  const app = document.getElementById('app');
  let html = '';
  if (ui.screen === 'home') html = renderHome();
  else if (ui.screen === 'story') html = renderStory();
  else if (ui.screen === 'setup') html = renderSetup();
  else if (ui.screen === 'netLobby') html = renderNetLobby();
  else if (ui.screen === 'board') html = `<div class="table-surface">${renderBoard()}</div>`;
  else if (ui.screen === 'end') html = renderEnd();
  html += renderModal();
  app.innerHTML = html;
  // 切換畫面時才播進場動畫；同畫面的重繪（如出牌後更新）不重播，避免每次操作都閃一輪
  if (ui.screen !== lastRenderedScreen) {
    const first = app.firstElementChild;
    if (first) {
      first.classList.add('screen-enter');
      // 編排播完就移除，讓 idle 動畫（選中卡浮動等）接手，也避免殘留 class 蓋掉後續狀態
      setTimeout(() => first.classList.remove('screen-enter'), 2000);
    }
    lastRenderedScreen = ui.screen;
  }
  positionTutorial();
  triggerRPSShake();
}

// 猜拳結果揭曉時，讓輸家在對戰列的頭像震動一下（跟 .rps-stamp 印章搭配的動態回饋）
function triggerRPSShake() {
  const m = ui.modal;
  if (!m || m.type !== 'rps' || m.phase !== 'reveal') return;
  const loserIdx = m.result ? m.defenderIdx : m.attackerIdx;
  const loserTribe = G.players[loserIdx] && G.players[loserIdx].tribe;
  const el = loserTribe && document.querySelector('.vs-player.tribe-' + loserTribe);
  if (el && !el.classList.contains('rps-shake')) {
    el.classList.add('rps-shake');
    setTimeout(() => el.classList.remove('rps-shake'), 450);
  }
}

// ── 新手互動教學（A15，2026-07-09 改為每局都自動觸發，不記憶跳過狀態）────
const TUTORIAL_STEPS = [
  { target: 'tut-ap', title: '行動點數', text: '每回合會先擲骰子，點數就是你這回合能做幾件事！' },
  { target: 'tut-goal', title: '你的目標（最重要）', text: '要贏就是「蓋滿 4 間家屋」。這裡會一直告訴你：蓋家屋要 4 種素材，你現在缺哪一種、該去換什麼。跟著這裡做就對了！' },
  { target: 'tut-materials', title: '你的素材', text: '左下角這 4 個圓幣是你的素材。蓋家屋要 4 種各至少 1 個——你這族只產 3 種，缺的那種要靠「2 換 1」或跟別人交易/偷襲拿。' },
  { target: 'tut-actions', title: '怎麼行動', text: '按鈕分三組：〈蓋家屋〉是贏的路、〈賺加分〉做工藝文化卡、〈搞對手〉去偷襲交易。不知道做什麼就先「拿素材」。' },
  { target: 'tut-buildings', title: '家屋進度', text: '這是你的家屋拼圖，蓋一間補一塊，集滿 4 塊就贏。' },
  { target: 'tut-endturn', title: '結束回合', text: '行動點數用完了，或想提前結束，按這裡換下一位繼續玩！' }
];
function maybeStartTutorial() {
  if (G.turn === 0 && G.currentPlayer === 0 && !isBot(0)) startTutorial();
}
function startTutorial() { ui.tutorial = { step: 0 }; render(); }
function tutorialNext() {
  if (ui.tutorial.step >= TUTORIAL_STEPS.length - 1) { closeTutorial(); return; }
  ui.tutorial.step++; render();
}
function tutorialPrev() { if (ui.tutorial.step > 0) { ui.tutorial.step--; render(); } }
function closeTutorial() { ui.tutorial = null; render(); }
function positionTutorial() {
  document.getElementById('tutorial-dim')?.remove();
  document.getElementById('tutorial-tooltip')?.remove();
  if (!ui.tutorial) return;
  const step = TUTORIAL_STEPS[ui.tutorial.step];
  const target = document.querySelector('.' + step.target);
  if (!target) { tutorialNext(); return; } // 目標元件這回合不存在（如按鈕未渲染）就跳過該步
  target.classList.add('tutorial-highlight');
  const rect = target.getBoundingClientRect();

  const dim = document.createElement('div');
  dim.id = 'tutorial-dim';
  dim.className = 'tutorial-dim';
  document.body.appendChild(dim);

  const tip = document.createElement('div');
  tip.id = 'tutorial-tooltip';
  tip.className = 'tutorial-tooltip';
  tip.style.visibility = 'hidden'; // 先插入量測實際尺寸，避免用估計值導致按鈕被推出螢幕
  tip.innerHTML = `
    <div class="tut-step">第 ${ui.tutorial.step + 1} / ${TUTORIAL_STEPS.length} 步</div>
    <h4>${step.title}</h4>
    <p>${step.text}</p>
    <div class="row" style="margin-top:10px;">
      ${ui.tutorial.step > 0 ? '<button onclick="tutorialPrev()">上一步</button>' : ''}
      <button class="primary" onclick="tutorialNext()">${ui.tutorial.step === TUTORIAL_STEPS.length - 1 ? '知道了，開始玩！' : '下一步'}</button>
      <button onclick="closeTutorial()">跳過教學</button>
    </div>`;
  document.body.appendChild(tip);

  const margin = 12;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let left = Math.max(margin, Math.min(rect.left, window.innerWidth - tw - margin));
  let top = rect.bottom + margin;
  if (top + th > window.innerHeight - margin) top = rect.top - th - margin; // 下面塞不下就放上面
  top = Math.max(margin, Math.min(top, window.innerHeight - th - margin)); // 夾在畫面範圍內，上下都塞不下就貼齊並靠 max-height 捲動
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
  tip.style.visibility = 'visible';
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
// 首頁族群 carousel：純瀏覽/預覽用，實際選族群在設定畫面（A14），不從這裡帶值
function homeCarouselPrev() {
  const n = Object.keys(CARDS.tribes).length;
  homeCarouselSelect(((ui.homeSelectedTribe ?? 0) - 1 + n) % n);
}
function homeCarouselNext() {
  const n = Object.keys(CARDS.tribes).length;
  homeCarouselSelect(((ui.homeSelectedTribe ?? 0) + 1) % n);
}
function homeCarouselSelect(i) {
  ui.homeSelectedTribe = i;
  // 直接改 class 不整頁重繪，讓卡片的 CSS transition 有機會播放（重繪會瞬間跳格）
  document.querySelectorAll('.ps5-home .tribe-card').forEach((c, idx) => c.classList.toggle('selected', idx === i));
}
function comingSoonToast() { showToast('敬請期待，此功能尚未推出'); }
// 手機版主選單抽屜開合（桌機用不到，側欄常駐）
function toggleHomeNav() {
  const home = document.querySelector('.ps5-home');
  if (!home) return;
  const open = home.classList.toggle('nav-open');
  const btn = home.querySelector('.ps5-nav-toggle');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
// 首頁點族群卡＝選好我方族群直接進設定（填名字/對手數）後開始，A14 的選族群流程收斂到這一步
function homeStartWithTribe(i) {
  const id = Object.keys(CARDS.tribes)[i];
  ui.homeSelectedTribe = i;
  ui.setup.tribes[0] = id;
  gotoSetup();
}

function renderHome() {
  const tribeEntries = Object.entries(CARDS.tribes);
  const selIdx = ui.homeSelectedTribe ?? 0;
  return `
    <main class="ps5-home">
      <div class="ps5-bg"></div>
      <div class="ps5-embers"></div>
      <div class="ps5-embers ps5-embers-2"></div>
      <div class="ps5-vignette"></div>
      <div class="ps5-focus-glow"></div>

      <button class="ps5-nav-toggle" onclick="toggleHomeNav()" aria-label="開啟主選單" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <div class="ps5-nav-scrim" onclick="toggleHomeNav()" aria-hidden="true"></div>

      <aside class="ps5-sidebar" aria-label="主選單">
        <button class="side-item active" onclick="gotoHome()">
          <span class="side-icon" aria-hidden="true">⌂</span>
          <span class="side-text"><b>首頁</b><small>HOME</small></span>
        </button>
        <button class="side-item" onclick="gotoStory()">
          <span class="side-icon" aria-hidden="true">▣</span>
          <span class="side-text"><b>故事</b><small>STORY</small></span>
        </button>
        <button class="side-item" onclick="gotoNetLobby()">
          <span class="side-icon" aria-hidden="true">⇄</span>
          <span class="side-text"><b>連線對戰</b><small>ONLINE</small></span>
        </button>
        <button class="side-item" onclick="comingSoonToast()">
          <span class="side-icon" aria-hidden="true">▤</span>
          <span class="side-text"><b>資料庫</b><small>ARCHIVE</small></span>
        </button>
        <button class="side-item" onclick="comingSoonToast()">
          <span class="side-icon" aria-hidden="true">✦</span>
          <span class="side-text"><b>特典</b><small>BONUS</small></span>
        </button>
        <button class="side-item" onclick="comingSoonToast()">
          <span class="side-icon" aria-hidden="true">⚙</span>
          <span class="side-text"><b>設定</b><small>OPTION</small></span>
        </button>
      </aside>

      <header class="ps5-topbar">
        <button onclick="comingSoonToast()">設定</button>
        <button onclick="comingSoonToast()">操作說明</button>
        <button onclick="comingSoonToast()">選項</button>
      </header>

      <section class="ps5-content">
        <div class="game-title-block">
          <h1>原地重生・返璞歸真</h1>
          <p>一款結合台灣原住民族文化與探索冒險的敘事遊戲。</p>
        </div>

        <section class="tribe-carousel" aria-label="族群卡選擇">
          <button class="carousel-arrow left" onclick="homeCarouselPrev()" aria-label="上一張">‹</button>
          ${tribeEntries.map(([id, t], i) => `
            <article class="tribe-card${i === selIdx ? ' selected' : ''}" onclick="homeStartWithTribe(${i})" title="選 ${t.name} 開始遊戲">
              <img src="${t.img}" alt="${t.name}">
              <div class="tribe-name">${t.name}</div>
            </article>`).join('')}
          <button class="carousel-arrow right" onclick="homeCarouselNext()" aria-label="下一張">›</button>
        </section>
      </section>

      <footer class="ps5-hints">
        <span>選擇族別後，遊戲立即開始</span>
      </footer>
    </main>`;
}
function renderStory() {
  return `
    <section class="end-screen">
      <div class="setup-panel story-panel">
        <h2>世界觀介紹</h2>
        <p>跟姊姊回到 300 年前的臺灣之後，我們化身成為各部落的領袖，進行了一場部落戰爭。戰爭裡面，我們獲得了很多原住民的知識；在戰爭結束時，我們又獲得了一個深埋在地底的盒子——這一次，我們一定要找到回到現代的方法！</p>
        <p>你將成為 <b>邵族</b>、<b>噶瑪蘭族</b>、<b>拉阿魯哇族</b> 或 <b>賽德克族</b> 的領袖，收集素材、交易、偷襲、換取工藝與建築，重建部落並傳承文化。集滿本族 4 張建築卡，或抽空建築牌庫，遊戲便進入結算——<b>本族家屋蓋最多的人獲勝</b>（平手才比總分）。</p>
        <div class="story-tribe-row">
          ${Object.entries(CARDS.tribes).map(([id, t]) => `
            <div class="story-tribe-card">
              <img src="${t.img}" alt="${t.name}">
              <div class="story-tribe-name">${t.name}</div>
              <div class="story-tribe-produces">盛產：${t.produces.join('、')}</div>
            </div>`).join('')}
        </div>
        <p class="center" style="color:rgba(248,230,190,0.7); font-size:0.85em;">遊戲中還會遇到台灣 16 族的傳說故事文化卡——每一張，都是一段真實流傳的部落故事。</p>
        <div class="center"><button class="primary-start-button" onclick="gotoSetup()">開始遊戲</button></div>
        <div class="center" style="margin-top:8px;"><button class="secondary-lore-button" onclick="gotoHome()">返回首頁</button></div>
      </div>
    </section>`;
}
function leaveNet() { if (ui.net || Net.peer) { Net.reset(); ui.net = null; ui.netLobby = null; ui.netRps = null; } }
function gotoSetup() { leaveNet(); ui.screen = 'setup'; render(); }
function gotoStory() { ui.screen = 'story'; render(); }
function gotoHome() { leaveNet(); ui.screen = 'home'; render(); }

// ── setup / draw ──────────────────────────────────────────
// rules-spec A14：族群改玩家自選，直接在設定玩家畫面點卡選，不再另開抽卡畫面
function renderSetup() {
  const s = ui.setup;
  const allPicked = Array.from({ length: s.count }).every((_, i) => s.bots[i] || s.tribes[i]);
  return `
    <section class="setup-screen">
      <div class="setup-panel">
        <h2>設定玩家</h2>
        <label class="name-field">
          <span class="name-field-label">你的名字</span>
          <input type="text" value="${esc(s.names[0] || '')}" placeholder="輸入你的名字" maxlength="12" oninput="setName(0, this.value)">
        </label>
        <div class="player-count-row">
          ${[2, 3, 4].map(n => `<button class="option-button${s.count === n ? ' is-active' : ''}" onclick="setCount(${n})">${n} 人</button>`).join('')}
        </div>
        ${Array.from({ length: s.count }).map((_, i) => `
          <div class="player-row">
            <span class="player-tag">P${i + 1}</span>
            ${i === 0
              ? `<span class="player-tag-fixed">你${s.names[0] ? '（' + esc(s.names[0]) + '）' : ''}，選擇族群</span>`
              : `<span class="player-tag-fixed">電腦自動操作</span>`}
          </div>
          ${s.bots[i] ? '' : `
          <div class="tribe-pick-row">
            ${Object.entries(CARDS.tribes).map(([id, t]) => {
              const takenByOther = s.tribes.some((x, j) => x === id && j !== i && j < s.count);
              const selected = s.tribes[i] === id;
              return `<button class="tribe-pick${selected ? ' is-active' : ''}" ${takenByOther ? 'disabled' : ''} onclick="pickTribe(${i}, '${id}')" title="${t.name}">
                <img src="${t.img}" alt="${t.name}"><span>${t.name}</span>
              </button>`;
            }).join('')}
          </div>`}
        `).join('')}
        <div class="center"><button class="primary-start-button" ${allPicked ? '' : 'disabled'} onclick="startGame()">開始遊戲</button></div>
        ${allPicked ? '' : '<p class="muted center" style="color:#f7ddb0">請先選擇你的族群</p>'}
      </div>
    </section>`;
}
function setCount(n) { ui.setup.count = n; render(); }
function setName(i, val) { ui.setup.names[i] = val; }
function pickTribe(i, tribeId) {
  const s = ui.setup;
  if (s.tribes.some((x, j) => x === tribeId && j !== i && j < s.count)) return; // 已被其他玩家選走
  s.tribes[i] = s.tribes[i] === tribeId ? null : tribeId; // 再點一次取消選擇
  render();
}
function startGame() {
  const s = ui.setup;
  for (let i = 0; i < s.count; i++) if (!s.bots[i] && !s.tribes[i]) return; // 未選完不可開始
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  rng = mulberry32(seed ^ 0x9e3779b9);
  const chosen = s.tribes.slice(0, s.count);
  const remaining = shuffle(Object.keys(CARDS.tribes).filter(id => !chosen.includes(id)), rng);
  let ri = 0;
  const tribeIds = chosen.map(id => id || remaining[ri++]); // 電腦玩家隨機分配剩餘族群
  G = initGame(s.count, seed, tribeIds);
  ui.isBot = s.bots.slice(0, s.count);
  let botN = 0;
  ui.nicknames = G.players.map((_, i) => ui.isBot[i]
    ? `電腦${++botN}`
    : ((s.names[i] || '').trim() || `玩家${i + 1}`));
  startPlayerTurn(0);
}

// ── turn flow ──────────────────────────────────────────
function startPlayerTurn(idx) {
  ui.modal = null;
  if (ui.net) {
    // 連線對戰：換我＝進擲骰；換對方＝進觀戰視圖（renderBoard 會依 ui.net.myIdx 判斷）
    ui.screen = 'board';
    ui.modal = (idx === ui.net.myIdx) ? { type: 'dice', phase: 'ready', face: null, ap: null } : null;
    render();
    return;
  }
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
  // A16：只有一位真人，不再走「請把電腦交給下一位」交接畫面，直接進擲骰（A11）
  ui.screen = 'board';
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
    <p class="center muted">骰子點數會變成你這回合能做幾件事（行動點）</p>
    <div class="center"><button class="cta cta-primary" onclick="diceRoll()">擲骰子</button></div>`;
  if (m.phase === 'rolling') return `<h3 class="center">${who}擲骰中…</h3>
    <div class="center dice-face">${dieCube(m.face + 1, 'dice-rolling')}</div>`;
  return `<h3 class="center">${who}骰到 ${m.die} 點！</h3>
    <div class="center dice-face">${dieCube(m.die)}</div>
    <p class="center dice-ap-line">骰子 <b>${m.die}</b> 點　→　這回合可以做 <b>${m.ap}</b> 件事</p>
    <div class="center ap-pips ap-pips-lg">${apPips(m.ap, m.ap)}</div>
    ${m.ap === 4 ? '<p class="center muted">手氣真好！</p>' : m.ap === 2 ? '<p class="center muted">將就一下…</p>' : ''}
    ${m.bot ? '' : `<p class="center muted">（也可以放棄行動，選「整回合拿素材」）</p>
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
      if (ui.net) Net.send({ t: 'dice' }); // 通知對方套用同一次擲骰（他用自己的 rng 消耗一次，結果一致）
    }
  }, 90);
}
function diceDone() { ui.modal = null; render(); maybeStartTutorial(); }

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
  if (!G.buildingDeck.length && !G.endTriggeredBy) {
    G.endTriggeredBy = 'building_deck_empty';
    G.endTriggerTurn = G.turn;
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

function doAction(action, fromRemote) {
  const before = G.log.length;
  const matBefore = G.players.map(p => ({ ...p.materials }));
  const buildingsBefore = G.players.map(p => p.buildings.length);
  try {
    applyAction(G, action, rng);
    flashLog(before);
    const actor = G.players[action.player];
    const who = actor ? (action.player === ui.net?.myIdx ? '你' : actor.tribeName) : '玩家';
    const feedback = {
      BUY_FROM_PLAYER: `${who} 完成了一次玩家購卡`,
      TRADE: `${who} 發起的交易成立了`,
      RAID: `${who} 發動偷襲，戰場有變化`,
      SWAP_BUILDING: `${who} 完成建築互換`,
      PLAY_CULTURE: `${who} 打出了一張文化卡`,
      PLAY_RAW_PAIR: `${who} 完成了一件工藝`
    }[action.type];
    if (feedback) showToast(feedback);
  } catch (e) {
    alert('動作失敗：' + e.message);
    ui.modal = null; render();
    return;
  }
  // 連線對戰：我在自己回合做的動作，套用成功後廣播給對方（對方以 fromRemote 套用，不再回傳）
  if (ui.net && !fromRemote && action.player === ui.net.myIdx) Net.send({ t: 'act', action });
  ui.modal = null;
  render(); // 先渲染出最終狀態，飛行動畫在畫面上疊加視覺回饋
  const played = animateGains(action, matBefore, buildingsBefore);
  const advance = () => { if (currentPlayer().actionPoints <= 0) finishTurnAndAdvance(); };
  if (played) setTimeout(advance, 420); else advance();
}

// 動作結束後比對素材/建築變化，飛出對應的動態獲得回饋；回傳是否有播放動畫（供 doAction 決定要不要延遲換手）
function animateGains(action, matBefore, buildingsBefore) {
  if (ui.screen !== 'board') return false; // 畫面已經離開對局板就不播
  const idx = action.player;
  const p = G.players[idx];
  if (!p || isBot(idx) || currentPlayer().idx !== idx) return false; // 電腦回合或畫面已換人不播
  let played = false;

  const matDock = document.querySelector('.tut-materials');
  if (matDock) {
    const before = matBefore[idx];
    for (const m of CARDS.materials) {
      const delta = (p.materials[m] || 0) - (before[m] || 0);
      // 優先飛向該素材自己的圓幣，找不到才退回整個素材區
      const matTarget = document.querySelector(`.mat-dock-coin[data-mat="${m}"]`) || matDock;
      if (delta > 0) { flyMaterialGain(m, delta, materialGainOriginEl(action), matTarget); played = true; }
    }
  }

  if (p.buildings.length > buildingsBefore[idx]) {
    const cells = document.querySelectorAll('.bld-cell.filled');
    const lastCell = cells[cells.length - 1];
    const b = p.buildings[p.buildings.length - 1];
    if (lastCell && b) { flyDrawnCard('.deck-building', null, lastCell, { img: b.img, name: b.name }); played = true; }
  }
  return played;
}
// 素材飛行的起點：偷襲成功從對方頭像飛出，其餘一律從戰場區飛出
function materialGainOriginEl(action) {
  if (action.type === 'RAID' && action.target != null) {
    const t = G.players[action.target];
    const el = t && document.querySelector('.vs-player.tribe-' + t.tribe);
    if (el) return el;
  }
  return document.querySelector('.bv-battlefield') || document.querySelector('.bv-versus');
}
// 素材幣飛行動畫：從 originEl 飛到 targetEl，count>1 時錯開時間依序飛出（最多同時 4 枚避免洗版）
function flyMaterialGain(matName, count, originEl, targetEl) {
  const layer = document.getElementById('toast-layer');
  const img = CARDS.materialImages[matName];
  if (!layer || !originEl || !targetEl || !img) return;
  const sr = originEl.getBoundingClientRect();
  const er = targetEl.getBoundingClientRect();
  if (!sr.width || !er.width) return;
  const n = Math.min(count, 4);
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const coin = document.createElement('img');
      coin.className = 'coin-flight';
      coin.src = img;
      layer.appendChild(coin);
      const jitter = (Math.random() - 0.5) * 22;
      const anim = coin.animate([
        { left: (sr.left + sr.width / 2 - 13 + jitter) + 'px', top: (sr.top + sr.height / 2 - 13) + 'px', opacity: 0.7, transform: 'scale(0.6)', offset: 0 },
        { left: (sr.left + sr.width / 2 - 13 + jitter) + 'px', top: (sr.top + sr.height / 2 - 13) + 'px', opacity: 1, transform: 'scale(1.15)', offset: 0.15 },
        { left: (er.left + er.width / 2 - 13) + 'px', top: (er.top + er.height / 2 - 13) + 'px', opacity: 1, transform: 'scale(0.85)', offset: 1 }
      ], { duration: 420, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'forwards' });
      anim.onfinish = () => coin.remove();
    }, i * 80);
  }
}

// 家屋數量決勝：本族家屋棟數為主排序鍵，總分為輔（平手才比）。負值代表 a 較優、排在前面。
function rankCmp(a, b) { return (b.buildingCount - a.buildingCount) || (b.total - a.total); }
// 玩家 i 是否領先（沒有人嚴格比他更好，可能並列）
function isLeader(scores, i) {
  const s = scores[i];
  if (s.buildingCount === 0 && s.total === 0) return false; // 開局全 0 不標領先
  return !scores.some((o, j) => j !== i && rankCmp(o, s) < 0);
}
// 攤開手牌：所有玩家手牌一律正面朝上（JJ 決議「全部攤開卡面」）
function openHandRow(pl) {
  if (!pl.hand.length) return '<div class="vs-hand"><span class="vs-hand-empty">無手牌</span></div>';
  return `<div class="vs-hand">${pl.hand.map(c => `<span class="vs-hand-card" title="${c.name}">${cardThumb(c, 'sm')}</span>`).join('')}</div>`;
}

// 對戰列：所有玩家一字排開互相對峙，標出當前行動者與即時領先者，營造對戰感
function versusStrip() {
  return G.players.length === 2 ? versusStripDuel() : versusStripMulti();
}
// 3-4 人局：維持小圓形頭像橫排
function versusStripMulti() {
  const scores = finalScores(G); // 依 player index 排列（含即時盤面分）
  const goal = CARDS.buildingsPerTribe;
  const cells = G.players.map((pl, i) => {
    const active = pl.idx === G.currentPlayer;
    const leading = isLeader(scores, i);
    const matN = Object.values(pl.materials).reduce((a, b) => a + b, 0);
    return `<div class="vs-player tribe-${pl.tribe}${active ? ' active' : ''}">
      ${leading ? '<div class="vs-crown">領先</div>' : ''}
      <img src="${CARDS.tribes[pl.tribe].img}" alt="${pl.tribeName}">
      <div class="vs-name">${nickname(pl.idx)}${isBot(pl.idx) ? '（電腦）' : ''}</div>
      <div class="vs-score"><b>家屋 ${scores[i].buildingCount}/${goal}</b></div>
      <div class="vs-stats">總分 ${scores[i].total}・服${pl.clothing.length}・藝${pl.played.filter(c => c.kind === 'craft').length}・材${matN}</div>
      ${openHandRow(pl)}
    </div>`;
  });
  return `<div class="versus-strip">${cells.join('<div class="vs-sep"></div>')}</div>`;
}
// 2 人局：寬版雙色對峙橫幅（左藍右紅），中央金色回合徽章
function versusStripDuel() {
  const scores = finalScores(G);
  const goal = CARDS.buildingsPerTribe;
  const side = (i, cls) => {
    const pl = G.players[i];
    const active = pl.idx === G.currentPlayer;
    const leading = isLeader(scores, i);
    const matN = Object.values(pl.materials).reduce((a, b) => a + b, 0);
    return `<div class="duel-side ${cls}${active ? ' active' : ''}">
      ${leading ? '<div class="duel-flag">領先</div>' : ''}
      <img class="duel-badge" src="${CARDS.tribes[pl.tribe].img}" alt="${pl.tribeName}">
      <div class="duel-info">
        <div class="duel-name">${nickname(pl.idx)}${isBot(pl.idx) ? '（電腦）' : ''}</div>
        <div class="duel-score"><b>家屋 ${scores[i].buildingCount}/${goal}</b></div>
        <div class="duel-stats">總分 ${scores[i].total}・原${matN}・服${pl.clothing.length}・藝${pl.played.filter(c => c.kind === 'craft').length}</div>
      </div>
      ${openHandRow(pl)}
    </div>`;
  };
  return `<div class="versus-duel">
    ${side(0, 'duel-left')}
    <div class="duel-medal"><div class="duel-medal-inner">回合</div></div>
    ${side(1, 'duel-right')}
  </div>`;
}

// ── board ──────────────────────────────────────────
function renderBoard() {
  const p = currentPlayer();
  // 連線對戰：不是我的回合就進觀戰視圖（沿用電腦回合的版面）
  if (isBot(p.idx) || (ui.net && p.idx !== ui.net.myIdx)) return renderBotTurn(p);
  const others = G.players.filter(pl => pl.idx !== p.idx);
  const remoteBlock = !!ui.net; // 連線版 v1：對抗行動（需雙向猜拳/協商）先停用
  const pairs = availablePairs(p);
  const cultureInHand = p.hand.filter(c => c.kind === 'culture');
  const rawInHand = p.hand.filter(c => c.kind === 'raw');

  return `
    <div class="board-viewport">
      <div class="bv-header row between">
        <h1>原地重生・返璞歸真</h1>
        <div class="row">
          <button class="tutorial-open-btn" onclick="startTutorial()">怎麼玩？</button>
          <div class="chip">第 ${G.turn + 1} 輪</div>
        </div>
      </div>

      <div class="bv-versus">${versusStrip()}</div>

      <div class="bv-resources card-box light-frame">
        <div class="row between">
          <div>${tribeBadge(p.tribe)} ${nickname(p.idx)}</div>
        </div>
        <h3>戰場・公共牌庫</h3>
        <div class="row">
          <span class="chip deck-raw"><img class="card-back-sm" src="${CARDS.cardBacks.raw}" alt="">原料 ${G.rawDeck.length}</span>
          <span class="chip deck-culture"><img class="card-back-sm" src="${CARDS.cardBacks.culture}" alt="">文化 ${G.cultureDeck.length}</span>
          <span class="chip deck-building"><img class="card-back-sm" src="${CARDS.cardBacks.building}" alt="">建築 ${G.buildingDeck.length}</span>
          <span class="chip deck-craft"><img class="card-back-sm" src="${CARDS.cardBacks.craft}" alt="">工藝 ${G.craftPool.length}</span>
        </div>
        <div class="row">
          ${Object.entries(CARDS.crafts).map(([id, c]) => `<span class="chip card-chip">${cardThumb(c, 'sm')}${c.name} ×${G.craftPool.filter(x => x.id === id).length}</span>`).join('')}
        </div>
        <h3>已擲出 / 工藝</h3>
        <div class="row">${p.played.map(c => `<span class="chip card-chip">${cardThumb(c, 'sm')}${c.name}</span>`).join('') || '<span class="muted">（無）</span>'}</div>
        <h3>服飾</h3>
        <div class="row">${p.clothing.map(c => `<span class="chip card-chip">${cardThumb(c, 'sm')}${c.name}</span>`).join('') || '<span class="muted">（無服飾）</span>'}</div>
      </div>

      <div class="bv-buildings card-box light-frame tut-buildings">
        <h3 class="bld-centerpiece-title">${tribeBadge(p.tribe)} 家屋進度${(() => { const r = CARDS.buildingsPerTribe - p.buildings.filter(b => b.tribe === p.tribe).length; return r > 0 ? `<span class="bld-remain">還差 ${r} 間就贏</span>` : '<span class="bld-remain done">已蓋滿！</span>'; })()}</h3>
        <div class="bld-centerpiece">${buildingsCenterpiece(p)}</div>
        <div class="row center">${buildingsOtherArea(p)}</div>
      </div>

      <div class="bv-side">
        <div class="card-box light-frame action-menu tut-actions">
          <div class="ap-tracker tut-ap">
            <div class="ap-tracker-top">
              <span class="ap-tracker-label">本回合還能做</span>
              <span class="ap-tracker-count"><b>${p.actionPoints}</b> 件事</span>
            </div>
            <div class="ap-pips">${apPips(p.actionPoints, Math.max(p.turnStartAP ?? p.actionPoints, p.actionPoints))}</div>
          </div>
          <div class="turn-hint">${turnHint(p)}</div>

          ${goalPanel(p)}

          <div class="action-group-label">蓋家屋（贏的路）</div>
          ${actionButton('拿素材（本族 3 種各 1，或 2 換 1 補缺）', 'actionTakeMaterialsPrompt()', '整回合', p.actionPoints !== (p.turnStartAP ?? 3), '拿素材是整回合行動，只能在還沒做其他事時使用', 'action-suggest')}
          ${actionButton('蓋家屋：4 種素材換抽家屋卡', 'actionBuyBuilding()', '2', p.actionPoints < 2 || !canBuyBuilding(p), p.actionPoints < 2 ? '需要 2 點行動點' : '需要 4 種素材各 1')}

          <div class="action-group-label">賺加分</div>
          ${actionButton('抽原料卡（湊對做工藝用）', 'actionDrawMaterial()', '1', p.actionPoints < 1 || !G.rawDeck.length, p.actionPoints < 1 ? '行動點數不足' : '原料牌庫已空')}
          ${pairs.map(pr => actionButton(`湊對換工藝「${pr.name}」`, `actionPlayRawPair('${pr.craftId}')`, '1', p.actionPoints < 1, '行動點數不足')).join('')}
          ${actionButton('抽文化卡', 'actionDrawCulture()', '1', p.actionPoints < 1 || !G.cultureDeck.length, p.actionPoints < 1 ? '行動點數不足' : '文化牌庫已空')}

          <div class="action-group-label">搞對手（進階）</div>
          ${actionButton('偷襲（猜拳）', 'actionRaid()', '1', p.actionPoints < 1 || !others.length, p.actionPoints < 1 ? '行動點數不足' : '沒有其他玩家')}
          ${actionButton('交易', 'actionTrade()', '1', p.actionPoints < 1 || !others.length, p.actionPoints < 1 ? '行動點數不足' : '沒有其他玩家')}
          ${actionButton('向玩家購卡', 'actionBuyFromPlayer()', '2', p.actionPoints < 2 || !others.length, p.actionPoints < 2 ? '需要 2 點行動點' : '選擇玩家與要購買的卡牌')}
          ${actionButton('建築互換猜拳', 'actionSwapBuilding()', '2', p.actionPoints < 2 || !others.length, p.actionPoints < 2 ? '需要 2 點行動點' : '沒有其他玩家')}
          ${actionButton('強制換原料卡', 'actionForceSwapRaw()', '2', p.actionPoints < 2 || !others.length, p.actionPoints < 2 ? '需要 2 點行動點' : '沒有其他玩家')}

          <button class="danger tut-endturn" onclick="actionEndTurn()">結束回合</button>
        </div>
      </div>

      <div class="bv-hand">
        ${rawInHand.map(c => `
          <div class="hand-card">
            ${cardThumb(c)}
            <div class="hand-card-info"><b>${c.name}</b><span>原料卡・湊對換工藝</span></div>
          </div>`).join('')}
        ${cultureInHand.map(c => `
          <div class="hand-card culture${p.actionPoints < 1 ? ' disabled' : ''}" ${p.actionPoints < 1 ? '' : `onclick="actionPlayCulture('${c.id}')"`}>
            ${cardThumb(c)}
            <div class="hand-card-info"><b>${c.name}</b><span>${EFFECT_LABEL[c.effect] || ''}</span><em>${p.actionPoints < 1 ? '行動點數不足' : '點擊擲出'}</em></div>
          </div>`).join('')}
        ${(!rawInHand.length && !cultureInHand.length) ? `
          <div class="empty-hand-state">
            <div class="empty-hand-decks">
              <div class="empty-deck"><img src="${CARDS.cardBacks.raw}" alt="原料牌庫"><b>原料牌庫</b><span>${G.rawDeck.length} 張</span></div>
              <div class="empty-deck culture-deck"><img src="${CARDS.cardBacks.culture}" alt="文化牌庫"><b>文化牌庫</b><span>${G.cultureDeck.length} 張</span></div>
            </div>
            <div class="empty-hand-copy"><strong>你的手牌區</strong><span>目前沒有手牌，從右側行動選單抽牌</span></div>
          </div>` : ''}
      </div>

      <div class="mat-dock tut-materials">
        ${CARDS.materials.map(m => `
          <div class="mat-dock-coin" data-mat="${m}" title="${m}">
            <img src="${CARDS.materialImages[m]}" alt="${m}">
            <span class="mat-dock-num">${p.materials[m] || 0}</span>
          </div>`).join('')}
      </div>
    </div>
  `;
}

// 電腦回合／連線對手回合畫面：不顯示對方手牌內容，只顯示進度與 log
function renderBotTurn(p) {
  const others = G.players.filter(pl => pl.idx !== p.idx);
  const remote = !!ui.net;
  const whoLabel = remote ? `${nickname(p.idx)} 的回合` : `${nickname(p.idx)}（電腦）思考中…`;
  const logTitle = remote ? '對方做了什麼' : '電腦做了什麼';
  return `
    <div class="board-viewport">
      <div class="bv-header row between">
        <h1>原地重生・返璞歸真</h1>
        <div class="chip">第 ${G.turn + 1} 輪</div>
      </div>
      <div class="bv-versus">
        ${versusStrip()}
        <div class="card-box light-frame center">
          <div>${tribeBadge(p.tribe)} ${whoLabel}</div>
          <div class="muted">剩餘行動點數：${p.actionPoints}｜手牌 ${p.hand.length} 張${remote ? '｜請等待對方行動' : ''}</div>
        </div>
      </div>
      <div class="bv-resources card-box light-frame">
        <h3>公共區</h3>
        <div class="row">
          <span class="chip"><img class="card-back-sm" src="${CARDS.cardBacks.raw}" alt="">原料牌庫 ${G.rawDeck.length}</span>
          <span class="chip"><img class="card-back-sm" src="${CARDS.cardBacks.culture}" alt="">文化牌庫 ${G.cultureDeck.length}</span>
          <span class="chip"><img class="card-back-sm" src="${CARDS.cardBacks.building}" alt="">建築牌庫 ${G.buildingDeck.length}</span>
          <span class="chip"><img class="card-back-sm" src="${CARDS.cardBacks.craft}" alt="">工藝池 ${G.craftPool.length}</span>
        </div>
      </div>
      <div class="bv-buildings card-box light-frame">
        <h3 class="bld-centerpiece-title">${tribeBadge(p.tribe)} 家屋進度</h3>
        <div class="bld-centerpiece">${buildingsCenterpiece(p)}</div>
        <div class="row center">${buildingsOtherArea(p)}</div>
      </div>
      <div class="bv-side">
        <div class="other-players">
          ${others.map(pl => `
            <div class="card-box light-frame">
              <div>${tribeBadge(pl.tribe)} ${nickname(pl.idx)}</div>
              <div class="muted">素材共 ${Object.values(pl.materials).reduce((a, b) => a + b, 0)} 枚｜手牌 ${pl.hand.length} 張｜建築 ${pl.buildings.length}｜服飾 ${pl.clothing.length}｜工藝 ${pl.played.filter(c => c.kind === 'craft').length}</div>
            </div>`).join('')}
        </div>
        <h3 class="log-title">${logTitle}</h3>
        <div class="log-box">${G.log.slice(-30).map(l => `<div>${esc(l)}</div>`).join('')}</div>
      </div>
    </div>
  `;
}

// ── end screen ──────────────────────────────────────────
function renderEnd() {
  const scores = finalScores(G);
  const goal = CARDS.buildingsPerTribe;
  // 家屋數量決勝：本族家屋棟數為主、總分為輔（平手才比）
  const ranked = scores.map((s, i) => s).slice().sort(rankCmp);
  const best = ranked[0];
  const winners = scores.filter(s => s.buildingCount === best.buildingCount && s.total === best.total);
  const isWin = s => winners.some(w => w.player === s.player);
  return `
    <section class="end-screen">
      <div class="setup-panel">
        <h2>結算</h2>
        <p class="center muted" style="color:rgba(248,230,190,0.75);">結束原因：${endReasonLabel(G.endTriggeredBy)}｜共 ${G.turn + 1} 輪</p>
        <p class="center muted" style="color:rgba(248,230,190,0.6);font-size:0.85em;">勝負以「本族家屋棟數」決定，平手才比總分</p>
        <div class="winner-banner">
          ${winners.map(w => `
            <div class="winner-card">
              <img src="${CARDS.tribes[G.players[w.player].tribe].img}" alt="">
              <div class="winner-name">${w.tribe} ${nickname(w.player)}</div>
              <div class="winner-score">家屋 ${w.buildingCount}/${goal}</div>
            </div>`).join('')}
        </div>
        <table class="score-table">
          <tr><th>族群</th><th>家屋棟數</th><th>建築分</th><th>文化</th><th>工藝</th><th>服飾</th><th>獎勵</th><th>總分</th></tr>
          ${scores.slice().sort(rankCmp).map(s => `<tr class="${isWin(s) ? 'is-winner' : ''}">
            <td>${s.tribe} ${nickname(s.player)}</td><td><b>${s.buildingCount}/${goal}</b></td><td>${s.buildings}</td><td>${s.culture}</td><td>${s.crafts}</td><td>${s.clothing}</td><td>${s.bonus}</td><td>${s.total}</td>
          </tr>`).join('')}
        </table>
        <div class="center"><button class="primary-start-button" onclick="location.reload()">重新開始</button></div>
      </div>
    </section>`;
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
  else if (m.type === 'netRps') inner = renderNetRps(m);
  else if (m.type === 'tradeRespondNet') inner = renderTradeRespondNet(m);
  else if (m.type === 'netWaiting') inner = `<h3 class="center">${esc(m.text || '等待中…')}</h3><p class="net-waiting">請稍候</p>`;
  else if (m.type === 'netLost') inner = `<h3 class="center">連線中斷</h3>
    <p class="center muted">和對方的連線斷了，可能是對方離開或網路不穩。</p>
    <div class="center"><button class="cta cta-primary" onclick="netCancel()">返回首頁</button></div>`;
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
      <p class="center"><span class="rps-stamp">${G.players[winnerIdx].tribeName} 勝出！</span></p>
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
  if (ui.net) { const target = (ui.net.myIdx + 1) % G.players.length; netRPS('raid', target, (win) => doAction({ type: 'RAID', player: G.currentPlayer, target, result: win })); return; }
  chooseTargetModal('選擇偷襲目標', (targetIdx) => {
    startRPS(G.currentPlayer, targetIdx, (attackerWins) => {
      doAction({ type: 'RAID', player: G.currentPlayer, target: targetIdx, result: attackerWins });
    });
  });
}
function actionSwapBuilding() {
  if (ui.net) { const target = (ui.net.myIdx + 1) % G.players.length; netRPS('swap', target, (win) => doAction({ type: 'SWAP_BUILDING', player: G.currentPlayer, target, result: win })); return; }
  chooseTargetModal('選擇建築互換對象', (targetIdx) => {
    startRPS(G.currentPlayer, targetIdx, (attackerWins) => {
      doAction({ type: 'SWAP_BUILDING', player: G.currentPlayer, target: targetIdx, result: attackerWins });
    });
  }, pl => `${pl.tribeName} ${nickname(pl.idx)}（建築 ${pl.buildings.length} 張）`);
}
function actionForceSwapRaw() {
  const p = currentPlayer();
  if (!p.hand.some(c => c.kind === 'raw')) { alert('你手上沒有原料卡可交換'); return; }
  // 連線版：對方原料卡由發起方盲選，不需對方輸入 → 直接開選卡（跳過選對象，2 人局對象唯一）
  if (ui.net) {
    const targetIdx = (ui.net.myIdx + 1) % G.players.length;
    const t = G.players[targetIdx];
    if (!t.hand.some(c => c.kind === 'raw')) { alert(`${t.tribeName} 手上沒有原料卡可交換`); return; }
    ui.modal = { type: 'forceSwapPick', target: targetIdx, myHandIdx: null, theirHandIdx: null };
    render();
    return;
  }
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
  if (ui.net) { ui.modal = { type: 'tradeOffer', target: (ui.net.myIdx + 1) % G.players.length, give: [], get: [] }; render(); return; }
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
  if (ui.net) {
    netAsk('trade', { give, get }, (resp) => {
      if (resp && resp.accepted) { ui.modal = null; doAction({ type: 'TRADE', player: G.currentPlayer, target, give, get, accepted: true }); }
      else { ui.modal = { type: 'tradeRejected', target, give, get }; render(); }
    }, '等待對方回應交易…');
    return;
  }
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
  const onWin = (win) => doAction(win
    ? { type: 'TRADE', player: G.currentPlayer, target, give, get, forced: true }
    : { type: 'TRADE', player: G.currentPlayer, target, give, get, accepted: false, failedChallenge: true });
  if (ui.net) { netRPS('trade', target, onWin); return; }
  startRPS(G.currentPlayer, target, onWin);
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
function actionDrawMaterial() {
  doAction({ type: 'DRAW_MATERIAL_CARD', player: G.currentPlayer });
  const p = currentPlayer();
  const drawn = p.hand.filter(c => c.kind === 'raw').slice(-1)[0];
  const cards = document.querySelectorAll('.bv-self .hand-card:not(.culture)');
  if (drawn && cards.length) flyDrawnCard('.deck-raw', CARDS.cardBacks.raw, cards[cards.length - 1], drawn);
}
function actionDrawCulture() {
  doAction({ type: 'DRAW_CULTURE_CARD', player: G.currentPlayer });
  const p = currentPlayer();
  const drawn = p.hand.filter(c => c.kind === 'culture').slice(-1)[0];
  const cards = document.querySelectorAll('.bv-self .hand-card.culture');
  if (drawn && cards.length) flyDrawnCard('.deck-culture', CARDS.cardBacks.culture, cards[cards.length - 1], drawn);
}
function actionEndTurn() { doAction({ type: 'END_TURN', player: G.currentPlayer }); }

// ── 連線對戰（PeerJS 點對點，rules-spec A17）─────────────────────────────
// 確定性 lockstep：兩端用同一個 seed 播種 rng，並依序套用完全相同的操作序列，
// 隨機結果（骰子/文化卡偷取/隨機工藝）自然同步，不必傳明碼結果。
const ROOM_PREFIX = 'originrebirth-';
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 去掉易混淆的 I L O 0 1
// ICE：Google STUN + 免費 TURN 中繼。手機行動網路↔家用 wifi 常是不同 NAT，
// 純 STUN 打不通，一定要有 TURN 中繼才連得上（這是「手機連不了」的主因）。
const ICE_CONFIG = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
  ]
};
function makeRoomCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}
const Net = {
  peer: null, conn: null, conns: [], role: null, connected: false,
  reset() {
    try { if (this.conn) this.conn.close(); } catch (e) {}
    try { this.conns.forEach(c => c.close()); } catch (e) {}
    try { if (this.peer) this.peer.destroy(); } catch (e) {}
    this.peer = null; this.conn = null; this.conns = []; this.role = null; this.connected = false;
  },
  host(code, onReady, onConnect, onError) {
    this.role = 'host';
    this.peer = new Peer(ROOM_PREFIX + code, { config: ICE_CONFIG });
    this.peer.on('open', () => onReady(code));
    this.peer.on('connection', (c) => { this.conns.push(c); this.conn = c; this._wire(c, onConnect); });
    this.peer.on('error', (e) => onError(e));
  },
  join(code, onConnect, onError) {
    this.role = 'guest';
    this.peer = new Peer(undefined, { config: ICE_CONFIG });
    this.peer.on('open', () => { this.conn = this.peer.connect(ROOM_PREFIX + code, { reliable: true }); this._wire(this.conn, onConnect); });
    this.peer.on('error', (e) => onError(e));
  },
  _wire(c, onConnect) {
    c.on('open', () => { this.connected = true; onConnect(); });
    c.on('data', (d) => { try { netOnMessage(typeof d === 'string' ? JSON.parse(d) : d, c); } catch (e) {} });
    c.on('close', () => netOnClose());
  },
  send(msg) {
    const payload = JSON.stringify(msg);
    if (this.role === 'host') this.conns.forEach(c => { try { if (c.open) c.send(payload); } catch (e) {} });
    else if (this.conn && this.connected) { try { this.conn.send(payload); } catch (e) {} }
  },
  sendExcept(msg, except) {
    const payload = JSON.stringify(msg);
    this.conns.forEach(c => { if (c !== except) try { if (c.open) c.send(payload); } catch (e) {} });
  },
  sendConn(c, msg) { try { if (c && c.open) c.send(JSON.stringify(msg)); } catch (e) {} }
};

function gotoNetLobby() {
  if (typeof Peer === 'undefined') { showToast('連線元件尚未載入，請稍後再試'); return; }
  ui.netLobby = { status: 'form', name: (ui.setup.names[0] || '').trim(), tribe: null, count: 2, players: [], codeInput: '', roomCode: '', error: '' };
  ui.screen = 'netLobby';
  render();
}
function netCancel() {
  Net.reset();
  ui.net = null; ui.netLobby = null; ui.screen = 'home'; render();
}
function netSetName(v) { if (ui.netLobby) ui.netLobby.name = v; }
function netSetTribe(id) { if (ui.netLobby) { ui.netLobby.tribe = ui.netLobby.tribe === id ? null : id; render(); } }
function netSetCode(v) { if (ui.netLobby) ui.netLobby.codeInput = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); }
function netSetCount(n) { if (ui.netLobby && ui.netLobby.status === 'form') { ui.netLobby.count = Math.max(2, Math.min(4, +n)); render(); } }
function netReadyName() { const L = ui.netLobby; return (L.name || '').trim() || '玩家'; }
function netInviteURL(code) { return location.origin + location.pathname + '?room=' + code; }
function netCopyInvite() {
  const url = netInviteURL(ui.netLobby.roomCode);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(
      () => showToast('已複製邀請連結，貼給對方即可'),
      () => showToast('複製失敗，請長按網址手動複製'));
  } else {
    const el = document.querySelector('.invite-url'); if (el) { el.focus(); el.select(); }
    showToast('請長按上方網址手動複製');
  }
}

function netCreateRoom() {
  const L = ui.netLobby;
  if (!L.tribe) { showToast('請先選擇你的族群'); return; }
  L.name = netReadyName();
  L.count = Math.max(2, Math.min(4, L.count || 2));
  L.players = [{ name: L.name, tribe: L.tribe }];
  const code = makeRoomCode();
  L.status = 'waiting'; L.roomCode = code; L.error = ''; render();
  Net.host(code,
    () => {}, // peer open：房號已就緒（等對方連入）
    () => {}, // onConnect：等對方送 join，見 netOnMessage
    (e) => {
      if (e && e.type === 'unavailable-id') { // 房號撞號，換一個重試
        Net.reset(); const c2 = makeRoomCode(); L.roomCode = c2;
        Net.host(c2, () => {}, () => {}, (e2) => { L.status = 'error'; L.error = '建立房間失敗：' + (e2 && e2.type || e2); render(); });
        render();
      } else { L.status = 'error'; L.error = '建立房間失敗：' + (e && e.type || e); render(); }
    });
}
function netJoinRoom() {
  const L = ui.netLobby;
  if (!L.tribe) { showToast('請先選擇你的族群'); return; }
  if (L.codeInput.length !== 5) { showToast('請輸入 5 碼房號'); return; }
  L.name = netReadyName();
  L.status = 'joining'; L.error = ''; render();
  Net.join(L.codeInput,
    () => { Net.send({ t: 'join', name: L.name, tribe: L.tribe }); }, // 連上就把自己的名字/族群送給房主
    (e) => {
      const msg = (e && e.type === 'peer-unavailable') ? '找不到這個房間，請確認房號' : ('連線失敗：' + (e && e.type || e));
      L.status = 'error'; L.error = msg; render();
    });
}

// 房主收到 guest 的 join：解決族群衝突、決定 seed、通知雙方開局
function netOnMessage(msg, sourceConn) {
  if (!msg || !msg.t) return;
  if (msg.t === 'join' && Net.role === 'host') {
    const L = ui.netLobby;
    L.players = L.players || [{ name: L.name, tribe: L.tribe }];
    if (L.players.length >= L.count) { Net.sendConn(sourceConn, { t: 'roomFull' }); return; }
    // 族群撞號：比對「所有已入座玩家」，自動改派到還沒被選走的族（4 族剛好夠 4 人各一）
    let guestTribe = msg.tribe;
    const taken = new Set(L.players.map(p => p.tribe));
    if (taken.has(guestTribe)) {
      guestTribe = Object.keys(CARDS.tribes).find(id => !taken.has(id)) || guestTribe;
    }
    const guestIdx = L.players.length; // 房主固定 0，其餘依入座順序給穩定座位
    L.players.push({ name: msg.name || `玩家${guestIdx + 1}`, tribe: guestTribe });
    if (sourceConn) sourceConn._playerIdx = guestIdx;
    // 直接告訴這位訪客他的固定座位與最終族群，不再靠名字猜（同名時會誤判）
    Net.sendConn(sourceConn, { t: 'assign', idx: guestIdx, tribe: guestTribe, reassigned: guestTribe !== msg.tribe });
    if (L.players.length < L.count) {
      Net.send({ t: 'lobby', count: L.count, players: L.players }); // 廣播最新入座名單給所有人
      render();
      return;
    }
    const players = L.players;
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    Net.send({ t: 'start', seed, players });
    netStartGame(seed, players, 0);
    return;
  }
  if (msg.t === 'assign' && Net.role === 'guest') {
    if (ui.netLobby) { ui.netLobby.myIdx = msg.idx; ui.netLobby.tribe = msg.tribe; }
    if (msg.reassigned) showToast('你選的族群已被選走，已自動改成別族');
    return;
  }
  if (msg.t === 'lobby' && Net.role === 'guest') {
    if (ui.netLobby) { ui.netLobby.status = 'waitingRoom'; ui.netLobby.players = msg.players; ui.netLobby.count = msg.count; render(); }
    return;
  }
  if (msg.t === 'roomFull' && Net.role === 'guest') {
    if (ui.netLobby) { ui.netLobby.status = 'error'; ui.netLobby.error = '房間人數已滿，無法加入'; render(); }
    return;
  }
  if (msg.t === 'start' && Net.role === 'guest') {
    const myIdx = (typeof ui.netLobby?.myIdx === 'number')
      ? ui.netLobby.myIdx
      : Math.max(1, msg.players.findIndex(p => p.name === ui.netLobby?.name)); // 舊回退：萬一沒收到 assign
    netStartGame(msg.seed, msg.players, myIdx);
    return;
  }
  if (msg.t === 'dice') { netApplyDice(); if (Net.role === 'host') Net.sendExcept(msg, sourceConn); return; }
  if (msg.t === 'act') { doAction(msg.action, true); if (Net.role === 'host') Net.sendExcept(msg, sourceConn); return; }
  // ── A18 雙向互動 ──
  if (msg.t === 'ask') { netShowAsk(msg.askId, msg.kind, msg.data); return; }
  if (msg.t === 'answer') { const cb = netPending[msg.askId]; delete netPending[msg.askId]; if (cb) cb(msg.value); return; }
  if (msg.t === 'rpsStart') { ui.netRps = { kind: msg.kind, role: 'defender', myMove: null, theirMove: null }; ui.modal = { type: 'netRps', phase: 'pick' }; render(); return; }
  if (msg.t === 'rpsMove') { if (ui.netRps && ui.netRps.role === 'attacker') { ui.netRps.theirMove = msg.move; netRpsTryResolve(); } return; }
  if (msg.t === 'rpsResult') { ui.modal = { type: 'netRps', phase: 'reveal', role: 'defender', aMove: msg.aMove, dMove: msg.dMove, result: msg.result }; render(); return; }
  if (msg.t === 'rpsTie') { if (ui.netRps) { ui.netRps.myMove = null; ui.netRps.theirMove = null; } ui.modal = { type: 'netRps', phase: 'pick' }; render(); return; }
}
function netOnClose() {
  if (!ui.net && !ui.netLobby) return;
  Net.connected = false;
  if (ui.screen === 'end') return; // 遊戲已結束就不打擾
  ui.modal = { type: 'netLost' };
  render();
}
function netStartGame(seed, players, myIdx) {
  rng = mulberry32(seed ^ 0x9e3779b9);
  G = initGame(players.length, seed, players.map(p => p.tribe));
  ui.isBot = players.map(() => false);
  ui.nicknames = players.map(p => p.name);
  ui.net = { role: Net.role, myIdx, players };
  ui.netLobby = null;
  ui.modal = null;
  startPlayerTurn(0);
}
// 對手（遠端）擲骰：本地同樣呼叫 rollTurnDice 消耗一次 rng，保持與對方 lockstep 一致
function netApplyDice() {
  rollTurnDice(G, G.currentPlayer, rng);
  render();
}

// ── 連線對戰雙向互動（猜拳／交易回應，rules-spec A18）────────────────────
// 發起方（我方回合）在本地跑互動，需要對方輸入時透過 net 請求；解出最終結果後用
// 一般的 {t:'act'} 廣播套用（雙端同 rng 消耗，結果一致）。
let netAskSeq = 0;
const netPending = {};
function netAsk(kind, data, onAnswer, waitText) {
  const askId = ++netAskSeq;
  netPending[askId] = onAnswer;
  Net.send({ t: 'ask', askId, kind, data });
  ui.modal = { type: 'netWaiting', text: waitText || '等待對方回應…' };
  render();
}
function netShowAsk(askId, kind, data) {
  if (kind === 'trade') { ui.modal = { type: 'tradeRespondNet', askId, give: data.give, get: data.get }; render(); }
}
function netTradeRespond(accepted) {
  const m = ui.modal;
  Net.send({ t: 'answer', askId: m.askId, value: { accepted } });
  ui.modal = { type: 'netWaiting', text: '已回覆，等待對方…' };
  render();
}
function renderTradeRespondNet(m) {
  return `<h3>對方想跟你交易</h3>
    <p>對方要給你：${m.give.join('、') || '（無）'}</p>
    <p>對方想跟你換：${m.get.join('、') || '（無）'}</p>
    <div class="row">
      <button class="danger" onclick="netTradeRespond(false)">拒絕</button>
      <button class="primary" onclick="netTradeRespond(true)">接受</button>
    </div>`;
}

// 猜拳（發起方＝我方回合，對方＝守方）：守方出拳送回攻方判定 → 兩邊看揭曉 → 套用
function netRPS(kind, targetIdx, onResult) {
  ui.netRps = { kind, role: 'attacker', targetIdx, myMove: null, theirMove: null, onResult };
  ui.modal = { type: 'netRps', phase: 'pick' };
  Net.send({ t: 'rpsStart', kind });
  render();
}
function netRpsPick(move) {
  const r = ui.netRps;
  if (!r || r.myMove != null) return;
  r.myMove = move;
  ui.modal = { type: 'netRps', phase: 'wait' };
  render();
  if (r.role === 'defender') { Net.send({ t: 'rpsMove', move }); return; }
  netRpsTryResolve();
}
function netRpsTryResolve() {
  const r = ui.netRps;
  if (!r || r.role !== 'attacker' || r.myMove == null || r.theirMove == null) return;
  const result = resolveRPSMoves(r.myMove, r.theirMove);
  if (result === null) { // 平手，雙方重猜
    Net.send({ t: 'rpsTie' });
    r.myMove = null; r.theirMove = null;
    ui.modal = { type: 'netRps', phase: 'pick' };
    render();
    return;
  }
  Net.send({ t: 'rpsResult', aMove: r.myMove, dMove: r.theirMove, result });
  ui.modal = { type: 'netRps', phase: 'reveal', role: 'attacker', aMove: r.myMove, dMove: r.theirMove, result };
  render();
  const onResult = r.onResult;
  setTimeout(() => { ui.netRps = null; onResult(result); }, 1600); // → doAction（套用＋廣播 {t:'act'}）
}
const NET_RPS_KIND_TXT = { raid: '偷襲', swap: '建築互換', trade: '交易搶' };
function netRpsButtons() {
  return `<div class="row center">
    <button class="rps-btn" onclick="netRpsPick(0)">${rpsIcon(0)}石頭</button>
    <button class="rps-btn" onclick="netRpsPick(1)">${rpsIcon(1)}布</button>
    <button class="rps-btn" onclick="netRpsPick(2)">${rpsIcon(2)}剪刀</button>
  </div>`;
}
function renderNetRps(m) {
  if (m.phase === 'pick') {
    const r = ui.netRps || {};
    const txt = NET_RPS_KIND_TXT[r.kind] || '猜拳';
    const title = r.role === 'attacker' ? `你發動${txt}，請出拳！` : `對方發動${txt}，請出拳！`;
    return `<h3 class="center">${title}</h3>${netRpsButtons()}`;
  }
  if (m.phase === 'wait') return `<h3 class="center">已出拳，等待對方…</h3><p class="net-waiting">請稍候</p>`;
  if (m.phase === 'reveal') {
    const myMove = m.role === 'attacker' ? m.aMove : m.dMove;
    const oppMove = m.role === 'attacker' ? m.dMove : m.aMove;
    const iWin = m.role === 'attacker' ? m.result : !m.result;
    return `<h3 class="center">猜拳結果</h3>
      <p class="center">你出「${RPS_LABELS[myMove]}」　對方出「${RPS_LABELS[oppMove]}」</p>
      <p class="center"><span class="rps-stamp">${iWin ? '你贏了！' : '你輸了…'}</span></p>`;
  }
  return '';
}

// 大廳入座名單：依人數畫出已入座玩家＋尚空的座位
function netRosterHTML(players, count) {
  const total = Math.max(count || 0, (players || []).length);
  let seats = '';
  for (let i = 0; i < total; i++) {
    const p = (players || [])[i];
    if (p) {
      const t = CARDS.tribes[p.tribe];
      seats += `<li class="net-seat filled">${t ? `<img src="${t.img}" alt="">` : ''}<span>${esc(p.name)}</span><em>${t ? esc(t.name) : ''}</em>${i === 0 ? '<b class="net-seat-host">房主</b>' : ''}</li>`;
    } else {
      seats += `<li class="net-seat empty"><span>等待加入…</span></li>`;
    }
  }
  return `<ul class="net-roster">${seats}</ul>`;
}
function renderNetLobby() {
  const L = ui.netLobby;
  const tribes = Object.entries(CARDS.tribes);
  const picker = `
    <div class="net-tribe-row">
      ${tribes.map(([id, t]) => `<button class="tribe-pick${L.tribe === id ? ' is-active' : ''}" onclick="netSetTribe('${id}')" title="${t.name}"><img src="${t.img}" alt="${t.name}"><span>${t.name}</span></button>`).join('')}
    </div>`;
  let body;
  if (L.status === 'waiting') {
    const players = L.players || [{ name: L.name, tribe: L.tribe }];
    body = `
      <h3>房間已建立</h3>
      <p class="muted">把邀請連結傳給對方，他點開就能直接加入：</p>
      <input class="invite-url" type="text" readonly value="${esc(netInviteURL(L.roomCode))}" onclick="this.select()">
      <div class="center"><button class="primary" onclick="netCopyInvite()">複製邀請連結</button></div>
      <p class="muted" style="margin-top:14px;">或口頭告訴對方房號：</p>
      <div class="room-code">${L.roomCode}</div>
      ${netRosterHTML(players, L.count)}
      <p class="net-waiting">等待玩家加入…（${players.length} / ${L.count}）</p>`;
  } else if (L.status === 'waitingRoom') {
    const players = L.players || [];
    const total = L.count || players.length;
    body = `
      <h3>已加入房間 ${esc(L.codeInput || '')}</h3>
      ${netRosterHTML(players, total)}
      <p class="net-waiting">等待房主湊滿人數開始…（${players.length} / ${total}）</p>`;
  } else if (L.status === 'joining') {
    body = `<h3>加入房間中…</h3><p class="net-waiting">正在連線到 ${L.codeInput}…</p>`;
  } else if (L.status === 'error') {
    body = `<h3>連線發生問題</h3><p class="net-error">${esc(L.error)}</p>
      <div class="center"><button class="primary" onclick="gotoNetLobby()">重新開始</button></div>`;
  } else {
    body = `
      ${L.invited ? `<p class="net-invited">有人邀請你加入房間 <b>${esc(L.codeInput)}</b>！填好名字、選好族群就能加入。</p>` : ''}
      <label class="name-field">
        <span class="name-field-label">你的名字</span>
        <input type="text" value="${esc(L.name)}" placeholder="輸入你的名字" maxlength="12" oninput="netSetName(this.value)">
      </label>
      <div class="net-section-label">遊戲人數</div>
      <div class="net-player-count">${[2,3,4].map(n => `<button class="option-button${(L.count || 2) === n ? ' is-active' : ''}" onclick="netSetCount(${n})">${n} 人</button>`).join('')}</div>
      <div class="net-section-label">選擇你的族群</div>
      ${picker}
      <div class="net-actions">
        <div class="net-join-box">
          <input class="room-code-input" type="text" value="${esc(L.codeInput)}" placeholder="房號" maxlength="5" oninput="netSetCode(this.value)">
          <button class="${L.invited ? 'primary-start-button' : 'secondary-lore-button'}" onclick="netJoinRoom()">加入房間</button>
        </div>
        <div class="net-or">或</div>
        <div class="net-host-box">
          <button class="${L.invited ? 'secondary-lore-button' : 'primary-start-button'}" onclick="netCreateRoom()">建立房間</button>
          <p class="muted">當房主，產生邀請連結給朋友</p>
        </div>
      </div>`;
  }
  return `
    <section class="setup-screen">
      <div class="setup-panel net-lobby-panel">
        <h2>連線對戰</h2>
        ${body}
        <div class="center" style="margin-top:16px;"><button class="secondary-lore-button" onclick="netCancel()">返回首頁</button></div>
      </div>
    </section>`;
}

Object.assign(window, {
  gotoSetup, gotoStory, gotoHome, diceRoll, diceDone,
  setCount, setName, pickTribe, startGame,
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
  actionEndTurn,
  startTutorial, tutorialNext, tutorialPrev, closeTutorial,
  homeCarouselPrev, homeCarouselNext, homeCarouselSelect, homeStartWithTribe, comingSoonToast, toggleHomeNav,
  gotoNetLobby, netCancel, netSetName, netSetTribe, netSetCode, netSetCount, netCreateRoom, netJoinRoom, netCopyInvite,
  netRpsPick, netTradeRespond
});

// 有人用邀請連結（?room=CODE）點進來 → 直接開連線大廳並帶入房號、highlight 加入
(function initFromInviteURL() {
  try {
    const params = new URLSearchParams(location.search);
    const room = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (room && typeof Peer !== 'undefined') {
      ui.netLobby = { status: 'form', name: '', tribe: null, count: 2, codeInput: room, roomCode: '', error: '', invited: true };
      ui.screen = 'netLobby';
      history.replaceState(null, '', location.pathname); // 清掉網址參數，避免重整又觸發
    }
  } catch (e) {}
})();

render();
