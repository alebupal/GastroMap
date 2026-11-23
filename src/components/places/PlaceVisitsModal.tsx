"use client";

import { useState, useEffect } from "react";
import {
  getPlaceVisitsAction,
  addPlaceVisitAction,
  deletePlaceVisitAction,
  type PlaceVisitItem,
} from "@/lib/actions/visits";
import { useT } from "@/lib/i18n/client";

interface PlaceVisitsModalProps {
  placeId: string;
  placeName: string;
  isOpen: boolean;
  onClose: () => void;
  onVisitAdded?: (rating: number | null) => void;
}

export function PlaceVisitsModal({
  placeId,
  placeName,
  isOpen,
  onClose,
  onVisitAdded,
}: PlaceVisitsModalProps) {
  const { t } = useT();
  const [visits, setVisits] = useState<PlaceVisitItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [visitedAt, setVisitedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [rating, setRating] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getPlaceVisitsAction(placeId)
        .then(setVisits)
        .finally(() => setLoading(false));
    }
  }, [isOpen, placeId]);

  if (!isOpen) return null;

  async function handleAddVisit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const parsedRating = rating.trim() === "" ? null : Number(rating);
    const res = await addPlaceVisitAction({
      placeId,
      visitedAt,
      rating: parsedRating,
      notes,
    });
    setSaving(false);

    if (res.error) {
      setError(res.error);
    } else if (res.visit) {
      setVisits((prev) => [res.visit!, ...prev]);
      setNotes("");
      setRating("");
      onVisitAdded?.(parsedRating);
    }
  }

  async function handleDelete(visitId: string) {
    if (!confirm(t("notes_visits.delete_visit_confirm"))) return;
    const res = await deletePlaceVisitAction(visitId);
    if (res.success) {
      setVisits((prev) => prev.filter((v) => v.id !== visitId));
    }
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150 text-left">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>📅</span>
              <span>{t("notes_visits.visits_title")}</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                {visits.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{placeName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm leading-none shrink-0">warning</span>
              <span>{error}</span>
            </div>
          )}

          {/* Formulario de nueva visita */}
          <form
            onSubmit={handleAddVisit}
            className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2.5"
          >
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-orange-600 leading-none">add_circle</span>
              <span>{t("notes_visits.register_visit")}</span>
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  {t("notes_visits.visit_date")}
                </label>
                <input
                  type="date"
                  required
                  value={visitedAt}
                  onChange={(e) => setVisitedAt(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  {t("notes_visits.rating_label")}
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  placeholder="Ej. 8.5"
                  className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notes_visits.visit_notes_placeholder")}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 resize-none focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
            >
              {saving ? t("common.loading") : t("common.save")}
            </button>
          </form>

          {/* Historial */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t("notes_visits.visits_history")}
            </h4>
            {loading ? (
              <div className="space-y-2 py-1" aria-label={t("common.loading")}>
                <div className="h-14 rounded-2xl gm-shimmer" />
                <div className="h-14 rounded-2xl gm-shimmer" />
              </div>
            ) : visits.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-3">
                {t("notes_visits.no_visits_yet")}
              </p>
            ) : (
              visits.map((v) => (
                <div
                  key={v.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <span className="material-symbols-outlined text-sm text-slate-400 leading-none">calendar_today</span>
                        <span>
                          {new Date(v.visitedAt).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </span>
                      {v.rating !== null && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                          <span className="material-symbols-outlined text-xs leading-none">star</span>
                          <span>{v.rating}/10</span>
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id)}
                      className="text-slate-400 hover:text-red-500 text-xs cursor-pointer"
                      title={t("notes_visits.delete_visit_title")}
                    >
                      ✕
                    </button>
                  </div>
                  {v.notes && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {v.notes}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
