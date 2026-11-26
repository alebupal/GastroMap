"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  previewCopyPlacesAction,
  bulkCopyPlacesAction,
  type CopyConflictPreview,
} from "@/lib/actions/places";
import { useSwipeToClose, SheetHandle } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n/client";

export interface CopyTargetSpaceOption {
  id: string; // 'personal' o groupId
  name: string;
  icon: string;
  isPersonal?: boolean;
}

interface CopyPlaceModalProps {
  placeId: string;
  placeName: string;
  currentGroupId: string | null;
  availableSpaces: CopyTargetSpaceOption[];
  isOpen: boolean;
  onClose: () => void;
}

export function CopyPlaceModal({
  placeId,
  placeName,
  currentGroupId,
  availableSpaces,
  isOpen,
  onClose,
}: CopyPlaceModalProps) {
  const { t } = useT();
  const { toast } = useToast();
  const sheet = useSwipeToClose(onClose);
  const [mounted, setMounted] = useState(false);
  const [copyingTo, setCopyingTo] = useState<string | null>(null);
  const [moveOriginal, setMoveOriginal] = useState(false);
  const [targetSearch, setTargetSearch] = useState("");
  const [pendingConflict, setPendingConflict] = useState<{
    target: CopyTargetSpaceOption;
    conflict: CopyConflictPreview;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setTargetSearch("");
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const targets = useMemo(() => {
    return availableSpaces
      .filter((s) => {
        if (s.isPersonal) return currentGroupId !== null;
        return s.id !== currentGroupId;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  }, [availableSpaces, currentGroupId]);

  const filteredTargets = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter((tItem) => tItem.name.toLowerCase().includes(q));
  }, [targets, targetSearch]);

  if (!isOpen || !mounted) return null;

  async function handleCopy(target: CopyTargetSpaceOption) {
    setCopyingTo(target.id);
    const targetSpaceKey = target.isPersonal ? "personal" : target.id;
    const preview = await previewCopyPlacesAction([placeId], targetSpaceKey);

    if (preview.error) {
      setCopyingTo(null);
      toast(preview.error, { kind: "error" });
      return;
    }

    const conflict = preview.conflicts?.[0];
    if (conflict) {
      setCopyingTo(null);
      setPendingConflict({ target, conflict });
      return;
    }

    await executeCopy(target, "keep_both");
  }

  async function executeCopy(
    target: CopyTargetSpaceOption,
    strategy: "replace" | "keep_both",
    conflictWithId?: string
  ) {
    setCopyingTo(target.id);
    const targetSpaceKey = target.isPersonal ? "personal" : target.id;
    const res = await bulkCopyPlacesAction(
      [{ placeId, strategy, conflictWithId }],
      targetSpaceKey,
      { moveOriginals: moveOriginal }
    );
    setCopyingTo(null);

    if (res.error) {
      toast(res.error, { kind: "error" });
    } else {
      toast(t("spaces.copy_success_toast", { space: target.name }), { kind: "success" });
      setPendingConflict(null);
      onClose();
    }
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
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[88dvh] overflow-hidden gm-modal-in"
      >
        <SheetHandle {...sheet.handleHandlers} />

        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-orange-600 leading-none">
                library_add
              </span>
              <span>{t("spaces.copy_modal_title")}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {placeName}
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

        <div className="p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-5 space-y-3 overflow-y-auto">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {t("spaces.copy_modal_desc")}
          </p>

          {targets.length > 0 && !pendingConflict && (
            <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#f8f9ff] dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={moveOriginal}
                onChange={(e) => setMoveOriginal(e.target.checked)}
                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 w-4 h-4"
              />
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {t("bulk_copy.move_toggle")}
              </span>
            </label>
          )}

          {pendingConflict ? (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-3 text-xs gm-tab-in">
              <div className="font-bold text-amber-900 dark:text-amber-200">
                {t("bulk_copy.matches_existing", { name: pendingConflict.conflict.existingName })}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={Boolean(copyingTo)}
                  onClick={() =>
                    executeCopy(
                      pendingConflict.target,
                      "keep_both",
                      pendingConflict.conflict.existingId
                    )
                  }
                  className="px-3.5 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold cursor-pointer transition disabled:opacity-50"
                >
                  {t("bulk_copy.strategy_keep_both")}
                </button>
                <button
                  type="button"
                  disabled={Boolean(copyingTo)}
                  onClick={() =>
                    executeCopy(
                      pendingConflict.target,
                      "replace",
                      pendingConflict.conflict.existingId
                    )
                  }
                  className="px-3.5 py-2 rounded-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-bold hover:bg-amber-100 cursor-pointer transition disabled:opacity-50"
                >
                  {t("bulk_copy.strategy_replace")}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingConflict(null)}
                  className="px-3 py-2 rounded-full text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer transition"
                >
                  {t("common.back")}
                </button>
              </div>
            </div>
          ) : targets.length === 0 ? (
            <div className="p-5 rounded-2xl bg-[#f8f9ff] dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
              {t("spaces.copy_no_targets")}
            </div>
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
                {filteredTargets.map((target) => {
                const busy = copyingTo === target.id;
                return (
                  <button
                    key={target.id}
                    type="button"
                    disabled={Boolean(copyingTo)}
                    onClick={() => handleCopy(target)}
                    className="w-full p-3.5 rounded-2xl bg-[#f8f9ff] hover:bg-orange-50 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700 flex items-center justify-between gap-3 transition cursor-pointer disabled:opacity-50 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 flex items-center justify-center text-base shrink-0">
                        {target.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                          {target.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {target.isPersonal
                            ? t("spaces.personal_subtitle")
                            : t("spaces.group_isolated_copy")}
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-600 text-white text-[11px] font-bold shrink-0">
                      <span className="material-symbols-outlined text-xs leading-none">
                        {busy ? "progress_activity" : "content_copy"}
                      </span>
                      <span>{busy ? "..." : t("spaces.copy_action_btn")}</span>
                    </span>
                  </button>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
