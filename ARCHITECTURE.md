# GAME2 改版架構

## 1. 技術型態

本專案是無建置步驟的單頁網頁遊戲，使用 HTML、CSS、原生 JavaScript ES Modules 與 Node.js 靜態伺服器。PeerJS 由 CDN 載入；核心規則集中在 game-engine。

目前載入關係：

    index.html
      ├─ style.css                 原版相容基線
      ├─ remaster.css              改版視覺與響應式覆寫層
      ├─ audio.js                  WebAudio 與 ON／OFF 控制
      ├─ PeerJS CDN                多人連線依賴
      └─ app.js
           ├─ game-engine/state.js
           ├─ game-engine/actions.js
           ├─ game-engine/scoring.js
           ├─ game-engine/bot.js
           ├─ steam-lessons.js
           └─ assets/*

## 2. 主要檔案責任

| 檔案 | 責任 | 本輪改版狀態 |
|---|---|---|
| index.html | Metadata、viewport、樣式與模組載入 | 已加入 remaster.css、hero-remaster.webp 預載與新版頁面描述 |
| style.css | 原版樣式與既有元件相容基線 | 保留，不作為新版視覺主要修改入口 |
| remaster.css | 色彩 token、首頁、玩法、設定、盤面、Modal、RWD、reduced-motion | 新增，為改版主要視覺層 |
| app.js | UI 狀態、畫面 render、互動事件、PeerJS 協調 | 已加入 STEAM 教學任務台、互助行動 UI 與三段式骰子流程 |
| steam-lessons.js | 五學段、五主題、來源狀態與純函式教案產生器 | 同一 seed 可重現，文化主張具安全閘門 |
| audio.js | WebAudio 音效與聲音狀態控制 | 可讀文字 ON／OFF |
| serve.js | 本機靜態檔案服務 | 已補齊文字、JSON 與常用影像 MIME |
| package.json | 開發與驗證指令 | test 會跑語法、500 份教案、互助事件單元測試與 100 場模擬 |
| game-engine/* | 規則、狀態、動作、計分、Bot 與模擬 | 事件擴為 14 張，新增互助分享、共學交流與互助分 |

## 3. 視覺資產

- assets/ui/hero-remaster.webp：首頁實際載入的 162,678-byte 電影感主視覺；PNG 保留為高畫質來源。
- index.html 會預載 hero-remaster.webp，remaster.css 將它用於首頁主視覺氛圍。
- 既有 tribe、card、building、material 等資產仍由 app.js 依遊戲狀態取用。
- 新主視覺不得被視為文化考證資料；任何具體文化元素仍須逐族審校與授權。

## 4. 畫面與資料流

app.js 的 ui.screen 控制主要畫面：

1. home：品牌主視覺、核心玩法、族群選擇與主要 CTA。
2. story：三段核心循環、文化責任說明、可玩族群與虛構世界設定。
3. education：五學段 STEAM 教案產生、來源分層、列印與帶入遊戲。
4. setup：玩家名稱、人數、族群、Bot 配置與開始對局。
5. netLobby：PeerJS 房間、邀請碼、等待與連線狀態。
6. board：共享區、玩家狀態、手牌、行動區、事件與目標。
7. end：排名、互助分、目標、事件分與總分。

畫面切換會重新 render，並將頁面捲動位置重設到頂端，避免從長頁面進入下一畫面時停在錯誤位置。

## 5. 互動與無障礙

- 首頁與設定使用 button 元素承接主要互動。
- 原料與文化手牌可由鍵盤聚焦，Enter／Space 可觸發檢視或操作。
- Modal 開啟時 Tab／Shift+Tab 會在對話框內循環，Escape 可關閉允許關閉的 Modal。
- index.html 不再限制使用者縮放。
- remaster.css 提供可見 focus 樣式、手機版堆疊、觸控尺寸與 prefers-reduced-motion 降動態處理。
- audio.js 顯示 ON／OFF，不以 emoji 單獨承擔狀態資訊。

## 6. 本機執行與驗證

    npm.cmd start
    npm.cmd run check
    npm.cmd test
    npm.cmd run simulate

- start：以 serve.js 啟動靜態伺服器。
- check：檢查 app.js、audio.js、serve.js、steam-lessons.js 語法。
- test：執行語法檢查、500 份固定教案、互助事件單元測試與 100 場遊戲模擬。
- simulate：可單獨執行規則模擬。

## 7. 外部依賴與風險

- PeerJS CDN 與 broker 是多人連線外部依賴；尚未完成雙真機與弱網驗證。
- 文化資料的來源、顧問審校與商用授權尚未完成，現況不是文化或商業發布核准。
- 大型圖片仍需要真機效能量測後決定 WebP／AVIF 與尺寸分級策略。
- 本專案沒有正式 production server、CSP、監控或自動部署設定。

## 8. 修改邊界

- UI 改版優先在 remaster.css 與 app.js 的 render 層完成。
- game-engine 僅在另立規則工作單、補測試並由人類批准後修改。
- 唯讀來源 C:/Users/asd81/Documents/Claude/04-game2 永遠不作為改版寫入目標。
