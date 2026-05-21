export type Tier = 'free' | 'pro' | 'agency'

export interface ContentBrief {
  brand: string
  topic: string
  audience: string
  tone: 'professional' | 'casual' | 'educational' | 'persuasive'
  keywords: string[]
}

export interface BlogPost {
  title: string
  metaDescription: string
  sections: { heading: string; body: string }[]
}

export interface PodcastEpisode {
  title: string
  hook: string
  outline: string[]
  script: string
  showNotes: string
  promoPulls: string[]
}

export interface VideoStoryboard {
  title: string
  voiceoverScript: string
  scenes: { timestamp: string; visual: string; broll: string }[]
  callToAction: string
}

export interface EmailSequence {
  emails: { subject: string; preview: string; body: string; sendDay: number }[]
}

export interface LinkedInPosts {
  posts: { hook: string; body: string; cta: string }[]
}

export interface ShortClips {
  captions: string[]
}

export interface LeadGenPack {
  linkedinConnections: string[]
  coldEmails: { subject: string; body: string }[]
  dmSequence: string[]
  leadMagnetCta: string
}

export interface ClientReport {
  executiveSummary: string
  contentCalendar: { day: string; format: string; title: string }[]
  nextSteps: string[]
}

export interface GenerationResult {
  id: string
  brief: ContentBrief
  blogPost?: BlogPost
  podcastEpisode?: PodcastEpisode
  videoStoryboard?: VideoStoryboard
  linkedInPosts?: LinkedInPosts
  emailSequence?: EmailSequence
  shortClips?: ShortClips
  leadGenPack?: LeadGenPack
  clientReport?: ClientReport
  createdAt: string
  status: 'pending' | 'complete' | 'error'
}

export interface DbBrief {
  id: string
  workspace_id: string
  user_id: string
  topic: string
  brand: string
  audience: string
  tone: string
  keywords: string[]
  status: 'pending' | 'processing' | 'complete' | 'error'
  created_at: string
}

export interface DbAsset {
  id: string
  brief_id: string
  type: AssetType
  content: string
  download_count: number
  approved_at: string | null
  created_at: string
}

export type AssetType =
  | 'blog_post'
  | 'podcast_episode'
  | 'video_storyboard'
  | 'linkedin_posts'
  | 'email_sequence'
  | 'short_clips'
  | 'lead_gen_pack'
  | 'client_report'
