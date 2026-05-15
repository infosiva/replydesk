/**
 * Monetization Agent Dashboard — port 3102
 * Shows all monetization plans with revenue estimates per site.
 */
import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { AgentState, SiteMonetizationPlan } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = process.env.MON_DASHBOARD_PORT || 3102;

function loadState(): AgentState {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
  } catch { return { lastRunAt: null, totalRuns: 0, history: [] }; }
}

function loadLatestPlans(): SiteMonetizationPlan[] | null {
  const dir = path.join(ROOT, 'reports');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse();
  if (!files.length) return null;
  try {
    const data = JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf8'));
    return data.plans as SiteMonetizationPlan[];
  } catch { return null; }
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

const TYPE_EMOJI: Record<string, string> = {
  ads: '📢', affiliate: '🔗', saas: '💳', oneTime: '💰',
  subscription: '♻️', lead: '📧', sponsorship: '🤝',
};
const EFFORT_COLOR: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#ef4444',
};

function buildHTML(state: AgentState, plans: SiteMonetizationPlan[] | null): string {
  const totalLow = plans ? plans.reduce((s, p) => s + p.totalPotentialMonthlyUSD[0], 0) : 0;
  const totalHigh = plans ? plans.reduce((s, p) => s + p.totalPotentialMonthlyUSD[1], 0) : 0;
  const lastRun = state.lastRunAt ? relDate(state.lastRunAt) : 'Never';

  const siteCards = plans ? plans.map(p => {
    const streams = p.streams.map(s => `
      <div class="stream">
        <div class="stream-header">
          <span class="stream-name">${TYPE_EMOJI[s.type] || '💡'} ${s.name}</span>
          <span class="stream-est">$${s.estimatedMonthlyUSD[0]}–$${s.estimatedMonthlyUSD[1]}/mo</span>
          <span class="stream-effort" style="color:${EFFORT_COLOR[s.effort]}">${s.effort}</span>
          <span class="stream-ttl">${s.timeToRevenue}</span>
        </div>
        <ul class="how-to">${s.howTo.map(h => `<li>${h}</li>`).join('')}</ul>
      </div>`).join('');

    const wins = p.quickWins.map(w => `<li>${w}</li>`).join('');

    return `
    <div class="site-card">
      <div class="card-header">
        <div>
          <div class="card-name">${p.siteName}</div>
          <a class="card-url" href="${p.url}" target="_blank">${p.url.replace('https://','')}</a>
        </div>
        <div class="card-pot">
          <div class="pot-num">$${p.totalPotentialMonthlyUSD[0]}–$${p.totalPotentialMonthlyUSD[1]}</div>
          <div class="pot-label">potential/mo</div>
        </div>
      </div>
      <div class="card-current">Current: <span>${p.currentMonetization}</span></div>
      <div class="sec-label">Revenue Streams</div>
      <div class="streams">${streams}</div>
      <div class="sec-label">Quick Wins (this week)</div>
      <ul class="quick-wins">${wins}</ul>
      <div class="goals">
        <div class="goal"><span class="goal-label">30d</span> ${p.thirtyDayGoal}</div>
        <div class="goal"><span class="goal-label">90d</span> ${p.ninetyDayGoal}</div>
        <div class="goal risk"><span class="goal-label">Risk</span> ${p.keyRisk}</div>
      </div>
    </div>`;
  }).join('') : '<div class="empty">No report yet — click ▶ Run Now to generate your monetization roadmap.</div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Monetization Agent</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#05050a;color:#e2e8f0;min-height:100vh;-webkit-font-smoothing:antialiased}
a{color:#a78bfa;text-decoration:none}a:hover{text-decoration:underline}

.hdr{background:rgba(8,8,16,0.96);border-bottom:1px solid rgba(255,255,255,0.06);padding:14px 28px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:100;backdrop-filter:blur(24px)}
.hdr-logo{font-size:1.5rem}
.hdr-title{font-size:1.2rem;font-weight:800;background:linear-gradient(135deg,#a78bfa,#34d399);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hdr-sub{color:#475569;font-size:.76rem;margin-top:1px}
.hdr-right{margin-left:auto;display:flex;align-items:center;gap:16px;font-size:.74rem;color:#475569}
.hdr-right strong{color:#94a3b8}

.wrap{max-width:1200px;margin:0 auto;padding:24px 28px}

.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:32px}
.kpi{background:rgba(12,12,22,0.85);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:18px 20px;position:relative;overflow:hidden}
.kpi::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#7c3aed,#a78bfa)}
.kpi.green::after{background:linear-gradient(90deg,#10b981,#34d399)}
.kpi.amber::after{background:linear-gradient(90deg,#f59e0b,#fbbf24)}
.kpi.blue::after{background:linear-gradient(90deg,#06b6d4,#38bdf8)}
.kpi .n{font-size:2rem;font-weight:800;color:#a78bfa;line-height:1}
.kpi.green .n{color:#10b981}.kpi.amber .n{color:#f59e0b}.kpi.blue .n{color:#38bdf8}
.kpi .l{color:#475569;font-size:.72rem;margin-top:5px}

.run-btn{background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;border:none;padding:9px 20px;border-radius:10px;font-size:.8rem;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .2s}
.run-btn:hover{opacity:.9}.run-btn:disabled{opacity:.4;cursor:not-allowed}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(520px,1fr));gap:20px}
.site-card{background:rgba(12,12,22,0.85);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:22px;backdrop-filter:blur(16px)}
.card-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
.card-name{font-size:1rem;font-weight:700}
.card-url{font-size:.7rem;color:rgba(124,58,237,0.7);display:block;margin-top:2px}
.card-pot{text-align:right}
.pot-num{font-size:1.4rem;font-weight:800;color:#34d399;line-height:1}
.pot-label{font-size:.63rem;color:#475569;margin-top:2px}
.card-current{font-size:.72rem;color:#475569;margin-bottom:14px}
.card-current span{color:#94a3b8}
.sec-label{font-size:.62rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;margin-top:14px}

.streams{display:flex;flex-direction:column;gap:8px}
.stream{background:rgba(5,5,10,0.7);border:1px solid rgba(255,255,255,0.04);border-radius:10px;padding:10px 14px}
.stream-header{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}
.stream-name{font-size:.8rem;font-weight:600;flex:1}
.stream-est{font-size:.75rem;color:#34d399;font-weight:700}
.stream-effort{font-size:.65rem;font-weight:600;text-transform:uppercase}
.stream-ttl{font-size:.65rem;color:#475569;margin-left:auto}
.how-to{list-style:none;padding:0}
.how-to li{font-size:.7rem;color:#64748b;padding:1px 0}
.how-to li::before{content:'→ ';color:#7c3aed}

.quick-wins{list-style:none;padding:0;display:flex;flex-direction:column;gap:4px}
.quick-wins li{font-size:.75rem;color:#94a3b8;padding:6px 10px;background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.12);border-radius:8px}
.quick-wins li::before{content:'✅ ';font-size:.7rem}

.goals{display:flex;flex-direction:column;gap:6px;margin-top:14px}
.goal{font-size:.72rem;color:#64748b;display:flex;gap:8px;align-items:flex-start}
.goal-label{background:rgba(124,58,237,0.15);color:#a78bfa;border:1px solid rgba(124,58,237,0.25);padding:2px 8px;border-radius:6px;font-size:.62rem;font-weight:700;flex-shrink:0}
.goal.risk .goal-label{background:rgba(239,68,68,0.1);color:#ef4444;border-color:rgba(239,68,68,0.25)}
.goal.risk{color:#fca5a5}

.empty{text-align:center;padding:80px;color:#475569;font-size:.9rem;border:1px dashed rgba(255,255,255,0.06);border-radius:16px}

#log-panel{display:none;background:rgba(5,5,8,0.96);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:16px 20px;margin-top:24px;font-family:monospace;font-size:.75rem;color:#94a3b8;white-space:pre-wrap;max-height:300px;overflow-y:auto}
.footer{text-align:right;font-size:.7rem;color:#1e1e35;padding:16px 0}
</style>
</head>
<body>
<div class="hdr">
  <span class="hdr-logo">💰</span>
  <div>
    <div class="hdr-title">Monetization Agent</div>
    <div class="hdr-sub">AI-powered revenue roadmap for all live products</div>
  </div>
  <div class="hdr-right">
    <div>Last run: <strong>${lastRun}</strong> · Total runs: <strong>${state.totalRuns}</strong></div>
    <button class="run-btn" id="run-btn" onclick="triggerRun()">▶ Run Now</button>
  </div>
</div>

<div class="wrap">
  <div class="kpi-row">
    <div class="kpi"><div class="n">${plans?.length ?? 0}</div><div class="l">Sites analysed</div></div>
    <div class="kpi green"><div class="n">$${totalLow}</div><div class="l">Portfolio potential low/mo</div></div>
    <div class="kpi amber"><div class="n">$${totalHigh}</div><div class="l">Portfolio potential high/mo</div></div>
    <div class="kpi blue"><div class="n">${state.totalRuns}</div><div class="l">Agent runs</div></div>
  </div>

  <div class="grid">${siteCards}</div>

  <div id="log-panel"></div>
  <div class="footer">Monetization Agent · VPS 31.97.56.148:3102 · Auto-refresh 30s</div>
</div>

<script>
async function triggerRun() {
  const btn = document.getElementById('run-btn');
  btn.disabled = true; btn.textContent = '⏳ Running...';
  const log = document.getElementById('log-panel');
  log.style.display = 'block'; log.textContent = 'Starting monetization analysis for all sites...\n';
  try {
    const res = await fetch('/api/run', { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      log.textContent += 'Agent started. This takes 2-3 minutes. Page will refresh when done.\n';
      pollStatus();
    } else {
      log.textContent += 'Error: ' + (data.error || 'Unknown'); btn.disabled = false; btn.textContent = '▶ Run Now';
    }
  } catch(e) { log.textContent += 'Error: ' + e.message; btn.disabled = false; btn.textContent = '▶ Run Now'; }
}

function pollStatus() {
  let dots = 0;
  const log = document.getElementById('log-panel');
  const t = setInterval(async () => {
    dots++;
    if (log) log.textContent = 'Analysing sites' + '.'.repeat(dots % 4) + '\n(This takes 2–3 minutes)\n';
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const s = await res.json();
        if (s.totalRuns > ${state.totalRuns}) { clearInterval(t); window.location.reload(); }
      }
    } catch {}
    if (dots > 200) { clearInterval(t); window.location.reload(); }
  }, 2000);
}

setInterval(() => { fetch('/api/state').then(r => r.json()).then(s => { if (s.totalRuns > ${state.totalRuns}) window.location.reload(); }).catch(() => {}); }, 30000);
</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); res.end('ok'); return; }

  if (req.method === 'POST' && req.url === '/api/run') {
    const state = loadState();
    const child = spawn('npm', ['start'], { cwd: ROOT, detached: true, stdio: 'ignore' });
    child.unref();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.url === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadState()));
    return;
  }

  const state = loadState();
  const plans = loadLatestPlans();
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(buildHTML(state, plans));
});

server.listen(PORT, () => {
  console.log(`\n💰 Monetization Dashboard → http://localhost:${PORT}`);
  console.log(`                            http://31.97.56.148:${PORT}\n`);
});
