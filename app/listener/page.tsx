import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { BookingCardData } from "@/components/BookingCard";
import ListenerPageClient, { type Slot } from "./ListenerPageClient";

type RawBooking = {
  id: string;
  format: "text" | "voice";
  status: "upcoming" | "completed" | "cancelled";
  is_saved: boolean | null;
  user: { username: string } | { username: string }[];
  slot: { start_time: string; end_time: string } | { start_time: string; end_time: string }[];
};

export const dynamic = "force-dynamic";

export default async function ListenerPage() {
  const supabase = createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect("/login?redirect=/listener");
  }

  const userId = auth.user.id;
  const nowIso = new Date().toISOString();

  const [{ data: profile }, { data: slotRows }, { data: bookingRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, is_listener, listener_application_at")
      .eq("id", userId)
      .single(),
    supabase
      .from("time_slots")
      .select("id, start_time, end_time, is_booked")
      .eq("listener_id", userId)
      .gte("end_time", nowIso)
      .order("start_time", { ascending: true }),
    supabase
      .from("bookings")
      .select(
        "id, format, status, user:profiles!bookings_user_id_fkey(username), slot:time_slots!bookings_slot_id_fkey(start_time, end_time)"
      )
      .eq("listener_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (!profile?.is_listener) {
    if (profile?.listener_application_at) {
      redirect("/listener/pending");
    }
    redirect("/me");
  }

  const slots: Slot[] = (slotRows ?? []) as Slot[];
  const bookings: BookingCardData[] = ((bookingRows ?? []) as RawBooking[]).map((r) => {
    const user = Array.isArray(r.user) ? r.user[0] : r.user;
    const slot = Array.isArray(r.slot) ? r.slot[0] : r.slot;
    return {
      id: r.id,
      format: r.format,
      status: r.status,
      counterpartyUsername: user.username,
      startTime: slot.start_time,
      endTime: slot.end_time,
    };
  });

  return (
    <ListenerPageClient
      userId={userId}
      username={profile.username}
      initialSlots={slots}
      initialBookings={bookings}
    />
  );
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
