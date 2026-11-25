"use client";

import { useState, useEffect } from "react";
import { useT } from "@/lib/i18n/client";

interface ScrollToTopProps {
  className?: string;
}

export function ScrollToTop({ className = "" }: ScrollToTopProps) {
  const { t } = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label={t("common.scroll_to_top")}
      title={t("common.scroll_to_top")}
      className={`fixed bottom-[calc(8.25rem+env(safe-area-inset-bottom,0px))] right-4 lg:bottom-6 lg:right-6 z-[940] w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-900 dark:bg-slate-800/80 dark:hover:bg-slate-700/90 text-slate-300 hover:text-white dark:text-slate-200 border border-slate-700/60 dark:border-slate-700/80 shadow-md shadow-black/20 backdrop-blur-md transition-all duration-300 ease-out items-center justify-center cursor-pointer active:scale-90 ${
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-3 pointer-events-none"
      } ${className ? className : "flex"}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
        aria-hidden="true"
      >
        <path d="m18 15-6-6-6 6" />
      </svg>
    </button>
  );
}
