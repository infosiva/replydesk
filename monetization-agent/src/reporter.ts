/**
 * Reporter — saves JSON + Markdown report, sends Telegram summary.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SiteMonetizationPlan } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'reports');

async function sendTelegram(message: string): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) { console.log('    [Reporter] Telegram not configured'); return; }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message.slice(0, 4000), parse_mode: 'HTML' }),
    });
    if (res.ok) console.log('    [Reporter] Telegram sent ✓');
    else console.log(`    [Reporter] Telegram error: ${res.status}`);
  } catch (e: any) {
    console.log(`    [Reporter] Telegram failed: ${e.message}`);
  }
}

const TYPE_EMOJI: Record<string, string> = {
  ads: '📢', affiliate: '🔗', saas: '💳', oneTime: '💰',
  subscription: '♻️', lead: '📧', sponsorship: '🤝',
};

const EFFORT_LABEL: Record<string, string> = {
  low: '🟢 Low', medium: '🟡 Medium', high: '🔴 High',
};

export async function runReporter(plans: SiteMonetizationPlan[]): Promise<string> {
  console.log('\n📣 [Reporter] Saving report and sending Telegram...');

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const date = new Date().toISOString().split('T')[0];
  const runId = `${date}-${Date.now()}`;

  // ── JSON ──────────────────────────────────────────────────────────────────
  fs.writeFileSync(
    path.join(REPORTS_DIR, `${runId}.json`),
    JSON.stringify({ runId, date, plans }, null, 2),
    'utf8',
  );

  // ── Markdown ──────────────────────────────────────────────────────────────
  const lines: string[] = [
    `# Monetization Roadmap — ${date}`,
    `*${plans.length} sites analysed*`,
    '',
    '## Summary Table',
    '',
    '| Site | Current | Potential/mo | Top Stream |',
    '|------|---------|-------------|------------|',
  ];

  const totalLow = plans.reduce((s, p) => s + p.totalPotentialMonthlyUSD[0], 0);
  const totalHigh = plans.reduce((s, p) => s + p.totalPotentialMonthlyUSD[1], 0);

  for (const p of plans) {
    const top = p.streams[0];
    lines.push(
      `| [${p.siteName}](${p.url}) | ${p.currentMonetization} | $${p.totalPotentialMonthlyUSD[0]}–$${p.totalPotentialMonthlyUSD[1]} | ${top ? top.name : '—'} |`
    );
  }

  lines.push('', `**Total portfolio potential: $${totalLow}–$${totalHigh}/month**`, '');

  for (const p of plans) {
    lines.push(`---`, `## ${p.siteName}`, `**URL:** ${p.url}`, '');
    lines.push(`**Current monetization:** ${p.currentMonetization}`);
    lines.push(`**Monthly potential:** $${p.totalPotentialMonthlyUSD[0]}–$${p.totalPotentialMonthlyUSD[1]}`);
    lines.push('');

    if (p.newIdea) {
      lines.push(`### 💡 Fresh Idea for Today`);
      lines.push(`> ${p.newIdea}`);
      lines.push('');
    }

    lines.push('### Revenue Streams (by priority)');
    for (const s of p.streams) {
      lines.push(`#### ${s.priority}. ${TYPE_EMOJI[s.type] || '💡'} ${s.name}`);
      lines.push(`- **Estimate:** $${s.estimatedMonthlyUSD[0]}–$${s.estimatedMonthlyUSD[1]}/mo`);
      lines.push(`- **Effort:** ${EFFORT_LABEL[s.effort]}`);
      lines.push(`- **Time to revenue:** ${s.timeToRevenue}`);
      lines.push('- **How to:**');
      s.howTo.forEach(h => lines.push(`  - ${h}`));
      lines.push('');
    }

    lines.push('### Quick Wins (this week)');
    p.quickWins.forEach(w => lines.push(`- ${w}`));
    lines.push('');

    if (p.todaysTasks?.length) {
      lines.push('### 🛠️ Today\'s Implementation Tasks');
      p.todaysTasks.forEach((t, i) => {
        lines.push(`#### Task ${i + 1}: ${t.task}`);
        if (t.file) lines.push(`- **File:** \`${t.file}\``);
        lines.push(`- **Impact:** ${t.impact}`);
        lines.push(`- **Effort:** ${EFFORT_LABEL[t.effort]}`);
        lines.push('');
      });
    }

    lines.push(`**30-day goal:** ${p.thirtyDayGoal}`);
    lines.push(`**90-day goal:** ${p.ninetyDayGoal}`);
    lines.push(`**Key risk:** ⚠️ ${p.keyRisk}`);
    lines.push('');
  }

  const mdPath = path.join(REPORTS_DIR, `${runId}.md`);
  fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');

  // ── Telegram ──────────────────────────────────────────────────────────────
  const tg: string[] = [
    '💰 <b>Monetization Agent — Portfolio Roadmap</b>',
    '',
    `📅 ${date} · ${plans.length} sites analysed`,
    `💵 Combined potential: <b>$${totalLow}–$${totalHigh}/month</b>`,
    '',
    '<b>Per-site snapshot:</b>',
  ];
  for (const p of plans.slice(0, 8)) {
    const top = p.streams[0];
    tg.push(`\n<b>${p.siteName}</b> — $${p.totalPotentialMonthlyUSD[0]}–$${p.totalPotentialMonthlyUSD[1]}/mo`);
    if (top) tg.push(`  Top: ${TYPE_EMOJI[top.type] || '💡'} ${top.name} ($${top.estimatedMonthlyUSD[0]}–$${top.estimatedMonthlyUSD[1]})`);
    if (p.quickWins[0]) tg.push(`  ✅ Quick win: ${p.quickWins[0]}`);
    if (p.newIdea) tg.push(`  💡 Fresh idea: ${p.newIdea}`);
    if (p.todaysTasks?.[0]) tg.push(`  🛠️ Do today: ${p.todaysTasks[0].task}`);
  }
  tg.push('', `📁 Full report: reports/${runId}.md`);
  tg.push(`🔗 Dashboard: http://31.97.56.148:3102`);

  await sendTelegram(tg.join('\n'));

  console.log(`    Report: reports/${runId}.md`);
  return runId;
}
