import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { occasions, placeOccasions, places, placeTags } from "@/db/schema";
import { verifyPlaceShareToken } from "@/lib/share-token";
import { getMapsHref } from "@/lib/maps";
import { GastroMapLogo } from "@/components/ui/GastroMapLogo";
import { OccasionIcon } from "@/components/ui/OccasionIcon";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ s?: string }>;
}

async function getSharedPlacePublicData(placeId: string, token?: string) {
  if (!verifyPlaceShareToken(placeId, token)) return null;

  const [place] = await db
    .select({
      id: places.id,
      name: places.name,
      city: places.city,
      country: places.country,
      address: places.address,
      latitude: places.latitude,
      longitude: places.longitude,
      priceRange: places.priceRange,
      googleMapsUrl: places.googleMapsUrl,
      notes: places.notes,
    })
    .from(places)
    .where(and(eq(places.id, placeId), isNull(places.deletedAt)))
    .limit(1);

  if (!place) return null;

  const [occRows, tagRows, allOccs] = await Promise.all([
    db.select({ occasion: placeOccasions.occasion }).from(placeOccasions).where(eq(placeOccasions.placeId, place.id)),
    db.select({ tag: placeTags.tag }).from(placeTags).where(eq(placeTags.placeId, place.id)),
    db.select({ id: occasions.id, name: occasions.name, icon: occasions.icon }).from(occasions),
  ]);

  const occMap = new Map(allOccs.map((o) => [o.id, { name: o.name, icon: o.icon }]));

  return {
    ...place,
    occasions: occRows.map((r) => occMap.get(r.occasion) || { name: r.occasion, icon: "🏷️" }),
    tags: tagRows.map((r) => r.tag),
  };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ id }, { s }] = await Promise.all([params, searchParams]);
  const place = await getSharedPlacePublicData(id, s);
  if (!place) {
    return { title: "Sitio no disponible — GastroMap" };
  }

  const location = [place.city, place.country].filter(Boolean).join(", ");
  const pricePart = place.priceRange && place.priceRange !== "???" ? ` · ${place.priceRange}` : "";
  const description =
    place.notes ||
    [location, place.address].filter(Boolean).join(" • ") ||
    "Recomendación gastronómica compartida desde GastroMap.";

  const title = `${place.name}${location ? ` (${location})` : ""}${pricePart} — GastroMap`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function SharedPlacePage({ params, searchParams }: PageProps) {
  const [{ id }, { s }] = await Promise.all([params, searchParams]);
  const place = await getSharedPlacePublicData(id, s);

  if (!place) {
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
            Enlace no válido o caducado
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Esta ficha compartida no está disponible o el enlace es incorrecto.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition shadow-xs"
            >
              <span className="material-symbols-outlined text-base leading-none">explore</span>
              <span>Ir a GastroMap</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const mapsHref = getMapsHref(place);

  return (
    <div className="min-h-screen bg-[#faf9ff] dark:bg-[#0b1120] flex flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-6">
        <GastroMapLogo iconClassName="w-9 h-9" textClassName="text-xl" />
      </Link>

      <article className="max-w-lg w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-7 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {place.name}
            </h1>
            {(place.city || place.address) && (
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 flex items-start gap-1.5">
                <span className="material-symbols-outlined text-base text-orange-600 leading-none shrink-0 mt-0.5">
                  location_on
                </span>
                <span>
                  {[place.city, place.address].filter(Boolean).join(" • ")}
                </span>
              </p>
            )}
          </div>
          {place.priceRange && place.priceRange !== "???" && (
            <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs shrink-0">
              {place.priceRange}
            </span>
          )}
        </div>

        {(place.occasions.length > 0 || place.tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {place.occasions.map((occ) => (
              <span
                key={occ.name}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs"
              >
                <OccasionIcon icon={occ.icon} msClassName="text-[14px]" />
                <span>{occ.name}</span>
              </span>
            ))}
            {place.tags.slice(0, 8).map((tg) => (
              <span
                key={tg}
                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-xs font-medium"
              >
                #{tg}
              </span>
            ))}
          </div>
        )}

        {place.notes && (
          <p className="text-sm text-slate-700 dark:text-slate-300 italic bg-amber-50/70 dark:bg-slate-800/50 p-3.5 rounded-2xl border-l-2 border-orange-500">
            «{place.notes}»
          </p>
        )}

        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {mapsHref && (
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition shadow-xs"
            >
              <span className="material-symbols-outlined text-base leading-none">map</span>
              <span>Abrir en Google Maps</span>
            </a>
          )}
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-bold transition"
          >
            <span className="material-symbols-outlined text-base leading-none">explore</span>
            <span>GastroMap</span>
          </Link>
        </div>
      </article>
    </div>
  );
}
