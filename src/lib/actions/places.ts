"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, ne, desc, and, or, isNotNull, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  places,
  placeOccasions,
  placeTags,
  tags,
  users,
  userPlaces,
  placeComments,
  sharingGroups,
  sharingGroupMembers,
  placeGroupAccess,
  placeUserAccess,
  type Place,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { resolveGoogleMapsUrl, parseGoogleMapsUrl } from "@/lib/maps";
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
  // Colección personal (Fase 4)
  isFavorite?: boolean;
  personalStatus?: "pending" | "visited" | null;
  rating?: number | null;
  privateNotes?: string | null;
  commentsCount?: number;
  commentsTexts?: string[];
  experienceStatus?: "visited_by_me" | "visited_by_others" | "untried";
  sharedGroupIds?: string[];
  sharedGroupNames?: string[];
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
  const resolved = await resolveGoogleMapsUrl(rawUrl);
  const parsed = parseGoogleMapsUrl(resolved);

  // Si hemos extraído coordenadas del enlace de Maps, hacemos geocodificación inversa
  // para obtener calle, municipio y provincia automáticamente
  let locationDetails: GeocodingResult | null = null;
  if (parsed.latitude && parsed.longitude) {
    locationDetails = await reverseGeocodeNominatim(parsed.latitude, parsed.longitude);
  }

  return {
    ...parsed,
    resolvedUrl: resolved,
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
  const communityPublished = formData.get("communityPublished") !== "false";
  const website = (formData.get("website") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;

  const latStr = formData.get("latitude") as string;
  const lngStr = formData.get("longitude") as string;
  const latitude = latStr ? parseFloat(latStr) : null;
  const longitude = lngStr ? parseFloat(lngStr) : null;

  const occasions = formData.getAll("occasions") as string[];

  if (!name || name.length < 2) {
    return { error: "El nombre del establecimiento es obligatorio." };
  }

  if (latitude === null || isNaN(latitude) || longitude === null || isNaN(longitude)) {
    return { error: "Las coordenadas (latitud y longitud) son obligatorias para situar el establecimiento en el mapa." };
  }

  // 1. Insertar el establecimiento
  const [newPlace] = await db
    .insert(places)
    .values({
      name,
      address,
      city,
      country,
      latitude,
      longitude,
      googleMapsUrl,
      priceRange,
      notes,
      communityPublished,
      website,
      phone,
      createdById: currentUser.id,
    })
    .returning();

  // 2. Insertar ocasiones/planes seleccionados
  if (occasions.length > 0) {
    await db.insert(placeOccasions).values(
      occasions.map((occ) => ({
        placeId: newPlace.id,
        occasion: occ,
      }))
    );
  }

  // 3. Insertar tags seleccionados (chips visuales)
  const formTags = (formData.getAll("tags") as string[])
    .flatMap((t) => t.split(","))
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  const uniqueTags = Array.from(new Set(formTags));
  if (uniqueTags.length > 0) {
    await db
      .insert(tags)
      .values(uniqueTags.map((t) => ({ id: t, name: t })))
      .onConflictDoNothing();

    await db.insert(placeTags).values(
      uniqueTags.map((t) => ({
        placeId: newPlace.id,
        tag: t,
      }))
    );
  }

  // 4. Compartición con grupos privados seleccionados (solo aplica si NO es publicado en comunidad)
  const sharedGroupIds = !communityPublished
    ? Array.from(new Set((formData.getAll("sharedGroups") as string[]).filter(Boolean)))
    : [];
  if (sharedGroupIds.length > 0) {
    await db
      .insert(placeGroupAccess)
      .values(
        sharedGroupIds.map((groupId) => ({
          placeId: newPlace.id,
          groupId,
          grantedBy: currentUser.id,
        }))
      )
      .onConflictDoNothing();
  }

  revalidatePath("/");
  redirect("/");
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

  const isOwner = existing.createdById === currentUser.id;
  const isAdmin = currentUser.role === "admin";

  if (!isOwner && !isAdmin) {
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
  const communityPublished = formData.get("communityPublished") !== "false";

  const latStr = (formData.get("latitude") as string)?.trim();
  const lngStr = (formData.get("longitude") as string)?.trim();
  const parsedLat = latStr ? parseFloat(latStr) : null;
  const parsedLng = lngStr ? parseFloat(lngStr) : null;
  const latitude = parsedLat !== null && !isNaN(parsedLat) ? parsedLat : null;
  const longitude = parsedLng !== null && !isNaN(parsedLng) ? parsedLng : null;

  if (latitude === null || isNaN(latitude) || longitude === null || isNaN(longitude)) {
    return { error: "Las coordenadas (latitud y longitud) son obligatorias para situar el establecimiento en el mapa." };
  }

  const occasionsSelected = formData.getAll("occasions") as string[];
  const formTags = (formData.getAll("tags") as string[])
    .flatMap((t) => t.split(","))
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const uniqueTags = Array.from(new Set(formTags));
  const sharedGroupIds = !communityPublished
    ? Array.from(new Set((formData.getAll("sharedGroups") as string[]).filter(Boolean)))
    : [];

  // Regla 4.5: si un usuario no-admin intenta pasar a estrictamente privado una ficha
  // comunitaria que ya tiene colecciones o comentarios de otros usuarios, proteger los datos ajenos
  if (
    currentUser.role !== "admin" &&
    existing.communityPublished &&
    !communityPublished &&
    sharedGroupIds.length === 0
  ) {
    const [otherSaves, otherComments] = await Promise.all([
      db
        .select({ id: userPlaces.id })
        .from(userPlaces)
        .where(and(eq(userPlaces.placeId, placeId), ne(userPlaces.userId, currentUser.id)))
        .limit(1),
      db
        .select({ id: placeComments.id })
        .from(placeComments)
        .where(and(eq(placeComments.placeId, placeId), ne(placeComments.userId, currentUser.id)))
        .limit(1),
    ]);

    if (otherSaves.length > 0 || otherComments.length > 0) {
      return {
        error:
          "Otros usuarios ya tienen guardado o comentado este sitio. No se puede pasar a estrictamente privado para no perder sus datos.",
      };
    }
  }

  // 1. Actualizar ficha principal
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
      communityPublished,
      updatedAt: new Date(),
    })
    .where(eq(places.id, placeId));

  // 2. Sincronizar ocasiones/planes
  await db.delete(placeOccasions).where(eq(placeOccasions.placeId, placeId));
  if (occasionsSelected.length > 0) {
    await db.insert(placeOccasions).values(
      occasionsSelected.map((occ) => ({
        placeId,
        occasion: occ,
      }))
    );
  }

  // 3. Sincronizar etiquetas y asegurar que existan en catálogo tags
  await db.delete(placeTags).where(eq(placeTags.placeId, placeId));
  if (uniqueTags.length > 0) {
    await db
      .insert(tags)
      .values(
        uniqueTags.map((t) => ({
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

  // 4. Sincronizar compartición con grupos privados (solo el propietario controla la compartición)
  if (isOwner) {
    await db.delete(placeGroupAccess).where(eq(placeGroupAccess.placeId, placeId));
    if (sharedGroupIds.length > 0) {
      await db
        .insert(placeGroupAccess)
        .values(
          sharedGroupIds.map((groupId) => ({
            placeId,
            groupId,
            grantedBy: currentUser.id,
          }))
        )
        .onConflictDoNothing();
    }
  }

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "place",
    entityId: placeId,
    action: "place_updated",
    metadata: { name },
  });

  revalidatePath("/");
  return { success: true };
}

export async function deletePlaceAction(placeId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "No autorizado." };
  }

  // Comprobar propiedad o rol admin
  const [place] = await db
    .select()
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);

  if (!place) {
    return { error: "Establecimiento no encontrado." };
  }

  if (currentUser.role !== "admin") {
    return { error: "Solo los administradores pueden eliminar establecimientos." };
  }

  // Limpieza en cascada explícita de registros dependientes para garantizar integridad total
  await db.delete(placeGroupAccess).where(eq(placeGroupAccess.placeId, placeId));
  await db.delete(placeUserAccess).where(eq(placeUserAccess.placeId, placeId));
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
    metadata: { name: place.name },
  });
  revalidatePath("/");
  return { success: true };
}

/**
 * Elimina múltiples establecimientos en bloque (Solo Administradores)
 */
export async function bulkDeletePlacesAction(placeIds: string[]) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado. Solo los administradores pueden eliminar en bloque." };
  }

  if (!placeIds || placeIds.length === 0) {
    return { error: "No se seleccionó ningún establecimiento para eliminar." };
  }

  // Limpieza en cascada explícita de registros dependientes para garantizar integridad total
  await db.delete(placeComments).where(inArray(placeComments.placeId, placeIds));
  await db.delete(userPlaces).where(inArray(userPlaces.placeId, placeIds));
  await db.delete(placeOccasions).where(inArray(placeOccasions.placeId, placeIds));
  await db.delete(placeTags).where(inArray(placeTags.placeId, placeIds));
  await db.delete(places).where(inArray(places.id, placeIds));
  revalidatePath("/");
  return { success: true, count: placeIds.length };
}

export async function getAllPlaces(
  userCoords?: UserCoordinates
): Promise<PlaceWithDetails[]> {
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

  const whereConditions = [];
  const currentUser = await getCurrentUser();

  // Matriz acumulativa de permisos en servidor:
  // Comunidad OR Propietario OR Grupo donde pertenece OR Acceso directo
  if (currentUser) {
    const [memberGroups, ownedGroups, directAccessRows] = await Promise.all([
      db
        .select({ groupId: sharingGroupMembers.groupId })
        .from(sharingGroupMembers)
        .where(eq(sharingGroupMembers.userId, currentUser.id)),
      db
        .select({ groupId: sharingGroups.id })
        .from(sharingGroups)
        .where(eq(sharingGroups.ownerUserId, currentUser.id)),
      db
        .select({ placeId: placeUserAccess.placeId })
        .from(placeUserAccess)
        .where(eq(placeUserAccess.userId, currentUser.id)),
    ]);

    const userGroupIds = Array.from(
      new Set([
        ...memberGroups.map((g) => g.groupId),
        ...ownedGroups.map((g) => g.groupId),
      ])
    );

    let groupPlaceIds: string[] = [];
    if (userGroupIds.length > 0) {
      const groupAccessRows = await db
        .select({ placeId: placeGroupAccess.placeId })
        .from(placeGroupAccess)
        .where(inArray(placeGroupAccess.groupId, userGroupIds));
      groupPlaceIds = groupAccessRows.map((r) => r.placeId);
    }

    const sharedPlaceIds = Array.from(
      new Set([...directAccessRows.map((r) => r.placeId), ...groupPlaceIds])
    );

    if (sharedPlaceIds.length > 0) {
      whereConditions.push(
        or(
          eq(places.communityPublished, true),
          eq(places.createdById, currentUser.id),
          inArray(places.id, sharedPlaceIds)
        )!
      );
    } else {
      whereConditions.push(
        or(eq(places.communityPublished, true), eq(places.createdById, currentUser.id))!
      );
    }
  } else {
    whereConditions.push(eq(places.communityPublished, true));
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
      distanceMeters: distanceExpr,
    })
    .from(places)
    .innerJoin(users, eq(places.createdById, users.id));

  if (whereConditions.length > 0) {
    query = query.where(and(...whereConditions)) as typeof query;
  }

  const rows = await query.orderBy(
    hasCoords ? sql`distance_meters ASC NULLS LAST` : desc(places.createdAt)
  );

  // Para cada lugar, recuperar ocasiones, etiquetas, interacciones personales y comentarios
  const placesWithDetails = await Promise.all(
    rows.map(async ({ place, createdByName, createdByUsername, distanceMeters }) => {
      const occs = await db
        .select({ occasion: placeOccasions.occasion })
        .from(placeOccasions)
        .where(eq(placeOccasions.placeId, place.id));

      const tags = await db
        .select({ tag: placeTags.tag })
        .from(placeTags)
        .where(eq(placeTags.placeId, place.id));

      // Comentarios y grupos con acceso
      const [comments, groupLinks] = await Promise.all([
        db
          .select({ id: placeComments.id, content: placeComments.content })
          .from(placeComments)
          .where(eq(placeComments.placeId, place.id)),
        db
          .select({
            groupId: sharingGroups.id,
            groupName: sharingGroups.name,
          })
          .from(placeGroupAccess)
          .innerJoin(sharingGroups, eq(placeGroupAccess.groupId, sharingGroups.id))
          .where(eq(placeGroupAccess.placeId, place.id)),
      ]);

      // Interacción del usuario actual
      let isFavorite = false;
      let personalStatus: "pending" | "visited" | null = null;
      let rating: number | null = null;
      let privateNotes: string | null = null;

      if (currentUser) {
        const [myInteraction] = await db
          .select()
          .from(userPlaces)
          .where(and(eq(userPlaces.placeId, place.id), eq(userPlaces.userId, currentUser.id)))
          .limit(1);

        if (myInteraction) {
          isFavorite = myInteraction.favorite;
          personalStatus = myInteraction.personalStatus as "pending" | "visited" | null;
          rating = myInteraction.rating;
          privateNotes = myInteraction.privateNotes;
        }
      }

      // Cálculo de experiencia: 'visited_by_me' | 'visited_by_others' | 'untried'
      let experienceStatus: "visited_by_me" | "visited_by_others" | "untried" = "untried";

      if (personalStatus === "visited" || (rating !== null && rating > 0)) {
        experienceStatus = "visited_by_me";
      } else {
        // Verificar si algún otro usuario lo ha visitado
        const otherVisits = await db
          .select({ id: userPlaces.id })
          .from(userPlaces)
          .where(
            and(
              eq(userPlaces.placeId, place.id),
              sql`(${userPlaces.personalStatus} = 'visited' OR ${userPlaces.rating} IS NOT NULL)`
            )
          )
          .limit(1);

        if (otherVisits.length > 0) {
          experienceStatus = "visited_by_others";
        }
      }

      return {
        ...place,
        createdByName,
        createdByUsername:
          createdByUsername ||
          (createdByName ? createdByName.toLowerCase().replace(/\s+/g, "") : null),
        occasions: occs.map((o) => o.occasion),
        tags: tags.map((t) => t.tag),
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
        experienceStatus,
        sharedGroupIds: groupLinks.map((g) => g.groupId),
        sharedGroupNames: groupLinks.map((g) => g.groupName),
      };
    })
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
 * Busca posibles establecimientos duplicados entre las fichas accesibles al usuario
 * (nunca revela fichas privadas de otros usuarios).
 */
export async function findPotentialDuplicatesAction(params: {
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
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

  // Solo consultar fichas accesibles para este usuario
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
      sql`(${places.communityPublished} = true OR ${places.createdById} = ${currentUser.id})`
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

  // Priorizar los más cercanos o coincidentes exactos, máximo 5 sugerencias
  return matches
    .sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999))
    .slice(0, 5);
}

/**
 * Fusión administrativa de dos establecimientos duplicados:
 * transfiere comentarios, colecciones personales (sin colisiones), ocasiones,
 * etiquetas y completa datos vacíos de la ficha principal, eliminando la duplicada.
 */
export async function mergePlacesAction(
  primaryPlaceId: string,
  duplicatePlaceId: string
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "Solo los administradores pueden fusionar establecimientos." };
  }

  if (!primaryPlaceId || !duplicatePlaceId || primaryPlaceId === duplicatePlaceId) {
    return { error: "Debes seleccionar dos establecimientos distintos." };
  }

  const [primary] = await db
    .select()
    .from(places)
    .where(eq(places.id, primaryPlaceId))
    .limit(1);

  const [duplicate] = await db
    .select()
    .from(places)
    .where(eq(places.id, duplicatePlaceId))
    .limit(1);

  if (!primary || !duplicate) {
    return { error: "Uno de los establecimientos seleccionados no existe." };
  }

  // Proteger fichas estrictamente privadas de terceros
  if (
    (!primary.communityPublished && primary.createdById !== currentUser.id) ||
    (!duplicate.communityPublished && duplicate.createdById !== currentUser.id)
  ) {
    return { error: "No se pueden fusionar fichas privadas de otros usuarios." };
  }

  // 1. Transferir comentarios al establecimiento principal
  await db
    .update(placeComments)
    .set({ placeId: primaryPlaceId })
    .where(eq(placeComments.placeId, duplicatePlaceId));

  // 2. Fusionar colecciones personales (user_places) sin violar índice único (userId, placeId)
  const [primaryUserRows, dupUserRows] = await Promise.all([
    db.select().from(userPlaces).where(eq(userPlaces.placeId, primaryPlaceId)),
    db.select().from(userPlaces).where(eq(userPlaces.placeId, duplicatePlaceId)),
  ]);

  const primaryByUser = new Map(primaryUserRows.map((r) => [r.userId, r]));

  for (const dupRow of dupUserRows) {
    const existing = primaryByUser.get(dupRow.userId);
    if (!existing) {
      // Mover el registro directamente al principal
      await db
        .update(userPlaces)
        .set({ placeId: primaryPlaceId, updatedAt: new Date() })
        .where(eq(userPlaces.id, dupRow.id));
    } else {
      // Combinar sin perder datos del usuario
      const mergedFavorite = existing.favorite || dupRow.favorite;
      const mergedStatus = existing.personalStatus || dupRow.personalStatus;
      const mergedRating = existing.rating ?? dupRow.rating;
      const mergedNotes =
        existing.privateNotes && dupRow.privateNotes && existing.privateNotes !== dupRow.privateNotes
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

  // 3. Combinar ocasiones sin duplicados
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

  // 4. Combinar etiquetas sin duplicados
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

  // 5. Completar campos vacíos de la ficha principal con los del duplicado
  await db
    .update(places)
    .set({
      address: primary.address || duplicate.address,
      city: primary.city || duplicate.city,
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

  // 6. Eliminar la ficha duplicada y restos
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
    },
  });

  revalidatePath("/");
  return { success: true };
}
