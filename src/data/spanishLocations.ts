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
