const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    selectFiles: () => ipcRenderer.invoke('select-files'),
    selectSavePath: () => ipcRenderer.invoke('select-save-path'),
    getVideoInfo: (path) => ipcRenderer.invoke('get-video-info', path),
    mergeVideos: (data) => ipcRenderer.invoke('merge-videos', data),
    onProgress: (callback) => ipcRenderer.on('merge-progress', (_, percent) => callback(percent))
});