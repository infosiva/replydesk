/**
 * Tester sub-agent — verifies a site after deployment.
 * Checks: HTTP status, page title, no JS errors, key content present.
 * Reports results and flags issues via Telegram.
 */

import { SiteConfig } from './types.js';

export interface TestResult {
  passed: boolean;
  checks: TestCheck[];
  summary: string;
}

interface TestCheck {
  name: string;
  passed: boolean;
  detail: string;
}

async function fetchWithTimeout(url: string, ms = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function testSite(site: SiteConfig, deployUrl: string): Promise<TestResult> {
  console.log(`\n🧪 Testing ${site.name} at ${deployUrl}...`);
  const checks: TestCheck[] = [];

  // ── 1. HTTP Status ────────────────────────────────────────────────────────
  try {
    const res = await fetchWithTimeout(deployUrl);
    const ok = res.status >= 200 && res.status < 400;
    checks.push({ name: 'HTTP status', passed: ok, detail: `${res.status} ${res.statusText}` });

    const html = await res.text();

    // ── 2. Page has <title> ───────────────────────────────────────────────
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const hasTitle = !!titleMatch;
    checks.push({ name: 'Page title', passed: hasTitle, detail: titleMatch?.[1]?.slice(0, 60) || 'missing' });

    // ── 3. Has meta description ──────────────────────────────────────────
    const hasMeta = /<meta[^>]+name="description"[^>]+>/i.test(html);
    checks.push({ name: 'Meta description', passed: hasMeta, detail: hasMeta ? 'present' : 'missing' });

    // ── 4. No obvious server errors in body ──────────────────────────────
    const hasError = /application error|internal server error|500|runtime error/i.test(html.slice(0, 2000));
    checks.push({ name: 'No server errors', passed: !hasError, detail: hasError ? 'ERROR in page body' : 'clean' });

    // ── 5. Page size reasonable (>5KB = has content) ─────────────────────
    const sizeKb = Math.round(html.length / 1024);
    const hasContent = html.length > 5000;
    checks.push({ name: 'Content size', passed: hasContent, detail: `${sizeKb} KB` });

    // ── 6. Canonical / OG tags (SEO check) ───────────────────────────────
    const hasOg = /<meta[^>]+property="og:/i.test(html);
    checks.push({ name: 'OG tags', passed: hasOg, detail: hasOg ? 'present' : 'missing (SEO gap)' });

    // ── 7. YouTube CTA (if applicable) ───────────────────────────────────
    if (site.youtubeChannel) {
      const hasYt = html.includes('youtube.com') || html.includes('YouTube');
      checks.push({ name: 'YouTube link', passed: hasYt, detail: hasYt ? 'found' : `missing — ${site.youtubeChannel}` });
    }

  } catch (e: any) {
    checks.push({ name: 'HTTP fetch', passed: false, detail: e.message?.slice(0, 80) || 'failed' });
  }

  const passed = checks.every(c => c.passed);
  const failCount = checks.filter(c => !c.passed).length;
  const summary = passed
    ? `All ${checks.length} checks passed`
    : `${failCount}/${checks.length} checks failed`;

  console.log(`  ${passed ? '✅' : '⚠️'} ${summary}`);
  checks.forEach(c => console.log(`    ${c.passed ? '✓' : '✗'} ${c.name}: ${c.detail}`));

  return { passed, checks, summary };
}

export function formatTestReport(result: TestResult): string {
  const icon = result.passed ? '✅' : '⚠️';
  const lines = result.checks.map(c =>
    `  ${c.passed ? '✓' : '✗'} ${c.name}: ${c.detail}`
  ).join('\n');
  return `${icon} *Test Results:* ${result.summary}\n\`\`\`\n${lines}\n\`\`\``;
}
