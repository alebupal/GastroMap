"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { placeVisits, userPlaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export interface PlaceVisitItem {
  id: string;
  placeId: string;
  visitedAt: Date;
  rating: number | null;
  notes: string | null;
  createdAt: Date;
}

/**
 * Obtiene el historial privado de visitas del usuario actual para un establecimiento.
 */
export async function getPlaceVisitsAction(placeId: string): Promise<PlaceVisitItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const rows = await db
    .select({
      id: placeVisits.id,
      placeId: placeVisits.placeId,
      visitedAt: placeVisits.visitedAt,
      rating: placeVisits.rating,
      notes: placeVisits.notes,
      createdAt: placeVisits.createdAt,
    })
    .from(placeVisits)
    .where(and(eq(placeVisits.placeId, placeId), eq(placeVisits.userId, user.id)))
    .orderBy(desc(placeVisits.visitedAt));

  return rows;
}

/**
 * Registra una nueva visita personal a un establecimiento y marca automáticamente
 * el establecimiento como 'visited' en user_places.
 */
export async function addPlaceVisitAction(params: {
  placeId: string;
  visitedAt: string; // YYYY-MM-DD
  rating?: number | null;
  notes?: string | null;
}): Promise<{ success?: boolean; visit?: PlaceVisitItem; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "No autenticado." };

  const parsedDate = params.visitedAt ? new Date(`${params.visitedAt}T12:00:00`) : new Date();
  if (isNaN(parsedDate.getTime())) {
    return { error: "Fecha de visita no válida." };
  }

  let validRating: number | null = null;
  if (params.rating !== null && params.rating !== undefined) {
    const n = Number(params.rating);
    if (!isNaN(n) && n >= 0 && n <= 10) {
      validRating = Math.round(n * 10) / 10;
    }
  }

  const cleanNotes = params.notes?.trim() || null;

  const [created] = await db
    .insert(placeVisits)
    .values({
      placeId: params.placeId,
      userId: user.id,
      visitedAt: parsedDate,
      rating: validRating,
      notes: cleanNotes,
    })
    .returning();

  // Marcar automáticamente como visitado en user_places (y actualizar rating si no tenía)
  const [existingUp] = await db
    .select()
    .from(userPlaces)
    .where(and(eq(userPlaces.placeId, params.placeId), eq(userPlaces.userId, user.id)))
    .limit(1);

  if (existingUp) {
    await db
      .update(userPlaces)
      .set({
        personalStatus: "visited",
        rating: validRating !== null ? validRating : existingUp.rating,
        updatedAt: new Date(),
      })
      .where(eq(userPlaces.id, existingUp.id));
  } else {
    await db.insert(userPlaces).values({
      placeId: params.placeId,
      userId: user.id,
      personalStatus: "visited",
      rating: validRating,
    });
  }

  revalidatePath("/");
  return {
    success: true,
    visit: {
      id: created.id,
      placeId: created.placeId,
      visitedAt: created.visitedAt,
      rating: created.rating,
      notes: created.notes,
      createdAt: created.createdAt,
    },
  };
}

/**
 * Elimina una visita personal del usuario actual.
 */
export async function deletePlaceVisitAction(
  visitId: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "No autenticado." };

  await db
    .delete(placeVisits)
    .where(and(eq(placeVisits.id, visitId), eq(placeVisits.userId, user.id)));

  revalidatePath("/");
  return { success: true };
}
