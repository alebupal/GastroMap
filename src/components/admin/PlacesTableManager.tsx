"use client";

import { useState, useMemo } from "react";
import {
  bulkDeletePlacesAction,
  deletePlaceAction,
  mergePlacesAction,
  type PlaceWithDetails,
} from "@/lib/actions/places";

interface PlacesTableManagerProps {
  places: PlaceWithDetails[];
}

export function PlacesTableManager({ places: initialPlaces }: PlacesTableManagerProps) {
  const [placesList, setPlacesList] = useState<PlaceWithDetails[]>(initialPlaces);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [mergeSource, setMergeSource] = useState<PlaceWithDetails | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [mergeSearch, setMergeSearch] = useState<string>("");

  // Lista única de ciudades para el filtro rápido
  const cities = useMemo(() => {
    const set = new Set<string>();
    placesList.forEach((p) => {
      if (p.city) set.add(p.city);
    });
    return Array.from(set).sort();
  }, [placesList]);

  // Sitios filtrados en la tabla
  const filteredPlaces = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return placesList.filter((p) => {
      const matchCity = cityFilter === "all" || p.city === cityFilter;
      if (!matchCity) return false;

      if (!q) return true;
      const matchName = p.name.toLowerCase().includes(q);
      const matchAddr = p.address?.toLowerCase().includes(q);
      const matchCityName = p.city?.toLowerCase().includes(q);
      const matchAuthor = (p.createdByUsername || p.createdByName)?.toLowerCase().includes(q);
      const matchTags = p.tags.some((t) => t.toLowerCase().includes(q));

      return matchName || matchAddr || matchCityName || matchAuthor || matchTags;
    });
  }, [placesList, searchQuery, cityFilter]);

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

  // Seleccionar / Deseleccionar todos los visibles
  function toggleSelectAll() {
    if (selectedIds.size === filteredPlaces.length && filteredPlaces.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPlaces.map((p) => p.id)));
    }
  }

  // Eliminación individual
  async function handleDeleteSingle(place: PlaceWithDetails) {
    if (!confirm(`¿Eliminar definitivamente «${place.name}»?`)) return;

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
      setStatusMessage({ type: "success", text: `Sitio «${place.name}» eliminado.` });
    }
  }

  // Eliminación masiva / en bloque
  async function handleBulkDelete() {
    const count = selectedIds.size;
    if (count === 0) return;

    if (!confirm(`¿Eliminar DEFINITIVAMENTE los ${count} sitios seleccionados? Esta acción es irreversible.`)) {
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
      setStatusMessage({ type: "success", text: `Se han eliminado ${count} sitios con éxito.` });
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

  const allSelected = filteredPlaces.length > 0 && selectedIds.size === filteredPlaces.length;

  return (
    <div className="w-full space-y-4 text-left">
      {/* Barra de control y búsqueda */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-2.5 text-xs text-slate-500">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar por nombre, ciudad, tag o autor..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {cities.length > 0 && (
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500 shrink-0"
            >
              <option value="all">Todas las ciudades ({cities.length})</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Acciones por lote */}
        <div className="flex items-center gap-2 shrink-0">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition cursor-pointer disabled:opacity-50 shadow-md shadow-red-600/20"
            >
              <span>🗑️</span>
              <span>Eliminar seleccionados ({selectedIds.size})</span>
            </button>
          )}

          <span className="text-xs text-slate-400 font-medium">
            Mostrando {filteredPlaces.length} de {placesList.length}
          </span>
        </div>
      </div>

      {/* Mensajes de estado */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
            statusMessage.type === "success"
              ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/50"
              : "bg-red-950/40 text-red-400 border border-red-900/50"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabla de Sitios */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                    title="Seleccionar todos los visibles"
                  />
                </th>
                <th className="p-3">Establecimiento</th>
                <th className="p-3">Ciudad</th>
                <th className="p-3">Precio</th>
                <th className="p-3">Planes / Ocasiones</th>
                <th className="p-3">GPS / Mapa</th>
                <th className="p-3">Autor</th>
                <th className="p-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredPlaces.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 text-xs">
                    No se encontraron establecimientos que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredPlaces.map((place) => {
                  const isChecked = selectedIds.has(place.id);
                  const hasCoords = place.latitude != null && place.longitude != null;

                  return (
                    <tr
                      key={place.id}
                      className={`hover:bg-slate-800/40 transition ${
                        isChecked ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(place.id)}
                          className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>

                      <td className="p-3 max-w-[220px]">
                        <div className="font-bold text-slate-100 truncate">{place.name}</div>
                        {place.address && (
                          <div className="text-[11px] text-slate-500 truncate">{place.address}</div>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap text-slate-300">
                        {place.city || <span className="text-slate-600">—</span>}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className="font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-1.5 py-0.5 rounded text-[11px]">
                          {place.priceRange}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-1 flex-wrap max-w-xs">
                          {place.occasions.map((occ) => (
                            <span
                              key={occ}
                              className="px-1.5 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300 font-semibold"
                            >
                              {occ}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        {hasCoords ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-blue-400 font-semibold">
                            <span>📍</span>
                            <span>{place.latitude?.toFixed(3)}, {place.longitude?.toFixed(3)}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">Sin coords</span>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap text-slate-400 text-[11px]">
                        @{place.createdByUsername || place.createdByName.toLowerCase().replace(/\s+/g, "")}
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {place.googleMapsUrl && (
                            <a
                              href={place.googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-blue-400 text-xs transition"
                              title="Abrir en Google Maps"
                            >
                              ↗
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setMergeSource(place);
                              setMergeTargetId("");
                              setMergeSearch("");
                            }}
                            disabled={loading || placesList.length < 2}
                            className="text-slate-400 hover:text-amber-400 text-xs transition cursor-pointer disabled:opacity-40"
                            title="Fusionar este sitio duplicado dentro de otro"
                          >
                            🔀
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSingle(place)}
                            disabled={loading}
                            className="text-slate-500 hover:text-red-400 text-xs transition cursor-pointer disabled:opacity-40"
                            title="Eliminar sitio"
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

      {/* Modal de fusión administrativa de duplicados */}
      {mergeSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-left max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>🔀</span>
                  <span>Fusionar establecimiento duplicado</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Se absorberá y eliminará:{" "}
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
              Todos los comentarios, favoritos, estados personales, valoraciones, notas, ocasiones y etiquetas de{" "}
              <strong>{mergeSource.name}</strong> se transferirán a la ficha principal que elijas abajo.
            </div>

            <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Elige la ficha principal que sobrevivirá:
              </label>
              <input
                type="text"
                value={mergeSearch}
                onChange={(e) => setMergeSearch(e.target.value)}
                placeholder="🔍 Buscar establecimiento destino..."
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <div className="overflow-y-auto max-h-52 space-y-1.5 pr-1">
                {mergeCandidates.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    No hay establecimientos coincidentes.
                  </p>
                ) : (
                  mergeCandidates.map((cand) => {
                    const selected = mergeTargetId === cand.id;
                    return (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => setMergeTargetId(cand.id)}
                        className={`w-full text-left p-2.5 rounded-xl border text-xs transition cursor-pointer flex items-center justify-between gap-2 ${
                          selected
                            ? "bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-200 font-bold"
                            : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-bold">{cand.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {cand.city || "Sin ciudad"}
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
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmMerge}
                disabled={loading || !mergeTargetId}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition cursor-pointer disabled:opacity-40"
              >
                {loading ? "Fusionando..." : "🔀 Fusionar fichas"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
