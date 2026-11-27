"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { places, occasions, placeOccasions, placeTags, tags, userPlaces, placeComments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { KNOWN_OCCASIONS } from "@/data/occasions";
import { parseCityCountry } from "@/lib/location";
import { normalizeMapsUrlKey, normalizePlaceName } from "@/lib/place-identity";
import { buildScopeKey, getActiveWorkspace, getGroupMembership } from "@/lib/workspace";

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
  comments?: string[] | null;
  comment?: string | null;
  occasions?: string[];
  tags?: string[];
  personalStatus?: "pending" | "visited" | null;
}

export async function importPlacesAction(
  items: ImportPlacePayload[],
  communityPublished: boolean = true,
  explicitTargetSpace?: string | null
): Promise<{ success?: boolean; importedCount?: number; skippedCount?: number; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "Debes iniciar sesión para importar establecimientos." };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: "No hay establecimientos válidos para importar." };
  }

  let targetGroupId: string | null = null;
  if (explicitTargetSpace !== undefined && explicitTargetSpace !== null) {
    if (explicitTargetSpace === "personal") {
      targetGroupId = null;
    } else {
      const gid = explicitTargetSpace.startsWith("group:")
        ? explicitTargetSpace.slice("group:".length)
        : explicitTargetSpace;
      const membership = await getGroupMembership(currentUser.id, gid);
      if (!membership.isMember && currentUser.role !== "admin") {
        return { error: "No perteneces al grupo destino." };
      }
      targetGroupId = gid;
    }
  } else if (!communityPublished) {
    targetGroupId = null;
  } else {
    const ws = await getActiveWorkspace();
    targetGroupId = ws?.mode === "group" ? ws.groupId : null;
  }

  const scopeKey = buildScopeKey(targetGroupId, currentUser.id);

  const existingInSpace = await db
    .select({
      name: places.name,
      mapsUrlKey: places.mapsUrlKey,
      googleMapsUrl: places.googleMapsUrl,
    })
    .from(places)
    .where(
      targetGroupId !== null
        ? and(eq(places.groupId, targetGroupId), isNull(places.deletedAt))
        : and(isNull(places.groupId), eq(places.createdById, currentUser.id), isNull(places.deletedAt))
    );

  const existingUrlKeys = new Set<string>();
  const existingNames = new Set<string>();
  for (const row of existingInSpace) {
    const k = row.mapsUrlKey || normalizeMapsUrlKey(row.googleMapsUrl);
    if (k) existingUrlKeys.add(k);
    const n = normalizePlaceName(row.name);
    if (n) existingNames.add(n);
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

    const urlKey = normalizeMapsUrlKey(raw.googleMapsUrl);
    const normName = normalizePlaceName(cleanName);
    if ((urlKey && existingUrlKeys.has(urlKey)) || (normName && existingNames.has(normName))) {
      skippedCount++;
      continue;
    }
    if (urlKey) existingUrlKeys.add(urlKey);
    if (normName) existingNames.add(normName);

    const lat =
      typeof raw.latitude === "number" && !isNaN(raw.latitude) ? raw.latitude : null;
    const lng =
      typeof raw.longitude === "number" && !isNaN(raw.longitude) ? raw.longitude : null;
    const priceRange =
      raw.priceRange && validPrices.has(raw.priceRange) ? raw.priceRange : "???";

    const cleanCity = raw.city?.trim()?.slice(0, 100) || null;
    const cleanAddress = raw.address?.trim() || null;
    const inferredCountry = parseCityCountry(cleanCity, cleanAddress).country || null;

    const [created] = await db
      .insert(places)
      .values({
        groupId: targetGroupId,
        name: cleanName.slice(0, 255),
        city: cleanCity,
        country: inferredCountry,
        address: cleanAddress,
        latitude: lat,
        longitude: lng,
        priceRange,
        googleMapsUrl: raw.googleMapsUrl?.trim() || null,
        mapsUrlKey: urlKey,
        website: raw.website?.trim() || null,
        phone: raw.phone?.trim()?.slice(0, 50) || null,
        notes: raw.notes?.trim() || null,
        communityPublished: targetGroupId !== null,
        createdById: currentUser.id,
      })
      .returning();

    const occs = Array.from(
      new Set(
        (raw.occasions || [])
          .map((o) => (typeof o === "string" ? o.trim().toLowerCase() : ""))
          .filter(Boolean)
      )
    );
    if (occs.length > 0) {
      await db
        .insert(occasions)
        .values(
          occs.map((occId) => {
            const known = KNOWN_OCCASIONS[occId];
            return {
              scopeKey,
              id: occId,
              name: known
                ? known.name
                : occId.charAt(0).toUpperCase() + occId.slice(1).replace(/[-_]/g, " "),
              icon: known ? known.icon : "🍽️",
            };
          })
        )
        .onConflictDoNothing();

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
        .values(cleanTags.map((t) => ({ scopeKey, id: t, name: t })))
        .onConflictDoNothing();
      await db.insert(placeTags).values(
        cleanTags.map((t) => ({ placeId: created.id, tag: t }))
      );
    }

    if (raw.personalStatus === "visited" || raw.personalStatus === "pending") {
      await db
        .insert(userPlaces)
        .values({
          userId: currentUser.id,
          placeId: created.id,
          personalStatus: raw.personalStatus,
        })
        .onConflictDoUpdate({
          target: [userPlaces.userId, userPlaces.placeId],
          set: { personalStatus: raw.personalStatus },
        });
    }

    const rawComments: string[] = [];
    if (typeof raw.comment === "string" && raw.comment.trim()) {
      rawComments.push(raw.comment.trim());
    }
    if (Array.isArray(raw.comments)) {
      for (const c of raw.comments) {
        if (typeof c === "string" && c.trim()) {
          rawComments.push(c.trim());
        }
      }
    }
    if (rawComments.length > 0) {
      await db.insert(placeComments).values(
        rawComments.map((content) => ({
          placeId: created.id,
          userId: currentUser.id,
          content,
        }))
      );
    }

    importedCount++;
  }

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "place",
    entityId: "bulk_import",
    action: "places_imported",
    metadata: { importedCount, skippedCount, groupId: targetGroupId },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  return { success: true, importedCount, skippedCount };
}
