"use client";

import { useState } from "react";

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

interface TagInputProps {
  availableTags?: string[];
  initialTags?: string[];
}

export function TagInput({ availableTags = [], initialTags = [] }: TagInputProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  function toggleTag(tagId: string) {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter((t) => t !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
  }

  function handleAddCustomTag(e: React.FormEvent) {
    e.preventDefault();
    const clean = newTagInput
      .trim()
      .toLowerCase()
      .replace(/^#+/, "")
      .replace(/[^a-z0-9áéíóúñü\-_ ]/gi, "")
      .trim();

    if (clean && !selectedTags.includes(clean)) {
      setSelectedTags([...selectedTags, clean]);
      if (!customTags.includes(clean) && !PRESET_TAGS.some((p) => p.id === clean)) {
        setCustomTags([...customTags, clean]);
      }
    }
    setNewTagInput("");
    setIsAddingCustom(false);
  }

  // Combinar los presets con las etiquetas ya existentes de la BD y las personalizadas
  const allAvailablePills = [
    ...PRESET_TAGS,
    ...availableTags
      .filter((t) => !PRESET_TAGS.some((p) => p.id === t))
      .map((t) => ({ id: t, label: `#${t}` })),
    ...customTags
      .filter((t) => !PRESET_TAGS.some((p) => p.id === t) && !availableTags.includes(t))
      .map((t) => ({ id: t, label: `✨ #${t}` })),
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Tipo de cocina y especialidades (haz clic para marcar)
        </label>
        {selectedTags.length > 0 && (
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
            {selectedTags.length} {selectedTags.length === 1 ? "marcada" : "marcadas"}
          </span>
        )}
      </div>

      {/* Píldoras interactivas clicables */}
      <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
        {allAvailablePills.map((pill) => {
          const isSelected = selectedTags.includes(pill.id);
          return (
            <button
              type="button"
              key={pill.id}
              onClick={() => toggleTag(pill.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer border flex items-center gap-1.5 ${
                isSelected
                  ? "bg-amber-500 text-white border-amber-600 shadow-xs scale-102"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
              }`}
            >
              <span>{pill.label}</span>
              {isSelected && <span className="text-[10px] font-extrabold opacity-90">✓</span>}
            </button>
          );
        })}

        {/* Botón para abrir creador de etiqueta propia */}
        {!isAddingCustom && (
          <button
            type="button"
            onClick={() => setIsAddingCustom(true)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-medium border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer flex items-center gap-1"
          >
            <span>➕</span>
            <span>Otra especialidad</span>
          </button>
        )}
      </div>

      {/* Mini formulario para añadir etiqueta personalizada */}
      {isAddingCustom && (
        <div className="p-2.5 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/20 flex items-center gap-2 animate-in fade-in duration-100">
          <input
            type="text"
            autoFocus
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustomTag(e);
              } else if (e.key === "Escape") {
                setIsAddingCustom(false);
              }
            }}
            placeholder="Ej. tarta de queso, smash burger..."
            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <button
            type="button"
            onClick={handleAddCustomTag}
            disabled={!newTagInput.trim()}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            Añadir
          </button>
          <button
            type="button"
            onClick={() => setIsAddingCustom(false)}
            className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Inputs ocultos enviados al formulario */}
      {selectedTags.map((tag) => (
        <input key={tag} type="hidden" name="tags" value={tag} />
      ))}
    </div>
  );
}
