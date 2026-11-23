"use client";

/**
 * Devuelve el tamaño estimado usado por la caché/almacenamiento del navegador en MB (si el navegador soporta Storage API).
 */
export async function getBrowserCacheEstimate(): Promise<{
  usageMB: number | null;
  quotaMB: number | null;
  cacheCount: number;
}> {
  let usageMB: number | null = null;
  let quotaMB: number | null = null;
  let cacheCount = 0;

  if (typeof window === "undefined") {
    return { usageMB, quotaMB, cacheCount };
  }

  try {
    if ("caches" in window) {
      const keys = await window.caches.keys();
      cacheCount = keys.length;
    }
    if (navigator.storage && typeof navigator.storage.estimate === "function") {
      const est = await navigator.storage.estimate();
      if (typeof est.usage === "number") {
        usageMB = Math.round((est.usage / (1024 * 1024)) * 10) / 10;
      }
      if (typeof est.quota === "number") {
        quotaMB = Math.round(est.quota / (1024 * 1024));
      }
    }
  } catch {
    // Ignorar errores en contextos restringidos
  }

  return { usageMB, quotaMB, cacheCount };
}

/**
 * Limpia todas las cachés del Service Worker (teselas de mapa, assets, páginas offline)
 * y desregistra el Service Worker activo para forzar una recarga limpia.
 */
export async function clearAppOfflineCache(): Promise<number> {
  if (typeof window === "undefined") return 0;

  let deletedCount = 0;

  try {
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(
        keys.map(async (key) => {
          const ok = await window.caches.delete(key);
          if (ok) deletedCount++;
        })
      );
    }

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    }
  } catch {
    // Continuar con recarga aunque falle algún paso
  }

  return deletedCount;
}
