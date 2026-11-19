"use client";

import { useState, useRef } from "react";
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await saveSettingAction("carto_api_key", cartoApiKey);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(t("admin.backup.restore_confirm"))) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setRestoring(true);
    setRestoreMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setRestoreMessage({
          type: "error",
          text: data.error || t("admin.backup.restore_error"),
        });
      } else {
        setRestoreMessage({
          type: "success",
          text: t("admin.backup.restore_success"),
        });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch {
      setRestoreMessage({
        type: "error",
        text: t("admin.backup.restore_error"),
      });
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">💾</span>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {t("admin.backup.title")}
            </h3>
            <p className="text-xs text-slate-400">
              {t("admin.backup.desc")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleRestoreFile}
            accept=".json,application/json"
            className="hidden"
          />
          <button
            type="button"
            disabled={restoring}
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {restoring ? t("admin.backup.restoring") : `⬆️ ${t("admin.backup.restore_button")}`}
          </button>
          <a
            href="/api/admin/backup"
            download
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs shadow-xs hover:opacity-90 transition"
          >
            ⬇️ {t("admin.backup.button")}
          </a>
        </div>
      </div>

      {restoreMessage && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold ${
            restoreMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300"
          }`}
        >
          {restoreMessage.text}
        </div>
      )}
    </div>
    </div>
  );
}
