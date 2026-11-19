"use client";

import { useState, useRef, useEffect, useMemo } from "react";

export interface SearchableSelectOption {
  value: string;
  label: string;
  icon?: string;
  subtitle?: string;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  allOption?: SearchableSelectOption;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  buttonClassName?: string;
  ariaLabel?: string;
  noResultsText?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  allOption,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  className = "",
  buttonClassName = "",
  ariaLabel,
  noResultsText = "Sin coincidencias",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Determinar la opción seleccionada actualmente
  const selectedOption = useMemo(() => {
    if (allOption && (value === allOption.value || value === "all")) {
      return allOption;
    }
    return options.find((opt) => opt.value === value) || (allOption ? allOption : null);
  }, [value, options, allOption]);

  const displayLabel = selectedOption ? selectedOption.label : placeholder;
  const displayIcon = selectedOption ? selectedOption.icon : undefined;

  // Filtrar las opciones según el query de búsqueda
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.subtitle && opt.subtitle.toLowerCase().includes(q))
    );
  }, [options, query]);

  // Cerrar al hacer clic fuera o presionar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleSelect(val: string) {
    onChange(val);
    setIsOpen(false);
    setQuery("");
  }

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      {/* Botón selector principal (mismo estilo que CountrySelect) */}
      <button
        type="button"
        aria-label={ariaLabel || displayLabel}
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen(!isOpen);
          setQuery("");
        }}
        className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-xs transition shrink-0 ${buttonClassName}`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {displayIcon && <span className="text-base shrink-0">{displayIcon}</span>}
          <span className="truncate max-w-[140px] sm:max-w-[180px]">{displayLabel}</span>
        </span>
        <span className="text-slate-400 text-[10px] shrink-0 ml-1">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {/* Menú desplegable con buscador idéntico a CountrySelect */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 sm:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 space-y-1.5 max-h-72 flex flex-col animate-in fade-in zoom-in-95 duration-100">
          {/* Buscador superior */}
          <div className="relative shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-2.5 py-1.5 pl-7 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <span className="absolute left-2 top-1.5 text-xs text-slate-400 pointer-events-none">
              🔍
            </span>
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Lista de opciones scrolleable */}
          <div className="overflow-y-auto space-y-0.5 pr-0.5 flex-1 max-h-56">
            {/* Opción "Todos" si existe */}
            {allOption && (!query.trim() || allOption.label.toLowerCase().includes(query.toLowerCase())) && (
              <button
                type="button"
                onClick={() => handleSelect(allOption.value)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer ${
                  value === allOption.value || value === "all"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {allOption.icon && <span className="text-base shrink-0">{allOption.icon}</span>}
                  <span className="truncate">{allOption.label}</span>
                </div>
                {(value === allOption.value || value === "all") && (
                  <span className="text-amber-500 text-xs font-black">✓</span>
                )}
              </button>
            )}

            {filteredOptions.length === 0 && (!allOption || (query.trim() && !allOption.label.toLowerCase().includes(query.toLowerCase()))) ? (
              <div className="p-3 text-center text-xs text-slate-400">
                {noResultsText}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer ${
                      isSelected
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.icon && <span className="text-base shrink-0">{opt.icon}</span>}
                      <span className="truncate">{opt.label}</span>
                      {opt.subtitle && (
                        <span className="text-[10px] text-slate-400 truncate">
                          ({opt.subtitle})
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="text-amber-500 text-xs font-black">✓</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
