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
                v0.2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Gestor Gastronómico Privado
            </p>
          </div>
        </a>

        {/* User profile pill */}
        <div className="flex items-center gap-2">
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
