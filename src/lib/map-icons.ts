import L from "leaflet";

/**
 * Paleta de colores temáticos para ocasiones gastronómicas
 */
const OCCASION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  tapear: { bg: "#ea580c", text: "#ffffff", border: "#c2410c" }, // Naranja vibrante
  comer: { bg: "#2563eb", text: "#ffffff", border: "#1d4ed8" }, // Azul intenso
  dulce: { bg: "#db2777", text: "#ffffff", border: "#be185d" }, // Rosa frambuesa
  cafe: { bg: "#92400e", text: "#ffffff", border: "#78350f" }, // Ámbar tostado
  copas: { bg: "#7c3aed", text: "#ffffff", border: "#6d28d9" }, // Morado
  postureo: { bg: "#ca8a04", text: "#ffffff", border: "#a16207" }, // Dorado
  desayuno: { bg: "#f59e0b", text: "#ffffff", border: "#d97706" }, // Ámbar cálido
  casual: { bg: "#059669", text: "#ffffff", border: "#047857" }, // Esmeralda
  cita: { bg: "#e11d48", text: "#ffffff", border: "#be123c" }, // Rosa carmesí
  terraza: { bg: "#0284c7", text: "#ffffff", border: "#0369a1" }, // Celeste cielo
};

const DEFAULT_COLOR = { bg: "#ea580c", text: "#ffffff", border: "#c2410c" }; // Naranja vibrante por defecto

/**
 * Genera un marcador tipo pin gastronómico ultra-nítido y compatible.
 * Combina un pin vectorial SVG para la forma de gota invertida con una capa
 * HTML absoluta para el emoji nativo del sistema, garantizando visibilidad total
 * en Linux, Windows, macOS, Android e iOS.
 */
export function createPlaceMarkerIcon(
  occasionId?: string,
  emoji?: string,
  isSelected: boolean = false
): L.DivIcon {
  const colors = (occasionId && OCCASION_COLORS[occasionId]) || DEFAULT_COLOR;
  const iconEmoji = emoji || "🍽️";
  const w = isSelected ? 42 : 34;
  const h = isSelected ? 52 : 42;
  const emojiSize = isSelected ? 18 : 15;
  const cx = w / 2;
  const cy = w / 2 - 1;
  const r = w / 2 - 4;

  const html = `
    <div style="position: relative; width: ${w}px; height: ${h}px; filter: drop-shadow(0 4px 10px rgba(0,0,0,${
    isSelected ? 0.5 : 0.3
  })); cursor: pointer; transform: ${
    isSelected ? "scale(1.18)" : "scale(1)"
  }; transition: transform 0.2s ease;">
      <!-- Pin SVG con forma de gota invertida -->
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; position: absolute; left: 0; top: 0; overflow: visible;">
        <path d="M${cx} ${h} C${cx} ${h} 2 ${cy + 12} 2 ${cy} C2 ${cy - r} ${cx - r} 2 ${cx} 2 C${
    cx + r
  } 2 ${w - 2} ${cy - r} ${w - 2} ${cy} C${w - 2} ${cy + 12} ${cx} ${h} ${cx} ${h} Z" fill="${
    colors.bg
  }" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
        <!-- Círculo interior de contraste para destacar el emoji -->
        <circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="#ffffff" fill-opacity="0.3"/>
      </svg>
      <!-- Capa HTML nativa para emoji siempre visible y a todo color -->
      <div style="position: absolute; left: 0; top: 0; width: ${w}px; height: ${w}px; display: flex; align-items: center; justify-content: center; font-size: ${emojiSize}px; line-height: 1; pointer-events: none; user-select: none;">
        ${iconEmoji}
      </div>
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
