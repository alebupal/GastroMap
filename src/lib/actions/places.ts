"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq, desc, and, or, isNull, isNotNull, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  places,
  placeOccasions,
  occasions as occasionsTable,
  placeTags,
  tags,
  users,
  userPlaces,
  placeComments,
  placeListItems,
  sharingGroups,
  sharingGroupMembers,
  type Place,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  ACTIVE_SPACE_COOKIE,
  buildScopeKey,
  getActiveWorkspace,
  getGroupMembership,
  getPlacePermissions,
} from "@/lib/workspace";
import { KNOWN_OCCASIONS } from "@/data/occasions";
import {
  resolveGoogleMapsDetails,
  parseGoogleMapsUrl,
  fetchGooglePlacesDetails,
  suggestOccasionsFromMetadata,
  looksLikeStreetAddress,
} from "@/lib/maps";
import { getSetting } from "@/lib/actions/settings";
import {
  searchAddressNominatim,
  reverseGeocodeNominatim,
  type GeocodingResult,
} from "@/lib/geocoding";
import { parseCityCountry } from "@/lib/location";

export interface PlaceWithDetails extends Place {
  createdByName: string;
  createdByUsername?: string | null;
  occasions: string[];
  tags: string[];
  distanceMeters?: number | null;
  isFavorite?: boolean;
  personalStatus?: "pending" | "visited" | null;
  rating?: number | null;
  privateNotes?: string | null;
  commentsCount?: number;
  commentsTexts?: string[];
  commentAuthors?: string[];
  experienceStatus?: "visited_by_me" | "visited_by_others" | "untried";
  groupName?: string | null;
  groupIcon?: string | null;
  canEdit?: boolean;
  canDelete?: boolean;
  pendingUserIds?: string[];
  visitedUserIds?: string[];
  favoriteUserIds?: string[];
  highRatedUserIds?: string[];
}

export interface CommunityUserSummary {
  id: string;
  name: string;
  username: string | null;
}

/**
 * Devuelve únicamente los integrantes activos del espacio actual (aislamiento v2):
 * - Modo grupo: solo miembros activos de ese grupo.
 * - Modo personal: lista vacía (mapa individual).
 * - Modo todos: miembros de los grupos a los que pertenece el usuario.
 */
export async function getCommunityUsers(
  explicitGroupId?: string | null
): Promise<CommunityUserSummary[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  let targetGroupIds: string[] = [];

  if (explicitGroupId !== undefined) {
    if (!explicitGroupId) return [];
    const membership = await getGroupMembership(currentUser.id, explicitGroupId);
    if (!membership.isMember && currentUser.role !== "admin") return [];
    targetGroupIds = [explicitGroupId];
  } else {
    const workspace = await getActiveWorkspace();
    if (!workspace || workspace.mode === "personal") return [];
    if (workspace.mode === "group" && workspace.groupId) {
      targetGroupIds = [workspace.groupId];
    } else if (workspace.mode === "all") {
      targetGroupIds = workspace.myGroups.map((g) => g.id);
    }
  }

  if (targetGroupIds.length === 0) return [];

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
    })
    .from(sharingGroupMembers)
    .innerJoin(users, eq(sharingGroupMembers.userId, users.id))
    .where(
      and(inArray(sharingGroupMembers.groupId, targetGroupIds), eq(users.status, "active"))
    );

  const unique = new Map<string, CommunityUserSummary>();
  for (const r of rows) {
    unique.set(r.id, r);
  }

  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export interface UserCoordinates {
  latitude: number;
  longitude: number;
  radiusKm?: number;
}

export interface CreatePlaceResult {
  success?: boolean;
  error?: string;
  placeId?: string;
}

export async function parseUrlAction(rawUrl: string) {
  const [resolvedDetails, googlePlacesApiKey] = await Promise.all([
    resolveGoogleMapsDetails(rawUrl),
    getSetting("google_places_api_key"),
  ]);
  const parsed = parseGoogleMapsUrl(resolvedDetails.resolvedUrl);

  let latitude = parsed.latitude ?? resolvedDetails.htmlLat;
  let longitude = parsed.longitude ?? resolvedDetails.htmlLng;
  let name = parsed.name || resolvedDetails.ogName;
  let address = resolvedDetails.ogAddress;
  if (name && looksLikeStreetAddress(name)) {
    if (!address) address = name;
    name = undefined;
  }
  let priceRange = resolvedDetails.ogPriceRange;
  let description: string | undefined;
  let website: string | undefined;
  let phone: string | undefined;
  let googleTypes: string[] | undefined;
  let source: "google_places" | "openstreetmap" | "url" = "url";

  if (googlePlacesApiKey && (name || address)) {
    const query = [name, address].filter(Boolean).join(", ");
    const gp = await fetchGooglePlacesDetails({
      apiKey: googlePlacesApiKey,
      query,
      latitude,
      longitude,
    });
    if (gp) {
      source = "google_places";
      const isAddressOnlyType =
        gp.primaryType === "route" ||
        gp.primaryType === "street_address" ||
        gp.primaryType === "premise";
      if (gp.name && !isAddressOnlyType && !looksLikeStreetAddress(gp.name)) {
        name = gp.name;
      }
      if (gp.address) address = gp.address;
      if (gp.latitude != null) latitude = gp.latitude;
      if (gp.longitude != null) longitude = gp.longitude;
      if (gp.priceRange) priceRange = gp.priceRange;
      if (gp.description) description = gp.description;
      if (gp.website) website = gp.website;
      if (gp.phone) phone = gp.phone;
      googleTypes = [
        ...(gp.primaryType ? [gp.primaryType] : []),
        ...(gp.types || []),
      ];
    }
  }

  let locationDetails: GeocodingResult | null = null;
  if (latitude && longitude) {
    locationDetails = await reverseGeocodeNominatim(latitude, longitude);
  } else if (address || name) {
    const fallbackResults = await searchAddressNominatim(address || name || "");
    if (fallbackResults.length > 0) {
      locationDetails = fallbackResults[0];
    }
  }

  if (locationDetails) {
    if (source === "url") source = "openstreetmap";
    if (!description) {
      if (locationDetails.extratags?.description) {
        description = locationDetails.extratags.description;
      } else if (locationDetails.extratags?.cuisine) {
        const cleanCuisine = locationDetails.extratags.cuisine
          .split(";")
          .map((c) => c.replace(/_/g, " ").trim())
          .filter(Boolean)
          .join(", ");
        if (cleanCuisine) description = `Cocina: ${cleanCuisine}`;
      }
    }
    if (!website && locationDetails.extratags?.website) {
      website = locationDetails.extratags.website;
    }
    if (!phone && locationDetails.extratags?.phone) {
      phone = locationDetails.extratags.phone;
    }
  }

  const suggestedOccasions = suggestOccasionsFromMetadata({
    types: googleTypes,
    categoryHint: resolvedDetails.ogCategoryHint,
    cuisine: locationDetails?.extratags?.cuisine,
    amenity: locationDetails?.extratags?.amenity,
  });

  const safeLocationName =
    locationDetails?.name &&
    locationDetails.name.trim().toLowerCase() !== (locationDetails.road || "").trim().toLowerCase() &&
    locationDetails.name.trim().toLowerCase() !== (locationDetails.city || "").trim().toLowerCase() &&
    !looksLikeStreetAddress(locationDetails.name)
      ? locationDetails.name
      : undefined;

  return {
    ...parsed,
    name: name || safeLocationName,
    address:
      address ||
      (locationDetails?.road
        ? `${locationDetails.road}${locationDetails.postcode ? `, ${locationDetails.postcode}` : ""}`
        : undefined),
    priceRange,
    description,
    suggestedOccasions,
    website,
    phone,
    source,
    categoryHint: resolvedDetails.ogCategoryHint,
    latitude: latitude ?? locationDetails?.latitude,
    longitude: longitude ?? locationDetails?.longitude,
    resolvedUrl: resolvedDetails.resolvedUrl,
    locationDetails,
  };
}

export async function searchAddressAction(query: string): Promise<GeocodingResult[]> {
  return searchAddressNominatim(query);
}

export async function reverseGeocodeAction(
  lat: number,
  lng: number
): Promise<GeocodingResult | null> {
  return reverseGeocodeNominatim(lat, lng);
}

async function resolveTargetGroupIdFromSpace(
  rawSpace: string | null | undefined,
  userId: string
): Promise<{ groupId: string | null; error?: string }> {
  const clean = (rawSpace || "").trim();
  if (!clean) {
    const ws = await getActiveWorkspace();
    if (!ws || ws.mode === "personal") return { groupId: null };
    if (ws.mode === "group" && ws.groupId) return { groupId: ws.groupId };
    if (ws.myGroups.length > 0) return { groupId: ws.myGroups[0].id };
    return { groupId: null };
  }

  if (clean === "personal") return { groupId: null };

  const groupId = clean.startsWith("group:") ? clean.slice("group:".length) : clean;
  const membership = await getGroupMembership(userId, groupId);
  if (!membership.isMember) {
    return { groupId: null, error: "No perteneces al grupo seleccionado." };
  }
  return { groupId };
}

export async function createPlaceAction(formData: FormData): Promise<CreatePlaceResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "Debes iniciar sesión para añadir un sitio." };
  }

  const name = (formData.get("name") as string)?.trim();
  const address = (formData.get("address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const explicitCountry = (formData.get("country") as string)?.trim() || null;
  const country = explicitCountry || parseCityCountry(city, address).country || null;
  const googleMapsUrl = (formData.get("googleMapsUrl") as string)?.trim() || null;
  const priceRange = (formData.get("priceRange") as string) || "???";
  const notes = (formData.get("notes") as string)?.trim() || null;
  const website = (formData.get("website") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;

  const latStr = formData.get("latitude") as string;
  const lngStr = formData.get("longitude") as string;
  const latitude = latStr ? parseFloat(latStr) : null;
  const longitude = lngStr ? parseFloat(lngStr) : null;

  const occasionsSelected = formData.getAll("occasions") as string[];

  if (!name || name.length < 2) {
    return { error: "El nombre del establecimiento es obligatorio." };
  }

  if (latitude === null || isNaN(latitude) || longitude === null || isNaN(longitude)) {
    return {
      error:
        "Las coordenadas (latitud y longitud) son obligatorias para situar el establecimiento en el mapa.",
    };
  }

  // Determinar espacio destino (targetSpace tiene prioridad; compatibilidad si viene communityPublished=false)
  const rawTargetSpace = formData.get("targetSpace") as string | null;
  const legacyPrivate =
    !rawTargetSpace && formData.get("communityPublished") === "false" ? "personal" : rawTargetSpace;

  const target = await resolveTargetGroupIdFromSpace(legacyPrivate, currentUser.id);
  if (target.error) {
    return { error: target.error };
  }

  const targetGroupId = target.groupId;
  const scopeKey = buildScopeKey(targetGroupId, currentUser.id);

  const [newPlace] = await db
    .insert(places)
    .values({
      groupId: targetGroupId,
      name,
      address,
      city,
      country,
      latitude,
      longitude,
      googleMapsUrl,
      priceRange,
      notes,
      communityPublished: targetGroupId !== null,
      website,
      phone,
      createdById: currentUser.id,
    })
    .returning();

  if (occasionsSelected.length > 0) {
    await db
      .insert(occasionsTable)
      .values(
        occasionsSelected.map((occId) => {
          const cleanOcc = occId.trim().toLowerCase();
          const known = KNOWN_OCCASIONS[cleanOcc];
          return {
            scopeKey,
            id: cleanOcc,
            name: known
              ? known.name
              : cleanOcc.charAt(0).toUpperCase() + cleanOcc.slice(1).replace(/[-_]/g, " "),
            icon: known ? known.icon : "🍽️",
          };
        })
      )
      .onConflictDoNothing();

    await db.insert(placeOccasions).values(
      occasionsSelected.map((occ) => ({
        placeId: newPlace.id,
        occasion: occ,
      }))
    );
  }

  const formTags = (formData.getAll("tags") as string[])
    .flatMap((t) => t.split(","))
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  const uniqueTags = Array.from(new Set(formTags));
  if (uniqueTags.length > 0) {
    await db
      .insert(tags)
      .values(uniqueTags.map((t) => ({ scopeKey, id: t, name: t })))
      .onConflictDoNothing();

    await db.insert(placeTags).values(
      uniqueTags.map((t) => ({
        placeId: newPlace.id,
        tag: t,
      }))
    );
  }

  // Sincronizar cookie del espacio activo para que al volver a '/' muestre el espacio donde se guardó
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SPACE_COOKIE, targetGroupId ? `group:${targetGroupId}` : "personal", {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
  });

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "place",
    entityId: newPlace.id,
    action: "place_created",
    metadata: { name, city, groupId: targetGroupId },
  });

  revalidatePath("/");
  redirect(`/?focus=${encodeURIComponent(newPlace.id)}`);
}

export async function updatePlaceAction(
  placeId: string,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "Debes iniciar sesión para editar un sitio." };
  }

  const [existing] = await db
    .select()
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);

  if (!existing) {
    return { error: "Establecimiento no encontrado." };
  }

  const perms = await getPlacePermissions(currentUser, existing);
  if (!perms.canEdit) {
    return { error: "No tienes permiso para editar este establecimiento." };
  }

  const name = (formData.get("name") as string)?.trim();
  if (!name || name.length < 2) {
    return { error: "El nombre del establecimiento es obligatorio." };
  }

  const address = (formData.get("address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const explicitCountry = (formData.get("country") as string)?.trim() || null;
  const country = explicitCountry || parseCityCountry(city, address).country || null;
  const googleMapsUrl = (formData.get("googleMapsUrl") as string)?.trim() || null;
  const website = (formData.get("website") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const priceRange = (formData.get("priceRange") as string) || "???";
  const notes = (formData.get("notes") as string)?.trim() || null;

  const latStr = (formData.get("latitude") as string)?.trim();
  const lngStr = (formData.get("longitude") as string)?.trim();
  const parsedLat = latStr ? parseFloat(latStr) : null;
  const parsedLng = lngStr ? parseFloat(lngStr) : null;
  const latitude = parsedLat !== null && !isNaN(parsedLat) ? parsedLat : null;
  const longitude = parsedLng !== null && !isNaN(parsedLng) ? parsedLng : null;

  if (latitude === null || isNaN(latitude) || longitude === null || isNaN(longitude)) {
    return {
      error:
        "Las coordenadas (latitud y longitud) son obligatorias para situar el establecimiento en el mapa.",
    };
  }

  const occasionsSelected = formData.getAll("occasions") as string[];
  const formTags = (formData.getAll("tags") as string[])
    .flatMap((t) => t.split(","))
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const uniqueTags = Array.from(new Set(formTags));

  const scopeKey = buildScopeKey(existing.groupId, existing.createdById);

  await db
    .update(places)
    .set({
      name,
      address,
      city,
      country,
      latitude,
      longitude,
      googleMapsUrl,
      website,
      phone,
      priceRange,
      notes,
      updatedAt: new Date(),
    })
    .where(eq(places.id, placeId));

  await db.delete(placeOccasions).where(eq(placeOccasions.placeId, placeId));
  if (occasionsSelected.length > 0) {
    await db.insert(placeOccasions).values(
      occasionsSelected.map((occ) => ({
        placeId,
        occasion: occ,
      }))
    );
  }

  await db.delete(placeTags).where(eq(placeTags.placeId, placeId));
  if (uniqueTags.length > 0) {
    await db
      .insert(tags)
      .values(
        uniqueTags.map((t) => ({
          scopeKey,
          id: t,
          name: t,
        }))
      )
      .onConflictDoNothing();

    await db.insert(placeTags).values(
      uniqueTags.map((t) => ({
        placeId,
        tag: t,
      }))
    );
  }

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "place",
    entityId: placeId,
    action: "place_updated",
    metadata: { name, groupId: existing.groupId },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Copia un establecimiento de forma independiente (aislamiento total v2)
 * a otro grupo del usuario o a su «Mapa Personal» privado.
 */
export async function copyPlaceToSpaceAction(
  sourcePlaceId: string,
  targetSpace: string
): Promise<{ success?: boolean; placeId?: string; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "Debes iniciar sesión." };
  }

  const [source] = await db
    .select()
    .from(places)
    .where(eq(places.id, sourcePlaceId))
    .limit(1);

  if (!source) {
    return { error: "Establecimiento de origen no encontrado." };
  }

  const sourcePerms = await getPlacePermissions(currentUser, source);
  if (!sourcePerms.canRead) {
    return { error: "No tienes acceso al establecimiento de origen." };
  }

  const target = await resolveTargetGroupIdFromSpace(targetSpace, currentUser.id);
  if (target.error) {
    return { error: target.error };
  }

  const targetGroupId = target.groupId;
  if (source.groupId === targetGroupId) {
    return { error: "Este sitio ya pertenece a ese espacio." };
  }

  const targetScopeKey = buildScopeKey(targetGroupId, currentUser.id);

  const [srcOccs, srcTags, [myInteraction]] = await Promise.all([
    db.select().from(placeOccasions).where(eq(placeOccasions.placeId, source.id)),
    db.select().from(placeTags).where(eq(placeTags.placeId, source.id)),
    db
      .select()
      .from(userPlaces)
      .where(and(eq(userPlaces.placeId, source.id), eq(userPlaces.userId, currentUser.id)))
      .limit(1),
  ]);

  const [copied] = await db
    .insert(places)
    .values({
      groupId: targetGroupId,
      name: source.name,
      address: source.address,
      city: source.city,
      country: source.country,
      latitude: source.latitude,
      longitude: source.longitude,
      googleMapsUrl: source.googleMapsUrl,
      priceRange: source.priceRange,
      notes: source.notes,
      communityPublished: targetGroupId !== null,
      website: source.website,
      phone: source.phone,
      createdById: currentUser.id,
    })
    .returning();

  if (srcOccs.length > 0) {
    await db
      .insert(occasionsTable)
      .values(
        srcOccs.map((o) => {
          const cleanOcc = o.occasion.trim().toLowerCase();
          const known = KNOWN_OCCASIONS[cleanOcc];
          return {
            scopeKey: targetScopeKey,
            id: cleanOcc,
            name: known
              ? known.name
              : cleanOcc.charAt(0).toUpperCase() + cleanOcc.slice(1).replace(/[-_]/g, " "),
            icon: known ? known.icon : "🍽️",
          };
        })
      )
      .onConflictDoNothing();

    await db.insert(placeOccasions).values(
      srcOccs.map((o) => ({
        placeId: copied.id,
        occasion: o.occasion,
      }))
    );
  }

  if (srcTags.length > 0) {
    await db
      .insert(tags)
      .values(srcTags.map((t) => ({ scopeKey: targetScopeKey, id: t.tag, name: t.tag })))
      .onConflictDoNothing();

    await db.insert(placeTags).values(
      srcTags.map((t) => ({
        placeId: copied.id,
        tag: t.tag,
      }))
    );
  }

  // Conservar la valoración / estado personal del propio usuario sobre su nueva copia
  if (myInteraction) {
    await db
      .insert(userPlaces)
      .values({
        userId: currentUser.id,
        placeId: copied.id,
        favorite: myInteraction.favorite,
        personalStatus: myInteraction.personalStatus,
        rating: myInteraction.rating,
        privateNotes: myInteraction.privateNotes,
      })
      .onConflictDoNothing();
  }

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "place",
    entityId: copied.id,
    action: "place_copied",
    metadata: {
      sourcePlaceId: source.id,
      name: source.name,
      targetGroupId,
    },
  });

  revalidatePath("/");
  return { success: true, placeId: copied.id };
}

export async function deletePlaceAction(placeId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "No autorizado." };
  }

  const [place] = await db
    .select()
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);

  if (!place) {
    return { error: "Establecimiento no encontrado." };
  }

  const perms = await getPlacePermissions(currentUser, place);
  if (!perms.canDelete) {
    return {
      error: "Solo el autor del sitio o un administrador del grupo puede eliminarlo.",
    };
  }

  await db.delete(placeListItems).where(eq(placeListItems.placeId, placeId));
  await db.delete(placeComments).where(eq(placeComments.placeId, placeId));
  await db.delete(userPlaces).where(eq(userPlaces.placeId, placeId));
  await db.delete(placeOccasions).where(eq(placeOccasions.placeId, placeId));
  await db.delete(placeTags).where(eq(placeTags.placeId, placeId));
  await db.delete(places).where(eq(places.id, placeId));

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "place",
    entityId: placeId,
    action: "place_deleted",
    metadata: { name: place.name, groupId: place.groupId },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Elimina múltiples establecimientos en bloque (Superadmin o Admin del grupo al que pertenezcan todos).
 */
export async function bulkDeletePlacesAction(placeIds: string[]) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "No autorizado." };
  }

  if (!placeIds || placeIds.length === 0) {
    return { error: "No se seleccionó ningún establecimiento para eliminar." };
  }

  const targetPlaces = await db
    .select({ id: places.id, groupId: places.groupId, createdById: places.createdById })
    .from(places)
    .where(inArray(places.id, placeIds));

  if (targetPlaces.length === 0) {
    return { error: "No se encontraron los establecimientos seleccionados." };
  }

  if (currentUser.role !== "admin") {
    for (const p of targetPlaces) {
      const perms = await getPlacePermissions(currentUser, p);
      if (!perms.isGroupAdmin) {
        return {
          error: "Solo los administradores del espacio pueden eliminar establecimientos en bloque.",
        };
      }
    }
  }

  const validIds = targetPlaces.map((p) => p.id);

  await db.delete(placeListItems).where(inArray(placeListItems.placeId, validIds));
  await db.delete(placeComments).where(inArray(placeComments.placeId, validIds));
  await db.delete(userPlaces).where(inArray(userPlaces.placeId, validIds));
  await db.delete(placeOccasions).where(inArray(placeOccasions.placeId, validIds));
  await db.delete(placeTags).where(inArray(placeTags.placeId, validIds));
  await db.delete(places).where(inArray(places.id, validIds));

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "place",
    entityId: "bulk",
    action: "place_bulk_deleted",
    metadata: { count: validIds.length },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  return { success: true, count: validIds.length };
}

export async function getAllPlaces(
  userCoords?: UserCoordinates,
  options?: { forceAllForSuperAdmin?: boolean; explicitGroupId?: string | null }
): Promise<PlaceWithDetails[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  const hasCoords =
    userCoords &&
    typeof userCoords.latitude === "number" &&
    typeof userCoords.longitude === "number";

  const distanceExpr = hasCoords
    ? sql<number>`
        CASE 
          WHEN ${places.latitude} IS NOT NULL AND ${places.longitude} IS NOT NULL 
          THEN ST_Distance(
            ST_MakePoint(${places.longitude}, ${places.latitude})::geography,
            ST_MakePoint(${userCoords.longitude}, ${userCoords.latitude})::geography
          )
          ELSE NULL
        END
      `.as("distance_meters")
    : sql<null>`NULL`.as("distance_meters");

  const workspace = await getActiveWorkspace();
  const myGroupsMap = new Map(
    (workspace?.myGroups || []).map((g) => [g.id, g])
  );
  const adminGroupIds = new Set(
    (workspace?.myGroups || [])
      .filter((g) => g.isOwner || g.myRole === "admin")
      .map((g) => g.id)
  );

  const whereConditions = [];

  if (options?.forceAllForSuperAdmin && currentUser.role === "admin") {
    // Superadmin en /admin: visión global de todos los grupos + propios
    whereConditions.push(
      or(isNotNull(places.groupId), eq(places.createdById, currentUser.id))!
    );
  } else if (options?.explicitGroupId !== undefined) {
    if (options.explicitGroupId === null) {
      whereConditions.push(
        and(isNull(places.groupId), eq(places.createdById, currentUser.id))!
      );
    } else {
      const membership = await getGroupMembership(currentUser.id, options.explicitGroupId);
      if (!membership.isMember && currentUser.role !== "admin") return [];
      whereConditions.push(eq(places.groupId, options.explicitGroupId));
    }
  } else if (workspace) {
    if (workspace.mode === "personal") {
      whereConditions.push(
        and(isNull(places.groupId), eq(places.createdById, currentUser.id))!
      );
    } else if (workspace.mode === "group" && workspace.groupId) {
      whereConditions.push(eq(places.groupId, workspace.groupId));
    } else {
      // mode === 'all': mi Mapa Personal + todos mis grupos
      const myGroupIds = workspace.myGroups.map((g) => g.id);
      if (myGroupIds.length > 0) {
        whereConditions.push(
          or(
            and(isNull(places.groupId), eq(places.createdById, currentUser.id)),
            inArray(places.groupId, myGroupIds)
          )!
        );
      } else {
        whereConditions.push(
          and(isNull(places.groupId), eq(places.createdById, currentUser.id))!
        );
      }
    }
  } else {
    return [];
  }

  if (hasCoords && userCoords.radiusKm && userCoords.radiusKm > 0) {
    const radiusMeters = userCoords.radiusKm * 1000;
    whereConditions.push(
      isNotNull(places.latitude),
      isNotNull(places.longitude),
      sql`ST_DWithin(
        ST_MakePoint(${places.longitude}, ${places.latitude})::geography,
        ST_MakePoint(${userCoords.longitude}, ${userCoords.latitude})::geography,
        ${radiusMeters}
      )`
    );
  }

  let query = db
    .select({
      place: places,
      createdByName: users.name,
      createdByUsername: users.username,
      groupName: sharingGroups.name,
      groupIcon: sharingGroups.icon,
      distanceMeters: distanceExpr,
    })
    .from(places)
    .innerJoin(users, eq(places.createdById, users.id))
    .leftJoin(sharingGroups, eq(places.groupId, sharingGroups.id));

  if (whereConditions.length > 0) {
    query = query.where(and(...whereConditions)) as typeof query;
  }

  const rows = await query.orderBy(
    hasCoords ? sql`distance_meters ASC NULLS LAST` : desc(places.createdAt)
  );

  if (rows.length === 0) {
    return [];
  }

  // Cargar en bloque (sin N+1) las 4 relaciones con inArray(..., placeIds)
  const placeIds = rows.map((r) => r.place.id);
  const [
    allUserPlaceRows,
    allOccasionRows,
    allTagRows,
    allCommentRows,
  ] = await Promise.all([
    db
      .select({
        placeId: userPlaces.placeId,
        userId: userPlaces.userId,
        personalStatus: userPlaces.personalStatus,
        rating: userPlaces.rating,
        favorite: userPlaces.favorite,
        privateNotes: userPlaces.privateNotes,
      })
      .from(userPlaces)
      .where(inArray(userPlaces.placeId, placeIds)),
    db
      .select({
        placeId: placeOccasions.placeId,
        occasion: placeOccasions.occasion,
      })
      .from(placeOccasions)
      .where(inArray(placeOccasions.placeId, placeIds)),
    db
      .select({
        placeId: placeTags.placeId,
        tag: placeTags.tag,
      })
      .from(placeTags)
      .where(inArray(placeTags.placeId, placeIds)),
    db
      .select({
        placeId: placeComments.placeId,
        content: placeComments.content,
        authorName: users.name,
        authorUsername: users.username,
      })
      .from(placeComments)
      .leftJoin(users, eq(placeComments.userId, users.id))
      .where(inArray(placeComments.placeId, placeIds)),
  ]);

  const pendingUsersByPlace = new Map<string, string[]>();
  const visitedUsersByPlace = new Map<string, string[]>();
  const favoriteUsersByPlace = new Map<string, string[]>();
  const highRatedUsersByPlace = new Map<string, string[]>();
  const myInteractionByPlace = new Map<
    string,
    {
      favorite: boolean;
      personalStatus: "pending" | "visited" | null;
      rating: number | null;
      privateNotes: string | null;
    }
  >();

  for (const row of allUserPlaceRows) {
    if (row.personalStatus === "pending") {
      const list = pendingUsersByPlace.get(row.placeId) || [];
      list.push(row.userId);
      pendingUsersByPlace.set(row.placeId, list);
    }
    if (row.personalStatus === "visited" || (row.rating !== null && row.rating > 0)) {
      const list = visitedUsersByPlace.get(row.placeId) || [];
      list.push(row.userId);
      visitedUsersByPlace.set(row.placeId, list);
    }
    if (row.favorite) {
      const list = favoriteUsersByPlace.get(row.placeId) || [];
      list.push(row.userId);
      favoriteUsersByPlace.set(row.placeId, list);
    }
    if (row.rating !== null && row.rating >= 8) {
      const list = highRatedUsersByPlace.get(row.placeId) || [];
      list.push(row.userId);
      highRatedUsersByPlace.set(row.placeId, list);
    }
    if (row.userId === currentUser.id) {
      myInteractionByPlace.set(row.placeId, {
        favorite: row.favorite,
        personalStatus: row.personalStatus as "pending" | "visited" | null,
        rating: row.rating,
        privateNotes: row.privateNotes,
      });
    }
  }

  const occasionsByPlace = new Map<string, string[]>();
  for (const row of allOccasionRows) {
    const list = occasionsByPlace.get(row.placeId) || [];
    list.push(row.occasion);
    occasionsByPlace.set(row.placeId, list);
  }

  const tagsByPlace = new Map<string, string[]>();
  for (const row of allTagRows) {
    const list = tagsByPlace.get(row.placeId) || [];
    list.push(row.tag);
    tagsByPlace.set(row.placeId, list);
  }

  const commentsByPlace = new Map<
    string,
    Array<{ content: string; authorName: string | null; authorUsername: string | null }>
  >();
  for (const row of allCommentRows) {
    const list = commentsByPlace.get(row.placeId) || [];
    list.push({
      content: row.content,
      authorName: row.authorName,
      authorUsername: row.authorUsername,
    });
    commentsByPlace.set(row.placeId, list);
  }

  // Ensamblado síncrono en memoria O(N)
  const placesWithDetails: PlaceWithDetails[] = rows.map(
    ({ place, createdByName, createdByUsername, groupName, groupIcon, distanceMeters }) => {
      const occs = occasionsByPlace.get(place.id) || [];
      const placeTagList = tagsByPlace.get(place.id) || [];
      const comments = commentsByPlace.get(place.id) || [];
      const myInteraction = myInteractionByPlace.get(place.id);

      const isFavorite = myInteraction?.favorite ?? false;
      const personalStatus = myInteraction?.personalStatus ?? null;
      const rating = myInteraction?.rating ?? null;
      const privateNotes = myInteraction?.privateNotes ?? null;

      const placeVisitedUserIds = visitedUsersByPlace.get(place.id) || [];
      const placePendingUserIds = pendingUsersByPlace.get(place.id) || [];
      const placeFavoriteUserIds = favoriteUsersByPlace.get(place.id) || [];
      const placeHighRatedUserIds = highRatedUsersByPlace.get(place.id) || [];
      let experienceStatus: "visited_by_me" | "visited_by_others" | "untried" = "untried";

      if (personalStatus === "visited" || (rating !== null && rating > 0)) {
        experienceStatus = "visited_by_me";
      } else if (placeVisitedUserIds.length > 0) {
        experienceStatus = "visited_by_others";
      }

      const isAuthor = place.createdById === currentUser.id;
      const isGroupAdmin = Boolean(place.groupId && adminGroupIds.has(place.groupId));
      const isSuperAdmin = currentUser.role === "admin";
      const canEdit = !place.groupId
        ? isAuthor || isSuperAdmin
        : isAuthor || isGroupAdmin || isSuperAdmin;
      const canDelete = canEdit;

      const effectiveGroupName =
        groupName || (place.groupId ? myGroupsMap.get(place.groupId)?.name || null : null);
      const effectiveGroupIcon =
        groupIcon || (place.groupId ? myGroupsMap.get(place.groupId)?.icon || "🍻" : null);

      return {
        ...place,
        createdByName,
        createdByUsername:
          createdByUsername ||
          (createdByName ? createdByName.toLowerCase().replace(/\s+/g, "") : null),
        occasions: occs,
        tags: placeTagList,
        distanceMeters:
          distanceMeters !== null && distanceMeters !== undefined
            ? Math.round(Number(distanceMeters))
            : null,
        isFavorite,
        personalStatus,
        rating,
        privateNotes,
        commentsCount: comments.length,
        commentsTexts: comments.map((c) => c.content).filter(Boolean),
        commentAuthors: Array.from(
          new Set(
            comments
              .flatMap((c) => [
                c.authorName || "",
                c.authorUsername || "",
                c.authorUsername ? `@${c.authorUsername}` : "",
              ])
              .filter(Boolean)
          )
        ),
        experienceStatus,
        groupName: effectiveGroupName,
        groupIcon: effectiveGroupIcon,
        canEdit,
        canDelete,
        pendingUserIds: placePendingUserIds,
        visitedUserIds: placeVisitedUserIds,
        favoriteUserIds: placeFavoriteUserIds,
        highRatedUserIds: placeHighRatedUserIds,
      };
    }
  );

  return placesWithDetails;
}

export interface PotentialDuplicate {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  priceRange: string;
  distanceMeters: number | null;
  reason: string;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Busca posibles establecimientos duplicados ÚNICAMENTE dentro del espacio destino
 * (aislamiento total v2: nunca filtra ni bloquea entre grupos distintos).
 */
export async function findPotentialDuplicatesAction(params: {
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
  targetSpace?: string | null;
}): Promise<PotentialDuplicate[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  const normalizedName = params.name ? normalizeText(params.name) : "";
  const hasCoords =
    typeof params.latitude === "number" &&
    typeof params.longitude === "number" &&
    !isNaN(params.latitude) &&
    !isNaN(params.longitude);

  if (normalizedName.length < 3 && !hasCoords) {
    return [];
  }

  const target = await resolveTargetGroupIdFromSpace(params.targetSpace, currentUser.id);
  if (target.error) return [];

  const accessible = await db
    .select({
      id: places.id,
      name: places.name,
      city: places.city,
      address: places.address,
      priceRange: places.priceRange,
      latitude: places.latitude,
      longitude: places.longitude,
    })
    .from(places)
    .where(
      target.groupId
        ? eq(places.groupId, target.groupId)
        : and(isNull(places.groupId), eq(places.createdById, currentUser.id))
    );

  const matches: PotentialDuplicate[] = [];

  for (const p of accessible) {
    const pNorm = normalizeText(p.name);
    let distanceMeters: number | null = null;
    if (hasCoords && p.latitude != null && p.longitude != null) {
      distanceMeters = haversineMeters(
        params.latitude!,
        params.longitude!,
        p.latitude,
        p.longitude
      );
    }

    const nameMatch =
      normalizedName.length >= 3 &&
      (pNorm === normalizedName ||
        (normalizedName.length >= 4 &&
          (pNorm.includes(normalizedName) || normalizedName.includes(pNorm))));
    const proximityMatch = distanceMeters !== null && distanceMeters <= 100;

    if (nameMatch || proximityMatch) {
      const reasons: string[] = [];
      if (nameMatch) reasons.push("Nombre similar");
      if (proximityMatch) reasons.push(`A ${distanceMeters} m`);

      matches.push({
        id: p.id,
        name: p.name,
        city: p.city,
        address: p.address,
        priceRange: p.priceRange,
        distanceMeters,
        reason: reasons.join(" • "),
      });
    }
  }

  return matches
    .sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999))
    .slice(0, 5);
}

/**
 * Fusión administrativa de dos establecimientos duplicados dentro del mismo espacio
 * (permitido a Admins del grupo, al dueño en su Mapa Personal o al Superadmin).
 */
export async function mergePlacesAction(
  primaryPlaceId: string,
  duplicatePlaceId: string
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "No autorizado." };
  }

  if (!primaryPlaceId || !duplicatePlaceId || primaryPlaceId === duplicatePlaceId) {
    return { error: "Debes seleccionar dos establecimientos distintos." };
  }

  const [[primary], [duplicate]] = await Promise.all([
    db.select().from(places).where(eq(places.id, primaryPlaceId)).limit(1),
    db.select().from(places).where(eq(places.id, duplicatePlaceId)).limit(1),
  ]);

  if (!primary || !duplicate) {
    return { error: "Uno de los establecimientos seleccionados no existe." };
  }

  if (primary.groupId !== duplicate.groupId) {
    return {
      error: "Solo se pueden fusionar establecimientos que pertenezcan al mismo espacio o grupo.",
    };
  }

  const primaryPerms = await getPlacePermissions(currentUser, primary);
  if (!primaryPerms.isGroupAdmin && currentUser.role !== "admin") {
    return { error: "Solo los administradores del espacio pueden fusionar establecimientos." };
  }

  await db
    .update(placeComments)
    .set({ placeId: primaryPlaceId })
    .where(eq(placeComments.placeId, duplicatePlaceId));

  const [primaryUserRows, dupUserRows] = await Promise.all([
    db.select().from(userPlaces).where(eq(userPlaces.placeId, primaryPlaceId)),
    db.select().from(userPlaces).where(eq(userPlaces.placeId, duplicatePlaceId)),
  ]);

  const primaryByUser = new Map(primaryUserRows.map((r) => [r.userId, r]));

  for (const dupRow of dupUserRows) {
    const existing = primaryByUser.get(dupRow.userId);
    if (!existing) {
      await db
        .update(userPlaces)
        .set({ placeId: primaryPlaceId, updatedAt: new Date() })
        .where(eq(userPlaces.id, dupRow.id));
    } else {
      const mergedFavorite = existing.favorite || dupRow.favorite;
      const mergedStatus = existing.personalStatus || dupRow.personalStatus;
      const mergedRating = existing.rating ?? dupRow.rating;
      const mergedNotes =
        existing.privateNotes &&
        dupRow.privateNotes &&
        existing.privateNotes !== dupRow.privateNotes
          ? `${existing.privateNotes}\n---\n${dupRow.privateNotes}`
          : existing.privateNotes || dupRow.privateNotes;

      await db
        .update(userPlaces)
        .set({
          favorite: mergedFavorite,
          personalStatus: mergedStatus,
          rating: mergedRating,
          privateNotes: mergedNotes,
          updatedAt: new Date(),
        })
        .where(eq(userPlaces.id, existing.id));

      await db.delete(userPlaces).where(eq(userPlaces.id, dupRow.id));
    }
  }

  const [primaryOccs, dupOccs] = await Promise.all([
    db.select().from(placeOccasions).where(eq(placeOccasions.placeId, primaryPlaceId)),
    db.select().from(placeOccasions).where(eq(placeOccasions.placeId, duplicatePlaceId)),
  ]);
  const existingOccSet = new Set(primaryOccs.map((o) => o.occasion));
  const missingOccs = dupOccs
    .map((o) => o.occasion)
    .filter((occ) => !existingOccSet.has(occ));
  if (missingOccs.length > 0) {
    await db.insert(placeOccasions).values(
      Array.from(new Set(missingOccs)).map((occ) => ({
        placeId: primaryPlaceId,
        occasion: occ,
      }))
    );
  }

  const [primaryTags, dupTags] = await Promise.all([
    db.select().from(placeTags).where(eq(placeTags.placeId, primaryPlaceId)),
    db.select().from(placeTags).where(eq(placeTags.placeId, duplicatePlaceId)),
  ]);
  const existingTagSet = new Set(primaryTags.map((t) => t.tag));
  const missingTags = dupTags
    .map((t) => t.tag)
    .filter((t) => !existingTagSet.has(t));
  if (missingTags.length > 0) {
    await db.insert(placeTags).values(
      Array.from(new Set(missingTags)).map((t) => ({
        placeId: primaryPlaceId,
        tag: t,
      }))
    );
  }

  await db
    .update(places)
    .set({
      address: primary.address || duplicate.address,
      city: primary.city || duplicate.city,
      country: primary.country || duplicate.country,
      latitude: primary.latitude ?? duplicate.latitude,
      longitude: primary.longitude ?? duplicate.longitude,
      googleMapsUrl: primary.googleMapsUrl || duplicate.googleMapsUrl,
      website: primary.website || duplicate.website,
      phone: primary.phone || duplicate.phone,
      priceRange:
        primary.priceRange === "???" && duplicate.priceRange !== "???"
          ? duplicate.priceRange
          : primary.priceRange,
      notes: primary.notes || duplicate.notes,
      updatedAt: new Date(),
    })
    .where(eq(places.id, primaryPlaceId));

  await db.delete(placeListItems).where(eq(placeListItems.placeId, duplicatePlaceId));
  await db.delete(placeOccasions).where(eq(placeOccasions.placeId, duplicatePlaceId));
  await db.delete(placeTags).where(eq(placeTags.placeId, duplicatePlaceId));
  await db.delete(places).where(eq(places.id, duplicatePlaceId));

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "place",
    entityId: primaryPlaceId,
    action: "place_merged",
    metadata: {
      primaryName: primary.name,
      mergedDuplicateId: duplicatePlaceId,
      mergedDuplicateName: duplicate.name,
      groupId: primary.groupId,
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  return { success: true };
}
