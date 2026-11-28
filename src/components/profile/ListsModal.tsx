"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getMyListsAction,
  getListItemsAction,
  getListEditorDataAction,
  createListAction,
  updateListAction,
  deleteListAction,
  togglePlaceInListAction,
  syncListPlacesAction,
  reorderListItemsAction,
  type UserPlaceListSummary,
  type ListPlaceItemDetail,
  type ListEditorData,
} from "@/lib/actions/lists";
import {
  hasActiveListFilters,
  matchesListFilterCriteria,
  summarizeListFilterCriteria,
  type ListFilterCriteria,
} from "@/lib/list-filters";
import { resolveFilterCity, parseCityCountry } from "@/lib/location";
import { OccasionIcon } from "@/components/ui/OccasionIcon";
import { copyText } from "@/lib/clipboard";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";
import { useSwipeToClose, SheetHandle } from "@/components/ui/BottomSheet";

interface ListsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRICE_OPTIONS = ["€", "€€", "€€€", "€€€€"];

export function ListsModal({ isOpen, onClose }: ListsModalProps) {
  const { t } = useT();
  const { toast } = useToast();
  const sheet = useSwipeToClose(onClose);

  const [lists, setLists] = useState<UserPlaceListSummary[]>([]);
  const [loading, setLoading] = useState(false);

  // Crear nueva lista manual básica
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

  // Datos compartidos del editor (candidatos + taxonomía del espacio)
  const [editorDataByList, setEditorDataByList] = useState<Record<string, ListEditorData>>({});
  const [loadingEditorId, setLoadingEditorId] = useState<string | null>(null);

  // Modo 1: Tabla de administración masiva (añadir/quitar varios a la vez)
  const [tableListId, setTableListId] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [tableCity, setTableCity] = useState("");
  const [tableOccasion, setTableOccasion] = useState("");
  const [tableStatus, setTableStatus] = useState<"all" | "in" | "out">("all");
  const [draftSelectedIds, setDraftSelectedIds] = useState<Set<string>>(new Set());
  const [savingTableId, setSavingTableId] = useState<string | null>(null);

  // Modo 2: Editor de filtros de autolista
  const [filterListId, setFilterListId] = useState<string | null>(null);
  const [draftIsAuto, setDraftIsAuto] = useState(false);
  const [draftCriteria, setDraftCriteria] = useState<ListFilterCriteria>({});
  const [savingFilterId, setSavingFilterId] = useState<string | null>(null);

  async function loadLists() {
    setLoading(true);
    try {
      const data = await getMyListsAction();
      setLists(data);
    } finally {
      setLoading(false);
    }
  }

  async function ensureEditorData(listId: string): Promise<ListEditorData | null> {
    if (editorDataByList[listId]) return editorDataByList[listId];
    setLoadingEditorId(listId);
    try {
      const data = await getListEditorDataAction(listId);
      if (data) {
        setEditorDataByList((prev) => ({ ...prev, [listId]: data }));
      }
      return data;
    } finally {
      setLoadingEditorId(null);
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

  const activeTableView = useMemo(() => {
    if (!tableListId) return null;
    const list = lists.find((l) => l.id === tableListId);
    const data = editorDataByList[tableListId];
    if (!list || !data) return null;

    const savedSet = new Set(list.placeIds);
    const q = tableSearch.trim().toLowerCase();

    const rows = data.candidates.filter((p) => {
      const isSaved = savedSet.has(p.id);
      if (tableStatus === "in" && !isSaved) return false;
      if (tableStatus === "out" && isSaved) return false;
      if (tableCity && resolveFilterCity(p.city, p.address, p.country) !== tableCity) return false;
      if (tableOccasion && !p.occasions.includes(tableOccasion)) return false;
      if (q) {
        const hay = `${p.name} ${p.city || ""} ${p.address || ""} ${p.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    let addCount = 0;
    let remCount = 0;
    for (const id of draftSelectedIds) {
      if (!savedSet.has(id)) addCount++;
    }
    for (const id of savedSet) {
      if (!draftSelectedIds.has(id)) remCount++;
    }

    return { list, data, rows, savedSet, addCount, remCount };
  }, [
    tableListId,
    lists,
    editorDataByList,
    tableSearch,
    tableCity,
    tableOccasion,
    tableStatus,
    draftSelectedIds,
  ]);

  const activeFilterPreviewCount = useMemo(() => {
    if (!filterListId) return 0;
    const data = editorDataByList[filterListId];
    if (!data || !hasActiveListFilters(draftCriteria)) return 0;
    return data.candidates.filter((p) =>
      matchesListFilterCriteria(
        {
          name: p.name,
          city: p.city,
          country: p.country,
          address: p.address,
          priceRange: p.priceRange,
          occasions: p.occasions,
          tags: p.tags,
        },
        draftCriteria
      )
    ).length;
  }, [filterListId, editorDataByList, draftCriteria]);

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
      setTableListId(null);
      setFilterListId(null);
      return;
    }
    setExpandedId(listId);
    setTableListId(null);
    setFilterListId(null);
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

  async function handleOpenTable(list: UserPlaceListSummary) {
    if (tableListId === list.id) {
      setTableListId(null);
      return;
    }
    setFilterListId(null);
    setTableListId(list.id);
    setTableSearch("");
    setTableCity("");
    setTableOccasion("");
    setTableStatus("all");
    setDraftSelectedIds(new Set(list.placeIds));
    await ensureEditorData(list.id);
  }

  async function handleSaveTable(list: UserPlaceListSummary) {
    if (savingTableId) return;
    setSavingTableId(list.id);
    const res = await syncListPlacesAction(list.id, Array.from(draftSelectedIds));
    setSavingTableId(null);
    if (res?.error) {
      toast(res.error, { kind: "error" });
      return;
    }
    toast(
      t("lists.table_saved_toast", {
        add: String(res.addedCount ?? 0),
        rem: String(res.removedCount ?? 0),
      }),
      { kind: "success" }
    );
    setTableListId(null);
    const [freshItems] = await Promise.all([getListItemsAction(list.id), loadLists()]);
    setItemsByList((prev) => ({ ...prev, [list.id]: freshItems }));
  }

  async function handleOpenFilterEditor(list: UserPlaceListSummary) {
    if (filterListId === list.id) {
      setFilterListId(null);
      return;
    }
    setTableListId(null);
    setFilterListId(list.id);
    setDraftIsAuto(list.isAuto);
    setDraftCriteria(list.filterCriteria || {});
    await ensureEditorData(list.id);
  }

  function toggleCriteriaItem(
    key: "selectedCities" | "selectedCountries" | "selectedOccasions" | "selectedTags" | "selectedPrices",
    value: string
  ) {
    setDraftCriteria((prev) => {
      const current = prev[key] || [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  }

  async function handleSaveFilterConfig(list: UserPlaceListSummary) {
    if (draftIsAuto && !hasActiveListFilters(draftCriteria)) {
      toast(t("lists.filter_no_criteria_error"), { kind: "error" });
      return;
    }
    setSavingFilterId(list.id);
    const res = await updateListAction(list.id, {
      isAuto: draftIsAuto,
      filterCriteria: draftCriteria,
    });
    setSavingFilterId(null);
    if (res?.error) {
      toast(res.error, { kind: "error" });
      return;
    }
    toast(t("lists.filters_saved_toast"), { kind: "success" });
    setFilterListId(null);
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
        className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[94dvh] sm:max-h-[90dvh] overflow-hidden gm-modal-in"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("lists.name_placeholder")}
                className="w-full px-3.5 py-2 rounded-xl text-base sm:text-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 font-semibold"
              />
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder={t("lists.desc_placeholder")}
                className="w-full px-3.5 py-2 rounded-xl text-base sm:text-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
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
                const criteriaChips = l.isAuto ? summarizeListFilterCriteria(l.filterCriteria) : [];
                const isTableOpen = tableListId === l.id;
                const isFilterOpen = filterListId === l.id;
                const editorData = editorDataByList[l.id];

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
                              {l.isAuto ? "bolt" : l.isPublic ? "public" : "bookmark"}
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
                              {l.isAuto && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                                  <span className="material-symbols-outlined text-[11px] leading-none">
                                    bolt
                                  </span>
                                  <span>{t("lists.auto_badge")}</span>
                                </span>
                              )}
                              <span className="text-[11px] font-semibold text-slate-400">
                                · {t("lists.places_count", { count: String(l.placesCount) })}
                              </span>
                            </div>
                            {l.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                {l.description}
                              </p>
                            )}
                            {criteriaChips.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {criteriaChips.map((chip) => (
                                  <span
                                    key={chip}
                                    className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-indigo-200/70 dark:border-indigo-800/60 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300"
                                  >
                                    {chip}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </button>

                        {l.canManage && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(l.id);
                                setEditName(l.name);
                                setEditDesc(l.description || "");
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-white dark:hover:bg-slate-900 transition cursor-pointer"
                              title={t("common.edit")}
                            >
                              <span className="material-symbols-outlined text-base leading-none">
                                edit
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(l)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-900 transition cursor-pointer"
                              title={t("common.delete")}
                            >
                              <span className="material-symbols-outlined text-base leading-none">
                                delete
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Barra de acciones públicas / enlace */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/50">
                      <button
                        type="button"
                        onClick={() => handleTogglePublic(l)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-orange-600 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base leading-none">
                          {l.isPublic ? "lock" : "public"}
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
                            <span className="material-symbols-outlined text-sm leading-none">
                              open_in_new
                            </span>
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
                            title={t("lists.share_guide")}
                            aria-label={t("lists.share_guide")}
                          >
                            <span className="material-symbols-outlined text-sm leading-none">
                              share
                            </span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Paradas y herramientas avanzadas desplegadas */}
                    {isExpanded && (
                      <div className="pt-2 space-y-2.5">
                        {l.canManage && (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {!l.isAuto && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenTable(l)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                                    isTableOpen
                                      ? "bg-orange-600 text-white"
                                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-orange-400"
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-sm leading-none">
                                    table_chart
                                  </span>
                                  <span>{t("lists.table_manage_btn")}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenFilterEditor(l)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                                  isFilterOpen
                                    ? "bg-indigo-600 text-white"
                                    : "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 hover:bg-indigo-100"
                                }`}
                              >
                                <span className="material-symbols-outlined text-sm leading-none">
                                  tune
                                </span>
                                <span>{t("lists.edit_filters_btn")}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* PANEL 1: Editor de filtros de autolista */}
                        {isFilterOpen && (
                          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-900/60 space-y-3">
                            {/* Selector de modo: Autoalimentada vs Manual */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                              <div className="inline-flex p-1 rounded-full bg-[#f2f3ff] dark:bg-slate-800 gap-1">
                                <button
                                  type="button"
                                  onClick={() => setDraftIsAuto(true)}
                                  className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer inline-flex items-center gap-1 ${
                                    draftIsAuto
                                      ? "bg-indigo-600 text-white shadow-xs"
                                      : "text-slate-600 dark:text-slate-300"
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-xs leading-none">
                                    bolt
                                  </span>
                                  <span>{t("lists.mode_auto")}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDraftIsAuto(false)}
                                  className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                                    !draftIsAuto
                                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                                      : "text-slate-600 dark:text-slate-300"
                                  }`}
                                >
                                  {t("lists.mode_manual")}
                                </button>
                              </div>

                              {draftIsAuto && (
                                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                  {t("lists.auto_live_count", {
                                    count: String(activeFilterPreviewCount),
                                  })}
                                </span>
                              )}
                            </div>

                            {loadingEditorId === l.id ? (
                              <div className="h-24 rounded-xl gm-shimmer" />
                            ) : !draftIsAuto ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400 py-1">
                                En modo <strong className="text-slate-700 dark:text-slate-200">{t("lists.mode_manual")}</strong> tú eliges los sitios manualmente desde la tabla o desde cada tarjeta. Selecciona <strong className="text-indigo-600 dark:text-indigo-400">⚡ {t("lists.mode_auto")}</strong> arriba para definir reglas automáticas.
                              </p>
                            ) : (
                              editorData && (
                                <div className="space-y-3">
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {t("lists.auto_toggle_hint")}
                                  </p>

                                  {/* Texto opcional */}
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                      {t("lists.filter_text_label")}
                                    </label>
                                    <input
                                      type="text"
                                      value={draftCriteria.textSearch || ""}
                                      onChange={(e) =>
                                        setDraftCriteria((prev) => ({
                                          ...prev,
                                          textSearch: e.target.value,
                                        }))
                                      }
                                      placeholder={t("lists.filter_text_placeholder")}
                                      className="w-full px-3 py-1.5 rounded-xl text-base sm:text-xs bg-[#f8f9ff] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>

                                  {/* Ciudades */}
                                  {editorData.cities.length > 0 && (
                                    <div className="space-y-1">
                                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                        {t("lists.filter_cities_label")}
                                      </span>
                                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                                        {editorData.cities.map((c) => {
                                          const active = (draftCriteria.selectedCities || []).includes(c);
                                          return (
                                            <button
                                              key={c}
                                              type="button"
                                              onClick={() => toggleCriteriaItem("selectedCities", c)}
                                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer border ${
                                                active
                                                  ? "bg-indigo-600 border-indigo-600 text-white"
                                                  : "bg-[#f8f9ff] dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                                              }`}
                                            >
                                              {c}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Países (si hay > 1) */}
                                  {editorData.countries.length > 1 && (
                                    <div className="space-y-1">
                                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                        {t("lists.filter_countries_label")}
                                      </span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {editorData.countries.map((co) => {
                                          const active = (draftCriteria.selectedCountries || []).includes(co);
                                          return (
                                            <button
                                              key={co}
                                              type="button"
                                              onClick={() => toggleCriteriaItem("selectedCountries", co)}
                                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer border ${
                                                active
                                                  ? "bg-indigo-600 border-indigo-600 text-white"
                                                  : "bg-[#f8f9ff] dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                                              }`}
                                            >
                                              {co}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Categorías / Planes */}
                                  {editorData.occasions.length > 0 && (
                                    <div className="space-y-1">
                                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                        {t("lists.filter_occasions_label")}
                                      </span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {editorData.occasions.map((occ) => {
                                          const active = (draftCriteria.selectedOccasions || []).includes(
                                            occ.id
                                          );
                                          return (
                                            <button
                                              key={occ.id}
                                              type="button"
                                              onClick={() =>
                                                toggleCriteriaItem("selectedOccasions", occ.id)
                                              }
                                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer border ${
                                                active
                                                  ? "bg-orange-600 border-orange-600 text-white"
                                                  : "bg-[#f8f9ff] dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                                              }`}
                                            >
                                              <OccasionIcon icon={occ.icon} msClassName="text-[13px]" />
                                              <span>{occ.name}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Etiquetas */}
                                  {editorData.tags.length > 0 && (
                                    <div className="space-y-1">
                                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                        {t("lists.filter_tags_label")}
                                      </span>
                                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                                        {editorData.tags.map((tag) => {
                                          const active = (draftCriteria.selectedTags || []).includes(tag);
                                          return (
                                            <button
                                              key={tag}
                                              type="button"
                                              onClick={() => toggleCriteriaItem("selectedTags", tag)}
                                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer border ${
                                                active
                                                  ? "bg-emerald-600 border-emerald-600 text-white"
                                                  : "bg-[#f8f9ff] dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                                              }`}
                                            >
                                              #{tag}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Precios */}
                                  <div className="space-y-1">
                                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                      {t("lists.filter_prices_label")}
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {PRICE_OPTIONS.map((price) => {
                                        const active = (draftCriteria.selectedPrices || []).includes(
                                          price
                                        );
                                        return (
                                          <button
                                            key={price}
                                            type="button"
                                            onClick={() =>
                                              toggleCriteriaItem("selectedPrices", price)
                                            }
                                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer border ${
                                              active
                                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white"
                                                : "bg-[#f8f9ff] dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                                            }`}
                                          >
                                            {price}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )
                            )}

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => setFilterListId(null)}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                {t("common.cancel")}
                              </button>
                              <button
                                type="button"
                                disabled={savingFilterId === l.id}
                                onClick={() => handleSaveFilterConfig(l)}
                                className="px-4 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-40"
                              >
                                {savingFilterId === l.id
                                  ? t("common.loading")
                                  : t("lists.save_filters_btn")}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* PANEL 2: Tabla de administración masiva (añadir/quitar varios a la vez) */}
                        {isTableOpen && (
                          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-orange-200/80 dark:border-orange-900/50 space-y-2.5">
                            {loadingEditorId === l.id || !activeTableView ? (
                              <div className="h-32 rounded-xl gm-shimmer" />
                            ) : (
                              <>
                                {/* Filtros de tabla */}
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                  <input
                                    type="text"
                                    value={tableSearch}
                                    onChange={(e) => setTableSearch(e.target.value)}
                                    placeholder={t("lists.bulk_picker_search")}
                                    className="sm:col-span-2 px-3 py-1.5 rounded-xl text-base sm:text-xs bg-[#f8f9ff] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                  />
                                  <select
                                    value={tableCity}
                                    onChange={(e) => setTableCity(e.target.value)}
                                    className="px-2.5 py-1.5 rounded-xl text-base sm:text-xs bg-[#f8f9ff] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none"
                                  >
                                    <option value="">{t("lists.bulk_picker_all_cities")}</option>
                                    {activeTableView.data.cities.map((c) => (
                                      <option key={c} value={c}>
                                        {c}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={tableOccasion}
                                    onChange={(e) => setTableOccasion(e.target.value)}
                                    className="px-2.5 py-1.5 rounded-xl text-base sm:text-xs bg-[#f8f9ff] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none"
                                  >
                                    <option value="">{t("lists.table_all_occasions")}</option>
                                    {activeTableView.data.occasions.map((o) => (
                                      <option key={o.id} value={o.id}>
                                        {o.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                  <div className="inline-flex p-0.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800 gap-0.5">
                                    {(
                                      [
                                        { key: "all", label: t("lists.table_filter_all") },
                                        { key: "in", label: t("lists.table_filter_in") },
                                        { key: "out", label: t("lists.table_filter_out") },
                                      ] as const
                                    ).map((tab) => (
                                      <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setTableStatus(tab.key)}
                                        className={`px-2.5 py-1 rounded-full font-bold transition cursor-pointer ${
                                          tableStatus === tab.key
                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                                            : "text-slate-600 dark:text-slate-300"
                                        }`}
                                      >
                                        {tab.label}
                                      </button>
                                    ))}
                                  </div>

                                  <div className="flex items-center gap-3 font-semibold">
                                    <button
                                      type="button"
                                      disabled={activeTableView.rows.length === 0}
                                      onClick={() => {
                                        setDraftSelectedIds((prev) => {
                                          const next = new Set(prev);
                                          for (const r of activeTableView.rows) next.add(r.id);
                                          return next;
                                        });
                                      }}
                                      className="text-orange-600 hover:underline cursor-pointer disabled:opacity-40"
                                    >
                                      {t("lists.table_check_visible")} ({activeTableView.rows.length})
                                    </button>
                                    <button
                                      type="button"
                                      disabled={activeTableView.rows.length === 0}
                                      onClick={() => {
                                        setDraftSelectedIds((prev) => {
                                          const next = new Set(prev);
                                          for (const r of activeTableView.rows) next.delete(r.id);
                                          return next;
                                        });
                                      }}
                                      className="text-slate-500 hover:underline cursor-pointer disabled:opacity-40"
                                    >
                                      {t("lists.table_uncheck_visible")}
                                    </button>
                                  </div>
                                </div>

                                {/* Tabla */}
                                <div className="border border-slate-200/70 dark:border-slate-800 rounded-xl overflow-hidden">
                                  <div className="max-h-64 overflow-y-auto overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                      <thead className="sticky top-0 bg-[#f8f9ff] dark:bg-slate-800 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-700 z-10">
                                        <tr>
                                          <th className="py-2 px-2.5 w-8"></th>
                                          <th className="py-2 px-2 font-bold">{t("lists.table_col_place")}</th>
                                          <th className="py-2 px-2 font-bold">{t("lists.table_col_city")}</th>
                                          <th className="py-2 px-2 font-bold hidden sm:table-cell">
                                            {t("lists.table_col_price")}
                                          </th>
                                          <th className="py-2 px-2.5 font-bold text-right">
                                            {t("lists.table_col_status")}
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {activeTableView.rows.length === 0 ? (
                                          <tr>
                                            <td
                                              colSpan={5}
                                              className="py-6 text-center text-slate-400 text-[11px]"
                                            >
                                              {t("lists.bulk_picker_empty")}
                                            </td>
                                          </tr>
                                        ) : (
                                          activeTableView.rows.map((row) => {
                                            const checked = draftSelectedIds.has(row.id);
                                            const wasSaved = activeTableView.savedSet.has(row.id);
                                            const cityDisplay = parseCityCountry(
                                              row.city,
                                              row.address
                                            ).city;
                                            return (
                                              <tr
                                                key={row.id}
                                                onClick={() => {
                                                  setDraftSelectedIds((prev) => {
                                                    const next = new Set(prev);
                                                    if (next.has(row.id)) next.delete(row.id);
                                                    else next.add(row.id);
                                                    return next;
                                                  });
                                                }}
                                                className={`cursor-pointer transition ${
                                                  checked
                                                    ? "bg-orange-50/40 dark:bg-orange-950/20"
                                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                                }`}
                                              >
                                                <td className="py-2 px-2.5">
                                                  <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => {}}
                                                    className="rounded accent-orange-600 w-3.5 h-3.5 pointer-events-none"
                                                  />
                                                </td>
                                                <td className="py-2 px-2">
                                                  <div className="font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                                    {row.name}
                                                  </div>
                                                  {row.tags.length > 0 && (
                                                    <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                                                      {row.tags
                                                        .slice(0, 3)
                                                        .map((tg) => `#${tg}`)
                                                        .join(" ")}
                                                    </div>
                                                  )}
                                                </td>
                                                <td className="py-2 px-2 text-slate-600 dark:text-slate-300">
                                                  {cityDisplay || "—"}
                                                </td>
                                                <td className="py-2 px-2 text-emerald-700 dark:text-emerald-400 font-bold hidden sm:table-cell">
                                                  {row.priceRange}
                                                </td>
                                                <td className="py-2 px-2.5 text-right whitespace-nowrap">
                                                  {checked && !wasSaved ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                                                      +Añadir
                                                    </span>
                                                  ) : !checked && wasSaved ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                                                      -Quitar
                                                    </span>
                                                  ) : checked ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                                      {t("lists.table_status_in")}
                                                    </span>
                                                  ) : (
                                                    <span className="text-[10px] text-slate-400">
                                                      {t("lists.table_status_out")}
                                                    </span>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* Pie de tabla */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                    {activeTableView.addCount > 0 || activeTableView.remCount > 0
                                      ? t("lists.table_pending_changes", {
                                          add: String(activeTableView.addCount),
                                          rem: String(activeTableView.remCount),
                                        })
                                      : t("lists.places_count", {
                                          count: String(draftSelectedIds.size),
                                        })}
                                  </span>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setTableListId(null)}
                                      className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                      {t("common.cancel")}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={
                                        savingTableId === l.id ||
                                        (activeTableView.addCount === 0 &&
                                          activeTableView.remCount === 0)
                                      }
                                      onClick={() => handleSaveTable(l)}
                                      className="px-4 py-1.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-40"
                                    >
                                      {savingTableId === l.id
                                        ? t("common.loading")
                                        : t("lists.table_save_changes")}
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {/* Paradas actuales de la lista */}
                        {loadingItemsId === l.id ? (
                          <div className="h-12 rounded-xl gm-shimmer" />
                        ) : items.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic text-center py-2">
                            {l.isAuto ? t("lists.auto_empty_hint") : t("lists.no_places_in_list")}
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

                              {!l.isAuto && (
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
                              )}
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
