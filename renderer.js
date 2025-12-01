const addBtn = document.getElementById('addBtn');
const mergeBtn = document.getElementById('mergeBtn');
const fileListEl = document.getElementById('fileList');
const statusEl = document.getElementById('status');
const resolutionSelect = document.getElementById('resolution');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

let fileQueue = []; // { path, name, hasAudio }

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

// 添加文件
addBtn.addEventListener('click', async () => {
    const files = await window.api.selectFiles();
    if (!files || files.length === 0) return;
    
    // 获取每个文件的信息
    for (const filePath of files) {
        // 检查是否已存在
        if (fileQueue.some(f => f.path === filePath)) continue;
        
        const fileName = filePath.split(/[/\\]/).pop();
        const info = await window.api.getVideoInfo(filePath);
        
        fileQueue.push({
            path: filePath,
            name: fileName,
            hasAudio: info.hasAudio
        });
    }
    
    updateList();
    hideStatus();
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

    try {
        await window.api.mergeVideos({
            inputFiles: fileQueue.map(f => f.path),
            outputPath: savePath,
            resolution: resolutionSelect.value
        });
        
        showProgress(false);
        showStatus('success', '✅ 合并成功！视频已保存。');
    } catch (err) {
        showProgress(false);
        showStatus('error', '❌ 合并失败: ' + err);
    } finally {
        addBtn.disabled = false;
        mergeBtn.disabled = fileQueue.length < 2;
        mergeBtn.textContent = '🚀 开始合并';
    }
});

// 初始化
updateList();