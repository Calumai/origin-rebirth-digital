# 玩法擴充回報：公共事件卡 + 秘密目標（A20）

日期：2026-07-11
規則決議：rules-spec.md「A20」

## 1. 實際修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `game-engine/cards.js` | 新增 `events`（6 張公共事件）、`objectives`（6 張秘密目標，含 `target`）、`objectiveBonus: 5` |
| `game-engine/state.js` | `initGame` 初始化 `eventDeck`（seed 洗牌）、`eventIndex`、`currentEvent`（開局翻第 1 張）、`craftRaceClaimed`；每人依 seed 發 1 張 `objective`；玩家加 `progress{deals,partners}`、`bonusScore`、`_tookMat`/`_interacted` 旗標 |
| `game-engine/actions.js` | 新增 `flipNextEvent`（翻下一張、純索引不消耗 rng）、`recordInteraction`（更新目標進度＋觸發夜間集會）；`rollTurnDice` 重置每回合旗標；6 個事件效果與互動記錄嵌入對應 action |
| `game-engine/scoring.js` | 新增 `objectiveProgress(p)`（回傳 cur/target/done）；`scorePlayer` 加入目標 +5 與事件加分（`eventBonus`），計入 total |
| `game-engine/simulate.js` | 回合輪替呼叫 `flipNextEvent`；verbose 輸出事件與目標進度 |
| `app.js` | `eventBanner()`、`objectivePanel()`、`myPlayer()`；board/botTurn 顯示事件橫幅與自己的秘密目標；`finishTurnAndAdvance` 翻牌＋toast；蓋家屋按鈕/交易按鈕事件感知（家屋加固 -1、山路封閉停用交易）；結算畫面加事件/目標欄＋秘密目標揭曉區 |
| `style.css` | `.event-banner`、`.objective-panel`（`<details>` 可收合）、`.end-objectives` 樣式，沿用暗色卡牌戰場質感 |

## 2. 已完成的事件效果（6/6 全部真的生效，非只顯示文字）

| 事件 | 效果 | 實作位置 |
|------|------|----------|
| 豐收季 | 本回合第一次拿素材 +1 本族盛產 | `TAKE_MATERIALS`（`_tookMat` 旗標） |
| 文化祭典 | 每打出文化卡 +1 分 | `PLAY_CULTURE` → `bonusScore` |
| 山路封閉 | 禁交易（購卡/偷襲/互換仍可） | `TRADE` throw + UI 停用交易鈕 |
| 工藝競賽 | 本回合第一位完成工藝 +2 分 | `PLAY_RAW_PAIR`（`craftRaceClaimed`） |
| 家屋加固 | 蓋家屋行動點 -1（最低 1） | `BUY_BUILDING` 動態 cost + UI 按鈕感知 |
| 夜間集會 | 本回合第一次成功互動抽 1 文化卡 | `recordInteraction`（`_interacted`） |

- 觸發：開局翻第 1 張（`initGame`）；每輪回到第 1 位玩家時 `flipNextEvent`（單機 `finishTurnAndAdvance`、連線同路徑、`simulate` 迴圈）。
- 順序由 seed 決定、純索引推進不消耗 rng → 連線 lockstep 一致（已用 node 驗證同 seed 兩次序列相同）。

## 3. 已完成的秘密目標與計分（6/6）

| 目標 | 達成條件 | 進度來源 |
|------|----------|----------|
| 家屋守護者 | 本族家屋 4 間 | 盤面推得 |
| 文化傳承者 | 打出 3 張文化卡 | 盤面推得（`played` 文化數） |
| 工藝大師 | 完成 2 件不同工藝 | 盤面推得（`played` 工藝 distinct） |
| 部落商人 | 交易或購卡 3 次 | 執行期 `progress.deals` |
| 素材收藏家 | 結束時 3 種素材各 ≥3 | 盤面推得（`materials`） |
| 跨族交流 | 與 2 個不同玩家互動 | 執行期 `progress.partners` |

- 開局依 seed 每人發 1 張（Bot 也有）。完成 +5 分，未完成 0 分，計入 `scorePlayer` 的 total。
- 隱私：秘密目標由 seed 在兩端各自算出（**不進任何網路訊息、不廣播**）；UI 只用 `myPlayer()` 顯示檢視者自己那張，對手回合看到的仍是自己的目標。結算畫面才揭曉全部。

## 4. 尚未完成 / 需要注意的部分

- **無 TODO 假效果**：6 張事件效果全部真的生效。
- **Bot 不主動追目標**：Bot 沿用既有策略（優先蓋家屋），秘密目標只是附帶計分，不會刻意去湊（壓測顯示 Bot 目標多為 0–1 進度）。若要 Bot 針對目標決策，需另開工作單調 `bot.js`（本次不做，符合「不重做整個戰鬥系統」）。
- **SWAP_BUILDING 語意**：沿用 A19，對方一律本族建築 → 猜拳勝＝搶對方一棟（破壞）；此次僅在其成功時補記 `recordInteraction`（跨族交流/夜間集會）。

## 5. 測試結果與指令輸出摘要

```
node --check app.js                    → OK（無語法錯）
node --check game-engine/*.js          → 全部 OK
node game-engine/simulate.js 1000      → 完賽 1000/1000（2/3/4 人輪流）
                                          平均輪數 9.0（範圍 4~19）、平均勝者 42.1
                                          verbose 顯示事件加分（事件欄 0~3）與各玩家目標進度
事件序列決定性（node）：seed 4242 兩次皆「工藝競賽→夜間集會→文化祭典→豐收季→家屋加固→山路封閉→(循環)」；不同 seed 不同序列
秘密目標決定性（node）：seed 4242 四人 = obj_collector, obj_culture, obj_craft, obj_trade（兩次相同）
```

瀏覽器實測（單機 3 人）：開局即顯示事件橫幅（家屋加固＋效果＋「持續至下一輪」）、秘密目標面板（🏠 家屋守護者 0/4「只有你看得到」＋進度條）、骰子上限 6→3、無 console 錯誤。

> 註：連線「兩台裝置實跑同步」與「board 多回合翻牌動畫」在單分頁 headless 預覽無法完整跑（背景分頁 timer 節流會卡住 bot 擲骰動畫）。事件翻牌與同步性已以 simulate（1000 局）＋ node 決定性測試佐證；程式路徑（`finishTurnAndAdvance` 翻牌）與 simulate 走同一個 `flipNextEvent`。若需雙裝置實測，建議部署後兩瀏覽器對連驗證。
