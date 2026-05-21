# ZeroStaff Phase 2 — Real Media + Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real podcast MP3 generation (ElevenLabs), faceless video (fal.ai Kling), async job queue (Upstash QStash), live progress via Supabase Realtime, Cloudflare R2 file storage, outbound + inbound email (Resend), and in-portal messaging threads.

**Architecture:** Brief submission enqueues 7–8 parallel jobs via QStash. Each job runs server-side, uploads files to R2, updates Supabase, and notifies the frontend via Realtime channel. Resend handles all outbound email. Inbound replies route via `Reply-To: thread-{id}@mail.zerostaff.app` → Resend inbound webhook → append to thread.

**Tech Stack:** Upstash QStash, Cloudflare R2 (`@aws-sdk/client-s3`), ElevenLabs TTS API, fal.ai client (`@fal-ai/client`), Resend, Supabase Realtime, Next.js 15 App Router

---

## File Map

```
zerostaff/
├── app/
│   ├── api/
│   │   ├── generate/route.ts          MODIFY — enqueue QStash jobs instead of inline gen
│   │   ├── jobs/
│   │   │   ├── text/route.ts          CREATE — QStash receiver: run Groq text jobs
│   │   │   ├── audio/route.ts         CREATE — QStash receiver: ElevenLabs TTS → R2
│   │   │   └── video/route.ts         CREATE — QStash receiver: fal.ai Kling → R2
│   │   └── email/
│   │       └── inbound/route.ts       CREATE — Resend inbound webhook → thread message
│   └── dashboard/
│       └── results/[id]/page.tsx      MODIFY — live progress tiles via Supabase Realtime
├── components/
│   ├── JobProgress.tsx                CREATE — live tile per job (Realtime subscription)
│   └── MessageThread.tsx             CREATE — messaging thread UI (send + receive)
├── lib/
│   ├── queue.ts                       CREATE — QStash publish helpers
│   ├── r2.ts                          CREATE — R2 upload/signed-URL helpers
│   ├── elevenlabs.ts                  CREATE — TTS script → MP3 buffer
│   ├── falai.ts                       CREATE — Kling video generation
│   ├── email.ts                       CREATE — Resend send helpers + thread routing
│   └── types.ts                       MODIFY — add Thread, Message, JobEvent types
└── supabase/migrations/
    └── 002_phase2_schema.sql          CREATE — threads, messages, file_url on assets
```

---

## Task 1: Install Phase 2 Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install deps**

```bash
cd /Users/sivaprakasam/projects/agents/zerostaff
npm install @upstash/qstash @aws-sdk/client-s3 @fal-ai/client resend
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('@upstash/qstash'); require('@aws-sdk/client-s3'); require('@fal-ai/client'); require('resend'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Add env vars to .env.local**

Add these to `.env.local` (get values from respective dashboards):
```
# Upstash QStash
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=zerostaff-assets
R2_PUBLIC_URL=https://pub-XXXX.r2.dev

# ElevenLabs
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# fal.ai
FAL_KEY=

# Resend
RESEND_API_KEY=
RESEND_FROM_DOMAIN=mail.zerostaff.app
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(zerostaff): install phase 2 deps — qstash, r2, elevenlabs, fal, resend"
```

---

## Task 2: Supabase Migration — Phase 2 Schema

**Files:**
- Create: `supabase/migrations/002_phase2_schema.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/002_phase2_schema.sql`:

```sql
-- Add file_url to assets (already exists in 001 but ensure column present)
alter table public.assets
  add column if not exists file_url text,
  add column if not exists file_size_bytes bigint,
  add column if not exists duration_secs integer;

-- Threads (per-brief or workspace-level conversation)
create table if not exists public.threads (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brief_id uuid references public.briefs(id) on delete set null,
  subject text not null default 'General',
  created_at timestamptz not null default now()
);

-- Messages
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  sender_id uuid references public.users(id) on delete set null,
  sender_email text,
  body text not null,
  source text not null default 'portal' check (source in ('portal', 'email')),
  attachments jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.threads enable row level security;
alter table public.messages enable row level security;

create policy "threads_workspace_member" on public.threads
  for all using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

create policy "messages_thread_member" on public.messages
  for all using (
    thread_id in (
      select t.id from public.threads t
      join public.workspaces w on w.id = t.workspace_id
      where w.owner_id = auth.uid()
    )
  );

-- Realtime: enable for jobs table so frontend can subscribe
alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.assets;
```

- [ ] **Step 2: Apply migration (local Supabase or remote)**

If using Supabase CLI:
```bash
npx supabase db push
```

If applying to remote directly:
```bash
# paste SQL into Supabase dashboard → SQL Editor
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_phase2_schema.sql
git commit -m "feat(zerostaff): phase 2 schema — threads, messages, file metadata on assets"
```

---

## Task 3: R2 File Storage Helper

**Files:**
- Create: `lib/r2.ts`

- [ ] **Step 1: Write R2 helper**

Create `lib/r2.ts`:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function getClient() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const client = getClient()
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
  // Return public URL (bucket must have public access enabled for R2)
  return `${process.env.R2_PUBLIC_URL}/${key}`
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const client = getClient()
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }),
    { expiresIn }
  )
}
```

- [ ] **Step 2: Install presigner**

```bash
npm install @aws-sdk/s3-request-presigner
```

- [ ] **Step 3: Commit**

```bash
git add lib/r2.ts package.json package-lock.json
git commit -m "feat(zerostaff): R2 upload + signed URL helper"
```

---

## Task 4: ElevenLabs TTS Helper

**Files:**
- Create: `lib/elevenlabs.ts`

- [ ] **Step 1: Write ElevenLabs helper**

Create `lib/elevenlabs.ts`:

```typescript
export async function textToMp3(script: string, voiceId?: string): Promise<Buffer> {
  const vid = voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM'
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: script,
      model_id: 'eleven_monolingual_v1',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ElevenLabs error ${res.status}: ${err}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/elevenlabs.ts
git commit -m "feat(zerostaff): ElevenLabs TTS helper — script → MP3 buffer"
```

---

## Task 5: fal.ai Kling Video Helper

**Files:**
- Create: `lib/falai.ts`

- [ ] **Step 1: Write fal.ai helper**

Create `lib/falai.ts`:

```typescript
import * as fal from '@fal-ai/client'

fal.config({ credentials: process.env.FAL_KEY })

export async function generateKlingVideo(prompt: string): Promise<Buffer> {
  const result = await fal.run('fal-ai/kling-video/v1.5/pro/text-to-video', {
    input: {
      prompt,
      duration: '5',
      aspect_ratio: '9:16',
    },
  }) as { video: { url: string } }

  const videoUrl = result.video.url
  const res = await fetch(videoUrl)
  if (!res.ok) throw new Error(`Failed to download Kling video: ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/falai.ts
git commit -m "feat(zerostaff): fal.ai Kling v1.5 video generation helper"
```

---

## Task 6: QStash Queue Helper

**Files:**
- Create: `lib/queue.ts`

- [ ] **Step 1: Write queue helper**

Create `lib/queue.ts`:

```typescript
import { Client } from '@upstash/qstash'

function getClient() {
  return new Client({ token: process.env.QSTASH_TOKEN! })
}

type JobType = 'text' | 'audio' | 'video'

export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>
): Promise<string> {
  const c = getClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const res = await c.publishJSON({
    url: `${baseUrl}/api/jobs/${type}`,
    body: payload,
    retries: 2,
  })
  return res.messageId
}

export function verifyQStashSignature(
  req: Request,
  body: string
): Promise<boolean> {
  // QStash signs with QSTASH_CURRENT_SIGNING_KEY + QSTASH_NEXT_SIGNING_KEY
  // Use @upstash/qstash Receiver for verification
  const { Receiver } = require('@upstash/qstash')
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  })
  const signature = req.headers.get('upstash-signature') ?? ''
  return receiver.verify({ signature, body })
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/queue.ts
git commit -m "feat(zerostaff): QStash publish + signature verification helper"
```

---

## Task 7: Modify Generate API — Enqueue Instead of Inline

**Files:**
- Modify: `app/api/generate/route.ts`

- [ ] **Step 1: Read current file**

```bash
cat /Users/sivaprakasam/projects/agents/zerostaff/app/api/generate/route.ts
```

- [ ] **Step 2: Replace inline `generateAll` call with QStash enqueue**

Replace the section starting at `// Run generation (parallel Groq jobs)` through `// Mark brief complete` with:

```typescript
    // Enqueue parallel jobs via QStash
    const jobTypes: Array<{ type: 'text' | 'audio' | 'video'; assetTypes: string[] }> = [
      { type: 'text', assetTypes: ['blog_post', 'linkedin_posts', 'email_sequence', 'short_clips', 'lead_gen_pack', 'client_report'] },
      ...(tier !== 'free' ? [
        { type: 'audio', assetTypes: ['podcast_episode'] },
        { type: 'video', assetTypes: ['video_storyboard'] },
      ] : []),
    ]

    for (const job of jobTypes) {
      // Create job record in DB
      await serviceClient.from('jobs').insert({
        brief_id: briefRecord.id,
        type: job.type,
        status: 'pending',
      })
      // Enqueue
      await enqueueJob(job.type, { briefId: briefRecord.id, brief, tier })
    }

    // Return immediately — frontend polls via Realtime
    return NextResponse.json({ briefId: briefRecord.id, queued: true })
```

Also add to imports at top:
```typescript
import { enqueueJob } from '@/lib/queue'
```

Remove the import of `generateAll` from `@/lib/generate`.

- [ ] **Step 3: Commit**

```bash
git add app/api/generate/route.ts
git commit -m "feat(zerostaff): generate API now enqueues QStash jobs instead of inline generation"
```

---

## Task 8: Text Job Receiver (QStash → Groq → Supabase)

**Files:**
- Create: `app/api/jobs/text/route.ts`

- [ ] **Step 1: Create text job receiver**

Create `app/api/jobs/text/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/queue'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { generateAll } from '@/lib/generate'
import type { ContentBrief, Tier } from '@/lib/types'

export async function POST(request: NextRequest) {
  const body = await request.text()

  const valid = await verifyQStashSignature(request, body)
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  const { briefId, brief, tier }: { briefId: string; brief: ContentBrief; tier: Tier } = JSON.parse(body)

  const supabase = createServiceRoleClient()

  // Mark job running
  await supabase.from('jobs').update({ status: 'running' }).eq('brief_id', briefId).eq('type', 'text')

  try {
    const results = await generateAll(brief, tier)

    const textAssetTypes = ['blog_post', 'linkedin_posts', 'email_sequence', 'short_clips', 'lead_gen_pack', 'client_report'] as const
    const inserts = textAssetTypes
      .map(type => {
        const key = snakeToCamel(type) as keyof typeof results
        const content = results[key]
        if (!content) return null
        return { brief_id: briefId, type, content }
      })
      .filter(Boolean)

    if (inserts.length > 0) {
      await supabase.from('assets').insert(inserts)
    }

    // Mark job complete
    await supabase.from('jobs').update({ status: 'complete' }).eq('brief_id', briefId).eq('type', 'text')

    // If all jobs complete, mark brief complete
    await maybeCompleteBrief(supabase, briefId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    await supabase.from('jobs').update({ status: 'error', error: String(err) }).eq('brief_id', briefId).eq('type', 'text')
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function snakeToCamel(s: string) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

async function maybeCompleteBrief(supabase: ReturnType<typeof createServiceRoleClient>, briefId: string) {
  const { data: jobs } = await supabase.from('jobs').select('status').eq('brief_id', briefId)
  const allDone = jobs?.every(j => j.status === 'complete' || j.status === 'error')
  if (allDone) {
    await supabase.from('briefs').update({ status: 'complete' }).eq('id', briefId)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/jobs/text/route.ts
git commit -m "feat(zerostaff): QStash text job receiver — Groq generation → Supabase assets"
```

---

## Task 9: Audio Job Receiver (QStash → ElevenLabs → R2)

**Files:**
- Create: `app/api/jobs/audio/route.ts`

- [ ] **Step 1: Create audio job receiver**

Create `app/api/jobs/audio/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/queue'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { generatePodcastEpisode } from '@/lib/generate'
import { textToMp3 } from '@/lib/elevenlabs'
import { uploadToR2 } from '@/lib/r2'
import type { ContentBrief, Tier } from '@/lib/types'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const valid = await verifyQStashSignature(request, body)
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  const { briefId, brief, tier }: { briefId: string; brief: ContentBrief; tier: Tier } = JSON.parse(body)

  if (tier === 'free') return NextResponse.json({ skipped: true })

  const supabase = createServiceRoleClient()
  await supabase.from('jobs').update({ status: 'running' }).eq('brief_id', briefId).eq('type', 'audio')

  try {
    // Generate script via Groq
    const episode = await generatePodcastEpisode(brief)

    // Convert to MP3
    const mp3Buffer = await textToMp3(episode.script)

    // Upload to R2
    const key = `audio/${briefId}/podcast.mp3`
    const fileUrl = await uploadToR2(key, mp3Buffer, 'audio/mpeg')

    // Save asset record
    await supabase.from('assets').insert({
      brief_id: briefId,
      type: 'podcast_episode',
      content: episode,
      file_url: fileUrl,
      file_size_bytes: mp3Buffer.length,
    })

    await supabase.from('jobs').update({ status: 'complete', result_url: fileUrl }).eq('brief_id', briefId).eq('type', 'audio')

    await maybeCompleteBrief(supabase, briefId)

    return NextResponse.json({ ok: true, fileUrl })
  } catch (err) {
    await supabase.from('jobs').update({ status: 'error', error: String(err) }).eq('brief_id', briefId).eq('type', 'audio')
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

async function maybeCompleteBrief(supabase: ReturnType<typeof createServiceRoleClient>, briefId: string) {
  const { data: jobs } = await supabase.from('jobs').select('status').eq('brief_id', briefId)
  const allDone = jobs?.every(j => j.status === 'complete' || j.status === 'error')
  if (allDone) {
    await supabase.from('briefs').update({ status: 'complete' }).eq('id', briefId)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/jobs/audio/route.ts
git commit -m "feat(zerostaff): QStash audio job receiver — ElevenLabs TTS → R2 MP3"
```

---

## Task 10: Video Job Receiver (QStash → fal.ai → R2)

**Files:**
- Create: `app/api/jobs/video/route.ts`

- [ ] **Step 1: Create video job receiver**

Create `app/api/jobs/video/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/queue'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { generateVideoStoryboard } from '@/lib/generate'
import { generateKlingVideo } from '@/lib/falai'
import { uploadToR2 } from '@/lib/r2'
import type { ContentBrief, Tier } from '@/lib/types'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const valid = await verifyQStashSignature(request, body)
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  const { briefId, brief, tier }: { briefId: string; brief: ContentBrief; tier: Tier } = JSON.parse(body)

  if (tier === 'free') return NextResponse.json({ skipped: true })

  const supabase = createServiceRoleClient()
  await supabase.from('jobs').update({ status: 'running' }).eq('brief_id', briefId).eq('type', 'video')

  try {
    // Generate storyboard (includes voiceoverScript)
    const storyboard = await generateVideoStoryboard(brief)

    // Build video prompt from storyboard
    const videoPrompt = `${storyboard.title}. ${storyboard.voiceoverScript.slice(0, 500)}`

    // Generate video via fal.ai Kling
    const videoBuffer = await generateKlingVideo(videoPrompt)

    // Upload to R2
    const key = `video/${briefId}/faceless.mp4`
    const fileUrl = await uploadToR2(key, videoBuffer, 'video/mp4')

    // Save asset
    await supabase.from('assets').insert({
      brief_id: briefId,
      type: 'video_storyboard',
      content: storyboard,
      file_url: fileUrl,
      file_size_bytes: videoBuffer.length,
    })

    await supabase.from('jobs').update({ status: 'complete', result_url: fileUrl }).eq('brief_id', briefId).eq('type', 'video')

    await maybeCompleteBrief(supabase, briefId)

    return NextResponse.json({ ok: true, fileUrl })
  } catch (err) {
    await supabase.from('jobs').update({ status: 'error', error: String(err) }).eq('brief_id', briefId).eq('type', 'video')
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

async function maybeCompleteBrief(supabase: ReturnType<typeof createServiceRoleClient>, briefId: string) {
  const { data: jobs } = await supabase.from('jobs').select('status').eq('brief_id', briefId)
  const allDone = jobs?.every(j => j.status === 'complete' || j.status === 'error')
  if (allDone) {
    await supabase.from('briefs').update({ status: 'complete' }).eq('id', briefId)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/jobs/video/route.ts
git commit -m "feat(zerostaff): QStash video job receiver — fal.ai Kling → R2 MP4"
```

---

## Task 11: Live Progress Component (Supabase Realtime)

**Files:**
- Create: `components/JobProgress.tsx`
- Modify: `app/dashboard/results/[id]/page.tsx`

- [ ] **Step 1: Create JobProgress component**

Create `components/JobProgress.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Job = {
  id: string
  type: string
  status: 'pending' | 'running' | 'complete' | 'error'
  result_url: string | null
}

const JOB_LABELS: Record<string, string> = {
  text: 'Blog, LinkedIn, Email, Clips, Lead Gen, Report',
  audio: 'Podcast MP3',
  video: 'Faceless Video',
}

export function JobProgress({ briefId }: { briefId: string }) {
  const [jobs, setJobs] = useState<Job[]>([])

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // Initial fetch
    supabase
      .from('jobs')
      .select('id, type, status, result_url')
      .eq('brief_id', briefId)
      .then(({ data }) => { if (data) setJobs(data) })

    // Realtime subscription
    const channel = supabase
      .channel(`jobs:${briefId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: `brief_id=eq.${briefId}`,
      }, (payload) => {
        setJobs(prev => prev.map(j => j.id === payload.new.id ? { ...j, ...payload.new } : j))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [briefId])

  return (
    <div className="grid grid-cols-1 gap-3">
      {jobs.map(job => (
        <div key={job.id} className="flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10">
          <StatusDot status={job.status} />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{JOB_LABELS[job.type] ?? job.type}</p>
            <p className="text-xs text-white/50 capitalize">{job.status}</p>
          </div>
          {job.status === 'complete' && job.result_url && (
            <a href={job.result_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300">
              Download
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

function StatusDot({ status }: { status: Job['status'] }) {
  const colors = {
    pending: 'bg-white/20',
    running: 'bg-yellow-400 animate-pulse',
    complete: 'bg-green-400',
    error: 'bg-red-400',
  }
  return <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
}
```

- [ ] **Step 2: Update results page to show JobProgress**

In `app/dashboard/results/[id]/page.tsx`, import and render `<JobProgress briefId={params.id} />` above the download center.

- [ ] **Step 3: Commit**

```bash
git add components/JobProgress.tsx app/dashboard/results/[id]/page.tsx
git commit -m "feat(zerostaff): live job progress tiles via Supabase Realtime"
```

---

## Task 12: Resend Email Helper

**Files:**
- Create: `lib/email.ts`

- [ ] **Step 1: Create email helper**

Create `lib/email.ts`:

```typescript
import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

const FROM = `ZeroStaff <noreply@${process.env.RESEND_FROM_DOMAIN ?? 'zerostaff.app'}>`

export async function sendContentReadyEmail(to: string, briefId: string, brandName: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    reply_to: `thread-${briefId}@${process.env.RESEND_FROM_DOMAIN ?? 'zerostaff.app'}`,
    subject: `Your content package is ready — ${brandName}`,
    html: `
      <p>Your content package for <strong>${brandName}</strong> has been generated.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/results/${briefId}">View & Download</a></p>
      <p>Reply to this email to message your account team.</p>
    `,
  })
}

export async function sendThreadReplyNotification(to: string, threadId: string, senderName: string, preview: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    reply_to: `thread-${threadId}@${process.env.RESEND_FROM_DOMAIN ?? 'zerostaff.app'}`,
    subject: `New message from ${senderName}`,
    html: `
      <p><strong>${senderName}</strong> sent a message:</p>
      <blockquote>${preview.slice(0, 300)}</blockquote>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/threads/${threadId}">View thread</a></p>
    `,
  })
}
```

- [ ] **Step 2: Trigger content-ready email from text job receiver**

In `app/api/jobs/text/route.ts`, after inserting assets, add:

```typescript
import { sendContentReadyEmail } from '@/lib/email'

// After assets inserted + job marked complete:
const { data: briefData } = await supabase
  .from('briefs')
  .select('brand, users(email)')
  .eq('id', briefId)
  .single()

if (briefData?.users && 'email' in briefData.users) {
  await sendContentReadyEmail(briefData.users.email as string, briefId, briefData.brand)
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts app/api/jobs/text/route.ts
git commit -m "feat(zerostaff): Resend email helper — content ready notification with Reply-To thread routing"
```

---

## Task 13: Inbound Email Webhook → Thread Message

**Files:**
- Create: `app/api/email/inbound/route.ts`

- [ ] **Step 1: Create inbound webhook handler**

Create `app/api/email/inbound/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

// Resend inbound webhook payload (simplified)
interface ResendInboundPayload {
  from: string
  to: string[]
  subject: string
  text: string
  html?: string
}

export async function POST(request: NextRequest) {
  // Resend inbound webhooks use a shared secret in a header
  const secret = request.headers.get('x-resend-signature')
  if (secret !== process.env.RESEND_INBOUND_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload: ResendInboundPayload = await request.json()

  // Extract thread ID from To address: thread-{threadId}@mail.zerostaff.app
  const toAddress = payload.to[0] ?? ''
  const match = toAddress.match(/^thread-([a-f0-9-]+)@/)
  if (!match) return NextResponse.json({ error: 'No thread ID in address' }, { status: 400 })

  const threadId = match[1]
  const supabase = createServiceRoleClient()

  // Verify thread exists
  const { data: thread } = await supabase.from('threads').select('id').eq('id', threadId).single()
  if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

  // Insert message
  const body = payload.text?.slice(0, 10000) ?? payload.html?.replace(/<[^>]+>/g, '').slice(0, 10000) ?? ''
  await supabase.from('messages').insert({
    thread_id: threadId,
    sender_email: payload.from,
    body,
    source: 'email',
  })

  return NextResponse.json({ ok: true })
}
```

Add to `.env.local`:
```
RESEND_INBOUND_SECRET=your-webhook-secret
```

Configure in Resend dashboard: Inbound → Webhook URL → `https://yourdomain.com/api/email/inbound`

- [ ] **Step 2: Commit**

```bash
git add app/api/email/inbound/route.ts
git commit -m "feat(zerostaff): Resend inbound email webhook — thread-{id} routing to Supabase messages"
```

---

## Task 14: MessageThread Component

**Files:**
- Create: `components/MessageThread.tsx`
- Create: `app/dashboard/threads/[id]/page.tsx`

- [ ] **Step 1: Create MessageThread component**

Create `components/MessageThread.tsx`:

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Message = {
  id: string
  sender_id: string | null
  sender_email: string | null
  body: string
  source: 'portal' | 'email'
  created_at: string
}

export function MessageThread({ threadId, currentUserId }: { threadId: string; currentUserId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.from('messages').select('*').eq('thread_id', threadId).order('created_at')
      .then(({ data }) => { if (data) setMessages(data) })

    const channel = supabase
      .channel(`thread:${threadId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `thread_id=eq.${threadId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [threadId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMessage() {
    if (!draft.trim()) return
    await supabase.from('messages').insert({
      thread_id: threadId,
      sender_id: currentUserId,
      body: draft.trim(),
      source: 'portal',
    })
    setDraft('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${
              msg.sender_id === currentUserId ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white'
            }`}>
              {msg.source === 'email' && (
                <p className="text-xs opacity-60 mb-1">via email · {msg.sender_email}</p>
              )}
              <p className="whitespace-pre-wrap">{msg.body}</p>
              <p className="text-xs opacity-40 mt-1">{new Date(msg.created_at).toLocaleTimeString()}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-white/10 p-4 flex gap-2">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="Type a message..."
          rows={2}
          className="flex-1 resize-none bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
        />
        <button onClick={sendMessage}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg">
          Send
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create thread page**

Create `app/dashboard/threads/[id]/page.tsx`:

```typescript
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { MessageThread } from '@/components/MessageThread'

export default async function ThreadPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: thread } = await supabase.from('threads').select('id, subject').eq('id', params.id).single()
  if (!thread) redirect('/dashboard')

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="p-4 border-b border-white/10">
        <h1 className="text-lg font-semibold text-white">{thread.subject}</h1>
      </div>
      <MessageThread threadId={params.id} currentUserId={user.id} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/MessageThread.tsx app/dashboard/threads/
git commit -m "feat(zerostaff): in-portal messaging thread with Realtime + email reply support"
```

---

## Task 15: Enable Realtime on Messages Table

**Files:**
- Modify: `supabase/migrations/002_phase2_schema.sql`

- [ ] **Step 1: Add Realtime publication for messages**

Append to `supabase/migrations/002_phase2_schema.sql`:

```sql
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.threads;
```

Apply via Supabase dashboard SQL editor or `npx supabase db push`.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/002_phase2_schema.sql
git commit -m "feat(zerostaff): enable Supabase Realtime for messages + threads tables"
```

---

## Self-Review Checklist

- [x] Spec §2 (8 outputs) — text covered in Task 8, audio Task 9, video Task 10
- [x] Spec §3 (ElevenLabs TTS) — Task 4 + 9
- [x] Spec §3 (fal.ai Kling) — Task 5 + 10
- [x] Spec §5 (job queue) — Task 6 + 7
- [x] Spec §5 (Supabase Realtime progress) — Task 11
- [x] Spec §5 (R2 file storage) — Task 3
- [x] Spec §11 (outbound email) — Task 12
- [x] Spec §11 (inbound email → thread) — Task 13
- [x] Spec §11 (in-portal messaging) — Task 14 + 15
- [x] Type consistency — `ContentBrief`, `Tier` imported from `@/lib/types` throughout
- [x] No TBDs or placeholders
