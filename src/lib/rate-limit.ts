import { headers } from "next/headers";

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

// Limpieza periódica para que el mapa no crezca indefinidamente
let lastSweep = Date.now();
function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    b.hits = b.hits.filter((t) => now - t < windowMs);
    if (b.hits.length === 0) buckets.delete(key);
  }
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") || "unknown";
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

/**
 * Límite en memoria por (acción + IP [+ clave extra]). Suficiente para una instancia única.
 * @param action  nombre lógico, ej. "login"
 * @param limit   nº máximo de intentos dentro de la ventana
 * @param windowMs duración de la ventana
 */
export async function rateLimit(
  action: string,
  limit: number,
  windowMs: number,
  extraKey = ""
): Promise<RateLimitResult> {
  const ip = await getClientIp();
  const key = `${action}:${ip}:${extraKey}`;
  const now = Date.now();
  sweep(now, windowMs);

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const retryAfterSec = Math.ceil((windowMs - (now - bucket.hits[0])) / 1000);
    buckets.set(key, bucket);
    return { allowed: false, retryAfterSec };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSec: 0 };
}

/** Borra el contador (p. ej. tras un login correcto). */
export async function resetRateLimit(action: string, extraKey = ""): Promise<void> {
  const ip = await getClientIp();
  buckets.delete(`${action}:${ip}:${extraKey}`);
}
