const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("pundiDesktop", Object.freeze({
  platform: process.platform,
  version: process.getSystemVersion()
}));
