-- OpenLine database schema
-- Run this once against a fresh Supabase project (SQL Editor → New query → paste → Run).

-- =====================================================================
-- Tables
-- =====================================================================

create table if not exists public.profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  username                 text unique not null,
  is_listener              boolean not null default false,
  listener_application_at  timestamptz,
  created_at               timestamptz not null default now()
);

create index if not exists profiles_pending_listener_idx
  on public.profiles(listener_application_at)
  where listener_application_at is not null and is_listener = false;

create table if not exists public.time_slots (
  id            uuid primary key default gen_random_uuid(),
  listener_id   uuid not null references public.profiles(id) on delete cascade,
  start_time    timestamptz not null,
  end_time      timestamptz not null,
  is_booked     boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint time_slots_end_after_start check (end_time > start_time)
);

create index if not exists time_slots_listener_idx   on public.time_slots(listener_id);
create index if not exists time_slots_start_idx      on public.time_slots(start_time);
create index if not exists time_slots_available_idx  on public.time_slots(start_time)
  where is_booked = false;

do $$ begin
  create type booking_format as enum ('text', 'voice');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum ('upcoming', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  listener_id   uuid not null references public.profiles(id) on delete cascade,
  slot_id       uuid not null references public.time_slots(id) on delete restrict,
  format        booking_format not null default 'text',
  status        booking_status not null default 'upcoming',
  created_at    timestamptz not null default now()
);

create index if not exists bookings_user_idx     on public.bookings(user_id);
create index if not exists bookings_listener_idx on public.bookings(listener_id);

-- Prevent two active bookings on the same slot.
-- Cancelled bookings are excluded so a slot can be re-booked after a cancellation.
create unique index if not exists bookings_active_slot_idx
  on public.bookings(slot_id)
  where status <> 'cancelled';

do $$ begin
  create type message_type as enum ('text', 'meeting_code', 'system');
exception when duplicate_object then null; end $$;

create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  content       text not null,
  message_type  message_type not null default 'text',
  created_at    timestamptz not null default now()
);

create index if not exists messages_booking_idx on public.messages(booking_id, created_at);

-- Reviews: one per completed booking. Users write `comment`; listeners may add `listener_reply`.
create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null unique references public.bookings(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  listener_id     uuid not null references public.profiles(id) on delete cascade,
  comment         text not null,
  listener_reply  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  replied_at      timestamptz,
  constraint reviews_comment_not_blank check (length(btrim(comment)) > 0)
);

create index if not exists reviews_listener_idx on public.reviews(listener_id, created_at desc);
create index if not exists reviews_user_idx     on public.reviews(user_id, created_at desc);

-- Homepage counter
create table if not exists public.stats (
  id     text primary key,
  value  bigint not null default 0
);

insert into public.stats(id, value)
values ('total_bookings', 0)
on conflict (id) do nothing;

-- =====================================================================
-- Triggers
-- =====================================================================

-- Increment counter when a booking is created
create or replace function public.increment_booking_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.stats
     set value = value + 1
   where id = 'total_bookings';
  return new;
end;
$$;

drop trigger if exists bookings_increment_counter on public.bookings;
create trigger bookings_increment_counter
  after insert on public.bookings
  for each row execute function public.increment_booking_counter();

-- Reviews update guard: users can only modify `comment`, listeners only `listener_reply`.
-- Also maintains updated_at / replied_at automatically.
create or replace function public.guard_review_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id
     or new.booking_id <> old.booking_id
     or new.user_id <> old.user_id
     or new.listener_id <> old.listener_id
     or new.created_at <> old.created_at then
    raise exception 'reviews: cannot modify identifying fields';
  end if;

  if auth.uid() = old.user_id and auth.uid() <> old.listener_id then
    if new.listener_reply is distinct from old.listener_reply then
      raise exception 'reviews: only the listener can change listener_reply';
    end if;
  elsif auth.uid() = old.listener_id and auth.uid() <> old.user_id then
    if new.comment is distinct from old.comment then
      raise exception 'reviews: only the reviewer can change comment';
    end if;
  end if;

  new.updated_at := now();
  if new.listener_reply is distinct from old.listener_reply then
    new.replied_at := case when new.listener_reply is null then null else now() end;
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_guard_update on public.reviews;
create trigger reviews_guard_update
  before update on public.reviews
  for each row execute function public.guard_review_update();

-- =====================================================================
-- Row Level Security
-- =====================================================================

alter table public.profiles    enable row level security;
alter table public.time_slots  enable row level security;
alter table public.bookings    enable row level security;
alter table public.messages    enable row level security;
alter table public.reviews     enable row level security;
alter table public.stats       enable row level security;

-- Profiles
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

-- A user can read the profile of the listener they have a booking with,
-- and a listener can read the profile of users who booked their slots.
drop policy if exists "profiles: read counterparty" on public.profiles;
create policy "profiles: read counterparty"
  on public.profiles for select to authenticated
  using (
    id in (
      select listener_id from public.bookings where user_id = auth.uid()
      union
      select user_id     from public.bookings where listener_id = auth.uid()
    )
  );

-- All authenticated users can read listener profiles publicly listed via slots
drop policy if exists "profiles: read listeners with slots" on public.profiles;
create policy "profiles: read listeners with slots"
  on public.profiles for select to authenticated
  using (
    is_listener = true
    and exists (select 1 from public.time_slots ts where ts.listener_id = profiles.id)
  );

-- The signup API (service role) handles inserts, so no insert policy for clients.

-- Time slots
drop policy if exists "slots: read all auth" on public.time_slots;
create policy "slots: read all auth"
  on public.time_slots for select to authenticated
  using (true);

drop policy if exists "slots: listener manages own" on public.time_slots;
create policy "slots: listener manages own"
  on public.time_slots for all to authenticated
  using (
    listener_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_listener = true)
  )
  with check (
    listener_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_listener = true)
  );

-- Allow a slot to be marked booked / unbooked only by the listener who owns it
-- or by a user who has a booking for that slot (used to free the slot on cancel).
drop policy if exists "slots: mark booked when booking" on public.time_slots;
create policy "slots: mark booked when booking"
  on public.time_slots for update to authenticated
  using (
    listener_id = auth.uid()
    or exists (
      select 1 from public.bookings b
       where b.slot_id = time_slots.id and b.user_id = auth.uid()
    )
  )
  with check (
    listener_id = auth.uid()
    or exists (
      select 1 from public.bookings b
       where b.slot_id = time_slots.id and b.user_id = auth.uid()
    )
  );

-- Bookings
drop policy if exists "bookings: user reads own" on public.bookings;
create policy "bookings: user reads own"
  on public.bookings for select to authenticated
  using (user_id = auth.uid() or listener_id = auth.uid());

drop policy if exists "bookings: user creates own" on public.bookings;
create policy "bookings: user creates own"
  on public.bookings for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "bookings: parties update" on public.bookings;
create policy "bookings: parties update"
  on public.bookings for update to authenticated
  using (user_id = auth.uid() or listener_id = auth.uid())
  with check (user_id = auth.uid() or listener_id = auth.uid());

-- Messages
drop policy if exists "messages: parties read" on public.messages;
create policy "messages: parties read"
  on public.messages for select to authenticated
  using (
    booking_id in (
      select id from public.bookings
       where user_id = auth.uid() or listener_id = auth.uid()
    )
  );

drop policy if exists "messages: parties write" on public.messages;
create policy "messages: parties write"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and booking_id in (
      select id from public.bookings
       where user_id = auth.uid() or listener_id = auth.uid()
    )
  );

-- Reviews
-- Anyone authenticated can read reviews (browsing listeners before booking).
drop policy if exists "reviews: read all auth" on public.reviews;
create policy "reviews: read all auth"
  on public.reviews for select to authenticated
  using (true);

-- The reviewer (user) may create a review for their own completed booking.
drop policy if exists "reviews: reviewer inserts own" on public.reviews;
create policy "reviews: reviewer inserts own"
  on public.reviews for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.bookings b
       where b.id = booking_id
         and b.user_id = auth.uid()
         and b.listener_id = reviews.listener_id
         and b.status = 'completed'
    )
  );

-- Reviewer can edit/delete their own review; listener can edit replies on reviews about them.
-- The before-update trigger restricts which columns each party may change.
drop policy if exists "reviews: reviewer updates own" on public.reviews;
create policy "reviews: reviewer updates own"
  on public.reviews for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "reviews: listener replies" on public.reviews;
create policy "reviews: listener replies"
  on public.reviews for update to authenticated
  using (listener_id = auth.uid())
  with check (listener_id = auth.uid());

drop policy if exists "reviews: reviewer deletes own" on public.reviews;
create policy "reviews: reviewer deletes own"
  on public.reviews for delete to authenticated
  using (user_id = auth.uid());

-- Stats: read-only public counter
drop policy if exists "stats: public read" on public.stats;
create policy "stats: public read"
  on public.stats for select to anon, authenticated
  using (true);

-- =====================================================================
-- Realtime
-- =====================================================================

alter publication supabase_realtime add table public.messages;

-- =====================================================================
-- Migrations (for projects already running an older schema)
-- =====================================================================
-- Idempotent. Safe to run on a fresh database too.

alter table public.profiles
  add column if not exists listener_application_at timestamptz;

create index if not exists profiles_pending_listener_idx
  on public.profiles(listener_application_at)
  where listener_application_at is not null and is_listener = false;

-- =====================================================================
-- Optional: 7-day message auto-deletion (requires pg_cron extension)
-- =====================================================================
-- Run separately if you want auto-deletion. Uncomment after enabling pg_cron.
--
-- create extension if not exists pg_cron;
--
-- select cron.schedule(
--   'delete-old-messages',
--   '0 3 * * *',
--   $$ delete from public.messages where created_at < now() - interval '7 days' $$
-- );
