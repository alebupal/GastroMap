"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import { EditProfileModal } from "./EditProfileModal";
import { GroupsModal } from "./GroupsModal";
import { StatsModal } from "@/components/stats/StatsModal";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { GastroMapLogo } from "@/components/ui/GastroMapLogo";
import { useT } from "@/lib/i18n/client";

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
}

export function UserHeader({ currentUser }: UserHeaderProps) {
  const { t } = useT();
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isGroupsOpen, setIsGroupsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Cerrar el menú desplegable al hacer click fuera o pulsar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <>
      {/* Botón de instalación PWA solo visible en móviles cuando es instalable */}
      {installPrompt && (
        <div className="sm:hidden w-full mb-2 flex justify-end">
          <button
            type="button"
            onClick={handleInstallPwa}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-950/50 border border-orange-200/80 dark:border-orange-800/60 text-orange-800 dark:text-orange-200 text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition"
            title="Instalar GastroMap como aplicación"
          >
            <span className="material-symbols-outlined text-sm leading-none text-orange-600">install_mobile</span>
            <span>Instalar App</span>
          </button>
        </div>
      )}

      <header className="w-full flex items-center justify-between py-2 sm:py-2.5 mb-3 sm:mb-4 border-b border-slate-200/60 dark:border-slate-800/80 gap-3">
        {/* Brand / Logo + Pill Explorar Mapa */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <Link href="/" className="flex items-center group shrink-0">
            <GastroMapLogo
              iconClassName="w-8 h-8 sm:w-9 sm:h-9 group-hover:scale-105 transition-transform"
              textClassName="text-lg sm:text-xl"
            />
          </Link>
          <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full bg-orange-600 text-white font-bold text-xs shadow-xs">
            Explorar Mapa
          </span>
        </div>

        {/* User profile pill & controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Selector de modo claro / modo oscuro */}
          <ThemeToggle />

          {/* Selector de idioma */}
          <LanguageSelector />

          {/* Botón Donar */}
          <a
            href="https://www.paypal.me/alebupal"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-orange-600 hover:text-white font-semibold text-xs transition shadow-xs"
            title={t("nav.donate_paypal")}
          >
            <span className="material-symbols-outlined text-sm text-rose-500">favorite</span>
            <span>{t("nav.donate")}</span>
          </a>

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
              className="flex items-center gap-1.5 p-1 pl-1 pr-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Abrir menú de usuario"
              aria-expanded={isMenuOpen}
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-900 dark:text-orange-200 font-bold text-xs flex items-center justify-center shadow-xs border border-orange-200 dark:border-orange-800">
                  {displayUsername.charAt(0).toUpperCase()}
                </div>
                {currentUser.role === "admin" && (
                  <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-orange-600 text-white text-[8px] leading-tight font-black uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </div>
              <span className="material-symbols-outlined text-sm text-slate-400">
                {isMenuOpen ? "expand_less" : "expand_more"}
              </span>
            </button>

            {/* Menú Desplegable Flotante */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 sm:w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                {/* Cabecera con datos del usuario */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      @{displayUsername}
                    </span>
                    {currentUser.role === "admin" && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 uppercase tracking-wider">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {currentUser.email}
                  </p>
                </div>

                {/* Opciones del menú */}
                <div className="pt-1 space-y-0.5 text-xs">
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

                  {/* Mis Grupos (siempre accesible aquí en móvil y desktop) */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsGroupsOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition cursor-pointer text-left"
                  >
                    <span className="text-base">👥</span>
                    <span>{t("nav.my_groups")}</span>
                  </button>

                  {/* Mis Estadísticas y Wrapped */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsStatsOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition cursor-pointer text-left"
                  >
                    <span className="text-base">📊</span>
                    <span>{t("nav.my_stats")}</span>
                  </button>

                  {/* Documentación */}
                  <Link
                    href="/docs"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition cursor-pointer text-left"
                  >
                    <span className="text-base">📘</span>
                    <span>{t("nav.documentation")}</span>
                  </Link>

                  {/* Editar perfil */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsEditProfileOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition cursor-pointer text-left"
                  >
                    <span className="text-base">⚙️</span>
                    <span>{t("nav.profile")}</span>
                  </button>

                  {/* Enlace de donación en móvil */}
                  <a
                    href="https://www.paypal.me/alebupal"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMenuOpen(false)}
                    className="md:hidden w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium transition text-left"
                  >
                    <span className="text-base">❤️</span>
                    <span>{t("nav.donate_paypal")}</span>
                  </a>
                </div>

                {/* Divisor y botón de cerrar sesión */}
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-semibold transition cursor-pointer text-left text-xs"
                    >
                      <span className="text-base">🚪</span>
                      <span>{t("nav.logout")}</span>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modal interactivo para edición de perfil */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        currentUser={currentUser}
      />

      {/* Modal de gestión de grupos privados */}
      <GroupsModal
        isOpen={isGroupsOpen}
        onClose={() => setIsGroupsOpen(false)}
        currentUserId={currentUser.id}
      />

      {/* Modal de estadísticas personales y Wrapped */}
      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        username={displayUsername}
      />
    </>
  );
}
