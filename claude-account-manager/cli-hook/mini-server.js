#!/usr/bin/env node
// Lightweight local server — serves CLI usage stats to the extension
// Run: node mini-server.js   (auto-starts with launchd or pm2)
// Extension polls: http://localhost:17432/usage

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PORT = 17432;
const LOG_FILE = path.join(process.env.HOME, ".claude", "usage-log.jsonl");

function parseTodayStats() {
  if (!fs.existsSync(LOG_FILE)) return null;

  const today = new Date().toISOString().slice(0, 10);
  const lines = fs.readFileSync(LOG_FILE, "utf8")
    .split("\n")
    .filter(l => l.includes(`"ts":"${today}`));

  let totalIn = 0, totalOut = 0, totalCache = 0;
  for (const line of lines) {
    try {
      const r = JSON.parse(line);
      totalIn += r.in || 0;
      totalOut += r.out || 0;
      totalCache += r.cache_read || 0;
    } catch (_) {}
  }

  const costUsd = (totalIn * 3 + totalOut * 15 + totalCache * 0.3) / 1_000_000;

  return {
    date: today,
    calls: lines.length,
    input_tokens: totalIn,
    output_tokens: totalOut,
    cache_read_tokens: totalCache,
    estimated_usd: costUsd.toFixed(4),
  };
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/usage") {
    const stats = parseTodayStats();
    res.end(JSON.stringify(stats || { error: "no data yet" }));
  } else if (req.url === "/health") {
    res.end(JSON.stringify({ ok: true, port: PORT }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Claude usage server running at http://127.0.0.1:${PORT}`);
});
