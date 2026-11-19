"use client";

import { useState, useMemo } from "react";
import { useT } from "@/lib/i18n/client";

const PRESET_TAGS = [
  { id: "italiana", label: "🍕 Italiana" },
  { id: "hamburguesas", label: "🍔 Burgers" },
  { id: "japonesa", label: "🍣 Japonesa" },
  { id: "carnes", label: "🥩 Brasa / Carnes" },
  { id: "pescados", label: "🐟 Pescados / Mariscos" },
  { id: "tradicional", label: "🥘 Casera / Tradicional" },
  { id: "mexicana", label: "🌮 Mexicana" },
  { id: "arroces", label: "🍲 Arroces" },
  { id: "postres", label: "🍰 Tartas / Postres" },
  { id: "veggie", label: "🌿 Vegano / Veggie" },
  { id: "cerveza", label: "🍻 Cervecería" },
  { id: "vinos", label: "🍷 Vinos / Bodega" },
];

const INITIAL_VISIBLE = 16;
const LOAD_MORE_STEP = 24;

interface TagInputProps {
  availableTags?: string[];
  initialTags?: string[];
}

function normalizeTagInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9áéíóúñü\-_ ]/gi, "")
    .trim();
}

export function TagInput({ availableTags = [], initialTags = [] }: TagInputProps) {
  const { t } = useT();
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  }

  function handleCreateFromSearch() {
    const clean = normalizeTagInput(searchQuery);
    if (!clean) return;

    if (!selectedTags.includes(clean)) {
      setSelectedTags((prev) => [...prev, clean]);
    }
    if (
      !customTags.includes(clean) &&
      !PRESET_TAGS.some((p) => p.id === clean) &&
      !availableTags.includes(clean)
    ) {
      setCustomTags((prev) => [clean, ...prev]);
    }
    setSearchQuery("");
  }

  // Lista unificada manteniendo orden de frecuencia (availableTags ya viene ordenado por uso)
  const allPills = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; label: string }> = [];

    // 1. Etiquetas más frecuentes de la BD (respetando icono si coincide con preset)
    const presetMap = new Map(PRESET_TAGS.map((p) => [p.id, p.label]));
    for (const t of availableTags) {
      if (!seen.has(t)) {
        seen.add(t);
        list.push({ id: t, label: presetMap.get(t) || `#${t}` });
      }
    }

    // 2. Presets que aún no estuvieran en la BD
    for (const p of PRESET_TAGS) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        list.push(p);
      }
    }

    // 3. Personalizadas creadas al vuelo
    for (const c of customTags) {
      if (!seen.has(c)) {
        seen.add(c);
        list.push({ id: c, label: `✨ #${c}` });
      }
    }

    return list;
  }, [availableTags, customTags]);

  const normalizedSearch = normalizeTagInput(searchQuery);

  const filteredPills = useMemo(() => {
    if (!normalizedSearch) return allPills;
    return allPills.filter(
      (p) =>
        p.id.toLowerCase().includes(normalizedSearch) ||
        p.label.toLowerCase().includes(normalizedSearch)
    );
  }, [allPills, normalizedSearch]);

  const displayedPills = normalizedSearch
    ? filteredPills.slice(0, 40)
    : filteredPills.slice(0, visibleCount);

  const remainingCount = normalizedSearch
    ? Math.max(0, filteredPills.length - displayedPills.length)
    : Math.max(0, filteredPills.length - visibleCount);

  const exactExists =
    normalizedSearch.length > 0 &&
    allPills.some((p) => p.id.toLowerCase() === normalizedSearch);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {t("form.tags_title", { count: allPills.length })}
        </label>
        {selectedTags.length > 0 && (
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
            {selectedTags.length === 1
              ? t("form.tags_selected_single", { count: selectedTags.length })
              : t("form.tags_selected_multiple", { count: selectedTags.length })}
          </span>
        )}
      </div>

      {/* Etiquetas seleccionadas actualmente (siempre visibles arriba) */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tagId) => {
            const pill = allPills.find((p) => p.id === tagId);
            return (
              <button
                key={tagId}
                type="button"
                onClick={() => toggleTag(tagId)}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500 text-slate-950 border border-amber-500 shadow-xs flex items-center gap-1 cursor-pointer hover:bg-amber-600 transition"
                title={t("form.tags_remove_title")}
              >
                <span>{pill ? pill.label : `#${tagId}`}</span>
                <span className="text-[10px] opacity-80">✕</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Buscador + creación rápida */}
      <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
        <div className="relative flex gap-1.5">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-2 text-xs text-slate-400 pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (normalizedSearch && !exactExists) {
                    handleCreateFromSearch();
                  } else if (filteredPills.length === 1) {
                    toggleTag(filteredPills[0].id);
                    setSearchQuery("");
                  }
                }
              }}
              placeholder={t("form.tags_search_placeholder")}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {normalizedSearch && !exactExists && (
            <button
              type="button"
              onClick={handleCreateFromSearch}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shrink-0 transition cursor-pointer"
            >
              + #{normalizedSearch}
            </button>
          )}
        </div>

        {/* Chips más frecuentes o filtrados */}
        <div className="flex flex-wrap gap-1.5">
          {displayedPills.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic py-1">
              {t("form.tags_no_matches", { query: normalizedSearch })}
            </p>
          ) : (
            displayedPills.map((pill) => {
              const isSelected = selectedTags.includes(pill.id);
              return (
                <button
                  type="button"
                  key={pill.id}
                  onClick={() => toggleTag(pill.id)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition active:scale-95 cursor-pointer border flex items-center gap-1 ${
                    isSelected
                      ? "bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-xs"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <span>{pill.label}</span>
                  {isSelected && <span className="text-[10px] font-extrabold">✓</span>}
                </button>
              );
            })
          )}
        </div>

        {/* Botones Mostrar más / Ver menos */}
        {!normalizedSearch && (remainingCount > 0 || visibleCount > INITIAL_VISIBLE) && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 dark:border-slate-700/50 text-[11px]">
            {remainingCount > 0 ? (
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + LOAD_MORE_STEP)}
                className="font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                {t("places.show_more_remaining", { count: remainingCount })}
              </button>
            ) : (
              <span className="text-slate-400">{t("places.showing_all_tags")}</span>
            )}

            {visibleCount > INITIAL_VISIBLE && (
              <button
                type="button"
                onClick={() => setVisibleCount(INITIAL_VISIBLE)}
                className="font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                {t("places.show_less")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Inputs ocultos para envío estándar de FormData */}
      {selectedTags.map((tag) => (
        <input key={tag} type="hidden" name="tags" value={tag} />
      ))}
    </div>
  );
}
