"use client";

import { useState, useEffect } from "react";
import { getAdminStatsAction, type AdminStatsData, type CountItem } from "@/lib/actions/stats";
import { useT } from "@/lib/i18n/client";

function AdminBarCard({
  title,
  icon,
  items,
  prefix = "",
  barColor = "bg-orange-600",
}: {
  title: string;
  icon: string;
  items: CountItem[];
  prefix?: string;
  barColor?: string;
}) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-base text-orange-600 dark:text-orange-400">
          {icon}
        </span>
        <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          {title}
        </h4>
      </div>
      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                {item.icon ? `${item.icon} ` : ""}
                {prefix}
                {item.label}
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                {item.count}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor} transition-all duration-300`}
                style={{ width: `${Math.max(8, Math.round((item.count / max) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminStatsPanel() {
  const { t } = useT();
  const [stats, setStats] = useState<AdminStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadStats() {
    setLoading(true);
    try {
      const data = await getAdminStatsAction();
      setStats(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-12 text-center text-xs text-slate-400">
        {t("admin_stats.loading")}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 p-12 text-center text-xs text-red-500">
        {t("admin_stats.error")}
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 text-left">
      {/* Cabecera estilo Stitch */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/60 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">analytics</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {t("admin_stats.title")}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Tiempo Real
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t("admin_stats.subtitle")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadStats}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#f2f3ff] hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-base leading-none">refresh</span>
          <span>{t("admin_stats.refresh")}</span>
        </button>
      </div>

      {/* KPIs Globales (6 tarjetas limpias) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-orange-600">group</span>
              {t("admin_stats.kpi_users")}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {stats.totalUsers}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            {stats.activeUsers} {t("admin_stats.kpi_users_active")}
            {stats.disabledUsers > 0 ? ` • ${stats.disabledUsers} ${t("admin_stats.kpi_users_inact")}` : ""}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-orange-600">restaurant</span>
              {t("admin_stats.kpi_places")}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[9px] font-bold">
              Catálogo
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {stats.totalPlaces}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {stats.communityPlaces} {t("admin_stats.kpi_places_com")} • {stats.privatePlaces} {t("admin_stats.kpi_places_priv")}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-blue-600">chat</span>
              {t("admin_stats.kpi_comments")}
            </span>
            <span className="material-symbols-outlined text-sm text-emerald-500">trending_up</span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {stats.totalComments}
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-1">
            +{stats.last30Days.comments} (30d)
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-amber-500">event_available</span>
              {t("admin_stats.kpi_visits")}
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {stats.totalVisits}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            +{stats.last30Days.visits} (30d)
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-emerald-600">sell</span>
              {t("admin_stats.kpi_taxonomy")}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-bold">
              {stats.totalOccasions + stats.totalTags}
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {stats.totalOccasions}/{stats.totalTags}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {t("admin_stats.kpi_taxonomy_sub")}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-slate-500">lock</span>
              {t("admin_stats.kpi_groups_closed")}
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {stats.totalGroups}
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
            {stats.closedPlaces} {t("admin_stats.kpi_closed_places")}
          </div>
        </div>
      </div>

      {/* Actividad últimos 30 días (Banner cálido Stitch) */}
      <div className="px-4 py-3 rounded-2xl bg-orange-50/90 dark:bg-orange-950/30 border border-orange-200/70 dark:border-orange-900/50 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 font-bold text-slate-900 dark:text-orange-200">
          <span className="w-7 h-7 rounded-full bg-orange-600 text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-base leading-none">bolt</span>
          </span>
          <span>{t("admin_stats.pulse_title")}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap font-bold">
          <span className="px-3 py-1 rounded-full bg-white dark:bg-slate-900 text-orange-700 dark:text-orange-300 border border-orange-200/60 dark:border-orange-900/50">
            +{stats.last30Days.places} {t("admin_stats.pulse_places")}
          </span>
          <span className="px-3 py-1 rounded-full bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 border border-slate-200/70 dark:border-slate-800">
            +{stats.last30Days.comments} {t("admin_stats.pulse_comments")}
          </span>
          <span className="px-3 py-1 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-800">
            +{stats.last30Days.visits} {t("admin_stats.pulse_visits")}
          </span>
          <span className="px-3 py-1 rounded-full bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-slate-200/70 dark:border-slate-800">
            +{stats.last30Days.users} {t("admin_stats.pulse_users")}
          </span>
        </div>
      </div>

      {/* Rankings: Top Contribuidores y Top Sitios Populares */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Top Contribuidores */}
        <div className="xl:col-span-4 p-4 sm:p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span>🏅</span>
              <span>{t("admin_stats.top_contributors")}</span>
            </h4>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
              {stats.topContributors.length} {t("admin_stats.kpi_users_active")}
            </span>
          </div>
          {stats.topContributors.length === 0 ? (
            <p className="text-xs text-slate-400 italic">{t("admin_stats.no_data")}</p>
          ) : (
            <div className="space-y-2">
              {stats.topContributors.map((c, idx) => {
                const initials = (c.name || c.username || "U")
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <div
                    key={c.userId}
                    className="p-2.5 rounded-xl bg-[#f8f9ff] dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-black text-orange-600 dark:text-orange-400 w-5 shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-900 dark:text-orange-200 font-bold text-[11px] flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          @{c.username || c.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{c.name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-bold">
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                        🍽️ {c.placesCount}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                        💬 {c.commentsCount}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Sitios Comunitarios Populares */}
        <div className="xl:col-span-8 p-4 sm:p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span>🔥</span>
              <span>{t("admin_stats.top_places")}</span>
            </h4>
            <span className="text-[10px] font-semibold text-slate-400">
              {stats.topPopularPlaces.length} destacados
            </span>
          </div>
          {stats.topPopularPlaces.length === 0 ? (
            <p className="text-xs text-slate-400 italic">{t("admin_stats.no_data")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {stats.topPopularPlaces.map((p, idx) => (
                <div
                  key={p.placeId}
                  className="p-3 rounded-xl bg-[#f8f9ff] dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-black text-orange-600 dark:text-orange-400 shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {p.city || "—"} • {p.priceRange}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-[10px] font-bold">
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                      ⭐ {p.favoritesCount}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                      ✅ {p.visitedCount}
                    </span>
                    {p.avgRating !== null && (
                      <span className="px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300">
                        {p.avgRating}/10
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Distribuciones Globales (4 columnas Stitch) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <AdminBarCard
          title={t("admin_stats.by_city")}
          icon="location_city"
          items={stats.topCitiesGlobal}
          barColor="bg-orange-600"
        />
        <AdminBarCard
          title={t("admin_stats.by_occasion")}
          icon="restaurant_menu"
          items={stats.topOccasionsGlobal}
          barColor="bg-amber-500"
        />
        <AdminBarCard
          title={t("admin_stats.by_price")}
          icon="payments"
          items={stats.priceDistributionGlobal}
          barColor="bg-emerald-600"
        />
        <AdminBarCard
          title={t("admin_stats.top_tags")}
          icon="sell"
          items={stats.topTagsGlobal}
          prefix="#"
          barColor="bg-orange-600"
        />
      </div>
    </div>
  );
}
