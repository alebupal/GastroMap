import L from "leaflet";

/**
 * Paleta de colores temáticos para ocasiones gastronómicas
 */
const OCCASION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  tapear: { bg: "#ea580c", text: "#ffffff", border: "#c2410c" }, // Naranja vibrante
  comer: { bg: "#2563eb", text: "#ffffff", border: "#1d4ed8" }, // Azul intenso
  desayuno: { bg: "#f59e0b", text: "#ffffff", border: "#d97706" }, // Ámbar cálido
  informal: { bg: "#059669", text: "#ffffff", border: "#047857" }, // Esmeralda
  cafe: { bg: "#92400e", text: "#ffffff", border: "#78350f" }, // Ámbar tostado
  copas: { bg: "#7c3aed", text: "#ffffff", border: "#6d28d9" }, // Morado
  cita: { bg: "#e11d48", text: "#ffffff", border: "#be123c" }, // Rosa carmesí
  grupos: { bg: "#0d9488", text: "#ffffff", border: "#0f766e" }, // Turquesa profundo
  // Alias históricos
  dulce: { bg: "#db2777", text: "#ffffff", border: "#be185d" },
  postureo: { bg: "#ca8a04", text: "#ffffff", border: "#a16207" },
  casual: { bg: "#059669", text: "#ffffff", border: "#047857" },
  terraza: { bg: "#0284c7", text: "#ffffff", border: "#0369a1" },
};

const DEFAULT_COLOR = { bg: "#ea580c", text: "#ffffff", border: "#c2410c" }; // Naranja vibrante por defecto

export type PinPersonalBadge = "favorite" | "visited" | "pending" | null;

/**
 * Genera un marcador tipo pin gastronómico ultra-nítido y compatible.
 * Combina un pin vectorial SVG para la forma de gota invertida con una capa
 * HTML absoluta para el emoji nativo del sistema e insignia opcional de estado personal.
 */
export function createPlaceMarkerIcon(
  occasionId?: string,
  emoji?: string,
  isSelected: boolean = false,
  personalBadge: PinPersonalBadge = null
): L.DivIcon {
  const colors = (occasionId && OCCASION_COLORS[occasionId]) || DEFAULT_COLOR;
  const iconEmoji = emoji || "🍽️";
  const w = isSelected ? 42 : 34;
  const h = isSelected ? 52 : 42;
  const emojiSize = isSelected ? 18 : 15;
  const cx = w / 2;
  const cy = w / 2 - 1;
  const r = w / 2 - 4;

  // Insignia visual según estado personal (favorito, visitado, pendiente)
  let badgeHtml = "";
  if (personalBadge === "favorite") {
    badgeHtml = `<div style="position: absolute; top: -4px; right: -4px; width: 16px; height: 16px; border-radius: 9999px; background: #f59e0b; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; font-size: 9px; line-height: 1; box-shadow: 0 2px 4px rgba(0,0,0,0.35);">⭐</div>`;
  } else if (personalBadge === "visited") {
    badgeHtml = `<div style="position: absolute; top: -4px; right: -4px; width: 16px; height: 16px; border-radius: 9999px; background: #10b981; border: 2px solid #ffffff; color: #ffffff; font-weight: 900; display: flex; align-items: center; justify-content: center; font-size: 9px; line-height: 1; box-shadow: 0 2px 4px rgba(0,0,0,0.35);">✓</div>`;
  } else if (personalBadge === "pending") {
    badgeHtml = `<div style="position: absolute; top: -4px; right: -4px; width: 16px; height: 16px; border-radius: 9999px; background: #3b82f6; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; font-size: 9px; line-height: 1; box-shadow: 0 2px 4px rgba(0,0,0,0.35);">🕒</div>`;
  }

  const iconContent = iconEmoji.startsWith("ms:")
    ? `<span class="material-symbols-outlined" style="font-size: ${emojiSize}px; color: #ffffff; line-height: 1;">${iconEmoji.slice(3)}</span>`
    : iconEmoji;

  const selectedRadarHtml = isSelected
    ? `<div class="gm-pin-pulse" style="position: absolute; left: 50%; top: ${cy}px; width: ${w}px; height: ${w}px; margin-left: -${w / 2}px; margin-top: -${w / 2}px; border-radius: 9999px; border: 2.5px solid ${colors.bg}; background: ${colors.bg}22; pointer-events: none;"></div>`
    : "";

  const html = `
    <div style="position: relative; width: ${w}px; height: ${h}px; filter: drop-shadow(0 4px 10px rgba(0,0,0,${
    isSelected ? 0.5 : 0.3
  })); cursor: pointer; transform: ${
    isSelected ? "scale(1.18)" : "scale(1)"
  }; transition: transform 0.2s ease;">
      ${selectedRadarHtml}
      <!-- Pin SVG con forma de gota invertida -->
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; position: absolute; left: 0; top: 0; overflow: visible;">
        <path d="M${cx} ${h} C${cx} ${h} 2 ${cy + 12} 2 ${cy} C2 ${cy - r} ${cx - r} 2 ${cx} 2 C${
    cx + r
  } 2 ${w - 2} ${cy - r} ${w - 2} ${cy} C${w - 2} ${cy + 12} ${cx} ${h} ${cx} ${h} Z" fill="${
    colors.bg
  }" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
        <!-- Círculo interior de contraste para destacar el icono -->
        <circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="#ffffff" fill-opacity="0.3"/>
      </svg>
      <!-- Capa HTML para emoji o Material Symbol -->
      <div style="position: absolute; left: 0; top: 0; width: ${w}px; height: ${w}px; display: flex; align-items: center; justify-content: center; font-size: ${emojiSize}px; line-height: 1; pointer-events: none; user-select: none;">
        ${iconContent}
      </div>
      ${badgeHtml}
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-gastromap-pin",
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h],
  });
}

/**
 * Genera un marcador circular para agrupaciones (clusters) de establecimientos cercanos
 */
export function createClusterMarkerIcon(count: number): L.DivIcon {
  const size = count >= 25 ? 46 : count >= 10 ? 40 : 36;
  const fontSize = count >= 25 ? 14 : 13;
  const bgGradient =
    count >= 25
      ? "linear-gradient(135deg, #ea580c, #c2410c)"
      : count >= 10
      ? "linear-gradient(135deg, #f59e0b, #ea580c)"
      : "linear-gradient(135deg, #fbbf24, #f59e0b)";

  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 9999px;
      background: ${bgGradient};
      border: 3px solid #ffffff;
      box-shadow: 0 4px 12px rgba(234, 88, 12, 0.45), 0 0 0 4px rgba(245, 158, 11, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0f172a;
      font-weight: 900;
      font-size: ${fontSize}px;
      font-family: system-ui, sans-serif;
      cursor: pointer;
      transition: transform 0.15s ease;
    ">
      ${count}
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-gastromap-cluster",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Marcador para la ubicación actual del usuario con pulso visual
 */
export function createUserLocationIcon(): L.DivIcon {
  const size = 26;
  const html = `
    <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
      <div style="
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: rgba(59, 130, 246, 0.45);
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
      <div style="
        position: relative;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #2563eb;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "user-location-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}
