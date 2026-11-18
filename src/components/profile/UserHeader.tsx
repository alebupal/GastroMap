"use client";

import { useState } from "react";
import { logoutAction } from "@/lib/actions/auth";
import { EditProfileModal } from "./EditProfileModal";

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

  const displayUsername = currentUser.username || currentUser.name.toLowerCase().replace(/\s+/g, "");

  return (
    <>
      <header className="w-full flex items-center justify-between py-3 mb-6 border-b border-slate-800/80">
        {/* Brand / Logo */}
        <a href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-xl shadow-md shadow-amber-500/20 group-hover:scale-105 transition">
            🍽️
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg tracking-tight bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                GastroMap
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-800/90 text-slate-400 border border-slate-700/60">
                v0.1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Gestor Gastronómico Privado
            </p>
          </div>
        </a>

        {/* User profile pill */}
        <div className="flex items-center gap-2">
          {/* Enlaces de comunidad: GitHub y PayPal */}
          <div className="hidden sm:flex items-center gap-1.5 mr-1">
            <a
              href="https://github.com/alebupal/GastroMap"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
              title="Repositorio GitHub"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </a>
            <a
              href="https://www.paypal.me/alebupal"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition"
              title="Donar con PayPal"
            >
              <span>❤️</span>
              <span className="hidden md:inline">Donar</span>
            </a>
          </div>

          <div className="flex items-center gap-2.5 p-1 pl-2 pr-3 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center text-xs font-black">
              {displayUsername.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-200">@{displayUsername}</span>
                {currentUser.role === "admin" && (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 uppercase tracking-wider">
                    ADMIN
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 truncate max-w-[120px] hidden sm:block">
                {currentUser.email}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsEditProfileOpen(true)}
              className="ml-1 p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title="Editar mi perfil"
            >
              ⚙️
            </button>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="p-2 rounded-2xl text-slate-400 hover:text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-900/40 transition cursor-pointer text-sm"
              title="Cerrar sesión"
            >
              🚪
            </button>
          </form>
        </div>
      </header>

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        currentUser={currentUser}
      />
    </>
  );
}
