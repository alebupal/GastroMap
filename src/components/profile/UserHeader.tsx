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
      <div className="w-full flex items-center justify-between py-2 mb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-lg font-bold border border-amber-500/20">
            {displayUsername.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span className="font-bold text-amber-600 dark:text-amber-400">
                @{displayUsername}
              </span>
              {currentUser.role === "admin" && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  ADMIN
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400">{currentUser.email}</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsEditProfileOpen(true)}
            className="text-xs text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 font-semibold transition cursor-pointer flex items-center gap-1"
            title="Editar mi perfil"
          >
            <span>⚙️</span>
            <span>Mi perfil</span>
          </button>

          <span className="text-slate-200 dark:text-slate-800">•</span>

          <form action={logoutAction}>
            <button
              type="submit"
              className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 font-medium transition cursor-pointer"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        currentUser={currentUser}
      />
    </>
  );
}
