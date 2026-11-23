"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  getPlaceCommentsAction,
  addCommentAction,
  updateCommentAction,
  deleteCommentAction,
  savePrivateNotesAction,
  type CommentWithAuthor,
} from "@/lib/actions/interactions";
import { CommentSkeleton } from "@/components/ui/Skeleton";
import { useT } from "@/lib/i18n/client";
import { LinkifiedText } from "@/components/ui/LinkifiedText";

interface PlaceCommentsThreadProps {
  placeId: string;
  placeName?: string;
  placeCity?: string | null;
  placeAddress?: string | null;
  privateNotes?: string | null;
  personalRating?: number | null;
  currentUserId: string;
  isAdmin: boolean;
  isOpen: boolean;
  onClose: () => void;
  onCommentsCountChange?: (count: number) => void;
  onPrivateNotesSaved?: (notes: string | null) => void;
  onOpenPrivateNotesModal?: () => void;
}

/**
 * Renderizador de texto enriquecido ligero (soporta negrita, cursiva, tachado, citas, viñetas y enlaces).
 */
function FormattedCommentContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="text-slate-700 dark:text-slate-300 text-xs sm:text-[13px] space-y-1 leading-relaxed">
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
              className="border-l-2 border-orange-500/80 pl-2.5 py-0.5 text-slate-600 dark:text-slate-400 italic bg-orange-50/50 dark:bg-orange-950/20 rounded-r-md text-xs"
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
              <span className="text-orange-600 dark:text-orange-400 font-bold leading-tight select-none">
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
  const tokenRegex =
    /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g;
  const parts = text.split(tokenRegex);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;

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
              className="text-orange-600 dark:text-orange-400 font-semibold underline hover:text-orange-700"
            >
              {label}
            </a>
          ) : (
            <span key={i}>{label}</span>
          );
        }

        if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
          return (
            <strong key={i} className="font-bold text-slate-900 dark:text-slate-100">
              {part.slice(2, -2)}
            </strong>
          );
        }

        if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
          return (
            <em key={i} className="italic">
              {part.slice(1, -1)}
            </em>
          );
        }

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
 * Editor enriquecido WYSIWYG ligero para comentarios y notas.
 */
function RichTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  onSubmit,
  isSubmitting,
  submitLabel = "Publicar comentario",
  onCancel,
  leftFooterSlot,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  rows?: number;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitLabel?: string;
  onCancel?: () => void;
  leftFooterSlot?: React.ReactNode;
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
    <div className="border border-slate-200/80 dark:border-slate-700/80 rounded-2xl bg-[#f8f9ff] dark:bg-slate-950/70 overflow-hidden focus-within:ring-2 focus-within:ring-orange-500/35 focus-within:border-orange-500 transition">
      {/* Barra de herramientas WYSIWYG */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/70 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            title="Negrita (**texto**)"
            onClick={() => wrapSelection("**", "**", "texto en negrita")}
            className="w-6 h-6 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800 rounded cursor-pointer"
          >
            B
          </button>
          <button
            type="button"
            title="Cursiva (*texto*)"
            onClick={() => wrapSelection("*", "*", "texto en cursiva")}
            className="w-6 h-6 flex items-center justify-center italic text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800 rounded cursor-pointer"
          >
            I
          </button>
          <button
            type="button"
            title="Lista con viñetas"
            onClick={() => insertPrefixAtLine("- ")}
            className="px-1.5 h-6 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800 rounded cursor-pointer text-[11px]"
          >
            • Lista
          </button>
          <button
            type="button"
            title="Cita o consejo destacado"
            onClick={() => insertPrefixAtLine("> ")}
            className="px-1.5 h-6 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800 rounded cursor-pointer text-[11px]"
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
            className="px-1.5 h-6 flex items-center justify-center text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-slate-800 rounded cursor-pointer text-[11px] font-semibold"
          >
            ✨ Plato
          </button>
        </div>

        {/* Toggle escribir / previsualizar */}
        <div className="flex items-center gap-0.5 bg-[#f2f3ff] dark:bg-slate-800 p-0.5 rounded-full text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setTab("write")}
            className={`px-2.5 py-0.5 rounded-full cursor-pointer transition ${
              tab === "write"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {t("comments.write")}
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`px-2.5 py-0.5 rounded-full cursor-pointer transition ${
              tab === "preview"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {t("comments.preview")}
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
          className="w-full px-3.5 py-2.5 text-xs sm:text-[13px] bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none resize-y min-h-[78px]"
        />
      ) : (
        <div className="p-3.5 min-h-[78px] bg-white/50 dark:bg-slate-950/40 text-left">
          {value.trim() ? (
            <FormattedCommentContent content={value} />
          ) : (
            <p className="text-slate-400 italic text-xs">{t("comments.preview_empty")}</p>
          )}
        </div>
      )}

      {/* Pie del editor */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-white dark:bg-slate-900/90 border-t border-slate-200/70 dark:border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          {leftFooterSlot || (
            <span className="text-[10px] text-slate-400">{t("comments.markdown_hint")}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
            >
              {t("comments.cancel")}
            </button>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || !value.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-xs transition cursor-pointer disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-sm leading-none">send</span>
            <span>{isSubmitting ? t("comments.saving") : submitLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlaceCommentsThread({
  placeId,
  placeName = "Establecimiento",
  placeCity,
  placeAddress,
  privateNotes,
  personalRating = null,
  currentUserId,
  isAdmin,
  isOpen,
  onClose,
  onCommentsCountChange,
  onPrivateNotesSaved,
  onOpenPrivateNotesModal,
}: PlaceCommentsThreadProps) {
  const { t } = useT();
  const [mounted, setMounted] = useState(false);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [composeMode, setComposeMode] = useState<"public" | "private">("public");
  const [filterTab, setFilterTab] = useState<"all" | "private" | "community">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [submitting, setSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const sortedComments = useMemo(() => {
    const copy = [...comments];
    copy.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });
    return copy;
  }, [comments, sortOrder]);

  const hasPrivateNote = Boolean(privateNotes && privateNotes.trim().length > 0);
  const totalNotesCount = comments.length + (hasPrivateNote ? 1 : 0);

  const initials = placeName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handlePublish() {
    if (!newContent.trim() || submitting) return;
    setSubmitting(true);

    if (composeMode === "private") {
      const combined = privateNotes?.trim()
        ? `${privateNotes.trim()}\n\n${newContent.trim()}`
        : newContent.trim();
      const res = await savePrivateNotesAction(placeId, combined);
      if (!res?.error) {
        onPrivateNotesSaved?.(combined);
        setNewContent("");
      }
      setSubmitting(false);
      return;
    }

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

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150 text-left"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Cabecera estilo Stitch */}
        <div className="px-5 sm:px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-orange-100/90 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-black text-base flex items-center justify-center shrink-0 border border-orange-200/60 dark:border-orange-900/50">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100 tracking-tight truncate">
                  {t("ui.comments_and_notes", { name: placeName })}
                </h3>
                {placeCity && (
                  <span className="px-2.5 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 text-[10px] font-bold shrink-0">
                    {placeCity}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                {placeAddress && (
                  <span className="inline-flex items-center gap-0.5 truncate max-w-[260px]">
                    <span className="material-symbols-outlined text-xs text-orange-600">location_on</span>
                    <span className="truncate">{placeAddress}</span>
                  </span>
                )}
                {placeAddress && <span className="text-slate-300 dark:text-slate-700">•</span>}
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {totalNotesCount} {totalNotesCount === 1 ? "nota registrada" : "notas registradas"}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#f2f3ff] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label="Cerrar comentarios"
          >
            <span className="material-symbols-outlined text-lg leading-none">close</span>
          </button>
        </div>

        {/* Línea degradada sutil */}
        <div className="h-[2px] w-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-500 opacity-80 shrink-0" />

        {/* Barra de filtros y orden */}
        <div className="px-5 sm:px-6 py-3 bg-[#f8f9ff] dark:bg-slate-900/80 border-b border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition cursor-pointer ${
                filterTab === "all"
                  ? "bg-orange-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/70 dark:border-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-sm leading-none">forum</span>
              <span>{t("places.all")} ({totalNotesCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("private")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition cursor-pointer ${
                filterTab === "private"
                  ? "bg-orange-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/70 dark:border-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-sm leading-none">lock</span>
              <span>{t("ui.my_private_notes")} ({hasPrivateNote ? 1 : 0})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("community")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition cursor-pointer ${
                filterTab === "community"
                  ? "bg-orange-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/70 dark:border-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-sm leading-none">public</span>
              <span>{t("ui.community")} ({comments.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">{t("ui.sort_label")}</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
              className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer focus:outline-none"
            >
              <option value="newest">{t("ui.sort_newest")}</option>
              <option value="oldest">{t("ui.sort_oldest")}</option>
            </select>
          </div>
        </div>

        {/* Cuerpo scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-[#faf8ff] dark:bg-[#0b1120]/40">
          {/* Caja para añadir reseña o nota privada */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-extrabold text-slate-800 dark:text-slate-100">
                Añadir reseña o apunte personal
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {composeMode === "private" ? "Solo visible para ti" : "Visible para tu comunidad"}
              </span>
            </div>

            <RichTextarea
              value={newContent}
              onChange={setNewContent}
              placeholder={
                composeMode === "private"
                  ? "Escribe tu nota privada: mesa favorita, plato a recordar, avisos..."
                  : t("comments.placeholder")
              }
              onSubmit={handlePublish}
              isSubmitting={submitting}
              submitLabel={composeMode === "private" ? t("ui.save_private_note") : t("ui.publish_comment")}
              leftFooterSlot={
                <div className="flex items-center gap-1 bg-[#f2f3ff] dark:bg-slate-800 p-0.5 rounded-full text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setComposeMode("public")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full transition cursor-pointer ${
                      composeMode === "public"
                        ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs leading-none">public</span>
                    <span>{t("ui.public_mode")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposeMode("private")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full transition cursor-pointer ${
                      composeMode === "private"
                        ? "bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs leading-none">lock</span>
                    <span>{t("ui.private_note_mode")}</span>
                  </button>
                </div>
              }
            />
          </div>

          {/* Cabecera del feed */}
          <div className="flex items-center justify-between text-[11px] px-0.5">
            <span className="font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Feed de experiencias registradas ({totalNotesCount})
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Sincronizado en tiempo real
            </span>
          </div>

          {/* Tarjeta de nota privada (si existe y el filtro la incluye) */}
          {(filterTab === "all" || filterTab === "private") && hasPrivateNote && (
            <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/50 border-l-4 border-l-amber-500 bg-amber-50/70 dark:bg-amber-950/20 p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-base leading-none">lock</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                        Tu apunte personal
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[10px] font-bold">
                        🔒 Nota privada solo para ti
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Confidencial {personalRating ? `• Valoración: ${personalRating}/10` : ""}
                    </div>
                  </div>
                </div>

                {onOpenPrivateNotesModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPrivateNotesModal();
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-sm leading-none">edit</span>
                    <span>Editar</span>
                  </button>
                )}
              </div>

              <div className="p-3 rounded-xl bg-white/85 dark:bg-slate-900/70 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                <FormattedCommentContent content={privateNotes || ""} />
              </div>
            </div>
          )}

          {/* Lista de comentarios de la comunidad */}
          {(filterTab === "all" || filterTab === "community") && (
            <>
              {loading ? (
                <div className="space-y-3">
                  <CommentSkeleton />
                  <CommentSkeleton />
                </div>
              ) : sortedComments.length === 0 ? (
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-8 text-center">
                  <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">
                    chat_bubble_outline
                  </span>
                  <p className="text-xs text-slate-400 italic mt-2">{t("comments.empty")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedComments.map((c) => {
                    const isOwn = c.userId === currentUserId;
                    const canEdit = isOwn;
                    const canDelete = isOwn || isAdmin;
                    const isEditing = editingCommentId === c.id;
                    const authorInitials = (c.authorName || "U")
                      .split(/\s+/)
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <div
                        key={c.id}
                        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                                isOwn
                                  ? "bg-orange-100 dark:bg-orange-950/70 text-orange-800 dark:text-orange-200"
                                  : "bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                              }`}
                            >
                              {authorInitials}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                                  {c.authorName}
                                </span>
                                {isOwn && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-orange-600 text-white text-[9px] font-black uppercase">
                                    TÚ
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                  Nota pública
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {new Date(c.createdAt).toLocaleDateString("es-ES", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </div>
                            </div>
                          </div>

                          {(canEdit || canDelete) && !isEditing && (
                            <div className="flex items-center gap-1 shrink-0">
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCommentId(c.id);
                                    setEditingContent(c.content);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-slate-800 transition cursor-pointer"
                                  title={t("comments.edit_tooltip")}
                                >
                                  <span className="material-symbols-outlined text-base leading-none">edit</span>
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(c.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition cursor-pointer"
                                  title={t("comments.delete_tooltip")}
                                >
                                  <span className="material-symbols-outlined text-base leading-none">delete</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {isEditing ? (
                          <RichTextarea
                            value={editingContent}
                            onChange={setEditingContent}
                            placeholder={t("comments.edit_placeholder")}
                            rows={2}
                            onSubmit={() => handleSaveEdit(c.id)}
                            isSubmitting={savingEdit}
                            submitLabel={t("comments.save_btn")}
                            onCancel={() => {
                              setEditingCommentId(null);
                              setEditingContent("");
                            }}
                          />
                        ) : (
                          <FormattedCommentContent content={c.content} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {filterTab === "private" && !hasPrivateNote && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-8 text-center">
              <span className="material-symbols-outlined text-3xl text-amber-400">lock</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Aún no tienes notas privadas en este sitio. Selecciona <strong>Nota privada</strong> arriba para añadir una.
              </p>
            </div>
          )}
        </div>

        {/* Pie del modal estilo Stitch */}
        <div className="px-5 sm:px-6 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-emerald-600">shield</span>
            <span className="hidden sm:inline">
              {t("ui.private_notes_privacy")}
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
