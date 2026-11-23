import { eq, and, isNull, gt } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { RegisterInviteForm } from "@/components/auth/RegisterInviteForm";
import { GastroMapLogo } from "@/components/ui/GastroMapLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const t = await getT();

  const [invitation] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.token, token),
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!invitation) {
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
            {t("auth.invalid_invite")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">
            {t("auth.invalid_invite")}
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 py-2.5 px-5 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition shadow-sm"
          >
            <span className="material-symbols-outlined text-sm leading-none">login</span>
            <span>{t("auth.login_title")}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-[#faf8ff] dark:bg-[#0b1120] transition-colors duration-200">
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className="gm-animate-fade-up w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8">
        <div className="text-center mb-6 space-y-3">
          <div className="flex justify-center">
            <GastroMapLogo iconClassName="w-11 h-11" textClassName="text-2xl" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 text-[10px] font-black uppercase tracking-wider mb-1.5">
              <span className="material-symbols-outlined text-xs leading-none">confirmation_number</span>
              <span>Invitación Privada</span>
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              {t("auth.invite_title")}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("auth.invite_subtitle")}
            </p>
          </div>
        </div>

        <RegisterInviteForm token={token} defaultEmail={invitation.email} />
      </div>
    </div>
  );
}
