import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  WebsitesConfig, WatchdogState, HistoryEntry,
  PipelineStage, PipelineStageName, PipelineStageStatus,
} from './types.js';
import { analyzeAndPlan, forcedImprovement } from './analyzer.js';
import { applyImprovements, revertImprovements } from './improver.js';
import { readFileIfExists } from './fileUtils.js';
import { reviewChanges } from './reviewer.js';
import { deploySite } from './deployer.js';
import {
  notifySuccess, notifyReviewFailed, notifyDeployFailed, notifyNoChanges,
} from './notifier.js';
import { screenshotUrl, screenshotDir } from './screenshotter.js';
import { testSite, formatTestReport } from './tester.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadConfig(): WebsitesConfig {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'websites.config.json'), 'utf8'));
}

function loadState(): WatchdogState {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
}

function saveState(state: WatchdogState): void {
  fs.writeFileSync(path.join(ROOT, 'state.json'), JSON.stringify(state, null, 2), 'utf8');
}

function ensureLogDir(): string {
  const logDir = process.env.LOG_DIR || path.join(ROOT, 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  return logDir;
}

function makePipeline(): PipelineStage[] {
  const stages: PipelineStageName[] = ['analyze', 'improve', 'review', 'deploy', 'notify'];
  return stages.map(name => ({ name, status: 'pending' as PipelineStageStatus }));
}

function setStage(
  state: WatchdogState,
  name: PipelineStageName,
  status: PipelineStageStatus,
  detail?: string
): void {
  if (!state.currentRun) return;
  const stage = state.currentRun.pipeline.find(s => s.name === name);
  if (!stage) return;

  if (status === 'running') {
    stage.startedAt = new Date().toISOString();
  } else if ((status === 'done' || status === 'failed' || status === 'skipped') && stage.startedAt) {
    stage.completedAt = new Date().toISOString();
    stage.durationMs = Date.now() - new Date(stage.startedAt).getTime();
  }
  stage.status = status;
  if (detail) stage.detail = detail;
  saveState(state);
}

async function run(): Promise<void> {
  console.log('\n🐾 Site Watchdog Starting...');
  console.log('================================');

  const config = loadConfig();
  const state = loadState();
  const logDir = ensureLogDir();

  const forceSiteId = process.env.FORCE_SITE_ID;
  const forcedIdx = forceSiteId ? config.sites.findIndex(s => s.id === forceSiteId) : -1;
  const isAdHoc = forcedIdx >= 0;
  const nextIndex = isAdHoc ? forcedIdx : (state.lastSiteIndex + 1) % config.sites.length;
  const site = config.sites[nextIndex];

  console.log(`\n📌 ${isAdHoc ? '🎯 Ad-hoc run:' : "Today's site:"} ${site.name} (${site.url})`);
  console.log(`   Focus: ${site.focus.join(', ')}`);

  const runStart = Date.now();
  const date = new Date().toISOString().split('T')[0];
  const logFile = path.join(logDir, `${date}-${site.id}.log`);
  function appendLog(...lines: string[]): void {
    fs.appendFileSync(logFile, lines.join('\n') + '\n', 'utf8');
  }
  appendLog(`Site Watchdog Run — ${new Date().toISOString()}`, `Site: ${site.name} | ${site.url}`, '');
  const ssDir = screenshotDir(logDir);
  const dateTag = new Date().toISOString().split('T')[0];
  const ssBefore = `${ssDir}/${dateTag}-${site.id}-before.png`;
  const ssAfter  = `${ssDir}/${dateTag}-${site.id}-after.png`;

  // Initialise current run in state (visible on dashboard immediately)
  state.currentRun = {
    date: new Date().toISOString(),
    siteId: site.id,
    siteName: site.name,
    status: 'running',
    pipeline: makePipeline(),
    improvements: [],
  };
  saveState(state);

  try {
    // Screenshot BEFORE changes
    appendLog(`📸 Capturing before-screenshot of ${site.url}...`);
    console.log(`\n📸 Capturing before-screenshot of ${site.url}...`);
    await screenshotUrl(site.url, ssBefore);
    appendLog('  ✓ Screenshot saved');

    // ── Stages 1+2: Analyse + Plan (single AI call) ──────────────
    appendLog('\n🔍 Stage 1+2: Analyzing and planning improvements...');
    setStage(state, 'analyze', 'running');
    setStage(state, 'improve', 'running');

    const { analysis, plan } = await analyzeAndPlan(site);

    // Validate changes — filter out any where oldContent doesn't exist in file
    const validChanges = plan.changes.filter(c => {
      const fullPath = path.join(site.path, c.filePath);
      const current = readFileIfExists(fullPath);
      if (!current) { console.log(`  ⚠️  Skipping ${c.filePath} — file not found`); return false; }
      if (!current.includes(c.oldContent)) { console.log(`  ⚠️  Skipping ${c.filePath} — snippet not found`); return false; }
      return true;
    });
    plan.changes = validChanges;

    const analysisDetail = `Score ${analysis.currentScore}/100 · ${analysis.issues.length} issues`;
    const improveDetail = `${plan.changes.length} changes`;
    setStage(state, 'analyze', 'done', analysisDetail);
    setStage(state, 'improve', plan.changes.length > 0 ? 'done' : 'skipped', improveDetail);
    state.currentRun.analysisScore = analysis.currentScore;
    appendLog(`[analyze] ${analysisDetail}`);
    analysis.issues.forEach(i => appendLog(`  - [${i.severity}] ${i.type}: ${i.description}`));
    appendLog(`[improve] ${improveDetail}: ${plan.summary}`);
    plan.changes.forEach(c => appendLog(`  - ${c.filePath}: ${c.reason}`));
    appendLog('');

    // Fallback: if all changes were filtered out, force a minor improvement
    if (plan.changes.length === 0) {
      console.log('  ⚡ No valid changes found — running forced improvement...');
      appendLog('[fallback] Forcing a minor improvement...');
      const forced = await forcedImprovement(site);
      const validForced = forced.filter(c => {
        const fullPath = path.join(site.path, c.filePath);
        const current = readFileIfExists(fullPath);
        if (!current) return false;
        if (!current.includes(c.oldContent)) { console.log(`  ⚠️  Skipping forced ${c.filePath} — snippet not found`); return false; }
        return true;
      });
      plan.changes = validForced;
      if (validForced.length > 0) {
        plan.summary = plan.summary || 'Minor copy and SEO improvements';
        setStage(state, 'improve', 'done', `${validForced.length} forced changes`);
        appendLog(`[fallback] Applied ${validForced.length} forced changes`);
      }
    }

    if (plan.changes.length === 0) {
      setStage(state, 'review', 'skipped', 'No changes to review');
      setStage(state, 'deploy', 'skipped', 'Nothing to deploy');
      setStage(state, 'notify', 'running');
      await notifyNoChanges(site);
      setStage(state, 'notify', 'done');
      state.currentRun.status = 'no-changes';
    } else {
      // Apply changes to files
      const appliedFiles = applyImprovements(site, plan);
      state.currentRun.improvements = plan.changes.map(c => c.reason);
      saveState(state);

      // ── Stage 3: Review ────────────────────────────────────────
      appendLog('\n🔎 Stage 3: Reviewing changes...');
      setStage(state, 'review', 'running');
      const review = await reviewChanges(site, plan);
      const reviewDetail = `Score ${review.score}/100 · ${review.approved ? 'Approved' : 'Rejected'}`;
      setStage(state, 'review', review.approved ? 'done' : 'failed', reviewDetail);
      state.currentRun.reviewScore = review.score;
      appendLog(`[review] ${reviewDetail}: ${review.feedback}`, '');

      if (!review.approved) {
        revertImprovements(site, plan);
        setStage(state, 'deploy', 'skipped', 'Reverted — review rejected');
        setStage(state, 'notify', 'running');
        await notifyReviewFailed(site, plan, review);
        setStage(state, 'notify', 'done');
        state.currentRun.status = 'review-failed';
      } else {
        // ── Stage 4: Deploy ───────────────────────────────────────
        appendLog('\n🚀 Stage 4: Deploying...');
        setStage(state, 'deploy', 'running');
        const deploy = await deploySite(site);
        const deployDetail = deploy.success ? `→ ${deploy.url}` : deploy.error || 'failed';
        setStage(state, 'deploy', deploy.success ? 'done' : 'failed', deployDetail);
        appendLog(`[deploy] ${deployDetail}`);

        if (!deploy.success) {
          setStage(state, 'notify', 'running');
          await notifyDeployFailed(site, plan, deploy);
          setStage(state, 'notify', 'done');
          state.currentRun.status = 'deploy-failed';
          state.currentRun.error = deploy.error;
        } else {
          state.currentRun.deployUrl = deploy.url;

          // Screenshot AFTER deploy + run test sub-agent
          // In dry-run the URL has " (dry run)" suffix — screenshot the real site URL instead
          const screenshotTarget = deploy.url.includes('dry run') ? site.url : deploy.url;
          console.log(`\n📸 Capturing after-screenshot...`);
          await screenshotUrl(screenshotTarget, ssAfter);
          const testResult = await testSite(site, screenshotTarget);

          // ── Stage 5: Notify ─────────────────────────────────────
          setStage(state, 'notify', 'running');
          await notifySuccess(site, plan, review, deploy,
            { before: ssBefore, after: ssAfter },
            formatTestReport(testResult)
          );
          setStage(state, 'notify', 'done');
          state.currentRun.status = 'success';
          console.log(`\n🎉 Done! ${site.name} → ${deploy.url}`);
        }
      }
    }
  } catch (err: any) {
    console.error('\n💥 Error:', err.message);
    appendLog(`ERROR: ${err.message}`);
    if (state.currentRun) {
      const running = state.currentRun.pipeline.find(s => s.status === 'running');
      if (running) setStage(state, running.name, 'failed', err.message?.slice(0, 100));
      state.currentRun.status = 'error';
      state.currentRun.error = err.message;
    }
  }

  // Finalise
  const durationMs = Date.now() - runStart;
  if (state.currentRun) {
    state.currentRun.durationMs = durationMs;
    state.history = [state.currentRun, ...state.history].slice(0, 100);
  }
  state.currentRun = undefined;
  state.lastRunDate = new Date().toISOString();
  if (!isAdHoc) state.lastSiteIndex = nextIndex;
  saveState(state);

  const elapsed = (durationMs / 1000).toFixed(1);
  appendLog(`\nCompleted in ${elapsed}s`);

  console.log(`\n================================`);
  console.log(`⏱  ${elapsed}s  |  Status: ${state.history[0]?.status}`);
}

run().catch(console.error);
