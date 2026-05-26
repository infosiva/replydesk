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
  jobs_total: number
  jobs_done: number
  created_at: Date
}

export interface DbAsset {
  id: string
  brief_id: string
  type: AssetType
  content: Record<string, unknown>
  file_url: string | null
  file_size_bytes: number | null
  download_count: number
  approved_at: Date | null
  created_at: Date
}

export interface DbThread {
  id: string
  workspace_id: string
  brief_id: string | null
  subject: string
  client_email: string
  status: 'open' | 'closed' | 'pending'
  created_at: string
}

export interface DbMessage {
  id: string
  thread_id: string
  sender_id: string | null
  sender_email: string
  body: string
  direction: 'inbound' | 'outbound'
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

export interface DbRevision {
  id: string
  asset_id: string
  round: number
  status: 'pending' | 'approved' | 'changes_requested'
  created_at: string
}

export interface DbComment {
  id: string
  asset_id: string
  revision_id: string | null
  author_id: string | null
  author_email: string | null
  body: string
  resolved: boolean
  created_at: string
}

export interface DbCalendarItem {
  id: string
  asset_id: string
  workspace_id: string
  publish_date: string | null
  status: 'draft' | 'in_review' | 'approved' | 'scheduled' | 'published'
  platform: string | null
  created_at: Date
}

export interface DbProposal {
  id: string
  workspace_id: string
  client_email: string
  client_name: string
  title: string
  executive_summary: string | null
  timeline_notes: string | null
  total_amount: string
  billing_cadence: 'one_off' | 'monthly' | 'quarterly'
  status: 'draft' | 'sent' | 'accepted' | 'declined'
  pdf_url: string | null
  accepted_at: Date | null
  created_at: Date
}

export interface DbProposalItem {
  id: string
  proposal_id: string
  description: string
  quantity: string
  unit_price: string
  total: string
}

export interface Message {
  id: string
  thread_id: string
  sender_id: string | null
  sender_email: string
  body: string
  direction: 'inbound' | 'outbound'
  created_at: Date
}
