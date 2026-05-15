/**
 * News Spin Agent — Autonomous content engine
 *
 * Runs every 4 hours. Monitors RSS feeds, spins unique SEO articles
 * for each site in the portfolio, commits to GitHub (auto-deploys via Vercel).
 *
 * Manual trigger: touch /tmp/news-spin-trigger
 */
import 'dotenv/config';
import fs from 'fs';
import { runSpinLoop } from './spinLoop.js';

const SPIN_INTERVAL_MS = 4 * 60 * 60 * 1000;   // every 4 hours
const TRIGGER_POLL_MS  = 30 * 1000;              // poll trigger every 30s
const TRIGGER_FILE     = '/tmp/news-spin-trigger';

let running = false;

async function doRun(): Promise<void> {
  if (running) { console.log('[Orchestrator] Already running — skipping'); return; }
  running = true;
  try { await runSpinLoop(); }
  catch (e: any) { console.error('[Orchestrator] Run failed:', e.message); }
  finally { running = false; }
}

function pollTrigger(): void {
  if (fs.existsSync(TRIGGER_FILE)) {
    fs.unlinkSync(TRIGGER_FILE);
    console.log('[Trigger] Manual run triggered');
    doRun().catch(console.error);
  }
}

async function main(): Promise<void> {
  console.log('\n==========================================');
  console.log('  News Spin Agent Starting');
  console.log('==========================================');
  console.log(`  Runs: every 4 hours`);
  console.log(`  Trigger: touch ${TRIGGER_FILE}`);
  console.log('==========================================\n');

  // Run immediately on start
  await doRun();

  // Schedule
  setInterval(() => doRun().catch(console.error), SPIN_INTERVAL_MS);
  setInterval(pollTrigger, TRIGGER_POLL_MS);

  console.log('[Orchestrator] Running. Next spin in 4 hours.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
