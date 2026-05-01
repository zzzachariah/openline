# OpenLine

A free, anonymous platform where trained (non-professional) listeners chat with people who feel emotionally unwell but aren't sure if they need to see a real therapist. The product sits in the gap between "I feel off" and "I should see a therapist."

The site is in Simplified Chinese.

## Tech stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS, custom CSS variables for theming
- **Database / Auth / Realtime**: Supabase (Postgres + Auth + Realtime)
- **Fonts**: Inter (Latin) + Noto Sans SC (Chinese), via `next/font/google`
- **Icons**: `lucide-react`
- **Deployment target**: Vercel

## Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd openline
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), create a new project.
2. Wait for the database to provision.
3. In the Supabase dashboard, open **SQL Editor → New query**, paste the entire contents of `supabase/schema.sql`, and run it.
4. From **Settings → API**, copy the **Project URL**, the **anon public** key, and the **service_role** key (keep this one secret — it bypasses RLS).

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

The service role key is used by the signup API route to create users and profiles in a single trusted step. It must never be exposed to the browser — Next.js will only inject `NEXT_PUBLIC_*` variables into client bundles.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Listener accounts

Listeners apply for an account from the website; you (the admin) approve them in Supabase.

### Self-service flow

1. The applicant goes to `/login` and clicks **想成为倾听者？申请加入** (or directly visits `/listener/signup`).
2. They set a password. The site generates a `匿名倾听者XXXXXX` username, creates the auth user, and writes a `listener_application_at` timestamp on the profile. `is_listener` stays `false` until you approve.
3. After signing up they're routed to `/listener/pending`, which shows their username and a "审核中" message.

### Approving applications

In the Supabase **SQL Editor**:

```sql
-- See pending applications (newest first)
select id, username, listener_application_at
  from public.profiles
 where listener_application_at is not null
   and is_listener = false
 order by listener_application_at desc;

-- Approve a listener
update public.profiles
   set is_listener = true
 where username = '匿名倾听者XXXXXX';

-- Reject (clears the application timestamp; the account becomes a regular user)
update public.profiles
   set listener_application_at = null
 where username = '匿名倾听者XXXXXX';
```

The next time the listener logs in, they'll be routed to `/listener` and can add time slots.

### (Fallback) Creating a listener manually

If you want to seed a listener directly without going through the self-service form:

1. **Authentication → Users → Add user → Create new user** in the Supabase dashboard.
2. Use email `l_<6-char-suffix>@openline.local` (e.g. `l_a3k9p2@openline.local`) and a password. The email derivation must match what the login page computes from the username — see `lib/username.ts`.
3. Copy the new user's UUID and run:

   ```sql
   insert into public.profiles (id, username, is_listener)
   values (
     '<user-uuid>',
     '匿名倾听者A3K9P2',  -- must use the same suffix as the email
     true
   );
   ```

   Pick a username that starts with `匿名倾听者` followed by 6 uppercase letters/digits (no `I`, `O`, `0`, `1`). The lowercase suffix must match the email's `l_<suffix>` part.

4. The listener logs in at `/login` with the **username** (not the email).

### Promoting an existing user to listener

```sql
update public.profiles set is_listener = true where username = '匿名用户XXXXXX';
```

Note: the email format is different between users (`<suffix>@openline.local`) and listeners (`l_<suffix>@openline.local`). Promoting an existing user keeps their original email, and login will continue to work because the username still starts with `匿名用户`. If you want the account renamed to a listener-style username, you must also update `auth.users.email` to match.

### Migrating listeners created with the older email scheme

If you set up a listener before the email convention split (when both roles mapped to `<suffix>@openline.local`), realign their `auth.users.email` to the new `l_<suffix>` format so the login form can find them:

```sql
update auth.users
   set email = 'l_' || lower(substring(p.username from char_length('匿名倾听者') + 1)) || '@openline.local'
  from public.profiles p
 where auth.users.id = p.id
   and p.is_listener = true
   and p.username like '匿名倾听者%';
```

## Deployment to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project**, import the repo.
3. **Environment variables**: add the same three variables from `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Do not check `expose to browser` for the service role key.
4. **Build settings**: defaults are fine (`npm run build`, output `.next`).
5. Deploy. Vercel will build and host the app on a `*.vercel.app` URL.

## Notes on data lifecycle

### 7-day message auto-deletion

The privacy promise on the homepage states that chat messages are deleted after 7 days. To enforce this in the database, enable `pg_cron` and schedule a cleanup job. The relevant SQL is included (commented out) at the bottom of `supabase/schema.sql`:

```sql
create extension if not exists pg_cron;

select cron.schedule(
  'delete-old-messages',
  '0 3 * * *',   -- every day at 03:00 UTC
  $$ delete from public.messages where created_at < now() - interval '7 days' $$
);
```

Run those statements in the SQL Editor after the schema is applied. `pg_cron` is available on all Supabase paid tiers and most free-tier projects.

### Realtime

The schema adds `public.messages` to the `supabase_realtime` publication so the chat room can subscribe to inserts. Verify under **Database → Replication** that the publication is enabled for the `messages` table.

### Counter

The homepage counter is backed by a row in the `stats` table (`id = 'total_bookings'`). A trigger increments it whenever a booking is created.

## Project structure

```
app/
  page.tsx                          — Homepage (10 vertical scroll-snap slides)
  signup/page.tsx                   — User sign up
  login/page.tsx                    — Login (regular users + listeners)
  book/page.tsx                     — Browse and book a slot
  me/page.tsx                       — User dashboard
  listener/page.tsx                 — Listener dashboard (approved listeners)
  listener/signup/page.tsx          — Listener self-service application
  listener/pending/page.tsx         — "审核中" landing page for pending listeners
  chat/[bookingId]/page.tsx         — User-side chat room
  listener/chat/[bookingId]/page.tsx — Listener-side chat room
  api/signup/route.ts               — Server route that creates user + profile (role=user|listener)
  layout.tsx, globals.css           — Root layout, fonts, theme
components/
  Logo.tsx, Button.tsx, Slide.tsx, Counter.tsx, SlideIndicator.tsx,
  Nav.tsx, Footer.tsx, ThemeProvider.tsx, BookingCard.tsx, ChatRoom.tsx
lib/
  supabase/client.ts                — Browser Supabase client
  supabase/server.ts                — Server / service-role clients
  username.ts                       — Random username generator
  format.ts                         — Date / time formatting
middleware.ts                       — Auth refresh middleware
supabase/schema.sql                 — Run this once in Supabase SQL Editor
```

## Brand & design notes

- The brand voice is calm, honest, restrained, human. The Chinese copy is verbatim — do not paraphrase.
- The visual design relies on whitespace and typography, not decoration. No gratuitous shadows or gradients. Sage accent (`#5B9B8E`) is used sparingly.
- Light mode is the default. Dark mode is available via the toggle in the footer and persists in `localStorage`.
- Body weights stop at 500. Premium minimal design relies on size and color contrast.
