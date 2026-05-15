/**
 * Business Agent — Orchestrator
 *
 * Starts the HTTP dashboard and three autonomous loops:
 * - Loop 1: Daily Monetization Improver (every 24h)
 * - Loop 2: Weekly New Product Launcher (every 7 days)
 * - Loop 3: Site Health Monitor + Monetization Researcher (every 6h)
 *
 * Also polls /tmp/business-agent-trigger-* files for on-demand runs from dashboard.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BusinessAgentState } from './types.js';
import { runMonetizationLoop } from './monetizationLoop.js';
import { runLauncherLoop } from './launcherLoop.js';
import { runHealthLoop } from './healthLoop.js';
import './dashboard.js'; // Start dashboard server

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const STATE_FILE = path.join(ROOT, 'state.json');

const MON_INTERVAL_MS    = 24 * 60 * 60 * 1000;     // 24 hours
const LAUNCH_INTERVAL_MS = 7  * 24 * 60 * 60 * 1000; // 7 days
const HEALTH_INTERVAL_MS = 6  * 60 * 60 * 1000;      // 6 hours
const CHECK_INTERVAL_MS  = 60 * 60 * 1000;            // check every hour
const TRIGGER_POLL_MS    = 15 * 1000;                 // poll triggers every 15s

const MON_TRIGGER    = '/tmp/business-agent-trigger-mon';
const LAUNCH_TRIGGER = '/tmp/business-agent-trigger-launch';
const HEALTH_TRIGGER = '/tmp/business-agent-trigger-health';

// ── State management ──────────────────────────────────────────────────────────

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
  // backfill missing fields for older state files
  if (!s.lastHealthRunAt)  s.lastHealthRunAt  = null;
  if (!s.healthHistory)    s.healthHistory    = [];
  return s;
}

function saveState(s: BusinessAgentState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf8');
}

// ── Loop runners ──────────────────────────────────────────────────────────────

let monRunning    = false;
let launchRunning = false;
let healthRunning = false;
let monRunIndex   = 0;

async function doMonetizationRun(): Promise<void> {
  if (monRunning) {
    console.log('[Orchestrator] Monetization loop already running — skipping');
    return;
  }
  monRunning = true;
  const state = loadState();
  try {
    state.currentMonetizationRun = undefined;
    const allPreviousActions = state.monetizationHistory.flatMap(r => r.actions);
    const run = await runMonetizationLoop(monRunIndex++, allPreviousActions);
    state.monetizationHistory = [run, ...state.monetizationHistory].slice(0, 50);
    state.lastMonetizationRunAt = new Date().toISOString();
    saveState(state);
  } catch (e: any) {
    console.error('[Orchestrator] Monetization run failed:', e.message);
  } finally {
    monRunning = false;
  }
}

async function doLauncherRun(): Promise<void> {
  if (launchRunning) {
    console.log('[Orchestrator] Launcher loop already running — skipping');
    return;
  }
  launchRunning = true;
  const state = loadState();
  try {
    const run = await runLauncherLoop();
    state.launcherHistory = [run, ...state.launcherHistory].slice(0, 20);
    state.lastLauncherRunAt = new Date().toISOString();
    saveState(state);
  } catch (e: any) {
    console.error('[Orchestrator] Launcher run failed:', e.message);
  } finally {
    launchRunning = false;
  }
}

async function doHealthRun(): Promise<void> {
  if (healthRunning) {
    console.log('[Orchestrator] Health loop already running — skipping');
    return;
  }
  healthRunning = true;
  const state = loadState();
  try {
    state.currentHealthRun = undefined;
    const run = await runHealthLoop();
    state.healthHistory = [run, ...state.healthHistory].slice(0, 30);
    state.lastHealthRunAt = new Date().toISOString();
    saveState(state);
  } catch (e: any) {
    console.error('[Orchestrator] Health run failed:', e.message);
  } finally {
    healthRunning = false;
  }
}

// ── Scheduler (hourly check) ──────────────────────────────────────────────────

async function schedulerTick(): Promise<void> {
  const state = loadState();
  const now = Date.now();

  const lastMon    = state.lastMonetizationRunAt ? new Date(state.lastMonetizationRunAt).getTime() : 0;
  const lastLaunch = state.lastLauncherRunAt     ? new Date(state.lastLauncherRunAt).getTime()     : 0;
  const lastHealth = state.lastHealthRunAt       ? new Date(state.lastHealthRunAt).getTime()       : 0;

  if (now - lastMon >= MON_INTERVAL_MS) {
    console.log(`[Scheduler] 24h elapsed — triggering Monetization Loop`);
    doMonetizationRun().catch(console.error);
  }

  if (now - lastLaunch >= LAUNCH_INTERVAL_MS) {
    console.log(`[Scheduler] 7 days elapsed — triggering Launcher Loop`);
    doLauncherRun().catch(console.error);
  }

  if (now - lastHealth >= HEALTH_INTERVAL_MS) {
    console.log(`[Scheduler] 6h elapsed — triggering Health Loop`);
    doHealthRun().catch(console.error);
  }
}

// ── Trigger file poller ───────────────────────────────────────────────────────

function pollTriggers(): void {
  if (fs.existsSync(MON_TRIGGER)) {
    fs.unlinkSync(MON_TRIGGER);
    console.log('[Trigger] Manual monetization run triggered from dashboard');
    doMonetizationRun().catch(console.error);
  }

  if (fs.existsSync(LAUNCH_TRIGGER)) {
    fs.unlinkSync(LAUNCH_TRIGGER);
    console.log('[Trigger] Manual launcher run triggered from dashboard');
    doLauncherRun().catch(console.error);
  }

  if (fs.existsSync(HEALTH_TRIGGER)) {
    fs.unlinkSync(HEALTH_TRIGGER);
    console.log('[Trigger] Manual health check triggered from dashboard');
    doHealthRun().catch(console.error);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n========================================');
  console.log('  Business Agent Starting');
  console.log('========================================');
  console.log(`  Dashboard: http://0.0.0.0:${process.env.PORT || 3103}`);
  console.log(`  Mon loop:  every 24h`);
  console.log(`  Launcher:  every 7d`);
  console.log(`  Health:    every 6h`);
  console.log('========================================\n');

  // Initial check on startup
  await schedulerTick();

  // Hourly scheduler
  setInterval(() => {
    schedulerTick().catch(console.error);
  }, CHECK_INTERVAL_MS);

  // Trigger file poller (every 15s)
  setInterval(pollTriggers, TRIGGER_POLL_MS);

  console.log('[Orchestrator] Running. Loops will fire automatically when due.');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
