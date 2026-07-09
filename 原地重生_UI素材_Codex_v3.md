# 原地重生・返璞歸真 — UI 素材生圖工作單（Codex v3）

- **Version**: v3
- **Target AI**: Codex（生圖端，gpt-image）
- **Language**: prompt 英文 / 說明中文
- **Purpose**: 建築拼圖空格目前是純 CSS 斜線底紋，JJ 提供的參考圖空格裡有淡雅雕花浮水印紋樣，CSS 做不出這種細緻感，需新生 1 張透明浮水印素材。

> ⚠️ 給主對話/使用者的提醒
> - 本批共 **1 張**，純幾何裝飾浮水印，不含任何族群圖騰、不含人物。
> - 這是本輪視覺比對（JJ 提供實際遊戲畫面截圖要求「一模一樣」）唯一判定需要新生的素材，其餘全部用 CSS 調整完成，不需生圖。

## System Role（風格與文化規則）

延續 v1/v2 的暖色調木雕/金葉電影感風格：金黃 `#F5A623`/`#FFD700`、深綠 `#1A4A10`、木質棕 `#8B5500`。本張是**純幾何裝飾浮水印**（羅盤/十字對稱花紋），不含人物、不含任何特定族群圖騰。

## 素材盤點（來源判定）

| 元素 | 判定 | 處理 |
|---|---|---|
| 對戰橫幅、側欄暗色面板、行動選單、擲骰彈窗外框 | 純 CSS / 沿用現成 frame-gold.png | 已完成，不生圖 |
| **建築拼圖空格浮水印紋樣** | **需要新生** | 見下 |

## 共用 Negative

```
no woven diamond pattern, no continuous woven bands, no ancestral-eye motif,
no facial tattoo, no tribal tattoo, no Atayal motif, no Amis motif,
no Paiwan motif, no Native American motifs, no totem pole, no feather headdress,
no dreamcatcher, no human character, no face, no text, no watermark text, no logo
```

## 素材定義 + English Prompt

### 1. bld-empty-watermark.png — 建築拼圖空格浮水印
- 用途：`.bld-cell.empty` 背景浮水印，取代目前的純 CSS 斜線底紋。
- 規格：**512×512 透明 PNG（RGBA，外緣 alpha=0）**，中央對稱的淡雅羅盤/十字幾何紋樣，線條要細、顏色要淡（低飽和度金棕色，透明度低，疊在米色底紋上不能太搶眼，畢竟這是「尚未收集」的空格提示，不是主角）。

```
A faint, delicate compass-rose / cross geometric watermark pattern, thin
symmetrical linework, low-opacity warm sepia and pale gold tone, engraved
line-art style, centered composition, subtle and understated (this is a
background texture for an "empty slot" placeholder, not a focal illustration),
no color fill, no shading gradients beyond subtle line weight variation,
transparent background, flat vector-like line pattern
```

## 尺寸 / 命名 / 透明 / 回收

| 檔名 | 尺寸 | quality | 透明 | 回收位置 |
|---|---|---|---|---|
| `bld-empty-watermark.png` | 512×512 | medium | **是（RGBA 外緣 alpha=0，且整張都要低不透明度，不能是實色圖）** | `assets/ui/` |

## 整合・交接

生好後放進 `assets/ui/`，由主 code agent 接進 `style.css` 的 `.bld-cell.empty` 背景（`background-image: url(...)`，疊加在現有底紋之上或取代），不需要額外程式改動。

## 回收驗收

- [ ] 透明背景，外緣 alpha=0。
- [ ] 整體低調（淡色/低對比），縮到拼圖格實際顯示尺寸（約 80-190px 見方）仍不會搶過已收集格子的視覺份量。
- [ ] 無文字/浮水印字樣、無族群圖騰。
- [ ] 對稱幾何紋樣，不是具象圖案。

## 一頁摘要

生 1 張 → `assets/ui/bld-empty-watermark.png`，512×512 透明 PNG，淡雅羅盤/十字幾何線紋浮水印，低調不搶戲，取代建築拼圖空格目前的 CSS 斜線底紋。遇 `billing_hard_limit_reached` 立即停、回報、不重試。
