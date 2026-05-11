import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { BookingCardData } from "@/components/BookingCard";
import MePageClient, { type MyReview, type BookingWithListener } from "./MePageClient";

type RawBooking = {
  id: string;
  format: "text" | "voice";
  status: "upcoming" | "completed" | "cancelled";
  is_saved: boolean | null;
  listener_id: string;
  listener: { username: string } | { username: string }[];
  slot: { start_time: string; end_time: string } | { start_time: string; end_time: string }[];
};

export const dynamic = "force-dynamic";

export default async function MePage() {
  const supabase = createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect("/login?redirect=/me");
  }

  const userId = auth.user.id;
  const [{ data: profile }, { data: rawBookings }, { data: rawReviews }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, is_listener")
      .eq("id", userId)
      .single(),
    supabase
      .from("bookings")
      .select(
        "id, format, status, is_saved, listener_id, listener:profiles!bookings_listener_id_fkey(username), slot:time_slots!bookings_slot_id_fkey(start_time, end_time)"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, booking_id, comment, listener_reply, created_at, replied_at")
      .eq("user_id", userId),
  ]);

  if (!profile) {
    redirect("/login?redirect=/me");
  }
  if (profile.is_listener) {
    redirect("/listener");
  }

  const bookings: BookingWithListener[] = ((rawBookings ?? []) as RawBooking[]).map((r) => {
    const listener = Array.isArray(r.listener) ? r.listener[0] : r.listener;
    const slot = Array.isArray(r.slot) ? r.slot[0] : r.slot;
    const card: BookingCardData = {
      id: r.id,
      format: r.format,
      status: r.status,
      counterpartyUsername: listener.username,
      startTime: slot.start_time,
      endTime: slot.end_time,
      isSaved: !!r.is_saved,
    };
    return { ...card, listenerId: r.listener_id };
  });

  const reviews: MyReview[] = (rawReviews ?? []) as MyReview[];

  return (
    <MePageClient
      userId={userId}
      username={profile.username}
      initialBookings={bookings}
      initialReviews={reviews}
    />
  );
}
