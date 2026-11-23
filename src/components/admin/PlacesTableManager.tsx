"use client";

import { useState, useMemo } from "react";
import {
  bulkDeletePlacesAction,
  deletePlaceAction,
  mergePlacesAction,
  type PlaceWithDetails,
} from "@/lib/actions/places";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { useT } from "@/lib/i18n/client";
import { EditPlaceModal } from "@/components/places/EditPlaceModal";
import { parseCityCountry, findCountry } from "@/lib/location";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface PlacesTableManagerProps {
  places: PlaceWithDetails[];
  occasionsList?: Array<{ id: string; name: string; icon: string }>;
}

export function PlacesTableManager({
  places: initialPlaces,
  occasionsList = [],
}: PlacesTableManagerProps) {
  const { t, locale } = useT();
  const [placesList, setPlacesList] = useState<PlaceWithDetails[]>(initialPlaces);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [mergeSource, setMergeSource] = useState<PlaceWithDetails | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [mergeSearch, setMergeSearch] = useState<string>("");
  const [editingPlace, setEditingPlace] = useState<PlaceWithDetails | null>(null);

  // Lista única de países y ciudades filtradas
  const { allCountries, availableCities } = useMemo(() => {
    const cSet = new Set<string>();
    placesList.forEach((p) => {
      const parsed = parseCityCountry(p.city);
      if (parsed.country) cSet.add(parsed.country);
    });
    const countries = Array.from(cSet).sort((a, b) => a.localeCompare(b));

    const citySet = new Set<string>();
    placesList.forEach((p) => {
      const parsed = parseCityCountry(p.city);
      if (countryFilter === "all" || parsed.country === countryFilter) {
        if (parsed.city) citySet.add(parsed.city);
      }
    });
    const cities = Array.from(citySet).sort((a, b) => a.localeCompare(b));

    return { allCountries: countries, availableCities: cities };
  }, [placesList, countryFilter]);

  const countryOptions = useMemo(() => {
    return allCountries.map((c) => {
      const countryData = findCountry(c);
      const isEn = locale === "en";
      const title = isEn && countryData ? countryData.nameEn : c;
      const subtitle = countryData ? (isEn ? countryData.name : countryData.nameEn) : undefined;
      return {
        value: c,
        label: title,
        icon: countryData?.flag || "🌍",
        subtitle: subtitle !== title ? subtitle : undefined,
      };
    });
  }, [allCountries, locale]);

  const cityOptions = useMemo(() => {
    return availableCities.map((city) => ({
      value: city,
      label: city,
      icon: "📍",
    }));
  }, [availableCities]);
  // Sitios filtrados en la tabla
  const filteredPlaces = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return placesList.filter((p) => {
      const parsed = parseCityCountry(p.city);

      if (countryFilter !== "all" && parsed.country !== countryFilter) {
        return false;
      }
      if (cityFilter !== "all" && parsed.city !== cityFilter) {
        return false;
      }

      if (!q) return true;
      const tokens = q.split(/\s+/).filter(Boolean);
      const searchableText = [
        p.name,
        p.city || "",
        p.address || "",
        p.notes || "",
        p.privateNotes || "",
        p.createdByName || "",
        p.createdByUsername || "",
        ...p.tags,
        ...p.occasions,
        ...(p.commentsTexts || []),
      ]
        .join(" ")
        .toLowerCase();

      return (
        searchableText.includes(q) ||
        (tokens.length > 1 && tokens.every((tok) => searchableText.includes(tok)))
      );
    });
  }, [placesList, searchQuery, countryFilter, cityFilter]);

  // Selección individual
  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  // Seleccionar / Deseleccionar todos los visibles de la página actual
  function toggleSelectAll() {
    const pageIds = paginatedPlaces.map((p) => p.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allPageSelected) {
      pageIds.forEach((id) => next.delete(id));
    } else {
      pageIds.forEach((id) => next.add(id));
    }
    setSelectedIds(next);
  }

  // Eliminación individual
  async function handleDeleteSingle(place: PlaceWithDetails) {
    if (!confirm(t("admin_places.delete_confirm", { name: place.name }))) return;

    setLoading(true);
    setStatusMessage(null);
    const res = await deletePlaceAction(place.id);
    setLoading(false);

    if (res.error) {
      setStatusMessage({ type: "error", text: res.error });
    } else {
      setPlacesList((prev) => prev.filter((p) => p.id !== place.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(place.id);
        return next;
      });
      setStatusMessage({ type: "success", text: t("admin_places.delete_success", { name: place.name }) });
    }
  }

  // Backup masivo de los sitios seleccionados
  function handleBulkBackup() {
    const selectedPlaces = placesList.filter((p) => selectedIds.has(p.id));
    if (selectedPlaces.length === 0) return;
    const dateStamp = new Date().toISOString().slice(0, 10);
    const jsonStr = JSON.stringify(selectedPlaces, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gastromap-backup-sitios-${selectedPlaces.length}-${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Eliminación masiva / en bloque
  async function handleBulkDelete() {
    const count = selectedIds.size;
    if (count === 0) return;

    const confirmMsg =
      count === 1
        ? t("admin_places.delete_bulk_confirm_single")
        : t("admin_places.delete_bulk_confirm", { count: String(count) });

    if (!confirm(confirmMsg)) {
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    const idsArray = Array.from(selectedIds);
    const res = await bulkDeletePlacesAction(idsArray);
    setLoading(false);

    if (res.error) {
      setStatusMessage({ type: "error", text: res.error });
    } else {
      setPlacesList((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
      const successMsg =
        count === 1
          ? t("admin_places.delete_bulk_success_single")
          : t("admin_places.delete_bulk_success", { count: String(count) });
      setStatusMessage({ type: "success", text: successMsg });
    }
  }

  // Fusión administrativa de sitio duplicado en uno principal
  async function handleConfirmMerge() {
    if (!mergeSource || !mergeTargetId) return;
    const targetPlace = placesList.find((p) => p.id === mergeTargetId);
    if (!targetPlace) return;

    setLoading(true);
    setStatusMessage(null);
    const res = await mergePlacesAction(mergeTargetId, mergeSource.id);
    setLoading(false);

    if (res.error) {
      setStatusMessage({ type: "error", text: res.error });
    } else {
      setPlacesList((prev) => prev.filter((p) => p.id !== mergeSource.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(mergeSource.id);
        return next;
      });
      setStatusMessage({
        type: "success",
        text: `«${mergeSource.name}» se ha fusionado correctamente dentro de «${targetPlace.name}».`,
      });
      setMergeSource(null);
      setMergeTargetId("");
      setMergeSearch("");
    }
  }

  const mergeCandidates = useMemo(() => {
    if (!mergeSource) return [];
    const q = mergeSearch.toLowerCase().trim();
    return placesList.filter((p) => {
      if (p.id === mergeSource.id) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q))
      );
    });
  }, [placesList, mergeSource, mergeSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredPlaces.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedPlaces = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredPlaces.slice(start, start + pageSize);
  }, [filteredPlaces, safePage, pageSize]);

  const allSelected =
    paginatedPlaces.length > 0 && paginatedPlaces.every((p) => selectedIds.has(p.id));

  return (
    <div className="w-full space-y-4 text-left">
      {/* Barra de control y búsqueda */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2.5 flex-1 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <span className="absolute left-3 top-2.5 text-xs text-slate-400 dark:text-slate-500">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t("admin_places.search_placeholder")}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {allCountries.length > 0 && (
            <SearchableSelect
              value={countryFilter}
              onChange={(val) => {
                setCountryFilter(val);
                setCityFilter("all");
                setCurrentPage(1);
              }}
              options={countryOptions}
              allOption={{
                value: "all",
                label: `${t("places.all_countries")} (${allCountries.length})`,
                icon: "🌍",
              }}
              searchPlaceholder={t("location.country_placeholder")}
              className="shrink-0"
              buttonClassName="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-700"
            />
          )}

          {availableCities.length > 0 && (
            <SearchableSelect
              value={cityFilter}
              onChange={(val) => {
                setCityFilter(val);
                setCurrentPage(1);
              }}
              options={cityOptions}
              allOption={{
                value: "all",
                label: `${t("places.all_cities")} (${availableCities.length})`,
                icon: "🏙️",
              }}
              searchPlaceholder={t("location.city_placeholder")}
              className="shrink-0"
              buttonClassName="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-700"
            />
          )}
        </div>

        {/* Acciones por lote */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-between sm:justify-end">
          {selectedIds.size > 0 && (
            <>
              <button
                type="button"
                onClick={handleBulkBackup}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition cursor-pointer shadow-md shadow-amber-500/20"
                title={t("admin_places.bulk_backup_title")}
              >
                <span>💾</span>
                <span>{t("admin_places.bulk_backup", { count: selectedIds.size })}</span>
              </button>

              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition cursor-pointer disabled:opacity-50 shadow-md shadow-red-600/20"
              >
                <span>🗑️</span>
                <span>{t("admin_places.delete_selected")} ({selectedIds.size})</span>
              </button>
            </>
          )}

          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {t("admin_places.showing_of", { filtered: String(filteredPlaces.length), total: String(placesList.length) })}
          </span>
        </div>
      </div>

      {/* Mensajes de estado */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${statusMessage.type === "success"
            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50"
            : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-900/50"
            }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-60 hover:opacity-100 cursor-pointer ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Vista Móvil: Tarjetas Responsive (< md) */}
      <div className="block md:hidden space-y-2.5">
        {paginatedPlaces.length > 0 && (
          <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-600 dark:text-slate-400 font-semibold">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <span>{t("admin_places.col_select_all")}</span>
            </label>
            <span>{paginatedPlaces.length} {t("pagination.places")}</span>
          </div>
        )}

        {paginatedPlaces.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800">
            {t("admin_places.empty_search")}
          </div>
        ) : (
          paginatedPlaces.map((place) => {
            const isChecked = selectedIds.has(place.id);
            const hasCoords = place.latitude != null && place.longitude != null;

            return (
              <div
                key={`m-${place.id}`}
                className={`p-3.5 rounded-2xl border transition space-y-2.5 ${isChecked
                  ? "bg-amber-500/10 border-amber-500/40"
                  : "bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(place.id)}
                      className="mt-1 rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {place.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {place.city || "—"}{place.address ? ` • ${place.address}` : ""}
                      </div>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 px-2 py-0.5 rounded text-xs shrink-0">
                    {place.priceRange}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {place.occasions.map((occ) => (
                    <span
                      key={occ}
                      className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700/60"
                    >
                      {occ}
                    </span>
                  ))}
                  {hasCoords ? (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-semibold ml-auto">
                      📍 {place.latitude?.toFixed(3)}, {place.longitude?.toFixed(3)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 dark:text-slate-600 ml-auto">
                      {t("admin_places.no_coords")}
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">
                    @{place.createdByUsername || place.createdByName.toLowerCase().replace(/\s+/g, "")}
                  </span>
                  <div className="flex items-center gap-3">
                    {place.googleMapsUrl && (
                      <a
                        href={place.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-blue-500 text-xs font-semibold flex items-center gap-0.5"
                      >
                        Maps ↗
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingPlace(place)}
                      disabled={loading}
                      className="text-slate-600 dark:text-slate-400 hover:text-amber-500 text-xs font-semibold cursor-pointer"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMergeSource(place);
                        setMergeTargetId("");
                        setMergeSearch("");
                      }}
                      disabled={loading || placesList.length < 2}
                      className="text-slate-600 dark:text-slate-400 hover:text-amber-500 text-xs font-semibold cursor-pointer"
                    >
                      🔀 Fusionar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSingle(place)}
                      disabled={loading}
                      className="text-slate-500 hover:text-red-500 text-xs font-semibold cursor-pointer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tabla de Sitios para Pantallas Medianas y Grandes (hidden md:block) */}
      <div className="hidden md:block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 min-w-[700px]">
            <thead className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                    title={t("admin_places.col_select_all")}
                  />
                </th>
                <th className="p-3">{t("admin_places.col_place")}</th>
                <th className="p-3">{t("admin_places.col_city")}</th>
                <th className="p-3">{t("admin_places.col_price")}</th>
                <th className="p-3">{t("admin_places.col_occasions")}</th>
                <th className="p-3">{t("admin_places.col_gps")}</th>
                <th className="p-3">{t("admin_places.col_author")}</th>
                <th className="p-3 text-right">{t("admin_places.col_action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {paginatedPlaces.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 text-xs">
                    {t("admin_places.empty_search")}
                  </td>
                </tr>
              ) : (
                paginatedPlaces.map((place) => {
                  const isChecked = selectedIds.has(place.id);
                  const hasCoords = place.latitude != null && place.longitude != null;

                  return (
                    <tr
                      key={place.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition ${isChecked ? "bg-amber-500/10 dark:bg-amber-500/10" : ""
                        }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(place.id)}
                          className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>

                      <td className="p-3 max-w-[220px]">
                        <div className="font-bold text-slate-900 dark:text-slate-100 truncate">{place.name}</div>
                        {place.address && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{place.address}</div>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {place.city || <span className="text-slate-400 dark:text-slate-600">—</span>}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className="font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 px-1.5 py-0.5 rounded text-[11px]">
                          {place.priceRange}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-1 flex-wrap max-w-xs">
                          {place.occasions.map((occ) => (
                            <span
                              key={occ}
                              className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700/60"
                            >
                              {occ}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        {hasCoords ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                            <span>📍</span>
                            <span>{place.latitude?.toFixed(3)}, {place.longitude?.toFixed(3)}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600 text-[11px]">{t("admin_places.no_coords")}</span>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                        @{place.createdByUsername || place.createdByName.toLowerCase().replace(/\s+/g, "")}
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {place.googleMapsUrl && (
                            <a
                              href={place.googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-blue-500 text-xs transition"
                              title={t("admin_places.open_maps")}
                            >
                              ↗
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingPlace(place)}
                            disabled={loading}
                            className="text-slate-400 hover:text-amber-500 text-xs transition cursor-pointer disabled:opacity-40"
                            title={t("admin_places.edit_title")}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMergeSource(place);
                              setMergeTargetId("");
                              setMergeSearch("");
                            }}
                            disabled={loading || placesList.length < 2}
                            className="text-slate-400 hover:text-amber-500 text-xs transition cursor-pointer disabled:opacity-40"
                            title={t("admin_places.merge_title")}
                          >
                            🔀
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSingle(place)}
                            disabled={loading}
                            className="text-slate-400 hover:text-red-500 text-xs transition cursor-pointer disabled:opacity-40"
                            title={t("admin_places.delete_title")}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación de tabla de sitios */}
      <PaginationBar
        currentPage={safePage}
        totalItems={filteredPlaces.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        itemLabel={t("pagination.places")}
      />

      {/* Modal de fusión administrativa de duplicados */}
      {mergeSource && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-left max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>🔀</span>
                  <span>{t("admin_places.merge_modal_title")}</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("admin_places.merge_modal_subtitle")}{" "}
                  <strong className="text-red-600 dark:text-red-400">{mergeSource.name}</strong>
                  {mergeSource.city ? ` (${mergeSource.city})` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMergeSource(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-900 dark:text-amber-300">
              {t("admin_places.merge_modal_desc")}
            </div>

            <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t("admin_places.merge_modal_target_label")}
              </label>
              <input
                type="text"
                value={mergeSearch}
                onChange={(e) => setMergeSearch(e.target.value)}
                placeholder={t("admin_places.merge_modal_search")}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <div className="overflow-y-auto max-h-52 space-y-1.5 pr-1">
                {mergeCandidates.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    {t("admin_places.merge_modal_no_candidates")}
                  </p>
                ) : (
                  mergeCandidates.map((cand) => {
                    const selected = mergeTargetId === cand.id;
                    return (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => setMergeTargetId(cand.id)}
                        className={`w-full text-left p-2.5 rounded-xl border text-xs transition cursor-pointer flex items-center justify-between gap-2 ${selected
                          ? "bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-200 font-bold"
                          : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400"
                          }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-bold">{cand.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {cand.city || "—"}
                            {cand.address ? ` • ${cand.address}` : ""}
                          </div>
                        </div>
                        {selected && <span className="text-amber-500 font-black">✓</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMergeSource(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {t("admin_places.cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmMerge}
                disabled={loading || !mergeTargetId}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition cursor-pointer disabled:opacity-40"
              >
                {loading ? t("admin_places.merging") : `🔀 ${t("admin_places.merge_btn")}`}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de edición administrativa del establecimiento */}
      {editingPlace && (
        <EditPlaceModal
          place={editingPlace}
          occasionsList={occasionsList}
          availableTags={Array.from(new Set(placesList.flatMap((p) => p.tags || [])))}
          isOpen={true}
          onClose={() => setEditingPlace(null)}
        />
      )}
    </div>
  );
}
