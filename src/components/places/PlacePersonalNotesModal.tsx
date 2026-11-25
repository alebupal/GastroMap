"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { setPersonalRatingAction } from "@/lib/actions/interactions";
import { enqueueOfflineMutation } from "@/lib/offlineQueue";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n/client";

interface PlacePersonalNotesModalProps {
  placeId: string;
  placeName: string;
  initialRating?: number | null;
  initialNotes?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (rating: number | null) => void;
}

const QUICK_RATINGS = [5, 6, 7, 8, 9, 10];

export function PlacePersonalNotesModal({
  placeId,
  placeName,
  initialRating = null,
  initialNotes = "",
  isOpen,
  onClose,
  onSave,
}: PlacePersonalNotesModalProps) {
  const { t } = useT();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [rating, setRating] = useState<number | "">(
    initialRating !== null && initialRating !== undefined ? initialRating : ""
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setRating(initialRating !== null && initialRating !== undefined ? initialRating : "");
    }
  }, [isOpen, initialRating]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  async function handleSave() {
    setSaving(true);
    const parsedRating = rating === "" ? null : Number(rating);
    const preservedNotes = initialNotes || "";
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueueOfflineMutation({
        type: "save_personal_notes",
        placeId,
        rating: parsedRating,
        notes: preservedNotes,
      });
      toast(t("offline.queued_toast"), { kind: "info" });
      onSave?.(parsedRating);
      setSaving(false);
      onClose();
      return;
    }
    try {
      await setPersonalRatingAction(placeId, parsedRating);
    } catch {
      await enqueueOfflineMutation({
        type: "save_personal_notes",
        placeId,
        rating: parsedRating,
        notes: preservedNotes,
      });
      toast(t("offline.queued_toast"), { kind: "info" });
    }
    onSave?.(parsedRating);
    setSaving(false);
    onClose();
  }

  const modal = (
    <div
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm gm-backdrop-in text-left"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md max-h-[94dvh] sm:max-h-[90dvh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 flex flex-col overflow-hidden gm-modal-in">
        {/* Cabecera estilo DESIGN.md */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/70 dark:border-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">star</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 tracking-tight truncate">
                {t("notes_visits.personal_notes_title")}
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
        <div className="p-5 sm:p-6 space-y-5">
          {/* Puntuación 0 a 10 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t("notes_visits.rating_label")}
              </label>
              {rating !== "" && (
                <button
                  type="button"
                  onClick={() => setRating("")}
                  className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                >
                  {t("notes_visits.no_rating")}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative w-28 shrink-0">
                <span className="material-symbols-outlined text-base text-amber-500 absolute left-3 top-2.5 pointer-events-none">
                  star
                </span>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={rating}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") setRating("");
                    else {
                      const num = parseFloat(val);
                      if (num >= 0 && num <= 10) setRating(num);
                    }
                  }}
                  placeholder="8.5"
                  className="w-full pl-9 pr-3 py-2 rounded-2xl text-sm bg-[#f8f9ff] dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 font-black text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition"
                />
              </div>
              <span className="text-xs font-bold text-slate-400">/ 10</span>

              {/* Accesos rápidos de nota */}
              <div className="flex items-center gap-1 flex-wrap ml-auto">
                {QUICK_RATINGS.map((val) => {
                  const active = rating === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRating(active ? "" : val)}
                      className={`w-7 h-7 rounded-full text-[11px] font-extrabold transition cursor-pointer ${
                        active
                          ? "bg-amber-500 text-slate-950 shadow-xs"
                          : "bg-[#f2f3ff] dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-950/50"
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-300 font-medium">
            <span className="material-symbols-outlined text-base text-amber-600 shrink-0 leading-none">
              shield
            </span>
            <span>{t("notes_visits.personal_notes_hint")}</span>
          </div>
        </div>

        {/* Pie del modal */}
        <div className="px-5 sm:px-6 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:py-3.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-bold bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-extrabold bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm leading-none">save</span>
            <span>{saving ? t("common.loading") : t("common.save")}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
