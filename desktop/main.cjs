const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const { createStaticServer } = require("./static-server.cjs");

const DIST_ROOT = path.resolve(__dirname, "..", "dist");
let staticServer;
let desktopOrigin;

function serveDist() {
  return new Promise((resolve, reject) => {
    staticServer = createStaticServer(DIST_ROOT);
    staticServer.once("error", reject);
    staticServer.listen(0, "127.0.0.1", () => {
      const address = staticServer.address();
      desktopOrigin = `http://127.0.0.1:${address.port}`;
      resolve(desktopOrigin);
    });
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#0D1B3D",
    autoHideMenuBar: true,
    icon: path.resolve(__dirname, "pundi.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.resolve(__dirname, "preload.cjs")
    }
  });

  const isLocalUrl = url => { try { return new URL(url).origin === desktopOrigin; } catch { return false; } };
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isLocalUrl(url)) return { action: "allow" };
    shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (isLocalUrl(url)) return;
    event.preventDefault();
    shell.openExternal(url).catch(() => {});
  });
  window.loadURL(`${desktopOrigin}/app.html?pundi_desktop=1`);
}

app.whenReady().then(async () => {
  await serveDist();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch(error => {
  console.error(`Pundi desktop startup failed: ${error.message}`);
  app.quit();
});

app.on("window-all-closed", () => {
  staticServer?.close();
  if (process.platform !== "darwin") app.quit();
});
