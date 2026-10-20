const { contextBridge, ipcRenderer, webUtils } = require("electron");
contextBridge.exposeInMainWorld("moaDesktop", {
  pickFiles: () => ipcRenderer.invoke("moa:pick"),
  readFile: (id) => ipcRenderer.invoke("moa:read", id),
  openFile: (id) => ipcRenderer.invoke("moa:open", id),
  registerDroppedFiles: (files) => {
    const paths = files.map((file) => webUtils.getPathForFile(file));
    if (paths.some((filepath) => !filepath))
      throw Error("원본 파일의 위치를 확인할 수 없습니다.");
    return ipcRenderer.invoke("moa:register-dropped", paths);
  },
});
