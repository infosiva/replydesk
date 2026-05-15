import 'dotenv/config';
import fs from 'fs';
import TelegramBot from 'node-telegram-bot-api';
import { SiteConfig, ImprovementPlan, ReviewResult, DeployResult } from './types.js';

let bot: TelegramBot | null = null;

function getBot(): TelegramBot {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');
    bot = new TelegramBot(token);
  }
  return bot;
}

function chatId(): string {
  const id = process.env.TELEGRAM_CHAT_ID;
  if (!id) throw new Error('TELEGRAM_CHAT_ID not set');
  return id;
}

async function sendScreenshots(
  beforePath: string | undefined,
  afterPath: string | undefined,
  caption: string
): Promise<void> {
  const b = getBot();
  const cid = chatId();

  const media: TelegramBot.InputMediaPhoto[] = [];
  if (beforePath && fs.existsSync(beforePath)) {
    media.push({ type: 'photo', media: beforePath, caption: '📸 BEFORE' });
  }
  if (afterPath && fs.existsSync(afterPath)) {
    media.push({ type: 'photo', media: afterPath, caption: '📸 AFTER' });
  }

  if (media.length === 0) return;

  try {
    if (media.length === 2) {
      // Send as media group (side by side)
      await b.sendMediaGroup(cid, media as any);
    } else {
      await b.sendPhoto(cid, (media[0] as any).media, { caption: media[0].caption });
    }
  } catch (e: any) {
    console.log('  Screenshot send failed:', e.message?.slice(0, 80));
  }
}

export async function notifySuccess(
  site: SiteConfig,
  plan: ImprovementPlan,
  review: ReviewResult,
  deploy: DeployResult,
  screenshots?: { before?: string; after?: string },
  testReport?: string
): Promise<void> {
  const cid = chatId();
  const changesText = plan.changes.map(c => `  • \`${c.filePath}\`: ${c.reason}`).join('\n');
  const impactText = plan.expectedImpact.slice(0, 3).map(i => `  📈 ${i}`).join('\n');

  const message = `🤖 *Site Watchdog — Deployed*

🌐 *${site.name}*
🔗 ${deploy.url}
📅 ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' })}

📝 *Changes Applied:*
${changesText || '  —'}

${impactText ? `*Expected Impact:*\n${impactText}\n` : ''}🔎 Review: ${review.score}/100 — ${review.feedback}

${testReport || ''}
_Check screenshots below ↓_`;

  try {
    await getBot().sendMessage(cid, message, { parse_mode: 'Markdown' });
    if (screenshots) {
      await sendScreenshots(screenshots.before, screenshots.after, 'Before → After comparison');
    }
    console.log('  📲 Telegram: success notification sent');
  } catch (e: any) {
    console.error('  Telegram error:', e.message?.slice(0, 80));
  }
}

export async function notifyReviewFailed(
  site: SiteConfig,
  plan: ImprovementPlan,
  review: ReviewResult
): Promise<void> {
  const cid = chatId();
  const concerns = review.concerns.map(c => `  ⚠️ ${c}`).join('\n');

  const message = `🤖 *Site Watchdog — Review Failed*

🌐 *${site.name}*
❌ Changes reverted — not deployed

🔎 Score: ${review.score}/100
💬 ${review.feedback}
${concerns ? `\n*Concerns:*\n${concerns}` : ''}`;

  try {
    await getBot().sendMessage(cid, message, { parse_mode: 'Markdown' });
    console.log('  📲 Telegram: review-failed notification sent');
  } catch (e: any) {
    console.error('  Telegram error:', e.message?.slice(0, 80));
  }
}

export async function notifyDeployFailed(
  site: SiteConfig,
  plan: ImprovementPlan,
  deploy: DeployResult
): Promise<void> {
  const cid = chatId();
  const message = `🤖 *Site Watchdog — Deploy Failed*

🌐 *${site.name}*
✅ Review approved — but deploy failed

Error: \`${deploy.error?.slice(0, 200)}\`
_Check VERCEL\\_TOKEN or Vercel dashboard._`;

  try {
    await getBot().sendMessage(cid, message, { parse_mode: 'Markdown' });
    console.log('  📲 Telegram: deploy-failed notification sent');
  } catch (e: any) {
    console.error('  Telegram error:', e.message?.slice(0, 80));
  }
}

export async function notifyQuotaExhausted(site: SiteConfig, provider: string): Promise<void> {
  const now = new Date();
  const nextMidnightUTC = new Date(now);
  nextMidnightUTC.setUTCHours(24, 0, 0, 0);
  const hoursUntilReset = Math.ceil((nextMidnightUTC.getTime() - now.getTime()) / 3600000);

  const message = `⏰ *Site Watchdog — Quota Exhausted*

🌐 *${site.name}*
🛑 Run stopped — *${provider}* daily limit reached

_No fallback attempted \\(prevents 20-min stuck runs\\)_

🔄 Will retry tomorrow — resets in ~${hoursUntilReset}h at midnight UTC`;

  try {
    await getBot().sendMessage(chatId(), message, { parse_mode: 'MarkdownV2' });
    console.log('  📲 Telegram: quota-exhausted notification sent');
  } catch (e: any) {
    console.error('  Telegram error:', e.message?.slice(0, 80));
  }
}

export async function notifyNoChanges(site: SiteConfig): Promise<void> {
  const cid = chatId();
  const message = `🤖 *Site Watchdog*

🌐 *${site.name}* — ✨ No improvements needed today`;

  try {
    await getBot().sendMessage(cid, message, { parse_mode: 'Markdown' });
  } catch (e: any) {
    console.error('  Telegram error:', e.message?.slice(0, 80));
  }
}

// Test connectivity
if (process.argv[1]?.includes('notifier')) {
  (async () => {
    try {
      await getBot().sendMessage(chatId(), '✅ *Site Watchdog* connected and ready\\!', { parse_mode: 'MarkdownV2' });
      console.log('Test message sent!');
    } catch (e: any) {
      console.error('Failed:', e.message);
    }
    process.exit(0);
  })();
}
