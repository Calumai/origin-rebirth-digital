# Claude Code 工作單：將行動面板改成浮動彈出式

## 目標

目前 `.bv-side .action-menu` 直接固定在右側，造成對局畫面被資訊擠壓。

請把它改成「右側浮動行動面板」，平常收合，只在玩家需要時展開。

## 收合狀態

平常畫面右側只顯示一個小型 HUD 按鈕，內容包括：

- 本回合剩餘行動點數，例如「2 件事」
- 行動點數圓點或數字
- 展開圖示，例如 `☰` 或 `«`

收合狀態不可遮住中央戰場、手牌或主要玩家資訊。

## 展開狀態

點擊 HUD 按鈕後，右側滑出完整行動面板，保留目前所有內容：

- 行動點數 tracker
- 回合提示 `turn-hint`
- 秘密目標 `objective-panel`
- 家屋目標 `goal-panel`
- 行動分類標題
- 所有行動按鈕
- 結束回合按鈕

展開面板建議使用：

- `position: fixed` 或位於 board 內的 absolute drawer
- 右側滑入動畫
- 深色半透明 HUD 背景
- 金色邊框和高對比文字
- `z-index` 高於中央戰場，但低於必要的 modal

## 必須保留的行動

以下按鈕與 `onclick` 完全不能刪除或改名：

- `actionTakeMaterialsPrompt()`
- `actionBuyBuilding()`
- `actionDrawMaterial()`
- `actionDrawCulture()`
- 動態工藝配對按鈕
- `actionRaid()`
- `actionTrade()`
- `actionBuyFromPlayer()`
- `actionSwapBuilding()`
- `actionForceSwapRaw()`
- `actionEndTurn()`

連線模式的玩家購卡、交易、偷襲、建築互換也必須保持可用。

## 互動行為

- 點擊右側 HUD 按鈕：展開／收合。
- 點擊面板外部：關閉面板。
- 按 `Escape`：關閉面板。
- 開啟 modal 時，行動面板不可蓋住 modal。
- 行動成功後可以自動收合，或保留目前狀態，但不能阻止下一個操作。
- 行動點數改變時，收合按鈕上的數字要即時更新。

## 手機版

手機版不要從右側硬塞窄面板，改成底部滑出的 bottom sheet：

- 平常只顯示底部「行動 2」按鈕
- 點擊後從底部向上展開
- 面板內按鈕可捲動
- 不可遮住最重要的手牌操作
- 點擊外部或按 Escape 可關閉

## 不可以動的範圍

- 不要修改 `game-engine/*` 規則邏輯。
- 不要改變 action type。
- 不要改變既有函式名稱或 onclick 呼叫。
- 不要移除玩家購卡、交易、偷襲、文化卡、建築互換。
- 不要把面板內容永久 `display:none`，收合時仍要能展開。

## 驗收標準

- [ ] 收合時中央戰場和手牌區明顯變寬、不再被右側欄擠壓。
- [ ] 點擊 HUD 可展開完整行動面板。
- [ ] 10 個主要行動全部保留且可點擊。
- [ ] 玩家購卡在單機和連線模式都可用。
- [ ] 點擊面板外部和 Escape 可以關閉。
- [ ] modal 不會被行動面板蓋住。
- [ ] 手機版使用底部彈出面板，不產生水平捲動。
- [ ] `node --check app.js` 通過。
- [ ] 2、3、4 人連線流程不受影響。

完成後請建立 `CLAUDE_ACTION_DRAWER_NOTE.md`，列出修改檔案、互動行為、測試結果與尚未處理的問題。
