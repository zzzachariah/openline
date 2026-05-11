"use client";

import useSWR from "swr";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Slot } from "@/app/book/BookPageClient";

type RawSlot = {
  id: string;
  start_time: string;
  end_time: string;
  listener_id: string;
  listener: { id: string; username: string } | { id: string; username: string }[];
};

export const AVAILABLE_SLOTS_KEY = "slots:available";

async function fetcher(): Promise<Slot[]> {
  const supabase = createBrowserClient();
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("time_slots")
    .select(
      "id, start_time, end_time, listener_id, listener:profiles!time_slots_listener_id_fkey(id, username)"
    )
    .eq("is_booked", false)
    .gt("start_time", nowIso)
    .order("start_time", { ascending: true });

  return ((data ?? []) as RawSlot[]).map((r) => {
    const listener = Array.isArray(r.listener) ? r.listener[0] : r.listener;
    return {
      id: r.id,
      start_time: r.start_time,
      end_time: r.end_time,
      listener: { id: listener.id, username: listener.username },
    };
  });
}

export function useAvailableSlots(fallbackData: Slot[]) {
  return useSWR(AVAILABLE_SLOTS_KEY, fetcher, { fallbackData });
}
