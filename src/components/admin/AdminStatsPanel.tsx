"use client";

import { useState, useEffect } from "react";
import { getAdminStatsAction, type AdminStatsData, type CountItem } from "@/lib/actions/stats";

function AdminBarCard({
  title,
  items,
  prefix = "",
  barColor = "bg-amber-500",
}: {
  title: string;
  items: CountItem[];
  prefix?: string;
  barColor?: string;
}) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-2.5">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </h4>
      <div className="space-y-2">
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
                className={`h-full rounded-full ${barColor}`}
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
    return <p className="text-xs text-slate-400 text-center py-8">Calculando métricas globales...</p>;
  }

  if (!stats) {
    return (
      <p className="text-xs text-red-400 text-center py-8">
        No se pudieron cargar las estadísticas de administración.
      </p>
    );
  }

  return (
    <div className="w-full space-y-4 text-left">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            📊 Analítica Global de GastroMap
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Métricas completas de uso, comunidad, catálogo y tendencias (respetando notas y fichas privadas)
          </p>
        </div>
        <button
          type="button"
          onClick={loadStats}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer shrink-0"
        >
          ↻ Actualizar
        </button>
      </div>

      {/* KPIs Globales */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div className="text-[11px] font-semibold text-slate-500">👥 Usuarios</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
            {stats.totalUsers}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {stats.activeUsers} activos
            {stats.disabledUsers > 0 ? ` • ${stats.disabledUsers} inact.` : ""}
          </div>
        </div>

        <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div className="text-[11px] font-semibold text-slate-500">🍽️ Sitios</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
            {stats.totalPlaces}
          </div>
          <div className="text-[10px] text-slate-500">
            {stats.communityPlaces} com. • {stats.privatePlaces} priv.
          </div>
        </div>

        <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div className="text-[11px] font-semibold text-slate-500">💬 Comentarios</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
            {stats.totalComments}
          </div>
          <div className="text-[10px] text-blue-500 font-semibold">
            +{stats.last30Days.comments} (30d)
          </div>
        </div>

        <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div className="text-[11px] font-semibold text-slate-500">📅 Visitas</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
            {stats.totalVisits}
          </div>
          <div className="text-[10px] text-emerald-500 font-semibold">
            +{stats.last30Days.visits} (30d)
          </div>
        </div>

        <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div className="text-[11px] font-semibold text-slate-500">🏷️ Taxonomía</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
            {stats.totalOccasions}/{stats.totalTags}
          </div>
          <div className="text-[10px] text-slate-500">Planes / Tags</div>
        </div>

        <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div className="text-[11px] font-semibold text-slate-500">🔒 Grupos / Cerr.</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
            {stats.totalGroups}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
            {stats.closedPlaces} sitios cerrados
          </div>
        </div>
      </div>

      {/* Actividad últimos 30 días */}
      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="font-bold text-amber-800 dark:text-amber-300">
          ⚡ Pulso de los últimos 30 días:
        </span>
        <div className="flex items-center gap-4 flex-wrap font-semibold text-slate-700 dark:text-slate-200">
          <span>+{stats.last30Days.places} sitios</span>
          <span>+{stats.last30Days.comments} comentarios</span>
          <span>+{stats.last30Days.visits} visitas</span>
          <span>+{stats.last30Days.users} usuarios nuevos</span>
        </div>
      </div>

      {/* Rankings: Top Contribuidores y Top Sitios Populares */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Contribuidores */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            🏅 Top Contribuidores
          </h4>
          {stats.topContributors.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Sin actividad registrada todavía.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {stats.topContributors.map((c, idx) => (
                <div
                  key={c.userId}
                  className="py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 text-center font-black text-amber-500">#{idx + 1}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        @{c.username || c.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{c.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[11px] font-semibold">
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      🍽️ {c.placesCount}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300">
                      💬 {c.commentsCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Sitios Comunitarios Populares */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            🔥 Top Sitios Populares (Comunidad)
          </h4>
          {stats.topPopularPlaces.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Sin interacciones todavía.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {stats.topPopularPlaces.map((p, idx) => (
                <div
                  key={p.placeId}
                  className="py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 text-center font-black text-amber-500">#{idx + 1}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {p.city || "Sin ciudad"} • {p.priceRange}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-bold">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      ⭐ {p.favoritesCount}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      ✅ {p.visitedCount}
                    </span>
                    {p.avgRating !== null && (
                      <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-700 dark:text-violet-300">
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

      {/* Distribuciones Globales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminBarCard
          title="🏙️ Top Ciudades"
          items={stats.topCitiesGlobal}
          barColor="bg-blue-500"
        />
        <AdminBarCard
          title="🍽️ Top Planes"
          items={stats.topOccasionsGlobal}
          barColor="bg-amber-500"
        />
        <AdminBarCard
          title="💶 Precios"
          items={stats.priceDistributionGlobal}
          barColor="bg-emerald-500"
        />
        <AdminBarCard
          title="🏷️ Top Etiquetas"
          items={stats.topTagsGlobal}
          prefix="#"
          barColor="bg-violet-500"
        />
      </div>
    </div>
  );
}
