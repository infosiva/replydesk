/**
 * Reviewer — checks proposed changes are safe to deploy.
 * Only sends the diff (old → new snippets), NOT the full file content.
 * Previously re-read full files after applying changes — redundant since
 * the diff already shows exactly what changed.
 */
import { SiteConfig, ImprovementPlan, ReviewResult } from './types.js';
import { callAI } from './ai.js';

export async function reviewChanges(
  site: SiteConfig,
  plan: ImprovementPlan,
): Promise<ReviewResult> {
  console.log(`\n🔎 Reviewing changes for ${site.name}...`);

  if (plan.changes.length === 0) {
    return { approved: false, score: 0, feedback: 'No changes to review', concerns: ['No improvements generated'] };
  }

  // Compact diff — only the snippets, not full files
  const diffText = plan.changes.map(c =>
    `**${c.filePath}** — ${c.reason}\n` +
    `REMOVED: \`\`\`\n${c.oldContent.slice(0, 400)}\n\`\`\`\n` +
    `ADDED: \`\`\`\n${c.newContent.slice(0, 400)}\n\`\`\``
  ).join('\n\n---\n\n');

  const systemPrompt = `You are a strict code reviewer. Approve only safe, genuine improvements.
Reject if: breaks functionality, introduces XSS/injection, removes important content, broken JSX.
Approve if: better SEO/UX/monetization, safe code, no regressions.
Return ONLY valid JSON.`;

  const userPrompt = `Review changes for ${site.name} (${site.url}). Goal: ${plan.summary}

${diffText}

Return:
{"approved":true/false,"score":0-100,"feedback":"brief assessment","concerns":[]}`;

  const { text } = await callAI(systemPrompt, userPrompt, 512);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON');
    return JSON.parse(jsonMatch[0]) as ReviewResult;
  } catch {
    return { approved: false, score: 0, feedback: 'Review parse failed — rejecting for safety', concerns: ['Parse error'] };
  }
}
