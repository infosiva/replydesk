/**
 * leadScraper.ts — Find local businesses by city + category, output CSV for outreach
 *
 * Sources (no API key needed):
 *   1. Yell.com (UK business directory)
 *   2. Yelp (US/international)
 *
 * Usage:
 *   npx tsx src/leadScraper.ts --city "Manchester" --category "tutor" --product tutiq --limit 50
 *   npx tsx src/leadScraper.ts --city "London" --category "restaurant" --product draftcal --limit 100
 *   npx tsx src/leadScraper.ts --city "Birmingham" --category "gym" --product draftcal --limit 50
 *
 * Output: leads/YYYY-MM-DD-{city}-{category}.csv
 * Columns: name, address, phone, website, email_guess, product, email_subject, email_body
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import { load } from 'cheerio'

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const get  = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i+1] : null }

const CITY     = get('--city')     ?? 'London'
const CATEGORY = get('--category') ?? 'tutor'
const PRODUCT  = get('--product')  ?? 'tutiq'
const LIMIT    = parseInt(get('--limit') ?? '50', 10)
const COUNTRY  = get('--country')  ?? 'uk'   // 'uk' → Yell, 'us' → Yelp

// ── Product → email template map ─────────────────────────────────────────────
const PRODUCTS: Record<string, {
  url: string
  subject: (biz: string, city: string) => string
  body: (biz: string, city: string) => string
}> = {
  tutiq: {
    url: 'tutiq.app',
    subject: (biz, city) => `Free AI tutor for your students in ${city}`,
    body: (biz, city) => `Hi ${biz} team,

Noticed you offer tutoring in ${city}. Thought this might be useful for your students.

Tutiq is a free AI tutor — it explains any subject step by step, adapts to the student's age, and gives practice questions between your sessions. No account needed.

Some tutors share it with parents as a free bonus. Students love having help available at 10pm when homework hits.

Free at tutiq.app — takes 10 seconds to try.

Best,
Siva`,
  },

  draftcal: {
    url: 'draftcal.app',
    subject: (biz, city) => `30 days of social content for ${biz} — written by AI`,
    body: (biz, city) => `Hi ${biz} team,

Running a business in ${city} means social media often gets left behind.

DraftCal generates a full month of Instagram/Facebook posts for your business in 60 seconds — captions, hashtags, posting schedule. You just copy and paste.

Free at draftcal.app — no account needed.

Best,
Siva`,
  },

  kwizzo: {
    url: 'kwizzo.app',
    subject: (biz, city) => `Free quiz night tool for ${biz}`,
    body: (biz, city) => `Hi ${biz} team,

If you run quiz nights or events at ${biz}, this might save you a lot of prep time.

Kwizzo generates unlimited quiz questions on any topic instantly — no printing, no prep. Runs on everyone's phone, live leaderboard included.

Free at kwizzo.app

Best,
Siva`,
  },

  quizbites: {
    url: 'quizbites.app',
    subject: (biz, city) => `Run live classroom quizzes in ${city} — free`,
    body: (biz, city) => `Hi ${biz} team,

QuizBites lets you run live quizzes with any group — students answer on their phones, you see results in real time.

Works for classroom revision, training sessions, team events. No downloads for participants.

Free at quizbites.app

Best,
Siva`,
  },

  roamplan: {
    url: 'roamplan.app',
    subject: (biz, city) => `AI travel planning tool — free for your ${city} clients`,
    body: (biz, city) => `Hi ${biz} team,

RoamPlan builds full day-by-day trip itineraries with AI — clients describe where they want to go, it handles the planning.

Useful as a free tool to share with clients before they book. Builds trust and saves consultation time.

Free at roamplan.app

Best,
Siva`,
  },

  speakiq: {
    url: 'speakiq.app',
    subject: (biz, city) => `AI conversation partner for language learners in ${city}`,
    body: (biz, city) => `Hi ${biz} team,

SpeakIQ lets language learners practice real conversations with AI between lessons — it corrects grammar naturally without interrupting flow.

Works for 20+ languages. Useful to recommend to students for daily practice outside class.

Free at speakiq.app

Best,
Siva`,
  },
}

// ── Category → suggested product mapping ─────────────────────────────────────
const CATEGORY_PRODUCT_MAP: Record<string, string> = {
  tutor:       'tutiq',
  tutoring:    'tutiq',
  school:      'tutiq',
  'language school': 'speakiq',
  restaurant:  'draftcal',
  cafe:        'draftcal',
  coffee:      'draftcal',
  gym:         'draftcal',
  salon:       'draftcal',
  pub:         'kwizzo',
  bar:         'kwizzo',
  'travel agent': 'roamplan',
  hotel:       'roamplan',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
    }
    https.get(url, opts, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchHtml(res.headers.location).then(resolve).catch(reject)
        return
      }
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function guessEmail(name: string, website: string): string {
  if (!website) return ''
  try {
    const domain = new URL(website.startsWith('http') ? website : `https://${website}`).hostname
      .replace(/^www\./, '')
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
    return `info@${domain}`
  } catch { return '' }
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

// ── Yell.com scraper (UK) ─────────────────────────────────────────────────────
interface Lead {
  name:    string
  address: string
  phone:   string
  website: string
}

async function scrapeYell(category: string, city: string, pages: number): Promise<Lead[]> {
  const leads: Lead[] = []
  const query = encodeURIComponent(category)
  const loc   = encodeURIComponent(city)

  for (let page = 1; page <= pages; page++) {
    const url = `https://www.yell.com/ucs/UcsSearchAction.do?keywords=${query}&location=${loc}&pageNum=${page}`
    console.log(`  Yell page ${page}: ${url}`)
    try {
      const html = await fetchHtml(url)
      const $    = load(html)

      $('article.businessCapsule').each((_, el) => {
        const name    = $(el).find('.businessCapsule--name').text().trim()
        const address = $(el).find('.businessCapsule--address').text().trim().replace(/\s+/g, ' ')
        const phone   = $(el).find('.businessCapsule--telephone').text().trim()
        const website = $(el).find('a.businessCapsule--website').attr('href') ?? ''
        if (name) leads.push({ name, address, phone, website })
      })

      // Also try newer Yell markup
      $('[data-testid="business-name"], .businessNameAndRating h2').each((_, el) => {
        const card    = $(el).closest('[data-testid="business-card"], .businessCapsule, article')
        const name    = $(el).text().trim()
        const address = card.find('[data-testid="address"], .businessCapsule--address').text().trim().replace(/\s+/g, ' ')
        const phone   = card.find('[data-testid="phone-number"], .businessCapsule--telephone').text().trim()
        const website = card.find('a[href*="http"]').filter((_, a) => !$(a).attr('href')?.includes('yell.com')).attr('href') ?? ''
        if (name && !leads.find(l => l.name === name)) leads.push({ name, address, phone, website })
      })

      await sleep(1500 + Math.random() * 1000) // polite delay
    } catch (err) {
      console.error(`  Yell page ${page} failed:`, err)
      break
    }
  }
  return leads
}

// ── Yelp scraper (US/international) ──────────────────────────────────────────
async function scrapeYelp(category: string, city: string, pages: number): Promise<Lead[]> {
  const leads: Lead[] = []
  const query = encodeURIComponent(category)
  const loc   = encodeURIComponent(city)

  for (let page = 0; page < pages; page++) {
    const offset = page * 10
    const url = `https://www.yelp.com/search?find_desc=${query}&find_loc=${loc}&start=${offset}`
    console.log(`  Yelp page ${page + 1}: ${url}`)
    try {
      const html = await fetchHtml(url)
      const $    = load(html)

      // Yelp biz cards
      $('[data-testid="serp-ia-card"], .businessName__09f24__WSMM, h3 a[href*="/biz/"]').each((_, el) => {
        const name    = $(el).text().trim()
        const href    = $(el).attr('href') ?? ''
        const address = $(el).closest('li, [data-testid]').find('address, p').first().text().trim()
        if (name && href.includes('/biz/')) {
          leads.push({ name, address, phone: '', website: `https://yelp.com${href}` })
        }
      })

      await sleep(2000 + Math.random() * 1000)
    } catch (err) {
      console.error(`  Yelp page ${page + 1} failed:`, err)
      break
    }
  }
  return leads
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const productKey = PRODUCT in PRODUCTS
    ? PRODUCT
    : CATEGORY_PRODUCT_MAP[CATEGORY.toLowerCase()] ?? 'draftcal'

  const product = PRODUCTS[productKey]
  const pages   = Math.ceil(LIMIT / 10)

  console.log(`\n🔍 Scraping: "${CATEGORY}" in ${CITY} (${COUNTRY.toUpperCase()})`)
  console.log(`📦 Product: ${productKey} → ${product.url}`)
  console.log(`📄 Pages: ${pages} (~${pages * 10} results)\n`)

  let rawLeads: Lead[] = []

  if (COUNTRY === 'uk') {
    rawLeads = await scrapeYell(CATEGORY, CITY, pages)
  } else {
    rawLeads = await scrapeYelp(CATEGORY, CITY, pages)
  }

  // Deduplicate by name
  const seen  = new Set<string>()
  const leads = rawLeads.filter(l => {
    const key = l.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, LIMIT)

  console.log(`\n✅ ${leads.length} unique leads found`)

  // Build CSV
  const outDir = path.join(process.cwd(), 'leads')
  fs.mkdirSync(outDir, { recursive: true })

  const date     = new Date().toISOString().slice(0, 10)
  const filename = `${date}-${CITY.toLowerCase().replace(/\s+/g, '-')}-${CATEGORY.toLowerCase().replace(/\s+/g, '-')}-${productKey}.csv`
  const outPath  = path.join(outDir, filename)

  const header = ['name', 'address', 'phone', 'website', 'email_guess', 'product', 'url', 'email_subject', 'email_body']
  const rows   = leads.map(l => {
    const emailGuess = guessEmail(l.name, l.website)
    const subject    = product.subject(l.name, CITY)
    const body       = product.body(l.name, CITY)
    return [l.name, l.address, l.phone, l.website, emailGuess, productKey, product.url, subject, body]
      .map(csvEscape).join(',')
  })

  fs.writeFileSync(outPath, [header.join(','), ...rows].join('\n'), 'utf8')

  console.log(`\n📁 CSV saved: leads/${filename}`)
  console.log(`\n--- PREVIEW (first 3) ---`)
  leads.slice(0, 3).forEach(l => {
    console.log(`  ${l.name} | ${l.phone} | ${l.website || 'no website'}`)
    console.log(`  → ${product.subject(l.name, CITY)}`)
    console.log()
  })

  console.log(`\n📋 Next steps:`)
  console.log(`  1. Open leads/${filename} in Excel/Sheets`)
  console.log(`  2. Filter rows that have email_guess or website`)
  console.log(`  3. Import into Instantly.ai or Apollo.io`)
  console.log(`  4. Send 20-30/day max — don't blast all at once`)
}

main().catch(console.error)
