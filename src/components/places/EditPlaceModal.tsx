"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { updatePlaceAction, parseUrlAction, type PlaceWithDetails } from "@/lib/actions/places";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";
import { TagInput } from "./TagInput";
import { OccasionPicker } from "./OccasionPicker";
import { LocationPicker } from "./LocationPicker";
import { formatCityCountry } from "@/lib/location";
import { useSwipeToClose, SheetHandle } from "@/components/ui/BottomSheet";

const PRICE_OPTIONS = [
  { id: "???", label: "???" },
  { id: "€", label: "< 20 €" },
  { id: "€€", label: "20-30 €" },
  { id: "€€€", label: "30-40 €" },
  { id: "€€€€", label: "> 40 €" },
];

interface EditPlaceModalProps {
  place: PlaceWithDetails;
  occasionsList: Array<{ id: string; name: string; icon: string }>;
  availableTags: string[];
  isOpen: boolean;
  onClose: () => void;
}

export function EditPlaceModal({
  place,
  occasionsList,
  availableTags,
  isOpen,
  onClose,
}: EditPlaceModalProps) {
  const { t } = useT();
  const { toast } = useToast();
  const sheet = useSwipeToClose(onClose);
  const [name, setName] = useState(place.name);
  const [googleMapsUrl, setGoogleMapsUrl] = useState(place.googleMapsUrl || "");
  const [city, setCity] = useState(place.city || "");
  const [address, setAddress] = useState(place.address || "");
  const [lat, setLat] = useState(place.latitude != null ? String(place.latitude) : "");
  const [lng, setLng] = useState(place.longitude != null ? String(place.longitude) : "");
  const [priceRange, setPriceRange] = useState(place.priceRange || "???");
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>(place.occasions || []);
  const [notes, setNotes] = useState(place.notes || "");

  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Asegurar que las ocasiones de la ficha se muestren aunque la lista externa viniera parcial
  const mergedOccasions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; icon: string }>();
    (occasionsList || []).forEach((occ) => map.set(occ.id, occ));
    (place.occasions || []).forEach((occId) => {
      if (!map.has(occId)) {
        map.set(occId, { id: occId, name: occId, icon: "🍽️" });
      }
    });
    return Array.from(map.values());
  }, [occasionsList, place.occasions]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function toggleOccasion(occId: string) {
    setSelectedOccasions((prev) =>
      prev.includes(occId) ? prev.filter((id) => id !== occId) : [...prev, occId]
    );
  }

  async function handleAutoResolve(rawUrl?: string) {
    const target = (rawUrl ?? googleMapsUrl).trim();
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
      if (parsed.name && !name.trim()) setName(parsed.name);
      if (parsed.latitude) setLat(String(parsed.latitude));
      if (parsed.longitude) setLng(String(parsed.longitude));
      if (parsed.resolvedUrl) setGoogleMapsUrl(parsed.resolvedUrl);
      if (parsed.priceRange && priceRange === "???") setPriceRange(parsed.priceRange);
      if (parsed.description && !notes.trim()) setNotes(parsed.description);
      if (
        parsed.suggestedOccasions &&
        parsed.suggestedOccasions.length > 0 &&
        selectedOccasions.length === 0
      ) {
        const validIds = new Set(mergedOccasions.map((o) => o.id));
        const matched = parsed.suggestedOccasions.filter((id) => validIds.has(id));
        if (matched.length > 0) setSelectedOccasions(matched);
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
      setError(t("form.maps_parse_error"));
    } finally {
      setResolving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("name", name);
    formData.set("googleMapsUrl", googleMapsUrl);
    formData.set("city", city);
    formData.set("address", address);
    formData.set("latitude", lat);
    formData.set("longitude", lng);
    formData.set("priceRange", priceRange);
    formData.set("notes", notes);

    formData.delete("occasions");
    selectedOccasions.forEach((occ) => formData.append("occasions", occ));

    const res = await updatePlaceAction(place.id, formData);
    setSaving(false);

    if (res.error) {
      setError(res.error);
    } else {
      onClose();
      if (typeof window !== "undefined") {
        const nextUrl = new URL(window.location.href);
        if (nextUrl.pathname === "/") {
          nextUrl.searchParams.set("focus", place.id);
          window.location.href = nextUrl.toString();
        } else {
          window.location.reload();
        }
      }
    }
  }

  const mergedTags = Array.from(new Set([...availableTags, ...(place.tags || [])]));

  if (typeof document === "undefined") return null;

  const modalContent = (
    <div
      style={sheet.backdropStyle}
      className="fixed inset-0 !mt-0 z-[1200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-sm gm-backdrop-in text-left"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheet.sheetRef}
        style={sheet.sheetStyle}
        {...sheet.sheetHandlers}
        className="w-full max-h-[95dvh] sm:max-h-[92dvh] sm:max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden gm-modal-in"
      >
        <SheetHandle {...sheet.handleHandlers} />
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/60 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">edit_location_alt</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 truncate tracking-tight">
                {t("form.edit_title")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {place.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#f2f3ff] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label={t("common.close")}
          >
            <span className="material-symbols-outlined text-lg leading-none">close</span>
          </button>
        </div>

        {/* Formulario scrollable */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm leading-none shrink-0">warning</span>
              <span>{error}</span>
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t("form.name_label")}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Enlace Google Maps */}
          <div className="space-y-1.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t("form.import_label")}
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                {t("form.import_how_to_get")}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text").trim();
                  if (/https?:\/\//i.test(pasted) && /(google|goo\.gl|g\.co|share\.google|maps)/i.test(pasted)) {
                    e.preventDefault();
                    setGoogleMapsUrl(pasted);
                    setTimeout(() => handleAutoResolve(pasted), 0);
                  }
                }}
                placeholder="https://maps.app.goo.gl/..."
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={() => handleAutoResolve()}
                disabled={resolving || !googleMapsUrl.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shrink-0 shadow-xs transition active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                <span className={`material-symbols-outlined text-sm leading-none ${resolving ? "animate-spin" : ""}`}>
                  {resolving ? "progress_activity" : "auto_awesome"}
                </span>
                <span>{resolving ? t("form.analyzing") : t("form.analyze_button")}</span>
              </button>
            </div>
            {/^https?:\/\/(www\.)?google\.[a-z.]+\/(search|url)\b/i.test(googleMapsUrl.trim()) &&
              !/\/maps\b/i.test(googleMapsUrl.trim()) && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-200 font-semibold leading-snug">
                  <span className="material-symbols-outlined text-sm text-amber-600 shrink-0 mt-0.5 leading-none">
                    warning
                  </span>
                  <span>{t("form.google_search_url_warning")}</span>
                </div>
              )}
          </div>

          {/* Ubicación */}
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

          {/* Planes / Ocasiones (con buscador y Mostrar más) */}
          <OccasionPicker
            occasions={mergedOccasions}
            selectedOccasions={selectedOccasions}
            onToggle={toggleOccasion}
            label={t("places.plans_title")}
          />

          {/* Precio */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t("form.price_label")}
            </label>
            <div className="flex gap-1.5">
              {PRICE_OPTIONS.map((p) => {
                const isSelected = priceRange === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriceRange(p.id)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${isSelected
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-xs"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Etiquetas */}
          <TagInput availableTags={mergedTags} initialTags={place.tags || []} />

          {/* Notas públicas */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t("form.notes_label")}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("form.notes_placeholder")}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
            />
          </div>

          {/* Espacio actual del sitio (aislado en v2) */}
          <div className="p-3 rounded-2xl bg-[#f8f9ff] dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              {t("spaces.belonging_space")}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200/70 dark:border-orange-800/60 font-bold">
              <span>{place.groupId ? "🍻" : "🏠"}</span>
              <span>
                {place.groupId
                  ? (place as { groupName?: string | null }).groupName || t("nav.my_groups")
                  : t("spaces.personal_map")}
              </span>
            </span>
          </div>

          {/* Acciones */}
          <div className="pt-3 flex items-center justify-end gap-2 sticky bottom-0 bg-white dark:bg-slate-900 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] sm:pb-1 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs shadow-sm transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm leading-none">save</span>
              <span>{saving ? t("common.loading") : t("form.save_changes")}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
