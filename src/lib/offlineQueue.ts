"use client";

import {
  toggleFavoriteAction,
  setPersonalStatusAction,
  setPersonalRatingAction,
  savePrivateNotesAction,
} from "@/lib/actions/interactions";

export type OfflineMutationInput =
  | {
      type: "toggle_favorite";
      placeId: string;
    }
  | {
      type: "set_status";
      placeId: string;
      status: "pending" | "visited" | null;
    }
  | {
      type: "save_personal_notes";
      placeId: string;
      rating: number | null;
      notes: string;
    };

export type OfflineMutation = OfflineMutationInput & {
  id?: number;
  createdAt: number;
};

const DB_NAME = "gastromap_offline_db";
const DB_VERSION = 1;
const STORE_NAME = "mutations";
export const OFFLINE_QUEUE_EVENT = "gastromap:offline-queue-changed";

function notifyQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
  }
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Encola una mutación en IndexedDB para sincronizarla cuando vuelva la conexión.
 */
export async function enqueueOfflineMutation(
  mutation: OfflineMutationInput
): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).add({
        ...mutation,
        createdAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    notifyQueueChanged();
  } catch {
    // Silenciar si IndexedDB no está disponible en modo incógnito estricto
  }
}

/**
 * Devuelve todas las mutaciones pendientes en orden FIFO.
 */
export async function getPendingMutations(): Promise<OfflineMutation[]> {
  try {
    const db = await openOfflineDb();
    const items = await new Promise<OfflineMutation[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as OfflineMutation[]) || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  } catch {
    return [];
  }
}

export async function getPendingMutationsCount(): Promise<number> {
  const items = await getPendingMutations();
  return items.length;
}

async function deleteMutationById(id: number): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/**
 * Sincroniza en orden FIFO todas las mutaciones encoladas contra el servidor.
 * Devuelve el número de operaciones sincronizadas correctamente.
 */
export async function flushOfflineQueue(): Promise<{ synced: number; remaining: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const remaining = await getPendingMutationsCount();
    return { synced: 0, remaining };
  }

  const items = await getPendingMutations();
  if (items.length === 0) return { synced: 0, remaining: 0 };

  let synced = 0;

  for (const item of items) {
    try {
      if (item.type === "toggle_favorite") {
        await toggleFavoriteAction(item.placeId);
      } else if (item.type === "set_status") {
        await setPersonalStatusAction(item.placeId, item.status);
      } else if (item.type === "save_personal_notes") {
        await Promise.all([
          setPersonalRatingAction(item.placeId, item.rating),
          savePrivateNotesAction(item.placeId, item.notes),
        ]);
      }

      if (typeof item.id === "number") {
        await deleteMutationById(item.id);
      }
      synced++;
    } catch {
      // Si falla la red a mitad, detener y reintentar cuando vuelva
      break;
    }
  }

  const remaining = await getPendingMutationsCount();
  notifyQueueChanged();
  return { synced, remaining };
}
