/**
 * News Spin Loop
 *
 * 1. Fetch RSS feeds → extract trending news items
 * 2. Match each item to relevant sites
 * 3. AI rewrites each item as a unique SEO article per site
 * 4. Appends the article to the site's content data file
 * 5. Commits & pushes to GitHub → auto-deploys via Vercel
 * 6. Sends Telegram summary
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { callAI, parseJSON } from './ai.js';
import { SITES, RSS_FEEDS } from './sites.js';
import { NewsItem, SpunArticle, SpinRun, SiteTarget } from './types.js';

// ── Telegram ─────────────────────────────────────────────────────────────────
async function sendTelegram(msg: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat  = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: msg, parse_mode: 'HTML' }),
    });
  } catch { /* silent */ }
}

// ── Fetch RSS and extract news items ─────────────────────────────────────────
async function fetchNews(): Promise<{ title: string; summary: string; url: string; source: string }[]> {
  const items: { title: string; summary: string; url: string; source: string }[] = [];

  await Promise.allSettled(RSS_FEEDS.map(async feed => {
    try {
      const res = await fetch(feed, {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'news-spin-agent/1.0', 'Accept': 'application/rss+xml, */*' },
      });
      if (!res.ok) return;
      const xml = await res.text();

      // Extract items from RSS
      const itemMatches = xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g);
      for (const item of itemMatches) {
        const body = item[1];
        const title   = (body.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]    ?? '')
          .replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim();
        const desc    = (body.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] ?? '')
          .replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim().slice(0, 300);
        const link    = (body.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1]       ?? '').trim();
        const srcName = feed.replace(/https?:\/\/(www\.)?/, '').split('/')[0];

        if (title.length > 15) {
          items.push({ title, summary: desc, url: link, source: srcName });
        }
      }
    } catch { /* skip this feed */ }
  }));

  // Deduplicate by title prefix (first 40 chars)
  const seen = new Set<string>();
  return items.filter(i => {
    const key = i.title.slice(0, 40).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 80);  // cap at 80 items
}

// ── AI: match news to sites ───────────────────────────────────────────────────
async function matchNewsToSites(
  newsItems: { title: string; summary: string; source: string }[],
): Promise<NewsItem[]> {
  const siteList = SITES.map(s => `${s.id}: ${s.niche} (topics: ${s.topics.join(', ')})`).join('\n');
  const newsList = newsItems.slice(0, 40).map((n, i) => `${i}: "${n.title}" [${n.source}]`).join('\n');

  const system = `You are a content strategist matching news to websites. Return ONLY valid JSON.`;
  const prompt = `Given these websites:
${siteList}

And these news headlines:
${newsList}

For each headline that is genuinely relevant to at least one site, return a match.
A news item is relevant if it fits the site's niche and would interest its audience.
Pick the TOP 10 most relevant matches across all sites.

Return JSON:
{"matches": [{"newsIndex": 0, "siteIds": ["nammatamil"], "relevanceScore": 8}, ...]}

relevanceScore 1-10. Only include scores >= 6.`;

  try {
    const { text } = await callAI(system, prompt, 800);
    const parsed = parseJSON<{ matches: { newsIndex: number; siteIds: string[]; relevanceScore: number }[] }>(text);
    return parsed.matches
      .filter(m => m.relevanceScore >= 6 && newsItems[m.newsIndex])
      .slice(0, 12)
      .map(m => ({
        title: newsItems[m.newsIndex].title,
        summary: newsItems[m.newsIndex].summary,
        url: (newsItems[m.newsIndex] as any).url,
        source: newsItems[m.newsIndex].source,
        publishedAt: new Date().toISOString(),
        relevantSites: m.siteIds,
      }));
  } catch {
    return [];
  }
}

// ── AI: spin article ──────────────────────────────────────────────────────────
async function spinArticle(
  site: SiteTarget,
  news: NewsItem,
): Promise<{ headline: string; slug: string; body: string; metaDescription: string; keywords: string[] } | null> {
  const system = `You are an SEO content writer for ${site.name} (${site.url}).
The site's niche: ${site.niche}.
Write in a helpful, engaging style. Target: English-reading audience interested in ${site.niche}.
Return ONLY valid JSON. No markdown fences.`;

  const prompt = `Write a unique SEO article based on this news:

Headline: ${news.title}
Summary: ${news.summary}
Source: ${news.source}

Requirements:
- Rewrite completely — do NOT copy verbatim. Unique angle for ${site.name}'s audience.
- 150-250 words body
- Include 1-2 natural internal links like [related content](/category/topic)
- SEO-focused, keyword-rich but natural

Return JSON:
{
  "headline": "Your SEO-optimised headline",
  "slug": "url-slug-no-spaces",
  "body": "Full article body in markdown (150-250 words)",
  "metaDescription": "SEO meta description 120-155 chars",
  "keywords": ["kw1", "kw2", "kw3"]
}`;

  try {
    const { text, provider } = await callAI(system, prompt, 1000);
    const parsed = parseJSON<{ headline: string; slug: string; body: string; metaDescription: string; keywords: string[] }>(text);
    if (!parsed.headline || !parsed.body) return null;
    console.log(`    [AI spin from: ${provider}]`);
    return parsed;
  } catch {
    return null;
  }
}

// ── Append article to site data file ─────────────────────────────────────────
function appendArticleToDataFile(site: SiteTarget, article: SpunArticle): boolean {
  const filePath = path.join(site.repoPath, site.contentFile);
  const dir = path.dirname(filePath);

  // Create directory if needed
  if (!fs.existsSync(dir)) return false;

  const entry = `
export const newsArticle_${Date.now()} = {
  slug: ${JSON.stringify(article.slug)},
  headline: ${JSON.stringify(article.headline)},
  metaDescription: ${JSON.stringify(article.metaDescription)},
  keywords: ${JSON.stringify(article.keywords)},
  body: ${JSON.stringify(article.body)},
  publishedAt: ${JSON.stringify(article.spunAt)},
  source: ${JSON.stringify(article.originalNewsUrl)},
};
`;

  // If file doesn't exist, create it with a header
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `// Auto-generated news articles — do not edit manually\n// Generated by news-spin-agent\n${entry}`, 'utf8');
  } else {
    fs.appendFileSync(filePath, entry, 'utf8');
  }

  return true;
}

// ── Git commit and push ───────────────────────────────────────────────────────
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

// ── Main spin loop ────────────────────────────────────────────────────────────
export async function runSpinLoop(): Promise<SpinRun> {
  const runId = `spin-${Date.now()}`;
  console.log(`\n[NewsSpinAgent] Starting run ${runId}`);

  const run: SpinRun = {
    id: runId,
    startedAt: new Date().toISOString(),
    status: 'running',
    newsItemsFound: 0,
    articlesSpun: 0,
    articlesCommitted: 0,
    articles: [],
  };

  try {
    // 1. Fetch news
    console.log('  Fetching RSS feeds…');
    const rawNews = await fetchNews();
    console.log(`  Found ${rawNews.length} raw news items`);

    // 2. Match to sites
    console.log('  Matching news to sites with AI…');
    const matched = await matchNewsToSites(rawNews);
    run.newsItemsFound = matched.length;
    console.log(`  Matched ${matched.length} relevant items`);

    // 3. Spin articles
    const commitQueue = new Map<string, string[]>();  // siteId → commit messages

    for (const news of matched) {
      for (const siteId of news.relevantSites) {
        const site = SITES.find(s => s.id === siteId);
        if (!site) continue;

        // Skip if repo doesn't exist locally
        if (!fs.existsSync(site.repoPath)) {
          console.log(`  [Skip] ${site.id} — repo not found at ${site.repoPath}`);
          continue;
        }

        console.log(`\n  → Spinning for ${site.name}: "${news.title.slice(0, 50)}…"`);
        const spun = await spinArticle(site, news);
        if (!spun) { console.log('    Failed to spin'); continue; }

        const article: SpunArticle = {
          siteId,
          siteName: site.name,
          headline: spun.headline,
          slug: spun.slug,
          body: spun.body,
          metaDescription: spun.metaDescription,
          keywords: spun.keywords,
          originalNewsUrl: news.url,
          originalHeadline: news.title,
          spunAt: new Date().toISOString(),
          provider: 'ai',
          committed: false,
        };

        // Append to data file
        const written = appendArticleToDataFile(site, article);
        if (written) {
          run.articlesSpun++;
          if (!commitQueue.has(siteId)) commitQueue.set(siteId, []);
          commitQueue.get(siteId)!.push(spun.headline);
          article.committed = false;
        }

        run.articles.push(article);
      }
    }

    // 4. Commit & push per site
    for (const [siteId, headlines] of commitQueue) {
      const site = SITES.find(s => s.id === siteId)!;
      try {
        const msg = `content(spin): add ${headlines.length} article(s) — ${headlines[0].slice(0, 60)} [news-spin-agent]`;
        const hash = gitCommitAndPush(site.repoPath, msg);
        // Mark articles as committed
        for (const a of run.articles.filter(a => a.siteId === siteId)) {
          a.committed = true;
          a.commitHash = hash;
        }
        run.articlesCommitted += headlines.length;
        console.log(`  [Git] ${site.name} → ${hash} (${headlines.length} articles)`);
      } catch (e: any) {
        console.error(`  [Git] ${site.name} push failed: ${e.message.slice(0, 100)}`);
      }
    }

    // 5. Telegram summary
    let msg = `<b>News Spin Agent — Run Complete</b>\n`;
    msg += `📰 ${run.newsItemsFound} relevant items → ${run.articlesSpun} articles spun, ${run.articlesCommitted} committed\n`;
    if (run.articles.length > 0) {
      msg += `\n<b>Articles:</b>\n`;
      for (const a of run.articles.slice(0, 5)) {
        msg += `• <b>${a.siteName}</b>: ${a.headline.slice(0, 80)}${a.committed ? ' ✓' : ' ✗'}\n`;
      }
    }
    await sendTelegram(msg);

    run.status = 'completed';
    run.completedAt = new Date().toISOString();
    console.log(`\n[NewsSpinAgent] Done — ${run.articlesSpun} spun, ${run.articlesCommitted} committed`);

  } catch (e: any) {
    console.error(`\n[NewsSpinAgent] Fatal: ${e.message}`);
    run.status = 'error';
    run.error = e.message;
    run.completedAt = new Date().toISOString();
  }

  return run;
}
