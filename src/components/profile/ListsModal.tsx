"use client";

import { useState, useEffect } from "react";
import {
  getMyListsAction,
  getListItemsAction,
  createListAction,
  updateListAction,
  deleteListAction,
  togglePlaceInListAction,
  reorderListItemsAction,
  type UserPlaceListSummary,
  type ListPlaceItemDetail,
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
                      <div className="pt-2 space-y-1.5">
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
