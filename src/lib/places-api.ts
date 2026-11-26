import crypto from "crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiUsage, placesApiCache, sharingGroups } from "@/db/schema";
import { getSetting } from "@/lib/actions/settings";
import { fetchGooglePlacesDetails } from "@/lib/maps";

function getEncryptionSecret(): Buffer {
  const raw =
    process.env.APP_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.DATABASE_URL ||
    "gastromap-default-dev-secret-key";
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptApiKey(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionSecret(), iv);
  const enc = Buffer.concat([cipher.update(plain.trim(), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptApiKey(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [ivB64, tagB64, dataB64] = payload.split(":");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getEncryptionSecret(),
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

export function maskApiKey(plain: string | null | undefined): string | null {
  if (!plain || plain.trim().length < 4) return null;
  const clean = plain.trim();
  return `••••••••${clean.slice(-4)}`;
}

export function getCurrentPeriodKey(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function incrementUsage(
  scopeKey: string,
  field: "requests" | "cacheHits" | "blocked"
) {
  const period = getCurrentPeriodKey();
  const reqInc = field === "requests" ? 1 : 0;
  const cacheInc = field === "cacheHits" ? 1 : 0;
  const blkInc = field === "blocked" ? 1 : 0;

  await db
    .insert(apiUsage)
    .values({
      scopeKey,
      provider: "google_places",
      period,
      requests: reqInc,
      cacheHits: cacheInc,
      blocked: blkInc,
      lastAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [apiUsage.scopeKey, apiUsage.provider, apiUsage.period],
      set: {
        requests: sql`${apiUsage.requests} + ${reqInc}`,
        cacheHits: sql`${apiUsage.cacheHits} + ${cacheInc}`,
        blocked: sql`${apiUsage.blocked} + ${blkInc}`,
        lastAt: new Date(),
      },
    });
}

export interface PlacesLookupResult {
  source: "cache" | "group_key" | "project_key" | "quota_exceeded" | "no_key";
  data: Awaited<ReturnType<typeof fetchGooglePlacesDetails>>;
}

/**
 * Resuelve datos de un establecimiento con Google Places API aplicando:
 * 1) Caché compartida 30 días (coste 0).
 * 2) Clave propia cifrada del grupo si existe.
 * 3) Clave global del proyecto respetando el cupo por grupo (default 50/mes) y límite global (default 1000/mes).
 */
export async function resolvePlacesLookup(params: {
  groupId?: string | null;
  textQuery: string;
  latitudeHint?: number;
  longitudeHint?: number;
}): Promise<PlacesLookupResult> {
  const cleanQuery = params.textQuery.trim();
  if (!cleanQuery) return { source: "no_key", data: null };

  const queryKey = cleanQuery.toLowerCase().slice(0, 320);
  const scopeKey = params.groupId ? `group:${params.groupId}` : "project";

  // 1. Caché global 30 días
  const [cached] = await db
    .select()
    .from(placesApiCache)
    .where(and(eq(placesApiCache.queryKey, queryKey), gt(placesApiCache.expiresAt, new Date())))
    .limit(1);

  if (cached) {
    await incrementUsage(scopeKey, "cacheHits");
    return {
      source: "cache",
      data: cached.payload as Awaited<ReturnType<typeof fetchGooglePlacesDetails>>,
    };
  }

  // 2. Clave propia del grupo
  let groupQuotaOverride: number | null = null;
  if (params.groupId) {
    const [group] = await db
      .select({
        keyEnc: sharingGroups.googlePlacesApiKeyEnc,
        quota: sharingGroups.placesApiMonthlyQuota,
      })
      .from(sharingGroups)
      .where(eq(sharingGroups.id, params.groupId))
      .limit(1);

    groupQuotaOverride = group?.quota ?? null;
    const groupKey = decryptApiKey(group?.keyEnc);
    if (groupKey) {
      const data = await fetchGooglePlacesDetails({
        apiKey: groupKey,
        query: cleanQuery,
        latitude: params.latitudeHint,
        longitude: params.longitudeHint,
      });
      await incrementUsage(scopeKey, "requests");
      if (data) {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await db
          .insert(placesApiCache)
          .values({
            queryKey,
            googlePlaceId: null,
            payload: data,
            expiresAt,
          })
          .onConflictDoUpdate({
            target: placesApiCache.queryKey,
            set: { payload: data, expiresAt },
          });
      }
      return { source: "group_key", data };
    }
  }

  // 3. Clave global del proyecto con control de cupos
  const [projectKey, rawGlobalLimit, rawGroupLimit] = await Promise.all([
    getSetting("google_places_api_key"),
    getSetting("places_api_project_monthly_limit"),
    getSetting("places_api_group_default_quota"),
  ]);

  if (!projectKey || !projectKey.trim()) {
    return { source: "no_key", data: null };
  }

  const globalLimit = Math.max(1, parseInt(rawGlobalLimit || "1000", 10) || 1000);
  const groupLimit = Math.max(
    1,
    groupQuotaOverride ?? (parseInt(rawGroupLimit || "50", 10) || 50)
  );
  const period = getCurrentPeriodKey();

  const [[projUsage], [grpUsage]] = await Promise.all([
    db
      .select({ requests: apiUsage.requests })
      .from(apiUsage)
      .where(
        and(
          eq(apiUsage.scopeKey, "project"),
          eq(apiUsage.provider, "google_places"),
          eq(apiUsage.period, period)
        )
      )
      .limit(1),
    params.groupId
      ? db
          .select({ requests: apiUsage.requests })
          .from(apiUsage)
          .where(
            and(
              eq(apiUsage.scopeKey, `group:${params.groupId}`),
              eq(apiUsage.provider, "google_places"),
              eq(apiUsage.period, period)
            )
          )
          .limit(1)
      : Promise.resolve([]),
  ]);

  if (
    (projUsage?.requests ?? 0) >= globalLimit ||
    (params.groupId && (grpUsage?.requests ?? 0) >= groupLimit)
  ) {
    await incrementUsage(scopeKey, "blocked");
    return { source: "quota_exceeded", data: null };
  }

  const data = await fetchGooglePlacesDetails({
    apiKey: projectKey,
    query: cleanQuery,
    latitude: params.latitudeHint,
    longitude: params.longitudeHint,
  });

  await incrementUsage("project", "requests");
  if (params.groupId) {
    await incrementUsage(`group:${params.groupId}`, "requests");
  }

  if (data) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db
      .insert(placesApiCache)
      .values({
        queryKey,
        googlePlaceId: null,
        payload: data,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: placesApiCache.queryKey,
        set: { payload: data, expiresAt },
      });
  }

  return { source: "project_key", data };
}

/**
 * Estadísticas de uso de la API de Google Places para un grupo concreto.
 */
export async function getGroupApiUsageSummary(groupId: string) {
  const period = getCurrentPeriodKey();
  const [rawGroupLimit, rows, [grp]] = await Promise.all([
    getSetting("places_api_group_default_quota"),
    db.select().from(apiUsage).where(eq(apiUsage.period, period)),
    db
      .select({
        keyEnc: sharingGroups.googlePlacesApiKeyEnc,
        quota: sharingGroups.placesApiMonthlyQuota,
      })
      .from(sharingGroups)
      .where(eq(sharingGroups.id, groupId))
      .limit(1),
  ]);

  const groupDefaultLimit = Math.max(1, parseInt(rawGroupLimit || "50", 10) || 50);
  const row = rows.find((r) => r.scopeKey === `group:${groupId}`);
  const decrypted = decryptApiKey(grp?.keyEnc);
  const hasOwnKey = Boolean(decrypted);
  const maskedKey = maskApiKey(decrypted);

  return {
    period,
    requests: row?.requests ?? 0,
    cacheHits: row?.cacheHits ?? 0,
    blocked: row?.blocked ?? 0,
    limit: hasOwnKey ? null : grp?.quota ?? groupDefaultLimit,
    hasOwnKey,
    maskedKey,
  };
}

/**
 * Estadísticas globales de uso de la API de Google Places para /admin.
 */
export async function getGlobalApiUsageSummary() {
  const period = getCurrentPeriodKey();
  const [rawGlobalLimit, rawGroupLimit, rows] = await Promise.all([
    getSetting("places_api_project_monthly_limit"),
    getSetting("places_api_group_default_quota"),
    db.select().from(apiUsage).where(eq(apiUsage.period, period)),
  ]);

  const globalLimit = Math.max(1, parseInt(rawGlobalLimit || "1000", 10) || 1000);
  const groupDefaultLimit = Math.max(1, parseInt(rawGroupLimit || "50", 10) || 50);
  const projectRow = rows.find((r) => r.scopeKey === "project");

  return {
    period,
    projectRequests: projectRow?.requests ?? 0,
    projectCacheHits: projectRow?.cacheHits ?? 0,
    projectBlocked: projectRow?.blocked ?? 0,
    globalLimit,
    groupDefaultLimit,
    groups: rows
      .filter((r) => r.scopeKey.startsWith("group:"))
      .map((r) => ({
        groupId: r.scopeKey.replace("group:", ""),
        requests: r.requests,
        cacheHits: r.cacheHits,
        blocked: r.blocked,
      }))
      .sort((a, b) => b.requests - a.requests),
  };
}
