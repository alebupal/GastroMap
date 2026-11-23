"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";

type DocTab = "docs" | "changelog" | "readme";

interface DocsViewerProps {
  initialTab?: DocTab;
}

export default function DocsViewer({ initialTab = "docs" }: DocsViewerProps) {
  const [activeTab, setActiveTab] = useState<DocTab>(initialTab);
  const [lang, setLang] = useState<"es" | "en">("es");
  const [content, setContent] = useState<string>("");
  const [filename, setFilename] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

  const handleTabChange = (tab: DocTab) => {
    setActiveTab(tab);
  };

  const handleLangChange = (newLang: "es" | "en") => {
    setLang(newLang);
  };

  // Parser interactivo de Markdown alineado con el estilo TVSPY y la paleta de GastroMap
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
              className="my-3.5 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs overflow-x-auto shadow-inner"
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
            className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-7 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5"
          >
            <span>📖</span>
            <span>{line.replace("# ", "")}</span>
          </h1>
        );
        return;
      }

      // H2 - Versiones o Secciones principales (Estilo TVSPY con badge 🏷️)
      if (line.startsWith("## ")) {
        const title = line.replace("## ", "");
        const isVersion = title.includes("[") || title.toLowerCase().includes("version");
        elements.push(
          <div
            key={idx}
            className="mt-8 mb-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center gap-2.5"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-sm font-black">
              {isVersion ? "🏷️" : "📌"}
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
          </div>
        );
        return;
      }

      // H3 - Subsecciones (Añadido, Fixed, etc.)
      if (line.startsWith("### ")) {
        const title = line.replace("### ", "");
        elements.push(
          <h3
            key={idx}
            className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400 mt-4 mb-2 flex items-center gap-1.5"
          >
            <span>🔹</span>
            <span>{title}</span>
          </h3>
        );
        return;
      }

      // Elementos de lista (viñetas con check verde estilo TVSPY)
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        const itemText = line.trim().replace(/^[-*]\s+/, "");
        const isSubitem = line.startsWith("    ") || line.startsWith("\t");
        elements.push(
          <div
            key={idx}
            className={`flex items-start gap-2 py-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 ${
              isSubitem ? "pl-6 sm:pl-8 text-xs text-slate-500 dark:text-slate-400" : "pl-1 sm:pl-2"
            }`}
          >
            <span className="text-emerald-500 font-bold shrink-0 text-xs mt-0.5">✓</span>
            <span className="leading-relaxed">
              {itemText.split("**").map((part, i) =>
                i % 2 === 1 ? (
                  <b key={i} className="text-slate-900 dark:text-slate-100 font-bold">
                    {part}
                  </b>
                ) : (
                  part
                )
              )}
            </span>
          </div>
        );
        return;
      }

      // Separador horizontal
      if (line.trim() === "---") {
        elements.push(
          <hr
            key={idx}
            className="my-6 border-slate-200 dark:border-slate-800"
          />
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
          {line.split("**").map((part, i) =>
            i % 2 === 1 ? (
              <b key={i} className="text-slate-900 dark:text-slate-100 font-bold">
                {part}
              </b>
            ) : (
              part
            )
          )}
        </p>
      );
    });

    return elements;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 py-2">
      {/* Barra de cabecera con retorno rápido al mapa */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            title="Volver al mapa"
          >
            <span>⬅</span>
            <span>Volver al inicio</span>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="text-amber-500">📚</span>
              <span>Documentación</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Consulta la guía oficial, novedades y cambios del repositorio GastroMap.
            </p>
          </div>
        </div>

        {/* Selector de idioma */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 self-start sm:self-center">
          <button
            type="button"
            onClick={() => handleLangChange("es")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              lang === "es"
                ? "bg-orange-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span>🇪🇸</span>
            <span>Español</span>
          </button>
          <button
            type="button"
            onClick={() => handleLangChange("en")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              lang === "en"
                ? "bg-orange-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span>🇬🇧</span>
            <span>English</span>
          </button>
        </div>
      </div>

      {/* Banner de Donación y Agradecimiento (Estilo TVSPY) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4 text-xs text-slate-700 dark:text-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-lg">
            🎁
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
              ¿Te resulta útil GastroMap?
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Proyecto libre y autohospedado para organizar tus planes gastronómicos. Apoya su mantenimiento y nuevas funciones.
            </p>
          </div>
        </div>

        <a
          href="https://www.paypal.me/alebupal"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 transition whitespace-nowrap self-start sm:self-center shrink-0"
        >
          <span>❤️</span>
          <span>Donar con PayPal</span>
        </a>
      </div>

      {/* Navegación por pestañas (Documentación / Changelog / README) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => handleTabChange("docs")}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer flex items-center gap-2 border ${
              activeTab === "docs"
                ? "bg-orange-600 text-white border-amber-400 shadow-md shadow-orange-600/20"
                : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <span>📘</span>
            <span>Documentación</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("changelog")}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer flex items-center gap-2 border ${
              activeTab === "changelog"
                ? "bg-orange-600 text-white border-amber-400 shadow-md shadow-orange-600/20"
                : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <span>📋</span>
            <span>Changelog / Versiones</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("readme")}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer flex items-center gap-2 border ${
              activeTab === "readme"
                ? "bg-orange-600 text-white border-amber-400 shadow-md shadow-orange-600/20"
                : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <span>📖</span>
            <span>README / Repositorio</span>
          </button>
        </div>

        {filename && (
          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 self-end sm:self-center">
            📄 {filename}
          </span>
        )}
      </div>

      {/* Visor de Documentación */}
      <div className="p-4 sm:p-7 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-2xl">
        {loading ? (
          <div className="py-24 text-center text-slate-400 dark:text-slate-500 space-y-2">
            <div className="inline-block animate-spin text-3xl text-amber-500">⏳</div>
            <div className="text-xs font-semibold">Cargando documentación...</div>
          </div>
        ) : error ? (
          <div className="py-16 text-center space-y-3">
            <div className="text-3xl">⚠️</div>
            <p className="text-sm font-bold text-red-500">{error}</p>
            <button
              type="button"
              onClick={() => loadDocumentation(activeTab, lang)}
              className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {renderMarkdown(content)}
          </div>
        )}
      </div>
    </div>
  );
}
