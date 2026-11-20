"use server";

import { revalidatePath } from "next/cache";
import { eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  appSettings,
  places,
  placeOccasions,
  placeTags,
  placeComments,
  placeVisits,
  placeGroupAccess,
  placeUserAccess,
  userPlaces,
  sharingGroups,
  sharingGroupMembers,
  groupInvitations,
  savedFilters,
  auditLogs,
  invitations,
  sessions,
  users,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function getSetting(key: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function saveSettingAction(key: string, value: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "Solo los administradores pueden modificar la configuración." };
  }

  const cleanValue = value.trim();

  await db
    .insert(appSettings)
    .values({
      key,
      value: cleanValue || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: cleanValue || null,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/");
  return { success: true };
}

export async function resetApplicationAction() {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "Solo los administradores pueden resetear la aplicación." };
  }

  // 1. Limpieza de tablas dependientes de establecimientos
  await db.delete(placeVisits);
  await db.delete(placeComments);
  await db.delete(placeOccasions);
  await db.delete(placeTags);
  await db.delete(placeGroupAccess);
  await db.delete(placeUserAccess);
  await db.delete(userPlaces);
  await db.delete(places);

  // 2. Limpieza de grupos compartidos e invitaciones
  await db.delete(groupInvitations);
  await db.delete(sharingGroupMembers);
  await db.delete(sharingGroups);
  await db.delete(invitations);

  // 3. Limpieza de filtros guardados y registros de auditoría
  await db.delete(savedFilters);
  await db.delete(auditLogs);

  // 4. Limpieza de sesiones y usuarios excepto el usuario actual
  await db.delete(sessions).where(ne(sessions.userId, currentUser.id));
  await db.delete(users).where(ne(users.id, currentUser.id));

  revalidatePath("/");
  return { success: true };
}
