/**
 * Generador nativo de documentos PDF (Estándar PDF 1.4) sin dependencias externas.
 * Produce un archivo PDF válido con tipografía vectorial Helvetica y codificación WinAnsi.
 */

export interface PdfPlaceItem {
  name: string;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  googleMapsUrl?: string | null;
  priceRange?: string | null;
  rating?: number | null;
  notes?: string | null;
  occasions?: string[];
  tags?: string[];
}

/**
 * Convierte caracteres latinos y símbolos españoles al mapa de bytes WinAnsiEncoding
 * y escapa caracteres de control de cadenas de texto PDF.
 */
function encodePdfString(str: string): string {
  if (!str) return "";
  let out = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    switch (code) {
      case 92: // \
        out += "\\\\";
        break;
      case 40: // (
        out += "\\(";
        break;
      case 41: // )
        out += "\\)";
        break;
      // Caracteres españoles e internacionales comunes en WinAnsi
      case 225: out += "\\341"; break; // á
      case 233: out += "\\351"; break; // é
      case 237: out += "\\355"; break; // í
      case 243: out += "\\363"; break; // ó
      case 250: out += "\\372"; break; // ú
      case 241: out += "\\361"; break; // ñ
      case 252: out += "\\374"; break; // ü
      case 193: out += "\\301"; break; // Á
      case 201: out += "\\311"; break; // É
      case 205: out += "\\315"; break; // Í
      case 211: out += "\\323"; break; // Ó
      case 218: out += "\\332"; break; // Ú
      case 209: out += "\\321"; break; // Ñ
      case 220: out += "\\334"; break; // Ü
      case 191: out += "\\277"; break; // ¿
      case 161: out += "\\241"; break; // ¡
      case 8364: out += "\\200"; break;  // € (Euro en WinAnsiEncoding)
      default:
        if (code >= 32 && code <= 126) {
          out += str[i];
        } else if (code >= 160 && code <= 255) {
          out += "\\" + code.toString(8).padStart(3, "0");
        } else {
          out += " ";
        }
    }
  }
  return out;
}

export function generatePlacesPdf(places: PdfPlaceItem[], title: string = "GastroMap"): Uint8Array {
  const PAGE_WIDTH = 595.28;  // A4 ancho en puntos (72 dpi)
  const PAGE_HEIGHT = 841.89; // A4 alto en puntos
  const MARGIN_LEFT = 45;
  const MARGIN_RIGHT = 45;
  const MARGIN_TOP = 50;
  const MARGIN_BOTTOM = 50;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  interface PageAnnot {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    url: string;
  }

  interface PageContent {
    commands: string[];
    annots: PageAnnot[];
  }

  const pages: PageContent[] = [];
  let currentPage: PageContent = { commands: [], annots: [] };
  let currentY = PAGE_HEIGHT - MARGIN_TOP;

  function startNewPage() {
    if (currentPage.commands.length > 0) {
      pages.push(currentPage);
    }
    currentPage = { commands: [], annots: [] };
    currentY = PAGE_HEIGHT - MARGIN_TOP;
  }

  // Encabezado en la primera página
  function drawFirstPageHeader() {
    currentPage.commands.push(
      // Barra decorativa superior de acento ámbar
      `0.96 0.62 0.04 rg`,
      `${MARGIN_LEFT} ${currentY - 3} ${CONTENT_WIDTH} 4 re f`,
      `0 0 0 rg`
    );
    currentY -= 22;

    currentPage.commands.push(
      `BT`,
      `/F2 20 Tf`,
      `0.09 0.13 0.24 rg`,
      `${MARGIN_LEFT} ${currentY} Td`,
      `(${encodePdfString(title)}) Tj`,
      `ET`
    );
    currentY -= 16;

    const dateStr = new Date().toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    currentPage.commands.push(
      `BT`,
      `/F1 9 Tf`,
      `0.45 0.50 0.58 rg`,
      `${MARGIN_LEFT} ${currentY} Td`,
      `(${encodePdfString(`Catálogo exportado el ${dateStr} • Total: ${places.length} establecimientos`)}) Tj`,
      `ET`
    );
    currentY -= 20;

    // Línea divisoria
    currentPage.commands.push(
      `0.85 0.88 0.92 RG`,
      `0.5 w`,
      `${MARGIN_LEFT} ${currentY} m ${PAGE_WIDTH - MARGIN_RIGHT} ${currentY} l S`
    );
    currentY -= 18;
  }

  drawFirstPageHeader();

  // Renderizar cada establecimiento
  places.forEach((place, index) => {
    // Estimación de altura necesaria para este establecimiento
    const locParts = [place.city, place.address].filter(Boolean).join(" • ");
    const mapsUrl = place.googleMapsUrl || (place.latitude != null && place.longitude != null ? `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}` : null);

    let neededHeight = 36;
    if (locParts) neededHeight += 12;
    if (mapsUrl) neededHeight += 12;
    if (place.occasions && place.occasions.length > 0) neededHeight += 12;
    if (place.tags && place.tags.length > 0) neededHeight += 12;
    if (place.notes) neededHeight += 16;

    if (currentY - neededHeight < MARGIN_BOTTOM + 30) {
      startNewPage();
      // Pequeña cabecera de continuación en páginas subsiguientes
      currentPage.commands.push(
        `BT`,
        `/F1 8 Tf`,
        `0.60 0.65 0.72 rg`,
        `${MARGIN_LEFT} ${currentY} Td`,
        `(${encodePdfString(`${title} — Continuación`)}) Tj`,
        `ET`
      );
      currentY -= 15;
    }

    // Caja de fondo sutil para cada establecimiento
    const boxHeight = neededHeight - 6;
    currentPage.commands.push(
      `0.97 0.98 0.99 rg`,
      `${MARGIN_LEFT} ${currentY - boxHeight + 4} ${CONTENT_WIDTH} ${boxHeight} re f`,
      `0.90 0.92 0.95 RG`,
      `0.5 w`,
      `${MARGIN_LEFT} ${currentY - boxHeight + 4} ${CONTENT_WIDTH} ${boxHeight} re S`
    );

    // 1. Título y Rango de Precio formateado correctamente
    const nameStr = `${index + 1}. ${place.name}`;
    let rawPrice = (place.priceRange || "").trim();
    if (rawPrice.toUpperCase().includes("EUR")) {
      const eurCount = (rawPrice.match(/EUR/gi) || []).length;
      rawPrice = "€".repeat(Math.min(4, Math.max(1, eurCount)));
    }
    const priceMap: Record<string, string> = {
      "€": "< 15 €",
      "€€": "15 - 30 €",
      "€€€": "30 - 50 €",
      "€€€€": "> 50 €",
    };
    const priceStr = rawPrice && priceMap[rawPrice]
      ? `${rawPrice} (${priceMap[rawPrice]})`
      : (rawPrice ? `[${rawPrice}]` : "");

    currentPage.commands.push(
      `BT`,
      `/F2 11 Tf`,
      `0.09 0.13 0.24 rg`,
      `${MARGIN_LEFT + 8} ${currentY - 12} Td`,
      `(${encodePdfString(nameStr)}) Tj`,
      `ET`
    );

    if (priceStr) {
      currentPage.commands.push(
        `BT`,
        `/F2 9.5 Tf`,
        `0.85 0.45 0.05 rg`,
        `${PAGE_WIDTH - MARGIN_RIGHT - 110} ${currentY - 12} Td`,
        `(${encodePdfString(priceStr)}) Tj`,
        `ET`
      );
    }
    currentY -= 20;

    // 2. Ciudad y Dirección
    if (locParts) {
      currentPage.commands.push(
        `BT`,
        `/F1 8.5 Tf`,
        `0.35 0.40 0.48 rg`,
        `${MARGIN_LEFT + 8} ${currentY} Td`,
        `(${encodePdfString(locParts)}) Tj`,
        `ET`
      );
      currentY -= 11;
    }

    // 2b. Enlace directo a Google Maps
    if (mapsUrl) {
      const displayUrl = mapsUrl.length > 70 ? mapsUrl.slice(0, 67) + "..." : mapsUrl;
      currentPage.commands.push(
        `BT`,
        `/F1 8 Tf`,
        `0.12 0.38 0.88 rg`,
        `${MARGIN_LEFT + 8} ${currentY} Td`,
        `(${encodePdfString(`📍 Maps: ${displayUrl}`)}) Tj`,
        `ET`
      );
      currentPage.annots.push({
        x1: MARGIN_LEFT + 8,
        y1: currentY - 2,
        x2: MARGIN_LEFT + 8 + Math.min(CONTENT_WIDTH - 20, displayUrl.length * 4.6),
        y2: currentY + 9,
        url: mapsUrl,
      });
      currentY -= 11;
    }

    // 3. Ocasiones y Categorías
    if (place.occasions && place.occasions.length > 0) {
      const occText = `Planes: ${place.occasions.join(", ")}`;
      currentPage.commands.push(
        `BT`,
        `/F1 8 Tf`,
        `0.20 0.45 0.70 rg`,
        `${MARGIN_LEFT + 8} ${currentY} Td`,
        `(${encodePdfString(occText)}) Tj`,
        `ET`
      );
      currentY -= 11;
    }

    // 4. Etiquetas
    if (place.tags && place.tags.length > 0) {
      const tagsText = place.tags.map((t) => `#${t}`).join(" ");
      currentPage.commands.push(
        `BT`,
        `/F1 7.5 Tf`,
        `0.50 0.55 0.62 rg`,
        `${MARGIN_LEFT + 8} ${currentY} Td`,
        `(${encodePdfString(tagsText)}) Tj`,
        `ET`
      );
      currentY -= 11;
    }

    // 5. Notas / Comentario
    if (place.notes) {
      const truncatedNotes = place.notes.length > 130 ? place.notes.slice(0, 127) + "..." : place.notes;
      currentPage.commands.push(
        `BT`,
        `/F1 8 Tf`,
        `0.25 0.30 0.38 rg`,
        `${MARGIN_LEFT + 8} ${currentY} Td`,
        `(${encodePdfString(`Nota: ${truncatedNotes}`)}) Tj`,
        `ET`
      );
      currentY -= 11;
    }

    currentY -= 8; // Espacio entre ítems
  });

  if (currentPage.commands.length > 0) {
    pages.push(currentPage);
  }

  // Dibujar pie de página con numeración en todas las páginas
  const totalPagesCount = pages.length;
  pages.forEach((page, idx) => {
    const footerText = `Página ${idx + 1} de ${totalPagesCount} • GastroMap v0.1.0`;
    page.commands.push(
      `0.88 0.90 0.94 RG`,
      `0.5 w`,
      `${MARGIN_LEFT} 35 m ${PAGE_WIDTH - MARGIN_RIGHT} 35 l S`,
      `BT`,
      `/F1 8 Tf`,
      `0.55 0.60 0.68 rg`,
      `${MARGIN_LEFT} 24 Td`,
      `(${encodePdfString(footerText)}) Tj`,
      `ET`
    );
  });

  // Ensamblar la estructura estándar de objetos PDF
  // Obj 1: Catalog
  // Obj 2: Pages
  // Obj 3: Font F1 (Helvetica)
  // Obj 4: Font F2 (Helvetica-Bold)
  // Obj 5..: Page Objects y Content Streams
  const pdfChunks: string[] = [];
  const offsets: number[] = [];

  function addChunk(str: string): number {
    const offset = pdfChunks.reduce((acc, c) => acc + c.length, 0);
    pdfChunks.push(str);
    return offset;
  }

  addChunk("%PDF-1.4\n%âãÏÓ\n");

  const fontF1ObjId = 3;
  const fontF2ObjId = 4;
  const firstPageObjId = 5;

  // Obj 1: Catalog
  offsets[1] = addChunk(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  // Obj 2: Pages
  const pageObjIds: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageObjIds.push(firstPageObjId + i * 2);
  }
  const kidsStr = pageObjIds.map((id) => `${id} 0 R`).join(" ");
  offsets[2] = addChunk(
    `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pages.length} >>\nendobj\n`
  );

  // Obj 3: Font F1 (Helvetica con WinAnsiEncoding)
  offsets[fontF1ObjId] = addChunk(
    `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`
  );

  // Obj 4: Font F2 (Helvetica-Bold con WinAnsiEncoding)
  offsets[fontF2ObjId] = addChunk(
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`
  );

  // Objetos de cada página
  for (let i = 0; i < pages.length; i++) {
    const pageId = firstPageObjId + i * 2;
    const contentId = pageId + 1;
    const streamContent = pages[i].commands.join("\n") + "\n";
    const streamLength = streamContent.length;

    const annotsStr = pages[i].annots.length > 0
      ? ` /Annots [ ${pages[i].annots.map(a => `<< /Type /Annot /Subtype /Link /Rect [${Math.round(a.x1)} ${Math.round(a.y1)} ${Math.round(a.x2)} ${Math.round(a.y2)}] /Border [0 0 0] /A << /Type /Action /S /URI /URI (${a.url}) >> >>`).join(" ")} ]`
      : "";

    // Page object
    offsets[pageId] = addChunk(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >>${annotsStr} >>\nendobj\n`
    );

    // Stream object
    offsets[contentId] = addChunk(
      `${contentId} 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}endstream\nendobj\n`
    );
  }

  // Cross-reference table (xref)
  const xrefOffset = pdfChunks.reduce((acc, c) => acc + c.length, 0);
  const totalObjects = 4 + pages.length * 2;

  let xrefStr = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= totalObjects; i++) {
    const off = offsets[i] || 0;
    xrefStr += off.toString().padStart(10, "0") + " 00000 n \n";
  }

  const trailerStr = `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  addChunk(xrefStr + trailerStr);

  const finalString = pdfChunks.join("");
  const buffer = new Uint8Array(finalString.length);
  for (let i = 0; i < finalString.length; i++) {
    buffer[i] = finalString.charCodeAt(i) & 0xff;
  }

  return buffer;
}
