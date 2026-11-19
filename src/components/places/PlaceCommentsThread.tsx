"use client";

import { useState, useEffect } from "react";
import {
  getPlaceCommentsAction,
  addCommentAction,
  updateCommentAction,
  deleteCommentAction,
  type CommentWithAuthor,
} from "@/lib/actions/interactions";

interface PlaceCommentsThreadProps {
  placeId: string;
  currentUserId: string;
  isAdmin: boolean;
  isOpen: boolean;
  onClose: () => void;
  onCommentsCountChange?: (count: number) => void;
}

export function PlaceCommentsThread({
  placeId,
  currentUserId,
  isAdmin,
  isOpen,
  onClose,
  onCommentsCountChange,
}: PlaceCommentsThreadProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getPlaceCommentsAction(placeId)
        .then((data) => {
          setComments(data);
          onCommentsCountChange?.(data.length);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, placeId]);

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newContent.trim() || submitting) return;
    setSubmitting(true);

    const res = await addCommentAction(placeId, newContent);
    if (res.success && res.comment) {
      const updated = [res.comment as CommentWithAuthor, ...comments];
      setComments(updated);
      setNewContent("");
      onCommentsCountChange?.(updated.length);
    }
    setSubmitting(false);
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm("¿Eliminar este comentario?")) return;
    const res = await deleteCommentAction(commentId);
    if (res.success) {
      const updated = comments.filter((c) => c.id !== commentId);
      setComments(updated);
      onCommentsCountChange?.(updated.length);
    }
  }

  async function handleSaveEdit(commentId: string) {
    if (!editingContent.trim() || savingEdit) return;
    setSavingEdit(true);
    const res = await updateCommentAction(commentId, editingContent);
    if (res.success && res.content) {
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, content: res.content! } : c))
      );
      setEditingCommentId(null);
      setEditingContent("");
    }
    setSavingEdit(false);
  }

  if (!isOpen) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-left">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          💬 Recomendaciones y comentarios ({comments.length})
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
        >
          Ocultar ✕
        </button>
      </div>

      {/* Lista de comentarios */}
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs">
        {loading ? (
          <p className="text-slate-400 py-2 text-center text-[11px]">Cargando comentarios...</p>
        ) : comments.length === 0 ? (
          <p className="text-slate-400 italic py-1 text-[11px]">
            Aún no hay comentarios. ¡Sé el primero en recomendar qué pedir o dar tu opinión!
          </p>
        ) : (
          comments.map((c) => {
            const isAuthor = c.userId === currentUserId;
            const canDelete = isAdmin || isAuthor;
            const isEditing = editingCommentId === c.id;
            return (
              <div
                key={c.id}
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-slate-200 text-[11px]">
                    @{c.authorUsername || c.authorName.toLowerCase().replace(/\s+/g, "")}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">
                      {new Date(c.createdAt).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    {isAuthor && !isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCommentId(c.id);
                          setEditingContent(c.content);
                        }}
                        className="text-slate-400 hover:text-amber-500 text-[10px] cursor-pointer"
                        title="Editar comentario"
                      >
                        ✏️
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-slate-400 hover:text-red-500 text-[10px] cursor-pointer"
                        title="Eliminar comentario"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="text"
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveEdit(c.id);
                        } else if (e.key === "Escape") {
                          setEditingCommentId(null);
                        }
                      }}
                      autoFocus
                      className="flex-1 px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-950 border border-amber-400 dark:border-amber-500/60 text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(c.id)}
                      disabled={savingEdit || !editingContent.trim()}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 cursor-pointer disabled:opacity-40"
                    >
                      {savingEdit ? "..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCommentId(null)}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <p className="text-slate-600 dark:text-slate-300 text-xs whitespace-pre-wrap">
                    {c.content}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Formulario para comentar */}
      <form onSubmit={handleAddComment} className="mt-2.5 flex gap-1.5">
        <input
          type="text"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Escribe un consejo o plato recomendado..."
          className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={submitting || !newContent.trim()}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition cursor-pointer disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
