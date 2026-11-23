"use client";

import { useState, useMemo } from "react";
import { useT } from "@/lib/i18n/client";

export const OCCASION_EMOJI_OPTIONS: string[] = [
  "🥐", "🥞", "🧇", "🍳", "🥯", "🥖", "🥪", "🥗",
  "🍢", "🍻", "🍺", "🫒", "🍤", "🦑", "🧀", "🥓",
  "🍽️", "🥩", "🍖", "🍗", "🥘", "🍲", "🍝", "🍛",
  "🍔", "🍕", "🌮", "🌯", "🌭", "🍟", "🥙", "🥡",
  "🍣", "🍜", "🥟", "🍱", "🍙", "🦞", "🐟", "🦪",
  "☕", "🍵", "🧋", "🍰", "🧁", "🍩", "🍪", "🍨",
  "🍸", "🍹", "🍷", "🥂", "🍾", "🥃", "🧉", "🧃",
  "🕯️", "✨", "👥", "🎉", "☀️", "🌙", "🌿", "⭐",
];

export const OCCASION_MATERIAL_ICONS: Array<{ id: string; label: string }> = [
  { id: "restaurant", label: "Restaurante / Comer" },
  { id: "tapas", label: "Tapas / Picoteo" },
  { id: "bakery_dining", label: "Desayuno / Panadería" },
  { id: "brunch_dining", label: "Brunch" },
  { id: "breakfast_dining", label: "Desayuno" },
  { id: "lunch_dining", label: "Burger / Informal" },
  { id: "dinner_dining", label: "Cena / Pasta" },
  { id: "ramen_dining", label: "Ramen / Asiático" },
  { id: "local_pizza", label: "Pizza" },
  { id: "fastfood", label: "Rápido / Street food" },
  { id: "kebab_dining", label: "Brasa / Pinchos" },
  { id: "rice_bowl", label: "Arroz / Bowl" },
  { id: "soup_kitchen", label: "Cuchara / Caldos" },
  { id: "set_meal", label: "Menú / Pescado" },
  { id: "bento", label: "Bento / Japonés" },
  { id: "egg_alt", label: "Huevos / Tortilla" },
  { id: "local_cafe", label: "Café / Merienda" },
  { id: "coffee", label: "Café especialidad" },
  { id: "cake", label: "Tarta / Dulce" },
  { id: "icecream", label: "Helado" },
  { id: "cookie", label: "Repostería" },
  { id: "local_bar", label: "Cócteles / Copas" },
  { id: "wine_bar", label: "Vinos" },
  { id: "sports_bar", label: "Cervecería / Cañas" },
  { id: "liquor", label: "Destilados / Bar" },
  { id: "nightlife", label: "Noche / Fiesta" },
  { id: "celebration", label: "Celebración" },
  { id: "groups", label: "Grupos" },
  { id: "favorite", label: "Cita / Romántico" },
  { id: "auto_awesome", label: "Especial / Destacado" },
  { id: "diamond", label: "Alta cocina / Lujo" },
  { id: "workspace_premium", label: "Top / Recomendado" },
  { id: "outdoor_grill", label: "Parrilla / Asador" },
  { id: "deck", label: "Terraza" },
  { id: "sunny", label: "Sol / Tardeo" },
  { id: "nights_stay", label: "Nocturno" },
  { id: "beach_access", label: "Playa / Chiringuito" },
  { id: "park", label: "Jardín / Exterior" },
  { id: "takeout_dining", label: "Para llevar" },
  { id: "delivery_dining", label: "A domicilio" },
  { id: "local_dining", label: "Cubiertos" },
  { id: "restaurant_menu", label: "Carta / Menú" },
  { id: "storefront", label: "Mercado / Tienda" },
  { id: "music_note", label: "Música en vivo" },
  { id: "eco", label: "Veggie / Saludable" },
  { id: "pets", label: "Pet friendly" },
  { id: "family_restroom", label: "Familiar" },
  { id: "local_fire_department", label: "De moda / Picante" },
  { id: "savings", label: "Económico" },
  { id: "explore", label: "Viaje / Descubrir" },
  { id: "star", label: "Estrella" },
  { id: "bolt", label: "Express" },
];

export function isMaterialSymbolIcon(icon?: string | null): boolean {
  return Boolean(icon && icon.startsWith("ms:"));
}

export function formatOccasionOptionLabel(icon: string | undefined, name: string): string {
  if (!icon || isMaterialSymbolIcon(icon)) return name;
  return `${icon} ${name}`;
}

interface OccasionIconProps {
  icon?: string | null;
  className?: string;
  msClassName?: string;
}

export function OccasionIcon({
  icon,
  className = "",
  msClassName = "text-[15px]",
}: OccasionIconProps) {
  const safeIcon = icon || "🍽️";
  if (isMaterialSymbolIcon(safeIcon)) {
    return (
      <span
        className={`material-symbols-outlined leading-none align-middle ${msClassName} ${className}`}
        aria-hidden="true"
      >
        {safeIcon.slice(3)}
      </span>
    );
  }
  return (
    <span className={`leading-none ${className}`} aria-hidden="true">
      {safeIcon}
    </span>
  );
}

interface OccasionIconPickerProps {
  value: string;
  onChange: (nextIcon: string) => void;
}

export function OccasionIconPicker({ value, onChange }: OccasionIconPickerProps) {
  const { t } = useT();
  const [mode, setMode] = useState<"emoji" | "material">(
    isMaterialSymbolIcon(value) ? "material" : "emoji"
  );
  const [query, setQuery] = useState("");

  const filteredMaterialIcons = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return OCCASION_MATERIAL_ICONS;
    return OCCASION_MATERIAL_ICONS.filter(
      (item) =>
        item.id.toLowerCase().includes(q) || item.label.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 p-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setMode("emoji")}
            className={`px-2.5 py-1 rounded-full transition cursor-pointer ${
              mode === "emoji"
                ? "bg-orange-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {t("admin_taxonomy.icon_tab_emojis")}
          </button>
          <button
            type="button"
            onClick={() => setMode("material")}
            className={`px-2.5 py-1 rounded-full transition cursor-pointer ${
              mode === "material"
                ? "bg-orange-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {t("admin_taxonomy.icon_tab_material")}
          </button>
        </div>

        {/* Vista previa + entrada libre para emoji personalizado */}
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800/60 text-orange-600 dark:text-orange-400">
            <OccasionIcon icon={value} msClassName="text-base" />
          </span>
          {mode === "emoji" && (
            <input
              type="text"
              value={isMaterialSymbolIcon(value) ? "" : value}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (v) onChange(v);
              }}
              placeholder={t("admin_taxonomy.custom_emoji_placeholder")}
              className="w-24 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          )}
        </div>
      </div>

      {mode === "emoji" ? (
        <div className="grid grid-cols-8 sm:grid-cols-12 gap-1 max-h-36 overflow-y-auto p-1.5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700/80">
          {OCCASION_EMOJI_OPTIONS.map((emoji) => {
            const active = value === emoji;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onChange(emoji)}
                className={`h-7 rounded-lg text-sm flex items-center justify-center transition cursor-pointer ${
                  active
                    ? "bg-orange-600 text-white shadow-xs scale-105"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                }`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("admin_taxonomy.search_material_icons")}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <div className="grid grid-cols-6 sm:grid-cols-9 gap-1 max-h-40 overflow-y-auto p-1.5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700/80">
            {filteredMaterialIcons.map((item) => {
              const token = `ms:${item.id}`;
              const active = value === token;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={`${item.label} (${item.id})`}
                  onClick={() => onChange(token)}
                  className={`h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                    active
                      ? "bg-orange-600 text-white shadow-xs scale-105"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px] leading-none">
                    {item.id}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
