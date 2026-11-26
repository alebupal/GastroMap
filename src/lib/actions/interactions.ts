"use server";

import { revalidatePath } from "next/cache";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  places,
  userPlaces,
  placeComments,
  users,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getPlacePermissions } from "@/lib/workspace";

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
 * Establece de forma idempotente el estado de favorito de un establecimiento para el usuario actual
 */
export async function setFavoriteAction(placeId: string, favorite: boolean) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autenticado" };

  await db
    .insert(userPlaces)
    .values({
      userId: user.id,
      placeId,
      favorite,
    })
    .onConflictDoUpdate({
      target: [userPlaces.userId, userPlaces.placeId],
      set: { favorite, updatedAt: new Date() },
    });

  return { success: true, favorite };
}

/**
 * Alterna el estado de favorito de un establecimiento para el usuario actual
 */
export async function toggleFavoriteAction(placeId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autenticado" };

  const [existing] = await db
    .select({ id: userPlaces.id, favorite: userPlaces.favorite })
    .from(userPlaces)
    .where(and(eq(userPlaces.userId, user.id), eq(userPlaces.placeId, placeId)))
    .limit(1);

  const nextFav = existing ? !existing.favorite : true;
  await db
    .insert(userPlaces)
    .values({
      userId: user.id,
      placeId,
      favorite: nextFav,
    })
    .onConflictDoUpdate({
      target: [userPlaces.userId, userPlaces.placeId],
      set: { favorite: nextFav, updatedAt: new Date() },
    });

  return { success: true, favorite: nextFav };
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

  await db
    .insert(userPlaces)
    .values({
      userId: user.id,
      placeId,
      personalStatus: status,
    })
    .onConflictDoUpdate({
      target: [userPlaces.userId, userPlaces.placeId],
      set: { personalStatus: status, updatedAt: new Date() },
    });

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

  await db
    .insert(userPlaces)
    .values({
      userId: user.id,
      placeId,
      rating,
    })
    .onConflictDoUpdate({
      target: [userPlaces.userId, userPlaces.placeId],
      set: { rating, updatedAt: new Date() },
    });

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

  await db
    .insert(userPlaces)
    .values({
      userId: user.id,
      placeId,
      privateNotes: trimmed,
    })
    .onConflictDoUpdate({
      target: [userPlaces.userId, userPlaces.placeId],
      set: { privateNotes: trimmed, updatedAt: new Date() },
    });

  return { success: true, privateNotes: trimmed };
}

/**
 * Obtiene los comentarios compartidos de un establecimiento
 */
export async function getPlaceCommentsAction(
  placeId: string
): Promise<CommentWithAuthor[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const [place] = await db.select().from(places).where(eq(places.id, placeId)).limit(1);
  if (!place) return [];

  const perms = await getPlacePermissions(user, place);
  if (!perms.canRead) return [];

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
 * Publica un nuevo comentario colaborativo (solo miembros con acceso al espacio del sitio)
 */
export async function addCommentAction(placeId: string, content: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autenticado" };

  const trimmed = content.trim();
  if (!trimmed) return { error: "El comentario no puede estar vacío." };

  const [place] = await db.select().from(places).where(eq(places.id, placeId)).limit(1);
  if (!place) return { error: "Establecimiento no encontrado." };

  const perms = await getPlacePermissions(user, place);
  if (!perms.canRead) return { error: "No tienes acceso a este establecimiento." };

  const [created] = await db
    .insert(placeComments)
    .values({
      placeId,
      userId: user.id,
      content: trimmed,
    })
    .returning();

  await logAudit({
    actorUserId: user.id,
    entityType: "comment",
    entityId: created.id,
    action: "comment_created",
    metadata: { placeId, preview: trimmed.slice(0, 80) },
  });

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
 * Elimina un comentario (el autor, Admin del grupo o Superadmin)
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

  let canModerate = comment.userId === user.id || user.role === "admin";
  if (!canModerate) {
    const [place] = await db
      .select()
      .from(places)
      .where(eq(places.id, comment.placeId))
      .limit(1);
    if (place) {
      const perms = await getPlacePermissions(user, place);
      canModerate = perms.isGroupAdmin;
    }
  }

  if (!canModerate) {
    return { error: "No tienes permiso para eliminar este comentario." };
  }

  await db.delete(placeComments).where(eq(placeComments.id, commentId));
  await logAudit({
    actorUserId: user.id,
    entityType: "comment",
    entityId: commentId,
    action: "comment_deleted",
    metadata: {
      placeId: comment.placeId,
      deletedByAdmin: comment.userId !== user.id,
    },
  });
  revalidatePath("/");
  return { success: true };
}

/**
 * Edita el contenido de un comentario (el autor, Admin del grupo o Superadmin)
 */
export async function updateCommentAction(
  commentId: string,
  content: string,
  newUserId?: string
) {
  const user = await getCurrentUser();
  if (!user) return { error: "No autenticado" };

  const trimmed = content.trim();
  if (!trimmed) return { error: "El comentario no puede estar vacío." };

  const [comment] = await db
    .select()
    .from(placeComments)
    .where(eq(placeComments.id, commentId))
    .limit(1);

  if (!comment) return { error: "Comentario no encontrado." };

  let isGroupAdmin = false;
  let canModerate = comment.userId === user.id || user.role === "admin";
  const [place] = await db
    .select()
    .from(places)
    .where(eq(places.id, comment.placeId))
    .limit(1);
  if (place) {
    const perms = await getPlacePermissions(user, place);
    isGroupAdmin = perms.isGroupAdmin;
    if (!canModerate) canModerate = isGroupAdmin;
  }

  if (!canModerate) {
    return { error: "No tienes permiso para editar este comentario." };
  }

  let nextUserId = comment.userId;
  let nextAuthorName: string | undefined;
  if (newUserId && newUserId !== comment.userId) {
    if (user.role !== "admin" && !isGroupAdmin) {
      return { error: "No tienes permiso para reasignar el autor del comentario." };
    }
    const [targetUser] = await db
      .select({ id: users.id, name: users.name, username: users.username })
      .from(users)
      .where(eq(users.id, newUserId))
      .limit(1);
    if (!targetUser) {
      return { error: "El usuario seleccionado no existe." };
    }
    nextUserId = targetUser.id;
    nextAuthorName = targetUser.username ? `@${targetUser.username}` : targetUser.name;
  }

  await db
    .update(placeComments)
    .set({
      content: trimmed,
      userId: nextUserId,
      updatedAt: new Date(),
    })
    .where(eq(placeComments.id, commentId));

  await logAudit({
    actorUserId: user.id,
    entityType: "comment",
    entityId: commentId,
    action: "comment_updated",
    metadata: {
      placeId: comment.placeId,
      editedByAdmin: comment.userId !== user.id,
      reassignedToUserId: nextUserId !== comment.userId ? nextUserId : undefined,
      preview: trimmed.slice(0, 80),
    },
  });

  revalidatePath("/");
  return {
    success: true,
    content: trimmed,
    userId: nextUserId,
    authorName: nextAuthorName,
  };
}
