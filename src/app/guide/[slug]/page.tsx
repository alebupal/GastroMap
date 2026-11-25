import type { Metadata } from "next";
import Link from "next/link";
import { getPublicGuideBySlug } from "@/lib/actions/lists";
import { PublicGuideView } from "@/components/places/PublicGuideView";
import { GastroMapLogo } from "@/components/ui/GastroMapLogo";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getPublicGuideBySlug(slug);
  if (!guide) {
    return {
      title: "Guía no encontrada — GastroMap",
    };
  }
  const author = guide.authorUsername ? `@${guide.authorUsername}` : guide.authorName;
  const description =
    guide.description ||
    `Guía gastronómica de ${author} con ${guide.items.length} sitios recomendados en GastroMap.`;

  return {
    title: `${guide.name} — GastroMap`,
    description,
    openGraph: {
      title: `${guide.name} — GastroMap`,
      description,
      type: "article",
    },
  };
}

export default async function PublicGuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = await getPublicGuideBySlug(slug);

  if (!guide) {
    const t = await getT();
    return (
      <div className="min-h-screen bg-[#faf9ff] dark:bg-slate-950 flex flex-col items-center justify-center px-4 text-center">
        <Link href="/" className="mb-6">
          <GastroMapLogo iconClassName="w-10 h-10" textClassName="text-2xl" />
        </Link>
        <div className="max-w-md w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 shadow-sm space-y-3">
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">
            link_off
          </span>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            {t("lists.not_found_title")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("lists.not_found_desc")}
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition shadow-xs"
            >
              <span className="material-symbols-outlined text-base leading-none">explore</span>
              <span>{t("lists.back_to_gastromap")}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <PublicGuideView guide={guide} />;
}
