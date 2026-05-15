/**
 * Scoper Agent
 * Role: Takes top "build" and "maybe" ideas and writes a lean MVP spec for each.
 * Outputs stack, features, launch checklist, monetisation, SEO strategy.
 */
import { callAI, parseJSON } from './ai.js';
import { ValidatedIdea, ScopedIdea } from './types.js';

export async function runScoper(ideas: ValidatedIdea[]): Promise<ScopedIdea[]> {
  // Only scope "build" ideas, plus top "maybe" if fewer than 2 builds
  const builds = ideas.filter(i => i.verdict === 'build');
  const maybes = ideas.filter(i => i.verdict === 'maybe');
  const toScope = builds.length >= 2 ? builds : [...builds, ...maybes.slice(0, 2 - builds.length)];

  if (toScope.length === 0) {
    console.log('\n📐 [Scoper] No ideas to scope — all skipped.');
    return [];
  }

  console.log(`\n📐 [Scoper] Writing specs for ${toScope.length} idea(s)...`);

  const scoped: ScopedIdea[] = [];

  for (const idea of toScope) {
    console.log(`    Scoping: "${idea.title}"`);

    const system = `You are a senior full-stack developer who scopes lean MVP products.
You know Next.js, Tailwind, Vercel, and AI APIs well. You scope small, ship fast.
Return ONLY valid JSON. No markdown fences, no explanation outside JSON.`;

    const prompt = `Write a lean MVP spec for this product idea:

Title: ${idea.title}
Niche: ${idea.niche}
Problem: ${idea.problem}
Solution: ${idea.solution}
Target Audience: ${idea.targetAudience}
Score: ${idea.totalScore}/50

Context: Solo developer, wants to launch in 1-2 weeks, deploy on Vercel, use free AI APIs where possible (Groq/Gemini), paid Anthropic as fallback.

Return this JSON:
{
  "stack": "e.g. Next.js 15 + Tailwind + Groq API + Vercel",
  "coreFeatures": [
    "Feature 1 — what it does",
    "Feature 2",
    "Feature 3",
    "Feature 4 (max 5)"
  ],
  "mvpScope": "1-2 sentences: what the MVP includes and excludes",
  "launchChecklist": [
    "Step 1",
    "Step 2",
    "...",
    "Step 10 (max 10 items)"
  ],
  "estimatedPages": 3,
  "monetization": [
    "Primary: e.g. AdSense display ads",
    "Secondary: e.g. one-time $9 premium tier"
  ],
  "seoStrategy": "1-2 sentences on primary keywords and content strategy"
}`;

    const { text, provider } = await callAI(system, prompt, 2000);
    console.log(`    [Scoper used: ${provider}]`);

    const spec = parseJSON<ScopedIdea['spec']>(text);
    scoped.push({ ...idea, spec });
  }

  return scoped;
}
