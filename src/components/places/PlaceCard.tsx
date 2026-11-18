"use client";

import { useState } from "react";
import { deletePlaceAction } from "@/lib/actions/places";

interface PlaceCardProps {
  place: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    googleMapsUrl: string | null;
    priceRange: string;
    notes: string | null;
    createdById: string;
    createdByName: string;
    createdAt: Date;
    occasions: string[];
    tags: string[];
  };
  currentUserId: string;
  isAdmin: boolean;
  occasionMap?: Record<string, { name: string; icon: string }>;
}

export function PlaceCard({ place, currentUserId, isAdmin, occasionMap = {} }: PlaceCardProps) {
  const [deleting, setDeleting] = useState(false);
  const canDelete = isAdmin || place.createdById === currentUserId;

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${place.name}" de GastroMap?`)) return;
    setDeleting(true);
    await deletePlaceAction(place.id);
  }

  return (
    <div className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-xs hover:shadow-sm transition text-left flex flex-col justify-between gap-3">
      <div>
        {/* Cabecera de la tarjeta: Nombre y Precio */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug">
              {place.name}
            </h3>
            {(place.city || place.address) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                📍 {place.city ? `${place.city}` : ""}{place.city && place.address ? " • " : ""}{place.address || ""}
              </p>
            )}
          </div>

          <span
            className={`px-2 py-0.5 rounded-md text-xs font-bold tracking-tight shrink-0 ${
              place.priceRange === "???"
                ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40"
            }`}
          >
            {place.priceRange}
          </span>
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

        {/* Notas / Recomendaciones */}
        {place.notes && (
          <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
            «{place.notes}»
          </p>
        )}
      </div>

      {/* Pie de tarjeta: Autor, botón Maps y Borrar */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <span className="text-[11px]">Por {place.createdByName}</span>

        <div className="flex items-center gap-2">
          {place.googleMapsUrl && (
            <a
              href={place.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Google Maps ↗
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
    </div>
  );
}
