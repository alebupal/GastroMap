import { redirect } from "next/navigation";
import { countUsers, getCurrentUser } from "@/lib/auth";
import { getAllPlaces } from "@/lib/actions/places";
import { getOccasions, getTagsWithCount } from "@/lib/actions/taxonomy";
import { getSetting } from "@/lib/actions/settings";
import { versionService } from "@/services/versionService";
import { UserHeader } from "@/components/profile/UserHeader";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
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

  const [places, occasionsList, tagsList, cartoApiKey] = await Promise.all([
    getAllPlaces(),
    getOccasions(),
    getTagsWithCount(),
    getSetting("carto_api_key"),
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
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
          />
        </section>

        {/* 3. Panel de Administración con pestañas (solo visible para admin) */}
        {currentUser.role === "admin" && (
          <AdminDashboard
            initialOccasions={occasionsList}
            initialTags={tagsList}
            cartoApiKey={cartoApiKey}
          />
        )}
      </div>

      {/* 4. Pie de página estilizado */}
      <footer className="mt-12 py-6 border-t border-slate-900 bg-slate-950/80 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">GastroMap</span>
            <span>•</span>
            <span className="text-[11px] text-slate-500">Catálogo Gastronómico Colaborativo</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-900 border border-slate-800 text-slate-400">
              v{version}
            </span>
            <span>•</span>
            <span className="text-slate-600">Self-Hosted en Docker</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
