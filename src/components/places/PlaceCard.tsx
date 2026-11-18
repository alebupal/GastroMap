"use client";

import { useState } from "react";
import { deletePlaceAction } from "@/lib/actions/places";
import {
  toggleFavoriteAction,
  setPersonalStatusAction,
} from "@/lib/actions/interactions";
import { PlaceCommentsThread } from "./PlaceCommentsThread";
import { PlacePersonalNotesModal } from "./PlacePersonalNotesModal";

interface PlaceCardProps {
  place: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    googleMapsUrl: string | null;
    latitude?: number | null;
    longitude?: number | null;
    priceRange: string;
    notes: string | null;
    createdById: string;
    createdByName: string;
    createdByUsername?: string | null;
    createdAt: Date;
    occasions: string[];
    tags: string[];
    distanceMeters?: number | null;
    // Colección personal y estado
    isFavorite?: boolean;
    personalStatus?: "pending" | "visited" | null;
    rating?: number | null;
    privateNotes?: string | null;
    commentsCount?: number;
    experienceStatus?: "visited_by_me" | "visited_by_others" | "untried";
  };
  currentUserId: string;
  isAdmin: boolean;
  occasionMap?: Record<string, { name: string; icon: string }>;
  onSelectOnMap?: () => void;
}

export function PlaceCard({
  place,
  currentUserId,
  isAdmin,
  occasionMap = {},
  onSelectOnMap,
}: PlaceCardProps) {
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

  const canDelete = isAdmin || place.createdById === currentUserId;

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${place.name}" de GastroMap?`)) return;
    setDeleting(true);
    await deletePlaceAction(place.id);
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
    <div className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-xs hover:shadow-sm transition text-left flex flex-col justify-between gap-3">
      <div>
        {/* Fila superior: Estado personal, Experiencia, Favorito y Precio */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Experiencia */}
            {place.experienceStatus === "untried" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 border border-violet-200/50 dark:border-violet-800/30">
                ✨ Sin estrenar
              </span>
            )}
            {place.experienceStatus === "visited_by_others" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 border border-cyan-200/50 dark:border-cyan-800/30">
                👥 Probado por amigos
              </span>
            )}
            {place.experienceStatus === "visited_by_me" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/30">
                ✅ Ya has ido
              </span>
            )}

            {/* Puntuación personal si existe */}
            {rating !== null && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/30">
                ⭐ {rating}/10
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Botón Favorito */}
            <button
              type="button"
              onClick={handleToggleFavorite}
              className="text-base hover:scale-110 transition cursor-pointer p-0.5"
              title={favorite ? "Quitar de favoritos" : "Guardar en favoritos"}
            >
              {favorite ? "⭐" : "🤍"}
            </button>

            {/* Precio */}
            <span
              className={`px-2 py-0.5 rounded-md text-xs font-bold tracking-tight ${
                place.priceRange === "???"
                  ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40"
              }`}
            >
              {place.priceRange}
            </span>
          </div>
        </div>

        {/* Nombre y Distancia */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug">
                {place.name}
              </h3>
              {typeof place.distanceMeters === "number" && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40 text-[11px] font-semibold shrink-0">
                  📍 {place.distanceMeters < 1000
                    ? `${place.distanceMeters} m`
                    : `${(place.distanceMeters / 1000).toFixed(1)} km`}
                </span>
              )}
            </div>
            {(place.city || place.address) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {place.city ? `${place.city}` : ""}{place.city && place.address ? " • " : ""}{place.address || ""}
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
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200/60 dark:border-amber-800/30"
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
          <div className="flex flex-wrap gap-1 mt-2">
            {place.tags.map((t) => (
              <span
                key={t}
                className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Notas públicas del creador */}
        {place.notes && (
          <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
            «{place.notes}»
          </p>
        )}

        {/* Notas privadas personales (solo visibles por el usuario logueado) */}
        {privateNotes && (
          <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200/40 dark:border-amber-800/30 flex items-start justify-between gap-1">
            <span className="italic">🔒 {privateNotes}</span>
            <button
              type="button"
              onClick={() => setShowNotesModal(true)}
              className="text-[10px] text-amber-600 hover:underline shrink-0 cursor-pointer"
            >
              Editar
            </button>
          </div>
        )}

        {/* Barra de Colección Personal (Pendiente, Visitado, Notas Privadas) */}
        <div className="mt-3 flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <button
            type="button"
            onClick={() => handleStatusChange("pending")}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
              personalStatus === "pending"
                ? "bg-amber-500 text-slate-950 shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            🕒 {personalStatus === "pending" ? "Pendiente" : "Quiero ir"}
          </button>

          <button
            type="button"
            onClick={() => handleStatusChange("visited")}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
              personalStatus === "visited"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            ✅ {personalStatus === "visited" ? "Visitado" : "Ya he ido"}
          </button>

          <button
            type="button"
            onClick={() => setShowNotesModal(true)}
            className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer flex items-center gap-1 ml-auto"
            title="Añadir nota o puntuación privada"
          >
            📝 {rating !== null ? `${rating}★` : "Mi nota"}
          </button>
        </div>
      </div>

      {/* Pie de tarjeta: Autor, comentarios, Maps y Borrar */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[130px]">
          Por {place.createdByUsername ? `@${place.createdByUsername}` : place.createdByName}
        </span>

        <div className="flex items-center gap-2">
          {/* Botón de comentarios */}
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-amber-500 transition cursor-pointer"
          >
            💬 {commentsCount > 0 ? commentsCount : ""}
          </button>

          {hasCoords && onSelectOnMap && (
            <button
              onClick={onSelectOnMap}
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              🗺️ Mapa
            </button>
          )}

          {place.googleMapsUrl && (
            <a
              href={place.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Maps ↗
            </a>
          )}

          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-slate-400 hover:text-red-500 text-xs transition cursor-pointer disabled:opacity-40"
              title="Eliminar sitio"
            >
              🗑️
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
    </div>
  );
}
