"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { logoutAction } from "@/lib/actions/auth";
import { switchActiveSpaceAction } from "@/lib/actions/groups";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { GastroMapLogo } from "@/components/ui/GastroMapLogo";
import { MOBILE_NAV_EVENTS } from "@/components/layout/MobileBottomNav";
import { clearAppOfflineCache } from "@/lib/cache";
import { useT } from "@/lib/i18n/client";
import type { ActiveWorkspace } from "@/lib/workspace";

const EditProfileModal = dynamic(() =>
  import("./EditProfileModal").then((m) => m.EditProfileModal)
);
const GroupsModal = dynamic(() =>
  import("./GroupsModal").then((m) => m.GroupsModal)
);
const ListsModal = dynamic(() =>
  import("./ListsModal").then((m) => m.ListsModal)
);
const StatsModal = dynamic(() =>
  import("@/components/stats/StatsModal").then((m) => m.StatsModal)
);

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface UserHeaderProps {
  currentUser: {
    id: string;
    username: string | null;
    name: string;
    email: string;
    role: string;
    locale?: string | null;
  };
  workspace?: ActiveWorkspace | null;
}

export function UserHeader({ currentUser, workspace }: UserHeaderProps) {
  const { t } = useT();
  const router = useRouter();
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isGroupsOpen, setIsGroupsOpen] = useState(false);
  const [isListsOpen, setIsListsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSpaceMenuOpen, setIsSpaceMenuOpen] = useState(false);
  const [switchingSpace, setSwitchingSpace] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{
    hasUpdate: boolean;
    latestVersion: string;
    releaseUrl: string;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const spaceMenuRef = useRef<HTMLDivElement>(null);

  // Comprobar si hay nueva versión publicada en GitHub (caché de 30 min en servidor)
  useEffect(() => {
    let active = true;
    fetch("/api/version")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.hasUpdate && data?.latestVersion) {
          setUpdateInfo({
            hasUpdate: true,
            latestVersion: data.latestVersion,
            releaseUrl: data.releaseUrl || "https://github.com/alebupal/GastroMap/releases",
          });
        }
      })
      .catch(() => {
        // Silencioso si no hay conexión
      });
    return () => {
      active = false;
    };
  }, []);

  const displayUsername = currentUser.username || currentUser.name.toLowerCase().replace(/\s+/g, "");

  // Capturar el evento nativo de instalación PWA (solo cuando no está ya instalada)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstallPwa() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
    }
  }

  // Escuchar eventos de la barra inferior móvil (Estadísticas y Menú)
  useEffect(() => {
    function handleOpenStats() {
      setIsStatsOpen(true);
    }
    function handleOpenMenu() {
      setIsMenuOpen((prev) => !prev);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
    window.addEventListener(MOBILE_NAV_EVENTS.OPEN_STATS, handleOpenStats);
    window.addEventListener(MOBILE_NAV_EVENTS.OPEN_MENU, handleOpenMenu);
    return () => {
      window.removeEventListener(MOBILE_NAV_EVENTS.OPEN_STATS, handleOpenStats);
      window.removeEventListener(MOBILE_NAV_EVENTS.OPEN_MENU, handleOpenMenu);
    };
  }, []);

  // Cerrar el menú desplegable al hacer click fuera o pulsar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (spaceMenuRef.current && !spaceMenuRef.current.contains(event.target as Node)) {
        setIsSpaceMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsSpaceMenuOpen(false);
      }
    }
    if (isMenuOpen || isSpaceMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen, isSpaceMenuOpen]);

  async function handleSelectSpace(target: string) {
    setIsSpaceMenuOpen(false);
    setSwitchingSpace(true);
    await switchActiveSpaceAction(target);
    setSwitchingSpace(false);
    router.refresh();
  }

  return (
    <>
      {/* Botón de instalación PWA solo visible en móviles cuando es instalable */}
      {installPrompt && (
        <div className="sm:hidden w-full mb-2">
          <button
            type="button"
            onClick={handleInstallPwa}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/80 dark:border-orange-800/60 text-orange-800 dark:text-orange-200 text-xs font-extrabold shadow-xs cursor-pointer active:scale-[0.99] transition"
            title="Instalar GastroMap como aplicación"
          >
            <span className="material-symbols-outlined text-base leading-none text-orange-600">install_mobile</span>
            <span>Instalar App</span>
          </button>
        </div>
      )}

      <header className="w-full flex items-center justify-between py-2 sm:py-2.5 mb-1.5 lg:mb-4 border-b border-slate-200/60 dark:border-slate-800/80 gap-2 sm:gap-3">
        {/* Brand / Logo + Selector rápido de Espacio / Grupo (v2) */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/" className="flex items-center group shrink-0">
            <GastroMapLogo
              iconClassName="w-8 h-8 sm:w-9 sm:h-9 group-hover:scale-105 transition-transform"
              textClassName="hidden xs:inline sm:inline text-base sm:text-xl"
            />
          </Link>

          {workspace && (
            <div className="relative min-w-0" ref={spaceMenuRef}>
              <button
                type="button"
                disabled={switchingSpace}
                onClick={() => setIsSpaceMenuOpen((prev) => !prev)}
                aria-expanded={isSpaceMenuOpen}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full bg-[#f2f3ff] hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-extrabold text-slate-800 dark:text-slate-100 transition cursor-pointer max-w-[175px] sm:max-w-[240px] shadow-2xs"
                title={t("spaces.switcher_tooltip")}
              >
                <span className="text-sm leading-none shrink-0">
                  {workspace.mode === "group" && workspace.group
                    ? workspace.group.icon
                    : workspace.mode === "all"
                      ? "🌍"
                      : "🏠"}
                </span>
                <span className="truncate">
                  {workspace.mode === "group" && workspace.group
                    ? workspace.group.name
                    : workspace.mode === "all"
                      ? t("spaces.all_my_places")
                      : t("spaces.personal_map")}
                </span>
                {workspace.mode === "group" && workspace.isSpaceAdmin && (
                  <span className="hidden md:inline-flex px-1.5 py-0.5 rounded-full bg-orange-600/15 text-orange-700 dark:text-orange-300 text-[9px] font-black uppercase tracking-wider shrink-0">
                    Admin
                  </span>
                )}
                <span className="material-symbols-outlined text-sm text-slate-400 shrink-0 leading-none">
                  {isSpaceMenuOpen ? "expand_less" : "expand_more"}
                </span>
              </button>

              {isSpaceMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2 space-y-1.5 gm-popover-in">
                  {/* Grupos de amigos */}
                  {workspace.myGroups.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2.5 pt-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                        <span>{t("spaces.my_groups_section")}</span>
                        <span>{workspace.myGroups.length}</span>
                      </div>
                      <div className="max-h-52 overflow-y-auto space-y-0.5">
                        {workspace.myGroups.map((g) => {
                          const isCurrent =
                            workspace.mode === "group" && workspace.groupId === g.id;
                          return (
                            <div
                              key={g.id}
                              className={`flex items-center justify-between gap-1 rounded-xl p-1 ${
                                isCurrent
                                  ? "bg-orange-50 dark:bg-orange-950/40 border border-orange-200/80 dark:border-orange-800/60"
                                  : "hover:bg-[#f2f3ff] dark:hover:bg-slate-800/70"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleSelectSpace(`group:${g.id}`)}
                                className="flex-1 flex items-center gap-2.5 px-2 py-1.5 text-left min-w-0 cursor-pointer"
                              >
                                <span className="text-base leading-none shrink-0">{g.icon}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                                      {g.name}
                                    </span>
                                    {(g.isOwner || g.myRole === "admin") && (
                                      <span className="px-1.5 py-0.5 rounded bg-orange-600/15 text-orange-700 dark:text-orange-300 text-[9px] font-black uppercase">
                                        Admin
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {g.placesCount} {t("places.locales_count")} • {g.membersCount}{" "}
                                    {t("spaces.members_short")}
                                  </div>
                                </div>
                              </button>
                              {(g.isOwner || g.myRole === "admin") && (
                                <Link
                                  href={`/group-admin?groupId=${g.id}`}
                                  onClick={() => setIsSpaceMenuOpen(false)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-white dark:hover:bg-slate-900 transition shrink-0"
                                  title={t("spaces.manage_group_btn")}
                                >
                                  <span className="material-symbols-outlined text-base leading-none">
                                    settings
                                  </span>
                                </Link>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Espacio personal y Vista Todo junto */}
                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => handleSelectSpace("personal")}
                      className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-left transition cursor-pointer ${
                        workspace.mode === "personal"
                          ? "bg-orange-50 dark:bg-orange-950/40 border border-orange-200/80 dark:border-orange-800/60"
                          : "hover:bg-[#f2f3ff] dark:hover:bg-slate-800/70"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base leading-none">🏠</span>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                            {t("spaces.personal_map")}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {t("spaces.personal_subtitle")} ({workspace.personalPlacesCount})
                          </div>
                        </div>
                      </div>
                      {workspace.mode === "personal" && (
                        <span className="material-symbols-outlined text-sm text-orange-600">
                          check
                        </span>
                      )}
                    </button>

                    {workspace.myGroups.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleSelectSpace("all")}
                        className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-left transition cursor-pointer ${
                          workspace.mode === "all"
                            ? "bg-orange-50 dark:bg-orange-950/40 border border-orange-200/80 dark:border-orange-800/60"
                            : "hover:bg-[#f2f3ff] dark:hover:bg-slate-800/70"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base leading-none">🌍</span>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                              {t("spaces.all_my_places")}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {t("spaces.all_my_places_desc")}
                            </div>
                          </div>
                        </div>
                        {workspace.mode === "all" && (
                          <span className="material-symbols-outlined text-sm text-orange-600">
                            check
                          </span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Acciones rápidas de grupo */}
                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1">
                    {workspace.mode === "group" && workspace.group && workspace.isSpaceAdmin && (
                      <Link
                        href={`/group-admin?groupId=${workspace.group.id}`}
                        onClick={() => setIsSpaceMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-xs font-extrabold transition"
                      >
                        <span className="material-symbols-outlined text-base leading-none">
                          tune
                        </span>
                        <span className="truncate">
                          {t("spaces.manage_active_group", { name: workspace.group.name })}
                        </span>
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsSpaceMenuOpen(false);
                        setIsGroupsOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#f2f3ff] dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base text-orange-600 leading-none">
                        group_add
                      </span>
                      <span>{t("spaces.create_or_manage_groups")}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Acceso directo rápido al Panel del Grupo cuando eres Admin del grupo activo */}
          {workspace?.mode === "group" && workspace.group && workspace.isSpaceAdmin && (
            <Link
              href={`/group-admin?groupId=${workspace.group.id}`}
              className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white dark:bg-slate-900 hover:bg-orange-600 hover:text-white border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition shadow-2xs"
              title={t("spaces.manage_group_btn")}
            >
              <span className="material-symbols-outlined text-sm leading-none">tune</span>
              <span>{t("spaces.group_panel_short")}</span>
            </Link>
          )}
        </div>

        {/* User profile pill & controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Botón búsqueda rápida estilo Stitch en móvil */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event(MOBILE_NAV_EVENTS.OPEN_COMMAND_PALETTE));
              }
            }}
            className="lg:hidden w-9 h-9 rounded-full bg-[#f2f3ff] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition cursor-pointer active:scale-95"
            aria-label={t("command_palette.placeholder")}
          >
            <span className="material-symbols-outlined text-[20px] leading-none">search</span>
          </button>

          {/* Aviso de nueva versión disponible estilo TVSpy */}
          {updateInfo?.hasUpdate && (
            <a
              href={updateInfo.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/25 transition shadow-xs animate-pulse"
              title={t("version.update_available_title")}
            >
              <span className="material-symbols-outlined text-sm leading-none">new_releases</span>
              <span>
                {t("version.new_version_available", { version: updateInfo.latestVersion })}
              </span>
            </a>
          )}

          {/* Selector de modo claro / modo oscuro (visible en cabecera en sm+, en móvil dentro del menú) */}
          <div className="hidden sm:flex items-center gap-1.5 sm:gap-2.5">
            <ThemeToggle />
            <LanguageSelector />
          </div>

          {/* Botón Panel Admin */}
          {currentUser.role === "admin" && (
            <Link
              href="/admin"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-600 hover:text-white text-orange-900 dark:text-orange-200 font-bold text-xs border border-orange-200/80 dark:border-orange-800/60 transition shadow-xs group"
              title="Ir al panel de administración"
            >
              <span className="material-symbols-outlined text-sm text-orange-600 group-hover:text-white">admin_panel_settings</span>
              <span>{t("nav.admin")}</span>
            </Link>
          )}

          {/* Menú de Usuario Unificado (Móvil y Escritorio) */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 p-0.5 sm:p-1 sm:pr-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Abrir menú de usuario"
              aria-expanded={isMenuOpen}
            >
              <div className="relative">
                <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-orange-600 sm:bg-orange-100 dark:sm:bg-orange-950/80 text-white sm:text-orange-900 dark:sm:text-orange-200 font-extrabold text-xs flex items-center justify-center shadow-xs sm:border sm:border-orange-200 dark:sm:border-orange-800">
                  {displayUsername.charAt(0).toUpperCase()}
                </div>
                {currentUser.role === "admin" && (
                  <span className="absolute -bottom-1 right-0 px-1 rounded-full bg-slate-900 dark:bg-orange-600 sm:bg-orange-600 text-white text-[8px] leading-tight font-black uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </div>
              <span className="hidden sm:inline material-symbols-outlined text-sm text-slate-400">
                {isMenuOpen ? "expand_less" : "expand_more"}
              </span>
            </button>

            {/* Menú Desplegable Flotante */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 sm:w-64 max-h-[calc(100dvh-6.5rem-env(safe-area-inset-bottom,0px))] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl z-50 p-2 space-y-1 gm-popover-in">
                {/* Cabecera con datos del usuario */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      @{displayUsername}
                    </span>
                    {currentUser.role === "admin" && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-orange-600 text-white uppercase tracking-wider">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {currentUser.email}
                  </p>
                </div>

                {/* Tema e idioma rápidos en móvil dentro del menú */}
                <div className="sm:hidden flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-[#f8f9ff] dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <ThemeToggle />
                  <LanguageSelector />
                </div>

                {/* Opciones del menú */}
                <div className="pt-1 space-y-0.5 text-xs">
                  {/* Aviso de nueva versión en móvil dentro del menú */}
                  {updateInfo?.hasUpdate && (
                    <a
                      href={updateInfo.releaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsMenuOpen(false)}
                      className="md:hidden w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 font-bold transition text-left"
                    >
                      <span className="material-symbols-outlined text-base leading-none text-amber-600">
                        new_releases
                      </span>
                      <span className="truncate">
                        {t("version.new_version_available", { version: updateInfo.latestVersion })}
                      </span>
                    </a>
                  )}

                  {/* Panel Admin (accesible en móvil dentro del menú) */}
                  {currentUser.role === "admin" && (
                    <Link
                      href="/admin"
                      onClick={() => setIsMenuOpen(false)}
                      className="sm:hidden w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-orange-700 dark:text-orange-300 bg-orange-50/70 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/50 font-bold transition text-left"
                    >
                      <span className="material-symbols-outlined text-base leading-none">admin_panel_settings</span>
                      <span>{t("nav.admin")}</span>
                    </Link>
                  )}

                  {/* Mis Listas / Guías compartibles */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsListsOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-[#f2f3ff] dark:hover:bg-slate-800 font-semibold transition cursor-pointer text-left group"
                  >
                    <span className="material-symbols-outlined text-[18px] leading-none text-slate-500 dark:text-slate-400 group-hover:text-orange-600 transition-colors">
                      collections_bookmark
                    </span>
                    <span>{t("lists.menu_label")}</span>
                  </button>

                  {/* Mis Grupos (siempre accesible aquí en móvil y desktop) */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsGroupsOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-[#f2f3ff] dark:hover:bg-slate-800 font-semibold transition cursor-pointer text-left group"
                  >
                    <span className="material-symbols-outlined text-[18px] leading-none text-slate-500 dark:text-slate-400 group-hover:text-orange-600 transition-colors">
                      group
                    </span>
                    <span>{t("nav.my_groups")}</span>
                  </button>

                  {/* Mis Estadísticas y Wrapped */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsStatsOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-[#f2f3ff] dark:hover:bg-slate-800 font-semibold transition cursor-pointer text-left group"
                  >
                    <span className="material-symbols-outlined text-[18px] leading-none text-slate-500 dark:text-slate-400 group-hover:text-orange-600 transition-colors">
                      bar_chart
                    </span>
                    <span>{t("nav.my_stats")}</span>
                  </button>

                  {/* Documentación */}
                  <Link
                    href="/docs"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-[#f2f3ff] dark:hover:bg-slate-800 font-semibold transition cursor-pointer text-left group"
                  >
                    <span className="material-symbols-outlined text-[18px] leading-none text-slate-500 dark:text-slate-400 group-hover:text-orange-600 transition-colors">
                      menu_book
                    </span>
                    <span>{t("nav.documentation")}</span>
                  </Link>

                  {/* Editar perfil */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsEditProfileOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-[#f2f3ff] dark:hover:bg-slate-800 font-semibold transition cursor-pointer text-left group"
                  >
                    <span className="material-symbols-outlined text-[18px] leading-none text-slate-500 dark:text-slate-400 group-hover:text-orange-600 transition-colors">
                      manage_accounts
                    </span>
                    <span>{t("nav.profile")}</span>
                  </button>

                  {/* Limpiar caché offline (Service Worker + teselas de mapa) */}
                  <button
                    type="button"
                    disabled={clearingCache}
                    onClick={async () => {
                      if (!confirm(t("nav.clear_cache_confirm"))) return;
                      setClearingCache(true);
                      await clearAppOfflineCache();
                      window.location.reload();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-[#f2f3ff] dark:hover:bg-slate-800 font-semibold transition cursor-pointer text-left group disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px] leading-none text-slate-500 dark:text-slate-400 group-hover:text-orange-600 transition-colors">
                      cleaning_services
                    </span>
                    <span>{clearingCache ? t("nav.clearing_cache") : t("nav.clear_cache")}</span>
                  </button>
                </div>

                {/* Divisor y botón de cerrar sesión */}
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

      {/* Modales cargados bajo demanda (code-splitting) solo cuando se abren */}
      {isEditProfileOpen && (
        <EditProfileModal
          isOpen={isEditProfileOpen}
          onClose={() => setIsEditProfileOpen(false)}
          currentUser={currentUser}
        />
      )}

      {isListsOpen && (
        <ListsModal
          isOpen={isListsOpen}
          onClose={() => setIsListsOpen(false)}
        />
      )}

      {isGroupsOpen && (
        <GroupsModal
          isOpen={isGroupsOpen}
          onClose={() => setIsGroupsOpen(false)}
          currentUserId={currentUser.id}
        />
      )}

      {isStatsOpen && (
        <StatsModal
          isOpen={isStatsOpen}
          onClose={() => setIsStatsOpen(false)}
          username={displayUsername}
        />
      )}
    </>
  );
}
