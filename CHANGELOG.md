# 修改紀錄

所有日期使用 Asia/Taipei。已完成狀態以 docs/05_TASKS.md 為準；尚未取得的文化審校與商用授權不得寫成完成。

## 2026-07-17

### 專案與文件

- 建立獨立工作副本 C:/Users/asd81/Documents/CalumAi/GAME2改版。
- 唯讀來源 C:/Users/asd81/Documents/Claude/04-game2 保持不修改。
- 建立並同步 AGENTS.md、ARCHITECTURE.md、TESTING.md、CHANGELOG.md 與 docs/01 至 docs/08。

### UI 與視覺

- index.html 加入新版 metadata、可縮放 viewport、remaster.css 與 hero-remaster.webp 預載。
- 新增 remaster.css，建立深森林／煙黑底、琥珀主強調色、響應式版面、可見焦點與 reduced-motion 規則。
- 新增 assets/ui/hero-remaster.png 作為高畫質來源，並產生 162,678-byte 的 WebP 發布版供頁面載入。
- app.js 重做首頁資訊架構、族群選擇、核心玩法與主要 CTA。
- app.js 重做玩法與文化頁，呈現遊戲循環、文化責任與族群資源特色。
- app.js 重做設定頁，整合玩家名稱、人數、族群與 Bot 配置。
- app.js 重整盤面資訊層級、事件／目標圖示、手牌卡片、Modal 與結算畫面。

### 互動與無障礙

- 原料及文化手牌改為 button，可使用鍵盤操作。
- Modal 補上 Tab／Shift+Tab 焦點循環、Escape 行為與關閉後焦點還原。
- 畫面切換補上 scroll reset，避免從長頁面進入下一畫面時保留舊捲動位置。
- 聲音切換由 emoji 改為可讀的 ON／OFF；選族改用不綁定族群的中性確認音。
- 強制換牌、連線人數／族群、房號與交易移除控制補上鍵盤及 ARIA 語意。
- 移除 viewport 的最大縮放限制。

### 開發工具

- serve.js 補齊 HTML、CSS、JavaScript、JSON、JPG、PNG、WebP、SVG 等 MIME。
- serve.js 在預設 3000 埠被占用時，會自動嘗試 3001 至 3020，避免 EADDRINUSE 直接終止。
- package.json 新增 start、check、test 指令，保留 simulate。

### 驗證

- npm.cmd test 通過，Exit code 0。
- 100 場遊戲模擬 100/100 完成。
- 桌面 1440×900 手動瀏覽器驗收通過。
- 手機 390×844 手動瀏覽器驗收通過。

### 回合事件與玩家互動

- 公共事件由 6 張擴為 14 張，新增交流市集、互助工班、共學之夜、天候放晴、雨勢觀察、材料試驗、工藝共學與聚落修繕。
- 新增「分享素材」：支付 1 行動點把盈餘素材交給另一位玩家，雙方互記夥伴並取得有上限的互助分。
- 新增「共學交流」：雙方各抽一張文化卡；共學事件下首次使用可退回行動點。
- Bot 會依素材盈餘、他人缺口與事件情境使用兩種正向互動。
- 結算新增互助分欄，最高 5 分；家屋數優先的勝負主軸不變。

### 擲骰動態

- 擲骰改為 ready → launch → rolling → result 狀態機，加入出手、翻滾、影子、碰撞圈與落定回饋。
- 動態假點數只更新骰面，不再每 90ms 重建完整 Modal。
- 加入階段鎖，快速雙擊只會產生一次正式骰值與一筆紀錄。
- reduced-motion 會快速進入正式結果，不播放大幅翻滾或保留無動畫等待。

### STEAM 教育

- 新增 steam-lessons.js，支援國小 1–2、3–4、5–6、國中、高中五學段。
- 提供雨水與屋頂、風與穩定、熱與通風、材料性質、氣候韌性五種主題。
- 每份教案含可重現 seed、卡牌錨點、核心提問、STEAM 任務、精確時間軸、材料、角色、評量、差異化與來源。
- 新增 STEAM 教學任務台，可切換學段／主題、換一份、列印並將建築卡帶入遊戲設定。
- 教案固定區分遊戲卡面、學生假設、官方資料與文化待審內容，不以模型結果推論特定族群事實。

### 擴充驗證

- 新增 steam-lessons.test.js：5 學段 × 5 主題 × 20 seeds，共 500 份教案全部通過。
- 新增 game-engine/interaction.test.js：14 張事件、分享、共學、事件加成與互助分上限全部通過。
- 100 場模擬為 100/100；平均 12.5 輪，範圍 3–25 輪，無死循環。
- 瀏覽器實測快速連點擲骰、分享素材、共學交流、桌機／手機無水平溢位，Console 0 error／warning。

### 尚未完成

- 各族文化顧問逐族審校。
- 文化內容與素材來源、權利及商用授權確認。
- 真機多瀏覽器、雙裝置 PeerJS 與弱網測試。
- 真機效能量測、資產壓縮與正式發布前商業 QA。
