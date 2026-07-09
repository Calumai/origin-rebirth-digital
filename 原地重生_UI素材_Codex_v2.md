# 原地重生・返璞歸真 — UI 素材生圖工作單（Codex v2）

- **Version**: v2
- **Target AI**: Codex（生圖端，gpt-image）
- **Language**: prompt 英文 / 說明中文
- **Purpose**: 全站移除 emoji 後，猜拳（剪刀石頭布）手勢是唯一 CSS 做不出質感、庫存也沒有的元素，需新生 3 張透明小圖示取代原本的 🪨📄✂️ emoji。

> ⚠️ 給主對話/使用者的提醒
> - 本批共 **3 張**，純手勢圖示，**不含人物臉部、不含任何族群圖騰**。
> - 全站其餘 emoji（電腦標記、領先徽章、對戰圖示、CTA 圖示、骰子點數等）已全數改為純 CSS／純文字取代，不需生圖。
> - 額度尚未確認，請 JJ 看過下方 3 張 prompt 後再交 Codex。

## System Role（風格與文化規則）

延續 v1 的暖色調木雕/金葉電影感風格：金黃 `#F5A623`/`#FFD700`、深綠 `#1A4A10`、木質棕 `#8B5500`。本批是純手勢圖示（拳頭/手掌/剪刀手勢），**不畫完整人物、不畫臉、不帶任何族群服飾或紋樣**，維持通用中性手勢，可安全套用在任何對戰場景。

## 素材盤點（來源判定）

| 元素 | 判定 | 處理 |
|---|---|---|
| 電腦/真人標記、領先徽章、對戰統計、CTA 圖示、對戰桌區塊標題 | 純 CSS/純文字 | 已完成，不生圖（見 app.js/style.css 本次改動） |
| 骰子點數 | 純 CSS | 已用 3×3 格點陣做出立體骰，不生圖 |
| **猜拳手勢（石頭/布/剪刀）** | **需要新生** | 見下 3 張，CSS 畫不出手勢質感 |

## 共用 Negative（每張都掛）

```
no facial features, no face, no full body, no tribal costume, no ethnic textile pattern,
no woven diamond pattern, no ancestral-eye motif, no facial tattoo,
no Native American motifs, no totem pole, no feather headdress,
no text, no watermark, no logo, no skin tone specific coloring, no jewelry
```

## 素材定義 + English Prompt

三張皆為：透明背景、正面視角、暖木雕金邊風格的手勢圖示，**構圖與比例三張一致**（同一手腕角度、同一光源方向、同一畫布留白比例），確保並排使用時視覺統一。

### 1. rps-rock.png — 石頭（拳頭）
```
Icon of a closed fist (rock gesture for rock-paper-scissors), warm stylized
hand illustration with soft cel-shaded lighting, gentle wood-brown and warm
skin-neutral tan tones, thin gold outline rim light, storybook RPG icon style,
front-facing, centered, isolated on transparent background
```

### 2. rps-paper.png — 布（手掌）
```
Icon of a flat open palm hand facing forward (paper gesture for
rock-paper-scissors), warm stylized hand illustration with soft cel-shaded
lighting, gentle wood-brown and warm skin-neutral tan tones, thin gold
outline rim light, storybook RPG icon style, front-facing, centered,
isolated on transparent background
```

### 3. rps-scissors.png — 剪刀（V 字手勢）
```
Icon of a hand making a V-shape peace-sign gesture with index and middle
finger extended (scissors gesture for rock-paper-scissors), warm stylized
hand illustration with soft cel-shaded lighting, gentle wood-brown and warm
skin-neutral tan tones, thin gold outline rim light, storybook RPG icon
style, front-facing, centered, isolated on transparent background
```

## 尺寸 / 命名 / 透明 / 回收

| 檔名 | 尺寸 | quality | 透明 | 回收位置 |
|---|---|---|---|---|
| `rps-rock.png` | 512×512 | medium | **是（RGBA 外緣 alpha=0）** | `assets/ui/` |
| `rps-paper.png` | 512×512 | medium | **是（RGBA 外緣 alpha=0）** | `assets/ui/` |
| `rps-scissors.png` | 512×512 | medium | **是（RGBA 外緣 alpha=0）** | `assets/ui/` |

## 整合・交接

`app.js` 的 `rpsIcon()` 函式已預先接好路徑 `assets/ui/rps-{rock|paper|scissors}.png`，圖檔生好放進 `assets/ui/` 即可自動顯示（目前圖未就緒時 `onerror` 會自動隱藏、不留破圖，只顯示文字）。不需要任何額外程式改動。

## 回收驗收（生完逐項驗）

- [ ] 透明：外緣/四角 alpha=0，無白底髒邊。
- [ ] 無夾帶文字/浮水印。
- [ ] 三張構圖比例一致，並排無違和。
- [ ] 縮到實際顯示尺寸 44×44px 仍可辨識手勢。
- [ ] 無臉部、無族群圖騰/織紋。

## 一頁摘要

生 3 張 → `assets/ui/`：`rps-rock.png`／`rps-paper.png`／`rps-scissors.png`，512×512 透明 PNG，純手勢無臉無服飾。三張構圖統一、掛共用 negative。遇 `billing_hard_limit_reached` 立即停、回報、不重試。
