/**
 * continuous.ts — parallel all-site improvement daemon
 *
 * Runs every site concurrently in batches, loops forever.
 * Writes running.json so the dashboard can show live status.
 *
 * Env vars:
 *   CONCURRENCY=3   — how many sites run in parallel per batch
 *   CYCLE_HOURS=4   — hours to wait between full cycles
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { WebsitesConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '3', 10);
const CYCLE_HOURS = parseFloat(process.env.CYCLE_HOURS || '4');
const RUNNING_FILE = path.join(ROOT, 'running.json');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SiteRunStatus {
  status: 'pending' | 'running' | 'done' | 'failed';
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  exitCode?: number;
  error?: string;
}

export interface RunningState {
  mode: 'continuous';
  startedAt: string;
  cycle: number;
  totalSites: number;
  completedSites: number;
  nextCycleAt?: string;
  sites: Record<string, SiteRunStatus>;
}

// ─── File helpers ─────────────────────────────────────────────────────────────

function loadConfig(): WebsitesConfig {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'websites.config.json'), 'utf8'));
}

function saveRunning(state: RunningState): void {
  fs.writeFileSync(RUNNING_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function clearRunning(): void {
  if (fs.existsSync(RUNNING_FILE)) fs.unlinkSync(RUNNING_FILE);
}

// ─── Per-site runner ──────────────────────────────────────────────────────────

async function runSite(siteId: string, siteName: string, running: RunningState): Promise<void> {
  const siteStart = Date.now();
  running.sites[siteId] = { status: 'running', startedAt: new Date().toISOString() };
  saveRunning(running);

  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = { ...process.env, FORCE_SITE_ID: siteId };
    const child = spawn('npm', ['start'], { cwd: ROOT, env, stdio: 'pipe' });

    let stderrBuf = '';
    child.stderr?.on('data', (d: Buffer) => {
      stderrBuf += d.toString();
      if (stderrBuf.length > 2000) stderrBuf = stderrBuf.slice(-2000);
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - siteStart;
      const status: SiteRunStatus['status'] = code === 0 ? 'done' : 'failed';
      running.sites[siteId] = {
        status,
        startedAt: running.sites[siteId].startedAt,
        completedAt: new Date().toISOString(),
        durationMs,
        exitCode: code ?? -1,
        ...(code !== 0 && stderrBuf ? { error: stderrBuf.slice(-300) } : {}),
      };
      running.completedSites = Object.values(running.sites).filter(s =>
        s.status === 'done' || s.status === 'failed'
      ).length;
      saveRunning(running);
      const icon = status === 'done' ? '✅' : '❌';
      const dur = (durationMs / 1000 / 60).toFixed(1);
      console.log(`  ${icon} ${siteName} (${siteId}) — ${dur}m [exit ${code}]`);
      resolve();
    });
  });
}

// ─── Cycle runner ─────────────────────────────────────────────────────────────

async function runCycle(sites: WebsitesConfig['sites'], cycleNum: number): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🔄 Cycle #${cycleNum} — ${sites.length} sites · concurrency ${CONCURRENCY}`);
  console.log(`   Started: ${new Date().toISOString()}`);
  console.log('═'.repeat(60));

  const running: RunningState = {
    mode: 'continuous',
    startedAt: new Date().toISOString(),
    cycle: cycleNum,
    totalSites: sites.length,
    completedSites: 0,
    sites: Object.fromEntries(sites.map(s => [s.id, { status: 'pending' as const }])),
  };
  saveRunning(running);

  // Process in batches of CONCURRENCY
  for (let i = 0; i < sites.length; i += CONCURRENCY) {
    const batch = sites.slice(i, i + CONCURRENCY);
    console.log(`\n  Batch ${Math.floor(i / CONCURRENCY) + 1}: ${batch.map(s => s.name).join(' | ')}`);
    await Promise.all(batch.map(s => runSite(s.id, s.name, running)));
  }

  const done    = Object.values(running.sites).filter(s => s.status === 'done').length;
  const failed  = Object.values(running.sites).filter(s => s.status === 'failed').length;
  const elapsed = ((Date.now() - new Date(running.startedAt).getTime()) / 60000).toFixed(1);
  console.log(`\n✅ Cycle #${cycleNum} complete in ${elapsed}m — ${done} done, ${failed} failed`);
}

// ─── Main loop ────────────────────────────────────────────────────────────────

let active = true;
process.on('SIGINT',  () => { active = false; clearRunning(); console.log('\n👋 Daemon stopped'); process.exit(0); });
process.on('SIGTERM', () => { active = false; clearRunning(); console.log('\n👋 Daemon stopped'); process.exit(0); });

async function sleep(ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (active && Date.now() < until) {
    await new Promise(r => setTimeout(r, Math.min(30000, until - Date.now())));
  }
}

async function main(): Promise<void> {
  console.log('\n🐾 Site Watchdog — Continuous Improvement Daemon');
  console.log(`   Concurrency : ${CONCURRENCY} sites in parallel`);
  console.log(`   Cycle gap   : ${CYCLE_HOURS}h between full cycles`);
  console.log(`   Sites file  : websites.config.json\n`);

  let cycle = 1;

  while (active) {
    const config = loadConfig();
    await runCycle(config.sites, cycle++);
    if (!active) break;

    // Write cooldown state to running.json
    const nextCycleAt = new Date(Date.now() + CYCLE_HOURS * 3600 * 1000).toISOString();
    const config2 = loadConfig();
    const cooldownState: RunningState = {
      mode: 'continuous',
      startedAt: new Date().toISOString(),
      cycle,
      totalSites: config2.sites.length,
      completedSites: 0,
      nextCycleAt,
      sites: Object.fromEntries(config2.sites.map(s => [s.id, { status: 'pending' as const }])),
    };
    saveRunning(cooldownState);

    console.log(`\n⏰ Next cycle #${cycle} starts at ${nextCycleAt}`);
    console.log(`   Sleeping for ${CYCLE_HOURS}h…\n`);
    await sleep(CYCLE_HOURS * 3600 * 1000);
  }
}

main().catch(err => {
  console.error('💥 Daemon fatal error:', err);
  clearRunning();
  process.exit(1);
});
