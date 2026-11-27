"use client";

import { useState } from "react";
import type { PlaceWithDetails } from "@/lib/actions/places";
import { importPlacesAction, type ImportPlacePayload } from "@/lib/actions/export-import";
import { generatePlacesPdf } from "@/lib/pdf";
import { useT } from "@/lib/i18n/client";
import { useSwipeToClose, SheetHandle } from "@/components/ui/BottomSheet";

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  places: PlaceWithDetails[];
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeXml(val: string): string {
  return val
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseUploadedFile(text: string, filename: string): ImportPlacePayload[] {
  const lower = filename.toLowerCase();

  // 1. JSON / GeoJSON / Google Takeout Saved Places
  if (lower.endsWith(".json") || lower.endsWith(".geojson")) {
    const parsed = JSON.parse(text);

    // GeoJSON FeatureCollection (incl. Google Takeout Saved Places.json)
    if (parsed && parsed.type === "FeatureCollection" && Array.isArray(parsed.features)) {
      const items: ImportPlacePayload[] = [];
      for (const feat of parsed.features) {
        const props = feat.properties || {};
        const loc = props.Location || props.location || {};
        const coords =
          feat.geometry?.type === "Point" && Array.isArray(feat.geometry.coordinates)
            ? feat.geometry.coordinates
            : null;
        const name = props.Title || props.name || loc["Business Name"] || props.title || "";
        if (!name) continue;
        const lng = coords ? Number(coords[0]) : loc["Geo Coordinates"]?.Longitude ? Number(loc["Geo Coordinates"].Longitude) : null;
        const lat = coords ? Number(coords[1]) : loc["Geo Coordinates"]?.Latitude ? Number(loc["Geo Coordinates"].Latitude) : null;

        items.push({
          name: String(name),
          address: props.address || loc.Address || null,
          city: props.city || null,
          latitude: lat && !isNaN(lat) ? lat : null,
          longitude: lng && !isNaN(lng) ? lng : null,
          googleMapsUrl: props["Google Maps URL"] || props.googleMapsUrl || null,
          priceRange: props.priceRange || "???",
          notes: props.Comment || props.notes || null,
          occasions: Array.isArray(props.occasions) ? props.occasions : [],
          tags: Array.isArray(props.tags) ? props.tags : [],
        });
      }
      return items;
    }

    // Array directo (exportación GastroMap JSON)
    const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.places) ? parsed.places : [];
    return arr
      .filter((item: Record<string, unknown>) => typeof item?.name === "string" && item.name.trim().length > 1)
      .map((item: Record<string, unknown>) => ({
        name: String(item.name),
        city: item.city ? String(item.city) : null,
        address: item.address ? String(item.address) : null,
        latitude: typeof item.latitude === "number" ? item.latitude : null,
        longitude: typeof item.longitude === "number" ? item.longitude : null,
        priceRange: typeof item.priceRange === "string" ? item.priceRange : "???",
        googleMapsUrl: item.googleMapsUrl ? String(item.googleMapsUrl) : null,
        website: item.website ? String(item.website) : null,
        phone: item.phone ? String(item.phone) : null,
        notes: item.notes ? String(item.notes) : null,
        comments: Array.isArray(item.comments)
          ? item.comments.map(String)
          : item.comment
          ? [String(item.comment)]
          : undefined,
        occasions: Array.isArray(item.occasions) ? item.occasions.map(String) : [],
        tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
        personalStatus:
          item.personalStatus === "visited" || item.personalStatus === "pending"
            ? item.personalStatus
            : null,
      }));
  }

  // 1b. KML (Google My Maps / Earth) y GPX (waypoints)
  if (lower.endsWith(".kml") || lower.endsWith(".gpx")) {
    const doc = new DOMParser().parseFromString(text, "text/xml");
    const items: ImportPlacePayload[] = [];
    const txt = (el: Element | null, tag: string) =>
      el?.getElementsByTagName(tag)[0]?.textContent?.trim() || null;

    if (lower.endsWith(".kml")) {
      for (const pm of Array.from(doc.getElementsByTagName("Placemark"))) {
        const name = txt(pm, "name");
        const coords = txt(pm, "coordinates");
        if (!name || !coords) continue;
        const [lng, lat] = coords.split(/[,\s]+/).map(Number);
        items.push({
          name,
          notes: txt(pm, "description"),
          latitude: !isNaN(lat) ? lat : null,
          longitude: !isNaN(lng) ? lng : null,
          priceRange: "???",
          occasions: [],
          tags: [],
        });
      }
    } else {
      for (const w of Array.from(doc.getElementsByTagName("wpt"))) {
        const name = txt(w, "name");
        if (!name) continue;
        const lat = parseFloat(w.getAttribute("lat") || "");
        const lng = parseFloat(w.getAttribute("lon") || "");
        items.push({
          name,
          notes: txt(w, "desc") || txt(w, "cmt"),
          latitude: !isNaN(lat) ? lat : null,
          longitude: !isNaN(lng) ? lng : null,
          priceRange: "???",
          occasions: [],
          tags: [],
        });
      }
    }
    return items;
  }

  // 2. CSV (incluye Google Takeout Saved Places en ES/EN con BOM y tildes)
  if (lower.endsWith(".csv")) {
    const cleanText = text.replace(/^\uFEFF/, "");
    const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const normalizeHeader = (h: string) =>
      h
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const headers = parseCsvLine(lines[0]).map(normalizeHeader);
    const idx = (names: string[]) => headers.findIndex((h) => names.includes(h));

    const nameIdx = idx(["name", "nombre", "title", "titulo"]);
    if (nameIdx === -1) return [];
    const cityIdx = idx(["city", "ciudad", "municipio"]);
    const addrIdx = idx(["address", "direccion"]);
    const latIdx = idx(["latitude", "lat", "latitud"]);
    const lngIdx = idx(["longitude", "lng", "lon", "longitud"]);
    const priceIdx = idx(["pricerange", "price", "precio"]);
    const mapsIdx = idx(["googlemapsurl", "url", "maps", "google_maps_url"]);
    const notesIdx = idx(["notes", "notas", "note", "nota", "comment", "comentario"]);
    const commentIdx = idx(["comment", "comentario"]);
    const tagsIdx = idx(["tags", "etiquetas"]);

    const items: ImportPlacePayload[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const name = cols[nameIdx]?.trim();
      if (!name || name.length < 2) continue;

      const lat = latIdx >= 0 && cols[latIdx] ? parseFloat(cols[latIdx]) : null;
      const lng = lngIdx >= 0 && cols[lngIdx] ? parseFloat(cols[lngIdx]) : null;
      const rawNote = notesIdx >= 0 ? cols[notesIdx]?.trim() || "" : "";
      const rawComment =
        commentIdx >= 0 && commentIdx !== notesIdx ? cols[commentIdx]?.trim() || "" : "";
      const combinedNotes = [rawNote, rawComment].filter(Boolean).join(" — ") || null;

      items.push({
        name,
        city: cityIdx >= 0 ? cols[cityIdx] || null : null,
        address: addrIdx >= 0 ? cols[addrIdx] || null : null,
        latitude: lat !== null && !isNaN(lat) ? lat : null,
        longitude: lng !== null && !isNaN(lng) ? lng : null,
        priceRange: priceIdx >= 0 && cols[priceIdx] ? cols[priceIdx] : "???",
        googleMapsUrl: mapsIdx >= 0 ? cols[mapsIdx] || null : null,
        notes: combinedNotes,
        tags:
          tagsIdx >= 0 && cols[tagsIdx]
            ? cols[tagsIdx].split(/[;|,]/).map((t) => t.trim()).filter(Boolean)
            : [],
      });
    }
    return items;
  }

  return [];
}

const SAMPLE_TEMPLATES = {
  json: {
    filename: "plantilla-gastromap.json",
    mime: "application/json",
    content: JSON.stringify(
      [
        {
          name: "Bar El Tapeo Granadino",
          city: "Granada",
          address: "Calle Navas, 14",
          latitude: 37.1742,
          longitude: -3.5986,
          priceRange: "€",
          googleMapsUrl: "https://maps.google.com/?q=37.1742,-3.5986",
          website: "https://eltapeo.ejemplo.es",
          phone: "+34 958 123 456",
          notes: "Tapa gratis abundante con cada consumición. Especialidad en berenjenas con miel de caña.",
          comments: ["Pedir la tapa de cazón en adobo, brutal."],
          occasions: ["tapear", "casual"],
          tags: ["tapas", "andalucia", "terracita"],
          personalStatus: "visited",
        },
        {
          name: "Trattoria Romana",
          city: "Madrid",
          address: "Calle Mayor, 42",
          latitude: 40.4168,
          longitude: -3.7038,
          priceRange: "€€",
          googleMapsUrl: "https://maps.google.com/?q=40.4168,-3.7038",
          website: "https://trattoriaromana.ejemplo.es",
          phone: "+34 912 345 678",
          notes: "Pasta fresca artesanal. La auténtica carbonara romana con guanciale y pecorino.",
          occasions: ["comer", "cita"],
          tags: ["pasta", "italiano", "carbonara"],
          personalStatus: "pending",
        },
      ],
      null,
      2
    ),
  },
  csv: {
    filename: "plantilla-gastromap.csv",
    mime: "text/csv;charset=utf-8",
    content: `name,city,address,latitude,longitude,priceRange,googleMapsUrl,notes,tags\nBar El Tapeo Granadino,Granada,"Calle Navas, 14",37.1742,-3.5986,€,https://maps.google.com/?q=37.1742,-3.5986,"Tapa gratis abundante con cada consumición. Especialidad berenjenas con miel.",tapas;andalucia;terracita\nTrattoria Romana,Madrid,"Calle Mayor, 42",40.4168,-3.7038,€€,https://maps.google.com/?q=40.4168,-3.7038,"Pasta fresca al momento. La auténtica carbonara romana con guanciale.",pasta;italiano;carbonara\n`,
  },
  geojson: {
    filename: "plantilla-gastromap.geojson",
    mime: "application/geo+json",
    content: JSON.stringify(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [-3.5986, 37.1742],
            },
            properties: {
              name: "Bar El Tapeo Granadino",
              city: "Granada",
              address: "Calle Navas, 14",
              priceRange: "€",
              notes: "Tapa gratis abundante con cada consumición. Especialidad en berenjenas con miel de caña.",
              occasions: ["tapear", "casual"],
              tags: ["tapas", "andalucia"],
              googleMapsUrl: "https://maps.google.com/?q=37.1742,-3.5986",
            },
          },
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [-3.7038, 40.4168],
            },
            properties: {
              name: "Trattoria Romana",
              city: "Madrid",
              address: "Calle Mayor, 42",
              priceRange: "€€",
              notes: "Pasta fresca artesanal. Auténtica carbonara romana.",
              occasions: ["comer", "cita"],
              tags: ["pasta", "italiano"],
              googleMapsUrl: "https://maps.google.com/?q=40.4168,-3.7038",
            },
          },
        ],
      },
      null,
      2
    ),
  },
  kml: {
    filename: "plantilla-gastromap.kml",
    mime: "application/vnd.google-earth.kml+xml",
    content: `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Plantilla GastroMap KML</name>
    <description>Ejemplo de importación compatible con Google My Maps y Google Earth</description>
    <Placemark>
      <name>Bar El Tapeo Granadino</name>
      <description>Tapa gratis abundante con cada consumición. Especialidad berenjenas con miel de caña.</description>
      <Point>
        <coordinates>-3.5986,37.1742,0</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>Trattoria Romana</name>
      <description>Pasta fresca italiana artesanal. Auténtica carbonara romana.</description>
      <Point>
        <coordinates>-3.7038,40.4168,0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`,
  },
  gpx: {
    filename: "plantilla-gastromap.gpx",
    mime: "application/gpx+xml",
    content: `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GastroMap" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Plantilla GastroMap GPX</name>
    <desc>Ejemplo de waypoints para importar en GastroMap</desc>
  </metadata>
  <wpt lat="37.1742" lon="-3.5986">
    <name>Bar El Tapeo Granadino</name>
    <desc>Tapa gratis abundante con cada consumición. Especialidad en berenjenas con miel.</desc>
  </wpt>
  <wpt lat="40.4168" lon="-3.7038">
    <name>Trattoria Romana</name>
    <desc>Pasta fresca artesanal y carbonara tradicional.</desc>
  </wpt>
</gpx>`,
  },
};

export function ExportImportModal({ isOpen, onClose, places }: ExportImportModalProps) {
  const { t } = useT();
  const sheet = useSwipeToClose(onClose);
  const [tab, setTab] = useState<"export" | "import">("export");
  const [previewItems, setPreviewItems] = useState<ImportPlacePayload[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importPublic, setImportPublic] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const dateStamp = new Date().toISOString().slice(0, 10);

  function handleExportJson() {
    const data = places.map((p) => ({
      name: p.name,
      city: p.city,
      address: p.address,
      latitude: p.latitude,
      longitude: p.longitude,
      priceRange: p.priceRange,
      googleMapsUrl: p.googleMapsUrl,
      notes: p.notes,
      occasions: p.occasions,
      tags: p.tags,
    }));
    downloadFile(JSON.stringify(data, null, 2), `gastromap-${dateStamp}.json`, "application/json");
  }

  function handleExportPdf() {
    const pdfBytes = generatePlacesPdf(places);
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gastromap-${dateStamp}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleExportCsv() {
    const header = "name,city,address,latitude,longitude,priceRange,googleMapsUrl,notes,tags";
    const rows = places.map((p) =>
      [
        escapeCsv(p.name),
        escapeCsv(p.city),
        escapeCsv(p.address),
        escapeCsv(p.latitude),
        escapeCsv(p.longitude),
        escapeCsv(p.priceRange),
        escapeCsv(p.googleMapsUrl),
        escapeCsv(p.notes),
        escapeCsv(p.tags.join(";")),
      ].join(",")
    );
    downloadFile([header, ...rows].join("\n"), `gastromap-${dateStamp}.csv`, "text/csv;charset=utf-8");
  }

  function handleExportGeoJson() {
    const fc = {
      type: "FeatureCollection",
      features: places
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [p.longitude, p.latitude],
          },
          properties: {
            name: p.name,
            city: p.city,
            address: p.address,
            priceRange: p.priceRange,
            googleMapsUrl: p.googleMapsUrl,
            notes: p.notes,
            occasions: p.occasions,
            tags: p.tags,
          },
        })),
    };
    downloadFile(
      JSON.stringify(fc, null, 2),
      `gastromap-${dateStamp}.geojson`,
      "application/geo+json"
    );
  }

  function handleExportKml() {
    const placemarks = places
      .filter((p) => p.latitude != null && p.longitude != null)
      .map(
        (p) => `    <Placemark>
      <name>${escapeXml(p.name)}</name>
      <description>${escapeXml(
          [p.city, p.address, p.priceRange, p.notes].filter(Boolean).join(" • ")
        )}</description>
      <Point>
        <coordinates>${p.longitude},${p.latitude},0</coordinates>
      </Point>
    </Placemark>`
      )
      .join("\n");

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>GastroMap (${dateStamp})</name>
${placemarks}
  </Document>
</kml>`;

    downloadFile(
      kml,
      `gastromap-${dateStamp}.kml`,
      "application/vnd.google-earth.kml+xml"
    );
  }

  function handleExportGpx() {
    const wpts = places
      .filter((p) => p.latitude != null && p.longitude != null)
      .map(
        (p) => `  <wpt lat="${p.latitude}" lon="${p.longitude}">
    <name>${escapeXml(p.name)}</name>
    <desc>${escapeXml([p.city, p.address, p.priceRange, p.notes].filter(Boolean).join(" • "))}</desc>
  </wpt>`
      )
      .join("\n");
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GastroMap" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>GastroMap (${dateStamp})</name></metadata>
${wpts}
</gpx>`;
    downloadFile(gpx, `gastromap-${dateStamp}.gpx`, "application/gpx+xml");
  }

  function handleDownloadSample(format: keyof typeof SAMPLE_TEMPLATES) {
    const sample = SAMPLE_TEMPLATES[format];
    if (sample) {
      downloadFile(sample.content, sample.filename, sample.mime);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseUploadedFile(text, file.name);
      if (parsed.length === 0) {
        setPreviewItems([]);
        setMessage({
          type: "error",
          text: t("export_import.error_invalid_file"),
        });
      } else {
        setPreviewItems(parsed);
      }
    } catch {
      setPreviewItems([]);
      setMessage({
        type: "error",
        text: t("export_import.error_read"),
      });
    }
  }

  async function handleConfirmImport() {
    if (previewItems.length === 0 || importing) return;
    setImporting(true);
    setMessage(null);
    const res = await importPlacesAction(previewItems, importPublic);
    setImporting(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error });
    } else {
      setMessage({
        type: "success",
        text: t("export_import.success_msg", { count: String(res.importedCount) }),
      });
      setPreviewItems([]);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    }
  }

  return (
    <div
      style={sheet.backdropStyle}
      className="fixed inset-0 !mt-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm gm-backdrop-in text-left"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheet.sheetRef}
        style={sheet.sheetStyle}
        {...sheet.sheetHandlers}
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[95dvh] sm:max-h-[92dvh] overflow-hidden gm-modal-in"
      >
        <SheetHandle {...sheet.handleHandlers} />
        {/* Cabecera estilo DESIGN.md */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/60 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">swap_vert</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100 tracking-tight">
                {t("export_import.title")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("export_import.subtitle")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#f2f3ff] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label={t("common.close")}
          >
            <span className="material-symbols-outlined text-lg leading-none">close</span>
          </button>
        </div>

        {/* Pestañas segmentadas estilo DESIGN.md con píldora deslizante */}
        <div className="px-5 sm:px-6 pt-3.5 shrink-0">
          <div className="relative grid grid-cols-2 p-1 rounded-full bg-[#f2f3ff] dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-orange-600 shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                tab === "import" ? "translate-x-full" : "translate-x-0"
              }`}
            />
            <button
              type="button"
              onClick={() => setTab("export")}
              className={`relative z-10 py-2 px-2 rounded-full text-[11px] sm:text-xs font-bold transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                tab === "export"
                  ? "text-white"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-base leading-none shrink-0">download</span>
              <span className="truncate">
                {t("export_import.tab_export")} ({places.length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab("import")}
              className={`relative z-10 py-2 px-2 rounded-full text-[11px] sm:text-xs font-bold transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                tab === "import"
                  ? "text-white"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-base leading-none shrink-0">upload</span>
              <span className="truncate">{t("export_import.tab_import")}</span>
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {message && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                message.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50"
              }`}
            >
              <span className="material-symbols-outlined text-base shrink-0">
                {message.type === "success" ? "check_circle" : "error"}
              </span>
              <span>{message.text}</span>
            </div>
          )}

          {tab === "export" ? (
            <div className="space-y-3.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("export_import.export_desc")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    id: "json",
                    title: "JSON",
                    desc: t("export_import.json_desc"),
                    icon: "data_object",
                    onClick: handleExportJson,
                  },
                  {
                    id: "pdf",
                    title: "PDF",
                    desc: t("export_import.pdf_desc"),
                    icon: "picture_as_pdf",
                    onClick: handleExportPdf,
                  },
                  {
                    id: "csv",
                    title: "CSV",
                    desc: t("export_import.csv_desc"),
                    icon: "table_view",
                    onClick: handleExportCsv,
                  },
                  {
                    id: "geojson",
                    title: "GeoJSON",
                    desc: t("export_import.geojson_desc"),
                    icon: "public",
                    onClick: handleExportGeoJson,
                  },
                  {
                    id: "kml",
                    title: "KML",
                    desc: t("export_import.kml_desc"),
                    icon: "map",
                    onClick: handleExportKml,
                  },
                  {
                    id: "gpx",
                    title: "GPX",
                    desc: t("export_import.gpx_desc"),
                    icon: "explore",
                    onClick: handleExportGpx,
                  },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={fmt.onClick}
                    disabled={places.length === 0}
                    className="group p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-[#f8f9ff] dark:bg-slate-800/50 hover:border-orange-500 hover:bg-orange-50/40 dark:hover:bg-orange-950/20 transition text-left cursor-pointer disabled:opacity-40 flex items-start gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition">
                      <span className="material-symbols-outlined text-lg leading-none">
                        {fmt.icon}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        {fmt.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {fmt.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("export_import.import_desc")}
              </p>

              <label className="group block p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-orange-500 text-center cursor-pointer transition bg-[#f8f9ff] dark:bg-slate-800/40 hover:bg-orange-50/40 dark:hover:bg-orange-950/20">
                <div className="w-12 h-12 mx-auto mb-2.5 rounded-2xl bg-orange-100/90 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-2xl">upload_file</span>
                </div>
                <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 break-all line-clamp-2">
                  {fileName || t("export_import.select_file")}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  JSON, GeoJSON, CSV, KML o GPX
                </div>
                <input
                  type="file"
                  accept=".json,.geojson,.csv,.kml,.gpx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>

              {/* Plantillas de ejemplo descargables */}
              <div className="p-4 rounded-2xl bg-[#f2f3ff] dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200 flex-wrap gap-1">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-orange-600 leading-none">
                      description
                    </span>
                    <span>{t("export_import.sample_files_title")}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {t("export_import.sample_files_hint")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {(["json", "csv", "geojson", "kml", "gpx"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => handleDownloadSample(fmt)}
                      className="inline-flex items-center gap-1 py-1.5 px-3 rounded-full text-xs font-bold border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-orange-600 hover:text-white hover:border-orange-600 text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-2xs"
                      title={t("export_import.sample_download", { type: fmt.toUpperCase() })}
                    >
                      <span className="material-symbols-outlined text-sm leading-none">
                        download
                      </span>
                      <span>{fmt.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>

              {previewItems.length > 0 && (
                <div className="space-y-3 pt-1">
                  <div className="p-3.5 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200/80 dark:border-orange-900/50 text-xs text-orange-900 dark:text-orange-200 font-medium">
                    {t("export_import.detected", { count: String(previewItems.length) })} (ej.{" "}
                    <strong>
                      {previewItems
                        .slice(0, 3)
                        .map((i) => i.name)
                        .join(", ")}
                    </strong>
                    {previewItems.length > 3 ? "..." : ""}).
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setImportPublic(true)}
                      className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        importPublic
                          ? "bg-orange-500/15 border-orange-600 text-orange-700 dark:text-orange-300"
                          : "bg-[#f8f9ff] dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base leading-none">
                        public
                      </span>
                      <span>{t("export_import.community")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportPublic(false)}
                      className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        !importPublic
                          ? "bg-orange-500/15 border-orange-600 text-orange-700 dark:text-orange-300"
                          : "bg-[#f8f9ff] dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base leading-none">lock</span>
                      <span>{t("export_import.private")}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={importing}
                    className="w-full py-3 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs shadow-md shadow-orange-600/20 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base leading-none">
                      upload
                    </span>
                    <span>
                      {importing
                        ? t("export_import.importing")
                        : t("export_import.import_btn", { count: String(previewItems.length) })}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie del modal */}
        <div className="px-4 sm:px-6 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:py-3.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
