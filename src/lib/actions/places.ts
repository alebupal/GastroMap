"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, desc, and, isNotNull, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  places,
  placeOccasions,
  placeTags,
  tags,
  users,
  userPlaces,
  placeComments,
  type Place,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { resolveGoogleMapsUrl, parseGoogleMapsUrl } from "@/lib/maps";
import {
  searchAddressNominatim,
  reverseGeocodeNominatim,
  type GeocodingResult,
} from "@/lib/geocoding";

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
  experienceStatus?: "visited_by_me" | "visited_by_others" | "untried";
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

  // 1. Insertar el establecimiento
  const [newPlace] = await db
    .insert(places)
    .values({
      name,
      address,
      city,
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
    await db.insert(placeTags).values(
      uniqueTags.map((t) => ({
        placeId: newPlace.id,
        tag: t,
      }))
    );
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
  const isAdminOnCommunity = currentUser.role === "admin" && existing.communityPublished;

  if (!isOwner && !isAdminOnCommunity) {
    return { error: "No tienes permiso para editar este establecimiento." };
  }

  const name = (formData.get("name") as string)?.trim();
  if (!name || name.length < 2) {
    return { error: "El nombre del establecimiento es obligatorio." };
  }

  const address = (formData.get("address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const googleMapsUrl = (formData.get("googleMapsUrl") as string)?.trim() || null;
  const website = (formData.get("website") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const priceRange = (formData.get("priceRange") as string) || "???";
  const rawStatus = (formData.get("status") as string) || "active";
  const status =
    rawStatus === "temporarily_closed" || rawStatus === "permanently_closed"
      ? rawStatus
      : "active";
  const notes = (formData.get("notes") as string)?.trim() || null;
  const communityPublished = formData.get("communityPublished") !== "false";

  const latStr = (formData.get("latitude") as string)?.trim();
  const lngStr = (formData.get("longitude") as string)?.trim();
  const parsedLat = latStr ? parseFloat(latStr) : null;
  const parsedLng = lngStr ? parseFloat(lngStr) : null;
  const latitude = parsedLat !== null && !isNaN(parsedLat) ? parsedLat : null;
  const longitude = parsedLng !== null && !isNaN(parsedLng) ? parsedLng : null;

  const occasionsSelected = formData.getAll("occasions") as string[];
  const formTags = (formData.getAll("tags") as string[])
    .flatMap((t) => t.split(","))
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const uniqueTags = Array.from(new Set(formTags));

  // 1. Actualizar ficha principal
  await db
    .update(places)
    .set({
      name,
      address,
      city,
      latitude,
      longitude,
      googleMapsUrl,
      website,
      phone,
      priceRange,
      status,
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

  if (place.createdById !== currentUser.id && currentUser.role !== "admin") {
    return { error: "No tienes permiso para eliminar este establecimiento." };
  }

  // Limpieza en cascada explícita de registros dependientes para garantizar integridad total
  await db.delete(placeComments).where(eq(placeComments.placeId, placeId));
  await db.delete(userPlaces).where(eq(userPlaces.placeId, placeId));
  await db.delete(placeOccasions).where(eq(placeOccasions.placeId, placeId));
  await db.delete(placeTags).where(eq(placeTags.placeId, placeId));
  await db.delete(places).where(eq(places.id, placeId));
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

  // Regla de privacidad: mostrar si es público en la comunidad o si pertenece al usuario logueado
  if (currentUser) {
    whereConditions.push(
      sql`(${places.communityPublished} = true OR ${places.createdById} = ${currentUser.id})`
    );
  } else {
    whereConditions.push(sql`${places.communityPublished} = true`);
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

      // Comentarios
      const comments = await db
        .select({ id: placeComments.id })
        .from(placeComments)
        .where(eq(placeComments.placeId, place.id));

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
        experienceStatus,
      };
    })
  );

  return placesWithDetails;

  return placesWithDetails;
}
