# Claude 網頁驗收筆記（codex 整理後）

日期：2026-07-10
驗收版本：`625856c`
方式：本機 `node serve.js`（port 3000）跑起頁面，用 DOM / eval / 實際點擊逐項驗證。

## 結論

**codex 整理後的網頁全部接得起來，無斷點、無 console error、無失敗網路請求。**

## 逐項驗證結果

### 導覽與分頁
| 入口 | 行為 | 狀態 |
|------|------|------|
| 首頁 HOME | 族群卡輪播 → 選族群 | ✅ |
| 故事 STORY | 世界觀介紹 + 返回首頁 | ✅ |
| 連線對戰 ONLINE | 人數 / 族群 / 建房 / 加入房間 設定齊全 | ✅ |
| 資料庫・特典・設定 | 跳「敬請期待，此功能尚未推出」toast | ✅ 刻意 placeholder |

### 單機對戰迴圈（完整接續）
選族群 → 設定玩家 → 輸入名字 → 開始遊戲 → 對戰桌 → 擲骰子 → 「骰到 X 點」modal → 開始行動 → 11 個行動鈕全部啟用 → 拿素材開子選單 → 完成後 toast「收取盛產素材各 1」→ 自動輪到 CPU 擲骰。

- 行動鈕在擲骰前正確 disabled、擲骰後啟用（遊戲邏輯，非 bug）
- 「拿素材」為整回合動作，完成後直接換手（正確）
- 空手牌區顯示引導文字「目前沒有手牌，從右側行動選單抽牌」
- 4 張族群圖 `assets/tribes/*.png` 正常載入

### 線上連線（PeerJS）
- 建房前未選族群 → 正確攔截，跳「請先選擇你的族群」（`netCreateRoom` app.js:1535）
- 建房 → 攔截 `Peer` 建構子確認 peer `open` 事件觸發，ID = `originrebirth-<房號>`，**已連上公共 PeerServer 雲端**，無 error
- UI 顯示 5 碼房號 + 複製邀請連結 + 等待對方加入
- 未測：第二玩家實際 join（需雙瀏覽器分頁互連，preview 工具僅控單一分頁）。加入端 `netJoinRoom()` 走同一套 `Net.join` / PeerServer 機制。

### codex 宣稱的「文字看不見」修復 → 確認已修好
自動對比度掃描一度誤報 `.bld-centerpiece-title` 等對比僅 1.05，但實查為**檢查器忽略 CSS 漸層背景**所致 —— 該文字實際疊在父層 `.bv-buildings` 深色 radial-gradient（`rgba(42,47,…)`）上，渲染清晰可讀。修正有效。

## 已知工具限制（非網頁 bug）
`preview_screenshot` 在本頁會 timeout：頁面有 5 個無限動畫（背景飄移、火花、標題光暈、卡牌 idle）+ 7 處 `backdrop-filter` 毛玻璃，合成器抓不到穩定影格。不影響使用者，僅無法自動截圖。若日後要自動化截圖，可在偵測到截圖工具時暫時 `animation-play-state: paused`。

## 後續建議
- 雙人實連測試最實在的方式：部署到 Vercel（https://04-game2-two.vercel.app），兩台裝置/兩瀏覽器各開一次，一邊建房、一邊貼房號加入。

---

# 手機版 RWD 修復（2026-07-10 追加）

在 375px 手機視窗實測，發現並修復三個破版點：

## P0 導覽死路（已修）
- 問題：`@media (max-width:820px)` 把主選單 `.ps5-sidebar` `display:none`，且無替代導覽 → 手機進不了連線對戰／故事。
- 修法：新增漢堡鈕（左上）+ 側滑抽屜（重用既有 `.ps5-sidebar` 標記）+ 半透明遮罩。
  - `app.js`：`renderHome()` 加 `.ps5-nav-toggle` / `.ps5-nav-scrim`；新增 `toggleHomeNav()` 並掛上 window。
  - `style.css`：820px media query 內把側欄改成 `transform: translateX(-104%)` 抽屜、`.nav-open` 滑入；漢堡鈕含 → X 動畫。
  - 注意：桌機進場動畫 `ps5SlideRight`（`both` 填充）會把抽屜停在全開，已用 `animation: none !important` 擋掉。
- 驗證：6 個 nav 項在畫面內，抽屜點「連線對戰」正確導頁。

## P1 對戰桌橫向溢出（已修）
- 根因：`style.css` 尾端「FINAL OVERRIDES」用 `!important` 無條件套桌機三欄 grid（`218px minmax(460px,1fr) 278px`，最小 ~976px），蓋掉既有手機單欄規則 → 整頁溢出 616px。
- 修法：FINAL OVERRIDES 之後補一段 `@media (max-width:860px)`，用 `!important` 把 `.board-viewport` 攤平成單欄（header/versus/buildings/resources/hand/side），並讓 `.mat-dock` `grid-column:1/-1; flex-wrap:wrap; justify-content:center`。
- 驗證：`overflowX:false`、board 單欄、mat-dock 收在畫面內。

## P1 Modal 超出螢幕（已修）
- 問題：`.modal max-width:560px` 無 viewport 上限；board 溢出時 fixed overlay 被撐寬，modal 跟著到 560px。
- 修法：`max-width: min(560px, calc(100vw - 24px))`（防禦性，board 修好後亦保險）。
- 驗證：modal 寬 344、右緣 360 < 376、內容無溢出。

## 桌機回歸（1280px）
漢堡鈕隱藏、側欄常駐 left:18px、board 維持三欄 `218/732/278`、無溢出 → 桌機無回歸。

> 註：preview 的 desktop preset 只有 779px（仍 ≤820 觸發手機規則），測桌機要手動指定 ≥1024px 寬。
