"use client";

import { useState } from "react";
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
  cartoApiKey?: string | null;
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
  cartoApiKey,
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

  const displayUsername =
    currentUser.username || currentUser.name.toLowerCase().replace(/\s+/g, "");
  const initials = (currentUser.name || displayUsername)
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
            <span>Ver Explorador</span>
          </Link>
        </nav>
      </div>

      {/* Tarjeta de usuario y Cerrar Sesión */}
      <div className="rounded-2xl bg-white dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800 p-3 shadow-xs space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-900 dark:text-orange-200 font-bold text-xs flex items-center justify-center shrink-0 border border-orange-200/80 dark:border-orange-800/60">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
              {displayUsername}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
              Super Admin
            </div>
          </div>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full py-1.5 px-3 rounded-xl bg-rose-100/80 hover:bg-rose-200/90 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-[11px] transition cursor-pointer"
          >
            {t("nav.logout")}
          </button>
        </form>
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
              <ThemeToggle />
              <LanguageSelector />
              <div className="hidden sm:flex items-center gap-1.5 pl-1">
                <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-900 dark:text-orange-200 font-bold text-xs flex items-center justify-center border border-orange-200 dark:border-orange-800">
                  {displayUsername.charAt(0).toUpperCase()}
                </div>
                <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-800 dark:text-orange-300 text-[10px] font-black uppercase tracking-wider">
                  ADMIN
                </span>
              </div>
            </div>
        </header>

        {/* Contenido activo */}
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {activeTab === "stats" && <AdminStatsPanel />}

          {activeTab === "places" && (
            <div className="space-y-5">
              {/* Cabecera de sección Tabla Sitios estilo Stitch */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/60 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl">storefront</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                        {t("admin.title")}
                      </h1>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                        {allPlaces.length} sitios
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {t("admin.subtitle")}
                    </p>
                  </div>
                </div>

                <Link
                  href="/new"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition shrink-0"
                >
                  <span className="material-symbols-outlined text-base leading-none">add_location_alt</span>
                  <span>Nuevo Sitio</span>
                </Link>
              </div>

              <PlacesTableManager places={allPlaces} occasionsList={initialOccasions} />
            </div>
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
              initialCartoApiKey={cartoApiKey}
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
