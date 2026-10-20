// A plain Chromium window for exercising a local HTML document; no app preload or native bridge.
const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const dataDir = app.commandLine.getSwitchValue("user-data-dir");
if (dataDir) app.setPath("userData", path.resolve(dataDir));
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.loadFile(process.env.MOA_HTML_FILE);
});
app.on("window-all-closed", () => app.quit());
