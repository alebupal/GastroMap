"use client";

import { useState } from "react";
import { setupAdminAction } from "@/lib/actions/auth";

export function SetupAdminForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await setupAdminAction(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
          Nombre completo
        </label>
        <input
          type="text"
          name="name"
          required
          placeholder="Ej. Alejandro Bueno"
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
          Nombre de usuario (@username único)
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">@</span>
          <input
            type="text"
            name="username"
            required
            pattern="[A-Za-z0-9_-]+"
            placeholder="alebupal"
            className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Tu identificador público para firmar sitios y recomendaciones.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
          Correo Electrónico
        </label>
        <input
          type="email"
          name="email"
          required
          placeholder="tu@email.com"
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
          Contraseña (mínimo 8 caracteres)
        </label>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          placeholder="••••••••"
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
          Confirmar Contraseña
        </label>
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          placeholder="••••••••"
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-sm transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
      >
        {loading ? "Creando administrador..." : "Crear Administrador y Comenzar"}
      </button>
    </form>
  );
}
