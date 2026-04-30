"use client";

import Link from "next/link";
import { formatDate, formatTimeRange, formatCountdown } from "@/lib/format";

export type BookingCardData = {
  id: string;
  format: "text" | "voice";
  status: "upcoming" | "completed" | "cancelled";
  counterpartyUsername: string;
  startTime: string;
  endTime: string;
};

type Props = {
  booking: BookingCardData;
  now: number;
  role: "user" | "listener";
  onCancel?: () => void;
};

export default function BookingCard({ booking, now, role, onCancel }: Props) {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const startTs = start.getTime();
  const endTs = end.getTime();
  const fiveMinBeforeStart = startTs - 5 * 60 * 1000;
  const oneHourBeforeStart = startTs - 60 * 60 * 1000;

  const inWindow = now >= fiveMinBeforeStart && now <= endTs;
  const cancellable = booking.status === "upcoming" && now < oneHourBeforeStart;
  const chatUrl = role === "user" ? `/chat/${booking.id}` : `/listener/chat/${booking.id}`;

  return (
    <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="space-y-1.5 flex-1 min-w-0">
        <div className="text-[15px] font-medium">
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
            {booking.status === "upcoming"
              ? "即将开始"
              : booking.status === "completed"
              ? "已完成"
              : "已取消"}
          </span>
        </div>
        {booking.status === "upcoming" && !inWindow && (
          <div className="text-caption text-muted pt-1">{formatCountdown(startTs - now)}</div>
        )}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
        {booking.status === "upcoming" && inWindow && (
          <Link href={chatUrl} className="btn-primary">
            进入聊天室
          </Link>
        )}
        {booking.status === "completed" && (
          <Link href={chatUrl} className="btn-secondary">
            查看
          </Link>
        )}
        {booking.status === "upcoming" && cancellable && onCancel && (
          <button
            onClick={onCancel}
            className="text-[13px] text-muted hover:text-danger transition-colors"
          >
            取消预约
          </button>
        )}
      </div>
    </div>
  );
}
