import NextAuth from 'next-auth'
import Resend from 'next-auth/providers/resend'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from './db'
import * as schema from './schema'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verification_tokens,
  }),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM_ADDRESS ?? 'ZeroStaff <noreply@mail.zerostaff.app>',
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id
      return session
    },
    async signIn({ user }) {
      // Auto-create workspace for new users
      const { eq } = await import('drizzle-orm')
      const existing = await db
        .select({ id: schema.workspaces.id })
        .from(schema.workspaces)
        .where(eq(schema.workspaces.owner_id, user.id!))
        .limit(1)

      if (existing.length === 0 && user.email) {
        await db.insert(schema.workspaces).values({
          name: `${user.email.split('@')[0]}'s Workspace`,
          owner_id: user.id!,
        })
      }
      return true
    },
  },
  pages: {
    signIn: '/login',
    verifyRequest: '/login?verify=1',
  },
})
