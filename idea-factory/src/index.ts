/**
 * Idea Factory — Orchestrator
 *
 * Pipeline:
 *   CEO decides niches → Researcher generates ideas → Validator scores them
 *   → Scoper writes specs → Reporter saves + Telegrams
 *
 * Run: npm start
 * Schedule: weekly via PM2 cron or system cron
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FactoryState, FactoryRun } from './types.js';
import { runResearcher } from './researcher.js';
import { runValidator } from './validator.js';
import { runScoper } from './scoper.js';
import { runReporter } from './reporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const STATE_FILE = path.join(ROOT, 'state.json');

function loadState(): FactoryState {
  if (!fs.existsSync(STATE_FILE)) {
    return { lastRunAt: null, totalRuns: 0, totalIdeasGenerated: 0, history: [] };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(s: FactoryState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf8');
}

// CEO agent: decides which niches to explore this week
// Rotates through a broader list so ideas stay fresh each run
function pickNiches(): string[] {
  const envNiches = process.env.IDEA_NICHES;
  if (envNiches) return envNiches.split(',').map(n => n.trim());

  const allNiches = [
    'ai-tools', 'saas', 'india-specific', 'tamil-language',
    'productivity', 'developer-tools', 'education', 'health-wellness',
    'finance', 'content-creation', 'e-commerce', 'job-search',
    'local-business', 'social-media', 'legal-compliance', 'agriculture',
  ];

  // Pick 4 niches — rotate weekly based on week number
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const start = (weekNumber * 4) % allNiches.length;
  const picked: string[] = [];
  for (let i = 0; i < 4; i++) {
    picked.push(allNiches[(start + i) % allNiches.length]);
  }
  return picked;
}

async function run() {
  console.log('\n🏭 Idea Factory Starting...');
  console.log('=====================================');

  const state = loadState();
  const runId = `run-${Date.now()}`;
  const niches = pickNiches();

  console.log(`🎯 CEO decided niches: ${niches.join(', ')}`);

  const currentRun: FactoryRun = {
    id: runId,
    startedAt: new Date().toISOString(),
    status: 'running',
    niches,
    pipeline: { ceo: 'done', research: 'pending', validate: 'pending', scope: 'pending', report: 'pending' },
    ideasFound: 0,
    ideasBuilt: 0,
  };
  state.currentRun = currentRun;
  saveState(state);

  try {
    // ── Research ────────────────────────────────────────────────────────────
    currentRun.pipeline.research = 'running';
    saveState(state);
    const research = await runResearcher(niches);
    currentRun.pipeline.research = 'done';
    currentRun.ideasFound = research.ideas.length;
    saveState(state);

    // ── Validate ────────────────────────────────────────────────────────────
    currentRun.pipeline.validate = 'running';
    saveState(state);
    const validated = await runValidator(research.ideas);
    currentRun.pipeline.validate = 'done';
    saveState(state);

    // ── Scope ───────────────────────────────────────────────────────────────
    currentRun.pipeline.scope = 'running';
    saveState(state);
    const scoped = await runScoper(validated);
    currentRun.pipeline.scope = 'done';
    currentRun.ideasBuilt = scoped.length;
    saveState(state);

    // ── Report ──────────────────────────────────────────────────────────────
    currentRun.pipeline.report = 'running';
    saveState(state);
    const outputFile = await runReporter(research, validated, scoped, niches);
    currentRun.pipeline.report = 'done';
    currentRun.outputFile = outputFile;
    currentRun.status = 'completed';
    currentRun.completedAt = new Date().toISOString();

    console.log('\n=====================================');
    console.log(`✅ Done! ${research.ideas.length} ideas found, ${scoped.length} fully scoped.`);
    console.log(`📁 Output: ideas/${outputFile}.md`);

  } catch (err: any) {
    console.error('\n💥 Error:', err.message);
    currentRun.status = 'error';
    currentRun.error = err.message;
    // mark whichever stage was running as failed
    for (const stage of Object.keys(currentRun.pipeline) as Array<keyof typeof currentRun.pipeline>) {
      if (currentRun.pipeline[stage] === 'running') currentRun.pipeline[stage] = 'failed';
    }
  }

  // Finalise state
  state.currentRun = undefined;
  state.lastRunAt = new Date().toISOString();
  state.totalRuns += 1;
  state.totalIdeasGenerated += currentRun.ideasFound;
  state.history = [currentRun, ...state.history].slice(0, 50);
  saveState(state);
}

run().catch(console.error);
