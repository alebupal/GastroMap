"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface CustomSelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface CustomSelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<CustomSelectOption<T>>;
  ariaLabel?: string;
  align?: "left" | "right";
  fullWidth?: boolean;
  className?: string;
  buttonClassName?: string;
}

export function CustomSelect<T extends string = string>({
  value,
  onChange,
  options,
  ariaLabel,
  align = "right",
  fullWidth = false,
  className = "",
  buttonClassName = "",
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value) || options[0];

  const updateCoords = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const minMenuWidth = fullWidth ? rect.width : Math.max(rect.width, 180);
    const maxMenuWidth = Math.min(window.innerWidth - 24, Math.max(minMenuWidth, 260));
    const menuWidth = fullWidth ? rect.width : maxMenuWidth;

    let left = align === "left" ? rect.left : rect.right - menuWidth;
    if (left + menuWidth > window.innerWidth - 12) {
      left = window.innerWidth - menuWidth - 12;
    }
    if (left < 12) left = 12;

    const estimatedHeight = Math.min(options.length * 38 + 16, 300);
    let top = rect.bottom + 6;
    if (top + estimatedHeight > window.innerHeight - 12 && rect.top > estimatedHeight + 12) {
      top = rect.top - estimatedHeight - 6;
    }

    setCoords({ top, left, width: menuWidth });
  };

  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    function onResizeOrScroll(e: Event) {
      if (menuRef.current && e.target && menuRef.current.contains(e.target as Node)) return;
      updateCoords();
    }

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
  }, [isOpen, fullWidth, align, options.length]);

  const menuContent =
    isOpen && coords ? (
      <div
        ref={menuRef}
        role="listbox"
        aria-label={ariaLabel}
        style={{
          position: "fixed",
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          width: fullWidth ? `${coords.width}px` : undefined,
          minWidth: `${coords.width}px`,
        }}
        className="max-h-72 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl z-[1250] p-1.5 space-y-0.5 gm-popover-in"
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                setIsOpen(false);
                if (!active) onChange(opt.value);
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition cursor-pointer text-left ${
                active
                  ? "bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 font-extrabold"
                  : "text-slate-700 dark:text-slate-200 hover:bg-[#f2f3ff] dark:hover:bg-slate-800 font-semibold"
              }`}
            >
              <span className="inline-flex items-center gap-2 min-w-0">
                {opt.icon && <span className="inline-flex items-center shrink-0">{opt.icon}</span>}
                <span className="truncate">{opt.label}</span>
              </span>
              {active && (
                <span className="material-symbols-outlined text-sm text-orange-600 dark:text-orange-400 leading-none shrink-0">
                  check
                </span>
              )}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div className={`relative ${fullWidth ? "block w-full" : "inline-block"} ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={`inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 hover:bg-[#f8f9ff] dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 shadow-2xs transition cursor-pointer whitespace-nowrap ${
          fullWidth ? "w-full" : ""
        } ${buttonClassName}`}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          {current?.icon && <span className="inline-flex items-center shrink-0">{current.icon}</span>}
          <span className="truncate">{current?.label}</span>
        </span>
        <span
          className={`material-symbols-outlined text-sm text-slate-400 leading-none transition-transform duration-150 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {typeof document !== "undefined" && menuContent ? createPortal(menuContent, document.body) : null}
    </div>
  );
}
