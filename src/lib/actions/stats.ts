"use server";

import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
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
  sharingGroupMembers,
  groupJoinRequests,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getGroupMembership } from "@/lib/workspace";
import { isPublicRegistrationEnabled } from "@/lib/actions/settings";
import { getGlobalApiUsageSummary } from "@/lib/places-api";
import { isValidGoogleMapsUrl } from "@/lib/maps";

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
  unexploredCount: number;
  totalAvailablePlaces: number;
  favoritesCount: number;
  contributedPlacesCount: number;
  commentsCount: number;
  averageRating: number | null;
  topCities: CountItem[];
  topCountries: CountItem[];
  topOccasions: CountItem[];
  topTags: CountItem[];
  priceDistribution: CountItem[];
  availableSpaces: Array<{ id: string; name: string; icon: string }>;
  groupBreakdown: Array<{
    groupId: string;
    name: string;
    icon: string;
    role: "owner" | "admin" | "member";
    placesAdded: number;
    commentsCount: number;
    visitedCount: number;
  }>;
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
  activeGroupsCount: number;
  emptyGroupsCount: number;
  trashPlacesCount: number;
  totalOccasions: number;
  totalTags: number;
  publicRegistrationEnabled: boolean;
  apiUsage: {
    projectRequests: number;
    projectCacheHits: number;
    globalLimit: number;
  };
  last30Days: {
    places: number;
    comments: number;
    visits: number;
    users: number;
  };
  topGroups: Array<{
    groupId: string;
    name: string;
    icon: string;
    ownerName: string;
    ownerUsername: string | null;
    membersCount: number;
    placesCount: number;
  }>;
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
export async function getUserStatsAction(
  selectedYear?: number,
  spaceFilter: string = "all"
): Promise<UserStatsData | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const targetYear = selectedYear || new Date().getFullYear();

  const [allMyInteractions, allMyContributed, allMyComments, allOccasions, myMemberGroups] =
    await Promise.all([
      db.select().from(userPlaces).where(eq(userPlaces.userId, user.id)),
      db.select().from(places).where(and(eq(places.createdById, user.id), isNull(places.deletedAt))),
      db.select().from(placeComments).where(eq(placeComments.userId, user.id)),
      db.select().from(occasions),
      db
        .select({
          groupId: sharingGroups.id,
          name: sharingGroups.name,
          icon: sharingGroups.icon,
          ownerUserId: sharingGroups.ownerUserId,
          role: sharingGroupMembers.role,
        })
        .from(sharingGroupMembers)
        .innerJoin(sharingGroups, eq(sharingGroupMembers.groupId, sharingGroups.id))
        .where(eq(sharingGroupMembers.userId, user.id)),
    ]);

  const occMap = new Map(allOccasions.map((o) => [o.id, { name: o.name, icon: o.icon }]));

  const allRelevantPlaceIds = Array.from(
    new Set([
      ...allMyInteractions.map((i) => i.placeId),
      ...allMyContributed.map((p) => p.id),
      ...allMyComments.map((c) => c.placeId),
    ])
  );

  const [allRelevantPlaces, relevantOccs, relevantTags] =
    allRelevantPlaceIds.length > 0
      ? await Promise.all([
          db
            .select()
            .from(places)
            .where(and(inArray(places.id, allRelevantPlaceIds), isNull(places.deletedAt))),
          db
            .select()
            .from(placeOccasions)
            .where(inArray(placeOccasions.placeId, allRelevantPlaceIds)),
          db.select().from(placeTags).where(inArray(placeTags.placeId, allRelevantPlaceIds)),
        ])
      : [[], [], []];

  // Resumen por grupo del usuario (siempre sobre todos sus grupos)
  const rawPlaceById = new Map(allRelevantPlaces.map((p) => [p.id, p]));
  const groupBreakdown = myMemberGroups
    .map((g) => {
      const placesAdded = allMyContributed.filter((p) => p.groupId === g.groupId).length;
      const commentsCount = allMyComments.filter(
        (c) => rawPlaceById.get(c.placeId)?.groupId === g.groupId
      ).length;
      const groupVisitedCount = allMyInteractions.filter(
        (i) => i.personalStatus === "visited" && rawPlaceById.get(i.placeId)?.groupId === g.groupId
      ).length;
      const role: "owner" | "admin" | "member" =
        g.ownerUserId === user.id ? "owner" : g.role === "admin" ? "admin" : "member";
      return {
        groupId: g.groupId,
        name: g.name,
        icon: g.icon || "🍻",
        role,
        placesAdded,
        commentsCount,
        visitedCount: groupVisitedCount,
      };
    })
    .sort((a, b) => b.placesAdded - a.placesAdded || a.name.localeCompare(b.name, "es"));

  const myGroupIds = myMemberGroups.map((g) => g.groupId);
  const scopeWhere =
    spaceFilter === "personal"
      ? and(isNull(places.groupId), eq(places.createdById, user.id), isNull(places.deletedAt))
      : spaceFilter !== "all"
        ? myGroupIds.includes(spaceFilter)
          ? and(eq(places.groupId, spaceFilter), isNull(places.deletedAt))
          : null
        : myGroupIds.length > 0
          ? and(
              or(
                inArray(places.groupId, myGroupIds),
                and(isNull(places.groupId), eq(places.createdById, user.id))
              ),
              isNull(places.deletedAt)
            )
          : and(isNull(places.groupId), eq(places.createdById, user.id), isNull(places.deletedAt));

  const scopePlacesRows = scopeWhere
    ? await db.select({ id: places.id }).from(places).where(scopeWhere)
    : [];
  const totalAvailablePlaces = scopePlacesRows.length;

  const availableSpaces = myMemberGroups
    .map((g) => ({ id: g.groupId, name: g.name, icon: g.icon || "🍻" }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  // Filtrar según spaceFilter ('all' | 'personal' | '<groupId>')
  const relevantPlaces = allRelevantPlaces.filter((p) => {
    if (spaceFilter === "personal") return p.groupId === null;
    if (spaceFilter !== "all") return p.groupId === spaceFilter;
    return true;
  });
  const allowedPlaceIds = new Set(relevantPlaces.map((p) => p.id));

  const myInteractions = allMyInteractions.filter((i) => allowedPlaceIds.has(i.placeId));
  const myContributed = allMyContributed.filter((p) => allowedPlaceIds.has(p.id));
  const myComments = allMyComments.filter((c) => allowedPlaceIds.has(c.placeId));
  const relevantPlaceIds = relevantPlaces.map((p) => p.id);

  const visitedCount = myInteractions.filter((i) => i.personalStatus === "visited").length;
  const pendingCount = myInteractions.filter((i) => i.personalStatus === "pending").length;
  const unexploredCount = Math.max(0, totalAvailablePlaces - visitedCount - pendingCount);
  const favoritesCount = myInteractions.filter((i) => i.favorite).length;

  const ratings = myInteractions
    .map((i) => i.rating)
    .filter((r): r is number => r !== null && r !== undefined);
  const averageRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

  const placeById = new Map(relevantPlaces.map((p) => [p.id, p]));

  // Distribuciones personales (filtradas estrictamente por allowedPlaceIds)
  const cityCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const priceCounts = new Map<string, number>();
  const occCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();

  for (const p of relevantPlaces) {
    if (p.city) cityCounts.set(p.city, (cityCounts.get(p.city) || 0) + 1);
    if (p.country) countryCounts.set(p.country, (countryCounts.get(p.country) || 0) + 1);
    priceCounts.set(p.priceRange, (priceCounts.get(p.priceRange) || 0) + 1);
  }
  for (const po of relevantOccs) {
    if (!allowedPlaceIds.has(po.placeId)) continue;
    occCounts.set(po.occasion, (occCounts.get(po.occasion) || 0) + 1);
  }
  for (const pt of relevantTags) {
    if (!allowedPlaceIds.has(pt.placeId)) continue;
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
    (i) => i.favorite && new Date(i.updatedAt).getFullYear() === targetYear
  ).length;
  const yearRatingsCount = myInteractions.filter(
    (i) => i.rating !== null && new Date(i.updatedAt).getFullYear() === targetYear
  ).length;

  return {
    visitedCount,
    pendingCount,
    unexploredCount,
    totalAvailablePlaces,
    favoritesCount,
    contributedPlacesCount: myContributed.length,
    commentsCount: myComments.length,
    averageRating,
    topCities: topEntries(cityCounts, 6),
    topCountries: topEntries(countryCounts, 6),
    topOccasions,
    topTags: topEntries(tagCounts, 8),
    priceDistribution,
    availableSpaces,
    groupBreakdown,
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
    allGroupMembers,
    publicRegistrationEnabled,
    deletedPlacesRows,
    globalApiUsage,
  ] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users),
    db
      .select({
        id: places.id,
        name: places.name,
        city: places.city,
        priceRange: places.priceRange,
        groupId: places.groupId,
        communityPublished: places.communityPublished,
        createdById: places.createdById,
        createdAt: places.createdAt,
      })
      .from(places)
      .where(isNull(places.deletedAt)),
    db
      .select({
        placeId: userPlaces.placeId,
        personalStatus: userPlaces.personalStatus,
        favorite: userPlaces.favorite,
        rating: userPlaces.rating,
        updatedAt: userPlaces.updatedAt,
      })
      .from(userPlaces),
    db
      .select({
        placeId: placeComments.placeId,
        userId: placeComments.userId,
        createdAt: placeComments.createdAt,
      })
      .from(placeComments),
    db.select({ id: occasions.id, name: occasions.name, icon: occasions.icon }).from(occasions),
    db.select({ id: tags.id }).from(tags),
    db.select({ placeId: placeOccasions.placeId, occasion: placeOccasions.occasion }).from(placeOccasions),
    db.select({ placeId: placeTags.placeId, tag: placeTags.tag }).from(placeTags),
    db
      .select({
        id: sharingGroups.id,
        name: sharingGroups.name,
        icon: sharingGroups.icon,
        ownerUserId: sharingGroups.ownerUserId,
      })
      .from(sharingGroups),
    db.select({ groupId: sharingGroupMembers.groupId }).from(sharingGroupMembers),
    isPublicRegistrationEnabled(),
    db.select({ id: places.id }).from(places).where(isNotNull(places.deletedAt)),
    getGlobalApiUsageSummary(),
  ]);

  const occMap = new Map(allOccasions.map((o) => [o.id, { name: o.name, icon: o.icon }]));

  const activeUsers = allUsers.filter((u) => u.status !== "disabled").length;
  const disabledUsers = allUsers.length - activeUsers;

  // En v0.2.0 la separación real es Sitios en Grupos (groupId !== null) vs Mapas Personales (groupId === null)
  const communityPlacesList = allPlaces.filter((p) => p.groupId !== null);
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

  const userById = new Map(allUsers.map((u) => [u.id, u]));
  const membersByGroup = new Map<string, number>();
  for (const gm of allGroupMembers) {
    membersByGroup.set(gm.groupId, (membersByGroup.get(gm.groupId) || 0) + 1);
  }
  const placesByGroup = new Map<string, number>();
  for (const p of allPlaces) {
    if (p.groupId) {
      placesByGroup.set(p.groupId, (placesByGroup.get(p.groupId) || 0) + 1);
    }
  }
  const topGroups = allGroups
    .map((g) => {
      const owner = userById.get(g.ownerUserId);
      return {
        groupId: g.id,
        name: g.name,
        icon: g.icon || "🍻",
        ownerName: owner?.name || "—",
        ownerUsername: owner?.username || null,
        membersCount: Math.max(1, membersByGroup.get(g.id) || 0),
        placesCount: placesByGroup.get(g.id) || 0,
      };
    })
    .sort((a, b) => b.placesCount * 3 + b.membersCount - (a.placesCount * 3 + a.membersCount))
    .slice(0, 6);

  const activeGroupsCount = allGroups.filter((g) => (placesByGroup.get(g.id) || 0) > 0).length;
  const emptyGroupsCount = Math.max(0, allGroups.length - activeGroupsCount);

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
    activeGroupsCount,
    emptyGroupsCount,
    trashPlacesCount: deletedPlacesRows.length,
    totalOccasions: allOccasions.length,
    totalTags: allTags.length,
    publicRegistrationEnabled,
    apiUsage: {
      projectRequests: globalApiUsage.projectRequests,
      projectCacheHits: globalApiUsage.projectCacheHits,
      globalLimit: globalApiUsage.globalLimit,
    },
    last30Days,
    topGroups,
    topContributors,
    topPopularPlaces,
    topCitiesGlobal: topEntries(cityCounts, 8),
    topOccasionsGlobal,
    topTagsGlobal: topEntries(tagCounts, 10),
    priceDistributionGlobal,
  };
}

export interface GroupStatsData {
  groupId: string;
  groupName: string;
  membersCount: number;
  placesCount: number;
  commentsCount: number;
  visitedMarksCount: number;
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
  topCities: CountItem[];
  topOccasions: CountItem[];
  topTags: CountItem[];
  priceDistribution: CountItem[];
  last30Days: {
    places: number;
    comments: number;
    visits: number;
  };
  health: {
    invalidLinks: number;
    missingCoords: number;
    pendingRequests: number;
    trashCount: number;
  };
}

/**
 * Estadísticas específicas de un grupo (accesible para Admins del grupo o Superadmin).
 */
export async function getGroupStatsAction(groupId: string): Promise<GroupStatsData | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const membership = await getGroupMembership(currentUser.id, groupId);
  if (!membership.isMember && currentUser.role !== "admin") return null;

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [[group], groupMembers, groupPlaces, groupOccasions, pendingReqRows, trashRows] =
    await Promise.all([
      db.select().from(sharingGroups).where(eq(sharingGroups.id, groupId)).limit(1),
      db
        .select({
          userId: users.id,
          name: users.name,
          username: users.username,
        })
        .from(sharingGroupMembers)
        .innerJoin(users, eq(sharingGroupMembers.userId, users.id))
        .where(eq(sharingGroupMembers.groupId, groupId)),
      db.select().from(places).where(and(eq(places.groupId, groupId), isNull(places.deletedAt))),
      db.select({ id: occasions.id, name: occasions.name, icon: occasions.icon }).from(occasions),
      db
        .select({ id: groupJoinRequests.id })
        .from(groupJoinRequests)
        .where(and(eq(groupJoinRequests.groupId, groupId), eq(groupJoinRequests.status, "pending"))),
      db
        .select({ id: places.id })
        .from(places)
        .where(and(eq(places.groupId, groupId), isNotNull(places.deletedAt))),
    ]);

  if (!group) return null;

  const occMap = new Map(groupOccasions.map((o) => [o.id, { name: o.name, icon: o.icon }]));

  const placeIds = groupPlaces.map((p) => p.id);
  const [groupUserPlaces, groupComments, groupPlaceOccs, groupPlaceTags] =
    placeIds.length > 0
      ? await Promise.all([
          db.select().from(userPlaces).where(inArray(userPlaces.placeId, placeIds)),
          db.select().from(placeComments).where(inArray(placeComments.placeId, placeIds)),
          db.select().from(placeOccasions).where(inArray(placeOccasions.placeId, placeIds)),
          db.select().from(placeTags).where(inArray(placeTags.placeId, placeIds)),
        ])
      : [[], [], [], []];

  const placesByUser = new Map<string, number>();
  const commentsByUser = new Map<string, number>();
  for (const p of groupPlaces) {
    placesByUser.set(p.createdById, (placesByUser.get(p.createdById) || 0) + 1);
  }
  for (const c of groupComments) {
    commentsByUser.set(c.userId, (commentsByUser.get(c.userId) || 0) + 1);
  }

  const topContributors = groupMembers
    .map((m) => ({
      userId: m.userId,
      name: m.name,
      username: m.username,
      placesCount: placesByUser.get(m.userId) || 0,
      commentsCount: commentsByUser.get(m.userId) || 0,
    }))
    .filter((c) => c.placesCount > 0 || c.commentsCount > 0)
    .sort((a, b) => b.placesCount * 2 + b.commentsCount - (a.placesCount * 2 + a.commentsCount))
    .slice(0, 6);

  const favByPlace = new Map<string, number>();
  const visByPlace = new Map<string, number>();
  const ratingsByPlace = new Map<string, number[]>();
  const commByPlace = new Map<string, number>();

  for (const up of groupUserPlaces) {
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
  for (const c of groupComments) {
    commByPlace.set(c.placeId, (commByPlace.get(c.placeId) || 0) + 1);
  }

  const topPopularPlaces = groupPlaces
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
    .slice(0, 6);

  const cityCounts = new Map<string, number>();
  const priceCounts = new Map<string, number>();
  const occCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();

  let invalidLinks = 0;
  let missingCoords = 0;
  for (const p of groupPlaces) {
    if (p.city) cityCounts.set(p.city, (cityCounts.get(p.city) || 0) + 1);
    priceCounts.set(p.priceRange, (priceCounts.get(p.priceRange) || 0) + 1);
    if (p.googleMapsUrl && !isValidGoogleMapsUrl(p.googleMapsUrl)) invalidLinks++;
    if (p.latitude === null || p.longitude === null) missingCoords++;
  }
  for (const po of groupPlaceOccs) {
    occCounts.set(po.occasion, (occCounts.get(po.occasion) || 0) + 1);
  }
  for (const pt of groupPlaceTags) {
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
    .filter((i) => i.count > 0);

  const visitedMarks = groupUserPlaces.filter((u) => u.personalStatus === "visited");
  const last30Days = {
    places: groupPlaces.filter((p) => new Date(p.createdAt) >= since30d).length,
    comments: groupComments.filter((c) => new Date(c.createdAt) >= since30d).length,
    visits: visitedMarks.filter((u) => new Date(u.updatedAt) >= since30d).length,
  };

  return {
    groupId: group.id,
    groupName: group.name,
    membersCount: Math.max(1, groupMembers.length),
    placesCount: groupPlaces.length,
    commentsCount: groupComments.length,
    visitedMarksCount: visitedMarks.length,
    topContributors,
    topPopularPlaces,
    topCities: topEntries(cityCounts, 6),
    topOccasions,
    topTags: topEntries(tagCounts, 8),
    priceDistribution,
    last30Days,
    health: {
      invalidLinks,
      missingCoords,
      pendingRequests: pendingReqRows.length,
      trashCount: trashRows.length,
    },
  };
}
