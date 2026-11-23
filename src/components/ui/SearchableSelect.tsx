"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface SearchableSelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
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
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determinar la opción seleccionada actualmente
  const selectedOption = useMemo(() => {
    if (allOption && (value === allOption.value || value === "all")) {
      return allOption;
    }
    return options.find((opt) => opt.value === value) || (allOption ? allOption : null);
  }, [value, options, allOption]);

  const isFiltered = Boolean(
    value && value !== "all" && (allOption ? value !== allOption.value : true)
  );

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

  // Posicionar el menú usando coordenadas fijas sobre el viewport
  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popupWidth = window.innerWidth < 640 ? 256 : 288;
      let left = rect.left;
      if (left + popupWidth > window.innerWidth - 12) {
        left = window.innerWidth - popupWidth - 12;
      }
      if (left < 12) left = 12;

      const estimatedHeight = 280;
      let top = rect.bottom + 6;
      if (top + estimatedHeight > window.innerHeight - 12 && rect.top > estimatedHeight + 12) {
        top = rect.top - estimatedHeight - 6;
      }

      setCoords({
        top,
        left,
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    updateCoords();
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen]);

  // Cerrar al hacer clic fuera o presionar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
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

  function handleToggleOpen() {
    if (!isOpen) {
      updateCoords();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
    setQuery("");
  }

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Botón selector principal */}
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel || displayLabel}
        aria-expanded={isOpen}
        onClick={handleToggleOpen}
        className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold outline-none focus:outline-none focus:ring-0 focus-visible:outline-none cursor-pointer shadow-xs transition shrink-0 ${isFiltered
          ? "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
          } ${buttonClassName}`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {displayIcon && <span className="text-base shrink-0">{displayIcon}</span>}
          <span className="truncate max-w-[140px] sm:max-w-[180px]">{displayLabel}</span>
        </span>
        <span className="text-slate-400 text-[10px] shrink-0 ml-1">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {/* Menú desplegable renderizado en portal (document.body) para evitar contenerse en divs con backdrop-blur o overflow */}
      {mounted && isOpen && coords &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            className="z-[9999] w-64 sm:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 space-y-1.5 max-h-72 flex flex-col gm-popover-in"
          >
            {/* Buscador superior sin anillo naranja invasivo */}
            <div className="relative shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full px-2.5 py-1.5 pl-8 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 transition"
              />
              <span className="material-symbols-outlined text-sm text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none leading-none">
                search
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
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer ${value === allOption.value || value === "all"
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
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer ${isSelected
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
          </div>,
          document.body
        )}
    </div>
  );
}
