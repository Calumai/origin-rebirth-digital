# 原地重生・返璞歸真 — UI 素材生圖工作單（Codex v1）

- **Version**: v1
- **Target AI**: Codex（生圖端，gpt-image）
- **Language**: prompt 英文 / 說明中文
- **Purpose**: 為《原地重生・返璞歸真》數位版產出 3 張核心 UI 素材（Hero 背景、金雕面板框、對戰桌面），把目前「陽春紙張感」拉到電影感桌遊質感。

> ⚠️ 給主對話/使用者的提醒
> - 本批共 **3 張**，全部為 UI 框架/背景素材，**不含人物、不含卡面**（人物與卡面沿用 `assets/` 現成正式掃描圖，勿重生）。
> - 文化風險點：背景/木雕/藤編最易被 AI 填入特定族群織紋或跨族混用，已在每張掛共用 negative 防呆。
> - 額度已由使用者確認：就生這 3 張。

## System Role（風格與文化規則）

細緻繪本/RPG 遊戲美術、溫暖電影感光影、有景深的插畫筆觸（非扁平向量、非寫實照片）。裝飾語言＝木雕＋金葉＋大地色。暖色調：金黃 `#F5A623`/`#FFD700`、深綠 `#1A4A10`/`#0A2A08`、木質棕 `#8B5500`/`#5A3000`。**圖裡不放任何動態遊戲文字**（標題/分數/詞彙由前端疊加）。本作涉及台灣原住民族（邵族／噶瑪蘭族／拉阿魯哇族／賽德克族）＋台灣山林，UI 素材本身**不放特定族群圖騰**，族群識別交給前景的正式族群卡。

## 素材盤點（來源判定）

| 元素 | 判定 | 處理 |
|---|---|---|
| 卡面/族群/建築/素材幣 | 沿用現成 | `assets/` 已齊，勿生 |
| 首頁 4 族角色 | 沿用現成 | `assets/tribes/*.png` 疊前景，背景不畫人 |
| 金條/pill/圓角/光暈/分隔 | 純 CSS | 已做，勿生 |
| Hero 背景、金雕框、對戰桌面 | **需要新生** | 見下 3 張 |

## 共用 Negative（每張都掛）

```
no woven diamond pattern, no ancestral-eye motif, no facial tattoo,
no Atayal motif, no Amis red-black motif, no Paiwan glass-bead motif,
no Native American motifs, no totem pole, no feather headdress, no dreamcatcher,
no war paint, no repeating geometric tribal border, no invented ritual symbols,
no text, no watermark, no logo
```

## 素材定義 + English Prompt

### 1. hero-home.jpg — 首頁背景
- 用途：首頁 `.hero` 全幅背景。非透明 JPG。
- Prompt:
```
Cinematic digital painting of a misty Taiwan central-mountain-range dawn 300 years ago,
layered blue-green ridgelines fading into golden morning fog, a calm highland lake
in the mid distance, foreground of mossy boulders and a small warm campfire with
soft embers, lush subtropical forest, warm cinematic god-rays breaking through mist,
storybook RPG concept-art style, painterly brushwork with depth of field,
warm earthy palette of deep green, amber gold and wood brown, no people, no buildings
```
- 追加 negative：`no human character, no tribal costume`

### 2. frame-gold.png — 金雕面板外框
- 用途：`border-image` 套 `.card-box`/`.modal`。**透明 PNG（RGBA，外緣 alpha=0）**，中央須全透明、只有四邊＋四角雕花，設計成九宮格可拉伸。
- Prompt:
```
Ornate golden carved wooden picture frame, empty transparent center, symmetrical
border only, art-nouveau meets aboriginal-neutral woodcarving, gold leaf and dark
walnut wood, subtle vine-and-leaf relief and isolated round gold rivets (dot studs
only, NOT continuous bands), warm glossy 3D lighting, game UI panel frame asset,
centered, flat front view, transparent background
```
- 追加 negative：`no human character, no face, empty center, border only`

### 3. table-wood.jpg — 對戰桌面材質
- 用途：`renderBoard` 底層桌面材質，可平鋪。非透明 JPG。
- Prompt:
```
Top-down aged wooden game table surface, warm walnut and honey-brown planks with
soft grain, faint woven-rattan border inlay (plain, non-figurative), gentle radial
vignette and warm ambient lighting from above, subtle center glow where a play mat
would sit, tileable texture, storybook RPG board-game aesthetic, no objects, no cards
```
- 追加 negative：`no human character, no objects`

## 尺寸 / 命名 / 透明 / 回收

| 檔名 | 尺寸 | quality | 透明 | 回收位置 |
|---|---|---|---|---|
| `hero-home.jpg` | 1536×1024 | medium | 否（JPG） | `assets/ui/` |
| `frame-gold.png` | 1024×1024 | medium | **是（RGBA 外緣 alpha=0，中央透明）** | `assets/ui/` |
| `table-wood.jpg` | 1024×1024 | medium | 否（可平鋪 JPG） | `assets/ui/` |

## 整合・交接

素材回收到 `assets/ui/` 後，由主 code agent（Kacaw）接進 `style.css`：Hero 背景鋪 `.hero`、金框 `border-image` 套 `.card-box`/`.modal`、桌面材質鋪 board 底並改「對戰桌」布局。Codex 只負責生圖＋回收驗收，勿改 app.js/style.css。

## 回收驗收（生完逐項驗）

- [ ] 透明：`frame-gold.png` 外緣/四角 alpha=0、中央全透明，無白底髒邊。
- [ ] 無夾帶文字/浮水印/logo。
- [ ] 金框為點狀鉚釘＋葉蔓，**無連續菱形織紋/祖靈眼/他族圖騰**。
- [ ] Hero 背景無人物、無建築、無特定族群符號。
- [ ] 小尺寸縮圖仍質感清晰。

## 一頁摘要

生 3 張 → `assets/ui/`：`hero-home.jpg`(1536×1024 JPG)、`frame-gold.png`(1024×1024 透明 PNG 中央透)、`table-wood.jpg`(1024×1024 可平鋪 JPG)。每張掛共用 negative；不放人物/文字/特定族群圖騰。遇 `billing_hard_limit_reached` 立即停、回報、不重試。
