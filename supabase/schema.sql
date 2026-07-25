-- ============================================
-- GYM APP — Core Schema (Auth + Roles)
-- Run this in Supabase SQL Editor
-- ============================================

create type user_role as enum ('owner', 'trainer', 'employee');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role user_role not null default 'employee',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Owners can read every profile (needed for Owner Dashboard later)
create policy "profiles_select_owner"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

-- Users can update their own profile, but not switch their own role
-- (role changes should go through an admin/owner-only endpoint later)
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================
-- Auto-create profile row on signup
-- Reads full_name, phone, role from auth.users.raw_user_meta_data
-- (sent via supabase.auth.sign_up options.data from the backend)
-- ============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'employee')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
