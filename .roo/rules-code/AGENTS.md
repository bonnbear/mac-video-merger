# Project Coding Rules (Non-Obvious Only)

- **FFmpeg Filter Graph**: `merge-videos` constructs a manual graph. Must maintain `[v${index}]`/`[a${index}]` pad/scale chain structure.
- **Error Suppression**: `probeVideo` intentionally swallows errors (returns default 1080p) to prevent UI blocking. Do not change to `throw`.
- **Magic Numbers**: Progress calculation uses `* 1.01` buffer and caps at `99.9%` to handle FFmpeg duration estimation inaccuracies.
- **Resolution Coupling**: Resolution strings ('4k', '720p') are hardcoded in `main.js` switch logic and `index.html`. Must update both.
- **Renderer Isolation**: Renderer is strictly isolated. Use `window.api` (preload), never import `electron` or `remote`.