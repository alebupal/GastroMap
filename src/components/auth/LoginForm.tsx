"use client";

import { useState } from "react";
import Link from "next/link";
import { loginAction } from "@/lib/actions/auth";
import { useT } from "@/lib/i18n/client";

interface LoginFormProps {
  callbackUrl?: string;
  publicRegistrationEnabled?: boolean;
}

export function LoginForm({
  callbackUrl,
  publicRegistrationEnabled = true,
}: LoginFormProps) {
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const registerHref = callbackUrl
    ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/register";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
          {t("auth.email")}
        </label>
        <input
          type="text"
          name="identifier"
          required
          placeholder={t("auth.identifier_placeholder")}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
          {t("auth.password")}
        </label>
        <input
          type="password"
          name="password"
          required
          placeholder="••••••••"
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm shadow-sm transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
      >
        {loading ? t("auth.loading") : t("auth.enter")}
      </button>

      {publicRegistrationEnabled && (
        <div className="pt-2 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("auth.no_account_prompt")}{" "}
            <Link
              href={registerHref}
              className="font-bold text-orange-600 dark:text-orange-400 hover:underline"
            >
              {t("auth.create_account_link")}
            </Link>
          </p>
        </div>
      )}
    </form>
  );
}
