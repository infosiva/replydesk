import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = process.env.DB_PATH || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'auth.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_FILE);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run migrations
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    site TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active INTEGER DEFAULT 1,
    email_verified INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_site ON users(site);

  CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);

  CREATE TABLE IF NOT EXISTS guest_sessions (
    fingerprint TEXT PRIMARY KEY,
    ip          TEXT,
    last_seen   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS guest_usage (
    fingerprint TEXT NOT NULL,
    product     TEXT NOT NULL,
    action      TEXT NOT NULL,
    count       INTEGER DEFAULT 0,
    PRIMARY KEY (fingerprint, product, action)
  );

  CREATE INDEX IF NOT EXISTS idx_guest_usage ON guest_usage(fingerprint, product);
`);

export interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  site: string;
  created_at: string;
  last_login: string | null;
  is_active: number;
  email_verified: number;
}

export interface PublicUser {
  id: number;
  username: string;
  email: string;
  site: string;
  created_at: string;
}

export const stmts = {
  findByEmail: db.prepare<[string]>('SELECT * FROM users WHERE email = ? AND is_active = 1'),
  findByUsername: db.prepare<[string]>('SELECT * FROM users WHERE username = ? AND is_active = 1'),
  findById: db.prepare<[number]>('SELECT * FROM users WHERE id = ? AND is_active = 1'),
  usernameExists: db.prepare<[string]>('SELECT id FROM users WHERE username = ?'),
  emailExists: db.prepare<[string]>('SELECT id FROM users WHERE email = ?'),
  insertUser: db.prepare<[string, string, string, string]>(
    'INSERT INTO users (username, email, password_hash, site, email_verified) VALUES (?, ?, ?, ?, 0)'
  ),
  updateLastLogin: db.prepare<[number]>(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
  ),
  verifyEmail: db.prepare<[number]>(
    'UPDATE users SET email_verified = 1 WHERE id = ?'
  ),
  insertOtp: db.prepare<[string, string, number]>(
    'INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)'
  ),
  findValidOtp: db.prepare<[string, string, number]>(
    'SELECT * FROM otp_codes WHERE email = ? AND code = ? AND expires_at > ? AND used = 0 ORDER BY id DESC LIMIT 1'
  ),
  markOtpUsed: db.prepare<[number]>(
    'UPDATE otp_codes SET used = 1 WHERE id = ?'
  ),
  deleteExpiredOtps: db.prepare<[number]>(
    'DELETE FROM otp_codes WHERE expires_at < ?'
  ),
};

export function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    site: u.site,
    created_at: u.created_at,
  };
}

export default db;
