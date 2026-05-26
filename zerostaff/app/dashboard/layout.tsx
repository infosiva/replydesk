import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import type { Tier } from '@/lib/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [userData] = await db
    .select({ tier: users.tier })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  const tier = (userData?.tier ?? 'free') as Tier

  return (
    <div style={{ background: '#05040f', minHeight: '100vh' }}>
      <div className="aurora" />
      <div className="aurora-third" />
      <div className="grain" />
      <Navbar email={session.user.email ?? undefined} tier={tier} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
