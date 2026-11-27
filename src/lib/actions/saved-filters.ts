"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { savedFilters } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspace";

export interface SavedFilterCriteria {
  textSearch?: string;
  selectedOccasions?: string[];
  selectedTags?: string[];
  selectedPrices?: string[];
  experienceFilter?:
    | "all"
    | "visited_by_me"
    | "visited_by_others"
    | "untried"
    | "favorite"
    | "pending";
  radiusKm?: number | null;
  sortBy?: "recent" | "for_you" | "distance" | "name" | "price_asc" | "price_desc" | "rating";
}

export interface SavedFilterItem {
  id: string;
  name: string;
  criteria: SavedFilterCriteria;
  createdAt: Date;
}

export async function getSavedFiltersAction(): Promise<SavedFilterItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const ws = await getActiveWorkspace();
  const whereCond =
    ws?.mode === "group" && ws.groupId
      ? and(eq(savedFilters.userId, user.id), eq(savedFilters.groupId, ws.groupId))
      : ws?.mode === "personal"
        ? and(eq(savedFilters.userId, user.id), isNull(savedFilters.groupId))
        : eq(savedFilters.userId, user.id);

  const rows = await db
    .select()
    .from(savedFilters)
    .where(whereCond)
    .orderBy(desc(savedFilters.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    criteria: (r.criteria as SavedFilterCriteria) || {},
    createdAt: r.createdAt,
  }));
}

export async function createSavedFilterAction(
  name: string,
  criteria: SavedFilterCriteria
): Promise<{ success?: boolean; filter?: SavedFilterItem; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "No autenticado." };

  const cleanName = name.trim();
  if (cleanName.length < 2) {
    return { error: "El nombre del filtro debe tener al menos 2 caracteres." };
  }

  const ws = await getActiveWorkspace();
  const groupId = ws?.mode === "group" ? ws.groupId : null;

  const [created] = await db
    .insert(savedFilters)
    .values({
      userId: user.id,
      groupId,
      name: cleanName.slice(0, 100),
      criteria,
    })
    .returning();

  revalidatePath("/");
  return {
    success: true,
    filter: {
      id: created.id,
      name: created.name,
      criteria: (created.criteria as SavedFilterCriteria) || {},
      createdAt: created.createdAt,
    },
  };
}

export async function deleteSavedFilterAction(
  filterId: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "No autenticado." };

  await db
    .delete(savedFilters)
    .where(and(eq(savedFilters.id, filterId), eq(savedFilters.userId, user.id)));

  revalidatePath("/");
  return { success: true };
}
