// ── Popup controller ──────────────────────────────────────────────────────────

const TIPS = [
  {
    title: "Use /compact before long tasks",
    body: "Type <code>/compact</code> in Claude Code to compress conversation history. Saves tokens and avoids context limits mid-task.",
  },
  {
    title: "Rotate accounts by task type",
    body: "Use Account 1 for coding tasks (token-heavy), Account 2 for quick questions. Heavy tasks eat limits faster.",
  },
  {
    title: "ultrathink = 3–5× token burn",
    body: "Only use <code>ultrathink</code> for architecture decisions. For regular coding, sonnet without it is 80% as good at 20% the cost.",
  },
  {
    title: "Haiku subagents for grunt work",
    body: "File reads, renames, grep tasks → dispatch haiku subagents. Save sonnet for judgment and synthesis.",
  },
  {
    title: "Free model fallback chain",
    body: "Groq → Gemini → Cerebras → Anthropic. Use free providers in app code first. <code>GROQ_API_KEY</code> free at console.groq.com.",
  },
  {
    title: "Claude Code CLI usage check",
    body: "Run <code>claude --print-usage</code> or check ~/.claude/usage.json to see token counts per session.",
  },
  {
    title: "/compact resets context cheaply",
    body: "When context window fills (you see slowdowns), <code>/compact</code> without losing the task. Compacted context = ~60% fewer tokens.",
  },
  {
    title: "Parallel tool calls = faster + cheaper",
    body: "Group independent tool calls in one message. Claude runs them in parallel — fewer round-trips, less latency.",
  },
  {
    title: "Set per-account billing day",
    body: "Different Claude accounts reset on different days. Stagger them so you always have at least one fresh account.",
  },
  {
    title: "CLI hook: log token spend",
    body: "Add a PostToolUse hook in <code>~/.claude/settings.json</code> to log token usage to a file. Wire it to this extension for real-time data.",
  },
];

// ── State ──────────────────────────────────────────────────────────────────────
let accounts = [];
let dailyLog = {};
let sessions = [];
let editingId = null;

// ── Boot ───────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupModal();
  await loadAll();
  renderAccounts();
  renderRecommendation();
  renderActivity();
  renderTips();

  document.getElementById("btn-refresh").addEventListener("click", async () => {
    await loadAll();
    renderAccounts();
    renderRecommendation();
    renderActivity();
  });

  document.getElementById("btn-settings").addEventListener("click", () => {
    openModal(null);
  });

  document.getElementById("btn-add-account").addEventListener("click", () => {
    openModal(null);
  });
});

// ── Data load ─────────────────────────────────────────────────────────────────
async function loadAll() {
  accounts = await msg("GET_ACCOUNTS") || [];
  dailyLog = await msg("GET_DAILY_LOG") || {};
  const data = await chrome.storage.local.get("cam_sessions");
  sessions = data.cam_sessions || [];
}

function msg(type, payload = {}) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type, payload }, resolve);
  });
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
    });
  });
}

// ── Render: Accounts ──────────────────────────────────────────────────────────
function renderAccounts() {
  const list = document.getElementById("accounts-list");
  if (!accounts.length) {
    list.innerHTML = `<p style="color:#4b5563;font-size:12px;text-align:center;padding:20px 0;">No accounts configured. Add one below.</p>`;
    return;
  }

  list.innerHTML = accounts.map(acc => {
    const pct = Math.round((acc.usedPct || 0) * 100);
    const remaining = 100 - pct;
    const workPct = Math.round((acc.usedPct || 0) * 100);
    const isRateLimited = acc.rateLimitedAt && Date.now() - acc.rateLimitedAt < 3600_000;

    const barColor = isRateLimited ? "#ef4444"
      : pct >= 80 ? "#ef4444"
      : pct >= 60 ? "#f59e0b"
      : acc.color || "#22c55e";

    const statusBadge = isRateLimited
      ? `<span class="badge badge-rate">Rate limited</span>`
      : pct >= 80 ? `<span class="badge badge-danger">${remaining}% left</span>`
      : pct >= 60 ? `<span class="badge badge-warn">${remaining}% left</span>`
      : `<span class="badge badge-safe">${remaining}% left</span>`;

    const lastSeen = acc.lastSeen
      ? `Updated ${relativeTime(acc.lastSeen)}`
      : "Not scraped yet";

    return `
      <div class="account-card ${pct >= 80 ? 'danger' : pct >= 60 ? 'warn' : ''}" data-id="${acc.id}">
        <div class="acc-header">
          <div class="acc-name">
            <span class="acc-dot" style="background:${acc.color || '#6366f1'}"></span>
            ${escHtml(acc.label)}
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            ${statusBadge}
            <span class="acc-pct" style="color:${barColor}">${pct}%</span>
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
        <div class="progress-labels">
          <span>${acc.planLabel || acc.plan || 'Pro'}</span>
          <span>${lastSeen}</span>
        </div>
        <div class="acc-actions">
          <button class="acc-btn primary" onclick="openAccount('${escHtml(acc.url || 'https://claude.ai')}')">Open ↗</button>
          <button class="acc-btn" onclick="openUsage('${escHtml(acc.url || 'https://claude.ai')}')">Usage page</button>
          <button class="acc-btn" onclick="editAccount('${acc.id}')">Edit</button>
        </div>
      </div>
    `;
  }).join("");
}

// ── Render: Recommendation ────────────────────────────────────────────────────
function renderRecommendation() {
  const box = document.getElementById("recommendation");
  if (!accounts.length) { box.innerHTML = "Add accounts to get recommendations."; return; }

  const available = accounts
    .filter(a => !a.rateLimitedAt || Date.now() - a.rateLimitedAt > 3600_000)
    .sort((a, b) => (a.usedPct || 0) - (b.usedPct || 0));

  if (!available.length) {
    box.innerHTML = "⚠️ All accounts rate-limited or at limit. Take a break or wait for reset.";
    return;
  }

  const best = available[0];
  const pct = Math.round((best.usedPct || 0) * 100);
  const remaining = 100 - pct;

  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
      <div>
        <div style="font-weight:700;color:#a5b4fc;margin-bottom:2px;">Use next: <strong style="color:#f9fafb">${escHtml(best.label)}</strong></div>
        <div style="color:#6b7280;font-size:11px">${remaining}% remaining · ${best.planLabel || best.plan || 'Pro'}</div>
      </div>
      <button class="acc-btn primary" style="flex:none;padding:5px 10px" onclick="openAccount('${escHtml(best.url || 'https://claude.ai')}')">Switch ↗</button>
    </div>
    ${available.length > 1 ? `<div style="margin-top:8px;font-size:11px;color:#4b5563;">Other options: ${available.slice(1).map(a => `${escHtml(a.label)} (${Math.round((1-(a.usedPct||0))*100)}% left)`).join(" · ")}</div>` : ""}
  `;
}

// ── Render: Activity ──────────────────────────────────────────────────────────
function renderActivity() {
  // Sessions
  const sl = document.getElementById("sessions-list");
  if (!sessions.length) {
    sl.innerHTML = `<p style="color:#4b5563;font-size:12px;padding:8px 0">No conversations logged yet. Visit claude.ai to start.</p>`;
  } else {
    sl.innerHTML = sessions.slice(0, 20).map(s => `
      <div class="session-item">
        <a href="${escHtml(s.url)}" target="_blank">
          <div class="session-title">${escHtml(s.title)}</div>
          <div class="session-meta">${s.accountEmail || "Unknown account"} · ${relativeTime(s.ts)}</div>
        </a>
      </div>
    `).join("");
  }

  // Sparklines
  const sp = document.getElementById("sparklines");
  sp.innerHTML = "";
  accounts.forEach(acc => {
    const log = dailyLog[acc.id] || [];
    if (!log.length) return;

    const row = document.createElement("div");
    row.className = "sparkline-row";

    const label = document.createElement("div");
    label.className = "sparkline-label";
    label.title = acc.label;
    label.textContent = acc.label;

    const canvas = document.createElement("canvas");
    canvas.className = "sparkline-canvas";
    canvas.width = 200;
    canvas.height = 28;

    row.appendChild(label);
    row.appendChild(canvas);
    sp.appendChild(row);

    // Draw sparkline
    requestAnimationFrame(() => drawSparkline(canvas, log, acc.color || "#6366f1"));
  });
}

function drawSparkline(canvas, log, color) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const pts = log.slice(-14).map(e => e.pct);
  if (pts.length < 2) return;

  ctx.clearRect(0, 0, W, H);

  const maxVal = Math.max(...pts, 0.1);
  const xStep = W / (pts.length - 1);

  const coords = pts.map((v, i) => ({
    x: i * xStep,
    y: H - (v / maxVal) * (H - 4) - 2,
  }));

  // Fill
  ctx.beginPath();
  ctx.moveTo(coords[0].x, H);
  coords.forEach(c => ctx.lineTo(c.x, c.y));
  ctx.lineTo(coords[coords.length - 1].x, H);
  ctx.closePath();
  ctx.fillStyle = color + "22";
  ctx.fill();

  // Line
  ctx.beginPath();
  coords.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Last dot
  const last = coords[coords.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// ── Render: Tips ─────────────────────────────────────────────────────────────
function renderTips() {
  document.getElementById("tips-content").innerHTML = TIPS.map(t => `
    <div class="tip-card">
      <div class="tip-title">${t.title}</div>
      <div class="tip-body">${t.body}</div>
    </div>
  `).join("");
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function setupModal() {
  document.getElementById("btn-modal-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-overlay").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.getElementById("btn-modal-save").addEventListener("click", async () => {
    const account = {
      id: editingId || crypto.randomUUID(),
      label: document.getElementById("edit-label").value.trim() || "Account",
      email: document.getElementById("edit-email").value.trim(),
      plan: document.getElementById("edit-plan").value,
      billingDay: parseInt(document.getElementById("edit-billing-day").value) || 1,
      color: document.getElementById("edit-color").value,
      url: document.getElementById("edit-url").value.trim() || "https://claude.ai",
    };
    await msg("SAVE_ACCOUNT", account);
    await loadAll();
    renderAccounts();
    renderRecommendation();
    closeModal();
  });

  document.getElementById("btn-modal-delete").addEventListener("click", async () => {
    if (!editingId) return;
    if (!confirm("Delete this account?")) return;
    await msg("DELETE_ACCOUNT", { id: editingId });
    await loadAll();
    renderAccounts();
    renderRecommendation();
    closeModal();
  });
}

function openModal(id) {
  editingId = id;
  const acc = id ? accounts.find(a => a.id === id) : null;
  document.getElementById("modal-title").textContent = acc ? "Edit Account" : "Add Account";
  document.getElementById("edit-id").value = id || "";
  document.getElementById("edit-label").value = acc?.label || "";
  document.getElementById("edit-email").value = acc?.email || "";
  document.getElementById("edit-plan").value = acc?.plan || "pro";
  document.getElementById("edit-billing-day").value = acc?.billingDay || 1;
  document.getElementById("edit-color").value = acc?.color || "#6366f1";
  document.getElementById("edit-url").value = acc?.url || "https://claude.ai";
  document.getElementById("btn-modal-delete").style.display = id ? "block" : "none";
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("edit-label").focus();
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  editingId = null;
}

// ── Global helpers (called from inline onclick) ────────────────────────────────
window.openAccount = function (url) {
  chrome.runtime.sendMessage({ type: "OPEN_ACCOUNT", payload: { url } });
};

window.openUsage = function (baseUrl) {
  const url = baseUrl.replace(/\/$/, "") + "/settings/usage";
  chrome.runtime.sendMessage({ type: "OPEN_ACCOUNT", payload: { url } });
};

window.editAccount = function (id) {
  openModal(id);
};

// ── Utils ─────────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function relativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.round(diff / 3600_000)}h ago`;
  return `${Math.round(diff / 86400_000)}d ago`;
}
