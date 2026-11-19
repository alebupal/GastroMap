import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getOccasions, getTagsWithCount } from "@/lib/actions/taxonomy";
import { getMyGroupsAction } from "@/lib/actions/groups";
import { NewPlaceForm } from "@/components/places/NewPlaceForm";

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

  const [occasions, allTags, myGroups, params] = await Promise.all([
    getOccasions(),
    getTagsWithCount(),
    getMyGroupsAction(),
    searchParams,
  ]);
  const popularTags = allTags.map((t) => t.name);
  const availableGroups = myGroups.map((g) => ({ id: g.id, name: g.name }));

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 flex flex-col justify-center items-center">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 sm:p-7">
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/"
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 text-sm transition"
            aria-label="Volver al mapa"
          >
            ←
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Añadir nuevo sitio
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Guarda en 10 segundos tu próximo descubrimiento
            </p>
          </div>
        </div>

        <NewPlaceForm
          initialUrl={initialUrl}
          initialTitle={initialTitle}
          availableOccasions={occasions}
          popularTags={popularTags}
          availableGroups={availableGroups}
        />
      </div>
    </div>
  );
}
