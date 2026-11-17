'use strict';
const STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY GU VI'.split(' ');
// first comparison group of the primary's own industry (statements, member value and markets compare against it)
function ownGroup() { const g = effGroups().find(x => !x.inst && (x.kind || S.type) === S.type) || {preset: S.subj ? 'default' : 'national'}; const s = Object.assign({}, g); delete s.kind; return s; }
function parseMoney(s) {
  s = String(s || '').trim().toUpperCase().replace(/[$,\s]/g, '');
  if (!s) return null;
  const k = {K: 1e3, M: 1e6, B: 1e9}[s.slice(-1)];
  const n = parseFloat(k ? s.slice(0, -1) : s);
  return Number.isNaN(n) ? null : n * (k || 1);
}

// ================================================================ Financials
const FN = {mode: 'stmt', years: 3, freq: 'a', q: ''};
VIEWS.fin = async (view, opts, live) => {
  const head = `<div class="bar"><div class="seg sm" id="fm"><button data-v="stmt" class="${FN.mode === 'stmt' ? 'on' : ''}">Financial statements</button><button data-v="cr" class="${FN.mode === 'cr' ? 'on' : ''}">Full call report</button></div><span class="sp"></span>`;
  if (FN.mode === 'cr') {
    if (!S.subj) { view.innerHTML = `<div class="card">${head}</div><div class="empty">Pick a primary institution to open its full call report.</div></div>`; bind(); return; }
    const r = await api('callreport', {type: S.type, subject: subjReq(), period: S.period, q: FN.q});
    if (!live()) return;
    let tab = null, rows = '';
    r.rows.forEach(x => { if (x.table !== tab) { tab = x.table; rows += `<tr class="sec"><td colspan="5">${S.type === 'cu' ? 'Schedule file ' : ''}${esc(tab || 'FDIC')}</td></tr>`; }
      rows += `<tr><td class="l"><span class="code">${esc(x.code)}</span></td><td class="l wrap">${esc(x.name)}</td><td>${x.value == null ? '' : x.value.toLocaleString()}</td><td>${x.prior == null ? '' : x.prior.toLocaleString()}</td><td>${x.chg == null ? '' : (x.chg >= 0 ? '+' : '') + (x.chg * 100).toFixed(1) + '%'}</td></tr>`; });
    view.innerHTML = `<div class="card">${head}<input type="text" id="crq" placeholder="Search code or description" value="${esc(FN.q)}" style="width:260px"><button class="btn sm" id="xl">Excel</button></div>
      <h2>${esc(r.subject)}: every account reported, ${qlabel(r.period)}</h2><div class="sub">${r.total} ${FN.q ? 'matching' : 'non-zero'} accounts. Raw values as filed (dollars; rates in basis points). Use any code in a custom formula as <span class="code">[code]</span>.</div>
      <div class="scroll"><table class="t"><tr><th class="l">Code</th><th class="l">Description</th><th>${qlabel(r.period)}</th><th>${qlabel(r.prior)}</th><th>Change</th></tr>${rows}</table></div></div>`;
    bind();
    $('#crq').onchange = () => { FN.q = $('#crq').value; render(); };
    $('#xl').onclick = () => exportXlsx(`${r.subject} call report ${qlabel(r.period)}`, [{name: 'Call report', title: `${r.subject}: ${qlabel(r.period)}`, columns: [{label: 'Code', width: 12}, {label: 'Description', width: 80}, {label: 'Schedule'}, {label: qlabel(r.period), fmt: 'int', width: 18}, {label: qlabel(r.prior), fmt: 'int', width: 18}, {label: 'Change', fmt: 'pct1'}], rows: r.rows.map(x => [x.code, x.name, x.table, x.value, x.prior, x.chg])}]);
    return;
  }
  const r = await api('statements', {type: S.type, subject: subjReq(), period: S.period, years: FN.years, freq: FN.freq, spec: ownGroup()});
  if (!live()) return;
  const hasS = !!r.subject;
  const tbl = (rows, baseLabel) => `<table class="t"><tr><th></th>${hasS ? r.periods.map(p => `<th>${qshort(p)}</th>`).join('') + `<th>% of ${baseLabel}</th>` : ''}<th>Peers:<br>% of ${baseLabel}</th>${hasS ? '<th>Difference</th>' : '<th>Peer average</th>'}</tr>` +
    rows.map(x => x.style === 'h' ? `<tr class="sec"><td>${esc(x.label)}</td><td colspan="${(hasS ? r.periods.length + 1 : 0) + 2}"></td></tr>` :
      `<tr class="${x.style === 't' ? 'tot' : ''}"><td class="${x.style === 1 ? 'ind' : ''}" title="${esc(x.formula)}">${esc(x.label)}</td>${hasS ? x.vals.map(v => `<td>${fmt(v, 'usd')}</td>`).join('') + `<td>${fmt(x.pct, 'pct1')}</td>` : ''}<td>${fmt(x.peer_pct, 'pct1')}</td>` +
      (hasS ? `<td class="muted">${x.pct != null && x.peer_pct != null ? signed(x.pct - x.peer_pct, 1, ' pts') : ''}</td>` : `<td>${fmt(x.peer_avg, 'usd')}</td>`) + '</tr>').join('') + '</table>';
  view.innerHTML = `<div class="card">${head}
      <div class="seg sm" id="fy">${[[3, '3 yr'], [5, '5 yr'], [10, '10 yr']].map(([v, l]) => `<button data-v="${v}" class="${FN.years == v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="seg sm" id="ff">${[['a', 'Annual'], ['q', 'Quarterly']].map(([v, l]) => `<button data-v="${v}" class="${FN.freq === v ? 'on' : ''}">${l}</button>`).join('')}</div><button class="btn sm" id="xl">Excel</button></div>
      <h2>${esc(r.subject || r.compare)}</h2><div class="sub">Common-size comparison against ${esc(r.compare)} (accounts summed across the group). Income statement figures are year-to-date for each quarter shown.</div></div>
    <div class="card"><h2>Balance sheet</h2><div class="hscroll fin" style="--nc:${(hasS ? r.periods.length + 1 : 0) + 2}">${tbl(r.bs, 'assets')}</div></div>
    <div class="card"><h2>Income statement (year to date)</h2><div class="hscroll fin" style="--nc:${(hasS ? r.periods.length + 1 : 0) + 2}">${tbl(r.is, 'total income')}</div></div>`;
  bind();
  $$('#fy button').forEach(b => b.onclick = () => { FN.years = +b.dataset.v; render(); });
  $$('#ff button').forEach(b => b.onclick = () => { FN.freq = b.dataset.v; render(); });
  $('#xl').onclick = () => {
    const sheet = (name, rows, base) => ({name, title: `${r.subject || r.compare}: ${name}`, subtitle: 'Compared with ' + r.compare,
      columns: [{label: 'Line', width: 46}].concat(hasS ? r.periods.map(p => ({label: qlabel(p), fmt: 'usd', width: 16})) : [], hasS ? [{label: '% of ' + base, fmt: 'pct1'}] : [], [{label: 'Peers: % of ' + base, fmt: 'pct1', width: 18}, {label: 'Peer average', fmt: 'usd', width: 16}]),
      rows: rows.map(x => x.style === 'h' ? [x.label] : [(x.style === 1 ? '   ' : '') + x.label].concat(hasS ? x.vals : [], hasS ? [x.pct] : [], [x.peer_pct, x.peer_avg])), bold: rows.map((x, i) => x.style === 'h' || x.style === 't' ? i : -1).filter(i => i >= 0)});
    exportXlsx(`${r.subject || r.compare} financial statements ${qlabel(r.period)}`, [sheet('Balance sheet', r.bs, 'assets'), sheet('Income statement', r.is, 'total income')]);
  };
  function bind() { $$('#fm button').forEach(b => b.onclick = () => { FN.mode = b.dataset.v; render(); }); }
};

// ================================================================ Member value (Return of the Member)
VIEWS.rom = async (view, opts, live) => {
  const r = await api('rom', {subject: subjReq(), period: S.period, spec: S.subj ? ownGroup() : {preset: 'national'}, limit: 100});
  if (!live()) return;
  const me = r.me;
  const comp = me ? me.groups.map(g => `<div class="card"><div class="bar"><h2>${esc(g.name)}</h2><span class="sp"></span><span class="pill">weight ${Math.round(g.weight * 100)}%</span> ${pbar(g.score)}</div>
      <table class="t"><tr><th>Component</th><th class="nm">${esc(r.subject)}</th><th>Group median</th><th class="l">Percentile</th></tr>
      ${g.items.map(it => { const kind = it.fmt || 'pct';
        return `<tr><td>${esc(it.label)}</td><td class="strong">${fmt(it.value, kind)}</td><td>${fmt(it.median, kind)}</td><td class="l">${pbar(it.pct)}</td></tr>`; }).join('')}</table></div>`).join('') : '';
  view.innerHTML = `<div class="card"><div class="bar"><div><h2>Return of the Member${me ? ': ' + esc(r.subject) : ''}</h2>
      <div class="sub" style="margin:0">${qlabel(r.period)} · scored against ${r.n} credit unions: ${esc(r.name)}${r.note ? ' · ' + esc(r.note) : ''}</div></div><span class="sp"></span><button class="btn sm" id="xl">Excel</button></div>
      ${me ? `<div class="tiles"><div class="tile"><small>ROM score (100 = best)</small><b>${me.rom == null ? 'n/a' : me.rom.toFixed(1)}</b><em>rank ${me.rank} of ${me.of}</em></div>
        ${me.groups.map(g => `<div class="tile"><small>${esc(g.name)}</small><b>${g.score == null ? 'n/a' : Math.round(g.score)}</b><em>percentile in group</em></div>`).join('')}</div>` : '<div class="sub">Pick a primary credit union to see its score. The leader table below ranks the whole group.</div>'}
      <div class="hint">Method: Callahan's published Return of the Member design. 18 call report ratios in three groups (return to savers, return to borrowers, member service usage), each percentile-ranked inside the comparison group, averaged within its group, then weighted 40 / 35 / 25 and re-ranked to 0-100. Callahan does not publish its per-ratio weights, so ratios are weighted equally inside each group; scores will be close to, not identical to, Callahan's.</div></div>
    ${comp ? `<div class="three">${comp}</div>` : ''}
    <div class="card"><h2>ROM leaders</h2><div class="scroll"><table class="t rom"><tr><th style="width:36px;text-align:right">#</th><th class="l">Credit union</th><th class="l">State</th><th>Assets</th><th>ROM</th>${r.groups.map(g => `<th>${esc(g)}</th>`).join('')}</tr>
      ${r.leaders.map(x => `<tr class="${x.subject ? 'me' : ''}"><td style="text-align:right">${x.rank}</td><td class="l">${esc(title(x.name))}</td><td class="l">${esc(x.state)}</td><td>${fmt(x.assets, 'usd')}</td><td class="strong">${x.rom == null ? 'n/a' : x.rom.toFixed(1)}</td>${x.parts.map(p => `<td>${p == null ? 'n/a' : Math.round(p)}</td>`).join('')}</tr>`).join('')}</table></div></div>`;
  $('#xl').onclick = () => exportXlsx(`Return of the Member ${qlabel(r.period)}`, [{name: 'ROM leaders', title: 'Return of the Member: ' + r.name, subtitle: qlabel(r.period),
    columns: [{label: 'Credit union', width: 40}, {label: 'Rank'}, {label: 'State'}, {label: 'Assets', fmt: 'usd', width: 16}, {label: 'ROM', fmt: 'num'}].concat(r.groups.map(g => ({label: g, fmt: 'num', width: 20}))),
    rows: r.leaders.map(x => [title(x.name), x.rank, x.state, x.assets, x.rom].concat(x.parts))}]);
};

// ================================================================ Merger
const MG = {};
VIEWS.merger = async (view, opts, live) => {
  const list = MG[S.type] || (MG[S.type] = (S.subj && !S.subj.merge ? [{id: S.subj.id, name: /[a-z]/.test(S.subj.name) ? S.subj.name : title(S.subj.name)}] : []));
  let body = `<div class="empty">Add at least two ${instWord()} to see the combined institution.</div>`;
  if (list.length >= 2) {
    const keys = ['assets'].concat(S.lib.scorecard, S.type === 'cu' ? ['members', 'branches', 'fte'] : ['deposits', 'offices', 'employees']).filter((k, i, a) => metricDef(k) && a.indexOf(k) === i);
    const res = await api('analyze', {type: S.type, subject: {merge: list.map(x => x.id)}, period: S.period, mode: S.mode || S.lib.default_mode, years: 3, freq: 'a', insights: true,
      groups: [{preset: 'tier'}].concat(list.map(x => ({inst: x.id, name: x.name}))), metrics: keys});
    if (!live()) return;
    const g = res.groups;
    const lvl = k => res.metrics.find(m => m.key === k);
    const tiles = (S.type === 'cu' ? ['assets', 'members', 'branches', 'fte'] : ['assets', 'deposits', 'offices', 'employees']).map(k => { const m = lvl(k); return m && !m.error ? `<div class="tile"><small>Combined ${esc(m.label.toLowerCase())}</small><b>${fmt(m.latest.value, m.fmt)}</b><em>${m.hib !== null && m.latest.rank ? 'rank ' + m.latest.rank + ' of ' + m.latest.of + ' in the new tier' : ''}</em></div>` : ''; }).join('');
    body = `<div class="tiles">${tiles}</div>
      <div class="sub">Pro forma is the sum of each institution's call report accounts for every quarter, with ratios recomputed on the totals. No purchase-accounting or cost-save adjustments. Ranked against ${g[0].n} peers: ${esc(g[0].name)}.</div>
      <div class="scroll"><table class="t"><tr><th>Ratio</th><th>Combined</th>${g.slice(1).map(x => `<th class="nm">${esc(x.name)}</th>`).join('')}<th class="nm">${esc(g[0].name.length > 30 ? 'New peer group' : g[0].name)}</th><th>Rank</th><th class="l">Percentile</th><th>Combined a year ago</th></tr>
      ${res.metrics.filter(m => !m.error).map(m => { const L = m.latest; return `<tr><td title="${esc(m.formula)}">${esc(m.label)}</td><td class="strong">${fmt(L.value, m.fmt)}</td>${m.groups.slice(1).map(v => `<td>${fmt(v[v.length - 1], m.fmt)}</td>`).join('')}<td>${fmt(L.peer, m.fmt)}</td><td>${L.rank && !L.neutral ? L.rank + ' / ' + L.of : ''}</td><td class="l">${L.neutral ? '' : pbar(L.pct)}</td><td>${fmt(L.value_py, m.fmt)}</td></tr>`; }).join('')}</table></div>`;
    view._res = res;
  }
  if (!live()) return;
  view.innerHTML = `<div class="card"><div class="bar"><div><h2>Hypothetical merger</h2><div class="sub" style="margin:0">Combine two or more ${instWord()} and benchmark the result.</div></div><span class="sp"></span>
      ${list.length >= 2 ? '<button class="btn pri" id="use" title="Every tab then analyzes the combined institution">Use combined as primary</button><button class="btn" id="xl">Excel</button>' : ''}</div>
      <div class="bar">${list.map((x, i) => `<span class="mgi">${i ? '<b>+</b>' : ''}<span class="chip"><span>${esc(x.name)}</span><button data-i="${i}" title="Remove">×</button></span></span>`).join('')}<button class="btn sm" id="add">+ Add ${instWord(S.type, 1)}</button></div>
      ${body}</div>`;
  $('#add').onclick = () => pickInstitution(d => { if (!list.some(x => x.id === d.id)) list.push({id: d.id, name: d.name}); render(); }, {type: S.type, title: 'Add to the merger'});
  $$('.chip button[data-i]', view).forEach(b => b.onclick = () => { list.splice(+b.dataset.i, 1); render(); });
  if ($('#use')) $('#use').onclick = () => { S.subj = {merge: list.map(x => x.id), name: list.map(x => x.name).join(' + ')}; $('#subj').value = S.subj.name; S.groups = [{preset: 'tier'}]; S.groupMeta = []; saveState(); renderGroups(); go('scorecard'); };
  if ($('#xl')) $('#xl').onclick = () => { const res = view._res, g = res.groups; exportXlsx('Merger ' + list.map(x => x.name).join(' + ') + ' ' + qlabel(res.period), [{name: 'Merger scorecard', title: res.subject.name, subtitle: `Pro forma sum of call report accounts, ${qlabel(res.period)}. Peers: ${g[0].name} (${g[0].n}).`,
    columns: [{label: 'Ratio', width: 40}, {label: 'Combined', width: 18}].concat(g.slice(1).map(x => ({label: x.name, width: 22})), [{label: g[0].name, width: 26}, {label: 'Rank'}, {label: 'Of'}, {label: 'Combined a year ago', width: 18}]),
    rows: res.metrics.filter(m => !m.error).map(m => [m.label, {v: m.latest.value, fmt: m.fmt}].concat(m.groups.slice(1).map(v => ({v: v[v.length - 1], fmt: m.fmt})), [{v: m.latest.peer, fmt: m.fmt}, m.latest.neutral ? null : m.latest.rank, m.latest.of, {v: m.latest.value_py, fmt: m.fmt}]))}]); };
};

// ================================================================ Market share
const MK = {areas: [], cu: true, state: '', counties: [], list: [], purpose: 'all'};
VIEWS.market = async (view, opts, live) => {
  let r = null;
  if (MK.areas.length) {
    const sub = S.subj && !S.subj.merge ? {type: S.type, id: S.subj.id} : null;
    [r, view._hm] = await Promise.all([api('market', {areas: MK.areas, include_cu: MK.cu, subject: sub}),
      api('mortgage', {areas: MK.areas, subject: sub, purpose: MK.purpose}).catch(e => ({error: e.message}))]);
    if (!live()) return;
  }
  const areaShort = MK.areas.slice(0, 3).map(a => `${a.state}${a.counties && a.counties.length ? ': ' + a.counties.slice(0, 3).join(', ') + (a.counties.length > 3 ? ` +${a.counties.length - 3} more` : '') : ' (statewide)'}`).join(' · ') + (MK.areas.length > 3 ? ` · +${MK.areas.length - 3} more states` : '');
  const areaTxt = MK.areas.map(a => `${a.state}${a.counties && a.counties.length ? ': ' + a.counties.join(', ') : ' (statewide)'}`).join(' · ');
  let body = '<div class="empty">Define a market: use the primary institution\'s branch footprint, or pick a state and counties.</div>';
  if (r && r.empty) body = '<div class="empty">No branches found in that market.</div>';
  else if (r) {
    const s = r.summary, me = r.institutions.find(x => x.subject);
    body = `<div class="tiles">
        <div class="tile"><small>Deposits in market, June ${r.year}</small><b>${fmt(s.total, 'usd')}</b><em>${s.growth == null ? '' : (s.growth >= 0 ? '+' : '') + (s.growth * 100).toFixed(1) + '% vs ' + (r.year - 1)}</em></div>
        <div class="tile"><small>Institutions</small><b>${s.institutions.toLocaleString()}</b><em>${s.banks.toLocaleString()} banks · ${s.cus.toLocaleString()} credit unions</em></div>
        <div class="tile"><small>Branches</small><b>${s.branches.toLocaleString()}</b><em>${s.bank_branches.toLocaleString()} bank · ${s.cu_branches.toLocaleString()} credit union</em></div>
        <div class="tile"><small>Credit union share</small><b>${fmt(s.cu_share, 'pct1')}</b><em>estimated</em></div>
        <div class="tile"><small>Top-5 share</small><b>${fmt(s.top5, 'pct1')}</b><em>HHI ${Math.round(s.hhi).toLocaleString()} (${s.hhi < 1000 ? 'unconcentrated' : s.hhi < 1800 ? 'moderately concentrated' : 'highly concentrated'})</em></div>
        ${me ? `<div class="tile"><small>${esc(title(S.subj.name))}</small><b>${fmt(me.share, 'pct1')}</b><em>#${me.rank} · ${fmt(me.deposits, 'usd')} · ${me.branches.toLocaleString()} branch${me.branches === 1 ? '' : 'es'}</em></div>` : ''}</div>
      <div class="two"><div><h3>Market share leaders</h3><div id="mbars"></div></div><div><h3>${me ? esc(title(S.subj.name)) + ': share of market deposits' : 'Market deposits'}, ${r.trend.length ? r.trend[0].year + '-' + r.year : ''}</h3><div id="mtrend"></div></div></div>
      <h3>Institutions in the market (${r.institutions.length.toLocaleString()})</h3>
      <div class="scroll" style="max-height:454px"><table class="t"><tr><th class="l">Institution</th><th class="l">Type</th><th>Branches</th><th>Deposits</th><th>Share</th><th>Share change</th><th>Deposit growth</th><th>Per branch</th></tr>
      ${r.institutions.map(x => `<tr class="${x.subject ? 'me' : ''}"><td class="l"><span class="muted">${x.rank}.</span> ${esc(x.name)}</td><td class="l"><span class="pill ${x.kind}">${x.kind === 'cu' ? 'Credit union' : 'Bank'}</span></td><td>${x.branches.toLocaleString()}</td><td>${fmt(x.deposits, 'usd')}${x.est ? '<span class="muted" title="Estimated: total shares spread evenly across branches">*</span>' : ''}</td><td>${fmt(x.share, 'pct')}</td>
        <td>${x.share_chg == null ? '' : signed(x.share_chg, 2, ' pts')}</td><td>${x.growth == null ? '' : signed(x.growth, 1, '%')}</td><td>${fmt(x.per_branch, 'usd')}</td></tr>`).join('')}</table></div>
      <div class="hint" style="margin-top:6px">Bank deposits: FDIC Summary of Deposits, branch level, as of June 30. * Credit unions do not report deposits by branch, so each credit union's total shares are divided evenly across its branches (the convention Callahan uses). A large credit union with few local branches will be overstated; untick "Include credit unions" for bank-only shares.</div>
      <h3>Branches (${r.branches.length.toLocaleString()}${s.branches > r.branches.length ? ' largest of ' + s.branches.toLocaleString() : ''})</h3>
      <div class="scroll" style="max-height:370px"><table class="t"><tr><th class="l">Institution</th><th class="l">Address</th><th class="l">City</th><th class="l">County</th><th>Deposits</th></tr>
      ${r.branches.map(b => `<tr class="${b.subject ? 'me' : ''}"><td class="l">${esc(b.name)}</td><td class="l">${esc(title(b.address))}</td><td class="l">${esc(b.city)}, ${esc(b.state)} ${esc(b.zip)}</td><td class="l">${esc(b.county)}</td><td>${fmt(b.deposits, 'usd')}${b.est ? '<span class="muted">*</span>' : ''}</td></tr>`).join('')}</table></div>`;
  }
  view.innerHTML = `<div class="card"><div class="bar"><div><h2>Deposit market share</h2><div class="sub" style="margin:0">${areaTxt ? `<span title="${esc(areaTxt)}">${esc(areaShort)}</span>` : 'Banks and credit unions, by branch.'}</div></div><span class="sp"></span>${r && !r.empty ? '<button class="btn" id="xl">Excel</button>' : ''}</div>
      <div class="bar">
        ${S.subj && !S.subj.merge ? `<button class="btn pri" id="fp">Use ${esc(title(S.subj.name))}'s branch footprint</button>` : ''}
        <label>State</label><select id="mst"><option value="">Choose…</option>${STATES.map(s => `<option ${s === MK.state ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <button class="btn" id="mco" ${MK.state ? '' : 'disabled'}>${MK.counties.length ? MK.counties.length + ' counties' : 'All counties'} ▾</button>
        <button class="btn" id="madd" ${MK.state ? '' : 'disabled'}>Add to market</button>
        ${MK.areas.length ? '<button class="btn" id="mclr">Clear market</button>' : ''}
        <label class="check"><input type="checkbox" id="mcu" ${MK.cu ? 'checked' : ''}>Include credit unions</label></div>
      ${body}</div>${r ? mortgageCard(view._hm) : ''}`;
  if (view._hm && !view._hm.empty && !view._hm.error) mortgageWire(view._hm, areaTxt);
  if (r && !r.empty) {
    barList($('#mbars'), r.institutions.slice(0, 12).map(x => ({label: x.name.replace(/,? National Association$/i, ', N.A.'), value: x.share, me: x.subject})), 'pct1');
    const me = r.institutions.find(x => x.subject);
    lineChart($('#mtrend'), r.trend.map(t => String(t.year)), me ? [{name: S.subj.name, color: COLORS[0], values: r.trend.map(t => t.subject_share)}] : [{name: 'Market deposits', color: COLORS[1], values: r.trend.map(t => t.total)}], {fmt: me ? 'pct' : 'usd', height: 260, type: me ? 'line' : 'col'});
    $('#xl').onclick = () => exportXlsx(`Market share ${areaTxt.slice(0, 60)} ${r.year}`, [
      {name: 'Institutions', title: 'Deposit market share, June ' + r.year, subtitle: [areaTxt, 'Credit union deposits are estimates: total shares divided evenly across branches.'], columns: [{label: 'Institution', width: 44}, {label: 'Rank'}, {label: 'Type'}, {label: 'Branches'}, {label: 'Deposits', fmt: 'usd', width: 18}, {label: 'Share', fmt: 'pct'}, {label: 'Share change', fmt: 'pct'}, {label: 'Deposit growth', fmt: 'pct1'}, {label: 'Per branch', fmt: 'usd', width: 16}],
        rows: r.institutions.map(x => [x.name, x.rank, x.kind === 'cu' ? 'Credit union' : 'Bank', x.branches, x.deposits, x.share, x.share_chg, x.growth, x.per_branch])},
      {name: 'Branches', columns: [{label: 'Institution', width: 44}, {label: 'Type'}, {label: 'Address', width: 34}, {label: 'City', width: 20}, {label: 'County', width: 18}, {label: 'State'}, {label: 'ZIP'}, {label: 'Deposits', fmt: 'usd', width: 18}, {label: 'Estimated'}],
        rows: r.branches.map(b => [b.name, b.kind === 'cu' ? 'Credit union' : 'Bank', title(b.address), b.city, b.county, b.state, b.zip, b.deposits, b.est ? 'yes' : ''])},
      {name: 'Trend', columns: [{label: 'Year'}, {label: 'Market deposits', fmt: 'usd', width: 18}, {label: 'Banks', fmt: 'usd', width: 18}, {label: 'Credit unions (est.)', fmt: 'usd', width: 18}, {label: 'Branches'}, {label: 'Primary deposits', fmt: 'usd', width: 18}, {label: 'Primary share', fmt: 'pct'}],
        rows: r.trend.map(t => [t.year, t.total, t.banks, t.cus, t.branches, t.subject, t.subject_share])}]);
  }
  if ($('#fp')) $('#fp').onclick = async () => {
    try {
      const f = await apiGet('footprint', {type: S.type, id: S.subj.id});
      if (!f.length) { toast('No branches on file for this institution.', true); return; }
      const by = {};
      f.filter(x => x.state).forEach(x => (by[x.state] = by[x.state] || []).push(x.county));
      MK.areas = Object.entries(by).map(([state, counties]) => ({state, counties}));
      render();
    } catch (e) { toast(e.message, true); }
  };
  $('#mst').onchange = async () => { MK.state = $('#mst').value; MK.counties = []; MK.list = []; render(); };
  $('#mco').onclick = async e => {
    e.stopPropagation();
    if (!MK.list.length) { $('#mco').textContent = 'Loading…'; try { MK.list = await apiGet('counties', {state: MK.state}); } catch (x) { toast(x.message, true); } $('#mco').textContent = (MK.counties.length ? MK.counties.length + ' counties' : 'All counties') + ' ▾'; if (!MK.list.length) return; }
    const mnu = openMenu($('#mco'), `<div style="padding:4px 8px;display:flex;justify-content:space-between;gap:12px"><b>Counties in ${MK.state}</b><a id="cdone" style="color:var(--red);font-weight:600;cursor:pointer">Done</a></div>` + MK.list.map(c => `<label class="check" style="padding:2px 8px"><input type="checkbox" value="${esc(c.name)}" ${MK.counties.includes(c.name) ? 'checked' : ''}>${esc(c.name)} <small class="muted" style="margin-left:auto">${c.branches} br · ${fmt(c.deposits, 'usd')}</small></label>`).join(''));
    mnu.onchange = () => { MK.counties = $$('input:checked', mnu).map(i => i.value); $('#mco').textContent = (MK.counties.length ? MK.counties.length + ' counties' : 'All counties') + ' ▾'; };
    $('#cdone', mnu).onclick = closeMenus;
  };
  $('#madd').onclick = () => { MK.areas = MK.areas.filter(a => a.state !== MK.state).concat([{state: MK.state, counties: MK.counties.slice()}]); render(); };
  if ($('#mclr')) $('#mclr').onclick = () => { MK.areas = []; render(); };
  $('#mcu').onchange = () => { MK.cu = $('#mcu').checked; render(); };
};

// ---------------------------------------------------------------- mortgage lending (HMDA)
const PURPOSE = {all: 'All purposes', purchase: 'Home purchase', refi: 'Refinance'};
function mortgageCard(h) {
  if (!h) return '';
  if (h.error) return `<div class="card"><h2>Mortgage lending</h2><div class="note">${esc(h.error)}</div></div>`;
  if (h.missing) return '<div class="card"><h2>Mortgage lending</h2><div class="empty">HMDA mortgage data is not installed. Run <code>.venv/bin/python hmda.py</code> once to add it.</div></div>';
  const head = `<div class="bar"><div><h2>Mortgage lending, ${h.year}</h2><div class="sub" style="margin:0">Mortgages on 1-4 family homes reported under HMDA, by the county of the property.</div></div><span class="sp"></span>
    <select id="hmp">${Object.entries(PURPOSE).map(([k, v]) => `<option value="${k}" ${k === MK.purpose ? 'selected' : ''}>${v}</option>`).join('')}</select>${h.empty ? '' : '<button class="btn" id="hxl">Excel</button>'}</div>`;
  if (h.empty) return `<div class="card">${head}<div class="empty">No HMDA mortgage originations in this market.</div></div>`;
  const s = h.summary, me = h.me, nm = S.subj ? esc(title(S.subj.name)) : '';
  const kindPill = k => `<span class="pill ${k === 'other' ? '' : k}">${k === 'cu' ? 'Credit union' : k === 'bank' ? 'Bank' : 'Non-bank'}</span>`;
  return `<div class="card">${head}
    ${h.unknown && h.unknown.length ? `<div class="note">Not matched to a county code: ${esc(h.unknown.join('; '))}</div>` : ''}
    <div class="tiles">
      <div class="tile"><small>Originations, ${esc(PURPOSE[h.purpose].toLowerCase())}</small><b>${fmt(s.amount, 'usd')}</b><em>${s.loans.toLocaleString()} loans</em></div>
      <div class="tile"><small>Lenders</small><b>${s.lenders.toLocaleString()}</b><em>top-5 share ${fmt(s.top5, 'pct1')} · HHI ${Math.round(s.hhi).toLocaleString()}</em></div>
      <div class="tile"><small>Credit union share</small><b>${fmt(s.cu_share, 'pct1')}</b><em>of dollars originated</em></div>
      <div class="tile"><small>Bank share</small><b>${fmt(s.bank_share, 'pct1')}</b><em>non-bank lenders ${fmt(s.other_share, 'pct1')}</em></div>
      <div class="tile"><small>Denial rate</small><b>${fmt(s.deny, 'pct1')}</b><em>of ${s.apps.toLocaleString()} applications</em></div>
      ${me ? `<div class="tile"><small>${nm}</small><b>${fmt(me.share, 'pct')}</b><em>#${me.rank} · ${fmt(me.amount, 'usd')} · ${me.loans.toLocaleString()} loans</em></div>` :
        S.subj && !S.subj.merge ? `<div class="tile"><small>${nm}</small><b>None</b><em>${h.reporter ? 'no HMDA originations in this market' : `does not report HMDA data for ${h.year} (smaller lenders are exempt)`}</em></div>` : ''}</div>
    <div class="two"><div><h3>Mortgage share leaders</h3><div id="hbars"></div></div>
      <div>${h.counties.length ? `<h3>${nm}: mortgage share by county</h3><div class="scroll" style="max-height:300px"><table class="t"><tr><th class="l">County</th><th>Loans</th><th>Amount</th><th>Share</th></tr>
        ${h.counties.map(c => `<tr><td class="l">${esc(c.county)}, ${esc(c.state)}</td><td>${c.loans.toLocaleString()}</td><td>${fmt(c.amount, 'usd')}</td><td>${fmt(c.share, 'pct')}</td></tr>`).join('')}</table></div>` :
        '<h3>How to read this</h3><div class="sub">Share is the lender\'s part of the dollars originated in the market. Non-bank lenders are mortgage companies that report to HUD or the CFPB and do not file a call report.</div>'}</div></div>
    <h3>Mortgage lenders in the market (${h.institutions.length.toLocaleString()}${s.lenders > h.institutions.length ? ' of ' + s.lenders.toLocaleString() : ''})</h3>
    <div class="scroll" style="max-height:454px"><table class="t"><tr><th class="l">Lender</th><th class="l">Type</th><th>Loans</th><th>Amount</th><th>Share</th><th>Share of loans</th><th>Avg loan</th><th>Applications</th><th>Denial rate</th></tr>
    ${h.institutions.map(x => `<tr class="${x.subject ? 'me' : ''}"><td class="l"><span class="muted">${x.rank}.</span> ${esc(title(x.name))}</td><td class="l">${kindPill(x.kind)}</td><td>${x.loans.toLocaleString()}</td><td>${fmt(x.amount, 'usd')}</td><td>${fmt(x.share, 'pct')}</td><td>${fmt(x.share_n, 'pct')}</td><td>${fmt(x.avg, 'usd')}</td><td>${x.apps.toLocaleString()}</td><td>${fmt(x.deny, 'pct1')}</td></tr>`).join('')}</table></div>
    <div class="hint" style="margin-top:6px">Source: ${h.year} HMDA snapshot national loan-level dataset (CFPB / FFIEC), originated loans (action taken 1) on 1-4 family homes, by the county of the property. Multifamily buildings, loans an institution bought and preapprovals are excluded. Denial rate = denied / (originated + approved not accepted + denied + withdrawn + incomplete). Banks and credit unions are linked to their call report through the HMDA institution record (Federal Reserve RSSD ID).</div></div>`;
}
function mortgageWire(h, areaTxt) {
  barList($('#hbars'), h.institutions.slice(0, 12).map(x => ({label: title(x.name), value: x.share, me: x.subject})), 'pct1');
  $('#hmp').onchange = () => { MK.purpose = $('#hmp').value; render(); };
  $('#hxl').onclick = () => exportXlsx(`Mortgage share ${areaTxt.slice(0, 60)} ${h.year}`, [
    {name: 'Mortgage lenders', title: `Mortgage market share, ${h.year} (${PURPOSE[h.purpose].toLowerCase()})`, subtitle: [areaTxt, 'Source: HMDA snapshot national loan-level dataset (CFPB / FFIEC). Originated loans on 1-4 family homes, by county of the property.'],
      columns: [{label: 'Lender', width: 44}, {label: 'Rank'}, {label: 'Type', width: 14}, {label: 'LEI', width: 24}, {label: 'Loans'}, {label: 'Amount', fmt: 'usd', width: 18}, {label: 'Share', fmt: 'pct'}, {label: 'Share of loans', fmt: 'pct'}, {label: 'Avg loan', fmt: 'usd', width: 14}, {label: 'Applications'}, {label: 'Denial rate', fmt: 'pct1'}],
      rows: h.institutions.map(x => [title(x.name), x.rank, x.kind === 'cu' ? 'Credit union' : x.kind === 'bank' ? 'Bank' : 'Non-bank', x.lei, x.loans, x.amount, x.share, x.share_n, x.avg, x.apps, x.deny])}]
    .concat(h.counties.length ? [{name: 'By county', columns: [{label: 'County', width: 30}, {label: 'State'}, {label: 'Loans'}, {label: 'Amount', fmt: 'usd', width: 18}, {label: 'Share', fmt: 'pct'}], rows: h.counties.map(c => [c.county, c.state, c.loans, c.amount, c.share])}] : []));
}

// ================================================================ Peer group builder
const PG = {spec: {}, name: '', prev: null};
VIEWS.peers = async (view, opts, live) => {
  const sp = PG.spec, cu = S.type === 'cu';
  const tri = (id, label, val) => `<div class="field"><label>${label}</label><select id="${id}"><option value="">Any</option><option value="1" ${val === true ? 'selected' : ''}>Yes</option><option value="0" ${val === false ? 'selected' : ''}>No</option></select></div>`;
  const filt = (sp.filters || []).map((f, i) => `<div class="pfrow wide"><select class="pfm" data-i="${i}">${metricOptions(f.metric)}</select>
      <input type="number" step="any" class="pfa" data-i="${i}" placeholder="min" value="${f.umin == null ? '' : f.umin}"> to <input type="number" step="any" class="pfb" data-i="${i}" placeholder="max" value="${f.umax == null ? '' : f.umax}">
      <span class="hint">${['pct', 'rate'].includes((metricDef(f.metric) || {}).fmt) ? 'percent' : (metricDef(f.metric) || {}).fmt === 'usd' ? 'dollars' : ''}</span><button class="btn sm pfx" data-i="${i}">Remove</button></div>`).join('');
  const rk = sp.rank || {};
  view.innerHTML = `<div class="cols half"><div>
    <div class="card"><div class="bar"><div><h2>Build a ${cu ? 'credit union' : 'bank'} peer group</h2><div class="sub" style="margin:0">Every condition must hold. Leave a field blank to ignore it.</div></div></div>
      <div class="form">
        <div class="field wide"><label>States <span class="hint">hold Ctrl to pick several</span></label><select id="pst" multiple size="5">${STATES.map(s => `<option ${(sp.states || []).includes(s) ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Assets from</label><input type="text" id="pa0" placeholder="e.g. 250M" value="${esc(sp._a0 || '')}"></div>
        <div class="field"><label>Assets up to</label><input type="text" id="pa1" placeholder="e.g. 1B" value="${esc(sp._a1 || '')}"></div>
        ${cu ? `<div class="field"><label>Members from</label><input type="text" id="pm0" placeholder="e.g. 10K" value="${esc(sp._m0 || '')}"></div><div class="field"><label>Members up to</label><input type="text" id="pm1" placeholder="e.g. 500K" value="${esc(sp._m1 || '')}"></div>` : ''}
        <div class="field wide"><label>${cu ? 'Charter type' : 'Bank class'}</label><div class="bar" style="margin:0">${Object.entries(S.lib.charters).map(([k, v]) => `<label class="check"><input type="checkbox" class="pch" value="${k}" ${(sp.charter || []).includes(k) ? 'checked' : ''}>${esc(v)}</label>`).join('')}</div></div>
        ${cu ? `<div class="field wide"><label>Field of membership</label><div class="bar" style="margin:0">${S.lib.foms.map(v => `<label class="check"><input type="checkbox" class="pfo" value="${esc(v)}" ${(sp.fom || []).includes(v) ? 'checked' : ''}>${esc(v)}</label>`).join('')}</div></div>
          ${tri('pli', 'Low-income designated', sp.low_income)}${tri('pmd', 'Minority depository (MDI)', sp.mdi)}` : `${tri('pcb', 'FDIC community bank', sp.cb)}${tri('pss', 'Subchapter S', sp.subs)}${tri('pmu', 'Mutual ownership', sp.mutual)}
          <div class="field"><label>Metro area contains</label><input type="text" id="pcbsa" placeholder="e.g. Jackson" value="${esc(sp.cbsa || '')}"></div>`}
        <div class="field wide"><label>${cu ? 'NCUA asset peer group' : 'FDIC specialization group'}</label><div class="bar" style="margin:0">${Object.entries(S.lib.group_labels).map(([k, v]) => `<label class="check"><input type="checkbox" class="pgr" value="${k}" ${(sp.groups || []).map(String).includes(k) ? 'checked' : ''}>${esc(v)}</label>`).join('')}</div></div>
        <div class="field wide"><label>Performance conditions <span class="hint">any library ratio or custom formula</span></label></div>${filt}
        <div class="wide"><button class="btn sm" id="paddf">+ Add a condition</button></div>
        <div class="field wide"><label>Then keep only <span class="hint">optional: the Smart Peer step</span></label><div class="bar" style="margin:0">
          <select id="prm"><option value="">Everyone that qualifies</option><option value="top" ${rk.mode === 'top' ? 'selected' : ''}>The best</option><option value="bottom" ${rk.mode === 'bottom' ? 'selected' : ''}>The weakest</option><option value="closest" ${rk.mode === 'closest' ? 'selected' : ''}>The closest to the primary</option></select>
          <input type="number" id="prn" style="width:80px" value="${rk.n || 20}"><select id="prp"><option value="">institutions</option><option value="1" ${rk.pct ? 'selected' : ''}>percent</option></select>
          <span class="nowrap"><span>by</span><select id="prk" style="max-width:260px">${metricOptions(rk.metric || 'assets')}</select></span></div></div>
        <div class="field wide"><label>Always include <span class="hint">${cu ? 'charter' : 'cert'} numbers, comma-separated</span></label><input type="text" id="pin" value="${esc((sp.include || []).join(', '))}"></div>
        <div class="field wide"><label>Or use exactly this list <span class="hint">paste ${cu ? 'charter' : 'cert'} numbers; overrides the filters above</span></label><textarea id="pon" rows="2">${esc((sp.only || []).join(', '))}</textarea></div>
      </div>
      <div class="bar" style="margin-top:12px"><button class="btn pri" id="pprev">Preview</button><button class="btn" id="preset">Reset</button><span class="sp"></span>
        <input type="text" id="pname" placeholder="Name this group" value="${esc(PG.name)}" style="flex:1 1 120px;min-width:0"><button class="btn" id="psave">Save</button><button class="btn" id="puse">Add to comparison set</button></div>
    </div>
    <div class="card"><h2>Saved peer groups</h2>${S.saved.peers.length ? `<table class="t">${S.saved.peers.map((p, i) => `<tr><td>${esc(p.name)}</td><td><button class="btn sm" data-ld="${i}">Edit</button> <button class="btn sm" data-ad="${i}">Add to comparison</button> <button class="btn sm" data-dl="${i}">Delete</button></td></tr>`).join('')}</table>` : '<div class="sub">None yet. Saved groups appear under "+ Add comparison" on every tab.</div>'}</div>
  </div><div class="card" id="pprevbox"><h2>Preview</h2><div class="sub">Press Preview to list the institutions that qualify for ${qlabel(S.period)}.</div></div></div>`;
  const read = () => {
    const s = {};
    const st = $$('#pst option:checked').map(o => o.value); if (st.length) s.states = st;
    s._a0 = $('#pa0').value; s._a1 = $('#pa1').value;
    const a0 = parseMoney(s._a0), a1 = parseMoney(s._a1); if (a0 || a1) s.assets = [a0, a1];
    if (cu) { s._m0 = $('#pm0').value; s._m1 = $('#pm1').value; const m0 = parseMoney(s._m0), m1 = parseMoney(s._m1); if (m0 || m1) s.members = [m0, m1]; }
    const ch = $$('.pch:checked').map(o => o.value); if (ch.length) s.charter = ch;
    const gr = $$('.pgr:checked').map(o => o.value); if (gr.length) s.groups = gr;
    const t = id => { const e = $('#' + id); return e && e.value !== '' ? e.value === '1' : undefined; };
    if (cu) { const fo = $$('.pfo:checked').map(o => o.value); if (fo.length) s.fom = fo; if (t('pli') !== undefined) s.low_income = t('pli'); if (t('pmd') !== undefined) s.mdi = t('pmd'); }
    else { if (t('pcb') !== undefined) s.cb = t('pcb'); if (t('pss') !== undefined) s.subs = t('pss'); if (t('pmu') !== undefined) s.mutual = t('pmu'); if ($('#pcbsa').value.trim()) s.cbsa = $('#pcbsa').value.trim(); }
    s.filters = (sp.filters || []).map((f, i) => { const d = metricDef($$('.pfm')[i].value) || {}, k = ['pct', 'rate'].includes(d.fmt) ? 100 : 1, a = $$('.pfa')[i].value, b = $$('.pfb')[i].value;
      return {metric: $$('.pfm')[i].value, umin: a === '' ? null : +a, umax: b === '' ? null : +b, min: a === '' ? null : +a / k, max: b === '' ? null : +b / k}; });
    if (!s.filters.length) delete s.filters;
    if ($('#prm').value) s.rank = {mode: $('#prm').value, n: +$('#prn').value || 20, pct: $('#prp').value === '1', metric: $('#prk').value};
    const ids = v => v.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
    if (ids($('#pin').value).length) s.include = ids($('#pin').value);
    if (ids($('#pon').value).length) s.only = ids($('#pon').value);
    if (sp.exclude && sp.exclude.length) s.exclude = sp.exclude;
    PG.name = $('#pname').value.trim();
    return s;
  };
  const clean = s => { const o = Object.assign({}, s); Object.keys(o).forEach(k => { if (k[0] === '_') delete o[k]; }); return o; };
  const preview = async () => {
    PG.spec = read();
    const box = $('#pprevbox');
    box.classList.add('busy');
    try {
      const r = await api('peers', {type: S.type, subject: subjReq(), period: S.period, spec: clean(PG.spec), limit: 600});
      box.innerHTML = `<h2>${r.n.toLocaleString()} ${instWord(S.type, r.n)}</h2><div class="sub">${esc(r.name)} · ${qlabel(S.period)} · combined assets ${fmt(r.total_assets, 'usd')} · median ${fmt(r.median_assets, 'usd')}${(PG.spec.exclude || []).length ? ` · ${PG.spec.exclude.length} removed by hand <a href="#" id="unex">restore</a>` : ''}</div>
        <div class="scroll" style="max-height:calc(100vh - 300px)"><table class="t"><tr><th class="l">Institution</th><th class="l">City</th><th>Assets</th><th></th></tr>
        ${r.roster.map(x => `<tr><td class="l wrap">${esc(title(x.name))} <span class="muted">${esc(x.id)}</span></td><td class="l muted">${esc(title(x.city))}, ${esc(x.state)}</td><td>${fmt(x.assets, 'usd')}</td><td><a href="#" data-ex="${esc(x.id)}" title="Remove from the group" style="color:var(--mgray);text-decoration:none">×</a></td></tr>`).join('')}</table></div>${r.n > r.roster.length ? `<div class="hint" style="margin:6px 0 0 8px">Largest ${r.roster.length} shown.</div>` : ''}`;
      $$('a[data-ex]', box).forEach(a => a.onclick = e => { e.preventDefault(); PG.spec.exclude = (PG.spec.exclude || []).concat(a.dataset.ex); sp.exclude = PG.spec.exclude; preview(); });
      if ($('#unex')) $('#unex').onclick = e => { e.preventDefault(); delete PG.spec.exclude; delete sp.exclude; preview(); };
    } catch (e) { box.innerHTML = `<h2>Preview</h2><div class="note">${esc(e.message)}</div>`; }
    box.classList.remove('busy');
  };
  $('#pprev').onclick = preview;
  $('#preset').onclick = () => { PG.spec = {}; PG.name = ''; render(); };
  $('#paddf').onclick = () => { PG.spec = read(); (PG.spec.filters = PG.spec.filters || []).push({metric: cu ? 'roa' : 'roaa', umin: null, umax: null}); render(); };
  $$('.pfx').forEach(b => b.onclick = () => { PG.spec = read(); PG.spec.filters.splice(+b.dataset.i, 1); render(); });
  $$('.pfm').forEach(b => b.onchange = () => { PG.spec = read(); render(); });
  $('#psave').onclick = async () => {
    PG.spec = read();
    if (!PG.name) { toast('Give the group a name first.', true); $('#pname').focus(); return; }
    S.saved = await api('save', {type: S.type, what: 'peers', item: {name: PG.name, spec: clean(PG.spec), form: PG.spec}});
    toast('Peer group saved.'); render();
  };
  $('#puse').onclick = () => { PG.spec = read(); addGroup(Object.assign(PG.name ? {name: PG.name} : {}, clean(PG.spec))); toast('Added to the comparison set.'); };
  $$('[data-ld]').forEach(b => b.onclick = () => { const p = S.saved.peers[+b.dataset.ld]; PG.spec = Object.assign({}, p.form || p.spec); PG.name = p.name; render(); });
  $$('[data-ad]').forEach(b => b.onclick = () => { const p = S.saved.peers[+b.dataset.ad]; addGroup(Object.assign({name: p.name}, p.spec)); toast('Added to the comparison set.'); });
  $$('[data-dl]').forEach(b => b.onclick = async () => { const p = S.saved.peers[+b.dataset.dl]; if (!confirm(`Delete the saved peer group "${p.name}"?`)) return; S.saved = await api('save', {type: S.type, what: 'peers', delete: p.name}); render(); });
  if (Object.keys(clean(sp)).length) preview();
};

// ================================================================ Custom formulas
const FX = {item: {label: '', f: '', fmt: 'pct', hib: '', desc: ''}, q: ''};
VIEWS.formulas = async (view, opts, live) => {
  const mine = (S.lib.folders.find(f => f.name === 'My formulas') || {metrics: []}).metrics;
  const it = FX.item;
  view.innerHTML = `<div class="cols wide"><div>
    <div class="card"><h2>${it.key ? 'Edit formula' : 'New formula'}</h2><div class="sub">Build a ratio from raw ${S.type === 'cu' ? 'NCUA 5300 account codes' : 'FDIC call report fields'} and existing ratios. It then works everywhere: trends, rankings, peer group conditions, dashboards.</div>
      <div class="form">
        <div class="field wide"><label>Name</label><input type="text" id="fl" value="${esc(it.label)}" placeholder="e.g. Checking balances per member"></div>
        <div class="field wide"><label>Formula</label><textarea id="ff" rows="3" style="font-family:Consolas,monospace" placeholder="${S.type === 'cu' ? '[902] / [083]' : '[DDT] / [DEP]'}">${esc(it.f)}</textarea><div id="fmsg" class="hint"></div></div>
        <div class="field"><label>Show as</label><select id="ft">${[['pct', 'Percent (0.012 shows as 1.20%)'], ['usd', 'Dollars'], ['num2', 'Number, 2 decimals'], ['num', 'Number, 1 decimal'], ['int', 'Whole number'], ['x', 'Multiple (1.25x)']].map(([k, l]) => `<option value="${k}" ${it.fmt === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>Better when</label><select id="fh"><option value="">Neither (not ranked)</option><option value="1" ${it.hib === true ? 'selected' : ''}>Higher</option><option value="0" ${it.hib === false ? 'selected' : ''}>Lower</option></select></div>
        <div class="field wide"><label>Note <span class="hint">optional</span></label><input type="text" id="fd" value="${esc(it.desc || '')}"></div>
      </div>
      <div class="bar" style="margin-top:12px"><button class="btn pri" id="fsave">Save formula</button><button class="btn" id="ftry">Chart it without saving</button><button class="btn" id="fnew">Clear</button></div></div>
    <div class="card"><h2>My formulas</h2>${mine.length ? `<table class="t">${mine.map(m => `<tr><td>${esc(m.label)}<div class="fx">${esc(m.formula)}</div></td><td><button class="btn sm" data-ch="${esc(m.key)}">Chart</button> <button class="btn sm" data-ed="${esc(m.key)}">Edit</button> <button class="btn sm" data-del="${esc(m.key)}">Delete</button></td></tr>`).join('')}</table>` : '<div class="sub">None yet.</div>'}</div>
    <div class="card"><h2>Formula reference</h2><table class="t">
      ${[[S.type === 'cu' ? '[010]' : '[ASSET]', S.type === 'cu' ? 'A raw 5300 account (here: total assets)' : 'A raw FDIC field, e.g. [ASSET]'], [S.type === 'cu' ? '{roa}' : '{roaa}', 'An existing ratio by key (shown beside each ratio on the right)'],
        ['yoy(x)', '12-month growth'], ['grow(x, 3)', '3-year compound annual growth'], S.type === 'cu' ? ['ytdg(x) · ncuag(x)', 'Growth since year-end · the same annualized (NCUA FPR method)'] : ['ytdg(x)', 'Growth since year-end'], ['qg(x) · qga(x)', 'Quarter-over-quarter growth · annualized'],
        ['ann(x)', 'Annualize a year-to-date income or expense item'], ['ttm(x)', 'Trailing twelve months'], ['booked(x) · anq(x)', 'This quarter alone · this quarter x 4'],
        ['avg(x)', 'Average of now and prior year-end'], ['py(x) · pq(x) · pdec(x) · ago(x, 3)', 'Value a year ago · last quarter · prior year-end · 3 years ago'], ['chg(x) · qchg(x) · ytdchg(x)', 'Change vs a year ago · last quarter · year-end'],
        ['nz(x) · pos(x)', 'Treat n/a as 0 · keep only positive values'], ['if(a > b, x, y)', 'Conditional; also min(a, b), max(a, b), abs(x)']].map(([a, b]) => `<tr><td class="l"><span class="code">${esc(a)}</span></td><td class="l wrap">${esc(b)}</td></tr>`).join('')}</table></div>
  </div><div>
    <div class="card"><h2>Find an account code</h2><input type="text" id="cq" placeholder="${S.type === 'cu' ? 'e.g. share drafts, indirect, 902' : 'e.g. brokered, farmland, DEPNI'}" style="width:100%" value="${esc(FX.q)}"><div id="cres" class="scroll" style="max-height:314px;margin-top:8px"></div></div>
    <div class="card"><h2>Existing ratios</h2><input type="text" id="kq" placeholder="Search ratios to reuse" style="width:100%"><div id="kres" class="scroll" style="max-height:314px;margin-top:8px"></div></div>
  </div></div>`;
  const ins = txt => { const t = $('#ff'), a = t.selectionStart, b = t.selectionEnd; t.value = t.value.slice(0, a) + txt + t.value.slice(b); t.focus(); t.selectionStart = t.selectionEnd = a + txt.length; check(); };
  const check = debounce(async () => {
    const f = $('#ff').value.trim(), box = $('#fmsg');
    if (!f) { box.textContent = ''; return; }
    try { const r = await api('formula_check', {type: S.type, f}); box.textContent = r.ok ? 'Formula is valid.' : r.message; box.style.color = r.ok ? 'var(--good)' : 'var(--bad)'; } catch (e) { box.textContent = e.message; }
  }, 300);
  $('#ff').oninput = check; check();
  const codes = debounce(async () => {
    FX.q = $('#cq').value;
    if (FX.q.trim().length < 2) { $('#cres').innerHTML = '<div class="hint">Type at least two characters.</div>'; return; }
    const r = await apiGet('codes', {type: S.type, q: FX.q});
    $('#cres').innerHTML = r.length ? `<table class="t">${r.map(c => `<tr class="click" data-c="${esc(c.code)}"><td class="l"><span class="code">${esc(c.code)}</span></td><td class="l wrap">${esc(c.name)}</td></tr>`).join('')}</table>` : '<div class="hint">No account matches.</div>';
    $$('#cres tr').forEach(tr => tr.onclick = () => ins('[' + tr.dataset.c + ']'));
  }, 250);
  $('#cq').oninput = codes; codes();
  const keys = () => {
    const q = $('#kq').value.trim().toLowerCase(), out = [];
    S.lib.folders.forEach(f => f.metrics.forEach(m => { if (!q || m.label.toLowerCase().includes(q) || m.key.includes(q)) out.push(m); }));
    $('#kres').innerHTML = `<table class="t">${out.slice(0, 60).map(m => `<tr class="click" data-k="${esc(m.key)}" title="${esc(m.formula)}"><td class="l wrap">${esc(m.label)}</td><td class="l"><span class="code">{${esc(m.key)}}</span></td></tr>`).join('')}</table>`;
    $$('#kres tr').forEach(tr => tr.onclick = () => ins('{' + tr.dataset.k + '}'));
  };
  $('#kq').oninput = keys; keys();
  const read = () => Object.assign(FX.item, {label: $('#fl').value.trim(), f: $('#ff').value.trim(), fmt: $('#ft').value, hib: $('#fh').value === '' ? null : $('#fh').value === '1', desc: $('#fd').value.trim()});
  $('#fsave').onclick = async () => {
    read();
    try { const r = await api('formula_save', {type: S.type, item: FX.item}); await reloadLib(); S.metric = r.key; FX.item = {label: '', f: '', fmt: 'pct', hib: '', desc: ''}; toast('Formula saved to "My formulas".'); render(); }
    catch (e) { toast(e.message, true); }
  };
  $('#ftry').onclick = () => { read(); if (!FX.item.f) return; S.metric = '=' + FX.item.f; go('trends'); };
  $('#fnew').onclick = () => { FX.item = {label: '', f: '', fmt: 'pct', hib: '', desc: ''}; render(); };
  $$('[data-ch]').forEach(b => b.onclick = () => { S.metric = b.dataset.ch; go('trends'); });
  $$('[data-ed]').forEach(b => b.onclick = () => { const m = mine.find(x => x.key === b.dataset.ed); FX.item = {key: m.key, label: m.label, f: m.formula, fmt: m.fmt, hib: m.hib, desc: m.desc}; render(); });
  $$('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Delete this formula?')) return; await api('formula_save', {type: S.type, delete: b.dataset.del}); await reloadLib(); if (S.metric === b.dataset.del) S.metric = S.type === 'cu' ? 'roa' : 'roaa'; render(); });
};

// ================================================================ Branded PDF reports (existing generator)
VIEWS.reports = async view => { view.innerHTML = `<iframe class="rep" src="${window.PB_STATIC ? 'reports.html' : '/reports'}" title="PDF reports"></iframe>`; };
