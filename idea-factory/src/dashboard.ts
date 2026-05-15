/**
 * Idea Factory Dashboard — port 3101
 * Shows run history, latest ideas, pipeline status.
 * Run: npm run dashboard (kept alive by PM2)
 */
import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FactoryState } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const IDEAS_DIR = path.join(ROOT, 'ideas');
const PORT = Number(process.env.DASHBOARD_PORT) || 3101;

function loadState(): FactoryState {
  const f = path.join(ROOT, 'state.json');
  if (!fs.existsSync(f)) return { lastRunAt: null, totalRuns: 0, totalIdeasGenerated: 0, history: [] };
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function loadLatestIdeas(): string {
  if (!fs.existsSync(IDEAS_DIR)) return '<p>No ideas generated yet.</p>';
  const files = fs.readdirSync(IDEAS_DIR)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse()
    .slice(0, 1);
  if (files.length === 0) return '<p>No ideas generated yet.</p>';
  const content = fs.readFileSync(path.join(IDEAS_DIR, files[0]), 'utf8');
  // Simple markdown → HTML (headings, bold, lists)
  return content
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$1. $2</li>')
    .replace(/\n\n/g, '<br><br>');
}

function stageIcon(s: string) {
  if (s === 'done') return '✅';
  if (s === 'running') return '⏳';
  if (s === 'failed') return '❌';
  return '⬜';
}

function renderHtml(state: FactoryState): string {
  const latest = state.history[0];
  const currentRun = state.currentRun;
  const ideasHtml = loadLatestIdeas();

  const historyRows = state.history.slice(0, 20).map(run => `
    <tr>
      <td>${run.startedAt.split('T')[0]}</td>
      <td>${run.niches.join(', ')}</td>
      <td class="status-${run.status}">${run.status}</td>
      <td>${run.ideasFound}</td>
      <td>${run.ideasBuilt}</td>
      <td>${run.outputFile ? `<a href="/ideas/${run.outputFile}.md">view</a>` : '—'}</td>
    </tr>`).join('');

  const pipelineHtml = (currentRun || latest) ? (() => {
    const r = currentRun || latest!;
    return `
      <div class="pipeline">
        <span>${stageIcon(r.pipeline.ceo)} CEO</span>
        <span>→</span>
        <span>${stageIcon(r.pipeline.research)} Research</span>
        <span>→</span>
        <span>${stageIcon(r.pipeline.validate)} Validate</span>
        <span>→</span>
        <span>${stageIcon(r.pipeline.scope)} Scope</span>
        <span>→</span>
        <span>${stageIcon(r.pipeline.report)} Report</span>
      </div>
      ${currentRun ? '<div class="live-badge">🔴 LIVE RUN IN PROGRESS</div>' : ''}`;
  })() : '<p>No runs yet.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Idea Factory Dashboard</title>
  <meta http-equiv="refresh" content="30">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0f0f0f; color: #e0e0e0; padding: 24px; }
    h1 { font-size: 1.8rem; margin-bottom: 4px; }
    h2 { font-size: 1.2rem; margin: 24px 0 12px; color: #aaa; text-transform: uppercase; letter-spacing: 1px; }
    h3 { font-size: 1rem; margin: 16px 0 8px; color: #fff; }
    .subtitle { color: #666; margin-bottom: 24px; font-size: 0.9rem; }
    .stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .stat { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 16px 24px; min-width: 140px; }
    .stat .val { font-size: 2rem; font-weight: bold; color: #4ade80; }
    .stat .lbl { font-size: 0.8rem; color: #666; margin-top: 4px; }
    .pipeline { display: flex; align-items: center; gap: 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 16px; font-size: 1rem; flex-wrap: wrap; }
    .live-badge { display: inline-block; background: #dc2626; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; margin-top: 12px; animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    table { width: 100%; border-collapse: collapse; background: #1a1a1a; border-radius: 8px; overflow: hidden; }
    th { text-align: left; padding: 12px 16px; background: #222; color: #888; font-size: 0.8rem; text-transform: uppercase; }
    td { padding: 12px 16px; border-top: 1px solid #2a2a2a; font-size: 0.9rem; }
    td a { color: #60a5fa; text-decoration: none; }
    .status-completed { color: #4ade80; }
    .status-error { color: #f87171; }
    .status-running { color: #fbbf24; }
    .ideas-content { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 24px; line-height: 1.7; max-height: 600px; overflow-y: auto; }
    .ideas-content h1 { font-size: 1.3rem; margin: 16px 0 8px; color: #4ade80; }
    .ideas-content h2 { font-size: 1.1rem; margin: 16px 0 8px; color: #60a5fa; text-transform: none; letter-spacing: 0; }
    .ideas-content h3 { font-size: 1rem; margin: 12px 0 6px; }
    .ideas-content li { margin-left: 20px; margin-top: 4px; }
    .footer { margin-top: 32px; color: #444; font-size: 0.8rem; text-align: center; }
    form { margin-top: 16px; }
    button { background: #16a34a; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
    button:hover { background: #15803d; }
  </style>
</head>
<body>
  <h1>🏭 Idea Factory</h1>
  <p class="subtitle">Autonomous AI idea research • Runs weekly • Powered by Groq → Gemini → Cerebras → Anthropic</p>

  <div class="stats">
    <div class="stat"><div class="val">${state.totalRuns}</div><div class="lbl">Total Runs</div></div>
    <div class="stat"><div class="val">${state.totalIdeasGenerated}</div><div class="lbl">Ideas Generated</div></div>
    <div class="stat"><div class="val">${state.history.filter(r => r.status === 'completed').length}</div><div class="lbl">Successful Runs</div></div>
    <div class="stat"><div class="val">${state.lastRunAt ? state.lastRunAt.split('T')[0] : 'Never'}</div><div class="lbl">Last Run</div></div>
  </div>

  <h2>Pipeline Status</h2>
  ${pipelineHtml}

  <h2>Trigger Run</h2>
  <form method="POST" action="/run">
    <button type="submit">▶ Run Now</button>
  </form>

  <h2>Latest Ideas</h2>
  <div class="ideas-content">${ideasHtml}</div>

  <h2>Run History</h2>
  <table>
    <thead><tr><th>Date</th><th>Niches</th><th>Status</th><th>Ideas</th><th>Scoped</th><th>Report</th></tr></thead>
    <tbody>${historyRows || '<tr><td colspan="6">No runs yet</td></tr>'}</tbody>
  </table>

  <p class="footer">Auto-refreshes every 30s • Idea Factory v1.0</p>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  // Serve a markdown file
  if (url.startsWith('/ideas/') && url.endsWith('.md')) {
    const filename = path.basename(url);
    const filepath = path.join(IDEAS_DIR, filename);
    if (fs.existsSync(filepath)) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(fs.readFileSync(filepath, 'utf8'));
      return;
    }
  }

  // Trigger a manual run
  if (req.method === 'POST' && url === '/run') {
    const { exec } = await import('child_process');
    exec(`cd ${ROOT} && npm start >> /tmp/idea-factory-manual.log 2>&1 &`);
    res.writeHead(302, { Location: '/' });
    res.end();
    return;
  }

  // Main dashboard
  const state = loadState();
  const html = renderHtml(state);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(PORT, () => {
  console.log(`🏭 Idea Factory Dashboard running at http://localhost:${PORT}`);
});
