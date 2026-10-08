-- Taxi partnership table: clients use the deployed edge endpoint, not this table directly.
create table if not exists public.taxi_partner_listings (
 id uuid primary key default gen_random_uuid(),
 edit_token_hash text not null unique check(length(edit_token_hash)=64),
 driver_name text not null check(length(driver_name) between 1 and 60),
 area text not null check(length(area) between 2 and 100),
 shift text not null check(shift in ('day','night')),
 phone text not null check(phone ~ '^\+[0-9]{8,15}$'),
 availability text not null default 'available' check(availability in ('available','matched')),
 company text not null check(company in ('arabia','dtc','kabi')),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '30 days'
);
alter table public.taxi_partner_listings enable row level security;
revoke all on public.taxi_partner_listings from anon, authenticated;
grant all on public.taxi_partner_listings to service_role;
create policy "Direct client access denied" on public.taxi_partner_listings for all to anon, authenticated using (false) with check (false);
create index if not exists taxi_partner_listings_available on public.taxi_partner_listings (expires_at,updated_at desc);
