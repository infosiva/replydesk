import { generateText } from './ai'
import type {
  ContentBrief,
  BlogPost,
  PodcastEpisode,
  VideoStoryboard,
  LinkedInPosts,
  EmailSequence,
  ShortClips,
  LeadGenPack,
  ClientReport,
} from './types'

const sys = 'You are an expert content strategist and copywriter. Respond ONLY with valid JSON. No markdown fences, no explanation.'

function briefContext(brief: ContentBrief) {
  return `Brand: ${brief.brand}
Topic: ${brief.topic}
Audience: ${brief.audience}
Tone: ${brief.tone}
Keywords: ${brief.keywords.join(', ')}`
}

export async function generateBlogPost(brief: ContentBrief): Promise<BlogPost> {
  const prompt = `${briefContext(brief)}

Write a 1,200-word SEO blog post. Return JSON:
{
  "title": "...",
  "metaDescription": "140-160 char SEO description",
  "sections": [
    { "heading": "...", "body": "..." }
  ]
}
Include at least 5 sections. Use the keywords naturally.`

  const raw = await generateText(prompt, sys)
  return JSON.parse(raw)
}

export async function generatePodcastEpisode(brief: ContentBrief): Promise<PodcastEpisode> {
  const prompt = `${briefContext(brief)}

Write a podcast episode script (~8 minutes). Return JSON:
{
  "title": "...",
  "hook": "30-second opening hook",
  "outline": ["point1", "point2", "point3", "point4", "point5"],
  "script": "full conversational script",
  "showNotes": "episode show notes",
  "promoPulls": ["pull quote 1", "pull quote 2", "pull quote 3"]
}`

  const raw = await generateText(prompt, sys)
  return JSON.parse(raw)
}

export async function generateVideoStoryboard(brief: ContentBrief): Promise<VideoStoryboard> {
  const prompt = `${briefContext(brief)}

Create a faceless YouTube video storyboard (~5 minutes). Return JSON:
{
  "title": "...",
  "voiceoverScript": "full voiceover script",
  "scenes": [
    { "timestamp": "0:00", "visual": "what viewers see", "broll": "fal.ai prompt for this scene" }
  ],
  "callToAction": "end CTA"
}
Include 6-8 scenes.`

  const raw = await generateText(prompt, sys)
  return JSON.parse(raw)
}

export async function generateLinkedInPosts(brief: ContentBrief): Promise<LinkedInPosts> {
  const prompt = `${briefContext(brief)}

Write 3 LinkedIn posts with different angles. Return JSON:
{
  "posts": [
    { "hook": "attention-grabbing first line", "body": "post body with line breaks", "cta": "call to action" }
  ]
}
Angles: thought leadership, story-based, data/insight.`

  const raw = await generateText(prompt, sys)
  return JSON.parse(raw)
}

export async function generateEmailSequence(brief: ContentBrief): Promise<EmailSequence> {
  const prompt = `${briefContext(brief)}

Write a 5-email nurture sequence. Return JSON:
{
  "emails": [
    { "subject": "...", "preview": "preview text", "body": "email body", "sendDay": 0 }
  ]
}
Days: 0, 2, 5, 8, 14. Progression: welcome → value → social proof → objection handle → offer.`

  const raw = await generateText(prompt, sys)
  return JSON.parse(raw)
}

export async function generateShortClips(brief: ContentBrief): Promise<ShortClips> {
  const prompt = `${briefContext(brief)}

Write 10 TikTok/Reels captions (each under 150 chars). Return JSON:
{
  "captions": ["caption1", "caption2", ...]
}
Mix hooks: question, stat, story, bold claim.`

  const raw = await generateText(prompt, sys)
  return JSON.parse(raw)
}

export async function generateLeadGenPack(brief: ContentBrief): Promise<LeadGenPack> {
  const prompt = `${briefContext(brief)}

Create a B2B lead gen pack. Return JSON:
{
  "linkedinConnections": ["message variant 1", "message variant 2", "message variant 3", "message variant 4", "message variant 5"],
  "coldEmails": [
    { "subject": "...", "body": "cold email body" },
    { "subject": "...", "body": "cold email body" },
    { "subject": "...", "body": "cold email body" }
  ],
  "dmSequence": ["DM 1", "follow-up 1", "follow-up 2", "follow-up 3", "close"],
  "leadMagnetCta": "lead magnet CTA copy block"
}`

  const raw = await generateText(prompt, sys)
  return JSON.parse(raw)
}

export async function generateClientReport(brief: ContentBrief): Promise<ClientReport> {
  const prompt = `${briefContext(brief)}

Write a client content strategy report. Return JSON:
{
  "executiveSummary": "2-3 paragraph strategic summary",
  "contentCalendar": [
    { "day": "Mon Week 1", "format": "Blog Post", "title": "..." }
  ],
  "nextSteps": ["action 1", "action 2", "action 3", "action 4"]
}
Include 12 calendar items (3 per week, 4 weeks).`

  const raw = await generateText(prompt, sys)
  return JSON.parse(raw)
}

export async function generateAll(brief: ContentBrief, tier: 'free' | 'pro' | 'agency') {
  const freeJobs = [
    generateBlogPost(brief),
    generateLinkedInPosts(brief),
  ]

  const proJobs = tier === 'free' ? [] : [
    generatePodcastEpisode(brief),
    generateVideoStoryboard(brief),
    generateEmailSequence(brief),
    generateShortClips(brief),
    generateLeadGenPack(brief),
    generateClientReport(brief),
  ]

  const [freeResults, proResults] = await Promise.all([
    Promise.allSettled(freeJobs),
    Promise.allSettled(proJobs),
  ])

  const [blogResult, linkedInResult] = freeResults
  const [podcastResult, videoResult, emailResult, clipsResult, leadGenResult, reportResult] = proResults

  return {
    blogPost: blogResult?.status === 'fulfilled' ? blogResult.value as BlogPost : undefined,
    linkedInPosts: linkedInResult?.status === 'fulfilled' ? linkedInResult.value as LinkedInPosts : undefined,
    podcastEpisode: podcastResult?.status === 'fulfilled' ? podcastResult.value as PodcastEpisode : undefined,
    videoStoryboard: videoResult?.status === 'fulfilled' ? videoResult.value as VideoStoryboard : undefined,
    emailSequence: emailResult?.status === 'fulfilled' ? emailResult.value as EmailSequence : undefined,
    shortClips: clipsResult?.status === 'fulfilled' ? clipsResult.value as ShortClips : undefined,
    leadGenPack: leadGenResult?.status === 'fulfilled' ? leadGenResult.value as LeadGenPack : undefined,
    clientReport: reportResult?.status === 'fulfilled' ? reportResult.value as ClientReport : undefined,
  }
}
