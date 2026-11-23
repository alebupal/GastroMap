"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createOccasionAction,
  renameOccasionAction,
  mergeOccasionsAction,
  deleteOccasionAction,
  deleteMultipleOccasionsAction,
  deleteEmptyOccasionsAction,
  renameTagAction,
  mergeTagsAction,
  deleteTagAction,
  deleteMultipleTagsAction,
  deleteEmptyTagsAction,
} from "@/lib/actions/taxonomy";
import type { Occasion } from "@/db/schema";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { useT } from "@/lib/i18n/client";

interface TaxonomyManagerProps {
  initialOccasions: Array<Occasion & { placesCount: number }>;
  initialTags: Array<{ id: string; name: string; placesCount: number }>;
  section?: "occasions" | "tags";
  defaultOpen?: boolean;
}

const EMOJI_SUGGESTIONS = [
  "🍽️", "🍢", "🥞", "🍰", "☕", "🍸", "✨", "🍔", "🕯️", "☀️",
  "🍕", "🌮", "🍣", "🍷", "🍻", "🍨", "🥡", "🍜", "🥩", "🥗"
];

export function TaxonomyManager({
  initialOccasions,
  initialTags,
  section,
  defaultOpen = false,
}: TaxonomyManagerProps) {
  const { t } = useT();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"occasions" | "tags">(section || "occasions");
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const currentTab = section ?? activeTab;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Lista local para reactividad inmediata
  const [occasionsList, setOccasionsList] = useState(initialOccasions);
  const [tagsList, setTagsList] = useState(initialTags);

  useEffect(() => {
    setOccasionsList(initialOccasions);
  }, [initialOccasions]);

  useEffect(() => {
    setTagsList(initialTags);
  }, [initialTags]);

  // Filtros de búsqueda y paginación en el panel admin
  const [occasionSearch, setOccasionSearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [occPage, setOccPage] = useState(1);
  const [occPageSize, setOccPageSize] = useState(10);
  const [tagPage, setTagPage] = useState(1);
  const [tagPageSize, setTagPageSize] = useState(15);

  // Selección múltiple
  const [selectedOccasionIds, setSelectedOccasionIds] = useState<Set<string>>(new Set());
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  // Estados para creación de nueva ocasión
  const [newOccasionName, setNewOccasionName] = useState("");
  const [newOccasionIcon, setNewOccasionIcon] = useState("🍽️");

  // Estado para modal de reasignación / eliminación individual
  const [itemToDelete, setItemToDelete] = useState<{
    type: "occasion" | "tag";
    id: string;
    name: string;
    count: number;
  } | null>(null);
  const [deleteMode, setDeleteMode] = useState<"reassign" | "detach">("reassign");
  const [replacementTarget, setReplacementTarget] = useState<string>("");

  // Estado para modal de combinación (fusión)
  const [itemToMerge, setItemToMerge] = useState<{
    type: "occasion" | "tag";
    id: string;
    name: string;
  } | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string>("");

  // Estado para edición en línea (renombrar)
  const [editingItem, setEditingItem] = useState<{
    type: "occasion" | "tag";
    id: string;
    name: string;
    icon?: string;
  } | null>(null);

  // Modal para confirmación de eliminación de elementos vacíos
  const [emptyConfirmModal, setEmptyConfirmModal] = useState<{
    type: "occasions" | "tags";
    items: Array<{ id: string; name: string; icon?: string }>;
  } | null>(null);

  // Modal para confirmación de eliminación múltiple por selección
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{
    type: "occasions" | "tags";
    ids: string[];
    items: Array<{ id: string; name: string; icon?: string; count: number }>;
  } | null>(null);

  // Lista filtrada de ocasiones
  const filteredOccasions = useMemo(() => {
    const q = occasionSearch.toLowerCase().trim();
    if (!q) return occasionsList;
    return occasionsList.filter(
      (occ) => occ.name.toLowerCase().includes(q) || occ.id.toLowerCase().includes(q)
    );
  }, [occasionsList, occasionSearch]);

  // Lista filtrada de tags
  const filteredTags = useMemo(() => {
    const q = tagSearch.toLowerCase().trim();
    if (!q) return tagsList;
    return tagsList.filter(
      (tag) => tag.name.toLowerCase().includes(q) || tag.id.toLowerCase().includes(q)
    );
  }, [tagsList, tagSearch]);

  // Paginación de ocasiones
  const occTotalPages = Math.max(1, Math.ceil(filteredOccasions.length / occPageSize));
  const safeOccPage = Math.min(Math.max(1, occPage), occTotalPages);
  const paginatedOccasions = useMemo(() => {
    const start = (safeOccPage - 1) * occPageSize;
    return filteredOccasions.slice(start, start + occPageSize);
  }, [filteredOccasions, safeOccPage, occPageSize]);

  // Paginación de tags
  const tagTotalPages = Math.max(1, Math.ceil(filteredTags.length / tagPageSize));
  const safeTagPage = Math.min(Math.max(1, tagPage), tagTotalPages);
  const paginatedTags = useMemo(() => {
    const start = (safeTagPage - 1) * tagPageSize;
    return filteredTags.slice(start, start + tagPageSize);
  }, [filteredTags, safeTagPage, tagPageSize]);

  // Categorías y tags vacías disponibles
  const emptyOccasions = useMemo(() => {
    return occasionsList.filter((o) => o.placesCount === 0);
  }, [occasionsList]);

  const emptyTags = useMemo(() => {
    return tagsList.filter((t) => t.placesCount === 0);
  }, [tagsList]);

  // Manejadores de selección múltiple - Ocasiones
  function toggleOccasionSelection(id: string) {
    setSelectedOccasionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisibleOccasions() {
    const visibleIds = filteredOccasions.map((o) => o.id);
    const allSelected = visibleIds.every((id) => selectedOccasionIds.has(id));
    setSelectedOccasionIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  // Manejadores de selección múltiple - Tags
  function toggleTagSelection(id: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisibleTags() {
    const visibleIds = filteredTags.map((t) => t.id);
    const allSelected = visibleIds.every((id) => selectedTagIds.has(id));
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  // Crear nueva ocasión
  async function handleCreateOccasion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    const formData = new FormData(e.currentTarget);
    const res = await createOccasionAction(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setNewOccasionName("");
      setSuccessMessage(t("admin_taxonomy.created_success_occasion"));
      router.refresh();
      setTimeout(() => setSuccessMessage(null), 3500);
    }
  }

  // Renombrar
  async function handleSaveRename() {
    if (!editingItem || !editingItem.name.trim()) return;
    setLoading(true);
    setError(null);
    if (editingItem.type === "occasion") {
      await renameOccasionAction(editingItem.id, editingItem.name, editingItem.icon);
      setOccasionsList((prev) =>
        prev.map((o) =>
          o.id === editingItem.id
            ? { ...o, name: editingItem.name, icon: editingItem.icon || o.icon }
            : o
        )
      );
    } else {
      await renameTagAction(editingItem.id, editingItem.name);
      setTagsList((prev) =>
        prev.map((t) =>
          t.id === editingItem.id ? { ...t, name: editingItem.name } : t
        )
      );
    }
    router.refresh();
    setLoading(false);
    setEditingItem(null);
  }

  // Confirmar eliminación individual (con reasignación o desvinculación)
  async function handleConfirmDelete() {
    if (!itemToDelete) return;
    setLoading(true);
    setError(null);
    const replacement = deleteMode === "reassign" ? replacementTarget : undefined;

    if (itemToDelete.type === "occasion") {
      const deletedId = itemToDelete.id;
      await deleteOccasionAction(deletedId, replacement);
      setOccasionsList((prev) => prev.filter((o) => o.id !== deletedId));
      setSelectedOccasionIds((prev) => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
    } else {
      const deletedId = itemToDelete.id;
      await deleteTagAction(deletedId, replacement);
      setTagsList((prev) => prev.filter((t) => t.id !== deletedId));
      setSelectedTagIds((prev) => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
    }

    router.refresh();
    setLoading(false);
    setItemToDelete(null);
  }

  // Confirmar combinación (fusión)
  async function handleConfirmMerge() {
    if (!itemToMerge || !mergeTarget) return;
    setLoading(true);
    setError(null);

    if (itemToMerge.type === "occasion") {
      const sourceId = itemToMerge.id;
      await mergeOccasionsAction(sourceId, mergeTarget);
      setOccasionsList((prev) => prev.filter((o) => o.id !== sourceId));
      setSelectedOccasionIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    } else {
      const sourceId = itemToMerge.id;
      await mergeTagsAction(sourceId, mergeTarget);
      setTagsList((prev) => prev.filter((t) => t.id !== sourceId));
      setSelectedTagIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }

    router.refresh();
    setLoading(false);
    setItemToMerge(null);
  }

  // Abrir confirmación para eliminar vacías
  function handleOpenDeleteEmpty(type: "occasions" | "tags") {
    if (type === "occasions") {
      if (emptyOccasions.length === 0) return;
      setEmptyConfirmModal({
        type: "occasions",
        items: emptyOccasions.map((o) => ({ id: o.id, name: o.name, icon: o.icon })),
      });
    } else {
      if (emptyTags.length === 0) return;
      setEmptyConfirmModal({
        type: "tags",
        items: emptyTags.map((t) => ({ id: t.id, name: t.name })),
      });
    }
  }

  // Ejecutar eliminación de vacías tras confirmación
  async function handleExecuteDeleteEmpty() {
    if (!emptyConfirmModal) return;
    setLoading(true);
    setError(null);

    if (emptyConfirmModal.type === "occasions") {
      const idsToDelete = emptyConfirmModal.items.map((i) => i.id);
      const res = await deleteEmptyOccasionsAction(idsToDelete);
      if (res.error) {
        setError(res.error);
      } else {
        setOccasionsList((prev) => prev.filter((o) => !idsToDelete.includes(o.id)));
        setSelectedOccasionIds((prev) => {
          const next = new Set(prev);
          idsToDelete.forEach((id) => next.delete(id));
          return next;
        });
        setSuccessMessage(t("admin_taxonomy.delete_empty_success_occasions", { count: res.count ?? idsToDelete.length }));
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    } else {
      const tagsToDelete = emptyConfirmModal.items.map((i) => i.id);
      const res = await deleteEmptyTagsAction(tagsToDelete);
      if (res.error) {
        setError(res.error);
      } else {
        setTagsList((prev) => prev.filter((t) => !tagsToDelete.includes(t.id)));
        setSelectedTagIds((prev) => {
          const next = new Set(prev);
          tagsToDelete.forEach((id) => next.delete(id));
          return next;
        });
        setSuccessMessage(t("admin_taxonomy.delete_empty_success_tags", { count: res.count ?? tagsToDelete.length }));
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    }

    router.refresh();
    setLoading(false);
    setEmptyConfirmModal(null);
  }

  // Abrir confirmación para eliminación múltiple seleccionada
  function handleOpenBulkDelete(type: "occasions" | "tags") {
    if (type === "occasions") {
      const ids = Array.from(selectedOccasionIds);
      if (ids.length === 0) return;
      const items = occasionsList
        .filter((o) => ids.includes(o.id))
        .map((o) => ({ id: o.id, name: o.name, icon: o.icon, count: o.placesCount }));
      setBulkDeleteModal({ type: "occasions", ids, items });
    } else {
      const ids = Array.from(selectedTagIds);
      if (ids.length === 0) return;
      const items = tagsList
        .filter((t) => ids.includes(t.id))
        .map((t) => ({ id: t.id, name: t.name, count: t.placesCount }));
      setBulkDeleteModal({ type: "tags", ids, items });
    }
  }

  // Ejecutar eliminación múltiple seleccionada
  async function handleExecuteBulkDelete() {
    if (!bulkDeleteModal) return;
    setLoading(true);
    setError(null);

    if (bulkDeleteModal.type === "occasions") {
      const res = await deleteMultipleOccasionsAction(bulkDeleteModal.ids);
      if (res.error) {
        setError(res.error);
      } else {
        setOccasionsList((prev) => prev.filter((o) => !bulkDeleteModal.ids.includes(o.id)));
        setSelectedOccasionIds(new Set());
        setSuccessMessage(t("admin_taxonomy.bulk_delete_success_occasions", { count: res.count ?? bulkDeleteModal.ids.length }));
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    } else {
      const res = await deleteMultipleTagsAction(bulkDeleteModal.ids);
      if (res.error) {
        setError(res.error);
      } else {
        setTagsList((prev) => prev.filter((t) => !bulkDeleteModal.ids.includes(t.id)));
        setSelectedTagIds(new Set());
        setSuccessMessage(t("admin_taxonomy.bulk_delete_success_tags", { count: res.count ?? bulkDeleteModal.ids.length }));
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    }

    router.refresh();
    setLoading(false);
    setBulkDeleteModal(null);
  }

  const headerIcon =
    section === "occasions" ? "🍽️" : section === "tags" ? "🏷️" : "🏷️";
  const headerTitle =
    section === "occasions"
      ? `${t("admin_taxonomy.title_occasions")} (${occasionsList.length})`
      : section === "tags"
      ? `${t("admin_taxonomy.title_tags")} (${tagsList.length})`
      : `${t("admin_taxonomy.title_occasions")} / ${t("admin_taxonomy.title_tags")}`;
  const headerDesc =
    section === "occasions"
      ? t("admin_taxonomy.subtitle_occasions")
      : t("admin_taxonomy.subtitle_tags");

  return (
    <div className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs text-left">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl shrink-0">{headerIcon}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {headerTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {headerDesc}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition active:scale-95 cursor-pointer shrink-0"
        >
          {isOpen ? t("common.collapse") : t("common.manage")}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
          {/* Mensajes de feedback */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              {successMessage}
            </div>
          )}

          {/* Selector de Pestañas (solo si no se ha fijado una sección específica) */}
          {!section && (
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <button
                onClick={() => setActiveTab("occasions")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  currentTab === "occasions"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {t("admin_taxonomy.title_occasions")} ({occasionsList.length})
              </button>
              <button
                onClick={() => setActiveTab("tags")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  currentTab === "tags"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {t("admin_taxonomy.title_tags")} ({tagsList.length})
              </button>
            </div>
          )}

          {/* ==================== PESTAÑA 1: CATEGORÍAS ==================== */}
          {currentTab === "occasions" && (
            <div className="space-y-4">
              {/* Barra de herramientas: Buscador y Acciones masivas */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={occasionSearch}
                    onChange={(e) => setOccasionSearch(e.target.value)}
                    placeholder={t("admin_taxonomy.search_occasions")}
                    className="w-full px-3 py-1.5 pl-8 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <span className="absolute left-2.5 top-2 text-xs text-slate-400 pointer-events-none">
                    🔍
                  </span>
                  {occasionSearch && (
                    <button
                      type="button"
                      onClick={() => setOccasionSearch("")}
                      className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-200"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Botón eliminar vacías */}
                  <button
                    type="button"
                    onClick={() => handleOpenDeleteEmpty("occasions")}
                    disabled={emptyOccasions.length === 0}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      emptyOccasions.length > 0
                        ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200 cursor-pointer"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <span>🧹</span>
                    <span>{t("admin_taxonomy.delete_empty", { count: String(emptyOccasions.length) })}</span>
                  </button>

                  {/* Botón eliminar seleccionadas */}
                  {selectedOccasionIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenBulkDelete("occasions")}
                      className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🗑️</span>
                      <span>{t("admin_taxonomy.delete_selected", { count: String(selectedOccasionIds.size) })}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Barra de selección masiva */}
              {filteredOccasions.length > 0 && (
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 font-medium border border-slate-200 dark:border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={
                        filteredOccasions.length > 0 &&
                        filteredOccasions.every((o) => selectedOccasionIds.has(o.id))
                      }
                      onChange={toggleAllVisibleOccasions}
                      className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-0 cursor-pointer"
                    />
                    <span>{t("admin_taxonomy.select_all_visible", { count: String(filteredOccasions.length) })}</span>
                  </label>
                  {selectedOccasionIds.size > 0 && (
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {selectedOccasionIds.size}
                    </span>
                  )}
                </div>
              )}

              {/* Listado de categorías */}
              <div className="space-y-2">
                {paginatedOccasions.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    {t("admin_taxonomy.no_categories_found")}
                  </p>
                ) : (
                  paginatedOccasions.map((occ) => {
                    const isSelected = selectedOccasionIds.has(occ.id);
                    const isEmpty = occ.placesCount === 0;

                    return (
                      <div
                        key={occ.id}
                        className={`p-2.5 rounded-xl border transition flex items-center justify-between text-xs ${
                          isSelected
                            ? "border-orange-500 dark:border-orange-600 bg-orange-500/10"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOccasionSelection(occ.id)}
                            className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-0 cursor-pointer shrink-0"
                          />
                          <span className="text-base shrink-0">{occ.icon}</span>
                          <div className="truncate">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {occ.name}
                            </span>
                            <span className="ml-2 text-[11px] text-slate-400">
                              ({occ.placesCount} {occ.placesCount === 1 ? t("places.locale_single") : t("places.locales_count")})
                            </span>
                            {isEmpty && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                {t("admin_taxonomy.empty_badge")}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() =>
                              setEditingItem({
                                type: "occasion",
                                id: occ.id,
                                name: occ.name,
                                icon: occ.icon,
                              })
                            }
                            className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] hover:bg-slate-300 transition cursor-pointer"
                            title={t("common.edit")}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => {
                              setItemToMerge({ type: "occasion", id: occ.id, name: occ.name });
                              const other = occasionsList.find((o) => o.id !== occ.id);
                              setMergeTarget(other?.id || "");
                            }}
                            className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] hover:bg-amber-200 transition cursor-pointer"
                            title={t("admin_taxonomy.merge_title")}
                          >
                            🔀
                          </button>
                          <button
                            onClick={() => {
                              setItemToDelete({
                                type: "occasion",
                                id: occ.id,
                                name: occ.name,
                                count: occ.placesCount,
                              });
                              const other = occasionsList.find((o) => o.id !== occ.id);
                              setReplacementTarget(other?.id || "");
                              setDeleteMode(occ.placesCount > 0 ? "reassign" : "detach");
                            }}
                            className="px-2 py-1 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[11px] hover:bg-red-200 transition cursor-pointer"
                            title={t("common.delete")}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <PaginationBar
                currentPage={safeOccPage}
                totalItems={filteredOccasions.length}
                pageSize={occPageSize}
                onPageChange={setOccPage}
                onPageSizeChange={setOccPageSize}
                itemLabel={t("places.plans_title")}
              />

              {/* Formulario para añadir nueva categoría */}
              <form
                onSubmit={handleCreateOccasion}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3"
              >
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t("admin_taxonomy.create_category_title")}
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="name"
                    required
                    value={newOccasionName}
                    onChange={(e) => setNewOccasionName(e.target.value)}
                    placeholder={t("admin_taxonomy.category_name_placeholder")}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <button
                    type="submit"
                    disabled={loading || !newOccasionName.trim()}
                    className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition active:scale-95 disabled:opacity-40 cursor-pointer"
                  >
                    {t("admin_taxonomy.save_btn")}
                  </button>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">{t("admin_taxonomy.choose_emoji")}</span>
                  <div className="flex flex-wrap gap-1">
                    {EMOJI_SUGGESTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewOccasionIcon(emoji)}
                        className={`w-6 h-6 rounded text-xs flex items-center justify-center cursor-pointer ${
                          newOccasionIcon === emoji
                            ? "bg-orange-600 text-white shadow-xs font-bold"
                            : "bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="icon" value={newOccasionIcon} />
                </div>
              </form>
            </div>
          )}

          {/* ==================== PESTAÑA 2: ETIQUETAS ==================== */}
          {currentTab === "tags" && (
            <div className="space-y-4">
              {/* Barra de herramientas: Buscador y Acciones masivas */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder={t("admin_taxonomy.search_tags")}
                    className="w-full px-3 py-1.5 pl-8 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <span className="absolute left-2.5 top-2 text-xs text-slate-400 pointer-events-none">
                    🔍
                  </span>
                  {tagSearch && (
                    <button
                      type="button"
                      onClick={() => setTagSearch("")}
                      className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-200"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Botón eliminar vacías */}
                  <button
                    type="button"
                    onClick={() => handleOpenDeleteEmpty("tags")}
                    disabled={emptyTags.length === 0}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      emptyTags.length > 0
                        ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200 cursor-pointer"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <span>🧹</span>
                    <span>{t("admin_taxonomy.delete_empty", { count: String(emptyTags.length) })}</span>
                  </button>

                  {/* Botón eliminar seleccionadas */}
                  {selectedTagIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenBulkDelete("tags")}
                      className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🗑️</span>
                      <span>{t("admin_taxonomy.delete_selected", { count: String(selectedTagIds.size) })}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Barra de selección masiva */}
              {filteredTags.length > 0 && (
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 font-medium border border-slate-200 dark:border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={
                        filteredTags.length > 0 &&
                        filteredTags.every((t) => selectedTagIds.has(t.id))
                      }
                      onChange={toggleAllVisibleTags}
                      className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-0 cursor-pointer"
                    />
                    <span>{t("admin_taxonomy.select_all_visible", { count: String(filteredTags.length) })}</span>
                  </label>
                  {selectedTagIds.size > 0 && (
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {selectedTagIds.size}
                    </span>
                  )}
                </div>
              )}

              {/* Listado de etiquetas */}
              <div className="space-y-1.5">
                {paginatedTags.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    {t("admin_taxonomy.no_tags_found")}
                  </p>
                ) : (
                  paginatedTags.map((tag) => {
                    const isSelected = selectedTagIds.has(tag.id);
                    const isEmpty = tag.placesCount === 0;

                    return (
                      <div
                        key={tag.id}
                        className={`p-2 rounded-xl border transition flex items-center justify-between text-xs ${
                          isSelected
                            ? "border-orange-500 dark:border-orange-600 bg-orange-500/10"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTagSelection(tag.id)}
                            className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-0 cursor-pointer shrink-0"
                          />
                          <div className="truncate">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              #{tag.name}
                            </span>
                            <span className="ml-2 text-[11px] text-slate-400">
                              ({tag.placesCount} {tag.placesCount === 1 ? t("places.locale_single") : t("places.locales_count")})
                            </span>
                            {isEmpty && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                {t("admin_taxonomy.empty_badge")}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() =>
                              setEditingItem({ type: "tag", id: tag.id, name: tag.name })
                            }
                            className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] hover:bg-slate-300 transition cursor-pointer"
                            title={t("common.edit")}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => {
                              setItemToMerge({ type: "tag", id: tag.id, name: tag.name });
                              const other = tagsList.find((t) => t.id !== tag.id);
                              setMergeTarget(other?.id || "");
                            }}
                            className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] hover:bg-amber-200 transition cursor-pointer"
                            title={t("admin_taxonomy.merge_title")}
                          >
                            🔀
                          </button>
                          <button
                            onClick={() => {
                              setItemToDelete({
                                type: "tag",
                                id: tag.id,
                                name: tag.name,
                                count: tag.placesCount,
                              });
                              const other = tagsList.find((t) => t.id !== tag.id);
                              setReplacementTarget(other?.id || "");
                              setDeleteMode(tag.placesCount > 0 ? "reassign" : "detach");
                            }}
                            className="px-2 py-1 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[11px] hover:bg-red-200 transition cursor-pointer"
                            title={t("common.delete")}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <PaginationBar
                currentPage={safeTagPage}
                totalItems={filteredTags.length}
                pageSize={tagPageSize}
                onPageChange={setTagPage}
                onPageSizeChange={setTagPageSize}
                itemLabel={t("admin_taxonomy.title_tags")}
              />
            </div>
          )}
        </div>
      )}

      {/* ==================== MODAL: CONFIRMAR ELIMINACIÓN DE ELEMENTOS VACÍOS ==================== */}
      {emptyConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
              <span className="text-2xl">🧹</span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t(
                  emptyConfirmModal.type === "occasions"
                    ? "admin_taxonomy.delete_empty_title_occasions"
                    : "admin_taxonomy.delete_empty_title_tags",
                  { count: emptyConfirmModal.items.length }
                )}
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t(
                emptyConfirmModal.type === "occasions"
                  ? "admin_taxonomy.delete_empty_desc_occasions"
                  : "admin_taxonomy.delete_empty_desc_tags",
                { count: emptyConfirmModal.items.length }
              )}
            </p>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto space-y-1.5">
              {emptyConfirmModal.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 py-0.5"
                >
                  <span className="text-slate-400 text-[10px]">•</span>
                  {item.icon && <span className="text-sm">{item.icon}</span>}
                  <span className="font-semibold">
                    {emptyConfirmModal.type === "tags" ? `#${item.name}` : item.name}
                  </span>
                  <span className="text-[11px] text-slate-400">({item.id})</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 italic">
              {t("admin_taxonomy.delete_empty_irreversible")}
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEmptyConfirmModal(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteEmpty}
                disabled={loading}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {loading
                  ? t("admin_taxonomy.deleting")
                  : t("admin_taxonomy.delete_empty_confirm_btn", { count: emptyConfirmModal.items.length })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: CONFIRMAR ELIMINACIÓN MÚLTIPLE POR SELECCIÓN ==================== */}
      {bulkDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400">
              <span className="text-2xl">🗑️</span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t(
                  bulkDeleteModal.type === "occasions"
                    ? "admin_taxonomy.bulk_delete_title_occasions"
                    : "admin_taxonomy.bulk_delete_title_tags",
                  { count: bulkDeleteModal.ids.length }
                )}
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t(
                bulkDeleteModal.type === "occasions"
                  ? "admin_taxonomy.bulk_delete_desc_occasions"
                  : "admin_taxonomy.bulk_delete_desc_tags",
                { count: bulkDeleteModal.ids.length }
              )}
            </p>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto space-y-1.5">
              {bulkDeleteModal.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-xs text-slate-800 dark:text-slate-200 py-0.5"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-slate-400 text-[10px]">•</span>
                    {item.icon && <span className="text-sm">{item.icon}</span>}
                    <span className="font-semibold truncate">
                      {bulkDeleteModal.type === "tags" ? `#${item.name}` : item.name}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {item.count === 1
                      ? t("admin_taxonomy.category_place_count", { count: item.count })
                      : t("admin_taxonomy.category_places_count", { count: item.count })}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBulkDeleteModal(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkDelete}
                disabled={loading}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {loading
                  ? t("admin_taxonomy.deleting")
                  : t("admin_taxonomy.delete_selected", { count: bulkDeleteModal.ids.length })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 1: ELIMINACIÓN INDIVIDUAL CON REASIGNACIÓN ==================== */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t(
                itemToDelete.type === "occasion"
                  ? "admin_taxonomy.single_delete_title_occasion"
                  : "admin_taxonomy.single_delete_title_tag",
                { name: itemToDelete.name }
              )}
            </h4>

            {itemToDelete.count > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50">
                  {itemToDelete.count === 1
                    ? t("admin_taxonomy.assigned_warning_one")
                    : t("admin_taxonomy.assigned_warning", { count: itemToDelete.count })}
                </p>

                <div className="space-y-2 text-xs">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="delMode"
                      checked={deleteMode === "reassign"}
                      onChange={() => setDeleteMode("reassign")}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {t("admin_taxonomy.reassign_radio")}
                      </span>
                      <p className="text-slate-500 text-[11px]">
                        {t("admin_taxonomy.reassign_hint")}
                      </p>
                    </div>
                  </label>

                  {deleteMode === "reassign" && (
                    <div className="pl-5 pt-1">
                      <select
                        value={replacementTarget}
                        onChange={(e) => setReplacementTarget(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                      >
                        {itemToDelete.type === "occasion"
                          ? occasionsList
                              .filter((o) => o.id !== itemToDelete.id)
                              .map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.icon} {o.name}
                                </option>
                              ))
                          : tagsList
                              .filter((t) => t.id !== itemToDelete.id)
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  #{t.name}
                                </option>
                              ))}
                      </select>
                    </div>
                  )}

                  <label className="flex items-start gap-2 cursor-pointer pt-1">
                    <input
                      type="radio"
                      name="delMode"
                      checked={deleteMode === "detach"}
                      onChange={() => setDeleteMode("detach")}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {t("admin_taxonomy.detach_radio")}
                      </span>
                      <p className="text-slate-500 text-[11px]">
                        {itemToDelete.type === "occasion"
                          ? t("admin_taxonomy.single_delete_leave_empty_occasion")
                          : t("admin_taxonomy.single_delete_leave_empty_tag")}
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {t("admin_taxonomy.single_delete_safe_hint")}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={loading}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {loading ? t("admin_taxonomy.deleting") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: COMBINAR / FUSIONAR ==================== */}
      {itemToMerge && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t("admin_taxonomy.merge_modal_title", { name: itemToMerge.name })}
            </h4>

            <p className="text-xs text-slate-500">
              {t("admin_taxonomy.merge_modal_desc", { name: itemToMerge.name })}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                {t("admin_taxonomy.merge_into")}
              </label>
              <select
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                {itemToMerge.type === "occasion"
                  ? occasionsList
                      .filter((o) => o.id !== itemToMerge.id)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.icon} {o.name}
                        </option>
                      ))
                  : tagsList
                      .filter((t) => t.id !== itemToMerge.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          #{t.name}
                        </option>
                      ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToMerge(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmMerge}
                disabled={loading || !mergeTarget}
                className="flex-1 py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {loading ? t("admin_taxonomy.merging") : t("admin_taxonomy.confirm_merge_btn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 3: RENOMBRAR ==================== */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t(
                editingItem.type === "occasion"
                  ? "admin_taxonomy.rename_title_occasion"
                  : "admin_taxonomy.rename_title_tag"
              )}
            </h4>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                {t("admin_taxonomy.new_name_label")}
              </label>
              <input
                type="text"
                value={editingItem.name}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSaveRename}
                disabled={loading || !editingItem.name.trim()}
                className="flex-1 py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {loading ? t("admin_taxonomy.saving") : t("admin_taxonomy.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
