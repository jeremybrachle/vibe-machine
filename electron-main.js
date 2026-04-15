const { app, BrowserWindow } = require('electron');
const { fork } = require('child_process');
const path = require('path');

let server;
let win;

app.whenReady().then(() => {
  // Start the existing Express-less server in background
  server = fork(path.join(__dirname, 'server.js'), [], { silent: true });

  // Give server a moment to bind
  setTimeout(() => {
    win = new BrowserWindow({
      width: 1200,
      height: 800,
      frame: false,
      titleBarStyle: 'hidden',
      backgroundColor: '#000000',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    win.loadURL('http://localhost:3000');

    win.on('closed', () => {
      win = null;
    });
  }, 500);
});

app.on('window-all-closed', () => {
  if (server) server.kill();
  app.quit();
});

app.on('activate', () => {
  if (win === null) {
    // macOS dock re-open
    app.whenReady().then(() => {
      win = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        backgroundColor: '#000000',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });
      win.loadURL('http://localhost:3000');
    });
  }
});
