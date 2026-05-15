import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath, fileURLToPath as fu } from 'url';
import { createRequire } from 'module';
import { WatchdogState, WebsitesConfig, HistoryEntry, PipelineStage, RunningState, SiteRunStatus } from './types.js';
import { TokenManager } from './tokenManager.js';

const _require = createRequire(import.meta.url);

// ─── NinjaPA DB stats ────────────────────────────────────────────────────────

interface NinjaStats {
  totalUsers: number; freeUsers: number; proUsers: number;
  activeToday: number; activeWeek: number; msgToday: number;
  totalTasks: number; pendingTasks: number; activeReminders: number;
  totalInvoices: number; timezones: { timezone: string; cnt: number }[];
}

function getNinjaPAStats(): NinjaStats | null {
  try {
    const dbPath = '/root/ninjapa/ninjapa.db';
    if (!fs.existsSync(dbPath)) return null;
    const Database = _require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    const q = (sql: string) => (db.prepare(sql).get() as any);
    const stats: NinjaStats = {
      totalUsers:      q('SELECT COUNT(*) as n FROM users').n,
      freeUsers:       q("SELECT COUNT(*) as n FROM users WHERE plan='free'").n,
      proUsers:        q("SELECT COUNT(*) as n FROM users WHERE plan='pro'").n,
      activeToday:     q("SELECT COUNT(*) as n FROM users WHERE date(last_active)=date('now')").n,
      activeWeek:      q("SELECT COUNT(*) as n FROM users WHERE last_active>=datetime('now','-7 days')").n,
      msgToday:        q("SELECT COALESCE(SUM(count),0) as n FROM daily_usage WHERE date=date('now')").n,
      totalTasks:      q('SELECT COUNT(*) as n FROM tasks').n,
      pendingTasks:    q('SELECT COUNT(*) as n FROM tasks WHERE completed=0').n,
      activeReminders: q('SELECT COUNT(*) as n FROM reminders WHERE active=1').n,
      totalInvoices:   q('SELECT COUNT(*) as n FROM invoices').n,
      timezones: db.prepare(`SELECT timezone, COUNT(*) as cnt FROM users GROUP BY timezone ORDER BY cnt DESC LIMIT 5`).all() as any[],
    };
    db.close();
    return stats;
  } catch { return null; }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = process.env.DASHBOARD_PORT || 3099;

function load<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')) as T;
}

function loadRunning(): RunningState | null {
  try {
    const p = path.join(ROOT, 'running.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8')) as RunningState;
  } catch { return null; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  success:       '#22c55e',
  'no-changes':  '#6366f1',
  'review-failed': '#ef4444',
  'deploy-failed': '#f59e0b',
  running:       '#38bdf8',
  error:         '#ef4444',
};
const STATUS_LABEL: Record<string, string> = {
  success:       '✅ Deployed',
  'no-changes':  '✨ No changes',
  'review-failed': '🔴 Review failed',
  'deploy-failed': '⚠️ Deploy failed',
  running:       '🔄 Running',
  error:         '💥 Error',
};
const STAGE_ICON: Record<string, string> = {
  analyze: '🔍',
  improve: '🛠',
  review:  '🔎',
  deploy:  '🚀',
  notify:  '📲',
};
const STAGE_STATUS_COLOR: Record<string, string> = {
  pending:  '#2a2a3e',
  running:  '#38bdf8',
  done:     '#22c55e',
  failed:   '#ef4444',
  skipped:  '#64748b',
};

function fmt(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function relDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ─── Pipeline row component ────────────────────────────────────────────────

function pipelineRow(pipeline: PipelineStage[], compact = false): string {
  return `<div class="pipeline${compact ? ' pipeline-compact' : ''}">` +
    pipeline.map((s, i) => {
      const col = STAGE_STATUS_COLOR[s.status];
      const isRunning = s.status === 'running';
      const dur = s.durationMs ? `<span class="stage-dur">${fmt(s.durationMs)}</span>` : '';
      const detail = s.detail && !compact ? `<div class="stage-detail">${s.detail}</div>` : '';
      return `
      <div class="stage ${isRunning ? 'stage-running' : ''}" style="--sc:${col}">
        <div class="stage-dot"></div>
        ${!compact ? `<div class="stage-name">${STAGE_ICON[s.name]} ${s.name}</div>` : ''}
        ${dur}
        ${detail}
      </div>
      ${i < pipeline.length - 1 ? `<div class="stage-arrow" style="opacity:${s.status === 'pending' ? 0.2 : 0.6}">→</div>` : ''}`;
    }).join('') +
  '</div>';
}

// ─── Week Calendar ─────────────────────────────────────────────────────────

function weekCalendar(history: HistoryEntry[], sites: WebsitesConfig['sites']): string {
  // Build last 14 days
  const days: { date: Date; iso: string; label: string }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push({
      date: d,
      iso: d.toISOString().split('T')[0],
      label: d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }),
    });
  }

  const cells = days.map(day => {
    const entry = history.find(h => h.date.startsWith(day.iso));
    if (!entry) {
      return `<div class="cal-cell cal-empty"><div class="cal-date">${day.date.getDate()}</div><div class="cal-day">${day.date.toLocaleDateString('en-GB',{weekday:'short'})}</div></div>`;
    }
    const col = STATUS_COLOR[entry.status] || '#6b7280';
    const siteShort = entry.siteName.split(' ').map((w: string) => w[0]).join('').slice(0, 3).toUpperCase();
    return `
    <div class="cal-cell" style="border-color:${col}40;background:${col}10" title="${entry.siteName} — ${STATUS_LABEL[entry.status]}">
      <div class="cal-date" style="color:${col}">${day.date.getDate()}</div>
      <div class="cal-day">${day.date.toLocaleDateString('en-GB',{weekday:'short'})}</div>
      <div class="cal-site" style="color:${col}">${siteShort}</div>
      <div class="cal-status">${entry.status === 'success' ? '✅' : entry.status === 'no-changes' ? '✨' : '❌'}</div>
    </div>`;
  }).join('');

  return `<div class="calendar">${cells}</div>`;
}

// ─── Allocation bar ─────────────────────────────────────────────────────────

function allocationBar(history: HistoryEntry[], sites: WebsitesConfig['sites']): string {
  const counts = sites.map(s => ({
    site: s,
    total: history.filter(h => h.siteId === s.id).length,
    success: history.filter(h => h.siteId === s.id && h.status === 'success').length,
  }));
  const max = Math.max(...counts.map(c => c.total), 1);
  const colors = ['#818cf8','#34d399','#f59e0b','#f472b6','#38bdf8','#a78bfa','#4ade80','#fb923c'];

  return counts.map(({ site, total, success }, i) => {
    const pct = Math.round(total / (history.length || 1) * 100);
    // Always show at least a 3px ghost bar so 0-run sites are visible
    const barW = total === 0 ? 0 : Math.max(Math.round(total / max * 100), 2);
    const col = colors[i % colors.length];
    return `
    <div class="alloc-row">
      <div class="alloc-name">${site.name}</div>
      <div class="alloc-bar-wrap">
        ${total === 0
          ? `<div class="alloc-bar-ghost"></div>`
          : `<div class="alloc-bar" style="width:${barW}%;background:${col}"></div>`
        }
      </div>
      <div class="alloc-nums">
        ${total === 0
          ? `<span style="color:#2a2a3e">0 runs</span>`
          : `<span style="color:${col}">${total}</span> runs · ${success} deployed · ${pct}%`
        }
      </div>
    </div>`;
  }).join('');
}

// ─── Compact site status table ───────────────────────────────────────────────

function siteStatusTable(history: HistoryEntry[], sites: WebsitesConfig['sites'], nextIndex: number): string {
  const rows = sites.map((site, idx) => {
    const runs = history.filter(h => h.siteId === site.id);
    const successes = runs.filter(h => h.status === 'success');
    const last = runs[0];
    const isNext = idx === nextIndex;
    const scores = runs.filter(h => h.analysisScore != null).map(h => h.analysisScore!);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const lastFailed = last ? ['error', 'review-failed', 'deploy-failed'].includes(last.status) : false;

    const statusBadge = last
      ? `<span class="badge" style="background:${STATUS_COLOR[last.status]}18;color:${STATUS_COLOR[last.status]};border:1px solid ${STATUS_COLOR[last.status]}35">${STATUS_LABEL[last.status]}</span>`
      : `<span class="badge" style="background:#1e1e3518;color:#475569;border:1px solid #1e1e35">No runs yet</span>`;

    const scoreCell = avgScore != null
      ? `<span style="color:${avgScore >= 70 ? '#22c55e' : avgScore >= 50 ? '#f59e0b' : '#ef4444'};font-weight:700">${avgScore}</span>`
      : `<span style="color:#2a2a3e">—</span>`;

    const errorSnippet = lastFailed && last?.error
      ? `<div class="site-row-err">${last.error.slice(0, 120).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
      : '';

    return `
    <tr class="${isNext ? 'row-next' : ''}${lastFailed ? ' row-failed' : ''}">
      <td>
        <div class="sr-name">${site.name}${isNext ? ' <span class="next-pill">NEXT</span>' : ''}</div>
        <a class="sr-url" href="${site.url}" target="_blank">${site.url.replace('https://','')}</a>
        ${errorSnippet}
      </td>
      <td>${statusBadge}</td>
      <td style="color:#94a3b8;font-size:.75rem">${last ? relDate(last.date) : '—'}</td>
      <td style="text-align:center">${scoreCell}</td>
      <td style="text-align:center;color:#94a3b8;font-size:.75rem">${runs.length}r · ${successes.length}d</td>
      <td>${last?.pipeline ? pipelineRow(last.pipeline, true) : '<span style="color:#2a2a3e">—</span>'}</td>
      <td>
        <button class="site-run-btn${lastFailed ? ' retry-mode' : ''}" onclick="triggerSiteRun('${site.id}',this)">${lastFailed ? '🔄' : '▶'}</button>
      </td>
    </tr>`;
  }).join('');

  return `
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Site</th><th>Last Status</th><th>When</th><th style="text-align:center">Score</th>
          <th style="text-align:center">Runs·Deploys</th><th>Pipeline</th><th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ─── History table ──────────────────────────────────────────────────────────

function screenshotThumb(dateTag: string, siteId: string): string {
  // Show before/after thumbnails if they exist (served via /screenshots/ route)
  const before = `${dateTag}-${siteId}-before.png`;
  const after  = `${dateTag}-${siteId}-after.png`;
  return `
  <div style="display:flex;gap:4px">
    <a href="/screenshots/${before}" target="_blank" title="Before">
      <img src="/screenshots/${before}" onerror="this.style.display='none'" style="width:60px;height:38px;object-fit:cover;border-radius:4px;border:1px solid #1e1e35">
    </a>
    <a href="/screenshots/${after}" target="_blank" title="After">
      <img src="/screenshots/${after}" onerror="this.style.display='none'" style="width:60px;height:38px;object-fit:cover;border-radius:4px;border:1px solid #22c55e30">
    </a>
  </div>`;
}

function historyTable(history: HistoryEntry[]): string {
  if (history.length === 0) {
    return '<div class="empty">No runs yet — first run will happen at 8 AM</div>';
  }

  const rows = history.slice(0, 10).map(h => {
    const col = STATUS_COLOR[h.status] || '#6b7280';
    const dateTag = h.date.split('T')[0];
    return `
    <tr>
      <td>
        <div>${shortDate(h.date)}</div>
        <div class="sub">${new Date(h.date).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
      </td>
      <td>
        <div class="fw6">${h.siteName}</div>
        ${h.durationMs ? `<div class="sub">${fmt(h.durationMs)}</div>` : ''}
      </td>
      <td>
        <span class="badge" style="background:${col}18;color:${col};border:1px solid ${col}35">
          ${STATUS_LABEL[h.status] || h.status}
        </span>
      </td>
      <td>${h.pipeline ? pipelineRow(h.pipeline, true) : '-'}</td>
      <td>
        ${h.analysisScore != null ? `<span style="color:${h.analysisScore>=70?'#22c55e':h.analysisScore>=50?'#f59e0b':'#ef4444'}">${h.analysisScore}/100</span>` : '-'}
        ${h.reviewScore != null ? ` → <span style="color:#818cf8">${h.reviewScore}</span>` : ''}
      </td>
      <td>
        <div>${h.improvements.slice(0, 2).map(i => `<div class="imp-line">• ${i}</div>`).join('')}</div>
      </td>
      <td>${screenshotThumb(dateTag, h.siteId)}</td>
      <td>${h.deployUrl ? `<a href="${h.deployUrl}" target="_blank" class="deploy-link">Live →</a>` : '-'}</td>
    </tr>`;
  }).join('');

  return `
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Date</th><th>Site</th><th>Status</th><th>Pipeline</th>
          <th>Score</th><th>Improvements</th><th>Screenshots</th><th>Deploy</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ─── Token status panel ──────────────────────────────────────────────────────

function tokenStatusPanel(): string {
  const tm = new TokenManager();
  const status = tm.getStatus();
  const services = Object.entries(status);

  if (services.length === 0) {
    return '<div style="color:#475569;font-size:.8rem">No multi-key rotation configured</div>';
  }

  const serviceIcons: Record<string, string> = {
    GROQ: '⚡', GEMINI: '🔷', CEREBRAS: '🧠', ANTHROPIC: '🤖',
    VERCEL: '▲', YOUTUBE: '▶️',
  };

  return `<div style="display:flex;flex-wrap:wrap;gap:10px">` +
    services.map(([svc, info]) => `
    <div style="background:#12121e;border:1px solid #1e1e35;border-radius:10px;padding:12px 16px;min-width:160px">
      <div style="font-size:.7rem;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:6px">
        ${serviceIcons[svc] || '🔑'} ${svc}
      </div>
      <div style="font-size:1rem;font-weight:700;color:#818cf8">${info.current}/${info.total}</div>
      <div style="font-size:.7rem;color:#475569;margin-top:2px">keys · active: <code style="color:#94a3b8">${info.key}</code></div>
    </div>`).join('') +
  '</div>';
}

// ─── Live run panel ─────────────────────────────────────────────────────────

function liveRunPanel(currentRun?: HistoryEntry): string {
  if (!currentRun) return '';
  const running = currentRun.pipeline.find(s => s.status === 'running');
  return `
  <div class="live-panel">
    <div class="live-header">
      <span class="live-dot"></span>
      <strong>LIVE</strong> — ${currentRun.siteName} running now
      ${running ? `<span class="live-stage">Stage: ${STAGE_ICON[running.name]} ${running.name}</span>` : ''}
    </div>
    ${pipelineRow(currentRun.pipeline)}
  </div>`;
}

// ─── NinjaPA stats panel ─────────────────────────────────────────────────────

function ninjaStatsPanel(s: NinjaStats | null): string {
  if (!s) return `<div class="ninja-unavail">🥷 NinjaPA DB not available (runs on VPS only)</div>`;
  const tzMax = s.timezones[0]?.cnt || 1;
  const tzRows = s.timezones.map(t =>
    `<div class="ninja-tz-row">
       <div class="ninja-tz-name">${t.timezone}</div>
       <div class="ninja-tz-bar"><div class="ninja-tz-fill" style="width:${Math.round(t.cnt/tzMax*100)}%"></div></div>
       <div class="ninja-tz-cnt">${t.cnt}</div>
     </div>`
  ).join('');

  return `
  <div class="ninja-section">
    <div class="ninja-kpi-grid">
      <div class="ninja-kpi"><div class="n">${s.totalUsers}</div><div class="l">Total Users</div></div>
      <div class="ninja-kpi free"><div class="n">${s.freeUsers}</div><div class="l">Free Plan</div></div>
      <div class="ninja-kpi pro"><div class="n">${s.proUsers}</div><div class="l">Pro Users</div></div>
      <div class="ninja-kpi today"><div class="n">${s.activeToday}</div><div class="l">Active Today</div></div>
      <div class="ninja-kpi week"><div class="n">${s.activeWeek}</div><div class="l">Active This Week</div></div>
      <div class="ninja-kpi msg"><div class="n">${s.msgToday}</div><div class="l">Messages Today</div></div>
      <div class="ninja-kpi task"><div class="n">${s.totalTasks}</div><div class="l">Tasks Created</div></div>
      <div class="ninja-kpi pending"><div class="n">${s.pendingTasks}</div><div class="l">Pending Tasks</div></div>
      <div class="ninja-kpi rem"><div class="n">${s.activeReminders}</div><div class="l">Active Reminders</div></div>
      <div class="ninja-kpi inv"><div class="n">${s.totalInvoices}</div><div class="l">Invoices Generated</div></div>
    </div>
    ${tzRows ? `<div class="ninja-tz-section"><div class="ninja-tz-label">Top Timezones</div>${tzRows}</div>` : ''}
  </div>`;
}

// ─── Continuous runner panel ──────────────────────────────────────────────────

function continuousRunnerPanel(running: RunningState | null, sites: WebsitesConfig['sites']): string {
  if (!running) return '';

  const isWaiting = !!running.nextCycleAt && running.completedSites === 0;
  const prog = running.totalSites > 0
    ? Math.round(running.completedSites / running.totalSites * 100)
    : 0;
  const nextLabel = running.nextCycleAt
    ? `Next cycle ${relDate(running.nextCycleAt)}`
    : '';

  const siteCards = sites.map(site => {
    const sr: SiteRunStatus = running.sites[site.id] || { status: 'pending' };
    const icon = sr.status === 'done' ? '✅' : sr.status === 'failed' ? '❌' : sr.status === 'running' ? '⟳' : '·';
    const dur = sr.durationMs ? `${(sr.durationMs / 60000).toFixed(1)}m` : '';
    return `
    <div class="cont-site cs-${sr.status}">
      <div class="cs-name" title="${site.name}">${site.name}</div>
      <div class="cs-status">
        <span class="cs-dot"></span>
        <span>${icon} ${sr.status}</span>
      </div>
      ${dur ? `<div class="cs-dur">${dur}</div>` : ''}
      ${sr.error ? `<div class="cs-dur" style="color:#ef4444" title="${sr.error.slice(0,200)}">⚠ error</div>` : ''}
    </div>`;
  }).join('');

  return `
  <div class="cont-panel">
    <div class="cont-header">
      <span class="cont-badge">♾ CONTINUOUS</span>
      <span class="cont-cycle">Cycle #${running.cycle} · ${running.completedSites}/${running.totalSites} sites done</span>
      ${nextLabel ? `<span class="cont-next">⏰ ${nextLabel}</span>` : ''}
    </div>
    <div style="background:rgba(255,255,255,.04);border-radius:6px;height:5px;margin-bottom:14px;overflow:hidden">
      <div style="height:100%;width:${prog}%;background:linear-gradient(90deg,#6366f1,#a78bfa);border-radius:6px;transition:width .4s"></div>
    </div>
    <div class="cont-sites">${siteCards}</div>
  </div>`;
}

// ─── Error aggregation panel ──────────────────────────────────────────────────

function errorAggregationPanel(history: HistoryEntry[], running: RunningState | null): string {
  // Collect recent failures from history
  const recentErrors = history.filter(h =>
    ['error', 'review-failed', 'deploy-failed'].includes(h.status)
  ).slice(0, 5);

  // Also collect any currently-failed sites from running.json
  const runningErrors: Array<{ siteId: string; siteName: string; error: string }> = [];
  if (running) {
    Object.entries(running.sites).forEach(([id, sr]) => {
      if (sr.status === 'failed' && sr.error) {
        runningErrors.push({ siteId: id, siteName: id, error: sr.error });
      }
    });
  }

  if (recentErrors.length === 0 && runningErrors.length === 0) return '';

  const runningItems = runningErrors.map(e => `
  <div class="err-item">
    <div class="err-item-header">
      <span class="err-site">⚡ ${e.siteName}</span>
      <span class="err-stage">continuous run</span>
      <span class="err-when">this cycle</span>
    </div>
    <div class="err-msg">${e.error.slice(0, 300).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <button class="err-retry" onclick="triggerSiteRun('${e.siteId}',this)">🔄 Retry</button>
  </div>`).join('');

  const histItems = recentErrors.map(h => {
    const failedStage = h.pipeline?.find(s => s.status === 'failed');
    return `
  <div class="err-item">
    <div class="err-item-header">
      <span class="err-site">${h.siteName}</span>
      ${failedStage ? `<span class="err-stage">${STAGE_ICON[failedStage.name]} ${failedStage.name}</span>` : ''}
      <span class="err-when">${relDate(h.date)}</span>
    </div>
    ${h.error ? `<div class="err-msg">${h.error.slice(0, 300).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
    <button class="err-retry" onclick="triggerSiteRun('${h.siteId}',this)">🔄 Retry</button>
  </div>`;
  }).join('');

  return `
  <div class="err-panel">
    <div class="err-panel-title">⚠ Recent Errors &amp; Failures (${recentErrors.length + runningErrors.length})</div>
    <div class="err-list">${runningItems}${histItems}</div>
  </div>`;
}

// ─── Main HTML ──────────────────────────────────────────────────────────────

function buildHTML(state: WatchdogState, config: WebsitesConfig, ninja: NinjaStats | null, running: RunningState | null): string {
  const total = state.history.length;
  const deployed = state.history.filter(h => h.status === 'success').length;
  const improvements = state.history.reduce((n, h) => n + h.improvements.length, 0);
  const nextIdx = (state.lastSiteIndex + 1) % config.sites.length;
  const nextSite = config.sites[nextIdx];
  const lastRunStr = state.lastRunDate ? relDate(state.lastRunDate) : 'Never';
  const successRate = total > 0 ? Math.round(deployed / total * 100) : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Site Watchdog — Task Dashboard</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
:root{--bg:#05050a;--bg1:#0c0c18;--bg2:#111122;--border:rgba(255,255,255,0.06);--bh:rgba(124,58,237,0.4);--text:#e2e8f0;--muted:#475569;--muted2:#2a2a3e;--violet:#7c3aed;--vl:#a78bfa;--cyan:#06b6d4;--green:#10b981;--amber:#f59e0b;--red:#ef4444;--blue:#38bdf8;--pink:#ec4899;--card:rgba(12,12,22,0.85);--gv:0 0 24px rgba(124,58,237,0.14);--gc:0 0 24px rgba(6,182,212,0.14);--gg:0 0 24px rgba(16,185,129,0.14)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;-webkit-font-smoothing:antialiased}
a{color:var(--vl);text-decoration:none}a:hover{text-decoration:underline}
.fw6{font-weight:600}.sub{font-size:.75rem;color:var(--muted);margin-top:2px}

/* Header */
.hdr{background:rgba(8,8,16,0.96);border-bottom:1px solid var(--border);padding:14px 28px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:100;backdrop-filter:blur(24px)}
.hdr-logo{font-size:1.5rem;filter:drop-shadow(0 0 8px rgba(124,58,237,0.5))}
.hdr-title{font-size:1.2rem;font-weight:800;background:linear-gradient(135deg,#a78bfa,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hdr-sub{color:var(--muted);font-size:.76rem;margin-top:1px}
.hdr-right{margin-left:auto;font-size:.74rem;color:var(--muted);display:flex;align-items:center;gap:16px}
.hdr-right strong{color:#94a3b8}

/* Layout */
.wrap{max-width:1340px;margin:0 auto;padding:24px 28px}
.sec{margin-bottom:32px}
.sec-title{font-size:.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.sec-title::before{content:'';display:inline-block;width:3px;height:13px;border-radius:2px;background:linear-gradient(135deg,var(--violet),var(--cyan))}

/* Live panel */
.live-panel{background:linear-gradient(135deg,rgba(13,26,45,0.92),rgba(10,15,26,0.92));border:1px solid rgba(56,189,248,0.25);border-radius:16px;padding:18px 22px;margin-bottom:24px;backdrop-filter:blur(16px);position:relative;overflow:hidden}
.live-panel::before{content:'';position:absolute;top:0;left:-100%;right:0;height:2px;background:linear-gradient(90deg,transparent,#38bdf8,#7c3aed,transparent);animation:scan 3s linear infinite}
@keyframes scan{to{left:100%}}
.live-header{display:flex;align-items:center;gap:10px;margin-bottom:14px;font-size:.9rem}
.live-dot{width:8px;height:8px;border-radius:50%;background:#38bdf8;box-shadow:0 0 8px #38bdf8;animation:pulse 1.2s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}
.live-stage{margin-left:auto;color:#38bdf8;font-size:.8rem}

/* KPI row */
.kpi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:28px}
.kpi-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px 20px;backdrop-filter:blur(16px);position:relative;overflow:hidden;transition:border-color .2s,box-shadow .2s,transform .2s;cursor:default}
.kpi-card::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--violet),var(--vl))}
.kpi-card:hover{border-color:var(--bh);box-shadow:var(--gv);transform:translateY(-2px)}
.kpi-card .n{font-size:2.1rem;font-weight:800;color:var(--vl);line-height:1;font-variant-numeric:tabular-nums}
.kpi-card .l{color:var(--muted);font-size:.72rem;margin-top:5px}
.kpi-card.green::after{background:linear-gradient(90deg,var(--green),#34d399)}.kpi-card.green .n{color:var(--green)}
.kpi-card.amber::after{background:linear-gradient(90deg,var(--amber),#fbbf24)}.kpi-card.amber .n{color:var(--amber)}
.kpi-card.blue::after{background:linear-gradient(90deg,var(--cyan),var(--blue))}.kpi-card.blue .n{color:var(--blue)}

/* Next up banner */
.next-banner{background:rgba(79,70,229,0.07);border:1px solid rgba(79,70,229,0.22);border-radius:14px;padding:15px 22px;display:flex;align-items:center;gap:16px;margin-bottom:28px;backdrop-filter:blur(16px)}
.next-lbl{background:rgba(79,70,229,0.18);color:#818cf8;border:1px solid rgba(79,70,229,0.38);padding:4px 12px;border-radius:20px;font-size:.67rem;font-weight:700;flex-shrink:0;letter-spacing:.06em}

/* Pipeline */
.pipeline{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pipeline-compact{gap:4px}
.stage{display:flex;flex-direction:column;align-items:center;gap:3px}
.pipeline-compact .stage{flex-direction:row;gap:4px}
.stage-dot{width:12px;height:12px;border-radius:50%;background:var(--sc);flex-shrink:0}
.pipeline-compact .stage-dot{width:8px;height:8px}
.stage-running .stage-dot{animation:pulse 1s ease-in-out infinite;box-shadow:0 0 6px var(--sc)}
.stage-name{font-size:.65rem;color:#94a3b8;white-space:nowrap}
.stage-dur{font-size:.6rem;color:var(--muted)}
.stage-detail{font-size:.6rem;color:var(--muted2);max-width:100px;text-align:center;word-break:break-word}
.stage-arrow{color:var(--muted2);font-size:.75rem;flex-shrink:0}

/* Calendar */
.calendar{display:grid;grid-template-columns:repeat(14,1fr);gap:6px}
.cal-cell{background:var(--bg1);border:1px solid var(--border);border-radius:10px;padding:8px 4px;text-align:center;min-height:72px;display:flex;flex-direction:column;align-items:center;gap:2px;transition:transform .15s}
.cal-cell:not(.cal-empty):hover{transform:translateY(-2px)}
.cal-date{font-size:1rem;font-weight:700;line-height:1}
.cal-day{font-size:.6rem;color:var(--muted)}
.cal-site{font-size:.65rem;font-weight:700;margin-top:2px}
.cal-status{font-size:.75rem}
.cal-empty .cal-date{color:var(--bg2)}.cal-empty .cal-day{color:#1a1a2e}

/* Allocation */
.alloc-row{display:grid;grid-template-columns:160px 1fr 200px;align-items:center;gap:12px;margin-bottom:8px}
.alloc-name{font-size:.8rem;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.alloc-bar-wrap{background:var(--bg1);border-radius:6px;height:8px;overflow:hidden}
.alloc-bar{height:100%;border-radius:6px;transition:width .3s}
.alloc-nums{font-size:.75rem;color:var(--muted)}
.alloc-bar-ghost{height:100%;background:repeating-linear-gradient(90deg,var(--border) 0,var(--border) 4px,transparent 4px,transparent 8px);border-radius:6px;opacity:.5}

/* Compact site status table rows */
.row-next td:first-child{border-left:2px solid rgba(99,102,241,0.6)}
.row-failed td:first-child{border-left:2px solid rgba(239,68,68,0.5)}
.sr-name{font-size:.82rem;font-weight:600;color:#e2e8f0;margin-bottom:1px}
.sr-url{font-size:.68rem;color:rgba(124,58,237,0.65)}
.next-pill{background:rgba(99,102,241,0.18);color:#818cf8;border:1px solid rgba(99,102,241,0.38);padding:1px 7px;border-radius:8px;font-size:.58rem;font-weight:700;letter-spacing:.05em;margin-left:6px;vertical-align:middle}
.site-row-err{font-size:.65rem;color:#fca5a5;margin-top:3px;font-family:'JetBrains Mono',monospace;opacity:.75;line-height:1.4;max-width:340px;word-break:break-word}
/* kept for backwards compat in error detail */
.site-error-detail{background:rgba(19,4,4,0.85);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:8px 12px;margin-top:8px;font-size:.7rem;color:var(--red);line-height:1.4;word-break:break-word}
.site-error-detail .err-label{font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#7f1d1d;margin-bottom:3px}
/* Details collapsible */
.details-toggle{background:none;border:1px solid var(--border);color:var(--muted);padding:6px 16px;border-radius:8px;font-size:.7rem;cursor:pointer;font-family:inherit;transition:border-color .2s,color .2s;margin-bottom:16px}
.details-toggle:hover{border-color:var(--bh);color:var(--vl)}
#details-section{display:none}

/* Table */
.table-wrap{background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:auto;backdrop-filter:blur(16px)}
table{width:100%;border-collapse:collapse;min-width:700px}
th{background:rgba(5,5,10,0.85);padding:12px 16px;text-align:left;font-size:.63rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid var(--border);white-space:nowrap}
td{padding:11px 16px;border-top:1px solid rgba(255,255,255,0.025);font-size:.8rem;vertical-align:middle}
tr:hover td{background:rgba(124,58,237,0.04)}
.badge{padding:4px 10px;border-radius:20px;font-size:.68rem;font-weight:600;white-space:nowrap}
.imp-line{font-size:.7rem;color:var(--muted);margin-bottom:1px}
.deploy-link{color:var(--vl);font-size:.8rem}
.empty{text-align:center;padding:48px;color:var(--muted)}
.footer-note{text-align:right;font-size:.7rem;color:var(--muted2);padding:10px 0}

/* Buttons */
.run-btn{background:linear-gradient(135deg,var(--violet),var(--vl));color:#fff;border:none;padding:9px 20px;border-radius:10px;font-size:.8rem;font-weight:700;cursor:pointer;transition:opacity .2s,box-shadow .2s;box-shadow:0 4px 15px rgba(124,58,237,0.3);font-family:inherit}
.run-btn:hover{opacity:.9;box-shadow:0 4px 25px rgba(124,58,237,0.5)}
.run-btn:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}
.run-btn.running{background:linear-gradient(135deg,#0e7490,#38bdf8);box-shadow:0 4px 15px rgba(6,182,212,0.3)}
#refresh-indicator{font-size:.7rem;color:var(--muted2);transition:color .3s}
#refresh-indicator.fresh{color:var(--green)}
.site-run-btn{background:rgba(124,58,237,0.1);color:var(--vl);border:1px solid rgba(124,58,237,0.28);padding:4px 10px;border-radius:7px;font-size:.72rem;font-weight:600;cursor:pointer;transition:all .2s;font-family:inherit}
.site-run-btn:hover{background:rgba(124,58,237,0.2);border-color:rgba(124,58,237,0.55)}
.site-run-btn:disabled{opacity:.4;cursor:not-allowed}
.site-run-btn.retry-mode{background:rgba(26,5,5,0.8);color:var(--red);border-color:rgba(239,68,68,0.3)}
.site-run-btn.retry-mode:hover{background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.6)}
.site-run-btn.quota-mode{background:rgba(26,18,0,0.8);color:var(--amber);border-color:rgba(245,158,11,0.3);cursor:not-allowed;opacity:.7}

/* Log panel */
#log-panel{background:rgba(5,5,8,0.96);border:1px solid var(--border);border-radius:16px;padding:0;overflow:hidden;display:none;backdrop-filter:blur(16px)}
#log-toolbar{background:rgba(8,8,14,0.95);padding:11px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)}
#log-file{font-size:.7rem;color:var(--muted);font-family:'JetBrains Mono',monospace}
#log-scroll{max-height:340px;overflow-y:auto;padding:14px 18px}
#log-content{font-family:'JetBrains Mono',monospace;font-size:.72rem;color:#94a3b8;white-space:pre-wrap;word-break:break-all;line-height:1.6}
.log-err{color:var(--red)}.log-ok{color:var(--green)}.log-info{color:var(--blue)}
#live-pipeline{padding:10px 16px;background:rgba(5,5,8,0.85);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-height:38px}
#live-pipeline:empty{display:none}
.lp-s{display:inline-flex;align-items:center;gap:4px;font-size:.72rem}
.lp-dot{width:9px;height:9px;border-radius:50%;background:var(--bg2);flex-shrink:0}
.lp-s.running .lp-dot{background:#38bdf8;animation:pulse 1s ease-in-out infinite;box-shadow:0 0 6px #38bdf8}
.lp-s.done .lp-dot{background:var(--green)}.lp-s.failed .lp-dot{background:var(--red)}.lp-s.skipped .lp-dot{background:var(--muted2)}
.lp-s-name{color:var(--muted)}.lp-s.running .lp-s-name{color:#38bdf8;font-weight:600}.lp-s.done .lp-s-name{color:var(--green)}.lp-s.failed .lp-s-name{color:var(--red);font-weight:600}
.lp-s-dur{color:var(--muted2);font-size:.6rem;margin-left:2px}.lp-arrow{color:var(--muted2);font-size:.7rem}
#log-error-box{display:none;background:rgba(19,4,4,0.95);border-top:2px solid rgba(239,68,68,0.35);padding:12px 18px;font-size:.75rem;color:var(--red);line-height:1.5}
#log-error-box .err-hdr{font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#7f1d1d;margin-bottom:4px}
.site-error-detail{background:rgba(19,4,4,0.85);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:8px 12px;margin-top:8px;font-size:.7rem;color:var(--red);line-height:1.4;word-break:break-word}
.site-error-detail .err-label{font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#7f1d1d;margin-bottom:3px}

/* NinjaPA stats */
.ninja-section{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}
.ninja-kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;flex:1;min-width:600px}
.ninja-kpi{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px 18px;backdrop-filter:blur(16px);position:relative;overflow:hidden;transition:border-color .2s,box-shadow .2s,transform .2s;cursor:default}
.ninja-kpi::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--violet),var(--pink))}
.ninja-kpi:hover{border-color:rgba(236,72,153,0.35);box-shadow:0 0 24px rgba(236,72,153,0.1);transform:translateY(-2px)}
.ninja-kpi .n{font-size:1.8rem;font-weight:800;background:linear-gradient(135deg,var(--vl),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1;font-variant-numeric:tabular-nums}
.ninja-kpi .l{color:var(--muted);font-size:.7rem;margin-top:5px}
.ninja-kpi.pro::after{background:linear-gradient(90deg,var(--amber),#fbbf24)}.ninja-kpi.pro .n{background:linear-gradient(135deg,var(--amber),#fbbf24);-webkit-background-clip:text;background-clip:text}
.ninja-kpi.today::after,.ninja-kpi.week::after{background:linear-gradient(90deg,var(--green),#34d399)}.ninja-kpi.today .n,.ninja-kpi.week .n{background:linear-gradient(135deg,var(--green),#34d399);-webkit-background-clip:text;background-clip:text}
.ninja-kpi.msg::after{background:linear-gradient(90deg,var(--cyan),var(--blue))}.ninja-kpi.msg .n{background:linear-gradient(135deg,var(--cyan),var(--blue));-webkit-background-clip:text;background-clip:text}
.ninja-tz-section{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px 20px;backdrop-filter:blur(16px);min-width:220px;max-width:260px}
.ninja-tz-label{font-size:.65rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px}
.ninja-tz-row{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.ninja-tz-name{font-size:.7rem;color:#94a3b8;min-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ninja-tz-bar{flex:1;height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden}
.ninja-tz-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--violet),var(--pink))}
.ninja-tz-cnt{font-size:.7rem;color:var(--muted);min-width:16px;text-align:right}
.ninja-unavail{color:var(--muted);font-size:.8rem;padding:20px;background:var(--bg1);border-radius:12px;border:1px solid var(--border)}

/* Continuous runner panel */
.cont-panel{background:linear-gradient(135deg,rgba(5,10,22,0.95),rgba(8,8,18,0.95));border:1px solid rgba(99,102,241,0.28);border-radius:16px;padding:18px 22px;margin-bottom:24px;backdrop-filter:blur(16px);position:relative;overflow:hidden}
.cont-panel::before{content:'';position:absolute;top:0;left:-100%;right:0;height:2px;background:linear-gradient(90deg,transparent,#6366f1,#a78bfa,transparent);animation:scan 4s linear infinite}
.cont-header{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.cont-badge{background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.4);color:#818cf8;border-radius:20px;padding:3px 12px;font-size:.65rem;font-weight:700;letter-spacing:.06em}
.cont-cycle{font-size:.8rem;color:var(--muted)}
.cont-next{margin-left:auto;font-size:.73rem;color:#6366f1}
.cont-sites{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.cont-site{background:rgba(5,5,12,0.7);border:1px solid var(--border);border-radius:10px;padding:10px 12px;transition:border-color .2s}
.cont-site.cs-running{border-color:rgba(56,189,248,0.4);background:rgba(6,24,45,0.7)}
.cont-site.cs-done{border-color:rgba(16,185,129,0.3)}
.cont-site.cs-failed{border-color:rgba(239,68,68,0.3);background:rgba(19,4,4,0.5)}
.cont-site.cs-pending{opacity:.5}
.cs-name{font-size:.72rem;font-weight:600;color:#94a3b8;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cs-status{font-size:.68rem;display:flex;align-items:center;gap:5px}
.cs-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.cs-running .cs-dot{background:#38bdf8;animation:pulse 1s ease-in-out infinite;box-shadow:0 0 5px #38bdf8}
.cs-done .cs-dot{background:#10b981}
.cs-failed .cs-dot{background:#ef4444}
.cs-pending .cs-dot{background:var(--muted2)}
.cs-dur{font-size:.63rem;color:var(--muted2);margin-top:3px}

/* Error aggregation panel */
.err-panel{background:rgba(19,4,4,0.75);border:1px solid rgba(239,68,68,0.22);border-radius:16px;padding:18px 22px;margin-bottom:24px;backdrop-filter:blur(16px)}
.err-panel-title{font-size:.7rem;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px;display:flex;align-items:center;gap:6px}
.err-list{display:flex;flex-direction:column;gap:10px}
.err-item{background:rgba(10,2,2,0.7);border:1px solid rgba(239,68,68,0.15);border-radius:10px;padding:12px 16px}
.err-item-header{display:flex;align-items:center;gap:10px;margin-bottom:5px}
.err-site{font-weight:700;font-size:.8rem;color:#fca5a5}
.err-when{font-size:.68rem;color:#7f1d1d;margin-left:auto}
.err-stage{font-size:.7rem;background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.2);padding:2px 8px;border-radius:6px}
.err-msg{font-size:.72rem;color:#fca5a5;line-height:1.5;font-family:'JetBrains Mono',monospace;word-break:break-word;opacity:.85}
.err-retry{background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.25);padding:4px 12px;border-radius:7px;font-size:.7rem;font-weight:600;cursor:pointer;font-family:inherit;margin-top:8px;transition:all .2s}
.err-retry:hover{background:rgba(239,68,68,0.2)}
</style>
</head>
<body>

<div class="hdr">
  <span class="hdr-logo">🐾</span>
  <div>
    <div class="hdr-title">Site Watchdog</div>
    <div class="hdr-sub">Autonomous AI improvement agent · ${running ? '♾ continuous all-sites mode' : '1 site/day rotation'}</div>
  </div>
  <div class="hdr-right">
    <div style="text-align:right">
      <div>Last run: <strong>${lastRunStr}</strong></div>
      <div id="refresh-indicator">Refreshed just now</div>
    </div>
    <button class="run-btn" id="run-btn" onclick="triggerRun()">▶ Run Now</button>
  </div>
</div>

<div class="wrap">

  ${continuousRunnerPanel(running, config.sites)}

  ${liveRunPanel(state.currentRun)}

  ${errorAggregationPanel(state.history, running)}

  <!-- KPIs — compact single row -->
  <div class="kpi-row">
    <div class="kpi-card"><div class="n">${config.sites.length}</div><div class="l">Sites</div></div>
    <div class="kpi-card blue"><div class="n">${total}</div><div class="l">Total runs</div></div>
    <div class="kpi-card green"><div class="n">${deployed}</div><div class="l">Deployed</div></div>
    <div class="kpi-card amber"><div class="n">${improvements}</div><div class="l">Improvements</div></div>
    <div class="kpi-card"><div class="n">${successRate}%</div><div class="l">Success rate</div></div>
  </div>

  <!-- Site status table (main view) -->
  <div class="sec">
    <div class="sec-title" style="justify-content:space-between">
      <span>Sites</span>
      <span style="color:#475569;font-size:.7rem">Next: <strong style="color:#818cf8">${nextSite.name}</strong></span>
    </div>
    ${siteStatusTable(state.history, config.sites, nextIdx)}
  </div>

  <!-- Live log panel -->
  <div class="sec" id="log-section">
    <div class="sec-title">Live Run Log</div>
    <div id="log-panel">
      <div id="log-toolbar">
        <span style="width:8px;height:8px;border-radius:50%;background:#38bdf8;display:inline-block;animation:pulse 1.2s ease-in-out infinite" id="log-pulse"></span>
        <span style="font-size:.8rem;font-weight:600" id="log-title">Live output</span>
        <span id="log-file" style="margin-left:auto"></span>
        <button onclick="closeLogPanel()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:.8rem;padding:2px 6px">✕ Close</button>
      </div>
      <div id="live-pipeline"></div>
      <div id="log-scroll"><pre id="log-content">Waiting for output…</pre></div>
      <div id="log-error-box"><div class="err-hdr">💥 Error</div><span id="log-error-msg"></span></div>
    </div>
  </div>

  <!-- Recent history (10 rows) -->
  <div class="sec">
    <div class="sec-title">Recent Runs</div>
    ${historyTable(state.history)}
  </div>

  <!-- Expandable details (NinjaPA, calendar, allocation, tokens) -->
  <div class="sec">
    <button class="details-toggle" onclick="toggleDetails(this)">▼ Show Details (NinjaPA stats · calendar · allocation · API tokens)</button>
    <div id="details-section">
      <div class="sec-title" style="margin-top:8px">🥷 NinjaPA Bot — Subscriber Stats</div>
      ${ninjaStatsPanel(ninja)}

      <div class="sec-title" style="margin-top:24px">14-Day Task Calendar</div>
      ${weekCalendar(state.history, config.sites)}

      <div class="sec-title" style="margin-top:24px">Site Allocation</div>
      ${allocationBar(state.history, config.sites)}

      <div class="sec-title" style="margin-top:24px">API Token Status</div>
      ${tokenStatusPanel()}
    </div>
  </div>

  <div class="footer-note">Site Watchdog · VPS 31.97.56.148 · Auto-refresh 10s</div>
</div>

<script>
// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtMs(ms) {
  if (!ms) return '';
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  return Math.floor(ms / 60000) + 'm ' + Math.floor((ms % 60000) / 1000) + 's';
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Live refresh every 10s ────────────────────────────────────────────────
let lastRefresh = Date.now();

function updateRefreshIndicator() {
  const el = document.getElementById('refresh-indicator');
  if (!el) return;
  const sec = Math.round((Date.now() - lastRefresh) / 1000);
  if (sec < 5) {
    el.textContent = 'Refreshed just now';
    el.classList.add('fresh');
    setTimeout(() => el.classList.remove('fresh'), 2000);
  } else {
    el.textContent = sec + 's ago';
    el.classList.remove('fresh');
  }
}

async function refreshDashboard() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return;
    lastRefresh = Date.now();
    window.location.reload();
  } catch {}
}

setInterval(updateRefreshIndicator, 1000);
setInterval(refreshDashboard, 10000);

// ── Log polling ─────────────────────────────────────────────────────────────
let logPollTimer = null;
const LP_ICONS = { analyze:'🔍', improve:'🛠', review:'🔎', deploy:'🚀', notify:'📲' };

function coloriseLine(line) {
  if (!line.trim()) return line;
  const safe = esc(line);
  if (/error|fail|💥|✗/i.test(line)) return '<span class="log-err">' + safe + '</span>';
  if (/done|success|✅|deployed|✓/i.test(line)) return '<span class="log-ok">' + safe + '</span>';
  if (/\\[|📌|📸|🔍|🛠|🔎|🚀|📲|▶/i.test(line)) return '<span class="log-info">' + safe + '</span>';
  return safe;
}

function updateLivePipeline(pipeline, error, running, siteName) {
  const el = document.getElementById('live-pipeline');
  const errBox = document.getElementById('log-error-box');
  const errMsg = document.getElementById('log-error-msg');
  const titleEl = document.getElementById('log-title');
  const pulse = document.getElementById('log-pulse');

  if (titleEl && siteName) titleEl.textContent = running ? ('⟳ ' + siteName + ' — running') : siteName + ' — completed';
  if (pulse) pulse.style.background = running ? '#38bdf8' : (error ? '#ef4444' : '#22c55e');

  if (el && pipeline && pipeline.length) {
    el.innerHTML = pipeline.map((s, i) => {
      const dur = s.durationMs ? '<span class="lp-s-dur">(' + fmtMs(s.durationMs) + ')</span>' : '';
      const arrow = i < pipeline.length - 1 ? '<span class="lp-arrow">→</span>' : '';
      return '<span class="lp-s ' + s.status + '">' +
        '<span class="lp-dot"></span>' +
        '<span class="lp-s-name">' + (LP_ICONS[s.name] || '') + ' ' + esc(s.name) + '</span>' +
        (s.detail ? '<span class="lp-s-dur"> — ' + esc(s.detail) + '</span>' : '') +
        dur + '</span>' + arrow;
    }).join('');
  }

  if (error && errBox && errMsg) {
    errMsg.textContent = error;
    errBox.style.display = 'block';
  } else if (errBox) {
    errBox.style.display = 'none';
  }
}

async function refreshLog() {
  try {
    const [logRes, statusRes] = await Promise.all([
      fetch('/api/logs'),
      fetch('/api/run-status'),
    ]);
    if (logRes.ok) {
      const data = await logRes.json();
      if (data.lines && data.lines.length > 0) {
        const pre = document.getElementById('log-content');
        const fileEl = document.getElementById('log-file');
        if (pre) pre.innerHTML = data.lines.map(coloriseLine).join('\\n');
        if (fileEl) fileEl.textContent = data.file || '';
        const scroll = document.getElementById('log-scroll');
        if (scroll) scroll.scrollTop = scroll.scrollHeight;
      }
    }
    if (statusRes.ok) {
      const st = await statusRes.json();
      updateLivePipeline(st.pipeline, st.error, st.running, st.siteName);
      // Speed up dashboard refresh when run is active
      if (!st.running && window._fastRefreshTimer) {
        clearInterval(window._fastRefreshTimer);
        window._fastRefreshTimer = null;
      }
    }
  } catch {}
}

function showLogPanel() {
  const section = document.getElementById('log-section');
  const panel = document.getElementById('log-panel');
  if (section) section.style.display = 'block';
  if (panel) { panel.style.display = 'block'; panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  sessionStorage.setItem('logPanelOpen', '1');
  refreshLog();
  if (!logPollTimer) logPollTimer = setInterval(refreshLog, 2500);
}

function closeLogPanel() {
  const section = document.getElementById('log-section');
  const panel = document.getElementById('log-panel');
  if (section) section.style.display = 'none';
  if (panel) panel.style.display = 'none';
  sessionStorage.removeItem('logPanelOpen');
  if (logPollTimer) { clearInterval(logPollTimer); logPollTimer = null; }
}

// ── Run Now (next rotation) ─────────────────────────────────────────────────
async function triggerRun() {
  const btn = document.getElementById('run-btn');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = '⏳ Starting...';
  btn.classList.add('running');
  try {
    const res = await fetch('/api/run', { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      btn.textContent = '✅ Started!';
      showLogPanel();
    } else {
      btn.textContent = '⚠️ ' + (data.error || 'Failed');
      btn.disabled = false;
      btn.classList.remove('running');
      setTimeout(() => { btn.textContent = '▶ Run Now'; }, 4000);
    }
  } catch {
    btn.textContent = '▶ Run Now';
    btn.disabled = false;
    btn.classList.remove('running');
  }
}

// ── Ad-hoc per-site run ─────────────────────────────────────────────────────
async function triggerSiteRun(siteId, btn) {
  if (!btn || btn.disabled) return;
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳…';
  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId }),
    });
    const data = await res.json();
    if (data.ok) {
      btn.textContent = '✅ Started';
      showLogPanel();
    } else {
      btn.textContent = '⚠️ ' + (data.error || 'Failed').slice(0, 25);
      btn.disabled = false;
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 5000);
    }
  } catch {
    btn.textContent = orig;
    btn.disabled = false;
  }
}

// ── Details toggle ──────────────────────────────────────────────────────────
function toggleDetails(btn) {
  const el = document.getElementById('details-section');
  if (!el) return;
  const open = el.style.display === 'block';
  el.style.display = open ? 'none' : 'block';
  btn.textContent = open
    ? '▼ Show Details (NinjaPA stats · calendar · allocation · API tokens)'
    : '▲ Hide Details';
}

// ── Init ────────────────────────────────────────────────────────────────────
(function() {
  const runActive = ${state.currentRun ? 'true' : 'false'};
  if (runActive || sessionStorage.getItem('logPanelOpen')) {
    showLogPanel();
  }
})();
</script>
</body>
</html>`;
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); res.end('ok'); return; }

  // ── POST /api/run — trigger a manual watchdog run (optional siteId for ad-hoc) ──
  if (req.method === 'POST' && req.url === '/api/run') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const siteId: string | undefined = parsed.siteId;
        const state = load<WatchdogState>('state.json');
        if (state.currentRun) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'A run is already in progress' }));
          return;
        }
        const env: NodeJS.ProcessEnv = { ...process.env };
        if (siteId) env.FORCE_SITE_ID = siteId;
        const child = spawn('npm', ['start'], {
          cwd: ROOT, detached: true, stdio: 'ignore', env,
        });
        child.unref();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, siteId: siteId || null }));
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // ── GET /api/logs — return tail of the latest log file ─────────────────
  if (req.url === '/api/logs') {
    try {
      const logDir = process.env.LOG_DIR || path.join(ROOT, 'logs');
      if (!fs.existsSync(logDir)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ file: null, lines: [] }));
        return;
      }
      const files = fs.readdirSync(logDir)
        .filter(f => f.endsWith('.log'))
        .map(f => ({ f, mtime: fs.statSync(path.join(logDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)  // newest first by actual write time
        .map(o => o.f);
      if (files.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ file: null, lines: [] }));
        return;
      }
      const content = fs.readFileSync(path.join(logDir, files[0]), 'utf8');
      const lines = content.split('\n').filter(Boolean).slice(-120);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ file: files[0], lines }));
    } catch (e: any) {
      res.writeHead(500); res.end(e.message);
    }
    return;
  }

  // ── GET /api/run-status — lightweight status for live pipeline polling ──
  if (req.url === '/api/run-status') {
    try {
      const s = load<WatchdogState>('state.json');
      const active = s.currentRun;
      const last = s.history[0];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        running: !!active,
        siteName: active?.siteName || last?.siteName || null,
        pipeline: active?.pipeline || last?.pipeline || [],
        status: active?.status || last?.status || null,
        error: active?.error || (last && ['error','review-failed','deploy-failed'].includes(last.status) ? last.error : null) || null,
      }));
    } catch (e: any) {
      res.writeHead(500); res.end(e.message);
    }
    return;
  }

  if (req.url === '/api/state') {
    try {
      const state = load<WatchdogState>('state.json');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(state));
    } catch (e: any) {
      res.writeHead(500); res.end(e.message);
    }
    return;
  }

  // Serve screenshot images
  if (req.url?.startsWith('/screenshots/')) {
    const filename = req.url.replace('/screenshots/', '');
    const ssPath = path.join(ROOT, 'logs', 'screenshots', filename);
    if (fs.existsSync(ssPath)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      fs.createReadStream(ssPath).pipe(res);
    } else {
      res.writeHead(404); res.end('Not found');
    }
    return;
  }

  // GET /api/ninjapa-stats
  if (req.url === '/api/ninjapa-stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getNinjaPAStats() ?? {}));
    return;
  }

  // GET /api/running-state — continuous runner status
  if (req.url === '/api/running-state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadRunning() ?? null));
    return;
  }

  try {
    const state = load<WatchdogState>('state.json');
    const config = load<WebsitesConfig>('websites.config.json');
    const ninja = getNinjaPAStats();
    const running = loadRunning();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(buildHTML(state, config, ninja, running));
  } catch (e: any) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Dashboard error: ' + e.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n🐾 Dashboard → http://localhost:${PORT}`);
  console.log(`              http://31.97.56.148:${PORT}\n`);
});
