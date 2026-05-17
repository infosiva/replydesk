import { STORAGE_KEYS, ALERT_THRESHOLD } from "../shared/constants.js";

// ── Alarm: check usage every 30 min ──────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("usage-check", { periodInMinutes: 30 });
  initDefaultAccounts();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "usage-check") checkAllAccountAlerts();
});

// ── Message bus ──────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case "USAGE_SCRAPED":
      handleUsageScrape(msg.payload).then(sendResponse);
      return true;
    case "RATE_LIMITED":
      handleRateLimit(msg.payload).then(sendResponse);
      return true;
    case "CONVERSATION_SEEN":
      logConversation(msg.payload).then(sendResponse);
      return true;
    case "GET_ACCOUNTS":
      getAccounts().then(sendResponse);
      return true;
    case "SAVE_ACCOUNT":
      saveAccount(msg.payload).then(sendResponse);
      return true;
    case "DELETE_ACCOUNT":
      deleteAccount(msg.payload.id).then(sendResponse);
      return true;
    case "GET_DAILY_LOG":
      getDailyLog().then(sendResponse);
      return true;
    case "OPEN_ACCOUNT":
      openAccount(msg.payload.url);
      sendResponse({ ok: true });
      return false;
  }
});

// ── Account helpers ───────────────────────────────────────────────────────────
async function initDefaultAccounts() {
  const existing = await chrome.storage.local.get(STORAGE_KEYS.accounts);
  if (existing[STORAGE_KEYS.accounts]) return;
  const defaults = [
    { id: "acc1", label: "Account 1 (Personal)", email: "", plan: "pro", usedPct: 0, billingDay: 1, color: "#6366f1", url: "https://claude.ai", lastSeen: null },
    { id: "acc2", label: "Account 2 (Work)", email: "", plan: "pro", usedPct: 0, billingDay: 1, color: "#22c55e", url: "https://claude.ai", lastSeen: null },
    { id: "acc3", label: "Account 3", email: "", plan: "free", usedPct: 0, billingDay: 1, color: "#f59e0b", url: "https://claude.ai", lastSeen: null },
    { id: "acc4", label: "Account 4", email: "", plan: "free", usedPct: 0, billingDay: 1, color: "#ec4899", url: "https://claude.ai", lastSeen: null },
  ];
  await chrome.storage.local.set({ [STORAGE_KEYS.accounts]: defaults });
}

async function getAccounts() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.accounts);
  return data[STORAGE_KEYS.accounts] || [];
}

async function saveAccount(account) {
  const accounts = await getAccounts();
  const idx = accounts.findIndex(a => a.id === account.id);
  if (idx >= 0) accounts[idx] = { ...accounts[idx], ...account };
  else accounts.push({ id: crypto.randomUUID(), ...account });
  await chrome.storage.local.set({ [STORAGE_KEYS.accounts]: accounts });
  return { ok: true };
}

async function deleteAccount(id) {
  const accounts = await getAccounts();
  await chrome.storage.local.set({
    [STORAGE_KEYS.accounts]: accounts.filter(a => a.id !== id),
  });
  return { ok: true };
}

// ── Usage scrape handler ──────────────────────────────────────────────────────
async function handleUsageScrape({ accountEmail, usedPct, planLabel, billingResetDate }) {
  const accounts = await getAccounts();
  const matched = accounts.find(a => a.email && a.email === accountEmail);
  if (!matched) return { ok: false, reason: "no matching account" };

  const prev = matched.usedPct || 0;
  matched.usedPct = usedPct;
  matched.planLabel = planLabel;
  matched.billingResetDate = billingResetDate;
  matched.lastSeen = Date.now();

  await chrome.storage.local.set({ [STORAGE_KEYS.accounts]: accounts });
  await appendDailyLog(matched.id, usedPct);

  if (prev < ALERT_THRESHOLD && usedPct >= ALERT_THRESHOLD) {
    chrome.notifications.create(`alert-${matched.id}-${Date.now()}`, {
      type: "basic",
      iconUrl: "public/icon48.png",
      title: `Claude: ${matched.label} at ${Math.round(usedPct * 100)}%`,
      message: `Usage crossed 80%. Switch to another account. 20% reserved for work.`,
      priority: 2,
    });
  }

  return { ok: true };
}

// ── Rate limit handler ────────────────────────────────────────────────────────
async function handleRateLimit({ accountEmail, message }) {
  const accounts = await getAccounts();
  const matched = accounts.find(a => a.email && a.email === accountEmail) || {};
  const label = matched.label || "Unknown account";

  chrome.notifications.create(`ratelimit-${Date.now()}`, {
    type: "basic",
    iconUrl: "public/icon48.png",
    title: `Claude Rate Limited — ${label}`,
    message: message || "You've hit the rate limit. Switch accounts.",
    priority: 2,
    buttons: [{ title: "Switch Account" }],
  });

  if (matched.id) {
    matched.usedPct = 1.0;
    matched.rateLimitedAt = Date.now();
    await chrome.storage.local.set({ [STORAGE_KEYS.accounts]: accounts });
  }

  return { ok: true };
}

// ── Conversation logger ───────────────────────────────────────────────────────
async function logConversation({ title, url, accountEmail }) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.sessions);
  const sessions = data[STORAGE_KEYS.sessions] || [];
  sessions.unshift({ title, url, accountEmail, ts: Date.now() });
  if (sessions.length > 200) sessions.splice(200);
  await chrome.storage.local.set({ [STORAGE_KEYS.sessions]: sessions });
  return { ok: true };
}

// ── Daily log (sparkline data) ────────────────────────────────────────────────
async function appendDailyLog(accountId, usedPct) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.dailyLog);
  const log = data[STORAGE_KEYS.dailyLog] || {};
  if (!log[accountId]) log[accountId] = [];
  const today = new Date().toISOString().slice(0, 10);
  const existing = log[accountId].find(e => e.date === today);
  if (existing) existing.pct = usedPct;
  else log[accountId].push({ date: today, pct: usedPct });
  if (log[accountId].length > 30) log[accountId].shift();
  await chrome.storage.local.set({ [STORAGE_KEYS.dailyLog]: log });
}

async function getDailyLog() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.dailyLog);
  return data[STORAGE_KEYS.dailyLog] || {};
}

// ── Alert check (alarm-driven) ────────────────────────────────────────────────
async function checkAllAccountAlerts() {
  const accounts = await getAccounts();
  for (const acc of accounts) {
    if (acc.usedPct >= ALERT_THRESHOLD && !acc.alertedAt) {
      chrome.notifications.create(`scheduled-alert-${acc.id}`, {
        type: "basic",
        iconUrl: "public/icon48.png",
        title: `Claude: ${acc.label} at ${Math.round(acc.usedPct * 100)}%`,
        message: "Usage above 80%. Consider switching to another account.",
        priority: 1,
      });
    }
  }
}

// ── Tab opener ────────────────────────────────────────────────────────────────
function openAccount(url) {
  chrome.tabs.create({ url: url || "https://claude.ai" });
}
