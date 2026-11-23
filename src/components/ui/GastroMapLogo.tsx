import React from "react";

interface GastroMapIconProps {
  className?: string;
}

/**
 * Isotipo oficial de GastroMap: Radar y Plato (cuadrado redondeado naranja con aros concéntricos y punto central).
 */
export function GastroMapIcon({ className = "w-8 h-8" }: GastroMapIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="18" fill="#ea580c" />
      <circle cx="32" cy="32" r="22.5" stroke="#ffffff" strokeWidth="2.6" strokeOpacity="0.45" />
      <circle cx="32" cy="32" r="14" stroke="#ffffff" strokeWidth="4.2" />
      <circle cx="32" cy="32" r="5.5" fill="#ffffff" />
    </svg>
  );
}

interface GastroMapLogoProps {
  iconClassName?: string;
  textClassName?: string;
  showWordmark?: boolean;
}

/**
 * Logotipo completo de GastroMap (Isotipo Radar y Plato + tipografía GastroMap).
 */
export function GastroMapLogo({
  iconClassName = "w-8 h-8",
  textClassName = "text-lg sm:text-xl",
  showWordmark = true,
}: GastroMapLogoProps) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <GastroMapIcon className={`${iconClassName} shrink-0 shadow-xs rounded-[28%]`} />
      {showWordmark && (
        <span className={`font-extrabold tracking-tight leading-none text-[#0f172a] dark:text-slate-100 ${textClassName}`}>
          Gastro<span className="text-[#ea580c]">Map</span>
        </span>
      )}
    </span>
  );
}
