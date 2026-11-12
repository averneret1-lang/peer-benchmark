// Website version: the page's /api and /files requests go to Python running in a Web Worker, not to a server.
(function () {
  window.PB_STATIC = true;
  let parentPB = null;
  try { parentPB = window.parent !== window && window.parent.PB; } catch (e) {}
  if (parentPB) { window.PB = parentPB; }          // the PDF-reports frame shares the main page's worker
  else {
    const worker = new Worker(new URL('static/worker.js', location.href), { type: 'module' });
    const waiting = new Map(), blobs = new Map();
    let seq = 0, status = { ready: false, message: 'Starting the app in your browser…' };
    worker.onmessage = e => {
      const m = e.data;
      if (m.type === 'status') { status = m.status; return; }
      const w = waiting.get(m.id); if (w) { waiting.delete(m.id); w(m); }
    };
    worker.onerror = e => { status = { ready: false, error: 'The app could not start in this browser: ' + (e.message || 'unknown error') }; };
    const call = (method, path, body) => new Promise(res => { const id = ++seq; waiting.set(id, res); worker.postMessage({ id, method, path, body }); });
    async function fileUrl(path) {
      if (blobs.has(path)) return blobs.get(path);
      const r = await call('GET', path);
      if (r.status !== 200) throw new Error('File not found');
      const u = URL.createObjectURL(new Blob([r.bytes], { type: r.ctype }));
      blobs.set(path, u); return u;
    }
    async function rewrite(o) {                        // file links in answers become in-browser file links
      if (typeof o === 'string') return o.startsWith('/files/') ? fileUrl(o) : o;
      if (Array.isArray(o)) return Promise.all(o.map(rewrite));
      if (o && typeof o === 'object') { for (const k of Object.keys(o)) o[k] = await rewrite(o[k]); }
      return o;
    }
    window.PB = {
      status: () => status, call, fileUrl, rewrite,
      async download(name) {
        const u = await fileUrl('/files/' + encodeURIComponent(name));
        const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      },
    };
  }
  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!/^\/(api|files)\//.test(url)) return realFetch(input, init);
    const json = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
    const st = PB.status();
    if (!st.ready && url.startsWith('/api/status')) return json(st);
    if (!st.ready && url === '/api/ping') return json({});
    const method = (init && init.method) || 'GET';
    const body = init && init.body ? JSON.parse(init.body) : null;
    const r = await PB.call(method, url, body);
    if (r.text != null && /json/.test(r.ctype)) return json(await PB.rewrite(JSON.parse(r.text)), r.status);
    return new Response(r.text != null ? r.text : r.bytes, { status: r.status, headers: { 'Content-Type': r.ctype } });
  };
})();
