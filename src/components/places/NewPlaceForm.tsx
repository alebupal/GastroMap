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
import { formatCityCountry } from "@/lib/location";

const PRICE_OPTIONS = [
  { id: "???", hint: "Sin estimación" },
  { id: "€", hint: "< 20 €" },
  { id: "€€", hint: "20-30 €" },
  { id: "€€€", hint: "30-40 €" },
  { id: "€€€€", hint: "> 40 €" },
];

interface NewPlaceFormProps {
  initialUrl?: string;
  initialTitle?: string;
  availableOccasions: Occasion[];
  popularTags?: string[];
  availableGroups?: Array<{ id: string; name: string; icon?: string }>;
  defaultTargetSpace?: string;
}

export function NewPlaceForm({
  initialUrl = "",
  initialTitle = "",
  availableOccasions,
  popularTags = [],
  availableGroups = [],
  defaultTargetSpace = "personal",
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
  const [notes, setNotes] = useState("");
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>(
    availableOccasions.length > 0 ? [availableOccasions[0].id] : []
  );
  const [targetSpace, setTargetSpace] = useState<string>(defaultTargetSpace || "personal");
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<PotentialDuplicate[]>([]);
  const [dismissedDuplicates, setDismissedDuplicates] = useState(false);

  // Detección automática en vivo de posibles establecimientos duplicados dentro del espacio destino
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
          targetSpace,
        });
        setDuplicates(found);
        setDismissedDuplicates(false);
      } catch {
        // Silenciar error de comprobación no bloqueante
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [name, lat, lng, targetSpace]);

  async function handleAutoResolve(rawUrl?: string) {
    const target = (rawUrl ?? url).trim();
    if (!target) return;
    if (
      /^https?:\/\/(www\.)?google\.[a-z.]+\/(search|url)\b/i.test(target) &&
      !/\/maps\b/i.test(target)
    ) {
      toast(t("form.google_search_url_warning"), { kind: "info" });
      return;
    }
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
      if (parsed.priceRange && priceRange === "???") {
        setPriceRange(parsed.priceRange);
      }
      if (parsed.description && !notes.trim()) {
        setNotes(parsed.description);
      }
      if (parsed.suggestedOccasions && parsed.suggestedOccasions.length > 0) {
        const validIds = new Set(availableOccasions.map((o) => o.id));
        const matched = parsed.suggestedOccasions.filter((id) => validIds.has(id));
        if (matched.length > 0) {
          setSelectedOccasions(matched);
        }
      }
      if (parsed.address) {
        setAddress(parsed.address);
      } else if (parsed.locationDetails?.road) {
        setAddress(
          `${parsed.locationDetails.road}${
            parsed.locationDetails.postcode ? `, ${parsed.locationDetails.postcode}` : ""
          }`
        );
      }
      if (parsed.locationDetails?.city) {
        setCity(
          formatCityCountry(parsed.locationDetails.city, parsed.locationDetails.country)
        );
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
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-base shrink-0">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* 1. Tarjeta: Autocompletar pegando enlace de Google Maps */}
      <section className="rounded-3xl bg-gradient-to-br from-orange-50/80 via-white to-white dark:from-orange-950/25 dark:via-slate-900 dark:to-slate-900 border border-orange-200/70 dark:border-orange-900/40 p-3.5 sm:p-5 shadow-xs space-y-2.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="text-xs sm:text-sm font-extrabold text-orange-800 dark:text-orange-300 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-orange-600 leading-none">
                auto_awesome
              </span>
              <span>{t("form.import_label")}</span>
            </label>
            <span className="px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 text-[10px] font-extrabold">
              {t("form.quick_assistant")}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {t("form.import_how_to_get")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined text-base text-slate-400 absolute left-3.5 top-2.5 pointer-events-none">
              link
            </span>
            <input
              type="url"
              name="googleMapsUrl"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text").trim();
                if (/https?:\/\//i.test(pasted) && /(google|goo\.gl|g\.co|share\.google|maps)/i.test(pasted)) {
                  e.preventDefault();
                  setUrl(pasted);
                  setTimeout(() => handleAutoResolve(pasted), 0);
                }
              }}
              placeholder={t("form.import_placeholder")}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 text-base sm:text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition"
            />
          </div>
          <button
            type="button"
            onClick={() => handleAutoResolve()}
            disabled={resolving || !url}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shrink-0 shadow-xs transition active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            <span className={`material-symbols-outlined text-sm leading-none ${resolving ? "animate-spin" : ""}`}>
              {resolving ? "progress_activity" : "auto_awesome"}
            </span>
            <span>{resolving ? t("form.analyzing") : t("form.analyze_button")}</span>
          </button>
        </div>

        {/^https?:\/\/(www\.)?google\.[a-z.]+\/(search|url)\b/i.test(url.trim()) &&
        !/\/maps\b/i.test(url.trim()) ? (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-200 font-semibold leading-snug">
            <span className="material-symbols-outlined text-sm text-amber-600 shrink-0 mt-0.5 leading-none">
              warning
            </span>
            <span>{t("form.google_search_url_warning")}</span>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-slate-400 leading-none">info</span>
            <span>{t("form.import_hint")}</span>
          </p>
        )}
      </section>

      {/* 2. Tarjeta: Nombre del sitio */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-3.5 sm:p-5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100">
            {t("form.name_label")}
          </label>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Requerido
          </span>
        </div>

        <input
          type="text"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("form.name_placeholder")}
          className="w-full px-4 py-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-[#f8f9ff] dark:bg-slate-800/80 text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 font-bold transition"
        />

        {/* Aviso no bloqueante de posibles duplicados */}
        {duplicates.length > 0 && !dismissedDuplicates && (
          <div className="mt-2 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-amber-600 leading-none">
                  warning
                </span>
                <span>
                  {duplicates.length === 1
                    ? t("form.duplicate_single")
                    : t("form.duplicate_multiple", { count: duplicates.length })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDismissedDuplicates(true)}
                className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 hover:underline shrink-0 cursor-pointer"
              >
                {t("form.duplicate_dismiss")}
              </button>
            </div>
            <div className="space-y-1.5">
              {duplicates.map((dup) => (
                <div
                  key={dup.id}
                  className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-amber-200/80 dark:border-amber-800/50 flex items-center justify-between gap-2 text-xs"
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
                    className="px-3 py-1 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] shrink-0 transition"
                  >
                    {t("form.duplicate_view_catalog")}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 3. Tarjeta: Ubicación y Coordenadas */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-3.5 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-lg text-orange-600 leading-none">
              location_on
            </span>
            <span>{t("form.location_and_coords")}</span>
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-extrabold uppercase tracking-wider">
            Paso clave
          </span>
        </div>

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
      </section>

      {/* 4. Tarjeta: ¿Para qué plan es? */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-3.5 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {t("form.occasions_label")}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t("form.occasions_hint", { count: availableOccasions.length })}
            </p>
          </div>
          {selectedOccasions.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 text-[10px] font-extrabold shrink-0">
              {selectedOccasions.length} {selectedOccasions.length === 1 ? "seleccionado" : "seleccionados"}
            </span>
          )}
        </div>

        <OccasionPicker
          occasions={availableOccasions}
          selectedOccasions={selectedOccasions}
          onToggle={toggleOccasion}
          label=""
          renderHiddenInputs
        />
      </section>

      {/* 5. Tarjeta: Presupuesto aproximado */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-3.5 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
            {t("form.price_label")}
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">
            Precio medio por comensal
          </span>
        </div>

        <div className="p-1.5 rounded-2xl bg-[#f2f3ff] dark:bg-slate-800/80 grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          {PRICE_OPTIONS.map((p) => {
            const isSelected = priceRange === p.id;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => setPriceRange(p.id)}
                className={`py-2 px-1.5 rounded-xl transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  isSelected
                    ? "bg-slate-900 dark:bg-orange-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/60"
                }`}
              >
                <span className="text-xs font-extrabold leading-tight">{p.id}</span>
                <span
                  className={`text-[10px] leading-tight whitespace-nowrap ${
                    isSelected ? "text-white/85 font-semibold" : "text-slate-400 font-medium"
                  }`}
                >
                  {p.hint}
                </span>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="priceRange" value={priceRange} />
      </section>

      {/* 6. Tarjeta: Etiquetas y especialidades */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-3.5 sm:p-5 shadow-xs">
        <TagInput availableTags={popularTags} />
      </section>

      {/* 7. Tarjeta: Notas y Recomendación */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-3.5 sm:p-5 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <label className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
            {t("form.notes_label")}
          </label>
          <span className="text-[11px] text-slate-400 font-medium">
            {t("form.public_for_community")}
          </span>
        </div>
        <textarea
          name="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("form.notes_placeholder")}
          className="w-full px-4 py-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-[#f8f9ff] dark:bg-slate-800/80 text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 resize-y transition"
        />
      </section>

      {/* 8. Tarjeta: Espacio donde se guarda este sitio (v2 aislado) */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-3.5 sm:p-5 shadow-xs space-y-3">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
            {t("spaces.save_destination_label")}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t("spaces.save_destination_hint")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {availableGroups.map((g) => {
            const active = targetSpace === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setTargetSpace(g.id)}
                className={`p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition cursor-pointer ${
                  active
                    ? "bg-orange-50/80 dark:bg-orange-950/30 border-orange-500 shadow-xs"
                    : "bg-[#f8f9ff] dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center text-base shrink-0">
                    {g.icon || "🍻"}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                      {g.name}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {t("spaces.group_destination_sub")}
                    </div>
                  </div>
                </div>
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                    active
                      ? "bg-orange-600 border-orange-600 text-white"
                      : "border-slate-300 dark:border-slate-600"
                  }`}
                >
                  {active && (
                    <span className="material-symbols-outlined text-xs leading-none">check</span>
                  )}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setTargetSpace("personal")}
            className={`p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition cursor-pointer ${
              targetSpace === "personal"
                ? "bg-orange-50/80 dark:bg-orange-950/30 border-orange-500 shadow-xs"
                : "bg-[#f8f9ff] dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-slate-200/80 dark:bg-slate-700 flex items-center justify-center text-base shrink-0">
                🏠
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                  {t("spaces.personal_map")}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {t("spaces.personal_subtitle")}
                </div>
              </div>
            </div>
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                targetSpace === "personal"
                  ? "bg-orange-600 border-orange-600 text-white"
                  : "border-slate-300 dark:border-slate-600"
              }`}
            >
              {targetSpace === "personal" && (
                <span className="material-symbols-outlined text-xs leading-none">check</span>
              )}
            </span>
          </button>
        </div>

        <input type="hidden" name="targetSpace" value={targetSpace} />
      </section>

      {/* Botones finales */}
      <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3">
        <Link
          href="/"
          className="w-full sm:w-auto text-center px-6 py-3 rounded-full bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm transition"
        >
          {t("common.cancel")}
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-orange-600/25 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base leading-none">add_location_alt</span>
          <span>{submitting ? t("form.saving_button") : t("form.save_button")}</span>
        </button>
      </div>
    </form>
  );
}
