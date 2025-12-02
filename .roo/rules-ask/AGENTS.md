# Project Documentation Rules (Non-Obvious Only)

- **程式碼結構**: 這是單一 Electron 應用，非 monorepo。所有核心邏輯在 [`main.js`](../../main.js)，UI 在 [`renderer.js`](../../renderer.js)。
- **中文介面**: UI 文字為簡體中文，但程式碼註解混用中英文。
- **FFmpeg 依賴**: 應用不打包 FFmpeg，依賴系統安裝。用戶需自行安裝 Homebrew FFmpeg。
- **無文檔目錄**: 專案無獨立文檔，所有說明在程式碼註解和此 AGENTS.md 系列中。