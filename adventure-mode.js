const SAVE_KEY = 'origin-rebirth-adventure-v2';

const TRIBES = {
  thao: { name: '邵族', portrait: 'assets/tribes/thao.png', building: 'assets/buildings/thao.jpg', craft: 'assets/craft/thao_knife.png', craftName: '建屋工具' },
  kavalan: { name: '噶瑪蘭族', portrait: 'assets/tribes/kavalan.png', building: 'assets/buildings/kavalan.jpg', craft: 'assets/craft/kavalan_weave.png', craftName: '建屋工具' },
  hlaalua: { name: '拉阿魯哇族', portrait: 'assets/tribes/hlaalua.png', building: 'assets/buildings/hlaalua.jpg', craft: 'assets/craft/hlaalua_bow.png', craftName: '建屋工具' },
  seediq: { name: '賽德克族', portrait: 'assets/tribes/seediq.png', building: 'assets/buildings/seediq.jpg', craft: 'assets/craft/seediq_basket.png', craftName: '建屋工具' }
};

const PLACES = {
  square: { name: '聚落廣場', kicker: '重建起點', thumb: 'assets/backs/building.png', scene: 'building', desc: '回到家屋前，確認聚落目前最需要完成的事。' },
  forest: { name: '森林小徑', kicker: '素材探索', thumb: 'assets/materials/wood.png', scene: 'assets/ui/hero-home.jpg', desc: '觀察周遭環境，取得這次建造需要的木材與纖維。' },
  riverside: { name: '河岸石灘', kicker: '素材探索', thumb: 'assets/materials/stone.png', scene: 'assets/ui/battlefield-bg.png', desc: '沿著河岸尋找適合使用的石材，完成最後一項準備。' }
};

function freshState(tribe = 'thao') {
  return { schemaVersion: 2, screen: 'intro', tribe, location: 'square', unlocked: ['square', 'forest'], visited: [], inventory: { wood: 0, fiber: 0, stone: 0, tool: 0 }, quest: 'meet', crafted: false, houseBuilt: false, message: '', updatedAt: Date.now() };
}

let preferredTribe = 'thao';
let state = load() || freshState();
let exitHandler = null;

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY));
    return parsed?.schemaVersion === 2 ? parsed : null;
  } catch { return null; }
}
function save() { state.updatedAt = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {} }
function esc(v) { return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function tribe() { return TRIBES[state.tribe] || TRIBES.thao; }
function objective() { return ({ meet: '先與引路人確認重建任務', collect: '前往森林與河岸備齊三種材料', craft: '回到聚落完成建屋工具', build: '使用工具重建第一間家屋', complete: '第一間家屋已重建完成' })[state.quest]; }
function progressValue() { return state.houseBuilt ? 100 : state.crafted ? 75 : state.quest === 'collect' ? 35 : 10; }

function introHtml() {
  const saved = load();
  const t = saved ? TRIBES[saved.tribe] : TRIBES[preferredTribe];
  return `<main class="adventure-shell adventure-intro">
    <div class="adventure-intro-art" style="--adventure-hero:url('${t.building}')"><div class="adventure-intro-shade"></div></div>
    <header class="adventure-intro-nav"><button onclick="adventureExit()">返回原版遊戲</button><img src="${t.portrait}" alt="${t.name}"><span>${t.name}探索篇</span></header>
    <section class="adventure-intro-copy">
      <p class="adventure-kicker">原地重生・返璞歸真</p>
      <h1>讓聚落重新<br>亮起燈火</h1>
      <p>走進聚落周邊，蒐集建造所需材料，完成第一間家屋。每一次行動都會推進場景與任務。</p>
      <div class="adventure-actions">${saved ? '<button class="adventure-primary" onclick="adventureContinue()">繼續探索</button>' : ''}<button onclick="adventureNew()">${saved ? '重新開始' : '開始探索'}</button></div>
    </section>
    <div class="adventure-intro-cards"><article><img src="assets/raw/bark.png" alt="採集素材"><span>探索環境</span></article><article><img src="${t.craft}" alt="${t.craftName}"><span>完成製作</span></article><article><img src="${t.building}" alt="${t.name}家屋"><span>重建聚落</span></article></div>
  </main>`;
}

function inventoryHtml() {
  const t = tribe();
  return [['wood','木材','assets/materials/wood.png'],['fiber','纖維','assets/materials/thatch.png'],['stone','石材','assets/materials/stone.png'],['tool',t.craftName,t.craft]].map(([id,label,img]) => `<li class="${state.inventory[id] ? 'has-item' : ''}"><img src="${img}" alt=""><span>${label}</span><b>${state.inventory[id]}</b></li>`).join('');
}
function mapHtml() {
  const t = tribe();
  return Object.entries(PLACES).map(([id,p]) => {
    const unlocked = state.unlocked.includes(id);
    const thumb = p.scene === 'building' ? t.building : p.thumb;
    return `<button class="adventure-place${state.location === id ? ' is-current' : ''}" onclick="adventureGo('${id}')" ${unlocked ? '' : 'disabled'} aria-pressed="${state.location === id}"><img src="${thumb}" alt=""><span><small>${p.kicker}</small><b>${p.name}</b><em>${unlocked ? (state.visited.includes(id) ? '已探索' : '可探索') : '尚未解鎖'}</em></span></button>`;
  }).join('');
}
function actionHtml() {
  if (state.location === 'square') {
    if (state.quest === 'meet') return '<button class="adventure-primary adventure-cta" onclick="adventureAct(\'meet\')">接受重建任務</button>';
    if (state.quest === 'craft') return '<button class="adventure-primary adventure-cta" onclick="adventureAct(\'craft\')">開始製作建屋工具</button>';
    if (state.quest === 'build') return '<button class="adventure-primary adventure-cta" onclick="adventureAct(\'build\')">完成第一間家屋</button>';
    return `<p class="adventure-hint">${state.houseBuilt ? '家屋已完成，聚落迎來新的燈火。' : '依照目前任務探索其他地點。'}</p>`;
  }
  if (state.location === 'forest') return `<button class="adventure-primary adventure-cta" onclick="adventureAct('forest')" ${state.inventory.wood && state.inventory.fiber ? 'disabled' : ''}>取得木材與纖維</button>`;
  return `<button class="adventure-primary adventure-cta" onclick="adventureAct('river')" ${state.inventory.stone ? 'disabled' : ''}>取得建造石材</button>`;
}
function sceneHtml() {
  const p = PLACES[state.location];
  const t = tribe();
  const scene = p.scene === 'building' ? t.building : p.scene;
  const reward = state.location === 'forest' ? '<div class="adventure-scene-rewards"><img src="assets/materials/wood.png" alt="木材"><img src="assets/materials/thatch.png" alt="纖維"></div>' : state.location === 'riverside' ? '<div class="adventure-scene-rewards"><img src="assets/materials/stone.png" alt="石材"></div>' : `<img class="adventure-guide" src="${t.portrait}" alt="${t.name}引路人">`;
  return `<div class="adventure-scene-art${state.houseBuilt ? ' is-restored' : ''}"><img class="adventure-scene-bg" src="${scene}" alt="${state.houseBuilt ? `完成重建的${t.name}家屋` : p.desc}"><div class="adventure-scene-vignette"></div>${reward}<div class="adventure-scene-caption"><p>${p.kicker}</p><h2>${state.houseBuilt ? '聚落重新亮起燈火' : p.name}</h2><span>${state.houseBuilt ? '第一階段重建完成' : p.desc}</span></div></div>`;
}
function gameHtml() {
  const t = tribe();
  return `<main class="adventure-shell adventure-game">
    <header class="adventure-header"><button onclick="adventureExit()">返回原版</button><div class="adventure-brand"><img src="${t.portrait}" alt="${t.name}"><span><small>${t.name}探索篇</small><b>原地重生・返璞歸真</b></span></div><button onclick="adventureMenu()">旅程選單</button></header>
    <section class="adventure-objective"><span>目前任務</span><h1>${objective()}</h1><div class="adventure-progress" aria-label="重建進度"><i style="width:${progressValue()}%"></i></div><b>${progressValue()}%</b></section>
    <div class="adventure-layout">
      <nav class="adventure-map" aria-label="聚落地圖"><h2>探索地圖</h2>${mapHtml()}</nav>
      <section class="adventure-scene">${sceneHtml()}<div class="adventure-dialogue" aria-live="polite"><img src="${t.portrait}" alt=""><div><small>旅程紀錄</small><p>${esc(state.message || '聚落的重建，從看清眼前最需要完成的事開始。')}</p></div></div>${actionHtml()}${state.houseBuilt ? '<div class="adventure-ending"><span>重建完成</span><h3>第一間家屋已經完成</h3><p>你完成了探索、蒐集、製作與重建的第一段旅程。</p><button onclick="adventureNew()">重新開始旅程</button></div>' : ''}</section>
      <aside class="adventure-inventory"><div class="adventure-inventory-title"><img src="assets/backs/raw.png" alt=""><span><small>隨身物資</small><h2>探索背包</h2></span></div><ul>${inventoryHtml()}</ul><p>重要進度會自動保存</p></aside>
    </div>
  </main>`;
}

export function startAdventure(onExit, tribeId = 'thao') {
  exitHandler = onExit;
  preferredTribe = TRIBES[tribeId] ? tribeId : 'thao';
  const saved = load();
  if (!saved) state = freshState(preferredTribe);
  renderAdventure();
}
export function renderAdventure() { const app = document.getElementById('app'); if (app) app.innerHTML = state.screen === 'intro' ? introHtml() : gameHtml(); }
function finishCollectionIfReady() { if (state.quest === 'collect' && state.inventory.wood && state.inventory.fiber && state.inventory.stone) { state.quest = 'craft'; state.location = 'square'; state.message = '三種材料已備齊。回到聚落廣場，完成建屋工具。'; } }
function adventureGo(id) { if (!state.unlocked.includes(id)) return; state.location = id; if (!state.visited.includes(id)) state.visited.push(id); state.message = ''; save(); renderAdventure(); }
function adventureAct(action) {
  if (action === 'meet' && state.quest === 'meet') { state.quest = 'collect'; state.unlocked = ['square','forest','riverside']; state.message = '任務已更新。前往森林小徑與河岸石灘，備齊建造材料。'; }
  else if (action === 'forest' && state.quest === 'collect' && !(state.inventory.wood && state.inventory.fiber)) { state.inventory.wood = 1; state.inventory.fiber = 1; state.message = '取得木材與纖維。背包已更新，接著前往河岸尋找石材。'; }
  else if (action === 'river' && state.quest === 'collect' && !state.inventory.stone) { state.inventory.stone = 1; state.message = '取得石材。建造所需的三種材料已經備齊。'; }
  else if (action === 'craft' && state.quest === 'craft') { state.inventory.wood--; state.inventory.fiber--; state.inventory.stone--; state.inventory.tool = 1; state.crafted = true; state.quest = 'build'; state.message = '建屋工具已完成。現在可以開始重建第一間家屋。'; }
  else if (action === 'build' && state.quest === 'build') { state.inventory.tool = 0; state.houseBuilt = true; state.quest = 'complete'; state.message = '第一間家屋完成，聚落重新亮起燈火。'; }
  finishCollectionIfReady(); save(); renderAdventure();
}
function adventureNew() { state = freshState(preferredTribe); state.screen = 'game'; save(); renderAdventure(); }
function adventureContinue() { state = load() || freshState(preferredTribe); state.screen = 'game'; save(); renderAdventure(); }
function adventureMenu() { state.screen = 'intro'; save(); renderAdventure(); }
function adventureExit() { if (exitHandler) exitHandler(); }
Object.assign(window, { adventureGo, adventureAct, adventureNew, adventureContinue, adventureMenu, adventureExit });
