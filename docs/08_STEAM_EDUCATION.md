# 08 STEAM 教育模組

## 目的

把遊戲中的建築卡、素材卡與事件轉成可操作的 STEAM 探究任務，讓教師能依年級快速產生一份可重現、可列印、可驗收的教案。

目前版本是教學原型，不是特定族群建築知識的正式教材。卡牌只作為「遊戲觀察物」，模型測試結果也不能代表真實族群文化。

## 五個學段

| ID | 顯示名稱 | 時長 | 探究層級 |
|---|---|---:|---|
| elementary_1_2 | 國小 1–2 年級 | 40 分 | 觀察、分類、一次只改一件事 |
| elementary_3_4 | 國小 3–4 年級 | 45 分 | 測量、比較、用簡單證據說明 |
| elementary_5_6 | 國小 5–6 年級 | 90 分 | 公平測試、變因控制、資料表 |
| junior_high | 國中 | 90 分 | 系統、設計限制、證據論證 |
| senior_high | 高中 | 100 分 | 模型、不確定性、多準則取捨與來源倫理 |

## 五個主題

1. `rain_roof`：雨水與屋頂。
2. `wind_stability`：風與結構穩定。
3. `heat_airflow`：遮陽與空氣流動。
4. `material_properties`：材料性質與選擇。
5. `climate_adaptation`：聚落配置與氣候韌性。

每個主題都可搭配一張遊戲建築卡與一張素材卡，但不得由卡面推導「某族因臺灣氣候而使用某材料」等文化因果。

## 產生器介面

`steam-lessons.js` 對外提供：

- `GRADE_BANDS`：五學段設定。
- `LESSON_THEMES`：五主題模板。
- `LESSON_SOURCES`：已登錄的官方來源。
- `generateLessonPlan(options)`：產生決定性教案。
- `validateLessonPlan(plan)`：驗證分鐘、欄位、來源與文化閘門。

基本呼叫：

```js
generateLessonPlan({
  bandId: 'elementary_5_6',
  themeId: 'rain_roof',
  tribeId: 'random',
  seed: 20260717
});
```

同一組 bandId、themeId、tribeId 與 seed 必須產生相同的教案 ID、卡牌錨點與內容。

## 每份教案的必要內容

- 教案 ID、seed、學段、主題、時長與小組人數。
- 一張遊戲建築卡與一張素材卡。
- 核心提問、氣候情境與學習目標。
- S、T、E、A、M 五項任務。
- 角色、材料、精確分鐘的教學時間軸。
- 評量、差異化支持與延伸任務。
- 證據 ledger、文化安全提醒與官方來源。

## 證據與文化安全閘門

每份教案固定分為：

| 層級 | 狀態 | 可寫內容 |
|---|---|---|
| 看見 | game-artifact | 卡面實際可見的形狀、圖像、遊戲素材標籤 |
| 推測 | student-hypothesis | 學生準備用模型測試的解釋 |
| 來源證實 | official | 官方氣候與課程資料支持的背景 |
| 待審 | review-required | 尚未取得特定族群顧問審校的文化內容 |

特定族群資料要進入正式隨機池，至少需要：

```js
{
  review: { status: 'approved' },
  sources: ['可追溯來源'],
  reviewer: '具名審校者',
  reviewedAt: 'YYYY-MM-DD',
  rightsStatus: '可使用範圍'
}
```

沒有完整資料時，一律保留 `review-required`，不能由 AI 自行批准。

## 官方背景來源

- [國家教育研究院十二年國民基本教育課程綱要](https://www.naer.edu.tw/PageSyllabus?fid=52)
- [中央氣象署氣候教育](https://climate.cwa.gov.tw/Education)
- [中央氣象署臺灣氣候](https://south.cwa.gov.tw/inner/raMT1572423889ELUy)
- [中央氣象署颱風科普](https://pweb.cwa.gov.tw/PopularScience/kids/wt/wt_2.html)
- [原住民族委員會原住民族文化發展中心文化資訊入口](https://ihc.cip.gov.tw/)

這些來源用於課綱、氣候與後續文化研究入口；不代表現有教案中的特定族群敘述已通過顧問審校。

## 驗證

執行：

```text
npm.cmd test
```

自動化會檢查：

- 5 學段 × 5 主題 × 20 seeds，共 500 份教案。
- 相同輸入的決定性輸出。
- 活動分鐘總和等於學段時長。
- S、T、E、A、M、來源與文化閘門齊全。
- 未審文化資料不能進入核准欄位。

人工仍需檢查：

- 教師實際試教時間與材料安全。
- 國小低年級文字是否足夠白話。
- A4 列印與 PDF 是否截斷。
- 特定族群內容的來源、審校與授權。

## 接手工作單

- 背景：目前是安全分層的 STEAM 原型，未含經顧問核准的特定族群建築知識。
- 目標：新增一批可追溯、經審校、限定適用範圍的內容。
- 可修改：`steam-lessons.js` 的 reviewed pool、測試與本文件。
- 不可修改：唯讀來源；不得用卡面或模型結果補寫文化事實。
- 完成條件：來源、權利、具名審校者、日期、適用學段與測試全部齊全。
- 測試：執行 `npm.cmd test`，再由教師完成至少一個學段的試教紀錄。
