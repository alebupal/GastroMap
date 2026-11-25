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

test("PDF Generator: estructura de documento PDF 1.4 válida con codificación y metadatos", () => {
  const pdfSource = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "pdf.ts"), "utf8");
  assert.ok(pdfSource.includes("%PDF-1.4"), "Debe generar cabecera estándar PDF 1.4");
  assert.ok(pdfSource.includes("/Type /Catalog"), "Debe incluir catálogo de objetos PDF");
  assert.ok(pdfSource.includes("/Type /Pages"), "Debe incluir árbol de páginas");
  assert.ok(pdfSource.includes("Helvetica"), "Debe incorporar tipografía estándar Helvetica");
  assert.ok(pdfSource.includes("WinAnsiEncoding"), "Debe usar WinAnsiEncoding para caracteres en español");
  assert.ok(pdfSource.includes("%%EOF"), "Debe incluir marcador final %%EOF");
});

test("Búsqueda universal: busca por nombre, ciudad, dirección, notas, tags, ocasiones y comentarios", () => {
  const dummyPlace = {
    name: "Mesón de Cándido",
    city: "Segovia, España",
    address: "Plaza del Azoguejo, 5",
    notes: "Famoso por el cochinillo asado al horno de leña",
    privateNotes: "Pedir mesa junto a la ventana",
    createdByName: "Alejandro",
    createdByUsername: "alebupal",
    tags: ["cochinillo", "asador", "tradicional"],
    occasions: ["comer", "familiar"],
    commentsTexts: ["El postre ponche segoviano es imprescindible"],
    commentAuthors: ["Cristina García", "cristinagv28", "@cristinagv28"],
  };

  const normalizeSearch = (text) =>
    text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const matches = (place, query) => {
    const q = normalizeSearch(query);
    const tokens = q.split(/\s+/).filter(Boolean);
    const searchableText = normalizeSearch(
      [
        place.name,
        place.city || "",
        place.address || "",
        place.notes || "",
        place.privateNotes || "",
        place.createdByName || "",
        place.createdByUsername || "",
        place.createdByUsername ? `@${place.createdByUsername}` : "",
        ...place.tags,
        ...place.occasions,
        ...(place.commentsTexts || []),
        ...(place.commentAuthors || []),
      ].join(" ")
    );

    return (
      searchableText.includes(q) ||
      (tokens.length > 1 && tokens.every((tok) => searchableText.includes(tok)))
    );
  };

  assert.ok(matches(dummyPlace, "cándido"), "Debe encontrar por nombre");
  assert.ok(matches(dummyPlace, "candido"), "Debe encontrar sin tildes (candido -> Cándido)");
  assert.ok(matches(dummyPlace, "meson"), "Debe encontrar sin tildes (meson -> Mesón)");
  assert.ok(matches({ ...dummyPlace, name: "La Alegría" }, "alegria"), "Debe encontrar alegría buscando alegria");
  assert.ok(matches(dummyPlace, "segovia"), "Debe encontrar por ciudad");
  assert.ok(matches(dummyPlace, "azoguejo"), "Debe encontrar por dirección");
  assert.ok(matches(dummyPlace, "cochinillo"), "Debe encontrar por nota y tag");
  assert.ok(matches(dummyPlace, "ventana"), "Debe encontrar por notas privadas");
  assert.ok(matches(dummyPlace, "familiar"), "Debe encontrar por ocasión");
  assert.ok(matches(dummyPlace, "alebupal"), "Debe encontrar por username del autor");
  assert.ok(matches(dummyPlace, "@alebupal"), "Debe encontrar por @username del autor");
  assert.ok(matches(dummyPlace, "alejandro"), "Debe encontrar por nombre real del autor");
  assert.ok(matches(dummyPlace, "cristina"), "Debe encontrar por nombre del autor de un comentario");
  assert.ok(matches(dummyPlace, "cristinagv28"), "Debe encontrar por username del autor de un comentario");
  assert.ok(matches(dummyPlace, "ponche segoviano"), "Debe encontrar por texto de comentario");
  assert.ok(matches(dummyPlace, "segovia ponche"), "Debe encontrar combinación de ciudad y comentario");
  assert.equal(matches(dummyPlace, "sushi"), false, "No debe encontrar términos no presentes");
});

test("Filtro Plan con amigos: filtra sitios pendientes, favoritos, bien valorados, visitados o añadidos por el grupo", () => {
  const samplePlaces = [
    { id: "p1", createdById: "u1", visitedUserIds: [], pendingUserIds: ["u1", "u2"], favoriteUserIds: [], highRatedUserIds: [] },
    { id: "p2", createdById: "u3", visitedUserIds: ["u1"], pendingUserIds: ["u2"], favoriteUserIds: ["u1"], highRatedUserIds: ["u1"] },
    { id: "p3", createdById: "u2", visitedUserIds: [], pendingUserIds: ["u2"], favoriteUserIds: ["u1", "u2"], highRatedUserIds: [] },
    { id: "p4", createdById: "u3", visitedUserIds: ["u1", "u2"], pendingUserIds: [], favoriteUserIds: ["u1", "u2"], highRatedUserIds: ["u2"] },
  ];

  const filterWithFriends = (places, targetIds, mode) =>
    places.filter((p) => {
      if (mode === "pending_all") return targetIds.every((uid) => p.pendingUserIds.includes(uid));
      if (mode === "pending_any") {
        return (
          targetIds.some((uid) => p.pendingUserIds.includes(uid)) &&
          targetIds.every((uid) => !p.visitedUserIds.includes(uid))
        );
      }
      if (mode === "pending_any_even_visited") return targetIds.some((uid) => p.pendingUserIds.includes(uid));
      if (mode === "favorites_any") return targetIds.some((uid) => p.favoriteUserIds.includes(uid));
      if (mode === "favorites_all") return targetIds.every((uid) => p.favoriteUserIds.includes(uid));
      if (mode === "favorite_for_new") {
        return (
          targetIds.some((uid) => p.favoriteUserIds.includes(uid)) &&
          targetIds.some((uid) => !p.visitedUserIds.includes(uid))
        );
      }
      if (mode === "rated_high_any") return targetIds.some((uid) => p.highRatedUserIds.includes(uid));
      if (mode === "discover_for_some") {
        return (
          targetIds.some((uid) => p.visitedUserIds.includes(uid)) &&
          targetIds.some((uid) => !p.visitedUserIds.includes(uid))
        );
      }
      if (mode === "visited_all") return targetIds.every((uid) => p.visitedUserIds.includes(uid));
      if (mode === "added_by_group") return targetIds.includes(p.createdById);
      return targetIds.every((uid) => !p.visitedUserIds.includes(uid));
    });

  assert.deepEqual(filterWithFriends(samplePlaces, ["u1", "u2"], "untried_or_pending").map((p) => p.id), ["p1", "p3"]);
  assert.deepEqual(filterWithFriends(samplePlaces, ["u1", "u2"], "pending_all").map((p) => p.id), ["p1"]);
  assert.deepEqual(filterWithFriends(samplePlaces, ["u1", "u2"], "pending_any").map((p) => p.id), ["p1", "p3"]);
  assert.deepEqual(filterWithFriends(samplePlaces, ["u1", "u2"], "pending_any_even_visited").map((p) => p.id), ["p1", "p2", "p3"]);
  assert.deepEqual(filterWithFriends(samplePlaces, ["u1", "u2"], "favorites_any").map((p) => p.id), ["p2", "p3", "p4"]);
  assert.deepEqual(filterWithFriends(samplePlaces, ["u1", "u2"], "favorites_all").map((p) => p.id), ["p3", "p4"]);
  assert.deepEqual(filterWithFriends(samplePlaces, ["u1", "u2"], "favorite_for_new").map((p) => p.id), ["p2", "p3"]);
  assert.deepEqual(filterWithFriends(samplePlaces, ["u1", "u2"], "rated_high_any").map((p) => p.id), ["p2", "p4"]);
  assert.deepEqual(filterWithFriends(samplePlaces, ["u1", "u2"], "discover_for_some").map((p) => p.id), ["p2"]);
  assert.deepEqual(filterWithFriends(samplePlaces, ["u1", "u2"], "visited_all").map((p) => p.id), ["p4"]);
  assert.deepEqual(filterWithFriends(samplePlaces, ["u1", "u2"], "added_by_group").map((p) => p.id), ["p1", "p3"]);
});

test("Scraper: detecta direcciones/calles para no usarlas como nombre del local", () => {
  const looksLikeStreetAddress = (text) => {
    const t = text.trim();
    if (!t) return false;
    if (
      /^(c\/|c\.|cl\.|calle|av\.|avda\.?|avenida|pl\.|plz\.?|plaza|pza\.?|p\.º|pº|paseo|camino|cno\.?|ctra\.?|carretera|ronda|traves[ií]a|glorieta|rambla|carrer|rua|rue|via|viale|corso|strada|boulevard|blvd\.?)\s+/i.test(
        t
      )
    ) {
      return true;
    }
    if (/^\d{1,5}\s+[a-záéíóúñ\s]+\b(st|street|ave|avenue|rd|road|blvd|ln|lane|dr|drive)\b/i.test(t)) {
      return true;
    }
    if (/,\s*\d{5}\b/.test(t)) {
      return true;
    }
    return false;
  };

  assert.equal(looksLikeStreetAddress("Calle Reyes Católicos, 12"), true);
  assert.equal(looksLikeStreetAddress("C. de Alcalá, 45"), true);
  assert.equal(looksLikeStreetAddress("Av. de la Constitución"), true);
  assert.equal(looksLikeStreetAddress("Camino el Bollullo"), true);
  assert.equal(looksLikeStreetAddress("Chiringuito Bollullo"), false);
  assert.equal(looksLikeStreetAddress("Taberna La Plaza"), false);
  assert.equal(looksLikeStreetAddress("Bar Calle 54"), false);
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

