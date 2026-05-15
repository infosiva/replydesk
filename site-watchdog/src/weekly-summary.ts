/**
 * weekly-summary.ts — Send a weekly portfolio summary to Telegram
 *
 * Pulls REAL visitor stats from tracker-api (port 3098) + deployment
 * history from state.json, then sends a Markdown digest.
 *
 * Run:  npx tsx src/weekly-summary.ts
 * Cron: every Monday 08:00 UTC via PM2 cron (see ecosystem below)
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
import type { WatchdogState, WebsitesConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const TRACKER_URL  = process.env.TRACKER_URL  || 'http://31.97.56.148:3098';
const TRACKER_KEY  = process.env.STATS_KEY    || 'sitestats2025';

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadState(): WatchdogState {
  const f = path.join(ROOT, 'state.json');
  if (!fs.existsSync(f)) return { lastRunDate: null, lastSiteIndex: 0, history: [] };
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function loadConfig(): WebsitesConfig {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'websites.config.json'), 'utf8'));
}

function getBot(): TelegramBot {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');
  return new TelegramBot(token);
}

function chatId(): string {
  const id = process.env.TELEGRAM_CHAT_ID;
  if (!id) throw new Error('TELEGRAM_CHAT_ID not set');
  return id;
}

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtDuration(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60 > 0 ? ` ${s % 60}s` : ''}`;
}

// ── Fetch stats from tracker-api ──────────────────────────────────────────────

interface SiteStats {
  pageviews: { total: number; uniq_sessions: number };
  top_pages: Array<{ path: string; views: number }>;
  avg_session: { duration_s: number; avg_pages: number };
  top_events: Array<{ name: string; count: number }>;
  by_site?: Array<{ site: string; views: number; sessions: number }>;
}

async function fetchStats(site?: string, days = 7): Promise<SiteStats | null> {
  try {
    const url = `${TRACKER_URL}/stats?days=${days}&key=${TRACKER_KEY}${site ? `&site=${site}` : ''}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json() as SiteStats;
  } catch {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function sendWeeklySummary(): Promise<void> {
  const state  = loadState();
  const config = loadConfig();
  const now    = new Date();
  const weekLabel = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Pull all-sites aggregate stats
  const allStats = await fetchStats(undefined, 7);

  // Pull per-site stats concurrently
  const siteNames: Record<string, string> = {
    'nammatamil.live':         'NammaTamil',
    'flightbrain.app':         'FlightBrain',
    'quizbytes.dev':           'QuizBytes',
    'worldtrends.today':       'WorldTrends',
    'clawdbotai.tech':         'ClawdBot AI',
    'quicktechai.app':         'QuickTech AI',
    'www.aijobsportal.app':    'AI Jobs Portal',
  };

  const siteEntries = await Promise.all(
    Object.entries(siteNames).map(async ([domain, name]) => {
      const s = await fetchStats(domain, 7);
      return { domain, name, stats: s };
    })
  );

  // Deployment history stats (last 7 days)
  const cutoff = Date.now() - 7 * 86_400_000;
  const recentHistory = state.history.filter(e => new Date(e.date).getTime() > cutoff);
  const totalDeployed  = recentHistory.filter(e => e.status === 'success').length;
  const totalFailed    = recentHistory.filter(e => ['review-failed', 'deploy-failed', 'error'].includes(e.status)).length;
  const totalChanges   = recentHistory.flatMap(e => e.improvements ?? []).length;

  // ── Build sections ──────────────────────────────────────────────────────────

  // Overall traffic
  const totalViews    = allStats?.pageviews.total ?? 0;
  const totalSessions = allStats?.pageviews.uniq_sessions ?? 0;
  const avgDuration   = allStats?.avg_session.duration_s ?? 0;

  // Top clicked links (events)
  const topEvents = allStats?.top_events?.slice(0, 5) ?? [];
  const eventsText = topEvents.length
    ? topEvents.map(e => `   🔗 \`${e.name}\` — ${fmtNum(e.count)} clicks`).join('\n')
    : '   _No click events tracked yet_';

  // Per-site rows with improvement flags
  const sorted = [...siteEntries].sort((a, b) => (b.stats?.pageviews.total ?? 0) - (a.stats?.pageviews.total ?? 0));
  const maxViews = sorted[0]?.stats?.pageviews.total ?? 1;

  const siteRows = sorted.map(({ name, domain, stats }) => {
    if (!stats) return `  ⬜ *${name}* — no data`;
    const v = fmtNum(stats.pageviews.total);
    const u = fmtNum(stats.pageviews.uniq_sessions);
    const d = fmtDuration(stats.avg_session.duration_s);
    const ratio = stats.pageviews.total / maxViews;
    const health = ratio > 0.3 ? '🟢' : ratio > 0.05 ? '🟡' : '🔴';
    const flag   = stats.pageviews.total < 20 ? ' ⚡ *NEEDS BOOST*' :
                   stats.avg_session.duration_s < 30 ? ' ⚠️ low engagement' : '';
    return `${health} *${name}* — ${v} views · ${u} visitors · ${d} avg${flag}`;
  }).join('\n');

  // Underperforming sites list for action
  const needsWork = sorted.filter(s => !s.stats || s.stats.pageviews.total < 20 || s.stats.avg_session.duration_s < 30);
  const actionText = needsWork.length
    ? `\n⚡ *Action needed on:* ${needsWork.map(s => s.name).join(', ')}`
    : '\n✅ All sites performing well!';

  // Top pages across all sites
  const topPages = allStats?.top_pages?.slice(0, 5) ?? [];
  const pagesText = topPages.length
    ? topPages.map(p => `   📄 \`${p.path}\` — ${fmtNum(p.views)} views`).join('\n')
    : '   _No page data yet_';

  // ── Assemble message ────────────────────────────────────────────────────────
  const message =
`📊 *Weekly Portfolio Summary*
📅 ${weekLabel}

━━━━━━━━━━━━━━━━━━━━━
👥 *Traffic (Last 7 Days)*
  • Total page views: *${fmtNum(totalViews)}*
  • Unique visitors:  *${fmtNum(totalSessions)}*
  • Avg session time: *${fmtDuration(avgDuration)}*

━━━━━━━━━━━━━━━━━━━━━
🌐 *Site Performance*
${siteRows}

━━━━━━━━━━━━━━━━━━━━━
📄 *Top Pages*
${pagesText}

━━━━━━━━━━━━━━━━━━━━━
🔗 *Top Clicked Links*
${eventsText}

━━━━━━━━━━━━━━━━━━━━━
🤖 *Auto-Improvement*
  • Deployments:  ${totalDeployed} ✅
  • Failed:       ${totalFailed} ❌
  • Code changes: ${totalChanges} edits

${actionText}
━━━━━━━━━━━━━━━━━━━━━
💡 _Add \`data-track="link-name"\` to any affiliate/CTA link to track clicks_`;

  const bot = getBot();
  await bot.sendMessage(chatId(), message, { parse_mode: 'Markdown' });
  console.log('📲 Weekly summary sent to Telegram');
}

sendWeeklySummary().catch(err => {
  console.error('Weekly summary failed:', err.message);
  process.exit(1);
});
