import { redirect } from "next/navigation";
import { countUsers } from "@/lib/auth";
import { SetupAdminForm } from "@/components/auth/SetupAdminForm";
import { GastroMapLogo } from "@/components/ui/GastroMapLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const userCount = await countUsers();
  if (userCount > 0) {
    redirect("/login");
  }
  const t = await getT();

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-[#faf8ff] dark:bg-[#0b1120] relative overflow-hidden transition-colors duration-200">
      <div className="fixed top-4 right-4 z-20 flex items-center gap-2">
        <ThemeToggle />
        <LanguageSelector />
      </div>

      <div className="gm-animate-fade-up w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8">
        <div className="text-center mb-6 space-y-3">
          <div className="flex justify-center">
            <GastroMapLogo iconClassName="w-11 h-11" textClassName="text-2xl" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 text-[10px] font-black uppercase tracking-wider mb-1.5">
              <span className="material-symbols-outlined text-xs leading-none">admin_panel_settings</span>
              <span>Primer Administrador</span>
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              {t("auth.setup_title")}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("auth.setup_subtitle")}
            </p>
          </div>
        </div>

        <SetupAdminForm />
      </div>
    </div>
  );
}
