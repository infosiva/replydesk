"use client";

import { useState, useEffect } from "react";
import type { ImageGenOptions, ImageGenResult } from "../lib/image-gen";

interface UseGeneratedImageResult {
  url: string | null;
  loading: boolean;
  error: string | null;
  cached: boolean;
  refresh: () => void;
}

export function useGeneratedImage(
  prompt: string | null,
  opts: ImageGenOptions = {},
  apiRoute = "/api/image"
): UseGeneratedImageResult {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [tick, setTick] = useState(0);

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
      .then((data: Partial<ImageGenResult> & { error?: string }) => {
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
  }, [prompt, apiRoute, tick, JSON.stringify(opts)]);

  return { url, loading, error, cached, refresh: () => setTick(t => t + 1) };
}
