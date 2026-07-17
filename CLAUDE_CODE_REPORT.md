# 給 Claude Code 的版本交接報告

## 背景

使用者要把 `C:\Users\asd81\Documents\CalumAi\GAME2改版` 換成 Codex 目前完成的版本。原始來源 `C:\Users\asd81\Documents\Claude\04-game2` 不應被修改。

## 本次最新修改

1. 抽卡牌庫已移到中央檯面常駐顯示。
   - 檔案：`app.js`
   - 原料牌庫、文化牌庫不需要打開行動選單即可點擊。
   - 可抽時會直接抽卡。
   - 不可抽時仍可點擊，並顯示原因，例如「行動點數不足」或「牌庫已空」。

2. 抽卡防呆集中到抽卡函式內。
   - 檔案：`app.js`
   - `actionDrawMaterial()` 和 `actionDrawCulture()` 會先呼叫 `drawBlockedReason()`。
   - 這樣桌面牌庫、手牌空狀態、行動選單或未來快捷鍵都會得到一致的失敗原因。

3. 桌面牌庫的不可用狀態已調整視覺。
   - 檔案：`remaster.css`
   - 不可抽時仍保留可點擊游標與提示狀態，不再是完全 disabled 的死按鈕。

4. 背景音樂已移除。
   - 檔案：`audio.js`
   - `Sound.scene()` 保留 API 相容，但只記錄場景、不再播放循環音樂。
   - `Sound.startAmbient()` 保留 API 相容，但不再啟動背景音樂。
   - 第一次點擊頁面只解鎖短音效，不會自動開始配樂。
   - 聲音預設為 OFF，使用者需要時可手動開啟短音效。

## 已完成的較大版本內容

此版本已包含前一輪 Codex 完成的遊戲改版：

- 回合事件從 6 個擴充到 14 個。
- 新增玩家互助：分享素材、共學交流、互助分數。
- Bot 會使用互助和共學。
- 骰子動畫改為階段式狀態，避免重複擲骰和動畫斷裂。
- 新增 STEAM 教育頁面。
- 可依國小 1-2、3-4、5-6、國中、高中五個程度隨機生成教案。
- 教案會把卡牌、建築、台灣原住民族文化資料、台灣氣候與 STEAM 任務分開標示，避免未審核的文化斷言。

## 驗證結果

已執行：

```powershell
cd "C:\Users\asd81\Documents\CalumAi\GAME2改版"
npm.cmd test
```

結果：

- `node --check app.js audio.js serve.js steam-lessons.js` 通過。
- STEAM 教案測試 500 份通過。
- 事件與互助機制測試通過。
- 100 場模擬全數完賽。
- 平均輪數 12.5，範圍 3 到 25。

瀏覽器實測：

- 本機伺服器跑在 `http://localhost:3002`。
- 進入遊戲後，中央檯面可看到原料牌庫與文化牌庫。
- 擲骰後點原料牌庫，原料牌庫從 40 變 39，行動點從 3 變 2，手牌新增 1 張。
- 行動點不足時，牌庫按鈕會顯示「行動點數不足」。
- 右下角聲音預設為 `OFF / 聲音已關閉`。
- Browser console 無 error / warning。

## Claude Code 接手注意事項

- 不要覆蓋 `C:\Users\asd81\Documents\Claude\04-game2`。
- 主要可接手版本是 `C:\Users\asd81\Documents\CalumAi\GAME2改版`。
- 若要繼續改，先跑 `npm.cmd test`。
- 若要開發預覽，使用：

```powershell
cd "C:\Users\asd81\Documents\CalumAi\GAME2改版"
npm.cmd start
```

- `serve.js` 會從 3000 開始找可用 port；若 3000、3001 被佔用，可能會跑到 3002 或更後面。

## 建議下一步

1. 若要商用展示，請先安排族群文化顧問審查文化卡、建築卡、音效與文案。
2. 若要正式交付給老師使用，請做一輪教案列印版 QA。
3. 若要上架或對外展示，請補版權授權清單與素材來源表。
