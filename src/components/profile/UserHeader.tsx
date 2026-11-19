"use client";

import { useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import { EditProfileModal } from "./EditProfileModal";
import { GroupsModal } from "./GroupsModal";
import { StatsModal } from "@/components/stats/StatsModal";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface UserHeaderProps {
  currentUser: {
    id: string;
    username: string | null;
    name: string;
    email: string;
    role: string;
  };
}

export function UserHeader({ currentUser }: UserHeaderProps) {
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isGroupsOpen, setIsGroupsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  const displayUsername = currentUser.username || currentUser.name.toLowerCase().replace(/\s+/g, "");

  return (
    <>
      <header className="w-full flex items-center justify-between py-2.5 sm:py-3 mb-4 sm:mb-6 border-b border-slate-200 dark:border-slate-800/80 gap-2">
        {/* Brand / Logo */}
        <a href="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-lg sm:text-xl shadow-md shadow-amber-500/20 group-hover:scale-105 transition shrink-0">
            🍽️
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-base sm:text-lg tracking-tight bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 dark:from-amber-400 dark:via-orange-400 dark:to-amber-500 bg-clip-text text-transparent">
                GastroMap
              </span>
              <span className="hidden sm:inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60">
                v0.1.0
              </span>
            </div>
          </div>
        </a>

        {/* User profile pill & controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Selector de modo claro / modo oscuro */}
          <ThemeToggle />

          {/* Mis Grupos Privados */}
          <button
            type="button"
            onClick={() => setIsGroupsOpen(true)}
            className="w-8 h-8 sm:w-auto p-1.5 sm:px-2.5 sm:py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            title="Mis grupos privados"
          >
            <span className="text-sm">👥</span>
            <span className="hidden md:inline text-[11px] font-bold">Grupos</span>
          </button>

          {/* Mis Estadísticas y Wrapped */}
          <button
            type="button"
            onClick={() => setIsStatsOpen(true)}
            className="w-8 h-8 sm:w-auto p-1.5 sm:px-2.5 sm:py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            title="Mis estadísticas y Wrapped"
          >
            <span className="text-sm">📊</span>
            <span className="hidden md:inline text-[11px] font-bold">Stats</span>
          </button>

          {/* Documentación y Changelog estilo TVSPY */}
          <Link
            href="/docs"
            className="w-8 h-8 sm:w-auto p-1.5 sm:px-2.5 sm:py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 transition active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
            title="Documentación y Changelog"
          >
            <span className="text-sm">📚</span>
            <span className="hidden md:inline text-[11px] font-bold">Docs</span>
          </Link>

          {/* Enlaces de comunidad: GitHub y PayPal */}
          <div className="hidden sm:flex items-center gap-1.5 mr-1">
            <a
              href="https://github.com/alebupal/GastroMap"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Repositorio GitHub"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
            <a
              href="https://www.paypal.me/alebupal"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/20 transition"
              title="Donar con PayPal"
            >
              <span>❤️</span>
              <span className="hidden md:inline">Donar</span>
            </a>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 p-1 pl-1.5 sm:pl-2 pr-1.5 sm:pr-3 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs dark:shadow-none transition shrink-0">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-black shrink-0">
              {displayUsername.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[100px]">@{displayUsername}</span>
                {currentUser.role === "admin" && (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500 text-white dark:text-slate-950 uppercase tracking-wider">
                    ADMIN
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                {currentUser.email}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsEditProfileOpen(true)}
              className="p-1 text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer text-xs"
              title="Editar mi perfil"
            >
              ⚙️
            </button>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition cursor-pointer active:scale-95 flex items-center gap-1 shrink-0"
              title="Cerrar sesión"
            >
              <span className="sm:hidden text-xs">🚪</span>
              <span className="hidden sm:inline">Salir</span>
            </button>
          </form>
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
