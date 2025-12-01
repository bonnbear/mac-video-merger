# AGENTS.md

This file provides guidance to agents when working with code in this repository.

# Critical Non-Obvious Information
- **Hardware Acceleration**: The app explicitly relies on `h264_videotoolbox` (macOS). Do not change to software encoders (libx264) or remove `-allow_sw 1` fallback.
- **FFmpeg Path**: `main.js` prioritizes system FFmpeg (`which ffmpeg`) over bundled binaries to ensure hardware acceleration support.
- **Audio Normalization**: The merge logic automatically generates silent audio tracks (`anullsrc`) for videos without audio to prevent `concat` filter desync.
- **Progress Calculation**: Total duration includes a 1% buffer (`* 1.01`) to prevent progress overflow. Progress is calculated from `timemark`, capped at 99.9% until completion.
- **Complex Filters**: Merging uses `filter_complex` with specific `scale`, `pad`, and `setsar` chains. Do not simplify to basic concat without verifying resolution normalization.