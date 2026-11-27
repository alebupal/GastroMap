"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getMyListsAction,
  getListItemsAction,
  getListCandidatePlacesAction,
  createListAction,
  updateListAction,
  deleteListAction,
  togglePlaceInListAction,
  addPlacesToListAction,
  reorderListItemsAction,
  type UserPlaceListSummary,
  type ListPlaceItemDetail,
  type ListCandidatePlace,
} from "@/lib/actions/lists";
import { copyText } from "@/lib/clipboard";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";
import { useSwipeToClose, SheetHandle } from "@/components/ui/BottomSheet";

interface ListsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ListsModal({ isOpen, onClose }: ListsModalProps) {
  const { t } = useT();
  const { toast } = useToast();
  const sheet = useSwipeToClose(onClose);

  const [lists, setLists] = useState<UserPlaceListSummary[]>([]);
  const [loading, setLoading] = useState(false);

  // Crear nueva lista
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPublic, setNewPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  // Lista desplegada y sus paradas
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsByList, setItemsByList] = useState<Record<string, ListPlaceItemDetail[]>>({});
  const [loadingItemsId, setLoadingItemsId] = useState<string | null>(null);

  // Edición de nombre/descripción
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selector múltiple en lote dentro de una lista
  const [pickerListId, setPickerListId] = useState<string | null>(null);
  const [candidatesByList, setCandidatesByList] = useState<Record<string, ListCandidatePlace[]>>({});
  const [loadingCandidatesId, setLoadingCandidatesId] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCity, setPickerCity] = useState("");
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  const [savingBulkId, setSavingBulkId] = useState<string | null>(null);

  async function loadLists() {
    setLoading(true);
    try {
      const data = await getMyListsAction();
      setLists(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadLists();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const activePickerCandidates = useMemo(() => {
    if (!pickerListId) {
      return {
        cities: [] as string[],
        filtered: [] as ListCandidatePlace[],
        selectableIds: [] as string[],
      };
    }
    const activeList = lists.find((l) => l.id === pickerListId);
    const existingSet = new Set(activeList?.placeIds || []);
    const all = candidatesByList[pickerListId] || [];
    const cities = Array.from(
      new Set(all.map((p) => (p.city || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
    const q = pickerSearch.trim().toLowerCase();
    const filtered = all.filter((p) => {
      if (pickerCity && (p.city || "").trim() !== pickerCity) return false;
      if (q) {
        const hay = `${p.name} ${p.city || ""} ${p.address || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const selectableIds = filtered.filter((p) => !existingSet.has(p.id)).map((p) => p.id);
    return { cities, filtered, selectableIds };
  }, [pickerListId, lists, candidatesByList, pickerSearch, pickerCity]);

  if (!isOpen) return null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    const res = await createListAction({
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      isPublic: newPublic,
    });
    setCreating(false);
    if (res?.error) {
      toast(res.error, { kind: "error" });
      return;
    }
    setNewName("");
    setNewDesc("");
    toast(t("lists.created_toast"), { kind: "success" });
    await loadLists();
  }

  async function handleToggleExpand(listId: string) {
    if (expandedId === listId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(listId);
    setLoadingItemsId(listId);
    try {
      const items = await getListItemsAction(listId);
      setItemsByList((prev) => ({ ...prev, [listId]: items }));
    } finally {
      setLoadingItemsId(null);
    }
  }

  async function handleTogglePublic(list: UserPlaceListSummary) {
    const res = await updateListAction(list.id, { isPublic: !list.isPublic });
    if (res?.error) {
      toast(res.error, { kind: "error" });
      return;
    }
    const updated = res.list;
    if (updated) {
      setLists((prev) =>
        prev.map((l) =>
          l.id === list.id
            ? { ...l, isPublic: updated.isPublic, shareSlug: updated.shareSlug }
            : l
        )
      );
      toast(
        updated.isPublic ? t("lists.made_public_toast") : t("lists.made_private_toast"),
        { kind: "success" }
      );
    }
  }

  async function handleSaveEdit(listId: string) {
    if (!editName.trim()) return;
    const res = await updateListAction(listId, {
      name: editName.trim(),
      description: editDesc.trim() || null,
    });
    if (res?.error) {
      toast(res.error, { kind: "error" });
      return;
    }
    setEditingId(null);
    toast(t("lists.updated_toast"), { kind: "success" });
    await loadLists();
  }

  async function handleDelete(list: UserPlaceListSummary) {
    if (!confirm(t("lists.delete_confirm", { name: list.name }))) return;
    const res = await deleteListAction(list.id);
    if (res?.error) {
      toast(res.error, { kind: "error" });
      return;
    }
    setLists((prev) => prev.filter((l) => l.id !== list.id));
    if (expandedId === list.id) setExpandedId(null);
    toast(t("lists.deleted_toast", { name: list.name }), { kind: "success" });
  }

  async function handleRemovePlace(listId: string, placeId: string) {
    const res = await togglePlaceInListAction(listId, placeId);
    if (res?.error) {
      toast(res.error, { kind: "error" });
      return;
    }
    setItemsByList((prev) => ({
      ...prev,
      [listId]: (prev[listId] || []).filter((item) => item.placeId !== placeId),
    }));
    setLists((prev) =>
      prev.map((l) => {
        if (l.id !== listId) return l;
        const nextIds = l.placeIds.filter((id) => id !== placeId);
        return { ...l, placeIds: nextIds, placesCount: nextIds.length };
      })
    );
  }

  async function handleMoveItem(listId: string, index: number, direction: -1 | 1) {
    const items = itemsByList[listId] || [];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setItemsByList((prev) => ({ ...prev, [listId]: next }));
    await reorderListItemsAction(
      listId,
      next.map((i) => i.placeId)
    );
  }

  function getGuideUrl(slug: string) {
    if (typeof window === "undefined") return `/guide/${slug}`;
    return `${window.location.origin}/guide/${slug}`;
  }

  async function handleCopyShareLink(list: UserPlaceListSummary) {
    if (!list.shareSlug) return;
    const ok = await copyText(getGuideUrl(list.shareSlug));
    if (ok) {
      setCopiedId(list.id);
      toast(t("lists.link_copied_toast"), { kind: "success" });
      setTimeout(() => setCopiedId(null), 2200);
    }
  }

  function handleShareWhatsApp(list: UserPlaceListSummary) {
    if (!list.shareSlug) return;
    const url = getGuideUrl(list.shareSlug);
    const text = `${list.name}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function handleOpenBulkPicker(listId: string) {
    if (pickerListId === listId) {
      setPickerListId(null);
      return;
    }
    setPickerListId(listId);
    setPickerSearch("");
    setPickerCity("");
    setPickerSelected(new Set());
    if (!candidatesByList[listId]) {
      setLoadingCandidatesId(listId);
      try {
        const candidates = await getListCandidatePlacesAction(listId);
        setCandidatesByList((prev) => ({ ...prev, [listId]: candidates }));
      } finally {
        setLoadingCandidatesId(null);
      }
    }
  }

  async function handleConfirmBulkPicker(list: UserPlaceListSummary) {
    const ids = Array.from(pickerSelected);
    if (ids.length === 0 || savingBulkId) return;
    setSavingBulkId(list.id);
    const res = await addPlacesToListAction(list.id, ids);
    setSavingBulkId(null);
    if (res?.error) {
      toast(res.error, { kind: "error" });
      return;
    }
    const addedCount = res.addedCount ?? 0;
    const skippedCount = res.skippedCount ?? 0;
    if (addedCount === 0) {
      toast(t("lists.bulk_already_all_toast", { name: list.name }), { kind: "info" });
    } else if (skippedCount > 0) {
      toast(
        t("lists.bulk_added_with_skipped_toast", {
          added: String(addedCount),
          name: list.name,
          skipped: String(skippedCount),
        }),
        { kind: "success" }
      );
    } else {
      toast(
        t("lists.bulk_added_toast", {
          added: String(addedCount),
          name: list.name,
        }),
        { kind: "success" }
      );
    }
    setPickerListId(null);
    setPickerSelected(new Set());
    const [freshItems] = await Promise.all([getListItemsAction(list.id), loadLists()]);
    setItemsByList((prev) => ({ ...prev, [list.id]: freshItems }));
  }

  return (
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
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[94dvh] sm:max-h-[90dvh] overflow-hidden gm-modal-in"
      >
        <SheetHandle {...sheet.handleHandlers} />

        {/* Cabecera */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/60 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl leading-none">bookmarks</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100 tracking-tight truncate">
                {t("lists.title")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {t("lists.subtitle")}
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

        {/* Contenido scrollable */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Formulario nueva guía */}
          <form
            onSubmit={handleCreate}
            className="p-3.5 rounded-2xl bg-[#f8f9ff] dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-2.5"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("lists.name_placeholder")}
              className="w-full px-3.5 py-2.5 rounded-xl text-base sm:text-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 font-semibold"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder={t("lists.desc_placeholder")}
              className="w-full px-3.5 py-2 rounded-xl text-base sm:text-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newPublic}
                  onChange={(e) => setNewPublic(e.target.checked)}
                  className="rounded accent-orange-600 w-4 h-4"
                />
                <span>{t("lists.public_toggle_label")}</span>
              </label>

              <button
                type="submit"
                disabled={creating || newName.trim().length < 2}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-sm leading-none">add</span>
                <span>{creating ? t("common.loading") : t("lists.create_btn")}</span>
              </button>
            </div>
          </form>

          {/* Listado de guías */}
          {loading ? (
            <div className="space-y-2.5 py-2">
              <div className="h-20 rounded-2xl gm-shimmer" />
              <div className="h-20 rounded-2xl gm-shimmer" />
            </div>
          ) : lists.length === 0 ? (
            <div className="text-center py-10 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-[#f8f9ff] dark:bg-slate-800/30">
              <span className="material-symbols-outlined text-4xl text-orange-500/60 block mb-2">
                auto_stories
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {t("lists.empty_title")}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                {t("lists.empty_desc")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {lists.map((l) => {
                const isExpanded = expandedId === l.id;
                const isEditing = editingId === l.id;
                const items = itemsByList[l.id] || [];
                const isCopied = copiedId === l.id;

                return (
                  <div
                    key={l.id}
                    className="p-4 rounded-2xl bg-[#f8f9ff] dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-3"
                  >
                    {/* Cabecera de la lista */}
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                          className="w-full px-3 py-2 rounded-xl text-base sm:text-xs bg-white dark:bg-slate-900 border border-orange-500 text-slate-900 dark:text-slate-100 font-bold focus:outline-none"
                        />
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder={t("lists.desc_placeholder")}
                          className="w-full px-3 py-2 rounded-xl text-base sm:text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            {t("common.cancel")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(l.id)}
                            className="px-4 py-1.5 rounded-full text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white cursor-pointer"
                          >
                            {t("common.save")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleExpand(l.id)}
                          className="flex items-start gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <div className="w-9 h-9 rounded-xl bg-orange-100/90 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-lg leading-none">
                              {l.isPublic ? "public" : "bookmark"}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                                {l.name}
                              </h4>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  l.isPublic
                                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                    : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                }`}
                              >
                                {l.isPublic ? t("lists.public_badge") : t("lists.private_badge")}
                              </span>
                            </div>
                            {l.description && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                {l.description}
                              </p>
                            )}
                            <p className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 mt-1 inline-flex items-center gap-1">
                              <span>{t("lists.places_count", { count: l.placesCount })}</span>
                              <span className="material-symbols-outlined text-sm leading-none">
                                {isExpanded ? "expand_less" : "expand_more"}
                              </span>
                            </p>
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(l.id);
                              setEditName(l.name);
                              setEditDesc(l.description || "");
                            }}
                            className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-slate-700 rounded-full transition cursor-pointer"
                            title={t("common.edit")}
                          >
                            <span className="material-symbols-outlined text-base leading-none">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(l)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition cursor-pointer"
                            title={t("common.delete")}
                          >
                            <span className="material-symbols-outlined text-base leading-none">delete</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Barra de enlace público y acciones rápidas */}
                    <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleTogglePublic(l)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-orange-600 cursor-pointer transition"
                      >
                        <span className="material-symbols-outlined text-sm leading-none">
                          {l.isPublic ? "link_off" : "link"}
                        </span>
                        <span>
                          {l.isPublic ? t("lists.disable_public_link") : t("lists.enable_public_link")}
                        </span>
                      </button>

                      {l.isPublic && l.shareSlug && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <a
                            href={`/guide/${l.shareSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-orange-400 text-[11px] font-bold transition"
                          >
                            <span className="material-symbols-outlined text-sm leading-none">open_in_new</span>
                            <span>{t("lists.open_guide")}</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyShareLink(l)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                              isCopied
                                ? "bg-emerald-600 text-white"
                                : "bg-orange-600 hover:bg-orange-700 text-white"
                            }`}
                          >
                            <span className="material-symbols-outlined text-sm leading-none">
                              {isCopied ? "check" : "content_copy"}
                            </span>
                            <span>{isCopied ? t("common.copied") : t("lists.copy_link")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShareWhatsApp(l)}
                            className="inline-flex items-center justify-center p-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition cursor-pointer"
                            title="WhatsApp"
                            aria-label="WhatsApp"
                          >
                            <span className="material-symbols-outlined text-sm leading-none">chat</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Paradas desplegadas */}
                    {isExpanded && (
                      <div className="pt-2 space-y-2">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => handleOpenBulkPicker(l.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                              pickerListId === l.id
                                ? "bg-indigo-600 text-white"
                                : "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 hover:bg-indigo-100"
                            }`}
                          >
                            <span className="material-symbols-outlined text-sm leading-none">
                              {pickerListId === l.id ? "close" : "playlist_add"}
                            </span>
                            <span>{t("lists.bulk_picker_open")}</span>
                          </button>
                        </div>

                        {pickerListId === l.id && (
                          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-900/60 space-y-2.5">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                value={pickerSearch}
                                onChange={(e) => setPickerSearch(e.target.value)}
                                placeholder={t("lists.bulk_picker_search")}
                                className="flex-1 px-3 py-1.5 rounded-xl text-base sm:text-xs bg-[#f8f9ff] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              {activePickerCandidates.cities.length > 0 && (
                                <select
                                  value={pickerCity}
                                  onChange={(e) => setPickerCity(e.target.value)}
                                  className="px-2.5 py-1.5 rounded-xl text-base sm:text-xs bg-[#f8f9ff] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none"
                                >
                                  <option value="">{t("lists.bulk_picker_all_cities")}</option>
                                  {activePickerCandidates.cities.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            {loadingCandidatesId === l.id ? (
                              <div className="h-20 rounded-xl gm-shimmer" />
                            ) : activePickerCandidates.filtered.length === 0 ? (
                              <p className="text-[11px] text-slate-400 text-center py-2">
                                {t("lists.bulk_picker_empty")}
                              </p>
                            ) : (
                              <>
                                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                                  <button
                                    type="button"
                                    disabled={activePickerCandidates.selectableIds.length === 0}
                                    onClick={() =>
                                      setPickerSelected(new Set(activePickerCandidates.selectableIds))
                                    }
                                    className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer disabled:opacity-40"
                                  >
                                    {t("lists.bulk_picker_select_visible", {
                                      count: String(activePickerCandidates.selectableIds.length),
                                    })}
                                  </button>
                                  {pickerSelected.size > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setPickerSelected(new Set())}
                                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                      {t("lists.bulk_picker_clear")}
                                    </button>
                                  )}
                                </div>

                                <div className="max-h-44 overflow-y-auto space-y-1 pr-0.5">
                                  {activePickerCandidates.filtered.map((cand) => {
                                    const alreadyIn = l.placeIds.includes(cand.id);
                                    const checked = alreadyIn || pickerSelected.has(cand.id);
                                    return (
                                      <label
                                        key={cand.id}
                                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs ${
                                          alreadyIn
                                            ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-800 opacity-60 cursor-not-allowed"
                                            : "bg-[#f8f9ff] dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700 cursor-pointer hover:border-indigo-300"
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          disabled={alreadyIn}
                                          checked={checked}
                                          onChange={() => {
                                            setPickerSelected((prev) => {
                                              const next = new Set(prev);
                                              if (next.has(cand.id)) next.delete(cand.id);
                                              else next.add(cand.id);
                                              return next;
                                            });
                                          }}
                                          className="rounded accent-indigo-600 w-3.5 h-3.5 shrink-0"
                                        />
                                        <span className="font-semibold text-slate-800 dark:text-slate-100 truncate flex-1">
                                          {cand.name}
                                        </span>
                                        {cand.city && (
                                          <span className="text-[10px] text-slate-400 truncate max-w-[100px]">
                                            {cand.city}
                                          </span>
                                        )}
                                        {alreadyIn && (
                                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                            {t("lists.bulk_picker_already_in")}
                                          </span>
                                        )}
                                      </label>
                                    );
                                  })}
                                </div>

                                <div className="flex justify-end pt-1">
                                  <button
                                    type="button"
                                    disabled={pickerSelected.size === 0 || savingBulkId === l.id}
                                    onClick={() => handleConfirmBulkPicker(l)}
                                    className="px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-40"
                                  >
                                    {savingBulkId === l.id
                                      ? t("common.loading")
                                      : t("lists.bulk_picker_add_selected", {
                                          count: String(pickerSelected.size),
                                        })}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {loadingItemsId === l.id ? (
                          <div className="h-12 rounded-xl gm-shimmer" />
                        ) : items.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic text-center py-2">
                            {t("lists.no_places_in_list")}
                          </p>
                        ) : (
                          items.map((item, idx) => (
                            <div
                              key={item.itemId}
                              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/80 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 text-[11px] font-black flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {item.name}
                                  </div>
                                  {item.city && (
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {item.city}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveItem(l.id, idx, -1)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 cursor-pointer"
                                  aria-label="Subir"
                                >
                                  <span className="material-symbols-outlined text-sm leading-none">
                                    arrow_upward
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === items.length - 1}
                                  onClick={() => handleMoveItem(l.id, idx, 1)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 cursor-pointer"
                                  aria-label="Bajar"
                                >
                                  <span className="material-symbols-outlined text-sm leading-none">
                                    arrow_downward
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePlace(l.id, item.placeId)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title={t("lists.remove_place")}
                                >
                                  <span className="material-symbols-outlined text-sm leading-none">
                                    close
                                  </span>
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="px-5 sm:px-6 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:py-3.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end shrink-0">
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
}
