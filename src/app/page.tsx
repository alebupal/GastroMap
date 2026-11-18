import { redirect } from "next/navigation";
import { countUsers, getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { versionService } from "@/services/versionService";
import { InviteManager } from "@/components/InviteManager";

export const dynamic = "force-dynamic";

export default async function Home() {
  const userCount = await countUsers();
  if (userCount === 0) {
    redirect("/setup");
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  const version = versionService.getLocalVersion();

  return (
    <main className="flex-1 flex flex-col items-center justify-between p-4 sm:p-6 max-w-lg mx-auto w-full">
      {/* Cabecera de usuario */}
      <div className="w-full flex items-center justify-between py-2 mb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-lg font-bold border border-amber-500/20">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>{currentUser.name}</span>
              {currentUser.role === "admin" && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  ADMIN
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400">{currentUser.email}</div>
          </div>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 font-medium transition cursor-pointer"
          >
            Cerrar sesión
          </button>
        </form>
      </div>

      {/* Contenido principal */}
      <div className="w-full text-center flex-1 flex flex-col items-center justify-center my-auto">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-3xl mb-4 shadow-sm border border-amber-500/20">
          🍽️
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mb-2">
          GastroMap
        </h1>

        <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
          Nuestra app privada para guardar, descubrir y decidir sitios donde comer y tapear con amigos y familia.
        </p>

        {/* Acciones principales */}
        <div className="grid grid-cols-1 gap-3 w-full">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm text-left">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 mb-1">
              <span className="text-lg">➕</span> Añadir un sitio
            </div>
            <p className="text-xs text-slate-500">
              Guarda en 10 segundos desde Instagram, TikTok o Google Maps.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm text-left">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 mb-1">
              <span className="text-lg">🔍</span> Encontrar un sitio
            </div>
            <p className="text-xs text-slate-500">
              Filtra por plan, distancia, presupuesto o dale al botón «Elegir al azar».
            </p>
          </div>
        </div>

        {/* Gestor de invitaciones (solo para admin) */}
        {currentUser.role === "admin" && <InviteManager />}
      </div>

      {/* Pie de página */}
      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
        <span>Fase 1 (Autenticación e Invitaciones)</span>
        <span>•</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          v{version}
        </span>
      </div>
    </main>
  );
}
