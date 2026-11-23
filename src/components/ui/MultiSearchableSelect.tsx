"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface MultiSelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  subtitle?: string;
  count?: number;
}

interface MultiSearchableSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder: string;
  clearLabel: string;
  searchPlaceholder?: string;
  emptyText?: string;
  icon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
}

export function MultiSearchableSelect({
  values,
  onChange,
  options,
  placeholder,
  clearLabel,
  searchPlaceholder = "Buscar...",
  emptyText = "Sin resultados",
  icon,
  fullWidth = false,
  className = "",
}: MultiSearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 264 });

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const maxViewportWidth = Math.max(220, window.innerWidth - 24);
      const menuWidth = fullWidth
        ? Math.min(Math.max(rect.width, 256), maxViewportWidth)
        : Math.min(264, maxViewportWidth);
      let left = rect.left;
      if (left + menuWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - menuWidth - 12);
      }
      let top = rect.bottom + 6;
      const estimatedHeight = 290;
      if (top + estimatedHeight > window.innerHeight - 12 && rect.top > estimatedHeight + 12) {
        top = rect.top - estimatedHeight - 6;
      }
      setCoords({ top, left, width: menuWidth });
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    updateCoords();
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    const timer = setTimeout(() => inputRef.current?.focus(), 40);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subtitle && opt.subtitle.toLowerCase().includes(q))
    );
  }, [options, query]);

  const toggleValue = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const singleSelected =
    values.length === 1 ? options.find((o) => o.value === values[0]) : undefined;

  const buttonLabel =
    values.length === 0
      ? placeholder
      : values.length === 1
      ? singleSelected?.label || values[0]
      : `${placeholder.replace(/\s*\(\d+\)$/, "")} (${values.length})`;

  const isActive = values.length > 0;

  return (
    <div className={`relative ${fullWidth ? "w-full" : ""} ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setIsOpen((v) => !v);
          setQuery("");
        }}
        aria-expanded={isOpen}
        className={`${
          fullWidth
            ? "w-full justify-between px-3.5 py-2 rounded-2xl"
            : "inline-flex px-3 py-1.5 rounded-full"
        } flex items-center gap-1.5 text-xs font-semibold border transition cursor-pointer active:scale-[0.98] ${
          isActive
            ? "bg-orange-600 border-orange-600 text-white shadow-xs"
            : fullWidth
            ? "bg-[#f8f9ff] dark:bg-slate-800/70 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        }`}
      >
        <span className="inline-flex items-center gap-1.5 min-w-0">
          {values.length === 1 && singleSelected?.icon ? (
            <span className="inline-flex items-center leading-none shrink-0">
              {singleSelected.icon}
            </span>
          ) : icon ? (
            <span
              className={`inline-flex items-center leading-none shrink-0 ${
                isActive ? "text-white" : "text-orange-600 dark:text-orange-400"
              }`}
            >
              {icon}
            </span>
          ) : null}
          <span className={`truncate ${fullWidth ? "" : "max-w-[165px]"}`}>{buttonLabel}</span>
        </span>
        <span className="material-symbols-outlined text-sm leading-none opacity-75 shrink-0">
          {isOpen ? "expand_less" : "expand_more"}
        </span>
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
            }}
            className="z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 space-y-1.5 max-h-72 flex flex-col gm-popover-in"
          >
            <div className="relative shrink-0">
              <span className="material-symbols-outlined text-sm text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none leading-none">
                search
              </span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full px-2.5 py-1.5 pl-8 pr-7 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 transition"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {values.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full px-2.5 py-1 rounded-xl text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer text-left shrink-0"
              >
                {clearLabel} ({values.length})
              </button>
            )}

            <div className="overflow-y-auto space-y-0.5 pr-0.5">
              {filteredOptions.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-3 italic">{emptyText}</p>
              ) : (
                filteredOptions.map((opt) => {
                  const active = values.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleValue(opt.value)}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                        active
                          ? "bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-bold"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <span
                          className={`material-symbols-outlined text-sm leading-none shrink-0 ${
                            active
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-slate-300 dark:text-slate-600"
                          }`}
                        >
                          {active ? "check_box" : "check_box_outline_blank"}
                        </span>
                        {opt.icon && (
                          <span className="inline-flex items-center leading-none shrink-0">
                            {opt.icon}
                          </span>
                        )}
                        <span className="truncate">{opt.label}</span>
                      </span>
                      {typeof opt.count === "number" && (
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">
                          {opt.count}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
