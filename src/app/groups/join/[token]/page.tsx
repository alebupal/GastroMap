import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getGroupInviteInfoAction } from "@/lib/actions/groups";
import { JoinGroupClient } from "./JoinGroupClient";

export const dynamic = "force-dynamic";

interface JoinGroupPageProps {
  params: Promise<{ token: string }>;
}

export default async function JoinGroupPage({ params }: JoinGroupPageProps) {
  const { token } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    // Redirigir a login pasando el callbackUrl
    redirect(`/login?callbackUrl=/groups/join/${token}`);
  }

  const info = await getGroupInviteInfoAction(token);

  if (info.error || info.isExpired) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-slate-50 dark:bg-slate-950 text-center">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Invitación no válida o expirada
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {info.error || "Este enlace de invitación ha superado su fecha límite de validez."}
          </p>
          <a
            href="/"
            className="inline-block py-2.5 px-5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition"
          >
            Volver al mapa
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-slate-50 dark:bg-slate-950 text-center">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-3xl shadow-sm border border-amber-500/20">
          👥
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          Invitación a Grupo Privado
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          <strong className="text-slate-800 dark:text-slate-200">{info.ownerName}</strong> te ha invitado a unirte a:
        </p>
        <div className="my-5 p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/30">
          <h2 className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
            «{info.groupName}»
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
