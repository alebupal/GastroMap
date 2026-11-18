import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { RegisterInviteForm } from "@/components/auth/RegisterInviteForm";

export const dynamic = "force-dynamic";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

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
      <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-slate-50 dark:bg-slate-950 text-center">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Invitación no válida o expirada
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Este enlace de invitación ya ha sido utilizado o ha superado su fecha límite de validez.
          </p>
          <a
            href="/login"
            className="inline-block py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-sm transition"
          >
            Ir al inicio de sesión
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-3xl shadow-sm border border-amber-500/20">
            🎟️
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            ¡Has sido invitado!
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Crea tu cuenta para unirte al GastroMap de tu círculo.
          </p>
        </div>

        <RegisterInviteForm token={token} defaultEmail={invitation.email} />
      </div>
    </div>
  );
}
