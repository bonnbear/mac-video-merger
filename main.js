const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { spawn, execSync } = require('child_process');

// --- 获取 FFmpeg/FFprobe 路径 ---
const getBinaryPath = (binaryName) => {
    // 1. 定义常见的安装路径 (macOS Homebrew, MacPorts, etc.)
    const commonPaths = [
        `/opt/homebrew/bin/${binaryName}`, // Apple Silicon Homebrew
        `/usr/local/bin/${binaryName}`,    // Intel Mac Homebrew
        `/usr/bin/${binaryName}`,
        `/bin/${binaryName}`
    ];

    // 2. 遍历检查文件是否存在
    for (const p of commonPaths) {
        try {
            if (fs.existsSync(p)) {
                console.log(`[Main] Found ${binaryName} at: ${p}`);
                return p;
            }
        } catch (e) {
            console.error(`[Main] Error checking path ${p}:`, e);
        }
    }

    // 3. 尝试使用系统 which 命令 (作为备选，虽然在 GUI 环境下 PATH 可能不全)
    try {
        const systemPath = execSync(`which ${binaryName}`).toString().trim();
        if (systemPath) {
            console.log(`[Main] Found ${binaryName} using which: ${systemPath}`);
            return systemPath;
        }
    } catch (e) {
        console.log(`[Main] 'which ${binaryName}' failed or not found`);
    }

    // 4. 如果都找不到，回退到默认命令名，寄希望于系统 PATH (但在 GUI App 中可能失败)
    console.warn(`[Main] Could not find absolute path for ${binaryName}, falling back to command name.`);
    return binaryName;
};

// 设置 FFmpeg 和 FFprobe 路径
const ffmpegPath = getBinaryPath('ffmpeg');
const ffprobePath = getBinaryPath('ffprobe');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

console.log('FFmpeg config:', { ffmpeg: ffmpegPath, ffprobe: ffprobePath });

// --- 检测视频是否有音轨 ---
function probeVideo(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error('ffprobe error:', err);
                return reject(err);
            }
            
            const hasAudio = metadata.streams.some(s => s.codec_type === 'audio');
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            
            resolve({
                hasAudio,
                width: videoStream?.width || 1920,
                height: videoStream?.height || 1080,
                duration: metadata.format.duration || 0
            });
        });
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 900,
        height: 750,
        titleBarStyle: 'hiddenInset',
        vibrancy: 'under-window',
        icon: path.join(__dirname, 'assets/icon.icns'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    // 在 macOS 上，开发模式下需要显式设置 Dock 图标
    if (process.platform === 'darwin') {
        app.dock.setIcon(path.join(__dirname, 'assets/icon.png'));
    }
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// --- IPC 逻辑 ---

// 选择文件
ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'avi', 'flv', 'm4v', 'webm'] }]
    });
    return result.filePaths;
});

// 选择保存路径
ipcMain.handle('select-save-path', async () => {
    const { filePath } = await dialog.showSaveDialog({
        buttonLabel: '保存视频',
        defaultPath: `merged_${Date.now()}.mp4`,
        filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
    });
    return filePath;
});

// 获取视频信息
ipcMain.handle('get-video-info', async (event, filePath) => {
    try {
        return await probeVideo(filePath);
    } catch (err) {
        console.error('get-video-info error:', err);
        return { hasAudio: true, width: 1920, height: 1080 };
    }
});
// 打开文件所在文件夹
ipcMain.handle('show-item-in-folder', (event, filePath) => {
    shell.showItemInFolder(filePath);
});

// 执行合并 (M4 优化版)
ipcMain.handle('merge-videos', async (event, { inputFiles, outputPath, resolution }) => {
    return new Promise(async (resolve, reject) => {
        if (!inputFiles || inputFiles.length < 2) {
            return reject('请至少选择两个视频文件。');
        }

        const sender = event.sender;
        
        // 解析目标分辨率
        let targetWidth = 1920, targetHeight = 1080;
        if (resolution === '4k') {
            targetWidth = 3840; targetHeight = 2160;
        } else if (resolution === '720p') {
            targetWidth = 1280; targetHeight = 720;
        }

        console.log('开始处理，目标分辨率:', `${targetWidth}x${targetHeight}`);

        try {
            // 检测所有视频的音轨情况
            const videoInfos = await Promise.all(inputFiles.map(f => probeVideo(f)));
            const allHaveAudio = videoInfos.every(info => info.hasAudio);
            
            // 计算总时长 (秒)
            const rawDuration = videoInfos.reduce((acc, info) => acc + (info.duration || 0), 0);
            // 增加 1% 的缓冲时间，防止因元数据误差导致进度超过 100%
            const totalDuration = rawDuration > 0 ? rawDuration * 1.01 : 1;
            
            console.log('视频总时长(含缓冲):', totalDuration);

            console.log('视频音轨检测:', videoInfos.map((v, i) => `${i}: ${v.hasAudio ? '有音频' : '无音频'}`));

            let command = ffmpeg();

            // 添加所有视频输入
            inputFiles.forEach(file => command.input(file));

            // 如果有视频缺少音轨，添加静音源
            if (!allHaveAudio) {
                command.input('anullsrc=channel_layout=stereo:sample_rate=44100')
                    .inputOptions(['-f', 'lavfi']);
            }

            // --- 构建复杂滤镜 ---
            let filterComplex = '';
            let concatInput = '';
            const silentInputIndex = inputFiles.length; // 静音源的索引

            inputFiles.forEach((_, index) => {
                // 缩放视频，保持宽高比，用黑边填充
                filterComplex += `[${index}:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,`;
                filterComplex += `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,`;
                filterComplex += `setsar=1,fps=30[v${index}];`;

                // 处理音频
                if (videoInfos[index].hasAudio) {
                    // 有音频：正常处理
                    filterComplex += `[${index}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${index}];`;
                } else {
                    // 无音频：使用静音源，并用 atrim 截取对应时长
                    const duration = videoInfos[index].duration || 10;
                    filterComplex += `[${silentInputIndex}:a]atrim=duration=${duration},aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${index}];`;
                }
                
                concatInput += `[v${index}][a${index}]`;
            });

            // 拼接 concat 指令
            filterComplex += `${concatInput}concat=n=${inputFiles.length}:v=1:a=1[outv][outa]`;

            command
                .complexFilter(filterComplex, ['outv', 'outa'])
                .outputOptions([
                    // --- M4 芯片核心优化 ---
                    '-threads', '0',              // 启用多线程，充分利用 CPU
                    '-c:v', 'h264_videotoolbox',  // Apple 硬件加速编码
                    '-q:v', '70',                 // 质量 (1-100)，70 为高质量
                    '-profile:v', 'high',         // H.264 High Profile
                    '-level', '4.2',              // 兼容大多数设备
                    '-allow_sw', '1',             // 必要时允许软件回退
                    '-realtime', '0',             // 关闭实时模式，提高质量
                    
                    // 音频设置
                    '-c:a', 'aac_at',             // 使用 macOS 原生 Audio Toolbox 编码器加速
                    '-b:a', '192k',
                    '-ar', '44100',
                    
                    // 优化输出
                    '-movflags', '+faststart',    // 优化网络播放
                    '-pix_fmt', 'yuv420p'         // 兼容性最佳
                ])
                .on('start', (cmd) => {
                    console.log('FFmpeg 命令:', cmd);
                })
                .on('progress', (progress) => {
                    // 使用 timemark 计算进度，因为 percent 在复杂滤镜下可能不准确
                    if (progress.timemark && totalDuration > 0) {
                        const timemark = progress.timemark;
                        // timemark 格式通常为 HH:MM:SS.mm
                        const parts = timemark.split(':');
                        let currentSeconds = 0;
                        if (parts.length === 3) {
                            currentSeconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
                        }
                        
                        let percent = (currentSeconds / totalDuration) * 100;
                        // 限制在 99.9%，防止溢出
                        percent = Math.min(99.9, percent);
                        
                        // 发送保留一位小数的进度，让用户感知到变化
                        sender.send('merge-progress', percent.toFixed(1));
                    } else if (progress.percent) {
                        // 回退方案
                        sender.send('merge-progress', Math.min(99.9, progress.percent).toFixed(1));
                    }
                })
                .on('error', (err, stdout, stderr) => {
                    console.error('合并失败:', err.message);
                    console.error('FFmpeg 错误输出:', stderr);
                    reject(err.message);
                })
                .on('end', () => {
                    console.log('合并完成!');
                    sender.send('merge-progress', '100.0'); // 确保最后发送 100.0%
                    resolve('success');
                })
                .save(outputPath);

        } catch (err) {
            reject('视频分析失败: ' + err.message);
        }
    });
});