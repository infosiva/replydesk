/**
 * poster.ts — AI content poster for data-driven sites
 *
 * Generates new content entries for sites that are driven by data files,
 * then commits and pushes via git so Vercel auto-deploys them.
 *
 * Supported sites:
 *   nammatamil   — data/serials.ts, data/movies.ts, data/albums.ts
 *   quizbytesdaily — generates new quiz questions
 *   worldtrends  — generates trending topic summaries
 *   ai-jobs-portal — generates new job listings
 *
 * Usage:
 *   tsx src/poster.ts [siteId]         (post for one site)
 *   tsx src/poster.ts                  (post for all content sites)
 *
 * Or call postContent(siteId) from dashboard API.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import simpleGit, { SimpleGit } from 'simple-git';
import { callAI } from './ai.js';
import { WebsitesConfig, SiteConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadConfig(): WebsitesConfig {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'websites.config.json'), 'utf8'));
}

function log(msg: string) {
  console.log(`[poster ${new Date().toISOString()}] ${msg}`);
}

// ── Git helpers ───────────────────────────────────────────────────────────────

async function gitCommitAndPush(repoPath: string, message: string): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);
  await git.add('.');
  await git.commit(message, { '--allow-empty': null });
  await git.push('origin', 'main');
  log(`Git push complete: ${message}`);
}

// ── NammaTamil ────────────────────────────────────────────────────────────────

async function postNammaTamil(site: SiteConfig): Promise<string> {
  const dataDir = path.join(site.path, 'data');

  // Read one file for context (serials.ts is usually smallest)
  const serialsPath = path.join(dataDir, 'serials.ts');
  let serialsContent = '';
  if (fs.existsSync(serialsPath)) {
    serialsContent = fs.readFileSync(serialsPath, 'utf8');
  }

  const system = `You are a Tamil entertainment content curator.
Generate new Tamil serial/show entries to append to a TypeScript data file.
The file exports an array of objects. Match the EXACT same TypeScript interface and style shown.
Return ONLY the new TypeScript object literals (no imports, no exports, no markdown).
Each object should be on its own lines with proper indentation.`;

  // Extract 2 example objects from the file for context
  const exampleMatch = serialsContent.match(/\{[\s\S]*?\}/g);
  const examples = exampleMatch ? exampleMatch.slice(0, 2).join(',\n') : '';

  const prompt = `Here are existing entries from the Tamil serials data file:\n${examples}\n\nGenerate 3 new unique Tamil serial entries following the EXACT same format. Use popular Tamil TV serials from Vijay TV, Sun TV, or Zee Tamil. Return only the raw object literals separated by commas.`;

  const result = await callAI(system, prompt, 1500);
  const newEntries = result.text.trim();

  // Append new entries before the closing ]; of the array
  const content = fs.readFileSync(serialsPath, 'utf8');
  const insertAt = content.lastIndexOf('];');
  if (insertAt === -1) throw new Error('Could not find closing ]; in serials.ts');

  const updated =
    content.slice(0, insertAt) +
    '  ' + newEntries.replace(/^\[/, '').replace(/\]$/, '').trim() + ',\n' +
    content.slice(insertAt);

  fs.writeFileSync(serialsPath, updated);
  log(`NammaTamil: wrote new serial entries`);

  const dateStr = new Date().toISOString().split('T')[0];
  await gitCommitAndPush(site.path, `content: add Tamil serials ${dateStr} [poster]`);
  return `NammaTamil: posted new serial entries (${dateStr})`;
}

// ── QuizBytes Daily ───────────────────────────────────────────────────────────

async function postQuizBytes(site: SiteConfig): Promise<string> {
  // Find the quiz data file
  const candidates = [
    path.join(site.path, 'data', 'quizzes.ts'),
    path.join(site.path, 'data', 'questions.ts'),
    path.join(site.path, 'src', 'data', 'quizzes.ts'),
    path.join(site.path, 'lib', 'quizData.ts'),
  ];

  let quizFile = candidates.find(f => fs.existsSync(f));
  if (!quizFile) {
    // Try to find any data file with quiz-related content
    const files = fs.readdirSync(path.join(site.path, 'data')).filter(f => f.endsWith('.ts'));
    quizFile = files.length ? path.join(site.path, 'data', files[0]) : null;
  }
  if (!quizFile) throw new Error('QuizBytes: cannot find quiz data file');

  const existing = fs.readFileSync(quizFile, 'utf8');

  const system = `You are a trivia quiz content creator.
Generate new multiple-choice quiz questions in valid TypeScript object literal format.
Match the exact structure of the existing data file shown.
Return ONLY raw TypeScript object literals (no imports, no exports, no markdown fences).`;

  const prompt = `Existing quiz data file content (excerpt):\n${existing.slice(0, 1500)}\n\nGenerate 5 new unique quiz questions following the same format. Cover topics like: science, history, geography, technology, pop culture. Return only the raw object literals.`;

  const result = await callAI(system, prompt, 2000);
  const newEntries = result.text.trim();

  // Insert before closing ];
  const content = fs.readFileSync(quizFile, 'utf8');
  const insertAt = content.lastIndexOf('];');
  if (insertAt === -1) throw new Error('Could not find closing ]; in quiz data file');

  const updated =
    content.slice(0, insertAt) +
    '  ' + newEntries.replace(/^\[/, '').replace(/\]$/, '').trim() + ',\n' +
    content.slice(insertAt);

  fs.writeFileSync(quizFile, updated);
  log(`QuizBytes: wrote new quiz questions`);

  const dateStr = new Date().toISOString().split('T')[0];
  await gitCommitAndPush(site.path, `content: add quiz questions ${dateStr} [poster]`);
  return `QuizBytes: posted new quiz questions (${dateStr})`;
}

// ── World Trends ──────────────────────────────────────────────────────────────

async function postWorldTrends(site: SiteConfig): Promise<string> {
  // Look for a data/trends.ts or similar
  const dataPath = path.join(site.path, 'data');
  let trendsFile: string | null = null;

  if (fs.existsSync(dataPath)) {
    const files = fs.readdirSync(dataPath).filter(f => f.endsWith('.ts') || f.endsWith('.json'));
    trendsFile = files.length ? path.join(dataPath, files[0]) : null;
  }

  // Fall back to app/page.tsx if no data dir
  if (!trendsFile) {
    trendsFile = path.join(site.path, 'app', 'page.tsx');
  }

  if (!trendsFile || !fs.existsSync(trendsFile)) {
    throw new Error('WorldTrends: cannot find content file');
  }

  const existing = fs.readFileSync(trendsFile, 'utf8');
  const isDataFile = trendsFile.endsWith('.ts') && !trendsFile.includes('page.tsx');

  const system = `You are a trending news and topics curator.
Generate fresh, engaging trending topic summaries suitable for a worldwide trends website.
Match the exact format shown in the existing file.
Return ONLY the new content entries (no extra commentary, no markdown fences).`;

  const prompt = `Existing file content:\n${existing.slice(0, 1500)}\n\nGenerate 3 new trending topic entries for today. Cover global news, technology, entertainment, sports, or science. Match the exact same TypeScript/JavaScript format shown. Return only raw object literals.`;

  const result = await callAI(system, prompt, 1500);
  const newEntries = result.text.trim();

  if (isDataFile) {
    const content = fs.readFileSync(trendsFile, 'utf8');
    const insertAt = content.lastIndexOf('];');
    if (insertAt !== -1) {
      const updated =
        content.slice(0, insertAt) +
        '  ' + newEntries.replace(/^\[/, '').replace(/\]$/, '').trim() + ',\n' +
        content.slice(insertAt);
      fs.writeFileSync(trendsFile, updated);
    }
  }

  log(`WorldTrends: wrote new trend entries`);

  const dateStr = new Date().toISOString().split('T')[0];
  await gitCommitAndPush(site.path, `content: add trending topics ${dateStr} [poster]`);
  return `WorldTrends: posted new trending topics (${dateStr})`;
}

// ── AI Jobs Portal ────────────────────────────────────────────────────────────

async function postAIJobs(site: SiteConfig): Promise<string> {
  const dataPath = path.join(site.path, 'data');
  let jobsFile: string | null = null;

  if (fs.existsSync(dataPath)) {
    const files = fs.readdirSync(dataPath).filter(f => f.endsWith('.ts') || f.endsWith('.json'));
    jobsFile = files.length ? path.join(dataPath, files[0]) : null;
  }

  if (!jobsFile) {
    jobsFile = path.join(site.path, 'app', 'page.tsx');
  }

  if (!jobsFile || !fs.existsSync(jobsFile)) {
    throw new Error('AIJobsPortal: cannot find jobs data file');
  }

  const existing = fs.readFileSync(jobsFile, 'utf8');

  const system = `You are an AI jobs board curator.
Generate new AI/ML job listing entries that would appear on a job portal website.
Match the exact TypeScript format shown in the existing file.
Return ONLY new TypeScript object literals (no imports, no exports, no markdown).`;

  const today = new Date().toISOString().split('T')[0];
  const prompt = `Existing jobs data file (excerpt):\n${existing.slice(0, 1500)}\n\nGenerate 4 new realistic AI/ML job listings posted today (${today}). Include companies like OpenAI, Anthropic, Google DeepMind, Meta AI, Microsoft, or startups. Match the exact same format. Return only raw object literals.`;

  const result = await callAI(system, prompt, 2000);
  const newEntries = result.text.trim();

  const content = fs.readFileSync(jobsFile, 'utf8');
  const insertAt = content.lastIndexOf('];');
  if (insertAt !== -1) {
    const updated =
      content.slice(0, insertAt) +
      '  ' + newEntries.replace(/^\[/, '').replace(/\]$/, '').trim() + ',\n' +
      content.slice(insertAt);
    fs.writeFileSync(jobsFile, updated);
  }

  log(`AIJobsPortal: wrote new job listings`);

  await gitCommitAndPush(site.path, `content: add AI job listings ${today} [poster]`);
  return `AIJobsPortal: posted new job listings (${today})`;
}

// ── Router ────────────────────────────────────────────────────────────────────

const POSTER_MAP: Record<string, (site: SiteConfig) => Promise<string>> = {
  'nammatamil': postNammaTamil,
  'quizbytesdaily': postQuizBytes,
  'worldtrends': postWorldTrends,
  'ai-jobs-portal': postAIJobs,
};

export const CONTENT_SITE_IDS = Object.keys(POSTER_MAP);

export async function postContent(siteId: string): Promise<{ ok: boolean; message: string }> {
  const config = loadConfig();
  const site = config.sites.find(s => s.id === siteId);

  if (!site) return { ok: false, message: `Unknown site: ${siteId}` };

  const poster = POSTER_MAP[siteId];
  if (!poster) return { ok: false, message: `No poster configured for: ${siteId}` };

  if (!fs.existsSync(site.path)) {
    return { ok: false, message: `Site path not found: ${site.path}` };
  }

  try {
    log(`Starting content post for: ${siteId}`);
    const message = await poster(site);
    log(`Done: ${message}`);
    return { ok: true, message };
  } catch (err: any) {
    log(`Error posting for ${siteId}: ${err.message}`);
    return { ok: false, message: err.message };
  }
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

async function main() {
  const target = process.argv[2];

  if (target) {
    const result = await postContent(target);
    console.log(result.ok ? `✅ ${result.message}` : `❌ ${result.message}`);
    process.exit(result.ok ? 0 : 1);
  }

  // Post for all content sites
  log(`Running poster for all content sites: ${CONTENT_SITE_IDS.join(', ')}`);
  for (const siteId of CONTENT_SITE_IDS) {
    const result = await postContent(siteId);
    console.log(result.ok ? `✅ ${result.message}` : `❌ ${result.message}`);
  }
}

main().catch(err => {
  console.error('[poster] Fatal error:', err);
  process.exit(1);
});
