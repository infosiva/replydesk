/**
 * Compatibility shim — replaced Supabase with Neon+Drizzle.
 * Import `auth` from '@/lib/auth' and `db` from '@/lib/db' in new code.
 * This file kept for gradual migration of existing imports.
 */
export { auth as getServerAuth } from './auth'
export { db } from './db'
