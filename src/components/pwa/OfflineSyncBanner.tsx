"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getPendingMutationsCount,
  flushOfflineQueue,
  OFFLINE_QUEUE_EVENT,
} from "@/lib/offlineQueue";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n/client";

export function OfflineSyncBanner() {
  const { t } = useT();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    const count = await getPendingMutationsCount();
    setPendingCount(count);
  }, []);

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const { synced, remaining } = await flushOfflineQueue();
      setPendingCount(remaining);
      if (synced > 0) {
        toast(t("offline.synced_toast", { count: synced }), { kind: "success" });
      }
    } finally {
      setSyncing(false);
    }
  }, [syncing, toast, t]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);
    refreshCount();

    function onOnline() {
      setIsOnline(true);
      handleSync();
    }
    function onOffline() {
      setIsOnline(false);
    }
    function onQueueChanged() {
      refreshCount();
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, onQueueChanged);

    // Si arrancamos online y había cambios pendientes de antes, sincronizar
    if (navigator.onLine) {
      getPendingMutationsCount().then((c) => {
        if (c > 0) handleSync();
      });
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, onQueueChanged);
    };
  }, [refreshCount, handleSync]);

  // Solo mostrar el banner si estamos sin conexión o si hay cambios pendientes de subir
  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`w-full rounded-2xl px-4 py-2.5 border flex flex-wrap items-center justify-between gap-2 text-xs shadow-xs animate-in fade-in duration-150 ${
        !isOnline
          ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200"
          : "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/60 text-orange-900 dark:text-orange-200"
      }`}
    >
      <div className="flex items-center gap-2 font-bold">
        <span className="material-symbols-outlined text-base leading-none">
          {!isOnline ? "cloud_off" : "cloud_sync"}
        </span>
        <span>
          {!isOnline
            ? pendingCount > 0
              ? t("offline.banner_offline_pending", { count: pendingCount })
              : t("offline.banner_offline")
            : t("offline.banner_pending", { count: pendingCount })}
        </span>
      </div>

      {isOnline && pendingCount > 0 && (
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] transition cursor-pointer disabled:opacity-50"
        >
          <span
            className={`material-symbols-outlined text-sm leading-none ${
              syncing ? "animate-spin" : ""
            }`}
          >
            sync
          </span>
          <span>{syncing ? t("offline.syncing") : t("offline.sync_now")}</span>
        </button>
      )}
    </div>
  );
}
