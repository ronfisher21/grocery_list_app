-- Run this in Supabase SQL Editor to create the manual_overrides table (§6).
-- Step 3: Define in Supabase.

create table if not exists public.manual_overrides (
  id uuid primary key default gen_random_uuid(),
  item_name_normalized text not null unique,
  category text not null,
  last_corrected_at timestamptz not null default now()
);

create index if not exists idx_manual_overrides_last_corrected_at
  on public.manual_overrides (last_corrected_at desc);

alter table public.manual_overrides enable row level security;

-- Backend (service_role) reads overrides for Layer 1/2.
create policy "Service role can manage manual_overrides"
  on public.manual_overrides for all
  to service_role
  using (true)
  with check (true);

-- App (anon or authenticated) must be able to write when user corrects a category.
create policy "App can insert and update manual_overrides"
  on public.manual_overrides for all
  to anon, authenticated
  using (true)
  with check (true);
