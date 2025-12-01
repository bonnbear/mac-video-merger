const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  await win.loadFile(path.join(__dirname, 'icon_generator.html'));

  // 等待一小會確保渲染完成
  setTimeout(async () => {
    try {
      // 獲取 Canvas 數據
      const dataUrl = await win.webContents.executeJavaScript(`
        document.getElementById('canvas').toDataURL('image/png');
      `);
      
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
      
      fs.writeFileSync(path.join(__dirname, 'icon.png'), base64Data, 'base64');
      console.log('icon.png generated successfully!');
      app.quit();
    } catch (err) {
      console.error('Error generating icon:', err);
      app.quit();
    }
  }, 1000);
});