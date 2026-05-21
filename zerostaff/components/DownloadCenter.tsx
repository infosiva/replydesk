'use client'

import ResultCard from './ResultCard'
import type { AssetType, DbAsset, Tier } from '@/lib/types'

const ASSET_META: Record<AssetType, { title: string; icon: string }> = {
  blog_post:        { title: 'SEO Blog Post', icon: '📝' },
  podcast_episode:  { title: 'Podcast Script', icon: '🎙️' },
  video_storyboard: { title: 'Video Storyboard', icon: '🎬' },
  linkedin_posts:   { title: 'LinkedIn Posts', icon: '💼' },
  email_sequence:   { title: 'Email Sequence', icon: '✉️' },
  short_clips:      { title: 'Short Clips / Captions', icon: '✂️' },
  lead_gen_pack:    { title: 'Lead Gen Pack', icon: '🎯' },
  client_report:    { title: 'Client Report', icon: '📊' },
}

const PRO_TYPES = new Set(['podcast_episode', 'video_storyboard', 'email_sequence', 'short_clips', 'lead_gen_pack', 'client_report'])

interface DownloadCenterProps {
  assets: DbAsset[]
  tier: Tier
}

export default function DownloadCenter({ assets, tier }: DownloadCenterProps) {
  const assetMap = new Map(assets.map(a => [a.type, a]))

  const allTypes = Object.keys(ASSET_META) as AssetType[]

  return (
    <div className="space-y-4">
      {allTypes.map(type => {
        const meta = ASSET_META[type]
        const asset = assetMap.get(type)
        const isProType = PRO_TYPES.has(type)
        const locked = isProType && tier === 'free'

        if (!asset && !locked) return null

        return (
          <ResultCard
            key={type}
            title={meta.title}
            icon={meta.icon}
            type={type}
            content={asset?.content ?? null}
            locked={locked}
          />
        )
      })}
    </div>
  )
}
