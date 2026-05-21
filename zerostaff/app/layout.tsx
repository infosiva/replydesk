import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://zerostaff.app'),
  title: 'ZeroStaff — AI Automation Agency Platform',
  description: 'One brief in, 8 content assets out. AI-powered agency OS: blog, podcast, video, social, email, lead gen — zero employees.',
  openGraph: {
    title: 'ZeroStaff — AI Automation Agency Platform',
    description: 'One brief in, 8 content assets out. Zero employees.',
    images: ['/og.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full" style={{ background: '#080712', color: '#f8fafc' }}>
        {children}
      </body>
    </html>
  )
}
