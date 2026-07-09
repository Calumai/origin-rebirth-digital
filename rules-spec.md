# 《原地重生・返璞歸真》數位化 — 規則決議追加紀錄

> 本檔案延續交接文件《原地重生_Kacaw交接文件.md》§3 rules-spec。
> 交接文件中的假設 A1~A8 維持不變，請以交接文件為準；本檔只記錄**交接後新產生**的決議。

## A9：Hot-seat 版猜拳判定方式（2026-07-08 JJ 決議）

**背景**：M1 引擎的 `RAID`（偷襲）與 `SWAP_BUILDING`（建築互換）內部用 RNG（`rpsDuel(rng)`）直接判定勝負，沒有真正接收雙方出拳。但 §6 M2 規格寫「猜拳（剪刀石頭布三鍵）」，暗示真人應該真的出拳決勝負。此為交接文件未載明的模糊處，已依 §4 流程整理選項請 JJ 決議。

**決議**：Hot-seat（M2）版猜拳採**真人各自出拳**，非動畫包裝的 RNG。

**實作方式**（`game-engine/actions.js`）：
- 新增 `resolveRPSMoves(moveA, moveB)`：純函式，0=石頭 1=布 2=剪刀，回傳 `true`=A 勝／`false`=B 勝／`null`=平手（沿用 A6「平手重猜」，由 UI 端重新收兩次輸入）。
- `RAID`、`SWAP_BUILDING` 內部改用 `resolveDuel(state, a, rng)`：若呼叫時的 action 帶有 `a.result`（boolean，由 UI 用 `resolveRPSMoves` 算好後傳入）就直接採用；**未帶 `result` 時**（即 Bot／`simulate.js` 自動對局路徑）完全不變，仍呼叫原本的 `rpsDuel(rng)`。
- 因此 M1 已驗收的 `node simulate.js 100`（100/100 完賽、平均 15.3 輪/局）之結果**完全不受影響**（已重跑驗證，seed 對應輸出逐字相同）。M3 Bot 對真人的偷襲/建築互換，也建議延續此 RNG 路徑（Bot 沒有「手」可以出拳）。

**引擎介面**（供 UI Builder 使用）：
```js
const { applyAction, resolveRPSMoves } = require('./game-engine/actions');

// hot-seat UI 收集雙方出拳後：
const result = resolveRPSMoves(attackerMove, defenderMove); // true/false/null
if (result === null) {
  // 平手 → 畫面提示重猜，重新收兩次輸入，不呼叫 applyAction
} else {
  applyAction(state, { type: 'RAID', player, target, result }, rng);
  // SWAP_BUILDING 同理，帶 result 欄位
}
```

## A10：正式美術上線，修正傳說文化卡分數 2→3 分（2026-07-09，依實體卡面證據）

**背景**：交接文件 §1 提到本機資料夾 `好心睡美人-20260708T093255Z-3-001/` 其實是本遊戲的正式規則書（.docx）與正式卡面美術掃描（見記憶 `official_rulebook_and_art_location`），非無關檔案。已將全部 96 張卡面圖片（族群卡4、素材幣4、工藝/原料/食物卡16、傳說文化卡16、服飾卡16、卡背7、加上部分重複統計）比對確認並整理進 `assets/` 目錄，取代 SVG 佔位圖：
- `assets/materials/`（4 種素材幣）、`assets/tribes/`（4 張族群卡）
- `assets/craft/`（4 張工藝卡）、`assets/raw/`（8 張原料卡）、`assets/food/`（4 張食物文化卡）
- `assets/myth/`（16 張傳說文化卡，檔名為卡片短名如 `amis.png`、`thao.png`）
- `assets/clothing/`（16 張服飾卡，檔名 `{族}_{male|female}_{head|body}.png`）
- `assets/backs/`（7 種卡背）

**發現的分數差異**：實體傳說文化卡（16 張，`myth_*`）卡面分數徽章一律顯示 **3 分**，而非交接文件 §3.1「文化卡 2」與 `cards.js` 原先假設的 2 分；食物文化卡（`food_*`）卡面則確實是 2 分，與原假設一致。已依卡面實證直接修正 `cards.js` 中 16 張 `myth_*` 卡的 `score` 為 3（食物卡維持 2 分不變）。`node simulate.js 100` 已重跑驗證 100/100 完賽、輪數分布不變，僅平均勝者分數因此從 43.4 上升至 49.0（純數值變化，非規則邏輯改變）。

**技術實作**：`cards.js` 為圖片路徑與素材幣圖的唯一資料來源（`img` 欄位 / `materialImages` / `clothing.images` / `cardBacks`）；`state.js` 建立牌庫實例時需把 `img` 欄位一併帶入（原本 raw、craft 卡實例化時遺漏了這欄位，已修正，clothing 用 spread 語法故原本就正常）。

## A11：擲骰決定行動點數（2026-07-09 JJ 決議，數位版新規則）

**背景**：JJ 希望增加互動感，拍板「改規則：擲骰決定行動」。此為**數位版獨有**規則，與實體規則書（固定 3 點）不同。

**決議內容**：每回合開始擲一顆六面骰：**1~2 點=2 行動點、3~4 點=3 行動點、5~6 點=4 行動點**。期望值 3 點與原規則相同，平衡偏移最小。「整回合拿素材」仍可選（放棄擲出的行動點）。

**實作**：`actions.js` 新增 `rollTurnDice(state, playerIdx, rng, die?)`（設定 `actionPoints` 與 `turnStartAP`、寫入 log）；`bot.js` 的回合開始判斷由寫死 `actionPoints === 3` 改為 `=== turnStartAP`；UI 真人回合亮牌後跳擲骰動畫，電腦自動擲並記錄於 log。

**平衡驗證**：`node simulate.js 300` → 300/300 完賽、平均輪數 15.4（原 15.3）、平均勝者分數 47.6（原 49.0），無顯著偏移。

## A12：強制交換原料卡可自選卡片（2026-07-09 JJ 指示）

**背景**：JJ 指示「強置換素材要給玩家選可以換什麼素材」。原本 `FORCE_SWAP_RAW` 引擎自動各取雙方第一張原料卡交換，玩家沒有選擇權。

**決議**：hot-seat 版發起強制交換時，發起方可**自選要給出哪一張、以及要向對方換得哪一張原料卡**。

**實作**：`actions.js` `FORCE_SWAP_RAW` 新增可選參數 `myHandIdx`／`theirHandIdx`（手牌索引），UI 帶入；**未帶時**（Bot／`simulate.js`）沿用原本「各取第一張原料卡」路徑，故 M1／A11 壓測結果不受影響（已重跑 `node simulate.js 300` 驗證）。UI 端 `actionForceSwapRaw` 依序：選對象 → 開啟選卡 modal（左：自己要給出的原料卡；右：對方要換得的原料卡）→ 確認。

**隱私取捨（2026-07-09 JJ 拍板）**：不公開對方手牌。發起方可自選要給出哪張（看得到自己的卡面），但對方的原料卡以**卡背＋編號盲選**呈現，翻牌後才知道換到什麼——保留隱藏資訊。

## A13：交易被拒可猜拳搶（2026-07-09 JJ 決議，數位版新規則）

**背景**：JJ 希望交易被拒時多一層互動。拍板「改規則：談不攏就猜拳」。此為**數位版獨有**規則，與實體規則書不同（實體交易對方可自由拒絕、無猜拳搶）。

**決議內容**：發起方提交易 → 對方可接受或拒絕；**若被拒，發起方可發起猜拳搶**：猜拳勝＝強制成交（對方須真的持有被換素材，否則交易失敗），敗＝交易告吹。整筆交易仍只花 1 行動點（不因猜拳額外收點）。對方無被換素材時不提供猜拳選項。

**實作**：`actions.js` `TRADE` 新增 `forced`／`failedChallenge` 參數：`accepted || forced` 才成交，`forced` 時 log「猜拳勝，強制成交」；素材不足改為 log 失敗而非丟例外（容錯）。UI：`tradeRespondDecide(false)`／電腦拒絕 → `tradeRejected` modal → 「剪刀石頭布！」走 `startRPS`（沿用 A9 真人出拳／對電腦隨機），勝帶 `forced:true`、敗帶 `failedChallenge:true`。Bot/`simulate.js` 不產生 TRADE 動作，既有驗收不受影響。

## A14：族群改玩家自選，取消抽卡畫面（2026-07-09 JJ 決議）

**背景**：JJ 指示「一開始就點選卡片選族群就好了，不要麻煩了」。M1 引擎原本用 `shuffle(rng)` 隨機抽取族群，M2 UI 再包一層逐位揭曉的抽卡畫面，兩層都不是玩家自己選。

**平衡分析（game-designer 角度）**：查 `cards.js` 四族盛產設定——每族都盛產「4 種素材中的 3 種」，缺哪 1 種而已（邵族／賽德克族缺石頭、噶瑪蘭族缺木頭、拉阿魯哇族缺竹子；邵族與賽德克族甚至完全相同）。**資源面完全對稱**，改成玩家自選不會產生強弱失衡，純屬體驗選擇，可直接執行不需額外平衡機制。

**決議內容**：
- 取消獨立的「抽族群卡」畫面，**合併進設定玩家畫面**：每個真人玩家在自己那一列直接點卡選族群，選走的族群會從其他玩家可選清單中移除（再點一次可取消重選）。
- 電腦玩家不手動選，**開始遊戲時從剩餘族群中隨機分配**（沿用 seed 對應的 rng，非另開亂數源）。
- 所有真人玩家都選完才能按「開始遊戲」，否則按鈕停用並提示。

**實作**：`state.js` `initGame(playerCount, seed, chosenTribeIds?)` 新增可選第三參數；**未帶時**（Bot／`simulate.js` 自動對局路徑）完全沿用原本 `shuffle` 隨機抽取，既有壓測結果不受影響。`app.js` `renderSetup` 加入 `.tribe-pick-row`，`startGame()` 取代原本 `startDraw()`／`renderDraw()`／`revealNext()`／`beginGame()` 整組抽卡流程，計算完 `tribeIds`（真人已選 ＋ 電腦隨機分配剩餘）後直接呼叫 `initGame` 並開局。

## A15：新手互動教學（2026-07-09 JJ 決議，數位版新增功能）

**背景**：JJ 指出小孩玩家不會知道怎麼玩，要求加新手引導，指定「互動式引導」（點這邊看到那邊發生什麼，而非純圖文說明或不做開場教學）。

**決議內容**：第一位玩家（永遠是真人）第一次擲完骰進入對局畫面時，自動觸發 5 步互動教學，直接對**真實畫面元件**發光框強調＋提示框說明（不是另開一個獨立教學畫面），依序：行動點數 → 我的素材 → 行動選單 → 建築（獲勝條件）→ 結束回合。每步可「上一步／下一步／跳過教學」，玩家仍可自由點擊畫面上任何東西（教學不封鎖操作）。board 畫面右上角保留「怎麼玩？」按鈕可隨時手動重新開啟。

**2026-07-09 修正**：原本用 `localStorage` 記住「已看過」，看過一次後之後開新局就不會再自動跳出——JJ 反應「教學怎麼不見了」，改為**每次開新局都自動觸發**（不記憶跳過狀態），因為使用族群是小孩，換一批玩／同一人玩多局都可能需要重新提醒，不記憶更符合實際使用情境。

**實作**：`app.js` 新增 `TUTORIAL_STEPS`（含 target class／標題／說明文字）、`positionTutorial()`（每次 `render()` 後執行，用 `getBoundingClientRect` 動態定位提示框並替目標元件加 `.tutorial-highlight` 發光動畫）。目標元件用固定 class 標記（`tut-ap`／`tut-materials`／`tut-actions`／`tut-buildings`／`tut-endturn`），純加法式標記，不影響原有邏輯或 Bot 路徑。

## 待補（尚未決議，暫依交接文件假設開發，不擋 M2 進度）
- 交接文件 §8「待 JJ 提供」項目：族語會話內容（部落戰爭 P.29–P.44，規則書已再次確認此頁碼範圍）、正式族語會話大字體排版。
- 建築卡各卡實際分數：正式素材裡沒有找到建築卡卡面圖或分數資料，暫沿用假設 A3 一律 3 分，待 JJ 提供。
