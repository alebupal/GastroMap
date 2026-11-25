"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { PlaceWithDetails } from "@/lib/actions/places";
import { useT } from "@/lib/i18n/client";
import { normalizeSearchText } from "@/lib/search";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  places: PlaceWithDetails[];
  isAdmin: boolean;
  onSelectPlaceOnMap: (placeId: string) => void;
  onSelectPlaceInList: (placeId: string) => void;
  onOpenRandom: () => void;
  onOpenAssistant: () => void;
  onOpenExportImport: () => void;
}

interface QuickActionItem {
  id: string;
  label: string;
  subtitle: string;
  icon: string;
  run: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  places,
  isAdmin,
  onSelectPlaceOnMap,
  onSelectPlaceInList,
  onOpenRandom,
  onOpenAssistant,
  onOpenExportImport,
}: CommandPaletteProps) {
  const { t } = useT();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  const actions = useMemo<QuickActionItem[]>(() => {
    const base: QuickActionItem[] = [
      {
        id: "action-new",
        label: t("places.add_new"),
        subtitle: "/new",
        icon: "add_location_alt",
        run: () => {
          onClose();
          router.push("/new");
        },
      },
      {
        id: "action-random",
        label: t("places.roulette"),
        subtitle: t("ui.indecision_mode"),
        icon: "casino",
        run: () => {
          onClose();
          onOpenRandom();
        },
      },
      {
        id: "action-assistant",
        label: t("places.assistant"),
        subtitle: t("command_palette.assistant_subtitle"),
        icon: "tune",
        run: () => {
          onClose();
          onOpenAssistant();
        },
      },
      {
        id: "action-export",
        label: t("places.export_import"),
        subtitle: "JSON, PDF, CSV, GPX, KML",
        icon: "swap_vert",
        run: () => {
          onClose();
          onOpenExportImport();
        },
      },
      {
        id: "action-docs",
        label: t("nav.documentation"),
        subtitle: "/docs",
        icon: "menu_book",
        run: () => {
          onClose();
          router.push("/docs");
        },
      },
    ];

    if (isAdmin) {
      base.push({
        id: "action-admin",
        label: t("nav.admin"),
        subtitle: "/admin",
        icon: "admin_panel_settings",
        run: () => {
          onClose();
          router.push("/admin");
        },
      });
    }

    return base;
  }, [t, isAdmin, onClose, router, onOpenRandom, onOpenAssistant, onOpenExportImport]);

  const filteredPlaces = useMemo(() => {
    const q = normalizeSearchText(query);
    if (!q) return places.slice(0, 6);
    return places
      .filter(
        (p) =>
          normalizeSearchText(p.name).includes(q) ||
          (p.city && normalizeSearchText(p.city).includes(q)) ||
          (p.address && normalizeSearchText(p.address).includes(q)) ||
          (p.createdByName && normalizeSearchText(p.createdByName).includes(q)) ||
          (p.createdByUsername &&
            (normalizeSearchText(p.createdByUsername).includes(q) ||
              normalizeSearchText(`@${p.createdByUsername}`).includes(q))) ||
          p.tags.some((tg) => normalizeSearchText(tg).includes(q)) ||
          (p.commentAuthors || []).some((a) => normalizeSearchText(a).includes(q))
      )
      .slice(0, 8);
  }, [places, query]);

  const filteredActions = useMemo(() => {
    const q = normalizeSearchText(query);
    if (!q) return actions;
    return actions.filter(
      (a) =>
        normalizeSearchText(a.label).includes(q) ||
        normalizeSearchText(a.subtitle).includes(q)
    );
  }, [actions, query]);

  const totalItems = filteredPlaces.length + filteredActions.length;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (totalItems > 0 ? (prev + 1) % totalItems : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (totalItems > 0 ? (prev - 1 + totalItems) % totalItems : 0));
      } else if (e.key === "Enter" && totalItems > 0) {
        e.preventDefault();
        if (activeIndex < filteredPlaces.length) {
          const p = filteredPlaces[activeIndex];
          onClose();
          onSelectPlaceInList(p.id);
        } else {
          const act = filteredActions[activeIndex - filteredPlaces.length];
          act?.run();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, totalItems, activeIndex, filteredPlaces, filteredActions, onClose, onSelectPlaceInList]);

  if (!isOpen || !mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[1200] flex items-start justify-center pt-[10vh] p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm gm-backdrop-in text-left"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col max-h-[75vh] gm-modal-in">
        {/* Input de búsqueda rápida */}
        <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <span className="material-symbols-outlined text-xl text-orange-600 shrink-0">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("command_palette.placeholder")}
            className="flex-1 bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500">
            ESC
          </kbd>
        </div>

        {/* Resultados */}
        <div className="p-3 overflow-y-auto flex-1 space-y-4">
          {/* Sitios */}
          {filteredPlaces.length > 0 && (
            <div className="space-y-1">
              <div className="px-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {t("command_palette.places_section")}
              </div>
              {filteredPlaces.map((p, idx) => {
                const isSelected = activeIndex === idx;
                const initials = p.name
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <div
                    key={p.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`px-2.5 py-2 rounded-2xl flex items-center justify-between gap-2 transition cursor-pointer ${
                      isSelected
                        ? "bg-orange-50 dark:bg-orange-950/40"
                        : "hover:bg-[#f8f9ff] dark:hover:bg-slate-800/50"
                    }`}
                    onClick={() => {
                      onClose();
                      onSelectPlaceInList(p.id);
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-orange-600 text-white"
                            : "bg-orange-100/90 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300"
                        }`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {p.city || "—"} • {p.priceRange}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        onSelectPlaceOnMap(p.id);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:border-orange-500 hover:text-orange-600 transition shrink-0 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs leading-none">map</span>
                      <span>{t("places.view_map")}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Acciones rápidas */}
          {filteredActions.length > 0 && (
            <div className="space-y-1">
              <div className="px-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {t("command_palette.actions_section")}
              </div>
              {filteredActions.map((act, idx) => {
                const flatIndex = filteredPlaces.length + idx;
                const isSelected = activeIndex === flatIndex;
                return (
                  <button
                    key={act.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                    onClick={act.run}
                    className={`w-full px-2.5 py-2 rounded-2xl flex items-center justify-between gap-2 text-left transition cursor-pointer ${
                      isSelected
                        ? "bg-orange-50 dark:bg-orange-950/40"
                        : "hover:bg-[#f8f9ff] dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-orange-600 text-white"
                            : "bg-[#f2f3ff] dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        <span className="material-symbols-outlined text-base leading-none">
                          {act.icon}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                          {act.label}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {act.subtitle}
                        </div>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-sm text-slate-400 shrink-0">
                      keyboard_return
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {totalItems === 0 && (
            <div className="py-10 text-center text-xs text-slate-400">
              {t("command_palette.no_results")}
            </div>
          )}
        </div>

        {/* Pie informativo de teclado */}
        <div className="px-4 py-2.5 bg-[#f8f9ff] dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
          <span>↑↓ {t("command_palette.navigate")} • Enter {t("command_palette.select")}</span>
          <span>Ctrl+K / ⌘K</span>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
