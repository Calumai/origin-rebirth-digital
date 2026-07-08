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

## 待補（尚未決議，暫依交接文件假設開發，不擋 M2 進度）
- 交接文件 §8「待 JJ 提供」項目原樣保留：族語會話內容（部落戰爭 P.29–P.44）、建築卡各卡實際分數（暫沿用假設 A3 一律 3 分）、正式美術。
