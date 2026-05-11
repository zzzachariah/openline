"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, CalendarDays, CalendarRange } from "lucide-react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import BookingCard, { BookingCardData } from "@/components/BookingCard";
import MonthCalendar, { DayMeta } from "@/components/Calendar/MonthCalendar";
import WeekCalendar, { WeekSlot } from "@/components/Calendar/WeekCalendar";
import { createBrowserClient } from "@/lib/supabase/client";
import { formatTime, formatTimeRange } from "@/lib/format";
import { dayKey, isSameDay, startOfDay } from "@/lib/calendar";

type Slot = {
  id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
};

type RawBooking = {
  id: string;
  format: "text" | "voice";
  status: "upcoming" | "completed" | "cancelled";
  user: { username: string } | { username: string }[] | null;
  slot:
    | { start_time: string; end_time: string }
    | { start_time: string; end_time: string }[]
    | null;
};

type SectionTab = "calendar" | "bookings";
type CalendarView = "month" | "week";

function describeError(err: unknown): string {
  if (err instanceof TimeoutError) return err.message;
  if (err instanceof Error) return err.message;
  return "未知错误";
}

export default function ListenerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<BookingCardData[]>([]);
  const [tab, setTab] = useState<SectionTab>("calendar");
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [prefill, setPrefill] = useState<Date | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const supabase = createBrowserClient();

      const authRes = await withTimeout(
        supabase.auth.getUser(),
        QUERY_TIMEOUT_MS,
        "获取登录状态超时，请检查网络后重试"
      );
      if (authRes.error || !authRes.data.user) {
        router.push("/login?redirect=/listener");
        return;
      }
      const userId = authRes.data.user.id;

      const profileRes = await withTimeout(
        supabase
          .from("profiles")
          .select("username, is_listener, listener_application_at")
          .eq("id", userId)
          .single(),
        QUERY_TIMEOUT_MS,
        "读取账号信息超时，请检查网络后重试"
      );
      if (profileRes.error) {
        throw new Error(`读取账号信息失败：${profileRes.error.message}`);
      }
      const profile = profileRes.data;
      if (!profile?.is_listener) {
        if (profile?.listener_application_at) {
          router.push("/listener/pending");
        } else {
          router.push("/me");
        }
        return;
      }
      setUsername(profile.username);

      const nowIso = new Date().toISOString();
      const slotsRes = await withTimeout(
        supabase
          .from("time_slots")
          .select("id, start_time, end_time, is_booked")
          .eq("listener_id", userId)
          .gte("end_time", nowIso)
          .order("start_time", { ascending: true }),
        QUERY_TIMEOUT_MS,
        "读取时段超时，请检查网络后重试"
      );
      if (slotsRes.error) {
        throw new Error(`读取时段失败：${slotsRes.error.message}`);
      }
      setSlots(slotsRes.data ?? []);

      const bookingsRes = await withTimeout(
        supabase
          .from("bookings")
          .select(
            "id, format, status, user:profiles!bookings_user_id_fkey(username), slot:time_slots!bookings_slot_id_fkey(start_time, end_time)"
          )
          .eq("listener_id", userId)
          .order("created_at", { ascending: false }),
        QUERY_TIMEOUT_MS,
        "读取预约超时，请检查网络后重试"
      );
      if (bookingsRes.error) {
        throw new Error(`读取预约失败：${bookingsRes.error.message}`);
      }
      const mapped: BookingCardData[] = (bookingsRes.data as RawBooking[] | null ?? [])
        .map((r) => {
          const user = Array.isArray(r.user) ? r.user[0] : r.user;
          const slot = Array.isArray(r.slot) ? r.slot[0] : r.slot;
          if (!slot) return null;
          return {
            id: r.id,
            format: r.format,
            status: r.status,
            counterpartyUsername: user?.username ?? "匿名",
            startTime: slot.start_time,
            endTime: slot.end_time,
          };
        })
        .filter((b): b is BookingCardData => b !== null);
      setBookings(mapped);
    } catch (err) {
      console.error("listener dashboard load failed", err);
      setLoadError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function deleteSlot(id: string) {
    if (!confirm("确认删除这个时段？")) return;
    const supabase = createBrowserClient();
    await supabase.from("time_slots").delete().eq("id", id);
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  // Aggregate slot meta per day for month view
  const monthMeta = useMemo<Record<string, DayMeta>>(() => {
    const map: Record<string, DayMeta> = {};
    for (const s of slots) {
      const k = dayKey(new Date(s.start_time));
      if (!map[k]) map[k] = { count: 0, bookedCount: 0 };
      map[k].count += 1;
      if (s.is_booked) map[k].bookedCount! += 1;
    }
    return map;
  }, [slots]);

  // For week view, transform slots into WeekSlot[]
  const weekSlots = useMemo<WeekSlot[]>(
    () =>
      slots.map((s) => ({
        id: s.id,
        start: new Date(s.start_time),
        end: new Date(s.end_time),
        isBooked: s.is_booked,
      })),
    [slots]
  );

  // Slots for the currently selected day (used by month view "下方时段列表")
  const slotsForSelectedDay = useMemo(
    () =>
      slots
        .map((s) => ({ ...s, _start: new Date(s.start_time) }))
        .filter((s) => isSameDay(s._start, selectedDate)),
    [slots, selectedDate]
  );

  function openAddAt(d: Date) {
    setPrefill(d);
    setShowAdd(true);
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
            <h1 className="text-h2 font-medium tracking-tight">倾听者后台</h1>
            <p className="text-caption text-muted mt-1">{username}</p>
          </motion.div>

          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <div className="flex gap-1 border-b border-border">
              <TabButton
                active={tab === "calendar"}
                onClick={() => setTab("calendar")}
                label="时段日历"
              />
              <TabButton
                active={tab === "bookings"}
                onClick={() => setTab("bookings")}
                label={`我的预约${bookings.length ? ` · ${bookings.length}` : ""}`}
              />
            </div>

            {tab === "calendar" && (
              <div className="flex items-center gap-2">
                <ViewToggle view={view} onChange={setView} />
                <button
                  onClick={() => {
                    setPrefill(null);
                    setShowAdd(true);
                  }}
                  className="btn-primary inline-flex items-center gap-1.5 py-2 px-4 text-[14px]"
                >
                  <Plus size={14} />
                  添加时段
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-muted text-center py-12">载入中...</div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.24, ease: [0.215, 0.61, 0.355, 1] }}
              >
                {tab === "calendar" ? (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={view}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22, ease: [0.215, 0.61, 0.355, 1] }}
                    >
                      {view === "month" ? (
                        <MonthSection
                          monthMeta={monthMeta}
                          selectedDate={selectedDate}
                          onSelect={setSelectedDate}
                          slotsForSelectedDay={slotsForSelectedDay}
                          onOpenAdd={openAddAt}
                          onDelete={deleteSlot}
                        />
                      ) : (
                        <WeekSection
                          anchor={anchor}
                          onAnchorChange={setAnchor}
                          slots={weekSlots}
                          onCreateAtHour={openAddAt}
                          onDeleteSlot={deleteSlot}
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <BookingsSection bookings={bookings} now={now} onCancel={() => reload()} />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>
      <Footer />

      <AnimatePresence>
        {showAdd && (
          <AddSlotModal
            prefill={prefill}
            onClose={() => {
              setShowAdd(false);
              setPrefill(null);
            }}
            onSuccess={() => {
              setShowAdd(false);
              setPrefill(null);
              reload();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 text-[14px] -mb-px transition-colors ${
        active ? "text-foreground" : "text-muted hover:text-foreground"
      }`}
    >
      {label}
      {active && (
        <motion.span
          layoutId="listener-tab-underline"
          className="absolute left-0 right-0 -bottom-px h-0.5 bg-accent"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
    </button>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: CalendarView;
  onChange: (v: CalendarView) => void;
}) {
  const options: { key: CalendarView; label: string; icon: React.ReactNode }[] = [
    { key: "month", label: "月", icon: <CalendarDays size={13} /> },
    { key: "week", label: "周", icon: <CalendarRange size={13} /> },
  ];
  return (
    <div className="relative flex bg-surface border border-border rounded-full p-0.5 text-[13px]">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`relative z-10 px-3 py-1 inline-flex items-center gap-1 rounded-full transition-colors ${
            view === o.key ? "text-white" : "text-muted hover:text-foreground"
          }`}
        >
          {view === o.key && (
            <motion.span
              layoutId="listener-view-pill"
              className="absolute inset-0 rounded-full bg-accent -z-10"
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            />
          )}
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MonthSection({
  monthMeta,
  selectedDate,
  onSelect,
  slotsForSelectedDay,
  onOpenAdd,
  onDelete,
}: {
  monthMeta: Record<string, DayMeta>;
  selectedDate: Date;
  onSelect: (d: Date) => void;
  slotsForSelectedDay: (Slot & { _start: Date })[];
  onOpenAdd: (d: Date) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6">
      <div className="card p-5">
        <MonthCalendar
          value={selectedDate}
          onChange={onSelect}
          meta={monthMeta}
          hoverAddable
          onHoverAdd={onOpenAdd}
        />
        <p className="mt-4 text-caption text-muted flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" /> 可预约
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-muted/60" /> 已预约
          </span>
          <span className="text-muted/70">悬停日期可快速添加</span>
        </p>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-medium">
            {selectedDate.getMonth() + 1} 月 {selectedDate.getDate()} 日
          </h3>
          <button
            onClick={() => onOpenAdd(selectedDate)}
            className="text-[13px] text-accent inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            <Plus size={12} />
            添加
          </button>
        </div>

        <AnimatePresence mode="popLayout">
          {slotsForSelectedDay.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-caption text-muted text-center py-8"
            >
              这一天还没有时段。
            </motion.div>
          ) : (
            <motion.ul
              key="list"
              className="space-y-2"
              initial="hidden"
              animate="show"
              variants={{
                show: { transition: { staggerChildren: 0.04 } },
              }}
            >
              {slotsForSelectedDay.map((s) => (
                <motion.li
                  key={s.id}
                  layout
                  variants={{
                    hidden: { opacity: 0, y: 6 },
                    show: { opacity: 1, y: 0 },
                  }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.215, 0.61, 0.355, 1] }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 bg-surface"
                >
                  <div>
                    <div className="text-[14px] font-medium tabular-nums">
                      {formatTimeRange(s._start, new Date(s.end_time))}
                    </div>
                    <div className="text-caption text-muted">
                      {s.is_booked ? "已被预约" : "可预约"}
                    </div>
                  </div>
                  {!s.is_booked && (
                    <button
                      onClick={() => onDelete(s.id)}
                      className="text-[13px] text-muted hover:text-danger transition-colors"
                    >
                      删除
                    </button>
                  )}
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function WeekSection({
  anchor,
  onAnchorChange,
  slots,
  onCreateAtHour,
  onDeleteSlot,
}: {
  anchor: Date;
  onAnchorChange: (d: Date) => void;
  slots: WeekSlot[];
  onCreateAtHour: (d: Date) => void;
  onDeleteSlot: (id: string) => void;
}) {
  return (
    <div className="card p-5">
      <WeekCalendar
        anchor={anchor}
        onAnchorChange={onAnchorChange}
        slots={slots}
        onCreateAtHour={onCreateAtHour}
        onDeleteSlot={onDeleteSlot}
      />
      <p className="mt-4 text-caption text-muted">
        悬停空白方格即可添加 40 分钟时段。绿色为可预约，灰色为已被预约。
      </p>
    </div>
  );
}

function BookingsSection({
  bookings,
  now,
  onCancel,
}: {
  bookings: BookingCardData[];
  now: number;
  onCancel: () => void;
}) {
  if (bookings.length === 0) {
    return (
      <div className="card text-center text-muted">
        <p>还没有预约。</p>
      </div>
    );
  }
  return (
    <motion.div
      className="space-y-3"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
    >
      {bookings.map((b) => (
        <motion.div
          key={b.id}
          variants={{
            hidden: { opacity: 0, y: 8 },
            show: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }}
        >
          <BookingCard booking={b} now={now} role="listener" onCancel={onCancel} />
        </motion.div>
      ))}
    </motion.div>
  );
}

function AddSlotModal({
  prefill,
  onClose,
  onSuccess,
}: {
  prefill: Date | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const initial = useMemo(() => {
    if (prefill) {
      return {
        date: `${prefill.getFullYear()}-${pad(prefill.getMonth() + 1)}-${pad(
          prefill.getDate()
        )}`,
        time: `${pad(prefill.getHours() || 20)}:${pad(prefill.getMinutes() || 0)}`,
      };
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      date: `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(
        tomorrow.getDate()
      )}`,
      time: "20:00",
    };
  }, [prefill]);

  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!date || !time) {
      setError("请填写日期和时间");
      return;
    }
    const start = new Date(`${date}T${time}:00`);
    if (isNaN(start.getTime())) {
      setError("日期或时间格式错误");
      return;
    }
    if (start.getTime() < Date.now()) {
      setError("时间必须在未来");
      return;
    }
    const end = new Date(start.getTime() + 40 * 60 * 1000);

    setSubmitting(true);
    const supabase = createBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setError("登录已过期");
      setSubmitting(false);
      return;
    }

    const { error: insertErr } = await supabase.from("time_slots").insert({
      listener_id: auth.user.id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      is_booked: false,
    });
    if (insertErr) {
      setError("创建失败，请稍后再试");
      setSubmitting(false);
      return;
    }
    onSuccess();
  }

  const start = date && time ? new Date(`${date}T${time}:00`) : null;
  const end = start && !isNaN(start.getTime()) ? new Date(start.getTime() + 40 * 60 * 1000) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={() => !submitting && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 4 }}
        transition={{ duration: 0.22, ease: [0.215, 0.61, 0.355, 1] }}
        className="relative bg-surface border border-border rounded-xl p-7 w-full max-w-[440px] shadow-lg"
      >
        <button
          onClick={() => !submitting && onClose()}
          className="absolute top-4 right-4 text-muted hover:text-foreground transition-colors"
          aria-label="关闭"
        >
          <X size={18} />
        </button>
        <h3 className="text-[18px] font-medium mb-5">添加时段</h3>
        <div className="space-y-4">
          <label className="block">
            <span className="text-caption text-muted block mb-1.5">日期</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="text-caption text-muted block mb-1.5">开始时间</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input"
            />
          </label>
          <div className="text-caption text-muted">
            时长 40 分钟{end ? `（${formatTime(start!)} — ${formatTime(end)}）` : ""}
          </div>
        </div>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[13px] text-danger mt-3"
          >
            {error}
          </motion.div>
        )}
        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} disabled={submitting} className="btn-ghost">
            取消
          </button>
          <button onClick={submit} disabled={submitting} className="btn-primary">
            {submitting ? "创建中..." : "创建时段"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
