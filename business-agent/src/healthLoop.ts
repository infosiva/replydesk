/**
 * Loop 3 — Site Health Monitor & Monetization Researcher
 *
 * Runs every 6 hours. For each site in websites.config.json:
 *   1. HTTP check — measure status + response time
 *   2. If down/broken → AI diagnoses and attempts a code fix
 *   3. AI researches 2-3 fresh monetization angles for the site
 *
 * After all sites:
 *   4. Cross-site research — finds broader trends / new revenue ideas
 *   5. Telegram summary
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { callAI, parseJSON } from './ai.js';
import { sendTelegram } from './telegram.js';
import {
  SiteConfig, WebsitesConfig, SiteHealthResult, HealthLoopRun,
} from './types.js';

// ── HTTP health check ─────────────────────────────────────────────────────────

async function checkSiteHealth(site: SiteConfig): Promise<{ status: number | null; ms: number | null; body: string }> {
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(site.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'business-agent-healthcheck/1.0' },
      redirect: 'follow',
    });
    clearTimeout(timer);
    const ms = Date.now() - start;
    const body = await res.text().catch(() => '');
    return { status: res.status, ms, body };
  } catch {
    return { status: null, ms: null, body: '' };
  }
}

function detectError(status: number | null, body: string): string | null {
  if (status === null) return 'Site unreachable (timeout or DNS failure)';
  if (status >= 500) return `Server error HTTP ${status}`;
  if (status === 404) return 'HTTP 404 — page not found';
  if (status === 403) return 'HTTP 403 — forbidden';
  // Detect Next.js runtime errors in body
  if (body.includes('Application error') || body.includes('Internal Server Error')) {
    return 'Next.js runtime error in page body';
  }
  if (body.includes('NEXT_NOT_FOUND') || body.includes('404') && body.length < 500) {
    return 'Blank/minimal 404 response';
  }
  return null;
}

// ── AI diagnosis + fix ────────────────────────────────────────────────────────

async function aiDiagnoseAndFix(
  site: SiteConfig,
  error: string,
  bodySnippet: string,
): Promise<{ file: string; content: string; description: string } | null> {
  if (site.type !== 'nextjs') return null; // can only patch nextjs repos

  // Gather some file context
  const layoutPath = path.join(site.path, 'app', 'layout.tsx');
  const pagePath   = path.join(site.path, 'app', 'page.tsx');
  let ctx = '';
  try { ctx += `\n\nlayout.tsx (first 80 lines):\n${fs.readFileSync(layoutPath, 'utf8').split('\n').slice(0, 80).join('\n')}`; } catch {}
  try { ctx += `\n\npage.tsx (first 80 lines):\n${fs.readFileSync(pagePath, 'utf8').split('\n').slice(0, 80).join('\n')}`; } catch {}

  const system = `You are a Next.js 15 debugging expert. Diagnose and fix site errors.
Return ONLY valid JSON. No markdown fences, no backticks in values.`;

  const prompt = `Site: ${site.name} (${site.url})
Error: ${error}
HTTP body snippet (first 500 chars): ${bodySnippet.slice(0, 500)}
${ctx}

Identify the most likely cause and propose ONE minimal safe fix.
Return JSON:
{
  "cause": "root cause in one sentence",
  "file": "relative path to file to create/patch (e.g. app/error.tsx)",
  "description": "what this fix does",
  "content": "complete file content (escape all quotes with backslash, no backtick chars)"
}

If you cannot safely fix it (e.g. needs env vars or external config), return:
{ "cause": "...", "file": "", "description": "Manual fix required: ...", "content": "" }`;

  try {
    const { text, provider } = await callAI(system, prompt, 2000);
    console.log(`    [AI diagnosis from: ${provider}]`);
    const cleaned = text.replace(/`/g, "'");
    const parsed = parseJSON<{ cause: string; file: string; description: string; content: string }>(cleaned);
    if (!parsed.file || !parsed.content) return null;
    return { file: parsed.file, content: parsed.content, description: parsed.description };
  } catch {
    return null;
  }
}

// ── AI monetization research ──────────────────────────────────────────────────

async function aiMonetizationResearch(site: SiteConfig): Promise<string[]> {
  const system = `You are a monetization strategist who finds creative, practical revenue ideas for web products.
Be specific and actionable. Return ONLY valid JSON.`;

  const prompt = `Site: ${site.name}
URL: ${site.url}
Focus: ${site.focus?.join(', ') || 'general'}
Type: ${site.type}

Research 3 fresh, specific monetization ideas for this site that could generate real income.
Think beyond generic ads — consider:
- Niche affiliate programs that fit the site's topic
- Premium features or data the audience would pay for
- Partnerships or sponsorships in the site's specific industry
- Digital products (templates, guides, courses) that match the audience
- Newsletter monetisation (paid issues, sponsor slots)

Return JSON: { "ideas": ["idea 1 (1-2 sentences, be specific)", "idea 2", "idea 3"] }`;

  try {
    const { text, provider } = await callAI(system, prompt, 800);
    console.log(`    [AI monetization research from: ${provider}]`);
    const cleaned = text.replace(/`/g, "'");
    const parsed = parseJSON<{ ideas: string[] }>(cleaned);
    return parsed.ideas || [];
  } catch {
    return [];
  }
}

// ── Cross-site monetization trends ────────────────────────────────────────────

async function aiCrossSiteResearch(sites: SiteConfig[]): Promise<string[]> {
  const system = `You are a digital business strategist who researches emerging monetization trends.
Return ONLY valid JSON.`;

  const siteList = sites.map(s => `- ${s.name} (${s.focus?.join(', ') || s.id})`).join('\n');

  const prompt = `We run a portfolio of ${sites.length} web products:
${siteList}

Research 5 cross-cutting monetization opportunities that could apply across multiple sites:
- Emerging ad networks better than AdSense (e.g. Ezoic, Mediavine, AdThrive requirements)
- Affiliate programs with high EPC in our niches
- SaaS tools we could build to serve our existing audiences
- Content strategies that unlock higher RPM
- Bundle or cross-sell opportunities between our products

Return JSON: { "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"] }`;

  try {
    const { text, provider } = await callAI(system, prompt, 1200);
    console.log(`    [Cross-site research from: ${provider}]`);
    const cleaned = text.replace(/`/g, "'");
    const parsed = parseJSON<{ insights: string[] }>(cleaned);
    return parsed.insights || [];
  } catch {
    return [];
  }
}

// ── Git helper ────────────────────────────────────────────────────────────────

function gitCommitAndPush(repoPath: string, message: string): string {
  const opts = { cwd: repoPath, stdio: 'pipe' as const, timeout: 90_000 };
  try { execSync('git fetch origin', opts); } catch {}
  try { execSync('git rebase origin/main', opts); } catch {}
  execSync('git add -A', opts);
  execSync(`git commit -m "${message.replace(/"/g, "'")}"`, opts);
  try { execSync('git pull --rebase origin main', opts); } catch {}
  execSync('git push origin main', opts);
  return execSync('git rev-parse --short HEAD', opts).toString().trim();
}

// ── Main loop ─────────────────────────────────────────────────────────────────

export async function runHealthLoop(): Promise<HealthLoopRun> {
  const runId = `health-${Date.now()}`;
  console.log(`\n[Loop 3] Health Monitor starting (run ${runId})`);

  const run: HealthLoopRun = {
    id: runId,
    startedAt: new Date().toISOString(),
    status: 'running',
    sitesChecked: 0,
    sitesDown: 0,
    fixesApplied: 0,
    results: [],
    newMonetizationIdeas: [],
  };

  try {
    const raw = fs.readFileSync('/root/site-watchdog/websites.config.json', 'utf8');
    const config: WebsitesConfig = JSON.parse(raw);
    const sites = config.sites;

    console.log(`  Checking ${sites.length} sites...`);

    for (const site of sites) {
      console.log(`\n  → ${site.name} (${site.url})`);

      const result: SiteHealthResult = {
        siteId: site.id,
        siteName: site.name,
        url: site.url,
        httpStatus: null,
        responseTimeMs: null,
        isUp: false,
        errorDetected: null,
        fixApplied: null,
        monetizationInsights: [],
        checkedAt: new Date().toISOString(),
      };

      // 1. HTTP check
      const { status, ms, body } = await checkSiteHealth(site);
      result.httpStatus = status;
      result.responseTimeMs = ms;
      result.isUp = status !== null && status < 400;

      const statusIcon = result.isUp ? '✓' : '✗';
      console.log(`    ${statusIcon} HTTP ${status ?? 'timeout'} in ${ms ?? '?'}ms`);

      // 2. Detect errors
      const err = detectError(status, body);
      result.errorDetected = err;

      if (err) {
        run.sitesDown++;
        console.log(`    Error: ${err}`);

        // Attempt AI fix if it's a nextjs site with a local repo
        if (site.type === 'nextjs' && fs.existsSync(path.join(site.path, 'app'))) {
          console.log(`    Attempting AI fix...`);
          const fix = await aiDiagnoseAndFix(site, err, body);
          if (fix && fix.file && fix.content) {
            try {
              const filePath = path.join(site.path, fix.file);
              fs.mkdirSync(path.dirname(filePath), { recursive: true });
              fs.writeFileSync(filePath, fix.content, 'utf8');
              const hash = gitCommitAndPush(site.path, `fix(health): ${fix.description} [business-agent]`);
              result.fixApplied = fix.description;
              result.fixCommitHash = hash;
              run.fixesApplied++;
              console.log(`    Fix applied & pushed: ${fix.description} (${hash})`);
            } catch (e: any) {
              console.error(`    Fix failed: ${e.message.slice(0, 100)}`);
            }
          } else if (fix) {
            console.log(`    Manual fix needed: ${fix.description}`);
            result.fixApplied = `Manual: ${fix.description}`;
          }
        }
      }

      // 3. Monetization research (for all sites, not just broken ones)
      const ideas = await aiMonetizationResearch(site);
      result.monetizationInsights = ideas;
      if (ideas.length) {
        console.log(`    Monetization ideas: ${ideas.length} found`);
      }

      run.results.push(result);
      run.sitesChecked++;
    }

    // 4. Cross-site research
    console.log(`\n  Running cross-site monetization research...`);
    const crossInsights = await aiCrossSiteResearch(sites);
    run.newMonetizationIdeas = crossInsights;
    console.log(`  Cross-site insights: ${crossInsights.length}`);

    // 5. Telegram summary
    const downSites = run.results.filter(r => !r.isUp);
    const upSites   = run.results.filter(r => r.isUp);

    let msg = `<b>Business Agent — Health Report</b>\n`;
    msg += `<b>${upSites.length}/${run.sitesChecked} sites up</b>`;
    if (downSites.length) {
      msg += `\n\n<b>⚠️ Down/Broken:</b>\n`;
      for (const r of downSites) {
        msg += `• ${r.siteName} — ${r.errorDetected}`;
        if (r.fixApplied) msg += ` → Fixed: ${r.fixApplied}`;
        msg += '\n';
      }
    }
    if (crossInsights.length) {
      msg += `\n<b>💡 Monetization Research:</b>\n`;
      for (const insight of crossInsights.slice(0, 3)) {
        msg += `• ${insight.slice(0, 120)}\n`;
      }
    }
    await sendTelegram(msg);

    run.status = 'completed';
    run.completedAt = new Date().toISOString();
    console.log(`\n[Loop 3] Done. ${run.sitesChecked} checked, ${run.sitesDown} issues, ${run.fixesApplied} fixes.`);

  } catch (err: any) {
    console.error(`\n[Loop 3] Fatal error: ${err.message}`);
    run.status = 'error';
    run.error = err.message;
    run.completedAt = new Date().toISOString();
  }

  return run;
}
