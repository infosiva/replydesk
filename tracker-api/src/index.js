const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3098;

// ── Middleware ────────────────────────────────────────────────
app.use(express.json({ limit: "16kb" }));

// Allow all our sites + local dev
const ALLOWED_ORIGINS = [
  "https://invoicemint.cloud",
  "https://nammatamil.live",
  "https://quizbytes.dev",
  "https://worldtrends.today",
  "https://clawdbotai.tech",
  "https://quicktechai.app",
  "https://www.aijobsportal.app",
  "https://flightbrain.app",
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-side / curl
    const ok = ALLOWED_ORIGINS.some(o =>
      typeof o === "string" ? o === origin : o.test(origin)
    );
    cb(ok ? null : new Error("Not allowed"), ok);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

const trackLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const feedbackLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });

// ── Helpers ───────────────────────────────────────────────────
function uaType(ua = "") {
  if (!ua) return "unknown";
  if (/bot|crawler|spider|slurp|facebookexternalhit/i.test(ua)) return "bot";
  if (/mobile|android|iphone|ipad/i.test(ua)) return "mobile";
  return "desktop";
}

function ok(res, data = {}) {
  res.json({ ok: true, ...data });
}

// ── POST /track ───────────────────────────────────────────────
// Body: { site, path, referrer?, session_id?, event?, value? }
app.post("/track", trackLimiter, (req, res) => {
  const { site, path: pg, referrer, session_id, event, value } = req.body;
  if (!site || !pg) return res.status(400).json({ ok: false, error: "site and path required" });

  const ua = req.headers["user-agent"] || "";
  const type = uaType(ua);
  if (type === "bot") return ok(res); // silently drop bots

  db.prepare(
    `INSERT INTO pageviews (site, path, referrer, ua_type, session_id) VALUES (?,?,?,?,?)`
  ).run(site, pg, referrer || null, type, session_id || null);

  if (event) {
    db.prepare(
      `INSERT INTO events (site, session_id, name, value) VALUES (?,?,?,?)`
    ).run(site, session_id || null, event, value != null ? String(value) : null);
  }

  ok(res);
});

// ── POST /session ─────────────────────────────────────────────
// Body: { site, session_id, duration_s, pages? }
app.post("/session", trackLimiter, (req, res) => {
  const { site, session_id, duration_s, pages } = req.body;
  if (!site || !session_id || duration_s == null) {
    return res.status(400).json({ ok: false, error: "site, session_id, duration_s required" });
  }
  db.prepare(
    `INSERT INTO sessions (site, session_id, duration_s, pages) VALUES (?,?,?,?)`
  ).run(site, session_id, Math.round(duration_s), pages || 1);
  ok(res);
});

// ── POST /feedback ────────────────────────────────────────────
// Body: { site, message, rating?, category?, email?, path?, session_id? }
app.post("/feedback", feedbackLimiter, (req, res) => {
  const { site, message, rating, category, email, path: pg, session_id } = req.body;
  if (!site || !message || message.trim().length < 3) {
    return res.status(400).json({ ok: false, error: "site and message required" });
  }
  db.prepare(
    `INSERT INTO feedback (site, session_id, rating, category, message, email, path) VALUES (?,?,?,?,?,?,?)`
  ).run(
    site, session_id || null,
    rating ? Number(rating) : null,
    category || null,
    message.trim().slice(0, 2000),
    email || null,
    pg || null
  );
  ok(res, { message: "Thanks for your feedback!" });
});

// ── GET /stats ────────────────────────────────────────────────
// Query: ?site=invoicemint.cloud&days=7&key=SECRET
app.get("/stats", (req, res) => {
  if (req.query.key !== (process.env.STATS_KEY || "sitestats2025")) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const { site, days = 7 } = req.query;
  const since = Math.floor(Date.now() / 1000) - Number(days) * 86400;

  const siteFilter = site ? "AND site = ?" : "";
  const args = site ? [since, site] : [since];

  const pageviews = db.prepare(
    `SELECT COUNT(*) as total, COUNT(DISTINCT session_id) as uniq_sessions
     FROM pageviews WHERE ts >= ? ${siteFilter}`
  ).get(...args);

  const topPages = db.prepare(
    `SELECT path, COUNT(*) as views FROM pageviews
     WHERE ts >= ? ${siteFilter}
     GROUP BY path ORDER BY views DESC LIMIT 10`
  ).all(...args);

  const avgSession = db.prepare(
    `SELECT AVG(duration_s) as avg_s, AVG(pages) as avg_pages
     FROM sessions WHERE ts >= ? ${siteFilter}`
  ).get(...args);

  const bySite = db.prepare(
    `SELECT site, COUNT(*) as views, COUNT(DISTINCT session_id) as sessions
     FROM pageviews WHERE ts >= ?
     GROUP BY site ORDER BY views DESC`
  ).all(since);

  const recentFeedback = db.prepare(
    `SELECT site, rating, category, message, email, path,
            datetime(ts,'unixepoch') as date
     FROM feedback WHERE ts >= ? ${siteFilter}
     ORDER BY ts DESC LIMIT 50`
  ).all(...args);

  const feedbackSummary = db.prepare(
    `SELECT AVG(rating) as avg_rating, COUNT(*) as total
     FROM feedback WHERE ts >= ? ${siteFilter} AND rating IS NOT NULL`
  ).get(...args);

  const topEvents = db.prepare(
    `SELECT name, COUNT(*) as count FROM events
     WHERE ts >= ? ${siteFilter}
     GROUP BY name ORDER BY count DESC LIMIT 20`
  ).all(...args);

  res.json({
    ok: true,
    period_days: Number(days),
    site: site || "all",
    pageviews,
    top_pages: topPages,
    avg_session: {
      duration_s: Math.round(avgSession.avg_s || 0),
      pages: +(avgSession.avg_pages || 0).toFixed(1),
    },
    by_site: bySite,
    feedback: {
      summary: feedbackSummary,
      recent: recentFeedback,
    },
    top_events: topEvents,
  });
});

// ── GET /health ───────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ── Serve t.js with correct content-type ─────────────────────
app.use(express.static(path.join(__dirname, "../public"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".js")) res.setHeader("Content-Type", "application/javascript");
  },
}));

app.listen(PORT, () => console.log(`tracker-api running on :${PORT}`));
