"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  createPlaceAction,
  parseUrlAction,
  findPotentialDuplicatesAction,
  type PotentialDuplicate,
} from "@/lib/actions/places";
import { TagInput } from "@/components/places/TagInput";
import { OccasionPicker } from "@/components/places/OccasionPicker";
import { LocationPicker } from "@/components/places/LocationPicker";
import type { Occasion } from "@/db/schema";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";

const PRICE_OPTIONS = [
  { id: "???", label: "??? (Sin definir)" },
  { id: "€", label: "< 15 € (Económico)" },
  { id: "€€", label: "15 - 30 € (Medio)" },
  { id: "€€€", label: "30 - 50 € (Alto)" },
  { id: "€€€€", label: "> 50 € (Lujo)" },
];

interface NewPlaceFormProps {
  initialUrl?: string;
  initialTitle?: string;
  availableOccasions: Occasion[];
  popularTags?: string[];
  availableGroups?: Array<{ id: string; name: string }>;
}

export function NewPlaceForm({
  initialUrl = "",
  initialTitle = "",
  availableOccasions,
  popularTags = [],
  availableGroups = [],
}: NewPlaceFormProps) {
  const { t } = useT();
  const { toast } = useToast();
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
  const [isCommunityPublished, setIsCommunityPublished] = useState(true);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<PotentialDuplicate[]>([]);
  const [dismissedDuplicates, setDismissedDuplicates] = useState(false);

  // Detección automática en vivo de posibles establecimientos duplicados
  useEffect(() => {
    const parsedLat = lat ? parseFloat(lat) : null;
    const parsedLng = lng ? parseFloat(lng) : null;
    const hasCoords =
      parsedLat !== null && !isNaN(parsedLat) && parsedLng !== null && !isNaN(parsedLng);

    if (name.trim().length < 3 && !hasCoords) {
      setDuplicates([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const found = await findPotentialDuplicatesAction({
          name: name.trim(),
          latitude: hasCoords ? parsedLat : null,
          longitude: hasCoords ? parsedLng : null,
        });
        setDuplicates(found);
        setDismissedDuplicates(false);
      } catch {
        // Silenciar error de comprobación no bloqueante
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [name, lat, lng]);

  async function handleAutoResolve(rawUrl?: string) {
    const target = rawUrl ?? url;
    if (!target) return;
    setResolving(true);
    setError(null);
    try {
      const parsed = await parseUrlAction(target);
      if (!parsed.latitude && !parsed.name) {
        toast(t("form.import_nothing"), { kind: "info" });
      } else {
        toast(t("form.import_ok"), { kind: "success" });
      }
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
      // Geocodificación inversa automática desde coordenadas
      if (parsed.locationDetails) {
        if (parsed.locationDetails.road) {
          setAddress(parsed.locationDetails.road);
        }
        if (parsed.locationDetails.city) {
          setCity(parsed.locationDetails.city);
        }
        if (!name && parsed.locationDetails.name) {
          setName(parsed.locationDetails.name);
        }
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

    if (!lat || !lng || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
      setError(t("location.coords_required"));
      setSubmitting(false);
      return;
    }

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
          {t("form.import_label")}
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            name="googleMapsUrl"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text").trim();
              if (/^https?:\/\//i.test(pasted) && /(google|goo\.gl|g\.co|share\.google|maps)/i.test(pasted)) {
                setUrl(pasted);
                // Autocompletado automático al pegar el enlace
                setTimeout(() => handleAutoResolve(pasted), 0);
              }
            }}
            placeholder={t("form.import_placeholder")}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <button
            type="button"
            onClick={() => handleAutoResolve()}
            disabled={resolving || !url}
            className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shrink-0 transition active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            {resolving ? t("form.import_reading") : t("form.import_button")}
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          {t("form.import_hint")}
        </p>
      </div>

      {/* 2. Nombre del sitio */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          {t("form.name_label")}
        </label>
        <input
          type="text"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("form.name_placeholder")}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
        />

        {/* Aviso no bloqueante de posibles duplicados */}
        {duplicates.length > 0 && !dismissedDuplicates && (
          <div className="mt-2.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>
                  {duplicates.length === 1
                    ? t("form.duplicate_single")
                    : t("form.duplicate_multiple", { count: duplicates.length })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDismissedDuplicates(true)}
                className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline shrink-0 cursor-pointer"
              >
                {t("form.duplicate_dismiss")}
              </button>
            </div>
            <div className="space-y-1.5">
              {duplicates.map((dup) => (
                <div
                  key={dup.id}
                  className="p-2 rounded-xl bg-white/90 dark:bg-slate-900/70 border border-amber-200 dark:border-amber-800/50 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      {dup.name}{" "}
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-[11px]">
                        ({dup.priceRange})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {dup.reason}
                      {dup.city ? ` • ${dup.city}` : ""}
                      {dup.address ? ` • ${dup.address}` : ""}
                    </div>
                  </div>
                  <Link
                    href="/"
                    className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] shrink-0 transition"
                  >
                    {t("form.duplicate_view_catalog")}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Selector estructurado de Ubicación con buscador Nominatim */}
      <LocationPicker
        initialCity={city}
        initialAddress={address}
        initialLat={lat}
        initialLng={lng}
        onLocationChange={(loc) => {
          setCity(loc.city);
          setAddress(loc.address);
          setLat(loc.latitude);
          setLng(loc.longitude);
        }}
      />

      {/* 4. Para qué plan es (Ocasiones dinámicas con buscador y Mostrar más) */}
      <OccasionPicker
        occasions={availableOccasions}
        selectedOccasions={selectedOccasions}
        onToggle={toggleOccasion}
        label={t("form.occasions_label")}
        renderHiddenInputs
      />

      {/* 4. Precio estimado */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          {t("form.price_label")}
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
          {t("form.notes_label")}
        </label>
        <textarea
          name="notes"
          rows={2}
          placeholder={t("form.notes_placeholder")}
          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
        />
      </div>

      {/* 7. Ámbito de compartición (Fase 4 & 5) */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          {t("form.visibility_label")}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setIsCommunityPublished(true);
              setSelectedGroupIds([]);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
              isCommunityPublished
                ? "bg-orange-500/10 border-orange-600 text-orange-600 dark:text-orange-400 font-bold"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
            }`}
          >
            <span>🌍</span>
            <span>{t("form.visibility_community")}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCommunityPublished(false)}
            className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
              !isCommunityPublished
                ? "bg-orange-500/10 border-orange-600 text-orange-600 dark:text-orange-400 font-bold"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
            }`}
          >
            <span>🔒</span>
            <span>{t("form.visibility_private")}</span>
          </button>
        </div>
        <input
          type="hidden"
          name="communityPublished"
          value={isCommunityPublished ? "true" : "false"}
        />

        {/* Compartición con grupos privados (solo visible al ser privado) */}
        {!isCommunityPublished && availableGroups.length > 0 && (
          <div className="mt-2.5 space-y-1.5">
            <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {t("form.share_groups_title")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {availableGroups.map((g) => {
                const active = selectedGroupIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() =>
                      setSelectedGroupIds((prev) =>
                        prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                      )
                    }
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1 ${
                      active
                        ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <span>👥 {g.name}</span>
                    {active && <span className="text-[10px]">✓</span>}
                  </button>
                );
              })}
            </div>
            {selectedGroupIds.map((gid) => (
              <input key={gid} type="hidden" name="sharedGroups" value={gid} />
            ))}
          </div>
        )}
      </div>

      {/* Botones de acción */}
      <div className="pt-2 flex gap-2">
        <Link
          href="/"
          className="flex-1 py-3 px-4 rounded-xl text-center border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          {t("common.cancel")}
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="flex-2 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm shadow-sm transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          {submitting ? t("form.saving_button") : t("form.save_button")}
        </button>
      </div>
    </form>
  );
}
