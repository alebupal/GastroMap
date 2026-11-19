"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { places, placeOccasions, placeTags, tags } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export interface ImportPlacePayload {
  name: string;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  priceRange?: string;
  googleMapsUrl?: string | null;
  website?: string | null;
  phone?: string | null;
  notes?: string | null;
  occasions?: string[];
  tags?: string[];
}

export async function importPlacesAction(
  items: ImportPlacePayload[],
  communityPublished: boolean = true
): Promise<{ success?: boolean; importedCount?: number; skippedCount?: number; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "Debes iniciar sesión para importar establecimientos." };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: "No hay establecimientos válidos para importar." };
  }

  const maxBatch = 300;
  const toProcess = items.slice(0, maxBatch);
  let importedCount = 0;
  let skippedCount = 0;

  const validPrices = new Set(["€", "€€", "€€€", "€€€€", "???"]);

  for (const raw of toProcess) {
    const cleanName = raw.name?.trim();
    if (!cleanName || cleanName.length < 2) {
      skippedCount++;
      continue;
    }

    const lat =
      typeof raw.latitude === "number" && !isNaN(raw.latitude) ? raw.latitude : null;
    const lng =
      typeof raw.longitude === "number" && !isNaN(raw.longitude) ? raw.longitude : null;
    const priceRange =
      raw.priceRange && validPrices.has(raw.priceRange) ? raw.priceRange : "???";

    const [created] = await db
      .insert(places)
      .values({
        name: cleanName.slice(0, 255),
        city: raw.city?.trim()?.slice(0, 100) || null,
        address: raw.address?.trim() || null,
        latitude: lat,
        longitude: lng,
        priceRange,
        googleMapsUrl: raw.googleMapsUrl?.trim() || null,
        website: raw.website?.trim() || null,
        phone: raw.phone?.trim()?.slice(0, 50) || null,
        notes: raw.notes?.trim() || null,
        communityPublished,
        createdById: currentUser.id,
      })
      .returning();

    const occs = Array.from(new Set((raw.occasions || []).filter(Boolean)));
    if (occs.length > 0) {
      await db.insert(placeOccasions).values(
        occs.map((occ) => ({ placeId: created.id, occasion: occ }))
      );
    }

    const cleanTags = Array.from(
      new Set(
        (raw.tags || [])
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0)
      )
    );
    if (cleanTags.length > 0) {
      await db
        .insert(tags)
        .values(cleanTags.map((t) => ({ id: t, name: t })))
        .onConflictDoNothing();
      await db.insert(placeTags).values(
        cleanTags.map((t) => ({ placeId: created.id, tag: t }))
      );
    }

    importedCount++;
  }

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "place",
    entityId: "bulk_import",
    action: "places_imported",
    metadata: { importedCount, skippedCount, communityPublished },
  });

  revalidatePath("/");
  return { success: true, importedCount, skippedCount };
}
