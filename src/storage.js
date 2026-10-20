let db;
export async function database() {
  if (db) return db;
  db = await new Promise((resolve, reject) => {
    const req = indexedDB.open("moa-workspace", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("state");
      req.result.createObjectStore("files", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return db;
}
export async function read(store, key) {
  const d = await database();
  return new Promise((resolve, reject) => {
    const r = d.transaction(store).objectStore(store).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function write(store, value, key) {
  const d = await database();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, "readwrite");
    const s = tx.objectStore(store);
    key === undefined ? s.put(value) : s.put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
export async function getFile(record) {
  if (record.mode === "desktop") {
    if (!window.moaDesktop)
      throw new Error(
        "원본 파일은 등록한 컴퓨터의 ‘코션 실행.vbs’로 실행한 화면에서 열어 주세요.",
      );
    const data = await window.moaDesktop.readFile(record.desktopId);
    return new File([data.bytes], data.name, {
      lastModified: data.lastModified,
    });
  }
  if (record.handle) {
    let status = await record.handle.queryPermission({ mode: "read" });
    if (status !== "granted")
      status = await record.handle.requestPermission({ mode: "read" });
    if (status !== "granted")
      throw new Error("파일 접근 권한을 허용해 주세요.");
    return record.handle.getFile();
  }
  if (record.file) return record.file;
  throw new Error("파일을 다시 등록해 주세요.");
}
export async function allFiles() {
  const d=await database();
  return new Promise((resolve,reject)=>{const r=d.transaction('files').objectStore('files').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
export async function restoreWorkspace(state,files) {
  const d=await database();
  await new Promise((resolve,reject)=>{
    const tx=d.transaction(['state','files'],'readwrite');
    tx.objectStore('files').clear();
    for(const file of files)tx.objectStore('files').put(file);
    tx.objectStore('state').put(state,'workspace');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
}
