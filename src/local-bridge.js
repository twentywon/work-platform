// The Windows loopback server injects an ephemeral token into the served HTML.
// No token or bridge exists when the user opens the HTML on its own.
if (window.moaLocal && !window.moaDesktop) {
  const { token } = window.moaLocal;
  const request = async (route, body) => {
    const response = await fetch('/api/' + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Moa-Token': token },
      body: JSON.stringify(body || {}),
    });
    if (!response.ok) {
      let message = '연결 도우미에 접근할 수 없습니다. 모아 실행.cmd를 다시 실행해 주세요.';
      try { message = (await response.json()).error || message; } catch {}
      throw new Error(message);
    }
    return response;
  };
  window.moaDesktop = {
    async pickFiles() { return (await (await request('pick')).json()).files; },
    async chooseFolder() { return (await request('folder')).json(); },
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
