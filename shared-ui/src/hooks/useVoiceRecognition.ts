'use client'
import { useState, useRef, useCallback } from 'react'

interface Options {
  lang?: string
  continuous?: boolean
  onResult: (transcript: string) => void
  onInterim?: (interim: string) => void
}

export function useVoiceRecognition({ lang = 'en-US', continuous = false, onResult, onInterim }: Options) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const recRef = useRef<any>(null)

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) { setSupported(false); return }
    const rec = new SR()
    rec.lang = lang
    rec.continuous = continuous
    rec.interimResults = !!onInterim
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let final = ''; let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      if (interim) onInterim?.(interim)
      if (final.trim()) onResult(final.trim())
    }
    recRef.current = rec
    rec.start()
  }, [lang, continuous, onResult, onInterim])

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  return { listening, supported, start, stop, toggle }
}
