"use server";

import { revalidatePath } from "next/cache";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  userPlaces,
  placeComments,
  sharingGroups,
  sharingGroupMembers,
  users,
  type PlaceComment,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export interface CommentWithAuthor {
  id: string;
  placeId: string;
  userId: string;
  authorName: string;
  authorUsername: string | null;
  content: string;
  createdAt: Date;
}

/**
 * Alterna el estado de favorito de un establecimiento para el usuario actual
 */
export async function toggleFavoriteAction(placeId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autenticado" };

  const [existing] = await db
    .select()
    .from(userPlaces)
    .where(and(eq(userPlaces.userId, user.id), eq(userPlaces.placeId, placeId)))
    .limit(1);

  if (existing) {
    const newFav = !existing.favorite;
    await db
      .update(userPlaces)
      .set({ favorite: newFav, updatedAt: new Date() })
      .where(eq(userPlaces.id, existing.id));
    revalidatePath("/");
    return { success: true, favorite: newFav };
  } else {
    await db.insert(userPlaces).values({
      userId: user.id,
      placeId,
      favorite: true,
    });
    revalidatePath("/");
    return { success: true, favorite: true };
  }
}

/**
 * Modifica el estado personal: 'pending' (pendiente por visitar), 'visited' (visitado) o null
 */
export async function setPersonalStatusAction(
  placeId: string,
  status: "pending" | "visited" | null
) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autenticado" };

  const [existing] = await db
    .select()
    .from(userPlaces)
    .where(and(eq(userPlaces.userId, user.id), eq(userPlaces.placeId, placeId)))
    .limit(1);

  if (existing) {
    await db
      .update(userPlaces)
      .set({ personalStatus: status, updatedAt: new Date() })
      .where(eq(userPlaces.id, existing.id));
  } else {
    await db.insert(userPlaces).values({
      userId: user.id,
      placeId,
      personalStatus: status,
    });
  }

  revalidatePath("/");
  return { success: true, personalStatus: status };
}

/**
 * Asigna una valoración personal de 0 a 10 (ej: 8.5)
 */
export async function setPersonalRatingAction(
  placeId: string,
  rating: number | null
) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autenticado" };

  const [existing] = await db
    .select()
    .from(userPlaces)
    .where(and(eq(userPlaces.userId, user.id), eq(userPlaces.placeId, placeId)))
    .limit(1);

  if (existing) {
    await db
      .update(userPlaces)
      .set({ rating, updatedAt: new Date() })
      .where(eq(userPlaces.id, existing.id));
  } else {
    await db.insert(userPlaces).values({
      userId: user.id,
      placeId,
      rating,
    });
  }

  revalidatePath("/");
  return { success: true, rating };
}

/**
 * Guarda notas privadas (visibles solo para el usuario actual)
 */
export async function savePrivateNotesAction(
  placeId: string,
  privateNotes: string
) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autenticado" };

  const trimmed = privateNotes.trim() || null;

  const [existing] = await db
    .select()
    .from(userPlaces)
    .where(and(eq(userPlaces.userId, user.id), eq(userPlaces.placeId, placeId)))
    .limit(1);

  if (existing) {
    await db
      .update(userPlaces)
      .set({ privateNotes: trimmed, updatedAt: new Date() })
      .where(eq(userPlaces.id, existing.id));
  } else {
    await db.insert(userPlaces).values({
      userId: user.id,
      placeId,
      privateNotes: trimmed,
    });
  }

  revalidatePath("/");
  return { success: true, privateNotes: trimmed };
}

/**
 * Obtiene los comentarios compartidos de un establecimiento
 */
export async function getPlaceCommentsAction(
  placeId: string
): Promise<CommentWithAuthor[]> {
  const rows = await db
    .select({
      id: placeComments.id,
      placeId: placeComments.placeId,
      userId: placeComments.userId,
      content: placeComments.content,
      createdAt: placeComments.createdAt,
      authorName: users.name,
      authorUsername: users.username,
    })
    .from(placeComments)
    .leftJoin(users, eq(placeComments.userId, users.id))
    .where(eq(placeComments.placeId, placeId))
    .orderBy(desc(placeComments.createdAt));

  return rows.map((r) => ({
    ...r,
    authorName: r.authorName || "Miembro de GastroMap",
    authorUsername:
      r.authorUsername ||
      (r.authorName ? r.authorName.toLowerCase().replace(/\s+/g, "") : "comunidad"),
  }));
}

/**
 * Publica un nuevo comentario colaborativo
 */
export async function addCommentAction(placeId: string, content: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autenticado" };

  const trimmed = content.trim();
  if (!trimmed) return { error: "El comentario no puede estar vacío." };

  const [created] = await db
    .insert(placeComments)
    .values({
      placeId,
      userId: user.id,
      content: trimmed,
    })
    .returning();

  revalidatePath("/");
  return {
    success: true,
    comment: {
      id: created.id,
      placeId: created.placeId,
      userId: created.userId,
      content: created.content,
      createdAt: created.createdAt,
      authorName: user.name,
      authorUsername: user.username || user.name.toLowerCase().replace(/\s+/g, ""),
    },
  };
}

/**
 * Elimina un comentario (solo el autor o admin)
 */
export async function deleteCommentAction(commentId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autenticado" };

  const [comment] = await db
    .select()
    .from(placeComments)
    .where(eq(placeComments.id, commentId))
    .limit(1);

  if (!comment) return { error: "Comentario no encontrado." };
  if (comment.userId !== user.id && user.role !== "admin") {
    return { error: "No tienes permiso para eliminar este comentario." };
  }

  await db.delete(placeComments).where(eq(placeComments.id, commentId));
  revalidatePath("/");
  return { success: true };
}

/**
 * Grupos de compartición (Fase 5)
 */
export async function getSharingGroupsAction() {
  const user = await getCurrentUser();
  if (!user) return [];

  // Grupos creados o pertenecientes al usuario
  const groups = await db
    .select({
      group: sharingGroups,
    })
    .from(sharingGroups)
    .where(eq(sharingGroups.ownerUserId, user.id));

  return groups.map((g) => g.group);
}

export async function createSharingGroupAction(name: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autenticado" };

  const trimmed = name.trim();
  if (!trimmed) return { error: "El nombre del grupo es obligatorio." };

  const [group] = await db
    .insert(sharingGroups)
    .values({
      name: trimmed,
      ownerUserId: user.id,
    })
    .returning();

  // Añadir al propio dueño como miembro
  await db.insert(sharingGroupMembers).values({
    groupId: group.id,
    userId: user.id,
  });

  revalidatePath("/");
  return { success: true, group };
}
