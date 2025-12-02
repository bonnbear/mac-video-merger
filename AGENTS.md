# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Commands
- `npm start` - 開發模式運行
- `npm run dist` - 建置 macOS DMG/ZIP 發行版
- 無測試框架配置

## Critical Non-Obvious Information
- **Hardware Acceleration**: 明確依賴 `h264_videotoolbox` (macOS)。不可改為軟體編碼器 (libx264) 或移除 `-allow_sw 1` 回退機制。
- **FFmpeg Path**: [`getBinaryPath()`](main.js:8) 優先檢查硬編碼路徑 (`/opt/homebrew/bin`, `/usr/local/bin`)，`which` 指令僅作備選，因 GUI 環境下 PATH 可能不完整。
- **Audio Normalization**: 合併邏輯自動為無音軌視頻生成靜音軌 (`anullsrc`)，防止 `concat` 濾鏡失同步。
- **Progress Calculation**: 總時長包含 1% 緩衝 (`* 1.01`) 防止進度溢出。進度從 `timemark` 計算，上限 99.9% 直到完成。
- **Complex Filters**: 合併使用 `filter_complex` 搭配特定 `scale`, `pad`, `setsar` 鏈。不可簡化為基本 concat 而不驗證解析度正規化。n