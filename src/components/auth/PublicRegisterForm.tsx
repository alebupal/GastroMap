"use client";

import { useState } from "react";
import Link from "next/link";
import { registerPublicAction } from "@/lib/actions/auth";
import { useT } from "@/lib/i18n/client";

interface PublicRegisterFormProps {
  callbackUrl?: string;
}

export function PublicRegisterForm({ callbackUrl }: PublicRegisterFormProps) {
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await registerPublicAction(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  const loginHref = callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/login";

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
          {t("admin_users.name")}
        </label>
        <input
          type="text"
          name="name"
          required
          placeholder="Ej. Laura"
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
          {t("admin_users.username")}
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">@</span>
          <input
            type="text"
            name="username"
            required
            pattern="[A-Za-z0-9_-]+"
            placeholder="laura"
            className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
          {t("admin_users.email")}
        </label>
        <input
          type="email"
          name="email"
          required
          placeholder="tu@email.com"
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            {t("admin_users.password")}
          </label>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            {t("profile.confirm_new_password")}
          </label>
          <input
            type="password"
            name="confirmPassword"
            required
            minLength={8}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm shadow-sm transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
      >
        {loading ? t("auth.registering") : t("auth.register_btn")}
      </button>

      <div className="pt-1 text-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("auth.already_have_account")}{" "}
          <Link
            href={loginHref}
            className="font-bold text-orange-600 dark:text-orange-400 hover:underline"
          >
            {t("auth.sign_in_link")}
          </Link>
        </p>
      </div>
    </form>
  );
}
