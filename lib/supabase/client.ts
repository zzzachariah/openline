"use client";

import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// One shared client per browser tab. Multiple SupabaseClient instances each
// spin up their own GoTrueClient, and those GoTrueClients coordinate via
// `navigator.locks` on a storage key derived from the project URL. With
// several components (Nav, ListenerPage, AddSlotModal, ...) calling
// `createBrowserClient()` independently, concurrent `auth.getUser()` calls
// pile up on that shared lock; a token-refresh attempt can starve or
// deadlock the queue, which is why the listener dashboard would hang and
// the 10s wrapper would fire "获取登录状态超时". Reusing one instance keeps
// auth state in a single GoTrueClient and avoids the contention.
let client: SupabaseClient | undefined;

export function createBrowserClient(): SupabaseClient {
  if (client) return client;
  client = createSupabaseBrowserClient(
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
  return client;
}
