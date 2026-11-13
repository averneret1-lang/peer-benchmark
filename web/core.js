'use strict';
// ---------------------------------------------------------------- helpers
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
const COLORS = ['#B08D57', '#2F5D8A', '#7A8796', '#6D4C63', '#3F6E5A', '#8A909A'];
const qlabel = p => p ? `Q${+p.slice(5) / 3} ${p.slice(0, 4)}` : '';
const qshort = p => `Q${+p.slice(5) / 3} '${p.slice(2, 4)}`;
const title = s => String(s || '').toLowerCase().replace(/(^|[\s\-/&(.])([a-z])/g, (m, a, b) => a + b.toUpperCase())
  .replace(/\bMc([a-z])(?=[a-z]{2,})/g, (m, c) => 'Mc' + c.toUpperCase())
  .replace(/\b(Fcu|Cu|Usa|Us|Td|Pnc|Bmo|Ssb|Esl|Ibm|Hsbc|Fsb|Llc|Nb|Fnb|Aod|Tva|Nasa|Usaa|Pcu|Ccu)\b/g, m => m.toUpperCase())
  .replace(/\b(Ubs|Umb|Ozk|Bny|Nbt|Rbc|Cnb|Lcnb|Mvb|Qnb|Anb|Inb|Fcb|Pcb|Bcb|Smbc|Ctbc|Usf|Tlc|Idb|Bmw|Wex|Eecu|Gecu|Bokf|Cibc|Acnb|Abnb|Wafd|Bhcu|Afl|Adp|Acb|Cahp|Camc|Amnh|Afgm|Bmi|Cme|Cce|Cbi|Cusb|Esb|Osb|Unb|Ynb|Fsa|Tbo|Tib|Dba|Mcnb)\b/g, m => m.toUpperCase())
  .replace(/\b(?!(?:St|Mt|Ft|Dr|Mr|Ms|Jr|Sr|Mtn|Ctr|Hts|Pkwy|Blvd)\b)([B-DF-HJ-NP-TV-XZ][b-df-hj-np-tv-xz]{1,4})\b/g, w => w.toUpperCase())   // vowel-less words are acronyms
  .replace(/\b(Ornl|Gte|Lge|Gfa|Usc|Iq|Omb|Sla|Elga)\b/g, m => m.toUpperCase())
  .replace(/\b[A-Z][a-z]{0,5}cu\b/g, w => w.toUpperCase())   // DFCU, TTCU, DATCU, LAFCU ...
  .replace(/(?<=\b[Oo]f )(Va|Ny|Pa|Ca|Nj|Nc|Sc|Tx|Ga|Ok|Ky|Wv|Nh|Ri|Md|Se|Nw|Sw)\b(?![.\w])/g, m => m.toUpperCase())
  .replace(/\b(Va|Ny|Pa|Nj|Nc|Sc|Wv|Nh)\b(?= (?:Employees|Community|Medical|State|Teachers|Educators)\b)/g, m => m.toUpperCase())
  .replace(/s'$/, "s' Credit Union")   // NCUA drops the suffix from names like STATE EMPLOYEES'
  .replace(/\bJpmorgan\b/g, 'JPMorgan').replace(/\bCfbank\b/g, 'CFBank')
  .replace(/(?<=\S )(Of|And|In|At|For|On)(?= \S)/g, w => w.toLowerCase())
  .replace(/(?<=\b(?:of|in|at|for|on) )The(?= \S)/g, 'the');

const noNegZero = t => (+t === 0 ? t.replace('-', '') : t);   // -0.00% reads as a bug
const signed = (d, n, unit) => { const t = noNegZero((d * 100).toFixed(n)); return (+t > 0 ? '+' : '') + t + unit; };
function fmt(v, kind, opt) {
  if (v == null || Number.isNaN(v)) return 'n/a';
  const o = opt || {};
  switch (kind) {
    case 'pct': case 'rate': return noNegZero((v * 100).toFixed(o.d != null ? o.d : 2)) + '%';
    case 'pct1': return noNegZero((v * 100).toFixed(1)) + '%';
    case 'usd': {
      const a = Math.abs(v), s = v < 0 ? '-' : '';
      if (a >= 1e12) return s + '$' + (a / 1e12).toFixed(2) + 'T';
      if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(2) + 'B';
      if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(1) + 'M';
      if (o.full || a < 1e5) return s + '$' + Math.round(a).toLocaleString();
      return s + '$' + (a / 1e3).toFixed(0) + 'K';
    }
    case 'usdfull': return (v < 0 ? '-$' : '$') + Math.round(Math.abs(v)).toLocaleString();
    case 'int': return Math.round(v).toLocaleString();
    case 'num': return v.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1});
    case 'num2': return v.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    case 'x': return v.toFixed(2) + 'x';
    default: return String(v);
  }
}
// change between two values of a metric, in the unit a reader expects
function fmtDelta(a, b, kind) {
  if (a == null || b == null) return '';
  const d = a - b;
  if (kind === 'pct' || kind === 'rate') return signed(d, 2, ' pts');
  if (!b) return '';
  return (d >= 0 ? '+' : '') + (d / Math.abs(b) * 100).toFixed(1) + '%';
}
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = err ? 'err' : ''; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, err ? 7000 : 3200); }

async function api(name, body) {
  const r = await fetch('/api/x/' + name, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})});
  const j = await r.json();
  if (j && j.error) { const e = new Error(j.error); e.preparing = j.preparing; throw e; }
  return j;
}
async function apiGet(name, params) {
  const r = await fetch('/api/x/' + name + '?' + new URLSearchParams(params || {}));
  const j = await r.json();
  if (j && j.error) throw new Error(j.error);
  return j;
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ---------------------------------------------------------------- state
const S = {type: 'cu', subj: null, period: null, groups: [{preset: 'default'}], mode: null, tab: 'scorecard',
  metric: null, dash: '@scorecard', years: 5, freq: 'q', chart: 'line', lib: null, groupMeta: [], saved: {peers: [], dashboards: []}};
const PRESET_LABEL = {default: 'Same state + asset tier', state_tier: 'Same state + asset tier (no widening)', tier: 'Asset tier, nationwide',
  state: 'Same state, all sizes', group: null, national: null, nearest: '20 closest in asset size (nationwide)', nearest_state: '10 closest in asset size (same state)'};
const instWord = (k, n) => (k || S.type) === 'bank' ? (n === 1 ? 'bank' : 'banks') : (n === 1 ? 'credit union' : 'credit unions');

function saveState() {
  try { localStorage.setItem('pa-' + S.type, JSON.stringify({subj: S.subj, groups: S.groups, mode: S.mode, metric: S.metric, dash: S.dash, years: S.years, freq: S.freq}));
    localStorage.setItem('pa-last', JSON.stringify({type: S.type, tab: S.tab})); } catch (e) {}
}
function loadState(type) {
  let d = {};
  try { d = JSON.parse(localStorage.getItem('pa-' + type) || '{}'); } catch (e) {}
  Object.assign(S, {type, subj: d.subj || null, groups: d.groups && d.groups.length ? d.groups : [{preset: 'default'}], mode: d.mode || null,
    metric: d.metric || null, dash: d.dash || '@scorecard', years: d.years || 5, freq: d.freq || 'q', groupMeta: []});
}
// the request context every analysis call shares
function subjReq() { return S.subj ? (S.subj.merge ? {merge: S.subj.merge, name: S.subj.name} : {id: S.subj.id}) : null; }
function effGroups() {
  // presets relative to an institution fall back to "all" when none is selected
  return S.groups.map(g => (!S.subj && g.preset && g.preset !== 'national') ? {preset: 'national', kind: g.kind} : g);
}
function ctx(extra) { return Object.assign({type: S.type, subject: subjReq(), groups: effGroups(), period: S.period, mode: S.mode || S.lib.default_mode}, extra || {}); }
function metricDef(key) {
  for (const f of S.lib.folders) for (const m of f.metrics) if (m.key === key) return m;
  return null;
}
function groupLabel(g, i) {
  const meta = S.groupMeta[i];
  if (meta && meta.name) return meta.name;
  if (g.name) return g.name;
  if (g.inst) return g.label || 'Institution';
  if (g.preset === 'national') return 'All U.S. ' + instWord(g.kind || S.type);
  if (g.preset === 'group') return S.type === 'cu' ? 'Same NCUA peer group' : 'Same FDIC specialization';
  return (PRESET_LABEL[g.preset] || 'Custom group') + (g.kind && g.kind !== S.type ? ' (' + instWord(g.kind) + ')' : '');
}

// ---------------------------------------------------------------- context bar
function renderGroups() {
  const box = $('#groups');
  box.innerHTML = '';
  const eg = effGroups();
  S.groups.forEach((g, i) => {
    const meta = S.groupMeta[i];
    const chip = el(`<span class="chip" title="${esc(groupLabel(eg[i], i))}${meta && meta.note ? '\n' + esc(meta.note) : ''}"><i style="background:${COLORS[(i + 1) % COLORS.length]}"></i><span>${esc(groupLabel(eg[i], i))}</span>${meta && meta.type === 'group' ? `<small>${meta.n}</small>` : ''}<button title="Remove">×</button></span>`);
    $('button', chip).onclick = () => { S.groups.splice(i, 1); S.groupMeta.splice(i, 1); if (!S.groups.length) S.groups = [{preset: S.subj ? 'default' : 'national'}]; changed(); };
    if (i > 0) { chip.style.cursor = 'pointer'; $('span', chip).onclick = () => { const [x] = S.groups.splice(i, 1); S.groups.unshift(x); S.groupMeta = []; changed(); }; $('span', chip).title = 'Click to make this the ranking group'; }
    box.appendChild(chip);
  });
  const add = el('<button class="btn sm">+ Add comparison</button>');
  add.onclick = e => { e.stopPropagation(); groupMenu(add); };
  box.appendChild(add);
}
function closeMenus() { $$('.menu').forEach(m => m.remove()); }
document.addEventListener('click', e => { if (!e.target.closest('.menu')) closeMenus(); });
addEventListener('resize', closeMenus);
document.addEventListener('scroll', e => { if (!(e.target.closest && e.target.closest('.menu'))) closeMenus(); }, true);
function openMenu(anchor, html) {
  closeMenus();
  const m = el(`<div class="menu">${html}</div>`);
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - m.offsetWidth - 8)) + 'px';
  const below = window.innerHeight - r.bottom - 16, above = r.top - 16;
  if (below < 220 && above > below) {                        // not enough room under the button: open upward
    m.style.maxHeight = above + 'px'; m.style.top = Math.max(8, r.top - 4 - Math.min(m.offsetHeight, above)) + 'px';
  } else { m.style.top = (r.bottom + 4) + 'px'; m.style.maxHeight = Math.max(160, below) + 'px'; }
  return m;
}
function addGroup(g) { if (S.groups.length >= 5) { toast('Up to five comparison groups.', true); return; } S.groups.push(g); S.groupMeta = []; changed(); }
function groupMenu(anchor) {
  const other = S.type === 'cu' ? 'bank' : 'cu';
  const rel = S.subj ? `
    <h5>Relative to ${esc(S.subj.name)}</h5>
    <a data-p="default">Same state + asset tier<small>Widens to neighboring states if fewer than 10 peers</small></a>
    <a data-p="tier">Asset tier, nationwide</a>
    <a data-p="state">Same state, all sizes</a>
    <a data-p="group">${S.type === 'cu' ? 'Same NCUA peer group' : 'Same FDIC specialization group'}</a>
    <a data-p="nearest">20 closest in asset size, nationwide</a>
    <a data-p="nearest_state">10 closest in asset size, same state</a>` : '';
  const saved = S.saved.peers.length ? '<h5>My saved peer groups</h5>' + S.saved.peers.map((p, i) => `<a data-s="${i}">${esc(p.name)}</a>`).join('') : '';
  const m = openMenu(anchor, `${rel}
    <h5>Industry</h5>
    <a data-p="national">All U.S. ${instWord(S.type)}</a>
    <a data-o="national">All U.S. ${instWord(other)}<small>Cross-industry: ratios both industries report</small></a>
    ${S.subj ? `<a data-o="tier">${title(instWord(other))} in the same asset tier</a><a data-o="state">${title(instWord(other))} in the same state</a>` : ''}
    ${saved}
    <h5>Other</h5>
    <a data-x="inst">A specific institution…<small>Head-to-head against one ${instWord(S.type, 1)} or ${instWord(other, 1)}</small></a>
    <a data-x="build">Build a custom peer group…</a>`);
  m.onclick = e => {
    const a = e.target.closest('a'); if (!a) return;
    closeMenus();
    if (a.dataset.p) addGroup({preset: a.dataset.p});
    else if (a.dataset.o) addGroup({preset: a.dataset.o, kind: other});
    else if (a.dataset.s) addGroup(Object.assign({name: S.saved.peers[+a.dataset.s].name}, S.saved.peers[+a.dataset.s].spec));
    else if (a.dataset.x === 'build') go('peers');
    else if (a.dataset.x === 'inst') pickInstitution(pick => addGroup({inst: pick.id, kind: pick.type, label: pick.name, name: pick.name}));
  };
}
// generic institution search box (used by the header, merger builder, head-to-head)
function attachSearch(input, list, getType, onPick) {
  let items = [], hl = -1;
  const run = debounce(async () => {
    const q = input.value.trim();
    if (!q) { list.hidden = true; return; }
    try { items = await apiGet('search', {type: getType(), q}); } catch (e) { items = []; }
    hl = -1;
    list.innerHTML = items.length ? items.map((d, i) => `<li data-i="${i}">${esc(title(d.name))} <small>${esc(title(d.city))}, ${esc(d.state)} · ${fmt(d.assets, 'usd')} · ${getType() === 'bank' ? 'cert ' : '#'}${esc(d.id)}</small></li>`).join('') : '<li><small>No match</small></li>';
    list.hidden = false;
  }, 170);
  input.addEventListener('input', run);
  input.addEventListener('keydown', e => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { hl = Math.max(0, Math.min(items.length - 1, hl + (e.key === 'ArrowDown' ? 1 : -1))); $$('li', list).forEach((li, i) => li.classList.toggle('hl', i === hl)); e.preventDefault(); }
    else if (e.key === 'Enter' && items.length) { pick(items[Math.max(hl, 0)]); e.preventDefault(); }
    else if (e.key === 'Escape') list.hidden = true;
  });
  list.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) pick(items[+li.dataset.i]); });
  document.addEventListener('click', e => { if (e.target !== input && !list.contains(e.target)) list.hidden = true; });
  function pick(d) { list.hidden = true; onPick(Object.assign({type: getType()}, d, {name: title(d.name)})); }
}
function modal(html) { $('#modalbody').innerHTML = html; $('#modal').hidden = false; return $('#modalbody'); }
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
function pickInstitution(cb, opts) {
  let t = (opts && opts.type) || S.type;
  const b = modal(`<h2 style="margin:0 0 10px">${esc((opts && opts.title) || 'Pick an institution')}</h2>
    ${opts && opts.type ? '' : `<div class="seg sm" id="pk"><button data-t="cu" class="${t === 'cu' ? 'on' : ''}">Credit unions</button><button data-t="bank" class="${t === 'bank' ? 'on' : ''}">Banks</button></div>`}
    <div class="search" style="margin-top:10px"><input type="text" id="pq" placeholder="Name, charter or cert number" autocomplete="off"><ul id="pl" hidden></ul></div>
    <div style="height:310px"></div><div style="text-align:right"><button class="btn" id="pc">Cancel</button></div>`);
  $$('#pk button', b).forEach(x => x.onclick = () => { t = x.dataset.t; $$('#pk button', b).forEach(y => y.classList.toggle('on', y === x)); $('#pq', b).dispatchEvent(new Event('input')); });
  attachSearch($('#pq', b), $('#pl', b), () => t, d => { closeModal(); cb(d); });
  $('#pc', b).onclick = closeModal;
  $('#pq', b).focus();
}

// ---------------------------------------------------------------- tabs
const TABS = [['scorecard', 'Scorecard'], ['trends', 'Trends & library'], ['rank', 'Rankings & screens'], ['fin', 'Financials'],
  ['rom', 'Member value'], ['merger', 'Merger'], ['market', 'Market share'], ['peers', 'Peer groups'], ['formulas', 'Formulas'], ['reports', 'PDF reports']];
const VIEWS = {};
function renderTabs() {
  $('#tabs').innerHTML = TABS.filter(t => !(t[0] === 'rom' && S.type === 'bank')).map(([k, l]) => `<button data-k="${k}" class="${k === S.tab ? 'on' : ''}">${l}</button>`).join('');
  $$('#tabs button').forEach(b => b.onclick = () => go(b.dataset.k));
  const onTab = $('#tabs .on'); if (onTab) onTab.scrollIntoView({block: 'nearest', inline: 'nearest'});
}
function go(tab, opts) {
  S.tab = tab;
  if (tab === 'rom' && S.type === 'bank') S.tab = 'scorecard';
  renderTabs(); saveState();
  $('#ctx').style.display = S.tab === 'reports' ? 'none' : '';
  render(opts);
}
// Loading lines: something to read while the numbers arrive.
const QUIPS = [
  'Counting every penny. Twice, because we are bankers.',
  'Reconciling the ledgers. They never agree on the first try.',
  'Asking 4,000 credit unions to line up by asset size…',
  'Annualizing year-to-date income. Multiply by 4, divide by the quarter, pray.',
  'Your peer group is putting on its good suit.',
  'Calculating ROA. Return on Anticipation is high.',
  'Teaching Python to read call reports. It prefers novels.',
  'Bribing the efficiency ratio to look efficient.',
  'Sorting deposits from the couch cushions of America.',
  'Trimming the 5th and 95th percentiles. Sorry, outliers.',
  'Loans are growing. So is this progress bar, in spirit.',
  'Cost of funds: high. Cost of this wait: a few seconds.',
  'Checking that assets still equal liabilities plus equity. Phew.',
  'Waking up the examiners. Gently.',
  'Fetching 80 quarters of history. History is heavy.',
  'Converting thousands to dollars. No decimals were harmed.',
  'Net interest margin? We are working on our net patience margin.',
  'Comparing apples to apples. No bananas in this peer group.',
  'Good analysis is like compound interest. It takes a moment.',
  'Shaking hands with the FDIC and the NCUA. They both say hi.',
  'Stress testing your patience. You are passing with flying colors.',
  'Polishing the charts until the gold shows.',
  'Members first. Data second. Jokes third.',
  'Loading faster than a wire on a Friday afternoon.',
];
let quipAt = Math.floor(Math.random() * QUIPS.length);
function nextQuip(el) {
  if (!el) return;
  el.classList.add('fade');
  setTimeout(() => { el.textContent = QUIPS[quipAt++ % QUIPS.length]; el.classList.remove('fade'); }, el.textContent ? 400 : 0);
}
function rotateQuips(el, ms) { nextQuip(el); return setInterval(() => nextQuip(el), ms || 4500); }
let busyTimer = null, busyRot = null;
function busyQuip(on) {
  const box = $('#busyquip'); if (!box) return;
  clearTimeout(busyTimer); clearInterval(busyRot);
  if (!on) { box.hidden = true; return; }
  busyTimer = setTimeout(() => { box.hidden = false; busyRot = rotateQuips(box.querySelector('.quip')); }, 1500);   // only for slow loads
}
let renderSeq = 0;
async function render(opts) {
  const seq = ++renderSeq, view = $('#view');
  view.classList.add('busy'); busyQuip(true);
  try { await VIEWS[S.tab](view, opts || {}, () => seq === renderSeq); }
  catch (e) { if (seq === renderSeq) view.innerHTML = `<div class="card"><div class="note">${esc(e.message)}</div></div>`; }
  finally { if (seq === renderSeq) { view.classList.remove('busy'); busyQuip(false); } }
}
function changed() { saveState(); renderGroups(); render(); }
function setGroupMeta(groups, subject) { if (subject && S.subj && !S.subj.merge && subject.name) { S.subj.name = subject.name; S.subj.assets = subject.assets; if (document.activeElement !== $('#subj')) $('#subj').value = subject.name; } S.groupMeta = groups.map(g => ({name: g.name, n: g.n, note: g.note, type: g.type, kind: g.kind})); renderGroups(); }

// ---------------------------------------------------------------- exports
function getFile(name) { if (window.PB) return PB.download(name); location.href = '/files/' + encodeURIComponent(name); }
async function exportXlsx(filename, sheets) {
  try { const r = await api('export', {filename, sheets}); getFile(r.name); toast(window.PB_STATIC ? 'Excel workbook downloaded.' : 'Excel workbook saved to the output folder.'); }
  catch (e) { toast(e.message, true); }
}
async function exportPptx(filename, slides) {
  try { const r = await api('pptx', {filename, slides}); getFile(r.name); toast(window.PB_STATIC ? 'PowerPoint deck downloaded.' : 'PowerPoint deck saved to the output folder.'); }
  catch (e) { toast(e.message, true); }
}
const headline = () => (S.subj ? S.subj.name : 'Peer group') + ' ' + qlabel(S.period);

// ---------------------------------------------------------------- boot
async function setType(t, keepTab) {
  loadState(t);
  $$('#kind button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $('#subj').value = S.subj ? (/[a-z]/.test(S.subj.name) ? S.subj.name : title(S.subj.name)) : '';
  [S.lib, S.saved] = await Promise.all([apiGet('lib', {type: t}), api('saved', {type: t})]);
  if (!S.metric || !metricDef(S.metric)) S.metric = t === 'cu' ? 'roa' : 'roaa';
  S.period = S.lib.periods[S.lib.periods.length - 1];
  $('#period').innerHTML = S.lib.periods.slice().reverse().map(p => `<option value="${p}">${qlabel(p)}</option>`).join('');
  $('#mode').innerHTML = Object.entries(S.lib.modes).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('#mode').value = S.mode || S.lib.default_mode;
  renderGroups();
  if (!keepTab) go(S.tab); else { renderTabs(); render(); }
}
async function reloadLib() { S.lib = await apiGet('lib', {type: S.type}); S.saved = await api('saved', {type: S.type}); }

async function waitReady() {
  const rot = rotateQuips($('#quip'));
  for (;;) {
    try {
      const s = await (await fetch('/api/status')).json();
      if (s.error) { $('#loadmsg').textContent = 'Could not load data: ' + s.error; return false; }
      if (s.ready) {
        const a = await (await fetch('/api/x/state')).json();
        if (a.ready) { clearInterval(rot); $('#loading').hidden = true; return true; }
        $('#loadmsg').textContent = a.error ? 'Could not prepare the analyzer: ' + a.error : (a.message || 'Preparing the full call report library…');
      } else $('#loadmsg').textContent = s.message || 'Loading…';
    } catch (e) { $('#loadmsg').textContent = 'Peer Benchmark is not running. Open it from the Desktop shortcut; this window will reconnect.'; $('#loading').hidden = false; }
    await new Promise(r => setTimeout(r, 1200));
  }
}
async function refreshStatus() {
  try {
    const s = await (await fetch('/api/status')).json();
    if (s.coverage) { const c = s.coverage, d = x => new Date(x + 'T12:00').toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
      $('#coverage').innerHTML = `Data through: credit unions ${qlabel(c.cu.through)} · banks ${qlabel(c.bank.through)}${c.cu.next_check ? `<br>Next automatic check: banks ${d(c.bank.next_check)} · CUs ${d(c.cu.next_check)}` : ''}`; }
    if (s.static) $('#refresh').hidden = true;
    let dis = null; try { dis = localStorage.getItem('pb-dismissed'); } catch (e) {}
    if (s.notice && s.notice !== dis) { $('#noticetext').textContent = s.notice; $('#notice').hidden = false; }
    if (refreshStatus.v != null && s.data_version !== refreshStatus.v) setType(S.type, true);
    refreshStatus.v = s.data_version;
  } catch (e) {}
}
async function boot() {
  let last = {};
  try { last = JSON.parse(localStorage.getItem('pa-last') || '{}'); } catch (e) {}
  S.tab = VIEWS[last.tab] ? last.tab : 'scorecard';
  $$('#kind button').forEach(b => b.onclick = () => setType(b.dataset.t));
  attachSearch($('#subj'), $('#subjlist'), () => S.type, d => {
    S.subj = {id: d.id, name: d.name, state: d.state, assets: d.assets}; $('#subj').value = title(d.name); S.groupMeta = [];
    if (S.groups.length === 1 && S.groups[0].preset === 'national') S.groups = [{preset: 'default'}];
    changed();
  });
  $('#subj').addEventListener('focus', () => $('#subj').select());
  $('#subj').addEventListener('input', () => { if (!$('#subj').value.trim() && S.subj) { S.subj = null; S.groupMeta = []; changed(); } });
  $('#period').onchange = () => { S.period = $('#period').value; S.groupMeta = []; changed(); };
  $('#mode').onchange = () => { S.mode = $('#mode').value; changed(); };
  $('#noticeclose').onclick = e => { e.preventDefault(); $('#notice').hidden = true; try { localStorage.setItem('pb-dismissed', $('#noticetext').textContent); } catch (x) {} };
  $('#refresh').onclick = async () => {
    const b = $('#refresh'); b.disabled = true; b.textContent = 'Checking…';
    try { const r = await (await fetch('/api/refresh', {method: 'POST'})).json(); toast(r.message); await refreshStatus(); }
    catch (e) { toast('Update failed: ' + e, true); } finally { b.disabled = false; b.textContent = 'Check for new data'; }
  };
  setInterval(() => fetch('/api/ping').catch(() => {}), 5000);
  setInterval(refreshStatus, 60000);
  if (!(await waitReady())) return;
  await setType(last.type === 'bank' ? 'bank' : 'cu');
  refreshStatus();
}
