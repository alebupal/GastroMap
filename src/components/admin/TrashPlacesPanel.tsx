"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getTrashPlacesAction,
  restorePlaceAction,
  purgePlaceAction,
  type TrashPlaceItem,
} from "@/lib/actions/places";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";

interface TrashPlacesPanelProps {
  groupId?: string | null;
  onRestored?: () => void;
}

export function TrashPlacesPanel({ groupId, onRestored }: TrashPlacesPanelProps) {
  const { t } = useT();
  const { toast } = useToast();
  const [items, setItems] = useState<TrashPlaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTrashPlacesAction(groupId);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  async function handleRestore(id: string) {
    setBusyId(id);
    const res = await restorePlaceAction(id);
    setBusyId(null);
    if (res.error) {
      toast(res.error, { kind: "error" });
    } else {
      toast(t("trash.restored_toast"), { kind: "success" });
      setItems((prev) => prev.filter((i) => i.id !== id));
      onRestored?.();
    }
  }

  async function handlePurge(item: TrashPlaceItem) {
    if (!confirm(t("trash.confirm_purge", { name: item.name }))) return;
    setBusyId(item.id);
    const res = await purgePlaceAction(item.id);
    setBusyId(null);
    if (res.error) {
      toast(res.error, { kind: "error" });
    } else {
      toast(t("trash.purged_toast"), { kind: "success" });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }
  }

  return (
    <div className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-3 text-left">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/70 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl leading-none">delete_sweep</span>
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {t("trash.title")} ({items.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("trash.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 py-6 text-center">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <div className="p-6 rounded-2xl bg-[#f8f9ff] dark:bg-slate-950/60 border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
          {t("trash.empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const busy = busyId === item.id;
            return (
              <div
                key={item.id}
                className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#f8f9ff] dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                      {item.name}
                    </span>
                    {!groupId && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200/70 dark:border-orange-800/60">
                        {item.groupId ? `${item.groupIcon || "🍻"} ${item.groupName}` : `🏠 ${t("spaces.personal_map")}`}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {item.city ? `${item.city} • ` : ""}
                    {t("trash.deleted_on", {
                      date: new Date(item.deletedAt).toLocaleDateString(),
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRestore(item.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm leading-none">
                      restore_from_trash
                    </span>
                    <span>{t("trash.restore_btn")}</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handlePurge(item)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/70 text-rose-700 dark:text-rose-300 transition cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm leading-none">
                      delete_forever
                    </span>
                    <span>{t("trash.purge_btn")}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
