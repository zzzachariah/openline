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

## Creating a listener account

For v1, listener accounts are provisioned manually:

1. Go to **Authentication → Users → Add user → Create new user** in the Supabase dashboard.
2. Use any email (e.g. `listener1@openline.local`) and a strong password. The email is just an internal handle; it is never shown.
3. After the user is created, copy the user's UUID.
4. Open **SQL Editor** and run:

   ```sql
   insert into public.profiles (id, username, is_listener)
   values (
     '<user-uuid>',
     '匿名倾听者TESTER',  -- pick a unique username; you may use the helper format
     true
   );
   ```

   Pick any username that starts with `匿名倾听者` and ends in 6 characters (uppercase letters and digits, avoiding `I`, `O`, `0`, `1`).

5. The listener can now log in at `/login` with **the username** (not the email) and the password you set.
6. Once logged in, the listener will be redirected to `/listener` and can add available time slots.

To convert an existing user into a listener, run:

```sql
update public.profiles set is_listener = true where username = '匿名用户XXXXXX';
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
  signup/page.tsx                   — Sign up
  login/page.tsx                    — Login
  book/page.tsx                     — Browse and book a slot
  me/page.tsx                       — User dashboard
  listener/page.tsx                 — Listener dashboard
  chat/[bookingId]/page.tsx         — User-side chat room
  listener/chat/[bookingId]/page.tsx — Listener-side chat room
  api/signup/route.ts               — Server route that creates user + profile
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
