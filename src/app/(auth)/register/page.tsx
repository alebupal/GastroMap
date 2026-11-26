import { redirect } from "next/navigation";
import Link from "next/link";
import { countUsers, getCurrentUser } from "@/lib/auth";
import { isPublicRegistrationEnabled } from "@/lib/actions/settings";
import { PublicRegisterForm } from "@/components/auth/PublicRegisterForm";
import { GastroMapIcon, GastroMapLogo } from "@/components/ui/GastroMapLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { APP_VERSION } from "@/lib/version";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const userCount = await countUsers();
  if (userCount === 0) {
    redirect("/setup");
  }

  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect("/");
  }

  const [t, publicRegistrationEnabled, resolvedParams] = await Promise.all([
    getT(),
    isPublicRegistrationEnabled(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  const callbackUrl = resolvedParams?.callbackUrl;

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden transition-colors duration-200">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-orange-400/20 dark:bg-orange-600/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-amber-400/20 dark:bg-amber-600/10 blur-3xl"
      />

      <div className="fixed top-4 right-4 z-20 flex items-center gap-2">
        <ThemeToggle />
        <LanguageSelector />
      </div>

      <div className="gm-animate-fade-up relative z-10 w-full max-w-4xl rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Panel izquierdo visual */}
        <div className="hidden lg:flex lg:col-span-5 relative overflow-hidden bg-gradient-to-br from-[#ea580c] via-[#c2410c] to-[#7c2d12] text-white p-8 flex-col justify-between">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-15"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.65) 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative z-10 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-sm">
              <GastroMapIcon className="w-7 h-7 rounded-[28%]" />
            </div>
            <span className="font-extrabold text-xl tracking-tight">
              Gastro<span className="text-amber-200">Map</span>
            </span>
          </div>

          <div className="relative z-10 space-y-4 my-auto py-8">
            <h2 className="text-2xl font-black leading-tight">
              {t("auth.register_hero_title")}
            </h2>
            <p className="text-xs text-white/85 leading-relaxed">
              {t("auth.register_hero_desc")}
            </p>
            <div className="space-y-2.5 pt-2 text-xs">
              <div className="flex items-center gap-2.5 bg-white/15 backdrop-blur-xs rounded-2xl px-3.5 py-2.5 border border-white/20">
                <span className="material-symbols-outlined text-base text-amber-200">person_pin_circle</span>
                <span className="font-semibold">{t("auth.register_bullet_personal")}</span>
              </div>
              <div className="flex items-center gap-2.5 bg-white/15 backdrop-blur-xs rounded-2xl px-3.5 py-2.5 border border-white/20">
                <span className="material-symbols-outlined text-base text-amber-200">diversity_3</span>
                <span className="font-semibold">{t("auth.register_bullet_groups")}</span>
              </div>
              <div className="flex items-center gap-2.5 bg-white/15 backdrop-blur-xs rounded-2xl px-3.5 py-2.5 border border-white/20">
                <span className="material-symbols-outlined text-base text-amber-200">lock</span>
                <span className="font-semibold">{t("auth.register_bullet_isolated")}</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 text-[11px] text-white/75 font-semibold">
            GastroMap v{APP_VERSION}
          </div>
        </div>

        {/* Panel derecho: Formulario de registro o aviso cerrado */}
        <div className="lg:col-span-7 p-7 sm:p-10 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="text-center lg:text-left space-y-2.5">
              <div className="flex justify-center lg:hidden">
                <GastroMapLogo iconClassName="w-11 h-11" textClassName="text-2xl" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {t("auth.public_register_title")}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {t("auth.public_register_subtitle")}
                </p>
              </div>
            </div>

            {publicRegistrationEnabled ? (
              <PublicRegisterForm callbackUrl={callbackUrl} />
            ) : (
              <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-3 text-center">
                <span className="material-symbols-outlined text-3xl text-amber-600 dark:text-amber-400">
                  lock
                </span>
                <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {t("auth.public_register_closed")}
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition"
                >
                  <span className="material-symbols-outlined text-sm leading-none">login</span>
                  <span>{t("auth.sign_in_link")}</span>
                </Link>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>{t("auth.open_groups_notice")}</span>
            <span className="px-2 py-0.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold">
              v{APP_VERSION}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
