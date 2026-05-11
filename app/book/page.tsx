"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Nav from "@/components/Nav";
import ListenerReviewsModal from "@/components/ListenerReviewsModal";
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

const WEEKDAY_HEADERS = ["一", "二", "三", "四", "五", "六", "日"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function leadingBlanks(firstDayOfWeek: number) {
  return firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
}

export default function BookPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [format, setFormat] = useState<"text" | "voice">("text");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [mobileView, setMobileView] = useState<"calendar" | "info">("calendar");

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
        if (mapped.length > 0) {
          const first = new Date(mapped[0].start_time);
          setSelectedDate(formatDayKey(first));
          setViewMonth(startOfMonth(first));
        }
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const slotsByDay = useMemo(() => {
    const m: Record<string, Slot[]> = {};
    for (const s of slots) {
      const k = formatDayKey(new Date(s.start_time));
      (m[k] ||= []).push(s);
    }
    return m;
  }, [slots]);

  const calendarCells = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const last = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
    const blanks = leadingBlanks(first.getDay());
    const totalDays = last.getDate();
    const cells: ({ date: Date; key: string } | null)[] = [];
    for (let i = 0; i < blanks; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const dt = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
      cells.push({ date: dt, key: formatDayKey(dt) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  const todayKey = formatDayKey(new Date());
  const slotsForSelected = selectedDate ? slotsByDay[selectedDate] || [] : [];

  function pickDate(key: string) {
    setSelectedDate(key);
    setSelectedSlot(null);
    setError(null);
    setMobileView("info");
  }

  function pickSlot(s: Slot) {
    setSelectedSlot(s);
    setFormat("text");
    setError(null);
  }

  function clearSlot() {
    setSelectedSlot(null);
    setError(null);
  }

  async function confirmBooking() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);

    const supabase = createBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/signup?redirect=/book");
      return;
    }

    const slotId = selectedSlot.id;
    const { data: slotCheck } = await supabase
      .from("time_slots")
      .select("is_booked")
      .eq("id", slotId)
      .single();
    if (!slotCheck || slotCheck.is_booked) {
      setError("这个时段刚被预约了，请选择其他时段");
      setSubmitting(false);
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
      setSelectedSlot(null);
      return;
    }

    const { error: insertErr } = await supabase.from("bookings").insert({
      user_id: auth.user.id,
      listener_id: selectedSlot.listener.id,
      slot_id: slotId,
      format,
      status: "upcoming",
    });
    if (insertErr) {
      setError("预约失败，请稍后再试");
      setSubmitting(false);
      return;
    }

    await supabase.from("time_slots").update({ is_booked: true }).eq("id", slotId);
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

  const monthLabel = `${viewMonth.getFullYear()} 年 ${viewMonth.getMonth() + 1} 月`;

  return (
    <>
      <Nav />
      <main className="pt-24 pb-16 min-h-screen">
        <div className="max-w-[960px] mx-auto px-6">
          <h1 className="text-h2 font-medium tracking-tight mb-2">选择一个时段</h1>
          <p className="text-caption text-muted mb-8">
            倾诉是 40 分钟。选好时段后，时间到了你和倾听者会进入聊天室。
          </p>

          {loading ? (
            <div className="text-muted text-center py-12">载入中...</div>
          ) : grouped.length === 0 ? (
            <div className="card text-center text-muted">
              <p>暂时没有可预约的时段。请稍后再来看看。</p>
            </div>
          ) : (
            <>
              <div className="flex lg:hidden mb-4 border border-border rounded-full p-1 bg-surface">
                <button
                  onClick={() => setMobileView("calendar")}
                  className={`flex-1 py-1.5 rounded-full text-[13px] transition-colors ${
                    mobileView === "calendar" ? "bg-accent text-white" : "text-muted"
                  }`}
                >
                  日历
                </button>
                <button
                  onClick={() => setMobileView("info")}
                  className={`flex-1 py-1.5 rounded-full text-[13px] transition-colors ${
                    mobileView === "info" ? "bg-accent text-white" : "text-muted"
                  }`}
                >
                  时段
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`${mobileView === "calendar" ? "block" : "hidden"} lg:block`}>
                  <div className="bg-surface border border-border rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() =>
                          setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
                        }
                        className="p-1.5 rounded-full hover:bg-accent-soft text-muted"
                        aria-label="上个月"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <div className="text-[15px] font-medium">{monthLabel}</div>
                      <button
                        onClick={() =>
                          setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
                        }
                        className="p-1.5 rounded-full hover:bg-accent-soft text-muted"
                        aria-label="下个月"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 mb-1">
                      {WEEKDAY_HEADERS.map((w) => (
                        <div key={w} className="text-center text-[12px] text-muted py-1">
                          {w}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {calendarCells.map((cell, i) => {
                        if (!cell) return <div key={`empty-${i}`} />;
                        const hasSlots = !!slotsByDay[cell.key];
                        const isSelected = selectedDate === cell.key;
                        const isToday = todayKey === cell.key;
                        return (
                          <button
                            key={cell.key}
                            disabled={!hasSlots}
                            onClick={() => pickDate(cell.key)}
                            className={`aspect-square rounded-lg text-[14px] transition-colors flex flex-col items-center justify-center gap-0.5 ${
                              isSelected
                                ? "bg-accent text-white"
                                : !hasSlots
                                  ? "text-muted/50 cursor-not-allowed"
                                  : "hover:bg-accent-soft"
                            } ${isToday && !isSelected ? "ring-1 ring-accent" : ""}`}
                          >
                            <span>{cell.date.getDate()}</span>
                            <span
                              className={`w-1 h-1 rounded-full ${
                                hasSlots
                                  ? isSelected
                                    ? "bg-white"
                                    : "bg-accent"
                                  : "bg-transparent"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className={`${mobileView === "info" ? "block" : "hidden"} lg:block`}>
                  <div className="bg-surface border border-border rounded-xl p-5 min-h-[320px]">
                    {!selectedDate ? (
                      <div className="text-center text-muted py-16 text-[14px]">
                        从左边的日历挑一天，看可预约的时段
                      </div>
                    ) : !selectedSlot ? (
                      <div>
                        <div className="mb-4">
                          <div className="text-[15px] font-medium">
                            {formatDayHeader(new Date(`${selectedDate}T00:00:00`))}
                          </div>
                          <div className="text-caption text-muted mt-0.5">
                            {slotsForSelected.length} 个可预约时段
                          </div>
                        </div>
                        {slotsForSelected.length === 0 ? (
                          <div className="text-center text-muted py-8 text-[14px]">
                            这一天的时段刚被约满，换一天看看
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {slotsForSelected.map((s) => {
                              const start = new Date(s.start_time);
                              const end = new Date(s.end_time);
                              return (
                                <button
                                  key={s.id}
                                  onClick={() => pickSlot(s)}
                                  className="w-full text-left p-3 border border-border rounded-lg hover:border-accent transition-colors flex items-center justify-between gap-4"
                                >
                                  <div>
                                    <div className="text-[14px] font-medium">
                                      {formatTimeRange(start, end)}
                                    </div>
                                    <div className="text-caption text-muted mt-0.5">
                                      {s.listener.username}
                                    </div>
                                  </div>
                                  <span className="text-caption text-accent">选择 →</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <button
                          onClick={clearSlot}
                          className="text-[13px] text-muted hover:text-foreground mb-4 inline-flex items-center gap-1"
                        >
                          <ChevronLeft size={14} /> 返回时段
                        </button>
                        <h3 className="text-[18px] font-medium mb-5">确认预约？</h3>
                        <div className="space-y-3 text-[14px] mb-6">
                          <Row label="倾听者" value={selectedSlot.listener.username} />
                          <Row
                            label="时间"
                            value={`${formatDayHeader(new Date(selectedSlot.start_time))} ${formatTimeRange(
                              new Date(selectedSlot.start_time),
                              new Date(selectedSlot.end_time)
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
                          <button onClick={clearSlot} disabled={submitting} className="btn-ghost">
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
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
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

function FormatRow({
  format,
  setFormat,
}: {
  format: "text" | "voice";
  setFormat: (f: "text" | "voice") => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted shrink-0 text-[14px]">形式</span>
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
