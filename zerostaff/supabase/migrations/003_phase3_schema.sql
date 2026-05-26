-- Revisions: tracks approval state per asset
create table if not exists public.revisions (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  round integer not null default 1,
  status text not null default 'pending' check (status in ('pending', 'approved', 'changes_requested')),
  created_at timestamptz not null default now()
);

-- Comments: inline feedback per asset
create table if not exists public.comments (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  revision_id uuid references public.revisions(id) on delete set null,
  author_id uuid references auth.users(id) on delete set null,
  author_email text,
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Content calendar items
create table if not exists public.calendar_items (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  publish_date date,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'scheduled', 'published')),
  platform text,
  created_at timestamptz not null default now()
);

-- Proposals
create table if not exists public.proposals (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_email text not null,
  client_name text not null,
  title text not null,
  executive_summary text,
  timeline_notes text,
  total_amount numeric(10, 2) not null default 0,
  billing_cadence text not null default 'monthly' check (billing_cadence in ('one_off', 'monthly', 'quarterly')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined')),
  pdf_url text,
  accepted_at timestamptz,
  accepted_ip text,
  created_at timestamptz not null default now()
);

-- Proposal line items
create table if not exists public.proposal_items (
  id uuid primary key default uuid_generate_v4(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(10, 2) not null,
  total numeric(10, 2) generated always as (quantity * unit_price) stored
);

-- RLS
alter table public.revisions enable row level security;
alter table public.comments enable row level security;
alter table public.calendar_items enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;

-- Revisions: workspace owner via asset → brief
create policy "revisions_workspace_owner" on public.revisions
  for all using (
    asset_id in (
      select a.id from public.assets a
      join public.briefs b on b.id = a.brief_id
      join public.workspaces w on w.id = b.workspace_id
      where w.owner_id = auth.uid()
    )
  );

create policy "comments_workspace_owner" on public.comments
  for all using (
    asset_id in (
      select a.id from public.assets a
      join public.briefs b on b.id = a.brief_id
      join public.workspaces w on w.id = b.workspace_id
      where w.owner_id = auth.uid()
    )
  );

create policy "calendar_items_workspace_owner" on public.calendar_items
  for all using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

create policy "proposals_workspace_owner" on public.proposals
  for all using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

create policy "proposal_items_owner" on public.proposal_items
  for all using (
    proposal_id in (
      select p.id from public.proposals p
      join public.workspaces w on w.id = p.workspace_id
      where w.owner_id = auth.uid()
    )
  );

-- Realtime
do $$ begin
  alter publication supabase_realtime add table public.revisions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null; end $$;
