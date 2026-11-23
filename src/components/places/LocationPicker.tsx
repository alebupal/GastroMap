"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { SPANISH_PROVINCES, findSpanishLocation } from "@/data/spanishLocations";
import { searchAddressAction } from "@/lib/actions/places";
import type { GeocodingResult } from "@/lib/geocoding";
import { useT } from "@/lib/i18n/client";
import { parseCityCountry, formatCityCountry, findCountry } from "@/lib/location";
import { CountrySelect } from "@/components/ui/CountrySelect";

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
  const { t } = useT();

  // Parsear ciudad y país iniciales
  const parsedInitial = useMemo(() => parseCityCountry(initialCity), [initialCity]);

  // País seleccionado (por defecto España si no se especifica otro)
  const [selectedCountry, setSelectedCountry] = useState<string>(
    parsedInitial.country || "España"
  );
  const [customCountry, setCustomCountry] = useState<string>("");

  // Estado selector de provincias y municipios de España
  // Por defecto Granada para la provincia y municipio inicial
  const defaultProv =
    SPANISH_PROVINCES.find((p) => p.id === "granada") || SPANISH_PROVINCES[0];

  const [selectedProvinceId, setSelectedProvinceId] = useState<string>(() => {
    if (parsedInitial.country === "España" && parsedInitial.city) {
      const match = findSpanishLocation(parsedInitial.city);
      if (match) return match.province.id;
    }
    return defaultProv.id;
  });

  const [selectedMunicipality, setSelectedMunicipality] = useState<string>(() => {
    if (parsedInitial.country === "España" && parsedInitial.city) {
      const match = findSpanishLocation(parsedInitial.city);
      if (match) return match.municipality;
    }
    return defaultProv.municipalities[0] || "Granada";
  });

  // Ciudad manual cuando el país NO es España
  const [manualCity, setManualCity] = useState<string>(() => {
    return parsedInitial.country !== "España" ? parsedInitial.city : "";
  });

  // Dirección y coordenadas
  const [address, setAddress] = useState<string>(initialAddress);
  const [lat, setLat] = useState<string>(initialLat);
  const [lng, setLng] = useState<string>(initialLng);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState<boolean>(false);
  const [geocodeMessage, setGeocodeMessage] = useState<{ type: "success" | "warning"; text: string } | null>(null);
  const [showManualCoords, setShowManualCoords] = useState<boolean>(false);

  // Buscador de direcciones en vivo (Nominatim)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentProvince =
    SPANISH_PROVINCES.find((p) => p.id === selectedProvinceId) || defaultProv;

  const isSpain = selectedCountry === "España";

  // Calcular la ciudad efectiva final
  const effectiveCity = useMemo(() => {
    if (isSpain) {
      return formatCityCountry(selectedMunicipality || "Granada", "España");
    }
    const countryName = selectedCountry === "Otro" ? customCountry.trim() : selectedCountry;
    return formatCityCountry(manualCity, countryName);
  }, [isSpain, selectedMunicipality, selectedCountry, customCountry, manualCity]);

  const onLocationChangeRef = useRef(onLocationChange);
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  // Guarda el último valor emitido al padre para evitar bucles ping-pong al rebotar props
  const lastEmittedRef = useRef<{
    city: string;
    address: string;
    latitude: string;
    longitude: string;
  } | null>(null);

  // Notificar al componente padre solo cuando cambien los valores efectivos
  useEffect(() => {
    const next = {
      city: effectiveCity,
      address,
      latitude: lat,
      longitude: lng,
    };
    const prev = lastEmittedRef.current;
    if (
      prev &&
      prev.city === next.city &&
      prev.address === next.address &&
      prev.latitude === next.latitude &&
      prev.longitude === next.longitude
    ) {
      return;
    }
    lastEmittedRef.current = next;
    onLocationChangeRef.current?.(next);
  }, [effectiveCity, address, lat, lng]);

  // Si cambian las props iniciales desde fuera (ej. por autocompletado de URL de Maps)
  useEffect(() => {
    const last = lastEmittedRef.current;
    const isExternalLat = Boolean(initialLat) && initialLat !== last?.latitude && initialLat !== lat;
    const isExternalLng = Boolean(initialLng) && initialLng !== last?.longitude && initialLng !== lng;
    const isExternalAddr =
      Boolean(initialAddress) && initialAddress !== last?.address && initialAddress !== address;
    const isExternalCity =
      Boolean(initialCity) && initialCity !== last?.city && initialCity !== effectiveCity;

    if (!isExternalLat && !isExternalLng && !isExternalAddr && !isExternalCity) {
      return;
    }

    if (isExternalLat) setLat(initialLat);
    if (isExternalLng) setLng(initialLng);
    if (isExternalAddr) setAddress(initialAddress);

    if (isExternalCity) {
      const parsed = parseCityCountry(initialCity);
      const matched = findCountry(parsed.country);
      if (matched) {
        setSelectedCountry(matched.name);
      } else if (parsed.country && parsed.country !== "España") {
        setSelectedCountry("Otro");
        setCustomCountry(parsed.country);
      } else {
        setSelectedCountry("España");
      }

      if (parsed.country === "España") {
        const match = findSpanishLocation(parsed.city);
        if (match) {
          setSelectedProvinceId(match.province.id);
          setSelectedMunicipality(match.municipality);
        }
      } else {
        setManualCity(parsed.city);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCity, initialAddress, initialLat, initialLng]);

  // Búsqueda en vivo con debounce
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

    const resultCountry = (result.country || "").trim();
    const isSpainResult =
      !resultCountry ||
      resultCountry.toLowerCase() === "españa" ||
      resultCountry.toLowerCase() === "spain";

    if (isSpainResult) {
      setSelectedCountry("España");
      const match =
        findSpanishLocation(result.city) ||
        findSpanishLocation(result.province) ||
        findSpanishLocation(result.road) ||
        findSpanishLocation(result.displayName);

      if (match) {
        setSelectedProvinceId(match.province.id);
        setSelectedMunicipality(match.municipality);
      }
    } else {
      // País internacional
      const matched = findCountry(resultCountry);
      if (matched) {
        setSelectedCountry(matched.name);
      } else {
        setSelectedCountry("Otro");
        setCustomCountry(resultCountry);
      }
      setManualCity(result.city || result.province || result.displayName.split(",")[0].trim());
    }

    setSearchQuery(result.displayName);
    setShowResults(false);
    setGeocodeMessage(null);
  }

  async function handleGeocodeAddress(addressToSearch?: string) {
    const target = (addressToSearch ?? address).trim();
    if (target.length < 2) return;
    setIsGeocodingAddress(true);
    setGeocodeMessage(null);
    try {
      const fullQuery = effectiveCity ? `${target}, ${effectiveCity}` : target;
      let results = await searchAddressAction(fullQuery);
      if (results.length === 0 && target !== fullQuery) {
        results = await searchAddressAction(target);
      }
      if (results.length > 0) {
        const top = results[0];
        const newLat = top.latitude.toString();
        const newLng = top.longitude.toString();
        setLat(newLat);
        setLng(newLng);
        setGeocodeMessage({
          type: "success",
          text: `${t("location.coords_found")}: ${top.latitude.toFixed(4)}, ${top.longitude.toFixed(4)}`,
        });
        setShowManualCoords(false);
      } else {
        setGeocodeMessage({
          type: "warning",
          text: t("location.coords_not_found"),
        });
        setShowManualCoords(true);
      }
    } catch {
      setGeocodeMessage({
        type: "warning",
        text: t("location.coords_not_found"),
      });
      setShowManualCoords(true);
    } finally {
      setIsGeocodingAddress(false);
    }
  }

  return (
    <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
      {/* 1. Buscador inteligente de direcciones con OpenStreetMap / Nominatim */}
      <div className="relative">
        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
          {t("location.search_label")}
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            placeholder={t("location.search_placeholder")}
            className="w-full px-3 py-2 pl-8 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <span className="absolute left-2.5 top-2.5 text-xs text-slate-400 pointer-events-none">
            📍
          </span>
          {isSearching && (
            <span className="absolute right-2.5 top-2.5 text-xs text-amber-500 animate-spin">
              ⏳
            </span>
          )}
        </div>

        {/* Lista desplegable de sugerencias */}
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

      {/* 2. Selector de País con buscador */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
          {t("location.country_label")}
        </label>
        <CountrySelect
          value={selectedCountry}
          onChange={(newCountry) => {
            setSelectedCountry(newCountry);
            if (newCountry === "España") {
              setSelectedProvinceId("granada");
              setSelectedMunicipality("Granada");
            }
          }}
        />
      </div>

      {/* 3. Selección de Ciudad según el País */}
      {isSpain ? (
        /* Caso España: Selección por Provincia y Municipio */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              {t("location.province_label")}
            </label>
            <select
              value={selectedProvinceId}
              onChange={(e) => {
                const newProvId = e.target.value;
                setSelectedProvinceId(newProvId);
                const prov = SPANISH_PROVINCES.find((p) => p.id === newProvId);
                if (prov && prov.municipalities.length > 0) {
                  setSelectedMunicipality(prov.municipalities[0]);
                }
              }}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
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
              {t("location.municipality_label")} ({currentProvince.municipalities.length})
            </label>
            <select
              value={selectedMunicipality}
              onChange={(e) => setSelectedMunicipality(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
            >
              {currentProvince.municipalities.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        /* Caso Internacional / Otro País: Campo manual de texto para ciudad o localidad */
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
            {t("location.city_label")}
          </label>
          <input
            type="text"
            value={manualCity}
            onChange={(e) => setManualCity(e.target.value)}
            placeholder={t("location.city_placeholder")}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
          />
        </div>
      )}

      {/* 4. Dirección / Calle / Zona con geocodificación automática */}
      <div className="space-y-1.5">
        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          {t("location.address_label")}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            name="address"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setGeocodeMessage(null);
            }}
            onBlur={() => {
              if (address.trim().length >= 3 && (!lat || !lng)) {
                handleGeocodeAddress();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleGeocodeAddress();
              }
            }}
            placeholder={t("location.address_placeholder")}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <button
            type="button"
            onClick={() => handleGeocodeAddress()}
            disabled={isGeocodingAddress || address.trim().length < 2}
            className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shrink-0 transition disabled:opacity-40 cursor-pointer"
            title={t("location.search_coords_btn")}
          >
            {isGeocodingAddress ? "⏳ " + t("location.searching_coords") : "🔍 " + t("location.search_coords_btn")}
          </button>
        </div>
      </div>

      {/* Mensaje de resultado de geocodificación */}
      {geocodeMessage && (
        <div
          className={`p-2.5 rounded-xl text-xs font-medium flex items-center justify-between ${
            geocodeMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40"
              : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40"
          }`}
        >
          <span>{geocodeMessage.text}</span>
          <button
            type="button"
            onClick={() => setGeocodeMessage(null)}
            className="text-xs opacity-60 hover:opacity-100 cursor-pointer ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Coordenadas obligatorias: visores y campos manuales */}
      {!lat || !lng || showManualCoords ? (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <span>📍</span>
              <span>{t("location.manual_coords_title")}</span>
            </span>
            {lat && lng && (
              <button
                type="button"
                onClick={() => setShowManualCoords(false)}
                className="text-[11px] text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
              >
                ✕ Ocultar
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                {t("location.lat_label")} *
              </label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="ej. 37.1773"
                required
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                {t("location.lng_label")} *
              </label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="ej. -3.5986"
                required
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
          {(!lat || !lng) && (
            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
              * {t("location.coords_required")}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5 font-mono">
            <span>🌐</span>
            <span>
              {t("location.coords_label", {
                lat: parseFloat(lat).toFixed(4),
                lng: parseFloat(lng).toFixed(4),
              })}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setShowManualCoords(true)}
            className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
          >
            ✏️ {t("location.edit_coords")}
          </button>
        </div>
      )}

      {/* Campos ocultos para el FormData del formulario */}
      <input type="hidden" name="city" value={effectiveCity} />
      <input type="hidden" name="latitude" value={lat} />
      <input type="hidden" name="longitude" value={lng} />
    </div>
  );
}
