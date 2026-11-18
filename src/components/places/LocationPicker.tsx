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
  // Modo: 'global' (cualquier ciudad del mundo) o 'ine' (selector por provincias de España)
  const [mode, setMode] = useState<"global" | "ine">("global");

  // Estado común
  const [city, setCity] = useState<string>(initialCity);
  const [address, setAddress] = useState<string>(initialAddress);
  const [lat, setLat] = useState<string>(initialLat);
  const [lng, setLng] = useState<string>(initialLng);

  // Estado selector INE España
  const defaultProv = SPANISH_PROVINCES.find((p) => p.id === "granada") || SPANISH_PROVINCES[0];
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>(defaultProv.id);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>(
    defaultProv.municipalities[0] || "Granada"
  );

  // Buscador de direcciones en vivo a nivel mundial
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentProvince = SPANISH_PROVINCES.find((p) => p.id === selectedProvinceId) || SPANISH_PROVINCES[0];

  // Ciudad efectiva según el modo activo
  const effectiveCity = mode === "ine" ? selectedMunicipality : city;

  useEffect(() => {
    if (onLocationChange) {
      onLocationChange({
        city: effectiveCity,
        address,
        latitude: lat,
        longitude: lng,
      });
    }
  }, [effectiveCity, address, lat, lng]);

  // Si vienen coordenadas o ciudad inicial por autocompletado de URL
  useEffect(() => {
    if (initialLat) setLat(initialLat);
    if (initialLng) setLng(initialLng);
    if (initialAddress) setAddress(initialAddress);
    if (initialCity) {
      setCity(initialCity);
      // Intentar vincular si es municipio español
      const foundProv = SPANISH_PROVINCES.find((p) =>
        p.municipalities.some((m) => m.toLowerCase().includes(initialCity.toLowerCase()))
      );
      if (foundProv) {
        setSelectedProvinceId(foundProv.id);
        const foundMun = foundProv.municipalities.find((m) =>
          m.toLowerCase().includes(initialCity.toLowerCase())
        );
        if (foundMun) setSelectedMunicipality(foundMun);
      }
    }
  }, [initialCity, initialAddress, initialLat, initialLng]);

  // Manejar búsqueda mundial con debounce
  function handleSearchInput(text: string) {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (text.trim().length < 3) {
      setSearchResults([]);
      setShowResults(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchAddressAction(text);
        setSearchResults(results);
        setShowResults(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }

  function handleSelectResult(result: GeocodingResult) {
    if (result.road) {
      setAddress(result.road);
    } else if (result.name) {
      setAddress(result.name);
    }

    setLat(result.latitude.toString());
    setLng(result.longitude.toString());

    // Extraer ciudad o municipio
    const chosenCity = result.city || result.province || result.displayName.split(",")[0].trim();
    const fullCity = result.country && result.country !== "España" && result.country !== "Spain"
      ? `${chosenCity}, ${result.country}`
      : chosenCity;

    setCity(fullCity);

    // Si coincide con provincia española
    if (result.province) {
      const provLower = result.province.toLowerCase();
      const matchedProv = SPANISH_PROVINCES.find((p) =>
        provLower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(provLower)
      );
      if (matchedProv) {
        setSelectedProvinceId(matchedProv.id);
        if (result.city) {
          const cityLower = result.city.toLowerCase();
          const matchedMun = matchedProv.municipalities.find((m) =>
            cityLower.includes(m.toLowerCase()) || m.toLowerCase().includes(cityLower)
          );
          if (matchedMun) setSelectedMunicipality(matchedMun);
        }
      }
    }

    setShowResults(false);
    setSearchQuery("");
  }

  return (
    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3 text-left">
      {/* Encabezado con selector de modo */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <span>📍</span>
          <span>Localización y Coordenadas</span>
        </label>
        <div className="inline-flex p-0.5 rounded-lg bg-slate-200 dark:bg-slate-700/60 text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setMode("global")}
            className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
              mode === "global"
                ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            🌍 Cualquier país
          </button>
          <button
            type="button"
            onClick={() => setMode("ine")}
            className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
              mode === "ine"
                ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            🇪🇸 España (INE)
          </button>
        </div>
      </div>

      {/* 1. Buscador inteligente OpenStreetMap (Mundial) */}
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setShowResults(true);
            }}
            placeholder="🔎 Buscar calle, barrio, restaurante o ciudad del mundo..."
            className="w-full px-3 py-2 pl-8 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <span className="absolute left-2.5 top-2.5 text-xs text-slate-400 pointer-events-none">
            {isSearching ? "⏳" : "🔍"}
          </span>
          {lat && lng && (
            <span className="absolute right-2.5 top-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              GPS ✓
            </span>
          )}
        </div>

        {/* Dropdown de sugerencias de OpenStreetMap */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
            {searchResults.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectResult(r)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 dark:hover:bg-amber-950/30 transition flex flex-col gap-0.5 cursor-pointer"
              >
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {r.road || r.name || r.displayName.split(",")[0]}
                </span>
                <span className="text-[11px] text-slate-400 truncate">
                  {r.displayName}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Selector de Ciudad según Modo */}
      {mode === "global" ? (
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Ciudad / Población / País
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ej. Tokio, Roma, Nueva York, Granada, París..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Provincia
            </label>
            <select
              value={selectedProvinceId}
              onChange={(e) => {
                setSelectedProvinceId(e.target.value);
                const prov = SPANISH_PROVINCES.find((p) => p.id === e.target.value);
                if (prov && prov.municipalities.length > 0) {
                  setSelectedMunicipality(prov.municipalities[0]);
                }
              }}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
              Municipio ({currentProvince.municipalities.length})
            </label>
            <select
              value={selectedMunicipality}
              onChange={(e) => setSelectedMunicipality(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {currentProvince.municipalities.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* 3. Dirección / Calle / Zona */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
          Dirección / Calle o Barrio (ej. Shibuya, Trastevere, Calle Navas...)
        </label>
        <input
          type="text"
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Ej. Calle Navas 28, Times Square..."
          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {/* Coordenadas en texto pequeño */}
      {lat && lng && (
        <p className="text-[10px] text-slate-400">
          Coordenadas: {parseFloat(lat).toFixed(4)}, {parseFloat(lng).toFixed(4)}
        </p>
      )}

      {/* Campos ocultos para el FormData */}
      <input type="hidden" name="city" value={effectiveCity} />
      <input type="hidden" name="latitude" value={lat} />
      <input type="hidden" name="longitude" value={lng} />
    </div>
  );
}
