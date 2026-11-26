"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  getCopyTargetSpacesAction,
  previewCopyPlacesAction,
  bulkCopyPlacesAction,
  type CopyTargetSpaceOption,
  type CopyConflictPreview,
} from "@/lib/actions/places";
import { useSwipeToClose, SheetHandle } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n/client";

type Strategy = "keep_both" | "replace" | "skip";

interface BulkCopyPlacesModalProps {
  isOpen: boolean;
  placeIds: string[];
  onClose: () => void;
  onCompleted: (result: {
    batchId: string;
    copiedCount: number;
    replacedCount: number;
    skippedCount: number;
    targetLabel: string;
  }) => void;
}

export function BulkCopyPlacesModal({
  isOpen,
  placeIds,
  onClose,
  onCompleted,
}: BulkCopyPlacesModalProps) {
  const { t } = useT();
  const { toast } = useToast();
  const sheet = useSwipeToClose(onClose);
  const [mounted, setMounted] = useState(false);

  const [step, setStep] = useState<1 | 2>(1);
  const [targets, setTargets] = useState<CopyTargetSpaceOption[]>([]);
  const [targetSearch, setTargetSearch] = useState("");
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [checking, setChecking] = useState(false);
  const [executing, setExecuting] = useState(false);

  const [validIds, setValidIds] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<CopyConflictPreview[]>([]);
  const [strategies, setStrategies] = useState<Record<string, Strategy>>({});
  const [moveOriginals, setMoveOriginals] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setSelectedTarget("");
    setTargetSearch("");
    setConflicts([]);
    setValidIds([]);
    setStrategies({});
    setMoveOriginals(false);
    setLoadingTargets(true);
    getCopyTargetSpacesAction()
      .then((list) => setTargets(list))
      .finally(() => setLoadingTargets(false));

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const filteredTargets = useMemo(() => {
    const sorted = [...targets].sort((a, b) =>
      a.label.localeCompare(b.label, "es", { sensitivity: "base" })
    );
    const q = targetSearch.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [targets, targetSearch]);

  if (!isOpen || !mounted) return null;

  async function handlePreview() {
    if (!selectedTarget) return;
    setChecking(true);
    const res = await previewCopyPlacesAction(placeIds, selectedTarget);
    setChecking(false);

    if (res.error) {
      toast(res.error, { kind: "error" });
      return;
    }

    const vIds = res.validIds || [];
    const foundConflicts = res.conflicts || [];
    setValidIds(vIds);
    setConflicts(foundConflicts);

    if (foundConflicts.length === 0) {
      await executeCopy(vIds, [], {});
      return;
    }

    const defaults: Record<string, Strategy> = {};
    for (const c of foundConflicts) {
      defaults[c.placeId] = "keep_both";
    }
    setStrategies(defaults);
    setStep(2);
  }

  async function executeCopy(
    idsToCopy: string[],
    conflictList: CopyConflictPreview[],
    strategyMap: Record<string, Strategy>
  ) {
    setExecuting(true);
    const conflictById = new Map(conflictList.map((c) => [c.placeId, c]));
    const items = idsToCopy.map((id) => {
      const c = conflictById.get(id);
      if (!c) {
        return { placeId: id, strategy: "keep_both" as const };
      }
      return {
        placeId: id,
        strategy: strategyMap[id] || "keep_both",
        conflictWithId: c.existingId,
      };
    });

    const res = await bulkCopyPlacesAction(items, selectedTarget, { moveOriginals });
    setExecuting(false);

    if (res.error) {
      toast(res.error, { kind: "error" });
      return;
    }

    const targetObj = targets.find((x) => x.value === selectedTarget);
    onCompleted({
      batchId: res.batchId || "",
      copiedCount: res.copiedCount || 0,
      replacedCount: res.replacedCount || 0,
      skippedCount: res.skippedCount || 0,
      targetLabel: targetObj ? `${targetObj.icon} ${targetObj.label}` : selectedTarget,
    });
    onClose();
  }

  function applyStrategyToAll(strat: Strategy) {
    const next: Record<string, Strategy> = {};
    for (const c of conflicts) {
      next[c.placeId] = strat;
    }
    setStrategies(next);
  }

  return createPortal(
    <div
      style={sheet.backdropStyle}
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm gm-backdrop-in text-left"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheet.sheetRef}
        style={sheet.sheetStyle}
        {...sheet.sheetHandlers}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[90dvh] overflow-hidden gm-modal-in"
      >
        <SheetHandle {...sheet.handleHandlers} />

        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-orange-600 leading-none">
                library_add
              </span>
              <span>{t("bulk_copy.modal_title", { count: placeIds.length })}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {step === 1 ? t("bulk_copy.step1_subtitle") : t("bulk_copy.step2_subtitle")}
            </p>
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

        <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-4">
          {step === 1 && (
            <>
              {loadingTargets ? (
                <p className="text-xs text-slate-400 text-center py-6">{t("common.loading")}</p>
              ) : targets.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  {t("spaces.copy_no_targets")}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {targets.length > 3 && (
                    <div className="relative">
                      <span className="material-symbols-outlined text-base text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        search
                      </span>
                      <input
                        type="text"
                        value={targetSearch}
                        onChange={(e) => setTargetSearch(e.target.value)}
                        placeholder={t("admin_places.search_space_placeholder")}
                        className="w-full pl-9 pr-8 py-2 rounded-full text-base sm:text-xs bg-[#f2f3ff] dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition"
                      />
                      {targetSearch && (
                        <button
                          type="button"
                          onClick={() => setTargetSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm leading-none">close</span>
                        </button>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                  {filteredTargets.map((opt) => {
                    const active = selectedTarget === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSelectedTarget(opt.value)}
                        className={`w-full p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition cursor-pointer text-left ${
                          active
                            ? "bg-orange-50/80 dark:bg-orange-950/35 border-orange-500 shadow-xs"
                            : "bg-[#f8f9ff] dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700 hover:border-orange-300"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 flex items-center justify-center text-base shrink-0">
                            {opt.icon}
                          </span>
                          <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                            {opt.label}
                          </span>
                        </div>
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                            active
                              ? "bg-orange-600 border-orange-600 text-white"
                              : "border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          {active && (
                            <span className="material-symbols-outlined text-xs leading-none">
                              check
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                  </div>
                </div>
              )}

              {targets.length > 0 && (
                <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#f8f9ff] dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={moveOriginals}
                    onChange={(e) => setMoveOriginals(e.target.checked)}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 w-4 h-4"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {t("bulk_copy.move_toggle")}
                  </span>
                </label>
              )}
            </>
          )}

          {step === 2 && (
            <div className="space-y-3 gm-tab-in">
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">
                  {t("bulk_copy.conflicts_found", { count: conflicts.length })}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { id: "keep_both", label: t("bulk_copy.strategy_keep_both") },
                      { id: "replace", label: t("bulk_copy.strategy_replace") },
                      { id: "skip", label: t("bulk_copy.strategy_skip") },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => applyStrategyToAll(s.id)}
                      className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-[10px] font-bold hover:bg-amber-100 cursor-pointer transition"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {conflicts.map((c) => {
                  const strat = strategies[c.placeId] || "keep_both";
                  return (
                    <div
                      key={c.placeId}
                      className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#f8f9ff] dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                          {c.placeName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {t("bulk_copy.matches_existing", { name: c.existingName })}
                        </div>
                      </div>
                      <select
                        value={strat}
                        onChange={(e) =>
                          setStrategies((prev) => ({
                            ...prev,
                            [c.placeId]: e.target.value as Strategy,
                          }))
                        }
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer shrink-0"
                      >
                        <option value="keep_both">{t("bulk_copy.strategy_keep_both")}</option>
                        <option value="replace">{t("bulk_copy.strategy_replace")}</option>
                        <option value="skip">{t("bulk_copy.strategy_skip")}</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0 bg-white dark:bg-slate-900">
          {step === 2 ? (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-full text-xs font-bold bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                {t("common.back")}
              </button>
              <button
                type="button"
                onClick={() => executeCopy(validIds, conflicts, strategies)}
                disabled={executing}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-extrabold bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                <span>{executing ? t("common.loading") : t("bulk_copy.confirm_btn")}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-bold bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={!selectedTarget || checking || executing}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-extrabold bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                <span>
                  {checking || executing ? t("common.loading") : t("bulk_copy.continue_btn")}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
