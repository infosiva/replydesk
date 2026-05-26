import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  date,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const genUuid = sql`gen_random_uuid()`
const emptyJsonb = sql`'{}'::jsonb`
const emptyTextArray = sql`'{}'`

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(genUuid),
  name: text('name'),
  email: text('email').notNull(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  tier: text('tier').notNull().default('free'),
  stripe_customer_id: text('stripe_customer_id'),
  stripe_subscription_id: text('stripe_subscription_id'),
  briefs_used_this_month: integer('briefs_used_this_month').notNull().default(0),
  briefs_reset_at: timestamp('briefs_reset_at', { withTimezone: true }).notNull().defaultNow(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().default(genUuid),
  name: text('name').notNull(),
  agency_id: uuid('agency_id').references(() => users.id),
  owner_id: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  brand_profile: jsonb('brand_profile').default(emptyJsonb),
  onboarding_complete: boolean('onboarding_complete').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const briefs = pgTable('briefs', {
  id: uuid('id').primaryKey().default(genUuid),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  topic: text('topic').notNull(),
  brand: text('brand').notNull(),
  audience: text('audience').notNull(),
  tone: text('tone').notNull().default('professional'),
  keywords: text('keywords').array().notNull().default(emptyTextArray),
  status: text('status').notNull().default('pending'),
  jobs_total: integer('jobs_total').notNull().default(1),
  jobs_done: integer('jobs_done').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().default(genUuid),
  brief_id: uuid('brief_id').notNull().references(() => briefs.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  content: jsonb('content').notNull().default(emptyJsonb),
  file_url: text('file_url'),
  file_size_bytes: integer('file_size_bytes'),
  download_count: integer('download_count').notNull().default(0),
  approved_at: timestamp('approved_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().default(genUuid),
  brief_id: uuid('brief_id').notNull().references(() => briefs.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  status: text('status').notNull().default('pending'),
  result_url: text('result_url'),
  error: text('error'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const revisions = pgTable('revisions', {
  id: uuid('id').primaryKey().default(genUuid),
  asset_id: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  round: integer('round').notNull().default(1),
  status: text('status').notNull().default('pending'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().default(genUuid),
  asset_id: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  revision_id: uuid('revision_id').references(() => revisions.id, { onDelete: 'set null' }),
  author_id: uuid('author_id'),
  author_email: text('author_email'),
  body: text('body').notNull(),
  resolved: boolean('resolved').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const calendar_items = pgTable('calendar_items', {
  id: uuid('id').primaryKey().default(genUuid),
  asset_id: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  publish_date: date('publish_date'),
  status: text('status').notNull().default('draft'),
  platform: text('platform'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const proposals = pgTable('proposals', {
  id: uuid('id').primaryKey().default(genUuid),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  client_email: text('client_email').notNull(),
  client_name: text('client_name').notNull(),
  title: text('title').notNull(),
  executive_summary: text('executive_summary'),
  timeline_notes: text('timeline_notes'),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  billing_cadence: text('billing_cadence').notNull().default('monthly'),
  status: text('status').notNull().default('draft'),
  pdf_url: text('pdf_url'),
  accepted_at: timestamp('accepted_at', { withTimezone: true }),
  accepted_ip: text('accepted_ip'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const proposal_items = pgTable('proposal_items', {
  id: uuid('id').primaryKey().default(genUuid),
  proposal_id: uuid('proposal_id').notNull().references(() => proposals.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total: numeric('total', { precision: 10, scale: 2 }).notNull().default('0'),
})

export const threads = pgTable('threads', {
  id: uuid('id').primaryKey().default(genUuid),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  brief_id: uuid('brief_id').references(() => briefs.id, { onDelete: 'set null' }),
  subject: text('subject').notNull(),
  client_email: text('client_email').notNull(),
  status: text('status').notNull().default('open'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().default(genUuid),
  thread_id: uuid('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  sender_id: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
  sender_email: text('sender_email').notNull(),
  body: text('body').notNull(),
  direction: text('direction').notNull().default('outbound'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// NextAuth v5 Drizzle adapter tables
export const accounts = pgTable('accounts', {
  userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
})

export const sessions = pgTable('sessions', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})

export const verification_tokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})
