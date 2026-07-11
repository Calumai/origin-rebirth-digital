# Codex × Claude 合作完成紀錄

日期：2026-07-11

## 共同成果

本次不是由單一 AI 重做另一方的成果，而是沿用 Claude 已完成的核心玩法與 HUD 改版，由 Codex 進行完成矩陣、補齊缺口、回歸測試、方案 C 垂直切片與 GitHub 交付。

## Claude 完成

- 公共事件卡 6 張及實際效果。
- 秘密目標 6 張、進度與結算加分。
- seed 決定事件順序與單機／連線 lockstep 資料路徑。
- 分層 HUD 戰場、公共資訊、家屋中心區與寬版手牌。
- 行動面板的初始收合與桌機／手機定位。
- 原版桌遊、Bot 與連線功能整合。

## Codex 完成

- 方案 C「冒險模式 BETA」可玩垂直切片。
- 三地點探索、任務、背包、製作、建屋、結局與版本化本機存檔。
- 行動抽屜剩餘點數、外部點擊關閉、Escape 關閉與 ARIA 狀態。
- 修正 modal 與抽屜層級，確保 modal 不被遮住。
- 實際瀏覽器走完方案 C 流程與刷新存檔驗證。
- 語法、模擬、console 與 GitHub 分支／PR 交付。

## 共同保留的原則

- 不刪除原版桌遊與 2～4 人連線入口。
- 不改既有 action type 與主要 onclick 函式。
- 不把未審核文化內容冒充正式知識。
- 三份原始 Claude 工作單保留作需求來源。

## 測試方式

```powershell
node --check app.js
node --check adventure-mode.js
Get-ChildItem game-engine -Filter *.js | ForEach-Object { node --check $_.FullName }
node game-engine/simulate.js 1000
```

瀏覽器驗證：

1. 原版首頁進入冒險模式並完成探索、蒐集、製作、建屋與結局。
2. 重新整理後繼續存檔。
3. 原版對局展開／收合行動面板。
4. 驗證外部點擊與 Escape 關閉。
5. 開啟 modal，確認層級高於抽屜。
6. 檢查 console error／warning。

## 下一位協作者應先確認

- 正式 MVP 族群。
- 主要玩家年齡。
- 文化內容來源、授權及審核者。
- 部署預覽上的雙瀏覽器連線回歸測試。
