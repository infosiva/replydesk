/**
 * Re-exports crawl() as a named function so server.ts can import it
 * without triggering auto-run (crawler.ts runs immediately when required)
 */

import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { ai, aiJSON } from './ai'
dotenv.config()

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
  description: string
  streamingOn: string[]
  ottDate?: string
  rating: number
  gradient: string
  badge?: string
  tamilRelevanceScore: number
  vibeTag?: string
  crawledAt: string
}

const MOVIE_SEEDS = [
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
  { title: 'Manjummel Boys', year: 2024, language: 'Tamil Dubbed' as const, original: 'Malayalam' },
  { title: 'Lucky Baskhar', year: 2024, language: 'Tamil Dubbed' as const, original: 'Telugu' },
  { title: 'Identity', year: 2024, language: 'Tamil Dubbed' as const, original: 'Malayalam' },
  { title: 'Marco', year: 2024, language: 'Tamil Dubbed' as const, original: 'Malayalam' },
  { title: 'Pushpa 2', year: 2024, language: 'Tamil Dubbed' as const, original: 'Telugu' },
  { title: 'Devara', year: 2024, language: 'Tamil Dubbed' as const, original: 'Telugu' },
  { title: 'Kalki 2898 AD', year: 2024, language: 'Tamil Dubbed' as const, original: 'Telugu' },
]

const GRADIENT_MAP: Record<string, string> = {
  Action: 'from-red-800 via-orange-700 to-amber-600',
  Thriller: 'from-slate-800 via-gray-700 to-zinc-600',
  Drama: 'from-blue-800 via-indigo-700 to-violet-600',
  Romance: 'from-pink-700 via-rose-600 to-red-500',
  Historical: 'from-yellow-700 via-amber-600 to-orange-500',
  Comedy: 'from-green-700 via-emerald-600 to-teal-500',
  Biographical: 'from-sky-700 via-blue-600 to-indigo-500',
  War: 'from-green-800 via-lime-700 to-amber-700',
  default: 'from-violet-800 via-purple-700 to-indigo-600',
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

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

const EXTRACT_SYSTEM = `You are a Tamil cinema database expert. Extract accurate structured movie info. Return ONLY valid JSON.`
const DESC_SYSTEM = `You are a Tamil entertainment writer for nammatamil.live. Write 2-sentence descriptions resonating with Tamil diaspora. Mention the lead actor, emotional/entertainment value. Max 100 words.`
const SCORE_SYSTEM = `Score Tamil regional relevance 0-10. 9-10: Tamil superstars or massive Tamil hits. 7-8: Strong Tamil connection. 5-6: Good dubbed films. Also give a 2-3 word vibeTag like "Mass Entertainer", "Emotional Ride", "Edge of Seat", "Feel Good", "Thought Provoking". Return ONLY JSON: {"score": 7, "vibeTag": "Mass Entertainer"}`

export async function crawl(): Promise<void> {
  console.log(`\n🎬 Crawl started — ${MOVIE_SEEDS.length} movies to process`)
  const results: CrawledMovie[] = []

  for (const [i, seed] of MOVIE_SEEDS.entries()) {
    console.log(`[${i + 1}/${MOVIE_SEEDS.length}] ${seed.title} (${seed.year})`)
    try {
      // 1. Extract structured data
      const extracted = await aiJSON<Partial<CrawledMovie>>(
        EXTRACT_SYSTEM,
        `Movie: "${seed.title}" (${seed.year}) — ${seed.language}${seed.original ? `, original: ${seed.original}` : ''}
Return JSON: {"director":"","cast":[],"genre":[],"streamingOn":[],"ottDate":null,"rating":0,"badge":null}`,
        {}
      )
      await sleep(700)

      // 2. Generate description
      const description = await ai(
        DESC_SYSTEM,
        `"${seed.title}" (${seed.year}) by ${extracted.director}. Stars: ${(extracted.cast ?? []).slice(0, 3).join(', ')}. Genre: ${(extracted.genre ?? []).join(', ')}. Language: ${seed.language}.`,
        130
      )
      await sleep(600)

      // 3. Score relevance + vibe
      const { score, vibeTag } = await aiJSON<{ score: number; vibeTag: string }>(
        SCORE_SYSTEM,
        `"${seed.title}" | Cast: ${(extracted.cast ?? []).join(', ')} | Genre: ${(extracted.genre ?? []).join(', ')} | ${seed.language}`,
        { score: 6, vibeTag: 'Worth Watching' }
      )
      await sleep(600)

      results.push({
        id: `crawl-${slugify(seed.title, seed.year)}`,
        slug: slugify(seed.title, seed.year),
        title: seed.title,
        year: seed.year,
        director: extracted.director ?? 'TBA',
        cast: extracted.cast ?? [],
        genre: extracted.genre ?? [],
        language: seed.language,
        originalLanguage: (seed as any).original,
        description: description || `${seed.title} — a ${seed.year} ${seed.language} film.`,
        streamingOn: extracted.streamingOn ?? [],
        ottDate: extracted.ottDate ?? undefined,
        rating: extracted.rating ?? 0,
        gradient: gradientFor(extracted.genre ?? []),
        badge: extracted.badge ?? undefined,
        tamilRelevanceScore: score,
        vibeTag,
        crawledAt: new Date().toISOString(),
      })

      console.log(`  ✓ ${score}/10 — ${vibeTag} | OTT: ${extracted.streamingOn?.join(', ') || 'unknown'}`)
    } catch (e) {
      console.error(`  ✗ ${(e as Error).message}`)
    }
    await sleep(1000)
  }

  results.sort((a, b) => b.tamilRelevanceScore - a.tamilRelevanceScore)

  const outPath = path.join(__dirname, '..', 'data', 'movies.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), count: results.length, movies: results }, null, 2))
  console.log(`\n✅ ${results.length} movies saved → ${outPath}`)

  // Trigger Vercel rebuild
  const hook = process.env.VERCEL_DEPLOY_HOOK
  if (hook) {
    try {
      const { default: fetch } = await import('node-fetch')
      const r = await fetch(hook, { method: 'POST' })
      console.log(`🚀 Vercel deploy triggered (${r.status})`)
    } catch (e) {
      console.warn('⚠️  Vercel trigger failed:', (e as Error).message)
    }
  }
}
