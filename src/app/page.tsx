import { redirect } from "next/navigation";
import Link from "next/link";
import { countUsers, getCurrentUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspace";
import { getAllPlaces, getCommunityUsers } from "@/lib/actions/places";
import { getOccasions, getTagsWithCount } from "@/lib/actions/taxonomy";
import { getSavedFiltersAction } from "@/lib/actions/saved-filters";
import { UserHeader } from "@/components/profile/UserHeader";
import { PlacesExplorer } from "@/components/places/PlacesExplorer";
import type { CopyTargetSpaceOption } from "@/components/places/CopyPlaceModal";
import { GastroMapIcon } from "@/components/ui/GastroMapLogo";
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

  const [workspace, places, occasionsList, tagsList, savedFiltersList, communityUsers, t] =
    await Promise.all([
      getActiveWorkspace(),
      getAllPlaces(),
      getOccasions(),
      getTagsWithCount(),
      getSavedFiltersAction(),
      getCommunityUsers(),
      getT(),
    ]);

  const availableSpaces: CopyTargetSpaceOption[] = [
    ...(workspace?.myGroups || []).map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon || "🍻",
    })),
    {
      id: "personal",
      name: t("spaces.personal_map"),
      icon: "🏠",
      isPersonal: true,
    },
  ];

  // Mapa rápido de ID de ocasión a su objeto { name, icon }
  const occasionMap = occasionsList.reduce<Record<string, { name: string; icon: string }>>(
    (acc, occ) => {
      acc[occ.id] = { name: occ.name, icon: occ.icon };
      return acc;
    },
    {}
  );

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200">
      {/* Contenedor principal responsive ancho completo Stitch */}
      <div className="max-w-[1720px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-3 flex-1 flex flex-col gap-3">
        {/* 1. Barra de navegación, selector de espacio y usuario */}
        <UserHeader currentUser={currentUser} workspace={workspace} />

        {/* 2. Explorador Gastronómico (Buscador en vivo, Filtros, Lista y Mapa) */}
        <section id="catalogo" className="w-full">
          <PlacesExplorer
            initialPlaces={places}
            occasionsList={occasionsList}
            tagsList={tagsList}
            currentUserId={currentUser.id}
            isAdmin={currentUser.role === "admin"}
            isSpaceAdmin={Boolean(workspace?.isSpaceAdmin)}
            workspaceMode={workspace?.mode || "group"}
            availableSpaces={availableSpaces}
            occasionMap={occasionMap}
            initialSavedFilters={savedFiltersList}
            communityUsers={communityUsers}
          />
        </section>
      </div>

      {/* 4. Pie de página estilizado Stitch (espacio inferior extra en móvil para la barra de navegación fija + FAB Añadir sitio) */}
      <footer className="w-full bg-[#f2f3ff] dark:bg-slate-900/60 border-t border-slate-200/60 dark:border-slate-800/60 py-6 pb-[calc(9rem+env(safe-area-inset-bottom,0px))] lg:pb-6 mt-8">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <GastroMapIcon className="w-6 h-6 shrink-0 shadow-xs rounded-[28%]" />
            <span className="font-bold text-slate-900 dark:text-slate-100">
              Gastro<span className="text-[#ea580c]">Map</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400">
              v{APP_VERSION}
            </span>
          </div>

          <div className="flex items-center gap-4 font-semibold flex-wrap justify-center">
            <Link href="/docs" className="hover:text-orange-600 transition">{t("nav.documentation")}</Link>
            <a href="https://github.com/alebupal/GastroMap" target="_blank" rel="noopener noreferrer" className="hover:text-orange-600 transition">GitHub</a>
            <a
              href="https://www.paypal.me/alebupal"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 font-bold transition shadow-xs"
            >
              <span className="material-symbols-outlined text-sm leading-none">favorite</span>
              <span>{t("nav.donate")}</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
