"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, desc, and, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { places, placeOccasions, placeTags, users, type Place } from "@/db/schema";
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

  await db.delete(places).where(eq(places.id, placeId));
  revalidatePath("/");
  return { success: true };
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

  // Para cada lugar, recuperar ocasiones y etiquetas
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

      return {
        ...place,
        createdByName,
        createdByUsername,
        occasions: occs.map((o) => o.occasion),
        tags: tags.map((t) => t.tag),
        distanceMeters:
          distanceMeters !== null && distanceMeters !== undefined
            ? Math.round(Number(distanceMeters))
            : null,
      };
    })
  );

  return placesWithDetails;
}
