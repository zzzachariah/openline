"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export type Review = {
  id: string;
  booking_id: string;
  user_id: string;
  listener_id: string;
  content: string;
  is_public: boolean;
  reply: string | null;
  created_at: string;
  replied_at: string | null;
};

type Props = {
  bookingId: string;
  userId: string;
  listenerId: string;
  role: "user" | "listener";
  initialReview: Review | null;
  onReviewChange?: (r: Review | null) => void;
};

export default function ReviewPanel({
  bookingId,
  userId,
  listenerId,
  role,
  initialReview,
  onReviewChange,
}: Props) {
  const [review, setReview] = useState<Review | null>(initialReview);
  const [mode, setMode] = useState<"view" | "edit-review" | "edit-reply">("view");

  function update(r: Review | null) {
    setReview(r);
    onReviewChange?.(r);
  }

  if (role === "user") {
    if (!review || mode === "edit-review") {
      return (
        <ReviewForm
          bookingId={bookingId}
          userId={userId}
          listenerId={listenerId}
          existing={review}
          onCancel={review ? () => setMode("view") : undefined}
          onSaved={(r) => {
            update(r);
            setMode("view");
          }}
        />
      );
    }
    return (
      <ReviewDisplay
        review={review}
        canEditReview
        onEditReview={() => setMode("edit-review")}
      />
    );
  }

  // listener role
  if (!review) {
    return (
      <div className="ml-3 border-l-2 border-border pl-4 py-2 text-caption text-muted">
        用户还没有填写评价。
      </div>
    );
  }
  if (mode === "edit-reply" || !review.reply) {
    return (
      <ReviewDisplay
        review={review}
        replyForm={
          <ReplyForm
            reviewId={review.id}
            existing={review.reply}
            onCancel={review.reply ? () => setMode("view") : undefined}
            onSaved={(r) => {
              update(r);
              setMode("view");
            }}
          />
        }
      />
    );
  }
  return (
    <ReviewDisplay
      review={review}
      canEditReply
      onEditReply={() => setMode("edit-reply")}
    />
  );
}

function ReviewDisplay({
  review,
  canEditReview,
  canEditReply,
  onEditReview,
  onEditReply,
  replyForm,
}: {
  review: Review;
  canEditReview?: boolean;
  canEditReply?: boolean;
  onEditReview?: () => void;
  onEditReply?: () => void;
  replyForm?: React.ReactNode;
}) {
  return (
    <div className="ml-3 border-l-2 border-border pl-4 py-1 space-y-3">
      <div>
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="text-caption text-muted">
            评价{review.is_public ? "（公开）" : "（私密）"}
          </span>
          {canEditReview && (
            <button
              onClick={onEditReview}
              className="text-[12px] text-muted hover:text-accent transition-colors"
            >
              编辑
            </button>
          )}
        </div>
        <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
          {review.content}
        </p>
      </div>
      {review.reply ? (
        <div>
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="text-caption text-accent">倾听者回复</span>
            {canEditReply && (
              <button
                onClick={onEditReply}
                className="text-[12px] text-muted hover:text-accent transition-colors"
              >
                编辑
              </button>
            )}
          </div>
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
            {review.reply}
          </p>
        </div>
      ) : (
        replyForm
      )}
    </div>
  );
}

function ReviewForm({
  bookingId,
  userId,
  listenerId,
  existing,
  onSaved,
  onCancel,
}: {
  bookingId: string;
  userId: string;
  listenerId: string;
  existing: Review | null;
  onSaved: (r: Review) => void;
  onCancel?: () => void;
}) {
  const [open, setOpen] = useState(existing !== null);
  const [content, setContent] = useState(existing?.content || "");
  const [isPublic, setIsPublic] = useState(existing?.is_public ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="ml-3 border-l-2 border-border pl-4 py-2">
        <button onClick={() => setOpen(true)} className="text-[13px] text-accent hover:opacity-80">
          写评价
        </button>
      </div>
    );
  }

  async function submit() {
    const trimmed = content.trim();
    if (!trimmed) {
      setError("评价不能为空");
      return;
    }
    if (trimmed.length > 1000) {
      setError("评价过长（最多 1000 字）");
      return;
    }
    setSubmitting(true);
    setError(null);
    const supabase = createBrowserClient();
    if (existing) {
      const { data, error: e } = await supabase
        .from("reviews")
        .update({ content: trimmed, is_public: isPublic })
        .eq("id", existing.id)
        .select()
        .single();
      setSubmitting(false);
      if (e || !data) {
        setError("保存失败，请稍后再试");
        return;
      }
      onSaved(data as Review);
    } else {
      const { data, error: e } = await supabase
        .from("reviews")
        .insert({
          booking_id: bookingId,
          user_id: userId,
          listener_id: listenerId,
          content: trimmed,
          is_public: isPublic,
        })
        .select()
        .single();
      setSubmitting(false);
      if (e || !data) {
        setError("提交失败，请稍后再试");
        return;
      }
      onSaved(data as Review);
    }
  }

  return (
    <div className="ml-3 border-l-2 border-border pl-4 py-2 space-y-2">
      <span className="text-caption text-muted block">
        {existing ? "编辑评价" : "写一条评价"}
      </span>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, 1000))}
        placeholder="想说什么都行..."
        rows={3}
        className="input resize-none min-h-[80px]"
      />
      <label className="flex items-center gap-2 text-[13px] text-muted cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        公开此评价（其他用户可看到）
      </label>
      {error && <div className="text-[13px] text-danger">{error}</div>}
      <div className="flex gap-2 pt-1">
        <button
          onClick={submit}
          disabled={submitting || !content.trim()}
          className="btn-primary py-1.5 px-4 text-[13px]"
        >
          {submitting ? "保存中..." : existing ? "保存" : "提交"}
        </button>
        {onCancel ? (
          <button
            onClick={onCancel}
            disabled={submitting}
            className="btn-ghost py-1.5 px-3 text-[13px]"
          >
            取消
          </button>
        ) : (
          <button
            onClick={() => {
              setOpen(false);
              setContent("");
              setIsPublic(false);
              setError(null);
            }}
            disabled={submitting}
            className="btn-ghost py-1.5 px-3 text-[13px]"
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
}

function ReplyForm({
  reviewId,
  existing,
  onSaved,
  onCancel,
}: {
  reviewId: string;
  existing: string | null;
  onSaved: (r: Review) => void;
  onCancel?: () => void;
}) {
  const [reply, setReply] = useState(existing || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = reply.trim();
    if (!trimmed) {
      setError("回复不能为空");
      return;
    }
    if (trimmed.length > 1000) {
      setError("回复过长（最多 1000 字）");
      return;
    }
    setSubmitting(true);
    setError(null);
    const supabase = createBrowserClient();
    const { data, error: e } = await supabase
      .from("reviews")
      .update({ reply: trimmed, replied_at: new Date().toISOString() })
      .eq("id", reviewId)
      .select()
      .single();
    setSubmitting(false);
    if (e || !data) {
      setError("保存失败，请稍后再试");
      return;
    }
    onSaved(data as Review);
  }

  return (
    <div className="space-y-2">
      <span className="text-caption text-accent block">
        {existing ? "编辑回复" : "回复用户"}
      </span>
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value.slice(0, 1000))}
        placeholder="说几句..."
        rows={3}
        className="input resize-none min-h-[80px]"
      />
      {error && <div className="text-[13px] text-danger">{error}</div>}
      <div className="flex gap-2 pt-1">
        <button
          onClick={submit}
          disabled={submitting || !reply.trim()}
          className="btn-primary py-1.5 px-4 text-[13px]"
        >
          {submitting ? "保存中..." : existing ? "保存" : "提交回复"}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={submitting}
            className="btn-ghost py-1.5 px-3 text-[13px]"
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
}
