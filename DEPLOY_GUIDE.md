# 《AI 創業公司模擬器》自動化打包與遊戲平台上架指南

本專案已內建 GitHub Actions 自動化工作流（`.github/workflows/game-release.yml`），無需在本地安裝 Node.js 或執行任何終端機指令，即可在雲端完成編譯、TypeScript 檢查、打包 `game-portal-release.zip` 與平台部署。

---

## 一、 下載 `game-portal-release.zip`（免終端機）

1. 將代碼 Push 到 GitHub 倉庫（`main` 或 `master` 分支）。
2. 打開 GitHub 倉庫頁面，點擊上方的 **Actions** 標籤。
3. 點擊最新的 **Build Game Release & Deploy** 運行紀錄（也可在右側點擊 **Run workflow** 手動觸發）。
4. 滑動到頁面最底部的 **Artifacts** 區塊，點擊 **game-portal-release** 即可下載 `game-portal-release.zip`。
   - 壓縮包根目錄即為 `index.html`，且已設定 `base: './'` 相對路徑，符合各大 H5 遊戲平台規範。

---

## 二、 各大遊戲平台自動化部署

### 1. GamePix（URL Hosting 全自動同步）
1. 在 GitHub 倉庫的 **Settings -> Pages**，將 **Source** 切換為 **GitHub Actions**。
2. 每次 Push 後，遊戲會自動發布至 `https://<你的帳號>.github.io/<專案名>/`。
3. 在 GamePix 開發者後台新增遊戲時選擇 **Host on your own server**，填入上述 GitHub Pages 網址即可自動同步。

### 2. CrazyGames（官方 CLI 自動推送）
1. 登入 CrazyGames 開發者後台，在遊戲管理頁面取得 API Access Token。
2. 在 GitHub 倉庫的 **Settings -> Secrets and variables -> Actions** 點擊 **New repository secret**。
3. Name 輸入 `CRAZYGAMES_TOKEN`，Value 貼上該 Token。
4. 之後每次編譯成功，工作流會自動將 `game-portal-release.zip` 推送至 CrazyGames。

### 3. Y8 Games（網頁拖拉上傳）
1. 從 GitHub **Actions -> Artifacts** 下載 `game-portal-release.zip`。
2. 直接拖入 Y8 開發者後台上傳即可。

---

## 三、 一鍵產出平台專用素材包（Y8 / CrazyGames / 短影音）

專案已內建符合 **Y8** 與 **CrazyGames** 官方尺寸與時長規範的自動化產出工作流（`.github/workflows/record-trailer.yml`）：

1. 打開 GitHub 倉庫頁面，點擊上方的 **Actions** 標籤。
2. 在左側選擇 **Generate Platform Media Pack (Y8 & CrazyGames)** → 右側 **Run workflow**。
3. 選擇目標平台（`all`、`y8`、`crazygames` 或 `social`），執行完成後於底部 **Artifacts** 直接下載對應壓縮包：

### `y8-media-pack`（完全符合 Y8 Media Guidelines）
- `game-portal-release.zip`（遊戲本體 ZIP）
- `y8-video-16x9-1280x720.mp4`（**1280×720**、**17–18 秒** ≥15s、無開場黑畫面/標題選單，直接進入實機遊玩）
- `y8-video-4x3-960x720.mp4`（**960×720**、**17–18 秒** 4:3 備用實機影片）
- `y8-screenshot-widescreen-1-1280x720.png` / `y8-screenshot-widescreen-2-1280x720.png`（**1280×720** 實機截圖）
- `y8-screenshot-standard-760x570.png`（**760×570** 4:3 標準截圖）
- `y8-promo-landscape-1920x1080.jpg` / `y8-promo-portrait-1080x1920.jpg` / `y8-promo-card-760x570.jpg`

### `crazygames-media-pack`（完全符合 CrazyGames Technical & Cover Guidelines）
- `game-portal-release.zip`（純相對路徑 `./`、體積 < 1 MB）
- `crazygames-cover-landscape-1920x1080.jpg`（16:9 橫版封面 **1920×1080**）
- `crazygames-cover-portrait-800x1200.jpg`（2:3 直版封面 **800×1200**）
- `crazygames-cover-square-800x800.jpg`（1:1 方形封面 **800×800**）
- `crazygames-video-landscape-1920x1080.mp4`（**17 秒**、1080p 16:9、靜音、無游標、以靜態封面銜接實機）
- `crazygames-video-portrait-800x1200.mp4`（**17 秒**、2:3 直式、靜音、無游標、以靜態封面銜接實機）

### `social-shorts-pack`
- `social-shorts-9x16-1080x1920.mp4`（9:16 豎版短片，適合 TikTok / IG Reels / YouTube Shorts）

