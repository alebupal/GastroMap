"use server";

import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  places,
  userPlaces,
  placeComments,
  placeOccasions,
  placeTags,
  occasions,
  tags,
  sharingGroups,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export interface CountItem {
  label: string;
  count: number;
  icon?: string;
}

export interface UserWrappedData {
  year: number;
  availableYears: number[];
  uniquePlacesVisited: number;
  favoritesCount: number;
  placesAdded: number;
  commentsPosted: number;
  ratingsCount: number;
  topRatedPlace: { name: string; city: string | null; rating: number } | null;
  topCity: string | null;
  topOccasion: { name: string; icon: string; count: number } | null;
  topTag: { name: string; count: number } | null;
}

export interface UserStatsData {
  visitedCount: number;
  pendingCount: number;
  favoritesCount: number;
  contributedPlacesCount: number;
  commentsCount: number;
  averageRating: number | null;
  topCities: CountItem[];
  topOccasions: CountItem[];
  topTags: CountItem[];
  priceDistribution: CountItem[];
  wrapped: UserWrappedData;
}

export interface AdminStatsData {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  totalPlaces: number;
  communityPlaces: number;
  privatePlaces: number;
  totalComments: number;
  totalVisits: number;
  totalGroups: number;
  totalOccasions: number;
  totalTags: number;
  last30Days: {
    places: number;
    comments: number;
    visits: number;
    users: number;
  };
  topContributors: Array<{
    userId: string;
    name: string;
    username: string | null;
    placesCount: number;
    commentsCount: number;
  }>;
  topPopularPlaces: Array<{
    placeId: string;
    name: string;
    city: string | null;
    priceRange: string;
    favoritesCount: number;
    visitedCount: number;
    commentsCount: number;
    avgRating: number | null;
  }>;
  topCitiesGlobal: CountItem[];
  topOccasionsGlobal: CountItem[];
  topTagsGlobal: CountItem[];
  priceDistributionGlobal: CountItem[];
}

function topEntries(map: Map<string, number>, limit: number): CountItem[] {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"))
    .slice(0, limit);
}

/**
 * Estadísticas personales del usuario actual + Resumen anual «Wrapped».
 */
export async function getUserStatsAction(selectedYear?: number): Promise<UserStatsData | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const targetYear = selectedYear || new Date().getFullYear();

  const [myInteractions, myContributed, myComments, allOccasions] = await Promise.all([
    db.select().from(userPlaces).where(eq(userPlaces.userId, user.id)),
    db.select().from(places).where(eq(places.createdById, user.id)),
    db.select().from(placeComments).where(eq(placeComments.userId, user.id)),
    db.select().from(occasions),
  ]);

  const occMap = new Map(allOccasions.map((o) => [o.id, { name: o.name, icon: o.icon }]));

  const visitedCount = myInteractions.filter((i) => i.personalStatus === "visited").length;
  const pendingCount = myInteractions.filter((i) => i.personalStatus === "pending").length;
  const favoritesCount = myInteractions.filter((i) => i.favorite).length;

  const ratings = myInteractions
    .map((i) => i.rating)
    .filter((r): r is number => r !== null && r !== undefined);
  const averageRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

  // IDs de sitios con los que el usuario interactuó (guardados/visitados/favoritos o aportados)
  const relevantPlaceIds = Array.from(
    new Set([
      ...myInteractions.map((i) => i.placeId),
      ...myContributed.map((p) => p.id),
    ])
  );

  const [relevantPlaces, relevantOccs, relevantTags] =
    relevantPlaceIds.length > 0
      ? await Promise.all([
          db.select().from(places).where(inArray(places.id, relevantPlaceIds)),
          db
            .select()
            .from(placeOccasions)
            .where(inArray(placeOccasions.placeId, relevantPlaceIds)),
          db.select().from(placeTags).where(inArray(placeTags.placeId, relevantPlaceIds)),
        ])
      : [[], [], []];

  const placeById = new Map(relevantPlaces.map((p) => [p.id, p]));

  // Distribuciones personales
  const cityCounts = new Map<string, number>();
  const priceCounts = new Map<string, number>();
  const occCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();

  for (const p of relevantPlaces) {
    if (p.city) cityCounts.set(p.city, (cityCounts.get(p.city) || 0) + 1);
    priceCounts.set(p.priceRange, (priceCounts.get(p.priceRange) || 0) + 1);
  }
  for (const po of relevantOccs) {
    occCounts.set(po.occasion, (occCounts.get(po.occasion) || 0) + 1);
  }
  for (const pt of relevantTags) {
    tagCounts.set(pt.tag, (tagCounts.get(pt.tag) || 0) + 1);
  }

  const topOccasions: CountItem[] = Array.from(occCounts.entries())
    .map(([id, count]) => ({
      label: occMap.get(id)?.name || id,
      icon: occMap.get(id)?.icon || "🍽️",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const priceOrder = ["€", "€€", "€€€", "€€€€", "???"];
  const priceDistribution: CountItem[] = priceOrder
    .map((p) => ({ label: p, count: priceCounts.get(p) || 0 }))
    .filter((item) => item.count > 0);

  // Cálculo del Wrapped anual
  const yearsSet = new Set<number>([new Date().getFullYear()]);
  myInteractions.forEach((i) => yearsSet.add(new Date(i.updatedAt).getFullYear()));
  myContributed.forEach((p) => yearsSet.add(new Date(p.createdAt).getFullYear()));
  const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

  const yearInteractionsVisited = myInteractions.filter(
    (i) =>
      i.personalStatus === "visited" &&
      new Date(i.updatedAt).getFullYear() === targetYear
  );
  const yearPlaceIds = Array.from(
    new Set(yearInteractionsVisited.map((i) => i.placeId))
  );

  const yearPlacesAdded = myContributed.filter(
    (p) => new Date(p.createdAt).getFullYear() === targetYear
  ).length;
  const yearCommentsPosted = myComments.filter(
    (c) => new Date(c.createdAt).getFullYear() === targetYear
  ).length;

  // Mejor valorado del año (o global del usuario si no puntuó ese año)
  let topRatedPlace: { name: string; city: string | null; rating: number } | null = null;
  const scoredYearInteractions = myInteractions
    .filter((i) => i.rating !== null && (yearPlaceIds.length === 0 || yearPlaceIds.includes(i.placeId)))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  if (scoredYearInteractions.length > 0) {
    const best = scoredYearInteractions[0];
    const p = placeById.get(best.placeId);
    if (p && best.rating !== null) {
      topRatedPlace = { name: p.name, city: p.city, rating: best.rating };
    }
  }

  // Ciudad, plan y tag estrella del año
  const yearCityMap = new Map<string, number>();
  const yearOccMap = new Map<string, number>();
  const yearTagMap = new Map<string, number>();
  const scopeIds = yearPlaceIds.length > 0 ? new Set(yearPlaceIds) : new Set(relevantPlaceIds);

  for (const pid of scopeIds) {
    const p = placeById.get(pid);
    if (p?.city) yearCityMap.set(p.city, (yearCityMap.get(p.city) || 0) + 1);
  }
  for (const po of relevantOccs) {
    if (scopeIds.has(po.placeId)) {
      yearOccMap.set(po.occasion, (yearOccMap.get(po.occasion) || 0) + 1);
    }
  }
  for (const pt of relevantTags) {
    if (scopeIds.has(pt.placeId)) {
      yearTagMap.set(pt.tag, (yearTagMap.get(pt.tag) || 0) + 1);
    }
  }

  const bestCity = topEntries(yearCityMap, 1)[0]?.label || null;
  const bestOccEntry = Array.from(yearOccMap.entries()).sort((a, b) => b[1] - a[1])[0];
  const bestTagEntry = Array.from(yearTagMap.entries()).sort((a, b) => b[1] - a[1])[0];

  const yearFavoritesCount = myInteractions.filter(
    (i) => i.favorite && (new Date(i.updatedAt).getFullYear() === targetYear || targetYear === new Date().getFullYear())
  ).length;
  const yearRatingsCount = myInteractions.filter(
    (i) => i.rating !== null && new Date(i.updatedAt).getFullYear() === targetYear
  ).length;

  return {
    visitedCount,
    pendingCount,
    favoritesCount,
    contributedPlacesCount: myContributed.length,
    commentsCount: myComments.length,
    averageRating,
    topCities: topEntries(cityCounts, 6),
    topOccasions,
    topTags: topEntries(tagCounts, 8),
    priceDistribution,
    wrapped: {
      year: targetYear,
      availableYears,
      uniquePlacesVisited: yearPlaceIds.length,
      favoritesCount: yearFavoritesCount,
      placesAdded: yearPlacesAdded,
      commentsPosted: yearCommentsPosted,
      ratingsCount: yearRatingsCount,
      topRatedPlace,
      topCity: bestCity,
      topOccasion: bestOccEntry
        ? {
            name: occMap.get(bestOccEntry[0])?.name || bestOccEntry[0],
            icon: occMap.get(bestOccEntry[0])?.icon || "🍽️",
            count: bestOccEntry[1],
          }
        : null,
      topTag: bestTagEntry ? { name: bestTagEntry[0], count: bestTagEntry[1] } : null,
    },
  };
}

/**
 * Estadísticas globales avanzadas de la plataforma (solo Administradores).
 * Respeta privacidad: nunca expone contenido de fichas privadas ni notas privadas.
 */
export async function getAdminStatsAction(): Promise<AdminStatsData | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") return null;

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    allUsers,
    allPlaces,
    allUserPlaces,
    allComments,
    allOccasions,
    allTags,
    allPlaceOccs,
    allPlaceTags,
    allGroups,
  ] = await Promise.all([
    db.select().from(users),
    db.select().from(places),
    db.select().from(userPlaces),
    db.select().from(placeComments),
    db.select().from(occasions),
    db.select().from(tags),
    db.select().from(placeOccasions),
    db.select().from(placeTags),
    db.select().from(sharingGroups),
  ]);

  const occMap = new Map(allOccasions.map((o) => [o.id, { name: o.name, icon: o.icon }]));

  const activeUsers = allUsers.filter((u) => u.status !== "disabled").length;
  const disabledUsers = allUsers.length - activeUsers;

  const communityPlacesList = allPlaces.filter((p) => p.communityPublished);
  const communityPlaceIds = new Set(communityPlacesList.map((p) => p.id));
  const privatePlaces = allPlaces.length - communityPlacesList.length;

  const visitedMarks = allUserPlaces.filter((up) => up.personalStatus === "visited");

  // Actividad últimos 30 días
  const last30Days = {
    places: allPlaces.filter((p) => new Date(p.createdAt) >= since30d).length,
    comments: allComments.filter((c) => new Date(c.createdAt) >= since30d).length,
    visits: visitedMarks.filter((up) => new Date(up.updatedAt) >= since30d).length,
    users: allUsers.filter((u) => new Date(u.createdAt) >= since30d).length,
  };

  // Top contribuidores (por sitios comunitarios + comentarios)
  const placesByUser = new Map<string, number>();
  const commentsByUser = new Map<string, number>();
  for (const p of communityPlacesList) {
    placesByUser.set(p.createdById, (placesByUser.get(p.createdById) || 0) + 1);
  }
  for (const c of allComments) {
    commentsByUser.set(c.userId, (commentsByUser.get(c.userId) || 0) + 1);
  }

  const topContributors = allUsers
    .map((u) => ({
      userId: u.id,
      name: u.name,
      username: u.username,
      placesCount: placesByUser.get(u.id) || 0,
      commentsCount: commentsByUser.get(u.id) || 0,
    }))
    .filter((c) => c.placesCount > 0 || c.commentsCount > 0)
    .sort((a, b) => b.placesCount * 2 + b.commentsCount - (a.placesCount * 2 + a.commentsCount))
    .slice(0, 8);

  // Top sitios comunitarios más populares
  const favByPlace = new Map<string, number>();
  const visByPlace = new Map<string, number>();
  const ratingsByPlace = new Map<string, number[]>();
  const commByPlace = new Map<string, number>();

  for (const up of allUserPlaces) {
    if (!communityPlaceIds.has(up.placeId)) continue;
    if (up.favorite) favByPlace.set(up.placeId, (favByPlace.get(up.placeId) || 0) + 1);
    if (up.personalStatus === "visited") {
      visByPlace.set(up.placeId, (visByPlace.get(up.placeId) || 0) + 1);
    }
    if (up.rating !== null && up.rating !== undefined) {
      const arr = ratingsByPlace.get(up.placeId) || [];
      arr.push(up.rating);
      ratingsByPlace.set(up.placeId, arr);
    }
  }
  for (const c of allComments) {
    if (communityPlaceIds.has(c.placeId)) {
      commByPlace.set(c.placeId, (commByPlace.get(c.placeId) || 0) + 1);
    }
  }

  const topPopularPlaces = communityPlacesList
    .map((p) => {
      const rList = ratingsByPlace.get(p.id) || [];
      const avgRating =
        rList.length > 0
          ? Math.round((rList.reduce((a, b) => a + b, 0) / rList.length) * 10) / 10
          : null;
      return {
        placeId: p.id,
        name: p.name,
        city: p.city,
        priceRange: p.priceRange,
        favoritesCount: favByPlace.get(p.id) || 0,
        visitedCount: visByPlace.get(p.id) || 0,
        commentsCount: commByPlace.get(p.id) || 0,
        avgRating,
      };
    })
    .sort(
      (a, b) =>
        b.favoritesCount * 3 +
        b.visitedCount * 2 +
        b.commentsCount -
        (a.favoritesCount * 3 + a.visitedCount * 2 + a.commentsCount)
    )
    .slice(0, 8);

  // Distribuciones globales (sobre catálogo comunitario)
  const cityCounts = new Map<string, number>();
  const priceCounts = new Map<string, number>();
  const occCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();

  for (const p of communityPlacesList) {
    if (p.city) cityCounts.set(p.city, (cityCounts.get(p.city) || 0) + 1);
    priceCounts.set(p.priceRange, (priceCounts.get(p.priceRange) || 0) + 1);
  }
  for (const po of allPlaceOccs) {
    if (communityPlaceIds.has(po.placeId)) {
      occCounts.set(po.occasion, (occCounts.get(po.occasion) || 0) + 1);
    }
  }
  for (const pt of allPlaceTags) {
    if (communityPlaceIds.has(pt.placeId)) {
      tagCounts.set(pt.tag, (tagCounts.get(pt.tag) || 0) + 1);
    }
  }

  const topOccasionsGlobal: CountItem[] = Array.from(occCounts.entries())
    .map(([id, count]) => ({
      label: occMap.get(id)?.name || id,
      icon: occMap.get(id)?.icon || "🍽️",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const priceOrder = ["€", "€€", "€€€", "€€€€", "???"];
  const priceDistributionGlobal: CountItem[] = priceOrder
    .map((p) => ({ label: p, count: priceCounts.get(p) || 0 }))
    .filter((i) => i.count > 0);

  return {
    totalUsers: allUsers.length,
    activeUsers,
    disabledUsers,
    totalPlaces: allPlaces.length,
    communityPlaces: communityPlacesList.length,
    privatePlaces,
    totalComments: allComments.length,
    totalVisits: visitedMarks.length,
    totalGroups: allGroups.length,
    totalOccasions: allOccasions.length,
    totalTags: allTags.length,
    last30Days,
    topContributors,
    topPopularPlaces,
    topCitiesGlobal: topEntries(cityCounts, 8),
    topOccasionsGlobal,
    topTagsGlobal: topEntries(tagCounts, 10),
    priceDistributionGlobal,
  };
}
