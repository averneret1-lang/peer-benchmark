'use strict';
function metricOptions(sel) {
  return S.lib.folders.map(f => `<optgroup label="${esc(f.name)}">` + f.metrics.map(m => `<option value="${esc(m.key)}" ${m.key === sel ? 'selected' : ''}>${esc(m.label)}</option>`).join('') + '</optgroup>').join('');
}
const pctColor = p => p >= 67 ? 'var(--good)' : p >= 33 ? '#C9A227' : 'var(--bad)';
const pbar = p => p == null ? '' : `<span class="pbar" title="${Math.round(p)}th percentile (100 = best)"><b style="width:${Math.max(3, p)}%;background:${pctColor(p)}"></b></span> <span class="muted" style="display:inline-block;width:24px;text-align:right">${Math.round(p)}</span>`;
const starHtml = n => n ? `<span class="stars" title="${n} of 5 stars">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>` : '';
function dashMetrics() {
  const d = S.dash;
  if (d === '@scorecard') return S.lib.scorecard;
  if (d === '@cross') return S.lib.cross;
  if (d.startsWith('f:')) { const f = S.lib.folders.find(x => x.name === d.slice(2)); return f ? f.metrics.map(m => m.key) : S.lib.scorecard; }
  if (d.startsWith('d:')) { const x = S.saved.dashboards.find(y => y.name === d.slice(2)); return x ? x.metrics : S.lib.scorecard; }
  return S.lib.scorecard;
}
function dashName() {
  const d = S.dash;
  return d === '@scorecard' ? 'Key scorecard' : d === '@cross' ? 'Credit union vs bank comparison' : d.slice(2);
}

// ================================================================ Scorecard
VIEWS.scorecard = async (view, opts, live) => {
  const keys = dashMetrics().filter(k => metricDef(k));
  const res = await api('analyze', ctx({metrics: keys, years: 3, freq: 'q', insights: true}));
  if (!live()) return;
  setGroupMeta(res.groups, res.subject);
  const g0 = res.groups[0], hasS = !!res.subject;
  const dashSel = `<select id="dash">
    <optgroup label="Dashboards"><option value="@scorecard">Key scorecard</option><option value="@cross">Credit union vs bank comparison</option></optgroup>
    <optgroup label="Library folders">${S.lib.folders.map(f => `<option value="f:${esc(f.name)}">${esc(f.name)} (${f.metrics.length})</option>`).join('')}</optgroup>
    ${S.saved.dashboards.length ? '<optgroup label="My dashboards">' + S.saved.dashboards.map(d => `<option value="d:${esc(d.name)}">${esc(d.name)}</option>`).join('') + '</optgroup>' : ''}</select>`;
  const head = `<tr><th>Ratio</th>${hasS ? `<th class="nm">${esc(res.subject.name)}</th>` : ''}${res.groups.map((g, i) => `<th class="nm" title="${esc(g.name).replace(/(&lt;|&gt;) /g, '$1&nbsp;')}"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${COLORS[(i + 1) % COLORS.length]};margin-right:5px"></span>${esc(g.name).replace(/(&lt;|&gt;) /g, '$1&nbsp;')}</th>`).join('')}
    ${hasS ? '<th>Median</th><th>Rank</th><th class="l">Percentile</th><th class="l">Rating</th><th>1-yr change</th><th class="l">3-yr trend</th>' : ''}</tr>`;
  let body = '', folder = null;
  res.metrics.forEach(m => {
    if (m.error) { body += `<tr><td>${esc(m.label)}</td><td colspan="9" class="l muted">${esc(m.error)}</td></tr>`; return; }
    if (m.folder !== folder && S.dash !== '@scorecard' && S.dash !== '@cross' && !S.dash.startsWith('f:')) { folder = m.folder; }
    const L = m.latest || {}, last = m.subject ? m.subject.length - 1 : 0;
    body += `<tr class="click" data-k="${esc(m.key)}"><td title="${esc(m.desc || m.formula)}">${esc(m.label)}</td>
      ${hasS ? `<td class="strong">${fmt(L.value, m.fmt)}</td>` : ''}
      ${m.groups.map(g => `<td>${fmt(g[g.length - 1], m.fmt)}</td>`).join('')}
      ${hasS ? `<td>${fmt(L.median, m.fmt)}</td><td>${L.rank && !L.neutral ? L.rank + ' / ' + L.of : '<span class="muted">n/r</span>'}</td>
      <td class="l">${L.neutral ? '' : pbar(L.pct)}</td><td class="l">${starHtml(L.stars)}</td>
      <td>${fmtDelta(L.value, L.value_py, m.fmt)}</td><td class="l">${sparkline(m.subject, COLORS[0])}</td>` : ''}</tr>`;
  });
  const ins = (res.insights || []).map(i => `<div class="${i.kind}">${esc(i.text)}</div>`).join('');
  view.innerHTML = `
    <div class="card">
      <div class="bar"><div><h2>${esc(hasS ? res.subject.name : g0.name)}</h2>
        <div class="sub" style="margin:0">${qlabel(res.period)}${hasS ? ` · ${fmt(res.subject.assets, 'usd')} in assets · ranked against ${g0.n} ${instWord(g0.kind)}: ${esc(g0.name)}` : ` · ${g0.n} ${instWord(g0.kind)}`} <span style="white-space:nowrap">· peer value: ${esc(res.mode_label.toLowerCase())}</span></div></div>
        <span class="acts">${dashSel}
        <button class="btn" id="savedash" title="Save the ratios shown as a dashboard of your own">Save as dashboard</button>
        <button class="btn" id="xl">Excel</button><button class="btn" id="pp">PowerPoint</button><button class="btn" id="pr">Print / PDF</button>
        ${hasS && !S.subj.merge ? '<button class="btn pri" id="pdf" title="Branded PDF + Excel for this institution against the ranking group">Branded PDF report</button>' : ''}</span></div>
      ${res.groups.map(g => g.note ? `<div class="note">${esc(g.note)}</div>` : '').join('')}
      ${!hasS ? '<div class="sub">Pick a primary institution above to see ranks, percentiles, star ratings and a written analysis.</div>' : ''}
      ${ins ? `<h3>What stands out</h3><div class="ins">${ins}</div>` : ''}
    </div>
    <div class="card"><div class="bar"><h2>${esc(dashName())}</h2><span class="sp"></span><span class="hint">Click a row for its trend. n/r = not ranked (no better direction). Stars follow Callahan's scale: 5 = top 10%, 1 = bottom 10%.</span></div>
      <div class="scroll"><table class="t">${head}${body}</table></div></div>`;
  $('#dash').value = S.dash;
  $('#dash').onchange = () => { S.dash = $('#dash').value; saveState(); render(); };
  $$('tr.click', view).forEach(tr => tr.onclick = () => { S.metric = tr.dataset.k; go('trends'); });
  $('#pr').onclick = () => window.print();
  $('#savedash').onclick = async () => {
    const name = prompt('Name this dashboard (it saves the ratios currently shown):', S.dash.startsWith('d:') ? S.dash.slice(2) : '');
    if (!name) return;
    S.saved = await api('save', {type: S.type, what: 'dashboards', item: {name, metrics: keys}});
    S.dash = 'd:' + name; saveState(); render(); toast('Dashboard saved.');
  };
  const rowsFor = () => res.metrics.filter(m => !m.error).map(m => {
    const L = m.latest || {};
    return [m.label].concat(hasS ? [{v: L.value, fmt: m.fmt}] : [], m.groups.map(g => ({v: g[g.length - 1], fmt: m.fmt})),
      hasS ? [{v: L.median, fmt: m.fmt}, L.neutral ? null : L.rank, L.of, L.neutral || L.pct == null ? null : {v: L.pct / 100, fmt: 'pct0'}, L.stars, {v: L.value_py, fmt: m.fmt}] : []);
  });
  $('#xl').onclick = () => {
    const cols = [{label: 'Ratio', width: 40}].concat(hasS ? [{label: res.subject.name, width: 18}] : [], res.groups.map(g => ({label: g.name, width: 22})),
      hasS ? [{label: 'Peer median'}, {label: 'Rank'}, {label: 'Of'}, {label: 'Percentile'}, {label: 'Stars'}, {label: 'Value a year ago'}] : []);
    const trend = [];
    res.metrics.filter(m => !m.error).forEach(m => {
      if (m.subject) trend.push([m.label, res.subject.name].concat(m.subject.map(v => ({v, fmt: m.fmt}))));
      m.groups.forEach((g, i) => trend.push([m.label, res.groups[i].name].concat(g.map(v => ({v, fmt: m.fmt})))));
    });
    const sheets = [{name: 'Scorecard', title: headline() + ': ' + dashName(), subtitle: [`Ranked against ${g0.n} peers: ${g0.name}. Peer value: ${res.mode_label}.`].concat(res.groups.filter(g => g.note).map(g => g.note)), columns: cols, rows: rowsFor()},
      {name: 'Trend', columns: [{label: 'Ratio', width: 40}, {label: 'Series', width: 34}].concat(res.periods.map(p => ({label: qlabel(p), width: 12}))), rows: trend}];
    res.groups.forEach((g, i) => { if (g.roster) sheets.push({name: ('Peers ' + (i + 1)), title: g.name, columns: [{label: 'Institution', width: 40}, {label: 'ID'}, {label: 'City', width: 20}, {label: 'State'}, {label: 'Assets', fmt: 'usd', width: 18}], rows: g.roster.map(r => [r.name, r.id, r.city, r.state, r.assets])}); });
    if (res.insights && res.insights.length) sheets.push({name: 'Analysis', columns: [{label: 'What stands out', width: 150}], rows: res.insights.map(i => [i.text])});
    exportXlsx(headline() + ' Scorecard', sheets);
  };
  $('#pp').onclick = () => {
    const cols = ['Ratio'].concat(hasS ? [res.subject.name] : [], res.groups.map(g => g.name.length > 26 ? g.name.slice(0, 24) + '…' : g.name), hasS ? ['Rank', 'Percentile'] : []);
    const rows = res.metrics.filter(m => !m.error).map(m => { const L = m.latest || {}; return [m.label].concat(hasS ? [fmt(L.value, m.fmt)] : [], m.groups.map(g => fmt(g[g.length - 1], m.fmt)), hasS ? [L.rank && !L.neutral ? L.rank + ' / ' + L.of : '', L.neutral || L.pct == null ? '' : Math.round(L.pct)] : []); });
    const slides = [];
    if (res.insights && res.insights.length) slides.push({title: (hasS ? res.subject.name : g0.name) + ': what stands out', subtitle: `${qlabel(res.period)} · vs ${g0.n} peers: ${g0.name}`, note: res.insights.map(i => ({strength: '▲ ', weakness: '▼ ', gain: '↗ ', slip: '↘ '}[i.kind] || '') + i.text).join('\n')});
    for (let i = 0; i < rows.length; i += 18) slides.push({title: dashName() + (rows.length > 18 ? ` (${i / 18 + 1})` : ''), subtitle: `${hasS ? res.subject.name + ' · ' : ''}${qlabel(res.period)} · ${g0.name} (${g0.n}) · peer value: ${res.mode_label.toLowerCase()}`, table: {columns: cols, rows: rows.slice(i, i + 18)}});
    exportPptx(headline() + ' Scorecard', slides);
  };
  if ($('#pdf')) $('#pdf').onclick = () => brandedReport(g0);
};
// hand the ranking group to the existing branded PDF/Excel report generator
async function brandedReport(g0) {
  if (!g0.roster || !g0.roster.length) { toast('The ranking group has no members.', true); return; }
  if (g0.kind !== S.type) { toast('The first comparison group must be the same industry as the primary.', true); return; }
  toast('Building the branded PDF report…');
  try {
    const r = await (await fetch('/api/run', {method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({type: S.type, cu: S.subj.id, period: S.period, mode: 'custom', cu_list: g0.roster.map(x => x.id).join(',')})})).json();
    if (!r.ok) { toast(r.error, true); return; }
    if (!window.open(r.pdf, '_blank')) { const a = document.createElement('a'); a.href = r.pdf; a.download = r.name + '.pdf'; document.body.appendChild(a); a.click(); a.remove(); }
    toast(window.PB_STATIC ? 'Report ready (PDF).' : 'Report saved to the output folder (PDF and Excel).');
  } catch (e) { toast('Report failed: ' + e, true); }
}

// ================================================================ Trends & library
const TR = {q: '', open: null, proj: 'none', horizon: 3, rate: '', goal: ''};
function project(m, periods, vals) {
  if (TR.proj === 'none') return null;
  const pts = vals.map((v, i) => [i, v]).filter(p => p[1] != null);
  if (pts.length < 2) return null;
  const level = ['usd', 'int', 'num'].includes(m.fmt), last = pts[pts.length - 1], first = pts[0];
  const perYear = S.freq === 'a' ? 1 : S.freq === 's' ? 2 : 4, yrs = (last[0] - first[0]) / perYear, h = +TR.horizon;
  const out = [], labels = [];
  const lastP = periods[periods.length - 1];
  let fn;
  if (TR.proj === 'hist') {
    if (level && first[1] > 0 && last[1] > 0) { const g = Math.pow(last[1] / first[1], 1 / yrs) - 1; fn = t => last[1] * Math.pow(1 + g, t); }
    else { const sl = (last[1] - first[1]) / yrs; fn = t => last[1] + sl * t; }
  } else if (TR.proj === 'rate') {
    const r = parseFloat(TR.rate); if (Number.isNaN(r)) return null;
    fn = level ? t => last[1] * Math.pow(1 + r / 100, t) : t => last[1] + (m.fmt === 'pct' || m.fmt === 'rate' ? r / 100 : r) * t;
  } else {
    let goal = parseFloat(TR.goal); if (Number.isNaN(goal)) return null;
    if (m.fmt === 'pct' || m.fmt === 'rate') goal /= 100;
    fn = level && last[1] > 0 && goal > 0 ? t => last[1] * Math.pow(goal / last[1], t / h) : t => last[1] + (goal - last[1]) * t / h;
  }
  for (let t = 1; t <= h; t++) { out.push(fn(t)); labels.push(`Q${+lastP.slice(5) / 3} '${String(+lastP.slice(0, 4) + t).slice(2)}`); }
  return {values: out, labels};
}
VIEWS.trends = async (view, opts, live) => {
  const key = S.metric, m0 = metricDef(key) || {label: key.slice(1), fmt: 'num2', formula: key.slice(1)};
  const res = await api('analyze', ctx({metrics: [key], years: S.years, freq: S.freq}));
  if (!live()) return;
  setGroupMeta(res.groups, res.subject);
  const m = res.metrics[0];
  const curFolder = (S.lib.folders.find(f => f.metrics.some(x => x.key === key)) || {}).name;
  if (TR.open == null) TR.open = curFolder;
  const tree = () => {
    const q = TR.q.trim().toLowerCase();
    return S.lib.folders.map(f => {
      const ms = f.metrics.filter(x => !q || x.label.toLowerCase().includes(q) || x.key.includes(q) || x.formula.toLowerCase().includes(q));
      if (!ms.length) return '';
      const open = q || TR.open === f.name;
      return `<div class="f" data-f="${esc(f.name)}"><span>${esc(f.name)}</span><span class="muted">${ms.length}</span></div>` +
        (open ? ms.map(x => `<div class="m ${x.key === key ? 'on' : ''}" data-k="${esc(x.key)}" title="${esc(x.desc || x.formula)}">${esc(x.label)}</div>`).join('') : '');
    }).join('') || '<div class="m muted">No ratio matches.</div>';
  };
  const total = S.lib.folders.reduce((a, f) => a + f.metrics.length, 0);
  let main;
  if (m.error) main = `<div class="card"><div class="note">${esc(m.error)}</div></div>`;
  else {
    const L = m.latest || {}, hasS = !!res.subject;
    const series = (hasS ? [{name: res.subject.name, color: COLORS[0], values: m.subject}] : []).concat(res.groups.map((g, i) => ({name: g.name, color: COLORS[(i + 1) % COLORS.length], values: m.groups[i], dash: hasS})));
    const hist = `<table class="t"><tr><th>Series</th>${res.periods.map(p => `<th>${qshort(p)}</th>`).join('')}</tr>` +
      series.map((s, i) => `<tr class="${i === 0 && hasS ? 'me' : ''}"><td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.color};margin-right:6px"></span>${esc(s.name)}</td>${s.values.map(v => `<td>${fmt(v, m.fmt)}</td>`).join('')}</tr>`).join('') + '</table>';
    main = `
    <div class="card">
      <div class="bar"><div><h2>${esc(m.label)}</h2><div class="sub" style="margin:0">${hasS ? esc(res.subject.name) + ' vs ' : ''}${res.groups.map(g => esc(g.name) + (g.type === 'group' ? ` (${g.n})` : '')).join(' · ')} <span style="white-space:nowrap">· peer value: ${esc(res.mode_label.toLowerCase())}</span></div></div><span class="sp"></span>
        <div class="seg sm" id="yrs">${[[3, '3 yr'], [5, '5 yr'], [10, '10 yr'], [25, 'All']].map(([v, l]) => `<button data-v="${v}" class="${S.years == v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="seg sm" id="frq">${[['q', 'Quarterly'], ['s', 'Semi-annual'], ['a', 'Annual']].map(([v, l]) => `<button data-v="${v}" class="${S.freq === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="seg sm" id="ctype">${[['line', 'Line'], ['col', 'Column']].map(([v, l]) => `<button data-v="${v}" class="${S.chart === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <span class="btns"><button class="btn sm" id="xl">Excel</button><button class="btn sm" id="pp">PowerPoint</button><button class="btn sm" id="png">Image</button></span></div>
      ${res.groups.map(g => g.note ? `<div class="note">${esc(g.note)}</div>` : '').join('')}
      ${m.since && res.periods[0] < m.since ? `<div class="hint">The call report accounts behind this ratio start in ${qlabel(m.since)}; earlier quarters show n/a.</div>` : ''}
      <div id="chart"></div>
      ${hasS ? `<div class="bar" style="margin:8px 0 0"><label>Projection</label>
        <select id="pj"><option value="none">None</option><option value="hist">Continue the trend shown</option><option value="rate">Annual growth I enter</option><option value="goal">Reach a goal value</option></select>
        <input id="pjv" type="number" step="any" style="width:110px" placeholder="">
        <select id="pjh">${[1, 3, 5, 10].map(h => `<option value="${h}">${h} year${h > 1 ? 's' : ''}</option>`).join('')}</select><span class="hint" id="pjhint"></span></div>` : ''}
    </div>
    <div class="two">
      <div class="card"><h2>Standing in the ranking group</h2>
        ${hasS && L.rank && !L.neutral ? `<div class="tiles" style="margin-top:8px"><div class="tile"><small>Value</small><b>${fmt(L.value, m.fmt)}</b><em>${fmtDelta(L.value, L.value_py, m.fmt)} vs a year ago</em></div>
          <div class="tile"><small>Rank</small><b>${L.rank} <em>of ${L.of}</em></b>${starHtml(L.stars)}</div>
          <div class="tile"><small>Percentile (100 = best)</small><b>${Math.round(L.pct)}</b><em>peer value ${fmt(L.peer, m.fmt)}</em></div></div>` : `<div class="sub">${hasS ? 'Not ranked: this ratio has no better direction.' : 'Pick a primary institution to see its rank.'}</div>`}
        <div id="strip"></div></div>
      <div class="card"><h2>Definition</h2>
        <div class="sub">${esc(m.desc || 'No extra notes for this ratio.')}</div>
        <div class="fx">${esc(m.formula)}</div>
        <div class="hint" style="margin-top:8px">[code] = ${S.type === 'cu' ? 'NCUA 5300 account' : 'FDIC call report field'} · ann = annualized year-to-date · avg = average of current and prior year-end · yoy = 12-month growth. Build your own in the Formulas tab.</div>
        <div class="bar" style="margin:10px 0 0"><button class="btn sm" id="lead">Leader table for this ratio</button><button class="btn sm" id="adddash">Add to a dashboard</button></div></div>
    </div>
    <div class="card"><h2>History</h2><div class="hscroll">${hist}</div></div>`;
    view._draw = () => {
      const proj = hasS ? project(m, res.periods, m.subject) : null;
      lineChart($('#chart'), res.periods.map(qshort), series, {fmt: m.fmt, type: S.chart, proj});
      stripChart($('#strip'), L.dist, hasS ? L.value : null, m.fmt, m.hib, L.peer);
    };
    view._export = {series, m, res};
  }
  view.innerHTML = `<div class="cols"><div class="card" style="padding:10px">
      <input type="text" id="lq" placeholder="Search ${total} ratios" style="width:100%;margin-bottom:8px" value="${esc(TR.q)}">
      <div class="tree" id="tree">${tree()}</div></div><div>${main}</div></div>`;
  const bindTree = () => {
    $$('#tree .f').forEach(f => f.onclick = () => { TR.open = TR.open === f.dataset.f ? '' : f.dataset.f; $('#tree').innerHTML = tree(); bindTree(); });
    $$('#tree .m[data-k]').forEach(x => x.onclick = () => { S.metric = x.dataset.k; saveState(); render(); });
  };
  bindTree();
  const on = $('#tree .m.on'); if (on) on.scrollIntoView({block: 'nearest'});
  $('#lq').oninput = () => { TR.q = $('#lq').value; $('#tree').innerHTML = tree(); bindTree(); };
  if (m.error) return;
  view._draw();
  const seg = (id, fn) => $$('#' + id + ' button').forEach(b => b.onclick = () => { fn(b.dataset.v); saveState(); render(); });
  seg('yrs', v => S.years = +v); seg('frq', v => S.freq = v); seg('ctype', v => S.chart = v);
  if ($('#pj')) {
    const sync = () => {
      const lvl = ['usd', 'int', 'num'].includes(m.fmt);
      $('#pjv').style.display = TR.proj === 'rate' || TR.proj === 'goal' ? '' : 'none';
      $('#pjh').style.display = TR.proj === 'none' ? 'none' : '';
      $('#pjv').placeholder = TR.proj === 'rate' ? (lvl ? '% per year' : 'pts per year') : 'goal';
      $('#pjv').value = TR.proj === 'rate' ? TR.rate : TR.goal;
      $('#pjhint').textContent = TR.proj === 'hist' ? (lvl ? 'Compound growth rate over the window shown.' : 'Straight-line change over the window shown.') : TR.proj === 'goal' ? ((m.fmt === 'pct' || m.fmt === 'rate') ? 'Enter the goal in percent, e.g. 1.00.' : 'Enter the goal in the ratio\'s own unit.') : '';
    };
    $('#pj').value = TR.proj; $('#pjh').value = TR.horizon; sync();
    $('#pj').onchange = () => { TR.proj = $('#pj').value; sync(); view._draw(); };
    $('#pjh').onchange = () => { TR.horizon = +$('#pjh').value; view._draw(); };
    $('#pjv').oninput = () => { if (TR.proj === 'rate') TR.rate = $('#pjv').value; else TR.goal = $('#pjv').value; view._draw(); };
  }
  $('#lead').onclick = () => { RK.sort = key; RK.cols = RK.cols.filter(c => c !== key); go('rank'); };
  $('#adddash').onclick = async () => {
    const names = S.saved.dashboards.map(d => d.name);
    const name = prompt('Add "' + m.label + '" to which dashboard?' + (names.length ? '\nExisting: ' + names.join(', ') : '') + '\n(Type a new name to create one.)', names[0] || 'My dashboard');
    if (!name) return;
    const cur = S.saved.dashboards.find(d => d.name === name);
    const metrics = cur ? cur.metrics.filter(k => k !== key).concat(key) : [key];
    S.saved = await api('save', {type: S.type, what: 'dashboards', item: {name, metrics}});
    toast(`Added to "${name}". Open it from the Scorecard tab.`);
  };
  const ex = view._export;
  $('#xl').onclick = () => exportXlsx(headline() + ' ' + m.label, [{name: 'Trend', title: m.label, subtitle: [headline() + '. Peer value: ' + res.mode_label + '.', 'Formula: ' + m.formula],
    columns: [{label: 'Series', width: 44}].concat(res.periods.map(p => ({label: qlabel(p), fmt: m.fmt, width: 12}))), rows: ex.series.map(s => [s.name].concat(s.values))}]);
  $('#png').onclick = async () => { const u = await svgToPng($('#chart'), 2); if (u) downloadDataUrl(u, (headline() + ' ' + m.label).replace(/[^\w ()&-]+/g, ' ') + '.png'); };
  $('#pp').onclick = async () => {
    const img = await svgToPng($('#chart'), 2), L = m.latest || {};
    const last = res.periods.slice(-6);
    exportPptx(headline() + ' ' + m.label, [{title: m.label, subtitle: ex.series.map(s => s.name).join('  vs  ') + ' · ' + qlabel(res.period), image: img,
      table: {columns: ['Series'].concat(last.map(qshort)), rows: ex.series.map(s => [s.name].concat(s.values.slice(-6).map(v => fmt(v, m.fmt))))},
      note: L.rank && !L.neutral ? `Rank ${L.rank} of ${L.of} (${Math.round(L.pct)}th percentile) in ${res.groups[0].name}.` : ''}]);
  };
  window.onresize = debounce(() => { if (S.tab === 'trends' && view._draw) view._draw(); }, 200);
};

// ================================================================ Rankings & screens
const RK = {sort: null, cols: [], limit: 50, desc: null, group: 0, filters: [], mode: 'table', y: null};
VIEWS.rank = async (view, opts, live) => {
  if (!RK.sort || !metricDef(RK.sort)) { RK.sort = S.metric && metricDef(S.metric) ? S.metric : (S.type === 'cu' ? 'roa' : 'roaa'); RK.cols = ['assets'].filter(c => c !== RK.sort); RK.filters = []; }
  RK.cols = RK.cols.filter(c => metricDef(c));
  const gi = Math.min(RK.group, S.groups.length); // index == groups.length means "all"
  const same = effGroups().map((g, i) => ({g, i})).filter(x => !x.g.inst && (x.g.kind || S.type) === S.type && x.g.preset !== 'national');
  const pick = gi < S.groups.length && same.find(x => x.i === gi) ? effGroups()[gi] : (gi >= S.groups.length ? {preset: 'national'} : (same[0] ? same[0].g : {preset: 'national'}));
  const spec = Object.assign({}, pick); delete spec.kind;
  const filters = RK.filters.filter(f => f.metric && (f.min !== '' || f.max !== '')).map(f => { const d = metricDef(f.metric), k = d && (d.fmt === 'pct' || d.fmt === 'rate') ? 100 : 1; return {metric: f.metric, min: f.min === '' ? null : f.min / k, max: f.max === '' ? null : f.max / k}; });
  const base = {type: S.type, subject: subjReq(), period: S.period, mode: S.mode || S.lib.default_mode, spec, extra_filters: filters};
  let res, sc;
  if (RK.mode === 'scatter') { if (!RK.y || !metricDef(RK.y)) RK.y = S.type === 'cu' ? 'efficiency' : 'efficiency'; sc = await api('scatter', Object.assign({x: RK.sort, y: RK.y}, base)); }
  else res = await api('table', Object.assign({columns: [RK.sort].concat(RK.cols), sort: RK.sort, desc: RK.desc, limit: RK.limit}, base));
  if (!live()) return;
  const uni = `<select id="uni">${effGroups().map((g, i) => (!g.inst && (g.kind || S.type) === S.type && g.preset !== 'national') ? `<option value="${i}">${esc(groupLabel(g, i))}</option>` : '').join('')}<option value="${S.groups.length}">All U.S. ${instWord()}</option></select>`;
  const frows = RK.filters.map((f, i) => `<div class="bar" style="margin:4px 0"><select data-fi="${i}" class="fm" style="max-width:280px">${metricOptions(f.metric)}</select>
    <input type="number" step="any" class="fmin" data-fi="${i}" placeholder="min" value="${f.min}" style="width:90px"> to <input type="number" step="any" class="fmax" data-fi="${i}" placeholder="max" value="${f.max}" style="width:90px">
    <span class="hint">${(metricDef(f.metric) || {}).fmt === 'pct' || (metricDef(f.metric) || {}).fmt === 'rate' ? 'in percent' : (metricDef(f.metric) || {}).fmt === 'usd' ? 'in dollars' : ''}</span><button class="btn sm" data-fx="${i}">Remove</button></div>`).join('');
  const controls = `<div class="card"><div class="bar">
      <div class="seg sm" id="rmode"><button data-v="table" class="${RK.mode === 'table' ? 'on' : ''}">Leader table</button><button data-v="scatter" class="${RK.mode === 'scatter' ? 'on' : ''}">Correlation</button></div>
      <span class="nowrap"><label>Among</label>${uni}</span>
      <span class="nowrap"><label>${RK.mode === 'scatter' ? 'X axis' : 'Rank by'}</label><select id="rsort" style="max-width:280px">${metricOptions(RK.sort)}</select></span>
      ${RK.mode === 'scatter' ? `<span class="nowrap"><label>Y axis</label><select id="ry" style="max-width:280px">${metricOptions(RK.y)}</select></span>` : `
      <select id="rdir"><option value="">Best first</option><option value="1">Highest first</option><option value="0">Lowest first</option></select>
      <select id="rlim">${[25, 50, 100, 250, 500].map(n => `<option value="${n}">Top ${n}</option>`).join('')}</select>`}
      <span class="sp"></span><button class="btn sm" id="addf">+ Filter</button>${RK.mode === 'table' ? '<button class="btn sm" id="addc">+ Column</button><button class="btn sm" id="xl">Excel</button><button class="btn sm" id="mk" title="Save the institutions listed as a peer group">Save as peer group</button>' : '<button class="btn sm" id="png">Image</button>'}</div>
      ${frows}${RK.filters.length ? '<div class="hint">Filters narrow the group to institutions that meet every condition: a screen.</div>' : ''}</div>`;
  let body;
  if (RK.mode === 'scatter') {
    body = `<div class="card"><h2>${esc(sc.axes[1].label)} vs ${esc(sc.axes[0].label)}</h2><div class="sub">${sc.points.length} ${instWord()} in ${esc(sc.name)} · ${qlabel(sc.period)}${sc.corr != null ? ` · correlation ${sc.corr.toFixed(2)}` : ''} · far outliers are drawn at the edge of the chart</div><div id="sc"></div></div>`;
  } else {
    const hdr = `<tr><th>#</th><th class="l">Institution</th><th class="l">City</th>${res.columns.map(c => `<th class="sort" data-k="${esc(c.key)}">${esc(c.label)}${c.key === res.sort ? (res.desc ? ' ▼' : ' ▲') : ''}${c.key !== res.sort ? ` <a data-rm="${esc(c.key)}" title="Remove column" style="color:var(--mgray);cursor:pointer">×</a>` : ''}</th>`).join('')}</tr>`;
    const rows = res.rows.map(r => `<tr class="${r.subject ? 'me' : ''}"><td style="text-align:right">${r.rank}</td><td class="l"><a href="#" data-id="${esc(r.id)}" data-n="${esc(title(r.name))}" data-st="${esc(r.state)}" title="Make this the primary institution" style="color:inherit;text-decoration:none">${esc(title(r.name))}</a></td><td class="l muted">${esc(title(r.city))}, ${esc(r.state)}</td>${r.vals.map((v, i) => `<td>${fmt(v, res.columns[i].fmt)}</td>`).join('')}</tr>`).join('');
    const st = (lab, arr) => `<tr class="tot"><td></td><td class="l" colspan="2">${lab}</td>${arr.map((v, i) => `<td>${fmt(v, res.columns[i].fmt)}</td>`).join('')}</tr>`;
    body = `<div class="card"><h2>${esc(res.columns[0].label)}: ${res.desc ? 'highest' : 'lowest'} first</h2><div class="sub">${res.n.toLocaleString()} ${instWord(S.type, res.n)} in ${esc(res.name)}${RK.filters.length ? ' meet the screen' : ''} · ${res.total.toLocaleString()} ranked on this ratio${res.subject ? ' including ' + esc(res.subject.name) : ''} · ${qlabel(res.period)}${res.note ? ' · ' + esc(res.note) : ''}</div>
      <div class="scroll"><table class="t">${hdr}${rows}${st(esc(res.mode_label), res.stats.peer)}${st('Median', res.stats.median)}${st('Top quartile', res.stats.top25)}${st('Bottom quartile', res.stats.bot25)}</table></div>
      <div class="hint" style="margin-top:6px">Click a column heading to rank by it, or an institution to make it the primary.</div></div>`;
  }
  view.innerHTML = controls + body;
  $('#uni').value = String(gi >= S.groups.length ? S.groups.length : (same.find(x => x.i === gi) ? gi : (same[0] ? same[0].i : S.groups.length)));
  $('#uni').onchange = () => { RK.group = +$('#uni').value; render(); };
  $('#rsort').onchange = () => { RK.sort = $('#rsort').value; RK.desc = null; RK.cols = RK.cols.filter(c => c !== RK.sort); render(); };
  $$('#rmode button').forEach(b => b.onclick = () => { RK.mode = b.dataset.v; render(); });
  $('#addf').onclick = () => { RK.filters.push({metric: RK.sort, min: '', max: ''}); render(); };
  $$('.fm').forEach(s => s.onchange = () => { RK.filters[+s.dataset.fi].metric = s.value; render(); });
  $$('.fmin').forEach(s => s.onchange = () => { RK.filters[+s.dataset.fi].min = s.value === '' ? '' : +s.value; render(); });
  $$('.fmax').forEach(s => s.onchange = () => { RK.filters[+s.dataset.fi].max = s.value === '' ? '' : +s.value; render(); });
  $$('[data-fx]').forEach(b => b.onclick = () => { RK.filters.splice(+b.dataset.fx, 1); render(); });
  if (RK.mode === 'scatter') {
    $('#ry').onchange = () => { RK.y = $('#ry').value; render(); };
    scatterChart($('#sc'), sc.points, sc.subject, sc.axes);
    $('#png').onclick = async () => { const u = await svgToPng($('#sc'), 2); if (u) downloadDataUrl(u, 'Correlation ' + qlabel(S.period) + '.png'); };
    return;
  }
  $('#rdir').value = RK.desc == null ? '' : (RK.desc ? '1' : '0'); $('#rlim').value = RK.limit;
  $('#rdir').onchange = () => { const v = $('#rdir').value; RK.desc = v === '' ? null : v === '1'; render(); };
  $('#rlim').onchange = () => { RK.limit = +$('#rlim').value; render(); };
  $('#addc').onclick = e => {
    e.stopPropagation();
    const mnu = openMenu($('#addc'), `<div style="padding:6px"><select id="acs" size="16" style="width:300px">${metricOptions('')}</select></div>`);
    $('#acs', mnu).onchange = () => { const k = $('#acs', mnu).value; if (k && k !== RK.sort && !RK.cols.includes(k)) RK.cols.push(k); closeMenus(); render(); };
  };
  $$('th.sort').forEach(th => th.onclick = e => {
    if (e.target.dataset.rm) { RK.cols = RK.cols.filter(c => c !== e.target.dataset.rm); render(); return; }
    const k = th.dataset.k;
    if (k === RK.sort) RK.desc = !res.desc; else { RK.cols = [RK.sort].concat(RK.cols).filter(c => c !== k); RK.sort = k; RK.desc = null; }
    render();
  });
  $$('a[data-id]').forEach(a => a.onclick = e => { e.preventDefault(); S.subj = {id: a.dataset.id, name: a.dataset.n, state: a.dataset.st}; $('#subj').value = S.subj.name; S.groupMeta = []; changed(); });
  $('#xl').onclick = () => exportXlsx(`${res.columns[0].label} leaders ${qlabel(res.period)}`, [{name: 'Leader table', title: `${res.columns[0].label}: ${res.name}`, subtitle: `${qlabel(res.period)}. ${res.total} institutions ranked.`,
    columns: [{label: 'Institution', width: 40}, {label: 'Rank'}, {label: 'ID'}, {label: 'City', width: 20}, {label: 'State'}].concat(res.columns.map(c => ({label: c.label, fmt: c.fmt, width: 18}))),
    rows: res.rows.map(r => [title(r.name), r.rank, r.id, title(r.city), r.state].concat(r.vals)).concat([[res.mode_label, null, null, null, null].concat(res.stats.peer), ['Median', null, null, null, null].concat(res.stats.median)])}]);
  $('#mk').onclick = async () => {
    const name = prompt(`Save these ${res.rows.filter(r => !r.subject).length} institutions as a peer group named:`, `${res.columns[0].label} top ${RK.limit}`);
    if (!name) return;
    S.saved = await api('save', {type: S.type, what: 'peers', item: {name, spec: {only: res.rows.filter(r => !r.subject).map(r => r.id)}}});
    toast('Peer group saved. Add it from "+ Add comparison".');
  };
};
