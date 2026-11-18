"use client";

import { useState } from "react";
import { createPlaceAction, parseUrlAction } from "@/lib/actions/places";
import { TagInput } from "@/components/places/TagInput";
import type { Occasion } from "@/db/schema";

const PRICE_OPTIONS = [
  { id: "???", label: "??? (No sé)" },
  { id: "€", label: "€ (Económico)" },
  { id: "€€", label: "€€ (Medio)" },
  { id: "€€€", label: "€€€ (Alto)" },
  { id: "€€€€", label: "€€€€ (Lujo)" },
];

interface NewPlaceFormProps {
  initialUrl?: string;
  initialTitle?: string;
  availableOccasions: Occasion[];
  popularTags?: string[];
}

export function NewPlaceForm({
  initialUrl = "",
  initialTitle = "",
  availableOccasions,
  popularTags = [],
}: NewPlaceFormProps) {
  const [url, setUrl] = useState(initialUrl);
  const [name, setName] = useState(initialTitle);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [priceRange, setPriceRange] = useState("???");
  // Multi-selección de ocasiones
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>(
    availableOccasions.length > 0 ? [availableOccasions[0].id] : []
  );
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAutoResolve() {
    if (!url) return;
    setResolving(true);
    setError(null);
    try {
      const parsed = await parseUrlAction(url);
      if (parsed.name && !name) {
        setName(parsed.name);
      }
      if (parsed.latitude) {
        setLat(parsed.latitude.toString());
      }
      if (parsed.longitude) {
        setLng(parsed.longitude.toString());
      }
      if (parsed.resolvedUrl) {
        setUrl(parsed.resolvedUrl);
      }
    } catch {
      // Ignorar fallo de parseo
    } finally {
      setResolving(false);
    }
  }

  function toggleOccasion(id: string) {
    if (selectedOccasions.includes(id)) {
      setSelectedOccasions(selectedOccasions.filter((occ) => occ !== id));
    } else {
      setSelectedOccasions([...selectedOccasions, id]);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await createPlaceAction(formData);

    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* 1. Enlace de Google Maps */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Enlace de Google Maps (o compartido)
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            name="googleMapsUrl"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Pega enlace de Google Maps..."
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <button
            type="button"
            onClick={handleAutoResolve}
            disabled={resolving || !url}
            className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shrink-0 transition active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            {resolving ? "Leyendo..." : "Autocompletar"}
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Si pegas el enlace, intentaremos extraer el nombre y coordenadas automáticamente.
        </p>
      </div>

      {/* 2. Datos principales */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Nombre del sitio *
        </label>
        <input
          type="text"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Casa Paco, Restaurante El Mirador..."
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Ciudad / Población
          </label>
          <input
            type="text"
            name="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ej. Sevilla, Madrid..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Dirección / Zona
          </label>
          <input
            type="text"
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ej. Triana, Calle Sierpes..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Coordenadas */}
      <input type="hidden" name="latitude" value={lat} />
      <input type="hidden" name="longitude" value={lng} />

      {/* 3. Para qué plan es (Ocasiones dinámicas en BD con multiselección) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            ¿Para qué plan es? (Puedes marcar varios)
          </label>
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            {selectedOccasions.length} {selectedOccasions.length === 1 ? "elegido" : "elegidos"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {availableOccasions.map((occ) => {
            const isSelected = selectedOccasions.includes(occ.id);
            return (
              <button
                type="button"
                key={occ.id}
                onClick={() => toggleOccasion(occ.id)}
                className={`py-2 px-2.5 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
                  isSelected
                    ? "bg-amber-500 text-white border-amber-600 shadow-xs font-semibold"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                }`}
              >
                <span>{occ.icon}</span>
                <span className="truncate">{occ.name}</span>
              </button>
            );
          })}
        </div>
        {selectedOccasions.map((occ) => (
          <input key={occ} type="hidden" name="occasions" value={occ} />
        ))}
      </div>

      {/* 4. Precio estimado */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          Presupuesto aproximado
        </label>
        <div className="flex gap-1.5">
          {PRICE_OPTIONS.map((p) => {
            const isSelected = priceRange === p.id;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => setPriceRange(p.id)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                  isSelected
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-xs"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                }`}
              >
                {p.id}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="priceRange" value={priceRange} />
      </div>

      {/* 5. Etiquetas visuales interactivas */}
      <TagInput availableTags={popularTags} />

      {/* 6. Notas */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Notas / Recomendación
        </label>
        <textarea
          name="notes"
          rows={2}
          placeholder="Ej. Pedir la tarta de queso. Reservar con antelación..."
          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
        />
      </div>

      {/* Botones de acción */}
      <div className="pt-2 flex gap-2">
        <a
          href="/"
          className="flex-1 py-3 px-4 rounded-xl text-center border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          Cancelar
        </a>
        <button
          type="submit"
          disabled={submitting}
          className="flex-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-sm transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          {submitting ? "Guardando..." : "Guardar Sitio"}
        </button>
      </div>
    </form>
  );
}
