# Project Debug Rules (Non-Obvious Only)

- **FFmpeg Logs**: Detailed FFmpeg stderr logs (encoding errors) appear in the **Main Process Terminal**, NOT the DevTools console.
- **Hardware Encoder Failures**: `h264_videotoolbox` errors often indicate input format incompatibility with the hardware scaler. Check logs for `allow_sw` fallback triggers.
- **Silent Audio**: Missing audio in output usually means `probeVideo` failed to detect audio streams. Check the "视频音轨检测" log in the terminal.
- **Path Resolution**: `execSync('which ffmpeg')` fails silently (caught). If encoding fails immediately, verify `ffmpeg` is in the system PATH visible to the app.
- **Progress Stalls**: If progress hangs at 99.9%, it means the `end` event hasn't fired, likely due to a `concat` filter issue with the silent audio track.