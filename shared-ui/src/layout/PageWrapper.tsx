'use client'
import React from 'react'

interface PageWrapperProps {
  children: React.ReactNode
  bgColor?: string
  fontClass?: string   // Tailwind font class e.g. "font-sans"
  className?: string
}

export default function PageWrapper({
  children,
  bgColor = '#f8fafc',
  fontClass = '',
  className = '',
}: PageWrapperProps) {
  return (
    <div
      className={[fontClass, className].filter(Boolean).join(' ')}
      style={{
        minHeight: '100vh',
        background: bgColor,
        overflowX: 'hidden',
        // Custom scrollbar (webkit)
      }}
    >
      <style>{`
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        * { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
      `}</style>
      {children}
    </div>
  )
}
