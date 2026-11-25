"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  getMyListsAction,
  createListAction,
  togglePlaceInListAction,
  type UserPlaceListSummary,
} from "@/lib/actions/lists";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";
import { useSwipeToClose, SheetHandle } from "@/components/ui/BottomSheet";

interface AddToListModalProps {
  placeId: string;
  placeName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AddToListModal({
  placeId,
  placeName,
  isOpen,
  onClose,
}: AddToListModalProps) {
  const { t } = useT();
  const { toast } = useToast();
  const sheet = useSwipeToClose(onClose);
  const [mounted, setMounted] = useState(false);
  const [lists, setLists] = useState<UserPlaceListSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getMyListsAction()
      .then(setLists)
      .finally(() => setLoading(false));

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  async function handleToggle(list: UserPlaceListSummary) {
    if (togglingId) return;
    setTogglingId(list.id);
    const res = await togglePlaceInListAction(list.id, placeId);
    setTogglingId(null);
    if (res?.error) {
      toast(res.error, { kind: "error" });
      return;
    }
    const added = Boolean(res?.added);
    setLists((prev) =>
      prev.map((l) => {
        if (l.id !== list.id) return l;
        const nextIds = added
          ? [...l.placeIds, placeId]
          : l.placeIds.filter((id) => id !== placeId);
        return { ...l, placeIds: nextIds, placesCount: nextIds.length };
      })
    );
    toast(
      added
        ? t("lists.added_to_list_toast", { name: list.name })
        : t("lists.removed_from_list_toast", { name: list.name }),
      { kind: added ? "success" : "info" }
    );
  }

  async function handleQuickCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    const res = await createListAction({
      name: newName.trim(),
      initialPlaceId: placeId,
    });
    setCreating(false);
    if (res?.error) {
      toast(res.error, { kind: "error" });
      return;
    }
    setNewName("");
    toast(t("lists.created_and_added_toast", { name: res.list?.name || "" }), {
      kind: "success",
    });
    const refreshed = await getMyListsAction();
    setLists(refreshed);
  }

  const modal = (
    <div
      style={sheet.backdropStyle}
      className="fixed inset-0 z-[1150] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm gm-backdrop-in text-left"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheet.sheetRef}
        style={sheet.sheetStyle}
        {...sheet.sheetHandlers}
        className="w-full max-w-md max-h-[90dvh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 flex flex-col overflow-hidden gm-modal-in"
      >
        <SheetHandle {...sheet.handleHandlers} />

        {/* Cabecera */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/60 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg leading-none">bookmark_add</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                {t("lists.save_to_list_title")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {placeName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#f2f3ff] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label={t("common.close")}
          >
            <span className="material-symbols-outlined text-lg leading-none">close</span>
          </button>
        </div>

        {/* Contenido */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Crear nueva lista al vuelo */}
          <form onSubmit={handleQuickCreate} className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("lists.quick_create_placeholder")}
              className="flex-1 min-w-0 px-3.5 py-2.5 rounded-full text-base sm:text-xs bg-[#f2f3ff] dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
            <button
              type="submit"
              disabled={creating || newName.trim().length < 2}
              className="inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-40 shrink-0"
            >
              <span className="material-symbols-outlined text-sm leading-none">add</span>
              <span>{t("lists.create_short")}</span>
            </button>
          </form>

          {/* Listado de colecciones */}
          {loading ? (
            <div className="space-y-2 py-2">
              <div className="h-12 rounded-2xl gm-shimmer" />
              <div className="h-12 rounded-2xl gm-shimmer" />
            </div>
          ) : lists.length === 0 ? (
            <div className="text-center py-6 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-[#f8f9ff] dark:bg-slate-800/30">
              <span className="material-symbols-outlined text-3xl text-orange-500/60 block mb-1.5">
                bookmarks
              </span>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {t("lists.empty_title")}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t("lists.quick_empty_hint")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {lists.map((l) => {
                const isIn = l.placeIds.includes(placeId);
                const busy = togglingId === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    disabled={busy}
                    onClick={() => handleToggle(l)}
                    className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition cursor-pointer active:scale-[0.99] disabled:opacity-60 ${
                      isIn
                        ? "bg-orange-50/90 dark:bg-orange-950/35 border-orange-400/80 dark:border-orange-700"
                        : "bg-[#f8f9ff] dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-800 hover:border-orange-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base ${
                          isIn
                            ? "bg-orange-600 text-white"
                            : "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-orange-600 dark:text-orange-400"
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg leading-none">
                          {isIn ? "bookmark_added" : "bookmark"}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                            {l.name}
                          </span>
                          {l.isPublic && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold shrink-0">
                              {t("lists.public_badge")}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t("lists.places_count", { count: l.placesCount })}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center border shrink-0 transition ${
                        isIn
                          ? "bg-orange-600 border-orange-600 text-white"
                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                      }`}
                    >
                      {isIn && (
                        <span className="material-symbols-outlined text-sm leading-none">check</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="px-5 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:py-3.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
