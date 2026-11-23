"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastOptions {
  kind?: ToastKind;
  actionLabel?: string;
  onAction?: () => void;
  /** ms antes de desaparecer (por defecto 4000, 7000 si hay acción) */
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const STYLES: Record<ToastKind, string> = {
  success: "bg-emerald-600 border-emerald-400/60 text-white",
  error: "bg-red-600 border-red-400/60 text-white",
  info: "bg-slate-800 border-slate-600 text-slate-100",
};
const ICONS: Record<ToastKind, string> = {
  success: "check_circle",
  error: "warning",
  info: "info",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = ++counter.current;
      const item: ToastItem = {
        id,
        kind: options.kind ?? "success",
        message,
        actionLabel: options.actionLabel,
        onAction: options.onAction,
      };
      setItems((prev) => [...prev.slice(-3), item]);
      setTimeout(() => dismiss(id), options.duration ?? (options.onAction ? 7000 : 4000));
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed z-[2000] bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm flex flex-col gap-2 pointer-events-none"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border shadow-2xl text-xs font-semibold gm-slide-up ${STYLES[t.kind]}`}
          >
            <span
              className="material-symbols-outlined text-base leading-none shrink-0"
              aria-hidden="true"
            >
              {ICONS[t.kind]}
            </span>
            <span className="flex-1">{t.message}</span>
            {t.actionLabel && t.onAction && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
                className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 font-black uppercase tracking-wide text-[10px] cursor-pointer"
              >
                {t.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar"
              className="opacity-70 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
