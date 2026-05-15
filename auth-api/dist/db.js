"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stmts = void 0;
exports.toPublicUser = toPublicUser;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DB_DIR = process.env.DB_PATH || path_1.default.join(__dirname, '..', 'data');
const DB_FILE = path_1.default.join(DB_DIR, 'auth.db');
if (!fs_1.default.existsSync(DB_DIR)) {
    fs_1.default.mkdirSync(DB_DIR, { recursive: true });
}
const db = new better_sqlite3_1.default(DB_FILE);
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
    is_active INTEGER DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_site ON users(site);
`);
exports.stmts = {
    findByEmail: db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1'),
    findByUsername: db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1'),
    findById: db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1'),
    usernameExists: db.prepare('SELECT id FROM users WHERE username = ?'),
    emailExists: db.prepare('SELECT id FROM users WHERE email = ?'),
    insertUser: db.prepare('INSERT INTO users (username, email, password_hash, site) VALUES (?, ?, ?, ?)'),
    updateLastLogin: db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'),
};
function toPublicUser(u) {
    return {
        id: u.id,
        username: u.username,
        email: u.email,
        site: u.site,
        created_at: u.created_at,
    };
}
exports.default = db;
