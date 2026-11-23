"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

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
  className?: string;
  buttonClassName?: string;
}

export function CustomSelect<T extends string = string>({
  value,
  onChange,
  options,
  ariaLabel,
  align = "right",
  className = "",
  buttonClassName = "",
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 hover:bg-[#f8f9ff] dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 shadow-2xs transition cursor-pointer whitespace-nowrap ${buttonClassName}`}
      >
        {current?.icon && <span className="inline-flex items-center shrink-0">{current.icon}</span>}
        <span>{current?.label}</span>
        <span
          className={`material-symbols-outlined text-sm text-slate-400 leading-none transition-transform duration-150 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute ${
            align === "left" ? "left-0" : "right-0"
          } top-full mt-1.5 min-w-[168px] max-h-64 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl dark:shadow-2xl z-[1050] p-1.5 space-y-0.5 gm-popover-in`}
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
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs transition cursor-pointer text-left ${
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
      )}
    </div>
  );
}
