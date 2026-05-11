"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, Sparkles, X } from "lucide-react";
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

export default function BookPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  // Single-listener flow: jump straight to confirmation.
  const [selected, setSelected] = useState<Slot | null>(null);
  // Multi-listener flow: roulette pick first, then confirm.
  const [rouletteGroup, setRouletteGroup] = useState<TimeGroup | null>(null);
  const [reviewsFor, setReviewsFor] = useState<{ id: string; username: string } | null>(null);
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

  const grouped = useMemo<DayGroup[]>(() => {
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

  function openGroup(group: TimeGroup) {
    setError(null);
    setFormat("text");
    if (group.slots.length === 1) {
      setSelected(group.slots[0]);
    } else {
      setRouletteGroup(group);
    }
  }

  function closeAll() {
    setSelected(null);
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

    // Don't let the same user hold two upcoming bookings whose time windows
    // overlap — they can only be in one room at a time.
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
          ) : grouped.length === 0 ? (
            <div className="card text-center text-muted">
              <p>暂时没有可预约的时段。请稍后再来看看。</p>
            </div>
          ) : (
            <div className="space-y-10">
              {grouped.map((day) => (
                <div key={day.key}>
                  <h2 className="text-[14px] text-muted mb-3 px-1">{day.header}</h2>
                  <div className="space-y-4">
                    {day.timeGroups.map((group) => (
                      <TimeGroupCard
                        key={group.key}
                        group={group}
                        onOpen={() => openGroup(group)}
                        onShowReviews={(l) => setReviewsFor(l)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {selected && (
        <ConfirmModal
          slot={selected}
          format={format}
          setFormat={setFormat}
          submitting={submitting}
          error={error}
          onClose={closeAll}
          onConfirm={() => confirmBooking(selected)}
          onShowReviews={() =>
            setReviewsFor({ id: selected.listener.id, username: selected.listener.username })
          }
        />
      )}

      {rouletteGroup && (
        <RouletteModal
          group={rouletteGroup}
          format={format}
          setFormat={setFormat}
          submitting={submitting}
          error={error}
          onClose={closeAll}
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
        className="w-full text-left card hover:border-accent transition-colors cursor-pointer focus:outline-none focus:border-accent"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[15px] font-medium">{formatTimeRange(start, end)}</div>
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
          <span className="text-caption text-accent shrink-0">预约 →</span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onOpen}
      className="group relative block w-full text-left isolate transition-transform hover:-translate-y-0.5"
    >
      {/* Stack hints peeking out from behind */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 translate-x-[6px] translate-y-[6px] rounded-xl border border-border bg-surface opacity-60"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 translate-x-[3px] translate-y-[3px] rounded-xl border border-border bg-surface"
      />
      <div className="relative card group-hover:border-accent transition-colors">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[15px] font-medium">{formatTimeRange(start, end)}</div>
            <div className="text-caption text-muted mt-0.5 inline-flex items-center gap-1.5">
              <Shuffle size={12} className="text-accent" />
              <span>
                {group.slots.length} 位倾听者 · 随机匹配
              </span>
            </div>
          </div>
          <span className="text-caption text-accent shrink-0">抽取 →</span>
        </div>
      </div>
    </button>
  );
}

function ConfirmModal({
  slot,
  format,
  setFormat,
  submitting,
  error,
  onClose,
  onConfirm,
  onShowReviews,
}: {
  slot: Slot;
  format: "text" | "voice";
  setFormat: (f: "text" | "voice") => void;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onShowReviews: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30" onClick={() => !submitting && onClose()} />
      <div className="relative bg-surface border border-border rounded-xl p-7 w-full max-w-[440px]">
        <button
          onClick={() => !submitting && onClose()}
          className="absolute top-4 right-4 text-muted hover:text-foreground"
          aria-label="关闭"
        >
          <X size={18} />
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
          <button onClick={onClose} disabled={submitting} className="btn-ghost">
            取消
          </button>
          <button onClick={onConfirm} disabled={submitting} className="btn-primary">
            {submitting ? "预约中..." : "确认预约"}
          </button>
        </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30" onClick={() => !submitting && onClose()} />
      <div className="relative bg-surface border border-border rounded-xl p-7 w-full max-w-[440px]">
        <button
          onClick={() => !submitting && onClose()}
          className="absolute top-4 right-4 text-muted hover:text-foreground"
          aria-label="关闭"
        >
          <X size={18} />
        </button>

        <div className="text-center mb-1">
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

  // Pick the winner once per mount. The parent forces a remount via `key`
  // when the user re-spins, which resets this state.
  const [winnerIdx] = useState(() => Math.floor(Math.random() * candidates.length));
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    // Start at the initial position, then on the next frame flip `moving` to
    // engage the CSS transition into the final position.
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
      {/* Top and bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-gradient-to-b from-surface to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-14 bg-gradient-to-t from-surface to-transparent" />
      {/* Center highlight band */}
      <div
        className="pointer-events-none absolute inset-x-3 z-10 rounded-md border border-accent/70 bg-accent-soft/40"
        style={{
          top: `calc(50% - ${WHEEL_ITEM_H / 2}px)`,
          height: WHEEL_ITEM_H,
        }}
      />
      {/* Tick marks on the sides */}
      <div
        className="pointer-events-none absolute left-0 z-20 h-2 w-2 -translate-y-1/2 rotate-45 border-l border-b border-accent bg-surface"
        style={{ top: "50%" }}
      />
      <div
        className="pointer-events-none absolute right-0 z-20 h-2 w-2 -translate-y-1/2 -rotate-45 border-r border-b border-accent bg-surface"
        style={{ top: "50%" }}
      />
      {/* The reel */}
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
