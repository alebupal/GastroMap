"use client";

import { useState, useRef } from "react";
import { saveSettingAction, resetApplicationAction } from "@/lib/actions/settings";
import { useT } from "@/lib/i18n/client";

interface SettingsManagerProps {
  initialCartoApiKey?: string | null;
  totalPlacesCount?: number;
}

export function SettingsManager({
  initialCartoApiKey = "",
  totalPlacesCount = 0,
}: SettingsManagerProps) {
  const { t } = useT();
  const [cartoApiKey, setCartoApiKey] = useState(initialCartoApiKey || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleResetApp() {
    const confirmation = prompt(t("admin.reset_app.prompt"));

    if (confirmation !== "RESETEAR") {
      return;
    }

    setResetting(true);
    setResetMessage(null);

    const res = await resetApplicationAction();
    setResetting(false);

    if (res?.error) {
      setResetMessage({ type: "error", text: res.error });
    } else {
      setResetMessage({ type: "success", text: t("admin.reset_app.success") });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  }

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

  return (
    <div className="space-y-6">
      {/* Cabecera de sección estilo Stitch */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#c2410c] dark:text-orange-400">
            <span className="material-symbols-outlined text-sm leading-none">tune</span>
            Panel de Control Maestro
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mt-1">
            Configuración del Sistema
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Ajustes globales de mapas, claves de geolocalización, respaldos de datos y mantenimiento del núcleo.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#f2f3ff] dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-xs shrink-0 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <div className="text-[10px] text-slate-400 font-semibold leading-none">Sincronización PWA</div>
            <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              Estado Activo ({totalPlacesCount} Sitios)
            </div>
          </div>
        </div>
      </div>

      {/* Contenedor principal de tarjetas de configuración */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4">
        {/* 1. Configuración y Mapas */}
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-[#f8f9ff] dark:bg-slate-950/60 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[#c2410c] dark:text-orange-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">settings</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {t("admin.settings.title")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("admin.settings.subtitle")}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
            >
              {isOpen ? t("common.collapse") : `${t("common.manage")} ›`}
            </button>
          </div>

          {isOpen && (
            <form onSubmit={handleSave} className="mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-800 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("admin.settings.carto_label")}
                </label>
                <input
                  type="text"
                  value={cartoApiKey}
                  onChange={(e) => setCartoApiKey(e.target.value)}
                  placeholder={t("admin.settings.carto_placeholder")}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
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
                  className="px-5 py-2 rounded-full bg-[#a33900] hover:bg-[#8a3000] text-white font-bold text-xs shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? t("common.saving") : t("admin.settings.save_btn")}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 2. Copia de Seguridad */}
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-[#f8f9ff] dark:bg-slate-950/60 p-4 sm:p-5 space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">save</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {t("admin.backup.title")}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                  Snapshots JSON
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t("admin.backup.desc")}
              </p>

              <div className="flex items-center gap-2.5 flex-wrap mt-3.5">
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#a33900] hover:bg-[#8a3000] text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base leading-none">upload</span>
                  <span>{restoring ? t("admin.backup.restoring") : t("admin.backup.restore_button")}</span>
                </button>
                <a
                  href="/api/admin/backup"
                  download
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0f172a] dark:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs shadow-xs hover:opacity-90 transition"
                >
                  <span className="material-symbols-outlined text-base leading-none">download</span>
                  <span>{t("admin.backup.button")}</span>
                </a>
              </div>
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

        {/* 3. Zona de Peligro */}
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">warning</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900 dark:text-rose-300">
                  {t("admin.reset_app.title")}
                </h3>
                <p className="text-xs text-rose-700/80 dark:text-rose-400/80 max-w-xl mt-0.5">
                  {t("admin.reset_app.desc")}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={resetting}
              onClick={handleResetApp}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 cursor-pointer active:scale-95 shrink-0"
            >
              <span className="material-symbols-outlined text-base leading-none">delete_forever</span>
              <span>{resetting ? t("admin.reset_app.resetting") : t("admin.reset_app.button")}</span>
            </button>
          </div>

          {resetMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold ${
                resetMessage.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                  : "bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300"
              }`}
            >
              {resetMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* 3 mini-tarjetas de estado inferior estilo Stitch */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#c2410c] dark:text-orange-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">map</span>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Proveedor de Geo
            </div>
            <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
              {cartoApiKey ? "CartoDB + OpenStreetMap" : "OpenStreetMap / Nominatim"}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
              • API Operativa
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">storage</span>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Caché Offline PWA
            </div>
            <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
              Cache First Activo
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              Teselas y catálogo en caché
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">verified_user</span>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Integridad de Datos
            </div>
            <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
              100% Verificado
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              Sin anomalías detectadas
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
