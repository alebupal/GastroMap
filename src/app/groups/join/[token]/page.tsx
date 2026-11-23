import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getGroupInviteInfoAction } from "@/lib/actions/groups";
import { JoinGroupClient } from "./JoinGroupClient";
import { GastroMapLogo } from "@/components/ui/GastroMapLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

interface JoinGroupPageProps {
  params: Promise<{ token: string }>;
}

export default async function JoinGroupPage({ params }: JoinGroupPageProps) {
  const { token } = await params;
  const currentUser = await getCurrentUser();
  const t = await getT();

  if (!currentUser) {
    redirect(`/login?callbackUrl=/groups/join/${token}`);
  }

  const info = await getGroupInviteInfoAction(token);

  if (info.error || info.isExpired) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-[#faf8ff] dark:bg-[#0b1120] text-center transition-colors duration-200">
        <div className="fixed top-4 right-4 z-20">
          <ThemeToggle />
        </div>
        <div className="gm-animate-fade-up w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">error</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">
            {t("groups.join_invalid")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">
            {info.error || t("groups.join_invalid")}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 py-2.5 px-5 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition shadow-sm"
          >
            <span className="material-symbols-outlined text-sm leading-none">map</span>
            <span>{t("groups.join_go_to_map")}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-[#faf8ff] dark:bg-[#0b1120] text-center transition-colors duration-200">
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className="gm-animate-fade-up w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8">
        <div className="flex justify-center mb-5">
          <GastroMapLogo iconClassName="w-10 h-10" textClassName="text-xl" />
        </div>
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/60 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl">group_add</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          {t("groups.join_title")}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2">
          {t("groups.join_invited_by", { owner: info.ownerName || "" })}
        </p>
        <div className="my-5 p-4 rounded-2xl bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200/80 dark:border-orange-900/50">
          <h2 className="text-xl font-extrabold text-orange-700 dark:text-orange-300">
            &laquo;{info.groupName}&raquo;
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Podrás ver y compartir recomendaciones gastronómicas privadas con este grupo.
          </p>
        </div>

        <JoinGroupClient
          token={token}
          groupName={info.groupName || ""}
          isAlreadyMember={Boolean(info.isAlreadyMember)}
        />
      </div>
    </div>
  );
}
