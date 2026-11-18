import { redirect } from "next/navigation";
import { countUsers, getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { getAllPlaces } from "@/lib/actions/places";
import { getOccasions, getTagsWithCount } from "@/lib/actions/taxonomy";
import { versionService } from "@/services/versionService";
import { InviteManager } from "@/components/InviteManager";
import { TaxonomyManager } from "@/components/admin/TaxonomyManager";
import { PlaceCard } from "@/components/places/PlaceCard";

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

  const [places, occasionsList, tagsList] = await Promise.all([
    getAllPlaces(),
    getOccasions(),
    getTagsWithCount(),
  ]);

  const version = versionService.getLocalVersion();

  // Mapa rápido de ID de ocasión a su objeto { name, icon }
  const occasionMap = occasionsList.reduce<Record<string, { name: string; icon: string }>>(
    (acc, occ) => {
      acc[occ.id] = { name: occ.name, icon: occ.icon };
      return acc;
    },
    {}
  );

  return (
    <main className="min-h-screen flex flex-col justify-between p-4 sm:p-6 max-w-xl mx-auto w-full">
      {/* 1. Cabecera de usuario */}
      <div>
        <div className="w-full flex items-center justify-between py-2 mb-4 border-b border-slate-100 dark:border-slate-800">
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

        {/* 2. Barra de acciones rápidas */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <a
            href="/new"
            className="p-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition active:scale-98"
          >
            <span className="text-lg">➕</span>
            <span>Añadir sitio</span>
          </a>

          <a
            href="#catalogo"
            className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition active:scale-98"
          >
            <span className="text-lg">🔍</span>
            <span>Ver sitios ({places.length})</span>
          </a>
        </div>

        {/* 3. Catálogo de Establecimientos */}
        <section id="catalogo" className="w-full space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Catálogo Gastronómico
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              {places.length} {places.length === 1 ? "sitio guardado" : "sitios guardados"}
            </span>
          </div>

          {places.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="text-3xl mb-2">🍽️</div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Aún no hay sitios guardados
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs mx-auto">
                Pulsa en «Añadir sitio» o comparte un enlace desde Google Maps o redes sociales para estrenar tu catálogo.
              </p>
              <a
                href="/new"
                className="inline-block py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-xs transition"
              >
                Añadir el primer sitio
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {places.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  currentUserId={currentUser.id}
                  isAdmin={currentUser.role === "admin"}
                  occasionMap={occasionMap}
                />
              ))}
            </div>
          )}
        </section>

        {/* 4. Módulos de Administración (solo para admin) */}
        {currentUser.role === "admin" && (
          <div className="mt-8 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Herramientas de Administración
            </h2>
            <TaxonomyManager initialOccasions={occasionsList} initialTags={tagsList} />
            <InviteManager />
          </div>
        )}
      </div>

      {/* 5. Pie de página con versión */}
      <div className="mt-10 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-400">
        <span>GastroMap</span>
        <span>•</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          v{version}
        </span>
      </div>
    </main>
  );
}
