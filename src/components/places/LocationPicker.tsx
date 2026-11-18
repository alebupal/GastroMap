"use client";

import { useState, useEffect, useRef } from "react";
import { SPANISH_PROVINCES } from "@/data/spanishLocations";
import { searchAddressAction } from "@/lib/actions/places";
import type { GeocodingResult } from "@/lib/geocoding";

interface LocationPickerProps {
  initialCity?: string;
  initialAddress?: string;
  initialLat?: string;
  initialLng?: string;
  onLocationChange?: (loc: {
    city: string;
    address: string;
    latitude: string;
    longitude: string;
  }) => void;
}

export function LocationPicker({
  initialCity = "",
  initialAddress = "",
  initialLat = "",
  initialLng = "",
  onLocationChange,
}: LocationPickerProps) {
  // Estado de Provincia y Municipio
  const defaultProv = SPANISH_PROVINCES.find((p) => p.id === "granada") || SPANISH_PROVINCES[0];
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>(defaultProv.id);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>(
    defaultProv.municipalities[0] || "Granada"
  );
  const [customMunicipality, setCustomMunicipality] = useState<string>("");
  const [isCustomMun, setIsCustomMun] = useState<boolean>(false);
  const [address, setAddress] = useState<string>(initialAddress);
  const [lat, setLat] = useState<string>(initialLat);
  const [lng, setLng] = useState<string>(initialLng);

  // Buscador de direcciones en vivo
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Obtener provincia actual y sus municipios
  const currentProvince = SPANISH_PROVINCES.find((p) => p.id === selectedProvinceId) || SPANISH_PROVINCES[0];

  // Sincronizar ciudad resultante
  const finalCity = isCustomMun && customMunicipality ? customMunicipality : selectedMunicipality;

  useEffect(() => {
    if (onLocationChange) {
      onLocationChange({
        city: finalCity,
        address,
        latitude: lat,
        longitude: lng,
      });
    }
  }, [finalCity, address, lat, lng]);

  // Si vienen coordenadas o ciudad inicial por autocompletado de URL
  useEffect(() => {
    if (initialLat) setLat(initialLat);
    if (initialLng) setLng(initialLng);
    if (initialAddress) setAddress(initialAddress);
    if (initialCity) {
      // Intentar casar con una provincia o municipio
      const foundProv = SPANISH_PROVINCES.find((p) =>
        p.municipalities.some((m) => m.toLowerCase().includes(initialCity.toLowerCase()))
      );
      if (foundProv) {
        setSelectedProvinceId(foundProv.id);
        const foundMun = foundProv.municipalities.find((m) =>
          m.toLowerCase().includes(initialCity.toLowerCase())
        );
        if (foundMun) {
          setSelectedMunicipality(foundMun);
          setIsCustomMun(false);
        } else {
          setIsCustomMun(true);
          setCustomMunicipality(initialCity);
        }
      } else {
        setIsCustomMun(true);
        setCustomMunicipality(initialCity);
      }
    }
  }, [initialCity, initialAddress, initialLat, initialLng]);

  // Manejar búsqueda con debounce
  function handleSearchInput(text: string) {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (text.trim().length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchAddressAction(text);
      setSearchResults(results);
      setShowResults(results.length > 0);
      setIsSearching(false);
    }, 350);
  }

  // Al seleccionar un resultado de Nominatim
  function handleSelectResult(result: GeocodingResult) {
    // 1. Asignar dirección
    const resolvedAddress = result.road || result.displayName.split(",")[0] || "";
    setAddress(resolvedAddress);

    // 2. Asignar coordenadas
    setLat(result.latitude.toString());
    setLng(result.longitude.toString());

    // 3. Vincular con provincia si existe
    if (result.province) {
      const provLower = result.province.toLowerCase();
      const matchedProv = SPANISH_PROVINCES.find((p) =>
        provLower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(provLower)
      );
      if (matchedProv) {
        setSelectedProvinceId(matchedProv.id);

        // 4. Vincular con municipio dentro de esa provincia
        if (result.city) {
          const cityLower = result.city.toLowerCase();
          const matchedMun = matchedProv.municipalities.find((m) =>
            cityLower.includes(m.toLowerCase()) || m.toLowerCase().includes(cityLower)
          );
          if (matchedMun) {
            setSelectedMunicipality(matchedMun);
            setIsCustomMun(false);
          } else {
            setIsCustomMun(true);
            setCustomMunicipality(result.city);
          }
        }
      } else if (result.city) {
        setIsCustomMun(true);
        setCustomMunicipality(result.city);
      }
    } else if (result.city) {
      setIsCustomMun(true);
      setCustomMunicipality(result.city);
    }

    setShowResults(false);
    setSearchQuery("");
  }

  // Al cambiar de provincia
  function handleProvinceChange(provId: string) {
    setSelectedProvinceId(provId);
    const prov = SPANISH_PROVINCES.find((p) => p.id === provId);
    if (prov && prov.municipalities.length > 0) {
      setSelectedMunicipality(prov.municipalities[0]);
      setIsCustomMun(false);
    }
  }

  return (
    <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
          📍 Ubicación y Dirección
        </label>
        {lat && lng ? (
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <span>✓</span> Coordenadas detectadas
          </span>
        ) : (
          <span className="text-[11px] text-amber-600 dark:text-amber-400">
            ⚠️ Sin coordenadas
          </span>
        )}
      </div>

      {/* 1. Buscador con API Nominatim OpenStreetMap */}
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            placeholder="🔍 Buscar dirección o sitio (ej. Calle Recogidas, Granada)..."
            className="w-full px-3 py-2 pr-8 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
          />
          {isSearching && (
            <span className="absolute right-2.5 top-2.5 text-xs animate-spin text-slate-400">
              ⏳
            </span>
          )}
        </div>

        {/* Dropdown de sugerencias de OpenStreetMap */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
            {searchResults.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectResult(r)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 dark:hover:bg-amber-950/30 transition flex flex-col gap-0.5 cursor-pointer"
              >
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {r.road || r.city || r.displayName.split(",")[0]}
                </span>
                <span className="text-[11px] text-slate-400 truncate">
                  {r.displayName}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Selectores jerárquicos cerrados: Provincia y Municipio */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Provincia
          </label>
          <select
            value={selectedProvinceId}
            onChange={(e) => handleProvinceChange(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {SPANISH_PROVINCES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Población / Municipio
          </label>
          {!isCustomMun ? (
            <select
              value={selectedMunicipality}
              onChange={(e) => {
                if (e.target.value === "__custom__") {
                  setIsCustomMun(true);
                  setCustomMunicipality("");
                } else {
                  setSelectedMunicipality(e.target.value);
                }
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {currentProvince.municipalities.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value="__custom__">➕ Otra población...</option>
            </select>
          ) : (
            <div className="flex gap-1">
              <input
                type="text"
                value={customMunicipality}
                onChange={(e) => setCustomMunicipality(e.target.value)}
                placeholder="Escribe población..."
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setIsCustomMun(false)}
                className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-lg text-[10px] text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-300"
                title="Volver al selector"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Dirección / Calle / Zona */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
          Calle / Número o Zona (ej. Calle Real 12, Centro, Triana...)
        </label>
        <input
          type="text"
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Ej. Calle Navas, 28..."
          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {/* Campos ocultos para el FormData */}
      <input type="hidden" name="city" value={finalCity} />
      <input type="hidden" name="latitude" value={lat} />
      <input type="hidden" name="longitude" value={lng} />
    </div>
  );
}
