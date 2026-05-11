"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import Nav from "@/components/Nav";
import BookingCard, { BookingCardData } from "@/components/BookingCard";
import { createBrowserClient } from "@/lib/supabase/client";
import { formatDate, formatDayHeader, formatDayKey, formatTime, formatTimeRange } from "@/lib/format";
import { useListenerSlots, useListenerBookings } from "@/lib/hooks/useListenerData";

export type Slot = {
  id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
};

export type ReceivedReview = {
  id: string;
  comment: string;
  listener_reply: string | null;
  created_at: string;
  replied_at: string | null;
};

type SectionTab = "slots" | "bookings" | "reviews";

type Props = {
  userId: string;
  username: string;
  initialSlots: Slot[];
  initialBookings: BookingCardData[];
  initialReviews: ReceivedReview[];
};

export default function ListenerPageClient({
  userId,
  username,
  initialSlots,
  initialBookings,
  initialReviews,
}: Props) {
  const { data: slots = [], mutate: mutateSlots } = useListenerSlots(userId, initialSlots);
  const { data: bookings = [], mutate: mutateBookings } = useListenerBookings(
    userId,
    initialBookings
  );
  const [reviews, setReviews] = useState<ReceivedReview[]>(initialReviews);
  const [tab, setTab] = useState<SectionTab>("slots");
  const [showAdd, setShowAdd] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  async function reloadReviews() {
    const supabase = createBrowserClient();
    const { data } = await supabase
      .from("reviews")
      .select("id, comment, listener_reply, created_at, replied_at")
      .eq("listener_id", userId)
      .order("created_at", { ascending: false });
    setReviews((data ?? []) as ReceivedReview[]);
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  async function deleteSlot(id: string) {
    if (!confirm("确认删除这个时段？")) return;
    const supabase = createBrowserClient();
    await mutateSlots(
      async (current?: Slot[]) => {
        await supabase.from("time_slots").delete().eq("id", id);
        return current?.filter((s) => s.id !== id) ?? [];
      },
      {
        optimisticData: (current?: Slot[]) => current?.filter((s) => s.id !== id) ?? [],
        rollbackOnError: true,
        revalidate: false,
      }
    );
  }

  return (
    <>
      <Nav />
      <main className="pt-20 sm:pt-24 pb-16">
        <div className="max-w-prose mx-auto px-5 sm:px-6">
          <div className="mb-8 sm:mb-10">
            <h1 className="text-h2-mobile sm:text-h2 font-medium tracking-tight">倾听者后台</h1>
            <p className="text-caption text-muted mt-1 truncate">{username}</p>
          </div>

          <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto -mx-1 px-1">
            <TabButton active={tab === "slots"} onClick={() => setTab("slots")} label="我的时段" />
            <TabButton
              active={tab === "bookings"}
              onClick={() => setTab("bookings")}
              label="我的预约"
            />
            <TabButton
              active={tab === "reviews"}
              onClick={() => setTab("reviews")}
              label={reviews.length > 0 ? `收到的评价 · ${reviews.length}` : "收到的评价"}
            />
          </div>

          {tab === "slots" ? (
            <SlotsSection slots={slots} onAdd={() => setShowAdd(true)} onDelete={deleteSlot} />
          ) : tab === "bookings" ? (
            <BookingsSection
              bookings={bookings}
              now={now}
              onCancel={() => mutateBookings()}
            />
          ) : (
            <ReviewsSection reviews={reviews} onReplyUpdated={reloadReviews} />
          )}
        </div>
      </main>

      {showAdd && (
        <AddSlotModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            mutateSlots();
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
      className={`shrink-0 px-3 sm:px-4 py-2.5 text-[14px] -mb-px border-b-2 transition-colors ${
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
      <div className="flex justify-between items-center mb-6 gap-3">
        <p className="text-caption text-muted">未来的可用时段</p>
        <button
          onClick={onAdd}
          className="btn-primary inline-flex items-center gap-1.5 py-2 px-4 text-[14px] shrink-0"
        >
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
                    className="card flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
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
                        className="shrink-0 text-[13px] text-muted hover:text-danger transition-colors px-2 py-2 -mr-2"
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

function ReviewsSection({
  reviews,
  onReplyUpdated,
}: {
  reviews: ReceivedReview[];
  onReplyUpdated: () => void;
}) {
  if (reviews.length === 0) {
    return (
      <div className="card text-center text-muted">
        <p>还没有收到评价。</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <ReviewReplyCard key={r.id} review={r} onSaved={onReplyUpdated} />
      ))}
    </div>
  );
}

function ReviewReplyCard({
  review,
  onSaved,
}: {
  review: ReceivedReview;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [reply, setReply] = useState(review.listener_reply ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX = 1000;
  const remaining = MAX - reply.length;

  async function save() {
    const trimmed = reply.trim();
    if (!trimmed) {
      setError("回复不能为空");
      return;
    }
    if (trimmed.length > MAX) {
      setError(`回复不能超过 ${MAX} 字`);
      return;
    }
    setError(null);
    setSubmitting(true);
    const supabase = createBrowserClient();
    const { error: e } = await supabase
      .from("reviews")
      .update({ listener_reply: trimmed })
      .eq("id", review.id);
    if (e) {
      setError("保存失败，请稍后再试");
      setSubmitting(false);
      return;
    }
    setEditing(false);
    setSubmitting(false);
    onSaved();
  }

  async function remove() {
    if (!confirm("删除你的回复？")) return;
    setSubmitting(true);
    const supabase = createBrowserClient();
    const { error: e } = await supabase
      .from("reviews")
      .update({ listener_reply: null })
      .eq("id", review.id);
    if (e) {
      setError("删除失败，请稍后再试");
      setSubmitting(false);
      return;
    }
    setReply("");
    setEditing(false);
    setSubmitting(false);
    onSaved();
  }

  return (
    <div className="card">
      <div className="text-caption text-muted mb-1.5">
        {formatDate(new Date(review.created_at))}
      </div>
      <div className="text-[14px] whitespace-pre-wrap break-words mb-3">{review.comment}</div>

      {!editing && review.listener_reply && (
        <div className="bg-accent-soft border-l-2 border-accent rounded-r px-3 py-2">
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="text-caption text-muted">你的回复</span>
            <button
              onClick={() => {
                setReply(review.listener_reply ?? "");
                setEditing(true);
              }}
              className="text-[12px] text-accent hover:underline"
            >
              编辑
            </button>
          </div>
          <div className="text-[14px] whitespace-pre-wrap break-words">
            {review.listener_reply}
          </div>
        </div>
      )}

      {!editing && !review.listener_reply && (
        <button
          onClick={() => {
            setReply("");
            setEditing(true);
          }}
          className="text-[13px] text-accent hover:underline"
        >
          回复
        </button>
      )}

      {editing && (
        <div className="space-y-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={MAX}
            rows={4}
            placeholder="写下你的回复……"
            className="input resize-none"
          />
          <div className="flex justify-between items-center">
            <span className="text-caption text-muted">
              {remaining < 0 ? `超出 ${-remaining} 字` : `还可输入 ${remaining} 字`}
            </span>
          </div>
          {error && <div className="text-[13px] text-danger">{error}</div>}
          <div className="flex gap-3 justify-end">
            {review.listener_reply && (
              <button
                onClick={remove}
                disabled={submitting}
                className="text-[13px] text-muted hover:text-danger transition-colors mr-auto"
              >
                删除回复
              </button>
            )}
            <button
              onClick={() => {
                setEditing(false);
                setError(null);
                setReply(review.listener_reply ?? "");
              }}
              disabled={submitting}
              className="text-[13px] text-muted hover:text-foreground px-3 py-1.5"
            >
              取消
            </button>
            <button
              onClick={save}
              disabled={submitting}
              className="text-[13px] bg-accent text-white rounded-full px-4 py-1.5 hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      )}
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
        <h3 className="text-[18px] font-medium mb-5 pr-8">添加时段</h3>
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
