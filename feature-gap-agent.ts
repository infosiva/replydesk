#!/usr/bin/env npx ts-node
/**
 * Feature Gap Agent
 * Compares each product vs market leaders, outputs prioritised missing features.
 * Run: npx ts-node feature-gap-agent.ts
 * Requires: GROQ_API_KEY in environment
 */

import * as fs from 'fs'
import * as path from 'path'

const GROQ_API_KEY = process.env.GROQ_API_KEY

const SITES: Record<string, {
  name: string
  url: string
  category: string
  competitors: string[]
  currentFeatures: string[]
}> = {
  'aijobsportal': {
    name: 'AI Jobs Portal',
    url: 'https://www.aijobsportal.app',
    category: 'AI job board',
    competitors: ['Jobright.ai', 'Careerflow.ai', 'Teal HQ', 'Loopcv'],
    currentFeatures: ['job listings', 'search', 'filters', 'sign up', 'employer dashboard'],
  },
  'trackwealth': {
    name: 'TrackWealth',
    url: 'https://trackwealth.app',
    category: 'investment portfolio tracker',
    competitors: ['Copilot Money', 'Wealthfront', 'Empower (Personal Capital)', 'Kubera'],
    currentFeatures: ['portfolio tracking', 'AI insights', 'alerts', 'real-time quotes'],
  },
  'speakiq': {
    name: 'SpeakIQ',
    url: 'https://speakiq.app',
    category: 'AI language learning app',
    competitors: ['Duolingo', 'ELSA Speak', 'Speak app', 'Busuu'],
    currentFeatures: ['conversation mode', 'vocabulary', 'grammar', 'quiz', 'translate', 'story', 'roleplay scenarios', 'daily phrase', 'streak tracking', 'flashcards'],
  },
  'tutiq': {
    name: 'Tutiq',
    url: 'https://tutiq.app',
    category: 'AI exam tutor and interview coach',
    competitors: ['Khan Academy', 'Khanmigo AI', 'Cognii', 'Photomath'],
    currentFeatures: ['GCSE tutoring', '11+ prep', 'interview coaching', 'structured lesson path', 'timed exam practice', 'mock exams', 'quiz after topics'],
  },
  'quizbytesdaily': {
    name: 'QuizBytesDaily',
    url: 'https://quizbytes.dev',
    category: 'daily tech quiz platform',
    competitors: ['Daily.dev', 'LeetCode', 'HackerRank', 'Codewars'],
    currentFeatures: ['daily quiz', 'topic categories', 'YouTube shorts', 'leaderboard', 'play mode'],
  },
  'worldtrends': {
    name: 'WorldTrends',
    url: 'https://worldtrends.today',
    category: 'global trend intelligence dashboard',
    competitors: ['Exploding Topics', 'Google Trends', 'Glimpse', 'Trend Hunter'],
    currentFeatures: ['live trends feed', 'category filters', 'trend cards', 'about page', 'blog'],
  },
  'complybuddy': {
    name: 'ComplyScan',
    url: 'https://complyscan.app',
    category: 'AI compliance checker SaaS',
    competitors: ['Vanta', 'Drata', 'Sprinto', 'Scrut.io'],
    currentFeatures: ['compliance scanning', 'AI analysis', 'report generation', 'policy checker'],
  },
  'clawdbotai': {
    name: 'ClawdBotAI',
    url: 'https://clawdbotai.tech',
    category: 'AI project showcase platform',
    competitors: ['There\'s An AI For That', 'Futurepedia', 'Product Hunt', 'GitHub Trending'],
    currentFeatures: ['project listings', 'trending section', 'charts', 'dashboard', 'editorial blog', 'category filters'],
  },
}

const FEATURE_GAP_PROMPT = (site: typeof SITES[string]) => `
You are a senior product strategist. Compare this product vs its market leaders and find the highest-impact missing features.

Product: ${site.name} (${site.url})
Category: ${site.category}
Competitors: ${site.competitors.join(', ')}
Current features: ${site.currentFeatures.join(', ')}

Market leaders in "${site.category}" have these categories of features. For each, state:
1. Does ${site.name} have it? (yes/no/partial)
2. Impact if added: High/Medium/Low
3. Build effort: Easy (1-2 days) / Medium (1 week) / Hard (2+ weeks)
4. One-line implementation idea

Output as JSON array:
[
  {
    "feature": "feature name",
    "hasIt": false,
    "impact": "High",
    "effort": "Easy",
    "implementation": "one line how to build it",
    "competitor": "who has it"
  }
]

Focus on: user engagement, retention, monetisation, SEO, and virality features.
Return ONLY the JSON array, no other text.
`

async function analyseGap(siteKey: string, site: typeof SITES[string]): Promise<void> {
  console.log(`\n🔍 Analysing ${site.name}...`)

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: FEATURE_GAP_PROMPT(site) }],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  })

  if (!res.ok) {
    console.error(`  ❌ API error: ${res.status}`)
    return
  }

  const data = await res.json() as { choices: { message: { content: string } }[] }
  const content = data.choices[0]?.message?.content?.trim() ?? ''

  let features: {
    feature: string
    hasIt: boolean
    impact: string
    effort: string
    implementation: string
    competitor: string
  }[] = []

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    features = jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch {
    console.error(`  ❌ JSON parse failed for ${site.name}`)
    return
  }

  const missing = features.filter(f => !f.hasIt)
  const highImpactEasy = missing.filter(f => f.impact === 'High' && f.effort === 'Easy')
  const highImpactMed = missing.filter(f => f.impact === 'High' && f.effort === 'Medium')

  console.log(`\n  ✅ ${site.name} — ${missing.length} missing features found`)
  console.log(`  🚀 High Impact + Easy: ${highImpactEasy.length}`)
  console.log(`  📈 High Impact + Medium: ${highImpactMed.length}`)

  if (highImpactEasy.length > 0) {
    console.log('\n  🔥 BUILD THESE FIRST (High Impact, Easy):')
    highImpactEasy.forEach(f => {
      console.log(`    • ${f.feature} (from ${f.competitor})`)
      console.log(`      → ${f.implementation}`)
    })
  }

  // Save report
  const reportDir = path.join(process.cwd(), 'feature-gap-reports')
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir)

  const report = {
    site: site.name,
    url: site.url,
    generatedAt: new Date().toISOString(),
    totalMissing: missing.length,
    features: missing.sort((a, b) => {
      const impactOrder = { High: 0, Medium: 1, Low: 2 }
      const effortOrder = { Easy: 0, Medium: 1, Hard: 2 }
      return (impactOrder[a.impact as keyof typeof impactOrder] - impactOrder[b.impact as keyof typeof impactOrder]) ||
             (effortOrder[a.effort as keyof typeof effortOrder] - effortOrder[b.effort as keyof typeof effortOrder])
    }),
  }

  fs.writeFileSync(
    path.join(reportDir, `${siteKey}.json`),
    JSON.stringify(report, null, 2)
  )

  console.log(`  💾 Report saved: feature-gap-reports/${siteKey}.json`)
}

async function main() {
  if (!GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY not set')
    process.exit(1)
  }

  console.log('🤖 Feature Gap Agent — comparing all sites vs market leaders\n')
  console.log(`📊 Analysing ${Object.keys(SITES).length} sites sequentially (rate limit safe)...\n`)

  for (const [key, site] of Object.entries(SITES)) {
    await analyseGap(key, site)
    await new Promise(r => setTimeout(r, 1500)) // 1.5s between calls
  }

  console.log('\n✅ All reports generated in feature-gap-reports/')
  console.log('📋 Review each JSON file for prioritised feature lists')
  console.log('💡 Sort by impact=High + effort=Easy for quick wins\n')
}

main().catch(console.error)
