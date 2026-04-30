"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { createBrowserClient } from "@/lib/supabase/client";
import { formatDayHeader, formatDayKey, formatTimeRange } from "@/lib/format";

type Slot = {
  id: string;
  start_time: string;
  end_time: string;
  listener: { id: string; username: string };
};

type RawSlot = {
  id: string;
  start_time: string;
  end_time: string;
  listener_id: string;
  listener: { id: string; username: string } | { id: string; username: string }[];
};

export default function BookPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [format, setFormat] = useState<"text" | "voice">("text");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/signup?redirect=/book");
        return;
      }
      setAuthChecked(true);

      const nowIso = new Date().toISOString();
      const { data: rows } = await supabase
        .from("time_slots")
        .select(
          "id, start_time, end_time, listener_id, listener:profiles!time_slots_listener_id_fkey(id, username)"
        )
        .eq("is_booked", false)
        .gt("start_time", nowIso)
        .order("start_time", { ascending: true });

      if (!cancelled && rows) {
        const mapped: Slot[] = (rows as RawSlot[]).map((r) => {
          const listener = Array.isArray(r.listener) ? r.listener[0] : r.listener;
          return {
            id: r.id,
            start_time: r.start_time,
            end_time: r.end_time,
            listener: { id: listener.id, username: listener.username },
          };
        });
        setSlots(mapped);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const grouped = useMemo(() => {
    const groups: Record<string, { header: string; slots: Slot[] }> = {};
    for (const s of slots) {
      const d = new Date(s.start_time);
      const key = formatDayKey(d);
      if (!groups[key]) {
        groups[key] = { header: formatDayHeader(d), slots: [] };
      }
      groups[key].slots.push(s);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  async function confirmBooking() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);

    const supabase = createBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/signup?redirect=/book");
      return;
    }

    const { data: slotCheck } = await supabase
      .from("time_slots")
      .select("is_booked")
      .eq("id", selected.id)
      .single();
    if (!slotCheck || slotCheck.is_booked) {
      setError("这个时段刚被预约了，请选择其他时段");
      setSubmitting(false);
      setSelected(null);
      setSlots((prev) => prev.filter((s) => s.id !== selected.id));
      return;
    }

    const { error: insertErr } = await supabase.from("bookings").insert({
      user_id: auth.user.id,
      listener_id: selected.listener.id,
      slot_id: selected.id,
      format,
      status: "upcoming",
    });
    if (insertErr) {
      setError("预约失败，请稍后再试");
      setSubmitting(false);
      return;
    }

    await supabase.from("time_slots").update({ is_booked: true }).eq("id", selected.id);
    router.push("/me");
  }

  if (!authChecked) {
    return (
      <>
        <Nav />
        <main className="pt-24 pb-16 min-h-screen">
          <div className="text-muted text-center py-12">载入中...</div>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="pt-24 pb-16 min-h-screen">
        <div className="max-w-[640px] mx-auto px-6">
          <h1 className="text-h2 font-medium tracking-tight mb-2">选择一个时段</h1>
          <p className="text-caption text-muted mb-10">
            倾诉是 40 分钟。选好时段后，时间到了你和倾听者会进入聊天室。
          </p>

          {loading ? (
            <div className="text-muted text-center py-12">载入中...</div>
          ) : slots.length === 0 ? (
            <div className="card text-center text-muted">
              <p>暂时没有可预约的时段。请稍后再来看看。</p>
            </div>
          ) : (
            <div className="space-y-10">
              {grouped.map(([key, group]) => (
                <div key={key}>
                  <h2 className="text-[14px] text-muted mb-3 px-1">{group.header}</h2>
                  <div className="space-y-2">
                    {group.slots.map((s) => {
                      const start = new Date(s.start_time);
                      const end = new Date(s.end_time);
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            setSelected(s);
                            setFormat("text");
                            setError(null);
                          }}
                          className="w-full text-left card hover:border-accent transition-colors"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-[15px] font-medium">
                                {formatTimeRange(start, end)}
                              </div>
                              <div className="text-caption text-muted mt-0.5">
                                {s.listener.username}
                              </div>
                            </div>
                            <span className="text-caption text-accent">预约 →</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => !submitting && setSelected(null)}
          />
          <div className="relative bg-surface border border-border rounded-xl p-7 w-full max-w-[440px]">
            <button
              onClick={() => !submitting && setSelected(null)}
              className="absolute top-4 right-4 text-muted hover:text-foreground"
              aria-label="关闭"
            >
              <X size={18} />
            </button>
            <h3 className="text-[18px] font-medium mb-5">确认预约？</h3>
            <div className="space-y-3 text-[14px] mb-6">
              <Row label="倾听者" value={selected.listener.username} />
              <Row
                label="时间"
                value={`${formatDayHeader(new Date(selected.start_time))} ${formatTimeRange(
                  new Date(selected.start_time),
                  new Date(selected.end_time)
                )}`}
              />
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted shrink-0">形式</span>
                <div className="flex gap-2">
                  <FormatPill
                    label="文字聊天"
                    selected={format === "text"}
                    onClick={() => setFormat("text")}
                  />
                  <FormatPill
                    label="语音"
                    selected={format === "voice"}
                    onClick={() => setFormat("voice")}
                  />
                </div>
              </div>
            </div>
            {format === "voice" && (
              <p className="text-[13px] text-muted bg-accent-soft border-l-2 border-accent px-3 py-2 mb-5 rounded-r">
                选择&ldquo;语音&rdquo;后，倾听者会在约定时间发送腾讯会议号给你。
              </p>
            )}
            {error && <div className="text-[13px] text-danger mb-3">{error}</div>}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSelected(null)}
                disabled={submitting}
                className="btn-ghost"
              >
                取消
              </button>
              <button
                onClick={confirmBooking}
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? "预约中..." : "确认预约"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function FormatPill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[13px] border transition-colors ${
        selected
          ? "border-accent bg-accent text-white"
          : "border-border text-foreground hover:border-accent"
      }`}
    >
      {label}
    </button>
  );
}
