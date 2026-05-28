import crypto from "crypto";

export interface VideoGenOptions {
  duration?: 5 | 10;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  model?: "kling" | "wan";
}

export interface VideoGenResult {
  url: string;
  cached: boolean;
  provider: "kling" | "wan";
}

function hashPrompt(prompt: string, opts: VideoGenOptions): string {
  const key = JSON.stringify({ prompt, ...opts });
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 32);
}

async function checkKvCache(hash: string): Promise<string | null> {
  try {
    const { kv } = await import("@vercel/kv");
    return await kv.get<string>(`vid:${hash}`);
  } catch {
    return null;
  }
}

async function setKvCache(hash: string, url: string): Promise<void> {
  try {
    const { kv } = await import("@vercel/kv");
    await kv.set(`vid:${hash}`, url, { ex: 60 * 60 * 24 * 30 }); // 30 days
  } catch {
    // KV not configured — skip silently
  }
}

async function generateKling(prompt: string, opts: VideoGenOptions): Promise<string> {
  const { fal } = await import("@fal-ai/client");
  const result = await fal.subscribe("fal-ai/kling-video/v1.5/pro/text-to-video", {
    input: {
      prompt,
      duration: String(opts.duration ?? 5) as "5" | "10",
      aspect_ratio: opts.aspectRatio ?? "16:9",
    },
  }) as { data: { video: { url: string } } };

  const url = result.data?.video?.url;
  if (!url) throw new Error("Kling: no video returned");
  return url;
}

async function generateWan(prompt: string, opts: VideoGenOptions): Promise<string> {
  const { fal } = await import("@fal-ai/client");
  const result = await fal.subscribe("fal-ai/wan-t2v-14b", {
    input: {
      prompt,
      aspect_ratio: opts.aspectRatio ?? "16:9",
    },
  }) as { data: { video: { url: string } } };

  const url = result.data?.video?.url;
  if (!url) throw new Error("Wan: no video returned");
  return url;
}

export async function generateVideo(prompt: string, opts: VideoGenOptions = {}): Promise<VideoGenResult> {
  if (!process.env.FAL_KEY) {
    throw new Error("FAL_KEY required for video generation");
  }

  const hash = hashPrompt(prompt, opts);

  const cached = await checkKvCache(hash);
  if (cached) return { url: cached, cached: true, provider: opts.model === "wan" ? "wan" : "kling" };

  const { fal } = await import("@fal-ai/client");
  fal.config({ credentials: process.env.FAL_KEY });

  const preferWan = opts.model === "wan";

  if (!preferWan) {
    try {
      const url = await generateKling(prompt, opts);
      await setKvCache(hash, url);
      return { url, cached: false, provider: "kling" };
    } catch (e) {
      console.error("[video-gen] Kling failed, trying Wan:", e);
    }
  }

  const url = await generateWan(prompt, opts);
  await setKvCache(hash, url);
  return { url, cached: false, provider: "wan" };
}
