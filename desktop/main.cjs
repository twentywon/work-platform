const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const { createRegistry } = require("./registry.cjs");
let win;
const dataDir = app.commandLine.getSwitchValue("user-data-dir");
if (dataDir) app.setPath("userData", path.resolve(dataDir));
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on("second-instance", () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});
if (primaryInstance)
  app
    .whenReady()
    .then(async () => {
      const registry = await createRegistry(
        path.join(app.getPath("userData"), "registered-files.json"),
      );
      const entry = path.join(__dirname, "../dist/index.html");
      const trustedURL = pathToFileURL(entry).href;
      const check = (event) => {
        if (
          !win ||
          event.sender !== win.webContents ||
          event.senderFrame.url !== trustedURL
        )
          throw Error("허용되지 않은 요청입니다.");
      };
      ipcMain.handle("moa:pick", async (event) => {
        check(event);
        const result = await dialog.showOpenDialog(win, {
          title: "모아에 연결할 파일 선택",
          properties: ["openFile", "multiSelections"],
          filters: [
            {
              name: "업무 문서 및 이미지",
              extensions: [
                "hwp",
                "hwpx",
                "doc",
                "docx",
                "xls",
                "xlsx",
                "ppt",
                "pptx",
                "pdf",
                "png",
                "jpg",
                "jpeg",
                "gif",
                "webp",
                "bmp",
                "svg",
                "txt",
                "md",
                "csv",
                "json",
                "log",
                "odt",
                "ods",
                "odp",
              ],
            },
          ],
        });
        return result.canceled ? [] : registry.add(result.filePaths);
      });
      ipcMain.handle("moa:read", async (event, id) => {
        check(event);
        const filename = registry.resolve(id);
        const stat = await fs.stat(filename);
        if (stat.size > 80 * 1024 * 1024)
          throw Error("80MB를 초과하는 파일은 연결 프로그램에서 열어 주세요.");
        return {
          bytes: await fs.readFile(filename),
          name: path.basename(filename),
          lastModified: stat.mtimeMs,
        };
      });
      ipcMain.handle("moa:register-dropped", async (event, paths) => {
        check(event);
        if (
          !Array.isArray(paths) ||
          paths.length > 100 ||
          paths.some((p) => typeof p !== "string" || !path.isAbsolute(p))
        )
          throw Error(
            "원본 파일을 선택해 주세요. 한 번에 100개까지 등록할 수 있습니다.",
          );
        return registry.add(paths);
      });
      ipcMain.handle("moa:open", async (event, id) => {
        check(event);
        const filename = registry.resolve(id);
        await fs.access(filename);
        const error = await shell.openPath(filename);
        if (error) throw Error(error);
        return true;
      });
      function createWindow() {
        win = new BrowserWindow({
          width: 1440,
          height: 980,
          minWidth: 760,
          minHeight: 680,
          title: "모아 — 나의 업무 공간",
          icon: path.join(__dirname, "../build/icon.png"),
          backgroundColor: "#f6f7fb",
          autoHideMenuBar: true,
          webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        });
        win.webContents.setWindowOpenHandler(({ url }) => {
          try {
            if (["https:", "http:"].includes(new URL(url).protocol)) shell.openExternal(url).catch(() => {});
          } catch {}
          return { action: "deny" };
        });
        win.webContents.on("will-navigate", (event, url) => {
          if (url !== trustedURL) event.preventDefault();
        });
        win.webContents.session.webRequest.onHeadersReceived(
          (details, callback) =>
            callback({
              responseHeaders: {
                ...details.responseHeaders,
                "Content-Security-Policy": [
                  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; frame-src 'self' blob:; connect-src 'self' blob:; object-src 'none'",
                ],
              },
            }),
        );
        win.loadFile(entry);
      }
      createWindow();
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    })
    .catch((error) => {
      console.error("모아를 실행하지 못했습니다:", error.message);
      app.quit();
    });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
