import { redirect } from "next/navigation";
import { countUsers } from "@/lib/auth";
import { SetupAdminForm } from "@/components/auth/SetupAdminForm";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const userCount = await countUsers();
  if (userCount > 0) {
    redirect("/login");
  }
  const t = await getT();

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-3xl shadow-sm border border-amber-500/20">
            👑
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t("auth.setup_title")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("auth.setup_subtitle")}
          </p>
        </div>

        <SetupAdminForm />
      </div>
    </div>
  );
}
