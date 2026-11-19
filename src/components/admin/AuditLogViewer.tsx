"use client";

import { useState, useEffect, useMemo } from "react";
import { getAuditLogsAction, type AuditLogRow } from "@/lib/actions/audit";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { useT } from "@/lib/i18n/client";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  place_updated: { label: "Sitio editado", color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  place_deleted: { label: "Sitio eliminado", color: "bg-red-500/15 text-red-500 border-red-500/30" },
  place_merged: { label: "Sitios fusionados", color: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  user_disabled: { label: "Usuario desactivado", color: "bg-red-500/15 text-red-500 border-red-500/30" },
  user_enabled: { label: "Usuario reactivado", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
};

export function AuditLogViewer() {
  const { t } = useT();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await getAuditLogsAction(200);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = useMemo(() => {
    if (entityFilter === "all") return logs;
    return logs.filter((l) => l.entityType === entityFilter);
  }, [logs, entityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  return (
    <div className="w-full space-y-3 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
        <div>
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <span>📜</span>
            <span>{t("admin_audit.title")} ({filtered.length})</span>
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t("admin_audit.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="all">{t("admin_audit.filter_all")}</option>
            <option value="place">{t("admin_places.col_place")}</option>
            <option value="user">{t("admin_users.col_user")}</option>
          </select>

          <button
            type="button"
            onClick={loadLogs}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            ↻ {t("admin_audit.refresh")}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 text-center py-6">{t("admin_stats.loading")}</p>
      ) : paginated.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
          {t("admin_audit.empty")}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">{t("admin_audit.col_date")}</th>
                  <th className="p-3">{t("admin_audit.col_user")}</th>
                  <th className="p-3">{t("admin_audit.col_action")}</th>
                  <th className="p-3">{t("admin_audit.col_details")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {paginated.map((row) => {
                  const badge = ACTION_LABELS[row.action] || {
                    label: row.action,
                    color: "bg-slate-500/15 text-slate-400 border-slate-500/30",
                  };
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3 whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">
                        {new Date(row.createdAt).toLocaleString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3 whitespace-nowrap font-semibold">
                        @{row.actorUsername || row.actorName}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {row.metadata ? JSON.stringify(row.metadata) : row.entityId}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PaginationBar
        currentPage={safePage}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        itemLabel={t("pagination.records")}
      />
    </div>
  );
}
