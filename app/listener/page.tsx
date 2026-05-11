import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { BookingCardData } from "@/components/BookingCard";
import ListenerPageClient, { type Slot } from "./ListenerPageClient";

type RawBooking = {
  id: string;
  format: "text" | "voice";
  status: "upcoming" | "completed" | "cancelled";
  is_saved: boolean | null;
  user: { username: string } | { username: string }[];
  slot: { start_time: string; end_time: string } | { start_time: string; end_time: string }[];
};

export const dynamic = "force-dynamic";

export default async function ListenerPage() {
  const supabase = createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect("/login?redirect=/listener");
  }

  const userId = auth.user.id;
  const nowIso = new Date().toISOString();

  const [{ data: profile }, { data: slotRows }, { data: bookingRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, is_listener, listener_application_at")
      .eq("id", userId)
      .single(),
    supabase
      .from("time_slots")
      .select("id, start_time, end_time, is_booked")
      .eq("listener_id", userId)
      .gte("end_time", nowIso)
      .order("start_time", { ascending: true }),
    supabase
      .from("bookings")
      .select(
        "id, format, status, is_saved, user:profiles!bookings_user_id_fkey(username), slot:time_slots!bookings_slot_id_fkey(start_time, end_time)"
      )
      .eq("listener_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (!profile?.is_listener) {
    if (profile?.listener_application_at) {
      redirect("/listener/pending");
    }
    redirect("/me");
  }

  const slots: Slot[] = (slotRows ?? []) as Slot[];
  const bookings: BookingCardData[] = ((bookingRows ?? []) as RawBooking[]).map((r) => {
    const user = Array.isArray(r.user) ? r.user[0] : r.user;
    const slot = Array.isArray(r.slot) ? r.slot[0] : r.slot;
    return {
      id: r.id,
      format: r.format,
      status: r.status,
      counterpartyUsername: user.username,
      startTime: slot.start_time,
      endTime: slot.end_time,
      isSaved: !!r.is_saved,
    };
  });

  return (
    <ListenerPageClient
      userId={userId}
      username={profile.username}
      initialSlots={slots}
      initialBookings={bookings}
    />
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

    // Pre-check: this listener cannot have a slot that overlaps an existing one.
    // The DB also enforces this via an exclusion constraint, so this is just to
    // surface a friendlier error before round-tripping.
    const { data: overlapping } = await supabase
      .from("time_slots")
      .select("id")
      .eq("listener_id", auth.user.id)
      .lt("start_time", end.toISOString())
      .gt("end_time", start.toISOString())
      .limit(1);
    if (overlapping && overlapping.length > 0) {
      setError("这个时段和你已有的时段重叠了");
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
      // 23P01 = exclusion_violation (overlap caught by the DB constraint)
      if (insertErr.code === "23P01") {
        setError("这个时段和你已有的时段重叠了");
      } else {
        setError("创建失败，请稍后再试");
      }
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
