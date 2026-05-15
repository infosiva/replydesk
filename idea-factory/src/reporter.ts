/**
 * Reporter Agent
 * Role: Saves the full run output as a JSON + Markdown file, sends Telegram brief.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ScopedIdea, ValidatedIdea, ResearchResult } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const IDEAS_DIR = path.join(ROOT, 'ideas');

async function sendTelegram(message: string): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) { console.log('    [Reporter] Telegram not configured — skipping'); return; }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      const body = await res.text();
      // Telegram has 4096 char limit — retry with trimmed message
      if (res.status === 400 && message.length > 3000) {
        await sendTelegram(message.slice(0, 3000) + '\n\n<i>[truncated]</i>');
        return;
      }
      console.log(`    [Reporter] Telegram error ${res.status}: ${body.slice(0, 100)}`);
    } else {
      console.log('    [Reporter] Telegram sent');
    }
  } catch (err: any) {
    console.log(`    [Reporter] Telegram failed: ${err.message}`);
  }
}

function verdictEmoji(v: string) {
  return v === 'build' ? '🟢' : v === 'maybe' ? '🟡' : '🔴';
}

export async function runReporter(
  research: ResearchResult,
  allValidated: ValidatedIdea[],
  scoped: ScopedIdea[],
  niches: string[],
): Promise<string> {
  console.log('\n📣 [Reporter] Saving output and sending Telegram brief...');

  if (!fs.existsSync(IDEAS_DIR)) fs.mkdirSync(IDEAS_DIR, { recursive: true });

  const date = new Date().toISOString().split('T')[0];
  const runId = `${date}-${Date.now()}`;

  // ── Save JSON ──────────────────────────────────────────────────────────────
  const jsonOut = {
    runId,
    date,
    niches,
    trendSignals: research.trendSignals,
    allIdeas: allValidated,
    scopedIdeas: scoped,
  };
  const jsonFile = path.join(IDEAS_DIR, `${runId}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(jsonOut, null, 2), 'utf8');

  // ── Save Markdown ──────────────────────────────────────────────────────────
  const lines: string[] = [
    `# Idea Factory Run — ${date}`,
    `**Niches:** ${niches.join(', ')}`,
    '',
    `## Trend Signals`,
    ...research.trendSignals.map(t => `- ${t}`),
    '',
    `## All Ideas (sorted by score)`,
    '',
  ];

  for (const idea of allValidated) {
    lines.push(`### ${verdictEmoji(idea.verdict)} ${idea.title} (${idea.totalScore}/50)`);
    lines.push(`**Niche:** ${idea.niche} | **Verdict:** ${idea.verdict}`);
    lines.push(`**Problem:** ${idea.problem}`);
    lines.push(`**Solution:** ${idea.solution}`);
    lines.push(`**Audience:** ${idea.targetAudience}`);
    lines.push(`**Scores:** Demand=${idea.scores.marketDemand} Competition=${idea.scores.competition} Monetisation=${idea.scores.monetizationEase} Build=${idea.scores.buildComplexity} SEO=${idea.scores.seoOpportunity}`);
    lines.push(`**Reasons:** ${idea.reasons.join(' | ')}`);
    lines.push(`**Domains:** ${idea.domainSuggestions.join(', ')}`);
    lines.push('');
  }

  if (scoped.length > 0) {
    lines.push(`## Full Specs (Top Ideas)`);
    lines.push('');
    for (const idea of scoped) {
      lines.push(`### 🛠 ${idea.title}`);
      lines.push(`**Stack:** ${idea.spec.stack}`);
      lines.push(`**MVP Scope:** ${idea.spec.mvpScope}`);
      lines.push(`**Core Features:**`);
      idea.spec.coreFeatures.forEach(f => lines.push(`- ${f}`));
      lines.push(`**Monetisation:** ${idea.spec.monetization.join(' | ')}`);
      lines.push(`**SEO:** ${idea.spec.seoStrategy}`);
      lines.push(`**Launch Checklist:**`);
      idea.spec.launchChecklist.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      lines.push('');
    }
  }

  const mdFile = path.join(IDEAS_DIR, `${runId}.md`);
  fs.writeFileSync(mdFile, lines.join('\n'), 'utf8');

  // ── Telegram brief ─────────────────────────────────────────────────────────
  const buildIdeas = allValidated.filter(i => i.verdict === 'build');
  const maybeIdeas = allValidated.filter(i => i.verdict === 'maybe');

  const tgLines: string[] = [
    '🏭 <b>Idea Factory Weekly Report</b>',
    '',
    `📅 ${date} | Niches: <i>${niches.join(', ')}</i>`,
    `💡 ${allValidated.length} ideas | 🟢 ${buildIdeas.length} build | 🟡 ${maybeIdeas.length} maybe`,
    '',
    '<b>📈 Trend Signals:</b>',
    ...research.trendSignals.slice(0, 3).map(t => `• ${t}`),
    '',
  ];

  if (buildIdeas.length > 0) {
    tgLines.push('<b>🟢 BUILD These:</b>');
    for (const idea of buildIdeas.slice(0, 3)) {
      tgLines.push(`\n<b>${idea.title}</b> (${idea.totalScore}/50)`);
      tgLines.push(`${idea.problem}`);
      tgLines.push(`<i>Domains: ${idea.domainSuggestions.slice(0, 2).join(', ')}</i>`);
      if (scoped.find(s => s.title === idea.title)) {
        const spec = scoped.find(s => s.title === idea.title)!;
        tgLines.push(`Stack: ${spec.spec.stack}`);
        tgLines.push(`Monetise: ${spec.spec.monetization[0]}`);
      }
    }
  }

  if (maybeIdeas.length > 0) {
    tgLines.push('\n<b>🟡 Maybe (worth watching):</b>');
    for (const idea of maybeIdeas.slice(0, 2)) {
      tgLines.push(`• <b>${idea.title}</b> (${idea.totalScore}/50) — ${idea.solution}`);
    }
  }

  tgLines.push('');
  tgLines.push(`📁 Full report saved to: ideas/${runId}.md`);

  await sendTelegram(tgLines.join('\n'));

  console.log(`    [Reporter] JSON: ${jsonFile}`);
  console.log(`    [Reporter] MD:   ${mdFile}`);

  return runId;
}
