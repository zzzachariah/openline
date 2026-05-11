"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Check, X } from "lucide-react";
import Nav from "@/components/Nav";
import BookingCard, { BookingCardData } from "@/components/BookingCard";
import { createBrowserClient } from "@/lib/supabase/client";
import { useUserBookings } from "@/lib/hooks/useUserBookings";
import { formatDate } from "@/lib/format";

type Tab = "upcoming" | "completed" | "cancelled";

export type BookingWithListener = BookingCardData & { listenerId: string };

export type MyReview = {
  id: string;
  booking_id: string;
  comment: string;
  listener_reply: string | null;
  created_at: string;
  replied_at: string | null;
};

type Props = {
  userId: string;
  username: string;
  initialBookings: BookingWithListener[];
  initialReviews: MyReview[];
};

export default function MePageClient({
  userId,
  username,
  initialBookings,
  initialReviews,
}: Props) {
  const router = useRouter();
  const initialAsCardData: BookingCardData[] = initialBookings.map((b) => ({
    ...b,
    counterpartyId: b.listenerId,
  }));
  const { data: bookings = [], mutate } = useUserBookings(userId, initialAsCardData);

  const [reviews, setReviews] = useState<MyReview[]>(initialReviews);
  const reviewByBookingId: Record<string, MyReview> = {};
  for (const r of reviews) reviewByBookingId[r.booking_id] = r;

  const [editing, setEditing] = useState<{
    bookingId: string;
    listenerId: string;
    listenerName: string;
    existing?: MyReview;
  } | null>(null);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  async function reloadReviews() {
    const supabase = createBrowserClient();
    const { data } = await supabase
      .from("reviews")
      .select("id, booking_id, comment, listener_reply, created_at, replied_at")
      .eq("user_id", userId);
    setReviews((data ?? []) as MyReview[]);
  }

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
      <main className="pt-20 sm:pt-24 pb-16">
        <div className="max-w-prose mx-auto px-5 sm:px-6">
          <div className="mb-10 sm:mb-12">
            <h1 className="text-h2-mobile sm:text-h2 font-medium tracking-tight mb-3">
              你好，{username}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={copyUsername}
                className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-accent transition-colors px-2.5 py-1.5 rounded-md border border-border"
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
              <p className="text-caption text-muted">换设备登录时需要它</p>
            </div>
          </div>

          <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto -mx-1 px-1">
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
                className={`shrink-0 px-3 sm:px-4 py-2.5 text-[14px] -mb-px border-b-2 transition-colors ${
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
                <div key={b.id} className="space-y-2">
                  <BookingCard
                    booking={b}
                    now={now}
                    role="user"
                    onCancel={() => cancelBooking(b.id)}
                  />
                  {b.status === "completed" && b.counterpartyId && (
                    <ReviewBlock
                      review={reviewByBookingId[b.id]}
                      onWrite={() =>
                        setEditing({
                          bookingId: b.id,
                          listenerId: b.counterpartyId!,
                          listenerName: b.counterpartyUsername,
                          existing: reviewByBookingId[b.id],
                        })
                      }
                    />
                  )}
                </div>
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

      {editing && (
        <WriteReviewModal
          bookingId={editing.bookingId}
          listenerId={editing.listenerId}
          listenerName={editing.listenerName}
          existing={editing.existing}
          userId={userId}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await reloadReviews();
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function ReviewBlock({
  review,
  onWrite,
}: {
  review: MyReview | undefined;
  onWrite: () => void;
}) {
  if (!review) {
    return (
      <div className="ml-3 sm:ml-6 -mt-1 flex items-center gap-3 text-[13px]">
        <span className="text-muted">还没写评价</span>
        <button onClick={onWrite} className="text-accent hover:underline">
          写评价
        </button>
      </div>
    );
  }
  return (
    <div className="ml-3 sm:ml-6 -mt-1 border-l-2 border-accent-soft pl-4 py-2">
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-caption text-muted">
          我的评价 · {formatDate(new Date(review.created_at))}
        </span>
        <button onClick={onWrite} className="text-[12px] text-accent hover:underline">
          编辑
        </button>
      </div>
      <div className="text-[14px] whitespace-pre-wrap break-words">{review.comment}</div>
      {review.listener_reply && (
        <div className="mt-2.5 bg-accent-soft border-l-2 border-accent rounded-r px-3 py-2">
          <div className="text-caption text-muted mb-1">倾听者回复</div>
          <div className="text-[14px] whitespace-pre-wrap break-words">
            {review.listener_reply}
          </div>
        </div>
      )}
    </div>
  );
}

function WriteReviewModal({
  bookingId,
  listenerId,
  listenerName,
  existing,
  userId,
  onClose,
  onSaved,
}: {
  bookingId: string;
  listenerId: string;
  listenerName: string;
  existing: MyReview | undefined;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX = 1000;
  const remaining = MAX - comment.length;

  async function submit() {
    const trimmed = comment.trim();
    if (!trimmed) {
      setError("评价内容不能为空");
      return;
    }
    if (trimmed.length > MAX) {
      setError(`评价不能超过 ${MAX} 字`);
      return;
    }
    setError(null);
    setSubmitting(true);
    const supabase = createBrowserClient();
    if (existing) {
      const { error: e } = await supabase
        .from("reviews")
        .update({ comment: trimmed })
        .eq("id", existing.id);
      if (e) {
        setError("保存失败，请稍后再试");
        setSubmitting(false);
        return;
      }
    } else {
      const { error: e } = await supabase.from("reviews").insert({
        booking_id: bookingId,
        user_id: userId,
        listener_id: listenerId,
        comment: trimmed,
      });
      if (e) {
        setError("提交失败，请稍后再试");
        setSubmitting(false);
        return;
      }
    }
    onSaved();
  }

  async function remove() {
    if (!existing) return;
    if (!confirm("确认删除这条评价？倾听者的回复也会一并删除。")) return;
    setDeleting(true);
    const supabase = createBrowserClient();
    const { error: e } = await supabase.from("reviews").delete().eq("id", existing.id);
    if (e) {
      setError("删除失败，请稍后再试");
      setDeleting(false);
      return;
    }
    onSaved();
  }

  const busy = submitting || deleting;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4">
      <div className="absolute inset-0 bg-black/30" onClick={() => !busy && onClose()} />
      <div className="relative modal-card w-full max-w-[480px] rounded-b-none sm:rounded-xl pb-safe">
        <button
          onClick={() => !busy && onClose()}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 inline-flex items-center justify-center w-10 h-10 text-muted hover:text-foreground"
          aria-label="关闭"
        >
          <X size={18} />
        </button>
        <h3 className="text-[18px] font-medium mb-1 pr-8">{existing ? "编辑评价" : "写评价"}</h3>
        <p className="text-caption text-muted mb-4">给 {listenerName}</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={MAX}
          rows={6}
          placeholder="写下你的感受……"
          className="input resize-none"
        />
        <div className="flex justify-between items-center mt-1.5">
          <span className="text-caption text-muted">
            {remaining < 0 ? `超出 ${-remaining} 字` : `还可输入 ${remaining} 字`}
          </span>
        </div>
        {error && <div className="text-[13px] text-danger mt-3">{error}</div>}
        <div className="flex gap-3 justify-end mt-6">
          {existing && (
            <button
              onClick={remove}
              disabled={busy}
              className="text-[13px] text-muted hover:text-danger transition-colors mr-auto"
            >
              {deleting ? "删除中..." : "删除评价"}
            </button>
          )}
          <button onClick={onClose} disabled={busy} className="btn-ghost">
            取消
          </button>
          <button onClick={submit} disabled={busy} className="btn-primary">
            {submitting ? "保存中..." : existing ? "保存" : "提交"}
          </button>
        </div>
      </div>
    </div>
  );
}
