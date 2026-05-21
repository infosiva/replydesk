import { fal } from '@fal-ai/client'
import type { VideoStoryboard } from './types'

// Configure fal client via env
if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY })
}

export async function storyboardToVideo(storyboard: VideoStoryboard): Promise<Buffer> {
  if (!process.env.FAL_KEY) throw new Error('FAL_KEY not set')

  // Build a concise prompt from the storyboard
  const prompt = [
    storyboard.title,
    storyboard.voiceoverScript.slice(0, 300),
    storyboard.scenes
      .slice(0, 3)
      .map((s) => s.visual)
      .join('. '),
  ]
    .filter(Boolean)
    .join('. ')

  const result = await fal.subscribe('fal-ai/kling-video/v1.5/pro/text-to-video', {
    input: {
      prompt,
      duration: '5',
      aspect_ratio: '16:9',
    },
  }) as unknown as { video: { url: string } }

  const videoUrl = result?.video?.url
  if (!videoUrl) throw new Error('fal.ai Kling returned no video URL')

  const res = await fetch(videoUrl)
  if (!res.ok) throw new Error(`Failed to fetch video from fal.ai: ${res.status}`)

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
