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
import { useToast } from "@/components/ui/Toast";
import { EditPlaceModal } from "@/components/places/EditPlaceModal";
import { parseCityCountry, findCountry } from "@/lib/location";
import { normalizeSearchText } from "@/lib/search";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface PlacesTableManagerProps {
  places: PlaceWithDetails[];
  occasionsList?: Array<{ id: string; name: string; icon: string }>;
  showSpaceColumn?: boolean;
}

type PlaceSortField = "name" | "space" | "city" | "price" | "occasions" | "author" | "createdAt";

const PRICE_RANK: Record<string, number> = {
  "€": 1,
  "€€": 2,
  "€€€": 3,
  "€€€€": 4,
  "???": 5,
};

export function PlacesTableManager({
  places: initialPlaces,
  occasionsList = [],
  showSpaceColumn = true,
}: PlacesTableManagerProps) {
  const { t, locale } = useT();
  const { toast } = useToast();
  const [placesList, setPlacesList] = useState<PlaceWithDetails[]>(initialPlaces);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [spaceFilter, setSpaceFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [sortField, setSortField] = useState<PlaceSortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);

  function toggleSort(field: PlaceSortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "createdAt" ? "desc" : "asc");
    }
    setCurrentPage(1);
  }
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [mergeSource, setMergeSource] = useState<PlaceWithDetails | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [mergeSearch, setMergeSearch] = useState<string>("");
  const [editingPlace, setEditingPlace] = useState<PlaceWithDetails | null>(null);

  // Lista única de espacios/grupos, países y ciudades filtradas
  const spaceOptions = useMemo(() => {
    const groupsMap = new Map<string, { name: string; icon: string; count: number }>();
    let personalCount = 0;

    placesList.forEach((p) => {
      if (!p.groupId) {
        personalCount++;
      } else {
        const cur = groupsMap.get(p.groupId);
        if (cur) {
          cur.count++;
        } else {
          groupsMap.set(p.groupId, {
            name: p.groupName || t("nav.my_groups"),
            icon: p.groupIcon || "🍻",
            count: 1,
          });
        }
      }
    });

    const opts = Array.from(groupsMap.entries())
      .sort((a, b) => a[1].name.localeCompare(b[1].name, "es", { sensitivity: "base" }))
      .map(([id, info]) => ({
        value: id,
        label: `${info.name} (${info.count})`,
        icon: info.icon,
      }));

    if (personalCount > 0) {
      opts.push({
        value: "personal",
        label: `${t("spaces.personal_map")} (${personalCount})`,
        icon: "🏠",
      });
    }

    return opts;
  }, [placesList, t]);

  const { allCountries, availableCities } = useMemo(() => {
    const cSet = new Set<string>();
    placesList.forEach((p) => {
      if (
        spaceFilter !== "all" &&
        (spaceFilter === "personal" ? p.groupId !== null : p.groupId !== spaceFilter)
      ) {
        return;
      }
      const parsed = parseCityCountry(p.city, p.address);
      const effectiveCountry = p.country || parsed.country;
      if (effectiveCountry) cSet.add(effectiveCountry);
    });
    const countries = Array.from(cSet).sort((a, b) => a.localeCompare(b));

    const citySet = new Set<string>();
    placesList.forEach((p) => {
      if (
        spaceFilter !== "all" &&
        (spaceFilter === "personal" ? p.groupId !== null : p.groupId !== spaceFilter)
      ) {
        return;
      }
      const parsed = parseCityCountry(p.city, p.address);
      const effectiveCountry = p.country || parsed.country;
      if (countryFilter === "all" || effectiveCountry === countryFilter) {
        if (parsed.city) citySet.add(parsed.city);
      }
    });
    const cities = Array.from(citySet).sort((a, b) => a.localeCompare(b));

    return { allCountries: countries, availableCities: cities };
  }, [placesList, spaceFilter, countryFilter]);

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
  // Sitios filtrados y ordenados en la tabla
  const filteredPlaces = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    const filtered = placesList.filter((p) => {
      if (
        spaceFilter !== "all" &&
        (spaceFilter === "personal" ? p.groupId !== null : p.groupId !== spaceFilter)
      ) {
        return false;
      }

      const parsed = parseCityCountry(p.city, p.address);
      const effectiveCountry = p.country || parsed.country;

      if (countryFilter !== "all" && effectiveCountry !== countryFilter) {
        return false;
      }
      if (cityFilter !== "all" && parsed.city !== cityFilter) {
        return false;
      }

      if (!q) return true;
      const tokens = q.split(/\s+/).filter(Boolean);
      const searchableText = normalizeSearchText(
        [
          p.name,
          p.groupName || "",
          p.city || "",
          p.address || "",
          p.notes || "",
          p.privateNotes || "",
          p.createdByName || "",
          p.createdByUsername || "",
          p.createdByUsername ? `@${p.createdByUsername}` : "",
          ...p.tags,
          ...p.occasions,
          ...(p.commentsTexts || []),
          ...(p.commentAuthors || []),
        ].join(" ")
      );

      return (
        searchableText.includes(q) ||
        (tokens.length > 1 && tokens.every((tok) => searchableText.includes(tok)))
      );
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortField) {
        case "name":
          return a.name.localeCompare(b.name, "es", { sensitivity: "base" }) * dir;
        case "space": {
          const sa = a.groupId ? a.groupName || "" : t("spaces.personal_map");
          const sb = b.groupId ? b.groupName || "" : t("spaces.personal_map");
          const cmp = sa.localeCompare(sb, "es", { sensitivity: "base" }) * dir;
          return cmp !== 0 ? cmp : a.name.localeCompare(b.name, "es", { sensitivity: "base" });
        }
        case "city": {
          const ca = a.city || "";
          const cb = b.city || "";
          const cmp = ca.localeCompare(cb, "es", { sensitivity: "base" }) * dir;
          return cmp !== 0 ? cmp : a.name.localeCompare(b.name, "es", { sensitivity: "base" });
        }
        case "price": {
          const pa = PRICE_RANK[a.priceRange] ?? 9;
          const pb = PRICE_RANK[b.priceRange] ?? 9;
          return pa !== pb ? (pa - pb) * dir : a.name.localeCompare(b.name, "es", { sensitivity: "base" });
        }
        case "occasions": {
          const oa = a.occasions[0] || "";
          const ob = b.occasions[0] || "";
          const cmp = oa.localeCompare(ob, "es", { sensitivity: "base" }) * dir;
          return cmp !== 0 ? cmp : (a.occasions.length - b.occasions.length) * dir;
        }
        case "author": {
          const aa = a.createdByUsername || a.createdByName || "";
          const ab = b.createdByUsername || b.createdByName || "";
          return aa.localeCompare(ab, "es", { sensitivity: "base" }) * dir;
        }
        case "createdAt":
        default: {
          const ta = new Date(a.createdAt).getTime();
          const tb = new Date(b.createdAt).getTime();
          return (ta - tb) * dir;
        }
      }
    });
  }, [placesList, searchQuery, spaceFilter, countryFilter, cityFilter, sortField, sortDir, t]);

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
      toast(res.error, { kind: "error" });
    } else {
      setPlacesList((prev) => prev.filter((p) => p.id !== place.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(place.id);
        return next;
      });
      const msg = t("admin_places.delete_success", { name: place.name });
      setStatusMessage({ type: "success", text: msg });
      toast(msg, { kind: "success" });
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
      toast(res.error, { kind: "error" });
    } else {
      setPlacesList((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
      const successMsg =
        count === 1
          ? t("admin_places.delete_bulk_success_single")
          : t("admin_places.delete_bulk_success", { count: String(count) });
      setStatusMessage({ type: "success", text: successMsg });
      toast(successMsg, { kind: "success" });
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
      toast(res.error, { kind: "error" });
    } else {
      setPlacesList((prev) => prev.filter((p) => p.id !== mergeSource.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(mergeSource.id);
        return next;
      });
      const mergeMsg = `«${mergeSource.name}» se ha fusionado correctamente dentro de «${targetPlace.name}».`;
      setStatusMessage({
        type: "success",
        text: mergeMsg,
      });
      toast(mergeMsg, { kind: "success" });
      setMergeSource(null);
      setMergeTargetId("");
      setMergeSearch("");
    }
  }

  const mergeCandidates = useMemo(() => {
    if (!mergeSource) return [];
    const q = normalizeSearchText(mergeSearch);
    return placesList
      .filter((p) => {
        if (p.id === mergeSource.id) return false;
        if (p.groupId !== mergeSource.groupId) return false;
        if (!q) return true;
        return (
          normalizeSearchText(p.name).includes(q) ||
          (p.city && normalizeSearchText(p.city).includes(q)) ||
          (p.address && normalizeSearchText(p.address).includes(q))
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 flex-1">
          <div className="relative w-full sm:flex-1 sm:max-w-sm">
            <span className="material-symbols-outlined text-base text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none leading-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t("admin_places.search_placeholder").replace(/^🔍\s*/, "")}
              className="w-full pl-9 pr-3 py-2 rounded-full text-base sm:text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-center gap-2">
          {showSpaceColumn && spaceOptions.length > 0 && (
            <SearchableSelect
              value={spaceFilter}
              onChange={(val) => {
                setSpaceFilter(val);
                setCountryFilter("all");
                setCityFilter("all");
                setCurrentPage(1);
              }}
              options={spaceOptions}
              allOption={{
                value: "all",
                label: `${t("admin_places.all_spaces")} (${spaceOptions.length})`,
                icon: (
                  <span className="material-symbols-outlined text-base text-orange-600 leading-none">
                    workspaces
                  </span>
                ),
              }}
              searchPlaceholder={t("admin_places.search_space_placeholder")}
              className="w-full sm:w-auto sm:shrink-0"
              buttonClassName="w-full sm:w-auto bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-700"
            />
          )}

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
                icon: (
                  <span className="material-symbols-outlined text-base text-orange-600 leading-none">
                    public
                  </span>
                ),
              }}
              searchPlaceholder={t("location.country_placeholder")}
              className="w-full sm:w-auto sm:shrink-0"
              buttonClassName="w-full sm:w-auto bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-700"
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
                icon: (
                  <span className="material-symbols-outlined text-base text-orange-600 leading-none">
                    location_city
                  </span>
                ),
              }}
              searchPlaceholder={t("location.city_placeholder")}
              className="w-full sm:w-auto sm:shrink-0"
              buttonClassName="w-full sm:w-auto bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-700"
            />
          )}
          </div>
        </div>

        {/* Acciones por lote */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-between sm:justify-end">
          {selectedIds.size > 0 && (
            <>
              <button
                type="button"
                onClick={handleBulkBackup}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white transition cursor-pointer shadow-md shadow-orange-600/20"
                title={t("admin_places.bulk_backup_title")}
              >
                <span className="material-symbols-outlined text-sm leading-none">download</span>
                <span>{t("admin_places.bulk_backup", { count: selectedIds.size })}</span>
              </button>

              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition cursor-pointer disabled:opacity-50 shadow-md shadow-red-600/20"
              >
                <span className="material-symbols-outlined text-sm leading-none">delete</span>
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
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 font-semibold">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-orange-500"
              />
              <span>{t("admin_places.col_select_all")}</span>
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={sortField}
                onChange={(e) => {
                  const next = e.target.value as PlaceSortField;
                  setSortField(next);
                  setSortDir(next === "createdAt" ? "desc" : "asc");
                  setCurrentPage(1);
                }}
                aria-label={t("common.sort_by")}
                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
              >
                <option value="createdAt">{t("common.sort_date")}</option>
                <option value="name">{t("admin_places.col_place")}</option>
                {showSpaceColumn && <option value="space">{t("spaces.belonging_space")}</option>}
                <option value="city">{t("admin_places.col_city")}</option>
                <option value="price">{t("admin_places.col_price")}</option>
                <option value="author">{t("admin_places.col_author")}</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
                className="p-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                aria-label={t("common.sort_by")}
              >
                <span className="material-symbols-outlined text-sm leading-none block">
                  {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
                </span>
              </button>
            </div>
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
                      className="mt-1 rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-orange-500 cursor-pointer"
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
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400 font-mono font-semibold ml-auto">
                      <span className="material-symbols-outlined text-xs leading-none">location_on</span>
                      <span>{place.latitude?.toFixed(3)}, {place.longitude?.toFixed(3)}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 dark:text-slate-600 ml-auto">
                      {t("admin_places.no_coords")}
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] text-slate-400 truncate min-w-0">
                    @{place.createdByUsername || place.createdByName.toLowerCase().replace(/\s+/g, "")}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {place.googleMapsUrl && (
                      <a
                        href={place.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-blue-500 text-xs font-semibold flex items-center gap-0.5"
                      >
                        Maps ↗
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingPlace(place)}
                      disabled={loading}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-orange-600 text-xs font-semibold cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm leading-none">edit</span>
                      <span>{t("common.edit")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMergeSource(place);
                        setMergeTargetId("");
                        setMergeSearch("");
                      }}
                      disabled={loading || placesList.length < 2}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-amber-600 text-xs font-semibold cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm leading-none">merge</span>
                      <span>{t("admin_places.merge_btn")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSingle(place)}
                      disabled={loading}
                      aria-label={t("admin_places.delete_title")}
                      className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-semibold cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base leading-none">delete</span>
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
                    className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-orange-500 cursor-pointer"
                    title={t("admin_places.col_select_all")}
                  />
                </th>
                <th className="p-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("name")}
                    className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-orange-600 transition ${
                      sortField === "name" ? "text-orange-600 dark:text-orange-400" : ""
                    }`}
                  >
                    <span>{t("admin_places.col_place")}</span>
                    <span className="material-symbols-outlined text-[14px] leading-none">
                      {sortField === "name"
                        ? sortDir === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
                {showSpaceColumn && (
                  <th className="p-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("space")}
                      className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-orange-600 transition ${
                        sortField === "space" ? "text-orange-600 dark:text-orange-400" : ""
                      }`}
                    >
                      <span>{t("admin_places.col_space")}</span>
                      <span className="material-symbols-outlined text-[14px] leading-none">
                        {sortField === "space"
                          ? sortDir === "asc"
                            ? "arrow_upward"
                            : "arrow_downward"
                          : "unfold_more"}
                      </span>
                    </button>
                  </th>
                )}
                <th className="p-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("city")}
                    className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-orange-600 transition ${
                      sortField === "city" ? "text-orange-600 dark:text-orange-400" : ""
                    }`}
                  >
                    <span>{t("admin_places.col_city")}</span>
                    <span className="material-symbols-outlined text-[14px] leading-none">
                      {sortField === "city"
                        ? sortDir === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
                <th className="p-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("price")}
                    className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-orange-600 transition ${
                      sortField === "price" ? "text-orange-600 dark:text-orange-400" : ""
                    }`}
                  >
                    <span>{t("admin_places.col_price")}</span>
                    <span className="material-symbols-outlined text-[14px] leading-none">
                      {sortField === "price"
                        ? sortDir === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
                <th className="p-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("occasions")}
                    className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-orange-600 transition ${
                      sortField === "occasions" ? "text-orange-600 dark:text-orange-400" : ""
                    }`}
                  >
                    <span>{t("admin_places.col_occasions")}</span>
                    <span className="material-symbols-outlined text-[14px] leading-none">
                      {sortField === "occasions"
                        ? sortDir === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
                <th className="p-3">{t("admin_places.col_gps")}</th>
                <th className="p-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("author")}
                    className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-orange-600 transition ${
                      sortField === "author" ? "text-orange-600 dark:text-orange-400" : ""
                    }`}
                  >
                    <span>{t("admin_places.col_author")}</span>
                    <span className="material-symbols-outlined text-[14px] leading-none">
                      {sortField === "author"
                        ? sortDir === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
                <th className="p-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("createdAt")}
                    className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-orange-600 transition ${
                      sortField === "createdAt" ? "text-orange-600 dark:text-orange-400" : ""
                    }`}
                  >
                    <span>{t("common.sort_date")}</span>
                    <span className="material-symbols-outlined text-[14px] leading-none">
                      {sortField === "createdAt"
                        ? sortDir === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </button>
                </th>
                <th className="p-3 text-right">{t("admin_places.col_action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {paginatedPlaces.length === 0 ? (
                <tr>
                  <td colSpan={showSpaceColumn ? 10 : 9} className="p-8 text-center text-slate-500 text-xs">
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
                          className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-orange-500 cursor-pointer"
                        />
                      </td>

                      <td className="p-3 max-w-[220px]">
                        <div className="font-bold text-slate-900 dark:text-slate-100 truncate">{place.name}</div>
                        {place.address && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{place.address}</div>
                        )}
                      </td>

                      {showSpaceColumn && (
                        <td className="p-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200/70 dark:border-orange-900/50">
                            <span>{place.groupId ? place.groupIcon || "🍻" : "🏠"}</span>
                            <span className="truncate max-w-[110px]">
                              {place.groupId ? place.groupName || t("nav.my_groups") : t("spaces.personal_short")}
                            </span>
                          </span>
                        </td>
                      )}

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
                            <span className="material-symbols-outlined text-sm leading-none">location_on</span>
                            <span>{place.latitude?.toFixed(3)}, {place.longitude?.toFixed(3)}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600 text-[11px]">{t("admin_places.no_coords")}</span>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                        @{place.createdByUsername || place.createdByName.toLowerCase().replace(/\s+/g, "")}
                      </td>

                      <td className="p-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                        {new Date(place.createdAt).toLocaleDateString(
                          locale === "en" ? "en-GB" : "es-ES",
                          { day: "2-digit", month: "short", year: "numeric" }
                        )}
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
                            className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-orange-600 transition cursor-pointer disabled:opacity-40"
                            title={t("admin_places.edit_title")}
                            aria-label={t("admin_places.edit_title")}
                          >
                            <span className="material-symbols-outlined text-[15px] leading-none">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMergeSource(place);
                              setMergeTargetId("");
                              setMergeSearch("");
                            }}
                            disabled={loading || placesList.length < 2}
                            className="p-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200 transition cursor-pointer disabled:opacity-40"
                            title={t("admin_places.merge_title")}
                            aria-label={t("admin_places.merge_title")}
                          >
                            <span className="material-symbols-outlined text-[15px] leading-none">merge</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSingle(place)}
                            disabled={loading}
                            className="p-1 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 hover:bg-red-200 transition cursor-pointer disabled:opacity-40"
                            title={t("admin_places.delete_title")}
                            aria-label={t("admin_places.delete_title")}
                          >
                            <span className="material-symbols-outlined text-[15px] leading-none">delete</span>
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
        <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-sm gm-backdrop-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5 space-y-4 text-left max-h-[94dvh] sm:max-h-[90dvh] flex flex-col gm-modal-in">
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
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
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
                className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition cursor-pointer disabled:opacity-40"
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
