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
  hasGlobalHeader?: boolean;
}

/**
 * Genera el mismo id slug que GitHub Markdown para que funcionen los enlaces internos (#seccion).
 */
function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function isBadgeOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return /^(?:\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)\s*)+$/.test(trimmed);
}

/**
 * Renderizador inline completo de Markdown:
 * badges enlazados, imágenes, enlaces, código inline, negrita+cursiva, negrita, cursiva y tachado.
 */
function InlineMarkdown({
  text,
  onSwitchLang,
}: {
  text: string;
  onSwitchLang?: (nextLang: "es" | "en") => void;
}) {
  const tokenRegex =
    /(\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)|!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*\n]+)\*|~~([^~]+)~~)/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <React.Fragment key={`t-${keyIdx++}`}>
          {text.slice(lastIndex, match.index)}
        </React.Fragment>
      );
    }

    if (match[2] !== undefined && match[3] && match[4]) {
      // Badge enlazado: [![alt](imgSrc)](href)
      const alt = match[2];
      const imgSrc = match[3];
      const rawHref = match[4];
      const href = /^https?:\/\//i.test(rawHref)
        ? rawHref
        : `https://github.com/alebupal/GastroMap/blob/main/${rawHref.replace(/^\.?\//, "")}`;
      nodes.push(
        <a
          key={`badge-${keyIdx++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center hover:opacity-85 transition"
          title={alt}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgSrc} alt={alt} className="h-5 w-auto rounded-xs" loading="lazy" />
        </a>
      );
    } else if (match[5] !== undefined && match[6]) {
      // Imagen: ![alt](src)
      nodes.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`img-${keyIdx++}`}
          src={match[6]}
          alt={match[5]}
          className="max-w-full rounded-xl my-2 inline-block border border-slate-200/70 dark:border-slate-800"
          loading="lazy"
        />
      );
    } else if (match[7] && match[8]) {
      // Enlace: [label](href)
      const label = match[7];
      const href = match[8].trim();
      if (href.startsWith("#")) {
        nodes.push(
          <a
            key={`anchor-${keyIdx++}`}
            href={href}
            className="text-orange-600 dark:text-orange-400 hover:underline font-semibold"
          >
            <InlineMarkdown text={label} onSwitchLang={onSwitchLang} />
          </a>
        );
      } else if (/^README_ES\.MD$/i.test(href) && onSwitchLang) {
        nodes.push(
          <button
            key={`lang-es-${keyIdx++}`}
            type="button"
            onClick={() => onSwitchLang("es")}
            className="text-orange-600 dark:text-orange-400 hover:underline font-semibold cursor-pointer"
          >
            {label}
          </button>
        );
      } else if (/^README\.MD$/i.test(href) && onSwitchLang) {
        nodes.push(
          <button
            key={`lang-en-${keyIdx++}`}
            type="button"
            onClick={() => onSwitchLang("en")}
            className="text-orange-600 dark:text-orange-400 hover:underline font-semibold cursor-pointer"
          >
            {label}
          </button>
        );
      } else {
        const resolvedHref = /^https?:\/\//i.test(href)
          ? href
          : `https://github.com/alebupal/GastroMap/blob/main/${href.replace(/^\.?\//, "")}`;
        nodes.push(
          <a
            key={`link-${keyIdx++}`}
            href={resolvedHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-600 dark:text-orange-400 hover:underline font-semibold"
          >
            <InlineMarkdown text={label} onSwitchLang={onSwitchLang} />
          </a>
        );
      }
    } else if (match[9] !== undefined) {
      // Código inline: `code`
      nodes.push(
        <code
          key={`code-${keyIdx++}`}
          className="px-1.5 py-0.5 rounded-md bg-[#f2f3ff] dark:bg-slate-800 text-orange-700 dark:text-orange-300 font-mono text-[11px] font-semibold"
        >
          {match[9]}
        </code>
      );
    } else if (match[10] !== undefined) {
      // Negrita + cursiva: ***text***
      nodes.push(
        <strong key={`bi-${keyIdx++}`} className="font-bold italic text-slate-900 dark:text-slate-100">
          <InlineMarkdown text={match[10]} onSwitchLang={onSwitchLang} />
        </strong>
      );
    } else if (match[11] !== undefined) {
      // Negrita: **text**
      nodes.push(
        <strong key={`b-${keyIdx++}`} className="font-bold text-slate-900 dark:text-slate-100">
          <InlineMarkdown text={match[11]} onSwitchLang={onSwitchLang} />
        </strong>
      );
    } else if (match[12] !== undefined) {
      // Cursiva: *text*
      nodes.push(
        <em key={`i-${keyIdx++}`} className="italic text-slate-700 dark:text-slate-200">
          <InlineMarkdown text={match[12]} onSwitchLang={onSwitchLang} />
        </em>
      );
    } else if (match[13] !== undefined) {
      // Tachado: ~~text~~
      nodes.push(
        <del key={`s-${keyIdx++}`} className="line-through text-slate-400">
          <InlineMarkdown text={match[13]} onSwitchLang={onSwitchLang} />
        </del>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <React.Fragment key={`t-${keyIdx++}`}>{text.slice(lastIndex)}</React.Fragment>
    );
  }

  return <>{nodes}</>;
}

export default function DocsViewer({
  initialTab = "docs",
  hasGlobalHeader = false,
}: DocsViewerProps) {
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
      const res = await fetch(`/api/docs/${tab}?lang=${currentLang}`, {
        cache: "no-store",
      });
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
    const lines = text.split(/\r?\n/);
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // 1. Bloques de código ```lang
      if (trimmed.startsWith("```")) {
        const codeLang = trimmed.slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // saltar cierre ```
        elements.push(
          <div
            key={`code-${i}`}
            className="my-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 overflow-hidden shadow-inner"
          >
            {codeLang && (
              <div className="px-4 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                {codeLang}
              </div>
            )}
            <pre className="p-4 font-mono text-xs overflow-x-auto leading-relaxed">
              <code>{codeLines.join("\n")}</code>
            </pre>
          </div>
        );
        continue;
      }

      // 2. Grupo de badges consecutivos (shields.io)
      if (isBadgeOnlyLine(line)) {
        const badgeLines: string[] = [];
        const startIdx = i;
        while (i < lines.length && isBadgeOnlyLine(lines[i])) {
          badgeLines.push(lines[i].trim());
          i++;
        }
        elements.push(
          <div key={`badges-${startIdx}`} className="flex flex-wrap items-center gap-2 my-3">
            {badgeLines.map((bLine, bi) => (
              <InlineMarkdown key={bi} text={bLine} onSwitchLang={setLang} />
            ))}
          </div>
        );
        continue;
      }

      // 3. Tablas Markdown (| a | b |)
      if (
        trimmed.startsWith("|") &&
        i + 1 < lines.length &&
        /^\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1].trim())
      ) {
        const startIdx = i;
        const parseCells = (row: string) =>
          row
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((c) => c.trim());

        const headers = parseCells(lines[i]);
        i += 2; // saltar cabecera y separador
        const bodyRows: string[][] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          bodyRows.push(parseCells(lines[i]));
          i++;
        }

        elements.push(
          <div
            key={`table-${startIdx}`}
            className="my-4 overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800"
          >
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#f8f9ff] dark:bg-slate-800/70">
                <tr>
                  {headers.map((h, hi) => (
                    <th
                      key={hi}
                      className="px-3.5 py-2.5 font-extrabold text-slate-800 dark:text-slate-100 border-b border-slate-200/80 dark:border-slate-700"
                    >
                      <InlineMarkdown text={h} onSwitchLang={setLang} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bodyRows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3.5 py-2 text-slate-600 dark:text-slate-300">
                        <InlineMarkdown text={cell} onSwitchLang={setLang} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      // 4. Encabezados H1 - H4 con id slugificado para enlaces internos
      if (line.startsWith("# ")) {
        const title = line.slice(2).trim();
        elements.push(
          <h1
            key={`h1-${i}`}
            id={slugifyHeading(title)}
            className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2 mb-4 pb-3 border-b border-slate-200/80 dark:border-slate-800 tracking-tight scroll-mt-20"
          >
            <InlineMarkdown text={title} onSwitchLang={setLang} />
          </h1>
        );
        i++;
        continue;
      }

      if (line.startsWith("## ")) {
        const title = line.slice(3).trim();
        const isVersion = title.includes("[") || title.toLowerCase().includes("version");
        elements.push(
          <div
            key={`h2-${i}`}
            id={slugifyHeading(title)}
            className="mt-8 mb-3.5 pt-5 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center gap-2.5 scroll-mt-20"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/60 border border-orange-200/60 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 shrink-0">
              <span className="material-symbols-outlined text-base leading-none">
                {isVersion ? "sell" : "bookmark"}
              </span>
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              <InlineMarkdown text={title} onSwitchLang={setLang} />
            </h2>
          </div>
        );
        i++;
        continue;
      }

      if (line.startsWith("### ")) {
        const title = line.slice(4).trim();
        elements.push(
          <h3
            key={`h3-${i}`}
            id={slugifyHeading(title)}
            className="text-sm sm:text-base font-extrabold text-orange-600 dark:text-orange-400 mt-5 mb-2 flex items-center gap-1.5 scroll-mt-20"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0" />
            <span>
              <InlineMarkdown text={title} onSwitchLang={setLang} />
            </span>
          </h3>
        );
        i++;
        continue;
      }

      if (line.startsWith("#### ")) {
        const title = line.slice(5).trim();
        elements.push(
          <h4
            key={`h4-${i}`}
            id={slugifyHeading(title)}
            className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-4 mb-1.5 scroll-mt-20"
          >
            <InlineMarkdown text={title} onSwitchLang={setLang} />
          </h4>
        );
        i++;
        continue;
      }

      // 5. Citas (> )
      if (trimmed.startsWith("> ")) {
        elements.push(
          <blockquote
            key={`bq-${i}`}
            className="my-3 pl-4 pr-3 py-2.5 rounded-r-2xl border-l-4 border-orange-500 bg-orange-50/70 dark:bg-orange-950/20 text-xs sm:text-sm text-slate-700 dark:text-slate-300"
          >
            <InlineMarkdown text={trimmed.replace(/^>\s+/, "")} onSwitchLang={setLang} />
          </blockquote>
        );
        i++;
        continue;
      }

      // 6. Listas numeradas (1. ...)
      const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (orderedMatch) {
        const indent = orderedMatch[1].length;
        const num = orderedMatch[2];
        const itemText = orderedMatch[3];
        elements.push(
          <div
            key={`ol-${i}`}
            className={`flex items-start gap-2.5 py-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 ${
              indent >= 2 ? "pl-6 sm:pl-8" : "pl-1 sm:pl-2"
            }`}
          >
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-extrabold text-[10px] shrink-0 mt-0.5">
              {num}
            </span>
            <span className="leading-relaxed">
              <InlineMarkdown text={itemText} onSwitchLang={setLang} />
            </span>
          </div>
        );
        i++;
        continue;
      }

      // 7. Listas con viñetas (- o *)
      const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
      if (bulletMatch) {
        const indent = bulletMatch[1].length;
        const itemText = bulletMatch[2];
        const isDeep = indent >= 4;
        const isSub = indent >= 2;
        elements.push(
          <div
            key={`ul-${i}`}
            className={`flex items-start gap-2 py-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 ${
              isDeep
                ? "pl-10 sm:pl-12 text-xs text-slate-500 dark:text-slate-400"
                : isSub
                ? "pl-6 sm:pl-8 text-xs text-slate-500 dark:text-slate-400"
                : "pl-1 sm:pl-2"
            }`}
          >
            <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0 text-xs mt-0.5">
              ✓
            </span>
            <span className="leading-relaxed">
              <InlineMarkdown text={itemText} onSwitchLang={setLang} />
            </span>
          </div>
        );
        i++;
        continue;
      }

      // 8. Separador horizontal
      if (trimmed === "---" || trimmed === "***") {
        elements.push(
          <hr key={`hr-${i}`} className="my-6 border-slate-200/70 dark:border-slate-800" />
        );
        i++;
        continue;
      }

      // 9. Líneas vacías
      if (!trimmed) {
        elements.push(<div key={`sp-${i}`} className="h-1.5" />);
        i++;
        continue;
      }

      // 10. Párrafo estándar
      elements.push(
        <p
          key={`p-${i}`}
          className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 py-0.5 leading-relaxed"
        >
          <InlineMarkdown text={line} onSwitchLang={setLang} />
        </p>
      );
      i++;
    }

    return elements;
  };

  const langSwitcher = (
    <div className="relative grid grid-cols-2 bg-[#f2f3ff] dark:bg-slate-800/80 p-1 rounded-full border border-slate-200/60 dark:border-slate-700/60 shrink-0">
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-orange-600 shadow-xs transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          lang === "es" ? "translate-x-0" : "translate-x-full"
        }`}
      />
      <button
        type="button"
        onClick={() => setLang("es")}
        className={`relative z-10 px-2.5 py-1 rounded-full text-xs font-bold transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1 ${
          lang === "es"
            ? "text-white"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
        }`}
      >
        <span>🇪🇸</span>
        <span className="hidden sm:inline">ES</span>
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`relative z-10 px-2.5 py-1 rounded-full text-xs font-bold transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1 ${
          lang === "en"
            ? "text-white"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
        }`}
      >
        <span>🇬🇧</span>
        <span className="hidden sm:inline">EN</span>
      </button>
    </div>
  );

  return (
    <>
      <div className="max-w-[1720px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 flex-1 flex flex-col gap-5">
        {/* Cabecera pública solo si no se muestra el UserHeader global */}
        {!hasGlobalHeader && (
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
              {langSwitcher}
            </div>
          </header>
        )}

        {/* Tarjeta Hero + Pestañas segmentadas con píldora deslizante estilo StatsModal */}
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

            <div className="flex items-center gap-2 flex-wrap self-start sm:self-center shrink-0">
              {hasGlobalHeader && (
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
                >
                  <span className="material-symbols-outlined text-sm leading-none">arrow_back</span>
                  <span>{t("docs.back_to_explorer")}</span>
                </Link>
              )}
              {hasGlobalHeader && langSwitcher}
              {filename && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-mono font-semibold">
                  <span className="material-symbols-outlined text-sm text-orange-600 leading-none">
                    description
                  </span>
                  <span>{filename}</span>
                </span>
              )}
            </div>
          </div>

          {/* Pestañas segmentadas con píldora deslizante animada */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="relative inline-grid grid-cols-3 p-1 rounded-full bg-[#f2f3ff] dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 w-full sm:w-auto sm:min-w-[380px]">
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-8px)/3)] rounded-full bg-orange-600 shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  activeTab === "docs"
                    ? "translate-x-0"
                    : activeTab === "changelog"
                    ? "translate-x-full"
                    : "translate-x-[200%]"
                }`}
              />

              <button
                type="button"
                onClick={() => setActiveTab("docs")}
                className={`relative z-10 px-2 sm:px-4 py-2 rounded-full text-[11px] sm:text-xs font-bold transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                  activeTab === "docs"
                    ? "text-white"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-sm leading-none">book</span>
                <span className="truncate">{t("docs.user_guide")}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("changelog")}
                className={`relative z-10 px-2 sm:px-4 py-2 rounded-full text-[11px] sm:text-xs font-bold transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                  activeTab === "changelog"
                    ? "text-white"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-sm leading-none">history</span>
                <span className="truncate">Changelog</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("readme")}
                className={`relative z-10 px-2 sm:px-4 py-2 rounded-full text-[11px] sm:text-xs font-bold transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                  activeTab === "readme"
                    ? "text-white"
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
              <span>{t("docs.back_to_explorer")}</span>
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
              <div className="text-xs font-semibold">{t("common.loading")}</div>
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
            <div
              key={`${activeTab}-${lang}`}
              className="space-y-0.5 animate-in fade-in duration-200"
            >
              {renderMarkdown(content)}
            </div>
          )}
        </article>
      </div>

      {/* Pie de página minimalista coherente con toda la web */}
      <footer className="w-full bg-[#f2f3ff] dark:bg-slate-900/60 border-t border-slate-200/60 dark:border-slate-800/60 py-5 mt-8">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
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
              {t("mobile_nav.explore")}
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
              <span>{t("nav.donate")}</span>
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
