# Project Architecture Rules (Non-Obvious Only)

- **Platform Coupling**: Video pipeline is hard-coded for macOS (`h264_videotoolbox`, `aac_at`). Windows/Linux support requires abstracting the encoder selection logic first.
- **Main Process Orchestration**: Video processing logic resides in `main.js`. Do not move heavy computation to Renderer; keep it in Main or move to a Worker to maintain UI responsiveness.
- **Transient State**: No persistence layer exists. `fileQueue` in `renderer.js` is in-memory only. Adding persistence requires introducing a local store (e.g., `electron-store`).
- **IPC Traffic**: Progress events are emitted frequently (per frame/time update). If UI performance degrades, throttle `merge-progress` IPC in `main.js` before refactoring UI.
- **Audio Strategy**: The architecture mandates generating silent audio tracks for mute videos to ensure `concat` filter stability. This is a core pipeline constraint, not just a helper function.