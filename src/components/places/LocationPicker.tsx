"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { SPANISH_PROVINCES } from "@/data/spanishLocations";
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
      const found = SPANISH_PROVINCES.find(
        (p) =>
          p.name.toLowerCase().includes(parsedInitial.city.toLowerCase()) ||
          p.municipalities.some((m) => m.toLowerCase().includes(parsedInitial.city.toLowerCase()))
      );
      if (found) return found.id;
    }
    return defaultProv.id;
  });

  const [selectedMunicipality, setSelectedMunicipality] = useState<string>(() => {
    if (parsedInitial.country === "España" && parsedInitial.city) {
      const prov = SPANISH_PROVINCES.find(
        (p) =>
          p.name.toLowerCase().includes(parsedInitial.city.toLowerCase()) ||
          p.municipalities.some((m) => m.toLowerCase().includes(parsedInitial.city.toLowerCase()))
      );
      if (prov) {
        const mun = prov.municipalities.find((m) =>
          m.toLowerCase().includes(parsedInitial.city.toLowerCase())
        );
        if (mun) return mun;
      }
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

  // Notificar al componente padre cuando cambie cualquier valor
  useEffect(() => {
    if (onLocationChange) {
      onLocationChange({
        city: effectiveCity,
        address,
        latitude: lat,
        longitude: lng,
      });
    }
  }, [effectiveCity, address, lat, lng, onLocationChange]);

  // Si cambian las props iniciales (ej. por autocompletado de URL de Maps)
  useEffect(() => {
    if (initialLat) setLat(initialLat);
    if (initialLng) setLng(initialLng);
    if (initialAddress) setAddress(initialAddress);

    if (initialCity) {
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
        const foundProv = SPANISH_PROVINCES.find((p) =>
          p.municipalities.some((m) => m.toLowerCase().includes(parsed.city.toLowerCase()))
        );
        if (foundProv) {
          setSelectedProvinceId(foundProv.id);
          const foundMun = foundProv.municipalities.find((m) =>
            m.toLowerCase().includes(parsed.city.toLowerCase())
          );
          if (foundMun) setSelectedMunicipality(foundMun);
        } else {
          // Si es Granada u otra ciudad no indexada directamente
          if (parsed.city.toLowerCase().includes("granada")) {
            setSelectedProvinceId("granada");
            setSelectedMunicipality("Granada");
          }
        }
      } else {
        setManualCity(parsed.city);
      }
    }
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
      if (result.province) {
        const provLower = result.province.toLowerCase();
        const matchedProv = SPANISH_PROVINCES.find(
          (p) =>
            provLower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(provLower)
        );
        if (matchedProv) {
          setSelectedProvinceId(matchedProv.id);
          const matchedMun = matchedProv.municipalities.find((m) =>
            (result.city || result.displayName).toLowerCase().includes(m.toLowerCase())
          );
          if (matchedMun) {
            setSelectedMunicipality(matchedMun);
          } else if (matchedProv.municipalities.length > 0) {
            setSelectedMunicipality(matchedProv.municipalities[0]);
          }
        }
      } else if (result.city) {
        const matchedMun = currentProvince.municipalities.find((m) =>
          result.city?.toLowerCase().includes(m.toLowerCase())
        );
        if (matchedMun) setSelectedMunicipality(matchedMun);
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

      {/* 4. Dirección / Calle / Zona */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
          {t("location.address_label")}
        </label>
        <input
          type="text"
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t("location.address_placeholder")}
          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {/* Coordenadas geolocalizadas */}
      {lat && lng && (
        <p className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono">
          <span>🌐</span>
          <span>
            {t("location.coords_label", {
              lat: parseFloat(lat).toFixed(4),
              lng: parseFloat(lng).toFixed(4),
            })}
          </span>
        </p>
      )}

      {/* Campos ocultos para el FormData del formulario */}
      <input type="hidden" name="city" value={effectiveCity} />
      <input type="hidden" name="latitude" value={lat} />
      <input type="hidden" name="longitude" value={lng} />
    </div>
  );
}
