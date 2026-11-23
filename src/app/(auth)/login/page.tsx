import { redirect } from "next/navigation";
import { countUsers, getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";
import { GastroMapIcon } from "@/components/ui/GastroMapLogo";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const userCount = await countUsers();
  if (userCount === 0) {
    redirect("/setup");
  }

  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect("/");
  }

  const t = await getT();

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex items-center justify-center">
            <GastroMapIcon className="w-14 h-14 shadow-md rounded-[28%]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t("auth.login_title")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("auth.login_subtitle")}
          </p>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-xs text-slate-400">
          Esta es una aplicación privada. Si no tienes cuenta, solicita una invitación a un administrador.
        </p>
      </div>
    </div>
  );
}
