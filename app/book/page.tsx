import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import BookPageClient, { type Slot } from "./BookPageClient";

type RawSlot = {
  id: string;
  start_time: string;
  end_time: string;
  listener_id: string;
  listener: { id: string; username: string } | { id: string; username: string }[];
};

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const supabase = createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect("/signup?redirect=/book");
  }

  const nowIso = new Date().toISOString();
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, is_listener, listener_application_at")
      .eq("id", auth.user.id)
      .maybeSingle(),
    supabase
      .from("time_slots")
      .select(
        "id, start_time, end_time, listener_id, listener:profiles!time_slots_listener_id_fkey(id, username)"
      )
      .eq("is_booked", false)
      .gt("start_time", nowIso)
      .order("start_time", { ascending: true }),
  ]);

  const initialSlots: Slot[] = ((rows ?? []) as RawSlot[]).map((r) => {
    const listener = Array.isArray(r.listener) ? r.listener[0] : r.listener;
    return {
      id: r.id,
      start_time: r.start_time,
      end_time: r.end_time,
      listener: { id: listener.id, username: listener.username },
    };
  });

  return (
    <BookPageClient
      userId={auth.user.id}
      initialSlots={initialSlots}
      navUser={
        profile
          ? {
              username: profile.username,
              is_listener: !!profile.is_listener,
              listener_application_at: profile.listener_application_at ?? null,
            }
          : null
      }
    />
  );
}
