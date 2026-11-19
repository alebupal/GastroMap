import allLocations from "./spanishProvincesMunicipalities.json";

export interface ProvinceData {
  id: string;
  name: string;
  municipalities: string[];
}

const rawLocations = allLocations as Record<string, string[]>;

export const SPANISH_PROVINCES: ProvinceData[] = Object.keys(rawLocations).map((provName) => {
  const muns = rawLocations[provName] || [];
  // Ponemos la capital o municipio homónimo en primer lugar si existe, y luego el resto ordenado
  const capitalIndex = muns.findIndex(
    (m) => m.toLowerCase() === provName.toLowerCase() || m.toLowerCase() === `${provName.toLowerCase()} (capital)`
  );

  let orderedMuns = [...muns];
  if (capitalIndex > 0) {
    const [capital] = orderedMuns.splice(capitalIndex, 1);
    orderedMuns.unshift(capital);
  }

  return {
    id: provName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-"),
    name: provName,
    municipalities: orderedMuns,
  };
});

// Opción especial al final para fuera de España
SPANISH_PROVINCES.push({
  id: "otra",
  name: "Otra provincia / Internacional",
  municipalities: ["Otra población"],
});

export function getMunicipalitiesByProvinceName(provinceName: string): string[] {
  const prov = SPANISH_PROVINCES.find(
    (p) => p.name.toLowerCase() === provinceName.toLowerCase()
  );
  return prov ? prov.municipalities : [];
}

/**
 * Busca de forma jerárquica y precisa la provincia y municipio español.
 * Prioriza:
 * 1. Coincidencia exacta con nombre o id de provincia (ej. "Granada" -> Provincia Granada, Municipio Granada).
 * 2. Coincidencia exacta con nombre de municipio (evita que "Granada" coincida con "Granada, La" de Barcelona).
 * 3. Coincidencia prefijo (startsWith).
 * 4. Coincidencia inclusiva (includes).
 */
export function findSpanishLocation(
  query?: string | null
): { province: ProvinceData; municipality: string } | null {
  if (!query) return null;
  const q = query.trim().toLowerCase();

  // 1. Coincidencia exacta con nombre o id de provincia
  const exactProv = SPANISH_PROVINCES.find(
    (p) => p.name.toLowerCase() === q || p.id === q
  );
  if (exactProv) {
    const mun =
      exactProv.municipalities.find((m) => m.toLowerCase() === q) ||
      exactProv.municipalities[0];
    return { province: exactProv, municipality: mun };
  }

  // 2. Coincidencia exacta con nombre de municipio
  for (const prov of SPANISH_PROVINCES) {
    const exactMun = prov.municipalities.find((m) => m.toLowerCase() === q);
    if (exactMun) {
      return { province: prov, municipality: exactMun };
    }
  }

  // 3. Coincidencia donde el nombre del municipio empieza por la búsqueda
  for (const prov of SPANISH_PROVINCES) {
    const startsMun = prov.municipalities.find((m) =>
      m.toLowerCase().startsWith(q)
    );
    if (startsMun) {
      return { province: prov, municipality: startsMun };
    }
  }

  // 4. Coincidencia inclusiva
  for (const prov of SPANISH_PROVINCES) {
    const incMun = prov.municipalities.find((m) => m.toLowerCase().includes(q));
    if (incMun) {
      return { province: prov, municipality: incMun };
    }
  }

  return null;
}
