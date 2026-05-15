const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "../data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "tracker.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS pageviews (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    site       TEXT NOT NULL,
    path       TEXT NOT NULL,
    referrer   TEXT,
    country    TEXT,
    ua_type    TEXT,
    session_id TEXT,
    ts         INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    site       TEXT NOT NULL,
    session_id TEXT NOT NULL,
    duration_s INTEGER NOT NULL,
    pages      INTEGER NOT NULL DEFAULT 1,
    ts         INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    site       TEXT NOT NULL,
    session_id TEXT,
    name       TEXT NOT NULL,
    value      TEXT,
    ts         INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    site       TEXT NOT NULL,
    session_id TEXT,
    rating     INTEGER,
    category   TEXT,
    message    TEXT NOT NULL,
    email      TEXT,
    path       TEXT,
    ts         INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_pv_site_ts   ON pageviews(site, ts);
  CREATE INDEX IF NOT EXISTS idx_sess_site_ts ON sessions(site, ts);
  CREATE INDEX IF NOT EXISTS idx_ev_site_ts   ON events(site, ts);
  CREATE INDEX IF NOT EXISTS idx_fb_site_ts   ON feedback(site, ts);
`);

module.exports = db;
