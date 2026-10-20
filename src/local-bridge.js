// Only the local Windows helper supplies this per-launch token.
if (window.moaLocal && !window.moaDesktop) {
  const { token } = window.moaLocal;
  const request = async (route, body, timeout = 30000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch('/api/' + route, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-Moa-Token': token },
        body: JSON.stringify(body || {}),
      });
      if (!response.ok) {
        if (['status', 'paths', 'folder-path', 'select-start', 'preview-start'].includes(route) && response.status === 404) throw new Error('이전 버전 연결 도우미가 실행 중입니다. 기존 도우미 창을 닫고 최신 ZIP의 코션 실행.vbs를 실행한 뒤 새로고침해 주세요.');
        let message = '연결 도우미에 접근할 수 없습니다. 코션 실행.vbs를 다시 실행해 주세요.';
        try { message = (await response.json()).error || message; } catch {}
        throw new Error(message);
      }
      return response;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('연결 도우미가 응답하지 않습니다. 열린 파일·폴더 선택 창을 확인하고, 도우미 창이 닫혔다면 코션 실행.vbs를 다시 실행한 뒤 브라우저를 새로고침하세요.');
      if (error instanceof TypeError) throw new Error('PC 연결 도우미와 연결이 끊겼습니다. 코션 실행.vbs를 다시 실행한 뒤 이 화면을 새로고침해 주세요.');
      throw error;
    } finally { clearTimeout(timer); }
  };
  const ready = async () => (await request('status', {}, 4000)).json();
  const runJob = async (route, body) => {
    const job = await (await request(route, body)).json();
    if(route === 'select-start') {
      window.moaLocal.selectionJob = job.id;
      if(window.moaLocal.selectionCancelled) {
        await request('job-cancel', {id:job.id});
        window.moaLocal.selectionJob = null;
        return {files:[]};
      }
    }
    try {
      for (let attempt = 0; attempt < 600; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        const result = await (await request('job', {id:job.id})).json();
        if (!result.pending) return { ...result, jobId:job.id };
      }
      throw new Error('작업 시간이 초과되었습니다. 경로 붙여넣기로 원본을 연결해 주세요.');
    } finally { if(window.moaLocal.selectionJob === job.id) window.moaLocal.selectionJob = null; }
  };
  const nativeFiles = window.chrome?.webview?.postMessageWithAdditionalObjects;
  const nativeRequests = new Map();
  if (nativeFiles) {
    window.chrome.webview.addEventListener('message', event => {
      const message = event.data;
      const entry = nativeRequests.get(message?.id);
      if (!entry) return;
      clearTimeout(entry.timer); nativeRequests.delete(message.id);
      if (message.error) entry.reject(Error(message.error));
      else if (Array.isArray(message.paths) && message.paths.length) entry.resolve(message.paths);
      else entry.reject(Error('원본 경로를 받지 못했습니다. 경로 붙여넣기로 연결해 주세요.'));
    });
    window.chrome.webview.postMessage({kind:'session', token});
  }
  const nativePaths = files => new Promise((resolve,reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => { nativeRequests.delete(id); reject(Error('Windows 원본 경로 응답이 없습니다. 코션 전용 창을 다시 실행하세요.')); },8000);
    nativeRequests.set(id,{resolve,reject,timer});
    try { window.chrome.webview.postMessageWithAdditionalObjects({kind:'file-paths',id},files); }
    catch(error) { clearTimeout(timer); nativeRequests.delete(id); reject(error); }
  });
  window.moaDesktop = {
    status: ready,
    nativeDropPaths: typeof nativeFiles === 'function',
    nativeDropUnavailable: !!window.chrome?.webview && typeof nativeFiles !== 'function',
    async registerPaths(paths) { return (await (await request('paths', { paths })).json()).files; },
    async setFolder(path) { return (await request('folder-path', { path })).json(); },
    async pickFiles() {
      window.moaLocal.selectionCancelled = false;
      await ready();
      if(window.moaLocal.selectionCancelled) return [];
      return (await runJob('select-start', {})).files;
    },
    async cancelSelection() {
      window.moaLocal.selectionCancelled = true;
      if(window.moaLocal.selectionJob) await request('job-cancel', {id:window.moaLocal.selectionJob});
    },
    async firstPage(id) {
      const result = await runJob('preview-start', {id});
      const response = await request('job-content', {id:result.jobId});
      return {...result, bytes:new Uint8Array(await response.arrayBuffer())};
    },
    async chooseFolder() {
      await ready();
      return (await request('folder', {}, 180000)).json();
    },
    async registerDroppedFiles(files) {
      if (nativeFiles) {
        const paths = await nativePaths(files);
        return (await (await request('paths', {paths})).json()).files;
      }
      const items = files.map(f => ({ name: f.name, size: f.size, lastModified: f.lastModified }));
      return (await (await request('resolve', { files: items })).json()).files;
    },
    async openFile(id) { await request('open', { id }); },
    async readFile(id) {
      const response = await request('read', { id });
      return { bytes: new Uint8Array(await response.arrayBuffer()), name: decodeURIComponent(response.headers.get('X-Moa-Name')), lastModified: Number(response.headers.get('X-Moa-Modified')) };
    },
  };
}
