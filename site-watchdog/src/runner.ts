/**
 * runner.ts — Continuous sequential improvement loop
 *
 * Cycles through all configured sites one at a time with a cooldown
 * between visits. Avoids running when a manual run is already active.
 *
 * State written to: runner.json (ROOT)
 * Control via env:  RUNNER_COOLDOWN_HOURS (default 4)
 *                   RUNNER_TIMEOUT_MINUTES (default 45)
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { WatchdogState, WebsitesConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const COOLDOWN_MS = (Number(process.env.RUNNER_COOLDOWN_HOURS) || 4) * 60 * 60 * 1000;
const TIMEOUT_MS  = (Number(process.env.RUNNER_TIMEOUT_MINUTES) || 45) * 60 * 1000;
const IDLE_WAIT   = 5 * 60 * 1000;   // 5 min between polls when all sites on cooldown
const BUSY_WAIT   = 30 * 1000;       // 30 s between runs when sites are available

// ── State ─────────────────────────────────────────────────────────────────────

export interface RunnerState {
  running: boolean;
  currentSiteId: string | null;
  currentSiteStart: string | null;
  lastRunBySite: Record<string, string>;   // siteId → ISO timestamp of last run start
  totalRuns: number;
  startedAt: string;
}

const STATE_FILE = path.join(ROOT, 'runner.json');

function loadState(): RunnerState {
  if (!fs.existsSync(STATE_FILE)) {
    return {
      running: false,
      currentSiteId: null,
      currentSiteStart: null,
      lastRunBySite: {},
      totalRuns: 0,
      startedAt: new Date().toISOString(),
    };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(s: RunnerState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadConfig(): WebsitesConfig {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'websites.config.json'), 'utf8'));
}

function loadWatchdogState(): WatchdogState | null {
  const f = path.join(ROOT, 'state.json');
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function isManualRunActive(): boolean {
  const ws = loadWatchdogState();
  return !!(ws?.currentRun);
}

function isDue(siteId: string, state: RunnerState): boolean {
  const last = state.lastRunBySite[siteId];
  if (!last) return true;
  return Date.now() - new Date(last).getTime() >= COOLDOWN_MS;
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function log(msg: string) {
  console.log(`[runner ${new Date().toISOString()}] ${msg}`);
}

// ── Run a single site ─────────────────────────────────────────────────────────

async function runSite(siteId: string): Promise<void> {
  const state = loadState();
  state.running = true;
  state.currentSiteId = siteId;
  state.currentSiteStart = new Date().toISOString();
  state.lastRunBySite[siteId] = state.currentSiteStart;
  state.totalRuns += 1;
  saveState(state);

  log(`Starting run for site: ${siteId}`);

  return new Promise<void>((resolve) => {
    const env: NodeJS.ProcessEnv = { ...process.env, FORCE_SITE_ID: siteId };
    const child = spawn('npm', ['start'], {
      cwd: ROOT,
      detached: false,
      stdio: 'ignore',
      env,
    });

    let finished = false;

    const timeoutTimer = setTimeout(() => {
      if (!finished) {
        log(`⚠️  Site ${siteId} exceeded ${TIMEOUT_MS / 60000}min timeout — killing`);
        child.kill('SIGTERM');
        setTimeout(() => { if (!finished) child.kill('SIGKILL'); }, 5000);
      }
    }, TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timeoutTimer);
      finished = true;
      log(`Site ${siteId} finished (exit code ${code})`);
      const s = loadState();
      s.running = false;
      s.currentSiteId = null;
      s.currentSiteStart = null;
      saveState(s);
      resolve();
    });

    child.on('error', (err) => {
      clearTimeout(timeoutTimer);
      finished = true;
      log(`Error spawning run for ${siteId}: ${err.message}`);
      const s = loadState();
      s.running = false;
      s.currentSiteId = null;
      s.currentSiteStart = null;
      saveState(s);
      resolve();
    });
  });
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function main() {
  log('Runner started');

  // Ensure startedAt is recorded
  const initState = loadState();
  initState.startedAt = new Date().toISOString();
  initState.running = false;
  initState.currentSiteId = null;
  initState.currentSiteStart = null;
  saveState(initState);

  while (true) {
    // Never overlap with a manual run triggered from the dashboard
    if (isManualRunActive()) {
      log('Manual run in progress — waiting…');
      await sleep(IDLE_WAIT);
      continue;
    }

    const config = loadConfig();
    const state  = loadState();

    // Find first site that is due (respects cooldown)
    const dueSite = config.sites.find(s => isDue(s.id, state));

    if (!dueSite) {
      // All sites on cooldown — compute soonest next due time
      const soonestMs = Math.min(
        ...config.sites.map(s => {
          const last = state.lastRunBySite[s.id];
          return last ? Math.max(0, COOLDOWN_MS - (Date.now() - new Date(last).getTime())) : 0;
        })
      );
      const waitMs = Math.max(Math.min(soonestMs, IDLE_WAIT), 30_000);
      log(`All sites on cooldown. Next check in ${Math.round(waitMs / 60000)}m`);
      await sleep(waitMs);
      continue;
    }

    log(`Site due: ${dueSite.id} — running improvement pipeline`);
    await runSite(dueSite.id);

    // Brief pause before checking for next due site
    await sleep(BUSY_WAIT);
  }
}

main().catch(err => {
  console.error('[runner] Fatal error:', err);
  process.exit(1);
});
