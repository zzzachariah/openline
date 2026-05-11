"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Shuffle, Sparkles, X } from "lucide-react";
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

type TimeGroup = {
  key: string;
  startTime: string;
  endTime: string;
  slots: Slot[];
};

type DayGroup = {
  key: string;
  header: string;
  timeGroups: TimeGroup[];
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
  const [selectedSingleSlot, setSelectedSingleSlot] = useState<Slot | null>(null);
  const [rouletteGroup, setRouletteGroup] = useState<TimeGroup | null>(null);
  const [reviewsFor, setReviewsFor] = useState<{ id: string; username: string } | null>(null);
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

  const dayGroups = useMemo<DayGroup[]>(() => {
    const days: Record<string, { header: string; timeGroups: Record<string, TimeGroup> }> = {};
    for (const s of slots) {
      const d = new Date(s.start_time);
      const dayKey = formatDayKey(d);
      if (!days[dayKey]) {
        days[dayKey] = { header: formatDayHeader(d), timeGroups: {} };
      }
      const timeKey = `${s.start_time}|${s.end_time}`;
      if (!days[dayKey].timeGroups[timeKey]) {
        days[dayKey].timeGroups[timeKey] = {
          key: timeKey,
          startTime: s.start_time,
          endTime: s.end_time,
          slots: [],
        };
      }
      days[dayKey].timeGroups[timeKey].slots.push(s);
    }
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dayKey, day]) => ({
        key: dayKey,
        header: day.header,
        timeGroups: Object.values(day.timeGroups).sort((a, b) =>
          a.startTime.localeCompare(b.startTime)
        ),
      }));
  }, [slots]);

  const dayGroupsByKey = useMemo(() => {
    const m: Record<string, DayGroup> = {};
    for (const d of dayGroups) m[d.key] = d;
    return m;
  }, [dayGroups]);

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
  const selectedDayGroup = selectedDate ? dayGroupsByKey[selectedDate] : undefined;

  function pickDate(key: string) {
    setSelectedDate(key);
    setSelectedSingleSlot(null);
    setError(null);
    setMobileView("info");
  }

  function openGroup(group: TimeGroup) {
    setError(null);
    setFormat("text");
    if (group.slots.length === 1) {
      setSelectedSingleSlot(group.slots[0]);
    } else {
      setRouletteGroup(group);
    }
  }

  function clearSingleSlot() {
    setSelectedSingleSlot(null);
    setError(null);
  }

  function closeRoulette() {
    setRouletteGroup(null);
    setError(null);
  }

  async function confirmBooking(slotToBook: Slot) {
    setSubmitting(true);
    setError(null);

    const supabase = createBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/signup?redirect=/book");
      return;
    }

    const { data: userBookings } = await supabase
      .from("bookings")
      .select(
        "id, status, slot:time_slots!bookings_slot_id_fkey(start_time, end_time)"
      )
      .eq("user_id", auth.user.id)
      .eq("status", "upcoming");
    const newStart = new Date(slotToBook.start_time).getTime();
    const newEnd = new Date(slotToBook.end_time).getTime();
    const overlaps = (userBookings || []).some((b) => {
      const slot = Array.isArray(b.slot) ? b.slot[0] : b.slot;
      if (!slot) return false;
      const s = new Date(slot.start_time).getTime();
      const e = new Date(slot.end_time).getTime();
      return s < newEnd && e > newStart;
    });
    if (overlaps) {
      setError("你在这个时段已经有一个预约了");
      setSubmitting(false);
      return;
    }

    const { data: slotCheck } = await supabase
      .from("time_slots")
      .select("is_booked")
      .eq("id", slotToBook.id)
      .single();
    if (!slotCheck || slotCheck.is_booked) {
      setError("这个时段刚被预约了，请选择其他时段");
      setSubmitting(false);
      setSlots((prev) => prev.filter((x) => x.id !== slotToBook.id));
      return;
    }

    const { error: insertErr } = await supabase.from("bookings").insert({
      user_id: auth.user.id,
      listener_id: slotToBook.listener.id,
      slot_id: slotToBook.id,
      format,
      status: "upcoming",
    });
    if (insertErr) {
      setError("预约失败，请稍后再试");
      setSubmitting(false);
      return;
    }

    await supabase.from("time_slots").update({ is_booked: true }).eq("id", slotToBook.id);
    router.push("/me");
  }

  if (!authChecked) {
    return (
      <>
        <Nav />
        <main className="pt-20 sm:pt-24 pb-16 min-h-screen">
          <div className="text-muted text-center py-12">载入中...</div>
        </main>
      </>
    );
  }

  const monthLabel = `${viewMonth.getFullYear()} 年 ${viewMonth.getMonth() + 1} 月`;

  return (
    <>
      <Nav />
      <main className="pt-20 sm:pt-24 pb-16 min-h-screen">
        <div className="max-w-[960px] mx-auto px-5 sm:px-6">
          <h1 className="text-h2-mobile sm:text-h2 font-medium tracking-tight mb-2">选择一个时段</h1>
          <p className="text-caption text-muted mb-8">
            倾诉是 40 分钟。选好时段后，时间到了你和倾听者会进入聊天室。
          </p>

          {loading ? (
            <div className="text-muted text-center py-12">载入中...</div>
          ) : dayGroups.length === 0 ? (
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
                        const hasSlots = !!dayGroupsByKey[cell.key];
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
                    ) : selectedSingleSlot ? (
                      <InlineConfirm
                        slot={selectedSingleSlot}
                        format={format}
                        setFormat={setFormat}
                        submitting={submitting}
                        error={error}
                        onBack={clearSingleSlot}
                        onConfirm={() => confirmBooking(selectedSingleSlot)}
                        onShowReviews={() =>
                          setReviewsFor({
                            id: selectedSingleSlot.listener.id,
                            username: selectedSingleSlot.listener.username,
                          })
                        }
                      />
                    ) : (
                      <div>
                        <div className="mb-4">
                          <div className="text-[15px] font-medium">
                            {formatDayHeader(new Date(`${selectedDate}T00:00:00`))}
                          </div>
                          <div className="text-caption text-muted mt-0.5">
                            {selectedDayGroup
                              ? `${selectedDayGroup.timeGroups.length} 个可预约时段`
                              : "0 个可预约时段"}
                          </div>
                        </div>
                        {!selectedDayGroup || selectedDayGroup.timeGroups.length === 0 ? (
                          <div className="text-center text-muted py-8 text-[14px]">
                            这一天的时段刚被约满，换一天看看
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {selectedDayGroup.timeGroups.map((group) => (
                              <TimeGroupCard
                                key={group.key}
                                group={group}
                                onOpen={() => openGroup(group)}
                                onShowReviews={(l) => setReviewsFor(l)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {rouletteGroup && (
        <RouletteModal
          group={rouletteGroup}
          format={format}
          setFormat={setFormat}
          submitting={submitting}
          error={error}
          onClose={closeRoulette}
          onConfirm={(winner) => confirmBooking(winner)}
          onShowReviews={(l) => setReviewsFor(l)}
        />
      )}

      {reviewsFor && (
        <ListenerReviewsModal
          listenerId={reviewsFor.id}
          listenerUsername={reviewsFor.username}
          onClose={() => setReviewsFor(null)}
        />
      )}
    </>
  );
}

function TimeGroupCard({
  group,
  onOpen,
  onShowReviews,
}: {
  group: TimeGroup;
  onOpen: () => void;
  onShowReviews: (l: { id: string; username: string }) => void;
}) {
  const start = new Date(group.startTime);
  const end = new Date(group.endTime);
  const multi = group.slots.length > 1;

  if (!multi) {
    const slot = group.slots[0];
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className="w-full text-left p-3 border border-border rounded-lg hover:border-accent transition-colors cursor-pointer focus:outline-none focus:border-accent"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[14px] font-medium">{formatTimeRange(start, end)}</div>
            <div className="text-caption text-muted mt-0.5 flex items-center gap-2 flex-wrap">
              <span>{slot.listener.username}</span>
              <span className="text-border">·</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowReviews({ id: slot.listener.id, username: slot.listener.username });
                }}
                className="text-accent hover:underline"
              >
                查看评价
              </button>
            </div>
          </div>
          <span className="text-caption text-accent shrink-0">选择 →</span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onOpen}
      className="group relative block w-full text-left isolate transition-transform hover:-translate-y-0.5"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 translate-x-[5px] translate-y-[5px] rounded-lg border border-border bg-surface opacity-60"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 translate-x-[2.5px] translate-y-[2.5px] rounded-lg border border-border bg-surface"
      />
      <div className="relative p-3 border border-border rounded-lg bg-surface group-hover:border-accent transition-colors">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[14px] font-medium">{formatTimeRange(start, end)}</div>
            <div className="text-caption text-muted mt-0.5 inline-flex items-center gap-1.5">
              <Shuffle size={12} className="text-accent" />
              <span>{group.slots.length} 位倾听者 · 随机匹配</span>
            </div>
          </div>
          <span className="text-caption text-accent shrink-0">抽取 →</span>
        </div>
      </div>
    </button>
  );
}

function InlineConfirm({
  slot,
  format,
  setFormat,
  submitting,
  error,
  onBack,
  onConfirm,
  onShowReviews,
}: {
  slot: Slot;
  format: "text" | "voice";
  setFormat: (f: "text" | "voice") => void;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: () => void;
  onShowReviews: () => void;
}) {
  return (
    <div>
      <button
        onClick={onBack}
        className="text-[13px] text-muted hover:text-foreground mb-4 inline-flex items-center gap-1"
      >
        <ChevronLeft size={14} /> 返回时段
      </button>
      <h3 className="text-[18px] font-medium mb-5">确认预约？</h3>
      <div className="space-y-3 text-[14px] mb-6">
        <div className="flex items-start justify-between gap-4">
          <span className="text-muted shrink-0">倾听者</span>
          <div className="text-right">
            <div>{slot.listener.username}</div>
            <button
              type="button"
              onClick={onShowReviews}
              className="text-[12px] text-accent hover:underline mt-0.5"
            >
              查看评价
            </button>
          </div>
        </div>
        <Row
          label="时间"
          value={`${formatDayHeader(new Date(slot.start_time))} ${formatTimeRange(
            new Date(slot.start_time),
            new Date(slot.end_time)
          )}`}
        />
        <FormatRow format={format} setFormat={setFormat} />
      </div>
      {format === "voice" && (
        <p className="text-[13px] text-muted bg-accent-soft border-l-2 border-accent px-3 py-2 mb-5 rounded-r">
          选择&ldquo;语音&rdquo;后，倾听者会在约定时间发送腾讯会议号给你。
        </p>
      )}
      {error && <div className="text-[13px] text-danger mb-3">{error}</div>}
      <div className="flex gap-3 justify-end">
        <button onClick={onBack} disabled={submitting} className="btn-ghost">
          取消
        </button>
        <button onClick={onConfirm} disabled={submitting} className="btn-primary">
          {submitting ? "预约中..." : "确认预约"}
        </button>
      </div>
    </div>
  );
}

function RouletteModal({
  group,
  format,
  setFormat,
  submitting,
  error,
  onClose,
  onConfirm,
  onShowReviews,
}: {
  group: TimeGroup;
  format: "text" | "voice";
  setFormat: (f: "text" | "voice") => void;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (winner: Slot) => void;
  onShowReviews: (l: { id: string; username: string }) => void;
}) {
  const [spinKey, setSpinKey] = useState(0);
  const [winner, setWinner] = useState<Slot | null>(null);

  function reSpin() {
    setWinner(null);
    setSpinKey((k) => k + 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4">
      <div className="absolute inset-0 bg-black/30" onClick={() => !submitting && onClose()} />
      <div className="relative modal-card w-full max-w-[440px] rounded-b-none sm:rounded-xl pb-safe">
        <button
          onClick={() => !submitting && onClose()}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 inline-flex items-center justify-center w-10 h-10 text-muted hover:text-foreground"
          aria-label="关闭"
        >
          <X size={18} />
        </button>

        <div className="text-center mb-1 pr-8">
          <h3 className="text-[18px] font-medium">为你随机匹配一位倾听者</h3>
          <p className="text-caption text-muted mt-1.5">
            {formatDayHeader(new Date(group.startTime))} ·{" "}
            {formatTimeRange(new Date(group.startTime), new Date(group.endTime))}
          </p>
        </div>

        <div className="mt-6">
          <RouletteWheel
            key={spinKey}
            candidates={group.slots}
            onSettled={(w) => setWinner(w)}
          />
        </div>

        <div className="mt-5 text-center min-h-[24px]">
          {winner === null ? (
            <span className="text-caption text-muted">抽取中…</span>
          ) : (
            <span className="text-[14px] inline-flex items-center gap-1.5 flex-wrap justify-center">
              <Sparkles size={14} className="text-accent" />
              为你匹配到 <span className="font-medium">{winner.listener.username}</span>
              <button
                type="button"
                onClick={() =>
                  onShowReviews({ id: winner.listener.id, username: winner.listener.username })
                }
                className="text-[12px] text-accent hover:underline ml-1"
              >
                查看评价
              </button>
            </span>
          )}
        </div>

        <div
          className={`transition-opacity duration-300 ${
            winner ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="mt-5 pt-5 border-t border-border">
            <FormatRow format={format} setFormat={setFormat} />
            {format === "voice" && (
              <p className="text-[13px] text-muted bg-accent-soft border-l-2 border-accent px-3 py-2 mt-3 rounded-r">
                选择&ldquo;语音&rdquo;后，倾听者会在约定时间发送腾讯会议号给你。
              </p>
            )}
            {error && <div className="text-[13px] text-danger mt-3 text-center">{error}</div>}
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={reSpin}
                disabled={submitting}
                className="btn-ghost inline-flex items-center gap-1.5"
              >
                <Shuffle size={14} />
                再抽一次
              </button>
              <button
                onClick={() => winner && onConfirm(winner)}
                disabled={submitting || !winner}
                className="btn-primary"
              >
                {submitting ? "预约中..." : "确认预约"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const WHEEL_ITEM_H = 56;
const WHEEL_VISIBLE = 5;
const WHEEL_REPS = 14;
const WHEEL_SPIN_MS = 2800;

function RouletteWheel({
  candidates,
  onSettled,
}: {
  candidates: Slot[];
  onSettled: (winner: Slot) => void;
}) {
  const items = useMemo(() => {
    const out: Slot[] = [];
    for (let i = 0; i < WHEEL_REPS; i++) out.push(...candidates);
    return out;
  }, [candidates]);

  const [winnerIdx] = useState(() => Math.floor(Math.random() * candidates.length));
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setMoving(true));
    });
    const settle = setTimeout(() => {
      onSettled(candidates[winnerIdx]);
    }, WHEEL_SPIN_MS);
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      clearTimeout(settle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const centerOffset = Math.floor(WHEEL_VISIBLE / 2) * WHEEL_ITEM_H;
  const targetIdx = (WHEEL_REPS - 1) * candidates.length + winnerIdx;
  const finalTranslate = centerOffset - targetIdx * WHEEL_ITEM_H;
  const translateY = moving ? finalTranslate : centerOffset;

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-xl border border-border bg-background/50"
      style={{ height: WHEEL_VISIBLE * WHEEL_ITEM_H, maxWidth: 300 }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-gradient-to-b from-surface to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-14 bg-gradient-to-t from-surface to-transparent" />
      <div
        className="pointer-events-none absolute inset-x-3 z-10 rounded-md border border-accent/70 bg-accent-soft/40"
        style={{
          top: `calc(50% - ${WHEEL_ITEM_H / 2}px)`,
          height: WHEEL_ITEM_H,
        }}
      />
      <div
        className="pointer-events-none absolute left-0 z-20 h-2 w-2 -translate-y-1/2 rotate-45 border-l border-b border-accent bg-surface"
        style={{ top: "50%" }}
      />
      <div
        className="pointer-events-none absolute right-0 z-20 h-2 w-2 -translate-y-1/2 -rotate-45 border-r border-b border-accent bg-surface"
        style={{ top: "50%" }}
      />
      <div
        style={{
          transform: `translateY(${translateY}px)`,
          transition: moving
            ? `transform ${WHEEL_SPIN_MS}ms cubic-bezier(0.16, 0.84, 0.28, 1)`
            : "none",
          willChange: "transform",
        }}
      >
        {items.map((s, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-[15px] font-medium tracking-tight"
            style={{ height: WHEEL_ITEM_H }}
          >
            {s.listener.username}
          </div>
        ))}
      </div>
    </div>
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
