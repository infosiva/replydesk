/**
 * Monetization Scoper
 * For each live site, asks AI to write a concrete monetization roadmap.
 */
import { callAI, parseJSON } from './ai.js';
import { Site, SiteMonetizationPlan } from './types.js';

const SYSTEM = `You are a revenue strategist and indie hacker who specialises in
monetising small web products quickly. You know AdSense, Adsterra, affiliate marketing,
SaaS pricing, Gumroad, Stripe, and content marketing extremely well.
You think in terms of concrete implementation actions, not vague advice.
Every plan must include DIFFERENT ideas each day — rotate, innovate, surprise.
Return ONLY valid JSON. No markdown fences, no explanation outside JSON.`;

export async function scopeSite(site: Site): Promise<SiteMonetizationPlan> {
  console.log(`  💰 Scoping monetization for: ${site.name} (${site.url})`);

  const focusContext = site.focus.join(', ');
  const ytCtx = site.youtubeChannel
    ? `YouTube channel: ${site.youtubeChannel}`
    : 'No YouTube channel';

  const today = new Date().toISOString().split('T')[0];
  const seed  = Math.floor(Math.random() * 9999); // different ideas each run

  const prompt = `[run:${today}-${seed}] Analyse this live web product and write TODAY's monetization action plan.
IMPORTANT: Generate FRESH ideas every time. Rotate across: ad placements, affiliate programs, paywalls, email capture, referral programs, sponsored content, digital products, API access tiers, one-time downloads, browser extensions, newsletter, community paid tier. Do NOT repeat generic advice.

Product: ${site.name}
URL: ${site.url}
Type: ${site.type} app
Current focus areas: ${focusContext}
${ytCtx}

Stack: Next.js 15, Tailwind, Vercel (free tier), AI (Groq/Gemini/Anthropic)

Solo developer context:
- Can't do enterprise sales or high-touch support
- Prefers passive/semi-passive revenue (ads, affiliates, SaaS tiers)
- Has Adsterra (instant approval, no minimum traffic) and Google AdSense (pending)
- Wants revenue within 30 days — concrete code changes preferred
- Has Stripe already configured on kwizzo, nudge, questly

Return this exact JSON (all fields required, no extras):
{
  "currentMonetization": "string — what's already in place",
  "totalPotentialMonthlyUSD": [low_number, high_number],
  "streams": [
    {
      "name": "string",
      "type": "ads|affiliate|saas|oneTime|subscription|lead|sponsorship",
      "estimatedMonthlyUSD": [low, high],
      "effort": "low|medium|high",
      "timeToRevenue": "string e.g. 1-2 weeks",
      "howTo": ["Step 1", "Step 2", "Step 3"],
      "priority": 1
    }
  ],
  "quickWins": ["concrete action (this week)", "concrete action 2", "concrete action 3"],
  "todaysTasks": [
    {
      "task": "string — exactly what to implement today",
      "file": "string — e.g. app/page.tsx or components/AdUnit.tsx",
      "impact": "string — expected revenue or growth impact",
      "effort": "low|medium|high"
    }
  ],
  "thirtyDayGoal": "one sentence",
  "ninetyDayGoal": "one sentence",
  "keyRisk": "single biggest risk",
  "newIdea": "one creative monetization idea NOT mentioned elsewhere — something fresh for this specific product"
}

Order streams by priority (1 = highest ROI for effort). Include 3-5 streams. Include 2-3 todaysTasks.`;

  const { text, provider, model } = await callAI(SYSTEM, prompt, 2500, 'best');
  console.log(`    [used: ${provider}/${model}]`);

  const plan = parseJSON<Omit<SiteMonetizationPlan, 'siteId' | 'siteName' | 'url'>>(text);

  return {
    siteId: site.id,
    siteName: site.name,
    url: site.url,
    ...plan,
  };
}
