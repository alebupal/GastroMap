import L from "leaflet";

/**
 * Paleta de colores temáticos para ocasiones
 */
const OCCASION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  tapear: { bg: "#f97316", text: "#ffffff", border: "#ea580c" }, // Naranja
  comer: { bg: "#3b82f6", text: "#ffffff", border: "#2563eb" }, // Azul
  dulce: { bg: "#ec4899", text: "#ffffff", border: "#db2777" }, // Rosa
  cafe: { bg: "#854d0e", text: "#ffffff", border: "#713f12" }, // Marrón café
  copas: { bg: "#8b5cf6", text: "#ffffff", border: "#7c3aed" }, // Morado
  postureo: { bg: "#eab308", text: "#ffffff", border: "#ca8a04" }, // Dorado
};

const DEFAULT_COLOR = { bg: "#f59e0b", text: "#ffffff", border: "#d97706" }; // Ámbar por defecto

/**
 * Genera un L.DivIcon personalizado con forma de marcador gastronómico y emoji
 */
export function createPlaceMarkerIcon(
  occasionId?: string,
  emoji?: string,
  isSelected: boolean = false
): L.DivIcon {
  const colors = (occasionId && OCCASION_COLORS[occasionId]) || DEFAULT_COLOR;
  const iconEmoji = emoji || "🍽️";
  const size = isSelected ? 44 : 36;
  const iconSize = isSelected ? 22 : 18;

  const html = `
    <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50% 50% 50% 0;
        background: ${colors.bg};
        border: 2px solid #ffffff;
        box-shadow: 0 4px 12px rgba(0, 0, 0, ${isSelected ? "0.35" : "0.2"});
        transform: rotate(-45deg);
        position: absolute;
        transition: transform 0.2s ease, width 0.2s ease, height 0.2s ease;
      "></div>
      <span style="
        position: relative;
        z-index: 10;
        font-size: ${iconSize}px;
        line-height: 1;
        margin-top: -${isSelected ? 4 : 2}px;
        user-select: none;
      ">${iconEmoji}</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-gastromap-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

/**
 * Marcador pulsante para la ubicación actual del usuario
 */
export function createUserLocationIcon(): L.DivIcon {
  const html = `
    <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
      <div style="
        position: absolute;
        width: 24px;
        height: 24px;
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
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "user-location-pin",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}
