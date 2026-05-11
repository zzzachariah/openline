"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";
import Nav from "@/components/Nav";
import BookingCard, { BookingCardData } from "@/components/BookingCard";
import { createBrowserClient } from "@/lib/supabase/client";
import { useUserBookings } from "@/lib/hooks/useUserBookings";

type Tab = "upcoming" | "completed" | "cancelled";

type Props = {
  userId: string;
  username: string;
  initialBookings: BookingCardData[];
};

export default function MePageClient({ userId, username, initialBookings }: Props) {
  const router = useRouter();
  const { data: bookings = [], mutate } = useUserBookings(userId, initialBookings);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  async function copyUsername() {
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

    await mutate(
      async (current?: BookingCardData[]) => {
        const { error } = await supabase
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("id", id);
        if (error) return current;
        const { data: row } = await supabase
          .from("bookings")
          .select("slot_id")
          .eq("id", id)
          .single();
        if (row?.slot_id) {
          await supabase.from("time_slots").update({ is_booked: false }).eq("id", row.slot_id);
        }
        return current?.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)) ?? [];
      },
      {
        optimisticData: (current?: BookingCardData[]) =>
          current?.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)) ?? [],
        rollbackOnError: true,
        revalidate: false,
      }
    );
  }

  const filtered = bookings.filter((b) => b.status === tab);

  return (
    <>
      <Nav />
      <main className="pt-24 pb-16">
        <div className="max-w-prose mx-auto px-6">
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
                <Link href="/book" prefetch className="btn-primary">
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
        </div>
      </main>
    </>
  );
}
