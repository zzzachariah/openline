"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import BookingCard, { BookingCardData } from "@/components/BookingCard";
import { createBrowserClient } from "@/lib/supabase/client";

type Tab = "upcoming" | "completed" | "cancelled";

type RawBooking = {
  id: string;
  format: "text" | "voice";
  status: "upcoming" | "completed" | "cancelled";
  listener: { username: string } | { username: string }[];
  slot: { start_time: string; end_time: string } | { start_time: string; end_time: string }[];
};

export default function MePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingCardData[]>([]);
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
          "id, format, status, listener:profiles!bookings_listener_id_fkey(username), slot:time_slots!bookings_slot_id_fkey(start_time, end_time)"
        )
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false });

      if (!cancelled && rows) {
        const mapped: BookingCardData[] = (rows as RawBooking[]).map((r) => {
          const listener = Array.isArray(r.listener) ? r.listener[0] : r.listener;
          const slot = Array.isArray(r.slot) ? r.slot[0] : r.slot;
          return {
            id: r.id,
            format: r.format,
            status: r.status,
            counterpartyUsername: listener.username,
            startTime: slot.start_time,
            endTime: slot.end_time,
          };
        });
        setBookings(mapped);
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

  async function logout() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function cancelBooking(id: string) {
    if (!confirm("确认取消这次预约？")) return;
    const supabase = createBrowserClient();
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) return;
    const { data: row } = await supabase
      .from("bookings")
      .select("slot_id")
      .eq("id", id)
      .single();
    if (row?.slot_id) {
      await supabase.from("time_slots").update({ is_booked: false }).eq("id", row.slot_id);
    }
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)));
  }

  const filtered = bookings.filter((b) => b.status === tab);

  return (
    <>
      <Nav />
      <main className="pt-24 pb-16 min-h-screen">
        <div className="max-w-prose mx-auto px-6">
          {loading ? (
            <div className="text-muted text-center py-12">载入中...</div>
          ) : (
            <>
              <div className="mb-12">
                <h1 className="text-h2 font-medium tracking-tight mb-2 flex items-center gap-3 flex-wrap">
                  你好，{username}
                  <button
                    onClick={copyUsername}
                    className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-accent transition-colors px-2 py-1 rounded-md border border-border"
                    aria-label="复制用户名"
                  >
                    {copied ? (
                      <>
                        <Check size={12} />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        复制用户名
                      </>
                    )}
                  </button>
                </h1>
                <p className="text-caption text-muted">
                  记得保存这个用户名——换设备登录时需要它。
                </p>
              </div>

              <div className="flex gap-1 mb-6 border-b border-border">
                {(
                  [
                    { key: "upcoming", label: "即将开始" },
                    { key: "completed", label: "已完成" },
                    { key: "cancelled", label: "已取消" },
                  ] as { key: Tab; label: string }[]
                ).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-4 py-2 text-[14px] -mb-px border-b-2 transition-colors ${
                      tab === t.key
                        ? "border-accent text-foreground"
                        : "border-transparent text-muted hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

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
                    <BookingCard
                      key={b.id}
                      booking={b}
                      now={now}
                      role="user"
                      onCancel={() => cancelBooking(b.id)}
                    />
                  ))}
                </div>
              )}

              <div className="mt-16 text-center">
                <button
                  onClick={logout}
                  className="text-caption text-muted hover:text-foreground transition-colors"
                >
                  退出登录
                </button>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
