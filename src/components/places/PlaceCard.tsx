"use client";

import { useState } from "react";
import { deletePlaceAction, type PlaceWithDetails } from "@/lib/actions/places";
import {
  toggleFavoriteAction,
  setPersonalStatusAction,
} from "@/lib/actions/interactions";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";
import { PlaceCommentsThread } from "./PlaceCommentsThread";
import { PlacePersonalNotesModal } from "./PlacePersonalNotesModal";
import { EditPlaceModal } from "./EditPlaceModal";
import { LinkifiedText } from "@/components/ui/LinkifiedText";

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
    await toggleFavoriteAction(place.id);
  }

  async function handleStatusChange(newStatus: "pending" | "visited" | null) {
    const finalStatus = personalStatus === newStatus ? null : newStatus;
    setPersonalStatus(finalStatus);
    await setPersonalStatusAction(place.id, finalStatus);
  }

  const hasCoords = place.latitude != null && place.longitude != null;

  return (
    <div
      id={`place-card-${place.id}`}
      className={`w-full p-4 sm:p-5 rounded-3xl border transition-all duration-300 text-left flex flex-col justify-between gap-3.5 backdrop-blur-xs ${isSelected
        ? "border-amber-500 ring-2 ring-amber-500/50 shadow-xl bg-amber-500/5 dark:bg-amber-500/10"
        : "border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-900/90 hover:border-slate-300 dark:hover:border-slate-700/80 shadow-md hover:shadow-xl"
        }`}
    >
      <div>
        {/* Fila superior: Estado personal, Experiencia, Favorito y Precio */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Experiencia */}
            {place.experienceStatus === "untried" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50">
                ✨ {t("cards.untried_badge")}
              </span>
            )}
            {place.experienceStatus === "visited_by_others" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/50">
                👥 {t("cards.friends_badge")}
              </span>
            )}
            {place.experienceStatus === "visited_by_me" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                ✅ {t("cards.visited_badge")}
              </span>
            )}

            {/* Puntuación personal si existe */}
            {rating !== null && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                ⭐ {rating}/10
              </span>
            )}

            {/* Estado del establecimiento si no está activo */}
            {place.status === "temporarily_closed" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
                ⏸️ {t("cards.closed_temp")}
              </span>
            )}
            {place.status === "permanently_closed" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800/60">
                🚫 {t("cards.closed_perm")}
              </span>
            )}

            {/* Indicador de ficha privada o compartida con grupos */}
            {!place.communityPublished &&
              place.sharedGroupNames &&
              place.sharedGroupNames.length > 0 ? (
              place.sharedGroupNames.map((gName) => (
                <span
                  key={gName}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60"
                >
                  👥 {gName}
                </span>
              ))
            ) : !place.communityPublished ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                🔒 {t("cards.private_badge")}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Botón Favorito */}
            <button
              type="button"
              onClick={handleToggleFavorite}
              className="text-base hover:scale-125 active:scale-95 transition cursor-pointer p-1 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg"
              title={favorite ? t("places.remove_favorite") : t("places.add_favorite")}
              aria-label={favorite ? t("places.remove_favorite") : t("places.add_favorite")}
            >
              {favorite ? "⭐" : "🤍"}
            </button>

            {/* Precio */}
            <span
              className={`px-2.5 py-0.5 rounded-lg text-xs font-black tracking-tight border ${place.priceRange === "???"
                ? "bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/60"
                : "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                }`}
            >
              {PRICE_RANGE_LABELS[place.priceRange] || place.priceRange}
            </span>
          </div>
        </div>

        {/* Nombre y Distancia */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base leading-snug">
                {place.name}
              </h3>
              {typeof place.distanceMeters === "number" && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 text-[11px] font-semibold shrink-0">
                  📍 {place.distanceMeters < 1000
                    ? `${place.distanceMeters} m`
                    : `${(place.distanceMeters / 1000).toFixed(1)} km`}
                </span>
              )}
            </div>
            {(place.city || place.address) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate flex items-center gap-1">
                <span>📍</span>
                <span>{place.city ? `${place.city}` : ""}{place.city && place.address ? " • " : ""}{place.address || ""}</span>
              </p>
            )}
          </div>
        </div>

        {/* Ocasiones / Planes (Multi-selección) */}
        {place.occasions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {place.occasions.map((occId) => {
              const info = occasionMap[occId] || { name: occId, icon: "🏷️" };
              return (
                <span
                  key={occId}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/40"
                >
                  <span>{info.icon}</span>
                  <span>{info.name}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Etiquetas gastronómicas visuales */}
        {place.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {place.tags.map((t) => (
              <span
                key={t}
                className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 font-medium"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Notas públicas del creador */}
        {place.notes && (
          <p className="mt-2.5 text-xs text-slate-700 dark:text-slate-300 italic bg-amber-50/60 dark:bg-slate-800/40 p-2.5 rounded-2xl border-l-2 border-amber-500/80">
            «<LinkifiedText text={place.notes} />»
          </p>
        )}

        {/* Notas privadas personales (solo visibles por el usuario logueado) */}
        {privateNotes && (
          <div className="mt-2 text-xs text-amber-900 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/30 p-2.5 rounded-2xl border border-amber-200 dark:border-amber-800/40 flex items-start justify-between gap-2">
            <span className="italic">
              🔒 <LinkifiedText text={privateNotes} />
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
        <div className="mt-3.5 flex items-center gap-2 flex-wrap pt-2.5 border-t border-slate-200 dark:border-slate-800/60">
          <button
            type="button"
            onClick={() => handleStatusChange("pending")}
            aria-label={personalStatus === "pending" ? t("places.remove_pending") : t("places.add_pending")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 active:scale-95 ${personalStatus === "pending"
              ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
              : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/50"
              }`}
          >
            🕒 {personalStatus === "pending" ? t("cards.pending") : t("cards.want_to_go")}
          </button>

          <button
            type="button"
            onClick={() => handleStatusChange("visited")}
            aria-label={personalStatus === "visited" ? t("places.remove_visited") : t("places.mark_visited")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 active:scale-95 ${personalStatus === "visited"
              ? "bg-emerald-600 text-white font-bold shadow-sm"
              : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/50"
              }`}
          >
            ✅ {personalStatus === "visited" ? t("cards.visited") : t("cards.visited")}
          </button>

          <button
            type="button"
            onClick={() => setShowNotesModal(true)}
            aria-label={t("cards.add_note_tooltip")}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/50 transition cursor-pointer flex items-center gap-1.5 ml-auto active:scale-95"
            title={t("cards.add_note_tooltip")}
          >
            📝 {rating !== null ? `${rating}★` : t("cards.private_note")}
          </button>
        </div>
      </div>

      {/* Pie de tarjeta: Autor, comentarios, Maps y Borrar */}
      <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 flex-wrap gap-x-3 gap-y-2">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
          {t("cards.by_author", { author: place.createdByUsername || place.createdByName.toLowerCase().replace(/\s+/g, "") })}
        </span>

        <div className="flex items-center justify-end gap-x-2.5 gap-y-1.5 flex-wrap flex-1 min-w-0">
          {/* Botón de comentarios */}
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            aria-label={`${t("cards.comments")} (${commentsCount})`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-amber-500 transition cursor-pointer p-1 rounded-lg whitespace-nowrap"
            title={t("cards.comments")}
          >
            <span>💬</span>
            <span>{commentsCount > 0 ? `${t("cards.comments")} (${commentsCount})` : t("cards.comments")}</span>
          </button>

          {hasCoords && onSelectOnMap && (
            <button
              onClick={onSelectOnMap}
              type="button"
              aria-label={t("places.view_map")}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer p-1 rounded-lg whitespace-nowrap"
            >
              <span>🗺️</span>
              <span>{t("places.view_map")}</span>
            </button>
          )}

          {place.googleMapsUrl && (
            <a
              href={place.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Maps: ${place.name}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline p-1 whitespace-nowrap"
            >
              <span>📍</span>
              <span>Maps ↗</span>
            </a>
          )}

          {onToggleCompare && (
            <button
              type="button"
              onClick={onToggleCompare}
              aria-label={isCompared ? t("places.remove_compare") : t("places.add_compare")}
              className={`inline-flex items-center gap-1 text-xs font-semibold transition cursor-pointer px-1.5 py-1 rounded-lg whitespace-nowrap ${isCompared
                ? "bg-amber-500 text-slate-950 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-amber-500"
                }`}
              title={isCompared ? t("places.remove_compare") : t("places.compare_side_by_side")}
            >
              <span>⚖️</span>
              <span>{t("cards.compare")}</span>
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              aria-label={t("cards.edit_tooltip")}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-amber-500 text-xs font-semibold transition cursor-pointer p-1 whitespace-nowrap"
              title={t("cards.edit_tooltip")}
            >
              <span>✏️</span>
              <span>{t("common.edit")}</span>
            </button>
          )}

          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              aria-label={t("cards.delete_tooltip")}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-red-500 text-xs font-semibold transition cursor-pointer disabled:opacity-40 p-1 whitespace-nowrap"
              title={t("cards.delete_tooltip")}
            >
              <span>🗑️</span>
              <span>{t("common.delete")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Hilo de comentarios colaborativos desplegable */}
      <PlaceCommentsThread
        placeId={place.id}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        onCommentsCountChange={(count) => setCommentsCount(count)}
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
    </div>
  );
}
