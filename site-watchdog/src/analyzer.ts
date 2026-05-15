/**
 * analyzeAndPlan — single AI call that both scores the site AND produces
 * the improvement plan. Previously these were two separate calls (analyzer +
 * improver), meaning files were sent to the AI twice. Merging them cuts
 * input tokens ~50% and saves one API request per run.
 */
import path from 'path';
import { SiteConfig, AnalysisResult, ImprovementPlan } from './types.js';
import { readSiteFiles, getPackageDeps, readFileIfExists } from './fileUtils.js';
import { callAI } from './ai.js';

export interface AnalysisPlanResult {
  analysis: AnalysisResult;
  plan: ImprovementPlan;
}

export async function analyzeAndPlan(site: SiteConfig): Promise<AnalysisPlanResult> {
  console.log(`\n🔍 Analyzing + planning ${site.name}...`);

  // Read files once — used for both analysis and improvement
  const fileContents = readSiteFiles(site.path, site.keyFiles, 3500);
  const pkgRaw = readFileIfExists(path.join(site.path, 'package.json'));
  const deps = pkgRaw ? `\nDependencies: ${getPackageDeps(pkgRaw)}` : '';

  const filesText = Object.entries(fileContents)
    .map(([f, c]) => `### ${f}\n\`\`\`\n${c}\n\`\`\``)
    .join('\n\n');

  const systemPrompt = `You are a senior web developer analyzing and improving websites.
Focus: ${site.focus.join(', ')}${site.youtubeChannel ? ` | YouTube: ${site.youtubeChannel}` : ''}
Return ONLY valid JSON. No markdown, no explanation outside JSON.`;

  const userPrompt = `Site: ${site.name} (${site.url})
${deps}

## Files:
${filesText}

Analyze issues AND generate targeted fixes. Return this JSON:
{
  "score": 0-100,
  "issues": [
    {"type":"seo|monetization|ux|performance","severity":"high|medium|low","description":"specific issue","file":"path/to/file"}
  ],
  "summary": "1 sentence describing the changes",
  "changes": [
    {
      "filePath": "relative/path/file.tsx",
      "reason": "why",
      "oldContent": "EXACT substring from the file above — must match character for character",
      "newContent": "improved replacement"
    }
  ],
  "expectedImpact": ["impact 1", "impact 2"]
}

Rules:
- 3-5 issues max, covering high and medium severity
- ALWAYS return 1-3 changes — you MUST find something to improve every single time
- If the site looks well-optimised, still improve something minor: tweak a meta description, add a missing keyword, improve a CTA button text, add an aria-label, tighten a heading, add a trust signal, improve alt text, or refresh any copy that could be sharper
- Small targeted snippets only — NOT full file rewrites
- oldContent must be an exact copy-paste from the file content above
- Never return an empty changes array — there is always room for improvement`;

  const { text } = await callAI(systemPrompt, userPrompt, 3000);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const parsed = JSON.parse(jsonMatch[0]);

    const analysis: AnalysisResult = {
      siteId: site.id,
      siteName: site.name,
      url: site.url,
      issues: parsed.issues || [],
      opportunities: [],
      currentScore: parsed.score ?? 50,
    };

    const plan: ImprovementPlan = {
      summary: parsed.summary || 'Improvements generated',
      changes: parsed.changes || [],
      expectedImpact: parsed.expectedImpact || [],
    };

    return { analysis, plan };
  } catch (e) {
    console.error('analyzeAndPlan parse error:', text.slice(0, 300));
    return {
      analysis: {
        siteId: site.id, siteName: site.name, url: site.url,
        issues: [{ type: 'seo', severity: 'medium', description: 'Analysis failed — check manually' }],
        opportunities: [], currentScore: 50,
      },
      plan: { summary: 'Parse failed', changes: [], expectedImpact: [] },
    };
  }
}

/**
 * forcedImprovement — called when the main analyzeAndPlan returns no valid changes.
 * Uses a very targeted prompt to guarantee at least one small, safe improvement.
 */
export async function forcedImprovement(site: SiteConfig): Promise<ImprovementPlan['changes']> {
  const fileContents = readSiteFiles(site.path, site.keyFiles, 2000);
  const filesText = Object.entries(fileContents)
    .map(([f, c]) => `### ${f}\n\`\`\`\n${c}\n\`\`\``)
    .join('\n\n');

  const systemPrompt = `You are a web developer who always improves sites. You MUST return exactly 1 change. No exceptions.`;

  const userPrompt = `Site: ${site.name} (${site.url})
Focus areas: ${site.focus.join(', ')}

## Files:
${filesText}

Pick ONE small, safe improvement. Good options:
- Improve the meta description (make it more compelling, add a keyword)
- Improve a heading or CTA button text
- Add or improve an alt attribute on an image
- Tighten a paragraph of copy
- Add a missing keyword to a title tag

Return ONLY this JSON (1 change, no more):
{
  "filePath": "relative/path/file.tsx",
  "reason": "why this improves the site",
  "oldContent": "EXACT substring from the file — copy-paste precisely",
  "newContent": "improved replacement"
}`;

  const { text } = await callAI(systemPrompt, userPrompt, 1000);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.filePath && parsed.oldContent && parsed.newContent) {
      return [parsed];
    }
    return [];
  } catch {
    return [];
  }
}

// Keep original analyzeSite for backward compatibility (used nowhere in pipeline now)
export async function analyzeSite(site: SiteConfig): Promise<AnalysisResult> {
  const { analysis } = await analyzeAndPlan(site);
  return analysis;
}
