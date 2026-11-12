// Web Worker: starts Python (Pyodide) with the app's own code and answers the page's /api and /files requests.
import { loadPyodide } from '../pyodide/pyodide.mjs';

const here = new URL('../', self.location).href;   // site root (this file lives in static/)
const say = (message, extra) => postMessage({ type: 'status', status: { ready: false, message, ...extra } });
let py, bridge;

async function start() {
  say('Starting the app in your browser (the first visit downloads about 35 MB)…');
  py = await loadPyodide({ indexURL: here + 'pyodide/' });
  say('Loading the analysis engine…');
  const local = ['openpyxl', 'et_xmlfile', 'reportlab'];
  const manifest = await (await fetch(here + 'pyodide/extra/index.json')).json();
  await py.loadPackage(['numpy', 'pandas', 'matplotlib', 'pillow', 'charset-normalizer',
    ...manifest.filter(f => local.some(n => f.startsWith(n))).map(f => here + 'pyodide/extra/' + f)]);
  const zip = await (await fetch(here + 'app.zip')).arrayBuffer();
  py.unpackArchive(zip, 'zip', { extractDir: '/app' });
  // saved peer groups, dashboards and formulas stay in this browser between visits
  py.FS.mkdirTree('/app/data/user');
  py.FS.mount(py.FS.filesystems.IDBFS, {}, '/app/data/user');
  await new Promise(r => py.FS.syncfs(true, r));
  say('Opening the credit union and bank data…');
  py.runPython("import sys; sys.path.insert(0, '/app'); sys.path.insert(0, '/app/static')");
  bridge = py.pyimport('bridge');
  bridge.setup(here + 'data/');
  postMessage({ type: 'status', status: { ready: true, message: '' } });
}
const started = start().catch(e => { postMessage({ type: 'status', status: { ready: false, error: String(e && e.message || e) } }); throw e; });

const SAVES = /\/api\/x\/(save|formula_save)/;
onmessage = async e => {
  const { id, method, path, body } = e.data;
  try {
    await started;
    const r = bridge.handle(method, path, body == null ? null : JSON.stringify(body)).toJs();
    const [status, ctype, payload] = r;
    if (SAVES.test(path)) py.FS.syncfs(false, () => {});
    if (typeof payload === 'string') postMessage({ id, status, ctype, text: payload });
    else { const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload); postMessage({ id, status, ctype, bytes }, [bytes.buffer]); }
  } catch (err) {
    postMessage({ id, status: 500, ctype: 'application/json', text: JSON.stringify({ error: String(err && err.message || err) }) });
  }
};
