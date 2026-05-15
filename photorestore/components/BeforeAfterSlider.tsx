'use client'
import { useState, useRef } from 'react'

export default function BeforeAfterSlider() {
  const [position, setPosition] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    setPosition(pct)
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden cursor-col-resize shadow-card-hover select-none"
      onMouseMove={e => handleMove(e.clientX)}
      onTouchMove={e => handleMove(e.touches[0].clientX)}
    >
      {/* "Before" — sepia layer (simulated old photo) */}
      <div
        className="absolute inset-0"
        style={{ filter: 'sepia(0.9) contrast(0.85) brightness(0.9)' }}
      >
        <div className="w-full h-full bg-gradient-to-br from-amber-200 via-amber-100 to-stone-200 flex items-center justify-center">
          <div className="text-center px-8">
            <div className="w-20 h-20 rounded-full bg-stone-300/60 mx-auto mb-4" />
            <div className="h-2.5 bg-stone-300/60 rounded-full w-32 mx-auto mb-2" />
            <div className="h-2 bg-stone-300/40 rounded-full w-24 mx-auto" />
          </div>
        </div>
      </div>

      {/* "After" — restored layer */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <div className="w-full h-full bg-gradient-to-br from-sky-50 via-rose-50 to-amber-50 flex items-center justify-center">
          <div className="text-center px-8">
            <div className="w-20 h-20 rounded-full bg-rose-200/70 mx-auto mb-4" />
            <div className="h-2.5 bg-amber-300/70 rounded-full w-32 mx-auto mb-2" />
            <div className="h-2 bg-sky-300/50 rounded-full w-24 mx-auto" />
          </div>
        </div>
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
        style={{ left: `${position}%` }}
      >
        {/* Handle */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 bg-white rounded-full shadow-lg flex items-center justify-center">
          <svg
            className="w-4 h-4 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-3 3 3 3M16 9l3 3-3 3" />
          </svg>
        </div>
      </div>

      {/* Corner labels */}
      <span className="absolute top-3 left-3 bg-black/40 text-white text-xs px-2.5 py-1 rounded-full font-medium">
        Before
      </span>
      <span className="absolute top-3 right-3 bg-accent/90 text-white text-xs px-2.5 py-1 rounded-full font-medium">
        After
      </span>
    </div>
  )
}
