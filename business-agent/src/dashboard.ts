/**
 * Dashboard — HTTP server on port 3103
 * Dark glass UI showing all 3 loops: monetization, launcher, health check.
 */
import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BusinessAgentState, HealthLoopRun } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3103', 10);
const STATE_FILE = path.join(__dirname, '..', 'state.json');

function loadState(): BusinessAgentState {
  if (!fs.existsSync(STATE_FILE)) {
    return {
      lastMonetizationRunAt: null,
      lastLauncherRunAt: null,
      lastHealthRunAt: null,
      monetizationHistory: [],
      launcherHistory: [],
      healthHistory: [],
    };
  }
  const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  if (!s.lastHealthRunAt) s.lastHealthRunAt = null;
  if (!s.healthHistory)   s.healthHistory   = [];
  return s;
}

function badge(status: string): string {
  const colors: Record<string, string> = {
    running:   '#f59e0b',
    completed: '#10b981',
    error:     '#ef4444',
    skipped:   '#6b7280',
    success:   '#10b981',
    failed:    '#ef4444',
    up:        '#10b981',
    down:      '#ef4444',
  };
  const color = colors[status] || '#6b7280';
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;">${status}</span>`;
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function renderHealthSection(latestHealth: HealthLoopRun | undefined, lastAt: string | null): string {
  if (!latestHealth) {
    return `<div class="panel"><p style="color:#6b7280;text-align:center;padding:20px;">No health run yet — click Run Now to start</p></div>`;
  }

  const siteRowsHtml = latestHealth.results.map(r => {
    const upBadge = r.isUp ? badge('up') : badge('down');
    const msLabel = r.responseTimeMs !== null ? `${r.responseTimeMs}ms` : '—';
    const errCell = r.errorDetected
      ? `<span style="color:#f87171;font-size:12px;">${r.errorDetected}</span>`
      : '<span style="color:#34d399;font-size:12px;">OK</span>';
    const fixCell = r.fixApplied
      ? `<span style="color:#a78bfa;font-size:11px;">${r.fixApplied}</span>`
      : '—';
    const ideas = r.monetizationInsights.length
      ? `<ul style="margin:0;padding-left:14px;font-size:11px;color:#94a3b8;">${r.monetizationInsights.map(i => `<li>${i}</li>`).join('')}</ul>`
      : '—';
    return `<tr>
      <td><a href="${r.url}" target="_blank" style="color:#818cf8;">${r.siteName}</a></td>
      <td>${upBadge} <span style="font-size:11px;color:#64748b;">${msLabel}</span></td>
      <td>${errCell}</td>
      <td>${fixCell}</td>
      <td style="max-width:280px;">${ideas}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:#6b7280;">No results</td></tr>';

  const crossIdeasHtml = latestHealth.newMonetizationIdeas.length
    ? latestHealth.newMonetizationIdeas.map(i =>
        `<li style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;color:#94a3b8;">${i}</li>`
      ).join('')
    : '<li style="color:#6b7280;">None yet</li>';

  return `
    <div class="panel">
      <div class="info-row">
        Run ID: <code>${latestHealth.id}</code> | ${badge(latestHealth.status)} |
        ${latestHealth.sitesChecked} sites | ${latestHealth.sitesDown} down | ${latestHealth.fixesApplied} fixes | ${timeAgo(latestHealth.startedAt)}
      </div>
      <table style="margin-bottom:20px;">
        <thead>
          <tr>
            <th>Site</th><th>Status</th><th>Error</th><th>Fix Applied</th><th>Monetization Ideas</th>
          </tr>
        </thead>
        <tbody>${siteRowsHtml}</tbody>
      </table>
      <div style="margin-top:16px;">
        <div style="font-size:13px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Cross-Site Research</div>
        <ul style="padding-left:16px;">${crossIdeasHtml}</ul>
      </div>
    </div>`;
}

function renderHTML(): string {
  const state = loadState();
  const now = new Date().toISOString();

  const latestMon    = state.monetizationHistory[0];
  const latestLaunch = state.launcherHistory[0];
  const latestHealth = state.healthHistory?.[0];

  const monActionsHtml = (latestMon?.actions || []).map(a => `
    <tr>
      <td>${a.siteName}</td>
      <td>${a.actionType}</td>
      <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.description || '—'}</td>
      <td>${badge(a.status)}</td>
      <td>${a.commitHash ? `<code>${a.commitHash}</code>` : '—'}</td>
      <td>${timeAgo(a.implementedAt)}</td>
    </tr>
  `).join('') || '<tr><td colspan="6" style="text-align:center;color:#6b7280;">No actions yet</td></tr>';

  const launchProductsHtml = (latestLaunch?.products || []).map(p => `
    <tr>
      <td>${p.title}</td>
      <td>${p.niche}</td>
      <td>${p.score}/50</td>
      <td>${p.repoUrl ? `<a href="${p.repoUrl}" target="_blank" style="color:#818cf8;">${p.repoUrl}</a>` : '—'}</td>
      <td>${timeAgo(p.launchedAt)}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center;color:#6b7280;">No products launched yet</td></tr>';

  const monHistoryHtml = state.monetizationHistory.slice(0, 8).map(r => `
    <tr>
      <td><code style="font-size:11px;">${r.id}</code></td>
      <td>${badge(r.status)}</td>
      <td>${r.sitesProcessed}</td>
      <td>${r.actionsApplied}</td>
      <td>${timeAgo(r.startedAt)}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center;color:#6b7280;">No runs yet</td></tr>';

  const launchHistoryHtml = state.launcherHistory.slice(0, 5).map(r => `
    <tr>
      <td><code style="font-size:11px;">${r.id}</code></td>
      <td>${badge(r.status)}</td>
      <td>${r.niches?.join(', ') || '—'}</td>
      <td>${r.ideasEvaluated}</td>
      <td>${r.productsLaunched}</td>
      <td>${timeAgo(r.startedAt)}</td>
    </tr>
  `).join('') || '<tr><td colspan="6" style="text-align:center;color:#6b7280;">No runs yet</td></tr>';

  const totalActions = state.monetizationHistory.reduce((s, r) => s + r.actionsApplied, 0);
  const totalProducts = state.launcherHistory.reduce((s, r) => s + r.productsLaunched, 0);
  const totalSitesUp = latestHealth ? latestHealth.results.filter(r => r.isUp).length : '—';
  const totalSites   = latestHealth ? latestHealth.results.length : '—';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Business Agent Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f0f1a;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 24px;
    }
    h1 { font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 4px; }
    .subtitle { color: #64748b; font-size: 13px; margin-bottom: 32px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 32px; }
    .card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 20px;
    }
    .card h2 { font-size: 13px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
    .stat { font-size: 36px; font-weight: 800; color: #f1f5f9; }
    .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; margin-bottom: 12px; }
    .section { margin-bottom: 32px; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .section-title { font-size: 17px; font-weight: 700; color: #f1f5f9; }
    .btn {
      background: linear-gradient(135deg, #818cf8, #c084fc);
      color: #fff;
      border: none;
      padding: 7px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    .btn:hover { opacity: 0.85; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 12px; color: #64748b; font-weight: 600; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.06); }
    td { padding: 9px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-size:11px; }
    .info-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; font-size: 13px; color: #94a3b8; flex-wrap: wrap; }
    .info-row strong { color: #e2e8f0; }
    .panel {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 16px;
    }
    .refresh-note { font-size: 11px; color: #475569; text-align: right; margin-top: 8px; }
  </style>
  <meta http-equiv="refresh" content="30">
</head>
<body>
  <h1>Business Agent</h1>
  <p class="subtitle">3 autonomous loops — monetization improver · product launcher · site health | ${now}</p>

  <!-- Stats grid -->
  <div class="grid">
    <div class="card">
      <h2>Loop 1 — Monetization</h2>
      <div class="stat">${totalActions}</div>
      <div class="stat-label">revenue changes applied total</div>
      <div class="info-row">Last run: <strong>${timeAgo(state.lastMonetizationRunAt)}</strong></div>
      <div class="info-row">Status: ${badge(latestMon?.status ?? 'idle')}</div>
    </div>
    <div class="card">
      <h2>Loop 2 — Launcher</h2>
      <div class="stat">${totalProducts}</div>
      <div class="stat-label">products launched total</div>
      <div class="info-row">Last run: <strong>${timeAgo(state.lastLauncherRunAt)}</strong></div>
      <div class="info-row">Status: ${badge(latestLaunch?.status ?? 'idle')}</div>
    </div>
    <div class="card">
      <h2>Loop 3 — Health</h2>
      <div class="stat">${totalSitesUp}<span style="font-size:18px;font-weight:400;color:#64748b;">/${totalSites}</span></div>
      <div class="stat-label">sites up in last check</div>
      <div class="info-row">Last run: <strong>${timeAgo(state.lastHealthRunAt)}</strong></div>
      <div class="info-row">Status: ${badge(latestHealth?.status ?? 'idle')}</div>
    </div>
    <div class="card">
      <h2>Total Fixes</h2>
      <div class="stat">${(state.healthHistory || []).reduce((s, r) => s + r.fixesApplied, 0)}</div>
      <div class="stat-label">auto-fixes applied ever</div>
      <div class="info-row">Health runs: <strong>${(state.healthHistory || []).length}</strong></div>
    </div>
  </div>

  <!-- Loop 3 — Health -->
  <div class="section">
    <div class="section-header">
      <span class="section-title">Loop 3 — Site Health &amp; Monetization Research</span>
      <a href="/trigger/health" class="btn">&#9654; Run Now</a>
    </div>
    ${renderHealthSection(latestHealth, state.lastHealthRunAt)}
  </div>

  <!-- Loop 1 — Monetization actions -->
  <div class="section">
    <div class="section-header">
      <span class="section-title">Loop 1 — Last Run Actions</span>
      <a href="/trigger/monetization" class="btn">&#9654; Run Now</a>
    </div>
    <div class="panel">
      ${latestMon ? `<div class="info-row">Run: <code>${latestMon.id}</code> | ${badge(latestMon.status)} | ${timeAgo(latestMon.startedAt)}</div>` : ''}
      <table>
        <thead><tr><th>Site</th><th>Type</th><th>Description</th><th>Status</th><th>Commit</th><th>When</th></tr></thead>
        <tbody>${monActionsHtml}</tbody>
      </table>
    </div>
  </div>

  <!-- Loop 2 — Products -->
  <div class="section">
    <div class="section-header">
      <span class="section-title">Loop 2 — Last Run Products</span>
      <a href="/trigger/launcher" class="btn">&#9654; Run Now</a>
    </div>
    <div class="panel">
      ${latestLaunch ? `<div class="info-row">Run: <code>${latestLaunch.id}</code> | ${badge(latestLaunch.status)} | Niches: ${latestLaunch.niches?.join(', ')} | Evaluated: ${latestLaunch.ideasEvaluated}</div>` : ''}
      <table>
        <thead><tr><th>Product</th><th>Niche</th><th>Score</th><th>Repo</th><th>When</th></tr></thead>
        <tbody>${launchProductsHtml}</tbody>
      </table>
    </div>
  </div>

  <!-- History rows -->
  <div class="section">
    <div class="section-header"><span class="section-title">Monetization Run History</span></div>
    <div class="panel">
      <table>
        <thead><tr><th>Run ID</th><th>Status</th><th>Sites</th><th>Changes</th><th>When</th></tr></thead>
        <tbody>${monHistoryHtml}</tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-header"><span class="section-title">Launcher Run History</span></div>
    <div class="panel">
      <table>
        <thead><tr><th>Run ID</th><th>Status</th><th>Niches</th><th>Ideas</th><th>Launched</th><th>When</th></tr></thead>
        <tbody>${launchHistoryHtml}</tbody>
      </table>
    </div>
  </div>

  <p class="refresh-note">Auto-refreshes every 30 seconds</p>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
    return;
  }

  if (req.url === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadState(), null, 2));
    return;
  }

  if (req.url === '/trigger/monetization') {
    fs.writeFileSync('/tmp/business-agent-trigger-mon', Date.now().toString());
    res.writeHead(302, { Location: '/' });
    res.end();
    return;
  }

  if (req.url === '/trigger/launcher') {
    fs.writeFileSync('/tmp/business-agent-trigger-launch', Date.now().toString());
    res.writeHead(302, { Location: '/' });
    res.end();
    return;
  }

  if (req.url === '/trigger/health') {
    fs.writeFileSync('/tmp/business-agent-trigger-health', Date.now().toString());
    res.writeHead(302, { Location: '/' });
    res.end();
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(renderHTML());
});

server.listen(PORT, () => {
  console.log(`[Dashboard] Running at http://0.0.0.0:${PORT}`);
});

export { server };
