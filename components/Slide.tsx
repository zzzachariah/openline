"use client";

import { ReactNode, useEffect, useRef, useState, forwardRef } from "react";
import { ChevronDown } from "lucide-react";

type SlideProps = {
  children: ReactNode;
  hasChevron?: boolean;
  onChevronClick?: () => void;
  className?: string;
  ariaLabel?: string;
};

const Slide = forwardRef<HTMLElement, SlideProps>(function Slide(
  { children, hasChevron = false, onChevronClick, className = "", ariaLabel },
  ref
) {
  const innerRef = useRef<HTMLElement | null>(null);
  // null = SSR / pre-hydration (no attribute set, content visible by default).
  // false = JS active, waiting for slide to enter viewport.
  // true  = slide entered viewport, animation runs.
  const [visible, setVisible] = useState<null | boolean>(null);

  useEffect(() => {
    const node = innerRef.current;
    if (!node) return;
    setVisible(false);
    const ob = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
          setVisible(true);
          ob.disconnect();
        }
      },
      { threshold: [0.4] }
    );
    ob.observe(node);
    return () => ob.disconnect();
  }, []);

  const dataVisible =
    visible === null ? undefined : visible ? "true" : "false";

  return (
    <section
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node;
      }}
      aria-label={ariaLabel}
      data-visible={dataVisible}
      className={`snap-slide relative px-6 slide ${className}`}
    >
      <div className="w-full max-w-prose mx-auto py-24">{children}</div>

      {hasChevron && (
        <button
          type="button"
          onClick={onChevronClick}
          aria-label="向下滚动"
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-muted hover:text-foreground transition-colors"
        >
          <ChevronDown size={20} className="chevron-hint" />
        </button>
      )}
    </section>
  );
});

export default Slide;
