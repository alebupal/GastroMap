"use client";

import { useState } from "react";
import {
  createOccasionAction,
  renameOccasionAction,
  mergeOccasionsAction,
  deleteOccasionAction,
  renameTagAction,
  mergeTagsAction,
  deleteTagAction,
} from "@/lib/actions/taxonomy";
import type { Occasion } from "@/db/schema";

interface TaxonomyManagerProps {
  initialOccasions: Array<Occasion & { placesCount: number }>;
  initialTags: Array<{ id: string; name: string; placesCount: number }>;
}

const EMOJI_SUGGESTIONS = ["🍽️", "🍢", "🥞", "🍰", "☕", "🍸", "✨", "🍔", "🕯️", "☀️", "🍕", "🌮", "🍣", "🍷", "🍻", "🍨", "🥡"];

export function TaxonomyManager({ initialOccasions, initialTags }: TaxonomyManagerProps) {
  const [activeTab, setActiveTab] = useState<"occasions" | "tags">("occasions");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para creación de nueva ocasión
  const [newOccasionName, setNewOccasionName] = useState("");
  const [newOccasionIcon, setNewOccasionIcon] = useState("🍽️");

  // Estado para modal de reasignación / eliminación
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

  // Crear nueva ocasión
  async function handleCreateOccasion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await createOccasionAction(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setNewOccasionName("");
    }
  }

  // Renombrar
  async function handleSaveRename() {
    if (!editingItem || !editingItem.name.trim()) return;
    setLoading(true);
    if (editingItem.type === "occasion") {
      await renameOccasionAction(editingItem.id, editingItem.name, editingItem.icon);
    } else {
      await renameTagAction(editingItem.id, editingItem.name);
    }
    setLoading(false);
    setEditingItem(null);
  }

  // Confirmar eliminación (con reasignación o desvinculación)
  async function handleConfirmDelete() {
    if (!itemToDelete) return;
    setLoading(true);
    const replacement = deleteMode === "reassign" ? replacementTarget : undefined;

    if (itemToDelete.type === "occasion") {
      await deleteOccasionAction(itemToDelete.id, replacement);
    } else {
      await deleteTagAction(itemToDelete.id, replacement);
    }

    setLoading(false);
    setItemToDelete(null);
  }

  // Confirmar combinación (fusión)
  async function handleConfirmMerge() {
    if (!itemToMerge || !mergeTarget) return;
    setLoading(true);

    if (itemToMerge.type === "occasion") {
      await mergeOccasionsAction(itemToMerge.id, mergeTarget);
    } else {
      await mergeTagsAction(itemToMerge.id, mergeTarget);
    }

    setLoading(false);
    setItemToMerge(null);
  }

  return (
    <div className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏷️</span>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Taxonomía y Clasificaciones
            </h3>
            <p className="text-xs text-slate-500">
              Administra, renombra, combina y fusiona categorías y etiquetas
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 transition active:scale-95 cursor-pointer"
        >
          {isOpen ? "Cerrar" : "Gestionar"}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
          {/* Selector de Pestañas */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => setActiveTab("occasions")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                activeTab === "occasions"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Categorías / Planes ({initialOccasions.length})
            </button>
            <button
              onClick={() => setActiveTab("tags")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                activeTab === "tags"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Etiquetas / Especialidades ({initialTags.length})
            </button>
          </div>

          {/* PESTAÑA 1: CATEGORÍAS */}
          {activeTab === "occasions" && (
            <div className="space-y-4">
              <div className="space-y-2">
                {initialOccasions.map((occ) => (
                  <div
                    key={occ.id}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-base">{occ.icon}</span>
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{occ.name}</span>
                        <span className="ml-2 text-[11px] text-slate-400">
                          ({occ.placesCount} {occ.placesCount === 1 ? "sitio" : "sitios"})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setEditingItem({ type: "occasion", id: occ.id, name: occ.name, icon: occ.icon })}
                        className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] hover:bg-slate-300 transition cursor-pointer"
                        title="Renombrar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => {
                          setItemToMerge({ type: "occasion", id: occ.id, name: occ.name });
                          const other = initialOccasions.find((o) => o.id !== occ.id);
                          setMergeTarget(other?.id || "");
                        }}
                        className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] hover:bg-amber-200 transition cursor-pointer"
                        title="Combinar / Fusionar con otra"
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
                          const other = initialOccasions.find((o) => o.id !== occ.id);
                          setReplacementTarget(other?.id || "");
                          setDeleteMode(occ.placesCount > 0 ? "reassign" : "detach");
                        }}
                        className="px-2 py-1 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[11px] hover:bg-red-200 transition cursor-pointer"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Formulario para añadir nueva categoría */}
              <form onSubmit={handleCreateOccasion} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">➕ Crear nueva categoría</h4>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="name"
                    required
                    value={newOccasionName}
                    onChange={(e) => setNewOccasionName(e.target.value)}
                    placeholder="Nombre ej. Cervecería artesanal..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={loading || !newOccasionName.trim()}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition active:scale-95 disabled:opacity-40 cursor-pointer"
                  >
                    Guardar
                  </button>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Elige un emoji:</span>
                  <div className="flex flex-wrap gap-1">
                    {EMOJI_SUGGESTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewOccasionIcon(emoji)}
                        className={`w-6 h-6 rounded text-xs flex items-center justify-center cursor-pointer ${
                          newOccasionIcon === emoji ? "bg-amber-500 text-white" : "bg-white dark:bg-slate-800"
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

          {/* PESTAÑA 2: ETIQUETAS */}
          {activeTab === "tags" && (
            <div className="space-y-4">
              {initialTags.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No hay etiquetas creadas todavía.</p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {initialTags.map((tag) => (
                    <div
                      key={tag.id}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">#{tag.name}</span>
                        <span className="text-[11px] text-slate-400">
                          ({tag.placesCount} {tag.placesCount === 1 ? "sitio" : "sitios"})
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setEditingItem({ type: "tag", id: tag.id, name: tag.name })}
                          className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] hover:bg-slate-300 transition cursor-pointer"
                          title="Renombrar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => {
                            setItemToMerge({ type: "tag", id: tag.id, name: tag.name });
                            const other = initialTags.find((t) => t.id !== tag.id);
                            setMergeTarget(other?.id || "");
                          }}
                          className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] hover:bg-amber-200 transition cursor-pointer"
                          title="Combinar / Fusionar con otra"
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
                            const other = initialTags.find((t) => t.id !== tag.id);
                            setReplacementTarget(other?.id || "");
                            setDeleteMode(tag.placesCount > 0 ? "reassign" : "detach");
                          }}
                          className="px-2 py-1 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[11px] hover:bg-red-200 transition cursor-pointer"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ELIMINACIÓN CON REASIGNACIÓN INTELIGENTE */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              ¿Eliminar {itemToDelete.type === "occasion" ? "categoría" : "etiqueta"} «{itemToDelete.name}»?
            </h4>

            {itemToDelete.count > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50">
                  ⚠️ Esta clasificación está asignada a <strong>{itemToDelete.count} {itemToDelete.count === 1 ? "establecimiento" : "establecimientos"}</strong>.
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
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Reemplazar por otra existente</span>
                      <p className="text-slate-500 text-[11px]">Los sitios pasarán a tener la nueva opción elegida.</p>
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
                          ? initialOccasions
                              .filter((o) => o.id !== itemToDelete.id)
                              .map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.icon} {o.name}
                                </option>
                              ))
                          : initialTags
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
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Solo desvincular</span>
                      <p className="text-slate-500 text-[11px]">Los sitios se quedan sin esta {itemToDelete.type === "occasion" ? "categoría" : "etiqueta"}.</p>
                    </div>
                  </label>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Ningún establecimiento tiene asignada esta clasificación. Se eliminará de forma segura.
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={loading}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {loading ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: COMBINAR / FUSIONAR */}
      {itemToMerge && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              🔀 Combinar «{itemToMerge.name}»
            </h4>

            <p className="text-xs text-slate-500">
              Todos los establecimientos asociados a <strong>«{itemToMerge.name}»</strong> se fusionarán en la siguiente clasificación de destino, y la de origen será eliminada:
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Combinar en:
              </label>
              <select
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                {itemToMerge.type === "occasion"
                  ? initialOccasions
                      .filter((o) => o.id !== itemToMerge.id)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.icon} {o.name}
                        </option>
                      ))
                  : initialTags
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
                onClick={() => setItemToMerge(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmMerge}
                disabled={loading || !mergeTarget}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {loading ? "Combinando..." : "Confirmar Fusión"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RENOMBRAR */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              ✏️ Renombrar {editingItem.type === "occasion" ? "categoría" : "etiqueta"}
            </h4>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Nuevo nombre
              </label>
              <input
                type="text"
                value={editingItem.name}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRename}
                disabled={loading || !editingItem.name.trim()}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {loading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
