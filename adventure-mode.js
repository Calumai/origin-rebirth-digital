const SAVE_KEY = 'origin-rebirth-adventure-v1';

const PLACES = {
  square: { name: '聚落廣場', icon: '⌂', desc: '尚未完成的家屋，正等待重新亮起燈火。' },
  forest: { name: '森林小徑', icon: '♧', desc: '觀察環境，尋找建屋需要的木材與纖維。' },
  riverside: { name: '河岸', icon: '≈', desc: '沿著水流，尋找適合使用的石材。' }
};

function freshState() {
  return { schemaVersion: 1, screen: 'intro', location: 'square', unlocked: ['square', 'forest'], visited: [], inventory: { wood: 0, fiber: 0, stone: 0, tool: 0 }, quest: 'meet', crafted: false, houseBuilt: false, message: '', updatedAt: Date.now() };
}

let state = load() || freshState();
let exitHandler = null;

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY));
    return parsed?.schemaVersion === 1 ? parsed : null;
  } catch { return null; }
}
function save() { state.updatedAt = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {} }
function esc(v) { return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function objective() { return ({ meet: '和廣場上的引路人談談', collect: '探索森林與河岸，備齊三種材料', craft: '回到廣場製作建屋工具', build: '使用工具重建第一間家屋', complete: '第一間家屋已完成' })[state.quest]; }

function introHtml() {
  const hasSave = !!load();
  return `<main class="adventure-shell adventure-intro"><p class="adventure-eyebrow">方案 C・可玩原型</p><h1>讓聚落重新亮起燈火</h1><p>探索地點、協助角色、蒐集素材並完成第一間家屋。文化專有內容會在來源、授權與審核確認後置換。</p><div class="adventure-actions">${hasSave ? '<button class="adventure-primary" onclick="adventureContinue()">繼續探索</button>' : ''}<button onclick="adventureNew()">${hasSave ? '重新開始' : '開始探索'}</button><button onclick="adventureExit()">返回原版遊戲</button></div></main>`;
}

function inventoryHtml() {
  return [['wood','木材'],['fiber','纖維'],['stone','石材'],['tool','建屋工具']].map(([id,label]) => `<li><span>${label}</span><b>${state.inventory[id]}</b></li>`).join('');
}
function mapHtml() {
  return Object.entries(PLACES).map(([id,p]) => { const unlocked = state.unlocked.includes(id); return `<button class="adventure-place${state.location === id ? ' is-current' : ''}" onclick="adventureGo('${id}')" ${unlocked ? '' : 'disabled'} aria-pressed="${state.location === id}"><span aria-hidden="true">${p.icon}</span><b>${p.name}</b><small>${unlocked ? (state.visited.includes(id) ? '已探索' : '可探索') : '尚未解鎖'}</small></button>`; }).join('');
}
function actionHtml() {
  if (state.location === 'square') {
    if (state.quest === 'meet') return '<button class="adventure-primary" onclick="adventureAct(\'meet\')">和引路人談談</button>';
    if (state.quest === 'craft') return '<button class="adventure-primary" onclick="adventureAct(\'craft\')">製作建屋工具</button>';
    if (state.quest === 'build') return '<button class="adventure-primary" onclick="adventureAct(\'build\')">重建第一間家屋</button>';
    return `<p class="adventure-hint">${state.houseBuilt ? '家屋已重新亮起燈火。' : '依照目前任務探索其他地點。'}</p>`;
  }
  if (state.location === 'forest') return `<button class="adventure-primary" onclick="adventureAct('forest')" ${state.inventory.wood && state.inventory.fiber ? 'disabled' : ''}>觀察並取得足夠材料</button>`;
  return `<button class="adventure-primary" onclick="adventureAct('river')" ${state.inventory.stone ? 'disabled' : ''}>尋找適合的石材</button>`;
}
function gameHtml() {
  const p = PLACES[state.location];
  const progress = state.houseBuilt ? 100 : state.crafted ? 75 : state.quest === 'collect' ? 35 : 10;
  const visual = state.location === 'forest' ? '♧  ♧  ♧' : state.location === 'riverside' ? '≈  ◇  ≈' : state.houseBuilt ? '⌂ ✦' : '⌂ …';
  return `<main class="adventure-shell"><header class="adventure-header"><button onclick="adventureExit()" aria-label="返回原版遊戲">←</button><div><p>目前任務</p><h1>${objective()}</h1></div><button onclick="adventureMenu()">選單</button></header><div class="adventure-progress" aria-label="重建進度"><span style="width:${progress}%"></span></div><div class="adventure-layout"><nav class="adventure-map" aria-label="聚落地圖">${mapHtml()}</nav><section class="adventure-scene"><p class="adventure-eyebrow">${p.name}</p><h2>${state.houseBuilt ? '聚落甦醒' : p.desc}</h2><div class="adventure-visual${state.houseBuilt ? ' is-restored' : ''}" aria-label="${state.houseBuilt ? '完成重建的家屋' : p.desc}"><span aria-hidden="true">${visual}</span></div><p class="adventure-feedback" aria-live="polite">${esc(state.message || '每一次選擇，都會改變聚落的樣子。')}</p>${actionHtml()}${state.houseBuilt ? '<div class="adventure-ending"><h3>垂直切片完成</h3><p>你完成了第一個探索、製作與重建循環。</p><button onclick="adventureNew()">再玩一次</button></div>' : ''}</section><aside class="adventure-inventory"><h2>背包</h2><ul>${inventoryHtml()}</ul><p>重要進度會自動保存</p></aside></div></main>`;
}

export function startAdventure(onExit) { exitHandler = onExit; renderAdventure(); }
export function renderAdventure() { const app = document.getElementById('app'); if (app) app.innerHTML = state.screen === 'intro' ? introHtml() : gameHtml(); }
function finishCollectionIfReady() { if (state.quest === 'collect' && state.inventory.wood && state.inventory.fiber && state.inventory.stone) { state.quest = 'craft'; state.location = 'square'; state.message = '材料已備齊。回到廣場製作建屋工具。'; } }
function adventureGo(id) { if (!state.unlocked.includes(id)) return; state.location = id; if (!state.visited.includes(id)) state.visited.push(id); save(); renderAdventure(); }
function adventureAct(action) {
  if (action === 'meet' && state.quest === 'meet') { state.quest = 'collect'; state.unlocked = ['square','forest','riverside']; state.message = '引路人：先仔細觀察環境，再取用剛好足夠的材料。'; }
  else if (action === 'forest' && state.quest === 'collect' && !(state.inventory.wood && state.inventory.fiber)) { state.inventory.wood = 1; state.inventory.fiber = 1; state.message = '你取得一份木材與一束纖維。正式內容將由文化審核後置換。'; }
  else if (action === 'river' && state.quest === 'collect' && !state.inventory.stone) { state.inventory.stone = 1; state.message = '你在河岸找到一份適合使用的石材。'; }
  else if (action === 'craft' && state.quest === 'craft') { state.inventory.wood--; state.inventory.fiber--; state.inventory.stone--; state.inventory.tool = 1; state.crafted = true; state.quest = 'build'; state.message = '建屋工具完成。下一步是讓家屋重新站起來。'; }
  else if (action === 'build' && state.quest === 'build') { state.inventory.tool = 0; state.houseBuilt = true; state.quest = 'complete'; state.message = '第一間家屋完成，聚落重新亮起燈火。'; }
  finishCollectionIfReady(); save(); renderAdventure();
}
function adventureNew() { state = freshState(); state.screen = 'game'; save(); renderAdventure(); }
function adventureContinue() { state = load() || freshState(); state.screen = 'game'; renderAdventure(); }
function adventureMenu() { state.screen = 'intro'; save(); renderAdventure(); }
function adventureExit() { if (exitHandler) exitHandler(); }
Object.assign(window, { adventureGo, adventureAct, adventureNew, adventureContinue, adventureMenu, adventureExit });
