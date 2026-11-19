"use client";

import { useState, useRef, useEffect, useMemo } from "react";

export interface SearchableSelectOption {
  value: string;
  label: string;
  icon?: string;
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
    if (allOption && value === allOption.value) {
      return allOption;
    }
    return options.find((opt) => opt.value === value) || (allOption ? allOption : null);
  }, [value, options, allOption]);

  const displayLabel = selectedOption ? selectedOption.label : placeholder;
  const displayIcon = selectedOption ? selectedOption.icon : undefined;
  const isFiltered = Boolean(value) && value !== "all" && (allOption ? value !== allOption.value : true);

  // Filtrar las opciones según el query de búsqueda
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  // Cerrar al hacer clic fuera
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
      setTimeout(() => inputRef.current?.focus(), 40);
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
      {/* Botón trigger principal */}
      <button
        type="button"
        aria-label={ariaLabel || displayLabel}
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen(!isOpen);
          setQuery("");
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer shadow-xs whitespace-nowrap outline-none focus:outline-none focus:ring-0 focus-visible:outline-none ${
          isFiltered
            ? "bg-amber-500 border-amber-500 text-slate-950 font-bold shadow-xs"
            : isOpen
              ? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              : "bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
        } ${buttonClassName}`}
      >
        {displayIcon && <span className="shrink-0">{displayIcon}</span>}
        <span className="truncate max-w-[130px] sm:max-w-[160px]">{displayLabel}</span>
        <span className="text-[10px] text-slate-400 shrink-0 ml-0.5">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {/* Menú desplegable con buscador */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[210px] max-w-[280px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
          {/* Input de búsqueda rápida */}
          <div className="relative">
            <span className="absolute left-2.5 top-2 text-xs text-slate-400 pointer-events-none">
              🔍
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-7 pr-6 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 outline-none focus:outline-none"
              >
                ✕
              </button>
            )}
          </div>

          {/* Lista de opciones scrolleable */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
            {/* Opción "Todos" si existe y la búsqueda está vacía o coincide */}
            {allOption && (!query.trim() || allOption.label.toLowerCase().includes(query.toLowerCase())) && (
              <button
                type="button"
                onClick={() => handleSelect(allOption.value)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer text-left outline-none focus:outline-none ${
                  value === allOption.value
                    ? "bg-amber-500 text-slate-950 font-bold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {allOption.icon && <span>{allOption.icon}</span>}
                  <span className="truncate">{allOption.label}</span>
                </span>
                {value === allOption.value && <span className="text-[11px] font-extrabold shrink-0">✓</span>}
              </button>
            )}

            {filteredOptions.length === 0 && (!allOption || (query.trim() && !allOption.label.toLowerCase().includes(query.toLowerCase()))) ? (
              <p className="text-[11px] text-slate-400 italic py-2 text-center">
                {noResultsText}
              </p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer text-left outline-none focus:outline-none ${
                      isSelected
                        ? "bg-amber-500 text-slate-950 font-bold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      {opt.icon && <span>{opt.icon}</span>}
                      <span className="truncate">{opt.label}</span>
                    </span>
                    {isSelected && <span className="text-[11px] font-extrabold shrink-0">✓</span>}
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
