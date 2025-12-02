const addBtn = document.getElementById('addBtn');
const mergeBtn = document.getElementById('mergeBtn');
const fileListEl = document.getElementById('fileList');
const statusEl = document.getElementById('status');
const resolutionSelect = document.getElementById('resolution');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const appContainer = document.querySelector('.app-container');
const openFolderBtn = document.getElementById('openFolderBtn');

let fileQueue = []; // { path, name, hasAudio }
let lastSavedPath = null; // 记录最后保存的文件路径

// 更新文件列表 UI
function updateList() {
    fileListEl.innerHTML = '';
    
    if (fileQueue.length === 0) {
        mergeBtn.disabled = true;
        return;
    }

    fileQueue.forEach((file, idx) => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.innerHTML = `
            <span class="file-icon">🎬</span>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-meta">
                    ${file.hasAudio ? '🔊 有音轨' : '<span class="no-audio">🔇 无音轨 (将自动添加静音)</span>'}
                </div>
            </div>
            <div class="file-actions">
                <button class="move-up" title="上移" ${idx === 0 ? 'disabled' : ''}>↑</button>
                <button class="move-down" title="下移" ${idx === fileQueue.length - 1 ? 'disabled' : ''}>↓</button>
                <button class="delete" title="删除">✕</button>
            </div>
        `;
        
        // 上移
        li.querySelector('.move-up').addEventListener('click', () => {
            if (idx > 0) {
                [fileQueue[idx], fileQueue[idx - 1]] = [fileQueue[idx - 1], fileQueue[idx]];
                updateList();
            }
        });
        
        // 下移
        li.querySelector('.move-down').addEventListener('click', () => {
            if (idx < fileQueue.length - 1) {
                [fileQueue[idx], fileQueue[idx + 1]] = [fileQueue[idx + 1], fileQueue[idx]];
                updateList();
            }
        });
        
        // 删除
        li.querySelector('.delete').addEventListener('click', () => {
            fileQueue.splice(idx, 1);
            updateList();
            hideStatus();
        });
        
        fileListEl.appendChild(li);
    });
    
    mergeBtn.disabled = fileQueue.length < 2;
}

// 显示状态
function showStatus(type, msg) {
    statusEl.style.display = 'block';
    statusEl.className = `status-${type}`;
    statusEl.textContent = msg;
}

function hideStatus() {
    statusEl.style.display = 'none';
    openFolderBtn.style.display = 'none'; // 隐藏打开文件夹按钮
}

// 显示/隐藏进度条
function showProgress(show) {
    progressContainer.style.display = show ? 'block' : 'none';
    if (!show) {
        progressFill.style.width = '0%';
        progressText.textContent = '正在处理...';
    }
}

function updateProgress(percent) {
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `正在处理... ${percent}%`;
}

// 监听进度更新
window.api.onProgress((percent) => {
    updateProgress(percent);
});

// 处理文件添加逻辑
async function addFiles(filePaths) {
    if (!filePaths || filePaths.length === 0) return;
    
    const validExtensions = ['mp4', 'mov', 'mkv', 'avi', 'flv', 'm4v', 'webm'];
    let addedCount = 0;

    for (const filePath of filePaths) {
        // 检查是否已存在
        if (fileQueue.some(f => f.path === filePath)) continue;
        
        // 检查扩展名 (针对拖拽)
        const ext = filePath.split('.').pop().toLowerCase();
        if (!validExtensions.includes(ext)) continue;

        const fileName = filePath.split(/[/\\]/).pop();
        
        try {
            const info = await window.api.getVideoInfo(filePath);
            
            fileQueue.push({
                path: filePath,
                name: fileName,
                hasAudio: info.hasAudio
            });
            addedCount++;
        } catch (err) {
            console.error(`无法获取视频信息: ${filePath}`, err);
        }
    }
    
    if (addedCount > 0) {
        updateList();
        hideStatus();
    }
}

// 按钮点击添加
addBtn.addEventListener('click', async () => {
    const files = await window.api.selectFiles();
    await addFiles(files);
});

// 拖拽支持
let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    appContainer.classList.add('drag-over');
});

document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) {
        appContainer.classList.remove('drag-over');
    }
});

document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    appContainer.classList.remove('drag-over');

    const files = [];
    if (e.dataTransfer.files) {
        for (const file of e.dataTransfer.files) {
            // 使用 preload 暴露的 webUtils.getPathForFile 获取路径
            // 这是 Electron 新版本中获取拖拽文件路径的正确方式
            const path = window.api.getFilePath(file);
            if (path) {
                files.push(path);
            }
        }
    }
    
    if (files.length > 0) {
        await addFiles(files);
    }
});

// 合并逻辑
mergeBtn.addEventListener('click', async () => {
    if (fileQueue.length < 2) return;

    const savePath = await window.api.selectSavePath();
    if (!savePath) return;

    // 锁定 UI
    addBtn.disabled = true;
    mergeBtn.disabled = true;
    mergeBtn.textContent = '⏳ 处理中...';
    showProgress(true);
    showStatus('processing', '正在利用 M4 硬件加速合并视频...');
    openFolderBtn.style.display = 'none'; // 隐藏按钮

    try {
        await window.api.mergeVideos({
            inputFiles: fileQueue.map(f => f.path),
            outputPath: savePath,
            resolution: resolutionSelect.value
        });
        
        lastSavedPath = savePath; // 记录保存路径
        showProgress(false);
        showStatus('success', '✅ 合并成功！视频已保存。');
        openFolderBtn.style.display = 'block'; // 显示按钮
    } catch (err) {
        showProgress(false);
        showStatus('error', '❌ 合并失败: ' + err);
    } finally {
        addBtn.disabled = false;
        mergeBtn.disabled = fileQueue.length < 2;
        mergeBtn.textContent = '🚀 开始合并';
    }
});

// 打开文件夹按钮逻辑
openFolderBtn.addEventListener('click', () => {
    if (lastSavedPath) {
        window.api.showItemInFolder(lastSavedPath);
    }
});

// 初始化
updateList();
// 缩放控制
document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            const currentZoom = window.api.getZoomLevel();
            window.api.setZoomLevel(currentZoom + 0.5);
        } else if (e.key === '-') {
            e.preventDefault();
            const currentZoom = window.api.getZoomLevel();
            window.api.setZoomLevel(currentZoom - 0.5);
        } else if (e.key === '0') {
            e.preventDefault();
            window.api.setZoomLevel(0);
        }
    }
});