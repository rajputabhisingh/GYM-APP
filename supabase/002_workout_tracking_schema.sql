-- ============================================
-- GYM APP — Workout Tracking Schema
-- Run AFTER 001 (profiles table + user_role enum must already exist)
-- Safe to re-run — uses IF NOT EXISTS / OR REPLACE everywhere possible
-- ============================================

create extension if not exists pgcrypto;

-- Re-affirm helper trigger fn (in case 001 wasn't run with this exact version)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Non-recursive role-check helpers (avoids the RLS recursion issue on profiles)
create or replace function public.is_trainer_or_owner()
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('trainer', 'owner')
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- ============================================
-- Enums
-- ============================================
do $$ begin
  create type muscle_group as enum (
    'chest','back','shoulders','biceps','triceps','forearms',
    'legs','glutes','core','cardio','full_body'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type exercise_category as enum ('strength','cardio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type difficulty_level as enum ('easy','moderate','hard','failure');
exception when duplicate_object then null; end $$;

do $$ begin
  create type workout_source as enum ('manual','voice');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum (
    'workout_reminder','missed_workout','weekly_report',
    'monthly_report','personal_record'
  );
exception when duplicate_object then null; end $$;

-- ============================================
-- Exercise catalog (reference data — Flat Bench Press, Treadmill, etc.)
-- ============================================
create table if not exists public.exercise_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category exercise_category not null default 'strength',
  muscle_group muscle_group not null,
  created_at timestamptz not null default now()
);

alter table public.exercise_catalog enable row level security;

drop policy if exists "exercise_catalog_select_all" on public.exercise_catalog;
create policy "exercise_catalog_select_all"
  on public.exercise_catalog for select to authenticated using (true);

drop policy if exists "exercise_catalog_insert_trainer_owner" on public.exercise_catalog;
create policy "exercise_catalog_insert_trainer_owner"
  on public.exercise_catalog for insert to authenticated
  with check (public.is_trainer_or_owner());

drop policy if exists "exercise_catalog_update_trainer_owner" on public.exercise_catalog;
create policy "exercise_catalog_update_trainer_owner"
  on public.exercise_catalog for update to authenticated
  using (public.is_trainer_or_owner());

-- ============================================
-- Workouts — one row per daily session (e.g. "Chest + Biceps")
-- ============================================
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_date date not null default current_date,
  title text,
  notes text,
  source workout_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workouts_user_date on public.workouts(user_id, workout_date desc);

alter table public.workouts enable row level security;

drop policy if exists "workouts_select" on public.workouts;
create policy "workouts_select"
  on public.workouts for select to authenticated
  using (auth.uid() = user_id or public.is_trainer_or_owner());

drop policy if exists "workouts_insert_own" on public.workouts;
create policy "workouts_insert_own"
  on public.workouts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "workouts_update_own" on public.workouts;
create policy "workouts_update_own"
  on public.workouts for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "workouts_delete_own" on public.workouts;
create policy "workouts_delete_own"
  on public.workouts for delete to authenticated
  using (auth.uid() = user_id);

drop trigger if exists workouts_set_updated_at on public.workouts;
create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

-- ============================================
-- Workout exercises — exercises performed within a workout
-- ============================================
create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercise_catalog(id),
  exercise_order int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_workout_exercises_workout on public.workout_exercises(workout_id);

alter table public.workout_exercises enable row level security;

drop policy if exists "workout_exercises_select" on public.workout_exercises;
create policy "workout_exercises_select"
  on public.workout_exercises for select to authenticated
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and (w.user_id = auth.uid() or public.is_trainer_or_owner())
    )
  );

drop policy if exists "workout_exercises_write_own" on public.workout_exercises;
create policy "workout_exercises_write_own"
  on public.workout_exercises for all to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

-- ============================================
-- Exercise sets — weight × reps × difficulty per set
-- ============================================
create table if not exists public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number int not null,
  weight_kg numeric(6,2),
  reps int,
  difficulty difficulty_level,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_exercise_sets_we on public.exercise_sets(workout_exercise_id);

alter table public.exercise_sets enable row level security;

drop policy if exists "exercise_sets_select" on public.exercise_sets;
create policy "exercise_sets_select"
  on public.exercise_sets for select to authenticated
  using (
    exists (
      select 1 from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id and (w.user_id = auth.uid() or public.is_trainer_or_owner())
    )
  );

drop policy if exists "exercise_sets_write_own" on public.exercise_sets;
create policy "exercise_sets_write_own"
  on public.exercise_sets for all to authenticated
  using (
    exists (
      select 1 from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id and w.user_id = auth.uid()
    )
  );

-- ============================================
-- Cardio sessions
-- ============================================
create table if not exists public.cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid references public.exercise_catalog(id),
  activity_name text not null,
  speed numeric(6,2),
  duration_minutes numeric(6,2) not null,
  calories_burned numeric(6,2),
  heart_rate int,
  created_at timestamptz not null default now()
);

create index if not exists idx_cardio_sessions_workout on public.cardio_sessions(workout_id);

alter table public.cardio_sessions enable row level security;

drop policy if exists "cardio_sessions_select" on public.cardio_sessions;
create policy "cardio_sessions_select"
  on public.cardio_sessions for select to authenticated
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and (w.user_id = auth.uid() or public.is_trainer_or_owner())
    )
  );

drop policy if exists "cardio_sessions_write_own" on public.cardio_sessions;
create policy "cardio_sessions_write_own"
  on public.cardio_sessions for all to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

-- ============================================
-- Voice recordings — raw audio + transcript
-- ============================================
create table if not exists public.voice_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_id uuid references public.workouts(id) on delete set null,
  storage_path text not null,
  transcript text,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_voice_recordings_user on public.voice_recordings(user_id);

alter table public.voice_recordings enable row level security;

drop policy if exists "voice_recordings_select" on public.voice_recordings;
create policy "voice_recordings_select"
  on public.voice_recordings for select to authenticated
  using (auth.uid() = user_id or public.is_trainer_or_owner());

drop policy if exists "voice_recordings_write_own" on public.voice_recordings;
create policy "voice_recordings_write_own"
  on public.voice_recordings for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================
-- Personal records — auto-computed PRs per exercise
-- ============================================
create table if not exists public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercise_catalog(id),
  metric text not null check (metric in ('max_weight','max_reps','max_volume')),
  value numeric(8,2) not null,
  achieved_on date not null default current_date,
  workout_exercise_id uuid references public.workout_exercises(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, exercise_id, metric)
);

alter table public.personal_records enable row level security;

drop policy if exists "personal_records_select" on public.personal_records;
create policy "personal_records_select"
  on public.personal_records for select to authenticated
  using (auth.uid() = user_id or public.is_trainer_or_owner());

drop policy if exists "personal_records_write_own" on public.personal_records;
create policy "personal_records_write_own"
  on public.personal_records for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================
-- Notifications
-- ============================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type notification_type not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread on public.notifications(user_id, is_read);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (auth.uid() = user_id);

-- ============================================
-- Seed common exercises from the spec
-- ============================================
insert into public.exercise_catalog (name, category, muscle_group) values
  ('Flat Bench Press (Dumbbells)', 'strength', 'chest'),
  ('Incline Bench Press', 'strength', 'chest'),
  ('Pec Deck', 'strength', 'chest'),
  ('Cable Fly', 'strength', 'chest'),
  ('Biceps Curl', 'strength', 'biceps'),
  ('Hammer Curl', 'strength', 'biceps'),
  ('Preacher Curl', 'strength', 'biceps'),
  ('Wrist Curl', 'strength', 'forearms'),
  ('Treadmill Running', 'cardio', 'cardio')
on conflict (name) do nothing;
