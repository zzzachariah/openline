"use client";

import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

// `@supabase/ssr` configures the auth client to persist the session in cookies
// via `document.cookie` rather than `localStorage`. We pin that behaviour
// explicitly so the listener (and every other) login is server-readable and
// does not stash auth state in `localStorage`.
export function createBrowserClient() {
  return createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        sameSite: "lax",
        secure: typeof window !== "undefined" && window.location.protocol === "https:",
        path: "/",
      },
    }
  );
}
