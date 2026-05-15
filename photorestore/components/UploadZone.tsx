'use client'
import { useState, useRef } from 'react'

type Stage = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

const PROVIDER_LABELS: Record<string, { label: string; quality: string; color: string }> = {
  codeformer:       { label: 'CodeFormer AI',    quality: 'AI Enhanced',   color: 'text-emerald-600' },
  'avans06-gfpgan': { label: 'GFPGAN AI',        quality: 'AI Enhanced',   color: 'text-emerald-600' },
  'sharp-local':    { label: 'Local Processing', quality: 'Sharpened',     color: 'text-amber-600'   },
}

const PROCESSING_STEPS = [
  { pct: 15, msg: 'Uploading photo...' },
  { pct: 35, msg: 'Analysing damage and fading...' },
  { pct: 55, msg: 'Restoring detail and clarity...' },
  { pct: 75, msg: 'Enhancing faces and textures...' },
  { pct: 90, msg: 'Finalising restoration...' },
]

export default function UploadZone() {
  const [isDragging, setIsDragging]   = useState(false)
  const [file, setFile]               = useState<File | null>(null)
  const [stage, setStage]             = useState<Stage>('idle')
  const [progress, setProgress]       = useState(0)
  const [statusMsg, setStatusMsg]     = useState('')
  const [resultUrl, setResultUrl]     = useState<string | null>(null)
  const [provider, setProvider]       = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const startProgressSteps = () => {
    let i = 0
    setProgress(PROCESSING_STEPS[0].pct)
    setStatusMsg(PROCESSING_STEPS[0].msg)
    stepTimer.current = setInterval(() => {
      i = Math.min(i + 1, PROCESSING_STEPS.length - 1)
      setProgress(PROCESSING_STEPS[i].pct)
      setStatusMsg(PROCESSING_STEPS[i].msg)
    }, 6000)
  }

  const stopProgressSteps = () => {
    if (stepTimer.current) clearInterval(stepTimer.current)
  }

  const handleFile = async (f: File) => {
    setFile(f)
    setStage('processing')
    setProgress(5)
    setStatusMsg('Uploading photo...')
    startProgressSteps()

    const formData = new FormData()
    formData.append('image', f)

    try {
      const res = await fetch('/api/restore', { method: 'POST', body: formData })
      const data = await res.json()
      stopProgressSteps()

      if (data.url) {
        setProgress(100)
        setStatusMsg('Done!')
        setResultUrl(data.url)
        setProvider(data.provider ?? null)
        setStage('done')
      } else {
        setStage('error')
      }
    } catch {
      stopProgressSteps()
      setStage('error')
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) handleFile(f)
  }

  const reset = () => {
    stopProgressSteps()
    setStage('idle')
    setFile(null)
    setResultUrl(null)
    setProvider(null)
    setProgress(0)
    setStatusMsg('')
  }

  // ── Processing state ──────────────────────────────────────────────────────
  if (stage === 'processing') {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl p-8 shadow-card text-center">
          {/* Animated icon */}
          <div className="w-14 h-14 mx-auto mb-5 relative">
            <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
            <div className="absolute inset-2 bg-surface-muted rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
          </div>

          <p className="font-display text-xl font-bold text-primary mb-1">Restoring your photo</p>
          <p className="text-text-muted text-sm mb-6">{statusMsg}</p>

          {/* Progress bar */}
          <div className="w-full bg-surface-muted rounded-full h-1.5 overflow-hidden mb-2">
            <div
              className="bg-accent h-1.5 rounded-full transition-all duration-[3000ms] ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-accent text-xs font-semibold">{progress}%</p>

          {/* Steps indicator */}
          <div className="mt-6 flex justify-center gap-2">
            {PROCESSING_STEPS.map((s, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-500 ${
                  progress >= s.pct ? 'bg-accent w-6' : 'bg-border w-3'
                }`}
              />
            ))}
          </div>

          <p className="text-text-muted text-xs mt-4">
            Trying AI providers in order — CodeFormer → GFPGAN → local
          </p>
        </div>
      </div>
    )
  }

  // ── Done state ────────────────────────────────────────────────────────────
  if (stage === 'done' && resultUrl) {
    const pInfo = provider ? PROVIDER_LABELS[provider] : null

    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl p-6 shadow-card">
          {/* Header + provider badge */}
          <div className="flex items-center justify-between mb-5">
            <p className="font-display text-xl font-bold text-primary">Restoration complete</p>
            {pInfo && (
              <span className={`text-xs font-semibold border rounded-full px-3 py-1 ${pInfo.color} border-current/20 bg-current/5`}>
                {pInfo.quality} · {pInfo.label}
              </span>
            )}
          </div>

          {/* Before / After */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs text-text-muted mb-2 font-semibold tracking-wide">BEFORE</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file ? URL.createObjectURL(file) : ''}
                alt="Original"
                className="w-full rounded-2xl object-cover aspect-square"
              />
            </div>
            <div>
              <p className="text-xs text-text-muted mb-2 font-semibold tracking-wide">AFTER</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resultUrl} alt="Restored" className="w-full rounded-2xl object-cover aspect-square" />
            </div>
          </div>

          {/* Provider detail row */}
          {pInfo && (
            <div className="flex items-center gap-2 text-xs text-text-muted bg-surface-muted rounded-xl px-4 py-2.5 mb-4">
              <svg className="w-3.5 h-3.5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Processed by <span className="font-semibold text-primary">{pInfo.label}</span>
              {provider === 'sharp-local' && (
                <span className="ml-auto text-amber-600">AI unavailable — local fallback used</span>
              )}
            </div>
          )}

          <a
            href={resultUrl}
            download="restored-photo.jpg"
            className="block w-full text-center bg-accent text-white font-semibold rounded-full py-3.5 shadow-btn hover:bg-accent-dark transition-all duration-200 hover:shadow-btn-hover hover:-translate-y-0.5"
          >
            Download Restored Photo
          </a>
          <button
            onClick={reset}
            className="w-full text-center text-text-muted text-sm mt-3 hover:text-primary transition-colors"
          >
            Restore another photo
          </button>
        </div>
      </div>
    )
  }

  // ── Idle / error state ────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-accent bg-accent/5'
            : 'border-border hover:border-accent hover:bg-surface-muted'
        }`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        <div className="w-16 h-16 bg-surface-muted rounded-2xl mx-auto mb-4 flex items-center justify-center">
          <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <p className="font-semibold text-primary mb-1">Drop your photo here</p>
        <p className="text-sm text-text-muted">JPG, PNG up to 10MB · First 2 restorations free</p>

        {stage === 'error' && (
          <div className="mt-4 flex items-center justify-center gap-2 text-red-500 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            Something went wrong. Try again.
          </div>
        )}
      </div>

      {/* Provider chain info */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          CodeFormer AI
        </span>
        <span className="text-border">→</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          GFPGAN AI
        </span>
        <span className="text-border">→</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          Local fallback
        </span>
      </div>
    </div>
  )
}
