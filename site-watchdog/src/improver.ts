import path from 'path';
import fs from 'fs';
import { SiteConfig, AnalysisResult, ImprovementPlan, FileChange } from './types.js';
import { readSiteFiles, readFileIfExists, writeFile } from './fileUtils.js';
import { callAI } from './ai.js';

export async function generateImprovements(
  site: SiteConfig,
  analysis: AnalysisResult
): Promise<ImprovementPlan> {
  console.log(`\n🛠  Generating improvements for ${site.name}...`);

  const highIssues = analysis.issues.filter(i => i.severity === 'high').slice(0, 3);
  const topOpps = analysis.opportunities.filter(o => o.impact === 'high').slice(0, 3);

  // Read the specific files mentioned in issues
  const filesToRead = [
    ...new Set([
      ...highIssues.map(i => i.file).filter(Boolean) as string[],
      ...site.keyFiles.filter(f => !f.includes('components')).slice(0, 3),
    ]),
  ].slice(0, 4);

  const fileContents: Record<string, string> = {};
  for (const f of filesToRead) {
    const fullPath = path.join(site.path, f);
    const content = readFileIfExists(fullPath);
    if (content) fileContents[f] = content.slice(0, 6000);
  }

  const filesText = Object.entries(fileContents)
    .map(([f, c]) => `### ${f}\n\`\`\`\n${c}\n\`\`\``)
    .join('\n\n');

  const systemPrompt = `You are a senior Next.js developer who makes precise, targeted code improvements.
Rules:
- Make SMALL, safe changes only — no major refactors
- Each change must be self-contained and immediately deployable
- Preserve all existing functionality
- Focus on: ${site.focus.join(', ')}
${site.youtubeChannel ? `- YouTube channel to promote: ${site.youtubeChannel}` : ''}
- Return ONLY valid JSON. No markdown outside JSON.`;

  const issuesSummary = [...highIssues, ...topOpps.map(o => ({ type: o.type, severity: 'medium' as const, description: o.description }))]
    .map(i => `- ${i.type}: ${i.description}`)
    .join('\n');

  const userPrompt = `Fix these issues for ${site.name} (${site.url}):

## Issues to address:
${issuesSummary}

## Current file contents:
${filesText}

Generate improvements as JSON:
{
  "summary": "1-2 sentence summary of changes",
  "changes": [
    {
      "filePath": "relative/path/to/file.tsx",
      "reason": "why this change",
      "oldContent": "exact content to replace (must match exactly)",
      "newContent": "improved content to replace it with"
    }
  ],
  "expectedImpact": ["list of expected improvements"]
}

Rules for changes:
1. oldContent must EXACTLY match text in the file (copy-paste from file content above)
2. Make 1-3 targeted improvements per file
3. Do NOT rewrite entire files — only change specific sections
4. If adding new section (e.g. YouTube CTA), insert it at a logical location`;

  const { text: responseText } = await callAI(systemPrompt, userPrompt, 4096);

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in improvement response');
    const plan = JSON.parse(jsonMatch[0]) as ImprovementPlan;

    // Filter to only changes where oldContent actually exists in the file
    const validChanges: FileChange[] = [];
    for (const change of plan.changes) {
      const fullPath = path.join(site.path, change.filePath);
      const currentContent = readFileIfExists(fullPath);
      if (!currentContent) {
        console.log(`  ⚠️  Skipping ${change.filePath} — file not found`);
        continue;
      }
      if (!currentContent.includes(change.oldContent)) {
        console.log(`  ⚠️  Skipping ${change.filePath} — old content not found (may be truncated)`);
        continue;
      }
      validChanges.push({ ...change, oldContent: change.oldContent });
    }

    return { ...plan, changes: validChanges };
  } catch (e) {
    console.error('Failed to parse improvement plan:', responseText.slice(0, 500));
    return { summary: 'No valid improvements generated', changes: [], expectedImpact: [] };
  }
}

export function applyImprovements(site: SiteConfig, plan: ImprovementPlan): string[] {
  const appliedFiles: string[] = [];

  for (const change of plan.changes) {
    const fullPath = path.join(site.path, change.filePath);
    const currentContent = readFileIfExists(fullPath);

    if (!currentContent.includes(change.oldContent)) {
      console.log(`  ⚠️  Cannot apply change to ${change.filePath} — content mismatch`);
      continue;
    }

    const newContent = currentContent.replace(change.oldContent, change.newContent);
    writeFile(fullPath, newContent);
    appliedFiles.push(change.filePath);
    console.log(`  ✅ Updated ${change.filePath}: ${change.reason}`);
  }

  return appliedFiles;
}

export function revertImprovements(site: SiteConfig, plan: ImprovementPlan): void {
  for (const change of plan.changes) {
    const fullPath = path.join(site.path, change.filePath);
    const currentContent = readFileIfExists(fullPath);
    if (currentContent.includes(change.newContent)) {
      const reverted = currentContent.replace(change.newContent, change.oldContent);
      writeFile(fullPath, reverted);
      console.log(`  ↩️  Reverted ${change.filePath}`);
    }
  }
}
