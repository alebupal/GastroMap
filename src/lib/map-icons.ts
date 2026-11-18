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
};

const DEFAULT_COLOR = { bg: "#d97706", text: "#ffffff", border: "#b45309" }; // Ámbar oscuro por defecto

/**
 * Genera un marcador tipo pin gastronómico en SVG puro
 * Diseñado para garantizar renderizado nítido y consistente en todos los navegadores
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
    <div style="width: ${w}px; height: ${h}px; filter: drop-shadow(0 4px 8px rgba(0,0,0,${
    isSelected ? 0.45 : 0.28
  })); cursor: pointer; transform: ${
    isSelected ? "scale(1.15)" : "scale(1)"
  }; transition: transform 0.2s ease;">
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; overflow: visible;">
        <!-- Forma de gota del pin invertida -->
        <path d="M${cx} ${h} C${cx} ${h} 2 ${cy + 12} 2 ${cy} C2 ${cy - r} ${cx - r} 2 ${cx} 2 C${
    cx + r
  } 2 ${w - 2} ${cy - r} ${w - 2} ${cy} C${w - 2} ${cy + 12} ${cx} ${h} ${cx} ${h} Z" fill="${
    colors.bg
  }" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
        <!-- Círculo interior de contraste -->
        <circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="#ffffff" fill-opacity="0.25"/>
        <!-- Emoji centrado -->
        <text x="${cx}" y="${cy + 1}" font-size="${emojiSize}" text-anchor="middle" dominant-baseline="central">${iconEmoji}</text>
      </svg>
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
        background: rgba(59, 130, 246, 0.4);
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
      <div style="
        position: relative;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #2563eb;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
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
