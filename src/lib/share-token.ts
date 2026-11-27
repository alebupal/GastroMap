import crypto from "crypto";

function getShareSecret(): string {
  return (
    process.env.APP_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.DATABASE_URL ||
    "gastromap-default-dev-share-secret"
  );
}

/**
 * Genera una firma HMAC corta (16 hex chars) para compartir una ficha pública /p/[id]?s=...
 * sin exponer el catálogo a enumeración de IDs.
 */
export function signPlaceShareToken(placeId: string): string {
  return crypto
    .createHmac("sha256", getShareSecret())
    .update(`place-share:${placeId}`)
    .digest("hex")
    .slice(0, 16);
}

export function verifyPlaceShareToken(placeId: string, token?: string | null): boolean {
  if (!token || typeof token !== "string") return false;
  const expected = signPlaceShareToken(placeId);
  const a = Buffer.from(token.trim(), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
