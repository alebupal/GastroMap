"use client";

import { useState, useEffect, useMemo } from "react";
import { updatePlaceAction, parseUrlAction, type PlaceWithDetails } from "@/lib/actions/places";
import { getMyGroupsAction } from "@/lib/actions/groups";
import { useT } from "@/lib/i18n/client";
import { TagInput } from "./TagInput";
import { OccasionPicker } from "./OccasionPicker";
import { LocationPicker } from "./LocationPicker";

const PRICE_OPTIONS = [
  { id: "???", label: "???" },
  { id: "€", label: "< 15 €" },
  { id: "€€", label: "15 - 30 €" },
  { id: "€€€", label: "30 - 50 €" },
  { id: "€€€€", label: "> 50 €" },
];

const STATUS_OPTIONS = [
  { id: "active", label: "Activo", icon: "🟢" },
  { id: "temporarily_closed", label: "Cerrado temp.", icon: "⏸️" },
  { id: "permanently_closed", label: "Cerrado perm.", icon: "🚫" },
] as const;

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
  const [name, setName] = useState(place.name);
  const [googleMapsUrl, setGoogleMapsUrl] = useState(place.googleMapsUrl || "");
  const [city, setCity] = useState(place.city || "");
  const [address, setAddress] = useState(place.address || "");
  const [lat, setLat] = useState(place.latitude != null ? String(place.latitude) : "");
  const [lng, setLng] = useState(place.longitude != null ? String(place.longitude) : "");
  const [priceRange, setPriceRange] = useState(place.priceRange || "???");
  const [status, setStatus] = useState<string>(place.status || "active");
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>(place.occasions || []);
  const [notes, setNotes] = useState(place.notes || "");
  const [communityPublished, setCommunityPublished] = useState<boolean>(place.communityPublished);
  const [availableGroups, setAvailableGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(place.sharedGroupIds || []);

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
    if (isOpen) {
      getMyGroupsAction()
        .then((groups) => setAvailableGroups(groups.map((g) => ({ id: g.id, name: g.name }))))
        .catch(() => { });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function toggleOccasion(occId: string) {
    setSelectedOccasions((prev) =>
      prev.includes(occId) ? prev.filter((id) => id !== occId) : [...prev, occId]
    );
  }

  async function handleAutoResolve() {
    if (!googleMapsUrl.trim()) return;
    setResolving(true);
    setError(null);
    try {
      const parsed = await parseUrlAction(googleMapsUrl);
      if (parsed.name && !name.trim()) setName(parsed.name);
      if (parsed.latitude) setLat(String(parsed.latitude));
      if (parsed.longitude) setLng(String(parsed.longitude));
      if (parsed.locationDetails) {
        if (parsed.locationDetails.road) setAddress(parsed.locationDetails.road);
        if (parsed.locationDetails.city) setCity(parsed.locationDetails.city);
      }
    } catch {
      setError("No pudimos leer automáticamente el enlace de Google Maps.");
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
    formData.set("status", status);
    formData.set("notes", notes);
    formData.set("communityPublished", communityPublished ? "true" : "false");

    formData.delete("occasions");
    selectedOccasions.forEach((occ) => formData.append("occasions", occ));

    formData.delete("sharedGroups");
    selectedGroupIds.forEach((gid) => formData.append("sharedGroups", gid));

    const res = await updatePlaceAction(place.id, formData);
    setSaving(false);

    if (res.error) {
      setError(res.error);
    } else {
      onClose();
      window.location.reload();
    }
  }

  const mergedTags = Array.from(new Set([...availableTags, ...(place.tags || [])]));

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150 text-left">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl">✏️</span>
            <div className="min-w-0">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">
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
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-sm font-bold"
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>

        {/* Formulario scrollable */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-medium">
              ⚠️ {error}
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
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Estado del establecimiento */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t("form.edit_status")}
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "active", label: t("form.status_active"), icon: "🟢" },
                { id: "temporarily_closed", label: t("form.status_temp_closed"), icon: "⏸️" },
                { id: "permanently_closed", label: t("form.status_perm_closed"), icon: "🚫" },
              ].map((opt) => {
                const active = status === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStatus(opt.id)}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer flex items-center justify-center gap-1 ${active
                      ? opt.id === "active"
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                        : opt.id === "temporarily_closed"
                          ? "bg-amber-500 border-amber-500 text-slate-950 shadow-xs"
                          : "bg-red-600 border-red-600 text-white shadow-xs"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                  >
                    <span>{opt.icon}</span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Enlace Google Maps */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t("form.import_label")}
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={handleAutoResolve}
                disabled={resolving || !googleMapsUrl.trim()}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-40 shrink-0"
              >
                {resolving ? "⏳" : `✨ ${t("form.import_button")}`}
              </button>
            </div>
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
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
            />
          </div>

          {/* Visibilidad */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t("form.visibility_label")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCommunityPublished(true);
                  setSelectedGroupIds([]);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition cursor-pointer ${communityPublished
                  ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 font-bold"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
              >
                <span>🌍</span>
                <span>{t("form.visibility_community")}</span>
              </button>
              <button
                type="button"
                onClick={() => setCommunityPublished(false)}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition cursor-pointer ${!communityPublished
                  ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 font-bold"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
              >
                <span>🔒</span>
                <span>{t("form.visibility_private")}</span>
              </button>
            </div>

            {!communityPublished && availableGroups.length > 0 && (
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
                            prev.includes(g.id)
                              ? prev.filter((id) => id !== g.id)
                              : [...prev, g.id]
                          )
                        }
                        className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1 ${active
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
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="pt-2 flex gap-2 sticky bottom-0 bg-white dark:bg-slate-900 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {saving ? t("common.loading") : t("form.save_changes")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
