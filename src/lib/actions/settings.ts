"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
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
