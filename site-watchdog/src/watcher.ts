/**
 * watcher.ts — Failure & hung-run monitor
 *
 * Polls state.json every 60s. Sends Telegram alerts when:
 *   - A run is hung (running > HUNG_THRESHOLD_MIN minutes)
 *   - A site has ≥ FAILURE_THRESHOLD consecutive failures
 *
 * State written to: watcher.json (ROOT)
 * Alert cooldown:   ALERT_COOLDOWN_HOURS (default 1h per alert type)
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WatchdogState, WebsitesConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const POLL_MS            = 60 * 1000;          // 60s poll interval
const HUNG_THRESHOLD_MS  = 35 * 60 * 1000;     // 35min → hung
const FAILURE_THRESHOLD  = 3;                  // consecutive failures → alert
const ALERT_COOLDOWN_MS  = (Number(process.env.ALERT_COOLDOWN_HOURS) || 1) * 60 * 60 * 1000;

// ── State ─────────────────────────────────────────────────────────────────────

interface WatcherState {
  startedAt: string;
  lastCheck: string;
  consecutiveFailures: Record<string, number>;
  lastAlertBySite: Record<string, string>;  // siteId → ISO timestamp of last alert
  lastHungAlert: string | null;
  totalAlerts: number;
}

const STATE_FILE = path.join(ROOT, 'watcher.json');

function loadState(): WatcherState {
  if (!fs.existsSync(STATE_FILE)) {
    return {
      startedAt: new Date().toISOString(),
      lastCheck: new Date().toISOString(),
      consecutiveFailures: {},
      lastAlertBySite: {},
      lastHungAlert: null,
      totalAlerts: 0,
    };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(s: WatcherState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadWatchdogState(): WatchdogState | null {
  const f = path.join(ROOT, 'state.json');
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function loadConfig(): WebsitesConfig {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'websites.config.json'), 'utf8'));
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function log(msg: string) {
  console.log(`[watcher ${new Date().toISOString()}] ${msg}`);
}

function canAlert(lastAlert: string | null): boolean {
  if (!lastAlert) return true;
  return Date.now() - new Date(lastAlert).getTime() >= ALERT_COOLDOWN_MS;
}

// ── Telegram ──────────────────────────────────────────────────────────────────

async function sendTelegram(message: string): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    log('Telegram not configured — skipping alert');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      log(`Telegram error ${res.status}: ${body}`);
    } else {
      log('Telegram alert sent');
    }
  } catch (err: any) {
    log(`Telegram fetch failed: ${err.message}`);
  }
}

// ── Checks ────────────────────────────────────────────────────────────────────

async function checkHungRun(ws: WatchdogState, state: WatcherState): Promise<WatcherState> {
  const current = ws.currentRun;
  if (!current) return state;

  const elapsed = Date.now() - new Date(current.date).getTime();
  if (elapsed < HUNG_THRESHOLD_MS) return state;

  if (!canAlert(state.lastHungAlert)) {
    log(`Hung run detected for ${current.siteId} — alert on cooldown`);
    return state;
  }

  const mins = Math.round(elapsed / 60000);
  const msg = [
    '⚠️ <b>Site Watchdog — Hung Run</b>',
    '',
    `Site: <b>${current.siteName}</b> (<code>${current.siteId}</code>)`,
    `Running for: <b>${mins} minutes</b>`,
    `Started: ${current.date}`,
    '',
    'The process may be stuck. Check the VPS manually.',
  ].join('\n');

  await sendTelegram(msg);
  state.lastHungAlert = new Date().toISOString();
  state.totalAlerts += 1;
  log(`Hung-run alert sent for ${current.siteId} (${mins}min elapsed)`);
  return state;
}

async function checkConsecutiveFailures(
  ws: WatchdogState,
  state: WatcherState,
  config: WebsitesConfig,
): Promise<WatcherState> {
  // Build consecutive failure counts from recent history
  const failCounts: Record<string, number> = {};

  // Walk history from most recent, count consecutive failures per site
  const history = [...(ws.history || [])].reverse();
  const counted = new Set<string>();

  for (const entry of history) {
    const id = entry.siteId;
    if (counted.has(id)) continue;
    if (entry.status === 'success') {
      failCounts[id] = 0;
      counted.add(id);
    } else {
      failCounts[id] = (failCounts[id] ?? 0) + 1;
    }
  }

  // Ensure all configured sites have a value
  for (const site of config.sites) {
    if (!(site.id in failCounts)) failCounts[site.id] = 0;
  }

  // Update state
  state.consecutiveFailures = failCounts;

  // Alert for sites that crossed threshold
  for (const [siteId, count] of Object.entries(failCounts)) {
    if (count < FAILURE_THRESHOLD) continue;

    if (!canAlert(state.lastAlertBySite[siteId] ?? null)) {
      log(`${siteId} has ${count} consecutive failures — alert on cooldown`);
      continue;
    }

    const site = config.sites.find(s => s.id === siteId);
    const name = site?.name ?? siteId;

    const msg = [
      '🔴 <b>Site Watchdog — Consecutive Failures</b>',
      '',
      `Site: <b>${name}</b> (<code>${siteId}</code>)`,
      `Consecutive failures: <b>${count}</b>`,
      '',
      'Please investigate the pipeline for this site.',
    ].join('\n');

    await sendTelegram(msg);
    state.lastAlertBySite[siteId] = new Date().toISOString();
    state.totalAlerts += 1;
    log(`Failure alert sent for ${siteId} (${count} consecutive)`);
  }

  return state;
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function main() {
  log('Watcher started');

  let state = loadState();
  state.startedAt = new Date().toISOString();
  saveState(state);

  while (true) {
    await sleep(POLL_MS);

    state = loadState();
    state.lastCheck = new Date().toISOString();

    const ws     = loadWatchdogState();
    const config = loadConfig();

    if (!ws) {
      log('state.json not found — skipping check');
      saveState(state);
      continue;
    }

    state = await checkHungRun(ws, state);
    state = await checkConsecutiveFailures(ws, state, config);

    saveState(state);
    log(`Check complete. Alerts total: ${state.totalAlerts}`);
  }
}

main().catch(err => {
  console.error('[watcher] Fatal error:', err);
  process.exit(1);
});
