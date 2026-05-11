"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import {
  WEEKDAY_SHORT,
  addDays,
  dayKey,
  isSameDay,
  startOfDay,
  weekDays,
} from "@/lib/calendar";

export type WeekSlot = {
  id: string;
  start: Date;
  end: Date;
  isBooked: boolean;
};

type WeekCalendarProps = {
  anchor: Date;
  onAnchorChange?: (d: Date) => void;
  slots: WeekSlot[];
  /** Hours range shown in the grid (inclusive start, exclusive end). */
  hourStart?: number;
  hourEnd?: number;
  /** Hover-to-create. Called with a Date at hour:00 of the cell. */
  onCreateAtHour?: (d: Date) => void;
  onDeleteSlot?: (id: string) => void;
};

export default function WeekCalendar({
  anchor,
  onAnchorChange,
  slots,
  hourStart = 7,
  hourEnd = 24,
  onCreateAtHour,
  onDeleteSlot,
}: WeekCalendarProps) {
  const [direction, setDirection] = useState(0);
  const today = useMemo(() => startOfDay(new Date()), []);
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const hours = useMemo(
    () => Array.from({ length: hourEnd - hourStart }, (_, i) => i + hourStart),
    [hourStart, hourEnd]
  );

  function shift(by: number) {
    setDirection(by);
    onAnchorChange?.(addDays(anchor, by * 7));
  }

  // Map slots by day and starting hour
  const slotsByDayHour = useMemo(() => {
    const map = new Map<string, WeekSlot[]>();
    for (const s of slots) {
      const k = `${dayKey(s.start)}-${s.start.getHours()}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return map;
  }, [slots]);

  const weekLabel = `${days[0].getMonth() + 1}月${days[0].getDate()}日 — ${
    days[6].getMonth() + 1
  }月${days[6].getDate()}日`;

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => shift(-1)}
          aria-label="上一周"
          className="p-1.5 rounded-full text-muted hover:text-foreground hover:bg-accent-soft transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={weekLabel}
            initial={{ opacity: 0, y: direction > 0 ? -6 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direction > 0 ? 6 : -6 }}
            transition={{ duration: 0.18, ease: [0.215, 0.61, 0.355, 1] }}
            className="text-[15px] font-medium tracking-tight tabular-nums"
          >
            {weekLabel}
          </motion.div>
        </AnimatePresence>
        <button
          onClick={() => shift(1)}
          aria-label="下一周"
          className="p-1.5 rounded-full text-muted hover:text-foreground hover:bg-accent-soft transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-px bg-border/60 border border-border rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="bg-surface" />
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={dayKey(d)}
              className={`bg-surface text-center py-2 ${
                isToday ? "text-accent" : "text-foreground"
              }`}
            >
              <div className="text-caption text-muted">
                {WEEKDAY_SHORT[d.getDay()]}
              </div>
              <div
                className={`text-[14px] font-medium tabular-nums leading-tight ${
                  isToday ? "text-accent" : ""
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}

        {/* Hour rows */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`grid-${dayKey(days[0])}`}
            initial={{ opacity: 0, x: direction * 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -12 }}
            transition={{ duration: 0.22, ease: [0.215, 0.61, 0.355, 1] }}
            className="contents"
          >
            {hours.map((h) => (
              <Row
                key={h}
                hour={h}
                days={days}
                today={today}
                slotsByDayHour={slotsByDayHour}
                onCreateAtHour={onCreateAtHour}
                onDeleteSlot={onDeleteSlot}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Row({
  hour,
  days,
  today,
  slotsByDayHour,
  onCreateAtHour,
  onDeleteSlot,
}: {
  hour: number;
  days: Date[];
  today: Date;
  slotsByDayHour: Map<string, WeekSlot[]>;
  onCreateAtHour?: (d: Date) => void;
  onDeleteSlot?: (id: string) => void;
}) {
  return (
    <>
      <div className="bg-surface text-caption text-muted text-right pr-1.5 pt-1 leading-tight tabular-nums">
        {hour}:00
      </div>
      {days.map((d) => {
        const slotsHere = slotsByDayHour.get(`${dayKey(d)}-${hour}`) || [];
        const cellDate = new Date(d);
        cellDate.setHours(hour, 0, 0, 0);
        const isPast = cellDate < new Date();
        const isWeekendCell = d.getDay() === 0 || d.getDay() === 6;
        const isToday = isSameDay(d, today);
        return (
          <div
            key={dayKey(d) + "-" + hour}
            className={`relative h-12 group ${
              isToday
                ? "bg-accent-soft/40"
                : isWeekendCell
                ? "bg-surface/70"
                : "bg-surface"
            }`}
          >
            {slotsHere.length > 0 ? (
              <SlotChip slot={slotsHere[0]} onDelete={onDeleteSlot} />
            ) : (
              !isPast && (
                <button
                  type="button"
                  onClick={() => onCreateAtHour?.(cellDate)}
                  className="absolute inset-0.5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-accent/10 border border-dashed border-transparent group-hover:border-accent/40 transition-all duration-150"
                  aria-label={`${hour}:00 添加时段`}
                >
                  <Plus size={14} className="text-accent" />
                </button>
              )
            )}
          </div>
        );
      })}
    </>
  );
}

function SlotChip({
  slot,
  onDelete,
}: {
  slot: WeekSlot;
  onDelete?: (id: string) => void;
}) {
  const min = slot.start.getMinutes();
  const dur = (slot.end.getTime() - slot.start.getTime()) / 60000;
  const heightPct = Math.min((dur / 60) * 100, 200);
  const offsetPct = (min / 60) * 100;
  const label = `${pad(slot.start.getHours())}:${pad(slot.start.getMinutes())}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.18, ease: [0.215, 0.61, 0.355, 1] }}
      className={`absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 text-[11px] leading-tight overflow-hidden flex flex-col justify-between ${
        slot.isBooked
          ? "bg-muted/15 text-muted border border-muted/30"
          : "bg-accent text-white border border-accent"
      }`}
      style={{
        top: `${offsetPct}%`,
        height: `${heightPct}%`,
        zIndex: 5,
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-medium tabular-nums">{label}</span>
        {!slot.isBooked && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(slot.id);
            }}
            className="opacity-60 hover:opacity-100 transition-opacity"
            aria-label="删除"
          >
            <X size={10} />
          </button>
        )}
      </div>
      <span className="text-[10px] opacity-80 truncate">
        {slot.isBooked ? "已预约" : `${dur} 分`}
      </span>
    </motion.div>
  );
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
