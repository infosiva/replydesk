import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set')
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? 'ZeroStaff <noreply@mail.zerostaff.app>'
const INBOUND_DOMAIN = process.env.RESEND_INBOUND_DOMAIN ?? 'mail.zerostaff.app'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zerostaff.app'

export function threadReplyTo(threadId: string): string {
  return `thread-${threadId}@${INBOUND_DOMAIN}`
}

export async function sendDeliveryEmail(
  to: string,
  briefId: string,
  assetTypes: string[],
): Promise<void> {
  const resultsUrl = `${APP_URL}/dashboard/results/${briefId}`

  const assetList = assetTypes
    .map((t) => `<li style="margin-bottom:4px;color:#a1a1aa">${formatAssetType(t)}</li>`)
    .join('')

  await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: 'Your ZeroStaff content is ready',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;background:#09090b;color:#fafafa">
        <h1 style="font-size:20px;font-weight:700;margin:0 0 8px">Your content is ready ✓</h1>
        <p style="color:#a1a1aa;margin:0 0 24px">Here's what was generated for your brief:</p>
        <ul style="list-style:none;padding:0;margin:0 0 24px">
          ${assetList}
        </ul>
        <a href="${resultsUrl}"
           style="display:inline-block;padding:10px 20px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
          View &amp; download assets →
        </a>
        <p style="color:#52525b;font-size:12px;margin:24px 0 0">
          Reply to this email to send a message to your account thread.
        </p>
      </div>
    `,
    replyTo: threadReplyTo(briefId),
  })
}

export async function sendThreadReply(
  to: string,
  threadId: string,
  body: string,
): Promise<void> {
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: 'Re: ZeroStaff message thread',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;background:#09090b;color:#fafafa">
        <p style="white-space:pre-wrap;color:#e4e4e7">${escapeHtml(body)}</p>
        <hr style="border:none;border-top:1px solid #27272a;margin:24px 0"/>
        <a href="${APP_URL}/dashboard/threads/${threadId}"
           style="color:#7c3aed;font-size:12px;text-decoration:none">
          View thread →
        </a>
      </div>
    `,
    replyTo: threadReplyTo(threadId),
  })
}

function formatAssetType(type: string): string {
  const labels: Record<string, string> = {
    blog_post: '📝 Blog Post',
    linked_in_posts: '💼 LinkedIn Posts',
    podcast_episode: '🎙️ Podcast Script',
    video_storyboard: '🎬 Video Storyboard',
    email_sequence: '📧 Email Sequence',
    short_clips: '📱 Short Clips',
    lead_gen_pack: '🎯 Lead Gen Pack',
    client_report: '📊 Client Report',
    podcast_audio: '🎵 Podcast MP3',
    video_asset: '🎥 Video MP4',
  }
  return labels[type] ?? type
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
