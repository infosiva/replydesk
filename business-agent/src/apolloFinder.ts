/**
 * apolloFinder.ts — Find business leads via Apollo.io free tier
 *
 * Free tier: 50 email credits/month, unlimited people search (with email reveal capped)
 * API docs: https://apolloio.github.io/apollo-api-docs/
 *
 * Best for: professionals (tutors, coaches, consultants, therapists, accountants)
 * Use OSM (leadFinder.ts) for: restaurants, cafes, pubs, gyms (location-based, no named contacts needed)
 *
 * Usage:
 *   npx tsx src/apolloFinder.ts --city "Manchester" --industry "tutoring" --product tutiq --limit 50
 *   npx tsx src/apolloFinder.ts --city "London" --industry "education" --product tutiq --limit 50
 *   npx tsx src/apolloFinder.ts --city "Birmingham" --industry "coaching" --product draftcal --limit 50
 *
 * Env vars:
 *   APOLLO_API_KEY — Apollo.io API key (free at app.apollo.io/settings/integrations/api)
 *
 * Output: leads/YYYY-MM-DD-{city}-{industry}-apollo-{product}.csv
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '../.env.shared') })

// ── CLI args ──────────────────────────────────────────────────────────────────
const args  = process.argv.slice(2)
const get   = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i+1] : null }

const CITY      = get('--city')     ?? 'Manchester'
const INDUSTRY  = get('--industry') ?? 'tutoring'
const PRODUCT   = get('--product')  ?? 'tutiq'
const LIMIT     = parseInt(get('--limit') ?? '50', 10)
const API_KEY   = process.env.APOLLO_API_KEY ?? ''

if (!API_KEY) {
  console.error('\n❌ APOLLO_API_KEY not set')
  console.error('   Get free key: app.apollo.io → Settings → Integrations → API')
  console.error('   Add to agents/.env.shared: APOLLO_API_KEY=your_key\n')
  process.exit(1)
}

// ── Product templates ─────────────────────────────────────────────────────────
const PRODUCTS: Record<string, {
  url: string
  subject: (name: string, city: string) => string
  body: (name: string, city: string) => string
}> = {
  tutiq: {
    url: 'tutiq.app',
    subject: (name, city) => `Free AI tutor for your students in ${city}`,
    body: (name, city) =>
`Hi ${name},

Noticed you do tutoring in ${city} — thought Tutiq might be useful for your students.

It's a free AI tutor that explains any subject step by step, adapts to the student's age, and gives practice questions. Students use it between sessions when you're unavailable.

No account needed. Free at tutiq.app.

Siva`,
  },

  draftcal: {
    url: 'draftcal.app',
    subject: (name, city) => `30 days of social posts — written by AI`,
    body: (name, city) =>
`Hi ${name},

Running a business in ${city} means social media often gets left behind.

DraftCal generates a full month of Instagram/Facebook captions in 60 seconds. You just copy and post.

Free at draftcal.app

Siva`,
  },

  kwizzo: {
    url: 'kwizzo.app',
    subject: (name, city) => `Free quiz tool for events`,
    body: (name, city) =>
`Hi ${name},

If you run quiz nights or events, Kwizzo saves a lot of prep.

AI generates questions on any topic instantly. Runs on everyone's phone — no downloads, live leaderboard.

Free at kwizzo.app

Siva`,
  },

  speakiq: {
    url: 'speakiq.app',
    subject: (name, city) => `AI conversation practice for language learners`,
    body: (name, city) =>
`Hi ${name},

SpeakIQ gives language learners a conversation partner to practice with between lessons — corrects grammar naturally, available any time.

Works for 20+ languages. Free to share with students.

Free at speakiq.app

Siva`,
  },

  roamplan: {
    url: 'roamplan.app',
    subject: (name, city) => `AI itinerary tool for your clients`,
    body: (name, city) =>
`Hi ${name},

RoamPlan builds full day-by-day trip itineraries with AI — clients describe the trip, it handles the planning.

Useful to share with clients before they book. Saves consultation time.

Free at roamplan.app

Siva`,
  },
}

// ── Industry → product mapping ────────────────────────────────────────────────
const INDUSTRY_PRODUCT: Record<string, string> = {
  tutoring:          'tutiq',
  tutor:             'tutiq',
  education:         'tutiq',
  'private tutor':   'tutiq',
  coaching:          'tutiq',
  'language school': 'speakiq',
  'travel agency':   'roamplan',
  'travel agent':    'roamplan',
}

// ── Apollo.io API types ───────────────────────────────────────────────────────
interface ApolloPerson {
  id: string
  first_name: string
  last_name: string
  name: string
  title: string
  email: string | null
  linkedin_url: string
  city: string
  country: string
  organization: {
    name: string
    website_url: string
    phone: string
  } | null
}

interface ApolloSearchResponse {
  people: ApolloPerson[]
  pagination: {
    page: number
    per_page: number
    total_entries: number
    total_pages: number
  }
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function postJson<T>(url: string, body: object, apiKey: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const parsed  = new URL(url)
    const opts = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers:  {
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Cache-Control': 'no-cache',
        'X-Api-Key':     apiKey,
      },
    }
    const req = https.request(opts, res => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        try { resolve(JSON.parse(text)) }
        catch (e) { reject(new Error(`Apollo parse error (${res.statusCode}): ${text.slice(0, 300)}`)) }
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Apollo People Search ──────────────────────────────────────────────────────
async function searchApollo(
  city: string,
  industry: string,
  page: number,
  perPage: number,
): Promise<ApolloSearchResponse> {
  // Map industry to Apollo person_titles for better matching
  const titleMap: Record<string, string[]> = {
    tutoring:        ['tutor', 'private tutor', 'maths tutor', 'english tutor', 'science tutor', 'tutoring director'],
    tutor:           ['tutor', 'private tutor', 'tutoring'],
    education:       ['teacher', 'tutor', 'instructor', 'educator', 'education manager'],
    coaching:        ['coach', 'life coach', 'business coach', 'executive coach'],
    'language school': ['language teacher', 'esl teacher', 'language school', 'language instructor'],
    'travel agency': ['travel agent', 'travel consultant', 'travel manager', 'travel director'],
    'travel agent':  ['travel agent', 'travel consultant'],
  }

  const titles = titleMap[industry.toLowerCase()] ?? [industry]

  return postJson<ApolloSearchResponse>(
    'https://api.apollo.io/v1/mixed_people/search',
    {
      api_key:         API_KEY,
      q_person_title:  titles,
      person_locations: [`${city}, United Kingdom`],
      page,
      per_page:        perPage,
    },
    API_KEY,
  )
}

// ── Email reveal (costs 1 credit per reveal — use sparingly) ──────────────────
async function revealEmail(personId: string): Promise<string | null> {
  interface RevealResponse { person?: { email?: string } }
  try {
    const res = await postJson<RevealResponse>(
      'https://api.apollo.io/v1/people/match',
      { api_key: API_KEY, id: personId, reveal_personal_emails: false },
      API_KEY,
    )
    return res.person?.email ?? null
  } catch { return null }
}

// ── CSV helpers ───────────────────────────────────────────────────────────────
function csvEsc(s: string): string {
  s = String(s ?? '')
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const productKey = PRODUCTS[PRODUCT]
    ? PRODUCT
    : INDUSTRY_PRODUCT[INDUSTRY.toLowerCase()] ?? 'draftcal'
  const product = PRODUCTS[productKey]

  console.log(`\n🔍 Apollo.io: "${INDUSTRY}" in ${CITY}`)
  console.log(`📦 Product: ${productKey} → ${product.url}`)
  console.log(`🎯 Target: ${LIMIT} leads\n`)
  console.log(`💡 Free tier: 50 email reveals/month — reveals used sparingly\n`)

  const leads: Array<{
    name: string; title: string; company: string
    website: string; email: string; linkedin: string
    city: string
  }> = []

  let page = 1
  const perPage = Math.min(25, LIMIT) // Apollo free: max 25/page

  while (leads.length < LIMIT) {
    console.log(`📄 Page ${page}...`)
    let res: ApolloSearchResponse
    try {
      res = await searchApollo(CITY, INDUSTRY, page, perPage)
    } catch (err: any) {
      console.error(`❌ Apollo search failed: ${err.message}`)
      break
    }

    if (!res.people?.length) {
      console.log(`   No more results`)
      break
    }

    console.log(`   Found ${res.people.length} (total: ${res.pagination?.total_entries ?? '?'})`)

    for (const p of res.people) {
      if (leads.length >= LIMIT) break

      const email = p.email ?? ''  // Apollo sometimes returns email directly on free tier
      leads.push({
        name:    p.name ?? `${p.first_name} ${p.last_name}`.trim(),
        title:   p.title ?? '',
        company: p.organization?.name ?? '',
        website: p.organization?.website_url ?? '',
        email,
        linkedin: p.linkedin_url ?? '',
        city:    p.city ?? CITY,
      })

      if (email) {
        process.stdout.write(`   ✓ ${p.name} (${p.title}) — ${email}\n`)
      } else {
        process.stdout.write(`   · ${p.name} (${p.title}) — no email\n`)
      }
    }

    if (page >= (res.pagination?.total_pages ?? 1)) break
    page++
    await sleep(1000) // respect rate limits
  }

  // Sort: with email first
  leads.sort((a, b) => {
    if (a.email && !b.email) return -1
    if (!a.email && b.email) return 1
    return 0
  })

  // Write CSV
  const outDir   = path.join(process.cwd(), 'leads')
  fs.mkdirSync(outDir, { recursive: true })

  const date     = new Date().toISOString().slice(0, 10)
  const slug     = `${CITY}-${INDUSTRY}-apollo-${productKey}`.toLowerCase().replace(/\s+/g, '-')
  const filename = `${date}-${slug}.csv`
  const outPath  = path.join(outDir, filename)

  const header = [
    'name', 'title', 'company', 'website', 'email', 'linkedin',
    'city', 'product', 'url', 'email_subject', 'email_body',
  ]

  const rows = leads.map(l => [
    l.name, l.title, l.company, l.website, l.email, l.linkedin, l.city,
    productKey, product.url,
    product.subject(l.name.split(' ')[0] || l.name, CITY),
    product.body(l.name.split(' ')[0] || l.name, CITY),
  ].map(csvEsc).join(','))

  fs.writeFileSync(outPath, [header.join(','), ...rows].join('\n'), 'utf8')

  const withEmail = leads.filter(l => l.email).length
  console.log(`\n✅ Done — ${leads.length} leads`)
  console.log(`   With email:    ${withEmail}`)
  console.log(`   Without email: ${leads.length - withEmail} (use LinkedIn or Hunter.io to find)`)
  console.log(`\n📁 Saved: leads/${filename}`)

  console.log(`\n--- TOP 5 LEADS ---`)
  leads.slice(0, 5).forEach((l, i) => {
    console.log(`${i + 1}. ${l.name} — ${l.title}`)
    console.log(`   🏢 ${l.company || 'self-employed'}`)
    console.log(`   📧 ${l.email || 'no email — check LinkedIn'}`)
    console.log(`   🔗 ${l.linkedin || 'no LinkedIn'}`)
    console.log()
  })

  console.log(`📋 Next steps:`)
  console.log(`   1. Open leads/${filename}`)
  console.log(`   2. Rows with email → send via Resend (free 100/day)`)
  console.log(`   3. Rows without email → connect on LinkedIn first`)
  console.log(`   4. Max 20-30 emails/day from a warmed domain`)
  console.log(`   5. Apollo free: 50 email reveals/month — use wisely\n`)
}

main().catch(console.error)
