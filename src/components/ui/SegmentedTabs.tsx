"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface SegmentedTabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: string;
  badge?: number | string;
}

interface SegmentedTabsProps<T extends string = string> {
  items: SegmentedTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  variant?: "primary" | "neutral" | "dark";
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
}

/**
 * Control de pestañas segmentadas estilo Stitch con píldora deslizante animada,
 * soporte de teclado (ArrowLeft/ArrowRight) y respeto a prefers-reduced-motion.
 */
export function SegmentedTabs<T extends string = string>({
  items,
  value,
  onChange,
  ariaLabel,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: SegmentedTabsProps<T>) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(
    null
  );

  const updateIndicator = useCallback(() => {
    const btn = tabRefs.current[value];
    if (!btn || btn.offsetWidth === 0) return;
    setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [value]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener("resize", updateIndicator);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      observer = new ResizeObserver(updateIndicator);
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateIndicator);
      observer?.disconnect();
    };
  }, [updateIndicator, items]);

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const nextIdx = (idx + delta + items.length) % items.length;
    const nextItem = items[nextIdx];
    if (!nextItem) return;
    onChange(nextItem.id);
    tabRefs.current[nextItem.id]?.focus();
  }

  const pillColorClass =
    variant === "primary"
      ? "bg-orange-600 shadow-sm"
      : variant === "dark"
        ? "bg-slate-900 dark:bg-white shadow-xs"
        : "bg-white dark:bg-slate-900 shadow-xs";

  const activeTextClass =
    variant === "primary"
      ? "text-white font-bold"
      : variant === "dark"
        ? "text-white dark:text-slate-900 font-bold"
        : "text-slate-900 dark:text-slate-100 font-bold";

  const paddingClass =
    size === "sm" ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-xs";

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`relative ${
        fullWidth ? "flex w-full" : "inline-flex max-w-full"
      } items-stretch gap-1 p-1 rounded-full bg-[#f2f3ff] dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 overflow-x-auto scrollbar-none ${className}`}
    >
      {indicator && (
        <span
          aria-hidden="true"
          style={{
            transform: `translateX(${indicator.left}px)`,
            width: `${indicator.width}px`,
          }}
          className={`pointer-events-none absolute top-1 bottom-1 left-0 rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${pillColorClass}`}
        />
      )}

      {items.map((item, idx) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              tabRefs.current[item.id] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full whitespace-nowrap transition-colors duration-200 cursor-pointer ${
              fullWidth ? "flex-1 min-w-0" : ""
            } ${paddingClass} ${
              active
                ? `${!indicator ? `${pillColorClass} ` : ""}${activeTextClass}`
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold"
            }`}
          >
            {item.icon && (
              <span className="material-symbols-outlined text-[16px] leading-none shrink-0">
                {item.icon}
              </span>
            )}
            <span className="truncate">{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                  active
                    ? variant === "primary"
                      ? "bg-white/20 text-white"
                      : "bg-slate-200/70 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200"
                    : "bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300"
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
