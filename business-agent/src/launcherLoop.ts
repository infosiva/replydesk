/**
 * Loop 2 — Weekly New Product Launcher
 *
 * 1. Picks 4 niches (rotating weekly)
 * 2. Runs researcher → validator → scoper pipeline
 * 3. For ideas scoring >= 35/50 that don't exist in websites.config.json
 *    → scaffolds a new Next.js project
 * 4. Telegram notification
 */
import 'dotenv/config';
import fs from 'fs';
import { callAI, parseJSON } from './ai.js';
import { sendTelegram } from './telegram.js';
import { scaffoldProduct } from './scaffolder.js';
import {
  RawIdea, ValidatedIdea, ScopedIdea,
  WebsitesConfig, LauncherLoopRun, LaunchedProduct,
} from './types.js';

const SCORE_THRESHOLD = 30; // lowered — validator is conservative, 30+ is good enough to build

// ── Niche rotation ────────────────────────────────────────────────────────────

function pickNiches(): string[] {
  const allNiches = [
    // High-monetization niches first (ads + affiliate + SaaS all work well)
    'ai-tools', 'finance-tools', 'job-search', 'saas',
    'developer-tools', 'india-specific', 'education-tech', 'health-wellness',
    'productivity', 'content-creation', 'e-commerce-tools', 'legal-compliance',
    'local-business', 'social-media-tools', 'tamil-language', 'agriculture',
    // Extra high-value: passive income, affiliate, digital products
    'passive-income-tools', 'affiliate-marketing', 'digital-downloads', 'online-courses',
  ];
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const start = (weekNumber * 4) % allNiches.length;
  const picked: string[] = [];
  for (let i = 0; i < 4; i++) {
    picked.push(allNiches[(start + i) % allNiches.length]);
  }
  return picked;
}

// ── Researcher ────────────────────────────────────────────────────────────────

async function runResearcher(niches: string[]): Promise<RawIdea[]> {
  console.log(`\n  [Researcher] Scanning niches: ${niches.join(', ')}`);

  const system = `You are a startup researcher who identifies high-potential micro-SaaS and AI product ideas.
Return ONLY valid JSON. No markdown fences, no explanation outside JSON.`;

  const prompt = `Today: ${new Date().toISOString().split('T')[0]}
Niches: ${niches.join(', ')}

Generate 8 raw product ideas focused on:
- Real problems with PROVEN demand and clear willingness to pay
- Niches where AdSense, affiliate marketing, OR a small SaaS fee work naturally
- Quick to build solo in 1-2 weeks with Next.js + free AI APIs
- India/global crossover opportunities (especially finance, jobs, education, health)
- Avoid: saturated markets, ChatGPT wrappers with no unique value, generic todo apps
- Prefer: tools people use repeatedly (daily/weekly), niche calculators, AI converters, data dashboards

Return JSON:
{
  "ideas": [
    {
      "title": "Product Name",
      "niche": "niche",
      "problem": "specific problem (1-2 sentences)",
      "solution": "what it does (1-2 sentences)",
      "targetAudience": "who uses this"
    }
  ]
}

Generate exactly 8 ideas.`;

  const { text, provider } = await callAI(system, prompt, 3000);
  console.log(`    [Researcher used: ${provider}]`);
  const parsed = parseJSON<{ ideas: RawIdea[] }>(text);
  return parsed.ideas || [];
}

// ── Validator ─────────────────────────────────────────────────────────────────

async function runValidator(ideas: RawIdea[]): Promise<ValidatedIdea[]> {
  console.log(`\n  [Validator] Scoring ${ideas.length} ideas...`);

  const system = `You are a sceptical startup validator. Score product ideas honestly.
Return ONLY valid JSON. No markdown, no explanation outside JSON.`;

  const ideasText = ideas.map((idea, i) =>
    `${i + 1}. "${idea.title}" — ${idea.niche}\n   Problem: ${idea.problem}\n   Solution: ${idea.solution}`
  ).join('\n\n');

  const prompt = `Score these ${ideas.length} product ideas:

${ideasText}

Scoring criteria (each 0-10):
- marketDemand: proven demand right now
- competition: low competition (10=blue ocean)
- monetizationEase: how easy to charge money
- buildComplexity: how easy to build solo (10=very easy)
- seoOpportunity: organic search prospects

Verdict: totalScore >= 38 → "build", 28-37 → "maybe", <28 → "skip"

Return JSON:
{
  "scoredIdeas": [
    {
      "title": "...", "niche": "...", "problem": "...", "solution": "...", "targetAudience": "...",
      "scores": {"marketDemand": 0, "competition": 0, "monetizationEase": 0, "buildComplexity": 0, "seoOpportunity": 0},
      "totalScore": 0,
      "verdict": "build|maybe|skip",
      "reasons": ["..."],
      "domainSuggestions": ["example.app", "example.io"]
    }
  ]
}

Score ALL ${ideas.length} ideas.`;

  const { text, provider } = await callAI(system, prompt, 4000);
  console.log(`    [Validator used: ${provider}]`);
  const parsed = parseJSON<{ scoredIdeas: ValidatedIdea[] }>(text);
  const scored = parsed.scoredIdeas || [];
  scored.sort((a, b) => b.totalScore - a.totalScore);
  return scored;
}

// ── Scoper ────────────────────────────────────────────────────────────────────

async function runScoper(idea: ValidatedIdea): Promise<ScopedIdea> {
  console.log(`\n  [Scoper] Writing spec for: "${idea.title}"`);

  const system = `You are a senior full-stack developer who scopes lean MVP products for Next.js/Vercel.
Return ONLY valid JSON. No markdown fences, no explanation outside JSON.`;

  const prompt = `Scope this product:
Title: ${idea.title}
Niche: ${idea.niche}
Problem: ${idea.problem}
Solution: ${idea.solution}
Score: ${idea.totalScore}/50

Return JSON:
{
  "stack": "e.g. Next.js 15 + Tailwind + Groq API",
  "coreFeatures": ["Feature 1", "Feature 2", "Feature 3"],
  "mvpScope": "what MVP includes and excludes",
  "launchChecklist": ["Step 1", "Step 2"],
  "estimatedPages": 3,
  "monetization": ["Primary: AdSense", "Secondary: ..."],
  "seoStrategy": "keywords and content strategy",
  "verticalConfig": {
    "name": "Brand Name",
    "tagline": "short tagline",
    "description": "2 sentence description",
    "primaryColor": "violet|emerald|blue|amber|rose|cyan",
    "accentColor": "purple|green|blue|yellow|pink|teal",
    "features": ["feature 1", "feature 2", "feature 3"]
  }
}`;

  const { text, provider } = await callAI(system, prompt, 2000);
  console.log(`    [Scoper used: ${provider}]`);
  const spec = parseJSON<ScopedIdea['spec']>(text);
  return { ...idea, spec };
}

// ── Main loop function ────────────────────────────────────────────────────────

export async function runLauncherLoop(): Promise<LauncherLoopRun> {
  const runId = `launch-${Date.now()}`;
  console.log(`\n[Loop 2] Product Launcher starting (run ${runId})`);

  const run: LauncherLoopRun = {
    id: runId,
    startedAt: new Date().toISOString(),
    status: 'running',
    niches: [],
    ideasEvaluated: 0,
    ideasQualified: 0,
    productsLaunched: 0,
    products: [],
  };

  try {
    // Load existing sites to avoid duplicates
    const config: WebsitesConfig = JSON.parse(
      fs.readFileSync('/root/site-watchdog/websites.config.json', 'utf8')
    );
    const existingIds = new Set(config.sites.map(s => s.id));
    const existingNames = new Set(config.sites.map(s => s.name.toLowerCase()));

    const niches = pickNiches();
    run.niches = niches;
    console.log(`  Niches: ${niches.join(', ')}`);

    // Research
    const rawIdeas = await runResearcher(niches);
    run.ideasEvaluated = rawIdeas.length;

    if (rawIdeas.length === 0) {
      throw new Error('Researcher returned no ideas');
    }

    // Validate
    const validated = await runValidator(rawIdeas);

    // Filter to qualifying ideas not already in the watchdog
    const qualifying = validated.filter(idea => {
      const slug = idea.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      return (
        idea.totalScore >= SCORE_THRESHOLD &&
        !existingIds.has(slug) &&
        !existingNames.has(idea.title.toLowerCase())
      );
    });

    run.ideasQualified = qualifying.length;
    console.log(`\n  ${qualifying.length} ideas qualify (score >= ${SCORE_THRESHOLD}, not already launched)`);

    // Scope and scaffold top 2 to stay within API limits
    const toLaunch = qualifying.slice(0, 2);

    for (const idea of toLaunch) {
      try {
        const scoped = await runScoper(idea);
        const product = await scaffoldProduct(scoped);
        if (product) {
          run.products.push(product);
          run.productsLaunched++;
          console.log(`    Launched: ${product.title} → ${product.repoUrl}`);
          await sendTelegram(
            `<b>Business Agent — New Product Launched!</b>\n` +
            `<b>${product.title}</b> (${idea.niche})\n` +
            `Score: ${idea.totalScore}/50\n` +
            `Problem: ${idea.problem.slice(0, 100)}\n` +
            `Repo: ${product.repoUrl || '(local only)'}\n` +
            `Path: <code>${product.localPath}</code>`
          );
        }
      } catch (e: any) {
        console.error(`    [Launcher] Failed for "${idea.title}": ${e.message}`);
      }
    }

    run.status = 'completed';
    run.completedAt = new Date().toISOString();
    console.log(`\n[Loop 2] Done. Launched ${run.productsLaunched} new products.`);

  } catch (err: any) {
    console.error(`\n[Loop 2] Fatal error: ${err.message}`);
    run.status = 'error';
    run.error = err.message;
    run.completedAt = new Date().toISOString();
  }

  return run;
}
