"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarCheck, Clock, MessageSquare, Mic, User2 } from "lucide-react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import MonthCalendar, { DayMeta } from "@/components/Calendar/MonthCalendar";
import { createBrowserClient } from "@/lib/supabase/client";
import { formatDayHeader, formatTimeRange } from "@/lib/format";
import { dayKey, isSameDay, startOfDay } from "@/lib/calendar";

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
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
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
        // Pre-select the first day with availability
        if (mapped.length > 0) {
          const first = startOfDay(new Date(mapped[0].start_time));
          setSelectedDate(first);
        }
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const meta = useMemo<Record<string, DayMeta>>(() => {
    const map: Record<string, DayMeta> = {};
    for (const s of slots) {
      const k = dayKey(new Date(s.start_time));
      if (!map[k]) map[k] = { count: 0 };
      map[k].count += 1;
    }
    return map;
  }, [slots]);

  const slotsForSelectedDay = useMemo(
    () =>
      slots.filter((s) => isSameDay(new Date(s.start_time), selectedDate)),
    [slots, selectedDate]
  );

  function pickSlot(s: Slot) {
    setSelected(s);
    setFormat("text");
    setError(null);
  }

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
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.215, 0.61, 0.355, 1] }}
            className="mb-10"
          >
            <h1 className="text-h2 font-medium tracking-tight mb-2">选择一个时段</h1>
            <p className="text-caption text-muted">
              倾诉是 40 分钟。选好时段后，时间到了你和倾听者会进入聊天室。
            </p>
          </motion.div>

          {loading ? (
            <div className="text-muted text-center py-12">载入中...</div>
          ) : slots.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32 }}
              className="card text-center text-muted"
            >
              <p>暂时没有可预约的时段。请稍后再来看看。</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr] gap-6">
              {/* Left: month calendar */}
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: [0.215, 0.61, 0.355, 1] }}
                className="card p-5 md:sticky md:top-24 md:self-start"
              >
                <MonthCalendar
                  value={selectedDate}
                  onChange={(d) => {
                    setSelectedDate(d);
                    setSelected(null);
                  }}
                  meta={meta}
                  onlyHighlightedSelectable
                />
                <p className="mt-4 text-caption text-muted flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  绿点的日期有可预约时段
                </p>
              </motion.section>

              {/* Right: slots + confirmation */}
              <div className="flex flex-col gap-6">
                <SlotsPanel
                  date={selectedDate}
                  slots={slotsForSelectedDay}
                  selectedId={selected?.id || null}
                  onPick={pickSlot}
                />

                <AnimatePresence mode="wait">
                  {selected ? (
                    <ConfirmationPanel
                      key="confirm"
                      slot={selected}
                      format={format}
                      onFormatChange={setFormat}
                      submitting={submitting}
                      error={error}
                      onConfirm={confirmBooking}
                      onCancel={() => setSelected(null)}
                    />
                  ) : (
                    <motion.section
                      key="placeholder"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.22, ease: [0.215, 0.61, 0.355, 1] }}
                      className="card p-6 text-center text-caption text-muted"
                    >
                      <CalendarCheck
                        size={20}
                        className="mx-auto mb-2 text-muted/60"
                        strokeWidth={1.5}
                      />
                      选择时段后，将在此处确认预约信息。
                    </motion.section>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function SlotsPanel({
  date,
  slots,
  selectedId,
  onPick,
}: {
  date: Date;
  slots: Slot[];
  selectedId: string | null;
  onPick: (s: Slot) => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.215, 0.61, 0.355, 1], delay: 0.05 }}
      className="card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-medium tracking-tight">{formatDayHeader(date)}</h3>
        <span className="text-caption text-muted tabular-nums">
          {slots.length > 0 ? `${slots.length} 个时段` : "无可约"}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {slots.length === 0 ? (
          <motion.div
            key={`empty-${dayKey(date)}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="text-caption text-muted text-center py-8"
          >
            这一天没有可预约的时段，请选其他日期。
          </motion.div>
        ) : (
          <motion.ul
            key={`list-${dayKey(date)}`}
            className="space-y-2"
            initial="hidden"
            animate="show"
            exit="hidden"
            variants={{
              hidden: { transition: { staggerChildren: 0.02 } },
              show: { transition: { staggerChildren: 0.04 } },
            }}
          >
            {slots.map((s) => {
              const start = new Date(s.start_time);
              const end = new Date(s.end_time);
              const isPicked = s.id === selectedId;
              return (
                <motion.li
                  key={s.id}
                  layout
                  variants={{
                    hidden: { opacity: 0, y: 6 },
                    show: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.2, ease: [0.215, 0.61, 0.355, 1] }}
                >
                  <motion.button
                    type="button"
                    onClick={() => onPick(s)}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                      isPicked
                        ? "border-accent bg-accent-soft"
                        : "border-border bg-surface hover:border-accent/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[15px] font-medium tabular-nums">
                          {formatTimeRange(start, end)}
                        </div>
                        <div className="text-caption text-muted mt-0.5 inline-flex items-center gap-1">
                          <User2 size={11} />
                          {s.listener.username}
                        </div>
                      </div>
                      <span
                        className={`text-caption transition-opacity ${
                          isPicked
                            ? "text-accent opacity-100"
                            : "text-accent opacity-70"
                        }`}
                      >
                        {isPicked ? "已选 ✓" : "选择 →"}
                      </span>
                    </div>
                  </motion.button>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function ConfirmationPanel({
  slot,
  format,
  onFormatChange,
  submitting,
  error,
  onConfirm,
  onCancel,
}: {
  slot: Slot;
  format: "text" | "voice";
  onFormatChange: (f: "text" | "voice") => void;
  submitting: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const start = new Date(slot.start_time);
  const end = new Date(slot.end_time);

  return (
    <motion.section
      key={slot.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.28, ease: [0.215, 0.61, 0.355, 1] }}
      className="card p-5"
    >
      <h3 className="text-[15px] font-medium tracking-tight mb-4 flex items-center gap-2">
        <CalendarCheck size={16} className="text-accent" strokeWidth={2} />
        确认预约
      </h3>

      <div className="space-y-2.5 mb-5">
        <InfoRow icon={<User2 size={14} />} label="倾听者" value={slot.listener.username} />
        <InfoRow
          icon={<Clock size={14} />}
          label="时间"
          value={`${formatDayHeader(start)} · ${formatTimeRange(start, end)}`}
        />
      </div>

      <div className="mb-5">
        <span className="text-caption text-muted block mb-2">形式</span>
        <div className="grid grid-cols-2 gap-2">
          <FormatTile
            icon={<MessageSquare size={14} />}
            label="文字聊天"
            sub="在网页内对话"
            selected={format === "text"}
            onClick={() => onFormatChange("text")}
          />
          <FormatTile
            icon={<Mic size={14} />}
            label="语音"
            sub="腾讯会议"
            selected={format === "voice"}
            onClick={() => onFormatChange("voice")}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {format === "voice" && (
          <motion.p
            key="voice-note"
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.22, ease: [0.215, 0.61, 0.355, 1] }}
            className="overflow-hidden text-[13px] text-muted bg-accent-soft border-l-2 border-accent px-3 py-2 rounded-r"
          >
            选择&ldquo;语音&rdquo;后，倾听者会在约定时间发送腾讯会议号给你。
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-[13px] text-danger mb-3"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} disabled={submitting} className="btn-ghost">
          取消
        </button>
        <button onClick={onConfirm} disabled={submitting} className="btn-primary">
          {submitting ? "预约中..." : "确认预约"}
        </button>
      </div>
    </motion.section>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 text-[14px]">
      <span className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent-soft text-accent">
        {icon}
      </span>
      <div className="flex-1 flex items-baseline justify-between gap-3">
        <span className="text-muted">{label}</span>
        <span className="text-right">{value}</span>
      </div>
    </div>
  );
}

function FormatTile({
  icon,
  label,
  sub,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={`relative rounded-lg border px-3 py-3 text-left transition-colors ${
        selected
          ? "border-accent bg-accent-soft"
          : "border-border bg-surface hover:border-accent/60"
      }`}
    >
      <div
        className={`flex items-center gap-1.5 text-[13px] font-medium ${
          selected ? "text-accent" : "text-foreground"
        }`}
      >
        {icon}
        {label}
      </div>
      <div className="text-caption text-muted mt-0.5">{sub}</div>
      {selected && (
        <motion.span
          layoutId="format-tile-check"
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
    </motion.button>
  );
}
