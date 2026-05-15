/**
 * Monetization Agent — Orchestrator
 *
 * Reads all live sites from site-watchdog/websites.config.json,
 * generates a concrete monetization roadmap for each site,
 * saves a full report (JSON + Markdown), and sends a Telegram summary.
 *
 * Run: npm start
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Site, AgentState } from './types.js';
import { scopeSite } from './scoper.js';
import { runReporter } from './reporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const STATE_FILE = path.join(ROOT, 'state.json');
const SITES_CONFIG = path.join(ROOT, '..', 'site-watchdog', 'websites.config.json');

function loadState(): AgentState {
  if (!fs.existsSync(STATE_FILE)) {
    return { lastRunAt: null, totalRuns: 0, history: [] };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(s: AgentState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf8');
}

function loadSites(): Site[] {
  if (!fs.existsSync(SITES_CONFIG)) {
    throw new Error(`websites.config.json not found at ${SITES_CONFIG}`);
  }
  const config = JSON.parse(fs.readFileSync(SITES_CONFIG, 'utf8'));
  return config.sites as Site[];
}

async function run() {
  console.log('\n💰 Monetization Agent Starting...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const state = loadState();
  const runId = `run-${Date.now()}`;
  const startedAt = new Date().toISOString();

  let sites: Site[];
  try {
    sites = loadSites();
    console.log(`📋 Loaded ${sites.length} sites from websites.config.json\n`);
  } catch (e: any) {
    console.error(`❌ Failed to load sites: ${e.message}`);
    process.exit(1);
  }

  // Filter to only sites with URLs (skip undeployed ones)
  const liveSites = sites.filter(s => s.url && s.url.startsWith('http'));
  console.log(`🌐 Analysing ${liveSites.length} live sites...\n`);

  const plans = [];
  for (const site of liveSites) {
    try {
      const plan = await scopeSite(site);
      plans.push(plan);
      console.log(`  ✅ Done: ${site.name} — $${plan.totalPotentialMonthlyUSD[0]}–$${plan.totalPotentialMonthlyUSD[1]}/mo potential\n`);
    } catch (e: any) {
      console.error(`  ❌ Failed: ${site.name} — ${e.message}`);
    }
  }

  if (plans.length === 0) {
    console.error('❌ No plans generated — aborting');
    process.exit(1);
  }

  const outputFile = await runReporter(plans);

  // Update state
  state.lastRunAt = new Date().toISOString();
  state.totalRuns++;
  state.history.unshift({
    id: runId,
    startedAt,
    completedAt: new Date().toISOString(),
    status: 'completed',
    sitesAnalysed: plans.length,
    outputFile,
  });
  if (state.history.length > 20) state.history = state.history.slice(0, 20);
  saveState(state);

  const totalLow = plans.reduce((s, p) => s + p.totalPotentialMonthlyUSD[0], 0);
  const totalHigh = plans.reduce((s, p) => s + p.totalPotentialMonthlyUSD[1], 0);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Monetization Agent Complete`);
  console.log(`   Sites analysed: ${plans.length}`);
  console.log(`   Portfolio potential: $${totalLow}–$${totalHigh}/month`);
  console.log(`   Report: reports/${outputFile}.md`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

run().catch(e => {
  console.error('💥 Fatal error:', e.message);
  process.exit(1);
});
