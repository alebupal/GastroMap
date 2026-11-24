"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import { UsersManager } from "./UsersManager";
import { TaxonomyManager } from "./TaxonomyManager";
import { InviteManager } from "@/components/InviteManager";
import { SettingsManager } from "./SettingsManager";
import { DemoPlacesSeeder } from "./DemoPlacesSeeder";
import { PlacesTableManager } from "./PlacesTableManager";
import { AuditLogViewer } from "./AuditLogViewer";
import { AdminStatsPanel } from "./AdminStatsPanel";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { GastroMapIcon, GastroMapLogo } from "@/components/ui/GastroMapLogo";
import { APP_VERSION } from "@/lib/version";
import { useT } from "@/lib/i18n/client";
import type { Occasion } from "@/db/schema";
import type { PlaceWithDetails } from "@/lib/actions/places";

type AdminTab =
  | "stats"
  | "places"
  | "users"
  | "taxonomy"
  | "invites"
  | "audit"
  | "settings"
  | "demo";

const VALID_TABS: AdminTab[] = [
  "stats",
  "places",
  "users",
  "taxonomy",
  "invites",
  "audit",
  "settings",
  "demo",
];

interface AdminDashboardProps {
  initialOccasions: Array<Occasion & { placesCount: number }>;
  initialTags: { id: string; name: string; placesCount: number }[];
  allPlaces?: PlaceWithDetails[];
  googlePlacesApiKey?: string | null;
  currentUser: {
    id: string;
    username: string | null;
    name: string;
    email: string;
    role: string;
  };
  initialTab?: string;
}

export function AdminDashboard({
  initialOccasions,
  initialTags,
  allPlaces = [],
  googlePlacesApiKey,
  currentUser,
  initialTab,
}: AdminDashboardProps) {
  const { t } = useT();
  const resolvedInitialTab: AdminTab =
    initialTab && VALID_TABS.includes(initialTab as AdminTab)
      ? (initialTab as AdminTab)
      : "places";

  const [activeTab, setActiveTab] = useState<AdminTab>(resolvedInitialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUserMenuOpen]);

  const displayUsername =
    currentUser.username || currentUser.name.toLowerCase().replace(/\s+/g, "");

  function selectTab(tab: AdminTab) {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  }

  const navItems: Array<{
    id: AdminTab;
    label: string;
    icon: string;
    badge?: number;
  }> = [
      { id: "stats", label: t("admin.tab_stats").replace(/^[^\p{L}\p{N}]+/u, ""), icon: "bar_chart" },
      {
        id: "places",
        label: t("admin.tab_places", { count: allPlaces.length })
          .replace(/^[^\p{L}\p{N}]+/u, "")
          .replace(/\s*\(\d+\)\s*$/, ""),
        icon: "storefront",
        badge: allPlaces.length,
      },
      { id: "users", label: t("admin.tab_users").replace(/^[^\p{L}\p{N}]+/u, ""), icon: "group" },
      { id: "taxonomy", label: t("admin.tab_taxonomy").replace(/^[^\p{L}\p{N}]+/u, ""), icon: "sell" },
      { id: "invites", label: t("admin.tab_invites").replace(/^[^\p{L}\p{N}]+/u, ""), icon: "confirmation_number" },
      { id: "audit", label: t("admin.tab_audit").replace(/^[^\p{L}\p{N}]+/u, ""), icon: "receipt_long" },
      { id: "settings", label: t("admin.tab_settings").replace(/^[^\p{L}\p{N}]+/u, ""), icon: "settings" },
      { id: "demo", label: t("admin.tab_demo").replace(/^[^\p{L}\p{N}]+/u, ""), icon: "science" },
    ];

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between p-4 gap-4">
      <div className="space-y-6">
        {/* Marca + insignia Admin */}
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          <Link href="/" className="flex items-center gap-2 group">
            <GastroMapLogo iconClassName="w-8 h-8" textClassName="text-base" />
            <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-800 dark:text-orange-300 text-[10px] font-bold tracking-wide">
              Admin
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Cerrar menú"
          >
            <span className="material-symbols-outlined text-lg leading-none">close</span>
          </button>
        </div>

        {/* Navegación principal */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs transition cursor-pointer ${active
                  ? "bg-orange-600 text-white font-bold shadow-sm shadow-orange-900/20"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800/70 font-medium"
                  }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`material-symbols-outlined text-[18px] leading-none shrink-0 ${active ? "text-white" : "text-slate-500 dark:text-slate-400"
                      }`}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.badge === "number" && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${active
                      ? "bg-white/20 text-white"
                      : "bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300"
                      }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="my-3 border-t border-slate-200/80 dark:border-slate-800" />

          <Link
            href="/"
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 transition"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">map</span>
            <span>{t("ui.view_explorer")}</span>
          </Link>
        </nav>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#faf8ff] dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar escritorio */}
      <aside className="hidden lg:block w-64 shrink-0 bg-[#f2f3ff] dark:bg-slate-900/90 border-r border-slate-200/70 dark:border-slate-800/80 sticky top-0 h-screen overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Sidebar móvil (drawer) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[82vw] h-full bg-[#f2f3ff] dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Columna principal */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Cabecera superior estilo Stitch */}
        <header className="sticky top-0 z-30 bg-[#faf8ff]/90 dark:bg-[#0b1120]/90 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800/80 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
              aria-label="Abrir navegación de administración"
            >
              <span className="material-symbols-outlined text-lg leading-none">menu</span>
            </button>

            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
              {navItems.find((item) => item.id === activeTab)?.label || t("admin.title")}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <ThemeToggle />
              <LanguageSelector />
            </div>

            {/* Menú desplegable de usuario en el header (igual que en la app principal) */}
            <div className="relative shrink-0" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-1.5 p-1 pl-1 pr-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                aria-label="Abrir menú de usuario"
                aria-expanded={isUserMenuOpen}
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-900 dark:text-orange-200 font-bold text-xs flex items-center justify-center shadow-xs border border-orange-200 dark:border-orange-800">
                    {displayUsername.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-orange-600 text-white text-[8px] leading-tight font-black uppercase tracking-wider">
                    Admin
                  </span>
                </div>
                <span className="material-symbols-outlined text-sm text-slate-400">
                  {isUserMenuOpen ? "expand_less" : "expand_more"}
                </span>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 sm:w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        @{displayUsername}
                      </span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-orange-600 text-white uppercase tracking-wider">
                        ADMIN
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {currentUser.email}
                    </p>
                  </div>

                  <div className="sm:hidden flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-[#f8f9ff] dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <ThemeToggle />
                    <LanguageSelector />
                  </div>

                  <div className="pt-1 space-y-0.5 text-xs">
                    <Link
                      href="/"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-[#f2f3ff] dark:hover:bg-slate-800 font-semibold transition text-left group"
                    >
                      <span className="material-symbols-outlined text-[18px] leading-none text-slate-500 dark:text-slate-400 group-hover:text-orange-600 transition-colors">
                        map
                      </span>
                      <span>{t("ui.view_explorer")}</span>
                    </Link>

                    <Link
                      href="/docs"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-[#f2f3ff] dark:hover:bg-slate-800 font-semibold transition text-left group"
                    >
                      <span className="material-symbols-outlined text-[18px] leading-none text-slate-500 dark:text-slate-400 group-hover:text-orange-600 transition-colors">
                        menu_book
                      </span>
                      <span>{t("nav.documentation")}</span>
                    </Link>
                  </div>

                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                    <form action={logoutAction}>
                      <button
                        type="submit"
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold transition cursor-pointer text-left text-xs"
                      >
                        <span className="material-symbols-outlined text-[18px] leading-none">
                          logout
                        </span>
                        <span>{t("nav.logout")}</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Contenido activo */}
        <main
          key={activeTab}
          className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 gm-tab-in"
        >
          {activeTab === "stats" && <AdminStatsPanel />}

          {activeTab === "places" && (
            <PlacesTableManager places={allPlaces} occasionsList={initialOccasions} />
          )}

          {activeTab === "users" && <UsersManager currentUserId={currentUser.id} />}

          {activeTab === "taxonomy" && (
            <div className="space-y-5">
              <TaxonomyManager
                key="occasions"
                section="occasions"
                initialOccasions={initialOccasions}
                initialTags={initialTags}
              />
              <TaxonomyManager
                key="tags"
                section="tags"
                initialOccasions={initialOccasions}
                initialTags={initialTags}
              />
            </div>
          )}

          {activeTab === "invites" && <InviteManager />}

          {activeTab === "audit" && <AuditLogViewer />}

          {activeTab === "settings" && (
            <SettingsManager
              initialGooglePlacesApiKey={googlePlacesApiKey}
              totalPlacesCount={allPlaces.length}
            />
          )}

          {activeTab === "demo" && (
            <DemoPlacesSeeder
              totalPlacesCount={allPlaces.length}
              totalOccasionsCount={initialOccasions.length}
              totalTagsCount={initialTags.length}
            />
          )}
        </main>

        {/* Footer estilo Stitch */}
        <footer className="w-full border-t border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 py-4 px-4 sm:px-6 lg:px-8 mt-auto">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <GastroMapIcon className="w-5 h-5 rounded-[28%] shrink-0" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Gastro<span className="text-[#ea580c]">Map</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                v{APP_VERSION}
              </span>
            </div>
            <div className="flex items-center gap-4 font-semibold flex-wrap justify-center">
              <Link href="/docs" className="hover:text-orange-600 transition">{t("nav.documentation")}</Link>
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
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 font-bold transition"
              >
                <span className="material-symbols-outlined text-sm leading-none">favorite</span>
                <span>{t("nav.donate")}</span>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
