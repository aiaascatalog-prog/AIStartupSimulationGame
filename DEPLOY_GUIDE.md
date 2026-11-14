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

## 三、 自動錄製 10 秒宣傳短片（MP4 / WebM，適合 TikTok / Shorts / 遊戲平台上架）

專案已內建 Playwright 錄影腳本（`scripts/record-trailer.mjs`）與專用工作流（`.github/workflows/record-trailer.yml`），無需本機安裝瀏覽器或剪輯軟體：

1. 打開 GitHub 倉庫頁面，點擊上方的 **Actions** 標籤。
2. 在左側工作流列表中選擇 **Record 10s Gameplay Trailer (Movie)**。
3. 點擊右側 **Run workflow**，選擇影片比例：
   - `both`（預設）：同時產生 **16:9 橫版**（`1280x720`，適合遊戲平台/YouTube）與 **9:16 豎版**（`720x1280`，適合 TikTok / IG Reels / Shorts）。
   - `landscape` 或 `portrait`：僅錄製單一比例。
4. 等待工作流完成（約 1 分鐘），滑動到頁面底部的 **Artifacts**，點擊下載 **`gameplay-trailer-movies`**，解壓縮即可取得高畫質 `.mp4` 與 `.webm` 影片檔！

