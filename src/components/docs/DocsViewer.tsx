"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { GastroMapIcon, GastroMapLogo } from "@/components/ui/GastroMapLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useT } from "@/lib/i18n/client";
import { APP_VERSION } from "@/lib/version";

type DocTab = "docs" | "changelog" | "readme";

interface DocsViewerProps {
  initialTab?: DocTab;
}

/**
 * Formatea negrita (**texto**) y código inline (`codigo`) dentro de un párrafo o elemento de lista.
 */
function InlineMarkdown({ text }: { text: string }) {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {tokens.map((part, i) => {
        if (!part) return null;
        if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
          return (
            <strong key={i} className="text-slate-900 dark:text-slate-100 font-bold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 rounded-md bg-[#f2f3ff] dark:bg-slate-800 text-orange-700 dark:text-orange-300 font-mono text-[11px] font-semibold"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

export default function DocsViewer({ initialTab = "docs" }: DocsViewerProps) {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<DocTab>(initialTab);
  const [lang, setLang] = useState<"es" | "en">("es");
  const [content, setContent] = useState<string>("");
  const [filename, setFilename] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocumentation = async (tab: DocTab, currentLang: "es" | "en") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/docs/${tab}?lang=${currentLang}`);
      if (!res.ok) {
        throw new Error(`No se pudo cargar la documentación (${res.statusText})`);
      }
      const data = await res.json();
      setContent(data.content || "");
      setFilename(data.filename || "");
    } catch (err) {
      setError((err as Error).message || "Error al cargar el documento");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocumentation(activeTab, lang);
  }, [activeTab, lang]);

  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    let inCodeBlock = false;
    let codeBuffer: string[] = [];

    const elements: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      // Bloques de código ```
      if (line.startsWith("```")) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBuffer = [];
        } else {
          inCodeBlock = false;
          elements.push(
            <div
              key={`code-${idx}`}
              className="my-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs overflow-x-auto shadow-inner"
            >
              <pre>{codeBuffer.join("\n")}</pre>
            </div>
          );
        }
        return;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        return;
      }

      // H1
      if (line.startsWith("# ")) {
        elements.push(
          <h1
            key={idx}
            className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2 mb-4 pb-3 border-b border-slate-200/80 dark:border-slate-800 tracking-tight"
          >
            {line.replace("# ", "")}
          </h1>
        );
        return;
      }

      // H2
      if (line.startsWith("## ")) {
        const title = line.replace("## ", "");
        const isVersion = title.includes("[") || title.toLowerCase().includes("version");
        elements.push(
          <div
            key={idx}
            className="mt-8 mb-3.5 pt-5 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center gap-2.5"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/60 border border-orange-200/60 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 shrink-0">
              <span className="material-symbols-outlined text-base leading-none">
                {isVersion ? "sell" : "bookmark"}
              </span>
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              {title}
            </h2>
          </div>
        );
        return;
      }

      // H3
      if (line.startsWith("### ")) {
        const title = line.replace("### ", "");
        elements.push(
          <h3
            key={idx}
            className="text-sm sm:text-base font-extrabold text-orange-600 dark:text-orange-400 mt-5 mb-2 flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0" />
            <span>{title}</span>
          </h3>
        );
        return;
      }

      // Citas (> )
      if (line.trim().startsWith("> ")) {
        elements.push(
          <blockquote
            key={idx}
            className="my-3 pl-4 pr-3 py-2.5 rounded-r-2xl border-l-4 border-orange-500 bg-orange-50/70 dark:bg-orange-950/20 text-xs sm:text-sm text-slate-700 dark:text-slate-300"
          >
            <InlineMarkdown text={line.trim().replace(/^>\s+/, "")} />
          </blockquote>
        );
        return;
      }

      // Elementos de lista
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        const itemText = line.trim().replace(/^[-*]\s+/, "");
        const isSubitem = line.startsWith("  ") || line.startsWith("\t");
        elements.push(
          <div
            key={idx}
            className={`flex items-start gap-2 py-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 ${isSubitem ? "pl-6 sm:pl-8 text-xs text-slate-500 dark:text-slate-400" : "pl-1 sm:pl-2"
              }`}
          >
            <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0 text-xs mt-0.5">
              ✓
            </span>
            <span className="leading-relaxed">
              <InlineMarkdown text={itemText} />
            </span>
          </div>
        );
        return;
      }

      // Separador horizontal
      if (line.trim() === "---") {
        elements.push(
          <hr key={idx} className="my-6 border-slate-200/70 dark:border-slate-800" />
        );
        return;
      }

      // Líneas vacías
      if (!line.trim()) {
        elements.push(<div key={idx} className="h-1.5" />);
        return;
      }

      // Párrafo estándar
      elements.push(
        <p
          key={idx}
          className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 py-0.5 leading-relaxed"
        >
          <InlineMarkdown text={line} />
        </p>
      );
    });

    return elements;
  };

  return (
    <>
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 flex-1 flex flex-col gap-5">
        {/* Cabecera superior unificada estilo DESIGN.md */}
        <header className="w-full flex items-center justify-between py-2 border-b border-slate-200/60 dark:border-slate-800/80 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center group shrink-0">
              <GastroMapLogo
                iconClassName="w-8 h-8 sm:w-9 sm:h-9 group-hover:scale-105 transition-transform"
                textClassName="text-lg sm:text-xl"
              />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition shrink-0"
              aria-label={t("docs.back_to_explorer")}
            >
              <span className="material-symbols-outlined text-sm leading-none">arrow_back</span>
              <span className="hidden sm:inline">{t("docs.back_to_explorer")}</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />

            {/* Selector de idioma del documento */}
            <div className="flex items-center gap-0.5 bg-[#f2f3ff] dark:bg-slate-800/80 p-1 rounded-full border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setLang("es")}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1 ${lang === "es"
                    ? "bg-orange-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
              >
                <span>🇪🇸</span>
                <span className="hidden sm:inline">ES</span>
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1 ${lang === "en"
                    ? "bg-orange-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
              >
                <span>🇬🇧</span>
                <span className="hidden sm:inline">EN</span>
              </button>
            </div>
          </div>
        </header>

        {/* Tarjeta Hero + Pestañas segmentadas */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/60 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">menu_book</span>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  {t("docs.center_title")}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("docs.center_subtitle")}
                </p>
              </div>
            </div>

            {filename && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-mono font-semibold self-start sm:self-center shrink-0">
                <span className="material-symbols-outlined text-sm text-orange-600 leading-none">
                  description
                </span>
                <span>{filename}</span>
              </span>
            )}
          </div>

          {/* Pestañas segmentadas estilo DESIGN.md */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="inline-grid grid-cols-3 p-1 rounded-full bg-[#f2f3ff] dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab("docs")}
                className={`px-2 sm:px-4 py-2 rounded-full text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${activeTab === "docs"
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
              >
                <span className="material-symbols-outlined text-sm leading-none">book</span>
                <span className="truncate">{t("docs.user_guide")}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("changelog")}
                className={`px-2 sm:px-4 py-2 rounded-full text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${activeTab === "changelog"
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
              >
                <span className="material-symbols-outlined text-sm leading-none">history</span>
                <span className="truncate">Changelog</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("readme")}
                className={`px-4 py-2 rounded-full text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === "readme"
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
              >
                <span className="material-symbols-outlined text-sm leading-none">code</span>
                <span>README</span>
              </button>
            </div>

            <Link
              href="/"
              className="sm:hidden inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold"
            >
              <span className="material-symbols-outlined text-sm leading-none">arrow_back</span>
              <span>Volver al explorador</span>
            </Link>
          </div>
        </section>

        {/* Visor de Documentación */}
        <article className="p-5 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-xs">
          {loading ? (
            <div className="py-24 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <span className="material-symbols-outlined text-4xl text-orange-600 animate-spin inline-block">
                progress_activity
              </span>
              <div className="text-xs font-semibold">Cargando documentación...</div>
            </div>
          ) : error ? (
            <div className="py-16 text-center space-y-3">
              <span className="material-symbols-outlined text-4xl text-rose-500">error</span>
              <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{error}</p>
              <button
                type="button"
                onClick={() => loadDocumentation(activeTab, lang)}
                className="px-5 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <div className="space-y-0.5">{renderMarkdown(content)}</div>
          )}
        </article>
      </div>

      {/* Pie de página minimalista coherente con toda la web */}
      <footer className="w-full bg-[#f2f3ff] dark:bg-slate-900/60 border-t border-slate-200/60 dark:border-slate-800/60 py-5 mt-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <GastroMapIcon className="w-5 h-5 shrink-0 shadow-xs rounded-[28%]" />
            <span className="font-bold text-slate-900 dark:text-slate-100">
              Gastro<span className="text-[#ea580c]">Map</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400">
              v{APP_VERSION}
            </span>
          </div>

          <div className="flex items-center gap-4 font-semibold flex-wrap justify-center">
            <Link href="/" className="hover:text-orange-600 transition">
              Explorador
            </Link>
            <a
              href="https://github.com/alebupal/GastroMap"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-600 transition"
            >
              GitHub
            </a>
            <a
              href="https://www.paypal.me/alebupal"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-600 hover:text-white hover:border-rose-600 font-bold transition shadow-xs group"
            >
              <span className="material-symbols-outlined text-sm leading-none group-hover:text-white">
                favorite
              </span>
              <span>Donar</span>
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
