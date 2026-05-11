"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  hourStart?: number;
  hourEnd?: number;
  onCreateAtHour?: (d: Date) => void;
  onDeleteSlot?: (id: string) => void;
  /** Used by parent to size the calendar; when set the grid body scrolls
   * internally and the day header stays pinned. */
  className?: string;
};

const ROW_PX = 60;
const LABEL_W = 56;

export default function WeekCalendar({
  anchor,
  onAnchorChange,
  slots,
  hourStart = 7,
  hourEnd = 24,
  onCreateAtHour,
  onDeleteSlot,
  className,
}: WeekCalendarProps) {
  const [direction, setDirection] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const today = useMemo(() => startOfDay(now), [now]);
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const hours = useMemo(
    () => Array.from({ length: hourEnd - hourStart }, (_, i) => i + hourStart),
    [hourStart, hourEnd]
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didScrollRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Scroll into a sensible starting position (around 8 AM) on first paint
  useEffect(() => {
    if (didScrollRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const offsetHour = Math.max(hourStart, 8) - hourStart;
    el.scrollTop = offsetHour * ROW_PX - 8;
    didScrollRef.current = true;
  }, [hourStart]);

  function shift(by: number) {
    setDirection(by);
    onAnchorChange?.(addDays(anchor, by * 7));
  }

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

  // "Now" indicator
  const todayIdx = days.findIndex((d) => isSameDay(d, today));
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = hourStart * 60;
  const endMins = hourEnd * 60;
  const nowVisible = todayIdx >= 0 && nowMins >= startMins && nowMins < endMins;
  const nowPx = ((nowMins - startMins) / 60) * ROW_PX;

  return (
    <div className={`select-none flex flex-col ${className ?? ""}`}>
      <div className="flex items-center justify-between mb-3 shrink-0">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => shift(-1)}
          aria-label="上一周"
          className="p-1.5 rounded-full text-muted hover:text-foreground hover:bg-accent-soft transition-colors"
        >
          <ChevronLeft size={18} />
        </motion.button>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={weekLabel}
            initial={{ opacity: 0, y: direction > 0 ? -6 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direction > 0 ? 6 : -6 }}
            transition={{ duration: 0.2, ease: [0.215, 0.61, 0.355, 1] }}
            className="text-[15px] font-medium tracking-tight tabular-nums"
          >
            {weekLabel}
          </motion.div>
        </AnimatePresence>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => shift(1)}
          aria-label="下一周"
          className="p-1.5 rounded-full text-muted hover:text-foreground hover:bg-accent-soft transition-colors"
        >
          <ChevronRight size={18} />
        </motion.button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col border border-border rounded-xl overflow-hidden bg-border/60">
        {/* Sticky day header */}
        <div
          className="grid bg-border/60 shrink-0 gap-px"
          style={{ gridTemplateColumns: `${LABEL_W}px repeat(7, minmax(0, 1fr))` }}
        >
          <div className="bg-surface" />
          {days.map((d) => {
            const isToday = isSameDay(d, today);
            return (
              <div
                key={dayKey(d)}
                className={`bg-surface text-center py-2 relative ${
                  isToday ? "text-accent" : "text-foreground"
                }`}
              >
                <div className="text-caption text-muted">
                  {WEEKDAY_SHORT[d.getDay()]}
                </div>
                <motion.div
                  animate={
                    isToday
                      ? { scale: [1, 1.04, 1] }
                      : undefined
                  }
                  transition={
                    isToday
                      ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
                      : undefined
                  }
                  className={`text-[14px] font-medium tabular-nums leading-tight ${
                    isToday ? "text-accent" : ""
                  }`}
                >
                  {d.getDate()}
                </motion.div>
                {isToday && (
                  <motion.span
                    layoutId="week-today-underline"
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-accent"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Scrollable hour grid */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto bg-border/60">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`grid-${dayKey(days[0])}`}
              initial={{ opacity: 0, x: direction * 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -12 }}
              transition={{ duration: 0.24, ease: [0.215, 0.61, 0.355, 1] }}
              className="relative"
            >
              <div
                className="grid gap-px"
                style={{ gridTemplateColumns: `${LABEL_W}px repeat(7, minmax(0, 1fr))` }}
              >
                {hours.map((h, rowIdx) => (
                  <Row
                    key={h}
                    hour={h}
                    rowIdx={rowIdx}
                    days={days}
                    today={today}
                    slotsByDayHour={slotsByDayHour}
                    onCreateAtHour={onCreateAtHour}
                    onDeleteSlot={onDeleteSlot}
                  />
                ))}
              </div>

              {nowVisible && (
                <NowLine top={nowPx} todayIdx={todayIdx} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function NowLine({ top, todayIdx }: { top: number; todayIdx: number }) {
  return (
    <div
      className="absolute pointer-events-none z-20"
      style={{
        top,
        left: 0,
        right: 0,
        height: 0,
      }}
    >
      <div className="relative">
        <div
          className="absolute bg-accent/35 h-px"
          style={{ left: LABEL_W, right: 0 }}
        />
        <motion.span
          className="absolute w-2 h-2 -mt-1 rounded-full bg-accent shadow-[0_0_0_4px_rgba(91,155,142,0.18)]"
          style={{
            left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) / 7 * ${todayIdx + 0.5} - 4px)`,
          }}
          animate={{ opacity: [1, 0.55, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

function Row({
  hour,
  rowIdx,
  days,
  today,
  slotsByDayHour,
  onCreateAtHour,
  onDeleteSlot,
}: {
  hour: number;
  rowIdx: number;
  days: Date[];
  today: Date;
  slotsByDayHour: Map<string, WeekSlot[]>;
  onCreateAtHour?: (d: Date) => void;
  onDeleteSlot?: (id: string) => void;
}) {
  // Per-row stagger delay creates a soft wave on first render
  const delay = Math.min(rowIdx * 0.014, 0.25);
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24, delay, ease: [0.215, 0.61, 0.355, 1] }}
        className="bg-surface text-caption text-muted text-right pr-2 leading-none tabular-nums flex items-start justify-end"
        style={{ height: ROW_PX }}
      >
        <span className="-translate-y-1.5 inline-block">
          {hour}:00
        </span>
      </motion.div>
      {days.map((d) => {
        const slotsHere = slotsByDayHour.get(`${dayKey(d)}-${hour}`) || [];
        const cellDate = new Date(d);
        cellDate.setHours(hour, 0, 0, 0);
        const isPast = cellDate < new Date();
        const isWeekendCell = d.getDay() === 0 || d.getDay() === 6;
        const isToday = isSameDay(d, today);
        return (
          <motion.div
            key={dayKey(d) + "-" + hour}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.24, delay, ease: [0.215, 0.61, 0.355, 1] }}
            className={`relative group ${
              isToday
                ? "bg-accent-soft/35"
                : isWeekendCell
                ? "bg-surface/70"
                : "bg-surface"
            }`}
            style={{ height: ROW_PX }}
          >
            {slotsHere.length > 0 ? (
              <SlotChip slot={slotsHere[0]} onDelete={onDeleteSlot} />
            ) : (
              !isPast && (
                <motion.button
                  type="button"
                  onClick={() => onCreateAtHour?.(cellDate)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="absolute inset-1 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-accent/10 border border-dashed border-transparent group-hover:border-accent/40 transition-[opacity,background,border-color] duration-150"
                  aria-label={`${hour}:00 添加时段`}
                >
                  <Plus size={14} className="text-accent" />
                </motion.button>
              )
            )}
          </motion.div>
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
  const heightPct = Math.min((dur / 60) * 100, 240);
  const offsetPct = (min / 60) * 100;
  const label = `${pad(slot.start.getHours())}:${pad(slot.start.getMinutes())}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92, y: -2 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      whileHover={
        slot.isBooked
          ? { y: -1 }
          : {
              y: -1,
              boxShadow:
                "0 4px 14px -2px rgba(91,155,142,0.35), 0 2px 4px rgba(91,155,142,0.18)",
            }
      }
      transition={{
        layout: { type: "spring", stiffness: 360, damping: 30 },
        scale: { type: "spring", stiffness: 360, damping: 28 },
        opacity: { duration: 0.18 },
      }}
      className={`absolute left-1 right-1 rounded-md px-1.5 py-1 text-[11px] leading-[1.15] overflow-hidden flex flex-col justify-between ${
        slot.isBooked
          ? "bg-muted/15 text-muted border border-muted/30"
          : "bg-accent text-white border border-accent shadow-sm"
      }`}
      style={{
        top: `${offsetPct}%`,
        height: `${heightPct}%`,
        minHeight: 30,
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
            className="opacity-70 hover:opacity-100 transition-opacity -mr-0.5 -mt-0.5"
            aria-label="删除"
          >
            <X size={10} />
          </button>
        )}
      </div>
      <span className="text-[10px] opacity-85 leading-none truncate">
        {slot.isBooked ? "已预约" : `${dur} 分钟`}
      </span>
    </motion.div>
  );
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
