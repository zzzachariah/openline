"use client";

import useSWR from "swr";
import { createBrowserClient } from "@/lib/supabase/client";
import { BookingCardData } from "@/components/BookingCard";
import type { Slot } from "@/app/listener/ListenerPageClient";

type RawBooking = {
  id: string;
  format: "text" | "voice";
  status: "upcoming" | "completed" | "cancelled";
  is_saved: boolean | null;
  user: { username: string } | { username: string }[];
  slot: { start_time: string; end_time: string } | { start_time: string; end_time: string }[];
};

export function listenerSlotsKey(userId: string) {
  return ["slots", "listener", userId] as const;
}

export function listenerBookingsKey(userId: string) {
  return ["bookings", "listener", userId] as const;
}

async function slotsFetcher([, , userId]: readonly [string, string, string]): Promise<Slot[]> {
  const supabase = createBrowserClient();
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("time_slots")
    .select("id, start_time, end_time, is_booked")
    .eq("listener_id", userId)
    .gte("end_time", nowIso)
    .order("start_time", { ascending: true });
  return (data ?? []) as Slot[];
}

async function bookingsFetcher(
  [, , userId]: readonly [string, string, string]
): Promise<BookingCardData[]> {
  const supabase = createBrowserClient();
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, format, status, is_saved, user:profiles!bookings_user_id_fkey(username), slot:time_slots!bookings_slot_id_fkey(start_time, end_time)"
    )
    .eq("listener_id", userId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as RawBooking[]).map((r) => {
    const user = Array.isArray(r.user) ? r.user[0] : r.user;
    const slot = Array.isArray(r.slot) ? r.slot[0] : r.slot;
    return {
      id: r.id,
      format: r.format,
      status: r.status,
      counterpartyUsername: user.username,
      startTime: slot.start_time,
      endTime: slot.end_time,
      isSaved: !!r.is_saved,
    };
  });
}

export function useListenerSlots(userId: string, fallbackData: Slot[]) {
  return useSWR(listenerSlotsKey(userId), slotsFetcher, { fallbackData });
}

export function useListenerBookings(userId: string, fallbackData: BookingCardData[]) {
  return useSWR(listenerBookingsKey(userId), bookingsFetcher, { fallbackData });
}
