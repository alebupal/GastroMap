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

type DateRangeFilter = "all" | "today" | "7d" | "30d";

export function AuditLogViewer() {
  const { t, locale } = useT();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros de búsqueda avanzados
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await getAuditLogsAction(300);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  // Opciones dinámicas de acciones, usuarios y entidades presentes en el registro
  const { availableActions, availableActors, availableEntities } = useMemo(() => {
    const actionsSet = new Set<string>();
    const actorsMap = new Map<string, string>();
    const entitiesSet = new Set<string>();

    for (const l of logs) {
      if (l.action) actionsSet.add(l.action);
      if (l.entityType) entitiesSet.add(l.entityType);
      const actorKey = l.actorUsername || l.actorName;
      if (actorKey) {
        actorsMap.set(actorKey, `@${actorKey}`);
      }
    }

    return {
      availableActions: Array.from(actionsSet).sort(),
      availableActors: Array.from(actorsMap.entries()).sort((a, b) =>
        a[0].localeCompare(b[0])
      ),
      availableEntities: Array.from(entitiesSet).sort(),
    };
  }, [logs]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    entityFilter !== "all" ||
    actionFilter !== "all" ||
    actorFilter !== "all" ||
    dateRange !== "all";

  function resetFilters() {
    setSearchQuery("");
    setEntityFilter("all");
    setActionFilter("all");
    setActorFilter("all");
    setDateRange("all");
    setCurrentPage(1);
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return logs.filter((l) => {
      if (entityFilter !== "all" && l.entityType !== entityFilter) return false;
      if (actionFilter !== "all" && l.action !== actionFilter) return false;

      const actorKey = l.actorUsername || l.actorName || "";
      if (actorFilter !== "all" && actorKey !== actorFilter) return false;

      if (dateRange !== "all") {
        const ts = new Date(l.createdAt).getTime();
        if (dateRange === "today" && ts < startOfToday.getTime()) return false;
        if (dateRange === "7d" && now - ts > 7 * 24 * 60 * 60 * 1000) return false;
        if (dateRange === "30d" && now - ts > 30 * 24 * 60 * 60 * 1000) return false;
      }

      if (q) {
        const actionLabel = ACTION_LABELS[l.action]?.label || l.action;
        const haystack = [
          actorKey,
          l.actorName || "",
          l.action,
          actionLabel,
          l.entityType,
          l.entityId,
          l.metadata ? JSON.stringify(l.metadata) : "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [logs, searchQuery, entityFilter, actionFilter, actorFilter, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  return (
    <div className="w-full space-y-3 text-left">
      {/* Cabecera y barra de filtros avanzados */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl leading-none">history</span>
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {t("admin_audit.title")} ({filtered.length})
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {t("admin_audit.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm leading-none">filter_alt_off</span>
                <span>{t("places.clear_filter")}</span>
              </button>
            )}
            <button
              type="button"
              onClick={loadLogs}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-sm leading-none ${loading ? "animate-spin" : ""}`}>
                refresh
              </span>
              <span>{t("admin_audit.refresh")}</span>
            </button>
          </div>
        </div>

        {/* Fila de filtros: Buscador + Entidad + Acción + Usuario + Fecha */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* 1. Buscador libre */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <span className="material-symbols-outlined text-base text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none leading-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t("admin_audit.search_placeholder")}
              className="w-full pl-9 pr-7 py-2 rounded-full text-xs bg-[#f8f9ff] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                aria-label={t("places.clear_filter")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* 2. Filtro por entidad */}
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label={t("admin_audit.col_entity")}
            className="w-full px-3 py-2 rounded-full text-xs font-semibold bg-[#f8f9ff] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
          >
            <option value="all">{t("admin_audit.filter_all_entities")}</option>
            <option value="place">{t("admin_places.col_place")}</option>
            <option value="user">{t("admin_users.col_user")}</option>
            {availableEntities
              .filter((e) => e !== "place" && e !== "user")
              .map((ent) => (
                <option key={ent} value={ent}>
                  {ent}
                </option>
              ))}
          </select>

          {/* 3. Filtro por acción */}
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label={t("admin_audit.col_action")}
            className="w-full px-3 py-2 rounded-full text-xs font-semibold bg-[#f8f9ff] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
          >
            <option value="all">{t("admin_audit.filter_all")}</option>
            {availableActions.map((act) => (
              <option key={act} value={act}>
                {ACTION_LABELS[act]?.label || act}
              </option>
            ))}
          </select>

          {/* 4. Filtro por usuario */}
          <select
            value={actorFilter}
            onChange={(e) => {
              setActorFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label={t("admin_audit.col_user")}
            className="w-full px-3 py-2 rounded-full text-xs font-semibold bg-[#f8f9ff] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
          >
            <option value="all">{t("admin_audit.filter_all_users")}</option>
            {availableActors.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          {/* 5. Filtro por rango de fechas */}
          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value as DateRangeFilter);
              setCurrentPage(1);
            }}
            aria-label={t("admin_audit.col_date")}
            className="w-full px-3 py-2 rounded-full text-xs font-semibold bg-[#f8f9ff] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
          >
            <option value="all">{t("admin_audit.date_all")}</option>
            <option value="today">{t("admin_audit.date_today")}</option>
            <option value="7d">{t("admin_audit.date_7d")}</option>
            <option value="30d">{t("admin_audit.date_30d")}</option>
          </select>
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
                        {new Date(row.createdAt).toLocaleString(locale === "en" ? "en-GB" : "es-ES", {
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
