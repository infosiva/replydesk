#!/usr/bin/env npx tsx
/**
 * set-vercel-env.ts
 *
 * Syncs a shared set of env vars to multiple Vercel projects in one shot.
 * Uses the Vercel REST API — no CLI login needed, just a token.
 *
 * !! WHEN ADDING A NEW VERCEL PROJECT !!
 *   1. Add its name to the PROJECTS array below
 *   2. Run: VERCEL_TOKEN=vcp_01iJOUQCKQGfvLVCL9NRWUmDdk9uU1wpOqqjxYXQ6HkwaEVHJx2u1D9p npx tsx set-vercel-env.ts
 *   Safe to re-run anytime — deletes old values before writing, no duplicates.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const TOKEN = process.env.VERCEL_TOKEN
if (!TOKEN) {
  console.error('Set VERCEL_TOKEN=xxx before running')
  process.exit(1)
}

// ── Load SHARED_VARS from .env.shared (single source of truth) ───────────────
// Keys to push to ALL projects — project-specific keys (VPS_*, OLLAMA_HOST) excluded
const SHARED_KEYS = ['GROQ_API_KEY', 'GROQ_API_KEY_1', 'GEMINI_API_KEY', 'CEREBRAS_API_KEY', 'NVIDIA_API_KEY', 'KIMI_API_KEY', 'ANTHROPIC_API_KEY', 'EDGE_CONFIG', 'RESEND_API_KEY']

function loadSharedEnv(): Record<string, string> {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '.env.shared')
  if (!existsSync(envPath)) {
    console.error('.env.shared not found at', envPath)
    process.exit(1)
  }
  const vars: Record<string, string> = {}
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (SHARED_KEYS.includes(key) && val) vars[key] = val
  }
  return vars
}

const SHARED_VARS: Record<string, string> = loadSharedEnv()
console.log(`Loaded ${Object.keys(SHARED_VARS).length} vars from .env.shared`)

// ── Projects to update (Vercel project name or ID) ────────────────────────────
// These are the names shown in your Vercel dashboard
const PROJECTS = [
  'nudge',                  // tutiq.app
  'kwizzo',                 // kwizzo.app
  'questly',                // quizbites.app
  'complybuddy',            // complybuddy-y3lj4k0nv-infosivas-projects.vercel.app
  'ai-resume-builder',      // resumevault.app
  'tradespot',              // anylocal.app
  'social-media-calendar',  // social-media-calendar.vercel.app
  'ai-investment-tracker',  // wealthpilot.app
  'ai-travel-planner',      // wanderai.app
  'language-learning-bot',  // speakfast.app
  'agenttrace',             // agenttrace-omoyn0yms-infosivas-projects.vercel.app
  'ai-social-content',      // ai-social-content.vercel.app
  'ai-resume-screener',     // ai-resume-screener.vercel.app
  'ai-voice-home',          // ai-voice-home.vercel.app
  'yt-portal',              // yt-portal.vercel.app
  'idea-agent',             // idea-agent.vercel.app
  'meetscribe',             // meetscribe.vercel.app
  'weekendai',              // weekendai.vercel.app
  'pdfideas',               // pdfideas.vercel.app
]

// ── Environments to set vars in ───────────────────────────────────────────────
const TARGETS: Array<'production' | 'preview' | 'development'> = ['production', 'preview', 'development']

// ── Vercel API helpers ────────────────────────────────────────────────────────
const BASE = 'https://api.vercel.com'
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

async function listEnvs(project: string): Promise<Array<{ id: string; key: string; target: string[] }>> {
  const r = await fetch(`${BASE}/v9/projects/${project}/env`, { headers })
  if (!r.ok) {
    const e = await r.text()
    throw new Error(`listEnvs ${project}: ${r.status} ${e.slice(0, 200)}`)
  }
  const data: any = await r.json()
  return data.envs ?? []
}

async function deleteEnv(project: string, envId: string) {
  const r = await fetch(`${BASE}/v9/projects/${project}/env/${envId}`, { method: 'DELETE', headers })
  if (!r.ok) {
    const e = await r.text()
    console.warn(`  ⚠ delete ${envId}: ${r.status} ${e.slice(0, 100)}`)
  }
}

async function createEnv(project: string, key: string, value: string) {
  const r = await fetch(`${BASE}/v10/projects/${project}/env`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ key, value, type: 'encrypted', target: TARGETS }),
  })
  if (!r.ok) {
    const e = await r.text()
    throw new Error(`createEnv ${project}/${key}: ${r.status} ${e.slice(0, 200)}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function syncProject(project: string) {
  console.log(`\n▶ ${project}`)

  // Fetch existing envs
  const existing = await listEnvs(project)

  for (const [key, value] of Object.entries(SHARED_VARS)) {
    // Delete any existing entries for this key (all targets)
    const old = existing.filter(e => e.key === key)
    for (const e of old) {
      await deleteEnv(project, e.id)
    }

    // Create fresh
    await createEnv(project, key, value)
    console.log(`  ✓ ${key}`)
  }
}

async function main() {
  console.log(`Syncing ${Object.keys(SHARED_VARS).length} vars → ${PROJECTS.length} projects`)

  const results: { project: string; ok: boolean; error?: string }[] = []

  for (const project of PROJECTS) {
    try {
      await syncProject(project)
      results.push({ project, ok: true })
    } catch (e: any) {
      console.error(`  ✗ ${e.message}`)
      results.push({ project, ok: false, error: e.message })
    }
  }

  console.log('\n── Summary ───────────────────────────────────')
  for (const r of results) {
    console.log(r.ok ? `  ✅ ${r.project}` : `  ❌ ${r.project} — ${r.error}`)
  }
}

main()
