"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";

export const MOBILE_NAV_EVENTS = {
  OPEN_STATS: "gastromap:open-stats",
  OPEN_MENU: "gastromap:open-mobile-menu",
  OPEN_COMMAND_PALETTE: "gastromap:open-command-palette",
} as const;

interface MobileBottomNavProps {
  onExploreClick?: () => void;
}

export function MobileBottomNav({ onExploreClick }: MobileBottomNavProps) {
  const { t } = useT();
  const pathname = usePathname();
  const isExplore = pathname === "/";
  const isNew = pathname === "/new";

  return (
    <nav
      aria-label={t("mobile_nav.aria_label")}
      className="lg:hidden fixed bottom-0 inset-x-0 z-[960] bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-4 h-16 max-w-lg mx-auto px-2">
        {/* 1. Explorar */}
        {isExplore ? (
          <button
            type="button"
            onClick={() => {
              onExploreClick?.();
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            className="flex flex-col items-center justify-center gap-0.5 text-orange-600 dark:text-orange-400 font-extrabold cursor-pointer active:scale-95 transition"
          >
            <span
              className="material-symbols-outlined text-[22px] leading-none"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              explore
            </span>
            <span className="text-[10px] leading-tight">{t("mobile_nav.explore")}</span>
          </button>
        ) : (
          <Link
            href="/"
            className="flex flex-col items-center justify-center gap-0.5 text-slate-500 dark:text-slate-400 hover:text-orange-600 font-semibold transition"
          >
            <span className="material-symbols-outlined text-[22px] leading-none">explore</span>
            <span className="text-[10px] leading-tight">{t("mobile_nav.explore")}</span>
          </Link>
        )}

        {/* 2. Añadir */}
        <Link
          href="/new"
          className={`flex flex-col items-center justify-center gap-0.5 transition active:scale-95 ${
            isNew
              ? "text-orange-600 dark:text-orange-400 font-extrabold"
              : "text-slate-500 dark:text-slate-400 hover:text-orange-600 font-semibold"
          }`}
        >
          <span
            className="material-symbols-outlined text-[22px] leading-none"
            style={isNew ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            add_circle
          </span>
          <span className="text-[10px] leading-tight">{t("mobile_nav.add")}</span>
        </Link>

        {/* 3. Estadísticas */}
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event(MOBILE_NAV_EVENTS.OPEN_STATS));
            }
          }}
          className="flex flex-col items-center justify-center gap-0.5 text-slate-500 dark:text-slate-400 hover:text-orange-600 font-semibold cursor-pointer active:scale-95 transition"
        >
          <span className="material-symbols-outlined text-[22px] leading-none">bar_chart</span>
          <span className="text-[10px] leading-tight">{t("mobile_nav.stats")}</span>
        </button>

        {/* 4. Menú */}
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event(MOBILE_NAV_EVENTS.OPEN_MENU));
            }
          }}
          className="flex flex-col items-center justify-center gap-0.5 text-slate-500 dark:text-slate-400 hover:text-orange-600 font-semibold cursor-pointer active:scale-95 transition"
        >
          <span className="material-symbols-outlined text-[22px] leading-none">tune</span>
          <span className="text-[10px] leading-tight">{t("mobile_nav.menu")}</span>
        </button>
      </div>
    </nav>
  );
}
