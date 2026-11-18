import { redirect } from "next/navigation";
import { countUsers, getCurrentUser } from "@/lib/auth";
import { getAllPlaces } from "@/lib/actions/places";
import { seedDemoPlacesAction } from "@/lib/actions/seed";
import { getOccasions, getTagsWithCount } from "@/lib/actions/taxonomy";
import { getSetting } from "@/lib/actions/settings";
import { versionService } from "@/services/versionService";
import { UserHeader } from "@/components/profile/UserHeader";
import { UsersManager } from "@/components/admin/UsersManager";
import { DemoPlacesSeeder } from "@/components/admin/DemoPlacesSeeder";
import { InviteManager } from "@/components/InviteManager";
import { TaxonomyManager } from "@/components/admin/TaxonomyManager";
import { SettingsManager } from "@/components/admin/SettingsManager";
import { PlacesExplorer } from "@/components/places/PlacesExplorer";

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

  let [places, occasionsList, tagsList, cartoApiKey] = await Promise.all([
    getAllPlaces(),
    getOccasions(),
    getTagsWithCount(),
    getSetting("carto_api_key"),
  ]);

  // Si el catálogo está vacío, sembramos los 20 sitios de demostración mundiales automáticamente
  if (places.length === 0) {
    try {
      await seedDemoPlacesAction();
      places = await getAllPlaces();
    } catch {
      // Ignorar fallback
    }
  }

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
    <main className="min-h-screen flex flex-col justify-between p-4 sm:p-6 lg:p-8 max-w-6xl xl:max-w-7xl mx-auto w-full">
      {/* 1. Cabecera de usuario con edición de perfil */}
      <div>
        <UserHeader currentUser={currentUser} />

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

        {/* 3. Catálogo de Establecimientos (Mapa interactivo y Lista sincronizada) */}
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
                Pulsa en «Añadir sitio» o comparte un enlace desde Google Maps para estrenar tu catálogo en el mapa.
              </p>
              <a
                href="/new"
                className="inline-block py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-xs transition"
              >
                Añadir el primer sitio
              </a>
            </div>
          ) : (
            <PlacesExplorer
              initialPlaces={places}
              occasionsList={occasionsList}
              tagsList={tagsList}
              currentUserId={currentUser.id}
              isAdmin={currentUser.role === "admin"}
              occasionMap={occasionMap}
              cartoApiKey={cartoApiKey}
            />
          )}
        </section>

        {/* 4. Módulos de Administración (solo para admin) */}
        {currentUser.role === "admin" && (
          <div className="mt-8 space-y-3 max-w-xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Herramientas de Administración
            </h2>
            <UsersManager />
            <DemoPlacesSeeder />
            <SettingsManager initialCartoApiKey={cartoApiKey} />
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
