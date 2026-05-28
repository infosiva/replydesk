"use client";

import { useState, useEffect } from "react";
import type { VideoGenOptions, VideoGenResult } from "../lib/video-gen";

interface UseGeneratedVideoResult {
  url: string | null;
  loading: boolean;
  error: string | null;
  cached: boolean;
}

export function useGeneratedVideo(
  prompt: string | null,
  opts: VideoGenOptions = {},
  apiRoute = "/api/video"
): UseGeneratedVideoResult {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  useEffect(() => {
    if (!prompt) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetch(apiRoute, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, ...opts }),
    })
      .then(r => r.json())
      .then((data: Partial<VideoGenResult> & { error?: string }) => {
        if (cancelled) return;
        if (data.error) { setError(data.error); return; }
        if (data.url) {
          setUrl(data.url);
          setCached(data.cached ?? false);
        }
      })
      .catch(e => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [prompt, apiRoute, JSON.stringify(opts)]);

  return { url, loading, error, cached };
}
