'use strict';
// Hand-rolled SVG charts: one y-axis, thin marks, legend + direct end labels, hover tooltips.
const NSVG = 'http://www.w3.org/2000/svg';
const INK = '#121821', MUTED = '#6a717c', GRID = '#E9E5DC';
function tipShow(html, x, y) {
  const t = $('#tip'); t.innerHTML = html; t.hidden = false;
  const w = t.offsetWidth, h = t.offsetHeight;
  t.style.left = Math.max(6, Math.min(x + 14, window.innerWidth - w - 8)) + 'px';
  t.style.top = Math.max(6, Math.min(y + 14, window.innerHeight - h - 8)) + 'px';
}
function tipHide() { $('#tip').hidden = true; }
function niceTicks(lo, hi, n) {
  if (!(hi > lo)) { hi = lo + Math.abs(lo || 1) * 0.1; lo = lo - Math.abs(lo || 1) * 0.1; }
  const raw = (hi - lo) / (n || 5), mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const t = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) t.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return t;
}
function axisFmt(v, kind, span) {
  if (kind === 'pct' || kind === 'rate') return (v * 100).toFixed(span < 0.02 ? 2 : span < 0.2 ? 1 : 0) + '%';
  if (kind === 'usd') return fmt(v, 'usd').replace(/\.0+([KMBT])$/, '$1').replace(/(\.\d*[1-9])0+([KMBT])$/, '$1$2');
  if (kind === 'x') return v.toFixed(1) + 'x';
  if (kind === 'num2') return v.toFixed(2);
  return Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(0) + 'K' : v.toLocaleString(undefined, {maximumFractionDigits: 1});
}
function legendHtml(series) {
  return series.length < 2 ? '' : '<div class="legend">' + series.map(s => `<span><i style="background:${s.color}${s.dash ? ';opacity:.75' : ''}"></i>${esc(s.name)}</span>`).join('') + '</div>';
}

// series: [{name, color, values[], dash}], periods: [labels]; opts: {fmt, type: 'line'|'col', height, proj: {from, labels[], values[]}}
function lineChart(box, periods, series, opts) {
  opts = opts || {};
  const kind = opts.fmt || 'pct', type = opts.type || 'line';
  box.innerHTML = legendHtml(series) + '<div class="chart"></div>';
  const host = $('.chart', box);
  const W = Math.max(520, host.clientWidth || 900), H = opts.height || 320;
  const proj = opts.proj && opts.proj.values && opts.proj.values.length ? opts.proj : null;
  const labels = periods.concat(proj ? proj.labels : []);
  const all = [];
  series.forEach(s => s.values.forEach(v => { if (v != null) all.push(v); }));
  if (proj) proj.values.forEach(v => { if (v != null) all.push(v); });
  if (!all.length) { host.innerHTML = '<div class="empty">No data for this ratio in the selected quarters.</div>'; return; }
  let lo = Math.min(...all), hi = Math.max(...all);
  if (type === 'col' || opts.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.08;
  if (!(type === 'col' && lo === 0)) lo -= pad;
  hi += pad;
  const ticks = niceTicks(lo, hi, 5);
  lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
  const endLabels = series.length <= 4 && type === 'line';
  const m = {l: 58, r: endLabels ? 70 : 16, t: 10, b: 30};
  const pw = W - m.l - m.r, ph = H - m.t - m.b, n = labels.length;
  const x = i => m.l + (n === 1 ? pw / 2 : type === 'col' ? (i + 0.5) * pw / n : i * pw / (n - 1));
  const y = v => m.t + ph - (v - lo) / (hi - lo) * ph;
  let s = `<svg xmlns="${NSVG}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif" font-size="11.5">`;
  s += `<rect width="${W}" height="${H}" fill="#fff"/>`;
  ticks.forEach(t => { s += `<line x1="${m.l}" x2="${m.l + pw}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? '#9aa0a8' : GRID}" stroke-width="1"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end" fill="${MUTED}">${axisFmt(t, kind, hi - lo)}</text>`; });
  const every = Math.ceil(n / Math.max(4, Math.floor(pw / 58)));
  labels.forEach((p, i) => { if ((n - 1 - i) % every === 0) s += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" fill="${MUTED}">${esc(p)}</text>`; });
  if (proj) s += `<rect x="${x(periods.length - 1)}" y="${m.t}" width="${x(n - 1) - x(periods.length - 1) + (type === 'col' ? pw / n / 2 : 0)}" height="${ph}" fill="#F7F5F0"/><text x="${x(n - 1)}" y="${m.t + 12}" text-anchor="end" fill="${MUTED}">Projection</text>`;
  if (type === 'col') {
    const bw = Math.min(26, (pw / n - 8) / series.length);
    series.forEach((sr, k) => sr.values.forEach((v, i) => {
      if (v == null) return;
      const x0 = x(i) - bw * series.length / 2 + k * bw + 1, y0 = y(Math.max(v, 0)), hgt = Math.abs(y(v) - y(0));
      s += `<rect x="${x0}" y="${y0}" width="${Math.max(bw - 2, 1)}" height="${Math.max(hgt, 0.5)}" rx="2" fill="${sr.color}"/>`;
    }));
    if (proj) proj.values.forEach((v, j) => { if (v != null) { const i = periods.length + j, x0 = x(i) - bw / 2; s += `<rect x="${x0}" y="${y(Math.max(v, 0))}" width="${bw - 2}" height="${Math.max(Math.abs(y(v) - y(0)), 0.5)}" rx="2" fill="${series[0].color}" opacity=".45"/>`; } });
  } else {
    series.forEach((sr, k) => {
      let d = '', pen = false;
      sr.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); pen = true; });
      s += `<path d="${d}" fill="none" stroke="${sr.color}" stroke-width="${k === 0 ? 2.4 : 1.8}" ${sr.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
      if (n <= 24) sr.values.forEach((v, i) => { if (v != null) s += `<circle cx="${x(i)}" cy="${y(v)}" r="${k === 0 ? 3 : 2.3}" fill="${sr.color}" stroke="#fff" stroke-width="1.5"/>`; });
    });
    if (proj) {
      const li = periods.length - 1, lv = series[0].values[li];
      let d = lv != null ? `M${x(li)} ${y(lv)}` : '';
      proj.values.forEach((v, j) => { if (v != null) d += (d ? 'L' : 'M') + x(periods.length + j) + ' ' + y(v); });
      s += `<path d="${d}" fill="none" stroke="${series[0].color}" stroke-width="2" stroke-dasharray="2 4" stroke-linecap="round"/>`;
      const lastv = proj.values[proj.values.length - 1];
      if (lastv != null) s += `<circle cx="${x(n - 1)}" cy="${y(lastv)}" r="3.5" fill="#fff" stroke="${series[0].color}" stroke-width="2"/>`;
    }
    if (endLabels) {
      const last = periods.length - 1;
      const pts = series.map((sr, k) => ({k, v: sr.values[last], yy: sr.values[last] == null ? null : y(sr.values[last])})).filter(p => p.yy != null).sort((a, b) => a.yy - b.yy);
      for (let i = 1; i < pts.length; i++) if (pts[i].yy - pts[i - 1].yy < 14) pts[i].yy = pts[i - 1].yy + 14;
      if (!proj) pts.forEach(p => { s += `<circle cx="${x(last) + 9}" cy="${p.yy}" r="3" fill="${series[p.k].color}"/><text x="${x(last) + 16}" y="${p.yy + 4}" fill="${INK}" font-weight="${p.k === 0 ? 700 : 400}">${fmt(p.v, kind)}</text>`; });
    }
  }
  s += `<line class="xh" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" stroke="#9aa0a8" stroke-width="1" visibility="hidden"/><rect class="hit" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="transparent"/></svg>`;
  host.innerHTML = s;
  const svg = $('svg', host), xh = $('.xh', svg);
  $('.hit', svg).addEventListener('mousemove', e => {
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W;
    let i = type === 'col' ? Math.floor((px - m.l) / (pw / n)) : Math.round((px - m.l) / (n === 1 ? 1 : pw / (n - 1)));
    i = Math.max(0, Math.min(n - 1, i));
    xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.setAttribute('visibility', 'visible');
    let rows = '';
    if (i < periods.length) series.forEach(sr => { rows += `<div><span><i style="background:${sr.color}"></i>${esc(sr.name)}</span><span><b style="display:inline">${fmt(sr.values[i], kind)}</b></span></div>`; });
    else rows = `<div><span><i style="background:${series[0].color}"></i>${esc(series[0].name)} (projected)</span><span><b style="display:inline">${fmt(proj.values[i - periods.length], kind)}</b></span></div>`;
    tipShow(`<b>${esc(labels[i])}</b>${rows}`, e.clientX, e.clientY);
  });
  $('.hit', svg).addEventListener('mouseleave', () => { xh.setAttribute('visibility', 'hidden'); tipHide(); });
}

// where the primary sits in the peer distribution: p10-p90 band, quartile box, median tick, subject dot
function stripChart(box, dist, value, kind, hib, peer) {
  if (!dist) { box.innerHTML = ''; return; }
  const W = Math.max(420, box.clientWidth || 700), H = 78, m = 14;
  let lo = Math.min(dist.p10, value == null ? dist.p10 : value), hi = Math.max(dist.p90, value == null ? dist.p90 : value);
  const pad = (hi - lo || 1) * 0.08; lo -= pad; hi += pad;
  const x = v => m + (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (W - 2 * m);
  const lab = (v, t, yy, anchor) => `<text x="${x(v)}" y="${yy}" text-anchor="${anchor || 'middle'}" fill="${MUTED}" font-size="11">${t}</text>`;
  let s = `<svg xmlns="${NSVG}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`;
  s += `<rect x="${x(dist.p10)}" y="30" width="${x(dist.p90) - x(dist.p10)}" height="12" rx="6" fill="#E9E5DC"/>`;
  s += `<rect x="${x(dist.p25)}" y="30" width="${x(dist.p75) - x(dist.p25)}" height="12" rx="2" fill="#CFC9BD"/>`;
  s += `<rect x="${x(dist.p50) - 1}" y="26" width="2" height="20" fill="${INK}"/>`;
  s += lab(dist.p10, '10th: ' + fmt(dist.p10, kind), 62, 'start') + lab(dist.p50, 'Median ' + fmt(dist.p50, kind), 62) + lab(dist.p90, '90th: ' + fmt(dist.p90, kind), 62, 'end');
  if (value != null) s += `<circle cx="${x(value)}" cy="36" r="7" fill="${COLORS[0]}" stroke="#fff" stroke-width="2"/><text x="${x(value)}" y="18" text-anchor="${x(value) < 80 ? 'start' : x(value) > W - 80 ? 'end' : 'middle'}" font-size="12" font-weight="700" fill="${INK}">${fmt(value, kind)}</text>`;
  s += '</svg>';
  box.innerHTML = `<div class="chart">${s}</div><div class="hint">Gray band: 10th to 90th percentile of the ranking group. Dark box: middle half. ${hib === false ? 'Lower is better for this ratio.' : hib === true ? 'Higher is better for this ratio.' : 'This ratio has no better direction, so it is not ranked.'}</div>`;
}

function sparkline(vals, color) {
  const v = vals.filter(x => x != null);
  if (v.length < 2) return '';
  const W = 70, H = 20, lo = Math.min(...v), hi = Math.max(...v), n = vals.length;
  let d = '', pen = false;
  vals.forEach((val, i) => { if (val == null) { pen = false; return; } d += (pen ? 'L' : 'M') + (2 + i * (W - 4) / (n - 1)).toFixed(1) + ' ' + (H - 3 - (hi === lo ? 0.5 : (val - lo) / (hi - lo)) * (H - 6)).toFixed(1); pen = true; });
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="vertical-align:middle"><path d="${d}" fill="none" stroke="${color || '#535B67'}" stroke-width="1.5"/></svg>`;
}

// pts: [{name, state, v: [x, y]}]; subject: {name, v}
function scatterChart(box, pts, subject, axes) {
  box.innerHTML = '<div class="chart"></div>';
  const host = $('.chart', box), W = Math.max(520, host.clientWidth || 900), H = 420, m = {l: 64, r: 20, t: 12, b: 44};
  const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))]; };
  const xs = pts.map(p => p.v[0]), ys = pts.map(p => p.v[1]);
  if (!xs.length) { host.innerHTML = '<div class="empty">No institutions report both ratios.</div>'; return; }
  // clip the axes at Tukey's far-out fences (3 x IQR) so a few outliers do not flatten the cloud
  const dom = (arr, sv) => { const q1 = q(arr, 0.25), q3 = q(arr, 0.75), f = 3 * (q3 - q1); let lo = Math.max(q(arr, 0), q1 - f), hi = Math.min(q(arr, 1), q3 + f); if (sv != null) { lo = Math.min(lo, sv); hi = Math.max(hi, sv); } const pad = (hi - lo || 1) * 0.06; return [lo - pad, hi + pad]; };
  const [x0, x1] = dom(xs, subject && subject.v[0]), [y0, y1] = dom(ys, subject && subject.v[1]);
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const X = v => m.l + (Math.max(x0, Math.min(x1, v)) - x0) / (x1 - x0) * pw, Y = v => m.t + ph - (Math.max(y0, Math.min(y1, v)) - y0) / (y1 - y0) * ph;
  let s = `<svg xmlns="${NSVG}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif" font-size="11.5"><rect width="${W}" height="${H}" fill="#fff"/>`;
  niceTicks(y0, y1, 5).forEach(t => { s += `<line x1="${m.l}" x2="${m.l + pw}" y1="${Y(t)}" y2="${Y(t)}" stroke="${GRID}"/><text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end" fill="${MUTED}">${axisFmt(t, axes[1].fmt, y1 - y0)}</text>`; });
  niceTicks(x0, x1, 6).forEach(t => { s += `<line y1="${m.t}" y2="${m.t + ph}" x1="${X(t)}" x2="${X(t)}" stroke="${GRID}"/><text x="${X(t)}" y="${m.t + ph + 16}" text-anchor="middle" fill="${MUTED}">${axisFmt(t, axes[0].fmt, x1 - x0)}</text>`; });
  s += `<text x="${m.l + pw / 2}" y="${H - 6}" text-anchor="middle" fill="${INK}" font-weight="600">${esc(axes[0].label)}</text>`;
  s += `<text transform="translate(14 ${m.t + ph / 2}) rotate(-90)" text-anchor="middle" fill="${INK}" font-weight="600">${esc(axes[1].label)}</text>`;
  const r = pts.length > 800 ? 2.2 : pts.length > 200 ? 3 : 4;
  pts.forEach((p, i) => { s += `<circle data-i="${i}" cx="${X(p.v[0]).toFixed(1)}" cy="${Y(p.v[1]).toFixed(1)}" r="${r}" fill="#2F5D8A" fill-opacity=".55" stroke="#fff" stroke-width=".6"/>`; });
  if (subject && subject.v[0] != null && subject.v[1] != null) s += `<circle cx="${X(subject.v[0])}" cy="${Y(subject.v[1])}" r="7" fill="${COLORS[0]}" stroke="#fff" stroke-width="2"/><text x="${X(subject.v[0]) > m.l + pw * 0.6 ? X(subject.v[0]) - 11 : X(subject.v[0]) + 11}" y="${Y(subject.v[1]) + 4}" text-anchor="${X(subject.v[0]) > m.l + pw * 0.6 ? 'end' : 'start'}" font-weight="700" fill="${INK}" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(subject.name)}</text>`;
  s += '</svg>';
  host.innerHTML = s;
  const svg = $('svg', host);
  svg.addEventListener('mousemove', e => {
    const c = e.target.closest('circle[data-i]');
    if (!c) { tipHide(); return; }
    const p = pts[+c.dataset.i];
    tipShow(`<b>${esc(title(p.name))}, ${esc(p.state)}</b><div><span>${esc(axes[0].label)}</span><span>${fmt(p.v[0], axes[0].fmt)}</span></div><div><span>${esc(axes[1].label)}</span><span>${fmt(p.v[1], axes[1].fmt)}</span></div>`, e.clientX, e.clientY);
  });
  svg.addEventListener('mouseleave', tipHide);
}

// horizontal ranked bars (market share leaders etc.): rows [{label, value, me}]
function barList(box, rows, kind, opts) {
  const max = Math.max(...rows.map(r => r.value), 0) || 1;
  box.innerHTML = rows.map(r => `<div style="display:grid;grid-template-columns:${(opts && opts.labelW) || 230}px 1fr 70px;gap:8px;align-items:center;margin:3px 0;font-size:12.5px">
    <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${r.me ? 'font-weight:700' : ''}" title="${esc(r.label)}">${esc(r.label)}</span>
    <span style="background:#F1EDE5;border-radius:4px;height:12px"><span style="display:block;height:12px;border-radius:4px;width:${Math.max(0.5, r.value / max * 100)}%;background:${r.me ? COLORS[0] : '#2F5D8A'}"></span></span>
    <span style="text-align:right;font-variant-numeric:tabular-nums">${fmt(r.value, kind)}</span></div>`).join('');
}

// rasterize the first SVG inside `box` to a PNG data URL (for PowerPoint / image download)
function svgToPng(box, scale) {
  return new Promise(resolve => {
    const svg = $('svg', box);
    if (!svg) return resolve(null);
    const vb = svg.viewBox.baseVal, k = scale || 2;
    const clone = svg.cloneNode(true);
    $$('.hit,.xh', clone).forEach(n => n.remove());
    clone.setAttribute('width', vb.width); clone.setAttribute('height', vb.height);
    const img = new Image();
    img.onload = () => {
      const foot = 34, c = document.createElement('canvas'); c.width = vb.width * k; c.height = (vb.height + foot) * k;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, vb.width * k, vb.height * k);
      // brand strip: gold rule, AV mark and name, data source
      g.scale(k, k); const y = vb.height; g.fillStyle = '#B08D57'; g.fillRect(0, y + 4, vb.width, 1.5);
      const done = () => { g.font = 'italic 600 13px Georgia, serif'; g.fillStyle = '#14233A'; g.textAlign = 'right'; g.fillText('AV’s Peer Benchmark', vb.width - 10, y + 24);
        g.font = '11px Segoe UI, Arial, sans-serif'; g.fillStyle = '#8A909A'; g.textAlign = 'left'; g.fillText('Source: public NCUA 5300 and FDIC call report data', 10, y + 24); resolve(c.toDataURL('image/png')); };
      const logo = new Image(); logo.onload = () => { const h = 20, w = h * logo.width / logo.height; g.font = 'italic 600 13px Georgia, serif'; g.drawImage(logo, vb.width - 16 - g.measureText('AV’s Peer Benchmark').width - w, y + 9, w, h); done(); };
      logo.onerror = done; logo.src = 'web/logo-navy.png';
    };
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  });
}
function downloadDataUrl(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
