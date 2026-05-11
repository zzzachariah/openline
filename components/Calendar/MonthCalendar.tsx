"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  MONTH_LABEL,
  WEEKDAY_SHORT,
  addMonths,
  dayKey,
  isSameDay,
  isSameMonth,
  monthGrid,
  startOfDay,
} from "@/lib/calendar";

export type DayMeta = {
  count: number;
  bookedCount?: number;
  highlight?: boolean;
};

type MonthCalendarProps = {
  value: Date;
  onChange?: (d: Date) => void;
  meta?: Record<string, DayMeta>;
  /** When true, days without meta are dimmed and not selectable. */
  onlyHighlightedSelectable?: boolean;
  /** Show "+ 添加" button on hover for any day in the current month (listener mode). */
  hoverAddable?: boolean;
  onHoverAdd?: (d: Date) => void;
};

export default function MonthCalendar({
  value,
  onChange,
  meta = {},
  onlyHighlightedSelectable = false,
  hoverAddable = false,
  onHoverAdd,
}: MonthCalendarProps) {
  const [anchor, setAnchor] = useState(() => new Date(value));
  const [direction, setDirection] = useState(0);
  const today = useMemo(() => startOfDay(new Date()), []);

  const grid = useMemo(() => monthGrid(anchor), [anchor]);

  function shift(by: number) {
    setDirection(by);
    setAnchor((a) => addMonths(a, by));
  }

  function pickDay(d: Date) {
    if (!isSameMonth(d, anchor)) {
      const dir = d < anchor ? -1 : 1;
      setDirection(dir);
      setAnchor(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    onChange?.(d);
  }

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => shift(-1)}
          aria-label="上个月"
          className="p-1.5 rounded-full text-muted hover:text-foreground hover:bg-accent-soft transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={anchor.getFullYear() + "-" + anchor.getMonth()}
            initial={{ opacity: 0, y: direction > 0 ? -6 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direction > 0 ? 6 : -6 }}
            transition={{ duration: 0.18, ease: [0.215, 0.61, 0.355, 1] }}
            className="text-[15px] font-medium tracking-tight tabular-nums"
          >
            {MONTH_LABEL(anchor)}
          </motion.div>
        </AnimatePresence>
        <button
          onClick={() => shift(1)}
          aria-label="下个月"
          className="p-1.5 rounded-full text-muted hover:text-foreground hover:bg-accent-soft transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1.5 text-caption text-muted text-center">
        {WEEKDAY_SHORT.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={anchor.getFullYear() + "-" + anchor.getMonth() + "-grid"}
          initial={{ opacity: 0, x: direction * 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -12 }}
          transition={{ duration: 0.22, ease: [0.215, 0.61, 0.355, 1] }}
          className="grid grid-cols-7 gap-1"
        >
          {grid.map((d) => {
            const inMonth = isSameMonth(d, anchor);
            const isToday = isSameDay(d, today);
            const isPast = d < today && !isToday;
            const m = meta[dayKey(d)];
            const has = !!m && m.count > 0;
            const selectable =
              !isPast && (!onlyHighlightedSelectable || has);
            const isSelected = isSameDay(d, value);

            return (
              <DayCell
                key={dayKey(d)}
                date={d}
                inMonth={inMonth}
                isToday={isToday}
                isPast={isPast}
                isSelected={isSelected}
                meta={m}
                selectable={selectable}
                onPick={() => selectable && pickDay(d)}
                hoverAddable={hoverAddable && inMonth && !isPast}
                onHoverAdd={onHoverAdd}
              />
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function DayCell({
  date,
  inMonth,
  isToday,
  isPast,
  isSelected,
  meta,
  selectable,
  onPick,
  hoverAddable,
  onHoverAdd,
}: {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isSelected: boolean;
  meta?: DayMeta;
  selectable: boolean;
  onPick: () => void;
  hoverAddable: boolean;
  onHoverAdd?: (d: Date) => void;
}) {
  const has = !!meta && meta.count > 0;
  const allBooked = meta && meta.bookedCount && meta.bookedCount === meta.count;

  const baseTextColor = !inMonth
    ? "text-muted/40"
    : isPast
    ? "text-muted/60"
    : "text-foreground";

  return (
    <motion.button
      type="button"
      onClick={onPick}
      disabled={!selectable && !hoverAddable}
      whileHover={selectable || hoverAddable ? { y: -1 } : undefined}
      whileTap={selectable || hoverAddable ? { scale: 0.97 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`group relative aspect-square rounded-lg flex flex-col items-center justify-center text-[13px] tabular-nums transition-colors
        ${baseTextColor}
        ${isSelected ? "bg-accent text-white" : has ? "bg-accent-soft" : "hover:bg-accent-soft"}
        ${!selectable && !hoverAddable ? "cursor-default" : "cursor-pointer"}
      `}
    >
      <span
        className={`leading-none ${
          isToday && !isSelected ? "font-semibold text-accent" : ""
        }`}
      >
        {date.getDate()}
      </span>

      {has && (
        <span className="mt-1 flex items-center gap-0.5">
          {[...Array(Math.min(meta!.count, 3))].map((_, i) => (
            <span
              key={i}
              className={`w-1 h-1 rounded-full ${
                isSelected
                  ? "bg-white/70"
                  : allBooked
                  ? "bg-muted/60"
                  : "bg-accent"
              }`}
            />
          ))}
        </span>
      )}

      {hoverAddable && !isSelected && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onHoverAdd?.(date);
          }}
          className="absolute inset-0 rounded-lg flex items-center justify-center bg-accent/95 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          aria-label="添加时段"
          role="button"
        >
          <Plus size={14} />
        </span>
      )}
    </motion.button>
  );
}
