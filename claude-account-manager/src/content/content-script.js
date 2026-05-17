// Runs on claude.ai — scrapes usage, detects rate limits, logs conversations

(async function () {
  let lastConvUrl = "";

  // ── 1. Detect current logged-in email ─────────────────────────────────────
  function getAccountEmail() {
    // Try meta or profile elements claude.ai renders
    const emailEl = document.querySelector('[data-testid="user-email"], .user-email');
    if (emailEl) return emailEl.textContent.trim();
    // Fallback: look in page JSON blobs (Next.js __NEXT_DATA__)
    try {
      const nd = document.getElementById("__NEXT_DATA__");
      if (nd) {
        const parsed = JSON.parse(nd.textContent);
        return parsed?.props?.pageProps?.user?.email || "";
      }
    } catch (_) {}
    return "";
  }

  // ── 2. Scrape usage from /settings/usage ──────────────────────────────────
  async function scrapeUsage() {
    if (!location.pathname.startsWith("/settings")) return;

    const progressEl = document.querySelector('[role="progressbar"], .usage-progress, [data-testid="usage-bar"]');
    if (!progressEl) return;

    const valuenow = progressEl.getAttribute("aria-valuenow");
    const valuemax = progressEl.getAttribute("aria-valuemax") || "100";
    if (!valuenow) return;

    const usedPct = parseFloat(valuenow) / parseFloat(valuemax);
    const email = getAccountEmail();

    // Try to read plan + billing date from page text
    const pageText = document.body.innerText;
    const planMatch = pageText.match(/(Pro|Max 5×?|Max 20×?|Free)\s+plan/i);
    const planLabel = planMatch ? planMatch[1] : "Unknown";
    const resetMatch = pageText.match(/resets?\s+(?:on\s+)?(\w+ \d+)/i);
    const billingResetDate = resetMatch ? resetMatch[1] : null;

    chrome.runtime.sendMessage({
      type: "USAGE_SCRAPED",
      payload: { accountEmail: email, usedPct, planLabel, billingResetDate },
    });
  }

  // ── 3. Detect rate limit / over-limit UI ─────────────────────────────────
  function detectRateLimit() {
    const bodyText = document.body.innerText;
    const patterns = [
      /you've reached your (usage |message )?limit/i,
      /try again in/i,
      /you are being rate.?limited/i,
      /upgrade your plan to continue/i,
      /usage limit reached/i,
    ];
    if (patterns.some(p => p.test(bodyText))) {
      chrome.runtime.sendMessage({
        type: "RATE_LIMITED",
        payload: {
          accountEmail: getAccountEmail(),
          message: "Claude is rate-limited on this account.",
        },
      });
    }
  }

  // ── 4. Log conversation title ─────────────────────────────────────────────
  function logCurrentConversation() {
    const url = location.href;
    if (url === lastConvUrl) return;
    if (!url.includes("/chat/") && !url.match(/claude\.ai\/\w{8,}/)) return;
    lastConvUrl = url;

    const titleEl = document.querySelector('h1, [data-testid="conversation-title"], title');
    const title = titleEl?.textContent?.trim() || document.title || "Untitled";

    chrome.runtime.sendMessage({
      type: "CONVERSATION_SEEN",
      payload: { title, url, accountEmail: getAccountEmail() },
    });
  }

  // ── 5. Inject floating status badge ──────────────────────────────────────
  function injectBadge(accounts) {
    if (document.getElementById("cam-badge")) return;
    if (!accounts || accounts.length === 0) return;

    // Find best next account (lowest usage)
    const sorted = [...accounts].sort((a, b) => (a.usedPct || 0) - (b.usedPct || 0));
    const best = sorted[0];
    const currentEmail = getAccountEmail();
    const current = accounts.find(a => a.email === currentEmail);

    const pct = current ? Math.round((current.usedPct || 0) * 100) : null;
    const color = pct == null ? "#6366f1" : pct >= 80 ? "#ef4444" : pct >= 60 ? "#f59e0b" : "#22c55e";

    const badge = document.createElement("div");
    badge.id = "cam-badge";
    badge.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 99999;
      background: #111827; border: 1px solid #1f2937;
      border-radius: 12px; padding: 8px 12px;
      display: flex; align-items: center; gap: 8px;
      font-family: -apple-system, sans-serif; font-size: 12px;
      color: #f9fafb; cursor: pointer; box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      transition: opacity 0.2s;
    `;

    badge.innerHTML = `
      <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span>
      <span>${pct != null ? `${pct}% used` : "CAM"}</span>
      ${pct >= 80 ? `<span style="color:#f59e0b;font-size:10px;">→ ${best.label}</span>` : ""}
    `;

    badge.title = "Claude Account Manager — click to open popup";
    badge.addEventListener("click", () => chrome.runtime.sendMessage({ type: "OPEN_POPUP" }));
    document.body.appendChild(badge);
  }

  // ── Run ───────────────────────────────────────────────────────────────────
  async function run() {
    scrapeUsage();
    detectRateLimit();
    logCurrentConversation();

    chrome.runtime.sendMessage({ type: "GET_ACCOUNTS" }, (accounts) => {
      if (chrome.runtime.lastError) return;
      injectBadge(accounts);
    });
  }

  // Initial run after short delay (let react render)
  setTimeout(run, 1500);

  // Watch for SPA navigation
  let lastHref = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      setTimeout(run, 800);
    }
    detectRateLimit();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
