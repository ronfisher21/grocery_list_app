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

create policy "Service role can manage manual_overrides"
  on public.manual_overrides for all
  to service_role
  using (true)
  with check (true);
