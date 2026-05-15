import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PhotoRestore — Bring Old Photos Back to Life',
  description: 'AI-powered photo restoration. Fix scratches, enhance faces, add color to black & white photos in seconds.',
  keywords: 'restore old photos, photo restoration, AI photo repair, colorize photos, fix scratched photos',
  openGraph: {
    title: 'PhotoRestore — Bring Old Photos Back to Life',
    description: 'AI-powered photo restoration. Fix scratches, enhance faces, add color to black & white photos in seconds.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="relative">
        {children}
      </body>
    </html>
  )
}
