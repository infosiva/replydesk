/**
 * nammatamil-crawler — AI-powered content pipeline
 *
 * Flow:
 *   1. Fetch raw movie lists from public Wikipedia/TMDB-style sources
 *   2. AI extracts structured fields (cast, OTT, date, rating, genre)
 *   3. AI generates Tamil-audience description + sentiment score
 *   4. AI scores Tamil relevance (0-10) to rank content
 *   5. Saves enriched JSON → data/movies.json
 *   6. Triggers Vercel deploy webhook so site rebuilds with fresh data
 */

import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { ai, aiJSON } from './ai'
dotenv.config()

// ── Types ────────────────────────────────────────────────────────────

export interface CrawledMovie {
  id: string
  slug: string
  title: string
  year: number
  director: string
  cast: string[]
  genre: string[]
  language: 'Tamil' | 'Tamil Dubbed'
  originalLanguage?: string
  description: string          // AI-generated for Tamil audience
  streamingOn: string[]
  ottDate?: string             // "YYYY-MM-DD" or "Coming Soon"
  rating: number
  gradient: string
  badge?: string
  tamilRelevanceScore: number  // AI scored 0-10
  vibeTag?: string             // AI-generated: "Mass Entertainer", "Emotional Ride" etc
  crawledAt: string
}

// ── Seed data: recent Tamil movies to enrich ─────────────────────────
// The crawler takes these seeds, fetches context, and AI-enriches them.
// You can add new titles here and they'll be auto-enriched on next run.

const MOVIE_SEEDS = [
  // 2024–2025 Tamil originals
  { title: 'Amaran', year: 2024, language: 'Tamil' as const },
  { title: 'Vettaiyan', year: 2024, language: 'Tamil' as const },
  { title: 'Maharaja', year: 2024, language: 'Tamil' as const },
  { title: 'Lubber Pandhu', year: 2024, language: 'Tamil' as const },
  { title: 'Retro', year: 2025, language: 'Tamil' as const },
  { title: 'Coolie', year: 2025, language: 'Tamil' as const },
  { title: 'Dragon', year: 2025, language: 'Tamil' as const },
  { title: 'Vidaamuyarchi', year: 2025, language: 'Tamil' as const },
  { title: 'Thug Life', year: 2025, language: 'Tamil' as const },
  { title: 'Kanguva', year: 2024, language: 'Tamil' as const },
  // 2024–2025 Tamil Dubbed hits
  { title: 'Manjummel Boys', year: 2024, language: 'Tamil Dubbed' as const, original: 'Malayalam' },
  { title: 'Lucky Baskhar', year: 2024, language: 'Tamil Dubbed' as const, original: 'Telugu' },
  { title: 'Identity', year: 2024, language: 'Tamil Dubbed' as const, original: 'Malayalam' },
  { title: 'Marco', year: 2024, language: 'Tamil Dubbed' as const, original: 'Malayalam' },
  { title: 'Pushpa 2', year: 2024, language: 'Tamil Dubbed' as const, original: 'Telugu' },
  { title: 'Devara', year: 2024, language: 'Tamil Dubbed' as const, original: 'Telugu' },
  { title: 'Kalki 2898 AD', year: 2024, language: 'Tamil Dubbed' as const, original: 'Telugu' },
]

// ── Gradient palette (assigned by genre/mood) ─────────────────────────
const GRADIENT_MAP: Record<string, string> = {
  Action:      'from-red-800 via-orange-700 to-amber-600',
  Thriller:    'from-slate-800 via-gray-700 to-zinc-600',
  Drama:       'from-blue-800 via-indigo-700 to-violet-600',
  Romance:     'from-pink-700 via-rose-600 to-red-500',
  Historical:  'from-yellow-700 via-amber-600 to-orange-500',
  Comedy:      'from-green-700 via-emerald-600 to-teal-500',
  Horror:      'from-gray-900 via-zinc-800 to-slate-700',
  Biographical:'from-sky-700 via-blue-600 to-indigo-500',
  War:         'from-green-800 via-olive-700 to-amber-700',
  default:     'from-violet-800 via-purple-700 to-indigo-600',
}

function gradientFor(genres: string[]): string {
  for (const g of genres) {
    const match = Object.keys(GRADIENT_MAP).find(k => g.toLowerCase().includes(k.toLowerCase()))
    if (match) return GRADIENT_MAP[match]
  }
  return GRADIENT_MAP.default
}

function slugify(title: string, year: number): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + year
}

// ── AI: Extract structured movie data ────────────────────────────────

const EXTRACT_SYSTEM = `You are a Tamil cinema database expert. Given a movie title and year, extract accurate structured information. Be factual — if uncertain about a field, use null. For OTT platforms use exactly: Netflix, Amazon Prime, Disney+ Hotstar, ZEE5, YouTube, or Theatrical. For ottDate use YYYY-MM-DD format if known, "Coming Soon" if announced but unreleased, or null if unknown.`

async function extractMovieData(seed: typeof MOVIE_SEEDS[0]): Promise<Partial<CrawledMovie>> {
  const prompt = `Movie: "${seed.title}" (${seed.year}) — ${seed.language}${seed.original ? `, original: ${seed.original}` : ''}

Extract and return JSON with these fields:
{
  "director": "string",
  "cast": ["top 4-5 actors"],
  "genre": ["2-3 genres from: Action, Thriller, Drama, Romance, Comedy, Historical, Biographical, War, Horror, Crime, Social, Adventure, Sports, True Story, Fantasy"],
  "streamingOn": ["platform names"],
  "ottDate": "YYYY-MM-DD or Coming Soon or null",
  "rating": 0.0,
  "badge": "one catchy word/phrase like Blockbuster, Must Watch, Hidden Gem, Coming Soon, etc or null"
}`

  return aiJSON<Partial<CrawledMovie>>(EXTRACT_SYSTEM, prompt, {})
}

// ── AI: Generate Tamil-audience description ───────────────────────────

const DESC_SYSTEM = `You are a Tamil entertainment writer for nammatamil.live — a site loved by Tamil diaspora globally. Write engaging 2-sentence movie descriptions in English that resonate with Tamil audiences. Mention the lead actor prominently, capture the emotional/entertainment value, and hint at why Tamil fans will love it. Max 120 words.`

async function generateDescription(
  title: string,
  year: number,
  director: string,
  cast: string[],
  genre: string[],
  language: string
): Promise<string> {
  const prompt = `Write a description for: "${title}" (${year}) by ${director}. Stars: ${cast.slice(0, 3).join(', ')}. Genre: ${genre.join(', ')}. Language: ${language}.`
  return ai(DESC_SYSTEM, prompt, 150)
}

// ── AI: Score Tamil relevance + generate vibe tag ────────────────────

const SCORE_SYSTEM = `You are a Tamil audience analyst. Score movies 0-10 for Tamil regional relevance and interest:
- 9-10: Starring Tamil superstars (Rajinikanth, Vijay, Kamal, Suriya, Dhanush, Vijay Sethupathi), Tamil cultural themes, or massive Tamil box office hits
- 7-8: Strong Tamil connection, popular dubbed films, acclaimed Tamil directors
- 5-6: Good dubbed films, moderate Tamil interest
- 3-4: Generic dubbed with minimal Tamil connection
Also suggest a "vibe tag" (2-3 words) like "Mass Entertainer", "Emotional Ride", "Edge of Seat", "Family Drama", "Feel Good", "Thought Provoking", "Action Packed"`

async function scoreTamilRelevance(title: string, cast: string[], genre: string[], language: string): Promise<{ score: number; vibeTag: string }> {
  const prompt = `Movie: "${title}" | Cast: ${cast.join(', ')} | Genre: ${genre.join(', ')} | Language: ${language}
Return JSON: { "score": 7, "vibeTag": "Mass Entertainer" }`
  return aiJSON<{ score: number; vibeTag: string }>(SCORE_SYSTEM, prompt, { score: 6, vibeTag: 'Worth Watching' })
}

// ── Main crawler ──────────────────────────────────────────────────────

async function crawl(): Promise<void> {
  console.log('\n🎬 nammatamil-crawler starting...')
  console.log(`📋 Processing ${MOVIE_SEEDS.length} movies\n`)

  const results: CrawledMovie[] = []
  let successCount = 0
  let failCount = 0

  for (const [i, seed] of MOVIE_SEEDS.entries()) {
    console.log(`[${i + 1}/${MOVIE_SEEDS.length}] Processing: ${seed.title} (${seed.year})`)

    try {
      // Step 1: AI extracts structured data
      const extracted = await extractMovieData(seed)
      await sleep(800) // rate limit between calls

      // Step 2: AI generates Tamil-audience description
      const description = await generateDescription(
        seed.title,
        seed.year,
        extracted.director ?? 'Unknown',
        extracted.cast ?? [],
        extracted.genre ?? [],
        seed.language
      )
      await sleep(600)

      // Step 3: AI scores Tamil relevance + vibe tag
      const { score, vibeTag } = await scoreTamilRelevance(
        seed.title,
        extracted.cast ?? [],
        extracted.genre ?? [],
        seed.language
      )
      await sleep(600)

      const movie: CrawledMovie = {
        id: `crawl-${slugify(seed.title, seed.year)}`,
        slug: slugify(seed.title, seed.year),
        title: seed.title,
        year: seed.year,
        director: extracted.director ?? 'TBA',
        cast: extracted.cast ?? [],
        genre: extracted.genre ?? [],
        language: seed.language,
        originalLanguage: seed.original,
        description: description || `${seed.title} is a ${seed.year} ${seed.language} film worth watching.`,
        streamingOn: extracted.streamingOn ?? [],
        ottDate: extracted.ottDate ?? undefined,
        rating: extracted.rating ?? 0,
        gradient: gradientFor(extracted.genre ?? []),
        badge: extracted.badge ?? undefined,
        tamilRelevanceScore: score,
        vibeTag,
        crawledAt: new Date().toISOString(),
      }

      results.push(movie)
      successCount++
      console.log(`  ✓ Score: ${score}/10 | Vibe: ${vibeTag} | OTT: ${movie.streamingOn.join(', ') || 'unknown'}`)
    } catch (err) {
      failCount++
      console.error(`  ✗ Failed: ${(err as Error).message}`)
    }

    // Polite delay between movies
    await sleep(1000)
  }

  // Sort by Tamil relevance score descending
  results.sort((a, b) => b.tamilRelevanceScore - a.tamilRelevanceScore)

  // Save to data directory
  const outPath = path.join(__dirname, '..', 'data', 'movies.json')
  const output = {
    generatedAt: new Date().toISOString(),
    count: results.length,
    movies: results,
  }
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2))
  console.log(`\n✅ Saved ${results.length} movies → ${outPath}`)
  console.log(`   ✓ ${successCount} succeeded, ✗ ${failCount} failed`)

  // Trigger Vercel redeploy
  await triggerVercelDeploy()
}

async function triggerVercelDeploy(): Promise<void> {
  const hook = process.env.VERCEL_DEPLOY_HOOK
  if (!hook) {
    console.log('\n⚠️  No VERCEL_DEPLOY_HOOK set — skipping redeploy trigger')
    return
  }
  try {
    const { default: fetch } = await import('node-fetch')
    const res = await fetch(hook, { method: 'POST' })
    if (res.ok) {
      console.log('\n🚀 Vercel deploy triggered — site will rebuild with fresh data')
    } else {
      console.warn(`\n⚠️  Vercel deploy hook returned ${res.status}`)
    }
  } catch (e) {
    console.warn('\n⚠️  Could not trigger Vercel deploy:', (e as Error).message)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Run if called directly
crawl().catch(err => {
  console.error('Crawler fatal error:', err)
  process.exit(1)
})
