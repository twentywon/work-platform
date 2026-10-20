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
        if (['status', 'paths', 'folder-path'].includes(route) && response.status === 404) throw new Error('이전 버전 연결 도우미가 실행 중입니다. 기존 도우미 창을 닫고 최신 ZIP의 모아 실행.cmd를 실행한 뒤 새로고침해 주세요.');
        let message = '연결 도우미에 접근할 수 없습니다. 모아 실행.cmd를 다시 실행해 주세요.';
        try { message = (await response.json()).error || message; } catch {}
        throw new Error(message);
      }
      return response;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('연결 도우미가 응답하지 않습니다. 열린 파일·폴더 선택 창을 확인하고, 도우미 창이 닫혔다면 모아 실행.cmd를 다시 실행한 뒤 브라우저를 새로고침하세요.');
      if (error instanceof TypeError) throw new Error('PC 연결 도우미와 연결이 끊겼습니다. 모아 실행.cmd를 다시 실행한 뒤 이 화면을 새로고침해 주세요.');
      throw error;
    } finally { clearTimeout(timer); }
  };
  const ready = async () => (await request('status', {}, 4000)).json();
  window.moaDesktop = {
    status: ready,
    async registerPaths(paths) { return (await (await request('paths', { paths })).json()).files; },
    async setFolder(path) { return (await request('folder-path', { path })).json(); },
    async pickFiles() {
      await ready();
      return (await (await request('pick', {}, 180000)).json()).files;
    },
    async chooseFolder() {
      await ready();
      return (await request('folder', {}, 180000)).json();
    },
    async registerDroppedFiles(files) {
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
