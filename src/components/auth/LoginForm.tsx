"use client";

import { useState } from "react";
import { loginAction } from "@/lib/actions/auth";
import { useT } from "@/lib/i18n/client";

export function LoginForm() {
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await loginAction(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
          <span className="material-symbols-outlined text-base shrink-0">error</span>
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {t("auth.email")}
        </label>
        <div className="relative">
          <span className="material-symbols-outlined text-lg text-slate-400 absolute left-3.5 top-3 pointer-events-none">
            person
          </span>
          <input
            type="text"
            name="identifier"
            required
            autoComplete="username"
            placeholder="usuario o tu@email.com"
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-[#f8f9ff] dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {t("auth.password")}
        </label>
        <div className="relative">
          <span className="material-symbols-outlined text-lg text-slate-400 absolute left-3.5 top-3 pointer-events-none">
            lock
          </span>
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full pl-11 pr-11 py-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-[#f8f9ff] dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-2.5 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            <span className="material-symbols-outlined text-lg leading-none">
              {showPassword ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="group w-full mt-2 py-3.5 px-5 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-sm shadow-md shadow-orange-600/25 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="material-symbols-outlined text-lg leading-none animate-spin">
              progress_activity
            </span>
            <span>{t("auth.loading")}</span>
          </>
        ) : (
          <>
            <span>{t("auth.enter")}</span>
            <span className="material-symbols-outlined text-lg leading-none group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </>
        )}
      </button>
    </form>
  );
}
