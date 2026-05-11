"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { formatDate, formatTimeRange, formatCountdown } from "@/lib/format";

export type BookingCardData = {
  id: string;
  format: "text" | "voice";
  status: "upcoming" | "completed" | "cancelled";
  counterpartyUsername: string;
  counterpartyId?: string;
  startTime: string;
  endTime: string;
  isSaved: boolean;
};

type Props = {
  booking: BookingCardData;
  now: number;
  role: "user" | "listener";
  onCancel?: () => void;
  onToggleSaved?: () => void;
  saveBusy?: boolean;
};

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export default function BookingCard({
  booking,
  now,
  role,
  onCancel,
  onToggleSaved,
  saveBusy,
}: Props) {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const startTs = start.getTime();
  const endTs = end.getTime();
  const fiveMinBeforeStart = startTs - 5 * 60 * 1000;
  const oneHourBeforeStart = startTs - 60 * 60 * 1000;

  const inWindow = now >= fiveMinBeforeStart && now <= endTs;
  const effectiveStatus: BookingCardData["status"] =
    booking.status === "upcoming" && now > endTs ? "completed" : booking.status;
  const cancellable = effectiveStatus === "upcoming" && now < oneHourBeforeStart;
  const chatUrl = role === "user" ? `/chat/${booking.id}` : `/listener/chat/${booking.id}`;
  const pastRetention =
    booking.status === "completed" && !booking.isSaved && now - endTs > RETENTION_MS;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-accent/40 transition-colors"
    >
      <div className="space-y-1.5 flex-1 min-w-0">
        <div className="text-[15px] font-medium tabular-nums">
          {formatDate(start)} {formatTimeRange(start, end)}
        </div>
        <div className="text-caption text-muted">
          {role === "user" ? "倾听者" : "倾诉者"} · {booking.counterpartyUsername}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] bg-accent-soft text-accent">
            {booking.format === "text" ? "文字" : "语音"}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] border border-border text-muted">
            {effectiveStatus === "upcoming"
              ? "即将开始"
              : effectiveStatus === "completed"
              ? "已完成"
              : "已取消"}
          </span>
          {booking.status === "completed" && booking.isSaved && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] border border-accent text-accent">
              <BookmarkCheck size={11} />
              已保存
            </span>
          )}
          {pastRetention && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] border border-border text-muted">
              聊天记录已删除
            </span>
          )}
        </div>
        {effectiveStatus === "upcoming" && !inWindow && (
          <div className="text-caption text-muted pt-1 tabular-nums">
            {formatCountdown(startTs - now)}
          </div>
        )}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
        {effectiveStatus === "upcoming" && inWindow && (
          <Link href={chatUrl} className="btn-primary">
            进入聊天室
          </Link>
        )}
        {effectiveStatus === "completed" && (
          <Link href={chatUrl} className="btn-secondary">
            查看
          </Link>
        )}
        {effectiveStatus === "upcoming" && cancellable && onCancel && (
          <button
            onClick={onCancel}
            className="text-[13px] text-muted hover:text-danger transition-colors"
          >
            取消预约
          </button>
        )}
      </div>
    </motion.div>
  );
}
