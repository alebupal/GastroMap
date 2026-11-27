"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getMyListsAction,
  createListAction,
  addPlacesToListAction,
  type UserPlaceListSummary,
} from "@/lib/actions/lists";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";
import { copyText } from "@/lib/clipboard";
import { useSwipeToClose, SheetHandle } from "@/components/ui/BottomSheet";

export interface BulkListPlaceItem {
  id: string;
  name: string;
  city?: string | null;
}

interface BulkAddToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  places: BulkListPlaceItem[];
  suggestedListName?: string;
}

export function BulkAddToListModal({
  isOpen,
  onClose,
  places,
  suggestedListName = "",
}: BulkAddToListModalProps) {
  const { t } = useT();
  const { toast } = useToast();
  const sheet = useSwipeToClose(onClose);

  const [lists, setLists] = useState<UserPlaceListSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(places.map((p) => p.id)));
  const [showPicker, setShowPicker] = useState(false);

  // Crear nueva lista al vuelo
  const [newName, setNewName] = useState(suggestedListName);
  const [newPublic, setNewPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  // Resultado final con acceso directo a la guía compartida
  const [doneResult, setDoneResult] = useState<{
    listName: string;
    shareSlug: string | null;
    addedCount: number;
    skippedCount: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(new Set(places.map((p) => p.id)));
    setShowPicker(false);
    setDoneResult(null);
    setNewName(suggestedListName);
    setLoading(true);
    getMyListsAction()
      .then(setLists)
      .finally(() => setLoading(false));
  }, [isOpen, places, suggestedListName]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const targetIds = useMemo(() => Array.from(selectedIds), [selectedIds]);

  if (!isOpen) return null;

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function showResultToast(
    listName: string,
    addedCount: number,
    skippedCount: number
  ) {
    if (addedCount === 0) {
      toast(t("lists.bulk_already_all_toast", { name: listName }), { kind: "info" });
    } else if (skippedCount > 0) {
      toast(
        t("lists.bulk_added_with_skipped_toast", {
          added: String(addedCount),
          name: listName,
          skipped: String(skippedCount),
        }),
        { kind: "success" }
      );
    } else {
      toast(
        t("lists.bulk_added_toast", {
          added: String(addedCount),
          name: listName,
        }),
        { kind: "success" }
      );
    }
  }

  async function handleAddToExisting(list: UserPlaceListSummary) {
    if (savingId || targetIds.length === 0) return;
    setSavingId(list.id);
    const res = await addPlacesToListAction(list.id, targetIds);
    setSavingId(null);
    if (res?.error) {
      toast(res.error, { kind: "error" });
      return;
    }
    const addedCount = res.addedCount ?? 0;
    const skippedCount = res.skippedCount ?? 0;
    showResultToast(list.name, addedCount, skippedCount);
    setDoneResult({
      listName: list.name,
      shareSlug: list.isPublic ? list.shareSlug : null,
      addedCount,
      skippedCount,
    });
  }

  async function handleCreateAndAdd(e: React.FormEvent) {
    e.preventDefault();
    const clean = newName.trim();
    if (!clean || creating || targetIds.length === 0) return;
    setCreating(true);
    const created = await createListAction({
      name: clean,
      isPublic: newPublic,
    });
    if (created?.error || !created.list) {
      setCreating(false);
      toast(created?.error || "Error", { kind: "error" });
      return;
    }

    const res = await addPlacesToListAction(created.list.id, targetIds);
    setCreating(false);
    if (res?.error) {
      toast(res.error, { kind: "error" });
      return;
    }
    const addedCount = res.addedCount ?? 0;
    const skippedCount = res.skippedCount ?? 0;
    showResultToast(created.list.name, addedCount, skippedCount);
    setDoneResult({
      listName: created.list.name,
      shareSlug: created.list.isPublic ? created.list.shareSlug : null,
      addedCount,
      skippedCount,
    });
  }

  async function handleCopyGuideLink(slug: string) {
    const url = `${window.location.origin}/guide/${slug}`;
    const ok = await copyText(url);
    if (ok) {
      toast(t("lists.link_copied_toast"), { kind: "success" });
    }
  }

  return (
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
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90dvh] gm-modal-in"
      >
        <SheetHandle {...sheet.handleHandlers} />

        {/* Cabecera */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
              {t("lists.bulk_modal_title")}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {t("lists.bulk_modal_subtitle", { count: String(targetIds.length) })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-slate-500 flex items-center justify-center cursor-pointer shrink-0"
            aria-label={t("common.close")}
          >
            <span className="material-symbols-outlined text-base leading-none">close</span>
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {doneResult ? (
            <div className="py-4 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl leading-none">check_circle</span>
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                  {doneResult.listName}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {doneResult.addedCount === 0
                    ? t("lists.bulk_already_all_toast", { name: doneResult.listName })
                    : doneResult.skippedCount > 0
                    ? t("lists.bulk_added_with_skipped_toast", {
                        added: String(doneResult.addedCount),
                        name: doneResult.listName,
                        skipped: String(doneResult.skippedCount),
                      })
                    : t("lists.bulk_added_toast", {
                        added: String(doneResult.addedCount),
                        name: doneResult.listName,
                      })}
                </p>
              </div>
              {doneResult.shareSlug && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCopyGuideLink(doneResult.shareSlug!)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer transition"
                  >
                    <span className="material-symbols-outlined text-sm leading-none">content_copy</span>
                    <span>{t("lists.copy_link")}</span>
                  </button>
                  <a
                    href={`/guide/${doneResult.shareSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 transition"
                  >
                    <span className="material-symbols-outlined text-sm leading-none">open_in_new</span>
                    <span>{t("lists.open_guide")}</span>
                  </a>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Ajuste opcional de selección */}
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-[#f8f9ff] dark:bg-slate-800/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPicker((v) => !v)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/70 transition"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm leading-none text-orange-600">
                      checklist
                    </span>
                    <span>
                      {t("lists.bulk_select_places_toggle", {
                        selected: String(targetIds.length),
                        total: String(places.length),
                      })}
                    </span>
                  </span>
                  <span className="material-symbols-outlined text-base leading-none text-slate-400">
                    {showPicker ? "expand_less" : "expand_more"}
                  </span>
                </button>

                {showPicker && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1.5 max-h-44 overflow-y-auto">
                    <div className="flex items-center justify-between gap-2 pb-1 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setSelectedIds(new Set(places.map((p) => p.id)))}
                        className="text-orange-600 hover:underline cursor-pointer"
                      >
                        {t("lists.bulk_picker_select_visible", { count: String(places.length) })}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedIds(new Set())}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {t("lists.bulk_picker_clear")}
                      </button>
                    </div>
                    {places.map((p) => {
                      const checked = selectedIds.has(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOne(p.id)}
                            className="rounded accent-orange-600 w-3.5 h-3.5 shrink-0"
                          />
                          <span className="font-semibold text-slate-800 dark:text-slate-100 truncate flex-1">
                            {p.name}
                          </span>
                          {p.city && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[110px]">
                              {p.city}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Crear lista nueva al vuelo */}
              <form
                onSubmit={handleCreateAndAdd}
                className="p-3 rounded-2xl bg-[#f8f9ff] dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-2.5"
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("lists.bulk_or_create")}
                </p>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("lists.quick_create_placeholder")}
                  className="w-full px-3 py-2 rounded-xl text-base sm:text-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 font-semibold"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newPublic}
                      onChange={(e) => setNewPublic(e.target.checked)}
                      className="rounded accent-orange-600 w-3.5 h-3.5"
                    />
                    <span>{t("lists.public_badge")}</span>
                  </label>
                  <button
                    type="submit"
                    disabled={creating || newName.trim().length < 2 || targetIds.length === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-sm leading-none">add</span>
                    <span>
                      {creating
                        ? t("common.loading")
                        : t("lists.bulk_create_and_add", { count: String(targetIds.length) })}
                    </span>
                  </button>
                </div>
              </form>

              {/* Listas existentes */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("lists.bulk_choose_existing")}
                </p>
                {loading ? (
                  <div className="space-y-2">
                    <div className="h-12 rounded-2xl gm-shimmer" />
                    <div className="h-12 rounded-2xl gm-shimmer" />
                  </div>
                ) : lists.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">
                    {t("lists.quick_empty_hint")}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {lists.map((l) => {
                      const existingSet = new Set(l.placeIds);
                      const pendingCount = targetIds.filter((id) => !existingSet.has(id)).length;
                      const isSaving = savingId === l.id;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          disabled={Boolean(savingId) || targetIds.length === 0}
                          onClick={() => handleAddToExisting(l)}
                          className="w-full p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-orange-400 hover:bg-orange-50/40 dark:hover:bg-orange-950/20 flex items-center justify-between gap-2 text-left transition cursor-pointer disabled:opacity-50"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="material-symbols-outlined text-base text-orange-600 shrink-0 leading-none">
                              {l.isPublic ? "public" : "bookmark"}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {l.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {t("lists.places_count", { count: String(l.placesCount) })}
                                {pendingCount > 0 ? ` · +${pendingCount}` : ""}
                              </div>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 text-[11px] font-bold shrink-0">
                            {isSaving ? "..." : pendingCount > 0 ? `+${pendingCount}` : "✓"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-5 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
