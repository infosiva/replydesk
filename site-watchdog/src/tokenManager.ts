/**
 * Token/API-key rotation manager.
 *
 * Supports any service that might have multiple keys (Groq, Gemini, Anthropic,
 * Vercel, YouTube, etc.).  When a key fails (quota, 401, 403) it automatically
 * rotates to the next one and logs the event via Telegram.
 *
 * .env convention:
 *   GROQ_API_KEY_1=...   GROQ_API_KEY_2=...
 *   GEMINI_API_KEY_1=... GEMINI_API_KEY_2=...
 *   ANTHROPIC_API_KEY_1=...
 *   VERCEL_TOKEN_1=...   VERCEL_TOKEN_2=...
 *   (Also accepts the plain GROQ_API_KEY as key 0)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '..', 'token-state.json');

// Errors that mean the key is exhausted/invalid (not a transient network error)
const EXHAUSTED_PATTERNS = [
  'credit', 'quota', 'rate_limit', 'rate limit',
  '401', '403', 'invalid_api_key', 'unauthorized',
  'billing', 'insufficient_quota', 'too low',
  'exceeded', 'limit reached',
];

function isExhaustedError(message: string): boolean {
  const lower = message.toLowerCase();
  return EXHAUSTED_PATTERNS.some(p => lower.includes(p));
}

interface TokenState {
  [service: string]: number; // current index in the key array
}

function loadState(): TokenState {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return {}; }
}

function saveState(state: TokenState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function getKeysForService(service: string): string[] {
  const keys: string[] = [];
  // Plain key (e.g. GROQ_API_KEY)
  const plain = process.env[`${service}_API_KEY`] || process.env[`${service}_TOKEN`];
  if (plain) keys.push(plain);
  // Numbered keys (e.g. GROQ_API_KEY_1, GROQ_API_KEY_2)
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`${service}_API_KEY_${i}`] || process.env[`${service}_TOKEN_${i}`];
    if (k) keys.push(k);
    else break;
  }
  // Deduplicate preserving order
  return [...new Set(keys)];
}

export class TokenManager {
  private state: TokenState;

  constructor() {
    this.state = loadState();
  }

  /** Get the current active key for a service. */
  getKey(service: string): string | undefined {
    const keys = getKeysForService(service);
    if (keys.length === 0) return undefined;
    const idx = Math.min(this.state[service] || 0, keys.length - 1);
    return keys[idx];
  }

  /**
   * Call fn() using the current key. If it throws an exhausted-key error,
   * rotate to the next key and retry once. Notifies via Telegram on rotation.
   */
  async withRotation<T>(
    service: string,
    fn: (key: string) => Promise<T>
  ): Promise<T> {
    const keys = getKeysForService(service);
    if (keys.length === 0) throw new Error(`No keys configured for ${service}`);

    const startIdx = this.state[service] || 0;

    for (let attempt = 0; attempt < keys.length; attempt++) {
      const idx = (startIdx + attempt) % keys.length;
      const key = keys[idx];

      try {
        const result = await fn(key);
        // Success — update state in case we rotated
        if (idx !== (this.state[service] || 0)) {
          this.state[service] = idx;
          saveState(this.state);
        }
        return result;
      } catch (e: any) {
        const msg = e.message || String(e);
        if (!isExhaustedError(msg)) throw e; // Not a quota error — don't rotate

        console.log(`  🔄 ${service} key ${idx + 1}/${keys.length} exhausted — rotating`);
        if (attempt < keys.length - 1) {
          const nextIdx = (startIdx + attempt + 1) % keys.length;
          this.state[service] = nextIdx;
          saveState(this.state);
          await this.sendRotationAlert(service, idx + 1, nextIdx + 1, keys.length);
        }
      }
    }

    throw new Error(`All ${keys.length} ${service} keys exhausted`);
  }

  private async sendRotationAlert(service: string, from: number, to: number, total: number): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    const msg = `⚠️ *Token Rotation*\n\nService: \`${service}\`\nRotated key ${from} → ${to} of ${total}\nReason: key ${from} quota/auth error\n\n_No action needed — running on key ${to}_`;
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
      });
    } catch { /* non-critical */ }
  }

  /** Get status of all configured services. */
  getStatus(): Record<string, { total: number; current: number; key: string }> {
    const services = ['GROQ', 'GEMINI', 'CEREBRAS', 'ANTHROPIC', 'VERCEL', 'YOUTUBE'];
    const result: Record<string, any> = {};
    for (const s of services) {
      const keys = getKeysForService(s);
      if (keys.length === 0) continue;
      const idx = this.state[s] || 0;
      const key = keys[idx] || '';
      result[s] = {
        total: keys.length,
        current: idx + 1,
        key: key.slice(0, 8) + '...' + key.slice(-4),
      };
    }
    return result;
  }
}

export const tokenManager = new TokenManager();
