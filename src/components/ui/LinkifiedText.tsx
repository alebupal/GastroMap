"use client";

import React from "react";

interface LinkifiedTextProps {
  text: string;
  className?: string;
  linkClassName?: string;
}

// Regex que detecta URLs (https?://, www.) y markdown [label](url)
const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<>"')]+|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/gi;

/**
 * Convierte URLs en texto plano o markdown a enlaces interactivos <a>
 * Soporta formateo especial de títulos para enlaces de Instagram o TikTok.
 */
export function LinkifiedText({
  text,
  className = "",
  linkClassName = "",
}: LinkifiedTextProps) {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(URL_REGEX);

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    const fullMatch = match[0];
    const mdLabel = match[2];
    const mdUrl = match[3];

    let href = "";
    let displayText = "";

    if (mdLabel && mdUrl) {
      href = mdUrl;
      displayText = mdLabel;
    } else {
      let cleanUrl = fullMatch;
      let trailingPunct = "";
      while (/[.,;:!?)'"]$/.test(cleanUrl)) {
        trailingPunct = cleanUrl.slice(-1) + trailingPunct;
        cleanUrl = cleanUrl.slice(0, -1);
      }
      href = cleanUrl.startsWith("www.") ? `https://${cleanUrl}` : cleanUrl;
      displayText = cleanUrl;

      if (/instagram\.com\/(?:p|reel|stories)\//i.test(cleanUrl)) {
        displayText = "📸 Instagram ↗";
      } else if (/tiktok\.com\//i.test(cleanUrl)) {
        displayText = "🎵 TikTok ↗";
      }

      parts.push(
        <a
          key={matchIndex}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`font-semibold underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors break-all ${linkClassName}`}
          title={href}
        >
          {displayText}
        </a>
      );
      if (trailingPunct) {
        parts.push(trailingPunct);
      }
      lastIndex = regex.lastIndex;
      continue;
    }

    parts.push(
      <a
        key={matchIndex}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`font-semibold underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors break-all ${linkClassName}`}
        title={href}
      >
        {displayText}
      </a>
    );

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className={className}>{parts}</span>;
}

/**
 * Función auxiliar para convertir URLs a enlaces en cadenas HTML (por ejemplo, para popups de Leaflet).
 */
export function linkifyHtml(rawHtml: string): string {
  if (!rawHtml) return "";
  return rawHtml.replace(
    /(https?:\/\/[^\s<>"')]+)/gi,
    (url) => {
      let cleanUrl = url;
      let trailing = "";
      while (/[.,;:!?)'"]$/.test(cleanUrl)) {
        trailing = cleanUrl.slice(-1) + trailing;
        cleanUrl = cleanUrl.slice(0, -1);
      }
      let label = cleanUrl;
      if (/instagram\.com\/(?:p|reel|stories)\//i.test(cleanUrl)) {
        label = "📸 Instagram ↗";
      } else if (/tiktok\.com\//i.test(cleanUrl)) {
        label = "🎵 TikTok ↗";
      }
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">${label}</a>${trailing}`;
    }
  );
}
