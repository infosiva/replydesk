/**
 * emailSender.ts — Send outreach emails from CSV leads
 *
 * FREE STACK (Resend → Brevo → Gmail SMTP — never paid):
 *   Resend:   3,000/month, 100/day   (resend.com — free plan)
 *   Brevo:    300/day                (brevo.com — free plan)
 *   Gmail:    500/day via SMTP       (nodemailer + Gmail app password)
 *
 * Usage:
 *   npx tsx src/emailSender.ts --csv leads/2026-05-10-manchester-tutoring-tutiq.csv --limit 20
 *   npx tsx src/emailSender.ts --csv leads/2026-05-10-manchester-tutoring-tutiq.csv --dry-run
 *   npx tsx src/emailSender.ts --csv leads/2026-05-10-manchester-tutoring-tutiq.csv --limit 30 --delay 120
 *
 * Env vars (add to agents/.env.shared):
 *   RESEND_API_KEY      — resend.com API key (free plan: re_...)
 *   BREVO_API_KEY       — brevo.com API key (free plan)
 *   GMAIL_USER          — your Gmail address
 *   GMAIL_APP_PASSWORD  — Google app password (not main password)
 *   FROM_EMAIL          — sender email (must match service domain)
 *   FROM_NAME           — sender name shown in email
 */

import * as fs   from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as dotenv from 'dotenv'
import { FreeTierGuard } from './freeTierGuard.js'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '../.env.shared') })

// ── CLI args ──────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2)
const get     = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i+1] : null }
const hasFlag = (f: string) => args.includes(f)

const CSV_FILE  = get('--csv')
const LIMIT     = parseInt(get('--limit') ?? '20', 10)
const DELAY_SEC = parseInt(get('--delay') ?? '60', 10)  // seconds between emails
const DRY_RUN   = hasFlag('--dry-run')
const START_ROW = parseInt(get('--start') ?? '1', 10)   // skip already-sent rows

if (!CSV_FILE) {
  console.error('Usage: npx tsx src/emailSender.ts --csv leads/file.csv [--limit 20] [--dry-run]')
  process.exit(1)
}

const FROM_EMAIL = process.env.FROM_EMAIL ?? process.env.GMAIL_USER ?? ''
const FROM_NAME  = process.env.FROM_NAME  ?? 'Siva'

// ── Guard ─────────────────────────────────────────────────────────────────────
const guard = new FreeTierGuard()

// ── CSV parser (no deps) ──────────────────────────────────────────────────────
interface Lead {
  name: string
  email_guess: string
  email: string
  email_subject: string
  email_body: string
  company?: string
  product: string
}

function parseCsv(filePath: string): Lead[] {
  const raw     = fs.readFileSync(filePath, 'utf8')
  const lines   = raw.split('\n').filter(l => l.trim())
  const headers = parseRow(lines[0])
  const leads: Lead[] = []

  for (let i = 1; i < lines.length; i++) {
    const vals = parseRow(lines[i])
    const row: any = {}
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? '' })

    const to = row.email || row.email_guess
    if (!to || !to.includes('@')) continue

    leads.push({
      name:          row.name || row.first_name || 'there',
      email_guess:   to,
      email:         to,
      email_subject: row.email_subject || 'Hello',
      email_body:    row.email_body || '',
      company:       row.company || '',
      product:       row.product || '',
    })
  }
  return leads
}

function parseRow(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// ── Resend sender ─────────────────────────────────────────────────────────────
async function sendViaResend(to: string, subject: string, body: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false

  const payload = JSON.stringify({
    from:    `${FROM_NAME} <${FROM_EMAIL || `onboarding@resend.dev`}>`,
    to:      [to],
    subject,
    text:    body,
  })

  return new Promise(resolve => {
    const opts = {
      hostname: 'api.resend.com',
      path:     '/emails',
      method:   'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }
    const req = https.request(opts, res => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        if (res.statusCode === 200 || res.statusCode === 201) {
          guard.trackResend()
          resolve(true)
        } else {
          console.warn(`   Resend error (${res.statusCode}): ${text.slice(0, 100)}`)
          resolve(false)
        }
      })
    })
    req.on('error', () => resolve(false))
    req.write(payload)
    req.end()
  })
}

// ── Brevo sender ──────────────────────────────────────────────────────────────
async function sendViaBrevo(to: string, subject: string, body: string): Promise<boolean> {
  const key = process.env.BREVO_API_KEY
  if (!key) return false

  const payload = JSON.stringify({
    sender:     { name: FROM_NAME, email: FROM_EMAIL },
    to:         [{ email: to }],
    subject,
    textContent: body,
  })

  return new Promise(resolve => {
    const opts = {
      hostname: 'api.brevo.com',
      path:     '/v3/smtp/email',
      method:   'POST',
      headers: {
        'api-key':       key,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }
    const req = https.request(opts, res => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        if (res.statusCode === 200 || res.statusCode === 201) {
          guard.trackBrevo()
          resolve(true)
        } else {
          console.warn(`   Brevo error (${res.statusCode}): ${text.slice(0, 100)}`)
          resolve(false)
        }
      })
    })
    req.on('error', () => resolve(false))
    req.write(payload)
    req.end()
  })
}

// ── Gmail SMTP via nodemailer (dynamic import — optional dep) ─────────────────
async function sendViaGmail(to: string, subject: string, body: string): Promise<boolean> {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return false

  try {
    // Dynamic import — nodemailer is optional
    const nodemailer = await import('nodemailer' as any)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    })
    await transporter.sendMail({
      from:    `"${FROM_NAME}" <${user}>`,
      to,
      subject,
      text:    body,
    })
    guard.trackGmail()
    return true
  } catch (err: any) {
    console.warn(`   Gmail error: ${err.message}`)
    return false
  }
}

// ── Send one email via fallback chain ─────────────────────────────────────────
async function sendEmail(to: string, subject: string, body: string): Promise<'resend' | 'brevo' | 'gmail' | null> {
  const sender = guard.getEmailSender()

  if (!sender) {
    console.warn('🛑 All email senders exhausted for today')
    return null
  }

  if (sender === 'resend') {
    if (await sendViaResend(to, subject, body)) return 'resend'
    // Resend failed — fall through to Brevo
    console.warn('   Resend failed, trying Brevo...')
  }

  if (sender === 'brevo' || sender === 'resend') {
    if (await sendViaBrevo(to, subject, body)) return 'brevo'
    console.warn('   Brevo failed, trying Gmail...')
  }

  if (await sendViaGmail(to, subject, body)) return 'gmail'

  return null
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Sent log (track who already received email) ───────────────────────────────
const SENT_LOG = path.join(process.cwd(), '.sent-emails.json')

function loadSentLog(): Set<string> {
  try {
    if (fs.existsSync(SENT_LOG)) {
      const data = JSON.parse(fs.readFileSync(SENT_LOG, 'utf8'))
      return new Set(data.emails ?? [])
    }
  } catch { /* ignore */ }
  return new Set()
}

function saveSentLog(sent: Set<string>) {
  const existing = loadSentLog()
  const merged   = new Set([...existing, ...sent])
  fs.writeFileSync(SENT_LOG, JSON.stringify({ emails: [...merged] }, null, 2), 'utf8')
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📧 Email Sender${DRY_RUN ? ' (DRY RUN — no emails sent)' : ''}`)
  guard.printStatus()

  if (!DRY_RUN) {
    const remaining = guard.remainingEmails()
    if (remaining === 0) {
      console.error('\n🛑 All email senders exhausted for today. Run again tomorrow.')
      process.exit(0)
    }
    console.log(`\n📊 Capacity: ${remaining} emails remaining today`)
  }

  console.log(`\n📂 Reading: ${CSV_FILE}`)
  const allLeads = parseCsv(CSV_FILE!)
  console.log(`   Found ${allLeads.length} leads with email addresses`)

  // Skip already-sent
  const sentLog = loadSentLog()
  const pending = allLeads.filter(l => !sentLog.has(l.email))
  console.log(`   Already sent: ${allLeads.length - pending.length}`)
  console.log(`   Pending:      ${pending.length}`)

  // Apply limit
  const batch = pending.slice(START_ROW - 1, START_ROW - 1 + LIMIT)
  console.log(`\n🎯 Sending ${batch.length} emails (limit: ${LIMIT}, delay: ${DELAY_SEC}s)\n`)

  const newlySent = new Set<string>()
  let sent = 0, failed = 0

  for (let i = 0; i < batch.length; i++) {
    const lead    = batch[i]
    const to      = lead.email
    const subject = lead.email_subject
    const body    = lead.email_body

    process.stdout.write(`[${i+1}/${batch.length}] ${lead.name} <${to}>\n`)
    process.stdout.write(`   Subject: ${subject}\n`)

    if (DRY_RUN) {
      process.stdout.write(`   ✓ [DRY RUN — not sent]\n\n`)
      sent++
      continue
    }

    const via = await sendEmail(to, subject, body)
    if (via) {
      process.stdout.write(`   ✓ Sent via ${via}\n\n`)
      newlySent.add(to)
      sent++
    } else {
      process.stdout.write(`   ✗ Failed — all senders exhausted\n\n`)
      failed++
      break  // stop — no point continuing
    }

    // Delay between sends (avoid spam flags)
    if (i < batch.length - 1) {
      process.stdout.write(`   ⏱ Waiting ${DELAY_SEC}s...\n`)
      await sleep(DELAY_SEC * 1000)
    }
  }

  // Persist sent log
  if (newlySent.size > 0) saveSentLog(newlySent)

  console.log(`\n✅ Done`)
  console.log(`   Sent:    ${sent}`)
  console.log(`   Failed:  ${failed}`)
  console.log(`   Skipped: ${pending.length - batch.length} (tomorrow)`)

  if (pending.length > sent + failed) {
    const remaining = pending.length - sent - failed
    console.log(`\n📋 ${remaining} leads remaining — run again tomorrow`)
    console.log(`   Same command works — already-sent emails are skipped automatically`)
  }

  guard.printStatus()
}

main().catch(console.error)
