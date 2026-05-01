"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import BookingCard, { BookingCardData } from "@/components/BookingCard";
import { createBrowserClient } from "@/lib/supabase/client";
import { formatDayHeader, formatDayKey, formatTime, formatTimeRange } from "@/lib/format";
import { TimeoutError, withTimeout } from "@/lib/with-timeout";

const QUERY_TIMEOUT_MS = 10_000;

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

type SectionTab = "slots" | "bookings";

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
  const [tab, setTab] = useState<SectionTab>("slots");
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

  return (
    <>
      <Nav />
      <main className="pt-24 pb-16 min-h-screen">
        <div className="max-w-prose mx-auto px-6">
          <div className="mb-10">
            <h1 className="text-h2 font-medium tracking-tight">倾听者后台</h1>
            <p className="text-caption text-muted mt-1">{username}</p>
          </div>

          <div className="flex gap-1 mb-6 border-b border-border">
            <TabButton active={tab === "slots"} onClick={() => setTab("slots")} label="我的时段" />
            <TabButton
              active={tab === "bookings"}
              onClick={() => setTab("bookings")}
              label="我的预约"
            />
          </div>

          {loading ? (
            <div className="text-muted text-center py-12">载入中...</div>
          ) : loadError ? (
            <div className="card text-center space-y-3">
              <p className="text-danger">{loadError}</p>
              <button onClick={() => reload()} className="btn-primary">
                重新加载
              </button>
            </div>
          ) : tab === "slots" ? (
            <SlotsSection slots={slots} onAdd={() => setShowAdd(true)} onDelete={deleteSlot} />
          ) : (
            <BookingsSection bookings={bookings} now={now} onCancel={() => reload()} />
          )}
        </div>
      </main>
      <Footer />

      {showAdd && (
        <AddSlotModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            reload();
          }}
        />
      )}
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
      className={`px-4 py-2 text-[14px] -mb-px border-b-2 transition-colors ${
        active
          ? "border-accent text-foreground"
          : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function SlotsSection({
  slots,
  onAdd,
  onDelete,
}: {
  slots: Slot[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  const grouped: Record<string, { header: string; slots: Slot[] }> = {};
  for (const s of slots) {
    const d = new Date(s.start_time);
    const key = formatDayKey(d);
    if (!grouped[key]) grouped[key] = { header: formatDayHeader(d), slots: [] };
    grouped[key].slots.push(s);
  }
  const groups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <p className="text-caption text-muted">未来的可用时段</p>
        <button onClick={onAdd} className="btn-primary inline-flex items-center gap-1.5 py-2 px-4 text-[14px]">
          <Plus size={14} />
          添加时段
        </button>
      </div>
      {groups.length === 0 ? (
        <div className="card text-center text-muted">
          <p>还没有时段。点击&ldquo;添加时段&rdquo;开始。</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(([key, group]) => (
            <div key={key}>
              <h2 className="text-[14px] text-muted mb-3 px-1">{group.header}</h2>
              <div className="space-y-2">
                {group.slots.map((s) => (
                  <div
                    key={s.id}
                    className="card flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-[15px] font-medium">
                        {formatTimeRange(new Date(s.start_time), new Date(s.end_time))}
                      </div>
                      <div className="text-caption text-muted mt-0.5">
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
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
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
    <div className="space-y-3">
      {bookings.map((b) => (
        <BookingCard key={b.id} booking={b} now={now} role="listener" onCancel={onCancel} />
      ))}
    </div>
  );
}

function AddSlotModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("20:00");
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
        {error && <div className="text-[13px] text-danger mt-3">{error}</div>}
        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} disabled={submitting} className="btn-ghost">
            取消
          </button>
          <button onClick={submit} disabled={submitting} className="btn-primary">
            {submitting ? "创建中..." : "创建时段"}
          </button>
        </div>
      </div>
    </div>
  );
}
