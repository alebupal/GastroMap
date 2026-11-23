"use client";

import { useState, useEffect, useRef } from "react";
import {
  getPlaceCommentsAction,
  addCommentAction,
  updateCommentAction,
  deleteCommentAction,
  type CommentWithAuthor,
} from "@/lib/actions/interactions";
import { CommentSkeleton } from "@/components/ui/Skeleton";
import { useT } from "@/lib/i18n/client";
import { LinkifiedText } from "@/components/ui/LinkifiedText";

interface PlaceCommentsThreadProps {
  placeId: string;
  currentUserId: string;
  isAdmin: boolean;
  isOpen: boolean;
  onClose: () => void;
  onCommentsCountChange?: (count: number) => void;
}

/**
 * Renderizador de texto enriquecido ligero (soporta negrita, cursiva, tachado, citas, viñetas y enlaces).
 */
function FormattedCommentContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="text-slate-600 dark:text-slate-300 text-xs space-y-1 leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Citas tipo "> Cita"
        if (line.startsWith(">")) {
          const quoteText = line.replace(/^>[ ]?/, "");
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-amber-500/80 pl-2 py-0.5 text-slate-500 dark:text-slate-400 italic bg-amber-50/40 dark:bg-amber-950/20 rounded-r-md text-[11px]"
            >
              <InlineFormatted text={quoteText} />
            </blockquote>
          );
        }

        // Viñetas tipo "- " o "* "
        if (/^[-*]\s+/.test(line)) {
          const bulletText = line.replace(/^[-*]\s+/, "");
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1.5">
              <span className="text-amber-500 dark:text-amber-400 font-bold leading-tight select-none">
                •
              </span>
              <div className="flex-1">
                <InlineFormatted text={bulletText} />
              </div>
            </div>
          );
        }

        return (
          <p key={idx}>
            <InlineFormatted text={line} />
          </p>
        );
      })}
    </div>
  );
}

/**
 * Parsea negrita (**texto**), cursiva (*texto*), tachado (~~texto~~) y enlaces ([texto](url))
 */
function InlineFormatted({ text }: { text: string }) {
  // Regex para tokens: [texto](url), **negrita**, *cursiva*, ~~tachado~~
  const tokenRegex =
    /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g;
  const parts = text.split(tokenRegex);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;

        // Enlace markdown [label](url)
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          const [, label, url] = linkMatch;
          const isSafeUrl = /^(https?:\/\/|\/)/i.test(url);
          return isSafeUrl ? (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 font-semibold underline hover:text-blue-700"
            >
              {label}
            </a>
          ) : (
            <span key={i}>{label}</span>
          );
        }

        // Negrita **texto**
        if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
          return (
            <strong key={i} className="font-bold text-slate-900 dark:text-slate-100">
              {part.slice(2, -2)}
            </strong>
          );
        }

        // Cursiva *texto*
        if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
          return (
            <em key={i} className="italic">
              {part.slice(1, -1)}
            </em>
          );
        }

        // Tachado ~~texto~~
        if (part.startsWith("~~") && part.endsWith("~~") && part.length >= 4) {
          return (
            <span key={i} className="line-through opacity-75">
              {part.slice(2, -2)}
            </span>
          );
        }

        return <LinkifiedText key={i} text={part} />;
      })}
    </>
  );
}

/**
 * Editor enriquecido WYSIWYG ligero para comentarios.
 */
function RichTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  onSubmit,
  isSubmitting,
  submitLabel = "Enviar",
  onCancel,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  rows?: number;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}) {
  const { t } = useT();
  const [tab, setTab] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function wrapSelection(prefix: string, suffix: string = prefix, defaultPlaceholder = "texto") {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selectedText = value.substring(start, end) || defaultPlaceholder;
    const replacement = `${prefix}${selectedText}${suffix}`;
    const nextVal = value.substring(0, start) + replacement + value.substring(end);
    onChange(nextVal);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 10);
  }

  function insertPrefixAtLine(prefix: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const before = value.substring(0, start);
    const after = value.substring(start);
    const lastNewline = before.lastIndexOf("\n");
    const insertPos = lastNewline === -1 ? 0 : lastNewline + 1;
    const nextVal = value.substring(0, insertPos) + prefix + value.substring(insertPos);
    onChange(nextVal);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 10);
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700/80 rounded-2xl bg-white dark:bg-slate-900/90 overflow-hidden shadow-xs focus-within:ring-2 focus-within:ring-amber-500/40 focus-within:border-amber-500 transition">
      {/* Barra de herramientas WYSIWYG */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Negrita (**texto**)"
            onClick={() => wrapSelection("**", "**", "texto en negrita")}
            className="w-6 h-6 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded cursor-pointer"
          >
            B
          </button>
          <button
            type="button"
            title="Cursiva (*texto*)"
            onClick={() => wrapSelection("*", "*", "texto en cursiva")}
            className="w-6 h-6 flex items-center justify-center italic text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded cursor-pointer"
          >
            I
          </button>
          <button
            type="button"
            title="Lista con viñetas"
            onClick={() => insertPrefixAtLine("- ")}
            className="px-1.5 h-6 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded cursor-pointer text-[11px]"
          >
            • Lista
          </button>
          <button
            type="button"
            title="Cita o consejo destacado"
            onClick={() => insertPrefixAtLine("> ")}
            className="px-1.5 h-6 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded cursor-pointer text-[11px]"
          >
            ❝ Consejo
          </button>
          <button
            type="button"
            title="Añadir plato recomendado"
            onClick={() => {
              const el = textareaRef.current;
              const cursor = el ? el.selectionStart : value.length;
              const snippet = "✨ Plato recomendado: ";
              onChange(value.substring(0, cursor) + snippet + value.substring(cursor));
            }}
            className="px-1.5 h-6 flex items-center justify-center text-amber-600 dark:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded cursor-pointer text-[11px] font-semibold"
          >
            ✨ Plato
          </button>
        </div>

        {/* Toggle escribir / previsualizar */}
        <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-700/60 p-0.5 rounded-lg text-[10px] font-semibold">
          <button
            type="button"
            onClick={() => setTab("write")}
            className={`px-2 py-0.5 rounded-md cursor-pointer transition ${tab === "write"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
              : "text-slate-600 dark:text-slate-400"
              }`}
          >
            {t ? t("comments.write") : "Escribir"}
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`px-2 py-0.5 rounded-md cursor-pointer transition ${tab === "preview"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
              : "text-slate-600 dark:text-slate-400"
              }`}
          >
            {t ? t("comments.preview") : "Vista previa"}
          </button>
        </div>
      </div>

      {/* Área de texto / Vista previa */}
      {tab === "write" ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-3 py-2 text-xs bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none resize-y min-h-[72px]"
        />
      ) : (
        <div className="p-3 min-h-[72px] bg-slate-50/50 dark:bg-slate-950/40 text-left">
          {value.trim() ? (
            <FormattedCommentContent content={value} />
          ) : (
            <p className="text-slate-400 italic text-[11px]">{t ? t("comments.preview_empty") : "Escribe algo para ver la vista previa con formato."}</p>
          )}
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50/60 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800">
        <span className="text-[10px] text-slate-400">
          {t ? t("comments.markdown_hint") : "Usa **negrita**, *cursiva*, > citas o - viñetas"}
        </span>
        <div className="flex items-center gap-1.5">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-2.5 py-1 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
            >
              {t ? t("comments.cancel") : "Cancelar"}
            </button>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || !value.trim()}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-xs transition cursor-pointer disabled:opacity-40"
          >
            {isSubmitting ? (t ? t("comments.saving") : "Guardando...") : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlaceCommentsThread({
  placeId,
  currentUserId,
  isAdmin,
  isOpen,
  onClose,
  onCommentsCountChange,
}: PlaceCommentsThreadProps) {
  const { t } = useT();
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
  }, [isOpen, placeId, onCommentsCountChange]);

  async function handleAddComment() {
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
    if (!confirm(t("comments.delete_confirm"))) return;
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
          💬 {t("comments.title")} ({comments.length})
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
        >
          {t("comments.hide")}
        </button>
      </div>

      {/* Lista de comentarios */}
      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 text-xs mb-3">
        {loading ? (
          <div className="space-y-2 py-1">
            <CommentSkeleton />
            <CommentSkeleton />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-slate-400 italic py-2 text-[11px] text-center bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
            {t("comments.empty")}
          </p>
        ) : (
          comments.map((c) => {
            const isAuthor = c.userId === currentUserId;
            const canDelete = isAdmin || isAuthor;
            const isEditing = editingCommentId === c.id;
            return (
              <div
                key={c.id}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 dark:text-slate-200 text-xs">
                      @{c.authorUsername || c.authorName.toLowerCase().replace(/\s+/g, "")}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(c.createdAt).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isAuthor && !isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCommentId(c.id);
                          setEditingContent(c.content);
                        }}
                        className="text-slate-400 hover:text-amber-500 text-xs cursor-pointer px-1 py-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700"
                        title={t("comments.edit_title")}
                      >
                        ✏️
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-slate-400 hover:text-red-500 text-xs cursor-pointer px-1 py-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700"
                        title={t("comments.delete_title")}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-1">
                    <RichTextarea
                      value={editingContent}
                      onChange={setEditingContent}
                      placeholder={t("comments.edit_placeholder")}
                      rows={3}
                      onSubmit={() => handleSaveEdit(c.id)}
                      isSubmitting={savingEdit}
                      submitLabel={t("comments.save")}
                      onCancel={() => setEditingCommentId(null)}
                    />
                  </div>
                ) : (
                  <div className="mt-0.5">
                    <FormattedCommentContent content={c.content} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Formulario WYSIWYG para añadir nuevo comentario */}
      <div className="mt-2">
        <RichTextarea
          value={newContent}
          onChange={setNewContent}
          placeholder={t("comments.placeholder")}
          rows={3}
          onSubmit={handleAddComment}
          isSubmitting={submitting}
          submitLabel={t("comments.publish")}
        />
      </div>
    </div>
  );
}
