-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (mirrors auth.users, stores tier)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  tier text not null default 'free' check (tier in ('free', 'pro', 'agency')),
  stripe_customer_id text,
  stripe_subscription_id text,
  briefs_used_this_month integer not null default 0,
  briefs_reset_at timestamptz not null default date_trunc('month', now()),
  created_at timestamptz not null default now()
);

-- Workspaces (one per user for Phase 1; agency users can have multiple later)
create table if not exists public.workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  agency_id uuid references public.users(id),
  owner_id uuid not null references public.users(id) on delete cascade,
  brand_profile jsonb default '{}'::jsonb,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now()
);

-- Briefs
create table if not exists public.briefs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  topic text not null,
  brand text not null,
  audience text not null,
  tone text not null default 'professional',
  keywords text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'processing', 'complete', 'error')),
  created_at timestamptz not null default now()
);

-- Assets (one row per output type per brief)
create table if not exists public.assets (
  id uuid primary key default uuid_generate_v4(),
  brief_id uuid not null references public.briefs(id) on delete cascade,
  type text not null check (type in (
    'blog_post', 'podcast_episode', 'video_storyboard',
    'linkedin_posts', 'email_sequence', 'short_clips',
    'lead_gen_pack', 'client_report'
  )),
  content jsonb not null default '{}'::jsonb,
  file_url text,
  download_count integer not null default 0,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Jobs (one row per generation job, for Phase 2 queue — populated in Phase 1 too)
create table if not exists public.jobs (
  id uuid primary key default uuid_generate_v4(),
  brief_id uuid not null references public.briefs(id) on delete cascade,
  type text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'complete', 'error')),
  result_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security
alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.briefs enable row level security;
alter table public.assets enable row level security;
alter table public.jobs enable row level security;

-- Users: own row only
create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_update_own" on public.users for update using (auth.uid() = id);

-- Workspaces: owner sees own
create policy "workspaces_select_owner" on public.workspaces for select using (auth.uid() = owner_id);
create policy "workspaces_insert_owner" on public.workspaces for insert with check (auth.uid() = owner_id);
create policy "workspaces_update_owner" on public.workspaces for update using (auth.uid() = owner_id);

-- Briefs: user sees own
create policy "briefs_select_own" on public.briefs for select using (auth.uid() = user_id);
create policy "briefs_insert_own" on public.briefs for insert with check (auth.uid() = user_id);

-- Assets: user sees briefs they own
create policy "assets_select_own" on public.assets for select using (
  exists (select 1 from public.briefs b where b.id = assets.brief_id and b.user_id = auth.uid())
);
create policy "assets_insert_own" on public.assets for insert with check (
  exists (select 1 from public.briefs b where b.id = assets.brief_id and b.user_id = auth.uid())
);

-- Jobs: user sees own briefs' jobs
create policy "jobs_select_own" on public.jobs for select using (
  exists (select 1 from public.briefs b where b.id = jobs.brief_id and b.user_id = auth.uid())
);

-- Trigger: auto-create user row + workspace on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ws_id uuid;
begin
  insert into public.users (id, email)
  values (new.id, new.email);

  insert into public.workspaces (name, owner_id)
  values (split_part(new.email, '@', 1) || '''s Workspace', new.id)
  returning id into ws_id;

  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
