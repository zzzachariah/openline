"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";

type Review = {
  id: string;
  comment: string;
  listener_reply: string | null;
  created_at: string;
  replied_at: string | null;
};

type Props = {
  listenerId: string;
  listenerUsername: string;
  onClose: () => void;
};

export default function ListenerReviewsModal({ listenerId, listenerUsername, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createBrowserClient();
      const { data } = await supabase
        .from("reviews")
        .select("id, comment, listener_reply, created_at, replied_at")
        .eq("listener_id", listenerId)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setReviews(data || []);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [listenerId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-xl p-7 w-full max-w-[520px] max-h-[80vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-foreground"
          aria-label="关闭"
        >
          <X size={18} />
        </button>
        <h3 className="text-[18px] font-medium mb-1">{listenerUsername} 的评价</h3>
        <p className="text-caption text-muted mb-5">
          {loading ? "载入中..." : `共 ${reviews.length} 条评价`}
        </p>
        <div className="overflow-y-auto -mx-2 px-2 space-y-4">
          {loading ? null : reviews.length === 0 ? (
            <div className="text-muted text-center py-8 text-[14px]">还没有评价。</div>
          ) : (
            reviews.map((r) => <ReviewItem key={r.id} review={r} />)
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewItem({ review }: { review: Review }) {
  return (
    <div className="border border-border rounded-lg p-4">
      <div className="text-caption text-muted mb-1.5">
        {formatDate(new Date(review.created_at))}
      </div>
      <div className="text-[14px] whitespace-pre-wrap break-words">{review.comment}</div>
      {review.listener_reply && (
        <div className="mt-3 pl-3 border-l-2 border-accent bg-accent-soft rounded-r px-3 py-2">
          <div className="text-caption text-muted mb-1">倾听者回复</div>
          <div className="text-[14px] whitespace-pre-wrap break-words">{review.listener_reply}</div>
        </div>
      )}
    </div>
  );
}
