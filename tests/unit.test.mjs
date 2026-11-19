import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "..", "src", "locales");

test("i18n: es.json y en.json existen y son JSON válidos", () => {
  const esRaw = fs.readFileSync(path.join(localesDir, "es.json"), "utf8");
  const enRaw = fs.readFileSync(path.join(localesDir, "en.json"), "utf8");

  const es = JSON.parse(esRaw);
  const en = JSON.parse(enRaw);

  assert.ok(es && typeof es === "object");
  assert.ok(en && typeof en === "object");
  assert.equal(es.app?.title, "GastroMap");
  assert.equal(en.app?.title, "GastroMap");
});

test("i18n: todas las secciones requeridas están presentes en ambos idiomas", () => {
  const es = JSON.parse(fs.readFileSync(path.join(localesDir, "es.json"), "utf8"));
  const en = JSON.parse(fs.readFileSync(path.join(localesDir, "en.json"), "utf8"));

  const requiredSections = ["app", "nav", "places", "groups", "common"];
  for (const sec of requiredSections) {
    assert.ok(es[sec], `Falta sección '${sec}' en es.json`);
    assert.ok(en[sec], `Falta sección '${sec}' en en.json`);
    const esKeys = Object.keys(es[sec]);
    const enKeys = Object.keys(en[sec]);
    assert.deepEqual(
      esKeys.sort(),
      enKeys.sort(),
      `Las claves de la sección '${sec}' difieren entre es y en`
    );
  }
});

test("Distancia Haversine: cálculo de distancia entre dos coordenadas conocidas", () => {
  // Madrid (Sol): 40.4168, -3.7038 -> Barcelona (Plaza Cataluña): 41.3870, 2.1700
  // Distancia conocida aproximada en línea recta: ~505 km
  const R = 6371e3;
  const lat1 = 40.4168;
  const lon1 = -3.7038;
  const lat2 = 41.3870;
  const lon2 = 2.1700;

  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const meters = Math.round(R * c);

  assert.ok(meters > 500000 && meters < 510000, `Distancia calculada: ${meters}m`);
});

test("Seguridad y URL: validación de coordenadas geográficas en rango", () => {
  const isValidCoord = (lat, lng) =>
    typeof lat === "number" &&
    typeof lng === "number" &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  assert.equal(isValidCoord(40.4168, -3.7038), true);
  assert.equal(isValidCoord(-33.8688, 151.2093), true);
  assert.equal(isValidCoord(95.0, 0), false);
  assert.equal(isValidCoord(0, 190.0), false);
  assert.equal(isValidCoord(NaN, 0), false);
});

test("GPX Generator: formato XML válido generado para exportación", () => {
  const places = [
    {
      name: "Restaurante El Gourmet",
      latitude: 40.4168,
      longitude: -3.7038,
      notes: "Excelente paella",
    },
  ];

  const escapeXml = (unsafe) =>
    (unsafe || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GastroMap">\n`;
  for (const p of places) {
    gpx += `  <wpt lat="${p.latitude}" lon="${p.longitude}">\n`;
    gpx += `    <name>${escapeXml(p.name)}</name>\n`;
    gpx += `    <desc>${escapeXml(p.notes)}</desc>\n`;
    gpx += `  </wpt>\n`;
  }
  gpx += `</gpx>`;

  assert.ok(gpx.includes("<gpx"));
  assert.ok(gpx.includes('lat="40.4168"'));
  assert.ok(gpx.includes("<name>Restaurante El Gourmet</name>"));
  assert.ok(gpx.includes("</gpx>"));
});

test("Ubicación: Granada se resuelve en la provincia de Granada y no en Barcelona", () => {
  const allLocations = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "src", "data", "spanishProvincesMunicipalities.json"), "utf8")
  );

  const rawLocations = allLocations;
  const SPANISH_PROVINCES = Object.keys(rawLocations).map((provName) => {
    const muns = rawLocations[provName] || [];
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

  function findSpanishLocation(query) {
    if (!query) return null;
    const q = query.trim().toLowerCase();

    const exactProv = SPANISH_PROVINCES.find(
      (p) => p.name.toLowerCase() === q || p.id === q
    );
    if (exactProv) {
      const mun =
        exactProv.municipalities.find((m) => m.toLowerCase() === q) ||
        exactProv.municipalities[0];
      return { province: exactProv, municipality: mun };
    }

    for (const prov of SPANISH_PROVINCES) {
      const exactMun = prov.municipalities.find((m) => m.toLowerCase() === q);
      if (exactMun) {
        return { province: prov, municipality: exactMun };
      }
    }

    return null;
  }

  const resultGranada = findSpanishLocation("Granada");
  assert.equal(resultGranada?.province.name, "Granada");
  assert.equal(resultGranada?.municipality, "Granada");

  const resultBarcelona = findSpanishLocation("Barcelona");
  assert.equal(resultBarcelona?.province.name, "Barcelona");
  assert.equal(resultBarcelona?.municipality, "Barcelona");
});

test("Documentación: los 6 archivos oficiales existen y tienen contenido válido", () => {
  const root = path.join(__dirname, "..");
  const docs = [
    "DOCUMENTACION.MD",
    "DOCUMENTATION.MD",
    "CHANGELOG_ES.MD",
    "CHANGELOG.MD",
    "README_ES.MD",
    "README.MD",
  ];

  for (const doc of docs) {
    const full = path.join(root, doc);
    assert.ok(fs.existsSync(full), `Falta el archivo de documentación ${doc}`);
    const stat = fs.statSync(full);
    assert.ok(stat.size > 500, `${doc} está vacío o es demasiado corto (${stat.size} bytes)`);
  }
});

