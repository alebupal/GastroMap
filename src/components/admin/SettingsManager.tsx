"use client";

import { useState } from "react";
import { saveSettingAction } from "@/lib/actions/settings";
import { useT } from "@/lib/i18n/client";

interface SettingsManagerProps {
  initialCartoApiKey?: string | null;
}

export function SettingsManager({ initialCartoApiKey = "" }: SettingsManagerProps) {
  const [cartoApiKey, setCartoApiKey] = useState(initialCartoApiKey || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await saveSettingAction("carto_api_key", cartoApiKey);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const { t } = useT();

  return (
    <div className="space-y-4">
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">⚙️</span>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {t("admin.settings.title")}
            </h3>
            <p className="text-xs text-slate-400">
              {t("admin.settings.subtitle")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          {isOpen ? t("common.collapse") : t("common.manage")}
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSave} className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t("admin.settings.carto_label")}
            </label>
            <input
              type="text"
              value={cartoApiKey}
              onChange={(e) => setCartoApiKey(e.target.value)}
              placeholder={t("admin.settings.carto_placeholder")}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              {t("admin.settings.carto_hint")}
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              {saved && t("admin.settings.saved")}
            </span>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {saving ? t("common.saving") : t("admin.settings.save_btn")}
            </button>
          </div>
        </form>
      )}
    </div>

    {/* Copia de seguridad */}
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 shadow-xs flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5">
        <span className="text-xl">💾</span>
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t("admin.backup.title")}</h3>
          <p className="text-xs text-slate-400">{t("admin.backup.desc")}</p>
        </div>
      </div>
      <a
        href="/api/admin/backup"
        download
        className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs shadow-xs hover:opacity-90 transition"
      >
        ⬇️ {t("admin.backup.button")}
      </a>
    </div>
    </div>
  );
}
