"use client";

import { useState, useEffect, memo } from "react";
import dynamic from "next/dynamic";
import { deletePlaceAction, type PlaceWithDetails } from "@/lib/actions/places";
import {
  setFavoriteAction,
  setPersonalStatusAction,
} from "@/lib/actions/interactions";
import { enqueueOfflineMutation } from "@/lib/offlineQueue";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";
import { LinkifiedText } from "@/components/ui/LinkifiedText";
import { OccasionIcon } from "@/components/ui/OccasionIcon";

const PlaceCommentsThread = dynamic(() =>
  import("./PlaceCommentsThread").then((m) => m.PlaceCommentsThread)
);
const PlacePersonalNotesModal = dynamic(() =>
  import("./PlacePersonalNotesModal").then((m) => m.PlacePersonalNotesModal)
);
const EditPlaceModal = dynamic(() =>
  import("./EditPlaceModal").then((m) => m.EditPlaceModal)
);
const AddToListModal = dynamic(() =>
  import("./AddToListModal").then((m) => m.AddToListModal)
);
const CopyPlaceModal = dynamic(() =>
  import("./CopyPlaceModal").then((m) => m.CopyPlaceModal)
);
import type { CopyTargetSpaceOption } from "./CopyPlaceModal";

const PRICE_RANGE_LABELS: Record<string, string> = {
  "€": "< 20 €",
  "€€": "20-30 €",
  "€€€": "30-40 €",
  "€€€€": "> 40 €",
  "???": "???",
};

interface PlaceCardProps {
  place: PlaceWithDetails;
  currentUserId: string;
  isAdmin: boolean;
  occasionMap?: Record<string, { name: string; icon: string }>;
  occasionsList?: Array<{ id: string; name: string; icon: string }>;
  availableTags?: string[];
  onSelectOnMap?: () => void;
  onSelectPlaceId?: (placeId: string) => void;
  isCompared?: boolean;
  onToggleCompare?: () => void;
  onToggleCompareId?: (placeId: string) => void;
  onPersonalUpdate?: (
    placeId: string,
    patch: Partial<Pick<PlaceWithDetails, "isFavorite" | "personalStatus" | "rating" | "privateNotes">>
  ) => void;
  availableSpaces?: CopyTargetSpaceOption[];
  showSpaceBadge?: boolean;
  isSpaceAdmin?: boolean;
  isSelected?: boolean;
}

function PlaceCardComponent({
  place,
  currentUserId,
  isAdmin,
  occasionMap = {},
  occasionsList = [],
  availableTags = [],
  onSelectOnMap,
  onSelectPlaceId,
  isCompared = false,
  onToggleCompare,
  onToggleCompareId,
  onPersonalUpdate,
  availableSpaces = [],
  showSpaceBadge = false,
  isSpaceAdmin = false,
  isSelected = false,
}: PlaceCardProps) {
  const { t } = useT();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [favorite, setFavorite] = useState(place.isFavorite ?? false);
  const [personalStatus, setPersonalStatus] = useState<"pending" | "visited" | null>(
    place.personalStatus ?? null
  );
  const [rating, setRating] = useState<number | null>(place.rating ?? null);
  const [privateNotes, setPrivateNotes] = useState<string | null>(place.privateNotes ?? null);
  const [commentsCount, setCommentsCount] = useState(place.commentsCount ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copiedPlace, setCopiedPlace] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  // Sincronizar estado local si cambian los datos externos (ej. importación o edición)
  useEffect(() => {
    setFavorite(place.isFavorite ?? false);
    setPersonalStatus(place.personalStatus ?? null);
    setRating(place.rating ?? null);
    setPrivateNotes(place.privateNotes ?? null);
    setCommentsCount(place.commentsCount ?? 0);
  }, [
    place.isFavorite,
    place.personalStatus,
    place.rating,
    place.privateNotes,
    place.commentsCount,
  ]);

  function buildShareText() {
    const parts = [place.name];
    if (place.address || place.city) {
      parts.push([place.address, place.city].filter(Boolean).join(", "));
    }
    const mapsLink =
      place.googleMapsUrl ||
      (place.latitude != null && place.longitude != null
        ? `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
        : "");
    if (mapsLink) parts.push(mapsLink);
    return { text: parts.join(" — "), mapsLink };
  }

  async function handleCopyPlace() {
    const { text } = buildShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPlace(true);
      setShowShareMenu(false);
      toast(t("cards.copied_place_toast"), { kind: "success" });
      setTimeout(() => setCopiedPlace(false), 1800);
    } catch {
      // Fallback silencioso si el navegador bloquea el portapapeles
    }
  }

  async function handleNativeShare() {
    const { text, mapsLink } = buildShareText();
    setShowShareMenu(false);
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: place.name,
          text,
          url: mapsLink || undefined,
        });
      } catch {
        // Usuario canceló el diálogo nativo
      }
    }
  }

  function handleWhatsAppShare() {
    const { text } = buildShareText();
    setShowShareMenu(false);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function handleInstagramShare() {
    const { text } = buildShareText();
    setShowShareMenu(false);
    try {
      await navigator.clipboard.writeText(text);
      toast(t("cards.instagram_copied_toast"), { kind: "info" });
    } catch {
      // Fallback silencioso
    }
    window.open("https://www.instagram.com/direct/inbox/", "_blank", "noopener,noreferrer");
  }

  const canDelete = place.canDelete ?? (isAdmin || isSpaceAdmin || place.createdById === currentUserId);
  const canEdit = place.canEdit ?? (isAdmin || isSpaceAdmin || place.createdById === currentUserId);
  const canCopyToOtherSpace = availableSpaces.some((s) =>
    s.isPersonal ? place.groupId !== null : s.id !== place.groupId
  );

  async function handleDelete() {
    if (!confirm(t("places.delete_confirm", { name: place.name }))) return;
    setDeleting(true);
    const res = await deletePlaceAction(place.id);
    if (res?.error) {
      setDeleting(false);
      toast(res.error, { kind: "error" });
    } else {
      toast(t("places.delete_success", { name: place.name }), { kind: "success" });
    }
  }

  async function handleToggleFavorite() {
    const nextFav = !favorite;
    setFavorite(nextFav);
    onPersonalUpdate?.(place.id, { isFavorite: nextFav });
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueueOfflineMutation({
        type: "set_favorite",
        placeId: place.id,
        favorite: nextFav,
      });
      toast(t("offline.queued_toast"), { kind: "info" });
      return;
    }
    try {
      await setFavoriteAction(place.id, nextFav);
    } catch {
      await enqueueOfflineMutation({
        type: "set_favorite",
        placeId: place.id,
        favorite: nextFav,
      });
      toast(t("offline.queued_toast"), { kind: "info" });
    }
  }

  async function handleStatusChange(newStatus: "pending" | "visited" | null) {
    const finalStatus = personalStatus === newStatus ? null : newStatus;
    setPersonalStatus(finalStatus);
    onPersonalUpdate?.(place.id, { personalStatus: finalStatus });
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueueOfflineMutation({
        type: "set_status",
        placeId: place.id,
        status: finalStatus,
      });
      toast(t("offline.queued_toast"), { kind: "info" });
      return;
    }
    try {
      await setPersonalStatusAction(place.id, finalStatus);
    } catch {
      await enqueueOfflineMutation({
        type: "set_status",
        placeId: place.id,
        status: finalStatus,
      });
      toast(t("offline.queued_toast"), { kind: "info" });
    }
  }

  const hasCoords = place.latitude != null && place.longitude != null;

  return (
    <article
      id={`place-card-${place.id}`}
      className={`w-full p-4 rounded-2xl border gm-card-hover text-left flex flex-col justify-between gap-3 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md relative ${
        isSelected
          ? "ring-2 ring-orange-500/50 border-orange-500 shadow-md gm-focus-pulse"
          : "border-slate-200/80 dark:border-slate-800"
      }`}
    >
      <div>
        {/* Cabecera de Tarjeta: Avatar iniciales + Nombre a la izquierda | Precio + Favorito + Menú a la derecha */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/80 text-orange-900 dark:text-orange-200 font-bold text-sm flex items-center justify-center shrink-0 shadow-xs border border-orange-200/60 dark:border-orange-800/60">
              {place.name
                .split(/\s+/)
                .filter(Boolean)
                .map((w) => w.charAt(0))
                .slice(0, 2)
                .join("")
                .toUpperCase() || "🍴"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-[15px] sm:text-base leading-snug break-words">
                  {place.name}
                </h3>
                {typeof place.distanceMeters === "number" && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 text-[10px] font-semibold shrink-0">
                    <span className="material-symbols-outlined text-[12px] leading-none">near_me</span>
                    <span>
                      {place.distanceMeters < 1000
                        ? `${place.distanceMeters} m`
                        : `${(place.distanceMeters / 1000).toFixed(1)} km`}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="px-2 py-0.5 rounded-full bg-[#6ffbbe] text-[#005236] font-bold text-[11px] shadow-xs">
              {PRICE_RANGE_LABELS[place.priceRange] || place.priceRange}
            </span>
            <button
              type="button"
              onClick={handleToggleFavorite}
              className="text-slate-400 hover:text-red-500 p-0.5 transition cursor-pointer hover:scale-110"
              title={favorite ? t("places.remove_favorite") : t("places.add_favorite")}
              aria-label={favorite ? t("places.remove_favorite") : t("places.add_favorite")}
            >
              <span
                key={favorite ? "fav-on" : "fav-off"}
                className={`material-symbols-outlined text-lg leading-none ${favorite ? "text-red-500 gm-pop" : ""}`}
                style={favorite ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                favorite
              </span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowActionsMenu((prev) => !prev)}
                aria-label={t("common.actions")}
                aria-expanded={showActionsMenu}
                title={t("common.actions")}
                className={`p-1 rounded-full transition cursor-pointer active:scale-95 ${
                  showActionsMenu
                    ? "bg-[#f2f3ff] dark:bg-slate-800 text-orange-600 dark:text-orange-400"
                    : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className="material-symbols-outlined text-lg leading-none">more_vert</span>
              </button>

              {showActionsMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowActionsMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-xl z-50 p-1.5 space-y-0.5 gm-popover-in">
                    <button
                      type="button"
                      onClick={() => {
                        setShowActionsMenu(false);
                        setShowAddToListModal(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-[#f2f3ff] dark:hover:bg-slate-800 transition cursor-pointer text-left"
                    >
                      <span className="material-symbols-outlined text-base leading-none text-orange-600">bookmark_add</span>
                      <span>{t("lists.save_to_list_action")}</span>
                    </button>
                    {canCopyToOtherSpace && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowActionsMenu(false);
                          setShowCopyModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-[#f2f3ff] dark:hover:bg-slate-800 transition cursor-pointer text-left"
                      >
                        <span className="material-symbols-outlined text-base leading-none text-orange-600">library_add</span>
                        <span>{t("spaces.copy_to_space_menu")}</span>
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowActionsMenu(false);
                          setShowEditModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-[#f2f3ff] dark:hover:bg-slate-800 transition cursor-pointer text-left"
                      >
                        <span className="material-symbols-outlined text-base leading-none text-orange-600">edit</span>
                        <span>{t("common.edit")}</span>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowActionsMenu(false);
                          handleDelete();
                        }}
                        disabled={deleting}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer disabled:opacity-40 text-left"
                      >
                        <span className="material-symbols-outlined text-base leading-none">delete</span>
                        <span>{t("common.delete")}</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Ubicación a ancho completo para que nunca se corte en móvil */}
        {(place.city || place.address) && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1 min-w-0">
            <span className="material-symbols-outlined text-sm text-orange-600 leading-none shrink-0">location_on</span>
            <span className="truncate">
              {place.city ? `${place.city}` : ""}
              {place.city && place.address ? " • " : ""}
              {place.address || ""}
            </span>
          </p>
        )}

        {/* Fila de Insignia de Espacio (en vista Todo junto) + Estado Personal + Ocasiones + Etiquetas */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          {showSpaceBadge && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-200/70 dark:border-orange-800/60 font-extrabold text-[10px]">
              <span>{place.groupId ? place.groupIcon || "🍻" : "🏠"}</span>
              <span>{place.groupId ? place.groupName || "Grupo" : t("spaces.personal_map")}</span>
            </span>
          )}
          {personalStatus === "visited" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
              <span className="material-symbols-outlined text-[13px] leading-none">check_circle</span>
              <span>{t("cards.visited")}</span>
            </span>
          ) : personalStatus === "pending" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 font-bold text-[11px]">
              <span className="material-symbols-outlined text-[13px] leading-none">schedule</span>
              <span>{t("places.want_to_go")}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ffddb8] text-[#684000] font-bold text-[11px]">
              <span className="material-symbols-outlined text-[12px] leading-none">auto_awesome</span>
              <span>{t("places.unexplored")}</span>
            </span>
          )}

          {/* Ocasiones / Categorías */}
          {place.occasions.map((occId) => {
            const info = occasionMap[occId] || { name: occId, icon: "🏷️" };
            return (
              <span
                key={occId}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px]"
              >
                <OccasionIcon icon={info.icon} msClassName="text-[13px]" />
                <span>{info.name}</span>
              </span>
            );
          })}

          {/* Etiquetas gastronómicas */}
          {place.tags.map((tg) => (
            <span
              key={tg}
              className="px-1.5 py-0.5 rounded bg-[#f2f3ff] dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 text-[11px]"
            >
              #{tg}
            </span>
          ))}
        </div>

        {/* Notas públicas del creador */}
        {place.notes && (
          <p className="mt-2 text-xs text-slate-700 dark:text-slate-300 italic bg-amber-50/60 dark:bg-slate-800/40 p-2.5 rounded-xl border-l-2 border-orange-500/80">
            «<LinkifiedText text={place.notes} />»
          </p>
        )}

        {/* Notas privadas personales (solo visibles por el usuario logueado) */}
        {privateNotes && (
          <div className="mt-2 text-xs text-amber-900 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/40 flex items-start justify-between gap-2">
            <span className="italic inline-flex items-start gap-1">
              <span className="material-symbols-outlined text-[14px] leading-none mt-0.5 text-amber-600 dark:text-amber-400 shrink-0">
                lock
              </span>
              <span>
                <LinkifiedText text={privateNotes} />
              </span>
            </span>
            <button
              type="button"
              onClick={() => setShowComments(true)}
              className="text-[10px] text-amber-700 dark:text-amber-400 font-bold hover:underline shrink-0 cursor-pointer"
            >
              {t("common.edit")}
            </button>
          </div>
        )}

        {/* Barra de Colección Personal (Quiero ir, Ya he ido, Mi nota) */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/60">
          <button
            type="button"
            onClick={() => handleStatusChange("pending")}
            aria-label={personalStatus === "pending" ? t("places.remove_pending") : t("places.add_pending")}
            className={`py-2 sm:py-1.5 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 active:scale-95 min-w-0 ${
              personalStatus === "pending"
                ? "bg-[#fea619] text-[#2a1700] shadow-xs"
                : "bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold"
            }`}
          >
            <span
              key={personalStatus === "pending" ? "pend-on" : "pend-off"}
              className={`material-symbols-outlined text-[16px] leading-none shrink-0 ${
                personalStatus === "pending" ? "gm-pop" : ""
              }`}
            >
              schedule
            </span>
            <span className="leading-tight whitespace-nowrap">{t("cards.pending")}</span>
          </button>

          <button
            type="button"
            onClick={() => handleStatusChange("visited")}
            aria-label={personalStatus === "visited" ? t("places.remove_visited") : t("places.mark_visited")}
            className={`py-2 sm:py-1.5 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 active:scale-95 min-w-0 ${
              personalStatus === "visited"
                ? "bg-orange-600 text-white shadow-xs"
                : "bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold"
            }`}
          >
            <span
              key={personalStatus === "visited" ? "vis-on" : "vis-off"}
              className={`material-symbols-outlined text-[16px] leading-none shrink-0 ${
                personalStatus === "visited"
                  ? "text-white gm-pop"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              check_circle
            </span>
            <span className="leading-tight whitespace-nowrap">{t("cards.visited")}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNotesModal(true)}
            aria-label={t("cards.add_note_tooltip")}
            className={`py-2 sm:py-1.5 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-semibold transition cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 active:scale-95 min-w-0 ${
              rating !== null
                ? "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 font-bold"
                : "bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
            title={t("cards.add_note_tooltip")}
          >
            <span
              className="material-symbols-outlined text-[16px] leading-none text-amber-500 shrink-0"
              style={rating !== null ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              star
            </span>
            <span className="leading-tight whitespace-nowrap">
              {rating !== null ? `${rating} / 10` : t("cards.private_note")}
            </span>
          </button>
        </div>
      </div>

      {/* Pie de tarjeta: en móvil barra uniforme de acciones + autor abajo; en desktop 1 fila horizontal */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-2">
        <div className="flex items-center gap-1.5 shrink-0 pt-1 sm:pt-0 border-t border-slate-100/80 dark:border-slate-800/50 sm:border-t-0">
          <span className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-900 dark:text-orange-200 font-bold text-[9px] flex items-center justify-center border border-orange-200/70 dark:border-orange-800/60">
            {(place.createdByUsername || place.createdByName || "A").charAt(0).toUpperCase()}
          </span>
          <span className="font-bold text-slate-700 dark:text-slate-300">
            @{place.createdByUsername || place.createdByName.toLowerCase().replace(/\s+/g, "")}
          </span>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-1 sm:gap-2 sm:flex-wrap w-full sm:w-auto">
          {/* Botón de comentarios */}
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            aria-label={`${t("cards.comments")} (${commentsCount})`}
            className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 hover:text-orange-600 hover:bg-[#f2f3ff] dark:hover:bg-slate-800/80 sm:hover:bg-transparent transition cursor-pointer py-1.5 sm:py-0.5 px-0.5 sm:px-1 rounded-xl whitespace-nowrap"
            title={t("cards.comments")}
          >
            <span className="relative inline-flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] sm:text-sm leading-none">chat_bubble_outline</span>
              {commentsCount > 0 && (
                <span className="sm:hidden absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-orange-600 text-white text-[9px] font-extrabold flex items-center justify-center leading-none shadow-xs">
                  {commentsCount}
                </span>
              )}
            </span>
            <span className="text-[9.5px] sm:text-[11px] leading-tight">
              <span className="sm:hidden">{t("cards.comments")}</span>
              <span className="hidden sm:inline">
                {commentsCount > 0 ? `${t("cards.comments")} (${commentsCount})` : t("cards.comments")}
              </span>
            </span>
          </button>

          {(onToggleCompareId || onToggleCompare) && (
            <button
              type="button"
              onClick={() => (onToggleCompareId ? onToggleCompareId(place.id) : onToggleCompare?.())}
              aria-pressed={isCompared}
              aria-label={isCompared ? t("places.remove_compare") : t("places.add_compare")}
              title={isCompared ? t("places.remove_compare") : t("places.compare_side_by_side")}
              className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 transition cursor-pointer whitespace-nowrap rounded-xl py-1.5 sm:py-0.5 px-0.5 sm:px-1 ${
                isCompared
                  ? "sm:px-2 sm:rounded-full bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/60 font-bold"
                  : "hover:text-orange-600 hover:bg-[#f2f3ff] dark:hover:bg-slate-800/80 sm:hover:bg-transparent"
              }`}
            >
              <span className="material-symbols-outlined text-[16px] sm:text-sm leading-none">compare_arrows</span>
              <span className="text-[9.5px] sm:text-[11px] leading-tight">{t("cards.compare")}</span>
            </button>
          )}

          {hasCoords && (onSelectPlaceId || onSelectOnMap) && (
            <button
              onClick={() => (onSelectPlaceId ? onSelectPlaceId(place.id) : onSelectOnMap?.())}
              type="button"
              aria-label={t("places.view_map")}
              className="group flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/40 sm:hover:bg-transparent font-bold cursor-pointer py-1.5 sm:py-0.5 px-0.5 sm:px-1 rounded-xl whitespace-nowrap transition"
              title="Centrar en mapa"
            >
              <span className="material-symbols-outlined text-[16px] sm:text-sm leading-none no-underline">explore</span>
              <span className="text-[9.5px] sm:text-[11px] leading-tight group-hover:underline underline-offset-2">{t("places.view_map")}</span>
            </button>
          )}

          {place.googleMapsUrl && (
            <a
              href={place.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Maps: ${place.name}`}
              className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 hover:text-orange-600 hover:bg-[#f2f3ff] dark:hover:bg-slate-800/80 sm:hover:bg-transparent font-medium transition py-1.5 sm:py-0.5 px-0.5 sm:px-1 rounded-xl whitespace-nowrap"
              title="Abrir en Google Maps"
            >
              <span className="material-symbols-outlined text-[16px] sm:text-sm leading-none">open_in_new</span>
              <span className="text-[9.5px] sm:text-[11px] leading-tight">
                <span className="sm:hidden">Maps</span>
                <span className="hidden sm:inline">Google Maps</span>
              </span>
            </a>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowShareMenu((prev) => !prev)}
              aria-label={t("cards.copy_place_tooltip")}
              aria-expanded={showShareMenu}
              title={t("cards.copy_place_tooltip")}
              className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 transition cursor-pointer py-1.5 sm:py-0.5 px-1 rounded-xl active:scale-95 ${
                copiedPlace
                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                  : showShareMenu
                  ? "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 sm:bg-transparent font-bold"
                  : "hover:text-orange-600 hover:bg-[#f2f3ff] dark:hover:bg-slate-800/80 sm:hover:bg-transparent"
              }`}
            >
              <span
                key={copiedPlace ? "copy-ok" : "copy-idle"}
                className={`material-symbols-outlined text-[16px] sm:text-sm leading-none ${copiedPlace ? "gm-pop" : ""}`}
              >
                {copiedPlace ? "check" : "share"}
              </span>
              <span className="text-[9.5px] sm:text-[11px] leading-tight">{t("cards.copy_place")}</span>
            </button>

            {showShareMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowShareMenu(false)}
                />
                <div className="absolute right-0 bottom-full mb-1.5 w-44 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-xl z-50 p-1.5 space-y-0.5 gm-popover-in">
                  <button
                    type="button"
                    onClick={handleWhatsAppShare}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition cursor-pointer text-left"
                  >
                    <span className="material-symbols-outlined text-base leading-none">chat</span>
                    <span>{t("cards.share_whatsapp")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleInstagramShare}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/50 transition cursor-pointer text-left"
                  >
                    <span className="material-symbols-outlined text-base leading-none">photo_camera</span>
                    <span>{t("cards.share_instagram")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPlace}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-[#f2f3ff] dark:hover:bg-slate-800 transition cursor-pointer text-left"
                  >
                    <span className="material-symbols-outlined text-base leading-none text-slate-500">content_copy</span>
                    <span>{t("cards.copy_place_tooltip")}</span>
                  </button>
                  {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-[#f2f3ff] dark:hover:bg-slate-800 transition cursor-pointer text-left"
                    >
                      <span className="material-symbols-outlined text-base leading-none text-orange-600">ios_share</span>
                      <span>{t("cards.share_native")}</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modales montados bajo demanda solo cuando están abiertos (evita 80 instancias inactivas en lista) */}
      {showComments && (
        <PlaceCommentsThread
          placeId={place.id}
          placeName={place.name}
          placeCity={place.city}
          placeAddress={place.address}
          privateNotes={privateNotes}
          personalRating={rating}
          currentUserId={currentUserId}
          isAdmin={isAdmin || isSpaceAdmin}
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          onCommentsCountChange={(count) => setCommentsCount(count)}
          onPrivateNotesSaved={(newNotes) => {
            setPrivateNotes(newNotes);
            onPersonalUpdate?.(place.id, { privateNotes: newNotes });
          }}
          onOpenPrivateNotesModal={() => setShowNotesModal(true)}
        />
      )}

      {showNotesModal && (
        <PlacePersonalNotesModal
          placeId={place.id}
          placeName={place.name}
          initialRating={rating}
          initialNotes={privateNotes}
          isOpen={showNotesModal}
          onClose={() => setShowNotesModal(false)}
          onSave={(newRating) => {
            setRating(newRating);
            onPersonalUpdate?.(place.id, { rating: newRating });
          }}
        />
      )}

      {showAddToListModal && (
        <AddToListModal
          placeId={place.id}
          placeName={place.name}
          isOpen={showAddToListModal}
          onClose={() => setShowAddToListModal(false)}
        />
      )}

      {showCopyModal && (
        <CopyPlaceModal
          placeId={place.id}
          placeName={place.name}
          currentGroupId={place.groupId ?? null}
          availableSpaces={availableSpaces}
          isOpen={showCopyModal}
          onClose={() => setShowCopyModal(false)}
        />
      )}

      {canEdit && showEditModal && (
        <EditPlaceModal
          place={place}
          occasionsList={
            occasionsList.length > 0
              ? occasionsList
              : Object.entries(occasionMap).map(([id, info]) => ({
                id,
                name: info.name,
                icon: info.icon,
              }))
          }
          availableTags={availableTags}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </article>
  );
}

export const PlaceCard = memo(PlaceCardComponent);
