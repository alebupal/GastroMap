import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspace";
import { getOccasions, getTagsWithCount } from "@/lib/actions/taxonomy";
import { getMyGroupsAction } from "@/lib/actions/groups";
import { NewPlaceForm } from "@/components/places/NewPlaceForm";
import { UserHeader } from "@/components/profile/UserHeader";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { GastroMapIcon } from "@/components/ui/GastroMapLogo";
import { APP_VERSION } from "@/lib/version";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

interface NewPageProps {
  searchParams: Promise<{
    url?: string;
    title?: string;
    text?: string;
  }>;
}

export default async function NewPlacePage({ searchParams }: NewPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  const [workspace, occasions, allTags, myGroups, params, t] = await Promise.all([
    getActiveWorkspace(),
    getOccasions(),
    getTagsWithCount(),
    getMyGroupsAction(),
    searchParams,
    getT(),
  ]);
  const popularTags = allTags.map((t) => t.name);
  const availableGroups = myGroups.map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
  }));
  const defaultTargetSpace =
    workspace?.mode === "group" && workspace.groupId
      ? workspace.groupId
      : workspace?.mode === "all" && availableGroups.length > 0
        ? ""
        : "personal";

  // Extraer URL si venía en el texto compartido (habitual en WhatsApp/Twitter/Instagram)
  let initialUrl = params.url || "";
  let initialTitle = params.title || "";

  if (!initialUrl && params.text) {
    const urlMatch = params.text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      initialUrl = urlMatch[0];
      initialTitle = params.text.replace(urlMatch[0], "").trim();
    } else {
      initialTitle = params.text;
    }
  }

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200">
      <div className="max-w-[1720px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-3 flex-1 flex flex-col">
        {/* Cabecera principal unificada */}
        <UserHeader currentUser={currentUser} workspace={workspace} />

        {/* Contenedor centrado del formulario estilo Stitch */}
        <main className="w-full max-w-2xl mx-auto py-3 sm:py-5 space-y-5 flex-1">
          <div className="flex items-center gap-3.5">
            <Link
              href="/"
              className="w-10 h-10 rounded-full bg-[#f2f3ff] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition shrink-0"
              aria-label="Volver al mapa"
            >
              <span className="material-symbols-outlined text-lg leading-none">arrow_back</span>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {t("places.add_new")}
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                  {t("places.new_badge")}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("app.subtitle")}
              </p>
            </div>
          </div>

          <NewPlaceForm
            initialUrl={initialUrl}
            initialTitle={initialTitle}
            availableOccasions={occasions}
            popularTags={popularTags}
            availableGroups={availableGroups}
            defaultTargetSpace={defaultTargetSpace}
          />
        </main>
      </div>

      {/* Pie de página minimalista coherente (espacio extra en móvil para MobileBottomNav) */}
      <footer className="w-full bg-[#f2f3ff] dark:bg-slate-900/60 border-t border-slate-200/60 dark:border-slate-800/60 py-5 pb-24 lg:pb-5 mt-8">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <GastroMapIcon className="w-5 h-5 shrink-0 shadow-xs rounded-[28%]" />
            <span className="font-bold text-slate-900 dark:text-slate-100">
              Gastro<span className="text-[#ea580c]">Map</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400">
              v{APP_VERSION}
            </span>
          </div>

          <div className="flex items-center gap-4 font-semibold flex-wrap justify-center">
            <Link href="/docs" className="hover:text-orange-600 transition">
              {t("nav.documentation")}
            </Link>
            <a
              href="https://github.com/alebupal/GastroMap"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-600 transition"
            >
              GitHub
            </a>
            <a
              href="https://www.paypal.me/alebupal"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-600 hover:text-white hover:border-rose-600 font-bold transition shadow-xs group"
            >
              <span className="material-symbols-outlined text-sm leading-none group-hover:text-white">
                favorite
              </span>
              <span>{t("nav.donate")}</span>
            </a>
          </div>
        </div>
      </footer>

      <MobileBottomNav />
    </div>
  );
}
