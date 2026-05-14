"use client";

import useSWR from "swr";
import { createBrowserClient } from "@/lib/supabase/client";
import { BookingCardData } from "@/components/BookingCard";

type RawBooking = {
  id: string;
  format: "text" | "voice";
  status: "upcoming" | "completed" | "cancelled";
  is_saved: boolean | null;
  listener_id: string;
  listener: { username: string } | { username: string }[];
  slot: { start_time: string; end_time: string } | { start_time: string; end_time: string }[];
};

export function userBookingsKey(userId: string) {
  return ["bookings", "user", userId] as const;
}

async function fetcher([, , userId]: readonly [string, string, string]): Promise<BookingCardData[]> {
  const supabase = createBrowserClient();
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, format, status, is_saved, listener_id, listener:profiles!bookings_listener_id_fkey(username), slot:time_slots!bookings_slot_id_fkey(start_time, end_time)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as RawBooking[]).map((r) => {
    const listener = Array.isArray(r.listener) ? r.listener[0] : r.listener;
    const slot = Array.isArray(r.slot) ? r.slot[0] : r.slot;
    return {
      id: r.id,
      format: r.format,
      status: r.status,
      counterpartyUsername: listener.username,
      counterpartyId: r.listener_id,
      startTime: slot.start_time,
      endTime: slot.end_time,
      isSaved: !!r.is_saved,
    };
  });
}

export function useUserBookings(userId: string, fallbackData: BookingCardData[]) {
  return useSWR(userBookingsKey(userId), fetcher, { fallbackData });
}
