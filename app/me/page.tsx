"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import BookingCard, { BookingCardData } from "@/components/BookingCard";
import ReviewPanel, { Review } from "@/components/ReviewPanel";
import { createBrowserClient } from "@/lib/supabase/client";

type Tab = "upcoming" | "completed" | "cancelled";

type RawBooking = {
  id: string;
  user_id: string;
  listener_id: string;
  format: "text" | "voice";
  status: "upcoming" | "completed" | "cancelled";
  is_saved: boolean | null;
  listener_id: string;
  listener: { username: string } | { username: string }[];
  slot: { start_time: string; end_time: string } | { start_time: string; end_time: string }[];
};

export default function MePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingCardData[]>([]);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [tab, setTab] = useState<Tab>("upcoming");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login?redirect=/me");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, is_listener")
        .eq("id", auth.user.id)
        .single();
      if (!profile) return;
      if (profile.is_listener) {
        router.push("/listener");
        return;
      }
      if (cancelled) return;
      setUsername(profile.username);

      const { data: rows } = await supabase
        .from("bookings")
        .select(
          "id, user_id, listener_id, format, status, listener:profiles!bookings_listener_id_fkey(username), slot:time_slots!bookings_slot_id_fkey(start_time, end_time)"
        )
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false });

      if (!cancelled && rows) {
        const mapped: BookingCardData[] = (rows as RawBooking[]).map((r) => {
          const listener = Array.isArray(r.listener) ? r.listener[0] : r.listener;
          const slot = Array.isArray(r.slot) ? r.slot[0] : r.slot;
          return {
            id: r.id,
            userId: r.user_id,
            listenerId: r.listener_id,
            format: r.format,
            status: r.status,
            counterpartyUsername: listener.username,
            startTime: slot.start_time,
            endTime: slot.end_time,
          };
        });

        const nowMs = Date.now();
        const expiredIds = mapped
          .filter((b) => b.status === "upcoming" && new Date(b.endTime).getTime() < nowMs)
          .map((b) => b.id);
        if (expiredIds.length) {
          supabase
            .from("bookings")
            .update({ status: "completed" })
            .in("id", expiredIds);
          for (const b of mapped) {
            if (expiredIds.includes(b.id)) b.status = "completed";
          }
        }
        setBookings(mapped);

        const completedIds = mapped.filter((b) => b.status === "completed").map((b) => b.id);
        if (completedIds.length) {
          const { data: rv } = await supabase
            .from("reviews")
            .select("*")
            .in("booking_id", completedIds);
          if (!cancelled && rv) {
            const byId: Record<string, Review> = {};
            for (const r of rv as Review[]) byId[r.booking_id] = r;
            setReviews(byId);
          }
        }
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function copyUsername() {
    if (!username) return;
    try {
      await navigator.clipboard.writeText(username);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

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

              {filtered.length === 0 ? (
                <div className="card text-center text-muted">
                  <p className="mb-4">还没有预约。</p>
                  {tab === "upcoming" && (
                    <Link href="/book" className="btn-primary">
                      预约一次倾诉
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((b) => (
                    <div key={b.id} className="space-y-2">
                      <BookingCard
                        booking={b}
                        now={now}
                        role="user"
                        onCancel={() => cancelBooking(b.id)}
                      />
                      {b.status === "completed" && (
                        <ReviewPanel
                          bookingId={b.id}
                          userId={b.userId}
                          listenerId={b.listenerId}
                          role="user"
                          initialReview={reviews[b.id] ?? null}
                          onReviewChange={(r) =>
                            setReviews((prev) => {
                              const next = { ...prev };
                              if (r) next[b.id] = r;
                              else delete next[b.id];
                              return next;
                            })
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

  return (
    <MePageClient
      userId={userId}
      username={profile.username}
      initialBookings={bookings}
      initialReviews={reviews}
    />
  );
}
