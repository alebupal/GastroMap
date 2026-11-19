import { redirect } from "next/navigation";
import Link from "next/link";
import { countUsers, getCurrentUser } from "@/lib/auth";
import { getAllPlaces } from "@/lib/actions/places";
import { getOccasions, getTagsWithCount } from "@/lib/actions/taxonomy";
import { getSetting } from "@/lib/actions/settings";
import { getSavedFiltersAction } from "@/lib/actions/saved-filters";
import { versionService } from "@/services/versionService";
import { UserHeader } from "@/components/profile/UserHeader";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { PlacesExplorer } from "@/components/places/PlacesExplorer";
import { APP_VERSION } from "@/lib/version";
import { getT } from "@/lib/i18n/server";

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

  const [places, occasionsList, tagsList, cartoApiKey, savedFiltersList, t] = await Promise.all([
    getAllPlaces(),
    getOccasions(),
    getTagsWithCount(),
    getSetting("carto_api_key"),
    getSavedFiltersAction(),
    getT(),
  ]);

  const version = APP_VERSION;

  // Mapa rápido de ID de ocasión a su objeto { name, icon }
  const occasionMap = occasionsList.reduce<Record<string, { name: string; icon: string }>>(
    (acc, occ) => {
      acc[occ.id] = { name: occ.name, icon: occ.icon };
      return acc;
    },
    {}
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200">
      {/* Contenedor principal responsive */}
      <div className="max-w-6xl xl:max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 flex-1">
        {/* 1. Barra de navegación y usuario */}
        <UserHeader currentUser={currentUser} />

        {/* 2. Explorador Gastronómico (Buscador en vivo, Filtros, Lista y Mapa) */}
        <section id="catalogo" className="w-full">
          <PlacesExplorer
            initialPlaces={places}
            occasionsList={occasionsList}
            tagsList={tagsList}
            currentUserId={currentUser.id}
            isAdmin={currentUser.role === "admin"}
            occasionMap={occasionMap}
            cartoApiKey={cartoApiKey}
            initialSavedFilters={savedFiltersList}
          />
        </section>

        {/* 3. Panel de Administración con pestañas (solo visible para admin) */}
        {currentUser.role === "admin" && (
          <AdminDashboard
            initialOccasions={occasionsList}
            initialTags={tagsList}
            allPlaces={places}
            cartoApiKey={cartoApiKey}
            currentUserId={currentUser.id}
          />
        )}
      </div>

      {/* 4. Pie de página estilizado (estilo TVSpy con donación PayPal y enlaces a repo) */}
      <footer className="mt-12 py-6 border-t border-slate-200 dark:border-slate-900 bg-white/80 dark:bg-slate-950/80 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-300">GastroMap</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              v{version}
            </span>
          </div>

          <div className="flex items-center gap-4 flex-wrap justify-center">
            {/* Botón de donación a PayPal estilo TVSpy */}
            <a
              href="https://www.paypal.me/alebupal"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 font-semibold text-xs transition"
            >
              <span>❤️</span>
              <span>{t("nav.donate_paypal")}</span>
            </a>

            {/* Enlaces de repositorio, ecosistema y documentación estilo TVSPY */}
            <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
              <Link
                href="/docs"
                className="hover:text-amber-500 font-semibold transition flex items-center gap-1"
                title={t("nav.documentation")}
              >
                <span>📘</span>
                <span>{t("nav.documentation")}</span>
              </Link>
              <span>•</span>
              <a
                href="https://github.com/alebupal/GastroMap"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-amber-500 transition"
              >
                GitHub
              </a>
              <span>•</span>
              <a
                href="https://hub.docker.com/r/alebupal/gastromap"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-amber-500 transition"
              >
                Docker
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
