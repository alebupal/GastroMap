"use client";

import { useState, useEffect } from "react";
import { updateMyProfileAction } from "@/lib/actions/users";
import { useT } from "@/lib/i18n/client";
import { useSwipeToClose, SheetHandle } from "@/components/ui/BottomSheet";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import type { Locale } from "@/lib/i18n/config";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
    username?: string | null;
    name: string;
    email: string;
    locale?: string | null;
  };
}

export function EditProfileModal({
  isOpen,
  onClose,
  currentUser,
}: EditProfileModalProps) {
  const { t, locale: currentContextLocale } = useT();
  const sheet = useSwipeToClose(onClose);
  const [username, setUsername] = useState(currentUser.username || "");
  const [name, setName] = useState(currentUser.name || "");
  const [email, setEmail] = useState(currentUser.email || "");
  const [userLocale, setUserLocale] = useState(currentUser.locale || currentContextLocale || "es");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    const result = await updateMyProfileAction(formData);

    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(t("profile.success"));
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1000);
    }
  }

  return (
    <div
      style={sheet.backdropStyle}
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm gm-backdrop-in text-left"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheet.sheetRef}
        style={sheet.sheetStyle}
        {...sheet.sheetHandlers}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[94dvh] sm:max-h-[90dvh] overflow-hidden gm-modal-in"
      >
        <SheetHandle {...sheet.handleHandlers} />
        {/* Cabecera estilo DESIGN.md */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/60 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">manage_accounts</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 tracking-tight">
                {t("profile.title")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("profile.subtitle")}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#f2f3ff] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label={t("common.close")}
          >
            <span className="material-symbols-outlined text-lg leading-none">close</span>
          </button>
        </div>

        <form id="edit-profile-form" onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base shrink-0">check_circle</span>
              <span>{success}</span>
            </div>
          )}

          {/* Nombre de usuario (@username) */}
          <div className="space-y-1">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("profile.username_label")}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs text-orange-600 dark:text-orange-400 font-black select-none">
                @
              </span>
              <input
                type="text"
                name="username"
                required
                minLength={3}
                maxLength={50}
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value
                      .toLowerCase()
                      .replace(/^@/, "")
                      .replace(/[^a-z0-9_-]/g, "")
                  )
                }
                placeholder="tu_usuario"
                className="w-full pl-8 pr-4 py-2.5 rounded-2xl text-base sm:text-xs bg-[#f8f9ff] dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 font-extrabold text-orange-700 dark:text-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition"
              />
            </div>
            <p className="text-[10px] text-slate-400">{t("profile.username_hint")}</p>
          </div>

          {/* Nombre completo */}
          <div className="space-y-1">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("profile.name_label")}
            </label>
            <input
              type="text"
              name="name"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl text-base sm:text-xs bg-[#f8f9ff] dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 font-semibold transition"
            />
          </div>

          {/* Correo electrónico */}
          <div className="space-y-1">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("profile.email_label")}
            </label>
            <input
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl text-base sm:text-xs bg-[#f8f9ff] dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 font-medium transition"
            />
          </div>

          {/* Idioma preferido */}
          <div className="space-y-1">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("common.language")}
            </label>
            <LanguageSelector
              name="locale"
              value={(userLocale as Locale) || "es"}
              onChange={(next) => setUserLocale(next)}
              fullWidth
            />
          </div>

          {/* Sección de cambio de contraseña */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowPasswordFields(!showPasswordFields)}
              className="group text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 inline-flex items-center gap-1.5 cursor-pointer transition"
            >
              <span className="material-symbols-outlined text-base leading-none">key</span>
              <span className="group-hover:underline underline-offset-2">
                {t("profile.change_password")}
              </span>
              <span className="material-symbols-outlined text-sm leading-none">
                {showPasswordFields ? "expand_less" : "expand_more"}
              </span>
            </button>

            {showPasswordFields && (
              <div className="mt-3 space-y-2.5 p-3.5 rounded-2xl bg-[#f8f9ff] dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {t("profile.current_password")}
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={t("profile.current_password")}
                    className="w-full px-3.5 py-2 rounded-xl text-base sm:text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {t("profile.new_password")}
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t("profile.new_password_hint")}
                    className="w-full px-3.5 py-2 rounded-xl text-base sm:text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {t("profile.confirm_password")}
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t("profile.confirm_password")}
                    className="w-full px-3.5 py-2 rounded-xl text-base sm:text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  />
                </div>
              </div>
            )}
          </div>
        </form>

        <div className="px-4 sm:px-6 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:py-3.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-full text-xs font-bold bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            form="edit-profile-form"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-extrabold bg-orange-600 hover:bg-orange-700 text-white transition cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm leading-none">save</span>
            <span>{saving ? t("common.loading") : t("form.save_changes")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
