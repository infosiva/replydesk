-- Migration: Add Affiliates, Enhanced Alerts, and User Device Tokens
-- Run this SQL in your Supabase SQL editor

-- =============================================================================
-- AFFILIATES TABLES
-- =============================================================================

-- Referral codes for affiliate program
create table if not exists referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null unique,
  code text not null unique,
  created_at timestamptz default now()
);

-- Track referrals between users
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references auth.users(id) not null,
  referred_id uuid references auth.users(id) not null unique,
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'rewarded')),
  created_at timestamptz default now(),
  activated_at timestamptz
);

-- Track affiliate rewards/commissions
create table if not exists affiliate_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  referral_id uuid references referrals(id),
  reward_type text not null check (reward_type in ('signup_bonus', 'commission', 'milestone')),
  amount numeric not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  created_at timestamptz default now()
);

-- Indexes for affiliates
create index if not exists idx_referral_codes_code on referral_codes(code);
create index if not exists idx_referrals_referrer on referrals(referrer_id);
create index if not exists idx_referrals_referred on referrals(referred_id);
create index if not exists idx_affiliate_rewards_user on affiliate_rewards(user_id);

-- =============================================================================
-- ALERTS ENHANCEMENTS
-- =============================================================================

-- Add new columns to alerts table (safe for existing data)
alter table alerts add column if not exists alert_type text default 'price'
  check (alert_type in ('price', 'percent_change', 'volume', 'rsi', 'macd_cross'));
alter table alerts add column if not exists time_frame text default '1d';
alter table alerts add column if not exists notification_channels jsonb default '["in_app"]';
alter table alerts add column if not exists triggered_at timestamptz;

-- Alert history to track triggered alerts
create table if not exists alert_history (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid references alerts(id) on delete cascade,
  user_id uuid references auth.users(id) not null,
  symbol text not null,
  alert_type text not null,
  condition_met text not null,
  price_at_trigger numeric,
  created_at timestamptz default now()
);

-- Indexes for alert history
create index if not exists idx_alert_history_user on alert_history(user_id);
create index if not exists idx_alert_history_symbol on alert_history(symbol);
create index if not exists idx_alert_history_created on alert_history(created_at desc);

-- =============================================================================
-- USER DEVICE TOKENS (for push notifications)
-- =============================================================================

create table if not exists user_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  token text not null unique,
  platform text default 'web' check (platform in ('web', 'ios', 'android')),
  created_at timestamptz default now(),
  last_used_at timestamptz default now()
);

create index if not exists idx_device_tokens_user on user_device_tokens(user_id);

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all new tables
alter table referral_codes enable row level security;
alter table referrals enable row level security;
alter table affiliate_rewards enable row level security;
alter table alert_history enable row level security;
alter table user_device_tokens enable row level security;

-- RLS Policies for referral_codes
create policy "Users can view their own referral code"
  on referral_codes for select
  using (auth.uid() = user_id);

create policy "Users can create their own referral code"
  on referral_codes for insert
  with check (auth.uid() = user_id);

-- RLS Policies for referrals (referrers can view their referrals)
create policy "Users can view referrals they made"
  on referrals for select
  using (auth.uid() = referrer_id);

-- RLS Policies for affiliate_rewards
create policy "Users can view their own rewards"
  on affiliate_rewards for select
  using (auth.uid() = user_id);

-- RLS Policies for alert_history
create policy "Users can view their own alert history"
  on alert_history for select
  using (auth.uid() = user_id);

-- RLS Policies for user_device_tokens
create policy "Users can manage their own device tokens"
  on user_device_tokens for all
  using (auth.uid() = user_id);

-- =============================================================================
-- SERVICE ROLE ACCESS (for backend operations)
-- =============================================================================

-- Grant service role full access to these tables
-- This is handled automatically by Supabase for service_role key

-- =============================================================================
-- OPTIONAL: Watchlist table (if not already created)
-- =============================================================================

create table if not exists watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  symbol text not null,
  added_at timestamptz default now(),
  unique(user_id, symbol)
);

alter table watchlists enable row level security;

create policy "Users can manage their own watchlist"
  on watchlists for all
  using (auth.uid() = user_id);

create index if not exists idx_watchlists_user on watchlists(user_id);
