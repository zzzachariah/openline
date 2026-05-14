import { createServerClient } from "@/lib/supabase/server";
import HomePageClient from "./HomePageClient";
import type { NavUserShape } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createServerClient();

  // Auth check on the homepage is best-effort: a signed-out visitor is the
  // common case and must not be redirected. We run both queries in parallel so
  // the unauthenticated path doesn't pay for the profile lookup.
  const { data: auth } = await supabase.auth.getUser();

  const [statsResult, profileResult] = await Promise.all([
    supabase.from("stats").select("value").eq("id", "total_bookings").maybeSingle(),
    auth.user
      ? supabase
          .from("profiles")
          .select("username, is_listener, listener_application_at")
          .eq("id", auth.user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const bookingTotal = (statsResult.data?.value as number | undefined) ?? 0;
  const profile = profileResult.data;
  const navUser: NavUserShape | null = profile
    ? {
        username: profile.username,
        is_listener: !!profile.is_listener,
        listener_application_at: profile.listener_application_at ?? null,
      }
    : null;

  return <HomePageClient bookingTotal={bookingTotal} navUser={navUser} />;
}
