"use client";

import { useState } from "react";
import { deletePlaceAction, type PlaceWithDetails } from "@/lib/actions/places";
import {
  setFavoriteAction,
  setPersonalStatusAction,
} from "@/lib/actions/interactions";
import { enqueueOfflineMutation } from "@/lib/offlineQueue";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";
import { PlaceCommentsThread } from "./PlaceCommentsThread";
import { PlacePersonalNotesModal } from "./PlacePersonalNotesModal";
import { EditPlaceModal } from "./EditPlaceModal";
import { LinkifiedText } from "@/components/ui/LinkifiedText";
import { OccasionIcon } from "@/components/ui/OccasionIcon";

const PRICE_RANGE_LABELS: Record<string, string> = {
  "€": "< 15 €",
  "€€": "15 - 30 €",
  "€€€": "30 - 50 €",
  "€€€€": "> 50 €",
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
  isCompared?: boolean;
  onToggleCompare?: () => void;
  isSelected?: boolean;
}

export function PlaceCard({
  place,
  currentUserId,
  isAdmin,
  occasionMap = {},
  occasionsList = [],
  availableTags = [],
  onSelectOnMap,
  isCompared = false,
  onToggleCompare,
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

  const canDelete = isAdmin;
  const canEdit = isAdmin || place.createdById === currentUserId;

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
        {/* Cabecera de Tarjeta: Avatar iniciales + Nombre + Dirección a la izquierda | Precio + Favorito a la derecha */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
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
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug">
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
              {(place.city || place.address) && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-orange-600 leading-none">location_on</span>
                  <span>{place.city ? `${place.city}` : ""}{place.city && place.address ? " • " : ""}{place.address || ""}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
          </div>
        </div>

        {/* Fila de Insignia de Estado Personal + Ocasiones / Categorías + Etiquetas */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
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
              <span className="material-symbols-outlined text-[13px] leading-none">auto_awesome</span>
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
              onClick={() => setShowNotesModal(true)}
              className="text-[10px] text-amber-700 dark:text-amber-400 font-bold hover:underline shrink-0 cursor-pointer"
            >
              {t("common.edit")}
            </button>
          </div>
        )}

        {/* Barra de Colección Personal (Quiero ir, Ya he ido, Mi nota) */}
        <div className="mt-3 flex items-center gap-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/60">
          <button
            type="button"
            onClick={() => handleStatusChange("pending")}
            aria-label={personalStatus === "pending" ? t("places.remove_pending") : t("places.add_pending")}
            className={`flex-1 py-1.5 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 active:scale-95 min-w-0 ${
              personalStatus === "pending"
                ? "bg-[#fea619] text-[#2a1700] shadow-xs"
                : "bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold"
            }`}
          >
            <span
              key={personalStatus === "pending" ? "pend-on" : "pend-off"}
              className={`material-symbols-outlined text-[15px] sm:text-base leading-none shrink-0 ${
                personalStatus === "pending" ? "gm-pop" : ""
              }`}
            >
              schedule
            </span>
            <span className="truncate">{t("cards.pending")}</span>
          </button>

          <button
            type="button"
            onClick={() => handleStatusChange("visited")}
            aria-label={personalStatus === "visited" ? t("places.remove_visited") : t("places.mark_visited")}
            className={`flex-1 py-1.5 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 active:scale-95 min-w-0 ${
              personalStatus === "visited"
                ? "bg-orange-600 text-white shadow-xs"
                : "bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold"
            }`}
          >
            <span
              key={personalStatus === "visited" ? "vis-on" : "vis-off"}
              className={`material-symbols-outlined text-[15px] sm:text-base leading-none shrink-0 ${
                personalStatus === "visited"
                  ? "text-white gm-pop"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              check_circle
            </span>
            <span className="truncate">{t("cards.visited")}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNotesModal(true)}
            aria-label={t("cards.add_note_tooltip")}
            className="py-1.5 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-semibold bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer flex items-center justify-center gap-1 shrink-0 active:scale-95"
            title={t("cards.add_note_tooltip")}
          >
            <span className="material-symbols-outlined text-sm leading-none text-orange-600">edit_note</span>
            <span>{rating !== null ? `${rating}★` : t("cards.private_note")}</span>
          </button>
        </div>
      </div>

      {/* Pie de tarjeta: Autor con avatar, comentarios, Maps y Acciones */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-900 font-bold text-[9px] flex items-center justify-center border border-orange-200">
            {(place.createdByUsername || place.createdByName || "A").charAt(0).toUpperCase()}
          </span>
          <span className="font-bold text-slate-700 dark:text-slate-300">
            @{place.createdByUsername || place.createdByName.toLowerCase().replace(/\s+/g, "")}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Botón de comentarios */}
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            aria-label={`${t("cards.comments")} (${commentsCount})`}
            className="inline-flex items-center gap-1 hover:text-orange-600 transition cursor-pointer px-1 py-0.5 whitespace-nowrap"
            title={t("cards.comments")}
          >
            <span className="material-symbols-outlined text-sm leading-none">chat_bubble_outline</span>
            <span>{commentsCount > 0 ? `${t("cards.comments")} (${commentsCount})` : t("cards.comments")}</span>
          </button>

          {onToggleCompare && (
            <button
              type="button"
              onClick={onToggleCompare}
              aria-pressed={isCompared}
              aria-label={isCompared ? t("places.remove_compare") : t("places.add_compare")}
              title={isCompared ? t("places.remove_compare") : t("places.compare_side_by_side")}
              className={`inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                isCompared
                  ? "px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/60 font-bold"
                  : "px-1 py-0.5 hover:text-orange-600"
              }`}
            >
              <span className="material-symbols-outlined text-sm leading-none">compare_arrows</span>
              <span>{t("cards.compare")}</span>
            </button>
          )}

          {hasCoords && onSelectOnMap && (
            <button
              onClick={onSelectOnMap}
              type="button"
              aria-label={t("places.view_map")}
              className="group inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-bold cursor-pointer px-1 py-0.5 whitespace-nowrap transition"
              title="Centrar en mapa"
            >
              <span className="material-symbols-outlined text-sm leading-none no-underline">explore</span>
              <span className="group-hover:underline underline-offset-2">{t("places.view_map")}</span>
            </button>
          )}

          {place.googleMapsUrl && (
            <a
              href={place.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Maps: ${place.name}`}
              className="inline-flex items-center gap-1 hover:text-orange-600 font-medium transition px-1 py-0.5 whitespace-nowrap"
              title="Abrir en Google Maps"
            >
              <span className="material-symbols-outlined text-sm leading-none">open_in_new</span>
              <span>Google Maps</span>
            </a>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              aria-label={t("cards.edit_tooltip")}
              className="text-slate-400 hover:text-orange-600 transition cursor-pointer p-0.5"
              title={t("cards.edit_tooltip")}
            >
              <span className="material-symbols-outlined text-sm leading-none">edit</span>
            </button>
          )}

          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              aria-label={t("cards.delete_tooltip")}
              className="text-slate-400 hover:text-red-500 transition cursor-pointer disabled:opacity-40 p-0.5"
              title={t("cards.delete_tooltip")}
            >
              <span className="material-symbols-outlined text-sm leading-none">delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal de comentarios y notas estilo Stitch */}
      <PlaceCommentsThread
        placeId={place.id}
        placeName={place.name}
        placeCity={place.city}
        placeAddress={place.address}
        privateNotes={privateNotes}
        personalRating={rating}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        onCommentsCountChange={(count) => setCommentsCount(count)}
        onPrivateNotesSaved={(newNotes) => setPrivateNotes(newNotes)}
        onOpenPrivateNotesModal={() => setShowNotesModal(true)}
      />

      {/* Modal de notas y valoración privada */}
      <PlacePersonalNotesModal
        placeId={place.id}
        placeName={place.name}
        initialRating={rating}
        initialNotes={privateNotes}
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        onSave={(newRating, newNotes) => {
          setRating(newRating);
          setPrivateNotes(newNotes);
        }}
      />

      {/* Modal de edición completa del establecimiento */}
      {canEdit && (
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
