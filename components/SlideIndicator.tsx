"use client";

import { useEffect, useState } from "react";

type SlideIndicatorProps = {
  count: number;
  containerSelector?: string;
  onJump?: (index: number) => void;
};

export default function SlideIndicator({
  count,
  containerSelector = ".snap-container",
  onJump,
}: SlideIndicatorProps) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const container = document.querySelector(containerSelector) as HTMLElement | null;
    if (!container) return;
    const onScroll = () => {
      const slideHeight = container.clientHeight;
      const idx = Math.round(container.scrollTop / slideHeight);
      setActive(Math.min(count - 1, Math.max(0, idx)));
    };
    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [count, containerSelector]);

  return (
    <div className="hidden md:flex fixed right-6 top-1/2 -translate-y-1/2 z-30 flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          aria-label={`第 ${i + 1} 屏`}
          onClick={() => onJump?.(i)}
          className="w-1.5 h-1.5 rounded-full transition-all duration-300"
          style={{
            background: i === active ? "var(--accent)" : "transparent",
            border: i === active ? "none" : "1px solid var(--border)",
            transform: i === active ? "scale(1.3)" : "scale(1)",
          }}
        />
      ))}
    </div>
  );
}
