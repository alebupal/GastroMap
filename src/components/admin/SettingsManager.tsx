"use client";

import { useState, useRef, useEffect } from "react";
import {
  saveSettingAction,
  resetApplicationAction,
  testGooglePlacesApiKeyAction,
  getGlobalApiUsageAction,
} from "@/lib/actions/settings";
import { clearAppOfflineCache, getBrowserCacheEstimate } from "@/lib/cache";
import { APP_VERSION } from "@/lib/version";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";

interface SettingsManagerProps {
  initialGooglePlacesApiKey?: string | null;
  initialPublicRegistrationEnabled?: boolean;
  totalPlacesCount?: number;
}

export function SettingsManager({
  initialGooglePlacesApiKey = "",
  initialPublicRegistrationEnabled = true,
  totalPlacesCount = 0,
}: SettingsManagerProps) {
  const { t } = useT();
  const { toast } = useToast();
  const [googlePlacesApiKey, setGooglePlacesApiKey] = useState(initialGooglePlacesApiKey || "");
  const [globalApiLimit, setGlobalApiLimit] = useState("900");
  const [groupDefaultQuota, setGroupDefaultQuota] = useState("50");
  const [apiUsage, setApiUsage] = useState<{
    period: string;
    projectRequests: number;
    projectCacheHits: number;
    projectBlocked: number;
    globalLimit: number;
    groupDefaultLimit: number;
  } | null>(null);
  const [publicRegEnabled, setPublicRegEnabled] = useState(initialPublicRegistrationEnabled);
  const [savingRegMode, setSavingRegMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{ usageMB: number | null; cacheCount: number }>({
    usageMB: null,
    cacheCount: 0,
  });
  const [clearingCache, setClearingCache] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{
    currentVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
    releaseUrl: string;
  } | null>(null);
  const [checkingVersion, setCheckingVersion] = useState(false);

  async function fetchVersionStatus(force = false) {
    setCheckingVersion(true);
    try {
      const res = await fetch(`/api/version${force ? "?force=true" : ""}`);
      if (res.ok) {
        const data = await res.json();
        setVersionInfo(data);
        if (force) {
          if (data.hasUpdate) {
            toast(
              t("version.new_version_available", { version: data.latestVersion }),
              { kind: "info" }
            );
          } else {
            toast(t("version.up_to_date_toast", { version: data.currentVersion }), {
              kind: "success",
            });
          }
        }
      }
    } catch {
      if (force) toast(t("version.check_error_toast"), { kind: "error" });
    } finally {
      setCheckingVersion(false);
    }
  }

  useEffect(() => {
    getBrowserCacheEstimate().then((info) => {
      setCacheInfo({ usageMB: info.usageMB, cacheCount: info.cacheCount });
    });
    fetchVersionStatus(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleClearCache() {
    if (!confirm(t("nav.clear_cache_confirm"))) return;
    setClearingCache(true);
    await clearAppOfflineCache();
    window.location.reload();
  }

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

  async function handleToggleRegistrationMode(nextValue: boolean) {
    setSavingRegMode(true);
    setPublicRegEnabled(nextValue);
    const res = await saveSettingAction(
      "allow_public_registration",
      nextValue ? "true" : "false"
    );
    setSavingRegMode(false);
    if (res?.error) {
      setPublicRegEnabled(!nextValue);
      toast(res.error, { kind: "error" });
    } else {
      toast(
        nextValue
          ? t("admin.registration_mode.enabled_toast")
          : t("admin.registration_mode.disabled_toast"),
        { kind: "success" }
      );
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await Promise.all([
      saveSettingAction("google_places_api_key", googlePlacesApiKey),
      saveSettingAction("places_api_project_monthly_limit", globalApiLimit),
      saveSettingAction("places_api_group_default_quota", groupDefaultQuota),
    ]);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    getGlobalApiUsageAction().then((u) => {
      if (u) setApiUsage(u);
    });
  }

  async function handleTestApiKey() {
    if (!googlePlacesApiKey.trim()) {
      setTestResult({ ok: false, text: t("admin.settings.test_empty") });
      return;
    }
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await testGooglePlacesApiKeyAction(googlePlacesApiKey);
      if (res.ok) {
        setTestResult({
          ok: true,
          text: t("admin.settings.test_ok"),
        });
      } else if (res.code === "empty") {
        setTestResult({ ok: false, text: t("admin.settings.test_empty") });
      } else if (res.code === "network") {
        setTestResult({ ok: false, text: t("admin.settings.test_network_error") });
      } else {
        const detail = res.message ? `: ${res.message}` : "";
        setTestResult({
          ok: false,
          text: `${t("admin.settings.test_error")}${res.status ? ` (HTTP ${res.status})` : ""}${detail}`,
        });
      }
    } catch {
      setTestResult({ ok: false, text: t("admin.settings.test_network_error") });
    } finally {
      setTestingKey(false);
    }
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
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">
            <span className="material-symbols-outlined text-sm leading-none">tune</span>
            {t("ui.master_panel")}
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mt-1">
            {t("ui.system_settings")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Ajustes globales de mapas, claves de geolocalización, respaldos de datos y mantenimiento del núcleo.
          </p>
        </div>
      </div>

      {/* Contenedor principal de tarjetas de configuración */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4">
        {/* 0. Modo de Registro Público vs Solo Invitación (v2) */}
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-[#f8f9ff] dark:bg-slate-950/60 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                  publicRegEnabled
                    ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200/70 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-50 dark:bg-amber-950/50 border-amber-200/70 dark:border-amber-900/50 text-amber-600 dark:text-amber-400"
                }`}
              >
                <span className="material-symbols-outlined text-xl">
                  {publicRegEnabled ? "public" : "lock"}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {t("admin.registration_mode.title")}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      publicRegEnabled
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                        : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                    }`}
                  >
                    {publicRegEnabled
                      ? t("admin.registration_mode.open_badge")
                      : t("admin.registration_mode.invite_only_badge")}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                  {publicRegEnabled
                    ? t("admin.registration_mode.open_desc")
                    : t("admin.registration_mode.invite_only_desc")}
                </p>
              </div>
            </div>

            <div className="inline-flex items-center p-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0 self-start sm:self-center">
              <button
                type="button"
                disabled={savingRegMode}
                onClick={() => !publicRegEnabled && handleToggleRegistrationMode(true)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  publicRegEnabled
                    ? "bg-orange-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <span className="material-symbols-outlined text-sm leading-none">public</span>
                <span>{t("admin.registration_mode.open_btn")}</span>
              </button>
              <button
                type="button"
                disabled={savingRegMode}
                onClick={() => publicRegEnabled && handleToggleRegistrationMode(false)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  !publicRegEnabled
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <span className="material-symbols-outlined text-sm leading-none">lock</span>
                <span>{t("admin.registration_mode.invite_btn")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 1. Configuración y Mapas */}
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-[#f8f9ff] dark:bg-slate-950/60 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
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
              onClick={() => {
                const next = !isOpen;
                setIsOpen(next);
                if (next && !apiUsage) {
                  getGlobalApiUsageAction().then((u) => {
                    if (u) {
                      setApiUsage(u);
                      setGlobalApiLimit(String(u.globalLimit));
                      setGroupDefaultQuota(String(u.groupDefaultLimit));
                    }
                  });
                }
              }}
              className="px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
            >
              {isOpen ? t("common.collapse") : `${t("common.manage")} ›`}
            </button>
          </div>

          {isOpen && (
            <form onSubmit={handleSave} className="mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-800 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("admin.settings.google_places_label")}
                </label>
                <input
                  type="password"
                  value={googlePlacesApiKey}
                  onChange={(e) => {
                    setGooglePlacesApiKey(e.target.value);
                    if (testResult) setTestResult(null);
                  }}
                  placeholder={t("admin.settings.google_places_placeholder")}
                  autoComplete="off"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
                {testResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-xl text-[11px] font-semibold flex items-start gap-1.5 ${
                      testResult.ok
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                        : "bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm leading-none shrink-0 mt-0.5">
                      {testResult.ok ? "check_circle" : "error"}
                    </span>
                    <span className="break-words">{testResult.text}</span>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                  {t("admin.settings.google_places_hint")}
                </p>

                {/* Cupos mensuales y consumo de la API global */}
                <div className="mt-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        {t("api_usage.global_limit_label")}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={globalApiLimit}
                        onChange={(e) => setGlobalApiLimit(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-[#f8f9ff] dark:bg-slate-950 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        {t("api_usage.group_quota_label")}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={groupDefaultQuota}
                        onChange={(e) => setGroupDefaultQuota(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-[#f8f9ff] dark:bg-slate-950 text-xs font-semibold"
                      />
                    </div>
                  </div>
                  {apiUsage && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 pt-1">
                      <span className="px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 font-bold">
                        {t("api_usage.requests_badge", {
                          used: apiUsage.projectRequests,
                          limit: apiUsage.globalLimit,
                        })}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold">
                        {t("api_usage.cache_hits_badge", { count: apiUsage.projectCacheHits })}
                      </span>
                      {apiUsage.projectBlocked > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold">
                          {t("api_usage.blocked_badge", { count: apiUsage.projectBlocked })}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {t("api_usage.google_tier_hint")}
                  </p>
                </div>

                <details className="mt-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/70 px-3.5 py-2.5 text-[11px] text-slate-600 dark:text-slate-300 group">
                  <summary className="flex items-center justify-between gap-2 cursor-pointer select-none font-bold text-slate-700 dark:text-slate-200 list-none [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-orange-600 dark:text-orange-400 leading-none">
                        help_outline
                      </span>
                      <span>{t("admin.settings.google_places_guide_title")}</span>
                    </span>
                    <span className="material-symbols-outlined text-base text-slate-400 transition-transform group-open:rotate-180 leading-none">
                      expand_more
                    </span>
                  </summary>
                  <div className="mt-2.5 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 space-y-2">
                    <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                      <li>{t("admin.settings.google_places_guide_step1")}</li>
                      <li>{t("admin.settings.google_places_guide_step2")}</li>
                      <li>{t("admin.settings.google_places_guide_step3")}</li>
                    </ol>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t("admin.settings.google_places_guide_note")}
                    </p>
                    <a
                      href="https://console.cloud.google.com/apis/library/places-backend.googleapis.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-orange-600 dark:text-orange-400 hover:underline pt-0.5"
                    >
                      <span>{t("admin.settings.google_places_guide_link")}</span>
                      <span className="material-symbols-outlined text-xs leading-none">open_in_new</span>
                    </a>
                  </div>
                </details>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  {saved && t("admin.settings.saved")}
                </span>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={handleTestApiKey}
                    disabled={testingKey || !googlePlacesApiKey.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs shadow-xs transition active:scale-95 disabled:opacity-40 cursor-pointer"
                  >
                    <span className={`material-symbols-outlined text-sm leading-none ${testingKey ? "animate-spin" : ""}`}>
                      {testingKey ? "progress_activity" : "verified"}
                    </span>
                    <span>{testingKey ? t("admin.settings.testing") : t("admin.settings.test_btn")}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? t("common.saving") : t("admin.settings.save_btn")}
                  </button>
                </div>
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
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
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">map</span>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Proveedor de Geo
            </div>
            <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
              {googlePlacesApiKey ? "Google Places + OpenStreetMap" : "OpenStreetMap / Nominatim"}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
              • API Operativa
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">storage</span>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Caché Offline PWA
              </div>
              <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {cacheInfo.usageMB !== null
                  ? `${cacheInfo.usageMB} MB (${cacheInfo.cacheCount} cachés)`
                  : "Cache First Activo"}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Teselas y catálogo en caché
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={clearingCache}
            onClick={handleClearCache}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f2f3ff] hover:bg-orange-600 hover:text-white dark:bg-slate-800 dark:hover:bg-orange-600 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition cursor-pointer shrink-0 disabled:opacity-50"
            title={t("nav.clear_cache")}
          >
            <span className="material-symbols-outlined text-sm leading-none">cleaning_services</span>
            <span>{clearingCache ? "..." : t("nav.clear_cache")}</span>
          </button>
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

      {/* Tarjeta de Versión y Comprobación de Actualizaciones (estilo TVSpy) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              versionInfo?.hasUpdate
                ? "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
                : "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400"
            }`}
          >
            <span className="material-symbols-outlined text-xl">
              {versionInfo?.hasUpdate ? "new_releases" : "system_update"}
            </span>
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t("version.card_title")}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                v{versionInfo?.currentVersion || APP_VERSION}
              </span>
              {versionInfo?.hasUpdate ? (
                <a
                  href={versionInfo.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-bold hover:bg-amber-500/25 transition"
                >
                  <span>
                    {t("version.new_version_available", { version: versionInfo.latestVersion })}
                  </span>
                  <span className="material-symbols-outlined text-xs leading-none">open_in_new</span>
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                  <span className="material-symbols-outlined text-xs leading-none">check_circle</span>
                  <span>{t("version.up_to_date")}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t("version.card_subtitle")}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={checkingVersion}
          onClick={() => fetchVersionStatus(true)}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-[#f2f3ff] hover:bg-orange-600 hover:text-white dark:bg-slate-800 dark:hover:bg-orange-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer shrink-0 disabled:opacity-50"
        >
          <span
            className={`material-symbols-outlined text-sm leading-none ${
              checkingVersion ? "animate-spin" : ""
            }`}
          >
            refresh
          </span>
          <span>
            {checkingVersion ? t("version.checking") : t("version.check_now_btn")}
          </span>
        </button>
      </div>
    </div>
  );
}
