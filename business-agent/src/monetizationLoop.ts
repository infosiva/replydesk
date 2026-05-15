/**
 * Loop 1 — Daily Monetization Improver
 *
 * Cycles through ALL sites (2-3 per run), applying one NEW revenue action
 * per site per run. Tracks what has already been applied so it never repeats.
 *
 * Revenue action library (ordered by ROI):
 *   1. AdSense script in <head>
 *   2. AdSense display ad unit (responsive banner in page body)
 *   3. Affiliate sidebar / banner (Amazon, Hostinger, Namecheap, etc.)
 *   4. Email capture / newsletter signup section
 *   5. Premium upgrade CTA (one-time payment link)
 *   6. Sponsored content slot (placeholder ready for direct sponsors)
 *   7. "Buy me a coffee" / Ko-fi donation button
 *   8. Social proof + product upsell section
 *   9. Exit-intent popup (email capture on scroll)
 *  10. Related products cross-sell section
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { callAI } from './ai.js';
import { sendTelegram } from './telegram.js';
import {
  SiteConfig, WebsitesConfig, SiteAction, MonetizationLoopRun,
} from './types.js';

const SITES_PER_RUN = 3;
const ADSENSE_PUB = 'ca-pub-4237294630161176';
const ADSENSE_SLOT = '1234567890'; // generic slot — user replaces with real slot ID from AdSense dashboard

// ─── Revenue action definitions ───────────────────────────────────────────────

interface RevenueAction {
  id: string;
  label: string;
  type: 'adsense' | 'affiliate' | 'email' | 'cta' | 'donation' | 'sponsorship' | 'crosssell';
  // Returns null if action cannot be applied (already present / wrong site type)
  apply: (sitePath: string, site: SiteConfig) => { file: string; description: string } | null;
}

const REVENUE_ACTIONS: RevenueAction[] = [

  // ── 1. AdSense script in <head> ─────────────────────────────────────────
  {
    id: 'adsense-head-script',
    label: 'Google AdSense — head script',
    type: 'adsense',
    apply(sitePath, site) {
      const layoutPath = path.join(sitePath, 'app', 'layout.tsx');
      if (!fs.existsSync(layoutPath)) return null;
      const content = fs.readFileSync(layoutPath, 'utf8');
      if (content.includes('adsbygoogle') || content.includes(ADSENSE_PUB)) return null;
      if (!content.includes('</head>')) return null;
      const script = `        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUB}" crossOrigin="anonymous"></script>`;
      const updated = content.replace('</head>', `${script}\n      </head>`);
      fs.writeFileSync(layoutPath, updated, 'utf8');
      return { file: 'app/layout.tsx', description: 'Added Google AdSense <head> script' };
    },
  },

  // ── 2. AdSense display ad component ────────────────────────────────────
  {
    id: 'adsense-display-unit',
    label: 'Google AdSense — responsive display unit component',
    type: 'adsense',
    apply(sitePath) {
      const compPath = path.join(sitePath, 'components', 'AdBanner.tsx');
      if (fs.existsSync(compPath)) return null;
      fs.mkdirSync(path.dirname(compPath), { recursive: true });
      fs.writeFileSync(compPath, `'use client';
import { useEffect } from 'react';

declare global {
  interface Window { adsbygoogle: unknown[] }
}

export default function AdBanner() {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, []);

  return (
    <div className="flex justify-center my-4 min-h-[90px]">
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', maxWidth: '728px', height: '90px' }}
        data-ad-client="${ADSENSE_PUB}"
        data-ad-slot="${ADSENSE_SLOT}"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
`, 'utf8');
      return { file: 'components/AdBanner.tsx', description: 'Added responsive AdSense display unit component' };
    },
  },

  // ── 3. Affiliate banner component (Hostinger) ───────────────────────────
  {
    id: 'affiliate-hostinger',
    label: 'Affiliate — Hostinger hosting banner',
    type: 'affiliate',
    apply(sitePath) {
      const compPath = path.join(sitePath, 'components', 'AffiliateBanner.tsx');
      if (fs.existsSync(compPath)) return null;
      fs.mkdirSync(path.dirname(compPath), { recursive: true });
      fs.writeFileSync(compPath, `export default function AffiliateBanner() {
  return (
    <div className="my-6 rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-900/20 to-purple-900/20 p-4 text-center text-sm">
      <p className="mb-2 font-semibold text-violet-300">
        Host your own AI app for just $2.99/mo
      </p>
      <a
        href="https://hostinger.com?REFERRALCODE=SIVAPRAKASAM"
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="inline-block rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 transition-colors"
      >
        Get Hostinger →
      </a>
      <p className="mt-1 text-xs text-gray-500">Sponsored · We earn a commission</p>
    </div>
  );
}
`, 'utf8');
      return { file: 'components/AffiliateBanner.tsx', description: 'Added Hostinger affiliate banner component' };
    },
  },

  // ── 4. Newsletter / email capture section ───────────────────────────────
  {
    id: 'email-capture',
    label: 'Email capture — newsletter signup section',
    type: 'email',
    apply(sitePath) {
      const compPath = path.join(sitePath, 'components', 'NewsletterSignup.tsx');
      if (fs.existsSync(compPath)) return null;
      fs.mkdirSync(path.dirname(compPath), { recursive: true });
      fs.writeFileSync(compPath, `'use client';
import { useState } from 'react';

export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    // TODO: connect to your email provider (Mailchimp, ConvertKit, etc.)
    // For now, log to console and show success
    console.log('Newsletter signup:', email);
    setDone(true);
  }

  return (
    <section className="my-10 rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur">
      <h3 className="mb-2 text-xl font-bold">Get weekly AI tips</h3>
      <p className="mb-6 text-sm text-gray-400">No spam. Unsubscribe anytime.</p>
      {done ? (
        <p className="font-semibold text-green-400">You are on the list!</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full max-w-xs rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm outline-none focus:border-violet-500 sm:w-auto"
          />
          <button
            type="submit"
            className="rounded-lg bg-violet-600 px-6 py-2 text-sm font-bold text-white hover:bg-violet-500 transition-colors"
          >
            Subscribe Free
          </button>
        </form>
      )}
    </section>
  );
}
`, 'utf8');
      return { file: 'components/NewsletterSignup.tsx', description: 'Added email capture / newsletter signup component' };
    },
  },

  // ── 5. Premium upgrade CTA ──────────────────────────────────────────────
  {
    id: 'premium-cta',
    label: 'Premium upgrade CTA — one-time payment',
    type: 'cta',
    apply(sitePath) {
      const compPath = path.join(sitePath, 'components', 'UpgradeCTA.tsx');
      if (fs.existsSync(compPath)) return null;
      fs.mkdirSync(path.dirname(compPath), { recursive: true });
      fs.writeFileSync(compPath, `export default function UpgradeCTA() {
  return (
    <section className="my-8 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-900/20 to-orange-900/20 p-6 text-center">
      <div className="mb-3 inline-block rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-400">
        PRO
      </div>
      <h3 className="mb-2 text-lg font-bold">Unlock everything — one-time $9</h3>
      <ul className="mb-4 space-y-1 text-sm text-gray-300">
        <li>No ads · Unlimited access · Priority support</li>
      </ul>
      <a
        href="https://buy.stripe.com/placeholder"
        target="_blank"
        rel="noopener"
        className="inline-block rounded-xl bg-amber-500 px-8 py-3 font-bold text-black hover:bg-amber-400 transition-colors"
      >
        Get Pro — $9 one-time
      </a>
      <p className="mt-2 text-xs text-gray-500">Secure payment via Stripe · 30-day refund</p>
    </section>
  );
}
`, 'utf8');
      return { file: 'components/UpgradeCTA.tsx', description: 'Added one-time premium upgrade CTA ($9)' };
    },
  },

  // ── 6. "Buy me a coffee" / Ko-fi button ────────────────────────────────
  {
    id: 'kofi-donation',
    label: 'Ko-fi donation button',
    type: 'donation',
    apply(sitePath) {
      const compPath = path.join(sitePath, 'components', 'DonationButton.tsx');
      if (fs.existsSync(compPath)) return null;
      fs.mkdirSync(path.dirname(compPath), { recursive: true });
      fs.writeFileSync(compPath, `export default function DonationButton() {
  return (
    <div className="my-4 flex justify-center">
      <a
        href="https://ko-fi.com/sivaprakasam"
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-2 rounded-xl bg-[#FF5E5B] px-5 py-2 text-sm font-bold text-white hover:opacity-90 transition-opacity"
      >
        <span>Support this project</span>
      </a>
    </div>
  );
}
`, 'utf8');
      return { file: 'components/DonationButton.tsx', description: 'Added Ko-fi donation button' };
    },
  },

  // ── 7. Sponsored slot placeholder ──────────────────────────────────────
  {
    id: 'sponsored-slot',
    label: 'Sponsored content slot (direct ad placeholder)',
    type: 'sponsorship',
    apply(sitePath) {
      const compPath = path.join(sitePath, 'components', 'SponsoredSlot.tsx');
      if (fs.existsSync(compPath)) return null;
      fs.mkdirSync(path.dirname(compPath), { recursive: true });
      fs.writeFileSync(compPath, `export default function SponsoredSlot() {
  // Replace this with your actual sponsor's content or hide if no sponsor
  const sponsor = {
    name: 'Your Brand Here',
    tagline: 'Reach thousands of AI-focused users',
    url: 'mailto:info.siva@gmail.com?subject=Sponsorship',
    cta: 'Sponsor this site →',
  };

  return (
    <div className="my-6 rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-5 py-4 text-sm">
      <span className="mr-2 text-xs font-bold uppercase tracking-widest text-cyan-600">Sponsored</span>
      <span className="font-semibold text-cyan-300">{sponsor.name}</span>
      <span className="mx-2 text-gray-500">·</span>
      <span className="text-gray-400">{sponsor.tagline}</span>
      <a
        href={sponsor.url}
        target="_blank"
        rel="noopener sponsored"
        className="ml-3 text-cyan-400 underline hover:text-cyan-300"
      >
        {sponsor.cta}
      </a>
    </div>
  );
}
`, 'utf8');
      return { file: 'components/SponsoredSlot.tsx', description: 'Added sponsored content slot (email link for direct sponsors)' };
    },
  },

  // ── 8. Related products cross-sell ─────────────────────────────────────
  {
    id: 'crosssell-products',
    label: 'Cross-sell — related AI products section',
    type: 'crosssell',
    apply(sitePath) {
      const compPath = path.join(sitePath, 'components', 'RelatedProducts.tsx');
      if (fs.existsSync(compPath)) return null;
      fs.mkdirSync(path.dirname(compPath), { recursive: true });
      fs.writeFileSync(compPath, `const PRODUCTS = [
  { name: 'Kwizzo', tagline: 'AI family quiz game', url: 'https://kwizzo.app' },
  { name: 'Tutiq', tagline: 'AI personal tutor', url: 'https://tutiq.app' },
  { name: 'QuizBites', tagline: 'Live classroom quiz', url: 'https://quizbites.app' },
  { name: 'InvoiceMint', tagline: 'AI invoice generator', url: 'https://invoicemint.cloud' },
  { name: 'AI Jobs Portal', tagline: 'Find AI jobs', url: 'https://www.aijobsportal.app' },
];

export default function RelatedProducts() {
  return (
    <section className="my-8">
      <h4 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-500">
        More free AI tools
      </h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PRODUCTS.map(p => (
          <a
            key={p.url}
            href={p.url}
            target="_blank"
            rel="noopener"
            className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm hover:border-violet-500/40 hover:bg-violet-900/10 transition-all"
          >
            <div className="font-semibold">{p.name}</div>
            <div className="text-xs text-gray-500">{p.tagline}</div>
          </a>
        ))}
      </div>
    </section>
  );
}
`, 'utf8');
      return { file: 'components/RelatedProducts.tsx', description: 'Added cross-sell section linking all AI products (internal traffic boost)' };
    },
  },
];

// ─── Apply next un-applied action for a site ──────────────────────────────────

function getAppliedActions(stateActions: SiteAction[]): Set<string> {
  return new Set(
    stateActions
      .filter(a => a.status === 'success')
      .map(a => a.actionId)
      .filter(Boolean) as string[]
  );
}

function pickNextAction(
  site: SiteConfig,
  appliedIds: Set<string>,
): RevenueAction | null {
  for (const action of REVENUE_ACTIONS) {
    if (!appliedIds.has(action.id)) {
      return action;
    }
  }
  return null; // all actions applied for this site
}

// ─── AI brainstorm: generate a NEW site-specific monetization idea ─────────────

async function aiGenerateCustomAction(site: SiteConfig): Promise<{ file: string; content: string; description: string } | null> {
  const system = `You are a monetization expert who adds small, safe, additive revenue-generating code to Next.js websites.
NEVER delete or restructure existing code. NEVER use backticks in your JSON values.
Return ONLY valid JSON.`;

  const prompt = `Site: ${site.name} (${site.url})
Focus: ${site.focus.join(', ')}
Type: ${site.type}

All standard monetization components have been added. Now think creatively:
What is ONE unique, site-specific monetization element we could add?
Examples: a tool-specific affiliate program, a niche-specific premium feature, a viral sharing incentive, a data export upsell.

Return JSON (use double quotes, NO backticks in values):
{
  "file": "components/CustomMonetization.tsx",
  "description": "Short description of what this adds",
  "content": "full TSX component code as a string (escape quotes with backslash, no backticks)"
}`;

  try {
    const { text, provider } = await callAI(system, prompt, 1500);
    console.log(`    [AI custom action from: ${provider}]`);
    const cleaned = text.replace(/`/g, "'");
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return parsed;
  } catch {
    return null;
  }
}

// ─── Git ──────────────────────────────────────────────────────────────────────

function gitCommitAndPush(repoPath: string, message: string): string {
  const opts = { cwd: repoPath, stdio: 'pipe' as const, timeout: 90_000 };
  // Fetch remote changes before we commit so rebase has the latest
  try { execSync('git fetch origin', opts); } catch {}
  try { execSync('git rebase origin/main', opts); } catch {}
  execSync('git add -A', opts);
  execSync(`git commit -m "${message.replace(/"/g, "'")}"`, opts);
  // Rebase our commit on top of any remote commits, then push
  try { execSync('git pull --rebase origin main', opts); } catch {}
  execSync('git push origin main', opts);
  return execSync('git rev-parse --short HEAD', opts).toString().trim();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runMonetizationLoop(
  runIndex: number,
  previousActions: SiteAction[],
): Promise<MonetizationLoopRun> {
  const runId = `mon-${Date.now()}`;
  console.log(`\n[Loop 1] Monetization Improver (run ${runId})`);

  const run: MonetizationLoopRun = {
    id: runId,
    startedAt: new Date().toISOString(),
    status: 'running',
    sitesProcessed: 0,
    actionsApplied: 0,
    actions: [],
  };

  try {
    const raw = fs.readFileSync('/root/site-watchdog/websites.config.json', 'utf8');
    const config: WebsitesConfig = JSON.parse(raw);

    // Only nextjs sites that exist on disk
    const eligible = config.sites.filter(s =>
      s.type === 'nextjs' &&
      fs.existsSync(s.path) &&
      fs.existsSync(path.join(s.path, 'app'))
    );

    // Rotate through sites
    const start = (runIndex * SITES_PER_RUN) % Math.max(eligible.length, 1);
    const batch: SiteConfig[] = [];
    for (let i = 0; i < SITES_PER_RUN && i < eligible.length; i++) {
      batch.push(eligible[(start + i) % eligible.length]);
    }

    console.log(`    Processing: ${batch.map(s => s.name).join(', ')}`);

    for (const site of batch) {
      const action: SiteAction = {
        siteId: site.id,
        siteName: site.name,
        url: site.url,
        actionType: 'other',
        actionId: '',
        description: '',
        filesChanged: [],
        status: 'skipped',
        implementedAt: new Date().toISOString(),
      };

      try {
        console.log(`\n  → ${site.name}`);

        // Get applied actions for this site from history
        const siteHistory = previousActions.filter(a => a.siteId === site.id);
        const appliedIds = getAppliedActions(siteHistory);
        console.log(`    Applied so far: ${appliedIds.size}/${REVENUE_ACTIONS.length} standard actions`);

        const nextAction = pickNextAction(site, appliedIds);

        if (nextAction) {
          // Apply standard revenue action
          console.log(`    Applying: ${nextAction.label}`);
          const result = nextAction.apply(site.path, site);

          // Always record the actionId regardless — so we advance past it next run
          action.actionId = nextAction.id;
          if (result) {
            action.actionType = nextAction.type;
            action.description = result.description;
            action.filesChanged = [result.file];
            action.status = 'success';
          } else {
            action.description = `${nextAction.label} — already present, advancing`;
            action.status = 'success'; // treat as done so we advance to next action
            action.filesChanged = [];
          }
        } else {
          // All standard actions applied — use AI to invent something new
          console.log(`    All standard actions applied — asking AI for custom idea`);
          const custom = await aiGenerateCustomAction(site);
          if (custom) {
            const filePath = path.join(site.path, custom.file);
            if (!fs.existsSync(filePath)) {
              fs.mkdirSync(path.dirname(filePath), { recursive: true });
              fs.writeFileSync(filePath, custom.content, 'utf8');
              action.actionId = `custom-${Date.now()}`;
              action.actionType = 'other';
              action.description = custom.description;
              action.filesChanged = [custom.file];
              action.status = 'success';
            } else {
              action.description = 'Custom file already exists';
              action.status = 'skipped';
            }
          }
        }

        // Push if we actually changed something
        if (action.status === 'success' && action.filesChanged.length > 0) {
          try {
            const msg = `chore(monetize): ${action.description} [business-agent]`;
            action.commitHash = gitCommitAndPush(site.path, msg);
            run.actionsApplied++;
            console.log(`    Pushed ${action.commitHash} — ${action.description}`);
            await sendTelegram(
              `<b>Business Agent — Revenue Action</b>\n` +
              `<b>${site.name}</b> · <a href="${site.url}">${site.url}</a>\n` +
              `Action: ${action.description}\n` +
              `Commit: <code>${action.commitHash}</code>`
            );
          } catch (gitErr: any) {
            console.error(`    Git push failed: ${gitErr.message.slice(0, 100)}`);
            action.status = 'failed';
            action.error = gitErr.message.slice(0, 200);
          }
        } else {
          console.log(`    Skipped (${action.description})`);
        }
      } catch (siteErr: any) {
        console.error(`    Site ${site.id} error: ${siteErr.message}`);
        action.status = 'failed';
        action.error = siteErr.message.slice(0, 200);
      }

      run.actions.push(action);
      run.sitesProcessed++;
    }

    run.status = 'completed';
    run.completedAt = new Date().toISOString();
    console.log(`\n[Loop 1] Done. ${run.actionsApplied} actions applied across ${run.sitesProcessed} sites.`);

  } catch (err: any) {
    run.status = 'error';
    run.error = err.message;
    run.completedAt = new Date().toISOString();
  }

  return run;
}
