'use strict';
// What-if plan, early-warning flags and the board packet.

const PLAN_KEY = () => S.type + ':' + (S.subj ? (S.subj.merge ? S.subj.merge.join('+') : S.subj.id) : '');
function planLoad() { try { return (JSON.parse(localStorage.getItem('pa-plans') || '{}'))[PLAN_KEY()] || null; } catch (e) { return null; } }
function planSave(d) {
  try { const all = JSON.parse(localStorage.getItem('pa-plans') || '{}'); if (d) all[PLAN_KEY()] = d; else delete all[PLAN_KEY()]; localStorage.setItem('pa-plans', JSON.stringify(all)); } catch (e) {}
}
const needSubject = what => `<div class="card"><div class="empty">Pick a primary ${instWord(S.type, 1)} above to ${what}.</div></div>`;
const pctTxt = p => p == null ? '' : Math.round(p) + '';

// ================================================================ What-if plan
VIEWS.plan = async (view, opts, live) => {
  if (!S.subj) { view.innerHTML = needSubject('build a plan'); return; }
  let drivers = planLoad();
  let r = await api('plan', ctx({drivers: drivers || {}}));
  if (!live()) return;
  setGroupMeta([{name: r.group, n: r.n, note: r.note, type: 'group', kind: r.type}].concat((S.groupMeta || []).slice(1)), null);
  const unit = u => u === 'bp' ? 'bp' : '%';
  view.innerHTML = `
    <div class="card"><div class="bar"><div><h2>What-if plan: ${esc(r.subject)}</h2>
      <div class="sub" style="margin:0">Next 12 months from ${qlabel(r.period)} · ranked against ${r.n} ${instWord(r.type)}: ${esc(r.group)}</div></div>
      <span class="acts"><button class="btn" id="pace" title="Growth at last year's actual pace, rates unchanged">Last year's pace</button>
      <button class="btn" id="flat" title="No balance growth, rates unchanged">No growth</button>
      <button class="btn" id="xl">Excel</button><button class="btn" id="pp">PowerPoint</button>
      <button class="btn pri" id="board" title="Branded PDF and PowerPoint for the board, with this plan included">Board packet</button></span></div>
      ${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}
      <div class="form plan" id="drv">${r.drivers.map(d => `<label>${esc(d.label)}<span class="unit"><input type="number" step="${d.unit === 'bp' ? 5 : 0.1}" data-k="${d.key}" value="${d.value}"><i>${unit(d.unit)}</i></span>
        <small class="muted">Last 12 months: ${d.unit === 'bp' ? '0 bp (today)' : d.base.toFixed(2) + '%'}</small></label>`).join('')}</div>
      <div class="hint">Change any number and the plan re-ranks at once. Growth rates are for the next 12 months. Yield and cost changes are in basis points (100 bp = 1%). Your plan is saved in this browser for this ${instWord(S.type, 1)}.</div>
    </div>
    <div id="planout"></div>`;
  const out = $('#planout');
  const draw = () => {
    const ranked = r.rows;
    const tr = x => {
      const d = x.plan != null && x.now != null ? x.plan - x.now : null;
      const better = d == null || x.hib == null ? '' : ((x.hib ? d > 0 : d < 0) ? 'good' : Math.abs(d) < 1e-9 ? '' : 'bad');
      const rk = (a, b) => x.neutral ? '<span class="muted">n/r</span>' : (a ? a + ' → ' + b + ' / ' + x.of : '');
      return `<tr><td>${esc(x.label)}</td><td>${fmt(x.now, x.fmt)}</td><td class="strong">${fmt(x.plan, x.fmt)}</td>
        <td class="${better}">${d == null ? '' : fmtDelta(x.plan, x.now, x.fmt)}</td><td>${fmt(x.median, x.fmt)}</td><td>${x.top25 == null ? '' : fmt(x.top25, x.fmt)}</td>
        <td class="l">${x.neutral ? '' : pbar(x.now_pct)}</td><td class="l">${x.neutral ? '' : pbar(x.plan_pct)}</td><td>${rk(x.now_rank, x.plan_rank)}</td></tr>`;
    };
    const money = r.money.map(m => m.style === 'h' ? `<tr><td colspan="4" class="l strong muted">${esc(m.label)}</td></tr>` :
      `<tr class="${m.style === 'b' ? 'strong' : ''}"><td>${esc(m.label)}</td><td>${fmt(m.now, 'usd')}</td><td>${fmt(m.plan, 'usd')}</td><td>${m.chg == null ? '' : signed(m.chg, 1, '%')}</td></tr>`).join('');
    out.innerHTML = `
      <div class="card"><h2>What the plan does</h2>
        <div class="ins">${r.summary.map(t => `<div class="${t.kind}">${esc(t.text)}</div>`).join('')}</div>
        ${r.goal ? `<div class="goal ${r.goal.met ? 'met' : ''}"><b>${r.goal.met ? 'Goal met' : 'What it takes'}</b> ${esc(r.goal.text)}</div>` : ''}
        ${r.borrowing_note ? `<div class="sub" style="margin-top:8px">${esc(r.borrowing_note)}</div>` : ''}</div>
      <div class="card"><div class="bar"><h2>Ratios: today vs plan</h2><span class="sp"></span><span class="hint">Percentiles: 100 = best. The plan is ranked against the peers' values today. Top-quartile mark = the value that would put ${esc(r.subject)} in the best 25% of peers.</span></div>
        <div class="scroll"><table class="t"><tr><th>Ratio</th><th>Today</th><th>Plan</th><th>Change</th><th>Peer median</th><th>Top-quartile mark</th><th class="l">Percentile today</th><th class="l">Percentile with plan</th><th>Rank</th></tr>
        ${ranked.map(tr).join('')}</table></div></div>
      <div class="card"><h2>Pro forma</h2><div class="scroll"><table class="t pf" style="max-width:720px"><tr><th>Item</th><th>Today</th><th>Plan</th><th>Change</th></tr>${money}</table></div>
        <div class="hint">How the plan is built: balances at ${qlabel(r.period)}, income and expense year-to-date annualized. Average balances grow with the plan. Loan yield, other asset yield and cost of funds move by the basis points you set. Borrowings fill any gap between assets and deposits plus capital. Net income adds to capital${r.type === 'bank' ? ' after the current dividend payout and tax rate' : ''}. Other income items stay at today's level. Each ratio is today's value plus the change the model shows, so it stays on the same definition the peers are ranked on.</div></div>`;
  };
  draw();
  const rerun = debounce(async () => {
    const d = {};
    $$('#drv input', view).forEach(i => { if (i.value !== '') d[i.dataset.k] = +i.value; });
    drivers = d; planSave(d);
    try { r = await api('plan', ctx({drivers: d})); if (live()) draw(); } catch (e) { toast(e.message, true); }
  }, 250);
  $$('#drv input', view).forEach(i => i.oninput = rerun);
  $('#pace').onclick = () => { planSave(null); render(); };
  $('#flat').onclick = () => { planSave({gA: 0, gL: 0, gD: 0, dYL: 0, dYO: 0, dCOF: 0, gN: 0, gO: 0}); render(); };
  $('#board').onclick = () => boardPacket();
  $('#xl').onclick = () => exportXlsx(`${r.subject} what-if plan ${qlabel(r.period)}`, [
    {name: 'Plan', title: `${r.subject}: what-if plan, next 12 months from ${qlabel(r.period)}`, subtitle: [`Ranked against ${r.n} peers: ${r.group}. Peers held at today's values.`].concat(r.summary.map(t => t.text)),
      columns: [{label: 'Ratio', width: 38}, {label: 'Today'}, {label: 'Plan'}, {label: 'Peer median'}, {label: 'Top-quartile mark', width: 18}, {label: 'Percentile today'}, {label: 'Percentile with plan', width: 18}, {label: 'Rank today'}, {label: 'Rank with plan'}, {label: 'Of'}],
      rows: r.rows.map(x => [x.label, {v: x.now, fmt: x.fmt}, {v: x.plan, fmt: x.fmt}, {v: x.median, fmt: x.fmt}, {v: x.top25, fmt: x.fmt}, x.neutral || x.now_pct == null ? null : Math.round(x.now_pct), x.neutral || x.plan_pct == null ? null : Math.round(x.plan_pct), x.neutral ? null : x.now_rank, x.neutral ? null : x.plan_rank, x.of])},
    {name: 'Assumptions', columns: [{label: 'Driver', width: 36}, {label: 'Plan', width: 14}, {label: 'Last 12 months', width: 16}, {label: 'Unit'}],
      rows: r.drivers.map(d => [d.label, d.value, d.unit === 'bp' ? 0 : d.base, d.unit === 'bp' ? 'basis points' : 'percent'])},
    {name: 'Pro forma', columns: [{label: 'Item', width: 36}, {label: 'Today', fmt: 'usd', width: 18}, {label: 'Plan', fmt: 'usd', width: 18}, {label: 'Change', fmt: 'pct1'}],
      rows: r.money.filter(m => m.style !== 'h').map(m => [m.label, m.now, m.plan, m.chg])}]);
  $('#pp').onclick = () => exportPptx(`${r.subject} what-if plan ${qlabel(r.period)}`, [
    {title: `${r.subject}: what-if plan`, subtitle: `Next 12 months from ${qlabel(r.period)} · vs ${r.n} peers: ${r.group}`, note: r.summary.map(t => t.text).concat(r.goal ? [r.goal.text] : []).join('\n')},
    {title: 'Ratios: today vs plan', subtitle: 'Percentile: 100 = best. Peers held at today\'s values.',
      table: {columns: ['Ratio', 'Today', 'Plan', 'Peer median', 'Pctl today', 'Pctl plan'], rows: r.rows.map(x => [x.label, fmt(x.now, x.fmt), fmt(x.plan, x.fmt), fmt(x.median, x.fmt), x.neutral ? '' : pctTxt(x.now_pct), x.neutral ? '' : pctTxt(x.plan_pct)])}},
    {title: 'Assumptions and pro forma', table: {columns: ['Item', 'Today', 'Plan'], rows: r.drivers.map(d => [d.label, d.unit === 'bp' ? '0 bp' : d.base.toFixed(2) + '%', d.value + (d.unit === 'bp' ? ' bp' : '%')]).concat(r.money.filter(m => m.style !== 'h').map(m => [m.label, fmt(m.now, 'usd'), fmt(m.plan, 'usd')]))}}]);
};

// ================================================================ Early warning
const FLAG_WORD = {red: 'Red', yellow: 'Watch', green: 'OK'};
const dot = s => `<span class="flag ${s}" title="${FLAG_WORD[s] || ''}"></span>`;
VIEWS.flags = async (view, opts, live) => {
  if (!S.subj) { view.innerHTML = needSubject('see its early-warning flags'); return; }
  const r = await api('flags', ctx());
  if (!live()) return;
  setGroupMeta([{name: r.group, n: r.n, note: r.note, type: 'group', kind: r.type}].concat((S.groupMeta || []).slice(1)), null);
  const tiles = r.areas.map(a => `<div class="tile ftile ${a.status}"><small>${esc(a.name)}</small><b>${dot(a.status)} ${FLAG_WORD[a.status]}</b>
    <em>${a.items.filter(i => i.status !== 'green').length} of ${a.items.length} indicators flagged</em></div>`).join('');
  const rows = a => a.items.map(i => `<tr class="${i.status === 'green' ? '' : 'fl-' + i.status}"><td>${dot(i.status)}</td><td class="l" title="${esc(i.desc)}">${esc(i.label)}</td>
    <td class="strong">${fmt(i.value, i.fmt)}</td><td>${fmt(i.median, i.fmt)}</td><td class="l">${i.hib == null ? '<span class="muted">n/r</span>' : pbar(i.peer_pct)}</td>
    <td class="l">${sparkline(i.trend, COLORS[0])}</td><td class="l why">${i.why.length ? esc(i.why.join(' ')) : '<span class="muted">Within normal range.</span>'}</td></tr>`).join('');
  view.innerHTML = `
    <div class="card"><div class="bar"><div><h2>Early warning: ${esc(r.subject)}</h2>
      <div class="sub" style="margin:0">${qlabel(r.period)} · compared with ${r.n} ${instWord(r.type)}: ${esc(r.group)}</div></div>
      <span class="acts"><button class="btn" id="xl">Excel</button><button class="btn pri" id="board">Board packet</button></span></div>
      <div class="ins"><div class="summary">${esc(r.headline)}</div></div>
      <div class="tiles" style="margin-top:10px">${tiles}</div>
      <div class="hint">Red: a regulatory line is crossed, the institution is losing money, or it is in the worst 10% of peers on a core ratio and worse for 3 quarters in a row. Watch: in the bottom quarter of peers, near a regulatory line, an outlier on a mix ratio, or worse for 3 quarters in a row. Regulatory lines: NCUA well-capitalized net worth 7% (complex credit unions: risk-based capital 10%); FDIC well-capitalized leverage 5%, CET1 6.5%, Tier 1 8%, total capital 10%; 2006 interagency CRE guidance 300% / 100% of capital. These flags read public call report data only. They are not a CAMELS rating.</div></div>
    ${r.areas.map(a => `<div class="card"><div class="bar"><h2>${dot(a.status)} ${esc(a.name)}</h2></div>
      <div class="scroll"><table class="t flags"><tr><th></th><th class="l">Indicator</th><th>${esc(r.subject.length > 22 ? 'Value' : r.subject)}</th><th>Peer median</th><th class="l">Percentile</th><th class="l">5 quarters</th><th class="l">Why</th></tr>${rows(a)}</table></div></div>`).join('')}`;
  $('#board').onclick = () => boardPacket();
  $('#xl').onclick = () => exportXlsx(`${r.subject} early warning ${qlabel(r.period)}`, [{name: 'Early warning', title: `${r.subject}: early-warning flags, ${qlabel(r.period)}`,
    subtitle: [r.headline, `Compared with ${r.n} peers: ${r.group}.`], columns: [{label: 'Area', width: 20}, {label: 'Indicator', width: 38}, {label: 'Status'}, {label: 'Value'}, {label: 'Peer median'}, {label: 'Percentile'}, {label: 'Why', width: 90}],
    rows: r.areas.flatMap(a => a.items.map(i => [a.name, i.label, FLAG_WORD[i.status], {v: i.value, fmt: i.fmt}, {v: i.median, fmt: i.fmt}, i.hib == null || i.peer_pct == null ? null : Math.round(i.peer_pct), i.why.join(' ')]))}]);
};

// ================================================================ Board packet
async function boardPacket() {
  if (!S.subj) { toast('Pick a primary institution first.', true); return; }
  toast('Building the board packet (PDF and PowerPoint)…');
  try {
    const r = await api('board', ctx({drivers: planLoad(), metrics: (S.lib.scorecard || []).filter(k => metricDef(k))}));
    if (!window.open(r.pdf, '_blank')) { const a = document.createElement('a'); a.href = r.pdf; a.download = r.name + '.pdf'; document.body.appendChild(a); a.click(); a.remove(); }
    const a = document.createElement('a'); a.href = r.pptx; a.download = r.name + '.pptx'; document.body.appendChild(a); a.click(); a.remove();
    toast(window.PB_STATIC ? 'Board packet ready (PDF and PowerPoint).' : 'Board packet saved to the output folder (PDF and PowerPoint).');
  } catch (e) { toast('Board packet failed: ' + e.message, true); }
}
