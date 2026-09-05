const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("pundiDesktop", Object.freeze({
  isDesktop: true,
  platform: process.platform,
  version: process.getSystemVersion()
}));
