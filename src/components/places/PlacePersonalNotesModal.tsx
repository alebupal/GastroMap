"use client";

import { useState } from "react";
import {
  setPersonalRatingAction,
  savePrivateNotesAction,
} from "@/lib/actions/interactions";

interface PlacePersonalNotesModalProps {
  placeId: string;
  placeName: string;
  initialRating?: number | null;
  initialNotes?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (rating: number | null, notes: string | null) => void;
}

export function PlacePersonalNotesModal({
  placeId,
  placeName,
  initialRating = null,
  initialNotes = "",
  isOpen,
  onClose,
  onSave,
}: PlacePersonalNotesModalProps) {
  const [rating, setRating] = useState<number | "">(
    initialRating !== null && initialRating !== undefined ? initialRating : ""
  );
  const [notes, setNotes] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  async function handleSave() {
    setSaving(true);
    const parsedRating = rating === "" ? null : Number(rating);
    await Promise.all([
      setPersonalRatingAction(placeId, parsedRating),
      savePrivateNotesAction(placeId, notes),
    ]);
    onSave?.(parsedRating, notes || null);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col text-left">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            🔒 Notas y valoración privada
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Solo tú puedes ver esta nota y puntuación para <strong>{placeName}</strong>.
        </p>

        {/* Puntuación 0 a 10 */}
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Tu nota personal (0 - 10)
        </label>
        <div className="flex items-center gap-2 mb-4">
          <input
            type="number"
            min="0"
            max="10"
            step="0.5"
            value={rating}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") setRating("");
              else {
                const num = parseFloat(val);
                if (num >= 0 && num <= 10) setRating(num);
              }
            }}
            placeholder="Ej. 8.5"
            className="w-24 px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-bold text-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <span className="text-xs text-slate-400">sobre 10 ⭐</span>
          {rating !== "" && (
            <button
              type="button"
              onClick={() => setRating("")}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline ml-auto cursor-pointer"
            >
              Borrar nota
            </button>
          )}
        </div>

        {/* Notas privadas */}
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Apuntes privados
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Qué pedir, mesa favorita, precio aproximado, con quién fuiste..."
          className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 mb-4"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition cursor-pointer disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
